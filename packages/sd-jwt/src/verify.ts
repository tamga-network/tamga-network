/**
 * Format katmanı doğrulaması — SPEC-CRED-0002 §8 (Ş1–Ş10) → SPEC-API-0001 adım kodları A1–A7 (A7 = exp/nbf geçerlilik).
 * Güven katmanı (C: TrustSource), şema (B) ve iptal (D) BU PAKETTE DEĞİL; verifier paketi birleştirir.
 * Çıktı üç değerli değil: format hatası kesin RED'dir; INDETERMINATE yalnızca dış kaynak (liste/CDN) için.
 */
import { compactVerify, decodeProtectedHeader, errors, importJWK, importX509, jwtVerify, type JWK } from "jose";
import {
  BasicConstraintsExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  X509Certificate,
  cryptoProvider,
} from "@peculiar/x509";
import { webcrypto } from "node:crypto";
import {
  b64ToDer,
  b64uToUtf8,
  certFingerprintSha256Hex,
  computeIssuerId,
  derToPem,
  secondsOrNow,
  type EpochSeconds,
} from "@tamga-network/core";
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

export type FormatStep = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7";

/** Belgenin `iat`'ı doğrulayıcı saatinden en fazla bu kadar ileride olabilir (saat kayması; KB-JWT penceresiyle aynı). */
export const IAT_FUTURE_SKEW_SEC = 300;

/** RFC 5280 §4.2.1.9 / §4.2.1.3: ara halka CA olmalı (basicConstraints cA=true), sertifika imzalayabilmeli (KeyUsage uzantısı
 *  VAR ve keyCertSign taşıyor — uzantının yokluğu serbestlik sayılmaz; RFC 5280 uyumlu CA sertifikası bu uzantıyı taşır) ve
 *  pathLenConstraint'i altındaki ara CA sayısını aşmamalı. `below` = bu halkanın altındaki ara CA sayısı (yaprak hariç). */
function intermediateProblem(c: X509Certificate, below: number): string | null {
  const bc = c.getExtension(BasicConstraintsExtension);
  if (!bc?.ca) return "x5c intermediate is not a CA (basicConstraints)";
  const ku = c.getExtension(KeyUsagesExtension);
  if (!ku || !(ku.usages & KeyUsageFlags.keyCertSign)) return "x5c intermediate lacks keyCertSign";
  if (typeof bc.pathLength === "number" && below > bc.pathLength) return "x5c intermediate pathLenConstraint exceeded";
  return null;
}

/** SD-JWT VC'nin Kasım 2024 öncesi typ değeri (§5.1.1): doğrulamada kabul edilir, ihraçta üretilmez. */
const LEGACY_SD_JWT_TYP = "vc+sd-jwt";

