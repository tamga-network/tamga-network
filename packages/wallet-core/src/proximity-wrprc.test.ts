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
import { checkProximityRegistration, missingRegistrationPolicy } from "./wrprc.js";
import { epochMillis } from "@tamga-network/core";

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
/** kendinden imzalı; `ca` verilirse o CA'nın imzaladığı yaprak (CA'nın kendisi x5chain'e girmez — ARF RO-02 gibi) */
async function party(subject: string, ca?: { keys: CryptoKeyPair; name: string }): Promise<Party> {
  const kp = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const base = {
    serialNumber: "0" + Math.floor(Math.random() * 1e6),
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  };
  const cert = ca
    ? await X509CertificateGenerator.create({
        ...base,
        subject,
        issuer: ca.name,
        publicKey: kp.publicKey,
        signingKey: ca.keys.privateKey,
      })
    : await X509CertificateGenerator.createSelfSigned({ ...base, name: subject, keys: kp });
  const der = new Uint8Array(cert.rawData);
  const d = ((await webcrypto.subtle.exportKey("jwk", kp.privateKey)) as { d: string }).d;
  return { sk: new Uint8Array(Buffer.from(d, "base64url")), der, fp: createHash("sha256").update(der).digest("hex") };
}
const sign = (sk: Uint8Array) => (tbs: Uint8Array) =>
  p256.sign(tbs, sk, { prehash: true, lowS: true, format: "compact" });

let registrar: Party, stranger: Party, gate: Party, impostor: Party, caGate: Party, readerCa: Party;
beforeAll(async () => {
  // okuyucu sertifikası sağlayıcısı (imzalı listenin root_cas'ı) ve onun verdiği okuyucu sertifikası
  const caKeys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const caName = "CN=Reader CA (test), C=TR";
  const caCert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "0a",
    name: caName,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: caKeys,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true)],
  });
  const caDer = new Uint8Array(caCert.rawData);
  readerCa = { sk: new Uint8Array(), der: caDer, fp: createHash("sha256").update(caDer).digest("hex") };
  caGate = await party("CN=Gate, O=Gate Ltd, 2.5.4.97=VATTR-1234567890", { keys: caKeys, name: caName });
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

/** okuyucu tarafının imzalı listedeki kaydında sabitlenmiş yaprak parmak izi (RP kaydı) */
const pinned = () => ({ trustAnchors: [] as Uint8Array[], registeredFingerprints: [gate.fp] });

describe("missingRegistrationPolicy (ADR-0056 K10)", () => {
  it("tarihe bağlı geçiş yok: sertifikasız istek her zaman geçersiz", () => {
    expect(missingRegistrationPolicy()).toEqual({
      present: false,
      valid: false,
      reason: "registration_missing",
      flags: ["registration_missing"],
      defaultChoice: "decline",
    });
  });
  it("zaman birimi türle ve çalışma zamanında denetlenir (saniye verilirse hata)", async () => {
    const { item, transcript } = await decoded(req(), gate);
    expect(() =>
      checkProximityRegistration(item, transcript, [registrar.fp], pinned(), Math.floor(NOW / 1000) as never),
    ).toThrow(/milliseconds/);
  });
});

