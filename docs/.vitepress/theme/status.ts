// Ön bilgideki durum değerinin okunur karşılığı ve rengi (sayfa diline göre). ADR'lerde "Active" = kabul edilmiş karar.
export function statusLabel(status: string, kind: "adr" | "doc" = "doc", lang = "tr"): { text: string; tone: string } {
  const en = !lang.startsWith("tr");
  const s = status.toLowerCase();
  if (kind === "adr" && (s === "active" || s === "accepted")) return { text: en ? "Accepted" : "Kabul edildi", tone: "ok" };
  if (s === "active" || s === "accepted" || s === "final") return { text: en ? "In force" : "Yürürlükte", tone: "ok" };
  if (s === "draft" || s === "proposed")
    return { text: kind === "adr" ? (en ? "Proposed" : "Öneri") : en ? "Draft" : "Taslak", tone: "draft" };
  if (s === "superseded" || s === "deprecated") return { text: en ? "Superseded" : "Yerini aldı", tone: "old" };
  return { text: status, tone: "draft" };
}
