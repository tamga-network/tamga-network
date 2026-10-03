---
title: "Roles"
translation_of: FW-ROLE-0001
source_version: 1.0.0
outline: [2, 3]
---

# Roles

<div class="arf-meta">

**Document** FW-ROLE-0001 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-02 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The roles in Tamga Network in detail: operator and list operator, registrar, issuer, authentic source, verifier, wallet
provider, person, state and auditor. For each role: what it does, who takes it today, the rules that bind it (Tamga Rulebook)
and what it needs to take part.

## 1. Overview

Chapter 3 of the main document defines the roles in one table; this page describes each role in detail. The binding rules are
in the Tamga Rulebook (Annex B); here each role is linked to its group of rules. An institution may take several roles (a
ticket seller, for example, is both issuer and verifier); it registers separately for each role and follows the rules of each.

Two basic distinctions apply to every role:

- **Registration is not authorisation.** Registering with the network does not give an institution the authority to issue
  credentials; legal authority comes from outside the network (Annex A §1.2, G-A).
- **The signing key stays with its owner.** Tamga does not hold an institution's signing key in any service it hosts
  (RB-OP-08).

| Role                       | Who today                                                                                             | Rules            | Joining                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------ |
| Operator and list operator | Tamga, provisional operator                                                                           | RB-OP            | —                              |
| Registrar                  | Tamga, provisionally on behalf of the state                                                           | RB-REG           | —                              |
| Issuer                     | Universities, ticket sellers; the Tamga identity service (for the identity credential, provisionally) | RB-AP, RB-AP-ID  | [[FW-ONB-0001]] §2             |
| Authentic source           | Institutions' record systems                                                                          | RB-AS            | Through the issuer's agreement |
| Verifier                   | Employers, websites, gates                                                                            | RB-RP            | [[FW-ONB-0001]] §3             |
| Wallet provider            | Tamga Wallet (the network's first wallet)                                                             | RB-WP            | [[FW-ONB-0001]] §4             |
| Person (holder)            | Everyone who uses a wallet                                                                            | RB-H             | Voluntary                      |
| State                      | None yet; a place is reserved for every member state                                                  | Annex A §1.6, §7 | [[FW-ONB-0001]] §5             |
| Auditor                    | Self-declaration today; independent bodies once states join                                           | Annex A §4       | —                              |

## 2. Operator and list operator

**What it does.** Runs the network's shared infrastructure: compiles, signs and publishes the list of lists and the national
trusted lists; signs the anchor log every hour; publishes the credential type catalogue as immutable files; issues the
transparency report; publishes the open-source packages. Its EU counterpart is the trusted list scheme operator ([[t:TLSO]]).

**Who today.** Tamga, as provisional operator and, for each national list, on behalf of that state (`status = "provisional"`,
`on_behalf_of`). Once the foundation is formed, operation passes to it and the national lists pass to the states (Annex A §7).

**Obligations.** Annex B §2 (RB-OP-01…18): the version chain and publication interval of the lists, at least two rolling
signing certificates, publication of root fingerprints, a public change log, holding no signing keys, the hosting share
threshold, aggregate statistics without personal data, the quarterly transparency report, protection of the domain name, and
unchanged identifiers at hand-over.

**What it needs.** A root certificate ceremony, signing keys in a KMS or HSM, publication infrastructure (trusted lists,
catalogue) and an incident response arrangement.

**Its limit.** Even while it also carries out the registrar role, the operator has no access to an institution's credential
content, personal data or signing key; shared registers hold no personal data (RB-GEN-01).

## 3. Registrar

**What it does.** Registers issuers, verifiers and wallet providers; grants credential type authority through an allow-list;
reviews verifiers' scope under data minimisation; issues [[t:registration-certificate|registration certificates]] to verifiers and issuers.
**It records, it does not approve:** it does not judge legal authority, it records it.

**Who today.** Tamga, provisionally on behalf of the state for Türkiye. At hand-over the registration authority passes to the
state and Tamga can no longer register (Annex A §7, step 2).

**Obligations.** Annex B §3 (RB-REG-01…09): national registers written only by their owner, new issuers attached only to an
active root certificate, credential type authority closed by default, successor entries on certificate changes, exit never
invalidating earlier entries, registration changes within 5 working days.

**What it needs.** A registration tool, a separate registrar signing key (published in the list of lists) and an application
review process.

## 4. Issuer

**What it does.** Issues the person a [[t:credential]] based on its own records and revokes it when needed: a university issues student
certificates and diplomas, a ticket seller issues event tickets. It signs the credential with its own key and publishes its
revocation list at a fixed interval. Its EU counterpart is the provider of electronic attestations of attributes (Attestation
Provider).

**Who today.** The institutions that join the network. For the identity credential, the Tamga identity service is the
provisional issuer until the state appoints a PID Provider (Identity Rulebook).

**Obligations.** Annex B §4 (RB-AP-01…25): an institution certificate chaining to the national root, the signing key under the
institution's control, checking the wallet instance attestation ([[t:WIA]]) and key attestation (KA) before issuing, ensuring the
identity proofing level the type requires, sending the transaction code through a separate channel, not issuing for data with
no match in the mapping, publishing the revocation list at a fixed interval, and the "your credential was added to a wallet"
notice. Rules specific to a credential type are in Annex C.

**What it needs.** Legal personality and a domain name; an X.509 certificate chaining to the national root; a signing key (in an
HSM or e-seal at I3); a connection to the authentic source; issuing software (its own, or the hosted issuing service — in which
case too the signing key stays with the institution); the participation agreement and KVKK annexes (Annex A §5.1).

## 5. Authentic source

**What it does.** Keeps the original record behind the data in a credential: a university's student information system, a
public register. The issuer reads the data from here.

**Who today.** The issuing institutions' own record systems.

**Obligations.** Annex B §5 (RB-AS-01…04): being named in the issuer's agreement and bound by a data processing agreement,
documenting the mapping of source data to the schema, and never carrying the national identity number into shared schemas.

**What it needs.** A secure connection to the issuer and a mapping table (for example the ISCED-F code of a programme).

## 6. Verifier (relying party)

**What it does.** Asks the person for the credential a transaction needs and verifies it: a diploma for a job application, a
student certificate for a discount, a ticket at the gate, a pseudonym when signing in to a website. It can run its own software
or use the hosted verifier (an [[t:intermediary]], Tamga Verify).

**Who today.** The employers, websites and event gates that register.

**Obligations.** Annex B §7 (RB-RP-01…13, RB-RP-ID-01): being registered and not requesting attributes beyond its scope, signed
requests and encrypted responses, applying the specification's verification pipeline in full, not treating "cannot be verified"
as a rejection, not writing attribute values to logs or result objects, and using the per-site pseudonym as the account key for
website sign-in.

**What it needs.** Legal personality; a purpose and privacy policy for each intended use; an [[t:access-certificate]]; a registration
certificate; verification software and up-to-date trusted lists.

## 7. Wallet provider

**What it does.** Provides the wallet in which the person holds and presents credentials; registers wallet units; signs a
wallet instance attestation (WIA) and key attestation (KA) for each transaction; revokes attestations if a flaw is found in the
wallet solution. The network recognises wallets rather than picking them: every wallet that follows the rules and passes the
conformance tests works in the network.

**Who today.** Tamga Wallet: the network's first wallet; a separate, open-source product. Its provider service runs
provisionally on the network's infrastructure and moves to the wallet's own address. Tamga Wallet follows the network's rules
like any other wallet.

**Obligations.** Annex B §6 (RB-WP-01…13): keys generated in secure hardware and not exportable, no credentials for wallets with
software keys, PIN or biometrics at every presentation, a consent screen showing attributes one by one with an over-asking
warning, a separate copy per verifier, the presentation log kept on the device, no recovery keys held, revocation by version.

**What it needs.** Device attestation (Apple App Attest, Android key attestation), an attestation signing key (published in the
list of lists), a wallet solution declaration, the conformance tests and the wallet provider agreement.

## 8. Person (holder)

**What they do.** Carry their credentials in their wallet and decide for themselves to whom, and which attributes, to show.

**Rights and obligations.** Annex B §8 (RB-H-01…07): participation is voluntary and consent can be withdrawn at any time; at
every presentation the person sees the requested attributes and approves them one by one; the presentation log stays on the
device; there is no global identifier; the person can object to the "your credential was added to a wallet" notice; the person
is responsible for the PIN and device security; complaints go to the issuer, the scheme owner and the KVKK authority.

**What they need.** A phone with secure hardware and a wallet that follows the rules.

## 9. State

**What it does.** Is the sole author of its national trusted list and registers; takes over the registrar role and list
operation; runs the national root certificate; appoints the PID Provider. Once the council is formed, admission of members,
shared credential types and protocol upgrades are decided by a two-thirds vote. Cross-border recognition is unilateral.

**Who today.** No state has joined yet; a place is reserved for the members and observers of the Organization of Turkic
States. Today Tamga runs the Türkiye list provisionally on behalf of the state.

**Rules.** Annex A §1.6 (governing bodies), §3.3 (states joining and leaving), §7 (hand-over plan); main document §8.

**What it needs.** A public body to act as list operator, a root certificate ceremony, signing keys and publication
infrastructure. No hand-over invalidates any credential, entry or identifier.

## 10. Auditor

**What it does.** Assesses whether participants follow the rules: conformity assessment (in advance for I3 and qualified
credentials), audits on complaint or incident, and the annual independent audit.

**Who today.** Today conformance is shown through self-declaration and the open conformance tests; Tamga is the scheme owner and
the provisional accreditation body. When states join, the national accreditation body and independent conformity assessment
bodies follow (Annex A §4.2).

**Rules.** Annex A §4 (compliance regime, ISO/IEC 17000 roles, conformance tests, supervision, sanctions ladder, incident
response); Annex B §10 (RB-ENF).

**What it needs.** The conformance test vectors, the change log, transparency reports, the incident record and the rule sources
(Annex E §3).

## Status

**Active** — version 1.0.0 (2 October 2026).
