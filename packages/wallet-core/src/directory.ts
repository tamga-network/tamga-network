/**
 * Kurum dizini — güven listesinden (ADR-0011 K3, "kurum ara → belge iste"). Ek sunucu yok: tl-<cc>.json issuers[] + lotl kataloğu.
 * Liste imzası doğrulanır (S-13 kapandı, trustlist.ts): LOTL sabitlenmiş imzacıyla, tl-<cc> LOTL'daki anahtarla; bayat ve geri sarılmış liste reddedilir.
 * Kişisel veri yok; yalnızca kurum kaydı.
 */
import { WalletError, type Http } from "./http.js";
import { fetchTrustSource, type TrustPins } from "./trustlist.js";

export interface DirectoryEntry {
  slug: string;
  legalName: string;
  category: string;
  klass: string;
  assurance: string;
  issuerUrl: string;
  /** Güven listesindeki issuer_id — belgeyle eşleştirme adres yerine bununla (LAN/ayna adresleri farklı olabilir). */
  issuerId: string;
  status: string;
  vcts: string[]; // bugün yetkili olduğu tipler (allowed && pencere içinde)
  isIdentityProvider: boolean; // urn:tamga:id:IdentityAttestation:1 verebiliyor mu
  /** Kurumun güven listesindeki belge imza sertifikası parmak izi — imzalı metadata doğrulaması (ISSU_32) */
  certFingerprint?: string;
}
export const IDENTITY_VCT = "urn:tamga:id:IdentityAttestation:1";
/** ADR-0039: sürücü belgesi bilgisi — kimlik servisi verir; PAR'da kimlik belgesi sunumu ön koşul (`identity_presentation`). */
export const DRIVING_LICENCE_VCT = "urn:tamga:id:DrivingLicenceAttestation:1";
export const CATEGORY_LABELS: Record<string, string> = {
  EDUCATION: "Education",
  IDENTITY: "Identity",
  GOVERNMENT: "Government",
  HEALTH: "Health",
  FINANCE: "Finance",
  TELECOM: "Telecommunications",
  TRANSPORT: "Transport",
  EVENTS: "Events",
  LOGISTICS: "Logistics",
  OTHER: "Other",
};

interface RawIssuer {
  slug: string;
  legal_name: string;
  category: string;
  class: string;
  assurance: string;
  issuer_url: string;
  issuer_id: string;
  status: string;
  schema_authorizations?: Array<{ vct: string; allowed: boolean; valid_from: string; valid_until: string | null }>;
  cert_fingerprint_sha256?: string;
}

/** Kurum dizini, İMZASI DOĞRULANMIŞ ulusal listeden (S-13). Doğrulanamazsa hata — sahte kurum listelenmez. */
export async function fetchIssuerDirectory(
  trustBase: string,
  http: Http,
  pins: TrustPins,
  stateCode = "tr",
  now = Date.now(),
): Promise<DirectoryEntry[]> {
  const { source } = await fetchTrustSource(trustBase, http, { pins, stateCode, now });
  return (source.issuers() as unknown as RawIssuer[]).map((i) => {
    // TS1: TrustSource sorgusu
    const vcts = (i.schema_authorizations ?? [])
      .filter(
        (a) =>
          a.allowed &&
          new Date(a.valid_from).getTime() <= now &&
          (!a.valid_until || now < new Date(a.valid_until).getTime()),
      )
      .map((a) => a.vct);
    return {
      slug: i.slug,
      legalName: i.legal_name,
      category: i.category,
      klass: i.class,
      assurance: i.assurance,
      issuerUrl: i.issuer_url,
      issuerId: i.issuer_id,
      status: i.status,
      vcts,
      isIdentityProvider: vcts.includes(IDENTITY_VCT),
      ...(i.cert_fingerprint_sha256 ? { certFingerprint: i.cert_fingerprint_sha256 } : {}),
    };
  });
}

/** Arama: ad/slug içinde geçen metin (Türkçe duyarsız) + kategori süzgeci; kimlik sağlayıcı kurum listesinde gösterilmez (ayrı akış). */
export function searchDirectory(entries: DirectoryEntry[], q = "", category?: string): DirectoryEntry[] {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/İ/g, "I").toLowerCase();
  const nq = norm(q.trim());
  return entries.filter(
    (e) =>
      e.status === "ACTIVE" &&
      !e.isIdentityProvider &&
      (!category || e.category === category) &&
      (!nq || norm(e.legalName).includes(nq) || norm(e.slug).includes(nq)),
  );
}
export const typeLabel = (vct: string) =>
  (
    ({
      "urn:tamga:edu:DiplomaCredential:1": "Diploma",
      "urn:tamga:edu:StudentCredential:1": "Student Certificate",
      [IDENTITY_VCT]: "Identity Attestation",
      [DRIVING_LICENCE_VCT]: "Driving Licence Information",
    }) as Record<string, string>
  )[vct] ?? vct.split(":").slice(-2, -1)[0];

/**
 * Alma anı güven denetimi: belgeyi imzalayan issuer, imzası doğrulanmış güven listesinde ACTIVE ve bu tip için bugün yetkili mi?
 * Yerel imza denetimi (A1–A5) yalnızca belgenin kendi sertifikasıyla tutarlı olduğunu gösterir; kötü niyetli bir teklif (QR)
 * listede olmayan bir anahtarla imzalanmış belgeyi cüzdana "gerçek" gibi yerleştirebilirdi. Kayıt yoksa belge saklanmaz.
 */
export function assertIssuerAuthorized(entries: DirectoryEntry[], issuerId: string, vct: string): DirectoryEntry {
  const e = entries.find((x) => x.issuerId.toLowerCase() === issuerId.toLowerCase());
  if (!e)
    throw new WalletError(
      "trust_error",
      "The issuing institution is not registered in the Tamga trusted list; the credential was not saved.",
    );
  if (e.status !== "ACTIVE")
    throw new WalletError(
      "trust_error",
      `${e.legalName} cannot issue credentials right now (status: ${e.status}); the credential was not saved.`,
    );
  if (!e.vcts.includes(vct))
    throw new WalletError(
      "trust_error",
      `${e.legalName} is not authorised to issue this credential type; the credential was not saved.`,
    );
  return e;
}
