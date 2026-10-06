/**
 * @tamga-network/zk/react-native — telefonda yerel ispatçı (Expo modülü `TamgaZk`; Rust → Android .so / iOS xcframework).
 * Modül yalnız geliştirme ve mağaza derlemesinde vardır; Expo Go'da ya da desteklenmeyen telefonda `available()` false döner ve
 * cüzdan olağan sunuma döner (ZK5). İspat telefonda üretilir; belge ve cihaz imzası telefondan çıkmaz.
 */
import { requireOptionalNativeModule } from "expo-modules-core";
import { encodeProveBuffer } from "./present.js";
import { ZkError, type ZkProveArgs, type ZkProver } from "./types.js";

interface TamgaZkNative {
  isSupported(): boolean;
  circuitVersion(): number;
  prove(input: Uint8Array): Promise<Uint8Array>;
}

const native = requireOptionalNativeModule<TamgaZkNative>("TamgaZk");

export class NativeModuleProver implements ZkProver {
  readonly name = "native-module";

  async available() {
    try {
      return !!native && native.isSupported();
    } catch {
      return false;
    }
  }

  async circuitVersion() {
    if (!native) throw new ZkError("unavailable", "zero-knowledge prover is not available");
    return native.circuitVersion();
  }

  async prove(args: ZkProveArgs): Promise<Uint8Array> {
    if (!native) throw new ZkError("unavailable", "zero-knowledge prover is not available");
    try {
      return await native.prove(encodeProveBuffer(args));
    } catch (e) {
      if (e instanceof ZkError) throw e;
      throw new ZkError("prove_failed", "the proof could not be created");
    }
  }
}

/** Uygulamanın tek ispatçısı. */
export const nativeProver = new NativeModuleProver();
