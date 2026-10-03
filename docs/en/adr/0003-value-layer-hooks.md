---
document_id: ADR-0003
title: "Value layer hooks"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-02
summary: >
  Under the [[PM-AUTH-0001]] strategy, five binding architecture decisions that must be taken TODAY to keep the
  value/payment/agent door OPEN. All of them cost almost nothing today; taken later, each would require migrating the
  entire user base. (1) Citizen/institution chain accounts are SMART CONTRACT WALLETS from the start (not EOAs); (2) key
  domains are strictly separated — identity/asset/agent — and ASSET recovery is separate from identity escrow, with
  USER-CHOSEN recoverers (not a mandatory state actor); (3) the delegation registry is scope-generic; (4) credential
  gating is a generic contract primitive; (5) no own token, but token standards are not forbidden — issuance is tied to an
  allow-list of FINANCE issuers. These decisions are binding constraints on the contracts/ implementation.
domain: Governance
translation_of: ADR-0003
source_version: 1.0.0
---

# ADR-0003 — Value layer hooks

**Status:** Accepted
**Date:** 2026-08-06
**Decided by:** Tamga Network project management
**Source:** `docs/tamga-network-varlik-katmani-strateji.md` §4 + `docs/tamga-network-cuzdan-odeme-agent.md` §2, §4
(strategic input drafts). Strategy rationale → [[PM-AUTH-0001]].

---

# Context

The decision in [[PM-AUTH-0001]]: Tamga is an **authorisation layer**, not a settlement layer, and no payment feature is
built in the short term. Being able to open the value/payment/agent door later, however, depends on **a few architecture
decisions taken today**. What they have in common: **almost free today, practically impossible later** (the whole user
base would have to migrate to new accounts). They therefore have to be fixed **before** any `contracts/` Solidity is
written.

This ADR builds on [[ADR-0001]] (Besu/EVM) and [[ADR-0002]] (sovereignty-first governance); the value layer is
**independent** of the X.509 vs DID decision ([[DECISIONS]] D-ID-1) (layer A = an EVM address exists in either case).

---

# Decision

## Decision 1 — Chain accounts are smart contract wallets from the start (not EOAs)

A citizen's or institution's chain account must be a **contract account** (account abstraction, ERC-4337 style), not a
plain key-to-address mapping (EOA) — even if today it only performs identity operations.

This single decision makes the following possible later: recovery, spending limits, agent delegation, gas sponsorship,
multi-signature, policy rules. **Gas sponsorship** is also mandatory for a public service — citizens must not have to
acquire a "gas token". Starting with EOAs, none of this can be added later.

**Cost today:** deploying one contract. ~zero.

## Decision 2 — Strictly separate key domains + separate recovery

Three derivation paths, three lifecycles:

```
Identity key → credential presentation, pseudonym derivation.  Not recoverable*. Not delegable.
Asset key    → chain transactions, value transfer.             Recoverable. Delegable within limits.
Agent key    → transactions within a delegation.               Time-limited. Revocable instantly.
```

**Recovery separation (binding):** the recovery mechanism applies **only to the asset key/account**. The identity key and
[[t:credential|credentials]] are **never** part of it — otherwise the "recoverers" could take over the identity.
(*Identities/[[t:pseudonym|pseudonyms]] are re-derived deterministically from the master seed; credentials are requested
again from the [[t:issuer]] — this is re-derivation or re-issuance, not "recovery".)

**Recoverer composition (decided 2026-08-06):** asset wallet recoverers are **user-chosen** (family/trusted persons +
**optionally** an institution), with an M-of-N threshold and a time lock. **A mandatory state institution is NOT a
recoverer** — that would bring exactly the censorship/leverage paradox avoided in [[PM-AUTH-0001]] back in through money.
Asset recovery is a mechanism **separate from and independent of** identity escrow ([[SPEC-BC-0002]] guardians).
Concrete M-of-N, time-lock duration and abuse scenarios → PM-ID-0003.

**Cost today:** three derivation paths in the wallet. ~one day of work.

## Decision 3 — The delegation registry is scope-generic

The agent delegation contract is written today, but scopes stay outside payments (`logistics:verify`, `health:read`).
The `scope` field is designed to be **extensible** rather than a fixed string; adding a `pay:*` scope later becomes a
one-line change. Writing a payment-specific delegation system later would invalidate every existing delegation.

