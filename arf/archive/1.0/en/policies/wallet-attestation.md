---
title: "Wallet Attestation Policy"
translation_of: FW-POL-0002
source_version: 1.0.0
outline: [2, 3]
---

# Wallet Attestation Policy (WIA and KA)

<div class="arf-meta">

**Document** FW-POL-0002 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-16 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The policy that brings together in one place how every wallet provider in the Tamga trust list issues the wallet instance attestation
(WIA) and the key attestation (KA), under which conditions it revokes them and how it publishes the revocation (EU ARF VCR_05,
WURevocation_03, WURevocation_09a) and maps it to ETSI TS 119 471 clauses 6–7. The network operates no wallet; this document is the minimum policy the network expects from the
wallet providers in the list, compiled from ADR-0025, ADR-0047, the wallet specification and the rules of the Tamga Rulebook.

## 1. Scope and status

Tamga Network operates no wallet and no wallet provider; it recognises wallets by their entries in the trust list
(`wallet_providers[]`) ([[ADR-0042]]). This policy brings together the network's minimum rules for the two attestations issued by
every [[t:wallet-provider]] in the list:

- **Wallet instance attestation ([[t:WIA]])** — the short-lived attestation with which the wallet application (Wallet Instance)
  introduces itself to an issuer;
- **Key attestation (KA)** — the attestation showing in which secure hardware and with which user authentication the credential keys
  are protected.

Together they are the counterpart of the EU wallet unit attestation (WUA). The policy makes no decisions: the rules are compiled from
[[ADR-0025]], [[ADR-0047]], [[SPEC-WALLET-0001]], [[SPEC-PROTO-0001]] §11.1, the RB-WP and RB-AP rules of the Tamga Rulebook and the Trust Framework
(Annex A). Every wallet provider follows these rules; it writes its own operational details (e.g. installation, support,
notification channels) in its own policy.

## 2. Activation of the wallet unit

| Rule | Source |
| --- | --- |
| At first installation the wallet registers a **unit key** with the provider; this key is used only between the wallet and the provider and is never shown to an institution; requests concerning the unit are signed with the unit key | [[ADR-0025]] K1 |
| The unit record holds only the unit key's fingerprint, the solution and version, the registration time, the revocation state and the WIA status list entries issued to the unit; **no personal data is kept** | [[ADR-0025]] K1, WIA2 |
| Holder keys are generated in the device's secure area (W2) or in certified secure hardware (W3); they cannot be exported and are not derived from a seed; no credential is issued to a wallet with software keys (W1) | RB-WP-01, [[SPEC-WALLET-0001]] WL1, WL3 |
| The wallet provider holds no recovery key on the user's behalf | RB-WP-07 |
| **Device attestation:** at level W3 the provider verifies the platform's device attestation (Apple App Attest, Android key attestation, Play Integrity) when activating the unit and before every KA that declares W3; it issues no W3 KA to an unverified device. At W2 device attestation is optional | RB-WP-17, [[ADR-0047]] K5 |
| A revocation path without the phone is set up at activation: the provider offers a way for the person to revoke the unit without having the phone; it requires no user account (for example a revocation secret shown once, of which the provider keeps only a slow hash) | RB-WP-15, [[ADR-0047]] K3 |

## 3. Issuance of the WIA

| Rule | Source |
| --- | --- |
| Format: OpenID4VCI 1.0 Appendix E (`oauth-client-attestation+jwt`); EU TS3 §2.3.1 attributes: `sub`, `wallet_name`, `wallet_version`, `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk` | [[ADR-0025]] K2 |
| The WIA declares the wallet version, that the key is in hardware and that a PIN or biometrics is enabled | RB-WP-02 |
| The WIA has the generic client attestation format (OAuth attestation-based client authentication -07): the provider sends `iss` and `iat`; the issuer verifies every client attestation through one path as a WIA (the legacy WUA path is removed), does not require `iss`, tolerates a missing `iat` in the attestation and requires `iat` in the PoP; without `client_status` the issuer's `clientStatus` setting applies (`optional` by default, `required` for the identity service) (packages 0.5.2). The rule that the WIA's `cnf` key is the DPoP key is not applied: EU TS3 1.5.2 rolled back this 1.5.1 rule (correction of 2026-10-13) | [[ADR-0025]] note of 2026-10-13 |
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
| The phone is lost or stolen; the person uses the revocation path without the phone (§2) | The unit and all WIA entries issued to it are revoked; the identity service revokes its credentials on that unit within 24 hours; institution credentials are not revoked, they cannot be used because they are bound to the device key | RB-WP-15, RB-AP-ID-12, [[ADR-0047]] K1, K3 |

