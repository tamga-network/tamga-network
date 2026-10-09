---
title: "Architecture and Reference Framework"
translation_of: FW-ARF-0001
source_version: 1.0.0
outline: [2, 3]
---

# Architecture and Reference Framework

<div class="arf-meta">

**Document** FW-ARF-0001 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-07 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The main document of the Tamga Network Architecture and Reference Framework. It follows the structure of the European
Union's EUDI [[t:ARF]]: use cases, roles, architecture, data model, trust model, security and governance. The binding rules are
in the annexes (A [[t:trust-framework|Trust Framework]], B Tamga [[t:rulebook|Rulebook]], C the credential-type rulebooks); terms are in Annex D and references in
Annex E.

## 1. Introduction

### 1.1 Purpose and scope

Tamga Network is a digital trust infrastructure for the Turkic world. The credentials that institutions (universities,
professional bodies, public bodies, companies) give to people are issued as electronic attestations of attributes, carried
in the person's wallet, and verified by third parties in seconds without asking the source.

This document is the architectural reference for an institution, regulator or integrator taking part in the Tamga
ecosystem. It describes who takes part in which role, where trust comes from, in which formats credentials are carried,
and through which flows they are issued and presented. Technical detail (data structures, protocol profiles, interfaces)
is in the developer documentation.

The document makes no decisions of its own. Architecture decisions are taken in decision records and technical rules in
specifications; this document and its annexes bring them together in one place a participant can read.

### 1.2 Audience

This framework is written for issuing and verifying institutions, wallet providers, states and regulators, auditors and
integrators. Which chapters to read, and in which order, for your role is on the **Reading path** page ([[FW-READ-0001]]);
the roles in detail are on the **Roles** page ([[FW-ROLE-0001]]) and the steps of joining on the **Onboarding** page
([[FW-ONB-0001]]).

### 1.3 Structure

Like the EU ARF, Tamga ARF consists of a main document and annexes:

| Document                          | Contents                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main document (this document)     | Use cases, roles, architecture, data model, trust model, security, governance                                                                                                               |
| Annex A — Trust Framework         | Governance, onboarding gates, compliance, agreements, hand-over plan                                                                                                                        |
| Annex B — Tamga Rulebook          | Common, numbered and binding rules for all participants and credential types                                                                                                                |
| Annex C — Rulebooks               | Credential-type rules that branch from the Tamga Rulebook: Education Rulebook (student certificate, diploma), Identity Rulebook (identity credential), Event Ticket Rulebook (event ticket) |
| Annex D — Definitions             | Terms and abbreviations                                                                                                                                                                     |
| Annex E — References              | Standards, decision records, specifications and rule sources                                                                                                                                |
| Reading path · Roles · Onboarding | Supporting pages: reading order per role, the roles in detail, the steps of joining                                                                                                         |

The Turkish text is the source; the English text is the official translation of the same version. The two languages are
always at the same version. MUST, MUST NOT, SHOULD and MAY in rules have their RFC 2119
meaning.

### 1.4 Relation to eIDAS 2.0 and the EU ARF

Tamga's technical layer is the same as the European Digital Identity Wallet ecosystem: the same [[t:credential]] formats, the
same protocols, the same trusted-list model and the same set of roles. The governance layer is written for the Turkic
world: each state is the sole owner of its own registers, and states work together by recognising each other.

"[[t:EUDI-Wallet]]" is the legal name of a wallet provided or recognised by an EU Member State and certified under EU rules. A
wallet from an organisation outside the EU cannot hold this title or use the EU trust mark. Tamga Wallet is therefore
described as an "EU-compatible wallet"; compatibility is shown through interoperability testing.

### 1.5 Positioning

Tamga is positioned in three layers, each able to stand on its own:

1. **Base — EU compatibility.** Credentials, protocols and trusted lists follow EU standards. Even if the network never
   grows, this layer is valuable to institutions and wallets.
2. **Tamga Network — a light trust [[t:federation]].** The network gathers national trusted lists and introduces them to each
   other; it recognises every [[t:wallet-provider]] that follows the published rules. Today Tamga operates the Türkiye list
   provisionally, on behalf of the state. As states join, the lists are handed over, a governance body is formed and a
   shared ledger follows.
