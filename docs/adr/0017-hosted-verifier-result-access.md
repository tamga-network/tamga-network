---
document_id: ADR-0017
title: "Doğrulama sonucuna erişim"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  Barındırılan doğrulayıcının (`verify.tamga.network`) onaylanan alanları döndüren ucu (`GET /presentations/:id/claims`) bugün
  sunum kimliğini bilen herkese cevap verir (yetenek URL'si). Gerçek sitelere açılmadan önce: sunumu açan doğrulayıcı (RP),
  güven listesinde kayıtlı anahtarıyla imzalı kısa ömürlü bir beyanla kimliğini kanıtlar; alanlar yalnızca o RP'ye ve yalnızca
  bir kez verilir. Yeni sır ya da yeni altyapı gerekmez.
domain: Services
---

# Bağlam

İç inceleme Y8 (2026-09-27): `apps/verify/src/routes/presentations.ts`

- `POST /presentations` [[t:identity-proofing|kimlik doğrulaması]] istemez; herkes herhangi bir politikayla sunum açabilir.
- `GET /presentations/:id` sonucu (alan **adları**, AP3), `GET /presentations/:id/claims` ise onaylanan **değerleri** döndürür.
  İkisi de yalnızca sunum kimliğini (72 bit rastgele) bilmeyi ister. Kimlik ayrıca `/p/:id` sayfa adresinde görünür
  (tarayıcı geçmişi, ekran paylaşımı, günlükler).
- Değerler istenildiği kadar okunabilir; süre sınırı yalnızca bellekteki kaydın ömrüdür.

Demo için kabul edilebilir (sahte veri, tek site). Gerçek bir site `verify.tamga.network`'ü kullanmaya başladığında,
kimliği ele geçiren herhangi biri kişinin adını ya da [[t:credential]] alanlarını okuyabilir. Entegrasyon kılavuzu
([[GUIDE-0001]] §4, [[GUIDE-0002]]) bunu "planlı" olarak işaretler; bu ADR tasarımı önerir.

Kapsam: yalnızca **barındırılan** [[t:verifier]]. Kendi sunucusunda `@tamga-network/verifier` çalıştıran [[t:RP]]'yi etkilemez
(değerler zaten kendi sunucusunda çözülür).

# Karar

**K1 — RP kimliği, [[t:trust-list|güven listesindeki]] anahtarla kanıtlanır.** Sonuç ve değer uçlarına her çağrı bir `Authorization:
Bearer <rp-assertion>` taşır. `rp-assertion`: RP'nin güven listesinde kayıtlı erişim sertifikasına (`relying_parties[].
access_cert_fingerprint_sha256`) karşılık gelen özel anahtarla imzalı JWS; başlıkta `x5c`; yük
`{iss: client_id, aud: <verifier tabanı>, iat, exp ≤ iat+60, jti}`. Doğrulayıcı imzayı, sertifika parmak izini `TrustSource.relyingParty(client_id)`
kaydıyla, `aud`/`exp`'i ve `jti` tekrarını denetler. Yeni sır, yeni kayıt ya da yeni sunucu gerekmez: RP zaten imzalı
[[t:OpenID4VP]] istekleri için bu anahtarı kullanır ([[SPEC-PROTO-0002]]).

**K2 — Sunum, onu açan RP'ye bağlanır.** `POST /presentations` aynı beyanı ister; politika RP'nin kayıtlı kapsamını aşamaz
(AP6 — bugün politika tablosuyla, bundan sonra RP'ye göre). Sunum kaydı `client_id` taşır; sonuç ve değerler yalnızca aynı
`client_id`'ye verilir, başkasına `404` (varlığı sızdırmaz).

**K3 — Değerler bir kez ve kısa süre okunur.** `GET /presentations/:id/claims` ilk başarılı okumada değerleri bellekten siler
(sonraki çağrı `410 Gone`); okunmayan değerler sonuçtan en geç 5 dakika sonra silinir. Sonuç nesnesi (alan adları, adımlar)
denetim için daha uzun tutulabilir; değer içermez (AP3).

**K4 — Tarayıcı yoklaması değer görmez.** Sayfa kiti (`@tamga-network/verifier/web`) ve `/p/:id` yalnızca durum
(`PENDING | ACCEPTED | REJECTED | INDETERMINATE`) okur; bunun için sunuma özgü, yalnızca durum okuyabilen ayrı bir kısa ömürlü
jeton (`status_token`, oluşturma cevabında) kullanılır. Değerler yalnızca RP sunucusuna, K1 ile gider.

**K5 — Demo site kurala uyar.** `verify…/demo-site` kendi RP kaydıyla aynı yolu kullanır (süreç içinde); özel istisna yok.

**K7 — Cüzdan asıl RP'yi gösterir (ARF aracı modeli).** Barındırılan doğrulayıcı bir RP adına istek açtığında imzalı istek
nesnesi `tamga_on_behalf_of: <RP client_id>` taşır. Cüzdan bu RP'nin güven listesi kaydını çözer; onay ekranında **asıl RP'nin
kayıtlı adını** ve "[[t:intermediary]]: `<verifier>`" bilgisini gösterir; kapsam denetimi (AP6) asıl RP'nin kaydına göre yapılır. Kayıtta
olmayan ya da aracının kendi kaydıyla eşleşmeyen `tamga_on_behalf_of` isteği reddedilir.

**K6 — Geçiş.** Bir sürüm boyunca eski uçlar `Deprecation` başlığıyla çalışır; demo politikaları (`site-signup`, `site-signin`,
`age-over-18-mdoc`) ilk kayıtlı demo RP'sine bağlanır. Üretimde K1–K4 zorunludur.

# Gerekçe / alternatifler

| Seçenek | Neden seçilmedi |
|---|---|
| Site başına statik API anahtarı | Yeni sır dağıtımı ve saklama; güven listesi ile bağı yok; sızınca iptal akışı ayrı kurulmalı |
| OAuth 2.0 client credentials sunucusu | Ek altyapı ve durum; aynı güvenceyi K1 mevcut anahtarla veriyor |
| mTLS | Paylaşımlı barındırmada nginx/sertifika işletimi ağır; tarayıcı tarafı için anlamsız |
| Yalnızca kimliği uzatmak (ör. 128 bit) | Yetenek URL'sinin sızma yollarını (geçmiş, ekran, günlük) kapatmaz |
| Değerleri hiç tutmamak, yalnızca RP'ye push (webhook) | RP'nin açık uç ve imza doğrulaması kurmasını gerektirir; ileride seçenek olarak eklenebilir |

# Değişmezler

| Kod | Kural |
|---|---|
| HV1 | Barındırılan doğrulayıcı değer döndüren her ucu yalnızca K1 beyanını doğrulanmış RP'ye açar. |
| HV2 | Sunum oluşturan `client_id` dışındaki bir RP sonuç ya da değer alamaz; cevap varlığı sızdırmaz (`404`). |
| HV3 | Değerler en fazla bir kez okunur ve sonuçtan en geç 5 dakika sonra bellekten silinir. |
| HV4 | Tarayıcıya giden hiçbir jeton ya da adres değer okuma yetkisi taşımaz. |
| HV6 | Aracı doğrulayıcı üzerinden gelen istekte cüzdan asıl RP'nin kayıtlı adını gösterir ve kapsamı onun kaydına göre denetler. |
| HV5 | RP beyanı: `exp − iat ≤ 60 s`, `jti` tekrar reddi, imzacı sertifika parmak izi güven listesindeki RP kaydıyla eşleşir. |

# Etki
- `apps/verify` (rotalar + küçük bir `rpAuth` yardımcısı), `@tamga-network/verifier/web` (yalnızca `status_token` kullanımı),
  [[GUIDE-0001]] / [[GUIDE-0002]] (sunucu örneği beyan üretir), [[SPEC-API-0001]] §4 (sürüm notu).
- Kişisel veri akışı daralır; yeni kişisel veri tutulmaz.

# Durum

**Accepted — 2026-09-27.** DECISIONS: D-API-2. K7 (asıl RP'nin gösterilmesi) kabul önerisiyle eklendi.

Uygulama: `apps/verify` (rpAuth, sunum sahibi, tek okuma, status_token), `@tamga-network/verifier/web`, cüzdan onay ekranı (K7),
kılavuzlar GUIDE-0001/0002.

Uygulama notu (K7, 2026-10-07): aracı ilişkisi iki kayıtta da yazılı olmalıdır — asıl RP aracıyı `uses_intermediaries`'te,
aracı asıl RP'yi `served_relying_parties`'te listeler. Tek taraflı beyanda cüzdan isteği reddeder (`@tamga-network/wallet-core`;
[[SPEC-PROTO-0002]]/PV14).

**Uygulama notu.** K5 örüntüsü doğrulayıcının kendi akışlarına da uygulanır: sıkı kipte beyansız `POST /presentations`
(ana sayfadaki "QR üret"; cüzdanın başlattığı kontrol ve geçiş kartı akışları, [[ADR-0012]] B/C) sunumu doğrulayıcının **kendi**
RP kaydına bağlar. Böyle bir sunumun sonucu ve değerleri hiçbir dış çağırana verilmez (HV1/HV2 aynen geçerli); kişi değerleri
yalnızca kendi seçtiği kontrol bağlantısıyla gösterir. Başka bir RP adına sunum açmak K1 beyanı ister.
