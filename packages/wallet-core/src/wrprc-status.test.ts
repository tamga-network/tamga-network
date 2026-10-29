/**
 * ADR-0068 K5 — kayıt sertifikasının iptal durumu: durum listesi kayıt kurumu anahtarıyla imzalı olmalı; iptal → istek geçersiz
 * (WRC4); denetlenemedi → `registration_status_unknown` uyarısı; ağ yokken süresi dolmamış önbellek kopyası kullanılır, süresi
 * dolmuş kopya kullanılmaz; bozuk durum girdisi ret; `policy_id` kabul edilir.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto, createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import {
  X509CertificateGenerator,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
} from "@peculiar/x509";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import {
  MemoryRegistrationStatusCache,
  checkIssuerRegistration,
  checkRegistrationCerts,
  fetchRegistrationStatuses,
  registrationStatusRefs,
  verifyRequestObject,
  wrprcStatusRef,
  type Http,
  type Match,
  type StoredCredential,
} from "./index.js";
import { epochMillis } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const NOW = Date.UTC(2026, 9, 29);
const nowSec = NOW / 1000;
const URI = "https://trust.example/status/wrprc/1";

interface Party {
  key: CryptoKey;
  b64: string;
  fp: string;
}
async function party(subject: string, dns?: string): Promise<Party> {
  const kp = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "0" + Math.floor(Math.random() * 1e6),
    name: subject,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: kp,
    extensions: [
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
      ...(dns ? [new SubjectAlternativeNameExtension([{ type: "dns", value: dns }])] : []),
    ],
  });
  const der = new Uint8Array(cert.rawData);
  return {
    key: kp.privateKey,
    b64: Buffer.from(der).toString("base64"),
    fp: createHash("sha256").update(der).digest("hex"),
  };
}
let registrar: Party, other: Party, shop: Party;
beforeAll(async () => {
  registrar = await party("CN=Registrar (test)");
  other = await party("CN=Not a registrar");
  shop = await party("CN=shop.example, O=Shop, 2.5.4.97=VATTR-1234567890", "shop.example");
});

const sign = (signer: Party, typ: string, payload: Record<string, unknown>) =>
  new SignJWT(payload as never).setProtectedHeader({ alg: "ES256", typ, x5c: [signer.b64] } as never).sign(signer.key);
const payload = (extra: Record<string, unknown> = {}) => ({
  name: "Shop",
  sub: "VATTR-1234567890",
  credentials: [
    {
      format: "dc+sd-jwt",
      meta: { vct_values: ["urn:tamga:edu:StudentCredential:1"] },
      claim: [{ path: ["is_enrolled"] }],
    },
  ],
  policy_id: ["2.25.220506472418443381081254370400837050484"],
  certificate_policy: "https://arf.example/policies/registration-certificate",
  status: { status_list: { idx: 5, uri: URI } },
  iat: nowSec - 10,
  exp: nowSec + 86400,
  ...extra,
});
/** 1 bitlik liste; `revoked` indeksleri 1 */
function statusToken(signer: Party, revoked: number[], opts: { iat?: number; exp?: number } = {}) {
  const bytes = new Uint8Array(16);
  for (const i of revoked) bytes[i >> 3] |= 1 << (i & 7);
  const iat = opts.iat ?? nowSec - 60;
  return sign(signer, "statuslist+jwt", {
    iss: "https://trust.example",
    sub: URI,
    iat,
    exp: opts.exp ?? iat + 86400,
    ttl: 3600,
    status_list: { bits: 1, lst: Buffer.from(deflateSync(bytes)).toString("base64url") },
  });
}
const httpOf =
  (body: string | null): Http =>
  async () =>
    body === null ? Promise.reject(new Error("offline")) : { status: 200, text: async () => body };

