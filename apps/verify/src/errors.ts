/**
 * Ortak hata yanıtı (güvenlik incelemesi 2026-11-18; OWASP ASVS 16.5.1). Bilerek `statusCode` verilmiş hatalar (4xx/5xx — ör.
 * Fastify'ın gövde ayrıştırma 400'ü) iletisiyle döner. Beklenmeyen hata (statusCode yok) dışarıya genel "internal error" olarak
 * döner; iletisi (kütüphane hatası kişi alanı ya da istek değeri taşıyabilir) yanıta da günlüğe de yazılmaz — günlükte yalnız
 * yöntem, rota kalıbı ve hata türü (AP3/AP4, PR14).
 */
import type { FastifyInstance } from "fastify";

export function installErrorHandler(app: FastifyInstance, service = "verify") {
  app.setErrorHandler((e: Error & { statusCode?: number; code?: string }, req, reply) => {
    const code = typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 500;
    // 4xx: istek hatası, ileti çağıranın kendi isteğini anlatır. 5xx: `statusCode` taşısa da (kütüphane ya da eklenti hatası)
    // ileti iç ayrıntı olabilir — yanıta ve günlüğe yazılmaz (denetim turu D)
    if (e.statusCode === code && code < 500)
      return reply.code(code).send({ statusCode: code, error: httpReason(code), message: e.message });
    const route = (req.routeOptions as { url?: string } | undefined)?.url ?? "?";
    console.error(`[${service}] ${code} ${req.method} ${route}: ${e.name}${e.code ? ` (${e.code})` : ""}`);
    return reply.code(code).send({ statusCode: code, error: httpReason(code), message: "internal error" });
  });
}

const REASONS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};
const httpReason = (c: number) => REASONS[c] ?? (c < 500 ? "Bad Request" : "Internal Server Error");
