/**
 * ADR-0087 — erişim sertifikalarının (WRPAC, X.509) iptal listesi: RFC 5280 v2 CRL, ETSI TS 119 411-8 REV-6.3.9-04.
 *
 * - Ayar (K3; adres ADR-0090): kayıt defterinin `roles.access_ca.crl` ayarı (`issuers[]`: `ca` = PKI'daki makam sertifikasının adı,
 *   `uri` = CRL'in `http` adresi, ayrı CRL alan adının kökünde: `http://crl.<ağ>/<ad>.crl`; `https` eşi aynı yoldan türetilir,
 *   `crlUrisOf`). Dosya yayın klasöründe `crl/<ad>.crl` olarak durur; CRL alan adı o klasörü iki şemadan yönlendirmesiz sunar.
 *   Ayar yoksa hiçbir şey yapılmaz; ayar LOTL'e yazılmaz (yayıncının iç ayarıdır).
 * - İptal (K5, her yayında): doğrulayıcının kaydı askıya alınınca ya da iptal edilince erişim sertifikası `privilegeWithdrawn`,
 *   kayıt sona erince (`RETIRED`) `cessationOfOperation`, sertifika kayıttan kalkınca (yenisiyle değişti) `superseded` ile iptal
 *   edilir. Askı için `certificateHold` KULLANILMAZ (K6): iptal kesindir, kayıt yeniden etkin olunca yeni sertifika verilir.
 *   Elle iptal (`crl-revoke`) `keyCompromise` ve ötekiler için. İptal edilen sertifika listeden çıkmaz.
 * - Tutarlılık (AR3): etkin (`ACTIVE`) bir doğrulayıcının kaydı iptal edilmiş bir erişim sertifikasını gösteremez → yayın durur.
 * - İmza (K4): CRL'i sertifikayı veren makam imzalar (doğrudan CRL; dolaylı CRL ya da ayrı CRL imzacısı yok). Makamın özel anahtarı
 *   yayıncının PKI klasöründeyse liste her yayında ve her saatlik heartbeat'te yeniden imzalanır (`nextUpdate` = 24 saat). Anahtar
 *   yoksa (çevrim dışı kök) makamın kendi bilgisayarında imzalanmış `<ad>.crl` kopyası PKI klasöründen alınır, imzası ve kapsamı
 *   denetlenip yayımlanır; eksik iptal ya da süresi dolmuş kopya `[!] crl:` uyarısı verir (liste yine yayımlanır: asıl güven kaynağı
 *   imzalı listedir, askıyı CRL yüzünden geciktirmek daha kötüdür).
 * - Durum (`access-crl-state.json`, yayın klasöründe): makam başına CRL sayacı (`crl_number`, RFC 5280 §5.2.3 tekdüze), görülen
 *   sertifikalar ve iptaller. Dosya kaybolursa yayımlanmış CRL'den kurulur (iptaller CRL'in kendisinde imzalıdır; kaybolan yalnız
 *   "görülen sertifikalar" listesidir). Kişisel veri yok: kurum sertifikalarının seri numarası, parmak izi ve alan adı.
 */
import { X509Certificate as NodeX509 } from "node:crypto";
import { webcrypto } from "node:crypto";
import {
  AuthorityKeyIdentifierExtension,
  Extension,
  SubjectKeyIdentifierExtension,
  X509Certificate,
  X509Crl,
  X509CrlGenerator,
  X509CrlReason,
  cryptoProvider,
} from "@peculiar/x509";

import { crlHostOf, crlUrisOf } from "../../../ops/crl-dp.js";

cryptoProvider.set(webcrypto as unknown as Crypto);

/** Kayıt defterindeki ayar (`national_lists[].roles.access_ca.crl`). */
export interface AccessCrlConfig {
  issuers: Array<{ ca: string; uri: string }>;
}
/** `nextUpdate` aralığı (saniye): 24 saat; liste her saatlik heartbeat'te yeniden imzalanır (AR2). */
export const ACCESS_CRL_NEXT_UPDATE_SEC = 86400;
/** Süresi dolmak üzere olan çevrim dışı CRL için uyarı eşiği (gün). */
export const OFFLINE_CRL_WARN_DAYS = 30;

