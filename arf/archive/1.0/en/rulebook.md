---
title: "Annex B — Tamga Rulebook"
translation_of: FW-RB-0001
source_version: 1.0.0
outline: [2, 3]
---

# Annex B — Tamga Rulebook

<div class="arf-meta">

**Document** FW-RB-0001 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-09 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

Binding, numbered rules that every role joining the Tamga network must follow: operator and list operator, registrar,
issuer, authentic source, wallet provider, verifier and holder. Every rule is derived from an invariant or a decision; this
annex creates no new rules, it gathers them by role and states them in "MUST" language. It is the counterpart of EUDI ARF
Annex 2 (High-Level Requirements).

## Rulebook structure

The Tamga [[t:rulebook|Rulebook]] holds the rules common to **every participant and every [[t:credential]] type** in the network. As in the
EUDI [[t:ARF]], each credential type has its own rulebook that branches from this one:

| Rulebook              | Credential type              | Document       |
| --------------------- | ---------------------------- | -------------- |
| Education Rulebook    | student certificate, diploma | [[FW-RB-0002]] |
| Identity Rulebook     | Tamga identity credential    | [[FW-RB-0003]] |
| Event Ticket Rulebook | event ticket                 | [[FW-RB-0004]] |

A credential type rulebook inherits every rule in this book and adds only the rules specific to its type: who issues, with
which [[t:identity-proofing]], with which attributes, for how long it is valid and how it is revoked. A new credential domain (for
example health) is added as a new rulebook once the seven-condition checklist (SG1–SG7) is complete (RB-SCH-05).

What each role does and which rules bind it is on [[FW-ROLE-0001]]; the steps of joining are on [[FW-ONB-0001]].

## 0. Reading guide

- **Rule format:** `RB-<ROLE>-<NN>` · rule text. The decisions and specifications the rules rest on are in Annex E.
- **Keywords** have their RFC 2119 meaning: **MUST**, **MUST NOT**, **SHOULD** (recommended; deviations are justified),
  **MAY**.
- **Stage note:** today the network is in the **list stage**: trust rests on signed lists and the anchor log. Rules marked
  "ledger stage" take effect when the shared ledger is set up; at that stage "list and anchor log" reads as "shared ledger".
  The rule text does not change.
- The rules add no new codes to the invariants document; they are a role-based view of its codes. To change a rule, change
  its source document.

Roles: GEN (everyone) · OP (operator, list operator — [[t:TLSO]]) · REG (registrar) · AP ([[t:issuer]]) · AS ([[t:authentic-source]]) ·
WP ([[t:wallet-provider]]) · RP ([[t:verifier]], relying party) · H ([[t:holder]]) · SCH (types and schemas).

---

## 1. RB-GEN — All participants

| #         | Rule                                                                                                                                                                                                                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-GEN-01 | A participant **MUST NOT** write personal data, credential content or credential digests to shared registers (trusted list, anchor log, shared ledger), logs or API responses.                                                                                                                                                                      |
| RB-GEN-02 | A participant **MUST** read trust data according to the verification rules of the specification: no list entry is used without checking the signature, the version chain and freshness. Using the network's open-source packages (`@tamga-network/trust`) is **SHOULD**; a participant writing its own implementation passes the conformance tests. |
| RB-GEN-03 | If the trust source is stale (`next_update` passed) or unreachable, the result **MUST** be `INDETERMINATE`/`UNKNOWN`; never `ACCEPTED`, never `REJECTED`.                                                                                                                                                                                           |
| RB-GEN-04 | On an unknown `list_format_version` or (in the ledger stage) an unknown contract version, the component **MUST** stop and raise an alarm; accepting it is forbidden.                                                                                                                                                                                |
| RB-GEN-05 | Tamga infrastructure components **MUST NOT** log IP addresses (raw, hashed or truncated). Debug logs are kept for at most 1 day and contain no IP.                                                                                                                                                                                                  |
| RB-GEN-06 | Logs and audit records may carry an attribute **name**; the attribute **value** and the revocation list position (`idx`) **MUST NOT**.                                                                                                                                                                                                              |
| RB-GEN-07 | A participant using Tamga's official `@tamga-network/*` packages **SHOULD** verify the release provenance; the packages **MUST NOT** contain a `postinstall` script.                                                                                                                                                                                |
| RB-GEN-08 | External assurance statements use eIDAS names (Low / Substantial / High; EAA, QEAA equivalent, public-sector attestation); no numeric level is shown to the user (**SHOULD**).                                                                                                                                                                      |
| RB-GEN-09 | Every participant **MUST** notify the scheme owner of a critical incident that concerns it within 4 hours at most, and of a high-severity incident within 24 hours at most.                                                                                                                                                                         |
| RB-GEN-10 | In the list stage every participant knows that registrations rest on **a single operator's signature** and that a revocation takes effect within a few minutes (publication interval + the verifier's prefetch interval); these limits are notified to people in writing.                                                                           |

