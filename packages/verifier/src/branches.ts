/**
 * ADR-0067 çekim dalları — doğrulayıcının paylaşılan durum makinesi (Tamga Verify, kurumun belge verme servisi ve kendi sunucusunda
 * doğrulayan siteler aynı birimi kullanır; kural iki yerde ayrı ayrı yazılmaz).
 *
 *  - RQ1: `request_uri`'nin her çekimi (`BranchSet.fetch`) yeni dal: taze `state` (128 bit), `nonce`, efemer şifreleme anahtarı;
 *    POST çekimde `wallet_nonce` geri yazılır. İmzalı istek nesnesi çekene verilir ve SAKLANMAZ: dal yalnız `state`'in özetini
 *    (SHA-256), `nonce`'u, özel anahtarı, `kid`'i ve zamanları tutar (bellek, Değişiklik notu 2026-10-29).
 *  - RQ2: ret yalnız kendi dalını kapatır (`decline`); sunum yalnız tek çekimi varsa REJECTED olur.
 *  - RQ4: denemeler dal başına (`failedAttempt`); dalsız yol (DC API) için sunum başına.
 *  - RQ5 (Değişiklik notu 2026-10-29): sabit 429 yok. Dal sayısı yumuşak sınırı (`softCap`) aşınca HİÇ YANIT ALMAMIŞ ve en az
 *    `minAgeSec` yaşındaki en eski dal (önce kapanmış dallar) atılır; yanıtı işlenmekte olan dal ASLA atılmaz. Sert sınırda
 *    (`hardCap`) yaş koşulu düşer. Bütün sunumlar için ortak bir dal bütçesi (`BranchRegistry`) belleği sınırlar.
 *  - Ret `state` ile bulunur (şifresiz hata yanıtı `kid` taşımaz): arama `state` özetiyle Map'ten (doğrusal tarama yok), eşitlik
 *    `timingSafeEqual` ile (sabit süreli).
 *  - Tek kullanım (PV10): `begin` → (çözme / doğrulama) → `end`; kilit tutulurken başka yanıt ya da ret işlenmez, işlenen dal atılmaz.
 *    Çözmeden ÖNCE `begin` çağrılır; çözmeden sonra `isOpen` ile yeniden bakılır.
 * Hız sınırı HTTP katmanındadır (vekilde IP başına + uygulamada genel tavan); bu birim kişisel veri ve istemci adresi tutmaz.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { createRequestBranch, type KeyLike, type RequestBranch, type RequestContent } from "./request.js";

/** Varsayılan sınırlar (ADR-0067 Değişiklik notu 2026-10-29). */
export const BRANCH_LIMITS = {
  /** Dal sayısı bunu aşınca yeni çekim, atılabilir bir eski dalın yerini alır (sabit 429 yok). */
  softCap: 10,
  /** Sert tavan: burada yaş koşulu düşer; işlenmekte olan dal yine atılmaz. */
  hardCap: 32,
  /** Yumuşak sınırda hiç yanıt almamış dalın atılabilmesi için en az yaşı (sn) — gerçek cüzdana onay süresi. */
  minAgeSec: 120,
  /** Sahiplik kanıtına ulaşmayan (çözülmüş) yanıt sınırı: dal başına; dalsız yolda sunum başına (RQ4). */
  maxAttempts: 5,
} as const;
export type BranchLimits = { -readonly [K in keyof typeof BRANCH_LIMITS]: number };

/** Bütün sunumlar için ortak dal bütçesi (bellek tavanı). */
export const DEFAULT_GLOBAL_BRANCHES = 20_000;

