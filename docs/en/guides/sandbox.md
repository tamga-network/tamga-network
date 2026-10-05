---
document_id: GUIDE-0013
title: "Sandbox: the test network"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-04
summary: >
  End-to-end testing on sandbox.tamga.network, the test network kept apart from the real network: addresses, pinning the
  trust anchor, connecting a wallet to the sandbox, getting credentials with example people, presenting them to example
  verifiers, trying revocation and suspension, trying your institution as a test institution, real identity verification
  steps by invitation, rules and resets.
translation_of: GUIDE-0013
source_version: 1.0.0
---

# Sandbox: the test network

This guide is for anyone who wants to try software that connects to Tamga (above all a wallet, but also a verifier or an
issuer) from start to finish without touching the real network.

**When to read it:**
- When you want to try receiving, presenting and revoking credentials in your wallet before a real institution issues any.
- When you want to see your verifier return the negative results correctly (revoked, suspended, a person under the age limit).
- After passing the [[GUIDE-0009|conformance tests]], when you test end to end with a real phone.

## What is the sandbox?

The sandbox is Tamga Network's test network, **fully separate** from the real network ([[ADR-0038]]). The services run the
same code as the real network; only the trust root, the keys, the trusted lists and the data are separate and fake:

- It has its own test root certificate: **Tamga Sandbox Root CA (TEST)**. The real network's root signs nothing in the
  sandbox; the sandbox root appears in none of the real network's lists (`ADR-0038/SB1`).
- The sandbox [[t:LOTL]] and its national list mark themselves as test with the field `"environment": "sandbox"`
  ([[SPEC-TRUST-0001]] §3). A wallet or verifier configured for the real network does not accept this list
  (`ADR-0038/SB2`).
- People, events and credentials are examples; there is no real personal data. Identity verification uses a fake provider
  by default (`ADR-0038/SB3`); the real identity verification steps are tried only with an invitation code (§8,
  [[ADR-0040]]). The example institutions carry real institution names (see the note below).
- Every sandbox page and every wallet screen connected to the sandbox shows a "SANDBOX · test" mark (`ADR-0038/SB4`).
- The data returns to its initial state every night (`ADR-0038/SB5`).

A sandbox credential cannot be used in a real transaction: a real verifier does not recognise the sandbox root.

## Addresses

The sandbox repeats the real network's address layout under the `sandbox` sub-name. A wallet or verifier switches by changing
only the addresses and the trust anchor.

| Address | What | Real network counterpart |
|---|---|---|
| `https://sandbox.tamga.network` | sandbox page: trust anchor, addresses, example people, credential offers, example verifiers | — |
| `https://trust.sandbox.tamga.network` | test trusted lists (`lotl.jws`, `tl-tr.jws`), anchor log (`anchors.jsonl`), `keys/` | `trust.tamga.network` |
| `https://issuer.sandbox.tamga.network/{institution}` | issuance service of the example institutions ([[t:OpenID4VCI]]) | `issuer.tamga.network` |
| `https://status.sandbox.tamga.network` | status lists (Token Status List) | `status.tamga.network` |
| `https://verify.sandbox.tamga.network` | test verifier ([[t:OpenID4VP]]) | `verify.tamga.network` |
| `https://wallet.sandbox.tamga.network` | test wallet provider (Wallet Instance Attestation) | `wallet.tamga.network` |
| `https://id.sandbox.tamga.network` | identity and contact credentials; fake identity verification, real steps by invitation | `id.tamga.network` |
| `https://console.sandbox.tamga.network` | Institution Console — only for test institutions opened in the sandbox | `console.tamga.network` |

Example institutions, people and permissions come from seed data and return to their initial state at every reset; the
example institutions have no console. The Institution Console serves only the test institutions you open (§9, [[ADR-0041]]).

## 1. Pin the trust anchor

Wallets and verifiers accept the LOTL signature only with fingerprints built into the application; the list server is not
trusted. Use a **separate** pin set for the sandbox:

1. Take the SHA-256 fingerprints of the sandbox LOTL signer and the test root from `https://sandbox.tamga.network` (the same
   values are in `https://trust.sandbox.tamga.network/keys/root-fingerprints.json`; compare them with the page).
2. Keep these fingerprints in a configuration **separate** from the real network's pins. Never merge the two sets.
3. Pass the expected network when you load the list. `@tamga-network/trust` and `@tamga-network/wallet-core` do this with the
   `environment` option:

```ts
import { fetchTrustSource } from "@tamga-network/wallet-core";

const { source } = await fetchTrustSource("https://trust.sandbox.tamga.network", http, {
  pins: { lotlSigners: [SANDBOX_LOTL_SIGNER_FINGERPRINT], environment: "sandbox" },
});
```

If you write your own loader: after verifying the signature, compare the `environment` field of the LOTL and of the national
list (absent means `production`); stop if it does not match ([[SPEC-TRUST-0001]] §6).

