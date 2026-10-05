---
document_id: ADR-0040
title: "Real identity checks in sandbox"
status: Active
version: 1.0.0
created: 2026-10-04
last_updated: 2026-10-05
summary: >
  In the sandbox the identity flow offers two options: "Verify with your real identity (Didit)" and "Quick trial (made-up
  person)". The real path is open to everyone (the invitation code remains as an optional mode) and shares the real network's
  Didit account and identity workflow; there is no separate provider application. Because the free monthly allowance is shared
  with the real network, the sandbox has a daily and a monthly cap; when one is reached only the quick trial is open. Before
  scanning, the person confirms a clear warning; only given name, family name and date of birth go into the credential, the
  provider session is deleted at once and everything is deleted at the nightly reset. The accepted risks (shared allowance, the
  sandbox being able to read the provider key, webhooks reaching the real network) and their mitigations are written down.
  Changes point K4 and rule SB3 of ADR-0038.
domain: Identity
translation_of: ADR-0040
source_version: 1.0.0
---

# In brief

In the sandbox, people are made up and identity verification by default ends with an "Approve" button on a fake provider's
screen. That is enough to test the wallet's flow, but a wallet developer or an institution wants to see the real identity
verification steps (document scan, liveness, face match) as they look inside the app.

This decision opens the real steps in the sandbox **to anyone who wants them**. The first screen of the identity flow offers
two options: "Verify with your real identity (Didit)" and "Quick trial (made-up person)". The real path runs with the real
network's Didit account; the risks this brings are accepted openly below and limited.

# Context

- [[ADR-0038]] K4 and `ADR-0038/SB3`: the sandbox holds no real personal data; identity verification uses a fake provider.
- Identity verification happens only in the identity service ([[ADR-0011]], `SPEC-ID-0003/IDP3`); personal fields are held
  until the credential is issued and images are not stored (`SPEC-ID-0003/IDP9`). The identity service issues a
  non-qualified EAA ([[ADR-0022]]).
- The wallet is moving to identity verification without leaving the app (in-app browser). Today the only way to try these
  screens with the real provider is the real network, and no testing is done on the real network.
- The first text of this decision opened the real path only with an invitation code and a separate sandbox application of the
  provider. On 2026-10-05 project management gave two directions: the real path is open to everyone; no separate application
  is opened at the provider for the sandbox — the real network's provider account and its existing free identity workflow
  are used. This text was rewritten along those lines.

# Decision

**K1 — Two options, open to everyone.** In the sandbox identity credential flow, after the privacy notice is accepted, two
options are shown: "Verify with your real identity (Didit)" and "Quick trial (made-up person)". The quick trial goes to the
fake provider as before, and any flow without a choice is a quick trial. No invitation is needed for the real path. If the
real path is not configured (no provider key) or a cap is reached (K3), only the quick trial is shown with a plain message
("Today's quota is full — use the quick trial").

**K2 — The invitation code is an optional mode.** The invitation code infrastructure stays and is used only if the sandbox
administrator turns it on (`TAMGA_IDV_DIDIT_SANDBOX_MODE=invite`; default `open`). In that mode the real path opens only with a
valid invitation code. Only the sandbox administrator creates codes (the administration section of the sandbox page, with the
admin token; the section is closed to the outside and reachable only from the server itself). There are two kinds of code:
**personal** (single use; valid for at most 7 days) and **time-limited** (for an event or workshop; at most 72 hours and at
most 25 uses). A use is counted when the provider session is **opened**; when the credential is issued the code must still be
valid. A code has at least 128 bits of randomness and only its keyed hash is kept in the database; the plain code is shown once,
at creation, and is never logged. Wrong attempts are limited per flow and service-wide; in the administration section a wrong
token is slowed down with exponential delay. An invitation code cannot exceed the caps (K3).

**K3 — The real network's provider account and caps.** The real path runs **with the real network's Didit account and
identity workflow**, without opening a separate application at the provider. The values are given to the sandbox under
separately named variables (`TAMGA_IDV_DIDIT_SANDBOX_*`); the values are the same as the real network's. On the server the
sandbox setup script copies them from the real network's settings (`sandbox-setup.sh didit-from-main`); the values are never
printed or logged. The sandbox's default provider is always fake. Because the free monthly allowance is shared with the real
network, **every** real session opened in the sandbox (open or invited) counts toward two caps: a **daily cap** (default 15,
`TAMGA_IDV_DIDIT_SANDBOX_DAILY_CAP`) and a **monthly cap** (default 150, `TAMGA_IDV_DIDIT_SANDBOX_MONTHLY_CAP`; day and month
in Türkiye time). A use is counted when the provider session is opened; when either cap is reached no new real session opens.
The counter carries no personal data and is kept with this month's values across the nightly reset (the reset cannot bypass
the monthly cap). Each flow opens at most one real session.

**K4 — A clear warning before scanning.** When the real path is chosen, a separate warning page is shown before going to the
provider, and the person cannot continue without ticking the confirmation box: "This is a test environment; you are trying it
with your real identity; your data is deleted every night; the verification session at Didit is deleted as soon as the
credential is issued." The same page carries a short privacy notice and the person's rights; it also says that the provider
account is shared with the real network.

