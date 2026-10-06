/**
 * @tamga-network/zk türleri (ADR-0032 Aşama 2). Paket cüzdan tarafındadır: ispatı ÜRETİR. Doğrulama `@tamga-network/verifier/zk`.
 * İlke (ZK1): kurum belgesi değişmez; ispat cüzdanın sakladığı belgeden ve o oturumun olağan cihaz imzasından üretilir.
 */
import type { CborValue } from "@tamga-network/mdoc";

/** İspatlanacak tek öğe: "bu ad alanında bu öğe şu değerdir" (ör. tamga.id.1 / age_over_18 = true). */
export interface ZkClaim {
  namespace: string;
  element: string;
  value: CborValue;
}

/** Güven listesindeki kabul edilen devre (`lotl.zk_circuits[]`, SPEC-TRUST-0001). Yapısal tür: trust paketine bağımlılık yok. */
export interface ZkCircuitEntry {
  circuit_id: string;
  system: string;
  version: number;
  attributes: number;
  sha256: string;
  status: string;
}

/** Arka uca giden ham istek. Bütün baytlar cihazda kalır; arka uç ağa çıkmaz, dosyaya yazmaz, loglamaz. */
export interface ZkProveArgs {
  /** Devre kimliği (`circuit_id`, onaltılık 64) ve özeti denetlenmiş devre baytları (zstd). */
  circuitId: string;
  circuit: Uint8Array;
  /** Bu oturum için cüzdanın olağan yolla ürettiği, cihaz imzalı DeviceResponse (CBOR). Doğrulayıcıya GİTMEZ. */
  deviceResponse: Uint8Array;
  /** OpenID4VP / DC API SessionTranscript (CBOR). */
  transcript: Uint8Array;
  docType: string;
  claims: ZkClaim[];
  /** İspatın "şimdi"si: ISO 8601, saniye, `Z`. */
  now: string;
  /** Belgeyi imzalayan kurum anahtarı (P-256, sıkıştırılmamış nokta 65 bayt: 04 || X || Y). */
  issuerKey: Uint8Array;
}

/** İspat üreticisi. Telefonda yerel modül, masaüstünde alt süreç; yoksa `available() === false` ve cüzdan olağan yola döner (ZK5). */
export interface ZkProver {
  readonly name: string;
  available(): Promise<boolean>;
  /** Longfellow devre sürümü (güven listesindeki devreyle eşleşmeli). */
  circuitVersion(): Promise<number>;
  prove(args: ZkProveArgs): Promise<Uint8Array>;
}

/** Devre baytlarını sağlayan kaynak (paketle gelen devreler, uygulama varlıkları ya da önbellek). */
export interface ZkCircuitSource {
  get(circuitId: string): Promise<Uint8Array | undefined>;
}

export type ZkErrorCode =
  | "unavailable" // bu cihazda ispat üretilemiyor (Expo Go, eski telefon, modül yok)
  | "no_circuit" // güven listesinde ya da cihazda uygun devre yok
  | "circuit_mismatch" // devre baytları listedeki özetle eşleşmiyor (ZK2)
  | "unsupported_request" // istek ZK ile ispatlanamaz (değersiz öğe, birden çok ad alanı…)
  | "prove_failed"; // ispatçı hata verdi (ayrıntı kişi verisi içerebileceği için verilmez)

export class ZkError extends Error {
  constructor(
    readonly code: ZkErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ZkError";
  }
}
