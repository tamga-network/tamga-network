/**
 * ops/pki-subject.ts — yaprak sertifikanın konu alanını (subject) ASN.1 ad yapısından kurar (pki-issue.ts; 2026-11-04 güvenlik
 * turu O1). Konu alanı METİN olarak okunmaz ve metin birleştirerek yazılmaz: CSR'daki (ya da `--subject`'teki) ad `Name` olarak
 * çözülür, yalnız izin verilen öznitelikler (CN, OU, O, organizationIdentifier 2.5.4.97, C) birer kez kabul edilir, sertifikanın
 * konusu bu alanlardan JSON ad yapısıyla yeniden kurulur (kaçışlı virgül ya da çok değerli RDN ile öznitelik eklenemez).
 * Kurum kimlik numarası (organizationIdentifier) gerçek ağda yalnız operatörün `--org-id`'sinden gelir; CSR'da varsa birebir aynı
 * olmalıdır.
 */
import { Name, type JsonName } from "@peculiar/x509";

/** İzin verilen öznitelikler (OID → alan). Sıra sertifikadaki sıradır. */
const ATTRS = [
  { key: "CN", oid: "2.5.4.3" },
  { key: "OU", oid: "2.5.4.11" },
  { key: "O", oid: "2.5.4.10" },
  { key: "orgId", oid: "2.5.4.97" },
  { key: "C", oid: "2.5.4.6" },
] as const;
type Key = (typeof ATTRS)[number]["key"];
export type SubjectFields = Partial<Record<Key, string>>;

/** Kısa ad ya da OID → izin verilen alan (bilinmeyen: undefined). */
const KEY_OF: Record<string, Key> = Object.fromEntries(
  ATTRS.flatMap((a) => [
    [a.key === "orgId" ? "organizationIdentifier" : a.key, a.key],
    [a.oid, a.key],
  ]),
) as Record<string, Key>;

export const ORG_ID_RE = /^(VAT|NTR|LEI)[A-Z]{2}-[A-Za-z0-9]{1,40}$/;

export class SubjectError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join("; "));
    this.name = "SubjectError";
  }
}

/**
 * Ad yapısını izin verilen alanlara çözer. Bilinmeyen öznitelik, çok değerli RDN (`CN=a+O=b`), aynı özniteliğin birden fazla
 * kez geçmesi (ör. iki organizationIdentifier) ya da kontrol karakteri → SubjectError.
 */
export function subjectFields(name: Name): SubjectFields {
  const problems: string[] = [];
  const out: SubjectFields = {};
  for (const rdn of name.toJSON()) {
    const types = Object.keys(rdn);
    if (types.length !== 1 || rdn[types[0]!]!.length !== 1) {
      problems.push(`çok değerli RDN kabul edilmez (${types.join("+")})`);
      continue;
    }
    const type = types[0]!;
    const key = KEY_OF[type];
    if (!key) {
      problems.push(`izin verilmeyen öznitelik: ${type}`);
      continue;
    }
    if (out[key] !== undefined) {
      problems.push(`${key === "orgId" ? "organizationIdentifier (2.5.4.97)" : key} birden fazla kez geçiyor`);
      continue;
    }
    const value = rdn[type]![0]!;
    // eslint-disable-next-line no-control-regex
    if (!value.trim() || /[\u0000-\u001f\u007f]/.test(value))
      problems.push(`${key}: boş ya da kontrol karakterli değer`);
    out[key] = value;
  }
  if (problems.length) throw new SubjectError(problems);
  return out;
}

/** Alanlardan sertifika konusu (JSON ad yapısı; değerler kaçış gerektirmez). */
export function buildSubject(f: SubjectFields): JsonName {
  return ATTRS.filter((a) => f[a.key] !== undefined).map((a) => ({ [a.key === "orgId" ? a.oid : a.key]: [f[a.key]!] }));
}

/**
 * Gerçek ağ onay kapısı (2026-11-04 güvenlik turu O5): `TAMGA_CONFIRM_PROD` kurumun kısa adı olmalı ve sertifika adı o kurumun
 * adlarından biri olmalı (`issuer-<k>`, `issuer-<k>-status`, `rp-issuer-<k>`, `rp-<k>`). Sorun yoksa null.
 */
