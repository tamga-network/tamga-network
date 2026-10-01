/**
 * Status List ön çekim önbelleği — SPEC-CRED-0003 §9.1 / S12: doğrulama başına çekim YASAK; toplu, zamanlanmış ön çekim.
 * Çekilecek URI seti güven çapalarından (anchors.jsonl `list_uri`) türetilir: verifier hangi listelerin var olduğunu
 * kimseye sormadan bilir ve hepsini birden çeker (sürü mahremiyeti).
 */
export interface CachedToken {
  token: string;
  /** Çekim zamanı — Unix **saniye** (ms değil; D5 karşılaştırması `fetchedAt * 1000` yapar). */
  fetchedAt: number;
}
export interface StatusCache {
  get(uri: string): CachedToken | null;
}

export class MemoryStatusCache implements StatusCache {
  private m = new Map<string, CachedToken>();
  set(uri: string, token: string, fetchedAt = Math.floor(Date.now() / 1000)) {
    this.m.set(uri, { token, fetchedAt });
  }
  get(uri: string) {
    return this.m.get(uri) ?? null;
  }
  uris() {
    return [...this.m.keys()];
  }
}

export class PrefetchStatusCache extends MemoryStatusCache {
  constructor(private fetchText: (url: string) => Promise<string | null> = defaultFetch) {
    super();
  }
  /**
   * Verilen URI'lerin hepsini **paralel** çeker; erişilemeyen eski değeriyle kalır (D4 tazelik kararı doğrulamada).
   * Paralel + zaman aşımı: eski/erişilemez çapalar (ör. taşınmış alan adı) canlı listelerin ön çekimini geciktirmez.
   */
  async refresh(uris: Iterable<string>): Promise<{ ok: number; failed: string[] }> {
    const list = [...new Set(uris)];
    const results = await Promise.all(list.map((u) => this.fetchText(u).catch(() => null)));
    const failed: string[] = [];
    let ok = 0;
    results.forEach((t, i) => {
      if (t) {
        this.set(list[i], t);
        ok++;
      } else failed.push(list[i]);
    });
    return { ok, failed };
  }
}
const FETCH_TIMEOUT_MS = 3000;
async function defaultFetch(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { accept: "application/statuslist+jwt" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return r.ok ? (await r.text()).trim() : null;
  } catch {
    return null;
  }
}