/** İptal gerekçeleri (kapalı küme) → RFC 5280 §5.3.1 reasonCode. `certificateHold` bilerek yok (ADR-0087 K6). */
export const ACCESS_CRL_REASONS = {
  key_compromise: X509CrlReason.keyCompromise,
  affiliation_changed: X509CrlReason.affiliationChanged,
  superseded: X509CrlReason.superseded,
  cessation_of_operation: X509CrlReason.cessationOfOperation,
  privilege_withdrawn: X509CrlReason.privilegeWithdrawn,
} as const;
export type AccessCrlReason = keyof typeof ACCESS_CRL_REASONS;

export interface KnownAccessCert {
  serial: string;
  fingerprint_sha256: string;
  dns_name: string;
  not_after: string;
}
export interface RevokedAccessCert extends KnownAccessCert {
  revoked_at: string;
  reason: AccessCrlReason;
}
export interface AccessCrlIssuerState {
  ca: string;
  uri: string;
  /** son imzalanan CRL'in numarası (RFC 5280 §5.2.3); sonraki imza +1 */
  crl_number: number;
  known: KnownAccessCert[];
  revoked: RevokedAccessCert[];
}
export interface AccessCrlState {
  issuers: AccessCrlIssuerState[];
}

/** Bir doğrulayıcı kaydının erişim sertifikası (yayıncının sertifikadan okuduğu değerler). `ca`: veren makam (ayardaki ad) ya da null. */
export interface RpAccessCertView {
  dns_name: string;
  status: string;
  serial: string;
  fingerprint_sha256: string;
  not_after: string;
  ca: string | null;
}

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * ADR-0090 K1/K3: CRL alan adı (`trust.tamga.network` → `crl.tamga.network`) ve dağıtım noktasının iki adresi (önce `http`, sonra
 * aynı yolun `https` adresi). Tek kaynak `ops/crl-dp.ts` (sertifika veren araçlar da onu kullanır); burada yeniden dışa açılır.
 */
export { crlHostOf, crlUrisOf };

/** Ayar denetimi; boş dizi = geçerli. `publicBase` = güven listesi yayın kökü (ör. https://trust.tamga.network). */
export function accessCrlConfigProblems(cfg: unknown, publicBase: string): string[] {
  const p: string[] = [];
  const c = cfg as Partial<AccessCrlConfig> | null;
  if (!c || typeof c !== "object" || !Array.isArray(c.issuers) || !c.issuers.length)
    return ["access_ca.crl: { issuers: [{ ca, uri }] } biçiminde en az bir makam"];
  const seenCa = new Set<string>();
  const seenUri = new Set<string>();
  for (const [i, it] of c.issuers.entries()) {
    const w = `access_ca.crl.issuers[${i}]`;
    if (!it || typeof it !== "object") {
      p.push(`${w}: nesne olmalı`);
      continue;
    }
    let caOk = false;
    if (typeof it.ca !== "string" || !NAME_RE.test(it.ca))
      p.push(`${w}.ca: PKI'daki sertifika adı (küçük harf, rakam, tire)`);
    else if (seenCa.has(it.ca)) p.push(`${w}.ca: ${it.ca} iki kez`);
    else {
      seenCa.add(it.ca);
      caOk = true;
    }
    let u: URL | null = null;
    try {
      u = new URL(String(it.uri));
    } catch {
      p.push(`${w}.uri: geçersiz adres`);
    }
    if (!u) continue;
    const host = crlHostOf(publicBase);
    if (u.protocol !== "http:" || u.host !== host || u.username || u.password)
      p.push(`${w}.uri: CRL alan adında http adresi olmalı (http://${host}/<ad>.crl; https eşi türetilir — ADR-0090)`);
    if (!/^\/[a-z0-9][a-z0-9-]*\.crl$/.test(u.pathname) || u.search || u.hash)
      p.push(`${w}.uri: yol /<ad>.crl biçiminde, alan adının kökünde (küçük harf, rakam, tire)`);
    // ADR-0090: yol makamın adıdır (`/<makam>.crl`) — başka makamın CRL dosyasına yazılmasın (pki-issue de aynı kuralı denetler)
    else if (caOk && u.pathname !== `/${it.ca}.crl`) p.push(`${w}.uri: yol makamın adı olmalı (/${it.ca}.crl)`);
    if (seenUri.has(u.href)) p.push(`${w}.uri: ${u.href} iki kez`);
    seenUri.add(u.href);
  }
  return p;
}

