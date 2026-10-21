---
document_id: ADR-0058
title: "Access certificate profile (ETSI TS 119 411-8) and timing of the identity service certificate change"
status: Proposed
version: 1.0.0
created: 2026-10-21
last_updated: 2026-10-21
summary: >
  Verifier access certificates (WRPAC) follow ETSI TS 119 411-8 V1.1.1 §6.6.1: the organisation identifier in the subject
  (unchanged), `CN` a trade name or service name the user recognises, and in the SAN a support address (URI; GEN-6.6.1-07
  contact information) next to the registered domain name. For a verifier that receives service-bound access certificates
  the service identifier (`serviceIdentifier`, EU TS5) is in `OU` (GEN-6.6.1-08). The policy identifier and CPS address
  (GEN-6.6.1-03/06) are added when the network's certification practice statement is published. The identity service's
  credential signing certificate gets its `organizationIdentifier` (ADR-0050 K3) not now but with a new key when operation of
  the network is handed over to the foundation, so identity credentials are re-obtained once. Proposal — awaiting project
  management approval.
domain: Identity
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0034]]", "[[ADR-0050]]", "[[SPEC-ID-0002]]"]
translation_of: ADR-0058
source_version: 1.0.0
---

# Context

- **EU rule (access certificate).** ETSI TS 119 411-8 V1.1.1 (2025-10) is the policy for relying party access certificates;
  CIR 2025/848 Annex IV and CIR 2026/1730 refer to it. For certificates issued to legal persons (§6.6.1):
  - GEN-6.1.1-04: `CN` **may** be a trade name or service name recognisable to the user;
  - GEN-6.6.1-05: `organizationIdentifier` is **required** (EN 319 412-1 §5.1.4);
  - GEN-6.6.1-07: contact information of the relying party in the SAN is **required** — at least one of: a support website (URI),
    a phone number (`otherName`, `id-at-telephoneNumber`) or an email address (`rfc822Name`);
  - GEN-6.6.1-08: additional certificates for different instances of the same organisation may be distinguished by `OU`;
  - GEN-6.6.1-03 / -06: a policy identifier (ETSI `NCP-l-eudiwrp` = 0.4.0.194118.1.2 or the provider's OID) and a CPS address.
- **EU TS5 (registration data).** `serviceIdentifier` is optional; it is required for a relying party that uses an intermediary.
  A relying party with a single service, or with no need for service-bound access certificates, may omit it.
- **Today.** The Tamga access certificate carries `CN` (the domain name), `O`, `C` and, on the production network,
  `organizationIdentifier` ([[ADR-0026]] K3) in the subject; the SAN holds only the registered domain name (`dNSName`,
  [[ADR-0034]]). **There is no contact information** (GEN-6.6.1-07 not met), no policy identifier and no CPS address. The service
  identifier is in the registration certificate (`service_id`), not in the access certificate. The first EU alignment review
  (2026-10-13, recommendation 10) recorded this as "no service identifier in the access certificate".
- **Identity service certificate.** [[ADR-0050]] K3: once the organisation identifier is in the registry, the identity service
  gets a new key and a certificate with `organizationIdentifier`. The number entered the registry on 2026-10-19, but it is the
  **provisional operator's** number; when operation of the network is handed over to the foundation the number changes again. When
  the identity service's key changes, every identity credential must be re-obtained under the new key (the credential's signer
  changes). Doing it today would make people re-obtain their identity credentials twice.

# Decision

