/**
 * Cüzdan-başlatmalı ihraç (ADR-0011 K3) — uygulama akışları:
 *  (1) Kimliğimi doğrula: Tamga kimlik servisi → PAR → sistem tarayıcısı (KVKK rıza + uzaktan doğrulama) → geri dönüş URL'i (code) → attestation.
 *  (2) Kurumdan belge iste: güven listesindeki kurum dizini → PAR → satır içi OpenID4VP kimlik sunumu (mevcut onay ekranı) → code → belge.
 * Kimlik ispatı sağlayıcısıyla cüzdan KONUŞMAZ (IDP3'ün ADR-0011 hâli): tarayıcıda açılan sayfa Tamga kimlik servisinindir.
 */
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import {
  fetchHttp,
  startAuthorized,
  authorizeInline,
  completeAuthorized,
  parseCallback,
  fetchIssuerDirectory,
  fetchRegistrarKeys,
  searchDirectory,
  IDENTITY_VCT,
  WalletError,
  assertIssuerAuthorized,
  offerIssuerState,
  readPseudonymSeed,
  type CredentialOffer,
  type AuthStart,
  type DirectoryEntry,
  type WalletState,
} from "@tamga-network/wallet-core";
import { keys, walletStore, randomBytes, seedVault } from "./platform";
import { acceptCredentials, catalogueLookup, ensureWua, friendlyError, keyAttestorOf, type Trace } from "./wallet";
import { scanToReview, sendPresentation, type ReviewModel } from "./present";
import { TRUST_PINS } from "./trust-anchor";
import { t } from "@/i18n";

const DEFAULT_ID_BASE = "https://id.tamga.network";
const DEFAULT_TRUST_BASE = "https://trust.tamga.network";

/** Geri dönüş adresi: Expo Go'da exp://…/--/idv/cb, gerçek derlemede tamga-wallet://idv/cb (app.json scheme). */
export const callbackUri = () => Linking.createURL("idv/cb");
export const hasIdentity = (st: WalletState) => st.credentials.some((c) => c.vct === IDENTITY_VCT && !c.revokedLocally);
export const identityOf = (st: WalletState) => st.credentials.find((c) => c.vct === IDENTITY_VCT && !c.revokedLocally);

/** ADR-0021 iletişim belgeleri (Tamga kimlik servisi verir; e-posta / telefon sahipliği tek kullanımlık kodla). */
export const EMAIL_VCT = "urn:tamga:contact:EmailAddress:1";
export const PHONE_VCT = "urn:tamga:contact:PhoneNumber:1";
export type ContactKind = "email" | "phone";
export const contactVct = (k: ContactKind) => (k === "email" ? EMAIL_VCT : PHONE_VCT);
export const contactKindOf = (vct: string): ContactKind | null =>
  vct === EMAIL_VCT ? "email" : vct === PHONE_VCT ? "phone" : null;

/** (1) Tamga kimlik servisi — tarayıcı oturumu. */
export const verifyIdentity = (state: WalletState, trace: Trace) => viaIdService(state, IDENTITY_VCT, trace);
/** (1b) Doğrulanmış e-posta / telefon — aynı tarayıcı akışı; tarayıcıda adres + kod ekranı. */
export const verifyContact = (state: WalletState, kind: ContactKind, trace: Trace) =>
  viaIdService(state, contactVct(kind), trace);

