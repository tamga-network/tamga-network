---
document_id: ADR-0031
title: "Per-site pseudonyms"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-02
summary: >
  "Sign in with Tamga" does not send the digest of the identity document (document_number_hash) to the site. The wallet derives a
  separate but stable pseudonym key for each site; the site recognises the person by this key, and two sites cannot match the same
  person. The pseudonym seed is derived deterministically in the identity service from the person's unchanging identity; on a new
  phone, once identity is verified again, the same pseudonyms come back and a person opens a single account per site. Closes S-17;
  meets ARF Topic 11 (PA_01–PA_19).
domain: Identity
translation_of: ADR-0031
source_version: 1.0.0
---

# Plain summary

1. Before this decision "Sign up with Tamga" sent **the same** account value to every site; if two sites compared notes, they
   could tell it was the same person.
2. Decision: the wallet gives each site a **different** pseudonym key. The site always recognises you; two sites cannot match you.
3. Pseudonyms are derived from your identity: when you verify your identity on a new phone, the same pseudonyms come back and your
   accounts are not lost.
4. A person can open one account per site (a guard against fake multiple accounts); a site may allow several pseudonyms if it
   wants.
5. The cost: Tamga's identity service could in theory compute a person's pseudonym; we limit this with key protection and
   oversight, and remove it later with zero-knowledge proofs (Z5).

# Context

- **S-17:** on the example site (`verify…/demo-site`) sign-up and recovery sent the `document_number_hash` from the identity
  document to the site; the site did not store the raw value but kept `HMAC(siteSecret, hash)`; daily sign-in used a passkey. But
  sign-up sent **the same value to every site** → linkability across sites. Copy separation (WL5) does not close this; the value is
  inside the [[t:credential]] and the same in every copy.
- **Nor is the value stable:** `document_number_hash = HMAC(docHashKey, country:document type:document number)` (identity service,
  `apps/id` `routes/idv.ts`). When the person renews their ID card the document number changes → the account key changes → the site
  no longer recognises the person.
- **[[t:ARF]] Topic 11 (PA_01–PA_19):** the wallet generates a [[t:pseudonym]], registers it with the site and signs in with it;
  the pseudonym is unique per site (CIR 2024/2979 Art. 14(2)), the real identity cannot be derived from the site (PA_16), the same
  pseudonym is not given to different sites (PA_17), the [[t:wallet-provider]] uses a method that ensures unlinkability (PA_18),
  the user sees, names and deletes their pseudonyms (PA_05–PA_10), and the site verifies that the pseudonym belongs to the user and
  comes from an unrevoked wallet (PA_11–PA_14). In the EU gap analysis (H1) all 19 items were "missing".
- **Constraints:** the identity service keeps no personal data after issuing the credential (IDP9); the migration file and the
  backup carry no keys ([[ADR-0027]] LX2, WL2); with an intermediary [[t:verifier]] the wallet recognises the actual [[t:RP]]
  ([[ADR-0017]] K7); no backward compatibility is written during the development stage ([[ADR-0029]]).

# Options

| # | Method | Unlinkability | New phone / reinstall | One account per person | Can Tamga link? | Result |
|---|---|---|---|---|---|---|
| A | **Random master secret in the wallet** → per-site key | full | ❌ lost (LX2/WL2: the secret cannot go into the migration file) | ❌ new pseudonym after reinstall | no | rejected — accounts are lost with the phone |
| B | **Passkey = pseudonym** (ARF "verifiable pseudonym") | full | depends on platform sync (iCloud/Google) | ❌ | no | complementary — kept for daily sign-in, carries no identity |
| C | **The issuer produces a per-site identifier** | full (across sites) | ✅ | ✅ | **yes, and it learns the site** | rejected — the identity service learns which site you sign into (tracking) |
| D | **Seed derived from identity** (identity service) → per-site key in the wallet | full (across sites) | ✅ same after identity is verified again | ✅ (assuming a genuine wallet) | only by using the key together with the person's ID number | **accepted** |
| E | **Zero-knowledge "nullifier"** (Z5) | full | ✅ | ✅ and **proven** | no (derivation verified by proof) | target — replaces D with Z5 |

