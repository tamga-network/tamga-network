/** ADR-0097 K2: kayıt kurumuna güven — sabit imzacı ya da listedeki kayıt kurumu CA'sına zincir (wrprc ve wrprc-status ortak). */
import { anchoredChainCerts } from "@tamga-network/trust/core";
import { certUsage, certValidity, KU_DIGITAL_SIGNATURE, KU_KEY_CERT_SIGN } from "./asn1.js";
import { certFingerprintHex } from "./sdjwt.js";

const SKEW_SEC = 60;
/** x5c üst sınırı (yaprak + en çok üç CA): kimliği doğrulanmamış girdide imza doğrulama işini sınırlar. */
const MAX_CHAIN = 4;

/**
 * ADR-0097 K2: kayıt sertifikasını (ya da durum listesini) imzalayan sertifika LOTL'deki kayıt kurumu anahtarlarına bağlı mı.
 * (a) Sabitleme: yaprağın parmak izi listede (bugünkü Tamga kayıt kurumu; [[ADR-0026]] yolu değişmez).
 * (b) Zincir: x5c'de yapraktan listedeki bir kayıt kurumu CA sertifikasına kadar imzalar doğrulanıyor (ETSI TS 119 602 Ek G) ve
 *   - yaprak CA değil, anahtar kullanımı varsa `digitalSignature` içerir;
 *   - yaprağın üstündeki her sertifika (listedeki CA dahil) `cA=TRUE`, anahtar kullanımı varsa `keyCertSign`, `pathLen`'e uyar —
 *     böylece CA olmayan bir imzacı anahtarı (süresi dolmuş ya da sabit imzacı) yeni yaprak türetemez;
 *   - çapa dışındaki her sertifika geçerlilik süresi içinde.
 * Genel `root_cas` çapa sayılmaz — yalnız kayıt kurumu anahtarları. Zincir en çok `MAX_CHAIN` sertifika; listedeki bir sertifika
 * x5c'de yoksa imza doğrulamasına hiç girilmez.
 */
export function registrarSigned(
  chain: readonly Uint8Array[],
  registrarKeys: readonly string[],
  nowSec: number,
): boolean {
  const leaf = chain[0];
  if (!leaf || !registrarKeys.length || chain.length > MAX_CHAIN) return false;
  const keys = new Set(registrarKeys.map((k) => k.toLowerCase()));
  if (keys.has(certFingerprintHex(leaf))) {
    // Sabit yol: imzacı doğrudan listede. Listedeki bir CA sertifikası doğrudan imzacı olamaz (CA anahtarı imza atmaz).
    try {
      const u = certUsage(leaf);
      return !u.ca || (u.keyUsage !== undefined && (u.keyUsage & KU_DIGITAL_SIGNATURE) !== 0);
    } catch {
      return false;
    }
  }
  if (chain.length < 2) return false;
  try {
    if (!chain.slice(1).some((c) => keys.has(certFingerprintHex(c)))) return false;
    const path = anchoredChainCerts([...chain], { anchorFingerprints: keys });
    if (path.length < 2) return false;
    const lu = certUsage(leaf);
    if (lu.ca || (lu.keyUsage !== undefined && !(lu.keyUsage & KU_DIGITAL_SIGNATURE))) return false;
    for (let i = 1; i < path.length; i++) {
      const u = certUsage(path[i]);
      // CA: cA=TRUE VE anahtar kullanımı keyCertSign — anahtar kullanımı yoksa ret (varsayılan ayarlı kendinden imzalı sabit imzacı CA sayılmaz)
      if (!u.ca || u.keyUsage === undefined || !(u.keyUsage & KU_KEY_CERT_SIGN)) return false;
      if (u.pathLen !== undefined && u.pathLen < i - 1) return false; // altındaki ara CA sayısı
    }
    for (let i = 0; i < path.length - 1; i++) {
      const v = certValidity(path[i]);
      if (v.notBefore > nowSec + SKEW_SEC || nowSec >= v.notAfter) return false;
    }
    return true;
  } catch {
    return false;
  }
}
