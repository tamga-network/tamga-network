// @tamga-network/zk — Android yerel ispatçı (ADR-0032 Aşama 2). Rust `tamga_zk_prover` kütüphanesi (`scripts/build-android.mjs`,
// cargo-ndk → jniLibs/<abi>/libtamga_zk_prover.so) JNI ile çağrılır. Girdi tamponu biçimi packages/zk/rust/src/lib.rs.
// İspat cihazda üretilir; girdiler (belge, cihaz imzası) ağa ya da diske yazılmaz, günlüklenmez. Kütüphane yoksa (ABI desteklenmiyor,
// derlemeye girmemiş) isSupported() false döner ve cüzdan olağan sunuma döner (ZK5).
package network.tamga.zk

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal object ZkNative {
  val loaded: Boolean = try {
    System.loadLibrary("tamga_zk_prover")
    true
  } catch (_: Throwable) {
    false
  }

  @JvmStatic external fun circuitVersion(): Int

  /** Başarıda ispat baytları; hatada `null` (kod `lastError`). */
  @JvmStatic external fun prove(input: ByteArray): ByteArray?
}

internal class ProveFailedException : CodedException("ERR_ZK_PROVE_FAILED", "TamgaZk: the proof could not be created", null)

class TamgaZkModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TamgaZk")

    Function("isSupported") { ZkNative.loaded }

    Function("circuitVersion") { if (ZkNative.loaded) ZkNative.circuitVersion() else 0 }

    // Ağır iş (~0,5–3 sn): Expo AsyncFunction arka plan iş parçacığında çalışır, arayüzü kilitlemez.
    AsyncFunction("prove") { input: ByteArray ->
      if (!ZkNative.loaded) throw ProveFailedException()
      ZkNative.prove(input) ?: throw ProveFailedException()
    }
  }
}
