/**
 * İmzalı güven listesi okuma — cüzdan tarafı (S-13; ADR-0015 / D-TRUST-1).
 * Liste KURALLARI tek yerde: `@tamga-network/trust/core` (biçim sürümü, tazelik, ulusal liste anahtarları, geri sarma, sorgular).
 * Bu dosya yalnızca cüzdanın imza doğrulayıcısını (saf TS, @noble — React Native/Hermes uyumlu) o çekirdeğe verir:
 *  1. `lotl.jws` imzası, uygulamaya GÖMÜLÜ LOTL imzacı parmak izleriyle (pin) doğrulanır — liste sunucusuna güvenilmez.
 *  2. `tl-<cc>.jws` imzası, LOTL'daki o ülkenin `signing_keys` parmak izleriyle doğrulanır.
 *  3. Bayat liste ve oturum içinde görülenden eski sürüm reddedilir.
 * Yalnızca imza doğrulanmış yük kullanılır; çağıran asla imzasız JSON görmez.
 */
import {
  fetchListTrustSource,
  resetListMonotonicity,
  TrustListError,
  type JwsVerifier,
  type ListTrustSource,
} from "@tamga-network/trust/core";
import { b64Decode } from "./b64.js";
import { decodeJwt, verifyJwt } from "./jws.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import { WalletError, type Http } from "./http.js";

/** Uygulamaya derleme zamanında gömülen güven çapası: LOTL imzacı sertifikalarının SHA-256 parmak izleri (hex). */
export interface TrustPins {
  lotlSigners: string[];
}

export interface VerifiedTrust {
  lotl: Record<string, unknown> & { version: number; national_lists?: Array<Record<string, unknown>> };
  tl: Record<string, unknown> & { version: number; state_code: string };
}

const TL_TYP = "tamga-tl+jwt";

/** Cüzdanın JWS doğrulayıcısı (saf TS): typ/alg, x5c yaprak parmak izi izinli kümede, ES256 imza. */
export const walletJwsVerifier: JwsVerifier = async <T = unknown>(
  jws: string,
  allowed: Set<string> | null,
  opts: { typ?: string | null } = {},
) => {
  const d = decodeJwt(jws);
  // ADR-0036: dış (JAdES) listelerde typ denetlenmez (opts.typ === null) ama imzacı yine sabitlenmiş parmak izi olmalı
  const typ = opts.typ === undefined ? TL_TYP : opts.typ;
  if (d.header.alg !== "ES256" || (typ !== null && d.header.typ !== typ))
    throw new WalletError("trust_error", `list JWS header rejected (${String(d.header.alg)}/${String(d.header.typ)})`);
  if (typ === null && !allowed)
    throw new WalletError("trust_error", "external list requires pinned signer fingerprints");
  const x5c = d.header.x5c as string[] | undefined;
  if (!Array.isArray(x5c) || !x5c.length) throw new WalletError("trust_error", "list: x5c missing");
  const leaf = b64Decode(x5c[0]);
  const fp = certFingerprintHex(leaf);
  if (allowed && !allowed.has(fp))
    throw new WalletError("trust_error", "list: signer certificate is not one of the pinned/declared keys");
  try {
    verifyJwt(jws, p256PointFromCertDer(leaf));
  } catch (e) {
    throw new WalletError("trust_error", `list: invalid signature (${(e as Error).message})`);
  }
  return { payload: d.payload as T, signerFingerprint: fp, raw: jws };
};

/** İmzası doğrulanmış güven kaynağı (TS1: RP kaydı, kurum dizini ve diğer sorgular yalnızca buradan). */
export async function fetchTrustSource(
  trustBase: string,
  http: Http,
  opts: { pins: TrustPins; stateCode?: string; now?: number },
): Promise<{ source: ListTrustSource; lists: VerifiedTrust }> {
  if (!opts.pins?.lotlSigners?.length) throw new WalletError("trust_error", "no trust anchor (pin) configured");
  const cc = (opts.stateCode ?? "tr").toUpperCase();
  try {
    const { source, store } = await fetchListTrustSource(trustBase, http, {
      rootFingerprints: opts.pins.lotlSigners,
      verifyJws: walletJwsVerifier,
      stateCode: cc,
      now: new Date(opts.now ?? Date.now()),
    });
    const tl = store.national.get(cc)!.list;
    return {
      source,
      lists: { lotl: store.lotl as unknown as VerifiedTrust["lotl"], tl: tl as unknown as VerifiedTrust["tl"] },
    };
  } catch (e) {
    if (e instanceof WalletError) throw e;
    if (e instanceof TrustListError) throw new WalletError("trust_error", e.message);
    throw new WalletError("trust_error", `trusted list could not be verified: ${(e as Error).message}`);
  }
}

/** Geriye uyum: doğrulanmış ham listeler. Yeni kod `fetchTrustSource(...).source` sorgularını kullanır. */
export async function fetchVerifiedTrust(
  trustBase: string,
  http: Http,
  opts: { pins: TrustPins; stateCode?: string; now?: number },
): Promise<VerifiedTrust> {
  return (await fetchTrustSource(trustBase, http, opts)).lists;
}

/** Test/yeniden kurulum için oturum içi sürüm belleğini sıfırlar. */
export function resetTrustSeen() {
  resetListMonotonicity();
}