/** Bir çekim dalı (sıkıştırılmış): `state`'in kendisi ve imzalı istek nesnesi tutulmaz. */
export interface Branch {
  /** `kid`'deki dal adı (`enc-<sunum>.<dal>`); gizli değil. */
  readonly branchId: string;
  /** Kaçıncı çekim (1'den; atılan dallar sayıdan düşmez) — izleme kaydı için. */
  readonly index: number;
  readonly nonce: string;
  /** SHA-256(state) — `state` yalnız bu dalın istek nesnesinde geçti. */
  readonly stateHash: Uint8Array;
  readonly encPrivateKey: KeyLike;
  /** RFC 7638 parmak izi (mdoc SessionTranscript, OpenID4VP 1.0 Ek B.2.6.1). */
  readonly encJwkThumbprint: Uint8Array;
  /** Çekim zamanı (sn). */
  readonly createdAt: number;
  /** Bu dalda sahiplik kanıtına ulaşmadan başarısız olan (çözülmüş) yanıt sayısı. */
  readonly attempts: number;
  /** Kapandı: kişi reddetti ya da deneme sınırı doldu; kapalı dala yanıt kabul edilmez. */
  readonly closed?: "declined" | "attempts";
  /** Bu dala gelen bir yanıt şu anda işleniyor (atılmaz). */
  readonly inFlight: boolean;
  /** Bu dala en son yanıt (ret dahil) geldiği zaman (sn). */
  readonly answeredAt?: number;
}
type MutableBranch = { -readonly [K in keyof Branch]: Branch[K] };

export type FetchResult =
  | { ok: true; requestJwt: string; branch: Branch; /** yer açmak için atılan dal */ evicted?: Branch }
  | {
      ok: false;
      /**
       * `closed`: sunum tamamlandı · `expired`: süresi geçti · `capacity`: ortak dal bütçesi doldu ve atılabilir dal yok (503) ·
       * `limit`: sert tavanda bütün dallar işlenmekte (pratikte olmaz; 429)
       */
      reason: "closed" | "expired" | "capacity" | "limit";
    };

/** `begin` sonucu: `ok` dışındakiler yanıtı işlemeden reddetmek içindir. */
export type BeginResult = "ok" | "used" | "busy" | "closed" | "gone";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest();
const nowSec = () => Math.floor(Date.now() / 1000);
/** OpenID4VP `state` için makul üst sınır (bizim ürettiğimiz 22 karakter; aramada uzun girdiye özet hesaplanmaz). */
const MAX_STATE_LEN = 512;

/**
 * Ortak dal kaydı: `state` özetinden dala (şifresiz ret araması) ve bütün sunumlar için dal bütçesi. Süreç başına bir tane;
 * çok örnekli kurulumda paylaşılan bir depoya taşınmalıdır (bu sınıf bellek içidir).
 */
export class BranchRegistry {
  readonly maxBranches: number;
  /** base64url(SHA-256(state)) → dal; ekleme sırası = yaş */
  private byHash = new Map<string, { set: BranchSet; branch: MutableBranch }>();

  constructor(o: { maxBranches?: number } = {}) {
    this.maxBranches = o.maxBranches ?? DEFAULT_GLOBAL_BRANCHES;
    if (!(this.maxBranches >= 1)) throw new Error("maxBranches must be ≥ 1");
  }

  get size() {
    return this.byHash.size;
  }

  /**
   * Şifresiz hata yanıtı (`error` + `state`, `kid` yok) için dal: yalnız bekleyen, süresi geçmemiş sunumların açık ya da kapalı
   * dalları. Arama özetle (Map), eşitlik sabit süreli.
   */
  byState(state: unknown, now = nowSec()): { set: BranchSet; branch: Branch } | undefined {
    if (typeof state !== "string" || !state || state.length > MAX_STATE_LEN) return undefined;
    const h = sha256(state);
    const e = this.byHash.get(h.toString("base64url"));
    if (!e || !timingSafeEqual(h, e.branch.stateHash)) return undefined;
    if (e.set.used || e.set.expiresAt < now) return undefined;
    return e;
  }

  /** @internal */
  _add(set: BranchSet, branch: MutableBranch) {
    this.byHash.set(Buffer.from(branch.stateHash).toString("base64url"), { set, branch });
  }

