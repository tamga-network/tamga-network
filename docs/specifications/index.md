---
title: Şartnameler
---

# Şartnameler

Şartnameler Tamga Network'ün kesin kurallarıdır: bir [[t:credential|belgenin]] nasıl yazıldığı, nasıl verilip gösterildiği,
[[t:trust-list|güven listelerinin]] biçimi. Kod bunlara uyar; uyum testleri (`conformance/`) bunları sınar.

Yeni başlıyorsanız önce [Kavramlar](/concepts/) sayfalarını ve [Başlarken](/guides/) rehberlerini okuyun; şartnameye
bir kuralın tam metni gerektiğinde gelin. Her şartname kısa bir "Kısaca" bölümüyle başlar, kurallar ve ayrıntı ondan sonra gelir.

## Belgeler

| Şartname | Ne anlatır |
|---|---|
| [[SPEC-CRED-0001]] | Belge biçimi ve protokollerin genel çerçevesi |
| [[SPEC-CRED-0002]] | SD-JWT VC belgesinin bayt düzeyinde yazımı |
| [[SPEC-CRED-0003]] | İptal ve iptal listesi |

## Protokoller

| Şartname | Ne anlatır |
|---|---|
| [[SPEC-PROTO-0001]] | Belge verenin cüzdana belge vermesi (OpenID4VCI) |
| [[SPEC-PROTO-0002]] | Cüzdanın doğrulayıcıya belge göstermesi (OpenID4VP) |
| [[SPEC-API-0001]] | Doğrulama hattı ve servis API'si |

## Güven ve kimlik

| Şartname | Ne anlatır |
|---|---|
| [[SPEC-TRUST-0001]] | Güven listelerinin biçimi ve yayını |
| [[SPEC-ID-0002]] | Kurum kimliği: X.509 sertifikaları |
| [[SPEC-ID-0003]] | Belge vermeden önce kimlik doğrulama |

## Şemalar

| Şartname | Ne anlatır |
|---|---|
| [[SPEC-SCHEMA-0001]] | Şema kataloğu (`schemas.tamga.network`) |
| [[SPEC-SCHEMA-0002]] | Education şemaları: öğrenci belgesi ve diploma |
| [[SPEC-SCHEMA-0003]] | Diğer sektörler için iskelet ve açılma koşulları |

## Cüzdan

| Şartname | Ne anlatır |
|---|---|
| [[SPEC-WALLET-0001]] | Uyumlu bir cüzdanın iç kuralları |

---

Kimlikler (`SPEC-…`) kalıcıdır; dosya adı ya da başlık değişse de atıflar bozulmaz. Bütün bağlayıcı kuralların tek listesi:
[Bağlayıcı kurallar](/rules).

Zincir aşamasına ait şartnameler (güven katmanı kontratları, ajan yetkilendirme) bugün kullanılmaz; depoda `docs/ledger/`
klasöründe durur.
