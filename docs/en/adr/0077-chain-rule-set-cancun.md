---
document_id: ADR-0077
title: "The chain is set up with the Cancun rule set"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Until now the chain was designed with the Shanghai rule set, and the contracts were compiled for that target. Under Shanghai
  `SELFDESTRUCT` removes code: an implementation deployed with `CREATE2` could be destroyed after the vote and redeployed at the
  same address with different code (contract audit 2026-11-11). Decision: the chain is set up with the Cancun rule set (genesis
  `cancunTime: 0`), the contracts are compiled for `cancun`, and the tests run under the same rule set. Under Cancun `SELFDESTRUCT`
  does not remove code (EIP-6780); the code hash check on upgrade proposals stays as a second line of defence. No running chain
  exists, so no transition (fork) is needed.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0009]]", "[[ADR-0052]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]", "[[ARCH-0002]]"]
translation_of: ADR-0077
source_version: 1.0.0
---

# In short

A blockchain names the rules in force as a "rule set" (hard fork). The Tamga chain was designed with the Shanghai rule set. Under
that rule set a contract can delete itself and different code can be placed at the same address; this left a door open for
changing the code behind an upgrade that had already been voted. The next rule set, Cancun, closes that path. The chain is not
running yet, so the rule set can be chosen today at no cost: the chain is set up with Cancun.

# Context

- Contract audit (2026-11-11): an upgrade proposal voted on an **address**. Under Shanghai `SELFDESTRUCT` removes the account's
  code; an implementation deployed with `CREATE2` could destroy itself during the 7-day delay ([[ADR-0055]] GE1) and be redeployed
  at the same address with different code. The fix was made the same day: the proposal pins the code hash of the new
  implementation and execution compares it (`UpgradeImplementationChanged`, [[SPEC-BC-0001]] §9).
- The way to close the whole class is the rule set: with EIP-6780 in Cancun, `SELFDESTRUCT` does not remove code or storage unless
  the contract was created in the same transaction; it only transfers the balance. The question was recorded as an open issue
  ([[SPEC-BC-0001]] §14 item 10).
- There is no running chain ([[ADR-0009]] K4); the genesis and the contracts can change freely. Changing the rule set after the
  chain is set up would need a coordinated fork by all validator operators.
- The compilation target cannot exceed the chain's rule set: code compiled for `cancun` may use Cancun opcodes (`MCOPY`,
  transient storage) and does not run on a Shanghai chain. The two change together.

# Decision

- **K1 — Rule set.** The chain is set up with the Cancun rule set: `shanghaiTime: 0` and `cancunTime: 0` in the genesis `config`
  (active from the first block). The local development chain, the test network and the real network use the same rule set.
- **K2 — Compilation and tests.** The contracts are compiled with `evmVersion: cancun` (solc 0.8.24). The in-process network the
  contract tests run on uses the `cancun` rule set as well; even if the tool's default is a newer rule set, the tests run under
  the chain's rules.
- **K3 — Blob transactions are not used.** The blob transactions introduced by Cancun (EIP-4844) are a layer-2 data path; the
  network has no use for them. The network sends no blob transactions and the contracts do not rely on blobs. The node software
  carries the blob fields in the block header (with zero values); no extra configuration is needed.
- **K4 — The code hash check stays.** The code hash check on upgrade proposals is not removed: it gives the same guarantee if the
  rule set changes later or the code changes by some other path. The rule "what is voted is the code" does not depend on the rule
  set.
- **K5 — Later rule sets.** Moving to a rule set after Cancun (in the genesis or on a running chain) needs a separate decision
  record; the node software's default is not followed.

# Options considered

| Option | Result | Why |
|---|---|---|
| Stay on Shanghai, code hash check only | rejected | The check closes the upgrade path, but the same class (code that destroys itself and is redeployed) can reappear in another context; the rule set closes it at the root and costs nothing today |
| **Cancun** | **accepted** | EIP-6780 closes metamorphic redeployment; node software and compiler have supported it for years; tried locally on a one-validator QBFT network |
| A newer rule set (Prague and later) | rejected for now | Brings new surfaces such as account code delegation (EIP-7702); the sovereignty check is address-based, and this is not enabled before its effect is reviewed separately (K5) |

# Invariants

| Code | Rule |
|---|---|
| CR1 | The chain's rule set is written explicitly in the genesis and is Cancun from the first block (`shanghaiTime: 0`, `cancunTime: 0`); the local development chain, the test network and the real network use the same rule set. Moving to another rule set needs a new decision record. |
| CR2 | The compilation target of the contracts and the rule set of the network the contract tests run on are the same as the chain's rule set (`cancun`). |
| CR3 | An upgrade proposal pins the code hash of the new implementation and compares it at execution; this check stays regardless of the rule set. |

# Consequences

- Code: `contracts/hardhat.config.ts` (`evmVersion: cancun`, in-process network `hardfork: cancun`),
  `contracts/scripts/export-abi.mjs`, `contracts/slither.config.json`; the genesis generators `scripts/besu-dev.ps1` (one-validator
  and permissioned mode) and `network/testnet/make-network.sh`. Local genesis files generated earlier are Shanghai: the local chain
  is set up again (the genesis is deleted and regenerated, the chain data is reset).
- Tests: the code hash check is tested under Cancun with the test node's code replacement hook; a separate test shows that the
  code of an implementation that "destroys" itself stays in place and that redeployment at the same address fails
  (`contracts/test/review-2026-11-11-governance.test.ts`).
- The storage layout did not change; runtime code sizes moved by a few bytes and the EIP-170 headroom is kept
  (`contracts:check`).
- Verification: a local one-validator QBFT network (Besu 26.11.0) was set up with `cancunTime: 0`, produced blocks and had the
  contracts deployed; the Cancun opcodes (`MCOPY`, `TSTORE`/`TLOAD`, `BLOBBASEFEE`) worked and the block header carried the blob
  fields with zero values. No extra option was needed for the KZG setup. The multi-node network is verified in the CI test
  network workflow (`testnet.yml`).
- **Implementation note (2026-11-12, second check; the decision is unchanged):** the test side of CR2 became true with this
  fix — in the test tool the in-process network is named `default`; the configuration had pinned a network named `hardhat`,
  which is never used, to Cancun, so the tests ran with a newer rule set. The `default` and `node` networks are pinned to
  Cancun; a test asserts the rule set the tests run with.
- Documents: [[SPEC-BC-0001]] §9 and §14 item 10 (closed), [[ARCH-0002]], [[GUIDE-0018]].

# Status

**Accepted — 2026-11-12.** Approved by project management (2026-11-12). DECISIONS: D-NET-7. CR1–CR3 are binding.
