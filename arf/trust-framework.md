---
title: "Annex A — Trust Framework"
translation_of: FW-TF-0001
source_version: 1.0.0
outline: [2, 3]
---

# Annex A — Trust Framework

<div class="arf-meta">

**Document** FW-TF-0001 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-02 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The governance framework of the Tamga ecosystem, structured on the World Bank's five-layer model for digital wallet trust
frameworks: **strategy** (vision, principles, legal context, risk, governing bodies), **technology** (pointing to the main
document), **scheme rules** (roles, onboarding gates, lifecycle, assurance), **compliance** (regime, ISO/IEC 17000 roles,
conformity testing, supervision, sanctions, incident response) and **agreements** (contract set, service levels, liability,
termination, succession). It is the Turkic-world counterpart of the [[t:eIDAS]] 2.0 and implementing-regulation layer, and the
asset that is handed over when a state takes over.

## 0. Status, scope, how to read

This document is the **Tamga [[t:trust-framework|Trust Framework]] 1.0** and is binding on every institution that joins the
network: an institution that signs the participation agreement accepts this framework and the [[t:rulebook|Tamga Rulebook]]. It has
three jobs:

1. To tell **institutions** how to join the network, which obligations they take on and which assurances they receive.
2. To show **regulators and the member states of the Organization of Turkic States (OTS)** that the structure is built in the
   same way as eIDAS 2.0, yet designed for the Turkic world in terms of sovereignty and hand-over.
3. To be the asset delivered **at hand-over**: root fingerprints, registers, rules, contract templates and the change log are
   bound to this document.

The document is organised on the World Bank's five-layer model (strategy · technology · scheme rules · compliance ·
agreements). Each layer distinguishes "today" from "at hand-over". The decisions and specifications the rules rest on are
in Annex E.

**Order of precedence:** decision records > specifications > this document > Tamga Rulebook > contract templates. In a
conflict the higher source prevails and this document is corrected.

Which sections to read, and in which order, is on [[FW-READ-0001]]; the steps of joining are on [[FW-ONB-0001]].

---

## 1. Layer 1 — Strategy

### 1.1 Vision

A shared trust infrastructure in which the member and observer states of the OTS, their institutions and their citizens
**can verify each other's credentials without asking the source**. Each state is the sole owner of its own registers; there is
no authority above them. The technical layer is the same as the EU standards; the governance belongs to the Turkic world.

### 1.2 Principles

The seven principles of the main document (§1.6, P1–P7) are also the principles of this framework. Two further principles
specific to governance:

| #   | Principle                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G-A | **Registration is not authorisation.** The registrar records; it does not approve. An institution's legal authority to issue credentials (the Council of Higher Education, a ministry, a professional chamber) is granted outside the network. The network holds only the scope within the network (which credential types, which fields). |
| G-B | **Soft power is limited too.** Every power that code cannot limit (hosting, domain names, record keeping, statistics) is limited by a written policy, a measurable threshold alert and a transparency report.                                                                                                                              |

### 1.3 Scope

