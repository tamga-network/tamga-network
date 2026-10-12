/**
 * XML imzası (XMLDSig) doğrulaması — ETSI TS 119 612 güven listeleri için (XAdES-B-B zarflanmış imza). Platformdan bağımsız:
 * XML ayrıştırıcı `@xmldom/xmldom` (bağımlılıksız DOM), kanonikleştirme (C14N 1.0 ve Exclusive C14N 1.0, yorumsuz) bu dosyada,
 * özetler `@noble/hashes`, ECDSA `@noble/curves`, RSA PKCS#1 v1.5 BigInt ile — Node `crypto`'su gerekmez; cüzdanda da çalışır.
 *
 * Kapsam (bilerek dar): kökün doğrudan çocuğu olan TEK `ds:Signature`; `SignedInfo`'da URI="" (bütün belge, enveloped-signature
 * dönüşümü) ve isteğe bağlı `#id` (XAdES SignedProperties) başvuruları; dönüşümler enveloped-signature, C14N 1.0, Exclusive
 * C14N 1.0 (InclusiveNamespaces PrefixList dahil); imza rsa-sha256/384/512 ve ecdsa-sha256/384/512 (P-256/384/521); özet
 * sha256/384/512. SHA-1, yorumlu kanonikleştirme, XPath dönüşümü, DTD bilerek reddedilir. İmzacı sertifikası `KeyInfo`'daki
 * ilk `X509Certificate`; GÜVEN kararı çağıranındır (sabitlenmiş parmak izi — ADR-0036).
 */
import { DOMParser } from "@xmldom/xmldom";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { p256, p384, p521 } from "@noble/curves/nist.js";
import { b64ToBytes, sha256HexPortable } from "./lote-reader.js";

export const DSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

export class XmlSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlSignatureError";
  }
}

const DIGESTS: Record<string, (b: Uint8Array) => Uint8Array> = {
  "http://www.w3.org/2001/04/xmlenc#sha256": sha256,
  "http://www.w3.org/2001/04/xmldsig-more#sha384": sha384,
  "http://www.w3.org/2001/04/xmlenc#sha512": sha512,
};
type HashName = "sha256" | "sha384" | "sha512";
const HASH_FN: Record<HashName, (b: Uint8Array) => Uint8Array> = { sha256, sha384, sha512 };
const SIG_ALGS: Record<string, { kind: "rsa" | "ecdsa"; hash: HashName }> = {
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256": { kind: "rsa", hash: "sha256" },
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha384": { kind: "rsa", hash: "sha384" },
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512": { kind: "rsa", hash: "sha512" },
  "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256": { kind: "ecdsa", hash: "sha256" },
  "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384": { kind: "ecdsa", hash: "sha384" },
  "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha512": { kind: "ecdsa", hash: "sha512" },
};

// --- DOM yardımcıları (xmldom türleri yerine en küçük yapısal arayüz) -----------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
type XNode = any;
const ELEMENT = 1;
const TEXT = 3;
const CDATA = 4;
const PI = 7;

const childElements = (el: XNode): XNode[] => {
  const out: XNode[] = [];
  for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === ELEMENT) out.push(c);
  return out;
};
export const xmlChild = (el: XNode, ns: string, local: string): XNode | undefined =>
  childElements(el).find((c) => c.namespaceURI === ns && c.localName === local);
export const xmlChildren = (el: XNode, ns: string, local: string): XNode[] =>
  childElements(el).filter((c) => c.namespaceURI === ns && c.localName === local);
export const xmlText = (el: XNode | undefined): string => {
  if (!el) return "";
  let s = "";
  for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === TEXT || c.nodeType === CDATA) s += c.data;
  return s.trim();
};
const isNsDecl = (a: XNode) => a.name === "xmlns" || String(a.name).startsWith("xmlns:");
const declPrefix = (a: XNode) => (a.name === "xmlns" ? "" : String(a.name).slice(6));

