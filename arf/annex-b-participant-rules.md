---
title: "Annex B — Participant Rules"
translation_of: FW-RB-0001
source_version: 0.4.0
outline: [2, 3]
---

# Annex B — Participant Rules (Tamga Rulebook)

<div class="arf-meta">

**Document** FW-RB-0001 · **Version** 0.4.0 · **Status** Active · **Updated** 2026-10-01 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

Binding, numbered rules that every role joining the Tamga ecosystem must follow — operator/TLSO, Registrar, Attestation
Provider, Authentic Source, Wallet Provider, Relying Party, Holder. Every rule is derived from a canonical invariant or
decision and cites its source; this annex creates no new rules, it gathers them by role and states them in "MUST" language.
Counterpart of EUDI ARF Annex 2 (High-Level Requirements).

## 0. Reading guide

- **Rule format:** `RB-<ROLE>-<NN>` · rule text · source (`DOC-ID/CODE` or decision).
- **Keywords** have their RFC 2119 meaning: **MUST**, **MUST NOT**, **SHOULD** (recommended; deviations are justified),
  **MAY**.
- **Phase note:** rules marked "phase B" are read for the ledger-free beta; when a ledger arrives, "list / anchor log" reads
  as "ledger". The rule text does not change.
- **No source** → the rule is labelled PROPOSAL and is not binding until approved.
- The rules add **no new codes** to the invariant index; they are a role-based view of it. To change a rule, change its
  source document.

Roles: GEN (everyone) · OP (operator / TLSO) · REG (Registrar) · AP (Attestation Provider / issuer) · AS (Authentic
Source) · WP (Wallet Provider) · RP (Relying Party) · H (Holder) · SCH (types / schemas).

## 1. RB-GEN — All participants

| # | Rule |
|---|---|
| RB-GEN-01 | A participant **MUST NOT** write personal data, credential content or credential hashes to shared registers (trusted list, anchor log, ledger), logs or API responses. |
| RB-GEN-02 | A participant **MUST** read trust data only through the `TrustSource` interface (or the official SDK that wraps it) — the wallet included (`@tamga-network/trust/core`); business logic that interprets the list files directly **MUST NOT** exist. |
| RB-GEN-03 | If the trust source is stale (`next_update` passed) or unreachable, the result **MUST** be `INDETERMINATE`/`UNKNOWN`; never `ACCEPTED`, never `REJECTED`. |
| RB-GEN-04 | On an unknown `list_format_version` or contract version, a component **MUST** stop and raise an alarm; accepting it is forbidden. |
| RB-GEN-05 | No Tamga infrastructure component **MUST** log IP addresses (raw, hashed or truncated). Debug logs ≤ 7 days and without IPs. |
| RB-GEN-06 | Logs and audit records may carry claim **names**; they **MUST NOT** carry claim **values** or the status `idx`. |
| RB-GEN-07 | A participant using the official `@tamga-network/*` packages **SHOULD** verify their release provenance; packages **MUST NOT** contain a `postinstall` script. |
| RB-GEN-08 | Outward assurance statements use eIDAS names (Low/Substantial/High; EAA / qualified-equivalent / PuB); people are not shown numeric levels (**SHOULD**). |
| RB-GEN-09 | Every participant **MUST** notify the scheme owner of a SEV1 incident concerning it within ≤ 4 hours and of a SEV2 within ≤ 24 hours. |
| RB-GEN-10 | During phase B every participant knows that the registers rest on a **single operator signature** and that revocation takes effect within ≤ 90 min; people are told these limits in writing. |

## 2. RB-OP — Operator / Trusted List Scheme Operator (TLSO)

Tamga in phase B (provisional); the national authority at hand-over.

