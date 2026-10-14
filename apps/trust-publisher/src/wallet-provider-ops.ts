/**
 * Cüzdan sağlayıcı kayıt aracı (ADR-0042: ağ cüzdan sağlayıcı işletmez, yalnız listeler) — `lotl.source.json`
 * `wallet_providers[]` kaydını elle düzenlemeden etkinleştirmek, askıya almak, geri çekmek. Saf fonksiyonlar: kaynak nesnesini
 * alır, yenisini döner ya da sorunların TAMAMINI tek hatada bildirir. Dosya yazımı `cli.ts`'te (`wallet-provider …`).
 *
 * Sertifika denetimi FW-POL-0002 (cüzdan kanıt politikası) ve ADR-0025'e göre: WIA, KA ve iptal listesi imza anahtarı ES256
 * (P-256, RB-AP-04); anahtar yalnız imza içindir (digitalSignature; sertifika ya da CRL imzalamaz, CA değildir); sertifika
 * geçerlilik süresi içindedir. Gerçek ağa "(TEST)" konu adlı sertifika girmez (ADR-0038 SB1).
 *
 * Sağlayıcı sertifika profili (ETSI TS 119 412-6 V1.2.1 §5, AB uyum turu 2026-10-13 KA-412-6-2): konu alanında
 * `organizationIdentifier` (2.5.4.97, EN 319 412-1 semantik tanımlayıcı: `VATTR-<VKN>`, `NTRTR-<MERSİS>`, `LEIXG-<LEI>`) ve
 * kayıttaki `identifiers[]`'dan türetilen değerle aynı; qcStatements'ta QcType `id-etsi-qct-wal` (0.4.0.194126.1.2, WAL-5.2-01).
 * İstisna yalnız sandbox'taki "(TEST)" sertifikalar (ağın deneme sahneleri ve uyum testi araçları; ADR-0042 K5, ADR-0038 SB1).
 */
import { X509Certificate as PX509, KeyUsageFlags, KeyUsagesExtension, BasicConstraintsExtension } from "@peculiar/x509";
import { X509Certificate } from "node:crypto";
import { certFingerprintSha256Hex, pemToDer } from "@tamga-network/trust";
import { RegistryError } from "./registry-ops.js";
import { semanticIdentifier } from "./wrprc.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

export type WpEnvironment = "production" | "sandbox";
export const WP_STATUSES = ["ACTIVE", "SUSPENDED", "REVOKED"] as const;
/** Sertifikanın bundan az kalan ömrü uyarı verir (anahtar değişimi zamanı). */
export const WP_CERT_WARN_DAYS = 90;
const PROVIDER_ID = /^[A-Z0-9][A-Z0-9-]{2,63}$/;
/** id-pe-qcStatements (RFC 3739), id-etsi-qcs-QcType (EN 319 412-5 §4.2.3), id-etsi-qct-wal (TS 119 412-6 WAL-5.2-01). */
export const OID_QC_STATEMENTS = "1.3.6.1.5.5.7.1.3";
export const OID_QCS_QCTYPE = "0.4.0.1862.1.6";
export const OID_QCT_WAL = "0.4.0.194126.1.2";

// En küçük DER okuyucu (qcStatements için): etiket, içerik aralığı, alt öğeler, OID metni.
interface Tlv {
  tag: number;
  start: number;
  end: number;
}
function tlv(b: Uint8Array, off: number, limit = b.length): Tlv {
  if (off + 2 > limit) throw new Error("DER: kısa");
  const tag = b[off];
  let len = b[off + 1];
  let p = off + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 3 || p + n > limit) throw new Error("DER: uzunluk");
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | b[p++];
  }
  if (p + len > limit) throw new Error("DER: taşma");
  return { tag, start: p, end: p + len };
}
function kids(b: Uint8Array, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let p = t.start; p < t.end;) {
    const c = tlv(b, p, t.end);
    out.push(c);
    p = c.end;
  }
  return out;
}
function oidText(b: Uint8Array, t: Tlv): string {
  const v = b.subarray(t.start, t.end);
  if (!v.length) throw new Error("DER: boş OID");
  const parts: number[] = [];
  let n = 0;
  for (const x of v) {
    n = n * 128 + (x & 0x7f);
    if (!(x & 0x80)) {
      parts.push(n);
      n = 0;
    }
  }
  const first = parts.shift()!;
  const head = first < 40 ? [0, first] : first < 80 ? [1, first - 40] : [2, first - 80];
  return [...head, ...parts].join(".");
}

