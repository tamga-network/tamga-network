---
document_id: SPEC-CRED-0001
title: "Credential format and protocols"
status: Active
version: 1.0.0
created: 2026-09-03
last_updated: 2026-11-04
summary: >
  Defines the canonical format of Tamga credentials and the issuance and presentation protocols. The primary format is
  SD-JWT VC (selective disclosure built in, the main EUDI ARF format); the secondary format is mdoc / ISO 18013-5 (active for identity types, planned for
  the others; offline and in-person presentation). Issuance uses OpenID4VCI, presentation OpenID4VP, signatures ES256 (P-256). Holder
  binding is MANDATORY: a credential is always bound to the wallet's device key via `cnf` (key binding) — the only fix for
  "the hidden flaw in the university idea" (a credential collected into someone else's wallet). The short-lived Wallet Instance
  Attestation (WIA) and the key attestation (KA) vouch for the wallet and its key store ([[ADR-0025]]). Revocation is delegated to the Token Status List ([[SPEC-BC-0001]] §5). A credential
  or its content is NEVER written to the chain ([[PM-TRUST-0001]]).
translation_of: SPEC-CRED-0001
source_version: 1.0.0
---
**This specification summarises the format in which Tamga credentials travel and the protocols used to issue and present
them.** It is the starting point for every developer joining the network.

**When to read**

- First read the [Credential formats](/concepts/credential-formats) concept page.
- When you want to see which format, protocol and signature algorithm were chosen, and why.
- Next: [[SPEC-CRED-0002]] for byte-level detail, [[SPEC-PROTO-0001]] for issuance, [[SPEC-PROTO-0002]] for presentation.

**In brief.** A Tamga credential is primarily an [[t:SD-JWT-VC]]; the identity credential is also issued as an [[t:mdoc]]
(ISO 18013-5). The credential travels from the institution to the wallet with [[t:OpenID4VCI]] and from the wallet to the
verifier with [[t:OpenID4VP]]; the signature is ES256. Every credential is bound to a key on the person's device, so a
credential copied to another device cannot be used. The credential and its content live only in the wallet; the network
publishes only the institutions' authorisation and the revocation status.

---

# Scope

This specification defines the **carrier format** and the **protocols** of the [[t:credential]] in the trust layer.
[[SPEC-BC-0001]] answers "what is on the chain" ([[t:issuer]]/status registry); this document answers "what does the
credential in the wallet look like and how does it flow".

**Invariant principle ([[PM-TRUST-0001]]):** the credential and its content are kept **in the wallet** and are **never**
written to the chain. The chain holds only the issuer's authorisation (registry) and the revocation status (status list
pointer).

The decisions are fixed by [[ADR-0006]]. This is the formal counterpart of the trust framework working note (Part K).

---

# 1. Format decisions

| Topic | Decision | Rationale |
|------|-------|---------|
| **Credential format (primary)** | **SD-JWT VC** | Selective disclosure built in, main EUDI ARF format, plenty of libraries, markedly simpler than JSON-LD |
| **Credential format (secondary)** | **mdoc / ISO 18013-5** — **active for the identity attestation** (D-CRED-5, [[ADR-0013]]); planned for other types | Safari/iOS Digital Credentials API supports only mdoc; ARF PID precedent; in-person/offline presentation (BLE, state stage) |
| **Issuance protocol** | **OpenID4VCI** | De facto standard; fits the institution's existing OIDC infrastructure |
| **Presentation protocol** | **OpenID4VP** | Same ecosystem, easy verifier integration |
| **Signature algorithm** | **ES256 (P-256)** | Universal support in mobile secure elements and HSMs |
| **Holder binding** | `cnf` + device key — **mandatory** | §3; the only fix for the holder binding gap |
| **Revocation** | **Token Status List** (bitstring) | Same as [[SPEC-BC-0001]] §5; list off-chain, pointer on-chain |
| **Anti-correlation** | Batch issuance (single-use copies) — **in operation**: packages of 10 copies, automatic refresh ([[ADR-0023]], [[ADR-0059]]) | The same copy is not shown to two verifiers |