| # | Rule |
|---|---|
| RB-OP-01 | Every list (`lotl`, `tl-<cc>`) **MUST** carry `operator {name, status, on_behalf_of}`; `status = "provisional"` throughout the beta. |
| RB-OP-02 | List versions **MUST** increase monotonically and carry `previous_version_hash`; no line is deleted; status changes are appended to `status_history`. |
| RB-OP-03 | `next_update` **MUST** be ≤ 90 days; the list is re-signed even without changes; changes **MUST** be published within ≤ 24 hours. |
| RB-OP-04 | The anchor log (`anchors.jsonl`) **MUST** be signed hourly (heartbeat included); every line carries `previous_hash`; no line is deleted. |
| RB-OP-05 | List signatures **MUST** use ≥ 2 overlapping certificates; rotation is announced ≥ 30 days ahead; the new key is signed with the old. (Demo deviation S-6 declared.) |
| RB-OP-06 | Root fingerprints **MUST** be published with identical values in `keys/root-fingerprints.json`, on the permanent `tamga.network/trust-anchor` page, and in the Trust Framework and contract annexes. |
| RB-OP-07 | A public `CHANGELOG.md` **MUST** be kept: who, when, what (addition / suspension / removal / authorisation), reason code. |
| RB-OP-08 | The operator **MUST NOT** hold a signing key in any service it hosts (issuer credential/status keys belong to the institution). |
| RB-OP-09 | The operator **MUST NOT** offer a hosted indexer service; it publishes a reference deployment. A hosted verifier (intermediary) may be offered; its rules are RB-OP-17. |
| RB-OP-10 | The list of hosted issuers is public; above 30 % it goes on the council's agenda (tripwire). |
| RB-OP-11 | Schema/status usage statistics are aggregate only; buckets < 50 are not published; no counters per issuer, verifier or credential; raw counters ≤ 13 months. |
| RB-OP-12 | A transparency report **MUST** be published every quarter, without delay. |
| RB-OP-13 | The domain name is held by the foundation's legal entity; transfer lock + DNSSEC; ≥ 10 years of renewal; succession agreement. |
| RB-OP-14 | OTS-first: every national list slot and ARF role slot **MUST** exist (even if empty); hand-over changes only the `operator` field; `ca_id` / `issuer_id` / `vct` **MUST NOT** change. |
| RB-OP-15 | A ledger **MUST NOT** be set up without the written acceptance of ≥ 2 independent validator operators; the transition is not complete until replay + equivalence tests pass. |
| RB-OP-16 | Published schema files (`schemas.`) **MUST** be immutable; CDN re-formatting off; registration (anchoring) **after** CDN publication. |
| RB-OP-17 | The hosted verifier **MUST** open value-returning endpoints only to the RP that opened the presentation, with an assertion signed by its trusted-list key and valid ≤ 60 s; values at most once and ≤ 5 min; not even the existence of an answer leaks to another RP; no token sent to a browser **MUST** carry the right to read values. |
| RB-OP-18 | External access to the hosted issuing service **MUST** be only with a tenant-bound, scoped API key; the key is stored on the server only as a hash and never appears in logs or audit records; a key is valid only for its own `slug`. |

## 3. RB-REG — Registrar

| # | Rule |
|---|---|
| RB-REG-01 | The Registrar **registers, it does not license**: legal authority (to award diplomas, etc.) is outside the ecosystem; the network holds only the in-network scope. |
| RB-REG-02 | Only the owner of a namespace (the state; in the beta, its stand-in) **MUST** write to national registers. |
| RB-REG-03 | A new issuer **MUST** be linked only to an `ACTIVE` root CA. |
| RB-REG-04 | Schema authorisation is an allowlist, closed by default, granted with a time window, following the "who may issue" rule of the attestation rulebook. |
| RB-REG-05 | Class and assurance (`class`, `assurance`) are recorded according to the onboarding gate; the `category` signal only for PUB/QUALIFIED. |
| RB-REG-06 | A certificate change **MUST** be recorded with a new `issuer_id` + `successor_id`; the older entry is not deleted. |
| RB-REG-07 | Removal/exit **MUST NOT** invalidate existing entries and documents; a successor may publish the status list of a `REVOKED` issuer. |
| RB-REG-08 | RPs are registered with a scope; the scope **SHOULD** pass a data-minimisation review. |
| RB-REG-09 | A register change **SHOULD** take ≤ 5 working days. |

