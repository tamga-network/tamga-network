---
document_id: ADR-0009
title: "Chainless beta and chain threshold"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-02
summary: >
  The preconditions that tied the pilot to the ledger (PM-GTM-0001 Ö1/Ö2) are removed; "phase B — chainless beta" is added
  before phase 0. In the beta the trust anchor is a set of versioned, hash-chained trust lists (LOTL + national list)
  signed by Tamga as provisional operator, plus an hourly anchor log — the ETSI TS 119 612 / EUDI model. The ledger
  (D-BC-0 Besu/QBFT, unchanged) is set up only once there are at least two independent validator operators; four validators
  run by a single operator produce no more trust than a signed list. Every beta data structure carries the multi-state
  (Organization of Turkic States) set-up from today; Tamga is a "provisional, on behalf of" operator everywhere, and a
  hand-over changes only the operator field. Migration = replaying the list history into the contracts + an equivalence
  test.
domain: Trust
translation_of: ADR-0009
source_version: 1.0.0
---

# ADR-0009 — Phase B: chainless beta

**Status: Accepted ✅** (2026-09-24).
On acceptance it is recorded in [[DECISIONS]] as **D-BC-6**, **D-GTM-2** and **D-GOV-5**.

---

# Context

## Problem

Tamga's canonical roadmap tied the pilot to the ledger: the [[PM-GTM-0001]] §2 preconditions **Ö1** "contracts compile and
tests pass" and **Ö2** "testnet up, contracts deployed" had to be met before real graduate data could be processed (GT1).
[[ARCH-0001]] §3 defines phase 0 as "4 foundation validators". The contracts had never been compiled (no Foundry; DECISIONS
§10.5). This locked the university pilot — and with it the university agreement and investor talks — behind the ledger
infrastructure.

## Finding: the phase 0 ledger produces no trust (F1)

All four validators in phase 0 **belong to the Tamga foundation**. Four QBFT nodes run by one operator do not provide the
**independence** that Byzantine fault tolerance assumes: if all four are in the same hands, the assumption "Tamga is not
lying" is needed in the same way on the ledger as in a signed list. The difference is only operational (outage
resilience) and preparation for future multi-party operation; **in terms of trust** a single-operator ledger = a
hash-chained log signed by a single operator. Therefore **requiring** the ledger in phase 0 raises the pilot's cost without
raising its assurance.

A ledger produces value when the number of signers grows beyond one. [[DECISIONS]] D-GOV-2 defines the hand-over
thresholds (≥3 states, ≥4 states + 12 months), but a **starting threshold** had never been defined.

## What Europe does

In the [[t:EUDI-Wallet]] ecosystem the [[t:trust-anchor]] is not a ledger but the **Trusted List** signed by each member
state ([[t:ETSI]] TS 119 612) + the Commission's [[t:LOTL]]; the digest is announced in the Official Journal. EBSI keeps the
same records on a ledger. Tamga's canonical design uses the EBSI model with EUDI/ETSI data semantics ([[SPEC-ID-0002]]
§8.1). Stepping down to EUDI's own model (a signed list) for the beta is not a deviation from the architecture but the
single-signer special case of the same semantics. Analysis: `docs/_internal/beta/02-mimari-yeniden-analiz.md` §1–§2,
`docs/_internal/beta/05-kurallar-en-iyi-pratik.md` R-2/R-6.

## Direction from project management (2026-09-23/24)

A pilot is started without waiting for the ledger; the architecture decisions stay the same. The beta is set up as if the
states and the Organization of Turkic States had already joined; this set-up is later carried over to the ledger.

---

# Decision

## Decision 1 — Phase B is added

The phase order becomes **phase B → phase 0 → phase 1 → phase 2**. Phase B = chainless beta: university pilot,
[[t:verifier|verifiers]], Trust Framework, measured results. The application code base is this repository (`packages/` +
`apps/`); the tamga-network documents are authoritative.

## Decision 2 — The beta trust anchor: signed, versioned, hash-chained lists + an anchor log

Under `trust.tamga.network`:

