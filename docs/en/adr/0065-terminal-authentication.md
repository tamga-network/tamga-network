---
document_id: ADR-0065
title: "Gate terminals authenticate to the verification service: terminal key"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-26
last_updated: 2026-10-26
translation_of: ADR-0065
source_version: 1.0.0
summary: >
  In the pass path (ADR-0012 B) gates send the token to Tamga Verify's `/terminal/verify`; until now the endpoint required no
  identity. Anyone who saw the wallet's 60-second QR could submit the token first, consume a single-use ticket and have the
  person stopped at the real gate. Decision: the gate identifies itself with a terminal key the operator issues for that
  terminal group (`Authorization: Bearer`); a request without a key never touches the token. The operator issues and revokes
  keys through the verifier's admin endpoints; the server stores only a hash. Certificate-based terminal registration
  (ADR-0012 K5 `terminal_groups[]`) remains the target for offline gates. Accepted 2026-10-26 (security review, general
  approval by project management).
domain: Protocol
related: ["[[ADR-0012]]", "[[ADR-0017]]", "[[SPEC-API-0001]]", "[[FW-RB-0006]]"]
---

# In short

A turnstile or event gate now identifies itself when it sends the wallet's pass token to the verification service: every
terminal group has a terminal key issued by the operator, and the request carries that key. A request without the key does not
read, consume or count the token. Someone photographing a ticket's QR from a distance can no longer mark it "used".

# Context

- [[ADR-0012]] B: for a registered gate the wallet shows a `tamga-pass+jwt` token signed with the copy key, free of personal
  data and valid for 60 seconds; the terminal verifies it and the `jti` replay list is shared online among the gates of a
  terminal group. In practice all gates call Tamga Verify's `POST /terminal/verify`; the replay list and the single-use ticket
  state (ADR-0012 K4, [[FW-RB-0006]] §4.3) live there.
- The endpoint required no identity (rate limit only). Because the token carries no personal data there was no privacy risk,
  but there was a **denial-of-service risk**: whoever sees the QR (the next person, a camera, a screenshot) and submits the
  token within 60 seconds puts its `jti` on the list or consumes the single-use ticket; the person then sees STOP at the real
  gate. Finding of the independent security review (2026-10-26).
- ADR-0012 K5 foresees defining terminals in the verifier's record as `terminal_groups[]` (group, certificate fingerprint,
  offline permission). That field is not yet in the list schema and no terminal verifies offline today. Today's gates are
  online devices under the operator's control (turnstile computer, gate tablet, the sandbox's browser page).
- Direction from project management: close the security review's findings with the least disruptive correct solution.

# Decision

## K1 — The gate identifies itself with a terminal key
`POST /terminal/verify` is called only with `Authorization: Bearer <terminal key>`. A key is bound to a **terminal group** (the
`terminal_group` of the policies); the token is checked against the key's group. `terminal_group` in the body is optional; if
present it must equal the key's group (a gate cannot act as another group's → 403). A request without a key, or with an invalid
one, gets 401 (`WWW-Authenticate: Bearer`); the token is not read, the replay list and gate counters are not touched, and the
audit log records only an "unauthorised terminal request" event (no address, no token).

## K2 — The operator issues and revokes keys
Keys are managed through the verifier's admin endpoints (admin token; closed to the outside in nginx, internal address only —
the path the Institution Console already uses for gate counters): `POST /terminal/keys {terminal_group, label}` returns the new
key **once**, `GET /terminal/keys` lists records without hashes, `DELETE /terminal/keys/{id}` revokes. The group must be a
terminal group of a loaded policy. A Console screen wrapping these endpoints is the next step (work list).

## K3 — Only a hash on the server
The verifier stores only the SHA-256 hash of a key (`terminal-keys.json`; no personal data) and compares in constant time. A key
is `tk_`-prefixed, 192 random bits.

## K4 — Local development and sandbox
Keys loaded from the environment (`TAMGA_VERIFY_TERMINAL_KEYS="group:key,…"`) are for local development and the sandbox only;
they are not written to disk and cannot be revoked. The sandbox's demo gate keys are public (sandbox guide §6): the sandbox
carries no real data or tickets; its purpose is to try the flow. The production network uses no environment keys; today it
has no gate policy either (`/terminal*` returns 404).

## K5 — The target is unchanged
Certificate-based terminal registration (ADR-0012 K5 `terminal_groups[]`, offline gates) remains the target; the terminal key
is today's identity path for online gates. Once `terminal_groups[]` enters the list schema, a certificate can replace the key
and this ADR is updated.

# Options considered

| Option | Outcome | Why |
|---|---|---|
| Keep the endpoint open, rate limit suffices | rejected | One request is enough: whoever sees the 60-second QR consumes the ticket; a rate limit does not stop that |
| mTLS / terminal certificate (ADR-0012 K5) | target, not today | Needs the list schema, certificate distribution and gate software; the sandbox's browser gate cannot do mTLS |
| RP assertion (`tamga-rp+jwt`, ADR-0017) from the gate | rejected | The access certificate's private key would be distributed to every gate device; no terminal-group separation |
| **Operator-issued bearer key per terminal group** | **chosen** | Least disruptive correct solution: one header, an internal admin endpoint, nginx rate limit unchanged; the sandbox page works with a key field |
| Put a gate identity in the token's `aud` | rejected | The wallet signs the token; it does not know the gate, and whoever sees the QR can still submit it |

# Invariants

| Code | Rule |
|---|---|
| TK1 | `POST /terminal/verify` works only with a terminal key bound to a terminal group (`Authorization: Bearer`); a request without a key or with an invalid one gets 401 and the token is not read, the replay list and counters are not touched. A body `terminal_group` differing from the key's group gets 403. |
| TK2 | The operator issues and revokes terminal keys through the verifier's admin endpoints; a key is visible only in the issuing response; the group must be the terminal group of a loaded policy. |
| TK3 | The verifier stores only the key's hash (no personal data) and compares in constant time; environment-loaded keys are for local development and the sandbox only. |

# Consequences

- Code: `apps/verify` (`terminal-keys.ts`, `/terminal/verify` 401/403, `/terminal/keys` admin endpoints, a key field on the
  gate page — kept only in the browser tab); nginx on the network server closes `/terminal/keys` to the outside; demo keys in
  the sandbox environment; the scene rehearsal (`ops/demo-scenes`) calls with the key.
- Documents: [[SPEC-API-0001]] §6.4 (authentication table) and the AP13 note; the verifier API page; sandbox guide §6;
  [[FW-RB-0006]] §4.3.
- Work list: terminal-key screen in the Institution Console (K2); `terminal_groups[]` in the list schema (K5).

# Status

**Accepted — 2026-10-26.** With project management's approval (security review fixes, general approval). DECISIONS: D-PROX-2.

**Note (2026-10-29):** K2 (Institution Console screen) and K5 (`terminal_groups[]` in the list schema) are completed by [[ADR-0069]]; keys are issued on behalf of the institution (TG1–TG3).
