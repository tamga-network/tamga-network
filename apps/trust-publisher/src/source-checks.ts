/**
 * Kayıt kaynağının (`registry/*.source.json`) yayın öncesi denetimleri — saf fonksiyonlar; `cli.ts` `build` imzalamadan önce,
 * kayıt komutları da kaynağı yazmadan önce çağırır. Sorun varsa yayın durur (hiçbir alan sessizce atılmaz).
 *
 *  - SPEC-TRUST-0001 TL11: imzalı listeye yalnız BİLİNEN alanlar girer. Kaynak kayıtları listeye yayılarak kopyalandığından
 *    (`...rest`) izin listesi olmadan kaynağa yazılan her alan herkese açık ve kalıcı listeye çıkardı. Bilinmeyen alan hatadır.
 *    Hesaplanan alanlar (`issuer_id`, `ca_id`, `rp_id`, `client_id`, parmak izleri; ADR-0034 CI3) kaynakta yazılamaz — izin
 *    listesinde yoktur.
 *  - ADR-0075 RO5: `dns_name` kimliktir; kaynakta iki kayıtta bulunamaz (harf büyüklüğü ve sondaki nokta sayılmadan) ve liste
 *    biçiminde yazılır (küçük harfli etiketler, sonda nokta yok).
 *  - SPEC-TRUST-0001 TL1: liste aşamasında liste işletmecisi `provisional`dır ve kimin adına çalıştığı (`on_behalf_of`) boş olmaz.
 *  - ADR-0070 OP2: geçici işletmeci değeri (`provisional-operator.json`) gerçek ağ kayıt defterinde zorunludur; sandbox istisnası
 *    açık koşula bağlıdır (`operatorConfigProblems`).
 */
import { DNS_NAME_RE } from "@tamga-network/trust";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

const set = (...k: string[]) => new Set(k);
/** ADR-0024 kayıt verisi (belge veren ve doğrulayıcıda ortak). */
const REGISTRATION = [
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

/** Kayıt türü → kaynakta bulunabilecek alanlar. Yeni alan: önce şartname (SPEC-TRUST-0001 §3–§4), sonra buraya. */
export const SOURCE_FIELDS = {
  tl: set(
    "list_format_version",
    "list_type",
    "environment",
    "state_code",
    "next_update_days",
    "operator",
    "root_cas",
    "issuers",
    "relying_parties",
    "national_schemas",
  ),
  operator: set("name", "status", "on_behalf_of", "note"),
  lotl_operator: set(
    "name",
    "status",
    "on_behalf_of",
    "note",
    "trust_framework",
    "transparency_report",
    "lote_contact",
  ),
  root_ca: set(
    "cert",
    "legal_name",
    "service_type",
    "operator",
    "status",
    "valid_from",
    "valid_until",
    "successor_ca_id",
    "status_history",
  ),
  status_history: set("status", "since", "reason", "invalidates_from", "reassigned_to"),
  issuer: set(
    "cert",
    "status_cert",
    "parent_ca",
    "slug",
    "legal_name",
    "category",
    "assurance",
    "class",
    "assurance_basis",
    "issuer_url",
    "status_list_base",
    "status",
    "valid_from",
    "valid_until",
    "successor_id",
    "status_history",
    "schema_authorizations",
    "delegate_keys",
    "authentic_source",
    "test_institution",
    "revocation_policy_uri",
    "operator",
    "lote_contact",
    ...REGISTRATION,
  ),
  schema_authorization: set("vct", "allowed", "valid_from", "valid_until"),
  delegate_key: set("fingerprint_sha256", "purpose", "status", "valid_from", "valid_to"),
  relying_party: set(
    "access_cert",
    "dns_name",
    "legal_name",
    "status",
    "registered_at",
    "status_history",
    "scopes",
    "terminal_groups",
    "operator",
    "pseudonyms",
    "uses_intermediaries",
    "served_relying_parties",
    ...REGISTRATION,
  ),
  scope: set(
    "scope_id",
    "service_id",
    "purpose",
    "purpose_localized",
    "vct",
    "claims",
    "valid_from",
    "valid_until",
    "privacy_policy_uri",
    "format",
    "mdoc_namespace",
  ),
  terminal_group: set(
    "group_id",
    "institution_id",
    "label",
    "allowed_policies",
    "cert_fingerprints",
    "offline_allowed",
    "valid_from",
    "valid_until",
  ),
  contact: set("support_uri", "email", "phone"),
  postal_address: set("street_address", "locality", "postal_code", "country"),
  supervisory_authority: set("name", "country", "email", "phone", "form_uri", "info_uri"),
  identifier: set("scheme", "value", "note"),
  schema: set(
    "schema_id",
    "vct",
    "metadata_url",
    "content_hash",
    "content_hashes",
    "layer",
    "governance",
    "status",
    "registered_at",
    "status_history",
  ),
  lotl: set(
    "list_format_version",
    "list_type",
    "environment",
    "next_update_days",
    "operator",
    "catalogue",
    "anchor_signing_certs",
    "national_lists",
    "eaa_categories",
    "wallet_providers",
    "pid_providers",
    "lote",
    "zk_circuits",
    "external_lists",
  ),
  catalogue: set("url", "note"),
  lote: set("enabled", "note"),
  national_list: set(
    "state_code",
    "status",
    "membership",
    "list_url",
    "operator",
    "signing_certs",
    "xml_signing_certs",
    "roles",
    "recognition",
  ),
  role: set("status", "operated_by", "cert", "signing_certs", "wrprc", "note"),
  recognition: set("mode", "recognizes"),
  wallet_provider: set(
    "provider_id",
    "legal_name",
    "identifiers",
    "wua_signing_certs",
    "lote_supply_point",
    "lote_contact",
    "postal_address",
    "contact",
    "note",
    "solutions",
    "status",
    "status_history",
  ),
  solution: set("solution_id", "min_version", "status", "security_level", "lote_service_name", "note"),
  zk_circuit: set("circuit_id", "system", "version", "attributes", "sha256", "status", "note"),
  external_list: set(
    "list_id",
    "territory",
    "format",
    "list_url",
    "signing_keys",
    "operator",
    "status",
    "scope",
    "approval",
  ),
  external_scope: set("entity_kinds", "vct", "category", "assurance", "class", "recognized_by", "min_key_storage"),
  external_operator: set("name", "note"),
  external_approval: set("approved_at", "ref"),
  signing_key: set("fingerprint_sha256", "status", "valid_from", "valid_to"),
} as const;
type Kind = keyof typeof SOURCE_FIELDS;

const isObj = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isObj) : []);

