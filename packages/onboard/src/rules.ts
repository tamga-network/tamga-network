/**
 * Başvuru dosyası kuralları — kurum kendi bilgisayarında, operatöre göndermeden önce denetler. Kurallar operatörün kayıt aracıyla
 * (`apps/trust-publisher/src/registry-ops.ts` + `registration.ts`) AYNIDIR; eşitlik `rules.test.ts`'te iki kural kümesi aynı
 * başvurularla çalıştırılarak denetlenir (biri değişirse test düşer). Ek olarak burada kurum tarafına özgü denetimler var: bilinmeyen
 * alan (kişi bilgisi başvuruya girmesin), kimlik numarası biçimi ve sağlaması, https adresleri, ISCED-F biçimi.
 *
 * ADR-0024 (kayıt verisi), ADR-0031 PS3 (sunulamayan tür), ADR-0034 (client_id başvuruda verilmez), ADR-0047 K2, ADR-0050.
 * Saf fonksiyonlar: dosya, ağ ve saat yok.
 */
import { ALL, NON_PRESENTABLE_VCTS } from "@tamga-network/schemas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

/** SPEC-BC-0001 kapalı kümeler (`@tamga-network/trust` Issuer şeması ile aynı). */
export const CATEGORIES = ["GOVERNMENT", "IDENTITY", "EDUCATION", "HEALTH", "FINANCE", "LOGISTICS", "OTHER", "EVENTS"];
export const CLASSES = ["PUB", "QUALIFIED", "EAA"];
export const ASSURANCES = ["I1", "I2", "I3"];
export const ENTITLEMENTS = [
  "service_provider",
  "qeaa_provider",
  "non_q_eaa_provider",
  "pub_eaa_provider",
  "pid_provider",
];
export const SCOPE_FORMATS = ["dc+sd-jwt", "mso_mdoc", "mso_mdoc_zk"];
/** Katalogdaki belge türleri (vct). */
export const KNOWN_VCTS: ReadonlySet<string> = new Set(ALL.map((d) => d.vct));

/** Başvuru dosyasında bulunabilecek alanlar — başka alan (ör. yetkili kişinin adı) kayda ve listeye girmesin diye reddedilir. */
const REG_FIELDS = [
  "legal_name",
  "trade_name",
  "identifiers",
  "postal_address",
  "info_uri",
  "contact",
  "service_description",
  "is_public_sector_body",
  "entitlements",
  "supervisory_authority",
];
export const ISSUER_FIELDS: ReadonlySet<string> = new Set([
  ...REG_FIELDS,
  "slug",
  "category",
  "class",
  "assurance",
  "assurance_basis",
  "cert",
  "status_cert",
  "parent_ca",
  "vcts",
  "issuer_url",
  "status_list_base",
  "valid_years",
  "authentic_source",
  "revocation_policy_uri",
]);
export const RP_FIELDS: ReadonlySet<string> = new Set([
  ...REG_FIELDS,
  "dns_name",
  "access_cert",
  "scopes",
  "pseudonyms",
  "uses_intermediaries",
  "served_relying_parties",
]);
const SCOPE_FIELDS = new Set([
  "scope_id",
  "purpose",
  "purpose_localized",
  "vct",
  "claims",
  "privacy_policy_uri",
  "service_id",
  "format",
  "mdoc_namespace",
  "valid_years",
]);
const CONTACT_FIELDS = new Set(["support_uri", "email", "phone"]);

export const SLUG_RE = /^[a-z0-9-]{3,32}$/;
export const DNS_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
export const CERT_NAME_RE = /^(issuer|rp)-[a-z0-9-]{2,40}$/;
const SCOPE_ID_RE = /^[a-z0-9-]{3,64}$/;

export interface Findings {
  /** Operatörün kayıt aracının da reddedeceği ya da kurum tarafında kesin hata */
  problems: string[];
  /** Kayıt reddetmez ama düzeltilmesi beklenir (ör. sağlaması tutmayan kimlik numarası, karar gerektiren sınıf) */
  warnings: string[];
}

