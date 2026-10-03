---
document_id: ADR-0012
title: "Proximity presentation"
status: Active
version: 1.0.0
created: 2026-09-25
last_updated: 2026-10-02
summary: >
  Tamga profile for proximity presentation where the wallet shows a QR code (turnstiles, events, in-person checks):
  (B) a one-time registration with a registered verifier through a standard presentation, followed by a 60-second signed
  pass token containing no personal data; (C) for in-person checks, a reverse-initiated standard OpenID4VP flow via a
  short-lived request link shown by the wallet. Neither replaces the ARF proximity flow (ISO/IEC 18013-5); they bridge to
  it and move to Bluetooth in phase 1 behind the same "Show" screen. Single-use attestations use a status bit + a shared
  used-list between gates; not asking for the PIN at passage rests on limited, time-bound consent (S-16).
domain: Wallet
translation_of: ADR-0012
source_version: 1.0.0
---

# ADR-0012 — Proximity presentation (the wallet shows a QR code) and single-use attestations

**Status:** **Accepted — 2026-09-25** (K1–K5 and K7; K6 in a separate ADR). DECISIONS §0 **D-PROX-1**.
Screen flow: `…/2026-09-25-cuzdan-akis-tasarim-onerisi.md`. Precedent: Denmark's **AltID** (the official app; live clock
+ photo + large QR).

# Context

Today the only presentation flow is remote presentation: the [[t:verifier]] shows a QR code and the wallet scans it
([[t:OpenID4VP]] cross-device; [[SPEC-PROTO-0002]]). The target uses — campus turnstiles, event entry, museums, café tills,
in-person authorisation checks — require **the wallet to show a QR code**. The [[t:ARF]] defines this area as "proximity
presentation" and solves it with **ISO/IEC 18013-5**: the QR shown by the wallet is only *device engagement*; a
[[t:nonce]]-bound request/response then runs over BLE/NFC and the document format is **[[t:mdoc]]**. Our documents are
**[[t:SD-JWT-VC]]**; carrying SD-JWT VC over 18013-5 is not standard. The right long-term path is to issue identity and
student documents **also as mdoc** and implement 18013-5 in a real build (native BLE module) (phase 1, EAS). Expo Go has no
BLE today; mdoc issuance, a wallet mdoc store and a terminal BLE stack take weeks.

Principle: **the party that wants to be convinced generates the nonce.** If the wallet shows the QR, either a second channel
is opened (18013-5) or a time window + a replay list has to do. A single QR's capacity (≈2.9 KB) cannot carry an SD-JWT VC +
x5c chain; the QR carries either a **reference** or a **small signed token**.

# Decision

## K1 — Two bridge paths; ISO 18013-5 is the goal, the "Show" screen is fixed
| Path | Use | Mechanism | Standards status |
|---|---|---|---|
| **A — Remote presentation** (existing) | the verifier shows a QR | OpenID4VP cross-device | ARF as is |
| **B — Pass card** | a registered terminal reads every day (turnstile, event gate) | (1) **Registration:** presentation to a registered RP via path A; the RP returns a `pass_grant` (RP-signed: `pass_id`, copy-key fingerprint `cnf_kid`, `terminal_group`, `valid_until`). (2) **Show:** the wallet signs a **`tamga-pass+jwt`** with the copy key: `{iss: pass_id, aud: rp client_id, iat, exp = iat+60, jti}`; QR = compact JWS (≤ 400 bytes). The terminal verifies offline: the key in the `pass_grant`, `aud`, `exp`, the `jti` replay list. | Tamga profile (bridge) |
| **C — In-person check** | a person checks (staff, till) | the wallet shows a short-lived **`openid4vp://…request_uri`** in the QR: a link that **starts a standard OpenID4VP request** when scanned in the checker's Tamga Verifier app (the wallet has obtained a request ID for itself from the registered RP's `/vp/req` endpoint). The presentation runs the standard way (A); the user approves the fields in advance on the Show screen. | OpenID4VP; initiation reversed |
| **Phase 1 — ISO 18013-5** | all proximity | QR = device engagement, BLE/NFC session, mdoc | ARF |

- The **Show screen** is one design (card + live clock + large QR + "what you are sharing" + Change); B/C/phase 1 only change
  the mechanism behind the QR. No hard-to-reverse decision: the B/C token formats are **versioned** (via `typ`) and retired
  in phase 1; the document data model (claim set) is format-independent, and mdoc issuance is **an addition**.
- Phase 1 precondition: `mso_mdoc` equivalents of the identity and student/diploma types (a `docType` mapping in the
  catalogue), an EAS build, BLE.

