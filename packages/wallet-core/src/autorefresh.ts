/**
 * ADR-0023 — sessiz kopya yenileme. Kurumun ilan ettiği eşik (kalan kopya / bitişe kalan süre) aşılınca rastgele bir gecikmeyle
 * (`dueAt`) yenileme belirteci kullanılır: DPoP (belgeye özel anahtar) + WUA ile token → yeni paket → eski belgenin yerine.
 * Geçiş kartları yeni belgeye taşınır (anahtarları silinmez). Kurum belirteci reddederse bağ kaldırılır; uyarı akışı bugünkü gibi.
 */
import { WalletError, readJson, type Http } from "./http.js";
import type { KeyProvider } from "./keys.js";
import type { WuaRecord } from "./wua.js";
import { wuaHeaders } from "./authcode.js";
import { dpopRequest, type DpopSigner } from "./dpop.js";
import { fetchIssuerMetadata, obtainCredential } from "./oid4vci.js";
import { receiveCredentials, type ReceiveOptions, type StoredCredential, type WalletState } from "./store.js";

/** Rastgele gecikme üst sınırı (sn): yenileme anı bir sunumun anına bağlanmasın (ADR-0023 K1). */
export const REFRESH_JITTER_MAX_SEC = 6 * 3600;

/** Kopya başına ya da her ihraçta değişen teknik alanlar — "değişen bilgi" sayılmaz (ISSU_59) */
export const TECHNICAL_CLAIMS = new Set([
  "iss",
  "vct",
  "vct#integrity",
  "iat",
  "exp",
  "nbf",
  "cnf",
  "status",
  "category",
]);
/** Yenilenen belgede değeri değişen, eklenen ya da kalkan kullanıcı alanları */
export function changedClaimNames(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (n) => !TECHNICAL_CLAIMS.has(n) && JSON.stringify(a[n]) !== JSON.stringify(b[n]),
  );
}

const unused = (c: StoredCredential) => c.copies.filter((k) => !k.usedBy.length).length;

/** Eşik aşıldı mı (kurumun ilan ettiği değerlerle)? */
export function refreshThresholdReached(c: StoredCredential, now: number): boolean {
  const r = c.refresh;
  if (!r || c.revokedLocally || c.status?.value === "revoked") return false;
  if (r.unusedTrigger !== undefined && unused(c) <= r.unusedTrigger) return true;
  if (r.lifetimeTrigger !== undefined && c.exp !== undefined && c.exp - now <= r.lifetimeTrigger) return true;
  return false;
}

/** Eşiği aşan ve henüz zamanlanmamış belgelere rastgele `dueAt` atar; zamanı gelmiş belgelerin kimliklerini döndürür. */
export function scheduleRefreshes(
  state: WalletState,
  now: number,
  random: () => number = Math.random,
): { state: WalletState; due: string[] } {
  let changed = false;
  const credentials = state.credentials.map((c) => {
    if (!c.refresh || c.refresh.dueAt !== undefined || !refreshThresholdReached(c, now)) return c;
    changed = true;
    return { ...c, refresh: { ...c.refresh, dueAt: now + Math.floor(random() * REFRESH_JITTER_MAX_SEC) } };
  });
  const next = changed ? { ...state, credentials } : state;
  const due = next.credentials
    .filter((c) => c.refresh?.dueAt !== undefined && c.refresh.dueAt <= now && refreshThresholdReached(c, now))
    .map((c) => c.id);
  return { state: next, due };
}

export interface AutoRefreshInput {
  state: WalletState;
  credentialId: string;
  keys: KeyProvider;
  http: Http;
  wua: WuaRecord;
  randomBytes: (n: number) => Uint8Array;
  now?: number;
  receive?: ReceiveOptions;
  /** ADR-0025: yenilenen paket için de yeni anahtar kanıtı */
  keyAttestor?: (jwks: import("./keys.js").PublicJwk[]) => Promise<string>;
}
export type AutoRefreshResult =
  | { ok: true; state: WalletState; newId: string; changed: string[]; removedKeyRefs: string[] }
  | { ok: false; state: WalletState; revoked: boolean; reason: string; removedKeyRefs: string[] };

