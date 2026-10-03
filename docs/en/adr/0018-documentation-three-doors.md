---
document_id: ADR-0018
title: "Three doors to the documentation"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  External documentation is published, as in the EU, through three separate doors: the general overview
  (tamga.network/docs), the developer documentation (docs.tamga.network) and Tamga ARF (arf.tamga.network — the
  architecture and reference framework with its annexes). Tamga ARF is published in English and Turkish; the Turkish text
  remains the source, the English text is the official translation of the same version, and version drift is caught at
  build time. Changes the publication line of D-GOV-6.
domain: Governance
translation_of: ADR-0018
source_version: 1.0.0
---

# Context

D-GOV-6 (2026-09-24) defined the framework document set (Tamga ARF, [[t:trust-framework|Trust Framework]],
[[t:rulebook|Rulebook]], [[t:attestation]] rulebooks) and set `docs.tamga.network` as its place of publication. The situation
today:

- `tamga.network/docs` mixes the general overview with developer pages (integration, code).
- `docs.tamga.network` presents everything together: framework documents, guides, specifications, ADRs, internal work
  records (delivery, phase B analysis). For a regulator or an institution the [[t:ARF]] gets lost in the crowd.
- In the EU the same need is met by three separate places: the citizen/institution overview (the Commission's site), the
  developer hub and the **ARF** (separate, version-numbered, published in English; annexes: high-level requirements,
  attestation rulebooks).

Request from project management (2026-09-27): split the documentation as in the EU — general documentation, developer
documentation and an ARF.

# Decision

## K1 — Three doors

| Door | Address | Reader | Content |
|---|---|---|---|
| **General** | `tamga.network/docs` (tamga-web, three languages) | institution, decision maker, citizen | concepts, e-identity and eIDAS, Tamga Wallet, how it works, scenarios, glossary |
| **Developer** | `docs.tamga.network` (VitePress, `tamga-network/docs`) | developer, integrator | guides, code examples, packages, specifications, ADRs, records |
| **Tamga ARF** | `arf.tamga.network` (VitePress, `tamga-network/arf`) | regulator, institution, auditor | main document (FW-ARF-0001) + Annex A Trust Framework + Annex B participant rules + Annex C attestation rulebooks |

Each door links visibly to the other two. The **single public home** of the framework documents is `arf.tamga.network`;
`docs.tamga.network` does not republish them, it links `[[FW-*]]` references to the ARF site.

## K2 — Name and domain

The public name is **"Tamga ARF"** (Architecture and Reference Framework / Mimari ve Referans Çerçevesi). New subdomain
`arf.tamga.network` (static; added to the D-NAME-1 service list as a document publication, not a network service).

## K3 — Language and source

- Tamga ARF is published in **English + Turkish**; the root page is English (`/`), Turkish is under `/tr/`.
- **The source is Turkish:** `docs/framework/*.md` (DOC-ID references, MASTER_INDEX and the approval process live there).
  The Turkish pages are generated from these files at build time.
- The English `arf/*.md` is translated by hand; each file carries `translation_of` and `source_version`. If the source
  version is raised and the translation is not updated, the build stops (`npm run arf:check`, CI).
- In a conflict the Turkish source prevails; this is reconsidered when a state or council takes over the document
  ([[FW-TF-0001]] §7).

## K4 — Versions

Tamga ARF carries a **release number** (e.g. "Tamga ARF 1.0"); each document's own version is also shown. The release
number is raised whenever any document in the set gets a MINOR or MAJOR increase; the version history is public on the ARF
site.

# Options considered

| Option | Pro | Con | Result |
|---|---|---|---|
| Everything under `tamga.network` (`/docs`, `/developers`, `/arf`) | one site, no new domain | the ARF looks like part of a promotional site; two different publishing tools on one site | rejected |
| Separate addresses, a new domain for developers too | cleanest split | two new domains; `docs.tamga.network` links break | rejected |
| **Separate addresses; developers stay on `docs.`, ARF on `arf.`** | closest to the EU layout; the ARF looks like an official document; existing links are kept | one new subdomain | **chosen** |
| ARF in Turkish only | fast | international readers (EU, OTS states) read English | rejected |
| ARF in three languages (EN/TR/TK) | same as the rest of the site | the most work; the Turkmen text needs separate review | later |

# Consequences

- `tamga-network/arf/` (VitePress, two languages) + `scripts/arf-sync.mjs` (generation from the Turkish source, `--check`
  version check).
- `docs.tamga.network` is reorganised as developer documentation; its framework section links to the ARF.
- `tamga-web`: the menu and footer show the three doors; `/docs` stays as the general overview.
- `ops` (operator repository): the nginx `arf.tamga.network` block, build + publish in `deploy.sh`; DNS record (operator).
- The "Publication" line of D-GOV-6 is linked to this ADR (DECISIONS "Changed decisions").
- K4 implementation: releases are listed in `arf/releases.json`; each release is frozen under `arf/archive/<release>/`
  (`npm run arf:snapshot`) and stays readable at `/v<release>/`; the site has a version menu ("latest" label) and a page of
  line differences between releases (`/changes`). `arf:check` also checks consistency between the release record, the
  document versions and the archive.

# Invariants

| Code | Rule |
|---|---|
| DY1 | The only public place of publication for framework documents (FW-*) is the Tamga ARF site; other sites do not publish a copy, they link to it. |
| DY2 | The English translation of Tamga ARF carries the same version as the Turkish source; nothing is published while the versions differ. |
| DY3 | Tamga ARF pages do not link to private repository paths, conversations or tenant data. |

# Status

**Accepted — 2026-09-27.** Chosen: separate addresses, English + Turkish ARF, the name "Tamga ARF". DECISIONS: D-DOCS-1.

**Note (2026-10-02):** the general door moved to `tamga.network/learn` ("Learn": a learning path from zero to Tamga Network). The decision is unchanged; only the address changed.
