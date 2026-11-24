/**
 * ADR-0089 eki (2026-11-24, ARF ISSU_37): kopya kullanım yöntemi — belge verenin `credential_reuse_policy`'si (ETSI TS 119 472-3
 * §4.2.4.2, `id: "arf_annex_ii"`). `details` dizisinde İLK gelen ve cüzdanın desteklediği yöntem uygulanır (-05 / -06):
 *  - `per-relying-party` (yöntem D): her doğrulayıcıya kendi kopyası, aynı doğrulayıcıya hep aynısı (bugünkü davranış);
 *  - `once_only` (yöntem A): her kopya bir kez gösterilir; eşikte yeni paket; tükenince kişinin onayıyla yeniden kullanım (ISSU_47);
 *  - `limited_time` (yöntem B; ETSI metninde `limited-time` yazımı da geçer): tek kopya istenir ve her doğrulayıcıya o gösterilir,
 *    süresi dolmadan yenilenir (ISSU_48–50).
 * `rotating-batch` (yöntem C, ARF'de MAY) desteklenmez. Politika yoksa ya da desteklenen yöntem yoksa `undefined`: bugünkü davranış
 * (doğrulayıcı başına kopya) sürer. Tamga belge verenleri `per-relying-party`'yi ilk sırada ilan eder.
 */
import type { IssuerMetadata } from "./oid4vci.js";

export type ReuseMethod = "per_relying_party" | "once_only" | "limited_time";

export function reuseMethodOf(md: IssuerMetadata, vct: string): ReuseMethod | undefined {
  const pol = md.credential_configurations_supported[vct]?.credential_metadata?.credential_reuse_policy;
  if (!pol || pol.id !== "arf_annex_ii") return undefined;
  for (const d of pol.options?.[0]?.details ?? []) {
    if (d === "per-relying-party") return "per_relying_party";
    if (d === "once_only") return "once_only";
    if (d === "limited_time" || d === "limited-time") return "limited_time";
  }
  return undefined;
}
