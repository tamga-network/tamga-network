---
title: "Registration Certificate Policy"
translation_of: FW-POL-0003
source_version: 1.0.0
outline: [2, 3]
---

# Registration Certificate Policy

<div class="arf-meta">

**Document** FW-POL-0003 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-29 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The policy of the registration certificates (WRPRC, ETSI TS 119 475) that the Tamga registrar issues to verifiers and credential
issuers: scope, content and its source, PKI hierarchy and trust anchor, validity, revocation conditions and revocation requests,
the status list, the wallet's checks and the policy identifiers (EU ARF RPRC_01b; TS 119 475 §6). Compiled from ADR-0024,
ADR-0026, ADR-0058 and ADR-0068; it sets no new rule.

## 1. Scope and status

This document is the policy of the issuer of [[t:registration-certificate|registration certificates]] in the Tamga network (the
registrar; today Tamga, provisionally on behalf of the state). ETSI TS 119 475 §6.1.3 requires the policy to be referenced in a
machine-processable and a human-readable form: the machine-processable form is the `policy_id` in every certificate, the
human-readable form is this page (`certificate_policy`). EU ARF RPRC_01b requires a policy stating the conditions of revocation;
they are in §6.

The policy makes no decisions: the rules are compiled from [[ADR-0024]] (registration data), [[ADR-0026]] (registration
certificates), [[ADR-0058]] (access certificate profile) and [[ADR-0068]] (policy and status list). In case of conflict the source
prevails.

## 2. The certificate and its subject

| Topic | Rule |
| --- | --- |
| For whom | One certificate for every verifier intended use (`scope_id`) and every credential issuer in the trust list; legal persons only |
| Format | JWT `rc-wrp+jwt` (JAdES B-B, x5c) and, for proximity, the CBOR form of the same payload `rc-wrp+cwt` (TS 119 475 §5.2) |
| Source of content | Only the entry in the signed trust list; no field or type outside the list enters the certificate ([[ADR-0026]] WRC1) |
| Identity | `sub` = the organisation's EN 319 412-1 semantic identifier (`VATTR-…`, `NTRTR-…`); the same as the `organizationIdentifier` in the access certificate ([[ADR-0058]]) |
| Use | For a verifier `credentials` (format, type, claim paths) and `purpose`; for an issuer `provides_attestations` |
| Without an identification number | No certificate is produced |

## 3. PKI hierarchy and trust anchor

TS 119 475 OVR-6.1.4-02 requires a clear description of the hierarchy.

| Layer | What | Where it is published |
| --- | --- | --- |
| Trust anchor | The signing key of the list of trusted lists (LOTL) | `trust.tamga.network/keys/root-fingerprints.json`, `tamga.network/trust-anchor`, Trust Framework ([[FW-TF-0001]]) |
| Registrar key | Signs the registration certificates **and** the status list; separate from the list signing key ([[ADR-0026]] WRC2) | LOTL `national_lists[].roles.registrar.signing_keys` (fingerprint) |
| Registration certificate | End document; the registrar certificate in x5c | `trust.tamga.network/wrprc/…` (index `wrprc/index.json`) |

The wallet verifies a registration certificate with the registrar key fingerprint it takes from the signed LOTL. The signer of the
status list is the same key (ARF RPACANot_03b).

## 4. Validity

- At most 12 months (TS 119 475 GEN-5.2.4-08), and never beyond the end date of the registration or the intended use
  ([[ADR-0026]] WRC3).
- The certificate is produced again from the registry at every list publication. If the content did not change it counts as the
  same certificate and keeps its place in the status list; if the content changes, a new certificate is issued and the old one is
  revoked (§6).

## 5. Policy identifiers

| Environment | `policy_id` | `certificate_policy` |
| --- | --- | --- |
| Sandbox (test network) | `2.25.220506472418443381081254370400837050484` | this page |
| Real network | PROPOSAL: under the organisation's IANA Private Enterprise Number (PEN); published after approval | this page |

ETSI's EU policy OID `0.4.0.19475.3.1` is not used: it means "issued by an EU registrar under the revised eIDAS Regulation"
([[ADR-0068]] WRS1). The OID does not change when the version of this page changes; if the meaning of the policy changes, a new
OID is assigned.

## 6. Revocation

**Conditions** (TS 119 475 REV-6.2.3.9-04/07; ARF §6.4.3). The registrar revokes the certificate without undue delay:

| Situation | Reason code |
| --- | --- |
| The registration or intended use expired, the intended use was ended | `registration_ended` |
| The registration was suspended or revoked, the entry left the list | `registration_ended` |
| The certificate content no longer matches the registration (the registration changed) | `superseded` |
| A valid revocation request (below) | `manual: <reason>` |

There is no suspension: the certificate of a suspended registration is revoked; when the registration becomes active again, a new
certificate is issued.

**Revocation requests** (REG-6.2.2.3-05/06). Accepted only from the registrar, from the organisation that is the subject of the
certificate (including its authorised representative) or from a competent public authority (e.g. the data protection authority).
The request is authenticated the same way as authority to change the registration (the contact details in the registration, a
qualified electronic signature or a pre-established secure channel). The requester's identity and the authentication record are
kept in the operator's internal records (REG-6.2.2.3-07). The reason is free text (REV-6.2.3.9-06); no person's name is written
in the public changelog.

**Effect.** The revocation is written to the status list in the same publication; the list is re-signed within an hour at most.

## 7. Status list

| Topic | Rule |
| --- | --- |
| Format | IETF Token Status List, `statuslist+jwt` (same format: [[SPEC-CRED-0003]]); `bits` = 1: 0 valid, 1 revoked (REV-6.2.6.2-04) |
| Entry in the certificate | `status.status_list` = `{idx, uri}` (GEN-6.2.6.1-04) |
| Address | `/status/wrprc/<n>` under the publication root; sandbox `https://trust.sandbox.tamga.network/status/wrprc/1` |
| Signature | the registrar key (§3) |
| Freshness | `ttl` 1 hour, `exp` 24 hours; re-signed every hour |
| Index | random; a revoked index is never reused |
| Access | public, no authentication; the list carries every certificate, so it does not reveal which verifier was looked up |

## 8. The wallet's checks

[[ADR-0068]] K5 and [[SPEC-WALLET-0001]]: the wallet checks the certificate's signature, validity, binding to the access
certificate and revocation status. No data is sent to a request with a revoked certificate, and no credential is requested from an
issuer with a revoked certificate. If the status cannot be checked (no network and no valid copy), the person is warned.

## 9. Decisions and open topics

| Topic | Status |
| --- | --- |
| Policy identifier, document and status list (TS 119 475 Table 7, §6) | **Decision (2026-10-29, [[ADR-0068]]):** in force in the sandbox |
| The real network's policy OID and addresses | Open: name approval and PEN application ([[ADR-0068]] K1) |
| Handing the registrar role to a national authority | Open: on handover the key changes in the LOTL and this policy is replaced by the policy of the receiving authority ([[ADR-0026]] "Consequences") |

## Status

**Active** — version 1.0.0 (29 October 2026).
