/**
 * SD-JWT VC — cüzdan tarafı (SPEC-CRED-0002): alınan belgenin yerel doğrulaması (A1–A5 + cnf eşleşmesi) ve sunum (KB-JWT).
 * @tamga-network/sd-jwt'nin Node'a bağımlı (jose/x509) parçalarının RN uyumlu karşılığı; aynı kurallar, aynı adım kodları.
 * Zincir/liste kontrolü (C), şema (B4 katalog hash) ve status (D) burada YOK — B4 için isteğe bağlı catalogueHash geri çağrısı.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { certP256Point } from "./asn1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { b64Decode, b64u, b64uDecode, b64uToUtf8, concat, toHex, utf8 } from "./b64.js";
import { sameJwk, verifyEs256, type KeyProvider, type PublicJwk } from "./keys.js";
import { decodeJwt, signJwt } from "./jws.js";
import {
  decodeDisclosures,
  resolveSdPayload,
  SdStructureError,
  selectDisclosuresForPaths,
} from "@tamga-network/core/sd-structure";

export const SD_JWT_TYP = "dc+sd-jwt";
export const KB_JWT_TYP = "kb+jwt";
export const SD_ALG = "sha-256";

export interface Disclosure {
  disclosure: string;
  digest: string;
  name: string;
  value: unknown;
}

export function splitCombined(combined: string): { jwt: string; disclosures: string[]; kb: string } {
  const parts = combined.split("~");
  if (parts.length < 2) throw new Error("Ş1: missing ~ separator");
  return { jwt: parts[0], disclosures: parts.slice(1, -1).filter((d) => d.length > 0), kb: parts[parts.length - 1] };
}
export const digestOf = (disclosure: string) => b64u(sha256(utf8(disclosure))); // C4/C14: dizenin baytları
export function decodeDisclosure(d: string): Disclosure {
  const arr = JSON.parse(b64uToUtf8(d));
  if (!Array.isArray(arr) || arr.length !== 3) throw new Error("Ş5d: disclosure is not a 3-element array");
  const [salt, name, value] = arr as [string, string, unknown];
  if (typeof salt !== "string" || b64uDecode(salt).length < 16) throw new Error("Ş5e: salt < 128 bits");
  if (typeof name !== "string") throw new Error("Ş5d: claim name is not a string");
  return { disclosure: d, digest: digestOf(d), name, value };
}
export function sdHashOf(withoutKb: string): string {
  if (!withoutKb.endsWith("~")) throw new Error("C9: sd_hash input must end with ~");
  return b64u(sha256(utf8(withoutKb)));
}

/** X.509 DER içinden P-256 SPKI açık anahtar noktasını (65 bayt) çıkarır — DER yapısı izlenerek (S-12; `asn1.ts`). */
export function p256PointFromCertDer(der: Uint8Array): Uint8Array {
  return certP256Point(der);
}
export const certFingerprintHex = (der: Uint8Array) => toHex(sha256(der));
export const computeIssuerId = (stateCode: string, leafDer: Uint8Array) =>
  "0x" + toHex(keccak_256(concat(utf8(stateCode), sha256(leafDer))));
export const computeSchemaId = (vct: string) => "0x" + toHex(keccak_256(utf8(vct)));

/** Seçici açıklanamayan claim adları (SD-JWT VC §3.2.2.2; doğrulayıcıdaki NON_SELECTIVE_CLAIMS ile aynı küme). */
const NON_SELECTIVE = new Set([
  "iss",
  "nbf",
  "exp",
  "iat",
  "cnf",
  "vct",
  "vct#integrity",
  "status",
  "category",
  "_sd",
  "_sd_alg",
  "...",
  "__proto__",
  "constructor",
  "prototype",
]);

export type Step = "A1" | "A2" | "A3" | "A4" | "A5" | "B4";
export interface LocalVerifyOptions {
  expectedCnf?: PublicJwk; // cüzdanın kendi anahtarı (kopya bu anahtara mı bağlı?)
  stateCode?: string; // issuer_id türetimi (varsayılan TR)
  catalogueHash?: (vct: string) => string | string[] | undefined; // B4: vct#integrity ↔ katalog (ADR-0010 K4 sürümler)
  now?: number;
}
export interface LocalVerifyOk {
  ok: true;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  claims: Record<string, unknown>;
  disclosures: Disclosure[];
  issuerId: string;
  leafFingerprint: string;
  leafDer: Uint8Array;
  iss: string;
  vct: string;
  vctIntegrity: string;
  iat: number;
  exp?: number;
  status?: { status_list: { idx: number; uri: string } };
  category?: string;
  cnf: PublicJwk;
  checks: Step[];
}
export interface LocalVerifyFail {
  ok: false;
  failedStep: Step;
  reason: string;
  checks: Step[];
}

