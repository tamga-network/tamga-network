// Kamuya açık metinde geçmemesi gereken kişi adları depoda yazılmaz: operatörün özel deposundaki listeden okunur
// (../tamga-platform/ops/public-text-names.txt; satır başına bir ad). Liste yoksa (ör. public CI) yalnızca genel kurallar uygulanır.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "tamga-platform",
  "ops",
  "public-text-names.txt",
);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ad listesi dosyası bulundu mu (yoksa denetleyiciler uyarır: yalnızca genel kurallar uygulanır). */
export const PRIVATE_NAMES_FILE_FOUND = existsSync(file);
/** Kamuya açık metinde geçmeyen araç adları (public-text-check ve arf-sync ortak). */
export const TOOL_NAMES_RE = /\bClaude\b|\bOpus\b|\bFable\b|\bSonnet\b/;

export const PRIVATE_NAMES = PRIVATE_NAMES_FILE_FOUND
  ? readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  : [];

/** Adlardan biri geçiyorsa eşleşen düzenli ifade; liste boşsa hiçbir şeyle eşleşmez. */
export const PRIVATE_NAMES_RE = PRIVATE_NAMES.length
  ? new RegExp(`(?<![\\p{L}])(?:${PRIVATE_NAMES.map(escapeRe).join("|")})(?![\\p{L}])`, "u")
  : /(?!)/;
