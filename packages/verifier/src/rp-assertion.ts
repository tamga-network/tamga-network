/**
 * ADR-0017 (D-API-2) K1 — RP beyanı: barındırılan doğrulayıcıya "ben şu kayıtlı RP'yim" demenin yolu.
 * RP, güven listesindeki erişim sertifikasının özel anahtarıyla kısa ömürlü bir JWS imzalar (yeni sır yok):
 *   header { alg: ES256, typ: "tamga-rp+jwt", x5c: [erişim sertifikası] }
 *   payload { iss: client_id, aud: <doğrulayıcı tabanı>, iat, exp ≤ iat+60, jti }
 * Doğrulayıcı: imza (x5c[0]), x5c[0] parmak izi = güven listesindeki RP kaydı (HV5), RP ACTIVE, aud, süre, jti tekrarı.
 */
import { SignJWT, compactVerify, decodeProtectedHeader, importX509 } from "jose";
import { randomBytes } from "node:crypto";
import { certFingerprintSha256Hex, derToB64, derToPem } from "@tamga-network/core";
import type { RelyingParty } from "@tamga-network/trust";
import type { RpSigner } from "./request.js";

export const RP_ASSERTION_TYP = "tamga-rp+jwt";
export const RP_ASSERTION_MAX_TTL_SEC = 60;

export async function createRpAssertion(
  signer: RpSigner,
  audience: string,
  opts: { now?: number; ttlSec?: number } = {},
): Promise<string> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const ttl = Math.min(opts.ttlSec ?? RP_ASSERTION_MAX_TTL_SEC, RP_ASSERTION_MAX_TTL_SEC);
  return new SignJWT({
    iss: signer.clientId,
    aud: audience,
    iat: now,
    exp: now + ttl,
    jti: randomBytes(16).toString("base64url"),
  })
    .setProtectedHeader({ alg: "ES256", typ: RP_ASSERTION_TYP, x5c: [derToB64(signer.leafDer)] })
    .sign(signer.key);
}

export class RpAssertionError extends Error {}

/** jti tekrar listesi (bellek; süresi geçen kayıtlar temizlenir). */
export function makeJtiCache() {
  const seen = new Map<string, number>();
  return {
    /** İlk görüşte true; tekrar görülürse false. */
    add(jti: string, exp: number, now: number): boolean {
      for (const [k, e] of seen) if (e < now) seen.delete(k);
      if (seen.has(jti)) return false;
      seen.set(jti, exp);
      return true;
    },
  };
}
export type JtiCache = ReturnType<typeof makeJtiCache>;

/** `Authorization: Bearer <beyan>` başlığını doğrular; başarıda RP'nin client_id'si. */
export async function verifyRpAssertion(
  authorization: string | undefined,
  opts: {
    audience: string;
    relyingParty: (clientId: string) => RelyingParty | null;
    jti: JtiCache;
    now?: number;
    skewSec?: number;
  },
): Promise<string> {
  const m = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization ?? "");
  if (!m) throw new RpAssertionError("rp assertion required");
  const token = m[1];
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const skew = opts.skewSec ?? 30;
  const h = decodeProtectedHeader(token);
  if (h.typ !== RP_ASSERTION_TYP || h.alg !== "ES256" || !Array.isArray(h.x5c) || !h.x5c[0])
    throw new RpAssertionError("rp assertion header invalid");
  const leafDer = new Uint8Array(Buffer.from(h.x5c[0], "base64"));
  const key = await importX509(derToPem(leafDer), "ES256");
  const { payload } = await compactVerify(token, key).catch(() => {
    throw new RpAssertionError("rp assertion signature invalid");
  });
  const c = JSON.parse(new TextDecoder().decode(payload)) as {
    iss?: string;
    aud?: string;
    iat?: number;
    exp?: number;
    jti?: string;
  };
  if (!c.iss || !c.jti || typeof c.iat !== "number" || typeof c.exp !== "number")
    throw new RpAssertionError("rp assertion claims missing");
  if (c.aud !== opts.audience) throw new RpAssertionError("rp assertion audience mismatch");
  if (c.exp - c.iat > RP_ASSERTION_MAX_TTL_SEC) throw new RpAssertionError("rp assertion lifetime too long");
  if (c.exp + skew < now || c.iat - skew > now) throw new RpAssertionError("rp assertion expired or not yet valid");
  const rp = opts.relyingParty(c.iss);
  if (!rp || rp.status !== "ACTIVE") throw new RpAssertionError("relying party not registered or not active");
  if (certFingerprintSha256Hex(leafDer) !== rp.access_cert_fingerprint_sha256)
    throw new RpAssertionError("rp assertion certificate does not match the trust list");
  if (!opts.jti.add(c.jti, c.exp + skew, now)) throw new RpAssertionError("rp assertion replayed");
  return c.iss;
}
