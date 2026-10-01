/**
 * İhraç — issuer-signed JWT üretimi (SPEC-CRED-0002 §5).
 *  Başlık: alg ES256 (C1), typ dc+sd-jwt (C13), x5c: yaprak (+ara CA), kök hariç (C7).
 *  Gövde: iss, vct, vct#integrity, iat, [exp], cnf (C16), [status], [category], _sd_alg (C2), _sd (C5, C6).
 *  Claim politikası Type Metadata'dan: sd: never → açıkta; always|allowed → disclosure.
 *  ÇIKTI biçimi: "<jwt>~<d1>~…~" (sondaki ~ boş KB yeri; cüzdan sunumda doldurur).
 */
import { CompactSign, importPKCS8, type JWK } from "jose";
import type { KeyObject } from "node:crypto";
export type SigningKey = CryptoKey | KeyObject;
import { derToB64, pemToDer, utf8 } from "@tamga-network/core";
import { makeDisclosure, SD_ALG, SD_JWT_TYP, type Disclosure } from "./disclosure.js";

export type SdPolicy = "always" | "allowed" | "never";

export interface IssuerSigner {
  /** Yaprak sertifika DER (x5c[0]) + varsa ara CA'lar; KÖK DAHİL DEĞİL (C7) */
  x5c: Uint8Array[];
  sign(protectedHeader: Record<string, unknown>, payload: Uint8Array): Promise<string>;
}

export async function pemIssuerSigner(
  privateKeyPem: string,
  leafCertPem: string,
  intermediatePems: string[] = [],
): Promise<IssuerSigner> {
  const key = await importPKCS8(privateKeyPem, "ES256");
  const x5c = [pemToDer(leafCertPem), ...intermediatePems.map(pemToDer)];
  return { x5c, sign: (h, p) => new CompactSign(p).setProtectedHeader(h as never).sign(key as SigningKey) };
}

export interface IssueInput {
  signer: IssuerSigner;
  iss: string; // issuer_url (tutarlılık için; issuerId x5c'den türetilir — C15)
  vct: string; // urn:tamga:…
  vctIntegrity: string; // sha256-… (zorunlu)
  iat: number;
  exp?: number;
  cnfJwk: JWK; // holder açık anahtarı (C16)
  status?: { status_list: { idx: number; uri: string } };
  category?: "urn:tamga:eaa:pub" | "urn:tamga:eaa:qualified";
  claims: Record<string, unknown>;
  sdPolicy: Record<string, SdPolicy>; // Type Metadata claims[].sd; listelenmeyen claim → "allowed"
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
  if (!input.vctIntegrity?.startsWith("sha256-")) throw new Error("vct#integrity zorunlu (ADR-0010)");
  const plain: Record<string, unknown> = {
    iss: input.iss,
    vct: input.vct,
    "vct#integrity": input.vctIntegrity,
    iat: input.iat,
  };
  if (input.exp !== undefined) plain.exp = input.exp;
  plain.cnf = { jwk: input.cnfJwk };
  if (input.status) plain.status = input.status;
  if (input.category) plain.category = input.category;

  const disclosures: Disclosure[] = [];
  for (const [name, value] of Object.entries(input.claims)) {
    if (RESERVED.has(name)) throw new Error(`reserved claim name: ${name}`);
    const pol = input.sdPolicy[name] ?? "allowed";
    if (pol === "never") plain[name] = value;
    else disclosures.push(makeDisclosure(name, value));
  }
  const payload = { ...plain, _sd_alg: SD_ALG, _sd: disclosures.map((d) => d.digest).sort() }; // C5 sıralı, C6 decoy yok
  const header = { alg: "ES256", typ: SD_JWT_TYP, x5c: input.signer.x5c.map(derToB64) };
  const jwt = await input.signer.sign(header, utf8(JSON.stringify(payload)));
  const combined = [jwt, ...disclosures.map((d) => d.disclosure), ""].join("~");
  return { combined, jwt, disclosures, payload };
}
