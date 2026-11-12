---
document_id: SPEC-API-0001
title: "Verification pipeline and API"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-11-12
summary: >
  Defines the canonical verification algorithm and the HTTP surface of the issuer/verifier services. Its central contribution
  is the STEP CODE REGISTRY: A1…E4, the single normative list of the verification steps spread across four specifications.
  These codes travel machine-readably in the `failed_step` field, so instead of "verification failed" one can say "failed at
  C2 — the issuer is not authorised for this schema". Second rule: the HTTP status code does NOT encode the verification
  result — a rejected credential is a successful API call; 4xx is only a transport/request error. Third: the result is
  three-valued and INDETERMINATE carries a separate reason field.
translation_of: SPEC-API-0001
source_version: 1.0.0
---

This specification gathers the steps a [[t:credential]] goes through during verification into a single order and defines the
HTTP interface of the hosted [[t:verifier]] and the [[t:issuer]] service; it is for verifier and institution developers.

**When to read**

- Read the [Presenting credentials](/concepts/presentation) page first, then the guide [[GUIDE-0002]].
- If you use the hosted verifier, go to §4; if you use the issuer service, go to §5.
- If you are looking for the meaning of a result code (such as A1, C2, D5), see the table in §1.

**In brief**

Verification proceeds in five layers: format (is the credential intact and signed), schema (is its type recognised), trust
(is the issuing institution in the [[t:trust-list]] and authorised to issue this type), [[t:revocation]] (has the credential
been revoked) and policy (are the verifier's requirements met). Every step has a permanent code. The result is one of three
values: valid, invalid or could not be verified. "Could not be verified" does not mean the credential is fake; for example,
the [[t:status-list]] may not be current at that moment. The HTTP status code does not carry the result; the result is always
in the body of the response.

---

# Scope

This specification defines two things:

1. **The canonical verification algorithm** — the single normative order of the steps spread across four specifications, and
   the code registry.
2. **The service API surface** — the HTTP interface of the issuer and verifier services.

The protocol endpoints ([[SPEC-PROTO-0001]] OID4VCI, [[SPEC-PROTO-0002]] OID4VP) are not repeated here; this document defines
**the service's own** management and integration surface.

---

# 1. Step code registry (normative)

Verification proceeds in five layers. This table is **canonical**; [[ARCH-0003]] §4.1 is a summary view of it.

## 1.A — Format layer → [[SPEC-CRED-0002]] §8

| Code | Step |
|---|---|
| `A1` | Split the combined string on `~`; is there a KB-JWT. A1 also carries the caller's configuration errors (2026-11-04): e.g. on the Digital Credentials API path an `aud` that differs from the one derived from the page origin, or `origin` given together with `aud` = `client_id` — REJECTED with an explicit message |
| `A2` | Header: `alg=ES256`, `typ=dc+sd-jwt`, is `x5c` present |
| `A3` | `x5c` chain + JWT signature: the leaf chains to one of the given trust anchors (the Tamga root CA or the anchor of an external list within its freshness). Intermediates must be CAs (`basicConstraints cA=true`), **must carry the KeyUsage extension with `keyCertSign`** (an intermediate without the extension is REJECTED) and stay within `pathLenConstraint`; an `iat` more than 300 s in the future is REJECTED. The status of the root CA is checked not here but at **`C1`**: the root the institution is bound to must be `ACTIVE` or `ROLLING_OVER` at the credential's `iat` and must never have been `REVOKED` ([[SPEC-ID-0002]] §3; a root retired later does not invalidate credentials issued earlier; a credential under a revoked root is rejected with code `C1`). In a single-certificate `x5c` the leaf itself may be the anchor (a service certificate in an external list, [[ADR-0036]]); `issuerId` is still derived from the leaf and `C1` looks it up in the list. If the caller deliberately turned the chain check off (`rootCertsDer: "none"`, SD-JWT VC only), A3 appears in `checks_skipped`, not in `checks_performed`. **mdoc:** the `x5chain` leaf is either itself one of the listed anchors (a root CA or a service certificate from an external list) or is signed directly by one — intermediates are not accepted (ISO/IEC 18013-5 Annex B: the document signer certificate is issued directly by the IACA, path length 0; the EU PID/EAA mdoc profiles use the same chain) |
| `A3b` | **`issuerId` is derived from the fingerprint of the `x5c` leaf certificate** — NOT from the `iss` claim (§1.2). The `iss` consistency check needs the trust record, so it runs after the B steps and before `C1`, and is reported with this code |
| `A3c` | Is the leaf certificate revoked in CRL/OCSP ([[SPEC-ID-0002]]) |
| `A3d` | Is the `cnf` claim **present** — if not, REJECT (in Tamga KB is mandatory without exception) |
| `A4` | `_sd_alg == "sha-256"` |
| `A5` | Every disclosure: **hash first, then decode**; does the digest match in `_sd` |
| `A6` | KB-JWT: signature, `aud`, `nonce`, `iat`, `sd_hash` |
| `A7` | Has `exp` passed, or is `nbf` not yet reached |
| `A8` | No duplicate digests / no collision with a plaintext claim |

**`Z1` — zero-knowledge proof (`mso_mdoc_zk`, [[ADR-0032]]):** the circuit is in the signed list and the file digest matches
(ZK2); the disclosed elements are only those requested, in a single namespace, with the circuit's attribute count (ZK3); the
timestamp is within the window; the [[t:Longfellow-ZK]] proof is valid. `mso_mdoc_zk` A-order: A1 decode · A8 docType ·
A2 `msoX5chain` · A3 chain + certificate valid at proof time · A3b · Z1. A4–A7 are covered by Z1.

## 1.B — Schema layer → [[SPEC-SCHEMA-0001]] §7

| Code | Step |
|---|---|
| `B1` | Read `vct` and `vct#integrity` |
| `B2` | `schemaId = keccak256(vct)`; registered and not `REVOKED` |
| `B3` | Fetch Type Metadata (cache → URL → registry) |
| `B4` | Integrity: hash `== vct#integrity` **and** `== contentHash` (registry) |
| `B5` | `extends` chain; `extends#integrity` at every step |
| `B6` | JSON Schema 2020-12 conformance (`schema_uri` is a Tamga extension, [[SPEC-SCHEMA-0001]] §2.1) |

## 1.C — Trust layer → [[SPEC-TRUST-0001]] §6 (`TrustSource`; signed trust lists)

| Code | Step |
|---|---|
| `C1` | `isCredentialAcceptable(issuerId, iat)` — **iat = the credential's `iat` claim** |
| `C2` | `isCredentialSchemaAcceptable(issuerId, schemaId, iat)` — **cannot be skipped** |
| `C3` | `isRecognizedBy(my own state, issuerId)` |
| `C4` | Credential `category` claim ↔ the issuer class in the record: PUB ↔ `urn:tamga:eaa:pub`, QUALIFIED ↔ `urn:tamga:eaa:qualified`, EAA (I1–I2) ↔ no claim; mismatch → REJECT ([[ADR-0010]] K5, [[SPEC-CRED-0002]]/C18). mdoc and ZK presentations carry no `category` field: C4 is not applied to these formats and appears in `checks_skipped`; it is not applied to an institution in an external list either ([[ADR-0036]]). In every format the issuer class is returned in the result object as `issuer.class`, from the record in the trust list ([[ADR-0010]] implementation note, 2026-11-12) |

## 1.D — Revocation layer → [[SPEC-CRED-0003]] §7

| Code | Step |
|---|---|
| `D1` | Read `status.status_list` (`idx`, `uri`). A ZK presentation (`mso_mdoc_zk`) carries no index: if the type bound by the proof is the short-lived ZK copy (`urn:tamga:id:ShortLivedIdentityAttestation:1`, type rule ≤ 24 hours, no revocation list — [[ADR-0044]] K5) the D steps do not apply and `status.value = NOT_APPLICABLE` (reason: short validity); an unmarked ZK presentation follows the rule below. A non-ZK credential without `status`: if the type schema says `uses_status_list: true` it is REJECTED (the revocation check is never skipped silently — [[ADR-0056]] K13), otherwise `NOT_APPLICABLE` |
| `D2` | Take the Status List Token **from the prefetch cache** |
| `D3` | Token signature; `sub == uri`; `iss` in the same chain of trust. Before the signature check the signer is pinned to the institution's ACTIVE status keys in the trusted list (`expectedSignerFingerprints` — [[ADR-0056]] K6); without a registered key `INDETERMINATE`. A status key counts as a signer only inside its validity window (`valid_from`…`valid_to`, when given). If the signer is a **registered** status key outside its window (or a `RETIRED` one) — the key was renewed and the cache still holds the old list — the result is not REJECTED but `INDETERMINATE`/`STATUS_STALE`; a signer that is not registered (or is `REVOKED` / `SUSPENDED`) stays `REJECTED`. If the cached body cannot be read as a token (for example the server's error page) the result is not REJECTED but `INDETERMINATE`/`STATUS_UNREACHABLE` |
| `D4` | Freshness: `exp` not passed, token age (`now − iat`) within the policy's `max_status_token_age_sec` |
| `D5` | Anchor: does the token digest (`contentHash`) match the latest row for the list in the anchor log. The token carries no version field; rollback is detected by time. If the mismatching token is **older** than the anchor: `INDETERMINATE`/`STATUS_STALE` when the cache was fetched before the anchor (or within clock tolerance), `REJECTED` when it was clearly fetched after. If the mismatching token is **newer** than the anchor, that is the normal publication order (CDN first, then the anchor — [[SPEC-CRED-0003]] §5.2) and D5 appears in `checks_skipped`; the allowance is bounded: a token newer than the latest known anchor by more than `max_anchor_lag_sec` (+ clock tolerance) has an overdue anchor → `INDETERMINATE`/`STATUS_STALE`. If the list is not in the anchor log at all, the same allowance is counted from the credential's `iat`: D5 is skipped for a freshly issued credential, and the result is `INDETERMINATE`/`STATUS_STALE` once the allowance has passed. There is no anchor log for the status list of an institution in an external list; D5 is skipped ([[ADR-0036]]). `max_anchor_lag_sec` is a freshness field of the policy (§4.4): default 3600 s (the hourly cadence of the anchor log); Tamga Verify uses 600 s |
| `D6` | Read `idx` with `bits=2`; anything other than `0x00` → REJECT |