/** CRL'in yayın klasöründeki dosyası: `crl/<ad>.crl` (CRL alan adının kökü bu klasördür; ADR-0090). */
export const crlFileOf = (uri: string) => "crl" + new URL(uri).pathname;

export const emptyAccessCrlState = (): AccessCrlState => ({ issuers: [] });

/** Seri numarası karşılaştırma biçimi: küçük harf onaltılık, baştaki sıfırlar atılır. */
const serialKey = (s: string) => s.toLowerCase().replace(/^0+(?=.)/, "");
/**
 * Aynı makamın iptal kaydı bu sertifikayı mı gösteriyor: parmak iziyle ya da (seri numarası makam içinde tektir, RFC 5280 §4.1.2.2)
 * seri numarasıyla — yayımlanmış CRL'den kurulan durumda parmak izi bilinmez (`recoverIssuerState`).
 */
type CertKey = Pick<KnownAccessCert, "serial" | "fingerprint_sha256">;
const sameCert = (r: CertKey, c: CertKey) =>
  r.fingerprint_sha256 === c.fingerprint_sha256 || serialKey(r.serial) === serialKey(c.serial);

/** Doğrulayıcı durumundan iptal gerekçesi; `ACTIVE` → null. */
export function reasonForRpStatus(status: string): AccessCrlReason | null {
  if (status === "ACTIVE") return null;
  if (status === "RETIRED") return "cessation_of_operation";
  return "privilege_withdrawn"; // SUSPENDED, REVOKED (ve bilinmeyen her durum: güvenli taraf)
}

export interface AccessRevocationPlan {
  state: AccessCrlState;
  /** bu yayında iptal edilenler (makam adıyla) */
  revoked: Array<RevokedAccessCert & { ca: string }>;
  /** AR3: etkin doğrulayıcının kaydı iptal edilmiş sertifikayı gösteriyor → yayın durur */
  problems: string[];
}

/**
 * Bu yayının doğrulayıcı kayıtlarına göre iptalleri planlar (bkz. dosya başı). Durum değiştirilmez; yeni durum döner. Ayardan
 * kalkan makamın durumu korunur (iptaller kaybolmaz) ama CRL'i artık imzalanmaz.
 */
export function planAccessRevocations(
  prev: AccessCrlState,
  cfg: AccessCrlConfig,
  rps: RpAccessCertView[],
  now: Date,
): AccessRevocationPlan {
  const at = now.toISOString();
  const issuers = prev.issuers.map((s) => ({ ...s, known: s.known.map((k) => ({ ...k })), revoked: [...s.revoked] }));
  const revoked: AccessRevocationPlan["revoked"] = [];
  const problems: string[] = [];
  for (const c of cfg.issuers) {
    let s = issuers.find((x) => x.ca === c.ca);
    if (!s) {
      s = { ca: c.ca, uri: c.uri, crl_number: 0, known: [], revoked: [] };
      issuers.push(s);
    }
    s.uri = c.uri;
    const mine = rps.filter((r) => r.ca === c.ca);
    const isRevoked = (k: CertKey) => s!.revoked.some((r) => sameCert(r, k));
    const revoke = (k: KnownAccessCert, reason: AccessCrlReason) => {
      const e: RevokedAccessCert = { ...k, revoked_at: at, reason };
      s!.revoked.push(e);
      revoked.push({ ...e, ca: c.ca });
    };
    for (const r of mine) {
      const k: KnownAccessCert = {
        serial: r.serial,
        fingerprint_sha256: r.fingerprint_sha256,
        dns_name: r.dns_name,
        not_after: r.not_after,
      };
      if (isRevoked(k)) {
        if (r.status === "ACTIVE")
          problems.push(
            `AR3: ${r.dns_name} etkin ama erişim sertifikası iptal listesinde (seri ${r.serial}) — yeni erişim sertifikası verin ` +
              `(pki-issue --key … --replace) ve kayıttaki access_cert'i güncelleyin`,
          );
        continue;
      }
      if (!s.known.some((x) => x.fingerprint_sha256 === k.fingerprint_sha256)) s.known.push(k);
      const reason = reasonForRpStatus(r.status);
      if (reason) revoke(k, reason);
    }
    // kayıttan kalkan (yenisiyle değişen ya da kaydı listeden çıkan) ve süresi dolmamış sertifika → superseded
    const referenced = new Set(mine.map((r) => r.fingerprint_sha256));
    for (const k of s.known)
      if (!referenced.has(k.fingerprint_sha256) && !isRevoked(k) && Date.parse(k.not_after) > now.getTime())
        revoke(k, "superseded");
    // görülen listesinde yalnız kayıtta duran ve iptal edilmemiş sertifikalar kalır
    s.known = s.known.filter((k) => referenced.has(k.fingerprint_sha256) && !isRevoked(k));
  }
  return { state: { issuers }, revoked, problems };
}