3. **On top of the network.** Wallets and service providers that follow the network's rules. Tamga Wallet is the
   network's first wallet; it is a company's separate product and works in any EU-compatible setting. Tamga Network sells no
   services: it runs the rules, the trust lists, open code and reference services (hosted issuance, the Institution Console, the
   hosted [[t:verifier]] Tamga Verify); commercial services such as integration, support and consulting are offered by companies
   outside the network, under their own names ([[ADR-0037]]).

### 1.6 Principles

| #   | Principle                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Each state is the sole author of its own national registers. Once the council is formed, network membership is by a two-thirds vote of member states; until then the provisional operator governs (§8.3). Cross-border recognition is unilateral. |
| P2  | No shared register holds personal data: there is no credential content or credential digest in the trusted list, the anchor log, the ledger or logs.                                                                                              |
| P3  | The technical layer is the same as the EU standards; every Tamga-specific addition uses a standard extension point.                                                                                                                               |
| P4  | No identifier, role or structure assumes a single operator; every state role Tamga holds is designed to be handed over.                                                                                                                           |
| P5  | The shared ledger is a choice of signers, not of storage: today trust comes from signed lists; the ledger is set up once there are at least two independent operators.                                                                            |
| P6  | Every credential is bound to a key in the device's secure area; it cannot be copied or transferred.                                                                                                                                               |
| P7  | Every power that code cannot limit (hosting, domain names, record keeping, statistics) is limited by policy, measurable hand-over thresholds and a transparency report.                                                                           |

### 1.7 Out of scope

Out of scope in this version: issuing person identification data ([[t:PID]]; this role is reserved for the state), payments
and value transfer, an organisational wallet in which institutions hold credentials, a second representation in W3C
VCDM/JSON-LD, and qualified electronic signatures. These are on the roadmap and are opened by separate decisions.

---

## 2. Use cases and functionality

### 2.1 Obtaining a credential

A person obtains a credential in one of two ways:

- **Issuer-initiated issuance.** The institution creates an offer and gives it to the person as a QR code or a link. The
  person scans it with the wallet; the offer is single-use and, where needed, protected by a transaction code sent over a
  separate channel.
- **Wallet-initiated issuance.** The person selects the institution in the wallet and requests the credential. The
  institution matches the person through a presentation of the verified identity credential in the wallet and reads the
  data from its own system (the [[t:authentic-source]]) at signing time. Personal data is not stored at Tamga.

In both cases the wallet presents a wallet instance [[t:attestation]] ([[t:WIA]]) signed by its wallet provider; the institution issues only to
wallets of providers recognised in the trusted list. Credentials are issued as a batch of copies; the wallet shows a
separate copy to each verifier. Under the conditions the institution declares, the wallet renews the copies without
asking the user.

### 2.2 Remote presentation

A verifier (an employer, a website, an institution) requests a credential from the wallet. The request is signed and
carries the verifier's registered identity. The wallet checks the verifier's entry in the trusted list and its
[[t:registration-certificate]], shows the requested fields and the purpose to the person, and warns if more fields are requested
than the registration allows. The person approves with a PIN or biometrics; the response is encrypted and contains only the
approved fields.

A verifier may run its own verification software or use Tamga Verify (the hosted verifier). Presentation happens through a
wallet link (same device) or across devices through a QR code. For presentation through the browser (Digital Credentials API)
the verifier is ready; the wallet connection does not exist yet.

### 2.3 In-person presentation

At gates, campus entrances or service counters, the credential is shown at close range. The long-term solution is the
Bluetooth proximity flow of ISO/IEC 18013-5. This flow is implemented and awaits device testing; until it goes live,
short-lived access passes with a limited scope are used.

### 2.4 Website sign-in

With "Sign in with Tamga", a website receives at sign-up only the fields it is allowed (for example the given and family
name). The account key is a site-specific [[t:pseudonym]]: two different sites cannot link the same person. Because the
pseudonym is derived from the identity, the same pseudonyms return when the person changes phone and verifies their identity
again. Daily sign-in uses a passkey and shares no credential fields.

