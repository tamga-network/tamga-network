---
document_id: ADR-0064
title: "Age thresholds in the identity credential: `age_over_15` and the `age_over_NN` pattern"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  The identity credential carries one age attribute today: `age_over_18`. This decision adds a second threshold: `age_over_15`,
  with the same name in SD-JWT VC and in mdoc (`tamga.id.1`), following the ISO/IEC 18013-5 `age_over_NN` pattern. The age
  thresholds of the identity credential are a closed set (today 15 and 18) that changes only by ADR. Privacy is the same as for
  `age_over_18`: the identity service derives the value from the date of birth at issuance, the attribute is selectively
  disclosable, and the verifier never sees the date of birth. The zero-knowledge circuit proves equality; the threshold is not
  fixed in the circuit, so the same circuit proves `age_over_15 = true` and the ZK copy carries both thresholds. One motivation
  is the 15-year rule for social networks introduced in Türkiye by Law No. 7578 (in force 2026-11-01); this decision is not legal
  advice. Credentials issued earlier get the attribute when they are issued again (development stage, ADR-0029). Accepted:
  2026-10-23.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0029]]", "[[ADR-0032]]", "[[ADR-0039]]", "[[ADR-0043]]", "[[ADR-0044]]", "[[ADR-0045]]", "[[FW-RB-0003]]", "[[SPEC-ID-0003]]", "[[SPEC-SCHEMA-0003]]"]
translation_of: ADR-0064
source_version: 1.0.0
---

# In short

Besides "is this person over 18", the identity credential now also answers "is this person over 15": `age_over_15`. The name
follows the same pattern as the ISO/IEC 18013-5 age elements (`age_over_NN`). The verifier sees only yes or no; the date of birth
is not shared. Zero-knowledge proofs work with the same circuit. A new age threshold is added only by a new decision.

# Context

- **Today.** The network's identity credential (`urn:tamga:id:IdentityAttestation:1`, [[ADR-0011]]) carries one derived age
  attribute: `age_over_18`. The name comes from ISO/IEC 18013-5 and is the same in both formats; the EU PID set has no age
  attribute, so it is a Tamga attribute ([[ADR-0045]]). It is also the first predicate of the zero-knowledge proof ([[ADR-0032]],
  [[ADR-0044]]).
- **Pattern.** ISO/IEC 18013-5 (mDL) defines `age_over_NN` elements for age: NN is a two-digit age and the value is a boolean;
  the issuer chooses which thresholds it carries. The EU age verification work uses the same naming. The network's sector schema
  rule also asks for derived boolean attributes to be defined up front ([[SPEC-SCHEMA-0003]] SG3).
- **Türkiye.** Article 22 of Law No. 7578 (Official Gazette 2026-05-01) adds a paragraph to Additional Article 4 of Law No. 5651:
  a social network provider may not offer its service to children who have not turned 15 and must take the necessary measures,
  including age verification; under Article 27 this provision enters into force six months after publication, on **2026-11-01**.
  The law sets the outcome and leaves the method to secondary regulation. Today the identity credential cannot answer the
  15-year question without disclosing the date of birth.
- **This decision is not legal advice.** It does not decide how a platform meets its obligation, which method is sufficient or
  what secondary regulation will bring. It only lets the network's identity credential answer the 15-year question with the
  least data. The network sets no age limit ([[ADR-0043]]); this decision does not change that.

# Decision

## K1 — `age_over_15`

- The identity credential carries `age_over_15` (boolean): a claim in SD-JWT VC, an element in the `tamga.id.1` namespace in mdoc,
  with the same name in both formats.
- The identity service derives the value from the date of birth at issuance, with the same rule as `age_over_18`: the UTC
  calendar day of the service clock; a person passes the threshold on the day their 15th birthday begins, people born on 29
  February on 1 March in non-leap years. In the credential of a person under 15 the value is `false`.
- The attribute is selectively disclosable (`sd: always`), listed among the derived attributes and not required by the schema
  (like `age_over_18`).

## K2 — The `age_over_NN` pattern and a closed set

- The network's age attributes follow the ISO/IEC 18013-5 `age_over_NN` pattern: NN is a two-digit age, the value a boolean, the
  name the same in both formats.
