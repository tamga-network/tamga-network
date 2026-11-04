/**
 * `tamga-onboard init` — kurumun yanıtlarından (etkileşimli ya da dosyadan) operatöre gidecek başvuru dosyalarını üretir:
 *   `<slug>.issuer.json`   belge veren kaydı (kayıt aracının `trust:register issuer` girdisi)
 *   `<ad>.rp.json`         doğrulayıcı kaydı ya da barındırılan kurumun kimlik eşleştirme kaydı (`trust:register rp`)
 *   `onboarding.json`      kurumun yerel dosyası: rol, ortam, alan adı, sorgu ucu, ISCED-F kodları, anahtar adları
 * Kişi bilgisi yok: yetkili adı, imza yetkilisi, personel sorulmaz; yanıtlarda bilinmeyen alan reddedilir. Kayıt kuralları `rules.ts`.
 * ADR-0024 (kayıt verisi), ADR-0050 (kurum sertifikası), ADR-0057 (barındırılan servis), runbook §A.1 (kimlik eşleştirme kaydı).
 */
import type { Environment } from "./network.js";
import { CERT_NAME_RE, DNS_RE, SLUG_RE, iscedFOk, validateIssuerApplication, validateRpApplication } from "./rules.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

export type Role = "issuer" | "verifier";

/** Kurumun yanıtları (`init --from <dosya>` biçimi). Kişi bilgisi alanı yoktur. */
export interface Answers {
  role: Role;
  /** Varsayılan `production` (sandbox'ta kurum "Kurumunu dene" ile test kurumu açar; başvuru dosyası gerekmez) */
  environment?: Environment;
  /** Kalıcı kısa ad (3–32 küçük harf, rakam, tire) — kamuya açıktır, operatörle birlikte seçilir */
  slug: string;
  legal_name: string;
  trade_name?: string;
  identifier: { scheme: "TR-VKN" | "TR-MERSIS"; value: string };
  postal_address: { street_address: string; locality?: string; postal_code?: string; country: string };
  /** Destek adresi (https; erişim sertifikasına da yazılır) + kurumsal e-posta / telefon (kişisel değil) */
  contact: { support_uri: string; email?: string; phone?: string };
  info_uri?: string;
  /** Kurumun alan adı (DNS TXT teyidi bunun üzerinde) */
  domain: string;
  /** Verilmezse ülke TR ise KVKK */
  supervisory_authority?: Rec;
  // ── belge veren
  category?: string;
  class?: string;
  assurance?: string;
  assurance_basis?: string;
  vcts?: string[];
  /** `hosted` (Tamga'nın barındırılan servisi, imza kurumun uzaktan imza hizmetinde) · `own` (kurumun kendi servisi) */
  hosting?: "hosted" | "own";
  issuer_url?: string;
  status_list_base?: string;
  revocation_policy_uri?: string;
  authentic_source?: { name: string; mode?: string };
  /** Kurumun sorgu ucu (examples/05-institution-source); her kayıtta ISCED-F şart */
  lookup_url?: string;
  /** Kurumun program alan kodları (ISCED-F 2013, 4 hane) — biçim denetimi için; listeye girmez */
  isced_f_codes?: string[];
  /** Barındırılan kurumun kimlik eşleştirme kaydı (runbook §A.1): alan adı kurumun kendi alan adı altında */
  identity_matching?: { dns_name?: string; privacy_policy_uri: string };
  // ── doğrulayıcı
  dns_name?: string;
  service_description?: Record<string, string>;
  is_public_sector_body?: boolean;
  scopes?: Rec[];
  pseudonyms?: "single" | "multiple";
}

