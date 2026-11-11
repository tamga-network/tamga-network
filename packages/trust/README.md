# @tamga-network/trust

Signed trust lists (who may issue which document, since when, and their status) behind one `TrustSource` interface. Verifies the list of lists, the national lists and the public anchor log; answers in three values (YES / NO / UNKNOWN). `@tamga-network/trust/core` is the platform-independent core (React Native too). Wallet unit attestation checks (`verifyWalletAttestation`, WUA/WIA) live here too.

## Install

```sh
npm install @tamga-network/trust
```

## Usage

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

const { source } = await fetchListTrustSource("https://trust.tamga.network", httpGet, {
  rootFingerprints: PINNED_ROOTS, // from tamga.network/trust-anchor, fixed in your configuration
  verifyJws,
});
source.issuers();                                // registered institutions
source.relyingPartyByDnsName("example.com");      // a verifier's registration (permanent domain) and allowed fields
source.relyingParty("x509_hash:…");                // the same record, by the request's client_id (HAIP 1.0)
source.isCredentialAcceptable(issuerId, iat);    // "YES" | "NO" | "UNKNOWN" — judged on the issue date
```

A complete, tested version: [`examples/04-check-institution`](https://github.com/tamga-network/tamga-network/tree/main/examples/04-check-institution).


## Secure defaults (0.7.0)

- `verifyWalletAttestation` requires `statusOf` (or `"none"` to skip the revocation check deliberately); results carry
  `statusChecked`.
- Rollback protection is on by default: a load without `versionMemory` uses an in-process memory per network and root fingerprints;
  pass a persistent memory to keep it across restarts, or `"none"` to turn it off.

## New in 0.8.3

- `ListTrustSource.relyingParty(clientId)` returns `null` when the record's `dns_name` is ambiguous between the loaded national
  lists (ADR-0075) — the same answer as `relyingPartyByDnsName`. The rule is inside the source; callers need no extra check.
- `fetchListTrustSource(..., { additionalStates: ["AZ", "KZ"] })` loads further national lists besides `stateCode`. The
  cross-list rules only see the lists that are loaded: a client that loads one list cannot detect an ambiguity with another.
- `fetchListTrustSource` throws a `TrustListError` when an `additionalStates` entry cannot be loaded: the state is not in the
  LOTL, its list is not ACTIVE, or the code is not two letters. It no longer returns with fewer lists than requested.

## New in 0.8.1

- Ambiguous gate groups are closed: `terminalGroup(id)` returns `null` when the same `group_id` appears in more than one verifier
  record (e.g. two national lists); `terminalGroupByCertFingerprint(fp)` returns `null` when the fingerprint is in more than one
  active group; a verifier whose `dns_name` appears in more than one national list is ambiguous (`relyingPartyByDnsName` →
  `null`, its groups inactive) unless the lists show a reassignment; a group's `institution_id` slug is matched only against the
  verifier's own national list.
- Reassignment between countries (ADR-0075) is recognised only through a structured record: the single record that is not
  `REVOKED` / `RETIRED` is taken when every other record's last `REVOKED` history entry carries `reassigned_to` naming its
  country; otherwise the name stays ambiguous. New: `StatusHistoryEntry.reassigned_to`, `TrustStore.relying_party_records`,
  `relyingPartyAmbiguous(dns)`, `relyingPartyStateOf(dns)`.
- Anchor log: new line types `registration_status` and `list_view` (the `Anchor` union is wider — handle them in exhaustive
  switches); a `status_list` line may carry `bits` and `size` (together, `size × bits` a multiple of 8, at most
  `STATUS_LIST_MAX_SIZE`). These lines do not enter the verification decision.

## Breaking in 0.8.0

- A gate group is `active` only when its institution (`institution_id`: an issuer `slug` or a verifier `dns_name`) is ACTIVE in
  the list; a REVOKED or SUSPENDED institution's groups report `active: false` and the gate stays closed. Groups without
  `institution_id` (legacy) are judged by the verifier record and the validity window only. See the CHANGELOG section
  "Breaking / behaviour changes in 0.8.0".

## New in 0.7.4

- Gate groups (`terminal_groups[]` in a verifier record): `source.terminalGroup(groupId)` returns `{ group, rp_dns_name, active }`
  (`group.institution_id`, `allowed_policies`, validity) or `null`. `null` also means "list stale" — check
  `source.freshness().healthy` to tell the two apart and keep the gate closed when the list cannot confirm a group.
  `terminalGroupByCertFingerprint` prepares certificate-based gates.
- The LOTL country slot lists ETSI XML list signers separately in `xml_signing_keys`; JSON lists are validated only against
  `signing_keys`, and a JSON list signed by an XML list signer (EKU `id-tsl-kp-tslSigning`) is refused anyway;
  `certExtendedKeyUsages(der)` reads a certificate's EKU. `canonicalizeXml` and `parseXml` are exported for the TS 119 612 XML view.

## Status

Published on npm as the `0.8.3` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
