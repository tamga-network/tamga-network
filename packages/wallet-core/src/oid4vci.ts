/**
 * OpenID4VCI 1.0 — cüzdan tarafı, Tamga profili (SPEC-PROTO-0001): pre-authorized + tx_code, batch N (her kopya ayrı anahtar — PR6),
 * proof JWT {typ openid4vci-proof+jwt, jwk} {aud, nonce, iat}. HTTP soyut (Http) — Node fetch, RN fetch, testte app.inject.
 */
import { b64Decode, utf8 } from "./b64.js";
import { WalletError, type Http, readJson } from "./http.js";
import { decodeJwt, signJwt, verifyJwt } from "./jws.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import type { KeyProvider, PublicJwk } from "./keys.js";
import { clientAttestationPop, type WuaRecord } from "./wua.js";
import { dpopRequest, newDpopSigner, type DpopSigner } from "./dpop.js";

export const PRE_AUTH_GRANT = "urn:ietf:params:oauth:grant-type:pre-authorized_code";
export const PROOF_TYP = "openid4vci-proof+jwt";
export const DEFAULT_BATCH = 10;

export interface CredentialOffer {
  credential_issuer: string;
  credential_configuration_ids: string[];
  grants?: {
    [PRE_AUTH_GRANT]?: {
      "pre-authorized_code": string;
      tx_code?: { length?: number; input_mode?: string; description?: string };
    };
    /** ADR-0020: kimliğe bağlı teklif — cüzdan PAR'da issuer_state gönderir, kişi kimliğini sunar */
    authorization_code?: { issuer_state?: string };
  };
}
/** Teklif kimliğe bağlı mı (authorization_code + issuer_state)? */
export const offerIssuerState = (o: CredentialOffer): string | undefined =>
  o.grants?.[PRE_AUTH_GRANT] ? undefined : o.grants?.authorization_code?.issuer_state;
export interface IssuerMetadata {
  credential_issuer: string;
  credential_endpoint: string;
  nonce_endpoint?: string;
  batch_credential_issuance?: { batch_size: number };
  credential_configurations_supported: Record<
    string,
    {
      format: string;
      vct?: string;
      /** HAIP §4.1: yapılandırmanın OAuth kapsamı */
      scope?: string;
      display?: Array<{ name?: string; locale?: string }>;
      /** OpenID4VCI 1.0 + ETSI TS 119 472-3 §4.2.4 */
      credential_metadata?: {
        display?: Array<{ name?: string; locale?: string }>;
        credential_reuse_policy?: {
          id: string;
          options?: Array<{
            details: string[];
            batch_size?: number;
            reissue_trigger_unused?: number;
            reissue_trigger_lifetime_left?: number;
          }>;
        };
      };
    }
  >;
  display?: Array<{ name?: string; locale?: string }>;
}

