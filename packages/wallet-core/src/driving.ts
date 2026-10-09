/**
 * ADR-0039 — sürücü belgesi bilgisi (`urn:tamga:id:DrivingLicenceAttestation:1`), cüzdan tarafı yardımcıları (SPEC-ID-0003 §9.3).
 *  - Tür yalnız kimlik servisi metadata'da ilan ediyorsa gösterilir (sağlayıcı akışı ayarlı değilse ilan edilmez; K7).
 *  - Ön koşul (K4): PAR'a cüzdandaki Tamga kimlik belgesinin SUNUMU eklenir — SD-JWT VC + KB-JWT, `aud` = kimlik servisi,
 *    `nonce` = servisin `POST /nonce` ucundan (tek kullanımlık); YALNIZ ad, soyad ve doğum tarihi açılır. Ayrı OpenID4VP turu yok.
 *  - `access_denied` açıklamaları (servisin İngilizce metinleri) neden koduna çevrilir; ekran kendi dilinde sade ileti gösterir.
 * Protokol/kripto burada; ekran cüzdanda. Kişisel veri döndürmez, loglamaz.
 */
import { DRIVING_LICENCE_VCT, IDENTITY_VCT } from "./directory.js";
import { WalletError, type Http } from "./http.js";
import type { KeyProvider } from "./keys.js";
import type { IssuerMetadata } from "./oid4vci.js";
import { presentSdJwt } from "./sdjwt.js";
import type { StoredCredential } from "./store.js";

/** PAR alanı: kimlik belgesinin sunumu (kimlik servisi `IDENTITY_PRESENTATION_PARAM` ile aynı ad). */
export const IDENTITY_PRESENTATION_PARAM = "identity_presentation";
/** K4: kimlik belgesinden açılan alanlar — başka hiçbir alan açılmaz (servis fazlasını reddeder). */
/** ADR-0045: kimlik belgesinin AB PID adları (SD-JWT VC). */
export const DRIVING_IDENTITY_CLAIMS: readonly string[] = ["given_name", "family_name", "birthdate"];

/** Kimlik servisi sürücü belgesi bilgisini bugün veriyor mu (metadata'da `dc+sd-jwt` olarak ilan ediyor mu)? */
export const drivingOffered = (md: IssuerMetadata): boolean =>
  md.credential_configurations_supported?.[DRIVING_LICENCE_VCT]?.format === "dc+sd-jwt";

/**
 * Kimlik belgesinin kimlik servisine sunumu (PAR `identity_presentation`): servisin /nonce ucundan tek kullanımlık nonce alır,
 * yalnız ad/soyad/doğum tarihi açılmış SD-JWT VC + KB-JWT üretir. Kopya 0 kullanılır ve kullanım sayacına işlenmez: sunum,
 * belgeyi VEREN servise yapılır — servis zaten bütün kopyaların anahtarını bilir, yeni bir bağlanabilirlik doğmaz (silme isteğiyle
 * aynı desen). WL5 sayacı doğrulayıcılara yapılan sunumlar içindir.
 */
export async function identityPresentationForIssuer(p: {
  issuer: string;
  identity: StoredCredential | undefined;
  keys: KeyProvider;
  http: Http;
  now?: number;
}): Promise<string> {
  const base = p.issuer.replace(/\/$/, "");
  const id = p.identity;
  if (!id || id.vct !== IDENTITY_VCT || id.revokedLocally || !id.copies.length)
    throw new WalletError("unsupported", "an active Tamga identity credential is required first");
  if (id.issuer.replace(/\/$/, "") !== base)
    throw new WalletError("unsupported", "the identity credential was issued by another identity service");
  const n = await p.http(`${base}/nonce`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  let nonce: unknown;
  try {
    nonce = (JSON.parse(await n.text()) as { c_nonce?: unknown }).c_nonce;
  } catch {
    nonce = undefined;
  }
  if (n.status !== 200 || typeof nonce !== "string" || !nonce)
    throw new WalletError("issuer_error", "identity service nonce could not be obtained");
  const copy = id.copies[0];
  return presentSdJwt({
    combined: copy.combined,
    discloseClaims: [...DRIVING_IDENTITY_CLAIMS],
    keys: p.keys,
    keyRef: copy.keyRef,
    aud: base,
    nonce,
    ...(p.now !== undefined ? { iat: p.now } : {}),
  });
}

/**
 * Servisin ret nedenleri (SPEC-ID-0003 §9.3 "Ret" satırı). `identity_inactive`: kimlik belgesi yok, iptal edilmiş, süresi geçmiş
 * ya da PAR'daki sunum reddedildi. `review`: sağlayıcı incelemeye aldı. `consent`: rıza verilmedi. `verification_failed`:
 * sağlayıcı kartı/yüzü doğrulayamadı.
 */
export type DrivingDenyReason =
  | "not_driving_licence"
  | "expired"
  | "categories_unreadable"
  | "categories_expired"
  | "name_unreadable"
  | "identity_mismatch"
  | "identity_inactive"
  | "review"
  | "consent"
  | "verification_failed";

const DENY_PATTERNS: ReadonlyArray<readonly [RegExp, DrivingDenyReason]> = [
  [/not a readable driving licence|not a driving licence/i, "not_driving_licence"],
  [/driving licence has expired/i, "expired"],
  [/categories could not be read/i, "categories_unreadable"],
  [/categories on the card have expired/i, "categories_expired"],
  [/name on the card could not be read/i, "name_unreadable"],
  [/does not match the identity credential/i, "identity_mismatch"],
  [
    /identity credential[^.]*(no longer active|is not active)|identity_presentation required|identity presentation rejected|identity credential issued by this service is required|nonce unknown or expired|disclose (only )?given_name|name on the identity credential cannot be matched/i,
    "identity_inactive",
  ],
  [/manual review required/i, "review"],
  [/consent not given/i, "consent"],
  [/identity verification failed/i, "verification_failed"],
];

/** Servisin `error_description` metni → neden kodu; tanınmayan metinde `undefined` (ekran metni olduğu gibi gösterir). */
export function drivingDenyReason(description: string | undefined | null): DrivingDenyReason | undefined {
  if (!description) return undefined;
  for (const [re, reason] of DENY_PATTERNS) if (re.test(description)) return reason;
  return undefined;
}

export interface DrivingPrivilege {
  category: string;
  issue_date?: string;
  expiry_date?: string;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** `driving_privileges` claim'i (şema: `[{ category, issue_date?, expiry_date? }]`) → süzülmüş, kategoriye göre sıralı dizi. */
export function drivingPrivilegesOf(claims: Record<string, unknown> | undefined): DrivingPrivilege[] {
  const raw = claims?.driving_privileges;
  if (!Array.isArray(raw)) return [];
  const out: DrivingPrivilege[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.category !== "string" || !/^[A-Z][A-Z0-9]{0,3}$/.test(o.category)) continue;
    const p: DrivingPrivilege = { category: o.category };
    if (typeof o.issue_date === "string" && DATE_RE.test(o.issue_date)) p.issue_date = o.issue_date;
    if (typeof o.expiry_date === "string" && DATE_RE.test(o.expiry_date)) p.expiry_date = o.expiry_date;
    out.push(p);
  }
  return out.sort((a, b) => a.category.localeCompare(b.category));
}