/** Elle iptal (`crl-revoke`): sertifika makamın durumuna iptal olarak eklenir; zaten iptalse hata. */
export function revokeAccessCert(
  prev: AccessCrlState,
  ca: string,
  cert: KnownAccessCert,
  reason: string,
  now: Date,
): { state: AccessCrlState; entry: RevokedAccessCert } {
  if (!(reason in ACCESS_CRL_REASONS))
    throw new Error(
      `crl-revoke: gerekçe ${Object.keys(ACCESS_CRL_REASONS).join(" | ")} olmalı (certificateHold yok, ADR-0087 K6)`,
    );
  const s = prev.issuers.find((x) => x.ca === ca);
  if (!s) throw new Error(`crl-revoke: ${ca} için CRL durumu yok (önce build)`);
  if (s.revoked.some((r) => sameCert(r, cert)))
    throw new Error(`crl-revoke: ${cert.dns_name} sertifikası (seri ${cert.serial}) zaten iptal`);
  const entry: RevokedAccessCert = { ...cert, revoked_at: now.toISOString(), reason: reason as AccessCrlReason };
  const issuers = prev.issuers.map((x) =>
    x.ca === ca
      ? {
          ...x,
          known: x.known.filter((k) => k.fingerprint_sha256 !== cert.fingerprint_sha256),
          revoked: [...x.revoked, entry],
        }
      : x,
  );
  return { state: { issuers }, entry };
}

/** RFC 5280 §5.2.3 CRLNumber uzantısı (2.5.29.20, kritik değil): DER INTEGER, pozitif. */
export function crlNumberExtension(n: number): Extension {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`CRL numarası geçersiz: ${n}`);
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let bytes = Buffer.from(hex, "hex");
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return new Extension("2.5.29.20", false, new Uint8Array([0x02, bytes.length, ...bytes]));
}
/** CRL'deki CRLNumber değeri (yoksa null). */
export function crlNumberOf(crl: X509Crl): number | null {
  const e = crl.extensions.find((x) => x.type === "2.5.29.20");
  if (!e) return null;
  const v = new Uint8Array(e.value);
  if (v[0] !== 0x02) return null;
  return Number.parseInt(Buffer.from(v.slice(2, 2 + v[1])).toString("hex") || "0", 16);
}

const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const pemBody = (pem: string) => Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");

/** Makamın konu adı ve anahtar tanımlayıcısıyla CRL imzalar (v2; AKI + CRLNumber; girdi başına reasonCode). DER döner. */
export async function signAccessCrl(p: {
  caCertPem: string;
  caKeyPem: string;
  entries: RevokedAccessCert[];
  crlNumber: number;
  now: Date;
  nextUpdateSec?: number;
}): Promise<Uint8Array> {
  const ca = new X509Certificate(p.caCertPem);
  const key = await webcrypto.subtle.importKey("pkcs8", pemBody(p.caKeyPem), ALG, false, ["sign"]);
  const ski = ca.getExtension(SubjectKeyIdentifierExtension)?.keyId;
  const aki = ski
    ? new AuthorityKeyIdentifierExtension(ski)
    : await AuthorityKeyIdentifierExtension.create(ca.publicKey, false, webcrypto as unknown as Crypto);
  const crl = await X509CrlGenerator.create({
    issuer: ca.subjectName, // DER olarak aynen (ad karşılaştırması bayt bayt tutsun)
    thisUpdate: p.now,
    nextUpdate: new Date(p.now.getTime() + (p.nextUpdateSec ?? ACCESS_CRL_NEXT_UPDATE_SEC) * 1000),
    signingAlgorithm: ALG,
    signingKey: key,
    extensions: [aki, crlNumberExtension(p.crlNumber)],
    entries: p.entries.map((e) => ({
      serialNumber: e.serial,
      revocationDate: new Date(e.revoked_at),
      reason: ACCESS_CRL_REASONS[e.reason],
    })),
  });
  return new Uint8Array(crl.rawData);
}

