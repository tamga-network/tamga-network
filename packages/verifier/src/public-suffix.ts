/**
 * Küçük, gömülü kamu soneki (public suffix) denetimi — yalnız dış kurumun iptal sunucusu kapsamını belge imzacısı sertifikasının
 * SAN adlarından türetirken (`externalStatusScope`, 0.5.2). Bu bir yedek kuraldır: asıl kaynak dış listenin bildirdiği erişim
 * noktalarıdır; önbellek ayrıca `https`, genel IP ve kurum başına üst sınır uygular.
 *
 * Neden `psl` paketi değil: paketler bağımlılık taşımamaya çalışır; PSL verisi yüzlerce KB'tır ve güncel tutulması ayrı bir iştir.
 * Burada gereken tam bir PSL değil, "SAN adı bütün bir kamu sonekini (`com.tr`, `gov.tr`, `co.uk` …) kapsayamasın" güvencesidir.
 * Kural tutucudur — yanlış pozitif (bir kurum alan adını sonek saymak) yalnız kapsamı daraltır; yanlış negatif kapsamı açardı:
 *  - tek etiket (TLD) her zaman sonektir;
 *  - `<x>.tr` için TR ikinci düzey sonekleri (nic.tr: com, gov, edu, org, k12, bel, gen, av, …);
 *  - herhangi iki harfli ülke kodu altında yaygın ikinci düzey etiketler (`com`, `gov`, `edu`, `org`, `net`, `ac`, `co`, `gob`,
 *    `gouv`, `gv`, `or`, `mil`, `k12` …): AB ve Türk dünyası ccTLD'lerinin (`com.cy`, `gv.at`, `gov.az`, `edu.kz` …) olağan yapısı;
 *  - bir sonek altında yine bu etiketlerden biri (ör. `gov.nc.tr`) üç düzeyli sonektir.
 */
const GENERIC_SLD = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "gob",
  "gouv",
  "gov",
  "govt",
  "gv",
  "k12",
  "mil",
  "net",
  "nic",
  "or",
  "org",
  "sch",
]);
/** nic.tr ikinci düzey alanları (TR'de kayıt bunların altında; `nc.tr` KKTC). */
const TR_SLD = new Set([
  "av",
  "bbs",
  "bel",
  "biz",
  "com",
  "dr",
  "edu",
  "gen",
  "gov",
  "info",
  "k12",
  "kep",
  "mil",
  "name",
  "nc",
  "net",
  "org",
  "pol",
  "tel",
  "tsk",
  "tv",
  "web",
]);

const isSecondLevelSuffix = (sld: string, tld: string) =>
  (tld === "tr" && TR_SLD.has(sld)) || (/^[a-z]{2}$/.test(tld) && GENERIC_SLD.has(sld));

/** Adın sonundaki kamu sonekinin etiket sayısı (1–3). */
function suffixLabels(labels: string[]): number {
  const n = labels.length;
  if (n < 2 || !isSecondLevelSuffix(labels[n - 2], labels[n - 1])) return 1;
  if (n >= 3 && GENERIC_SLD.has(labels[n - 3])) return 3;
  return 2;
}

/** Ad bütünüyle bir kamu soneki mi: `tr`, `com.tr`, `gov.tr`, `co.uk`, `gov.nc.tr` … */
export function isPublicSuffix(name: string): boolean {
  const labels = name.toLowerCase().replace(/\.$/, "").split(".");
  return labels.length <= suffixLabels(labels);
}

/** Kayıt edilebilir alan adı (sonek + bir etiket): `a.b.example.com.tr` → `example.com.tr`; ad bir sonekse `null`. */
export function registrableDomain(name: string): string | null {
  const labels = name.toLowerCase().replace(/\.$/, "").split(".");
  const s = suffixLabels(labels);
  return labels.length > s ? labels.slice(-(s + 1)).join(".") : null;
}
