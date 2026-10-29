/**
 * K11 dış denetim hazırlığı — cüzdan çekirdeğinin güvenilmeyen girdileri için özellik (fuzz) testleri (fast-check):
 *  - DCQL (OpenID4VP 1.0 §6): rastgele sorgu `checkDcqlShape`'ten ya geçer ya da `WalletError` ile döner (TypeError yok);
 *    geçen sorguda `matchDcql` çökmez; eşleşme SAĞLAMDIR (tür sorgudaki `vct_values`'ta, istenen her alan belgede, `values`
 *    koşulu tutuyor, istenen alan sorguda geçiyor — fazla açıklama yok), iptal / askı / yerelde iptal belge hiç önerilmez;
 *    eşleşen + eşleşmeyen = sorgu kimlikleri
 *  - JWS: rastgele dize `decodeJwt` / `verifyJwt`'te Error; doğru imzalı ama `alg` ES256 olmayan başlık reddedilir (C1)
 *  - Status List: `statusBitAt` 1/2/4/8 bitte yazılan değeri okur (8 bitlik CWT listesinde komşu belgenin biti okunmaz),
 *    3'ten büyük değer 3 (geçersiz) döner, liste dışı indeks hata
 * Tekrar: `FC_SEED=<tohum> npx vitest run packages/wallet-core/src/property.test.ts`.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { p256 } from "@noble/curves/nist.js";
import { checkDcqlShape, matchDcql, selectDcql, type DcqlQuery } from "./oid4vp.js";
import { WalletError } from "./http.js";
import { decodeJwt, verifyJwt } from "./jws.js";
import { statusBitAt, type StatusList } from "./status.js";
import type { StoredCredential } from "./store.js";

const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined;
const RUNS = Number(process.env.FC_RUNS ?? 300);
const params = { numRuns: RUNS, ...(seed !== undefined ? { seed } : {}) };

const VCTS = ["urn:tamga:edu:Diploma:1", "urn:tamga:id:Email:1", "urn:eudi:pid:1"];
const NAMES = ["degree", "email", "given_name", "age_over_18", "nationality"];
const VALUES = ["BSc", "MSc", true, false, "TR", 18];

const credArb: fc.Arbitrary<StoredCredential> = fc
  .record({
    id: fc.uuid(),
    vct: fc.constantFrom(...VCTS),
    claims: fc.dictionary(fc.constantFrom(...NAMES), fc.constantFrom(...VALUES), { maxKeys: 4 }),
    status: fc.option(fc.constantFrom("valid", "suspended", "revoked", "unknown"), { nil: undefined }),
    revokedLocally: fc.option(fc.boolean(), { nil: undefined }),
  })
  .map(
    (r) =>
      ({
        id: r.id,
        vct: r.vct,
        claims: r.claims,
        copies: [{ combined: "e30.e30.sig~", keyRef: "k", usedBy: [] }],
        ...(r.status ? { status: { value: r.status, checkedAt: 0 } } : {}),
        ...(r.revokedLocally !== undefined ? { revokedLocally: r.revokedLocally } : {}),
      }) as unknown as StoredCredential,
  );

/** Biçimce doğru sd-jwt sorgusu (eşleştirici sağlamlığı için) */
const goodQueryArb: fc.Arbitrary<DcqlQuery> = fc
  .uniqueArray(
    fc.record({
      id: fc.stringMatching(/^[a-z][a-z0-9_]{0,5}$/),
      vcts: fc.subarray(VCTS, { minLength: 1 }),
      claims: fc.option(
        fc.uniqueArray(
          fc.record({
            name: fc.constantFrom(...NAMES),
            values: fc.option(fc.subarray(VALUES, { minLength: 1 }), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 3, selector: (c) => c.name },
        ),
        { nil: undefined },
      ),
    }),
    { minLength: 1, maxLength: 3, selector: (q) => q.id },
  )
  .map((qs) => ({
    credentials: qs.map((q) => ({
      id: q.id,
      format: "dc+sd-jwt",
      meta: { vct_values: q.vcts },
      ...(q.claims
        ? { claims: q.claims.map((c) => ({ path: [c.name], ...(c.values ? { values: c.values } : {}) })) }
        : {}),
    })),
  }));

/** Saldırganın imzaladığı istekteki dcql_query: biçimi tamamen rastgele */
const hostileDcqlArb = fc.oneof(
  fc.anything(),
  fc.record({ credentials: fc.anything() }),
  fc.record({
    credentials: fc.array(
      fc.oneof(
        fc.anything(),
        fc.record(
          {
            id: fc.oneof(fc.string(), fc.anything()),
            format: fc.constantFrom("dc+sd-jwt", "mso_mdoc", "mso_mdoc_zk", "tamga-pseudonym", "x"),
            meta: fc.oneof(fc.anything(), fc.record({ vct_values: fc.anything(), doctype_value: fc.anything() })),
            claims: fc.oneof(
              fc.anything(),
              fc.array(
                fc.oneof(fc.anything(), fc.record({ id: fc.anything(), path: fc.anything(), values: fc.anything() })),
              ),
            ),
            claim_sets: fc.anything(),
            trusted_authorities: fc.anything(),
          },
          { requiredKeys: [] },
        ),
      ),
      { maxLength: 3 },
    ),
    credential_sets: fc.anything(),
  }),
);

describe("K11 DCQL — özellikler", () => {
  it("rastgele dcql_query: checkDcqlShape geçer ya da WalletError; geçerse matchDcql/selectDcql çökmez", () => {
    fc.assert(
      fc.property(hostileDcqlArb, fc.array(credArb, { maxLength: 4 }), (q, creds) => {
        try {
          checkDcqlShape(q as DcqlQuery);
        } catch (e) {
          expect(e).toBeInstanceOf(WalletError);
          return;
        }
        const r = matchDcql(q as DcqlQuery, creds);
        selectDcql(q as DcqlQuery, r.matches);
      }),
      { ...params, numRuns: RUNS * 3 },
    );
  });

  it("eşleşme sağlam: tür, alan varlığı, değer koşulu; fazla alan istenmez; iptal/askı önerilmez; kimlikler bölünür", () => {
    fc.assert(
      fc.property(goodQueryArb, fc.array(credArb, { maxLength: 6 }), (q, creds) => {
        checkDcqlShape(q);
        const r = matchDcql(q, creds);
        for (const m of r.matches) {
          const query = q.credentials.find((x) => x.id === m.queryId)!;
          const c = m.credential;
          expect(query.meta!.vct_values).toContain(c.vct);
          expect(c.revokedLocally).not.toBe(true);
          expect(["revoked", "suspended"]).not.toContain(c.status?.value);
          const asked = (query.claims ?? []).map((cl) => String(cl.path[0]));
          for (const name of m.requested) {
            expect(asked).toContain(name);
            expect(Object.prototype.hasOwnProperty.call(c.claims, name)).toBe(true);
            const cl = query.claims!.find((x) => x.path[0] === name)!;
            if (cl.values) expect(cl.values).toContainEqual(c.claims[name]);
          }
        }
        const ids = q.credentials.map((x) => x.id).sort();
        expect([...new Set([...r.matches.map((m) => m.queryId), ...r.unmatched])].sort()).toEqual(ids);
        expect(r.gaps.map((g) => g.queryId)).toEqual(r.unmatched);
      }),
      params,
    );
  });

  it("biçim dışı claim yolu ve null sorgu öğesi WalletError ile reddedilir (önceden TypeError)", () => {
    const base = { id: "q", format: "dc+sd-jwt", meta: { vct_values: ["urn:x"] } };
    for (const bad of [
      { credentials: [null] },
      { credentials: "abc" },
      { credentials: [{ ...base, claims: [null] }] },
      { credentials: [{ ...base, claims: [{ path: "degree" }] }] },
      { credentials: [{ ...base, claims: [{ path: [] }] }] },
      { credentials: [{ ...base, claims: [{ path: [-1] }] }] },
      { credentials: [{ ...base, claims: [{ path: [{}] }] }] },
      { credentials: [{ ...base, claims: [{ path: ["a"], values: [] }] }] },
      { credentials: [{ ...base, claims: "x" }] },
      { credentials: [{ ...base, meta: "x" }] },
    ])
      expect(() => checkDcqlShape(bad as never), JSON.stringify(bad)).toThrow(WalletError);
  });
});

describe("K11 JWS — özellikler", () => {
  const sk = p256.utils.randomSecretKey();
  const pub = p256.getPublicKey(sk, false);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signed = (header: Record<string, unknown>, payload: Record<string, unknown>) => {
    const input = `${b64(header)}.${b64(payload)}`;
    const sig = p256.sign(new TextEncoder().encode(input), sk, { prehash: true, format: "compact" });
    return `${input}.${Buffer.from(sig).toString("base64url")}`;
  };

  it("rastgele dize: decodeJwt / verifyJwt Error fırlatır (geçerli imza yok)", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.array(fc.base64String(), { maxLength: 4 }).map((p) => p.join(".")),
        ),
        (s) => {
          expect(() => verifyJwt(s, pub)).toThrow(Error);
          try {
            decodeJwt(s);
          } catch (e) {
            expect(e).toBeInstanceOf(Error);
          }
        },
      ),
      params,
    );
  });

  it("doğru imzalı ama alg ES256 olmayan başlık reddedilir (alg karışıklığı, C1)", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom("none", "HS256", "ES384", "ES256K", "RS256", "EdDSA", "es256", ""), fc.string()),
        fc.dictionary(fc.string({ maxLength: 6 }), fc.jsonValue({ maxDepth: 1 })),
        (alg, payload) => {
          fc.pre(alg !== "ES256");
          expect(() => verifyJwt(signed({ alg }, payload), pub)).toThrow(/C1/);
        },
      ),
      params,
    );
  });

  it("ES256 imzalı JWT doğrulanır; tek bayt değişirse reddedilir", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ maxLength: 6 }), fc.jsonValue({ maxDepth: 2 })),
        fc.nat(),
        (payload, pos) => {
          const jwt = signed({ alg: "ES256", typ: "x" }, payload);
          expect(verifyJwt(jwt, pub).payload).toEqual(JSON.parse(JSON.stringify(payload)));
          const sigStart = jwt.lastIndexOf(".") + 1;
          const i = sigStart + (pos % (jwt.length - sigStart - 1));
          const tampered = jwt.slice(0, i) + (jwt[i] === "A" ? "B" : "A") + jwt.slice(i + 1);
          expect(() => verifyJwt(tampered, pub)).toThrow();
        },
      ),
      { ...params, numRuns: 100 },
    );
  });
});

