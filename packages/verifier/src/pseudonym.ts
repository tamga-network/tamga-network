/**
 * ADR-0031 — site başına takma adın doğrulanması (PS5; ARF Topic 11 PA_11–PA_14).
 * Cüzdan vp_token'da, istekteki `format: "tamga-pseudonym"` sorgusunun id'siyle bir JWT gönderir:
 *   başlık  { alg: ES256, typ: "tamga-pseudonym+jwt", jwk: <takma ad açık anahtarı> }
 *   gövde   { aud: <client_id>, nonce, iat, rp: <asıl RP'nin kayıtlı kimliği>, wia: <cüzdan örneği kanıtı>, wia_pop: <PoP> }
 * Denetim: imza başlıktaki anahtarla · aud = bu doğrulayıcının client_id'si · nonce = isteğinki · iat penceresi · rp = beklenen
 * site · WIA güven listesindeki cüzdan sağlayıcısınca imzalı, süresi içinde, iptal edilmemiş (varsa durum denetimi) · PoP WIA
 * anahtarıyla, aud = client_id. Takma ad = başlıktaki açık anahtarın RFC 7638 parmak izi. Takma ad değeri denetim kaydına yazılmaz.
 * Sınır (ADR-0031 K4): türetmenin doğruluğu gerçek cüzdan varsayımına dayanır; kesin kanıt sıfır bilgi ispatıyla (Z5).
 */
import { calculateJwkThumbprint, decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import { verifyWalletAttestation, type StatusValueOf } from "@tamga-network/issuer";
import type { TrustSource } from "@tamga-network/trust";

export const PSEUDONYM_FORMAT = "tamga-pseudonym";
export const PSEUDONYM_TYP = "tamga-pseudonym+jwt";
/** iat penceresi (sn) */
export const PSEUDONYM_MAX_AGE_SEC = 300;

export type PseudonymResult =
  { ok: true; pseudonym: string; walletName?: string } | { ok: false; reason: string; indeterminate?: boolean };

export async function verifyPseudonym(p: {
  token: string;
  /** bu doğrulayıcının client_id'si (istek nesnesindeki tam dize) */
  aud: string;
  nonce: string;
  /** beklenen site: asıl RP'nin kayıtlı kimliği (aracıda `tamga_on_behalf_of`, yoksa client_id) */
  rpKey: string;
  trust: TrustSource;
  /** WIA iptal durumu (verilmezse denetlenmez) */
  walletStatusOf?: StatusValueOf;
  now?: number;
}): Promise<PseudonymResult> {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  try {
    const h = decodeProtectedHeader(p.token);
    const jwk = h.jwk as JWK | undefined;
    if (h.typ !== PSEUDONYM_TYP || h.alg !== "ES256") return { ok: false, reason: "pseudonym header (typ/alg)" };
    if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk)
      return { ok: false, reason: "pseudonym key is not a P-256 public key" };
    const { payload } = await jwtVerify(p.token, await importJWK(jwk, "ES256"), {
      audience: p.aud,
      currentDate: new Date(now * 1000),
    });
    if (payload.nonce !== p.nonce) return { ok: false, reason: "pseudonym nonce mismatch" };
    if (typeof payload.iat !== "number" || Math.abs(now - payload.iat) > PSEUDONYM_MAX_AGE_SEC)
      return { ok: false, reason: "pseudonym iat outside the allowed window" };
    if (payload.rp !== p.rpKey) return { ok: false, reason: "pseudonym was derived for another site" };
    if (typeof payload.wia !== "string" || typeof payload.wia_pop !== "string")
      return { ok: false, reason: "wallet instance attestation missing (PA_11)" };
    const w = await verifyWalletAttestation({
      wua: payload.wia,
      pop: payload.wia_pop,
      issuerUrl: p.aud,
      now,
      isProviderKey: (fp) => p.trust.isWalletProviderKey(fp),
      statusOf: p.walletStatusOf,
      minKeyStorage: "software", // takma ad belge değildir; anahtar deposu seviyesi belge ihracında (KA) denetlenir
    });
    if (!w.ok) return { ok: false, reason: `wallet: ${w.reason}`, indeterminate: w.indeterminate };
    return { ok: true, pseudonym: await calculateJwkThumbprint(jwk, "sha256"), walletName: w.claims.wallet_name };
  } catch (e) {
    return { ok: false, reason: `pseudonym: ${(e as Error).message}` };
  }
}
