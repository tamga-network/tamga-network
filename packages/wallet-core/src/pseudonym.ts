/**
 * ADR-0031 — site başına takma ad (ARF Topic 11 PA_01–PA_19).
 *  Tohum: kimlik servisi kimlik belgesiyle birlikte ayrı, SUNULAMAYAN bir belge türünde verir (`urn:tamga:id:PseudonymSeed:1`, PS3).
 *         Cüzdan onu belge listesine koymaz, güvenli depoda (`SeedVault`: Keychain / Keystore) tutar; taşıma dosyasına girmez (LX2).
 *  Anahtar (K2): k = HKDF-SHA256(seed, info = "tamga-pseudonym-v1|" + site + "|" + sıra) → P-256 özel anahtar; takma ad = açık
 *         anahtarın JWK parmak izi (RFC 7638). Site = asıl RP'nin kayıtlı kimliği (aracıda asıl RP; ADR-0017 K7). Türetilen anahtar
 *         saklanmaz; her sunumda PIN/biyometri sonrası yeniden türetilir.
 *  Sunum (K3, PS5): DCQL'de `format: "tamga-pseudonym"` sorgusu → vp_token girdisi = takma ad anahtarıyla imzalı kısa JWT
 *         (`typ: tamga-pseudonym+jwt`, başlıkta `jwk`; `aud` = client_id, `nonce`, `rp`, WIA + PoP). Belge alanı taşımaz.
 * Takma ad değeri günlüğe yazılmaz (PA_08a: yalnız site adı ve olay).
 */
import { p256 } from "@noble/curves/nist.js";
import { mapHashToField } from "@noble/curves/abstract/modular.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { b64u, b64uDecode, b64uUtf8, utf8 } from "./b64.js";
import { jwkThumbprint } from "./jwe.js";
import { rawToJwk, type PublicJwk } from "./keys.js";
import { verifyIssuedSdJwt } from "./sdjwt.js";
import type { RedeemOutput } from "./oid4vci.js";
import type { DcqlQuery } from "./oid4vp.js";
import type { WalletState } from "./store.js";

export const PSEUDONYM_SEED_VCT = "urn:tamga:id:PseudonymSeed:1";
/** DCQL biçim tanımlayıcısı (Tamga profili): doğrulayıcı takma ad ister. */
export const PSEUDONYM_FORMAT = "tamga-pseudonym";
export const PSEUDONYM_TYP = "tamga-pseudonym+jwt";
/** Sunulamayan türler (PS3): cüzdan bunları hiçbir DCQL sorgusuna önermez. */
export const NON_PRESENTABLE_VCTS: readonly string[] = [PSEUDONYM_SEED_VCT];
const DOMAIN = "tamga-pseudonym-v1";
const SEED_RE = /^[A-Za-z0-9_-]{43}$/;

/** Tohumun güvenli deposu — uygulama Keychain / Keystore ile sağlar (mağaza derlemesinde donanım korumalı). */
export interface SeedVault {
  get(): Promise<string | null>;
  set(seed: string): Promise<void>;
  clear(): Promise<void>;
}
export class MemorySeedVault implements SeedVault {
  private v: string | null = null;
  async get() {
    return this.v;
  }
  async set(seed: string) {
    this.v = seed;
  }
  async clear() {
    this.v = null;
  }
}

/** Kullanıcının gördüğü takma ad kaydı (değer siteye gider; ad — `label` — gitmez, PA_19). Anahtar YOK. */
export interface PseudonymEntry {
  /** asıl RP'nin kayıtlı kimliği */
  rpKey: string;
  /** türetme sırası: 0 = sitenin varsayılan takma adı; silinen sıra bir daha kullanılmaz */
  index: number;
  /** RFC 7638 parmak izi (base64url) — sitenin gördüğü değer */
  pseudonym: string;
  siteName?: string;
  label?: string;
  createdAt: number;
  lastUsedAt?: number;
  deletedAt?: number;
}

