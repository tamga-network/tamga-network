---
document_id: ADR-0089
title: "Identity credential: standard mdoc configuration, regular renewal of copies, wallet provider suspension"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-16
last_updated: 2026-11-16
summary: >
  Three changes to the identity service's identity credential. (1) The mdoc copy of the credential is now issued through a separate
  `mso_mdoc` configuration declared in the metadata, from a standard credential request; one authorization and one access token
  cover both formats, and the non-standard `mso_mdoc` field in the credential response is removed. (2) The logical credential and
  the technical copy are separated: the record's end is the administrative validity and is carried in every copy as
  `date_of_expiry`; the technical validity of copies is at most 30 days and the wallet renews them silently. Because the identity
  service does not store personal fields, renewal works by the wallet presenting a copy of that record with all claims disclosed
  and bound to the holder key; the refresh token is the ZK copy token, extended. (3) The identity service regularly checks the
  trusted-list status of the wallet provider its records depend on: it revokes the records issued to units of a provider that is
  revoked or no longer listed, and suspends those of a suspended provider (renewal stops; it resumes when the suspension is
  lifted); "list cannot be read" and "provider suspended" are distinct. Accepted: 2026-11-16.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0023]]", "[[ADR-0029]]", "[[ADR-0044]]", "[[ADR-0045]]", "[[ADR-0047]]", "[[ADR-0048]]", "[[ADR-0059]]", "[[ADR-0060]]", "[[ADR-0062]]", "[[ADR-0064]]", "[[SPEC-PROTO-0001]]", "[[SPEC-ID-0003]]", "[[SPEC-WALLET-0001]]", "[[FW-RB-0003]]"]
translation_of: ADR-0089
source_version: 1.0.0
---

# In short

Until now both formats of the identity credential (SD-JWT VC and mdoc) were returned in the response to a single request, with a
non-standard field; Tamga Wallet received both, another wallet could only receive the SD-JWT. Copies were valid for 2 years and
were not renewed: after ten verifiers the wallet had to show the same copy to other verifiers as well. With this decision the
mdoc copy is requested the standard way, copies are valid for at most 30 days and the wallet renews them by itself; and the
identity service acts on the credentials in a wallet provider's units when that provider is suspended or revoked in the list.

# Context

- **Non-standard field (R41).** OpenID4VCI 1.0 §8.3 defines only `credential` in the `credentials[]` object. The identity service
  put the mdoc into each object with an extra `mso_mdoc` field ([[ADR-0013]], [[SPEC-PROTO-0001]] PR16); the metadata had no
  `mso_mdoc` configuration for the identity credential (only for the ZK copy). The reason was that personal fields were deleted
  right after the first issuance. Since [[ADR-0059]] several credential requests can be made within the access token's lifetime,
  so the reason is gone. OpenID4VCI 1.0 §12.2.4 allows the same `scope` value in several configurations; in the EU the PID is
  issued in two formats through two configurations.
- **Logical and technical credential (ARF 3.0 §5.3, §6.6.6.2; PID Rulebook).** One logical credential is represented by several
  technical copies; the technical validity of copies is short (days, weeks) and they are re-issued regularly during the logical
  credential's lifetime; administrative validity is a separate attribute (PID `date_of_expiry` / mdoc `expiry_date`). Our copies
  were valid for 730 days, administrative and technical validity were the same and the identity credential was not renewed (only
  the 24-hour ZK copies, [[ADR-0044]]). When the 10 copies ran out the wallet reused the least-used copy with a warning, which
  lets verifiers link the person.
- **Personal fields are not stored.** The identity service does not keep personal fields after issuance ([[ADR-0011]] K4, IDP9).
  This is why [[ADR-0023]] AR4 excluded silent renewal of the identity credential. The only source of the fields is the copy in
  the wallet, which carries the service's own signature.
- **When the wallet provider becomes invalid (ARF 6.6.2.5-c, CIR 2024/2977).** The PID provider also regularly checks whether the
  wallet provider has been suspended in the list. Today, if the provider is not `ACTIVE`, its key is untrusted, the status list
  cannot be verified and the result is "unknown": nothing changed.
- **Direction from project management (2026-11-16, ARF 3.0.0 reading decisions):** the standard mdoc path for the identity
  credential and regular renewal of identity copies now; suspension as in the EU and reversible.