## 1.E — Policy layer → local

| Code | Step |
|---|---|
| `E1` | Assurance threshold (e.g. `category=EDUCATION && assurance>=I2`) |
| `E2` | Have all requested claims been disclosed |
| `E3` | No RP scope overrun ([[SPEC-PROTO-0002]] §6). The RP registration is a required input: omission is REJECTED, `null` (unregistered RP) is REJECTED; `"none"` skips the step deliberately and E3 appears in `checks_skipped` ([[ADR-0056]] K4). The scope check covers every selectively disclosed claim plus those always-visible claims that the policy asks for; both appear in `disclosed_claims` |
| `E4` | Audit record written — in `checks_performed` only when an audit sink (`audit`) was given and the record was written; otherwise in `checks_skipped` ([[ADR-0056]] K11). If the audit sink fails, the verification result is still returned and E4 appears in `checks_skipped` |

**Reading a yes/no attribute:** `isYes(output, claim)` returns `true` only when the outcome is `ACCEPTED` and the disclosed value
is exactly `true` (e.g. `age_over_18`, plain or ZK presentation); a rejection, an indeterminate result, a missing value or another
value such as `"true"`/`1` is `false` ([[ADR-0056]]). An access pass is issued only from an `ACCEPTED` output of this process
(`PassRegistry.issue({ verified })` — K9).

