---
document_id: ADR-0007
title: "Schema registry"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Fixes the architecture of the Tamga schema registry. Seven decisions: (1) vct = a stable HTTPS URL under
  schema.tamga.network; (2) the schema document is off-chain, as SD-JWT VC Type Metadata + JSON Schema 2020-12;
  (3) vct#integrity is mandatory; (4) the SchemaRegistry contract holds only an anchor (URI + hash + version + status);
  (5) two-tier schema space — NETWORK (2/3 vote) and NATIONAL (onlyOwnerState); (6) issuer↔schema authorisation is on the
  ledger and a mandatory step in verification; (7) versioning with semver + immutable URLs + extends. Rejected alternatives
  and binding consequences are recorded.
domain: Credentials
translation_of: ADR-0007
source_version: 1.0.0
---

# ADR-0007 — Schema registry architecture

**Status: Accepted** ✅ (2026-09-09)

---

# Context

[[PM-SCHEMA-0001]] recorded three weaknesses: category overreach (an education [[t:issuer]] able to sign a health
document), fragmented meaning (every issuer using its own field names), and over-asking checks lacking a basis. All three
have the same root: the network **had no schema registry.**

[[ADR-0006]] fixed the [[t:credential]] format as **[[t:SD-JWT-VC]]**. In SD-JWT VC the credential type is carried by the
`vct` claim ([[t:vct]]) and the meaning of the type is defined by a **Type Metadata** document. A schema registry is
therefore not an abstract architectural preference but a component the chosen format directly requires.

The standard (draft-ietf-oauth-sd-jwt-vc-19) defines several ways to resolve Type Metadata: from the URL in `vct`, from a
**registry**, by a method defined by the ecosystem, or from a local cache. For the registry route it states explicitly
that the consumer must trust that registry. The `vct#integrity` claim carries an integrity metadata string protecting the
Type Metadata document; `extends` and `extends#integrity` allow a type hierarchy; the schema itself is carried in the
`schema` or `schema_uri` parameter of the Type Metadata, conforming to **JSON Schema 2020-12**.

So the framework of what we build is already in the standard. What has to be decided is how it fits Tamga.

---

# Decision

## Decision 1 — `vct` is a stable HTTPS URL

In Tamga credentials `vct` is a stable HTTPS URL under the `schema.tamga.network` domain. URNs, free strings or
institution-local identifiers are **not used.**

```
https://schema.tamga.network/v1/edu/DiplomaCredential/1.0.0
https://schema.tamga.network/v1/tr/edu/YOKDenklikCredential/1.0.0
```

**Rationale:** with an HTTPS URL the type is both an identifier and a resolvable address. Even a [[t:verifier]] that has
never heard of Tamga can open the URL and see what it is. With a URN, resolution would require knowing a Tamga-specific
service — which makes opening up beyond the network harder.

## Decision 2 — The schema document is off-chain, as Type Metadata + JSON Schema

An **SD-JWT VC Type Metadata** document is published at every `vct` address. The schema points, through the Type
Metadata's `schema_uri` parameter, to a **JSON Schema 2020-12** document.

How it is served: static files behind a CDN, immutable URLs. The schema server is not an application server; it makes no
database queries and produces no dynamic content.

**Rationale:** recorded in [[PM-SCHEMA-0001]] option B — writing schemas to the ledger is costly, puts immutability in the
wrong place, multiplies with multilingual content and makes schema reads depend on an RPC node. Reading schemas is the
most frequent operation in the network; serving them from a CDN is the right architecture.

## Decision 3 — `vct#integrity` is mandatory

Every Tamga credential carries a `vct#integrity` claim next to the `vct` claim. A conforming Tamga verifier **does not
use** Type Metadata without an integrity value.

**Rationale:** the natural price of decision 2 is that the schema document sits on an HTTP server. If that server is
compromised, the schema can be changed silently — for example, the meaning of the `eqf_level` field could be shifted.
Because `vct#integrity` is carried inside the credential's signature, it closes this attack: when signing the document the
issuer cryptographically fixes which schema it meant.

It also enables **indefinite caching**: since the integrity value uniquely identifies the document's content, the cache
is keyed by it and can be used independently of HTTP cache directives. The wallet's ability to work offline rests on this
property.

## Decision 4 — The `SchemaRegistry` contract holds only an anchor

The record written to the ledger:

```
schemaId      = keccak256(vctURI)
vctURI        string
contentHash   bytes32     // hash of the Type Metadata document
version       string      // semver
tier          {NETWORK, NATIONAL}
stateCode     bytes2      // owning state if NATIONAL, 0x0000 if NETWORK
status        {ACTIVE, DEPRECATED, REVOKED}
validFrom     uint64
supersededBy  bytes32     // points to the new version (optional)
```

The schema **content** is not on the ledger. `contentHash` binds the same document as `vct#integrity`.

**Rationale:** the ledger's job is to hold references and authority, not to store content — the [[PM-TRUST-0001]]
principle for personal data, applied to large and changing content as well.

## Decision 5 — Two-tier schema space: NETWORK and NATIONAL

| Tier | URL pattern | Who registers | Governance |
|---|---|---|---|
| **NETWORK** | `/v1/<domain>/<Type>/<ver>` | The network | 2/3 vote ([[ADR-0002]] layer 1) |
| **NATIONAL** | `/v1/<country>/<domain>/<Type>/<ver>` | A single state | `onlyOwnerState`, no vote |

Principle: **schemas that must carry meaning across borders are NETWORK; those specific to national law are NATIONAL.**

A state registers its NATIONAL schema without asking anyone, and no one can block it. Nor is another state's verifier
obliged to recognise that schema — the schema-layer counterpart of cross-recognition.