Revocation from a lost or stolen phone **requires no user account** ([[ADR-0047]] K3). Instead of the account foreseen in EU WIAM_06, a
revocation secret recorded at activation is used; the conditions "explicit request of the person" and "registered at activation"
(WURevocation_10) are met. Tamga Wallet does this with its revocation code and its "I lost my phone" page.

### 5.2 KA

| Condition | Result | Source |
| --- | --- | --- |
| A vulnerability or compromise is found that undermines the trustworthiness of a key storage or secure hardware **type** | The provider revokes that type's KA entry; no new credential is issued with keys of that type | [[ADR-0025]] K3, Annex A §4.6, EU ARF WURevocation_09a |
| Compromise of one version or of a single unit | Via the WIA as in §5.1; the KA entry belongs to the type, not to the unit | [[ADR-0025]] K3 |

### 5.3 Telling the person about revocation

| Rule | Source |
| --- | --- |
| The provider offers at least one way, **outside the wallet**, for the person to learn that their wallet unit was revoked; the way does not make collecting personal data mandatory | RB-WP-16, EU WURevocation_16, [[ADR-0047]] K4 |
| If the provider revoked the unit on its own decision (a vulnerability), this way shows within 24 hours at most the reason in plain language, the technical details of the vulnerability or a link to them, which functions keep working and how the person can get a working wallet again | RB-WP-16, EU WURevocation_14 |
| The wallet itself may also tell the person; this does not replace the way outside the wallet | EU WURevocation_16 |

Tamga Wallet meets this rule with public security advisories and a data-free "My wallet's status" page opened with the revocation
code.

## 6. Publication of revocation

| Rule | Source |
| --- | --- |
| The provider publishes two Token Status Lists: WIA entries and KA types. It signs the lists with its own key registered in the trust list | [[ADR-0025]] K4 |
| The WIA and KA status lists each have at least 10,000 entries; entries are distributed so that they cannot be linked to a unit. An issuer does not accept a WIA or KA whose list is below this bound | [[ADR-0025]] K2, K4 and the note of 2026-10-13; Implementing Regulation (EU) 2024/2979 Annex Ib |
| The list addresses appear in every WIA (`client_status`) and KA (`key_storage_status`); the provider's address is in its trust list entry | [[ADR-0025]], [[SPEC-TRUST-0001]] |

## 7. Checks by issuers

| Rule | Source |
| --- | --- |
| Before issuance the issuer verifies the WIA and KA against the `wallet_providers[]` list and checks that the secure hardware level meets the type's requirement | RB-AP-10 |
| WIA at the PAR and token endpoints: signature, provider key in the list, lifetime, PoP (`cnf`), `client_status` not revoked. KA at the credential endpoint: signature, the proof signed with `attested_keys[0]` and the nonce, `key_storage_status` not revoked, the `key_storage` level meets the institution's minimum | [[ADR-0025]] K5 |
| The issuer **does not issue** with a revoked WIA or KA | [[ADR-0025]] WIA4 |
| The institution's key storage requirement is announced in its issuer metadata (`key_attestations_required {key_storage, user_authentication}`) | [[ADR-0025]] K5 |
| An institution that wants a minimum revocation maintenance period announces it: for the KA `key_attestations_required.preferred_key_storage_status_period`, for the WIA the top-level `preferred_client_status_period` (seconds). The wallet sends no KA that misses the requirement and asks the provider for a longer WIA or KA when the remaining maintenance period is short; if the provider cannot give one, the institution limits the credential's validity to the maintenance period (an institution that revokes in a chain) | EU ARF WUA_05a, WUA_32, ISSU_12c; EU TS3 §2.4 |

## 8. Incidents and notification

- A vulnerability in the wallet solution is a critical or high-severity incident: a critical incident is reported to the scheme owner
  within 4 hours at the latest, a high-severity incident within 24 hours at the latest (RB-GEN-09, Annex A §4.6).
- The wallet offers the "this wallet is in the Tamga trust list" view and the "where are my keys" explanation (RB-WP-10).
- If the provider's trust list entry is suspended or removed, issuers no longer accept that provider's attestations; only `ACTIVE` keys
  of an `ACTIVE` entry are used ([[SPEC-TRUST-0001]]).

