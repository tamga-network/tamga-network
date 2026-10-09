---
document_id: SPEC-SCHEMA-0001
title: "Schema catalogue"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-09
summary: >
  The normative implementation of the [[ADR-0007]] decisions. Defines the schemas.tamga.network URL scheme and namespaces,
  the structure of the SD-JWT VC Type Metadata document published at every vct address, how the vct#integrity value is
  computed, the root type TamgaBaseCredential, the SchemaRegistry and IssuerRegistry contract interfaces, the schema
  publication pipeline (repository → CI → hash → CDN → chain), the six-step resolution algorithm on the verifier side,
  versioning and retirement rules, the multilingual field structure and nine invariants.
translation_of: SPEC-SCHEMA-0001
source_version: 1.0.0
---

This specification defines how credential types (schemas) are named and published in Tamga and how they are resolved at a
[[t:verifier]]; it is written for issuing institutions ([[t:issuer|issuers]]), verifier developers and schema authors.

**When to read**

- First read the [Credential formats](/concepts/credential-formats) concept page.
- This page is for you if you are designing a new credential type or resolving a credential's type in your verifier.
- The content of the types is in separate documents: education [[SPEC-SCHEMA-0002]], other sectors [[SPEC-SCHEMA-0003]].

**In brief**

Every credential type has a name (its [[t:vct]]), such as `urn:tamga:edu:DiplomaCredential:1`. Behind the name is a type
definition published on schemas.tamga.network (Type Metadata): it says which fields the credential has, how it is displayed
and which fields can be hidden. The fingerprint (integrity) of the type definition is written into the credential; the
verifier checks that the definition it downloads matches this fingerprint, so the definition cannot be changed silently. Which
types are valid is published in the signed [[t:trust-list]].

> Today the catalogue is published through the signed trust lists (`lotl.schemas[]` + the anchor log). The contract
> interfaces in §5 and the chain step in the publication pipeline belong to the ledger stage ([[ADR-0009]]).

---

# Scope

This specification defines **how the Tamga schema registry works technically**. The decisions and their rationale are in
[[ADR-0007]] and [[PM-SCHEMA-0001]]; they are not repeated here.

Out of scope: the content of individual schemas ([[SPEC-SCHEMA-0002]] education, [[SPEC-SCHEMA-0003]] other sectors).

**Standards basis:** the Type Metadata section of [[t:SD-JWT-VC]] (draft-ietf-oauth-sd-jwt-vc-19); JSON Schema draft 2020-12;
W3C Subresource Integrity (the integrity metadata string format).

---

# 1. URL scheme and namespaces

## 1.1 General form

> **Development stage ([[ADR-0029]]):** until the beta release, schemas are corrected in place on the same version path; D1
> and the minor-version rule apply from the beta (`SCHEMA_STAGE = "stable"`). The catalogue and the `lotl.schemas[]` entry
> carry a `content_hashes` field; the verifier (B4) and the wallet look up the credential's `vct#integrity` in this list.
> During the development stage the list holds only the current digest.

> **ADR-0010 (D-SCHEMA-4):** the type **identifier** is `vct = urn:tamga:<domain>:<Type>:<major>` (in the state stage, state-specific
> `urn:tamga:<cc>:<domain>:<Type>:<major>`), `schemaId = keccak256(vct)`. The HTTPS paths below are not identifiers but the
> **`metadata_url` / `schema_uri`** (the hosting address; the catalogue `schemas.tamga.network/v1/catalogue.json` gives
> `vct → metadata_url + content_hash`, the registry path of IETF SD-JWT VC-19 §5.3.2). `vct#integrity` is mandatory (ETSI TS
> 119 472-1). If the domain name changes, the identifier does not (D-NAME-1).

```
NETWORK layer:
https://schemas.tamga.network/v1/<domain>/<TypeName>/<semver>

NATIONAL layer:
https://schemas.tamga.network/v1/<cc>/<domain>/<TypeName>/<semver>
```

- `v1` — the **registry protocol version**, not the schema version. If the structure of the Type Metadata document changes
  it becomes `v2`. So far `v1`.
