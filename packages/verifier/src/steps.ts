/**
 * Kanonik doğrulama hattının adımları — SPEC-API-0001 §1, birebir sırayla: T0 → A → B → C → D → E.
 * Her adım `ctx`'i günceller (yapılan/atlanan adım kodları, issuer/şema/durum bilgisi) ve ya `undefined` (geçti) ya da
 * `StepFail` (RED ya da DOĞRULANAMADI; hangi adım, neden) döndürür. Yönetici: verify.ts `verifyPresentation`.
 * Kural: altyapı/tazelik sorunu RED değil INDETERMINATE (AP2); sonuç claim değeri ve idx taşımaz (AP3/AP4).
 */
import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";
import { verifySdJwtVc } from "@tamga-network/sd-jwt";
import { computeSchemaId, pidSdJwtName } from "@tamga-network/core";
import {
  ALL as SCHEMA_DEFS,
  externalType,
  isShortLivedType,
  suspensionAllowed,
  usesStatusList,
  type SchemaDef,
} from "@tamga-network/schemas";
import type { EpochSeconds } from "@tamga-network/core/time";
import { getClaimAtPath } from "@tamga-network/core/sd-structure";
import { verifyStatusListAny } from "@tamga-network/sd-jwt";
import { errors as joseErrors } from "jose";
import { isIP } from "node:net";
import type { ExternalIssuerAnswer, TrustSource } from "@tamga-network/trust";
import { assuranceAtLeast, constraintOk, scopeClaimName, scopeCovers, type Policy } from "./policy.js";
import { pointOf, verifyMdocFormat, type FormatResult } from "./mdoc-format.js";
import { verifyIdentifierListToken } from "@tamga-network/mdoc";
import { b64uToBytes, certFingerprintSha256Hex } from "@tamga-network/core";
import { verifyMdocZkFormat } from "./mdoc-zk-format.js";
import { isNonPublicAddress, statusHostsOf, type StatusListScope } from "./status-cache.js";
import { isPublicSuffix, registrableDomain } from "./public-suffix.js";
import type { IndeterminateReason, Step, VerificationResult, VerifyInput } from "./verify.js";

type ValidateFn = ((data: unknown) => boolean) & { errors?: Array<{ instancePath: string; message?: string }> | null };
interface AjvLike {
  addSchema(schema: object, id: string): unknown;
  getSchema(id: string): ValidateFn | undefined;
  compile(schema: object): ValidateFn;
}
const Ajv2020 =
  (_Ajv2020 as unknown as { default?: new (o?: object) => AjvLike }).default ??
  (_Ajv2020 as unknown as new (o?: object) => AjvLike);
const addFormats =
  (_addFormats as unknown as { default?: (a: AjvLike) => void }).default ??
  (_addFormats as unknown as (a: AjvLike) => void);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
for (const d of SCHEMA_DEFS) ajv.addSchema(d.jsonSchema, (d.jsonSchema as { $id: string }).$id);

/** Adım sonucu: geçtiyse `undefined`, değilse RED ya da DOĞRULANAMADI. */
export type StepFail =
  | { kind: "reject"; step: Step; reason: string }
  | { kind: "indeterminate"; step: Step; why: IndeterminateReason; reason: string };
const reject = (step: Step, reason: string): StepFail => ({ kind: "reject", step, reason });
const indet = (step: Step, why: IndeterminateReason, reason: string): StepFail => ({
  kind: "indeterminate",
  step,
  why,
  reason,
});

type FormatOk = Extract<FormatResult, { ok: true }>;
type PolicyCredential = Policy["credentials"][number];
type IssuerRecord = NonNullable<ReturnType<TrustSource["issuer"]>>;

/** Adımlar arası paylaşılan durum. */
export interface VerifyCtx {
  input: VerifyInput;
  now: EpochSeconds;
  fr: ReturnType<TrustSource["freshness"]>;
  done: Step[];
  skipped: Step[];
  issuerInfo: VerificationResult["issuer"];
  schemaInfo: VerificationResult["schema"];
  disclosed: string[];
  claims: Record<string, unknown> | null;
  status: VerificationResult["status"];
  // adım çıktıları (sonraki adımlar kullanır)
  a?: FormatOk;
  pc?: PolicyCredential;
  schemaId?: string;
  def?: SchemaDef;
  issuerRec?: IssuerRecord | null;
  /** ADR-0036: belge bir dış güven listesindeki kuruma bağlıysa (federasyon) */
  ext?: ExternalIssuerAnswer | null;
  /** Dış tür (Tamga kataloğunda yok) için doğrulama şeması */
  extSchema?: Record<string, unknown>;
}

/** Politika `max_clock_skew_sec` üst sınırı (sn): daha geniş pencere geçerlilik/zaman denetimlerini anlamsızlaştırır. */
const MAX_CLOCK_SKEW_SEC = 600;

/** T0 — güven kaynağı tazeliği (CMP4/BT5). */
export function stepT0(ctx: VerifyCtx): StepFail | undefined {
  const { fr, input } = ctx;
  // Politika dosyadan/JSON'dan geliyorsa tazelik sınırları eksik ya da bozuk olabilir: `x > undefined` her zaman false olduğundan
  // yaş denetimleri sessizce kapanırdı. Eksik/bozuk sınır → DOĞRULANAMADI (güvenlik turu 2026-10-19).
  const f = input.policy?.freshness as Partial<Policy["freshness"]> | undefined;
  const limit = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (
    !limit(f?.max_trust_age_sec) ||
    !limit(f?.max_status_token_age_sec) ||
    (f?.max_clock_skew_sec !== undefined &&
      (!limit(f.max_clock_skew_sec) || f.max_clock_skew_sec > MAX_CLOCK_SKEW_SEC)) ||
    (f?.max_anchor_lag_sec !== undefined && !limit(f.max_anchor_lag_sec))
  )
    return indet("T0", "INDEXER_STALE", "policy freshness limits missing or invalid");
  if (!fr.healthy) return indet("T0", "INDEXER_STALE", "trusted list stale or unreachable (CMP4)");
  if (fr.ageSec > input.policy.freshness.max_trust_age_sec)
    return indet(
      "T0",
      "INDEXER_STALE",
      `trust source age ${fr.ageSec}s > ${input.policy.freshness.max_trust_age_sec}s`,
    );
  ctx.done.push("T0");
}

