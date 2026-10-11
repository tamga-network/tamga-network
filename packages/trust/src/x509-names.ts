/**
 * ADR-0046 K3 — X.509 sertifikasından konu adı, veren adı ve seri numarası (gömülü açıklama politikasının `subject_dns` ve
 * `roots_of_trust` eşleşmeleri; ETSI TS 119 472-3 §4.2.5.2 -07a/-09). Saf TS, küçük bir DER okuyucusu; Node'a özgü API yok
 * (cüzdan dahil her istemci `@tamga-network/trust/core` üzerinden kullanır).
 */
import {
  dnEquals,
  normalizeDnValue,
  serialEquals,
  type DnAttribute,
  type RootOfTrust,
} from "@tamga-network/core/disclosure-policy";

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

/**
 * ETSI -09 güven kökü öğesi bu sertifikayı mı gösteriyor: seri numarası aynı ve öğenin `issuer_dn`'i sertifikanın veren adına
 * (IssuerSerial) — kendinden imzalı kökte konu adı da aynıdır — ya da konu adına eşit. İkinci yorum, öğeyi sertifikanın kendi adıyla
 * yazan kurumlar için kabul edilir; seri numarası her durumda tutmalıdır.
 */
export function certMatchesRootOfTrust(der: Uint8Array, root: RootOfTrust): boolean {
  try {
    const n = certNames(der);
    if (!serialEquals(n.serialHex, root.serial_number)) return false;
    return dnEquals(root.issuer_dn, n.issuer) || dnEquals(root.issuer_dn, n.subject);
  } catch {
    return false;
  }
}

/** Sertifikanın konu adı verilen RFC 4514 dizesine eşit mi (ETSI -07a). */
export function certSubjectMatches(der: Uint8Array, dn: string): boolean {
  try {
    return dnEquals(dn, certNames(der).subject);
  } catch {
    return false;
  }
}
