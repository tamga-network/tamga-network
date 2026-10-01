/** RFC 9449 DPoP doğrulaması: geçerli kanıt, tekrar, yanlış adres/yöntem, belirteç özeti, başka anahtar, eski kanıt. */
import { describe, it, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { DpopReplayCache, parseAuthorization, verifyDpop } from "./dpop.js";

const HTU = "https://id.tamga.network/credential";
const now = 1_800_000_000;

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
  it("geçerli kanıt kabul edilir, aynı kanıt ikinci kez reddedilir", async () => {
    const k = await key();
    const replay = new DpopReplayCache();
    const p = await proof(k);
    const a = await verifyDpop(p, { htm: "POST", htu: HTU, now, replay });
    expect(a.ok).toBe(true);
    const b = await verifyDpop(p, { htm: "POST", htu: HTU, now, replay });
    expect(b).toMatchObject({ ok: false, reason: expect.stringMatching(/replayed/) });
  });
  it("yöntem, adres, zaman ve tür bağlıdır", async () => {
    const k = await key();
    const r = new DpopReplayCache();
    const base = { htm: "POST", htu: HTU, now, replay: r };
    expect((await verifyDpop(await proof(k, { htm: "GET" }), base)).ok).toBe(false);
    expect((await verifyDpop(await proof(k, { htu: "https://evil.example/credential" }), base)).ok).toBe(false);
    expect((await verifyDpop(await proof(k, { iat: now - 3600 }), base)).ok).toBe(false);
    expect((await verifyDpop(await proof(k, { typ: "JWT" }), base)).ok).toBe(false);
    expect((await verifyDpop(undefined, base)).ok).toBe(false);
    // sorgu dizesi adres karşılaştırmasına girmez
    expect((await verifyDpop(await proof(k, { htu: HTU + "?x=1" }), base)).ok).toBe(true);
  });
  it("credential ucu: belirteç özeti (ath) ve belirtece bağlı anahtar aranır", async () => {
    const k = await key();
    const other = await key();
    const r = new DpopReplayCache();
    const tok = "access-token-123";
    const bound = await verifyDpop(await proof(k), { htm: "POST", htu: HTU, now, replay: r });
    if (!bound.ok) throw new Error("setup");
    const o = { htm: "POST", htu: HTU, now, replay: r, accessToken: tok, jkt: bound.jkt };
    expect((await verifyDpop(await proof(k, { ath: ath(tok) }), o)).ok).toBe(true);
    expect((await verifyDpop(await proof(k), o)).ok).toBe(false); // ath yok
    expect((await verifyDpop(await proof(k, { ath: ath("başka") }), o)).ok).toBe(false);
    // çalınan belirteç başka anahtarla kullanılamaz
    expect(await verifyDpop(await proof(other, { ath: ath(tok) }), o)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/not the key bound/),
    });
  });
  it("Authorization başlığı ayrıştırılır", () => {
    expect(parseAuthorization("DPoP abc")).toEqual({ scheme: "DPoP", token: "abc" });
    expect(parseAuthorization("Bearer abc")).toEqual({ scheme: "Bearer", token: "abc" });
    expect(parseAuthorization(undefined).scheme).toBeNull();
  });
});
