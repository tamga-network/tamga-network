---
document_id: ADR-0040
title: "Invited real identity checks in sandbox"
status: Active
version: 1.0.0
created: 2026-10-04
last_updated: 2026-10-04
summary: >
  In the sandbox, identity verification keeps using the fake provider by default. Only with an invitation code issued by the
  sandbox administrator can the real identity verification steps (document, liveness, face) be tried: a separate application
  of the provider, opened only for the sandbox, is used, and the real network's key never enters the sandbox. Before scanning,
  the person confirms a clear warning; only given name, family name and date of birth go into the credential (the real
  identity and document numbers are not written), the provider session is deleted as soon as the credential is issued, and
  everything is deleted at the nightly reset. Changes point K4 and rule SB3 of ADR-0038.
domain: Identity
translation_of: ADR-0040
source_version: 1.0.0
---

# In brief

Everything in the sandbox is fake: the people are made up, and identity verification ends with an "Approve" button on a fake
provider's screen. That is enough to test a wallet's flow, but a wallet developer or an institution also wants to see the real
identity verification steps (scanning the document, liveness, face match) as they look inside the app.

This decision opens the real steps in the sandbox **by invitation only**. Everyone without an invitation keeps testing with
the fake provider.

# Context

- [[ADR-0038]] K4 and `ADR-0038/SB3`: the sandbox holds no real personal data; identity verification uses a fake provider.
- Identity verification happens only in the identity service ([[ADR-0011]], `SPEC-ID-0003/IDP3`); person fields are kept
  until the credential is issued and images are not stored (`SPEC-ID-0003/IDP9`). The identity service issues a
  non-qualified EAA ([[ADR-0022]]).
- The wallet is moving identity verification inside the app (in-app browser). Today the only way to try these screens with
  the real provider is the real network, where no testing or trials take place.
- Project management's direction: in the sandbox, open the real provider steps with a separate sandbox application of the
  provider and only with an invitation code; keep fake verification as the default.

# Decision

**K1 — Fake by default.** In the sandbox, identity verification uses the fake provider by default; every flow without an
invitation code goes to the fake provider as before.

**K2 — Invitation code.** The real steps open only with a valid invitation code. Only the sandbox administrator creates codes
(the administrator section of the sandbox page, with the administrator token; the section is closed to the outside and opens
only from the server itself). There are two kinds: **personal**
(single-use; valid for at most 7 days) and **timed** (for an event or a workshop; at most 72 hours and at most 25 uses). A use is counted when the provider session is **opened**: a personal code cannot
open a second session, a flow never opens a second session, and the code must still be valid (not revoked) when the credential
is issued. A code
has at least 128 random bits and only its keyed hash is stored; the plain code is shown once, when it is created, and is
never logged. The code is entered on the identity service's privacy notice page; failed attempts are limited per flow and
service-wide; in the administrator section a wrong token is slowed down by exponential delay (no permanent lock). Codes are deleted at the nightly reset.

**K3 — Separate provider application.** The invited flow runs with a **separate application opened only for the sandbox** at
the identity verification provider: it has its own API key and its own workflow. The real network's provider key never enters
the sandbox: a sandbox process that sees a key under the real network's variable names does not start; the sandbox key is
given under separately named variables, and the real network rejects those names.

**K4 — A clear warning before scanning.** Once the code is accepted, a separate warning page is shown before going to the
provider, and the person cannot continue without ticking the confirmation: "This is a test environment; you are trying it with
your real identity; your data is deleted every night; the verification session at the provider is deleted as soon as the
credential is issued." The same page carries a short privacy notice and the person's rights.

**K5 — Minimal data.** From the person, only **given name, family name and date of birth** go into the sandbox credential
(including the derived over-18 flag, the country code and the document type). The real identity number and document number
are not written into the credential; in their place every credential gets a new, random value that is clearly a test value
(`SANDBOX-…`). The sandbox credential therefore cannot be linked to credentials or pseudonyms of the real network. The identity
service keeps person fields in memory only until the credential is issued (`SPEC-ID-0003/IDP9`); images never reach Tamga.

**K6 — The provider session is deleted at once.** As soon as the credential is issued, the verification session at the
provider (including images) is deleted; it is also deleted if verification fails or is abandoned. The sandbox identity
service does not keep the provider session identifier in the credential record.

**K7 — Deleted every night, no personal data in logs.** At the nightly reset ([[ADR-0038]] K5) codes, credential records and
all flow state are deleted. Logs contain only the event name, the code identifier and counts; never a name, a date of birth,
a code or a provider response.

**K8 — Limits of invitation.** Until the privacy notice has passed legal review, invitation codes are given only to the project
team and to a limited number of test users who accept the purpose of the invitation in writing. The invited flow is not
opened for driving licence information ([[ADR-0039]]); in the sandbox that type is tried only with the fake provider.

# Invariants

| Code | Rule |
|---|---|
| RI1 | In the sandbox, the real identity verification provider is reached only with a valid invitation code; a flow without an invitation code uses the fake provider. |
| RI2 | The real network's identity verification provider key is never used in the sandbox; the sandbox runs with a separately named key of a separate provider application, and the real network does not accept those names. |
| RI3 | In the invited flow, the person explicitly confirms the test environment warning before being redirected to the provider. |
| RI4 | The real identity number and document number are not written into a sandbox credential; only given name, family name and date of birth (and the derived age flag) come from the person. |
| RI5 | The verification session at the provider is deleted at once when the credential is issued or when the flow does not end with a credential; the sandbox identity service does not keep the session identifier in a permanent record. |
| RI6 | Invitation codes are stored only as keyed hashes; the plain code, the name, the date of birth and the provider response are never logged; all are deleted at the nightly reset. |

`ADR-0038/SB3` was rewritten by this decision (see ADR-0038).

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| Only the fake provider in the sandbox (today) | rejected | In-app identity verification screens and real failure cases cannot be tried before going to the real network. |
| The real network's provider key in the sandbox | rejected | Test traffic mixes with the real network's account and records; the real network's secret key moves to a test server. |
| Real verification open to everyone | rejected | Nobody knows who is trying with a real identity; cost and abuse are unbounded. |
| **Separate provider application + invitation code + minimal data** | **accepted** | The real steps can be tried; nothing mixes with the real network; the person tries knowingly; minimal data goes into the credential. |
| Also writing the real identity number into the credential | rejected | The sandbox credential could be linked to credentials and pseudonyms of the real network; not needed for testing. |

# Consequences

- In sandbox mode the identity service carries two providers at once: the fake provider (default) and the invited real
  provider; the choice is made for a flow once the invitation code is verified.
- The sandbox setup script rejects a provider key that comes under the real network's variable names; the sandbox key and
  workflow are set on the server by hand under separately named variables.
- The sandbox page gets an invitation code section (with the administrator token) and a "try with your real identity" page;
  the Sandbox guide is updated.
- A short KVKK privacy notice draft is prepared for the sandbox; invitations are given within the limit of K8.

# Status

**Accepted — 2026-10-04** (project management approval; the verbatim quote is in the private approval record). DECISIONS:
D-ID-9. Partly changes K4 and SB3 of [[ADR-0038]].
