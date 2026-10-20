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
/**
 * Kamuya açık metinde geçmeyen araç adları — tek kaynak (public-text-check, arf-sync ve tamga-platform/ops/publish-public.sh
 * ortak). Büyük/küçük harf duyarsız; araç adının -api/-agent/-code/_… biçimleri, nokta klasörü ve sağlayıcı adı da yakalanır
 * (araç klasörü yolları bu yüzden ayrıca yazılmaz). Desenler JS ve PCRE (git grep -P) ile uyumludur.
 */
export const TOOL_NAMES_SOURCE =
  "(?<![a-z0-9])claude(?:[-_ ]?(?:api|agent|code))?|(?<![a-z0-9])anthropic|\\bopus\\b|\\bfable\\b|\\bsonnet\\b";
export const TOOL_NAMES_RE = new RegExp(TOOL_NAMES_SOURCE, "i");

/** Satır başına bir değer; # ile başlayan satırlar yorum. Dosya yoksa boş liste. */
const readList = (name) => {
  const p = join(dirname(file), name);
  return existsSync(p)
    ? readFileSync(p, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    : [];
};
/** Liste → büyük/küçük harf duyarsız düz metin deseni (kaynak); boş liste hiçbir şeyle eşleşmez. */
export const literalSource = (list) => (list.length ? list.map(escapeRe).join("|") : "(?!)");
/**
 * Özel çalışma alanı yolları (ör. gizli anahtar klasörü) da depoda yazılmaz: operatörün listesinden okunur
 * (../tamga-platform/ops/public-text-paths.txt). Liste yoksa hiçbir şeyle eşleşmez.
 */
export const PRIVATE_PATHS = readList("public-text-paths.txt");
export const PRIVATE_PATHS_RE = new RegExp(literalSource(PRIVATE_PATHS), "i");
/** Yayın betiği için tek PCRE deseni: araç adları + özel yollar (yalnız bu grup büyük/küçük harf duyarsız). */
export const TOOL_NAMES_PCRE = `(?i:${TOOL_NAMES_SOURCE}|${literalSource(PRIVATE_PATHS)})`;

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
