---
document_id: GUIDE-0007
title: "Join the network as an institution"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  How an institution joins Tamga Network as an issuer: the application file and the EU common registration data, keys and the
  certificate signing request (CSR), entry into the trust list, credential type authorisation, the first credential and later
  changes to the entry.
translation_of: GUIDE-0007
source_version: 1.0.0
---

# Join the network as an institution

This guide is for institutions that want to issue digital credentials to people (universities, professional bodies, public
bodies, event organisers) and for their technical teams.

**When to read it:**
- Before you apply, if your institution is about to issue credentials for the first time.
- First: the [Issuance](/concepts/issuance) concept. Next: [[GUIDE-0003]] (issuing credentials technically).
- If you are joining as a verifier, read [[GUIDE-0008]] instead.

## How it works

A credential from an institution can only be trusted if the institution is registered in the [[t:trust-list]]. A verifier looks
up the certificate that signed the credential in the list; if the institution is there and is authorised for that credential
type, the credential is accepted. Joining means getting that entry made:

```
Application file + certificate signing request (CSR)
        │
        ▼
Registrar checks it (reports every missing field at once)
        │
        ▼
Root CA signs the institution certificate  ──▶  Institution is added to the list (published within 24 hours)
        │
        ▼
Credential type authorisation  ──▶  First credential
```

Today Tamga is the registrar and the list operator; when the state publishes its own list, the role passes to the state
([[ADR-0035]] PO3). Your private key never leaves you at any step.

## 1. Choose your role and class

| Field | Values | Meaning |
|---|---|---|
| `category` | `EDUCATION`, `HEALTH`, `GOVERNMENT`, `FINANCE`, `LOGISTICS`, `EVENTS`, `IDENTITY`, `OTHER` | The institution's domain |
| `class` | `PUB`, `QUALIFIED`, `EAA` | Public-body credential, qualified credential or ordinary credential ([[t:EAA]]) |
| `assurance` | `I1`, `I2`, `I3` | The institution's assurance level; its basis goes in `assurance_basis` ([[ADR-0005]]) |

Also choose which credential types (`vct`) you will issue: the types are published in the
[schema catalogue](/specifications/schema-catalog). A new type first goes through the [[SPEC-SCHEMA-0001]] process.

## 2. Application file

The application is a JSON file. The EU common registration data set is mandatory ([[ADR-0024]]); if a field is missing, no
entry is made.

```json
{
  "slug": "example-uni",
  "legal_name": "Example University",
  "trade_name": "Example University",
  "category": "EDUCATION",
  "class": "EAA",
  "assurance": "I2",
  "assurance_basis": "Recognised university; identity proofing by presentation of a Tamga Identity Attestation.",
  "cert": "issuer-example-uni",
  "status_cert": "issuer-example-uni-status",
  "vcts": ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  "authentic_source": { "name": "Example University Student Information System", "mode": "REMOTE" },
  "identifiers": [{ "scheme": "TR-VKN", "value": "TR0000000000" }],
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "postal_code": "34000", "country": "TR" },
  "contact": { "support_uri": "https://example.edu.tr/support", "email": "privacy@example.edu.tr" },
  "supervisory_authority": { "name": "Kişisel Verileri Koruma Kurumu (KVKK)", "country": "TR", "info_uri": "https://www.kvkk.gov.tr", "form_uri": "https://www.kvkk.gov.tr" }
}
```

Full sample: `apps/trust-publisher/registry/examples/issuer-application.example.json` in the repository.

- `identifiers`: the official identification number (VKN or MERSİS). The same number goes into access and registration
  certificates ([[ADR-0026]]).
- `authentic_source`: the system the credential data actually comes from, the [[t:authentic-source]] (such as a student
  information system). Tamga keeps no register of people; the data is read from your system at issuance ([[ADR-0020]]).
- `supervisory_authority`: the data protection authority people can complain to, and how to reach it (at least one of a form
  address, e-mail or phone); the wallet shows it on the consent screen.

## 3. Keys and certificate signing request

You generate two key pairs; both are P-256 (ES256) and both stay with you:

| Key | Signs | Name in the application |
|---|---|---|
| Credential key | The credentials you issue | `cert` |
| Status list key | Your [[t:status-list]] | `status_cert` |

Generate a certificate signing request (CSR) for each and send it with the application:

```sh
openssl ecparam -name prime256v1 -genkey -noout -out issuer.key.pem
openssl req -new -key issuer.key.pem -subj "/CN=Example University/O=Example University/C=TR" -out issuer.csr.pem
```

You are expected to keep the key in a hardware security module (HSM) or a cloud key management service (KMS). The registrar
verifies the CSR signature, issues a certificate from the root CA valid for 2 years (at most 3) and sends it to you
([[SPEC-ID-0002]]).

## 4. Entry into the trust list

The registrar checks the application, adds the institution to the list and re-signs the list. The change is live at
`trust.tamga.network` within **24 hours**. Your entry there holds: the `issuer_id` derived from your certificate's fingerprint,
class, assurance level, credential type authorisations, status and status history. Format: [[SPEC-TRUST-0001]].

After registration a [[t:registration-certificate]] (WRPRC) is also generated automatically at every publication; wallets can
check your entry with it too ([[ADR-0026]]).

## 5. Credential type authorisation

Authorisation is granted per credential type. New types can be added later, or a type can be ended. The entry of an ended
authorisation is not deleted, so credentials issued before the end still verify correctly ([[SPEC-API-0001]] C2).

## 6. First credential

There are two ways:

- **Hosted service:** you use the issuance service Tamga runs, with an API key; credentials are still issued in your name and
  signed with your key. Steps: [[GUIDE-0003]].
- **Your own service:** you run an [[t:OpenID4VCI]] service yourself with the `@tamga-network/issuer` package ([[SPEC-PROTO-0001]]).

Before every credential you verify the person's identity at the level the credential type requires: [[SPEC-ID-0003]].

## 7. Changes to the entry

| Status | What happens |
|---|---|
| `ACTIVE` | May issue; its credentials are accepted |
| `SUSPENDED` | Temporarily may not issue; credentials issued while suspended are not accepted, earlier ones are unaffected |
| `RETIRED` | Stopped issuing; credentials issued earlier remain accepted |
| `REVOKED` | Entry closed; if the key was compromised, credentials issued from the stated date (`invalidates_from`) on are dropped. A successor (`successor_id`) may take the institution's place |

By rule, verification looks at the institution's status at the moment the credential was issued, not at its status today
([[SPEC-API-0001]] §1.1). Certificate renewal and key changes: [[SPEC-ID-0002]]. Conformance tests: [[GUIDE-0009]].

## Rules

| Code | What it says |
|---|---|
| [[ADR-0024]] RPR1–RPR3 | No entry is made without complete registration data |
| [[SPEC-ID-0002]] | Credentials are signed only with the registered certificate; the key stays with the institution |
| [[ADR-0020]] | Tamga keeps no register of people; data is read from the authentic source |

All binding rules: [Tamga ARF — Tamga Rulebook, RB-AP](https://arf.tamga.network/rulebook) and the participation
requirements: [Trust Framework](https://arf.tamga.network/trust-framework).
