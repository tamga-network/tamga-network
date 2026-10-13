/**
 * Status List ön çekim önbelleği — SPEC-CRED-0003 §9.1 / S12: doğrulama başına çekim YASAK; toplu, zamanlanmış ön çekim.
 * Çekilecek URI seti güven çapalarından (anchors.jsonl `list_uri`) türetilir: verifier hangi listelerin var olduğunu
 * kimseye sormadan bilir ve hepsini birden çeker (sürü mahremiyeti).
 *
 * Tanımlayıcı listeleri (Attestation Revocation List; CIR 2024/2979 Ek II) için çapa günlüğü yoktur: adres, imzası doğrulanmış
 * bir belgede ilk görüldüğünde `want` ile ön çekim kümesine eklenir ve hemen (doğrulamayı bekletmeden) çekilir; o doğrulama
 * önbellekte liste olmadığı için DOĞRULANAMADI (D2) döner, sonraki doğrulamalar önbellekten okur ve liste her ön çekim turunda
 * tazelenir (D4). Doğrulama hiçbir zaman ağ isteğini beklemez (S12).
 *
 * Adres belgeden gelir (belge verenin imzası altında, ama doğrulayıcının seçmediği bir adres); öğrenme bu yüzden sınırlıdır (0.5.2):
 *  - yalnız `https` (yerel geliştirmede `allowLocal` ile yerel `http`);
 *  - yalnız o kurumun imzalı listedeki kaydında bildirdiği iptal sunucuları (`statusHostsOf`: `status_list_base` ve `issuer_url`
 *    alan adı) — başka bir sunucudaki adres ilk görüşte de çekilmez;
 *  - özel, geri döngü, bağlantı-yerel ve benzeri adreslere istek yok (SSRF): IP yazılmış adres doğrudan, alan adı çözülerek
 *    denetlenir (`allowLocal` dışında);
 *  - üst sınır kurum başınadır (`maxPerIssuer`): bir kurumun belgeleri başka kurumların listelerini dışarıda bırakamaz.
 * Çekim (0.5.2): yönlendirme otomatik izlenmez; en çok `MAX_STATUS_REDIRECTS` adım elle izlenir ve öğrenilen adreste her adımda
 * şema, kurumun sunucusu ve genel IP yeniden denetlenir. Bağlantı denetlenen IP'ye sabitlenir (`pinnedLookup`; SNI ve Host alan
 * adı kalır): denetimle bağlantı arasında ad yeniden çözülüp iç ağa yönelemez (DNS rebinding). Yalnız Node; tarayıcı yapısında
 * bu modül yoktur. Dış (federasyon) kurumun iptal sunucuları: `externalStatusScope` (steps.ts).
 */
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import http from "node:http";
import https from "node:https";

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

/** Belgedeki liste adresinin ait olması gereken kurum ve onun imzalı listede bildirdiği iptal sunucuları. */
export interface StatusListScope {
  /** kurumun güven listesindeki kimliği (`issuer_id`) — üst sınır kurum başınadır */
  issuer: string;
  /** kurumun bildirdiği iptal sunucularının alan adları (`statusHostsOf`) — birebir eşleşme */
  hosts: string[];
  /**
   * Alan adı ve alt alan adları kabul edilen etki alanları (en az iki etiket; birebir değil). Yalnız dış kurumda, dış liste iptal
   * hizmeti adresi bildirmediğinde belge imzacısı sertifikasının SAN alan adlarından (`externalStatusScope`).
   */
  domains?: string[];
  /** yalnız yerel geliştirme: `http` ve yerel / özel ağ adresleri kabul edilir */
  allowLocal?: boolean;
}

/** Kurum kaydından iptal sunucuları: `status_list_base` ve `issuer_url` alan adları (küçük harf; boş ya da bozuk adres atlanır). */
export function statusHostsOf(rec: { status_list_base?: string; issuer_url?: string } | null | undefined): string[] {
  const out = new Set<string>();
  for (const u of [rec?.status_list_base, rec?.issuer_url]) {
    if (!u) continue;
    try {
      out.add(bareHost(new URL(u).hostname));
    } catch {
      /* bozuk adres: atlanır */
    }
  }
  return [...out];
}
const bareHost = (h: string) => h.toLowerCase().replace(/^\[|\]$/g, "");