async function viaIdService(
  state: WalletState,
  vct: string,
  trace: Trace,
): Promise<{ state: WalletState; credentialId: string }> {
  const ensured = await ensureWua(state);
  state = ensured.state;
  if (!state.wua) throw new WalletError("unsupported", t("iss.wuaFailed", { error: ensured.error ?? "" }));
  const issuer = state.settings.idBase ?? DEFAULT_ID_BASE;
  const redirectUri = callbackUri();
  const start = await startAuthorized({
    issuer,
    vct,
    redirectUri,
    keys,
    http: fetchHttp,
    wua: state.wua,
    randomBytes,
  });
  trace.push({
    t: Date.now(),
    step: "PAR sent (PKCE S256, WUA client identity)",
    detail: `${issuer} · redirect ${redirectUri}`,
  });
  const res = await WebBrowser.openAuthSessionAsync(start.authorizeUrl, redirectUri, { preferEphemeralSession: true });
  if (res.type !== "success") throw new WalletError("unsupported", t("iss.browserClosed"));
  trace.push({
    t: Date.now(),
    step:
      vct === IDENTITY_VCT
        ? "Returned from the browser (consent + remote verification at the Tamga identity service)"
        : "Returned from the browser (one-time code verified at the Tamga identity service)",
    detail: parseCallback(res.url).error ? `error: ${parseCallback(res.url).error}` : "code received",
  });
  return finish(state, start, res.url, trace);
}

/** (2a) Kurum dizini. */
export async function loadDirectory(state: WalletState): Promise<DirectoryEntry[]> {
  return fetchIssuerDirectory(state.settings.trustBase ?? DEFAULT_TRUST_BASE, fetchHttp, TRUST_PINS); // S-13: imzalı liste
}
export { searchDirectory };

export interface InstitutionRequest {
  start: AuthStart;
  review: ReviewModel;
  entry: DirectoryEntry;
  vct: string;
}
/** (2b) Kurumdan belge iste → satır içi kimlik sunumu için onay modeli (mevcut sunum ekranı kullanılır). */
export async function beginInstitutionRequest(
  state: WalletState,
  entry: DirectoryEntry,
  vct: string,
  trace: Trace,
  /** ADR-0020: kurumun gönderdiği kimliğe bağlı teklif (issuer_state) */
  issuerState?: string,
): Promise<{ state: WalletState; req: InstitutionRequest }> {
  const ensured = await ensureWua(state);
  state = ensured.state;
  if (!state.wua) throw new WalletError("unsupported", t("iss.wuaFailed", { error: ensured.error ?? "" }));
  if (!hasIdentity(state)) throw new WalletError("unsupported", t("iss.needIdentity"));
  // Geliştirme: güven listesindeki kanonik issuer_url (issuer.tamga.network) LAN tabanına eşlenir; üründe birebir aynıdır
  const issuer = state.settings.issuerBase
    ? entry.issuerUrl.replace(/^https:\/\/issuer\.tamga\.network/, state.settings.issuerBase.replace(/\/$/, ""))
    : entry.issuerUrl;
  // ARF RPRC_22a/23: kurumun kayıt bilgisi (issuer_info) LOTL kayıt kurumu anahtarlarıyla; alınamazsa atlanır (PR15 zaten denetli)
  const registrarKeys = await fetchRegistrarKeys(state.settings.trustBase ?? DEFAULT_TRUST_BASE, fetchHttp, TRUST_PINS);
  const start = await startAuthorized({
    issuer,
    vct,
    redirectUri: callbackUri(),
    keys,
    http: fetchHttp,
    wua: state.wua,
    randomBytes,
    issuerState,
    // ISSU_32: kurumun güven listesindeki sertifikasıyla imzalı metadata
    ...(entry.certFingerprint ? { signerFingerprints: [entry.certFingerprint] } : {}),
    ...(registrarKeys.length ? { registrarKeys } : {}),
  });
  trace.push({
    t: Date.now(),
    step: issuerState ? "PAR sent for the institution's identity-bound offer (issuer_state)" : "PAR sent (PKCE, WUA)",
    detail: `${issuer} · ${vct}`,
  });
  const { qrPayload } = await authorizeInline(start, fetchHttp);
  trace.push({ t: Date.now(), step: "Institution requested an identity presentation (OpenID4VP, inline)" });
  const review = await scanToReview(state, qrPayload, trace);
  return { state, req: { start, review, entry, vct } };
}
/**
 * ADR-0020 Yol A: kurumun gönderdiği kimliğe bağlı teklif (authorization_code + issuer_state). Kurum imzalı güven listesinden
 * bulunur ve türe yetkili olmalı (PR15); sonra kurumdan belge isteme akışı (satır içi kimlik sunumu) aynen işler.
 */