| Dimension                         | Today                                                                                                                                                                            | Target                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Jurisdiction                      | Türkiye (the Türkiye list is live)                                                                                                                                               | OTS members (Azerbaijan, Kazakhstan, Kyrgyzstan, Uzbekistan) and observers (Hungary, Turkmenistan); a place is reserved for each |
| Credential types                  | Education credentials (student certificate, diploma), identity credential, contact credentials, event ticket                                                                     | Sector schemas                                                                                                                   |
| Participants                      | Issuing institutions (universities, ticket sellers), verifiers (employers, websites), Tamga (provisional list operator and registrar), Tamga Wallet (the network's first wallet) | Professional bodies, public bodies, banks, every wallet that follows the rules                                                   |
| Person identification ([[t:PID]]) | **Out of scope** — Tamga does not issue PID                                                                                                                                      | The PID Provider appointed by the state                                                                                          |

### 1.4 Legal context

| Topic                           | Basis in Türkiye                                                                                                              | In this framework                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Personal data                   | Law No. 6698 (KVKK); VERBİS; information notice, explicit consent, data protection impact assessment                          | Annexes to the participation agreement                                        |
| Electronic signatures and seals | Electronic Signature Law No. 5070; the BTK list of electronic certificate service providers; qualified signatures and e-seals | The highest identity proofing path; e-seal option for accredited issuers      |
| International recognition       | eIDAS 2.0 Article 14 (third-country agreements); non-EU list support in ETSI TS 119 612                                       | Technical compatibility and an ETSI-format view of the lists                  |
| Higher education                | Higher education legislation (authority to award diplomas)                                                                    | Authority outside the network; the scope within the network is separate (G-A) |
| Jurisdiction and disputes       | The law of the state where the institution is established                                                                     | §5.8                                                                          |

Before the pilot, the framework and its contract annexes are reviewed by a lawyer with regard to KVKK and Law No. 5070.

### 1.5 Risk approach

Risks are handled at the level of the ecosystem and in proportion. The risk register is derived from the risk list of the EU
ARF. The residual risks declared openly today are in the main document (§6.6 and §7.4): an anchor resting on a single
operator's signature, the time a revocation takes to take effect, and the possibility of linking a person when credentials
from the same [[t:issuer]] are combined.

### 1.6 Governing bodies and powers

| Stage                                   | Body                                                | Powers                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **List stage and ledger stage (today)** | Tamga, provisional operator                         | Day-to-day operation, infrastructure, carrying out the list operator and registrar roles on behalf of the state, publishing the open packages         |
|                                         | Tamga technical board                               | Specification changes, approval of decision records, network-wide shared credential types                                                             |
|                                         | (not yet formed)                                    | Council — not formed while there are no member states; this provisional situation is named openly                                                     |
| **States join and after**               | Council (member states)                             | Admission and removal of members, network-wide shared credential types, protocol upgrades and the policies of this document; all by a two-thirds vote |
|                                         | Each state                                          | Its own national list and registers (written only by that state), registrar, list operation, root certificate                                         |
|                                         | Governance body (foundation or council secretariat) | Operation, until handed over                                                                                                                          |

The governance body is not set up on day one: it is formed when one or two states are willing to join, and the lists are
handed over. Until then Tamga is the provisional operator; once the foundation is formed, operation is handed over to it.

**Measurable hand-over thresholds:** if the share of hosted issuers exceeds 30%, the matter goes on the council's agenda; when
there are at least four state operators, the first operator's ledger nodes are handed over; when the first state operator is
in production, the council is formed. The shared ledger starts with at least two independent operators.

### 1.7 Transparency

A transparency report is published every three months: list versions and changes, the share of hosted issuers, credential
type usage counters (in groups of at least 50), incidents and audit findings. The change log of the lists is public at
`trust.tamga.network`.

---

## 2. Layer 2 — Technology

The technical reference is the main document; this layer lists only the requirements governance places on the technology.

### 2.1 Mandatory standards and profiles

- credential formats: [[t:SD-JWT-VC]] (Tamga profile) and, for identity, ISO/IEC 18013-5 [[t:mdoc]];
- protocols: [[t:OpenID4VCI]] and [[t:OpenID4VP]] ([[t:HAIP]] 1.0 profile);
- institutional identity: X.509 certificates;
- revocation: [[t:status-list]] (IETF Token Status List);
- credential types: the type definition (Type Metadata) and JSON Schema catalogue;
- the [[t:trust-list]] format and the canonical verification pipeline;
- wallet and [[t:identity-proofing]] rules.

Technical detail is in the developer documentation (Annex E).

### 2.2 Assurance model (governance view)

| Axis                                                                    | Level                                                             | Who sets it                                                           | Where it is recorded                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Identity proofing of the holder (T0–T3; eIDAS Low / Substantial / High) | Binding path                                                      | The issuer or a registration authority                                | The issuer's audit record; a precondition of the credential type |
| Issuer (I1–I3)                                                          | Accreditation                                                     | The registrar; at I3 an independent assessment                        | In the trusted list (assurance and class fields)                 |
| Wallet (W1–W3)                                                          | Secure hardware (WSCD — Wallet Secure Cryptographic Device) level | The wallet provider (wallet instance attestation and key attestation) | In the list of lists, in the wallet provider's entry             |

External naming uses eIDAS terms (Low / Substantial / High; [[t:EAA]], QEAA equivalent, public-sector attestation). No number
is shown to the user.

### 2.3 Key protection requirements

| Key                               | Requirement                                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List signing key                  | At least two rolling certificates; KMS or HSM; rotation announced at least 30 days ahead, the new key is signed with the old one                                                  |
| Root certificate                  | Offline ceremony (two people, minutes); fingerprint published on a permanent page                                                                                                 |
| The issuer's signing key          | Under the institution's control; in an HSM at I3; **not held at Tamga**                                                                                                           |
| Revocation list key               | Separate and online                                                                                                                                                               |
| The holder's key                  | In the device's secure area; not exportable; not derived from a recovery seed                                                                                                     |
| The verifier's access certificate | From the access certificate authority; the client identifier is the certificate digest (`x509_hash`), the permanent identifier is the domain name in the certificate (`dns_name`) |

### 2.4 Certification approach

In the list stage and the ledger stage **light conformity** applies: open conformance test vectors and commitment tests are
mandatory before every release. When states join, independent conformity assessment bodies and national certification follow
(§4.2, §4.3).

---

## 3. Layer 3 — Scheme rules

### 3.1 Roles and responsibilities

The roles are defined in chapter 3 of the main document, each role in detail on [[FW-ROLE-0001]], and the binding rules in
Annex B. This section defines the **gates** of joining and the lifecycle; the step-by-step process is on [[FW-ONB-0001]].

### 3.2 Onboarding gates

The gates are designed as automatic conformity checks; no registration is made until a gate is passed.

#### Issuer

| Level               | Gate                                                                                                                                                                                           | What it gives                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **I1 — Registered** | Domain ownership (DNS challenge); contact details; technical conformity (a test credential against the type definition and the conformance test vectors)                                       | EAA class and I1 assurance in the list; "not accredited" in the verifier interface  |
| **I2 — Contracted** | I1 + legal personality (MERSİS and Trade Registry Gazette, or founding law) + confirmation of the authorised signatory + **participation agreement** (§5.1) + X.509 certificate + KVKK annexes | I2 assurance                                                                        |
| **I3 — Accredited** | I2 + keys in an HSM (or a qualified e-seal) + audit and record-keeping duties + incident notification times + annual review + suspension procedure + liability insurance                       | I3 assurance, qualified class; a qualified-attestation mark in the credential       |
| **Public**          | On behalf of a state body or authentic source; registered by that state's registrar                                                                                                            | Public class; a public-sector-attestation mark in the credential (when states join) |

The institution uses the hosted issuing service from its own systems **with an API key bound to it and limited in scope**; the
key is stored only as a digest and renewed every 90 days.

Authority over credential types is independent of the gate and is granted **through a separate allow-list for each type**;
the default is closed. It is granted according to the "who may issue" section of the credential type's rulebook.

#### Verifier

An application ends with the allocation of a scope. The application asks for the EU common registration data set: legal and
trade name, official identification number (tax number or MERSİS), address, contact, a description of the service, the
purpose and the **privacy policy** for each intended use, whether it is a public body, the type of entitlement, any
intermediary relationship and the data protection authority it reports to. Only legal persons register. The fields that may be
requested are then reviewed under data minimisation, an [[t:access-certificate]] is issued and the verifier is added to the list.
A verifier cannot request fields outside its scope; the wallet shows the scope to the person. A verifier can run its own
software or use the hosted verifier (an [[t:intermediary]]); in the second case the result and values are given only to the
verifier that proves itself with a signed statement, and only once.

**[[t:registration-certificate|Registration certificate]].** The registrar (today Tamga, on behalf of the state) issues an [[t:ETSI]] TS 119 475
registration certificate for each intended use (valid for at most 12 months). Its content comes only from the entry in the
signed list, and it is signed with a separate registrar key published in the [[t:LOTL]]. The verifier carries the certificate
with its request; the wallet checks the signature, the validity period and the link to the organisation identifier in the
verifier's access certificate, and compares the requested fields with the certificate. A registration certificate is also
issued per institution for issuers. No certificate is issued to a participant whose organisation identifier has not been
recorded.

#### Wallet provider

A wallet solution declaration is made (platforms, secure hardware level, PIN and biometrics, backup model; in line with the
wallet rules of the Tamga Rulebook), the conformance tests are passed, and the signing key for the wallet instance attestation
([[t:WIA]]) and key attestation (KA) is added to the list of lists. When states join, a list of certified wallet solutions
follows (the counterpart of EU Implementing Regulation 2025/849).

#### Authentic source

Named in the issuer's agreement; a data processing agreement is signed (§5.1). A mapping table from the source data to the
credential fields (for example ISCED-F) is kept, and the rule "no credential is issued for data that has no match in the
mapping" applies.

### 3.3 Lifecycle rules

- **Suspension:** after an incident, an audit finding or a breach of agreement, the institution is suspended; no new credentials
  are issued, earlier credentials stay valid according to their issue date. Once the issue is fixed, the institution is
  reactivated.
- **Removal:** the institution is removed from the list (with a successor link where there is a successor); in the ETSI view
  it appears as "withdrawn"; history is never deleted; the successor may continue publishing the revocation list.
- **Key or certificate renewal:** the new institution identifier is linked to the old one as its successor; earlier credentials
  are verified against the old entry; the registrar is notified of a renewal at least 30 days ahead.
- **Voluntary exit:** takes effect 90 days after notice; the revocation list is frozen at its last version by the successor or
  the list operator.
- **States joining and leaving:** membership is by a two-thirds vote; leaving does not invalidate existing entries;
  re-admission is possible.

### 3.4 Identity proofing and credential type

Each credential type rulebook defines the minimum identity proofing level the type requires (Education Rulebook: student
certificate T1, diploma T2). The issuer ensures this level before issuing; the level is not written into the
[[t:credential]]. The paths and the integration of remote identity verification providers are in [[SPEC-ID-0003]].

### 3.5 Provisional identity credential provider

Until a PID Provider appointed by the state exists, **Tamga Network** takes this role _provisionally_: after remote identity
verification (document, liveness, face match; NFC may be added) it issues the Tamga identity credential to the wallet. Rules:

1. This credential is not PID; it is an EAA. When a state provider is appointed, it is handed over through succession (§5.7).
2. Tamga is the **data controller under KVKK** for this data: the information notice is given and explicit consent obtained
   before issuance; document and face images are not stored at Tamga; retention is limited to the life of the credential; an
   erasure request revokes the credential.
3. The identity number is carried only in this credential type, with [[t:selective-disclosure]].
4. Institutions receive the credential only through **presentation**, within their registered scope, and only to match it with
   their own records; they do not store the matching keys.
5. The agreement with the remote identity verification provider refers to ETSI TS 119 461.
6. The quarterly transparency report includes the numbers of credentials issued and revoked; it contains no personal data.

The technical profile is in [[SPEC-ID-0003]] §9.

### 3.6 Data protection rules (KVKK)

Responsibility by role: the issuer and the [[t:authentic-source]] are data controllers; Tamga is a processor under contract in
the issuing service it hosts and **the data controller in the identity credential service (§3.5)**; the [[t:wallet-provider]] has
no access to the data on the device; the verifier is responsible for the fields it receives. Shared registers hold no personal
data (P2). The person's rights: the presentation history is kept on the device, the way to complain to the data protection
authority is shown in the wallet, and withdrawing consent means revoking the credential.

### 3.7 In-person presentation and access passes

**Principle:** the single-use value used during verification (the [[t:nonce]]) is generated by the party that wants to be
convinced. In in-person presentation where the wallet shows a QR code, either a second channel is opened (target: ISO/IEC
18013-5) or the QR code carries only a **short-lived reference** (an OpenID4VP flow the verifier then starts) or a **signed
token with no personal data** (an access pass, 60 seconds). Rules:

1. A gate terminal is defined only under a registered verifier.
2. The access token does not identify the person; the verifier matches the person in its own records.
3. Not asking for approval at the gate rests on a **time-limited consent with a defined scope**; the person can withdraw it at
   any time.
4. Every presentation is recorded in the wallet.
5. For single-use credentials (tickets), gates keep a shared "used" list.
6. These interim paths are versioned and retired when the ISO/IEC 18013-5 proximity flow arrives.

---

## 4. Layer 4 — Compliance

### 4.1 Regime — a hybrid model

| Class           | Regime                                                                          | What it means                                                                                         |
| --------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| I3 / qualified  | **Prior assessment**                                                            | Conformity assessment (technical and organisational) before registration, annual audit                |
| I2              | **Subsequent supervision**                                                      | Self-declaration and conformance test vectors; audit on complaint or incident; annual self-assessment |
| I1              | Self-declaration                                                                | Technical conformity test; "not accredited" label                                                     |
| Wallet provider | Today self-declaration and conformance tests; prior assessment when states join | A certified wallet solution when states join                                                          |
| Verifier        | Subsequent supervision                                                          | On a complaint of scope breach or over-asking                                                         |

This is the same as the EUDI hybrid model: qualified attestations are assessed in advance, the others afterwards.

### 4.2 ISO/IEC 17000 roles

| Role                       | Today                                               | When states join                                       |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| Scheme owner               | Tamga (provisional operator)                        | The council                                            |
| Accreditation body         | Tamga (provisional)                                 | The national accreditation body (comparable to TÜRKAK) |
| Conformity assessment body | — (self-declaration and conformance test vectors)   | Independent assessment bodies                          |
| Scheme participant         | Issuer, verifier, wallet provider, authentic source | The same                                               |

### 4.3 Conformance tests and certification

Conformance is shown with the role's own software. The tests are public and versioned in the repository's `conformance/`
folder; they contain no personal data and no private keys.

| Role            | What is tested                                                                                                                                          | How it is shown                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Issuer          | Producing credentials that match the type definition, the signature and certificate chain, publishing the revocation list, checking wallet attestations | A test credential against the conformance vectors; the result report is attached to the registration application |
| Verifier        | The signed request, the steps of the verification pipeline, the "cannot be verified" result on a stale list, not requesting out-of-scope fields         | Conformance vectors and commitment tests; the result report is attached to the registration application          |
| Wallet provider | The wallet rules (key protection, consent screen, history, deletion), the wallet instance attestation and key attestation, the presentation protocol    | Conformance vectors, commitment tests and a demonstration on a device                                            |

Commitment tests include at least: a stale list gives "cannot be verified"; processing stops on an unknown format; processing
stops on a signature error. The steps for running the tests are in the developer documentation (Annex E). Results are
submitted to the registrar, which re-runs the tests where needed. When states join, independent assessment bodies and national
certification are added on top of these tests; interoperability with the EU is also shown with the OpenID conformance tests.

The reference [[t:verifier]] (`verify.tamga.network`) is open to everyone; verifiers may also run their own verification
software. Tamga offers no hosted list-indexing service.

### 4.4 Continuous supervision

The transparency report, measurements of the threshold alerts, the change log of the lists, the incident record and an
independent audit (annual from the time states join; including the content delivery network and record-keeping
configuration — verifying that shared registers hold no personal data).

### 4.5 Sanctions ladder

| Step | What                                                                              | Record                                   |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| 1    | Warning and a period to fix (30 days)                                             | Incident record                          |
| 2    | Narrowing the credential type authority (closing the allow-list for a given type) | The authority window closes              |
| 3    | **Suspension**                                                                    | List and change log                      |
| 4    | **Removal** (with a successor appointed) — "withdrawn" in the ETSI view           | List, change log and transparency report |
| 5    | Termination of the agreement; legal remedies                                      | §5                                       |

Removal does not invalidate **earlier credentials** (the issue date is what counts); only new issuance stops, and if no
successor is appointed the revocation list is frozen. There are no fines in this framework; once formed, the council may
introduce them by its own decision.

### 4.6 Incident response

| Incident                                      | Severity         | Response                                                                                                                                           |
| --------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| An issuer's signing key was leaked            | Critical         | The issuer is suspended; its certificate is revoked; the affected credentials are revoked in the revocation list; a re-issuance plan; notification |
| Suspected compromise of the list signing key  | Critical         | Switch to the second rolling certificate; root fingerprint page and transparency notice                                                            |
| A flaw in a wallet solution                   | Critical or high | Graduated: revoking wallet attestations by version, or revoking a single wallet unit; issuers refuse new issuance                                  |
| Revocation list publication missed two cycles | High             | Verifiers return "cannot be verified"; the operator intervenes                                                                                     |
| The credential type catalogue is unreachable  | Medium           | The cached type definition (with its integrity digest) keeps verification going                                                                    |

Severity levels: **critical** — trust itself is at risk, notified within 4 hours at most; **high** — a service or a participant
is affected, notified within 24 hours at most; **medium** — verification continues, recorded in the incident record. This
structure is the counterpart of EU Implementing Regulation 2025/847. A personal data breach is notified to the KVKK authority
within 72 hours.

### 4.7 Disputes

A dispute between participants is first handled by the scheme owner (today the Tamga technical board), then by the
jurisdiction named in the agreement. Between states the council is competent; there is no higher authority at network level.
A person's complaint goes to the issuer and to the data protection authority.

---

## 5. Layer 5 — Agreements

### 5.1 The contract set

The templates are kept by the operator and given to the institution during the application; their public summaries are below.

| Agreement                            | Parties                                           | Summary                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Participation agreement (issuer)** | Institution ↔ scheme owner                        | Scope, class and assurance, credential type authorities, key management (the signing key stays at the institution), the duty to publish the revocation list, identity proofing levels, notifications, KVKK annexes, service levels, liability, termination, succession |
| **Hosting annex**                    | Institution ↔ operator                            | The issuing service runs at the operator, the signing key stays at the institution; the operator's record-keeping rules; the list of hosted institutions is public; the hosting share threshold                                                                        |
| **Verifier terms of use**            | Verifier ↔ scheme owner                           | Scope, data minimisation, the ban on over-asking, not recording credential fields or revocation list positions, the single-use value, handling "cannot be verified" correctly, keeping registration data up to date                                                    |
| **Wallet provider agreement**        | Wallet provider ↔ scheme owner                    | Wallet instance attestation and key attestation, secure hardware level, update and revocation times, not holding recovery keys                                                                                                                                         |
| **Data processing agreement**        | Issuer ↔ authentic source or operator (processor) | KVKK Article 12; mapping table; retention periods                                                                                                                                                                                                                      |
| **Pilot participant notice**         | Pilot participants                                | The limits of the pilot in plain words: trust rests on signed lists today, the anchor is with a single operator, a revocation takes effect within a few minutes, participation is voluntary, consent can be withdrawn at any time                                         |
| **Succession agreement**             | Operator ↔ custodian or council                   | Domain name, root certificates, list archive, hand-over of keys                                                                                                                                                                                                        |

Every agreement refers to this framework and to the Tamga Rulebook; if they change, the relevant annex of the agreement is
updated too. A version that changes a core obligation requires a new signature (§8).

### 5.2 Service levels

| Service                                  | Target                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Access to the trusted lists (`trust.`)   | 99.9% monthly; next update at most 90 days ahead; a change within 24 hours at most |
| Anchor log                               | Hourly; at most one missed cycle                                                   |
| Credential type catalogue (`schemas.`)   | 99.9%; a published file never changes                                              |
| The issuer's revocation list publication | Fixed interval (2 minutes); two missed cycles are high severity                                                          |
| Incident notification                    | Critical within 4 hours; high within 24 hours                                      |
| Registration change (registrar)          | Within 5 working days                                                              |

These numbers are reviewed with pilot data; changes are published in a new version.

### 5.3 Sharing of liability

| Who                                    | Responsible for                                                                                             | Relation to assurance                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Issuer                                 | The accuracy of the credential content; identity proofing at the level the type requires; timely revocation | A "presumption of accuracy" for I3 and qualified credentials; at I1 the burden of proof is on the verifier |
| Authentic source                       | The accuracy of the source data                                                                             | Towards the issuer, by agreement                                                                           |
| Wallet provider                        | The accuracy of the statements in its wallet attestations; key protection at the declared level             | If a W2 or W3 statement is wrong, liability lies with the provider                                         |
| Verifier                               | Applying its policy correctly; not treating "cannot be verified" as accepted; staying within its scope      | Additional identity checks for high-risk transactions are the verifier's duty                              |
| Operator (list operator and registrar) | List integrity, publication interval, accuracy of registrations, transparency                               | Limited, except for intent and gross negligence (pilot participant notice)                                 |
| Holder                                 | PIN and device security; objecting to the "your credential was added to a wallet" notice                    | —                                                                                                          |

### 5.4 Confidentiality and intellectual property

Code is licensed under Apache-2.0 and documents under CC BY 4.0; the credential type catalogue is open and can be mirrored. Use
of the "Tamga" mark and the trust mark is subject to agreement; data belonging to institutions is confidential.

### 5.5 Pricing (direction)

<!-- KARAR BEKLİYOR: katılım ücreti -->

**Free for individuals** (as in eIDAS 2.0). The fee structure for institutions is set in the participation agreement at the
end of the pilot; the pilot is free.

### 5.6 Termination and exit

Voluntary exit is as in §3.3; on termination the revocation list is frozen or passes to the successor; existing credentials are
not invalidated; retention periods for personal data follow KVKK.

### 5.7 Hand-over (succession)

Once the foundation is formed the domain name is registered to the foundation, until then to the provisional operator; it has
a transfer lock and DNSSEC and is renewed at least 10 years ahead. On liquidation of the operator or hand-over to a state, the
domain name, root certificates, list archive and key escrow pass to the council or the custodian.

### 5.8 Jurisdiction

In agreements between an institution and the operator, the law of the state where the institution is established applies; for
institutions in Türkiye the courts of Istanbul are competent. Between states the council is competent; for the person's rights
the law of the person's own state applies.

---

## 6. Interoperability (three levels)

| Level                | In Tamga                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1. Portability       | SD-JWT VC and OpenID4VC; an EU wallet can technically process a Tamga credential                               |
| 2. Trust             | The trusted list (in the sense of ETSI TS 119 612); an XML view; root fingerprints; a mutual-recognition field |
| 3. Legal recognition | Unilateral recognition between states; with the EU, an eIDAS Article 14 agreement (long term)                  |

### 6.1 External lists (federation)

A national list, or another trusted list (for example a list of a state, of a body designated by a state, or of the EU), does
not have to be owned by Tamga. Such a list appears in the list of lists with four items:

- **Address:** the list's original publication address. Tamga also keeps a copy; the copy cannot change the content, because the
  signature is always checked against the original signer.
- **Pinned signer:** the fingerprints of the certificates that sign the list. The fingerprints are kept in the list of lists that
  Tamga signs; a list whose signer does not match is not loaded.
- **Scope:** the roles (wallet provider, identity provider, issuer, access certificate provider) and credential types the list
  may vouch for. The issuers' class, assurance level and recognition also come from the scope.
- **Approval:** the decision and date by which the list was added.

The list stays with its owner; Tamga only points to it. The freshness of each external list is tracked separately: even if one
is missing or stale, the Tamga lists and the other lists are not affected; only questions that depend on that list return
"cannot be checked right now". The first format read is ETSI TS 119 602 ([[t:LoTE]], JSON).

| Code | Rule                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FD1  | An external list is shown only in the Tamga-signed list of lists, with its address, pinned signer fingerprint and scope; a list whose signer does not match the one recorded there is not loaded. |
| FD2  | An external list cannot vouch for roles and credential types outside its scope; out-of-scope entries are ignored.                                                                                 |
| FD3  | A missing, stale or unverifiable external list does not affect the freshness of the Tamga lists; every question that depends on that list returns "unknown".                                      |
| FD4  | Adding, changing or removing an external list requires project management approval and is stated in the entry; an entry with empty fields is not published.                                       |
| FD5  | For Tamga credential types the integrity digest of the type definition is mandatory; for external types, trust in the type comes from the external list's signed entry.                           |

This mechanism and the addition of any particular external list are separate decisions: the mechanism is ready, and which list
to trust is decided separately for each list.

---

## 7. Hand-over plan — to OTS member states

| Step | What is handed over       | How                                                                                                                                                                                         |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | National list operation   | The operator field in the list changes; root, institution and credential type identifiers stay the same; a new signing certificate belonging to the state is added as a rolling certificate |
| 2    | Registrar                 | Registration authority passes to the state; Tamga can no longer register                                                                                                                    |
| 3    | National root certificate | The root's name stays the same and its operator changes; or the state's root is added as a rolling root and the old root retires                                                            |
| 4    | The PID Provider place    | Filled by the state; the higher identity proofing levels move to PID                                                                                                                        |
| 5    | Shared ledger             | Ledger stage with at least two independent operators; states join with state operators; the list archive is carried over as it is and passes equivalence tests                              |
| 6    | This document             | Passes into the council's ownership; version numbering continues                                                                                                                            |

No hand-over invalidates any credential, entry or identifier.

---

## 8. Change management of this document

- Versioning: semantic versioning; the major version increases when a participant obligation changes (a new signature is
  required), the minor version when a rule or role is added, the patch version for corrections.
- Every change rests on a decision record and is published on the "What changed" page of Tamga ARF.
- The place of publication is **`arf.tamga.network`**; the framework link in the trusted lists carries the versioned address.

---

## 9. Topics to review with pilot data

The items below are in force; their numbers and details are reviewed with pilot data, and changes are published in a new
version.

| Topic                                                                                                         | Section    |
| ------------------------------------------------------------------------------------------------------------- | ---------- |
| Hybrid compliance regime (prior assessment for qualified attestations, subsequent supervision for the others) | §4.1       |
| ISO/IEC 17000 role mapping                                                                                    | §4.2       |
| Sharing of liability                                                                                          | §5.3       |
| Sanctions ladder, periods to fix and service level numbers                                                    | §4.5, §5.2 |
| Showing the way to complain to the data protection authority in the wallet                                    | §3.6       |
| Legal review                                                                                                  | §1.4       |
| Jurisdiction                                                                                                  | §5.8       |

---

## References

The decisions, specifications and standards this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (2 October 2026).
