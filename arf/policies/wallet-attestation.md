---
title: "Wallet Attestation Policy"
translation_of: FW-POL-0002
source_version: 1.0.0
outline: [2, 3]
---

# Wallet Attestation Policy (WIA and KA)

<div class="arf-meta">

**Document** FW-POL-0002 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-11 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The policy that brings together in one place how every wallet provider in the Tamga trust list issues the wallet instance attestation
(WIA) and the key attestation (KA), under which conditions it revokes them and how it publishes the revocation (EU ARF VCR_05,
WURevocation_03, WURevocation_09a). The network operates no wallet; this document is the minimum policy the network expects from the
wallet providers in the list, compiled from ADR-0025, the wallet specification and the rules of the Tamga Rulebook.

## 1. Scope and status

Tamga Network operates no wallet and no wallet provider; it recognises wallets by their entries in the trust list
(`wallet_providers[]`) ([[ADR-0042]]). This policy brings together the network's minimum rules for the two attestations issued by
every [[t:wallet-provider]] in the list:

- **Wallet instance attestation ([[t:WIA]])** — the short-lived attestation with which the wallet application (Wallet Instance)
  introduces itself to an issuer;
- **Key attestation (KA)** — the attestation showing in which secure hardware and with which user authentication the credential keys
  are protected.

Together they are the counterpart of the EU wallet unit attestation (WUA). The policy makes no decisions: the rules are compiled from
[[ADR-0025]], [[SPEC-WALLET-0001]], [[SPEC-PROTO-0001]] §11.1, the RB-WP and RB-AP rules of the Tamga Rulebook and the Trust Framework
(Annex A). Every wallet provider follows these rules; it writes its own operational details (e.g. installation, support,
notification channels) in its own policy.

## 2. Activation of the wallet unit

| Rule | Source |
| --- | --- |
| At first installation the wallet registers a **unit key** with the provider; this key is used only between the wallet and the provider and is never shown to an institution; requests concerning the unit are signed with the unit key | [[ADR-0025]] K1 |
| The unit record holds only the unit key's fingerprint, the solution and version, the registration time, the revocation state and the WIA status list entries issued to the unit; **no personal data is kept** | [[ADR-0025]] K1, WIA2 |
| Holder keys are generated in the device's secure area (W2) or in certified secure hardware (W3); they cannot be exported and are not derived from a seed; no credential is issued to a wallet with software keys (W1) | RB-WP-01, [[SPEC-WALLET-0001]] WL1, WL3 |
| The wallet provider holds no recovery key on the user's behalf | RB-WP-07 |

## 3. Issuance of the WIA

| Rule | Source |
| --- | --- |
| Format: OpenID4VCI 1.0 Appendix E (`oauth-client-attestation+jwt`); EU TS3 §2.3.1 attributes: `sub`, `wallet_name`, `wallet_version`, `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk` | [[ADR-0025]] K2 |
| The WIA declares the wallet version, that the key is in hardware and that a PIN or biometrics is enabled | RB-WP-02 |
| Lifetime **shorter than 24 hours**; `client_status.exp` at least 31 days ahead | [[ADR-0025]] K2, WIA1 |
| **A new WIA for every issuance**: a new proof-of-possession (PoP) key and a new, mutually unlinkable status list entry. No reuse per issuer; so the provider does not learn how many institutions the wallet talks to | [[ADR-0025]] K2, WIA1 |
| The WIA is signed with the provider's signing key registered in the trust list | RB-WP-02, [[SPEC-TRUST-0001]] |

## 4. Issuance of the KA

| Rule | Source |
| --- | --- |
| Format: OpenID4VCI 1.0 Appendix D (`typ` `key-attestation+jwt`); EU TS3 §2.3.2 attributes: `attested_keys`, `key_storage`, `user_authentication` (ISO 18045 levels), `certification`, `key_storage_status {status, exp}` | [[ADR-0025]] K3 |
| **The level tells the truth:** the key storage level in the KA rests on a verified state; an unverified claim is not written into the KA. For uncertified hardware the certification information stays empty | [[ADR-0025]] WIA3 |
| One KA carries all credential keys of a batch; each key appears in only one KA; a KA is used once; the proof of the credential request is signed with `attested_keys[0]` and carries the KA in its header | [[ADR-0025]] K3 |
| KA revocation uses **one shared entry per key storage type** (EU TS3 Option 1): software storage, Secure Enclave, StrongBox … each type has one entry; the unit identity cannot be derived from the KA | [[ADR-0025]] K3 |