**Why D?** A wipes all accounts when the phone changes (carrying the key breaks LX2). C creates tracking. E is the right long-term
solution but needs the store app and a [[t:ZK]] library (Z5). D can be built today, is stable, makes no one store personal data,
and the site side does not change when moving to E (the site still sees "pseudonym key + signature").

# Decision

## K1 — Pseudonym seed (identity service)
- When issuing the identity credential, the identity service derives a seed from the person's **unchanging** identity:
  `seed = HMAC-SHA256(pseudonymKey, "tamga-pseudonym-v1|" + country + "|" + personal identification number)`.
  For Türkiye the input is the national ID number (it does not change when the card is renewed). For documents without a personal
  identification number the input is `country|document type|document number` (pseudonyms change when the document is renewed —
  a known limit, see the resolved questions).
- `pseudonymKey` is a key **separate** from `docHashKey`; it lives only in the identity service; KMS/HSM in the pilot. The seed is
  **not stored** (IDP9): it is recomputed from the same input on every verification.
- The seed is delivered to the wallet in a separate credential type that **only the wallet keeps and never presents**
  (`urn:tamga:id:PseudonymSeed:1`). This type cannot be written into any RP scope in the [[t:trust-list]] (AP6 rejects it anyway);
  the wallet never lists it on the presentation screen. It is not placed inside the identity credential: a field of the identity
  credential could be disclosed by mistake, a separate type cannot.

## K2 — Per-site pseudonym (wallet)
- Site identity = the **registered RP identity** in the trust list; with an intermediary verifier, that of the actual RP
  ([[ADR-0017]] K7). In practice the RP record's permanent identifier `dns_name` ([[ADR-0034]]; `client_id` is not used because,
  as [[t:x509_hash]], it is derived from the certificate).
- `k = HKDF-SHA256(seed, info = "tamga-pseudonym-v1|" + site + "|" + index)` → P-256 private key (hash_to_field, mod n).
  **Pseudonym** = the JWK thumbprint of the public key (RFC 7638). Index 0 = the site's default (single) pseudonym.
- The seed is kept in secure storage in the wallet (Keychain / Keystore; hardware-protected in the store build) and the key is
  derived at the moment of use, after PIN/biometrics; the derived key is not stored persistently.

## K3 — What the site receives
| Flow | The site receives | The site does NOT receive |
|---|---|---|
| **Sign-up** | pseudonym public key + signature (`aud` = site, `nonce`) + WIA (unrevoked wallet — PA_11) + the fields the policy requests (e.g. given name, family name) | `document_number_hash`, ID number |
| **Sign-in** | pseudonym signature + WIA; no credential field | any personal field |
| **Recovery / new phone** | the same pseudonym (the seed comes out the same once identity is verified again) | credential values |
| **Daily sign-in (computer)** | the site's own passkey (unchanged) | — |

- In the presentation the pseudonym travels as a separate `vp_token` entry: a short JWT signed with the pseudonym key
  (`typ: tamga-pseudonym+jwt`; `aud`, [[t:nonce]], `rp_id`, `cnf` = pseudonym public key) + [[t:WIA]]. The verifier checks the
  signature, the `aud`/`nonce` match and the WIA (PA_13, PA_14).
- `document_number_hash` does **not** go to sites by default: it is not in the `site-signup` / `site-signin` policies. It stays in
  the identity credential (for matching institutional records); an RP may request it only if the scope in its record explicitly
  includes it ([[ADR-0024]]).

## K4 — One account or several pseudonyms
- Default: **one** pseudonym per site (index 0) → one account per person per site.
- A field in the RP record: `pseudonyms: "single" | "multiple"` ([[ADR-0024]] scope data). On a site that says `multiple` the user
  may open a new pseudonym (index 1, 2…; PA_04), and names and chooses their pseudonyms (PA_05, PA_06).
- "One account" rests on the assumption of a genuine wallet: a modified wallet could present another index. WIA/device attestation
  limits this; definitive proof comes with E (Z5). This limit is stated plainly to sites in the registration guide.