The `jti` of an access pass token is a string of at most 128 characters; a non-string or longer `jti` is rejected (AP13 replay list).

## 1.1 C1/C2 are time-bound

`C1` and `C2` do not ask whether the institution can issue the credential **today**, but whether the credential was acceptable
**at the moment** it was issued. If issuance-time questions (`isValidIssuer`, `isAuthorizedForSchema`: "may it issue now?")
were used in verification, they would cause two silent errors:

| Scenario | With an issuance-time question | Correct |
|---|---|---|
| Ministry closed (`REVOKED`, with a successor) | Every diploma REJECTED at `C1` | Those issued before the closure accepted ([[ADR-0002]] #4) |
| Schema became `DEPRECATED` (a new version was released) | Every credential issued with the old schema REJECTED at `C2` | Accept — status of the schema record, [[SPEC-TRUST-0001]] |
| Planned CA rotation | `A3` + `C1` REJECT | Accept — a rotation is not a compromise |

That is why both queries take the credential's **`iat`** value and ask "was it acceptable at that moment". This accepts that
verification is a **retrospective** operation — the credential was issued in the past, and the state of that day, not
today's, is decisive.

**ZK presentation (`mso_mdoc_zk`).** A zero-knowledge proof does not reveal when the credential was signed. On this path `C1` and `C2` are asked with the proof timestamp (the presentation time; it must be close to the verifier clock, within the clock tolerance): the institution and its authorisation for the type must be valid at presentation time. Because a short-lived ZK copy was issued at most 24 hours earlier ([[ADR-0044]]), the two moments differ by at most one day. This is the explicit exception to AP11 for ZK presentations ([[ADR-0032]] implementation note, 2026-11-12). It has two consequences: if the institution was closed after it issued the credential, the ZK presentation is rejected; if the institution was not acceptable when the credential was issued but is acceptable at presentation time, the presentation passes these steps. For an unmarked ZK presentation (accepted only with `accept_unrevocable_zk: true`) the one-day bound does not exist.

## 1.2 `issuerId` is derived from the certificate

`A3b` is critical. If the verifier takes `issuerId` **from the `iss` claim**, **any** institution with a valid certificate under
the same Root CA can write the university's identifier into `iss` and produce credentials in its name — the signature is
valid with its own certificate, the chain is valid, `iss` is forged.

Rule: `issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))` — [[SPEC-ID-0002]]. The `iss` claim is used only for a
**consistency check**: it must match the registered issuer's `metadataURI`; if it does not, REJECT.

**`iss` is mandatory (SD-JWT VC).** For types in the Tamga catalogue a missing or empty `iss` is REJECTED at `A3b`; the value must equal the `issuer_url` field of the institution's trust list record exactly. mdoc and ZK presentations have no `iss` field; the binding comes from the certificate alone. For an institution in an external list ([[ADR-0036]]) the record has no address, so this check is not applied.

**Local development flag (`allowLocalIssuerUrls`).** Off by default. When on, an `iss` that is a local address — `http://localhost` or an IPv4 address in 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12 or 192.168.0.0/16 — need not equal the registered address; the same relaxation applies to the `iss` of the status token. A public IP address is not local. Tamga Verify turns the flag on only when its public address is not `https`; it is off on the live verifier.

## 1.3 Order and short-circuit

The steps are run **in order**. Execution stops at the first failure and that code is returned as `failed_step`.

**Exception:** `E4` always runs — a rejected verification is logged as well (in a verifier with an audit sink; without one E4 is
reported as skipped — [[ADR-0056]] K11).

**How codes are reported (implementation note, 2026-11-11).** The reference implementation reports some steps under a neighbouring code: a missing `cnf` (`A3d`) is returned as `A3`, and a duplicate digest or a collision (`A8`) as `A5` for SD-JWT VC; for mdoc and ZK, `A8` means the document type (docType) is not in the policy. `A2` (legacy `typ` on a Tamga type) and `A4` (no `_sd_alg` on a Tamga type) are checked once it is known whether the type is in the catalogue, that is after `B2`; `A3b` (`iss` consistency) is checked once the trust record has been read, that is after `B6` — for a credential with more than one defect the returned code may not be the first one in order. On an unexpected exception `failed_step` is the first code of that layer (`T0`, `A1`, `B1`, `C1`, `D1`, `E1`). The A order for mdoc: A1 · A8 · A2 · A3 · A3b · A4, A7, A5 · A3d · A6. The checks themselves are all carried out: in a successful verification `A3d` and `A8` appear in `checks_performed`; the exact cause of a failure is in the `failed_reason` field. With the approval of project management (2026-11-12) this reporting is the binding behaviour of the reference implementation; it is not changed, so that the reading of codes in existing records does not change (AP1) ([[ADR-0056]] implementation note).

## 1.4 Code stability

**Invariant AP1:** the meaning of a step code **never changes.** A new step gets a new code; the code of a removed step is
**never reused.**

Rationale: `failed_step` is kept in audit records for years. If the meaning of `C2` changed in 2029, the 2027 records would be
read wrongly.

---

# 2. Verification result

## 2.1 Three-valued result

| `outcome` | Meaning |
|---|---|
| `ACCEPTED` | All steps passed |
| `REJECTED` | A step failed — the credential is invalid |
| `INDETERMINATE` | **Could not be verified** — infrastructure unreachable, no judgement on the credential |

**Invariant AP2:** `INDETERMINATE` is not put in the same bucket as `REJECTED`. It is shown separately in the user interface.
The difference between "this diploma is fake" and "I cannot check right now" is whether a person gets hired.

## 2.2 Result object

```json
{
  "verification_id": "vrf_01J8XKQ2M4",
  "outcome": "ACCEPTED",
  "failed_step": null,
  "indeterminate_reason": null,

  "spec_version": "SPEC-API-0001@1.0.0",
  "sdk_version": "@tamga-network/verifier@0.8.3",
  "checks_performed": ["A1","A2","A3","A3b","A3d","A4","A5","A6","A7","A8",
                       "B1","B2","B3","B4","B6",
                       "C1","C2","C3","C4",
                       "D1","D2","D3","D4","D5","D6",
                       "E1","E2","E3","E4"],
  "checks_skipped": ["A3c","B5"],

  "issuer": {
    "issuer_id": "0x7f3a…",
    "state_code": "TR",
    "category": "EDUCATION",
    "assurance": "I2",
    "class": "EAA"
  },
  "schema": {
    "schema_id": "0x9c21…",
    "vct": "urn:tamga:edu:DiplomaCredential:1",
    "version": "1.0.0",
    "status": "ACTIVE"
  },
  "disclosed_claims": ["is_graduate","qualification_title","eqf_level",
                       "isced_f_code","awarding_body_name","awarding_date",
                       "family_name","given_name"],
  "status": {
    "value": "VALID",
    "list_version": 8412,
    "token_age_sec": 1830
  },
  "freshness": {
    "indexer_last_block": 918273,
    "indexer_age_sec": 4,
    "chain_read_mode": "INDEXER"
  },
  "evaluated_at": "2026-09-09T09:12:44Z"
}
```

**`checks_skipped` in the example (implementation note, 2026-11-12).** The example is the result the reference implementation (`@tamga-network/verifier`) returns for an SD-JWT VC presentation when an audit sink is given. The reference implementation does not perform two steps today and reports them in `checks_skipped` for every presentation: `A3c` (CRL/OCSP query for the leaf certificate) and `B5` (`extends` chain). `E4` is in `checks_performed` because the audit record was written; without an audit sink it also appears in `checks_skipped` (§1.E, `E4`).

| Field | Meaning |
|---|---|
| `status.reason` | Optional text (`string \| null`): why the status has this value, when it is not self-explanatory. E.g. `NOT_APPLICABLE` + a ZK presentation: the revocation index is not revealed ([[ADR-0032]] ZK4). Carries no personal data. |

## 2.3 `indeterminate_reason`

**Mandatory** when `outcome == INDETERMINATE`:

| Value | Source |
|---|---|
| `SCHEMA_UNREACHABLE` | [[SPEC-SCHEMA-0001]] §7 Ş3(c) |
| `STATUS_UNREACHABLE` | [[SPEC-CRED-0003]] §7 Ş3(c) |
| `STATUS_STALE` | [[SPEC-CRED-0003]] §8.2 freshness threshold exceeded; or, at D5, the verifier's prefetch delay / clock-tolerance window / unreadable anchor time / anchor lag window exceeded (the token is newer than the latest anchor by more than `max_anchor_lag_sec`, or the list has never been anchored); or, at D3, the list is signed with a status key of the institution that is registered but outside its validity window |
| `CHAIN_UNREACHABLE` | Chain and indexer unreachable |
| `INDEXER_STALE` | [[ARCH-0003]]/CMP4 |
| `SDK_VERSION_MISMATCH` | [[ARCH-0005]] §4.2 M2; also at `Z1` when the verifier's own ZK component is unavailable (circuit file missing, WASM cannot be loaded) — the verifier's shortcoming, not the presentation's |
| `STATUS_VALUE_UNKNOWN` | `D6`: the value in the status list has no defined meaning — IETF Token Status List 0x03 and 0x0B–0x0F are application-specific, the rest undefined; can occur in 4- or 8-bit (external) lists (2026-10-24). The credential can be called neither revoked nor valid; `status.value = UNKNOWN`. Tamga types publish their lists with 1 or 2 bits ([[ADR-0048]], [[ADR-0063]]) |

The following also give `INDETERMINATE`, not `REJECTED`:

- **Unexpected exception** (library error, corrupt trust record …): `INDETERMINATE` at that step, with that layer's reason (A →
  `CHAIN_UNREACHABLE`, B → `SCHEMA_UNREACHABLE`, C/E/T0 → `INDEXER_STALE`, D → `STATUS_UNREACHABLE`); the exception message is
  not put in `failed_reason` (AP3), only the step and the error type. The result still goes to the E4 audit record. In the
  hosted verifier an internal error **after** the presentation has been used up follows the same rule: the error is in or
  after the last layer of the pipeline (E), so the reason is `INDEXER_STALE`, `failed_step` is `null` and `failed_reason` is
  "internal error after verification (…)". The closed set has no separate "internal error" value; the empty `failed_step`
  tells this case apart from a stale list.
