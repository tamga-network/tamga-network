---
document_id: SPEC-TRUST-0001
title: "Trust lists"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-07
summary: >
  The normative format of the signed, versioned and hash-chained trust lists (lotl.jws, tl-{cc}.jws) that are the trust anchor
  of today's (chainless) stage, and of the hourly anchor log (anchors.jsonl): publication cadence, key discipline, TDT-first
  slots, record lifecycle and the rules of equivalence with the chain. Every field maps to a SPEC-BC-0001 contract record;
  reading is done only through the TrustSource interface.
translation_of: SPEC-TRUST-0001
source_version: 1.0.0
---

# In brief

This document describes the format of Tamga Network's [[t:trust-list|trust lists]]: which institution may issue which
credential, what each [[t:verifier]] may ask for, and how all of this is signed and published. It is written for the
verifiers and wallets that read the lists and for the operator that runs them.

**When to read**

- Read the concept page [Trust lists and federation](/concepts/trust-lists) first.
- To read the lists in code, go to the guide [[GUIDE-0006]].
- The structure of institution certificates is not here: [[SPEC-ID-0002]].

**Plain explanation**

The network's trust lives in three files. `lotl` ([[t:LOTL]]) is the list of lists and points to the other lists; national
lists such as `tl-tr` enumerate institutions, verifiers and [[t:wallet-provider|wallet providers]]; the anchor log
(`anchors.jsonl`) records changes to [[t:status-list|status lists]] and schemas in time order. Every list is signed, every
version is linked to the previous one and the version number only grows; an old version cannot be served again. The lists
contain no personal data. Lists run by other operators can also be recognised, within a limited scope ([[t:federation]]).
Once at least two independent operators join, the same data moves to a ledger (chain); wallets and verification are not
affected.

---

# Scope

This specification is the normative implementation of [[ADR-0009]] K2: it defines the **list** format that carries the trust
records until the chain is set up (≥2 independent validator operators). When the chain is set up, the same data is replayed
into the contracts (§7); credentials, wallets and the verification pipeline do not change. The canonical field names are taken
from [[SPEC-BC-0001]] and the SQL projection in [[ARCH-0003]] §2.4. No list contains personal data (DP1).

---

# 1. Principles

1. **Every field maps to a contract record** (§7); a list is the single-signer special case of the chain.
2. **No personal data** — only institution names, certificate fingerprints, statuses, dates, URIs and identifier derivations.
3. **Version + hash chain** — `version` is monotonic, `previous_version_hash = sha256(<previous .jws>)`; nothing is deleted;
   status changes are appended to `status_history`.
4. **Signature** — every list is a compact JWS (`.jws`; `alg: ES256`, `x5c` operator certificate); the `.json` is for humans
   only. Verifiers use only the `.jws`; they match the `x5c[0]` fingerprint against `keys/root-fingerprints.json` (lotl) or
   `lotl.national_lists[].signing_keys` (tl).
5. **ETSI mapping** — statuses use the Tamga enum; the ETSI TS 119 612 XML projection is produced with the table in
   [[SPEC-ID-0002]] §8.1 (`granted`/`withdrawn`/`TakenOverBy`).
6. **Cadence** — `lotl`/`tl-<cc>`: `next_update` ≤ 90 days, re-signed even without changes; a change is published within
   24 hours; `anchors.jsonl` hourly (heartbeat included).
7. **Type identifier** — [[t:vct]] URN ([[ADR-0010]]); the `lotl.schemas[]` catalogue entry gives `metadata_url + content_hash`.
8. **Category signal** — institution `class: PUB | QUALIFIED | EAA` ([[t:EAA]]; [[ADR-0010]] K5).
9. **TDT-first** — `lotl` + a national list slot for every member state, the full ARF role set, `operator.on_behalf_of`;
   a hand-over changes only the `operator` field; `ca_id`/`issuer_id`/`vct` are fixed (D-GOV-5).

---

# 2. File layout (`https://trust.tamga.network/`)