- `<cc>` — ISO 3166-1 alpha-2, **lower case** (`tr`, `az`, `kz`, `uz`, `kg`). Present only in the NATIONAL layer.
- `<domain>` — closed list (§1.2).
- `<TypeName>` — PascalCase, ends with `Credential`.
- `<semver>` — `MAJOR.MINOR.PATCH`, all three parts required.

Examples:

```
urn:tamga:edu:DiplomaCredential:1
urn:tamga:edu:StudentCredential:1
urn:tamga:core:TamgaBaseCredential:1
https://schemas.tamga.network/v1/tr/edu/YOKDenklikCredential/1.0.0
```

## 1.2 Domain list (closed)

| Domain | Scope | Phase |
|---|---|---|
| `core` | Root types, shared structures | 0 |
| `edu` | Education and qualifications | **0** |
| `org` | Legal entities, employee authority | 0 (skeleton) |
| `id` | Identity, residence | 1 |
| `health` | Health | 2 |
| `fin` | Finance | 2 |
| `log` | Logistics, trade | 2 |
| `travel` | Travel, tourism | 2 |

Adding a new domain is a NETWORK decision (2/3 vote). NATIONAL schemas use the existing domain list; they cannot invent their
own domain.

## 1.3 Content returned by each URL

| Path | Content | `Content-Type` |
|---|---|---|
| `.../<semver>` | Type Metadata document | `application/json` |
| `.../<semver>/schema.json` | JSON Schema 2020-12 | `application/schema+json` |
| `.../<semver>/mapping.json` | ELM/OBv3 mapping table (informative) | `application/json` |

The Type Metadata itself lives at the `vct` URL. This directly enables the standard's "fetch from the `vct` URL" path
([[ADR-0007]] Decision 1).

## 1.4 Resolvability and the registry path

Because the `vct` is an HTTPS URL, the primary resolution path is a direct `GET`. In addition the registry supports the
standard's "fetch from a registry" path:

```
GET https://schemas.tamga.network/v1/resolve?vct=<url-encoded-vct>
```

This endpoint is for off-network consumers and for clients that cannot reach the `vct` directly. It returns the same
document, byte for byte — otherwise the integrity breaks.

---

# 2. Type definition (Type Metadata)

## 2.1 Structure

The document published at every `vct` address:

```json
{
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "name": "Tamga Diploma Credential",
  "description": "A graduation credential issued by a higher-education institution.",

  "extends": "urn:tamga:core:TamgaBaseCredential:1",
  "extends#integrity": "sha256-Yr9k...",

  "schema_uri": "https://schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0/schema.json",
  "schema_uri#integrity": "sha256-3Qm2...",

  "display": [ /* §2.2 */ ],
  "claims":  [ /* §2.3 */ ],

  "tamga": { /* §2.4 — ecosystem extension */ }
}
```

Rules:

- `schema` (embedded) is **not used**; `schema_uri` is always used. Rationale: to keep the Type Metadata document small and
  make the schema separately cacheable.
- `schema_uri#integrity` is **mandatory.**
- **Tamga extension:** `schema_uri` and `schema_uri#integrity` are **not** among the Type Metadata properties of IETF SD-JWT VC
  draft 19 (earlier drafts had them). Tamga keeps them as its own extension: a standard consumer does not know these two
  properties and ignores them (rule below); the JSON Schema check (verification step B6) runs only in the Tamga verifier.
- Every type except the root type (`TamgaBaseCredential`) **must** have `extends` + `extends#integrity`.
- Unrecognised top-level properties are **ignored** by consumers — a requirement of the standard. This is what makes the
  `tamga` extension block safe.

## 2.2 `display` — per-language presentation

```json
"display": [
  {
    "lang": "tr-TR",
    "name": "Diploma",
    "description": "Yükseköğretim mezuniyet belgesi",
    "rendering": {
      "simple": {
        "background_color": "#0B3D2E",
        "text_color": "#FFFFFF"
      }
    }
  },
  { "lang": "en-US", "name": "Diploma", "description": "Higher education degree" },
  { "lang": "az-AZ", "name": "Diplom",  "description": "Ali təhsil diplomu" },
  { "lang": "kk-KZ", "name": "Диплом",  "description": "Жоғары білім дипломы" },
  { "lang": "uz-UZ", "name": "Diplom",  "description": "Oliy ta'lim diplomi" },
  { "lang": "ky-KG", "name": "Диплом",  "description": "Жогорку билим дипломy" }
]
```

