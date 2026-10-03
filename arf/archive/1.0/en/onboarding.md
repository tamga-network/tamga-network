---
title: "Onboarding"
translation_of: FW-ONB-0001
source_version: 1.0.0
outline: [2, 3]
---

# Onboarding

<div class="arf-meta">

**Document** FW-ONB-0001 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-02 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The steps of joining Tamga Network: application, required documents, review, conformance tests and entry into the list for an
issuer, a verifier, a wallet provider and a state; then registration changes, suspension and exit. The rules are in Annex A
§3.2–§3.3 and Annex B; the technical steps are in the developer documentation.

## 1. The general flow

Joining follows the same four steps for every role. The process is the same for everyone; Tamga Wallet and the provisional
operator's own services take the same path.

| Step                   | What happens                                                                                                                     | Rule                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1. Application         | The institution chooses its role and gives the application file and the required documents to the registrar                      | Annex A §3.2            |
| 2. Review              | The registrar checks the gate: domain name, legal personality, authorised signatory, scope; anything missing is reported at once | RB-REG-01…09            |
| 3. Conformance tests   | The institution passes the open conformance tests with its own software; the result report is attached to the application        | Annex A §4.3, RB-ENF-01 |
| 4. Entry into the list | The registrar adds the institution to the trusted list; the change is published within 24 hours at most                          | RB-OP-03                |

No registration is made until the gate is passed. Registration does not grant legal authority (Annex A §1.2, G-A). Today the
registrar for Türkiye is Tamga, on behalf of the state; once a state takes over its own list, applications go to that state's
registrar.

## 2. Issuer

| Step                                 | Detail                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Choose the level                  | I1 (registered), I2 (contracted), I3 (accredited) or public (Annex A §3.2). The rulebook for your credential type states the minimum level (for example I2 for diplomas).       |
| 2. Prepare the documents             | See the table below.                                                                                                                                                            |
| 3. Generate the keys                 | A credential signing key and a separate revocation list key (ES256); both stay with the institution (RB-AP-02, RB-AP-03). A certificate signing request (CSR) is sent for each. |
| 4. Review and certificate            | The registrar reviews the application; the national root certificate signs the institution certificate (RB-AP-01).                                                              |
| 5. Conformance test                  | A test credential is produced against the type definition and the conformance test vectors; publication of the revocation list and the check of wallet attestations are tested. |
| 6. Entry into the list and authority | The institution is added to the list; authority is granted separately for each credential type (RB-REG-04). A registration certificate is issued.                               |
| 7. First credential                  | The institution issues its first credential with its own issuing software or with the hosted issuing service (with an API key bound to the institution, RB-OP-18).              |

**Required documents**

| Document                                                                                                                                                                | I1  | I2  | I3  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- |
| Domain ownership (DNS challenge) and contact details                                                                                                                    | ✓   | ✓   | ✓   |
| EU common registration data: legal and trade name, official identification number (tax number or MERSİS), address, contact, the data protection authority it reports to | ✓   | ✓   | ✓   |
| Credential types and the name of the authentic source                                                                                                                   | ✓   | ✓   | ✓   |
| Proof of legal personality (MERSİS and Trade Registry Gazette, or founding law) and confirmation of the authorised signatory                                            | —   | ✓   | ✓   |
| Signed participation agreement and KVKK annexes (Annex A §5.1)                                                                                                          | —   | ✓   | ✓   |
| Proof that keys are in an HSM or that a qualified e-seal is used                                                                                                        | —   | —   | ✓   |
| Audit and record-keeping arrangements, incident notification times, suspension procedure, liability insurance                                                           | —   | —   | ✓   |

Technical steps: [[GUIDE-0007]] and [[GUIDE-0003]].

## 3. Verifier

