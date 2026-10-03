---
document_id: ADR-0010
title: "Credential type identifier (URN)"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-02
summary: >
  D-SCHEMA-1 ("vct is a stable HTTPS URL") is superseded: the credential type identifier becomes a URN of the form
  urn:tamga:<domain>:<Type>:<major>; Type Metadata is resolved from the Tamga catalogue (metadata_url + content_hash) via
  the IETF SD-JWT VC §5.3.2 "registry" route; vct#integrity stays mandatory (ETSI TS 119 472-1 EAA-5.2.1.2-03);
  schemaId = keccak256(vct) is unchanged. Rationale: in a multi-state ecosystem the type identifier cannot depend on a
  foundation's domain name; EUDI's PID convention (urn:eudi:pid:1 + catalogue) is the same pattern. Relying on ETSI
  119 472-1 allowing a context-specific EAA category signal, Tamga also defines its own category URNs
  (urn:tamga:eaa:pub, urn:tamga:eaa:qualified); I1–I2 issuers carry no category; holder LoA never enters a credential
  (PR7 kept).
domain: Credentials
translation_of: ADR-0010
source_version: 1.0.0
---

# ADR-0010 — Type identifier URN and EAA category signal

**Status: Accepted ✅** (2026-09-24).
On acceptance, [[DECISIONS]] D-SCHEMA-1 → **D-SCHEMA-4** (superseded) and a new **D-CRED-4** (category signal).

---

# Context

## The existing decision and why it was reopened

[[ADR-0007]] decision 1 / [[DECISIONS]] D-SCHEMA-1: `vct` ([[t:vct]]) is a stable HTTPS URL
(`https://schema.tamga.network/v1/edu/DiplomaCredential/1.0.0`), Type Metadata is fetched directly from that URL, and
`vct#integrity` is mandatory and equal to the `contentHash` on the ledger.

A check against the primary texts on 2026-09-23/24 showed:

| Source | What it says |
|---|---|
| IETF draft-ietf-oauth-sd-jwt-vc-**19** §2.2.2.1 | `vct` is a **collision-resistant name**: an HTTPS URL **or** a URN (example `urn:example:eudi:pid:…`) |
| same, §5.3 | Type Metadata can be obtained (1) from the URL, (2) **from a trusted registry**, (3) by an ecosystem-defined method, (4) from a cache |
| ETSI TS 119 472-1 V1.2.1 EAA-5.2.1.2-02/03 | `vct` must **point to** Type Metadata; `vct#integrity` is **mandatory** |
| ARF PID Rulebook v2.4.0 | PID type `urn:eudi:pid:1`; domestic `urn:eudi:pid:<cc>:1`; metadata **in the catalogue** (PID_15) |
| ARF Attestation Rulebook template | `vct` must be unique in the ecosystem; no format imposed |
| ETSI TS 119 472-1 §4.2.2 | The EAA category is a class signal "**in the context** of issuance"; the EU URNs (`urn:etsi:esi:eaa:eu:qualified` / `…:pub`) are for the EU; "an EAA **may contain** a category" |

So the existing HTTPS decision **conforms** to the standard; so would a URN. The choice is not technical but
**governance-related**. Direction from project management (2026-09-24): the beta is set up as if it already worked with the
Organization of Turkic States. That settles the open question: the credential type identifier of a multi-state consortium
cannot depend on a foundation's domain name (`tamga.network`). The [[SPEC-SCHEMA-0001]] §10.3 section on "domain risk" had
already recorded this dependency as an "ecosystem-wide event".

## Second topic: how is the issuer class visible in a credential?