const ANSWER_FIELDS = new Set([
  "role",
  "environment",
  "slug",
  "legal_name",
  "trade_name",
  "identifier",
  "postal_address",
  "contact",
  "info_uri",
  "domain",
  "supervisory_authority",
  "category",
  "class",
  "assurance",
  "assurance_basis",
  "vcts",
  "hosting",
  "issuer_url",
  "status_list_base",
  "revocation_policy_uri",
  "authentic_source",
  "lookup_url",
  "isced_f_codes",
  "identity_matching",
  "dns_name",
  "service_description",
  "is_public_sector_body",
  "scopes",
  "pseudonyms",
]);

export const KVKK = {
  name: "Kişisel Verileri Koruma Kurumu (KVKK)",
  country: "TR",
  info_uri: "https://www.kvkk.gov.tr",
  form_uri: "https://www.kvkk.gov.tr",
};

/** Kimlik eşleştirme kullanımı (barındırılan kurum; runbook §A.1) */
export const IDENTITY_VCT = "urn:tamga:id:IdentityAttestation:1";
export const IDENTITY_MATCHING_CLAIMS = ["personal_administrative_number", "birthdate"];

export interface Profile {
  tool: "@tamga-network/onboard";
  format: 1;
  role: Role;
  environment: Environment;
  slug: string;
  domain: string;
  hosting?: "hosted" | "own";
  lookup_url?: string;
  isced_f_codes?: string[];
  applications: { issuer?: string; rp?: string };
  /** Kurumun kendi ürettiği anahtarlar (özel anahtar yalnız kurumda) */
  keys: Array<{ name: string; purpose: "credential" | "status" | "access" }>;
  /** Anahtarını operatörün barındırılan servisi üreten kayıtlar (barındırılan kurumun kimlik eşleştirme erişim sertifikası) */
  operator_keys?: string[];
  /** Alan adı teyidi için operatörün verdiği tek kullanımlık değer (DNS TXT) — `check` arar */
  dns_txt?: string;
}

export interface Built {
  problems: string[];
  warnings: string[];
  issuer?: Rec;
  rp?: Rec;
  profile?: Profile;
}

