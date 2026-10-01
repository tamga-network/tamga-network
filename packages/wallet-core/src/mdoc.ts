/**
 * mdoc (ISO/IEC 18013-5) — cüzdan tarafı ([[ADR-0013]] / D-CRED-5). Kimlik belgesi SD-JWT VC'nin yanında aynı holder anahtarına
 * bağlı ikinci temsil olarak gelir. Alırken çapraz doğrulama (MD1 aynı alanlar, MD2 deviceKey = cnf, MD3 aynı issuer sertifikası);
 * sunarken seçici açıklama + cihaz imzası (anahtar KeyProvider'dan çıkmaz) → DeviceResponse (base64url) `vp_token` içinde.
 */
import {
  buildDeviceResponse,
  decode,
  encode,
  deviceSignAsync,
  discloseMdoc,
  dcApiSessionTranscript,
  oid4vpSessionTranscript,
  parseCoseSign1,
  verifyIssuerSigned,
  type CborValue,
} from "@tamga-network/mdoc";
import { b64u, b64uDecode, toHex } from "./b64.js";
import { jwkThumbprint } from "./jwe.js";
import type { KeyProvider, PublicJwk } from "./keys.js";
import { certFingerprintHex, p256PointFromCertDer, type LocalVerifyOk } from "./sdjwt.js";

export const MDOC_FORMAT = "mso_mdoc";

/** JWK (P-256) → 65 baytlık uncompressed nokta. */
export function jwkToPoint(jwk: PublicJwk): Uint8Array {
  const x = b64uDecode(jwk.x);
  const y = b64uDecode(jwk.y);
  const out = new Uint8Array(65);
  out[0] = 0x04;
  out.set(x, 1);
  out.set(y, 33);
  return out;
}

/** IssuerSigned'dan issuerAuth x5chain yaprağını çıkarır (MSO imzasını doğrulamak için). */
function leafOf(issuerSigned: Uint8Array): Uint8Array {
  const m = decode(issuerSigned);
  if (!(m instanceof Map)) throw new Error("mdoc: IssuerSigned is not a map");
  const ia = m.get("issuerAuth");
  if (ia === undefined) throw new Error("mdoc: issuerAuth missing");
  // issuerAuth, çözülmüş COSE_Sign1 dizisi olarak durur; yeniden kodlayıp ayrıştır
  const x5 = parseCoseSign1(encode(ia as CborValue)).x5chain;
  if (!x5.length) throw new Error("mdoc: x5chain missing (MD3)");
  return x5[0];
}

const eqVal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Alınan mdoc'u SD-JWT kopyasıyla çapraz doğrular; tutarsızlıkta hata fırlatır (kopya reddedilir).
 * MD3: aynı issuer sertifikası · issuerAuth imzası · MD2: deviceKey = cnf · MD1: ortak alanlar birebir · status idx aynı.
 */
export function verifyReceivedMdoc(
  mdocB64u: string,
  ctx: { sdjwt: LocalVerifyOk; cnf: PublicJwk; now?: number },
): { namespace: string; elements: string[] } {
  const bytes = b64uDecode(mdocB64u);
  const leaf = leafOf(bytes);
  if (certFingerprintHex(leaf) !== ctx.sdjwt.leafFingerprint)
    throw new Error("mdoc: issuer certificate differs from the SD-JWT copy (MD3)");
  const res = verifyIssuerSigned(bytes, {
    issuerPubRaw: p256PointFromCertDer(leaf),
    now: ctx.now,
    expectedDocType: ctx.sdjwt.vct,
  });
  if (!res.valid) throw new Error(`mdoc reddedildi: ${res.reason}`);
  if (!res.deviceKeyRaw || toHex(res.deviceKeyRaw) !== toHex(jwkToPoint(ctx.cnf)))
    throw new Error("mdoc: deviceKey differs from the copy's cnf key (MD2)");
  const nss = Object.keys(res.claims ?? {});
  if (nss.length !== 1) throw new Error("mdoc: expected a single namespace");
  const ns = nss[0];
  const el = res.claims![ns];
  for (const [k, v] of Object.entries(el))
    if (k in ctx.sdjwt.claims && !eqVal(v, ctx.sdjwt.claims[k]))
      throw new Error(`mdoc: field value differs from the SD-JWT copy: ${k} (MD1)`);
  const sdIdx = ctx.sdjwt.status?.status_list.idx;
  if (sdIdx !== undefined && res.status && res.status.idx !== sdIdx)
    throw new Error("mdoc: status idx differs from the SD-JWT copy");
  return { namespace: ns, elements: Object.keys(el) };
}

/**
 * OpenID4VP sunumu (OpenID4VP 1.0 Ek B.2.6): seçici açıklama + ayrık cihaz imzası; SessionTranscript = OpenID4VPHandover
 * (client_id, nonce, şifreleme anahtarının JWK parmak izi, response_uri) → base64url(DeviceResponse).
 */
export async function presentMdoc(p: {
  mdocB64u: string;
  docType: string;
  namespace: string;
  disclose: string[];
  clientId: string;
  nonce: string;
  responseUri: string;
  /** Digital Credentials API: isteği yapan sayfanın kökeni → OpenID4VPDCAPIHandover (Ek B.2.6.2). */
  origin?: string;
  /** Yanıtın şifrelendiği doğrulayıcı anahtarı (direct_post.jwt): parmak izi oturum özetine girer. */
  encJwk?: PublicJwk;
  keys: KeyProvider;
  keyRef: string;
}): Promise<string> {
  const partial = discloseMdoc(b64uDecode(p.mdocB64u), { [p.namespace]: p.disclose });
  const thumb = p.encJwk ? jwkThumbprint(p.encJwk) : null;
  const st = p.origin
    ? dcApiSessionTranscript(p.origin, p.nonce, thumb)
    : oid4vpSessionTranscript(p.clientId, p.nonce, p.responseUri, thumb);
  const devSig = await deviceSignAsync(st, p.docType, (tbs) => p.keys.sign(p.keyRef, tbs));
  return b64u(buildDeviceResponse({ docType: p.docType, issuerSigned: partial, deviceSignature: devSig }));
}
