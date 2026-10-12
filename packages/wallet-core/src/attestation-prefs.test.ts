import { describe, expect, it } from "vitest";
import {
  checkKeyAttestation,
  issuerAttestationPrefs,
  keyAttestationRequestOf,
  wiaMeetsPreference,
  wiaStatusRemaining,
  wuaForIssuer,
} from "./attestation-prefs.js";
import type { IssuerMetadata } from "./oid4vci.js";
import type { WuaRecord } from "./wua.js";

const NOW = 1_800_000_000;
const DAY = 86400;
const jwt = (payload: unknown) =>
  `${Buffer.from(JSON.stringify({ alg: "ES256", typ: "x" })).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const VCT = "urn:tamga:edu:DiplomaCredential:1";
const md = (extra: Partial<IssuerMetadata> = {}, kar?: Record<string, unknown>): IssuerMetadata => ({
  credential_issuer: "https://issuer.example/x",
  credential_endpoint: "https://issuer.example/x/credential",
  credential_configurations_supported: {
    [VCT]: {
      format: "dc+sd-jwt",
      vct: VCT,
      ...(kar ? { proof_types_supported: { jwt: { key_attestations_required: kar } } } : {}),
    },
  },
  ...extra,
});
const wua = (statusExp?: number): WuaRecord => ({
  jwt: jwt({ sub: "s", ...(statusExp ? { client_status: { status: {}, exp: statusExp } } : {}) }),
  sub: "s",
  exp: NOW + 3600,
  keyRef: "k",
  keyStorage: "software",
  solutionId: "x",
  provider: "https://wp.example",
});

describe("kurumun cüzdan kanıtı tercihleri (WUA_05a, WUA_32; AB TS3 §2.4)", () => {
  it("metadata'dan okunur: key_attestations_required + preferred_* süreleri", () => {
    const p = issuerAttestationPrefs(
      md(
        { preferred_client_status_period: 30 * DAY },
        {
          key_storage: ["iso_18045_high"],
          user_authentication: ["iso_18045_moderate"],
          preferred_key_storage_status_period: 60 * DAY,
        },
      ),
      VCT,
    );
    expect(p).toEqual({
      keyAttestationsRequired: true,
      keyStorage: ["iso_18045_high"],
      userAuthentication: ["iso_18045_moderate"],
      preferredKeyStorageStatusPeriod: 60 * DAY,
      preferredClientStatusPeriod: 30 * DAY,
    });
    expect(keyAttestationRequestOf(p)).toEqual({
      keyStorage: ["iso_18045_high"],
      userAuthentication: ["iso_18045_moderate"],
      minStatusPeriod: 60 * DAY,
    });
  });

  it("tercih yoksa boş; bozuk değerler yok sayılır", () => {
    expect(issuerAttestationPrefs(md(), VCT)).toEqual({ keyAttestationsRequired: false });
    const p = issuerAttestationPrefs(
      md({ preferred_client_status_period: -5 } as never, {
        key_storage: "x",
        preferred_key_storage_status_period: 1.5,
      }),
      VCT,
    );
    expect(p).toEqual({ keyAttestationsRequired: true });
    expect(keyAttestationRequestOf(p)).toBeUndefined();
  });

  it("KA şartı: kabul edilen seviyelerden biri yeter; yoksa açık neden", () => {
    const prefs = issuerAttestationPrefs(md({}, { key_storage: ["iso_18045_high", "iso_18045_moderate"] }), VCT);
    const good = jwt({ key_storage: ["iso_18045_moderate"], key_storage_status: { exp: NOW + 90 * DAY } });
    expect(checkKeyAttestation(good, prefs, NOW)).toEqual({ ok: true, periodMet: true, statusRemaining: 90 * DAY });
    const bad = checkKeyAttestation(jwt({ key_storage: ["iso_18045_basic"] }), prefs, NOW);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.missing).toBe("key_storage");
      expect(bad.reason).toContain("iso_18045_basic");
    }
  });

  it("KA bakım süresi tercihten kısaysa ret değil, periodMet false", () => {
    const prefs = issuerAttestationPrefs(md({}, { preferred_key_storage_status_period: 365 * DAY }), VCT);
    const r = checkKeyAttestation(
      jwt({ key_storage: ["iso_18045_high"], key_storage_status: { exp: NOW + 60 * DAY } }),
      prefs,
      NOW,
    );
    expect(r).toEqual({ ok: true, periodMet: false, statusRemaining: 60 * DAY });
  });

  it("WIA bakım süresi: kalan süre ve tercih", () => {
    const prefs = issuerAttestationPrefs(md({ preferred_client_status_period: 90 * DAY }), VCT);
    expect(wiaStatusRemaining(wua(NOW + 60 * DAY), NOW)).toBe(60 * DAY);
    expect(wiaStatusRemaining(wua(), NOW)).toBeUndefined();
    expect(wiaMeetsPreference(wua(NOW + 60 * DAY), prefs, NOW)).toBe(false);
    expect(wiaMeetsPreference(wua(NOW + 120 * DAY), prefs, NOW)).toBe(true);
    expect(wiaMeetsPreference(wua(), issuerAttestationPrefs(md(), VCT), NOW)).toBe(true);
  });

  it("TS3 §2.4.2: tercihi karşılamayan WIA yerine sağlayıcıdan daha uzunu istenir; yenileme hatası akışı durdurmaz", async () => {
    const prefs = issuerAttestationPrefs(md({ preferred_client_status_period: 90 * DAY }), VCT);
    const short = wua(NOW + 60 * DAY);
    const asked: number[] = [];
    const longer = await wuaForIssuer({
      wua: short,
      prefs,
      now: NOW,
      renew: async (r) => {
        asked.push(r.minStatusPeriod);
        return wua(NOW + 100 * DAY);
      },
    });
    expect(asked).toEqual([90 * DAY]);
    expect(wiaStatusRemaining(longer, NOW)).toBe(100 * DAY);
    const kept = await wuaForIssuer({ wua: short, prefs, now: NOW, renew: async () => Promise.reject(new Error("x")) });
    expect(kept).toBe(short);
    const ok = wua(NOW + 120 * DAY);
    expect(await wuaForIssuer({ wua: ok, prefs, now: NOW, renew: async () => wua(NOW) })).toBe(ok);
  });
});

describe("obtainCredential: kurumun KA şartı (WUA_05a)", async () => {
  const { obtainCredential } = await import("./oid4vci.js");
  const { SoftwareKeyProvider, MemoryKeyStore } = await import("./keys.js");
  const mdKa = (kar: Record<string, unknown>) =>
    ({
      credential_issuer: "https://i",
      credential_endpoint: "https://i/credential",
      nonce_endpoint: "https://i/nonce",
      credential_configurations_supported: {
        v: { format: "dc+sd-jwt", vct: "v", proof_types_supported: { jwt: { key_attestations_required: kar } } },
      },
    }) as unknown as IssuerMetadata;
  const http = async (url: string) =>
    url === "https://i/nonce"
      ? { status: 200, text: async () => JSON.stringify({ c_nonce: "n1" }) }
      : { status: 200, text: async () => JSON.stringify({ credentials: [{ credential: "c0" }] }) };

  it("KA üreticisi kurumun şartını ve bakım süresi tercihini alır; uygun KA ile belge alınır", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const reqs: unknown[] = [];
    const out = await obtainCredential({
      issuer: "https://i",
      vct: "v",
      metadata: mdKa({ key_storage: ["iso_18045_moderate"], preferred_key_storage_status_period: 30 * DAY }),
      accessToken: "a",
      keys,
      http,
      batch: 1,
      now: NOW,
      keyAttestor: async (_jwks, req) => {
        reqs.push(req);
        return jwt({ key_storage: ["iso_18045_moderate"], key_storage_status: { exp: NOW + 60 * DAY } });
      },
    });
    expect(out.copies).toHaveLength(1);
    expect(reqs).toEqual([{ keyStorage: ["iso_18045_moderate"], minStatusPeriod: 30 * DAY }]);
  });

  it("şartı karşılamayan KA gönderilmez: açık hata, üretilen anahtarlar silinir", async () => {
    const store = new MemoryKeyStore();
    const keys = new SoftwareKeyProvider(store);
    let calledIssuer = false;
    await expect(
      obtainCredential({
        issuer: "https://i",
        vct: "v",
        metadata: mdKa({ key_storage: ["iso_18045_high"] }),
        accessToken: "a",
        keys,
        http: async (url: string) => {
          if (url !== "https://i/nonce") calledIssuer = true;
          return http(url);
        },
        batch: 2,
        now: NOW,
        keyAttestor: async () => jwt({ key_storage: ["iso_18045_basic"] }),
      }),
    ).rejects.toThrow(/iso_18045_high/);
    expect(calledIssuer).toBe(false);
    expect(await keys.publicKey("never")).toBeNull();
  });
});
