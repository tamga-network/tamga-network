---
title: "Revocation Policy"
translation_of: FW-POL-0001
source_version: 1.0.0
outline: [2, 3]
---

# Revocation Policy

<div class="arf-meta">

**Document** FW-POL-0001 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-11 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The policy that brings together in one place under which conditions the credentials issued by the issuers in the Tamga network (the
identity service and institutions) are revoked, who may ask for revocation, suspension, how the status list is published and how
quickly a revocation takes effect (EU ARF VCR_05). It compiles the revocation rules of the credential-type rulebooks and the decisions
they rest on; it sets no new rules. Revocation of wallet attestations (WIA, KA) is in the Wallet Attestation Policy.

## 1. Scope and status

The EU ARF (VCR_05) requires every provider that issues a revocable credential to have a policy stating under which conditions the
credentials it issues are revoked. This document is that policy for all [[t:issuer|issuers]] in the Tamga network: the Tamga Network
identity service and every institution in the trust list. Its scope is the credential types in Annex C (the Education, Identity,
Event Ticket and Contact rulebooks). The conditions for the wallet instance attestation (WIA) and key attestation (KA) issued by
wallet providers are in [[FW-POL-0002]].

The policy makes no decisions: the conditions are compiled from the Tamga Rulebook (Annex B), the rulebooks of the types and the
decisions they rest on; the source is given on each row. In case of conflict the source prevails (RB-ENF-05).

## 2. Which credentials are revocable

| Type | Revocable | Reason |
| --- | --- | --- |
| Tamga identity credential `urn:tamga:id:IdentityAttestation:1` | **Yes** (mandatory) | Valid for at most 2 years; RB-AP-ID-04 |
| ZK copy `urn:tamga:id:ShortLivedIdentityAttestation:1` | No | Valid for at most 24 hours; the short lifetime replaces revocation (ARF VCR_01; [[ADR-0044]]) |
| Pseudonym seed `urn:tamga:id:PseudonymSeed:1` | No | Never presented; renewed together with the identity credential ([[ADR-0031]]) |
| Driving licence information `urn:tamga:id:DrivingLicenceAttestation:1` | **Yes** (mandatory) | [[ADR-0039]] |
| Student certificate `urn:tamga:edu:StudentCredential:1` | No | Valid for at most 90 days; the short lifetime replaces revocation; a credential that has not expired but is no longer correct is an accepted risk ([[FW-RB-0002]] §6) |
| Diploma `urn:tamga:edu:DiplomaCredential:1` | **Yes** (mandatory) | A credential without expiry ([[FW-RB-0002]] §6) |
| Event ticket `urn:tamga:tkt:EventTicket:1` | **Yes** (mandatory) | Revocation and the "used" bit at the gate ([[FW-RB-0004]] §6) |
| Email and phone credentials `urn:tamga:contact:*:1` | **Yes** (mandatory) | [[ADR-0021]] |

The rulebook of a new credential type adds to this table whether the type is revocable and, if so, its conditions (ARF ARB_24).

## 3. Revocation conditions

### 3.1 All revocable types

| Condition | Result | Source |
| --- | --- | --- |
| The person withdraws consent | The credential is revoked | RB-AP-21, RB-H-01 |
| The person objects to the "your credential was added to a wallet" notice | The issuer revokes the credential and re-issues it if needed | RB-AP-15, RB-H-05 |
| The credential was issued in error | It is revoked and the correct one is issued again | The rulebooks of the types |
| A new set of copies of the same type is issued to the same person | The old set is revoked (one active set per person) | RB-AP-ID-05, [[FW-RB-0002]] §4.3 |
| The issuer's signing key is compromised | The issuer is suspended, its certificate is revoked and the affected credentials are revoked in the status list | Annex A §4.6 |
| The embedded disclosure policy of an institution's credential is added, changed or removed | Valid credentials issued with that configuration are revoked | RB-AP-26, [[ADR-0046]] EP4 |

### 3.2 Type-specific conditions

| Type | Conditions | Source |
| --- | --- | --- |
| Identity credential | The person's deletion request; re-verification with the same document (the old one); a report that the document was lost or stolen; an erroneous credential | [[FW-RB-0003]] §6.2, RB-AP-ID-05 |
| Driving licence information | The person's request; a deletion request; re-verification with the same card (the old one); revocation of the wallet unit; revocation, re-issuance or deletion of the linked identity credential (cascading) | RB-AP-ID-10, [[ADR-0039]] |
| Diploma | Revocation of the diploma (forgery, court decision); an erroneous credential; a report of a device compromise | [[FW-RB-0002]] §6.2 |
| Event ticket | Refund; cancellation of the event; erroneous sale; transfer (the old one is revoked and re-issued to the new device); passage at the gate (the "used" bit) | [[FW-RB-0004]] §6 |
| Email and phone credentials | The old credential when the same address is proven again; the person's deletion request | [[ADR-0021]] K3, [[FW-RB-0005]] §6.2 |