### 2.5 Tickets and gates

An event ticket arrives in the wallet without personal data. At the gate the ticket is single-use: the first entry consumes
it and a second use of the same ticket is refused.

### 2.6 Age verification with a zero-knowledge proof

A person can prove "I am over 18" without showing the date of birth or the identity number. The wallet produces a
zero-knowledge proof about the credential the institution signed, without changing that credential. The verifier accepts
only proof circuits published in the trusted list. The verifier side is live. The wallet side is wired to the network's open
prover package; the Android native library is ready, the iOS library is pending; device testing comes with the app-store
release. Where proofs are not supported, the presentation is made in the usual way.

### 2.7 The person's control

- **History.** The person sees in the wallet which credential was shown to whom, when and with which fields. The history
  stays on the device and leaves it only in a password-protected file the person creates.
- **Deletion.** By resetting the wallet the person deletes their record in Tamga's identity service, the unit record at the
  [[t:wallet-provider]] (with the organisation that offers the wallet) and all data on the device.
- **Erasure requests and complaints.** The person can ask an institution from the wallet to delete their data, and finds
  in the wallet the way to complain to the verifier's data protection authority.

### 2.8 Status of the functions

| Function                                                                         | Status                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Issuer- and wallet-initiated issuance, remote presentation, Tamga Verify         | Live                                                   |
| Website sign-in, per-site pseudonyms                                             | Live                                                   |
| Tickets and single-use gate entry                                                | Live                                                   |
| Data deletion, history, export                                                   | Live                                                   |
| Zero-knowledge proof — verifier side                                             | Live                                                   |
| Zero-knowledge proof — wallet side                                               | Wired to the wallet; Android native library ready, iOS pending; device testing with the app-store release |
| Bluetooth proximity presentation                                                 | Implemented; device testing pending                    |
| Browser presentation (Digital Credentials API)                                   | Verifier ready; no wallet connection yet               |
| Hardware-backed keys and device attestation                                      | Implemented; device testing with the app-store release |
| Sandbox (open to everyone; identity verification with daily/monthly caps)       | Live                                                   |

---

## 3. Roles

The set of roles comes from the EU ARF. Each national list reserves a place for each of these roles; the place exists even
when empty. The state roles Tamga holds today are provisional and carried out on behalf of the state.

| Role (EU name)                                     | Definition                                                                                    | Today                                                                                                                                             | When the state joins                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Trusted List Scheme Operator                       | Compiles, signs and publishes the national trusted list                                       | Tamga, provisionally on behalf of the state                                                                                                       | The national authority or a body it designates     |
| Registrar                                          | Registers issuers, verifiers and wallet providers; grants no legal authority                  | Tamga, provisionally                                                                                                                              | The state registrar                                |
| National root certification authority              | The root of institutional certificates                                                        | Tamga, provisionally; the root identifier does not change at hand-over                                                                            | The state root or a qualified certificate provider |
| Access and registration certificate provider       | Issues access and registration certificates to verifiers                                      | Tamga, provisionally                                                                                                                              | The state                                          |
| Person Identification Data Provider (PID Provider) | Issues person identity data at the highest assurance level                                    | Empty; Tamga does not take this role                                                                                                              | The state                                          |
| Provisional identity credential provider           | Issues an identity credential after remote identity verification while no PID Provider exists | The Tamga identity service                                                                                                                        | Taken over by the PID Provider                     |
| Attestation Provider                               | Issues electronic attestations of attributes                                                  | Universities, ticket sellers                                                                                                                      | Institutions and public bodies                     |
| Authentic Source                                   | The system that owns the data                                                                 | The institution's own system                                                                                                                      | The same, plus public sources                      |
| Wallet Provider                                    | Provides the wallet; signs wallet instance attestations and key attestations                  | The organisation that offers the wallet (the first is Tamga Wallet; a separate product). The network does not run wallet providers; it lists them | Every provider that follows the rules              |
| Relying Party                                      | Requests and verifies credentials; registered and limited in scope                            | Employers, websites, institutions                                                                                                                 | The same                                           |
| Intermediary                                       | Requests and verifies credentials on behalf of a relying party                                | Tamga Verify                                                                                                                                      | The same                                           |
| Holder                                             | Carries the credential in the wallet and decides whom to show it to                           | Students, graduates, users                                                                                                                        | Citizens                                           |
| Ledger operator                                    | Runs a node of the shared ledger                                                              | None                                                                                                                                              | At least two independent institutions              |