- **Unmarked ZK presentation with `accept_unrevocable_zk: false`:** a ZK presentation carries no revocation index (ZK4). A
  presentation carrying the short-validity marker (the type bound by the proof is the ZK copy, [[ADR-0044]] K5) is accepted
  without this flag. For an unmarked ZK presentation, if the policy requires a revocation check the outcome is `D1` /
  `STATUS_UNREACHABLE`; only with an explicit `true` is it accepted: `status.value = NOT_APPLICABLE`, with `status.reason` set.
  **When omitted the field means `false`** (`ADR-0044/ZC4`).

- **The reason is a fixed message (2026-11-11):** `failed_reason` carries no value from the credential (for example `category`, `typ`, `_sd_alg`), no free text sent by the wallet and no library exception message; it may carry a claim **name**. If a certificate or signature that came with the credential cannot be read the result is REJECTED; an unexpected error after the certificates were read (a corrupt anchor given by the caller, a library fault) is `INDETERMINATE`.
- **Unavailable external list ([[ADR-0036]] FD3):** when the chain does not reach any of the given roots (`A3`), or the type is not in the catalogue and the anchor does not resolve to an external institution (`B2`), and an external list that could vouch for the requested type is unavailable at that moment (not loaded or expired), the result is not REJECTED but `INDETERMINATE`/`INDEXER_STALE`. At `A3` the type is read from the policy, not from the unverified credential.
- **Attempt limit on the hosted verifier:** responses that end `INDETERMINATE` before proof of possession also count as attempts; if the presentation closes because of them its result is `INDETERMINATE`, not `REJECTED`, and `indeterminate_reason` is kept (AP2). The `last_attempt` field of a pending presentation also carries the attempt's `outcome` and `indeterminate_reason`. Results produced outside the verification pipeline (the person declined, attempt limit) are written to the audit log too and E4 appears in `checks_performed`; the audit record always carries the same outcome as the returned result. The `error` of a wallet error response is recorded only when it is one of the codes defined by OpenID4VP; any other value is written as `wallet error`.