/** qcStatements uzantısındaki QcType OID'leri (EN 319 412-5 §4.2.3). Uzantı yoksa boş; bozuksa hata. */
export function qcTypesOf(extValue: Uint8Array): string[] {
  const root = tlv(extValue, 0);
  if (root.tag !== 0x30) throw new Error("qcStatements SEQUENCE değil");
  const out: string[] = [];
  for (const st of kids(extValue, root)) {
    if (st.tag !== 0x30) throw new Error("QCStatement SEQUENCE değil");
    const [id, info] = kids(extValue, st);
    if (id?.tag !== 0x06) throw new Error("QCStatement statementId yok");
    if (oidText(extValue, id) !== OID_QCS_QCTYPE || !info) continue;
    if (info.tag !== 0x30) throw new Error("QcType statementInfo SEQUENCE değil");
    for (const o of kids(extValue, info)) if (o.tag === 0x06) out.push(oidText(extValue, o));
  }
  return out;
}

/** Ad kuralı (proje yönetimi onayı 2026-10-13): `wallet-provider-<provider_id küçük harfle>` → `keys/<ad>.cert.pem`. */
export function walletProviderCertName(providerId: string): string {
  if (!PROVIDER_ID.test(providerId)) throw new RegistryError([`provider_id: büyük harf, rakam, tire (${providerId})`]);
  return `wallet-provider-${providerId.toLowerCase()}`;
}

export interface WpCertInfo {
  pem: string;
  fingerprint: string;
  subject: string;
  notBefore: Date;
  notAfter: Date;
  selfSigned: boolean;
  isTest: boolean;
  /** konu alanındaki organizationIdentifier (2.5.4.97); yoksa null */
  organizationIdentifier: string | null;
  /** qcStatements'taki QcType OID'leri */
  qcTypes: string[];
  /** sağlayıcı profili (organizationIdentifier + QcType wal) bu ortamda zorunlu mu (sandbox "(TEST)" sertifikada değil) */
  profileRequired: boolean;
  warnings: string[];
}

/**
 * Sağlayıcı imza sertifikasını denetler (PEM, tek sertifika, özel anahtar yok). Sorun varsa hepsini tek RegistryError'da verir.
 * `environment` production ise "(TEST)" sertifika reddedilir (SB1).
 */