Separation rule: Tamga does not hold institutions' signing keys in any service it hosts. Even when the issuing service runs
at Tamga, the signing key of the credential belongs to the institution. What each role does, its obligations and what it
needs are on the **Roles** page ([[FW-ROLE-0001]]).

---

## 4. Architecture

### 4.1 Components

| Component                 | Task                                                                                                     | Owner                                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wallet                    | Holds and presents the person's credentials; manages history and pseudonyms                              | The organisation that offers the wallet; the network's first wallet is Tamga Wallet (a separate, open-source product)                                                                                                    |
| Wallet provider           | Registers wallet units; signs wallet instance attestations and key attestations                          | The organisation that offers the wallet; the network does not run it but lists it in the trusted list (Tamga Wallet's provider is run by the wallet's operator at `provider.tamgawallet.com`) |
| Issuing service           | Issues credentials with OpenID4VCI on behalf of institutions; publishes revocation lists                 | Hosted service (an institution may run its own)                                                                                                                                                                          |
| Institution Console       | Where institution staff manage credentials, records, API keys and users                                  | Hosted service                                                                                                                                                                                                           |
| Identity service          | Issues the provisional identity credential; derives the pseudonym seed                                   | Tamga, provisionally                                                                                                                                                                                                     |
| Tamga Verify              | Requests and verifies credentials on behalf of relying parties                                           | Hosted service (a relying party may run its own software)                                                                                                                                                                |
| Trusted-list publisher    | Signs and publishes the list of lists, the national list and the anchor log                              | Tamga, provisionally                                                                                                                                                                                                     |
| Credential type catalogue | Publishes credential type definitions and schemas as immutable files                                     | Tamga                                                                                                                                                                                                                    |
| Open-source packages      | Libraries for credential formats, reading trusted lists, issuing and verifying                           | Tamga (Apache-2.0)                                                                                                                                                                                                       |
| Sandbox                   | The single test network, running under the same rules as the real network; it has its own root and lists | Tamga                                                                                                                                                                                                                    |

The libraries are open; the hosted services are run by the operator. An institution can build its own issuing or
verification software with the packages; the rules are the same.

The network does not run any wallet's app, wallet provider or website; it recognises wallets through the wallet provider
entries in the trusted list. There is a single sandbox and it belongs to the network: wallet, institution and relying party
developers try the network's rules there. In the sandbox too the wallet runs its own wallet provider; a wallet developer has
their provider registered in the sandbox list and tests the wallet against the sandbox's sample institutions, identity
service and verifier.

### 4.2 Service addresses

| Address                              | Service                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `tamga.network`                      | Website; root key fingerprints on the `/trust-anchor` page                                                      |
| `arf.tamga.network`                  | This framework and its annexes                                                                                  |
| `docs.tamga.network`                 | Developer documentation                                                                                         |
| `trust.tamga.network`                | Trusted lists, anchor log, archive                                                                              |
| `schemas.tamga.network`              | Credential type catalogue                                                                                       |
| `issuer.tamga.network/{institution}` | Hosted issuing service                                                                                          |
| `status.tamga.network`               | Revocation (status) lists                                                                                       |
| `console.tamga.network`              | Institution Console                                                                                             |
| `verify.tamga.network`               | Tamga Verify                                                                                                    |
| `id.tamga.network`                   | Identity service                                                                                                |
| `*.sandbox.tamga.network`            | Sandbox: test copies of the same services (`trust.sandbox`, `issuer.sandbox`, `verify.sandbox`, `id.sandbox` …) |