**Minimum language set:** `tr-TR` and `en-US` are **mandatory** in every NETWORK schema. The languages of other member states
are added when that state joins (MINOR version).

In NATIONAL schemas only the owning state's language + `en-US` are mandatory.

## 2.3 `claims` — per-field presentation and disclosure policy

```json
"claims": [
  {
    "path": ["qualification_title"],
    "display": [
      { "lang": "tr-TR", "label": "Program", "description": "Mezun olunan program" },
      { "lang": "en-US", "label": "Programme" }
    ],
    "sd": "allowed"
  },
  {
    "path": ["vct"],
    "sd": "never"
  },
  {
    "path": ["birth_date"],
    "display": [{ "lang": "tr-TR", "label": "Doğum tarihi" }],
    "sd": "allowed"
  }
]
```

The `sd` values and their meaning in Tamga:

| Value | Meaning | Tamga usage |
|---|---|---|
| `always` | The claim **must** be hideable through selective disclosure | Sensitive fields (identity number, date of birth) |
| `allowed` | The issuer may choose | Default |
| `never` | **Cannot** be hidden through selective disclosure, always visible | `iss`, `vct`, `cnf`, `status`, `iat` |

**Tamga rule:** `sd: "never"` is used only for protocol claims. No **personal data** field may be `never`. This is enforced
by the invariants in §11.

## 2.4 The `tamga` extension block

Tamga-specific metadata that is not in the standard:

```json
"tamga": {
  "tier": "NETWORK",
  "schemaId": "0x7f3a...",
  "issuer_categories": ["EDUCATION"],
  "default_ttl_days": null,
  "uses_status_list": true,
  "min_issuer_assurance": "I2",
  "derived_claims": ["is_graduate", "graduated_before"],
  "elm_profile": "ELM-3.3/Qualification",
  "status": "ACTIVE"
}
```

| Field | Meaning |
|---|---|
| `tier` | `NETWORK` \| `NATIONAL` ([[ADR-0007]] Decision 5) |
| `schemaId` | `keccak256(vctURI)` on the chain — a cross-check |
| `issuer_categories` | Which `IssuerCategory` may use this schema |
| `default_ttl_days` | **Maximum** `exp` period (a ceiling, not a fixed value); `null` = long-lived |
| `uses_status_list` | If `false`, short-lived, no status list ([[ADR-0008]] Alt. C) |
| `min_issuer_assurance` | Minimum issuer level ([[PM-ASSUR-0001]] I1–I3) |
| `derived_claims` | Derivatives of the `age_over_NN` pattern ([[RS-SCHEMA-0001]] §4) |
| `elm_profile` | Which ELM version/profile it is mapped to |
| `status` | `ACTIVE` \| `DEPRECATED` \| `REVOKED` — consistent with the chain |

The `issuer_categories` field is **informative**; the binding check is on the chain (§5.2). If the document and the chain
disagree, **the chain wins.**

---

# 3. Producing the integrity value

## 3.1 Format

The W3C Subresource Integrity string format:

```
sha256-<base64(SHA-256(raw bytes of the document))>
```

