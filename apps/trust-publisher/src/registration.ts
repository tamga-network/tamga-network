/**
 * ADR-0024 K5 — katılımcı kayıt verisinin eksik alanları. Yayıncı bu tarihten (dahil) sonra kaydedilen katılımcılarda eksik
 * zorunlu alan varsa yayını durdurur; daha eski kayıtlar için uyarı basar (pilot öncesi tamamlanır).
 */
export const REGISTRATION_ENFORCED_FROM = "2026-09-30T00:00:00Z";
import { NON_PRESENTABLE_VCTS } from "../../../packages/schemas/src/definitions.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

const hasContact = (c: Rec | undefined) => !!c && !!(c.support_uri || c.email || c.phone);
const hasDpaRoute = (d: Rec | undefined) => !!d && !!d.name && !!d.country && !!(d.email || d.phone || d.form_uri);

/** Doğrulayıcı kaydının eksik zorunlu alanları (ADR-0024 K1, RPR1, RPR3). */
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

/** ADR-0031: takma ad kuralları — PS3 (sunulamayan tür kapsamda olamaz) ve K4 (`pseudonyms`: single | multiple). */
export function pseudonymErrors(rp: Rec): string[] {
  const e: string[] = [];
  for (const s of (rp.scopes ?? []) as Rec[])
    if (NON_PRESENTABLE_VCTS.includes(s.vct))
      e.push(`scopes[${s.scope_id}] requests a non-presentable type (${s.vct}; PS3)`);
  if (rp.pseudonyms !== undefined && rp.pseudonyms !== "single" && rp.pseudonyms !== "multiple")
    e.push(`pseudonyms must be "single" or "multiple"`);
  return e;
}

/** Belge veren kaydının eksik zorunlu alanları (ADR-0024 K2). */
export function issuerGaps(i: Rec): string[] {
  const g: string[] = [];
  if (!i.trade_name) g.push("trade_name");
  if (!i.identifiers?.length) g.push("identifiers");
  if (!i.postal_address?.street_address || !i.postal_address?.country) g.push("postal_address");
  if (!hasContact(i.contact)) g.push("contact");
  if (!hasDpaRoute(i.supervisory_authority)) g.push("supervisory_authority");
  return g;
}

/** Sınıftan otomatik yetki türü (ADR-0024 K2). */
export const issuerEntitlements = (klass: string) =>
  klass === "PUB" ? ["pub_eaa_provider"] : klass === "QUALIFIED" ? ["qeaa_provider"] : ["non_q_eaa_provider"];

export function checkRegistrations(rps: Rec[], issuers: Rec[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const put = (since: string | undefined, who: string, gaps: string[]) => {
    if (!gaps.length) return;
    const line = `${who}: ${gaps.join(", ")}`;
    (since && since >= REGISTRATION_ENFORCED_FROM ? errors : warnings).push(line);
  };
  for (const r of rps) put(r.registered_at, `relying_party ${r.dns_name}`, rpGaps(r));
  // ADR-0031 PS3: sunulamayan tür (takma ad tohumu) hiçbir kapsamda yer alamaz — tarihe bakılmaz, yayın durur
  for (const r of rps) errors.push(...pseudonymErrors(r).map((e) => `relying_party ${r.dns_name}: ${e}`));
  for (const i of issuers) put(i.valid_from, `issuer ${i.slug}`, issuerGaps(i));
  return { errors, warnings };
}
