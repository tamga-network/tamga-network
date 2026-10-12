---
document_id: ADR-0047
title: "Wallet unit revocation, out-of-wallet revocation path and device attestation"
status: Active
version: 1.0.0
created: 2026-10-12
last_updated: 2026-10-12
summary: >
  Decisions on the nine topics left open in the EU Attestation Rulebook template work. Wallet unit revocation does not revoke
  institution credentials (they are bound to a device key and cannot be used once the unit is revoked); institutions may publish
  additional revocation conditions through an optional `revocation_policy_uri` link; revocation from a lost or stolen phone works
  without a user account, with a revocation secret given at set-up; every wallet provider offers at least one way, outside the
  wallet, for the person to learn that the unit was revoked; device attestation is mandatory only at the highest wallet level
  (W3). Also: no non-qualified EAA indicator is written (ETSI), no trust anchor location field is added to credentials, and the
  I3 decision for diplomas is deferred until after the pilot. Changes ADR-0025 K4. Accepted 2026-10-12.
domain: Wallet
related: ["[[ADR-0025]]", "[[ADR-0024]]", "[[ADR-0022]]", "[[ADR-0042]]", "[[FW-POL-0001]]", "[[FW-POL-0002]]", "[[FW-RB-0001]]", "[[FW-RB-0002]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0047
source_version: 1.0.0
---

# In short

While the rulebooks were moved to the EU Attestation Rulebook template ([[FW-RB-0001]] §11) and the two policy documents were
written ([[FW-POL-0001]], [[FW-POL-0002]]), nine topics were left as "decision pending". On 2026-10-12 the project management
accepted the proposals for all nine. This decision makes five of them network rules (K1–K5), records three with their reasoning
(K6–K8) and writes one down as a deferred decision with its trigger (K9).

# Context

| # | Topic | EU source | Today |
|---|---|---|---|
| 1 | Non-qualified EAA indicator | The template suggests `eaa:eu:non-qualified` (ARB_12); ETSI TS 119 472-1 EAA-5.2.2.1-01 requires that a non-qualified EAA has no `category` | Tamga follows ETSI |
| 2 | Trust anchor location in the credential (Annex V h) | ARB_21 | The location is the issuer's certificate chain and the trust lists |
| 3 | Institution credentials when a wallet unit is revoked | WURevocation_18 (mandatory for the PID provider), WURevocation_19 (optional for others) | Only the identity service revokes in a chain |
| 4 | Additional revocation conditions of an issuer | VCR_05 | The network has a common revocation policy; no place for an institution's additional conditions |
| 5 | Aligning the WIA/KA policy with ETSI TS 119 471 clauses 6–7 | WURevocation_03 | Not compared line by line |
| 6 | Revocation from a lost or stolen phone | WIAM_06 (user account at the provider), WURevocation_10 | [[ADR-0025]] K4: "requires a user account; later step" |
| 7 | Telling the person about revocation outside the wallet | WURevocation_14, WURevocation_16 | No network rule |
| 8 | Device attestation at activation | WIAM_04, WIAM_08 | The wallet provider's decision |
| 9 | I3 accreditation for diplomas | — | "After the pilot" |

Tamga has no accounts and keeps as little personal data as possible ([[ADR-0025]] WIA2). The network does not operate a wallet; it
knows wallets by their trust list entries ([[ADR-0042]]). Rules about wallets are therefore written as **outcomes** every wallet
provider must deliver; the method is the provider's.

# Decision

## K1 — Wallet unit revocation does not revoke institution credentials

- When a wallet provider revokes a wallet unit, **credentials issued by institutions are not revoked**. The ARF leaves this
  optional for issuers (WURevocation_19); the Tamga network does not use it as a rule. The requirement that ties an institution
  credential's validity to the revocation maintenance period of the WIA and KA (ISSU_12d) therefore does not apply.
- The **identity service** (Tamga's PID-equivalent issuer) is unchanged: it checks the unit within 24 hours at most and revokes its
  own credentials on that unit (WURevocation_18). An issuer that revokes in a chain limits the credential's validity to the
  revocation maintenance period of the WIA and KA presented at issuance and announces the minimum maintenance period it wants in
  its metadata (ISSU_12c, WUA_32; EU TS3 `preferred_client_status_period`, `preferred_key_storage_status_period`). The packages
  provide this in 0.5.0; in the identity service the limit is switched on once wallet providers issue WIAs and KAs that meet the
  announced period (with today's 60-day maintenance period a 2-year identity credential would drop to 60 days).
- **Why this is enough:** every copy is bound to a holder key on the device (`cnf`); the key is generated in the device's secure
  hardware and cannot be exported (RB-WP-01), and every presentation needs a signature with that key and a PIN or biometrics
  (RB-WP-03). The credential cannot be presented from another device. Once the unit is revoked:
  1. no issuer gives that wallet a new credential or a refresh ([[ADR-0025]] WIA4; [[ADR-0023]] refresh needs a valid WIA);
  2. the wallet that sees the revocation deletes its credentials and keys (a rule in Tamga Wallet; the wallet's own decision);
  3. the identity service's credential is revoked; flows that rely on identity stop;
  4. institution credentials end when they expire (a student credential lasts at most 90 days).
- **Remaining risk:** someone who obtains the phone together with its unlock secret can, as long as the phone stays offline, show
  an unexpired institution credential. The person can ask the institution to revoke it ([[FW-POL-0001]] §4). Chain revocation would
  not close this risk: if the phone stays offline the wallet is not wiped either, and the institution's status list can already be
  used this way.

## K2 — Additional revocation conditions of an institution: `revocation_policy_uri`

- An institution **MAY** publish conditions **in addition** to the network's common revocation policy ([[FW-POL-0001]]) on its own
  page. The link sits in the optional `revocation_policy_uri` field of the institution's trust list entry (registration data,
  [[ADR-0024]]; same form as `info_uri`, `privacy_policy_uri`).
- The page **cannot narrow** the common policy: the common conditions apply to every institution; the institution only adds (for
  example "the credential is revoked if studentship is suspended by a disciplinary decision").
- The link is given in the institution's registration application (the list publisher's registration tool, an https address); the
  wallet shows it on the institution page.
- **Name:** ARF VCR_05 calls this document a "policy" ("a policy specifying under which conditions … it issued will be revoked");
  the name follows the `*_policy_uri` fields of the EU registration data. `revocation_conditions_uri` was proposed;
  `revocation_policy_uri` was chosen to use the same term as the EU text.

## K3 — Revocation from a lost or stolen phone: without an account

- Every wallet provider **MUST** offer a way for the person to revoke the wallet unit without having the phone (WURevocation_10,
  WIAM_06).
- This path **does not require a user account.** Accepted method: a revocation secret generated on the phone when the unit is
  activated and shown to the person once; the provider keeps only a slow hash in the unit record; the person types the secret on the
  provider's web page, and the unit and all its WIA entries are revoked. The page neither asks for nor shows personal data. Tamga
  Wallet does this with its revocation code and its "I lost my phone" page (the wallet's WA-ADR-0002).
- **Deviation from the ARF:** a secret recorded at set-up instead of the user account WIAM_06 foresees. The conditions "explicit
  request of the person" and "registered at activation" are met; the equivalence is argued separately at certification.
- This decision replaces the item "revocation from a lost or stolen device requires a user account; left to a later step" in
  [[ADR-0025]] K4.

## K4 — Learning about revocation outside the wallet

- Every wallet provider **MUST** offer at least one way, **outside the wallet**, for the person to learn that their wallet unit was
  revoked (WURevocation_16). If the provider revoked the unit on its own decision, that way shows the reason, what keeps working and
  what the person can do, within 24 hours at most (WURevocation_14).
- The method is the provider's; the way must not make collecting personal data mandatory. Tamga Wallet does this with public
  security advisories and a data-free "my wallet's status" page opened with the revocation code (the wallet's WA-ADR-0008).

## K5 — Device attestation mandatory only at the highest wallet level

- The wallet levels are the three levels of the Trust Framework: W1 software key (no credential is issued, RB-WP-01), W2 the
  device's secure area, W3 certified secure hardware.
- **W3:** the wallet provider **MUST** verify the platform's device attestation (Apple App Attest, Android key attestation, Play
  Integrity) when activating the unit and before every KA that declares W3; no W3 KA is issued to an unverified device
  ([[ADR-0025]] WIA3 "the level tells the truth").
- **W2:** device attestation is optional (**MAY**); it is the wallet provider's decision. In production Tamga Wallet issues WIAs only
  to devices whose hardware attestation is verified (the wallet's WA-ADR-0005); this is above the network minimum.

## K6 — No non-qualified EAA indicator is written (ARB_12)

The EU template suggests the value `eaa:eu:non-qualified` in the `category` attribute for a non-qualified EAA. ETSI TS 119 472-1
V1.2.1, EAA-5.2.2.1-01, however requires that an SD-JWT VC EAA from an issuer registered in the EU that is neither qualified nor
public **does not include** the `category` claim. Tamga follows ETSI: a non-qualified credential carries no `category`; the absence
is the indicator. In the qualified or public class `category` is written with Tamga values (RB-AP-14, [[ADR-0022]]). The template's
value is not used.

## K7 — No trust anchor location field in credentials (ARB_21)

Credentials have no separate trust anchor location field; the trust lists are the single source of trust anchors
([[SPEC-TRUST-0001]]). Reasons:
- **Trust does not come from the credential.** A location inside the credential is the issuer's own claim; a fake issuer can write
  a fake location. A verifier must take trust anchors only from a list it chose itself, with a pinned signature (ARB_26; ETSI TS
  119 472-2 `trusted_authorities`); following a location found in the credential opens a way to deceive it.
- **Annex V h is already met.** The issuer's certificate chain is in the `x5c` header; the root of the chain and the issuer's entry
  are in the list. The rulebook states the location as "the issuer's certificate + the trust list".
- **Single-source consistency.** When an anchor changes (key rollover, suspension) the credentials do not change; the list does. A
  location in the credential can go stale; the list cannot.
- **Data minimisation.** A fixed field added to every credential carries no information but adds size and linkability.

## K8 — The WIA/KA policy is aligned with ETSI TS 119 471 clauses 6–7 (WURevocation_03)

The Wallet Attestation Policy ([[FW-POL-0002]]) is compared line by line with clauses 6 and 7 of TS 119 471 V1.1.1; clauses without
a counterpart are added to the policy as obligations of the wallet provider (practice statement, terms and conditions, information
security policy, independence, multi-factor authentication, key ceremony and hardware security module, records, back-up, crisis,
termination, privacy, supply chain). The amendments that Implementing Regulation (EU) 2025/1569 makes to TS 119 471 are read
separately.

## K9 — I3 for diplomas: decided after the pilot (deferred decision)

Making an I3 (accredited) issuer mandatory for the diploma type is **not decided** today; the minimum stays I2, with I3 recommended
(**SHOULD**). **Trigger** (whichever comes first): (a) the education pilot's final report, (b) the first application to issue diplomas
from an institution other than the pilot partner, (c) a state's education authority joining the network. When the trigger occurs the
topic is brought to the project management.

# Options considered

| Topic | Option | Result | Why |
|---|---|---|---|
| 3 | Chain revocation of institution credentials as a network rule | rejected | For the institution to know the unit, a WIA status entry must be written into every credential record (an identifier); credential validity becomes limited by the WIA maintenance period (ISSU_12d); the security gain is small (K1) |
| 4 | No separate field; describe it on the `info_uri` page | rejected | The person cannot find the conditions; the wallet cannot show them separately |
| 6 | A user account at the provider (WIAM_06 literally) | rejected | The "no account" principle; personal data |
| 7 | Push or SMS notification | rejected (as a network rule) | Push is not independent of the wallet; SMS goes to the lost phone and needs personal data |
| 8 | Device attestation mandatory at every level | rejected | Device attestation is not available on every platform and device; W2 wallets would be left out |
| 1 | The template's value `eaa:eu:non-qualified` | rejected | Conflicts with ETSI's binding profile |
| 2 | Optional `trust_anchor` field | rejected | K7 |

# Invariants

| Code | Rule |
|---|---|
| WR1 | Wallet unit revocation does not revoke institution credentials; the identity service revokes its own credentials on that unit within 24 hours at most. |
| WR2 | An institution's `revocation_policy_uri` page only adds conditions to the network's common revocation policy; it cannot narrow the common conditions. |
| WR3 | The wallet provider offers a unit revocation path that works without the phone and needs no user account. |
| WR4 | The wallet provider offers at least one way, outside the wallet, for the person to learn that the unit was revoked. |
| WR5 | A KA declaring level W3 is issued only to a unit whose platform device attestation was verified. |

# ARF mapping

| Requirement | Counterpart |
|---|---|
| ARB_12, ARB_25 | K6 |
| ARB_21 | K7 |
| WURevocation_18, WURevocation_19, ISSU_12c, ISSU_12d | K1 (ISSU_12d does not apply) |
| VCR_05 | K2 + [[FW-POL-0001]] |
| WURevocation_03 | K8 + [[FW-POL-0002]] §9 |
| WURevocation_10, WIAM_06 | K3 (WIAM_06 as a deviation) |
| WURevocation_14, WURevocation_16 | K4 |
| WIAM_04, WIAM_08 | K5 |

# Consequences

- Framework: [[FW-RB-0001]] RB-AP-27, RB-WP-15, RB-WP-16, RB-WP-17; [[FW-POL-0001]] §3.2 and §8; [[FW-POL-0002]] §2, §5, §9 and a
  new ETSI TS 119 471 mapping; [[FW-RB-0002]], [[FW-RB-0003]], [[FW-RB-0004]], [[FW-RB-0005]] §2.0 and §7.2; Trust Framework §2.2.
- [[SPEC-TRUST-0001]] §4: `revocation_policy_uri` in the institution entry.
- `@tamga-network/trust` (entry schema), the list publisher's registration tool, the `wallet-core` institution directory
  (`revocationPolicyUri`).
- [[ADR-0025]] K4: the lost/stolen item points to this decision.
- Wallets: Tamga Wallet already meets K3 and K4 with WA-ADR-0002 and WA-ADR-0008; the item "a network rule is proposed for
  institution credentials" in WA-ADR-0002 K4.2 is closed by this decision (no rule).

# Status

**Accepted — 2026-10-12.** With the project management's approval. DECISIONS: D-CRED-8.