| File | Ledger counterpart | Rule |
|---|---|---|
| `lotl.jws` | `Governance` member list + `SchemaRegistry` (NETWORK) + wallet provider anchor | monotonic `version`, `previous_version_hash`, `next_update` ≤ 90 days, re-signed even without changes |
| `tl-<cc>.jws` | `RootCARegistry` + `IssuerRegistry` (+ `SchemaAuth`) + `RelyingPartyRegistry` + `CrossRecognition` | same; a national namespace is signed only with that state's key (beta: Tamga on its behalf) — the beta reading of N1 |
| `anchors.jsonl` | `StatusListRegistry.publishList` + schema `contentHash` anchors | append-only; **hourly** signature (heartbeat included); lines are never deleted; `previous_hash` |
| `keys/` + a permanent web page | Official Journal announcement | fingerprints of the LOTL signing certificates; ≥2 rolling certificates (ETSI 119 612 Annex A.2); rotation ≥30 days ahead, the new key signed with the old one |

Canonical field names and examples: `docs/_internal/delivery/04-TRUST-LIST-FORMAT.md` (formalised on acceptance as
**SPEC-TRUST-0001** — DB-11).

## Decision 3 — Anchor substitution: the beta reading of "recorded on the ledger"

The **meaning** of the following invariants is kept; their carrier changes:

| Invariant | Canonical wording | Phase B reading |
|---|---|---|
| [[SPEC-CRED-0003]]/S1 | No revocation bits on the ledger; only an anchor | No revocation bits in the list/log; only an anchor |
| [[SPEC-CRED-0003]]/S4 | Recorded on the ledger **after** being written to the CDN | … recorded in the **anchor log** after (same order) |
| [[SPEC-SCHEMA-0001]]/D8 | Ledger record after CDN publication | Anchor log record after CDN publication |
| [[SPEC-BC-0001]]/DP1 | No contract stores personal data… | No list/log/log file stores personal data… |
| [[SPEC-BC-0001]]/N1 | No writes outside the namespace owner | A national list is signed only by that namespace's signing key |
| [[SPEC-BC-0001]]/GV2 | NETWORK schemas only via Governance | NETWORK schemas only in `lotl.jws`, with the operator's signature (**suspended**: single member) |
| [[ARCH-0003]]/CMP1 | The verifier does not query the ledger directly; it reads from the indexer | The verifier does not interpret list files directly; it reads from the `TrustSource` cache |
| [[ARCH-0003]]/CMP2 | Unknown implementation version → stop | Unknown `list_format_version` → stop |
| [[ARCH-0003]]/CMP4 | Stale indexer → INDETERMINATE | List past `next_update` or unreachable → INDETERMINATE |

These readings are recorded in the specifications concerned; the invariant texts do not change. The [[ADR-0007]] and
[[ADR-0008]] principle "content off-chain, anchor on-chain" is read as "content off-chain, anchor **in the canonical
record** (the ledger or the phase B list)".

**Known weakening (honest record):** an anchor on a ledger makes it impossible, by consensus, for an [[t:issuer]] to
double-speak (two different lists to two verifiers). In phase B the anchor rests on the operator's signature; if operator
and issuer act together, double-speaking **is possible**; the public log, the quarterly transparency report (G8) and
independent audit **deter** it but do not make it impossible. This enters the phase 0 limitations statement as **item 6**
(decision 6).

## Decision 4 — Ledger starting threshold

The Besu/QBFT ledger ([[ADR-0001]], unchanged) is set up **only** when the following condition is met:

> **At least two independent validator operators** (Tamga + ≥1 institution legally and operationally independent of
> Tamga: a second university, a chamber of commerce/industry or a state institution) have agreed **in writing** to run a
> validator.

This line is added to the [[DECISIONS]] D-GOV-2 threshold table as the "start" row. Setting up a ledger before the condition
is met would mean presenting a single-operator ledger as "multi-party" and is contrary to the spirit of [[PM-GOV-0001]] G6
(a tripwire for every soft power).

