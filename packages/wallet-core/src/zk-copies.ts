/**
 * ADR-0044 — ZK sunumu için kısa ömürlü kopyalar (cüzdan tarafı). Kimlik servisi kimlik belgesiyle birlikte bir yenileme
 * belirteci verir (DPoP + WIA bağlı, tek kullanımlık, her kullanımda değişir; kişi alanları yalnız servisin açabileceği biçimde
 * içinde — ZC3). Cüzdan bu belirteçle küçük bir ZK kopyası paketi alır (`refreshZkCopies`): her kopya kendi cihaz anahtarına bağlı,
 * en çok 24 saat geçerli, iptal listesi taşımayan mdoc (ZC1). Son kopyanın bitmesine kısa süre kala, rastgele bir gecikmeyle
 * kullanıcıya sormadan yenilenir (`scheduleZkRefreshes`; ADR-0023 K1 koşulları ve ayarı). Ana belge iptal ya da askıdaysa servis
 * yeni kopya vermez (ZC2): bağ kalkar, elde kalan kopya en geç 24 saatte geçersiz olur. ZK sunumu yalnız ZK kopyasıyla yapılır
 * (`oid4vp.ts` matchDcql); kopya yoksa ZK sorgusu karşılanamaz ve klasik seçenek seçilir (ZK5).
 */
import { b64u, b64uDecode, toHex } from "./b64.js";
import { readJson, type Http } from "./http.js";
import { isAuthRequired, type KeyProvider, type PublicJwk } from "./keys.js";
import type { WuaRecord } from "./wua.js";
import { wuaHeaders } from "./authcode.js";
import { dpopRequest, type DpopSigner } from "./dpop.js";
import { fetchIssuerMetadata, obtainCredential } from "./oid4vci.js";
import { jwkToPoint } from "./mdoc.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import { decode, encode, parseCoseSign1, verifyIssuerSigned, type CborValue } from "@tamga-network/mdoc";
import type { StoredCredential, WalletState, ZkCopy } from "./store.js";

/** Paket büyüklüğü (ADR-0044 K2 "küçük paket"): ZK ispatı bağlanamaz — kopya sayısı yalnız yedek içindir. */
export const ZK_COPY_BATCH = 3;
/** ZC1: ZK kopyasının azami geçerliliği (AB ARF VCR_01). Bunu aşan kopya alınmaz. */
export const ZK_COPY_MAX_VALIDITY_SEC = 24 * 3600;
/** Yenileme penceresi: son kopyanın bitişinden bu kadar önce açılır. */
export const ZK_REFRESH_WINDOW_SEC = 8 * 3600;
/** Pencere içinde rastgele gecikme üst sınırı (ADR-0023 K1: yenileme anı bir sunuma bağlanmasın). */
export const ZK_REFRESH_JITTER_SEC = 6 * 3600;
/** Bitişe bu kadar kala kopya artık sunumda kullanılmaz (saat farkı ve ispat süresi payı). */
export const ZK_COPY_MIN_REMAINING_SEC = 120;

/** Sunumda kullanılabilir ZK kopyaları (geçerlilik penceresinde; bitişe en az `ZK_COPY_MIN_REMAINING_SEC` var). */
export function validZkCopies(c: StoredCredential, now: number): ZkCopy[] {
  return (c.zk?.copies ?? []).filter((k) => k.validFrom <= now + 60 && k.validUntil - now > ZK_COPY_MIN_REMAINING_SEC);
}
export const hasValidZkCopy = (c: StoredCredential, now: number): boolean => validZkCopies(c, now).length > 0;
/** ZK sunumu için kopya: geçerli olanlardan en geç biteni (en uzun pay); yoksa null. */
export function selectZkCopy(c: StoredCredential, now: number): ZkCopy | null {
  return validZkCopies(c, now).sort((a, b) => b.validUntil - a.validUntil)[0] ?? null;
}

/** Belge ZK kopyası alabilir durumda mı (bağ var, belge iptal/askıda değil)? */
const zkActive = (c: StoredCredential) =>
  !!c.zk && !c.revokedLocally && c.status?.value !== "revoked" && c.status?.value !== "suspended";

/** Yenileme gerekli mi: geçerli kopya yok ya da en geç biten kopyanın bitişine `ZK_REFRESH_WINDOW_SEC`'ten az kaldı. */
export function zkCopiesDue(c: StoredCredential, now: number): boolean {
  if (!zkActive(c)) return false;
  const valid = validZkCopies(c, now);
  if (!valid.length) return true;
  return Math.max(...valid.map((k) => k.validUntil)) - now <= ZK_REFRESH_WINDOW_SEC;
}

