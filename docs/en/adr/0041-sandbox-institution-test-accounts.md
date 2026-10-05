---
document_id: ADR-0041
title: "Institution test accounts in the sandbox"
status: Active
version: 1.0.0
created: 2026-10-04
last_updated: 2026-10-04
summary: >
  An institution opens its own test institution from the sandbox page without email verification and, in the console it signs
  in to with a passkey, enters its own made-up records or uploads them as CSV. The test institution's signing certificates are
  issued automatically by a separate intermediate certificate authority in the sandbox (the sandbox root's private key is not
  on the server), and the institution is added to the sandbox trusted list with a "test institution" mark; the institution
  issues credentials and Tamga Verify verifies them in the sandbox. Everything is deleted every night. There is a warning and
  an identity number pattern check against real personal data, and count and rate limits against abuse. Changes K1 (no console
  in the sandbox) and K7 (self-registration is a later step) of ADR-0038 for institutions.
domain: Services
translation_of: ADR-0041
source_version: 1.0.0
---

# In brief

The example institutions in the sandbox serve wallet developers, but an institution wants to try its own credential with its
own data: "how does our diploma look in the wallet, what does a verifier see?". This decision lets an institution open its own
test institution in the sandbox in a few minutes, enter records, issue credentials and see the verification. Everything is
signed with test keys and deleted every night.

# Context

- [[ADR-0038]] K1: there is no institution console in the sandbox; K7: outside participants adding themselves to the sandbox
  list is a later step and needs a separate decision.
- [[ADR-0019]]: the Institution Console works with invitation + passkey; every query is bound to the session's institution. The
  sample registry ([[ADR-0020]]) is for trials only; on the real network this mode is locked in code.
- The private key of the sandbox root certificate is not sent to the server; the server holds only the keys of leaf
  certificates and of the list signer. Creating a new leaf certificate for a new institution on the server is therefore not
  possible today.
- Project management's direction: institutions that want to try should put their own data into the sandbox and try; personal
  data should be minimal.

# Decision

**K1 — Self-service test account.** From the "Try your institution" section of the sandbox page, an institution opens a test
institution without email verification and without an invitation: only a made-up institution name and the institution type
are asked (the name automatically ends with "(TEST)"). Invisible and direction characters are removed from the name; names
resembling institutions on the real or sandbox lists, official-body words (T.C., Ministry, Municipality, Governorship,
University …) and the names of Tamga or the provider are not accepted. The opening request is accepted only from the sandbox
page's own origin. No personal information such as a name, email or phone number is
asked. Opening creates a single-use console invitation for the institution's first administrator, who signs in to the console
with a passkey.

**K2 — The console opens in the sandbox only for test institutions.** The Institution Console runs again in the sandbox at
`console.sandbox.tamga.network`, but serves only the test institutions opened under this decision; the example institutions
from seed data stay without a console. Every console screen shows the "SANDBOX · TEST" mark and the warning "do not enter real
personal data". The trial registry lock of the real network stays as it is.

**K3 — Made-up records and a pattern check.** The institution enters records one by one or uploads them by pasting the
contents of a CSV file. Record screens carry a clear warning not to enter real personal data. A record with an 11-digit
number that passes the identity number checksum in any field is rejected (it could be a real identity number); deliberately
invalid numbers, like those of the sandbox's example people, are accepted.

**K4 — Intermediate certificate authority.** The sandbox has a separate intermediate CA that issues leaf certificates only to
test institutions: "Tamga Sandbox Test Institutions CA (TEST)". It is signed by the sandbox root on the computer where the
root key is kept; it can issue certificates only one level down (path length 0) and signs only certificates; a name constraint permits only sandbox test institution subject names. It is valid for at most
one year and is renewed before expiry on the computer where the root key is kept. Its private key
is on the sandbox server. The credential and status list signing certificates of a test institution are issued by this
authority for a short time (at most 30 days); credentials carry the leaf + intermediate chain and the verifier chains it to the
sandbox root. The root key is still never sent to the server.

