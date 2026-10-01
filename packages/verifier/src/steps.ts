/**
 * Kanonik doğrulama hattının adımları — SPEC-API-0001 §1, birebir sırayla: T0 → A → B → C → D → E.
 * Her adım `ctx`'i günceller (yapılan/atlanan adım kodları, issuer/şema/durum bilgisi) ve ya `undefined` (geçti) ya da
 * `StepFail` (RED ya da DOĞRULANAMADI; hangi adım, neden) döndürür. Yönetici: verify.ts `verifyPresentation`.
 * Kural: altyapı/tazelik sorunu RED değil INDETERMINATE (AP2); sonuç claim değeri ve idx taşımaz (AP3/AP4).
 */
import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";
import { verifySdJwtVc } from "@tamga-network/sd-jwt";
import { computeSchemaId } from "@tamga-network/core";
import { ALL as SCHEMA_DEFS, externalType, type SchemaDef } from "@tamga-network/schemas";
import { getClaimAtPath } from "@tamga-network/core/sd-structure";
import { verifyStatusListToken } from "@tamga-network/issuer";
import type { ExternalIssuerAnswer, TrustSource } from "@tamga-network/trust";
import { assuranceAtLeast, constraintOk, type Policy } from "./policy.js";
import { verifyMdocFormat, type FormatResult } from "./mdoc-format.js";
import { verifyMdocZkFormat } from "./mdoc-zk-format.js";
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
  now: number;
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

