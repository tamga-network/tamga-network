// @tamga-network/zk — iOS yerel ispatçı (ADR-0032 Aşama 2). Rust `tamga_zk_prover` statik kütüphanesi xcframework olarak gelir
// (packages/zk/scripts/build-ios.sh, macOS + Xcode gerekir) ve C ABI'si (`tzp_prove`, `tzp_free`, `tzp_circuit_version`;
// TamgaZkProver.h) doğrudan çağrılır. Girdi tamponu biçimi packages/zk/rust/src/lib.rs. İspat cihazda üretilir; girdiler ağa ya da
// diske yazılmaz, günlüklenmez.
import ExpoModulesCore
import Foundation

internal final class ProveFailedException: Exception, @unchecked Sendable {
  override var code: String { "ERR_ZK_PROVE_FAILED" }
  override var reason: String { "TamgaZk: the proof could not be created" }
}

public final class TamgaZkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TamgaZk")

    Function("isSupported") { () -> Bool in
      true
    }

    Function("circuitVersion") { () -> Int in
      Int(tzp_circuit_version())
    }

    // Ağır iş: AsyncFunction Expo'nun arka plan kuyruğunda çalışır.
    AsyncFunction("prove") { (input: Data) -> Data in
      var out: UnsafeMutablePointer<UInt8>? = nil
      var outLen: Int = 0
      let code: Int32 = input.withUnsafeBytes { raw in
        tzp_prove(raw.bindMemory(to: UInt8.self).baseAddress, input.count, &out, &outLen)
      }
      guard code == 0, let ptr = out else { throw ProveFailedException() }
      defer { tzp_free(ptr, outLen) }
      return Data(bytes: ptr, count: outLen)
    }
  }
}