## 4. RB-AP — Attestation Provider (Issuer)

### 4.1 Identity and keys

| # | Rule |
|---|---|
| RB-AP-01 | The issuer's identity **MUST** be an X.509 certificate chaining to the national root CA; `issuer_id` is derived from the leaf certificate fingerprint. |
| RB-AP-02 | The credential signing key **MUST** be under the institution's control (I3: HSM); it **MUST NOT** be at Tamga. Demo deviation S-1 is closed in the pilot. |
| RB-AP-03 | The status signing key **MUST** be separate from the credential key. |
| RB-AP-04 | Signatures and key proofs use ES256 (P-256) only. |

### 4.2 Issuance

| # | Rule |
|---|---|
| RB-AP-05 | Every `vct` in the metadata **MUST** be a type the issuer is authorised for in the register. |
| RB-AP-06 | In the pre-authorised flow a `tx_code` is **MUST**, sent through a **different channel** from the offer; the channel address comes only from the institution's registered data; 3 wrong attempts burn the offer. |
| RB-AP-07 | Offer URIs are single use; `on-screen` 5 min, `out-of-band` ≤ 72 h. |
| RB-AP-08 | `c_nonce` consumption is atomic; access tokens ≤ 5 min. |
| RB-AP-09 | Every batch copy **MUST** be bound to a different device key (batch of 10); the copy ↔ `idx` mapping stays with the issuer and never leaves it. |
| RB-AP-10 | Before issuing, the issuer **MUST** check the wallet's WUA against the `wallet_providers[]` list and check that the WSCD level meets the type's requirement. |
| RB-AP-11 | The issuer **MUST** ensure the identity proofing level the type requires before issuing; the binding path is written to the audit record, it **MUST NOT** be written to the credential. T3 only through the authorisation-code flow or in person. |
| RB-AP-12 | If the document subject ≠ the applicant, proof of representation (parent, proxy) is **MUST**. |
| RB-AP-13 | For a source value without a counterpart in the mapping table, issuance **MUST** stop; no guess is produced. |
| RB-AP-14 | The `category` claim only if the register class is PUB/QUALIFIED, with the same value as the register; I1–I2 **MUST NOT**. The holder level **MUST NOT** appear in any claim. |
| RB-AP-15 | After issuance the person **MUST** receive the notice "your document was added to a wallet; if this was not you …" (minimum personal data). |
| RB-AP-16 | Error responses contain no personal data; the `tx_code` is not kept outside the response. |

### 4.3 Status and revocation

| # | Rule |
|---|---|
| RB-AP-17 | The status list **MUST** be published at a fixed interval even without changes; out-of-interval "urgent" publication **MUST NOT** happen. |
| RB-AP-18 | Random `idx`; opaque URI (encodes no institution/year/cohort); lists split by nothing but type; capacity ≥ 100,000, fill ≤ 80 %; `bits = 2`; monotonic `version`. |
| RB-AP-19 | Publish to the CDN first, **then** to the anchor log / ledger (order rule); no revocation bits in the list, only the anchor. |
| RB-AP-20 | A suspended issuer **MUST NOT** publish a status list; a successor may. |
| RB-AP-21 | If the person withdraws consent, the document **MUST** be revoked. |
| RB-AP-22 | The issuer database backup takes priority over list/ledger backups; `data/<slug>` is backed up. |

### 4.4 Remote identity proofing providers

| # | Rule |
|---|---|
| RB-AP-23 | If a remote identity verification provider is used, the issuer **MUST** keep only the result summary (level, session id, time, provider); document images, face data and raw OCR data **MUST NOT** be kept in the issuer's systems. |
| RB-AP-24 | The provider's result maps to a **T level** according to the [[SPEC-ID-0003]] table; it is not passed to verifiers. |
| RB-AP-25 | An institution using the hosted service **MUST** keep its API key on its own server (not in a browser, a wallet or source code); the key rotates every 90 days (two keys overlap); on suspected leakage the institution asks for revocation. |

