/**
 * Example 02 — verify documents on your own server (hiring, campus, age checks), without the hosted verifier.
 *
 * 1. Load the signed trust lists (who may issue what) and pre-fetch the revocation lists.
 * 2. Open a presentation and show its QR code. Every fetch of the QR's request_uri gets its OWN signed request object
 *    (fresh state, nonce and encryption key — a "request branch", packages 0.7.4): someone who photographs the QR and
 *    fetches it learns only their own branch, so a forged "declined" closes only that branch. Include your registration
 *    certificate: Tamga Wallet refuses a request without one (from packages 0.7.0).
 * 3. The wallet posts an encrypted answer (or a "declined" error) → lock the presentation → decrypt → run the canonical checks
 *    (T0 + A–E). The presentation is used up only once the holder-binding check (A6) has passed; earlier failures count as
 *    attempts on that branch, and an answer you cannot decrypt changes nothing.
 * Three outcomes: ACCEPTED, REJECTED (with the failing step) or INDETERMINATE ("could not check right now").
 *
 *   npm install @tamga-network/verifier @tamga-network/trust @tamga-network/core
 */
import { pemToDer } from "@tamga-network/core";
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";
import {
  BranchRegistry,
  BranchSet,
  createPresentationRequest,
  dcqlFromPolicy,
  openPresentationResponse,
  PrefetchStatusCache,
  responseKidOf,
  verifyPresentation,
  type Branch,
  type Policy,
  type PresentationSession,
  type RpSigner,
} from "@tamga-network/verifier";

/** A hiring policy: a bachelor's diploma, four fields, nothing else. */
export const DIPLOMA_POLICY: Policy = {
  policy_id: "hiring-bachelor",
  purpose: { "en-GB": "Confirm graduation for a job application" },
  credentials: [
    {
      id: "diploma",
      vct_values: ["urn:tamga:edu:DiplomaCredential:1"],
      required_claims: ["is_graduate", "qualification_title", "eqf_level", "awarding_body_name"],
      constraints: { is_graduate: true, eqf_level: { min: 6 } },
    },
  ],
  trust: { min_issuer_assurance: "I2", allowed_categories: ["EDUCATION"], require_recognition: true, state_code: "TR" },
  freshness: { max_status_token_age_sec: 7200, max_trust_age_sec: 86400 },
};

export interface OwnVerifierConfig {
  /** Where the trust lists are published, e.g. "https://trust.tamga.network". */
  trustBase: string;
  /** Root fingerprints, fixed in your configuration (published at tamga.network/trust-anchor). */
  rootFingerprints: string[];
  /** Your registration: pemRpSigner(KEY_PEM, CERT_PEM) — client_id is x509_hash of your access certificate (HAIP 1.0). */
  signer: RpSigner;
  /** Your public base URL; the wallet fetches (GET or POST) /vp/req/:id and posts to /vp/response here. */
  publicBase: string;
  /**
   * The registered use (`scope_id` of your trust-list record) this verifier asks for, e.g. "job-application-1". Its
   * registration certificate (`<trustBase>/wrprc/…`) goes into every request (`verifier_info`). "none" only for wallets and
   * tests that do not check registration certificates.
   */
  registrationScope: string | "none";
  fetch?: typeof fetch;
  /** Revocation-list fetcher (defaults to fetch with a timeout). */
  fetchStatus?: (url: string) => Promise<string | null>;
  anchorMaxAgeMs?: number;
}

