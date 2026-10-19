---
document_id: GUIDE-0007
title: "Join the network as an institution"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-20
summary: >
  How an institution joins Tamga Network as an issuer, from first contact to live, step by step: the sandbox trial, the
  application file and the EU common registration data (checklist), keys and the certificate signing request (CSR), the
  institution's lookup endpoint, entry into the trust list and credential type authorisation, the Institution Console account,
  the first credential, revocation and later changes to the entry.
translation_of: GUIDE-0007
source_version: 1.0.0
---

# Join the network as an institution

This guide is for institutions that want to issue digital credentials to people (universities, professional bodies, public
bodies, event organisers) and for their technical teams. The examples follow a university issuing student certificates and
diplomas.

**When to read it:**
- Before you apply, if your institution is about to issue credentials for the first time.
- First: the [Issuance](/concepts/issuance) concept. Next: [[GUIDE-0003]] (issuing credentials technically).
- If you are joining as a verifier (a site, hotel or employer asking for credentials), read [[GUIDE-0008]] instead.

## How it works

A credential from an institution can only be trusted if the institution is registered in the [[t:trust-list]]. A verifier looks
up the certificate that signed the credential in the list; if the institution is there and is authorised for that credential
type, the credential is accepted. Joining means getting that entry made and starting to issue. Today Tamga is the registrar and
the list operator; when the state publishes its own list, the role passes to the state ([[ADR-0035]] PO3). Your private key never
leaves you at any step.

## Step by step: from first contact to live

| # | Step | Who | Where | Details |
|---|---|---|---|---|
| 0 | Try it in the sandbox | The institution's team | sandbox.tamga.network → "Try your institution" | §1 |
| 1 | Prepare the application file and documents | Legal, student affairs, IT | the checklist below | §2 |
| 2 | Generate the keys, send the certificate signing requests (CSR) | IT / security | the institution's HSM or remote signing service | §3 |
| 3 | Set up the lookup endpoint | IT | in front of the student information system | §4 |
| 4 | Review, certificates, entry into the list | Registrar | trust.tamga.network (within 24 hours) | §5 |
| 5 | Institution Console account | The institution's administrator | invitation link + passkey | §6 |
| 6 | First credential | Student affairs | Institution Console → Issue, or the API | §7 |
| 7 | Revocation, suspension, changes, exit | Student affairs / registrar | Institution Console → Credentials | §8 |

## 1. Try it in the sandbox (no application needed)

`sandbox.tamga.network` is the network's separate test network: it has its own test root and lists marked as test lists; its
credentials are not valid anywhere ([[GUIDE-0013]]).

1. **Open a test institution** — "Try your institution"; type a made-up name, "(TEST)" is appended. Real institution names and
   official words (such as "University", "Ministry") are refused.
2. **Sign in to the Institution Console** — create a passkey with the single-use invitation link.
3. **Add records** — one by one or by CSV (at most 200 rows), with made-up data only. For a diploma, fill in the graduation
   fields (qualification, EQF level, date) and the programme's 4-digit ISCED-F code.
4. **Issue at the desk** — scan the QR code with a wallet connected to the sandbox and enter the PIN.
5. **Verify** — show the credential to the sample verifiers on the sandbox page ("Student discount", "Diploma check"); revoke it
   in the Console and see the same credential refused after the next publication.

Everything is deleted every night at 03:30 (Türkiye time); a sandbox institution cannot be moved to the production network.

## 2. Application file and checklist

The application is a JSON file. The EU common registration data set is mandatory ([[ADR-0024]]); if a field is missing, no
entry is made and the registrar reports every missing field at once.

**Information the institution provides**

