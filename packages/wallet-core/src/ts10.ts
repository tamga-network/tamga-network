/**
 * AB TS10 — işlem günlüğü ve taşıma nesnesi (ARF konu 34, DASH_07; CIR 2024/2979 md. 9, 13).
 *  - İşlem günlüğü (`TransactionLog`) ve taşıma verisi (`MigrationData`) TS10 §3 veri modelinde üretilir.
 *  - Dışa aktarma parolayla şifreli JWE: `PBES2-HS256+A128KW` + `A128GCM` (TS10 §5). Saf TS (RN/Hermes): @noble.
 *  - Cihaza bağlı belgelerin özel anahtarları TAŞINMAZ; yeni cüzdanda `listOfCredentials`'taki belgeler kurumlardan yeniden
 *    alınır. Tamga'da cihaza bağlı olmayan belge yoktur (`nonDeviceBoundCredentials` boş).
 *  - Günlükte değer yok, yalnız alan adları (WL4). Doğrulayıcı/kurum bilgisi dışa aktarma anında imzalı güven listesinden
 *    doldurulur (`lookup`); kayıtta olmayan zorunlu alan boş bırakılmaz, bilinen kadarı yazılır.
 *  - `x_tamga`: aynı cüzdan yazılımına geri yüklemek için Tamga'nın kendi günlüğü (TS10 okuyucuları bilinmeyen alanı yok sayar).
 */
