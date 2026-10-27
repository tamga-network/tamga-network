/**
 * ADR-0026 K5 — isteğin `verifier_info` içindeki kayıt sertifikaları (WRPRC, ETSI TS 119 475; OpenID4VP `registration_cert`).
 * Sıra: (1) typ + imza + imzacı LOTL'deki kayıt kurumu anahtarı, (2) iat/exp, (3) `sub` (aracılıda `intermediary.sub`) isteği
 * imzalayan erişim sertifikasındaki organizationIdentifier, (4) istenen alanlar sertifikanın `credentials` listesinde.
 * 1–3 tutmazsa `valid: false` → cüzdan veri göndermez (WRC4). 4 tutmazsa fazla istek (onay ekranında uyarı).
 *
 * ADR-0056 K10 (0.7.0; ADR-0026 K5'in 2026-10-13 geçiş kuralının yerine): kayıt sertifikası OLMAYAN istek bugünden REDDEDİLİR
 * (`valid: false`, `reason: "registration_missing"`) — 2028-08-11'e kadarki "uyarı + Paylaşma" geçişi kaldırıldı. Yakın alanda (ISO/IEC 18013-5) kayıt
 * sertifikası `requestInfo.euWrprc` ile CBOR biçiminde (`rc-wrp+cwt`) gelir; 1–4 aynı, 3'teki bağ okuyucunun kimlik doğrulama
 * sertifikasıyla (`readerAuth`) kurulur (`checkProximityRegistration`). 0.6.0 ön-yayın düzeltmesi: okuyucu sertifikası kendisi
 * güvene bağlanmadan (imzalı listenin `root_cas`'ı ya da tarafın kaydındaki parmak izi) sonuç hiçbir zaman geçerli değildir —
 * kayıt sertifikası herkese açıktır; kendinden imzalı, kurum kimliği kopyalanmış bir okuyucu sertifikası ona bağlanamaz.
 */
import { parseWrprcCwt, verifyReaderAuth, type DecodedItemsRequest } from "@tamga-network/mdoc";
import { b64Decode } from "./b64.js";
import { decodeJwt, verifyJwt } from "./jws.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import { certOrganizationIdentifier } from "./asn1.js";
import { chainAnchored, type TrustAnchor } from "./anchors.js";
import { fetchTrustSource, type TrustPins } from "./trustlist.js";
import type { Http } from "./http.js";
import type { Match, VpRequest } from "./oid4vp.js";
import { millisOrNow, type EpochMillis } from "@tamga-network/core/time";

export const WRPRC_TYP = "rc-wrp+jwt";
const SKEW_SEC = 60;

/** Onay ekranının işaretleri. `registration_missing`: istek kayıt sertifikası taşımıyor (ret nedeni). */
export type RegistrationFlag = "registration_missing";

/**
 * Kayıt sertifikası olmayan isteğin kuralı (ADR-0056 K10): ret (`valid: false`, `reason: "registration_missing"`); cüzdan veri
 * göndermez. Tarihe bağlı geçiş yoktur.
 */
export function missingRegistrationPolicy(): RegistrationCertCheck {
  return {
    present: false,
    valid: false,
    reason: "registration_missing",
    flags: ["registration_missing"],
    defaultChoice: "decline",
  };
}

export interface RegistrationCertCheck {
  /** istekte en az bir `registration_cert` var mı */
  present: boolean;
  /** hepsi 1–3'ü geçti mi. Sertifika yoksa (present=false) false (`reason: "registration_missing"`; ADR-0056 K10). */
  valid: boolean;
  reason?: string;
  /** 0.6.0: onay ekranı uyarıları (sertifika yoksa `registration_missing`) */
  flags?: RegistrationFlag[];
  /** onay ekranının varsayılan seçimi — sertifika yoksa "decline" (istek zaten geçersiz) */
  defaultChoice?: "share" | "decline";
  /** eşleşen belge için sertifikaların izin verdiği alanlar (yalnız valid ve ilgili sertifika varsa) */
  allowedClaims?: string[];
  tradeName?: string;
  privacyPolicy?: string;
  /**
   * Kullanımın amacı (ETSI TS 119 475 `purpose`, ARF intended use): onay ekranındaki "ne için" metninin imzalı kaynağı —
   * İngilizce (yoksa ilk dil) metin ve BCP 47 dil → metin çevirileri. OpenID4VP istek nesnesinde ayrı `purpose` yoktur (§5.1).
   */
  purpose?: string;
  purposeLocalized?: Record<string, string>;
}