export function prodConfirmProblem(certName: string, confirm: string | undefined): string | null {
  const why =
    "gerçek ağın kök anahtarıyla imza: bu sertifikanın kurumu için açık onay gerekir — TAMGA_CONFIRM_PROD=<kurum kısa adı> " +
    "(yalnız bu adım için; sonra kaldırın). Hafızadaki genel yetki geçmez.";
  if (!confirm) return `${why} (TAMGA_CONFIRM_PROD yok)`;
  const ok = [`issuer-${confirm}`, `issuer-${confirm}-status`, `rp-issuer-${confirm}`, `rp-${confirm}`];
  return ok.includes(certName) ? null : `${why} (TAMGA_CONFIRM_PROD=${confirm} bu ada uymuyor: ${certName})`;
}

export interface ResolveSubjectInput {
  /** `issuer-…` ya da `rp-…` */
  name: string;
  prod: boolean;
  /** CSR'daki ad (ASN.1; `csr.subjectName`) — varsa */
  csrName?: Name;
  /** `--subject` (operatörün yazdığı ad; verilirse CSR'daki adın yerine geçer, organizationIdentifier yine karşılaştırılır) */
  subjectArg?: string;
  /** `--org-id` */
  orgId?: string;
  /** `--service-id` (OU) */
  serviceId?: string;
}

/**
 * Sertifikanın konusunu kurar. Kurallar: `--prod`'da `--org-id` zorunlu ve CSR'daki (ve `--subject`'teki) organizationIdentifier
 * ile birebir aynı; kurum sertifikasında (issuer-*) O ve C zorunlu; C iki büyük harf.
 */
export function resolveSubject(i: ResolveSubjectInput): { fields: SubjectFields; subject: JsonName; text: string } {
  const problems: string[] = [];
  const parse = (label: string, n: Name | string): SubjectFields | undefined => {
    try {
      return subjectFields(typeof n === "string" ? new Name(n) : n);
    } catch (e) {
      problems.push(
        ...(e instanceof SubjectError ? e.problems : [String((e as Error).message)]).map((p) => `${label}: ${p}`),
      );
      return undefined;
    }
  };
  const fromCsr = i.csrName ? parse("CSR konu alanı", i.csrName) : undefined;
  const fromArg = i.subjectArg !== undefined ? parse("--subject", i.subjectArg) : undefined;
  if (!i.csrName && i.subjectArg === undefined) problems.push("konu alanı yok (--csr ya da --subject)");
  if (problems.length) throw new SubjectError(problems);
  const base: SubjectFields = { ...(fromArg ?? fromCsr)! };

  if (i.orgId !== undefined && !ORG_ID_RE.test(i.orgId))
    problems.push("--org-id: VATTR-<VKN> ya da NTRTR-<MERSİS> biçiminde");
  if (i.prod && i.orgId === undefined)
    problems.push(
      `--prod ${i.name.startsWith("rp-") ? "erişim sertifikası (rp-*)" : "kurum sertifikası (issuer-*)"}: --org-id VATTR-<VKN> ya da NTRTR-<MERSİS> zorunlu (ADR-0026 K3, ADR-0050)`,
    );
  for (const [label, f] of [
    ["CSR", fromCsr],
    ["--subject", fromArg],
  ] as const)
    if (f?.orgId !== undefined && i.orgId !== undefined && f.orgId !== i.orgId)
      problems.push(
        `${label} konu alanındaki organizationIdentifier (${f.orgId}) --org-id ile aynı değil (${i.orgId})`,
      );
  const orgId = i.orgId ?? (i.prod ? undefined : base.orgId);

  if (i.serviceId !== undefined && base.OU !== undefined)
    problems.push("konu alanında zaten OU var (--service-id ile birlikte kullanılmaz)");
  const fields: SubjectFields = { ...base, OU: i.serviceId ?? base.OU, orgId };
  if (fields.C !== undefined && !/^[A-Z]{2}$/.test(fields.C)) problems.push("C: iki büyük harfli ülke kodu (ör. TR)");
  if (i.name.startsWith("issuer-") && (fields.O === undefined || fields.C === undefined))
    problems.push("kurum sertifikası konu alanında O (resmî ad) ve C (ülke) bulunmalı (ADR-0050)");
  if (!fields.CN && !fields.O) problems.push("konu alanında CN ya da O bulunmalı");
  if (problems.length) throw new SubjectError(problems);
  const subject = buildSubject(fields);
  return { fields, subject, text: new Name(subject).toString() };
}
