---
document_id: SPEC-WALLET-0001
title: "Wallet rules"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Defines the wallet's key, storage, backup and consent design. The central finding resolves a TENSION: [[SPEC-CRED-0001]] §3
  says the holder key cannot leave the secure area, while the "back up with a 24-word seed" design in the project notes
  implied that the key is recoverable. Both cannot be true at once — and a holder key derivable from a seed would make the
  credential TRANSFERABLE, bringing the holder binding gap back through the back door. Decision: keys are not derived from
  the seed; the backup carries the credentials and the manifest, and a device change requires RE-ISSUANCE. In addition,
  sticky per-verifier use of batch copies closes two open questions at once.
translation_of: SPEC-WALLET-0001
source_version: 1.0.0
---

# In brief

This document sets out the rules every wallet compatible with Tamga Network must follow internally: keys, on-device storage,
backup, the consent screen and credential copies. It is written for wallet developers; Tamga Wallet (a separate repository)
is the reference implementation of these rules.

**When to read**

- First read the [Privacy](/concepts/privacy) and [Presentation](/concepts/presentation) concept pages.
- When you move to code, [[GUIDE-0005]] shows how to meet these rules with `@tamga-network/wallet-core`.
- The protocols the wallet uses to talk to the institution and the verifier are not here: [[SPEC-PROTO-0001]] and
  [[SPEC-PROTO-0002]].

**Plain explanation**

The keys bound to a credential are generated in the phone's secure hardware and never leave it; so they are not backed up,
and when the phone changes, the credentials are obtained again from the institution. For every share the person sees what
goes to whom and approves it; a site that asks for more than it needs triggers a separate warning. The wallet keeps several
copies of the same credential: it always shows the same site the same copy and different sites different copies, so sites
cannot link the person across one another. "Sign in with Tamga" uses a separate pseudonym for each site. If the person
wishes, they can reset the wallet and delete their data both from Tamga's services and from the phone.

---

# Scope

The **internal** design of the wallet: key management, local storage, backup and recovery, the consent surface, use of
credential copies, the schema cache.

The protocols are in [[SPEC-PROTO-0001]] and [[SPEC-PROTO-0002]]. The [[t:WIA]] and the [[t:key-attestation]] are in
[[ADR-0025]]; the [[t:wallet-provider]] issues them.

---

# 1. The resolved tension — can the key be backed up?

This section is the most important part of the document because **two existing design decisions contradicted each other.**

## 1.1 The contradiction

[[SPEC-CRED-0001]] §3 says:

> The key is generated in the device's secure element (Secure Enclave/StrongBox) and can never be exported → **the
> credential is non-transferable.**

The backup design in the project notes, on the other hand, implied:

> A 24-word seed + mandatory PIN; an encrypted backup on the server (the server cannot decrypt it).

If the seed brings the wallet back in a **usable** state, it also brings back the [[t:holder]] key. But if the holder key
cannot leave the secure area, the seed cannot bring it back.

**Both cannot be true at once.**

## 1.2 Why the key cannot be derived from the seed

The tempting option is: derive the holder keys from the seed, keep them in software, recover them anywhere.

This option is **rejected** because it defeats [[t:holder-binding]] entirely:

| | Consequence |
|---|---|
| Seed → holder key derivable | The seed can be shared |
| The seed can be shared | The credential is **transferable** |
| The credential is transferable | The gap in [[SPEC-CRED-0001]] §3 comes back |

In that document's own words: the attack "a student has their certificate issued into a friend's wallet" would be closed at
issuance and **reopened at recovery**. A back door is more dangerous than a front door because nobody looks there.

## 1.3 Decision

**Invariant WL1:** holder keys are **not derived from a seed** and **never leave** the device's secure area.

**Invariant WL2:** the backup carries the credential **documents** and the **manifest**; it does not carry holder keys. A
credential restored on a new device therefore **cannot be presented** — re-issuance is required.

This is an accepted user-experience cost. The alternative is to lose the system's core security property.

## 1.3b A third path considered (review R10)

The decision was taken between two options; there is a third one, and it needs to be rejected explicitly: **platform-synced
keys** (iCloud Keychain / Google Password Manager style key classes, hardware-backed but portable across devices).

| | Assessment |
|---|---|
| Pro | No re-issuance on a device change; the best user experience |
| Con 1 | Trust moves from Tamga to **Apple/Google** — they decide where the key goes |
| Con 2 | Another device on the same account receives the key → the "credential is non-transferable" principle (WL1) is broken at account level |
| Con 3 | The EUDI ARF does not count this class as W3 (certified WSCD); state-stage alignment with the state is at risk |

