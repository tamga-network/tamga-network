---
document_id: ADR-0026
title: "Registration certificates"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-13
summary: >
  As provisional registrar, Tamga produces an ETSI TS 119 475 registration certificate (WRPRC, `rc-wrp+jwt`) for every verifier
  use and every issuer; the content comes only from the record in the signed trust list and is signed with a separate registrar
  key. The verifier sends the certificate in the OpenID4VP request as `verifier_info` (`registration_cert`); the wallet checks the
  signature, the validity period, the match with the organisation identifier in the access certificate and the requested fields.
  Access certificates carry the organisation identifier (`organizationIdentifier`).
domain: Trust
translation_of: ADR-0026
source_version: 1.0.0
---

# Context

[[ADR-0024]] added the EU common data set to [[t:verifier]] and [[t:issuer]] records and left the
[[t:registration-certificate]] (WRPRC) as the next step. In the EU gap analysis (H1, P2) this item remained open: [[t:ARF]]
topic 44, RPA_02, RPA_06.

In the EU model:

- The **[[t:access-certificate]]** ([[t:WRPAC]]) states who the verifier is; its subject carries the organisation identifier
  (ETSI EN 319 412-1 semantic identifier, e.g. `VATTR-1234567890`).
- The **registration certificate** ([[t:WRPRC]], ETSI TS 119 475 v1.2.1) states **what the verifier is registered to request,
  and for which purpose**. The national registrar signs it; `typ` `rc-wrp+jwt`; JAdES B-B signature; valid for at most 12 months;
  one certificate per intended use.
- The verifier carries it in the [[t:OpenID4VP]] request as `verifier_info: [{"format": "registration_cert", "data": "<jwt>"}]`
  (ETSI TS 119 472-2). In the EU the registration certificate is optional; if the registrar issues one, the wallet verifies it.

The Tamga wallet reads the same information from the signed [[t:trust-list]]. The registration certificate is needed so that EU
wallets can recognise Tamga verifiers and issuers in the form they know. Project management approved the H1 plan (P2) and asked to
move on to the next items.

# Decision

## K1 — Registrar and signing key

Tamga is the **provisional registrar** for Türkiye ([[t:LOTL]] `roles.registrar`, PROVISIONAL). Registration certificates are
signed with a separate **registrar key** (distinct from the list signing key). The key's fingerprint is published in the LOTL under
`roles.registrar.signing_keys`; the wallet recognises the registrar key from there (the LOTL itself is verified against the
fingerprint embedded in the app).

## K2 — Production: only from the trust list record

On every publication the list publisher produces:

| For | How many certificates | Key fields |
|---|---|---|
| Verifier | one per intended use (`scopes[]`) | `purpose`, `credentials` (vct + fields that may be requested), `privacy_policy`, `intended_use_id` = `scope_id` |
| Issuer | one per institution | `provides_attestations` (types it is authorised for), `entitlements` |

Common fields: `name` (trade name), `sub_ln` (legal name), `sub` (semantic identifier), `country`, `registry_uri` (address of
the signed national list), `entitlements` (ETSI TS 119 475 Annex A URIs), `srv_description`, `info_uri`, `support_uri`,
`supervisory_authority`, `public_body`, `iat`, `exp`.

- `sub` is derived from the record's `identifiers[]`: `TR-VKN` → `VATTR-<number>`, `TR-MERSIS` → `NTRTR-<number>`.
  **No certificate is produced for a record without an identifier** (the publisher warns).
- `exp` is at most 12 months, or the end date of the use or the record if that is sooner.
- For a request through an intermediary ([[ADR-0017]]) `intermediary {sub, sname}` is filled in.
- Certificates are published under `trust.tamga.network/wrprc/` (index: `wrprc/index.json`). They contain no personal data.

## K3 — Organisation identifier in the access certificate

Access certificates (`pki:issue`) carry `organizationIdentifier` (OID 2.5.4.97) in the subject. The value equals the registration
certificate's `sub`. Development certificates do not carry this field; the certificate is renewed when the identifier is entered
into the record.

## K4 — Verifier

If a registration certificate exists for the request's intended use, the verifier adds
`verifier_info: [{"format": "registration_cert", "data": "<jwt>"}]` to the request object. Otherwise the request is sent without it.

**Change of 2026-10-13** (see "Change" below): one registration certificate per request, no `credential_ids`, `registrar_dataset`
not used.

## K5 — Wallet

If the request carries a `registration_cert`, the wallet checks in order:

1. `typ` is `rc-wrp+jwt`; the signature is valid with the `x5c` certificate; that certificate's fingerprint is one of the
   registrar keys in the LOTL.
2. `iat` ≤ now < `exp`.
3. `sub` (in an intermediated request `intermediary.sub`) equals the `organizationIdentifier` in the access certificate that signed
   the request.
