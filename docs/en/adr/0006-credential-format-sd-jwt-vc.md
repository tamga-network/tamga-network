---
document_id: ADR-0006
title: "Credential format: SD-JWT VC"
status: Active
version: 1.0.0
created: 2026-09-03
last_updated: 2026-10-02
summary: >
  Fixes Tamga's credential format and issuance/presentation protocols as a DECISION: primary format SD-JWT VC, secondary
  mdoc/ISO 18013-5 (phase 2); issuance OpenID4VCI, presentation OpenID4VP, signature ES256 (P-256). Holder binding (`cnf` +
  device key) is MANDATORY WITHOUT EXCEPTION — the only fix for the gap of a credential being loaded into someone else's
  wallet (the holder binding problem). Wallet Unit Attestation (WUA) is in place from the start. Revocation is delegated to
  the Token Status List ([[SPEC-BC-0001]]). Full specification → SPEC-CRED-0001.
domain: Credentials
translation_of: ADR-0006
source_version: 1.0.0
---

# ADR-0006 — Credential format and protocols

**Status:** Accepted
**Date:** 2026-09-03
**Decided by:** Tamga Network project management
**Source:** `tamga-guven-cercevesi-v0.1.md` (sections F, G, K) — working note; full specification → [[SPEC-CRED-0001]].

---

# Context

Until now the [[t:credential]] format had been left as "planned" in the repository; [[SPEC-BC-0001]] referred to
[[t:SD-JWT-VC]] and the Token [[t:status-list|Status List]] but there was no formal format decision. In addition, the
"hidden flaw in the university idea" (a credential could be loaded into someone else's wallet) was open as a security gap.
This ADR closes both. It builds on [[ADR-0001]] (Besu/EVM) and [[ADR-0004]] (X.509 [[t:issuer]] identity).

---

# Decision

## Decision 1 — Format: SD-JWT VC (primary), mdoc (secondary, phase 2)

SD-JWT VC is the primary format: built-in [[t:selective-disclosure]], the main format of the EUDI [[t:ARF]], plenty of
libraries, simpler than JSON-LD. [[t:mdoc]]/ISO 18013-5 is secondary (phase 2; offline/in-person presentation, [[t:mDL]]
compatibility).

## Decision 2 — Protocols: OpenID4VCI (issuance), OpenID4VP (presentation)

The de facto standards ([[t:OpenID4VCI]], [[t:OpenID4VP]]); they sit on institutions' existing OIDC infrastructure and make
[[t:verifier]] integration easy.

## Decision 3 — Signature: ES256 (P-256)

Universal support in mobile secure elements (Secure Enclave/StrongBox) and HSMs.

## Decision 4 — Holder binding mandatory without exception (`cnf` + device key)

At issuance every credential is bound with `cnf` to a key **generated on the device** of the [[t:holder]]; at presentation
the holder signs the [[t:nonce]] with that key ([[t:KB-JWT]]). This is the **only** fix for the [[t:holder-binding]] gap
and cannot be switched off. The key is generated in hardware and cannot be exported → the credential cannot be
transferred.

## Decision 5 — Wallet Unit Attestation (WUA) from the start

The [[t:WUA]], which states the wallet's authenticity (hardware key, PIN active, no root/jailbreak, provider identity), is
opened **as a field and a flow from the start**, even if with simple content in the pilot — adding it later would require
migrating every wallet.

## Decision 6 — Revocation is delegated to the Token Status List

No separate revocation mechanism is defined; the [[SPEC-BC-0001]] §5 Token Status List is used (off-chain list + on-chain
pointer, min 100k entries, random index). Anti-correlation batch issuance is deferred to phase 2, with its place kept open
in the format.

---

# Rationale

- **EUDI alignment:** SD-JWT VC + OpenID4VCI/VP + ES256 is the main stack of the EUDI ARF → "compatible but independent"
  ([[PM-PH-0001]]) and cross-border interoperability.
- **Holder binding = reason to exist:** if this gap stays open, the system silently lies; its value drops to zero.
- **Irreversibility:** if format, binding and WUA are not set up correctly from the start, the entire wallet base has to be
  migrated later — the same "free today, impossible later" logic as [[ADR-0003]].

---

# Consequences

1. [[SPEC-CRED-0001]] is the full specification (format structure, KB-JWT, WUA, flows).
2. The `contracts/` and `sdk/` wallet generates a **device secure element** key + `cnf`; software keys are not accepted.
3. The verifier library works through the `TrustedListProvider` interface (chain-agnostic: phase 0 files / phase 1 ledger)
   — [[ARCH-0001]].
4. [[PM-ASSUR-0001]] holder assurance is tied to the WUA + binding method.

---

# Relations

- [[SPEC-CRED-0001]] — full specification of this decision.
- [[PM-ASSUR-0001]] / [[ADR-0005]] — assurance levels (the trust the format carries).
- [[SPEC-BC-0001]] — issuer registry + Token Status List (revocation).
- [[SPEC-ID-0002]] — issuer X.509 (`iss`), [[SPEC-ID-0001]] — holder pseudonym (`cnf`).
- [[PM-TRUST-0001]] — credentials are never on the ledger.

Format, protocols, signature, holder binding (mandatory) and WUA were accepted on 2026-09-03. mdoc and batch issuance
were referred to later phases.