## 2. Connect the wallet to the sandbox

**Tamga Wallet:** Settings → Developer → **Network: Tamga Network | Sandbox**. When the sandbox is selected the wallet switches
to the sandbox trust root and the addresses above; a "SANDBOX · test" strip appears at the top of every screen. Trust in the
real network and in the sandbox never mixes.

**Another wallet:** follow the steps in [[GUIDE-0005]] with the sandbox addresses:

| Setting | Sandbox value |
|---|---|
| trusted lists | `https://trust.sandbox.tamga.network` + sandbox pins + `environment: "sandbox"` |
| wallet provider (WIA / WUA) | `https://wallet.sandbox.tamga.network` |
| identity credential service | `https://id.sandbox.tamga.network` |
| issuer directory | `issuers[]` in the sandbox national list (addresses on `issuer.sandbox.tamga.network`) |

Make the sandbox visible on screen (`ADR-0038/SB4`) and do not mix credentials received in the sandbox with real network
credentials.

## 3. Example institutions and credential types

::: warning About the institution names
Institution names are used only to make this test environment realistic; there is no relationship or agreement with these
institutions. The credentials here are signed with a test key and are not valid anywhere. The institutions' logos are not used.
:::

| Institution | Credential types (`vct`) |
|---|---|
| İstanbul Bilgi Üniversitesi (TEST) — `issuer.sandbox.tamga.network/istanbul-bilgi` | `urn:tamga:edu:StudentCredential:1`, `urn:tamga:edu:DiplomaCredential:1` |
| Bubilet (TEST) — `issuer.sandbox.tamga.network/bubilet` | `urn:tamga:tkt:EventTicket:1` (fictional concerts) |
| Paribu Cineverse (TEST) — `issuer.sandbox.tamga.network/paribu-cineverse` | `urn:tamga:tkt:EventTicket:1` (fictional film screenings; a cinema ticket is not a separate type: the film and screening are in `event_name`, the hall in `venue_name`) |
| Identity service — `id.sandbox.tamga.network` | `urn:tamga:id:IdentityAttestation:1`, pseudonym seed (PseudonymSeed), `urn:tamga:contact:EmailAddress:1`, `urn:tamga:contact:PhoneNumber:1` |

## 4. Example people

The **example people** on the sandbox page are made up: 13 people from different countries, of different ages and in
different situations. Their identity numbers have 12 digits and start with `99`; they are deliberately invalid
(`ADR-0038/SB3`). Some people are prepared for trying negative results:

| Person | Prepared state | Expected result |
|---|---|---|
| Timur Rahimov | the diploma is **revoked** right after issuance | REJECTED after the next status publication |
| Gülnaz Abenova | the diploma is **suspended** right after issuance | a suspended credential is not accepted; it can be reinstated from the offer page |
| Elvin Həsənov | the ticket is **revoked** right after issuance (refund) | the gate check returns REJECTED after the next status publication |
| Aibek Toktogulov | student with studies on hold (`student_status: ON_LEAVE`) | the student credential carries this state |
| Aruzhan Seitkali | 17 years old | the age check (≥ 18) fails |
| Deniz Örnek | no record at any institution | cannot get institution credentials |

A person's page (`/people/<key>`) shows the credentials that person can receive.

## 5. Get credentials

**Institution credentials (student credential, diploma, ticket):** on the person's page choose the credential type (for a
ticket, the institution — concert or cinema —, the event and the ticket class). The page opens an [[t:OpenID4VCI]] offer: a QR code and a link
(`openid-credential-offer://…`), plus a PIN (`tx_code`) shown separately. Scan the QR with the wallet and enter the PIN. The
offer page shows when the credential has been issued and its state.

**Identity and contact credentials:** the wallet starts these (authorization code flow). The QR on the person's page is the
identity service's offer. On the fake identity verification screen, choose the person named on the page; no real document or
face scan is asked for.

