/**
 * OpenID4VP 1.0 §6.1.1.1 / HAIP §5 — DCQL `trusted_authorities` tip `aki`. Değer, belgenin zincirindeki bir sertifikanın
 * AuthorityKeyIdentifier'ıdır (base64url). Doğrulayıcı güvendiği CA'ların SKI'sini verir: CA'nın imzaladığı issuer
 * sertifikasının AKI'si bu SKI'ye eşittir (RFC 5280 §4.2.1.1). Veri azaltma içindir; güven denetimi yine A–E hattındadır.
 */
import { SubjectKeyIdentifierExtension, X509Certificate } from "@peculiar/x509";

/** CA sertifikalarının SKI'lerinden tek bir `aki` sorgusu; SKI'si olmayan sertifika atlanır, değer yoksa null. */
export function akiTrustedAuthority(caCertDers: Uint8Array[]): { type: "aki"; values: string[] } | null {
  const values = new Set<string>();
  for (const der of caCertDers) {
    const ski = new X509Certificate(new Uint8Array(der)).getExtension(SubjectKeyIdentifierExtension);
    if (ski?.keyId) values.add(Buffer.from(ski.keyId, "hex").toString("base64url"));
  }
  return values.size ? { type: "aki", values: [...values] } : null;
}
