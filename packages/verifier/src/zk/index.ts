/**
 * @tamga-network/verifier/zk — sıfır bilgi ispatlı mdoc doğrulaması (ADR-0032 Aşama 3). Ana hat (`verifyPresentation`)
 * `format: "mso_mdoc_zk"` ile bunu kendiliğinden kullanır; bu alt yol arka ucu değiştirmek, ısıtmak ya da formatı tek başına
 * çalıştırmak isteyenler içindir. Paketle gelen WASM doğrulayıcısı Rust gerektirmez (`npm run zk:build` yalnız yeniden derleme).
 */
export { WasmZkBackend, NativeZkBackend, defaultZkBackend, zkBackendFromEnv, ZK_CODES } from "./backend.js";
export type { ZkBackend, ZkVerifyArgs, ZkAttribute } from "./backend.js";
export { verifyMdocZkFormat } from "../mdoc-zk-format.js";