export function verifyIssuedSdJwt(combined: string, opt: LocalVerifyOptions = {}): LocalVerifyOk | LocalVerifyFail {
  const checks: Step[] = [];
  const fail = (failedStep: Step, reason: string): LocalVerifyFail => ({ ok: false, failedStep, reason, checks });
  const now = opt.now ?? Math.floor(Date.now() / 1000);
  let parts: ReturnType<typeof splitCombined>;
  try {
    parts = splitCombined(combined);
  } catch (e) {
    return fail("A1", (e as Error).message);
  }
  if (parts.kb) return fail("A1", "issuance format must not contain a KB-JWT");
  checks.push("A1");
  let jwt: ReturnType<typeof decodeJwt>;
  try {
    jwt = decodeJwt(parts.jwt);
  } catch {
    return fail("A2", "JWT could not be decoded");
  }
  const h = jwt.header;
  if (h.alg !== "ES256") return fail("A2", `alg=${String(h.alg)} (C1)`);
  if (h.typ !== SD_JWT_TYP) return fail("A2", `typ=${String(h.typ)} (C13)`);
  const x5c = h.x5c as string[] | undefined;
  if (!x5c?.length) return fail("A2", "x5c missing (C7)");
  checks.push("A2");
  let leafDer: Uint8Array;
  try {
    leafDer = b64Decode(x5c[0]);
    const pub = p256PointFromCertDer(leafDer);
    if (!verifyEs256(jwt.signature, utf8(jwt.signingInput), pub)) return fail("A3", "issuer signature invalid");
  } catch (e) {
    return fail("A3", (e as Error).message);
  }
  const p = jwt.payload;
  const cnf = (p.cnf as { jwk?: PublicJwk } | undefined)?.jwk;
  if (!cnf) return fail("A3", "cnf missing (C16)");
  if (opt.expectedCnf && !sameJwk(cnf, opt.expectedCnf)) return fail("A3", "cnf does not match the wallet key (PR6)");
  if (typeof p.vct !== "string" || typeof p["vct#integrity"] !== "string")
    return fail("A3", "vct / vct#integrity missing");
  if (typeof p.iat !== "number") return fail("A3", "iat missing");
  checks.push("A3");
  if (p._sd_alg !== SD_ALG) return fail("A4", `_sd_alg=${String(p._sd_alg)} (C2)`);
  checks.push("A4");
  // A5 — iç içe nesne ve dizi öğeleri dahil (RFC 9901 §7.1; ortak kural @tamga-network/core/sd-structure — ADR-0036)
  let claims: Record<string, unknown>;
  const disclosures: Disclosure[] = [];
  try {
    const decoded = decodeDisclosures(parts.disclosures, digestOf, (d) => JSON.parse(b64uToUtf8(d)));
    for (const d of decoded) if (b64uDecode(d.salt).length < 16) return fail("A5", "Ş5e: salt < 128 bits");
    const r = resolveSdPayload(p, decoded, NON_SELECTIVE);
    claims = r.claims;
    // ad = yol (kök düzeyde alan adının kendisi; iç içe: `address.locality`, `nationalities[0]`)
    for (const d of r.resolved)
      disclosures.push({ disclosure: d.disclosure, digest: d.digest, name: d.path, value: d.value });
  } catch (e) {
    return fail("A5", e instanceof SdStructureError ? e.message : (e as Error).message);
  }
  if (typeof p.exp === "number" && p.exp < now) return fail("A5", "expired (Ş9)");
  if (typeof p.nbf === "number" && p.nbf > now + 60) return fail("A5", "nbf gelecekte");
  checks.push("A5");
  if (opt.catalogueHash) {
    const want = opt.catalogueHash(p.vct as string);
    const valid = want === undefined ? undefined : Array.isArray(want) ? want : [want];
    if (valid && !valid.includes(p["vct#integrity"] as string))
      return fail("B4", "vct#integrity does not match the catalogue");
    checks.push("B4");
  }
  return {
    ok: true,
    header: h,
    payload: p,
    claims,
    disclosures,
    issuerId: computeIssuerId(opt.stateCode ?? "TR", leafDer),
    leafFingerprint: certFingerprintHex(leafDer),
    leafDer,
    iss: String(p.iss ?? ""),
    vct: p.vct as string,
    vctIntegrity: p["vct#integrity"] as string,
    iat: p.iat as number,
    exp: p.exp as number | undefined,
    status: p.status as LocalVerifyOk["status"],
    category: p.category as string | undefined,
    cnf,
    checks,
  };
}

/** Sunum: gizlemek = disclosure'ı çıkarmak (C12); KB-JWT {nonce, aud, iat, sd_hash} cnf anahtarıyla (C8/C9). */
export async function presentSdJwt(input: {
  combined: string;
  discloseClaims: string[];
  keys: KeyProvider;
  keyRef: string;
  aud: string;
  nonce: string;
  iat?: number;
}): Promise<string> {
  const { jwt, disclosures } = splitCombined(input.combined);
  // ADR-0036: istenen ad bir yol olabilir (`address.locality`); iç içe disclosure'lar atası ve alt alanlarıyla birlikte seçilir
  const payload = JSON.parse(b64uToUtf8(jwt.split(".")[1])) as Record<string, unknown>;
  const decoded = decodeDisclosures(disclosures, digestOf, (d) => JSON.parse(b64uToUtf8(d)));
  let chosen: string[];
  try {
    const { resolved } = resolveSdPayload(payload, decoded);
    chosen = selectDisclosuresForPaths(resolved, input.discloseClaims).map((d) => d.disclosure);
  } catch (e) {
    if (!(e instanceof SdStructureError) || /requested claim/.test(e.message)) throw e;
    const want = new Set(input.discloseClaims);
    const missing = [...want].filter((n) => !decoded.some((d) => d.name === n));
    if (missing.length) throw new Error(`requested claim is not a disclosure in the credential: ${missing.join(",")}`);
    chosen = decoded.filter((d) => d.name !== undefined && want.has(d.name)).map((d) => d.disclosure);
  }
  const withoutKb = [jwt, ...chosen, ""].join("~");
  const kb = await signJwt(
    { typ: KB_JWT_TYP },
    {
      nonce: input.nonce,
      aud: input.aud,
      iat: input.iat ?? Math.floor(Date.now() / 1000),
      sd_hash: sdHashOf(withoutKb),
    },
    input.keys,
    input.keyRef,
  );
  return withoutKb + kb;
}
