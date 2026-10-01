---
document_id: GUIDE-0000
title: Başlarken — Tamga Geliştirici Belgeleri
category: Guide
domain: Integration
status: Draft
review_status: Draft
version: 0.2.2
created: 2026-09-27
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
tags: [guide, getting-started, integration]
keywords: [başlarken, entegrasyon, "@tamga-network", yerel kurulum, ortamlar]
summary: >
  Geliştiriciler için giriş: Tamga'da dört yol (doğrulayıcı, belge veren kurum, cüzdan geliştiricisi, ağ/düğüm operatörü),
  hangi paketi kuracağınız, hangi adresleri kullanacağınız, yerel geliştirme ortamının kurulumu ve bugün neyin hazır olduğu.
priority: High
language: tr
audience: [integrators, engineers]
related: ["[[GUIDE-0001]]", "[[GUIDE-0002]]", "[[GUIDE-0003]]", "[[GUIDE-0004]]", "[[GUIDE-0005]]", "[[GUIDE-0006]]"]
---
> **Sürüm notu 0.2.2 (2026-10-01):** durum tablosu güncel (npm ön sürüm, takma ad, sıfır bilgi ispatı).
>
> **Sürüm notu 0.2.1 (2026-09-30) — ürün adı:** TamgaID → Tamga Wallet / “Tamga ile giriş yap” (proje yönetimi kararı; anlam değişmedi).

# Başlarken

Tamga, kurumların kişilere verdiği belgeleri (diploma, öğrenci belgesi, kimlik, bilet) kişinin telefonundaki cüzdana koyar;
üçüncü taraflar bu belgeleri kaynağa sormadan, saniyeler içinde doğrular. Standartlar AB'nin dijital kimlik cüzdanıyla
aynıdır: SD-JWT VC ve ISO mdoc belgeleri, OpenID4VCI (ihraç), OpenID4VP (sunum), X.509 ve imzalı güven listeleri.