export interface Wrprc {
  name?: string;
  sub?: string;
  /** ADR-0046 / ARF RPRC_17a: hizmet kimliği */
  service_id?: string;
  /** ETSI TS 119 475 Ek A yetki türü URI'leri */
  entitlements?: string[];
  iat?: number;
  exp?: number;
  privacy_policy?: string;
  /** ETSI TS 119 475: kullanımın amacı, dil başına (`value`; ETSI TS 119 602 biçimindeki `content` da okunur) */
  purpose?: Array<{ lang?: string; value?: string; content?: string }>;
  intermediary?: { sub?: string };
  credentials?: Array<{
    format?: string;
    meta?: { vct_values?: string[] };
    claim?: Array<{ path: unknown[] }>;
    claims?: Array<{ path: unknown[] }>;
  }>;
}

/** LOTL `roles.registrar.signing_keys` → etkin anahtar parmak izleri (liste imzası doğrulanmış, S-13). Alınamazsa boş. */
export async function fetchRegistrarKeys(
  trustBase: string,
  http: Http,
  pins: TrustPins,
  stateCode = "tr",
): Promise<string[]> {
  try {
    const { lists } = await fetchTrustSource(trustBase, http, { pins, stateCode });
    const nl = (lists.lotl as unknown as { national_lists?: Array<Record<string, unknown>> }).national_lists?.find(
      (n) => String(n.state_code).toLowerCase() === stateCode.toLowerCase(),
    );
    const keys = (
      nl?.roles as { registrar?: { signing_keys?: Array<{ fingerprint_sha256: string; status?: string }> } }
    )?.registrar?.signing_keys;
    return (keys ?? [])
      .filter((k) => !k.status || k.status === "ACTIVE")
      .map((k) => k.fingerprint_sha256.toLowerCase());
  } catch {
    return [];
  }
}

/** WRPRC ortak denetimi (K5 1–2): typ, imza, imzacı LOTL'deki kayıt kurumu anahtarı, iat/exp. */
export function verifyWrprc(
  data: unknown,
  registrarKeys: string[],
  nowMs?: EpochMillis,
): { ok: true; payload: Wrprc; signerDer: Uint8Array; chainDer: Uint8Array[] } | { ok: false; reason: string } {
  const now = millisOrNow(nowMs);
  if (typeof data !== "string") return { ok: false, reason: "registration certificate is not a JWT" };
  const nowSec = Math.floor(now / 1000);
  let payload: Wrprc;
  let der: Uint8Array;
  let chain: Uint8Array[];
  try {
    const d = decodeJwt(data);
    if (String(d.header.typ ?? "").toLowerCase() !== WRPRC_TYP)
      return { ok: false, reason: "registration certificate typ" };
    const x5c = d.header.x5c as string[] | undefined;
    if (!x5c?.length) return { ok: false, reason: "registration certificate without x5c" };
    chain = x5c.map((c) => b64Decode(c));
    der = chain[0];
    if (!registrarKeys.includes(certFingerprintHex(der)))
      return { ok: false, reason: "registration certificate not signed by a registrar in the trusted list" };
    verifyJwt(data, p256PointFromCertDer(der));
    payload = d.payload as Wrprc;
  } catch {
    return { ok: false, reason: "registration certificate signature invalid" };
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + SKEW_SEC)
    return { ok: false, reason: "registration certificate not yet valid" };
  if (typeof payload.exp === "number" && payload.exp <= nowSec)
    return { ok: false, reason: "registration certificate expired" };
  return { ok: true, payload, signerDer: der, chainDer: chain };
}