## 2.4 `disclosed_claims` — names only

**Invariant AP3:** the result object does not carry claim **values**, only their **names**. Values are given to the calling
application through a separate channel and only when explicitly requested.

Rationale: the result object is written to the audit record ([[ARCH-0004]] §5.2). If values leaked there, personal data would
spread into the logging infrastructure.

**Returned values (2026-11-11).** The caller (`claims`; §4.3 on the hosted verifier) receives only the verified values of the claims the policy **asks for** (`required_claims`). A claim the wallet disclosed in addition appears in `disclosed_claims` and is checked at E3, but its value is not returned. The technical fields of the credential — `iss`, `iat`, `exp`, `vct`, `category`, the holder's copy key `cnf` and `status`, which carries the revocation index — are never returned (AP4).

## 2.5 `idx` never appears

**Invariant AP4:** `status.status_list.idx` **does not appear** in the result object, the audit record or any API response
([[ARCH-0004]] §5.3).

If correlation is needed, an institution-specific [[t:salted-hash]] is used: `HMAC(institution_salt, uri || idx)`.

---

# 3. The HTTP status code does not encode the result

**Invariant AP5:** a rejected credential is a **successful API call**.

| Status | When |
|---|---|
| `200` | Verification ran — whatever the `outcome` |
| `400` | Malformed request body, missing parameter |
| `401` / `403` | API authentication / authorisation |
| `404` | Unknown `verification_id` |
| `409` | Idempotency conflict |
| `429` | Rate limit |
| `500` | Service error |
| `503` | A dependency is unreachable **and** no result could be produced |

