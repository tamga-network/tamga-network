/**
 * Sunum — cüzdan tarafı (SPEC-CRED-0002 §6, §7.2).
 *  Gizlemek = disclosure'ı dizeden çıkarmak; JWT yeniden imzalanmaz (C12).
 *  KB-JWT: typ kb+jwt, alg ES256, {nonce, aud, iat, sd_hash}; cnf'deki anahtarın ÖZEL yarısıyla imzalanır (C8).
 *  sd_hash = base64url(SHA-256("<jwt>~<seçilen d…>~")) — sondaki ~ dahil (C9).
 *  ADR-0036: istenen ad bir yol olabilir (`address.locality`, `nationalities`); iç içe disclosure'lar ata ve alt alanlarıyla
 *  birlikte seçilir (RFC 9901 §7.1; ortak kural @tamga-network/core/sd-structure).
 */
import { SignJWT } from "jose";
import { b64uToUtf8 } from "@tamga-network/core";
import {
  decodeDisclosures,
  resolveSdPayload,
  SdStructureError,
  selectDisclosuresForPaths,
} from "@tamga-network/core/sd-structure";
import type { SigningKey } from "./issue.js";
import { digestOf, KB_JWT_TYP, sdHashOf, splitCombined } from "./disclosure.js";

export interface PresentInput {
  combined: string; // ihraç biçimi "<jwt>~d1~…~"
  discloseClaims: string[]; // açılacak claim adları ya da yolları
  holderKey: SigningKey; // cnf'ye karşılık gelen özel anahtar (demo: yazılım; pilot: Secure Enclave — KeyProvider)
  aud: string; // verifier client_id
  nonce: string;
  iat?: number;
}

export async function presentSdJwtVc(input: PresentInput): Promise<string> {
  const { jwt, disclosures } = splitCombined(input.combined);
  const payload = JSON.parse(b64uToUtf8(jwt.split(".")[1])) as Record<string, unknown>;
  const decoded = decodeDisclosures(disclosures, digestOf, (d) => JSON.parse(b64uToUtf8(d)));
  let chosen: string[];
  try {
    const { resolved } = resolveSdPayload(payload, decoded);
    chosen = selectDisclosuresForPaths(resolved, input.discloseClaims).map((d) => d.disclosure);
  } catch (e) {
    if (!(e instanceof SdStructureError) || /requested claim/.test(e.message)) throw e;
    // Yapısı kurala uymayan belge: cüzdan denetlemez (karar doğrulayıcının, A5) — kök düzey ad eşleşmesiyle seçer
    const want = new Set(input.discloseClaims);
    const missing = [...want].filter((n) => !decoded.some((d) => d.name === n));
    if (missing.length) throw new Error(`requested claim is not a disclosure in the credential: ${missing.join(",")}`);
    chosen = decoded.filter((d) => d.name !== undefined && want.has(d.name)).map((d) => d.disclosure);
  }
  const withoutKb = [jwt, ...chosen, ""].join("~");
  const sd_hash = sdHashOf(withoutKb);
  const kb = await new SignJWT({
    nonce: input.nonce,
    aud: input.aud,
    iat: input.iat ?? Math.floor(Date.now() / 1000),
    sd_hash,
  })
    .setProtectedHeader({ alg: "ES256", typ: KB_JWT_TYP })
    .sign(input.holderKey);
  return withoutKb + kb;
}
