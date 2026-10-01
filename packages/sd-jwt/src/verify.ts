/**
 * Format katmanı doğrulaması — SPEC-CRED-0002 §8 (Ş1–Ş10) → SPEC-API-0001 adım kodları A1–A6.
 * Güven katmanı (C: TrustSource), şema (B) ve iptal (D) BU PAKETTE DEĞİL; verifier paketi birleştirir.
 * Çıktı üç değerli değil: format hatası kesin RED'dir; INDETERMINATE yalnızca dış kaynak (liste/CDN) için.
 */
import { compactVerify, decodeProtectedHeader, importJWK, importX509, jwtVerify, type JWK } from "jose";
import { X509Certificate, cryptoProvider } from "@peculiar/x509";
import { webcrypto } from "node:crypto";
import { b64ToDer, b64uToUtf8, certFingerprintSha256Hex, computeIssuerId, derToPem } from "@tamga-network/core";
import { decodeDisclosures, resolveSdPayload, SdStructureError } from "@tamga-network/core/sd-structure";
import { digestOf, KB_IAT_WINDOW_SEC, KB_JWT_TYP, SD_ALG, SD_JWT_TYP, sdHashOf, splitCombined } from "./disclosure.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
/**
 * Seçici açıklanamayan adlar: SD-JWT VC (IETF) §3.2.2 — iss, nbf, exp, cnf, vct, vct#integrity, status açıkta olmak zorunda;
 * Tamga profili: iat ve category de açıkta (SPEC-CRED-0002); _sd, _sd_alg, "..." yapısal; nesne prototipi adları güvenlik için.
 */
