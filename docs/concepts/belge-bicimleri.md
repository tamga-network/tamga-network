---
title: Belge biçimleri
---

# Belge biçimleri

Tamga belgeleri iki standart biçimde verilir. İkisi de AB'nin dijital kimlik cüzdanında kullanılan biçimlerdir.

| | SD-JWT VC | ISO mdoc (ISO/IEC 18013-5) |
|---|---|---|
| Nerede | İnternet üzerinden gösterim (site, işveren, kurum) | Yüz yüze gösterim (kapı, turnike, gişe) ve kimlik |
| Yapı | JSON; her alan ayrı ayrı gizlenebilir | CBOR; alanlar ad alanlarında, imzalı özetlerle |
| Kimlik | `vct` = `urn:tamga:<alan>:<Tür>:<sürüm>` | `docType` |
| Cihaz bağı | `cnf` anahtarı; her gösterimde cihaz imzası (KB-JWT) | cihaz anahtarı; oturuma bağlı cihaz imzası |

Kimlik belgesi her iki biçimde de verilir (aynı cihaz anahtarına bağlı); diğer belgeler bugün SD-JWT VC'dir.

## Belge türleri ve katalog

Her belge türünün tanımı (görünen adlar, alanlar, hangi alanın gizlenebildiği) ve JSON şeması
`https://schemas.tamga.network/v1/catalogue.json` adresindeki katalogdadır. Belge, türünün tanımına `vct#integrity` özetiyle
bağlıdır; doğrulayıcı tanımın değişmediğini denetler.

| Tür | Kim verir |
|---|---|
| `urn:tamga:edu:StudentCredential:1` | üniversite |
| `urn:tamga:edu:DiplomaCredential:1` | üniversite |
| `urn:tamga:id:IdentityAttestation:1` | kimlik servisi (geçici; devletin kimlik belgesi gelene kadar) |
| `urn:tamga:tkt:EventTicket:1` | bilet satıcısı |
| `urn:tamga:contact:EmailAddress:1`, `PhoneNumber:1` | kimlik servisi |

## Ayrıntı

- Belge biçimi: [[SPEC-CRED-0001]], SD-JWT VC profili: [[SPEC-CRED-0002]]
- Şema kataloğu: [[SPEC-SCHEMA-0001]], eğitim: [[SPEC-SCHEMA-0002]], sektörler: [[SPEC-SCHEMA-0003]]
- Paketler: [`@tamga-network/sd-jwt`](/packages/sd-jwt), [`@tamga-network/mdoc`](/packages/mdoc), [`@tamga-network/schemas`](/packages/schemas)