/** T0 — güven kaynağı tazeliği (CMP4/BT5). */
export function stepT0(ctx: VerifyCtx): StepFail | undefined {
  const { fr, input } = ctx;
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
  // Kök sertifika yoksa zincir denetimi yapılamaz: sessizce atlamak yerine doğrulanamadı (fail-closed)
  if (!input.rootCertsDer?.length)
    return indet("A3", "CHAIN_UNREACHABLE", "national root certificate not configured; chain cannot be checked");
  const a = await formatStep(input, ctx.now);
  if (!a.ok) return reject(a.failedStep, a.reason);
  ctx.done.push(...a.aDone);
  ctx.skipped.push(...a.aSkipped);
  ctx.disclosed = a.disclosedClaimNames;
  ctx.claims = a.claims;
  ctx.issuerInfo = { issuer_id: a.issuerId, state_code: input.policy.trust.state_code };
  ctx.a = a;
  ctx.pc = input.policy.credentials.find((c) => c.id === input.policyCredentialId);
  if (!ctx.pc) return reject("E2", "politika credential id bilinmiyor");
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
    if (!ext || !xdef) return reject("B2", "schema not registered");
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
  const sample = {
    ...a.claims,
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

/** Yerel geliştirme adresleri (localhost / IP) kayıtlı issuer_url ile birebir eşleşmek zorunda değil. */
const isLocalUrl = (u: string) => u.startsWith("http://localhost") || /^https?:\/\/(\d{1,3}\.){3}\d{1,3}/.test(u);

/** C — güven (C1/C2 belgenin iat'ına göre — D-BC-3; C3 tanıma; C4 kategori ↔ kayıt sınıfı — ADR-0010) + iss tutarlılığı. */
export function stepC(ctx: VerifyCtx): StepFail | undefined {
  const { input } = ctx;
  const a = ctx.a!;
  if (ctx.ext) return stepCExternal(ctx);
  const c1 = input.trust.isCredentialAcceptable(a.issuerId, a.iat);
  if (c1 === "UNKNOWN") return indet("C1", "INDEXER_STALE", "issuer sorgusu UNKNOWN");
  if (c1 === "NO") return reject("C1", "issuer not acceptable at iat");
  ctx.done.push("C1");
  const c2 = input.trust.isCredentialSchemaAcceptable(a.issuerId, ctx.schemaId!, a.iat);
  if (c2 === "UNKNOWN") return indet("C2", "INDEXER_STALE", "schema authorisation UNKNOWN");
  if (c2 === "NO") return reject("C2", "issuer not authorised for this type at iat (AP8)");
  ctx.done.push("C2");
  const issuerRec = input.trust.issuer(a.issuerId);
  ctx.issuerRec = issuerRec;
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
      return reject("C4", `category claim (${cat ?? "none"}) does not match the registered class (${cls ?? "?"})`);
    ctx.done.push("C4");
  }
  const issClaim = String(a.claims.iss ?? "");
  if (
    issuerRec &&
    issClaim &&
    issuerRec.issuer_url &&
    issClaim !== issuerRec.issuer_url &&
    !(input.allowLocalIssuerUrls && isLocalUrl(issClaim))
  )
    return reject("A3b", "iss claim inconsistent with the registered issuer_url");
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

/** D — iptal (D1 status claim, D2 ön çekim önbelleği, D3 imza+sub+iss, D4 tazelik, D5 çapa, D6 bit). */
export async function stepD(ctx: VerifyCtx): Promise<StepFail | undefined> {
  const { input, now } = ctx;
  const a = ctx.a!;
  const issuerRec = ctx.issuerRec;
  if (!a.status) {
    ctx.status = { value: "NOT_APPLICABLE", list_version: null, token_age_sec: null };
    ctx.skipped.push("D1", "D2", "D3", "D4", "D5", "D6");
    return;
  }
  ctx.done.push("D1");
  const cached = input.statusCache.get(a.status.status_list.uri);
  if (!cached)
    return indet("D2", "STATUS_UNREACHABLE", "status token not in prefetch cache (S12: no fetch per verification)");
  ctx.done.push("D2");
  let tok: Awaited<ReturnType<typeof verifyStatusListToken>>;
  try {
    tok = await verifyStatusListToken(cached.token, a.status.status_list.uri, now);
  } catch (e) {
    const msg = (e as Error).message;
    // önbellekteki token ttl×2 aşımı → tazelik sorunu, geçersizlik değil (AP2)
    if (msg.startsWith("D4:")) return indet("D4", "STATUS_STALE", `status token: ${msg}`);
    if (msg.startsWith("D6:")) return reject("D6", `status token: ${msg}`);
    return reject("D3", `status token: ${msg}`);
  }
  if (
    issuerRec &&
    !ctx.ext && // ADR-0036: dış kurumda issuer_url yok — imzacı aşağıda kurumun iptal hizmeti sertifikasıyla denetlenir
    tok.payload.iss !== issuerRec.issuer_url &&
    !(ctx.input.allowLocalIssuerUrls && isLocalUrl(tok.payload.iss))
  )
    return reject("D3", "status token iss inconsistent with the issuer record");
  // S11: iptal listesini kurumun güven listesinde kayıtlı iptal anahtarı imzalamış olmalı
  const statusKeys = (issuerRec?.delegate_keys ?? [])
    .filter((k) => k.purpose === "status_list" && (k.status ?? "ACTIVE") === "ACTIVE")
    .map((k) => k.fingerprint_sha256);
  if (!statusKeys.length)
    return indet("D3", "STATUS_UNREACHABLE", "the institution's status list key is not registered in the trusted list");
  if (!statusKeys.includes(tok.leafFingerprintHex))
    return reject("D3", "status token signer is not the institution's registered status key");
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
      const skewMs = (input.policy.freshness.max_clock_skew_sec ?? 120) * 1000;
      if (tok.payload.iat * 1000 < anchorMs - skewMs) {
        if (cached.fetchedAt * 1000 <= anchorMs + skewMs)
          return indet(
            "D5",
            "STATUS_STALE",
            "status cache fetched before the anchor (or within clock tolerance); refreshed on the next prefetch",
          );
        return reject("D5", "status token older than the anchor (rollback)");
      }
      ctx.skipped.push("D5");
    } else ctx.done.push("D5");
  } else ctx.skipped.push("D5");
  let bit: number;
  try {
    bit = tok.bitstring.get(a.status.status_list.idx);
  } catch (e) {
    return reject("D6", (e as Error).message);
  }
  ctx.status = {
    value: bit === 0 ? "VALID" : bit === 2 ? "SUSPENDED" : "INVALID",
    list_version: listVersion,
    token_age_sec: age,
  };
  if (bit !== 0) return reject("D6", bit === 2 ? "credential suspended" : "credential revoked");
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
  if (input.rp !== undefined) {
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
    // iç içe yol: kapsamda kendisi ya da bir atası varsa izinli (address → address.locality)
    const covered = (c: string) => {
      for (let p = c; p; p = p.replace(/(\.[^.[\]]+|\[\d+\])$/, "")) {
        if (allowed.has(p)) return true;
        if (!/[.[]/.test(p)) break;
      }
      return false;
    };
    const over = ctx.disclosed.filter((c) => !covered(c));
    if (over.length) return reject("E3", `scope exceeded: ${over.join(",")} (AP6)`);
    ctx.done.push("E3");
  } else ctx.skipped.push("E3");
}

/** A adımının format seçimi: sonucu ortak biçime indirir (B–E iki format için aynı). */
async function formatStep(input: VerifyInput, now: number): Promise<FormatResult> {
  if (input.format === "mso_mdoc_zk") {
    if (!input.responseUri && !input.origin)
      return { ok: false, failedStep: "A1", reason: "responseUri or origin required for mso_mdoc_zk" };
    const pc = input.policy.credentials.find((c) => c.id === input.policyCredentialId);
    return verifyMdocZkFormat(input.presentation, {
      clientId: input.aud,
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
    if (!input.responseUri && !input.origin)
      return { ok: false, failedStep: "A1", reason: "responseUri or origin required for mso_mdoc" };
    return verifyMdocFormat(input.presentation, {
      clientId: input.aud,
      nonce: input.nonce,
      responseUri: input.responseUri ?? "",
      origin: input.origin,
      encJwkThumbprint: input.encJwkThumbprint,
      stateCode: input.policy.trust.state_code,
      now,
      rootCertsDer: input.rootCertsDer,
      expectedDocTypes: input.policy.credentials
        .filter((c) => c.id === input.policyCredentialId)
        .flatMap((c) => c.vct_values),
    });
  }
  const r = await verifySdJwtVc(input.presentation, {
    aud: input.aud,
    nonce: input.nonce,
    stateCode: input.policy.trust.state_code,
    now,
    rootCertsDer: input.rootCertsDer,
    requireKb: true,
    allowMissingVctIntegrity: true, // B4 karar verir: Tamga türünde zorunlu, dış türde (AB PID) isteğe bağlı
  });
  if (!r.ok) return { ok: false, failedStep: r.failedStep, reason: r.reason };
  return {
    ok: true,
    format: "dc+sd-jwt",
    issuerId: r.issuerId,
    vct: r.vct,
    vctIntegrity: r.vctIntegrity,
    anchorFingerprint: r.anchorFingerprint,
    iat: r.iat,
    category: r.category,
    claims: r.claims,
    disclosedClaimNames: r.disclosedClaimNames,
    status: r.status,
    aDone: ["A1", "A2", "A3", "A3b", "A3d", "A4", "A5", "A6", "A7", "A8"],
    aSkipped: ["A3c"], // A3c CRL/OCSP: dev PKI'da yok
  };
}