Bu site **geliştiriciler** içindir. Roller, kurallar ve katılım şartları [Tamga ARF](https://arf.tamga.network/tr/)'dedir;
genel anlatım [tamga.network/docs](https://tamga.network/tr/docs)'tadır.

## Hangi yol sizin?

| Ne yapmak istiyorsunuz? | Rehber | Paket |
|---|---|---|
| Web sitenize "Tamga ile giriş" eklemek | [[GUIDE-0001]] | `@tamga-network/verifier` (+ `/web`) |
| Sunucunuzda belge doğrulamak (işe alım, kampüs, yaş, bilet kapısı) | [[GUIDE-0002]] | `@tamga-network/verifier`, `@tamga-network/trust` |
| Kurumunuzun belgelerini kişilerin cüzdanına vermek | [[GUIDE-0003]] | `@tamga-network/issuer` (+ `/client`) |
| Tamga uyumlu bir cüzdan geliştirmek | [[GUIDE-0005]] | `@tamga-network/wallet-core` |
| Güven listelerini okumak, ağ düğümü çalıştırmak (zincir aşaması) | [[GUIDE-0006]] | `@tamga-network/trust`, `contracts/`, `network/` |
| Hepsinin çalışan, testli kodu | [[GUIDE-0004]] | — |

## Paket haritası

| Paket | Ne işe yarar | Kim kullanır |
|---|---|---|
| `@tamga-network/core` | özetler, kimlik türetme (`issuer_id`, `schema_id`), sertifika yardımcıları | herkes (dolaylı) |
| `@tamga-network/trust` (+ `/core`) | imzalı güven listelerini yükler ve doğrular; tek okuma arayüzü `TrustSource` | doğrulayıcı, cüzdan, ihraççı |
| `@tamga-network/schemas` | belge türü kataloğu: tip tanımı, JSON Schema, içerik özetleri | ihraççı, doğrulayıcı |
| `@tamga-network/sd-jwt` | SD-JWT VC: seçici açıklama, cihaz bağı, biçim denetimleri | ihraççı, doğrulayıcı |
| `@tamga-network/mdoc` | ISO 18013-5 mdoc: CBOR, COSE, verme ve doğrulama | kimlik ihraççısı, doğrulayıcı |
| `@tamga-network/issuer` (+ `/client`) | belge fabrikası, OpenID4VCI, iptal listesi yayıncısı; `/client` barındırılan servis için | belge veren kurum |
| `@tamga-network/verifier` (+ `/web`) | doğrulama hattı (T0 + A–E), üç sonuç, OpenID4VP; `/web` sayfa kiti | doğrulayıcı, web sitesi |
| `@tamga-network/wallet-core` | cüzdan çekirdeği: anahtarlar, alma, yerel denetim, sunma (Node + React Native) | cüzdan geliştiricisi |

Her paketin kendi sayfası: **Paketler** bölümü. Paketler npm'de **ön sürüm (`0.1.0`)** olarak yayında; `1.0`'a kadar
arayüz değişebilir. Her sürüm bu depodan GitHub Actions ile üretilir ve kaynak kanıtı (provenance) taşır.

## Adresler

| Adres | Ne | Kim kullanır |
|---|---|---|
| `https://trust.tamga.network` | imzalı güven listeleri (`lotl.jws`, `tl-tr.jws`), çapa günlüğü, `keys/` | herkes — `TrustSource` üzerinden |
| `https://tamga.network/trust-anchor` | kök parmak izleri (yapılandırmanıza sabitlersiniz) | herkes |
| `https://schemas.tamga.network/v1/catalogue.json` | belge türü kataloğu | ihraççı, doğrulayıcı, cüzdan |
| `https://issuer.tamga.network/{kurum}` | barındırılan ihraç servisi (OpenID4VCI + `/api/v1`) | belge veren kurum, cüzdan |
| `https://status.tamga.network/{opak}` | iptal listeleri (Token Status List) | doğrulayıcı |
| `https://verify.tamga.network` | barındırılan doğrulayıcı + sayfa kiti (`/tamga-verifier.js`) | web sitesi, doğrulayıcı |
| `https://wallet.tamga.network` | cüzdan sağlayıcısı: cüzdan birimi onayı (WUA) | cüzdan |
| `https://id.tamga.network` | geçici kimlik belgesi servisi | cüzdan |

## Yerel geliştirme ortamı

Gereken: Node.js 22, Git. Depoyu alın ve geliştirme ortamını kurun:

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run d1            # geliştirme PKI'si → şema kataloğu → güven listeleri → doğrulama → testler
npx vitest run examples   # dört örnek, gerçek paketlerle
```

`npm run d1` yerel bir kök sertifika, örnek kurum sertifikaları ve imzalı güven listeleri üretir (`ops/pki/`, gizli anahtarlar
depoya girmez). Kodunuzu bu yerel listelere karşı deneyebilirsiniz. Uyum vektörleri: `npm run d2` (`conformance/`).

## Bugünkü durum

| Parça | Durum |
|---|---|
| Paketler | npm'de ön sürüm (`0.1.x`); `1.0`'a kadar arayüz değişebilir |
| Barındırılan doğrulayıcı | çalışıyor: sunumu site sunucusu imzalı beyanla açar, değerler yalnızca ona ve bir kez ([[ADR-0017]]); politikalar bugün sabit |
| Barındırılan ihraç servisi | çalışıyor: kurum başına kapsamlı API anahtarı ([[ADR-0016]]) |
| Güven çapası | imzalı listeler (Faz B, [[ADR-0009]]); kurum ve doğrulayıcı kaydını Tamga operatörü yapar |
| Gizlilik | site başına takma ad ([[ADR-0031]]); sıfır bilgi ispatıyla yaş — doğrulayıcı tarafı hazır ([[ADR-0032]]) |
| Zincir (Besu/QBFT) | tasarlandı, kontratlar yazıldı; ≥ 2 bağımsız doğrulayıcı operatörüyle açılır ([[GUIDE-0006]]) |

## Her entegrasyonda ortak kurallar

- Kişisel veriyi loglamayın; claim **değeri** ve iptal indeksi log ve denetim kaydına girmez ([[SPEC-API-0001]] AP3–AP4).
- Yalnızca gereken alanı isteyin; istek güven listesindeki kaydınızın kapsamını aşamaz (AP6).
- Sonuç üç değerlidir: `ACCEPTED`, `REJECTED`, `INDETERMINATE`. "Şu an doğrulanamadı" belgenin kötü olduğu anlamına gelmez (AP2).
- Güven verisini yalnızca `TrustSource` üzerinden okuyun; liste dosyalarını kendiniz yorumlamayın (BT4).
- Bağlayıcı kuralların tamamı rolünüze göre: [Tamga ARF — Ek B, Katılımcı Kuralları](https://arf.tamga.network/tr/annex-b-participant-rules).
