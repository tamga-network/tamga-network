---
document_id: ADR-0061
title: "Pseudonym seed as a separate credential configuration, with a standard credential request"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-22
last_updated: 2026-10-22
summary: >
  The pseudonym seed credential (`urn:tamga:id:PseudonymSeed:1`, ADR-0031 K1) is no longer added to the identity credential's
  response in a non-standard `pseudonym_seed` field but issued as a separate credential configuration declared in the identity
  service's metadata: after receiving the identity credential the wallet makes a second, standard credential request with the
  same access token (OpenID4VCI 1.0 §8; ADR-0059). The seed's privacy properties do not change (PS1–PS6): a separate,
  non-presentable type, bound to the key of the identity credential's first copy, no status list, not stored on the server. A
  standards-conformance fix that only changes how it is delivered; accepted within project management's general approval.
  Accepted: 2026-10-22.
domain: Privacy
related: ["[[ADR-0031]]", "[[ADR-0059]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0061
source_version: 1.0.0
---

# Context

- **ADR-0031 K1.** The identity service issues the person's pseudonym seed as a separate, non-presentable credential type
  (`urn:tamga:id:PseudonymSeed:1`). Until now that credential was put into the identity credential's response in an extra
  `pseudonym_seed` field.
- **Standard.** OpenID4VCI 1.0 §8.3 defines the credential response parameters (`credentials`, `transaction_id`,
  `notification_id`, `interval`); an extra field is non-standard. Several credential types obtained under one authorisation are
  each declared as a separate configuration in the metadata and requested with a separate credential request.
- **OpenID conformance self-test (finding G3).** An "unknown key" warning in every credential response of the identity service
  (22 tests); the suite cannot switch the check off.

# Decision

## K1 — Separate configuration
The identity service's metadata declares the seed type as a separate `dc+sd-jwt` configuration in
`credential_configurations_supported` (when the type is in the catalogue and the identity service is authorised for it in the
trusted list). The type cannot be requested on its own with PAR.

## K2 — Second request with the same token
After receiving the identity credential the wallet makes a standard credential request **with the same access token** (ADR-0059),
`credential_configuration_id = urn:tamga:id:PseudonymSeed:1` and a single key proof — with the key of the identity credential's
first copy. The identity service issues the seed only if the identity credential was issued with that token, and only once; the
seed is bound to that key. No non-standard field remains in the credential response.

## K3 — What does not change
ADR-0031 PS1–PS6 as they are: the seed is in a non-presentable type (PS3), not stored on the server — held only in memory during
the flow and deleted once issued or when the token ends (PS2); derivation and presentation rules do not change.

# Options considered

- **Keep the extra field.** Non-standard; the warning stays in every test.
- **The seed as a claim in the identity credential.** It would be part of a presentable credential — against PS3.
- **Derive it in the wallet.** The same person must get the same seed on every device (ADR-0031); it is derived from the person's
  identity with a server secret, the wallet cannot derive it alone.
- **Chosen:** a separate configuration + a second request with the same token — the path OpenID4VCI provides for several types.

# Invariants

| Code | Rule |
|---|---|
| SD1 | The pseudonym seed credential is issued only with the access token that issued the identity credential, after it, and once. |
| SD2 | The credential response carries no top-level parameter not defined in OpenID4VCI 1.0 §8.3. |

# Implementation

- Identity service: the seed configuration in the metadata (`seedType`), a separate request at the credential endpoint
  (`seedRequest`); no `pseudonym_seed` in the identity credential's response. When the copy allowance is used up the token stays
  until it expires, for the seed request.
- wallet-core 0.7.2: `obtainCredential` makes the second request after the identity credential when the seed configuration is
  declared (`RedeemOutput.pseudonymSeed`); `readPseudonymSeed` is unchanged.
- Specification: [[SPEC-PROTO-0001]] §7.5, [[SPEC-WALLET-0001]] §5.4.

# Status

**Accepted — 2026-10-22.** Within project management's general approval ("let us be compatible with EU standards, close our gaps,
do it the way it should be done"): a fix that brings only the delivery of the closed decision ADR-0031 in line with the standard;
the privacy rules did not change. DECISIONS: D-PRIV-2.
