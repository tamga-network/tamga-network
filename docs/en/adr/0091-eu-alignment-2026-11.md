---
document_id: ADR-0091
title: "EU alignment mapping 2026-11: rulebook link, encryption under long-lived keys, PID attributes, transaction data"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-18
last_updated: 2026-11-18
summary: >
  Four decision-level outcomes of a clause-by-clause mapping against the EU technical specifications (TS3, TS7, TS8, TS10, TS11),
  ARF 3.0.0 §4.4.3 and ECCG Agreed Cryptographic Mechanisms v2. K1: each schema catalogue entry links its human-readable rulebook under
  the EU TS11 name (`rulebookURI`); type metadata and digests are unchanged. K2: the two AES-GCM uses that repeatedly encrypted under
  the same key now encrypt every message under a single-use key (wallet store `tws2`, identity service ZK refresh token `A256KW`).
  K3: the identity attestation carries the EU PID `place_of_birth` (only when the source document carries it) and `issuing_authority`.
  K4: the OpenID4VP 1.0 transaction data mechanism (`transaction_data`) is added to the packages; the network defines no transaction
  type, the wallet's list of recognised types starts empty and a request carrying transaction data is rejected. Accepted: 2026-11-18.
domain: Protocol
translation_of: ADR-0091
source_version: 1.0.0
related: ["[[ADR-0010]]", "[[ADR-0011]]", "[[ADR-0029]]", "[[ADR-0044]]", "[[ADR-0045]]", "[[ADR-0089]]", "[[SPEC-PROTO-0002]]", "[[SPEC-SCHEMA-0001]]", "[[SPEC-WALLET-0001]]", "[[FW-RB-0003]]"]
---

# In short

We compared the EU technical specifications and the agreed algorithm list with the code, clause by clause. Gaps fixed in code alone
(recording the requested attribute names of a deletion request, showing an intermediary verifier in the log and in the complaint file,
e-mail subjects) needed no decision. Four outcomes touch closed decisions or add rules, so they are recorded here.

# Context

- **EU TS11** (catalogue) asks for the address of each credential type's human-readable rulebook under the name `rulebookURI`; ARF R27
  asks for the same link. The Tamga catalogue had no such link.
- **ECCG ACM v2** (April 2025, the applicable version) §3.5 Notes 23/25: AES-GCM with a 96-bit IV, a 128-bit tag and the deterministic
  IV construction of NIST SP 800-38D §8.2.1. Two places encrypted repeatedly under the same key with a random IV: the wallet store
  (`tws1`) and the identity service's ZK refresh token (JWE `dir` + A256GCM, [[ADR-0044]]). Encrypted responses to verifiers, the TS10
  export file and the proximity session use a fresh key or a counter each time.
- **CIR 2026/1731** makes the PID attribute `place_of_birth` (`country`, `region`, `locality`; at least one) and the metadata
  `issuing_authority` mandatory. The Tamga identity attestation is not a PID ([[ADR-0011]]) and [[ADR-0045]] did not address these two.
- **OpenID4VP 1.0 §5.1, §8.4, Annex B.3.3**: a verifier may add transaction data to a request; a wallet that does not support it must
  reject the request. The Tamga wallet core silently ignored the parameter. ARF R36 requires the mechanism for payment confirmation
  and qualified signatures.
- On 2026-11-18 project management chose the direction for all four items.

# Decision

## K1 — `rulebookURI` in the catalogue entry

- Each `catalogue.json` entry carries `rulebookURI`: the rulebook on the Tamga ARF site. A type without its own rulebook links the main
  Tamga Rulebook; a type without a mapping stops the catalogue build.
- The name comes from EU TS11. It lives only in the catalogue entry: not in type metadata nor in the signed list (`lotl.schemas[]`);
  `content_hash` values do not change.

## K2 — AES-GCM under long-lived keys: a single-use key per message

- **Wallet store (`tws2`):** each write derives a write-specific subkey from the master key with HKDF-SHA-256 and a random 32-byte salt;
  as the subkey is used once, the IV is fixed (12 zero bytes). Format `tws2.` + base64url(salt ‖ ciphertext ‖ tag). Existing `tws1.`
  records are read only and move to `tws2` on the next write.
- **ZK refresh token:** JWE `A256KW` + A256GCM; each token is encrypted under its own random content key, wrapped with a wrapping key derived
  from the service key with HKDF (AES-KW, ACM §3.6). The per-token IV is still random; since the key is single-use no IV repeats under one key. `dir` tokens issued
  before this decision are opened only; since tokens are renewed on every use, this read path is removed at the latest when old tokens
  expire (2028-11-18). The store checks the salt's length and non-zero content before writing (the fixed IV's safety rests on salt
  uniqueness).
