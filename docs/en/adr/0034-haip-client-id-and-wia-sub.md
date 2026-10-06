---
document_id: ADR-0034
title: "HAIP 1.0 conformance"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-06
summary: >
  Two HAIP 1.0 rules are applied: in signed requests the verifier uses only the `x509_hash` client identifier and the wallet accepts
  only that (§5); the WIA `sub` is a value shared by all instances of the same wallet solution (§4.4.1). Because `x509_hash` changes
  when the certificate is renewed, `dns_name` is added to the RP record as its permanent identifier; copy separation, pseudonyms,
  pass cards and intermediary relationships are bound to it.
domain: Trust
translation_of: ADR-0034
source_version: 1.0.0
---

# Plain summary

- Verifiers identify themselves not by domain name but by **their certificate's fingerprint** (`x509_hash`); the HAIP 1.0 profile
  the EU has adopted makes this mandatory. The wallet accepts only this form.
- The fingerprint changes when the certificate is renewed. So each verifier record in the trust list also carries a **permanent
  domain name** (`dns_name`); pseudonyms, credential copies and pass cards are bound to it — users' accounts and cards keep working
  when the certificate is renewed.
- The "who" field (`sub`) of the wallet attestation is the same on every phone (the name of the wallet solution); it carries no
  phone-specific value.

# Context

In round 43 (2026-09-30) the [[t:HAIP]] 1.0 requirements were mapped one by one; two gaps remained and, because they touched closed
decisions, were left for an ADR:

1. **Client identifier prefix.** HAIP 1.0 §5: "For signed requests, the Verifier MUST use, and the Wallet MUST accept the Client
   Identifier Prefix `x509_hash`". [[t:OpenID4VP]] 1.0 §5.9.3: the value is the base64url SHA-256 digest of the DER encoding of the
   leaf X.509 certificate; the wallet verifies that the digest matches the leaf certificate, the signature and the certificate
   chain. Before this decision the Tamga [[t:verifier]] used `x509_san_dns:<domain>` (SPEC-PROTO-0002 §2; the [[t:trust-list]]
   record and the [[ADR-0017]] intermediary relationships were keyed on this string). ETSI TS 119 475 defines the
   [[t:access-certificate]] as the `x509_hash` leaf (CIR 2026/1730).
2. **[[t:WIA]] `sub`.** HAIP 1.0 §4.4.1: "The subject claim for the Wallet Attestation MUST be a value that is shared by all Wallet
   instances using the present type of wallet implementation"; moreover the `client_id` in the [[t:PAR]] is this `sub` value. Tamga
   Wallet's [[t:wallet-provider]] (then `apps/wallet-provider` in this repository; moved to the wallet's own repository by
   [[ADR-0042]]) wrote the fingerprint of a per-transaction ephemeral key as `sub`
   ([[ADR-0025]] K2). That was fine for untraceability, but did not follow the letter of the rule.

On 2026-10-01 project management approved the EU path for both items.

# Decision

## K1 — Verifier client identifier `x509_hash`

The `client_id` of the signed request object is [[t:x509_hash]]`:` + base64url(SHA-256(access certificate DER)). The value is
**never configured by hand**: `pemRpSigner(key, certificate)` computes it from the certificate; so do the presentation requests of
Tamga Verify and the institution issuers. The configuration files have no `TAMGA_VERIFY_CLIENT_ID` or `TAMGA_ISSUER_RP_CLIENT_ID`.

## K2 — The wallet accepts only `x509_hash`

HAIP requires no other prefix; no backward compatibility is written in the development stage ([[ADR-0029]]). Wallet: if the prefix
is not `x509_hash`, or the digest does not match the leaf certificate, the request is rejected. The security aspect of the
`x509_san_dns` rule is kept: the domain of the response address (`response_uri`) must be one of the SAN domain names of the
certificate that signed the request (except local development addresses). `tamga_on_behalf_of` (intermediated request,
[[ADR-0017]] K7) is also in `x509_hash` form.

## K3 — Permanent identifier in the RP record: `dns_name`

The trust list `relying_parties[]` record:

- `client_id`: computed by the publisher from the access certificate (`x509_hash:…`); not written in the registry source.
- `dns_name` (mandatory): the permanent record identifier; must appear in the access certificate's SAN (the publisher checks; if
  not, publication stops). The registration tool (`register rp`, `scope <dns_name>`), intermediary relationships
  (`uses_intermediaries`, `served_relying_parties`) and [[t:registration-certificate]] production work with this field.
  `TrustSource.relyingPartyByDnsName()`.

