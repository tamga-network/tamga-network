/**
 * Credential fabrikası — kaynak kayıt → şema doğrulama → türetilmiş claim'ler → SD-JWT VC (batch, her kopya farklı cnf).
 *  CMP5/E11: eşlemede karşılığı olmayan veri için DUR (tahmin üretme) — çağıran (adaptör) sağlar; burada şema uyumsuzluğu hata.
 *  PR6: batch'teki her kopya farklı cihaz anahtarı. PR7: bağlama yöntemi credential'a yazılmaz (denetim kaydına).
 *  Şema: @tamga-network/schemas Type Metadata claims[].sd politikası + JSON Schema (ajv 2020-12).
 */
import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";
type ValidateFn = ((data: unknown) => boolean) & { errors?: Array<{ instancePath: string; message?: string }> | null };
interface AjvLike {
  addSchema(schema: object, id: string): unknown;
  getSchema(id: string): ValidateFn | undefined;
  compile(schema: object): ValidateFn;
}
type AjvCtor = new (opts?: object) => AjvLike;
// ajv CJS: NodeNext altında default/`module.exports` ikiliği — çalışma zamanında hangisi varsa
const Ajv2020 = (_Ajv2020 as unknown as { default?: AjvCtor }).default ?? (_Ajv2020 as unknown as AjvCtor);
const addFormats =
  (_addFormats as unknown as { default?: (a: AjvLike) => void }).default ??
  (_addFormats as unknown as (a: AjvLike) => void);
import type { JWK } from "jose";
import { createHash, X509Certificate } from "node:crypto";
import { issueSdJwtVc, type IssuerSigner, type SdPolicy } from "@tamga-network/sd-jwt";
import { ALL as SCHEMA_DEFS, type SchemaDef } from "@tamga-network/schemas";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
// $ref'ler ../../core/... göreli; kök tipin $defs'ini id ile kaydet
for (const d of SCHEMA_DEFS) ajv.addSchema(d.jsonSchema, (d.jsonSchema as { $id: string }).$id);

export function schemaDef(vct: string): SchemaDef {
  const d = SCHEMA_DEFS.find((s) => s.vct === vct);
  if (!d) throw new Error(`bilinmeyen vct: ${vct}`);
  return d;
}
type ClaimMeta = { path: Array<string | null>; sd: SdPolicy };
const claimsOf = (def: SchemaDef) => (def.typeMetadata.claims as ClaimMeta[] | undefined) ?? [];
/** Kök claim'lerin seçici açıklama politikası (Type Metadata `path: [ad]`). */
export function sdPolicyOf(def: SchemaDef): Record<string, SdPolicy> {
  return Object.fromEntries(
    claimsOf(def)
      .filter((c) => c.path.length === 1 && typeof c.path[0] === "string")
      .map((c) => [c.path[0] as string, c.sd]),
  );
}
/** Öğeleri ayrı ayrı açıklanan diziler (Type Metadata `path: [ad, null]`, sd ≠ never — RFC 9901 §4.2.2, ADR-0045). */
export function arrayElementSdOf(def: SchemaDef): string[] {
  return claimsOf(def)
    .filter((c) => c.path.length === 2 && typeof c.path[0] === "string" && c.path[1] === null && c.sd !== "never")
    .map((c) => c.path[0] as string);
}

/**
 * Bağlanamaz zaman alanları (RFC 9901 §10.1; AB ARF bağlanamazlık): belgenin `iat`/`exp`'i (mdoc `signed`/`validFrom`/
 * `validUntil`) verme anını saniyesiyle taşımaz — saat başına AŞAĞI yuvarlanır. `iat` geleceğe kaymaz; `exp` istenen/sınırlanan
 * bitişi geçmez (ISSU_12c bakım süresi sınırı korunur). Yuvarlanmış bitiş `now`'u geçmiyorsa (bir saatten kısa ömür) `exp`
 * olduğu gibi kalır. Aynı paketteki bütün kopyalar aynı değerleri alır.
 * `acceptableAt` verilirse ve yuvarlanmış `iat` anında belge doğrulanamayacaksa (imza sertifikası ya da kurumun listedeki
 * yetkisi o saatten sonra başladıysa — A3 / C1) `iat = now` kalır: doğrulanabilirlik bağlanamazlıktan önce gelir.
 */
