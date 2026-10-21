import { describe, expect, it } from "vitest";
import { certsValidAt, unlinkableTimeClaims } from "./factory.js";

// RFC 9901 §10.1 (OpenID uyum öz-testi VCIEnsureBatchTimeClaimsNotLinkable / VCIEnsureCredentialTimeClaimsNotLinkable)
describe("unlinkableTimeClaims", () => {
  const now = 1792600765; // saat başı + 2365 sn
  it("iat ve exp saat başına aşağı yuvarlanır; iat geleceğe, exp istenen bitişin ötesine kaymaz", () => {
    const r = unlinkableTimeClaims(now, now + 730 * 86400);
    expect(r.iat % 3600).toBe(0);
    expect(r.iat).toBeLessThanOrEqual(now);
    expect(now - r.iat).toBeLessThan(3600);
    expect(r.exp! % 3600).toBe(0);
    expect(r.exp!).toBeLessThanOrEqual(now + 730 * 86400);
  });
  it("aynı saatteki iki verme aynı değerleri alır (bağlanamaz)", () => {
    expect(unlinkableTimeClaims(now, now + 86400)).toEqual(unlinkableTimeClaims(now + 18, now + 18 + 86400));
  });
  it("exp yoksa yalnız iat; bir saatten kısa ömürde exp olduğu gibi kalır", () => {
    expect(unlinkableTimeClaims(now)).toEqual({ iat: now - (now % 3600) });
    const short = now + 600;
    expect(unlinkableTimeClaims(now, short).exp).toBe(short - (short % 3600) > now ? short - (short % 3600) : short);
  });
  it("yuvarlanmış an doğrulanamazsa (sertifika/yetki o saatten sonra başladı) iat = now", () => {
    const start = now - 100; // sertifika 100 sn önce başladı
    const r = unlinkableTimeClaims(now, now + 86400, { acceptableAt: (t) => t >= start });
    expect(r.iat).toBe(now);
    expect(r.exp! % 3600).toBe(0);
    expect(unlinkableTimeClaims(now, undefined, { acceptableAt: () => true }).iat % 3600).toBe(0);
  });
  it("certsValidAt: boş zincir geçerli; bozuk DER hata", () => {
    expect(certsValidAt([], now)).toBe(true);
    expect(() => certsValidAt([new Uint8Array([1, 2, 3])], now)).toThrow();
  });
});