const isHttps = (v: unknown) => {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:" && !/\s/.test(v);
  } catch {
    return false;
  }
};
const hasContact = (c: Rec | undefined) => !!c && !!(c.support_uri || c.email || c.phone);
const hasDpaRoute = (d: Rec | undefined) => !!d && !!d.name && !!d.country && !!(d.email || d.phone || d.form_uri);

/** ADR-0024 K2: belge veren kaydının eksik zorunlu alanları (kayıt aracı `issuerGaps` ile aynı). */
export function issuerGaps(i: Rec): string[] {
  const g: string[] = [];
  if (!i.trade_name) g.push("trade_name");
  if (!i.identifiers?.length) g.push("identifiers");
  if (!i.postal_address?.street_address || !i.postal_address?.country) g.push("postal_address");
  if (!hasContact(i.contact)) g.push("contact");
  if (!hasDpaRoute(i.supervisory_authority)) g.push("supervisory_authority");
  return g;
}

/** ADR-0024 K1, RPR1, RPR3: doğrulayıcı kaydının eksik zorunlu alanları (kayıt aracı `rpGaps` ile aynı). */
export function rpGaps(rp: Rec): string[] {
  const g: string[] = [];
  if (!rp.trade_name) g.push("trade_name");
  if (!rp.identifiers?.length) g.push("identifiers");
  if (!rp.postal_address?.street_address || !rp.postal_address?.country) g.push("postal_address");
  if (!hasContact(rp.contact)) g.push("contact");
  if (!rp.service_description || !Object.keys(rp.service_description).length) g.push("service_description");
  if (typeof rp.is_public_sector_body !== "boolean") g.push("is_public_sector_body");
  if (!rp.entitlements?.length) g.push("entitlements");
  if (!hasDpaRoute(rp.supervisory_authority)) g.push("supervisory_authority");
  for (const s of (rp.scopes ?? []) as Rec[])
    if (!s.privacy_policy_uri) g.push(`scopes[${s.scope_id}].privacy_policy_uri`);
  return g;
}

/** Türkiye vergi kimlik numarası (10 hane) sağlaması. */
export function vknChecksumOk(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const t = (Number(digits[i]) + 9 - i) % 10;
    let k = (t * 2 ** (9 - i)) % 9;
    if (t !== 0 && k === 0) k = 9;
    sum += k;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[9]);
}

/**
 * Kayıttaki kurum kimlik numarası → sertifikadaki `organizationIdentifier` (EN 319 412-1; ADR-0026 K3, ADR-0050):
 * `TR-VKN` `TR<10 hane>` → `VATTR-<10 hane>`; `TR-MERSIS` `TR<16 hane>` → `NTRTR-<16 hane>`. Biçim tutmazsa `null`.
 */
export function organizationIdentifier(id: { scheme?: string; value?: string } | undefined): string | null {
  const v = String(id?.value ?? "");
  if (id?.scheme === "TR-VKN" && /^TR\d{10}$/.test(v)) return `VATTR-${v.slice(2)}`;
  if (id?.scheme === "TR-MERSIS" && /^TR\d{16}$/.test(v)) return `NTRTR-${v.slice(2)}`;
  return null;
}

/** ISCED-F 2013 ayrıntılı alan kodu: 4 hane, ilk iki hane geniş alan 00–10 (ya da bilinmeyen için 9999). */
export function iscedFOk(code: unknown): boolean {
  if (typeof code !== "string" || !/^\d{4}$/.test(code)) return false;
  return code === "9999" || Number(code.slice(0, 2)) <= 10;
}