Mixing these up is a common mistake and causes two problems: (1) clients cannot tell a network error from an invalid
credential, (2) monitoring systems treat rejected credentials as an "error rate" and real failures get lost in the noise.

---

# 4. Verifier service API

Base: `https://verifier.<institution>/api/v1`

## 4.1 Start a presentation request

```http
POST /presentations
Content-Type: application/json
Idempotency-Key: 3f9a1c...

{
  "policy_id": "job-application-degree",
  "purpose": { "tr-TR": "İş başvurusu değerlendirmesi" },
  "response_mode": "direct_post.jwt",
  "ttl_sec": 300
}
```

```json
{
  "presentation_id": "prs_01J8XK",
  "request_uri": "https://verifier.ornek.com/vp/req/01J8XK",
  "qr_payload": "openid4vp://?client_id=x509_hash%3AUvo3…&request_uri=…",
  "expires_at": "2026-09-09T09:17:44Z"
}
```

`policy_id` points to a predefined policy (§4.4). The DCQL query is **not written by hand** in the request body — it is
generated from the policy. Over-asking therefore requires a policy change, not a code change.

## 4.2 Get the result

```http
GET /presentations/prs_01J8XK
```

`{"state": "PENDING"}` if the presentation has not arrived yet; otherwise the result object in §2.2.

## 4.3 Get the disclosed values (separate call)

```http
GET /presentations/prs_01J8XK/claims
```

```json
{
  "claims": {
    "is_graduate": true,
    "qualification_title": { "tr-TR": "Bilgisayar Mühendisliği Lisans Diploması" },
    "eqf_level": 6,
    "isced_f_code": "0613"
  }
}
```

**The reason for a separate endpoint** is AP3: the values are separated from the result object that goes to the audit
record, and access to this endpoint is authorised and logged separately.

## 4.4 Policy management

```json
{
  "policy_id": "job-application-degree",
  "credentials": [
    {
      "id": "diploma",
      "vct_values": [
        "urn:tamga:edu:DiplomaCredential:1",
        "urn:tamga:edu:DiplomaCredential:2"
      ],
      "required_claims": ["is_graduate","qualification_title","eqf_level",
                          "isced_f_code","awarding_body_name","awarding_date"],
      "constraints": { "is_graduate": true, "eqf_level": { "min": 6 } }
    }
  ],
  "trust": {
    "min_issuer_assurance": "I2",
    "allowed_categories": ["EDUCATION"],
    "require_recognition": true
  },
  "freshness": {
    "max_status_token_age_sec": 21600,
    "max_indexer_age_sec": 60
  }
}
```

The policy feeds both the DCQL query ([[SPEC-PROTO-0002]] §4) and the `E1`–`E3` steps. A single source.

`freshness.max_anchor_lag_sec` (optional, s): the D5 anchor lag window; 3600 when omitted. `freshness.max_clock_skew_sec` (optional, at most 600 s): clock tolerance; 120 when omitted.

**Invariant AP6:** the `required_claims` in a policy cannot exceed the `scopes[]` (`allowedScopes`) of the RP's trust list record. The service
checks this when the policy is saved and **rejects** a policy that exceeds them — over-asking is blocked when the policy is
defined, not at presentation time.

---

# 5. Issuer service API

Base: `https://issuer.<institution>/api/v1`. The OID4VCI endpoints are separate ([[SPEC-PROTO-0001]]); the ones here are the
**operator and integration** surface.

## 5.1 Create a credential offer

```http
POST /offers
Idempotency-Key: 8c21f...

{
  "credential_configuration_id": "urn:tamga:edu:DiplomaCredential:1",
  "subject_ref": "OBS-2022510041",
  "batch_size": 1
}
```

