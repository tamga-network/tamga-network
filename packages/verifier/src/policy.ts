/**
 * Politika — SPEC-API-0001 §4.4: tek kaynak; hem DCQL sorgusunu (SPEC-PROTO-0002 §4) hem E1–E3 adımlarını besler.
 * AP6: politikadaki required_claims RP'nin kayıtlı scope'unu aşamaz — politika yüklenirken reddedilir.
 */
import type { RelyingParty, ZkCircuit } from "@tamga-network/trust";

export type Assurance = "I1" | "I2" | "I3";
export interface PolicyCredential {
  id: string;
  vct_values: string[];
  required_claims: string[];
  constraints?: Record<string, unknown | { min?: number; max?: number }>;
  /**
   * D-CRED-5: istenen temsil. Varsayılan `dc+sd-jwt`; `mso_mdoc` için docType = vct_values[0], namespace zorunlu.
   * `mso_mdoc_zk` (ADR-0032): sıfır bilgi ispatı — yalnız eşitlik kısıtlı öğeler (ör. age_over_18 = true); devreler imzalı
   * listeden (`dcqlFromPolicy(p, { zkCircuits })`). Cüzdan ZK yapamıyorsa doğrulayıcı klasik `mso_mdoc` politikasına döner (ZK5).
   */
  format?: "dc+sd-jwt" | "mso_mdoc" | "mso_mdoc_zk";
  namespace?: string;
  /**
   * OpenID4VP 1.0 §6.1.1 / HAIP §5: veri azaltma: cüzdan yalnız bu otoritelerce onaylanmış issuer'ların belgelerini önerir
   * (tip `aki` = issuer sertifikasının AKI'si, base64url; `akiValuesFromCaCerts` ile). Doğrulayıcı güveni yine kendisi denetler.
   */
  trusted_authorities?: Array<{ type: "aki" | "etsi_tl" | "openid_federation"; values: string[] }>;
  /**
   * ADR-0032 ZK4: ZK sunumunda iptal listesi indeksi gelmez → iptal denetlenemez (K6; ADR-0032 uygulama notu). `true`: bu
   * bilinerek kabul edilir (sonuç `status.value = NOT_APPLICABLE`, `status.reason` ile). `false`: iptal denetlenemediği için
   * DOĞRULANAMADI (D1). Verilmezse `false` sayılır (ADR-0044/ZC4: politika açıkça kabul etmedikçe DOĞRULANAMADI; 0.3.1'e
   * kadar varsayılan `true` idi) — ZK sunumunu kabul edecek politika `true`'yu AÇIKÇA yazmalıdır.
   */
  accept_unrevocable_zk?: boolean;
}
export interface Policy {
  policy_id: string;
  purpose: Record<string, string>;
  credentials: PolicyCredential[];
  trust: {
    min_issuer_assurance: Assurance;
    allowed_categories: string[];
    require_recognition: boolean;
    state_code: string;
  };
  freshness: {
    max_status_token_age_sec: number;
    max_trust_age_sec: number;
    /** D5 saat karşılaştırmalarında issuer / yayıncı / doğrulayıcı saatleri arası tolerans (varsayılan 120 sn). */
    max_clock_skew_sec?: number;
  };
  /** ADR-0012 B: kabulde geçiş kartı (pass_grant) verilir. `single_use` (K4): kart ilk GEÇ'te tüketilir (bilet). */
  proximity?: { terminal_group: string; valid_days: number; single_use?: boolean };
  /**
   * ADR-0031: site başına takma ad iste (hesap anahtarı). `multiple` yalnız RP kaydı `pseudonyms: "multiple"` ise (K4).
   * `credentials` boş olabilir: yalnız takma adla giriş (hiçbir belge alanı istenmez).
   */
  pseudonym?: { mode?: "single" | "multiple" };
}

export interface DcqlQuery {
  credentials: Array<{
    id: string;
    /** `tamga-pseudonym`: ADR-0031 takma ad sorgusu (Tamga profili; `claims` boş, `meta.mode`) */
    format: "dc+sd-jwt" | "mso_mdoc" | "mso_mdoc_zk" | "tamga-pseudonym";
    meta:
      | { vct_values: string[] }
      | { doctype_value: string }
      | { doctype_value: string; zk_system_type: ZkSystemType[] }
      | { mode: "single" | "multiple" };
    claims: Array<{ path: Array<string | number | null>; values?: unknown[] }>;
    trusted_authorities?: Array<{ type: string; values: string[] }>;
  }>;
}

/** ADR-0031: takma ad sorgusunun DCQL kimliği (vp_token anahtarı). */
export const PSEUDONYM_QUERY_ID = "pseudonym";

/** AB TS13 DCQL `meta.zk_system_type` girdisi (Tamga profili: `zkSystemId` = devre kimliği). */
export interface ZkSystemType {
  zkSystemId: string;
  system: "longfellow-libzk-v1";
  params: { circuit_hash: string; num_attributes: number; version: number };
}