/**
 * ARF RPRC_22a/22b/23 — belge istemeden önce kurumun metadata'sındaki `issuer_info` (ETSI TS 119 472-3 §4.2.3):
 * `registrar_dataset.providesAttestations` istenen türü içermeli; `registration_cert` varsa geçerli olmalı (kayıt kurumu
 * imzası, süre) ve `provides_attestations` türü içermeli. `issuer_info` yoksa `present: false` (Tamga dışı kurum ya da eski).
 */
export function checkIssuerRegistration(
  metadata: { issuer_info?: unknown },
  vct: string,
  registrarKeys: string[],
  nowMs?: EpochMillis,
): { present: boolean; valid: boolean; reason?: string } {
  const now = millisOrNow(nowMs);
  const info = Array.isArray(metadata.issuer_info)
    ? (metadata.issuer_info as Array<{ format?: string; data?: unknown }>)
    : [];
  if (!info.length) return { present: false, valid: true };
  const lists = (x: unknown) =>
    ((x as Array<{ meta?: { vct_values?: string[] } }> | undefined) ?? []).some((a) =>
      a.meta?.vct_values?.includes(vct),
    );
  const ds = info.find((e) => e.format === "registrar_dataset")?.data as { providesAttestations?: unknown } | undefined;
  if (ds && !lists(ds.providesAttestations))
    return { present: true, valid: false, reason: "issuer is not registered for this credential type" };
  const cert = info.find((e) => e.format === "registration_cert");
  if (cert) {
    const v = verifyWrprc(cert.data, registrarKeys, now);
    if (!v.ok) return { present: true, valid: false, reason: v.reason };
    if (!lists((v.payload as { provides_attestations?: unknown }).provides_attestations))
      return { present: true, valid: false, reason: "registration certificate does not cover this credential type" };
  }
  return { present: true, valid: true };
}

/** Bu belge sorgusunu kapsayan, doğrulanmış kayıt sertifikası (yük + imza zinciri). */
export interface RelevantRegistrationCert {
  payload: Wrprc;
  /** kayıt sertifikasını imzalayan zincir (x5c; yaprak ilk) */
  chainDer: Uint8Array[];
}

/**
 * K5 1–3 denetimi + bu sorguyu kapsayan sertifikalar (`credential_ids` yoksa hepsi; AB profili istek başına tek sertifika ve
 * `credential_ids`'siz gönderir — ETSI TS 119 472-2 RO-13…16 — başka doğrulayıcıların `credential_ids`'li isteği de okunur). Bir sertifika bile 1–3'ü geçmezse
 * `valid: false` (WRC4). Gömülü açıklama politikası (ADR-0046 K3) aynı sertifikalarla değerlendirilir.
 */