| Information | Field in the application | Note |
|---|---|---|
| Legal name and display name | `legal_name`, `trade_name` | The legal name also goes into the certificate (in Latin letters) |
| Official identification number | `identifiers` | VKN (`TR-VKN`) or MERSİS (`TR-MERSIS`); goes into the certificates and the registration certificate |
| Postal address | `postal_address` | |
| Contact | `contact` | Support address and an e-mail for personal-data requests |
| Data protection authority and how to reach it | `supervisory_authority` | In Türkiye, KVKK; at least one of a form address, e-mail or phone |
| Domain, class, assurance level | `category`, `class`, `assurance`, `assurance_basis` | Table below |
| Credential types | `vcts` | From the [schema catalogue](/specifications/schema-catalog); a new type first goes through [[SPEC-SCHEMA-0001]] |
| Authentic source | `authentic_source` | The name of the system the data comes from; mode `REMOTE` (§4) |
| Additional revocation conditions page (if any) | `revocation_policy_uri` | Optional, https |
| Lookup endpoint address | — (hosted service configuration) | §4 |
| Domain name and privacy policy for identity matching | — (separate entry, §5) | A domain your institution owns; the policy page is shown in the wallet |
| First Institution Console administrator | — | Name and institutional e-mail; the invitation link goes to them |

