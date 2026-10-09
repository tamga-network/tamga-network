---
document_id: SPEC-API-0001
title: "Verification pipeline and API"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-09
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
| `A1` | Split the combined string on `~`; is there a KB-JWT |
| `A2` | Header: `alg=ES256`, `typ=dc+sd-jwt`, is `x5c` present |
| `A3` | `x5c` chain + JWT signature; root in `RootCARegistry` **`isChainAcceptable`** (ACTIVE or RETIRED); intermediates must be CAs (`basicConstraints cA=true`), carry `keyCertSign` and stay within `pathLenConstraint`; an `iat` more than 300 s in the future is REJECTED |
| `A3b` | **`issuerId` is derived from the fingerprint of the `x5c` leaf certificate** — NOT from the `iss` claim (§1.2) |
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

## 1.C — Trust layer → [[SPEC-BC-0001]] §11.2

| Code | Step |
|---|---|
| `C1` | `isCredentialAcceptable(issuerId, iat)` — **iat = the credential's `iat` claim** |
| `C2` | `isCredentialSchemaAcceptable(issuerId, schemaId, iat)` — **cannot be skipped** |
| `C3` | `isRecognizedBy(my own state, issuerId)` |
| `C4` | Credential `category` claim ↔ the issuer class in the record: PUB ↔ `urn:tamga:eaa:pub`, QUALIFIED ↔ `urn:tamga:eaa:qualified`, EAA (I1–I2) ↔ no claim; mismatch → REJECT ([[ADR-0010]] K5, [[SPEC-CRED-0002]]/C18) |

## 1.D — Revocation layer → [[SPEC-CRED-0003]] §7

| Code | Step |
|---|---|
| `D1` | Read `status.status_list` (`idx`, `uri`) |
| `D2` | Take the Status List Token **from the prefetch cache** |
| `D3` | Token signature; `sub == uri`; `iss` in the same chain of trust |
| `D4` | Freshness: `exp` not passed, `iat + ttl` within policy |
| `D5` | Registry anchor: `contentHash` matches, `version` has not gone back (if the cache was fetched before the anchor, `INDETERMINATE`/`STATUS_STALE`; if after, `REJECTED`) |
| `D6` | Read `idx` with `bits=2`; anything other than `0x00` → REJECT |

## 1.E — Policy layer → local

| Code | Step |
|---|---|
| `E1` | Assurance threshold (e.g. `category=EDUCATION && assurance>=I2`) |
| `E2` | Have all requested claims been disclosed |
| `E3` | No RP scope overrun ([[SPEC-PROTO-0002]] §6) |
| `E4` | Audit record written |

## 1.1 C1/C2 are time-bound

`C1` and `C2` do not ask whether the institution can issue the credential **today**, but whether the credential was acceptable
**at the moment** it was issued. If issuance-time questions (`isValidIssuer`, `isAuthorizedForSchema`: "may it issue now?")
were used in verification, they would cause two silent errors:

| Scenario | With an issuance-time question | Correct |
|---|---|---|
| Ministry closed (`REVOKED`, with a successor) | Every diploma REJECTED at `C1` | Those issued before the closure accepted ([[ADR-0002]] #4) |
| Schema became `DEPRECATED` (a new version was released) | Every credential issued with the old schema REJECTED at `C2` | Accept — [[SPEC-BC-0001]]/SC3 |
| Planned CA rotation | `A3` + `C1` REJECT | Accept — a rotation is not a compromise |

That is why both queries take the credential's **`iat`** value and ask "was it acceptable at that moment". This accepts that
verification is a **retrospective** operation — the credential was issued in the past, and the state of that day, not
today's, is decisive.

## 1.2 `issuerId` is derived from the certificate

`A3b` is critical. If the verifier takes `issuerId` **from the `iss` claim**, **any** institution with a valid certificate under
the same Root CA can write the university's identifier into `iss` and produce credentials in its name — the signature is
valid with its own certificate, the chain is valid, `iss` is forged.

Rule: `issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))` — [[SPEC-ID-0002]]. The `iss` claim is used only for a
**consistency check**: it must match the registered issuer's `metadataURI`; if it does not, REJECT.

## 1.3 Order and short-circuit

The steps are run **in order**. Execution stops at the first failure and that code is returned as `failed_step`.

**Exception:** `E4` always runs — a rejected verification is logged as well.

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
  "sdk_version": "@tamga-network/verifier@0.3.0",
  "checks_performed": ["A1","A2","A3","A3b","A3c","A3d","A4","A5","A6","A7","A8",
                       "B1","B2","B3","B4","B5","B6",
                       "C1","C2","C3","C4",
                       "D1","D2","D3","D4","D5","D6",
                       "E1","E2","E3"],
  "checks_skipped": [],

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

| Field | Meaning |
|---|---|
| `status.reason` | Optional text (`string \| null`): why the status has this value, when it is not self-explanatory. E.g. `NOT_APPLICABLE` + a ZK presentation: the revocation index is not revealed ([[ADR-0032]] ZK4). Carries no personal data. |

## 2.3 `indeterminate_reason`

**Mandatory** when `outcome == INDETERMINATE`:

| Value | Source |
|---|---|
| `SCHEMA_UNREACHABLE` | [[SPEC-SCHEMA-0001]] §7 Ş3(c) |
| `STATUS_UNREACHABLE` | [[SPEC-CRED-0003]] §7 Ş3(c) |
| `STATUS_STALE` | [[SPEC-CRED-0003]] §8.2 freshness threshold exceeded; or, at D5, the verifier's prefetch delay / clock-tolerance window / unreadable anchor time |
| `CHAIN_UNREACHABLE` | Chain and indexer unreachable |
| `INDEXER_STALE` | [[ARCH-0003]]/CMP4 |
| `SDK_VERSION_MISMATCH` | [[ARCH-0005]] §4.2 M2; also at `Z1` when the verifier's own ZK component is unavailable (circuit file missing, WASM cannot be loaded) — the verifier's shortcoming, not the presentation's |

The following also give `INDETERMINATE`, not `REJECTED`:

- **Unexpected exception** (library error, corrupt trust record …): `INDETERMINATE` at that step, with that layer's reason (A →
  `CHAIN_UNREACHABLE`, B → `SCHEMA_UNREACHABLE`, C/E/T0 → `INDEXER_STALE`, D → `STATUS_UNREACHABLE`); the exception message is
  not put in `failed_reason` (AP3), only the step and the error type. The result still goes to the E4 audit record.
