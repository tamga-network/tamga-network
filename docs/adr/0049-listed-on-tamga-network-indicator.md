---
document_id: ADR-0049
title: "\"Tamga Network'te listeli\" göstergesi"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  AB Cüzdan Güven İşareti'nin (EU Digital Identity Wallet Trust Mark) yerine, ağın güven listesindeki cüzdanlar için yazılı bir
  gösterge: "Tamga Network'te listeli" / "Listed on Tamga Network". Logo yoktur; AB yıldızları, AB renkleri ve "güven işareti"
  ya da "trust mark" sözü kullanılmaz. Göstergeye dokunulunca imzalı güven listesindeki `wallet_providers[]` kaydı gösterilir.
  Cüzdan birimi iptal edildiğinde ya da cüzdan sağlayıcısı listeden çıktığında gösterge gizlenir. Kural ağdaki her cüzdan için
  aynıdır. RB-WP-10'un "güven işareti" ifadesini değiştirir. Uygulama 0.6.0'da. Kabul: 2026-10-13.
domain: Wallet
related: ["[[ADR-0035]]", "[[ADR-0042]]", "[[ADR-0047]]", "[[SPEC-TRUST-0001]]", "[[FW-RB-0001]]"]
---

# Kısaca

Ağın güven listesindeki bir cüzdan, listede olduğunu kişiye **yazıyla** söyler: "Tamga Network'te listeli". Bu bir AB işareti
değildir ve öyle görünmez. Kişi yazıya dokunduğunda cüzdan, imzalı listedeki cüzdan sağlayıcısı kaydını gösterir; yani gösterge
doğrulanabilir bir beyandır, süs değildir.

# Bağlam

- **AB kuralı.** Uygulama Tüzüğü (AB) 2024/2979 Md. 14a (2026/1731 ile eklendi) sertifikalı AB cüzdanlarının AB Cüzdan Güven
  İşareti'ni göstermesini zorunlu kılar; işaretin biçimi, renkleri ve ölçüleri belirlidir; cüzdan birimi kanıtı iptal edilince
  işaret gösterilmez (AB TS1). İşaret yalnız bir AB üye devletinin sağladığı ya da tanıdığı, sertifikalı cüzdan içindir.
- **Tamga'nın durumu.** Ağdaki hiçbir cüzdan AB cüzdanı değildir ve işareti kullanamaz ([[ADR-0035]] PO4). Ama AB'nin işaretle
  çözdüğü sorun Tamga'da da var: kişi, telefonundaki uygulamanın ağın kurallarına uyan ve listede kayıtlı bir cüzdan olup olmadığını
  bilmek ister. Bugün RB-WP-10 cüzdandan "bu cüzdan Tamga güven listesinde" görünümünü "güven işareti" adıyla ister; bu ad AB
  işaretiyle karıştırılabilir ve hukuki ve mağaza riski taşır.
- **Ad.** "Tamga Network'te listeli" (Türkçe) ve "Listed on Tamga Network" (İngilizce) adlarını proje yönetimi 2026-10-13'te onayladı.

# Karar

## K1 — Yazılı gösterge, logo yok

- Gösterge yalnız yazıdır: Türkçe **"Tamga Network'te listeli"**, İngilizce **"Listed on Tamga Network"**; başka dillerde aynı
  anlamın çevirisi.
- Logo, rozet ya da mühür biçimi kullanılmaz. AB yıldızları, AB bayrağının renkleri ve düzeni, "güven işareti", "trust mark",
  "EU", "EUDI" ya da "onaylı / sertifikalı" sözleri göstergede ve yanında **MUST NOT** kullanılmak.
- Göstergenin yeri ve yazı biçimi cüzdanın kendi tasarımıdır; kişinin bulabileceği bir yerde (ör. cüzdan bilgisi ya da
  ayarlar) durur.

## K2 — Dokununca imzalı kayıt

- Göstergeye dokunulunca cüzdan, imzası doğrulanmış güven listesindeki kendi `wallet_providers[]` kaydını gösterir: sağlayıcının
  resmî adı, `provider_id`, kayıt ve çözüm durumu (`status`), cüzdan güvence seviyesi ve listenin yayın zamanı ([[SPEC-TRUST-0001]]).