/**
 * Kimlik belgesiyle gelen tohum belgesini doğrular ve tohumu çıkarır: imza, tür, kopya 0'ın anahtarı, kimlik belgesiyle AYNI
 * imzacı (sertifika parmak izi). Doğrulanamazsa hata — tohum saklanmaz.
 */
export function readPseudonymSeed(
  out: RedeemOutput,
  identity: { leafFingerprint: string },
  opt: { catalogueHash?: (vct: string) => string | string[] | undefined; now?: number } = {},
): string {
  if (!out.pseudonymSeed) throw new Error("no pseudonym seed in the credential response");
  const v = verifyIssuedSdJwt(out.pseudonymSeed, {
    expectedCnf: out.copies[0]?.cnf,
    catalogueHash: opt.catalogueHash,
    now: opt.now,
  });
  if (!v.ok) throw new Error(`pseudonym seed rejected (${v.failedStep}): ${v.reason}`);
  if (v.vct !== PSEUDONYM_SEED_VCT) throw new Error("pseudonym seed has the wrong type");
  if (v.leafFingerprint !== identity.leafFingerprint)
    throw new Error("pseudonym seed is not signed by the identity issuer");
  const s = v.claims.pseudonym_seed;
  if (typeof s !== "string" || !SEED_RE.test(s)) throw new Error("pseudonym seed malformed");
  return s;
}

/** K2: site + sıra için takma ad anahtarı. Aynı tohum + site + sıra → her cihazda aynı anahtar; farklı site → ilişkisiz anahtar. */
export function derivePseudonym(seed: string, rpKey: string, index: number) {
  if (!SEED_RE.test(seed)) throw new Error("pseudonym seed malformed");
  if (!Number.isInteger(index) || index < 0) throw new Error("pseudonym index");
  const okm = hkdf(sha256, b64uDecode(seed), utf8(DOMAIN), utf8(`${DOMAIN}|${rpKey}|${index}`), 48);
  const sk = mapHashToField(okm, p256.Point.Fn.ORDER); // [1, n-1], eşit dağılımlı (RFC 9380 hash_to_field)
  const jwk = rawToJwk(p256.getPublicKey(sk, false));
  return { sk, jwk, pseudonym: b64u(jwkThumbprint(jwk)) };
}

/** İstekteki takma ad sorgusu (yoksa null). `mode`: RP kaydındaki `pseudonyms` (varsayılan single). */
export function pseudonymQueryOf(dcql: DcqlQuery): { id: string; mode: "single" | "multiple" } | null {
  const q = dcql.credentials.find((c) => c.format === PSEUDONYM_FORMAT);
  if (!q) return null;
  const mode = (q.meta as { mode?: string } | undefined)?.mode === "multiple" ? "multiple" : "single";
  return { id: q.id, mode };
}

/** Bu sitedeki etkin (silinmemiş) takma adlar, son kullanılan önce. */
export const activePseudonyms = (st: WalletState, rpKey: string): PseudonymEntry[] =>
  (st.pseudonyms ?? [])
    .filter((p) => p.rpKey === rpKey && !p.deletedAt)
    .sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt));

/** Yeni takma ad sırası: bu sitede daha önce kullanılmış (silinmiş dahil) en büyük sıra + 1; hiç yoksa 0. */
export function nextPseudonymIndex(st: WalletState, rpKey: string): number {
  const used = (st.pseudonyms ?? []).filter((p) => p.rpKey === rpKey).map((p) => p.index);
  return used.length ? Math.max(...used) + 1 : 0;
}

/**
 * Sunumda kullanılacak sıra: `single` → sitenin tek etkin takma adı (yoksa yeni); `multiple` → kullanıcının seçtiği etkin sıra,
 * `"new"` ya da seçim yoksa son kullanılan.
 */
export function choosePseudonymIndex(
  st: WalletState,
  rpKey: string,
  mode: "single" | "multiple",
  choice?: number | "new",
): { index: number; isNew: boolean } {
  const active = activePseudonyms(st, rpKey);
  if (mode === "multiple" && choice === "new") return { index: nextPseudonymIndex(st, rpKey), isNew: true };
  if (mode === "multiple" && typeof choice === "number") {
    if (!active.some((p) => p.index === choice)) throw new Error("unknown pseudonym");
    return { index: choice, isNew: false };
  }
  if (active.length) return { index: active[0].index, isNew: false };
  return { index: nextPseudonymIndex(st, rpKey), isNew: true };
}

