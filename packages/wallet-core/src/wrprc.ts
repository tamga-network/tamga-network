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
 *
 * 0.8.3 (ikinci inceleme; ADR-0056 MR5 / ADR-0026 WRC4): aynı kural uzak akışta ve Ek C'de — `checkRegistrationCerts` /
 * `relevantRegistrationCerts` isteği imzalayan erişim sertifikasının güvenini (`signerTrust`: RP kaydındaki parmak izi ve/veya
 * `root_cas`) alır; verilmişse yaprak ona bağlanmadan sonuç geçerli olmaz (`untrusted_access_certificate`). Verilmemişse sonuç
 * `signerTrusted: false` ve `registration_binding_unverified` işaretini taşır: 3. adım yalnız metin eşitliğidir, bağ doğrulanmış
 * DEĞİLDİR. Ayrıca `exp` taşımayan sertifika reddedilir (ADR-0026 K4: `iat` ≤ şimdi < `exp`).
 */
import { parseWrprcCwt, verifyReaderAuth, type DecodedItemsRequest } from "@tamga-network/mdoc";
import { b64Decode } from "./b64.js";
import { decodeJwt, verifyJwt } from "./jws.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import { certOrganizationIdentifier } from "./asn1.js";
import { chainAnchored, type TrustAnchor } from "./anchors.js";
import { fetchTrustSource, type TrustPins, type VerifiedTrust } from "./trustlist.js";
import type { Http } from "./http.js";
import type { Match, TrustFetchOptions, VpRequest } from "./oid4vp.js";
import { millisOrNow, type EpochMillis } from "@tamga-network/core/time";
import {
  hasMalformedStatus,
  wrprcStatusRef,
  type RegistrationStatus,
  type RegistrationStatusLookup,
  type WrprcStatusRef,
} from "./wrprc-status.js";

export const WRPRC_TYP = "rc-wrp+jwt";
const SKEW_SEC = 60;

/**
 * Onay ekranının işaretleri. `registration_missing`: istek kayıt sertifikası taşımıyor (ret nedeni).
 * `registration_status_unknown` (ADR-0068 K5): sertifikanın iptal durumu denetlenemedi (durum listesi alınamadı, süresi dolmuş
 * kopya ya da durumlar verilmedi) — uyarı; sertifika iptal edilmişse sonuç zaten geçersizdir.
 * `registration_binding_unverified` (0.8.3): çağıran isteği imzalayan erişim sertifikasının güvenini (`signerTrust`) vermedi —
 * sertifikanın bu isteğe ait olduğu yalnız `organizationIdentifier` metin eşitliğiyle görüldü; kendinden imzalı bir kopya da bu
 * eşitliği sağlar. Bu işaret varken ticari ad / amaç "doğrulanmış" diye gösterilmemeli ve veri gönderilmemelidir (WRC4).
 */
export type RegistrationFlag =
  "registration_missing" | "registration_status_unknown" | "registration_binding_unverified";

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
  /**
   * 0.8.3: isteği imzalayan erişim sertifikası (Ek C'de okuyucu sertifikası) güvene bağlandı mı — `signerTrust` verildi ve yaprak
   * RP kaydındaki parmak iziyle eşleşti ya da zinciri `root_cas`'a bağlandı. `false`: `signerTrust` verilmedi, bağ doğrulanmadı
   * (`flags` `registration_binding_unverified` taşır). Sertifika yoksa ya da geçersizse alan yok.
   */
  signerTrusted?: boolean;
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
  /** ADR-0068 / ETSI TS 119 475 §6.1.3: politika kimlikleri (OID) ve politika belgesinin adresi */
  policy_id?: string[];
  certificate_policy?: string;
  /** ADR-0068 / TS 119 475 GEN-6.2.6.1-04: kayıt kurumunun durum listesindeki girdi */
  status?: { status_list?: { idx?: number | string; uri?: string } };
  credentials?: Array<{
    format?: string;
    meta?: { vct_values?: string[] };
    claim?: Array<{ path: unknown[] }>;
    claims?: Array<{ path: unknown[] }>;
  }>;
}

