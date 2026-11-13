/**
 * ADR-0080 (0.8.4): kimlik servisi belirteç yanıtında maskeli özet + onay belirteci verirse cüzdan belge istemeden önce kişiye sorar
 * ve kararı bildirir. Ret → belge istenmez (`identity_rejected`). Onay ucu belirteç ucuyla aynı kökende olmalı.
 */
import { describe, it, expect } from "vitest";
import { MemoryKeyStore, SoftwareKeyProvider } from "./keys.js";
import { completeAuthorized, type AuthStart, type IdentityConfirmationPrompt } from "./authcode.js";
import type { Http } from "./http.js";
import type { WuaRecord } from "./wua.js";

const AS = "https://id.tamga.network";
const start = {
  issuer: AS,
  vct: "urn:tamga:id:IdentityAttestation:1",
  redirectUri: "tamga-wallet://idv/cb",
  state: "st",
  pkce: { verifier: "v", challenge: "c" },
  requestUri: "urn:x",
  authorizeUrl: `${AS}/authorize`,
  metadata: {} as never,
  as: { issuer: AS, token_endpoint: `${AS}/token`, authorization_response_iss_parameter_supported: false },
} as AuthStart;

async function setup(offer: Record<string, unknown> | undefined, confirmStatus = 200) {
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  await keys.generate("wua.k");
  const wua = { jwt: "wia", sub: "inst-1", exp: 2_000_000_000, keyRef: "wua.k" } as WuaRecord;
  const calls: Array<{ url: string; body?: string; headers?: Record<string, string> }> = [];
  const http: Http = async (url, init) => {
    calls.push({ url, body: init?.body as string | undefined, headers: init?.headers });
    if (url.endsWith("/token"))
      return {
        status: 200,
        text: async () => JSON.stringify({ access_token: "at", ...(offer ? { identity_confirmation: offer } : {}) }),
      };
    if (url.endsWith("/identity-confirmation"))
      return { status: confirmStatus, text: async () => JSON.stringify({ status: "confirmed" }) };
    // bu testte belge isteği ağın ötesindedir: metadata sahte olduğu için obtainCredential burada durur
    throw new Error("credential-step");
  };
  return { keys, wua, calls, http };
}

const offer = {
  required: true,
  summary: { given_name_initial: "A", family_name_initial: "Y", birth_year: 2002, extra: "yok sayılır" },
  token: "tok-1",
  endpoint: `${AS}/identity-confirmation`,
  expires_in: 300,
};

const run = (
  s: Awaited<ReturnType<typeof setup>>,
  confirmIdentity?: (c: IdentityConfirmationPrompt) => Promise<boolean>,
) =>
  completeAuthorized({
    start,
    callbackUrl: "tamga-wallet://idv/cb?code=c&state=st",
    keys: s.keys,
    http: s.http,
    wua: s.wua,
    randomBytes: (n) => new Uint8Array(n).fill(1),
    now: 1_800_000_000,
    ...(confirmIdentity ? { confirmIdentity } : {}),
  });

describe("ADR-0080 — cüzdanda son onay", () => {
  it("onay: özet kişiye yalnız bilinen alanlarla gösterilir, karar DPoP + cüzdan kanıtıyla bildirilir, sonra belge istenir", async () => {
    const s = await setup(offer);
    let seen: IdentityConfirmationPrompt | undefined;
    const e = await run(s, async (c) => ((seen = c), true)).catch((x: Error) => x);
    expect(seen).toEqual({
      summary: { given_name_initial: "A", family_name_initial: "Y", birth_year: 2002 },
      required: true,
    });
    const conf = s.calls.find((c) => c.url.endsWith("/identity-confirmation"))!;
    expect(JSON.parse(conf.body!)).toEqual({ token: "tok-1", decision: "confirm" });
    expect(conf.headers?.authorization).toBe("DPoP at");
    expect(conf.headers?.dpop).toBeTruthy();
    expect(conf.headers?.["oauth-client-attestation"]).toBe("wia");
    expect(conf.headers?.["oauth-client-attestation-pop"]).toBeTruthy();
    // onaydan sonra belge adımına geçildi (bu testte sahte metadata yüzünden orada durur)
    expect(String((e as Error).message)).not.toMatch(/identity/);
  });

  it("ret: karar bildirilir, belge İSTENMEZ, `identity_rejected`", async () => {
    const s = await setup(offer);
    const e = (await run(s, async () => false).catch((x) => x)) as { code?: string };
    expect(e.code).toBe("identity_rejected");
    const conf = s.calls.find((c) => c.url.endsWith("/identity-confirmation"))!;
    expect(JSON.parse(conf.body!).decision).toBe("reject");
    expect(s.calls.map((c) => c.url)).toEqual([`${AS}/token`, `${AS}/identity-confirmation`]);
  });

  it("kişi yanıt vermeden vazgeçerse ne onay ne ret gönderilir; DPoP anahtarı silinir", async () => {
    const s = await setup(offer);
    const deleted: string[] = [];
    const del = s.keys.delete.bind(s.keys);
    s.keys.delete = async (ref: string) => (deleted.push(ref), del(ref));
    await expect(
      run(s, async () => {
        throw new Error("cancelled");
      }),
    ).rejects.toThrow("cancelled");
    expect(s.calls.map((c) => c.url)).toEqual([`${AS}/token`]);
    expect(deleted.some((r) => r.startsWith("dpop."))).toBe(true);
  });

  it("onay ucu hata dönerse belge istenmez", async () => {
    const s = await setup(offer, 400);
    await expect(run(s, async () => true)).rejects.toThrow(/identity confirmation error/);
    expect(s.calls.some((c) => !c.url.endsWith("/token") && !c.url.endsWith("/identity-confirmation"))).toBe(false);
  });

  it("onay ucu başka kökendeyse erişim belirteci gönderilmez", async () => {
    const s = await setup({ ...offer, endpoint: "https://evil.example/identity-confirmation" });
    let asked = false;
    await expect(run(s, async () => ((asked = true), true))).rejects.toThrow(/not on the authorization server/);
    expect(asked).toBe(false);
    expect(s.calls.map((c) => c.url)).toEqual([`${AS}/token`]);
  });

  it("teklif yoksa ya da cüzdan onay işlevi vermediyse akış eskisi gibi sürer (soru sorulmaz, onay ucu çağrılmaz)", async () => {
    for (const [o, withFn] of [
      [undefined, true],
      [offer, false],
    ] as const) {
      const s = await setup(o);
      let asked = false;
      await run(s, withFn ? async () => ((asked = true), true) : undefined).catch(() => {});
      expect(asked).toBe(false);
      expect(s.calls.some((c) => c.url.endsWith("/identity-confirmation"))).toBe(false);
    }
  });
});
