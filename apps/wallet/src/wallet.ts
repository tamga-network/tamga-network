/**
 * Uygulama iş akışı — wallet-core'u cihaz katmanıyla bağlar. Ekranlar bu fonksiyonları çağırır.
 * "Arka planda ne oldu" paneli için her adım `trace` dizisine yazılır (sunum sahne 4).
 */
import {
  fetchHttp,
  parseOffer,
  resolveOffer,
  redeem,
  receiveCredentials,
  fetchCatalogueHash,
  removeCredential,
  newState,
  manifestOf,
  registerUnit,
  requestWia,
  deleteUnit,
  requestIdentityErasure,
  keyAttestorFor,
  UNIT_REF,
  WalletError,
  fetchIssuerDirectory,
  assertIssuerAuthorized,
  type CredentialOffer,
  type RedeemOutput,
  type WalletState,
  b64,
  unitClientData,
  type DeviceEvidence,
} from "@tamga-network/wallet-core";
import { sha256 } from "@noble/hashes/sha2.js";
import { Platform } from "react-native";
import { TamgaKeys } from "../modules/tamga-keys";
import { keys, walletStore, newInstanceId, randomBytes, resetPin, resetWalletFile, seedVault } from "./platform";
import { TRUST_PINS } from "./trust-anchor";
import { t, type Key } from "@/i18n";

const DEFAULT_PROVIDER_BASE = "https://wallet.tamga.network";
const DEFAULT_TRUST_BASE = "https://trust.tamga.network";
export const APP_VERSION = "0.1.0";

const providerOf = (state: WalletState) => state.settings.providerBase ?? DEFAULT_PROVIDER_BASE;

/** ADR-0025: cüzdan birimi sağlayıcıda kayıtlı mı; değilse kaydeder (ilk kurulum, kilit açılışı). Kişi verisi gönderilmez. */
/**
 * P4-2 cihaz kanıtı: Android — birim anahtarı meydan okumayla donanımda üretilir, anahtar kanıtı zinciri gider; iOS — App Attest
 * (istemci verisi birim anahtarını bağlar). Yerel modül yoksa (Expo Go) kanıt yok → sağlayıcı yazılım seviyesi yazar.
 */
async function deviceEvidence(ctx: { challenge: string; unitThumbprint: string }): Promise<DeviceEvidence | undefined> {
  try {
    if (Platform.OS === "android") {
      const chain = keys.keyEvidence(UNIT_REF);
      return chain ? { platform: "android", key_attestation: chain } : undefined;
    }
    if (Platform.OS === "ios" && TamgaKeys?.appAttest) {
      const hash = b64(sha256(unitClientData(ctx.challenge, ctx.unitThumbprint)));
      return { platform: "ios", app_attest: await TamgaKeys.appAttest(hash) };
    }
  } catch {
    /* App Attest desteklenmiyor ya da geçici hata: kanıtsız kayıt */
  }
  return undefined;
}

export async function ensureWalletUnit(state: WalletState): Promise<{ state: WalletState; error?: string }> {
  const provider = providerOf(state);
  if (state.walletUnit?.provider === provider) return { state };
  try {
    const { unitId } = await registerUnit({
      providerBase: provider,
      keys,
      http: fetchHttp,
      appVersion: APP_VERSION,
      platform: `${Platform.OS} ${Platform.Version}`,
      randomBytes,
      deviceEvidence,
    });
    const next = { ...state, walletUnit: { unitId, provider, registeredAt: Math.floor(Date.now() / 1000) } };
    await walletStore.save(next);
    return { state: next };
  } catch (e) {
    return { state, error: friendlyError(e) };
  }
}

/**
 * ADR-0025 / TS3: her belge işlemi için YENİ WIA (< 24 saat, yeni anahtar + yeni iptal girişi — kurumlar cüzdanı birbirine
 * bağlayamaz). Önceki WIA anahtarı silinir. Adı eski WUA akışlarıyla uyum için korunur.
 */
export async function ensureWua(state: WalletState): Promise<{ state: WalletState; error?: string }> {
  const unit = await ensureWalletUnit(state);
  if (unit.error) return unit;
  state = unit.state;
  try {
    const wua = await requestWia({ providerBase: providerOf(state), keys, http: fetchHttp, randomBytes });
    if (state.wua?.keyRef && state.wua.keyRef !== wua.keyRef) await keys.delete(state.wua.keyRef).catch(() => {});
    const next = { ...state, wua };
    await walletStore.save(next);
    return { state: next };
  } catch (e) {
    return { state, error: friendlyError(e) };
  }
}

