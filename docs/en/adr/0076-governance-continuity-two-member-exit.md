---
document_id: ADR-0076
title: "Exit from a two-member network and continuity of governance"
status: Proposed
version: 1.0.0
created: 2026-11-11
last_updated: 2026-11-11
summary: >
  The Governance contract requires at least 2 votes in absolute terms. If one member withdraws unilaterally (`withdraw`) while the
  network has 2 active members, the count drops to 1; the remaining member cannot execute any proposal, cannot admit a new member
  and cannot withdraw either: governance is locked for good. The right to exit (ADR-0002 #5) and the continuity of governance
  conflict at this point. Proposal: (a) `withdraw` is refused while the network has 2 active members; a member that wants to leave
  first waits for a third member to be admitted. Alternative (b): exit stays free and the threshold becomes 1 when a single member
  remains. Recommended: (a). The draft also asks whether single-founder initialisation stays limited to local development. Awaiting
  a decision.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]"]
translation_of: ADR-0076
source_version: 1.0.0
---

# In short

The network's joint decisions (admitting a member, upgrades, network schemas) need the votes of at least two members. If the
network has two members and one of them leaves of its own accord, a single member remains, and a single member cannot take any
decision alone. Since no new member can be admitted either, the network cannot leave this state. This proposal defines the rule
that prevents reaching that point.

# Context

- [[ADR-0002]] #5: a state can leave unilaterally with `withdraw()`; no vote is needed and the guarantee is in the code.
- [[SPEC-BC-0001]] §1 (independent review finding R6): because the 2/3 rule loses its meaning below three members,
  `requiredVotes` never goes below 2. The same section says that removal is impossible in a two-member network and that both
  sides "can only withdraw voluntarily".
- Contract audit (2026-11-11), confirmed by a test: with 2 active members, `withdraw` brings the count to 1. After that
  - every proposal of the remaining member fails with `ThresholdNotMet(1, 2)` (admission of a new member included);
  - the remaining member cannot withdraw (`LastValidator`);
  - contracts cannot be upgraded, network schemas cannot be written, and list anchor writers and the migration window cannot be
    managed.
  National records are not affected (the remaining state keeps writing its own records); what locks is network-level governance,
  and there is no way back.
- The same state can arise at initialisation: `initialize` accepts a single founder, and with one member no proposal can be
  executed. Today this is used only in local development set-ups. There is no production chain, and it opens with at least two
  independent operators ([[ADR-0009]] K4).
- Because two closed rules conflict, the code was not changed; this document proposes the rule.

# Options

| Option | What | For | Against |
|---|---|---|---|
| **(a) Exit waits at two members** | `withdraw` is refused while the network has 2 active members. A member that wants to leave first waits for a third member to be admitted, then withdraws | Governance never locks; a small, local code change; R6 is kept | The right to exit is deferred in a two-member network: if the other member does not vote to admit a new member, the exit does not take place on chain (the member can stop its validator and stop writing records, but still counts as a member) |
| **(b) Threshold 1 with a single member** | `withdraw` stays free. With 1 active member `requiredVotes` returns 1; the remaining member can admit new members | The right to exit is fully kept; no lock; single-founder initialisation works too | The single remaining member takes every network-level decision alone: after the 7-day delay it can upgrade the contracts and affect the records of the states that left. R6's guarantee that "one state cannot decide alone" is lifted in a one-member network |
| **(c) Both** | Exit is refused at two members; threshold 1 for a single-member initialisation | The lock is closed on both paths | Two separate rules; a one-member network is not wanted in production anyway ([[ADR-0009]] K4) |
| Do nothing | The rule stays in the operations documents: "in a two-member network, admit a third member before withdrawing" | No code change | A single transaction locks the network irreversibly; no protection against a mistake or a dispute |

# Recommendation

**(a).** Reason: a two-member network behaves, in the specification's own words, like a partnership; the purpose of the right to
exit is not to let one partner stop the network's joint governance for good with a single transaction. (b) opens the lock but
leaves all network-level authority with one state; the on-chain records of the states that left stay exposed to that state's
upgrade decision. Under (a) the right to exit is not removed, it is tied to an order. Proposed rules (moved to the binding table
if accepted):

1. `withdraw` is refused while the network has 2 or fewer active members (today only the last member is refused).
2. [[ADR-0002]] #5 is read with this note: unilateral exit needs no vote while the network has at least three active members; in
   a two-member network it is used after a third member has been admitted.
3. Single-founder initialisation is for local development only. Whether initialisation should require at least two founders is
   decided separately: local development and test network set-ups can run with one founder today, so this draft does not change
   it.
4. The error name and the specification text are approved at acceptance.

# Consequences (if accepted)

- `Governance.withdraw`: a one-line change of the condition; storage layout and external interface do not change. Test: exit is
  refused in a two-member network and passes once a third member has been admitted.
- [[SPEC-BC-0001]] §1 (the sentence "both sides can only withdraw voluntarily") and §14 item 8; an implementation note on
  [[ADR-0002]].
- Until acceptance the contract behaviour does not change; the operating rule applies: in a two-member network, admit a third
  member before withdrawing. The current behaviour is recorded by a test
  (`contracts/test/review-2026-11-11-governance.test.ts`).

# Status

**Proposed — 2026-11-11.** Awaiting the decision of project management (finding of the 2026-11-11 contract audit).
