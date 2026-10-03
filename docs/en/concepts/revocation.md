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

## Details

- Status list: [[SPEC-CRED-0003]]
- Verification pipeline and freshness: [[SPEC-API-0001]]
