---
document_id: ADR-0046
title: "Embedded disclosure policy"
status: Proposed
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-09
summary: >
  An issuer can require that a credential type is shown only to specific verifiers (or to those holding a given entitlement, or
  to those certified under a given root of trust). The issuer publishes this rule by value in its signed Credential Issuer
  metadata, inside the credential configuration; the credential format does not change. The wallet stores the rule at issuance
  and, at presentation, evaluates it against the verifier's registration certificate (WRPRC) and access certificate; if it does
  not hold, the consent screen warns and leaves the decision to the person (default "don't share"). If a policy is added, changed
  or removed, the issuer revokes the credentials of that type. Covers the 10 requirements of EU ARF 3.0 Topic 43. New field names
  await approval. Packages 0.5.0.
domain: Trust
related: ["[[ADR-0026]]", "[[ADR-0024]]", "[[ADR-0028]]", "[[ADR-0023]]", "[[ADR-0029]]", "[[ADR-0042]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]", "[[FW-RB-0001]]"]
translation_of: ADR-0046
source_version: 1.0.0
---

# In short

Today a diploma or membership credential can be shown to any verifier on the trust list if the person approves. The wallet only
checks whether the verifier asks for more than it is registered for ([[ADR-0026]] K5, over-asking warning). The EU wants the
issuer to be able to say "show this credential only to these verifiers" and the wallet to check it. This record proposes where
that rule is carried, how the wallet evaluates it and what the person is shown.

# Context

**What the EU requires** (ARF 3.0, Annex 2, Topic 43; main text §6.6.2.8, §6.6.3.4; Implementing Regulation (EU) 2024/2979
Annex III; ETSI TS 119 472-3 §4.2.5):

| Requirement | Summary |
|---|---|
| EDP_01 | The wallet lets an attestation provider optionally express an embedded disclosure policy for an EAA (QEAA, PuB-EAA, non-qualified EAA). Not required for PIDs. |
| EDP_02 | "Authorised relying parties only" policy: a list of (relying party identifier, service identifier) duplets. The wallet takes the duplet from the verifier's **registration certificate** (not the access certificate; with an intermediary the access certificate names the intermediary); if not listed, the evaluation fails and the person is told. |
| EDP_03 | "Specific root of trust" policy: a list of root or intermediate certificates. The wallet compares the certificates in the chain that signed the registration certificate with the list; if none matches, it fails and the person is told. |
| EDP_05 (SHOULD + SHALL) | The policy should link to a page explaining it in plain language; if present, the wallet shows the link and lets the person open it. |
| EDP_06 | The wallet evaluates the policy together with the registration certificate, following the evaluation rules of ETSI TS 119 472-3. |
| EDP_07 | Based on the outcome, the wallet lets the person deny or allow the presentation. |
| EDP_08 | The format complies with ETSI TS 119 472-3. |
| EDP_09 | The issuer includes the policy (if any) **by value** in the OpenID4VCI Credential Issuer metadata. |
| EDP_10 | The wallet retrieves and stores the policy at issuance (so it can evaluate it at presentation, including in proximity, without asking again). |
| EDP_11 | The issuer revokes the credential if the policy is added, changed or deleted. |

EDP_04 is empty; 10 requirements in total.

**The three common policies of Annex III of the Regulation:** (1) no policy (default), (2) authorised relying parties only,
(3) specific root of trust. Policies apply to whole credentials, not to individual attributes.

**ETSI TS 119 472-3 §4.2.5.2 data model** (ISS-MDATA-EBD-01…13): identified by a unique URI; optional description and responsible
authority; may state "no restrictions"; a list of authorised relying parties identified (a) by the subject distinguished name of
the access certificate (RFC 4514 LDAP string; for a legal person `commonName`, `organizationName`, `organizationIdentifier`,
`countryName`) and/or (b) by TS 119 475 entitlement URIs in the registration certificate; a list of roots of trust (each element:
issuer distinguished name + certificate serial number); extensions (the wallet may ignore them); a link to a plain-language page.
The policy is not revealed to the verifier. **ETSI does not define JSON member names.**

**Difference between the ARF and ETSI:** the ARF describes the authorised verifier by the (identifier, service) duplet of the
registration certificate and the root of trust by the registration certificate chain; ETSI and the Regulation describe it by
subject name or entitlement and by the access certificate root. The proposal accepts both (K3).

