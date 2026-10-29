---
title: "Contact Rulebook"
translation_of: FW-RB-0005
source_version: 1.0.0
outline: [2, 3]
---

# Contact Rulebook

<div class="arf-meta">

**Document** FW-RB-0005 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-16 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The rulebook for the two contact credentials issued by the identity service (verified email address
`urn:tamga:contact:EmailAddress:1`, verified phone number `urn:tamga:contact:PhoneNumber:1`), in the section structure of the EU
Attestation Rulebook template: attributes and metadata, legal category, SD-JWT VC encoding, proof of possession, usage, trust anchors,
validity and [[t:revocation]]. It branches from the Tamga [[t:rulebook|Rulebook]] ([[FW-RB-0001]]); the source is ADR-0021.

| Version | Date | Description |
| --- | --- | --- |
| 1.0.0 | 2026-10-16 | Current text of Tamga ARF 1.0, in the section structure of the EU Attestation Rulebook template (version 1.5). |

**Scheme owner:** Tamga Network. Operated provisionally by BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ on behalf of Tamga Network (foundation to be established). **Feedback:** <https://github.com/tamga-network/tamga-network/issues>

## 1. Introduction

### 1.1 Scope and purpose

| Type | `vct` | Catalogue |
| --- | --- | --- |
| Verified email address | `urn:tamga:contact:EmailAddress:1` | `schemas.tamga.network/v1/contact/EmailAddress/1.0.0` |
| Verified phone number | `urn:tamga:contact:PhoneNumber:1` | `schemas.tamga.network/v1/contact/PhoneNumber/1.0.0` |

**Purpose:** instead of verifying a person's email address or phone number each time by sending their own codes, websites and
institutions ask for this credential; the proof is obtained once and kept in the wallet ([[ADR-0021]]). The credential only says "this
address was in the hands of this wallet"; it does not say who the person is. In EU terms both types are non-qualified
**[[t:EAA]]**; eIDAS 2.0 and the EUDI ARF foresee no separate PID attribute or defined type for email or phone.

### 1.2 Document structure

Chapter 2 attributes and metadata; Chapter 3 encoding; Chapter 4 usage and issuance; Chapter 5 trust anchors; Chapter 6 validity
and revocation; Chapter 7 EU compliance.

### 1.3 Key words

**MUST**, **MUST NOT**, **SHOULD** and **MAY** have the meaning of RFC 2119 (Tamga Rulebook §0).

### 1.4 Terminology

Terms are in Annex D; EU terms have the meaning of ARF Annex 1.

## 2. Attributes and metadata

### 2.0 EU requirements and where they are met

| Requirement | Where |
| --- | --- |
| Indication that it is an EAA (ARB_12) | §2.1 — no `category` |
| Identity of the issuer, Annex V b (ARB_15) | `iss` (identity service) and the `x5c` leaf certificate |
| Identity of the subject, Annex V c (ARB_17) | Deliberately absent: the credential carries no identity data (name, national identity number, date of birth) (CT3); its subject is the address or number |
| Start and end of validity, Annex V e (ARB_19) | `iat`, `exp` |
| Location of the trust anchor, Annex V h (ARB_21) | No separate attribute in the credential; the location is the lists in §5 |

### 2.1 Introduction and legal category

Each address or number is a separate credential; a person may add several addresses. **Legal category:** a contact credential
**MUST NOT** carry `category` (CT3; [[ADR-0021]] K4): the credential is not qualified and not a public-body credential. This absence
is the indication that follows the ETSI TS 119 472-1 rule (`category` in the EU template; in the ARF text its earlier name is
`attestation_legal_category`, ARB_25).

### 2.2 Mandatory attributes

| Type | Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- | --- |
| Email | `email` | Email address whose possession was proven, lower-cased | text (email) | `ayse@example.org` |
| Phone | `phone_number` | Phone number whose possession was proven, E.164 | text (`+` and 7–15 digits) | `+905321234567` |

### 2.3 Optional attributes

None.

### 2.4 Conditional attributes

None.

### 2.5 Mandatory metadata

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `iss` | The issuer's address (identity service) | URI | `https://id.tamga.network` |
| `vct`, `vct#integrity` | Type and the digest of the type definition | URN, `sha256-…` | `urn:tamga:contact:EmailAddress:1` |
| `iat`, `exp` | Time of issuance and end of validity (≤ 1 year) | NumericDate | — |
| `cnf` | The wallet's device key | JWK | — |
| `status` | Reference to the status list | object | `{"status_list":{"idx":3307,"uri":"https://status.tamga.network/90ad5e2c"}}` |

### 2.6 Optional metadata

None.

### 2.7 Conditional metadata

None (there is no `category`).

## 3. Encoding

### 3.1 ISO/IEC 18013-5 (mdoc)

**Proximity analysis (ARB_02).** There is no use case for presenting contact details in person without the internet; the credential
is issued only as an SD-JWT VC and has no mdoc representation ([[ADR-0021]] K4).

### 3.2 SD-JWT VC