**Documents required** (by level; [Onboarding](https://arf.tamga.network/onboarding))

| Document | I1 | I2 | I3 |
|---|---|---|---|
| Domain ownership (DNS verification) and contact details | ✓ | ✓ | ✓ |
| EU common registration data (table above) | ✓ | ✓ | ✓ |
| Proof of legal personality (MERSİS and Trade Registry Gazette, or the founding law) and confirmation of the authorised signatory | — | ✓ | ✓ |
| Signed participation agreement and KVKK annexes (a data processing agreement if the hosted service is used) | — | ✓ | ✓ |
| Proof that the keys are in an HSM or that a qualified e-seal is used | — | — | ✓ |

| Field | Values | Meaning |
|---|---|---|
| `category` | `EDUCATION`, `HEALTH`, `GOVERNMENT`, `FINANCE`, `LOGISTICS`, `EVENTS`, `IDENTITY`, `OTHER` | The institution's domain |
| `class` | `PUB`, `QUALIFIED`, `EAA` | Public-body credential, qualified credential or ordinary credential ([[t:EAA]]) |
| `assurance` | `I1`, `I2`, `I3` | The institution's assurance level; its basis goes in `assurance_basis` ([[ADR-0005]]). At least I2 for diplomas |

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

Full sample: `apps/trust-publisher/registry/examples/issuer-application.example.json` in the repository. `slug` is the
institution's permanent short name (the hosted service address is `issuer.tamga.network/<slug>`); it is chosen together with the
registrar, and a name once used is not given out again, even after the entry is closed.

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

The registrar verifies the CSR signature and issues a certificate from the root certificate authority valid for 2 years (at most
3); the certificate subject carries your institution identifier (`organizationIdentifier`, e.g. `VATTR-…`), your legal name and
your country ([[ADR-0050]], [[SPEC-ID-0002]]).

Where the key lives depends on how you issue:

- **Your own issuing service:** the key is in your HSM or cloud key management; you run the service.
- **Hosted service:** the key still stays with you — in your institution's HSM or with the trust service provider you contract.
  The service requests every signature through the remote signing interface (Cloud Signature Consortium API v2) and sends only the
  digest of the data to be signed; no credential content and no personal data. You give the registrar the address of your remote
  signing service and the client identity you grant the service ([[ADR-0057]], proposed). On the production network the
  institution's key is never kept as a file on the hosted service's host.

## 4. Lookup endpoint: the data comes from your system

The [[t:authentic-source]] is your system. Tamga keeps no register of people; at the moment of issuance it asks your system's
**lookup endpoint** with a signed request, takes one record and keeps nothing ([[ADR-0020]]). Contract:
[Institution source endpoint](/api/institution-source).

- The shortest way to start is the open-source example endpoint ([[GUIDE-0004]] §5): it goes in front of your student information
  system, or in front of a regularly refreshed export; it checks the request against the trust list and returns only the fields
  the credential type needs. The national ID number is never returned.
- Every record must carry the programme's **4-digit ISCED-F 2013 code**; without it no credential is issued and no code is guessed
  (education rule E11). A diploma is issued only for records with graduation data (qualification, EQF level, date).
- The endpoint is served over TLS only and accepts only the entry the hosted service uses for your institution as a caller (§5).

## 5. Review and entry into the trust list

The registrar checks the application, issues the certificates, adds the institution to the list and re-signs the list. The
change is live at `trust.tamga.network` within **24 hours**. Your entry there holds: the `issuer_id` derived from your
certificate's fingerprint, class, assurance level, credential type authorisations (one per type), status and status history.
Format: [[SPEC-TRUST-0001]].

If you use the hosted service, the registrar also opens an **identity matching entry** for your institution: when a student asks
for a credential from the wallet, the service's request for their identity attestation and its call to your lookup endpoint are
signed with this entry. It carries your institution's name and identification number, its permanent name is a domain your
institution owns (e.g. `tamga.example.edu.tr`), its purpose and privacy policy address are shown in the wallet; the only fields
requested are the national ID number and the date of birth. Your lookup endpoint recognises this entry's domain name as the
"allowed caller".

At every publication [[t:registration-certificate|registration certificates]] (WRPRC) are also generated for your entries;
wallets check them as well ([[ADR-0026]]).

## 6. Institution Console account

After registration the registrar sends a single-use invitation link to your institution's first administrator. The
administrator opens the link and creates a passkey on their device (there is no password). They then invite other staff from the
Console (as administrator or staff), create API keys ([[ADR-0016]]) and manage sharing rules.

## 7. First credential

- **Institution Console → Issue:** type the student's reference in your system and choose the credential type. If the national ID
  number and date of birth are also typed, the offer is bound to the person's identity: only that person can take the credential,
  their wallet shows the Tamga identity attestation, and no PIN is needed. For a person without an identity attestation a PIN offer
  is created (the PIN is shown on screen, separately from the QR code). The record is read from your lookup endpoint; if it is not
  found or the ISCED-F code is missing, no offer is created and the reason is shown.
- **API:** your student portal or system creates the offer with `@tamga-network/issuer/client` and sends the link through your own
  channel (Tamga never sees the person's contact address). Steps: [[GUIDE-0003]].
- **The student starts:** the student picks your institution in the wallet and shows their identity attestation; the service asks
  your lookup endpoint with `lookup`.

Every credential is issued as a package of 10 copies bound to keys on the person's device. If you run your own issuing service you
do the same steps yourself with the `@tamga-network/issuer` package ([[SPEC-PROTO-0001]]).

## 8. Revocation, suspension and changes to the entry

You revoke a credential (final) or suspend it (only for types that allow suspension, such as the diploma) from the Institution
Console's **Credentials** tab or through the API. The effect comes with the next fixed-interval status list publication; verifiers
refuse the credential from then on.

| Status of the institution's entry | What happens |
|---|---|
| `ACTIVE` | May issue; its credentials are accepted |
| `SUSPENDED` | Temporarily may not issue; credentials issued while suspended are not accepted, earlier ones are unaffected. It becomes active again once the issue is resolved |
| `RETIRED` | Stopped issuing (voluntary exit); credentials issued earlier remain accepted |
| `REVOKED` | Entry closed; if the key was compromised, credentials issued from the stated date (`invalidates_from`) on are dropped. A successor (`successor_id`) may take the institution's place |

A revoked (`REVOKED`) or retired (`RETIRED`) entry is never reactivated; an institution that wants to come back joins with a new
entry. Verification looks at the institution's status at the moment the credential was issued, not at its status today
([[SPEC-API-0001]] §1.1). Certificate renewal and key changes: [[SPEC-ID-0002]]. Conformance tests: [[GUIDE-0009]].

## Rules

| Code | What it says |
|---|---|
| [[ADR-0024]] RPR1–RPR3 | No entry is made without complete registration data |
| [[SPEC-ID-0002]] | Credentials are signed only with the registered certificate; the key stays with the institution |
| [[ADR-0020]] | Tamga keeps no register of people; data is read from the authentic source |
| [[ADR-0050]] | The institution certificate carries the institution identifier, the legal name and the country |

All binding rules: [Tamga ARF — Tamga Rulebook, RB-AP](https://arf.tamga.network/rulebook) and the participation
requirements: [Trust Framework](https://arf.tamga.network/trust-framework).