- Bilgi cüzdanın elindeki doğrulanmış listeden okunur; gösterim anında ağdan istek yapılmaz.
- Cüzdan, listenin herkese açık adresini de gösterebilir; kişi kaydı cüzdan dışından da denetleyebilir.

## K3 — Ne zaman gizlenir

Gösterge şu durumlardan birinde **MUST** gizlenmek:
1. cüzdan birimi iptal edilmiştir (cüzdan sağlayıcısının iptali, kişinin isteği ya da WIA iptal listesi; [[ADR-0047]]);
2. cüzdan sağlayıcısının kaydı ya da kullanılan çözümün kaydı güven listesinde `ACTIVE` değildir (askı, iptal, çıkarma, yer tutucu
   kayıt);
3. cüzdanın elindeki güven listesi doğrulanamıyor ya da süresi geçmiştir (bayat liste "listeli" demeye yetmez);
4. cüzdan yalnız sandbox listesine bağlıdır: sandbox'ta listeli olmak göstergeyi vermez ([[ADR-0038]]).

## K4 — Ağdaki her cüzdan için aynı

Kural ağın kuralıdır ve güven listesindeki her cüzdana aynı biçimde uygulanır ([[ADR-0042]]). Listede olmayan bir uygulama göstergeyi
ya da ona benzeyen bir ifadeyi kullanamaz; kullanırsa bu, katılım kurallarının ihlalidir. Cüzdan sağlayıcısının tanıtım bilgisinde
(metadata) bu göstergeye karşılık bir "trust mark" alanı bulunmaz; sağlayıcının bilgi sayfası `provider_information_uri` alanında
"Sağlayıcı bilgisi" adıyla verilir (cüzdanın kendi kararıyla).

## K5 — Uygulama

Ağ kuralı bugünden geçerlidir; Tamga Wallet'ta gösterge ve dokununca açılan kayıt sayfası 0.6.0 paket sürümüyle gelir
(`wallet-core` kayıt okuma ve gizleme koşulları).

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| AB Güven İşareti'ni ya da ona benzer bir logoyu kullanmak | ret | Hukuken yalnız sertifikalı AB cüzdanı içindir; benzerlik yanıltıcıdır ve mağaza incelemesinde risktir |
| Kendi logolu "Tamga güven işareti" | ret | "Güven işareti" adı AB işaretini çağrıştırır; logo doğrulanabilir bir şey söylemez |
| Hiç gösterge koymamak | ret | Kişi uygulamanın ağda kayıtlı olup olmadığını öğrenemez; AB'nin çözdüğü ihtiyaç kalır |
| **Yazılı, doğrulanabilir gösterge** | **kabul** | Doğru şeyi söyler (listede kayıtlı), kaydı gösterir, iptalde kaybolur |

# Değişmezler

| Kod | Kural |
|---|---|
| LI1 | Gösterge yalnız yazıdır ("Tamga Network'te listeli" / "Listed on Tamga Network"); logo, AB yıldızları ve renkleri, "güven işareti" ya da "trust mark" sözü kullanılmaz. |
| LI2 | Göstergeye dokunulunca imzası doğrulanmış güven listesindeki `wallet_providers[]` kaydı gösterilir. |
| LI3 | Cüzdan birimi iptal edilmişse, sağlayıcı ya da çözüm kaydı `ACTIVE` değilse, liste doğrulanamıyorsa ya da cüzdan yalnız sandbox'a bağlıysa gösterge gösterilmez. |

# Sonuçlar

- [[FW-RB-0001]]: RB-WP-10 yeniden yazılır, RB-WP-18 eklenir.
- `wallet-core` (0.6.0): sağlayıcı kaydını ve gizleme koşullarını veren yardımcı.
- Tamga Wallet: gösterge ve kayıt sayfası; sağlayıcıda `trust_mark` alanı yerine `provider_information_uri` (cüzdanın kendi
  kararları).

# Durum

**Accepted — 2026-10-13.** Proje yönetimi onayıyla (ilk AB uyum turu, karar 4 ve 9c). DECISIONS: D-WALLET-3.
