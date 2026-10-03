---
document_id: ADR-0031
title: "Site başına takma ad"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-02
summary: >
  "Tamga ile giriş yap" siteye kimlik belgesinin özetini (document_number_hash) göndermez. Cüzdan her site için ayrı ama sabit bir
  takma ad anahtarı türetir; site kişiyi bu anahtarla tanır, iki site aynı kişiyi eşleştiremez. Takma ad tohumu kimlik
  servisinde kişinin değişmeyen kimliğinden deterministik türetilir; yeni telefonda kimlik yeniden doğrulanınca aynı takma adlar
  geri gelir ve bir kişi bir sitede tek hesap açar. S-17'yi kapatır; ARF Topic 11 (PA_01–PA_19) karşılanır.
domain: Identity
---

# Özet (sade)

1. Bu karardan önce "Tamga ile kayıt ol" her siteye **aynı** hesap değerini gönderiyordu; iki site anlaşırsa aynı kişi olduğunu
   anlardı.
2. Karar: cüzdan her siteye **ayrı** bir takma ad anahtarı verir. Site seni hep tanır; iki site seni eşleştiremez.
3. Takma adlar kimliğinden türetilir: yeni telefonda kimliğini doğrulayınca aynı takma adlar geri gelir, hesapların kaybolmaz.
4. Bir kişi bir sitede tek hesap açabilir (sahte çoklu hesap engeli); site isterse birden fazla takma ada izin verebilir.
5. Bedeli: Tamga'nın kimlik servisi teorik olarak bir kişinin takma adını hesaplayabilir; bunu anahtar koruması ve denetimle
   sınırlarız, ileride sıfır bilgi ispatıyla (Z5) kaldırırız.

# Bağlam

- **S-17:** örnek sitede (`verify…/demo-site`) kayıt ve kurtarmada kimlik belgesindeki `document_number_hash` siteye gidiyordu;
  site ham değeri saklamıyor, `HMAC(siteSırrı, hash)` tutuyordu; günlük giriş passkey ile oluyordu. Ama kayıtta **aynı değer her
  siteye** gidiyordu → siteler arası bağlanabilirlik. Kopya ayrımı (WL5) bunu kapatmaz; değer [[t:credential|belgenin]] içinde, her
  kopyada aynıdır.
- **Değer kararlı da değil:** `document_number_hash = HMAC(docHashKey, ülke:belge türü:belge no)` (kimlik servisi,
  `apps/id` `routes/idv.ts`). Kişi kimlik kartını yenileyince belge numarası değişir → hesap anahtarı değişir → site kişiyi
  tanımaz.
- **[[t:ARF]] Topic 11 (PA_01–PA_19):** cüzdan [[t:pseudonym]] üretir, siteye kaydeder, onunla giriş yapar; takma ad site başına
  benzersiz (CIR 2024/2979 md. 14(2)), siteden gerçek kimlik türetilemez (PA_16), farklı sitelere aynı takma ad verilmez
  (PA_17), [[t:wallet-provider]] bağlanamazlığı sağlayan yöntem kullanır (PA_18), kullanıcı takma adlarını görür, adlandırır,
  siler (PA_05–PA_10), site takma adın kullanıcıya ait olduğunu ve iptal edilmemiş bir cüzdandan geldiğini doğrular
  (PA_11–PA_14). AB boşluk analizinde (H1) bu 19 maddenin hepsi "eksik".
