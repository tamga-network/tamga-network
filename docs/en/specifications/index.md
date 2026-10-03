---
title: Specifications
---

# Specifications

The specifications are the exact rules of Tamga Network: how a [[t:credential]] is written, how it is issued and presented,
and the format of the [[t:trust-list|trust lists]]. The code follows them; the conformance tests (`conformance/`) check them.

If you are new, read the [Concepts](/concepts/) pages and the [Get started](/guides/) guides first; come to a specification
when you need the exact wording of a rule. Every specification opens with a short "In brief" section; the rules and the detail
follow.

## Credentials

| Specification | What it covers |
|---|---|
| [[SPEC-CRED-0001]] | The overall frame of the credential format and protocols |
| [[SPEC-CRED-0002]] | How an SD-JWT VC credential is written, byte by byte |
| [[SPEC-CRED-0003]] | Revocation and the status list |

## Protocols

| Specification | What it covers |
|---|---|
| [[SPEC-PROTO-0001]] | An issuer issuing a credential to a wallet (OpenID4VCI) |
| [[SPEC-PROTO-0002]] | A wallet presenting a credential to a verifier (OpenID4VP) |
| [[SPEC-API-0001]] | The verification pipeline and the service API |

## Trust and identity

| Specification | What it covers |
|---|---|
| [[SPEC-TRUST-0001]] | The format and publication of the trust lists |
| [[SPEC-ID-0002]] | Institutional identity: X.509 certificates |
| [[SPEC-ID-0003]] | Identity proofing before a credential is issued |

## Schemas

| Specification | What it covers |
|---|---|
| [[SPEC-SCHEMA-0001]] | The schema catalogue (`schemas.tamga.network`) |
| [[SPEC-SCHEMA-0002]] | Education schemas: student certificate and diploma |
| [[SPEC-SCHEMA-0003]] | Skeletons for other sectors and the conditions for opening them |

## Wallet

| Specification | What it covers |
|---|---|
| [[SPEC-WALLET-0001]] | The internal rules of a compatible wallet |

---

Identifiers (`SPEC-…`) are permanent: references do not break when a file name or title changes. The single list of all
binding rules: [Binding rules](/rules).

Specifications for the ledger stage (trust-layer contracts, agent delegation) are not used today; they are kept in the
repository under `docs/ledger/`.