**Rejected.** In the expansion stage it may be reconsidered as an optional "easy recovery" mode for level W2 — if the user knowingly
chooses lower assurance. For now it is not worth the product complexity.

## 1.4 The real role of the seed

The seed does a **narrower** job than it seems:

| What the seed recovers | What it does not recover |
|---|---|
| The wallet identity (the decryption key of the backup) | Holder keys |
| The credentials themselves (readable, not presentable) | The ability to present |
| The manifest: which type from which institution | — |
| Settings, language, presentation record | — |

The manifest is critical: on the new device it offers the user a one-tap list **"request these 4 credentials again"**. It
does not remove the pain of recovery but makes it manageable.

---

# 2. Key architecture

## 2.1 Key types

| Key | Where | Exportable | Lifetime |
|---|---|---|---|
| **Holder keys** (N per issuance) | Secure Enclave / StrongBox | **No** | Credential lifetime |
| **Backup encryption key** | Derived from the seed | As the seed | Permanent |
| **Wallet instance key** | Secure area | No | Installation lifetime |

## 2.2 Wallet assurance levels

The wallet-side component of Axis A in [[PM-ASSUR-0001]]:

| Level | Key storage | Phase |
|---|---|---|
| **W1** | Software (no secure area) | Not supported |
| **W2** | Device secure area (Secure Enclave / StrongBox) | **Initial-stage minimum** |
| **W3** | Certified WSCD | The state stage |

**Invariant WL3:** W1 wallets are not supported. Tamga Wallet is not installed on a device without a secure area — it is
refused with a clear warning to the user.

## 2.3 PIN

The PIN is the **user verification** condition for access to the key in the secure area; it does not encrypt the key (the
hardware does that).

| Rule | Value |
|---|---|
| Length | At least 6 digits |
| Biometrics | Next to the PIN, **not instead of** it (the fallback is the PIN) |
| Attempts | 5 wrong → 30 s delay; 10 → the wallet locks, the seed is required |
| Presentation approval | PIN or biometrics **mandatory** for every presentation |

**The last row matters:** a presentation must be a deliberate act of the user. An unlocked wallet is prevented from
presenting silently in the background.

---

# 3. Local storage

```
┌──────────────────────────────────────┐
│ Secure area (hardware)               │
│   holder keys — cannot leave         │
├──────────────────────────────────────┤
│ Encrypted local database             │
│   credentials    SD-JWT strings      │
│   batch_state    copy ledger         │
│   verifier_map   sticky mapping      │
│   schema_cache   Type Metadata       │
│   presentation_log  presentation log │
│   settings                           │
└──────────────────────────────────────┘
```

**Invariant WL4:** the `presentation_log` **never** leaves the device automatically or to a server; it leaves the device only
in an export the person starts themselves, encrypted with their own password (EU TS10, [[ADR-0027]]) — it does not enter the
backup either ([[SPEC-PROTO-0002]]/PV8). If it entered the backup, it would be uploaded to the server on a device change,
even if encrypted, and a behavioural profile would be centralised.

The user can view and delete this record.

---

# 4. Managing credential copies

> This section closes Open question 1 of [[SPEC-PROTO-0001]] and Open question 3 of [[SPEC-CRED-0002]].

## 4.1 The sticky copy rule

**Invariant WL5:** a [[t:verifier]] is **always** shown the **same** batch copy. **Different** verifiers are shown
**different** copies.

```
verifier_map: (verifier_id, vct) → copy_index
```

The rationale works in both directions:

| Direction | Why |
|---|---|
| **Same copy to the same verifier** | The verifier already knows who the person is (the application is named). Showing a different copy gains no unlinkability, it only spends copies. |
| **Different copy to a different verifier** | If two verifiers collude, they cannot link through `cnf` and `idx` ([[SPEC-CRED-0003]] §9.4). |

`verifier_id` is the [[t:x509_hash]] client identifier ([[SPEC-PROTO-0002]] §2.1) — a stable and verifiable key.

## 4.2 A consistent disclosure set

**Invariant WL6:** for repeated presentations of the same `vct` to the same verifier, the wallet uses **the same disclosure
set**.

The reason is in the Security notes of [[SPEC-SCHEMA-0002]]: a changing set reveals which fields are being hidden. If 8
fields are disclosed in the first presentation and 6 in the second, the verifier can infer the difference.