/** QR/deep link/URL/JSON → offer kaynağı. Kabul: openid-credential-offer://?credential_offer_uri=… | ?credential_offer=… | https://… | {json} */
export function parseOffer(input: string): { offerUri?: string; offer?: CredentialOffer } {
  const s = input.trim();
  if (s.startsWith("{")) return { offer: checkOffer(parseJson(s)) };
  if (s.startsWith("http://") || s.startsWith("https://")) return { offerUri: s };
  const q = s.indexOf("?");
  if (q < 0) throw new WalletError("invalid_offer", "offer link not recognised");
  // URLSearchParams kullanılmaz (RN polyfill'inde get() yok) — elle ayrıştırma
  const params: Record<string, string> = {};
  for (const kv of s.slice(q + 1).split("&")) {
    const i = kv.indexOf("=");
    if (i > 0) params[decodeParam(kv.slice(0, i))] = decodeParam(kv.slice(i + 1).replace(/\+/g, " "));
  }
  if (params.credential_offer_uri) {
    if (!/^https?:\/\//.test(params.credential_offer_uri))
      throw new WalletError("invalid_offer", "credential_offer_uri is not a web address");
    return { offerUri: params.credential_offer_uri };
  }
  if (params.credential_offer) return { offer: checkOffer(parseJson(params.credential_offer)) };
  throw new WalletError("invalid_offer", "credential_offer(_uri) missing");
}
function decodeParam(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    throw new WalletError("invalid_offer", "offer link malformed (percent-encoding)");
  }
}
function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    throw new WalletError("invalid_offer", "offer is not JSON");
  }
}
/** Offer biçim denetimi: credential_issuer web adresi, en az bir tip; aksi hâlde anlaşılır invalid_offer. */
export function checkOffer(o: unknown): CredentialOffer {
  const x = o as Partial<CredentialOffer> | null;
  if (
    !x ||
    typeof x.credential_issuer !== "string" ||
    !/^https?:\/\/[^/]+/.test(x.credential_issuer) ||
    !Array.isArray(x.credential_configuration_ids) ||
    typeof x.credential_configuration_ids[0] !== "string"
  )
    throw new WalletError(
      "invalid_offer",
      "offer incomplete or malformed (credential_issuer / credential_configuration_ids)",
    );
  return x as CredentialOffer;
}
export async function resolveOffer(
  parsed: { offerUri?: string; offer?: CredentialOffer },
  http: Http,
): Promise<CredentialOffer> {
  if (parsed.offer) return parsed.offer;
  const r = await http(parsed.offerUri!);
  if (r.status === 404) throw new WalletError("offer_not_found", "This offer has been used or has expired (PR3).");
  if (r.status !== 200) throw new WalletError("issuer_error", `offer could not be fetched (${r.status})`);
  return checkOffer(await readJson(r, "issuer"));
}
/** RFC 8414 yol kuralı: https://issuer.tamga.network/bilgi → https://issuer.tamga.network/.well-known/openid-credential-issuer/bilgi */
export function issuerMetadataUrl(credentialIssuer: string): string {
  const m = /^(https?:\/\/[^/]+)(\/.*)?$/.exec(credentialIssuer.replace(/\/$/, ""));
  if (!m) throw new WalletError("invalid_offer", "credential_issuer is not a URL");
  return `${m[1]}/.well-known/openid-credential-issuer${m[2] ?? ""}`;
}
export const SIGNED_METADATA_TYP = "openidvci-issuer-metadata+jwt";
/**
 * Metadata. `signerFingerprints` verilirse (kurumun güven listesindeki belge imza sertifikası parmak izleri) imzalı metadata
 * istenir (OpenID4VCI §12.2.3, ISSU_32): imza, `typ`, imzacının listede olması, `sub` = issuer ve süre denetlenir; imzalı yanıt
 * doğrulanamazsa metadata KULLANILMAZ. Kurum imzalı metadata sunmuyorsa (JSON döner) imzasız metadata ile devam edilir.
 */
export async function fetchIssuerMetadata(
  credentialIssuer: string,
  http: Http,
  opts: { signerFingerprints?: string[]; now?: number } = {},
): Promise<IssuerMetadata> {
  const signed = !!opts.signerFingerprints?.length;
  const r = await http(
    issuerMetadataUrl(credentialIssuer),
    signed ? { headers: { accept: "application/jwt, application/json;q=0.5" } } : undefined,
  );
  if (r.status !== 200) throw new WalletError("issuer_error", `issuer metadata could not be fetched (${r.status})`);
  const body = (await r.text()).trim();
  let md: IssuerMetadata;
  if (signed && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(body)) {
    const d = decodeJwt(body);
    const x5c = d.header.x5c as string[] | undefined;
    if (d.header.typ !== SIGNED_METADATA_TYP || !x5c?.length)
      throw new WalletError("issuer_error", "signed issuer metadata: wrong typ or no x5c");
    const der = b64Decode(x5c[0]);
    if (!opts.signerFingerprints!.includes(certFingerprintHex(der)))
      throw new WalletError("issuer_error", "signed issuer metadata: signer is not the issuer in the trusted list");
    try {
      verifyJwt(body, p256PointFromCertDer(der));
    } catch {
      throw new WalletError("issuer_error", "signed issuer metadata: signature invalid");
    }
    const p = d.payload as unknown as IssuerMetadata & { sub?: string; iat?: number; exp?: number };
    const now = Math.floor((opts.now ?? Date.now()) / 1000);
    if (p.sub?.replace(/\/$/, "") !== credentialIssuer.replace(/\/$/, ""))
      throw new WalletError("issuer_error", "signed issuer metadata: sub is not this issuer");
    if (typeof p.iat !== "number" || p.iat > now + 60 || (typeof p.exp === "number" && p.exp <= now))
      throw new WalletError("issuer_error", "signed issuer metadata: expired or not yet valid");
    md = p;
  } else {
    try {
      md = JSON.parse(body) as IssuerMetadata;
    } catch {
      throw new WalletError("issuer_error", "issuer metadata is not JSON");
    }
  }
  // OpenID4VCI §12.2.3: metadata'daki credential_issuer, istenen issuer ile birebir aynı olmalı (başka issuer'ın metadata'sı kabul edilmez)
  if (md?.credential_issuer?.replace(/\/$/, "") !== credentialIssuer.replace(/\/$/, ""))
    throw new WalletError("issuer_error", "issuer metadata belongs to another issuer (credential_issuer mismatch)");
  if (typeof md.credential_endpoint !== "string" || typeof md.credential_configurations_supported !== "object")
    throw new WalletError(
      "issuer_error",
      "issuer metadata incomplete (credential_endpoint / credential_configurations_supported)",
    );
  return md;
}
/** Kopya sayısı: istenen (varsayılan 10) ile issuer'ın batch_size'ının küçüğü; en az 1. */
const batchOf = (want: number | undefined, md: IssuerMetadata) => {
  const n = Math.min(want ?? DEFAULT_BATCH, md.batch_credential_issuance?.batch_size ?? DEFAULT_BATCH);
  return Number.isInteger(n) && n >= 1 ? n : 1;
};

