/**
 * conformance/openid4vp.ts — OpenID4VP uyum vektörlerinin ortak yardımcıları (üreteç ve koşucu aynı kodu kullanır).
 *
 *  1. KB-JWT `aud` iki yol (SPEC-PROTO-0002 §5.1, §7.1, PV7): cihazlar arası yolda (imzalı istek / QR) client identifier,
 *     Digital Credentials API yolunda `origin:<köken>` (OpenID4VP 1.0 Ek A.4). Doğrulayıcının adım kodu `verifyPresentation`'dan.
 *  2. Yanıtın işlenmesi (ADR-0067): dalın anahtarına şifreli yanıt (JWE, `kid` = `enc-<sunum>.<dal>`), şifreli ve şifresiz ret
 *     (`error=access_denied` + `state`), yumuşak ret, denemeler, çözülemeyen yanıt. `processResponse` Tamga Verify'ın yanıt ucunun
 *     sırasını izler (`responseKidOf` → `BranchSet.get` → `begin` → `openPresentationResponse` → `isOpen` → `stateMatches` →
 *     `decline` / `failedAttempt` / `tryConsume` → `end`; şifresiz ret `BranchRegistry.byState`).
 *  3. Dal `kid` adlandırması (`encKid`, `responseKidOf`).
 *
 * Deterministik girdiler: anahtarlar sabit tohumlardan türetilir (P-256 gizli sayı = SHA-256(etiket)), zaman sabit, `state` /
 * `nonce` / dal adları sabit, cüzdanın JWE efemer anahtarı ve IV'si sabit bayt akışından. Belge veren imzası ve disclosure tuzları
 * her üretimde değişir (ES256 imzası rastgele); vektör beklentileri bunlara bağlı değildir.
 */
import { createHash } from "node:crypto";
import { p256 } from "@noble/curves/nist.js";
import { calculateJwkThumbprint, importJWK, type JWK } from "jose";
import type { TrustSource } from "@tamga-network/trust";
import { epochSeconds, pemToDer } from "@tamga-network/core";
import {
  BranchRegistry,
  BranchSet,
  MemoryStatusCache,
  openPresentationResponse,
  responseKidOf,
  verifyPresentation,
  type Branch,
  type KeyLike,
  type Policy,
  type PresentationSession,
  type RequestBranch,
  type VerificationResult,
} from "@tamga-network/verifier";

/** Vektör anahtarlarının tohum öneki — yalnız bu vektöre özgü test anahtarları (gerçek bir sistemde kullanılmaz). */
export const KEY_SEED_PREFIX = "tamga-conformance/openid4vp/";

const sha256 = (s: string | Uint8Array) => new Uint8Array(createHash("sha256").update(s).digest());
const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");

/** Sabit tohumdan P-256 anahtarı (JWK, `d` dahil): gizli sayı = SHA-256(önek + etiket). */
export function seededP256(label: string): JWK & { kty: "EC"; crv: "P-256"; x: string; y: string; d: string } {
  const d = sha256(KEY_SEED_PREFIX + label);
  if (!p256.utils.isValidSecretKey(d)) throw new Error(`seed ${label} is not a valid P-256 scalar`);
  const pub = p256.getPublicKey(d, false); // 0x04 || x || y
  return { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: b64u(d) };
}

/** Sabit tohumdan sabit uzunlukta base64url değer (`state`, `nonce`). */
export const seededValue = (label: string, bytes: number) => b64u(sha256(KEY_SEED_PREFIX + label).subarray(0, bytes));

/** Sabit tohumlu bayt akışı (cüzdanın JWE efemer anahtarı ve IV'si — `encryptJwe` `randomBytes`). */
export function seededRandom(label: string): (n: number) => Uint8Array {
  let counter = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 32) out.set(sha256(`${KEY_SEED_PREFIX}${label}#${counter++}`).subarray(0, n - i), i);
    return out;
  };
}

export const publicJwk = (j: JWK): JWK => {
  const { d: _d, ...pub } = j;
  return pub;
};

/**
 * KB-JWT `aud` vakaları için en küçük güven kaynağı: yalnız tazelik sağlıklı (T0 geçer), hiçbir kayıt yok. A adımı güven kaynağına
 * bakmaz; B adımı türü bulamaz (B2). Vakaların beklentisi yalnız A adımlarıdır.
 */