- **Kısıtlar:** kimlik servisi kişi verisini belge verdikten sonra tutmaz (IDP9); taşıma dosyası ve yedek anahtar taşımaz
  ([[ADR-0027]] LX2, WL2); aracı [[t:verifier|doğrulayıcıda]] cüzdan asıl [[t:RP|RP'yi]] tanır ([[ADR-0017]] K7); geliştirme evresinde geriye
  uyum yazılmaz ([[ADR-0029]]).

# Seçenekler

| # | Yöntem | Bağlanamazlık | Yeni telefon / yeniden kurulum | Kişi başına tek hesap | Tamga bağlayabilir mi | Sonuç |
|---|---|---|---|---|---|---|
| A | **Cüzdanın rastgele ana sırrı** → site başına anahtar | tam | ❌ kaybolur (LX2/WL2: sır taşıma dosyasına giremez) | ❌ yeniden kurulumda yeni takma ad | hayır | ret — hesaplar telefonla birlikte kaybolur |
| B | **Passkey = takma ad** (ARF "verifiable takma ad") | tam | platform senkronuna bağlı (iCloud/Google) | ❌ | hayır | tamamlayıcı — günlük giriş için kalır, kimlik taşımaz |
| C | **Belge veren site başına tanımlayıcı üretir** | tam (siteler arası) | ✅ | ✅ | **evet, ve siteyi öğrenir** | ret — kimlik servisi hangi siteye girdiğini öğrenir (izleme) |
| D | **Kimlikten türetilen tohum** (kimlik servisi) → cüzdanda site başına anahtar | tam (siteler arası) | ✅ kimlik yeniden doğrulanınca aynı | ✅ (gerçek cüzdan varsayımıyla) | yalnız anahtarı + kişinin kimlik numarasını birlikte kullanırsa | **kabul** |
| E | **Sıfır bilgi ispatlı "nullifier"** (Z5) | tam | ✅ | ✅ ve **ispatlı** | hayır (türetme ispatla doğrulanır) | hedef — Z5 ile D'nin yerini alır |

**Neden D?** A telefon değişince bütün hesapları siler (anahtar taşımak LX2'yi bozar). C izleme yaratır. E doğru uzun vadeli
çözüm ama mağaza uygulaması ve [[t:ZK]] kütüphanesi ister (Z5). D bugün yapılabilir, kararlıdır, kişi verisi saklatmaz ve E'ye
geçişte site tarafı değişmez (site yine "takma ad anahtarı + imza" görür).

# Karar

## K1 — Takma ad tohumu (kimlik servisi)
- Kimlik servisi kimlik belgesini verirken kişinin **değişmeyen** kimliğinden bir tohum türetir:
  `seed = HMAC-SHA256(pseudonymKey, "tamga-pseudonym-v1|" + ülke + "|" + kişisel kimlik numarası)`.
  Türkiye için girdi T.C. kimlik numarasıdır (kart yenilense de değişmez). Kişisel kimlik numarası olmayan belgelerde girdi
  `ülke|belge türü|belge no` olur (belge yenilenince takma adlar değişir — bilinen sınır, §Karara bağlanan sorular).
- `pseudonymKey` `docHashKey`'den **ayrı** bir anahtardır; yalnız kimlik servisindedir; pilotta KMS/HSM. Tohum **saklanmaz**
  (IDP9): her doğrulamada aynı girdiden yeniden hesaplanır.
- Tohum cüzdana **yalnız cüzdanın tutacağı, hiçbir zaman sunulmayan** ayrı bir belge türüyle iletilir
  (`urn:tamga:id:PseudonymSeed:1`). Bu tür [[t:trust-list|güven listesinde]] hiçbir RP kapsamına yazılamaz (AP6 onu zaten reddeder); cüzdan onu
  sunum ekranında hiç listelemez. Kimlik belgesinin içine konmaz: kimlik belgesinin bir alanı yanlışlıkla açıklanabilir,
  ayrı tür açıklanamaz.

## K2 — Site başına takma ad (cüzdan)
- Site kimliği = güven listesindeki **kayıtlı RP kimliği**; aracı doğrulayıcıda asıl RP'ninki ([[ADR-0017]] K7). Uygulamada RP
  kaydının kalıcı kimliği `dns_name` ([[ADR-0034]]; `client_id` [[t:x509_hash]] olarak sertifikadan türediği için kullanılmaz).
- `k = HKDF-SHA256(seed, info = "tamga-pseudonym-v1|" + site + "|" + sıra)` → P-256 özel anahtar (hash_to_field, mod n).
  **Takma ad** = açık anahtarın JWK parmak izi (RFC 7638). Sıra 0 = sitenin varsayılan (tek) takma adı.
- Tohum cüzdanda güvenli depoda (Keychain / Keystore; mağaza derlemesinde donanım korumalı), kullanım anında PIN/biyometri
  sonrası türetilir; türetilen anahtar kalıcı saklanmaz.

## K3 — Siteye ne gider
| Akış | Site alır | Site ALMAZ |
|---|---|---|
| **Kayıt** | takma ad açık anahtarı + imza (`aud` = site, `nonce`) + WIA (iptal edilmemiş cüzdan — PA_11) + politikada istenen alanlar (ör. ad, soyad) | `document_number_hash`, kimlik numarası |
| **Giriş** | takma ad imzası + WIA; hiçbir belge alanı | herhangi bir kişi alanı |
| **Kurtarma / yeni telefon** | aynı takma ad (kimlik yeniden doğrulanınca tohum aynı çıkar) | belge değeri |
| **Günlük giriş (bilgisayar)** | sitenin kendi passkey'i (değişmez) | — |

- Sunumda takma ad ayrı bir `vp_token` girdisi olarak taşınır: takma ad anahtarıyla imzalı kısa JWT
  (`typ: tamga-pseudonym+jwt`; `aud`, [[t:nonce]], `rp_id`, `cnf` = takma ad açık anahtarı) + [[t:WIA]]. Doğrulayıcı imzayı,
  `aud`/`nonce` eşleşmesini ve WIA'yı denetler (PA_13, PA_14).
- `document_number_hash` sitelere varsayılan olarak **gitmez**: `site-signup` / `site-signin` politikalarında yoktur. Kimlik
  belgesinde kalır (kurum kayıt eşleştirmesi için); bir RP onu yalnız kaydındaki kapsam açıkça içeriyorsa ister
  ([[ADR-0024]]).

## K4 — Tek hesap mı, çok takma ad mı
- Varsayılan: site başına **tek** takma ad (sıra 0) → bir kişi bir sitede bir hesap.
- RP kaydına bir alan: `pseudonyms: "single" | "multiple"` ([[ADR-0024]] kapsam verisi). `multiple` diyen sitede kullanıcı
  yeni takma ad açabilir (sıra 1, 2…; PA_04), takma adını adlandırır ve seçer (PA_05, PA_06).
- "Tek hesap" gerçek cüzdan varsayımına dayanır: değiştirilmiş bir cüzdan başka sıra sunabilir. WIA/cihaz kanıtı bunu
  sınırlar; kesin kanıt E (Z5) ile gelir. Siteye bu sınır kayıt rehberinde açıkça yazılır.

## K5 — Cüzdan ekranı
Ayarlar → **Takma adlarım**: site adı (kayıtlı ad), oluşturulma tarihi, kullanıcının verdiği ad (siteye gitmez — PA_19),
sil (PA_07; silinen takma ad o sitede bir daha türetilmez, yeniden kayıt yeni sıra açar). Kayıt ve giriş günlüğe yazılır
(PA_08a, TS10 günlüğü; takma ad değeri değil, site adı ve olay).

# Gerekçe / alternatifler

- **Bağlanamazlık:** iki site farklı `rp_id` görür → farklı HKDF çıktısı → farklı anahtar. Takma adlardan tohum ya da kimlik
  geri bulunamaz (HKDF/HMAC tek yönlü; PA_16).
- **Kararlılık:** tohum kişinin değişmeyen kimliğinden türediği için yeni telefonda, yeniden kurulumda ve kart yenilemede aynı
  kalır; taşıma dosyasına anahtar koymak gerekmez (LX2 korunur).
- **Bilinen zayıflama (açık yazılır):** `pseudonymKey`'e ve bir kişinin kimlik numarasına sahip olan biri (ör. kimlik servisini
  işleten, bir siteyle iş birliği yaparak) o kişinin o sitedeki takma adını hesaplayabilir. Önlemler: anahtar KMS/HSM'de, erişim
  kaydı, şeffaflık raporunda anahtar kullanım sayısı, anahtar devlete ([[t:PID]] sağlayıcısı) devredilebilir; kalıcı çözüm E (Z5).
  Bu karardan önceki durum (A seçeneği hariç her yöntemden) daha kötüydü: **her site** herkesi eşleştirebiliyordu.

# Değişmezler

| Kod | Kural |
|---|---|
| PS1 | Cüzdan bir siteye yalnız o sitenin kayıtlı `rp_id`'sinden türetilen takma adı sunar; farklı sitelere aynı takma ad gitmez. |
| PS2 | Takma ad tohumu kimlik servisinde saklanmaz; ayrı anahtarla (`pseudonymKey`) her doğrulamada yeniden türetilir. |
| PS3 | Tohum taşıyan belge türü hiçbir RP'ye sunulmaz; güven listesinde hiçbir kapsamda yer alamaz. |
| PS4 | `site-signup` / `site-signin` ve benzeri giriş politikaları `document_number_hash` ya da kimlik numarası istemez. |
| PS5 | Takma ad sunumu takma ad anahtarıyla imzalıdır (`aud` = site, `nonce`) ve iptal edilmemiş wallet unit kanıtı taşır. |
| PS6 | Kullanıcının takma ada verdiği ad siteye gönderilmez. |

# Uygulama planı

| Adım | Nerede | İş |
|---|---|---|
| 1 | `apps/id` (operatör deposu) | `pseudonymKey` (yapılandırma), tohum türetme, ayrı tür verme; testler (aynı kimlik → aynı tohum; farklı → farklı). |
| 2 | `packages/schemas` | tohum türü şeması (tek alan, `sd` yok, sunulamaz işaretli); katalog. |
| 3 | `packages/wallet-core` | `pseudonym.ts`: HKDF türetme, P-256 anahtar, `tamga-pseudonym+jwt`; sunumda ayrı `vp_token` girdisi; takma ad listesi/silme; günlük. |
| 4 | `packages/verifier` (+ `/web`) | takma ad JWT doğrulama (imza, aud, nonce, WIA); politika alanı `pseudonym: { mode }`; site kiti sonucu `pseudonym` döner. |
| 5 | `apps/verify` | `site-signup`/`site-signin` politikaları: `document_number_hash` yok, takma ad var; örnek site hesap anahtarı = takma ad. |
| 6 | `apps/trust-publisher` registry | RP kapsamına `pseudonyms: single|multiple`. |
| 7 | Tamga Wallet (ayrı depo) | onay ekranında "yeni takma ad / mevcut"; Ayarlar → Takma adlarım (üç dil). |
| 8 | Belgeler | SPEC-WALLET-0001, SPEC-API-0001, GUIDE-0001, FW-RB-0001, FW-RB-0003 (Identity Rulebook), 09-DEMO-KURGU S-17 kapanışı, sitede `/shortcuts` S-17 ve `/docs/login-with-tamga`. |

Tahmini iş: 1–7 yaklaşık 4–5 iş günü (testlerle). Yazılım yolu Expo Go'da çalışır; tohumun donanım korumalı saklanması mağaza
derlemesiyle (Z1) gelir. Geliştirme evresinde hesaplar ve politikalar yerinde düzeltilir, geçiş kodu yazılmaz ([[ADR-0029]]);
örnek sitenin hesapları bellektedir.

# Karara bağlanan sorular (proje yönetimi, 2026-10-01)

1. **D kabul** (kimlikten türeyen tohum; "bilinen zayıflama" yazılı sınır olarak kalır).
2. **Tohum türünün adı:** `urn:tamga:id:PseudonymSeed:1`.
3. **Kimlik numarası olmayan belgeler:** belge yenilenince takma adlar değişir; sınır olarak yazılır.
4. **Zamanlama:** şimdi, yazılım yoluyla; tohumun donanım korumalı saklanması mağaza derlemesiyle (Z1).

# Durum

**Accepted — 2026-10-01** (proje yönetimi onayı). Uygulama: yukarıdaki plan; S-17 bu ADR'nin uygulanmasıyla kapandı.
