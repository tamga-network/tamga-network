import { describe, expect, it } from "vitest";
import { credentialDisplay, issuerDisplayFrom, issuerMetadata } from "./oid4vci.js";

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

// OpenID uyum testi VCIValidateDisplayLocales (FAILURE): geçerli, kayıtlı BCP 47 etiketi ve dil başına tek görünüm nesnesi;
// VCIWarnOnNonCanonicalDisplayLocales (WARNING): kanonik yazım (`en-US`, `tr`)
describe("görünüm locale'leri (BCP 47, OpenID4VCI 1.0 §12.2.4)", () => {
  it("credential_metadata.display: kanonik yazım, geçersiz dil düşer, dil başına tek girdi", () => {
    expect(
      credentialDisplay([
        { lang: "tr-tr", name: "Öğrenci" },
        { lang: "EN-us", name: "Student" },
        { lang: "en-US", name: "Student (ikinci)" },
        { lang: "en_US", name: "bozuk biçim" },
        { lang: "xx", name: "kayıtsız dil" },
        { lang: "en-QQ", name: "bilinmeyen bölge" },
        { locale: "tk", name: "Talyp" },
        { name: "yerelsiz" },
        { name: "yerelsiz ikinci" },
      ]),
    ).toEqual([
      { name: "Öğrenci", locale: "tr-TR" },
      { name: "Student", locale: "en-US" },
      { name: "Talyp", locale: "tk" },
      { name: "yerelsiz" },
    ]);
  });
  it("belge veren görünümü: kayıttaki anahtar kanonikleşir; aynı dile çıkan iki anahtar tek girdi; geçersiz anahtar yazılmaz", () => {
    const d = issuerDisplayFrom({
      legalName: "Kurum",
      serviceDescription: { "en-us": "Service", "EN-US": "Service again", TR: "Hizmet", und: "x", tr_TR: "y" },
      names: { "en-US": "Institution" },
    });
    expect(d).toEqual([
      { name: "Kurum" },
      { name: "Institution", locale: "en-US", description: "Service" },
      { name: "Kurum", locale: "tr", description: "Hizmet" },
    ]);
  });
  it("issuerMetadata üst düzey display de dil başına tek girdi, kanonik", () => {
    const md = issuerMetadata({
      credentialIssuer: "https://issuer.example/x",
      authorizedVcts: [],
      issuerDisplay: [{ name: "A" }, { name: "B", locale: "en-gb" }, { name: "C", locale: "en-GB" }],
    }) as unknown as { display: unknown[] };
    expect(md.display).toEqual([{ name: "A" }, { name: "B", locale: "en-GB" }]);
  });
});
