/**
 * Operatör kayıt aracı — güven listesi kaynağını (`registry/tl-*.source.json`) elle düzenlemeden kurum (belge veren) ve
 * doğrulayıcı eklemek, şema yetkisi vermek/kaldırmak. Saf fonksiyonlar: kaynak nesnesini alır, yenisini döner ya da
 * eksiklerin TAMAMINI tek hatada bildirir (operatör başvuruyu bir kerede düzeltsin). Yazma ve imza `cli.ts`'te.
 *
 * Başvuru dosyası (JSON) kayıt alanlarını taşır; araç durum, tarihçe, geçerlilik ve şema yetkisi alanlarını üretir.
 * Kayıt verisi ADR-0024 (RPR1–RPR3) ile denetlenir; eksik zorunlu alan varsa kayıt yapılmaz.
 */
import { issuerGaps, issuerEntitlements, rpGaps } from "./registration.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

/** SPEC-BC-0001 kapalı kümeler (packages/trust Issuer şeması ile aynı). */
export const CATEGORIES = ["GOVERNMENT", "IDENTITY", "EDUCATION", "HEALTH", "FINANCE", "LOGISTICS", "OTHER", "EVENTS"];
export const CLASSES = ["PUB", "QUALIFIED", "EAA"];
export const ASSURANCES = ["I1", "I2", "I3"];

export interface RegistryEnv {
  now: Date;
  /** Sertifika adı `ops/pki`'de (ya da pilotta sertifika deposunda) var mı */
  certExists: (ref: string) => boolean;
  /** Şema kataloğundaki vct'ler */
  knownVcts: Set<string>;
}

export class RegistryError extends Error {
  constructor(readonly problems: string[]) {
    super("kayıt yapılamadı:\n  - " + problems.join("\n  - "));
    this.name = "RegistryError";
  }
}

const SLUG = /^[a-z0-9-]{3,32}$/;
const iso = (d: Date) => d.toISOString();
const plusYears = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCFullYear(x.getUTCFullYear() + n);
  return x;
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/**
 * Belge veren başvurusu. Zorunlu: slug, legal_name, category, class, assurance, cert, vcts[] + ADR-0024 kayıt verisi.
 * İsteğe bağlı: parent_ca (varsayılan ilk kök), status_cert, issuer_url (varsayılan barındırılan adres), valid_years (2),
 * assurance_basis, authentic_source.
 */
/** Doldurulmamış yer tutucu (`[DOLDURULACAK]`) taşıyan başvuru kayda girmez (ör. registry/pending/). */
const placeholderProblems = (app: Rec) =>
  JSON.stringify(app).includes("[DOLDURULACAK]") ? ["doldurulmamış alan var ([DOLDURULACAK])"] : [];

