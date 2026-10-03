/**
 * ETSI TS 119 602 (Lists of Trusted Entities, LoTE) izdüşümü — ARF OIA_15b / ISSU_10b / ISSU_28a.
 * Tamga'nın imzalı güven listelerindeki kayıtlar, AB cüzdan ve doğrulayıcılarının okuyabildiği LoTE JSON biçiminde de yayınlanır.
 *
 * Profil: AB profillerinin (Ek E cüzdan sağlayıcıları, Ek F erişim sertifikası sağlayıcıları, Ek H yapısı) aynı kuralları, ama
 * "AB üye devletince bildirilmiş" anlamı taşıyan URI'ler (LoTEType, StatusDetn, schemerules, ListOfTrustedEntities/…/CC) yerine
 * Tamga URI'leri (ETSI TS 119 602 Ek C.1: işletenin kendi URI kökü). Hizmet türü URI'leri (SvcType/…) ETSI'ninkidir — hizmetin
 * işlevini anlatır, bildirim iddiası taşımaz. Kaynak her zaman Tamga listeleridir (BT4); LoTE yalnız bir görünümdür.
 */

import { createHash } from "node:crypto";

export const TAMGA_LOTE_ROOT = "https://trust.tamga.network/lote";
const ETSI_SVC = "http://uri.etsi.org/19602/SvcType";

export type LoteKind = "wallet-providers" | "wrpac-providers" | "eaa-providers";

const LOTE_TYPE: Record<LoteKind, string> = {
  "wallet-providers": `${TAMGA_LOTE_ROOT}/type/WalletProvidersList`,
  "wrpac-providers": `${TAMGA_LOTE_ROOT}/type/WRPACProvidersList`,
  "eaa-providers": `${TAMGA_LOTE_ROOT}/type/EAAProvidersList`,
};
const ENTITY_KIND: Record<LoteKind, string> = {
  "wallet-providers": "WalletProvider",
  "wrpac-providers": "WRPACProvider",
  "eaa-providers": "EAAProvider",
};
const SCHEME_NAME: Record<LoteKind, string> = {
  "wallet-providers": "Tamga Trust Framework — wallet providers",
  "wrpac-providers": "Tamga Trust Framework — providers of relying party access certificates",
  "eaa-providers": "Tamga Trust Framework — providers of electronic attestations of attributes (non-qualified)",
};

export interface LoteContact {
  postal: { StreetAddress: string; Locality?: string; PostalCode?: string; Country: string };
  /** mailto:, tel:, https: */
  electronic: string[];
  info: string[];
}

export interface LoteInput {
  kind: LoteKind;
  sequence: number;
  territory: string; // ISO 3166-1 alfa-2 (Tamga: TR) — imza sertifikasının C alanıyla aynı (§6.8.0)
  operatorName: string; // imza sertifikasının O alanıyla aynı (§6.8.0)
  operatorContact: LoteContact;
  issuedAt: Date;
  nextUpdate: Date;
  entities: Array<{
    name: string;
    tradeName?: string;
    contact: LoteContact;
    services: Array<{
      /** Issuance | Revocation */
      role: "Issuance" | "Revocation";
      name: string;
      certsDer: Uint8Array[];
      uniqueId?: string;
      supplyPoint?: string;
    }>;
  }>;
}

const svcType = (kind: LoteKind, role: "Issuance" | "Revocation") =>
  kind === "wallet-providers"
    ? `${ETSI_SVC}/WalletSolution/${role}`
    : kind === "wrpac-providers"
      ? `${ETSI_SVC}/WRPAC/${role}`
      : `${TAMGA_LOTE_ROOT}/svc-type/EAA/${role}`; // AB'de nitelikli olmayan EAA için ETSI hizmet türü yok

const en = (value: string) => [{ lang: "en", value }];
const enUri = (uriValue: string) => ({ lang: "en", uriValue });
const b64 = (der: Uint8Array) => Buffer.from(der).toString("base64");
/** ETSI: saniye hassasiyetli UTC (milisaniyesiz) */
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

function address(c: LoteContact) {
  return {
    TEPostalAddress: [{ lang: "en", ...c.postal }],
    TEElectronicAddress: c.electronic.map(enUri),
  };
}

