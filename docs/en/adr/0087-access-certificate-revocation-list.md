---
document_id: ADR-0087
title: "Access certificate revocation list"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  An RFC 5280 certificate revocation list (CRL) is published for verifier access certificates (WRPAC, X.509). When a verifier's
  registration is suspended or revoked, its access certificate is permanently revoked in the same publication (ETSI TS 119 411-8
  REV-6.3.9-04; `certificateHold` is not used for suspension either); it is also revoked when the registration ends and when the
  certificate is replaced by a new one. The CRL is signed by the authority that issued the certificate; since the root stays
  offline, access certificates are issued by a root-signed access certificate authority whose key is held by the list publisher,
  and its CRL is re-signed at every publication and every hour (nextUpdate 24 hours). The address is under the trust list domain
  without opening a new subdomain: `/crl/<authority>.crl`. Registration certificates (WRPRC) do not enter the CRL; their
  revocation stays in the status list of ADR-0068. The Tamga wallet core and verifier rely on the signed list and do not fetch
  the CRL separately; the CRL is for EU wallets and PKIX validators. Accepted: 2026-11-15.
domain: Trust
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0034]]", "[[ADR-0056]]", "[[ADR-0058]]", "[[ADR-0068]]", "[[ADR-0075]]", "[[SPEC-ID-0002]]", "[[SPEC-TRUST-0001]]", "[[FW-POL-0003]]", "[[FW-TF-0001]]"]
translation_of: ADR-0087
source_version: 1.0.0
---

# In short

A verifier carries two certificates in the network: the access certificate (X.509), which shows who it is, and the registration
certificate, which shows what it may request. The registration certificate had a revocation list ([[ADR-0068]]); the access
certificate did not. When a verifier was suspended, the Tamga wallet recognised it from the signed list and refused it, but an EU
wallet that checks the certificate only through the X.509 path would still have seen the certificate as valid. With this decision
a standard revocation list (CRL) is published for access certificates, and the certificate enters that list at the moment of
suspension, revocation or expiry of the registration.

# Context

- **EU rule.** ETSI TS 119 411-8 V1.1.1 §6.3.9: the access certificate provider monitors the verifier's registration and
  **revokes the access certificate when the registration is suspended or revoked** (REV-6.3.9-02/03/04). Revocation status
  information and the CRL profile are tied to EN 319 411-1 (REV-6.3.9-01, CSS-6.6.2-01). The text of EN 319 411-1 is not in the
  library; the periods below were chosen below the known upper limits.
- **RFC 5280.** CRL v2 (§5), `nextUpdate` mandatory in this profile (§5.1.2.5), the Authority Key Identifier (§5.2.1) and CRL
  Number (§5.2.3) extensions, a reasonCode per entry (§5.3.1). The CRL is signed by the authority that issued the certificate;
  another signer is possible only with an indirect CRL (`cRLIssuer` + `indirectCRL`), and support for it in validators is weak.
  The certificate points to the CRL's location with the CRL Distribution Points extension (§4.2.1.13).
- **EU alignment round (2026-11-15, recommendation 4; KA-411-8-1).** The EU reference wallet library performs PKIX revocation
  checking on the access certificate; since our certificate shows no revocation path, it either cannot be checked at all or (in
  strict mode) may be refused.
- **Today.** Access certificates are issued directly by the offline root ([[ADR-0058]]); the root's key is only in the operator's
  secret folder, not on the server. The verifier's status (`ACTIVE`/`SUSPENDED`/`REVOKED`/`RETIRED`) is in the signed list; the
  Tamga wallet core matches the leaf that signs the request with the fingerprint in the list and refuses a registration that is
  not active. The registration certificate is revoked in the status list on suspension and revocation under [[ADR-0068]] K4.
- **Direction of project management.** CRL was chosen as the revocation path (not OCSP); the publication address will be a path
  under the existing trust list domain without opening a new subdomain; the names are approved separately.

# Decision

## K1 — Scope: which certificate is revoked through which path

| Certificate | Format | Revocation path |
|---|---|---|
| Access certificate (WRPAC) | X.509 | **CRL** (this decision) |
| Registration certificate (WRPRC) | JWT / CWT (ETSI TS 119 475) | Token Status List ([[ADR-0068]]) — unchanged |
| Credential issuer certificate | X.509 | organisation status in the signed list (C1/C2); outside the scope of this decision |