### 4.5 RB-AP-ID — Identity attestation provider

| # | Rule |
|---|---|
| RB-AP-ID-01 | The identity attestation provider **MUST** run remote identity verification only in its own service; institutional issuers, the wallet and verifiers **MUST NOT** talk to the IDV provider. |
| RB-AP-ID-02 | Before issuance an information notice **MUST** be shown and explicit consent obtained; without consent IDV **MUST NOT** start. |
| RB-AP-ID-03 | Personal fields **MUST NOT** be kept after issuance; images, selfies, video and raw OCR **MUST NOT** be stored; the permanent record is an opaque `subject_ref`, a hash of the document number, validity and status indexes. |
| RB-AP-ID-04 | The document **MUST** be of type `urn:tamga:id:IdentityAttestation:1`, without a `category` claim, with a status list and valid ≤ 2 years; the national identity number **MUST** be selectively disclosable. |
| RB-AP-ID-05 | A second active attestation for the same document number **MUST NOT** be issued; re-verification revokes the older one. |
| RB-AP-ID-06 | When a state PID provider is appointed, the provider **MUST** hand over its entry with `successor_id` and stop new issuance; existing documents stay valid until they expire. |
| RB-AP-ID-07 | Together with the identity attestation, the per-site pseudonym seed **MUST** be issued in a separate, non-presentable type (`urn:tamga:id:PseudonymSeed:1`); the seed is derived from the person's stable identifier with a key **separate** from the document-digest key and **MUST NOT** be stored (it is recomputed on every verification); the type **MUST NOT** appear in any RP scope. |
| RB-RP-ID-01 | An institutional issuer **MUST** receive the identity attestation only with the fields in its registered RP scope and through the full verification pipeline; it **MUST NOT** store or log matching keys. |

## 5. RB-AS — Authentic Source

| # | Rule |
|---|---|
| RB-AS-01 | The Authentic Source is named in the issuer's agreement and bound by a data processing agreement. |
| RB-AS-02 | The source → schema mapping (ISCED-F, EQF, etc.) is documented; a record without a counterpart is not issued. |
| RB-AS-03 | The national identity number is not carried into any NETWORK schema. |
| RB-AS-04 | The pilot **SHOULD NOT** place regular new work on the source institution's staff. |

## 6. RB-WP — Wallet Provider

| # | Rule |
|---|---|
| RB-WP-01 | Holder keys **MUST** be generated in the device secure element (W2) or a certified WSCD (W3); not exportable; not derived from a seed. W1 (software) **MUST NOT** be used in the pilot. Demo deviation S-9 declared. |
| RB-WP-02 | The WUA **MUST** declare the wallet version, that the key is in hardware and that PIN/biometrics are active; the WP key is in `wallet_providers[]`. |
| RB-WP-03 | Every presentation **MUST** require PIN or biometric approval. |
| RB-WP-04 | The consent screen shows the requested fields **one by one**; for requests beyond the RP scope or over-asking, a separate visual block + a delayed button **MUST** be shown. |
| RB-WP-05 | Always the same batch copy to the same verifier, a different copy to a different verifier; the disclosure set is consistent for the same verifier + `vct`. |
| RB-WP-06 | The presentation log stays on the device; it is not included in a server backup and not sent to a server. Only the person may export it, as a file encrypted with their own password (EU TS10). |
| RB-WP-07 | A backup carries only documents and the manifest, no keys; documents are re-issued on device change. The WP **MUST NOT** hold a recovery key on the user's behalf. |
| RB-WP-08 | Schemas are fetched in bulk; no request to the schema server at presentation time (**MUST NOT**). Credential re-issuance without user action only under the conditions of [[ADR-0023]]. |
| RB-WP-09 | The wallet tries to resolve the RP client identifier in the trust source; `presentation_definition` is refused; unencrypted response modes are not used; an `origin` prefix is not accepted as a client id. |
| RB-WP-10 | The wallet offers a Trust Mark / "this wallet is on the Tamga trusted list" view and a "where are my keys" explanation (**SHOULD** in the beta, **MUST** in the pilot). |
| RB-WP-11 | For a wallet-solution vulnerability the WP **MUST** be able to revoke WUAs per version; for a compromised wallet unit, per unit. |
| RB-WP-12 | People are shown "invalid" and "could not be verified / stale" differently; clear text for an already-used offer. |
| RB-WP-13 | For a request coming through an intermediary verifier, the wallet **MUST** show the actual RP's registered name, check the scope against its registration and pick the per-verifier copy by the actual RP. |