export function inspectWalletProviderCert(
  pemText: string,
  opts: { now: Date; environment?: WpEnvironment },
): WpCertInfo {
  const p: string[] = [];
  if (/PRIVATE KEY/.test(pemText)) throw new RegistryError(["dosyada özel anahtar var — yalnız sertifika verilir"]);
  const blocks = pemText.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  if (blocks.length !== 1) throw new RegistryError([`tek bir PEM sertifikası olmalı (bulunan: ${blocks.length})`]);
  let x: X509Certificate;
  let px: PX509;
  try {
    x = new X509Certificate(blocks[0]);
    px = new PX509(blocks[0]);
  } catch (e) {
    throw new RegistryError([`sertifika okunamadı: ${(e as Error).message}`]);
  }
  const key = x.publicKey;
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1")
    p.push(
      `anahtar EC P-256 olmalı (ES256, RB-AP-04); bulunan: ${key.asymmetricKeyType}/${key.asymmetricKeyDetails?.namedCurve ?? "-"}`,
    );
  const sig = px.signatureAlgorithm as { name?: string; hash?: { name?: string } };
  if (sig.name !== "ECDSA" || sig.hash?.name !== "SHA-256")
    p.push(`imza algoritması ecdsa-with-SHA256 olmalı; bulunan: ${sig.name ?? "?"}/${sig.hash?.name ?? "?"}`);
  const notBefore = new Date(x.validFrom);
  const notAfter = new Date(x.validTo);
  if (notBefore.getTime() > opts.now.getTime())
    p.push(`sertifika henüz geçerli değil (notBefore ${notBefore.toISOString()})`);
  if (notAfter.getTime() <= opts.now.getTime())
    p.push(`sertifikanın süresi dolmuş (notAfter ${notAfter.toISOString()})`);
  const bc = px.getExtension(BasicConstraintsExtension);
  if (bc?.ca) p.push("sertifika CA olmamalı (basicConstraints CA:FALSE)");
  const ku = px.getExtension(KeyUsagesExtension);
  if (!ku) p.push("keyUsage uzantısı yok (digitalSignature gerekli)");
  else {
    if (!(ku.usages & KeyUsageFlags.digitalSignature)) p.push("keyUsage digitalSignature içermeli");
    if (ku.usages & (KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign))
      p.push(
        "keyUsage keyCertSign/cRLSign içermemeli (anahtar yalnız WIA, KA ve iptal listesi imzalar — FW-POL-0002 7.5.4)",
      );
  }
  const isTest = /\(TEST\)/.test(x.subject);
  if (isTest && opts.environment === "production")
    p.push("SB1: konu adında (TEST) — test sertifikası gerçek listeye girmez");
  // ETSI TS 119 412-6 §5 sağlayıcı profili — sandbox'taki test sertifikaları hariç her yerde zorunlu
  const profileRequired = !(isTest && opts.environment === "sandbox");
  const orgLine = x.subject.split("\n").find((l) => /^(organizationIdentifier|2\.5\.4\.97)=/.test(l));
  const organizationIdentifier = orgLine ? orgLine.slice(orgLine.indexOf("=") + 1).trim() || null : null;
  let qcTypes: string[] = [];
  const qcExt = px.getExtension(OID_QC_STATEMENTS);
  if (qcExt) {
    try {
      qcTypes = qcTypesOf(new Uint8Array(qcExt.value));
    } catch (e) {
      p.push(`qcStatements uzantısı okunamadı: ${(e as Error).message}`);
    }
  }
  if (profileRequired) {
    if (!organizationIdentifier)
      p.push(
        "konu alanında organizationIdentifier (2.5.4.97) yok — sağlayıcının kimlik numarası gerekli (ETSI TS 119 412-6 §5, EN 319 412-3 §4.2.1; ör. VATTR-<VKN>)",
      );
    else if (!/^(VAT|NTR|LEI)[A-Z]{2}-[A-Z0-9]+$/.test(organizationIdentifier))
      p.push(
        `organizationIdentifier EN 319 412-1 semantik tanımlayıcı olmalı (VATTR-…, NTRTR-…, LEIXG-…); bulunan: ${organizationIdentifier}`,
      );
    if (!qcExt)
      p.push(
        "qcStatements uzantısı yok — QcType id-etsi-qct-wal (0.4.0.194126.1.2) gerekli (ETSI TS 119 412-6 WAL-5.2-01)",
      );
    else if (!qcTypes.includes(OID_QCT_WAL))
      p.push(
        `qcStatements QcType id-etsi-qct-wal (0.4.0.194126.1.2) içermeli (ETSI TS 119 412-6 WAL-5.2-01); bulunan: ${qcTypes.join(", ") || "-"}`,
      );
  }
  // checkIssued() olmaz: kendinden imzalı yaprakta keyCertSign yok (OpenSSL veren denetimi düşer); ad + imza yeter
  const selfSigned = x.issuer === x.subject;
  if (selfSigned && !x.verify(x.publicKey)) p.push("kendinden imzalı sertifikanın imzası tutmuyor");
  if (p.length) throw new RegistryError(p);
  const warnings: string[] = [];
  const left = (notAfter.getTime() - opts.now.getTime()) / 86400_000;
  if (left < WP_CERT_WARN_DAYS)
    warnings.push(`sertifikanın ${Math.floor(left)} günü kaldı — anahtar değişimini planlayın`);
  return {
    pem: x.toString().trim() + "\n",
    fingerprint: certFingerprintSha256Hex(pemToDer(blocks[0])),
    subject: x.subject.replace(/\n/g, ", "),
    notBefore,
    notAfter,
    selfSigned,
    isTest,
    organizationIdentifier,
    qcTypes,
    profileRequired,
    warnings,
  };
}

/** Var olan sertifika dosyasının özeti (denetimsiz; karşılaştırma ve `show` için). */
export function certSummary(pemText: string): { fingerprint: string; subject: string; notAfter: Date } {
  const x = new X509Certificate(pemText);
  return {
    fingerprint: certFingerprintSha256Hex(new Uint8Array(x.raw)),
    subject: x.subject.replace(/\n/g, ", "),
    notAfter: new Date(x.validTo),
  };
}

