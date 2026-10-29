/**
 * K11 dış denetim hazırlığı — doğrulayıcının yanıt zarfı için özellik (fuzz) testleri (fast-check):
 *  - `responseKidOf`: her dizede çökmez; `encKid` → `responseKidOf` gidiş-dönüşü sunum, yol ve dalı aynen verir (ADR-0067)
 *  - JWE başlığı (OpenID4VP 1.0 §8.3, HAIP §5): yalnız `ECDH-ES` + `A128GCM`/`A256GCM`; başka `alg`/`enc` reddedilir
 *  - çözülmüş gövde: `vp_token` = { kimlik: boş olmayan dize dizisi }, `state`/`pass_key` dize — rastgele gövde ya kurala uyar
 *    ya da Error (biçim dışı gövde doğrulamaya geçmez)
 * Tekrar: `FC_SEED=<tohum> npx vitest run packages/verifier/src/property.test.ts`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { CompactEncrypt } from "jose";
import { decryptResponse, encKid, responseKidOf } from "./request.js";

const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined;
const RUNS = Number(process.env.FC_RUNS ?? 200);
const params = { numRuns: RUNS, ...(seed !== undefined ? { seed } : {}) };

let pub: KeyObject;
let priv: KeyObject;
beforeAll(() => {
  const k = generateKeyPairSync("ec", { namedCurve: "P-256" });
  pub = k.publicKey;
  priv = k.privateKey;
});
const enc = (body: unknown, alg = "ECDH-ES", e = "A128GCM") =>
  new CompactEncrypt(new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body)))
    .setProtectedHeader({ alg, enc: e, kid: "enc-prs_x" })
    .encrypt(pub);

describe("K11 yanıt kid'i — özellikler", () => {
  it("rastgele dize ve rastgele başlık: responseKidOf çökmez (sonuç ya da null)", () => {
    const hdr = fc
      .oneof(fc.jsonValue(), fc.record({ kid: fc.oneof(fc.string(), fc.jsonValue()) }))
      .map((h) => Buffer.from(JSON.stringify(h)).toString("base64url"));
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          hdr.map((h) => `${h}.x.y.z.w`),
        ),
        (s) => {
          const r = responseKidOf(s);
          if (r) expect(["cross_device", "dc_api"]).toContain(r.path);
        },
      ),
      params,
    );
  });

  it("encKid → responseKidOf gidiş-dönüş (sunum kimliği, yol, dal)", () => {
    const id = fc.stringMatching(/^prs_[A-Za-z0-9_-]{4,24}$/);
    const branch = fc.option(fc.stringMatching(/^[A-Za-z0-9_-]{1,16}$/), { nil: undefined });
    fc.assert(
      fc.property(
        id,
        fc.constantFrom("cross_device", "dc_api") as fc.Arbitrary<"cross_device" | "dc_api">,
        branch,
        (p, path, b) => {
          const kid = encKid(p, path, b);
          const jwe = `${Buffer.from(JSON.stringify({ alg: "ECDH-ES", kid })).toString("base64url")}.a.b.c.d`;
          const r = responseKidOf(jwe)!;
          expect(r.presentationId).toBe(p);
          expect(r.path).toBe(path);
          if (path === "cross_device" && b) expect(r.branchId).toBe(b);
          else expect(r.branchId).toBeUndefined();
        },
      ),
      params,
    );
  });
});

describe("K11 JWE başlığı ve gövdesi — özellikler", () => {
  it("profil dışı alg/enc reddedilir; ECDH-ES + A128GCM/A256GCM açılır", async () => {
    const body = { vp_token: { q: ["x~"] }, state: "s" };
    for (const e of ["A128GCM", "A256GCM"])
      expect((await decryptResponse(await enc(body, "ECDH-ES", e), priv)).state).toBe("s");
    for (const [alg, e] of [
      ["ECDH-ES+A128KW", "A128GCM"],
      ["ECDH-ES+A256KW", "A256GCM"],
      ["ECDH-ES", "A192GCM"],
      ["ECDH-ES", "A128CBC-HS256"],
      ["ECDH-ES", "A256CBC-HS512"],
    ])
      await expect(decryptResponse(await enc(body, alg, e), priv), `${alg}/${e}`).rejects.toThrow();
  });

  it("rastgele gövde: ya kurala uyan yanıt ya da Error", async () => {
    const bodyArb = fc.oneof(
      fc.jsonValue({ maxDepth: 3 }),
      fc.record(
        {
          vp_token: fc.oneof(
            fc.jsonValue({ maxDepth: 2 }),
            fc.dictionary(
              fc.string({ maxLength: 4 }),
              fc.array(fc.oneof(fc.string(), fc.jsonValue()), { maxLength: 3 }),
            ),
          ),
          state: fc.jsonValue({ maxDepth: 1 }),
          pass_key: fc.jsonValue({ maxDepth: 1 }),
        },
        { requiredKeys: [] },
      ),
      fc.string(),
    );
    await fc.assert(
      fc.asyncProperty(bodyArb, async (b) => {
        let r;
        try {
          r = await decryptResponse(await enc(b), priv);
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
          return;
        }
        expect(r.vp_token && typeof r.vp_token === "object" && !Array.isArray(r.vp_token)).toBe(true);
        for (const v of Object.values(r.vp_token)) {
          expect(Array.isArray(v) && v.length > 0).toBe(true);
          for (const x of v) expect(typeof x === "string" && x.length > 0).toBe(true);
        }
        if (r.state !== undefined) expect(typeof r.state).toBe("string");
        if (r.pass_key !== undefined) expect(typeof r.pass_key).toBe("string");
      }),
      { ...params, numRuns: 100 },
    );
  });

  it("rastgele dize JWE olarak verilirse Error (çözülemez)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(),
          fc.array(fc.base64String(), { minLength: 5, maxLength: 5 }).map((p) => p.join(".")),
        ),
        async (s) => {
          await expect(decryptResponse(s, priv)).rejects.toThrow();
        },
      ),
      { ...params, numRuns: 100 },
    );
  });
});
