/** Kurum kategorisi → ikon + renk (beceri §5). Yeni kategori: buraya bir satır + wallet-core CATEGORY_LABELS. */
import type { Ionicons } from "@expo/vector-icons";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const MAP: Record<string, { icon: IoniconName; color: string }> = {
  EDUCATION: { icon: "school", color: "#4E8FB0" },
  FINANCE: { icon: "card", color: "#3C9A5F" },
  GOVERNMENT: { icon: "business", color: "#C8A24C" },
  TELECOM: { icon: "cellular", color: "#8E6BC0" },
  HEALTH: { icon: "medkit", color: "#D0565A" },
  TRANSPORT: { icon: "bus", color: "#D08A2E" },
  EVENTS: { icon: "ticket", color: "#B8506B" },
  LOGISTICS: { icon: "cube", color: "#7A8A96" },
  IDENTITY: { icon: "id-card", color: "#C8A24C" },
  CONTACT: { icon: "at", color: "#4F8C8A" },
  OTHER: { icon: "ellipsis-horizontal-circle", color: "#7A8A96" },
};

export const categoryIcon = (category?: string) => MAP[category ?? "OTHER"] ?? MAP.OTHER;

/** Belge tipi (vct) → ikon. */
export const credentialIcon = (vct: string): IoniconName =>
  vct.includes(":id:")
    ? "id-card"
    : vct.includes("EmailAddress")
      ? "mail"
      : vct.includes("PhoneNumber")
        ? "call"
        : vct.includes("Ticket")
          ? "ticket"
          : vct.includes("Diploma")
            ? "ribbon"
            : vct.includes("Student")
              ? "school"
              : "document-text";

/** vct alan adı (`urn:tamga:<domain>:…`) → kurum kategorisi; Belgelerim gruplaması için. */
const DOMAIN_CATEGORY: Record<string, string> = {
  id: "IDENTITY",
  edu: "EDUCATION",
  fin: "FINANCE",
  gov: "GOVERNMENT",
  tel: "TELECOM",
  health: "HEALTH",
  transport: "TRANSPORT",
  tkt: "EVENTS",
  org: "GOVERNMENT",
  contact: "CONTACT",
};
export const vctCategory = (vct: string): string => DOMAIN_CATEGORY[vct.split(":")[2] ?? ""] ?? "OTHER";
