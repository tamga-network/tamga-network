/**
 * İç yardımcı (paket dışına açılmaz; `index.ts`'te yok). Sıralı anahtarlarla kararlı JSON (alan sırası farkı tutarsızlık sayılmaz; kopya karşılaştırması).
 */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}
