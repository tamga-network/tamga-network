// Ön bilgideki durum değerinin okunur karşılığı ve rengi. ADR'lerde "Active" = kabul edilmiş, yürürlükteki karar.
export function statusLabel(status: string, kind: "adr" | "doc" = "doc"): { text: string; tone: string } {
  const s = status.toLowerCase();
  if (kind === "adr" && (s === "active" || s === "accepted")) return { text: "Kabul edildi", tone: "ok" };
  if (s === "active" || s === "accepted" || s === "final") return { text: "Yürürlükte", tone: "ok" };
  if (s === "draft" || s === "proposed") return { text: kind === "adr" ? "Öneri" : "Taslak", tone: "draft" };
  if (s === "superseded" || s === "deprecated") return { text: "Yerini aldı", tone: "old" };
  return { text: status, tone: "draft" };
}
