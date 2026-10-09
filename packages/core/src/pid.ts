/**
 * AB PID öznitelik adları — Komisyon Uygulama Tüzüğü (AB) 2026/1731 (2024/2977 Eki yeniden yazıldı), Tablo 6 (ISO mdoc
 * öznitelik tanımlayıcısı) ve Tablo 7–8 (SD-JWT VC claim adı). Aynı veri iki biçimde farklı adla ve kodlamayla taşınır; Tamga
 * kimlik belgesi bu kodlamayı izler (ADR-0045). Platformdan bağımsız: içe aktarma yok (React Native güvenli alt yol `/pid`).
 */

/** mdoc öznitelik tanımlayıcısı → SD-JWT VC claim adı (yalnız farklı olanlar; CIR 2026/1731 Tablo 6 ↔ Tablo 7–8). */
export const PID_MDOC_TO_SDJWT: Readonly<Record<string, string>> = Object.freeze({
  birth_date: "birthdate",
  nationality: "nationalities",
  family_name_birth: "birth_family_name",
  given_name_birth: "birth_given_name",
  email_address: "email",
  mobile_phone_number: "phone_number",
  portrait: "picture",
  expiry_date: "date_of_expiry",
  issuance_date: "date_of_issuance",
  resident_address: "address.formatted",
  resident_country: "address.country",
  resident_state: "address.region",
  resident_city: "address.locality",
  resident_postal_code: "address.postal_code",
  resident_street: "address.street_address",
});

/** SD-JWT VC claim adı → mdoc öznitelik tanımlayıcısı (PID_MDOC_TO_SDJWT'nin tersi). */
export const PID_SDJWT_TO_MDOC: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(Object.entries(PID_MDOC_TO_SDJWT).map(([m, s]) => [s, m])),
);

/** mdoc öğe adının SD-JWT VC karşılığı (tabloda yoksa aynı ad: `family_name`, `age_over_18`, …). */
export const pidSdJwtName = (mdocElement: string): string => PID_MDOC_TO_SDJWT[mdocElement] ?? mdocElement;
/** SD-JWT VC claim adının mdoc karşılığı (tabloda yoksa aynı ad). */
export const pidMdocName = (sdJwtClaim: string): string => PID_SDJWT_TO_MDOC[sdJwtClaim] ?? sdJwtClaim;

/** RFC 8943 `full-date` CBOR etiketi (CIR 2026/1731 §4.1 (e): `full-date` = #6.1004(tstr)). */
export const CBOR_TAG_FULL_DATE = 1004;
/** RFC 8949 `tdate` CBOR etiketi (RFC 3339 tarih-saat). */
export const CBOR_TAG_TDATE = 0;