async function request(wrprcJwt: string) {
  const enc = await generateKeyPair("ECDH-ES", { crv: "P-256", extractable: true });
  const jwk = { ...(await exportJWK(enc.publicKey)), use: "enc" } as JWK;
  const jwt = await new SignJWT({
    client_id: `x509_hash:${createHash("sha256").update(Buffer.from(shop.b64, "base64")).digest("base64url")}`,
    response_type: "vp_token",
    response_mode: "direct_post.jwt",
    response_uri: "https://shop.example/vp/response",
    nonce: "n".repeat(24),
    dcql_query: {
      credentials: [
        { id: "student", format: "dc+sd-jwt", meta: { vct_values: ["urn:tamga:edu:StudentCredential:1"] } },
      ],
    },
    client_metadata: { jwks: { keys: [jwk] } },
    exp: Math.floor(Date.now() / 1000) + 300,
    verifier_info: [{ format: "registration_cert", data: wrprcJwt }],
  })
    .setProtectedHeader({ alg: "ES256", typ: "oauth-authz-req+jwt", x5c: [shop.b64] })
    .sign(shop.key);
  return verifyRequestObject(jwt);
}
const match: Match = {
  queryId: "student",
  credential: { vct: "urn:tamga:edu:StudentCredential:1" } as StoredCredential,
  requested: ["is_enrolled"],
};

