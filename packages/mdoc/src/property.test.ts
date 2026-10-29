/**
 * K11 dış denetim hazırlığı — CBOR çözücüsü ve Status List CWT ayrıştırıcısı için özellik (fuzz) testleri (fast-check).
 * Değişmezler: (1) kanonik kodlama kararlıdır: encode(decode(encode(v))) = encode(v); (2) güvenilmeyen bayt dizisi ya
 * bir değer döndürür ya da `Error` fırlatır — çökme, sonsuz döngü, girdiden büyük bellek ayırma yok; (3) aşırı iç içelik ve
 * girdiden uzun uzunluk bildirimi sınırlı sürede reddedilir; (4) Status List CWT'sinin her bozulmuş hâli D3/D4/D6 önekli
 * bir hatayla reddedilir ve imzası bozulmuş liste hiçbir zaman kabul edilmez.
 * Tekrar: `FC_SEED=<tohum> npx vitest run packages/mdoc/src/property.test.ts` (başarısız koşunun tohumu hata iletisinde).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { deflateSync } from "node:zlib";
import { p256 } from "@noble/curves/nist.js";
import { CborTag, decode, encode, type CborValue } from "./cbor.js";
import { parseStatusListCwt, rawStatusListSigner, signStatusListCwt } from "./status-list-cwt.js";

const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined;
const RUNS = Number(process.env.FC_RUNS ?? 300);
const params = { numRuns: RUNS, ...(seed !== undefined ? { seed } : {}) };

/** Kodlayıcının desteklediği alt küme: güvenli tamsayı, dize, bayt, bool, null, dizi, Map (dize/tamsayı anahtar), etiket. */
const cborValue: fc.Arbitrary<CborValue> = fc.letrec<{ v: CborValue }>((tie) => ({
  v: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.maxSafeInteger(),
    fc.string({ unit: "grapheme", maxLength: 24 }),
    fc.uint8Array({ maxLength: 32 }),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie("v"), { maxLength: 5 }),
    fc
      .uniqueArray(fc.tuple(fc.oneof(fc.string({ maxLength: 8 }), fc.integer({ min: -1000, max: 1000 })), tie("v")), {
        maxLength: 5,
        selector: ([k]) => (typeof k === "number" ? `n${k}` : `s${k}`),
      })
      .map((es) => new Map<CborValue, CborValue>(es)),
    fc.tuple(fc.integer({ min: 0, max: 2 ** 32 - 1 }), tie("v")).map(([t, v]) => new CborTag(t, v)),
  ),
})).v;

/** Çözücü sözleşmesi: değer ya da Error; başka bir şey (ör. undefined fırlatma) ya da çökme yok. */
function decodeOrError(bytes: Uint8Array): "ok" | "error" {
  try {
    decode(bytes);
    return "ok";
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
    return "error";
  }
}

describe("K11 CBOR çözücüsü — özellikler", () => {
  it("kanonik kodlama kararlı: encode(decode(encode(v))) = encode(v)", () => {
    fc.assert(
      fc.property(cborValue, (v) => {
        const once = encode(v);
        const twice = encode(decode(once));
        expect(Buffer.from(twice).equals(Buffer.from(once))).toBe(true);
      }),
      params,
    );
  });

  it("rastgele bayt dizisi: değer ya da Error, her girdi 50 ms içinde", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 512 }), (b) => {
        const t = performance.now();
        decodeOrError(b);
        expect(performance.now() - t).toBeLessThan(50);
      }),
      { ...params, numRuns: RUNS * 4 },
    );
  });

  it("geçerli kodlamanın bozulmuş hâlleri (bayt değiştir / kes / ekle) çökmez", () => {
    fc.assert(
      fc.property(
        cborValue,
        fc.nat(),
        fc.integer({ min: 0, max: 255 }),
        fc.constantFrom("flip", "truncate", "insert"),
        (v, pos, byte, op) => {
          const b = Array.from(encode(v));
          const i = b.length ? pos % b.length : 0;
          if (op === "flip" && b.length) b[i] = byte;
          else if (op === "truncate") b.length = i;
          else b.splice(i, 0, byte);
          decodeOrError(Uint8Array.from(b));
        },
      ),
      params,
    );
  });

  it("girdiden uzun uzunluk bildirimi bellek ayırmadan reddedilir (bstr / dizi / map, 1–8 baytlık uzunluk)", () => {
    for (const major of [2, 3, 4, 5]) {
      for (const [info, n] of [
        [26, 4],
        [27, 8],
      ] as const) {
        const head = [(major << 5) | info, ...Array(n).fill(0xff)];
        expect(() => decode(Uint8Array.from(head))).toThrow(/truncated|invalid length/);
      }
    }
  });

  it("aşırı iç içelik (100 000 düzey dizi / etiket) yığın taşmadan reddedilir", () => {
    const deepArr = new Uint8Array(100_001).fill(0x81);
    deepArr[100_000] = 0x00;
    expect(() => decode(deepArr)).toThrow(/nesting limit/);
    const deepTag = new Uint8Array(100_001).fill(0xc0);
    deepTag[100_000] = 0x00;
    expect(() => decode(deepTag)).toThrow(/nesting limit/);
  });

  it("belirsiz uzunluk, yinelenen map anahtarı ve sondaki fazla bayt reddedilir", () => {
    expect(() => decode(Uint8Array.from([0x9f, 0x01, 0xff]))).toThrow(/indefinite/);
    expect(() => decode(Uint8Array.from([0xa2, 0x41, 0x61, 0x01, 0x41, 0x61, 0x02]))).toThrow(/duplicate/);
    expect(() => decode(Uint8Array.from([0x01, 0x02]))).toThrow(/trailing/);
  });
});