**Rationale:** resolves the tension between the [[ADR-0002]] sovereignty principle and network effects. Putting every
schema to a vote violates sovereignty; putting none to a vote brings fragmented meaning back at state scale.

## Decision 6 — Issuer ↔ schema authorisation is on the ledger and a mandatory verification step

`IssuerRegistry` holds, for every issuer, the set of permitted `schemaId`s.

A new normative step is added to the verifier's validation chain:

> **Step N:** is the `schemaId` derived from the credential's `vct` in the issuer's set of permitted schemas? If not, the
> credential is **rejected.**

This step cannot be skipped. [[PM-SCHEMA-0001]] weakness 1 (category overreach) is closed exactly by this step: a
university in the `EDUCATION` category is not authorised for a health schema, so even if it signs such a document no
conforming verifier accepts it.

**Who authorises:** the state that registered the issuer also grants its schema authorisations (`onlyOwnerState`). In
phase 0 the foundation performs this role.

## Decision 7 — Versioning: semver, immutable URLs, `extends`

- The version is **semver** and **part of the URL**. Once `1.0.0` is published, the content at that URL **never changes.**
- **MAJOR** — breaking change (removing a field, changing a type, adding a mandatory field) → new URL, new `schemaId`,
  new ledger record.
- **MINOR** — backward-compatible addition (optional field, new language) → new URL; the old one stays `ACTIVE`, not
  `DEPRECATED`.
- **PATCH** — description/text correction only, meaning unchanged → new URL; the old version remains valid.
- The type hierarchy is built with **`extends`**; `extends#integrity` is mandatory. Example: `DiplomaCredential` →
  `extends` → `TamgaBaseCredential` (common fields: `iss`, `vct`, `cnf`, `status`, language-tagging rule).

**Critical consequence — old documents live on.** A diploma issued in 2027 under `1.0.0` must still be verifiable when
`2.0.0` is published in 2031. A diploma lives longer than a schema version. `DEPRECATED` therefore means "can no longer be
**issued**", not "can no longer be **verified**". `REVOKED` is the exceptional case where the schema is faulty or
dangerous, and documents issued under it are handled separately.

---

# Rationale (summary)

The decision line rests on three principles:

1. **Follow the standard, do not invent.** SD-JWT VC Type Metadata + JSON Schema 2020-12 + the registry route is the
   structure the standard itself foresees.
2. **The ledger holds references, not content.** An extended application of [[PM-TRUST-0001]].
3. **Sovereignty at code level.** [[ADR-0002]] carried to the schema layer — the NETWORK/NATIONAL split and
   `onlyOwnerState`.

---

# Alternatives considered

| Alternative | Why rejected |
|---|---|
| No schema registry, free `vct` | Weaknesses 1-2-3 stay open; the verifier side collapses |
| The whole schema on the ledger | Cost, immutability in the wrong place, multilingualism, loss of CDN |
| Connecting to the EBSI Trusted Schemas Registry | Conflicts with the [[ADR-0002]] sovereignty principle |
| `vct` = URN + a dedicated resolver | Makes opening up beyond the network harder |
| Keeping the version outside the URL (`?v=`) | Breaks immutable caching and integrity |

Detailed rationale is in [[PM-SCHEMA-0001]].

---

# Consequences

## Binding (constraints on the implementation)

1. `contracts/src/schema/SchemaRegistry.sol` **will be written.**
2. A **permitted schema set** field and an `isAuthorizedForSchema(issuerId, schemaId)` query will be added to
   `IssuerRegistry.sol`.
   > **2026-09-09 review note:** this query is for **issuance**. Verification uses the time-dependent
   > `isCredentialSchemaAcceptable(issuerId, schemaId, iat)` — otherwise old documents issued under a `DEPRECATED` schema
   > would be rejected, violating decision 7's principle "old documents live on". See [[SPEC-BC-0001]] §3.4.
3. The canonical `SchemaRegistry` interface will be defined in the rewrite of [[SPEC-BC-0001]].
4. The **schema authorisation step** will enter the verifier's validation algorithm normatively ([[SPEC-API-0001]]).
5. All Tamga credentials will carry `vct` **and** `vct#integrity` — [[SPEC-CRED-0002]] will make it a mandatory field.
6. `schema.tamga.network` is an operated component; it enters the [[ARCH-0004]] server inventory (static + CDN, separate
   uptime target).
7. The `@tamga-network/schemas` package will carry the schemas and the validator ([[ARCH-0005]]).

## Operational

- Adding a new NETWORK schema requires a 2/3 vote — slow, and accepted. In phase 0 the foundation runs it alone.
- An outage of the schema server **does not stop verification** (a schema cached with integrity can be used), but it
  stops **learning new types**. The SLO is set accordingly.

## Accepted risks

- **Rigidity.** When an institution asks for a custom field we cannot answer immediately; `extends` reduces the pain but
  does not remove it.
- **Domain dependency.** Losing the `schema.tamga.network` domain would be an ecosystem-wide event. Domain management,
  DNSSEC and a hand-over plan must be addressed in [[ARCH-0004]].

---

# Relations

**Builds on:** [[PM-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[ADR-0002]] · [[ADR-0006]] · [[PM-TRUST-0001]]
**Implemented by:** [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-SCHEMA-0003]]
**Affects:** [[SPEC-BC-0001]] · [[SPEC-CRED-0002]] · [[SPEC-API-0001]] · [[ARCH-0004]] · [[ARCH-0005]]
**Sibling decision:** [[ADR-0008]] (status list placement — the same "off-chain content + on-chain anchor" pattern)

---

# Status

**Accepted** ✅ — 2026-09-09. Recorded in [[DECISIONS]] as `D-SCHEMA-1`.