- All building blocks (HKDF-SHA-256, AES-256-GCM, AES-KW) are "recommended" in ACM v2.

## K3 — `place_of_birth` and `issuing_authority` in the identity attestation

- `place_of_birth`: EU PID structure `{country?, region?, locality?}` (at least one; text ≤ 150 characters, country ISO 3166-1
  alpha-2). Written only when the source document carries a place of birth: the free text from the identity verification provider or
  the chip (ICAO 9303 DG11 `5F11`) as `locality`; control and format characters (bidi controls, zero width) are removed and the text
  is cut by code point. If the chip field cannot be read only that field is skipped. Otherwise the attribute is omitted and the attestation is still issued.
- `issuing_authority`: the name of the provisional operator, `Tamga Network (provisional)`, written on every issuance and copy renewal.
- Both are selectively disclosable and carried under the same names in the mdoc copy ([[ADR-0089]]); neither enters the ZK copy
  elements, matching keys or logs. Both are optional in the schema (development stage, [[ADR-0029]]). The type metadata changes, so
  the `vct#integrity` digest changes: old copies are rejected at the verifier's catalogue step until renewed (copies are short-lived and
  renewal does not use that step). Deployment order: schema catalogue → signed list (`lotl.schemas[]`) → identity service; reversed, the
  wallet rejects the new copy at the catalogue step. In mdoc the place is a CBOR map; readers turn it into a plain object and compare the
  two copies independently of key order.

## K4 — Transaction data (`transaction_data`)

- **Wallet core:** each item is checked as a base64url JSON object: `type` and non-empty `credential_ids` required; each id must refer to
  a `dc+sd-jwt` query in the request that does not disable cryptographic holder binding; `transaction_data_hashes_alg`, if present, must
  offer `sha-256`. A single unrecognised type rejects the request (`invalid_transaction_data`). Recognised types are the caller's list,
  **empty by default**.
- Transaction data not shown to the person is not signed: the presentation is produced only when the caller records the approval with
  the items it showed (`confirmTransactionData`) and those items equal the request's. Each item binds to the first suitable selected
  SD-JWT VC presentation (OpenID4VP §5.1: with several `credential_ids` only one is used); an unbound item stops the presentation. Size
  limits: at most 10 items, 8 KB per item; a repeated item is rejected. When a type is added, its rulebook carries the rule "reject if a
  field is not shown on screen".
- **KB-JWT:** `transaction_data_hashes` = SHA-256 of the strings as received (no base64url decoding); if the request carried
  `transaction_data_hashes_alg`, the KB-JWT carries `transaction_data_hashes_alg: "sha-256"` (the verifier then requires the field).
- **Verifier:** the request builder may add `transaction_data`; verification receives the same strings and the digests must match
  exactly. An unexpected digest is rejected; expected transaction data without a KB-JWT is rejected. In the Tamga profile transaction
  data is not bound to an mdoc presentation (OpenID4VP defines a separate mdoc path; Tamga does not use it). A response-level "every item
  bound to at least one presentation" check and the type list on the DC API path are written when the first type is added.
- The network defines no transaction type. A type (e.g. the EU payment or qualified signature types) is added by a separate decision
  with naming approval by project management.

# Options considered

| Option | Why not |
|---|---|
| Rulebook link in the type metadata | Every `content_hash` would change; TS11 defines the field in the catalogue entry. |
| Keep the random IV | Safe in practice, but not literally ACM v2 Notes 23/25. |
| A counter IV for the store | The counter would have to persist on every write; risk of reuse after a backup restore. |
| Make `place_of_birth` mandatory | No identity attestation could be issued when the source document lacks it. |
| Do transaction data together with qualified signatures | Project management chose to add it now; silently ignoring the parameter contradicted OpenID4VP. |

# Invariants

| Code | Rule |
|---|---|
| EA1 | Every catalogue type has a `rulebookURI`; the field does not enter type metadata. |
| EA2 | No AES-GCM encryption under the same long-lived key: every encryption uses a single-use (derived or wrapped) key. |
| EA3 | `place_of_birth` comes only from the source document, never guessed; every identity attestation copy carries `issuing_authority`. |
| EA4 | A wallet rejects an unrecognised transaction data type; transaction data not shown to the person is not signed; the network defines no transaction type. |

# Consequences

- The packages (`schemas`, `sd-jwt`, `verifier`, `wallet-core`) and the identity service are updated. Tamga Wallet picks up the new
  behaviour with the next package release.
- [[SPEC-SCHEMA-0001]], [[SPEC-PROTO-0002]] §8, [[FW-RB-0003]] §4.6 and [[ADR-0044]] reference this decision.
- Privacy notices add "place of birth (if on the document)" to the identity attestation's data categories.

# Status

**Accepted — 2026-11-18.**