# Decision

## K1 — mdoc copy through a standard configuration

- The identity service's metadata declares a second configuration for the identity credential: `format: mso_mdoc`, `doctype` and
  namespace unchanged ([[ADR-0013]] K2: `urn:tamga:id:IdentityAttestation:1`, `tamga.id.1`), `scope` the same as the SD-JWT
  configuration's (`urn:tamga:id:IdentityAttestation:1`). The configuration identifier is
  `urn:tamga:id:IdentityAttestation:1:mso_mdoc` (one constant in the code; the public name awaits approval, and if it changes only
  the constant changes).
- One authorization covers both formats. The wallet makes two standard credential requests with the same access token
  ([[ADR-0059]]); the order is free. The mdoc response is standard: `credentials[i].credential` = base64url IssuerSigned.
- The copy allowance is per configuration: at most 10 copies per token in each format ([[ADR-0059]] AT2 is read per configuration).
- Copies in both formats go into the same record (same revocation tracking) and have the same `iat`/`exp` ([[ADR-0013]] MD1).
  Copies in both formats issued to the same key with the same token carry the same status index; the matching is done only within
  the token's lifetime, in memory, and the key fingerprint is not stored (ISSU_35b). A copy requested with another key gets a new
  index.
- [[ADR-0013]] MD2 ("mdoc `deviceKey` = SD-JWT `cnf`") becomes a wallet rule: Tamga Wallet uses the SD-JWT copies' keys in the same
  order in the mdoc request; the service does not enforce it because it does not store keys.
- The non-standard `mso_mdoc` field in the credential response is removed ([[SPEC-PROTO-0001]] PR16). As this is the development
  stage, no transition path is written ([[ADR-0029]]).
- Personal fields are deleted when the allowance of both configurations is used up or the token expires ([[ADR-0059]] AT5).

## K2 — Logical credential and technical copy: administrative and technical validity

- The record in the identity service is the logical credential. The record's end is the **administrative validity**: today's rule
  is unchanged (730 days, limited by the WIA and KA revocation maintenance period — [[ADR-0047]] K1, ISSU_12c).