export interface RedeemInput {
  offer: CredentialOffer;
  txCode: string;
  keys: KeyProvider;
  http: Http;
  batch?: number;
  keyRefPrefix?: string;
  now?: number;
  metadata?: IssuerMetadata;
  wua?: WuaRecord; // DB-16: token isteğine OAuth-Client-Attestation(+PoP) başlıkları
  randomBytes?: (n: number) => Uint8Array;
  /** ADR-0025: anahtar kanıtı üretici (cüzdan sağlayıcı) */
  keyAttestor?: (jwks: PublicJwk[]) => Promise<string>;
}
export interface ReceivedCopy {
  combined: string;
  keyRef: string;
  cnf: PublicJwk;
  /** D-CRED-5: aynı anahtara bağlı ISO 18013-5 mdoc (base64url IssuerSigned) — yalnızca kimlik belgesinde. */
  mdoc?: string;
}
/**
 * ADR-0023: kurumun verdiği yenileme belirteci + ona bağlı DPoP anahtarı + kurumun ilan ettiği eşikler. Belgeyle birlikte
 * (şifreli cüzdan dosyasında) saklanır; sessiz yenilemede kullanılır.
 */
export interface RefreshBinding {
  token: string;
  tokenEndpoint: string;
  dpopRef: string;
  dpopJwk: PublicJwk;
  /** credential_reuse_policy: kalan kopya bu sayıya inince */
  unusedTrigger?: number;
  /** credential_reuse_policy: bitişe bu kadar saniye kala */
  lifetimeTrigger?: number;
}
export interface RedeemOutput {
  credentialIssuer: string;
  vct: string;
  metadata: IssuerMetadata;
  copies: ReceivedCopy[];
  issuedAt: number;
  refresh?: RefreshBinding;
  /** ADR-0031: takma ad tohumu belgesi (SD-JWT; yalnız kimlik servisi verir). Cüzdan `readPseudonymSeed` ile doğrular, SeedVault'a koyar. */
  pseudonymSeed?: string;
}

const form = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