```json
{
  "offer_id": "ofr_01J8XM",
  "offer_uri": "https://issuer.tamga.network/example-university/offers/8a3f9c21",
  "tx_code": "493812",
  "expires_at": "2026-09-09T09:17:44Z"
}
```

`subject_ref` is the institution's **own** identifier (student number). Tamga carries this value nowhere; it does not go into
the credential and is not written to the registry.

**`tx_code` is returned only in this response** and is not stored — it is shown on the operator's screen and then forgotten.

## 5.2 Issuance preflight

```http
POST /offers/preflight
{ "credential_configuration_id": "urn:tamga:edu:DiplomaCredential:1", "subject_ref": "OBS-2022510041" }
```

```json
{
  "ok": false,
  "blockers": [
    {
      "code": "ISCED_MAPPING_MISSING",
      "detail": "Programme 'Yapay Zekâ Mühendisliği' is not in the national ISCED-F table",
      "resolution": "add it to packages/schemas/data/tr/overrides.json"
    }
  ]
}
```

This endpoint is the operator-facing form of [[ARCH-0003]]/CMP5: for a programme with no counterpart in the mapping,
issuance **stops**; no guessed code is produced.

## 5.3 Revocation and suspension

```http
POST /revocations
{ "credential_id": "crd_01J8XN", "action": "REVOKE", "reason_code": "DISCIPLINARY" }
```

```json
{ "queued": true, "effective_after": "2026-09-09T10:00:00Z" }
```

`effective_after` is the next publication cycle ([[SPEC-CRED-0003]] §5.1). **There is no instant revocation** and the API
says so explicitly — the caller's expectation is set correctly from the start.

`action`: `REVOKE` (permanent, `0x01`) or `SUSPEND` / `UNSUSPEND` (`0x02`).

## 5.4 Status list publication state

```http
GET /status-lists/{list_id}
```

```json
{
  "list_id": "0x4f…",
  "list_uri": "https://status.tamga.network/7f3a9c21",
  "version": 8412,
  "published_at": "2026-09-09T09:00:00Z",
  "next_publish_at": "2026-09-09T10:00:00Z",
  "chain_version": 8412,
  "in_sync": true,
  "capacity_used_pct": 41.2
}
```

`in_sync == false` means the publication pipeline is broken — the CDN and the registry anchor have diverged (the
[[ARCH-0004]] §5.1 alarm).

---

# 6. Common rules

## 6.1 Error format — RFC 9457

```json
{
  "type": "https://docs.tamga.network/errors/schema-not-authorized",
  "title": "The issuer cannot issue this schema",
  "status": 403,
  "detail": "issuer 0x7f3a… is not authorised for schemaId 0x9c21…",
  "instance": "/api/v1/offers",
  "tamga_code": "SCHEMA_NOT_AUTHORIZED"
}
```

**Invariant AP7:** the `detail` field contains no personal data. Instead of "no record for Ayşe Yılmaz", `SUBJECT_NOT_FOUND`
is returned; the details are only in the institution's own audit record (the service counterpart of
[[SPEC-PROTO-0001]]/PR8).

## 6.2 Idempotency

Every `POST` with side effects (`/offers`, `/revocations`, `/presentations`) **accepts** the `Idempotency-Key` header. A
repeated call with the same key returns the same response; the same key with a different body produces `409`.

Retention: **24 hours**.

## 6.3 Versioning

Path-based: `/api/v1`. A breaking change opens `/v2`; `/v1` lives in parallel for at least **12 months** (the same policy as
[[ARCH-0005]] §5.3).

## 6.4 Authentication

| Surface | Method |
|---|---|
| Operator panel → issuer API | OIDC + role-based authorisation |
| Student information system → issuer API | mTLS or client credentials |
| Verifier application → verifier API | API key or mTLS |
| Gate terminal → verifier `/terminal/verify` | Terminal key: an operator-issued bearer key bound to a terminal group (`Authorization: Bearer`); a request without a key gets 401 and the token is not read ([[ADR-0065]] TK1–TK3). Keys are issued and revoked through the admin endpoints (`/terminal/keys`, internal address). |
| Institution Console → verifier `/terminal/keys` (on behalf of an institution) | Institution-scoped token: `x-tamga-institution` + `x-institution-token` = base64url(HMAC-SHA256(admin token, `tamga-terminal-keys/v1:` + institution)); the institution gets, sees and revokes keys only for the groups bound to it in the signed list (`terminal_groups[].institution_id`); a key of a group withdrawn from the list gets 403 at the gate ([[ADR-0069]] TG1–TG3). |
| OID4VCI / OID4VP endpoints | The protocol's own mechanism |

## 6.5 Rate limit

`429` + `Retry-After`. Recommendation: 100/min per institution for `/offers`, 1000/min for `/presentations`. Tamga Verify
returns `429 rate_limited` + `Retry-After` on opening presentations (`/presentations`), the wallet response (`/vp/response`) and
gate verification (`/terminal/verify`); the client address is not stored or logged.

