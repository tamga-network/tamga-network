---
document_id: ADR-0045
title: "Identity credential attribute names: the EU PID encoding"
status: Active
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-09
summary: >
  The Tamga identity credential (`urn:tamga:id:IdentityAttestation:1`) carries its attribute names and encodings according to
  the encoding of EU person identification data (PID) fixed by Commission Implementing Regulation (EU) 2026/1731: in SD-JWT VC
  `birthdate` (formerly `birth_date`) and a `nationalities` array (formerly the single-valued `nationality`; each element is
  disclosed separately); in mdoc `birth_date` (full-date, #6.1004) and an array-valued `nationality`. The names for given name,
  family name, national ID number and issuing country were already the same. `age_over_18` is not in the EU PID set; it stays
  a Tamga attribute with its ISO/IEC 18013-5 name in both formats. Type, docType and namespace do not change; the credential is
  not a PID. In the development stage the schema is fixed in place (ADR-0029). Changes ADR-0013 K2 (element names one to one
  with the SD-JWT names) and the attribute table of ADR-0011.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0029]]", "[[ADR-0036]]", "[[ADR-0032]]", "[[FW-RB-0003]]", "[[SPEC-ID-0003]]"]
translation_of: ADR-0045
source_version: 1.0.0
---

# In short

The EU has fixed the attribute names and formats of person identification data by regulation. The Tamga identity credential
is not a PID, but if it uses the same names, EU verifiers and wallets can read it without an extra mapping. This decision
changes two names (`birthdate`, `nationalities`) and, in the mdoc format, writes the date of birth with the date tag the EU
requires.

# Context

