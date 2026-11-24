/**
 * ADR-0089 K3/K4 — kimlik belgesinin kopyalarının düzenli yenilenmesi (cüzdan tarafı). Kimlik servisi kişi alanlarını saklamaz;
 * yenileme, kimlik belgesiyle gelen yenileme belirteci (ZK kopyası belirteciyle aynı belirteç — tek yerde saklanır: ZK bağı varsa
 * `zk.token`, yoksa `refresh.token`) + DPoP + aynı istemci örneği anahtarına verilmiş WIA + cüzdandaki bir kopyanın BÜTÜN alanları
 * açık sunumuyla (`identity_presentation`: SD-JWT VC + KB-JWT, `aud` = kimlik servisi, `nonce` = `/nonce`) yapılır. Servis yeni
 * erişim belirteci verir; yeni paket (SD-JWT + mdoc, standart istekler) `obtainCredential` ile alınır ve eski kaydın yerini alır.
 *
 *  - Ne zaman (`identityRenewalDue`): kullanılmamış kopya ≤ eşik ya da teknik bitişe ≤ eşik (servisin `credential_reuse_policy`'si;
 *    yoksa 2 kopya / 7 gün) — ya da kopyaların hepsinin süresi dolmuş. `scheduleIdentityRenewals` rastgele gecikme atar (ADR-0023 K1).
 *  - Hata: `invalid_grant` → kayıt iptal / süresi dolmuş / belirteç geçersiz: bağ kalkar (`revoked: true`); `temporarily_unavailable`
 *    (cüzdan sağlayıcısı askıda) ve `invalid_request` (sunum kusurlu) → bağ kalır, sonra yeniden denenir.
 *  - Teknik süresi dolmuş kopya da sunulabilir (çevrim dışı kalan kişi; kayıt idari olarak geçerliyse servis kabul eder).
 * Kişisel veri döndürmez, loglamaz. SIRA (0.8.3 sözleşmesi): çağıran önce dönen `state`'i yazar, sonra `removedKeyRefs`'i siler.
 */
import { b64u } from "./b64.js";
import { assertReceiveTrust } from "./receive-trust.js";
import { readJson, type Http } from "./http.js";
import { isAuthRequired, type KeyProvider, type PublicJwk } from "./keys.js";
import { wuaForBinding, type WuaRecord } from "./wua.js";
import { wuaHeaders } from "./authcode.js";
import { dpopRequest, type DpopSigner } from "./dpop.js";
import { fetchIssuerMetadata, obtainCredential, type IssuerMetadata } from "./oid4vci.js";
import { IDENTITY_VCT } from "./directory.js";
import { IDENTITY_PRESENTATION_PARAM } from "./driving.js";
import { signJwt } from "./jws.js";
import { KB_JWT_TYP, sdHashOf, splitCombined } from "./sdjwt.js";
import {
  instanceKeysInUse,
  receiveCredentials,
  type ReceiveOptions,
  type StoredCredential,
  type WalletState,
} from "./store.js";

/** Servis eşik ilan etmediyse: kullanılmamış kopya bu sayıya inince (ETSI TS 119 472-3 `reissue_trigger_unused`). */
export const IDENTITY_RENEW_UNUSED_DEFAULT = 2;
/** Servis eşik ilan etmediyse: teknik bitişe bu kadar saniye kala (`reissue_trigger_lifetime_left`). */
export const IDENTITY_RENEW_LIFETIME_DEFAULT = 7 * 86400;
/** Rastgele gecikme üst sınırı (ADR-0023 K1): yenileme anı bir sunumun anına bağlanmasın. */
export const IDENTITY_RENEW_JITTER_MAX_SEC = 6 * 3600;

const isIdentity = (c: StoredCredential) => c.vct === IDENTITY_VCT;
/** Yenileme belirteci nerede: ZK bağı varsa orada (tek belirteç), yoksa `refresh` bağında. */
function tokenOf(
  c: StoredCredential,
): { token: string; tokenEndpoint: string; dpopRef: string; dpopJwk: PublicJwk; instanceKeyRef?: string } | null {
  return c.zk ?? c.refresh ?? null;
}
/** Bağın belirtecini değiştirir (döndürülen belirteç bundan sonra her hatada saklanır). */
function withToken(c: StoredCredential, token: string): StoredCredential {
  if (c.zk) return { ...c, zk: { ...c.zk, token } };
  if (c.refresh) return { ...c, refresh: { ...c.refresh, token } };
  return c;
}