export async function createOwnVerifier(cfg: OwnVerifierConfig) {
  const f = cfg.fetch ?? fetch;
  const http = async (url: string) => {
    const r = await f(url);
    return { status: r.status, text: () => r.text() };
  };
  // 1) Trust lists, verified against your fixed root fingerprints; anchors included (revocation checks need them).
  const { source: trust, store } = await fetchListTrustSource(cfg.trustBase, http, {
    rootFingerprints: cfg.rootFingerprints,
    verifyJws,
    anchors: true,
    anchorMaxAgeMs: cfg.anchorMaxAgeMs,
  });
  const rootCertsDer = [...store.root_cas.values()].flatMap((ca) => (ca.cert_pem ? [pemToDer(ca.cert_pem)] : []));
  // Pre-fetch every anchored revocation list: no network call at verification time.
  const statusCache = new PrefetchStatusCache(cfg.fetchStatus);
  await statusCache.refresh([...store.status_anchors.values()].map((a) => a.list_uri));

  // Open presentations, in memory. Each expires (expiresAt) and the map is capped, so abandoned QR codes cannot grow it. The
  // branch registry is shared by all presentations: it finds a branch by the hash of its state (for "declined" answers, which
  // carry no key id) and caps branch memory across presentations. A multi-instance deployment needs a shared store instead.
  const MAX_PENDING = 10_000;
  const registry = new BranchRegistry();
  const pending = new Map<string, { req: PresentationSession; policy: Policy; branches: BranchSet }>();
  const drop = (id: string) => {
    pending.get(id)?.branches.dispose();
    pending.delete(id);
  };
  const sweep = (now = Math.floor(Date.now() / 1000)) => {
    for (const [id, e] of pending) if (e.req.expiresAt < now || e.branches.used) drop(id);
    for (const id of pending.keys()) {
      if (pending.size < MAX_PENDING) break;
      drop(id); // oldest first
    }
  };
  const live = (id: string) => {
    const e = pending.get(id);
    if (e && e.req.expiresAt < Math.floor(Date.now() / 1000)) {
      drop(id);
      return undefined;
    }
    return e;
  };

  // Your registration certificate: published with the trust lists, renewed by the registrar (at most 12 months); re-read hourly.
  let registration: { jwt: string; at: number } | null = null;
  async function registrationCert(): Promise<string | undefined> {
    if (cfg.registrationScope === "none") return undefined;
    if (registration && Date.now() - registration.at < 3600_000) return registration.jwt;
    const index = JSON.parse(await (await http(`${cfg.trustBase}/wrprc/index.json`)).text()) as {
      items: Array<{ kind: string; client_id?: string; scope_id?: string; path: string }>;
    };
    const item = index.items.find(
      (i) => i.kind === "rp" && i.client_id === cfg.signer.clientId && i.scope_id === cfg.registrationScope,
    );
    if (!item)
      throw new Error(
        `no registration certificate for ${cfg.signer.clientId} / ${cfg.registrationScope}: wallets will refuse the request — check your registration (identity number in the access certificate, scope still valid)`,
      );
    registration = { jwt: (await (await http(`${cfg.trustBase}/${item.path}`)).text()).trim(), at: Date.now() };
    return registration.jwt;
  }

  /** 2) Start: returns the QR payload. Serve `requestObject(id, walletNonce)` at GET and POST /vp/req/:id. */
  async function start(policy: Policy = DIPLOMA_POLICY) {
    const content = {
      signer: cfg.signer,
      dcql: dcqlFromPolicy(policy),
      responseUri: `${cfg.publicBase}/vp/response`,
      registrationCert: await registrationCert(),
    };
    // No shared request object: each fetch of request_uri gets its own branch (BranchSet.fetch below)
    const req = await createPresentationRequest({
      ...content,
      requestUriBase: `${cfg.publicBase}/vp/req`,
      initialRequestObject: false,
    });
    sweep();
    const branches = new BranchSet({ registry, presentationId: req.presentationId, expiresAt: req.expiresAt, content });
    pending.set(req.presentationId, { req, policy, branches });
    return { presentationId: req.presentationId, qrPayload: req.qrPayload };
  }

  /**
   * GET|POST /vp/req/:id → body with content-type application/oauth-authz-req+jwt (null → 404). A POST may carry
   * `wallet_nonce` (OpenID4VP 1.0 §5.10); it is echoed into the request object. Rate-limit this route per client address
   * (each fetch costs a signature); do not limit it per presentation, or a stranger could lock the real wallet out.
   */
  async function requestObject(id: string, walletNonce?: string): Promise<string | null> {
    const e = live(id);
    if (!e) return null;
    const f = await e.branches.fetch(walletNonce);
    return f.ok ? f.requestJwt : null;
  }

  /** Runs `work` holding the presentation's single-use lock (taken BEFORE decrypting); throws if it is busy or closed. */
  async function locked<T>(e: { branches: BranchSet }, branch: Branch | undefined, work: () => Promise<T>) {
    const lock = e.branches.begin(branch);
    if (lock !== "ok")
      throw new Error(`request ${lock === "busy" ? "is being answered" : "already answered or closed"}`);
    try {
      return await work();
    } finally {
      e.branches.end(branch);
    }
  }

  /**
   * 3a) POST /vp/response with `error` + `state` (the person declined; OpenID4VP 1.0 §8.4). Answer 200 in any case and store no
   * reason. Only the branch that `state` belongs to closes; the presentation is REJECTED only if it was fetched once.
   */
  function handleDecline(state: string): { presentationRejected: boolean } {
    const hit = registry.byState(state); // hash lookup + constant-time compare
    if (!hit || hit.set.busy) return { presentationRejected: false };
    return { presentationRejected: hit.set.decline(hit.branch).presentationRejected };
  }

  /** 3b) POST /vp/response with `response` (an encrypted answer) → verify. Each presentation is used up once. */
  async function handleResponse(jwe: string) {
    const kid = responseKidOf(jwe); // the branch's key id: enc-<presentation>.<branch>
    const e = kid?.branchId !== undefined ? live(kid.presentationId) : undefined;
    const branch = e?.branches.get(kid!.branchId!);
    if (!e || !branch) throw new Error("unknown, expired or already answered request");
    return locked(e, branch, async () => {
      // Never delete the presentation before this point: an answer you cannot decrypt must not cancel the real one
      const opened = await openPresentationResponse(jwe, e.req, `${cfg.publicBase}/vp/response`, (id) =>
        id === branch.branchId ? branch : undefined,
      );
      if (!e.branches.isOpen(branch)) throw new Error("already answered or closed");
      if (!e.branches.stateMatches(branch, opened.kind === "error" ? opened.state : opened.response.state)) {
        e.branches.failedAttempt(branch);
        throw new Error("state mismatch");
      }
      if (opened.kind === "error")
        return { declined: true as const, presentationRejected: e.branches.decline(branch).presentationRejected };
      const pc = e.policy.credentials[0];
      const presentation = opened.response.vp_token[pc.id]?.[0];
      if (!presentation) {
        e.branches.failedAttempt(branch);
        throw new Error(`${pc.id} missing in vp_token`);
      }
      const out = await verifyPresentation({
        presentation,
        aud: cfg.signer.clientId,
        nonce: branch.nonce, // the branch's own nonce
        policy: e.policy,
        policyCredentialId: pc.id,
        trust,
        statusCache,
        rootCertsDer,
        rp: trust.relyingParty(cfg.signer.clientId),
      }); // → { result: { outcome, failed_step, … }, claims } — store names, never values, in your logs
      // Used up only once holder binding (A6: the key-binding signature over this nonce) has passed. Before that, the answer
      // counts as an attempt on this branch (5 close the branch) and the real wallet can still answer.
      if (!out.result.checks_performed.includes("A6")) {
        e.branches.failedAttempt(branch);
        return { declined: false as const, ...out };
      }
      e.branches.consume();
      return { declined: false as const, ...out };
    });
  }

  /** Refresh revocation lists on a timer (e.g. every few minutes). */
  const refreshStatus = () => statusCache.refresh([...store.status_anchors.values()].map((a) => a.list_uri));

  return { start, requestObject, handleResponse, handleDecline, refreshStatus, trust, statusCache };
}
