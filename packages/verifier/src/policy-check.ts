/**
 * İç yardımcı (paket dışına açılmaz): politikanın kabul kararını etkileyen bloklarının biçim denetimi — güvenlik incelemesi
 * 2026-11-18. Politika dosyadan/JSON'dan gelebilir; bilinmeyen anahtarlı aralık kısıtı (`{ minimum: 18 }`) her sayıyı geçirir,
 * eksik `require_recognition` C3'ü sessizce atlatırdı. `dcqlFromPolicy` (istek kurulurken) hata atar, T0 (doğrulamada)
 * DOĞRULANAMADI döner.
 */

const RANGE_KEYS = new Set(["min", "max"]);

/** Aralık kısıtı mı (nesne; `null` ve dizi eşitlik kısıtıdır). */
export const isRangeConstraint = (c: unknown): c is Record<string, unknown> =>
  c !== null && typeof c === "object" && !Array.isArray(c);

/** Aralık kısıtı geçerli mi: yalnız `min` / `max` anahtarları, sonlu sayı değerler, en az biri, `min` ≤ `max`. */
export function validRangeConstraint(c: Record<string, unknown>): boolean {
  const keys = Object.keys(c);
  if (!keys.length || keys.some((k) => !RANGE_KEYS.has(k))) return false;
  if (keys.some((k) => typeof c[k] !== "number" || !Number.isFinite(c[k] as number))) return false;
  return c.min === undefined || c.max === undefined || (c.min as number) <= (c.max as number);
}

/** Politikanın kısıt ve güven bloklarındaki biçim sorunları (boşsa geçerli; T0). Değer yazılmaz — yalnız sorgu ve alan adı. */
export function policyShapeProblems(p: unknown): string[] {
  return [...trustBlockProblems(p), ...constraintProblems(p)];
}

/** Güven bloğu: `require_recognition` boolean, tanıma isteniyorsa iki harfli devlet kodu, asgari güvence, kategori listesi. */
function trustBlockProblems(p: unknown): string[] {
  const out: string[] = [];
  const t = (p as { trust?: unknown } | null)?.trust as Record<string, unknown> | undefined;
  if (!t || typeof t !== "object") out.push("trust block missing");
  else {
    if (typeof t.require_recognition !== "boolean") out.push("trust.require_recognition must be a boolean");
    if (t.require_recognition === true && (typeof t.state_code !== "string" || !/^[A-Z]{2}$/.test(t.state_code)))
      out.push("trust.state_code must be a two-letter state code");
    if (!["I1", "I2", "I3"].includes(t.min_issuer_assurance as string))
      out.push("trust.min_issuer_assurance must be I1, I2 or I3");
    if (!Array.isArray(t.allowed_categories) || t.allowed_categories.some((c) => typeof c !== "string"))
      out.push("trust.allowed_categories must be a list of strings");
  }
  return out;
}

/** Aralık kısıtları yalnız sayısal `min` / `max` (en az biri); `dcqlFromPolicy` (istek kurulurken) ve T0. */
export function constraintProblems(p: unknown): string[] {
  const out: string[] = [];
  const pol = p as { credentials?: unknown } | null;
  if (!Array.isArray(pol?.credentials)) out.push("credentials missing");
  else
    for (const c of pol.credentials as Array<{ id?: unknown; constraints?: unknown }>) {
      const cons = c?.constraints;
      if (cons === undefined) continue;
      if (!isRangeConstraint(cons)) {
        out.push(`${String(c?.id)}: constraints must be an object`);
        continue;
      }
      for (const [name, v] of Object.entries(cons))
        if (isRangeConstraint(v) && !validRangeConstraint(v))
          out.push(`${String(c?.id)}.${name}: range constraint must have only numeric min/max (at least one)`);
    }
  return out;
}