/** ADR-0024 kayıt alanlarından LoTE iletişimi (adres + e-posta/telefon/destek + web); adres yoksa undefined. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function contactFromRegistration(rec: Record<string, any>, cc: string): LoteContact | undefined {
  const a = rec.postal_address;
  if (!a?.street_address) return undefined;
  const c = rec.contact ?? {};
  return {
    postal: {
      StreetAddress: a.street_address,
      ...(a.locality ? { Locality: a.locality } : {}),
      ...(a.postal_code ? { PostalCode: a.postal_code } : {}),
      Country: a.country ?? cc,
    },
    electronic: [
      ...(c.email ? [`mailto:${c.email}`] : []),
      ...(c.phone ? [`tel:${String(c.phone).replace(/\s+/g, "")}`] : []),
      ...(c.support_uri ? [c.support_uri] : []),
    ].concat(c.email || c.phone || c.support_uri ? [] : [rec.issuer_url ?? rec.info_uri]),
    info: [rec.info_uri ?? rec.issuer_url].filter(Boolean),
  };
}

/** Tek bir LoTE nesnesi (imzasız). Çıktı ETSI TS 119 602 Ek A.1 JSON şemasına uyar. */
export function buildLote(i: LoteInput) {
  const file = `${TAMGA_LOTE_ROOT}/${i.kind}.jws`;
  return {
    LoTE: {
      ListAndSchemeInformation: {
        LoTEVersionIdentifier: 1,
        LoTESequenceNumber: i.sequence,
        LoTEType: LOTE_TYPE[i.kind],
        SchemeOperatorName: en(i.operatorName),
        SchemeOperatorAddress: {
          SchemeOperatorPostalAddress: [{ lang: "en", ...i.operatorContact.postal }],
          SchemeOperatorElectronicAddress: i.operatorContact.electronic.map(enUri),
        },
        SchemeName: en(SCHEME_NAME[i.kind]),
        // a) bilgi sayfası, b) önceki bütün yayınlar
        SchemeInformationURI: [enUri(`${TAMGA_LOTE_ROOT}/`), enUri("https://trust.tamga.network/archive/")],
        StatusDeterminationApproach: `${TAMGA_LOTE_ROOT}/status-determination/TamgaTrustFramework`,
        SchemeTypeCommunityRules: [enUri("https://arf.tamga.network/trust-framework")],
        SchemeTerritory: i.territory,
        PolicyOrLegalNotice: [
          {
            LoTELegalNotice:
              "Projection of the Tamga signed trusted lists (lotl.jws, tl-<cc>.jws), which remain authoritative. " +
              "Entities are approved under the Tamga Trust Framework; this is not a list notified under Regulation (EU) No 910/2014.",
          },
        ],
        PointersToOtherLoTE: [
          {
            LoTELocation: file,
            ServiceDigitalIdentities: [{ OtherIds: [file] }],
            LoTEQualifiers: [
              { LoTEType: LOTE_TYPE[i.kind], SchemeOperatorName: en(i.operatorName), MimeType: "application/jose" },
            ],
          },
        ],
        ListIssueDateTime: iso(i.issuedAt),
        NextUpdate: iso(i.nextUpdate),
        DistributionPoints: [file],
      },
      ...(i.entities.length
        ? {
            TrustedEntitiesList: i.entities.map((e) => ({
              TrustedEntityInformation: {
                TEName: en(e.name),
                ...(e.tradeName ? { TETradeName: en(e.tradeName) } : {}),
                TEAddress: address(e.contact),
                TEInformationURI: [
                  ...e.contact.info.map(enUri),
                  enUri(`${TAMGA_LOTE_ROOT}/entity/${ENTITY_KIND[i.kind]}/${i.territory}`),
                ],
              },
              TrustedEntityServices: e.services.map((s) => ({
                ServiceInformation: {
                  ServiceTypeIdentifier: svcType(i.kind, s.role),
                  ServiceName: en(s.name),
                  ServiceDigitalIdentity: { X509Certificates: s.certsDer.map((d) => ({ val: b64(d) })) },
                  ...(s.supplyPoint ? { ServiceSupplyPoints: [{ uriValue: s.supplyPoint }] } : {}),
                  ...(s.uniqueId ? { ServiceInformationExtensions: [{ ServiceUniqueIdentifier: s.uniqueId }] } : {}),
                },
              })),
            })),
          }
        : {}),
    },
  };
}

/** Compact JAdES Baseline B başlığı (ETSI TS 119 182-1): imza sertifikası özeti + iddia edilen imza zamanı. */
export function jadesHeader(certDer: Uint8Array, signingTime: Date) {
  return {
    typ: undefined, // pemSigner'ın liste türü (tamga-tl+jwt) LoTE'de kullanılmaz
    cty: "application/json",
    "x5t#S256": createHash("sha256").update(certDer).digest("base64url"),
    sigT: iso(signingTime),
    crit: ["sigT"],
  };
}