## Decision 5 — Organization-of-Turkic-States-first principle

**No identifier, role name or data structure of phase B assumes "Tamga is the only operator".** Concrete rules:

1. `lotl` + **a national list slot for every member state of the Organization of Turkic States** (TR `ACTIVE`; AZ, KZ, KG,
   UZ `RESERVED`; observers HU, TM with a separate `membership` field).
2. In every national list, the **full ARF role set** as slots: Registrar, TLSO, PID Provider (empty), Access CA, National
   Root CA, Wallet Provider; each slot with `status` + `operated_by`.
3. In every list, `operator: { name: "Tamga Network", status: "provisional", on_behalf_of: "<cc> national authority (to be
   designated)" }`.
4. Root and registry names belong to the state: "TR National Root CA (provisional operator: Tamga)"; `ca_id`, `issuer_id`
   and `vct` **do not change** on hand-over; only the `operator` field changes.
5. The Tamga Trust Framework is written assuming membership of the Organization of Turkic States: membership, appointing a
   Registrar, root hand-over, disputes, exit; Tamga's current role is defined in the document as "founding proxy"; the 2/3
   rule ([[ADR-0002]]) is written in the document, not in code.
6. Every list has a cross-recognition field (beta: TR → TR).

## Decision 6 — Pilot preconditions and the limitations statement are redefined

[[PM-GTM-0001]]: **Ö1'** list commitment tests pass, signed and hash-chained; **Ö2'** `trust.tamga.network` +
`schema.tamga.network` live, the root fingerprint page published; **Ö5'** limitations statement **v2** (8 items: item 5
"no blockchain, records are signed and public", item 6 "the anchor rests on a single operator's signature", item 7
"revocation ≤ 90 min"); **Ö7'** acceptance of this ADR; **Ö8'** the issuer credential key under the university's control
(G1 unchanged). GT1–GT7 unchanged. Criteria **B10** (revocation effective ≤ 90 min) and **B11** (T0 INDETERMINATE rate ≤
0.5%) are added.

## Decision 7 — Migration = replay + equivalence test

Migrating from phase B to phase 0 means **replaying** the list version archive as contract calls
(`docs/_internal/delivery/05-MIGRATION-TO-CHAIN.md` §2); the `since` times in the status history are written to the
`revokedAt`/`validFrom` fields so that `isCredentialAcceptable(issuerId, iat)` gives the same answer for documents of the
beta period (D-BC-3). **Acceptance criterion:** for every `(issuer_id, schema_id, iat, list_id, version)` query recorded
during the pilot, `TrustSource(list)` and `TrustSource(chain)` must give the same C1/C2/C3/D5 answer; any ACCEPTED/REJECTED
difference = migration not complete. [[t:credential|Credentials]] already issued are not re-issued; the wallet and the
issuer service do not change.

---

# Rationale

1. **Trust equivalence (F1).** A single-operator ledger and a list signed by a single operator rest on the same trust
   assumption; the latter is cheap, standard (ETSI 119 612) and EUDI's own model.
2. **The architecture is kept.** The read interface (`TrustSource` = the [[SPEC-BC-0001]] §11.2 read set), the A–E
   validation pipeline, the [[t:SD-JWT-VC]] profile, the [[t:status-list]], the schema registry, the wallet and the protocols
   are identical in both phases. The beta is not a "hack" but the single-signer special case of the canonical architecture.
3. **Reversibility.** List → ledger migrates by replay; ledger → list (in an ARCH-0004 SEV1) can fall back through the
   indexer projection. Both directions use the same format.
4. **Honesty.** The phase 0 limitations statement already said "Tamga is both operator and regulator"; phase B writes this
   even more clearly and defines when a ledger produces value.
5. **Organization-of-Turkic-States-first** reduces hand-over cost to zero and proves the narrative of "infrastructure that
   works with states" in the data structure (reserved slots, provisional operator).

---

# Alternatives considered

## A — Wait for the ledger (the previous plan) — rejected
The pilot stays dependent on Foundry set-up + compilation + testnet + audit (months). No gain in assurance (F1). University
and investor talks are delayed.

