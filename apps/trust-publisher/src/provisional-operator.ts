/**
 * ADR-0070 (OP2): ağın kendi servislerinin geçici işletmecisi tek bir yapılandırma değerinden (`registry/provisional-operator.json`)
 * gelir. Yayından önce denetlenir: kimlik numarası notunda "provisional operator" geçen her kendi kaydı (belge veren ya da
 * doğrulayıcı) bu değerin adını, adına çalıştığı yapıyı ("on_behalf_of"), kimlik numarasını ve adresini birebir taşır; liste
 * işletmecisi ve şema sahibi adı ise değerdeki `scheme_operator_name` ("Tamga Network") olur — geçici işletmecinin adı liste
 * işletmecisi yerine yazılamaz. Fark varsa yayın durur. Vakıf devrinde yalnız bu değer ve kayıtlar birlikte değişir
 * (tamga-platform `ops/foundation-handover.ts`).
 */
type Rec = Record<string, unknown>;

export interface ProvisionalOperator {
  scheme_operator_name: string;
  name: string;
  on_behalf_of: string;
  identifier: { scheme: string; value: string };
  postal_address: { street_address: string; locality: string; country: string };
}

const isOwn = (r: Rec) =>
  ((r.identifiers as Array<{ note?: string }> | undefined) ?? []).some((x) =>
    /provisional operator/i.test(x.note ?? ""),
  );

export function checkProvisionalOperator(
  cfg: ProvisionalOperator,
  src: { tlOperator?: Rec; lotlOperator?: Rec; issuers: Rec[]; relyingParties: Rec[] },
): string[] {
  const errors: string[] = [];
  for (const [where, op] of [
    ["tl operator", src.tlOperator],
    ["lotl operator", src.lotlOperator],
  ] as const)
    if (op && op.name !== cfg.scheme_operator_name)
      errors.push(`${where}: liste işletmecisi adı "${String(op.name)}" — "${cfg.scheme_operator_name}" olmalı`);
  const recs = [
    ...src.issuers.map((r) => ({ r, where: `issuer ${String(r.slug)}` })),
    ...src.relyingParties.map((r) => ({ r, where: `relying_party ${String(r.dns_name)}` })),
  ].filter(({ r }) => isOwn(r));
  for (const { r, where } of recs) {
    if (r.status !== undefined && r.status !== "ACTIVE") continue;
    const op = (r.operator ?? {}) as Rec;
    if (op.name !== cfg.name) errors.push(`${where}: operator.name farklı (${String(op.name)})`);
    if (op.status !== "provisional") errors.push(`${where}: operator.status "provisional" olmalı`);
    if (op.on_behalf_of !== cfg.on_behalf_of) errors.push(`${where}: operator.on_behalf_of farklı`);
    const ids = (r.identifiers as Array<{ scheme?: string; value?: string }> | undefined) ?? [];
    if (!ids.some((x) => x.scheme === cfg.identifier.scheme && x.value === cfg.identifier.value))
      errors.push(`${where}: kimlik numarası ${cfg.identifier.scheme} ${cfg.identifier.value} yok`);
    const pa = (r.postal_address ?? {}) as Rec;
    for (const k of ["street_address", "locality", "country"] as const)
      if (pa[k] !== cfg.postal_address[k]) errors.push(`${where}: postal_address.${k} farklı`);
  }
  return errors;
}