function unknownKeys(out: string[], kind: Kind, where: string, v: unknown) {
  if (!isObj(v)) return;
  for (const k of Object.keys(v))
    if (!SOURCE_FIELDS[kind].has(k)) out.push(`${where}: bilinmeyen alan "${k}" (${kind}) — listeye girmez`);
}
function registrationKeys(out: string[], where: string, r: Rec) {
  unknownKeys(out, "contact", `${where}.contact`, r.contact);
  unknownKeys(out, "postal_address", `${where}.postal_address`, r.postal_address);
  unknownKeys(out, "supervisory_authority", `${where}.supervisory_authority`, r.supervisory_authority);
  arr(r.identifiers).forEach((x, i) => unknownKeys(out, "identifier", `${where}.identifiers[${i}]`, x));
  unknownKeys(out, "operator", `${where}.operator`, r.operator);
  arr(r.status_history).forEach((h, i) => unknownKeys(out, "status_history", `${where}.status_history[${i}]`, h));
}

/** Ülke listesi kaynağındaki bilinmeyen alanlar (TL11). `extraIssuers`: sandbox'ta kendi kendine açılmış test kurumları. */
export function tlSourceFieldProblems(tlSrc: Rec, extraIssuers: Rec[] = []): string[] {
  const out: string[] = [];
  unknownKeys(out, "tl", "tl", tlSrc);
  unknownKeys(out, "operator", "tl.operator", tlSrc.operator);
  for (const r of arr(tlSrc.root_cas)) {
    const w = `root_cas ${String(r.cert)}`;
    unknownKeys(out, "root_ca", w, r);
    unknownKeys(out, "operator", `${w}.operator`, r.operator);
    arr(r.status_history).forEach((h, i) => unknownKeys(out, "status_history", `${w}.status_history[${i}]`, h));
  }
  for (const r of [...arr(tlSrc.issuers), ...extraIssuers]) {
    const w = `issuer ${String(r.slug)}`;
    unknownKeys(out, "issuer", w, r);
    registrationKeys(out, w, r);
    arr(r.schema_authorizations).forEach((a, i) =>
      unknownKeys(out, "schema_authorization", `${w}.schema_authorizations[${i}]`, a),
    );
    arr(r.delegate_keys).forEach((k, i) => unknownKeys(out, "delegate_key", `${w}.delegate_keys[${i}]`, k));
  }
  for (const r of arr(tlSrc.relying_parties)) {
    const w = `relying_party ${String(r.dns_name)}`;
    unknownKeys(out, "relying_party", w, r);
    registrationKeys(out, w, r);
    for (const s of arr(r.scopes)) unknownKeys(out, "scope", `${w}.scopes[${String(s.scope_id)}]`, s);
    for (const g of arr(r.terminal_groups))
      unknownKeys(out, "terminal_group", `${w}.terminal_groups[${String(g.group_id)}]`, g);
  }
  for (const s of arr(tlSrc.national_schemas)) {
    const w = `national_schemas ${String(s.vct)}`;
    unknownKeys(out, "schema", w, s);
    arr(s.status_history).forEach((h, i) => unknownKeys(out, "status_history", `${w}.status_history[${i}]`, h));
  }
  return out;
}