```
lotl.jws · lotl.json          list of lists + NETWORK schemas + wallet providers + categories
tl-tr.jws · tl-tr.json        TR national list (root_cas, issuers, relying_parties, national_schemas)
tl-<cc>.jws (RESERVED)        AZ/KZ/KG/UZ (members), HU/TM (observers) — slot
anchors.jsonl                 anchor log (one line = one JWS)
keys/root-fingerprints.json   LOTL signing certificate and national root fingerprints (= tamga.network/trust-anchor);
                              explanation in the note field
keys/<name>.cert.pem          only certificates the list references (operator/root/registrar/wallet-provider/rp; published)
wrprc/index.json · wrprc/…    registration certificates (ETSI TS 119 475 rc-wrp+jwt) and their index (ADR-0026)
lote/<type>.json · .jws       ETSI TS 119 602 LoTE views (wallet-providers, wrpac-providers, eaa-providers);
                              only when LoTE publication is enabled (lote.enabled)
archive/<file>.v<NNNN>.jws    immutable version archive (replay input)
CHANGELOG.md                  public change log
```

---

# 3. `lotl` — the list of lists

| Field | Type | Meaning / contract counterpart |
|---|---|---|
| `list_format_version` | string | Format version; unknown → the verifier **stops** (CMP2) |
| `list_type` | `"lotl"` | |
| `environment` | `"production"` \| `"sandbox"` (optional; absent means `production`) | The network the list belongs to ([[ADR-0038]]). The test network's list carries `sandbox`; the loader **stops** on a list that does not match the network it expects (`ADR-0038/SB2`) |
| `version`, `issued_at`, `next_update`, `previous_version_hash` | | Version/hash chain (§1.3, §1.6) |
| `operator` | `{name, status: "provisional", on_behalf_of, trust_framework, transparency_report?}` | Founding proxy; `trust_framework` = URL of [[FW-TF-0001]] (`https://arf.tamga.network/trust-framework`); `transparency_report` is optional, added once its page is published |
| `catalogue` | `{url}` | Type Metadata resolution path (`schemas.tamga.network/v1/catalogue.json`) |
| `anchor_signing_keys[]` | `{fingerprint_sha256, cert_ref, status}` | Anchor log signers (≥2, rolling — TL3) |
| `national_lists[]` | `{state_code, status: ACTIVE\|RESERVED, membership, list_url, operator, roles{registrar, tlso, pid_provider, access_ca, national_root_ca}, signing_keys[], recognition{mode, recognizes[]}}` | `Governance` member list + `CrossRecognition` |
| `schemas[]` | `{schema_id, vct, metadata_url, content_hash, content_hashes[], layer: NETWORK, governance, status, registered_at, status_history[]}` | `SchemaRegistry` (NETWORK); `registered_at` is **permanent** (time of the first anchor); `content_hashes` = digests of the valid versions ([[ADR-0010]] K4; in the development stage only the current digest, [[ADR-0029]]), each anchored once |
| `eaa_categories` | `{urn → description}` | Category namespace ([[ADR-0010]] K5) |
| `wallet_providers[]` | `{provider_id, legal_name, wua_signing_keys[], solutions[{solution_id, min_version, status, security_level}], status}` | WUA trust anchor (R-7; not yet on the chain — ADR candidate). `status` (of the entry and of `solutions[].status`) is from the `Status` set: `ACTIVE \| SUSPENDED \| REVOKED \| RETIRED \| ROLLING_OVER \| RESERVED \| PROVISIONAL \| DEPRECATED`. WUA validation uses only the `ACTIVE` keys of an `ACTIVE` entry. A `RESERVED` entry holds a place (e.g. a wallet provider whose operator has not yet supplied its own certificate, [[ADR-0042]]): `wua_signing_keys` may be empty and it is not used for WUA validation. `security_level` is the wallet assurance level ([[SPEC-WALLET-0001]] §2.2; W1 is not supported (except the test key for the network's own trial scenes in the sandbox list — [[ADR-0042]] K5)) |
| `zk_circuits[]` | `{circuit_id, system, version, attributes, sha256, status}` | Accepted ZK circuits ([[ADR-0032]] ZK2; not yet on the chain) |
| `pid_providers[]` | empty, reserved | BT8 → TL8 |

---

# 4. `tl-<cc>` — national list

| Field | Meaning / contract counterpart |
|---|---|
| `state_code`, `version`, `issued_at`, `next_update`, `previous_version_hash`, `operator`, `environment` | Namespace = state; signed only with that namespace's key (the list-stage reading of N1); `environment` is checked with the same rule as in the LOTL |
| `root_cas[]` `{ca_id, legal_name, cert_fingerprint_sha256, cert_pem, service_type, operator, status: ACTIVE\|ROLLING_OVER\|RETIRED\|REVOKED, valid_from/until, successor_ca_id, status_history[]}` | `RootCARegistry` (CA1–CA3); `ca_id = keccak256(cc ‖ SHA-256(rootDER))` |
| `issuers[]` `{issuer_id, slug, legal_name, category, assurance: I1..I3, class: PUB\|QUALIFIED\|EAA, assurance_basis, parent_ca_id, cert_fingerprint_sha256, issuer_url, status_list_base, status, valid_from/until, successor_id, status_history[], schema_authorizations[{schema_id, vct, allowed, valid_from, valid_until}], delegate_keys[], authentic_source, test_institution?}` | `IssuerRegistry` (I1–I4, R1–R2); `issuer_id = keccak256(cc ‖ SHA-256(leafDER))`; authorisation is **time-windowed** (I3). `test_institution: true` only in the sandbox list: a test institution opened by self-service in the sandbox ([[ADR-0041]]; its certificate comes from the sandbox intermediate CA and its credentials carry the leaf + intermediate chain); never in the real network's list |
| `relying_parties[]` `{rp_id, client_id, dns_name, legal_name, access_cert_fingerprint_sha256, status, registered_at, scopes[{scope_id, purpose, purpose_localized?, vct, claims[], valid_from, valid_until}], status_history[]}` | `RelyingPartyRegistry`; `client_id` = the OpenID4VP client identifier `x509_hash:` (computed by the publisher from the access certificate; [[ADR-0034]]), `dns_name` = permanent registration identifier (SAN); `scopes[]` = the ARF registration certificate counterpart (AP6). **Registration data ([[ADR-0024]]):** optional `trade_name`, `identifiers[]`, `postal_address`, `info_uri`, `contact`, `service_description`, `is_public_sector_body`, `entitlements[]`, `supervisory_authority`, `uses_intermediaries[]` / `served_relying_parties[]`, `scopes[].privacy_policy_uri`; `issuers[]` carry the same identity/contact fields and `entitlements` derived from their class. The publisher does not publish a participant registered on or after 2026-09-30 with a mandatory field missing. **Registration certificates ([[ADR-0026]]):** for every valid use and every issuer the publisher produces an ETSI TS 119 475 `rc-wrp+jwt` under `wrprc/` (index `wrprc/index.json`; registrar key in LOTL `national_lists[].roles.registrar.signing_keys`); `sub` = the semantic identifier from `identifiers[]` (`VATTR-`, `NTRTR-`). |
| `national_schemas[]` | `SchemaRegistry` (NATIONAL) |

Status vocabulary: `ACTIVE | SUSPENDED | REVOKED | RETIRED` (+ root: `ROLLING_OVER`). History is never deleted; verification
looks at `status_history` with the credential's `iat` (D-BC-3, [[SPEC-BC-0001]]/I2–I3). The list of a `REVOKED` institution
may be published by its successor (`successor_id`) (I4). Operator tool: `trust-publisher status <slug> <STATUS> --reason r`
(`REVOKED --invalidates-from <date>`: credentials issued from that moment fail; `valid_from` = all of the institution's credentials),
`rp-status <dns_name> <STATUS>` for a relying party, `end-use <dns_name> <id>` for a single use or gate group (end date).
A record is never removed from the list (TL2); a withdrawn institution becomes `withdrawn` in the ETSI projection and leaves the LoTE.

---

# 5. `anchors.jsonl` — anchor log

Every line is an independent JWS; payload `{seq, previous_hash, ts, kind, …}`:

| `kind` | Fields | Contract counterpart |
|---|---|---|
| `status_list` | `list_id, issuer_id, list_uri, content_hash, list_version, published_at` | `StatusListRegistry.publishList` (list-stage reading of S1/S4, L1) |
| `schema` | `schema_id, vct, content_hash` | `SchemaRegistry` contentHash (D8: **after** the CDN publication) |
| `heartbeat` | — | Hourly cadence (S5 logic on the operator side) |
| `checkpoint` | `archive: { file, sha256, seq_from, seq_to, lines }`, `state: { status_lists[], schemas[] }` | Archive checkpoint (TL12); `state` = the final state produced by the archived lines |

Rules: ≥1 line per hour; `list_version` is monotonic per institution (L1/S3); the verifier compares `content_hash` with the
Status List Token hash in D5; lines are never deleted; the log is public; `list_uri` is opaque (S8).

**Archiving and checkpoints (TL12).** As the log grows, load time grows linearly with the number of lines (each line is one
JWS verification). When the log passes a threshold (500 lines by default), the operator moves **all** current lines into
`archive/anchors-<from>-<to>.jsonl` (if an archive with that name but different content already exists — e.g. after a sandbox reset restarted seq at 0 — a time suffix is added: `anchors-<from>-<to>-<epoch_ms>.jsonl`; the old archive is never overwritten) and writes a signed `checkpoint` as the first line of the new log: `seq = seq_to + 1`,
`previous_hash = sha256(last line of the archive)`, `archive.sha256 = sha256(archive file)` and **`state`** — the final state
produced by the archived lines (the status anchor with the highest `list_version` per list + the schema anchors). The next
anchor links to the checkpoint as usual; the chain is unbroken and no line is deleted (TL2). The loader: if the first line is
a `checkpoint`, it verifies its signature (anchor signing key), checks that `seq` is `seq_to + 1`, **applies `state` to the
store (rejects it if missing)** and continues the chain from there; a `checkpoint` produces no record in `TrustSource`. A
`checkpoint` seen in the middle is an ordinary line (in a full-history load). Full history (TL10 replay,
`trust:verify --full`): checkpoints are followed backwards, every archive's hash is verified and the chain is loaded from
seq 0. Load cost thus stays bounded by the current slice; archives remain public.

---

# 6. Loader and `TrustSource` (verifier side)

`@tamga-network/trust` `loadTrustSet` order: `lotl.jws` signature (root fingerprints) → `tl-<cc>.jws` signatures
(`signing_keys`) → format (`list_format_version`) → hash chain → `next_update` → `anchors.jsonl` chain → in-memory
projection (the tables of [[ARCH-0003]] §2.4). After signature and format, `environment` is compared with the expected network (default `production`); a wallet or verifier that connects to the test network expects `sandbox` and is pinned only to the test network's root ([[ADR-0038]]). `ListTrustSource` then offers the read set of [[SPEC-BC-0001]] §11.2:
`isCredentialAcceptable(issuerId, iat)`, `isCredentialSchemaAcceptable(issuerId, schemaId, iat)`, `isRecognizedBy`,
`schemaContentHash`, `statusAnchor`, `relyingParty`, `issuer`, `schema`, `isWalletProviderKey`, `freshness()`.
Three-valued answer: `YES | NO | UNKNOWN`; `UNKNOWN` → INDETERMINATE (CMP4). Services reload the list periodically
(issuer service `TAMGA_TRUST_RELOAD_SEC`, verifier `TAMGA_VERIFY_TRUST_RELOAD_SEC`).

---

# 7. Contract mapping and moving to the chain

| List field | Contract call |
|---|---|
| `root_cas[]` | `RootCARegistry.registerRootCA / rollover / retire / revoke` |
| `issuers[]` | `IssuerRegistry.registerIssuer / suspend / revoke(revokedAt) / setSuccessor` |
| `issuers[].schema_authorizations[]` | `IssuerRegistry.setSchemaAuthorization(issuerId, schemaId, from, until)` |
| `lotl.schemas[]` | `Governance` proposal → `SchemaRegistry.registerSchema(vct, contentHash, NETWORK)` |
| `relying_parties[]` | `RelyingPartyRegistry.register / setScope` |
| `anchors kind=status_list` | `StatusListRegistry.publishList(listId, uri, hash, version)` |
| `anchors kind=schema` | `SchemaRegistry` contentHash |
| `wallet_providers[]` | not yet on the chain — ADR candidate |
| `zk_circuits[]` | not yet on the chain — a `Governance` record in the chain stage (ADR candidate) |

Migration: the `archive/` versions are replayed in order as contract calls; the migration is not complete until
`TrustSource(list)` and `TrustSource(chain)` give the same answers to the `conformance/vectors/trust` queries (TL10;
[[ADR-0009]] K7). Hand-over: only the `operator` field changes.

---

# 8. Invariants

| # | Invariant |
|---|---|
| **TL1** | Every list has `operator.status`, which is `"provisional"` throughout the list stage; `on_behalf_of` is never left empty. |
| **TL2** | List and anchor log versions increase monotonically; every version carries the hash of the previous one; no line/record is deleted (status changes are appended to `status_history`). |
| **TL3** | Lists and anchors are signed with ≥2 rolling certificates; a rotation is announced ≥30 days in advance; the new key is signed with the old one. (Demo deviation S-6 declared.) |
| **TL4** | No component other than `TrustSource` interprets the list files. |
| **TL5** | Verification with a list whose `next_update` has passed, or that cannot be reached, produces **INDETERMINATE**; never ACCEPTED, never REJECTED. |
| **TL6** | A loader that sees an unknown `list_format_version` stops and raises an alarm; it does not accept. |
| **TL7** | A national list is signed only by that namespace's signing key; operator proxy is declared with `operator.on_behalf_of`. |
| **TL8** | Tamga does not issue PID; `pid_providers[]` is empty throughout the list stage. Tamga's provisional identity attestation ([[ADR-0011]]) is an `issuers[]` record (`category: IDENTITY`, `class: QUALIFIED`) and is superseded with `successor_id` once a state PID provider is appointed. |
| **TL9** | A schema's `registered_at` and `status_history.since` are permanent; a rebuild cannot change them (time of the first anchor). |
| **TL10** | Moving to the chain is not complete until the replay of the list archive and the equivalence test pass. |
| **TL11** | No list, anchor log or change log contains personal data, credentials or credential hashes. |
| **TL12** | The anchor log is archived only with a signed `checkpoint`: archived lines remain under `archive/` (not deleted), the checkpoint links to the archive's last line with `previous_hash` and to the archive file with `archive.sha256`, and carries the **final state (`state`)** produced by the archived lines; the loader does not continue the chain without verifying the signature of the checkpoint in the first line, the condition `seq = seq_to + 1` and the presence of `state`; archiving never lowers the visibility of a list or schema; the full history can always be rebuilt from the archives (TL10). |

---

# Security and privacy notes

- Known weakening ([[ADR-0009]] K3): the anchor relies on a single operator signature; if the operator and an institution act
  together, equivocation is possible — the public log, the `CHANGELOG`, the quarterly transparency report (G8) and independent
  audit deter this. Pilot limitations statement, items 5–6.
- `list_uri` is opaque; `status_anchors` do not encode the institution or cohort (S8). IP addresses are not logged (G2).

# Open issues

1. Chain counterpart of `wallet_providers[]` (ADR candidate).
2. ETSI 119 612 XML/XAdES projection generator (`apps/trust-publisher export-etsi`) — before the state stage.
3. ≥2 rolling certificates (S-6) and the signing key in a KMS — before the pilot.

# Related documents

[[ADR-0009]] · [[ADR-0010]] · [[SPEC-BC-0001]] · [[SPEC-ID-0002]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] ·
[[ARCH-0003]] · [[FW-ARF-0001]] · [[FW-RB-0001]]

# Status

**In force** — version 1.0.0 (2026-10-02).
