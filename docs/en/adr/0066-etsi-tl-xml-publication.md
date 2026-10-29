---
document_id: ADR-0066
title: "ETSI TS 119 612 XML list view"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
translation_of: ADR-0066
source_version: 1.0.0
summary: >
  Tamga's country lists are published today as Tamga JSON + JWS and as an ETSI TS 119 602 (LoTE) JSON view; publishing ETSI
  TS 119 612 XML (XAdES-signed trusted lists) was deferred on 2026-10-13 (ADR-0036 annex). The Commission's interim path for third
  countries (the list of third-country trusted lists, TC AdES LOTL) and the EU trusted-list ecosystem expect the national list in
  119 612 XML; the list owner is the state, the network can provide the tool and the template. Proposal: for each country slot a
  119 612 XML view is generated from the same signed source with the same sequence number and a XAdES-B-B signature; generation is
  switched on with a flag (off by default). Only the Türkiye slot is active today; it was switched on first in the sandbox (with a
  separate XML signing certificate conforming to §5.7.1); the real network follows with project-management approval once the
  operator and institution postal addresses are in place. ETSI URIs that claim qualified or notified status in the EU sense are not
  used; list type, status and rules URIs come from the Tamga root (`https://trust.tamga.network/tl/…`). Accepted 2026-10-29
  (project-management approval).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0024]]", "[[ADR-0035]]", "[[ADR-0036]]", "[[ADR-0042]]", "[[SPEC-TRUST-0001]]", "[[SPEC-ID-0002]]", "[[FW-TF-0001]]"]
---

# In short

In Europe trusted lists have been published for years in one XML format (ETSI TS 119 612); the EU's signature validation tools
read it. Today's interim path for recognising the list of a non-EU country in Europe also goes through this format. Tamga's lists
are not published in it today. This decision publishes the same list in a second format as well, from the same signed source and
with the same sequence number. It was switched on first in the test network (sandbox); switching it on in the real network depends
on completing the postal addresses.

# Context

- **Today.** The country list (`tl-<cc>.jws`) and the LOTL are Tamga JSON + JWS ([[SPEC-TRUST-0001]]); there is also an ETSI
  TS 119 602 LoTE JSON view for wallets, verifiers and issuers ([[SPEC-ID-0002]] §8.1.1). Tamga **reads** 119 612 XML lists
  (external lists, [[ADR-0036]] K1) but does not **publish** its own list as XML: the [[ADR-0036]] annex (2026-10-13) deferred this,
  with "the first EU party asks for it" as the trigger.
- **Third-country path.** eIDAS Art. 14 ties the recognition of third-country trust services to an agreement or an implementing
  act; the procedure is not defined yet and no country has full recognition. The Commission opened an interim path instead: the
  "Pilot for the International Compatibility of Trust Services" and the list of third-country trusted lists (TC AdES LOTL).
  Signatures and seals created with certificates of the listed country's trust service providers can be validated as advanced
  signatures in EU public services (not legal equivalence). Preconditions: a national trusted list in ETSI TS 119 612 format, a
  four-pillar self-assessment (ETSI TR 103 684) and a pilot with the Commission. Ukraine is the first country on the list; its
  list (`TSLVersionIdentifier` 6, its own URI root, a pointer to the EU LOTL) is a working example of this path. The World Bank's
  Western Balkans digital ID diagnostics (2026) recommend the same interim step for candidate countries.
- **What it means and what it does not.** The TC AdES LOTL covers the state-supervised providers of **signature and seal**
  certificates. The institutions in Tamga's own list (non-qualified issuers, wallet providers) are not its subject, and Tamga is not
  a state: Tamga's XML list does **not** enter the TC AdES LOTL. The gain is twofold: (1) when a Turkic state wants to publish its
  own national list, the network offers a ready, tested tool and template ([[ADR-0035]] federation; the network provides tools, the
  list owner is the state); (2) Tamga's own list also becomes readable as XML for the ARF expectation of supporting both formats
  (ISSU_10b, OIA_15b) and the `etsi_tl` trusted-authority type in Implementing Regulation (EU) 2026/1731.