  /** @internal */
  _remove(branch: Branch) {
    const k = Buffer.from(branch.stateHash).toString("base64url");
    if (this.byHash.get(k)?.branch === branch) this.byHash.delete(k);
  }

  /**
   * @internal Bütçe doluysa yer açar: önce süresi geçmiş ya da tamamlanmış sunumların dalları, sonra (en eskiden) kapanmış dallar,
   * hiç yanıt almamış ve `minAgeSec`'ten yaşlı dallar, başarısız yanıt almış dallar, en son herhangi bir dal. İşlenmekte olan dal
   * atılmaz; hepsi işlenmekteyse `false` (çağıran 503 döner).
   */
  _makeRoom(now: number): boolean {
    if (this.byHash.size < this.maxBranches) return true;
    for (const { set, branch } of [...this.byHash.values()]) if (set.used || set.expiresAt < now) set._evict(branch);
    if (this.byHash.size < this.maxBranches) return true;
    const tiers: Array<(set: BranchSet, b: MutableBranch) => boolean> = [
      (_s, b) => !!b.closed,
      (s, b) => b.attempts === 0 && now - b.createdAt >= s.limits.minAgeSec,
      (_s, b) => b.attempts > 0,
      () => true,
    ];
    for (const fits of tiers)
      for (const { set, branch } of this.byHash.values())
        if (!branch.inFlight && fits(set, branch)) {
          set._evict(branch);
          return true;
        }
    return false;
  }
}

export interface BranchSetOptions {
  registry: BranchRegistry;
  presentationId: string;
  /** Sunumun bitişi (sn) — dalların `exp`'i. */
  expiresAt: number;
  /** İstek nesnesinin sunum boyunca aynı kalan içeriği (imzacı, DCQL, `response_uri`, kayıt sertifikası …). */
  content: RequestContent;
  limits?: Partial<BranchLimits>;
  /** Saat (sn); test için. */
  clock?: () => number;
  /** Dal üretimi (test için değiştirilebilir); varsayılan `createRequestBranch`. */
  mint?: (walletNonce?: string) => Promise<RequestBranch>;
}

/**
 * Bir sunumun çekim dalları + tek kullanım kilidi. Kullanım (ayrıntı `docs/packages/verifier.md`):
 *
 * ```ts
 * const registry = new BranchRegistry();                 // süreç başına bir
 * const set = new BranchSet({ registry, presentationId, expiresAt, content });
 * // GET|POST /vp/req/:id
 * const f = await set.fetch(walletNonce);               // f.ok → f.requestJwt
 * // POST /vp/response (şifreli): kid → set.get(branchId) → set.begin(branch) → openPresentationResponse → set.isOpen(branch) …
 * // POST /vp/response (şifresiz ret): registry.byState(state) → set.begin(branch) → set.decline(branch) → set.end(branch)
 * ```
 */
export class BranchSet {
  readonly presentationId: string;
  readonly expiresAt: number;
  readonly limits: BranchLimits;
  private live = new Map<string, MutableBranch>(); // ekleme sırası = yaş
  private minted = 0;
  private minting = 0;
  private _used = false;
  private _busy = false;
  private _attempts = 0;
  private pathAttempts = 0;
  private readonly registry: BranchRegistry;
  private readonly clock: () => number;
  private readonly mint: (walletNonce?: string) => Promise<RequestBranch>;

  constructor(o: BranchSetOptions) {
    this.registry = o.registry;
    this.presentationId = o.presentationId;
    this.expiresAt = o.expiresAt;
    this.limits = { ...BRANCH_LIMITS, ...o.limits };
    if (!(this.limits.softCap >= 1 && this.limits.hardCap >= this.limits.softCap && this.limits.maxAttempts >= 1))
      throw new Error("branch limits: 1 ≤ softCap ≤ hardCap, maxAttempts ≥ 1");
    this.clock = o.clock ?? nowSec;
    this.mint =
      o.mint ??
      ((walletNonce) =>
        createRequestBranch({ ...o.content, presentationId: o.presentationId, expiresAt: o.expiresAt, walletNonce }));
  }