**Credentials of the identity service and deletion.** When a person resets the wallet and deletes their data, the wallet sends a
deletion request for every credential obtained from the identity service; the service deletes the record and revokes all copies
([[SPEC-WALLET-0001]] §7.6). When a wallet unit is revoked by the wallet provider, the identity service checks the unit within 24 hours
at the latest and revokes its own credentials on that unit.

### 3.3 Not reasons for revocation

- **Suspension or removal of the issuer** does not invalidate earlier credentials; only new issuance stops. The check is made against
  the time the credential was issued (`iat`) (RB-REG-07, RB-ENF-02, RB-RP-03).
- **Renewal of the issuer's certificate** does not affect earlier credentials; they are verified with the old `issuer_id` entry.
- **A credential type becoming `DEPRECATED`** does not revoke credentials; the type remains verifiable (RB-SCH-06).

## 4. Who asks for revocation and how

| Who | How |
| --- | --- |
| The person (holder) | For credentials of the identity service, through the "Reset the wallet and delete my data" flow in the wallet or the identity service's deletion route; for institutional credentials, through the institution's channel (deletion request, objection). Complaint route: issuer → scheme owner → the Turkish Personal Data Protection Authority (RB-H-07) |
| The issuer | On the basis of its own records; the status list mapping is held only by the issuer (RB-AP-09, RB-AP-22) |
| The scheme owner and operator | Do not revoke credentials; they suspend the issuer or revoke its certificate (Annex A §4.5–§4.6). In an emergency the right tool is not an out-of-interval publication but suspension of the issuer ([[SPEC-CRED-0003]] §5.3) |

## 5. Suspension

The status list carries two bits per credential (`bits = 2`): valid, revoked, suspended. Suspension is used while the issuer
investigates a claim; when the investigation ends it is either lifted or becomes a revocation; today it is defined for the diploma
([[FW-RB-0002]] §6.2). If the identity credential is revoked or suspended, the identity service issues no new ZK copy (RB-AP-ID-11).

## 6. Mechanism and publication

| Topic | Rule | Source |
| --- | --- | --- |
| Mechanism | IETF Token Status List (the EU's Attestation Status List mechanism; the draft version fixed by the EU). The mdoc and SD-JWT VC copies carry the same bit | [[SPEC-CRED-0003]] |
| List address | `status.status_list.uri` in the credential; under `https://status.tamga.network/` for services the network runs, on the institution's status server for an institution that runs its own service | [[SPEC-CRED-0003]] §2 |
| Key | The status list signing key is separate from the credential signing key | RB-AP-03 |
| Privacy | The index (`idx`) is random; the address is opaque (does not encode institution, year or group); capacity at least 100,000, fill at most 80%; lists are not split by any criterion other than type | RB-AP-18 |
| Publication | At a fixed interval (today 2 minutes), even without changes; a list is valid for 6 hours; there is no out-of-interval "emergency" publication; first to content distribution, then to the anchor log | RB-AP-17, RB-AP-19 |
| Suspended issuer | Publishes no status list; a successor may publish | RB-AP-20, RB-REG-07 |
| Time to take effect | Publication interval + the verifier's prefetch interval (a few minutes); at most 24 hours for a ZK presentation | RB-GEN-10, [[ADR-0044]] K4 |
| Verifier | Prefetches lists in bulk, does not fetch them at each verification; if a list is stale or unreachable the result is `INDETERMINATE`, not `REJECTED` | RB-RP-06, RB-GEN-03 |
| Wallet | "Invalid" and "could not be verified" are shown differently | RB-WP-12 |

## 7. Records and privacy

- The reason for revocation does not appear in the list or the credential; the list carries no personal data.
- Logs and audit records **MUST NOT** carry the status list index (`idx`) (RB-GEN-06).
- The issuer backs up its credential records and the status list mapping regularly; revocation is possible only with these records
  (RB-AP-22).
- In the list phase every participant knows that a revocation takes effect within a few minutes; people are told about this limit in
  writing (RB-GEN-10).

## 8. Open decisions

| Topic | Status |
| --- | --- |
| Cascading revocation of institutional credentials when a wallet unit is revoked | Today only the identity service's credentials are revoked when a wallet unit is revoked. A network-level rule for institutional credentials is an **open decision** |
| An issuer's own additional revocation policy | This policy is common to all issuers in the network. Whether institutions should be asked to publish their additional conditions separately is an **open decision** |
| Attestation Revocation List | The EU requires both mechanisms (VCR_10, VCR_12); today only the Status List is published. Revocation List support is planned with the trust list formats work |

## Status

**Active** — version 1.0.0 (11 October 2026).
