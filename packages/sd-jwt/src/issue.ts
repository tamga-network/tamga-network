/**
 * İhraç — issuer-signed JWT üretimi (SPEC-CRED-0002 §5).
 *  Başlık: alg ES256 (C1), typ dc+sd-jwt (C13), x5c: yaprak (+ara CA), kök hariç (C7).
 *  Gövde: iss, vct, vct#integrity, iat, [exp], cnf (C16), [status], [category], _sd_alg (C2), _sd (C5, C6).
 *  Claim politikası Type Metadata'dan: sd: never → açıkta; always|allowed → disclosure.
 *  ÇIKTI biçimi: "<jwt>~<d1>~…~" (sondaki ~ boş KB yeri; cüzdan sunumda doldurur).
 */
import { CompactSign, importPKCS8, type JWK } from "jose";
import { createPrivateKey, sign as nodeSign, type KeyObject } from "node:crypto";
export type SigningKey = CryptoKey | KeyObject;
import { derToB64, pemToDer, utf8 } from "@tamga-network/core";
import { makeArrayElementDisclosure, makeDisclosure, SD_ALG, SD_JWT_TYP, type Disclosure } from "./disclosure.js";

export type SdPolicy = "always" | "allowed" | "never";

export interface IssuerSigner {
  /** Yaprak sertifika DER (x5c[0]) + varsa ara CA'lar; KÖK DAHİL DEĞİL (C7) */
  x5c: Uint8Array[];
  sign(protectedHeader: Record<string, unknown>, payload: Uint8Array): Promise<string>;
  /**
   * Ham ES256 imzası (SHA-256 ön özetli, 64 baytlık r‖s) — COSE yapıları için (ADR-0048: iptal listesinin CWT gösterimi).
   * İsteğe bağlı: yalnız CWT yayımlayan imzacıda gerekir (KMS uyarlaması da sağlayabilir).
   */
  signRaw?(data: Uint8Array): Promise<Uint8Array>;
}

export async function pemIssuerSigner(
  privateKeyPem: string,
  leafCertPem: string,
  intermediatePems: string[] = [],
): Promise<IssuerSigner> {
  const key = await importPKCS8(privateKeyPem, "ES256");
  const x5c = [pemToDer(leafCertPem), ...intermediatePems.map(pemToDer)];
  const raw = createPrivateKey(privateKeyPem);
  return {
    x5c,
    sign: (h, p) => new CompactSign(p).setProtectedHeader(h as never).sign(key as SigningKey),
    signRaw: async (data) => new Uint8Array(nodeSign("sha256", data, { key: raw, dsaEncoding: "ieee-p1363" })),
  };
}

export interface IssueInput {
  signer: IssuerSigner;
  iss: string; // issuer_url (tutarlılık için; issuerId x5c'den türetilir — C15)
  vct: string; // urn:tamga:…
  /**
   * sha256-… — Tamga türlerinde (`urn:tamga:`) zorunlu (ADR-0010). Dış türlerde (ADR-0036: AB PID `urn:eudi:pid:1`, ADR-0094 sandbox
   * temsili PID) verilmeyebilir: tür bütünlüğü dış listenin imzalı kaydından gelir, Tamga kataloğuna bağlanmaz.
   */
  vctIntegrity?: string;
  iat: number;
  /** geçerlilik başlangıcı (RFC 7519 `nbf`); verilirse açıkta yazılır. `iat`tan önce olamaz; ileri tarih = ARF "Issued" */
  nbf?: number;
  exp?: number;
  cnfJwk: JWK; // holder açık anahtarı (C16)
  status?: { status_list: { idx: number; uri: string } };
  category?: "urn:tamga:eaa:pub" | "urn:tamga:eaa:qualified";
  claims: Record<string, unknown>;
  sdPolicy: Record<string, SdPolicy>; // Type Metadata claims[].sd; listelenmeyen claim → "allowed"
  /**
   * Öğeleri ayrı ayrı seçici açıklanan diziler (Type Metadata `path: [ad, null]`, sd ≠ never; RFC 9901 §4.2.2). AB PID kodlaması
   * (CIR 2026/1731 §4.2, ARF PID_21): `nationalities` gibi dizilerin her öğesi ayrı disclosure; dizi `{"...": özet}` taşır.
   */
  arrayElementSd?: readonly string[];
  /**
   * Üyeleri ayrı ayrı seçici açıklanan nesneler (iç içe seçici açıklama, RFC 9901 §4.2.6; AB PID `address{…}`, CIR 2026/1731 §4.2):
   * nesne açıkta durur ve yalnız `_sd` özetlerini taşır, her üyesi ayrı disclosure. Kişi `address.locality`'yi ötekiler olmadan
   * gösterebilir. Yalnız düz nesne (dizi değil); üyelerin kendisi yeniden iç içe açılmaz.
   */
  objectMemberSd?: readonly string[];
}