## K2 — Pass token content and limits (B)
- The token contains **no personal data**: `iss` (opaque `pass_id`), `aud`, `iat`, `exp` (≤ 60 s), `jti`; header
  `typ: "tamga-pass+jwt"`, `alg: ES256`, `kid: cnf_kid`. The terminal does not know the person; it only sees "a valid right
  of passage"; identity is matched via the `pass_grant` in the RP's registration system (the campus already knows the
  student).
- The `pass_grant` is stored in the wallet (`WalletState.passes[]`), bound to the document copy and its key (WL5 kept: one
  RP = one copy). When the document is revoked or expires, the grant lapses; the RP can revoke a grant early (RP status
  list, phase 1).
- Screen: live clock + 60 s countdown; a screenshot is useless once the time runs out.

## K3 — Replay
- Terminals keep `jti` until `exp`; gates in the same terminal group **share the list online**. An offline gate only checks
  time and **accepts** this risk (a QR copied within 60 s may pass at another gate); the risk is recorded explicitly in this
  ADR.

## K4 — Single-use attestations (tickets)
- The organiser is both [[t:issuer]] and verifier: unlinkability is meaningless here, accepted. Mechanism: **1 copy per
  seat**, `exp` = end of the event, the gate sets the **status bit** "used" at passage; S6 (fixed-interval publication) is
  kept → a **shared used-list between gates is mandatory** (it stops a second passage within the interval).

## K5 — Terminal class in the RP record
- `terminal_groups[]` (group ID, certificate fingerprint, offline allowed or not) is added to the `relying_parties[]`
  ([[t:relying-party]]) record; a terminal can only be defined under a registered RP ([[SPEC-TRUST-0001]] minor version). On
  the Show screen the wallet produces a pass card only for a registered RP/terminal group.

## K6 — Institutional mandate (deferred)
- An attestation "person X is authorised on behalf of institution Y" (candidate `urn:tamga:org:MandateAttestation:1`) is
  a **separate ADR**.

## K7 — Written principle
- A principle in FW-TF-0001: "The verification challenge (nonce) is generated by the party that wants to be convinced; in
  proximity the wallet shows and a second channel is opened; a single QR carries only a short-lived reference or a signed
  token without personal data."

## K8 — Consent and the WL11 exception (deviation S-16)
- With a pass card the PIN/biometric is **not asked** at every showing: the consent given at registration (path A) counts as
  **time-bound** (`valid_until`, at most one term ≈ 6 months) and **scoped** (only that RP/terminal group); every showing is
  written to the history; the user can withdraw consent from the Show screen (the grant is deleted). It is a proportionate
  exception to WL11, limited by [[SPEC-WALLET-0001]] WL12–WL14.

# Rationale
The desired experience ("raise, show, pass") is weeks away today via the ARF target path (mdoc + BLE + a real build); the
bridge paths **do not imitate** the standard — they either start a standard OpenID4VP flow in reverse (C) or use a
versioned token without personal data that is explicitly documented as non-standard (B). Because the screen and the data
model stay fixed, the phase 1 move changes only the transport layer. The AltID precedent shows this approach is live in a
state application.

# Alternatives considered
- **Doing ISO 18013-5 right away:** not standard with SD-JWT VC; needs mdoc issuance + BLE + EAS; impossible in Expo Go.
  **Moved to phase 1.**
- **Putting the whole document in the QR:** size and privacy (the document goes to the terminal). Rejected.
- **The terminal shows a QR and the student scans it (D):** poor experience, needs a turnstile screen. Kept as a fallback.
- **A generic "anyone may read" QR (unregistered checker):** personal data goes to an unregistered party, contrary to
  Tamga's "RPs must be registered" principle. Rejected.

# Consequences
- Code: `@tamga-network/wallet-core` `pass.ts` (grant storage, token generation), the wallet's Show screen with a real QR,
  `@tamga-network/verifier` `pass.ts` (grant issuance + token verification + jti list), the `apps/verify` `/terminal` page
  and `/terminal/verify`, a campus policy (`campus-access`), scene 12 (`demo-scenes`). Path C (reverse initiation + the
  Verifier "Check" screen) is the second step.
- Documents: [[SPEC-WALLET-0001]] WL12–WL14; [[SPEC-API-0001]] AP13; [[SPEC-TRUST-0001]] `terminal_groups` (minor version);
  FW-TF-0001 §3.7 + principle; an FW-ARF-0001 table row; 09-DEMO-KURGU S-16 + scene 12; 08-BACKLOG D9.

# Open points
1. Upper limit of the consent period (proposal 6 months) and a daily limit on showings — with pilot data.
2. Phase 1 mdoc `docType` mapping and issuance profile — a separate specification update.
3. In path C, the content of the result screen the checker sees (photo only on the device, or for the checker too) —
   together with the SPEC-ID-0003 portrait claim.