export function addIssuer(src: Rec, app: Rec, env: RegistryEnv): Rec {
  const p: string[] = [...placeholderProblems(app)];
  const issuers = (src.issuers ?? []) as Rec[];
  const roots = (src.root_cas ?? []) as Rec[];
  if (!SLUG.test(String(app.slug ?? ""))) p.push("slug: 3–32 küçük harf, rakam ya da tire");
  else if (issuers.some((i) => i.slug === app.slug)) p.push(`slug zaten kayıtlı: ${app.slug}`);
  if (!app.legal_name) p.push("legal_name");
  if (!CATEGORIES.includes(app.category)) p.push(`category: ${CATEGORIES.join(" | ")}`);
  if (!CLASSES.includes(app.class)) p.push(`class: ${CLASSES.join(" | ")}`);
  if (!ASSURANCES.includes(app.assurance)) p.push(`assurance: ${ASSURANCES.join(" | ")}`);
  if (app.class === "QUALIFIED" && app.assurance !== "I3") p.push("QUALIFIED sınıfı I3 güvence gerektirir");
  if (!app.cert) p.push("cert (sertifika adı)");
  else if (!env.certExists(app.cert)) p.push(`sertifika bulunamadı: ${app.cert}`);
  else if (issuers.some((i) => i.cert === app.cert)) p.push(`sertifika başka bir kurumda kullanılıyor: ${app.cert}`);
  if (app.status_cert && !env.certExists(app.status_cert))
    p.push(`iptal listesi sertifikası bulunamadı: ${app.status_cert}`);
  const parent = app.parent_ca ?? roots[0]?.cert;
  if (!roots.some((r) => r.cert === parent)) p.push(`parent_ca kök listede yok: ${parent}`);
  const vcts = (app.vcts ?? []) as string[];
  if (!Array.isArray(vcts) || !vcts.length) p.push("vcts: en az bir belge türü");
  for (const v of vcts) if (!env.knownVcts.has(v)) p.push(`şema katalogda yok: ${v}`);
  for (const g of issuerGaps(app)) p.push(`kayıt verisi eksik (ADR-0024): ${g}`);
  if (p.length) throw new RegistryError(p);

  const now = iso(env.now);
  const { vcts: _v, valid_years, parent_ca: _p, ...fields } = app as Rec & { valid_years?: number };
  const slug = app.slug as string;
  const rec: Rec = {
    cert: app.cert,
    ...(app.status_cert ? { status_cert: app.status_cert } : {}),
    parent_ca: parent,
    ...fields,
    issuer_url: app.issuer_url ?? `https://issuer.tamga.network/${slug}`,
    status_list_base: app.status_list_base ?? "https://status.tamga.network/",
    status: "ACTIVE",
    valid_from: now,
    valid_until: iso(plusYears(env.now, Number(valid_years ?? 2))),
    successor_id: null,
    status_history: [{ status: "ACTIVE", since: now, reason: "initial-registration" }],
    entitlements: app.entitlements ?? issuerEntitlements(app.class),
    schema_authorizations: vcts.map((vct) => ({ vct, allowed: true, valid_from: now, valid_until: null })),
  };
  const out = clone(src);
  out.issuers = [...issuers, rec];
  return out;
}

/**
 * Doğrulayıcı başvurusu. Zorunlu: dns_name (erişim sertifikasının SAN'ındaki alan adı; ADR-0034), legal_name, access_cert, scopes[] (scope_id, purpose, vct, claims,
 * privacy_policy_uri) + ADR-0024 kayıt verisi. Kapsam süresi varsayılan 1 yıl.
 */
export function addRelyingParty(src: Rec, app: Rec, env: RegistryEnv): Rec {
  const p: string[] = [...placeholderProblems(app)];
  const rps = (src.relying_parties ?? []) as Rec[];
  if (app.client_id !== undefined)
    p.push("client_id başvuruda verilmez: yayıncı erişim sertifikasından x509_hash olarak hesaplar (ADR-0034)");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(String(app.dns_name ?? "")))
    p.push("dns_name: alan adı (ör. shop.example.com)");
  else if (rps.some((r) => r.dns_name === app.dns_name)) p.push(`dns_name zaten kayıtlı: ${app.dns_name}`);
  if (!app.legal_name) p.push("legal_name");
  if (!app.access_cert) p.push("access_cert (erişim sertifikası adı)");
  else if (!env.certExists(app.access_cert)) p.push(`sertifika bulunamadı: ${app.access_cert}`);
  else if (rps.some((r) => r.access_cert === app.access_cert))
    p.push(`sertifika başka bir doğrulayıcıda kullanılıyor: ${app.access_cert}`);
  const scopes = (app.scopes ?? []) as Rec[];
  if (!scopes.length) p.push("scopes: en az bir kullanım");
  p.push(...scopeProblems(scopes, env));
  for (const g of rpGaps(app)) p.push(`kayıt verisi eksik (ADR-0024): ${g}`);
  if (p.length) throw new RegistryError(p);

  const now = iso(env.now);
  const rec: Rec = {
    ...app,
    status: "ACTIVE",
    registered_at: now,
    status_history: [{ status: "ACTIVE", since: now, reason: "initial-registration" }],
    scopes: scopes.map((s) => withScopeDates(s, env.now)),
  };
  const out = clone(src);
  out.relying_parties = [...rps, rec];
  return out;
}