## 7. RB-RP — Relying Party (Verifier)

| # | Rule |
|---|---|
| RB-RP-01 | An RP **MUST** be registered (`relying_parties[]`), with its `dns_name` (in the access certificate's SAN) and uses `client_id = x509_hash:` in requests (HAIP 1.0 §5); it **MUST NOT** request fields beyond its scope. |
| RB-RP-02 | The request object **MUST** be signed; DCQL only; response `direct_post.jwt` (encrypted); `nonce` single use; ≤ 3 credentials and ≤ 2 `credential_sets` per request. |
| RB-RP-03 | Verification **MUST** use the canonical pipeline (T0 + A–E); `C2` (schema authorisation) cannot be skipped by any configuration; `C1/C2` look at the document's `iat`. |
| RB-RP-04 | `issuer_id` is derived from the `x5c` leaf fingerprint, not from the `iss` claim. |
| RB-RP-05 | The result is three-valued; `INDETERMINATE` **MUST NOT** be handled like `REJECTED`; the result object carries `checks_performed/skipped`. |
| RB-RP-06 | A verifier does not fetch status per verification; bulk pre-fetch; `exp/ttl` override HTTP caching. |
| RB-RP-07 | An RP runs its own indexer / `TrustSource` cache; it does not expect a hosted indexer from Tamga. |
| RB-RP-08 | Result objects and logs carry no claim values and no `idx`; audit records are kept for rejected verifications too; the HTTP status code does not encode the result. |
| RB-RP-09 | Policy is expressed as "type × issuer class"; the verifier does not expect a separate `holder_assurance` field; extra identity checks for high-risk transactions are the RP's responsibility. |
| RB-RP-10 | The reason for a refusal does not leak to the verifier (wallet side); the RP **SHOULD NOT** use wording that blames the user when a result is "could not be verified". |
| RB-RP-11 | If face matching is needed, the RP does it with an identity document / PID; diplomas and student certificates carry no photo. |
| RB-RP-12 | An RP using the hosted verifier **MUST** open the presentation from its own server with an assertion signed by its trusted-list key and read the values on its server; the page sees only the status. |
| RB-RP-13 | Website sign-in ("Sign in with Tamga") **MUST** use the per-site pseudonym as the account key; site policies **MUST NOT** request the document digest or the national ID number; the pseudonym is verified by signature, `aud`/`nonce`, site and a non-revoked wallet instance attestation (WIA). Several pseudonyms only on a site whose registration says `pseudonyms: "multiple"`. |

## 8. RB-H — Holder (the person): rights and duties

| # | Rule |
|---|---|
| RB-H-01 | Participation is voluntary; consent can always be withdrawn → the document is revoked. |
| RB-H-02 | At every presentation the person sees which fields are requested and approves them one by one; out-of-scope requests are flagged. |
| RB-H-03 | The person can see the presentation log on their device and export it as a password-protected file; the log does not leave the device in any other way. |
| RB-H-04 | The person is responsible for PIN/biometrics and device security; on device loss documents are obtained again, keys are not recovered. |
| RB-H-05 | Right to object to an "added to a wallet" notice; on objection the issuer revokes and re-issues. |
| RB-H-06 | The person has no global identifier; verifiers cannot combine presentations (per-RP copies). Issuer linkability is declared in writing as a residual risk. |
| RB-H-07 | Complaints: issuer → scheme owner → data protection authority; a complaint flow in the wallet (PROPOSAL). |

## 9. RB-SCH — Types and schemas

| # | Rule |
|---|---|
| RB-SCH-01 | Type identifier `vct = urn:tamga:<domain>:<Type>:<major>`; `vct#integrity` **MUST**; Type Metadata from the catalogue; `schema_id = keccak256(vct)`. |
| RB-SCH-02 | Published Type Metadata / JSON Schema **MUST NOT** change; minor/patch = new `metadata_url` + hash; major = new URN. |
| RB-SCH-03 | Every NETWORK schema has at least `tr-TR` + `en-US` `display`; `additionalProperties: false`; a personal-data field cannot be `sd: never`. |
| RB-SCH-04 | No NETWORK schema may contain a national identity number field. |
| RB-SCH-05 | A new domain is not opened before the seven-condition checklist (SG1–SG7) is complete; an Attestation Rulebook is published for every type. |
| RB-SCH-06 | A `DEPRECATED` schema stays verifiable; retirement decisions use aggregate statistics (buckets ≥ 50). |
| RB-SCH-07 | The `extends` chain is acyclic, ≤ 5 levels; `extends#integrity` except for the root type. |

## 10. RB-ENF — Compliance and sanctions

| # | Rule |
|---|---|
| RB-ENF-01 | Conformance vectors and commitment tests are mandatory before release; a failing component is not put into production. |
| RB-ENF-02 | Sanctions ladder: warning → narrowing authorisation → suspension → removal (+ successor) → termination. Removal does not invalidate older documents. |
| RB-ENF-03 | If a stop condition occurs in the pilot, the pilot stops; there is no "let's watch and see". Personal data written to a shared register = immediate stop. |
| RB-ENF-04 | Every shortcut taken in the beta is recorded in the deviation register; an unrecorded shortcut is a violation. |
| RB-ENF-05 | If a rule in this annex conflicts with its source document, the source prevails and this annex is corrected. |

## Appendix — Rule ↔ role matrix (summary)

| Topic | OP | REG | AP | AS | WP | RP | H |
|---|---|---|---|---|---|---|---|
| No personal data (shared registers / logs) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Reading through TrustSource | ✓ | — | ✓ | — | ✓ | ✓ | — |
| Key separation / control | ✓ | — | ✓ | — | ✓ | — | ✓ (device) |
| Cadence (list / anchor / status) | ✓ | — | ✓ | — | — | — | — |
| Identity proofing level | — | — | ✓ | — | — | (extra check) | — |
| Scope / data minimisation | — | ✓ | — | — | ✓ (warning) | ✓ | ✓ (consent) |
| Three-valued result | — | — | — | — | ✓ | ✓ | — |
| Transparency / tripwires | ✓ | — | — | — | — | — | — |

## References

The decisions, specifications and standards this document relies on are listed in Annex E.

## Change history

- **0.4.0 (2026-10-01)** — Simplified (Tamga ARF 0.7): the source columns of rule tables and in-text document references moved to Annex E; internal paths removed. Rule texts unchanged.
- **0.3.0 (2026-10-01)** — Per-site pseudonyms: new RB-AP-ID-07 (seed in a separate, non-presentable type;
  not stored) and RB-RP-13 (website sign-in uses the pseudonym as the account key; no document digest requested).
- **0.2.0 (2026-09-27)** — Annex B of Tamga ARF; RB-OP-09 corrected (G3 covers only indexers); new RB-OP-17/18,
  RB-AP-25, RB-WP-13, RB-RP-12; RB-GEN-02 covers the wallet.
- **0.1.0 (2026-09-24)** — First version: a role-based compilation of the coded invariants and beta rules BT1–BT10, accepted
  2026-09-24 (D-GOV-6).