/** Öğenin kapsamındaki ad alanları (önek → URI; varsayılan ""), atalar dahil; `xml` öneki hariç. */
function inScopeNamespaces(el: XNode): Map<string, string> {
  const chain: XNode[] = [];
  for (let n = el; n && n.nodeType === ELEMENT; n = n.parentNode) chain.unshift(n);
  const m = new Map<string, string>();
  for (const n of chain)
    for (let i = 0; i < n.attributes.length; i++) {
      const a = n.attributes.item(i);
      if (isNsDecl(a)) m.set(declPrefix(a), a.value);
    }
  return m;
}

// --- Kanonikleştirme ---------------------------------------------------------------------------------------------------
const escText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#xD;");
const escAttr = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");

interface C14nOpts {
  exclusive: boolean;
  /** Exclusive C14N InclusiveNamespaces PrefixList ("#default" = varsayılan ad alanı) */
  inclusivePrefixes?: string[];
  /** Çıktıdan çıkarılacak düğüm (enveloped-signature) */
  exclude?: XNode;
}

/** Öğe alt ağacının kanonik biçimi (C14N 1.0 ya da Exclusive C14N 1.0, yorumsuz). */
export function canonicalize(apex: XNode, opts: C14nOpts): string {
  const out: string[] = [];
  const inclusive = new Set((opts.inclusivePrefixes ?? []).map((p) => (p === "#default" ? "" : p)));
  const walk = (el: XNode, rendered: Map<string, string>, scope: Map<string, string>) => {
    // kapsam: üstten gelen + bu öğenin bildirdikleri
    const here = new Map(scope);
    const attrs: XNode[] = [];
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes.item(i);
      if (isNsDecl(a)) here.set(declPrefix(a), a.value);
      else attrs.push(a);
    }
    // çıktıya yazılacak ad alanı bildirimleri
    let candidates: string[];
    if (opts.exclusive) {
      const used = new Set<string>([el.prefix ?? ""]);
      for (const a of attrs) if (a.prefix && a.prefix !== "xml") used.add(a.prefix);
      for (const p of inclusive) if (here.has(p)) used.add(p);
      candidates = [...used];
    } else candidates = [...here.keys()];
    const decls: Array<[string, string]> = [];
    const nextRendered = new Map(rendered);
    for (const p of candidates) {
      if (p === "xml") continue;
      const uri = here.get(p) ?? "";
      const prev = rendered.get(p);
      if (p === "") {
        // xmlns="" yalnız üstte boş olmayan bir varsayılan yazılmışsa
        if (uri === "" ? prev !== undefined && prev !== "" : prev !== uri) decls.push(["", uri]);
      } else if (prev !== uri) decls.push([p, uri]);
      nextRendered.set(p, uri);
    }
    decls.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    attrs.sort((x, y) => {
      const ux = x.namespaceURI ?? "";
      const uy = y.namespaceURI ?? "";
      if (ux !== uy) return ux < uy ? -1 : 1;
      const lx = x.localName ?? x.name;
      const ly = y.localName ?? y.name;
      return lx < ly ? -1 : lx > ly ? 1 : 0;
    });
    out.push("<", el.nodeName);
    for (const [p, uri] of decls) out.push(p ? ` xmlns:${p}="${escAttr(uri)}"` : ` xmlns="${escAttr(uri)}"`);
    for (const a of attrs) out.push(" ", a.name, '="', escAttr(a.value), '"');
    out.push(">");
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c === opts.exclude) continue;
      if (c.nodeType === ELEMENT) walk(c, nextRendered, here);
      else if (c.nodeType === TEXT || c.nodeType === CDATA) out.push(escText(c.data));
      else if (c.nodeType === PI) out.push(`<?${c.target}${c.data ? " " + c.data : ""}?>`);
      // yorumlar yazılmaz
    }
    out.push("</", el.nodeName, ">");
  };
  // Tepe öğe: dahil (inclusive) kanonikleştirmede atalardan gelen bütün ad alanları yazılır; exclusive'de yalnız kullanılanlar
  const parentScope =
    apex.parentNode && apex.parentNode.nodeType === ELEMENT ? inScopeNamespaces(apex.parentNode) : new Map();
  walk(apex, new Map(), parentScope);
  return out.join("");
}