## 9. Mapping to ETSI TS 119 471 clauses 6–7 (WURevocation_03)

The EU requires the wallet provider's WIA and KA policy to be in line with clauses 6 and 7 of ETSI TS 119 471 (V1.1.1, 2025-05;
policy and security requirements for providers of EAA services). The table below meets those clauses line by line; read "WIA and
KA" for "EAA" and "wallet provider" for "EAASP". The obligations belong to every wallet provider in the list; the provider writes how
it meets them in its own practice statement. Items marked "before the pilot" are targets in the list phase and mandatory before a
pilot with real people. The general references of TS 119 471 to EN 319 401 (for example "EN 319 401 clause 7.2 applies") mean that
the provider complies with EN 319 401.

| TS 119 471 | Topic | In this policy / the provider's obligation |
| --- | --- | --- |
| 5 | Risk assessment (EN 319 401 §5) | The provider carries out a written risk assessment for the WIA and KA service and updates it yearly and on major changes |
| 6.1.1 | Practice statement; describing the revocation mechanism in it (REQ-EAASP-6.1-02) | The provider publishes a public practice statement; it refers to this policy and describes the revocation mechanism (§5, §6) |
| 6.1.2 | Provider linkability; not tracking the person in collusion with relying parties | A new WIA and a mutually unlinkable status entry for every transaction; the KA entry belongs to the type (§3, §4). The provider gives the mapping between unit and entry to no issuer or relying party and says so in its statement ([[ADR-0025]] WIA1, WIA2) |
| 6.2 | Terms and conditions; acceptance by a wilful act that can be evidenced; retention period of the records | The provider shows the terms of use before activation; acceptance is a wilful act in the wallet. The evidence of acceptance is kept **without personal data** (the version of the terms and the time of acceptance in the unit record). The retention period is stated in the terms |
| 6.2 (REQ-EAASP-6.2.4-05) | Informing in advance how personal data will be used, and consent | The unit record holds no personal data ([[ADR-0025]] WIA2). If the provider collects optional personal data (for example a contact email), it informs first and obtains explicit consent |
| 6.3 | Information security policy (EN 319 401 §6.3) | The provider has an information security policy approved by its management and reviewed yearly |
| 6.4 | Attestation policy: what the attestation declares, format, verification, trust framework, proof of possession | This policy and the provider's statement: the claims and format of the WIA and KA §3–§4; trust framework the Tamga ARF; verification §7; proof of possession `cnf` and `attested_keys[0]` |
| 7.1.1 | Independence in issuance and revocation decisions; freedom from commercial pressure; a documented structure that safeguards impartiality | The provider defines in writing who takes a revocation decision (in particular a revocation it initiates) and by which criteria; the decision is not influenced by commercial relations |
| 7.1.2, 7.2, 7.3 | Segregation of duties, human resources, asset management (EN 319 401) | According to EN 319 401; trusted roles are defined |
| 7.4 | Access control: multi-factor authentication on every account able to cause issuance; continuous monitoring and alarms; logging of authentication attempts | The provider uses multi-factor authentication on every operational account that can cause a WIA or KA to be issued, revoke a unit or reach the signing key; it monitors and logs unauthorised access attempts (no personal data in the log, RB-GEN-06) |
| 7.5.1–7.5.2 | Key generation: secure environment, at least dual control, a documented ceremony and ceremony report, TS 119 312 algorithms | The WIA, KA and status list signing keys are ES256 (RB-AP-04). **Before the pilot:** the keys are generated in a documented ceremony with at least two people present; the ceremony report (roles, evidence, date, key inventory and fingerprints) is kept |
| 7.5.3 | Key protection: an EAL 4+ or FIPS 140-2/140-3 Level 3 secure cryptographic device; back-ups under the same protection; key destruction when the device is retired | **Before the pilot:** the signing keys are kept in a hardware security module or an equivalent certified cloud key service; back-ups are taken under dual control. In the list phase the key may be kept encrypted on the server; this deviation is stated in the provider's statement |
| 7.5.4 | Key usage: stop at the end of life; only for issuance and revocation status | The provider's signing key signs only WIAs, KAs and its own status lists; key rollover goes through the trust list entry ([[SPEC-TRUST-0001]]) |
| 7.5.5 | Wallet-specific: binding the credential to the device's secure hardware; verifying that the key is in secure hardware; selective disclosure; combined presentation; reducing linkability; cryptographically independent copies in a batch | The KA carries only keys generated in secure hardware; the level rests on a verified state ([[ADR-0025]] WIA3; device attestation at W3, RB-WP-17). Each copy is a separate key and a key appears in one KA only (§4; RB-AP-09). Selective disclosure and combined presentation belong to the credential formats (SD-JWT VC, mdoc) |
| 7.6 | Physical and environmental security (EN 319 401) | The provider's servers are in a data centre with controlled access |
| 7.7 | Operation security; capacity monitoring | The provider monitors the capacity of the WIA and KA endpoints and the status lists; the WIA and KA status lists have at least 10,000 entries and are enlarged before they fill (§6) |
| 7.8 | Network security: secure zone; disabling unused accounts, services and ports; encrypted channels | All endpoints only over TLS; unused services and ports closed; the component that reaches the signing key in a separate zone |
| 7.9 | Vulnerability and incident management (EN 319 401) | §8: a critical incident is reported to the scheme owner within 4 hours, a high-severity incident within 24 hours; a vulnerability in the wallet solution can lead to revocation by version (RB-WP-11) |
| 7.10 | Collection of evidence: logging issuance events, security events, revocation requests and their results; documenting access to the records and the retention period | The provider logs WIA and KA issuance, unit registration, revocation requests and revocation events. The log carries no personal data, no status list index (`idx`) and no unit key fingerprint (RB-GEN-06; REQ-EAASP-7.13-08: minimal logging that does not allow tracking). The retention period is stated in the statement |
| 7.11.2 | Back-up: regular, preferably remote back-up of the data needed to resume operations, and testing of the back-up | The unit record and the mapping between WIA entry and unit are backed up regularly and off the server; revocation is possible only with these records (same principle as RB-AP-22); restoration is tested yearly |
| 7.11.3 | Crisis management: informing people and related parties of a compromise; revoking all issued attestations | If the signing key is compromised, the provider reports to the scheme owner (§8), has the key suspended in the trust list, revokes every affected WIA and KA entry and tells people through the way outside the wallet (§5.3) |
| 7.12 | Termination plan; keeping records after the attestations cease to be valid | The provider has a written termination plan: it keeps publishing its status lists until the revocation maintenance period (`client_status.exp`, `key_storage_status.exp`) of the last WIA and KA it issued has ended, or hands this task to a successor; it announces this in advance to issuers and the scheme owner |
| 7.13 | Privacy: no tracking or linking of the person; data minimisation; no export of personal data; minimal logging | The unit record holds no personal data ([[ADR-0025]] WIA2); the provider does not learn which institutions the wallet talks to (a WIA per transaction, §3); unit data is not passed to any other service |
| 7.14 | Supply chain (EN 319 401) | The provider lists the external services used in the attestation service (hosting, key service, device attestation services) and binds their security requirements by contract |

