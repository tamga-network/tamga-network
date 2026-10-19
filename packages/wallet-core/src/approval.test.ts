/**
 * ADR-0056 K8: `respond` yalnız `checkRp`'nin ürettiği, isteğe bağlı onayla çalışır. Onay engelleyici durumda (taklit, ACTIVE
 * olmayan kayıtlı doğrulayıcı, doğrulanmamış aracı) üretilmez; elle kurulmuş ya da başka isteğe ait onay reddedilir.
 */
import { describe, it, expect } from "vitest";
import { checkRp, respond, type Match, type RpRecord, type VpRequest } from "./oid4vp.js";
import { epochMillis } from "@tamga-network/core/time";

const FP = "ab".repeat(32);
const req = (o: Partial<VpRequest> = {}) =>
  ({
    clientId: "x509_hash:abc",
    nonce: "nonce-1",
    responseUri: "https://verify.example/vp/response",
    leafFingerprint: FP,
    dcql: { credentials: [] },
    ...o,
  }) as unknown as VpRequest;
const match = { requested: ["is_graduate"], credential: { vct: "urn:tamga:edu:Diploma:1" } } as unknown as Match;
const rp = (o: Partial<RpRecord> = {}) =>
  ({
    legal_name: "Örnek A.Ş.",
    status: "ACTIVE",
    access_cert_fingerprint_sha256: FP,
    scopes: [],
    ...o,
  }) as unknown as RpRecord;
const NOW = epochMillis(Date.parse("2026-10-19T12:00:00Z"));
const noHttp = async () => {
  throw new Error("no network in this test");
};
const respondWith = (request: VpRequest, approval: unknown) =>
  respond({
    request,
    approval: approval as never,
    matches: [],
    keys: {} as never,
    http: noHttp as never,
  });

describe("checkRp onayı → respond (ADR-0056 K8)", () => {
  it("kayıtlı ACTIVE doğrulayıcı ve kayıtsız doğrulayıcı (PV2 uyarısı) onay alır", () => {
    expect(checkRp(rp(), req(), match, NOW).approval).toBeTruthy();
    expect(checkRp(null, req(), match, NOW).approval).toBeTruthy();
  });
  it("taklit, ACTIVE olmayan kayıt ve doğrulanmamış aracı onay almaz", () => {
    expect(checkRp(rp({ access_cert_fingerprint_sha256: "cd".repeat(32) }), req(), match, NOW)).toMatchObject({
      impersonation: true,
    });
    expect(
      checkRp(rp({ access_cert_fingerprint_sha256: "cd".repeat(32) }), req(), match, NOW).approval,
    ).toBeUndefined();
    expect(checkRp(rp({ status: "SUSPENDED" } as never), req(), match, NOW).approval).toBeUndefined();
    expect(checkRp(rp(), req({ onBehalfOf: "x509_hash:site" }), match, NOW, null).approval).toBeUndefined();
  });
  it("onaysız, elle kurulmuş ya da başka isteğe ait onayla sunum yapılmaz (ağa hiç gidilmez)", async () => {
    const a = req();
    const approval = checkRp(rp(), a, match, NOW).approval;
    for (const bad of [undefined, {}, Object.freeze({})])
      await expect(respondWith(a, bad)).rejects.toMatchObject({ code: "trust_error" });
    await expect(respondWith(req({ nonce: "nonce-2" }), approval)).rejects.toMatchObject({ code: "trust_error" });
    await expect(respondWith(req({ responseUri: "https://evil.example/r" }), approval)).rejects.toMatchObject({
      code: "trust_error",
    });
    await expect(respondWith(req({ onBehalfOf: "x509_hash:other" }), approval)).rejects.toMatchObject({
      code: "trust_error",
    });
    // aynı isteğin kopyası (ör. rpKey eklenmiş) onaylıdır: onay istek alanlarına bağlı, nesne kimliğine değil — ilerleyip
    // şifreleme adımında (bu testte eksik anahtar) durur, onay hatası vermez
    await expect(respondWith({ ...a, rpKey: "site.example" } as VpRequest, approval)).rejects.not.toMatchObject({
      code: "trust_error",
    });
  });
  it("zaman birimi: saniye verilirse hata (ADR-0056 K12)", () => {
    expect(() => checkRp(rp(), req(), match, Math.floor(Date.now() / 1000) as never)).toThrow(/milliseconds/);
  });
});
