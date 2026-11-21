---
document_id: ADR-0094
title: "Representative PID providers in the sandbox: EU PID format, one external provider list per state"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-21
last_updated: 2026-11-21
summary: >
  In the sandbox, three representative national identity authorities for Türkiye, Azerbaijan and Kazakhstan issue person
  identification data (PID) in the EU PID rulebook format: SD-JWT VC (urn:eudi:pid:1) and mdoc (eu.europa.ec.eudi.pid.1). As in
  the EU, PID providers are announced not in the trusted list but in a separate provider list (ETSI TS 119 602 LoTE): one list per
  state, shown in the sandbox LOTL with the ADR-0036 external list pointer. The verifier code does not change (the ADR-0036 K5
  path). The real network has no PID provider; TL8 and the Tamga identity credential (ADR-0011) are unchanged. Accepted:
  2026-11-21.
domain: Identity
translation_of: ADR-0094
source_version: 1.0.0
related: ["[[ADR-0011]]", "[[ADR-0036]]", "[[ADR-0038]]", "[[ADR-0045]]", "[[ADR-0092]]", "[[ADR-0093]]", "[[SPEC-TRUST-0001]]", "[[FW-RB-0003]]"]
---

# In short

In Europe a person's digital identity (PID) comes from an identity authority appointed by the state, and institutions recognise
the person with it. The Tamga network has no state PID provider today; instead there is Tamga's provisional identity credential
([[ADR-0011]]). Without touching the real network, this decision proposes to show the EU arrangement end to end in the sandbox:
three representative national identity authorities issue identity credentials in the EU PID format, they are announced in a
separate provider list as in the EU, and the sandbox bank and hotel also recognise the person with this credential.

# Context

- **The EU arrangement.** Member states notify PID providers; the Commission publishes them in a separate provider list in the ETSI
  TS 119 602 format (LoTE, "PID providers"). The PID format is in the EU PID rulebook: SD-JWT VC `urn:eudi:pid:1` and ISO mdoc
  `eu.europa.ec.eudi.pid.1`. The current rulebook has no age attributes (`age_over_NN`); age is proven with a separate age
  verification attestation.
- **Tamga today.** The real network has no PID provider: the `pid_providers[]` field of the national lists is empty
  (SPEC-TRUST-0001/TL8). For identity there is Tamga's provisional identity credential (`urn:tamga:id:IdentityAttestation:1`,
  [[ADR-0011]]); its attribute names are the EU PID ones ([[ADR-0045]]). The verifier already recognises PID providers in external
  lists ([[ADR-0036]] K5): external type (B2), external scope (C), external status signer (D). The sandbox LOTL has one example:
  the OpenID conformance tool's test PID signer (`oidf-test-pid`).
- **Sandbox demonstration network.** The name list (project management approval, 2026-11-19) has three PID providers: "National
  Identity Authority — Türkiye / Azerbaijan / Kazakhstan (representative)", addresses `pid-tr`, `pid-az`, `pid-kz`. The sandbox has
  74 fictional people and the TR, AZ and KZ national lists ([[ADR-0093]]). Project management's direction: the EU PID format;
  institutions also recognise the person with PID; ADR first.

# Decision

## K1 — Sandbox only

The decision is for the sandbox only ([[ADR-0038]]). The real network has no PID provider and this decision does not change that:
TL8 stays as it is, the national lists' `pid_providers[]` field is empty, no external PID list is added to the real LOTL. Admitting
a state PID to the real network is a separate decision.

## K2 — Three representative national identity authorities

Three PID providers in the sandbox: National Identity Authority — Türkiye (`pid-tr`), Azerbaijan (`pid-az`), Kazakhstan (`pid-kz`),
all "(representative)". The "(TEST)" mark is added by the system (SB4). The operator is "Tamga Network Sandbox (TEST)"; every
record states that the state on whose behalf it is operated neither participates nor endorses (the same wording style as
[[ADR-0093]] UL3). An authority issues credentials only to the fictional people of its own state.

## K3 — Publication: one provider list per state

As in the EU, PID providers are announced not in the trusted list but in a separate provider list: one ETSI TS 119 602 LoTE per
authority. The sandbox LOTL shows each of them with the [[ADR-0036]] K1 pointer:

| Field | Value |
|---|---|
| `list_id` | `sandbox-pid-tr`, `sandbox-pid-az`, `sandbox-pid-kz` (names approved by project management, 2026-11-21) |
| `territory` | `TR`, `AZ`, `KZ` |
| `format` | `etsi-lote-json` |
| `signing_keys` | the list's own signer (in the sandbox PKI, separate from the national list signers and the LOTL signer) |
| `scope.entity_kinds` | `["pid_provider"]` |
| `scope.vct` | `["urn:eudi:pid:1", "eu.europa.ec.eudi.pid.1"]` |
| `scope.category` / `assurance` / `class` | `IDENTITY` / `I3` / `PUB` |
| `scope.recognized_by` | `["TR", "AZ", "KZ"]` (like the mutual recognition in the sandbox) |
| `approval` | project management approval and date (FD4) |

The publisher produces and signs the lists from the sandbox source; their copy is at `external/<list_id>.jws` (ADR-0036 K1). The
`pid_provider` role of the state slot in the LOTL does not change (RESERVED); the link is the external list's `territory` field.

## K4 — Separate test roots

Each authority has its own test root, credential signing certificate and status list certificate (sandbox PKI). These do not
chain to the Tamga sandbox root, so that a credential cannot resolve both as a Tamga institution and as an external provider (the
same path as `oidf-test-pid`). The provider list shows the authority's test root as the service certificate. The private keys of
the test roots do not go to the server; the credential signing keys are on the server like those of the sandbox institutions
(deviation S-1, sandbox only).

