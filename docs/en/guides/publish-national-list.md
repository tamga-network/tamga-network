---
document_id: GUIDE-0011
title: "Publish a national trust list"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  How a state, or a body it authorises, connects its own trust list to Tamga Network: two ways (a national list in the Tamga
  format or an external list in the ETSI format), the LOTL entry, roles, signing keys, scope, recognition, hand-over and
  publication rules.
translation_of: GUIDE-0011
source_version: 1.0.0
---

# Publish a national trust list

This guide is for public bodies that will run their country's [[t:trust-list]] (the list operator, [[t:TLSO]]) and for their
technical teams.

**When to read it:**
- When a country joins Tamga Network, or takes over the list Tamga runs on its behalf.
- When your country already publishes its list in the ETSI format and you want Tamga wallets and verifiers to recognise it.
- First: [Trust lists](/concepts/trust-lists) and [Federation](/concepts/federation).

## How it works

Wallets and verifiers trust one thing: the root key of the Tamga [[t:LOTL]]. The LOTL tells them each national list's address,
its signer and what it may vouch for. Connecting a country's list to the network means getting that entry written into the
LOTL. The list stays with the country; Tamga only brings the lists together ([[ADR-0036]]).

| Way | Format | In the LOTL | When |
|---|---|---|---|
| **A. National list** | Tamga format (`tamga-tl+jwt`, [[SPEC-TRUST-0001]]) | `national_lists[]` | The country is a Tamga Network member; issuers, verifiers and root certificates are in its own list |
| **B. External list** | ETSI TS 119 602 ([[t:LoTE]], JSON) | `external_lists[]` | An existing list of the country or the EU; it vouches for specific roles |

Today Tamga runs the Türkiye list (`tl-tr.jws`) on behalf of the national authority; the entries for the other members of the
Organization of Turkic States are reserved (`RESERVED`). There is no external list in the LOTL yet.

## A. National list

### 1. The LOTL entry

```json
{
  "state_code": "TR",
  "status": "ACTIVE",
  "membership": "TDT_MEMBER",
  "list_url": "https://trust.tamga.network/tl-tr.jws",
  "operator": { "name": "Tamga Network", "status": "provisional", "on_behalf_of": "TR national authority (to be designated)" },
  "signing_certs": ["tl-signer-1"],
  "roles": {
    "registrar": { "status": "PROVISIONAL", "operated_by": "Tamga Network", "signing_certs": ["registrar-1"] },
    "tlso": { "status": "PROVISIONAL", "operated_by": "Tamga Network" },
    "pid_provider": { "status": "RESERVED" },
    "access_ca": { "status": "PROVISIONAL", "operated_by": "Tamga Network" },
    "national_root_ca": { "status": "ACTIVE", "cert": "root-ca", "operated_by": "Tamga Network (provisional)" }
  },
  "recognition": { "mode": "unilateral", "recognizes": ["TR"] }
}
```

This is today's Türkiye entry. In a hand-over only `operator`, `list_url` and the signers change in the same entry.

| Role | What it does |
|---|---|
| `tlso` | Signs and publishes the list |
| `registrar` | Registers issuers and verifiers; signs [[t:registration-certificate|registration certificates]] |
| `access_ca` | Issues [[t:access-certificate|access certificates]] to verifiers |
| `national_root_ca` | The root of issuer certificates |
| `pid_provider` | Issues the national identity credential ([[t:PID]]); reserved today |

### 2. List rules

Your list is in the [[SPEC-TRUST-0001]] format and follows these rules:

- **Signature:** ES256; the signer certificate matches `signing_certs` in the LOTL entry. At least two rolling signers are recommended.
- **Version chain:** each publication carries the hash of the previous one (`previous_version_hash`); the version never goes
  back; rows are not deleted, their status changes.
- **Freshness:** `next_update` at most 90 days ahead; changes are live within 24 hours. A stale list gives "could not be
  verified" at the verifier.
