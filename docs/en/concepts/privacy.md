---
title: Privacy
---

# Privacy

Tamga's basic rule: **a [[t:verifier]] sees only what it needs, and nobody can track a person across sites.** Four tools make
this work.

## Selective disclosure

Every field of a credential can be withheld on its own ([[t:selective-disclosure]]). In a job application only "graduated" and
"degree" are shown; the grade average and the student number stay hidden. The verifier sees only the [[t:salted-hash]] values of
the hidden fields.

## One copy per verifier

The wallet holds several copies of each credential and shows **a different copy** to each verifier — and always the same one
to the same verifier. Two verifiers cannot match a person by comparing signatures or key values. When copies run low, the
wallet renews them in the background.

## A pseudonym per site

"Sign in with Tamga" sends the website neither an identity number nor a digest of a credential. The wallet derives a separate,
stable [[t:pseudonym]] for each site: the site recognises you at every sign-in, but two sites cannot match the same person.
When you change phones and verify your identity again, the same pseudonyms come back. One account per person per site is the
default.

## Age with a zero-knowledge proof

The proof "I am over 18" is produced without showing the credential itself ([[t:ZK]]): the verifier sees neither the date of
birth nor the credential, and two presentations cannot be linked. The proof system is [[t:Longfellow-ZK]]; the verifier side
is ready in the `@tamga-network/verifier/zk` subpath, and the wallet side ships with the store release.

## What a verifier must do

- Never log claim **values** or the status index; log field names only.
- Do not ask for fields outside the scope of your registration.
- A person can send you an erasure request from the wallet; keep your registered contact channel up to date.

## Details

- Wallet rules: [[SPEC-WALLET-0001]]
- Pseudonyms: [[ADR-0031]], zero-knowledge proofs: [[ADR-0032]]
