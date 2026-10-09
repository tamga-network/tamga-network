/**
 * Format katmanı — ISO/IEC 18013-5 mdoc (D-CRED-5, [[ADR-0013]]). OpenID4VP `vp_token` içindeki base64url DeviceResponse'u
 * SPEC-API-0001 A adımlarına eşleyerek doğrular; B–E (şema, güven, iptal, politika) SD-JWT ile ORTAK hatta çalışır.
 *  A1 çözme · A2 issuerAuth/x5chain · A3 yaprak → kök zinciri · A3b issuer_id (yaprak parmak izi) · A3d deviceKey
 *  A4 issuerAuth imzası · A5 digest bütünlüğü · A6 cihaz imzası (SessionTranscript; KB-JWT muadili) · A7 geçerlilik · A8 docType
 */
import { X509Certificate as NodeX509, webcrypto } from "node:crypto";
import { X509Certificate, cryptoProvider } from "@peculiar/x509";
import { b64uToBytes, computeIssuerId, certFingerprintSha256Hex } from "@tamga-network/core";
import {
  dcApiSessionTranscript,
  oid4vpSessionTranscript,
  parseCoseSign1,
  parseDeviceResponse,
  verifyDeviceAuth,
  verifyIssuerSigned,
  plainElementValue,
  decode,
  encode,
  type CborValue,
} from "@tamga-network/mdoc";
import type { IndeterminateReason, Step } from "./verify.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const toAB = (u8: Uint8Array): ArrayBuffer => new Uint8Array(u8).buffer as ArrayBuffer;

export interface FormatOk {
  ok: true;
  format: "dc+sd-jwt" | "mso_mdoc" | "mso_mdoc_zk";
  issuerId: string;
  vct: string;
  /** SD-JWT `vct#integrity`; mdoc'ta yok → B4 atlanır (tip bütünlüğü docType + C2 şema yetkisiyle). */
  vctIntegrity: string | null;
  iat: number;
  /** ADR-0010 K5 kategori sinyali; mdoc'ta taşınmaz → C4 atlanır. */
  category?: string;
  claims: Record<string, unknown>;
  disclosedClaimNames: string[];
  status?: { status_list: { idx: number; uri: string } };
  /** ADR-0036: zincirin bağlandığı kök/çapa sertifikasının SHA-256 parmak izi (onaltılık); dış kurum çözümü bununla. */
  anchorFingerprint?: string | null;
  aDone: Step[];
  aSkipped: Step[];
}
export interface FormatFail {
  ok: false;
  failedStep: Step;
  reason: string;
  /** Verilirse sonuç RED değil DOĞRULANAMADI (AP2): doğrulayıcı tarafı eksik/bozuk (ör. ZK devre dosyası, WASM). */
  indeterminate?: IndeterminateReason;
}
export type FormatResult = FormatOk | FormatFail;

/** Yaprak sertifikadan P-256 açık anahtar noktası (65 bayt). */
function pointOf(leafDer: Uint8Array): Uint8Array {
  const jwk = new NodeX509(leafDer).publicKey.export({ format: "jwk" }) as { x?: string; y?: string; crv?: string };
  if (jwk.crv !== "P-256" || !jwk.x || !jwk.y) throw new Error("issuer key is not P-256");
  const out = new Uint8Array(65);
  out[0] = 0x04;
  out.set(b64uToBytes(jwk.x), 1);
  out.set(b64uToBytes(jwk.y), 33);
  return out;
}

