/**
 * ADR-0094 (yalnız sandbox) — temsili ulusal kimlik makamlarının PID sağlayıcı listeleri: ülke başına bir ETSI TS 119 602 LoTE
 * (JSON, compact JAdES). AB'deki gibi PID sağlayıcıları güven listesinde değil, ayrı sağlayıcı listesinde duyurulur; sandbox LOTL
 * her listeyi ADR-0036 K1 dış liste işaretçisiyle gösterir (`external_lists`, imzacı parmak izi sabit).
 *
 * Kaynak: `registry-sandbox/pid-providers.source.json`. Yayıncı her yayında listeyi listenin kendi imzacısıyla (`pid-<cc>-list-signer`,
 * kendinden imzalı) yeniden imzalar; makamın test kökü (belge zincirinin çapası) hizmet sertifikası olarak listede görünür ve kök
 * özel anahtarı gerekmez (PP3). Hizmet türleri ETSI'nin PID URI'leridir (…/SvcType/PID/Issuance|Revocation); LoTEType ve şema
 * URI'leri Tamga sandbox köküdür — AB bildirimi iddiası yoktur, her kayıt devletin katılmadığını yazar (PP2).
 */
import { createHash } from "node:crypto";

export const PID_LOTE_ROOT = "https://trust.sandbox.tamga.network/lote";
const ETSI_PID = "http://uri.etsi.org/19602/SvcType/PID";

export interface PidProviderSource {
  list_id: string;
  /** ISO 3166-1 alfa-2 (listenin `SchemeTerritory`'si ve LOTL işaretçisinin `territory`'si) */
  territory: string;
  name: string;
  /** Kurumun sayfası (bilgi URI'si) ve belge verme erişim noktası */
  issuer_url: string;
  status_list_base: string;
  /** PKI adları: test kökü (Issuance hizmeti), iptal listesi imzacısı (Revocation hizmeti), liste imzacısı */
  root_cert: string;
  status_cert: string;
  list_signer: string;
  note: string;
}
export interface PidProvidersSource {
  operator: { name: string; note: string };
  next_update_days: number;
  providers: PidProviderSource[];
}

const en = (value: string) => [{ lang: "en", value }];
const enUri = (uriValue: string) => ({ lang: "en", uriValue });
const b64 = (der: Uint8Array) => Buffer.from(der).toString("base64");
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Kaynak kaydının biçim denetimi; sorun listesi (boşsa geçerli). */
export function pidSourceProblems(src: PidProvidersSource): string[] {
  const out: string[] = [];
  if (!src.operator?.name) out.push("operator.name yok");
  if (!Number.isInteger(src.next_update_days) || src.next_update_days < 1 || src.next_update_days > 180)
    out.push("next_update_days 1–180 tam sayı olmalı");
  const seen = new Set<string>();
  for (const p of src.providers ?? []) {
    const w = `pid provider ${String(p.list_id)}`;
    if (!/^sandbox-pid-[a-z]{2}$/.test(p.list_id ?? "")) out.push(`${w}: list_id sandbox-pid-<cc> biçiminde olmalı`);
    if (seen.has(p.list_id)) out.push(`${w}: yinelenen list_id`);
    seen.add(p.list_id);
    if (!/^[A-Z]{2}$/.test(p.territory ?? "")) out.push(`${w}: territory iki büyük harf olmalı`);
    else if (p.list_id !== `sandbox-pid-${p.territory.toLowerCase()}`)
      out.push(`${w}: list_id territory ile uyuşmuyor`);
    for (const u of [p.issuer_url, p.status_list_base])
      if (!/^https:\/\/[a-z0-9.-]+(\/.*)?$/.test(u ?? "")) out.push(`${w}: https adresi bekleniyor (${String(u)})`);
    // PP2: kayıt devletin katılmadığını yazar
    if (!/does not participate/i.test(p.note ?? "")) out.push(`${w}: note devletin katılmadığını yazmalı (PP2)`);
    if (!/\(representative\)/.test(p.name ?? "")) out.push(`${w}: ad "(representative)" taşımalı (ADR-0094 K2)`);
  }
  return out;
}

/** Tek sağlayıcının LoTE nesnesi (imzasız). */
export function buildPidLote(
  p: PidProviderSource,
  i: {
    operatorName: string;
    sequence: number;
    issuedAt: Date;
    nextUpdate: Date;
    rootDer: Uint8Array;
    statusDer: Uint8Array;
  },
) {
  const file = `https://trust.sandbox.tamga.network/external-src/${p.list_id}.jws`;
  const type = `${PID_LOTE_ROOT}/type/PIDProvidersList`;
  const name = `${p.name} (TEST)`;
  return {
    LoTE: {
      ListAndSchemeInformation: {
        LoTEVersionIdentifier: 1,
        LoTESequenceNumber: i.sequence,
        LoTEType: type,
        SchemeOperatorName: en(i.operatorName),
        SchemeName: en(`Tamga Network Sandbox — PID providers (${p.territory}, representative, TEST)`),
        SchemeInformationURI: [enUri("https://sandbox.tamga.network/")],
        StatusDeterminationApproach: `${PID_LOTE_ROOT}/status-determination/SandboxRepresentative`,
        SchemeTypeCommunityRules: [enUri("https://arf.tamga.network/trust-framework")],
        SchemeTerritory: p.territory,
        PolicyOrLegalNotice: [{ LoTELegalNotice: `Sandbox test list (ADR-0094). ${p.note}` }],
        ListIssueDateTime: iso(i.issuedAt),
        NextUpdate: iso(i.nextUpdate),
        DistributionPoints: [file],
      },
      TrustedEntitiesList: [
        {
          TrustedEntityInformation: { TEName: en(name), TEInformationURI: [enUri(p.issuer_url)] },
          TrustedEntityServices: [
            {
              ServiceInformation: {
                ServiceTypeIdentifier: `${ETSI_PID}/Issuance`,
                ServiceName: en(`${name} — PID issuance`),
                ServiceDigitalIdentity: { X509Certificates: [{ val: b64(i.rootDer) }] },
                ServiceSupplyPoints: [{ uriValue: p.issuer_url }],
              },
            },
            {
              ServiceInformation: {
                ServiceTypeIdentifier: `${ETSI_PID}/Revocation`,
                ServiceName: en(`${name} — status lists`),
                ServiceDigitalIdentity: { X509Certificates: [{ val: b64(i.statusDer) }] },
                ServiceSupplyPoints: [{ uriValue: p.status_list_base }],
              },
            },
          ],
        },
      ],
    },
  };
}

/** Compact JAdES başlığı (lote.ts `jadesHeader` ile aynı kural: x5t#S256 + iat; sigT yok). */
export function pidLoteHeader(signerDer: Uint8Array, signingTime: Date) {
  return {
    typ: undefined,
    cty: "application/json",
    "x5t#S256": createHash("sha256").update(signerDer).digest("base64url"),
    iat: Math.floor(signingTime.getTime() / 1000),
  };
}