The `did:tamga` [[t:pseudonym]] profile (SPEC-ID-0001) and the X.509 issuer identity ([[SPEC-ID-0002]]) are embedded
in these formats (issuer = X.509; [[t:holder]] = pseudonym key).

---

# 2. SD-JWT VC structure

An SD-JWT VC has three parts:

```
<Issuer-signed JWT> ~ <Disclosure 1> ~ <Disclosure 2> ~ ... ~ <Key Binding JWT>
```

- **Issuer-signed JWT:** the core, signed by the issuer with ES256. `iss` = the issuer identifier (resolves to the X.509
  `issuerId`, [[SPEC-ID-0002]]); claims that can be revealed with [[t:selective-disclosure]] are embedded as
  **[[t:salted-hash|salted hashes]]** (the `_sd` array).
- **Disclosures:** each [[t:disclosure]] is `[salt, claim_name, value]` — the holder attaches only the ones it wants to
  present; the rest stay hidden without breaking the issuer signature.
- **Key Binding JWT ([[t:KB-JWT]]):** the presentation-specific part signed by the holder with the device key (§3).

Mandatory issuer claims: `iss`, `iat`, `vct` (credential type), `cnf` (holder public key), `status` (Token Status List
pointer). `exp` depends on the credential type (short TTL for a student certificate, long for a diploma).

> **Data minimisation:** identifiers such as the national ID number (TCKN) are included only when mandatory, and then as a
> selectively disclosable claim; the [[t:verifier]] policy ([[PM-ASSUR-0001]]) can put them on its "not requested" list.

---

# 3. Holder binding — mandatory (critical security decision)

## The problem: "the hidden flaw in the university idea"

The wrong assumption: *"If a student receives a credential with the university's approval, that student is a real
person."* This is **incomplete.** The university confirms that the student *exists*; it does not confirm **that the wallet
belongs to that student.** Attacks:

- A student has the certificate collected into a friend's wallet.
- From an account whose student-portal password was stolen, the credential is written into someone else's wallet.
- One person collects the same credential into several wallets and sells them.

In that case the system **silently lies** — worse than failing openly. In the literature this is the
**[[t:holder-binding]]** problem, and it is the one real security gap that could sink a pilot.

## The fix: `cnf` key binding — mandatory without exception

At issuance every credential is bound to the holder's **device key**: the holder's public key is embedded in the
issuer-signed JWT as the `cnf` (confirmation) field. At presentation the holder signs a **KB-JWT** containing the
verifier's [[t:nonce]] with that private key. The verifier:

1. Verifies the issuer signature (was the issuer acceptable at the credential's `iat` → [[SPEC-BC-0001]]
   `isCredentialAcceptable`; `isValidIssuer` is the issuance-time question).
2. Verifies that the key in `cnf` signed the KB-JWT → **the party presenting the credential controls the private key bound
   at issuance.**
3. Verifies nonce + audience + `iat` freshness (replay protection).

The key is generated in the device's **secure element** (Secure Enclave/StrongBox) and can never be exported → the
credential cannot be transferred.

### What `cnf` does not prove (scope limit)

This distinction is critical and easily overstated. `cnf` + KB-JWT proves:

> The holder at presentation = the holder at issuance (the same key is under control).

It does **not** prove:

> The human in front of you is the person named in the credential.

`cnf` binds to a **device key**, not to a **human**. If the holder hands the device and PIN to someone else, that person
presents a credential with a valid signature and valid key binding; no step of the verification chain fails.

So `cnf` closes the **first two** of the three attacks above (the credential being written into the wrong wallet from the
start) and transferability; it does **not** close **voluntary device sharing**.

