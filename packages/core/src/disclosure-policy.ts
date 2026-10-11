/**
 * ADR-0046 — gömülü açıklama politikası (embedded disclosure policy; ARF 3.0 Konu 43, ETSI TS 119 472-3 §4.2.5.2). Kurum, imzalı
 * Credential Issuer metadata'sında yapılandırma başına (`credential_metadata.embedded_disclosure_policy`) belgenin yalnız belirli
 * doğrulayıcılara gösterilmesini ister; cüzdan politikayı belge alınırken saklar ve sunumda değerlendirir (EP1–EP3).
 *
 * Bu modül veri modelini, biçim denetimini ve politika özetini taşır. Saf TS, Node'a özgü API yok (React Native dahil her istemci).
 * JSON Şeması: `@tamga-network/schemas` (`EMBEDDED_DISCLOSURE_POLICY_SCHEMA`). Değerlendirme: `@tamga-network/wallet-core`.
 */
import { sha256 } from "@noble/hashes/sha2.js";

/** Metadata'daki üye adı (OpenID4VCI `credential_metadata` içinde). */
export const EMBEDDED_DISCLOSURE_POLICY_MEMBER = "embedded_disclosure_policy";

/** Uygulama Tüzüğü (AB) 2024/2979 Ek III'ün üç ortak politikası. */
export const DISCLOSURE_POLICY_TYPES = ["none", "authorized_relying_parties", "specific_roots_of_trust"] as const;
export type DisclosurePolicyType = (typeof DISCLOSURE_POLICY_TYPES)[number];

/** ARF EDP_02 ikilisi: `rp_id` kayıt sertifikasının `sub`'ı; `service_id` verilirse kayıt sertifikasının hizmet kimliği. */
export interface AuthorizedRelyingParty {
  rp_id: string;
  service_id?: string;
}
/** ETSI -09: güven kökü ya da ara sertifika — veren adı (RFC 4514) + seri numarası (onaltılık). */
export interface RootOfTrust {
  issuer_dn: string;
  serial_number: string;
}
export interface EmbeddedDisclosurePolicy {
  /** ETSI -01: politikanın benzersiz URI'si */
  id: string;
  type: DisclosurePolicyType;
  /** ARF EDP_02 (kimlik, hizmet) ikilileri */
  relying_parties?: AuthorizedRelyingParty[];
  /** ETSI -07a: erişim sertifikasının konu adı (RFC 4514 LDAP dizesi) */
  subject_dns?: string[];
  /** ETSI -07b: kayıt sertifikasındaki yetki türü URI'leri (TS 119 475 Ek A) */
  entitlements?: string[];
  /** ETSI -08/-09 */
  roots_of_trust?: RootOfTrust[];
  /** ARF EDP_05 / ETSI -13: politikayı sade dille anlatan sayfa */
  info_uri?: string;
  /** ETSI -05: politikadan sorumlu makam */
  authority?: string;
  /** ETSI -04: uygulanabilirlik açıklaması */
  description?: string;
}

export type DisclosurePolicyValidation =
  { ok: true; policy: EmbeddedDisclosurePolicy } | { ok: false; errors: string[] };

const MAX_ITEMS = 100;
const MAX_TEXT = 1024;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isText = (x: unknown, max = MAX_TEXT): x is string =>
  typeof x === "string" && x.trim().length > 0 && x.length <= max;