function identifierFindings(app: Rec, f: Findings) {
  const ids = (app.identifiers ?? []) as Rec[];
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    if (id?.scheme === "TR-VKN") {
      if (!/^TR\d{10}$/.test(String(id.value ?? ""))) f.problems.push("identifiers: TR-VKN değeri TR + 10 hane olmalı");
      else if (/^TR0{10}$/.test(id.value))
        f.warnings.push("identifiers: TR-VKN örnek değer (TR0000000000) — gerçek numara");
      else if (!vknChecksumOk(id.value.slice(2)))
        f.warnings.push("identifiers: TR-VKN sağlaması tutmuyor — numarayı kontrol edin");
    } else if (id?.scheme === "TR-MERSIS") {
      if (!/^TR\d{16}$/.test(String(id.value ?? "")))
        f.problems.push("identifiers: TR-MERSIS değeri TR + 16 hane olmalı");
    } else if (id?.scheme) {
      f.warnings.push(
        `identifiers: ${id.scheme} — sertifika için kurum kimlik numarası TR-VKN ya da TR-MERSIS olmalı (ADR-0050)`,
      );
    } else f.problems.push("identifiers: scheme ve value");
  }
  if (ids.length && !ids.some((x) => organizationIdentifier(x)))
    f.problems.push("identifiers: sertifikaya yazılacak geçerli TR-VKN ya da TR-MERSIS yok (ADR-0050)");
}

