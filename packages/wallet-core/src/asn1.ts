/**
 * Minimal DER (X.690) ayrıştırıcı — yalnızca X.509 sertifikasından ihtiyaç duyduğumuz iki şey için: SubjectAltName dNSName'leri
 * ve P-256 SubjectPublicKeyInfo noktası. Saf TS (RN/Hermes), bağımlılık yok. S-12 kapanışı: önceki bayt-arama sezgiselinin
 * (IA5String deseni aramak) yerine sertifika yapısı adım adım izlenir; yanlış yerdeki eşleşme (ör. başka bir uzantıda geçen
 * aynı bayt dizisi) artık kabul edilmez.
 */

export interface Tlv {
  tag: number;
  /** içerik başlangıcı (başlık sonrası) */
  start: number;
  /** içerik sonu (hariç) */
  end: number;
}

/** `offset`teki TLV'yi okur. Uzun biçim uzunluk (≤ 4 bayt) desteklenir; belirsiz uzunluk (0x80) DER'de yasak → hata. */
export function readTlv(der: Uint8Array, offset: number): Tlv {
  if (offset + 2 > der.length) throw new Error("DER: beklenmeyen son");
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
  return { tag, start: p, end };
}

/** Yapılı (constructed) bir TLV'nin doğrudan çocukları. */
export function children(der: Uint8Array, t: Tlv): Tlv[] {
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

const eq = (der: Uint8Array, t: Tlv, bytes: number[]) =>
  t.end - t.start === bytes.length && bytes.every((b, i) => der[t.start + i] === b);

// OID içerik baytları
const OID_SAN = [0x55, 0x1d, 0x11]; // 2.5.29.17
const OID_EC_PUBKEY = [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]; // 1.2.840.10045.2.1
const OID_P256 = [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]; // 1.2.840.10045.3.1.7

/** Certificate → tbsCertificate alanları: [0]version? serial sigAlg issuer validity subject SPKI [1]? [2]? [3]extensions? */
function tbsFields(der: Uint8Array): Tlv[] {
  const cert = readTlv(der, 0);
  if (cert.tag !== 0x30) throw new Error("X.509: Certificate is not a SEQUENCE");
  const tbs = children(der, cert)[0];
  if (!tbs || tbs.tag !== 0x30) throw new Error("X.509: tbsCertificate missing");
  return children(der, tbs);
}

/** SubjectAltName uzantısındaki dNSName ([2] IA5String) değerleri. */
export function certSanDnsNames(der: Uint8Array): string[] {
  const f = tbsFields(der);
  const extWrap = f.find((t) => t.tag === 0xa3); // [3] EXPLICIT Extensions
  if (!extWrap) return [];
  const exts = children(der, extWrap)[0];
  if (!exts || exts.tag !== 0x30) throw new Error("X.509: extensions is not a SEQUENCE");
  const out: string[] = [];
  for (const ext of children(der, exts)) {
    const parts = children(der, ext); // extnID, critical?, extnValue
    const oid = parts[0];
    if (!oid || oid.tag !== 0x06 || !eq(der, oid, OID_SAN)) continue;
    const val = parts[parts.length - 1];
    if (val.tag !== 0x04) throw new Error("X.509: SAN extnValue is not an OCTET STRING");
    const names = readTlv(der, val.start); // GeneralNames SEQUENCE (OCTET STRING içinde)
    if (names.tag !== 0x30 || names.end !== val.end) throw new Error("X.509: GeneralNames bozuk");
    for (const gn of children(der, names))
      if (gn.tag === 0x82) out.push(String.fromCharCode(...der.subarray(gn.start, gn.end)).toLowerCase());
  }
  return out;
}

/** SubjectPublicKeyInfo → P-256 uncompressed nokta (65 bayt). Eğri P-256 değilse hata (C1). */
export function certP256Point(der: Uint8Array): Uint8Array {
  const f = tbsFields(der);
  const off = f[0]?.tag === 0xa0 ? 1 : 0; // [0] version varsa
  const spki = f[off + 5]; // serial, sigAlg, issuer, validity, subject → SPKI
  if (!spki || spki.tag !== 0x30) throw new Error("X.509: SubjectPublicKeyInfo missing");
  const [alg, bits] = children(der, spki);
  const [algOid, curve] = children(der, alg);
  if (!eq(der, algOid, OID_EC_PUBKEY) || !curve || !eq(der, curve, OID_P256))
    throw new Error("certificate is not P-256 (C1)");
  if (bits.tag !== 0x03 || der[bits.start] !== 0x00) throw new Error("X.509: BIT STRING bozuk");
  const point = der.slice(bits.start + 1, bits.end);
  if (point.length !== 65 || point[0] !== 0x04) throw new Error("X.509: not an uncompressed P-256 point");
  return point;
}

const OID_AKI = [0x55, 0x1d, 0x23]; // 2.5.29.35 authorityKeyIdentifier

/**
 * AuthorityKeyIdentifier uzantısının keyIdentifier'ı ([0] IMPLICIT OCTET STRING, RFC 5280 §4.2.1.1); yoksa null.
 * OpenID4VP DCQL `trusted_authorities` tip `aki` eşleşmesi bu değerle yapılır.
 */
export function certAuthorityKeyId(der: Uint8Array): Uint8Array | null {
  const f = tbsFields(der);
  const extWrap = f.find((t) => t.tag === 0xa3);
  if (!extWrap) return null;
  const exts = children(der, extWrap)[0];
  if (!exts || exts.tag !== 0x30) throw new Error("X.509: extensions is not a SEQUENCE");
  for (const ext of children(der, exts)) {
    const parts = children(der, ext);
    const oid = parts[0];
    if (!oid || oid.tag !== 0x06 || !eq(der, oid, OID_AKI)) continue;
    const val = parts[parts.length - 1];
    if (val.tag !== 0x04) throw new Error("X.509: AKI extnValue is not an OCTET STRING");
    const seq = readTlv(der, val.start);
    if (seq.tag !== 0x30 || seq.end !== val.end) throw new Error("X.509: AKI malformed");
    const kid = children(der, seq).find((t) => t.tag === 0x80);
    return kid ? der.slice(kid.start, kid.end) : null;
  }
  return null;
}

const OID_ORG_IDENTIFIER = [0x55, 0x04, 0x61]; // 2.5.4.97 organizationIdentifier (ETSI EN 319 412-1)

/**
 * Konu alanındaki organizationIdentifier (ETSI EN 319 412-1 semantik tanımlayıcı, ör. `VATTR-1234567890`); yoksa null.
 * ADR-0026: kayıt sertifikasının `sub`'ı erişim sertifikasındaki bu değerle eşleşmelidir.
 */
export function certOrganizationIdentifier(der: Uint8Array): string | null {
  const f = tbsFields(der);
  const off = f[0]?.tag === 0xa0 ? 1 : 0;
  const subject = f[off + 4]; // serial, sigAlg, issuer, validity → subject
  if (!subject || subject.tag !== 0x30) throw new Error("X.509: subject missing");
  for (const rdn of children(der, subject))
    for (const atv of children(der, rdn)) {
      const [oid, val] = children(der, atv);
      if (oid?.tag === 0x06 && eq(der, oid, OID_ORG_IDENTIFIER) && val)
        return new TextDecoder().decode(der.subarray(val.start, val.end));
    }
  return null;
}