export function aStageTrust(): TrustSource {
  return {
    isCredentialAcceptable: () => "UNKNOWN",
    isCredentialSchemaAcceptable: () => "UNKNOWN",
    isRecognizedBy: () => "UNKNOWN",
    schemaContentHash: () => null,
    schemaContentHashes: () => [],
    statusAnchor: () => null,
    relyingParty: () => null,
    relyingPartyByDnsName: () => null,
    issuer: () => null,
    schema: () => null,
    isWalletProviderKey: () => "UNKNOWN",
    freshness: () => ({ source: "list", version: 1, ageSec: 0, healthy: true }),
  };
}

/** A adımlarının hepsi (A3c dev PKI'da atlanır) — "geçer" beklentisi bunların yapıldığını ve hatanın A'da olmadığını söyler. */
export const A_STEPS_DONE = ["A1", "A2", "A3", "A3b", "A3d", "A4", "A5", "A6", "A7", "A8"] as const;

/** Vektördeki politika (yalnız A adımları için; T0 tazelik sınırları geçerli olmalı). */
export function aStagePolicy(vct: string): Policy {
  return {
    policy_id: "conformance-openid4vp",
    purpose: { "en-US": "conformance" },
    credentials: [{ id: "diploma", vct_values: [vct], required_claims: ["is_graduate"] }],
    trust: {
      min_issuer_assurance: "I2",
      allowed_categories: ["EDUCATION"],
      require_recognition: false,
      state_code: "TR",
    },
    freshness: { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 86400 },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Yanıtın işlenmesi (ADR-0067)

export interface VectorBranch {
  branch_id: string;
  kid: string;
  state: string;
  nonce: string;
  enc_public_jwk: JWK;
  enc_private_jwk: JWK;
}
export interface VectorDcApi {
  state: string;
  nonce: string;
  expected_origins: string[];
  kid: string;
  enc_public_jwk: JWK;
  enc_private_jwk: JWK;
}

/** Yanıt ucunun gözlenen sonucu — vektördeki `expect` ile birebir karşılaştırılır. */
export type Observed =
  | { result: "unknown_presentation" }
  | { result: "unknown_request_object" }
  | { result: "undecryptable" }
  | { result: "closed"; branch?: string }
  | { result: "busy" | "used" | "error_not_on_this_path" }
  | { result: "declined"; branch: string; presentation_rejected: boolean }
  | { result: "attempt"; branch: string | null; attempts: number; branch_closed: boolean }
  | {
      result: "presentation";
      branch: string | null;
      path: "cross_device" | "dc_api";
      nonce: string;
      consumed: boolean;
    };

export interface ResponseEvent {
  name: string;
  /** `jwe`: `response=<JWE>` (şifreli yanıt ya da şifreli ret) · `form`: şifresiz hata yanıtı gövdesi */
  kind: "jwe" | "form";
  body: string;
  expect: Observed;
}

export interface Harness {
  registry: BranchRegistry;
  set: BranchSet;
  req: PresentationSession;
  responseUri: string;
  now: number;
}

async function importEnc(j: JWK): Promise<{ key: KeyLike; thumb: Uint8Array }> {
  const key = (await importJWK(j, "ECDH-ES")) as KeyLike;
  const thumb = new Uint8Array(Buffer.from(await calculateJwkThumbprint(publicJwk(j), "sha256"), "base64url"));
  return { key, thumb };
}

/**
 * Bir senaryonun doğrulayıcı durumu: `fetches` sırasıyla dallar açılır (`BranchSet.fetch`, sabit dal içeriğiyle); DC API nesnesi
 * sunumda (dal değil). Saat sabit (`now`).
 */
export async function openHarness(o: {
  presentationId: string;
  expiresAt: number;
  now: number;
  responseUri: string;
  branches: VectorBranch[];
  fetches: string[];
  dcApi: VectorDcApi;
}): Promise<Harness> {
  const registry = new BranchRegistry();
  const queue = [...o.fetches];
  const byId = new Map(o.branches.map((b) => [b.branch_id, b]));
  const set = new BranchSet({
    registry,
    presentationId: o.presentationId,
    expiresAt: o.expiresAt,
    clock: () => o.now,
    content: undefined as never, // `mint` verildiği için kullanılmaz
    mint: async (): Promise<RequestBranch> => {
      const b = byId.get(queue.shift() ?? "");
      if (!b) throw new Error("no more vector branches");
      const { key, thumb } = await importEnc(b.enc_private_jwk);
      return {
        branchId: b.branch_id,
        nonce: b.nonce,
        state: b.state,
        requestJwt: "", // imzalı istek nesnesi bu vektörün konusu değil (içeriği `request_object_claims`'te)
        encPrivateKey: key,
        encPublicJwk: b.enc_public_jwk,
        encJwkThumbprint: thumb,
        createdAt: o.now,
      };
    },
  });
  for (let i = 0; i < o.fetches.length; i++) {
    const f = await set.fetch();
    if (!f.ok) throw new Error(`fetch failed: ${f.reason}`);
  }
  const dc = await importEnc(o.dcApi.enc_private_jwk);
  const req: PresentationSession = {
    presentationId: o.presentationId,
    nonce: o.dcApi.nonce,
    state: o.dcApi.state,
    requestUri: "",
    qrPayload: "",
    expiresAt: o.expiresAt,
    dcql: { credentials: [] },
    dcApi: {
      requestJwt: "",
      expectedOrigins: [...o.dcApi.expected_origins],
      encPrivateKey: dc.key,
      encPublicJwk: o.dcApi.enc_public_jwk,
      encJwkThumbprint: dc.thumb,
    },
  };
  return { registry, set, req, responseUri: o.responseUri, now: o.now };
}

const sameSecret = (a: string, b: string) => {
  const x = sha256(a),
    y = sha256(b);
  return Buffer.compare(Buffer.from(x), Buffer.from(y)) === 0;
};

/**
 * Bir yanıtı doğrulayıcının yanıt ucundaki sırayla işler (Tamga Verify `POST /vp/response`). Sunumun içeriği (A–E) burada
 * doğrulanmaz — o, KB `aud` vakalarının konusudur; `presentation` sonucu "doğrulamaya geçer" demektir ve kabul `tryConsume` ile
 * (doğrulama geçmiş sayılarak) tüketilir.
 */
export async function processResponse(h: Harness, ev: Pick<ResponseEvent, "kind" | "body">): Promise<Observed> {
  const { set, registry, req } = h;
  if (ev.kind === "form") {
    const f = new URLSearchParams(ev.body);
    const state = f.get("state");
    if (typeof f.get("error") !== "string" || !state) return { result: "unknown_presentation" };
    const hit = registry.byState(state, h.now);
    if (!hit || hit.set !== set) return { result: "unknown_presentation" };
    if (set.declineBlocked(hit.branch)) return { result: "busy" };
    const d = set.decline(hit.branch);
    return { result: "declined", branch: hit.branch.branchId, presentation_rejected: d.presentationRejected };
  }
  const jwe = new URLSearchParams(ev.body).get("response") ?? "";
  const kid = responseKidOf(jwe);
  if (!kid || kid.presentationId !== req.presentationId) return { result: "unknown_presentation" };
  if (set.used) return { result: "used" };
  let branch: Branch | undefined;
  if (kid.path === "cross_device") {
    branch = kid.branchId !== undefined ? set.get(kid.branchId) : undefined;
    if (!branch) return { result: "unknown_request_object" };
  }
  const lock = set.begin(branch);
  if (lock !== "ok")
    return lock === "closed"
      ? { result: "closed", branch: branch?.branchId }
      : lock === "gone"
        ? { result: "unknown_request_object" }
        : { result: lock };
  try {
    let opened: Awaited<ReturnType<typeof openPresentationResponse<Branch>>>;
    try {
      opened = await openPresentationResponse<Branch>(jwe, req, h.responseUri, (id) =>
        branch && branch.branchId === id ? branch : undefined,
      );
    } catch {
      return { result: "undecryptable" }; // deneme sayılmaz (RQ4)
    }
    if (!set.isOpen(branch)) return { result: "closed", branch: branch?.branchId };
    const stateIs = (s: string | undefined) =>
      s !== undefined && (branch ? set.stateMatches(branch, s) : sameSecret(s, req.state));
    const attempt = (): Observed => {
      const a = set.failedAttempt(branch);
      return { result: "attempt", branch: branch?.branchId ?? null, attempts: a.n, branch_closed: a.branchClosed };
    };
    if (opened.kind === "error") {
      if (!branch) return { result: "error_not_on_this_path" }; // DC API yolunda ret yanıt ucuna gelmez (RQ6); deneme değil
      if (!stateIs(opened.state)) return attempt();
      if (set.declineBlocked(branch, { holdingLock: true })) return { result: "busy" };
      const d = set.decline(branch);
      return { result: "declined", branch: branch.branchId, presentation_rejected: d.presentationRejected };
    }
    // OpenID4VP 1.0 Ek A.2: DC API yolunda `state` gönderilmeyebilir; cihazlar arası yolda zorunlu ve dalın `state`'i
    const stateOk = stateIs(opened.response.state) || (opened.path === "dc_api" && opened.response.state === undefined);
    if (!stateOk) return attempt();
    return {
      result: "presentation",
      branch: branch?.branchId ?? null,
      path: opened.path,
      nonce: branch?.nonce ?? req.nonce,
      consumed: set.tryConsume(),
    };
  } finally {
    set.end(branch);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Koşma yardımcıları (üreteç beklentiyi bunlarla doğrular; koşucu aynısını yapar)

export interface KbAudCase {
  name: string;
  path: "cross_device" | "dc_api";
  presentation: string;
  /** Doğrulayıcıya verilen bağlama girdisi (`VerifyInput.aud` / `origin` / `nonce`). */
  verifier: { aud?: string; origin?: string; nonce: string };
  /** Doğrulayıcının KB-JWT `aud`'u karşılaştırdığı değer; A1'de (yapılandırma hatası) `null`. */
  expected_kb_aud: string | null;
  expect: { a_steps: "pass" } | { failed_step: string };
}

/** A adımı sonucu: A'da durduysa adım kodu; A adımlarının hepsi yapıldıysa "geçer" (sonraki adımlar bu vektörün konusu değil). */
export function aStageOutcome(r: VerificationResult): KbAudCase["expect"] {
  if (r.failed_step && r.failed_step.startsWith("A")) return { failed_step: r.failed_step };
  if (A_STEPS_DONE.every((s) => r.checks_performed.includes(s))) return { a_steps: "pass" };
  return { failed_step: r.failed_step ?? "none" };
}

/** KB `aud` vakasını `verifyPresentation` ile koşar (en küçük güven kaynağı, `rp: "none"`, sabit zaman). */
export async function runKbAudCase(
  c: Pick<KbAudCase, "presentation" | "verifier">,
  o: { policy: Policy; rootCertPem: string; now: number },
): Promise<KbAudCase["expect"]> {
  const out = await verifyPresentation({
    presentation: c.presentation,
    ...c.verifier,
    policy: o.policy,
    policyCredentialId: o.policy.credentials[0].id,
    trust: aStageTrust(),
    statusCache: new MemoryStatusCache(),
    rootCertsDer: [pemToDer(o.rootCertPem)],
    rp: "none",
    now: epochSeconds(o.now),
  });
  return aStageOutcome(out.result);
}

export interface ResponseScenario {
  name: string;
  /** `request_uri` çekimleri sırasıyla (her biri bir dal). */
  fetches: string[];
  events: ResponseEvent[];
  /** Senaryo sonunda sunum: toplam deneme (`attempts`) ve tamamlandı mı (`used`). */
  expect_final: { attempts: number; used: boolean };
}

/** Senaryoyu taze doğrulayıcı durumunda koşar; her olayın gözlenen sonucu ve sondaki durum. */
export async function runScenario(
  setup: Omit<Parameters<typeof openHarness>[0], "fetches">,
  s: Pick<ResponseScenario, "fetches" | "events">,
): Promise<{ events: Observed[]; final: { attempts: number; used: boolean } }> {
  const h = await openHarness({ ...setup, fetches: s.fetches });
  const events: Observed[] = [];
  for (const e of s.events) events.push(await processResponse(h, e));
  return { events, final: { attempts: h.set.attempts, used: h.set.used } };
}

export interface KidCase {
  /** JWE korumalı başlığındaki `kid` (`null`: başlıkta `kid` yok). */
  kid: string | null;
  expect: ReturnType<typeof responseKidOf>;
}
export interface EncKidCase {
  presentation_id: string;
  path: "cross_device" | "dc_api";
  branch_id?: string;
  expect: string;
}

/** Yalnız korumalı başlığı dolu kompakt JWE (`responseKidOf` yalnız başlığı okur). */
export const jweHeaderOnly = (kid: string | null) =>
  Buffer.from(JSON.stringify({ alg: "ECDH-ES", enc: "A256GCM", ...(kid === null ? {} : { kid }) })).toString(
    "base64url",
  ) + "....";