export function dcqlFromPolicy(p: Policy, opts: { zkCircuits?: ZkCircuit[] } = {}): DcqlQuery {
  const pseudonym = p.pseudonym
    ? [
        {
          id: PSEUDONYM_QUERY_ID,
          format: "tamga-pseudonym" as const,
          meta: { mode: p.pseudonym.mode === "multiple" ? ("multiple" as const) : ("single" as const) },
          claims: [],
        },
      ]
    : [];
  return {
    credentials: [
      ...p.credentials.map((c) => {
        const zk = c.format === "mso_mdoc_zk";
        const mdoc = c.format === "mso_mdoc" || zk;
        if (mdoc && !c.namespace) throw new Error(`policy ${p.policy_id}: namespace required for ${c.format}`);
        // ADR-0032: ZK sorgusu imzalı listedeki, istenen öğe sayısına uyan ETKİN devreleri önerir (ZK2)
        const zkTypes: ZkSystemType[] = zk
          ? (opts.zkCircuits ?? [])
              .filter((z) => z.status === "ACTIVE" && z.attributes === c.required_claims.length)
              .map((z) => ({
                zkSystemId: z.circuit_id,
                system: z.system,
                params: { circuit_hash: z.circuit_id, num_attributes: z.attributes, version: z.version },
              }))
          : [];
        if (zk && !zkTypes.length) throw new Error(`policy ${p.policy_id}: no trusted ZK circuit for ${c.id}`);
        if (
          zk &&
          c.required_claims.some((n) => c.constraints?.[n] === undefined || typeof c.constraints[n] === "object")
        )
          throw new Error(`policy ${p.policy_id}: mso_mdoc_zk supports equality constraints only`);
        // SD-JWT: claim yolu [ad] · mdoc (OpenID4VP DCQL): [namespace, element]
        // ADR-0036: SD-JWT iç içe yol (address.country → ["address","country"]; nationalities[0] → ["nationalities",0])
        const sdPath = (name: string): Array<string | number> =>
          (name.match(/[^.[\]]+|\[\d+\]/g) ?? [name]).map((t) => (t.startsWith("[") ? Number(t.slice(1, -1)) : t));
        const path = (name: string) => (mdoc ? [c.namespace!, name] : sdPath(name));
        return {
          id: c.id,
          format: zk ? ("mso_mdoc_zk" as const) : mdoc ? ("mso_mdoc" as const) : ("dc+sd-jwt" as const),
          meta: zk
            ? { doctype_value: c.vct_values[0], zk_system_type: zkTypes }
            : mdoc
              ? { doctype_value: c.vct_values[0] }
              : { vct_values: c.vct_values },
          claims: c.required_claims.map((name) => {
            const cons = c.constraints?.[name];
            const isEq = cons !== undefined && (typeof cons !== "object" || cons === null);
            return isEq ? { path: path(name), values: [cons] } : { path: path(name) };
          }),
          ...(c.trusted_authorities?.length ? { trusted_authorities: c.trusted_authorities } : {}),
        };
      }),
      ...pseudonym,
    ],
  };
}

/**
 * Kapsam denetimi (AP6/E3 ortak): alan kapsamda kendisi ya da bir atası varsa izinli (iç içe yol: address → address.locality,
 * nationalities → nationalities[0]).
 */
export function scopeCovers(allowed: Set<string>, claim: string): boolean {
  for (let p = claim; p; p = p.replace(/(\.[^.[\]]+|\[\d+\])$/, "")) {
    if (allowed.has(p)) return true;
    if (!/[.[]/.test(p)) break;
  }
  return false;
}

/** AP6 — politika RP'nin kayıtlı scope'unu aşıyorsa hata listesi döner (boş = uygun). */
export function policyScopeViolations(p: Policy, rp: RelyingParty | null, now = Date.now()): string[] {
  if (!rp) return ["relying party not registered"];
  const out: string[] = [];
  // ADR-0031 K4: birden çok takma ad yalnız kaydında izin olan sitede
  if (p.pseudonym?.mode === "multiple" && (rp as { pseudonyms?: string }).pseudonyms !== "multiple")
    out.push("pseudonym.multiple outside registration");
  for (const c of p.credentials) {
    const allowed = new Set(
      rp.scopes
        .filter(
          (s) =>
            c.vct_values.includes(s.vct) &&
            new Date(s.valid_from).getTime() <= now &&
            (!s.valid_until || now < new Date(s.valid_until).getTime()),
        )
        .flatMap((s) => s.claims),
    );
    for (const cl of c.required_claims) if (!scopeCovers(allowed, cl)) out.push(`${c.id}.${cl} outside scope`);
  }
  return out;
}

/**
 * ADR-0026: her DCQL sorgusunu karşılayan TEK kullanım (aynı vct, geçerli, istenen alanların tamamı kapsamda). Kayıt sertifikası
 * kullanım başınadır; sorgu birden çok kullanıma yayılıyorsa ya da hiçbiri tam karşılamıyorsa o sorgu için sertifika eklenmez.
 */
export function registrationScopesFor(
  p: Policy,
  rp: RelyingParty | null,
  now = Date.now(),
): Array<{ queryId: string; scopeId: string }> {
  if (!rp) return [];
  const out: Array<{ queryId: string; scopeId: string }> = [];
  for (const c of p.credentials) {
    const s = rp.scopes.find(
      (x) =>
        c.vct_values.includes(x.vct) &&
        new Date(x.valid_from).getTime() <= now &&
        (!x.valid_until || now < new Date(x.valid_until).getTime()) &&
        c.required_claims.every((cl) => x.claims.includes(cl)),
    );
    if (s) out.push({ queryId: c.id, scopeId: s.scope_id });
  }
  return out;
}

const rank: Record<Assurance, number> = { I1: 1, I2: 2, I3: 3 };
export const assuranceAtLeast = (have: Assurance, min: Assurance) => rank[have] >= rank[min];

export function constraintOk(value: unknown, cons: unknown): boolean {
  if (cons !== null && typeof cons === "object" && !Array.isArray(cons)) {
    const c = cons as { min?: number; max?: number };
    if (typeof value !== "number") return false;
    if (c.min !== undefined && value < c.min) return false;
    if (c.max !== undefined && value > c.max) return false;
    return true;
  }
  return JSON.stringify(value) === JSON.stringify(cons);
}
