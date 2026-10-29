/**
 * K11 dış denetim hazırlığı — SD-JWT disclosure / özet / birleşik biçim ve Token Status List bit dizisi için özellik (fuzz)
 * testleri (fast-check). Değişmezler:
 *  - disclosure üret → çöz: ad ve değer aynen döner; özet disclosure DİZESİNİN SHA-256'sıdır (C4/C14), tek karakter değişirse özet değişir
 *  - birleşik biçim `jwt~d1~…~kb` ayrıştırıp yeniden birleştirmek aynı dizeyi verir; boş parça reddedilir (Ş1)
 *  - yük + rastgele açılan alt küme → sonuç = açık alanlar ∪ açılan alanlar; gizli alan ve sahte özet görünmez; eşleşmeyen
 *    disclosure (C10), yinelenen özet (Ş6) RED
 *  - güvenilmeyen yük / disclosure: sonuç ya da `SdStructureError` — TypeError / RangeError / prototip değişikliği yok
 *  - bit dizisi (1/2/4/8 bit) sıkıştır → aç: her indeks aynı değeri verir; bozuk sıkıştırma ve zlib bombası D6, liste dışı indeks D6
 * Tekrar: `FC_SEED=<tohum> npx vitest run packages/sd-jwt/src/property.test.ts`.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { deflateSync } from "node:zlib";
import { decodeDisclosures, resolveSdPayload, SdStructureError } from "@tamga-network/core/sd-structure";
import { digestOf, makeArrayElementDisclosure, makeDisclosure, splitCombined } from "./disclosure.js";
import { MIN_CAPACITY, StatusBitstring, type StatusBits } from "./status-list.js";

const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined;
const RUNS = Number(process.env.FC_RUNS ?? 200);
const params = { numRuns: RUNS, ...(seed !== undefined ? { seed } : {}) };

const decodeJson = (d: string) => JSON.parse(Buffer.from(d, "base64url").toString("utf8"));
/** JSON'a giden değer (-0 → 0 gibi) */
const jsonNorm = (v: unknown) => JSON.parse(JSON.stringify(v));
const FORBIDDEN = new Set(["_sd", "_sd_alg", "...", "__proto__", "constructor", "prototype"]);
const claimName = fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !FORBIDDEN.has(s));
const jsonValue = fc.jsonValue({ maxDepth: 3 });

describe("K11 SD-JWT disclosure — özellikler", () => {
  it("üret → çöz: ad ve değer aynen döner; özet = SHA-256(dize)", () => {
    fc.assert(
      fc.property(claimName, jsonValue, (name, value) => {
        const d = makeDisclosure(name, value);
        const [dec] = decodeDisclosures([d.disclosure], digestOf, decodeJson);
        expect(dec.name).toBe(name);
        expect(dec.value).toEqual(jsonNorm(value));
        expect(dec.digest).toBe(digestOf(d.disclosure));
        expect(d.digest).toBe(dec.digest);
      }),
      params,
    );
  });

  it("dizi öğesi disclosure'ı ad taşımaz, değer aynen döner", () => {
    fc.assert(
      fc.property(jsonValue, (value) => {
        const d = makeArrayElementDisclosure("x[0]", value);
        const [dec] = decodeDisclosures([d.disclosure], digestOf, decodeJson);
        expect(dec.name).toBeUndefined();
        expect(dec.value).toEqual(jsonNorm(value));
      }),
      params,
    );
  });

  it("disclosure dizesinde tek karakter değişirse özet değişir (önce özet, sonra çöz — C14)", () => {
    fc.assert(
      fc.property(claimName, jsonValue, fc.nat(), (name, value, pos) => {
        const d = makeDisclosure(name, value).disclosure;
        const i = pos % d.length;
        const alt = d[i] === "A" ? "B" : "A";
        expect(digestOf(d.slice(0, i) + alt + d.slice(i + 1))).not.toBe(digestOf(d));
      }),
      params,
    );
  });

  it("birleşik biçim: ayrıştır → birleştir aynı dize; boş parça (~~) reddedilir", () => {
    const seg = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes("~"));
    fc.assert(
      fc.property(seg, fc.array(seg, { maxLength: 6 }), fc.option(seg, { nil: "" }), (jwt, ds, kb) => {
        const combined = [jwt, ...ds, kb].join("~");
        const s = splitCombined(combined);
        expect([s.jwt, ...s.disclosures, s.kb].join("~")).toBe(combined);
        if (ds.length) expect(() => splitCombined([jwt, ...ds, "", kb].join("~"))).toThrow(/Ş1/);
      }),
      params,
    );
  });

  it("rastgele dizeler: decodeDisclosures yalnız SdStructureError fırlatır", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 40 }), { maxLength: 4 }), (ds) => {
        try {
          decodeDisclosures(ds, digestOf, decodeJson);
        } catch (e) {
          expect(e).toBeInstanceOf(SdStructureError);
        }
      }),
      params,
    );
  });
});

