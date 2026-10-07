# @tamga-network/zk

Wallet-side zero-knowledge proofs for ISO mdoc credentials on Tamga Network ([ADR-0032](https://docs.tamga.network/adr/0032-zk-mdoc-presentation),
Longfellow ZK — the system the EU age-verification profile uses). The wallet proves a statement about a credential it holds — "in
this credential, `age_over_18` is `true`" — without showing the credential, the issuer's signature or any other element. The
issuer's credential is not changed (ZK1). Verification is `@tamga-network/verifier/zk`.

Any wallet on the network can use this package.

## Entry points

| Import | Runs on | What |
|---|---|---|
| `@tamga-network/zk` | everywhere (pure TS, React Native safe) | DCQL `mso_mdoc_zk` query → claims, circuit selection and check against the trust list (ZK2), ZK DeviceResponse (TS13 `ZkDocument`) |
| `@tamga-network/zk/react-native` | iOS, Android (Expo module `TamgaZk`) | on-device prover: Rust → static library (iOS) / `.so` (Android) |
| `@tamga-network/zk/node` | desktop, CI | prover as a child process (`tamga-zk-prove`): tests, conformance runs, development |

When no prover is available (Expo Go, unsupported phone, module missing) `available()` returns `false` and the wallet presents the
usual way (ZK5).

## Flow

```ts
import { presentZk, zkQueryFromDcql, firstCircuitSource } from "@tamga-network/zk";
import { nativeProver } from "@tamga-network/zk/react-native";

const query = zkQueryFromDcql(dcqlCredentialQuery); // format "mso_mdoc_zk"
const response = await presentZk({
  prover: nativeProver,
  circuits: firstCircuitSource(bundledCircuits /* , httpCircuitSource(<circuit host>) */),
  trustedCircuits: lotl.zk_circuits,
  query,
  deviceResponse, // the wallet's usual device-signed DeviceResponse for this session (never sent)
  transcript, // OpenID4VP / DC API SessionTranscript
  issuerX5chain, // issuer leaf (+ chain), DER
  issuerKey, // issuer P-256 key, uncompressed point
});
```

Circuit files (~300 KB, no personal data) are checked against the SHA-256 in the signed trust list before use, so their source
does not change trust: bundle them with the app, or fetch them with `httpCircuitSource` once a circuit host is published.

The device signature is made the usual way (hardware key, phone lock — WL11); the prover only takes the signed response as input.
Nothing leaves the device except the proof.

## Building the native parts

| Target | Command | Needs |
|---|---|---|
| Desktop prover (`bin/`) | `npm run zk:build -w @tamga-network/zk` | Rust (`rust/rust-toolchain.toml`); on Windows the patched upstream clone from `tools/zk-circuit` |
| Android (`android/src/main/jniLibs/`) | `npm run zk:android -w @tamga-network/zk` | Android NDK, `cargo-ndk` |
| iOS (`ios/TamgaZkProver.xcframework`) | `npm run zk:ios -w @tamga-network/zk` | macOS, Xcode |

Build outputs are not committed; the published package includes them. Packing (`scripts/pack-packages.mjs`) fails if any of the
three Android libraries is missing, and writes their SHA-256 checksums to `lib/native-checksums.json`.

**iOS (for now):** the iOS library needs macOS to build and has not been built yet. Until `ios/TamgaZkProver.xcframework` exists,
the module is Android-only: `expo-module.config.json` lists only `"android"` and the published package does not contain `ios/`, so
iOS apps build normally and `available()` returns `false` there (usual presentation, ZK5). Once the xcframework is built, packing
adds `ios/` and the `"apple"` platform automatically. The Rust core (`rust/`) uses the same pinned upstream commit
as the verifier (`packages/verifier/zk`).

## License

Apache-2.0
