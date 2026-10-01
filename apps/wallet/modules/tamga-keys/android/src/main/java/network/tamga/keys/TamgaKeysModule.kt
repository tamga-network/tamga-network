// Tamga Wallet — donanım anahtarları (Android Keystore: StrongBox, yoksa TEE). SPEC-WALLET-0001 WL1/WL3, ARF WUA_16a.
// Özel anahtar Keystore dışına çıkmaz. Üretimde isteğe bağlı `challenge` ile Android anahtar kanıtı (key attestation) sertifika
// zinciri döner; cüzdan sağlayıcı bu zinciri Google kökleriyle doğrulayıp anahtar deposu seviyesini (StrongBox / TEE) kendisi
// belirler. İmza: SHA256withECDSA (DER) → ham r||s (64 bayt). Köprüden geçen ikili veri standart base64.
package network.tamga.keys

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.math.BigInteger
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

class TamgaKeysModule : Module() {
  private val keyStore: KeyStore by lazy { KeyStore.getInstance("AndroidKeyStore").apply { load(null) } }
  private fun alias(ref: String) = "tamga.holder.$ref"

  override fun definition() = ModuleDefinition {
    Name("TamgaKeys")

    AsyncFunction("info") {
      mapOf("storage" to if (hasStrongBox()) "strongbox" else "tee", "platform" to "android")
    }

    AsyncFunction("generate") { ref: String, challenge: String? ->
      val a = alias(ref)
      if (keyStore.containsAlias(a)) throw CodedException("ERR_KEY_EXISTS", "key exists: $ref", null)
      val strongBox = hasStrongBox()
      try {
        generateKey(a, challenge, strongBox)
      } catch (e: StrongBoxUnavailableException) {
        generateKey(a, challenge, false)
      }
      val pub = keyStore.getCertificate(a).publicKey as ECPublicKey
      val chain = keyStore.getCertificateChain(a)?.map { Base64.encodeToString(it.encoded, Base64.NO_WRAP) } ?: emptyList()
      mapOf(
        "x" to b64(unsigned32(pub.w.affineX)),
        "y" to b64(unsigned32(pub.w.affineY)),
        "storage" to securityLevel(a),
        // yalnız challenge verildiyse anlamlı (anahtar kanıtı); sağlayıcı doğrular
        "attestation" to if (challenge != null) chain else emptyList(),
      )
    }

    AsyncFunction("publicKey") { ref: String ->
      val a = alias(ref)
      if (!keyStore.containsAlias(a)) return@AsyncFunction null
      val pub = keyStore.getCertificate(a).publicKey as ECPublicKey
      mapOf("x" to b64(unsigned32(pub.w.affineX)), "y" to b64(unsigned32(pub.w.affineY)))
    }

    AsyncFunction("sign") { ref: String, dataB64: String ->
      val key = keyStore.getKey(alias(ref), null) as? PrivateKey
        ?: throw CodedException("ERR_KEY_NOT_FOUND", "key not found: $ref", null)
      val sig = Signature.getInstance("SHA256withECDSA").run {
        initSign(key)
        update(Base64.decode(dataB64, Base64.NO_WRAP))
        sign()
      }
      b64(derToRaw(sig))
    }

    AsyncFunction("delete") { ref: String ->
      val a = alias(ref)
      if (keyStore.containsAlias(a)) keyStore.deleteEntry(a)
    }
  }

  private fun generateKey(alias: String, challenge: String?, strongBox: Boolean) {
    val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
      .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
      .setDigests(KeyProperties.DIGEST_SHA256)
      .apply {
        if (challenge != null) setAttestationChallenge(Base64.decode(challenge, Base64.NO_WRAP))
        if (strongBox && Build.VERSION.SDK_INT >= 28) setIsStrongBoxBacked(true)
      }
      .build()
    KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore").run {
      initialize(spec)
      generateKeyPair()
    }
  }

  private fun hasStrongBox(): Boolean {
    val ctx = appContext.reactContext ?: return false
    return Build.VERSION.SDK_INT >= 28 &&
      ctx.packageManager.hasSystemFeature("android.hardware.strongbox_keystore")
  }

  /** Yerel beyan (bilgi amaçlı); güvenilir seviye sağlayıcının kanıt zincirini doğrulamasıyla belirlenir. */
  private fun securityLevel(alias: String): String {
    val key = keyStore.getKey(alias, null) as PrivateKey
    val info = KeyFactory.getInstance(key.algorithm, "AndroidKeyStore").getKeySpec(key, KeyInfo::class.java)
    return if (Build.VERSION.SDK_INT >= 31) {
      when (info.securityLevel) {
        KeyProperties.SECURITY_LEVEL_STRONGBOX -> "strongbox"
        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> "tee"
        else -> "software"
      }
    } else {
      @Suppress("DEPRECATION")
      if (info.isInsideSecureHardware) "tee" else "software"
    }
  }

  private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)

  /** BigInteger → 32 baytlık işaretsiz büyük-uçlu. */
  private fun unsigned32(v: BigInteger): ByteArray {
    val raw = v.toByteArray()
    val out = ByteArray(32)
    val src = if (raw.size > 32) raw.copyOfRange(raw.size - 32, raw.size) else raw
    System.arraycopy(src, 0, out, 32 - src.size, src.size)
    return out
  }

  /** ECDSA DER (SEQUENCE { INTEGER r, INTEGER s }) → r||s (64 bayt). */
  private fun derToRaw(der: ByteArray): ByteArray {
    var i = 2
    if (der[1].toInt() and 0x80 != 0) i += der[1].toInt() and 0x7f
    fun readInt(): ByteArray {
      require(der[i].toInt() == 0x02) { "DER: INTEGER expected" }
      val len = der[i + 1].toInt() and 0xff
      val v = der.copyOfRange(i + 2, i + 2 + len)
      i += 2 + len
      return unsigned32(BigInteger(1, v))
    }
    val r = readInt()
    val s = readInt()
    return r + s
  }
}