(that is, the base64 of the SHA-256 of the document's raw bytes)

Example: `sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=`

## 3.2 Computation rules (normative)

1. The hash is computed over the **raw byte sequence** returned by the server. The JSON is not re-serialised and whitespace
   is not normalised.
2. The published file is therefore **byte-for-byte immutable.** A CDN or proxy is not allowed to reformat it.
3. Files are written with **LF** line endings, **UTF-8, without BOM**.
4. The trailing newline is part of the file and included in the hash.

```bash
# Referans hesaplama
printf 'sha256-%s\n' "$(openssl dgst -sha256 -binary dosya.json | openssl base64 -A)"
```

## 3.3 Where it is used

| Value | Where | Mandatory |
|---|---|---|
| `vct#integrity` | In the credential's own payload | **Yes** ([[ADR-0007]] Decision 3) |
| `extends#integrity` | Inside the Type Metadata | Yes (except the root type) |
| `schema_uri#integrity` | Inside the Type Metadata (Tamga extension, §2.1) | Yes |
| `contentHash` | In the `SchemaRegistry` contract | Yes |

`contentHash` = the hash of the **same** document that `vct#integrity` points to, as `bytes32` (raw SHA-256, not base64).

**Invariant:** `contentHash` and `vct#integrity` represent the same bytes. Each verifies the other; if they do not match, the
credential is rejected.

---

# 4. Root type — TamgaBaseCredential

Every Tamga credential derives, directly or indirectly, from `core/TamgaBaseCredential`.

## 4.1 Mandatory fields

| Claim | Type | `sd` | Description |
|---|---|---|---|
| `iss` | string | `never` | Issuer identifier, resolves to X.509 ([[SPEC-ID-0002]]) |
| `vct` | string (URI) | `never` | Type URL |
| `vct#integrity` | string | `never` | §3 |
| `iat` | number | `never` | Issuance time |
| `cnf` | object | `never` | Holder key ([[SPEC-CRED-0001]] §3) |

## 4.2 Conditional fields

| Claim | When |
|---|---|
| `exp` | **Mandatory** if `tamga.default_ttl_days` is set; `exp - iat` cannot exceed that value |
| `status` | **Mandatory** if `tamga.uses_status_list = true` ([[ADR-0008]]) |

## 4.3 Shared structures

The root type also carries reusable JSON Schema definitions:

- `LangString` — multilingual text (§8)
- `IssuerRef` — issuer reference
- `DateOnly` — the `YYYY-MM-DD` format

---

# 5. Contract interfaces (ledger stage)

> Not used today: schema records are published in the signed trust list (`lotl.schemas[]`). These interfaces are for the
> ledger stage ([[ADR-0009]]).

## 5.1 SchemaRegistry

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface ISchemaRegistry {
    enum Tier   { NETWORK, NATIONAL }
    enum Status { NONE, ACTIVE, DEPRECATED, REVOKED }

    struct SchemaRecord {
        string  vctURI;        // canonical type identifier
        bytes32 contentHash;   // SHA-256 of the Type Metadata document
        string  version;       // semver, e.g. "1.0.0"
        Tier    tier;
        bytes2  stateCode;     // owner if NATIONAL; 0x0000 if NETWORK
        Status  status;
        uint64  validFrom;
        bytes32 supersededBy;  // newer version; 0x0 if none
    }

    event SchemaRegistered(bytes32 indexed schemaId, string vctURI, Tier tier, bytes2 indexed stateCode);
    event SchemaDeprecated(bytes32 indexed schemaId, bytes32 supersededBy);
    event SchemaRevoked(bytes32 indexed schemaId, string reason);

    error SchemaExists(bytes32 schemaId);
    error UnknownSchema(bytes32 schemaId);
    error NotSchemaOwner(bytes32 schemaId, address caller);
    error NetworkTierRequiresGovernance();

    /// @notice schemaId = keccak256(bytes(vctURI))
    function schemaIdOf(string calldata vctURI) external pure returns (bytes32);

    /// @notice NETWORK: only via a Governance execution. NATIONAL: onlyOwnerState.
    function registerSchema(SchemaRecord calldata rec) external;

    function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external;
    function revokeSchema(bytes32 schemaId, string calldata reason) external;

    function getSchema(bytes32 schemaId) external view returns (SchemaRecord memory);
    function isActiveSchema(bytes32 schemaId) external view returns (bool);

    /// @notice For verification: does the given hash match the on-chain record?
    function matchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool);
}
```

**Authority rules:**

- `tier == NETWORK` → the call may come only from a proposal executed by the `Governance` contract with a 2/3 vote
  ([[ADR-0002]] Layer 1).
- `tier == NATIONAL` → `onlyOwnerState(stateCode)` ([[SPEC-BC-0001]] §0).

**Invariant:** the `vctURI` and `contentHash` fields of a registered schema are **never updated.** A change = a new version =
a new `schemaId`. `deprecateSchema` and `revokeSchema` change only the `status` field.

## 5.2 IssuerRegistry — schema authorisation extension

The contract counterpart of [[ADR-0007]] Decision 6. Added to the existing `IIssuerRegistry`:

```solidity
interface IIssuerRegistry {
    // ... existing members ...

    event SchemaAuthorizationSet(bytes32 indexed issuerId, bytes32 indexed schemaId, bool allowed);

    error SchemaNotAuthorized(bytes32 issuerId, bytes32 schemaId);