- Commission Implementing Regulation (EU) 2026/1731 (published 2026-07-22, in force 2026-08-11) rewrote the PID Annex of
  2024/2977:
  - **SD-JWT VC** (Tables 7–8): `family_name`, `given_name`, `birthdate` (YYYY-MM-DD), `place_of_birth`, `nationalities` (an
    array of ISO 3166-1 alpha-2 codes; `QU` if unknown, `QS` if stateless), `personal_administrative_number`,
    `issuing_country`, `date_of_expiry`, `date_of_issuance`… All claims, array elements included, are selectively disclosable
    individually (§4.2; ARF PID_21).
  - **ISO mdoc** (Table 6): element identifiers `family_name`, `given_name`, `birth_date` (`full-date` = #6.1004(tstr), RFC 8943),
    `place_of_birth`, `nationality` (encoded as `nationalities` = array), `personal_administrative_number`, `issuing_country`…
  - Age attributes (`age_over_NN`) are **not** in the PID set; in the EU a separate age verification attestation is used.
- Until now the Tamga identity credential used `birth_date` and a single-valued `nationality` in both formats ([[ADR-0011]]
  attribute table; [[ADR-0013]] K2 "element names match the SD-JWT claim names one to one"). The Tamga verifier, which verifies
  the EU PID as an external type ([[ADR-0036]]), had to know two sets of names; institutions' matching rules were also tied to
  Tamga-specific names.
- Standards library entry KA-1731-3: "the identity credential's attribute names are aligned with the EU PID SD-JWT encoding".
- We are in the development stage ([[ADR-0029]]): there are no real users; the schema is fixed in place, no backward
  compatibility is written.
- Direction from project management (2026-10-09): the date of birth attribute should be `birthdate`; fix it.

# Options considered

| Option | Outcome | Why |
|---|---|---|
| **EU PID encoding, per format (this ADR)** | **accepted** | The same names as EU wallets and verifiers; the EU's own differences between SD-JWT and mdoc as they are. |
| Today's names + a mapping table in the verifier | rejected | Every verifier and institution would have to know Tamga-specific names; contradicts the EU direction. |
| One name in both formats (`birthdate` in mdoc too) | rejected | The EU mdoc encoding says `birth_date`; it would mean departing from the EU on the mdoc side. |
| Use the EU PID type and namespace (`urn:eudi:pid:1`, `eu.europa.ec.eudi.pid.1`) | rejected | The credential is not a PID (TL8); the EU namespace and type belong only to PID providers. |
| The older PID rulebook form (`age_equal_or_over.18`) instead of `age_over_18` | rejected | The 2026/1731 PID set has no age; the older form does not rest on the regulation in force. The ISO 18013-5 name is understood in both formats. |

# Decision

## K1 — SD-JWT VC names
The SD-JWT VC representation of the identity credential uses the names of 2026/1731 Tables 7–8: `birthdate` (YYYY-MM-DD) and
`nationalities` (an array of ISO 3166-1 alpha-2 codes, at least one element; unknown nationality `QU`, stateless `QS`). Each
array element is a separate disclosure (RFC 9901 §4.2.2); in the Type Metadata `path: ["nationalities", null]`. The names
`family_name`, `given_name`, `personal_administrative_number` and `issuing_country` were already the same.

## K2 — mdoc element names and encoding
The docType (`urn:tamga:id:IdentityAttestation:1`) and the namespace (`tamga.id.1`) do not change. Elements follow 2026/1731
Table 6: `birth_date` as `full-date` with the #6.1004(tstr) tag, `nationality` as an array; the other elements have the same
names as in SD-JWT. The rule in [[ADR-0013]] K2 "element names match the SD-JWT claim names one to one" changes to: **the two
formats carry the same data; the name and encoding in each format follow the EU PID table.** The name table is in the open
package (`@tamga-network/core/pid`); wallet and verifier compare the two formats with this table, and scope (RP registration)
names are the SD-JWT names.

## K3 — Age
`age_over_18` is not in the EU PID set. It stays as a Tamga attribute with the ISO/IEC 18013-5 `age_over_NN` name in both formats;
the ZK predicate ([[ADR-0032]]) does not change.

## K4 — Tamga-specific attributes and scope
`document_type`, `document_number_hash`, `document_chip_verified` and `verification_method` stay as Tamga attributes. The
decision covers only the identity credential: driving licence information keeps using the ISO/IEC 18013-5 mDL identifiers
(`birth_date`), education credentials keep their own schemas; the `birth_date` matching key in an institution's record source
interface is the institution's own record and does not change. Institutions request `birthdate` from the identity credential.

## K5 — No migration
Development stage ([[ADR-0029]]): the schema is fixed in place, no backward compatibility is written for the old name. Test
credentials with the old names do not verify against the new schema; wallets obtain the identity credential again.

## K6 — Open point: `issuing_country`
In 2026/1731 `issuing_country` is the country of the PID provider; in the Tamga identity credential it is the country that
issued the inspected identity document. The name is kept for now; the difference in meaning is written in the rulebook. Moving
to a separate name needs a new public name and is left to project management.

# Invariants

| Code | Rule |
|---|---|
| PD1 | The identity credential's attribute names and encodings follow the EU PID encoding (Implementing Regulation (EU) 2026/1731: SD-JWT VC Tables 7–8, mdoc Table 6); the two formats carry the same data. |
| PD2 | Each element of an array-valued attribute (`nationalities`) is selectively disclosable on its own (RFC 9901 §4.2.2). |

# Consequences

- Schema catalogue: `IdentityAttestation` fixed in place (`birthdate`, `nationalities`); its `vct#integrity` changed.
- Code: `@tamga-network/core/pid` (name table), `@tamga-network/mdoc` (`toPidMdocElements`, full-date), `@tamga-network/sd-jwt`
  (array element disclosure), `@tamga-network/issuer` (matching key `birthdate`), `@tamga-network/verifier` (mdoc names →
  schema and scope), `@tamga-network/wallet-core` (mdoc matching, MD1, driving licence prerequisite); the identity service
  (operator repository); institutions' matching configuration; verifier scopes in the trust list.
- The attribute table of [[ADR-0011]] and the text of [[ADR-0013]] K2 / MD1 are read according to this ADR; [[SPEC-ID-0003]] §9 and
  [[FW-RB-0003]] §1, §6, §9 were updated.
- Wallets obtain the identity credential again (K5).

# Status

**Accepted — 2026-10-09.** With project management approval. DECISIONS: D-ID-11.