- **No personal data:** the list, the [[t:anchor-log]] and the change log contain no personal data.
- **Identifiers by the ledger formula:** `issuer_id`, `ca_id`, `schema_id` stay the same when the ledger opens ([[ADR-0009]]).

### 3. Registration and publishing tool

The list publisher is open source (`apps/trust-publisher`). It runs registration without hand-editing:

```sh
npm run trust:register -- issuer application.json   # add an issuer (reports all missing fields at once)
npm run trust:register -- rp application.json       # add a verifier
npm run trust:authorize -- <slug> <vct>             # credential type authorisation (--revoke to end it)
npm run trust:status -- <slug> SUSPENDED --reason r
npm run trust:build                                  # sign and publish (dist/)
npm run trust:verify                                 # verify the publication
```

Application formats: [[GUIDE-0007]] and [[GUIDE-0008]].

### 4. Recognition

`recognition.mode` and `recognizes[]` say which countries' institutions this country recognises. The verifier asks this in step
C3 of [[SPEC-API-0001]] (`isRecognizedBy`). Mutual recognition between countries is the member states' decision.

## B. External list (ETSI)

If your country's or the EU's list is in the ETSI format, you do not need to move it; a pointer is added to the LOTL:

```json
{
  "list_id": "example-pid-list",
  "territory": "TR",
  "format": "etsi-lote-json",
  "list_url": "https://example.org/lote/pid-providers.jws",
  "signing_keys": [{ "fingerprint_sha256": "…", "status": "ACTIVE" }],
  "operator": { "name": "…" },
  "status": "ACTIVE",
  "scope": {
    "entity_kinds": ["pid_provider", "wallet_provider"],
    "vct": ["urn:eudi:pid:1", "eu.europa.ec.eudi.pid.1"],
    "category": "IDENTITY",
    "assurance": "I3",
    "class": "PUB",
    "recognized_by": ["TR"],
    "min_key_storage": "secure_enclave"
  },
  "approval": { "approved_at": "…", "ref": "…" }
}
```

- **Scope:** an external list can vouch only for the roles in `scope.entity_kinds` (`wallet_provider`, `pid_provider`,
  `eaa_provider`, `access_ca`) and the types in `scope.vct`; out-of-scope entries are ignored.
- **The signer is pinned:** a list whose signer does not match the one in the LOTL is not loaded.
- **Independence:** if an external list is missing or stale, the Tamga lists are not affected; only questions that depend on
  that list answer "unknown".
- **Format:** `etsi-lote-json` is read today; ETSI XML (`etsi-tl-xml`) is defined but has no reader.
- **Copy:** the publisher keeps a copy of the list at `trust.tamga.network/external/<list_id>.jws` (`npm run trust:external`);
  the signature is always checked against the pinned signer.
- **Approval:** adding, changing or removing an external list takes project management approval and is recorded in the
  `approval` field; an entry containing placeholders is not published (FD4).

## Hand-over

The roles Tamga holds on a state's behalf (list operator, registrar, root CA, provisional identity provider) are designed to be
handed over. In a hand-over only the address and the signer change for credentials, wallets and verifiers; identifiers and
issued credentials stay valid ([[ADR-0035]] PO3). The ETSI TS 119 612 view of the national list that the EU expects will be
added to the publisher before the state stage.

## Rules

| Code | What it says |
|---|---|
| [[ADR-0036]] FD1 | An external list is shown in the LOTL only with its address, pinned signer and scope |
| [[ADR-0036]] FD2 | An external list cannot vouch for roles and types outside its scope |
| [[ADR-0036]] FD3 | A problem with an external list does not affect the freshness of the Tamga lists |
| [[ADR-0035]] PO3 | Roles held on a state's behalf can be handed over; only the address and the signer change |
| Unknown format | The reader stops on an unknown format version ([[ARCH-0003]] CMP2) |

List operator rules: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/rulebook).