**K5 — Automatic registration in the sandbox list.** As soon as a test institution is opened, it is added to the sandbox
trusted list and the list is re-signed. The record carries the `test_institution: true` mark, registration data filled with
sandbox values ([[ADR-0024]]) and the credential authorisation of the chosen type only. A test institution is verified in the
sandbox verifier like the example institutions; wallets and verifiers may show the mark.

**K6 — Deleted every night.** Test institutions, their accounts, passkeys, records, the records of issued credentials and
their certificates are deleted at the nightly reset ([[ADR-0038]] K5) and removed from the sandbox list. In the sandbox list
this is the only exception to the "records are never deleted" rule; there is no exception in the real network's list. The
7-day retention option was rejected (below).

**K7 — Abuse limits.** At most 30 test institutions at a time; service-wide at most 10 new institutions per 10 minutes; at most
200 records per institution; at most 200 rows in one CSV upload; at most 100 credential offers per institution per hour. Limits
are applied without using IP addresses; the offer limit is a single counter for the console, API keys and the internal endpoint.
When 30 institutions are reached, the oldest **empty** test institution (no records, no issued credentials, at least 30 minutes
old) is removed to make room; if there is none, the user is told to wait (the limit cannot be used up by anyone to lock others out).

**K8 — Phases.** Phase 1: education institution (student credential, diploma), console, records one by one and by CSV, offers
at the desk, verification in the sandbox verifier. Phase 2: event ticket institution (creating events in the console),
wallet-initiated issuance (matching by identity presentation) and API keys for test institutions. Self-registration of
verifiers and wallet providers (the rest of [[ADR-0038]] K7) needs a separate decision.

# Invariants

| Code | Rule |
|---|---|
| TI1 | A test institution exists only in the sandbox; its leaf certificates are issued only by the sandbox test institutions intermediate CA; the private key of the sandbox root is on no server. |
| TI2 | Every test institution carries `test_institution: true` in the sandbox list and its display name ends with "(TEST)". |
| TI3 | In the sandbox the Institution Console serves only test institutions; the trial registry mode cannot be opened on the real network. |
| TI4 | A test record carrying an 11-digit number that passes the identity number checksum is rejected; every record screen warns not to enter real personal data. |
| TI5 | Test institutions and their accounts, records, credential records and certificates are deleted at the nightly reset and leave the sandbox list. |
| TI6 | Limits on opening and using test institutions are applied without using IP addresses. |

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| Putting the root key on the sandbox server | rejected | If the server is compromised, anything can be signed under the sandbox root; the root pinned in wallets would have to change. |
| A pool of pre-generated certificates | rejected | Limited in number; manual work when the pool runs out; the institution name cannot be written into the certificate. |
| A self-signed institution certificate in the list | rejected | Breaks the rule that credentials chain to the root (step A3 of verification); behaves differently from the real network. |
| **A separate intermediate CA (path length 0, key on the sandbox server)** | **accepted** | The root stays offline; the intermediate issues only leaves; if compromised, only the intermediate is revoked and a new one is signed by the root. |
| Registration with email verification | rejected | Collects personal data; not needed for a trial. Abuse is held back by count and rate limits. |
| Keeping a test account for 7 days | rejected | Real data entered by mistake would stay longer; the sandbox's single, simple reset rule would break. The institution reopens in a few minutes the next day. |
| **Deleting every night** | **accepted** | The same rule as `ADR-0038/SB5`; minimal retention. |

# Consequences

- An intermediate CA is added to the sandbox PKI; it goes to the sandbox server with its own key and without the root's
  private key.
- The list publisher accepts a test institution registration in the sandbox (creates certificates, adds the record, signs the
  list); registrations live in the sandbox data folder and are deleted at the reset. An optional `test_institution` field is
  added to the trusted list specification.
- The issuer service loads a new test institution without restarting; the Institution Console opens again in the sandbox.
- A "Try your institution" section is added to the sandbox page and an institution walkthrough to the Sandbox guide. The
  sandbox needs a new address: `console.sandbox.tamga.network`.

# Status

**Accepted — 2026-10-04** (project management approval; the verbatim quote is in the private approval record). DECISIONS:
D-TRUST-4. Changes K1 and K7 of [[ADR-0038]] for institutions.
