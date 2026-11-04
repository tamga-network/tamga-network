---
title: Shared ledger (chain)
---

# Shared ledger (chain)

Tamga's trust rests today on signed [[t:trust-list|trust lists]] and an hourly [[t:anchor-log]]. There is no running chain. The
code of a permissioned [[t:ledger]] (Hyperledger Besu, QBFT) is written and tested; it is off in production ([[ADR-0009]],
[[ADR-0051]]).

## Why a chain at all?

Today a single operator signs the lists. The public log and audits **deter** the operator from showing two verifiers two different
lists (equivocation), but they do not make it impossible. A ledger can add two things:

- **Independent witnessing.** A list version's digest is confirmed only when a threshold of independent operators submit the same
  digest; a single operator cannot produce a confirmed digest, and differing digests show up on chain as conflict events
  ([[ADR-0053]]).
- **Governance in code.** Membership, network credential types and upgrades by a 2/3 vote of the states; upgrades wait 7 days
  ([[ADR-0055]]).

Both depend on the number of signers. So the ledger is not set up until **at least two independent operators** have agreed in
writing to run a validator; a single operator's chain yields no more trust than a list signed by that operator ([[ADR-0009]] K4).

## A projection of what?

The chain is a **projection** of the signed lists and the anchor log, not their source ([[ADR-0051]]):

| | |
|---|---|
| Source | Signed lists (`lotl`, `tl-<cc>`) and the anchor log; on conflict the list wins |
| Goes on chain | Digests of list versions; every trust entry in the lists (institution, verifier, credential type, wallet provider, terminal group…) only as digests, fingerprints, dates, statuses and closed-set values ([[ADR-0074]]) |
| Never on chain | Personal data, credentials, credential digests, revocation bits, free text; details only as a `SHA-256(JCS(…))` digest |
| Verification | Does not depend on the ledger; `TrustSource` reads the lists. The chain check is optional: yes / no (alarm, result unchanged) / unknown (result never made worse) |

## How would the move happen?

If the ledger opens, the full history of the lists is replayed into the contracts **once** (`trust:chain-replay`): inside a
migration window opened by a vote of the states, lasting at most 30 days and never reopened, with the dates from the lists
([[ADR-0073]]). Contracts judge a credential by the status at its issuance time (`iat`); a credential issued before a suspension
stays valid, a hard revocation (`invalidatesFrom`) drops later ones. A verifier's identity derives from its domain name and moves
between states only by a joint vote ([[ADR-0075]]). The migration does not close until the same questions, asked of the list source
and the chain source, show no accept/reject difference. Issued credentials are not reissued; wallets and verifiers do not change.

## Today

| Part | Status |
|---|---|
| Signed lists and anchor log | Live on the real network |
| Contracts, local Besu development network, replay, indexer, equivalence test | Working (local and CI only) |
| Production ledger | Off; prerequisites are a second independent operator and an independent security audit |
| Value layer (token, payments) | None; research direction only ([[ADR-0072]]) |

## More

- Decisions: [[ADR-0001]] · [[ADR-0009]] · [[ADR-0051]] · [[ADR-0052]] · [[ADR-0073]] · [[ADR-0074]] · [[ADR-0075]]
- List format and contract mapping: [[SPEC-TRUST-0001]]
- Trust lists: [Trust lists and federation](/concepts/trust-lists)