export interface VerifyOptions {
  aud: string;
  nonce: string;
  stateCode: string;
  /** Unix saniyesi (ADR-0056 K12: `epochSeconds` / `nowSeconds`) */
  now?: EpochSeconds;
  /**
   * ZORUNLU (ADR-0056 K1). Yaprak bu köklerden birince imzalanmış olmalı (Ş3); boş dizi A3'te ret. `"none"`: zincir/güven
   * denetimi bilerek YAPILMAZ — imza yalnız belgenin kendi `x5c[0]`'ına karşı denetlenir (kendinden imzalı belge de `ok: true`;
   * `anchorFingerprint: null`). Yalnız imzacıyı çağıran ayrıca denetliyorsa (ör. kendi verdiği belgenin `issuerId`'si).
   * Kabul kararı için `@tamga-network/verifier` `verifyPresentation`.
   */
  rootCertsDer: Uint8Array[] | "none";
  /**
   * §5.1.1: eski `vc+sd-jwt` typ değeri (SD-JWT VC -13 doğrulayıcıya izin verir). Varsayılan **true** (AB uyumu, 0.5.2); false
   * yalnız `dc+sd-jwt`. Sonuçta `typ` döner: Tamga türleri için `vc+sd-jwt` kararı çağıranda (C13; @tamga-network/verifier B adımı).
   */
  acceptLegacyVcSdJwtTyp?: boolean;
  /**
   * ADR-0036: Tamga dışı belge türleri (AB PID) `vct#integrity` taşımayabilir (SD-JWT VC'de isteğe bağlı). Varsayılan false:
   * Tamga türleri için zorunlu (ADR-0010). true ise eksik `vct#integrity` → `vctIntegrity: null` (B4 doğrulayıcıda karar verir).
   */
  allowMissingVctIntegrity?: boolean;
  /**
   * RFC 9901 §4.1.1: `_sd_alg` isteğe bağlıdır, yoksa `sha-256` sayılır. Varsayılan false: Tamga türleri alanı açıkça taşır (C2;
   * SPEC-CRED-0002). true ise eksik `_sd_alg` sha-256 varsayılır ve sonuçta `sdAlgPresent: false` döner — doğrulayıcı B adımında
   * türe göre karar verir (Tamga türünde zorunlu, dış türde — AB PID — isteğe bağlı). Değer varsa yine yalnız `sha-256`.
   */
  allowMissingSdAlg?: boolean;
  requireKb?: boolean; // varsayılan true (C8); ihraç biçimini doğrulamak için false
  /**
   * A7 (`exp`/`nbf`) atlanır — yalnız belgenin GEÇERLİ olması değil, bu belge verene ait olup kişide bulunduğunun kanıtlanması
   * gereken işler için (ör. belge verene silme isteği: süresi geçmiş belgenin kaydı da kişinin verisidir). İmza, zincir, KB-JWT
   * ve öteki adımlar aynen denetlenir; sonuçta `checksPerformed` A7 içermez. Doğrulamada (kabul kararı) KULLANILMAZ.
   */
  skipValidityPeriod?: boolean;
}

export interface VerifyOk {
  ok: true;
  /**
   * İmzalı gövdenin TAMAMI (_sd/_sd_alg kaldırılmış, disclosure'lar yerleştirilmiş): `iss`, `iat`, `cnf` ve iptal sırasını
   * taşıyan `status` dahil. Biçim katmanının iç çıktısıdır — bir API yanıtına ya da kayda OLDUĞU GİBİ yazılmaz (SPEC-API-0001
   * AP4). Güvenen tarafa verilecek değerler için `@tamga-network/verifier` `verifyPresentation` (yalnız istenen alanlar).
   */
  claims: Record<string, unknown>;
  disclosedClaimNames: string[]; // AP3: yalnızca adlar loglanır
  issuerId: string; // C15: x5c[0] parmak izinden
  leafFingerprint: string;
  /** Zincirin bağlandığı kök sertifikanın SHA-256 parmak izi (onaltılık); `rootCertsDer: "none"` ise null. */
  anchorFingerprint: string | null;
  vct: string;
  /** Başlıktaki typ: `dc+sd-jwt` ya da (kabul açıksa) eski `vc+sd-jwt` */
  typ: typeof SD_JWT_TYP | typeof LEGACY_SD_JWT_TYP;
  /** `vct#integrity`; yalnız `allowMissingVctIntegrity` ile null olabilir */
  vctIntegrity: string | null;
  /** `_sd_alg` gövdede açıkça var mıydı (yalnız `allowMissingSdAlg` ile false olabilir; o zaman sha-256 varsayıldı) */
  sdAlgPresent: boolean;
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
  /** Sabit ileti: başlık/gövde değeri ve kütüphane istisnası iletisi taşımaz (SPEC-API-0001 AP3); alan ADI taşıyabilir. */
  reason: string;
  checksPerformed: FormatStep[];
  /**
   * `true`: adım belgenin kusurundan değil, beklenmeyen bir iç hatadan (kütüphane, bozuk çapa sertifikası) düştü. Bu işlev yine
   * `ok: false` döndürür (kabul yok); `@tamga-network/verifier` bunu RED değil DOĞRULANAMADI olarak raporlar (AP2).
   */
  internal?: true;
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
  /** Beklenmeyen iç hata: nedene istisna iletisi girmez, yalnız hata türü (AP3). */
  const internal = (failedStep: FormatStep, e: unknown): VerifyFail => ({
    ...fail(failedStep, `internal error (${e instanceof Error ? e.name : typeof e})`),
    internal: true,
  });
  const now = secondsOrNow(opt.now);
  const requireKb = opt.requireKb ?? true;
  // ADR-0056 K1: güven çapası zorunlu; verilmemesi (JavaScript çağıran) ya da boş dizi zincirsiz kabul değildir
  const roots = opt.rootCertsDer;
  if (roots !== "none" && (!Array.isArray(roots) || !roots.length))
    return fail("A3", 'rootCertsDer missing: pass the trust anchors (or "none" to skip the chain check deliberately)');

