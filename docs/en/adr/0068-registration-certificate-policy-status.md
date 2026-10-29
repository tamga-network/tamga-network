---
document_id: ADR-0068
title: "Registration certificate policy and status list"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  Registration certificates (WRPRC, ETSI TS 119 475) carry three fields: `policy_id` (Tamga's own policy OID; ETSI's EU OID is
  not used), `certificate_policy` (the address of the policy document) and `status` (the entry in the registrar's status list).
  The registrar keeps a 1-bit status list in IETF Token Status List format, signed with the key that signs the registration
  certificates; when a registration or an intended use ends, is suspended or the content changes, the old certificate is revoked
  automatically, and manual revocation is possible. The wallet core rejects a request whose registration certificate is revoked
  and warns when the status cannot be checked. The policy document is added to the policies of the Tamga ARF (FW-POL-0003). It is
  enabled in the sandbox today; the real network's policy identifier and addresses enter the registry after the names are
  approved. Accepted: 2026-10-29.
domain: Trust
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0029]]", "[[ADR-0038]]", "[[ADR-0048]]", "[[ADR-0056]]", "[[ADR-0058]]", "[[FW-POL-0001]]", "[[FW-POL-0003]]", "[[FW-TF-0001]]", "[[SPEC-CRED-0003]]", "[[SPEC-TRUST-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0068
source_version: 1.0.0
---

# In short

A registration certificate is the signed document that says what a verifier or a credential issuer is registered to request or
issue in the network. Until now it had two gaps: it did not say under which rules it was issued, and it could not be revoked. A
strict EU wallet therefore refused every request of the Tamga verifier. With this decision every registration certificate carries
the identifier and the address of its policy, and the registrar publishes a revocation list. The wallet does not accept a revoked
certificate.

# Context

- **Standard.** ETSI TS 119 475 V1.2.1 Table 7 requires `policy_id`, `certificate_policy` and `status` in every registration
  certificate. §6.1.3 requires the policy to be referenced in a machine-processable and a human-readable form (OVR-6.1.3-01/02);
  §6.1.4 requires a clear description of the PKI hierarchy and the trust anchor (OVR-6.1.4-02). §6.2.3.9–10 and §6.2.6 require
  revocation through a status list: when the registration is cancelled, suspended or modified, or the content is no longer
  accurate, the certificate is revoked without undue delay; the list is a public, signed, compressed bit array; the semantics
  are "valid" and "revoked" (REV-6.2.6.2-04); the `status` field carries `idx` and `uri` (GEN-6.2.6.1-04). ETSI's own policy OID
  `0.4.0.19475.3.1` means a certificate "issued to EUDIW wallet-relying parties in accordance with the revised eIDAS Regulation".
- **ARF.** RPRC_01a requires a provider of registration certificates to be able to revoke a certificate valid for more than
  24 hours, and RPRC_01b to have a policy stating the conditions of revocation. RPACANot_03b requires revocation lists to be
  authenticated with the notified trust anchors. Under RPRC_17 the wallet verifies the format, authenticity and validity of the
  certificate; if a check fails it warns the user, and the wallet provider decides whether sharing is still allowed. §6.6.3.3:
  if the "not revoked" condition fails for an issuer, the credential is not requested.
- **Today.** [[ADR-0026]] produces the certificates from the registry and signs them with the registrar key; validity is at most
  12 months, but there is no revocation path (only short validity and republishing the list). In a sandbox test with an
  independent EU test wallet (2026-10-29), strict mode refused 13 of the verifier's 13 policies only because of these three fields.
- **Direction of project management.** The gap is closed; the policy identifier and the addresses are new public names, so they
  are applied in the sandbox first and the real network's names are approved separately.

# Decision

## K1 — Policy identifier (`policy_id`) and address (`certificate_policy`)

- Every registration certificate carries `policy_id` (an array of OIDs in dotted text; the form of the ETSI Annex C example) and
  `certificate_policy` (the HTTPS address of the policy document). Tamga does **not** use ETSI's EU OID (`0.4.0.19475.3.1`):
  Tamga is not an EU registrar and that OID makes this claim. The publisher stops if it finds this value in the configuration.
- OID options:

  | Option | Registration | Assessment |
  |---|---|---|
  | Under an IANA Private Enterprise Number (PEN): `1.3.6.1.4.1.<PEN>.1.1` | Free application, a few weeks | **Recommended for the real network.** Short, the organisation's own arc; the access certificate policy and later policies in the same arc |
  | UUID-based OID `2.25.<UUID>` (ITU-T X.667) | Not needed | Unique at once but long and not tied to the organisation. **Used for the sandbox** |
  | Address only (no OID) | — | Rejected: the ETSI example and X.509 practice use OIDs; EU wallets may expect one |
  | ETSI's EU OID | — | Rejected: false claim |

- **Sandbox (today):** `policy_id` = `2.25.220506472418443381081254370400837050484` (sandbox only; not valid in the real
  network), `certificate_policy` = `https://arf.tamga.network/policies/registration-certificate`.
- **Real network:** the OID (the PEN application is made in the organisation's name) and the address enter the registry once
  approved; the code does not change.
- The values are in the registry's registrar role configuration (`roles.registrar.wrprc`); without it the certificate carries
  neither these fields nor `status`. The configuration is not written to the LOTL.

## K2 — Policy document (FW-POL-0003)

- The human-readable policy is among the policies of the Tamga ARF: **Registration Certificate Policy** ([[FW-POL-0003]],
  `arf.tamga.network/policies/registration-certificate`). The document makes no decisions; it compiles this decision and
  [[ADR-0024]], [[ADR-0026]], [[ADR-0058]]: scope, content and source of the certificate, PKI hierarchy and trust anchor
  (OVR-6.1.4-02), validity, revocation conditions, revocation requests, the status list, the wallet's checks, policy identifiers.
- The OID does not change when the document's version changes; if the meaning of the policy changes, a new OID is assigned.

## K3 — Status list

- The registrar publishes a list in IETF Token Status List format (the same format as [[SPEC-CRED-0003]]): `statuslist+jwt`,
  **1 bit** (0 valid, 1 revoked; no suspension — a suspended registration is revoked, REV-6.2.3.9-04), capacity 100,000, zlib.
- The list is signed with the **registrar key** that signs the registration certificates (x5c). The registrar key in the LOTL
  is thus the trust anchor of both the certificates and the revocation list (ARF RPACANot_02 point 3 and RPACANot_03b); no
  separate key or notification is needed. ([[SPEC-CRED-0003]] S11, "status key separate from the credential key", is for
  credential issuers: their credential key is in an online service; the registrar key is used only in the publisher.)
- Address: `/status/wrprc/<n>` under the publication root; sandbox `https://trust.sandbox.tamga.network/status/wrprc/1`.
  Response type `application/statuslist+jwt`. `iss` = publication root, `sub` = address.
- Freshness: `ttl` 1 hour, `exp` 24 hours; the list is re-signed at every hourly heartbeat, and at once when a status changes.
- **Index rule:** each certificate is identified by its content (excluding issuance time, expiry and `status`). Republishing the
  same path with the same content keeps the same index (the same certificate signed again); if the content changes or the expiry
  becomes earlier, it gets a new random index and the old index is revoked. A revoked index is never reused. The status record
  persists in the publication folder (`wrprc-status.json`; organisation and intended-use paths, index, status, revocation reason
  — no personal data).
- The proximity form (`rc-wrp+cwt`) carries the same payload and therefore the same `status` entry.

## K4 — Revocation

- **Automatic** (at every publication, REV-6.2.3.9-04/07): the registration or intended use ended, was suspended, revoked or
  removed from the list → `registration_ended`; the content changed → `superseded`.
- **Manual** (REV-6.2.3.9-05/06): the publisher command `wrprc-revoke <certificate path> --reason <reason>`. The reason is
  mandatory free text. Manually revoked content is not issued again unchanged. Revocation requests are accepted only from the
  registrar, the relying party or issuer itself (including its authorised representative) or a competent public authority (e.g.
  the data protection authority) (REG-6.2.2.3-05); the request is authenticated the same way as authority to change the
  registration (REG-6.2.2.3-06).
- Every revocation is written to the publisher's public changelog with index, path and reason. The requester's identity and the
  authentication record are kept in the operator's internal records (REG-6.2.2.3-07); no person's name is written in the public
  reason.

## K5 — Wallet core

- `wallet-core` fetches the list of the certificate's `status` entry; the certificate that signs the list must be one of the
  registrar keys in the LOTL. A verified list is cached; without network, an unexpired (`exp`) copy is used, an expired copy is not.
- **Revoked → rejection.** A request carrying a revoked registration certificate is invalid; the wallet sends no data
  ([[ADR-0026]] WRC4). If the certificate in an issuer's metadata is revoked, the credential is not requested (ARF §6.6.3.3).
- **Not checkable → warning.** The list could not be fetched or verified, or no statuses were given: the result stays valid but
  carries the `registration_status_unknown` flag; the consent screen warns (ARF RPRC_17). Secure default: when no statuses are
  given, the flag is set.
- A certificate with a malformed `status` or `policy_id` is invalid. `policy_id` is accepted but no specific value is required
  (other registrars carry their own policies). A certificate without a status field (a registrar without a status list) is
  accepted without a warning today.

## K6 — Rollout

- Sandbox: enabled today (registry configuration, status list, nginx response type).
- Real network: the registry configuration is added once the names in K1 are approved. The change is backward-safe: older
  wallets ignore the new fields; without the configuration the real network's certificates do not change.

# Options considered

| Option | Result | Reason |
|---|---|---|
| Rely on short validity, no revocation list | rejected | TS 119 475 and ARF RPRC_01a require revocation; strict EU wallets refuse certificates without `status` |
| Separate status list key | rejected (today) | New key, new LOTL field and a separate notification; no gain: both keys sit in the same place, only in the publisher |
| A new index for every certificate at every publication | rejected | The list grows at every publication; revoking identical content protects nothing. A new index when the content changes is enough |
| 2-bit list (suspension) | rejected | ETSI defines only valid/revoked; a suspended registration is revoked (REV-6.2.3.9-04) |
| Reject when the status cannot be checked | rejected (today) | Needless refusals offline and in proximity; the ARF asks for a warning. Revocation stays a hard rejection |
| `registrar_dataset` in the verifier request | rejected | Implementing Regulation (EU) 2026/1731 removed RO-02…RO-12; the 2026-10-13 amendment of [[ADR-0026]] says "not used" |
| **Own OID + policy document + 1-bit status list signed with the registrar key** | **chosen** | The standard's three fields, no extra key, revocation is a hard rejection in the wallet |

# Invariants

| Code | Rule |
|---|---|
| WRS1 | A registration certificate carries Tamga's own policy OID and the address of the policy document; ETSI's EU policy OID (`0.4.0.19475.3.1`) is not written into a Tamga certificate. |
| WRS2 | The registrar publishes a public, signed, 1-bit Token Status List for registration certificates; the list is signed with the registrar key in the LOTL and re-signed at least every 24 hours. |
| WRS3 | When a registration or intended use ends, is suspended or revoked, or the certificate content changes, the old registration certificate is revoked in the same publication; a revoked index is not reused. |
| WRS4 | The wallet sends no data to a request carrying a revoked registration certificate and requests no credential from an issuer whose certificate is revoked; if the status cannot be checked, it warns the user. |

# Consequences

- `apps/trust-publisher`: `src/wrprc-status.ts` (index, revocation, list signature), `build`, `heartbeat`, `wrprc-status`,
  `wrprc-revoke`; sandbox registry configuration.
- `@tamga-network/wallet-core`: `fetchRegistrationStatuses`, `registrationStatusRefs`, `MemoryRegistrationStatusCache`;
  `checkRegistrationCerts`, `checkIssuerRegistration`, `checkProximityRegistration`, `relevantRegistrationCerts` take the
  statuses as an optional last parameter; the `registrationStatuses` option in proximity. In the packages' 0.7.4 release.
- Documents: [[FW-POL-0003]] (new), [[FW-TF-0001]] (registration certificate paragraph), [[SPEC-TRUST-0001]] (published files).
- Operator: the response type of `/status/` in the sandbox nginx.
- Next: the registry configuration once the real network names (K1) are approved; the PEN application.

# Status

**Accepted — 2026-10-29** (approval by project management; the verbatim quotation is in the private approval record).
DECISIONS: D-REG-4. WRS1–WRS4 are binding. The real network's policy identifier and addresses are approved separately (K1, K6).
