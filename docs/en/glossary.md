---
document_id: GLOSSARY
title: "Glossary"
status: Active
version: 1.0.0
last_updated: 2026-10-02
created: 2026-10-02
summary: >
  Plain explanations of the terms used in the Tamga Network documentation. The binding definitions are in Tamga ARF Annex D.
translation_of: GLOSSARY
source_version: 1.0.0
---

# Glossary

This page explains the terms used in the documentation in plain language; the binding definitions are in Tamga ARF Annex D
([[FW-DEF-0001]]), which prevails in case of conflict.

Terms marked with ⓘ across the documentation open a short explanation when you hover over them (or tap them on a phone). This
page gathers the same terms in reading order.

<!-- TERMS:BEGIN — docs/.vitepress/terms.json'dan üretilir (npm run docs:sync); bu işaretler arasını elle düzenlemeyin -->

## Core ideas

**ARF** (Architecture and Reference Framework) — The document set that describes roles, architecture, trust model and rules. Tamga ARF follows the structure of the EU ARF.

**Conformance** — Proof that an implementation follows the rules, shown by passing the published test vectors and checks.

**eIDAS** (electronic IDentification, Authentication and trust Services) — The EU regulation on electronic identification and trust services; eIDAS 2.0 introduces the European Digital Identity Wallet.

**EUDI Wallet** — The European Digital Identity Wallet defined by eIDAS 2.0; Tamga uses the same formats and protocols.

**Federation** — A model in which each country runs its own trust list and a list of trusted lists brings them together; Tamga can also show external lists.

**Ledger** — A record of trust entries kept jointly by several independent operators (a permissioned blockchain). Tamga adds it only when at least two independent operators take part; until then signed trust lists do the job.

**OTS** (Organization of Turkic States) — The intergovernmental organisation of Turkic states; Tamga's governance leaves seats for its member states.

**Rulebook** — A set of binding rules. The Tamga Rulebook holds the rules for all participants; each credential type has its own rulebook that branches from it.

**Trust framework** — The governance part of the ARF: who may join, how onboarding and compliance work, agreements and hand-over to states.

**Validator** — An operator node that signs blocks in the permissioned ledger planned for the chain stage (Besu / QBFT).

## Roles

**Authentic source** — The system that actually owns the data in a credential, for example a university's student information system.

**Holder** — The person who keeps a credential in their wallet and decides whom to show it to.

**Intermediary** — A service that verifies credentials on behalf of a relying party; the wallet shows both the intermediary and the relying party it serves.

**Issuer** — The institution that signs and issues credentials: a university, a professional body, a public institution or a company.

**QTSP** (Qualified Trust Service Provider) — A trust service provider granted qualified status by a national supervisory body under eIDAS.

**Registrar** — The body that registers issuers and relying parties and checks their registration data before they enter the trust list.

**Relying party** — A registered organisation that requests credentials from wallets and verifies them: an employer, a website, an institution.

**RP** (Relying Party) — Short for relying party: the organisation that requests and verifies credentials.

**TLSO** (Trusted List Scheme Operator) — The organisation that compiles, signs and publishes a national trust list. Today Tamga does this for Türkiye, provisionally on behalf of the state.

**Verifier** — The party that checks a presented credential: signature, issuer in the trust list, status and policy. Also called relying party.

**Wallet provider** — The organisation that offers a wallet and signs wallet and key attestations. Tamga Wallet is the network's first wallet.

## Credentials

**Attestation** — A signed statement about a person or a thing that is carried in a wallet, such as a student certificate or a diploma.

**Batch issuance** — Issuing several single-use copies of the same credential at once, so that each verifier sees a different copy (unlinkability).

**Credential** — A digital document signed by an issuer and held in the person's wallet; the person shows only the fields that are asked for.

**Credential offer** — A message (usually a QR code or link) by which an issuer invites a wallet to collect a credential.

**EAA** (Electronic Attestation of Attributes) — The eIDAS term for a credential that attests attributes of a person, such as a degree or a membership.

**ECTS** (European Credit Transfer and Accumulation System) — The European system of study credits used to describe course workload.

**ELM** (European Learning Model) — The EU data model for describing learning achievements, qualifications and credits.

**ISCED-F** (International Standard Classification of Education: Fields) — UNESCO's classification of fields of education and training.

**Issuance** — The process by which an issuer delivers a credential into a holder's wallet (in Tamga: OpenID4VCI).

**mDL** (mobile Driving Licence) — A driving licence held in a wallet in the mdoc format (ISO/IEC 18013-5).

**Mdoc** — The ISO/IEC 18013-5 mobile document format, encoded in CBOR; used for in-person presentation and for the mobile driving licence.

**PID** (Person Identification Data) — The core identity data a state issues at the highest assurance level. Tamga does not take this role; its identity credential is not a PID.

**PuB-EAA** (Public-Body Electronic Attestation of Attributes) — An attestation issued by or on behalf of a public body responsible for an authentic source.

**QEAA** (Qualified Electronic Attestation of Attributes) — An EAA issued by a qualified trust service provider (QTSP); it has the strongest legal effect among attestations.

**Refresh token** — A long-lived token that lets the wallet obtain fresh credential copies without the holder repeating the whole issuance flow.

**Revocation** — Withdrawing a credential before it expires; the issuer marks it in a status list that verifiers check.

**Schema catalogue** — The published list of credential types (vct), their schemas and integrity digests (schemas.tamga.network).

**SD-JWT VC** (Selective Disclosure JWT Verifiable Credential) — The JSON-based credential format with selective disclosure, used for online presentation in the EUDI Wallet and in Tamga.