| Step                        | Detail                                                                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Define the intended uses | For each use: the purpose, the attributes to be requested and the privacy policy. Only legal persons register.                                                                                                                                           |
| 2. Application              | The EU common registration data set: legal and trade name, official identification number, address, contact, service description, whether it is a public body, entitlement type, intermediary relationship, the data protection authority it reports to. |
| 3. Scope review             | The attributes to be requested are reviewed under data minimisation; a scope is allocated per use (RB-REG-08).                                                                                                                                           |
| 4. Certificates             | An access certificate is issued; the registrar issues a registration certificate for each intended use, valid for at most 12 months.                                                                                                                     |
| 5. Conformance test         | The signed request, the verification pipeline, the "cannot be verified" result on a stale list and not requesting out-of-scope attributes are tested.                                                                                                    |
| 6. Entry into the list      | The verifier is added to the trusted list. If it will use the hosted verifier, this is also recorded.                                                                                                                                                    |

Technical steps: [[GUIDE-0008]], then [[GUIDE-0002]] or [[GUIDE-0001]].

## 4. Wallet provider

| Step                           | Detail                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Wallet solution declaration | Platforms, secure hardware level (W2 or W3), PIN and biometrics, backup model; in line with the wallet rules of the Tamga Rulebook (Annex B §6).    |
| 2. Agreement                   | The wallet provider agreement: attestations, secure hardware level, update and revocation times, not holding recovery keys (Annex A §5.1).          |
| 3. Conformance tests           | The wallet rules, the wallet instance attestation and key attestation, the presentation protocol; a demonstration on a device.                      |
| 4. Entry into the list         | The attestation signing key is added to the list of lists, in the wallet provider's entry. From then on, issuers accept this wallet's attestations. |

When states join, a list of certified wallet solutions follows and prior assessment begins (Annex A §4.1). Technical steps:
[[GUIDE-0005]] and [[GUIDE-0010]].

## 5. State

| Step                | Detail                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Intent           | The state declares that it is willing to join; once the first state operator is in production, the council is formed (Annex A §1.6).     |
| 2. Root certificate | The state's root certificate is generated in an offline ceremony and added as a rolling root.                                            |
| 3. List operation   | In the national list the operator field passes to the state; institution, root and credential type identifiers do not change (RB-OP-14). |
| 4. Registrar        | The registration authority passes to the state; the provisional operator can no longer register.                                         |
| 5. PID Provider     | Appointed by the state; the Tamga identity credential is handed over through succession (RB-AP-ID-06).                                   |

No hand-over invalidates any credential, entry or identifier (Annex A §7). Technical steps: [[GUIDE-0011]].

## 6. After registration

| Situation                  | What happens                                                                                                                                           | Rule                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Registration change        | The registrar processes it within 5 working days at most.                                                                                              | RB-REG-09               |
| Certificate or key renewal | Notified at least 30 days ahead; the new identifier is linked to the old one as its successor, earlier credentials are verified against the old entry. | Annex A §3.3, RB-REG-06 |
| API key                    | The hosted service's key is renewed every 90 days; on suspicion of a leak the institution requests revocation.                                         | RB-AP-25                |
| New credential type        | Credential type authority is requested separately; the new type must first be published in the catalogue.                                              | RB-REG-04, RB-SCH-05    |

## 7. Suspension

An incident, an audit finding or a breach of agreement starts the sanctions ladder (Annex A §4.5): first a warning and a
30-day period to fix, then narrowing of the credential type authority, then suspension. A suspended institution cannot issue
new credentials or publish a revocation list; the credentials it issued earlier remain valid according to their issue date.
Once the issue is fixed, the institution is reactivated. In critical incidents (for example a leaked signing key) the
institution is suspended immediately (Annex A §4.6).

## 8. Exit

| Path           | What happens                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Voluntary exit | Takes effect 90 days after notice; the revocation list is frozen at its last version by the successor or the list operator. |
| Removal        | The fourth step of the sanctions ladder; a successor is appointed; it appears as "withdrawn" in the ETSI view.              |
| Termination    | The agreement ends; existing credentials are not invalidated; retention periods for personal data follow KVKK.              |

No exit deletes history or invalidates existing credentials (RB-REG-07). Verifiers and wallet providers leave in the same ways.

## Status

**Active** — version 1.0.0 (2 October 2026).
