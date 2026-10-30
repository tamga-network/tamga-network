---
document_id: ADR-0070
title: "Provisional operator chain: until the foundation is established, the network's own services are run by a provisional operator on behalf of Tamga Network"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  Tamga Network has no legal personality. Until the non-profit foundation to be established acquires one, the network's own
  services (list publication, the identity service, Tamga Verify, the websites) are operated on behalf of Tamga Network by the
  provisional operator BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ; every registration, certificate and contract that needs
  a legal person is made in its name with the words "on behalf of Tamga Network". The list operator and scheme owner name stays
  "Tamga Network". The provisional operator's name, identifier and address come from a single configuration value that the list
  publisher checks at every publication. The handover uses the existing handover tool and runbook; until the foundation exists,
  participation agreements are signed by the provisional operator. Accepted: 2026-10-30.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0024]]", "[[ADR-0033]]", "[[ADR-0037]]", "[[ADR-0042]]", "[[ADR-0058]]", "[[ADR-0066]]", "[[FW-TF-0001]]", "[[FW-RB-0001]]"]
translation_of: ADR-0070
source_version: 1.0.0
---

# In short

Tamga Network will become a foundation, but the foundation has not been established yet. Until then a company runs the network's
own services on the network's behalf and provisionally: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ. The trust lists still
name "Tamga Network" as their operator; the company's name appears only where a legal person is needed (tax number, certificates,
contracts, personal data registration). This information is kept in one place and changed in one step when the foundation exists.

# Context

- [[ADR-0009]] K5 and D-GOV-5: lists carry `operator {name, status: provisional, on_behalf_of}`; a handover changes only the
  operator field. [[ADR-0037]]: the network is only a network and sells no services; [[ADR-0042]]: the network runs no wallet.
- The network has no legal personality. Registration data ([[ADR-0024]]), the `organizationIdentifier` of issuer and access
  certificates ([[ADR-0058]]), the data controller registration under the Turkish data protection law (KVKK), domain names and
  participation agreements need a legal person. These places had been filled one by one (the identity service and Tamga Verify
  records, the framework documents, the privacy notices); there was no written decision and no single source. The pending record
  of the app-store review signer ([[ADR-0033]]) was incomplete for this reason.
- Direction of project management: the network will be a non-profit foundation entirely separate from the operating company; until
  the foundation exists, the operator chain is fixed in writing and is the same everywhere.

# Decision

## K1 — The chain
Tamga Network (foundation to be established) ← provisional operator **BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ** (tax
number 1870632151; Harbiye Mah. Bostan Sk. No: 15 İç Kapı No: 5, Şişli / İstanbul). The provisional operator runs the network's own
services (list publication, the registrar role on behalf of the state, the identity service, Tamga Verify, the websites and the
domain names) on behalf of Tamga Network. Every act that needs a legal person (registration identifier, certificate subject, KVKK
registration, domain name, contract) is made in its name with the words "on behalf of Tamga Network".

## K2 — Names
The list operator (`operator.name` of the LOTL and the national lists, `SchemeOperatorName` of the ETSI XML and LoTE views) and the
scheme owner name stay **"Tamga Network"** (`status: provisional`, `on_behalf_of`). The provisional operator's name appears only in
the records of the network's own services (`operator` block, `identifiers`, `postal_address`), in their certificates and in
documents that need a legal person. Other products of the provisional operator (for example a wallet the network lists) are a
separate participant and gain no privilege ([[ADR-0037]], [[ADR-0042]]).

## K3 — One value
The provisional operator's name, the body it acts for, its identifier and address are a single configuration value
(`apps/trust-publisher/registry/provisional-operator.json`). The list publisher checks before every publication: every own record
whose identifier note says "provisional operator" carries exactly this value, and the list operator name is "Tamga Network"; any
difference stops the publication. The JSON lists and the XML and LoTE views ([[ADR-0066]]) are produced from these records;
certificate subjects and contract templates use the same value.

## K4 — Handover
When the foundation acquires legal personality, the handover uses the operator's existing handover tool (dry run) and runbook: the
value, the records and certificates that depend on it are renewed with the foundation's name and number ([[ADR-0058]] K5). The list
operator name, `ca_id`, `vct` and the institutions' permanent identifiers do not change.

## K5 — Contracts
Until the foundation exists, the participation agreement, the hosting annex and the data processing agreement are signed by the
provisional operator on behalf of Tamga Network; the agreements carry a succession clause: once the foundation exists, rights and
obligations pass to it ([[FW-TF-0001]] §5.7).

## K6 — Pending records
The record of the app-store review signer ([[ADR-0033]]) and every later own record carry the same value.

# Options considered

| Option | Result | Why |
|---|---|---|
| The company's name as the list operator name | rejected | List and scheme ownership belong to the network; the list identity would change at handover; neutrality of the network |
| Waiting for the foundation for everything that needs a legal person | rejected | The identity service, the verifier record and the app-store review need a legal person today |
| Keeping the values separately in each record (the previous state) | rejected | Scattered; one could be forgotten at handover; cannot be checked |
| **List name "Tamga Network", legal person the provisional operator, one value + publication check** | **chosen** | Handover from a single point; list identity stable; consistency tested at every publication |

# Invariants

| Code | Rule |
|---|---|
| OP1 | The list operator and scheme owner name is "Tamga Network" (`status: provisional` until the foundation exists); the provisional operator's name appears only in the records of the network's own services, in their certificates and in documents that need a legal person. |
| OP2 | The provisional operator's name, identifier and address come from a single configuration value; the list publisher does not publish with an own record that carries different information, or with a list operator name other than "Tamga Network". |
| OP3 | The handover to the foundation changes only this value and the records and certificates that depend on it; the list operator name, `ca_id`, `vct` and the institutions' permanent identifiers do not change. |

# Consequences

- Code: list publisher check `provisional-operator.ts` and `registry/provisional-operator.json`; the pending record of the app-store
  review signer was completed with the same value (registration and publication on the operator's computer).
- Documents: [[FW-TF-0001]], [[FW-RB-0001]] RB-OP-01 and the definitions already describe the same chain; no change was needed.

# Status

**Accepted — 2026-10-30.** With the approval of project management (verbatim quote in the private approval record). DECISIONS:
D-GOV-10. OP1–OP3 are binding.
