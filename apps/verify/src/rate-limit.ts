/**
 * Basit hız sınırı (süreç içi jeton kovası) — sunum açma, şifreli yanıt ve kapı doğrulama uçları için taşma koruması.
 * Gizlilik (DP1, PR14): istemci adresi saklanmaz ve loglanmaz. Kova anahtarı, adresin süreçle birlikte doğan rastgele bir
 * anahtarla HMAC'idir; yalnız bellekte durur (süreç kapanınca anahtar da kova da gider, geri çevrilemez). Sunucuda vekil
 * (nginx) istemci adresini iletmez; o durumda bütün istekler tek kovaya düşer ve sınır uç başına genel bir taşma tavanı olur.
 */
import { createHmac, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface RateRule {
  /** Kova kapasitesi (art arda izin verilen istek). */
  burst: number;
  /** Dakikada dolan jeton. */
  perMin: number;
}

/** Varsayılanlar: vekil arkasında genel tavan olarak da makul (pilot ölçeği). */
export const DEFAULT_RATE_RULES = {
  presentations: { burst: 60, perMin: 120 },
  vpResponse: { burst: 120, perMin: 240 },
  terminal: { burst: 300, perMin: 600 },
} satisfies Record<string, RateRule>;
export type RateRules = Record<keyof typeof DEFAULT_RATE_RULES, RateRule>;

const MAX_KEYS = 10_000;

export class TokenBucketLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  private secret = randomBytes(32);

  constructor(
    private rule: RateRule,
    private clock = () => Date.now(),
  ) {}

  /** İstemci adresinin geri çevrilemez kova anahtarı (yalnız bellekte; adres saklanmaz). */
  private keyOf(ip: string) {
    return createHmac("sha256", this.secret).update(ip).digest("base64url").slice(0, 22);
  }

  /** true = izin; false = sınır aşıldı. */
  take(ip: string): boolean {
    const now = this.clock();
    const k = this.keyOf(ip);
    const b = this.buckets.get(k) ?? { tokens: this.rule.burst, at: now };
    b.tokens = Math.min(this.rule.burst, b.tokens + ((now - b.at) / 60_000) * this.rule.perMin);
    b.at = now;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    this.buckets.delete(k); // ekleme sırası = son kullanım sırası (en eski önce atılır)
    this.buckets.set(k, b);
    if (this.buckets.size > MAX_KEYS) this.buckets.delete(this.buckets.keys().next().value!);
    return ok;
  }

  /** Bir jetonun dolma süresi (sn) — Retry-After. */
  retryAfterSec() {
    return Math.max(1, Math.ceil(60 / this.rule.perMin));
  }
}

/** Fastify preHandler: sınır aşılınca 429 (kişisel veri yok; adres loglanmaz). */
export function rateLimitHook(limiter: TokenBucketLimiter) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (limiter.take(req.ip ?? "")) return;
    return reply.code(429).header("retry-after", String(limiter.retryAfterSec())).send({ error: "rate_limited" });
  };
}