/** offer + tx_code → token → nonce → N proof → credential(lar). Hata hâlinde üretilen anahtarlar silinir. */
export async function redeem(p: RedeemInput): Promise<RedeemOutput> {
  const grant = p.offer.grants?.[PRE_AUTH_GRANT];
  if (!grant) throw new WalletError("unsupported", "only the pre-authorized flow is supported (SPEC-PROTO-0001 §1)");
  const vct = p.offer.credential_configuration_ids[0];
  const issuer = p.offer.credential_issuer;
  const md = p.metadata ?? (await fetchIssuerMetadata(issuer, p.http));
  const cfg = md.credential_configurations_supported[vct];
  if (!cfg || cfg.format !== "dc+sd-jwt") throw new WalletError("unsupported", `tip desteklenmiyor: ${vct}`);
  const batch = batchOf(p.batch, md);
  const now = p.now ?? Math.floor(Date.now() / 1000);

  // token (PR1 tx_code)
  const tokenHeaders = async (): Promise<Record<string, string>> => ({
    "content-type": "application/x-www-form-urlencoded",
    ...(p.wua
      ? {
          "oauth-client-attestation": p.wua.jwt,
          "oauth-client-attestation-pop": await clientAttestationPop({
            keys: p.keys,
            wua: p.wua,
            aud: issuer,
            now,
            randomBytes: p.randomBytes,
          }),
        }
      : {}),
  });
  // DPoP (RFC 9449): belirteç bu işlemin anahtarına bağlanır; sunucu nonce isterse bir kez yeniden denenir
  const dpop = await newDpopSigner(p.keys, `dpop.${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const tr = await dpopRequest(
    p.http,
    dpop,
    `${issuer}/token`,
    {
      method: "POST",
      headers: tokenHeaders,
      body: form({
        grant_type: PRE_AUTH_GRANT,
        "pre-authorized_code": grant["pre-authorized_code"],
        tx_code: p.txCode,
      }),
    },
    { now, randomBytes: p.randomBytes },
  );
  const tokenBody = (await readJson(tr, "issuer")) as {
    access_token?: string;
    refresh_token?: string;
    c_nonce?: string;
    error?: string;
    error_description?: string;
  };
  if (tr.status !== 200 || !tokenBody.access_token) {
    await p.keys.delete(dpop.ref).catch(() => {});
    const d = tokenBody.error_description ?? tokenBody.error ?? "";
    if (d === "tx_code_mismatch") throw new WalletError("tx_code_mismatch", "Wrong PIN.");
    if (d === "too_many_attempts")
      throw new WalletError(
        "too_many_attempts",
        "Too many wrong PINs; the offer was cancelled. Ask the institution for a new one.",
      );
    if (d === "offer_used")
      throw new WalletError("offer_used", "This offer was already used. If it was not you, tell the institution.");
    if (d === "offer_expired") throw new WalletError("offer_expired", "The offer has expired.");
    if (tokenBody.error === "invalid_client")
      throw new WalletError("unsupported", `Wallet attestation (WUA) rejected: ${d}`);
    throw new WalletError("issuer_error", `token error: ${d || tr.status}`);
  }
  return obtainCredential({
    issuer,
    vct,
    metadata: md,
    accessToken: tokenBody.access_token,
    cNonce: tokenBody.c_nonce,
    keys: p.keys,
    http: p.http,
    batch,
    keyRefPrefix: p.keyRefPrefix,
    keyAttestor: p.keyAttestor,
    now,
    dpop,
    randomBytes: p.randomBytes,
    refreshToken: tokenBody.refresh_token,
    tokenEndpoint: `${issuer}/token`,
  });
}

export interface ObtainInput {
  issuer: string;
  vct: string;
  metadata: IssuerMetadata;
  accessToken: string;
  cNonce?: string;
  keys: KeyProvider;
  http: Http;
  batch?: number;
  keyRefPrefix?: string;
  now?: number;
  /** DPoP: belirteç bağlıysa her istekte kanıt; akış sonunda anahtar silinir. */
  dpop?: DpopSigner;
  randomBytes?: (n: number) => Uint8Array;
  /** ADR-0025: verilirse belge anahtarları sağlayıcı imzalı anahtar kanıtıyla (KA) istenir */
  keyAttestor?: (jwks: PublicJwk[]) => Promise<string>;
  /** ADR-0023: token yanıtındaki yenileme belirteci — varsa DPoP anahtarı silinmez, belgeyle saklanır */
  refreshToken?: string;
  tokenEndpoint?: string;
}

/** credential_reuse_policy (ETSI TS 119 472-3 §4.2.4.2) → yenileme eşikleri */
function reuseTriggers(md: IssuerMetadata, vct: string) {
  const o = md.credential_configurations_supported[vct]?.credential_metadata?.credential_reuse_policy?.options?.[0];
  return { unusedTrigger: o?.reissue_trigger_unused, lifetimeTrigger: o?.reissue_trigger_lifetime_left };
}
/** Erişim belirteci elde → nonce → N anahtar + proof (PR6) → credential(lar). Pre-authorized ve authorization code akışlarının ortak kuyruğu. */
export async function obtainCredential(p: ObtainInput): Promise<RedeemOutput> {
  const md = p.metadata;
  const issuer = p.issuer;
  const vct = p.vct;
  const batch = batchOf(p.batch, md);
  const now = p.now ?? Math.floor(Date.now() / 1000);
  // nonce (OpenID4VCI 1.0 nonce endpoint; token yanıtındaki c_nonce ile aynı havuz)
  let nonce = p.cNonce;
  if (md.nonce_endpoint) {
    const nr = await p.http(md.nonce_endpoint, { method: "POST" });
    if (nr.status === 200) nonce = ((await readJson(nr, "issuer")) as { c_nonce: string }).c_nonce;
  }
  if (!nonce) throw new WalletError("issuer_error", "c_nonce missing");

  // anahtarlar + proof'lar (PR6: her kopya farklı anahtar)
  const prefix = p.keyRefPrefix ?? `c${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const copies: ReceivedCopy[] = [];
  const proofs: string[] = [];
  let keepDpop = false;
  try {
    for (let i = 0; i < batch; i++) {
      const ref = `${prefix}.${i}`;
      const jwk = await p.keys.generate(ref);
      if (!p.keyAttestor)
        proofs.push(await signJwt({ typ: PROOF_TYP, jwk }, { aud: issuer, nonce, iat: now }, p.keys, ref));
      copies.push({ combined: "", keyRef: ref, cnf: jwk });
    }
    // ADR-0025 / TS3: paket anahtarları tek anahtar kanıtında; tek proof, attested_keys[0] ile imzalı
    if (p.keyAttestor) {
      const ka = await p.keyAttestor(copies.map((c) => c.cnf));
      proofs.push(
        await signJwt(
          { typ: "openid4vci-proof+jwt", key_attestation: ka },
          { aud: issuer, nonce, iat: now },
          p.keys,
          copies[0].keyRef,
        ),
      );
    }
    const credBody = JSON.stringify({ credential_configuration_id: vct, proofs: { jwt: proofs } });
    const cr = p.dpop
      ? await dpopRequest(
          p.http,
          p.dpop,
          md.credential_endpoint,
          {
            method: "POST",
            headers: { authorization: `DPoP ${p.accessToken}`, "content-type": "application/json" },
            body: credBody,
          },
          { now, accessToken: p.accessToken, randomBytes: p.randomBytes },
        )
      : await p.http(md.credential_endpoint, {
          method: "POST",
          headers: { authorization: `Bearer ${p.accessToken}`, "content-type": "application/json" },
          body: credBody,
        });
    const body = (await readJson(cr, "issuer")) as {
      credentials?: Array<{ credential: string; mso_mdoc?: string }>;
      /** ADR-0031 (Tamga profili): kimlik belgesiyle gelen, sunulamayan takma ad tohumu belgesi */
      pseudonym_seed?: string;
      error?: string;
      error_description?: string;
    };
    if (cr.status !== 200 || !body.credentials)
      throw new WalletError(
        "issuer_error",
        `credential error: ${body.error_description ?? body.error ?? cr.status}`,
        body,
      );
    if (body.credentials.length !== copies.length)
      throw new WalletError("issuer_error", "number of copies does not match the number of proofs");
    body.credentials.forEach((c, i) => {
      copies[i].combined = c.credential;
      if (c.mso_mdoc) copies[i].mdoc = c.mso_mdoc; // Tamga profili PR16: kopya başına ikinci temsil
    });
    const refresh: RefreshBinding | undefined =
      p.refreshToken && p.dpop && p.tokenEndpoint
        ? {
            token: p.refreshToken,
            tokenEndpoint: p.tokenEndpoint,
            dpopRef: p.dpop.ref,
            dpopJwk: p.dpop.jwk,
            ...reuseTriggers(md, vct),
          }
        : undefined;
    keepDpop = !!refresh;
    return {
      credentialIssuer: issuer,
      vct,
      metadata: md,
      copies,
      issuedAt: now,
      ...(refresh ? { refresh } : {}),
      ...(typeof body.pseudonym_seed === "string" ? { pseudonymSeed: body.pseudonym_seed } : {}),
    };
  } catch (e) {
    for (const c of copies) await p.keys.delete(c.keyRef).catch(() => {});
    throw e;
  } finally {
    if (p.dpop && !keepDpop) await p.keys.delete(p.dpop.ref).catch(() => {});
  }
}

export const _utf8 = utf8;
