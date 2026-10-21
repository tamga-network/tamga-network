/**
 * ADR-0031 K2 + ADR-0034: takma adın site kimliği RP kaydının kalıcı alan adıdır (`dns_name`), istemci kimliği (`x509_hash`) değil.
 * Uçtan uca: imzalı istek → `verifyRequestObject` → kayıt (`checkRp` onayı) → `stableRpKey` → `presentPseudonym`.
 *  - Doğrulayıcının erişim sertifikası AYNI kayıtla yeniden verilince `client_id` değişir, takma ad DEĞİŞMEZ (ADR-0058 yenilemesi).
 *  - Başka RP → başka takma ad. İstemci kimliğiyle türetme reddedilir (eski hata bir daha olamaz).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import {
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
  X509CertificateGenerator,
} from "@peculiar/x509";
import { epochMillis } from "@tamga-network/core";
import {
  b64u,
  checkRp,
  derivePseudonym,
  presentPseudonym,
  recordPseudonymUse,
  newState,
  stableRpKey,
  verifyRequestObject,
  PSEUDONYM_FORMAT,
  type Match,
  type RpRecord,
  type VpRequest,
} from "./index.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const SEED = b64u(new Uint8Array(32).fill(9));
const NO_DOC = { queryId: "", credential: { vct: PSEUDONYM_FORMAT }, requested: [] } as unknown as Match;

type Rp = { x5c: string; sign: (p: Record<string, unknown>) => Promise<string> };
async function accessCert(keys: CryptoKeyPair, dns: string, serial: string, cn: string): Promise<Rp> {
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: serial,
    name: `CN=${cn}, O=Test, C=TR`,
    notBefore: new Date(Date.now() - 60_000),
    notAfter: new Date(Date.now() + 86400_000),
    signingAlgorithm: ALG,
    keys,
    extensions: [
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
      new SubjectAlternativeNameExtension([{ type: "dns", value: dns }]),
    ],
  });
  const x5c = Buffer.from(cert.rawData).toString("base64");
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const key = await importPKCS8(`-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----`, "ES256");
  return {
    x5c,
    sign: (p) => new SignJWT(p).setProtectedHeader({ alg: "ES256", typ: "oauth-authz-req+jwt", x5c: [x5c] }).sign(key),
  };
}
const clientIdOf = (x5c: string) =>
  `x509_hash:${createHash("sha256").update(Buffer.from(x5c, "base64")).digest("base64url")}`;

const requestFor = (rp: Rp, dns: string) =>
  rp.sign({
    client_id: clientIdOf(rp.x5c),
    exp: Math.floor(Date.now() / 1000) + 300,
    aud: "https://self-issued.me/v2",
    response_type: "vp_token",
    response_mode: "direct_post.jwt",
    response_uri: `https://${dns}/vp/response`,
    nonce: "n".repeat(24),
    dcql_query: { credentials: [{ id: "pseudonym", format: PSEUDONYM_FORMAT, meta: { mode: "single" } }] },
    client_metadata: {
      jwks: { keys: [{ kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43), use: "enc" }] },
    },
  });
const recordOf = (req: VpRequest, dns: string): RpRecord => ({
  client_id: req.clientId,
  dns_name: dns,
  legal_name: dns,
  status: "ACTIVE",
  access_cert_fingerprint_sha256: req.leafFingerprint,
  scopes: [],
});

/** Cüzdanın yaptığı (wallet/app present.ts): istek → kayıt → onay → kalıcı site anahtarı → takma ad. */
function pseudonymAt(req: VpRequest, rec: RpRecord) {
  const rp = checkRp(rec, req, NO_DOC, epochMillis(Date.now()));
  expect(rp.registered && !!rp.approval).toBe(true);
  const site = stableRpKey(req, rec);
  return {
    site,
    ...presentPseudonym({
      seed: SEED,
      rpKey: site,
      index: 0,
      aud: req.clientId,
      nonce: req.nonce,
      wia: "w",
      wiaPop: "p",
    }),
  };
}

describe("ADR-0031 K2: takma ad site kimliği = kayıttaki alan adı", () => {
  let verifyKeys: CryptoKeyPair;
  beforeAll(async () => {
    verifyKeys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  });

  it("erişim sertifikası aynı kayıtla (aynı anahtar, aynı alan adı) yeniden verilince client_id değişir, takma ad değişmez", async () => {
    const before = await accessCert(verifyKeys, "verify.example", "01", "verify.example");
    // ADR-0058 yenilemesi: aynı anahtar, CN ticari ad, yeni seri → yeni sertifika özeti
    const after = await accessCert(verifyKeys, "verify.example", "02", "Örnek Doğrulayıcı");
    const r1 = verifyRequestObject(await requestFor(before, "verify.example"));
    const r2 = verifyRequestObject(await requestFor(after, "verify.example"));
    expect(r1.clientId).not.toBe(r2.clientId);
    const p1 = pseudonymAt(r1, recordOf(r1, "verify.example"));
    const p2 = pseudonymAt(r2, recordOf(r2, "verify.example"));
    expect(p1.site).toBe("verify.example");
    expect(p2.site).toBe("verify.example");
    expect(p2.pseudonym).toBe(p1.pseudonym);
    // sunumdaki `rp` doğrulayıcının beklediği alan adı; `aud` o anki client_id
    const payload = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    expect(payload(p2.jwt)).toMatchObject({ rp: "verify.example", aud: r2.clientId });
  });

  it("başka RP (başka kayıt) → başka takma ad", async () => {
    const a = verifyRequestObject(
      await requestFor(await accessCert(verifyKeys, "verify.example", "03", "A"), "verify.example"),
    );
    const shopKeys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    const b = verifyRequestObject(
      await requestFor(await accessCert(shopKeys, "shop.example", "01", "B"), "shop.example"),
    );
    expect(pseudonymAt(b, recordOf(b, "shop.example")).pseudonym).not.toBe(
      pseudonymAt(a, recordOf(a, "verify.example")).pseudonym,
    );
  });

  it("istemci kimliğiyle (x509_hash / x509_san_dns / önekli) türetme reddedilir; kayıtsız RP için stableRpKey client_id döner ve takma ad çıkmaz", async () => {
    const r = verifyRequestObject(
      await requestFor(await accessCert(verifyKeys, "verify.example", "04", "C"), "verify.example"),
    );
    for (const bad of [r.clientId, "x509_san_dns:verify.example", "origin:https://verify.example", "", "a/b", "a|b"])
      expect(() => derivePseudonym(SEED, bad, 0)).toThrow(/dns_name/);
    expect(stableRpKey(r, null)).toBe(r.clientId);
    expect(() => derivePseudonym(SEED, stableRpKey(r, null), 0)).toThrow(/dns_name/);
    // kayıt başka sertifikanın (taklit) → kalıcı ad verilmez
    expect(stableRpKey(r, { ...recordOf(r, "verify.example"), access_cert_fingerprint_sha256: "00" })).toBe(r.clientId);
  });

  it("kayıtlı takma ad yeniden kullanılınca saklı değer güncel türetmeyle eşitlenir", () => {
    let st = recordPseudonymUse(newState("w"), { rpKey: "verify.example", index: 0, pseudonym: "eski" }, 1);
    const now = derivePseudonym(SEED, "verify.example", 0).pseudonym;
    st = recordPseudonymUse(st, { rpKey: "verify.example", index: 0, pseudonym: now }, 2);
    expect(st.pseudonyms).toEqual([expect.objectContaining({ pseudonym: now, lastUsedAt: 2, createdAt: 1 })]);
  });
});