/** LOTL kaynağındaki bilinmeyen alanlar (TL11). */
export function lotlSourceFieldProblems(lotlSrc: Rec): string[] {
  const out: string[] = [];
  unknownKeys(out, "lotl", "lotl", lotlSrc);
  unknownKeys(out, "lotl_operator", "lotl.operator", lotlSrc.operator);
  unknownKeys(out, "catalogue", "lotl.catalogue", lotlSrc.catalogue);
  unknownKeys(out, "lote", "lotl.lote", lotlSrc.lote);
  for (const n of arr(lotlSrc.national_lists)) {
    const w = `national_lists ${String(n.state_code)}`;
    unknownKeys(out, "national_list", w, n);
    unknownKeys(out, "operator", `${w}.operator`, n.operator);
    unknownKeys(out, "recognition", `${w}.recognition`, n.recognition);
    if (isObj(n.roles)) for (const [k, v] of Object.entries(n.roles)) unknownKeys(out, "role", `${w}.roles.${k}`, v);
  }
  for (const p of arr(lotlSrc.wallet_providers)) {
    const w = `wallet_providers ${String(p.provider_id)}`;
    unknownKeys(out, "wallet_provider", w, p);
    unknownKeys(out, "contact", `${w}.contact`, p.contact);
    unknownKeys(out, "postal_address", `${w}.postal_address`, p.postal_address);
    arr(p.identifiers).forEach((x, i) => unknownKeys(out, "identifier", `${w}.identifiers[${i}]`, x));
    arr(p.status_history).forEach((h, i) => unknownKeys(out, "status_history", `${w}.status_history[${i}]`, h));
    for (const s of arr(p.solutions)) unknownKeys(out, "solution", `${w}.solutions[${String(s.solution_id)}]`, s);
  }
  for (const z of arr(lotlSrc.zk_circuits)) unknownKeys(out, "zk_circuit", `zk_circuits ${String(z.circuit_id)}`, z);
  for (const e of arr(lotlSrc.external_lists)) {
    const w = `external_lists ${String(e.list_id)}`;
    unknownKeys(out, "external_list", w, e);
    unknownKeys(out, "external_scope", `${w}.scope`, e.scope);
    unknownKeys(out, "external_operator", `${w}.operator`, e.operator);
    unknownKeys(out, "external_approval", `${w}.approval`, e.approval);
    arr(e.signing_keys).forEach((k, i) => unknownKeys(out, "signing_key", `${w}.signing_keys[${i}]`, k));
  }
  return out;
}

/** Karşılaştırma biçimi: küçük harf, sondaki nokta(lar) yok — `Shop.Example.` ile `shop.example` aynı addır. */
export const normalizeDnsName = (name: unknown) =>
  String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");

/**
 * ADR-0075 RO5 — kaynaktaki doğrulayıcı adları: liste biçiminde yazılmış olmalı (küçük harfli etiketler, sonda nokta yok) ve
 * durumu ne olursa olsun bir ad yalnız BİR kayıtta bulunmalı (yeniden kayıt aynı kayda yeni dönem olarak eklenir).
 */
