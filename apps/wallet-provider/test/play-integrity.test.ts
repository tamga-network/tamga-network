/**
 * Play Integrity (a2, zorunlu değil): hüküm değerlendirmesi saf mantık; Google çağrıları sahte `fetch` ile (servis hesabı JWT
 * bearer → erişim belirteci → decodeIntegrityToken). Gerçek jeton burada üretilemez; cihazda deneme mağaza derlemesinde.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { importSPKI, jwtVerify } from "jose";
import {
  PLAY_INTEGRITY_API,
  PLAY_INTEGRITY_SCOPE,
  _resetTokenCache,
  decodeIntegrityToken,
  evaluatePlayIntegrity,
  loadServiceAccount,
  serviceAccountUsable,
  verifyPlayIntegrity,
  type ServiceAccount,
} from "../src/play-integrity.js";

const PKG = "network.tamga.wallet";
const HASH = "c2hhbGxlbmdl-abc";
const NOW = new Date("2026-10-04T12:00:00Z");

function payload(over: Record<string, unknown> = {}) {
  return {
    requestDetails: { requestPackageName: PKG, requestHash: HASH, timestampMillis: String(NOW.getTime() - 5_000) },
    appIntegrity: {
      appRecognitionVerdict: "PLAY_RECOGNIZED",
      packageName: PKG,
      certificateSha256Digest: ["abc"],
      versionCode: "1",
    },
    deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY", "MEETS_BASIC_INTEGRITY"] },
    accountDetails: { appLicensingVerdict: "LICENSED" },
    ...over,
  };
}
const base = { packageName: PKG, requestHash: HASH, now: NOW };

describe("Play Integrity — hüküm değerlendirmesi (saf)", () => {
  it("cihaz bütünlüğü + Play'in tanıdığı uygulama → ok; güçlü hüküm ayrı sınıf", () => {
    expect(evaluatePlayIntegrity(payload(), base)).toEqual({ ok: true, device: "device", app: "play_recognized" });
    const strong = payload({
      deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_STRONG_INTEGRITY", "MEETS_DEVICE_INTEGRITY"] },
    });
    expect(evaluatePlayIntegrity(strong, base).device).toBe("strong");
  });

  it("paket, meydan okuma, tazelik eşleşmeli", () => {
    expect(evaluatePlayIntegrity(payload(), { ...base, packageName: "com.other" }).reason).toBe("package mismatch");
    expect(evaluatePlayIntegrity(payload(), { ...base, requestHash: "x" }).reason).toBe("request hash mismatch");
    const old = payload({
      requestDetails: {
        requestPackageName: PKG,
        requestHash: HASH,
        timestampMillis: String(NOW.getTime() - 11 * 60_000),
      },
    });
    expect(evaluatePlayIntegrity(old, base).reason).toBe("verdict too old");
    expect(evaluatePlayIntegrity({}, base)).toMatchObject({ ok: false, device: "none", app: "unevaluated" });
  });

  it("yalnız temel bütünlük ya da hüküm yok → ok değil (seviye zaten anahtar kanıtından; bilgi olarak kaydedilir)", () => {
    const basic = payload({ deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_BASIC_INTEGRITY"] } });
    expect(evaluatePlayIntegrity(basic, base)).toMatchObject({
      ok: false,
      device: "basic",
      reason: "device integrity: basic",
    });
    const none = payload({ deviceIntegrity: { deviceRecognitionVerdict: [] } });
    expect(evaluatePlayIntegrity(none, base)).toMatchObject({ ok: false, device: "none" });
  });

  it("tanınmayan sürüm yalnız geliştirmede geçer (yan yükleme / iç test)", () => {
    const side = payload({ appIntegrity: { appRecognitionVerdict: "UNRECOGNIZED_VERSION", packageName: PKG } });
    expect(evaluatePlayIntegrity(side, base)).toMatchObject({ ok: false, app: "unrecognized_version" });
    expect(evaluatePlayIntegrity(side, { ...base, allowDevelopment: true }).ok).toBe(true);
    const other = payload({ appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED", packageName: "com.other" } });
    expect(evaluatePlayIntegrity(other, base).reason).toBe("app package mismatch");
  });
});

describe("Play Integrity — Google çağrıları (sahte fetch)", () => {
  const rsa = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const sa: ServiceAccount = {
    client_email: "wp@test-project.iam.gserviceaccount.com",
    private_key: rsa.privateKey,
    token_uri: "https://oauth2.example/token",
  };
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let decodeResponse: unknown = { tokenPayloadExternal: payload() };
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init: init ?? {} });
    if (u === sa.token_uri) {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
      const { payload: claims } = await jwtVerify(body.get("assertion")!, await importSPKI(rsa.publicKey, "RS256"), {
        issuer: sa.client_email,
        audience: sa.token_uri,
        currentDate: NOW, // assertion sabit test saatiyle imzalı (gerçek saatten bağımsız)
      });
      expect(claims.scope).toBe(PLAY_INTEGRITY_SCOPE);
      return new Response(JSON.stringify({ access_token: "at-1", expires_in: 3600 }), { status: 200 });
    }
    if (u === `${PLAY_INTEGRITY_API}/${PKG}:decodeIntegrityToken`) {
      expect(init?.headers).toMatchObject({ authorization: "Bearer at-1" });
      expect(JSON.parse(String(init?.body))).toEqual({ integrity_token: "tok-1" });
      return new Response(JSON.stringify(decodeResponse), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  beforeEach(() => {
    calls.length = 0;
    _resetTokenCache();
    decodeResponse = { tokenPayloadExternal: payload() };
  });

  it("decodeIntegrityToken: servis hesabı JWT → erişim belirteci → çözülmüş hüküm; belirteç önbellekte", async () => {
    const p = await decodeIntegrityToken("tok-1", { packageName: PKG, serviceAccount: sa, fetch: fakeFetch, now: NOW });
    expect((p as { requestDetails: { requestHash: string } }).requestDetails.requestHash).toBe(HASH);
    expect(calls.map((c) => c.url)).toEqual([sa.token_uri, `${PLAY_INTEGRITY_API}/${PKG}:decodeIntegrityToken`]);
    await decodeIntegrityToken("tok-1", { packageName: PKG, serviceAccount: sa, fetch: fakeFetch, now: NOW });
    expect(calls.filter((c) => c.url === sa.token_uri)).toHaveLength(1);
  });

  it("verifyPlayIntegrity: servis hesabı yoksa ya da jeton yoksa null (atlanır; seviye değişmez)", async () => {
    expect(await verifyPlayIntegrity("tok-1", { ...base, serviceAccount: null, fetch: fakeFetch })).toBeNull();
    expect(await verifyPlayIntegrity(undefined, { ...base, serviceAccount: sa, fetch: fakeFetch })).toBeNull();
    expect(await verifyPlayIntegrity("x".repeat(30_000), { ...base, serviceAccount: sa, fetch: fakeFetch })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("verifyPlayIntegrity: uçtan uca ok; Google erişilemezse ok değil ama kayıt düşmez", async () => {
    expect(await verifyPlayIntegrity("tok-1", { ...base, serviceAccount: sa, fetch: fakeFetch })).toEqual({
      ok: true,
      device: "device",
      app: "play_recognized",
    });
    const down = (async () => new Response("boom", { status: 503 })) as unknown as typeof fetch;
    _resetTokenCache();
    expect(await verifyPlayIntegrity("tok-1", { ...base, serviceAccount: sa, fetch: down })).toMatchObject({
      ok: false,
      reason: "google unavailable",
    });
  });

  it("Google yanıt vermezse istek zaman aşımıyla kesilir (askıda kalmaz); sonuç ok değil, kayıt düşmez", async () => {
    _resetTokenCache();
    let aborted = 0;
    const hang = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener("abort", () => {
          aborted++;
          rej(new Error("aborted"));
        });
      })) as typeof fetch;
    const t0 = Date.now();
    expect(
      await verifyPlayIntegrity("tok-1", { ...base, serviceAccount: sa, fetch: hang, timeoutMs: 50 }),
    ).toMatchObject({ ok: false, reason: "google unavailable" });
    expect(aborted).toBe(1);
    expect(Date.now() - t0).toBeLessThan(2_000);
  });

  it("gövde okuması da toplam bütçede: yanıt başlığı gelip gövde akmazsa zaman aşımı", async () => {
    _resetTokenCache();
    const stall = (async () =>
      new Response(new ReadableStream({ start() {} }), { status: 200 })) as unknown as typeof fetch;
    const t0 = Date.now();
    expect(
      await verifyPlayIntegrity("tok-1", { ...base, serviceAccount: sa, fetch: stall, timeoutMs: 50 }),
    ).toMatchObject({ ok: false, reason: "google unavailable" });
    expect(Date.now() - t0).toBeLessThan(2_000);
  });

  it("serviceAccountUsable: bozuk özel anahtar → false (açılışta Play Integrity kapalı sayılır)", async () => {
    expect(await serviceAccountUsable(sa)).toBe(true);
    expect(
      await serviceAccountUsable({
        ...sa,
        private_key: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----",
      }),
    ).toBe(false);
  });

  it("loadServiceAccount: boş → null; satır içi JSON kabul; bozuk/eksik → SABİT hata, içerik basılmaz", () => {
    expect(loadServiceAccount("")).toBeNull();
    expect(loadServiceAccount(undefined)).toBeNull();
    expect(loadServiceAccount(JSON.stringify(sa))).toMatchObject({ client_email: sa.client_email });
    expect(() => loadServiceAccount(JSON.stringify({ client_email: "x" }))).toThrow(/^play_integrity_config_invalid$/);
    expect(() => loadServiceAccount("/no/such/file.json")).toThrow(/^play_integrity_config_missing$/);
    // bozuk JSON: ayrıştırıcı iletisi (özel anahtar parçası içerebilir) dışarı sızmaz
    const secret = '{"client_email":"x","private_key":"-----BEGIN PRIVATE KEY-----SECRET';
    try {
      loadServiceAccount(secret);
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toBe("play_integrity_config_invalid");
      expect(String((e as Error).stack ?? "")).not.toContain("SECRET");
    }
  });
});