Only the network's own services run on the network's domains; the network operates no wallet provider. Each wallet's provider
is operated by the organisation that offers the wallet, on its own domain (Tamga Wallet's is `provider.tamgawallet.com`); the
network lists it in the trust list.

A domain name is the address of a service, not an identity. When an institution moves to its own domain, the address in
its entry changes; the institution's identifier and the credentials it issued do not.

### 4.3 Issuance flow

1. The institution creates an offer, or the person requests the credential from the wallet.
2. The wallet requests authorisation, adding the transaction code or an identity credential presentation where needed.
3. The wallet sends the keys the credential will be bound to, its wallet instance attestation and its key attestation.
4. The issuing service checks these attestations against the trusted list and the content against the catalogue
   schema, signs the credential with the institution's key, and reserves a position in the [[t:revocation]] list for each copy.
5. The person receives a notice: "your credential was added to a wallet; tell us if this was not you".

### 4.4 Presentation and verification flow

1. The verifier creates a signed request carrying its registered identity, the requested fields and a single-use value.
2. The wallet checks the verifier's registration, shows the request to the person and obtains consent.
3. The wallet sends the copy of the credential belonging to this verifier, with a device signature bound to this request.
4. The verifier runs the verification pipeline below and returns one of three results: accepted, rejected or "cannot be
   verified right now".

| Step         | Check                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Precondition | Is the trusted list fresh; if not, the result is "cannot be verified"                                                                            |
| Structure    | Does the signature chain reach the root certificate, do the disclosed fields match the credential, is the device signature bound to this request |
| Type         | Does the credential type match the catalogue definition and schema                                                                               |
| Trust        | Was the institution active in the list on the date the credential was issued, and was it authorised to issue this type                           |
| Status       | Has the credential been revoked or suspended                                                                                                     |
| Policy       | Do the credential type and institution class meet the verifier's policy, and are the requested fields within its registration                    |

"Cannot be verified right now" is never shown as "invalid". An institution's authority to issue is assessed at the date the
credential was issued: credentials issued earlier by an institution that has since closed remain valid.

### 4.5 Direction rules

1. Only the trusted-list publisher writes to the trusted lists; issuing services only send anchor requests.
2. Verifiers and wallets read trust data according to the verification rules in the specification: no list entry is used
   without checking the signature, the version chain and freshness. The open-source packages implement these rules.
3. A verifier does not download revocation lists at each verification; lists are fetched in bulk beforehand.
4. No Tamga service records IP addresses; records contain neither credential field values nor revocation list positions.

---

## 5. Data model

### 5.1 Credential formats

| Format               | Use                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| SD-JWT VC            | All credential types. Selective disclosure, binding to a device key, reference to a revocation list    |
| ISO/IEC 18013-5 mdoc | Second representation of the identity credential; for proximity presentation and zero-knowledge proofs |

The signature algorithm is ES256 (P-256) and the institution's certificate chain travels with the credential. Every
credential is bound to a key on the device; a binding proof signed with this key is mandatory at presentation. Copies are
bound to separate keys. The national identity number appears in no credential type other than the identity credential.

### 5.2 Credential types and the catalogue

Each credential type has a permanent identifier (`urn:tamga:<domain>:<Type>:<major version>`). Display names, fields and the
[[t:selective-disclosure]] policy are in the type definition (Type Metadata); data rules are in a JSON Schema. Published
definition files never change; the credential carries the digest of its definition and the verifier compares it with the
catalogue.

Current types: student certificate, diploma, Tamga identity credential, e-mail and phone credentials, event ticket, and the
pseudonym seed (which stays in the wallet and is never shown to any verifier).

### 5.3 Identifiers

| Identifier                      | How it is formed                                                                             | When it changes                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Root certificate identifier     | From the country code and the root certificate fingerprint                                   | If the root changes                                                                      |
| Institution identifier          | From the country code and the institution certificate fingerprint                            | When the certificate is renewed; the new entry is linked to the old one as its successor |
| Credential type identifier      | `urn:tamga:…`                                                                                | Only when the major version changes                                                      |
| Verifier client identifier      | Digest of the access certificate (`x509_hash`)                                               | When the certificate is renewed                                                          |
| Verifier permanent registration | Domain name (`dns_name`)                                                                     | Never; pseudonyms and copies are tied to it                                              |
| Person                          | No global identifier; a device key per credential, a copy per verifier, a pseudonym per site | —                                                                                        |

### 5.4 Revocation and status

Credential status is published with the IETF Token [[t:status-list|Status List]]. List addresses do not reveal the institution, year or
student group; a credential's position in the list is random. Lists are published at fixed intervals, even without
changes, so the moment of revocation does not leak. In the pilot the interval is 60 minutes (2 minutes in today's trial operation; moving to the pilot value awaits a project
management decision); a revocation takes effect at
verifiers within 90 minutes at most.

---

## 6. Trust model

### 6.1 The list of lists and national lists

Trust comes from signed lists. The structure is the same as in the EU:

- The **list of lists** shows the address, signer and recognition status of each national list. Network-wide credential
  types, recognised wallet providers and accepted zero-knowledge proof circuits are also listed here.
- A **national list** carries that country's root certificates, its issuers (their class, assurance level and the types
  they are authorised to issue) and its registered verifiers.

