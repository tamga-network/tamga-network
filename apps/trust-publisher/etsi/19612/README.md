# ETSI TS 119 612 — güven listesi XML şemaları (kopya)

Yalnız testte, üretilen TS 119 612 XML listelerinin (ADR-0066 taslağı, `src/tl119612.ts`) resmî şemalara uyduğunu denetlemek
için kullanılır (`test/tl119612.test.ts`). Dosyalar değiştirilmez; `schemaLocation` adresleri test sırasında bellekte yerel dosya
adlarına çevrilir. Satır sonları depoda LF'ye çevrilir (`.gitattributes`).

| Dosya | Kaynak | Lisans |
|---|---|---|
| `19612_xsd.xsd`, `19612_additionaltypes_xsd.xsd`, `19612_sie_xsd.xsd` | ETSI TS 119 612 V2.4.1 (2025-08) Ek C, `ts_119612v020401p0.zip` (etsi.org/deliver); ETSI forge `esi/x19_612_trusted_lists` commit `812fe781` ile aynı | `LICENSE` (ETSI, BSD 3-madde) |
| `XAdES01903v132-201601.xsd` | ETSI, `https://uri.etsi.org/01903/v1.3.2/XAdES01903v132-201601.xsd` (TS 119 612 şemalarının içe aktardığı adres) | ETSI tarafından yayımlanan şema |
| `xmldsig-core-schema.xsd` | W3C, `http://www.w3.org/TR/2008/REC-xmldsig-core-20080610/xmldsig-core-schema.xsd` | W3C Software License (dosya başlığında) |
| `xml.xsd` | W3C, `http://www.w3.org/2001/xml.xsd` | W3C |