4. Every requested field is in the certificate's `credentials` list. Anything beyond it counts as **over-asking** (warning on the
   consent screen).

If any of 1–3 fails, the request is **rejected** and the user sees "registration certificate invalid". If there is no
registration certificate, or it is valid, the wallet continues with the trust list check. If the two sources conflict, the more
restrictive one applies.

**Change of 2026-10-13** (see "Change" below): a request without a registration certificate gets a warning and the default
"Don't share"; after 2028-08-11 it is rejected. In proximity the registration certificate comes in `euWrprc`.

# Options considered

| Option | Result | Why |
|---|---|---|
| Not producing registration certificates (optional in the EU) | rejected | EU wallets could not tell what Tamga verifiers are registered to request |
| Signing with the list signing key | rejected | Key separation: list signing and registration statements are different roles |
| One certificate per verifier rather than per use | rejected | TS 119 475 and TS5 call for one certificate per intended use |
| A placeholder `sub` when there is no identifier | rejected | Matching against the access certificate becomes meaningless; creates false trust |

# Invariants

| Code | Rule |
|---|---|
| WRC1 | A registration certificate is produced only from the record in the signed trust list; no field or type outside the list enters the certificate. |
| WRC2 | A registration certificate is signed with the registrar key; this key is separate from the list signing key and is published in the LOTL. |
| WRC3 | A registration certificate is valid for at most 12 months and never beyond the end date of the record or the use. |
| WRC4 | The wallet sends no data to a request carrying a registration certificate whose signature, validity or binding to the access certificate cannot be verified. |

# Consequences

- `apps/trust-publisher`: registration certificate production (`wrprc.ts`), registrar key in the LOTL; `ops/gen-pki.ts` registrar
  key; `ops/pki-issue.ts --org-id`.
- `@tamga-network/verifier`: `createPresentationRequest({ registrationCert })`; `apps/verify` attaches the certificate for the use.
- `@tamga-network/wallet-core`: registration certificate verification; result on the consent screen.
- Before the pilot: identifiers are entered into the records and access certificates are renewed with `organizationIdentifier`;
  when the registrar role passes to the national authority, the key changes in the LOTL.

# Change — 2026-10-13 (first EU alignment review)

Implementing Regulation (EU) 2026/1731 made the registration certificate rules of ETSI TS 119 472-2 binding with changes
(RO-02…RO-16) and made registration certificate validation in the wallet mandatory from 2028-08-11. K4 and K5 change accordingly;
K1–K3 and WRC1–WRC4 still apply unchanged.

**K4 (verifier) — new text.**
- In every request the verifier sends **one** registration certificate, the one for the request's intended use (`scope_id`), in
  `verifier_info` as `{"format": "registration_cert", "data": "<jwt>"}` (RO-13…RO-16). `data` is the registration certificate
  itself; the "base64url" of RO-16 is read as the JWT compact form (a JWS made of base64url parts), with no extra encoding.
- The entry carries **no** `credential_ids`; a request does not carry more than one registration certificate. The certificate
  covers the whole request; the requested credentials are in that use's registration.
- The `registrar_dataset` form (sending the registration data openly in the request) is **not used**; the regulation removed it
  (RO-02…RO-12).
- If the use has no registration certificate (for example a verifier whose identifier is not yet in its registration), the request
  is sent without one and the wallet behaves as in K5.
- Implementation: release 0.5.2 of the packages (`credential_ids` removed).

**K5 (wallet) — added rules.**
- **Request without a registration certificate:** from today the wallet shows a separate warning on the consent screen ("This
  verifier did not send a registration certificate") and the default choice is **"Don't share"**; the person can still share. The
  trust list check does not change.
- **After 2028-08-11** a request without a registration certificate is **rejected** (the date from which Implementing Regulation
  (EU) 2026/1731 makes registration certificate validation in the wallet mandatory). The date is fixed in code and cannot be
  changed by a setting.
- **Proximity (ISO/IEC 18013-5):** in an mdoc request the registration certificate comes in `requestInfo.euWrprc`. The wallet
  checks it with steps 1–4 of the remote flow; the binding in step 3 is made with the reader authentication certificate. The warning
  and the 2028-08-11 rule are the same in proximity. Sending `euWrprc` on the verifier side and reading it in the wallet come with
  release 0.6.0 of the packages.
- The warning and the default "Don't share" come with release 0.6.0 of the packages (`wallet-core`); the rejection date is in the
  code in the same release.

# Status

**Accepted — 2026-09-29.** Approved by project management (H1 plan, P2). DECISIONS: D-REG-2.

> **Change (2026-10-13):** K4 and K5 changed as in the "Change" section above (one registration certificate per request, no
> `credential_ids` and no `registrar_dataset`; warning + "Don't share" for a request without one, rejection after 2028-08-11;
> `euWrprc` in proximity). Approved by project management (first EU alignment review, decision 14).