- **Standard.** ETSI TS 119 612 V2.4.1 (2025-08): non-EU operators may use their own URIs "defined on purpose" for list type,
  status determination approach, rules and service status (§5.3.3, §5.3.8, §5.3.9, §5.5.4); the signature is XAdES-B-B, enveloped,
  Exclusive C14N, with only the signer certificate in KeyInfo (§5.7.1, Annex B); `NextUpdate` at most 6 months ahead (§5.3.15);
  history is never removed (`HistoricalInformationPeriod` 65535, §5.3.12); a `.sha2` digest file next to the publication address
  (§6.1). TS 119 602 (LoTE) carries the same data model in JSON; Tamga generates both from the same source.
- **Old table.** The 119 612 mapping in [[SPEC-ID-0002]] §8.1 (issuer → `CA/QC`, `granted`) does not match today's decisions:
  `granted` and `…/QC` claim a qualified service in the EU sense; Tamga's issuers are not qualified ([[ADR-0022]]).

# Decision

## K1 — XML view from the same signed source, same version

- For each country slot the list publisher generates a TS 119 612 XML view from the `tl-<cc>` object it signed and from the LOTL:
  `tl-<cc>.xml`, next to it `tl-<cc>.sha2` (SHA-256 digest of the binary file) and the archive copy `archive/tl-<cc>.vNNNN.xml`.
- `TSLSequenceNumber` = the Tamga list `version`; `ListIssueDateTime` = `issued_at`; `NextUpdate` = at the latest `next_update`, at
  most 6 months. The XML is not a separate list but the second format of the same release; no separate counter (see open points).
- The authoritative source is the Tamga JSON list (BT4). If XML and JSON disagree, JSON prevails; the XML cannot contain a record
  that is not in the JSON.

## K2 — URI profile: a Tamga root that claims nothing

- List type `https://trust.tamga.network/tl/TSLType/<CC>list`, status determination `…/StatusDetn/<CC>determination`, rules
  `https://arf.tamga.network/trust-framework` + `…/schemerules/<CC>`, service status `…/Svcstatus/{active, suspended, revoked,
  retired, rollingover, deprecated}` (one to one with the Tamga status set). The URI names and root were approved by project
  management (2026-10-29); their meaning is defined on `docs.tamga.network/en/concepts/etsi-trusted-list` and every URI under
  `trust.tamga.network/tl/` redirects to that page (§5.3.7, §5.5.4).
- ETSI URIs that mean "notified by a Member State" or "qualified" in the EU (`EUgeneric`, `EUappropriate`, `granted`,
  `recognisedatnationallevel`, `…/QC`) are not used. A reader that does not know these URIs does not treat the service as active
  (safe side).
- The service type is ETSI's where an ETSI type describes the function one to one: national root CA → `Svctype/CA/PKC`,
  non-qualified issuer → `Svctype/EAA`, wallet solution → TS 119 602 `SvcType/WalletSolution/Issuance` (same as the LoTE). Types
  whose ETSI counterpart would carry a claim, or that have none, come from the Tamga root: PuB-EAA counterpart →
  `…/Svctype/EAA/Pub-EAA`, accredited in Tamga (QEAA counterpart) → `…/Svctype/EAA/Q`, the issuer's status list signing →
  `…/Svctype/EAA/StatusList`.
- When a state takes over a slot, the URI set can be changed per slot (e.g. ETSI `TSLType/<CC>list`); records, identifiers and the
  version chain do not change ([[ADR-0009]], D-GOV-5).

## K3 — Scope: trust service providers

- Listed: the operator's national root CA; issuers (issuance service + status list signing service); wallet providers (from the
  LOTL; the network does not operate a wallet — [[ADR-0042]]). Inactive records are not deleted: they stay with their Tamga status
  URI and their history (TL2, §5.5.10; history carries the SKI, not the certificate).
- Not listed: `RESERVED` / `PROVISIONAL` records; verifiers (not trust service providers — their records are in the JSON list and in
  registration certificates, [[ADR-0026]]). Never personal data (D-TRUST-0, DP1).