Wallets and verifiers trust one thing: the root key that signs the list of lists. The root key fingerprints are published
with the same values on the `tamga.network/trust-anchor` page, on the trusted-list site and in the participation
agreements.

### 6.2 Federation

Tamga Network does not have to own a national list. Today Tamga publishes the Türkiye list provisionally, on behalf of the
state. When a state, or a body it designates, publishes its own list, the list of lists shows that list's address and
signer. For wallets and verifiers only the address and the signer change; institution identifiers, credential types and
credentials stay the same. The same path applies to every Turkic state. Mutual recognition with the EU uses the same
mechanism, limited in scope by credential type.

A list operated by someone else appears in the list of lists with its address, its pinned signer, its scope and its approval
record. It can vouch only for the roles and credential types in its scope, and a list whose signer does not match is not
loaded. The freshness of each external list is tracked separately: if one cannot be checked, the others are not affected.
Whether to trust a given external list is decided separately for each list. The rules are in Annex A.

### 6.3 List rules

- Lists are versioned and carry the digest of the previous version; entries are never deleted, status changes are added
  to the history.
- The next update is at most 90 days ahead; a change is published within 24 hours.
- A list is signed with at least two rolling certificates.
- An anchor log signed every hour records revocation list publications and the digests of credential type definitions.
- A public change log shows who changed what and when.

### 6.4 Registration

- **Issuers** pass the onboarding gates (Annex A): registered, contracted and accredited levels. Authority is granted
  separately for each credential type and is off by default.
- **Relying parties** apply with the EU common registration data set: legal name, identification number, address,
  contact, the purpose and privacy policy for each intended use, and the data protection authority. Only legal persons
  register. The registrar issues a registration certificate valid for at most 12 months for each intended use; the wallet
  compares the requested fields with this certificate.
- **Wallet providers** declare their wallet solution (platforms, security level, PIN and biometrics, backup model) and pass
  the [[t:conformance]] tests. Tamga Network recognises a wallet by the published rules, not by its name.

### 6.5 Assurance levels

| Axis                            | Levels                                                                            | Where it appears                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Identity proofing of the person | T0 anonymous · T1 low · T2 substantial · T3 high (eIDAS Low / Substantial / High) | Not in the credential; it is a precondition of the credential type               |
| Accreditation of the issuer     | I1 registered · I2 contracted · I3 accredited · PUB public                        | In the trusted list; for qualified and public credentials also in the credential |
| Wallet security                 | W1 software (not supported) · W2 device secure area · W3 certified secure element | In the wallet attestation                                                        |

A verifier's decision rests on the combination of credential type and [[t:issuer]] class; there is no separate "person assurance
level" field.

### 6.6 Known limitation

Today the [[t:trust-anchor]] is the signature of a single operator. If the operator and an issuer acted together, an
inconsistent entry could be published; the public log, the transparency report and audits deter this but cannot make it
impossible. This limitation is removed by the shared ledger and multiple independent signers.

---

## 7. Certification, security and risk

### 7.1 Wallet security

A [[t:wallet-unit]] registers with its wallet provider. For each transaction it receives a wallet instance attestation (WIA)
valid for at most 24 hours and a separate [[t:key-attestation]] (KA) describing the credential keys. Before issuance, the issuer
checks these attestations against the provider in the trusted list. Keys are kept in the device's secure area and supported by
device attestation (Apple App Attest, Android key attestation). No credentials are issued to wallets with software keys.