/**
 * Pencereye giren ve zamanlanmamış belgelere rastgele `dueAt` atar (geçerli kopya yoksa hemen); zamanı gelenleri döndürür.
 * Gecikme, en geç biten kopyanın bitişinden önce yenilemeye yer bırakacak biçimde sınırlanır.
 */
export function scheduleZkRefreshes(
  state: WalletState,
  now: number,
  random: () => number = Math.random,
): { state: WalletState; due: string[] } {
  let changed = false;
  const credentials = state.credentials.map((c) => {
    if (!c.zk || c.zk.dueAt !== undefined || !zkCopiesDue(c, now)) return c;
    const valid = validZkCopies(c, now);
    const room = valid.length ? Math.max(...valid.map((k) => k.validUntil)) - now - 30 * 60 : 0;
    const delay = room > 0 ? Math.floor(random() * Math.min(ZK_REFRESH_JITTER_SEC, room)) : 0;
    changed = true;
    return { ...c, zk: { ...c.zk, dueAt: now + delay } };
  });
  const next = changed ? { ...state, credentials } : state;
  const due = next.credentials
    .filter((c) => c.zk?.dueAt !== undefined && c.zk.dueAt <= now && zkCopiesDue(c, now))
    .map((c) => c.id);
  return { state: next, due };
}

export interface ZkRefreshInput {
  state: WalletState;
  credentialId: string;
  keys: KeyProvider;
  http: Http;
  wua: WuaRecord;
  randomBytes: (n: number) => Uint8Array;
  now?: number;
  /** ADR-0025: kopya anahtarları için anahtar kanıtı (sağlayıcı) */
  keyAttestor?: (jwks: PublicJwk[]) => Promise<string>;
}
export type ZkRefreshResult =
  | { ok: true; state: WalletState; copies: number; removedKeyRefs: string[] }
  | { ok: false; state: WalletState; revoked: boolean; reason: string; removedKeyRefs: string[] };

/**
 * Bir kimlik belgesinin ZK kopyalarını yeniler: belirteç değişimi (grant_type=refresh_token, DPoP + WIA) → yeni paket (her kopya
 * yeni anahtar) → denetim (aynı kurum sertifikası, tür, cihaz anahtarı, ≤ 24 sa, durum listesi yok) → eski kopyaların yerine.
 * Ağ/kurum hatası iptal değildir (`revoked: false`, sonra yeniden denenir); `invalid_grant` = belge iptal/askıda ya da belirteç
 * geçersiz → bağ ve kopyalar kalkar (`revoked: true`).
 */
