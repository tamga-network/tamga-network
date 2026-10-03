---
document_id: GUIDE-0010
title: "Wallet pre-release checklist"
status: Active
version: 1.0.1
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  The checklist to go through before submitting a Tamga-compatible wallet to the app stores: keys and device attestation,
  registration, receiving credentials, presenting and the consent screen, privacy and the transaction log, changing devices and
  deletion, the trust list, conformance tests and the stores.
translation_of: GUIDE-0010
source_version: 1.0.1
---

# Wallet pre-release checklist

This page is for teams getting the wallet described in [[GUIDE-0005]] ready for release. Every item rests on a rule; the rule
codes are in [[SPEC-WALLET-0001]], the full list in [Tamga ARF — Tamga Rulebook, RB-WP](https://arf.tamga.network/rulebook).

**When to read it:** before the first store submission and before every major release.

## Keys and device

- Credential keys are generated in the device's secure area (Secure Enclave, StrongBox or at least TEE); they cannot be
  exported; they are not derived from a seed (WL1).
- Software keys exist only in test builds; in a store build, falling back to software keys is shown clearly to the person (WL3).
- Unit registration sends device evidence: App Attest on iOS, the key attestation chain on Android ([[GUIDE-0005]] §4).
- The case where the evidence is rejected has been tried: the unit registers at software level and the person is warned.
- The app identity (Bundle ID, package name) is the one the wallet provider expects.

## Registration

- The wallet solution is registered in the trust list under `wallet_providers[]`; the WUA signing key is in the list.
- The app version is not older than the solution's registered minimum version (`min_version`).

## Receiving credentials

- The offer QR and the PIN (`tx_code`) arrive through separate channels; the app does not take the PIN from the same place as the offer.
- Each copy is bound to its own key; an incoming credential is checked locally (`receiveCredentials`).
- The WUA is renewed before it expires (`wuaExpiringSoon`); credential operations use the WIA and the key attestation.
- Renewal without the person's action happens only under the allowed conditions (WL7, [[ADR-0023]]).

## Presenting and the consent screen

- The request signature and certificate are checked (`verifyRequestObject`); the verifier's entry is read from the signed list (`checkRp`).
- The screen shows the verifier's name, the purpose, the requested fields one by one and the privacy policy; with an
  intermediary, the actual site is shown ([[ADR-0017]]).
- Out-of-scope fields are shown in a separate visual block with a delayed button (WL8).
- Every presentation asks for a PIN or biometrics (WL11).
- The same verifier always gets the same copy, a different verifier a different copy; the person is asked when copies run out (WL5, WL6).
- No request is made to the schema server at presentation time (WL9).
- "Invalid" and "could not be verified" are shown differently ([[SPEC-CRED-0003]] S14).

## Privacy and the log

- The transaction log stays on the device; it holds only field names, not values; it does not go to a server or to automatic backup (WL4).
- Exporting the log is only started by the person and encrypted with their own password (TS10, password of at least 8 characters).
- Error logs, analytics and crash reports contain no personal data, credential content or credentials.
- The pass QR carries no personal data; the token lives for at most 60 seconds (WL12).

## Changing devices and deletion

- Backup and migration files carry no keys; on a new device credentials come back through a "receive again" list (WL2, WL10).
- The person is asked whether to restore the log.
- When a device is handed over, the unit is revoked (`revokeUnit`).
- Account and data deletion works from inside the app (`deleteUnit`, `requestIdentityErasure`); for data institutions hold,
  the way to file a request is shown.

## Trust list

- The root fingerprints are embedded in the app (`TRUST_PINS`); the list server is not trusted.
- If the list is stale or cannot be downloaded, the answer is "could not be verified"; processing stops on an unknown format version.
- List files are not interpreted by hand; only `@tamga-network/trust/core` is used ([[ADR-0015]]).

## Conformance and stores

- Conformance vectors and commitment tests pass; the results report is ready ([[GUIDE-0009]]).
- Receiving, presenting, changing devices and deletion have been tried end to end on real iOS and Android devices (test
  network: [[GUIDE-0013]]); revoked and suspended states have been tried too.
- A test account and instructions are ready for store review ([[ADR-0033]]).
- The privacy declaration (App Store privacy label, Google Play data safety form) is consistent with the on-device log and the
  deletion path.

## Related

- Step by step: [[GUIDE-0005]] · Rules: [[SPEC-WALLET-0001]] · Troubleshooting: [[GUIDE-0012]]
