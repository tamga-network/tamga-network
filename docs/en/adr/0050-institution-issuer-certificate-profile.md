---
document_id: ADR-0050
title: "Institution issuer certificate profile"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  The credential signing and status list signing certificates of issuing institutions (the identity service included) follow
  ETSI TS 119 412-6 V1.2.1 and EN 319 412-3: the subject carries the institution identifier (`organizationIdentifier`, the same as
  the registration certificate's `sub`), the institution's legal name and the country; key usage is critical and of a single type
  (`digitalSignature` only); subject and authority key identifiers (SKI, AKI) are mandatory; AIA is not needed for non-qualified
  EAA. Sandbox certificates are re-signed with the same key; the production network's certificates are renewed when the
  institution identifier is entered into the registration. Changes the certificate detail of D-ID-5 (SPEC-ID-0002). Accepted
  2026-10-13.
domain: Identity
related: ["[[ADR-0004]]", "[[ADR-0026]]", "[[ADR-0022]]", "[[ADR-0038]]", "[[ADR-0041]]", "[[SPEC-ID-0002]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0050
source_version: 1.0.0
---

# In short

The certificate an institution signs credentials with must identify that institution the way the EU expects: the institution's tax
or registry number is inside the certificate and is the same as the number in the registration certificate. This decision writes
down which fields are mandatory in institution certificates.

# Context

- **The EU rule.** ETSI TS 119 412-6 V1.2.1 (2026-04) gives the certificate profile for PID, wallet and EAA providers. If the subject
  of the certificate is a legal person, EN 319 412-3 §4.2.1 applies: `organizationIdentifier` (OID 2.5.4.97, the EN 319 412-1
  semantic identifier), `organizationName`, `countryName` (PID-4.3-02). The key usage extension is mandatory and must be **exactly
  one** of the types in EN 319 412-2 Table 1 (PID-4.4.1-01; for the ISO/IEC 18013-5 document signer certificate, `digitalSignature`
  only). SKI is mandatory (PID-4.4.2-01); a certificate that is not self-signed is expected to carry AIA (PID-4.4.3-01) — for
  non-qualified EAA this is left to EN 319 412-2, for qualified and public body EAA it is mandatory.
- **Today.** Tamga's institution certificates carry P-256/ES256, SKI and (in newly generated ones) AKI; the subject is `CN, OU, O, C`
  and **there is no institution identifier**. The registration certificate (WRPRC), however, identifies the institution with `sub`
  = `VATTR-<tax number>` ([[ADR-0026]] K2); access certificates have carried this number since 2026-10-09 ([[ADR-0026]] K3).
  Because it is missing from the issuer certificate, a verifier on the EU side cannot match the institution that signed a
  credential with its registration data.
- **D-ID-5** ([[SPEC-ID-0002]]) describes the certificate hierarchy and validation but not the subject and extension profile.
- The library note kept this open as KA-412-6-1; the first EU alignment review (2026-10-13) put it in the "certificate profiles
  before the server" package, and project management accepted it the same day.

# Decision

## K1 — Scope

The profile applies to these certificates of every issuer with an `issuers[]` entry in the trusted list: the credential signing
certificate (`cert`) and the status list signing certificate (`status_cert`, `delegate_keys[]` `purpose: "status_list"`). The
identity service, as an issuer, follows this profile too. Access certificates ([[ADR-0026]] K3) and list signing, registrar and
wallet provider certificates are covered by their own decisions.

## K2 — Profile

| Field | Rule |
|---|---|
| Subject | `organizationIdentifier` (2.5.4.97) **MUST**: the same semantic identifier as the registration certificate's `sub` (`TR-VKN` → `VATTR-<number>`, `TR-MERSIS` → `NTRTR-<number>`, LEI → `LEIXG-<code>`; [[ADR-0026]] K2). `organizationName` (`O`) **MUST**: the institution's legal name (`legal_name` in the registration; may be written in Latin letters). `countryName` (`C`) **MUST**. `commonName` (`CN`) and `organizationalUnitName` (`OU`) are optional (for example "Status List") |
| Key usage | Critical; `digitalSignature` only (a single type from EN 319 412-2 Table 1; the type compatible with the mdoc document signer certificate). Other bits **MUST NOT** be set |
| Basic constraints | Critical, `cA = false` |
| SKI | **MUST** (RFC 5280 §4.2.1.2) |
| AKI | **MUST** = the SKI of the signing authority (root or intermediate authority); HAIP `trusted_authorities` (`aki`) matching depends on it |
| AIA `caIssuers` | Not needed for non-qualified EAA (today every issuer in the network, [[ADR-0022]]): the chain is in the credential's `x5c` and the root is in the trusted list. The qualified or public class (QEAA, PuB-EAA; QcStatements included) is opened by a separate decision |
| Algorithm | P-256, ECDSA SHA-256 (unchanged) |
| Validity | At most 3 years (2 years today; unchanged) |

## K3 — Transition

- **Sandbox** ([[ADR-0038]]): the certificates of the example institutions and of the sandbox identity service are **re-signed with
  the same key** (`gen-pki --profile=sandbox --reissue=…`); new serial number, new fingerprint, hence a new `issuer_id`. The root
  and the list signer do not change, and the sandbox pin in wallets stays the same. Because the sandbox is reset every night, old
  test credentials becoming invalid is accepted.
- **Sandbox test institutions** ([[ADR-0041]]): adding `organizationIdentifier` to the leaf certificates the list publisher issues
  comes with the next release of the packages (list publisher).
- **Production network:** an institution certificate is issued when the institution identifier is entered into the registration
  (`pki-issue --prod --org-id`; `--org-id` is mandatory for an institution certificate). For an issuer whose registration has no
  number today (the identity service): when the number is entered, a new key and certificate are issued, the new certificate is
  added to the entry, and the old certificate stays during the overlap only to verify old credentials ([[SPEC-ID-0002]] §4 and the
  [[ADR-0004]] renewal pattern; XC2). The production network's PKI is outside the repository; the step is carried out with the
  procedure documented by the operator.
- The **development PKI** does not change (local, random; like [[ADR-0026]] K3, it carries no identifier).

## K4 — Check

At publication the list publisher compares the issuer certificate's `organizationIdentifier` with the identifier in the
registration; if it is missing or different, it warns (on the production network publication is not blocked; for an entry without
an identifier no registration certificate is generated anyway, [[ADR-0026]] K2). Turning the warning into an error happens by a
separate decision once all certificates on the production network have been renewed.

# Options considered

| Option | Result | Why |
|---|---|---|
| Keeping the identifier only in the trusted list | rejected | EU verifiers and 412-6 look at the certificate itself; tools outside the list cannot identify the institution |
| `nonRepudiation` (content commitment type) in key usage | rejected | A credential signature is an institution statement, but the mdoc document signer certificate requires `digitalSignature` only; both formats use the same certificate |
| Making AIA mandatory from today | rejected (today) | Not needed for non-qualified EAA; it requires running a publication point. It comes with the qualified class |
| Generating new keys in the sandbox | rejected | The key bundle on the server would change; re-signing with the same key is enough |

# Invariants

| Code | Rule |
|---|---|
| CP1 | The credential and status list signing certificate of an issuing institution carries in its subject the same `organizationIdentifier` as the registration certificate's `sub`, the institution's legal name (`O`) and its country (`C`). |
| CP2 | In an institution certificate key usage is critical and `digitalSignature` only; SKI and AKI are mandatory. |

# Consequences

- [[SPEC-ID-0002]] §1.1 (new): institution certificate profile; XC6.
- `ops/gen-pki.ts`: `organizationIdentifier` in the subject names of the sandbox institution and identity service certificates;
  re-signing (`--reissue`). `ops/pki-issue.ts`: AKI; `--org-id` mandatory for an institution certificate with `--prod`.
- List publisher (next release of the packages): the K4 check; `organizationIdentifier` in sandbox test institution leaves.
- Operator: the production identity service certificate is renewed when the institution identifier is entered into the
  registration (procedure in the operator's documentation).

# Status

**Accepted — 2026-10-13.** Approved by project management (first EU alignment review, package 2 and decision 16). DECISIONS:
D-ID-12. Changes the certificate detail of D-ID-5.