    /// @notice The state that registered the issuer grants the authorisation (onlyOwnerState).
    function setSchemaAuthorization(bytes32 issuerId, bytes32 schemaId, bool allowed) external;

    /// @notice At ISSUANCE: "may it issue this schema now?"
    function isAuthorizedForSchema(bytes32 issuerId, bytes32 schemaId) external view returns (bool);

    /// @notice At VERIFICATION (mandatory step): "was it authorised at iat?"
    function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
        external view returns (bool);

    function authorizedSchemasOf(bytes32 issuerId) external view returns (bytes32[] memory);
}
```

(The contract comments say: the state that registered the issuer grants the authorisation; `isAuthorizedForSchema` answers
"may it issue with this schema now?" at **issuance**; `isCredentialSchemaAcceptable` answers "was it authorised at `iat`?"
at **verification** — a mandatory step.)

**Implementation note:** `isAuthorizedForSchema` must satisfy **all** of these three conditions:

1. `issuerId` is valid and `canIssue` ✓
2. `schemaId` is `ACTIVE` ✓ (if `DEPRECATED`, **no new issuance**)
3. The `(issuerId, schemaId)` pair has been explicitly authorised ✓

The third condition is **false by default**. In other words, if authorisation has not been granted explicitly, it does not
exist — allowlist logic, not blocklist.

---

# 6. Schema publication pipeline

Bringing a schema into use takes six steps and **their order is binding:**

```
1. DESIGN      the schema is written in the source repository (schemas/ directory)
                 ↓
2. VALIDATE    CI: is the JSON Schema valid, are the Type Metadata fields complete,
                    does the extends chain resolve, are the minimum languages present,
                    is sd:never used on personal data (§11 check)
                 ↓
3. FREEZE      files are fixed at byte level (LF, UTF-8, no-BOM)
                 ↓
4. HASH        CI computes contentHash and all #integrity values;
                    writes them into the Type Metadata; hashes again (two passes)
                 ↓
5. PUBLISH     uploaded to the CDN at an immutable URL (nobody can use it yet)
                 ↓
6. REGISTER    registerSchema(...) — after a vote for NETWORK, directly for NATIONAL
```

**Why this order:** the chain registration must happen **after** the document is reachable. In the reverse order a schema
would exist that is registered on the chain but cannot be resolved, and every credential produced with it would be
unverifiable.

**The two-pass hash (step 4)** needs care: `schema_uri#integrity` is **inside** the Type Metadata, so the schema is hashed
first and written into the Type Metadata, then the Type Metadata is hashed. If the order is reversed, the hash never matches.

**Rollback:** there is no rollback after step 6. `revokeSchema` is a forward move, not a deletion.

---

# 7. Resolution algorithm (verifier side)

Normative. A failure at any step means the credential is **rejected**.

```
INPUT: SD-JWT VC (issuer-signed JWT + disclosures + KB-JWT)

Ş1. Read the vct and vct#integrity claims.
    If vct or vct#integrity is missing → REJECT.

Ş2. schemaId = keccak256(bytes(vct))
    SchemaRegistry.getSchema(schemaId)
    No record → REJECT (unregistered type).
    status == REVOKED → REJECT.
    status == DEPRECATED → acceptable; but REJECT if iat > the deprecation time.

Ş3. Obtain the Type Metadata:
    a) Is it in the local cache under the vct#integrity key? If so, use it.
    b) Otherwise GET <vct>. If that fails, try /v1/resolve?vct=...
    c) If neither works → verification CANNOT be done (not REJECT; return "indeterminate").

Ş4. Integrity:
    SHA-256(received bytes) == vct#integrity  → otherwise REJECT.
    SHA-256(received bytes) == record.contentHash → otherwise REJECT.
    The "vct" field inside the document == the vct in the credential → otherwise REJECT.

Ş5. Resolve the extends chain (if any):
    Verify extends#integrity at every step.
    Cycle detected → REJECT. Depth > 5 → REJECT.

Ş6. Schema conformance:
    Fetch schema_uri, verify schema_uri#integrity,
    validate the credential payload against JSON Schema 2020-12 → REJECT if it does not conform.

Ş7. AUTHORISATION (ADR-0007 Decision 6 — cannot be skipped):
    issuerId = derived from the x5c leaf fingerprint (SPEC-ID-0002; NOT from the iss claim)
    IssuerRegistry.isCredentialSchemaAcceptable(issuerId, schemaId, credential.iat) == true
    → otherwise REJECT.
    (isAuthorizedForSchema is the ISSUANCE question; if it were used for verification,
     old credentials issued with a DEPRECATED schema would fail — SPEC-BC-0001 R3)

OUTPUT: the schema is valid. The remaining verification steps are in SPEC-API-0001.
```