- The age thresholds of the identity credential are a closed set: today **{15, 18}**. A new threshold (for example 13, 16, 21) is
  added only by ADR. A verifier asking for a threshold outside the set finds no match; the wallet does not compute a threshold
  itself.
- Driving licence information ([[ADR-0039]]) keeps carrying only `age_over_18`; this decision covers only the identity credential.

## K3 — Same privacy as `age_over_18`

- An age attribute is a derived yes or no; age verification does not disclose the date of birth. Each threshold is disclosed on
  its own; the wallet shows only the threshold asked for.
- Disclosing both thresholds together can reveal an age range (15–17). The network's verifier policies therefore ask for a single
  threshold; a scope that asks for both must be justified separately in the verifier's registration.

## K4 — Zero-knowledge proof

- The Longfellow circuit (version 8, one attribute; [[ADR-0032]]) proves equality: "in this namespace this element has this value".
  The threshold is not fixed in the circuit; the same circuit proves `age_over_15 = true`. No new circuit or new setup is needed;
  the circuit entry in the trust list does not change.
- The ZK copy ([[ADR-0044]]) carries the age attributes of the identity credential: `age_over_18` and `age_over_15`. The minimal
  elements in the refresh token follow this; no other personal attribute goes into the token or the copy.

## K5 — Verifier and wallet

- Tamga Verify opens two general policies: `age-over-15-mdoc` (ISO 18013-5 mdoc, yes or no only) and `age-over-15-zk` (ZK copy,
  zero-knowledge proof). The scopes `age-over-15-1` and `age-over-15-zk-1` are added to Tamga Verify's registration in the trust
  list. The browser test page offers a 15-year option.
- The wallet names the attribute in the person's language ("Over 15"). Wallet-to-wallet presentation is a separate wallet decision
  and stays limited to `age_over_18` for now.

## K6 — No migration

- The type, `vct`, mdoc docType and namespace do not change. The schema metadata is corrected in place under the development stage
  rule ([[ADR-0029]]); the `vct#integrity` value changes.
- Credentials issued earlier do not carry `age_over_15`; the attribute arrives when the person receives the credential again. No
  migration code is written.

# Options considered

| Option | Result | Why |
|---|---|---|
| The verifier asks for the date of birth and computes the age itself | rejected | More data than needed; defeats selective disclosure |
| The wallet computes the threshold from the date of birth | rejected | The issuer's signature does not cover the value; the verifier cannot rely on it |
| An open threshold set in the identity credential (any NN) | rejected | Unbounded attributes, inconsistency between verifiers; the set should grow deliberately |
| Make the threshold a parameter of the ZK circuit (range proof) | rejected (for now) | Needs a new circuit and verifier changes; the equality circuit is enough |
| Also add 13, 16 and 21 now | rejected (for now) | No concrete need; each threshold by its own ADR when the need arises |
| **`age_over_15`, ISO `age_over_NN` pattern, closed set {15, 18}** | **chosen** | Standard name, same privacy, same circuit, small change |

# Invariants

| Code | Rule |
|---|---|
| YE1 | The identity credential's age attributes carry the ISO/IEC 18013-5 `age_over_NN` name and a boolean value, with the same name in SD-JWT VC and in mdoc. The threshold set is closed (today 15 and 18); a new threshold is added only by ADR. |
| YE2 | An age attribute is derived from the date of birth by the identity service at issuance and is selectively disclosable; age verification does not disclose the date of birth; the network's verifier policies ask for a single threshold. |
| YE3 | The ZK copy carries no personal attribute other than the identity credential's age attributes; a new age threshold is proven with the equality circuit and the circuit entry does not change. |

# Consequences

- Schema catalogue: `age_over_15` in the identity credential and ZK copy types (`packages/schemas`).
- Identity service: derivation and ZK copy elements.
- Tamga Verify: `age-over-15-mdoc`, `age-over-15-zk`; trust list scopes (production network and sandbox); browser test page.
- Wallet: attribute names (tr, en, tk).
- Documents: identity rulebook ([[FW-RB-0003]]) and identity proofing specification ([[SPEC-ID-0003]]).
- Next: choosing an age threshold in wallet-to-wallet presentation (a wallet decision); other thresholds by separate ADRs when
  needed.

# Status

**Accepted — 2026-10-23** (project management approval; verbatim quote in the private approval record). DECISIONS: D-ID-14.
YE1–YE3 are binding.
