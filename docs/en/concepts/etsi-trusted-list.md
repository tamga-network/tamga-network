---
title: ETSI XML trusted list
---

# ETSI XML trusted list

In Europe trusted lists have been published for years in one XML format: **ETSI TS 119 612**. The EU's signature validation tools
read it. Next to the signed Tamga list ([[SPEC-TRUST-0001]]), Tamga's country list is also published in this format: the same
records, the same sequence number, a XAdES signature. The authoritative source is always the Tamga JSON list; the XML is its second
view ([[ADR-0066]]).

This page is also the **definition page** of the Tamga URIs in the XML list: every address under `https://trust.tamga.network/tl/…`
leads here.

## Where

| Environment | List | Digest | Signer certificate |
|---|---|---|---|
| Sandbox (test network) | `https://trust.sandbox.tamga.network/tl-tr.xml` | `…/tl-tr.sha2` | `…/keys/tl-xml-signer-1.cert.pem` |
| Real network | `https://trust.tamga.network/tl-tr.xml` — **not published yet** (once the operator and institution postal addresses are in place) | | |

- Earlier versions: `archive/tl-tr.v<NNNN>.xml` (same domain).
- The `.sha2` file is the SHA-256 digest of the XML file (hex). It is for checking whether the list changed; it does not
  authenticate (TS 119 612 §6.1). The server cache is at most 4 hours.
- The sandbox list is signed with test keys and is not valid in the real network; its addresses are "Sandbox (TEST)" placeholders.

## What it is not

- Tamga's XML list is **not a list notified** under Regulation (EU) No 910/2014 and contains **no qualified trust service**. The
  legal notice of every XML says so.
- This list does **not** enter the EU's list of third-country trusted lists (TC AdES LOTL): that list is for signature and seal
  certificate providers supervised by a state. When a Turkic state wants to publish its own national list, the same tool and
  template are ready.
- EU URIs that mean "notified by a Member State" or "qualified" (`EUgeneric`, `granted`, `recognisedatnationallevel`, `…/QC`) are
  not used. A reader that does not know the URIs below therefore does **not treat the services as active** — deliberately, the safe
  side.

## What is in the list

| Who | Service type (`ServiceTypeIdentifier`) |
|---|---|
| National root certificate (operator) | `http://uri.etsi.org/TrstSvc/Svctype/CA/PKC` |
| Issuing institution | `http://uri.etsi.org/TrstSvc/Svctype/EAA` or one of the Tamga types below |
| The issuer's status list signature | `https://trust.tamga.network/tl/Svctype/EAA/StatusList` |
| Wallet provider | `http://uri.etsi.org/19602/SvcType/WalletSolution/Issuance` |

Verifiers are **not** in the list (they are not trust service providers; their records are in the JSON list and in registration
certificates). There is never personal data. Records are not deleted: a withdrawn service stays in the list with its status and
history.

## URI definitions {#uris}

Root: `https://trust.tamga.network/tl/`. `<CC>` is the country code (`TR` today).

### List type {#tsltype}

`https://trust.tamga.network/tl/TSLType/<CC>list` — the trust service status list published under the Tamga Trust Framework for
the `<CC>` country slot. The list is the same-version view of Tamga's signed country list (`tl-<cc>.jws`). It is not an EU Member
State list (`EUgeneric`).

### Status determination approach {#statusdetn}

`https://trust.tamga.network/tl/StatusDetn/<CC>determination` — service statuses are determined by the registration and approval
process of the Tamga Trust Framework: the operator registers the institution with its registration data ([[ADR-0024]]) and
authorised credential types and publishes status changes in the signed list. There is no supervisory body decision and no qualified
status in the EU sense.

### Rules {#schemerules}

