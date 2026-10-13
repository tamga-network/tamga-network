---
document_id: ADR-0048
title: "No suspension for identity service credentials; mdoc status list as CWT"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  Alignment with the EU person identification data (PID) rule: the credential types issued by the identity service have no
  suspension, their status is only "valid / revoked", and the status lists of these types are published with `bits = 1`.
  For institution credentials, suspension is used only in types whose schema says `suspension_allowed: true`. The MSO of an mdoc
  credential points to a CWT representation (`application/statuslist+cwt`) of the same logical list at a separate address; the JWT
  and CWT representations carry the same bits. Changes SPEC-CRED-0003/S2. Implemented in release 0.6.0 of the packages. Accepted
  2026-10-13.
domain: Credentials
related: ["[[ADR-0008]]", "[[ADR-0013]]", "[[ADR-0022]]", "[[ADR-0029]]", "[[ADR-0044]]", "[[SPEC-CRED-0003]]", "[[SPEC-SCHEMA-0001]]", "[[FW-RB-0001]]", "[[FW-RB-0003]]", "[[FW-POL-0001]]"]
translation_of: ADR-0048
source_version: 1.0.0
---

# In short

The identity service's credentials can no longer be suspended: they are either valid or revoked. Institutions use suspension only
if the type's schema allows it (for example a diploma). The mdoc copy of the identity credential reads its status from the CWT
copy of the same list. This was a proposal of the first EU alignment review (2026-10-13); project management accepted it the same
day.

# Context

- **Today's rule.** All Tamga status lists are published with `bits = 2` (valid, revoked, suspended; [[SPEC-CRED-0003]] §3.3, S2).
  The Identity Rulebook says "valid, revoked, suspended" for the identity credential ([[FW-RB-0003]] §6.2); RB-AP-ID-11 says no ZK
  copy is issued "if the main credential is revoked or suspended". The identity service's code, however, never suspends; it only
  revokes. The Institution Console allows suspension for every credential type.
- **The EU rule.** Implementing Regulation (EU) 2024/2979 Annex II (as amended by 2026/1731) makes ETSI TS 119 472-1 binding with
  this adaptation: for PID, qualified EAA and public body EAA the status is only "revoked / not revoked", **there is no
  suspension**, and revocation is permanent. Our identity credential is not a PID ([[ADR-0022]]: a non-qualified EAA), but it uses
  the EU PID's names and encoding ([[ADR-0045]]) and is the type closest to being replaced by a state PID. Suspension also has no
  meaning for identity: there is no situation in which an identity is "temporarily invalid during an inquiry"; when in doubt the
  credential is revoked and the person verifies again.
- **mdoc status reference.** Today the MSO of the identity credential's mdoc copy points to the same address as the SD-JWT copy,
  that is, to the list in JWT format. ISO/IEC 18013-5 and the EU regulation expect the CBOR/COSE format (CWT) for mdoc; an mdoc
  reader should not have to carry a JWT parser. [[SPEC-CRED-0003]] §3.2 had left CWT "to be considered in the state phase".

# Decision

## K1 — No suspension in the identity service's types

- In every type issued by the identity service that uses a status list (identity credential `urn:tamga:id:IdentityAttestation:1`,
  driving licence information `urn:tamga:id:DrivingLicenceAttestation:1`, contact credentials `urn:tamga:contact:EmailAddress:1`
  and `urn:tamga:contact:PhoneNumber:1`) the status is only **valid (`0x00`)** or **revoked (`0x01`)**. Revocation is permanent.
- The status lists of these types are published with **`bits = 1`**. Lists are separate per type (S9), so a list never mixes types
  with and without suspension.
- The identity service does not suspend credentials; when in doubt it revokes. A ZK copy is not issued if the main credential is
  revoked (the "or suspended" part of RB-AP-ID-11 is dropped).
- In the list of a type without suspension every value other than `0x00` and `0x01` is REJECTED for the verifier (a corrupt list);
  a `bits = 1` list has no other values anyway.

## K2 — Suspension for institution types only if the schema allows it

- An optional **`suspension_allowed`** field (boolean, default `false`) is added to the `tamga` block of the schema metadata
  ([[SPEC-SCHEMA-0001]] §2.4).
- Suspension (`0x02`) is used only for credentials of types whose schema has `suspension_allowed: true`. Among the education types,
  the diploma (`urn:tamga:edu:DiplomaCredential:1`) carries it: the credential is suspended while a plagiarism or forgery inquiry
  is under way. Other types do not carry the field; for them the issuer **MUST NOT** use suspension.
