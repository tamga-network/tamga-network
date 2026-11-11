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
 * ortak). Desenin KENDİSİ herkese açık depoda durmaz (denetlenen adları saymış olurdu): geliştirme deposundaki
 * `scripts/public-text-tools.txt` dosyasından okunur (`.publicignore`'da; tek satır, JS ve PCRE — git grep -P — ile uyumlu düzenli
 * ifade kaynağı; `#` ile başlayan satırlar yorum). Dosya yoksa (herkese açık kopya ve onun CI'ı) desen hiçbir şeyle eşleşmez:
 * oradaki `docs:check` kalan kuralları uygular, araç adı denetimi yayından ÖNCE geliştirme deposunda ve yayın betiğinde yapılır.
 */
const toolsFile = join(dirname(fileURLToPath(import.meta.url)), "public-text-tools.txt");
/** Araç adı deseni dosyası bulundu mu (yoksa araç adı denetimi yapılmaz — yalnız herkese açık kopyada beklenir). */
export const TOOL_NAMES_FILE_FOUND = existsSync(toolsFile);
export const TOOL_NAMES_SOURCE = TOOL_NAMES_FILE_FOUND
  ? readFileSync(toolsFile, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .join("|") || "(?!)"
  : "(?!)";
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

/**
 * Yalnız DÜZYAZIDA geçmemesi gereken işletmeci unvanı ve vergi numarası (2026-11-04): operatörün listesinden okunur
 * (../tamga-platform/ops/public-text-prose-names.txt). Kayıt verisi (güven listesi kaynakları, imzalı listeler, PKI, test
 * fikstürleri) bu adları bilerek taşır; bu yüzden desen yalnız belge denetiminde (public-text-check: .md) ve yayın betiğinin
 * düzyazı taramasında (publish-public.sh: .md/.mdx/.ts/.tsx/.typ, kayıt verisi yolları hariç) kullanılır. Liste yoksa hiçbir
 * şeyle eşleşmez.
 */
export const PROSE_NAMES = readList("public-text-prose-names.txt");
export const PROSE_NAMES_RE = new RegExp(literalSource(PROSE_NAMES), "iu");
/** Yayın betiği için PCRE (düz metin; büyük/küçük harf duyarsız grup). */
export const PROSE_NAMES_PCRE = `(?i:${literalSource(PROSE_NAMES)})`;

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
