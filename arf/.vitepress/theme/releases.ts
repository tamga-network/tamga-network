// Yayın bilgisi (arf/releases.json) ve adres kuralları — sürüm menüsü ve eski yayın uyarısı paylaşır.
import data from "../../releases.json";

export type Release = { id: string; date: string; languages: string[]; docs: Record<string, string> };
export const RELEASES: Release[] = data.releases;
export const LATEST: string = data.latest;
/** Sayfa → belge kimliği (docs/.vitepress/doc-index.ts ARF_PAGES ile aynı). */
const PAGE_IDS: Record<string, string> = {
  architecture: "FW-ARF-0001",
  "annex-a-trust-framework": "FW-TF-0001",
  "annex-b-participant-rules": "FW-RB-0001",
  "annex-c-education": "FW-RB-0002",
  "annex-c-identity": "FW-RB-0003",
  "annex-c-event-ticket": "FW-RB-0004",
};

/** Adresten dil, yayın ve sayfa: /tr/v0.1/architecture → { tr: true, release: "0.1", page: "architecture" }. */
export function parsePath(path: string): { tr: boolean; release: string; page: string } {
  const clean = path.replace(/\.html$/, "").replace(/^\//, "");
  const m = /^(tr\/)?(?:v(\d+\.\d+)\/)?(.*)$/.exec(clean);
  const page = (m?.[3] ?? "").replace(/^index$/, "").replace(/\/$/, "");
  return { tr: !!m?.[1], release: m?.[2] ?? LATEST, page };
}

/** Bir yayındaki aynı sayfanın adresi; o yayında o dil yoksa Türkçesine düşer. */
export function hrefFor(release: string, tr: boolean, page: string): string {
  const r = RELEASES.find((x) => x.id === release);
  const useTr = tr || !r?.languages.includes("en");
  const root = (useTr ? "/tr/" : "/") + (release === LATEST ? "" : `v${release}/`);
  // Sayfa o yayında yoksa (ör. sonradan eklenen belge) yayının özet sayfasına gidilir.
  const keep = page && PAGE_IDS[page] && r?.docs[PAGE_IDS[page]] ? page : "";
  // Eski yayın İngilizce değilse ve İngilizce istenmişse yayın özet sayfasına git (orada bilgi notu var).
  if (!tr && useTr && release !== LATEST) return `/v${release}/`;
  return root + keep;
}
