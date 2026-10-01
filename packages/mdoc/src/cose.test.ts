import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { coseSign1, coseVerify1, parseCoseSign1, coseKeyFromPoint, pointFromCoseKey } from "./cose.js";

describe("COSE_Sign1 (ES256)", () => {
  it("sign → verify geçerli; kurcalanmış payload ya da yanlış anahtar → geçersiz", () => {
    const sk = p256.utils.randomSecretKey();
    const pub = p256.getPublicKey(sk, false); // 65 bayt uncompressed
    const payload = new TextEncoder().encode("MobileSecurityObject bytes");
    const sig1 = coseSign1(payload, { sk });

    expect(coseVerify1(sig1, pub)).toBe(true);

    // yanlış anahtar
    const other = p256.getPublicKey(p256.utils.randomSecretKey(), false);
    expect(coseVerify1(sig1, other)).toBe(false);

    // kurcalanmış payload (son bstr baytını boz)
    const bad = sig1.slice();
    bad[bad.length - 30] ^= 0xff;
    expect(coseVerify1(bad, pub)).toBe(false);
  });

  it("x5chain unprotected başlıkta taşınır ve geri okunur", () => {
    const sk = p256.utils.randomSecretKey();
    const cert = new Uint8Array([0x30, 0x82, 1, 2, 3]); // sahte DER
    const sig1 = coseSign1(new Uint8Array([1, 2, 3]), { sk, x5chain: [cert] });
    const parsed = parseCoseSign1(sig1);
    expect(parsed.x5chain.length).toBe(1);
    expect(parsed.x5chain[0]).toEqual(cert);
  });

  it("COSE_Key: nokta → COSE_Key → nokta round-trip", () => {
    const pub = p256.getPublicKey(p256.utils.randomSecretKey(), false);
    const k = coseKeyFromPoint(pub);
    expect(k.get(1)).toBe(2); // EC2
    expect(k.get(-1)).toBe(1); // P-256
    expect(pointFromCoseKey(k)).toEqual(pub);
  });
});