export function relevantRegistrationCerts(
  req: VpRequest,
  registrarKeys: string[],
  match: Pick<Match, "queryId">,
  nowMs?: EpochMillis,
): { present: boolean; valid: boolean; reason?: string; certs: RelevantRegistrationCert[] } {
  const now = millisOrNow(nowMs);
  // ISO/IEC 18013-7 Ek C: kayıt sertifikası DeviceRequest'te (`requestInfo.euWrprc`, CBOR); bağ okuyucu imzasının yaprağıyla
  // (`req.leafDer` — `parseDcApiMdocRequest` bu oturumun dökümüyle doğruladı). İstek başına tek sertifika, isteğin bütününe ait.
  if (req.annexC) {
    const cwt = req.annexC.registrationCwt;
    if (!cwt) return { present: false, valid: true, certs: [] };
    const v = verifyWrprcCwt(cwt, registrarKeys, now);
    if (!v.ok) return { present: true, valid: false, reason: v.reason, certs: [] };
    let org: string | null;
    try {
      org = certOrganizationIdentifier(req.leafDer);
    } catch {
      org = null;
    }
    const sub = v.payload.intermediary?.sub ?? v.payload.sub;
    if (!org || !sub || org !== sub)
      return {
        present: true,
        valid: false,
        reason: "registration certificate does not belong to the reader's certificate",
        certs: [],
      };
    return { present: true, valid: true, certs: [{ payload: v.payload, chainDer: v.chainDer }] };
  }
  const info = (req.payload as { verifier_info?: unknown }).verifier_info;
  const entries = Array.isArray(info)
    ? (info as Array<{ format?: string; data?: unknown; credential_ids?: string[] }>).filter(
        (e) => e?.format === "registration_cert",
      )
    : [];
  if (!entries.length) return { present: false, valid: true, certs: [] };
  const fail = (reason: string) => ({ present: true, valid: false, reason, certs: [] });
  let orgId: string | null;
  try {
    orgId = certOrganizationIdentifier(req.leafDer);
  } catch {
    orgId = null;
  }
  const certs: RelevantRegistrationCert[] = [];
  for (const e of entries) {
    const v = verifyWrprc(e.data, registrarKeys, now);
    if (!v.ok) return fail(v.reason);
    const payload = v.payload;
    const expectedSub = payload.intermediary?.sub ?? payload.sub;
    if (!orgId || !expectedSub || orgId !== expectedSub)
      return fail("registration certificate does not belong to the certificate that signed the request");
    if (!e.credential_ids?.length || e.credential_ids.includes(match.queryId))
      certs.push({ payload, chainDer: v.chainDer });
  }
  return { present: true, valid: true, certs };
}

/**
 * İstek bir kayıt sertifikası taşıyor mu (OpenID4VP `verifier_info.registration_cert` ya da Ek C `requestInfo.euWrprc`). Taşımıyorsa
 * ADR-0056 K10 gereği istek reddedilir (`missingRegistrationPolicy`).
 */
export function hasRegistrationCert(req: VpRequest): boolean {
  if (req.annexC) return !!req.annexC.registrationCwt;
  const info = (req.payload as { verifier_info?: unknown }).verifier_info;
  return Array.isArray(info) && info.some((e) => (e as { format?: unknown } | null)?.format === "registration_cert");
}

export function checkRegistrationCerts(
  req: VpRequest,
  registrarKeys: string[],
  match: Match,
  nowMs?: EpochMillis,
): RegistrationCertCheck {
  const now = millisOrNow(nowMs);
  const r = relevantRegistrationCerts(req, registrarKeys, match, now);
  if (!r.present) return missingRegistrationPolicy();
  if (!r.valid) return { present: true, valid: false, reason: r.reason };
  const relevant = r.certs.map((c) => c.payload);
  const allowed = new Set<string>();
  for (const p of relevant)
    for (const c of p.credentials ?? []) {
      // mdoc kaydı (`doctype_value`, yol [ad alanı, öğe]) ya da SD-JWT kaydı (`vct_values`, yol [ad, …])
      const docType = (c.meta as { doctype_value?: string } | undefined)?.doctype_value;
      const mdoc = c.format === "mso_mdoc" || docType !== undefined;
      const applies = mdoc
        ? docType === undefined || docType === match.credential.vct
        : !c.meta?.vct_values || c.meta.vct_values.includes(match.credential.vct);
      if (!applies) continue;
      for (const cl of c.claim ?? c.claims ?? []) {
        const name = mdoc && (cl.path?.length ?? 0) >= 2 ? cl.path[1] : cl.path?.[0];
        if (typeof name === "string") allowed.add(name);
      }
    }
  return {
    present: true,
    valid: true,
    ...(relevant.length ? { allowedClaims: [...allowed] } : {}),
    tradeName: relevant[0]?.name,
    privacyPolicy: relevant[0]?.privacy_policy,
    ...purposeOf(relevant[0]),
  };
}

// ------------------------------------------------------------------ yakın alan (ISO/IEC 18013-5) — ADR-0026 K5, 0.6.0

