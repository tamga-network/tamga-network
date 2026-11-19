/**
 * ADR-0090 — CRL dağıtım noktası (RFC 5280 §4.2.1.13, 2.5.29.31): ayrı CRL alan adı, iki şema.
 *
 * - Adres: `crl.<ağ>/<makam>.crl` (`trust.tamga.network` → `crl.tamga.network`; sandbox `crl.sandbox.tamga.network`).
 * - Uzantı: TEK dağıtım noktası, `fullName` içinde iki ad bu sırayla — `http://…` (ETSI EN 319 412-2 GEN-4.3.11-4), sonra aynı
 *   yolun `https://…` adresi (şifresiz trafiği kapatan cüzdanlar için). Kritik değil; `cRLIssuer` ve `reasons` yok.
 */
import { CRLDistributionPointsExtension } from "@peculiar/x509";

/** `--crl-uri` / ayar biçimi: `http://crl.<alan>/<makam>.crl` (alan adının kökünde). */
export const CRL_URI_RE = /^http:\/\/crl\.[a-z0-9.-]+\/([a-z0-9][a-z0-9-]*)\.crl$/;

/** PKI klasörünün ağı (`pki.json` `profile`) → CRL alan adı; geliştirme PKI'sı ya da bilinmeyen profil için kısıt yok (undefined). */
export function crlHostForProfile(profile: unknown): string | undefined {
  if (profile === "production") return "crl.tamga.network";
  if (profile === "sandbox") return "crl.sandbox.tamga.network";
  return undefined;
}

/**
 * `pki-issue --crl-uri` denetimi (ADR-0090): biçim `http://crl.<ağ>/<makam>.crl`, yol veren makamın adı ve — PKI klasörünün ağı
 * biliniyorsa (`pki.json` `profile`) — alan adı o ağın CRL alan adı (gerçek ağın sertifikası sandbox CRL'ine ya da tersine
 * gösteremez). Sorun yoksa null.
 */
export function crlUriProblem(crlUri: string, caName: string, profile?: unknown): string | null {
  const m = CRL_URI_RE.exec(crlUri);
  if (!m) return "--crl-uri: http://crl.<ağ>/<makam>.crl biçiminde olmalı (ADR-0090; https eşi otomatik eklenir)";
  if (m[1] !== caName) return `--crl-uri: verenin (${caName}) CRL'i olmalı (/${caName}.crl)`;
  const host = crlHostForProfile(profile);
  if (host && new URL(crlUri).host !== host)
    return `--crl-uri: bu PKI (${String(profile)}) için CRL alan adı ${host} olmalı (http://${host}/${caName}.crl)`;
  return null;
}

/** Güven listesi kökünden CRL alan adı (`trust.` öneki `crl.` olur; yoksa başa `crl.` eklenir). */
export function crlHostOf(trustBase: string): string {
  const h = new URL(trustBase).hostname;
  return "crl." + (h.startsWith("trust.") ? h.slice("trust.".length) : h);
}

/** Makamın CRL'inin `http` adresi (dağıtım noktasının birinci adı). */
export const crlHttpUri = (trustBase: string, ca: string) => `http://${crlHostOf(trustBase)}/${ca}.crl`;

/** `http` adresinden iki ad: önce `http`, sonra aynı yolun `https` adresi. */
export function crlUrisOf(httpUri: string): [string, string] {
  const u = new URL(httpUri);
  return [`http://${u.host}${u.pathname}`, `https://${u.host}${u.pathname}`];
}

/** Tek dağıtım noktalı, iki adlı (http + https) CRL Distribution Points uzantısı. */
export function cdpExtension(httpUri: string): CRLDistributionPointsExtension {
  const names = crlUrisOf(httpUri);
  // Kitaplık dizi verilince her ad için ayrı dağıtım noktası kurar; adları birinci noktanın fullName'inde birleştir.
  const tmp = new CRLDistributionPointsExtension(names);
  const [first, ...rest] = tmp.distributionPoints;
  const full = first.distributionPoint?.fullName;
  if (!full) throw new Error("CRL dağıtım noktası kurulamadı");
  for (const dp of rest) full.push(...(dp.distributionPoint?.fullName ?? []));
  return new CRLDistributionPointsExtension([first]);
}