- A legal notice in every XML: "a view of the Tamga list; not a list notified under 910/2014; the list contains no qualified trust
  service."

## K4 — Signature: XAdES-B-B and a separate XML signing certificate

- The signature follows TS 119 612 Annex B and EN 319 132-1 XAdES-B-B: enveloped, `URI=""` + enveloped-signature + Exclusive C14N,
  SignedProperties (SigningTime, SigningCertificateV2, DataObjectFormat `text/xml`), only the signer certificate in KeyInfo; ECDSA
  P-256 / SHA-256.
- The signer certificate follows the §5.7.1 profile: subject `C` = slot country code, `O` = `SchemeOperatorName`; keyUsage only
  digitalSignature (and/or nonRepudiation); basicConstraints CA=false; SKI; extendedKeyUsage `id-tsl-kp-tslSigning`
  (0.4.0.2231.3.0). Today's list signer (`tl-signer-1`) has no basicConstraints and no EKU, so a **separate XML signing certificate**
  (`tl-xml-signer-1`) is used: a leaf issued by the network's root CA that signs only the XML list; `tl-signer-1` keeps signing the
  JSON lists. Issued in the sandbox on 2026-10-29; on the real network the certificate is issued in the production PKI outside the
  repository, with project-management approval. On the real network no XML is published with a signer that does not follow the
  profile; the publisher stops.
