/**
 * ADR-0069 (ADR-0012 K5): doğrulayıcı kayıtlarındaki `terminal_groups[]` yayın öncesi denetimi. Biçim `@tamga-network/trust`
 * `TerminalGroup` şemasıyla; ek olarak (TG1) grup kimliği bütün listede tek, (TG2) etkin grup bir kuruma (`institution_id` =
 * aynı listedeki belge verenin `slug`'ı ya da bir doğrulayıcının `dns_name`'i) ve en az bir kapı politikasına bağlı, sertifika
 * parmak izi iki grupta birden geçmez. Geri çekilmiş grup (`valid_until` geçmiş) eski biçimiyle kalabilir (tarih kaydı).
 */
import { TerminalGroup } from "@tamga-network/trust";

type Rec = Record<string, unknown>;

export function checkTerminalGroups(rps: Rec[], issuers: Rec[], now = new Date()): string[] {
  const errors: string[] = [];
  const institutions = new Set<string>([
    ...issuers.map((i) => String(i.slug ?? "")),
    ...rps.map((r) => String(r.dns_name ?? "")),
  ]);
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