  // A1 — ayrıştırma, KB var mı
  let parts: ReturnType<typeof splitCombined>;
  try {
    parts = splitCombined(combined);
  } catch {
    return fail("A1", "presentation is not a well-formed SD-JWT (Ş1)");
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
  if (header.alg !== "ES256") return fail("A2", "alg is not ES256 (C1)");
  if (header.typ !== SD_JWT_TYP) {
    if (!(header.typ === LEGACY_SD_JWT_TYP && (opt.acceptLegacyVcSdJwtTyp ?? true)))
      return fail("A2", "typ is not dc+sd-jwt (C13)");
  }
  if (!header.x5c?.length) return fail("A2", "x5c missing (C7)");
  done.push("A2");

  // A3 — zincir + imza + issuerId + cnf
  let payload: Record<string, unknown>;
  let leafDer: Uint8Array;
  let leaf: X509Certificate;
  let anchorFingerprint: string | null = null;
  let chain: X509Certificate[] = [];
  // Belgeden gelen sertifikalar okunamıyorsa belge bozuktur (RED). Okunduktan sonraki beklenmeyen hata (çağıranın verdiği çapa
  // sertifikası bozuk, kütüphane hatası) belgenin kusuru değildir: `internal` (doğrulayıcıda DOĞRULANAMADI).
  try {
    leafDer = b64ToDer(header.x5c[0]);
    leaf = new X509Certificate(toAB(leafDer));
    if (roots !== "none") chain = header.x5c.map((c) => new X509Certificate(toAB(b64ToDer(c))));
  } catch {
    return fail("A3", "x5c certificate unreadable");
  }
  const leafAlg = leaf.publicKey.algorithm as { name?: string; namedCurve?: string };
  if (leafAlg.name !== "ECDSA" || leafAlg.namedCurve !== "P-256") return fail("A3", "x5c leaf key is not P-256");
  try {
    if (roots !== "none") {
      // x5c: yaprak + (varsa) ara CA'lar, kök hariç (C7). Her halka bir sonrakince imzalanmış olmalı; son halka bir köke bağlanır.
      for (let i = 0; i + 1 < chain.length; i++) {
        if (chain[i].issuer !== chain[i + 1].subject) return fail("A3", "x5c chain order broken");
        const bad = intermediateProblem(chain[i + 1], i);
        if (bad) return fail("A3", bad);
        if (!(await chain[i].verify({ publicKey: chain[i + 1].publicKey, signatureOnly: true })))
          return fail("A3", "x5c intermediate signature invalid");
      }
      const top = chain[chain.length - 1];
      const topFp = certFingerprintSha256Hex(b64ToDer(header.x5c[header.x5c.length - 1]));
      for (const rootDer of roots) {
        // ADR-0036: dış listede imzacının kendisi çapa olabilir (ETSI LoTE hizmet sertifikası) — tek sertifikalık x5c'de yaprak
        // doğrudan çapadır. Kabul kararı yine güven katmanında: `issuerId` bu yapraktan türer ve C1 onu listede arar (Tamga
        // kökünün kendisi belge veren olarak kayıtlı değildir → C1 RED).
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
  } catch (e) {
    return internal("A3", e);
  }
  try {
    const pub = await importX509(derToPem(leafDer), "ES256");
    const { payload: raw } = await compactVerify(parts.jwt, pub);
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch (e) {
    if (e instanceof errors.JWSSignatureVerificationFailed) return fail("A3", "JWT signature invalid");
    if (e instanceof errors.JOSEError || e instanceof SyntaxError) return fail("A3", "JWT malformed");
    return internal("A3", e);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    return fail("A3", "JWT payload is not a JSON object");
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
  if (payload.iat > now + IAT_FUTURE_SKEW_SEC) return fail("A3", "iat is in the future");
  const iatMs = payload.iat * 1000;
  if (iatMs < leaf.notBefore.getTime() || iatMs > leaf.notAfter.getTime())
    return fail("A3", "signing certificate not valid at the time of issuance");
  // ara CA'lar da imza anında (iat) geçerli olmalı (yaprakla aynı zaman kuralı, D-BC-3)
  for (const ca of chain.slice(1))
    if (iatMs < ca.notBefore.getTime() || iatMs > ca.notAfter.getTime())
      return fail("A3", "x5c intermediate not valid at the time of issuance");
  done.push("A3");

  // A4 — _sd_alg: yalnız sha-256; eksikse (RFC 9901 §4.1.1 varsayılanı) ancak çağıran izin verdiyse kabul (dış türler, B adımı)
  const sdAlgPresent = payload._sd_alg !== undefined;
  if (!sdAlgPresent && !opt.allowMissingSdAlg) return fail("A4", "_sd_alg missing (C2)");
  if (sdAlgPresent && payload._sd_alg !== SD_ALG) return fail("A4", "_sd_alg is not sha-256 (C2)");
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
    // SdStructureError iletileri sabittir (yalnız alan ADI taşıyabilir — AP3); başka her hata beklenmeyen iç hatadır
    if (e instanceof SdStructureError) return fail("A5", e.message);
    return internal("A5", e);
  }
  done.push("A5");

  // A6 — KB-JWT
  let kb: VerifyOk["kb"];
  if (parts.kb) {
    // Beklenen değerler boşsa (ör. nonce deposu undefined döndü) karşılaştırma anlamsızdır: KB-JWT kabul edilmez
    if (typeof opt.aud !== "string" || !opt.aud || typeof opt.nonce !== "string" || !opt.nonce)
      return fail("A6", "expected aud/nonce missing (caller must pass non-empty values)");
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
      if (e instanceof errors.JWTClaimValidationFailed)
        return fail("A6", e.claim === "aud" ? "KB-JWT aud mismatch" : "KB-JWT claim invalid");
      if (e instanceof errors.JWSSignatureVerificationFailed) return fail("A6", "KB-JWT signature invalid");
      if (e instanceof errors.JOSEError || e instanceof TypeError || e instanceof SyntaxError)
        return fail("A6", "KB-JWT malformed or holder key unusable");
      return internal("A6", e);
    }
    done.push("A6"); // yalnız KB-JWT gerçekten doğrulandıysa (requireKb: false ve KB yoksa A6 yapılmış sayılmaz)
  }

  // A7 (Ş9) — exp / nbf (yalnız sahiplik kanıtı istenen işlerde atlanır: `skipValidityPeriod`)
  if (!opt.skipValidityPeriod) {
    if (typeof payload.exp === "number" && payload.exp < now) return fail("A7", "expired (Ş9)");
    if (typeof payload.nbf === "number" && payload.nbf > now) return fail("A7", "not yet valid (nbf)");
    done.push("A7");
  }

  return {
    ok: true,
    claims,
    disclosedClaimNames,
    issuerId,
    leafFingerprint,
    anchorFingerprint,
    vct: payload.vct as string,
    typ: header.typ === LEGACY_SD_JWT_TYP ? LEGACY_SD_JWT_TYP : SD_JWT_TYP,
    vctIntegrity: typeof payload["vct#integrity"] === "string" ? (payload["vct#integrity"] as string) : null,
    sdAlgPresent,
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