/** Kimlik belgesi yenilenebilir durumda mı (belirteç var, iptal edilmemiş, idari bitişi geçmemiş). */
export function identityRenewable(c: StoredCredential, now: number): boolean {
  if (!isIdentity(c) || !tokenOf(c) || c.revokedLocally || c.status?.value === "revoked") return false;
  const admin =
    typeof c.claims.date_of_expiry === "string" ? Date.parse(`${c.claims.date_of_expiry}T23:59:59Z`) / 1000 : undefined;
  return admin === undefined || admin > now;
}

/** ADR-0089 K4: yenileme zamanı geldi mi (servisin eşikleri; bütün kopyaların süresi dolduysa her zaman). */
export function identityRenewalDue(c: StoredCredential, now: number): boolean {
  if (!identityRenewable(c, now)) return false;
  const unusedTrigger = c.refresh?.unusedTrigger ?? IDENTITY_RENEW_UNUSED_DEFAULT;
  const lifetimeTrigger = c.refresh?.lifetimeTrigger ?? IDENTITY_RENEW_LIFETIME_DEFAULT;
  if (c.exp !== undefined && c.exp - now <= lifetimeTrigger) return true;
  // ADR-0089 eki: yöntem B'de (tek kopya) yenileme yalnız süreye bağlı (ARF ISSU_50)
  return c.reuse !== "limited_time" && c.copies.filter((k) => !k.usedBy.length).length <= unusedTrigger;
}

/** Eşiği aşan, zamanlanmamış kimlik belgelerine rastgele `renewDueAt` atar; zamanı gelenleri döndürür. */
export function scheduleIdentityRenewals(
  state: WalletState,
  now: number,
  random: () => number = Math.random,
): { state: WalletState; due: string[] } {
  let changed = false;
  const credentials = state.credentials.map((c) => {
    if (c.renewDueAt !== undefined || !identityRenewalDue(c, now)) return c;
    changed = true;
    // gecikme teknik bitişten en az 30 dk önce bitecek biçimde (süresi dolmuşsa hemen)
    const room = c.exp !== undefined ? c.exp - now - 30 * 60 : IDENTITY_RENEW_JITTER_MAX_SEC;
    const delay = room > 0 ? Math.floor(random() * Math.min(IDENTITY_RENEW_JITTER_MAX_SEC, room)) : 0;
    return { ...c, renewDueAt: now + delay };
  });
  const next = changed ? { ...state, credentials } : state;
  const due = next.credentials
    .filter((c) => c.renewDueAt !== undefined && c.renewDueAt <= now && identityRenewalDue(c, now))
    .map((c) => c.id);
  return { state: next, due };
}

/**
 * Kimlik belgesinin bütün alanları açık sunumu (yenileme için — belgeyi VEREN servise; servis kopyanın bütün alanlarını zaten
 * imzalamıştır, yeni bir açıklama doğmaz). KB-JWT kopyanın anahtarıyla.
 */
export async function fullIdentityPresentation(p: {
  combined: string;
  keys: KeyProvider;
  keyRef: string;
  aud: string;
  nonce: string;
  iat: number;
}): Promise<string> {
  const { jwt, disclosures } = splitCombined(p.combined);
  const withoutKb = [jwt, ...disclosures, ""].join("~");
  const kb = await signJwt(
    { typ: KB_JWT_TYP },
    { nonce: p.nonce, aud: p.aud, iat: p.iat, sd_hash: sdHashOf(withoutKb) },
    p.keys,
    p.keyRef,
  );
  return withoutKb + kb;
}