Each certificate type has a single revocation path. The CRL carries only X.509 serial numbers; the registration certificate does
not enter the CRL. When a verifier is suspended, two things happen in the same publication: its registration certificates are
revoked in the status list and its access certificate in the CRL. The trigger is one (the status change in the registry); the
outputs are separate.

## K2 — Access certificate authority

- The CRL is signed by the authority that issued the certificate (direct CRL). Since the root stays offline, access certificates
  are issued by the **access certificate authority** (`access-ca-1`): a root-signed intermediate authority; basicConstraints CA,
  path length 0 (critical); keyUsage keyCertSign + cRLSign (critical); SKI; AKI = the root's SKI; its own CRL distribution point
  is the root's CRL. It issues only access certificates.
- The authority's key is held by the list publisher, under the same protection as the registrar key. The root key does not go to
  the publisher.
- The root's own CRL (covering intermediate authorities and, during the transition, the access certificates issued directly by
  the root) is signed on the computer where the root is kept (`ops/gen-pki.ts --root-crl`); `nextUpdate` at most 365 days; it is
  re-signed at once when an intermediate authority or an access certificate issued by the root is revoked. The publisher checks
  this copy (authority signature, issuer name, validity period, required serial numbers) and publishes it; it raises an alarm on
  a missing or expired copy.
- Transition: today's access certificates issued directly by the root are covered by the root's CRL until they expire or are
  renewed; on renewal they are issued by the access certificate authority (renewal with the same key as in [[ADR-0058]];
  `client_id` changes, the persistent identity `dns_name` does not — [[ADR-0034]], [[ADR-0075]]). The `x5c` of the request object
  carries the intermediate authority after the leaf (root excluded).

## K3 — Address and distribution point

> The address rule is replaced by [[ADR-0090]] (2026-11-18): the CRL is on a separate host (`crl.tamga.network`), `http` +
> `https`, with two names in the distribution point. The format, profile and extension rules below remain in force.

- The address is at the publication root, without a new subdomain: `<trust list domain>/crl/<authority>.crl`. Real network
  `https://trust.tamga.network/crl/access-ca-1.crl` and `…/crl/root-ca.crl`; sandbox `https://trust.sandbox.tamga.network/crl/…`.
- Format DER, response type `application/pkix-crl` (RFC 2585), public, CORS open.
- Every access certificate and the access certificate authority's certificate carry a non-critical CRL Distribution Points
  extension (2.5.29.31) with a single distribution point pointing to the issuer's CRL (no `cRLIssuer` and no `reasons`).
- The configuration is in the registry at `national_lists[].roles.access_ca.crl` (`issuers[{ca, uri}]`); it is an internal
  setting of the publisher and is not written to the LOTL. Without the configuration no CRL is produced.

## K4 — CRL profile and freshness

- v2, ES256 (ecdsa-with-SHA256), issuer = the authority's subject name (byte for byte identical), AKI = the authority's SKI,
  CRLNumber (monotonically increasing per authority), a reasonCode per entry.
- The CRL of the authority whose key is held by the publisher is re-signed **at every publication and every hourly heartbeat**;
  `nextUpdate` = `thisUpdate` + 24 hours. So even if the publisher stops for a day, the CRL appears expired (a validator does not
  accept it as valid with stale information).
- The state persists in the publication folder (`access-crl-state.json`: CRL number per authority, certificates seen,
  revocations; no personal data). If the file is lost, the state is rebuilt from the published CRL (the revocations are signed in
  the CRL itself).

## K5 — Revocation triggers

| Event | reasonCode |
|---|---|
| The verifier's registration was suspended (`SUSPENDED`) or revoked (`REVOKED`) | `privilegeWithdrawn` (9) |
| The registration ended (`RETIRED`) | `cessationOfOperation` (5) |
| The access certificate was removed from the registration (replaced by a new one) and has not expired | `superseded` (4) |
| Manual revocation (`crl-revoke`; e.g. key compromised) | `keyCompromise` (1), `affiliationChanged` (3), `superseded`, `cessationOfOperation`, `privilegeWithdrawn` |

- Revocation is automatic and in the same publication (REV-6.3.9-04). A revoked certificate is never removed from the list.
- A manual revocation request is authenticated through the path in [[ADR-0068]] K4 (the registrar, the verifier itself or a
  competent public authority, REV-6.2.4-02/03); the serial number, domain name and reason code are written to the public
  changelog, no person's name.

## K6 — Permanent revocation for suspension (no `certificateHold`)

- The access certificate of a suspended registration is **permanently revoked**; RFC 5280's reversible `certificateHold` reason
  is not used. When the registration becomes active again, the verifier is issued a new access certificate (possibly the same
  key, a new serial number).
