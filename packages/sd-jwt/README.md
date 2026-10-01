# @tamga-network/sd-jwt

SD-JWT VC in the Tamga profile: issue with selective disclosure and holder binding, present with a key-binding JWT, and run the format checks of the verification pipeline.

## Install

```sh
npm install @tamga-network/sd-jwt
```

## Usage

```ts
import { issueSdJwtVc, pemIssuerSigner, verifySdJwtVc } from "@tamga-network/sd-jwt";

const signer = await pemIssuerSigner(ISSUER_KEY_PEM, ISSUER_CERT_PEM);
const { combined } = await issueSdJwtVc({ signer, iss, vct, vctIntegrity, iat, cnfJwk, status, claims });
```


## Status

Pre-release (`0.1.0`) on npm — written and tested; the API may still change before `1.0`. Every release is built from this
repository by GitHub Actions and carries npm provenance (verifiable link to the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/README)
- Code: Apache-2.0 · Documentation: CC BY 4.0
