---
document_id: ADR-0093
title: "Several national lists: issuer identity uses the issuer's state, the wallet loads every active list, representative AZ and KZ in the sandbox"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-21
last_updated: 2026-11-21
summary: >
  Cross-border verification does not work today: the verifier and the wallet compute the issuer identity (issuerId) with their
  own state code, while SPEC-ID-0002 requires the issuer's state. Decision: the issuerId is derived from the certificate and the
  issuer's state; exactly one match is searched for in the loaded national lists, several matches are rejected, and iss is never
  the source. The wallet and the verifier load every active national list in the LOTL; a missing or stale list of another state
  makes only that state's issuers UNKNOWN. The sandbox opens representative test lists for Azerbaijan and Kazakhstan (own
  signers, the same sandbox root, no registrar); in the sandbox TR, AZ and KZ recognise each other. In the real network the AZ
  and KZ slots stay RESERVED. Accepted: 2026-11-21.
domain: Trust
translation_of: ADR-0093
source_version: 1.0.0
related: ["[[ADR-0009]]", "[[ADR-0035]]", "[[ADR-0036]]", "[[ADR-0038]]", "[[ADR-0070]]", "[[ADR-0026]]", "[[SPEC-ID-0002]]", "[[SPEC-API-0001]]", "[[SPEC-TRUST-0001]]"]
---

# In short

The main job of a network built for the Turkic world is to verify, in one state, a credential issued by an institution of
another state. Today this does not work: because the verifier computes the institution's identity with its own state code, an
employer in Türkiye can never find the diploma of a university in Azerbaijan. This decision fixes the error according to the
specification, sets the rule for the wallet and the verifier loading several national lists, and, to try it out, opens
representative test lists on behalf of Azerbaijan and Kazakhstan in the sandbox.

# Context

- **Specification.** [[SPEC-ID-0002]] §2: `issuerId = keccak256(stateCode, SHA-256(DER(issuerCert)))`; `stateCode` is the state the
  institution belongs to ("TR", "AZ", "KZ"). The list publisher writes the record this way.
- **Code.** The verifier (`@tamga-network/verifier`, A3b) uses the policy's state as `stateCode`; the wallet core defaults to
  "TR". A verifier in Türkiye computes, for an Azerbaijani institution's credential, an identity that is not in any list; the
  credential is rejected at C1 and the recognition check ([[ADR-0035]]) is never reached. The error stayed hidden because TR is
  the only active national list today.
- **Loading.** `@tamga-network/trust` can load several national lists (`additionalStates`); the wallet core loads only one.
- **The list publisher** assumes a single national list (TR).
- **Sandbox.** The demonstration network plan (project management, 2026-11-19) foresees Azerbaijan and Kazakhstan as
  representative states and the Günəşli and Dalaqala universities as their institutions; scenario: a Turkish employer verifies a
  Kazakh diploma. Direction from project management (2026-11-21): the full path — lists, publisher, wallet core and verifier.

# Decision

## K1 — Issuer identity with the issuer's state (A3b implementation note)

- The verifier and the wallet derive the `issuerId` from the credential's signing certificate: for every loaded national list
  `cc`, `keccak256(cc, SHA-256(DER))` is computed and looked up in that list.
