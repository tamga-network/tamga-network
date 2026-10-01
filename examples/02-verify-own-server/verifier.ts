/**
 * Example 02 — verify documents on your own server (hiring, campus, age checks), without the hosted verifier.
 *
 * 1. Load the signed trust lists (who may issue what) and pre-fetch the revocation lists.
 * 2. Create a signed OpenID4VP request → show it as a QR code.
 * 3. The wallet posts an encrypted answer → decrypt it → run the canonical checks (T0 + A–E).
 * Three outcomes: ACCEPTED, REJECTED (with the failing step) or INDETERMINATE ("could not check right now").
 *
 *   npm install @tamga-network/verifier @tamga-network/trust @tamga-network/core
 */
import { pemToDer } from "@tamga-network/core";
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";
import {
  createPresentationRequest,
  dcqlFromPolicy,
  decryptResponse,
  PrefetchStatusCache,
  verifyPresentation,
  type Policy,
  type PresentationRequest,
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
  /** Your public base URL; the wallet fetches /vp/req/:id and posts to /vp/response here. */
  publicBase: string;
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

  const pending = new Map<string, { req: PresentationRequest; policy: Policy }>();

  /** 2) Start: returns the QR payload. Serve `requestObject(id)` at GET /vp/req/:id. */
  async function start(policy: Policy = DIPLOMA_POLICY) {
    const req = await createPresentationRequest({
      signer: cfg.signer,
      dcql: dcqlFromPolicy(policy),
      responseUri: `${cfg.publicBase}/vp/response`,
      requestUriBase: `${cfg.publicBase}/vp/req`,
      purpose: Object.values(policy.purpose)[0],
    });
    pending.set(req.presentationId, { req, policy });
    return { presentationId: req.presentationId, qrPayload: req.qrPayload };
  }

  /** GET /vp/req/:id → body with content-type application/oauth-authz-req+jwt. */
  const requestObject = (id: string) => pending.get(id)?.req.requestJwt ?? null;

  /** 3) POST /vp/response (form field `response`) → verify. Each request answers once. */
  async function handleResponse(jwe: string) {
    const kid = JSON.parse(Buffer.from(jwe.split(".")[0], "base64url").toString("utf8")).kid as string;
    const entry = pending.get(String(kid).replace(/^enc-/, ""));
    if (!entry) throw new Error("unknown or already answered request");
    pending.delete(entry.req.presentationId);
    const answer = await decryptResponse(jwe, entry.req.encPrivateKey);
    if (answer.state !== entry.req.state) throw new Error("state mismatch");
    const pc = entry.policy.credentials[0];
    return verifyPresentation({
      presentation: answer.vp_token[pc.id][0],
      aud: cfg.signer.clientId,
      nonce: entry.req.nonce,
      policy: entry.policy,
      policyCredentialId: pc.id,
      trust,
      statusCache,
      rootCertsDer,
      rp: trust.relyingParty(cfg.signer.clientId),
    }); // → { result: { outcome, failed_step, … }, claims } — store names, never values, in your logs
  }

  /** Refresh revocation lists on a timer (e.g. every few minutes). */
  const refreshStatus = () => statusCache.refresh([...store.status_anchors.values()].map((a) => a.list_uri));

  return { start, requestObject, handleResponse, refreshStatus, trust, statusCache };
}