/** ADR-0025: belge anahtarları için sağlayıcı imzalı anahtar kanıtı (KA) üretici. */
export const keyAttestorOf = (state: WalletState) =>
  keyAttestorFor({ providerBase: providerOf(state), keys, http: fetchHttp, randomBytes });

export type Trace = Array<{ t: number; step: string; detail?: string }>;

export async function loadOrNull(): Promise<WalletState | null> {
  return walletStore.load();
}
export async function createWallet(): Promise<WalletState> {
  const st = newState(newInstanceId());
  await walletStore.save(st);
  return st;
}
export async function save(st: WalletState) {
  await walletStore.save(st);
  return st;
}

export async function scanToOffer(qr: string, trace: Trace): Promise<{ offer: CredentialOffer; issuerHost: string }> {
  const parsed = parseOffer(qr);
  trace.push({
    t: Date.now(),
    step: "QR decoded",
    detail: parsed.offerUri ? `credential_offer_uri = ${parsed.offerUri}` : "inline offer",
  });
  const offer = await resolveOffer(parsed, fetchHttp);
  trace.push({
    t: Date.now(),
    step: "Offer received (single use, PR3)",
    detail: `${offer.credential_issuer} · ${offer.credential_configuration_ids.join(", ")}`,
  });
  return { offer, issuerHost: offer.credential_issuer.replace(/^https?:\/\//, "").split("/")[0] };
}

/** Katalog hash'leri (B4) — çekirdekteki toplu çekim (WL9/CMP8); erişilemezse atlanır ve trace'e yazılır. */
export function catalogueLookup(trace: Trace, schemasBase?: string) {
  return fetchCatalogueHash({
    schemasBase,
    http: fetchHttp,
    onLoaded: (n) => trace.push({ t: Date.now(), step: "Schema catalogue fetched (B4 ready)", detail: `${n} types` }),
    onError: (m) =>
      trace.push({ t: Date.now(), step: "Catalogue unreachable — B4 skipped (local checks A1–A5)", detail: m }),
  });
}

export async function receive(
  state: WalletState,
  offer: CredentialOffer,
  txCode: string,
  trace: Trace,
): Promise<{ state: WalletState; credentialId: string }> {
  const ensured = await ensureWua(state);
  state = ensured.state;
  trace.push({
    t: Date.now(),
    step: state.wua
      ? `WUA ready (${state.wua.solutionId}, key_storage ${state.wua.keyStorage})`
      : `No WUA${ensured.error ? ": " + ensured.error : ""} — the issuer may reject (DB-16)`,
  });
  const out = await redeem({
    offer,
    txCode,
    keys,
    http: fetchHttp,
    wua: state.wua,
    randomBytes,
    keyAttestor: keyAttestorOf(state),
  });
  trace.push({ t: Date.now(), step: "Token received (tx_code verified, PR1; WUA + PoP headers)" });
  trace.push({
    t: Date.now(),
    step: `${out.copies.length} device keys created, ${out.copies.length} proofs signed (PR6)`,
    detail: (await keys.attestation()).storage === "software" ? "software key" : "secure hardware",
  });
  trace.push({ t: Date.now(), step: `${out.copies.length} copies received (SD-JWT VC, dc+sd-jwt)` });
  const r = await acceptCredentials(state, out, trace);
  await walletStore.save(r.state);
  return { state: r.state, credentialId: r.credential.id };
}

/**
 * Alınan kopyaları saklamadan önce: yerel doğrulama (A1–A5, B4, cnf) + alma anı güven denetimi — issuer imzalı güven listesinde
 * ACTIVE ve bu tip için yetkili olmalı (kötü niyetli teklif QR'ı listede olmayan anahtarla imzalı belgeyi "gerçek" gibi
 * yerleştiremez). Liste doğrulanamazsa da saklanmaz (fail-closed). Herhangi bir adım düşerse üretilen cihaz anahtarları silinir.
 */
export async function acceptCredentials(state: WalletState, out: RedeemOutput, trace: Trace) {
  try {
    const r = receiveCredentials(state, out, { catalogueHash: await catalogueLookup(trace) });
    trace.push({
      t: Date.now(),
      step: `${out.copies.length} copies passed local verification: ${r.verified.checks.join(" ")}`,
      detail: `issuer_id ${r.credential.issuerId.slice(0, 18)}… · cnf = my own key`,
    });
    const entries = await fetchIssuerDirectory(state.settings.trustBase ?? DEFAULT_TRUST_BASE, fetchHttp, TRUST_PINS);
    const e = assertIssuerAuthorized(entries, r.credential.issuerId, r.credential.vct);
    trace.push({
      t: Date.now(),
      step: `Trusted list: ${e.legalName} is registered and authorised for this type (TS1)`,
    });
    return r;
  } catch (err) {
    for (const c of out.copies) await keys.delete(c.keyRef).catch(() => {});
    throw err;
  }
}

export async function deleteCredential(state: WalletState, id: string): Promise<WalletState> {
  const gone = state.credentials.find((c) => c.id === id);
  const removed = removeCredential(state, id);
  const keyRefs = removed.keyRefs;
  // DASH_05a: silme olayı günlüğe (tarih, tür; değer yok)
  const next: WalletState = gone
    ? {
        ...removed.state,
        events: [
          ...(removed.state.events ?? []),
          { ts: Date.now(), kind: "deleted", vct: gone.vct, typeName: gone.typeName },
        ],
      }
    : removed.state;
  for (const ref of keyRefs) await keys.delete(ref).catch(() => {});
  await walletStore.save(next);
  return next;
}
export const manifest = manifestOf;
/** Kullanıcıya gösterilecek hata metni: bilinen hata kodları kullanıcının dilinde; diğerleri paketin (İngilizce) mesajı. */
export function friendlyError(e: unknown): string {
  if (e instanceof WalletError) {
    const byCode: Partial<Record<WalletError["code"], Key>> = {
      tx_code_mismatch: "err.txCode",
      too_many_attempts: "err.tooMany",
      offer_used: "err.offerUsed",
      offer_expired: "err.offerExpired",
      offer_not_found: "err.offerNotFound",
      network: "err.network",
    };
    const key = byCode[e.code];
    return key ? t(key) : e.message;
  }
  const m = (e as Error)?.message ?? String(e);
  if (/Network request failed/i.test(m)) return t("err.network");
  return m;
}

/** Sıfırlamanın sunucu tarafı sonucu: cihaz her durumda silinir; sunucu silmesi ağ yoksa yapılamaz (kişiye söylenir). */
export interface ResetOutcome {
  /** Tamga'nın servislerindeki kayıtlar silindi (ya da tutulan bir şey yoktu) */
  serverDeleted: boolean;
  /** Kimlik servisinde silinen kayıt sayısı */
  identityRecords: number;
}

const ID_BASE_DEFAULT = "https://id.tamga.network"; // issuance.ts DEFAULT_ID_BASE ile aynı (döngüsel import olmasın)

/**
 * Cüzdanı sıfırla ve verilerimi sil (Apple 5.1.1(v), Google Play hesap silme, KVKK md. 7): önce Tamga'nın servislerinde silme —
 * kimlik servisindeki kayıtlar (belgeyle kanıtlanır; sağlayıcıdaki görüntüler de silinir) ve cüzdan sağlayıcısındaki birim
 * kaydı —, sonra cihazdaki her şey: belgeler, anahtarlar, takma ad tohumu, günlük, PIN ("ilk kez yükleyen kullanıcı", WL1).
 * Kurumların tuttuğu veri kurumdadır; o yol TS7 silme talebidir.
 */
export async function resetWallet(state: WalletState | null): Promise<ResetOutcome> {
  let serverDeleted = true;
  let identityRecords = 0;
  if (state?.credentials.length) {
    try {
      const r = await requestIdentityErasure({
        issuer: state.settings.idBase ?? ID_BASE_DEFAULT,
        credentials: state.credentials,
        keys,
        http: fetchHttp,
      });
      identityRecords = r.erased;
    } catch {
      serverDeleted = false;
    }
  }
  // ADR-0025: birim iptal + kayıt silinir (verilmiş WIA'lar geçersiz)
  if (state?.walletUnit)
    await deleteUnit({ providerBase: state.walletUnit.provider, keys, http: fetchHttp, randomBytes }).catch(() => {
      serverDeleted = false;
    });
  await keys.delete(UNIT_REF).catch(() => {});
  if (state) {
    for (const c of state.credentials) for (const k of c.copies) await keys.delete(k.keyRef).catch(() => {});
    if (state.wua) await keys.delete(state.wua.keyRef).catch(() => {});
  }
  await seedVault.clear().catch(() => {}); // ADR-0031: takma ad tohumu (kimlik yeniden doğrulanınca aynısı gelir)
  await resetPin();
  await resetWalletFile();
  return { serverDeleted, identityRecords };
}