## K5 — Credential: the EU PID rulebook

Two formats: SD-JWT VC `urn:eudi:pid:1` (nested selective disclosure: `address{…}`, `nationalities[]`; [[ADR-0036]] K6) and mdoc
`eu.europa.ec.eudi.pid.1`. Attributes use the rulebook names and follow the network's external type definition (the external
schemas in `packages/schemas`). Values come from the fictional people; the personal administrative number is deliberately invalid.
There are no age attributes (rulebook); age questions stay with the Tamga identity credential and the driving licence information
([[ADR-0092]]). The credential has a status list (Token Status List; CWT format for mdoc).

## K6 — Issuance

The platform's sandbox services issue the PID (engineering proposal: three sandbox tenants of the hosted issuer; the exact place is
decided in code). There is no identity proofing: the person is chosen from a list, as on the sandbox's fake identity page.
Issuance is OpenID4VCI; the wallet attestation rules are the same as for the other sandbox credentials.

## K7 — Verification

The verifier code does not change: the [[ADR-0036]] K5 path is used. The policies of the sandbox verifiers that ask for identity
(Sikke Bank, Gecekonak Otel) also accept PID in addition to the Tamga identity credential; the person chooses which one to show in
the wallet. In the verifier result the institution appears as an external provider (`issuer.state_code` is the list's
`territory`).

## K8 — Wallet

The wallet receives and shows credentials from a PID provider in a provider list pinned in the signed LOTL. If needed, the
receiving side is added to the wallet core (recognising the external provider at issuance; the receiving direction of ADR-0036
K5). The package release and the wallet build are separate approvals.

## K9 — Relation to the Tamga identity credential

The Tamga identity credential ([[ADR-0011]]) stays as it is; PID does not replace it, and in the sandbox both stand side by side.
When a state PID arrives in the real network, superseding the Tamga identity credential with `successor_id` (TL8) is a separate
decision.

# Rationale / alternatives

- **Filling `pid_providers[]` in the national list — rejected.** It changes TL8 and the list format and needs a new resolution path
  in the verifier; the EU also publishes PID providers in a separate provider list, not in the trusted list.
- **One shared list for the three authorities — second option.** In the EU the Commission publishes all PID providers in one list;
  this is workable too. One list per state is proposed because it shows more clearly the arrangement in which each state notifies
  its own provider, and that a stale list affects only that state (FD3). If project management picks the single list, only K3
  changes.
- **Chaining the authorities' certificates to the Tamga sandbox root — rejected.** The same credential could then resolve by two
  paths.
- **Calling the Tamga identity credential "PID" — rejected.** [[ADR-0011]] K1: Tamga is not a PID provider.
- **Adding age attributes to PID — rejected.** They are not in the current rulebook; adding them would depart from the EU format.

# Invariants

| Code | Rule |
|---|---|
| PP1 | A PID provider exists only in the sandbox; the real network's LOTL has no external PID list and its national lists have no `pid_providers[]` record (TL8). |
| PP2 | A representative PID provider is shown in the sandbox LOTL only through an ETSI TS 119 602 provider list (ADR-0036 K1); its record states that the state does not participate. |
| PP3 | The representative authority's certificates do not chain to the Tamga sandbox root; they chain to its own test root. |
| PP4 | PID is in the EU PID rulebook format (`urn:eudi:pid:1`, `eu.europa.ec.eudi.pid.1`); values are fictional, the personal administrative number is invalid. |
| PP5 | PID does not replace the Tamga identity credential; sandbox policies accept both as options. |

# Open questions — settled on acceptance (2026-11-21)

1. One provider list per state (not one shared list).
2. List names `sandbox-pid-tr`, `sandbox-pid-az`, `sandbox-pid-kz`.
3. Sikke Bank and Gecekonak Otel accept PID (those that ask for identity); verifiers that ask about age do not change.

# Status

**Accepted — 2026-11-21** (project management approval). PP1–PP5 are binding.
Implementation order: sandbox PKI (three test roots) →
publisher (provider lists) → issuer (PID) → verifier policies → wallet (if needed, with a separate package release).

**Implementation notes (2026-11-21).**
- K3: each list's signer is the self-signed `pid-<cc>-list-signer`; the publisher rebuilds and signs the lists from
  `pid-providers.source.json` on every publication and writes them to the publication path (`external-src/`) and to the verified
  copy folder (`external/`) — as it hosts the list itself, it does not wait for `external-fetch`. The test root is the issuance
  service's certificate in the list, `pid-<cc>-status` the revocation service's. The list sequence number is time-based and never goes back (a wiped copy does not trip the reader's
  rollback check).
- K6: three sandbox tenants of the hosted issuer (`pid-tr`, `pid-az`, `pid-kz`; they open only on the sandbox network); the source is
  the fictional people file and an authority issues only to people of its own state. The status list is not anchored; the two PID
  policies fetch it at verification time, only from the status server in the provider list. Today only the SD-JWT VC copy is
  issued; the mdoc copy (K5) is next.
- K7: one registration certificate goes with each request (ETSI TS 119 472-2) and a registered use has one type; so the option is
  not two types in one request but two scenarios on the verifier's page (with the Tamga identity credential / with PID:
  `bank-account-opening-pid`, `hotel-check-in-pid`, a separate registered use). The verification steps did not change; only the
  result's `issuer.state_code` for an external provider is now the external list's `territory` (it was the policy's state).
- K8: the wallet core gained the receiving direction (chain to the anchor in the external list, type in the list's scope) and the
  credential's own status check (signer = the revocation service in the external list); the package release and the wallet build are separate approvals.