/**
 * İmzası doğrulanmış LOTL'dan (`fetchTrustSource(...).lists`) bir ülkenin kayıt kurumu imza anahtarları:
 * `roles.registrar.signing_keys` → etkin anahtar parmak izleri (küçük harf). Ağ isteği yok, hata yutma yok — boş dizi yalnız
 * "bu ülke için etkin kayıt kurumu anahtarı yok" demektir (0.8.3; "liste alınamadı" çağıranın ayrı durumudur).
 */
export function registrarKeysOf(lists: Pick<VerifiedTrust, "lotl">, stateCode = "tr"): string[] {
  const nl = (lists.lotl as unknown as { national_lists?: Array<Record<string, unknown>> }).national_lists?.find(
    (n) => String(n.state_code).toLowerCase() === stateCode.toLowerCase(),
  );
  const keys = (nl?.roles as { registrar?: { signing_keys?: Array<{ fingerprint_sha256: string; status?: string }> } })
    ?.registrar?.signing_keys;
  return (keys ?? []).filter((k) => !k.status || k.status === "ACTIVE").map((k) => k.fingerprint_sha256.toLowerCase());
}

/**
 * LOTL `roles.registrar.signing_keys` → etkin anahtar parmak izleri (liste imzası doğrulanmış, S-13); `registrarKeysOf`'un
 * listeyi kendisi yükleyen ince sarmalayıcısı. Liste alınamaz ya da doğrulanamazsa boş dizi — iki durumu ayırmak için
 * `{ throwOnListError: true }` (hata fırlatılır) ya da listeyi bir kez yükleyip `registrarKeysOf` kullanın.
 */
export async function fetchRegistrarKeys(
  trustBase: string,
  http: Http,
  pins: TrustPins,
  stateCode = "tr",
  opts: TrustFetchOptions = {},
): Promise<string[]> {
  let lists: VerifiedTrust;
  try {
    ({ lists } = await fetchTrustSource(trustBase, http, { pins, stateCode }));
  } catch (e) {
    if (opts.throwOnListError) throw e;
    return [];
  }
  return registrarKeysOf(lists, stateCode);
}

/** base64url → UTF-8 metin; geçersizse null. */
function base64urlText(v: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(v)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b64Decode(v));
  } catch {
    return null;
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
  // ETSI TS 119 472-2 V1.3.1 RO-16 "base64url encoding of the serialized registration certificate": kimi doğrulayıcı JWT'yi olduğu
  // gibi koyar (AB referans uygulaması, Tamga Verify), kimi JWT'nin base64url kodlamasını (eudi-dev 3.5.0; K2 2026-10-29). İkisi
  // de okunur: noktasız değer base64url çözülür ve çözülen JWT ise o kullanılır.
  let jwt: string = data;
  if (!jwt.includes(".")) {
    const inner = base64urlText(jwt);
    if (inner && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(inner)) jwt = inner;
  }
  const nowSec = Math.floor(now / 1000);
  let payload: Wrprc;
  let der: Uint8Array;
  let chain: Uint8Array[];
  try {
    const d = decodeJwt(jwt);
    if (String(d.header.typ ?? "").toLowerCase() !== WRPRC_TYP)
      return { ok: false, reason: "registration certificate typ" };
    const x5c = d.header.x5c as string[] | undefined;
    if (!x5c?.length) return { ok: false, reason: "registration certificate without x5c" };
    chain = x5c.map((c) => b64Decode(c));
    der = chain[0];
    if (!registrarKeys.includes(certFingerprintHex(der)))
      return { ok: false, reason: "registration certificate not signed by a registrar in the trusted list" };
    verifyJwt(jwt, p256PointFromCertDer(der));
    payload = d.payload as Wrprc;
  } catch {
    return { ok: false, reason: "registration certificate signature invalid" };
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + SKEW_SEC)
    return { ok: false, reason: "registration certificate not yet valid" };
  // ADR-0026 K4: `iat` ≤ şimdi < `exp` — `exp` taşımayan (ya da sayı olmayan) sertifika süresiz sayılmaz, reddedilir (0.8.3)
  if (typeof payload.exp !== "number") return { ok: false, reason: "registration certificate without exp" };
  if (payload.exp <= nowSec) return { ok: false, reason: "registration certificate expired" };
  const shape = shapeProblem(payload);
  if (shape) return { ok: false, reason: shape };
  return { ok: true, payload, signerDer: der, chainDer: chain };
}

