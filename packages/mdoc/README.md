# @tamga-network/mdoc

A minimal ISO/IEC 18013-5 **mdoc** (mobile document) profile in pure TypeScript (`@noble`, React Native compatible):
deterministic CBOR, `COSE_Sign1`, the MobileSecurityObject, selective disclosure and device authentication. Tamga issues the
identity credential as an mdoc next to its SD-JWT VC, e.g. for age checks that receive `age_over_18` and nothing else (ADR-0013).

## Install

```sh
npm install @tamga-network/mdoc
```

## Usage

```ts
import { issueMdoc, discloseMdoc, verifyIssuerSigned } from "@tamga-network/mdoc";
```

`cbor.ts` deterministic CBOR · `cose.ts` COSE_Sign1 (ES256, x5chain), COSE_Key · `mdoc.ts` issue, disclose, verify, device
signing, OpenID4VP session transcripts (OpenID4VPHandover and the Digital Credentials API handover) · `proximity.ts` ISO 18013-5
in-person presentation: device engagement (QR) with the EU presentation offer, session encryption, BLE message framing, reader
authentication (`signReaderAuth`, `verifyReaderAuth`) and the CBOR registration certificate in `requestInfo` · ISO/IEC 18013-7
Annex C (HPKE) for browser presentation · status list and identifier list tokens in CWT form.

## Not included (by design)

- The BLE radio itself — the transport is supplied by the wallet app (typically through a native module).
- NFC engagement.

## Secure defaults (0.7.0)

`verifyIssuerSigned` returns `valid: false` for a document without a device key; `clockSkewSec` is capped at 600 s; `now` is
`EpochSeconds`.

## Status

Published on npm as the `0.7.3` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
