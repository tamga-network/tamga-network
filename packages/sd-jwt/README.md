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
const result = await verifySdJwtVc(presentation, { aud, nonce, stateCode: "TR", rootCertsDer });
```

## Status

Published on npm as the `0.3.1` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
