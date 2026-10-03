---
title: Federation
---

# Federation

Tamga Network is not one list run from one centre. Each country keeps its own institutions in its own [[t:trust-list]];
Tamga brings these lists together and introduces them to each other. This model is called a **[[t:federation]]** ([[ADR-0035]]).

## One anchor, many lists

The wallet and the verifier know only one thing in advance: the fingerprint of the root that signs Tamga's list of trusted
lists ([[t:LOTL]]). The LOTL tells them the rest:

```
                     Tamga LOTL (root fingerprint pinned in the app)
                ┌──────────────┼──────────────────────┐
                ▼              ▼                      ▼
        Türkiye list      another member state   external list (e.g. the EU's
        (Tamga format)    (reserved)             wallet providers, ETSI)
           │                                          │
   issuers, verifiers,                       only the roles and credential
   root certificates                         types in its scope
```

- **National lists** are in the Tamga format; they hold that country's [[t:issuer|issuers]], [[t:verifier|verifiers]] and root
  certificates.
- **External lists** are countries' or the EU's own lists in the ETSI format ([[t:LoTE]]). The LOTL records their address, their
  signer and what they may vouch for (the scope) ([[ADR-0036]]).

## Why federation?

| Question | Answer |
|---|---|
| Who recognises an institution? | Its own country. Tamga does not decide in a country's place; what it does for Türkiye today on the state's behalf can be handed over. |
| Is another country's credential accepted? | Yes, if the country recognises that country (mutual recognition; step C3 in verification). |
| Can an EU wallet receive credentials from a Tamga institution? | Yes, once an external list that vouches for that wallet's provider has been added to the LOTL. |
| What if a list breaks? | Only questions that depend on that list answer "unknown"; the other lists are not affected. |

## The scope limit

An external list can vouch only for the work in its own scope. For example, a list that vouches only for identity providers
cannot add an institution that issues diplomas; such an entry is ignored. There is no external list in the LOTL today; each
addition is a separate approval.

## Hand-over

Today Tamga runs the Türkiye list, the registrar and the root certificate on the state's behalf. When the state takes these roles
over, only the address and the signer change for wallets and verifiers; institution identifiers and issued credentials stay valid.

## Later: a shared ledger

Once at least two independent operators take part, the same entries can move to a permissioned [[t:ledger]] ([[ADR-0009]]). The
reading interface (`TrustSource`) stays the same; applications do not change.

## More

- Connecting a country's list: [[GUIDE-0011]]
- Reading the lists in code: [[GUIDE-0006]]
- Format: [[SPEC-TRUST-0001]] · Rule: [[ADR-0036]]
