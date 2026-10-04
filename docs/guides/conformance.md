---
document_id: GUIDE-0009
title: "Uyum testleri"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Bir uygulamanın Tamga kurallarına uyduğunu göstermek: açık uyum test vektörleri (güven listesi soruları, SD-JWT doğrulaması,
  olumlu ve olumsuz durumlar), koşucuyu çalıştırmak, başka bir dilde yazılmış kütüphaneyi vektörlerle sınamak ve katılımda
  istenen kanıt.
---

# Uyum testleri

Bu rehber, Tamga'ya bağlanan bir yazılımı (doğrulayıcı, cüzdan, belge verme servisi ya da başka bir dilde yazılmış kütüphane)
geliştirenler içindir.

**Ne zaman okunur:**
- Kendi kodunuzun Tamga kurallarına göre doğru cevap verdiğini göstermek istediğinizde.
- Katılım başvurusundan önce: liste ve defter aşamalarında **hafif uygunluk** uygulanır; açık uyum vektörlerini geçmek
  katılımın teknik şartıdır ([Tamga ARF — Trust Framework §2.4](https://arf.tamga.network/tr/trust-framework)).

## Nasıl çalışır?

[[t:conformance|Uyum]] testi iki parçadır:

| Parça | Ne | Nerede |
|---|---|---|
| **Test vektörleri** | Dondurulmuş girdi + beklenen çıktı (JSON) | `conformance/vectors/` |
| **Koşucu** | Vektörleri okuyup `@tamga-network/*` ile çalıştıran ve beklentiyle karşılaştıran test takımı | `conformance/runner/` |

Vektörler aynı zamanda iki uygulamanın aynı cevabı verdiğinin kanıtıdır: bugünkü imzalı liste ile ileride açılacak
ortak defter ([[t:ledger]]) aynı sorulara aynı cevabı vermek zorundadır; vektörler o soruların dondurulmuş hâlidir
([[ADR-0009]] K7).

## 1. Vektörler

```
conformance/vectors/
├── VERSION              vektör seti sürümü (değişiklik = sürüm artışı)
├── trust/basic.json     imzalı liste seti (LOTL, ülke listesi, çapa günlüğü, kökler) + sorgu → beklenen cevap
└── sd-jwt/diploma-basic.json   verilmiş bir diploma, sunumu, kök sertifika + doğrulama beklentileri
```

**`trust/basic.json`** güven sorularını sınar. Her vaka bir sorgu ve beklenen üç değerli cevaptır:

```json
{
  "name": "issuer ACTIVE, iat geçerlilik içinde",
  "q": { "op": "isCredentialAcceptable", "issuer_id": "0x8d10…3b64", "iat": 1790812800 },
  "expect": "YES"
}
```

Sınanan sorgular: `isCredentialAcceptable`, `isCredentialSchemaAcceptable`, `isRecognizedBy`, `schemaContentHash`,
`isWalletProviderKey`. Liste setinin yüklenme raporu da (`healthy`, liste sürümü) beklentiyle karşılaştırılır.

**`sd-jwt/diploma-basic.json`** bir sunumun doğrulanmasını sınar: hangi alanların açıldığı, hangilerinin gizli kaldığı,
`issuer_id` ve geçilen adımlar ([[SPEC-API-0001]] A1–A6). Olumsuz durumlar da vardır ve her biri **reddedilmelidir**:

| Olumsuz durum | Beklenen |
|---|---|
| KB-JWT yok | Red — belge sahibine bağlılık kanıtı zorunlu |
| Yanlış `nonce` | Red — yeniden oynatma |
| `iat` penceresi dışında (+301 s) | Red — zaman penceresi |
| Sunulmayan bir disclosure eklenmiş | Red — eşleşmeyen digest |

Her vektör sabit bir `now` alanı taşır; zamana bağlı adımlar her makinede aynı sonucu verir.

## 2. Koşucuyu çalıştırmak

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run conformance        # vektörleri üretir ve bütün testleri koşar
```

Yalnız koşmak için `npm test` yeterlidir (koşucu otomatik dahildir). Vektörleri yeniden üretmek `npm run conformance:gen`
ile olur; deterministik alanlar sabit `now` ile üretildiği için çıktı yalnız imzalarda değişir.

## 3. Kendi kütüphanenizi sınamak

TypeScript kodu kanoniktir; başka dillerdeki uygulamalar (Java, Python, Go…) aynı vektörlerle doğrulanır ([[ARCH-0005]] P9).

1. `vectors/` klasörünü olduğu gibi alın; `VERSION` değerini kaydedin.
2. `trust/basic.json`: `input` alanındaki listeleri kendi kodunuzla yükleyin, kökleri `input.root_fingerprints` ile sabitleyin,
   `now` anında her `cases[].q` sorgusunu çalıştırın, sonucu `expect` ile karşılaştırın.
3. `sd-jwt/diploma-basic.json`: `presentation` değerini `aud`, `nonce` ve `root_cert_pem` ile doğrulayın; sonuç `expect`
   ile aynı olmalı. `negative[]` vakalarının her biri reddedilmelidir.
4. Bir vakada `UNKNOWN` beklenirken siz `NO` dönüyorsanız uyumsuzsunuz: "doğrulanamadı" ile "geçersiz" aynı şey değildir
   ([[SPEC-API-0001]] AP2).

## 4. Katılımda istenen kanıt

Uyumu kendi yazılımınızla gösterirsiniz; sonuç raporu kayıt başvurusuna eklenir ve kayıt kurumu gerektiğinde testleri yeniden
çalıştırır ([Tamga ARF — Trust Framework §4.3](https://arf.tamga.network/tr/trust-framework)).

| Rol | Ne test edilir | Nasıl gösterilir |
|---|---|---|
| Belge veren | Tür tanımına uygun belge, imza ve sertifika zinciri, iptal listesi yayını, cüzdan kanıtlarının denetimi | Vektörlerle deneme belgesi + sonuç raporu |
| Doğrulayıcı | İmzalı istek, doğrulama adımları, bayat listede "doğrulanamadı", kapsam dışı alan istememe | Vektörler + taahhüt testleri + sonuç raporu |
| Cüzdan sağlayıcısı | Cüzdan kuralları (anahtar koruma, onay ekranı, geçmiş, silme), cüzdan ve anahtar kanıtı, gösterme protokolü | Vektörler + taahhüt testleri + cihaz üzerinde gösterim |

**Taahhüt testleri** en az şunları içerir: bayat liste "doğrulanamadı" sonucunu verir; bilinmeyen biçim sürümünde işlem durur;
imza hatasında işlem durur. Raporda yazılımınızın sürümünü ve geçtiğiniz vektör setinin sürümünü (`VERSION`) belirtin.

Vektörler tek tek kuralları sınar; bütün akışı (belge alma, gösterme, iptal ve askı) gerçek bir telefonla test ağında deneyin
([[GUIDE-0013]]).

## Kurallar

| Kod | Ne der |
|---|---|
| Vektörlerde kişisel veri yok | Adlar sahtedir; özel anahtar yoktur (yalnız sertifika ve belge sahibinin açık anahtarı) |
| Sürüm | Vektör değişikliği = `VERSION` artışı |
| [[ADR-0009]] K7 | Liste ve defter uygulamaları aynı vektörleri geçmeden geçiş tamamlanmış sayılmaz |
| [[SPEC-API-0001]] AP2 | `INDETERMINATE`, `REJECTED` ile aynı kovaya konmaz |