export interface IssueOutput {
  combined: string;
  jwt: string;
  disclosures: Disclosure[];
  payload: Record<string, unknown>;
}

const RESERVED = new Set([
  "iss",
  "nbf",
  "vct",
  "vct#integrity",
  "iat",
  "exp",
  "cnf",
  "status",
  "category",
  "_sd",
  "_sd_alg",
  "...",
  "__proto__",
  "constructor",
  "prototype",
]);

export async function issueSdJwtVc(input: IssueInput): Promise<IssueOutput> {
  if (!input.cnfJwk) throw new Error("C16: cnf zorunlu");
  if (input.vctIntegrity !== undefined ? !input.vctIntegrity.startsWith("sha256-") : input.vct.startsWith("urn:tamga:"))
    throw new Error("vct#integrity zorunlu (ADR-0010)");
  const plain: Record<string, unknown> = {
    iss: input.iss,
    vct: input.vct,
    ...(input.vctIntegrity !== undefined ? { "vct#integrity": input.vctIntegrity } : {}),
    iat: input.iat,
  };
  if (input.nbf !== undefined) {
    if (!Number.isInteger(input.nbf) || input.nbf < input.iat) throw new Error("nbf must be an integer ≥ iat");
    if (input.exp !== undefined && input.nbf >= input.exp) throw new Error("nbf must be before exp");
    plain.nbf = input.nbf;
  }
  if (input.exp !== undefined) plain.exp = input.exp;
  plain.cnf = { jwk: input.cnfJwk };
  if (input.status) plain.status = input.status;
  if (input.category) plain.category = input.category;

  const disclosures: Disclosure[] = [];
  const elementSd = new Set(input.arrayElementSd ?? []);
  const elementDisclosures = new Set<Disclosure>();
  const memberSd = new Set(input.objectMemberSd ?? []);
  for (const [name, raw] of Object.entries(input.claims)) {
    if (RESERVED.has(name)) throw new Error(`reserved claim name: ${name}`);
    if (memberSd.has(name)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw new Error(`objectMemberSd: ${name} is not a plain object`);
      // iç içe: her üye ayrı disclosure (kök `_sd`'ye girmez — nesnenin kendi `_sd`'sinde), nesne açıkta
      const members = Object.entries(raw as Record<string, unknown>).map(([k, v]) => {
        if (RESERVED.has(k)) throw new Error(`reserved claim name: ${name}.${k}`);
        const d = makeDisclosure(k, v);
        disclosures.push(d);
        elementDisclosures.add(d);
        return d.digest;
      });
      plain[name] = { _sd: members.sort() };
      continue;
    }
    let value = raw;
    if (elementSd.has(name) && Array.isArray(raw)) {
      // dizi öğeleri önce: her biri ayrı disclosure, dizide yerini özeti tutar (sıra korunur)
      value = raw.map((el, i) => {
        const d = makeArrayElementDisclosure(`${name}[${i}]`, el);
        disclosures.push(d);
        elementDisclosures.add(d);
        return { "...": d.digest };
      });
    }
    const pol = input.sdPolicy[name] ?? "allowed";
    if (pol === "never") plain[name] = value;
    else disclosures.push(makeDisclosure(name, value));
  }
  // C5 sıralı, C6 decoy yok. Kök `_sd` yalnız adlı (nesne üyesi) disclosure'ları taşır; dizi öğeleri dizinin içinde
  const top = disclosures.filter((d) => !elementDisclosures.has(d));
  const payload = { ...plain, _sd_alg: SD_ALG, _sd: top.map((d) => d.digest).sort() };
  const header = { alg: "ES256", typ: SD_JWT_TYP, x5c: input.signer.x5c.map(derToB64) };
  const jwt = await input.signer.sign(header, utf8(JSON.stringify(payload)));
  const combined = [jwt, ...disclosures.map((d) => d.disclosure), ""].join("~");
  return { combined, jwt, disclosures, payload };
}
