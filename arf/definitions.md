---
title: "Annex D — Definitions"
translation_of: FW-DEF-0001
source_version: 1.0.0
outline: [2, 3]
---

# Annex D — Definitions

<div class="arf-meta">

**Document** FW-DEF-0001 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-02 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

Definitions of the terms and abbreviations used in Tamga [[t:ARF]]. This is the counterpart of the definitions annex of the EU
ARF; the EU name and the Tamga equivalent are given together.

## 1. Terms

| Term                                                   | Definition                                                                                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Access certificate                                     | The X.509 certificate a relying party signs its requests with; the client identifier is the digest of this certificate.                                                                                                  |
| Access pass                                            | A short-lived, limited-scope credential presentation used until the long-term proximity solution is available.                                                                                                           |
| Anchor log                                             | A public log that records revocation list publications and credential type definition digests in entries signed every hour.                                                                                              |
| Assurance level                                        | The level of the person's identity proofing (T), the issuer's accreditation (I) and the wallet's security (W).                                                                                                           |
| Attestation Provider                                   | The institution that issues credentials: a university, professional body, public body or company.                                                                                                                        |
| Authentic Source                                       | The system that owns the data in a credential, for example a university's student information system.                                                                                                                    |
| Copy                                                   | One of the instances of the same credential bound to separate keys; the wallet shows a separate copy to each verifier.                                                                                                   |
| Credential (electronic attestation of attributes, EAA) | A credential an issuer signs about a person and the person carries in the wallet: a student certificate, a diploma, a ticket.                                                                                            |
| Credential type                                        | A definition with a permanent identifier (`urn:tamga:…`) describing a credential's attributes, display names and selective disclosure policy.                                                                            |
| Credential type catalogue                              | Where credential type definitions and schemas are published as immutable files (`schemas.tamga.network`).                                                                                                                |
| Device attestation                                     | A signed statement by the phone's operating system that a key was generated in the device's secure area and the app is unmodified (Apple App Attest, Android key attestation).                                           |
| Federation                                             | The model in which national trusted lists are run by their owners and brought together in the list of lists.                                                                                                             |
| Governance body                                        | The council or foundation formed when states join; it governs the lists and the network rules.                                                                                                                           |
| Holder                                                 | The person who carries the credential in the wallet and decides whom to show it to.                                                                                                                                      |
| Identity credential (Tamga)                            | The provisional identity credential the Tamga identity service issues after remote identity verification while there is no PID Provider. It is not PID.                                                                  |
| Intermediary                                           | A service that requests and verifies credentials from the wallet on behalf of a relying party. The wallet shows the name of the actual relying party. In Tamga: Tamga Verify.                                            |
| Key attestation (KA)                                   | A short-lived signed statement by the wallet provider that the keys a credential will be bound to were generated and are protected in the device's secure hardware; the issuer checks it before issuing.                 |
| Ledger stage                                           | The stage in which trust records move to a shared ledger kept by several independent operators. It starts once at least two independent operators have given written acceptance.                                         |
| List of lists (LoTL)                                   | A signed list showing the addresses, signers and recognition status of the national trusted lists.                                                                                                                       |
| List stage                                             | Today's stage, in which trust rests on signed trusted lists and the anchor log.                                                                                                                                          |
| Person identification data (PID)                       | Person identity data issued by the state at the highest assurance level. Tamga does not take this role.                                                                                                                  |
| Provisional operator                                   | The body that operates the network until the governance body is formed: today Tamga. Once the foundation is formed, operation is handed over to it.                                                                      |
| Pseudonym                                              | An account identifier the wallet produces separately for each website: stable, but impossible to link across sites.                                                                                                      |
| Pseudonym seed                                         | A secret value the identity service derives from the person's identity without storing it, kept only in the wallet; pseudonyms are derived from it. It is issued as a separate credential type that cannot be presented. |
| Registrar                                              | The body that registers issuers, relying parties and wallet providers; it grants no legal authority.                                                                                                                     |
| Registration certificate                               | A signed document the registrar produces for each intended use of a relying party (for issuers, one per institution), carrying the attributes that may be requested and the purpose (at most 12 months).                 |
| Relying Party                                          | A registered organisation that requests and verifies credentials from the wallet: an employer, a website, an institution.                                                                                                |
| Selective disclosure                                   | Showing only the requested attributes of a credential.                                                                                                                                                                   |
| Shared ledger                                          | A ledger (blockchain) in which trust records are kept by several independent operators. It is set up in the ledger stage.                                                                                                |
| Tamga Network                                          | The trust network this framework defines: rules, trusted lists, the credential type catalogue and open-source packages. The network sells no product.                                                                    |
| Tamga Verify                                           | The network's hosted verifier (an intermediary).                                                                                                                                                                         |
| Tamga Wallet                                           | The network's first wallet; a separate, open-source product. It follows the network's rules like any other wallet.                                                                                                       |
| Trusted list                                           | A signed list carrying a country's root certificates, issuers and registered relying parties.                                                                                                                            |
| Trusted List Scheme Operator                           | The body that compiles, signs and publishes the national trusted list. Today, for Türkiye, Tamga — provisionally, on behalf of the state.                                                                                |
| Verification pipeline                                  | The fixed steps in which a verifier checks a presentation: precondition, structure, type, trust, status, policy. The result is accepted, rejected or "cannot be verified right now".                                     |
| Wallet                                                 | The app that holds and presents the person's credentials. Every wallet that follows the network's rules can be used in the network; Tamga Wallet is the network's first wallet.                                          |
| Wallet instance attestation (WIA)                      | A statement signed by the wallet provider for a wallet unit and valid for at most 24 hours: the wallet version, that the key is in hardware, that PIN or biometrics are active. The issuer checks it before issuing.     |
| Wallet Provider                                        | The organisation that provides the wallet, registers wallet units and signs wallet instance attestations and key attestations.                                                                                           |
| Wallet unit                                            | An installation of a wallet on a particular device.                                                                                                                                                                      |
| Zero-knowledge proof                                   | A proof that a statement is true without revealing the data itself; for example "I am over 18" without showing the date of birth.                                                                                        |

## 2. Abbreviations

| Abbreviation  | Meaning                                                     |
| ------------- | ----------------------------------------------------------- |
| ARF           | Architecture and Reference Framework                        |
| DCQL          | Digital Credentials Query Language                          |
| EAA           | Electronic Attestation of Attributes                        |
| EUDI          | European Digital Identity                                   |
| HAIP          | OpenID4VC High Assurance Interoperability Profile           |
| KA            | Key Attestation                                             |
| KVKK          | Turkish Personal Data Protection Law No. 6698               |
| LoTL          | List of Trusted Lists                                       |
| mdoc          | ISO/IEC 18013-5 mobile document format                      |
| OTS           | Organization of Turkic States                               |
| PID           | Person Identification Data                                  |
| SD-JWT VC     | Selective Disclosure JWT Verifiable Credential              |
| WIA           | Wallet Instance Attestation                                 |
| WRPAC / WRPRC | Relying party access certificate / registration certificate |
| WSCD          | Wallet Secure Cryptographic Device                          |

## Status

**Active** — version 1.0.0 (2 October 2026).