The sample site's start endpoint (`/sample-site/start`, sandbox only) is limited as well. Because the proxy does not forward the client address, unauthenticated requests share one bucket; if the proxy sends a client key header that it sets itself on every request (`TAMGA_VERIFY_CLIENT_KEY_HEADER`), buckets are separated per client. The header is read only on requests coming from the local proxy; its value is neither stored nor logged.

---

# 7. Invariants

| # | Invariant |
|---|---|
| **AP1** | The meaning of a step code never changes; a removed code is never reused. |
| **AP2** | `INDETERMINATE` is not put in the same bucket as `REJECTED`. |
| **AP3** | The result object carries claim names, not values. |
| **AP4** | `idx` appears in no API response or record. |
| **AP5** | The HTTP status code does not encode the verification result. |
| **AP6** | A policy's `required_claims` cannot exceed the scope of the RP's trust list record. |
| **AP7** | The error `detail` field contains no personal data. |
| **AP8** | `C2` (schema authorisation) cannot be skipped by any configuration. |
| **AP11** | `C1` and `C2` take the credential's `iat`; issuance-time queries are not used in verification. Exception: in a ZK presentation (`mso_mdoc_zk`) the signing time of the credential is hidden in the proof; `C1` and `C2` take the proof timestamp (§1.1, [[ADR-0032]]). |
| **AP12** | `issuerId` is derived from the `x5c` leaf fingerprint, not from the `iss` claim. |
| **AP13** | Pass token verification ([[ADR-0012]] B): signature with the copy key in `pass_grant`, `aud` = the verifier's persistent identity (the `dns_name` of its trust list record; unchanged when the certificate is renewed, [[ADR-0034]]), lifetime (`exp` − `iat`) ≤ 60 s, `iat` ≤ now + 30 s, `exp` ≤ now + 60 s + 30 s (clock-skew tolerance), a `jti` replay list (shared online within the terminal group); no personal data is extracted from the token or logged. The gate's request carries a terminal key; a request without one does not touch the token ([[ADR-0065]] TK1). |
| **AP9** | `E4` (audit record) also runs for rejected verifications (in a verifier with an audit sink; always in the hosted verifier). |
| **AP10** | `tx_code` is stored nowhere outside the response. |

---

# Security and privacy notes

**The result object is an audit artefact.** It is kept for a long time ([[ARCH-0004]] §5.4: 12 months). AP3 and AP4 together
prevent this period from becoming a tracking surface.

**The `/claims` endpoint is authorised separately.** Seeing the verification result and reading the disclosed values are
different permissions. An HR assistant may see "candidate verified" without seeing the grade average (if disclosed).

**Pay attention if `checks_skipped` is not empty.** It means a step was not applied: a step the format does not carry (for
example `C4` for mdoc and ZK presentations), one the policy does not ask for (`C3`), one the caller switched off deliberately
(`E3`, `E4`), or one the implementation does not perform; an old SDK may also have skipped a check ([[ARCH-0005]] §4.1). The
verifier application must make skipped steps **visible**, not accept them silently.

**Preflight can be a leak surface.** `/offers/preflight` is queried with `subject_ref` and answers the question "does this
student exist". It is an internal endpoint of the institution; it must not be exposed.

---

# Open issues

1. The `E1`–`E3` policy steps can be customised by the institution. How far? Could leaving them fully open indirectly bypass
   `C2`? AP8 forbids it, but no technical enforcement mechanism has been written.
2. The authorisation model of the `/claims` endpoint (role-based or field-based) is not defined.
3. Is a bulk verification endpoint (`POST /presentations/batch`) needed? A university may want to verify thousands of
   graduates in bulk — but this conflicts with the person-by-person presentation model.
4. How `subject_ref` is stored inside the issuer is outside the scope of this document but is the institution's data
   protection (KVKK) obligation; it should be addressed in the `PM-GTM-0001` pilot agreement.
5. Should the machine-readable form of the step code registry (`step-codes.json`) be published in `@tamga-network/core`?
   Probably yes → [[ARCH-0005]].

---

# Related documents

[[ARCH-0003]] · [[ARCH-0004]] · [[ARCH-0005]] · [[SPEC-CRED-0002]] ·
[[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-BC-0001]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[INVARIANTS]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).

**Version note (2026-11-12; approved by project management — behaviour unchanged).** Three deviations left from the
document–code scan were closed on the document side and tied to decision records: asking `C1`/`C2` at proof time in a ZK
presentation is the explicit exception to AP11 ([[ADR-0032]] implementation note; §1.1, the AP11 row); `C4` is not applied to
mdoc and ZK presentations and the class is read from `issuer.class` ([[ADR-0010]] implementation note; §1.C); how the codes
`A3d` and `A8` are reported ([[ADR-0056]] implementation note; §1.3).