## K1 — Access certificate subject
- `organizationIdentifier` and `C` are required (unchanged, [[ADR-0026]] K3); `O` is the organisation's legal name.
- `CN`: a trade name or service name the user recognises (the registered `trade_name` or the service's name). Writing the domain
  name into `CN` is no longer needed; the permanent identity is the domain name in the SAN ([[ADR-0034]]).

## K2 — SAN: domain name + contact
- The SAN carries the registered domain name (`dNSName`, [[ADR-0034]] CI3) and **at least one contact item**. In Tamga this is the
  registered support address (`support_uri`, [[ADR-0024]]), written as `uniformResourceIdentifier`. A phone number or email address
  may be added; no personal email or personal phone number is written.
- The value is derived from the registration data (GEN-6.6.1-10); on the production network no access certificate is issued when
  the registration has no support address.

## K3 — Service-bound access certificates
- If a verifier asks for separate access certificates for separately operated services of the same organisation, each certificate
  carries the service identifier in `OU` (GEN-6.6.1-08). The value is the registered service identifier (the same as `service_id`
  in the registration certificate). These are separate `relying_parties[]` entries in the trusted list, each with its own domain
  name.
- A verifier that runs several intended uses (scopes) under one access certificate (like the network's own verifiers) writes no
  `OU`; the service identifier travels per request in the registration certificate ([[ADR-0026]] K4).

## K4 — Policy identifier and CPS (deferred)
- ETSI's `NCP-l-eudiwrp` identifier is **not** written into the access certificate: it states that an EU trust service provider
  issued the certificate under an ETSI EN 319 411-1 audit; Tamga cannot state that.
- The network's own policy identifier and CPS address are added when the network's certification practice statement is published
  (with the foundation).

## K5 — Timing of the identity service certificate change (timing of [[ADR-0050]] K3)
- The identity service's credential and status list signing certificates get `organizationIdentifier` **when operation of the
  network is handed over to the foundation**: new key (`issuer-id-2` and `-status`), the foundation's organisation identifier, new
  `issuer_id`; the old certificate stays in the list during the overlap only to verify old credentials ([[ADR-0050]] K3,
  [[SPEC-ID-0002]] §4).
- Until then the publisher warning (ADR-0050 K4) remains; registration certificate (WRPRC) generation is not affected.
- If an earlier change becomes necessary (key compromise, certificate expiry, a formal request from the EU side), it is done that
  day with the same procedure and the provisional operator's number.

# Options considered

| Option | Result | Why |
|---|---|---|
| Make the service identifier mandatory in every access certificate | rejected | Optional in TS5; for a verifier running many uses under one certificate the service identifier is in the per-request registration certificate |
| Carry the service identifier in a new X.509 extension | rejected | No extension is defined in the EU; 411-8 points to `OU` |
| Write `NCP-l-eudiwrp` | rejected | It is the statement of an audited EU trust service provider |
| Change the identity service key today | rejected | The number is the provisional operator's; it changes again at handover, people would re-obtain their identity twice |

# Invariants

| Code | Rule |
|---|---|
| AC1 | On the production network the access certificate's SAN carries the registered domain name and at least one contact item (support address). |
| AC2 | In a service-bound access certificate the service identifier is in `OU` and equals the registered service identifier. |
| AC3 | An access certificate carries no EU certificate policy identifier that Tamga cannot state. |

# Implementation

- `ops/pki-issue.ts`: `--contact-uri <address>` (SAN `uniformResourceIdentifier`) and `--service-id <id>` (`OU`). While this
  decision is a proposal, a `--prod` access certificate without `--contact-uri` produces a warning; after acceptance it becomes
  required (AC1).
- After acceptance: the access certificates of the production and sandbox verifiers are re-issued **with the same key** (`CN` trade
  name, SAN support address). Because the certificate changes, `client_id` (`x509_hash`) changes; the registry is updated, the list
  is published and deployed. First, the wallet's pseudonym site key must be `dns_name` as [[ADR-0031]] K2 says (today
  `client_id`; [[SPEC-WALLET-0001]] §5.4.1 deviation note) — otherwise the pseudonyms at those sites change.
- Trust list publisher (next release): check for SAN contact information in access certificates (AC1) and `OU` ↔ registered service
  identifier (AC2).
- K5: added to the foundation handover work list (operator procedure in `ops/README.md`).

# Questions for project management

1. K1–K3 (access certificate profile) and, after acceptance, re-issuing the network's verifier certificates with the same key.
2. K4: not writing the EU policy identifier; the network's own identifier comes with the foundation.
3. K5: changing the identity service certificate at the foundation handover.

# Status

**Proposal — 2026-10-21.** Awaiting project management approval. Tool support (`--contact-uri`, `--service-id`) is ready and
optional; existing certificates are unchanged.
