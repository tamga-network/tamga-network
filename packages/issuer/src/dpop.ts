/**
 * DPoP (RFC 9449) doğrulaması — HAIP; ARF ISSU_01. Token ucunda kanıtın anahtarı belirtece bağlanır (`jkt`), credential ucunda
 * aynı anahtar + belirteç özeti (`ath`) aranır. Kanıt tek kullanımlıktır (`jti` tekrar önbelleği), yöntem ve adres bağlıdır.
 * İsteğe bağlı sunucu nonce'u (RFC 9449 §8–9): `nonces` verilirse kanıtta geçerli bir `nonce` aranır; yoksa sonuç
 * `useNonce: true` döner ve uç `use_dpop_nonce` hatasıyla birlikte `DPoP-Nonce` başlığını gönderir (HAIP §4).
 */
import { createHash, randomBytes } from "node:crypto";
import { calculateJwkThumbprint, compactVerify, decodeProtectedHeader, importJWK, type JWK } from "jose";

export const DPOP_TYP = "dpop+jwt";
/** Kanıtın kabul edildiği saat penceresi (sn). */
export const DPOP_MAX_AGE_SEC = 300;

/**
 * Görülen `jti` değerleri (bellekte, pencere süresince). Kesin üst sınır `max`: dolunca önce süresi geçenler atılır, yine
 * doluysa EN ESKİ kayıtlar (ekleme sırası) atılır — kanıtları herkes kendi anahtarıyla üretebildiği için sınırsız büyüme bellek
 * tüketme saldırısı olurdu; atılan bir kanıtın tekrarı ayrıca çalınmış belirteç (ath/jkt bağı) gerektirir.
 */
export class DpopReplayCache {
  private seen = new Map<string, number>();
  constructor(private max = 50_000) {}
  /** İlk kez görülüyorsa kaydeder ve true döner. */
  claim(jti: string, until: number, now: number): boolean {
    const prev = this.seen.get(jti);
    if (prev !== undefined && prev >= now) return false;
    if (prev !== undefined) this.seen.delete(jti);
    if (this.seen.size >= this.max) {
      for (const [k, v] of this.seen) if (v < now) this.seen.delete(k);
      for (const k of this.seen.keys()) {
        if (this.seen.size < this.max) break;
        this.seen.delete(k);
      }
    }
    this.seen.set(jti, until);
    return true;
  }
  /** Kayıtlı jti sayısı (gözlem ve test). */
  get size(): number {
    return this.seen.size;
  }
}

/**
 * Dönen sunucu nonce'u: `rotateSec` saniyede bir yenilenir; bir önceki nonce da (saat kayması ve eşzamanlı istekler için)
 * geçerli sayılır. Bellekte tutulur.
 */
export class DpopNonces {
  private cur = "";
  private prev = "";
  private since = -Infinity;
  constructor(private rotateSec = 300) {}
  /** Şu anki nonce (gerekirse döndürür). */
  current(now: number): string {
    if (now - this.since >= this.rotateSec) {
      this.prev = this.cur;
      this.cur = randomBytes(16).toString("base64url");
      this.since = now;
    }
    return this.cur;
  }
  valid(nonce: unknown, now: number): boolean {
    this.current(now);
    return typeof nonce === "string" && nonce.length > 0 && (nonce === this.cur || nonce === this.prev);
  }
}

export type DpopResult = { ok: true; jkt: string } | { ok: false; reason: string; useNonce?: boolean };

const stripUrl = (u: string) => u.split(/[?#]/)[0];

export async function verifyDpop(
  proof: unknown,
  o: {
    htm: string;
    htu: string;
    now: number;
    replay: DpopReplayCache;
    /** credential ucu: belirteç verilirse `ath` zorunlu */
    accessToken?: string;
    /** belirtece bağlı anahtar parmak izi (credential ucu) */
    jkt?: string;
    /** verilirse kanıtta geçerli sunucu nonce'u zorunludur */
    nonces?: DpopNonces;
  },
): Promise<DpopResult> {
  if (typeof proof !== "string" || !proof) return { ok: false, reason: "DPoP proof missing" };
  let header: ReturnType<typeof decodeProtectedHeader>;
  try {
    header = decodeProtectedHeader(proof);
  } catch {
    return { ok: false, reason: "DPoP proof unreadable" };
  }
  if (header.typ !== DPOP_TYP || header.alg !== "ES256" || !header.jwk)
    return { ok: false, reason: "DPoP header (typ/alg/jwk)" };
  const jwk = header.jwk as JWK;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk)
    return { ok: false, reason: "DPoP jwk must be a public P-256 key" };
  let payload: { jti?: string; htm?: string; htu?: string; iat?: number; ath?: string; nonce?: string };
  try {
    const { payload: raw } = await compactVerify(proof, await importJWK(jwk, "ES256"));
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return { ok: false, reason: "DPoP signature invalid" };
  }
  if (payload.htm !== o.htm) return { ok: false, reason: "DPoP htm mismatch" };
  if (typeof payload.htu !== "string" || stripUrl(payload.htu) !== stripUrl(o.htu))
    return { ok: false, reason: "DPoP htu mismatch" };
  if (typeof payload.iat !== "number" || Math.abs(o.now - payload.iat) > DPOP_MAX_AGE_SEC)
    return { ok: false, reason: "DPoP iat outside the window" };
  if (typeof payload.jti !== "string" || payload.jti.length < 8 || payload.jti.length > 128)
    return { ok: false, reason: "DPoP jti" };
  const jkt = await calculateJwkThumbprint(jwk, "sha256");
  if (o.jkt && jkt !== o.jkt) return { ok: false, reason: "DPoP key is not the key bound to the token" };
  if (o.accessToken !== undefined) {
    const ath = createHash("sha256").update(o.accessToken).digest("base64url");
    if (payload.ath !== ath) return { ok: false, reason: "DPoP ath mismatch" };
  }
  if (o.nonces && !o.nonces.valid(payload.nonce, o.now))
    return { ok: false, reason: "DPoP nonce required", useNonce: true };
  // Tekrar denetimi en sonda: geçersiz kanıt önbelleği doldurmasın
  if (!o.replay.claim(`${jkt}.${payload.jti}`, payload.iat + DPOP_MAX_AGE_SEC, o.now))
    return { ok: false, reason: "DPoP proof replayed" };
  return { ok: true, jkt };
}

/** `Authorization: DPoP <tok>` ya da `Bearer <tok>` → şema + belirteç. */
export function parseAuthorization(h: unknown): { scheme: "DPoP" | "Bearer" | null; token: string } {
  const m = /^(DPoP|Bearer)\s+(\S+)$/i.exec(typeof h === "string" ? h.trim() : "");
  if (!m) return { scheme: null, token: "" };
  return { scheme: m[1].toLowerCase() === "dpop" ? "DPoP" : "Bearer", token: m[2] };
}
