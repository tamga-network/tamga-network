# @tamga-network/sd-jwt

SD-JWT VC in the Tamga profile: issue with selective disclosure and holder binding, present with a key-binding JWT, and run the format checks of the verification pipeline. Also holds the Token Status List (revocation list) format: `StatusBitstring`, `signStatusListToken`, `verifyStatusListToken`.

## Install

```sh
npm install @tamga-network/sd-jwt
```

## Usage

```ts
import { issueSdJwtVc, pemIssuerSigner, verifySdJwtVc } from "@tamga-network/sd-jwt";

const signer = await pemIssuerSigner(ISSUER_KEY_PEM, ISSUER_CERT_PEM);
const { combined } = await issueSdJwtVc({
  signer,
  iss, // the institution's issuer URL
  vct, // e.g. "urn:tamga:edu:DiplomaCredential:1"
  vctIntegrity, // "sha256-…" of the type metadata (required)
  iat,
  cnfJwk, // the holder's public key
  status, // { status_list: { idx, uri } }
  claims,
  sdPolicy: { family_name: "always", is_graduate: "allowed" }, // from the type metadata; unlisted claims → "allowed"
});

// verifier side: format checks A1–A7 (structure, signature and chain, disclosures, key binding, validity)
const result = await verifySdJwtVc(presentation, { aud, nonce, stateCode: "TR", rootCertsDer }); // rootCertsDer required
```


## Secure defaults (0.7.0)

- `verifySdJwtVc` requires `rootCertsDer`: the trust anchors, or `"none"` to skip the chain check deliberately (only when you
  check the signer some other way). An empty or missing value fails at A3.
- `verifyStatusListToken` / `verifyStatusListCwt` / `verifyStatusListAny` require `{ expectedSignerFingerprints }`: the SHA-256
  fingerprints of the expected signer certificates (or a function). Another signer fails with `D3` before the signature is checked.
- `now` is `EpochSeconds` (`@tamga-network/core`).

## Status

Published on npm as the `0.6.0` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