/** Kayıtlı doğrulayıcıya yeni kullanım (kapsam) ekler. */
export function addScope(src: Rec, dnsName: string, scope: Rec, env: RegistryEnv): Rec {
  const out = clone(src);
  const rp = ((out.relying_parties ?? []) as Rec[]).find((r) => r.dns_name === dnsName);
  if (!rp) throw new RegistryError([`doğrulayıcı yok: ${dnsName}`]);
  const p = scopeProblems([scope], env);
  if ((rp.scopes as Rec[]).some((s) => s.scope_id === scope.scope_id)) p.push(`scope_id zaten var: ${scope.scope_id}`);
  if (p.length) throw new RegistryError(p);
  rp.scopes.push(withScopeDates(scope, env.now));
  return out;
}

/** Şema yetkisi verir ya da kaldırır (kayıt silinmez; `allowed: false` + bitiş tarihi — geçmiş belgeler C2'de doğru kalır). */
export function setAuthorization(src: Rec, slug: string, vct: string, allowed: boolean, env: RegistryEnv): Rec {
  const out = clone(src);
  const i = ((out.issuers ?? []) as Rec[]).find((x) => x.slug === slug);
  if (!i) throw new RegistryError([`kurum yok: ${slug}`]);
  if (!env.knownVcts.has(vct)) throw new RegistryError([`şema katalogda yok: ${vct}`]);
  const now = iso(env.now);
  const list = i.schema_authorizations as Rec[];
  const cur = list.find((a) => a.vct === vct && a.allowed && !a.valid_until);
  if (allowed) {
    if (cur) throw new RegistryError([`${slug} zaten yetkili: ${vct}`]);
    list.push({ vct, allowed: true, valid_from: now, valid_until: null });
  } else {
    if (!cur) throw new RegistryError([`${slug} bu türe yetkili değil: ${vct}`]);
    cur.valid_until = now;
  }
  return out;
}

/** Operatör özeti: kurumlar ve doğrulayıcılar, durum ve eksik kayıt verisi. */
export function summarize(src: Rec): string[] {
  const lines: string[] = [];
  for (const i of (src.issuers ?? []) as Rec[]) {
    const vcts = (i.schema_authorizations as Rec[]).filter((a) => a.allowed && !a.valid_until).map((a) => a.vct);
    const gaps = issuerGaps(i);
    lines.push(
      `kurum        ${i.slug.padEnd(14)} ${String(i.status).padEnd(9)} ${i.category}/${i.class}/${i.assurance}  ${vcts.length} tür` +
        (gaps.length ? `  eksik: ${gaps.join(", ")}` : ""),
    );
  }
  for (const r of (src.relying_parties ?? []) as Rec[]) {
    const gaps = rpGaps(r);
    lines.push(
      `doğrulayıcı  ${String(r.dns_name).padEnd(40)} ${String(r.status).padEnd(9)} ${(r.scopes as Rec[]).length} kullanım` +
        (gaps.length ? `  eksik: ${gaps.join(", ")}` : ""),
    );
  }
  return lines;
}

function scopeProblems(scopes: Rec[], env: RegistryEnv): string[] {
  const p: string[] = [];
  const ids = new Set<string>();
  for (const s of scopes) {
    const id = String(s.scope_id ?? "");
    if (!/^[a-z0-9-]{3,64}$/.test(id)) p.push(`scope_id: küçük harf/rakam/tire (${id || "boş"})`);
    else if (ids.has(id)) p.push(`scope_id yinelenmiş: ${id}`);
    ids.add(id);
    if (!s.purpose) p.push(`scopes[${id}].purpose`);
    if (!env.knownVcts.has(s.vct)) p.push(`scopes[${id}].vct katalogda yok: ${s.vct}`);
    if (!Array.isArray(s.claims)) p.push(`scopes[${id}].claims (dizi; boş dizi = yalnız sahiplik)`);
    if (!s.privacy_policy_uri) p.push(`scopes[${id}].privacy_policy_uri`);
  }
  return p;
}

function withScopeDates(s: Rec, now: Date): Rec {
  const { valid_years, ...rest } = s as Rec & { valid_years?: number };
  return {
    ...rest,
    valid_from: s.valid_from ?? iso(now),
    valid_until: s.valid_until ?? iso(plusYears(now, Number(valid_years ?? 1))),
  };
}