## B — Pilot on a single-node / four-node "development ledger" — rejected
Gives the appearance of a ledger, not trust; it also brings the cost of operating a ledger (nodes, RPC security O1,
indexer) into the beta. Marketing a "blockchain pilot" would be misleading (D-GTM-1/5: "verifiable record infrastructure",
not "blockchain").

## C — Pilot with a web2 demo (tamga-demo style) — rejected
A demo without trust lists, X.509, SD-JWT VC and a status list is not "the same architecture"; everything would be
rewritten when moving to the ledger; the cryptographic claims could not be shown. tamga-demo is a screen/narrative
reference only (a BIP39 seed wallet violates WL1).

## D — A multi-party ledger from day 1 (with a second institution) — deferred
The right goal, but a second independent operator **does not exist today**; the way to find one is to show the pilot.
Decision 4 defines exactly this threshold.

---

# Consequences

## Binding
1. [[DECISIONS]]: **D-BC-6** (phase B + ledger starting threshold), **D-GTM-2** (Ö'/statement v2), **D-GOV-5**
   (Organization-of-Turkic-States-first); a starting row in the D-GOV-2 table. In the changed-decisions table: PM-GTM Ö1/Ö2
   → Ö1'/Ö2'.
2. [[ARCH-0001]] §3: a phase B row; phase 0 defined as "≥2 independent validator operators".
3. [[PM-GTM-0001]] (decision 6).
4. [[SPEC-CRED-0003]], [[SPEC-SCHEMA-0001]], [[SPEC-BC-0001]], [[ARCH-0003]]: the decision 3 readings.
5. [[SPEC-ID-0002]] §8.1: projection source "canonical record (the ledger or the phase B list)".
6. New document **SPEC-TRUST-0001** (list format); **PM-TRUST-0002 / Tamga Trust Framework** (World Bank 5 layers).
7. The code base of this repository depends on this ADR; no business logic interpreting lists may be written outside
   `TrustSource` (BT4).

## Decisions not changed
D-BC-0 (Besu/QBFT), D-GOV-0, D-ID-1, D-CRED-1, D-ASSUR-1, D-SCHEMA-1/2/3 (ADR-0010 treats separately), D-REV-1/2/3,
D-TRUST-0, D-AUTH-5, D-STR-1..4, D-GTM-1. This ADR defines only **when** the ledger is set up and **whose signature** the
anchor is until then.

## Accepted trade-offs
- Protection against double-speaking weakens (decision 3, statement item 6).
- The Tamga operator component (`trust-publisher`) is a single point of failure: verification continues from cache until
  the list expires, then INDETERMINATE; a runbook + two-person access are mandatory.
- GV3/GV4 (voting rules) are suspended in phase B; governance lives in the document, not in code.

---

# Relations

**Adds:** [[ARCH-0001]] phase B · [[PM-GTM-0001]] · D-GOV-2 starting threshold
**Interprets:** [[ADR-0007]], [[ADR-0008]], [[SPEC-CRED-0003]], [[SPEC-SCHEMA-0001]], [[SPEC-BC-0001]], [[ARCH-0003]]
**Builds on:** [[ADR-0001]] (unchanged), [[ADR-0002]] (sovereignty, cross-recognition), [[PM-ASSUR-0001]] (stateless bootstrap)
**Gives rise to:** SPEC-TRUST-0001, Tamga Trust Framework, this repository's code base
**Sibling:** [[ADR-0010]] (vct URN + category — the Organization-of-Turkic-States-first principle applied to type identity)
**Analysis source:** `docs/_internal/beta/02`, `03`, `04` (DB-1, DB-2, DB-10, DB-17), `05` (R-2, R-5, R-6), `06` §3.4

---

# Status

**Accepted ✅** — 2026-09-24. Recorded in [[DECISIONS]] as D-BC-6, D-GTM-2 and D-GOV-5; the follow-up specification updates
are tracked in the DECISIONS §10 list of open commitments.
