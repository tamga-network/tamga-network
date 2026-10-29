/**
 * Yakın alan sunumu, cüzdan tarafı (P4-3; ISO/IEC 18013-5, ARF OIA_01, ProxId_*). Taşıyıcıdan bağımsız: uygulama
 * `ProximityTransport`'u yerel BLE modülüyle (TamgaBle) sağlar; test sahte taşıyıcıyla gerçek okuyucu mantığına bağlanır.
 * Akış: tanıtım QR'ı → okuyucunun şifreli isteği → kişiye istenen alanlar (okuyucu kimliği doğrulanmamış) → onay → seçici
 * açıklama + holder anahtarıyla cihaz imzası (anahtar cihazdan çıkmaz) → şifreli yanıt → günlük. Ret: oturum sonu.
 *
 * 0.6.0 (ADR-0026 K5): istek kayıt sertifikası (`requestInfo.euWrprc`) ve okuyucu imzası (`readerAuth`) taşıyabilir; cüzdan onu
 * uzaktan akıştaki kurallarla doğrular (`view.registration`). Sertifika geçersizse kişiye sorulmadan ret; sertifika yoksa uyarı +
 * varsayılan "Paylaşma" (2028-08-11'den sonra ret). Cüzdandan cüzdana gösterimde (karşı taraf bir kişi) bu denetim yapılmaz.
 */