describe("checkProximityRegistration (ADR-0026 K5 yakın alan)", () => {
  it("geçerli: kayıt kurumu imzası, süre, sub = okuyucu sertifikası; izinli öğeler; okuyucu parmak izi", async () => {
    const { item, transcript } = await decoded(req(await wrprc()), gate);
    const r = checkProximityRegistration(item, transcript, [registrar.fp], pinned(), epochMillis(NOW));
    expect(r).toMatchObject({
      present: true,
      valid: true,
      allowedClaims: ["age_over_18"],
      tradeName: "Kapı",
      privacyPolicy: "https://gate.example/privacy",
      readerCertFingerprint: gate.fp,
    });
  });

  it("0.6.0: okuyucu sertifikası güvene bağlı olmalı — kendinden imzalı kopya geçersiz; CA'ya bağlı ya da kayıtlı parmak izi geçerli", async () => {
    // saldırgan: kayıtlı kurumun organizationIdentifier'ını taşıyan kendinden imzalı okuyucu + o kurumun herkese açık WRPRC'si
    const spoof = await party("CN=Gate, O=Gate Ltd, 2.5.4.97=VATTR-1234567890");
    const s = await decoded(req(await wrprc()), spoof);
    for (const trust of [
      { trustAnchors: [] },
      { trustAnchors: [readerCa.der] }, // çapa var ama okuyucu ona bağlı değil
      { trustAnchors: [], registeredFingerprints: [gate.fp] }, // başka bir sertifikanın parmak izi
    ]) {
      const r = checkProximityRegistration(s.item, s.transcript, [registrar.fp], trust, epochMillis(NOW));
      expect(r).toMatchObject({
        present: true,
        valid: false,
        reason: "untrusted_reader_certificate",
        readerTrusted: false,
      });
      expect(r.tradeName).toBeUndefined();
    }
    // çapa parametresi hiç verilmezse (JS çağıranı) de geçersiz — hiçbir zaman geçerli değil
    expect(
      checkProximityRegistration(s.item, s.transcript, [registrar.fp], undefined as never, epochMillis(NOW)),
    ).toMatchObject({
      valid: false,
      reason: "untrusted_reader_certificate",
    });
    // CA'ya bağlı okuyucu: x5chain yalnız yaprak, kök x5chain'de yok — çapa sertifikası veren imzasını doğrular
    const a = await decoded(req(await wrprc()), caGate);
    expect(
      checkProximityRegistration(
        a.item,
        a.transcript,
        [registrar.fp],
        { trustAnchors: [readerCa.der] },
        epochMillis(NOW),
      ),
    ).toMatchObject({ valid: true, tradeName: "Kapı", readerTrusted: true });
    // çapa yalnız parmak iziyle (kök x5chain'de değilken) bağlanmaz: sertifika gerekir
    expect(
      checkProximityRegistration(
        a.item,
        a.transcript,
        [registrar.fp],
        { trustAnchors: [readerCa.fp] },
        epochMillis(NOW),
      ),
    ).toMatchObject({ valid: false, reason: "untrusted_reader_certificate" });
    // kayıtlı yaprak parmak izi
    const g = await decoded(req(await wrprc()), gate);
    expect(checkProximityRegistration(g.item, g.transcript, [registrar.fp], pinned(), epochMillis(NOW))).toMatchObject({
      valid: true,
      readerTrusted: true,
    });
  });

  it("1–3 tutmazsa geçersiz: kayıt kurumu değil, süresi geçmiş, okuyucu imzası yok, başka kurumun sertifikası", async () => {
    const run = async (cert: Uint8Array, reader?: Party) => {
      const { item, transcript } = await decoded(req(cert), reader);
      return checkProximityRegistration(item, transcript, [registrar.fp], pinned(), epochMillis(NOW));
    };
    expect(await run(await wrprc(stranger), gate)).toMatchObject({ valid: false, reason: /registrar/ });
    expect(await run(await wrprc(registrar, { exp: nowSec - 1 }), gate)).toMatchObject({
      valid: false,
      reason: /expired/,
    });
    expect(await run(await wrprc())).toMatchObject({ valid: false, reason: /reader authentication/ });
    expect(await run(await wrprc(), impostor)).toMatchObject({ valid: false, reason: /does not belong/ });
  });

  it("sertifikasız istek (ADR-0056 K10): ret; okuyucu bilgisi yine döner", async () => {
    const { item, transcript } = await decoded(req(), gate);
    expect(checkProximityRegistration(item, transcript, [registrar.fp], pinned(), epochMillis(NOW))).toMatchObject({
      present: false,
      valid: false,
      reason: "registration_missing",
      readerCertFingerprint: gate.fp,
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

async function run(
  items: ItemsRequest[],
  reader: Party | undefined,
  now: number,
  readerTrust: { trustAnchors: Uint8Array[]; registeredFingerprints?: string[] } | null = pinned(),
  registrarKeys: string[] | false = [registrar.fp],
) {
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
    registrarKeys,
    ...(readerTrust ? { readerTrust } : {}),
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

  it("0.6.0: okuyucu çapası verilmezse kayıt sertifikalı istek kişiye sorulmadan reddedilir (untrusted_reader_certificate)", async () => {
    const r = await run(req(await wrprc()), gate, NOW, null);
    expect(r.seen).toHaveLength(0);
    expect(r.result).toMatchObject({ outcome: "declined", reason: "untrusted_reader_certificate" });
    const ok = await run(req(await wrprc()), caGate, NOW, { trustAnchors: [readerCa.der] });
    expect(ok.result.outcome).toBe("sent");
  });

  it('cüzdandan cüzdana (registrarKeys: false): okuyucu sertifikası yok, kayıt denetimi çağrılmaz — "kayıt yok"', async () => {
    const r = await run(req(), undefined, NOW, null, false);
    expect(r.result.outcome).toBe("sent");
    expect(r.seen[0].registration).toBeUndefined();
  });

  it("geçersiz sertifika: kişiye sorulmadan ret (oturum sonu)", async () => {
    const r = await run(req(await wrprc(stranger)), gate, NOW);
    expect(r.seen).toHaveLength(0);
    expect(r.result).toMatchObject({ outcome: "declined", reason: expect.stringMatching(/registrar/) });
    expect(r.deviceResponse).toBeNull();
  });

  it("sertifikasız (ADR-0056 K10): kişiye sorulmadan ret", async () => {
    const today = await run(req(), gate, NOW);
    expect(today.seen).toHaveLength(0);
    expect(today.result).toMatchObject({ outcome: "declined", reason: "registration_missing" });
  });
});