Following the SD-JWT VC profile of HAIP 1.0 (ARB_01b): `alg` ES256, `typ` `dc+sd-jwt`, `x5c`, `vct#integrity` mandatory. The claim
names are IANA-registered names (ARB_06b, ARB_08).

| Data identifier | Claim name | Encoding | Source | Selective disclosure |
| --- | --- | --- | --- | --- |
| `email` | `email` | string | OpenID Connect Core §5.1 (IANA) | MUST |
| `phone_number` | `phone_number` | string (E.164) | OpenID Connect Core §5.1 (IANA) | MUST |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status` | same | — | transport profile | MUST NOT |

In the EU PID the same data appear under the optional names `email` and `phone_number` (in mdoc `email_address`,
`mobile_phone_number`); Tamga's contact credential is not part of the PID, it is a separate EAA.

**Example (email; JWT claim set, with the disclosure resolved):**

```json
{
  "iss": "https://id.tamga.network",
  "vct": "urn:tamga:contact:EmailAddress:1",
  "vct#integrity": "sha256-…",
  "iat": 1791763200,
  "exp": 1823299200,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 3307, "uri": "https://status.tamga.network/90ad5e2c" } },
  "email": "ayse@example.org"
}
```

### 3.3 W3C VCDM

Not used.

## 4. Usage

### 4.1 Use cases

Registration on a website or updating contact details; the person presenting, themselves, the address at which an institution will
reach them. The address is an identifier across websites; it is disclosed only with the person's approval. **Requesting a PID
(ARB_27):** not needed. Transactional data (ARF Topic 20) is not defined. The verifier applies the canonical pipeline (RB-RP-03); the
result is three-valued.

### 4.2 Issuance policy

| Requirement | Value |
| --- | --- |
| Issuer | Only the Tamga Network identity service (`IDENTITY` · `EAA` · I2) |
| Identity proofing | Not required (T0): the credential only proves possession |
| Proof of possession | A one-time 6-digit code is sent by email or SMS; the credential is issued when the correct code is entered (CT1). The code is valid for 10 minutes, at most 5 attempts; at most 3 sends per flow and at most 5 sends per address per hour; the code is kept in memory only as a digest |
| Flow | Same as the identity credential: [[t:OpenID4VCI]] authorization code + [[t:PAR]] + PKCE + wallet attestations (WIA, KA; RB-AP-10) |
| Data | The address is in memory only for the duration of the flow and is deleted after issuance; the database holds only a keyed digest. The address, number and code are not written to logs and are shown masked on screen (CT2) |
| Sending provider | Chosen by configuration; if none is configured, the type is not announced in the issuer metadata. Test paths are not used in an environment open to real users (CT4) |
| Embedded disclosure policy | Not carried ([[ADR-0046]] K1) |

### 4.3 Device binding

Both types are **device-bound** (ARB_34; `cnf`). `cryptographically_bound_to` is not used.

## 5. Trust anchors

For a non-qualified EAA the trust anchor is taken from Tamga's signed trust lists (ARB_26): the list of lists
(`https://trust.tamga.network/lotl.jws`) and the national list (`tl-tr.jws`) are verified against the root certificates (root
fingerprints at `tamga.network/trust-anchor`, RB-OP-06); the credential's `x5c` chain chains to the national root; the
`tl-tr › issuers[]` entry gives the identity service's authorisation for these two types; the type is verified with
`lotl › schemas[]` and `vct#integrity`.

## 6. Validity and revocation

### 6.1 Validity policy

`exp` = time of issuance + 365 days. Because numbers and addresses can pass to someone else, validity is at most one year; the proof
shows possession only at the time of issuance.

### 6.2 Revocation

| Topic | Rule |
| --- | --- |
| Revocable | **Yes, mandatory** — Token Status List (the EU's Attestation Status List) |
| Revocation conditions | The old credential when the same address is proven again; the person's deletion request (all credentials obtained from the identity service); withdrawal of consent (RB-AP-21) — details in [[FW-POL-0001]] §3 |
| List address (ARB_24a) | `status.status_list.uri` in the credential; the identity service's lists are under `https://status.tamga.network/`; the address is opaque |
| Publication | At a fixed interval (today 2 minutes), even without changes (RB-AP-17) |

## 7. Compliance

- This rulebook follows the section structure of the EU Attestation Rulebook template (1.5) (ARB_29); the Topic 12 mapping is in
  Tamga Rulebook §11.
- Both types inherit all rules of the Tamga Rulebook; the type-specific invariants are [[ADR-0021]] CT1–CT4.
- **Known differences:** the identity of the subject (ARB_17, SHOULD) is deliberately absent; there is no trust anchor location
  attribute in the credential and none is added ([[ADR-0047]] K7); a non-qualified EAA carries no `category`, ETSI is followed
  ([[ADR-0047]] K6).

## 8. References

The EU Attestation Rulebook template, ARF Annex 2 Topics 7 and 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, OpenID Connect Core 1.0,
IETF Token Status List. The Tamga decisions and specifications this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (16 October 2026).
