/** RFC 9449 DPoP doğrulaması: geçerli kanıt, tekrar, yanlış adres/yöntem, belirteç özeti, başka anahtar, eski kanıt. */
import { describe, it, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import {
  DpopReplayCache,
  clientInstanceJkt,
  normalizeHtu,
  parseAuthorization,
  verifyResourceDpop,
  verifyTokenDpop,
} from "./dpop.js";
import { epochSeconds } from "@tamga-network/core";

const HTU = "https://id.tamga.network/credential";
const now = epochSeconds(1_800_000_000);

async function key() {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  return { privateKey, jwk: await exportJWK(publicKey) };
}
async function proof(
  k: Awaited<ReturnType<typeof key>>,
  o: { htm?: string; htu?: string; iat?: number; ath?: string; jti?: string; typ?: string } = {},
) {
  return new SignJWT({
    jti: o.jti ?? randomUUID(),
    htm: o.htm ?? "POST",
    htu: o.htu ?? HTU,
    iat: o.iat ?? now,
    ...(o.ath ? { ath: o.ath } : {}),
  })
    .setProtectedHeader({ alg: "ES256", typ: o.typ ?? "dpop+jwt", jwk: k.jwk })
    .sign(k.privateKey);
}
const ath = (t: string) => createHash("sha256").update(t).digest("base64url");

describe("DPoP (RFC 9449)", () => {
  it("ADR-0060: istemci örneği anahtarının parmak izi (RFC 7638); P-256 dışı / eksik → null", async () => {
    const { publicKey } = await generateKeyPair("ES256");
    const jwk = await exportJWK(publicKey);
    const a = await clientInstanceJkt({ ...jwk, kid: "x", alg: "ES256" });
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await clientInstanceJkt(jwk)).toBe(a); // ek alanlar parmak izini değiştirmez
    expect(await clientInstanceJkt({ kty: "RSA" })).toBeNull();
    expect(await clientInstanceJkt(undefined)).toBeNull();
  });
  it("htu RFC 3986 §6.2.2–6.2.3 ile normalleşir (büyük harf ana makine, :443, sorgu/parça) — farklı yol eşleşmez", () => {
    const t = "https://id.sandbox.tamga.network/credential";
    for (const v of [
      "HTTPS://ID.SANDBOX.TAMGA.NETWORK/credential",
      "https://id.sandbox.tamga.network:443/credential",
      "https://id.sandbox.tamga.network/credential?x=1#y",
    ])
      expect(normalizeHtu(v)).toBe(normalizeHtu(t));
    expect(normalizeHtu("https://id.sandbox.tamga.network/CREDENTIAL")).not.toBe(normalizeHtu(t));
    expect(normalizeHtu("https://id.sandbox.tamga.network:8443/credential")).not.toBe(normalizeHtu(t));
    expect(normalizeHtu("http://id.sandbox.tamga.network/credential")).not.toBe(normalizeHtu(t));
  });
  it("ADR-0056 K5: kaynak ucunda belirteç ve bağlı anahtar zorunlu (boş/eksik → ret)", async () => {
    const k = await key();
    const replay = new DpopReplayCache();
    const p = await proof(k, { ath: ath("t") });
    const r = await verifyResourceDpop(p, { htm: "POST", htu: HTU, now, replay, accessToken: "t", jkt: "" });
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/no bound DPoP key/) });
    const noTok = await verifyResourceDpop(p, { htm: "POST", htu: HTU, now, replay, accessToken: "", jkt: "x" });
    expect(noTok).toMatchObject({ ok: false, reason: expect.stringMatching(/access token missing/) });
    // JavaScript çağıran: alanları hiç vermemek de ret
    const none = await verifyResourceDpop(p, { htm: "POST", htu: HTU, now, replay } as unknown as Parameters<
      typeof verifyResourceDpop
    >[1]);
    expect(none.ok).toBe(false);
  });
  it("ADR-0056 K12: saniye yerine milisaniye verilirse hata", async () => {
    const k = await key();
    await expect(
      verifyTokenDpop(await proof(k), {
        htm: "POST",
        htu: HTU,
        now: Date.now() as never,
        replay: new DpopReplayCache(),
      }),
    ).rejects.toThrow(/seconds/);
  });
  it("geçerli kanıt kabul edilir, aynı kanıt ikinci kez reddedilir", async () => {
    const k = await key();
    const replay = new DpopReplayCache();
    const p = await proof(k);
    const a = await verifyTokenDpop(p, { htm: "POST", htu: HTU, now, replay });
    expect(a.ok).toBe(true);
    const b = await verifyTokenDpop(p, { htm: "POST", htu: HTU, now, replay });
    expect(b).toMatchObject({ ok: false, reason: expect.stringMatching(/replayed/) });
  });
  it("yöntem, adres, zaman ve tür bağlıdır", async () => {
    const k = await key();
    const r = new DpopReplayCache();
    const base = { htm: "POST", htu: HTU, now, replay: r };
    expect((await verifyTokenDpop(await proof(k, { htm: "GET" }), base)).ok).toBe(false);
    expect((await verifyTokenDpop(await proof(k, { htu: "https://evil.example/credential" }), base)).ok).toBe(false);
    expect((await verifyTokenDpop(await proof(k, { iat: now - 3600 }), base)).ok).toBe(false);
    expect((await verifyTokenDpop(await proof(k, { typ: "JWT" }), base)).ok).toBe(false);
    expect((await verifyTokenDpop(undefined, base)).ok).toBe(false);
    // sorgu dizesi adres karşılaştırmasına girmez
    expect((await verifyTokenDpop(await proof(k, { htu: HTU + "?x=1" }), base)).ok).toBe(true);
  });
  it("credential ucu: belirteç özeti (ath) ve belirtece bağlı anahtar aranır", async () => {
    const k = await key();
    const other = await key();
    const r = new DpopReplayCache();
    const tok = "access-token-123";
    const bound = await verifyTokenDpop(await proof(k), { htm: "POST", htu: HTU, now, replay: r });
    if (!bound.ok) throw new Error("setup");
    const o = { htm: "POST", htu: HTU, now, replay: r, accessToken: tok, jkt: bound.jkt };
    expect((await verifyResourceDpop(await proof(k, { ath: ath(tok) }), o)).ok).toBe(true);
    expect((await verifyResourceDpop(await proof(k), o)).ok).toBe(false); // ath yok
    expect((await verifyResourceDpop(await proof(k, { ath: ath("başka") }), o)).ok).toBe(false);
    // çalınan belirteç başka anahtarla kullanılamaz
    expect(await verifyResourceDpop(await proof(other, { ath: ath(tok) }), o)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/not the key bound/),
    });
  });
  it("Authorization başlığı ayrıştırılır", () => {
    expect(parseAuthorization("DPoP abc")).toEqual({ scheme: "DPoP", token: "abc" });
    expect(parseAuthorization("Bearer abc")).toEqual({ scheme: "Bearer", token: "abc" });
    expect(parseAuthorization(undefined).scheme).toBeNull();
  });
  it("tekrar önbelleği kesin üst sınırlı: dolunca en eski atılır, boyut sınırı aşılmaz", () => {
    const c = new DpopReplayCache(3);
    for (const j of ["a", "b", "c", "d", "e"]) expect(c.claim(j, 2000, 1000)).toBe(true);
    expect(c.size).toBe(3);
    expect(c.claim("e", 2000, 1000)).toBe(false); // yeni kayıt korunur
    expect(c.claim("a", 2000, 1000)).toBe(true); // en eski atılmıştı
    expect(c.size).toBe(3);
  });
});
