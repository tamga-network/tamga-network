# Build, test and reproduce

Requirements: Node.js ≥ 22, npm, git. Linux, macOS and Windows are used (CI: Ubuntu). No network access is needed for the tests;
external HTTP is replaced by fakes.

```bash
git clone https://github.com/tamga-network/tamga-network.git
cd tamga-network
git checkout <commit agreed for the review>      # tag audit-1 once set
npm ci
npm run setup        # development PKI (random, under ops/pki/, gitignored), schemas, trust lists, anchor log, sandbox fixtures
npm run check        # all unit + integration tests (vitest) and the TypeScript type check
npm run conformance  # regenerate conformance vectors and run the tests again
npm run format:check
npm run release:check  # pack the nine packages and smoke-test the tarballs
```

`npm run setup` creates throw-away keys; nothing in the repository is a production key. In CI the variable
`TAMGA_REQUIRE_FIXTURES=1` turns a missing fixture into a failure instead of a skipped test.

## Property / fuzz tests

Written with [fast-check](https://fast-check.dev). They run as part of `npm test`; each prints the seed of a failing run.

| File | Properties |
|---|---|
| `packages/sd-jwt/src/property.test.ts` | disclosure round trip and digest over the disclosure string · combined-format split/join · selective-disclosure resolution (open ∪ disclosed = result, hidden and decoy digests invisible, unmatched / duplicate digests rejected, hostile payloads → only `SdStructureError`, no prototype change, depth limit) · status bitstring 1/2/4/8 bits round trip, malformed compression, zlib bomb |
| `packages/mdoc/src/property.test.ts` | canonical CBOR encode/decode stability · random and mutated bytes → value or `Error` within time bounds · over-long length headers, 100 000-level nesting, indefinite lengths, duplicate keys, trailing bytes · status list CWT: every mutation rejected with D3/D4/D6 or identical content, foreign key rejected |
| `packages/wallet-core/src/property.test.ts` | hostile DCQL → `WalletError` only, matcher never crashes · matcher soundness (type, claim presence, `values`, no extra claims, revoked/suspended never offered) · JWS: random input rejected, `alg` confusion rejected, tampering detected · status bit reading for 1/2/4/8 bits |
| `packages/verifier/src/property.test.ts` | response `kid` parsing never throws and round-trips branch ids · JWE `alg`/`enc` outside the profile rejected · random decrypted bodies either satisfy the `vp_token` shape or are rejected |
| `packages/trust/src/property.test.ts` | ETSI XML: XXE (file, network, parameter entities), billion laughs, every DOCTYPE spelling, deep nesting, 50 000 attributes, random XML-like text → only list errors, bounded time · every single-character mutation of a signed list → rejected or identical list · unpinned signer refused · LoTE JSON and Tamga list schemas on random JSON · list JWS: `alg` / `typ` / `x5c` / pin |

More iterations or a fixed seed:

```bash
FC_RUNS=5000 npx vitest run packages/*/src/property.test.ts
FC_SEED=123456 npx vitest run packages/trust/src/property.test.ts
```

## Contracts (chain stage; contracts package shared separately)

```bash
npm run contracts:install && npm run contracts:compile
npm run contracts:test      # unit tests + stateful random invariant sequences (contracts/test/invariants-fuzz.test.ts)
npm run contracts:check     # UUPS static check, storage layout, ABI export
npm run contracts:slither   # requires slither-analyzer
TAMGA_FUZZ_SEED=42 TAMGA_FUZZ_STEPS=400 npm run contracts:test
```

## Invariant catalogue

`invariants.md` is generated: `node scripts/audit-invariant-map.mjs` (add `--check` to verify it is current). The binding
invariants themselves are in `INVARIANTS.md`, generated from each specification's invariant table.

## Running the services locally

The reference verifier: `npm run verify` (port 4004) after `npm run setup`. The identity-attestation and institution issuer
services live in the operator repository; end-to-end scenarios against them are run there.
