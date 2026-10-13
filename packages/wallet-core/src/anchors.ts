/**
 * Sertifika zincirinin güvene bağlanması (0.5.2 erişim sertifikası çapası; 0.6.0 yakın alan okuyucu sertifikası). Ortak yardımcılar:
 * `disclosure-policy` (erişim sertifikası) ve `wrprc` (`checkProximityRegistration`, okuyucu sertifikası) kullanır.
 */
import { anchoredChainCerts } from "@tamga-network/trust/core";
import { certFingerprintHex as sha256Hex } from "./sdjwt.js";
import { b64Decode } from "./b64.js";

/**
 * Güven çapası (imzalı listenin `root_cas` kaydı): SHA-256 parmak izi (64 onaltılık karakter), PEM sertifika, base64 DER ya da DER
 * bayt. Yalnız parmak izi, kökü x5c'de taşıyan zinciri bağlar; kökü taşımayan zincir (ARF RO-02, olağan durum) için sertifika
 * gerekir — son sertifikanın imzası çapanın anahtarıyla doğrulanır.
 */
export type TrustAnchor = string | Uint8Array;

/** Çapaları parmak izleri ve sertifikalar olarak ayırır; çözülemeyen girdi atlanır. */
export function splitTrustAnchors(anchors: readonly TrustAnchor[] = []): {
  fingerprints: string[];
  certificates: Uint8Array[];
} {
  const fingerprints: string[] = [];
  const certificates: Uint8Array[] = [];
  for (const a of anchors) {
    if (a instanceof Uint8Array) {
      if (a.length) certificates.push(a);
      continue;
    }
    if (typeof a !== "string") continue;
    const t = a.trim();
    if (/^[0-9a-fA-F]{64}$/.test(t)) {
      fingerprints.push(t.toLowerCase());
      continue;
    }
    try {
      const body = t.replace(/-----(BEGIN|END) [^-]+-----/g, "").replace(/\s+/g, "");
      if (!body || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) continue;
      const der = b64Decode(body);
      if (der.length && der[0] === 0x30) certificates.push(der);
    } catch {
      /* çözülemeyen çapa atlanır */
    }
  }
  return { fingerprints, certificates };
}

/** `anchoredChainCerts` seçenekleri */
export const anchorOpts = (anchors: readonly TrustAnchor[] = []) => {
  const { fingerprints, certificates } = splitTrustAnchors(anchors);
  return { anchorFingerprints: fingerprints, anchorCertificates: certificates };
};

/**
 * Zincir (yaprak ilk) güvene bağlı mı: (i) yaprağın SHA-256 parmak izi `registeredFingerprints`'te (imzalı listedeki tarafın kaydında
 * sabitlenmiş) YA DA (ii) zincir imzası yapraktan `trustAnchors`'tan birine (`root_cas`) kadar doğrulanıyor — kök x5c'de değilse
 * çapa sertifikası son sertifikanın veren imzasını doğrular. İkisi de yoksa `false`: kendinden imzalı kopya hiçbir zaman bağlı değil.
 */
export function chainAnchored(
  chain: readonly Uint8Array[],
  ctx: { trustAnchors?: readonly TrustAnchor[]; registeredFingerprints?: readonly string[] } | undefined,
): boolean {
  const leaf = chain[0];
  if (!leaf || !ctx) return false;
  const pinned = (ctx.registeredFingerprints ?? []).map((f) => f.toLowerCase());
  if (pinned.length && pinned.includes(sha256Hex(leaf))) return true;
  const anchors = ctx.trustAnchors ?? [];
  return anchors.length > 0 && anchoredChainCerts([...chain], anchorOpts(anchors)).length > 0;
}