describe("K11 seçici açıklama yapısı (resolveSdPayload) — özellikler", () => {
  const claims = fc.dictionary(claimName, jsonValue, { minKeys: 1, maxKeys: 8 });

  it("açık alanlar ∪ açılan alanlar = sonuç; gizli alan ve sahte özet görünmez", () => {
    fc.assert(
      fc.property(
        claims,
        fc.func(fc.constantFrom("plain", "sd-open", "sd-hidden")),
        fc.array(fc.string({ minLength: 43, maxLength: 43 }), { maxLength: 3 }),
        (cs, kind, decoys) => {
          const payload: Record<string, unknown> = { _sd_alg: "sha-256" };
          const sd: string[] = [...new Set(decoys)];
          const shown: string[] = [];
          const expected: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(cs)) {
            const how = kind(k);
            if (how === "plain") {
              payload[k] = v;
              expected[k] = jsonNorm(v);
            } else {
              const d = makeDisclosure(k, v);
              sd.push(d.digest);
              if (how === "sd-open") {
                shown.push(d.disclosure);
                expected[k] = jsonNorm(v);
              }
            }
          }
          payload._sd = sd;
          const dec = decodeDisclosures(shown, digestOf, decodeJson);
          const r = resolveSdPayload(jsonNorm(payload), dec);
          expect(r.claims).toEqual(expected);
          expect(r.resolved.map((x) => x.path).sort()).toEqual(dec.map((x) => x.name).sort());
        },
      ),
      params,
    );
  });

  it("yükte özeti olmayan disclosure (C10) ve yinelenen özet (Ş6) reddedilir", () => {
    fc.assert(
      fc.property(claimName, jsonValue, (k, v) => {
        const d = makeDisclosure(k, v);
        const dec = decodeDisclosures([d.disclosure], digestOf, decodeJson);
        expect(() => resolveSdPayload({ _sd: [] }, dec)).toThrow(/C10/);
        expect(() => resolveSdPayload({ _sd: [d.digest, d.digest] }, dec)).toThrow(SdStructureError);
        expect(() => resolveSdPayload({ _sd: [d.digest], nested: { _sd: [d.digest] } }, dec)).toThrow(SdStructureError);
      }),
      params,
    );
  });

  it("güvenilmeyen yük + disclosure: sonuç ya da SdStructureError; sonuç nesnelerinin prototipi değişmez", () => {
    const hostileKey = fc.constantFrom("_sd", "...", "__proto__", "constructor", "prototype", "_sd_alg");
    const anyPayload = fc.dictionary(fc.oneof(fc.string({ maxLength: 6 }), hostileKey), fc.jsonValue({ maxDepth: 4 }));
    fc.assert(
      fc.property(
        anyPayload,
        fc.array(fc.tuple(fc.oneof(claimName, hostileKey), jsonValue), { maxLength: 3 }),
        (p, ds) => {
          // JSON üzerinden: "__proto__" gerçek yükte olduğu gibi KENDİ anahtarı olarak gelsin
          const payload = JSON.parse(JSON.stringify(p));
          const discs = ds.map(([k, v]) => makeDisclosure(k, v));
          payload._sd = discs.map((d) => d.digest);
          try {
            const dec = decodeDisclosures(
              discs.map((d) => d.disclosure),
              digestOf,
              decodeJson,
            );
            const r = resolveSdPayload(payload, dec);
            const check = (v: unknown): void => {
              if (Array.isArray(v)) return v.forEach(check);
              if (v && typeof v === "object") {
                expect(Object.getPrototypeOf(v)).toBe(Object.prototype);
                Object.values(v).forEach(check);
              }
            };
            check(r.claims);
          } catch (e) {
            expect(e).toBeInstanceOf(SdStructureError);
          }
        },
      ),
      params,
    );
  });

  it("açık (seçici olmayan) iç içe `__proto__` anahtarı reddedilir — kalıtımla görünen alan yok", () => {
    expect(() => resolveSdPayload(JSON.parse('{"a":{"__proto__":{"age_over_18":true}}}'), [])).toThrow(/__proto__/);
    expect(() => resolveSdPayload(JSON.parse('{"__proto__":{"x":1}}'), [])).toThrow(/__proto__/);
  });

  it("aşırı iç içe yük yığın taşmadan reddedilir", () => {
    let deep: unknown = 1;
    for (let i = 0; i < 10_000; i++) deep = { a: deep };
    expect(() => resolveSdPayload(deep as Record<string, unknown>, [])).toThrow(/nesting limit/);
  });
});