**Email and phone credentials:** in the sandbox the code is not sent anywhere; it is shown in a "SANDBOX · TEST" box on the
code entry screen. Only example addresses are accepted: an email at a `.example` or `.test` domain, or a phone number between
+44 7700 900000 and +44 7700 900999 (the example people's addresses are on their pages). A real address is refused.

## 6. Present the credential

The **example verifiers** on the sandbox page open a signed [[t:OpenID4VP]] request at the test verifier and show its QR. Scan
it with the wallet; the result (ACCEPTED, REJECTED or INDETERMINATE), the checks performed and the shared fields appear on the
same page.

| Scenario (`/verify/<scenario>`) | What is requested |
|---|---|
| `signin` | sign in with Tamga — pseudonym only |
| `signup` | sign up to a site — given name, family name and pseudonym |
| `age` | age ≥ 18 (selective disclosure) |
| `age-zk` | age ≥ 18 with a zero-knowledge proof (if the wallet supports it) |
| `diploma` | job application: diploma |
| `student` | student discount: student credential |
| `ticket` | event gate: ticket (concert or cinema) |
| `identity` | event entry with the identity credential |

To try your own verifier: connect it to the sandbox list and the sandbox pins, then present credentials received in the
sandbox. You can open your institution in the sandbox yourself (§9); verifiers and wallet providers adding themselves to the
sandbox list is a later stage.

## 7. Try revocation and suspension

The offer page of a diploma or a ticket has **revoke**, **suspend** and **reinstate** buttons. For the people with a prepared
state (table above) this step happens by itself as soon as the credential is issued. The change takes effect when the issuer
publishes its next status list (publication at a fixed interval; not instantly). Then present the same credential to an
example verifier again: a revoked or suspended credential must not be accepted. The student credential is short-lived and
carries no status list entry.

## 8. Try with your real identity (invited)

Identity verification in the sandbox is fake by default. If you want to see the real steps (document scan, liveness, face
match) inside your app, ask the sandbox team for an **invitation code** ([[ADR-0040]]):

1. Connect the wallet to the sandbox and start adding an identity credential.
2. On the identity service's privacy notice page, open "Invitation code" and enter the code.
3. Read and confirm the warning: "This is a test environment; you are trying it with your real identity; your data is deleted
   every night; the verification session is deleted as soon as the credential is issued." Without confirmation the provider
   is not opened (`ADR-0040/RI3`).
4. Complete the steps in the identity verification provider's **separate application opened only for the sandbox**; the test
   credential arrives in the wallet. The real network's provider key is never used in the sandbox (`ADR-0040/RI2`).

Only given name, family name and date of birth (and the derived age flag) go into the credential; instead of the real identity
number and document number a random `SANDBOX-…` value is written (`ADR-0040/RI4`). The verification session at the provider is
deleted as soon as the credential is issued or at once if verification fails; an abandoned session within about an hour, at the
latest at the nightly reset (`ADR-0040/RI5`). Invitation codes
are personal (single use, at most 7 days) or timed (at most 72 hours, at most 25 uses) and are deleted at the nightly reset.
For now, codes are given to the project team and to a limited number of test users who accept the purpose of the invitation in
writing.

## 9. Try your institution

An institution can try its own credential with its own (made-up) data in a few minutes ([[ADR-0041]]):

1. `https://sandbox.tamga.network` → **Try your institution**. Enter a made-up institution name ("(TEST)" is added
   automatically) and choose the type (today an education institution: student credential and diploma). No email, phone or
   personal name is asked; real institution names and official-body words (T.C., Ministry, University …) are not accepted.
   Tick both boxes: made-up data only, deleted every night.
2. The institution is added to the sandbox trusted list at once, marked `test_institution: true`. Its signing certificates are
   issued by the sandbox **test institutions intermediate CA**; credentials carry the leaf + intermediate chain and chain to the
   sandbox root (`ADR-0041/TI1`, [[SPEC-TRUST-0001]] §4).
3. Create a passkey at `console.sandbox.tamga.network` with the single-use invitation link on the page.
4. In the console: **Records** → enter records one by one or bulk-load them with **Import CSV** (first row: field names; at most
   200 rows). A record containing an 11-digit number that passes the identity number checksum is rejected (`ADR-0041/TI4`):
   use deliberately invalid numbers.
5. Next to a record: **Issue at the desk** → scan the QR with the wallet and enter the PIN.
6. Present the credential at the "Diploma check" or "Student discount" verifier on the sandbox page.

Limits: at most 30 test institutions at a time (when full, the oldest empty test institution is removed to make room); at most 10 new institutions per 10 minutes; 200 records per institution; 100
offers per hour. The institution, its account, records and certificates are deleted every night and leave the sandbox list
(`ADR-0041/TI5`). Event ticket institutions, wallet-initiated issuance and API keys for test institutions come in a later
phase.

## Rules and limits

- **Do not enter real personal data.** Only the example people, example addresses and made-up records go into the sandbox; the
  only exception is the invited real identity trial (§8), where only given name, family name and date of birth go into the
  credential.
- **Do not expect persistence.** Sandbox data returns to its initial state every night at 03:30 (Türkiye time): records of
  issued credentials, status lists and the anchor log are reset. Sandbox credentials in your wallet may no longer verify
  after a reset; get them again. The trust root and the list signing keys are not reset; the sandbox pins in the wallet do not
  change.
- **Do not mix it with the real network.** Do not add the sandbox pins to your real network configuration; a sandbox
  credential does not pass at a real verifier anyway.
- The sandbox has no service level commitment; its outages say nothing about the real network.

## Related

[[ADR-0038]] · [[ADR-0040]] · [[ADR-0041]] · [[SPEC-TRUST-0001]] · [[GUIDE-0005]] · [[GUIDE-0010]] · [[GUIDE-0009]] · [[GUIDE-0012]]