// --- DER: sertifikadan açık anahtar ---------------------------------------------------------------------------------------
interface Tlv {
  tag: number;
  start: number;
  end: number;
}
function tlv(d: Uint8Array, off: number): Tlv {
  if (off + 2 > d.length) throw new XmlSignatureError("certificate: unexpected end");
  const tag = d[off];
  let len = d[off + 1];
  let p = off + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new XmlSignatureError("certificate: bad length");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + d[p++];
  }
  if (p + len > d.length) throw new XmlSignatureError("certificate: length exceeds data");
  return { tag, start: p, end: p + len };
}
function kids(d: Uint8Array, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let p = t.start; p < t.end;) {
    const c = tlv(d, p);
    out.push(c);
    p = c.end;
  }
  return out;
}
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const OID_RSA = "2a864886f70d010101";
const OID_EC = "2a8648ce3d0201";
const CURVES: Record<string, typeof p256> = {
  "2a8648ce3d030107": p256,
  "2b81040022": p384 as unknown as typeof p256,
  "2b81040023": p521 as unknown as typeof p256,
};
type PublicKey =
  { kind: "rsa"; n: bigint; e: bigint; k: number } | { kind: "ecdsa"; curve: typeof p256; point: Uint8Array };

export function certPublicKey(der: Uint8Array): PublicKey {
  const cert = tlv(der, 0);
  const tbs = kids(der, cert)[0];
  const t = kids(der, tbs);
  const spki = t[t[0].tag === 0xa0 ? 6 : 5];
  if (!spki) throw new XmlSignatureError("certificate: no subjectPublicKeyInfo");
  const [alg, bits] = kids(der, spki);
  const algKids = kids(der, alg);
  const oid = hex(der.subarray(algKids[0].start, algKids[0].end));
  const key = der.subarray(bits.start + 1, bits.end); // BIT STRING: ilk bayt kullanılmayan bit sayısı
  if (oid === OID_RSA) {
    const seq = tlv(key, 0);
    const [nT, eT] = kids(key, seq);
    const n = BigInt("0x" + hex(key.subarray(nT.start, nT.end)));
    const e = BigInt("0x" + hex(key.subarray(eT.start, eT.end)));
    return { kind: "rsa", n, e, k: Math.ceil(n.toString(16).length / 2) };
  }
  if (oid === OID_EC) {
    const curveOid = hex(der.subarray(algKids[1].start, algKids[1].end));
    const curve = CURVES[curveOid];
    if (!curve) throw new XmlSignatureError("certificate: unsupported EC curve");
    return { kind: "ecdsa", curve, point: key };
  }
  throw new XmlSignatureError("certificate: unsupported public key algorithm");
}

// --- İmza doğrulama --------------------------------------------------------------------------------------------------------
const DIGEST_INFO: Record<HashName, string[]> = {
  sha256: ["3031300d060960864801650304020105000420", "302f300b06096086480165030402010420"],
  sha384: ["3041300d060960864801650304020205000430", "303f300b06096086480165030402020430"],
  sha512: ["3051300d060960864801650304020305000440", "304f300b06096086480165030402030440"],
};
function modPow(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}
function rsaVerify(
  key: { n: bigint; e: bigint; k: number },
  hash: HashName,
  msg: Uint8Array,
  sig: Uint8Array,
): boolean {
  if (sig.length !== key.k) return false;
  const s = BigInt("0x" + hex(sig));
  if (s >= key.n) return false;
  const em = modPow(s, key.e, key.n)
    .toString(16)
    .padStart(key.k * 2, "0");
  const h = hex(HASH_FN[hash](msg));
  return DIGEST_INFO[hash].some((di) => {
    const t = di + h;
    const ps = key.k * 2 - 6 - t.length; // 00 01 PS 00 T
    if (ps < 16) return false;
    return em === "0001" + "f".repeat(ps) + "00" + t;
  });
}