export const NON_SELECTIVE_CLAIMS = new Set([
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
const toAB = (u8: Uint8Array): ArrayBuffer => new Uint8Array(u8).buffer as ArrayBuffer;

export type FormatStep = "A1" | "A2" | "A3" | "A4" | "A5" | "A6";

export interface VerifyOptions {
  aud: string;
  nonce: string;
  stateCode: string;
  now?: number; // saniye
  rootCertsDer?: Uint8Array[]; // yaprak bu köklerden birince imzalanmış olmalı (Ş3; boşsa zincir kontrolü verifier'a bırakılır)
  acceptLegacyVcSdJwtTyp?: boolean; // §5.1.1 — varsayılan false (T2)
  /**
   * ADR-0036: Tamga dışı belge türleri (AB PID) `vct#integrity` taşımayabilir (SD-JWT VC'de isteğe bağlı). Varsayılan false:
   * Tamga türleri için zorunlu (ADR-0010). true ise eksik `vct#integrity` → `vctIntegrity: null` (B4 doğrulayıcıda karar verir).
   */
  allowMissingVctIntegrity?: boolean;
  requireKb?: boolean; // varsayılan true (C8); ihraç biçimini doğrulamak için false
}

export interface VerifyOk {
  ok: true;
  claims: Record<string, unknown>; // _sd/_sd_alg kaldırılmış, disclosure'lar yerleştirilmiş
  disclosedClaimNames: string[]; // AP3: yalnızca adlar loglanır
  issuerId: string; // C15: x5c[0] parmak izinden
  leafFingerprint: string;
  /** Zincirin bağlandığı kök sertifikanın SHA-256 parmak izi (onaltılık); kök verilmediyse null (ADR-0036 dış güven kaynağı). */
  anchorFingerprint: string | null;
  vct: string;
  /** `vct#integrity`; yalnız `allowMissingVctIntegrity` ile null olabilir */
  vctIntegrity: string | null;
  iat: number;
  exp?: number;
  status?: { status_list: { idx: number; uri: string } };
  category?: string;
  kb?: { aud: string; nonce: string; iat: number };
  checksPerformed: FormatStep[];
}
export interface VerifyFail {
  ok: false;
  failedStep: FormatStep;
  reason: string;
  checksPerformed: FormatStep[];
}
export type VerifyResult = VerifyOk | VerifyFail;

export async function verifySdJwtVc(combined: string, opt: VerifyOptions): Promise<VerifyResult> {
  const done: FormatStep[] = [];
  const fail = (failedStep: FormatStep, reason: string): VerifyFail => ({
    ok: false,
    failedStep,
    reason,
    checksPerformed: done,
  });
  const now = opt.now ?? Math.floor(Date.now() / 1000);
  const requireKb = opt.requireKb ?? true;

  // A1 — ayrıştırma, KB var mı
  let parts: ReturnType<typeof splitCombined>;
  try {
    parts = splitCombined(combined);
  } catch (e) {
    return fail("A1", String((e as Error).message));
  }
  if (requireKb && !parts.kb) return fail("A1", "KB-JWT missing (C8)");
  done.push("A1");

  // A2 — alg, typ, x5c
  let header: ReturnType<typeof decodeProtectedHeader>;
  try {
    header = decodeProtectedHeader(parts.jwt);
  } catch {
    return fail("A2", "JWT header could not be decoded");
  }
  if (header.alg !== "ES256") return fail("A2", `alg=${header.alg} (C1)`);
  if (header.typ !== SD_JWT_TYP) {
    if (!(header.typ === "vc+sd-jwt" && opt.acceptLegacyVcSdJwtTyp)) return fail("A2", `typ=${header.typ} (C13)`);
  }
  if (!header.x5c?.length) return fail("A2", "x5c missing (C7)");
  done.push("A2");

  // A3 — zincir + imza + issuerId + cnf
  let payload: Record<string, unknown>;
  let leafDer: Uint8Array;
  let leaf: X509Certificate;
  let anchorFingerprint: string | null = null;
  try {
    leafDer = b64ToDer(header.x5c[0]);
    leaf = new X509Certificate(toAB(leafDer));
    if (opt.rootCertsDer?.length) {
      // x5c: yaprak + (varsa) ara CA'lar, kök hariç (C7). Her halka bir sonrakince imzalanmış olmalı; son halka bir köke bağlanır.
      const chain = header.x5c.map((c) => new X509Certificate(toAB(b64ToDer(c))));
      for (let i = 0; i + 1 < chain.length; i++) {
        if (chain[i].issuer !== chain[i + 1].subject) return fail("A3", "x5c chain order broken");
        if (!(await chain[i].verify({ publicKey: chain[i + 1].publicKey, signatureOnly: true })))
          return fail("A3", "x5c intermediate signature invalid");
      }
      const top = chain[chain.length - 1];
      const topFp = certFingerprintSha256Hex(b64ToDer(header.x5c[header.x5c.length - 1]));
      for (const rootDer of opt.rootCertsDer) {
        // ADR-0036: dış listede imzacının kendisi çapa olabilir (ETSI LoTE hizmet sertifikası)
        if (certFingerprintSha256Hex(rootDer) === topFp) {
          anchorFingerprint = topFp;
          break;
        }
        const root = new X509Certificate(toAB(rootDer));
        if (top.issuer !== root.subject) continue;
        if (await top.verify({ publicKey: root.publicKey, signatureOnly: true })) {
          anchorFingerprint = certFingerprintSha256Hex(rootDer);
          break;
        }
      }
      if (!anchorFingerprint) return fail("A3", "x5c leaf does not chain to any of the given roots");
    }
    const pub = await importX509(derToPem(leafDer), "ES256");
    const { payload: raw } = await compactVerify(parts.jwt, pub);
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch (e) {
    return fail("A3", `signature/chain: ${(e as Error).message}`);
  }
  const leafFingerprint = certFingerprintSha256Hex(leafDer);
  const issuerId = computeIssuerId(opt.stateCode, leafDer);
  const cnf = payload.cnf as { jwk?: JWK } | undefined;
  if (!cnf?.jwk) return fail("A3", "cnf missing (C16)");
  if (typeof payload.vct !== "string") return fail("A3", "vct missing");
  if (typeof payload["vct#integrity"] !== "string" && !opt.allowMissingVctIntegrity)
    return fail("A3", "vct#integrity missing");
  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat))
    return fail("A3", "iat missing or not a number");
  // Sertifika, belgenin imzalandığı anda (iat) geçerli olmalı — güven kararları da iat'a göre verilir (D-BC-3)
  const iatMs = payload.iat * 1000;
  if (iatMs < leaf.notBefore.getTime() || iatMs > leaf.notAfter.getTime())
    return fail("A3", "signing certificate not valid at the time of issuance");
  done.push("A3");

  // A4 — _sd_alg
  if (payload._sd_alg !== SD_ALG) return fail("A4", `_sd_alg=${String(payload._sd_alg)} (C2)`);
  done.push("A4");

  // A5 — disclosure'lar: önce hash, sonra çöz (C4/C14); iç içe nesne ve dizi öğeleri (RFC 9901 §7.1); her disclosure tam bir
  // kez; çakışma; kök düzeyde seçici açıklanamayan adlar
  let claims: Record<string, unknown>;
  let disclosedClaimNames: string[];
  try {
    const decoded = decodeDisclosures(parts.disclosures, digestOf, (d) => JSON.parse(b64uToUtf8(d)));
    for (const d of decoded)
      if (Buffer.from(d.salt, "base64url").length < 16) return fail("A5", "Ş5e: salt < 128 bits");
    const r = resolveSdPayload(payload, decoded, NON_SELECTIVE_CLAIMS);
    claims = r.claims;
    disclosedClaimNames = r.resolved.map((d) => d.path);
  } catch (e) {
    if (e instanceof SdStructureError) return fail("A5", e.message);
    return fail("A5", (e as Error).message);
  }
  done.push("A5");

  // A6 — KB-JWT
  let kb: VerifyOk["kb"];
  if (parts.kb) {
    try {
      const kbHeader = decodeProtectedHeader(parts.kb);
      if (kbHeader.typ !== KB_JWT_TYP || kbHeader.alg !== "ES256") return fail("A6", "KB-JWT typ/alg");
      const holderKey = await importJWK(cnf.jwk, "ES256");
      const { payload: kbp } = await jwtVerify(parts.kb, holderKey, { audience: opt.aud });
      if (kbp.nonce !== opt.nonce) return fail("A6", "nonce mismatch");
      if (typeof kbp.iat !== "number" || Math.abs(now - kbp.iat) > KB_IAT_WINDOW_SEC)
        return fail("A6", "KB-JWT iat outside the allowed window (C17)");
      const withoutKb = combined.slice(0, combined.length - parts.kb.length);
      if (kbp.sd_hash !== sdHashOf(withoutKb)) return fail("A6", "sd_hash mismatch (C9)");
      kb = { aud: opt.aud, nonce: opt.nonce, iat: kbp.iat };
    } catch (e) {
      return fail("A6", `KB-JWT: ${(e as Error).message}`);
    }
  }
  done.push("A6");

  // Ş9 — exp / nbf
  if (typeof payload.exp === "number" && payload.exp < now) return fail("A6", "expired (Ş9)");
  if (typeof payload.nbf === "number" && payload.nbf > now) return fail("A6", "not yet valid (nbf)");

  return {
    ok: true,
    claims,
    disclosedClaimNames,
    issuerId,
    leafFingerprint,
    anchorFingerprint,
    vct: payload.vct as string,
    vctIntegrity: typeof payload["vct#integrity"] === "string" ? (payload["vct#integrity"] as string) : null,
    iat: payload.iat as number,
    exp: payload.exp as number | undefined,
    status: payload.status as VerifyOk["status"],
    category: payload.category as string | undefined,
    kb,
    checksPerformed: done,
  };
}

/** İhraç biçimindeki (KB'siz) SD-JWT'nin gövdesini çözer — yalnızca görüntüleme için; İMZA DOĞRULANMAZ (doğrulama: verifySdJwtVc). */
export async function peekSdJwtVc(combined: string): Promise<{
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  disclosures: Array<{ name: string; value: unknown }>;
}> {
  const parts = splitCombined(combined);
  const header = decodeProtectedHeader(parts.jwt) as Record<string, unknown>;
  const payload = JSON.parse(b64uToUtf8(parts.jwt.split(".")[1]));
  return {
    header,
    payload,
    // iç içe yapılar için ad yok (dizi öğesi) olabilir; görüntüleme yalnız
    disclosures: decodeDisclosures(parts.disclosures, digestOf, (d) => JSON.parse(b64uToUtf8(d))).map((x) => ({
      name: x.name ?? "",
      value: x.value,
    })),
  };
}