export const TIME_CLAIM_GRANULARITY_SEC = 3600;
export function unlinkableTimeClaims(
  now: number,
  exp?: number,
  opts: { acceptableAt?: (t: number) => boolean } = {},
): { iat: number; exp?: number } {
  const g = TIME_CLAIM_GRANULARITY_SEC;
  const rounded = now - (now % g);
  const iat = !opts.acceptableAt || opts.acceptableAt(rounded) ? rounded : now;
  if (exp === undefined) return { iat };
  const e = exp - (exp % g);
  return { iat, exp: e > now ? e : exp };
}
/** Sertifika zincirinin (DER; yaprak + ara) her öğesi `t` anında (Unix saniyesi) geçerli mi — `unlinkableTimeClaims` için. */
export function certsValidAt(ders: readonly Uint8Array[], t: number): boolean {
  return ders.every((d) => {
    const c = new X509Certificate(Buffer.from(d));
    return Date.parse(c.validFrom) / 1000 <= t && t <= Date.parse(c.validTo) / 1000;
  });
}

export interface BuildInput {
  vct: string;
  vctIntegrity: string;
  signer: IssuerSigner;
  iss: string;
  claims: Record<string, unknown>; // adaptörden gelen alan seti (kişisel veri dahil; hiçbir yerde loglanmaz)
  cnfJwks: JWK[]; // batch: her kopya için farklı holder anahtarı (PR6)
  iat: number;
  exp?: number;
  statusFor?: (copyIndex: number) => { idx: number; uri: string }; // uses_status_list ise zorunlu
  category?: "urn:tamga:eaa:pub" | "urn:tamga:eaa:qualified";
}
export interface BuiltCredential {
  combined: string;
  idx?: number;
  cnfThumb: string;
}

/**
 * PR6 (SPEC-PROTO-0001 §8.2): bir isteğin kanıtlarındaki anahtarlar birbirinden farklı mı. Kural İSTEK başınadır (ADR-0059 notu):
 * aynı erişim belirteciyle sonraki istekte daha önce kullanılmış bir anahtar gelirse bu kural onu görmez; kopyaların bağlanamazlığı
 * cüzdanın sorumluluğudur. Belge veren farklı değilse `invalid_proof` döner (standart kod; §13).
 */
export function distinctCnfKeys(jwks: ReadonlyArray<Pick<JWK, "x" | "y">>): boolean {
  const seen = new Set<string>();
  for (const k of jwks) {
    const thumb = `${k.x}.${k.y}`;
    if (seen.has(thumb)) return false;
    seen.add(thumb);
  }
  return true;
}

