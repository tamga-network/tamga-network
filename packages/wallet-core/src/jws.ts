/** Compact JWS/JWT yardımcıları — yalnızca ES256; jose yok (RN). */
import { b64u, b64uDecode, b64uToUtf8, b64uUtf8, utf8 } from "./b64.js";
import { verifyEs256, type KeyProvider, type PublicJwk } from "./keys.js";

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Uint8Array;
  raw: string;
}

export function decodeJwt(jwt: string): DecodedJwt {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("JWT does not have three parts");
  return {
    header: JSON.parse(b64uToUtf8(parts[0])),
    payload: JSON.parse(b64uToUtf8(parts[1])),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: b64uDecode(parts[2]),
    raw: jwt,
  };
}
export async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  keys: KeyProvider,
  ref: string,
): Promise<string> {
  const input = `${b64uUtf8(JSON.stringify({ ...header, alg: "ES256" }))}.${b64uUtf8(JSON.stringify(payload))}`;
  const sig = await keys.sign(ref, utf8(input));
  if (sig.length !== 64) throw new Error("ES256 signature must be 64 bytes (raw r||s)");
  return `${input}.${b64u(sig)}`;
}
export function verifyJwt(jwt: string, pub: PublicJwk | Uint8Array): DecodedJwt {
  const d = decodeJwt(jwt);
  if (d.header.alg !== "ES256") throw new Error(`alg=${String(d.header.alg)} (C1)`);
  if (!verifyEs256(d.signature, utf8(d.signingInput), pub)) throw new Error("invalid signature");
  return d;
}
