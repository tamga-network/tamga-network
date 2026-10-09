# @tamga-network/schemas

The Tamga document-type catalogue: type metadata and JSON Schema for each `vct` (e.g. `urn:tamga:edu:DiplomaCredential:1`) and their content hashes, as published at schemas.tamga.network.

## Install

```sh
npm install @tamga-network/schemas
```

## Usage

```ts
import { ALL, CATALOGUE_BASE } from "@tamga-network/schemas"; // definitions (runs anywhere, incl. React Native)
import { build } from "@tamga-network/schemas/build"; // Node only: writes the static catalogue to dist/
```


## Status

Published on npm as the `0.3.0` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
