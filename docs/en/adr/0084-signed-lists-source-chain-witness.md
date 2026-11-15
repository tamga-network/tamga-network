---
document_id: ADR-0084
title: "List is the source, chain is a witness"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Fixes the direction of the network's trust source for every chain stage: the signed trust lists and the anchor log are the single,
  authoritative source (the EU trust list model); the chain is a witness — it records the list, a verifier may cross-check against
  it, but no verification decision is ever made from the chain. If the chain stops, lists, verification and wallets are unaffected;
  every difference between chain and list raises an alarm. ADR-0051's provision that "in the chain stage the lists are published as
  the chain's projection" changes in this direction; the question ADR-0073 left to a separate decision is closed. The chain code is
  completed switched off; no servers or validator nodes are set up for now; the order of the move is a test network first, then the
  real network. Accepted (2026-11-15).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0015]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[ADR-0085]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[FW-ARF-0001]]", "[[ARCH-0002]]"]
translation_of: ADR-0084
source_version: 1.0.0
---

# In short

In Tamga Network, whether a credential can be trusted is decided today by looking at the signed trust lists; the European Union's
trust lists work the same way. This decision says that this arrangement does not change after the chain arrives: the lists remain
the single, authoritative source and the chain is their **witness**. The chain records what was published in the list; anyone may
compare the list with it. If the chain stops or falls behind, no credential's verification is affected. The chain code is finished
but stays switched off; no servers are set up for now; when moving to the chain, a test network comes first, then the real network.

# Context