- **ZK presentation with `accept_unrevocable_zk: false`:** a ZK presentation carries no revocation index (ZK4); if the policy
  requires a revocation check the outcome is `D1` / `STATUS_UNREACHABLE`. With `true` (or when omitted) it is accepted:
  `status.value = NOT_APPLICABLE`, with `status.reason` set.

## 2.4 `disclosed_claims` — names only

**Invariant AP3:** the result object does not carry claim **values**, only their **names**. Values are given to the calling
application through a separate channel and only when explicitly requested.

Rationale: the result object is written to the audit record ([[ARCH-0004]] §5.2). If values leaked there, personal data would
spread into the logging infrastructure.

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

**Invariant AP6:** the `required_claims` in a policy cannot exceed the RP's `allowedScopes` in the registry. The service
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
| OID4VCI / OID4VP endpoints | The protocol's own mechanism |

## 6.5 Rate limit

`429` + `Retry-After`. Recommendation: 100/min per institution for `/offers`, 1000/min for `/presentations`. Tamga Verify
returns `429 rate_limited` + `Retry-After` on opening presentations (`/presentations`), the wallet response (`/vp/response`) and
gate verification (`/terminal/verify`); the client address is not stored or logged.

---

# 7. Invariants

| # | Invariant |
|---|---|
| **AP1** | The meaning of a step code never changes; a removed code is never reused. |
| **AP2** | `INDETERMINATE` is not put in the same bucket as `REJECTED`. |
| **AP3** | The result object carries claim names, not values. |
| **AP4** | `idx` appears in no API response or record. |
| **AP5** | The HTTP status code does not encode the verification result. |
| **AP6** | A policy's `required_claims` cannot exceed the RP's scope in the registry. |
| **AP7** | The error `detail` field contains no personal data. |
| **AP8** | `C2` (schema authorisation) cannot be skipped by any configuration. |
| **AP11** | `C1` and `C2` take the credential's `iat`; issuance-time queries are not used in verification. |
| **AP12** | `issuerId` is derived from the `x5c` leaf fingerprint, not from the `iss` claim. |
| **AP13** | Pass token verification ([[ADR-0012]] B): signature with the copy key in `pass_grant`, `aud` = the terminal's RP client_id, lifetime (`exp` − `iat`) ≤ 60 s, `iat` ≤ now + 30 s, `exp` ≤ now + 60 s + 30 s (clock-skew tolerance), a `jti` replay list (shared online within the terminal group); no personal data is extracted from the token or logged. |
| **AP9** | `E4` (audit record) also runs for rejected verifications. |
| **AP10** | `tx_code` is stored nowhere outside the response. |

---

# Security and privacy notes

**The result object is an audit artefact.** It is kept for a long time ([[ARCH-0004]] §5.4: 12 months). AP3 and AP4 together
prevent this period from becoming a tracking surface.

**The `/claims` endpoint is authorised separately.** Seeing the verification result and reading the disclosed values are
different permissions. An HR assistant may see "candidate verified" without seeing the grade average (if disclosed).

**Pay attention if `checks_skipped` is not empty.** It means an old SDK skipped a check ([[ARCH-0005]] §4.1). The verifier
application must make this **visible**, not accept it silently.

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
