/**
 * ADR-0046 K3 — X.509 sertifikasından konu adı, veren adı ve seri numarası (gömülü açıklama politikasının `subject_dns` ve
 * `roots_of_trust` eşleşmeleri; ETSI TS 119 472-3 §4.2.5.2 -07a/-09) ve güven kökü kararı için imza zinciri doğrulaması. Saf TS,
 * küçük bir DER okuyucusu, imzalar `@noble` ile; Node'a özgü API yok (cüzdan dahil her istemci `@tamga-network/trust/core`
 * üzerinden kullanır).
 */
import {
  dnEquals,
  normalizeDnValue,
  serialEquals,
  type DnAttribute,
  type RootOfTrust,
} from "@tamga-network/core/disclosure-policy";
import { certPublicKey, HASH_FN, modPow, rsaVerify, type CertPublicKey, type HashName } from "./xmldsig.js";
import { sha256HexPortable } from "./lote-reader.js";

interface Tlv {
  tag: number;
  start: number;
  end: number;
  /** başlık dahil başlangıç */
  head: number;
}

function readTlv(der: Uint8Array, offset: number): Tlv {
  if (offset + 2 > der.length) throw new Error("DER: unexpected end");
  const tag = der[offset];
  if ((tag & 0x1f) === 0x1f) throw new Error("DER: multi-byte tags not supported");
  let len = der[offset + 1];
  let p = offset + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error("DER: invalid length");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + der[p++];
  }
  const end = p + len;
  if (end > der.length) throw new Error("DER: length exceeds data");
  return { tag, start: p, end, head: offset };
}
function children(der: Uint8Array, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let p = t.start;
  while (p < t.end) {
    const c = readTlv(der, p);
    out.push(c);
    p = c.end;
  }
  if (p !== t.end) throw new Error("DER: children exceed bounds");
  return out;
}

