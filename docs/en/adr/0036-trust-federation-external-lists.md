---
document_id: ADR-0036
title: "Trust federation"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-02
summary: >
  The Tamga LOTL can point to trust lists published by other operators (a state, an institution the state authorises, the EU):
  address + signer pinned in the LOTL + scope (which roles, which credential types) + approval record. The first format read is
  ETSI TS 119 602 (LoTE JSON). Credentials can be issued to wallets of wallet providers in scope; credentials of PID/EAA providers
  in scope (including EU PID and mDL) can be verified. Trusting any particular external list is NOT decided by this ADR — each list
  enters the LOTL with project management approval.
domain: Trust
translation_of: ADR-0036
source_version: 1.0.0
---

# Plain summary

- When a state or the EU publishes its own trust list, Tamga's list of lists (LOTL) shows that list's **address, signer and what it
  may vouch for**. The list stays with its owner; Tamga only collects.
- Wallets and verifiers keep trusting a single thing: the root key of the Tamga LOTL. The LOTL tells them the rest.
- An external list **cannot go beyond its scope**. For example, a list that vouches only for identity providers cannot add an
  institution issuing diplomas.
- Today there is **no** external list in the LOTL. Adding a list is a separate approval.
- The verifier also recognises the EU identity credential (PID) and the driving licence (mDL). Nested fields in the EU identity
  (address sub-fields, the nationalities array) can be disclosed selectively.

# Context

[[ADR-0035]] positioned Tamga Network as a **[[t:federation]]**: it collects country lists and introduces them to each other.
[[ADR-0009]] had set the hand-over goal: when the state arrives, the list's owner changes, the identifiers do not. There was no
technical gate for this:

1. The code read only lists signed by the Tamga root and in the Tamga format (`tamga-tl+jwt`).
2. States and the EU publish their lists in [[t:ETSI]] formats. For the eIDAS 2.0 wallet roles ([[t:wallet-provider]]s,
   [[t:PID]] providers, [[t:access-certificate]] providers) the EU uses ETSI TS 119 602 "Lists of Trusted Entities" ([[t:LoTE]]).
3. Our issuance service issued [[t:credential]]s only to wallets of wallet providers in the Tamga list. A TÜBİTAK or EU wallet
   therefore could not obtain credentials from Tamga institutions.
4. The [[t:verifier]] did not recognise the EU PID / [[t:mDL]] types. The SD-JWT package could only disclose top-level fields;
   there was no nested [[t:selective-disclosure]] (RFC 9901 §4.2).

Project management approved closing these gaps (2026-10-01; the verbatim quote is in the private approval record).

# Decision

## K1 — External list pointer in the LOTL

`lotl.external_lists[]`. Each entry contains:

| Field | Meaning |
|---|---|
| `list_id` | Permanent identifier |
| `territory` | Country (ISO 3166-1) or `EU` |
| `format` | `etsi-lote-json` (read); `etsi-tl-xml` (defined, no reader → not loaded) |
| `list_url` | Original publication address |
| `signing_keys` | SHA-256 fingerprints of the certificates that sign the list; **pinned in the Tamga-signed LOTL** |
| `operator` | The list operator |
| `status` | Status |
| `scope` | Scope: see K2 below |
| `approval` | Approval date and record (FD4) |

The publisher keeps a copy of the list at `trust.tamga.network/external/<list_id>.jws` (`npm run trust:external`). Readers use this
copy first and the original address otherwise. In both cases the signature is checked against the signer pinned in the
[[t:LOTL]]; the copy cannot change the content.

## K2 — Scope

`scope.entity_kinds` ⊂ {`wallet_provider`, `pid_provider`, `eaa_provider`, `access_ca`}. For PID and [[t:EAA]] providers
`scope.vct` (the credential types that may be vouched for) is mandatory. The institution's classification shown in the verification
policy comes from the scope: `category`, `assurance`, `class`, `recognized_by`. For wallet providers `min_key_storage` may be set.

## K3 — Reading rules

- Every external list is **independent.** If one is missing, stale or unverifiable, the freshness of the Tamga lists is not
  affected. Questions depending on that list return UNKNOWN (INDETERMINATE at the verifier).
- ETSI service type → role mapping follows the path segment of the URI: `WalletSolution`, `PID`, `EAA`, `WRPAC`. `…/Issuance` means
  signing, `…/Revocation` means [[t:status-list]] signing. Withdrawn services are not taken.
- The service certificate in the list is a **[[t:trust-anchor]]**: it may be a CA or the signer itself. The verifier takes the
  fingerprint of the anchor the credential chain leads to and resolves the external institution from it.