export interface XmlSignatureResult {
  /** İmzacı sertifikası (DER) ve SHA-256 parmak izi (onaltılık, küçük harf) */
  signerDer: Uint8Array;
  signerFingerprint: string;
  /** Doğrulanmış belge (yalnız bu DOM'dan okunur — imza sarma saldırısına karşı) */
  root: XNode;
  /** İmza öğesi (veri okunurken atlanır) */
  signature: XNode;
}

/** XML'i ayrıştırır. DTD (DOCTYPE) reddedilir: varlık genişletme ve dış varlık saldırılarına kapı açmaz. */
export function parseXml(xml: string): XNode {
  if (/<!DOCTYPE/i.test(xml)) throw new XmlSignatureError("DTD not allowed");
  const errors: string[] = [];
  const doc = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (m: string) => errors.push(m),
      fatalError: (m: string) => errors.push(m),
    },
  }).parseFromString(xml, "application/xml");
  if (errors.length || !doc?.documentElement)
    throw new XmlSignatureError(`XML not well-formed: ${errors[0] ?? "empty"}`);
  return doc;
}

function elementById(root: XNode, id: string): XNode | undefined {
  const found: XNode[] = [];
  const visit = (el: XNode) => {
    for (const n of ["Id", "ID", "id"]) if (el.getAttribute && el.getAttribute(n) === id) found.push(el);
    for (const c of childElements(el)) visit(c);
  };
  visit(root);
  if (found.length > 1) throw new XmlSignatureError(`duplicate Id ${id}`);
  return found[0];
}

function transformsOf(ref: XNode): Array<{ alg: string; prefixes?: string[] }> {
  const ts = xmlChild(ref, DSIG_NS, "Transforms");
  if (!ts) return [];
  return xmlChildren(ts, DSIG_NS, "Transform").map((t) => {
    const alg = String(t.getAttribute("Algorithm") ?? "");
    const inc = childElements(t).find((c) => c.localName === "InclusiveNamespaces" && c.namespaceURI === EXC_C14N);
    const pl = inc?.getAttribute("PrefixList");
    return { alg, ...(pl ? { prefixes: String(pl).trim().split(/\s+/) } : {}) };
  });
}

/**
 * Zarflanmış XML imzasını doğrular. Kökün tek bir `ds:Signature` çocuğu olmalı; `SignedInfo` bütün belgeyi kapsayan URI=""
 * başvurusunu taşımalı (yoksa liste imzalı sayılmaz). Bütün başvuruların özeti ve imza değeri tutmalı. Dönen DOM yalnız
 * doğrulanmış içeriktir. Güven (imzacının kim olduğu) çağıranın denetimidir.
 */