/** OBJECT IDENTIFIER içerik baytları → noktalı gösterim. */
function oidString(der: Uint8Array, t: Tlv): string {
  const b = der.subarray(t.start, t.end);
  if (!b.length) throw new Error("DER: empty OID");
  const parts: number[] = [];
  let v = 0;
  for (const x of b) {
    v = v * 128 + (x & 0x7f);
    if (!(x & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  const first = parts.shift()!;
  const a = first < 40 ? 0 : first < 80 ? 1 : 2;
  return [a, first - a * 40, ...parts].join(".");
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** DirectoryString değeri → metin. Bilinmeyen dize türü RFC 4514 §2.4'teki gibi `#<BER hex>`. */
function attrValue(der: Uint8Array, t: Tlv): string {
  const body = der.subarray(t.start, t.end);
  switch (t.tag) {
    case 0x0c: // UTF8String
    case 0x13: // PrintableString
    case 0x16: // IA5String
    case 0x12: // NumericString
      return new TextDecoder().decode(body);
    case 0x14: // TeletexString (pratikte Latin-1)
      return String.fromCharCode(...body);
    case 0x1e: {
      // BMPString (UTF-16BE)
      let s = "";
      for (let i = 0; i + 1 < body.length; i += 2) s += String.fromCharCode((body[i] << 8) | body[i + 1]);
      return s;
    }
    default:
      return "#" + hex(der.subarray(t.head, t.end));
  }
}

function nameOf(der: Uint8Array, t: Tlv): DnAttribute[] {
  if (t.tag !== 0x30) throw new Error("X.509: Name is not a SEQUENCE");
  const out: DnAttribute[] = [];
  for (const rdn of children(der, t))
    for (const atv of children(der, rdn)) {
      const [oid, val] = children(der, atv);
      if (oid?.tag !== 0x06 || !val) throw new Error("X.509: AttributeTypeAndValue malformed");
      const v = attrValue(der, val);
      out.push({ oid: oidString(der, oid), value: v.startsWith("#") ? v : normalizeDnValue(v) });
    }
  return out;
}

export interface CertNames {
  /** konu adı (X.509 sırasıyla; değerler normalleştirilmiş) */
  subject: DnAttribute[];
  /** veren adı */
  issuer: DnAttribute[];
  /** seri numarası, onaltılık (küçük harf, baştaki sıfır baytı dahil DER'deki gibi) */
  serialHex: string;
}

/** Sertifikanın konu adı, veren adı ve seri numarası. Bozuk sertifika → hata. */
export function certNames(der: Uint8Array): CertNames {
  const cert = readTlv(der, 0);
  if (cert.tag !== 0x30) throw new Error("X.509: Certificate is not a SEQUENCE");
  const tbs = children(der, cert)[0];
  if (!tbs || tbs.tag !== 0x30) throw new Error("X.509: tbsCertificate missing");
  const f = children(der, tbs);
  const off = f[0]?.tag === 0xa0 ? 1 : 0; // [0] version
  const serial = f[off];
  if (!serial || serial.tag !== 0x02) throw new Error("X.509: serialNumber missing");
  return {
    serialHex: hex(der.subarray(serial.start, serial.end)),
    issuer: nameOf(der, f[off + 2]),
    subject: nameOf(der, f[off + 4]),
  };
}

/** id-tsl-kp-tslSigning (ETSI TS 119 612 §5.7.1): yalnız ETSI XML güven listesi imzası için. */
export const OID_TSL_SIGNING_EKU = "0.4.0.2231.3.0";

/** Sertifikanın extendedKeyUsage (2.5.29.37) amaçları (noktalı OID); uzantı yoksa boş dizi. Bozuk sertifika → hata. */
export function certExtendedKeyUsages(der: Uint8Array): string[] {
  const cert = readTlv(der, 0);
  if (cert.tag !== 0x30) throw new Error("X.509: Certificate is not a SEQUENCE");
  const tbs = children(der, cert)[0];
  if (!tbs || tbs.tag !== 0x30) throw new Error("X.509: tbsCertificate missing");
  const exts = children(der, tbs).find((t) => t.tag === 0xa3); // [3] extensions
  if (!exts) return [];
  const seq = children(der, exts)[0];
  if (!seq || seq.tag !== 0x30) throw new Error("X.509: extensions malformed");
  for (const ext of children(der, seq)) {
    const parts = children(der, ext);
    if (parts[0]?.tag !== 0x06 || oidString(der, parts[0]) !== "2.5.29.37") continue;
    const value = parts[parts.length - 1];
    if (value?.tag !== 0x04) throw new Error("X.509: extKeyUsage malformed");
    const inner = readTlv(der, value.start);
    if (inner.tag !== 0x30) throw new Error("X.509: extKeyUsage malformed");
    return children(der, inner)
      .filter((t) => t.tag === 0x06)
      .map((t) => oidString(der, t));
  }
  return [];
}

/**
 * ETSI -09 güven kökü öğesi bu sertifikayı mı gösteriyor (IssuerSerial): seri numarası aynı ve öğenin `issuer_dn`'i sertifikanın
 * VEREN adına eşit (kendinden imzalı kökte veren adı konu adıyla aynıdır). Konu adıyla eşleşme kabul edilmez.
 *
 * Bu yalnız bir ad karşılaştırmasıdır: ad ve seri numarası kopyalanabilir. Politika kararında yalnız `anchoredChainCerts`'in
 * döndürdüğü (imza zinciri doğrulanmış ve güvene bağlanmış) sertifikalar bu işlevle karşılaştırılmalıdır.
 */
export function certMatchesRootOfTrust(der: Uint8Array, root: RootOfTrust): boolean {
  try {
    const n = certNames(der);
    if (!serialEquals(n.serialHex, root.serial_number)) return false;
    return dnEquals(root.issuer_dn, n.issuer);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- X.509 imza zinciri (ADR-0046 K3 güven kökü)

type CertSigAlg =
  | { kind: "ecdsa"; hash: HashName }
  | { kind: "rsa"; hash: HashName }
  | { kind: "pss"; hash: HashName; saltLength: number };
const SIG_ALGS: Record<string, CertSigAlg> = {
  "2a8648ce3d040302": { kind: "ecdsa", hash: "sha256" }, // ecdsa-with-SHA256 (ES256)
  "2a8648ce3d040303": { kind: "ecdsa", hash: "sha384" }, // ecdsa-with-SHA384 (ES384)
  "2a8648ce3d040304": { kind: "ecdsa", hash: "sha512" }, // ecdsa-with-SHA512
  "2a864886f70d01010b": { kind: "rsa", hash: "sha256" }, // sha256WithRSAEncryption (RS256)
  "2a864886f70d01010c": { kind: "rsa", hash: "sha384" },
  "2a864886f70d01010d": { kind: "rsa", hash: "sha512" },
};
const OID_RSASSA_PSS = "2a864886f70d01010a";
const OID_MGF1 = "2a864886f70d010108";
const HASH_OIDS: Record<string, HashName> = {
  "608648016503040201": "sha256",
  "608648016503040202": "sha384",
  "608648016503040203": "sha512",
};

const algHash = (der: Uint8Array, t: Tlv): HashName => {
  const [oid] = children(der, t);
  const h = oid?.tag === 0x06 ? HASH_OIDS[hex(der.subarray(oid.start, oid.end))] : undefined;
  if (!h) throw new Error("X.509: unsupported hash algorithm");
  return h;
};
const derInt = (der: Uint8Array, t: Tlv): number => {
  if (t.tag !== 0x02 || t.end - t.start > 4) throw new Error("X.509: bad INTEGER");
  let v = 0;
  for (let i = t.start; i < t.end; i++) v = v * 256 + der[i];
  return v;
};

/** AlgorithmIdentifier → imza algoritması. RSASSA-PSS'te SHA-1 (varsayılan) ve özetle uyuşmayan MGF1 reddedilir. */
function sigAlg(der: Uint8Array, t: Tlv): CertSigAlg {
  const [oidT, params] = children(der, t);
  if (oidT?.tag !== 0x06) throw new Error("X.509: AlgorithmIdentifier malformed");
  const oid = hex(der.subarray(oidT.start, oidT.end));
  const known = SIG_ALGS[oid];
  if (known) return known;
  if (oid !== OID_RSASSA_PSS || params?.tag !== 0x30) throw new Error("X.509: unsupported signature algorithm");
  let hash: HashName | undefined;
  let mgfHash: HashName | undefined;
  let saltLength = 20;
  for (const f of children(der, params)) {
    const [inner] = children(der, f);
    if (!inner) throw new Error("X.509: RSASSA-PSS parameters malformed");
    if (f.tag === 0xa0) hash = algHash(der, inner);
    else if (f.tag === 0xa1) {
      const [mOid, mParams] = children(der, inner);
      if (mOid?.tag !== 0x06 || hex(der.subarray(mOid.start, mOid.end)) !== OID_MGF1 || !mParams)
        throw new Error("X.509: unsupported mask generation function");
      mgfHash = algHash(der, mParams);
    } else if (f.tag === 0xa2) saltLength = derInt(der, inner);
    else if (f.tag === 0xa3) {
      if (derInt(der, inner) !== 1) throw new Error("X.509: unsupported RSASSA-PSS trailer field");
    }
  }
  if (!hash || mgfHash !== hash) throw new Error("X.509: RSASSA-PSS needs SHA-2 with matching MGF1");
  return { kind: "pss", hash, saltLength };
}

interface CertParts {
  tbs: Uint8Array;
  alg: CertSigAlg;
  signature: Uint8Array;
}
function certParts(der: Uint8Array): CertParts {
  const cert = readTlv(der, 0);
  if (cert.tag !== 0x30 || cert.end !== der.length) throw new Error("X.509: Certificate is not a single SEQUENCE");
  const [tbs, algT, sigT, extra] = children(der, cert);
  if (extra || tbs?.tag !== 0x30 || algT?.tag !== 0x30 || sigT?.tag !== 0x03) throw new Error("X.509: malformed");
  // RFC 5280 §4.1.1.2: tbsCertificate.signature aynı AlgorithmIdentifier olmalı
  const f = children(der, tbs);
  const inner = f[f[0]?.tag === 0xa0 ? 2 : 1];
  if (!inner || hex(der.subarray(inner.head, inner.end)) !== hex(der.subarray(algT.head, algT.end)))
    throw new Error("X.509: signature algorithm mismatch");
  const bits = der.subarray(sigT.start, sigT.end);
  if (!bits.length || bits[0] !== 0) throw new Error("X.509: signature BIT STRING malformed");
  return { tbs: der.subarray(tbs.head, tbs.end), alg: sigAlg(der, algT), signature: bits.subarray(1) };
}

const bytesToBig = (b: Uint8Array) => BigInt("0x" + (hex(b) || "0"));
function mgf1(h: (b: Uint8Array) => Uint8Array, seed: Uint8Array, len: number): Uint8Array {
  const out = new Uint8Array(len);
  for (let c = 0, off = 0; off < len; c++) {
    const block = h(new Uint8Array([...seed, c >>> 24, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff]));
    out.set(block.subarray(0, Math.min(block.length, len - off)), off);
    off += block.length;
  }
  return out;
}
/** RSASSA-PSS doğrulaması (RFC 8017 §8.1.2, EMSA-PSS-VERIFY §9.1.2). */
function pssVerify(
  key: { n: bigint; e: bigint; k: number },
  hash: HashName,
  saltLength: number,
  msg: Uint8Array,
  sig: Uint8Array,
): boolean {
  if (sig.length !== key.k) return false;
  const s = bytesToBig(sig);
  if (s >= key.n) return false;
  const emBits = key.n.toString(2).length - 1;
  const emLen = Math.ceil(emBits / 8);
  const mHex = modPow(s, key.e, key.n).toString(16);
  if (mHex.length > emLen * 2) return false;
  const em = Uint8Array.from(mHex.padStart(emLen * 2, "0").match(/../g)!, (x) => parseInt(x, 16));
  const H = HASH_FN[hash];
  const mHash = H(msg);
  const hLen = mHash.length;
  if (emLen < hLen + saltLength + 2 || em[emLen - 1] !== 0xbc) return false;
  const maskedDb = em.subarray(0, emLen - hLen - 1);
  const h = em.subarray(emLen - hLen - 1, emLen - 1);
  const zeroBits = 8 * emLen - emBits;
  if (maskedDb[0] & (0xff << (8 - zeroBits)) & 0xff) return false;
  const mask = mgf1(H, h, maskedDb.length);
  const db = maskedDb.map((x, i) => x ^ mask[i]);
  db[0] &= 0xff >> zeroBits;
  const ps = emLen - hLen - saltLength - 2;
  for (let i = 0; i < ps; i++) if (db[i] !== 0) return false;
  if (db[ps] !== 0x01) return false;
  const salt = db.subarray(db.length - saltLength);
  const hPrime = H(new Uint8Array([...new Uint8Array(8), ...mHash, ...salt]));
  return hex(hPrime) === hex(h);
}

/**
 * `child` sertifikasının imzası `issuer` sertifikasının açık anahtarıyla doğrulanıyor mu. ECDSA (P-256/384/521; SHA-256/384/512),
 * RSASSA-PKCS1-v1_5 (RS256/384/512) ve RSASSA-PSS (PS256/384/512); RSA modülü 2048–4096 bit. Desteklenmeyen algoritma, bozuk
 * sertifika ya da tutmayan imza → `false` (hiçbir zaman hata fırlatmaz).
 */
export function verifyCertSignature(child: Uint8Array, issuer: Uint8Array): boolean {
  try {
    const { tbs, alg, signature } = certParts(child);
    const key: CertPublicKey = certPublicKey(issuer);
    if (alg.kind === "ecdsa") {
      if (key.kind !== "ecdsa") return false;
      return key.curve.verify(signature, HASH_FN[alg.hash](tbs), key.point, {
        prehash: false,
        lowS: false,
        format: "der",
      });
    }
    if (key.kind !== "rsa") return false;
    return alg.kind === "rsa"
      ? rsaVerify(key, alg.hash, tbs, signature)
      : pssVerify(key, alg.hash, alg.saltLength, tbs, signature);
  } catch {
    return false;
  }
}

/** Sertifika kendinden imzalı mı: veren adı = konu adı ve imza kendi anahtarıyla doğrulanıyor. */
export function isSelfSigned(der: Uint8Array): boolean {
  try {
    const n = certNames(der);
    return dnEquals(n.issuer, n.subject) && verifyCertSignature(der, der);
  } catch {
    return false;
  }
}

/**
 * Zincirin (yaprak ilk) imzası doğrulanan öneki: her `chain[i-1]` için veren adı `chain[i]`'nin konu adına eşit ve imzası
 * `chain[i]`'nin anahtarıyla doğrulanıyor. İlk kırılmada durur; kırılmadan sonraki sertifikalar dönmez. Boş zincir → boş.
 */
export function verifiedChainPrefix(chain: Uint8Array[]): Uint8Array[] {
  if (!chain.length) return [];
  const out = [chain[0]];
  for (let i = 1; i < chain.length; i++) {
    try {
      if (!dnEquals(certNames(chain[i - 1]).issuer, certNames(chain[i]).subject)) break;
    } catch {
      break;
    }
    if (!verifyCertSignature(chain[i - 1], chain[i])) break;
    out.push(chain[i]);
  }
  return out;
}

export interface AnchoredChainOptions {
  /**
   * Yaprak (`chain[0]`) güvenilir bir kaynakla birebir doğrulandı mı (ör. kayıt sertifikasını imzalayan sertifikanın parmak izi
   * imzalı listedeki kayıt kurumu anahtarı). Yalnız o zaman yaprak ve yaprağın kendinden imzalı vereni kabul edilir.
   */
  leafTrusted?: boolean;
  /** İmzalı bir listeden gelen güvenilir CA sertifikalarının SHA-256 parmak izleri (onaltılık). */
  anchorFingerprints?: Iterable<string>;
  /**
   * İmzalı bir listeden gelen güvenilir CA sertifikaları (DER; ör. ulusal listenin `root_cas[].cert_pem`'i). x5c kökü taşımaz
   * (RFC 9126/HAIP, ARF RO-02): zincirin son sertifikasını imzalayan çapa bu sertifikalardan biridir. Parmak izleri de çapa sayılır.
   */
  anchorCertificates?: Iterable<Uint8Array>;
}

/**
 * Güvene bağlanmış zincir sertifikaları (ADR-0046 K3 `specific_roots_of_trust`): yalnız bunlar güven kökü öğesiyle karşılaştırılır.
 * İmza zinciri yapraktan başlayarak doğrulanır (`verifiedChainPrefix`); sonra:
 *  - doğrulanmış önekte bir sertifikanın parmak izi `anchorFingerprints` (ya da `anchorCertificates`) içindeyse, yapraktan o
 *    sertifikaya kadar hepsi;
 *  - yoksa önekteki bir sertifikayı bir `anchorCertificates` sertifikası imzalamışsa (kök x5c'de taşınmaz), yapraktan o
 *    sertifikaya kadar hepsi ve çapanın kendisi;
 *  - yoksa `leafTrusted` ise yaprak ve — yaprağı doğrudan imzalayan sertifika kendinden imzalıysa (o anahtarın sahibinden başkası
 *    üretemez) — o sertifika;
 *  - hiçbiri değilse boş: zincir isteği gönderen tarafından kurulabilir (ad ve seri numarası kopyalanabilir, araya kendi anahtarıyla
 *    imzalanmış sertifika konabilir), güvene bağlanamaz.
 */
export function anchoredChainCerts(chain: Uint8Array[], opts: AnchoredChainOptions = {}): Uint8Array[] {
  const v = verifiedChainPrefix(chain);
  if (!v.length) return [];
  const anchorCerts = [...(opts.anchorCertificates ?? [])];
  const anchors = new Set([
    ...[...(opts.anchorFingerprints ?? [])].map((f) => f.toLowerCase()),
    ...anchorCerts.map((c) => sha256HexPortable(c)),
  ]);
  if (anchors.size)
    for (let i = v.length - 1; i >= 0; i--) if (anchors.has(sha256HexPortable(v[i]))) return v.slice(0, i + 1);
  // kök x5c'de yok: doğrulanmış önekteki bir sertifikayı (en uzak olandan başlayarak) bir çapa sertifikası imzalamış mı
  for (let i = v.length - 1; i >= 0; i--)
    for (const a of anchorCerts) if (issuedBy(v[i], a)) return [...v.slice(0, i + 1), a];
  if (!opts.leafTrusted) return [];
  return v.length >= 2 && isSelfSigned(v[1]) ? v.slice(0, 2) : v.slice(0, 1);
}

/** `child`'in veren adı `issuer`'ın konu adına eşit ve imzası `issuer`'ın anahtarıyla doğrulanıyor mu. */
function issuedBy(child: Uint8Array, issuer: Uint8Array): boolean {
  try {
    if (!dnEquals(certNames(child).issuer, certNames(issuer).subject)) return false;
  } catch {
    return false;
  }
  return verifyCertSignature(child, issuer);
}

/** Sertifikanın konu adı verilen RFC 4514 dizesine eşit mi (ETSI -07a). */
export function certSubjectMatches(der: Uint8Array, dn: string): boolean {
  try {
    return dnEquals(dn, certNames(der).subject);
  } catch {
    return false;
  }
}