export interface IdentityRenewalInput {
  state: WalletState;
  credentialId: string;
  keys: KeyProvider;
  http: Http;
  wua: WuaRecord;
  /** ADR-0060: bağın istemci örneği anahtarına sağlayıcıdan taze WIA (elindeki WIA başka anahtarlıysa) */
  wuaForInstance?: (keyRef: string) => Promise<WuaRecord>;
  randomBytes: (n: number) => Uint8Array;
  now?: number;
  /** ZORUNLU (güvenlik incelemesi 2026-11-18): yeni paket `receiveCredentials` ile alınır — `trust` zorunlu (ya da açık `"none"`); ağa çıkmadan denetlenir */
  receive: ReceiveOptions;
  /** ADR-0025: yeni paketin anahtarları için anahtar kanıtı */
  keyAttestor?: (jwks: PublicJwk[]) => Promise<string>;
  /** Önceden alınmış metadata (yoksa çekilir) */
  metadata?: IssuerMetadata;
}
export type IdentityRenewalResult =
  | { ok: true; state: WalletState; newId: string; removedKeyRefs: string[] }
  | {
      ok: false;
      state: WalletState;
      /** true: kayıt iptal / süresi dolmuş ya da belirteç geçersiz — bağ kaldırıldı, kişi yeniden kimlik doğrulaması yapar */
      revoked: boolean;
      /** true: cüzdan sağlayıcısı askıda (ADR-0089 K5) — bağ kalır, askı kalkınca yeniden denenir */
      suspended?: boolean;
      reason: string;
      removedKeyRefs: string[];
    };

/**
 * ADR-0089 K3: kimlik belgesini yeniler — belirteç değişimi (refresh_token + `identity_presentation`) → yeni paket (SD-JWT ve
 * varsa mdoc; her kopya yeni anahtar) → eski kaydın yerini alır (ZK kopyaları ve geçiş kartları korunur).
 */