**About Ş3(c):** when the schema cannot be obtained, the result is not "invalid" but **"could not be verified"**. The verifier
must show these two differently to the user. The difference between "the diploma is fake" and "I cannot verify it right now"
is whether a person is hired or not.

## 7.1 Offline verification

Thanks to Ş3(a), offline verification is possible: because `vct#integrity` uniquely identifies the document's content, the
cache is valid indefinitely and independent of HTTP cache directives.

In offline mode **Ş2 and Ş7 cannot be done** (they need a chain read). In that case the verifier must show the user how fresh
the last known chain state is (`blockNumber`, `timestamp`).

---

# 8. Multilingual support

## 8.1 The `LangString` structure

Every text field shown to the user is a `LangString`:

```json
"qualification_title": {
  "tr-TR": "Bilgisayar Mühendisliği",
  "en-US": "Computer Engineering"
}
```

JSON Schema definition (in the root type, reused):

```json
"LangString": {
  "type": "object",
  "propertyNames": { "pattern": "^[a-z]{2}(-[A-Z]{2})?$" },
  "additionalProperties": { "type": "string", "minLength": 1 },
  "minProperties": 1
}
```

## 8.2 Rules

1. **Build it in from the start.** Making a field a plain `string` and later turning it into a `LangString` is a MAJOR
   version break. Every field shown to the user is born a `LangString`.
2. **Code fields are not `LangString`.** `eqf_level`, `isced_f_code`, `awarding_date` have a single value; they are not
   translated.
3. **At least one language is mandatory.** The issuer always fills in the institution's official language.
4. **Wallet display order:** the user's device language → `en-US` → the first available language.

## 8.3 Why the code fields are what really matters

An employer does not read the `qualification_title` text; it reads the `isced_f_code` and `eqf_level` fields. Text is for
people, codes are for machines, and **it is the code that provides recognisability.** An employer in Germany does not need to
understand the wording "Bilgisayar Mühendisliği"; it understands the ISCED-F code and the EQF level.

This is the practical counterpart of the controlled-vocabulary emphasis of [[RS-SCHEMA-0001]].

---

# 9. Versioning and retirement

## 9.1 Semver rules

| Change | Version | Status of the old schema |
|---|---|---|
| Removing a field, changing a type, adding a required field | **MAJOR** | `DEPRECATED` |
| Adding an optional field, a new language, a new derived claim | **MINOR** | stays `ACTIVE` |
| Correcting a description/label (meaning unchanged) | **PATCH** | stays `ACTIVE` |

Every version is **a new URL, a new `schemaId`, a new chain record**. The content of a published URL never changes.

## 9.2 Three states and their meaning

| State | New issuance | Verification of existing credentials |
|---|---|---|
| `ACTIVE` | ✓ | ✓ |
| `DEPRECATED` | ✗ | **✓ — continues** |
| `REVOKED` | ✗ | ✗ (special handling) |

**Critical:** `DEPRECATED` means "can no longer be issued"; it **does not** mean "can no longer be verified." A diploma issued
with `1.0.0` in 2027 must still be verifiable in 2035 while `3.0.0` is in force. A diploma lives longer than a schema version.

Therefore:
- The documents of `DEPRECATED` schemas are **never removed from the CDN.**
- The chain record is **not deleted.**
- The `supersededBy` field lets the verifier say "this credential is an older version; this is its current counterpart".

`REVOKED` is the exception: for cases where the schema itself is wrong or dangerous (for example an identity number field
marked `sd: never` by mistake). Credentials issued with that schema are handled separately and issuers are directed to
re-issue.

## 9.3 Transition period

When a MAJOR version is published, the old version stays `ACTIVE` for **at least 24 months**. During this period issuers may
issue both versions in parallel. At the end of the period the old version becomes `DEPRECATED`.

---