/** Tek belgeyi sessizce yeniler. Ağ hatasında `revoked: false` (sonra yeniden denenir); kurum reddederse bağ kaldırılır. */
export async function autoRefreshCredential(p: AutoRefreshInput): Promise<AutoRefreshResult> {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  const old = p.state.credentials.find((c) => c.id === p.credentialId);
  if (!old?.refresh)
    return { ok: false, state: p.state, revoked: false, reason: "no refresh binding", removedKeyRefs: [] };
  const r = old.refresh;
  const dpop: DpopSigner = { keys: p.keys, ref: r.dpopRef, jwk: r.dpopJwk };
  let tr;
  try {
    tr = await dpopRequest(
      p.http,
      dpop,
      r.tokenEndpoint,
      {
        method: "POST",
        headers: async () => ({
          "content-type": "application/x-www-form-urlencoded",
          ...(await wuaHeaders({ keys: p.keys, wua: p.wua, aud: old.issuer, now, randomBytes: p.randomBytes })),
        }),
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(r.token)}`,
      },
      { now, randomBytes: p.randomBytes },
    );
  } catch (e) {
    return { ok: false, state: p.state, revoked: false, reason: (e as Error).message, removedKeyRefs: [] };
  }
  const tok = (await readJson(tr, "issuer").catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    c_nonce?: string;
    error?: string;
    error_description?: string;
  };
  if (tr.status !== 200 || !tok.access_token) {
    // invalid_grant: belirteç geçersiz ya da kurum kaynağında kayıt yok → sessiz yenileme durur (AR3); kullanıcı uyarı akışını görür
    if (tok.error === "invalid_grant") {
      const { refresh: _r, ...rest } = old;
      return {
        ok: false,
        state: { ...p.state, credentials: p.state.credentials.map((c) => (c.id === old.id ? rest : c)) },
        revoked: true,
        reason: tok.error_description ?? "invalid_grant",
        removedKeyRefs: [r.dpopRef],
      };
    }
    return {
      ok: false,
      state: p.state,
      revoked: false,
      reason: tok.error_description ?? `HTTP ${tr.status}`,
      removedKeyRefs: [],
    };
  }
  const metadata = await fetchIssuerMetadata(old.issuer, p.http);
  let out;
  try {
    out = await obtainCredential({
      issuer: old.issuer,
      vct: old.vct,
      metadata,
      accessToken: tok.access_token,
      cNonce: tok.c_nonce,
      keys: p.keys,
      http: p.http,
      now,
      dpop,
      randomBytes: p.randomBytes,
      refreshToken: tok.refresh_token,
      tokenEndpoint: r.tokenEndpoint,
      keyAttestor: p.keyAttestor,
    });
  } catch (e) {
    if (e instanceof WalletError)
      return { ok: false, state: p.state, revoked: false, reason: e.message, removedKeyRefs: [] };
    throw e;
  }
  const rec = receiveCredentials(p.state, out, { ...p.receive, typeName: old.typeName, now });
  const neu = rec.credential;
  const changed = changedClaimNames(old.claims, neu.claims);
  // Eskinin yerini al: kopya anahtarları silinir; geçiş kartları yeni belgeye taşınır ve anahtarları korunur;
  // DPoP anahtarı yeni belgeye geçer (belirteç döndürüldü, anahtar aynı)
  const passKeys = new Set((rec.state.passes ?? []).filter((x) => x.credentialId === old.id).map((x) => x.keyRef));
  const pinned = rec.state.settings.pinned;
  const state: WalletState = {
    ...rec.state,
    credentials: rec.state.credentials.filter((c) => c.id !== old.id),
    ...(rec.state.passes
      ? { passes: rec.state.passes.map((x) => (x.credentialId === old.id ? { ...x, credentialId: neu.id } : x)) }
      : {}),
    settings: {
      ...rec.state.settings,
      ...(pinned ? { pinned: pinned.map((id) => (id === old.id ? neu.id : id)) } : {}),
    },
  };
  return {
    ok: true,
    state,
    newId: neu.id,
    changed,
    removedKeyRefs: old.copies.map((k) => k.keyRef).filter((k) => !passKeys.has(k)),
  };
}
