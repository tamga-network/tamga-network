/**
 * 0.8.3 ikinci inceleme — cüzdan çekirdeği: geçiş kartı izni denetimi (ADR-0034 CI5, SPEC-WALLET-0001 WL13), `matchDcql` süresi
 * dolmuş belge, `respond` teslim sözleşmesi (WL5: `beforeSend`) ve `redirect_uri` şeması.
 */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { createHash, webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { SignJWT } from "jose";
import {
  MemoryKeyStore,
  PASS_GRANT_MAX_VALIDITY_SEC,
  SoftwareKeyProvider,
  b64u,
  checkRp,
  jwkThumbprint,
  matchDcql,
  mintPassToken,
  parsePassGrant,
  rawToJwk,
  respond,
  type Match,
  type RpRecord,
  type StoredCredential,
  type VpRequest,
} from "./index.js";
import { epochMillis } from "@tamga-network/core/time";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const now = Math.floor(Date.now() / 1000);
const DAY = 86400;

async function rpParty() {
  const kp = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=verify.example",
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: kp,
  });
  const der = new Uint8Array(cert.rawData);
  return {
    key: kp.privateKey,
    b64: Buffer.from(der).toString("base64"),
    fp: createHash("sha256").update(der).digest("hex"),
  };
}
type Rp = Awaited<ReturnType<typeof rpParty>>;
const grantJws = (rp: Rp, payload: Record<string, unknown>) =>
  new SignJWT(payload as never)
    .setProtectedHeader({ alg: "ES256", typ: "tamga-pass-grant+jwt", x5c: [rp.b64] })
    .sign(rp.key);
const ctx = { rpClientId: "verify.example", rpName: "Kapı", credentialId: "c1", keyRef: "pass.k" };
const rnd = (n: number) => p256.utils.randomSecretKey().slice(0, n);

