// Tamga Wallet — donanım anahtarları (Secure Enclave). SPEC-WALLET-0001 WL1/WL3, ARF WUA_16a.
// Özel anahtar Secure Enclave'de üretilir ve oradan çıkmaz; Keychain'de yalnız Secure Enclave'in şifreli anahtar kutusu
// (dataRepresentation) tutulur — başka cihazda ya da enclave dışında kullanılamaz. İmza: ES256, SHA-256 CryptoKit içinde,
// çıktı ham r||s (64 bayt). Köprüden geçen ikili veri standart base64.
import CryptoKit
import DeviceCheck
import ExpoModulesCore
import Foundation
import Security

internal final class KeyException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "TamgaKeys: \(param)" }
}

public final class TamgaKeysModule: Module {
  private static let service = "network.tamga.keys"

  public func definition() -> ModuleDefinition {
    Name("TamgaKeys")

    AsyncFunction("info") { () -> [String: Any] in
      return [
        "storage": SecureEnclave.isAvailable ? "secure_enclave" : "none",
        "platform": "ios",
      ]
    }

    AsyncFunction("generate") { (ref: String, challenge: String?) -> [String: Any] in
      _ = challenge  // iOS: anahtar kanıtı yok (Android ile aynı imza için)
      guard SecureEnclave.isAvailable else { throw KeyException("Secure Enclave not available") }
      if try Self.loadBlob(ref) != nil { throw KeyException("key exists: \(ref)") }
      var error: Unmanaged<CFError>?
      guard
        let access = SecAccessControlCreateWithFlags(
          nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, .privateKeyUsage, &error)
      else { throw KeyException("access control: \(String(describing: error?.takeRetainedValue()))") }
      let key = try SecureEnclave.P256.Signing.PrivateKey(accessControl: access)
      try Self.saveBlob(ref, key.dataRepresentation)
      // iOS'ta anahtar başına kanıt zinciri yoktur; cihaz kanıtı App Attest ile (appAttest* işlevleri)
      return Self.publicJwkFields(key.publicKey).merging(["storage": "secure_enclave"]) { $1 }
    }

    AsyncFunction("publicKey") { (ref: String) -> [String: Any]? in
      guard let blob = try Self.loadBlob(ref) else { return nil }
      let key = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob)
      return Self.publicJwkFields(key.publicKey)
    }

    AsyncFunction("sign") { (ref: String, dataB64: String) -> String in
      guard let blob = try Self.loadBlob(ref) else { throw KeyException("key not found: \(ref)") }
      guard let data = Data(base64Encoded: dataB64) else { throw KeyException("data is not base64") }
      let key = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob)
      let sig = try key.signature(for: data)  // SHA-256(data) içeride
      return sig.rawRepresentation.base64EncodedString()
    }

    // P4-2 cihaz kanıtı (ARF WIAM_04/08): Apple App Attest. Her kayıtta yeni App Attest anahtarı; clientDataHash =
    // SHA-256(tamga-unit|meydan okuma|birim parmak izi) — sağlayıcı Apple köküne kadar doğrular.
    AsyncFunction("appAttest") { (clientDataHashB64: String) async throws -> [String: String] in
      let service = DCAppAttestService.shared
      guard service.isSupported else { throw KeyException("App Attest not supported") }
      guard let hash = Data(base64Encoded: clientDataHashB64) else { throw KeyException("hash is not base64") }
      let keyId = try await service.generateKey()
      let attestation = try await service.attestKey(keyId, clientDataHash: hash)
      return ["key_id": keyId, "attestation": attestation.base64EncodedString()]
    }

    AsyncFunction("delete") { (ref: String) in
      let q: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: Self.service,
        kSecAttrAccount as String: ref,
      ]
      SecItemDelete(q as CFDictionary)
    }
  }

  // MARK: - yardımcılar

  private static func publicJwkFields(_ pub: P256.Signing.PublicKey) -> [String: Any] {
    let raw = pub.x963Representation  // 0x04 || X(32) || Y(32)
    return [
      "x": raw.subdata(in: 1..<33).base64EncodedString(),
      "y": raw.subdata(in: 33..<65).base64EncodedString(),
    ]
  }

  private static func saveBlob(_ ref: String, _ blob: Data) throws {
    let q: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: ref,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      kSecValueData as String: blob,
    ]
    let status = SecItemAdd(q as CFDictionary, nil)
    if status != errSecSuccess { throw KeyException("keychain add failed: \(status)") }
  }

  private static func loadBlob(_ ref: String) throws -> Data? {
    let q: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: ref,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var out: AnyObject?
    let status = SecItemCopyMatching(q as CFDictionary, &out)
    if status == errSecItemNotFound { return nil }
    if status != errSecSuccess { throw KeyException("keychain read failed: \(status)") }
    return out as? Data
  }
}
