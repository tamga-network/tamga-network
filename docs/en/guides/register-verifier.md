---
document_id: GUIDE-0008
title: "Register as a verifier"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Registering a site or service as a verifier in the Tamga trust list: domain name and access certificate, the EU common
  registration data, intended uses (purpose, fields, privacy policy), the registration certificate, intermediaries and
  pseudonyms.
translation_of: GUIDE-0008
source_version: 1.0.0
---

# Register as a verifier

This guide is for sites and services that will ask people's wallets for credentials (shops, employers, institution portals,
event gates).

**When to read it:**
- Before you send your first presentation request. Every field an unregistered verifier asks for is shown to the person with a
  separate "outside the registered scope" warning, and a pseudonym request is not accepted at all.
- Next: [[GUIDE-0001]] (sign in with Tamga) or [[GUIDE-0002]] (verifying on the server).
- If you want to issue credentials, read [[GUIDE-0007]] instead.

## How it works

When a request arrives, the wallet checks three things in the [[t:trust-list]]: who is sending the request, whether this
verifier is registered and active, and whether the requested fields are inside the registered scope. If a field outside the
scope is requested, the person sees a separate warning. Registering means having the answers to these three questions written
into the list.

| What | Value | Where from |
|---|---|---|
| Permanent identity | your domain name (`dns_name`) | your application |
| Client identifier (`client_id`) | `x509_hash:…` | computed from your access certificate ([[ADR-0034]]) |
| Access certificate | X.509, with your domain name and organisation identifier | the registrar, from your CSR |
| Scopes | for each intended use: purpose, credential type, fields | your application |
| Registration certificate | one `rc-wrp+jwt` per intended use | generated automatically at publication ([[ADR-0026]]) |

## 1. Key and certificate signing request

Generate the P-256 key you will sign requests with yourself; the private key stays with you.

```sh
openssl ecparam -name prime256v1 -genkey -noout -out rp.key.pem
openssl req -new -key rp.key.pem -subj "/CN=shop.example.com/O=Example Shop Ltd./C=TR" -out rp.csr.pem
```

The registrar writes your domain name (SAN) and your organisation identifier (`organizationIdentifier`, for example `VATTR-…`)
into the access certificate. The wallet checks that the identifier in the registration certificate matches this one.

## 2. Application file

```json
{
  "dns_name": "shop.example.com",
  "legal_name": "Example Shop Ltd.",
  "trade_name": "Example Shop",
  "access_cert": "rp-example-shop",
  "info_uri": "https://shop.example.com",
  "service_description": { "en-US": "Online shop offering student discounts.", "tr-TR": "Öğrenci indirimi sunan çevrim içi mağaza." },
  "is_public_sector_body": false,
  "entitlements": ["service_provider"],
  "scopes": [
    {
      "scope_id": "student-discount-1",
      "purpose": "Student discount",
      "purpose_localized": { "tr-TR": "Öğrenci indirimi" },
      "vct": "urn:tamga:edu:StudentCredential:1",
      "claims": ["is_enrolled"],
      "privacy_policy_uri": "https://shop.example.com/privacy"
    }
  ],
  "identifiers": [{ "scheme": "TR-VKN", "value": "TR0000000000" }],
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "postal_code": "34000", "country": "TR" },
  "contact": { "support_uri": "https://shop.example.com/help" },
  "supervisory_authority": { "name": "Kişisel Verileri Koruma Kurumu (KVKK)", "country": "TR", "info_uri": "https://www.kvkk.gov.tr", "form_uri": "https://www.kvkk.gov.tr" }
}
```

Full sample: `apps/trust-publisher/registry/examples/rp-application.example.json` in the repository.

**Mandatory fields** ([[ADR-0024]]): trade name, official identification number, postal address, contact (support address,
e-mail or phone), service description, whether you are a public body, entitlement type (`entitlements`), the data protection
authority and how to reach it, and a privacy policy address for each scope. If a field is missing, no entry is made; the
registrar reports all the gaps at once.

## 3. Keep the scope narrow

Each scope (`scopes[]`) is one intended use: one purpose, one credential type and the fewest fields that purpose needs. The shop
in the sample asks whether the person is a student (`is_enrolled`); it does not ask for the name, the school or the number.

- Open a separate scope for each separate purpose; write the purpose in language the person understands (`purpose_localized`).
- Some types are never presented (for example the pseudonym seed, `urn:tamga:id:PseudonymSeed:1`); they cannot be put in a scope.
- An age check with a zero-knowledge proof uses the identity credential's short-lived ZK copy; the scope's type is
  `urn:tamga:id:ShortLivedIdentityAttestation:1` and its attribute is `age_over_18` ([[ADR-0044]]).
- A scope can be time-limited (`valid_from`, `valid_until`); no registration certificate is generated for an expired use.

## 4. Registration certificate

Every time the list is published, a [[t:registration-certificate]] (WRPRC, ETSI TS 119 475) is generated for each valid scope
and published under `trust.tamga.network/wrprc/` (index: `wrprc/index.json`). Its content comes only from your entry in the
signed list; it is signed with a separate registrar key and is valid for at most 12 months.

You send this certificate in your presentation request inside `verifier_info` (`registration_cert`). The wallet checks the
signature, the validity period, the identifier match and that the requested fields fit the scope in the certificate
([[ADR-0026]]).

## 5. Intermediaries

If you verify on behalf of other sites (such as a hosted verifier), you register as an [[t:intermediary]]
(`served_relying_parties[]`), and the actual site lists you in its own entry (`uses_intermediaries[]`). The wallet shows the
**actual site's** name and checks the scope against its entry ([[ADR-0017]]).

## 6. Pseudonyms (optional)

If you want to recognise a person without learning who they are (for example a returning customer), you can ask for a
site-specific pseudonym. In your entry the `pseudonyms` field is `single` (one pseudonym per person) or `multiple` (several if
the person wants) ([[ADR-0031]]).

## 7. After registration

| Status | What happens |
|---|---|
| `ACTIVE` | Your requests are accepted |
| `SUSPENDED` | The wallet does not treat your entry as active and shows this clearly to the person |
| `REVOKED` / `RETIRED` | Entry closed; the wallet does not treat your entry as active |

Adding or changing a scope is a new application; changes are live within 24 hours. You can read your own entry in code:
`source.relyingPartyByDnsName("shop.example.com")` ([[GUIDE-0006]]).

## Rules

| Code | What it says |
|---|---|
| [[ADR-0024]] RPR1–RPR3 | No entry without complete registration data; every intended use has a privacy policy |
| [[ADR-0026]] | The registration certificate is generated only from the entry in the signed list; at most 12 months |
| [[ADR-0034]] | The client identifier is the `x509_hash` computed from the access certificate; the permanent identity is the domain name |
| [[ADR-0017]] | With an intermediary, the actual site is shown and its scope is checked |

All verifier rules: [Tamga ARF — Tamga Rulebook, RB-RP](https://arf.tamga.network/rulebook).
