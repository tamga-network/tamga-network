---
document_id: GUIDE-0012
title: "Troubleshooting"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Common problems and how to fix them: reasons for "could not be verified", rejected steps, trust list loading errors, wallet
  errors when receiving and presenting credentials, device attestation, registration applications and the service error format.
translation_of: GUIDE-0012
source_version: 1.0.0
---

# Troubleshooting

This page collects the problems developers connecting to Tamga run into most often, and their fixes.

**When to read it:** when a verification gives an unexpected result, when a wallet cannot receive or present a credential, or
when a registration application comes back.

## First: what does the result say?

Verification returns a three-valued result ([[SPEC-API-0001]] §2):

| `outcome` | Meaning | Field to look at first |
|---|---|---|
| `ACCEPTED` | Every step passed | — |
| `REJECTED` | The credential is invalid | `failed_step` |
| `INDETERMINATE` | It could not be checked right now; no judgement on the credential | `indeterminate_reason` |

Do not show `REJECTED` and `INDETERMINATE` with the same message. "This credential is invalid" and "I cannot check right now"
lead to different decisions (AP2).

## "Could not be verified" (`INDETERMINATE`)

| `indeterminate_reason` | Cause | Fix |
|---|---|---|
| `STATUS_UNREACHABLE` | The credential's [[t:status-list]] could not be downloaded | Prefetch status lists (`PrefetchStatusCache` + regular `refresh`); do not go to the network at verification time |
| `STATUS_STALE` | The cached status list passed the freshness threshold, or was fetched before the anchor | Shorten the refresh interval; check clock drift (NTP) |
| `SCHEMA_UNREACHABLE` | The credential type definition could not be fetched | Cache the schema catalogue in advance |
| `CHAIN_UNREACHABLE` / `INDEXER_STALE` | The trust source could not be read, or is stale | Download the trust lists regularly; fetch the new list once `next_update` has passed |
| `SDK_VERSION_MISMATCH` | The library version does not match the rule version | Update the `@tamga-network/*` packages |

If the trust list is stale or cannot be downloaded, trust questions answer `UNKNOWN` and the result is always `INDETERMINATE`;
never `ACCEPTED`, never `REJECTED`.

## Rejected (`REJECTED`)

`failed_step` says which step did not pass ([[SPEC-API-0001]] §1). The most common:

| Step | Meaning | Where to look |
|---|---|---|
| `A3` | The signature chain does not lead to a root in the trust list | Did you load the right list and root fingerprints? Are you verifying a test-environment credential against the live list? |
| `A3b` | The certificate that signed the credential does not match the institution in `iss` | The institution identity is always derived from the certificate; do not trust the `iss` value |
| `A3d` / `A6` | No proof of holder binding (KB-JWT), or `aud`, `nonce`, `iat` do not match | Is the `nonce` you verify the one you sent in the request? Are clocks in sync? |
| `A5` | A disclosure does not match the digests in the credential | The presentation was altered; ask again |
| `C1` | The institution was not active when the credential was issued | Check the institution's status history ([[GUIDE-0006]]) |
| `C2` | The institution was not authorised for this credential type | The institution's type authorisation ([[GUIDE-0007]] §5) |
| `D6` | The credential is revoked or suspended | Ask the institution that issued it |
| `E3` | The fields you asked for are outside your registered scope | Widen your scope ([[GUIDE-0008]] §3) |

## The trust list does not load

| Symptom | Cause | Fix |
|---|---|---|
| Signature does not verify | The pinned root fingerprint does not match the root that signed the list | Take the fingerprint again from `tamga.network/trust-anchor`; do not mix environments (test / live) |
| "Unknown format version" | The list is in a newer format | The reader stops on purpose; update the library |
| Version went back | An old copy is being served (cache, CDN) | The reader rejects rollback; clear the cache |
| External list entries do not appear | The list is stale, its signer does not match the LOTL, or the entry is out of scope | Questions that depend on the external list answer `UNKNOWN`; the other lists are not affected ([[GUIDE-0011]]) |

## Wallet: receiving credentials

| Error (`WalletError`) | Cause | Fix |
|---|---|---|
| `tx_code_mismatch` | Wrong PIN | The PIN never comes through the same channel as the offer; ask the person for the PIN from the SMS or e-mail |
| `offer_expired` / `offer_used` | The offer expired or has been used | Ask the institution for a new offer |
| `offer_not_found` / `invalid_offer` | The QR is damaged or not a Tamga offer | Scan the offer again |
| `trust_error` | The institution or wallet provider is not in the list, or a signature did not verify | Refresh the trust list; check the institution's entry |
| `unsupported` | A type this wallet does not support, or a revoked unit ("This wallet has been revoked.") | If the unit was revoked, register again |
| `network` | No connection | Try again |

## Wallet: device attestation and WUA

- **`device_attestation_failed`:** the wallet provider could not verify the device evidence. The core retries without evidence
  and the unit registers at software level. The cause is usually a development build, an emulator, or an app identity
  (Bundle ID, package name) different from what the provider expects.
- **Registered at software level:** you are running in Expo Go or without the native key module. Use a development build
  ([[GUIDE-0005]] §1).
- **WUA expired:** check with `wuaExpiringSoon` before receiving credentials and renew.

## Wallet: presenting

| Symptom | Cause | Fix |
|---|---|---|
| "Outside the registered scope" warning on screen | The verifier is not registered, or asks for fields outside its scope | Fix the verifier's entry and scope ([[GUIDE-0008]]) |
| Registration certificate does not match | The organisation identifier in the registration certificate differs from the one in the access certificate | Both must come from the same official identification number ([[ADR-0026]]) |
| Copies ran out | No verifier-specific copy is left | Ask the person; renewal comes from the institution ([[ADR-0023]]) |
| Pseudonym request refused | The verifier is not registered, or its entry has no `pseudonyms` setting | Add the pseudonym setting to the entry ([[ADR-0031]]) |

## A registration application came back

The registration tool lists **all** missing or wrong fields at once (`kayıt yapılamadı:` followed by items). Common ones:
`identifiers`, `postal_address`, `contact`, `supervisory_authority` (how to reach it: form address, e-mail or phone),
`scopes[…].privacy_policy_uri`. Format: [[GUIDE-0007]] §2 and [[GUIDE-0008]] §2.

## Service error format

Tamga services return errors in the RFC 9457 format; `tamga_code` is the machine-readable code and `detail` contains no
personal data:

```json
{
  "type": "https://docs.tamga.network/errors/schema-not-authorized",
  "title": "The issuer cannot issue this schema",
  "status": 403,
  "tamga_code": "SCHEMA_NOT_AUTHORIZED"
}
```

- **A rejected credential is not an error:** the verification call succeeds (200) and carries the result in the body (AP5).
- **`409`:** the same `Idempotency-Key` was sent with a different body.
- **`429`:** rate limit; wait for `Retry-After`.

## Still not solved?

Remove personal data from your log and report the `verification_id`, the `failed_step` or `indeterminate_reason`, and the
library version (`sdk_version`). Running the conformance tests reveals most mismatches: [[GUIDE-0009]].
