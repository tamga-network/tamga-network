---
document_id: ADR-0076
title: "Exit from a two-member network and continuity of governance"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-11
last_updated: 2026-11-12
summary: >
  The Governance contract requires at least 2 votes in absolute terms. If one member withdraws unilaterally (`withdraw`) while the
  network has 2 active members, the count drops to 1; the remaining member cannot execute any proposal, cannot admit a new member
  and cannot withdraw either: governance is locked for good. The right to exit (ADR-0002 #5) and the continuity of governance
  conflict at this point. Proposal: (a) `withdraw` is refused while the network has 2 active members; a member that wants to leave
  first waits for a third member to be admitted. Alternative (b): exit stays free and the threshold becomes 1 when a single member
  remains. Recommended: (a). Accepted (2026-11-12): (a), as recommended. The path for a member that wants to leave: a third member
  is admitted first, then the member withdraws. Single-founder initialisation is for local development only.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]"]
translation_of: ADR-0076
source_version: 1.0.0
---

# In short

The network's joint decisions (admitting a member, upgrades, network schemas) need the votes of at least two members. If the
network has two members and one of them leaves of its own accord, a single member remains, and a single member cannot take any
decision alone. Since no new member can be admitted either, the network cannot leave this state. This decision prevents reaching
that point: unilateral exit is refused in a two-member network; a member that wants to leave first waits for a third member to be
admitted, then withdraws without a vote.

# Context

- [[ADR-0002]] #5: a state can leave unilaterally with `withdraw()`; no vote is needed and the guarantee is in the code.
- [[SPEC-BC-0001]] §1 (independent review finding R6): because the 2/3 rule loses its meaning below three members,
  `requiredVotes` never goes below 2. The same section says that removal is impossible in a two-member network and that both
  sides "can only withdraw voluntarily".
- Contract audit (2026-11-11), confirmed by a test (behaviour before this decision): with 2 active members, `withdraw` brought
  the count to 1. After that
  - every proposal of the remaining member fails with `ThresholdNotMet(1, 2)` (admission of a new member included);
  - the remaining member cannot withdraw (`LastValidator`);
  - contracts cannot be upgraded, network schemas cannot be written, and list anchor writers and the migration window cannot be
    managed.
  National records are not affected (the remaining state keeps writing its own records); what locks is network-level governance,
  and there is no way back.
- The same state can arise at initialisation: `initialize` accepts a single founder, and with one member no proposal can be
  executed. Today this is used only in local development set-ups. There is no production chain, and it opens with at least two
  independent operators ([[ADR-0009]] K4).
- Because two closed rules conflict, the code was not changed before the decision; the rule was set by this document.

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

# Decision (2026-11-12)

**(a) accepted as recommended.** The binding rules are GC1–GC3 below; the name follows the table. Single-founder initialisation
is unchanged: it is for local development only; whether initialisation should require at least two founders is decided
separately.

# Invariants

| Code | Rule |
|---|---|
| GC1 | Unilateral exit (`Governance.withdraw`) passes only while the network has at least three active members; it is refused while the network has 2 or fewer active members (`TooFewMembers`). Neither exit nor removal can bring the number of active members below the absolute minimum of votes (2): governance always stays able to decide. |
| GC2 | In a two-member network the path for a member that wants to leave is ordered: a third member is admitted first (`proposeStateAdmission`, with the votes of the two members), then the member leaves with `withdraw`; this second step needs no vote. Until the admission takes place the member can stop its validator and stop writing records; its membership continues. |
| GC3 | [[ADR-0002]] #5 is read with this note: the right to exit is not removed, it is tied to an order. In a network with at least three active members it is unilateral, needs no vote and is guaranteed in code. The effect of an exit on credentials does not change: issued credentials and existing records stay valid ([[ADR-0002]] #4). |

Name (public ABI; following the existing error naming pattern — `TooManyDelegates(count, max)`):

| Where | Name |
|---|---|
| `Governance` error | `TooFewMembers(uint32 active, uint32 required)` — `active`: the number of active members at the time of the call; `required`: the minimum number of active members for a unilateral exit (3) |

# Consequences

- `Governance.withdraw`: a one-line change of the condition (`activeMemberCount ≤ 2` → refused). Storage layout and function
  signatures do not change; one error is added to the ABI. In a single-member (local development) set-up exit is refused with the
  same error; `LastValidator` remains only on the removal proposal.
- Tests (`contracts/test/review-2026-11-11-governance.test.ts`, `contracts/test/governance.test.ts`): one of three members
  withdraws (3 → 2), exit is refused in a two-member network (2 → 1), and once a third member has been admitted the exit passes
  and the two remaining members keep deciding.
- [[SPEC-BC-0001]] §1 and §14 item 8 (closed); an implementation note on [[ADR-0002]].
- Remaining limit (deliberate): in a two-member network, if the other member does not vote to admit a new member, the exit does
  not take place on chain. The member can stop its validator and stop writing records; the membership record continues. This
  follows from a two-member network behaving like a partnership ([[SPEC-BC-0001]] §1).

# Status

**Accepted — 2026-11-12.** Approved by project management (2026-11-12): option (a), as recommended. DECISIONS: D-GOV-12. GC1–GC3
are binding. Implementation: `Governance.withdraw` ([[SPEC-BC-0001]] version note).