/** CBOR biçimli kayıt sertifikası (`rc-wrp+cwt`): typ + imza + imzacı kayıt kurumu (1) ve süre (2); JWT biçimiyle aynı yük. */
export function verifyWrprcCwt(
  bytes: unknown,
  registrarKeys: string[],
  nowMs?: EpochMillis,
): { ok: true; payload: Wrprc; signerDer: Uint8Array; chainDer: Uint8Array[] } | { ok: false; reason: string } {
  const now = millisOrNow(nowMs);
  if (!(bytes instanceof Uint8Array))
    return { ok: false, reason: "registration certificate is not a CBOR byte string" };
  let payload: Wrprc;
  let chain: Uint8Array[];
  try {
    const r = parseWrprcCwt(bytes, p256PointFromCertDer);
    chain = r.chainDer;
    payload = r.payload as Wrprc;
  } catch (e) {
    const m = (e as Error).message;
    return {
      ok: false,
      reason: /typ/.test(m) ? "registration certificate typ" : "registration certificate signature invalid",
    };
  }
  if (!registrarKeys.includes(certFingerprintHex(chain[0])))
    return { ok: false, reason: "registration certificate not signed by a registrar in the trusted list" };
  const nowSec = Math.floor(now / 1000);
  if (typeof payload.iat !== "number" || payload.iat > nowSec + SKEW_SEC)
    return { ok: false, reason: "registration certificate not yet valid" };
  if (typeof payload.exp === "number" && payload.exp <= nowSec)
    return { ok: false, reason: "registration certificate expired" };
  return { ok: true, payload, signerDer: chain[0], chainDer: chain };
}

export interface ProximityRegistrationCheck extends RegistrationCertCheck {
  /**
   * Okuyucunun kimlik doğrulama sertifikası zinciri (`readerAuth` geçerliyse; yaprak ilk). Okuyucunun kim olduğu (güven listesindeki
   * kayıt, `fetchRpRecord` / `checkRp`) yaprağın parmak izinden uygulamada çözülür.
   */
  readerChainDer?: Uint8Array[];
  readerCertFingerprint?: string;
  /** okuyucu sertifikası güvene bağlı mı (`ReaderTrust`); `readerAuth` yoksa alan yok */
  readerTrusted?: boolean;
}

/**
 * Okuyucu sertifikasının güven çapaları (ZORUNLU parametre). `trustAnchors`: imzalı listenin `root_cas` sertifikaları (kök x5c'de
 * olmadığında son sertifikanın veren imzası çapa sertifikasıyla doğrulanır) ya da parmak izleri. `registeredFingerprints`: okuyucu
 * tarafının imzalı listedeki kaydında sabitlenmiş yaprak sertifika parmak izleri (SHA-256 onaltılık; RP kaydının x509 parmak
 * izleri). İkisi de boşsa kayıt sertifikalı istek `untrusted_reader_certificate` ile geçersizdir.
 */
export interface ReaderTrust {
  trustAnchors: TrustAnchor[];
  registeredFingerprints?: string[];
}

/**
 * Yakın alan isteğinin kayıt sertifikası (ADR-0026 K5): `requestInfo.euWrprc` varsa uzaktan akıştaki 1–4 — (1) typ `rc-wrp+cwt`, imza,
 * imzacı kayıt kurumu; (2) süre; (3) `sub` (aracılıda `intermediary.sub`) = okuyucunun `readerAuth` sertifikasındaki
 * organizationIdentifier (okuyucu imzası bu oturumun dökümüyle doğrulanır; imzasız istekte bağ kurulamaz → geçersiz); (4) istenen
 * öğeler sertifikanın `credentials` listesinde (`allowedClaims`; fazlası onay ekranında uyarı). `euWrprc` yoksa
 * `missingRegistrationPolicy` (ret; ADR-0056 K10). `transcript` = oturumun SessionTranscript baytları.
 * `readerTrust` (zorunlu): okuyucu sertifikası bunlardan birine bağlanmadan geçerli sonuç dönmez (`untrusted_reader_certificate`).
 * Cüzdandan cüzdana (TS9) bu işlev çağrılmaz: karşı tarafın okuyucu sertifikası yoktur (STS9_30 bekliyor) — `presentProximity`
 * `registrarKeys: false` ile denetimi atlar ("kayıt yok").
 */
