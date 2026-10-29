---
title: "Event Ticket Rulebook"
translation_of: FW-RB-0004
source_version: 1.0.0
outline: [2, 3]
---

# Event Ticket Rulebook

<div class="arf-meta">

**Document** FW-RB-0004 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-16 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The rulebook for the event ticket (`urn:tamga:tkt:EventTicket:1`), branching from the Tamga [[t:rulebook|Rulebook]] ([[FW-RB-0001]]),
in the section structure of the EU Attestation Rulebook template: a device-bound credential, single-use at the gate, that carries no
personal data. Attributes and metadata, legal category, SD-JWT VC encoding, who issues it, single use at the gate, verification
policy, trust anchors, validity, [[t:revocation]] and transfer. The sources are ADR-0012, ADR-0014 and the schema catalogue.

| Version | Date | Description |
| --- | --- | --- |
| 1.0.0 | 2026-10-16 | Current text of Tamga ARF 1.0, in the section structure of the EU Attestation Rulebook template (version 1.5). |

**Scheme owner:** Tamga Network (today the provisional operator). **Feedback:** <https://github.com/tamga-network/tamga-network/issues>

## 1. Introduction

### 1.1 Scope and purpose

| Type | `vct` | Catalogue |
| --- | --- | --- |
| Event ticket | `urn:tamga:tkt:EventTicket:1` | `schemas.tamga.network/v1/tkt/EventTicket/1.0.0` |

**Purpose:** the ticket seller or organiser issues the ticket into the wallet, and the gate lets the ticket through once without
knowing the person. The ticket **carries no personal data**: it shows the ticket, not the person; it is bound to a device key
(`cnf`) and has no identity attributes. If identity is needed at the gate (for example a named ticket), that is a separate
presentation (the identity credential, Identity Rulebook). In EU terms the ticket is a non-qualified **[[t:EAA]]**.

### 1.2 Document structure

Chapter 2 attributes and metadata; Chapter 3 encoding; Chapter 4 usage, issuance and single use at the gate; Chapter 5 trust
anchors; Chapter 6 validity, revocation and transfer; Chapter 7 EU compliance.

### 1.3 Key words

**MUST**, **MUST NOT**, **SHOULD** and **MAY** have the meaning of RFC 2119 (Tamga Rulebook §0).

### 1.4 Terminology

Terms are in Annex D; EU terms have the meaning of ARF Annex 1.

## 2. Attributes and metadata

### 2.0 EU requirements and where they are met

| Requirement | Where |
| --- | --- |
| Indication that it is an EAA (ARB_12) | §2.1 |
| Identity of the issuer, Annex V b (ARB_15) | `iss`, the `x5c` leaf certificate; also `organizer_name` |
| Identity of the subject, Annex V c (ARB_17) | Deliberately absent: the ticket binds the device, not the person ([[ADR-0014]]); if the person is needed, the identity credential is requested separately |
| Start and end of validity, Annex V e (ARB_19) | `iat`, `exp` (§6.1); the event time is `event_start`, `event_end` |
| Location of the trust anchor, Annex V h (ARB_21) | No separate attribute in the credential; the location is the issuer's certificate chain and the Tamga trust lists (§5) |

### 2.1 Introduction and legal category

The attributes describe the event, the venue and the ticket class; the seller's ticket number is carried only as a digest.
**Legal category (`category`):** the issuer **MUST** write `urn:tamga:eaa:qualified` or `urn:tamga:eaa:pub` only if its registered
class is qualified or public, and with the registered value; at I1–I2 it **MUST NOT** (RB-AP-14). In a non-qualified EAA the absence
is the indication that follows the ETSI TS 119 472-1 rule (`category` by the EU template's name; in the ARF text its earlier name is
`attestation_legal_category`, ARB_25).

### 2.2 Mandatory attributes

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `event_id` | Event code | text (1–64) | `KONSER-2026-11-21` |
| `event_name` | Event name | text (1–200) | `Kış Konseri` |
| `event_start`, `event_end` | Start and end | date-time (RFC 3339) | `2026-11-21T19:00:00+03:00` |
| `venue_name` | Venue | text (1–200) | `Kültür Merkezi` |
| `organizer_name` | Organiser | text (1–200) | `Örnek Etkinlik A.Ş.` |
| `ticket_class` | Ticket class (e.g. STANDARD, VIP, STUDENT) | text (1–64) | `STANDARD` |
| `ticket_no_hash` | Digest of the seller's ticket number; the seller matches it with its own record | `sha256-…` | `sha256-…` |
| `gate` | The verifier from which the gate pass is obtained: `verifier_client_id`, `terminal_group`, optional `policy_id` | object | `{"verifier_client_id":"x509_hash:…","terminal_group":"ana-giris"}` |

