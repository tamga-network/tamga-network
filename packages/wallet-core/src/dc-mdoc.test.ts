/**
 * ISO/IEC 18013-7 Ek C (`org-iso-mdoc`) — cüzdan tarafı istek çözümü: okuyucu imzası bu oturumun dökümüyle (köken dahil),
 * `client_id` = x509_hash(okuyucu yaprağı), DCQL'e çeviri, saklama niyeti, kayıt sertifikası (`requestInfo.euWrprc`, CBOR) ve
 * okuyucu sertifikasına bağı (ADR-0026 K5 / ADR-0056 K10). Uçtan uca (doğrulayıcıyla) sınama: apps/verify testleri.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto, createHash } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { createAnnexCRequest, p256, signWrprcCwt, type ItemsRequest } from "@tamga-network/mdoc";
import { parseDcApiRequest, checkDcqlShape } from "./oid4vp.js";
import { ANNEX_C_QUERY_ID, DC_API_MDOC_PROTOCOL } from "./dc-mdoc.js";
import { checkRegistrationCerts, hasRegistrationCert, missingRegistrationPolicy } from "./wrprc.js";
import { b64u } from "./b64.js";
import type { Match } from "./oid4vp.js";
import { epochMillis } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const DOCTYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
const SITE = "https://verify.example";
const NOW = Date.UTC(2026, 9, 21);
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

let reader: Party, registrar: Party, other: Party;
beforeAll(async () => {
  reader = await party("CN=Verify, O=Verify Ltd, 2.5.4.97=VATTR-1234567890");
  other = await party("CN=Other, O=Other Ltd, 2.5.4.97=VATTR-9999999999");
  registrar = await party("CN=Registrar (test)");
});

const items = (o: Partial<ItemsRequest> = {}): ItemsRequest[] => [
  { docType: DOCTYPE, nameSpaces: { [NS]: { age_over_18: false, given_name: true } }, ...o },
];
const request = (it: ItemsRequest[], signer: Party | null = reader, origin = SITE) =>
  ({
    protocol: DC_API_MDOC_PROTOCOL,
    data: createAnnexCRequest({
      items: it,
      origin,
      ...(signer ? { readerAuth: { sk: signer.sk, x5chain: [signer.der] } } : {}),
    }).data,
  }) as const;
const cwt = (o: Record<string, unknown> = {}) =>
  signWrprcCwt({
    payload: {
      name: "Verify",
      sub: "VATTR-1234567890",
      country: "TR",
      credentials: [{ format: "mso_mdoc", meta: { doctype_value: DOCTYPE }, claim: [{ path: [NS, "age_over_18"] }] }],
      iat: nowSec - 10,
      exp: nowSec + 86400,
      ...o,
    },
    x5chain: [registrar.der],
    sign: sign(registrar.sk),
  });
const matchFor = (requested: string[]) =>
  ({ queryId: ANNEX_C_QUERY_ID, requested, credential: { vct: DOCTYPE } }) as unknown as Match;

describe("parseDcApiRequest — org-iso-mdoc (ISO/IEC 18013-7 Ek C)", () => {
  it("okuyucu imzalı istek → VpRequest: client_id = x509_hash(yaprak), DCQL mso_mdoc, saklama niyeti, köken", () => {
    const r = parseDcApiRequest(request(items()), SITE);
    expect(r.clientId).toBe(`x509_hash:${b64u(new Uint8Array(createHash("sha256").update(reader.der).digest()))}`);
    expect(r.leafFingerprint).toBe(reader.fp);
    expect(r.origin).toBe(SITE);
    expect(r.responseUri).toBe("");
    expect(r.dcql).toEqual({
      credentials: [
        {
          id: ANNEX_C_QUERY_ID,
          format: "mso_mdoc",
          meta: { doctype_value: DOCTYPE },
          // CBOR kanonik sıra (kısa anahtar önce)
          claims: [{ path: [NS, "given_name"] }, { path: [NS, "age_over_18"] }],
        },
      ],
    });
    expect(() => checkDcqlShape(r.dcql)).not.toThrow();
    expect(r.annexC).toMatchObject({ docType: DOCTYPE, namespace: NS, intentToRetain: ["given_name"] });
    expect(r.annexC!.registrationCwt).toBeUndefined();
    expect(hasRegistrationCert(r)).toBe(false);
    // dize olarak gelen `data` (bazı tarayıcılar) da okunur
    const asString = request(items());
    expect(parseDcApiRequest({ ...asString, data: JSON.stringify(asString.data) }, SITE).clientId).toBe(r.clientId);
  });

  it("PV6: okuyucu imzası yoksa ret; başka kökenin dökümüyle imza geçmez (istek başka sitede kullanılamaz)", () => {
    expect(() => parseDcApiRequest(request(items(), null), SITE)).toThrow(/reader authentication \(PV6\)/);
    expect(() => parseDcApiRequest(request(items()), "https://evil.example")).toThrow(/invalid for this session/);
    expect(() => parseDcApiRequest(request(items()), "http://evil.example")).toThrow(/invalid calling origin/);
  });

  it("Tamga profili: tek belge, tek ad alanı; bozuk istek açık nedenle reddedilir", () => {
    expect(() => parseDcApiRequest(request([...items(), ...items()]), SITE)).toThrow(/exactly one document/);
    expect(() =>
      parseDcApiRequest(
        request(items({ nameSpaces: { [NS]: { age_over_18: false }, "other.ns": { x: false } } })),
        SITE,
      ),
    ).toThrow(/exactly one namespace/);
    expect(() => parseDcApiRequest({ protocol: DC_API_MDOC_PROTOCOL, data: { deviceRequest: "x" } }, SITE)).toThrow(
      /invalid org-iso-mdoc request/,
    );
    expect(() => parseDcApiRequest({ protocol: DC_API_MDOC_PROTOCOL, data: "{" }, SITE)).toThrow(/not JSON/);
  });

  it("ADR-0026 K5: requestInfo.euWrprc (CBOR) okuyucu sertifikasına bağlı → geçerli, izinli öğeler; sertifikasız → K10 ret", async () => {
    const r = parseDcApiRequest(request(items({ requestInfo: { euWrprc: await cwt() } })), SITE);
    expect(hasRegistrationCert(r)).toBe(true);
    const ok = checkRegistrationCerts(r, [registrar.fp], matchFor(["age_over_18", "given_name"]), epochMillis(NOW));
    expect(ok).toMatchObject({ present: true, valid: true, allowedClaims: ["age_over_18"], tradeName: "Verify" });
    // sertifikasız istek: ADR-0056 K10
    const bare = parseDcApiRequest(request(items()), SITE);
    expect(checkRegistrationCerts(bare, [registrar.fp], matchFor(["age_over_18"]), epochMillis(NOW))).toEqual(
      missingRegistrationPolicy(),
    );
    // başka kurumun okuyucu sertifikası, bu kurumun kayıt sertifikası → bağ yok
    const foreign = parseDcApiRequest(request(items({ requestInfo: { euWrprc: await cwt() } }), other), SITE);
    expect(checkRegistrationCerts(foreign, [registrar.fp], matchFor(["age_over_18"]), epochMillis(NOW))).toMatchObject({
      valid: false,
      reason: /reader's certificate/,
    });
    // listede olmayan kayıt kurumu / süresi geçmiş sertifika
    expect(checkRegistrationCerts(r, [other.fp], matchFor(["age_over_18"]), epochMillis(NOW)).valid).toBe(false);
    const old = parseDcApiRequest(request(items({ requestInfo: { euWrprc: await cwt({ exp: nowSec - 1 }) } })), SITE);
    expect(checkRegistrationCerts(old, [registrar.fp], matchFor(["age_over_18"]), epochMillis(NOW))).toMatchObject({
      valid: false,
      reason: /expired/,
    });
  });
});
