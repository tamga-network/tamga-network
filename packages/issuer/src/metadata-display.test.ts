import { describe, expect, it } from "vitest";
import { credentialDisplay, issuerMetadata } from "./oid4vci.js";

// OpenID4VCI 1.0 §12.2.4 (OpenID uyum öz-testi CheckForUnexpectedParametersInCredentialIssuerMetadata): görünüm yalnız
// credential_metadata altında, `locale` ile
describe("issuer metadata görünümü", () => {
  const display = [
    { lang: "tr-TR", name: "Öğrenci", description: "d", rendering: { simple: { background_color: "#123456" } } },
    { lang: "en-US", name: "Student" },
  ];
  it("lang → locale; rendering.simple renkleri; tanımsız alan yok", () => {
    expect(credentialDisplay(display)).toEqual([
      { name: "Öğrenci", locale: "tr-TR", description: "d", background_color: "#123456" },
      { name: "Student", locale: "en-US" },
    ]);
    expect(credentialDisplay(undefined)).toBeUndefined();
  });
  it("yapılandırmada üst düzey display yok; credential_metadata.display locale'li", () => {
    const md = issuerMetadata({
      credentialIssuer: "https://issuer.example/x",
      authorizedVcts: [{ vct: "urn:tamga:edu:StudentCredential:1", name: "Öğrenci", display }],
      mdocConfigurations: [{ id: "urn:x:mdoc", doctype: "urn:x:mdoc", display }],
    }) as unknown as {
      credential_configurations_supported: Record<
        string,
        Record<string, unknown> & { credential_metadata: { display: unknown[] } }
      >;
    };
    for (const c of Object.values(md.credential_configurations_supported)) {
      expect(c.display).toBeUndefined();
      expect(JSON.stringify(c.credential_metadata.display)).not.toContain('"lang"');
      expect(JSON.stringify(c.credential_metadata.display)).toContain('"locale":"tr-TR"');
    }
  });
});
