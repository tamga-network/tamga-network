---
document_id: SPEC-ID-0003
title: "Identity proofing"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-04
summary: >
  Defines the identity proofing paths an issuer applies before issuance: the holder level each path produces (T1–T3), its
  mapping to ETSI TS 119 461, which credential type requires which level, where the result is kept (the issuer's audit
  record; never in the credential), and the protocol-level rules for integrating a remote identity verification provider
  (reference: Didit, v3 API): creating a session, fetching the result, verifying webhooks, data minimisation, error and
  timeout behaviour.
translation_of: SPEC-ID-0003
source_version: 1.0.0
---

# In brief

This document describes how an institution verifies, before issuing a credential, that a person really is who they claim to
be ([[t:identity-proofing]]). It is written for issuing institutions ([[t:issuer|issuers]]) and for developers who connect
to an identity verification provider.

**When to read**

- First read the [Issuance](/concepts/issuance) concept page and the [[GUIDE-0003]] guide.
- How the credential is bound to the wallet is not covered here: [[SPEC-CRED-0002]].
- For Tamga's identity credential service, go straight to §9.

**Plain explanation**

Every credential type requires a minimum assurance level ([[t:LoA]]): for a student certificate, e-mail and SMS are enough;
a diploma needs stronger verification (for example an identity card + liveness check + face match, or the institution's
registration desk). The institution reaches this level before issuing the credential; if it cannot, it does not issue.
Remote verification is performed by a licensed provider; the institution keeps only a short summary of the result, identity
images are not stored and the level is not written into the credential. Until a state identity credential exists, Tamga's
identity service performs this verification and gives the result to the wallet as a separate identity credential.

---

# Scope

