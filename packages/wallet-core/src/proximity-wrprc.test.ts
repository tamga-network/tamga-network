/**
 * ADR-0026 K5 (2026-10-13) yakın alanda: okuyucu isteği `requestInfo.euWrprc` (CBOR kayıt sertifikası, `rc-wrp+cwt`) ve okuyucu
 * imzası (`readerAuth`) taşır; cüzdan uzaktan akıştaki 1–4'ü uygular (bağ okuyucu sertifikasıyla). Sertifikasız istek: uyarı +
 * varsayılan "Paylaşma", 2028-08-11'den sonra ret. Gerçek ISO 18013-5 oturumu, sahte BLE taşıyıcı.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto, createHash } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import {
  BleReassembler,
  bleChunks,
  createEngagement,
  holderReceiveEstablishment,
  issueMdoc,
  p256,
  readerReceive,
  readerStart,
  signWrprcCwt,
  type ItemsRequest,
} from "@tamga-network/mdoc";
import { MemoryKeyStore, SoftwareKeyProvider, jwkToRaw } from "./keys.js";
import { b64u } from "./b64.js";
import { newState, type StoredCredential, type WalletState } from "./store.js";
import { presentProximity, type ProximityRequestView } from "./proximity.js";
import { fakeBleLink } from "./w2w.js";
import { WRPRC_REQUIRED_FROM, checkProximityRegistration } from "./wrprc.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const DOCTYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
const NOW = Date.UTC(2026, 9, 13);
const nowSec = NOW / 1000;

interface Party {
  sk: Uint8Array;
  der: Uint8Array;
  fp: string;
}
async function party(subject: string): Promise<Party> {
  const kp = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "0" + Math.floor(Math.random() * 1e6),
    name: subject,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: kp,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  const der = new Uint8Array(cert.rawData);
  const d = ((await webcrypto.subtle.exportKey("jwk", kp.privateKey)) as { d: string }).d;
  return { sk: new Uint8Array(Buffer.from(d, "base64url")), der, fp: createHash("sha256").update(der).digest("hex") };
}
const sign = (sk: Uint8Array) => (tbs: Uint8Array) =>
  p256.sign(tbs, sk, { prehash: true, lowS: true, format: "compact" });

let registrar: Party, stranger: Party, gate: Party, impostor: Party;
beforeAll(async () => {
  registrar = await party("CN=Registrar (test)");
  stranger = await party("CN=Not a registrar");
  gate = await party("CN=Gate, O=Gate Ltd, 2.5.4.97=VATTR-1234567890");
  impostor = await party("CN=Other, O=Other Ltd, 2.5.4.97=VATTR-9999999999");
});

const payload = (o: Record<string, unknown> = {}) => ({
  name: "Kapı",
  sub: "VATTR-1234567890",
  country: "TR",
  privacy_policy: "https://gate.example/privacy",
  credentials: [{ format: "mso_mdoc", meta: { doctype_value: DOCTYPE }, claim: [{ path: [NS, "age_over_18"] }] }],
  iat: nowSec - 10,
  exp: nowSec + 86400,
  ...o,
});
const wrprc = (signer = registrar, o: Record<string, unknown> = {}) =>
  signWrprcCwt({ payload: payload(o), x5chain: [signer.der], sign: sign(signer.sk) });

/** okuyucu tarafı: isteği kurar, holder'ın çözdüğü öğe ve oturum dökümü */
async function decoded(items: ItemsRequest[], reader?: Party) {
  const eng = createEngagement();
  const { establishment } = readerStart(
    eng.qr,
    items,
    reader ? { readerAuth: { sk: reader.sk, x5chain: [reader.der] } } : {},
  );
  const hs = holderReceiveEstablishment(eng, establishment);
  return { item: hs.request[0], transcript: hs.transcript };
}
const req = (euWrprc?: Uint8Array): ItemsRequest[] => [
  {
    docType: DOCTYPE,
    nameSpaces: { [NS]: { age_over_18: false, given_name: false } },
    ...(euWrprc ? { requestInfo: { euWrprc } } : {}),
  },
];

describe("checkProximityRegistration (ADR-0026 K5 yakın alan)", () => {
  it("geçerli: kayıt kurumu imzası, süre, sub = okuyucu sertifikası; izinli öğeler; okuyucu parmak izi", async () => {
    const { item, transcript } = await decoded(req(await wrprc()), gate);
    const r = checkProximityRegistration(item, transcript, [registrar.fp], NOW);
    expect(r).toMatchObject({
      present: true,
      valid: true,
      allowedClaims: ["age_over_18"],
      tradeName: "Kapı",
      privacyPolicy: "https://gate.example/privacy",
      readerCertFingerprint: gate.fp,
    });
  });

  it("1–3 tutmazsa geçersiz: kayıt kurumu değil, süresi geçmiş, okuyucu imzası yok, başka kurumun sertifikası", async () => {
    const run = async (cert: Uint8Array, reader?: Party) => {
      const { item, transcript } = await decoded(req(cert), reader);
      return checkProximityRegistration(item, transcript, [registrar.fp], NOW);
    };
    expect(await run(await wrprc(stranger), gate)).toMatchObject({ valid: false, reason: /registrar/ });
    expect(await run(await wrprc(registrar, { exp: nowSec - 1 }), gate)).toMatchObject({
      valid: false,
      reason: /expired/,
    });
    expect(await run(await wrprc())).toMatchObject({ valid: false, reason: /reader authentication/ });
    expect(await run(await wrprc(), impostor)).toMatchObject({ valid: false, reason: /does not belong/ });
  });

  it("sertifikasız istek: uyarı + varsayılan Paylaşma; 2028-08-11'den sonra ret", async () => {
    const { item, transcript } = await decoded(req(), gate);
    expect(checkProximityRegistration(item, transcript, [registrar.fp], NOW)).toMatchObject({
      present: false,
      valid: true,
      flags: ["registration_missing"],
      defaultChoice: "decline",
      readerCertFingerprint: gate.fp,
    });
    expect(checkProximityRegistration(item, transcript, [registrar.fp], WRPRC_REQUIRED_FROM)).toMatchObject({
      present: false,
      valid: false,
      reason: "registration_missing",
    });
  });
});