### 2.3 Optional attributes

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `seat` | Seat | text (≤ 32) | `B-14` |

### 2.4 Conditional attributes

None.

### 2.5 Mandatory metadata

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `iss` | The issuer's address | URI | `https://issuer.tamga.network/ornek-bilet` |
| `vct`, `vct#integrity` | Type and the digest of the type definition | URN, `sha256-…` | `urn:tamga:tkt:EventTicket:1` |
| `iat`, `exp` | Time of issuance and end of validity | NumericDate | — |
| `cnf` | The wallet's device key | JWK | — |
| `status` | Reference to the list for revocation and the "used" bit | object | `{"status_list":{"idx":701,"uri":"https://status.tamga.network/c41f9a07"}}` |

### 2.6 Optional metadata

None.

### 2.7 Conditional metadata

| Data identifier | Condition | Data type |
| --- | --- | --- |
| `category` | Only for an issuer whose registered class is qualified or public (§2.1) | `urn:tamga:eaa:qualified` \| `urn:tamga:eaa:pub` |

## 3. Encoding

### 3.1 ISO/IEC 18013-5 (mdoc)

**Proximity analysis (ARB_02).** Offline verification is needed at the gate; it is provided not by the ticket but by a 60-second
signed access token that contains no personal data ([[ADR-0012]]; §4.3): the terminal verifies the token offline. For this reason the
ticket is not issued as an mdoc.

### 3.2 SD-JWT VC

The ticket is issued as an [[t:SD-JWT-VC]] following the SD-JWT VC profile of HAIP 1.0 (ARB_01b): `alg` ES256, `typ` `dc+sd-jwt`,
`x5c`, `vct#integrity` mandatory. All claim names are Tamga-specific names (ARB_06b). The "Selective disclosure" column is the `sd`
value in the Type Metadata (ARB_30).

