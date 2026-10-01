/**
 * Kimlik türetimleri — zincirle aynı formüller (SPEC-ID-0002, SPEC-SCHEMA-0001 §5.1, ADR-0010).
 *
 *   issuer_id = keccak256( utf8(stateCode) || SHA-256(leafCertDER) )
 *   ca_id     = keccak256( utf8(stateCode) || SHA-256(rootCertDER) )
 *   schema_id = keccak256( utf8(vct) )
 *   rp_id     = keccak256( utf8(stateCode) || SHA-256(accessCertDER) )
 *
 * NOT (05-MIGRATION): Solidity tarafında `keccak256(abi.encodePacked(stateCode, certFingerprint))`
 * kullanılır; `stateCode`'un tipi (string vs bytes2) kontrat derlenince buradaki bayt dizilimiyle
 * eşitlenir. Beta boyunca bu dosya kanoniktir; değişirse eşdeğerlik testi bunu yakalar.
 */
import { concat, keccak256Hex, sha256, sha256Hex, utf8 } from "./hash.js";

export const certFingerprintSha256Hex = (certDer: Uint8Array) => sha256Hex(certDer);

export function computeIssuerId(stateCode: string, leafCertDer: Uint8Array): string {
  return keccak256Hex(concat(utf8(stateCode), sha256(leafCertDer)));
}
export const computeCaId = (stateCode: string, rootCertDer: Uint8Array) => computeIssuerId(stateCode, rootCertDer);
export const computeRpId = (stateCode: string, accessCertDer: Uint8Array) => computeIssuerId(stateCode, accessCertDer);
export function computeSchemaId(vct: string): string {
  return keccak256Hex(utf8(vct));
}
/** Parmak izinden (hex) id — sertifika elde yokken, listedeki fingerprint alanından */
export function computeIdFromFingerprintHex(stateCode: string, fingerprintHex: string): string {
  const fp = new Uint8Array(fingerprintHex.match(/.{2}/g)!.map((x) => parseInt(x, 16)));
  return keccak256Hex(concat(utf8(stateCode), fp));
}

/**
 * OpenID4VP 1.0 §5.9.3 `x509_hash` istemci kimliği (HAIP 1.0 §5: doğrulayıcı imzalı istekte bunu KULLANIR, cüzdan KABUL EDER):
 * `x509_hash:` + base64url(SHA-256(yaprak sertifika DER)). Sertifika yenilenince değişir; kalıcı kimlik RP kaydının `dns_name`'idir
 * (ADR-0034).
 */
export const X509_HASH_PREFIX = "x509_hash:";
export const x509HashClientId = (leafCertDer: Uint8Array): string =>
  X509_HASH_PREFIX + Buffer.from(sha256(leafCertDer)).toString("base64url");
/** Aynısı, listedeki SHA-256 parmak izinden (hex). */
export const x509HashClientIdFromFingerprintHex = (fingerprintHex: string): string =>
  X509_HASH_PREFIX + Buffer.from(fingerprintHex, "hex").toString("base64url");
