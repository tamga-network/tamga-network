---
document_id: ADR-0024
title: "Participant registration data"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  The relying party (RP) and issuer entries in the trust list carry the EU common registration data set (CIR 2025/848
  Annex I, as amended by CIR 2026/1730; EU technical specifications TS5/TS6): legal and trade name, official identifier,
  address, contact, service description, a purpose + privacy policy for each use, a public-sector flag, entitlement type,
  intermediary relationships and the data protection authority. The wallet shows them on the consent screen; the erasure
  request and complaint flows rely on them.
domain: Trust
translation_of: ADR-0024
source_version: 1.0.0
---

# Context

Today's [[t:verifier]] entry carries only:
- `client_id`,
- legal name,
- access certificate fingerprint,
- usage scopes (purpose + requested claims).

The EU gap analysis (2026-09-29) found this incomplete. In the EU every verifier reports a common data set to the national
registrar (CIR 2025/848 Annex I; TS6 v1.2.2). The wallet must show a link to the privacy policy on the consent screen
(RPA_10). The user's erasure request (TS7) and complaint to the data protection authority (TS8) also rely on the contact
details in this entry.

Project management approved collecting in Tamga the same information that is collected in the EU.

# Decision

## K1 — Verifier entry: the EU common data set

The `relying_parties[]` entry in the [[t:trust-list]] carries the following fields. The names correspond to the TS5
`WalletRelyingParty` class.

| TS6 | Field | Tamga | Mandatory |
|---|---|---|---|
| 1 | Legal name | `legal_name` | yes |
| 2 | Trade name (shown to the user) | `trade_name` | yes |
| 3, 6 | Official identifier | `identifiers[]` (`{scheme, value}`; Türkiye: `TR-VKN` tax number, `TR-MERSIS`; country-prefixed) | yes |
| 4 | Address | `postal_address` | yes |
| 5 | Website | `info_uri` | no |
| 7 | Contact | `contact` {`support_uri`, `email`, `phone`}; at least one, `support_uri` recommended | yes |
| 8 | Service description | `service_description` (multilingual) | yes |
| 9 | Requested data | `scopes[].vct` + `scopes[].claims` (exists today) | yes |
| 10 | Purpose | `scopes[].purpose` + `purpose_localized` (exists today) | yes |
| — | Privacy policy (for each use) | `scopes[].privacy_policy_uri` | yes |
| 11 | Public-sector body | `is_public_sector_body` | yes |
| 12–13 | Entitlement type | `entitlements[]` (`service_provider`, `non_q_eaa_provider`, `pub_eaa_provider`, …; mapped to ETSI TS 119 475 URIs) | yes |
| 14–16 | Intermediary relationship | `uses_intermediaries[]` (RP) / `served_relying_parties[]` (intermediary); [[ADR-0017]] | conditional |
| — | Data protection authority | `supervisory_authority` {`name`, `country`, `email` / `phone` / `form_uri`}; Türkiye: the KVKK Authority | yes |

## K2 — Issuers carry the same identity and contact fields

The `issuers[]` entry carries: `trade_name`, `identifiers[]`, `postal_address`, `info_uri`, `contact`,
`supervisory_authority`. For an [[t:issuer]], `entitlements` is written automatically: class EAA → `non_q_eaa_provider`,
PUB → `pub_eaa_provider`. These fields are the source of the address and contact information in ETSI TS 119 602
([[t:LoTE]]) lists.

## K3 — Wallet

- The consent screen shows the trade name, the purpose and the **privacy policy link** (RPA_06, RPA_10).
- The contact and data protection authority details in the entry feed the erasure request (TS7) and complaint (TS8) flows.

## K4 — Personal data

The trust list is public. Verifier and issuer entries are therefore only for **organisations** (legal persons). Registering
a natural person as a verifier is not supported in the pilot. Contact details are organisational (support page,
organisational e-mail/phone); no personal names are written.

## K5 — Transition

- The new fields are added to the list format as **optional**; existing entries do not break.
- The publisher requires the mandatory K1/K2 fields for every new or updated entry. All entries are completed before the
  pilot.
- The registration certificate ([[t:WRPRC]], `verifier_info`) and the registration API (TS5) are the next step.

# Options considered

| Option | Result | Why |
|---|---|---|
| Today's narrow entry | rejected | No privacy policy, contact or data protection authority; RPA_10, TS7 and TS8 cannot be met |
| EU field names verbatim (camelCase) | rejected | Tamga lists use snake_case; the TS5 mapping is documented in a table, and EU names are used on export |
| **The EU data set, with Tamga names** | **accepted** | Same content; LoTE and, later, TS5 API export through the mapping |

# Invariants

| Code | Rule |
|---|---|
| RPR1 | Every new or updated verifier entry carries a privacy policy link for each usage scope and at least one contact channel. |
| RPR2 | Verifier and issuer entries are only for organisations; an entry contains no personal name or personal contact details. |
| RPR3 | Every verifier entry names the competent data protection authority and how to reach it. |

# Consequences

- `@tamga-network/trust` schema: new fields (optional). Trust publisher: mandatory-field check for new/updated entries.
- `apps/trust-publisher/registry`: existing entries (the Tamga verification service, institutions) are completed. The
  institutions' official details are obtained from the institutions.
- Wallet consent screen: trade name + privacy policy link.
- LoTE (SPEC-ID-0002 §8.1.1): issuer address and contact from these fields.
- The participation rules of [[SPEC-TRUST-0001]] and [[FW-TF-0001]] are updated.

# Status

**Accepted — 2026-09-29.** With project management approval. DECISIONS: D-REG-1. Implementation queued.
