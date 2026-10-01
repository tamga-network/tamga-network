/**
 * Liste/çapa imzalama ve doğrulama — JWS compact, ES256, x5c ile imzacı sertifikası.
 * typ: "tamga-tl+jwt". Doğrulama: x5c[0] parmak izi izin verilen listede olmalı (BT3/ETSI A.2),
 * imza sertifikadaki açık anahtarla doğrulanmalı. Kök zinciri değil parmak izi eşleşmesi esas
 * alınır: listeyi imzalayan anahtar, üst listede (lotl) veya ilan sayfasında parmak iziyle kayıtlıdır.
 */
import { CompactSign, compactVerify, importPKCS8, importX509, decodeProtectedHeader } from "jose";
import { sha256Hex, utf8, pemToDer, derToB64, b64ToDer, derToPem } from "@tamga-network/core";
import { loadTrustSetWith, type TrustSetInput } from "./loader.js";

export const TL_TYP = "tamga-tl+jwt";
export { pemToDer, derToB64, b64ToDer, derToPem };

export interface Signer {
  /** Sertifika (DER) — x5c[0] */
  certDer: Uint8Array;
  sign(payload: Uint8Array, header: Record<string, unknown>): Promise<string>;
}

/** Geliştirme imzacısı: PKCS#8 PEM dosyasından. Pilotta KMS imzacısı aynı arayüzü uygular. */
export async function pemSigner(privateKeyPem: string, certPem: string): Promise<Signer> {
  const key = await importPKCS8(privateKeyPem, "ES256");
  const certDer = pemToDer(certPem);
  return {
    certDer,
    async sign(payload, header) {
      // JAdES (ETSI TS 119 182-1) gibi kritik uzantı başlıkları (`crit`) imza atarken de bildirilir
      const crit = Array.isArray(header.crit)
        ? Object.fromEntries(header.crit.map((k) => [String(k), true]))
        : undefined;
      return new CompactSign(payload)
        .setProtectedHeader({ alg: "ES256", typ: TL_TYP, x5c: [derToB64(certDer)], ...header })
        .sign(key, crit ? { crit } : undefined);
    },
  };
}

export async function signJson(signer: Signer, obj: unknown, header: Record<string, unknown> = {}): Promise<string> {
  const payload = utf8(JSON.stringify(obj));
  return signer.sign(payload, header);
}

export interface VerifiedJws<T = unknown> {
  payload: T;
  signerFingerprint: string;
  raw: string;
}

/**
 * JWS'i doğrular. `allowedFingerprints` boşsa yalnızca kendi-x5c'siyle (self) doğrular ve
 * parmak izini döner — çağıran karar verir (lotl kökü için ilan sayfasıyla karşılaştırır).
 */
export async function verifyJws<T = unknown>(
  jws: string,
  allowedFingerprints: Set<string> | null,
  opts: { typ?: string | null } = {},
): Promise<VerifiedJws<T>> {
  const header = decodeProtectedHeader(jws);
  if (header.alg !== "ES256") throw new Error(`JWS alg rejected: ${header.alg} (ES256 only)`);
  const typ = opts.typ === undefined ? TL_TYP : opts.typ;
  if (typ !== null && header.typ !== typ) throw new Error(`JWS typ reddedildi: ${header.typ}`);
  // ADR-0036: dış (JAdES) listelerde imzacı yine sabitlenmiş parmak iziyle sınırlı olmalı
  if (typ === null && !allowedFingerprints) throw new Error("external list JWS requires pinned signer fingerprints");
  const x5c = header.x5c;
  if (!x5c || x5c.length === 0) throw new Error("JWS x5c missing");
  const leafDer = b64ToDer(x5c[0]);
  const fp = sha256Hex(leafDer);
  if (allowedFingerprints && !allowedFingerprints.has(fp)) throw new Error(`signer fingerprint not registered: ${fp}`);
  const pub = await importX509(derToPem(leafDer), "ES256");
  const { payload } = await compactVerify(jws, pub);
  return { payload: JSON.parse(new TextDecoder().decode(payload)) as T, signerFingerprint: fp, raw: jws };
}

/** Node girişi: jose doğrulayıcısıyla yükle (servisler, yayıncı, uyum testleri). Kurallar `loadTrustSetWith`'te (ADR-0015). */
export const loadTrustSet = (input: TrustSetInput) => loadTrustSetWith(input, verifyJws);