const isHttps = (v: unknown) => {
  try {
    return typeof v === "string" && new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** Yanıtları denetler ve başvuru dosyalarını kurar. Hata varsa `problems` dolu döner (dosya yazılmamalı). */
export function buildApplications(a: Answers): Built {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!a || typeof a !== "object") return { problems: ["yanıtlar bir JSON nesnesi olmalı"], warnings };
  for (const k of Object.keys(a))
    if (!ANSWER_FIELDS.has(k))
      problems.push(`bilinmeyen alan: ${k} — kişi bilgisi (ad, imza yetkilisi, personel) bu dosyalara girmez`);
  if (a.role !== "issuer" && a.role !== "verifier") problems.push("role: issuer | verifier");
  const environment = a.environment ?? "production";
  if (environment !== "production" && environment !== "sandbox") problems.push("environment: production | sandbox");
  if (!SLUG_RE.test(String(a.slug ?? ""))) problems.push("slug: 3–32 küçük harf, rakam ya da tire");
  if (!DNS_RE.test(String(a.domain ?? ""))) problems.push("domain: kurumun alan adı (ör. example.edu.tr)");
  if (a.contact?.email && a.domain && !String(a.contact.email).toLowerCase().endsWith(`@${a.domain}`))
    warnings.push("contact.email kurumun alan adında değil — kurumsal ortak adres önerilir (kişisel adres yazılmaz)");
  const country = a.postal_address?.country;
  const common: Rec = {
    legal_name: a.legal_name,
    trade_name: a.trade_name ?? a.legal_name,
    identifiers: a.identifier ? [{ scheme: a.identifier.scheme, value: a.identifier.value }] : [],
    postal_address: a.postal_address,
    contact: a.contact,
    ...(a.info_uri ? { info_uri: a.info_uri } : {}),
    supervisory_authority: a.supervisory_authority ?? (country === "TR" ? KVKK : undefined),
  };
  if (!a.supervisory_authority && country !== "TR")
    problems.push("supervisory_authority: Türkiye dışında veri koruma makamı (ad, ülke, başvuru yolu) verilmeli");
  const out: Built = { problems, warnings };
  const slug = String(a.slug ?? "");

  if (a.role === "issuer") {
    const hosting = a.hosting ?? "hosted";
    if (hosting !== "hosted" && hosting !== "own") problems.push("hosting: hosted | own");
    if (hosting === "own" && (!isHttps(a.issuer_url) || !isHttps(a.status_list_base)))
      problems.push("kendi servisi (hosting: own): issuer_url ve status_list_base https adresleri");
    if (hosting === "hosted" && (a.issuer_url || a.status_list_base))
      problems.push("barındırılan serviste issuer_url / status_list_base verilmez (operatör atar)");
    if (a.lookup_url !== undefined && !isHttps(a.lookup_url)) problems.push("lookup_url: https adresi olmalı");
    if (hosting === "hosted" && !a.lookup_url)
      warnings.push(
        "lookup_url yok: barındırılan servis kayıtları kurumun sorgu ucundan okur — canlıya almadan önce gerekir",
      );
    for (const c of a.isced_f_codes ?? [])
      if (!iscedFOk(c)) problems.push(`isced_f_codes: ${c} — ISCED-F 2013 ayrıntılı alan kodu, 4 hane (ör. 0613)`);
    out.issuer = {
      slug,
      ...common,
      category: a.category ?? "EDUCATION",
      class: a.class ?? "EAA",
      assurance: a.assurance ?? "I2",
      ...(a.assurance_basis ? { assurance_basis: a.assurance_basis } : {}),
      cert: `issuer-${slug}`,
      status_cert: `issuer-${slug}-status`,
      vcts: a.vcts ?? [],
      ...(hosting === "own" ? { issuer_url: a.issuer_url, status_list_base: a.status_list_base } : {}),
      ...(a.authentic_source ? { authentic_source: a.authentic_source } : {}),
      ...(a.revocation_policy_uri ? { revocation_policy_uri: a.revocation_policy_uri } : {}),
    };
    if (hosting === "hosted") {
      const im = a.identity_matching;
      const dns = im?.dns_name ?? `tamga.${a.domain}`;
      if (!im?.privacy_policy_uri)
        problems.push(
          "identity_matching.privacy_policy_uri: kimlik eşleştirme kullanımının gizlilik politikası (https)",
        );
      if (dns === "issuer.tamga.network")
        problems.push("identity_matching.dns_name: kurumun kendi alan adı altında olmalı");
      else if (a.domain && !dns.endsWith(`.${a.domain}`) && dns !== a.domain)
        warnings.push(
          "identity_matching.dns_name kurumun alan adı altında değil — runbook §A.1: tamga.<kurum alan adı>",
        );
      out.rp = {
        dns_name: dns,
        ...common,
        access_cert: `rp-issuer-${slug}`,
        service_description: {
          "en-US": `Identity matching for ${a.legal_name} credentials issued through the Tamga hosted service.`,
          "tr-TR": `${a.legal_name} belgeleri için kimlik eşleştirme (Tamga barındırılan servisi).`,
        },
        is_public_sector_body: a.is_public_sector_body ?? a.category === "GOVERNMENT",
        entitlements: ["service_provider"],
        scopes: [
          {
            scope_id: `${slug}-identity-matching-1`,
            purpose: "Identity matching before issuing a credential",
            purpose_localized: { "tr-TR": "Belge vermeden önce kimlik eşleştirme" },
            vct: IDENTITY_VCT,
            claims: IDENTITY_MATCHING_CLAIMS,
            privacy_policy_uri: im?.privacy_policy_uri,
          },
        ],
      };
    }
    out.profile = {
      tool: "@tamga-network/onboard",
      format: 1,
      role: "issuer",
      environment,
      slug,
      domain: a.domain,
      hosting,
      ...(a.lookup_url ? { lookup_url: a.lookup_url } : {}),
      ...(a.isced_f_codes?.length ? { isced_f_codes: a.isced_f_codes } : {}),
      applications: { issuer: `${slug}.issuer.json`, ...(out.rp ? { rp: `${slug}.rp.json` } : {}) },
      keys: [
        { name: `issuer-${slug}`, purpose: "credential" },
        { name: `issuer-${slug}-status`, purpose: "status" },
      ],
      ...(out.rp ? { operator_keys: [`rp-issuer-${slug}`] } : {}),
    };
  } else if (a.role === "verifier") {
    const accessCert = `rp-${slug}`;
    if (!CERT_NAME_RE.test(accessCert))
      problems.push("slug: erişim sertifikası adı rp-<slug> olacak biçimde kısa olmalı");
    out.rp = {
      dns_name: a.dns_name ?? a.domain,
      ...common,
      access_cert: accessCert,
      service_description: a.service_description,
      is_public_sector_body: a.is_public_sector_body,
      entitlements: ["service_provider"],
      scopes: a.scopes ?? [],
      ...(a.pseudonyms ? { pseudonyms: a.pseudonyms } : {}),
    };
    out.profile = {
      tool: "@tamga-network/onboard",
      format: 1,
      role: "verifier",
      environment,
      slug,
      domain: a.domain,
      applications: { rp: `${slug}.rp.json` },
      keys: [{ name: accessCert, purpose: "access" }],
    };
  }
  if (out.issuer) {
    const f = validateIssuerApplication(out.issuer);
    problems.push(...f.problems.map((p) => `${out.profile?.applications.issuer}: ${p}`));
    warnings.push(...f.warnings.map((p) => `${out.profile?.applications.issuer}: ${p}`));
  }
  if (out.rp) {
    const f = validateRpApplication(out.rp);
    problems.push(...f.problems.map((p) => `${out.profile?.applications.rp}: ${p}`));
    warnings.push(...f.warnings.map((p) => `${out.profile?.applications.rp}: ${p}`));
  }
  if (environment === "sandbox")
    warnings.push(
      "sandbox için başvuru dosyası gerekmez: sandbox.tamga.network → Kurumunu dene (tamga-onboard sandbox). Bu dosyalar gerçek ağ içindir",
    );
  return { ...out, problems: [...new Set(problems)], warnings: [...new Set(warnings)] };
}

/** Profil dosyasını (onboarding.json) denetler — elle düzenlenmişse bilinmeyen alan ya da bozuk değer kalmasın. */
export function validateProfile(p: Rec): string[] {
  const e: string[] = [];
  if (!p || p.tool !== "@tamga-network/onboard" || p.format !== 1) return ["onboarding.json bu aracın dosyası değil"];
  const allowed = new Set([
    "tool",
    "format",
    "role",
    "environment",
    "slug",
    "domain",
    "hosting",
    "lookup_url",
    "isced_f_codes",
    "applications",
    "keys",
    "operator_keys",
    "dns_txt",
  ]);
  for (const k of Object.keys(p)) if (!allowed.has(k)) e.push(`onboarding.json: bilinmeyen alan ${k}`);
  if (!SLUG_RE.test(String(p.slug ?? ""))) e.push("onboarding.json: slug");
  if (!DNS_RE.test(String(p.domain ?? ""))) e.push("onboarding.json: domain");
  for (const k of (p.keys ?? []) as Rec[])
    if (!CERT_NAME_RE.test(String(k?.name))) e.push(`onboarding.json: anahtar adı ${k?.name}`);
  if (p.lookup_url !== undefined && !isHttps(p.lookup_url)) e.push("onboarding.json: lookup_url https olmalı");
  for (const c of p.isced_f_codes ?? []) if (!iscedFOk(c)) e.push(`onboarding.json: ISCED-F ${c}`);
  return e;
}
