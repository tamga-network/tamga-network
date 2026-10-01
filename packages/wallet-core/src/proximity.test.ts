/** Yakın alan sunumu (P4-3): sahte BLE taşıyıcısı + gerçek okuyucu mantığı; onay, seçim, ret, belge yok. */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  BleReassembler,
  bleChunks,
  issueMdoc,
  parseDeviceResponse,
  readerReceive,
  readerStart,
  verifyDeviceAuth,
  verifyIssuerSigned,
} from "@tamga-network/mdoc";
import {
  MemoryKeyStore,
  SoftwareKeyProvider,
  b64u,
  jwkToRaw,
  newState,
  presentProximity,
  type ProximityTransport,
  type StoredCredential,
  type WalletState,
} from "./index.js";

const DOCTYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
const issuerSk = p256.utils.randomSecretKey();
const issuerPub = p256.getPublicKey(issuerSk, false);

async function walletWithIdentity(): Promise<{ state: WalletState; keys: SoftwareKeyProvider }> {
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const now = Math.floor(Date.now() / 1000);
  const claims = { given_name: "Ayşe", family_name: "Yılmaz", age_over_18: true };
  const copies = [];
  for (const ref of ["c1", "c2"]) {
    const jwk = await keys.generate(ref);
    const m = issueMdoc({
      docType: DOCTYPE,
      namespaces: { [NS]: claims },
      deviceKeyRaw: jwkToRaw(jwk),
      issuerSk,
      x5chain: [new Uint8Array([0x30, 1])],
      signed: now,
      validFrom: now,
      validUntil: now + 86400,
      randomBytes: (n) => p256.utils.randomSecretKey().slice(0, n),
    });
    copies.push({ keyRef: ref, cnf: jwk, combined: "x~", usedBy: [], mdoc: b64u(m.issuerSigned) });
  }
  const cred = {
    id: "id-1",
    vct: DOCTYPE,
    typeName: "Kimlik",
    issuer: "https://id.tamga.network",
    issuerId: "0x1",
    leafFingerprint: "f",
    iat: now,
    claims,
    disclosureNames: Object.keys(claims),
    copies,
    receivedAt: Date.now(),
  } as StoredCredential;
  return { state: { ...newState("i"), credentials: [cred] }, keys };
}

/** Bellek içi BLE: cüzdan ↔ okuyucu. Okuyucu QR gelince isteği yollar, yanıtı toplar. */
function bleLink(request: Record<string, boolean>) {
  let toWallet: ((c: Uint8Array) => void) | null = null;
  const fromWallet = new BleReassembler();
  let readerSession: ReturnType<typeof readerStart>["session"] | null = null;
  const result: { response: Uint8Array | null; ended: boolean; transcript?: Uint8Array } = {
    response: null,
    ended: false,
  };
  const transport: ProximityTransport = {
    start: async () => {},
    stop: async () => {},
    send: async (chunk) => {
      const m = fromWallet.push(chunk);
      if (m && readerSession) {
        const r = readerReceive(readerSession, m);
        result.response = r.deviceResponse;
        result.ended = r.ended;
      }
    },
    onChunk: (cb) => ((toWallet = cb), () => (toWallet = null)),
    onMtu: (cb) => (cb(185), () => {}),
  };
  const onQr = (qr: string) => {
    const { session, establishment } = readerStart(qr, [{ docType: DOCTYPE, nameSpaces: { [NS]: request } }]);
    readerSession = session;
    result.transcript = session.transcript;
    // okuyucu, cüzdan yayına başladıktan sonra yazar
    setTimeout(() => bleChunks(establishment, 20).forEach((c) => toWallet?.(c)), 0);
  };
  return { transport, onQr, result };
}

describe("presentProximity", () => {
  it("onay: yalnız seçilen alan gider; okuyucu imzayı doğrular; kopya işaretlenir, günlük", async () => {
    const { state, keys } = await walletWithIdentity();
    const link = bleLink({ age_over_18: false, given_name: false });
    const r = await presentProximity({
      transport: link.transport,
      state,
      keys,
      onQr: link.onQr,
      approve: async (v) => {
        expect([...v.requested].sort()).toEqual(["age_over_18", "given_name"]);
        expect(v.missing).toEqual([]);
        return ["age_over_18"]; // kişi adını göndermemeyi seçti
      },
    });
    expect(r.outcome).toBe("sent");
    expect(link.result.ended).toBe(true);
    const dr = parseDeviceResponse(link.result.response!);
    const v = verifyIssuerSigned(dr.issuerSigned, { issuerPubRaw: issuerPub, expectedDocType: DOCTYPE });
    expect(v.valid).toBe(true);
    expect(v.claims?.[NS]).toEqual({ age_over_18: true });
    expect(verifyDeviceAuth(dr.deviceSignature, link.result.transcript!, DOCTYPE, v.deviceKeyRaw!)).toBe(true);
    expect(r.state.credentials[0].copies.filter((c) => c.usedBy.length).length).toBe(1);
    expect(r.state.presentationLog.at(-1)).toMatchObject({
      clientId: "proximity",
      disclosed: ["age_over_18"],
      outcome: "sent",
    });
  });

  it("ret: yanıt yok, oturum sonu; günlükte declined", async () => {
    const { state, keys } = await walletWithIdentity();
    const link = bleLink({ age_over_18: false });
    const r = await presentProximity({
      transport: link.transport,
      state,
      keys,
      onQr: link.onQr,
      approve: async () => null,
    });
    expect(r.outcome).toBe("declined");
    expect(link.result).toMatchObject({ response: null, ended: true });
    expect(r.state.presentationLog.at(-1)?.outcome).toBe("declined");
  });

  it("belge yoksa sorulmadan ret", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const link = bleLink({ age_over_18: false });
    let asked = false;
    const r = await presentProximity({
      transport: link.transport,
      state: newState("i"),
      keys,
      onQr: link.onQr,
      approve: async () => ((asked = true), ["age_over_18"]),
    });
    expect(asked).toBe(false);
    expect(r.outcome).toBe("declined");
  });

  it("okuyucu bağlanmazsa zaman aşımı", async () => {
    const { state, keys } = await walletWithIdentity();
    const t: ProximityTransport = {
      start: async () => {},
      stop: async () => {},
      send: async () => {},
      onChunk: () => () => {},
    };
    const r = await presentProximity({
      transport: t,
      state,
      keys,
      onQr: () => {},
      approve: async () => null,
      timeoutMs: 20,
    });
    expect(r).toMatchObject({ outcome: "error", reason: "no reader connected" });
  });

  it("bağlantı koparsa beklemeden biter", async () => {
    const { state, keys } = await walletWithIdentity();
    let close: (r: string) => void = () => {};
    const t: ProximityTransport = {
      start: async () => void setTimeout(() => close("disconnected"), 0),
      stop: async () => {},
      send: async () => {},
      onChunk: () => () => {},
      onClose: (cb) => ((close = cb), () => {}),
    };
    const r = await presentProximity({ transport: t, state, keys, onQr: () => {}, approve: async () => null });
    expect(r).toMatchObject({ outcome: "error", reason: "disconnected" });
  });
});