- Institution lists stay at `bits = 2` (also for types without suspension; the value `0x02` is not written). If a type is later
  allowed suspension, the list format does not change.
- The Institution Console offers "Suspend" only for types with `suspension_allowed: true`. An institution running its own issuance
  service follows the same rule (RB-AP).
- The identity service's types do not carry `suspension_allowed` (K1).

## K3 — The mdoc status reference points to the CWT representation

- For every type that uses a status list and is also issued as mdoc, the issuer publishes the same logical list in two
  representations: JWT (`application/statuslist+jwt`, today's) and CWT (`application/statuslist+cwt`; the CWT format of the IETF
  Token Status List: COSE_Sign1, ES256, `typ` = `application/statuslist+cwt` and `x5chain` in the protected header; claims `sub`
  (2), `iat` (6), `exp` (4), `ttl` (65534), `status_list` (65533) `{bits, lst}`).
- The two representations are at **separate addresses**, because each token's `sub` must be exactly its own address
  ([[SPEC-CRED-0003]] Ş4). The CWT address is also opaque (S8) and does not encode institution, year or group.
- The two representations carry **the same bits**, are signed in the same publication cycle with the same key (same `iat`, `exp`,
  `ttl`) and are written to the anchor log as two separate lines. The SD-JWT and mdoc copies of a credential use the same `idx`.
- The SD-JWT VC copy points to the JWT address; the MSO of the mdoc copy (`status.status_list {idx, uri}`) points to the CWT
  address. An mdoc verifier checks the CWT representation with the CBOR equivalent of the steps in [[SPEC-CRED-0003]] §7.
- For types not issued as mdoc no CWT representation is published.

## K4 — Implementation and transition

- Implemented in release 0.6.0 of the `@tamga-network/*` packages and in the identity service. Under the development-phase rule
  ([[ADR-0029]]) no migration code is written: the identity service opens new (`bits = 1`) lists and identity credentials in wallets
  are obtained again.
- The Institution Console's rule text follows this decision from today; hiding the button by type comes with 0.6.0.

# Options considered

| Option | Result | Why |
|---|---|---|
| Keep all lists at `bits = 2` and have the identity service simply not use suspension | rejected | The list format does not state the rule; a verifier seeing `0x02` would not know what to do. To be read like an EU PID, the format too must be "revoked / not revoked" |
| Remove suspension from all network types | rejected | Suspension during an inquiry is a real need for diplomas ([[SPEC-CRED-0003]] §3.3); the EU leaves it free for non-qualified EAA |
| Suspension permission in the issuer entry (per institution) | rejected | Suspension depends on the meaning of the type, not on the institution's preference; the schema states one rule for everyone |
| Keep the mdoc at the JWT address | rejected | It forces a JWT parser on mdoc readers; ISO and the EU expect CWT |
| Content negotiation at one address (JWT or CWT by `Accept` header) | rejected | The token's `sub` must equal the address exactly; two formats at one address mix in the prefetch cache |
| Identifier list (Attestation Revocation List) | rejected (today) | Tamga issuers publish a Status List; one is enough (EU VCR_11); verifiers still read identifier lists |

# Invariants

| Code | Rule |
|---|---|
| SU1 | Credentials of the identity service's types are not suspended; their status is only valid or revoked, and the status lists of these types are published with `bits = 1`. |
| SU2 | Suspension (`0x02`) is used only in types whose schema has `suspension_allowed: true`; for other types the issuer does not write the suspension value. |
| SU3 | The status list of a type also issued as mdoc is published as JWT and CWT at separate, opaque addresses with the same bits; the mdoc copy points to the CWT address, the SD-JWT copy to the JWT address. |

# Consequences

- [[SPEC-CRED-0003]]: S2 is rewritten after this decision; §3.2 CWT representation, §3.3 `bits` per type, §7 Ş8–Ş9.
- [[SPEC-SCHEMA-0001]] §2.4: `suspension_allowed`.
- Framework: [[FW-RB-0003]] §3.1 and §6.2; [[FW-RB-0001]] RB-AP-18, RB-AP-ID-11, new RB-AP-28 and RB-AP-ID-13; [[FW-POL-0001]] §5;
  Education Rulebook §6.2.
- Packages (0.6.0): the `@tamga-network/issuer` list publisher (`bits` per type, CWT representation), `@tamga-network/mdoc` (MSO
  status reference), `@tamga-network/verifier` and `wallet-core` (reading CWT), the schema catalogue (`suspension_allowed`).
- Identity service and Institution Console (operator repository): new lists; the suspend button by type.

# Status

**Accepted — 2026-10-13.** Approved by project management (first EU alignment review, decision 5). DECISIONS: D-CRED-9.