This specification covers identity proofing **on the institution's side**: how the question "is the person receiving this
offer really the subject of the credential?" is answered before issuance. Out of scope: binding to the wallet
(`cnf`/[[t:KB-JWT]] — [[SPEC-CRED-0002]]), face matching on the [[t:verifier]] side (the [[t:RP]]'s responsibility), and
[[t:PID]] issuance (Tamga does not issue PID, BT8).

Principle ([[PM-ASSUR-0001]]; the [[t:eIDAS]] model): **the [[t:holder]] level is not written into the [[t:credential]]**;
a credential type carries a minimum level as a precondition; the institution reaches that level before issuance and writes
the binding path into its **audit record** ([[SPEC-PROTO-0001]]/PR7).

---

# 1. Levels and paths

| Level | eIDAS LoA | ETSI TS 119 461 (D-ASSUR-2) | Path | Where |
|---|---|---|---|---|
| **T0** | — | — | Device key + e-mail/phone OTP; no identity claim | Anonymous/pseudonym scenarios (not used in beta) |
| **T1** | Low | Baseline | (a) e-mail offer + SMS `tx_code` **over a different channel**; (b) offer on the student information system screen (single factor); (c) bank micro-transfer / mobile line ownership | Issuer/portal |
| **T2** | Substantial | Substantial (document + liveness **or** in person) | (a) **Licensed remote identity verification** (identity document OCR/NFC + liveness + face match) — "IDV provider" in this document; (b) offer on the student information system screen with MFA; (c) the institution's **registration desk** (in person, staff confirmation) | IDV provider / portal / desk |
| **T3** | High | High | Signing a nonce with a qualified e-signature / mobile signature (from the initial stage on); PID in the state stage | Only authorization code or in person; **forbidden with pre-authorized** (ETSI TS 119 472-3 GEN-REQ-4.1) |

**Type ↔ minimum level** is set in the [[t:rulebook|rulebooks]]: Education Rulebook — student certificate T1, diploma T2
([[FW-RB-0002]] §4). If the institution cannot reach the level a type requires, it **does not produce** an offer (issuance
stops; no guessing or upgrading).

---

# 2. Flow — where identity proofing sits in the issuance chain

```
Portal / SIS session (person)                    Issuer service
   │  "Add my diploma to my wallet"                 │
   ├── type = Diploma → required level T2 ─────────▶│ current level? (session type, earlier proofing record ≤ 12 months)
   │                                                  │
   │  ◀── if insufficient: start IDV session (T2a) ──┤  POST /v3/session  → url
   │  IDV provider page: document + selfie            │
   │  ──▶ completed (callback / webhook) ────────────▶│ decision → T level + record
   │  ◀── offer (QR + tx_code)  ──────────────────────┤ PR7: audit {path:"idv:<provider>", level:"T2", session_ref}
   ▼                                                  ▼
Wallet OpenID4VCI (SPEC-PROTO-0001) — unchanged
```

Identity proofing finishes **before the offer is produced**; the offer itself and the `tx_code` rules do not change (PR1, PR3,
DB-5). The result may be reused for the same person for 12 months (PROPOSAL); the assurance decay rules apply
([[PM-ASSUR-0001]] §Decay).

---

# 3. Remote identity verification provider — general rules

| # | Rule |
|---|---|
| IP1 | The provider's result is evaluated **only** on the issuer's side; the wallet and the verifier do not talk to the provider. |
| IP2 | The issuer binds the provider session to **its own subject**: `vendor_data` = an opaque issuer-internal reference (a random token of the student record); **the identity number, name and e-mail are not written into `vendor_data`**. |
| IP3 | The expected identity (given name, family name, date of birth) may be given to the provider as **expected_details**; the provider performs the match; the issuer additionally compares the result with the source data (exact match of name + date of birth; a difference → Review). |
| IP4 | What the issuer's system keeps is **a summary of the result**: `{provider, session_ref, level, decided_at, checks:[id_document, liveness, face_match], expires_at}`. The document image, portrait, raw OCR data and video are **not stored** ([[FW-RB-0001]] RB-AP-23). |
| IP5 | Retention on the provider's side is reduced to the minimum by contract; the privacy notice under the Turkish data protection law (KVKK) names the provider as a **data processor**. |
| IP6 | A webhook **MUST** be verified with its signature + timestamp; an unsigned or stale (> 300 s) webhook is rejected; deduplication by `event_id`. |
| IP7 | A webhook is only a **trigger**; the decision is always confirmed by fetching it from the provider's **decision API** (the webhook body is not trusted). |
| IP8 | "In Review" / "Declined" / "Expired" → no offer is produced; the person is not shown the provider's result but the "apply to the institution's registration desk" path. The reason for rejection is not passed to the person in the provider's wording. |
| IP9 | During a provider outage, diploma issuance **stops** (it is not downgraded to T1); the student certificate (T1) is not affected. |
| IP10 | The provider and the workflow identifier (`workflow_id`) are in the tenant configuration; the code is not provider-specific but works through an **adapter** interface (`IdvProvider` — §6). |
| IP11 | Logs: event type + `session_ref` + level; the person's name, document number and scores are **not written** (in the spirit of AP3). |

---

# 4. Reference provider: Didit (v3 API) — protocol mapping

Source: docs.didit.me (checked on 2026-09-24). It may change; the adapter is versioned.

| Step | Didit | Tamga usage |
|---|---|---|
| Authentication | `x-api-key: <API_KEY>` (Business Console → Application → API & Webhooks) | Tenant secret (`TAMGA_IDV_DIDIT_API_KEY`); in `.env`, never in the repository |
| Create session | `POST https://verification.didit.me/v3/session/` body: `workflow_id` (required), `vendor_data`, `callback`, `callback_method`, `metadata`, `language`, `contact_details`, `expected_details {first_name,last_name,date_of_birth,id_country,expected_document_types}` | `vendor_data = <opaque subject_ref>`; `callback = https://id.tamga.network/idv/return?r=<flow>`; `language = tr`; `expected_details` name/surname/date of birth (IP3); `metadata` **empty** |
| Response | `session_id`, `session_token`, `url`, `status: "Not Started"`, `workflow_version` | Redirect to `url`; `session_id` = `session_ref` |
| Result | `GET https://verification.didit.me/v3/session/{sessionId}/decision/` → `status`, `features[]`, `id_verifications[] {status, first_name, last_name, date_of_birth, document_type, issuing_state, expiration_date, verification_method, assurance, …}`, `liveness_checks[] {status, score}`, `face_matches[] {status, score}`, `nfc_verifications[]`, `aml_screenings[]` | Only `status`, the `status` values of the sub-checks and the name/surname/date-of-birth **match result** (boolean) are kept; image fields (`portrait_image`, `front_image`, `back_image`, `video_url`) are **read but not stored** |
| Webhook | `POST` body: `event_id`, `webhook_type` (`status.updated` …), `session_id`, `status`, `vendor_data`, `decision`, `timestamp`, `created_at`, `environment`; headers `X-Signature-V2` (HMAC-SHA256, canonical JSON), `X-Signature` (raw body), `X-Timestamp` | `X-Signature` (raw body) + `X-Timestamp` (±300 s) are verified; deduplication by `event_id`; then confirmation through the decision API (IP7). Retries: ~1 min, ~4 min; 5 s timeout → the endpoint returns 200 quickly and queues the work |
| States | `Not Started`, `In Progress`, `Awaiting User`, `In Review`, `Approved`, `Declined`, `Resubmitted`, `Expired`, `Kyc Expired`, `Abandoned` | Mapping in §5 |
| Workflow | No-code workflow in the Business Console: ID + liveness + face match (+ optional NFC) | Tamga workflow: **ID document + passive liveness + face match**; AML **off** (purpose limitation); phone/e-mail **off** (T1 already uses SMS) |
| Channel | Hosted URL (redirect), iframe, mobile SDK (iOS/Android/RN) | Today (list stage): **hosted URL** (through the identity service `id.tamga.network`, desktop/mobile browser). The in-wallet SDK is **not used** (identity proofing is the institution's job, not the wallet's) |
| Sandbox | `sandbox_scenario` field; `environment: "sandbox"` | Demo: with sandbox scenarios; a fake adapter in end-to-end tests |
| Price | 500 verifications/month free; per use afterwards | The pilot scale fits in the free quota |

---

# 5. Result → level mapping

| Didit `status` | Sub-checks | Name/surname/date-of-birth match | Tamga result |
|---|---|---|---|
| `Approved` | `id_verifications[].status = Approved` ∧ `liveness_checks[].status = Approved` ∧ `face_matches[].status = Approved` | Exact match | **T2** (`path: "idv:didit"`) |
| `Approved` | NFC `Approved` (chip document) | Exact | **T2** (note: `nfc: true`; **not** T3 — T3 requires a signature) |
| `Approved` | any of them not `Approved` | — | **Insufficient** → desk |
| `Approved` | all Approved | No match | **Review** (staff decision; no automatic T2) |
| `In Review` | — | — | Wait (≤ 24 h); then staff |
| `Declined`, `Expired`, `Kyc Expired`, `Abandoned` | — | — | Insufficient; new session ≤ 3 attempts / 24 h |
| `Not Started`, `In Progress`, `Awaiting User`, `Resubmitted` | — | — | In progress |

Document type restriction: `expected_document_types = ["ID", "P"]` (Turkish identity card, passport); `issuing_state` must be
consistent with the institution's country or the student's nationality (if the nationality is not in the source data, the
restriction is not applied).

---

# 6. Adapter interface (implementation contract)

```ts
interface IdvProvider {
  readonly id: "didit" | string;
  createSession(input: {
    subjectRef: string;                 // opaque, not personal data
    expected: { givenName: string; familyName: string; birthDate: string };
    locale: "tr" | "en";
    returnUrl: string;
  }): Promise<{ sessionRef: string; url: string; expiresAt: number }>;
  fetchDecision(sessionRef: string): Promise<IdvDecision>;
  verifyWebhook(rawBody: Uint8Array, headers: Record<string, string>): { ok: boolean; eventId?: string; sessionRef?: string };
}
type IdvDecision =
  | { state: "PENDING" }
  | { state: "REVIEW" }
  | { state: "FAILED"; reason: "declined" | "expired" | "abandoned" | "mismatch" | "incomplete" }
  | { state: "PASSED"; level: "T2"; checks: { idDocument: true; liveness: true; faceMatch: true; nfc?: boolean }; decidedAt: number; expiresAt: number };
```

Stored record (issuing service `data/<slug>/state.json › proofing[subjectRef]`):
`{ provider, sessionRef, level, checks, decidedAt, expiresAt }` — no other fields.

---

# 7. Error and boundary behaviour

| Situation | Behaviour |
|---|---|
| Provider 5xx / timeout | No diploma offer is produced; the person sees "identity verification is not possible right now" + the desk option |
| Invalid webhook signature | 400; event log entry; no action |
| Webhook did not arrive | The portal's `return` page queries the decision API (polling ≤ 10 min, 15 s interval) |
| Person fails 3 times | 24-hour lock; desk path |
| Result older than 12 months | Proof again (decay) |
| Registration desk path | Staff panel: "I have seen the identity" confirmation → `path: "desk"`, `level: T2`, staff identity in the audit record |

---

# 8. Invariants

| # | Invariant |
|---|---|
| **IDP1** | The holder's identity proofing level and path are not written into the credential; they are kept only in the issuer's audit record. |
| **IDP2** | No offer is produced before the type's minimum level is reached; the level is not upgraded by guessing. |
| **IDP3** | The IDV provider integration lives **only in the Tamga identity attestation service** (`id.tamga.network`, [[ADR-0011]]); institutional issuers, the wallet and the verifier do not talk to the provider. |
| **IDP4** | From the IDV result the issuer keeps only the summary record; document images, portraits, video and raw OCR data are not stored. |
| **IDP5** | A webhook is not processed before its signature and timestamp are verified; the decision is always confirmed through the decision API. |
| **IDP6** | No personal data is written into the `vendor_data`/`metadata` fields; only an opaque reference. |
| **IDP7** | T3 is never granted on the basis of a remote IDV result; T3 requires a signature (qualified e-signature/mobile signature) or a PID and is not compatible with the pre-authorized flow. |
| **IDP8** | A provider outage does not lower the level; issuance that needs it stops. |
| **IDP9** | The identity service keeps the personal fields from the IDV result only until the moment of issuance; after issuance only the opaque `subject_ref`, the document number hash, the validity period and the status indices remain; images, selfies, video and raw OCR data are never stored at Tamga (K4). |
| **IDP10** | The national identity number (`personal_administrative_number`) is carried only in the `urn:tamga:id:IdentityAttestation:1` type and only as a selectively disclosable claim; it is written into no other type; the institution does not keep or log it after matching. |
| **IDP11** | Before the identity attestation is issued, the privacy notice is shown and explicit consent is obtained; in a session without consent no IDV is started (`access_denied`). |

---

# 9. Tamga identity credential service

Until a state PID provider is appointed, remote identity verification is performed **in Tamga's identity service** and the
result is given to the wallet as a credential. This credential is not a PID but a non-qualified [[t:EAA]] issued by Tamga as
an issuer (`category: IDENTITY`, `class: EAA`, I2; no `category` claim in the credential — [[ADR-0022]]);
`pid_providers[]` stays empty (TL8).

| Item | Value |
|---|---|
| `vct` | `urn:tamga:id:IdentityAttestation:1` (catalogue: `id/IdentityAttestation/1.0.0`) |
| Claims | `given_name`, `family_name`, `birth_date`, `nationality`, `personal_administrative_number` (Turkish ID number), `document_type`, `document_number_hash` (keyed SHA-256 / HMAC; 1.0.1), `issuing_country`, `document_chip_verified`, `verification_method` (`remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person`), `age_over_18` — all selectively disclosable; no portrait; no LoA claim (PR7) |
| Validity / status | `exp` = issuance + 730 days; Token Status List (`id.tamga.network/status/{listId}`); when the same document is verified again, the previous one is revoked (K6) |
| Flow | Wallet: PAR (WUA) → browser `/authorize` (**KVKK privacy notice + explicit consent**) → provider (Didit v3; demo: FAKE, deviation S-15) → `/idv/return` decision query (the webhook is only a trigger, IDP5) → `code` → token (PKCE + WUA) → 10 copies |
| Use at an institution | The institution's issuing service requests a **presentation** of the identity credential when issuing (DCQL: Turkish ID number, date of birth, given name, family name), verifies T0 + A–E and matches it with its records (Turkish ID number + date of birth; a warning on normalised names) — [[SPEC-PROTO-0001]] §11.2 |
| Level | Remote document + liveness + face = **T2** (ETSI 119 461 Substantial); NFC chip = `document_chip_verified: true` (technically High; legally T3 = qualified e-signature/mobile signature, IDP7) |
| Data controller | Tamga Network (K4): it keeps the record + hash; erasure request = §9.1 (the record is deleted, copies are revoked, images are deleted at the provider); the provider contract allows ≤ 30 days of image retention |
| Webhook | A single target `https://id.tamga.network/idv/webhook`, event `status.updated`; there is no per-institution webhook |

Implementation: `apps/id` (operator repository) (config/didit/store/app); the `IdvProvider` interface is the same as in §6
(`DiditProvider`, `FakeIdvProvider`).

## 9.1 The person's erasure request — `POST /erasure`

There is no user account; the request is proven by presenting the credentials the service has issued.

| Item | Value |
|---|---|
| Request | `{ "presentations": [ SD-JWT VC + KB-JWT, … ] }` (1–20); no claim is disclosed; KB-JWT `aud` = the service address, `nonce` = `POST /nonce` (single use) |
| Verification | The signature is this service's (`issuerId`); possession through the KB-JWT `cnf` key; the record is found from the status list index |
| Effect | All copies of the record become INVALID; the record and the event log rows tied to it are deleted; the provider session is deleted with `privacy_erasure` (`IdvProvider.deleteSession`) |
| Response | `{ erased, rejected, provider: "deleted" | "partial" }`; 404 if nothing is held |
| Log | Only counts (`erasure`: number of records, provider result); the record identifier and `subject_ref` are not written |

Only bits remain in the [[t:status-list]] (no personal data). The [[t:pseudonym]] seed is not stored on the service side, so
there is nothing to delete (PS2); if the person verifies their identity again, the same seed is derived again ([[ADR-0031]]).

## 9.2 App-store review — single-use review code ([[ADR-0033]])

| Item | Value |
|---|---|
| Code | Generated by the operator (`ops/review-code.ts create`); 26 characters (130 bits), at most 14 days, single use, at most 3 active at the same time; only an HMAC digest in the database (`review_codes`; RV1) |
| Entry | The "Review code" field on the `/authorize` privacy notice page (`POST /authorize/consent`, `review_code`); if empty, the flow does not change |
| Effect | With a valid code, a trial verification only for that PAR (`/review-idv/{session}`, no request to the real provider); the person is a code-specific DEMO person (given name "DEMO", family name "App Reviewer") |
| Signature | A separate DEMO signer `tamga-id-review` (I1 in the trust list); the real signer is not used (RV2). The status list is the identity service's list |
| Credential | `verification_method: review-demo`, at most 7 days; the pseudonym seed comes from a separate key (it does not collide with real seeds) |
| Acceptance | It passes no policy that requires I2; only the Tamga Verify `review-*` policies (I1) |
| Limits | 5 failed attempts per PAR; service-wide, 20 failures in 10 minutes lock it for 15 minutes (IP addresses are not used); nginx rate limit on `/authorize/consent` |
| Off | If there is no DEMO key or the trust list does not know `tamga-id-review`, entering a code returns "not active" (503) |
| Log | `review_code.accepted` / `.used` (code identifier), `.rejected` (no detail); never the code or its digest |

## 9.3 Driving licence information — `urn:tamga:id:DrivingLicenceAttestation:1` ([[ADR-0039]])

The same service inspects the person's physical driving licence at the provider in a **separate flow** (accepting driving licences
only) and issues the categories and dates on the card. It is not an official driving licence / mDL (DL1); the credential says so
through the always-visible `not_official_licence: true` claim.

