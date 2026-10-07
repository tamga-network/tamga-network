---
document_id: GUIDE-0000
title: "Başlarken"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  Geliştiriciler için giriş: Tamga'da dört yol (doğrulayıcı, belge veren, cüzdan geliştiricisi, ağ/düğüm operatörü),
  hangi paketi kuracağınız, hangi adresleri kullanacağınız, yerel geliştirme ortamının kurulumu ve bugün neyin hazır olduğu.
---

# Başlarken

Bu sayfa, Tamga ile bir şey geliştirmek isteyen herkes için ilk duraktır: hangi yolun size uygun olduğunu, hangi paketi
kuracağınızı ve yerelde nasıl deneyeceğinizi anlatır.

**Ne zaman okunur:** ilk gün, kod yazmadan önce. Buradan kendi rolünüzün rehberine geçersiniz. Kavramlara önce göz atmak
isterseniz [Kavramlar](/concepts/) bölümü kısa ve sadedir.

## Tamga ne yapar?

Kurumlar kişilere belge verir: diploma, öğrenci belgesi, kimlik, bilet. Tamga bu belgeleri kişinin telefonundaki cüzdana koyar.
Belgeyi görmek isteyen biri (bir işveren, bir web sitesi, bir etkinlik kapısı) onu kuruma sormadan, saniyeler içinde doğrular.
Kişi her seferinde yalnızca istenen alanları paylaşır.

Kullanılan standartlar AB'nin dijital kimlik cüzdanıyla aynıdır: [[t:SD-JWT-VC]] ve ISO [[t:mdoc]] [[t:credential|belgeleri]],
belge verme için [[t:OpenID4VCI]], belge gösterme için [[t:OpenID4VP]], kurum kimliği için X.509 ve imzalı
[[t:trust-list|güven listeleri]].