/** Mutlak URI: şema + ":" + gövde (RFC 3986 §3). `https:`, `urn:` vb. */
const isUri = (x: unknown): x is string => isText(x, 2048) && /^[a-zA-Z][a-zA-Z0-9+.-]*:\S+$/.test(x);
const isHttpsUrl = (x: unknown): x is string => {
  if (!isText(x, 2048)) return false;
  try {
    return new URL(x).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Biçim denetimi (ADR-0046 K1). Bilinmeyen üyeler ve uzantılar yok sayılır (ETSI -10/-11) — çıktıdaki `policy` yalnız bilinen
 * üyeleri taşır. `authorized_relying_parties` en az bir eşleşme listesi, `specific_roots_of_trust` en az bir kök ister.
 */
export function validateDisclosurePolicy(x: unknown): DisclosurePolicyValidation {
  const errors: string[] = [];
  if (!isObj(x)) return { ok: false, errors: ["policy is not an object"] };
  if (!isUri(x.id)) errors.push("id: absolute URI required");
  if (!DISCLOSURE_POLICY_TYPES.includes(x.type as DisclosurePolicyType))
    errors.push(`type: one of ${DISCLOSURE_POLICY_TYPES.join(" | ")}`);
  const list = <T>(name: string, v: unknown, item: (e: unknown, i: number) => T | null): T[] | undefined => {
    if (v === undefined) return undefined;
    if (!Array.isArray(v) || v.length === 0 || v.length > MAX_ITEMS) {
      errors.push(`${name}: non-empty array of at most ${MAX_ITEMS} items`);
      return undefined;
    }
    const out: T[] = [];
    v.forEach((e, i) => {
      const r = item(e, i);
      if (r !== null) out.push(r);
    });
    return out;
  };
  const relyingParties = list<AuthorizedRelyingParty>("relying_parties", x.relying_parties, (e, i) => {
    if (!isObj(e) || !isText(e.rp_id, 256) || (e.service_id !== undefined && !isText(e.service_id, 256))) {
      errors.push(`relying_parties[${i}]: { rp_id, service_id? } strings`);
      return null;
    }
    return { rp_id: e.rp_id, ...(e.service_id !== undefined ? { service_id: e.service_id as string } : {}) };
  });
  const subjectDns = list<string>("subject_dns", x.subject_dns, (e, i) => {
    if (!isText(e) || !parseableDn(e)) {
      errors.push(`subject_dns[${i}]: RFC 4514 distinguished name`);
      return null;
    }
    return e;
  });
  const entitlements = list<string>("entitlements", x.entitlements, (e, i) => {
    if (!isUri(e)) {
      errors.push(`entitlements[${i}]: URI`);
      return null;
    }
    return e;
  });
  const roots = list<RootOfTrust>("roots_of_trust", x.roots_of_trust, (e, i) => {
    if (
      !isObj(e) ||
      !isText(e.issuer_dn) ||
      !parseableDn(e.issuer_dn) ||
      typeof e.serial_number !== "string" ||
      !/^(0x)?[0-9a-fA-F]{1,64}$/.test(e.serial_number)
    ) {
      errors.push(`roots_of_trust[${i}]: { issuer_dn: RFC 4514, serial_number: hex }`);
      return null;
    }
    return { issuer_dn: e.issuer_dn, serial_number: e.serial_number };
  });
  if (x.type === "authorized_relying_parties" && !relyingParties && !subjectDns && !entitlements)
    errors.push("authorized_relying_parties: at least one of relying_parties, subject_dns, entitlements");
  if (x.type === "specific_roots_of_trust" && !roots) errors.push("specific_roots_of_trust: roots_of_trust required");
  if (x.info_uri !== undefined && !isHttpsUrl(x.info_uri)) errors.push("info_uri: https URL");
  if (x.authority !== undefined && !isText(x.authority)) errors.push("authority: text");
  if (x.description !== undefined && !isText(x.description, 4096)) errors.push("description: text");
  if (errors.length) return { ok: false, errors };
  const type = x.type as DisclosurePolicyType;
  return {
    ok: true,
    policy: {
      id: x.id as string,
      type,
      ...(type === "authorized_relying_parties" && relyingParties ? { relying_parties: relyingParties } : {}),
      ...(type === "authorized_relying_parties" && subjectDns ? { subject_dns: subjectDns } : {}),
      ...(type === "authorized_relying_parties" && entitlements ? { entitlements } : {}),
      ...(type === "specific_roots_of_trust" && roots ? { roots_of_trust: roots } : {}),
      ...(x.info_uri !== undefined ? { info_uri: x.info_uri as string } : {}),
      ...(x.authority !== undefined ? { authority: x.authority as string } : {}),
      ...(x.description !== undefined ? { description: x.description as string } : {}),
    },
  };
}

/** Anahtarları sıralı JSON (özet için kararlı biçim). */
function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (isObj(v))
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

/**
 * Politika özeti (ADR-0046 K2/K5): `sha256:<hex>`; politika yoksa `null`. Belge veren belge kaydına, cüzdan belge kaydına yazar;
 * politika eklenince, değişince ya da kalkınca özet değişir ve o yapılandırmanın geçerli belgeleri iptal edilir (EP4). Özet
 * biçim denetiminden geçmiş politikanın bilinen üyeleri üzerinden hesaplanır (uzantılar ve üye sırası özeti değiştirmez).
 */
export function disclosurePolicyDigest(policy: EmbeddedDisclosurePolicy | null | undefined): string | null {
  if (!policy) return null;
  const v = validateDisclosurePolicy(policy);
  const body = canonicalJson(v.ok ? v.policy : policy);
  const h = sha256(new TextEncoder().encode(body));
  return "sha256:" + Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Politika belgeyi gerçekten kısıtlıyor mu (`none` ya da politika yok = kısıt yok). */
export const restrictsDisclosure = (p: EmbeddedDisclosurePolicy | null | undefined): boolean =>
  !!p && p.type !== "none";

// ---------------------------------------------------------------- RFC 4514 ayırt edici ad (ETSI -07a, -09)

/** Ayırt edici ad öznitelik türü kısaltmaları → OID (RFC 4514 §3 + ETSI TS 119 472-3 Not 2: ORGID, SN). */
export const DN_ATTRIBUTE_OIDS: Record<string, string> = {
  CN: "2.5.4.3",
  SN: "2.5.4.5", // ETSI -07a Not 2: serialNumber (RFC 4519'daki surname değil)
  SERIALNUMBER: "2.5.4.5",
  C: "2.5.4.6",
  L: "2.5.4.7",
  ST: "2.5.4.8",
  STREET: "2.5.4.9",
  O: "2.5.4.10",
  OU: "2.5.4.11",
  TITLE: "2.5.4.12",
  SURNAME: "2.5.4.4",
  GIVENNAME: "2.5.4.42",
  GN: "2.5.4.42",
  ORGID: "2.5.4.97",
  ORGANIZATIONIDENTIFIER: "2.5.4.97",
  DC: "0.9.2342.19200300.100.1.25",
  UID: "0.9.2342.19200300.100.1.1",
};

/** Ayırt edici adın bir özniteliği: tür OID'i + normalleştirilmiş değer. */
export interface DnAttribute {
  oid: string;
  value: string;
}

/** Değer normalleştirme: baş/son boşluk atılır, iç boşluklar teke iner, büyük-küçük harf farkı yok (caseIgnoreMatch). */
export const normalizeDnValue = (v: string) => v.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

/**
 * RFC 4514 dizesini öznitelik listesine çevirir (çok değerli RDN `+` dahil). Kaçışlar (`\,` `\2C`) çözülür; `#` ile başlayan
 * değer BER onaltılık biçimi olarak olduğu gibi (küçük harf) tutulur. Tür adı bilinmiyorsa ve OID değilse hata.
 */
export function parseDn(dn: string): DnAttribute[] {
  const out: DnAttribute[] = [];
  let i = 0;
  const s = dn.trim();
  if (!s) return out;
  while (i < s.length) {
    // tür
    let type = "";
    while (i < s.length && s[i] !== "=") type += s[i++];
    if (s[i] !== "=") throw new Error("DN: '=' expected");
    i++;
    type = type.trim();
    const upper = type.toUpperCase();
    const oid = /^\d+(\.\d+)+$/.test(type)
      ? type
      : /^OID\.\d+(\.\d+)+$/i.test(type)
        ? type.slice(4)
        : DN_ATTRIBUTE_OIDS[upper];
    if (!oid) throw new Error(`DN: unknown attribute type ${type}`);
    // değer
    let value = "";
    let hex = false;
    while (i < s.length && s[i] === " ") i++;
    if (s[i] === "#") hex = true;
    if (s[i] === '"') {
      // RFC 2253 alıntılı değer (eski biçim; okunur)
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === "\\" && i + 1 < s.length) i++;
        value += s[i++];
      }
      i++;
    } else
      while (i < s.length && s[i] !== "," && s[i] !== "+" && s[i] !== ";") {
        if (s[i] === "\\") {
          const h = s.slice(i + 1, i + 3);
          if (/^[0-9a-fA-F]{2}$/.test(h)) {
            // UTF-8 bayt dizisi olarak kaçış: ardışık \XX'leri topla
            const bytes: number[] = [];
            while (s[i] === "\\" && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) {
              bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
              i += 3;
            }
            value += new TextDecoder().decode(new Uint8Array(bytes));
            continue;
          }
          i++;
          if (i < s.length) value += s[i++];
          continue;
        }
        value += s[i++];
      }
    out.push({ oid, value: hex ? value.trim().toLowerCase() : normalizeDnValue(value) });
    while (i < s.length && s[i] === " ") i++;
    if (i < s.length) {
      if (s[i] !== "," && s[i] !== "+" && s[i] !== ";") throw new Error("DN: separator expected");
      i++;
    }
  }
  return out;
}

function parseableDn(dn: string): boolean {
  try {
    return parseDn(dn).length > 0;
  } catch {
    return false;
  }
}

/** Kararlı biçim: (oid=değer) çiftleri sıralı. */
const dnKey = (attrs: DnAttribute[]) =>
  attrs
    .map((a) => `${a.oid}=${a.value}`)
    .sort()
    .join("\u0000");

/**
 * İki ayırt edici ad aynı mı (ADR-0046 K3 "RFC 4514 normalleştirilmiş karşılaştırma"): öznitelik türleri OID'e çevrilir, değerler
 * büyük-küçük harf ve boşluk farkı gözetmeden karşılaştırılır; RDN sırası gözetilmez (RFC 4514 dizesi X.509'daki sıranın
 * tersidir, yazımlar karışık gelir). Bütün öznitelikler birebir aynı olmalı (eksik ya da fazla öznitelik eşleşmez).
 */
export function dnEquals(a: string | DnAttribute[], b: string | DnAttribute[]): boolean {
  try {
    const x = typeof a === "string" ? parseDn(a) : a.map((t) => ({ oid: t.oid, value: normalizeDnValue(t.value) }));
    const y = typeof b === "string" ? parseDn(b) : b.map((t) => ({ oid: t.oid, value: normalizeDnValue(t.value) }));
    return x.length > 0 && dnKey(x) === dnKey(y);
  } catch {
    return false;
  }
}

/** Seri numarası karşılaştırması: onaltılık, `0x` ve baştaki sıfırlar gözetilmez. */
export const serialEquals = (a: string, b: string) => {
  const n = (s: string) => s.replace(/^0x/i, "").replace(/^0+/, "").toLowerCase() || "0";
  return n(a) === n(b);
};