If the verifier asks for fewer fields, the wallet **does not present more** — the new request itself applies, not an
intersection; but the user is shown "you previously gave this verifier these fields".

## 4.3 Running out

| Copies left | Wallet behaviour |
|---|---|
| 3 | Silent — visible in settings |
| 2 | Notification to the user: "2 uses left for your student certificate" |
| 0, **known** verifier | The existing copy is used thanks to the sticky mapping — no problem |
| 0, **new** verifier | The user chooses: (a) refresh, (b) reuse an existing copy — **with a linkability warning** |

**Invariant WL7:** refresh without user action happens only under the conditions AR1–AR4 of [[ADR-0023]]. Institutional
credentials that have a refresh token are refreshed at the threshold announced by the institution, with the app in the
foreground and unlocked, after a random delay; for identity and contact credentials refresh is a user action. The user can
turn it off in settings.

## 4.4 Diploma — initial stage

Under [[SPEC-PROTO-0001]] §8.5 the diploma is issued as a **single copy** in the initial stage. The sticky mapping still applies (the
single copy goes to every verifier) and `idx` linkability is an accepted risk — it is also shown to the user **inside the
wallet**, not only in the pilot agreement.

---

# 5. Consent surface

## 5.1 Presentation consent screen

Minimum content, in this order:

1. **Who is asking** — the verifier's name (from its [[t:trust-list]] entry) + a registered/unregistered mark
2. **For what** — the `purpose` text ([[SPEC-API-0001]] §4.1)
3. **What will be shared** — field-by-field list, with values
4. **What will not be shared** — the **names** of the fields that stay hidden (not their values)
5. Approve / Decline

The fourth item is unusual and deliberate: the user needs to **see** [[t:selective-disclosure]] working. The line "your
grade average will not be shared" explains the product's value at a glance.

## 5.2 Over-request warning

> Closes Open question 1 of [[SPEC-PROTO-0002]].

Three levels, three different visual weights:

| Situation | Presentation |
|---|---|
| Registered + within scope | Normal screen, no warning |
| Registered + **fields outside scope** | Out-of-scope fields appear in the list **in a separate block**, in a different colour, under the heading "this verifier is not authorised to request these fields". The approve button becomes active **after a 3-second delay**. |
| **Unregistered verifier** | A separate screen that interrupts the flow: "This verifier is not registered with Tamga. We cannot verify who it is." → Continue / Cancel |

**Avoiding warning fatigue:** a warning appears only in a **truly abnormal** situation. In the normal flow there is no
warning. If we put a warning on every presentation, it becomes invisible.

**Invariant WL8:** the over-request warning is not a line of text next to the approve button; it requires a separate visual
block and a delayed button.

## 5.3 Repeated different queries

Security notes of [[SPEC-PROTO-0002]]: a verifier can map which credentials a user holds by sending different queries.

If **more than 3 different queries within 24 hours** come from the same verifier, the wallet informs the user: "This
verifier asked for 4 different credentials today."

## 5.4 Per-site pseudonym ([[ADR-0031]])

"Sign in with Tamga" uses a **per-site pseudonym** ([[t:pseudonym]]) as the account key, not a credential value ([[t:ARF]]
Topic 11).

| Step | What the wallet does |
|---|---|
| Seed | It verifies the `urn:tamga:id:PseudonymSeed:1` credential that comes with the identity credential (same signer as the identity credential, the key of copy 0) and puts the seed into secure storage (Keychain / Keystore; hardware-protected in the store build). The seed does not appear in the credential list and is never offered to a DCQL query (PS3). |
| Request | A `format: "tamga-pseudonym"` query in DCQL (`meta.mode`: `single` / `multiple`). If there is no credential query, the request corresponds to a pseudonym-only sign-in (no credential). |
| Consent screen | A "Your pseudonym for this site" card: new, or used before (the value is not shown). On a `multiple` site the user picks one of their existing pseudonyms or a new one. A pseudonym is given only to a site registered in the trust list. |
| Derivation | After PIN/biometric approval: `k = HKDF-SHA256(seed, "tamga-pseudonym-v1\|" + site + "\|" + index)` → a P-256 key; pseudonym = the RFC 7638 thumbprint of the public key. Site = the registered `client_id` of the actual RP (with an intermediary, the actual RP; ADR-0017 K7). The key exists only in memory and is wiped after signing. |
| Presentation | In the vp_token, under the id of the pseudonym query, a `tamga-pseudonym+jwt`: the public key in the header, in the body `aud` = client_id, `nonce`, `rp`, plus a fresh WIA and PoP for this transaction. |
| My pseudonyms | Settings: site name, created / last used, a label the user gives (not sent to the site), delete. A deleted index is never derived again for that site; registering again opens a new index. Only the site name and the event are written to the log, never the pseudonym value. |