## 5. Revocation conditions

### 5.1 WIA

| Condition | Result | Source |
| --- | --- | --- |
| The person says "Revoke this wallet" in the wallet (device hand-over, sale) | The unit and all WIA entries issued to it are revoked | [[ADR-0025]] K4 |
| The person resets the wallet and deletes their data | The unit is revoked (WIA bits), then the record is deleted | [[SPEC-WALLET-0001]] §7.6 |
| A compromise is found in a single wallet unit | That unit is revoked | RB-WP-11 |
| A vulnerability is found in the wallet solution (in a version) | The wallet attestations of that version are revoked; issuers reject them for new credentials | RB-WP-11, Annex A §4.6 |
| A unit is revoked | All WIA entries issued to that unit are revoked | [[ADR-0025]] WIA2 |

Revocation from a lost or stolen device (when the person has no access to the device) requires a user account (EU WIAM_06); it was
left to a later step ([[ADR-0025]] K4) and is an **open decision** (§9).

### 5.2 KA

| Condition | Result | Source |
| --- | --- | --- |
| A vulnerability or compromise is found that undermines the trustworthiness of a key storage or secure hardware **type** | The provider revokes that type's KA entry; no new credential is issued with keys of that type | [[ADR-0025]] K3, Annex A §4.6, EU ARF WURevocation_09a |
| Compromise of one version or of a single unit | Via the WIA as in §5.1; the KA entry belongs to the type, not to the unit | [[ADR-0025]] K3 |

## 6. Publication of revocation

| Rule | Source |
| --- | --- |
| The provider publishes two Token Status Lists: WIA entries and KA types. It signs the lists with its own key registered in the trust list | [[ADR-0025]] K4 |
| The WIA list has at least 10,000 entries; entries are distributed so that they cannot be linked to a unit | [[ADR-0025]] K2, K4 |
| The list addresses appear in every WIA (`client_status`) and KA (`key_storage_status`); the provider's address is in its trust list entry | [[ADR-0025]], [[SPEC-TRUST-0001]] |

## 7. Checks by issuers

| Rule | Source |
| --- | --- |
| Before issuance the issuer verifies the WIA and KA against the `wallet_providers[]` list and checks that the secure hardware level meets the type's requirement | RB-AP-10 |
| WIA at the PAR and token endpoints: signature, provider key in the list, lifetime, PoP (`cnf`), `client_status` not revoked. KA at the credential endpoint: signature, the proof signed with `attested_keys[0]` and the nonce, `key_storage_status` not revoked, the `key_storage` level meets the institution's minimum | [[ADR-0025]] K5 |
| The issuer **does not issue** with a revoked WIA or KA | [[ADR-0025]] WIA4 |
| The institution's key storage requirement is announced in its issuer metadata (`key_attestations_required {key_storage, user_authentication}`) | [[ADR-0025]] K5 |

## 8. Incidents and notification

- A vulnerability in the wallet solution is a critical or high-severity incident: a critical incident is reported to the scheme owner
  within 4 hours at the latest, a high-severity incident within 24 hours at the latest (RB-GEN-09, Annex A §4.6).
- The wallet offers the "this wallet is in the Tamga trust list" view and the "where are my keys" explanation (RB-WP-10).
- If the provider's trust list entry is suspended or removed, issuers no longer accept that provider's attestations; only `ACTIVE` keys
  of an `ACTIVE` entry are used ([[SPEC-TRUST-0001]]).

## 9. Open decisions

| Topic | Status |
| --- | --- |
| Alignment with ETSI TS 119 471 clauses 6–7 and Implementing Regulation (EU) 2025/1569 (WURevocation_03) | The EU requires the wallet provider to write its WIA and KA policy in line with these clauses. This policy has not yet been compared with them line by line; the comparison and any additional clauses are an **open decision** |
| Revocation from a lost or stolen device (EU WIAM_06) | Requires a user account; [[ADR-0025]] left it to a later step. The method is an **open decision** |
| A revocation entry per key for the KA (EU TS3 Option 2) | To be addressed with the move to secure hardware ([[ADR-0025]] "later") |
| Notifying the person of wallet revocation outside the wallet (EU WURevocation_14/16) | No network-level rule; each wallet provider decides. A network rule is an **open decision** |
| Device attestation (App Attest, Android key attestation, Play Integrity) | Making device attestation mandatory at network level at activation is an **open decision**; today the wallet provider decides |

## Status

**Active** — version 1.0.0 (11 October 2026).