- [[ADR-0009]] tied the chain to the written acceptance of a second independent operator (K4); until then the trust anchor is the
  signed lists and the anchor log. [[ADR-0051]] had the chain code written from today and made the chain a projection of the lists
  (CH1: on conflict the list prevails, the chain's answer is not required for verification). [[ADR-0074]] extended the projection to
  every trust record in the lists (PJ1: the list remains the source). [[ADR-0073]] set up the one-time transfer of history to the
  chain and the equivalence test.
- The documents openly contradicted each other on the source direction (chain layer audit, 2026-11-15):
  - [[ADR-0051]] K6: "lists are still published in the chain stage — **as the chain's projection**" — i.e. the direction would flip
    in the chain stage and the chain would become the source;
  - [[ADR-0074]] PJ1: "the list remains the source";
  - [[ADR-0073]] K6: "whether the chain stage makes the chain the source is a separate decision".
  Until it was decided which one is the source, how a verifier uses the chain, monitoring and the move plan could not be settled.
- **Project management's direction (2026-11-15):** the network proceeds today with the EU model and no chain-related process runs in
  today's model; the chain code still moves forward and the structure is built so that no process from scratch is needed on the day
  of the move; running validator nodes is an extra cost right now and is not done; when moving to the chain, a test network first,
  then the real network.

# Decision

## K1 — Source and witness

The signed trust lists (LOTL, national lists, their views) and the anchor log are the network's **single, authoritative** trust source.
The chain is a **witness**: it records every publication of the lists and the trust records they contain ([[ADR-0074]] PJ1,
[[ADR-0085]]), and it witnesses a list version once as many independent operators as the threshold have written the same digest
([[ADR-0051]] CH3). This direction holds in every chain stage: on the test network, on the real network, and after the second operator
arrives. Making the chain the source (reversing the direction) is possible only through a new decision record, and that record
requires at least: member states operating the chain themselves, a showing that the EU side can recognise this model, and a way
back from chain to list.

## K2 — Verification decisions only from the signed list

All trust steps of the verification pipeline (A–E) — C1, C2, C3, D5 and the other steps that look at records — read only from the
signed list. The `TrustSource` used in verification is the list source. The trust source that reads the chain (`ChainTrustSource`)
is not consumed in any verification decision; its role is the equivalence test and cross-checking. The limit in [[ADR-0074]] K5,
"not used in verification until a continuous projection exists", becomes permanent with this decision: the chain makes no decision
even after continuous projection exists.

## K3 — Reading the chain is only for cross-checking and transparency

A verifier (or any third party) may read the chain and compare it with the list it holds (`trust:chain-check`, the chain field on
the health page, later an optional second source). This reading never changes the verification result **in any direction**: `UNKNOWN`
does not make the result worse, `YES` does not make it better, `NO` does not cause a rejection ([[ADR-0051]] K1.2). Reading the chain is
never required for verification and never will be.

## K4 — If the chain stops, the list is unaffected

The chain stopping, being unreachable, falling behind, or a failed write to the chain does not affect list publication, status lists,
verification or wallets. The list publisher does not stop publishing because of a chain write error; chain jobs run **after** and
independently of publication ([[ADR-0085]] SP5). When the chain flag (`TAMGA_CHAIN_ENABLED`) is switched off the system returns to its
current state; the way back is the flag alone.

## K5 — A difference raises an alarm

Every difference between chain and list raises an alarm and goes into the transparency report: a confirmed different digest on the
chain for the same list version (`CONFLICT` / `NO`, a double-speak signal), a pending competing candidate (`CONTEST`), the projection
falling behind the list or failing to write, a difference in the equivalence test. The direction of correction is always from the
list to the chain: a chain record is not deleted, it is corrected with a new write that matches the list; the list is not corrected
to match the chain.

## K6 — The code is completed switched off; the move is test network first, then real network

- The chain code (contracts, the publisher's chain jobs, indexer, equivalence tests, operator tools) is completed **switched off**:
  the flag is off in production, the live server has no chain settings, and the packages carry no chain client ([[ADR-0015]] K1).
- **For now no server, validator node or test chain server is set up.** The code is tested on the local development chain and on the
  multi-node test network in continuous integration.
- Order of the move: (1) code switched off; (2) **test network** — the real lists are projected onto a test chain and equivalence is
  watched for a period without differences; (3) **real network**. The real network does not open until all of these hold together:
  written acceptance of a second independent operator ([[ADR-0009]] K4), threshold ≥ 2 on the list anchor ([[ADR-0051]] CH3),
  operation without equivalence differences on the test network, a decision record for the production key path (hardware key vault),
  a decision record for separating governance and consensus keys, and an independent security audit.

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| **List is the source, chain a witness (in every stage)** | **chosen** | Same as the EU trust list model; same verification with or without the chain; the way back is the flag alone; does not pretend to trust the chain cannot produce while there is a single operator |
| In the chain stage the chain is the source and the list its view (old provision of [[ADR-0051]] K6) | rejected (for now) | Verification is affected when an operator drops or the chain stops; departs from the EU model; going back needs a transfer in the opposite direction. May be revisited when states operate the chain (K1, last sentence) |
| Two sources: list and chain together, accept only if both say "yes" | rejected | A failure of either source causes rejection (weakest link); the result is tied to the chain's availability (against K4) |
| Not using the chain at all | rejected | Independent witnessing against double-speak and record-level transparency are lost; against project management's direction that "the chain code moves forward" |
| Skipping the test network and going straight to the real network | rejected | The migration window opens once ([[ADR-0073]] CE1); opening it without a prior rehearsal with the real lists risks an irreversible error |

# Invariants

| Code | Rule |
|---|---|
| LS1 | The signed trust lists and the anchor log are the network's single, authoritative trust source; the chain is a witness. This direction holds in every chain stage; making the chain the source requires a new decision record. |
| LS2 | Verification decisions (C1, C2, C3, D5 and the other steps that look at records) are made only from the signed list; the trust source that reads the chain is not consumed in any verification decision. |
| LS3 | Reading the chain is only for cross-checking and transparency; it never changes the verification result in any direction and is never required for verification. |
| LS4 | The chain stopping, being unreachable, falling behind, or a failed chain write does not affect list publication, status lists, verification or wallets; chain jobs run after and independently of publication. |
| LS5 | Every difference between chain and list raises an alarm and goes into the transparency report; correction runs from list to chain, and a chain record is not deleted. |
| LS6 | The move to the chain is a test network first, then the real network; the real network does not open without a second independent operator's written acceptance, threshold ≥ 2, equivalence without differences on the test network, decisions on the production key path and key separation, and an independent security audit. |

# Consequences

- The provision in the last item of [[ADR-0051]] K6, "lists are still published in the chain stage — as the chain's projection",
  changed: in the chain stage too the list is the source and the chain the projection (witness). This is the separate decision named
  in the last sentence of [[ADR-0073]] K6. The temporary limit of [[ADR-0074]] K5 became permanent. A reference note was added to all
  three records.
- Design of continuous projection: [[ADR-0085]].
- [[FW-ARF-0001]] §8.1: the trust anchor of the ledger stage is the signed lists; the ledger is a witness. [[ARCH-0002]]: the setup
  steps were updated to this direction and to [[ADR-0009]] K4.
- No code change was needed: the verifier already reads only from the list; the chain health field does not change the result.
- Remaining work (in order): governance command tool, production key path, wiring chain monitoring and alarms into live monitoring,
  real network setup script, key separation decision, the code for [[ADR-0079]].

# Status

**Accepted — 2026-11-15.** With project management's approval (2026-11-15). DECISIONS: D-BC-17. LS1–LS6 are binding.