When the identity is verified again on a new phone, the same seed arrives → the same pseudonyms → the accounts on the sites
are recognised. The migration file (§7.5) carries neither the seed nor the key (LX2).

---

# 6. Schema cache

The implementation of [[ARCH-0003]]/CMP8.

| Rule | Value |
|---|---|
| When it is fetched | At installation and **when a credential of a new type is received** |
| How | In bulk — all related Type Metadata + the `extends` chain |
| When it is not fetched | **At presentation time** |
| Validity | Unlimited — `vct#integrity` defines the content ([[SPEC-SCHEMA-0001]] §7.1) |

**Invariant WL9:** the wallet makes no request to `schemas.tamga.network` at presentation time. If it did, the schema server
would collect "who used which credential type when".

If a type that is not in the cache is to be presented, the user is told "this credential type cannot be verified yet, an
internet connection is needed" and the fetch happens **with the user's approval**.

---

# 7. Backup and recovery

## 7.1 Backup content

```
encrypted_backup = AES-GCM(
    key     = HKDF(seed),
    content = {
        manifest:    [{ issuer, vct, received_at }],
        credentials: [SD-JWT strings],
        settings:    { language, notifications }
    }
)
```

**Not in the backup:** holder keys (WL1), `presentation_log` (WL4), `verifier_map`.

Why there is no `verifier_map`: new copies will be obtained on the new device anyway, so the old mapping is meaningless. It
also records which verifiers received presentations — the same rationale as WL4.

## 7.2 Server side

The backup may be uploaded to a Tamga-hosted store. The server **cannot decrypt** it — the key is derived from the seed and
the seed never goes to the server.

| What the server sees | What it does not see |
|---|---|
| Encrypted blob size | Content |
| Upload time | Which credentials |
| Wallet instance identifier | The user's identity |

## 7.3 Device change flow

```
1. Install on the new device
2. Enter the seed + set a new PIN
3. Download and decrypt the backup
4. The manifest is shown:
     ┌──────────────────────────────────────────┐
     │ 4 of your credentials must be re-issued  │
     │                                          │
     │ ☑ Diploma — Istanbul Bilgi Univ.         │
     │ ☑ Student certificate — Istanbul Bilgi U.│
     │ ☐ Driving licence — (state stage)            │
     │                                          │
     │ [ Request the selected ones again ]      │
     └──────────────────────────────────────────┘
5. An OID4VCI flow for each (SPEC-PROTO-0001)
     → new holder keys, new cnf, new idx
```

**The user is told clearly:** the old credentials can be viewed but not presented; re-issuance is needed. Hiding this is worse
than hitting a failure at presentation time.

## 7.4 Losing the seed

If the seed **and** the device are lost, there is no recovery. The user **applies again** to each institution and proves
their identity through the institution's own procedure ([[SPEC-PROTO-0001]] §11 — in-person binding).

This is not a disaster: the credentials are data the institution can produce again. What is lost is **access**, not data.

**Invariant WL10:** Tamga never holds a recovery key on the user's behalf. If it did, a centre able to open every wallet would
come into existence.

## 7.5 EU TS10 migration file

The wallet produces a migration file in the EU TS10 format (Settings → Move to a new phone):

- **Content:** `MigrationData`, i.e. the list of credentials to obtain again (`listOfCredentials`: vct, institution,
  institution address). There are no credentials that are not bound to the device.
- **Encryption:** JWE `PBES2-HS256+A128KW` + `A128GCM` with the person's password (TS10 §5).
- **Sharing:** it goes wherever the person chooses through the share menu; it does not go to Tamga.
- **In the new wallet:** the person opens the file; the list links to the institution's page with "obtain again" buttons
  (WL2).

Credential values, copies and keys do not enter the file. The transaction log does ([[ADR-0027]]); on import the person is
asked whether to restore the log. The log can also be exported on its own as an encrypted file (TS10 §4.1).

## 7.6 Reset the wallet and delete my data

Settings → **Reset the wallet and delete my data** (store rules: in-app deletion; KVKK art. 7). Order:

1. **Identity service** — for every credential obtained from the identity service, a presentation with no claims disclosed
   (SD-JWT VC + KB-JWT; aud = the service, nonce = the service's `/nonce`) → `POST {id}/erasure`. The service recognises the
   credential by its own signature and possession by the `cnf` key; it deletes the record and its event rows, revokes all
   copies, and has the session and images deleted at the remote identity verification provider ([[SPEC-ID-0003]] §9.1).
2. **Wallet provider** — `POST {wp}/units/delete` signed with the unit key: the unit is revoked (WIA bits), then the record
   (public key, version, device attestation data) is deleted ([[ADR-0025]]).
3. **Device** — all credentials and keys, the pseudonym seed, the log, the PIN (WL1: no recovery).

Without a network, step 3 is still done; if steps 1–2 cannot be done, the person is told and shown the e-mail route. Data
held by institutions (issuer, verifier) stays with them; the route is a TS7 erasure request (History → "Ask them to delete
my data").

---

# 8. Invariants

| # | Invariant |
|---|---|
| **WL1** | Holder keys are not derived from a seed; they do not leave the secure area. |
| **WL2** | The backup carries the credentials and the manifest; it does not carry keys — a device change requires re-issuance. |
| **WL3** | W1 (software-key) wallets are not supported. |
| **WL4** | The `presentation_log` never leaves the device to a server or automatically and does not enter the server backup; it leaves the device only in an export the person starts, encrypted with the person's password (TS10) ([[ADR-0027]]). |
| **WL5** | Always the same batch copy to a verifier; a different copy to a different verifier. |
| **WL6** | The disclosure set is consistent for the same verifier + the same `vct`. |
| **WL7** | Refresh without user action happens only under the conditions AR1–AR4 of [[ADR-0023]]. |
| **WL8** | The over-request warning requires a separate visual block + a delayed button. |
| **WL9** | No request to the schema server at presentation time. |
| **WL10** | Tamga does not hold a recovery key on the user's behalf. |
| **WL11** | Every presentation requires PIN or biometric approval. |
| **WL12** | The pass token (`tamga-pass+jwt`) carries no personal data: only `iss` (opaque pass_id), `aud`, `iat`, `exp` (≤ 60 s), `jti`; credential content and claims do not enter the QR code ([[ADR-0012]]). |
| **WL13** | A pass is generated only for an RP/terminal group registered in the trust list, and the consent given at registration is time-limited (≤ 6 months) and scoped; the user can withdraw consent at any moment (the grant is deleted). It is the only exception to WL11. |
| **WL14** | Every display of a pass is written to the `presentation_log` (within WL4, on the device); the Show screen displays a live clock and the remaining time. |
| **WL15** | Site pseudonym keys are not holder keys: they are derived only from the [[ADR-0031]] seed per site and index, and are not stored persistently; the seed stays only in the device's secure storage and enters no backup, no migration file and no presentation. |

---

# Security and privacy notes

**Recovery is the weakest point of holder binding.** The reasoning in §1.2 must be repeated: every design proposal that asks
for easy recovery must pass the question "does this make the credential transferable?". If the answer is yes, it is
rejected.

**The backup size is a signal.** From the blob size the server can estimate how many credentials there are. Mitigation: the
backup is padded to fixed-size blocks.

**The sticky mapping keeps a list.** `verifier_map` contains the verifiers to which the user has presented — it is as sensitive
as the `presentation_log` and subject to the same rules (it stays on the device, it does not enter the backup).

**PIN lockout is a DoS surface.** Someone who seizes the device can enter a wrong PIN 10 times and lock the wallet. Accepted
risk — the alternative is to leave it open to brute force.

---

# Open questions

1. Re-issuance on a new device requires the institution to still recognise the person. What will the university do if a
   graduate changes device 10 years later? A question of institutional process → [[PM-GTM-0001]].
2. How will W3 (certified WSCD) be detected in the state stage — device attestation or separate hardware? → `SPEC-WALLET-0002`
3. How costly is fixed-size padding of the backup? To be measured.
4. Are multiple devices (tablet + phone) supported? Not now — every device means a separate holder key, so a separate issuance
   for every device. Batch issuance could partly solve this but has not been designed.
5. Should `verifier_map` be shown to the user? For transparency yes, but a list of "which employers you applied to" is also
   visible to whoever gets hold of the phone.

---

# Related documents

[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-SCHEMA-0001]] ·
[[SPEC-SCHEMA-0002]] · [[SPEC-API-0001]] · [[ARCH-0003]] · [[PM-ASSUR-0001]] ·
[[PM-GOV-0001]] · [[INVARIANTS]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).