**Status list** — A compressed, signed list in which each credential has one position that tells whether it is valid, suspended or revoked.

**Vct** (Verifiable Credential Type) — The permanent identifier of a credential type in SD-JWT VC; in Tamga it is a URN such as urn:tamga:edu:Diploma:1.

## Presentation and privacy

**Accountable disclosure** — A design (chain stage, research) where an identity can be revealed only by a threshold of independent guardians under legal order.

**DCQL** (Digital Credentials Query Language) — The query language a verifier uses in OpenID4VP to say which credentials and which fields it needs.

**Disclosure** — In SD-JWT, one field value packed with a random salt; the holder hands over only the disclosures the verifier needs.

**Holder binding** — Tying a credential to a key that only the holder's device has, so a copied credential cannot be presented.

**KB-JWT** (Key Binding JWT) — A short token the wallet signs with the credential's key at presentation time, proving the holder has the key.

**Key binding** — Binding a credential to a key held by the holder's wallet, so that only that wallet can present it.

**Longfellow ZK** — An open zero-knowledge proof system for mdoc credentials; Tamga uses it to prove facts such as age over 18 without revealing the birth date.

**Nonce** — A random value used once; the verifier sends it and the wallet signs it, so an old presentation cannot be replayed.

**Proof of possession** — Proof that the presenter controls the private key a credential is bound to, by signing a fresh challenge.

**Pseudonym** — A stable account identifier the wallet derives separately for each website; two sites cannot link the same person.

**Salted hash** — A hash computed over a value together with a random salt, so the value cannot be guessed from the hash; SD-JWT hides fields this way.

**Selective disclosure** — Showing only the fields a verifier asks for from a credential, and nothing else.

**Transaction log** — The wallet's on-device record of issuances and presentations; only the holder can export it.

**Verification pipeline** — The fixed sequence of checks a verifier runs on a presentation: signature, issuer, trust list, status, holder binding, policy.

**ZK** (Zero-Knowledge proof) — A proof that a statement is true without revealing the underlying data, for example "over 18" without the birth date.

## Trust

**Access certificate** — The X.509 certificate a relying party signs its requests with; its client identifier is derived from this certificate's hash.

**Anchor log** — A public, append-only log of hashes of signed lists, so anyone can check that a list was not silently changed.

**Identity proofing** — Checking that a person really is who they claim to be before a credential is issued, for example with an ID card and a liveness check.

**LoA** (Level of Assurance) — How much confidence can be placed in an identity or a credential; Tamga uses separate levels for proofing (T), issuer (I) and wallet (W).

**LoTE** (List of Trusted Entities) — The ETSI TS 119 602 list format; Tamga publishes a LoTE view of its lists and can read external LoTE lists.

**LOTL** (List of Trusted Lists) — The signed list that points to the countries' trust lists, their signers and their recognition status.

**QES** (Qualified Electronic Signature) — An electronic signature made with a qualified certificate on a qualified device; legally equivalent to a handwritten signature in the EU.

**QSCD** (Qualified Signature Creation Device) — Certified hardware or a remote service that protects the signing key for qualified signatures.

**Registration certificate** — A signed statement from the registrar listing which fields a relying party may request and for what purpose (valid up to 12 months).

**root CA** — The top certificate authority whose key anchors a chain of certificates; in Tamga, pinned through the trust list.

**Trust anchor** — The root key or certificate a verifier trusts first; everything else is checked back to it.

**Trust list** — A signed list of a country's root certificates, issuers and registered relying parties. Today trust in Tamga rests on these lists; a shared ledger comes later.

**Trusted List** — The ETSI TS 119 612 format in which EU member states publish their qualified trust service providers.

**WRPAC** (Wallet-Relying Party Access Certificate) — The access certificate a relying party uses to sign its requests to wallets.

**WRPRC** (Wallet-Relying Party Registration Certificate) — The registration certificate that states which fields a relying party may request and why.

**x509_hash** — A client identifier scheme from HAIP: the identifier is the base64url SHA-256 hash of the relying party's access certificate.

## Wallet

**Device attestation** — Proof from the phone's operating system (App Attest, Play Integrity) that a genuine, unmodified app runs on a real device.

**Key attestation** — A short-lived statement by the wallet provider that a credential key was created and is kept in secure hardware.

**Passkey** — A phishing-resistant sign-in credential (WebAuthn/FIDO2) stored on the user's device.

**Wallet unit** — One installation of a wallet on a specific device.

**WIA** (Wallet Instance Attestation) — A short-lived statement signed by the wallet provider that a wallet installation is genuine; issuers check it before issuing.

**WUA** (Wallet Unit Attestation) — An attestation by the wallet provider about a wallet unit and the security of its keys; in the current EU texts it is split into WIA and key attestation.

## Standards and protocols

**DPoP** (Demonstrating Proof of Possession) — A way to bind an access token to a key, so a stolen token cannot be used without that key.

**ETSI** (European Telecommunications Standards Institute) — The European standards body that writes the technical standards for trust lists, signatures and trust services.

**HAIP** (High Assurance Interoperability Profile) — The OpenID4VC profile that fixes the choices for high-assurance use, as in the EUDI Wallet.

**OpenID4VCI** (OpenID for Verifiable Credential Issuance) — The protocol an issuer uses to deliver a credential to a wallet.

**OpenID4VP** (OpenID for Verifiable Presentations) — The protocol a verifier uses to request a credential from a wallet and receive the presentation.

**PAR** (Pushed Authorization Request) — An OAuth step in which the authorization request is sent to the server first, so its contents are not exposed in the browser address.

<!-- TERMS:END -->
