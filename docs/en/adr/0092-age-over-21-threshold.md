---
document_id: ADR-0092
title: "Age threshold `age_over_21`: identity credential and driving licence information"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-20
last_updated: 2026-11-20
summary: >
  21 joins the identity credential's closed set of age thresholds: {15, 18, 21}. The driving licence information also carries
  `age_over_21` next to `age_over_18`, so that checks made with the driving licence, such as car rental, can ask about 21 in a
  single presentation. Naming and privacy follow ADR-0064: the ISO/IEC 18013-5 `age_over_NN` pattern, the same name in both
  formats, the value derived from the date of birth at issuance, selectively disclosable, the date of birth not disclosed,
  policies ask for one threshold. The ZK copy is unchanged (15 and 18). Credentials issued earlier get the attribute when
  re-issued (ADR-0029). Accepted: 2026-11-20.
domain: Identity
translation_of: ADR-0092
source_version: 1.0.0
related: ["[[ADR-0011]]", "[[ADR-0026]]", "[[ADR-0029]]", "[[ADR-0032]]", "[[ADR-0039]]", "[[ADR-0043]]", "[[ADR-0044]]", "[[ADR-0064]]", "[[ADR-0089]]", "[[FW-RB-0003]]", "[[SPEC-ID-0003]]"]
---

# In short

The identity credential and the driving licence information now also answer "is the person over 21?" with yes or no:
`age_over_21`. 21 is an important threshold in many countries (car rental, alcohol in some countries). The verifier sees only
yes or no; the date of birth is not shared. Age thresholds remain a closed set; any further threshold is added by a separate
decision.

# Context

- **Today.** The identity credential (`urn:tamga:id:IdentityAttestation:1`, [[ADR-0011]]) carries two derived age attributes:
  `age_over_15` and `age_over_18`; the set is closed and a new threshold is added only by ADR ([[ADR-0064]] K2). The driving
  licence information (`urn:tamga:id:DrivingLicenceAttestation:1`, [[ADR-0039]]) carries only `age_over_18`.
- **Need.** 21 is a common threshold in car rental and, in some countries, in alcohol sales; the ISO/IEC 18013-5 driving licence
  also uses `age_over_21` as a known element. The sandbox's sample car rental verifier has to ask 18 today.
- **One presentation, one credential.** A verifier checks one credential per presentation. Car rental asks for the driving
  licence information; for the age question to be answered by the same credential, the threshold must also be in it.
- **Direction from project management (2026-11-20):** add 21; other thresholds (e.g. 13, 16, 65) are added separately when needed.

# Decision

## K1 — `age_over_21` in the identity credential

- The identity credential carries `age_over_21` (boolean): a claim in SD-JWT VC, an element in the `tamga.id.1` namespace in
  mdoc, the same name in both formats.
- The derivation rule is the same as for `age_over_18` ([[ADR-0064]] K1): the UTC calendar day of the identity service's clock;
  the person passes the threshold on the day their 21st birthday begins; people born on 29 February pass it on 1 March in
  non-leap years. For a person under 21 the value is `false`. Copies are recomputed on renewal ([[ADR-0089]]).
- The attribute is selectively disclosable (`sd: always`), is in the derived attributes list, and is not required by the schema.
- The identity credential's threshold set: **{15, 18, 21}**. A new threshold is still added only by ADR.

## K2 — `age_over_21` in the driving licence information

- The driving licence information carries `age_over_21` next to `age_over_18`; name, encoding and derivation follow K1, the value
  is derived from the date of birth on the card ([[ADR-0039]] K3).
- The driving licence information's threshold set: **{18, 21}**; it is closed and changes only by ADR. The provision in
  [[ADR-0064]] K2 that "the driving licence information carries only `age_over_18`" is changed by this decision.

## K3 — Privacy and policies

- Privacy is the same as [[ADR-0064]] K3: each threshold is disclosed separately, the wallet shows only the requested
  threshold, the date of birth is not disclosed.
- The network's policies ask for one threshold; asking for two together reveals an age range. A policy that asks about 21 does
  not also ask about 18.
- This decision opens no new general policy. Tamga Verify's car rental policy (`car-rental-driving`) asks 21 instead of 18; the
  `car-rental-driving-1` scope in the real network and sandbox records is updated accordingly. The scope name does not change:
  during the development phase records are corrected in place ([[ADR-0029]]); the scope's registration certificate is regenerated
  with the new attribute set ([[ADR-0026]]).

## K4 — The ZK copy is unchanged

- The ZK copy ([[ADR-0044]]) carries `age_over_18` and `age_over_15` as today; `age_over_21` is not added. The equality circuit
  can also prove 21 ([[ADR-0064]] K4); adding it to the ZK copy is separate work.

## K5 — No migration

- Type, `vct`, mdoc docType and namespace do not change. Schema metadata is corrected in place under the development-phase rule
  ([[ADR-0029]]); the `vct#integrity` value changes.
- Credentials issued earlier do not carry `age_over_21`; the attribute arrives when the person obtains the credential again or
  when a copy is renewed. No migration code is written.

# Options considered

| Option | Result | Why |
|---|---|---|
| **Add 21 to the identity credential and to the driving licence information** | **accepted** | Common threshold; car rental can ask in one presentation with the driving licence. |
| Add it only to the identity credential (as in [[ADR-0064]]) | rejected | Car rental asks for the driving licence; one credential is verified per presentation, so 21 could not be asked. |
| Add 13, 16, 21 and 65 together | deferred | Today only 21 is needed; each threshold is a disclosable attribute and upkeep. A separate ADR when needed. |
| Let the verifier compute it from the date of birth | rejected | The date of birth would be disclosed; against data minimisation in age checks. |

# Invariants

| Code | Rule |
|---|---|
| YE4 | The identity credential's age threshold set is {15, 18, 21} and the driving licence information's is {18, 21}; both are closed and change only by ADR. The attributes use the ISO/IEC 18013-5 `age_over_NN` name, the same name in both formats, are derived from the date of birth at issuance and are selectively disclosable. |

# Consequences

- Schema catalogue: `age_over_21` in the identity credential and driving licence information types (`packages/schemas`).
- Identity service: derivation in the identity credential, the driving licence information and renewal.
- Tamga Verify: the car rental policy asks 21; the scope in the real network and sandbox records.
- Wallet: attribute label (tr, en, tk).
- Documents: the identity rulebook ([[FW-RB-0003]]) and guides.
- Next: 21 in the ZK copy; further thresholds by separate ADRs when needed.

# Status

**Accepted — 2026-11-20** (project management approval). YE4 is binding; the driving licence provision of [[ADR-0064]] K2
changed with this decision.