| Item | Value |
|---|---|
| Prerequisite | `identity_presentation` in the PAR: an SD-JWT VC + KB-JWT presentation of the Tamga identity credential in the wallet (`aud` = the service, `nonce` = `POST /nonce`, single use; only `given_name`, `family_name`, `birth_date` disclosed). The service checks the signature, that the record is active and that only the three claims are disclosed; the flow record holds no personal attribute, only a keyed **match digest** (HMAC) and the id of the linked identity record |
| Flow | `/authorize` driving-licence-specific notice + explicit consent (no review code field) → the provider's driving licence flow (setting: separate flow id; without it the type is not announced) → `/idv/return`: is the document a driving licence, has the card expired, were categories read, do the name + date of birth on the card match the digest → `code` → token → 10 copies |
| Read from the provider | given name, family name, date of birth, issuing country, document number (only its HMAC digest is kept), issue/expiry dates, expired fact, per-category from/to dates (`extra_fields.dl_class_code_<category>_from/_to`). **Never read:** `_notes` fields, restriction codes, images, scores |
| Claims | `given_name`, `family_name`, `birth_date`, `issuing_country`, `document_number_hash`, `driving_privileges[]`, `licence_issue_date?`, `licence_expiry_date`, `verified_at`, `verification_method` (`remote-document-liveness-face`), `age_over_18`, `not_official_licence` |
| Refusal | `access_denied`: not a driving licence · card expired · categories could not be read · all categories expired (expired categories are not written into the credential) · name or issuing country could not be read (no guessing) · does not match the identity · the linked identity is no longer active (revoked / re-issued / erased after the PAR; re-checked at `/idv/return` and `/credential`). No personal data in the description; only the reason code is logged. On every outcome without issuance (including provider decline/review) the provider session (card images, selfie) is deleted at once; sessions of abandoned flows are deleted during garbage collection before their id is forgotten |
| Validity / revocation | `exp` = min(card expiry, inspection + 1 year, expiry of the linked identity credential; DL3/DL5); SD-JWT VC only; status list; the record is linked to the identity record via `parentId` — revocation, re-issuance or erasure of the identity covers the linked credential; erasure also removes previously revoked linked records and their provider sessions (DL5) |