## K4 — What must stay independent of the certificate is bound to `dns_name`

- **Copy separation** ([[SPEC-WALLET-0001]] WL5) and **pseudonym derivation** ([[ADR-0031]] K2): once the record is resolved and
  the certificate matches, the wallet maps `rpKey` to the record's `dns_name` (`stableRpKey`). The verifier checks the pseudonym
  against the same value. For an unregistered [[t:RP]] `client_id` remains (no pseudonym is issued anyway).
- **Pass card** ([[ADR-0012]] B): the `aud` of the card token is the RP's `dns_name` (the card is valid for days, QR ≤ 400 bytes;
  `x509_hash` is both long and changes on renewal).
- **Log:** the RP identifier in the presentation record is `dns_name`; the wallet also resolves the record by domain name.
- **Ticket** (`EventTicket.gate.verifier_client_id`): the field name stays (no schema rename in the development stage); its value
  is the verifier's `dns_name` — tickets are long-lived.

## K5 — WIA `sub` as a shared value

In the WIA the wallet provider sets `sub` = the wallet solution's identifier (`solution_id`, e.g. `tamga-wallet-expo`). There is no
instance-specific value; what distinguishes instances is only the new `cnf` key and the new, unlinkable [[t:status-list]] entry in
every transaction ([[ADR-0025]] K2 unchanged). The `client_id` in the PAR and the `iss` of the PoP are this value. The `wallet_sub`
the institution records points to the solution, not the person (less information, better privacy).

# Invariants

| Code | Rule |
|---|---|
| CI1 | In a signed request the verifier uses only the `x509_hash` client identifier; the value is computed from the access certificate, not read from configuration (HAIP 1.0 §5). |
| CI2 | The wallet accepts only the `x509_hash` prefix; if the digest does not match the leaf certificate the request is rejected. The response address's domain must be in the signing certificate's SAN (except local development). |
| CI3 | In the trust list RP record, `client_id` is computed by the publisher from the access certificate; the permanent record identifier is `dns_name`, which must appear in the certificate's SAN. |
| CI4 | Copy separation, pseudonym derivation, the presentation log and intermediary relationships are bound to `dns_name`, not to `x509_hash`. |
| CI5 | The `aud` of a pass card token is the RP's `dns_name`. |
| CI6 | The WIA `sub` is a value shared by all instances of the same wallet solution; it carries no instance-specific identifier (HAIP 1.0 §4.4.1). |

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| Staying with `x509_san_dns` | rejected | HAIP 1.0 §5 requires the verifier to use `x509_hash`; EU wallets must accept only that. |
| Accepting both prefixes | rejected | HAIP does not require the second; two paths mean two sets of security checks. Development stage (ADR-0029). |
| Binding pseudonyms / copies to `x509_hash` | rejected | Every pseudonym (account) and pass card would change when the certificate is renewed. |
| `rp_id` as the permanent identifier | rejected | `rp_id` is also derived from the certificate (`keccak256(country ‖ SHA-256(certificate))`). |
| **`dns_name` (the domain in the SAN)** | **accepted** | Already in the record (the `x509_san_dns` string); independent of the certificate; the publisher can check consistency with the SAN. |
| WIA `sub` = ephemeral key fingerprint | rejected | Untraceable, but against the letter of HAIP; an EU institution expects a shared value in the PAR. |

# Consequences / operational impact

- **Certificate renewal order:** first the new access certificate is entered into the registry source and the list is republished
  (the new `client_id` in the list), then the verifier switches to the new certificate. If the certificate changes before the list
  is published, the wallet rejects the request as "not registered / impersonation". Pseudonyms, copies and pass cards are not
  affected (K4). Registration certificates (ADR-0026) are regenerated on every publication.
- **Registration tool:** the application carries `dns_name`, not `client_id`; `scope <dns_name>`.
- **Conformance vectors:** `dns_name` in the RP record, `client_id` as `x509_hash`.
- **ZK experiment fixture** (`packages/verifier/src/zk/fixtures/session.json`): the `client_id` string in the session transcript
  stays in `x509_san_dns` form (the proof was produced with that string; the string itself is not checked).

# Status

**Accepted — 2026-10-01** (approved by project management). Implemented: core (`x509HashClientId`), trust (schema +
`relyingPartyByDnsName`), trust-publisher, verifier (signer, pass card), wallet-core (request verification, `stableRpKey`,
`fetchRpRecord`), wallet, Tamga Verify, wallet provider, platform issuer.
