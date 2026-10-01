import { describe, it, expect } from "vitest";
import { encode, decode, CborTag, encodeEmbedded, decodeEmbedded } from "./cbor.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const roundtrip = (v: unknown) => decode(encode(v as never));

describe("CBOR", () => {
  it("RFC 8949 örnek vektörleri (uint, negint, bstr, tstr, array, map)", () => {
    expect(bytesToHex(encode(0))).toBe("00");
    expect(bytesToHex(encode(23))).toBe("17");
    expect(bytesToHex(encode(24))).toBe("1818");
    expect(bytesToHex(encode(1000))).toBe("1903e8");
    expect(bytesToHex(encode(-1))).toBe("20");
    expect(bytesToHex(encode(-1000))).toBe("3903e7");
    expect(bytesToHex(encode("a"))).toBe("6161");
    expect(bytesToHex(encode("IETF"))).toBe("6449455446");
    expect(bytesToHex(encode([1, 2, 3]))).toBe("83010203");
    expect(bytesToHex(encode(new Uint8Array([1, 2, 3, 4])))).toBe("4401020304");
    expect(bytesToHex(encode(true))).toBe("f5");
    expect(bytesToHex(encode(false))).toBe("f4");
    expect(bytesToHex(encode(null))).toBe("f6");
  });

  it("map anahtarları deterministik sıralanır (kısa anahtar önce, bytewise)", () => {
    const m = new Map<number, number>([
      [10, 0],
      [1, 0],
      [100, 0],
    ]);
    // 1 → 0x01, 10 → 0x0a, 100 → 0x1864 → bytewise: 01 < 0a < 1864
    expect(bytesToHex(encode(m))).toBe("a3" + "0100" + "0a00" + "186400");
    // aynı içerik farklı ekleme sırası → aynı bayt (determinizm)
    const m2 = new Map<number, number>([
      [100, 0],
      [1, 0],
      [10, 0],
    ]);
    expect(bytesToHex(encode(m2))).toBe(bytesToHex(encode(m)));
  });

  it("round-trip: iç içe map/array/bstr/tstr/bool/null", () => {
    const v = new Map<string, unknown>([
      ["a", 1],
      ["b", [1, 2, new Uint8Array([9, 9])]],
      ["c", new Map<string, unknown>([["x", true]])],
      ["d", null],
    ]);
    const out = roundtrip(v) as Map<string, unknown>;
    expect((out.get("b") as unknown[])[2]).toEqual(new Uint8Array([9, 9]));
    expect((out.get("c") as Map<string, unknown>).get("x")).toBe(true);
    expect(out.get("d")).toBe(null);
  });

  it("tag 24 gömülü CBOR: encode → decode aynı değeri verir", () => {
    const inner = new Map<string, unknown>([["digestID", 3]]);
    const tag = encodeEmbedded(inner as never);
    expect(tag).toBeInstanceOf(CborTag);
    const back = decodeEmbedded(decode(encode(tag))) as Map<string, unknown>;
    expect(back.get("digestID")).toBe(3);
  });

  it("büyük uint (32-bit sınırı) round-trip", () => {
    expect(roundtrip(0xffffffff)).toBe(0xffffffff);
    expect(roundtrip(1700000000)).toBe(1700000000);
  });

  it("hexToBytes yardımcıları erişilebilir (test altyapısı)", () => {
    expect(bytesToHex(hexToBytes("deadbeef"))).toBe("deadbeef");
  });

  it("güvenilmeyen girdi: kesik, dev uzunluk bildirimi, belirsiz uzunluk, aşırı iç içelik, yinelenen anahtar, fazla bayt → hata", () => {
    const bad = [
      Uint8Array.from([0x45, 1, 2]), // bstr(5) ama 2 bayt
      Uint8Array.from([0x9b, 0, 0, 0, 1, 0, 0, 0, 0]), // 2^32 elemanlı dizi, gövde yok
      Uint8Array.from([0x9f, 0x01, 0xff]), // belirsiz uzunluklu dizi
      Uint8Array.from([...new Array(100).fill(0x81), 0x01]), // 100 kat iç içe dizi
      Uint8Array.from([0xa2, 0x61, 0x61, 0x01, 0x61, 0x61, 0x02]), // {"a":1,"a":2}
      Uint8Array.from([0x01, 0x02]), // tamsayı + fazla bayt
    ];
    for (const b of bad) expect(() => decode(b), Array.from(b.slice(0, 3)).join(",")).toThrow();
  });
});