describe("K11 Token Status List bit dizisi — özellikler", () => {
  const bitsArb = fc.constantFrom<StatusBits>(1, 2, 4, 8);

  it("sıkıştır → aç: bütün yazılan indeksler aynı değeri, ötekiler 0 verir (1/2/4/8 bit)", () => {
    fc.assert(
      fc.property(
        bitsArb,
        fc.uniqueArray(fc.integer({ min: 0, max: MIN_CAPACITY - 1 }), { maxLength: 40 }),
        fc.infiniteStream(fc.nat()),
        (bits, idxs, vals) => {
          const s = new StatusBitstring(MIN_CAPACITY, undefined, bits);
          const want = new Map<number, number>();
          for (const i of idxs) {
            const v = vals.next().value % (1 << bits);
            s.set(i, v);
            want.set(i, v);
          }
          const back = StatusBitstring.fromLst(s.encodeLst(), MIN_CAPACITY, bits);
          for (const [i, v] of want) expect(back.get(i)).toBe(v);
          expect(back.get(MIN_CAPACITY - 1)).toBe(want.get(MIN_CAPACITY - 1) ?? 0);
          expect(() => back.get(back.entries)).toThrow(/^D6:/);
          expect(() => back.get(-1)).toThrow(/^D6:/);
        },
      ),
      { ...params, numRuns: 60 },
    );
  });

  it("aralık dışı değer yazılamaz (bit sayısına göre)", () => {
    fc.assert(
      fc.property(bitsArb, fc.integer({ min: 0, max: 1000 }), (bits, extra) => {
        const s = new StatusBitstring(MIN_CAPACITY, undefined, bits);
        expect(() => s.set(0, ((1 << bits) + extra) as never)).toThrow(/out of range/);
      }),
      params,
    );
  });

  it("bozuk sıkıştırma: yalnız D6 hatası (ya da geçerli bir bit dizisi)", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 256 }), bitsArb, (data, bits) => {
        try {
          const s = StatusBitstring.fromCompressed(data, MIN_CAPACITY, bits);
          expect(s.bytes).toBeInstanceOf(Uint8Array);
        } catch (e) {
          expect((e as Error).message).toMatch(/^D6:|capacity|bits/);
        }
      }),
      params,
    );
  });

  it("geçerli sıkıştırmanın kesilmiş / bozulmuş hâli D6 ile reddedilir ya da farklı bayt verir — çökme yok", () => {
    const good = new StatusBitstring(MIN_CAPACITY, undefined, 2);
    good.set(7, 1);
    const z = good.compressed();
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 255 }), fc.boolean(), (pos, byte, cut) => {
        const b = Uint8Array.from(z);
        const i = pos % b.length;
        const m = cut ? b.subarray(0, i) : (b.set([byte], i), b);
        try {
          StatusBitstring.fromCompressed(m, MIN_CAPACITY, 2);
        } catch (e) {
          expect((e as Error).message).toMatch(/^D6:|capacity/);
        }
      }),
      params,
    );
  });

  it("zlib bombası (12 MB sıfır → birkaç KB) sınırda durur: D6, 2 sn içinde", () => {
    const bomb = new Uint8Array(deflateSync(Buffer.alloc(12 * 1024 * 1024), { level: 9 }));
    expect(bomb.length).toBeLessThan(64 * 1024);
    const t = performance.now();
    expect(() => StatusBitstring.fromCompressed(bomb, MIN_CAPACITY, 8)).toThrow(/^D6: .*maximum size/);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
