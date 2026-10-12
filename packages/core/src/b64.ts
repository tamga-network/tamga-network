/** base64url (padding'siz) — Node Buffer tabanlı; tarayıcı/RN limanı wallet-core'da ayrı sağlanır. */
export const b64u = (b: Uint8Array | string): string =>
  Buffer.from(typeof b === "string" ? new TextEncoder().encode(b) : b).toString("base64url");
/**
 * base64url → bayt, KATI: yalnız base64url alfabesi (`A–Z a–z 0–9 - _`), isteğe bağlı `=` dolgusu (en çok 2) ve geçerli uzunluk.
 * Buffer'ın sessizce atladığı geçersiz karakterler (boşluk, `+`, `/`, `.` …) hata verir — bozuk girdi sessizce başka bayta dönmez.
 */
export const b64uToBytes = (s: string): Uint8Array => {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]*={0,2}$/.test(s)) throw new Error("invalid base64url");
  const body = s.replace(/=+$/, "");
  if (body.length % 4 === 1 || (s.length !== body.length && s.length % 4 !== 0))
    throw new Error("invalid base64url length");
  return new Uint8Array(Buffer.from(body, "base64url"));
};
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
