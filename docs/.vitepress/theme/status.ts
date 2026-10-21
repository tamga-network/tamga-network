// Ön bilgideki durum değerinin okunur karşılığı ve rengi (sayfa diline göre). ADR'lerde "Active" = kabul edilmiş karar.
const LABELS = {
  en: { accepted: "Accepted", inForce: "In force", proposed: "Proposed", draft: "Draft", superseded: "Superseded", archived: "Archived" },
  tr: { accepted: "Kabul edildi", inForce: "Yürürlükte", proposed: "Öneri", draft: "Taslak", superseded: "Yerini aldı", archived: "Arşivlendi" },
  az: { accepted: "Qəbul edilib", inForce: "Qüvvədədir", proposed: "Təklif", draft: "Qaralama", superseded: "Əvəz edilib", archived: "Arxivləşdirilib" },
};

export function statusLabel(status: string, kind: "adr" | "doc" = "doc", lang = "tr"): { text: string; tone: string } {
  const L = LABELS[lang.startsWith("tr") ? "tr" : lang.startsWith("az") ? "az" : "en"];
  const s = status.toLowerCase();
  if (kind === "adr" && (s === "active" || s === "accepted")) return { text: L.accepted, tone: "ok" };
  if (s === "active" || s === "accepted" || s === "final") return { text: L.inForce, tone: "ok" };
  if (s === "draft" || s === "proposed") return { text: kind === "adr" ? L.proposed : L.draft, tone: "draft" };
  if (s === "superseded" || s === "deprecated") return { text: L.superseded, tone: "old" };
  if (s === "archived") return { text: L.archived, tone: "old" };
  return { text: status, tone: "draft" };
}