function commonFindings(app: Rec, allowed: ReadonlySet<string>, f: Findings) {
  if (JSON.stringify(app).includes("[DOLDURULACAK]")) f.problems.push("doldurulmamış alan var ([DOLDURULACAK])");
  for (const k of Object.keys(app))
    if (!allowed.has(k))
      f.problems.push(
        `bilinmeyen alan: ${k} — başvuru yalnız kayıt alanlarını taşır (kişi adı, imza yetkilisi gibi bilgiler bu dosyaya girmez)`,
      );
  if (app.contact && typeof app.contact === "object")
    for (const k of Object.keys(app.contact))
      if (!CONTACT_FIELDS.has(k)) f.problems.push(`bilinmeyen alan: contact.${k}`);
  if (app.contact?.support_uri !== undefined && !isHttps(app.contact.support_uri))
    f.problems.push("contact.support_uri: https adresi olmalı");
  if (app.contact?.email !== undefined && !/^[A-Za-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(String(app.contact.email)))
    f.problems.push("contact.email: geçerli bir e-posta adresi (kurumsal; kişisel adres yazılmaz)");
  if (app.info_uri !== undefined && !isHttps(app.info_uri)) f.problems.push("info_uri: https adresi olmalı");
  const country = app.postal_address?.country;
  if (country !== undefined && !/^[A-Z]{2}$/.test(String(country)))
    f.problems.push("postal_address.country: iki büyük harf ülke kodu (ör. TR)");
  const sa = app.supervisory_authority;
  if (sa?.country !== undefined && !/^[A-Z]{2}$/.test(String(sa.country)))
    f.problems.push("supervisory_authority.country: iki büyük harf ülke kodu");
  for (const k of ["form_uri", "info_uri"])
    if (sa?.[k] !== undefined && !isHttps(sa[k])) f.problems.push(`supervisory_authority.${k}: https adresi olmalı`);
  if (app.entitlements !== undefined)
    for (const e of Array.isArray(app.entitlements) ? app.entitlements : [app.entitlements])
      if (!ENTITLEMENTS.includes(e)) f.problems.push(`entitlements: ${ENTITLEMENTS.join(" | ")} (${e})`);
  identifierFindings(app, f);
}

export interface RuleOptions {
  /** Katalogdaki vct'ler (varsayılan: bu paketin sürümündeki `@tamga-network/schemas` kataloğu) */
  knownVcts?: ReadonlySet<string>;
}

/**
 * Belge veren başvurusu (`<slug>.issuer.json`). Kayıt aracının kuralları + kurum tarafı denetimler. Sertifika dosyasının varlığı ve
 * kökün listede olması operatörde denetlenir (burada yalnız adların biçimi).
 */
export function validateIssuerApplication(app: Rec, o: RuleOptions = {}): Findings {
  const f: Findings = { problems: [], warnings: [] };
  if (!app || typeof app !== "object" || Array.isArray(app))
    return { problems: ["başvuru bir JSON nesnesi olmalı"], warnings: [] };
  const known = o.knownVcts ?? KNOWN_VCTS;
  commonFindings(app, ISSUER_FIELDS, f);
  if (!SLUG_RE.test(String(app.slug ?? ""))) f.problems.push("slug: 3–32 küçük harf, rakam ya da tire");
  if (!app.legal_name) f.problems.push("legal_name");
  if (!CATEGORIES.includes(app.category)) f.problems.push(`category: ${CATEGORIES.join(" | ")}`);
  if (!CLASSES.includes(app.class)) f.problems.push(`class: ${CLASSES.join(" | ")}`);
  if (!ASSURANCES.includes(app.assurance)) f.problems.push(`assurance: ${ASSURANCES.join(" | ")}`);
  if (app.class === "QUALIFIED" && app.assurance !== "I3") f.problems.push("QUALIFIED sınıfı I3 güvence gerektirir");
  if (app.class === "PUB")
    f.warnings.push("class PUB (kamu belgesi): kime verileceği proje yönetiminin kararıdır — operatörle görüşün");
  if (!app.cert) f.problems.push("cert (sertifika adı)");
  else if (!CERT_NAME_RE.test(app.cert) || !String(app.cert).startsWith("issuer-"))
    f.problems.push("cert: issuer-<ad> (küçük harf, rakam, tire)");
  if (app.status_cert !== undefined && (!CERT_NAME_RE.test(app.status_cert) || !app.status_cert.startsWith("issuer-")))
    f.problems.push("status_cert: issuer-<ad>-status");
  if (app.status_cert === undefined)
    f.warnings.push("status_cert yok: iptal listesi ayrı anahtarla imzalanmalı (issuer-<slug>-status)");
  const vcts = app.vcts as unknown;
  if (!Array.isArray(vcts) || !vcts.length) f.problems.push("vcts: en az bir belge türü");
  else for (const v of vcts) if (!known.has(v)) f.problems.push(`şema katalogda yok: ${v}`);
  for (const g of issuerGaps(app)) f.problems.push(`kayıt verisi eksik (ADR-0024): ${g}`);
  if (app.revocation_policy_uri !== undefined && !/^https:\/\/[^\s]+$/.test(String(app.revocation_policy_uri)))
    f.problems.push("revocation_policy_uri: https adresi olmalı");
  for (const k of ["issuer_url", "status_list_base"])
    if (app[k] !== undefined && !isHttps(app[k])) f.problems.push(`${k}: https adresi olmalı`);
  if ((app.issuer_url === undefined) !== (app.status_list_base === undefined))
    f.warnings.push(
      "kendi servisi olan kurum issuer_url ile status_list_base'i birlikte verir (biri yoksa barındırılan adres)",
    );
  if (app.valid_years !== undefined && !(Number(app.valid_years) >= 1 && Number(app.valid_years) <= 3))
    f.problems.push("valid_years: 1–3");
  return f;
}

/** Doğrulayıcı başvurusu (`<ad>.rp.json`) — kimlik eşleştirme kaydı (barındırılan kurum) da bu biçimdedir. */
export function validateRpApplication(app: Rec, o: RuleOptions = {}): Findings {
  const f: Findings = { problems: [], warnings: [] };
  if (!app || typeof app !== "object" || Array.isArray(app))
    return { problems: ["başvuru bir JSON nesnesi olmalı"], warnings: [] };
  const known = o.knownVcts ?? KNOWN_VCTS;
  if (app.client_id !== undefined)
    f.problems.push(
      "client_id başvuruda verilmez: yayıncı erişim sertifikasından x509_hash olarak hesaplar (ADR-0034)",
    );
  // client_id yukarıda kendi iletisiyle; "bilinmeyen alan" olarak ikinci kez yazılmasın
  commonFindings(app, new Set([...RP_FIELDS, "client_id"]), f);
  if (!DNS_RE.test(String(app.dns_name ?? ""))) f.problems.push("dns_name: alan adı (ör. shop.example.com)");
  if (!app.legal_name) f.problems.push("legal_name");
  if (!app.access_cert) f.problems.push("access_cert (erişim sertifikası adı)");
  else if (!CERT_NAME_RE.test(app.access_cert) || !String(app.access_cert).startsWith("rp-"))
    f.problems.push("access_cert: rp-<ad> (küçük harf, rakam, tire)");
  const scopes = (app.scopes ?? []) as Rec[];
  if (!Array.isArray(scopes) || !scopes.length) f.problems.push("scopes: en az bir kullanım");
  else f.problems.push(...scopeProblems(scopes, known));
  for (const g of rpGaps(app)) f.problems.push(`kayıt verisi eksik (ADR-0024): ${g}`);
  if (app.pseudonyms !== undefined && app.pseudonyms !== "single" && app.pseudonyms !== "multiple")
    f.problems.push(`pseudonyms: "single" ya da "multiple"`);
  if (app.service_description && typeof app.service_description === "object" && !app.service_description["en-US"])
    f.warnings.push("service_description: İngilizce (en-US) açıklama da verin (cüzdan dile göre gösterir)");
  return f;
}

function scopeProblems(scopes: Rec[], known: ReadonlySet<string>): string[] {
  const p: string[] = [];
  const ids = new Set<string>();
  for (const s of scopes) {
    const id = String(s?.scope_id ?? "");
    if (!SCOPE_ID_RE.test(id)) p.push(`scope_id: küçük harf/rakam/tire (${id || "boş"})`);
    else if (ids.has(id)) p.push(`scope_id yinelenmiş: ${id}`);
    ids.add(id);
    for (const k of Object.keys(s ?? {})) if (!SCOPE_FIELDS.has(k)) p.push(`bilinmeyen alan: scopes[${id}].${k}`);
    if (!s?.purpose) p.push(`scopes[${id}].purpose`);
    if (!known.has(s?.vct)) p.push(`scopes[${id}].vct katalogda yok: ${s?.vct}`);
    if (NON_PRESENTABLE_VCTS.includes(s?.vct)) p.push(`scopes[${id}] sunulamayan bir tür istiyor (${s.vct}; PS3)`);
    if (!Array.isArray(s?.claims)) p.push(`scopes[${id}].claims (dizi; boş dizi = yalnız sahiplik)`);
    if (!s?.privacy_policy_uri) p.push(`scopes[${id}].privacy_policy_uri`);
    else if (!isHttps(s.privacy_policy_uri)) p.push(`scopes[${id}].privacy_policy_uri: https adresi olmalı`);
    if (s?.format !== undefined && !SCOPE_FORMATS.includes(s.format))
      p.push(`scopes[${id}].format: ${SCOPE_FORMATS.join(" | ")}`);
    if (s?.format && s.format !== "dc+sd-jwt" && !s.mdoc_namespace)
      p.push(`scopes[${id}].mdoc_namespace: mdoc biçimli kullanımda zorunlu`);
  }
  return p;
}

/** Başvuru türünü içerikten anlar: `slug` + `vcts` → belge veren; `dns_name` + `scopes` → doğrulayıcı. */
export function applicationKind(app: Rec): "issuer" | "rp" | null {
  if (!app || typeof app !== "object") return null;
  if ("dns_name" in app || "scopes" in app || "access_cert" in app) return "rp";
  if ("slug" in app || "vcts" in app || "cert" in app) return "issuer";
  return null;
}

/** Türünü kendisi bulup doğrular. */
export function validateApplication(app: Rec, o: RuleOptions & { kind?: "issuer" | "rp" } = {}) {
  const kind = o.kind ?? applicationKind(app);
  if (!kind)
    return {
      kind: null,
      problems: ["başvuru türü anlaşılamadı (belge veren: slug + vcts; doğrulayıcı: dns_name + scopes)"],
      warnings: [],
    };
  return { kind, ...(kind === "issuer" ? validateIssuerApplication(app, o) : validateRpApplication(app, o)) };
}
