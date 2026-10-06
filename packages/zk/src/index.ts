/**
 * @tamga-network/zk — cüzdan tarafında sıfır bilgi ispatı (ADR-0032 Aşama 2, Longfellow ZK). Kurumun imzaladığı mdoc belgesi
 * hakkında "şu öğe şu değerdedir" ispatını üretir (ilk kullanım: 18 yaş üstü); belge, kurum imzası ve diğer öğeler gösterilmez.
 *
 *   - Çekirdek (bu giriş): saf TS, React Native uyumlu — DCQL'den istek, devre seçimi ve denetimi, ZK DeviceResponse.
 *   - `@tamga-network/zk/react-native`: telefonda yerel ispatçı (Expo modülü; Rust → iOS/Android).
 *   - `@tamga-network/zk/node`: masaüstü ispatçı (alt süreç) — test, uyum denemesi, geliştirme.
 *
 * Ağdaki her cüzdan kullanabilir; doğrulama tarafı `@tamga-network/verifier/zk`.
 */
export * from "./types.js";
export { ZK_FORMAT, isZkQuery, zkQueryFromDcql } from "./request.js";
export type { DcqlCredentialQuery, ZkQuery } from "./request.js";
export { ZK_SYSTEM, selectCircuit, loadCircuit } from "./circuits.js";
export { presentZk, encodeProveBuffer } from "./present.js";
export type { ZkPresentArgs } from "./present.js";
export { memoryCircuitSource, httpCircuitSource, firstCircuitSource, unavailableProver } from "./sources.js";
