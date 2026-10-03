---
document_id: ADR-0025
title: "Wallet and key attestations"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Instead of a single 30-day WUA, the EU TS3 model: a Wallet Instance Attestation (WIA) living less than 24 hours, with a fresh key
  and a fresh status list entry for every credential transaction, plus a key attestation (KA, `key_attestation`) describing where
  the credential keys are stored. The wallet provider registers the wallet unit, keeps the WIA–unit mapping, publishes the status
  lists and revokes the unit at the user's request. Issuers verify the WIA and the KA and their status. Changes the format of D-CRED-6.
domain: Wallet
translation_of: ADR-0025
source_version: 1.0.0
---

# Context

Today the Tamga wallet obtains **a single [[t:WUA]] valid for 30 days** from the [[t:wallet-provider]] (`wallet.tamga.network`).
It shows the same WUA to every institution when receiving credentials (D-CRED-6, SPEC-PROTO-0001 §11.1). The EU gap analysis (H1)
found this to be one of the largest gap clusters:
- topic 9: 22 items,
- topic 38: 15 items,
- VCR_01a/03a/07,
- WIAM_06/10.

Gaps against EU TS3 (v1.5.2) and [[t:ARF]] 3.0:

1. **Lifetime and unlinkability.** A [[t:WIA]] must live less than 24 hours. The same WIA must not be shown to more than one
   institution; otherwise institutions can link the same wallet across each other.
2. **No key attestation.** The wallet provider must state in a signed `key_attestation` where the [[t:credential]] keys are
   stored ([[t:OpenID4VCI]] Annex D). Today the institution reads this from a claim in the WUA.
3. **No revocation.** The wallet provider must publish a [[t:status-list]] for WIAs and KAs and be able to revoke a
   [[t:wallet-unit]] at the user's request (VCR_07, WURevocation_10). For this it must know which WIA belongs to which unit.

Project management approved the H1 plan (P3: this work) and asked to move on to the next items.

# Decision

## K1 — Wallet unit registration

On first setup the wallet registers a **unit key** with the wallet provider. This key is used only between the wallet and the
provider and is never shown to an institution. The provider keeps a unit record:
- the fingerprint of the unit key,
- solution and version,
- registration time,
- revocation state,
- the WIA status list entries issued to the unit.

No personal data is kept. Requests about the unit are signed with the unit key.

## K2 — WIA (Wallet Instance Attestation)

- Format: OpenID4VCI 1.0 Annex E (`oauth-client-attestation+jwt`), TS3 §2.3.1 fields: `sub`, `wallet_name`, `wallet_version`,
  `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk`.
- **Lifetime < 24 hours** (Tamga: 23 hours). `client_status.exp` at least 31 days ahead (Tamga: 60 days).
- **A new WIA for every credential transaction:** a new PoP (proof of possession) key and a new, unlinkable status list entry.
  The per-institution reuse option is not used, so the provider does not learn how many institutions the wallet talks to.
- The provider keeps the mapping between status list entries and the unit; when the unit is revoked, all its entries are revoked.

## K3 — KA (key attestation)

- Format: OpenID4VCI 1.0 Annex D (`keyattestation+jwt`), TS3 §2.3.2 fields:
  - `attested_keys` (all credential keys in a batch),
  - `key_storage` / `user_authentication` (ISO 18045 levels),
  - `certification`,
  - `key_storage_status {status, exp}`.
- **Honest level:** today the keys are in a software store (S-9). The KA says `key_storage: ["iso_18045_basic"]` and carries no
  certification. The level rises with the move to secure hardware (Z1).
- Revocation: **one shared entry per storage type** (TS3 Option 1). Software store, Secure Enclave and StrongBox each have one
  entry. The unit identity cannot be derived from the KA.
- Transport: `key_attestation` in the header of the `jwt` proof. The proof is signed with `attested_keys[0]`; a batch is requested
  with a single proof. Each key appears in only one KA. A KA is used once.

## K4 — Status lists and revocation at the user's request

- The provider publishes two Token Status Lists (WIA entries and KA storage types). It signs them with its own key, which is
  registered in the [[t:trust-list]]. The WIA list has at least 10,000 entries.
- The user can choose "Revoke this wallet" in the wallet (handing over or selling the device). The unit and all its WIA entries are
  revoked.
- Revocation from a lost or stolen device requires a user account (WIAM_06); left to a later step.

## K5 — Issuers

- At the [[t:PAR]] and token endpoints the WIA is verified: signature, provider key in the trust list, validity period, PoP
  (`cnf`), `client_status` not revoked.
- At the credential endpoint, if the proof header carries a KA, the following are verified:
  - signature and provider key,
  - the proof's signature with `attested_keys[0]` and the [[t:nonce]],
  - `key_storage_status` not revoked,
  - the `key_storage` level meets the institution's minimum.

  Credentials are bound to `attested_keys`.
- Metadata: `proof_types_supported.jwt.key_attestations_required {key_storage, user_authentication}` (ISSU_27d).
- Transition: the proof format without a KA is accepted until the pilot, then removed.
- The `key_storage` the institution read from WUA claims is now read from the KA.

## K6 — Refresh token binding

The [[ADR-0023]] refresh token is today also bound to the WUA `sub`. Because each transaction uses a new WIA key, this binding becomes
the condition **credential-specific [[t:DPoP]] key + a valid, unrevoked WIA**. AR2's rule "the wallet attestation is verified on
every refresh" still applies.

# Options considered

| Option | Result | Why |
|---|---|---|
| A single 30-day WUA | rejected | Not TS3-compliant; linkable across institutions; no revocation |
| WIA entry reused per institution | rejected | The provider learns how many institutions the wallet talks to and how often |
| A separate status list entry per KA (Option 2) | later | For key-store revocation at the user's request; together with the hardware key (Z1) |
| **A new WIA per transaction + one KA entry per storage type** | **accepted** | Least information; the most privacy-friendly option TS3 allows |

# Invariants

| Code | Rule |
|---|---|
| WIA1 | A WIA lives less than 24 hours; every credential transaction uses a WIA with a new PoP key and a new status list entry. |
| WIA2 | The wallet provider keeps no personal data in the unit record; when a unit is revoked, all WIA entries issued to it are revoked. |
| WIA3 | The key storage level in the KA states the truth; an unverified claim is not written into a KA. |
| WIA4 | An issuer does not issue a credential against a revoked WIA or KA. |

# Consequences

- `apps/wallet-provider`:
  - unit registration, `/wia`, `/ka`, `/units/revoke`, `/units/delete`,
  - two status lists,
  - a persistent state file.
- `@tamga-network/trust` (re-exported by `@tamga-network/issuer`): WIA and KA verification, revocation checks. The institution
  issuer and the identity service use this format.
- `wallet-core`: unit key, per-transaction WIA, KA request, proof with KA. Wallet: registration, "Revoke this wallet".
- [[SPEC-PROTO-0001]] §11.1 and D-CRED-6 are written according to this decision.
- ARF: topics 9, 38 and VCR_01a/03a/07 are largely met. WSCD and device attestation are in Z1.

# Status

**Accepted — 2026-09-29.** Approved by project management (H1 plan, P3). DECISIONS: D-CRED-7.