**K5 — Minimum data.** Only **given name, family name and date of birth** of the person go into the sandbox credential
(including the over-18 information derived from them, the document's country code and type). The real identity number and
document number are not written into the credential; instead, each credential carries a new, random value that is clearly a
test value (`SANDBOX-…`). This way a sandbox credential cannot be linked with credentials or pseudonyms on the real network.
The identity service keeps personal fields in memory only until the credential is issued (`SPEC-ID-0003/IDP9`); images never
reach Tamga.

**K6 — The provider session is deleted at once on every path.** As soon as the credential is issued, the verification session
at the provider (including images) is deleted; it is also deleted if verification fails or is abandoned. Sessions left open are
recorded and deleted at the provider at the nightly reset, before the database is wiped; one that cannot be deleted is retried at
the next reset. The sandbox identity service does not keep the provider session identifier in the credential record.

**K7 — Webhooks are not trusted.** The webhook address of the provider account is the real network's identity service;
notifications for sandbox sessions go there too. The sandbox does not trust webhooks: it fetches the decision from the
provider's API only when the person returns (`/idv/return`). The real network's identity service silently ignores a
notification for a session it did not open (no state change, nothing logged).

**K8 — Deleted every night, no personal data in logs.** At the nightly reset ([[ADR-0038]] K5) codes, credential records and
all flow state are deleted (only the counter in K3 is kept). Logs carry only event names, code identifiers and counts; never a
name, date of birth, code or provider response.

**K9 — Limits.** The real path is not opened for driving licence information ([[ADR-0039]]); in the sandbox that type is
tried only with the fake provider. The privacy notice is updated for open use and goes through legal review.

# Accepted risks

Sharing the real network's provider account knowingly accepts three risks; each is limited.

| Risk | What happens | Mitigation |
|---|---|---|
| **Shared allowance** | Sessions opened in the sandbox use up the real network's free monthly verifications; heavy use could disrupt verification on the real network. | Daily (15) and monthly (150) caps (K3); when reached, only the quick trial; an invitation code cannot exceed the caps; one session per flow; the nightly reset cannot bypass the counter. |
| **The sandbox can read the provider key** | The sandbox service user now reads the provider key; if the sandbox is compromised the key leaks and sessions could be opened and read on the account. | The key is only in the sandbox settings file and readable only by the sandbox user (`root:tamga-sandbox 640`); the real network's settings file, signing keys, data and backups stay closed to the sandbox (file permissions + service restrictions). The webhook secret is not copied to the sandbox. Key rotation on suspicion: new key in the provider dashboard → written into the real network's settings and the real identity service restarted → `sandbox-setup.sh didit-from-main` run again → old key revoked in the dashboard. |
| **Webhooks reach the real network** | Notifications for sandbox sessions arrive at the real network's identity service. | The sandbox does not trust webhooks and fetches the decision from the API; the real network silently ignores notifications for sessions it does not know (K7). A notification is only a trigger; no personal data is read. |

# Invariants

| Code | Rule |
|---|---|
| RI1 | In the sandbox the identity flow offers two options (real identity with the provider, or quick trial); a flow without a choice uses the fake provider. The real path is open to everyone; only in the optional invitation mode is a valid invitation code required. |
| RI2 | The sandbox's real path uses the real network's provider account only through separately named sandbox variables; these values are readable only by the sandbox user, and the real network's settings, signing keys and data are closed to the sandbox; the real network does not accept the sandbox names. The sandbox does not trust provider notifications (webhooks) and fetches the decision from the provider's API; the real network ignores notifications for sessions it did not open. |
| RI3 | On the real path, the person explicitly confirms the test-environment warning before being sent to the provider. |
| RI4 | The real identity number and document number are never written into a sandbox credential; only given name, family name and date of birth (and the derived age information) are taken from the person. |
| RI5 | The verification session at the provider is deleted as soon as the credential is issued or the flow ends without a credential, and a session left open is deleted at the latest at the nightly reset; the sandbox identity service does not keep the session identifier in a permanent record; each flow opens at most one real session. |
| RI6 | Invitation codes are stored only as keyed hashes; the plain code, name, date of birth and provider response are never written to any log; all are deleted at the nightly reset. |
| RI7 | Every real provider session opened in the sandbox (open or invited) counts toward the daily and monthly caps; when a cap is reached no real session is opened and only the quick trial remains; the counter is not reset by the nightly reset. |

`ADR-0038/SB3` was rewritten by this decision (see ADR-0038).

# Rationale / alternatives

| Option | Outcome | Why |
|---|---|---|
| Fake provider only in the sandbox | rejected | In-app identity verification screens and real error states cannot be tried without going to the real network. |
| Separate sandbox application at the provider (first text) | rejected (2026-10-05) | Needs a separate account and workflow setup; the existing free workflow is enough. The protection separation gave is provided by the caps, the key being readable only by the sandbox user, and not trusting webhooks. |
| Real path only with an invitation code (first text) | optional mode | Everyone should be able to try it; abuse and cost are limited by the caps. The invitation mode can be turned on when needed. |
| **Two options + the real network's account + caps + minimum data** | **accepted** | Anyone can try the real steps; the person tries knowingly; minimum data goes into the credential; the shared-allowance and key risks are limited. |
| Writing the real identity number into the credential as well | rejected | A sandbox credential could then be linked with credentials and pseudonyms on the real network; not needed for trying. |

# Consequences

- In sandbox mode the identity service carries two providers: the fake provider (quick trial) and the real provider; the
  choice is made per flow by the person.
- The sandbox setup script gains a `didit-from-main` command: it writes the real network's provider key and identity workflow
  into the sandbox settings under separate names, adds the cap defaults and restarts the sandbox identity service. The old
  check that prevented the sandbox and real network keys from being the same is removed.
- The sandbox page and the wallet's sandbox texts describe the two options; the invitation code section stays for the
  optional mode. The Sandbox guide and the draft privacy notice are updated for open use.

# Status

**Accepted — 2026-10-04**, **updated 2026-10-05** (real path open to everyone; the real network's provider account; caps and
accepted risks) — project management approval; the verbatim quotes are in the private approval record. DECISIONS: D-ID-9.
Partly changes K4 and SB3 of [[ADR-0038]].