export function checkProximityRegistration(
  item: DecodedItemsRequest,
  transcript: Uint8Array,
  registrarKeys: string[],
  readerTrust: ReaderTrust,
  nowMs?: EpochMillis,
): ProximityRegistrationCheck {
  const now = millisOrNow(nowMs);
  const reader = item.readerAuth
    ? verifyReaderAuth(item.readerAuth, transcript, item.itemsRequestBytes, p256PointFromCertDer)
    : null;
  const readerTrusted = reader ? chainAnchored(reader.chainDer, readerTrust) : false;
  const readerInfo = reader
    ? { readerChainDer: reader.chainDer, readerCertFingerprint: certFingerprintHex(reader.chainDer[0]), readerTrusted }
    : {};
  const cert = item.requestInfo?.euWrprc;
  if (cert === undefined) return { ...missingRegistrationPolicy(), ...readerInfo };
  const fail = (reason: string): ProximityRegistrationCheck => ({ present: true, valid: false, reason, ...readerInfo });
  const v = verifyWrprcCwt(cert, registrarKeys, now);
  if (!v.ok) return fail(v.reason);
  if (!reader) return fail("registration certificate without a valid reader authentication");
  let orgId: string | null;
  try {
    orgId = certOrganizationIdentifier(reader.chainDer[0]);
  } catch {
    orgId = null;
  }
  const expectedSub = v.payload.intermediary?.sub ?? v.payload.sub;
  if (!orgId || !expectedSub || orgId !== expectedSub)
    return fail("registration certificate does not belong to the reader's certificate");
  // okuyucu sertifikasının kendisi güvene bağlı olmalı: aksi hâlde kayıtlı bir kurumun kimliğini taşıyan kendinden imzalı sertifika
  // + o kurumun herkese açık kayıt sertifikası "doğrulanmış ticari ad" gösterirdi
  if (!readerTrusted) return fail("untrusted_reader_certificate");
  const allowed = new Set<string>();
  for (const c of v.payload.credentials ?? [])
    if (!c.meta?.vct_values && !(c as { meta?: { doctype_value?: string } }).meta?.doctype_value) {
      for (const cl of c.claim ?? c.claims ?? []) addClaimPath(allowed, cl.path);
    } else if (
      c.meta?.vct_values?.includes(item.docType) ||
      (c as { meta?: { doctype_value?: string } }).meta?.doctype_value === item.docType
    )
      for (const cl of c.claim ?? c.claims ?? []) addClaimPath(allowed, cl.path);
  return {
    present: true,
    valid: true,
    allowedClaims: [...allowed],
    tradeName: v.payload.name,
    privacyPolicy: v.payload.privacy_policy,
    ...purposeOf(v.payload),
    ...readerInfo,
  };
}
/** Sertifikanın `purpose` dizisi → `{ purpose, purposeLocalized }` (İngilizce ya da ilk metin kanonik). Yoksa boş. */
function purposeOf(c: Wrprc | undefined): Pick<RegistrationCertCheck, "purpose" | "purposeLocalized"> {
  const items = (Array.isArray(c?.purpose) ? c.purpose : [])
    .map((x) => ({ lang: typeof x?.lang === "string" ? x.lang : "", text: x?.value ?? x?.content }))
    .filter((x): x is { lang: string; text: string } => typeof x.text === "string" && x.text.length > 0);
  if (!items.length) return {};
  const canonical = items.find((x) => x.lang.toLowerCase().startsWith("en")) ?? items[0];
  const localized = Object.fromEntries(items.filter((x) => x.lang).map((x) => [x.lang, x.text]));
  return { purpose: canonical.text, ...(Object.keys(localized).length ? { purposeLocalized: localized } : {}) };
}

/** DCQL yolu: SD-JWT `[ad]`, mdoc `[ad alanı, öğe]` — öğe adı eklenir. */
function addClaimPath(out: Set<string>, path: unknown[] | undefined) {
  if (!path?.length) return;
  const last = path.length >= 2 ? path[1] : path[0];
  if (typeof last === "string") out.add(last);
}
