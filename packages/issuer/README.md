# @tamga-network/issuer

Everything an institution needs to issue: a credential factory, OpenID4VCI helpers and the revocation-list publisher (Token Status List, fixed interval, random positions; the list format itself is in `@tamga-network/sd-jwt` and re-exported here). The `/client` subpath talks to Tamga's hosted issuing service with your institution's API key.

## Install

```sh
npm install @tamga-network/issuer
```

## Usage

```ts
import { createIssuerClient } from "@tamga-network/issuer/client";

const tamga = createIssuerClient({ baseUrl: "https://issuer.tamga.network", slug: "your-institution", apiKey });
const offer = await tamga.createOffer({ subjectId: "121200001", vct: "urn:tamga:edu:DiplomaCredential:1" });
// offer.deepLink → QR code;  offer.txCode → a different channel, never inside the link
```

A complete, tested version: [`examples/03-issue-hosted`](https://github.com/tamga-network/tamga-network/tree/main/examples/03-issue-hosted).


## Status

Published on npm as the `0.2.0` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