- If there is exactly one match, that is the identity; all following steps (C1–C4, status list anchor, recognition) use it.
- No match means the institution is not in the lists (C1 REJECT). Several matches (the same certificate in two states' lists)
  are a REJECT.
- `iss` is never the source of the identity; the consistency check ([[SPEC-API-0001]] A3b) does not change.
- This is what [[SPEC-ID-0002]] says; no closed decision changes, the code follows the specification. An implementation note is
  added to [[SPEC-API-0001]] §1.2.

## K2 — The wallet and the verifier load every active national list

- The wallet core and the verifier can load all `ACTIVE` national lists in the LOTL (`nationalLists: "all-active"`); the
  signature-verified LOTL decides which lists are loaded.
- The own state's list (for the verifier the policy's state, for the wallet the network's main list) is mandatory; if it is
  missing or stale, no question is answered, as today.
- If another state's list is missing, stale or cannot be verified, only questions about that state's institutions return
  UNKNOWN; the other lists are not affected (the same principle as [[ADR-0036]] FD3). Rollback protection is per list.

## K3 — Representative Azerbaijan and Kazakhstan lists in the sandbox

- Only in the sandbox LOTL do the AZ and KZ slots become `ACTIVE`; the lists are `tl-az` and `tl-kz`. The operator is "Tamga
  Network Sandbox (TEST)"; `on_behalf_of` states clearly that these are representative test slots without the participation or
  endorsement of the states concerned.
- Each list is signed by its own signer ([[SPEC-TRUST-0001]] TL7): `tl-signer-az-1`, `tl-signer-kz-1` ("(TEST)" in the certificate
  name, [[ADR-0038]] SB1). The sandbox root and the LOTL signer do not change; the values pinned in wallets stay the same.
- `national_root_ca` is the sandbox root (no new root is opened). The registrar and access certificate authority roles are
  `RESERVED`; relying parties stay in the TR list, the AZ and KZ lists have none.
- In the real network the AZ and KZ slots stay `RESERVED` ([[ADR-0009]] K5); a state's list is opened only by agreement with that
  state.

## K4 — Recognition in the sandbox

- In the sandbox TR, AZ and KZ recognise each other (`recognition.recognizes`). A verifier policy in Türkiye
  (`require_recognition`) can thus accept the diploma of a university in Kazakhstan.
- The real network's recognition rules do not change ([[ADR-0035]]): recognition needs an agreement and today TR recognises only
  itself.

## K5 — Sandbox institutions and visible marking

- Günəşli Texniki Universiteti (`gunesli`, AZ) and Dalaqala Universiteti (`dalaqala`, KZ) issue student credentials and diplomas
  in their own states' lists. The institution names are fictional; sandbox pages state that the states are representative
  ([[ADR-0038]] SB4).

## K6 — Versions and transition

- The packages are published in a new version (core, trust, SD-JWT, verifier, wallet core). Older wallets and verifiers load
  only the TR list: nothing changes for TR credentials, AZ and KZ credentials are rejected at C1 there.
- Rollout order: first the publisher and the sandbox lists (a new slot in the LOTL without its file makes everything UNKNOWN),
  then the verifier and the issuing service, the wallet last.

# Options considered

| Option | Result | Why |
|---|---|---|
| **Match the issuerId in the loaded lists with the issuer's state** | **accepted** | Follows the specification; the identity still comes from the certificate, not from `iss`. |
| Find the issuerId from the address in `iss` or from a state field in the header | rejected | Signed content would select the identity; reopens the attack A3b closed. |
| Stop all trust when one national list breaks | rejected | A stale Kazakhstan list should not stop the verification of Turkish credentials; same principle as FD3. |
| Write the AZ/KZ institutions into the TR list in the sandbox | rejected | Does not show the federation; cross-border recognition cannot be tried. |
| Separate sandbox roots for AZ and KZ | rejected | The root values pinned in wallets would change; unnecessary for representative lists. |

# Invariants

| Code | Rule |
|---|---|
| UL1 | The `issuerId` is derived from the credential's signing certificate and the state code of the national list in which the institution is registered; exactly one match is searched for in the loaded lists, several matches are a REJECT, `iss` cannot be the source of the identity. |
| UL2 | A missing, stale or unverifiable national list of another state makes only questions about that state's institutions UNKNOWN; the own state's list is mandatory. |
| UL3 | Representative national lists exist only in the sandbox; each is signed by its own signer and states in the operator field that no state participates. In the real network a state's list becomes `ACTIVE` only by agreement with that state. |

# Consequences

- `@tamga-network/trust`: resolving the issuer identity from the certificate; loading every active list in the LOTL, UNKNOWN per
  state.
- `@tamga-network/sd-jwt`, `@tamga-network/verifier`, the mdoc path: issuer identity from the trust source.
- `@tamga-network/wallet-core`: every active list; issuer identity from the trust source when receiving a credential.
- List publisher: a separate list for each `tl-*.source.json` in the registry folder, each with its own signer; registration
  certificate and access certificate work stays with the list that has the registrar.
- Sandbox: new signers and institution keys, the AZ and KZ lists, Günəşli and Dalaqala, AZ/KZ people.
- Tamga Wallet: new core version and a new build.
- Documents: implementation note in [[SPEC-API-0001]] §1.2; note on [[ADR-0038]].

# Status

**Accepted — 2026-11-21** (project management approval). UL1–UL3 are binding.
