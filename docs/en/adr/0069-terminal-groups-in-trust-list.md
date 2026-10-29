---
document_id: ADR-0069
title: "Gate groups in the trust list: institution, policy, certificate; terminal keys on behalf of the institution"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  The `terminal_groups[]` field foreseen by ADR-0012 K5 takes its form in the verifier record: each gate group carries
  `group_id`, `institution_id` (the institution operating the gates), `label`, `allowed_policies[]`, optional
  `cert_fingerprints[]` and `offline_allowed`, and its validity period. Tamga Verify reads the group's institution from the signed
  list: it issues terminal keys only on behalf of that institution, and an institution sees and revokes only the keys of its own
  groups (Institution Console, with an institution-scoped token); a key of a group withdrawn from the list no longer passes at
  the gate. The field and the reader for certificate-based gate identity are ready; gates authenticate with terminal keys today
  (ADR-0065). Accepted: 2026-10-29 (general approval to finish ADR-0065).
domain: Protocol
related: ["[[ADR-0012]]", "[[ADR-0038]]", "[[ADR-0065]]", "[[SPEC-TRUST-0001]]", "[[SPEC-API-0001]]", "[[FW-RB-0006]]"]
translation_of: ADR-0069
source_version: 1.0.0
---

# In short

Which institution a gate group belongs to (for example an event company's ticket gates) is now written in the signed trust
list. Tamga Verify uses it to separate gate keys per institution: each institution creates, sees and revokes only the keys of
its own gates in the Institution Console. If the list withdraws a group, that group's gates stop at once. The field a gate
device needs to identify itself with a certificate is also ready in the list; that path opens when gate software is ready.

# Context

- [[ADR-0012]] K5: a terminal is defined only under a registered verifier; `terminal_groups[]` (group ID, certificate
  fingerprint, offline permission) is added to the `relying_parties[]` record ([[SPEC-TRUST-0001]] minor version). Registries
  already used the field with `group_id`, `label`, `offline_allowed`, `valid_from`, `valid_until`, but it was not in the
  loader's schema or the specification, and it did not say which institution owns the group.
- [[ADR-0065]]: gates identify themselves to Tamga Verify with a terminal key; the operator issues keys through the admin
  endpoint. K2 names the Institution Console screen and K5 names `terminal_groups[]` in the list schema as next steps.
- The hosted Tamga Verify serves the gates of many institutions: groups of different institutions sit under one verifier record
  (in the sandbox: campus turnstile, ticket gate, cinema gate). If an institution manages its own gates, the verifier must know
  the group's institution from a trusted source; that source is the signed list.
- Project management's direction: the two items ADR-0065 left open are completed; a change to a closed schema decision goes
  through an ADR.

# Decision

## K1 — Field set
An item of the verifier record's `terminal_groups[]`:

| Field | Required | Meaning |
|---|---|---|
| `group_id` | yes | Group ID (`[a-z0-9-]{1,40}`); the same as `terminal_group` in the gate policy. Unique in the whole list. |
| `institution_id` | yes for an active group | The institution operating the group's gates: the `slug` of an issuer in the same list or the `dns_name` of a verifier (permanent identifiers that do not change when a certificate is renewed). |
| `label` | no | Human-readable name. |
| `allowed_policies[]` | yes for an active group (at least one) | The gate policies (`policy_id`) the group's gates serve. |
| `cert_fingerprints[]` | no | SHA-256 fingerprints of gate device certificates (hex, lowercase); one fingerprint in one group only. |
| `offline_allowed` | no | Offline gate permission (if the [[ADR-0012]] K3 risk is accepted). |
| `valid_from`, `valid_until` | `valid_from` yes | Validity; a group whose `valid_until` has passed is withdrawn and stays in the list for the record. |

The "certificate fingerprint" of ADR-0012 K5 becomes an array (several devices per group); institution, policy and validity
fields are added.

## K2 — Publisher check
The list publisher checks the groups on every publication: format, a `group_id` unique in the whole list, for an active group an
institution present in the list and at least one policy, no certificate fingerprint in two groups. On an error the publication
stops. A withdrawn group may keep its old form (the two old groups on the production network are like this; unchanged).

## K3 — The verifier reads the list
`TrustSource` returns the group (`terminalGroup`): the group record, the `dns_name` of its verifier and whether it is active now
(verifier ACTIVE and the group within its validity). On a stale list there is no answer (BT5). Nothing else interprets the list
file (BT4).

## K4 — Terminal keys on behalf of the institution
- When Tamga Verify issues a key it records the group's institution from the list; if the list allows none of the group's
  policies or the group is withdrawn, no key is issued.
- The admin endpoints know two callers: the operator (admin token, all keys) and an **institution** — an institution-scoped token
  `base64url(HMAC-SHA256(admin token, "tamga-terminal-keys/v1:" + institution))`, sent with the `x-tamga-institution` and
  `x-institution-token` headers. An institution gets keys only for an active group bound to it in the list, and sees and revokes
  only its own keys; another institution's key is treated as non-existent (404).
- The Institution Console calls these endpoints server-side with the token of the signed-in institution ("Gate terminals"
  screen, admins only): list (label, group, created, last used, status), new key (shown once, with a copy button) and revocation
  with confirmation. The console's audit log records the key ID and group; the key itself is written nowhere. The endpoints are
  closed to the outside (internal address).
- If the group is not in the list, the [[ADR-0065]] path stays as it is: only the operator issues keys.

## K5 — List check at the gate
At `POST /terminal/verify`, after the key is verified, if the group is withdrawn in the list or the key's institution differs from
the institution in the list, the request gets 403 and the token is not touched. So when an institution's record or gate group
leaves the list, its gates stop too.

## K6 — Preparation for certificate-based gates
`cert_fingerprints[]` and `TrustSource.terminalGroupByCertFingerprint` are for certificate-based gate identity (mutual TLS or a
signed gate request) and offline gates. Today no gate comes with a certificate; the path opens with a separate change when gate
software and certificate distribution are ready ([[ADR-0065]] K5 target).

## K7 — Sandbox
In the sandbox list the groups of the three example institutions are published with their institution and policy
(`istanbul-bilgi-campus` → `istanbul-bilgi`, `campus-access`; `bubilet-gate` → `bubilet`, `event-ticket`;
`paribu-cineverse-gate` → `paribu-cineverse`, `event-ticket`). The demo gate's public environment keys keep working
([[ADR-0065]] K4).

# Options considered

| Option | Result | Why |
|---|---|---|
| Keep the group's institution only in the Institution Console's tenant setting | rejected | The verifier does not know the institution; a console bug opens another institution's keys; no published, signed source |
| A separate, manually distributed admin token per institution | rejected | A separate secret per institution on the server; operating load; a derived token gives the same security |
| **The list states the institution; an institution-scoped derived token** | **chosen** | One source, the signed list; both the verifier and the console check the institution; no new secret |
| Moving groups into a separate list type | rejected | An unnecessary new format; ADR-0012 K5 places the group under the verifier record |

# Invariants

| Code | Rule |
|---|---|
| TG1 | A gate group is an item of the verifier record's `terminal_groups[]`; `group_id` is unique in the whole list; an active group is bound to an institution present in the list (`institution_id`) and to at least one gate policy; the publisher does not publish a group that fails this. |
| TG2 | Terminal keys are managed on behalf of an institution with an institution-scoped token: the institution gets keys only for an active group bound to it in the signed list, and sees and revokes only its own keys; the key record carries the group's institution; the key itself appears only in the response that issues it. |
| TG3 | A key of a group withdrawn in the list, or of a group whose institution changed, does not pass at the gate (403, the token is not touched) and no key is issued for that group; if the group is not in the list, [[ADR-0065]] TK1–TK3 apply. |

# Consequences

- Code: `@tamga-network/trust` (`TerminalGroup` schema, `RelyingParty.terminal_groups`, `TrustSource.terminalGroup` /
  `terminalGroupByCertFingerprint`); list publisher (`terminal-groups.ts` check; sandbox and test registries); `apps/verify`
  (`terminal-keys.ts` institution and last use, `institutionToken`; `routes/terminal.ts` institution-scoped endpoints and the list
  check at the gate); the Institution Console "Gate terminals" screen (operator repository).
- Documents: [[SPEC-TRUST-0001]] §4 (verifier record), [[SPEC-API-0001]] §6.4, the trust list API definition, the verifier
  registration guide and the sandbox guide §6, [[FW-RB-0006]] §4.3; [[ADR-0065]] K2 and K5 are completed by this decision.
- Packages: source 0.7.4 (the new reader is optional; older lists keep loading).
- **Implementation note (0.7.4, 2026-10-29):** TG3 is implemented fail-closed. "List stale" and "group not in the list" are
  told apart (`freshness().healthy`): a key bound to an institution, or a group once seen in the list, that the list cannot
  confirm gets 403 at the gate and no new key. An unowned key the operator issued while the group was unlisted is bound to the
  group's institution when the group appears. `allowed_policies` is also checked at the gate: a pass carries its policy ID; a
  pass from a policy that is not allowed is refused without being consumed.

# Status

**Accepted — 2026-10-29.** With project management's general approval to finish [[ADR-0065]] (verbatim quote in the private
approval record). DECISIONS: D-PROX-3. TG1–TG3 are binding.