# 10. Hosting and operations

## 10.1 Component properties

`schemas.tamga.network` is a **static file service.** It is not an application server; it has no database and generates no
dynamic content. The only exception is the `/v1/resolve` endpoint, and that only redirects.

| Property | Value |
|---|---|
| Content | Static JSON |
| Caching | `Cache-Control: public, max-age=31536000, immutable` |
| TLS | Mandatory, HSTS |
| DNSSEC | Mandatory |
| Availability target | 99.9 % (it does not stop verification, §10.2) |
| Source | Git repository — every publication is a commit |

## 10.2 Effect of an outage

An outage of the schema server:

- **Does not stop verification.** Verification continues with cached schemas (§7.1).
- **Stops learning new types.** A `vct` not seen before cannot be resolved.
- **Does not affect new issuance.** The issuer keeps its own schema locally.

So the SLO can be looser than for the critical-path components. Details in [[ARCH-0004]].

## 10.3 Domain name risk

Losing the `schemas.tamga.network` domain name is **an ecosystem-wide event** — every past `vct` value becomes unresolvable.
Mitigation:

1. The domain name is owned by the institution (the foundation), with registrar lock enabled.
2. DNSSEC.
3. The git repository of all schemas is mirrored in several places.
4. In the state stage, mirror servers of the member states (`/v1/resolve` compatible).
5. Hand-over plan: if the foundation is dissolved, the transfer of the domain name to the council is bound by contract in
   [[PM-GOV-0001]].

---

# 11. Invariants

These are enforced in CI and in the contract. A violation = publication blocked.

| # | Invariant |
|---|---|
| **D1** | The content of a published Type Metadata / JSON Schema file (`metadata_url`) never changes; a minor/patch change gets a new `metadata_url` + hash, a major change a new `vct` URN ([[ADR-0010]] K7). |
| **D2** | `contentHash` (chain) = `vct#integrity` (credential) = SHA-256(published bytes). |
| **D3** | The `vct` inside the Type Metadata must equal the `vct` in the credential. |
| **D4** | Every type except the root type has `extends` + `extends#integrity`. |
| **D5** | The `extends` chain is acyclic and at most 5 levels deep. |
| **D6** | No personal data field may be `sd: "never"`. |
| **D7** | Every NETWORK schema carries `display` for at least `tr-TR` and `en-US`. |
| **D8** | The chain registration is made after the CDN publication (the order rule of §6). |
| **D9** | The default of `isAuthorizedForSchema` is `false` (allowlist). |

---

# Security and privacy notes

**The schema server is a tracking surface.** If a wallet or verifier fetched the schema from the server every time, the
server would collect "who saw which credential type when". Mitigation:

1. Indefinite caching (§7.1) — no request goes out in normal operation.
2. Wallets fetch the types the user holds **in bulk at installation**, not at the time of use.
3. The server **keeps no access log** — only an aggregate counter. This is a policy commitment and must be written into
   [[PM-GOV-0001]].

**A schema contains no personal data.** A schema is a *definition*, not data. The `display` texts may still mention an
institution's name; that is public information and not a problem.

**Why D6 is critical:** a field marked `sd: "never"` is closed to [[t:selective-disclosure]], that is, **visible in every
presentation.** Marking an identity number `never` by mistake means the identity number goes to every verifier in all
credentials issued with that schema. This cannot be undone; it is fixed only with `REVOKED` + re-issuance. D6 must therefore
be checked both in CI and in human review.

---

# Open questions

1. How is the consistency of the `/v1/resolve` endpoint with the mirror servers guaranteed? (state stage, member-state mirrors)
2. At what granularity are schema usage statistics collected — what is the privacy ceiling? → [[PM-GOV-0001]]
3. Can a NATIONAL schema later be "promoted" to NETWORK? Proposal: no, a new NETWORK schema is written and the NATIONAL one
   points to it with `supersededBy`. Awaiting decision.
4. If a parent type in the `extends` chain becomes `DEPRECATED`, what happens to the child type? Proposal: the child type does
   not automatically become `DEPRECATED`, but CI warns.

---

# Related documents

[[ADR-0007]] · [[PM-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-BC-0001]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-ID-0002]] ·
[[ADR-0008]] · [[ARCH-0004]] · [[ARCH-0005]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).