describe("kayıt sertifikası durumu (ADR-0068 K5)", () => {
  it("geçerli bit → geçerli, uyarı yok; policy_id kabul edilir; liste önbelleğe yazılır", async () => {
    const req = await request(await sign(registrar, "rc-wrp+jwt", payload()));
    const refs = registrationStatusRefs(req, [registrar.fp], epochMillis(NOW));
    expect(refs).toEqual([{ uri: URI, idx: 5 }]);
    const cache = new MemoryRegistrationStatusCache();
    const st = await fetchRegistrationStatuses(refs, httpOf(await statusToken(registrar, [3])), [registrar.fp], {
      cache,
      nowMs: epochMillis(NOW),
    });
    const r = checkRegistrationCerts(req, [registrar.fp], match, epochMillis(NOW), st);
    expect(r).toMatchObject({ present: true, valid: true, allowedClaims: ["is_enrolled"] });
    expect(r.flags).toBeUndefined();
    expect(cache.entries().map(([u]) => u)).toEqual([URI]);
  });

  it("iptal biti → istek geçersiz (WRC4)", async () => {
    const req = await request(await sign(registrar, "rc-wrp+jwt", payload()));
    const st = await fetchRegistrationStatuses(
      registrationStatusRefs(req, [registrar.fp], epochMillis(NOW)),
      httpOf(await statusToken(registrar, [5])),
      [registrar.fp],
      { nowMs: epochMillis(NOW) },
    );
    expect(checkRegistrationCerts(req, [registrar.fp], match, epochMillis(NOW), st)).toEqual({
      present: true,
      valid: false,
      reason: "registration certificate revoked",
    });
  });

  it("liste kayıt kurumu dışında imzalı → denetlenemedi (uyarı), iptal sayılmaz ama geçerli de görünmez", async () => {
    const req = await request(await sign(registrar, "rc-wrp+jwt", payload()));
    const st = await fetchRegistrationStatuses(
      [{ uri: URI, idx: 5 }],
      httpOf(await statusToken(other, [])),
      [registrar.fp],
      {
        nowMs: epochMillis(NOW),
      },
    );
    const r = checkRegistrationCerts(req, [registrar.fp], match, epochMillis(NOW), st);
    expect(r.valid).toBe(true);
    expect(r.flags).toEqual(["registration_status_unknown"]);
  });

  it("durumlar verilmezse (güvenli varsayılan) uyarı", async () => {
    const req = await request(await sign(registrar, "rc-wrp+jwt", payload()));
    expect(checkRegistrationCerts(req, [registrar.fp], match, epochMillis(NOW)).flags).toEqual([
      "registration_status_unknown",
    ]);
  });

  it("durum alanı olmayan sertifika (durum listesi tutmayan kayıt kurumu) → uyarı yok", async () => {
    const req = await request(await sign(registrar, "rc-wrp+jwt", payload({ status: undefined })));
    const r = checkRegistrationCerts(req, [registrar.fp], match, epochMillis(NOW));
    expect(r.valid).toBe(true);
    expect(r.flags).toBeUndefined();
  });

  it("çevrimdışı: süresi dolmamış önbellek kopyası kullanılır (iptal de okunur); süresi dolmuş kopya kullanılmaz", async () => {
    const cache = new MemoryRegistrationStatusCache([[URI, await statusToken(registrar, [5])]]);
    const off = await fetchRegistrationStatuses([{ uri: URI, idx: 5 }], httpOf(null), [registrar.fp], {
      cache,
      nowMs: epochMillis(NOW),
    });
    expect(off({ uri: URI, idx: 5 })).toBe("revoked");
    expect(off({ uri: URI, idx: 4 })).toBe("valid");
    const later = await fetchRegistrationStatuses([{ uri: URI, idx: 5 }], httpOf(null), [registrar.fp], {
      cache,
      nowMs: epochMillis(NOW + 2 * 86400_000),
    });
    expect(later({ uri: URI, idx: 4 })).toBe("unknown");
    // offline bayrağı ağa hiç gitmez
    let called = false;
    await fetchRegistrationStatuses(
      [{ uri: URI, idx: 1 }],
      async () => ((called = true), { status: 200, text: async () => "" }),
      [registrar.fp],
      {
        cache,
        offline: true,
        nowMs: epochMillis(NOW),
      },
    );
    expect(called).toBe(false);
  });

  it("liste dışı indeks → denetlenemedi", async () => {
    const st = await fetchRegistrationStatuses(
      [{ uri: URI, idx: 9999 }],
      httpOf(await statusToken(registrar, [])),
      [registrar.fp],
      {
        nowMs: epochMillis(NOW),
      },
    );
    expect(st({ uri: URI, idx: 9999 })).toBe("unknown");
  });

  it("bozuk durum girdisi ve bozuk policy_id → sertifika geçersiz; idx sayısal metin okunur (TS 119 475 GEN-6.2.6.1-04)", async () => {
    for (const bad of [
      { status: { status_list: { idx: -1, uri: URI } } },
      { status: { status_list: { idx: 1, uri: "http://x" } } },
      { policy_id: "2.25.1" },
    ]) {
      const req = await request(await sign(registrar, "rc-wrp+jwt", payload(bad)));
      expect(checkRegistrationCerts(req, [registrar.fp], match, epochMillis(NOW)).valid).toBe(false);
    }
    expect(wrprcStatusRef({ status: { status_list: { idx: "7", uri: URI } } })).toEqual({ uri: URI, idx: 7 });
  });

  it("belge verenin kayıt sertifikası iptal → belge istenmez; denetlenemedi → statusUnknown", async () => {
    const md = {
      issuer_info: [
        {
          format: "registration_cert",
          data: await sign(registrar, "rc-wrp+jwt", {
            ...payload(),
            credentials: undefined,
            provides_attestations: [{ format: "dc+sd-jwt", meta: { vct_values: ["urn:x:1"] } }],
          }),
        },
      ],
    };
    const revoked = await fetchRegistrationStatuses(
      [{ uri: URI, idx: 5 }],
      httpOf(await statusToken(registrar, [5])),
      [registrar.fp],
      {
        nowMs: epochMillis(NOW),
      },
    );
    expect(checkIssuerRegistration(md, "urn:x:1", [registrar.fp], epochMillis(NOW), revoked)).toEqual({
      present: true,
      valid: false,
      reason: "registration certificate revoked",
    });
    expect(checkIssuerRegistration(md, "urn:x:1", [registrar.fp], epochMillis(NOW))).toEqual({
      present: true,
      valid: true,
      statusUnknown: true,
    });
  });
});
