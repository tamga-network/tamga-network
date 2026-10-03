---
document_id: ADR-0019
title: "Institution Console"
status: Active
version: 1.0.0
created: 2026-09-28
last_updated: 2026-10-02
summary: >
  The institution side of the hosted services is gathered in one Institution Console (console.tamga.network): institution
  staff open an account by invitation and sign in with a passkey; issued credentials, revocation/suspension, the register
  (e.g. students), API keys, users and the institution's entry are managed there. The student-facing "add my credential to my
  wallet" portal is removed — the person requests the credential from the wallet. Operator data moves from JSON files to
  PostgreSQL. Changes the portal.tamga.network line of D-NAME-1.
domain: Services
translation_of: ADR-0019
source_version: 1.0.0
---

# Context

In phase B Tamga hosts the issuance service on behalf of institutions ([[t:issuer]]s) ([[ADR-0016]]). Today the institution
side, `portal.tamga.network/{slug}`, does two things at once: (1) a "add my credential to my wallet" page for students — an
imitation of the institution's own student information system; (2) a student affairs panel (issued credentials,
revocation). The data sits on the server in JSON files (`data/<institution>/state.json`, `students.json`, `tickets.json`,
`api-keys.json`); the institution cannot update its own data, and sign-in is a single shared password.

The person already requests the credential from the wallet ([[ADR-0011]] K3: find the institution → match with the identity
credential → credential). A separate web page for students is unnecessary and a design error. What the institution needs is
a real place to manage things: a console it can start using on the day the agreement is signed, where its staff sign in
with separate accounts and where it updates its own data.

# Decision

## K1 — Institution Console

The institution side of the hosted services is the **Institution Console** (Turkish "Kurum Konsolu"), at
`console.tamga.network`. Tabs by institution role:

| Tab | Who | Content |
|---|---|---|
| Credentials | issuer | issued credentials (type, date, number of copies), revoke / suspend / reinstate, in-person offer (QR + PIN) |
| Register (e.g. Students) | issuer | the institution's matching records: add, edit, delete. Marked as a **sample register**: used until the institution's own system is connected |
| Tickets / events | ticket seller | sales, events |
| API keys | issuer | create (shown once), revoke, scope and lifetime ([[ADR-0016]]) |
| Users | institution admin | staff invitations, role (admin / staff), removal |
| Institution entry | everyone | the entry in the trust list: authorised credential types, status, certificate fingerprint (read only) |

[[t:verifier]] statistics (gate pass counts; no personal data) are added to the console in a later step.

## K2 — Sign-in: invitation + passkey

- The operator creates a **single-use invitation link** (72 hours) for the institution's first admin. The admin opens the
  link and registers a **passkey** on their device (Face ID / Windows Hello / fingerprint). There is no password; no e-mail
  server is needed.
- The admin invites their own staff the same way. A user belongs to one institution and cannot see another institution's
  data.
- The session is kept on the server (≤ 8 hours, `HttpOnly`, `Secure`, `SameSite=Lax`); state-changing requests must come
  from the same site origin.
- Sign-in with the institution's own identity provider (SSO) is left for later.

## K3 — The student portal is removed

`portal.tamga.network` and the student-facing "add my credential to my wallet" page are removed. The person requests the
credential **from the wallet**; matching is done against the register in the console. If in-person issuance at a desk is
needed, staff create an offer (QR + PIN) in the console.

## K4 — Operator database: PostgreSQL

The persistent data of the hosted services is in **PostgreSQL**: institutions, the register, issued credentials, status
list state, the event log, tickets, API key digests, console users / passkeys / invitations / sessions. Short-lived protocol
state (offer, [[t:PAR]], access token, [[t:nonce]] — minutes) stays in service memory. Local development and tests run the
same SQL with embedded PostgreSQL (PGlite); production uses `DATABASE_URL`. The database holds personal data only in the
register (the institution's own data, on its behalf); logs contain no personal data (AP3/AP4 unchanged).

## K5 — Domain

D-NAME-1 v1.2: `portal.tamga.network/{slug}` → **`console.tamga.network`** (the institution is determined from the session;
no slug in the path).

# Options considered

| Option | Result | Why |
|---|---|---|
| Keep the portal as it is | rejected | The student page clashes with the wallet flow; the institution cannot manage its data |
| SQLite | rejected | Single file, simple setup; PostgreSQL for many institutions and concurrent writes, backups and growth |
| E-mail + password + code | rejected | Passwords can be stolen; needs an e-mail service |
| Institution SSO | later | Configuration per institution; after the pilot |
| Keeping the name `portal.` / `kurum.` | rejected | Project management chose `console.tamga.network` |

# Invariants

| Code | Rule |
|---|---|
| KC1 | A console user sees and changes only the data of the institution they belong to. |
| KC2 | Sign-in to the console is by passkey; no password is stored. An invitation is single-use and time-limited; only its digest is stored. |
| KC3 | Console and database logs contain no personal data, claim values or status `idx`; the register holds personal data only for matching, on the institution's behalf. |
| KC4 | The register is marked as a "sample register"; it gives way to the institution's own system (API or source connection) once that is connected. |

# Consequences

- the operator repository: `apps/console` (replacing the portal), `shared/db` (PostgreSQL / PGlite, versioned schema), the
  issuer's persistent data in the database; JSON files are used only for the initial load (seed).
- `ops`: PostgreSQL setup, the `console.tamga.network` nginx block + certificate name, `DATABASE_URL`, the invitation
  command.
- D-NAME-1 → v1.2 (DECISIONS "Changed decisions"); `docs/_internal/delivery/10-ALAN-ADLARI.md`.
- Moving the identity service (`apps/id`) data and verifier statistics are the next step.

# Status

**Accepted — 2026-09-28.** Chosen: PostgreSQL, invitation + passkey, `console.tamga.network`. DECISIONS: D-CONSOLE-1.

**Implementation note (2026-09-28).** The identity service's persistent data is also in the database; flow state and
personal fields stay only in memory (never written to disk). A **Gates** tab was added to the console: passes / rejections /
reasons per day for the institution's gate groups — counts only; no person, card identifier or time is kept (verifier
`/stats/gates`, internal network).
