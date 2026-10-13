/** HPKE — RFC 9180 Ek A.3.1 (DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-128-GCM, temel kip) test vektörü. */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { hpkeContextForTest, hpkeOpen, hpkeSeal } from "./hpke.js";

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((h) => parseInt(h, 16)));
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

// RFC 9180 Ek A.3.1 (rfc-editor.org metni)
const V = {
  pkEm: "04a92719c6195d5085104f469a8b9814d5838ff72b60501e2c4466e5e67b325ac98536d7b61a1af4b78e5b7f951c0900be863c403ce65c9bfcb9382657222d18c4",
  pkRm: "04fe8c19ce0905191ebc298a9245792531f26f0cece2460639e8bc39cb7f706a826a779b4cf969b8a0e539c7f62fb3d30ad6aa8f80e30f1d128aafd68a2ce72ea0",
  info: "4f6465206f6e2061204772656369616e2055726e",
  skEm: "4995788ef4b9d6132b249ce59a77281493eb39af373d236a1fe415cb0c2d7beb",
  skRm: "f3ce7fdae57e1a310d87f1ebbde6f328be0a99cdbcadf4d6589cf29de4b8ffd2",
  shared_secret: "c0d26aeab536609a572b07695d933b589dcf363ff9d93c93adea537aeabb8cb8",
  key: "868c066ef58aae6dc589b6cfdd18f97e",
  base_nonce: "4e0bc5018beba4bf004cca59",
  pt: "4265617574792069732074727574682c20747275746820626561757479",
  aad: "436f756e742d30",
  ct: "5ad590bb8baa577f8619db35a36311226a896e7342a6d836d8b7bcd2f20b6c7f9076ac232e3ab2523f39513434",
};

describe("HPKE (RFC 9180)", () => {
  it("Ek A.3.1: shared_secret, key, base_nonce ve ilk şifreleme vektörle aynı", () => {
    const pkR = p256.getPublicKey(hex(V.skRm), false);
    expect(toHex(pkR)).toBe(V.pkRm);
    expect(toHex(p256.getPublicKey(hex(V.skEm), false))).toBe(V.pkEm);
    const c = hpkeContextForTest({ skE: hex(V.skEm), pkR }, hex(V.info));
    expect(toHex(c.sharedSecret)).toBe(V.shared_secret);
    expect(toHex(c.key)).toBe(V.key);
    expect(toHex(c.baseNonce)).toBe(V.base_nonce);
    const s = hpkeSeal({
      recipientPublicKey: pkR,
      info: hex(V.info),
      aad: hex(V.aad),
      plaintext: hex(V.pt),
      skE: hex(V.skEm),
    });
    expect(toHex(s.ciphertext)).toBe(V.ct);
    expect(
      toHex(
        hpkeOpen({
          recipientPrivateKey: hex(V.skRm),
          enc: s.enc,
          info: hex(V.info),
          aad: hex(V.aad),
          ciphertext: s.ciphertext,
        }),
      ),
    ).toBe(V.pt);
  });

  it("yanlış info / aad / anahtar ile açılmaz", () => {
    const sk = p256.utils.randomSecretKey();
    const pk = p256.getPublicKey(sk, false);
    const s = hpkeSeal({ recipientPublicKey: pk, info: new Uint8Array([1]), plaintext: new Uint8Array([9, 9]) });
    expect(() =>
      hpkeOpen({ recipientPrivateKey: sk, enc: s.enc, info: new Uint8Array([2]), ciphertext: s.ciphertext }),
    ).toThrow();
    expect(() =>
      hpkeOpen({
        recipientPrivateKey: sk,
        enc: s.enc,
        info: new Uint8Array([1]),
        aad: new Uint8Array([1]),
        ciphertext: s.ciphertext,
      }),
    ).toThrow();
    expect(() =>
      hpkeOpen({
        recipientPrivateKey: p256.utils.randomSecretKey(),
        enc: s.enc,
        info: new Uint8Array([1]),
        ciphertext: s.ciphertext,
      }),
    ).toThrow();
    expect(
      hpkeOpen({ recipientPrivateKey: sk, enc: s.enc, info: new Uint8Array([1]), ciphertext: s.ciphertext }),
    ).toEqual(new Uint8Array([9, 9]));
  });
});