Under [[t:eIDAS]], [[t:QEAA]] and [[t:PuB-EAA]] carry a category signal **inside** the [[t:credential]] (Annex V/VII "an
indication suitable for automated processing"); non-qualified EU [[t:EAA|EAAs]] do not. In Tamga's canonical model the
[[t:issuer]] grade (I1–I3) is kept only in the registry; there is no class signal in the credential. In the multi-state
set-up the Tamga ecosystem should **mirror** the eIDAS structure: a document issued by a state institution or on behalf of
an authentic source and a document from an institution accredited under the Trust Framework must be distinguishable for
the [[t:verifier]] from inside the credential. [[t:holder|Holder]] [[t:LoA]], by contrast (PR7), **does not enter** the
credential — nor does it in eIDAS.

---

# Decision

## Decision 1 — `vct` is a URN

```
urn:tamga:<domain>:<Type>:<major>
  domain ∈ {core, edu, org, health, mobility, travel, trade, …}   (SPEC-SCHEMA-0001 §1.2 domain list)
  Type   = PascalCase type name (DiplomaCredential, StudentCredential, TamgaBaseCredential)
  major  = integer; increases on breaking changes

Examples:
  urn:tamga:core:TamgaBaseCredential:1
  urn:tamga:edu:StudentCredential:1
  urn:tamga:edu:DiplomaCredential:1
Phase 1, state-specific (domestic) types:
  urn:tamga:<cc>:<domain>:<Type>:<major>        e.g. urn:tamga:tr:edu:TranscriptCredential:1
Category signals (decision 5):
  urn:tamga:eaa:pub · urn:tamga:eaa:qualified
```

`schemaId = keccak256(bytes(vct))` **does not change** ([[SPEC-SCHEMA-0001]] §5.1).

## Decision 2 — Type Metadata resolution route = catalogue (registry)

The IETF §5.3.2 "trusted registry" route is primary. The record (ledger `SchemaRegistry` / phase B `lotl › schemas[]`)
holds for every type: `vct`, `metadata_url`, `content_hash`, `status`, `status_history`. Verifier/wallet:

```
Ş1. read vct + vct#integrity (missing → REJECT)
Ş2. schemaId = keccak256(vct); is there a record, and its status (ACTIVE/DEPRECATED by iat)
Ş3. Type Metadata: cache(vct#integrity) → GET record.metadata_url → (fallback) catalogue bundle
Ş4. SHA-256(bytes) == vct#integrity == record.content_hash; document.vct == credential.vct
Ş5–Ş7 unchanged (extends, JSON Schema, authorisation)
```

`schema.tamga.network` is no longer the type **identifier** but the **catalogue and hosting** address; if the domain
changes only the `metadata_url`s change, while `vct`s and issued documents are unaffected. The catalogue is also the
counterpart of the ARF "Catalogue of attestation schemes"; the bundle (`catalogue.jws`) serves the wallet's bulk fetch
(CMP8/WL9).

## Decision 3 — `vct#integrity` stays mandatory; D1/D2 are reworded

[[SPEC-SCHEMA-0001]]/D1 "the content at a published `vct` URL never changes" → "the content at a published `metadata_url`
never changes"; D2 "`contentHash` = `vct#integrity` = SHA-256(published bytes)" unchanged; D3 unchanged. `vct#integrity` is
**mandatory** in credentials (ETSI 472-1 EAA-5.2.1.2-03; optional in IETF — we stay strict).

## Decision 4 — Versioning

- **major** is in the URN; a breaking change = a new URN = a new `schemaId`; old documents keep being verified with the old
  URN (SC3 DEPRECATED window).
- **minor/patch** are in the Type Metadata `version` field; every publication gets a **new** `metadata_url` +
  `content_hash` (the old URL does not change, per D1); the record marks the "current" one; one URN may have several
  metadata versions, and the `vct#integrity` in the credential pins down which one is meant. The [[SPEC-SCHEMA-0001]] §9
  semver rules are rewritten accordingly.

## Decision 5 — Tamga EAA category signal

In the credential (an SD-JWT VC claim, `sd: never`, not subject to selective disclosure):

| Issuer record `class` | `category` claim | EU counterpart | Who |
|---|---|---|---|
| `PUB` | `urn:tamga:eaa:pub` | PuB-EAA | A member-state institution or on behalf of an authentic source (civil registry, higher-education council, trade registry…) — registered by the state (`onlyOwnerState`) |
| `QUALIFIED` | `urn:tamga:eaa:qualified` | QEAA | An **I3** issuer accredited under the Trust Framework (qualified e-seal/HSM/audit/insurance) |
| `EAA` | **none** | EAA (non-qualified) | I1–I2 issuers |

Rules: (a) an issuer may only use the signal of the `class` in its record; the verifier compares it with the record in
layer C, a mismatch → REJECTED (new step code **C4**, a new code per [[SPEC-API-0001]] AP1); (b) holder assurance (T0–T3)
is **never** written into the credential — PR7 kept, the level is a precondition of the type (DB-6); (c) the EU URNs
(`urn:etsi:esi:eaa:eu:*`) **may not be used** by Tamga issuers (we are outside the EU context); (d) if a state defines its
own qualified class in phase 1, the sub-namespace `urn:tamga:<cc>:eaa:qualified` is opened.

## Decision 6 — Managing the `urn:tamga` namespace

Informal in the beta (like EUDI's `urn:eudi`). In phase 1, a formal IANA URN NID registration (RFC 8141) is Trust Framework
work. Allocation of sub-namespaces (`edu`, `eaa`, `<cc>`) is in the Trust Framework; from phase 0 on, Governance 2/3 on the
ledger.

## Decision 7 — Migration

No credential has been issued yet; **no dual support**. [[SPEC-SCHEMA-0001]], [[SPEC-SCHEMA-0002]] (vct values, Type
Metadata examples), [[SPEC-SCHEMA-0003]] (skeleton vcts), [[SPEC-CRED-0002]] (`category` claim + new C rule),
[[SPEC-API-0001]] (step C4), [[SPEC-PROTO-0001]] (PR2 text "every `vct` in the metadata is registered" unchanged).
`docs/_internal/delivery/04-TRUST-LIST-FORMAT.md` is already in this form.

---

# Rationale

1. **Domain independence = hand-over independence.** This applies the multi-state principle to the type identifier: just
   as `ca_id` and `issuer_id` are independent of the operator, so must `vct` be. An HTTPS vct makes the `tamga.network`
   domain part of the type identifier forever.
2. **The same look as EUDI.** PID `urn:eudi:pid:1` + catalogue; ETSI categories are URNs. For an EUDI verifier,
   `urn:tamga:…` + catalogue is the same processing path as `urn:eudi:…` + catalogue.
3. **No loss of standards conformance.** The IETF §5.3.2 and ETSI 472-1 "point to the metadata" requirement is met through
   the catalogue; mandatory `#integrity` makes us stronger than the ARF catalogue (no hash requirement) (R-13).
4. **The cost is close to zero now.** No code; specification texts only. After code had been written, this change would
   affect every wallet, verifier and issuer.
5. **The category signal mirrors the eIDAS structure** and lets the credential answer the verifier's question "state
   institution, accredited, or registered?"; the cross-check against the record (C4) prevents a fake signal.

---

# Alternatives considered

## A — Stay with HTTPS URLs (D-SCHEMA-1) — rejected (on governance grounds)
Conforms to the standard, self-resolving for an outside verifier (IETF §5.3.1 is in every library), with the §10.3
mitigations in place. But the type identifier stays bound to a domain name, which conflicts with the multi-state
principle. Technically it **was not wrong**; this ADR supersedes it as "not fitting the set-up", not as "faulty".

## B — A `.well-known/vct` route — not applicable
It is not in draft-19 (it was in interim drafts). Defining a non-standard route breaks interoperability.

## C — A DID-based type identifier (`did:…`) — rejected
[[ADR-0004]] superseded the DID entity profile; bringing DIDs back for type identity would be inconsistent.

## D — No category signal (the earlier DB-15) — rejected
It is true that in the EU's eyes we are non-qualified EAA; but ETSI 472-1 allows a context-specific category, and the
multi-state set-up needs its own classes. Leaving it out keeps the PUB/QUALIFIED distinction only in the registry and makes
the credential less self-describing than its EU counterparts.

## E — Putting holder LoA into the credential — rejected (again)
eIDAS does not; PR7 does not; the PM-TRUST-0001 rationale holds. The level is a precondition of the type.

---

# Consequences

## Binding
1. [[DECISIONS]]: D-SCHEMA-1 → the changed-decisions table; new **D-SCHEMA-4** (vct URN + catalogue), **D-CRED-4**
   (category signal, never holder LoA).
2. [[SPEC-SCHEMA-0001]]: §1 "URL scheme" → "URN scheme + catalogue"; §1.4 resolution; §7 Ş3; §9 versioning; D1 reworded;
   `category_allowed` in the `tamga` block.
3. [[SPEC-SCHEMA-0002]], [[SPEC-SCHEMA-0003]]: vct values.
4. [[SPEC-CRED-0002]]: `category` claim (optional, must match the record), new invariant **C18** "`category` is accepted
   only if it equals the `class` in the record; there is no holder assurance claim".
5. [[SPEC-API-0001]]: step **C4** (category ↔ record), `issuer.class` in the result object.
6. [[PM-ASSUR-0001]]: a `class` column in the axis B table; policy example "type × class".
7. Index sync: INVARIANTS D1 text, C18, C4; MASTER_INDEX versions.

## Accepted trade-offs
- A verifier outside Tamga cannot resolve `urn:tamga:…` metadata without knowing the Tamga catalogue (with HTTPS a GET was
  enough). Mitigation: the catalogue URL is announced in the Trust Framework; the SDK carries it by default; EUDI verifiers
  do the same for EU URNs.
- The category claim is one more assertion; without the C4 cross-check it is meaningless (which is why it cannot be
  skipped).

---

# Relations

**Supersedes (in part):** [[ADR-0007]] decision 1 (vct HTTPS URL); D-SCHEMA-1
**Keeps:** [[ADR-0007]] K2–K6 (off-chain metadata + anchor, `#integrity`, two tiers, allow-list)
**Builds on:** [[ADR-0009]] decision 5 (multi-state first) · [[RS-EIDAS-0001]] §4.4/§5.1 · IETF SD-JWT VC-19 · ETSI TS 119 472-1
**Changes:** [[SPEC-SCHEMA-0001]], [[SPEC-SCHEMA-0002]], [[SPEC-SCHEMA-0003]], [[SPEC-CRED-0002]], [[SPEC-API-0001]], [[PM-ASSUR-0001]]
**Analysis source:** `docs/_internal/beta/05-kurallar` R-12, R-15, R-19, R-22; `06-eidas-uyum-mimarisi` §3.2–3.3; `04-karar-onerileri` DB-14, DB-15, DB-6

---

# Status

**Accepted ✅** — 2026-09-24. Recorded in [[DECISIONS]] as D-SCHEMA-4 and D-CRED-4; the follow-up specification updates are
tracked in the DECISIONS §10 list of open commitments.