  /** Sunum tamamlandı (kabul, tek çekimli ret ya da deneme sınırı) — yeni dal açılmaz, yanıt kabul edilmez. */
  get used() {
    return this._used;
  }
  /** Bir yanıt şu anda işleniyor (`begin` … `end`). */
  get busy() {
    return this._busy;
  }
  /** Sahiplik kanıtına ulaşmadan başarısız olan (çözülmüş) yanıtların toplamı — durum API'sindeki `attempts`. */
  get attempts() {
    return this._attempts;
  }
  /** Şimdiye dek verilen çekim sayısı (atılanlar dahil). */
  get fetchCount() {
    return this.minted;
  }
  /** Bellekteki dallar (eskiden yeniye). */
  list(): readonly Branch[] {
    return [...this.live.values()];
  }
  get(branchId: string): Branch | undefined {
    return this.live.get(branchId);
  }

  /** Sunum birden çok çekim gördü mü (imzalanmakta olanlar dahil) — ret ve deneme sınırı sunumu kapatmaz (RQ2). */
  private multi() {
    return this.minted + this.minting > 1;
  }

  /**
   * RQ1: yeni çekim dalı. Yumuşak sınırda atılabilir bir eski dalın yerini alır; ortak bütçe doluysa önce oradan yer açılır.
   * `walletNonce` (OpenID4VP 1.0 §5.10) biçim dışıysa yazılmaz.
   */
  async fetch(walletNonce?: unknown): Promise<FetchResult> {
    const now = this.clock();
    if (this._used) return { ok: false, reason: "closed" };
    if (this.expiresAt < now) return { ok: false, reason: "expired" };
    let evicted: Branch | undefined;
    const count = this.live.size + this.minting;
    if (count >= this.limits.softCap) {
      evicted = this.victim(now, count >= this.limits.hardCap);
      if (evicted) this._evict(evicted);
      else if (count >= this.limits.hardCap) return { ok: false, reason: "limit" };
    }
    if (!this.registry._makeRoom(now)) return { ok: false, reason: "capacity" };
    this.minting += 1;
    let rb: RequestBranch;
    try {
      rb = await this.mint(typeof walletNonce === "string" ? walletNonce : undefined);
    } finally {
      this.minting -= 1;
    }
    if (this._used) return { ok: false, reason: "closed" }; // imzalanırken sunum tamamlandı
    const b: MutableBranch = {
      branchId: rb.branchId,
      index: ++this.minted,
      nonce: rb.nonce,
      stateHash: sha256(rb.state),
      encPrivateKey: rb.encPrivateKey,
      encJwkThumbprint: rb.encJwkThumbprint,
      createdAt: rb.createdAt,
      attempts: 0,
      inFlight: false,
    };
    this.live.set(b.branchId, b);
    this.registry._add(this, b);
    return { ok: true, requestJwt: rb.requestJwt, branch: b, ...(evicted ? { evicted } : {}) };
  }

  /**
   * Atılacak dal (en eskiden): kapanmış → hiç yanıt almamış ve `minAgeSec`'ten yaşlı → sert tavanda: çözülmüş ama başarısız yanıt
   * almış (gerçek cüzdan çoğunlukla ilk yanıtta tamamlar) → sert tavanda: herhangi biri. İşlenmekte olan dal hiçbir zaman.
   */
  private victim(now: number, atHard: boolean): Branch | undefined {
    const tiers: Array<(b: MutableBranch) => boolean> = [
      (b) => !!b.closed,
      (b) => b.attempts === 0 && now - b.createdAt >= this.limits.minAgeSec,
      ...(atHard ? [(b: MutableBranch) => b.attempts > 0, () => true] : []),
    ];
    for (const fits of tiers) for (const b of this.live.values()) if (!b.inFlight && fits(b)) return b;
    return undefined;
  }

