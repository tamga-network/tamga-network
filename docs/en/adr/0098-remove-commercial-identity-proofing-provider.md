---
document_id: ADR-0098
title: "The commercial remote identity verification provider is removed; no identity credential on the real network"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-25
last_updated: 2026-11-25
summary: >
  The identity service's path that worked with a commercial remote identity verification provider (document photo + face +
  liveness) is removed, on the real network and in the sandbox. On the real network the identity service issues no identity
  credential, no pseudonym seed and no driving licence data until a real identity path (the state PID, identity from a qualified
  e-signature certificate, or the ID card chip) is opened by a separate ADR. In the sandbox the only path is a sample person
  (treated as if the PID was issued and identity verified). Contact credentials and the PIN offer for institution credentials are
  not affected. The chip path stays closed; a face matching method is added to its opening condition. Supersedes ADR-0040;
  amends ADR-0011, ADR-0039 and ADR-0083. Accepted: 2026-11-25.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0020]]", "[[ADR-0021]]", "[[ADR-0022]]", "[[ADR-0031]]", "[[ADR-0038]]", "[[ADR-0039]]", "[[ADR-0040]]", "[[ADR-0080]]", "[[ADR-0083]]", "[[ADR-0094]]", "[[SPEC-ID-0003]]"]
translation_of: ADR-0098
source_version: 1.0.0
---

# In short

Under EU rules, a person's core identity (PID) is issued only by the state or a body the state authorises. The provisional
identity credential Tamga issued through a commercial provider from a document photo and a face scan is not the right path: it
did not meet the EU remote identity proofing standard (ETSI TS 119 461) and on the real network it was open by invitation only.
This path is removed. Until a real identity path exists, the real network issues no identity credential; in the sandbox everything
is tried with sample persons.

# Context

- [[ADR-0011]] made Tamga a provisional issuer of an identity credential while no state PID provider exists; identity proofing
  was done with a commercial remote verification provider. [[ADR-0040]] opened the same provider to anyone in the sandbox.
  [[ADR-0039]] took driving licence data from a separate flow of the same provider. [[ADR-0083]] K1(a) left the face and liveness
  check of the chip path to this provider.
- TS 119 461 mapping, 2026-11-24: the photo path does not fit the standard's remote proofing use cases; the compliance target is
  the chip path. Project management called the photo path a "non-standard fallback" the same day.
- No institution has joined the real network; identity credentials were issued there only by invitation, for testing.
- Project management (2026-11-25): identity has to come from the state; remove the commercial provider path and work towards the
  right path; until then, issue no identity credential on the real network and continue in the sandbox with sample persons.

# Decision

## K1 — The provider path is removed

All identity service code and settings that talk to the commercial remote identity verification provider are removed: session
start, callback and webhook, the invite path, provider quotas, the driving licence flow, the face check component of the chip path,
and the provider side of the review queue and retention jobs. The source remains in history; reusing it needs a new ADR. Ending
the account and contract with the provider is with project management.

## K2 — No identity credential on the real network

On the real network the identity service does **not** issue: the identity credential (`urn:tamga:id:IdentityAttestation:1`), the
pseudonym seed (`urn:tamga:id:PseudonymSeed:1`, [[ADR-0031]] — derived from the person's identity) and driving licence data
([[ADR-0039]]). The service rejects requests for these types with a clear error; on the real network the wallet's identity screen
says "not issued yet". Reopening happens only with a real identity path and a separate ADR. Candidates:

1. the PID of the state or a body it authorises (`pid_providers[]` in the list, empty today);
2. identity from a qualified e-signature certificate ([[ADR-0083]] K12, [[SPEC-ID-0003]] T3): the qualified certificate provider
   has identified the person under law;
3. the ID card chip ([[ADR-0083]]), under the conditions in K4.

Identity credentials already issued by invitation on the real network stay valid until they expire; they are not renewed (renewal
requires identity verification again). The identity service's entry in the real network's trust list stays (for contact
credentials and for verifying unexpired credentials); only its authentic source description drops the provider name. The
app-store review code path ([[ADR-0033]]: a separate review issuer with simulated records, no real person) is not affected.

## K3 — In the sandbox, sample persons only

In the sandbox the identity flow works only with the fake provider ([[ADR-0038]] SB3): the person picks one of the sample persons,
treated as if the PID was issued and remote identity verification was done. The "Verify with your real identity" option and the
invite mode are removed; [[ADR-0040]] is superseded. The sandbox's representative PID authorities ([[ADR-0094]]), driving licence
trials (with the fake provider's sample data) and the "Is this you?" final confirmation ([[ADR-0080]]) stay as they are.

## K4 — The chip path stays closed

The chip path code ([[ADR-0083]] K11) stays behind the closed switch. The chip proves the card is genuine and carries the state's
signature; it does not prove that the holder of the card is its owner. Since the provider doing this check is removed, a condition
is added to the opening: besides the legal opinion, a face matching and liveness method (a provider or another way) is chosen by a
separate ADR. The face check interface remains only with its fake implementation, for local tests.

## K5 — Institution credentials without an identity credential

The wallet is set up and used without an identity credential. On the real network, institution credentials are issued during this
period only by ways that do not need identity: the PIN offer ([[ADR-0020]] K3 item 6; the PIN travels on a channel separate from the
offer link) and tickets. The identity-bound offer ([[ADR-0020]] K3) and the person-initiated lookup path ([[ADR-0020]] K4) need an
identity credential; until a real identity path opens they work only in the sandbox. The `fetch` operation of the institution
source endpoint does not change.

# Rationale / alternatives

| Option | Decision | Why |
|---|---|---|
| Keep the provider path on the real network by invitation | rejected | Non-standard; does not replace the PID; contrary to the "everything real" principle |
| Switch to a domestic provider | not now | The same questions (TS 119 461, biometrics law) remain; the method is chosen in the ADR of K4 |
| Disable the code without deleting it | rejected | An unused integration carries maintenance and secret key burden; it stays in history |
| Remove it, open the real path by a separate ADR | **accepted** | The right path is the state PID or an identification the state supervises; the sandbox carries the trials |

# Invariants

| Code | Rule |
|---|---|
| IDR1 | The identity service does not talk to a commercial remote identity verification provider; reconnecting needs an ADR. |
| IDR2 | On the real network the identity service does not issue `IdentityAttestation`, `PseudonymSeed` or driving licence data; reopening only by a real identity path ADR. |
| IDR3 | In the sandbox the identity flow works only with the fake provider; no real person's document or face is processed. |
| IDR4 | The chip path does not open without the legal opinion and a chosen face matching method. |

# Consequences

- Identity service: provider code, settings and tests are deleted; the types above are rejected on the
  real network; the sandbox works as before with the fake provider. Provider environment variables and the webhook address are
  removed from the server.
- Wallet: provider addresses leave the allowlist of the identity verification web view; on the real network the identity screen
  says "not issued yet". Setup without an identity credential does not change.
- Documents: [[SPEC-ID-0003]], the identity rulebook, the sandbox guide (real identity trial section), institution guides,
  framework documents and privacy notices are updated so they no longer mention the provider.
- On the real network, "Sign in with Tamga" (pseudonyms) and identity-matched institution credentials are not available until a
  real identity path arrives.
- Amended decisions: [[ADR-0011]] (proofing method), [[ADR-0039]] (driving licence data source), [[ADR-0040]] (superseded),
  [[ADR-0083]] K1(b) photo path and K11 opening condition.

# Status

Accepted: 2026-11-25, project management.
