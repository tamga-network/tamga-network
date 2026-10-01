/** base64url (padding'siz) — Node Buffer tabanlı; tarayıcı/RN limanı wallet-core'da ayrı sağlanır. */
export const b64u = (b: Uint8Array | string): string =>
  Buffer.from(typeof b === "string" ? new TextEncoder().encode(b) : b).toString("base64url");
export const b64uToBytes = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64url"));
export const b64uToUtf8 = (s: string): string => new TextDecoder().decode(b64uToBytes(s));
/** PEM ↔ DER */
export function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(b64, "base64"));
}
export const derToB64 = (der: Uint8Array): string => Buffer.from(der).toString("base64");
export const b64ToDer = (b64: string): Uint8Array => new Uint8Array(Buffer.from(b64, "base64"));
export function derToPem(der: Uint8Array): string {
  return `-----BEGIN CERTIFICATE-----\n${derToB64(der)
    .match(/.{1,64}/g)!
    .join("\n")}\n-----END CERTIFICATE-----`;
}