- An active (`ACTIVE`) registration cannot point to a revoked access certificate: in that case the publisher stops the
  publication before the list is signed.

## K7 — Who checks

- **The Tamga wallet core and verifier do not fetch the CRL.** They take trust in the access certificate from the registration
  in the signed list (fingerprint + status); the CRL is produced from the same registry state and carries no new information. A
  second check adds a network request, latency and a "which verifier is being talked to" leak, with no security gain.
- The CRL is for **EU wallets and PKIX validators**: a wallet that checks the access certificate only through the X.509 chain
  sees the suspended verifier in the CRL.
- In the verification pipeline the CRL/OCSP step for the credential issuer certificate (A3c) is skipped as today (the credential
  issuer's status is in the list).

## K8 — Rollout

- Sandbox: the access certificate authority, the configuration, the CRL and the nginx response type from today (once the authority's key is loaded on the sandbox server, the CRL is signed there); new access certificates are issued by the authority.
- Real network: the authority certificate is issued at the root ceremony, its key is placed in the publisher, the root's CRL is
  signed, the access certificate of the network's own verifier is renewed from the authority and the configuration is added —
  after the path names are approved. Until the configuration is added, the real network's publication does not change.

# Options considered

| Option | Result | Reason |
|---|---|---|
| OCSP | rejected | Requires a permanently online responder and signing key; tells the server which certificate is asked about at every check (privacy); EU wallets read CRLs too |
| Today's path (only dropping from the list) + justification | rejected | REV-6.3.9-04 requires revocation of the certificate; a wallet following the X.509 path cannot see the suspension |
| CRL signed directly by the root, ceremony only | rejected | Immediate revocation on suspension would need an offline ceremony each time; the "same publication" rule cannot be kept |
| Indirect CRL or a separate CRL signer (same name, another key) | rejected | Exists in RFC 5280, but support in validators is weak and inconsistent; interoperability risk |
| `certificateHold` for suspension | rejected | Reversible revocation; many validators either do not process it at all or treat it as permanent revocation; ETSI and [[ADR-0068]] say revoke on suspension |
| CRL checking in the Tamga wallet as well | rejected | The same information is in the signed list; a double check adds a network request and a leak |
| **Online access certificate authority + direct CRL, 24 hours + the root's yearly CRL** | **chosen** | Standard PKI arrangement (offline root, online issuing authority); suspension in the same publication; no extra protocol |

# Invariants

| Code | Rule |
|---|---|
| AR1 | When a verifier's registration is suspended, revoked or ended, its access certificate enters the CRL in the same publication; permanent revocation is used for suspension too (no `certificateHold`), and a revoked certificate is never removed from the list. |
| AR2 | An access certificate issued after this decision carries a CRL Distribution Points extension pointing to the issuer's CRL; the online authority's CRL is re-signed at least every 24 hours (nextUpdate ≤ 24 hours). |
| AR3 | An active verifier registration cannot point to a revoked access certificate; in that case the publisher stops the publication before the list is signed. |
| AR4 | A registration certificate does not enter the CRL; each certificate type has a single revocation path (access certificate: CRL; registration certificate: the [[ADR-0068]] status list). |
| AR5 | The Tamga wallet core and verifier take trust in the access certificate from the signed list; the CRL is not an additional or alternative source of trust for them. |

# Consequences

- `apps/trust-publisher`: `src/access-crl.ts` (revocation plan, CRL signature and check, state recovery), wiring into `build` and
  `heartbeat`, `crl-status`, `crl-revoke`; `roles.access_ca.crl` is in the TL11 allow list and is not written to the LOTL.
- `ops/gen-pki.ts`: `access-ca-1` (development and sandbox), CRL distribution point in access certificates, `--root-crl`.
  `ops/pki-issue.ts`: `--ca`, `--crl-uri` (mandatory for access certificates on the real network), the intermediate authority's
  certificate `<name>.chain.pem`.
- Operator: `/crl/` (`application/pkix-crl`) in the nginx `trust.*` blocks.
- Documents: [[SPEC-TRUST-0001]] §2 and the release note.
- The real network steps are in K8; the path names (`/crl/`, `access-ca-1.crl`, `root-ca.crl`) and the authority's subject name
  await approval.

# Status

**Accepted — 2026-11-15** (approval by project management; the verbatim quotation is in the private approval record).
DECISIONS: D-REG-5. AR1–AR5 are binding. In force in the sandbox; on the real network once the path names are approved (K8).