import { pidSdJwtName } from "@tamga-network/core/pid";
import { epochMillis } from "@tamga-network/core/time";
import {
  BleReassembler,
  bleChunks,
  buildDeviceResponse,
  buildDeviceResponseStatus,
  createEngagement,
  deviceSignAsync,
  discloseMdoc,
  holderReceiveEstablishment,
  holderSendResponse,
  sessionEnd,
} from "@tamga-network/mdoc";
import { b64uDecode } from "./b64.js";
import type { KeyProvider } from "./keys.js";
import { markCopyUsed, selectCopy, type StoredCredential, type WalletState } from "./store.js";
import { offlineDisclosurePolicy, type DisclosurePolicyResult } from "./disclosure-policy.js";
import { checkProximityRegistration, type ProximityRegistrationCheck, type ReaderTrust } from "./wrprc.js";
import type { RegistrationStatusLookup } from "./wrprc-status.js";

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
  /**
   * Ağın ADR-0046'sı: yakın mesafede kayıt sertifikası yoktur, kısıtlı belgenin paylaşım kuralı değerlendirilemez. `restricted`
   * ise onay ekranı uyarır (varsayılan "Paylaşma", son karar kişinin); belge yoksa alan yok.
   */
  disclosurePolicy?: DisclosurePolicyResult;
  /**
   * 0.6.0 (ADR-0026 K5): okuyucunun kayıt sertifikası denetimi. `flags` `registration_missing` ise onay ekranı uyarır ve
   * `defaultChoice` "decline"dır; `allowedClaims` dışındaki istenen öğeler fazla istektir (uyarı). `valid: false` istekte
   * `approve` çağrılmaz (cüzdan reddeder). Cüzdandan cüzdana gösterimde yok.
   */
  registration?: ProximityRegistrationCheck;
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
  /**
   * ADR-0026 K5: kayıt kurumu anahtarları (`fetchRegistrarKeys`). `false` = kayıt sertifikası denetimi yok (yalnız cüzdandan
   * cüzdana: karşı taraf bir kişi). Verilmezse boş liste: sertifikasız istek uyarıyla, sertifikalı istek doğrulanamaz → ret.
   */
  registrarKeys?: string[] | false;
  /**
   * 0.6.0: okuyucu sertifikasının güven çapaları (`checkProximityRegistration`'ın `ReaderTrust`'ı): imzalı listenin `root_cas`
   * sertifikaları ve/veya okuyucu tarafının kaydındaki yaprak parmak izleri. Verilmezse kayıt sertifikalı istek
   * `untrusted_reader_certificate` ile kişiye sorulmadan reddedilir (güvenli varsayılan). `registrarKeys: false` iken kullanılmaz.
   */
  readerTrust?: ReaderTrust;
  /**
   * ADR-0068 K5: kayıt sertifikalarının önceden çekilmiş durumları (`fetchRegistrationStatuses`; yakın alanda çoğu zaman
   * önbellekteki kopya, `offline: true`). Verilmezse durum "denetlenemedi" uyarısı (`registration_status_unknown`).
   */
  registrationStatuses?: RegistrationStatusLookup;
  /** 0.6.0 (TS9): DeviceEngagement'a eklenecek ek alanlar (cüzdandan cüzdana teklif); `createEngagement` seçeneği */
  engagementOffer?: import("@tamga-network/mdoc").PresentationOffer;
  /**
   * 0.6.0 (TS9 STS9_34): istek kişiye gösterilmeden önce denetim — `null` = devam; `{ status }` = belge göndermeden
   * `DeviceResponse.status` ile kes (yanıt `rejectDelayMs` sabit süreye kadar bekletilir; zamanlama sızıntısı yok).
   */
  screenRequest?: (
    item: import("@tamga-network/mdoc").DecodedItemsRequest,
  ) => { status: number; reason: string } | null;
  /** `screenRequest` reddinde isteğin alınışından yanıta kadar sabit süre (ms; varsayılan 1500) */
  rejectDelayMs?: number;
  /** test için: bekleme ve saat (ms) */
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}): Promise<ProximityResult> {
  const eng = createEngagement({
    randomBytes: p.randomBytes,
    ...(p.engagementOffer ? { offer: p.engagementOffer } : {}),
  });
  const clock = p.clock ?? (() => Date.now());
  const sleep = p.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
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
    const receivedAt = clock();
    const hs = holderReceiveEstablishment(eng, est);
    const item = hs.request[0];
    if (!item) throw new Error("empty request");
    const requestedAll = Object.values(item.nameSpaces).flatMap((els) => Object.keys(els));
    // TS9 STS9_34: teklif dışı ya da saklama niyetli istek — kişiye gösterilmez, belge gitmez, yanıt sabit sürede
    const screened = p.screenRequest?.(item) ?? null;
    if (screened) {
      const wait = (p.rejectDelayMs ?? 1500) - (clock() - receivedAt);
      if (wait > 0) await sleep(wait);
      await send(holderSendResponse(hs, buildDeviceResponseStatus(screened.status)));
      await cleanup();
      const state: WalletState = {
        ...p.state,
        presentationLog: [
          ...p.state.presentationLog,
          {
            ts: p.now ?? Date.now(),
            clientId: "proximity",
            vct: item.docType,
            requested: requestedAll,
            disclosed: [],
            outcome: "declined",
          },
        ],
      };
      return { state, outcome: "declined", reason: screened.reason };
    }
    const [namespace, els] = Object.entries(item.nameSpaces)[0] ?? ["", {}];
    const requested = Object.keys(els);
    // uzaktan sunumla aynı kural (matchDcql): iptal edilmiş VE askıdaki belge önerilmez
    const cred =
      p.state.credentials.find(
        (c) =>
          c.vct === item.docType &&
          !c.revokedLocally &&
          c.status?.value !== "revoked" &&
          c.status?.value !== "suspended" &&
          c.copies.some((k) => !!k.mdoc),
      ) ?? null;
    // istenen öğe mdoc tanımlayıcısı; belgenin claim'leri SD-JWT adıyla (AB PID tablosu, ADR-0045: `birth_date` ↔ `birthdate`)
    const has = (el: string) => !!cred && pidSdJwtName(el) in cred.claims;
    const registration =
      p.registrarKeys === false
        ? undefined
        : checkProximityRegistration(
            item,
            hs.transcript,
            p.registrarKeys ?? [],
            p.readerTrust ?? { trustAnchors: [] },
            epochMillis(p.now ?? Date.now()),
            p.registrationStatuses,
          );
    const view: ProximityRequestView = {
      docType: item.docType,
      namespace,
      requested,
      missing: cred ? requested.filter((r) => !has(r)) : requested,
      credential: cred,
      ...(cred ? { disclosurePolicy: offlineDisclosurePolicy(cred) } : {}),
      ...(registration ? { registration } : {}),
    };
    // ADR-0026 K5: geçersiz kayıt sertifikası (ya da 2028-08-11'den sonra sertifikasız istek) — kişiye sorulmadan ret
    const chosen = cred && registration?.valid !== false ? await p.approve(view) : null;
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
      return {
        state: log("declined", []),
        outcome: "declined",
        view,
        ...(registration?.valid === false ? { reason: registration.reason ?? "registration_invalid" } : {}),
      };
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
