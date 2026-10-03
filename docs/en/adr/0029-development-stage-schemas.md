---
document_id: ADR-0029
title: "Schemas in the development stage"
status: Active
version: 1.0.0
created: 2026-09-30
last_updated: 2026-10-02
summary: >
  Until the beta release, credential schemas are corrected in place: a wrong or incomplete schema is updated under the same version
  path, test credentials become invalid and are obtained again. The immutability of published schemas (SPEC-SCHEMA-0001/D1) and the
  minor-version rule ([[ADR-0010]] K4) take effect with the beta. Controlled by a single setting, `SCHEMA_STAGE`.
domain: Credentials
translation_of: ADR-0029
source_version: 1.0.0
---

# Context

Under [[ADR-0010]] and SPEC-SCHEMA-0001/D1 a published schema file never changes. A change requires a new version path;
[[t:credential]]s issued earlier keep being verified against their own version. This rule is right once real users hold
credentials.

Tamga is in its development stage today:

- No real person uses the app or the site.
- States are not formally part of the system; in the EU this structure is mandatory for member states, in Türkiye not yet.
- Schemas will change until they are right (e.g. fields added to match the EU education catalogue).

At this stage carrying version migrations creates work and confusion. Project management asked for wrong schemas to be corrected
directly, and for the versioning and registration regime to start once a certain maturity (beta) is reached.

# Decision

## K1 — Development stage

While `SCHEMA_STAGE = "development"` (`packages/schemas`):

- A schema definition is corrected under the same version path (e.g. `1.0.0`). The compiler overwrites the changed file and prints
  a warning.
- No new version path is opened. The [[t:trust-list]] holds a single valid digest per type.
- Test credentials issued with an earlier digest are rejected in verification and obtained again.
- Breaking changes (field name, meaning) may also be made in place. The [[t:vct]] URN changes only if the type truly becomes
  something else.

## K2 — Switching with the beta

At the beta release `SCHEMA_STAGE = "stable"` is set. From then on:

- SPEC-SCHEMA-0001/D1 (a published schema does not change),
- the minor-version rule ([[ADR-0010]] K4: same `vct`, new metadata version, earlier digests stay valid; `content_hashes` in the
  trust list — the reading side is ready).

The stage change is recorded in STATUS and DECISIONS.

# Invariants

| Code | Rule |
|---|---|
| DS1 | `SCHEMA_STAGE = "development"` is used only while no credential is issued to a real user; it is set to `stable` before the first real institution's or person's credential. |

# Status

**Accepted — 2026-09-30.** Approved by project management. DECISIONS: D-SCHEMA-5.