// ---- presentProximity uçtan uca: okuyucu ↔ cüzdan sahte BLE üzerinden
async function wallet(): Promise<{ state: WalletState; keys: SoftwareKeyProvider }> {
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const jwk = await keys.generate("c1");
  const issuerSk = p256.utils.randomSecretKey();
  const s = Math.floor(NOW / 1000);
  const m = issueMdoc({
    docType: DOCTYPE,
    namespaces: { [NS]: { given_name: "Ayşe", age_over_18: true } },
    deviceKeyRaw: jwkToRaw(jwk),
    issuerSk,
    x5chain: [new Uint8Array([0x30, 0])],
    signed: s - 60,
    validFrom: s - 60,
    validUntil: s + 86400,
    randomBytes: (n) => p256.utils.randomSecretKey().slice(0, n),
  });
  const cred = {
    id: "id-1",
    vct: DOCTYPE,
    typeName: "Kimlik",
    issuer: "https://id.example",
    issuerId: "0x00",
    leafFingerprint: "f",
    iat: s - 60,
    claims: { given_name: "Ayşe", age_over_18: true },
    disclosureNames: ["given_name", "age_over_18"],
    copies: [{ keyRef: "c1", cnf: jwk, combined: "x~", usedBy: [], mdoc: b64u(m.issuerSigned) }],
    receivedAt: s,
  } as unknown as StoredCredential;
  return { state: { ...newState("i"), credentials: [cred] }, keys };
}

async function run(items: ItemsRequest[], reader: Party | undefined, now: number) {
  const w = await wallet();
  const link = fakeBleLink();
  let gotQr: (q: string) => void = () => {};
  const qr = new Promise<string>((r) => (gotQr = r));
  const seen: ProximityRequestView[] = [];
  const holder = presentProximity({
    transport: link.holder,
    state: w.state,
    keys: w.keys,
    onQr: gotQr,
    timeoutMs: 5000,
    now,
    registrarKeys: [registrar.fp],
    approve: async (v) => {
      seen.push(v);
      return v.requested;
    },
  });
  const { session, establishment } = readerStart(
    await qr,
    items,
    reader ? { readerAuth: { sk: reader.sk, x5chain: [reader.der] } } : {},
  );
  const reasm = new BleReassembler();
  const msg = new Promise<Uint8Array>((res) =>
    link.reader.onChunk((c) => {
      const m = reasm.push(c);
      if (m) res(m);
    }),
  );
  await link.reader.connect(session.bleServiceUuid!);
  for (const c of bleChunks(establishment, 180)) await link.reader.send(c);
  const got = readerReceive(session, await msg);
  return { result: await holder, seen, deviceResponse: got.deviceResponse };
}

describe("presentProximity — kayıt sertifikası (ADR-0026 K5)", () => {
  it("geçerli sertifika: kişiye sorulur, görünümde kayıt bilgisi; yanıt gider", async () => {
    const r = await run(req(await wrprc()), gate, NOW);
    expect(r.result.outcome).toBe("sent");
    expect(r.seen[0].registration).toMatchObject({ present: true, valid: true, tradeName: "Kapı" });
    expect(r.deviceResponse).toBeInstanceOf(Uint8Array);
  });

  it("geçersiz sertifika: kişiye sorulmadan ret (oturum sonu)", async () => {
    const r = await run(req(await wrprc(stranger)), gate, NOW);
    expect(r.seen).toHaveLength(0);
    expect(r.result).toMatchObject({ outcome: "declined", reason: expect.stringMatching(/registrar/) });
    expect(r.deviceResponse).toBeNull();
  });

  it("sertifikasız: bugün uyarıyla sorulur (varsayılan Paylaşma); 2028-08-11'den sonra sorulmadan ret", async () => {
    const today = await run(req(), gate, NOW);
    expect(today.seen[0].registration).toMatchObject({ flags: ["registration_missing"], defaultChoice: "decline" });
    const later = await run(req(), gate, WRPRC_REQUIRED_FROM + 1);
    expect(later.seen).toHaveLength(0);
    expect(later.result).toMatchObject({ outcome: "declined", reason: "registration_missing" });
  });
});