- The sequence number cannot go back (rollback rejected). An unknown `LoTEVersionIdentifier` is not loaded (CMP2).

## K4 — Issuance (external wallets)

An institution accepts the wallet attestation ([[t:WIA]]/[[t:WUA]]) of a provider recognised by an external list whose scope
includes `wallet_provider`. If the `min_key_storage` in the scope is stricter than the institution's own policy, it applies. The
default does not change: unless an external list is added to the LOTL, only the providers in the Tamga list are recognised.

## K5 — Verification (external institutions, EU PID, mDL)

- **B2:** a type that is not in the Tamga catalogue is accepted only on two conditions: the credential chain leads to the anchor of
  an external list that vouches for this type, and the type is among the external type definitions (`urn:eudi:pid:1`,
  `eu.europa.ec.eudi.pid.1`, `org.iso.18013.5.1.mDL`). B4 (Tamga catalogue digest) does not apply in this case. For Tamga types
  `vct#integrity` remains mandatory.
- **C:** C1/C2 come from the external list's freshness and scope. C3 is evaluated with `recognized_by` in the scope. C4 and `iss`
  consistency do not apply.
- **D:** The status list signer is the institution's revocation service certificate in the external list (otherwise the anchor
  itself).
- **E:** E1–E3 are unchanged; for nested paths (`address.locality`) the scope is evaluated on the field itself or its ancestor.

## K6 — Nested selective disclosure

[[t:SD-JWT-VC]] processing follows RFC 9901 §7.1. Objects use `_sd`, array elements use `{"...": digest}`; disclosed values are
resolved recursively; every [[t:disclosure]] is used exactly once; an unmatched disclosure is rejected. Paths take the form `a.b`
and `a[i]`. The rule has a single implementation (`@tamga-network/core/sd-structure`); the verifier and the wallet use the same
code. [[t:DCQL]] paths (`["address","locality"]`, `["nationalities", null]`) are converted to this form.

# Invariants

| Code | Rule |
|---|---|
| FD1 | An external list is shown only in the Tamga-signed LOTL with its address, pinned signer fingerprint and scope; a list whose signer does not match the LOTL is not loaded. |
| FD2 | An external list cannot vouch for roles and credential types outside its scope; out-of-scope entries are ignored. |
| FD3 | A missing, stale or unverifiable external list does not affect the freshness of the Tamga lists; every question depending on that list returns UNKNOWN. |
| FD4 | An external list enters, changes in or leaves the LOTL only with project management approval, recorded in the `approval` field; an entry containing placeholders is not published. |
| FD5 | For Tamga types `vct#integrity` is mandatory; for external types, trust in the type comes from the external list's signed entry. |

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| Copying external entries into the Tamga list | rejected | The entry would appear under Tamga's signature: wrong ownership, meaningless hand-over and a risk of false statements. |
| Letting verifiers choose external lists themselves | rejected (as the default) | Every verifier would trust differently; the single trust anchor for wallets and institutions would be lost. Institutions can still supply their own `TrustSource` (BT4). |
| **Pointer in the LOTL + pinned signer + scope** | **accepted** | The EU LOTL model; ownership stays with the list; on hand-over only the address and signer change ([[ADR-0009]]). |
| An ETSI TS 119 612 XML reader first | deferred | The EU wallet roles are published in 119 602 JSON; XML ([[t:QTSP]]s) becomes relevant with an e-signature partnership. |

**Known limits:**

- The wallet attestation **formats** (WIA fields) of external wallet providers may differ by vendor. An interoperability test with
  a real external wallet must be done separately.
- The `access_ca` scope is defined but only stored. Showing verifiers with external access certificates in the wallet is later work.
- Reading external lists in the wallet is off by default (`externalLists`). Turning it on is needed for external institutions'
  credentials to be recognised in the wallet.

# Consequences

Implemented (2026-10-01):

- `@tamga-network/trust`: type, LoTE reader, store, `TrustSource` and HTTP / directory loaders.
- Publisher: entry validation and `external-fetch`.
- `@tamga-network/verifier`: resolving external institutions via the anchor, external types and nested paths.
- `@tamga-network/sd-jwt` and wallet-core: nested selective disclosure.
- `@tamga-network/issuer` and the institution service: the external provider's key storage rule.
- `@tamga-network/schemas`: external type definitions.
- Tamga Verify: external anchors in the root set.
- Tests: federation conformance tests with a synthetic external LoTE; unit tests for nested disclosure.

# Status

**Accepted — 2026-10-01** (approved by project management). Particular external lists (TÜBİTAK, the EU LOTL, other states) are added
**with separate approvals**.
