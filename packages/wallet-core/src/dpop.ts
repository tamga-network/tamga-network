/**
 * DPoP (RFC 9449) — erişim belirtecini cüzdanın o işlem için ürettiği anahtara bağlar (HAIP; ARF ISSU_01). Belirteç çalınsa
 * başka bir cihazda kullanılamaz. Anahtar ihraç akışı süresince tutulur, sonra silinir.
 * Sunucu nonce'u (RFC 9449 §8–9, HAIP §4): sunucu `use_dpop_nonce` + `DPoP-Nonce` başlığıyla nonce isterse kanıt o nonce ile bir
 * kez yeniden gönderilir; yanıtlardaki `DPoP-Nonce` sunucu (origin) başına saklanıp sonraki kanıtlara eklenir.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { b64u, utf8 } from "./b64.js";
import { signJwt } from "./jws.js";
import type { KeyProvider, PublicJwk } from "./keys.js";
import type { Http, HttpResponse } from "./http.js";

export const DPOP_TYP = "dpop+jwt";

export interface DpopSigner {
  keys: KeyProvider;
  ref: string;
  jwk: PublicJwk;
  /** sunucunun son verdiği DPoP-Nonce, origin başına (bellekte; saklanmaz) */
  nonces?: Record<string, string>;
}

export async function newDpopSigner(keys: KeyProvider, ref: string): Promise<DpopSigner> {
  return { keys, ref, jwk: await keys.generate(ref) };
}

/** Tek kullanımlık DPoP kanıtı. `accessToken` verilirse `ath` (belirtecin SHA-256'sı) eklenir. */
export async function dpopProof(
  s: DpopSigner,
  htm: "GET" | "POST",
  htu: string,
  opts: { now?: number; accessToken?: string; randomBytes?: (n: number) => Uint8Array; nonce?: string } = {},
): Promise<string> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const jti = b64u(opts.randomBytes ? opts.randomBytes(16) : utf8(`${now}.${Math.random()}.${Math.random()}`));
  return signJwt(
    { typ: DPOP_TYP, jwk: s.jwk },
    {
      jti,
      htm,
      htu: htu.split(/[?#]/)[0],
      iat: now,
      ...(opts.accessToken ? { ath: b64u(sha256(utf8(opts.accessToken))) } : {}),
      ...(opts.nonce ? { nonce: opts.nonce } : {}),
    },
    s.keys,
    s.ref,
  );
}

const originOf = (u: string) => /^(https?:\/\/[^/?#]+)/i.exec(u)?.[1].toLowerCase() ?? u;

/** Yanıt sunucunun nonce istediğini mi söylüyor? AS: 400 + `error: use_dpop_nonce`; RS: 401 + `WWW-Authenticate: DPoP error="use_dpop_nonce"`. */
function wantsNonce(status: number, body: string, headers: Record<string, string> | undefined): boolean {
  if (!headers?.["dpop-nonce"]) return false;
  if (status === 401 && /error="use_dpop_nonce"/.test(headers["www-authenticate"] ?? "")) return true;
  if (status !== 400 && status !== 401) return false;
  try {
    return (JSON.parse(body) as { error?: string }).error === "use_dpop_nonce";
  } catch {
    return false;
  }
}

/**
 * DPoP kanıtlı istek: kanıtı `dpop` başlığına koyar, sunucu nonce isterse bir kez yeniden dener, yanıttaki nonce'u saklar.
 * Dönen yanıtın gövdesi önceden okunmuştur (text() tekrar çağrılabilir).
 */
export async function dpopRequest(
  http: Http,
  s: DpopSigner,
  url: string,
  init: {
    method: "GET" | "POST";
    /** işlev verilirse her denemede yeniden üretilir (tek kullanımlık cüzdan kanıtı PoP'u gibi) */
    headers?: Record<string, string> | (() => Promise<Record<string, string>>);
    body?: string;
  },
  opts: { now?: number; accessToken?: string; randomBytes?: (n: number) => Uint8Array } = {},
): Promise<HttpResponse> {
  const origin = originOf(url);
  const send = async (): Promise<HttpResponse & { body: string }> => {
    const proof = await dpopProof(s, init.method, url, { ...opts, nonce: s.nonces?.[origin] });
    const base = typeof init.headers === "function" ? await init.headers() : init.headers;
    const r = await http(url, { method: init.method, body: init.body, headers: { ...base, dpop: proof } });
    const body = await r.text();
    const n = r.headers?.["dpop-nonce"];
    if (n) s.nonces = { ...s.nonces, [origin]: n };
    return { status: r.status, headers: r.headers, body, text: async () => body };
  };
  const first = await send();
  if (!wantsNonce(first.status, first.body, first.headers)) return first;
  return send();
}