Bu site **geliştiriciler** içindir. Roller, kurallar ve katılım şartları [Tamga ARF](https://arf.tamga.network/tr/)'de;
genel anlatım [tamga.network](https://tamga.network/tr/learn)'tedir.

## Hangi yol sizin?

| Ne yapmak istiyorsunuz? | Rehber | Paket |
|---|---|---|
| Web sitenize "Tamga ile giriş yap" eklemek | [[GUIDE-0001]] | `@tamga-network/verifier` (+ `/web`) |
| Sunucunuzda belge doğrulamak (işe alım, kampüs, yaş, bilet kapısı) | [[GUIDE-0002]] | `@tamga-network/verifier`, `@tamga-network/trust` |
| Kurumunuzu belge veren olarak ağa kaydettirmek | [[GUIDE-0007]] | — |
| Sitenizi doğrulayıcı olarak kaydettirmek | [[GUIDE-0008]] | — |
| Kurumunuzun belgelerini kişilerin cüzdanına vermek | [[GUIDE-0003]] | `@tamga-network/issuer` (+ `/client`) |
| Tamga uyumlu bir cüzdan geliştirmek | [[GUIDE-0005]], kontrol listesi [[GUIDE-0010]] | `@tamga-network/wallet-core` |
| Güven listelerini okumak, ileride ağ düğümü çalıştırmak | [[GUIDE-0006]] | `@tamga-network/trust`, `contracts/`, `network/` |
| Ülkenizin güven listesini ağa bağlamak | [[GUIDE-0011]] | `apps/trust-publisher` |
| Uygulamanızın kurallara uyduğunu göstermek | [[GUIDE-0009]] | `conformance/` |
| Gerçek ağa dokunmadan uçtan uca denemek (test ağı) | [[GUIDE-0013]] | `sandbox.tamga.network` |
| Hepsinin çalışan, testli kodunu görmek | [[GUIDE-0004]] | — |
| Bir şey ters gittiğinde | [[GUIDE-0012]] | — |

## Yerelde denemek

Gereken: Node.js 22 ve Git. Depoyu alın ve geliştirme ortamını kurun:

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run setup            # geliştirme PKI'si → şema kataloğu → güven listeleri → doğrulama
npm run check            # testler + tip denetimi
npx vitest run examples   # dört örnek, gerçek paketlerle
```

`npm run setup` yerel bir kök sertifika, örnek kurum sertifikaları ve imzalı güven listeleri üretir (`ops/pki/`; gizli anahtarlar
depoya girmez). Kodunuzu bu yerel listelere karşı deneyebilirsiniz. Uyum vektörleri için: `npm run conformance` (`conformance/`).

## Paketler

| Paket | Ne işe yarar | Kim kullanır |
|---|---|---|
| `@tamga-network/core` | özetler, kimlik türetme (`issuer_id`, `schema_id`), sertifika yardımcıları | herkes (dolaylı) |
| `@tamga-network/trust` (+ `/core`) | imzalı güven listelerini yükler ve doğrular; tek okuma arayüzü `TrustSource` | doğrulayıcı, cüzdan, belge veren |
| `@tamga-network/schemas` | belge türü kataloğu: tür tanımı, JSON Schema, içerik özetleri | belge veren, doğrulayıcı |
| `@tamga-network/sd-jwt` | SD-JWT VC: selective disclosure, holder binding, iptal listesi | belge veren, doğrulayıcı |
| `@tamga-network/mdoc` | ISO 18013-5 mdoc: CBOR, COSE, verme ve doğrulama | kimlik belgesini veren, doğrulayıcı |
| `@tamga-network/issuer` (+ `/client`) | belge üretimi, OpenID4VCI; `/client` barındırılan servis için | belge veren |
| `@tamga-network/verifier` (+ `/web`, `/zk`) | doğrulama hattı, üç değerli sonuç, OpenID4VP; `/web` sayfa kiti, `/zk` sıfır bilgi ispatı | doğrulayıcı, web sitesi |
| `@tamga-network/wallet-core` | cüzdan çekirdeği: anahtarlar, belge alma, yerel denetim, gösterme (Node + React Native) | cüzdan geliştiricisi |
| `@tamga-network/zk` (+ `/node`, `/react-native`) | cüzdan tarafı sıfır bilgi ispatçısı (mdoc, Longfellow); `/react-native` telefonda yerel ispatçı, `/node` masaüstünde | cüzdan geliştiricisi |

Her paketin kendi sayfası **SDK'lar** bölümündedir. Paketler sürüm **1.0.0**; canlıya çıkış duyurusuyla npm'de
yayımlanır. Her sürüm bu depodan GitHub Actions ile üretilir ve kaynak kanıtı (provenance) taşır.

## Adresler

| Adres | Ne | Kim kullanır |
|---|---|---|
| `https://trust.tamga.network` | imzalı güven listeleri (`lotl.jws`, `tl-tr.jws`), çapa günlüğü, `keys/` | herkes — `TrustSource` üzerinden |
| `https://tamga.network/trust-anchor` | kök parmak izleri (yapılandırmanıza sabitlersiniz) | herkes |
| `https://schemas.tamga.network/v1/catalogue.json` | belge türü kataloğu | belge veren, doğrulayıcı, cüzdan |
| `https://issuer.tamga.network/{kurum}` | barındırılan belge verme servisi (OpenID4VCI + `/api/v1`) | belge veren, cüzdan |
| `https://status.tamga.network/{opak}` | iptal listeleri (Token Status List) | doğrulayıcı |
| `https://verify.tamga.network` | Tamga Verify: barındırılan doğrulayıcı + sayfa kiti (`/tamga-verifier.js`) | web sitesi, doğrulayıcı |
| `https://id.tamga.network` | geçici kimlik belgesi servisi | cüzdan |

## Bugün ne hazır?

| Parça | Durum |
|---|---|
| Paketler | sürüm 1.0.0; canlıya çıkış duyurusuyla npm'de yayımlanır |
| Barındırılan doğrulayıcı | çalışıyor: sunumu sitenin sunucusu imzalı beyanla açar, değerler yalnızca ona ve bir kez verilir ([[ADR-0017]]); politikalar bugün sabit |
| Barındırılan belge verme | çalışıyor: kurum başına kapsamlı API anahtarı ([[ADR-0016]]) |
| Güven çapası | imzalı güven listeleri ([[ADR-0009]]); belge veren ve doğrulayıcı kaydını Tamga operatörü yapar |
| Gizlilik | site başına takma ad ([[ADR-0031]]); sıfır bilgi ispatıyla (ZK) yaş doğrulama — doğrulayıcı tarafı yayında; cüzdan tarafı `@tamga-network/zk` ile bağlandı, Android yerel kütüphanesi hazır, iOS bekliyor ([[ADR-0032]]) |
| Sandbox | yayında: gerçek ağla aynı kurallarla tek test ağı, herkese açık; gerçek kimlik doğrulaması günlük/aylık tavanlı ([[GUIDE-0013]]) |
| Zincir (Besu/QBFT) | tasarlandı, kontratlar yazıldı; en az iki bağımsız validator operatörüyle açılır ([[GUIDE-0006]]) |

## Her entegrasyonda ortak kurallar

- **Kişisel veriyi loglamayın.** Belge alanlarının değeri ve iptal indeksi log ve denetim kaydına girmez ([[SPEC-API-0001]] AP3–AP4).
- **Yalnızca gereken alanı isteyin.** İsteğiniz güven listesindeki kaydınızın kapsamını aşamaz (AP6).
- **Sonuç üç değerlidir:** `ACCEPTED`, `REJECTED`, `INDETERMINATE`. "Şu an doğrulanamadı" belgenin kötü olduğu anlamına gelmez (AP2).
- **Güven verisini yalnızca `TrustSource` üzerinden okuyun;** liste dosyalarını kendiniz yorumlamayın.
- Rolünüze göre bağlayıcı kuralların tamamı: [Tamga ARF — Ek B, Tamga Rulebook](https://arf.tamga.network/tr/rulebook).
