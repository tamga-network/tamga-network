---
document_id: GUIDE-0009
title: "Conformance tests"
status: Active
version: 1.0.1
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Showing that an application follows the Tamga rules: the open conformance test vectors (trust list questions, SD-JWT
  verification, positive and negative cases), running the runner, testing a library written in another language against the
  vectors, and the evidence asked for when joining.
translation_of: GUIDE-0009
source_version: 1.0.1
---

# Conformance tests

This guide is for anyone building software that connects to Tamga (a verifier, a wallet, an issuance service or a library
written in another language).

**When to read it:**
- When you want to show that your code gives the right answers under the Tamga rules.
- Before you apply to join: in the list and ledger stages **light conformance** applies; passing the open conformance vectors
  is the technical requirement for joining ([Tamga ARF — Trust Framework §2.4](https://arf.tamga.network/trust-framework)).

## How it works

A [[t:conformance]] test has two parts:

| Part | What | Where |
|---|---|---|
| **Test vectors** | Frozen input + expected output (JSON) | `conformance/vectors/` |
| **Runner** | A test suite that reads the vectors, runs them with `@tamga-network/*` and compares with the expectation | `conformance/runner/` |

The vectors are also the proof that two implementations give the same answer: today's signed lists and the [[t:ledger]] that
will open later must answer the same questions in the same way; the vectors are those questions, frozen ([[ADR-0009]] K7).

## 1. The vectors

```
conformance/vectors/
├── VERSION              version of the vector set (any change = version bump)
├── trust/basic.json     signed list set (LOTL, national list, anchor log, roots) + query → expected answer
└── sd-jwt/diploma-basic.json   an issued diploma, its presentation, the root certificate + verification expectations
```

**`trust/basic.json`** tests trust questions. Each case is a query and the expected three-valued answer:

```json
{
  "name": "issuer ACTIVE, iat geçerlilik içinde",
  "q": { "op": "isCredentialAcceptable", "issuer_id": "0x8d10…3b64", "iat": 1790812800 },
  "expect": "YES"
}
```

Queries tested: `isCredentialAcceptable`, `isCredentialSchemaAcceptable`, `isRecognizedBy`, `schemaContentHash`,
`isWalletProviderKey`. The load report of the list set (`healthy`, list version) is also compared with the expectation.

**`sd-jwt/diploma-basic.json`** tests verifying a presentation: which fields are disclosed, which stay hidden, the `issuer_id`
and the steps passed ([[SPEC-API-0001]] A1–A6). There are negative cases too, and each one **must be rejected**:

| Negative case | Expected |
|---|---|
| No KB-JWT | Rejected — proof of binding to the holder is mandatory |
| Wrong `nonce` | Rejected — replay |
| `iat` outside the window (+301 s) | Rejected — time window |
| An undisclosed disclosure added | Rejected — digest does not match |

Every vector carries a fixed `now` field, so time-dependent steps give the same result on every machine.

## 2. Running the runner

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run conformance        # generates the vectors and runs all the tests
```

To run only, `npm test` is enough (the runner is included automatically). Vectors are regenerated with
`npm run conformance:gen`; deterministic fields are produced with a fixed `now`, so the output changes only in signatures.

## 3. Testing your own library

The TypeScript code is canonical; implementations in other languages (Java, Python, Go…) are checked against the same vectors
([[ARCH-0005]] P9).

1. Take the `vectors/` folder as it is; record the `VERSION` value.
2. `trust/basic.json`: load the lists in `input` with your own code, pin the roots with `input.root_fingerprints`, run every
   `cases[].q` query at `now` and compare the result with `expect`.
3. `sd-jwt/diploma-basic.json`: verify `presentation` with `aud`, `nonce` and `root_cert_pem`; the result must equal `expect`.
   Each `negative[]` case must be rejected.
4. If a case expects `UNKNOWN` and you return `NO`, you do not conform: "could not be verified" is not the same as "invalid"
   ([[SPEC-API-0001]] AP2).

## 4. Evidence asked for when joining

You show conformance with your own software; the results report goes with the registration application, and the registrar
re-runs the tests when needed ([Tamga ARF — Trust Framework §4.3](https://arf.tamga.network/trust-framework)).

| Role | What is tested | How it is shown |
|---|---|---|
| Issuer | Credentials matching the type definition, signature and certificate chain, status list publication, checking wallet evidence | Test credential against the vectors + results report |
| Verifier | Signed request, verification steps, "could not be verified" on a stale list, not asking for out-of-scope fields | Vectors + commitment tests + results report |
| Wallet provider | Wallet rules (key protection, consent screen, history, deletion), wallet and key attestation, presentation protocol | Vectors + commitment tests + on-device demonstration |

**Commitment tests** include at least: a stale list gives "could not be verified"; processing stops on an unknown format
version; processing stops on a signature error. In the report, state your software's version and the version of the vector
set you passed (`VERSION`).

The vectors test the rules one by one; try the whole flow (receiving, presenting, revocation and suspension) with a real phone
on the test network ([[GUIDE-0013]]).

## Rules

| Code | What it says |
|---|---|
| No personal data in vectors | Names are fake; there are no private keys (only certificates and the holder's public key) |
| Version | Any change to the vectors = `VERSION` bump |
| [[ADR-0009]] K7 | The switch is not complete until the list and ledger implementations pass the same vectors |
| [[SPEC-API-0001]] AP2 | `INDETERMINATE` is not put in the same bucket as `REJECTED` |