/** ADR-0068: `status` ve `policy_id` varsa biçimleri okunabilir olmalı (bozuk durum girdisi iptal denetimini atlatmasın). */
function shapeProblem(p: Wrprc): string | null {
  if (hasMalformedStatus(p)) return "registration certificate status malformed";
  if (p.policy_id !== undefined && (!Array.isArray(p.policy_id) || p.policy_id.some((x) => typeof x !== "string")))
    return "registration certificate policy_id malformed";
  return null;
}

/**
 * ADR-0068 K5: sertifikanın durum sonucu. Durum alanı yoksa `"none"` (durum listesi tutmayan kayıt kurumu); durumlar
 * verilmediyse `"unknown"`.
 */
export function registrationStatusOf(p: Wrprc, statuses?: RegistrationStatusLookup): RegistrationStatus | "none" {
  const ref = wrprcStatusRef(p);
  if (!ref) return "none";
  return statuses ? statuses(ref) : "unknown";
}

/**
 * İstekteki (OpenID4VP `verifier_info` ya da Ek C `euWrprc`) imzası ve süresi geçerli kayıt sertifikalarının durum girdileri —
 * `fetchRegistrationStatuses`'a verilir. Geçersiz sertifika atlanır (denetimde zaten reddedilir).
 */
export function registrationStatusRefs(req: VpRequest, registrarKeys: string[], nowMs?: EpochMillis): WrprcStatusRef[] {
  const now = millisOrNow(nowMs);
  const payloads: Wrprc[] = [];
  if (req.annexC) {
    if (req.annexC.registrationCwt) {
      const v = verifyWrprcCwt(req.annexC.registrationCwt, registrarKeys, now);
      if (v.ok) payloads.push(v.payload);
    }
  } else {
    const info = (req.payload as { verifier_info?: unknown }).verifier_info;
    for (const e of Array.isArray(info) ? (info as Array<{ format?: string; data?: unknown }>) : [])
      if (e?.format === "registration_cert") {
        const v = verifyWrprc(e.data, registrarKeys, now);
        if (v.ok) payloads.push(v.payload);
      }
  }
  return payloads.map((p) => wrprcStatusRef(p)).filter((r): r is WrprcStatusRef => !!r);
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
  /** ADR-0068 K5: `fetchRegistrationStatuses` sonucu; verilmezse durum "denetlenemedi" (`statusUnknown`) */
  statuses?: RegistrationStatusLookup,
): { present: boolean; valid: boolean; reason?: string; statusUnknown?: boolean } {
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
    // ARF §6.6.3.3: iptal edilmiş kayıt sertifikası → belge istenmez
    const st = registrationStatusOf(v.payload, statuses);
    if (st === "revoked") return { present: true, valid: false, reason: "registration certificate revoked" };
    if (st === "unknown") return { present: true, valid: true, statusUnknown: true };
  }
  return { present: true, valid: true };
}

