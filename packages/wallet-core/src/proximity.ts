/**
 * Yakın alan sunumu, cüzdan tarafı (P4-3; ISO/IEC 18013-5, ARF OIA_01, ProxId_*). Taşıyıcıdan bağımsız: uygulama
 * `ProximityTransport`'u yerel BLE modülüyle (TamgaBle) sağlar; test sahte taşıyıcıyla gerçek okuyucu mantığına bağlanır.
 * Akış: tanıtım QR'ı → okuyucunun şifreli isteği → kişiye istenen alanlar (okuyucu kimliği doğrulanmamış) → onay → seçici
 * açıklama + holder anahtarıyla cihaz imzası (anahtar cihazdan çıkmaz) → şifreli yanıt → günlük. Ret: oturum sonu.
 */
import { pidSdJwtName } from "@tamga-network/core/pid";
import {
  BleReassembler,
  bleChunks,
  buildDeviceResponse,
  createEngagement,
  deviceSignAsync,
  discloseMdoc,
  holderReceiveEstablishment,
  holderSendResponse,
  sessionEnd,
  type ItemsRequest,
} from "@tamga-network/mdoc";
import { b64uDecode } from "./b64.js";
import type { KeyProvider } from "./keys.js";
import { markCopyUsed, selectCopy, type StoredCredential, type WalletState } from "./store.js";

export interface ProximityTransport {
  start(serviceUuid: string): Promise<void>;
  /** tek GATT parçası (başlık baytı dahil) */
  send(chunk: Uint8Array): Promise<void>;
  stop(): Promise<void>;
  onChunk(cb: (chunk: Uint8Array) => void): () => void;
  /** ATT MTU değişimi (yoksa 23 varsayılır) */
  onMtu?(cb: (mtu: number) => void): () => void;
  /** bağlantı koptu / taşıyıcı hatası — istek beklenirken oturumu hemen bitirir */
  onClose?(cb: (reason: string) => void): () => void;
}

export interface ProximityRequestView {
  docType: string;
  namespace: string;
  /** okuyucunun istediği öğeler */
  requested: string[];
  /** belgede olmayan istenen öğeler */
  missing: string[];
  credential: StoredCredential | null;
}

export interface ProximityResult {
  state: WalletState;
  outcome: "sent" | "declined" | "error";
  view?: ProximityRequestView;
  reason?: string;
}

/**
 * Oturumu başlatır, QR'ı `onQr` ile verir, isteği bekler, `approve` ile kişiye sorar. `approve` açıklanacak öğeleri (istenenlerin
 * alt kümesi) ya da ret için `null` döndürür.
 */
export async function presentProximity(p: {
  transport: ProximityTransport;
  state: WalletState;
  keys: KeyProvider;
  onQr: (qr: string) => void;
  approve: (view: ProximityRequestView) => Promise<string[] | null>;
  randomBytes?: (n: number) => Uint8Array;
  timeoutMs?: number;
  now?: number;
}): Promise<ProximityResult> {
  const eng = createEngagement({ randomBytes: p.randomBytes });
  let mtu = 23;
  const offMtu = p.transport.onMtu?.((m) => (mtu = m));
  const reasm = new BleReassembler();
  let resolveMsg: (m: Uint8Array) => void = () => {};
  let rejectMsg: (e: Error) => void = () => {};
  const firstMessage = new Promise<Uint8Array>((res, rej) => {
    resolveMsg = res;
    rejectMsg = rej;
  });
  const offChunk = p.transport.onChunk((c) => {
    try {
      const m = reasm.push(c);
      if (m) resolveMsg(m);
    } catch (e) {
      rejectMsg(e as Error);
    }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const offClose = p.transport.onClose?.((reason) => rejectMsg(new Error(reason)));
  const cleanup = async () => {
    offChunk();
    offMtu?.();
    offClose?.();
    clearTimeout(timer);
    await p.transport.stop().catch(() => undefined);
  };
  const send = async (bytes: Uint8Array) => {
    for (const c of bleChunks(bytes, Math.max(20, mtu - 3))) await p.transport.send(c);
  };
  try {
    p.onQr(eng.qr);
    await p.transport.start(eng.bleServiceUuid);
    const timeout = new Promise<never>(
      (_, rej) => (timer = setTimeout(() => rej(new Error("no reader connected")), p.timeoutMs ?? 120_000)),
    );
    const est = await Promise.race([firstMessage, timeout]);
    const hs = holderReceiveEstablishment(eng, est);
    const item: ItemsRequest | undefined = hs.request[0];
    if (!item) throw new Error("empty request");
    const [namespace, els] = Object.entries(item.nameSpaces)[0] ?? ["", {}];
    const requested = Object.keys(els);
    const cred =
      p.state.credentials.find(
        (c) =>
          c.vct === item.docType &&
          !c.revokedLocally &&
          c.status?.value !== "revoked" &&
          c.copies.some((k) => !!k.mdoc),
      ) ?? null;
    // istenen öğe mdoc tanımlayıcısı; belgenin claim'leri SD-JWT adıyla (AB PID tablosu, ADR-0045: `birth_date` ↔ `birthdate`)
    const has = (el: string) => !!cred && pidSdJwtName(el) in cred.claims;
    const view: ProximityRequestView = {
      docType: item.docType,
      namespace,
      requested,
      missing: cred ? requested.filter((r) => !has(r)) : requested,
      credential: cred,
    };
    const chosen = cred ? await p.approve(view) : null;
    const rpKey = `proximity:${eng.bleServiceUuid}`;
    const log = (outcome: "sent" | "declined" | "error", disclosed: string[], state = p.state): WalletState => ({
      ...state,
      presentationLog: [
        ...state.presentationLog,
        { ts: p.now ?? Date.now(), clientId: "proximity", vct: item.docType, requested, disclosed, outcome },
      ],
    });
    if (!cred || !chosen) {
      await send(sessionEnd());
      await cleanup();
      return { state: log("declined", []), outcome: "declined", view };
    }
    const disclose = chosen.filter((e) => requested.includes(e) && has(e));
    const copy = selectCopy(cred, rpKey);
    if (!copy?.mdoc) throw new Error("no unused copy with an mdoc");
    const partial = discloseMdoc(b64uDecode(copy.mdoc), { [namespace]: disclose });
    const devSig = await deviceSignAsync(hs.transcript, item.docType, (tbs) => p.keys.sign(copy.keyRef, tbs));
    await send(
      holderSendResponse(
        hs,
        buildDeviceResponse({ docType: item.docType, issuerSigned: partial, deviceSignature: devSig }),
      ),
    );
    await cleanup();
    return { state: log("sent", disclose, markCopyUsed(p.state, cred.id, copy.keyRef, rpKey)), outcome: "sent", view };
  } catch (e) {
    await cleanup();
    return { state: p.state, outcome: "error", reason: (e as Error).message };
  }
}