`https://arf.tamga.network/trust-framework` — the Tamga Trust Framework (the network's rulebook).
`https://trust.tamga.network/tl/schemerules/<CC>` — the rules of the `<CC>` slot; today the Tamga Trust Framework itself (when the
slot passes to a state it points to that state's rules).

### Service statuses {#svcstatus}

One to one with the Tamga status:

| URI (`…/tl/Svcstatus/…`) | Tamga status | Meaning |
|---|---|---|
| `active` | `ACTIVE` | The service is registered and valid; credentials it signs are accepted. |
| `suspended` | `SUSPENDED` | Temporarily suspended; during the suspension the service's signature is not trusted. |
| `revoked` | `REVOKED` | Withdrawn; credentials issued after the moment the withdrawal takes effect are not accepted. |
| `retired` | `RETIRED` | Retired in the normal way (e.g. after handing over to a successor); past credentials are assessed by the status at their date. |
| `rollingover` | `ROLLING_OVER` | Key or root renewal period; the old and the new certificate are valid together. |
| `deprecated` | `DEPRECATED` | Being phased out; new use is not recommended. |

Earlier statuses are in `ServiceHistory`, newest first, with the key identifier (SKI) instead of the certificate.

### Tamga service types {#svctype}

| URI (`…/tl/Svctype/…`) | Meaning |
|---|---|
| `EAA/Pub-EAA` | An institution issuing from or on behalf of a public source (the counterpart of EU PuB-EAA, but not in the EU sense). |
| `EAA/Q` | An issuer accredited in the Tamga Trust Framework (the counterpart of EU QEAA, but **not qualified**). |
| `EAA/StatusList` | The separate service that signs the issuer's status list (Token Status List). |

## Signature and signer

- Signature: XAdES-B-B (EN 319 132-1), enveloped, Exclusive C14N; ECDSA P-256 / SHA-256; only the signer certificate in KeyInfo.
- Signer: a separate XML signing certificate `tl-xml-signer-1`, issued by the network's root certificate; TS 119 612 §5.7.1
  profile — subject `C` = country code, `O` = operator name (`SchemeOperatorName`), basicConstraints CA=false, keyUsage
  digitalSignature + nonRepudiation, extendedKeyUsage `id-tsl-kp-tslSigning` (0.4.0.2231.3.0).
- Validating the signer the Tamga way: its fingerprint is in the `signing_keys` of the country slot in the LOTL (`lotl.jws`); the
  LOTL itself is validated with the [trust anchor](/en/concepts/trust-lists).

Sandbox XML signer (2026-10-29): `CN=Tamga Sandbox Trusted List Signer (TEST), O=Tamga Network Sandbox (TEST), C=TR`, SHA-256
`5576ff2bf0380b32e21a1859c267e6b0031d3c2bbc935adacb7d129eb6dac9c9`.

## Validating with the EU DSS

You can use the demo validator of the EU's open-source signature validation tool **DSS** (Digital Signature Service), run by the
Commission:

1. Download the list: `curl -O https://trust.sandbox.tamga.network/tl-tr.xml`
2. Check the digest: the output of `sha256sum tl-tr.xml` must equal `tl-tr.sha2`.
3. Upload `tl-tr.xml` in the DSS demo validator ("Validate a signature"); keep the default validation policy.
4. Expected result: signature format **XAdES-BASELINE-B**; "reference data intact", "signature intact"; the signing time and
   signer certificate properties are valid. The overall result is **INDETERMINATE / NO_CERTIFICATE_CHAIN_FOUND**: the signer is not
   a trust anchor in the EU's trusted lists — expected and correct. You validate the chain the Tamga way (LOTL).

The schema is checked with ETSI's official XSDs (TS 119 612 V2.4.1 Annex C); Tamga's tests check every generated list against them.

Reading in code: `readTrustedListXml(xml, pinnedFingerprints)` in the `@tamga-network/trust` package checks the signature and the
format. Today the package recognises only ETSI's active statuses; it does not treat Tamga-root statuses as active (safe side).

## Details

- Decision: [[ADR-0066]]
- Mapping tables: [[SPEC-ID-0002]] §8.1
- List format and publication points: [[SPEC-TRUST-0001]]
- Trust lists: [Trust lists and federation](/en/concepts/trust-lists)