- The administrative end is carried in every copy as a separate attribute: SD-JWT `date_of_expiry`, mdoc `expiry_date` (EU PID
  names, `full-date`; the value is the UTC day of the record's end), selectively disclosable (`sd: always`). It is added to the
  identity schema as an optional attribute.
- The **technical validity** of each copy (`exp` / `validUntil`) is at most 30 days (setting `TAMGA_ID_COPY_TTL_DAYS`, default 30;
  it cannot exceed the administrative period) and does not pass the record's end. Time claims are rounded to the hour as today.
- Scope: only the identity credential issued with a refresh token. The store-review DEMO credential ([[ADR-0033]]), contact
  credentials and driving licence information are not renewed; their copies remain valid for the administrative period as today.
- 30 days balances ARF's "short technical validity" principle against two realities: a person whose phone is offline for a while,
  and every renewal consuming new indices in the status list. 24 hours is only for the ZK copy (without a status list,
  [[ADR-0044]]).

## K3 — Renewal path (without storing personal fields)

- When the identity credential is issued, the token response always carries a refresh token (not only when the ZK copy scope is
  requested — [[ADR-0062]] ZS1 is widened). The token has the form of [[ADR-0044]]: encrypted content that only the identity
  service can open (linked record, generation, client instance key — [[ADR-0060]], expiry, granted scopes, the ZK copy's minimal
  elements), single use and rotated on every use. Personal fields do not enter the token.
- Renewal request: `grant_type=refresh_token` + DPoP + a valid WIA issued to the same client instance key + `identity_presentation`
  (a presentation of a copy of that record in the wallet with **all claims disclosed**: SD-JWT VC + KB-JWT, `aud` = identity
  service, `nonce` = from the service's `/nonce` endpoint, single use). The parameter name already exists ([[ADR-0039]]).
- The identity service checks in order: the token (opens, not expired, same instance key, valid generation); the presentation
  (its own signature, KB-JWT and holder key, type, status list address, index belongs to this record, no undisclosed claim); the
  record (exists, not revoked, administrative period not over, all status bits 0, provider not suspended — K5). The keys of the
  new copies are checked at the credential endpoint with a new key attestation (KA) as today.
- A copy whose technical validity has ended is accepted for renewal (if the record is administratively valid): a person whose phone
  has been offline for more than a month renews the credential without proofing their identity again. The holder key and the WIA
  are still required.
- The new copies carry the same claims as the presented copy; the only differences: the age attributes (`age_over_18`,
  `age_over_15`, [[ADR-0064]]) are recomputed from the date of birth at renewal, and `date_of_expiry` is written from the record.
  The fields read from the presentation are only in memory within the new access token's lifetime ([[ADR-0059]] AT5); they are not
  written to disk, the log or the token.
- New copies are added to the same record; old copies are not revoked and end when their technical validity ends. The record's WIA
  and KA status entries are updated to those of the latest issuance (cascading revocation follows the latest unit attestation).
- Error codes tell the wallet what to do: token invalid, record revoked or expired → `invalid_grant` (renewal binding removed);
  faulty presentation (nonce, missing claim) → `invalid_request` (binding kept, the wallet retries); provider suspended →
  `temporarily_unavailable` (binding kept, resumes when the suspension is lifted).
- The ZK copy is obtained with the same token, only if the ZK copy scope was granted ([[ADR-0062]]); the ZK request carries no
  presentation.

## K4 — When renewal happens

- The wallet renews at the thresholds of the reuse policy declared by the service (ETSI TS 119 472-3 `credential_reuse_policy`:
  unused copies ≤ 2 or ≤ 7 days to the technical end) — under the conditions of [[ADR-0023]] K1: without asking the user, with a
  random delay (at most 6 hours, ending before expiry), while the setting ("renew copies automatically") is on.
- If the setting is off or all copies have expired, the wallet shows the person "renew identity credential"; renewal runs the same
  way on the person's tap.
- If the record is revoked or its administrative period has ended there is no renewal; the person proofs their identity again.

## K5 — Wallet provider suspended or revoked in the list

- The identity service writes into each record the trusted-list identifier of the wallet provider that signed the WIA at issuance
  (an organisation identifier, not personal data); at renewal it updates it from the latest WIA.
- In the 6-hourly unit check (also at startup, [[ADR-0047]] K1) the provider's status in the signed list is looked at first for
  each record:

  | What the list says | What the identity service does |
  |---|---|
  | List cannot be read or is stale | Nothing changes (unknown); checked again in the next round |
  | Provider `ACTIVE` (or `ROLLING_OVER`) | The usual WIA and KA check; a hold mark, if any, is lifted |
  | Provider `SUSPENDED` | The record is **put on hold**: no new copies, no renewal and no ZK copy; existing copies become unusable when their technical validity ends (at the latest 30 days; ZK copy 24 hours) |
  | Provider `REVOKED`, `RETIRED` or not in the list | The record is **revoked** (reason `wallet-provider-invalid`); so is linked driving licence information |
  | Any other status | Unknown; nothing changes |

- The hold is reversible: when the provider becomes `ACTIVE` again the mark is lifted and renewal resumes by itself; the person does
  not proof their identity again. The identity service's status list has no suspension bit ([[ADR-0048]]); the hold is achieved by
  the short technical validity and by renewal stopping. The same principle as the network's decision on suspended issuers
  ([[ADR-0088]]): not usable while suspended, back when the suspension is lifted.
- Old records without a provider identifier and providers from an external (federation) list are outside this check; the usual
  WIA/KA check continues.

# Options considered

| Option | Result | Why |
|---|---|---|
| Keep mdoc in the non-standard field (PR16) | rejected | Another wallet cannot receive the identity mdoc; the iPhone browser and proximity speak only mdoc |
| Separate authorization (separate `scope`) for mdoc | rejected | The person would proof their identity twice; in the EU both PID formats come with one authorization |
| Keep copies for 2 years, write the rationale | rejected | After 10 verifiers a copy is reused; contrary to ARF §5.3 |
| Put the personal fields encrypted into the refresh token | rejected | A copy of the personal fields openable with the server's key would travel in the wallet; [[ADR-0044]] put only minimal elements into the token. The source of the fields is already the signed copy in the wallet |
| Store personal fields in the identity service | rejected | [[ADR-0011]] K4, IDP9 |
| Identity proofing again at every renewal | rejected | A face scan once a month; in the EU re-issuance does not require user action (ISSU_42) |
| 7-day copies | rejected | Status list indices would run out four times faster |
| Revoke records immediately on provider suspension | rejected | Suspension would be irreversible; the person would have to proof their identity again. In a serious case the provider is set to `REVOKED` |
| Suspension bit in the identity list (`bits = 2`) | rejected | [[ADR-0048]]: no suspension for identity (PID rule); the short technical validity gives the same result without adding a state to the status list |

# Invariants

| Code | Rule |
|---|---|
| IR1 | The mdoc copy of the identity credential is issued from a standard credential request through a separate `mso_mdoc` configuration declared in the metadata; the credential response has no non-standard field; one authorization covers both formats and the copy allowance is per configuration. |
| IR2 | In an identity credential issued with a refresh token, the technical validity of each copy is at most 30 days and does not exceed the record's administrative end; the administrative end is carried in every copy as `date_of_expiry` (mdoc `expiry_date`). |
| IR3 | Renewal of the identity credential does not store personal fields on the server: the fields are read from the wallet's presentation of a copy of that record, with all claims disclosed and bound to the holder key, and stay in memory only within the access token's lifetime. |
| IR4 | Renewal happens only while the record is not revoked, its administrative period has not ended, all its status bits are 0 and its provider is not suspended; with a valid WIA issued to the same client instance key and a single-use, rotated refresh token. |
| IR5 | In a renewed copy the age attributes are recomputed from the date of birth at renewal; the other personal attributes are the same as in the presented copy. |
| IR6 | If the wallet provider is `REVOKED`, `RETIRED` or not in the trusted list, the identity service revokes the records linked to that provider's units; if `SUSPENDED`, it puts the records on hold (no new copies, renewal or ZK copy) and renewal resumes when the suspension is lifted; if the list cannot be read, nothing changes. |
| IR7 | Copies in both formats issued to the same key with the same access token carry the same status index; the matching is done only in memory within the token's lifetime and the key fingerprint is not stored. |

# Consequences

- Changed decisions: [[ADR-0013]] K1 and MD2 (K1), [[ADR-0023]] AR4 and [[ADR-0044]] K3 (the identity credential is now renewed with
  a presentation — personal fields are still not stored), [[ADR-0059]] AT2 (per configuration), [[ADR-0062]] ZS1 (refresh token
  with every identity authorization). Each gets a "changed" note.
- Specifications: [[SPEC-PROTO-0001]] (PR16 removed; identity mdoc configuration, renewal request), [[SPEC-ID-0003]] (technical and
  administrative validity, provider check), [[SPEC-WALLET-0001]] (identity renewal). Framework: [[FW-RB-0003]] §6.1 (validity).
- Schema: optional `date_of_expiry` on the identity type (type metadata and `vct#integrity` change; trusted lists are republished).
- Code: identity service (operator repository: metadata, credential endpoint, token endpoint, unit check); `@tamga-network/issuer`
  (scope and reuse policy in the mdoc configuration), `@tamga-network/trust` (`walletProviderOfKey`), `@tamga-network/mdoc`
  (`expiry_date` full-date), `@tamga-network/wallet-core` (standard mdoc request, `renewIdentityCredential`,
  `scheduleIdentityRenewals`); the Tamga Wallet app calls the new functions.
- Residual risk and open work: each renewal consumes 10 new indices in the status list (the two formats share an index). The
  identity service's single list has 100,000 indices and is full at 80%; opening a new list when full ([[SPEC-CRED-0003]] §6) does
  not exist in the identity service yet and must be done before scale. The identity service learns from the renewal frequency that
  the wallet is active (about once a month), not what was shown to which verifier (the same balance as [[ADR-0044]]).

# Status

**Accepted — 2026-11-16** (project management approval; ARF 3.0.0 reading decisions, verbatim quote in the private approval record).
DECISIONS: D-ID-17. IR1–IR7 are binding. The configuration identifier `urn:tamga:id:IdentityAttestation:1:mso_mdoc` and the
revocation reason `wallet-provider-invalid` await public-name approval.