export async function beginOfferRequest(
  state: WalletState,
  offer: CredentialOffer,
  trace: Trace,
): Promise<{ state: WalletState; req: InstitutionRequest }> {
  const issuerState = offerIssuerState(offer);
  const vct = offer.credential_configuration_ids[0];
  if (!issuerState) throw new WalletError("invalid_offer", "not an identity-bound offer");
  const dir = await loadDirectory(state);
  const lan = state.settings.issuerBase?.replace(/\/$/, "");
  const canonical = lan
    ? offer.credential_issuer.replace(lan, "https://issuer.tamga.network")
    : offer.credential_issuer;
  const entry = dir.find((d) => d.issuerUrl === canonical);
  if (!entry) throw new WalletError("unsupported", t("iss.offerUnknownIssuer"));
  assertIssuerAuthorized(dir, entry.issuerId, vct);
  trace.push({ t: Date.now(), step: `Identity-bound offer from ${entry.legalName} (trusted list)` });
  return beginInstitutionRequest(state, entry, vct, trace, issuerState);
}

/** (2c) Kullanıcı onayladı → sunum → code → belge. */
export async function completeInstitutionRequest(
  state: WalletState,
  req: InstitutionRequest,
  trace: Trace,
): Promise<{ state: WalletState; credentialId: string }> {
  const sent = await sendPresentation(state, req.review, trace);
  state = sent.state;
  if (!sent.redirectUri) throw new WalletError("issuer_error", t("iss.noRedirect"));
  const cb = parseCallback(sent.redirectUri);
  if (cb.error)
    throw new WalletError(
      "unsupported",
      friendlyInstitutionError(cb.errorDescription ?? cb.error, req.entry.legalName),
    );
  trace.push({ t: Date.now(), step: "Institution matched the identity with its record → code" });
  return finish(state, req.start, sent.redirectUri, trace);
}

async function finish(state: WalletState, start: AuthStart, callbackUrl: string, trace: Trace) {
  const out = await completeAuthorized({
    start,
    callbackUrl,
    keys,
    http: fetchHttp,
    wua: state.wua!,
    randomBytes,
    keyAttestor: keyAttestorOf(state),
  });
  trace.push({ t: Date.now(), step: "Token received (code + PKCE + WUA); nonce; 10 keys + proofs (PR6)" });
  const r = await acceptCredentials(state, out, trace);
  // ADR-0031: kimlik belgesiyle gelen takma ad tohumu — doğrulanır (aynı imzacı, kopya 0'ın anahtarı), güvenli depoya; belge
  // listesine girmez, hiçbir doğrulayıcıya sunulmaz (PS3). Aynı kişi → aynı tohum: yeni telefonda sitelerdeki hesaplar tanınır.
  if (out.pseudonymSeed) {
    try {
      await seedVault.set(readPseudonymSeed(out, r.credential, { catalogueHash: await catalogueLookup(trace) }));
      trace.push({ t: Date.now(), step: "Pseudonym seed stored in the secure store (ADR-0031; never presented)" });
    } catch (e) {
      trace.push({ t: Date.now(), step: "Pseudonym seed rejected", detail: (e as Error).message });
    }
  }
  await walletStore.save(r.state);
  return { state: r.state, credentialId: r.credential.id };
}
export { friendlyError };

/** Kurumun `access_denied` açıklamalarını kullanıcı diline çevirir (ASCII hata kodları → cümle). */
export function friendlyInstitutionError(desc: string, institution: string): string {
  // Sunucunun İngilizce açıklamaları (eski sürümün ASCII Türkçe metinleri de tanınır)
  if (/no match found|eslesme bulunamadi/i.test(desc)) return t("iss.noMatch", { inst: institution });
  if (/identity not verified|kimlik dogrulanamadi/i.test(desc))
    return t("iss.idNotVerified", { detail: desc.replace(/^(identity not verified|kimlik dogrulanamadi):\s*/i, "") });
  if (/no identity presentation|kimlik sunumu yok/i.test(desc)) return t("iss.noIdPresented");
  return desc;
}