export async function refreshZkCopies(p: ZkRefreshInput): Promise<ZkRefreshResult> {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  const cred = p.state.credentials.find((c) => c.id === p.credentialId);
  const skip = (reason: string, state = p.state): ZkRefreshResult => ({
    ok: false,
    state,
    revoked: false,
    reason,
    removedKeyRefs: [],
  });
  if (!cred?.zk) return skip("no ZK copy binding");
  if (!zkActive(cred)) return skip("credential revoked or suspended");
  const b = cred.zk;
  const dpop: DpopSigner = { keys: p.keys, ref: b.dpopRef, jwk: b.dpopJwk };
  // a3 ön deneme (ağa çıkmadan): kopya anahtarlarının imzası doğrulama bekliyorsa belirteç boşa harcanmasın (autorefresh ile aynı)
  const probeRef = `probe.${b64u(p.randomBytes(9))}`;
  try {
    await p.keys.generate(probeRef);
    await p.keys.sign(probeRef, p.randomBytes(32));
  } catch (e) {
    return skip(isAuthRequired(e) ? "auth_required" : (e as Error).message);
  } finally {
    await p.keys.delete(probeRef).catch(() => {});
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
          ...(await wuaHeaders({ keys: p.keys, wua: p.wua, aud: cred.issuer, now, randomBytes: p.randomBytes })),
        }),
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(b.token)}`,
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
      // ZC2: ana belge iptal/askıda (ya da belirteç geçersiz) — bağ ve kopyalar kalkar; klasik sunum belgeyle sürer
      const { zk: _z, ...rest } = cred;
      return {
        ok: false,
        state: { ...p.state, credentials: p.state.credentials.map((c) => (c.id === cred.id ? rest : c)) },
        revoked: true,
        reason: tok.error_description ?? "invalid_grant",
        removedKeyRefs: [b.dpopRef, ...b.copies.map((k) => k.keyRef)],
      };
    }
    return skip(tok.error_description ?? `HTTP ${tr.status}`);
  }
  // Değişim yapıldı: eski belirteç artık geçersiz — yeni belirteç bundan sonraki her hatada saklanır
  const rotated = tok.refresh_token && tok.refresh_token !== b.token ? tok.refresh_token : b.token;
  const kept: WalletState = {
    ...p.state,
    credentials: p.state.credentials.map((c) => (c.id === cred.id ? { ...c, zk: { ...b, token: rotated } } : c)),
  };
  let out;
  try {
    const metadata = await fetchIssuerMetadata(cred.issuer, p.http);
    out = await obtainCredential({
      issuer: cred.issuer,
      vct: b.configurationId,
      metadata,
      accessToken: tok.access_token,
      keys: p.keys,
      http: p.http,
      batch: ZK_COPY_BATCH,
      keyRefPrefix: `zk${now.toString(36)}${b64u(p.randomBytes(3))}`,
      now,
      dpop,
      randomBytes: p.randomBytes,
      keyAttestor: p.keyAttestor,
      retainDpop: true, // belgeye bağlı kalıcı DPoP anahtarı
    });
  } catch (e) {
    return skip(isAuthRequired(e) ? "auth_required" : (e as Error).message, kept);
  }
  let copies: ZkCopy[];
  try {
    copies = out.copies.map((c) => ({
      keyRef: c.keyRef,
      cnf: c.cnf,
      mdoc: c.combined,
      ...checkZkCopy(c.combined, { docType: b.docType, cnf: c.cnf, leafFingerprint: cred.leafFingerprint, now }),
    }));
  } catch (e) {
    for (const c of out.copies) await p.keys.delete(c.keyRef).catch(() => {});
    return skip((e as Error).message, kept);
  }
  const old = b.copies.map((k) => k.keyRef);
  const state: WalletState = {
    ...p.state,
    credentials: p.state.credentials.map((c) =>
      c.id === cred.id ? { ...c, zk: { ...b, token: rotated, copies, dueAt: undefined } } : c,
    ),
  };
  return { ok: true, state, copies: copies.length, removedKeyRefs: old };
}

/**
 * Alınan ZK kopyasının denetimi: imza (kurum sertifikası kimlik belgesininkiyle aynı — MD3), tür, cihaz anahtarı = kopyanın anahtarı
 * (MD2), durum listesi yok ve geçerlilik ≤ 24 saat (ZC1). Geçerlilik penceresini döndürür; uymazsa hata.
 */
export function checkZkCopy(
  mdocB64u: string,
  ctx: { docType: string; cnf: PublicJwk; leafFingerprint: string; now: number },
): { validFrom: number; validUntil: number } {
  const bytes = b64uDecode(mdocB64u);
  const m = decode(bytes);
  const ia = m instanceof Map ? m.get("issuerAuth") : undefined;
  if (ia === undefined) throw new Error("ZK copy: issuerAuth missing");
  const leaf = parseCoseSign1(encode(ia as CborValue)).x5chain[0];
  if (!leaf || certFingerprintHex(leaf) !== ctx.leafFingerprint)
    throw new Error("ZK copy: issuer certificate differs from the identity credential (MD3)");
  const v = verifyIssuerSigned(bytes, {
    issuerPubRaw: p256PointFromCertDer(leaf),
    now: ctx.now,
    expectedDocType: ctx.docType,
  });
  if (!v.valid) throw new Error(`ZK copy rejected: ${v.reason}`);
  if (!v.deviceKeyRaw || toHex(v.deviceKeyRaw) !== toHex(jwkToPoint(ctx.cnf)))
    throw new Error("ZK copy: deviceKey differs from the copy's key (MD2)");
  if (v.status) throw new Error("ZK copy: carries a status list entry (ZC1)");
  const validFrom = Math.floor(Date.parse(v.validity!.validFrom) / 1000);
  const validUntil = Math.floor(Date.parse(v.validity!.validUntil) / 1000);
  if (!(validUntil > validFrom) || validUntil - validFrom > ZK_COPY_MAX_VALIDITY_SEC)
    throw new Error("ZK copy: validity longer than 24 hours (ZC1)");
  return { validFrom, validUntil };
}