describe("K11 Status List CWT ayrıştırıcısı — özellikler", () => {
  const sk = p256.utils.randomSecretKey();
  const pub = p256.getPublicKey(sk, false);
  const leaf = Uint8Array.from([0x30, 0x03, 0x02, 0x01, 0x01]); // ayrıştırıcı için opak; anahtarı publicKeyOf verir
  const URI = "https://status.example/0f1e2d3c4b5a6978";
  const NOW = 1_790_000_000;
  const P = { uri: URI, now: NOW, publicKeyOf: () => pub };
  const sign = (bits: number, lst: Uint8Array, iat = NOW - 10, exp = NOW + 3600) =>
    signStatusListCwt({ uri: URI, bits, lst, iat, exp, ttl: 3600, x5chain: [leaf], sign: rawStatusListSigner(sk) });

  it("geçerli liste bit sayısı ve lst ile aynen okunur (bits 1/2)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(1, 2), fc.uint8Array({ minLength: 1, maxLength: 64 }), async (bits, raw) => {
        const lst = new Uint8Array(deflateSync(raw));
        const c = parseStatusListCwt(await sign(bits, lst), P);
        expect(c.bits).toBe(bits);
        expect(Buffer.from(c.lst).equals(Buffer.from(lst))).toBe(true);
      }),
      { ...params, numRuns: 50 },
    );
  });

  it("imzalı CWT'nin her bozulmuş hâli D3/D4/D6 hatasıyla reddedilir ya da (yalnız imzasız alanda) aynı içeriği verir", async () => {
    const good = await sign(2, new Uint8Array(deflateSync(new Uint8Array(32))));
    const ref = parseStatusListCwt(good, P);
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 255 }),
        fc.constantFrom("flip", "truncate", "insert"),
        (pos, byte, op) => {
          const b = Array.from(good);
          const i = pos % b.length;
          if (op === "flip") b[i] = byte;
          else if (op === "truncate") b.length = i;
          else b.splice(i, 0, byte);
          try {
            const c = parseStatusListCwt(Uint8Array.from(b), P);
            // Kabul edildiyse imzalı içerik değişmemiştir (ör. korunmayan başlık ya da etiket baytı): sonuç aynı olmalı
            expect(c.bits).toBe(ref.bits);
            expect(Buffer.from(c.lst).equals(Buffer.from(ref.lst))).toBe(true);
            expect(c.iat).toBe(ref.iat);
          } catch (e) {
            expect((e as Error).message).toMatch(/^D[346]:/);
          }
        },
      ),
      params,
    );
  });

  it("rastgele bayt dizisi: yalnız D3/D4/D6 önekli hata", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 256 }), (b) => {
        expect(() => parseStatusListCwt(b, P)).toThrow(/^D[346]:/);
      }),
      params,
    );
  });

  it("başka anahtarla imzalanmış liste reddedilir (D3)", async () => {
    const other = p256.getPublicKey(p256.utils.randomSecretKey(), false);
    const good = await sign(1, new Uint8Array(deflateSync(new Uint8Array(8))));
    expect(() => parseStatusListCwt(good, { ...P, publicKeyOf: () => other })).toThrow(/^D3: .*signature/);
  });
});
