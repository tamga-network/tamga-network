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
in-person presentation: device engagement (QR), session encryption, BLE message framing.

## Not included (by design)

- The BLE radio itself — the transport is supplied by the wallet app (typically through a native module).
- NFC engagement and reader authentication — planned.

## Status

Published on npm as the `0.4.0` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