export function relyingPartyNameProblems(rps: Rec[]): string[] {
  const out: string[] = [];
  const seen = new Map<string, number>();
  rps.forEach((r, i) => {
    const raw = String(r.dns_name ?? "");
    if (!raw) return; // "dns_name yok" build'de ayrıca bildirilir
    const key = normalizeDnsName(raw);
    if (raw.endsWith(".")) out.push(`relying_party ${raw}: dns_name sonda nokta taşıyamaz (ADR-0075) — "${key}" yazın`);
    else if (!DNS_NAME_RE.test(raw.toLowerCase()))
      out.push(
        `relying_party ${raw}: dns_name alan adı biçiminde değil (küçük harf/rakam/tire etiketler, noktayla ayrılmış)`,
      );
    const first = seen.get(key);
    if (first !== undefined)
      out.push(
        `relying_party ${key}: dns_name iki kayıtta (${first + 1}. ve ${i + 1}.) — ad ikinci kez kaydedilmez; yeniden kayıt ` +
          "aynı kayda yeni dönem olarak eklenir (ADR-0075 RO5)",
      );
    else seen.set(key, i);
  });
  return out;
}

/**
 * SPEC-TRUST-0001 TL1 — liste işletmecisi (ülke listesi, LOTL ve LOTL'daki ülke slotları): liste aşamasında `provisional` ve
 * `on_behalf_of` dolu. (Yükleyici şeması `designated` değerini de tanır; o değerle yayın devir kararından sonra açılır.)
 */
export function listOperatorProblems(ops: Array<[where: string, op: unknown]>): string[] {
  const out: string[] = [];
  for (const [where, op] of ops) {
    if (!isObj(op)) {
      out.push(`${where}: operator yok (TL1)`);
      continue;
    }
    if (op.status !== "provisional")
      out.push(`${where}: operator.status "${String(op.status)}" — liste aşamasında "provisional" olmalı (TL1)`);
    if (typeof op.on_behalf_of !== "string" || !op.on_behalf_of.trim())
      out.push(`${where}: operator.on_behalf_of boş bırakılamaz (TL1)`);
  }
  return out;
}

/**
 * ADR-0070 OP2 — geçici işletmeci değeri yoksa ne olur:
 *  - gerçek ağ kayıt defteri: değer ZORUNLU; dosya yoksa yayın durur (önce: denetim sessizce atlanıyordu).
 *  - sandbox kayıt defteri (`environment: "sandbox"`, ADR-0038): değer istenmez — test ağının işletmecisi kurgusaldır. İstisna açık
 *    koşula bağlıdır: liste işletmecisi adları "(TEST)" işareti taşır (SB1 adlandırması) ve gerçek ağın adıyla ("Tamga Network")
 *    aynı değildir; aksi hâlde yayın durur. Sandbox kayıt defterine değer dosyası konursa olağan denetim uygulanır.
 * Dosya varsa denetimi `checkProvisionalOperator` yapar; bu fonksiyon yalnız dosyanın YOKLUĞUNU değerlendirir.
 */
export function missingOperatorConfigProblems(
  environment: "production" | "sandbox",
  ops: Array<[where: string, op: unknown]>,
): string[] {
  if (environment !== "sandbox")
    return ["provisional-operator.json yok — gerçek ağ kayıt defterinde geçici işletmeci değeri zorunlu (OP2)"];
  const out: string[] = [];
  for (const [where, op] of ops) {
    const name = isObj(op) ? String(op.name ?? "") : "";
    if (!/\(TEST\)/.test(name) || name === "Tamga Network")
      out.push(
        `${where}: sandbox liste işletmecisi adı "(TEST)" işareti taşımalı ("${name}") — geçici işletmeci değeri olmadan ` +
          "yayın yalnız bu koşulla (OP2 sandbox istisnası)",
      );
  }
  return out;
}

/**
 * Herkese açık ve kalıcı listeye giren iletişim alanının biçimi (ADR-0024; SPEC-TRUST-0001 §4): `support_uri` bir https adresi,
 * `email` bir e-posta adresi, `phone` uluslararası biçimde bir numara. Kişiye ait olup olmadığı makinece denetlenemez (kurumun
 * görev adresi olmalı — şartname); burada yalnız biçim.
 */
export function contactProblems(where: string, c: unknown): string[] {
  if (!isObj(c)) return [];
  const out: string[] = [];
  if (c.support_uri !== undefined && !/^https:\/\/[^\s/?#]+\.[^\s/?#]+([/?#]\S*)?$/.test(String(c.support_uri)))
    out.push(`${where}: contact.support_uri https adresi olmalı`);
  if (c.email !== undefined && !/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;.]+$/.test(String(c.email)))
    out.push(`${where}: contact.email e-posta adresi biçiminde olmalı`);
  if (c.phone !== undefined && !/^\+[0-9][0-9 ()-]{5,22}$/.test(String(c.phone)))
    out.push(`${where}: contact.phone uluslararası biçimde olmalı (+ ülke kodu, rakamlar)`);
  return out;
}
