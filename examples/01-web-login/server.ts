/**
 * Example 01 — "Sign up / Sign in with Tamga" on your website, using the hosted verifier.
 *
 * Your SERVER opens each presentation, proving who it is with a short-lived assertion signed by the key of
 * your trust-list registration (ADR-0017). The page only shows the QR code and polls a status token; the
 * values the person approved are handed to your server once.
 *
 *   npm install @tamga-network/verifier
 */
import { createHmac } from "node:crypto";
import { createRpAssertion, type RpSigner } from "@tamga-network/verifier";

export interface SignInConfig {
  /** The hosted verifier, e.g. "https://verify.tamga.network". */
  verifier: string;
  /** Your registration: pemRpSigner(KEY_PEM, CERT_PEM) — client_id is x509_hash of your access certificate (HAIP 1.0). */
  rp: RpSigner;
  /** Your own secret; the stored account key is a keyed hash of the site pseudonym. */
  siteSecret: string;
  fetch?: typeof fetch;
}

/** What your page needs to draw the QR code and poll the status. */
export interface StartedPresentation {
  presentation_id: string;
  qr_payload: string;
  expires_at: string;
  status_token: string;
}

export type SignInResult =
  | { ok: true; accountKey: string; givenName?: string; familyName?: string }
  | { ok: false; outcome: "PENDING" | "REJECTED" | "INDETERMINATE" | "ALREADY_USED" };

export function tamgaSignIn(cfg: SignInConfig) {
  const f = cfg.fetch ?? fetch;
  const auth = async () => ({ authorization: `Bearer ${await createRpAssertion(cfg.rp, cfg.verifier)}` });

  /** POST /tamga/start → return this JSON to your page (TamgaVerifier.mount({ start })). */
  async function start(policy: "site-signup" | "site-signin"): Promise<StartedPresentation> {
    const r = await f(`${cfg.verifier}/presentations`, {
      method: "POST",
      headers: { ...(await auth()), "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ policy_id: policy }),
    });
    if (!r.ok) throw new Error(`verifier refused the request (${r.status})`);
    return (await r.json()) as StartedPresentation;
  }

  /** POST /tamga/session → your page sends the presentation id after ACCEPTED; decide here, on the server. */
  async function finish(presentationId: string): Promise<SignInResult> {
    const id = encodeURIComponent(presentationId);
    const result = (await (await f(`${cfg.verifier}/presentations/${id}`, { headers: await auth() })).json()) as {
      outcome?: "ACCEPTED" | "REJECTED" | "INDETERMINATE";
    };
    if (result.outcome !== "ACCEPTED") return { ok: false, outcome: result.outcome ?? "PENDING" };

    const r = await f(`${cfg.verifier}/presentations/${id}/claims`, { headers: await auth() });
    if (r.status === 410) return { ok: false, outcome: "ALREADY_USED" }; // values are handed out once
    const { claims } = (await r.json()) as { claims: Record<string, unknown> };

    // ADR-0031: the account key is the wallet's pseudonym for YOUR site (another site sees a different one); the verifier
    // has checked its signature, audience, nonce and the wallet instance attestation. No document value is sent.
    if (typeof claims.pseudonym !== "string") return { ok: false, outcome: "REJECTED" };
    const accountKey = createHmac("sha256", cfg.siteSecret).update(claims.pseudonym).digest("base64url");
    return {
      ok: true,
      accountKey,
      givenName: claims.given_name as string | undefined,
      familyName: claims.family_name as string | undefined,
    };
  }

  return { start, finish };
}
