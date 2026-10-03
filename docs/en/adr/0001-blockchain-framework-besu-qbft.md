---
document_id: ADR-0001
title: "Besu QBFT ledger"
status: Active
version: 1.0.0
created: 2026-07-29
last_updated: 2026-10-02
summary: >
  Tamga Network uses Hyperledger Besu with QBFT consensus as its blockchain engine. Rationale: native EVM (future assets
  and payments), the same stack as EBSI, single-chain simplicity, built-in support for a permissioned network with equal
  voting power and immediate finality, and full sovereignty. The validator scaling limit is addressed by the design
  "states = validators, institutions = full nodes".
domain: Trust
translation_of: ADR-0001
source_version: 1.0.0
---

# ADR-0001 — Blockchain framework and consensus: Hyperledger Besu (QBFT)

**Status:** Accepted
**Date:** 2026-07-29
**Decided by:** Tamga Network project management

---

# Context

[[PM-BC-0001]] decided that Tamga would run its own sovereign, open-source, permissioned network with equal power per
state and BFT/PoA consensus, but deliberately left the concrete framework/engine choice (layer 4) open.

[[RS-FRAMEWORKS-0001]] compared two candidates:
- **Hyperledger Besu** (QBFT)
- **Cosmos SDK** (CometBFT)

They were assessed against Tamga's requirements: permissioned, equal votes, immediate finality, sovereignty, a single shared
chain, future asset and payment capability, and interoperability with EBSI.

---

# Decision

> Tamga Network's blockchain engine is **Hyperledger Besu**, running **QBFT** consensus.

Sub-decisions:
- The network is set up as an **independent, permissioned private network** (its own genesis, its own chain ID). It is not
  connected to Ethereum mainnet or any other network.
- **Consensus:** QBFT (2/3+ supermajority, single-block finality). Validators have equal voting power (PoA).
- **Validators = states; full nodes = trusted institutions** (for scaling and the equal-power principle).
- **Smart contracts:** EVM / Solidity — future asset, transfer and payment capabilities are built on this layer.
- The final choice between QBFT and IBFT 2.0 is settled during implementation (this ADR may be updated).

---

# Rationale

1. **Native EVM → future capabilities.** Besu's EVM makes asset, payment and custody functions directly possible with
   mature ERC patterns (in Cosmos this is an add-on layer).
2. **Same stack as EBSI.** EBSI uses Besu + IBFT 2.0 ([[RS-EBSI-0001]]). A common base eases interoperability and the
   transfer of know-how.
3. **Single-chain simplicity.** Cosmos's multi-chain/IBC advantage would sit idle under Tamga's "one shared chain" decision.
4. **Built-in fit.** Permissioned operation, PoA/equal votes and immediate finality come out of the box with Besu QBFT.
5. **Full sovereignty.** Apache 2.0, our own network, forkable; no dependency on any company or network.

---

# Consequences

**Positive:**
- A ready foundation for the asset/payment roadmap (EVM).
- Technical proximity to EBSI → easier interoperability.
- A mature tooling and developer ecosystem.
- Simple, single-network operations.

**Caveats / cost:**
- QBFT struggles above ~20 validators → addressed by "states = validators, institutions = full nodes"; if the number of
  states grows very large, a scaling strategy is needed ([[PM-BC-0001]], Future).
- Requires Java-based operations expertise.
- Lower TPS than Cosmos, but sufficient for a trust-infrastructure workload.

---

# Alternatives considered

- **Cosmos SDK (CometBFT):** better validator scaling and TPS; but no native EVM, the multi-chain advantage is idle for
  Tamga, and a different stack from EBSI. Rejected.
- **Consensus from scratch:** already rejected in [[PM-BC-0001]] (risk, time, no contribution to sovereignty).
- **Building on Ethereum L1/L2:** rejected in [[PM-BC-0001]] (loss of sovereignty, GDPR exposure).

---

# Related documents

- [[PM-BC-0001]] — this ADR closes the open "layer 4" decision there.
- [[RS-FRAMEWORKS-0001]] — the comparison this decision rests on.
- [[RS-EBSI-0001]] — the EBSI precedent (Besu + IBFT 2.0).
- [[ACA-BC-0001]] — consensus fundamentals.