/** A — format (SD-JWT VC ya da ISO 18013-5 mdoc); çıktı ortak biçime indirgenir, B–E iki format için aynı. */
export async function stepA(ctx: VerifyCtx): Promise<StepFail | undefined> {
  const { input } = ctx;
  // Kök sertifika yoksa zincir denetimi yapılamaz: sessizce atlamak yerine doğrulanamadı (fail-closed). `"none"` (tür dışı,
  // JavaScript çağıran; `verifySdJwtVc`'nin açık atlama değeri) yalnız SD-JWT VC'de anlamlıdır ve A3 o zaman "yapıldı" DEĞİL
  // "atlandı" raporlanır (formatStep); mdoc yollarında çapa şarttır.
  const roots = input.rootCertsDer as unknown;
  const chainSkipped = roots === "none" && (input.format ?? "dc+sd-jwt") === "dc+sd-jwt";
  if (!chainSkipped && !(Array.isArray(roots) && roots.length))
    return indet("A3", "CHAIN_UNREACHABLE", "national root certificate not configured; chain cannot be checked");
  const a = await formatStep(input, ctx.now);
  if (!a.ok) {
    // ADR-0036 FD3: zincir verilen köklerin hiçbirine bağlanmadıysa RED demeden önce — istenen türe kefil olabilecek bir dış liste
    // şu an kullanılamıyor mu (yüklenememiş ya da süresi geçmiş; çapaları kök kümesine girmez)? Öyleyse belge hakkında hüküm
    // yoktur: DOĞRULANAMADI. Tür, imzası doğrulanmamış belgeden değil politikadan okunur.
    if (!a.indeterminate && a.failedStep === "A3" && /does not chain to any of the given roots$/.test(a.reason)) {
      const wanted = input.policy.credentials.find((c) => c.id === input.policyCredentialId)?.vct_values ?? [];
      const down = unavailableExternalList(input.trust, wanted);
      if (down) return indet("A3", "INDEXER_STALE", `external list ${down} stale or unavailable`);
    }
    return a.indeterminate ? indet(a.failedStep, a.indeterminate, a.reason) : reject(a.failedStep, a.reason);
  }
  ctx.done.push(...a.aDone);
  ctx.skipped.push(...a.aSkipped);
  ctx.issuerInfo = { issuer_id: a.issuerId, state_code: input.policy.trust.state_code };
  ctx.a = a;
  ctx.pc = input.policy.credentials.find((c) => c.id === input.policyCredentialId);
  if (!ctx.pc) {
    ctx.disclosed = a.disclosedClaimNames;
    return reject("E2", "politika credential id bilinmiyor");
  }
  // AP3/AP4: çağırana dönen değerler yalnız İSTENEN alanlardır; `cnf`, `status` (iptal sırası), `iss`, `iat` gibi teknik
  // alanlar hiç dönmez. Kurumun hep açık bıraktığı (seçici açıklanamayan) alan istenmişse açıklanmış sayılır: `disclosed_claims`'e
  // ve E3 kapsam denetimine girer.
  const ret = returnedClaims(a, ctx.pc.required_claims);
  ctx.claims = ret.claims;
  ctx.disclosed = [...a.disclosedClaimNames, ...ret.alwaysVisible];
}

/** ADR-0036 FD3: verilen türlerden birine kefil olabilecek, şu an kullanılamayan dış listenin kimliği (yoksa null). */
function unavailableExternalList(trust: TrustSource, vcts: readonly string[]): string | null {
  for (const vct of vcts) {
    const id = trust.unavailableExternalListFor?.(vct);
    if (id) return id;
  }
  return null;
}

/**
 * SD-JWT VC gövdesinin belge içeriği OLMAYAN alanları (JWT / SD-JWT VC kayıtlı adları; Tamga profilinde hepsi açıkta): güvenen
 * tarafa değer olarak dönmez. `status` iptal sırasını (`idx`) taşır — AP4; `cnf` kişinin kopya anahtarıdır (ilişkilendirilebilir).
 */
export const TECHNICAL_CLAIMS: ReadonlySet<string> = new Set([
  "iss",
  "sub",
  "aud",
  "jti",
  "iat",
  "nbf",
  "exp",
  "cnf",
  "vct",
  "vct#integrity",
  "status",
  "category",
  "_sd",
  "_sd_alg",
]);

/**
 * Çağırana dönecek değerler (SPEC-API-0001 §2.4–§2.5, §4.3): doğrulanmış belgeden yalnız politikanın istediği alanlar
 * (`required_claims`). İstenen ad kök düzeyde bir alansa değeri olduğu gibi; bir yolsa (`address.country`) yalnız o yol — yol bir
 * dizi öğesine iniyorsa (`nationalities[0]`) dizinin kendisi. Teknik alanlar (`TECHNICAL_CLAIMS`) istenmiş olsa da dönmez.
 * `alwaysVisible`: dönen kök alanlardan seçici açıklamayla gelmemiş olanlar (kurum açıkta bırakmış) — SD-JWT VC'de.
 */
export function returnedClaims(
  a: Pick<FormatOk, "claims" | "disclosedClaimNames" | "format">,
  requested: readonly string[],
): { claims: Record<string, unknown>; alwaysVisible: string[] } {
  const out: Record<string, unknown> = {};
  const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  for (const rc of requested) {
    if (has(a.claims, rc)) {
      if (!TECHNICAL_CLAIMS.has(rc)) out[rc] = a.claims[rc];
      continue;
    }
    const tokens = rc.match(/[^.[\]]+|\[\d+\]/g) ?? [];
    const root = tokens[0];
    // `getClaimAtPath` yalnız nesnenin KENDİ alanlarından yürür: tanımlıysa yol boyunca her ara değer nesne ya da dizidir
    if (!root || TECHNICAL_CLAIMS.has(root) || getClaimAtPath(a.claims, rc) === undefined) continue;
    let src = a.claims;
    let dst = out;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const val = src[t];
      if (i === tokens.length - 1 || Array.isArray(val)) {
        dst[t] = val; // yolun sonu ya da dizi: değer bütünüyle
        break;
      }
      if (!has(dst, t)) dst[t] = {};
      else if (dst[t] === val) break; // bu dal daha önce bütünüyle alınmış
      dst = dst[t] as Record<string, unknown>;
      src = val as Record<string, unknown>;
    }
  }
  const disclosedRoots = new Set(a.disclosedClaimNames.map((p) => p.match(/^[^.[]+/)?.[0] ?? p));
  const alwaysVisible = a.format === "dc+sd-jwt" ? Object.keys(out).filter((k) => !disclosedRoots.has(k)) : [];
  return { claims: out, alwaysVisible };
}