| Data identifier | Claim name | Encoding | Note | Selective disclosure |
| --- | --- | --- | --- | --- |
| `event_id`, `event_name`, `venue_name`, `organizer_name`, `ticket_class`, `seat`, `ticket_no_hash` | same | string | Tamga-specific | MUST |
| `event_start`, `event_end` | same | string (RFC 3339 date-time) | Tamga-specific | MUST |
| `gate` | `gate` | object | Tamga-specific; not personal data | MUST NOT |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status`, `category` | same | — | transport profile | MUST NOT |

**Example (JWT claim set, with disclosures resolved):**

```json
{
  "iss": "https://issuer.tamga.network/ornek-bilet",
  "vct": "urn:tamga:tkt:EventTicket:1",
  "vct#integrity": "sha256-…",
  "iat": 1792000000,
  "exp": 1795390800,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 701, "uri": "https://status.tamga.network/c41f9a07" } },
  "gate": { "verifier_client_id": "x509_hash:…", "terminal_group": "ana-giris" },
  "event_id": "KONSER-2026-11-21",
  "event_name": "Kış Konseri",
  "event_start": "2026-11-21T19:00:00+03:00",
  "event_end": "2026-11-21T22:00:00+03:00",
  "venue_name": "Kültür Merkezi",
  "organizer_name": "Örnek Etkinlik A.Ş.",
  "ticket_class": "STANDARD",
  "seat": "B-14",
  "ticket_no_hash": "sha256-…"
}
```

### 3.3 W3C VCDM

Not used.

## 4. Usage

### 4.1 Use cases

Passing the gate and showing the ticket class. **Requesting a PID (ARB_27):** not needed; the gate does not ask for the person's
name, date of birth or contact details. For a named ticket, identity is a separate presentation. Transactional data (ARF Topic 20)
is not defined.

### 4.2 Issuance policy: who issues

| Requirement | Value |
| --- | --- |
| Issuer | Ticket seller or organiser (e.g. a ticketing platform) |
| Category | `EVENTS` |
| Minimum accreditation | I2 |
| Credential type authorisation | An allow-list entry for this `vct` |
| Identity proofing | Not required (T0) — the ticket is bound to a device, not a person |
| Wallet | Before issuance the WIA and KA are verified against the `wallet_providers[]` list (RB-AP-10) |
| Embedded disclosure policy | Published in the signed issuer metadata if the institution wishes ([[ADR-0046]], RB-AP-26) |

Note: the `EventTicket:1` type definition (an immutable file) gives the [[t:issuer]] category as `OTHER`; registrations are in the
`EVENTS` category under [[ADR-0014]]. The correction in the definition comes with `EventTicket:2` (a published file does not change,
RB-SCH-02).

### 4.3 Single use at the gate

1. **Registration:** the person presents the ticket once to the gate's verifier (`gate.verifier_client_id`, [[t:OpenID4VP]]); the
   [[t:verifier]] returns an access grant (`pass_grant`).
2. **Gate:** the wallet shows a 60-second signed access token **that contains no personal data** as a QR code; the terminal can
   verify it offline.
3. **Single passage:** on passage the bit in the status list is set to "used"; because the status list is published at a fixed
   interval, the gates of the same terminal group keep a **shared "used" list** and that list stops a second passage within the
   interval.
4. Because the organiser is both issuer and verifier, unlinkability is meaningless for this type; this is an accepted situation.
5. A terminal is defined only under a registered verifier (`terminal_groups[]`) and authenticates to the verification service
   with the terminal key issued for that terminal group; a request without a key does not touch the token ([[ADR-0065]] TK1).
   In the signed list the group carries the institution that operates the gates (`institution_id`) and the accepted pass
   policies (`allowed_policies`); a gate whose group leaves the list, or whose list is stale, is refused ([[ADR-0069]] TG1–TG3).
6. The gate pass does not ask for a PIN at each presentation: this rests on a **time-limited, scoped** consent given by the person;
   the consent can be withdrawn at any time and every presentation is logged in the wallet (Annex A §3.7; wallet rules
   [[SPEC-WALLET-0001]]).

### 4.4 Verification policy (the verifier's obligations)

| Policy | Required |
| --- | --- |
| `event-ticket` (reference) | `vct = EventTicket:1`; issuer in the `EVENTS` category and authorised for this type, at least I2; not revoked and not used; the requested attributes are only `event_id` and `ticket_class` |

Verification goes through the canonical pipeline (RB-RP-03). The result is three-valued; `INDETERMINATE` is not a pass.

### 4.5 Device binding

The ticket is **device-bound** (ARB_34; `cnf`). `cryptographically_bound_to` is not used.

## 5. Trust anchors

For a non-qualified EAA the trust anchor is taken from Tamga's signed trust lists (ARB_26): the verifier fetches the list of lists
(`https://trust.tamga.network/lotl.jws`) and the national list (`tl-tr.jws`) in advance and verifies them against the root
certificates (root fingerprints at `tamga.network/trust-anchor`, RB-OP-06); the credential's `x5c` chain chains to the national root
and `issuer_id` is the fingerprint of the leaf certificate; the `tl-tr › issuers[]` entry gives the category (`EVENTS`), the class and
the authorisation for this type; the type is verified with `lotl › schemas[]` and `vct#integrity`. The gate terminal loads the lists
and its own verifier's key in advance.

## 6. Validity, revocation and transfer

### 6.1 Validity policy

`exp` = end of the event + 1 day; at most 400 days (sales one year in advance). Copies: **one copy per seat**.

### 6.2 Revocation

| Topic | Rule |
| --- | --- |
| Revocable | **Yes, mandatory** — Token Status List (the EU's Attestation Status List): revocation **and** the "used" bit at the gate |
| Revocation conditions | Refund, cancellation of the event, erroneous sale, transfer (§6.3) — details in [[FW-POL-0001]] §3 |
| List address (ARB_24a) | `status.status_list.uri` in the credential; under `https://status.tamga.network/` on the network-hosted service, on the seller's status server for a seller that runs its own service; the address is opaque |
| Publication | At a fixed interval, even without changes (RB-AP-17) |

### 6.3 Transfer

A ticket is **not transferred**; a transfer is the seller revoking the old ticket and issuing it again to the new device.

## 7. Compliance

- This rulebook follows the section structure of the EU Attestation Rulebook template (1.5) (ARB_29); the Topic 12 mapping is in
  Tamga Rulebook §11.
- The ticket inherits all rules of the Tamga Rulebook.
- **Known differences:** the identity of the subject (ARB_17, SHOULD) is deliberately absent; there is no trust anchor location
  attribute in the credential and none is added ([[ADR-0047]] K7); a non-qualified EAA carries no `category`, ETSI is followed
  ([[ADR-0047]] K6); instead of ETSI's `oneTime` constraint, single use at the gate is
  provided by the "used" bit.

## 8. References

The EU Attestation Rulebook template, ARF Annex 2 Topics 7 and 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, IETF Token Status List.
The Tamga decisions and specifications this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (16 October 2026).
