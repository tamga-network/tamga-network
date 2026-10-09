---
title: Revocation and freshness
---

# Revocation and freshness

A credential can be withdrawn ([[t:revocation]]): a student record is deleted, a ticket is refunded, an identity verification
stops being valid. The [[t:verifier]] learns about it from the **[[t:status-list]]**.

## The status list

Every institution publishes the status of the credentials it has issued in the IETF **Token Status List** format
(`https://status.tamga.network/{opaque}`). The list is a bit string; each credential has a position in it. The address reveals
neither the institution nor the year or cohort. Every publication of the list is recorded in the anchor log of the trust
infrastructure, which is how the verifier checks that the list really comes from the institution.

The list is republished **every 2 minutes**, even when nothing changed, so the moment of a revocation does not leak; while the
status server is up, a revocation reaches verifiers within a few minutes (the publication interval plus your prefetch
interval). Each list token is valid for 6 hours (`exp` = `iat` + 6 hours): if the status server goes down, a verifier can keep
verifying with the last list for that long.

## Prefetching

The verifier fetches the status lists **before verification**, at regular intervals, and keeps them in a cache; no request
goes to the institution or to Tamga at the moment of verification. That way the institution cannot learn where and when a
credential was shown.

```ts
import { PrefetchStatusCache } from "@tamga-network/verifier";

const statusCache = new PrefetchStatusCache();
await statusCache.refresh(listUris); // every few minutes
```

## Freshness and "cannot be verified right now"

If the status list or the [[t:trust-list]] is older than the maximum age in your policy, the result is `INDETERMINATE`: the
credential may well be valid, but it cannot be proven right now. Tell the user "cannot be verified right now, please try again
shortly" — do not reject.

`@tamga-network/verifier` 0.3.1 and later uses a list token until its `exp` and the maximum age in your policy
(`max_status_token_age_sec`).

## Zero-knowledge proofs and revocation

A presentation with a zero-knowledge proof ([[t:ZK]]) does not disclose the position in the status list, so revocation cannot be
checked in the presentation. Decision ([[ADR-0044]]): such a presentation uses only short-lived copies, valid for at most 24
hours and refreshed by the wallet on its own; the copies of a revoked credential are not refreshed. Implementation is pending;
until then such a presentation returns `INDETERMINATE` unless the policy explicitly sets `accept_unrevocable_zk`.

## Details

- Status list: [[SPEC-CRED-0003]]
- Verification pipeline and freshness: [[SPEC-API-0001]]
- Short-lived copies for zero-knowledge proofs: [[ADR-0044]]