/**
 * Yayımlanacak bir CRL'in denetimi (çevrim dışı imzalanmış kopya ve kendi ürettiğimiz CRL için ortak): makam imzası, düzenleyen ad,
 * süre, gerekli seri numaraları. Boş dizi = sorun yok. `warnings`: süresi yaklaşan kopya.
 */
export async function crlProblems(
  der: Uint8Array,
  caCertPem: string,
  requiredSerials: string[],
  now: Date,
): Promise<{ problems: string[]; warnings: string[] }> {
  const problems: string[] = [];
  const warnings: string[] = [];
  let crl: X509Crl;
  try {
    crl = new X509Crl(new Uint8Array(der));
  } catch (e) {
    return { problems: [`CRL okunamadı: ${(e as Error).message}`], warnings };
  }
  const ca = new X509Certificate(caCertPem);
  if (!Buffer.from(crl.issuerName.toArrayBuffer()).equals(Buffer.from(ca.subjectName.toArrayBuffer())))
    problems.push(`CRL'i düzenleyen (${crl.issuer}) makamın konu adı değil (${ca.subject})`);
  if (!(await crl.verify({ publicKey: ca }, webcrypto as unknown as Crypto)))
    problems.push("CRL imzası makamın anahtarıyla doğrulanmadı");
  if (crl.thisUpdate.getTime() > now.getTime() + 300_000) problems.push("CRL thisUpdate ileri tarihli");
  const next = crl.nextUpdate;
  if (!next) problems.push("CRL nextUpdate yok (RFC 5280 §5.1.2.5: bu profilde zorunlu)");
  else if (next.getTime() <= now.getTime()) problems.push(`CRL süresi dolmuş (nextUpdate ${next.toISOString()})`);
  else if (next.getTime() - now.getTime() < OFFLINE_CRL_WARN_DAYS * 86400_000)
    warnings.push(`CRL ${next.toISOString()} tarihinde doluyor — yeniden imzalayın`);
  if (crlNumberOf(crl) === null) problems.push("CRL'de CRLNumber yok (RFC 5280 §5.2.3)");
  for (const s of requiredSerials)
    if (!crl.findRevoked(s)) problems.push(`CRL'de iptal edilmesi gereken seri yok: ${s}`);
  return { problems, warnings };
}

/** Yayımlanmış CRL'den durum kurar (durum dosyası kaybolduysa): iptaller ve CRL numarası; görülen listesi boş başlar. */
export function recoverIssuerState(ca: string, uri: string, der: Uint8Array, now: Date): AccessCrlIssuerState {
  const crl = new X509Crl(new Uint8Array(der));
  const byCode = new Map<number, AccessCrlReason>(
    Object.entries(ACCESS_CRL_REASONS).map(([k, v]) => [v as number, k as AccessCrlReason]),
  );
  return {
    ca,
    uri,
    crl_number: crlNumberOf(crl) ?? 0,
    known: [],
    revoked: crl.entries.map((e) => ({
      serial: e.serialNumber,
      fingerprint_sha256: `unknown-${e.serialNumber.toLowerCase()}`,
      dns_name: "(recovered)",
      not_after: now.toISOString(),
      revoked_at: e.revocationDate.toISOString(),
      reason: (e.reason !== undefined && byCode.get(e.reason)) || "privilege_withdrawn",
    })),
  };
}

/** Sertifikayı ayardaki makamlardan hangisi verdi (ad + imza denetimi); hiçbiri değilse null. */
export function issuingCaOf(leafPem: string, cas: Array<{ ca: string; certPem: string }>): string | null {
  const leaf = new NodeX509(leafPem);
  for (const c of cas) {
    const caCert = new NodeX509(c.certPem);
    if (leaf.checkIssued(caCert) && leaf.verify(caCert.publicKey)) return c.ca;
  }
  return null;
}

/** Sertifikanın CRL'de geçen seri numarası (DER INTEGER'ın baytları, onaltılık) ve bitişi. */
export function accessCertFacts(pem: string): { serial: string; not_after: string } {
  const c = new X509Certificate(pem);
  return { serial: c.serialNumber, not_after: c.notAfter.toISOString() };
}