/**
 * PS5: takma ad sunumu — türetilmiş anahtarla imzalı JWT; `wia` + `wia_pop` iptal edilmemiş cüzdan birimini kanıtlar
 * (PA_11–PA_14). Belge alanı ve kişi verisi taşımaz.
 */
export function presentPseudonym(p: {
  seed: string;
  rpKey: string;
  index: number;
  aud: string;
  nonce: string;
  wia: string;
  wiaPop: string;
  now?: number;
}): { jwt: string; pseudonym: string } {
  const { sk, jwk, pseudonym } = derivePseudonym(p.seed, p.rpKey, p.index);
  const header = { alg: "ES256", typ: PSEUDONYM_TYP, jwk };
  const payload = {
    aud: p.aud,
    nonce: p.nonce,
    iat: p.now ?? Math.floor(Date.now() / 1000),
    rp: p.rpKey,
    wia: p.wia,
    wia_pop: p.wiaPop,
  };
  const input = `${b64uUtf8(JSON.stringify(header))}.${b64uUtf8(JSON.stringify(payload))}`;
  const sig = p256.sign(utf8(input), sk, { prehash: true, lowS: true, format: "compact" });
  sk.fill(0);
  return { jwt: `${input}.${b64u(sig)}`, pseudonym };
}

/** Takma ad kaydını oluşturur ya da kullanım zamanını günceller (anahtar ve tohum yazılmaz). */
export function recordPseudonymUse(
  st: WalletState,
  e: { rpKey: string; index: number; pseudonym: string; siteName?: string },
  now = Date.now(),
): WalletState {
  const list = [...(st.pseudonyms ?? [])];
  const i = list.findIndex((p) => p.rpKey === e.rpKey && p.index === e.index);
  const isNew = i < 0;
  if (isNew) list.push({ ...e, createdAt: now, lastUsedAt: now });
  else list[i] = { ...list[i], lastUsedAt: now, ...(e.siteName ? { siteName: e.siteName } : {}) };
  return {
    ...st,
    pseudonyms: list,
    ...(isNew
      ? {
          events: [
            ...(st.events ?? []),
            { ts: now, kind: "pseudonym_created" as const, vct: PSEUDONYM_FORMAT, typeName: e.siteName ?? e.rpKey },
          ],
        }
      : {}),
  };
}

/** PA_07: kullanıcı takma adı siler — o sıra bu sitede bir daha türetilmez (yeniden kayıt yeni sıra açar). */
export function deletePseudonym(st: WalletState, rpKey: string, index: number, now = Date.now()): WalletState {
  const list = (st.pseudonyms ?? []).map((p) =>
    p.rpKey === rpKey && p.index === index && !p.deletedAt ? { ...p, deletedAt: now, label: undefined } : p,
  );
  const gone = list.find((p) => p.rpKey === rpKey && p.index === index);
  return {
    ...st,
    pseudonyms: list,
    events: [
      ...(st.events ?? []),
      { ts: now, kind: "pseudonym_deleted", vct: PSEUDONYM_FORMAT, typeName: gone?.siteName ?? rpKey },
    ],
  };
}

/** PA_05: kullanıcının takma ada verdiği ad (yalnız cihazda; siteye gitmez — PA_19). */
export function renamePseudonym(st: WalletState, rpKey: string, index: number, label: string): WalletState {
  const clean = label.trim().slice(0, 60);
  return {
    ...st,
    pseudonyms: (st.pseudonyms ?? []).map((p) =>
      p.rpKey === rpKey && p.index === index ? { ...p, label: clean || undefined } : p,
    ),
  };
}

/** Test/araç: bir takma adın açık anahtarı (doğrulayıcının göreceği parmak iziyle aynı). */
export const pseudonymPublicJwk = (seed: string, rpKey: string, index: number): PublicJwk =>
  derivePseudonym(seed, rpKey, index).jwk;