## K5 — Wallet screen
Settings → **My pseudonyms**: site name (registered name), creation date, the name the user gave it (not sent to the site —
PA_19), delete (PA_07; a deleted pseudonym is never derived again for that site, signing up again opens a new index). Sign-ups and
sign-ins are written to the log (PA_08a, TS10 log; the site name and the event, not the pseudonym value).

# Rationale / alternatives

- **Unlinkability:** two sites see different `rp_id`s → different HKDF output → different keys. Neither the seed nor the identity can
  be recovered from pseudonyms (HKDF/HMAC are one-way; PA_16).
- **Stability:** because the seed is derived from the person's unchanging identity, it stays the same on a new phone, after a
  reinstall and when the card is renewed; no key has to go into the migration file (LX2 holds).
- **Known weakening (stated openly):** someone holding both `pseudonymKey` and a person's ID number (e.g. the operator of the
  identity service, colluding with a site) could compute that person's pseudonym on that site. Mitigations: key in KMS/HSM, access
  logging, key usage counts in the transparency report, the key can be handed over to the state ([[t:PID]] provider); the
  permanent solution is E (Z5). The situation before this decision was worse than every option except A: **every site** could
  match everyone.

# Invariants

| Code | Rule |
|---|---|
| PS1 | The wallet presents to a site only the pseudonym derived from that site's registered `rp_id`; the same pseudonym never goes to different sites. |
| PS2 | The pseudonym seed is not stored in the identity service; it is re-derived on every verification with a separate key (`pseudonymKey`). |
| PS3 | The credential type carrying the seed is never presented to an RP and cannot appear in any scope in the trust list. |
| PS4 | `site-signup` / `site-signin` and similar sign-in policies do not request `document_number_hash` or an ID number. |
| PS5 | A pseudonym presentation is signed with the pseudonym key (`aud` = site, `nonce`) and carries proof of an unrevoked wallet unit. |
| PS6 | The name the user gives a pseudonym is not sent to the site. |

# Implementation plan

| Step | Where | Work |
|---|---|---|
| 1 | `apps/id` (operator repository) | `pseudonymKey` (configuration), seed derivation, issuing the separate type; tests (same identity → same seed; different → different). |
| 2 | `packages/schemas` | seed type schema (single field, no `sd`, marked non-presentable); catalogue. |
| 3 | `packages/wallet-core` | `pseudonym.ts`: HKDF derivation, P-256 key, `tamga-pseudonym+jwt`; separate `vp_token` entry in the presentation; pseudonym list/delete; log. |
| 4 | `packages/verifier` (+ `/web`) | pseudonym JWT verification (signature, aud, nonce, WIA); policy field `pseudonym: { mode }`; the site kit returns `pseudonym`. |
| 5 | `apps/verify` | `site-signup`/`site-signin` policies: no `document_number_hash`, pseudonym included; example site account key = pseudonym. |
| 6 | `apps/trust-publisher` registry | `pseudonyms: single|multiple` in the RP scope. |
| 7 | Tamga Wallet (separate repository) | "new pseudonym / existing" on the consent screen; Settings → My pseudonyms (three languages). |
| 8 | Documentation | SPEC-WALLET-0001, SPEC-API-0001, GUIDE-0001, FW-RB-0001, FW-RB-0003 (Identity Rulebook), closing S-17 in 09-DEMO-KURGU, `/shortcuts` S-17 and `/docs/login-with-tamga` on the site. |

Estimated effort: steps 1–7 about 4–5 working days (with tests). The software path runs in Expo Go; hardware-protected storage of
the seed comes with the store build (Z1). During the development stage accounts and policies are corrected in place and no migration
code is written ([[ADR-0029]]); the example site's accounts are in memory.

# Resolved questions (project management, 2026-10-01)

1. **D accepted** (seed derived from identity; the "known weakening" remains as a written limit).
2. **Name of the seed type:** `urn:tamga:id:PseudonymSeed:1`.
3. **Documents without an ID number:** pseudonyms change when the document is renewed; recorded as a limit.
4. **Timing:** now, on the software path; hardware-protected storage of the seed with the store build (Z1).

# Status

**Accepted — 2026-10-01** (approved by project management). Implementation: the plan above; S-17 was closed by implementing this ADR.
