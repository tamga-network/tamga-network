/** @tamga-network/core yardımcıları: base64/PEM, özetler, kimlik türetimleri (SPEC-ID-0002, ADR-0010, ADR-0034). */
import { describe, expect, it } from "vitest";
import {
  b64u,
  b64uToBytes,
  b64uToUtf8,
  pemToDer,
  derToPem,
  derToB64,
  b64ToDer,
  utf8,
  sha256Hex,
  sha256Tag,
  sha256Sri,
  keccak256Hex,
  toHex,
  fromHex,
  concat,
  computeIssuerId,
  computeIdFromFingerprintHex,
  computeSchemaId,
  certFingerprintSha256Hex,
  x509HashClientId,
  x509HashClientIdFromFingerprintHex,
  X509_HASH_PREFIX,
} from "./index.js";

const DER = new Uint8Array([0x30, 0x82, 0x01, 0x0a, 0xff, 0x00, 0x7f]);

describe("base64 ve PEM", () => {
  it("base64url gidip gelir, dolgu yok", () => {
    const s = b64u(new Uint8Array([0xfb, 0xff, 0xfe]));
    expect(s).toBe("-__-");
    expect([...b64uToBytes(s)]).toEqual([0xfb, 0xff, 0xfe]);
    expect(b64uToUtf8(b64u("Tamga ✓"))).toBe("Tamga ✓");
  });

  it("DER ↔ PEM ↔ base64", () => {
    expect([...pemToDer(derToPem(DER))]).toEqual([...DER]);
    expect([...b64ToDer(derToB64(DER))]).toEqual([...DER]);
    expect(derToPem(DER)).toMatch(/^-----BEGIN CERTIFICATE-----\n[\s\S]+\n-----END CERTIFICATE-----\n?$/);
  });
});

describe("özetler", () => {
  it("SHA-256 bilinen değer", () => {
    expect(sha256Hex(utf8("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Tag(utf8("abc"))).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Sri(utf8("abc"))).toBe("sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
  });

  it("Keccak-256 bilinen değer (boş girdi)", () => {
    expect(keccak256Hex(new Uint8Array())).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  });

  it("hex ve birleştirme", () => {
    expect(toHex(fromHex("00ff10"))).toBe("00ff10");
    expect([...concat(new Uint8Array([1]), new Uint8Array([2, 3]))]).toEqual([1, 2, 3]);
  });
});

describe("kimlik türetimleri", () => {
  it("issuer_id sertifikadan ve parmak izinden aynı çıkar", () => {
    const fp = certFingerprintSha256Hex(DER);
    expect(computeIdFromFingerprintHex("TR", fp)).toBe(computeIssuerId("TR", DER));
    expect(computeIssuerId("TR", DER)).not.toBe(computeIssuerId("AZ", DER));
    expect(computeIssuerId("TR", DER)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("schema_id = keccak256(vct)", () => {
    expect(computeSchemaId("urn:tamga:edu:StudentCredential:1")).toBe(
      keccak256Hex(utf8("urn:tamga:edu:StudentCredential:1")),
    );
  });

  it("x509_hash istemci kimliği: önek + base64url(SHA-256(DER)); parmak izinden aynı", () => {
    const id = x509HashClientId(DER);
    expect(id.startsWith(X509_HASH_PREFIX)).toBe(true);
    expect(id.slice(X509_HASH_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(x509HashClientIdFromFingerprintHex(certFingerprintSha256Hex(DER))).toBe(id);
  });
});