**What solves identity matching:** combined presentation — in the same OpenID4VP request the credential and the state
identity credential ([[t:PID]]) are presented together, **bound to the same `cnf` key**; the PID carries the identity. In
In the initial stage there is no PID, so identity matching is **procedural** (the verifier compares `family_name`/`given_name`/
`birth_date` against an identity document seen separately). This is the same level of strength as what is done with paper
documents today — not a regression but a deferred improvement. Detail: [[SPEC-SCHEMA-0002]] §1.2.

## Holder binding in the issuance flow (effect on assurance)

| Method | How | Holder level produced ([[PM-ASSUR-0001]]) |
|--------|-------|---------------------------------------------|
| **Remote binding** | The student logs in to the student portal → the wallet public key is proven to the issuer via OIDC/OpenID4VCI → `cnf` is bound | T1/T2 (as strong as the portal's security; improves with 2FA) |
| **In-person binding** | At the institution's desk an officer sees the physical ID → scans the QR in the wallet → binding | T2/T3 (institution = Registration Authority) |

---

# 4. Wallet attestations: WIA and KA

The wallet itself carries proof as well. Sooner or later the issuer asks: *"Is this a genuine wallet of a wallet provider registered
on the trust list, or a fake client somebody wrote; and where is the credential key kept?"* Two separate attestations answer
this ([[ADR-0025]]; detailed rules in [[FW-POL-0002]]):

- **Wallet Instance Attestation ([[t:WIA]]):** the short-lived proof with which the wallet application introduces itself to the
  issuer. Its lifetime is **under 24 hours**; for every issuance it is issued with a new proof-of-possession (PoP) key and a new,
  unlinkable status list entry (WIA1), so the provider does not learn how many institutions the wallet deals with.
- **Key attestation (KA):** states in which store (software, Secure Enclave, StrongBox) and with which user authentication the
  credential keys are held; credentials are bound to the KA's `attested_keys`. The level rests on a verified state; an unverified
  claim is never written into a KA.
- Both attestations are signed by **the wallet provider of the organisation offering the wallet**; the provider's signing key is
  registered on the trust list (`lotl.wallet_providers[]`). The network does not operate a wallet provider; it lists them
  ([[ADR-0042]]).
- The attestations feed the "authenticator strength" dimension of holder assurance ([[PM-ASSUR-0001]]): software key → low;
  hardware + PIN → high.

**Implemented profile ([[ADR-0025]]):**

| Field | Value |
|---|---|
| WIA format | JWT, `typ: oauth-client-attestation+jwt` (OpenID4VCI 1.0 Annex E), `alg: ES256`, `x5c` = wallet provider certificate; fields `sub`, `wallet_name`, `wallet_version`, `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk` |
| WIA lifetime | Under 24 hours; `client_status.exp` at least 31 days ahead |
| KA format | JWT, `typ: key-attestation+jwt` (OpenID4VCI 1.0 Annex D); fields `attested_keys`, `key_storage`, `user_authentication`, `certification`, `key_storage_status {status, exp}` |
| Transport (issuance) | WIA: `OAuth-Client-Attestation` + `OAuth-Client-Attestation-PoP` on the PAR and token requests; KA: `key_attestation` in the header of the `jwt` proof — [[SPEC-PROTO-0001]] §11.1 |
| Revocation | The provider publishes two Token Status Lists (WIA entries, KA types), each with at least 10,000 entries |
| Provider side | The wallet provider of the organisation offering the wallet; the network does not operate one, it lists them ([[ADR-0042]]). Tamga Wallet's provider is run by the wallet's operator at `provider.tamgawallet.com` (live; on the trust list as `TAMGA-WP-1`, `ACTIVE`); it registers a wallet unit only with device evidence |
| Presentation | WIA and KA are not sent to the verifier; they are used only during issuance |

---

# 5. Revocation (delegated)

Credential [[t:revocation]] is **not redefined** in this specification; it is delegated to the
**[[t:status-list|Token Status List]]** of [[SPEC-BC-0001]] §5:

- The `status` claim in the issuer-signed JWT points to the list URI + index.
- The list is off-chain (hosted by the issuer, signed and versioned); the chain holds only URI + hash + version + bitmap
  ([[SPEC-BC-0001]] `StatusList`).
- Privacy: `listSize >= 100,000`, random index allocation ([[SPEC-BC-0001]]).

**Anti-correlation (in operation):** showing the same status index to different verifiers is a tracking vector. The fix is
**batch issuance** (single-use credential copies): the issuer issues a package of 10 copies each time, every copy bound to its own
key and status list entry; the wallet refreshes a shrinking package by itself ([[ADR-0023]], [[ADR-0059]]).

---

# 6. End-to-end flow

```
Issuance (OpenID4VCI):
  1. The holder's wallet receives the issuer's credential offer
  2. The wallet generates/selects the device key → presents the public key (cnf candidate)
  3. The issuer verifies holder binding (remote OIDC / in-person desk)
  4. The issuer signs the SD-JWT VC with ES256, embedding cnf + status index
  5. A status index is reserved (SPEC-BC-0001) — NO content is written to the chain

Presentation (OpenID4VP):
  6. The verifier sends a presentation request (nonce + audience + requested claims)
  7. The holder selects only the required disclosures + signs the KB-JWT
  8. Verifier: issuer signature + cnf/KB-JWT + status + assurance policy
     (PM-ASSUR-0001) → accept/reject
```

At no stage is personal data written to the chain; verification is free, done with three view calls
(issuer/status/recognition, [[SPEC-BC-0001]] §6).

---

# 7. Chain-independence constraint

These formats and protocols work **independently of the chain**: the verifier library resolves issuers through a
`TrustedListProvider` interface and does not know whether a file (in the initial stage, a signed [[t:trust-list]]) or a chain (from the state stage on, a
registry) sits behind it. This means the pilot does not wait for Besu (see [[ARCH-0001]], initial stage). The decision lies on the
[[ADR-0006]] + [[ADR-0001]] line.

---

# Security and privacy notes

- **Holder binding is mandatory without exception** — if it is switched off, the system silently lies.
- **Key in hardware** (Secure Enclave/StrongBox); a software key is not accepted (the KA states this).
- **Selective disclosure by default** — only the necessary claims; data minimisation.
- The **batch issuance** anti-correlation measure is in operation ([[ADR-0059]]).
- An **independent security audit** before production (KB-JWT replay, disclosure liveness, WIA/KA forgery) is mandatory.

---

# Open topics

1. Schema management of the `vct` (credential type) registry (alignment with the [[SPEC-BC-0001]] schema registry).
2. Definition of the mdoc/ISO 18013-5 profile for types other than identity (planned).
3. ~~When to enable batch issuance~~ — closed: in operation ([[ADR-0023]], [[ADR-0059]]).
4. The link of WIA/KA to device [[t:attestation]] sources (Play Integrity / App Attest) ([[FW-POL-0002]]).

---

# Related documents

- [[PM-ASSUR-0001]] — assurance levels ([[t:LoA]]); this format carries those levels.
- [[PM-TRUST-0001]] — a credential is never on the chain.
- [[SPEC-BC-0001]] — issuer registry (source for signature verification) + Token Status List (revocation).
- [[SPEC-ID-0002]] — issuer X.509 identity (`iss` → `issuerId`).
- SPEC-ID-0001 — holder pseudonym key (`cnf`).
- [[ADR-0006]] — acceptance record of these format decisions.
- ACA-ID-0001 — DID/VC/selective disclosure mechanics (background).
- [[RS-EIDAS-0001]] — the place of SD-JWT VC / OpenID4VCI-VP in the EUDI ARF.

---

# Status

**In force** — version 1.0.0 (2026-10-02).