export async function buildCredentials(input: BuildInput): Promise<BuiltCredential[]> {
  const def = schemaDef(input.vct);
  const tamga = def.typeMetadata.tamga as { uses_status_list?: boolean; default_ttl_days?: number | null };
  if (tamga.uses_status_list && !input.statusFor) throw new Error("schema requires a status list (E5)");
  if (tamga.default_ttl_days && !input.exp) throw new Error("schema requires exp (E4)");
  if (tamga.default_ttl_days && input.exp && input.exp - input.iat > tamga.default_ttl_days * 86400)
    throw new Error(`E9: exp − iat > ${tamga.default_ttl_days} days`);
  // Kopyalar arasında değişmeyen kısmı JSON Schema ile doğrula (cnf/status temsili değerlerle)
  const sample = {
    iss: input.iss,
    vct: input.vct,
    "vct#integrity": input.vctIntegrity,
    iat: input.iat,
    ...(input.exp ? { exp: input.exp } : {}),
    cnf: {},
    ...(tamga.uses_status_list ? { status: { status_list: { idx: 0, uri: "https://status.tamga.network/x" } } } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...input.claims,
  };
  const validate = ajv.getSchema((def.jsonSchema as { $id: string }).$id) ?? ajv.compile(def.jsonSchema);
  if (!validate(sample)) {
    const paths = (validate.errors ?? []).map(
      (e: { instancePath: string; message?: string }) => `${e.instancePath || "/"} ${e.message}`,
    );
    throw new Error("schema mismatch: " + paths.join("; ")); // alan ADI ve kural; değer yok (PR8)
  }
  const policy = sdPolicyOf(def);
  const arrayElementSd = arrayElementSdOf(def);
  const seen = new Set<string>();
  const out: BuiltCredential[] = [];
  for (let i = 0; i < input.cnfJwks.length; i++) {
    const jwk = input.cnfJwks[i];
    const thumb = `${jwk.x}.${jwk.y}`;
    if (seen.has(thumb)) throw new Error("PR6: batch copies must not share a key");
    seen.add(thumb);
    const st = input.statusFor?.(i);
    const r = await issueSdJwtVc({
      signer: input.signer,
      iss: input.iss,
      vct: input.vct,
      vctIntegrity: input.vctIntegrity,
      iat: input.iat,
      exp: input.exp,
      cnfJwk: jwk,
      status: st ? { status_list: st } : undefined,
      category: input.category,
      claims: input.claims,
      sdPolicy: policy,
      ...(arrayElementSd.length ? { arrayElementSd } : {}),
    });
    out.push({ combined: r.combined, idx: st?.idx, cnfThumb: thumb });
  }
  return out;
}

/** Eğitim türetilmiş claim'leri (SPEC-SCHEMA-0002 derived_claims): kaynak kayıt → claim seti. Eşleme yoksa DUR. */
export function mapStudentRecord(
  rec: {
    family_name: string;
    given_name: string;
    birth_date: string;
    programme_title_tr: string;
    programme_title_en?: string;
    isced_f_code?: string | null;
    study_level: number;
    enrollment_year: number;
    student_status: "ACTIVE" | "ON_LEAVE";
    faculty_tr?: string;
    expected_graduation_year?: number;
    /** StudentCredential 1.1.0 (AB EUHEPOE): program iş yükü (AKTS) ve kayıt tarihi */
    programme_credit_points?: number;
    enrollment_date?: string;
  },
  body: { name_tr: string; name_en?: string; id: string; country: string },
) {
  if (!rec.isced_f_code) throw new Error("CMP5/E11: no ISCED-F mapping — issuance stopped");
  const lang = (tr: string, en?: string) => (en ? { "tr-TR": tr, "en-US": en } : { "tr-TR": tr });
  return {
    family_name: rec.family_name,
    given_name: rec.given_name,
    birth_date: rec.birth_date,
    awarding_body_name: lang(body.name_tr, body.name_en),
    awarding_body_id: body.id,
    awarding_body_country: body.country,
    student_status: rec.student_status,
    enrollment_year: rec.enrollment_year,
    study_level: rec.study_level,
    programme_title: lang(rec.programme_title_tr, rec.programme_title_en),
    isced_f_code: rec.isced_f_code,
    ...(rec.faculty_tr ? { faculty_name: lang(rec.faculty_tr) } : {}),
    ...(rec.expected_graduation_year ? { expected_graduation_year: rec.expected_graduation_year } : {}),
    ...(typeof rec.programme_credit_points === "number" ? { credit_points: rec.programme_credit_points } : {}),
    ...(rec.enrollment_date ? { enrollment_date: rec.enrollment_date } : {}),
    is_enrolled: rec.student_status === "ACTIVE" || rec.student_status === "ON_LEAVE",
  };
}
/**
 * D10 — bilet kaydı → EventTicket claim'leri. Kişisel veri yok: alıcı adı/e-postası belgeye GİRMEZ (cihaz bağlaması yeter);
 * `ticket_no_hash` satıcının bilet numarasının hash'i (satıcı kendi tarafında eşler). `gate`: kapı doğrulayıcısı (ADR-0012 B).
 */
export function mapEventTicket(
  ticket: { ticket_no: string; ticket_class: string; seat?: string },
  event: {
    id: string;
    name: string;
    start: string;
    end: string;
    venue: string;
    organizer: string;
    gate: { terminal_group: string; verifier_client_id: string; policy_id?: string };
  },
) {
  return {
    event_id: event.id,
    event_name: event.name,
    event_start: event.start,
    event_end: event.end,
    venue_name: event.venue,
    organizer_name: event.organizer,
    ticket_class: ticket.ticket_class,
    ...(ticket.seat ? { seat: ticket.seat } : {}),
    ticket_no_hash: "sha256-" + createHash("sha256").update(ticket.ticket_no).digest("base64url"),
    gate: event.gate,
  };
}
export function mapGraduateRecord(
  rec: {
    family_name: string;
    given_name: string;
    birth_date: string;
    qualification_tr: string;
    qualification_en?: string;
    eqf_level: number;
    isced_f_code?: string | null;
    awarding_date: string;
    grade?: string;
    thesis_title_tr?: string;
    mode_of_study?: "FULL_TIME" | "PART_TIME" | "DISTANCE" | "BLENDED";
  },
  body: { name_tr: string; name_en?: string; id: string; country: string },
) {
  if (!rec.isced_f_code) throw new Error("CMP5/E11: no ISCED-F mapping — issuance stopped");
  const lang = (tr: string, en?: string) => (en ? { "tr-TR": tr, "en-US": en } : { "tr-TR": tr });
  return {
    family_name: rec.family_name,
    given_name: rec.given_name,
    birth_date: rec.birth_date,
    awarding_body_name: lang(body.name_tr, body.name_en),
    awarding_body_id: body.id,
    awarding_body_country: body.country,
    qualification_title: lang(rec.qualification_tr, rec.qualification_en),
    eqf_level: rec.eqf_level,
    isced_f_code: rec.isced_f_code,
    awarding_date: rec.awarding_date,
    ...(rec.grade ? { grade: rec.grade } : {}),
    ...(rec.thesis_title_tr ? { thesis_title: lang(rec.thesis_title_tr) } : {}),
    ...(rec.mode_of_study ? { mode_of_study: rec.mode_of_study } : {}),
    is_graduate: true as const,
    graduated_before: Number(rec.awarding_date.slice(0, 4)) + 1,
  };
}