/** B — şema (B1 vct, B2 kayıt, B3 metadata, B4 content_hash = vct#integrity, B5 atlanır, B6 JSON Schema). */
export function stepB(ctx: VerifyCtx): StepFail | undefined {
  const { input } = ctx;
  const a = ctx.a!;
  const schemaId = computeSchemaId(a.vct);
  ctx.schemaId = schemaId;
  ctx.schemaInfo = { schema_id: schemaId, vct: a.vct };
  ctx.done.push("B1");
  if (!ctx.pc!.vct_values.includes(a.vct)) return reject("B1", "vct not in policy");
  const schemaRec = input.trust.schema(schemaId);
  if (!schemaRec) {
    // ADR-0036: Tamga kataloğunda olmayan tür yalnız, belge zinciri bu türe kefil olan bir dış listeye bağlıysa (FD2)
    const ext = a.anchorFingerprint ? input.trust.externalIssuerByAnchor?.(a.anchorFingerprint, a.vct, a.iat) : null;
    const xdef = externalType(a.vct);
    if (!ext || !xdef) {
      // FD3: tür Tamga kataloğunda yok ve çapa bir dış kuruma çözülemedi — bu türe kefil dış liste kullanılamıyorsa RED değil
      const down = unavailableExternalList(input.trust, [a.vct]);
      if (down) return indet("B2", "INDEXER_STALE", `external list ${down} stale or unavailable`);
      return reject("B2", "schema not registered");
    }
    if (ext.tri === "UNKNOWN") return indet("B2", "INDEXER_STALE", `external list ${ext.list_id} stale or unavailable`);
    if (ext.tri === "NO") return reject("B2", `type not in the scope of external list ${ext.list_id} (FD2)`);
    ctx.ext = ext;
    ctx.extSchema = xdef.jsonSchema;
    ctx.schemaInfo.status = "EXTERNAL";
    ctx.done.push("B2", "B3");
    ctx.skipped.push("B4", "B5"); // tür bütünlüğü dış listenin imzalı kaydından (Tamga kataloğuna bağlı değil)
    const id = (xdef.jsonSchema as { $id: string }).$id;
    const vx = ajv.getSchema(id) ?? (ajv.addSchema(xdef.jsonSchema, id), ajv.getSchema(id)!);
    if (!vx(a.claims))
      return reject(
        "B6",
        "JSON Schema uyumsuz: " + (vx.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join("; "),
      );
    ctx.done.push("B6");
    return;
  }
  // SPEC-CRED-0002/C13: Tamga türü (kataloğda) yalnız dc+sd-jwt; eski vc+sd-jwt yalnız dış türlerde kabul (SD-JWT VC -13)
  if (a.sdJwtTyp === "vc+sd-jwt") return reject("A2", "typ=vc+sd-jwt is not accepted for Tamga credential types (C13)");
  // SPEC-CRED-0002/C2: Tamga türü `_sd_alg`'ı açıkça taşır; RFC 9901 varsayılanı (alan yok) yalnız dış türlerde kabul
  if (a.sdAlgPresent === false) return reject("A4", "_sd_alg missing (required for Tamga credential types, C2)");
  ctx.schemaInfo.status = schemaRec.status;
  ctx.done.push("B2");
  const def = SCHEMA_DEFS.find((d) => d.vct === a.vct);
  if (!def) return indet("B3", "SCHEMA_UNREACHABLE", "Type Metadata not in cache");
  ctx.def = def;
  ctx.done.push("B3");
  if (a.vctIntegrity === null && a.format === "dc+sd-jwt")
    return reject("B4", "vct#integrity missing (required for Tamga types, ADR-0010)");
  if (a.vctIntegrity === null)
    ctx.skipped.push("B4"); // mdoc: vct#integrity yok; tip bütünlüğü docType + C2 şema yetkisiyle
  else {
    // ADR-0010 K4: belge kendi sürümünün özetini taşır; kayıttaki geçerli sürümlerden biri olmalı
    const hashes = input.trust.schemaContentHashes(schemaId);
    if (!hashes.length) return indet("B4", "CHAIN_UNREACHABLE", "content_hash unreadable");
    if (!hashes.includes(a.vctIntegrity)) return reject("B4", "vct#integrity ≠ registered content_hash");
    ctx.done.push("B4");
  }
  ctx.skipped.push("B5");
  // B6: yalnızca AÇIKLANAN alanlar doğrulanır — gizlenen zorunlu alanlar eksik görünür, bu yüzden `required` gevşetilir
  // (tip/enum/format kontrolü kalır)
  // mdoc öğe adları AB PID tablosuyla SD-JWT adına (ADR-0045: `birth_date` → `birthdate`); şema SD-JWT adlarıyla yazılır
  const named =
    a.format === "dc+sd-jwt"
      ? a.claims
      : Object.fromEntries(Object.entries(a.claims).map(([k, v]) => [pidSdJwtName(k), v]));
  const sample = {
    ...named,
    cnf: {},
    ...(a.status ? { status: { status_list: { idx: 0, uri: a.status.status_list.uri } } } : {}),
  };
  const origId = (def.jsonSchema as { $id: string }).$id;
  const relaxedId = origId.replace(/\/[^/]+$/, "/relaxed-schema.json"); // aynı dizin: göreli $ref'ler aynen çözülür
  let v6 = ajv.getSchema(relaxedId);
  if (!v6) {
    const relaxed = JSON.parse(JSON.stringify(def.jsonSchema)) as Record<string, unknown>;
    delete relaxed.required;
    relaxed.$id = relaxedId;
    ajv.addSchema(relaxed, relaxedId);
    v6 = ajv.getSchema(relaxedId)!;
  }
  if (!v6(sample))
    return reject(
      "B6",
      "JSON Schema uyumsuz: " + (v6.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join("; "),
    );
  ctx.done.push("B6");
}

/**
 * Yerel geliştirme adresi mi (`allowLocalIssuerUrls`): yalnız `http://localhost` ve geri döngü / özel ağ IPv4 aralıkları
 * (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). Genel bir IP adresi (`https://8.8.8.8`) yerel DEĞİLDİR.
 */
export const isLocalUrl = (u: string) => {
  // Ana makine adı tam karşılaştırılır: `http://localhost.evil.example` ya da `http://10.0.0.1.evil.example` yerel sayılmaz
  try {
    const { protocol, hostname } = new URL(u);
    if (hostname === "localhost") return protocol === "http:";
    if ((protocol !== "http:" && protocol !== "https:") || isIP(hostname) !== 4) return false;
    const [a, b] = hostname.split(".").map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  } catch {
    return false;
  }
};

/** D5: çapa yayını CDN yayınından sonra gelir (SPEC-CRED-0003 §5.2 adım 7 → 8); doğrulayıcının bu gecikmeye tanıdığı varsayılan pay (sn). */
export const DEFAULT_MAX_ANCHOR_LAG_SEC = 3600;

/** İç hata iletisinden yalnız kendi sabit önekimiz (`D3: …`) kalır; kütüphanenin eklediği ayrıntı (`: …`) atılır (AP3). */
const ownMessage = (msg: string) => /^[A-Z]\d: [^:]*/.exec(msg)?.[0].trim() ?? "status token invalid";

/** C — güven (C1/C2 belgenin iat'ına göre — D-BC-3; C3 tanıma; C4 kategori ↔ kayıt sınıfı — ADR-0010) + iss tutarlılığı. */
export function stepC(ctx: VerifyCtx): StepFail | undefined {
  const { input } = ctx;
  const a = ctx.a!;
  if (ctx.ext) return stepCExternal(ctx);
  const issuerRec = input.trust.issuer(a.issuerId);
  ctx.issuerRec = issuerRec;
  // A3b tutarlılığı (SPEC-API-0001 §1.2): issuerId sertifikadan; `iss` yalnız kayıtlı issuer_url ile tutarlılık için. Kayıt
  // gerektirdiği için burada, ama C adımlarından ÖNCE (sıra A3b → C1; tutarsız `iss` güven sorgusuna hiç girmez).
  // `iss` ZORUNLUDUR (SD-JWT VC; mdoc'ta `iss` yoktur — bağ yalnız sertifikadan): eksik ya da boş `iss` denetimi atlatmaz.
  // `allowLocalIssuerUrls` yalnız yerel geliştirmede, `iss` yerel bir adresken eşitliği gevşetir (`isLocalUrl`).
  if (issuerRec && a.format === "dc+sd-jwt") {
    const issClaim = a.claims.iss;
    if (typeof issClaim !== "string" || !issClaim) return reject("A3b", "iss claim missing");
    if (issClaim !== issuerRec.issuer_url && !(input.allowLocalIssuerUrls && isLocalUrl(issClaim)))
      return reject("A3b", "iss claim inconsistent with the registered issuer_url");
  }
  const c1 = input.trust.isCredentialAcceptable(a.issuerId, a.iat);
  if (c1 === "UNKNOWN") return indet("C1", "INDEXER_STALE", "issuer sorgusu UNKNOWN");
  if (c1 === "NO") return reject("C1", "issuer not acceptable at iat");
  ctx.done.push("C1");
  const c2 = input.trust.isCredentialSchemaAcceptable(a.issuerId, ctx.schemaId!, a.iat);
  if (c2 === "UNKNOWN") return indet("C2", "INDEXER_STALE", "schema authorisation UNKNOWN");
  if (c2 === "NO") return reject("C2", "issuer not authorised for this type at iat (AP8)");
  ctx.done.push("C2");
  if (issuerRec)
    ctx.issuerInfo = {
      ...ctx.issuerInfo!,
      category: issuerRec.category,
      assurance: issuerRec.assurance,
      class: issuerRec.class,
      legal_name: issuerRec.legal_name,
    };
  if (input.policy.trust.require_recognition) {
    const c3 = input.trust.isRecognizedBy(input.policy.trust.state_code, a.issuerId);
    if (c3 === "UNKNOWN") return indet("C3", "INDEXER_STALE", "recognition UNKNOWN");
    if (c3 === "NO") return reject("C3", "issuer not recognised");
    ctx.done.push("C3");
  } else ctx.skipped.push("C3");
  const cls = issuerRec?.class;
  if (a.format === "mso_mdoc" || a.format === "mso_mdoc_zk")
    ctx.skipped.push("C4"); // mdoc kategori sinyali taşımaz (ADR-0010 K5 yalnız SD-JWT)
  else {
    const cat = a.category;
    const expectCat = cls === "PUB" ? "urn:tamga:eaa:pub" : cls === "QUALIFIED" ? "urn:tamga:eaa:qualified" : undefined;
    if ((cat ?? undefined) !== expectCat)
      return reject("C4", "category claim does not match the registered issuer class"); // değer nedene girmez (AP3)
    ctx.done.push("C4");
  }
}

/**
 * C (ADR-0036) — dış listedeki kurum: C1 = liste tazeliği + kayıt (B2'de kapsam denetlendi), C2 = tür liste kapsamında,
 * C3 = kapsamdaki tanıyan devletler, C4 atlanır (Tamga kategori iddiası dış belgelerde yok), iss tutarlılığı atlanır (kayıtta
 * issuer_url yok; güven çapa sertifikasından).
 */
function stepCExternal(ctx: VerifyCtx): StepFail | undefined {
  const { input } = ctx;
  const ext = ctx.ext!;
  if (ext.tri === "UNKNOWN" || !ext.issuer) return indet("C1", "INDEXER_STALE", `external list ${ext.list_id} UNKNOWN`);
  ctx.done.push("C1", "C2");
  ctx.issuerRec = ext.issuer;
  ctx.issuerInfo = {
    ...ctx.issuerInfo!,
    category: ext.issuer.category,
    assurance: ext.issuer.assurance,
    class: ext.issuer.class,
    legal_name: ext.issuer.legal_name,
  };
  if (input.policy.trust.require_recognition) {
    if (!ext.recognized_by.includes(input.policy.trust.state_code))
      return reject("C3", `external issuer (${ext.territory}) not recognised by ${input.policy.trust.state_code}`);
    ctx.done.push("C3");
  } else ctx.skipped.push("C3");
  ctx.skipped.push("C4");
}

/**
 * S11: kurumun güven listesindeki iptal anahtarlarından ŞU AN geçerli olanlar — `status` ACTIVE (yoksa ACTIVE) ve `now`,
 * `valid_from..valid_to` penceresinde (liste imzacılarıyla aynı kural). Süresi dolmuş ya da henüz başlamamış anahtar imzacı sayılmaz.
 */
function activeStatusKeys(issuerRec: IssuerRecord | null | undefined, now: EpochSeconds): string[] {
  const at = (v: unknown) => (typeof v === "string" ? new Date(v).getTime() : NaN);
  return (issuerRec?.delegate_keys ?? [])
    .filter((k) => {
      if (k.purpose !== "status_list" || (k.status ?? "ACTIVE") !== "ACTIVE") return false;
      const w = k as { valid_from?: unknown; valid_to?: unknown };
      if (w.valid_from !== undefined && !(at(w.valid_from) <= now * 1000)) return false;
      if (w.valid_to !== undefined && !(at(w.valid_to) >= now * 1000)) return false;
      return true;
    })
    .map((k) => k.fingerprint_sha256);
}

/** D — iptal (D1 status claim, D2 ön çekim önbelleği, D3 imza+sub+iss, D4 tazelik, D5 çapa, D6 bit). */
export async function stepD(ctx: VerifyCtx): Promise<StepFail | undefined> {
  const { input, now } = ctx;
  const a = ctx.a!;
  const issuerRec = ctx.issuerRec;
  if (!a.status && a.identifierList) return stepDIdentifierList(ctx, a.identifierList);
  if (!a.status) {
    if (a.format === "mso_mdoc_zk" && isShortLivedType(a.vct)) {
      // ADR-0044 K5: kısa ömür işareti — ispatın bağladığı tür ZK kopyasıdır (tür kuralı: ≤ 24 sa, iptal listesi yok; AB ARF
      // VCR_01). İptal denetimi gerekmez; ana belge iptal/askıdaysa kimlik servisi yeni kopya vermez (ZC2)
      ctx.status = {
        value: "NOT_APPLICABLE",
        list_version: null,
        token_age_sec: null,
        reason:
          "short-lived ZK copy: valid for at most 24 hours and carries no revocation list entry; short validity replaces revocation (ADR-0044 ZC1, EU ARF VCR_01)",
      };
    } else if (a.format === "mso_mdoc_zk") {
      // ADR-0032 ZK4: indeks gelmez → iptal denetlenemez; işaretsiz ZK sunumunu politika AÇIKÇA kabul etmiyorsa DOĞRULANAMADI
      // (ADR-0044 ZC4: alan yoksa false)
      if (ctx.pc?.accept_unrevocable_zk !== true)
        return indet(
          "D1",
          "STATUS_UNREACHABLE",
          "revocation cannot be checked for a ZK presentation (ZK4); policy requires it",
        );
      ctx.status = {
        value: "NOT_APPLICABLE",
        list_version: null,
        token_age_sec: null,
        reason:
          "ZK4: revocation index is not disclosed in a zero-knowledge presentation; revocation cannot be checked (K6)",
      };
    } else {
      // ADR-0056: türü iptal listesi kullanan (şemada `uses_status_list: true`) belgede iptal girişi olmaması bozuk belgedir —
      // iptal denetimi sessizce atlanmaz
      if (usesStatusList(a.vct) === true)
        return reject("D1", "credential has no status entry but its type uses a status list");
      ctx.status = { value: "NOT_APPLICABLE", list_version: null, token_age_sec: null };
    }
    ctx.skipped.push("D1", "D2", "D3", "D4", "D5", "D6");
    return;
  }
  ctx.done.push("D1");
  let cached = input.statusCache.get(a.status.status_list.uri);
  if (!cached && issuerRec) {
    // Kurumun imzalı listede bildirdiği iptal sunucuları (SSRF — status-cache.ts); dış kurumda (ADR-0036) externalStatusScope
    const scope: StatusListScope = {
      issuer: issuerRec.issuer_id,
      ...(ctx.ext ? externalStatusScope(ctx.ext, a.leafDnsNames) : { hosts: statusHostsOf(issuerRec) }),
      ...(input.allowLocalIssuerUrls ? { allowLocal: true } : {}),
    };
    if (input.statusFetchOnDemand && input.statusCache.fetchNow) {
      // SPEC-CRED-0003 §9.1 / T1: yalnız çağıran açıkça etkinleştirdiyse doğrulama sırasında çekilir (süre sınırlı)
      await input.statusCache.fetchNow(
        a.status.status_list.uri,
        "status_list",
        scope,
        input.statusFetchOnDemand.timeoutMs,
      );
      cached = input.statusCache.get(a.status.status_list.uri);
    } else if (ctx.ext) {
      // Dış kurumun Status List'i için çapa günlüğü yok (ADR-0036): adres tanımlayıcı listesi gibi ön çekim kümesine eklenir,
      // çekim doğrulamanın dışında (S12); bu doğrulama DOĞRULANAMADI, sonrakiler önbellekten
      input.statusCache.want?.(a.status.status_list.uri, "status_list", scope);
    }
  }
  if (!cached)
    return indet("D2", "STATUS_UNREACHABLE", "status token not in prefetch cache (S12: no fetch per verification)");
  ctx.done.push("D2");
  // S11: iptal listesini kurumun güven listesinde kayıtlı iptal anahtarı imzalamış olmalı — imzacı doğrulamada sabitlenir
  // (ADR-0056 K6); anahtar kayıtlı değilse liste doğrulanamaz
  const statusKeys = activeStatusKeys(issuerRec, now);
  if (!statusKeys.length)
    return indet("D3", "STATUS_UNREACHABLE", "the institution's status list key is not registered in the trusted list");
  // ADR-0048 K3: mdoc kopyası CWT gösterimine (ikili; önbellekte `b64u:`), SD-JWT kopyası JWT gösterimine işaret eder — gövde
  // hangisiyse o doğrulanır (eski mdoc kopyaları JWT adresini gösterebilir)
  let tok: Awaited<ReturnType<typeof verifyStatusListAny>>;
  try {
    tok = await verifyStatusListAny(cached.token, a.status.status_list.uri, now, {
      expectedSignerFingerprints: statusKeys,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // önbellekteki token exp aşımı → tazelik sorunu, geçersizlik değil (AP2). Azami yaş politikada (aşağıda, D4)
    if (msg.startsWith("D4:"))
      return indet(
        "D4",
        msg.includes("unreadable") ? "STATUS_UNREACHABLE" : "STATUS_STALE",
        `status token: ${ownMessage(msg)}`,
      );
    if (msg.startsWith("D6:")) return reject("D6", `status token: ${ownMessage(msg)}`);
    if (msg.startsWith("D3:")) return reject("D3", `status token: ${ownMessage(msg)}`);
    if (e instanceof joseErrors.JWSSignatureVerificationFailed) return reject("D3", "status token: signature invalid");
    // Bunların dışındaki her hata (önbellekteki gövde bir belirteç değil — ör. sunucunun hata sayfası —, kütüphane hatası) belge
    // hakkında bir şey söylemez: DOĞRULANAMADI. Nedene istisna iletisi girmez (AP3), yalnız hata türü.
    return indet("D3", "STATUS_UNREACHABLE", `status token unreadable (${e instanceof Error ? e.name : typeof e})`);
  }
  if (
    issuerRec &&
    !ctx.ext && // ADR-0036: dış kurumda issuer_url yok — imzacı aşağıda kurumun iptal hizmeti sertifikasıyla denetlenir
    tok.format === "jwt" && // CWT gösteriminde `iss` yok: bağ S11 (kurumun kayıtlı iptal anahtarı) ile kurulur
    tok.payload.iss !== issuerRec.issuer_url &&
    !(ctx.input.allowLocalIssuerUrls && isLocalUrl(tok.payload.iss ?? ""))
  )
    return reject("D3", "status token iss inconsistent with the issuer record");
  ctx.done.push("D3");
  const age = now - tok.payload.iat;
  if (tok.payload.exp && tok.payload.exp < now) return indet("D4", "STATUS_STALE", "status token expired");
  if (age > input.policy.freshness.max_status_token_age_sec)
    return indet("D4", "STATUS_STALE", `status token age ${age}s`);
  ctx.done.push("D4");
  const listId = a.status.status_list.uri.split("/").pop() ?? "";
  const found = input.trust.statusAnchor("0x" + listId.padStart(64, "0")) ?? input.trust.statusAnchor(listId);
  // Son yol parçası kurumlar arasında çakışabilir: çapa yalnızca list_uri BİREBİR aynıysa bu listenin çapasıdır (iç inceleme Y2)
  const anchor = found && found.list_uri === a.status.status_list.uri ? found : null;
  let listVersion: number | null = null;
  const skewMs = (input.policy.freshness.max_clock_skew_sec ?? 120) * 1000;
  const lagMs = (input.policy.freshness.max_anchor_lag_sec ?? DEFAULT_MAX_ANCHOR_LAG_SEC) * 1000;
  if (anchor) {
    listVersion = anchor.version;
    if (anchor.content_hash !== tok.contentHash) {
      // token çapadan yeni olabilir (çapa gecikmesi); eski olamaz — ANCAK önbellek çapadan önce çekildiyse bu bizim ön çekim
      // gecikmemizdir: tazelik sorunu → INDETERMINATE (AP2), sahte REJECTED değil. Üç saat karşılaşır: token iat (issuer),
      // published_at (yayıncı), fetchedAt (doğrulayıcı, Unix saniye); kayma toleransı iki yönde (iç inceleme K3). Tarih
      // okunamıyorsa kontrol atlanmaz → INDETERMINATE (fail-closed).
      const anchorMs = new Date(anchor.published_at).getTime();
      if (!Number.isFinite(anchorMs))
        return indet("D5", "STATUS_STALE", "anchor published_at unreadable; revocation status cannot be verified");
      if (tok.payload.iat * 1000 < anchorMs - skewMs) {
        if (cached.fetchedAt * 1000 <= anchorMs + skewMs)
          return indet(
            "D5",
            "STATUS_STALE",
            "status cache fetched before the anchor (or within clock tolerance); refreshed on the next prefetch",
          );
        return reject("D5", "status token older than the anchor (rollback)");
      }
      // Belirteç çapadan YENİ: yayın sırası "önce CDN, sonra çapa" olduğundan (SPEC-CRED-0003 §5.2) kısa süre olağandır. Pay
      // sınırlıdır: belirteç, bilinen son çapadan `max_anchor_lag_sec`'ten daha yeniyse çapası gecikmiştir (ya da hiç
      // yazılmayacaktır) — çapasız belirteç süresiz kabul edilmez: DOĞRULANAMADI.
      if (tok.payload.iat * 1000 - anchorMs > lagMs + skewMs)
        return indet(
          "D5",
          "STATUS_STALE",
          "status token is newer than its latest anchor by more than the allowed anchor lag; the anchor is overdue",
        );
      ctx.skipped.push("D5");
    } else ctx.done.push("D5");
  } else if (ctx.ext) {
    ctx.skipped.push("D5"); // ADR-0036: dış kurumun listesi için çapa günlüğü yoktur (bağ dış listenin iptal hizmeti sertifikasıyla)
  } else {
    // Liste çapa günlüğünde hiç yok: yeni açılmış listenin ilk çapası aynı payla beklenir. Ölçü belgenin verildiği andır (liste
    // en geç o an vardı); pay dolduysa çapasız liste kabul edilmez: DOĞRULANAMADI.
    if ((now - a.iat) * 1000 > lagMs + skewMs)
      return indet(
        "D5",
        "STATUS_STALE",
        "status list has no anchor although the credential is older than the allowed anchor lag",
      );
    ctx.skipped.push("D5");
  }
  let bit: number;
  try {
    bit = tok.bitstring.get(a.status.status_list.idx);
  } catch {
    return reject("D6", "status index outside the list");
  }
  // IETF Token Status List: 0x00 VALID, 0x01 INVALID, 0x02 SUSPENDED; 0x03 ve 0x0B–0x0F uygulamaya özel, ötekiler tanımsız — 4/8
  // bitlik (dış) listelerde gelebilir. Anlamı bilinmeyen değer RED değil DOĞRULANAMADI'dır (AP2): belgenin iptal edildiği
  // söylenemez, geçerli olduğu da.
  if (bit > 2) {
    ctx.status = { value: "UNKNOWN", list_version: listVersion, token_age_sec: age };
    return indet(
      "D6",
      "STATUS_VALUE_UNKNOWN",
      `status value 0x${bit.toString(16).padStart(2, "0")} has no defined meaning`,
    );
  }
  // ADR-0048 SU2: askısı olmayan türde (şema `suspension_allowed` taşımıyor) 0x02 bozuk liste değeridir — askı sayılmaz, RED
  const noSuspension = bit === 2 && suspensionAllowed(a.vct) === false;
  ctx.status = {
    value: bit === 0 ? "VALID" : bit === 2 && !noSuspension ? "SUSPENDED" : "INVALID",
    list_version: listVersion,
    token_age_sec: age,
  };
  if (noSuspension) return reject("D6", "status value 0x02 on a type without suspension (ADR-0048 SU2)");
  if (bit !== 0) return reject("D6", bit === 2 ? "credential suspended" : "credential revoked");
  ctx.done.push("D6");
}

/**
 * Dış (federasyon, ADR-0036) kurumun tanımlayıcı listesi adresinin izinli sunucuları (0.5.2). Kural, sırayla:
 *  1. Dış liste bu kurumun iptal ya da belge verme hizmeti için `https` erişim noktası (ServiceSupplyPoints) bildiriyorsa
 *     yalnız o alan adları (birebir) — imzalı listenin beyanı.
 *  2. Bildirmiyorsa belge imzacısı sertifikasının (mdoc x5chain yaprağı; zinciri dış listedeki çapaya doğrulanmış) SAN alan
 *     adları, kamu soneki denetimiyle (`public-suffix.ts`):
 *     - joker `*.<taban>`: tabanın tam BİR etiket altı (joker anlamı) — tabanın kendisi ve daha derin alt adlar değil; taban bir
 *       kamu sonekiyse (`*.com.tr`, `*.gov.tr`) alınmaz;
 *     - joker olmayan ad: kamu sonekiyse (`gov.tr`) alınmaz; kayıt edilebilir alan adının en az bir etiket üstündeyse
 *       (`pid.example.com.tr`) kendisi ve alt adları; kayıt edilebilir alan adının kendisiyse (`example.com.tr`) yalnız birebir.
 *     IP, tek etiketli ad ve yerel ad alınmaz.
 * Her iki durumda önbellek ayrıca `https`, genel IP (bağlantı sabitlenir) ve kurum başına üst sınır uygular (status-cache.ts).
 */
export function externalStatusScope(
  ext: Pick<ExternalIssuerAnswer, "status_hosts">,
  leafDnsNames: string[] | undefined,
): Pick<StatusListScope, "hosts" | "domains" | "wildcards"> {
  const hosts = (ext.status_hosts ?? []).map((h) => h.toLowerCase());
  if (hosts.length) return { hosts };
  const exact = new Set<string>();
  const domains = new Set<string>();
  const wildcards = new Set<string>();
  for (const raw of leafDnsNames ?? []) {
    const lower = raw.toLowerCase().replace(/\.$/, "");
    const wild = lower.startsWith("*.");
    const d = wild ? lower.slice(2) : lower;
    if (
      !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ||
      /^[0-9.]+$/.test(d) ||
      isNonPublicAddress(d) ||
      d.endsWith(".local") ||
      d.endsWith(".localhost") ||
      isPublicSuffix(d)
    )
      continue;
    const reg = registrableDomain(d);
    if (!reg) continue;
    if (wild) wildcards.add(d);
    else if (d.split(".").length > reg.split(".").length) domains.add(d);
    else exact.add(d);
  }
  return {
    hosts: [...exact],
    domains: [...domains],
    ...(wildcards.size ? { wildcards: [...wildcards] } : {}),
  };
}

/**
 * Önbellekteki tanımlayıcı listesi: ikili CWT base64url olarak saklanır (`b64u:` öneki isteğe bağlı). Kodlama katıdır
 * (`b64uToBytes`); bozuk önbellek değeri `D4:` (okunamıyor) hatasıdır — altyapı sorunu, ret değil.
 */
const cwtBytes = (token: string) => {
  try {
    return b64uToBytes(token.startsWith("b64u:") ? token.slice(5) : token);
  } catch {
    throw new Error("D4: identifier list unreadable (cached value is not base64url)");
  }
};

/**
 * D — Attestation Revocation List (tanımlayıcı listesi; CIR 2024/2979 Ek II, EAA-6.2.10.1-02.3/-10.1; ARF VCR_12). Status List
 * ile aynı ilkeler: ön çekim önbelleği (S12), imzacı kurumun güven listesinde kayıtlı iptal anahtarı (S11), tazelik (D4), bayat
 * ya da erişilemez liste DOĞRULANAMADI. Çapa günlüğü bu listeler için yoktur (D5 atlanır). Askı yoktur: listede = iptal.
 */
async function stepDIdentifierList(ctx: VerifyCtx, ref: { id: string; uri: string }): Promise<StepFail | undefined> {
  const { input, now } = ctx;
  ctx.done.push("D1");
  const cached = input.statusCache.get(ref.uri);
  if (!cached) {
    // çapa günlüğünde tanımlayıcı listesi yok: adres (imzası doğrulanmış MSO'dan) ön çekim kümesine eklenir, çekim doğrulamanın
    // dışında yapılır (S12); bu doğrulama DOĞRULANAMADI, sonrakiler önbellekten
    // yalnız kurumun imzalı listede bildirdiği iptal sunucusundaki adres öğrenilir (SSRF — status-cache.ts)
    // dış kurum (ADR-0036; kaydında issuer_url / status_list_base yok): externalStatusScope
    if (ctx.issuerRec)
      input.statusCache.want?.(ref.uri, "identifier_list", {
        issuer: ctx.issuerRec.issuer_id,
        ...(ctx.ext ? externalStatusScope(ctx.ext, ctx.a?.leafDnsNames) : { hosts: statusHostsOf(ctx.issuerRec) }),
        ...(input.allowLocalIssuerUrls ? { allowLocal: true } : {}),
      });
    return indet(
      "D2",
      "STATUS_UNREACHABLE",
      "identifier list not in prefetch cache yet (S12: no fetch per verification); queued for prefetch",
    );
  }
  ctx.done.push("D2");
  let list: ReturnType<typeof verifyIdentifierListToken>;
  try {
    list = verifyIdentifierListToken(cwtBytes(cached.token), { uri: ref.uri, now, publicKeyOf: pointOf });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // okunamayan liste (bozuk bayt, çözülemeyen CBOR) ve süresi geçmiş liste: DOĞRULANAMADI — belge hakkında bir şey söylemez
    if (msg.startsWith("D4:"))
      return indet(
        "D4",
        msg.includes("unreadable") ? "STATUS_UNREACHABLE" : "STATUS_STALE",
        `identifier list: ${ownMessage(msg)}`,
      );
    if (msg.startsWith("D3:")) return reject("D3", `identifier list: ${ownMessage(msg)}`);
    // kendi denetimlerimizden gelmeyen hata (çözülemeyen CBOR, kütüphane): DOĞRULANAMADI; nedene istisna iletisi girmez (AP3)
    return indet("D4", "STATUS_UNREACHABLE", `identifier list unreadable (${e instanceof Error ? e.name : typeof e})`);
  }
  const statusKeys = activeStatusKeys(ctx.issuerRec, now);
  if (!statusKeys.length)
    return indet("D3", "STATUS_UNREACHABLE", "the institution's status list key is not registered in the trusted list");
  if (!statusKeys.includes(certFingerprintSha256Hex(list.leafDer)))
    return reject("D3", "identifier list signer is not the institution's registered status key");
  ctx.done.push("D3");
  const age = now - list.iat;
  if (age > input.policy.freshness.max_status_token_age_sec)
    return indet("D4", "STATUS_STALE", `identifier list age ${age}s`);
  ctx.done.push("D4");
  ctx.skipped.push("D5");
  const revoked = list.identifiers.has(ref.id);
  ctx.status = { value: revoked ? "INVALID" : "VALID", list_version: null, token_age_sec: age };
  if (revoked) return reject("D6", "credential revoked (identifier list)");
  ctx.done.push("D6");
}

/** E — politika (E1 assurance/kategori, E2 gerekli claim'ler + kısıtlar, E3 RP kapsamı — AP6). E4 denetim kaydı yöneticide. */
export function stepE(ctx: VerifyCtx): StepFail | undefined {
  const { input, now } = ctx;
  const a = ctx.a!;
  const pc = ctx.pc!;
  const issuerRec = ctx.issuerRec;
  if (!issuerRec) return reject("E1", "no issuer record");
  if (!assuranceAtLeast(issuerRec.assurance, input.policy.trust.min_issuer_assurance))
    return reject("E1", `issuer assurance ${issuerRec.assurance} < ${input.policy.trust.min_issuer_assurance}`);
  if (!input.policy.trust.allowed_categories.includes(issuerRec.category))
    return reject("E1", `issuer category ${issuerRec.category} outside policy`);
  ctx.done.push("E1");
  for (const rc of pc.required_claims) {
    // ADR-0036: ad bir yol olabilir (address.country, nationalities)
    const val = Object.prototype.hasOwnProperty.call(a.claims, rc) ? a.claims[rc] : getClaimAtPath(a.claims, rc);
    if (val === undefined) return reject("E2", `required claim not disclosed: ${rc}`);
    const cons = pc.constraints?.[rc];
    if (cons !== undefined && !constraintOk(val, cons)) return reject("E2", `constraint not satisfied: ${rc}`);
  }
  ctx.done.push("E2");
  // ADR-0056 K4: `rp` zorunlu — verilmemesi kapsam denetimini sessizce atlamaz
  if (input.rp === undefined)
    return reject("E3", 'relying party registration not given (pass rp, null for an unregistered party, or "none")');
  // SPEC-API-0001 E3: kayıtsız RP (`null`) her zaman ret — açıklanan alan olmasa da (boş kapsamla "aşım yok" sayılmasın)
  if (input.rp === null) return reject("E3", "relying party not registered");
  if (input.rp !== "none") {
    const nowMs = now * 1000;
    const allowed = new Set(
      (input.rp?.scopes ?? [])
        .filter(
          (s) =>
            s.vct === a.vct &&
            new Date(s.valid_from).getTime() <= nowMs &&
            (!s.valid_until || nowMs < new Date(s.valid_until).getTime()),
        )
        .flatMap((s) => s.claims),
    );
    // iç içe yol: kapsamda kendisi ya da bir atası varsa izinli (address → address.locality) — AP6 ile aynı kural
    const over = ctx.disclosed.filter((c) => !scopeCovers(allowed, scopeClaimName(a.vct, a.format, c)));
    if (over.length) return reject("E3", `scope exceeded: ${over.join(",")} (AP6)`);
    ctx.done.push("E3");
  } else ctx.skipped.push("E3");
}

/**
 * SD-JWT VC sunumunun beklenen KB-JWT `aud`'u (PV7). Digital Credentials API yolunda (`origin` verilmiş) hedef OpenID4VP 1.0 Ek A.4
 * gereği `origin:<köken>`dür — imzalı istekte de: `aud` verilmemişse buradan türetilir; verilmiş ve farklıysa açık iletiyle A1 reddi
 * (yanlış yapılandırma A6'da anlamsız "aud uyuşmazlığı" olarak görünmesin). Cihazlar arası yolda `aud` zorunludur (client identifier).
 */
export function expectedSdJwtAud(
  input: Pick<VerifyInput, "aud" | "origin">,
): { ok: true; aud: string } | { ok: false; reason: string } {
  if (input.origin !== undefined) {
    const derived = `origin:${input.origin}`;
    if (input.aud === undefined || input.aud === "") return { ok: true, aud: derived };
    if (input.aud !== derived)
      return {
        ok: false,
        reason:
          'aud does not match the Digital Credentials API origin: on this path the audience must be "origin:" + the page origin (OpenID4VP 1.0 Annex A.4); omit aud to derive it',
      };
    return { ok: true, aud: derived };
  }
  if (input.aud === undefined || input.aud === "")
    return { ok: false, reason: "aud required (client identifier; on the Digital Credentials API path pass origin)" };
  return { ok: true, aud: input.aud };
}

/** A adımının format seçimi: sonucu ortak biçime indirir (B–E iki format için aynı). */
async function formatStep(input: VerifyInput, now: EpochSeconds): Promise<FormatResult> {
  if (input.format === "mso_mdoc_zk") {
    if (!input.responseUri && !input.origin)
      return { ok: false, failedStep: "A1", reason: "responseUri or origin required for mso_mdoc_zk" };
    if (!input.origin && !input.aud)
      return {
        ok: false,
        failedStep: "A1",
        reason: "aud required (client identifier) when the response came via responseUri",
      };
    const pc = input.policy.credentials.find((c) => c.id === input.policyCredentialId);
    return verifyMdocZkFormat(input.presentation, {
      clientId: input.aud ?? "",
      nonce: input.nonce,
      responseUri: input.responseUri ?? "",
      origin: input.origin,
      encJwkThumbprint: input.encJwkThumbprint,
      stateCode: input.policy.trust.state_code,
      now,
      rootCertsDer: input.rootCertsDer,
      expectedDocTypes: pc?.vct_values ?? [],
      requestedElements: pc?.required_claims ?? [],
      namespace: pc?.namespace,
      trust: input.trust,
      maxSkewSec: input.policy.freshness.max_clock_skew_sec ?? 120,
      backend: input.zk,
    });
  }
  if (input.format === "mso_mdoc") {
    if (!input.responseUri && !input.origin && !input.sessionTranscript)
      return { ok: false, failedStep: "A1", reason: "responseUri, origin or sessionTranscript required for mso_mdoc" };
    if (!input.origin && !input.sessionTranscript && !input.aud)
      return {
        ok: false,
        failedStep: "A1",
        reason: "aud required (client identifier) when the response came via responseUri",
      };
    return verifyMdocFormat(input.presentation, {
      clientId: input.aud ?? "",
      nonce: input.nonce,
      responseUri: input.responseUri ?? "",
      origin: input.origin,
      sessionTranscript: input.sessionTranscript,
      encJwkThumbprint: input.encJwkThumbprint,
      stateCode: input.policy.trust.state_code,
      now,
      maxSkewSec: input.policy.freshness.max_clock_skew_sec ?? 120,
      rootCertsDer: input.rootCertsDer,
      expectedDocTypes: input.policy.credentials
        .filter((c) => c.id === input.policyCredentialId)
        .flatMap((c) => c.vct_values),
    });
  }
  const aud = expectedSdJwtAud(input);
  if (!aud.ok) return { ok: false, failedStep: "A1", reason: aud.reason };
  const r = await verifySdJwtVc(input.presentation, {
    aud: aud.aud,
    nonce: input.nonce,
    stateCode: input.policy.trust.state_code,
    now,
    rootCertsDer: input.rootCertsDer,
    requireKb: true,
    allowMissingVctIntegrity: true, // B4 karar verir: Tamga türünde zorunlu, dış türde (AB PID) isteğe bağlı
    allowMissingSdAlg: true, // RFC 9901 §4.1.1 varsayılanı sha-256; B adımı karar verir: Tamga türünde zorunlu (C2), dış türde isteğe bağlı
  });
  if (!r.ok)
    return {
      ok: false,
      failedStep: r.failedStep,
      reason: r.reason,
      // beklenmeyen iç hata (kütüphane, bozuk çapa sertifikası) belgenin kusuru değildir: DOĞRULANAMADI (AP2, §2.3)
      ...(r.internal ? { indeterminate: "CHAIN_UNREACHABLE" as const } : {}),
    };
  // `"none"`: zincir denetlenmedi → A3 yapıldı sayılmaz (`checks_skipped`); imza yaprağa karşı yine denetlendi
  const chainChecked = (input.rootCertsDer as unknown) !== "none";
  return {
    ok: true,
    format: "dc+sd-jwt",
    sdJwtTyp: r.typ,
    sdAlgPresent: r.sdAlgPresent,
    issuerId: r.issuerId,
    vct: r.vct,
    vctIntegrity: r.vctIntegrity,
    anchorFingerprint: r.anchorFingerprint,
    iat: r.iat,
    category: r.category,
    claims: r.claims,
    disclosedClaimNames: r.disclosedClaimNames,
    status: r.status,
    aDone: ["A1", "A2", ...(chainChecked ? (["A3"] as const) : []), "A3b", "A3d", "A4", "A5", "A6", "A7", "A8"],
    aSkipped: [...(chainChecked ? [] : (["A3"] as const)), "A3c"], // A3c CRL/OCSP: dev PKI'da yok
  };
}
