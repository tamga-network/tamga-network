/**
 * ADR-0036 — Tamga kataloğunda OLMAYAN ama dış güven listeleri (federasyon) üzerinden doğrulanabilen belge türleri.
 * Kaynak: Komisyon Uygulama Tüzüğü (AB) 2026/1731 (PID Eki, Tablo 6–8), AB PID kural kitabı
 * (eu-digital-identity-wallet/eudi-doc-attestation-rulebooks-catalog, `pid-rulebook.md`) ve ISO/IEC 18013-5 (mDL). Bu türler Tamga tarafından verilmez; şema yalnız doğrulayıcının biçim denetimi (B6) içindir ve
 * gevşek tutulur (açıklanan alanların türleri; ek alanlara izin). Tür bütünlüğü (vct#integrity) Tamga kataloğuna bağlanmaz:
 * güven, türü kapsamında sayan dış listenin imzalı kaydından gelir (FD2).
 *
 * Not (kural kitabı): AB PID'de yaş öznitelikleri (age_over_NN) artık yok — yaş için ayrı yaş doğrulama belgesi kullanılır.
 * mDL'de (ISO 18013-5) age_over_NN öğeleri vardır.
 */

export interface ExternalTypeDef {
  /** SD-JWT `vct` ya da mdoc docType */
  vct: string;
  format: "dc+sd-jwt" | "mso_mdoc";
  /** mdoc ad alanı (DCQL yolu: [namespace, element]) */
  namespace?: string;
  source: string;
  jsonSchema: Record<string, unknown>;
}

const str = { type: "string" };
const date = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}" };
const placeObj = {
  type: "object",
  properties: { country: str, region: str, locality: str },
  additionalProperties: true,
};

/** AB PID — SD-JWT VC (urn:eudi:pid:1) */
export const EU_PID_SD_JWT: ExternalTypeDef = {
  vct: "urn:eudi:pid:1",
  format: "dc+sd-jwt",
  source: "EU PID Rulebook (eudi-doc-attestation-rulebooks-catalog, pid-rulebook.md)",
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.tamga.network/external/eu-pid-sd-jwt/schema.json",
    type: "object",
    properties: {
      given_name: str,
      family_name: str,
      birthdate: date,
      place_of_birth: placeObj,
      nationalities: { type: "array", items: { type: "string", pattern: "^[A-Z]{2}$" } },
      address: {
        type: "object",
        properties: {
          formatted: str,
          country: str,
          region: str,
          locality: str,
          postal_code: str,
          street_address: str,
          house_number: str,
        },
        additionalProperties: true,
      },
      birth_family_name: str,
      birth_given_name: str,
      email: str,
      phone_number: str,
      picture: str,
      sex: { type: "integer" },
      personal_administrative_number: str,
      document_number: str,
      issuing_authority: str,
      issuing_country: { type: "string", pattern: "^[A-Z]{2}$" },
      issuing_jurisdiction: str,
      trust_anchor: str,
      attestation_legal_category: str,
      date_of_issuance: date,
      date_of_expiry: date,
    },
    additionalProperties: true,
  },
};

/** AB PID — ISO mdoc (eu.europa.ec.eudi.pid.1) */
export const EU_PID_MDOC: ExternalTypeDef = {
  vct: "eu.europa.ec.eudi.pid.1",
  format: "mso_mdoc",
  namespace: "eu.europa.ec.eudi.pid.1",
  source: "EU PID Rulebook (eudi-doc-attestation-rulebooks-catalog, pid-rulebook.md)",
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.tamga.network/external/eu-pid-mdoc/schema.json",
    type: "object",
    properties: {
      family_name: str,
      given_name: str,
      birth_date: {}, // full-date (#6.1004)
      place_of_birth: placeObj,
      nationality: { type: "array", items: { type: "string", pattern: "^[A-Z]{2}$" } }, // `nationalities` kodlaması (dizi)
      resident_address: str,
      resident_country: str,
      resident_state: str,
      resident_city: str,
      resident_postal_code: str,
      resident_street: str,
      // CIR 2026/1731 Tablo 6 (mdoc tanımlayıcıları; SD-JWT'de birth_family_name / birth_given_name)
      family_name_birth: str,
      given_name_birth: str,
      email_address: str,
      mobile_phone_number: str,
      sex: { type: "integer" },
      personal_administrative_number: str,
      document_number: str,
      issuing_authority: str,
      issuing_country: str,
      issuing_jurisdiction: str,
      trust_anchor: str,
      attestation_legal_category: str,
      expiry_date: {},
      issuance_date: {},
    },
    additionalProperties: true,
  },
};

/** Mobil ehliyet — ISO/IEC 18013-5 (org.iso.18013.5.1.mDL) */
export const ISO_MDL: ExternalTypeDef = {
  vct: "org.iso.18013.5.1.mDL",
  format: "mso_mdoc",
  namespace: "org.iso.18013.5.1",
  source: "ISO/IEC 18013-5:2021 §7.2.1",
  jsonSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.tamga.network/external/iso-mdl/schema.json",
    type: "object",
    properties: {
      family_name: str,
      given_name: str,
      birth_date: {},
      issue_date: {},
      expiry_date: {},
      issuing_country: str,
      issuing_authority: str,
      document_number: str,
      portrait: {},
      driving_privileges: {},
      un_distinguishing_sign: str,
      age_over_18: { type: "boolean" },
      age_over_21: { type: "boolean" },
    },
    additionalProperties: true,
  },
};

export const EXTERNAL_TYPES: readonly ExternalTypeDef[] = [EU_PID_SD_JWT, EU_PID_MDOC, ISO_MDL];
export const externalType = (vct: string): ExternalTypeDef | undefined => EXTERNAL_TYPES.find((t) => t.vct === vct);