# Security and privacy notes

- Identity proofing is **purpose-limited**: it is only a precondition of issuance; AML/PEP screening is off.
- The provider sees the person's document and face; this is stated clearly in the KVKK privacy notice and the choice of
  provider (data location, retention period, sub-processors) is bound by contract.
- `expected_details` gives the provider the name/surname/date of birth (from the source data); this improves match quality
  but is a data disclosure; the alternative (matching the name returned by the provider at the institution) is defined in IP3
  and left to the tenant's preference (PROPOSAL: do not share by default).
- The demo uses the sandbox; no real personal data is processed (GT1).

# Open questions

1. Result reuse period (12 months) and attempt limits — the numbers are PROPOSALS.
2. In-wallet IDV (SDK) never? It becomes unnecessary with the PID in the state stage; not for now.
3. Provider diversity: a second adapter (a domestic provider / e-Devlet) — a vendor lock-in tripwire.

# Related documents

[[PM-ASSUR-0001]] · [[PM-ID-0001]] · [[SPEC-PROTO-0001]] · [[SPEC-CRED-0002]] · [[SPEC-WALLET-0001]] ·
[[FW-RB-0001]] · [[FW-RB-0002]] · [[ADR-0005]] · [[ADR-0011]] · [[ADR-0022]]

# Status

**In force** — version 1.0.0 (2026-10-02).
