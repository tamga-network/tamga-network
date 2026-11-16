/**
 * ADR-0069 (ADR-0012 K5): doğrulayıcı kayıtlarındaki `terminal_groups[]` yayın öncesi denetimi. Biçim `@tamga-network/trust`
 * `TerminalGroup` şemasıyla; ek olarak (TG1) grup kimliği bütün listede tek, (TG2) etkin grup bir kuruma (`institution_id` =
 * aynı listedeki belge verenin `slug`'ı ya da bir doğrulayıcının `dns_name`'i) ve en az bir kapı politikasına bağlı, sertifika
 * parmak izi iki grupta birden geçmez. Kurum kaydı ACTIVE olmalıdır (kontrol 2026-11-03, K12): kurumu geri çekilmiş ya da askıya
 * alınmış bir grubu etkin yayımlamak hatadır — grup `valid_until` ile geri çekilir (okuyucu tarafında `TrustSource` kurumu ACTIVE
 * olmayan grubu zaten etkin saymaz). Geri çekilmiş grup (`valid_until` geçmiş) eski biçimiyle kalabilir (tarih kaydı).
 */
import { TerminalGroup } from "@tamga-network/trust";

type Rec = Record<string, unknown>;

export function checkTerminalGroups(rps: Rec[], issuers: Rec[], now = new Date()): string[] {
  const errors: string[] = [];
  const institutions = new Map<string, string>(); // kurum kimliği → durumu (yoksa ACTIVE sayılır: eski kayıt)
  for (const i of issuers) institutions.set(String(i.slug ?? ""), String(i.status ?? "ACTIVE"));
  for (const r of rps) institutions.set(String(r.dns_name ?? ""), String(r.status ?? "ACTIVE"));
  const ids = new Map<string, string>();
  const fps = new Map<string, string>();
  for (const rp of rps) {
    const dns = String(rp.dns_name ?? "");
    const groups = rp.terminal_groups;
    if (groups === undefined) continue;
    if (!Array.isArray(groups)) {
      errors.push(`${dns}: terminal_groups bir dizi olmalı`);
      continue;
    }
    for (const raw of groups) {
      const p = TerminalGroup.safeParse(raw);
      if (!p.success) {
        errors.push(
          `${dns}: terminal_groups biçimi — ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        );
        continue;
      }
      const g = p.data;
      const where = `${dns} / ${g.group_id}`;
      if (ids.has(g.group_id)) errors.push(`${where}: grup kimliği listede iki kez (önce ${ids.get(g.group_id)})`);
      ids.set(g.group_id, dns);
      const withdrawn = !!g.valid_until && Date.parse(g.valid_until) <= now.getTime();
      if (withdrawn) continue;
      if (!g.institution_id) errors.push(`${where}: etkin grupta institution_id zorunlu (ADR-0069 TG2)`);
      else if (!institutions.has(g.institution_id))
        errors.push(
          `${where}: institution_id "${g.institution_id}" listede bir kurum değil (belge veren slug'ı ya da doğrulayıcı dns_name'i)`,
        );
      else if (institutions.get(g.institution_id) !== "ACTIVE")
        errors.push(
          `${where}: kurum "${g.institution_id}" ${institutions.get(g.institution_id)} — etkin grup ACTIVE bir kuruma bağlı olmalı; grubu valid_until ile geri çekin (ADR-0069 TG2)`,
        );
      if (!g.allowed_policies?.length) errors.push(`${where}: etkin grupta allowed_policies en az bir politika`);
      for (const fp of g.cert_fingerprints ?? []) {
        if (fps.has(fp))
          errors.push(`${where}: sertifika parmak izi ${fp.slice(0, 12)}… başka grupta da var (${fps.get(fp)})`);
        fps.set(fp, g.group_id);
      }
    }
  }
  return errors;
}

/**
 * Y9 (ADR-0069 TG1/TG2, ADR-0088): bir kuruma (`institution_id` = belge veren `slug`'ı ya da doğrulayıcı `dns_name`'i) bağlı,
 * bugün etkin (geri çekilmemiş) kapı grupları. Kurum askıya alınır, iptal edilir ya da emekliye ayrılırken bu gruplar önce
 * `end-use <dns_name> <group_id>` ile geri çekilmelidir; çekilmezse yayın durur (`checkTerminalGroups`).
 */
export function activeGroupsOfInstitution(
  rps: Rec[],
  institutionId: string,
  now = new Date(),
): Array<{ dns_name: string; group_id: string }> {
  const out: Array<{ dns_name: string; group_id: string }> = [];
  for (const rp of rps) {
    if (!Array.isArray(rp.terminal_groups)) continue;
    for (const g of rp.terminal_groups as Rec[]) {
      if (g.institution_id !== institutionId) continue;
      if (typeof g.valid_until === "string" && Date.parse(g.valid_until) <= now.getTime()) continue;
      out.push({ dns_name: String(rp.dns_name ?? ""), group_id: String(g.group_id ?? "") });
    }
  }
  return out;
}

/** Y9: askı / iptal / emeklilik öncesi işletmeciye gösterilen uyarı satırları (boşsa uyarı yok). */
export function groupWithdrawalWarnings(rps: Rec[], institutionId: string, status: string, now = new Date()): string[] {
  if (status === "ACTIVE") return [];
  const groups = activeGroupsOfInstitution(rps, institutionId, now);
  if (!groups.length) return [];
  return [
    `[uyarı] ${institutionId} ${status} olacak ama kuruma bağlı ${groups.length} etkin kapı grubu var — önce geri çekin ` +
      `(ADR-0069 TG1/TG2; çekilmezse liste yayımlanmaz ve kayıt geri alınır):`,
    ...groups.map((g) => `  npx tsx apps/trust-publisher/src/cli.ts end-use ${g.dns_name} ${g.group_id}`),
    `  Askı süresince kurumun belgeleri kabul edilmez (ADR-0088). Askı kalkınca kapılar yeni group_id'li grupla (yeni başvuru) ve ` +
      `yeni terminal anahtarlarıyla açılır; geri çekilen grup tarih kaydı olarak kalır.`,
  ];
}
