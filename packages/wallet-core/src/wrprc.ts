/**
 * ADR-0026 K5 — isteğin `verifier_info` içindeki kayıt sertifikaları (WRPRC, ETSI TS 119 475; OpenID4VP `registration_cert`).
 * Sıra: (1) typ + imza + imzacı LOTL'deki kayıt kurumu anahtarı, (2) iat/exp, (3) `sub` (aracılıda `intermediary.sub`) isteği
 * imzalayan erişim sertifikasındaki organizationIdentifier, (4) istenen alanlar sertifikanın `credentials` listesinde.
 * 1–3 tutmazsa `valid: false` → cüzdan veri göndermez (WRC4). 4 tutmazsa fazla istek (onay ekranında uyarı).
 */
import { b64Decode } from "./b64.js";
import { decodeJwt, verifyJwt } from "./jws.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import { certOrganizationIdentifier } from "./asn1.js";
import { fetchTrustSource, type TrustPins } from "./trustlist.js";
import type { Http } from "./http.js";
import type { Match, VpRequest } from "./oid4vp.js";

export const WRPRC_TYP = "rc-wrp+jwt";
const SKEW_SEC = 60;

export interface RegistrationCertCheck {
  /** istekte en az bir `registration_cert` var mı */
  present: boolean;
  /** hepsi 1–3'ü geçti mi (present=false ise true) */
  valid: boolean;
  reason?: string;
  /** eşleşen belge için sertifikaların izin verdiği alanlar (yalnız valid ve ilgili sertifika varsa) */
  allowedClaims?: string[];
  tradeName?: string;
  privacyPolicy?: string;
}

interface Wrprc {
  name?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  privacy_policy?: string;
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
  now = Date.now(),
): { ok: true; payload: Wrprc; signerDer: Uint8Array } | { ok: false; reason: string } {
  if (typeof data !== "string") return { ok: false, reason: "registration certificate is not a JWT" };
  const nowSec = Math.floor(now / 1000);
  let payload: Wrprc;
  let der: Uint8Array;
  try {
    const d = decodeJwt(data);
    if (String(d.header.typ ?? "").toLowerCase() !== WRPRC_TYP)
      return { ok: false, reason: "registration certificate typ" };
    const x5c = d.header.x5c as string[] | undefined;
    if (!x5c?.length) return { ok: false, reason: "registration certificate without x5c" };
    der = b64Decode(x5c[0]);
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
  return { ok: true, payload, signerDer: der };
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
  now = Date.now(),
): { present: boolean; valid: boolean; reason?: string } {
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

export function checkRegistrationCerts(
  req: VpRequest,
  registrarKeys: string[],
  match: Match,
  now = Date.now(),
): RegistrationCertCheck {
  const info = (req.payload as { verifier_info?: unknown }).verifier_info;
  const entries = Array.isArray(info)
    ? (info as Array<{ format?: string; data?: unknown; credential_ids?: string[] }>).filter(
        (e) => e?.format === "registration_cert",
      )
    : [];
  if (!entries.length) return { present: false, valid: true };
  const fail = (reason: string): RegistrationCertCheck => ({ present: true, valid: false, reason });
  let orgId: string | null;
  try {
    orgId = certOrganizationIdentifier(req.leafDer);
  } catch {
    orgId = null;
  }
  const relevant: Wrprc[] = [];
  for (const e of entries) {
    const v = verifyWrprc(e.data, registrarKeys, now);
    if (!v.ok) return fail(v.reason);
    const payload = v.payload;
    const expectedSub = payload.intermediary?.sub ?? payload.sub;
    if (!orgId || !expectedSub || orgId !== expectedSub)
      return fail("registration certificate does not belong to the certificate that signed the request");
    if (!e.credential_ids?.length || e.credential_ids.includes(match.queryId)) relevant.push(payload);
  }
  const allowed = new Set<string>();
  for (const p of relevant)
    for (const c of p.credentials ?? [])
      if (!c.meta?.vct_values || c.meta.vct_values.includes(match.credential.vct))
        for (const cl of c.claim ?? c.claims ?? []) if (typeof cl.path?.[0] === "string") allowed.add(cl.path[0]);
  return {
    present: true,
    valid: true,
    ...(relevant.length ? { allowedClaims: [...allowed] } : {}),
    tradeName: relevant[0]?.name,
    privacyPolicy: relevant[0]?.privacy_policy,
  };
}