/**
 * Sertifikanın organizationIdentifier'ı ile kaydın `identifiers[]`'ından türetilen semantik tanımlayıcı (`VATTR-<VKN>` …) aynı mı
 * (ETSI TS 119 412-6 §5; büyük/küçük harf duyarsız). Sorun listesi döner; boşsa uyumlu.
 */
export function providerOrgIdProblems(entry: Rec, organizationIdentifier: string | null): string[] {
  const id = entry.provider_id as string;
  const want = semanticIdentifier(entry.identifiers as Rec[] | undefined);
  if (!want)
    return [
      `${id}: kayıtta kimlik numarası yok (identifiers[], ör. {"scheme": "TR-VKN", "value": "TR<VKN>"}) — sertifikanın organizationIdentifier'ı neyle karşılaştırılacak?`,
    ];
  if (!organizationIdentifier || organizationIdentifier.toUpperCase() !== want.toUpperCase())
    return [
      `${id}: sertifikanın organizationIdentifier'ı (${organizationIdentifier ?? "yok"}) kayıttaki kimlik numarasıyla (${want}) aynı değil`,
    ];
  return [];
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const findWp = (src: Rec, id: string): Rec | undefined =>
  ((src.wallet_providers ?? []) as Rec[]).find((w) => w.provider_id === id);

export interface ActivateOpts {
  certName: string;
  now: Date;
  environment: WpEnvironment;
  reason?: string;
  /**
   * Sertifikanın konu alanındaki organizationIdentifier (`inspectWalletProviderCert`). `profileRequired` (varsayılan true) ise
   * kayıttaki `identifiers[]`'dan türetilen semantik tanımlayıcıyla (`VATTR-<VKN>` …) aynı olmalı; kayıtta kimlik numarası
   * yoksa etkinleştirme yapılmaz.
   */
  organizationIdentifier: string | null;
  profileRequired?: boolean;
  /**
   * Yalnız sandbox (ADR-0042 uygulama notu, SB1 istisnası): aynı provider_id gerçek kayıt defterinde de varsa gerçek kayıt
   * ÖNCE bu sertifikayla ACTIVE olmalı. Gerçek kayıt defterinin (gerekirse aynı komutta yazılacak hâli) kaynak nesnesi.
   */
  production?: Rec;
}

/**
 * RESERVED (ya da SUSPENDED) kaydı sertifikasıyla ACTIVE yapar: `wua_signing_certs = [certName]`, `RESERVED` çözümler `ACTIVE`,
 * `note` güncel, `status_history`'ye ekleme (SPEC-TRUST-0001 TL2). Kayıt zaten bu sertifikayla ACTIVE ise `changed: false` ve
 * kaynak olduğu gibi döner (komut ikinci kez çalışınca hiçbir şey değişmez).
 */
export function activateWalletProvider(src: Rec, id: string, o: ActivateOpts): { next: Rec; changed: boolean } {
  const cur = findWp(src, id);
  if (!cur) throw new RegistryError([`cüzdan sağlayıcı yok: ${id} (önce kayıt; ADR-0042)`]);
  const p: string[] = [];
  const certs = (cur.wua_signing_certs ?? []) as string[];
  if (o.environment === "sandbox" && o.production) {
    const prod = findWp(o.production, id);
    if (prod && !(prod.status === "ACTIVE" && ((prod.wua_signing_certs ?? []) as string[]).includes(o.certName)))
      p.push(
        `${id}: sandbox'a gerçek sertifika ancak gerçek listede aynı kayıt bu sertifikayla ACTIVE olduktan sonra girer (ADR-0042, SB1) — önce --registry registry ya da both`,
      );
  }
  if (cur.status === "REVOKED" || cur.status === "RETIRED")
    p.push(`${id} ${cur.status} — geri çekilmiş kayıt yeniden etkinleşmez (yeni kayıt gerekir)`);
  if (o.profileRequired !== false) p.push(...providerOrgIdProblems(cur, o.organizationIdentifier));
  const other = certs.filter((c) => c !== o.certName);
  if (other.length)
    p.push(
      `${id} başka sertifika taşıyor (${other.join(", ")}) — anahtar değişimi bu komutla yapılmaz (SPEC-TRUST-0001 ROLLING_OVER)`,
    );
  if (p.length) throw new RegistryError(p);
  const reservedSolutions = ((cur.solutions ?? []) as Rec[]).some((s) => s.status === "RESERVED");
  if (cur.status === "ACTIVE" && certs.length === 1 && !reservedSolutions) return { next: src, changed: false };

  const out = clone(src);
  const w = findWp(out, id)!;
  const since = o.now.toISOString();
  const wasSuspended = w.status === "SUSPENDED";
  w.wua_signing_certs = [o.certName];
  for (const s of (w.solutions ?? []) as Rec[]) if (s.status === "RESERVED") s.status = "ACTIVE";
  w.status = "ACTIVE";
  if (!wasSuspended)
    w.note =
      `ADR-0042: operated by ${w.legal_name}; signing certificate ${o.certName} registered ${since.slice(0, 10)}` +
      (o.environment === "sandbox" && o.production && findWp(o.production, id)
        ? "; the same entry and certificate as in the production list (one provider, no separate wallet sandbox)."
        : ".");
  w.status_history = [
    ...((w.status_history ?? []) as Rec[]),
    { status: "ACTIVE", since, reason: o.reason ?? (wasSuspended ? "reinstated" : "signing-certificate-registered") },
  ];
  return { next: out, changed: true };
}

/** SUSPENDED / REVOKED (TL2: kayıt ve sertifika adı kalır, `status_history`'ye eklenir; ACTIVE olmayan kayıt WUA'da kullanılmaz). */
export function setWalletProviderStatus(
  src: Rec,
  id: string,
  status: "SUSPENDED" | "REVOKED",
  o: { now: Date; reason?: string },
): { next: Rec; changed: boolean } {
  const cur = findWp(src, id);
  if (!cur) throw new RegistryError([`cüzdan sağlayıcı yok: ${id}`]);
  if (cur.status === status) return { next: src, changed: false };
  if (cur.status === "REVOKED" || cur.status === "RETIRED")
    throw new RegistryError([`${id} ${cur.status} — durum değiştirilemez`]);
  if (status === "SUSPENDED" && cur.status !== "ACTIVE")
    throw new RegistryError([`${id} ${cur.status} — yalnız ACTIVE kayıt askıya alınır`]);
  const out = clone(src);
  const w = findWp(out, id)!;
  w.status = status;
  w.status_history = [
    ...((w.status_history ?? []) as Rec[]),
    { status, since: o.now.toISOString(), reason: o.reason ?? "operator" },
  ];
  return { next: out, changed: true };
}

/** Operatör özeti: bir kayıt defterindeki cüzdan sağlayıcıları. */
export function summarizeWalletProviders(src: Rec): string[] {
  return ((src.wallet_providers ?? []) as Rec[]).map((w) => {
    const sols = ((w.solutions ?? []) as Rec[]).map((s) => `${s.solution_id}:${s.status}`).join(",");
    const certs = ((w.wua_signing_certs ?? []) as string[]).join(",") || "-";
    return `${String(w.provider_id).padEnd(24)} ${String(w.status).padEnd(9)} sertifika=${certs}  çözüm=${sols || "-"}`;
  });
}

/** Satır farkı (LCS) — `--dry-run` çıktısı. Yalnız değişen bölümler, çevresinde `context` satırla. */
export function lineDiff(a: string, b: string, context = 2): string {
  const x = a.split("\n");
  const y = b.split("\n");
  const n = x.length;
  const m = y.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops: Array<{ t: " " | "-" | "+"; s: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) (ops.push({ t: " ", s: x[i++] }), j++);
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) ops.push({ t: "-", s: x[i++] });
    else ops.push({ t: "+", s: y[j++] });
  }
  while (i < n) ops.push({ t: "-", s: x[i++] });
  while (j < m) ops.push({ t: "+", s: y[j++] });
  const keep = new Set<number>();
  ops.forEach((o, k) => {
    if (o.t !== " ") for (let d = -context; d <= context; d++) keep.add(k + d);
  });
  const out: string[] = [];
  let last = -2;
  ops.forEach((o, k) => {
    if (!keep.has(k)) return;
    if (k !== last + 1) out.push("@@");
    out.push(`${o.t} ${o.s}`);
    last = k;
  });
  return out.join("\n");
}