- The XML signer's fingerprint is published in the LOTL among the signing keys of the country slot (`national_lists[].signing_keys`,
  no new field) and its certificate is placed in `keys/` (Tamga's way of validating the signer is the LOTL).

## K5 — Publication: off by default, sandbox first

- The generation flag `TAMGA_TL119612` is off by default. Order of switching on: sandbox (`trust.sandbox.tamga.network/tl-tr.xml`),
  independent validation (the EU DSS validator, the ETSI XSD), then the real network (`trust.tamga.network/tl-<cc>.xml`) — each step
  with project-management approval. The sandbox was switched on on 2026-10-29.
- The server serves `.xml` as `application/vnd.etsi.tsl+xml` and `.sha2` as `text/plain`, with a cache of at most 4 hours (§6.1,
  §6.2).
- On the real network missing publication data (the operator's postal address, institution and wallet provider addresses —
  [[ADR-0024]]) stops publication; in the sandbox it is a warning. Sandbox records carry placeholder addresses marked
  "Sandbox (TEST)"; on the real network placeholders are not accepted.
- Even with the flag on, 119 612 XML is generated only for `active` country slots (TR today); for reserved slots (AZ, KZ, KG, UZ, …)
  generation starts together with that slot's first list.

# Options considered

| Option | Result | Why |
|---|---|---|
| (a) Parallel XML for each country slot from the same signed source | **proposed (code)** | One source, one version chain; the tool is ready when a state takes over a slot; same principle as the LoTE |
| (b) Only the Türkiye slot, now | **proposed (publication)** | TR is the only active slot today; (a)'s code and (b)'s publication are the same thing — reserved slots are empty |
| (c) Keep deferring (ADR-0036 annex) | rejected | The third-country path and EU tools expect 119 612; without the tool, support to a state is an empty promise; the work is small (done) |
| Generate the XML by hand or from a separate registry | rejected | Two sources drift apart; risk of conflict with the JSON (BT4) |
| Use ETSI `granted` / `recognisedatnationallevel` / `EUgeneric` | rejected | A claim of qualified or EU-notified status; Tamga is not a state, the services are not qualified |
| Also list verifiers as TSPs | rejected | They are not trust service providers; in the EU too the relying-party record is in the registrar, not the list |
| Sign with the current list signer | rejected (real network) | Does not follow the §5.7.1 profile (basicConstraints, EKU); accepted with a warning in sandbox and tests |
| A separate sequence number for the XML (from 1) | rejected (today) | §5.3.2 says "first release 1", but a separate counter makes mapping JSON and XML harder; open point |

# Invariants

| Code | Rule |
|---|---|
| TX1 | TS 119 612 XML is generated only from the signed Tamga country list and the LOTL, with the same version (`TSLSequenceNumber` = `version`); the XML cannot contain a record that is not in the JSON list; in a conflict the JSON prevails. |
| TX2 | The XML uses no ETSI URI that claims notified or qualified status in the EU sense (`EUgeneric`, `EUappropriate`, `granted`, `recognisedatnationallevel`, `…/QC`); list type, status and rules URIs are the slot operator's root. |
| TX3 | The signature is XAdES-B-B, enveloped, Exclusive C14N; only the signer certificate in KeyInfo; the signer certificate follows TS 119 612 §5.7.1. On the real network no XML is published with a non-conforming signer or with missing publication data. |
| TX4 | Records are not deleted: an inactive service stays with its status and history; `RESERVED` / `PROVISIONAL` records, verifiers and personal data do not enter the XML. |
| TX5 | Generation is switched on with a flag (off by default); on the real network it is switched on with project-management approval, after the sandbox and independent validation. |

# Consequences

Prepared (2026-10-29, off by default; nothing published):

- `apps/trust-publisher/src/tl119612.ts`: model, XML writing, XAdES-B-B signature, §5.7.1 signer check; with the flag
  (`TAMGA_TL119612=1`, signer `TAMGA_TL119612_SIGNER`) `build` writes `tl-<cc>.xml`, `.sha2` and the archive copy.
- `@tamga-network/trust`: the XML canonicalisation and parser are exported (`canonicalizeXml`, `parseXml`; source 0.7.4, not
  published on npm) — signing and validation use the same canonicalisation.
- `apps/trust-publisher/etsi/19612/`: ETSI's official XSDs (TS 119 612 V2.4.1 Annex C) and the W3C/ETSI schemas they import; tests
  check every generated list against them.
- Tests: schema (libxml2), signature (the package's validator and an XML signature library independent of it), XAdES properties,
  tampering, flag, signer profile; sandbox sample in `test/fixtures/tl119612/`. The sample passed the EU DSS validator as
  "XAdES-BASELINE-B, signature and references intact" (the result is INDETERMINATE because the signer is not an EU trust anchor —
  expected).

On acceptance (2026-10-29):

- The [[SPEC-ID-0002]] §8.1 table was rewritten for this profile (the old `CA/QC` + `granted` mapping is gone); the XML view was added
  to the publication section of [[SPEC-TRUST-0001]]; a "lifted — ADR-0066" note in the [[ADR-0036]] annex.
- Switched on in the sandbox: `tl-xml-signer-1` (issued by the sandbox root, §5.7.1 profile), placeholder addresses marked "TEST" in
  the sandbox records, `trust.sandbox.tamga.network/tl-tr.xml` + `.sha2`, the URI explanation page
  (`docs.tamga.network/en/concepts/etsi-trusted-list`, tr/en/az). The live list was validated against the ETSI XSD and the EU DSS
  validator.
- Remaining for the real network: the production XML signing certificate (real network PKI, outside the repository; command in
  `ops/README.md`) and its fingerprint in the LOTL; the operator's postal address; institution and wallet provider address data;
  then the flag (with project-management approval).
- Reader side (separate work): the `@tamga-network/trust` 119 612 reader recognises only ETSI active statuses today; recognising the
  Tamga-root statuses is a separate decision, when a Tamga XML list pinned in a LOTL is to be read.

**Open points:** (1) the URI names are approved; the XML signing certificate's name (`tl-xml-signer-1`, subject "Tamga Sandbox
Trusted List Signer (TEST)" / on the real network "Tamga Network Trusted List Signer 1") awaits confirmation; (2) whether `TSLSequenceNumber` follows the
JSON version or starts at 1 with a separate counter; (3) when a state slot applies to the TC AdES LOTL, the pointer to the EU LOTL
and the Commission's third-country mapping ("MRA") element in that list — the publisher supports the pointer, the content is the
state's; (4) mapping the ETSI TR 103 684 self-assessment to the network's rulebook (separate research).

# Status

**Accepted — 2026-10-29.** With project-management approval. DECISIONS: D-TRUST-6. On in the sandbox; on the real network it is
switched on with project-management approval once the postal addresses and the production XML signing certificate are in place.
