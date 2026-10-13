---
document_id: ADR-0049
title: "The \"Listed on Tamga Network\" indicator"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  In place of the EU Digital Identity Wallet Trust Mark, a written indicator for wallets in the network's trusted list:
  "Tamga Network'te listeli" / "Listed on Tamga Network". There is no logo; the EU stars, the EU colours and the words "trust
  mark" are not used. Tapping the indicator shows the `wallet_providers[]` entry in the signed trusted list. The indicator is
  hidden when the wallet unit is revoked or the wallet provider leaves the list. The rule is the same for every wallet in the
  network. Changes the "trust mark" wording of RB-WP-10. Implemented in 0.6.0. Accepted 2026-10-13.
domain: Wallet
related: ["[[ADR-0035]]", "[[ADR-0042]]", "[[ADR-0047]]", "[[SPEC-TRUST-0001]]", "[[FW-RB-0001]]"]
translation_of: ADR-0049
source_version: 1.0.0
---

# In short

A wallet in the network's trusted list tells the person **in words** that it is listed: "Listed on Tamga Network". It is not an EU
mark and does not look like one. When the person taps the text, the wallet shows the wallet provider entry in the signed list; the
indicator is a verifiable statement, not decoration.

# Context

- **The EU rule.** Article 14a of Implementing Regulation (EU) 2024/2979 (added by 2026/1731) requires certified EU wallets to show
  the EU Digital Identity Wallet Trust Mark; its form, colours and sizes are fixed; the mark is not shown when the wallet unit
  attestation is revoked (EU TS1). The mark is only for a certified wallet provided or recognised by an EU member state.
- **Tamga's situation.** No wallet in the network is an EU wallet, and none can use the mark ([[ADR-0035]] PO4). But the problem the
  EU solves with the mark exists in Tamga too: a person wants to know whether the app on the phone is a wallet that follows the
  network's rules and is registered in the list. Today RB-WP-10 asks wallets for a "this wallet is on the Tamga trusted list" view
  called a "trust mark"; that name can be confused with the EU mark and carries legal and app store risk.
- **Name.** Project management approved the names "Tamga Network'te listeli" (Turkish) and "Listed on Tamga Network" (English) on
  2026-10-13.

# Decision

## K1 — Written indicator, no logo

- The indicator is text only: in Turkish **"Tamga Network'te listeli"**, in English **"Listed on Tamga Network"**; in other
  languages a translation of the same meaning.
- No logo, badge or seal form is used. The EU stars, the colours and layout of the EU flag, and the words "trust mark", "güven
  işareti", "EU", "EUDI" or "approved / certified" **MUST NOT** be used in or next to the indicator.
- The place and typography of the indicator are the wallet's own design; it sits where the person can find it (for example the
  wallet information or the settings).

## K2 — Tap to see the signed entry

- When the indicator is tapped, the wallet shows its own `wallet_providers[]` entry in the trusted list whose signature it has
  verified: the provider's legal name, `provider_id`, entry and solution status (`status`), wallet assurance level and the time the
  list was published ([[SPEC-TRUST-0001]]).
- The information is read from the verified list the wallet already holds; no network request is made when it is shown.
- The wallet may also show the public address of the list, so the person can check the entry from outside the wallet.

## K3 — When it is hidden

The indicator **MUST** be hidden in any of these cases:
1. the wallet unit is revoked (by the wallet provider, at the person's request or through the WIA status list; [[ADR-0047]]);
2. the wallet provider's entry or the entry of the solution in use is not `ACTIVE` in the trusted list (suspension, revocation,
   removal, placeholder entry);
3. the trusted list the wallet holds cannot be verified or has expired (a stale list is not enough to say "listed");
4. the wallet is attached only to the sandbox list: being listed in the sandbox does not give the indicator ([[ADR-0038]]).

## K4 — The same for every wallet in the network

The rule is a network rule and applies in the same way to every wallet in the trusted list ([[ADR-0042]]). An app that is not in
the list cannot use the indicator or a similar phrase; doing so breaks the participation rules. The wallet provider's metadata has
no "trust mark" field for this indicator; the provider's information page is given in the `provider_information_uri` field under
the name "Provider information" (the wallet's own decision).

## K5 — Implementation

The network rule applies from today; in Tamga Wallet the indicator and the entry page behind it come with release 0.6.0 of the
packages (`wallet-core` entry reading and hiding conditions).

# Options considered

| Option | Result | Why |
|---|---|---|
| Using the EU Trust Mark or a logo resembling it | rejected | Legally it is only for a certified EU wallet; a resemblance misleads and is a risk in app store review |
| An own "Tamga trust mark" with a logo | rejected | The name "trust mark" recalls the EU mark; a logo says nothing verifiable |
| No indicator at all | rejected | The person cannot learn whether the app is registered in the network; the need the EU addresses remains |
| **Written, verifiable indicator** | **accepted** | It says the right thing (registered in the list), shows the entry, disappears on revocation |

# Invariants

| Code | Rule |
|---|---|
| LI1 | The indicator is text only ("Tamga Network'te listeli" / "Listed on Tamga Network"); no logo, EU stars or colours, and no "trust mark" wording are used. |
| LI2 | Tapping the indicator shows the `wallet_providers[]` entry in the trusted list whose signature has been verified. |
| LI3 | The indicator is not shown if the wallet unit is revoked, if the provider or solution entry is not `ACTIVE`, if the list cannot be verified, or if the wallet is attached only to the sandbox. |

# Consequences

- [[FW-RB-0001]]: RB-WP-10 is rewritten, RB-WP-18 is added.
- `wallet-core` (0.6.0): a helper that returns the provider entry and the hiding conditions.
- Tamga Wallet: the indicator and the entry page; in the provider, `provider_information_uri` instead of a `trust_mark` field (the
  wallet's own decisions).

# Status

**Accepted — 2026-10-13.** Approved by project management (first EU alignment review, decisions 4 and 9c). DECISIONS: D-WALLET-3.