### 7.2 Privacy measures

1. Shared registers hold no personal data; records contain no field values and no revocation list positions.
2. Credentials are issued as copies and each verifier sees a separate copy; websites know the person by a pseudonym.
3. Zero-knowledge proofs prevent different presentations of the same credential from being linked.
4. Revocation lists are published at fixed intervals; the moment of revocation does not leak.
5. Every presentation requires a PIN or biometrics; over-asking is shown to the person.
6. In identity verification, document and face images are not stored at Tamga.
7. Usage statistics are published only in aggregate and in groups of at least 50.

### 7.3 Conformance and certification

Today conformance is shown with open conformance test vectors and tests that are mandatory before each release. When states
join, independent conformity assessment bodies and national certification follow. What is tested for each role, and how it is
shown, is in Annex A §4.3. Interoperability with the EU is
shown at EU interoperability events and with the OpenID conformance tests.

### 7.4 Known limits and residual risks

| #   | Limit                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| L1  | The trust anchor today rests on a single operator's signature (§6.6).                                                              |
| L2  | A revocation takes effect within about 90 minutes at most.                                                                         |
| L3  | If credentials from the same issuer are combined across verifiers, a person can be linked; zero-knowledge proofs remove this risk. |
| L4  | When changing device, credentials are obtained again; an approved transfer design is open.                                         |

---

## 8. Governance and evolution

### 8.1 Phases

| Phase                | Trust anchor                    | Governed by                               | Entry condition                                                             |
| -------------------- | ------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| List stage (today)   | Signed lists and the anchor log | Tamga, provisional operator               | —                                                                           |
| Ledger stage         | Shared ledger                   | The first operators                       | Written acceptance of at least two independent operators; equivalence tests |
| States join          | Shared ledger                   | The council of member states (two-thirds) | The first state operator in production                                      |
| Institutional growth | Shared ledger                   | The council                               | Thresholds set by the council                                               |

### 8.2 Moving to the shared ledger

The list archive is carried over to the shared ledger as it is. The list and the ledger give the same answers to the same
conformance tests. Institution identifiers, credential types and credentials do not change; at hand-over only the operator
changes. Wallets and verifiers only change the implementation of the trust source.

### 8.3 Governance body

The governance body is not set up on day one. When one or two states are willing to join, a council or foundation is formed
and the lists are handed over. Until then Tamga is the provisional operator; once the foundation is formed, operation is handed
over to it. Tamga Network is not-for-profit; its operation will later be handed over to a foundation. The network sells no
product and offers no commercial services; Tamga Wallet is the network's first wallet, a company's separate product; service providers sit outside the network and join the
registration process on the same terms as everyone else ([[ADR-0037]]).

### 8.4 Standards map

| Area                                       | Standard                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Trusted lists                              | ETSI TS 119 612, ETSI TS 119 602                                            |
| Institutional identity                     | X.509 (RFC 5280), ETSI EN 319 401                                           |
| Issuer policy                              | ETSI TS 119 471                                                             |
| Credential format                          | IETF SD-JWT VC, ETSI TS 119 472-1, ISO/IEC 18013-5                          |
| Issuance                                   | OpenID4VCI 1.0, HAIP 1.0, ETSI TS 119 472-3                                 |
| Presentation                               | OpenID4VP 1.0, DCQL, HAIP 1.0, ISO/IEC 18013-7, W3C Digital Credentials API |
| Proximity                                  | ISO/IEC 18013-5 (Bluetooth)                                                 |
| Revocation                                 | IETF Token Status List                                                      |
| Identity proofing                          | ETSI TS 119 461                                                             |
| Registration and registration certificates | EU Commission Implementing Regulation (CIR) 2025/848, ETSI TS 119 475       |
| Zero-knowledge proofs                      | Longfellow ZK (mdoc)                                                        |
| Education semantics                        | ELM 3 / Europass, ISCED-F, EQF                                              |

The full list of references is in Annex E.

## Status

**Active** — version 1.0.0 (2 October 2026).