export interface StatusCache {
  get(uri: string): CachedToken | null;
  /**
   * Doğrulama adımı bu listeye ihtiyaç duydu ama önbellekte yok (yalnız imzası doğrulanmış belgedeki adres için çağrılır).
   * Önbellek adresi ön çekim kümesine ekleyebilir; çağrı beklemez, ağ isteği doğrulamanın dışında yapılır (S12). `scope`
   * verilmezse ya da adres kurumun bildirdiği iptal sunucularından birinde değilse öğrenilmez.
   */
  want?(uri: string, kind: StatusListKind, scope?: StatusListScope): void;
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

/** Kurum başına sonradan öğrenilen (çapasız) adres sayısı üst sınırı — bellek ve dışarıya istek sayısı. */
const MAX_LEARNED_PER_ISSUER = 64;

/**
 * Dışarıya istek yapılmaması gereken adres mi (SSRF): belirtilmemiş, geri döngü, özel (RFC 1918, ULA), bağlantı-yerel, paylaşılan
 * (100.64/10), çok noktaya yayın ve ayrılmış aralıklar; IPv4 eşlemeli IPv6'da içteki IPv4'e bakılır. IP değilse `false`.
 */
export function isNonPublicAddress(address: string): boolean {
  const ip = bareHost(address);
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const mapped = /^(?:0{0,4}:){0,5}(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(ip.replace(/^::/, "0:"));
    if (mapped) return isNonPublicAddress(mapped[1]);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(ip)) {
      const [hi, lo] = ip
        .slice(7)
        .split(":")
        .map((h) => parseInt(h, 16));
      return isNonPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    if (ip === "::" || ip === "::1") return true;
    const first = parseInt(ip.split(":")[0] || "0", 16);
    return (
      (first & 0xfe00) === 0xfc00 || // fc00::/7 ULA
      (first & 0xffc0) === 0xfe80 || // fe80::/10 bağlantı-yerel
      (first & 0xff00) === 0xff00 || // ff00::/8 çok noktaya yayın
      first === 0x64 // 64:ff9b::/96 NAT64 (iç ağa çevrilebilir)
    );
  }
  return false;
}
const isLocalHostName = (h: string) =>
  h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || isNonPublicAddress(h);

/** Alan adı → IP adresleri (testler sahtesini verir). */
export type HostResolver = (host: string) => Promise<string[]>;
const defaultResolver: HostResolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/**
 * Tek HTTP isteği; yönlendirme İZLENMEZ (3xx `location` ile döner, izleme kararı önbellekte). `address` verilirse bağlantı o
 * IP'ye kurulur (alan adı yeniden çözülmez — DNS rebinding); TLS SNI, sertifika denetimi ve Host başlığı alan adıyla kalır.
 */
export interface StatusHttpRequest {
  url: URL;
  address?: string;
  family?: 4 | 6;
  accept: string;
  timeoutMs: number;
  maxBytes: number;
}
export interface StatusHttpResponse {
  status: number;
  location: string | null;
  contentType: string | null;
  /** 2xx gövdesi; üst sınırı aşan gövde ve 2xx dışı yanıt `null` */
  body: Uint8Array | null;
}
export type StatusTransport = (req: StatusHttpRequest) => Promise<StatusHttpResponse>;

export interface PrefetchStatusCacheOptions {
  /** kurum başına öğrenilen adres üst sınırı (varsayılan 64) */
  maxPerIssuer?: number;
  /** alan adı çözücü; varsayılan `node:dns` */
  resolveHost?: HostResolver;
  /** HTTP taşıyıcısı (yalnız `fetchText` verilmediğinde kullanılır); varsayılan `nodeStatusTransport` (IP sabitlemeli) */
  transport?: StatusTransport;
}

/** Bir liste çekiminde izlenen en çok yönlendirme sayısı (her adımda adres yeniden denetlenir). */
export const MAX_STATUS_REDIRECTS = 3;

/** Adresin alan adı kapsamda mı: `hosts` birebir; `domains` (en az iki etiketli) kendisi ya da alt alan adı. */
const hostInScope = (host: string, scope: StatusListScope) =>
  scope.hosts.map(bareHost).includes(host) ||
  (scope.domains ?? []).map(bareHost).some((d) => d.includes(".") && (host === d || host.endsWith(`.${d}`)));

export class PrefetchStatusCache extends MemoryStatusCache {
  private learned = new Map<string, { kind: StatusListKind; scope: StatusListScope }>();
  private pending = new Set<string>();
  private readonly maxPerIssuer: number;
  private readonly resolveHost: HostResolver;
  private readonly transport: StatusTransport;
  /**
   * `fetchText` verilmezse (üretim) çekim bu önbelleğin denetimli yoluyla yapılır: yönlendirme elle izlenir (en çok
   * `MAX_STATUS_REDIRECTS`), öğrenilen adreste her adımda şema + kurumun sunucusu + genel IP denetlenir ve bağlantı denetlenen
   * IP'ye sabitlenir. `fetchText` verilirse (testler, özel ortam) yalnız ilk adres denetlenir; çekici yönlendirme İZLEMEMELİDİR.
   */
  constructor(
    private fetchText?: StatusFetcher,
    opts: PrefetchStatusCacheOptions = {},
  ) {
    super();
    this.maxPerIssuer = opts.maxPerIssuer ?? MAX_LEARNED_PER_ISSUER;
    this.resolveHost = opts.resolveHost ?? defaultResolver;
    this.transport = opts.transport ?? nodeStatusTransport;
  }
  /** Sonradan öğrenilen (çapa günlüğünde olmayan) adresler — her `refresh` turunda onlar da çekilir. */
  learnedRefs(): StatusListRef[] {
    return [...this.learned].map(([uri, { kind }]) => ({ uri, kind }));
  }
  /** Adres bu kurumdan öğrenilebilir mi: biçim, şema, kurumun bildirdiği sunucu, IP yazılmış yerel adres. Ağ isteği yok. */
  static acceptableUri(uri: string, scope: StatusListScope | undefined): boolean {
    if (!scope || (!scope.hosts.length && !scope.domains?.length)) return false;
    let u: URL;
    try {
      u = new URL(uri);
    } catch {
      return false;
    }
    if (u.username || u.password) return false;
    const host = bareHost(u.hostname);
    const local = isLocalHostName(host);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && scope.allowLocal && local)) return false;
    if (!hostInScope(host, scope)) return false;
    return !local || !!scope.allowLocal;
  }
  want(uri: string, kind: StatusListKind, scope?: StatusListScope): void {
    if (!scope || this.learned.has(uri) || this.pending.has(uri)) return;
    if (!PrefetchStatusCache.acceptableUri(uri, scope)) return;
    let n = 0;
    for (const l of this.learned.values()) if (l.scope.issuer === scope.issuer) n++;
    if (n >= this.maxPerIssuer) return;
    this.learned.set(uri, { kind, scope });
    this.pending.add(uri);
    void this.refreshOne({ uri, kind }).finally(() => this.pending.delete(uri));
  }
  /**
   * Alan adı yalnız genel adreslere çözülüyorsa bağlanılacak adres (SSRF); özel / çözülemeyen adda `null`. Dönen IP'ye
   * bağlanılır — denetimle bağlantı arasında ad yeniden çözülmez (DNS rebinding).
   */
  private async pinnedAddress(host: string): Promise<{ address: string; family: 4 | 6 } | null> {
    const v = isIP(host);
    if (v) return isNonPublicAddress(host) ? null : { address: host, family: v as 4 | 6 };
    try {
      const addrs = await this.resolveHost(host);
      if (!addrs.length || addrs.some((a) => !isIP(a) || isNonPublicAddress(a))) return null;
      return { address: addrs[0], family: isIP(addrs[0]) as 4 | 6 };
    } catch {
      return null;
    }
  }
  private async fetchChecked(uri: string, kind: StatusListKind | undefined): Promise<string | null> {
    const scope = this.learned.get(uri)?.scope;
    if (this.fetchText) {
      if (scope && !scope.allowLocal) {
        let host: string;
        try {
          host = bareHost(new URL(uri).hostname);
        } catch {
          return null;
        }
        if (!(await this.pinnedAddress(host))) return null;
      }
      return this.fetchText(uri, kind).catch(() => null);
    }
    return this.guardedFetch(uri, kind, scope);
  }
  /**
   * Denetimli çekim: yönlendirmeler elle izlenir. Öğrenilen adreste (kurumun belgesinden) her adımda `acceptableUri` (https,
   * kurumun iptal sunucusu) ve genel IP denetlenir, bağlantı o IP'ye sabitlenir. Çapa günlüğündeki adres (imzalı yayıncı
   * kaydı) için yönlendirme yalnız aynı kökene izlenir.
   */
  private async guardedFetch(
    uri: string,
    kind: StatusListKind | undefined,
    scope: StatusListScope | undefined,
  ): Promise<string | null> {
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      return null;
    }
    const origin = url.origin;
    for (let hop = 0; hop <= MAX_STATUS_REDIRECTS; hop++) {
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      let pin: { address: string; family: 4 | 6 } | null = null;
      if (scope) {
        if (!PrefetchStatusCache.acceptableUri(url.href, scope)) return null;
        if (!scope.allowLocal) {
          pin = await this.pinnedAddress(bareHost(url.hostname));
          if (!pin) return null;
        }
      } else if (hop > 0 && url.origin !== origin) return null;
      let r: StatusHttpResponse;
      try {
        r = await this.transport({
          url,
          ...(pin ?? {}),
          accept: acceptFor(kind),
          timeoutMs: FETCH_TIMEOUT_MS,
          maxBytes: MAX_STATUS_TOKEN_BYTES,
        });
      } catch {
        return null;
      }
      if (r.status >= 300 && r.status < 400) {
        if (!r.location) return null;
        try {
          url = new URL(r.location, url);
        } catch {
          return null;
        }
        continue;
      }
      if (r.status < 200 || r.status >= 300 || !r.body) return null;
      // CIR 2024/2979 Ek II: tanımlayıcı listesi ikili CWT'dir — önbellekte base64url (`b64u:`) olarak tutulur
      return statusBodyForCache(r.body, kind, r.contentType);
    }
    return null;
  }
  private async refreshOne(ref: StatusListRef): Promise<boolean> {
    const t = await this.fetchChecked(ref.uri, ref.kind);
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
    for (const [uri, { kind }] of this.learned) if (!refs.has(uri) || refs.get(uri) === undefined) refs.set(uri, kind);
    const list = [...refs];
    const results = await Promise.all(list.map(([u, k]) => this.fetchChecked(u, k)));
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
const acceptFor = (kind: StatusListKind | undefined) =>
  kind === "identifier_list"
    ? "application/identifierlist+cwt, application/cwt;q=0.9, application/cbor;q=0.8, application/octet-stream;q=0.5"
    : kind === "status_list"
      ? "application/statuslist+jwt"
      : "application/statuslist+jwt, application/identifierlist+cwt";

/**
 * `lookup` yerine geçer: bağlantı önceden denetlenmiş IP'ye kurulur (Node `net.connect` ve `autoSelectFamily` iki çağrı
 * biçimini de kullanır: tek adres ya da `all: true` ile dizi). Alan adı yeniden çözülmez.
 */
export function pinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return ((_host: string, opts: unknown, cb?: (...a: unknown[]) => void) => {
    const callback = typeof opts === "function" ? (opts as (...a: unknown[]) => void) : cb!;
    if (opts && typeof opts === "object" && (opts as { all?: boolean }).all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  }) as unknown as LookupFunction;
}

/**
 * Varsayılan taşıyıcı — yalnız Node (bu modül `node:dns` kullanır, tarayıcı yapısına girmez; tarayıcıdaki `/web` alt yolu liste
 * çekmez): `node:https` / `node:http`, yönlendirme izlemez, `address` verilirse bağlantıyı o IP'ye sabitler (`pinnedLookup`); SNI,
 * sertifika denetimi ve Host alan adıyla kalır. Her istek yeni bağlantı (`agent: false`): havuzdaki başka bir sokete binilmez.
 */
export const nodeStatusTransport: StatusTransport = (req) =>
  new Promise<StatusHttpResponse>((resolve, reject) => {
    const mod = req.url.protocol === "https:" ? https : req.url.protocol === "http:" ? http : null;
    if (!mod) return reject(new Error("unsupported scheme"));
    const family = req.family ?? ((isIP(req.address ?? "") || 4) as 4 | 6);
    const r = mod.request(
      req.url,
      {
        method: "GET",
        headers: { accept: req.accept },
        agent: false,
        signal: AbortSignal.timeout(req.timeoutMs),
        ...(req.address ? { lookup: pinnedLookup(req.address, family) } : {}),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const contentType = res.headers["content-type"] ?? null;
        let settled = false;
        const done = (body: Uint8Array | null) => {
          if (settled) return;
          settled = true;
          resolve({ status, location, contentType, body });
        };
        if (status < 200 || status >= 300 || Number(res.headers["content-length"] ?? 0) > req.maxBytes) {
          res.resume();
          return done(null);
        }
        const chunks: Buffer[] = [];
        let n = 0;
        res.on("data", (c: Buffer) => {
          n += c.length;
          if (n > req.maxBytes) {
            res.destroy();
            done(null);
          } else chunks.push(c);
        });
        res.on("end", () => done(new Uint8Array(Buffer.concat(chunks))));
        res.on("error", (e) => (settled ? undefined : reject(e)));
      },
    );
    r.on("error", reject);
    r.end();
  });