import { gcm, aeskw } from "@noble/ciphers/aes.js";
import { pbkdf2, pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";
import { b64u, b64uDecode, concat, utf8 } from "./b64.js";
import type { PresentationLogEntry, WalletEvent, WalletState } from "./store.js";

export const TS10_ALG = "PBES2-HS256+A128KW";
export const TS10_ENC = "A128GCM";
export const TS10_DEFAULT_ITERATIONS = 200_000;
const MAX_ITERATIONS = 2_000_000; // içe aktarmada aşırı yüke karşı
export const TS10_MIN_PASSWORD = 8;

export interface Ts10Identifier {
  type: string;
  identifier: string;
}
export interface Ts10LangString {
  lang: string;
  content: string;
}
/** Güven listesinden: doğrulayıcı ya da kurum (yalnız kurumlar; kişi verisi yok). */
export interface Ts10Party {
  identifier?: Ts10Identifier;
  name: string;
  /** [ülke, e-posta | telefon | web …] */
  contact: string[];
  registrarURL?: string;
  purpose?: Ts10LangString[];
  privacyPolicy?: string;
  dpaName?: string;
  dpaCountry?: string;
  dpaContact?: string[];
  /** kurum: QEAAProvider | NonQEAAProvider | PubEEAProvider | PIDProvider */
  issuerType?: string;
  supplyPointURL?: string;
}
export interface Ts10Lookup {
  relyingParty?: (clientId: string, vct: string) => Ts10Party | undefined;
  issuer?: (issuerId: string) => Ts10Party | undefined;
}

/** Tamga kayıt kimlik numarası → TS2 §2.8.2 Identifier */
export function ts10Identifier(ids: Array<{ scheme: string; value: string }> | undefined): Ts10Identifier | undefined {
  const vkn = ids?.find((i) => i.scheme === "TR-VKN");
  if (vkn) return { type: "http://data.europa.eu/eudi/id/TIN", identifier: vkn.value };
  const lei = ids?.find((i) => i.scheme === "LEI");
  if (lei) return { type: "http://data.europa.eu/eudi/id/LEI", identifier: lei.value };
  const m = ids?.[0];
  return m ? { type: `urn:tamga:id:${m.scheme}`, identifier: m.value } : undefined;
}
/** Tamga sınıfı → TS10 issuerType */
export const ts10IssuerType = (klass: string | undefined) =>
  klass === "QUALIFIED" ? "QEAAProvider" : klass === "PUB" ? "PubEEAProvider" : "NonQEAAProvider";

const isoSec = (ms: number) => new Date(ms).toISOString().slice(0, 19); // TS10: YYYY-MM-DDTHH:mm:ss
const txId = (kind: string, ts: number, i: number) => b64u(sha256(utf8(`${kind}|${ts}|${i}`))).slice(0, 22); // yerel, anlamsız; kişisel veri içermez

function party(p: Ts10Party | undefined, fallbackName: string) {
  return {
    ...(p?.identifier ? { interactingPartyIdentifier: p.identifier } : {}),
    interactingPartyName: p?.name ?? fallbackName,
    interactingPartyContact: p?.contact ?? [],
  };
}

function presentationTx(e: PresentationLogEntry, i: number, lookup: Ts10Lookup) {
  const rp = lookup.relyingParty?.(e.clientId, e.vct);
  const presented = e.outcome === "sent" ? e.disclosed : [];
  return {
    presentation: {
      ...party(rp, e.clientId),
      interactingPartyType: "ServiceProvider",
      isIntermediary: false,
      ...(rp?.registrarURL ? { registrarURL: rp.registrarURL } : {}),
      ...(rp?.purpose ? { purpose: rp.purpose } : {}),
      ...(rp?.privacyPolicy
        ? { privacyPolicy: { type: "http://data.europa.eu/eudi/policy/privacy-policy", policyURI: rp.privacyPolicy } }
        : {}),
      ...(rp?.dpaName ? { dpaName: rp.dpaName, dpaCountry: rp.dpaCountry, dpaContact: rp.dpaContact ?? [] } : {}),
      listOfClaimsRequested: [{ credentialIdentifier: e.vct, claims: e.requested ?? e.disclosed }],
      listOfClaimsPresented: presented.length ? [{ credentialIdentifier: e.vct, claims: presented }] : [],
      ...(e.outcome !== "sent"
        ? { reasonOfNoncompletion: e.outcome === "declined" ? "declined by user" : "error" }
        : {}),
    },
    transactionIdentifier: txId("p", e.ts, i),
    time: isoSec(e.ts),
    transactionType: "Presentation",
    transactionResult: e.outcome === "sent" ? "Completed" : "NotCompleted",
  };
}

function eventTx(e: WalletEvent, i: number, state: WalletState, lookup: Ts10Lookup) {
  const base = { transactionIdentifier: txId("e", e.ts, i), time: isoSec(e.ts), transactionResult: "Completed" };
  if (e.kind === "deleted") {
    const issuer = state.credentials.find((c) => c.vct === e.vct);
    const ip = issuer ? lookup.issuer?.(issuer.issuerId) : undefined;
    return {
      ...base,
      transactionType: "CredentialDeletion",
      credentialDeletion: {
        credentialIdentifier: e.vct,
        ...(ip?.identifier ? { credentialIssuerIdentifier: ip.identifier } : {}),
        credentialIssuerName: ip?.name ?? e.typeName,
      },
    };
  }
  if (e.kind === "deletion_request") {
    const rp = e.clientId ? lookup.relyingParty?.(e.clientId, e.vct) : undefined;
    return {
      ...base,
      transactionType: "DataDeletionRequest",
      dataDeletionRequest: {
        ...(rp?.identifier ? { interactingPartyIdentifier: rp.identifier } : {}),
        interactingPartyName: rp?.name ?? e.clientId ?? "",
        listOfClaims: [{ credentialIdentifier: e.vct, claims: [] }],
      },
    };
  }
  return {
    ...base,
    transactionType: "DPAReport",
    dpaReport: { dpaName: e.authority ?? "", dpaCountry: "TR" },
  };
}

/** TS10 §3.16 TransactionLog — sunumlar, silme/haklar olayları ve belge alımları, zamana göre. */
export function ts10TransactionLog(state: WalletState, lookup: Ts10Lookup = {}) {
  const txs: Array<{ time: string } & Record<string, unknown>> = [];
  state.presentationLog.forEach((e, i) => txs.push(presentationTx(e, i, lookup)));
  (state.events ?? []).forEach((e, i) => txs.push(eventTx(e, i, state, lookup)));
  state.credentials.forEach((c, i) => {
    const ip = lookup.issuer?.(c.issuerId);
    txs.push({
      credentialIssuance: {
        ...(ip?.identifier ? { interactingPartyIdentifier: ip.identifier } : {}),
        interactingPartyType: ip?.issuerType ?? "NonQEAAProvider",
        interactingPartyName: ip?.name ?? c.issuer,
        interactingPartyContact: ip?.contact ?? [],
        credentialNumberRequested: c.copies.length,
        credentialNumberIssued: c.copies.length,
        credentialIdentifier: [c.vct],
        isUserTriggered: true,
      },
      transactionIdentifier: txId("i", c.receivedAt, i),
      time: isoSec(c.receivedAt),
      transactionType: "CredentialIssuance",
      transactionResult: "Completed",
    });
  });
  return txs.sort((a, b) => a.time.localeCompare(b.time));
}

/** TS10 §3.18 MigrationData. Belgelerin değerleri ve anahtarları girmez; yalnız yeniden alınacak belgelerin listesi. */
/**
 * `includeLog`: işlem günlüğü dosyaya girsin mi (varsayılan evet — ADR-0027 / D-WALLET-2: kişinin başlattığı şifreli
 * dışa aktarma). `false` yalnız belge listesi.
 */
export function ts10MigrationData(state: WalletState, lookup: Ts10Lookup = {}, opts: { includeLog?: boolean } = {}) {
  const withLog = opts.includeLog !== false;
  const seen = new Set<string>();
  const listOfCredentials = state.credentials
    .filter((c) => !c.revokedLocally && c.status?.value !== "revoked")
    .filter((c) => (seen.has(`${c.issuerId}|${c.vct}`) ? false : (seen.add(`${c.issuerId}|${c.vct}`), true)))
    .map((c) => {
      const ip = lookup.issuer?.(c.issuerId);
      return {
        credentialIdentifier: c.vct,
        format: "dc+sd-jwt",
        issuerIdentifier: ip?.identifier ? [ip.identifier] : [],
        issuerType: ip?.issuerType ?? "NonQEAAProvider",
        issuerName: ip?.name ?? c.issuer,
        supplyPointURL: ip?.supplyPointURL ?? c.issuer,
        x_tamga_issuer_id: c.issuerId,
      };
    });
  return {
    transactionLog: withLog ? ts10TransactionLog(state, lookup) : [],
    listOfCredentials,
    nonDeviceBoundCredentials: [] as Array<{ format: string; credential: string }>,
    x_tamga: {
      format: "tamga-wallet-migration/1",
      presentationLog: withLog ? state.presentationLog : [],
      events: withLog ? (state.events ?? []) : [],
      settings: { autoRefresh: state.settings.autoRefresh, theme: state.settings.theme },
    },
  };
}
export type Ts10MigrationData = ReturnType<typeof ts10MigrationData>;

// ---------------------------------------------------------------- JWE (TS10 §5)
type Kdf = (password: Uint8Array, salt: Uint8Array, c: number) => Uint8Array | Promise<Uint8Array>;
const syncKdf: Kdf = (p, s, c) => pbkdf2(sha256, p, s, { c, dkLen: 16 });
/** Telefonda arayüzü dondurmamak için olay döngüsüne nefes aldıran PBKDF2 (@noble asyncTick). */
const asyncKdf: Kdf = (p, s, c) => pbkdf2Async(sha256, p, s, { c, dkLen: 16, asyncTick: 20 });
// RFC 7518 §4.8.1.1: salt = UTF8(alg) || 0x00 || p2s
const saltOf = (p2s: Uint8Array) => concat(utf8(TS10_ALG), new Uint8Array([0]), p2s);
const pwBytes = (password: string) => utf8(password.normalize("NFC"));

function sealWith(obj: unknown, kekBytes: Uint8Array, h: string, rnd: (n: number) => Uint8Array): string {
  const cek = rnd(16);
  const encKey = aeskw(kekBytes).encrypt(cek);
  const iv = rnd(12);
  const sealed = gcm(cek, iv, utf8(h)).encrypt(utf8(JSON.stringify(obj)));
  const ct = sealed.subarray(0, sealed.length - 16);
  const tag = sealed.subarray(sealed.length - 16);
  return [h, b64u(encKey), b64u(iv), b64u(ct), b64u(tag)].join(".");
}
function prepareSeal(password: string, opts: { iterations?: number; randomBytes?: (n: number) => Uint8Array }) {
  if (password.length < TS10_MIN_PASSWORD) throw new Error(`password must be at least ${TS10_MIN_PASSWORD} characters`);
  const rnd = opts.randomBytes ?? nobleRandom;
  const p2s = rnd(16);
  const p2c = opts.iterations ?? TS10_DEFAULT_ITERATIONS;
  const h = b64u(utf8(JSON.stringify({ alg: TS10_ALG, enc: TS10_ENC, p2s: b64u(p2s), p2c, cty: "json" })));
  return { rnd, p2s, p2c, h };
}

/** Parolayla şifreli JWE (compact). Parola en az 8 karakter; yinelemeler varsayılan 200 000. */
export function encryptTs10(
  obj: unknown,
  password: string,
  opts: { iterations?: number; randomBytes?: (n: number) => Uint8Array } = {},
): string {
  const p = prepareSeal(password, opts);
  return sealWith(obj, syncKdf(pwBytes(password), saltOf(p.p2s), p.p2c) as Uint8Array, p.h, p.rnd);
}
/** `encryptTs10`'un arayüzü dondurmayan sürümü (cüzdan uygulaması). */
export async function encryptTs10Async(
  obj: unknown,
  password: string,
  opts: { iterations?: number; randomBytes?: (n: number) => Uint8Array } = {},
): Promise<string> {
  const p = prepareSeal(password, opts);
  return sealWith(obj, await asyncKdf(pwBytes(password), saltOf(p.p2s), p.p2c), p.h, p.rnd);
}

export class Ts10DecryptError extends Error {}

function parseJwe(jwe: string) {
  const parts = jwe.trim().split(".");
  if (parts.length !== 5) throw new Ts10DecryptError("not a JWE");
  const [h, ek, ivB, ctB, tagB] = parts;
  let header: { alg?: string; enc?: string; p2s?: string; p2c?: number };
  try {
    header = JSON.parse(new TextDecoder().decode(b64uDecode(h)));
  } catch {
    throw new Ts10DecryptError("bad header");
  }
  if (header.alg !== TS10_ALG || header.enc !== TS10_ENC || !header.p2s || typeof header.p2c !== "number")
    throw new Ts10DecryptError("unsupported algorithm");
  if (header.p2c < 1000 || header.p2c > MAX_ITERATIONS) throw new Ts10DecryptError("iteration count out of range");
  return { h, ek, ivB, ctB, tagB, p2s: b64uDecode(header.p2s), p2c: header.p2c };
}
function openWith<T>(j: ReturnType<typeof parseJwe>, kekBytes: Uint8Array): T {
  try {
    const cek = aeskw(kekBytes).decrypt(b64uDecode(j.ek));
    const plain = gcm(cek, b64uDecode(j.ivB), utf8(j.h)).decrypt(concat(b64uDecode(j.ctB), b64uDecode(j.tagB)));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new Ts10DecryptError("wrong password or damaged file");
  }
}

/** Çözme: yanlış parola ya da bozuk dosya → `Ts10DecryptError` (ayrım yapılmaz). */
export function decryptTs10<T = unknown>(jwe: string, password: string): T {
  const j = parseJwe(jwe);
  return openWith<T>(j, syncKdf(pwBytes(password), saltOf(j.p2s), j.p2c) as Uint8Array);
}
/** `decryptTs10`'un arayüzü dondurmayan sürümü. */
export async function decryptTs10Async<T = unknown>(jwe: string, password: string): Promise<T> {
  const j = parseJwe(jwe);
  return openWith<T>(j, await asyncKdf(pwBytes(password), saltOf(j.p2s), j.p2c));
}

/**
 * Taşıma nesnesini yeni (boş) cüzdana uygular: günlük geri gelir; belgeler gelmez — dönen `toReissue` listesi kullanıcıya
 * "yeniden al" olarak gösterilir. Var olan günlük korunur, içe aktarılan önce gelir.
 */
export function applyMigration(
  state: WalletState,
  data: Ts10MigrationData,
  /** ARF Mig_07b: günlüğün geri yüklenmesi kişiye sorulur; `false` → yalnız belge listesi ve ayarlar */
  opts: { restoreLog?: boolean } = {},
): { state: WalletState; toReissue: Ts10MigrationData["listOfCredentials"] } {
  const x = data.x_tamga;
  const next: WalletState = {
    ...state,
    presentationLog: [...(opts.restoreLog === false ? [] : (x?.presentationLog ?? [])), ...state.presentationLog],
    events: [...(opts.restoreLog === false ? [] : (x?.events ?? [])), ...(state.events ?? [])],
    settings: {
      ...state.settings,
      ...(x?.settings?.autoRefresh !== undefined ? { autoRefresh: x.settings.autoRefresh } : {}),
      ...(x?.settings?.theme ? { theme: x.settings.theme } : {}),
    },
  };
  return { state: next, toReissue: data.listOfCredentials ?? [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;
const contactOf = (r: Rec): string[] =>
  [r.postal_address?.country ?? "TR", r.contact?.email, r.contact?.phone, r.contact?.support_uri ?? r.info_uri].filter(
    (x): x is string => typeof x === "string" && !!x,
  );

/** İmzası doğrulanmış güven listesinden (TrustSource) TS10 doldurucu. `registrarURL` = ulusal listenin adresi. */
export function ts10LookupFromTrust(
  source: { relyingParty(clientId: string): unknown; issuer(issuerId: string): unknown },
  registrarURL: string,
): Ts10Lookup {
  return {
    relyingParty(clientId, vct) {
      const rp = source.relyingParty(clientId) as Rec | null;
      if (!rp) return undefined;
      const scope = ((rp.scopes ?? []) as Rec[]).find((s) => s.vct === vct);
      const sa = rp.supervisory_authority as Rec | undefined;
      return {
        identifier: ts10Identifier(rp.identifiers),
        name: rp.trade_name ?? rp.legal_name,
        contact: contactOf(rp),
        registrarURL,
        ...(scope
          ? {
              purpose: [
                { lang: "en", content: String(scope.purpose) },
                ...Object.entries((scope.purpose_localized ?? {}) as Record<string, string>).map(([lang, content]) => ({
                  lang,
                  content,
                })),
              ],
              ...(scope.privacy_policy_uri ? { privacyPolicy: String(scope.privacy_policy_uri) } : {}),
            }
          : {}),
        ...(sa
          ? {
              dpaName: String(sa.name),
              dpaCountry: String(sa.country),
              dpaContact: [sa.email, sa.phone, sa.form_uri ?? sa.info_uri].filter((x): x is string => !!x),
            }
          : {}),
      };
    },
    issuer(issuerId) {
      const i = source.issuer(issuerId) as Rec | null;
      if (!i) return undefined;
      return {
        identifier: ts10Identifier(i.identifiers),
        name: i.trade_name ?? i.legal_name,
        contact: contactOf(i),
        issuerType: ts10IssuerType(i.class),
        supplyPointURL: i.issuer_url,
      };
    },
  };
}