export async function renewIdentityCredential(p: IdentityRenewalInput): Promise<IdentityRenewalResult> {
  assertReceiveTrust(p.receive); // belirteç harcanmadan önce
  const now = p.now ?? Math.floor(Date.now() / 1000);
  const old = p.state.credentials.find((c) => c.id === p.credentialId);
  const skip = (reason: string, state = p.state, extra: { suspended?: boolean } = {}): IdentityRenewalResult => ({
    ok: false,
    state,
    revoked: false,
    reason,
    removedKeyRefs: [],
    ...extra,
  });
  if (!old || !isIdentity(old)) return skip("not an identity credential");
  const b = tokenOf(old);
  if (!b) return skip("no renewal binding");
  if (!identityRenewable(old, now)) return skip("credential revoked or past its administrative validity");
  const copy = old.copies[0];
  if (!copy) return skip("no copy to present");
  // a3 ön deneme (ağa çıkmadan): anahtar imzası doğrulama bekliyorsa belirteç boşa harcanmasın (autorefresh ile aynı)
  const probeRef = `probe.${b64u(p.randomBytes(9))}`;
  try {
    await p.keys.generate(probeRef);
    await p.keys.sign(probeRef, p.randomBytes(32));
  } catch (e) {
    return skip(isAuthRequired(e) ? "auth_required" : (e as Error).message);
  } finally {
    await p.keys.delete(probeRef).catch(() => {});
  }
  const wua = await wuaForBinding({ wua: p.wua, instanceKeyRef: b.instanceKeyRef, wuaForInstance: p.wuaForInstance });
  if (!wua) return skip("wallet attestation for the credential's instance key is unavailable");
  const dpop: DpopSigner = { keys: p.keys, ref: b.dpopRef, jwk: b.dpopJwk };
  let metadata: IssuerMetadata;
  let presentation: string;
  try {
    metadata = p.metadata ?? (await fetchIssuerMetadata(old.issuer, p.http));
    if (!metadata.nonce_endpoint) return skip("issuer metadata has no nonce_endpoint");
    const nr = await p.http(metadata.nonce_endpoint, { method: "POST" });
    const nonce = nr.status === 200 ? ((await readJson(nr, "issuer")) as { c_nonce?: unknown }).c_nonce : undefined;
    if (typeof nonce !== "string" || !nonce) return skip("c_nonce missing");
    presentation = await fullIdentityPresentation({
      combined: copy.combined,
      keys: p.keys,
      keyRef: copy.keyRef,
      aud: old.issuer.replace(/\/$/, ""),
      nonce,
      iat: now,
    });
  } catch (e) {
    return skip(isAuthRequired(e) ? "auth_required" : (e as Error).message);
  }
  let tr;
  try {
    tr = await dpopRequest(
      p.http,
      dpop,
      b.tokenEndpoint,
      {
        method: "POST",
        headers: async () => ({
          "content-type": "application/x-www-form-urlencoded",
          ...(await wuaHeaders({ keys: p.keys, wua, aud: old.issuer, now, randomBytes: p.randomBytes })),
        }),
        body:
          `grant_type=refresh_token&refresh_token=${encodeURIComponent(b.token)}` +
          `&scope=${encodeURIComponent(IDENTITY_VCT)}` +
          `&${IDENTITY_PRESENTATION_PARAM}=${encodeURIComponent(presentation)}`,
      },
      { now, randomBytes: p.randomBytes },
    );
  } catch (e) {
    return skip((e as Error).message);
  }
  const tok = (await readJson(tr, "issuer").catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (tr.status !== 200 || !tok.access_token) {
    if (tok.error === "invalid_grant") {
      // kayıt iptal / süresi dolmuş ya da belirteç geçersiz: yenileme bağı kalkar (ZK bağı da — aynı belirteç)
      const { zk: _z, refresh: _r, renewDueAt: _d, ...rest } = old;
      const state = { ...p.state, credentials: p.state.credentials.map((c) => (c.id === old.id ? rest : c)) };
      const inUse = instanceKeysInUse(state);
      return {
        ok: false,
        state,
        revoked: true,
        reason: tok.error_description ?? "invalid_grant",
        removedKeyRefs: [
          b.dpopRef,
          ...(old.zk?.copies.map((k) => k.keyRef) ?? []),
          ...(b.instanceKeyRef && !inUse.has(b.instanceKeyRef) ? [b.instanceKeyRef] : []),
        ],
      };
    }
    return skip(tok.error_description ?? tok.error ?? `HTTP ${tr.status}`, p.state, {
      ...(tok.error === "temporarily_unavailable" ? { suspended: true } : {}),
    });
  }
  // değişim yapıldı: eski belirteç artık geçersiz — yeni belirteç bundan sonraki her hatada saklanır
  const rotated = tok.refresh_token && tok.refresh_token !== b.token ? tok.refresh_token : b.token;
  const kept: WalletState = {
    ...p.state,
    credentials: p.state.credentials.map((c) => (c.id === old.id ? withToken(c, rotated) : c)),
  };
  let out;
  try {
    out = await obtainCredential({
      issuer: old.issuer,
      vct: IDENTITY_VCT,
      metadata,
      accessToken: tok.access_token,
      keys: p.keys,
      http: p.http,
      now,
      dpop,
      randomBytes: p.randomBytes,
      refreshToken: rotated,
      tokenEndpoint: b.tokenEndpoint,
      keyAttestor: p.keyAttestor,
      retainDpop: true, // belgeye bağlı kalıcı DPoP anahtarı
      wua,
    });
  } catch (e) {
    return skip(isAuthRequired(e) ? "auth_required" : (e as Error).message, kept);
  }
  let rec;
  try {
    rec = receiveCredentials(p.state, out, { ...p.receive, typeName: old.typeName, now });
  } catch (e) {
    for (const c of out.copies) await p.keys.delete(c.keyRef).catch(() => {});
    return skip((e as Error).message, kept);
  }
  const neu: StoredCredential = {
    ...rec.credential,
    // ZK kopyaları eski kayıttan taşınır (bağ aynı belirteçle; DPoP anahtarı aynı)
    ...(old.zk && rec.credential.zk
      ? { zk: { ...rec.credential.zk, copies: old.zk.copies, dueAt: old.zk.dueAt } }
      : {}),
    ...(old.status ? { status: old.status } : {}),
  };
  const passKeys = new Set((rec.state.passes ?? []).filter((x) => x.credentialId === old.id).map((x) => x.keyRef));
  const pinned = rec.state.settings.pinned;
  const state: WalletState = {
    ...rec.state,
    credentials: rec.state.credentials.filter((c) => c.id !== old.id).map((c) => (c.id === neu.id ? neu : c)),
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
    removedKeyRefs: old.copies.map((k) => k.keyRef).filter((k) => !passKeys.has(k)),
  };
}