describe("geçiş kartı izni (ADR-0012 K8, ADR-0034 CI5, WL13)", () => {
  const body = (o: Record<string, unknown> = {}) => ({
    pass_id: "pass_1",
    cnf_kid: "kid-1",
    terminal_group: "g1",
    aud: "verify.example",
    iat: now,
    exp: now + 30 * DAY,
    ...o,
  });

  it("WL13: rıza süresi 6 ayı aşan izin reddedilir (iat'a ve şimdiye göre); tek kullanımlık bilet (K4) tavana tabi değildir", async () => {
    const rp = await rpParty();
    expect(PASS_GRANT_MAX_VALIDITY_SEC).toBe(184 * DAY);
    expect(parsePassGrant(await grantJws(rp, body({ exp: now + 180 * DAY })), ctx).validUntil).toBe(now + 180 * DAY);
    await expect(grantJws(rp, body({ exp: now + 400 * DAY })).then((j) => parsePassGrant(j, ctx))).rejects.toThrow(
      /6 months/,
    );
    // ileri tarihli iat ile tavan aşılamaz
    await expect(
      grantJws(rp, body({ iat: now + 300 * DAY, exp: now + 400 * DAY })).then((j) => parsePassGrant(j, ctx)),
    ).rejects.toThrow(/6 months/);
    // süresi geçmiş izin saklanmaz
    await expect(
      grantJws(rp, body({ iat: now - 40 * DAY, exp: now - DAY })).then((j) => parsePassGrant(j, ctx)),
    ).rejects.toThrow(/expired/);
    const ticket = parsePassGrant(await grantJws(rp, body({ exp: now + 400 * DAY, single_use: true })), ctx);
    expect(ticket.singleUse).toBe(true);
  });

  it("CI5: `aud` alan adı olmalı; `x509_hash:` biçimi uyarıyla saklanır (kalıcı değil), başka biçim reddedilir", async () => {
    const rp = await rpParty();
    const ok = parsePassGrant(await grantJws(rp, body()), ctx);
    expect(ok.rpClientId).toBe("verify.example");
    expect(ok.warnings).toBeUndefined();
    const hash = `x509_hash:${"A".repeat(43)}`;
    const legacy = parsePassGrant(await grantJws(rp, body({ aud: hash })), ctx);
    expect(legacy.rpClientId).toBe(hash);
    expect(legacy.warnings).toEqual(["aud_not_dns_name"]);
    // izinde aud yoksa isteğin RP kimliği kullanılır — aynı kural
    const { aud: _aud, ...noAud } = body();
    expect(parsePassGrant(await grantJws(rp, noAud), { ...ctx, rpClientId: hash }).warnings).toEqual([
      "aud_not_dns_name",
    ]);
    for (const aud of ["https://verify.example/x", "verify example", "x509_san_dns:verify.example", "a".repeat(300)])
      await expect(grantJws(rp, body({ aud })).then((j) => parsePassGrant(j, ctx))).rejects.toThrow(/aud/);
  });

  it("isteğe bağlı denetim: iznin imzası isteği imzalayan sertifikayla, `cnf_kid` cüzdanın kart anahtarıyla", async () => {
    const rp = await rpParty();
    const evil = await rpParty();
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const cnf = await keys.generate("pass.k");
    const kid = b64u(jwkThumbprint(cnf));
    const good = await grantJws(rp, body({ cnf_kid: kid }));
    const g = parsePassGrant(good, ctx, { signerFingerprint: rp.fp, cnf });
    expect(g.cnfKid).toBe(kid);
    expect((await mintPassToken(g, keys, rnd)).token).toBeTruthy();
    // başka sertifikayla imzalanmış izin
    await expect(
      grantJws(evil, body({ cnf_kid: kid })).then((j) => parsePassGrant(j, ctx, { signerFingerprint: rp.fp, cnf })),
    ).rejects.toThrow(/signer/);
    // gövdesi değiştirilmiş izin (imza tutmaz)
    const [h, , sig] = good.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify(body({ cnf_kid: kid, terminal_group: "vip" }))).toString("base64url")}.${sig}`;
    expect(() => parsePassGrant(forged, ctx, { signerFingerprint: rp.fp, cnf })).toThrow(/signature/);
    // başkasının anahtarına bağlanmış izin
    const otherKey = rawToJwk(p256.getPublicKey(p256.utils.randomSecretKey(), false));
    expect(() => parsePassGrant(good, ctx, { signerFingerprint: rp.fp, cnf: otherKey })).toThrow(/cnf_kid/);
    // denetim girdisi verilmezse eski davranış (imza terminalde)
    expect(parsePassGrant(forged, ctx).terminalGroup).toBe("vip");
  });

  it("WL13: güven kaynağı verilirse RP listede ACTIVE olmalı; kapı grubu listeliyse etkin ve o RP'nin olmalı", async () => {
    const rp = await rpParty();
    const jws = await grantJws(rp, body());
    const source = (rec: unknown, group?: unknown) => ({
      relyingParty: () => null,
      relyingPartyByDnsName: (d: string) => (d === "verify.example" ? (rec as never) : null),
      ...(group !== undefined ? { terminalGroup: () => group as never } : {}),
    });
    const active = { dns_name: "verify.example", status: "ACTIVE" };
    expect(parsePassGrant(jws, ctx, { trust: source(active) }).passId).toBe("pass_1");
    expect(() => parsePassGrant(jws, ctx, { trust: source(null) })).toThrow(/trusted list/);
    expect(() => parsePassGrant(jws, ctx, { trust: source({ ...active, status: "SUSPENDED" }) })).toThrow(
      /trusted list/,
    );
    expect(
      parsePassGrant(jws, ctx, { trust: source(active, { rp_dns_name: "verify.example", active: true }) }).passId,
    ).toBe("pass_1");
    expect(() =>
      parsePassGrant(jws, ctx, { trust: source(active, { rp_dns_name: "verify.example", active: false }) }),
    ).toThrow(/terminal group/);
    expect(() =>
      parsePassGrant(jws, ctx, { trust: source(active, { rp_dns_name: "other.example", active: true }) }),
    ).toThrow(/terminal group/);
    // gösterimde de (mintPassToken): listeden çıkan RP'nin kartı jeton üretmez
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    await keys.generate("pass.k");
    const g = parsePassGrant(jws, ctx);
    await expect(mintPassToken(g, keys, rnd, now, { trust: source(null) })).rejects.toThrow(/trusted list/);
    expect((await mintPassToken(g, keys, rnd, now, { trust: source(active) })).exp).toBe(now + 60);
  });
});

describe("matchDcql — süresi dolmuş belge", () => {
  const cred = (exp?: number): StoredCredential => ({
    id: "c",
    vct: "urn:tamga:edu:DiplomaCredential:1",
    typeName: "t",
    issuer: "i",
    issuerId: "0x1",
    leafFingerprint: "f",
    iat: 1,
    ...(exp !== undefined ? { exp } : {}),
    claims: { is_graduate: true },
    disclosureNames: ["is_graduate"],
    copies: [],
    receivedAt: 1,
  });
  const q = {
    credentials: [
      {
        id: "d",
        format: "dc+sd-jwt",
        meta: { vct_values: ["urn:tamga:edu:DiplomaCredential:1"] },
        claims: [{ path: ["is_graduate"] }],
      },
    ],
  };
  it("`exp` geçmiş belge eşleşmez (`now` ile de); `exp` taşımayan ve süresi dolmamış belge eşleşir", () => {
    expect(matchDcql(q, [cred(now - 1)])).toMatchObject({ matches: [], unmatched: ["d"] });
    expect(matchDcql(q, [cred(now - 1)]).gaps[0]).toMatchObject({ queryId: "d", reason: "no_credential" });
    expect(matchDcql(q, [cred(1000)], { now: 1000 }).matches).toEqual([]); // exp anında geçersiz
    expect(matchDcql(q, [cred(1000)], { now: 999 }).matches).toHaveLength(1);
    expect(matchDcql(q, [cred()]).matches).toHaveLength(1);
    expect(matchDcql(q, [cred(now - 1), cred(now + 600)]).matches[0].credential.exp).toBe(now + 600);
  });
});

describe("respond — teslim sözleşmesi (WL5) ve redirect_uri", () => {
  const FP = "ab".repeat(32);
  const encPub = p256.getPublicKey(p256.utils.randomSecretKey(), false);
  const req = (o: Partial<VpRequest> = {}) =>
    ({
      clientId: "x509_hash:abc",
      nonce: "nonce-1",
      responseUri: "https://verify.example/vp/response",
      leafFingerprint: FP,
      dcql: { credentials: [] },
      encJwk: { ...rawToJwk(encPub), use: "enc" },
      enc: "A128GCM",
      ...o,
    }) as unknown as VpRequest;
  const match = { requested: [], credential: { vct: "v" } } as unknown as Match;
  const rpRec = {
    legal_name: "Örnek",
    status: "ACTIVE",
    access_cert_fingerprint_sha256: FP,
    scopes: [],
  } as unknown as RpRecord;
  const send = (r: VpRequest, http: never, extra: Record<string, unknown> = {}) =>
    respond({
      request: r,
      approval: checkRp(rpRec, r, match, epochMillis(Date.now())).approval!,
      matches: [],
      keys: {} as never,
      http,
      ...extra,
    });
  const answering = (status: number, body: unknown) =>
    (async () => ({ status, text: async () => JSON.stringify(body) })) as never;

  it("`beforeSend` gönderimden ÖNCE çağrılır; doğrulayıcı 200 dışı dönse de ağ hatası olsa da çağrılmış kalır", async () => {
    const order: string[] = [];
    const http = (status: number) =>
      (async () => {
        order.push("post");
        if (status === 0) throw new Error("network down");
        return { status, text: async () => "{}" };
      }) as never;
    const beforeSend = async () => void order.push("mark");
    await send(req(), http(200), { beforeSend });
    expect(order).toEqual(["mark", "post"]);
    order.length = 0;
    await expect(send(req(), http(500), { beforeSend })).rejects.toThrow(/verifier response 500/);
    expect(order).toEqual(["mark", "post"]);
    order.length = 0;
    await expect(send(req(), http(0), { beforeSend })).rejects.toThrow(/network down/);
    expect(order).toEqual(["mark", "post"]);
    // DC API: POST yok; yanıt dönmeden önce çağrılır
    order.length = 0;
    const dc = await send(req({ responseUri: "", origin: "https://site.example" }), http(200), { beforeSend });
    expect(dc.dcApiResponse).toBeTruthy();
    expect(order).toEqual(["mark"]);
    // işaretleme başarısızsa (depo yazılamadı) sunum GÖNDERİLMEZ
    order.length = 0;
    await expect(
      send(req(), http(200), {
        beforeSend: () => {
          throw new Error("store write failed");
        },
      }),
    ).rejects.toThrow(/store write failed/);
    expect(order).toEqual([]);
  });

  it("doğrulayıcının `redirect_uri`'si yalnız https ise döner; http yalnız `allowLocalDevHost` ile yerel adrese", async () => {
    const out = (uri: unknown, extra = {}) => send(req(), answering(200, { redirect_uri: uri }), extra);
    expect((await out("https://verify.example/p/1")).redirectUri).toBe("https://verify.example/p/1");
    for (const bad of ["http://verify.example/p/1", "javascript:alert(1)", "tamga://x", "https://", 42, " https://a.b"])
      expect((await out(bad)).redirectUri).toBeUndefined();
    expect((await out("http://192.168.1.5:4004/p/1")).redirectUri).toBeUndefined();
    expect((await out("http://192.168.1.5:4004/p/1", { allowLocalDevHost: true })).redirectUri).toBe(
      "http://192.168.1.5:4004/p/1",
    );
    expect((await out("http://verify.example/p/1", { allowLocalDevHost: true })).redirectUri).toBeUndefined();
  });
});