---

## 2. RB-OP — Operator and list operator (TLSO)

Today Tamga is the provisional operator; at hand-over the role passes to the national authority.

| #        | Rule                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-OP-01 | Every list (`lotl`, `tl-<cc>`) **MUST** carry `operator {name, status, on_behalf_of}`; for the duration of the provisional operation, `status = "provisional"`.                                                                                                                                                                                                                                                  |
| RB-OP-02 | List versions **MUST** increase monotonically and carry `previous_version_hash`; no row is deleted, status changes are appended to `status_history`.                                                                                                                                                                                                                                                             |
| RB-OP-03 | `next_update` **MUST** be at most 90 days; the list is re-signed even without changes; a change **MUST** be published within 24 hours at most.                                                                                                                                                                                                                                                                   |
| RB-OP-04 | The anchor log (`anchors.jsonl`) **MUST** be signed hourly (also when nothing changed); each line carries `previous_hash`; no line is deleted.                                                                                                                                                                                                                                                                   |
| RB-OP-05 | Lists **MUST** be signed with at least two rolling certificates; rotation is announced at least 30 days ahead; the new key is signed with the old one.                                                                                                                                                                                                                                                           |
| RB-OP-06 | Root fingerprints **MUST** be published with identical values in `keys/root-fingerprints.json`, on the permanent page `tamga.network/trust-anchor`, in the Trust Framework and in the contract annexes.                                                                                                                                                                                                          |
| RB-OP-07 | A public change log (`CHANGELOG.md`) **MUST** be kept: who, when, what (addition, suspension, removal, authority), reason code.                                                                                                                                                                                                                                                                                  |
| RB-OP-08 | The operator **MUST NOT** hold signing keys in any service it hosts (the issuer's signing and revocation list keys belong to the institution).                                                                                                                                                                                                                                                                   |
| RB-OP-09 | The operator **MUST NOT** offer a hosted list-indexing service; it publishes the indexing software as open source. A hosted verifier (intermediary) may be offered; its rules are in RB-OP-17.                                                                                                                                                                                                                   |
| RB-OP-10 | The list of hosted issuers is public; if their share exceeds 30%, the matter goes on the council's agenda.                                                                                                                                                                                                                                                                                                       |
| RB-OP-11 | Credential type and revocation list usage statistics are kept only in aggregate; groups smaller than 50 are not published; no counters are kept per issuer, verifier or credential; raw counters are kept for at most 13 months.                                                                                                                                                                                 |
| RB-OP-12 | The transparency report **MUST** be published every three months, without delay.                                                                                                                                                                                                                                                                                                                                 |
| RB-OP-13 | Once the foundation is formed the domain name is registered to it, until then to the provisional operator; transfer lock and DNSSEC apply; it is renewed at least 10 years ahead; it is bound by the succession agreement.                                                                                                                                                                                       |
| RB-OP-14 | Organization of Turkic States first: a place **MUST** exist for every national list and every ARF role (even if empty); hand-over changes only the `operator` field; `ca_id`, `issuer_id` and `vct` **MUST NOT** change.                                                                                                                                                                                         |
| RB-OP-15 | The shared ledger **MUST NOT** be set up without the written acceptance of at least two independent ledger operators; the move is not complete until the replay of the list archive and the equivalence test have passed.                                                                                                                                                                                        |
| RB-OP-16 | Published schema files (`schemas.`) **MUST** be immutable; re-formatting on the content delivery network is switched off; the record (anchor) is made **after** publication.                                                                                                                                                                                                                                     |
| RB-OP-17 | The hosted verifier **MUST** open endpoints that return values only to the verifier that opened the presentation, with a statement signed with its key from the trusted list and valid for at most 60 seconds; values are given at most once and for at most 5 minutes; not even the existence of a response leaks to another verifier; a token sent to the browser **MUST NOT** carry the right to read values. |
| RB-OP-18 | External access to the hosted issuing service **MUST** be only with an API key bound to the institution and limited in scope; the key is stored on the server only as a digest and appears in no log or audit record; the key is valid only for that institution's account.                                                                                                                                      |

---

## 3. RB-REG — Registrar

| #         | Rule                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-REG-01 | The registrar **records, it does not approve**: legal authority (to award diplomas, etc.) lies outside the network; the network holds only the scope within the network.                  |
| RB-REG-02 | National registers **MUST** be written only by the owner of that national register (the state; today the provisional operator on behalf of the state).                                    |
| RB-REG-03 | A new issuer **MUST** be attached only to a root certificate in `ACTIVE` status.                                                                                                          |
| RB-REG-04 | Credential type authority is granted through an allow-list, closed by default; it is granted for a time window and according to the "who may issue" rule of the credential type rulebook. |
| RB-REG-05 | The registration class and assurance (`class`, `assurance`) are written according to the onboarding gate; the `category` mark only for the public and qualified classes.                  |
| RB-REG-06 | A certificate change **MUST** be recorded with a new `issuer_id` and a `successor_id`; the old entry is not deleted.                                                                      |
| RB-REG-07 | Removal or exit **MUST NOT** invalidate existing entries and credentials; the revocation list of an issuer in `REVOKED` status may be published by its successor.                         |
| RB-REG-08 | A verifier is registered with a scope; the scope goes through a data minimisation review (**SHOULD**).                                                                                    |
| RB-REG-09 | A registration change **SHOULD** be made within 5 working days.                                                                                                                           |

---

## 4. RB-AP — Issuer

### 4.1 Identity and keys

| #        | Rule                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-AP-01 | The issuer's identity **MUST** be an X.509 certificate chaining to the national root certificate; `issuer_id` is derived from the fingerprint of the leaf certificate. |
| RB-AP-02 | The credential signing key **MUST** be under the institution's control (in an HSM at I3); it **MUST NOT** be held at Tamga.                                            |
| RB-AP-03 | The revocation list signing key **MUST** be separate from the credential key.                                                                                          |
| RB-AP-04 | Signatures and key attestations use only ES256 (P-256).                                                                                                                |

### 4.2 Issuance

| #        | Rule                                                                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-AP-05 | Every `vct` in the issuer's metadata **MUST** be a type the issuer is authorised for in its registration.                                                                                                                                                      |
| RB-AP-06 | In the pre-authorised flow a transaction code (`tx_code`) is **MUST**; it is sent through **a channel separate** from the offer; the channel address comes only from the institution's registered data; after three wrong attempts the offer becomes invalid.  |
| RB-AP-07 | An offer link is single-use; an offer shown on screen is valid for 5 minutes, an offer sent through a separate channel for at most 72 hours.                                                                                                                   |
| RB-AP-08 | Consumption of the single-use value (`c_nonce`) is atomic; the access token is valid for at most 5 minutes.                                                                                                                                                    |
| RB-AP-09 | Each copy issued in a batch **MUST** be bound to a different device key (10 copies); the mapping between copy and revocation list position (`idx`) stays with the issuer and never leaves it.                                                                  |
| RB-AP-10 | **Before** issuing, the issuer **MUST** verify the wallet's wallet instance attestation ([[t:WIA]]) and key attestation (KA) against the `wallet_providers[]` list and check that the secure hardware level meets the type's requirement.                      |
| RB-AP-11 | Before issuing, the issuer **MUST** ensure the identity proofing level the type requires; the binding path is written to the audit record and **MUST NOT** be written to the credential. T3 is achieved only through the authorisation code flow or in person. |
| RB-AP-12 | If the credential subject differs from the applicant, proof of representation **MUST** be given (parent, proxy).                                                                                                                                               |
| RB-AP-13 | Issuance **MUST** stop for a source value that has no match in the mapping table; no guesses are made.                                                                                                                                                         |
| RB-AP-14 | The `category` attribute is written only if the registration class is public or qualified, and with the same value as the registration; at I1–I2 it **MUST NOT**. The holder's identity proofing level **MUST NOT** appear in any attribute.                   |
| RB-AP-15 | After issuance a "your credential was added to a wallet; if this was not you …" notice **MUST** be sent to the person (with minimal personal data).                                                                                                            |
| RB-AP-16 | Error responses contain no personal data; the transaction code is not stored outside the response.                                                                                                                                                             |

### 4.3 Revocation list

| #        | Rule                                                                                                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-AP-17 | The revocation list **MUST** be published at a fixed interval, also without changes; "urgent" publication outside the interval **MUST NOT** happen.                                                                                            |
| RB-AP-18 | The position (`idx`) is random; the address is opaque (it encodes no institution, year or group); lists are split by no criterion other than type; capacity at least 100,000, fill at most 80%; `bits = 2`; `version` increases monotonically. |
| RB-AP-19 | Publication goes first to the content delivery network, **then** to the anchor log (in the ledger stage, the shared ledger); there is no revocation bit in the list, only the anchor.                                                          |
| RB-AP-20 | A suspended issuer **MUST NOT** publish a revocation list; its successor may.                                                                                                                                                                  |
| RB-AP-21 | If the person withdraws consent, the credential **MUST** be revoked.                                                                                                                                                                           |
| RB-AP-22 | The issuer **MUST** back up its credential records and the revocation list mapping regularly; this backup takes priority over the shared list or ledger backup, because revocation is only possible with these records.                        |

### 4.4 Remote identity verification providers

| #        | Rule                                                                                                                                                                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-AP-23 | If a remote identity verification provider is used, the issuer **MUST** store only the result summary (level, session identifier, time, provider); document images, face data and raw OCR data **MUST NOT** be kept in the issuer's system.                     |
| RB-AP-24 | The provider's result is mapped to a **T level**; the mapping follows the table in [[SPEC-ID-0003]]; the level is not passed to the verifier.                                                                                                                   |
| RB-AP-25 | An institution using the hosted service **MUST** keep its API key on its own server (not in a browser, wallet or code); the key is renewed every 90 days (two keys are valid together for a while); on suspicion of a leak the institution requests revocation. |

### 4.5 RB-AP-ID — Identity credential provider

| #           | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-AP-ID-01 | The identity credential provider **MUST** carry out remote identity verification only in its own service; institutions' issuing services, the wallet and the verifier **MUST NOT** talk to the remote identity verification provider.                                                                                                                                                                                                                                     |
| RB-AP-ID-02 | Before issuance the information notice **MUST** be shown and explicit consent obtained; without consent, identity verification **MUST NOT** start.                                                                                                                                                                                                                                                                                                                        |
| RB-AP-ID-03 | Personal attributes **MUST NOT** be kept after issuance; images, selfies, video and raw OCR data **MUST NOT** be stored; the permanent record is only the opaque `subject_ref`, the digest of the document number, the validity period and the revocation list positions.                                                                                                                                                                                                 |
| RB-AP-ID-04 | The credential **MUST** be of type `urn:tamga:id:IdentityAttestation:1`, without a `category` attribute, with a revocation list and valid for at most 2 years; the national identity number **MUST** be selectively disclosable.                                                                                                                                                                                                                                          |
| RB-AP-ID-05 | A second active identity credential **MUST NOT** be issued for the same document number; re-verification revokes the earlier one.                                                                                                                                                                                                                                                                                                                                         |
| RB-AP-ID-06 | When the state's PID Provider is appointed, the provider **MUST** hand over its entry with `successor_id` and stop issuing; existing credentials remain valid until they expire.                                                                                                                                                                                                                                                                                          |
| RB-AP-ID-07 | Together with the identity credential, a per-site [[t:pseudonym]] seed **MUST** be issued in a separate type that cannot be presented (`urn:tamga:id:PseudonymSeed:1`); the seed is derived from the person's unchanging identity with a key **separate** from the credential digest key and **MUST NOT** be stored (it is recomputed at every verification); this type **MUST NOT** appear in any verifier's scope.                                                      |
| RB-AP-ID-08 | Driving licence information (`urn:tamga:id:DrivingLicenceAttestation:1`) **MUST NOT** use the official mDL docType or namespace and **MUST** state in its metadata, in the always-visible `not_official_licence` claim, on its card and in the verification result that it is not a substitute for an official driving licence; the national ID number, restriction or health codes, photo and address **MUST NOT** be carried; the document number is a keyed hash only. |
| RB-AP-ID-09 | Driving licence information **MUST** be issued only upon presentation of an active Tamga identity credential from the wallet and only if the name and date of birth on the card match that identity; it **MUST NOT** be issued if the categories cannot be read or the card has expired; its validity **MUST NOT** exceed the card's expiry or one year from the day the card was inspected; its format is SD-JWT VC only.                                                |
| RB-AP-ID-10 | When the linked identity credential is revoked, re-issued or erased, the driving licence information **MUST** be revoked or erased; once a country's competent authority starts issuing digital driving licences, this type **MUST NOT** be re-issued for that country.                                                                                                                                                                                                   |
| RB-AP-ID-11 | For zero-knowledge presentation the ZK copy **MUST** be issued as a separate type (`urn:tamga:id:ShortLivedIdentityAttestation:1`), valid for at most 24 hours and without a revocation list entry; it carries only elements that can be proven with ZK; it **MUST NOT** be issued while the main identity credential is revoked or suspended. The refresh token **MUST NOT** leave person fields on the server (only in the token, in a form only the service can open). |

---

## 5. RB-AS — Authentic source

| #        | Rule                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| RB-AS-01 | The authentic source is named in the issuer's agreement and bound by a data processing agreement.                                  |
| RB-AS-02 | The mapping of source data to the schema (ISCED-F, EQF, etc.) is documented; no credential is issued for a record without a match. |
| RB-AS-03 | The national identity number is not carried into any network-wide shared schema.                                                   |
| RB-AS-04 | The pilot does not place regular new work on the source institution's staff (**SHOULD**).                                          |

---

## 6. RB-WP — Wallet provider

| #        | Rule                                                                                                                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-WP-01 | The holder's keys **MUST** be generated in the device's secure area (W2) or in certified secure hardware (W3); they cannot be exported and are not derived from a seed. Credentials **MUST NOT** be issued to a wallet with software keys (W1).             |
| RB-WP-02 | The wallet instance attestation (WIA) **MUST** state the wallet version, that the key is in hardware and that PIN or biometrics are active; the wallet provider's key is in the `wallet_providers[]` list.                                                  |
| RB-WP-03 | Every presentation **MUST** require PIN or biometric approval.                                                                                                                                                                                              |
| RB-WP-04 | The consent screen shows the requested attributes **one by one**; for requests beyond the verifier's scope or excessive requests, a separate visual block and a delayed button are **MUST**.                                                                |
| RB-WP-05 | The same copy is always shown to a given verifier and a different copy to a different verifier; the attributes disclosed to the same verifier for the same type are consistent.                                                                             |
| RB-WP-06 | The presentation log stays on the device; it is not included in server backups and is never sent to a server. Only the person can export it, as a file encrypted with their own password (EU TS10).                                                         |
| RB-WP-07 | A backup carries only the credentials and their lists, not keys; on a device change the credentials are issued again. The wallet provider **MUST NOT** hold a recovery key on the user's behalf.                                                            |
| RB-WP-08 | Schemas are fetched in bulk; requests to the schema server **MUST NOT** be made at presentation time. Credentials are refreshed without user action only under the conditions of [[ADR-0023]].                                                              |
| RB-WP-09 | The wallet tries to resolve the verifier's client identifier in the trust source; `presentation_definition` is rejected; unencrypted response modes are not used; an `origin` prefix is not accepted as a client identifier.                                |
| RB-WP-10 | The wallet **MUST** offer the "this wallet is in the Tamga trusted list" view (trust mark) and a "where are my keys" explanation.                                                                                                                           |
| RB-WP-11 | If a flaw is found in a wallet solution, the wallet provider **MUST** be able to revoke wallet attestations by version; on a breach of a single wallet unit it revokes that unit.                                                                           |
| RB-WP-12 | "Invalid" and "cannot be verified / stale" are shown differently to the user; a used offer gets a clear message.                                                                                                                                            |
| RB-WP-13 | For a request coming through an [[t:intermediary]] verifier, the wallet **MUST** show the registered name of the actual verifier, check the scope against that verifier's registration and separate the per-verifier copy according to the actual verifier. |

---

## 7. RB-RP — Verifier (relying party)

| #           | Rule                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-RP-01    | A verifier **MUST** be registered (`relying_parties[]`) with the domain name in its access certificate (`dns_name`); requests use `client_id = x509_hash:` (HAIP 1.0 §5); it **MUST NOT** request attributes beyond its scope.                                                                                                                                                                       |
| RB-RP-02    | The request object **MUST** be signed; only the DCQL query language is used; the response comes with `direct_post.jwt` (encrypted); the single-use value (`nonce`) is unique; one request asks for at most 3 credentials and 2 credential sets.                                                                                                                                                      |
| RB-RP-03    | Verification **MUST** use the canonical verification pipeline of the specification (freshness of the trust source, then steps A–E: signature, issuer, credential type authority, revocation, wallet binding). The credential type authority check cannot be skipped by any configuration; the issuer and type authority checks look at the credential's issue date (`iat`).                          |
| RB-RP-04    | `issuer_id` is derived from the fingerprint of the `x5c` leaf certificate, not from the `iss` attribute.                                                                                                                                                                                                                                                                                             |
| RB-RP-05    | The result has three values; `INDETERMINATE` **MUST NOT** be handled like `REJECTED`; the result object carries the checks performed and skipped (`checks_performed`, `checks_skipped`).                                                                                                                                                                                                             |
| RB-RP-06    | A verifier does not fetch revocation lists at every verification; it fetches them in bulk ahead of time; `exp` and `ttl` take precedence over the HTTP cache.                                                                                                                                                                                                                                        |
| RB-RP-07    | A verifier runs its own list indexer or trust source cache; it does not expect a hosted indexing service from Tamga.                                                                                                                                                                                                                                                                                 |
| RB-RP-08    | The result object and logs carry no attribute values and no revocation list positions; an audit record is also kept for rejected verifications; the HTTP status code does not encode the result.                                                                                                                                                                                                     |
| RB-RP-09    | Policy is expressed as "credential type × issuer class"; a verifier does not expect a separate holder assurance field; additional identity checks for high-risk transactions are the verifier's responsibility.                                                                                                                                                                                      |
| RB-RP-10    | The reason for a rejection does not leak to the verifier (wallet side); a verifier **SHOULD NOT** use wording that blames the user when the result is "cannot be verified".                                                                                                                                                                                                                          |
| RB-RP-11    | If face matching is needed, the verifier does it with an identity credential or PID; diplomas and student certificates carry no photo.                                                                                                                                                                                                                                                               |
| RB-RP-12    | A verifier using the hosted verifier **MUST** open the presentation from its own server with a statement signed with its key from the trusted list, and read the values on its own server; the page sees only the status.                                                                                                                                                                            |
| RB-RP-13    | Signing in to a website ("Sign in with Tamga") **MUST** use the per-site pseudonym as the account key; site policies **MUST NOT** request a credential digest or identity number; the pseudonym is verified with the signature, `aud` and `nonce`, the site and an unrevoked wallet instance (WIA). Several pseudonyms are used only on a site whose registration contains `pseudonyms: "multiple"`. |
| RB-RP-ID-01 | An institution that receives the identity credential to match it with its own records (including an issuing service) **MUST** receive it only with the attributes in its registered verifier scope and through the full verification pipeline; it **MUST NOT** store or log the matching keys.                                                                                                       |

---

## 8. RB-H — Holder (the person): rights and obligations

| #       | Rule                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-H-01 | Participation is voluntary; consent can be withdrawn at any time, in which case the credential is revoked.                                                                            |
| RB-H-02 | At every presentation the person sees which attributes are requested and approves them one by one; out-of-scope requests are flagged.                                                 |
| RB-H-03 | The person can view the presentation log on their device and export it as a password-protected file; the log leaves the device in no other way.                                       |
| RB-H-04 | The person is responsible for the PIN, biometrics and device security; on device loss the credentials are obtained again, the key is not recovered.                                   |
| RB-H-05 | The person has the right to object to the "your credential was added to a wallet" notice; on objection the issuer revokes the credential and issues it again.                         |
| RB-H-06 | The person has no global identifier; verifiers cannot combine presentations (a separate copy per verifier). Linkability on the issuer side is notified in writing as a residual risk. |
| RB-H-07 | Complaints: issuer → scheme owner → the KVKK authority. The wallet **SHOULD** show this path to the person.                                                                           |

---

## 9. RB-SCH — Types and schemas

| #         | Rule                                                                                                                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RB-SCH-01 | The type identifier is `vct = urn:tamga:<domain>:<Type>:<major>`; `vct#integrity` is **MUST**; the type definition (Type Metadata) comes from the catalogue; in the ledger stage the schema identifier is computed as `schema_id = keccak256(vct)`. |
| RB-SCH-02 | A published type definition or JSON Schema **MUST NOT** change; minor and patch versions mean a new `metadata_url` and digest, a major version means a new URN.                                                                                     |
| RB-SCH-03 | Every network-wide shared schema carries at least `tr-TR` and `en-US` display information; `additionalProperties: false`; a personal data attribute cannot be `sd: never`.                                                                          |
| RB-SCH-04 | No network-wide shared schema may contain a national identity number attribute.                                                                                                                                                                     |
| RB-SCH-05 | A new domain is not opened until the seven-condition checklist (SG1–SG7) is complete; a rulebook is published for each type (for example the Education Rulebook).                                                                                   |
| RB-SCH-06 | A schema in `DEPRECATED` status remains verifiable; the retirement decision is made with aggregate statistics (groups of at least 50).                                                                                                              |
| RB-SCH-07 | The `extends` chain is acyclic and at most 5 levels deep; `extends#integrity` is mandatory except for the root type.                                                                                                                                |

---

## 10. RB-ENF — Conformance and enforcement

| #         | Rule                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RB-ENF-01 | Conformance vectors and commitment tests are mandatory before release; a component that fails them is not taken into production.                                         |
| RB-ENF-02 | Sanctions ladder: warning → narrowing of authority → suspension → removal (with a successor appointed) → termination. Removal does not invalidate earlier credentials.   |
| RB-ENF-03 | If a stop condition arises in the pilot, the pilot stops; there is no "let's watch and see". Writing personal data to a shared register is a reason to stop immediately. |
| RB-ENF-04 | Every deviation from these rules is kept in the operator's deviation record with its reason and closing date; an unrecorded deviation is a breach.                       |
| RB-ENF-05 | If an item of this Rulebook conflicts with its source document, the source prevails and the Rulebook is corrected.                                                       |

---

## Table — Rules by role (summary)

| Topic                                                | OP  | REG | AP  | AS  | WP          | RP                 | H           |
| ---------------------------------------------------- | --- | --- | --- | --- | ----------- | ------------------ | ----------- |
| No personal data (shared registers and logs)         | ✓   | ✓   | ✓   | ✓   | ✓           | ✓                  | —           |
| Reading trust data per the specification             | ✓   | —   | ✓   | —   | ✓           | ✓                  | —           |
| Key separation and control                           | ✓   | —   | ✓   | —   | ✓           | —                  | ✓ (device)  |
| Publication interval (list, anchor, revocation list) | ✓   | —   | ✓   | —   | —           | —                  | —           |
| Identity proofing level                              | —   | —   | ✓   | —   | —           | (additional check) | —           |
| Scope and data minimisation                          | —   | ✓   | —   | —   | ✓ (warning) | ✓                  | ✓ (consent) |
| Three-valued result                                  | —   | —   | —   | —   | ✓           | ✓                  | —           |
| Transparency and threshold alerts                    | ✓   | —   | —   | —   | —           | —                  | —           |

## References

The decisions, specifications and standards this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (2 October 2026).