export async function verifyMdocFormat(
  presentation: string,
  opt: {
    clientId: string;
    nonce: string;
    responseUri: string;
    /** Tarayıcı Digital Credentials API'si: isteği yapan sayfanın kökeni → OpenID4VPDCAPIHandover (Ek B.2.6.2). */
    origin?: string;
    /** Yanıt şifreliyse şifreleme anahtarının RFC 7638 parmak izi (oturum özetine girer). */
    encJwkThumbprint?: Uint8Array;
    stateCode: string;
    now: number;
    /** Geçerlilik penceresinde saat farkı toleransı (sn; politika `max_clock_skew_sec`). */
    maxSkewSec?: number;
    rootCertsDer: Uint8Array[];
    expectedDocTypes: string[];
  },
): Promise<FormatResult> {
  const fail = (s: Step, r: string): FormatFail => ({ ok: false, failedStep: s, reason: r });
  // A1 — DeviceResponse çözme
  let dr: ReturnType<typeof parseDeviceResponse>;
  try {
    dr = parseDeviceResponse(b64uToBytes(presentation));
  } catch (e) {
    return fail("A1", `DeviceResponse could not be decoded: ${(e as Error).message}`);
  }
  // A8 — docType politikada mı (erken: yanlış tipte imza doğrulamaya gerek yok)
  if (!opt.expectedDocTypes.includes(dr.docType)) return fail("A8", `docType not in policy: ${dr.docType}`);
  // A2 — issuerAuth + x5chain
  let leafDer: Uint8Array;
  try {
    const is = decode(dr.issuerSigned);
    const ia = is instanceof Map ? is.get("issuerAuth") : undefined;
    if (ia === undefined) return fail("A2", "issuerAuth missing");
    const x5 = parseCoseSign1(encode(ia as CborValue)).x5chain;
    if (!x5.length) return fail("A2", "x5chain missing (MD3)");
    leafDer = x5[0];
  } catch (e) {
    return fail("A2", `issuerAuth unreadable: ${(e as Error).message}`);
  }
  // A3 — yaprak, verilen köklerden birine zincirlenmeli (SD-JWT A3 ile aynı kural)
  let leaf: X509Certificate;
  try {
    leaf = new X509Certificate(toAB(leafDer));
  } catch (e) {
    return fail("A3", `leaf certificate unreadable: ${(e as Error).message}`);
  }
  let anchorFingerprint: string | null = null;
  if (opt.rootCertsDer.length) {
    try {
      const leafFp = certFingerprintSha256Hex(leafDer);
      for (const rootDer of opt.rootCertsDer) {
        const rootFp = certFingerprintSha256Hex(rootDer);
        // ADR-0036: dış listede imzacının kendisi çapa olabilir (ETSI LoTE hizmet sertifikası)
        if (rootFp === leafFp) {
          anchorFingerprint = rootFp;
          break;
        }
        const root = new X509Certificate(toAB(rootDer));
        if (leaf.issuer !== root.subject) continue;
        if (await leaf.verify({ publicKey: root.publicKey, signatureOnly: true })) {
          anchorFingerprint = rootFp;
          break;
        }
      }
      if (!anchorFingerprint) return fail("A3", "x5chain leaf does not chain to any of the given roots");
    } catch (e) {
      return fail("A3", `chain: ${(e as Error).message}`);
    }
  }
  const issuerId = computeIssuerId(opt.stateCode, leafDer); // A3b
  // A4/A5/A7 — issuerAuth imzası + digest bütünlüğü + geçerlilik penceresi
  let pub: Uint8Array;
  try {
    pub = pointOf(leafDer);
  } catch (e) {
    return fail("A4", (e as Error).message);
  }
  const v = verifyIssuerSigned(dr.issuerSigned, {
    issuerPubRaw: pub,
    now: opt.now,
    expectedDocType: dr.docType,
    clockSkewSec: opt.maxSkewSec ?? 0, // politika `max_clock_skew_sec` (A7: az önce verilen belge, geride kalan saat)
  });
  if (!v.valid) {
    const r = v.reason ?? "invalid";
    const step: Step = /digest/.test(r)
      ? "A5"
      : /expired|not yet valid/.test(r)
        ? "A7"
        : /docType/.test(r)
          ? "A8"
          : "A4";
    return fail(step, `mdoc: ${r}`);
  }
  // Sertifika, belgenin imzalandığı anda (validityInfo.signed) geçerli olmalı — SD-JWT A3 ile aynı kural (D-BC-3)
  const signedMs = (v.signedEpoch ?? NaN) * 1000;
  if (!Number.isFinite(signedMs) || signedMs < leaf.notBefore.getTime() || signedMs > leaf.notAfter.getTime())
    return fail("A3", "signing certificate not valid at the time of signing");
  // A3d — deviceKey
  if (!v.deviceKeyRaw) return fail("A3", "deviceKey missing (MD2)");
  // A6 — cihaz imzası (holder binding): SessionTranscript = OpenID4VPHandover (client_id, nonce, şifreleme anahtarı parmak izi,
  // response_uri) — bu isteğe özgü; tekrar oynatılamaz (OpenID4VP 1.0 Ek B.2.6.1)
  const st = opt.origin
    ? dcApiSessionTranscript(opt.origin, opt.nonce, opt.encJwkThumbprint ?? null)
    : oid4vpSessionTranscript(opt.clientId, opt.nonce, opt.responseUri, opt.encJwkThumbprint ?? null);
  if (!verifyDeviceAuth(dr.deviceSignature, st, dr.docType, v.deviceKeyRaw))
    return fail("A6", "device signature invalid (holder binding / SessionTranscript)");
  // açıklanan alanlar — tek namespace (Tamga profili); öğe adları mdoc tanımlayıcısıdır (AB PID kodlaması, ADR-0045: SD-JWT'deki
  // `birthdate` burada `birth_date`), `full-date`/`tdate` etiketleri dizgiye çevrilir
  const claims: Record<string, unknown> = {};
  for (const els of Object.values(v.claims ?? {}))
    for (const [k, val] of Object.entries(els)) claims[k] = plainElementValue(val);
  return {
    ok: true,
    format: "mso_mdoc",
    issuerId,
    vct: dr.docType,
    vctIntegrity: null,
    anchorFingerprint,
    iat: v.signedEpoch!, // yukarıda sayı olduğu denetlendi
    claims,
    disclosedClaimNames: Object.keys(claims),
    ...(v.status ? { status: { status_list: { idx: v.status.idx, uri: v.status.uri } } } : {}),
    aDone: ["A1", "A2", "A3", "A3b", "A3d", "A4", "A5", "A6", "A7", "A8"],
    aSkipped: ["A3c"], // CRL/OCSP: dev PKI'da yok (SD-JWT ile aynı)
  };
}