/** Belge verenin metadata'sındaki (`issuer_info`) geçerli kayıt sertifikasının durum girdisi (ADR-0068 K5); yoksa boş. */
export function issuerRegistrationStatusRefs(
  metadata: { issuer_info?: unknown },
  registrarKeys: string[],
  nowMs?: EpochMillis,
): WrprcStatusRef[] {
  const info = Array.isArray(metadata.issuer_info)
    ? (metadata.issuer_info as Array<{ format?: string; data?: unknown }>)
    : [];
  const out: WrprcStatusRef[] = [];
  for (const e of info)
    if (e?.format === "registration_cert") {
      const v = verifyWrprc(e.data, registrarKeys, nowMs);
      const ref = v.ok ? wrprcStatusRef(v.payload) : null;
      if (ref) out.push(ref);
    }
  return out;
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
 *
 * `signerTrust` (0.8.3; MR5 / WRC4): isteği imzalayan erişim sertifikasının (Ek C'de okuyucu sertifikasının) güveni — güven
 * listesindeki RP kaydının erişim sertifikası parmak izi (`registeredFingerprints`) ve/veya imzalı listenin `root_cas`'ı
 * (`trustAnchors`). Verilmişse yaprak bunlardan birine bağlanmadan sonuç geçerli olmaz (`untrusted_access_certificate`; boş
 * nesne = kayıt yok → geçersiz). Verilmemişse `signerTrusted: false` döner: bağ yalnız metin eşitliğidir, doğrulanmamıştır.
 */
export function relevantRegistrationCerts(
  req: VpRequest,
  registrarKeys: string[],
  match: Pick<Match, "queryId">,
  nowMs?: EpochMillis,
  /** ADR-0068 K5: `fetchRegistrationStatuses` sonucu; iptal → geçersiz, denetlenemedi → `statusUnknown` */
  statuses?: RegistrationStatusLookup,
  signerTrust?: Partial<ReaderTrust>,
): {
  present: boolean;
  valid: boolean;
  reason?: string;
  certs: RelevantRegistrationCert[];
  statusUnknown?: boolean;
  /** yalnız `valid: true` iken: erişim sertifikası güvene bağlandı mı (`signerTrust` verilmediyse `false`) */
  signerTrusted?: boolean;
} {
  const now = millisOrNow(nowMs);
  // kayıt sertifikası herkese açıktır: kendinden imzalı, kurum kimliği kopyalanmış bir erişim sertifikası 3. adımın metin
  // eşitliğini sağlar — yaprak güvene bağlanmadan sertifika bu isteğe "ait" sayılmaz (yakın alandaki kuralın aynısı)
  const signerTrusted = signerTrust
    ? chainAnchored(req.chainDer?.length ? req.chainDer : [req.leafDer], signerTrust)
    : false;
  const untrusted = !!signerTrust && !signerTrusted;
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
    if (untrusted) return { present: true, valid: false, reason: "untrusted_access_certificate", certs: [] };
    const st = registrationStatusOf(v.payload, statuses);
    if (st === "revoked") return { present: true, valid: false, reason: "registration certificate revoked", certs: [] };
    return {
      present: true,
      valid: true,
      signerTrusted,
      certs: [{ payload: v.payload, chainDer: v.chainDer }],
      ...(st === "unknown" ? { statusUnknown: true } : {}),
    };
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
  let statusUnknown = false;
  for (const e of entries) {
    const v = verifyWrprc(e.data, registrarKeys, now);
    if (!v.ok) return fail(v.reason);
    const payload = v.payload;
    const expectedSub = payload.intermediary?.sub ?? payload.sub;
    if (!orgId || !expectedSub || orgId !== expectedSub)
      return fail("registration certificate does not belong to the certificate that signed the request");
    if (untrusted) return fail("untrusted_access_certificate");
    // ADR-0068 K5: iptal edilmiş sertifika isteği bütünüyle geçersiz kılar (WRC4)
    const st = registrationStatusOf(payload, statuses);
    if (st === "revoked") return fail("registration certificate revoked");
    if (st === "unknown") statusUnknown = true;
    if (!e.credential_ids?.length || e.credential_ids.includes(match.queryId))
      certs.push({ payload, chainDer: v.chainDer });
  }
  return { present: true, valid: true, signerTrusted, certs, ...(statusUnknown ? { statusUnknown } : {}) };
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

/**
 * Uzak akışın (OpenID4VP `verifier_info`) ve Ek C'nin (`requestInfo.euWrprc`) kayıt sertifikası denetimi: K5 1–3 + izinli alanlar.
 * `signerTrust` (0.8.3) VERİLMELİDİR: güven listesindeki RP kaydının erişim sertifikası parmak izi
 * (`{ registeredFingerprints: [rp.access_cert_fingerprint_sha256] }`; kayıt yoksa `{}`) ve/veya `root_cas` çapaları. Verilirse
 * yaprak ona bağlanmadan `valid: true` dönmez. Verilmezse (0.8.2 çağrı biçimi) sonuç `signerTrusted: false` ve
 * `registration_binding_unverified` işaretini taşır — çağıran bunu "geçerli" saymamalıdır (WRC4).
 */
export function checkRegistrationCerts(
  req: VpRequest,
  registrarKeys: string[],
  match: Match,
  nowMs?: EpochMillis,
  /** ADR-0068 K5: `fetchRegistrationStatuses(registrationStatusRefs(req, …), …)` sonucu */
  statuses?: RegistrationStatusLookup,
  signerTrust?: Partial<ReaderTrust>,
): RegistrationCertCheck {
  const now = millisOrNow(nowMs);
  const r = relevantRegistrationCerts(req, registrarKeys, match, now, statuses, signerTrust);
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
      // mdoc: ad alanı + öğe ÇİFTİ karşılaştırılır (güvenlik #8, 2026-11-04): sertifika `[ns1, family_name]` izni verdiyse
      // `[ns2, family_name]` isteği kapsam içinde sayılmaz. Eşleşmenin ad alanı (`match.namespace`) yoksa mdoc izni verilmez.
      for (const cl of c.claim ?? c.claims ?? [])
        if (mdoc) addClaimPath(allowed, cl.path, match.namespace ?? null);
        else if (typeof cl.path?.[0] === "string") allowed.add(cl.path[0]);
    }
  const flags: RegistrationFlag[] = [
    ...(r.statusUnknown ? (["registration_status_unknown"] as const) : []),
    ...(r.signerTrusted ? [] : (["registration_binding_unverified"] as const)),
  ];
  return {
    present: true,
    valid: true,
    signerTrusted: r.signerTrusted === true,
    ...(flags.length ? { flags } : {}),
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
  // ADR-0026 K4: `iat` ≤ şimdi < `exp` — `exp` taşımayan (ya da sayı olmayan) sertifika süresiz sayılmaz, reddedilir (0.8.3)
  if (typeof payload.exp !== "number") return { ok: false, reason: "registration certificate without exp" };
  if (payload.exp <= nowSec) return { ok: false, reason: "registration certificate expired" };
  const shape = shapeProblem(payload);
  if (shape) return { ok: false, reason: shape };
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
  /** ADR-0068 K5: önceden çekilmiş (çevrimdışıysa önbellekteki) durumlar */
  statuses?: RegistrationStatusLookup,
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
  const st = registrationStatusOf(v.payload, statuses);
  if (st === "revoked") return fail("registration certificate revoked");
  // izin verilen öğeler isteğin ad alanında (kişiye gösterilen ve açıklanan ilk ad alanı, `presentProximity`): ad alanı + öğe
  // çifti karşılaştırılır (güvenlik #8, 2026-11-04)
  const namespace = Object.keys(item.nameSpaces ?? {})[0] ?? null;
  const allowed = new Set<string>();
  for (const c of v.payload.credentials ?? [])
    if (!c.meta?.vct_values && !(c as { meta?: { doctype_value?: string } }).meta?.doctype_value) {
      for (const cl of c.claim ?? c.claims ?? []) addClaimPath(allowed, cl.path, namespace);
    } else if (
      c.meta?.vct_values?.includes(item.docType) ||
      (c as { meta?: { doctype_value?: string } }).meta?.doctype_value === item.docType
    )
      for (const cl of c.claim ?? c.claims ?? []) addClaimPath(allowed, cl.path, namespace);
  return {
    present: true,
    valid: true,
    ...(st === "unknown" ? { flags: ["registration_status_unknown"] as RegistrationFlag[] } : {}),
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

/**
 * mdoc kaydının DCQL yolu `[ad alanı, öğe]` — öğe adı eklenir. Ad alanı isteğinkiyle (`namespace`) aynı olmalıdır (güvenlik #8:
 * ad alanı + öğe çifti; başka ad alanındaki aynı adlı öğe kapsam dışı). `namespace` null ise hiçbir şey eklenmez (ihtiyatlı).
 * Ad alanı taşımayan tek elemanlı yol (`[öğe]`) mdoc kaydında izin VERMEZ (2026-11-04): hangi ad alanındaki öğeye izin verildiği
 * belirsizdir.
 */
function addClaimPath(out: Set<string>, path: unknown[] | undefined, namespace: string | null) {
  if (!path || path.length < 2) return;
  if (namespace === null || path[0] !== namespace) return;
  if (typeof path[1] === "string") out.add(path[1]);
}