The requirements that Implementing Regulation (EU) 2025/1569 adds to TS 119 471 concern qualified and public-sector EAA; they do not
apply directly to Tamga's non-qualified WIA and KA. They are read separately when a state joins and when moving to the qualified class.

## 10. Decisions and open topics

| Topic | Status |
| --- | --- |
| Alignment with ETSI TS 119 471 clauses 6–7 (WURevocation_03) | **Decision (2026-10-12, [[ADR-0047]] K8):** mapped line by line in §9; clauses without a counterpart were added as obligations of the provider |
| Revocation from a lost or stolen device (EU WIAM_06) | **Decision (2026-10-12, [[ADR-0047]] K3):** without a user account, with a revocation secret given at activation (§2, §5.1; RB-WP-15) |
| Telling the person about wallet revocation outside the wallet (EU WURevocation_14/16) | **Decision (2026-10-12, [[ADR-0047]] K4):** every provider offers at least one way outside the wallet (§5.3; RB-WP-16) |
| Device attestation (App Attest, Android key attestation, Play Integrity) | **Decision (2026-10-12, [[ADR-0047]] K5):** mandatory at W3, optional at W2 (§2; RB-WP-17) |
| A revocation entry per key for the KA (EU TS3 Option 2) | Open: to be addressed with the move to secure hardware ([[ADR-0025]] "later") |

## Status

**Active** — version 1.0.0 (16 October 2026).
