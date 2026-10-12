/**
 * Status List ön çekim önbelleği — SPEC-CRED-0003 §9.1 / S12: doğrulama başına çekim YASAK; toplu, zamanlanmış ön çekim.
 * Çekilecek URI seti güven çapalarından (anchors.jsonl `list_uri`) türetilir: verifier hangi listelerin var olduğunu
 * kimseye sormadan bilir ve hepsini birden çeker (sürü mahremiyeti).
 *
 * Tanımlayıcı listeleri (Attestation Revocation List; CIR 2024/2979 Ek II) için çapa günlüğü yoktur: adres, imzası doğrulanmış
 * bir belgede ilk görüldüğünde `want` ile ön çekim kümesine eklenir ve hemen (doğrulamayı bekletmeden) çekilir; o doğrulama
 * önbellekte liste olmadığı için DOĞRULANAMADI (D2) döner, sonraki doğrulamalar önbellekten okur ve liste her ön çekim turunda
 * tazelenir (D4). Doğrulama hiçbir zaman ağ isteğini beklemez (S12).
 */
export interface CachedToken {
  token: string;
  /** Çekim zamanı — Unix **saniye** (ms değil; D5 karşılaştırması `fetchedAt * 1000` yapar). */
  fetchedAt: number;
}

/**
 * Listenin türü — gövdenin nasıl saklanacağını içerik türü başlığı değil bu belirler: Status List JWT metindir; tanımlayıcı
 * listesi ikili CWT'dir ve önbellekte `b64u:` önekli base64url olarak tutulur (baytlar UTF-8 diye çözülüp bozulmaz).
 */
export type StatusListKind = "status_list" | "identifier_list";
export interface StatusListRef {
  uri: string;
  kind: StatusListKind;
}

export interface StatusCache {
  get(uri: string): CachedToken | null;
  /**
   * Doğrulama adımı bu listeye ihtiyaç duydu ama önbellekte yok (yalnız imzası doğrulanmış belgedeki adres için çağrılır).
   * Önbellek adresi ön çekim kümesine ekleyebilir; çağrı beklemez, ağ isteği doğrulamanın dışında yapılır (S12).
   */
  want?(uri: string, kind: StatusListKind): void;
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

/** Çekici: türü bilinen listede gövde türe göre saklanır; tür verilmezse içerik türüne ve gövdeye bakılır. */
export type StatusFetcher = (url: string, kind?: StatusListKind) => Promise<string | null>;

/** Ön çekim kümesine sonradan eklenen (çapasız) adres sayısı üst sınırı — bellek ve dışarıya istek sayısı. */
const MAX_LEARNED = 1000;

export class PrefetchStatusCache extends MemoryStatusCache {
  private learned = new Map<string, StatusListKind>();
  private pending = new Set<string>();
  constructor(private fetchText: StatusFetcher = defaultFetch) {
    super();
  }
  /** Sonradan öğrenilen (çapa günlüğünde olmayan) adresler — her `refresh` turunda onlar da çekilir. */
  learnedRefs(): StatusListRef[] {
    return [...this.learned].map(([uri, kind]) => ({ uri, kind }));
  }
  want(uri: string, kind: StatusListKind): void {
    if (this.learned.has(uri) || this.pending.has(uri)) return;
    if (this.learned.size >= MAX_LEARNED || !/^https?:\/\//i.test(uri)) return;
    this.learned.set(uri, kind);
    this.pending.add(uri);
    void this.refreshOne({ uri, kind }).finally(() => this.pending.delete(uri));
  }
  private async refreshOne(ref: StatusListRef): Promise<boolean> {
    const t = await this.fetchText(ref.uri, ref.kind).catch(() => null);
    if (t) this.set(ref.uri, t);
    return !!t;
  }
  /**
   * Verilen URI'lerin ve sonradan öğrenilen adreslerin hepsini **paralel** çeker; erişilemeyen eski değeriyle kalır (D4 tazelik
   * kararı doğrulamada). Paralel + zaman aşımı: eski/erişilemez çapalar (ör. taşınmış alan adı) canlı listelerin ön çekimini
   * geciktirmez. Düz adres Status List sayılır; tanımlayıcı listesi `{ uri, kind: "identifier_list" }` ile verilir.
   */
  async refresh(uris: Iterable<string | StatusListRef>): Promise<{ ok: number; failed: string[] }> {
    const refs = new Map<string, StatusListKind | undefined>();
    for (const u of uris) {
      if (typeof u === "string") {
        if (!refs.has(u)) refs.set(u, undefined);
      } else refs.set(u.uri, u.kind);
    }
    for (const [uri, kind] of this.learned) if (!refs.has(uri) || refs.get(uri) === undefined) refs.set(uri, kind);
    const list = [...refs];
    const results = await Promise.all(list.map(([u, k]) => this.fetchText(u, k).catch(() => null)));
    const failed: string[] = [];
    let ok = 0;
    results.forEach((t, i) => {
      if (t) {
        this.set(list[i][0], t);
        ok++;
      } else failed.push(list[i][0]);
    });
    return { ok, failed };
  }
}
const FETCH_TIMEOUT_MS = 3000;
/** Status list token gövdesi üst sınırı (sıkıştırılmış bit dizisi; 1 MiB milyonlarca girdiye yeter) — bellek tüketme saldırısı. */
const MAX_STATUS_TOKEN_BYTES = 1024 * 1024;
/** İkili gövde içerik türleri: CWT, CBOR, octet-stream ve `+cwt` / `+cbor` sonekleri (parametreler gözetilmez). */
export function isBinaryStatusContentType(contentType: string | null | undefined): boolean {
  const t = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return (
    t === "application/cwt" ||
    t === "application/cbor" ||
    t === "application/octet-stream" ||
    t.endsWith("+cwt") ||
    t.endsWith("+cbor")
  );
}
/**
 * Önbellekte saklanacak biçim: tanımlayıcı listesi her zaman bayt (`b64u:`); Status List her zaman metin; tür bilinmiyorsa ikili
 * içerik türü ya da geçerli UTF-8 olmayan gövde bayt olarak saklanır.
 */
export function statusBodyForCache(body: Uint8Array, kind: StatusListKind | undefined, contentType?: string | null) {
  const asBytes = () => `b64u:${Buffer.from(body).toString("base64url")}`;
  if (kind === "identifier_list") return asBytes();
  if (kind === undefined && isBinaryStatusContentType(contentType)) return asBytes();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body).trim();
  } catch {
    // Status List JWT metin olmalıdır: bozuk gövde bayt olarak saklanır, doğrulamada okunamaz (DOĞRULANAMADI/RED adımda)
    return asBytes();
  }
}
async function defaultFetch(url: string, kind?: StatusListKind): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        accept:
          kind === "identifier_list"
            ? "application/identifierlist+cwt, application/cwt;q=0.9, application/cbor;q=0.8, application/octet-stream;q=0.5"
            : kind === "status_list"
              ? "application/statuslist+jwt"
              : "application/statuslist+jwt, application/identifierlist+cwt",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!r.ok || !r.body) return null;
    if (Number(r.headers.get("content-length") ?? 0) > MAX_STATUS_TOKEN_BYTES) return null;
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > MAX_STATUS_TOKEN_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    // CIR 2024/2979 Ek II: tanımlayıcı listesi ikili CWT'dir — önbellekte base64url (`b64u:`) olarak tutulur
    return statusBodyForCache(Buffer.concat(chunks), kind, r.headers.get("content-type"));
  } catch {
    return null;
  }
}