**In Tamga today:**
- A verifier registration certificate (WRPRC, `rc-wrp+jwt`) is produced per usage and arrives in the OpenID4VP request via
  `verifier_info`; the wallet checks its signature, validity and the match between `sub` and the `organizationIdentifier` of the
  access certificate ([[ADR-0026]] K5). It carries no separate service identifier (ARF RPRC_17a partial); it has a usage
  identifier `intended_use_id`.
- The issuer's Credential Issuer metadata is signed and carries the institution's WRPRC in `issuer_info`.
- The credential configuration has `display` and `credential_reuse_policy` under `credential_metadata`.
- There is no embedded disclosure policy in the code. EDP_02 counts as "partial" because the over-asking check gives a similar
  protection.
- In proximity (ISO 18013-5) and in wallet-to-wallet requests there is no registration certificate.
- The proposed [[ADR-0028]] K5 gives an entitlement-based policy example for the practice licence ("only to verifiers whose
  registration certificate carries a healthcare-provider entitlement") and leaves the JSON names to this record.

# Options considered

## 1. Where the policy lives

| Option | Result | Why |
|---|---|---|
| **In the signed Credential Issuer metadata, by value, in the `credential_metadata` object of the credential configuration** | **proposal** | Exactly EDP_09; the credential format does not change; the metadata is already signed and read by the wallet at issuance. |
| Inside the credential (SD-JWT claim or mdoc element) | rejected | The policy must not be revealed to the verifier (ETSI §4.2.5.1); the format changes; the ARF says no format change is needed. |
| By URL, the wallet downloads it at presentation | rejected | The ARF says by value, not by link (§6.6.2.8.3); fails in proximity and offline; leaks presentation time to the issuer. |
| In the institution's trust list entry | rejected | Not the EU route; EU wallets would not read it. |

## 2. When the evaluation fails

| Option | Result | Why |
|---|---|---|
| **Warn and leave the decision to the person (default button "Don't share")** | **proposal** | EDP_07 gives the person the choice to deny or allow; same pattern as the over-asking warning of [[ADR-0026]] (WL8). |
| Hard block | rejected (question 3) | Conflicts with EDP_07; a stricter Tamga-only rule; EU wallets only warn. |
| The issuer chooses "warn / block" | rejected (question 3) | A new field with no EU counterpart; the same credential would behave differently in an EU wallet. |

## 3. How the authorised verifier is identified

| Option | Result | Why |
|---|---|---|
| **ARF duplet + ETSI subject name + ETSI entitlement URI; passes if any listed item matches** | **proposal** | Fits both the ARF and ETSI; the institution uses what fits its case ("these three verifiers" or "everyone with this entitlement"). |
| ARF duplet only | rejected | Cannot read EU policies written the ETSI way; no entitlement-based "category" rule. |
| ETSI only | rejected | Misses the ARF intermediary note (the identity in the registration certificate is decisive). |

# Proposed decision

## K1 — Location and format

For every credential configuration that has a policy, the issuer publishes the following object in its signed Credential Issuer
metadata (the field and member names **await approval**; ETSI defines no JSON names, so this is Tamga's proposal; if the EU or
ETSI publishes a JSON encoding, Tamga switches to it, [[ADR-0029]]):

```json
"credential_configurations_supported": {
  "<configuration>": {
    "credential_metadata": {
      "embedded_disclosure_policy": {
        "id": "https://institution.example/policy/diploma-1",
        "type": "authorized_relying_parties",
        "relying_parties": [{ "rp_id": "VATTR-1234567890", "service_id": "hiring" }],
        "subject_dns": ["ORGID=VATTR-1234567890,O=Example Ltd,C=TR"],
        "entitlements": ["<TS 119 475 entitlement URI>"],
        "info_uri": "https://institution.example/policy/diploma"
      }
    }
  }
}
```

- `id` (required): unique URI of the policy (ETSI -01).
- `type` (required): `none` · `authorized_relying_parties` · `specific_roots_of_trust` (the three policies of Annex III).
- For `authorized_relying_parties`, at least one of: `relying_parties` (ARF duplet; `rp_id` is the `sub` of the registration
  certificate, `service_id` optional), `subject_dns` (ETSI -07a), `entitlements` (ETSI -07b).
- For `specific_roots_of_trust`, `roots_of_trust`: `[{ "issuer_dn": "<RFC 4514>", "serial_number": "<hex>" }]` (ETSI -09).
- Optional: `info_uri` (EDP_05, ETSI -13), `authority` (ETSI -05), `description` (ETSI -04).
- Unknown members and extensions are ignored (ETSI -10/-11). The attribute-level policy extension (ETSI -12) is not supported.
- The policy does not go into the credential and is not sent to the verifier.
- Scope: institution credentials (EAA). The Tamga identity credential and contact credentials carry no policy.

## K2 — Wallet: storing at issuance (EDP_10)

At issuance the wallet reads the policy from the signature-verified metadata, checks its format and stores it next to the
credential record (policy + digest). At presentation no request is made to the issuer or any other server (same principle as WL9).
A malformed policy does not stop issuance, but is stored as "not evaluable" and produces the K4 warning at presentation.

## K3 — Wallet: evaluation (EDP_02, EDP_03, EDP_06)

When a presentation request arrives, for every requested credential, after the registration certificate has been verified per
[[ADR-0026]] K5:

| Policy | Passes if |
|---|---|
| none or `none` | always |
| `authorized_relying_parties` | (a) the `sub` of the registration certificate equals the `rp_id` of a `relying_parties` item and, if the item has a `service_id`, the service identifier of the registration certificate also matches; **or** (b) the subject name of the access certificate that signed the request equals a `subject_dns` item (RFC 4514 normalised comparison); **or** (c) the `entitlements` of the registration certificate contain an `entitlements` item |
| `specific_roots_of_trust` | the (issuer name, serial number) pair of a certificate in the chain that signed the registration certificate (ARF EDP_03) or in the access certificate chain (Regulation Annex III, ETSI -08) is listed |

- Without a registration certificate (not sent in the request; proximity; wallet-to-wallet) the evaluation **cannot be performed**
  and counts as failed.
- For an intermediated request, the intermediated verifier in the registration certificate is decisive (ARF EDP_02 note).
- Today the registration certificate has no service identifier (RPRC_17a partial). Until it is added, an item with a `service_id`
  does not match; an item without `service_id` covers all usages of that verifier. Adding the service identifier to the WRPRC is a
  prerequisite of this record and is done in the same round.

## K4 — Consent screen (EDP_05, EDP_07)

- If the evaluation passes, the screen is unchanged.
- If it fails or cannot be performed: a separate warning block — "**<Issuer>** wants this credential to be shown only to
  institutions it allows. **<Verifier>** is not one of them." (if not evaluable: "...could not be checked."). With `info_uri`, a
  "Read the rule" link. The default button is **"Don't share"**; "Share anyway" becomes active after a short delay (WL8 pattern).
- When several credentials are requested, the warning sits on the row of the affected credential; the person can remove it and
  share the rest.

## K5 — Issuer: revocation (EDP_11)

- If the policy of a configuration is added, changed or removed, the issuer revokes all still-valid credentials issued under that
  configuration. The credential record keeps the policy digest at issuance time; revocation is driven by the digest.
- Before changing a policy, the Institution Console shows how many credentials will be revoked and asks for confirmation. People
  receive the credential again; if the automatic refresh conditions ([[ADR-0023]]) allow it, new copies come with the new policy.

# Proposed rules (moved to the binding table if accepted)

| Code | Rule |
|---|---|
| EP1 | An embedded disclosure policy is carried only by value in the signed Credential Issuer metadata, in the credential configuration; it does not go into the credential and is not sent to the verifier. |
| EP2 | The wallet stores the policy at issuance and evaluates it at presentation, without network requests, against the registration certificate and the access certificate. |
| EP3 | If the evaluation fails or cannot be performed, the wallet shows a separate warning on the consent screen; the default choice is not to share, the final decision is the person's. |
| EP4 | Valid credentials of a configuration whose policy is added, changed or removed are revoked. |

# ARF mapping (10 requirements)

| Requirement | How it is met |
|---|---|
| EDP_01 | K1: optional policy for institution credentials |
| EDP_02 | K3 (a): (identifier, service) duplet from the registration certificate; intermediated verifier for intermediated requests; service identifier added to the WRPRC |
| EDP_03 | K3: registration certificate chain (and access certificate chain) |
| EDP_05 | K1 `info_uri`, K4 "Read the rule" |
| EDP_06 | K3: together with the registration certificate, per the ETSI data model |
| EDP_07 | K4: warning + "Don't share" / "Share anyway" |
| EDP_08 | K1: ETSI TS 119 472-3 §4.2.5.2 data model; JSON names follow an ETSI encoding once published |
| EDP_09 | K1: by value in the signed Credential Issuer metadata |
| EDP_10 | K2 |
| EDP_11 | K5 |

# Affected packages and version

Packages in **0.5.0** (new field and function = minor):

| Package | Change |
|---|---|
| `@tamga-network/schemas` | JSON Schema and validator for the policy object |
| `@tamga-network/issuer` | Per-configuration policy in the metadata builder; policy digest; format check |
| `@tamga-network/trust` | RFC 4514 distinguished-name parsing and normalisation; extracting (issuer name, serial number) from a certificate |
| `@tamga-network/wallet-core` | Storing at issuance; `evaluateDisclosurePolicy` (result: passed / failed / not evaluable + reason + link); result in the consent view |
| `@tamga-network/verifier` | No change (the policy is not revealed to the verifier) |

Outside the packages: a service identifier in the registration certificate (list publisher, RPRC_17a), the policy digest in the
credential record and bulk revocation on change in the hosted issuance service, a policy editor in the Institution Console
(operator repository), the consent-screen warning in wallet apps.

# Consequences

- Specifications (on acceptance): [[SPEC-PROTO-0001]] metadata field; [[SPEC-WALLET-0001]] evaluation and consent-screen rule;
  [[FW-RB-0001]] an "access restriction" section in rulebooks (ARF note: the restriction is also announced to verifiers in the
  rulebook); Tamga ARF rows on the trust model and privacy measures.
- In wallet-to-wallet and proximity presentation the policy cannot be evaluated; a credential with a policy is shown there with a
  warning (proximity) or not at all (wallet-to-wallet; the wallet's own decision).
- An institution that changes a policy accepts that its credentials are re-issued; the Institution Console makes this explicit.

# Plan and estimate

| # | Work | Estimate (engineer-days) |
|---|---|---|
| 1 | schemas: policy schema + tests | 0.5 |
| 2 | issuer: metadata, policy digest, format check + tests | 1 |
| 3 | trust: RFC 4514 normalisation, (issuer name, serial number) + tests | 1 |
| 4 | Service identifier in the registration certificate (list publisher + wallet check, RPRC_17a) | 1 |
| 5 | wallet-core: storing + evaluation + consent view; test matrix of policy types × registration certificate present/absent × intermediated request | 2 |
| 6 | Hosted issuance: policy digest in the credential record, bulk revocation on change; Institution Console editor | 2 |
| 7 | Wallet app: consent-screen warning block, "Read the rule", i18n | 1 |
| 8 | End-to-end scene in the sandbox (a test credential with a policy; allowed and not-allowed verifier) | 0.5 |
| 9 | Specifications, rulebook, Tamga ARF | 1 |
| | **Total** | **≈ 10 days** |

All work is code and documents; no device or certificate is needed.

# Open questions (project management)

1. **Name approval:** are the metadata field `embedded_disclosure_policy`, the types `none` / `authorized_relying_parties` / `specific_roots_of_trust` and the member names (`relying_parties`, `rp_id`, `service_id`, `subject_dns`, `entitlements`, `roots_of_trust`, `issuer_dn`, `serial_number`, `info_uri`, `authority`, `description`) acceptable? They are new public names.
2. **Scope:** policies only on institution credentials, not on the Tamga identity and contact credentials (proposal) — acceptable?
3. **Warn or block:** when a policy does not hold, should the wallet warn and leave the decision to the person (proposal, the EU route) or block outright?
4. **Bulk revocation:** if an institution changes a policy, all valid credentials of that type are revoked and people receive them again. Is that cost acceptable?
5. **Service identifier:** should the separate "service identifier" in the registration certificate (required by the EU) be added in the same round (proposal)?

# Status

**Proposed — 2026-10-09.** Design proposal for the "Topic 43" item of the EU conformance gap recount (2026-10-09); names and
questions are pending decision.