  /** @internal dal bellekten ve ortak kayıttan çıkar (yanıtı artık "bilinmeyen dal"dır; deneme sayılmaz). */
  _evict(b: Branch) {
    if (b.inFlight) return;
    if (this.live.get(b.branchId) === b) this.live.delete(b.branchId);
    this.registry._remove(b);
  }

  /** Yanıttaki `state` bu dalın mı (SHA-256 + sabit süreli karşılaştırma). */
  stateMatches(b: Branch, state: unknown): boolean {
    if (typeof state !== "string" || state.length > MAX_STATE_LEN) return false;
    return timingSafeEqual(sha256(state), b.stateHash);
  }

  /** Dal (verildiyse) hâlâ yanıt alabilir mi: sunum bitmedi, dal bellekte ve kapanmadı. Çözmeden sonra yeniden bakılır. */
  isOpen(b?: Branch): boolean {
    if (this._used) return false;
    if (!b) return true;
    return this.live.get(b.branchId) === b && !b.closed;
  }

  /**
   * Bir yanıtı (sunum ya da ret; dalsız yolda `b` yok) işlemeye başla: tek kullanım kilidi. Çözmeden ÖNCE çağrılır; `ok` dönerse
   * işin sonunda `end` (try/finally). Kilit tutulurken başka yanıt/ret `busy` alır ve dal atılmaz.
   */
  begin(b?: Branch): BeginResult {
    if (this._used) return "used";
    if (this._busy) return "busy";
    if (b) {
      if (this.live.get(b.branchId) !== b) return "gone";
      if (b.closed) return "closed";
      (b as MutableBranch).inFlight = true;
      (b as MutableBranch).answeredAt = this.clock();
    }
    this._busy = true;
    return "ok";
  }

  end(b?: Branch) {
    this._busy = false;
    if (b) (b as MutableBranch).inFlight = false;
  }

  /**
   * RQ2: ret yalnız bu dalı kapatır. Sunum yalnız tek çekimi varsa REJECTED olur (`presentationRejected`; sunum tamamlanır).
   * Kapalı dala ikinci ret bir şey değiştirmez (`alreadyClosed`).
   */
  decline(b: Branch): { presentationRejected: boolean; alreadyClosed: boolean } {
    const m = b as MutableBranch;
    if (m.closed || this._used) return { presentationRejected: false, alreadyClosed: true };
    m.closed = "declined";
    if (this.multi()) return { presentationRejected: false, alreadyClosed: false };
    this.consume();
    return { presentationRejected: true, alreadyClosed: false };
  }

  /**
   * RQ4: çözülmüş ama sahiplik kanıtına ulaşmayan yanıt. Dalda `maxAttempts`'te yalnız o dal kapanır (sunum tek çekimliyse
   * REJECTED); dalsız yolda (DC API) sınır sunum başınadır.
   */
  failedAttempt(b?: Branch): { n: number; branchClosed: boolean; presentationRejected: boolean } {
    this._attempts += 1;
    const max = this.limits.maxAttempts;
    if (!b) {
      const n = (this.pathAttempts += 1);
      if (n >= max && !this._used) {
        this.consume();
        return { n, branchClosed: false, presentationRejected: true };
      }
      return { n, branchClosed: false, presentationRejected: false };
    }
    const m = b as MutableBranch;
    const n = (m.attempts += 1);
    if (n < max || m.closed) return { n, branchClosed: false, presentationRejected: false };
    m.closed = "attempts";
    if (this.multi() || this._used) return { n, branchClosed: true, presentationRejected: false };
    this.consume();
    return { n, branchClosed: true, presentationRejected: true };
  }

  /** Sunum tamamlandı (kabul ya da ret): dallar bellekten ve ortak kayıttan çıkar (özel anahtarlar bırakılır). */
  consume() {
    this._used = true;
    for (const b of this.live.values()) this.registry._remove(b);
    this.live.clear();
  }

  /** Sunum bellekten atılırken: dallar ortak kayıttan çıkar (sunum tamamlanmış sayılmaz). */
  dispose() {
    for (const b of this.live.values()) this.registry._remove(b);
    this.live.clear();
  }
}