describe("K11 Status List bit okuma — özellikler", () => {
  const listOf = (bits: number, bytes: Uint8Array): StatusList => ({
    uri: "u",
    bits,
    bytes,
    signerFingerprint: "",
    iss: "",
  });
  const write = (bits: number, bytes: Uint8Array, idx: number, v: number) => {
    const per = 8 / bits;
    const shift = (idx % per) * bits;
    const mask = (1 << bits) - 1;
    bytes[Math.floor(idx / per)] = (bytes[Math.floor(idx / per)] & ~(mask << shift)) | ((v & mask) << shift);
  };

  it("1/2/4/8 bit: yazılan değer (3'ten büyükse 3) okunur; komşu indeks etkilenmez; liste dışı indeks hata", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2, 4, 8),
        fc.integer({ min: 1, max: 64 }),
        fc.nat(),
        fc.nat(),
        (bits, len, i0, v0) => {
          const bytes = new Uint8Array(len);
          const entries = (len * 8) / bits;
          const idx = i0 % entries;
          const v = v0 % (1 << bits);
          write(bits, bytes, idx, v);
          const l = listOf(bits, bytes);
          expect(statusBitAt(l, idx)).toBe(Math.min(v, 3));
          for (const n of [idx - 1, idx + 1]) if (n >= 0 && n < entries) expect(statusBitAt(l, n)).toBe(0);
          expect(() => statusBitAt(l, entries)).toThrow(/outside/);
          expect(() => statusBitAt(l, -1)).toThrow(/outside/);
        },
      ),
      params,
    );
  });

  it("8 bitlik listede indeks 1'deki iptal (1) okunur — eski 2 bit okuma bunu 0 (geçerli) görürdü", () => {
    const l = listOf(8, Uint8Array.from([0, 1, 0, 0]));
    expect(statusBitAt(l, 1)).toBe(1);
    expect(statusBitAt(l, 0)).toBe(0);
  });

  it("tanımsız bit sayısı reddedilir", () => {
    for (const bits of [0, 3, 5, 16]) expect(() => statusBitAt(listOf(bits, new Uint8Array(4)), 0)).toThrow(/bits/);
  });
});
