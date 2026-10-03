---
document_id: ADR-0020
title: "The authentic source is the institution"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  In hosted issuance the authentic source of personal data is the institution; Tamga keeps no register of persons. Two
  paths: (A) the institution creates, through the API, an offer bound to the person's identity and sends the link itself;
  the person presents their identity in the wallet and the credential is issued if it matches. (B) the person requests from
  the wallet and presents their identity; Tamga asks the institution's query endpoint with a signed request. On both paths
  the credential data is read from the institution at signing time and not stored. The register in the Institution Console
  remains only as a "sample source" (trial).
domain: Services
translation_of: ADR-0020
source_version: 1.0.0
---

# Context

Today in hosted issuance Tamga keeps the institution's person records (students) in its own database ([[ADR-0019]]). The
records are entered in the Institution Console. When a person requests a credential from the wallet, their identity is
looked up in this register. When the institution creates an offer, the person is also chosen from this register.

Project management (2026-09-29) did not want this structure:
- there will be no bulk student upload,
- "we have no business with the data",
- the authentic source is the institution's own system (student information system),
- the institution sends the offer e-mail itself,
- the student requesting from the wallet and Tamga asking the institution was approved,
- binding the offer to the person's identity was approved.

On the EU side, too, a [[t:PID]] or credential provider takes attributes from the [[t:authentic-source]] ([[t:ARF]] topic 42;
CIR 2025/1569). An intermediary is not expected to keep source data permanently.

# Decision

## K1 — Authentic source and source connection

A **source connection** is defined for each institution (`tenants/<slug>.json` → `authentic_source`):

- **`remote`** (production): the institution's **query endpoint**. Tamga asks for two operations:
  - `lookup`: search with identity keys (Turkish ID number + date of birth) → the institution's opaque person identifier
    (`subject_ref`) + credential data,
  - `fetch`: credential data by `subject_ref` (for renewal and the identity-bound offer).

  The request is a short-lived JWT signed with the access key Tamga uses for the institution (`aud` = query endpoint, `iat`,
  `jti`); the institution verifies the request with Tamga's certificate in the [[t:trust-list]]. Response and format are
  defined in OpenAPI.
- **`sandbox`** (trial): the sample register in the Institution Console ([[ADR-0019]] KC4). For trials and demonstrations
  only; never used with real personal data.

## K2 — What Tamga keeps

- Credential data (name, programme, grade …) is **not kept**: it is read from the source at signing time and dropped from
  memory once the credential is issued.
- Only the institution's opaque `subject_ref` (in the issued-credential record, for revocation and renewal) and, for an
  identity-bound offer, a **keyed digest** of the matching keys (HMAC; no plain Turkish ID number) are persistent.
- No personal data is written to logs (PR14 unchanged).

## K3 — Path A: the institution starts, the offer is bound to the person's identity

1. The institution's system sends to the Tamga API (`POST /{slug}/api/v1/offers`, [[ADR-0016]]):
   - the credential type,
   - the institution's `subject_ref`,
   - the matching keys: `bind { personal_administrative_number, birth_date }`.
2. Tamga creates an **identity-bound offer**: an [[t:OpenID4VCI]] `authorization_code` grant, `issuer_state` = offer id. The
   response contains the link and a QR code. **The institution sends the e-mail or message itself**; Tamga never sees a
   contact address.
3. The person opens the link in the wallet. The wallet sends `issuer_state` in the [[t:PAR]]. During authorisation the person
   presents the Tamga identity credential (the existing inline flow).
4. The institution's [[t:issuer]] verifies the identity credential and compares the digest of the Turkish ID number + date of
   birth with the digest in the offer. If they do not match, no credential is issued. Someone else opening the offer cannot
   obtain the credential.
5. The credential data is read from the source (`fetch`) at signing time.
6. The pre-authorised offer with `tx_code` remains as a **fallback** for people without an identity credential. The code is
   not sent over the same channel as the offer (PR12).
7. An offer is valid for 7 days by default and is single-use.

## K4 — Path B: the person starts

The person selects the institution in the wallet and presents their identity. The institution's issuer asks the source
connection with `lookup` (the register in `sandbox`). If a record exists, the credential is issued; if not, the answer is
"not found in the institution's records". The response is not stored.

## K5 — Renewal and revocation

The refresh token ([[ADR-0023]]) carries `subject_ref`. Renewal calls `fetch`; if the person no longer exists in the source,
the token is dropped (AR3). The institution revokes through the API or the Console ([[ADR-0016]]).

## K6 — Institution kit

- **OpenAPI:** the Tamga API (offer, revocation) and the contract of the institution's query endpoint.
- **Node SDK:** identity-bound offers are added to `@tamga-network/issuer/client`.
- The option of running the issuer on the institution's own server is kept ([[ADR-0016]]).

## K7 — Institution Console

- The "Register" tab becomes **"Sample source (trial)"** and is shown only in `sandbox` mode.
- The "Institution entry" tab shows the type of the source connection and the query endpoint.

# Options considered

| Option | Result | Why |
|---|---|---|
| Register in Tamga (today) | rejected (trial only) | Tamga keeps personal data; bulk upload is needed |
| The institution sends credential data with the offer, Tamga stores it | rejected | The data stays at Tamga for the life of the offer; unnecessary when a query endpoint exists |
| **Only subject_ref + identity digest in the offer; data from the source at signing time** | **accepted** | No persistent personal data at Tamga; renewal uses the same path |
| Tamga sends the offer e-mail | rejected | Tamga would see contact addresses; project management wanted the institution to send it |
| No identity binding, tx_code only | rejected (fallback) | Whoever intercepts the link could obtain the credential |

# Invariants

| Code | Rule |
|---|---|
| AS1 | In hosted issuance credential data is not kept persistently; it is read from the authentic source at signing time. Only the institution's opaque person identifier and the keyed digest of the matching keys are persistent. |
| AS2 | An identity-bound offer becomes a credential only if the matching keys in the presented identity credential match the digest in the offer. |
| AS3 | Tamga does not receive the person's contact address for an offer; the institution delivers the link. |
| AS4 | The `sandbox` source is for trials only; it is never used with real personal data. |

# Consequences

- `apps/issuer` (operator repository): source connection abstraction (`sandbox` / `remote`), identity-bound offer
  (`issuer_state`), `lookup` on path B, `fetch` at the credential endpoint, `fetch` on renewal.
- `@tamga-network/issuer`: `createPar` `issuer_state`; the offer object's `authorization_code` grant. `wallet-core`: offer
  `authorization_code` grant → authorisation with `issuer_state`.
- The register items of [[ADR-0011]] K3 and [[ADR-0019]] are narrowed by this ADR. [[SPEC-PROTO-0001]] §3 and §11.2 are
  updated.
- OpenAPI files in `tamga-network/docs/api/`.

# Status

**Accepted — 2026-09-29.** With project management approval (no bulk upload; the institution sends the e-mail; path B;
identity-bound offer). DECISIONS: D-SRC-1.