Invariant principles of delegation (detailed in SPEC-AGENT-0001): an agent has no identity of its own, only derived
authority; **no indefinite delegation** (`validUntil` mandatory); **instant revocation (kill switch)** without conditions;
**responsibility lies with the principal**; every transaction is logged with its delegation reference; an agent **cannot
present** identity credentials (transactional authority only).

## Decision 4 — Credential gating as a generic primitive

The rule "this transaction requires that credential" should be a general contract library, not a payment-specific one:

```solidity
modifier requiresCredential(bytes32 credentialType, bytes calldata proof) { ... }
```

Today in document verification; tomorrow in a rule such as "only KYC'd accounts may make this transfer" — **the same
primitive** works. It is aligned with the [[SPEC-BC-0001]] StatusList/IssuerRegistry checks.

> **Narrowed (2026-09-10, [[SPEC-AGENT-0001]]):** this decision was **narrowed**. Since [[ADR-0008]] moved the status list
> off-chain, the chain cannot see whether a credential is valid; therefore **there is no on-chain credential gating in
> phase 0** and `requiresCredential` is not written as a chain primitive. Verification is done off-chain
> ([[SPEC-API-0001]]). The path to open it in the future (a signed statement by a registered [[t:verifier]] + freshness +
> [[t:nonce]]) is recorded as a design in [[SPEC-AGENT-0001]] §4. Decision 3 (delegation) is unaffected.

## Decision 5 — Do not issue an own token, but do not forbid token standards

Governance and technical architecture state explicitly that Tamga **has no currency of its own** (this sets up the
relationship with central banks correctly from the start). But ERC-20 deployment is **not forbidden** at chain level — a
central bank or licensed bank may later want to issue tokenised deposits here; Tamga is then **the host, not the issuer**.

**Constraint:** the right to issue tokens is tied to an **allow-list** — only institutions in the `FINANCE` category of the
Issuer Registry, authorised by the state concerned ([[ADR-0002]] `onlyOwnerState` + [[SPEC-BC-0001]] IssuerCategory). This
prevents unauthorised token spam and gives regulators confidence.

---

# Rationale

- **Asymmetry of irreversibility:** the five decisions cost ~zero today; taking them later requires user migration. The
  asymmetry clearly says "take them now".
- **Consistency with the strategy:** the hooks are not features; none of them opens a payment capability today. They do
  not increase the risk of losing focus ([[PM-AUTH-0001]]).
- **Consistency with sovereignty:** decision 2 (user-chosen recovery) and decision 5 (FINANCE allow-list) keep the
  censorship paradox away from money.

---

# Consequences (binding for contracts/)

1. The `contracts/` wallet is designed as a **contract account** (decision 1); an EOA assumption is not accepted.
2. The wallet/SDK produces **three derivation paths** (decision 2); recovery only on the asset path.
3. The delegation contract makes `scope` **extensible** (decision 3).
4. `requiresCredential` lives as a **shared library** in `shared/` or `contracts/lib` (decision 4).
5. **No** native token; ERC-20 deployment is gated by the FINANCE-issuer **allow-list** (decision 5).

---

# Relations

- [[PM-AUTH-0001]] — the strategy rationale for this ADR.
- [[ADR-0001]] — Besu/EVM (layer A account model).
- [[ADR-0002]] — sovereignty-first governance (FINANCE permission, `onlyOwnerState`).
- [[SPEC-BC-0001]] — Issuer Registry / IssuerCategory / StatusList (data source for credential gating).
- [[SPEC-BC-0002]] — accountable disclosure (identity escrow, separate from asset recovery).
- PM-ID-0003 (planned) — details of asset wallet recovery composition.
- [[SPEC-AGENT-0001]] — agent delegation surface (decision 3) + narrowing of credential gating (decision 4).

The five hook decisions were fixed on 2026-08-06. The `contracts/` implementation follows these constraints. Recovery
composition and agent delegation details were referred to separate documents. **2026-09-10:** decision 4 was narrowed by
[[SPEC-AGENT-0001]] (no on-chain credential gating in phase 0; see the note under decision 4).