export function verifyEnvelopedXmlSignature(xml: string): XmlSignatureResult {
  const doc = parseXml(xml);
  const root = doc.documentElement;
  const sigs = xmlChildren(root, DSIG_NS, "Signature");
  if (sigs.length !== 1)
    throw new XmlSignatureError(`expected exactly one ds:Signature under the root (found ${sigs.length})`);
  const sig = sigs[0];
  const si = xmlChild(sig, DSIG_NS, "SignedInfo");
  if (!si) throw new XmlSignatureError("SignedInfo missing");
  const cm = String(xmlChild(si, DSIG_NS, "CanonicalizationMethod")?.getAttribute("Algorithm") ?? "");
  if (cm !== C14N && cm !== EXC_C14N) throw new XmlSignatureError(`unsupported CanonicalizationMethod ${cm}`);
  const sm = String(xmlChild(si, DSIG_NS, "SignatureMethod")?.getAttribute("Algorithm") ?? "");
  const alg = SIG_ALGS[sm];
  if (!alg) throw new XmlSignatureError(`unsupported SignatureMethod ${sm}`);

  // başvurular
  let coversDocument = false;
  const refs = xmlChildren(si, DSIG_NS, "Reference");
  if (!refs.length) throw new XmlSignatureError("no Reference");
  for (const ref of refs) {
    const uri = ref.getAttribute("URI");
    if (uri === null || uri === undefined) throw new XmlSignatureError("Reference without URI");
    const target = uri === "" ? root : uri.startsWith("#") ? elementById(root, uri.slice(1)) : undefined;
    if (!target) throw new XmlSignatureError(`Reference target not found: ${uri}`);
    let exclude: XNode | undefined;
    let c14n: C14nOpts | undefined;
    for (const t of transformsOf(ref)) {
      if (t.alg === ENVELOPED) {
        if (c14n) throw new XmlSignatureError("enveloped-signature after canonicalization");
        exclude = sig;
      } else if (t.alg === EXC_C14N) c14n = { exclusive: true, inclusivePrefixes: t.prefixes, exclude };
      else if (t.alg === C14N) c14n = { exclusive: false, exclude };
      else throw new XmlSignatureError(`unsupported Transform ${t.alg}`);
    }
    if (uri === "" && exclude !== sig)
      throw new XmlSignatureError("the whole-document Reference must use the enveloped-signature transform");
    const opts = c14n ?? { exclusive: false, exclude };
    // bütün belge: kök öğe (kök dışı işleme talimatı ve yorum TL'de yoktur; xml bildirimi düğüm değildir)
    const octets = new TextEncoder().encode(canonicalize(target, { ...opts, exclude: opts.exclude ?? exclude }));
    const dm = String(xmlChild(ref, DSIG_NS, "DigestMethod")?.getAttribute("Algorithm") ?? "");
    const dig = DIGESTS[dm];
    if (!dig) throw new XmlSignatureError(`unsupported DigestMethod ${dm}`);
    const expected = b64ToBytes(xmlText(xmlChild(ref, DSIG_NS, "DigestValue")));
    const got = dig(octets);
    if (expected.length !== got.length || hex(expected) !== hex(got))
      throw new XmlSignatureError(`digest mismatch for Reference ${uri === "" ? '""' : uri}`);
    if (uri === "") coversDocument = true;
  }
  if (!coversDocument) throw new XmlSignatureError('no Reference covers the whole document (URI="")');

  // imza değeri
  const keyInfo = xmlChild(sig, DSIG_NS, "KeyInfo");
  const certEl = keyInfo && xmlChild(xmlChild(keyInfo, DSIG_NS, "X509Data") ?? keyInfo, DSIG_NS, "X509Certificate");
  if (!certEl) throw new XmlSignatureError("KeyInfo/X509Data/X509Certificate missing");
  const signerDer = b64ToBytes(xmlText(certEl));
  const key = certPublicKey(signerDer);
  const cmEl = xmlChild(si, DSIG_NS, "CanonicalizationMethod");
  const cmInc = childElements(cmEl).find((c) => c.localName === "InclusiveNamespaces" && c.namespaceURI === EXC_C14N);
  const cmPrefixes = cmInc?.getAttribute("PrefixList")
    ? String(cmInc.getAttribute("PrefixList")).trim().split(/\s+/)
    : [];
  const signedInfo = new TextEncoder().encode(
    canonicalize(si, { exclusive: cm === EXC_C14N, inclusivePrefixes: cmPrefixes }),
  );
  const sv = b64ToBytes(xmlText(xmlChild(sig, DSIG_NS, "SignatureValue")));
  let ok: boolean;
  if (alg.kind === "rsa") {
    if (key.kind !== "rsa") throw new XmlSignatureError("SignatureMethod is RSA but the certificate key is not");
    ok = rsaVerify(key, alg.hash, signedInfo, sv);
  } else {
    if (key.kind !== "ecdsa") throw new XmlSignatureError("SignatureMethod is ECDSA but the certificate key is not");
    try {
      ok = key.curve.verify(sv, HASH_FN[alg.hash](signedInfo), key.point, { prehash: false, lowS: false });
    } catch {
      ok = false;
    }
  }
  if (!ok) throw new XmlSignatureError("signature value does not verify");
  return { signerDer, signerFingerprint: sha256HexPortable(signerDer), root, signature: sig };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
