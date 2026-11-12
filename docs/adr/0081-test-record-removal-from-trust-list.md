---
document_id: ADR-0081
title: "Sınama kayıtlarının listeden çıkarılması"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Güven listesinden kayıt silinmez (SPEC-TRUST-0001 TL2): bir kurumun kaydı kapanınca durumu değişir, geçmişi listede kalır. Bu
  karar kurala tek ve dar bir istisna tanımlar: kurum katılımından önce sınama amacıyla konmuş, hiçbir gerçek kişiye belge
  vermemiş ve hiçbir gerçek sunum almamış kayıtlar, ilk katılımcı kurum listeye girmeden önceki dönemde, gerekçesi herkese açık
  değişiklik günlüğüne yazılarak çıkarılabilir. İlk katılımcı kurum listeye girince istisna kapanır; sınama yalnız sandbox'ta
  yapılır. Çıkarılan kayıtları taşıyan imzalı liste sürümleri arşivde kalır. İstisna bir kez kullanıldı (2026-11-11).
domain: Trust
related: ["[[SPEC-TRUST-0001]]", "[[ADR-0009]]", "[[ADR-0038]]", "[[ADR-0041]]"]
---

# Kısaca

Güven listesi bir kayıt defteri gibidir: bir kurum ağdan ayrılsa bile satırı silinmez, "kapandı" diye işaretlenir. Böylece o
kurumun geçmişte verdiği belgeler bugün de doğru değerlendirilir. Ağ gerçek kurumlara açılmadan önce listeye deneme amacıyla
birkaç kayıt konmuştu. Bunlar hiçbir gerçek kişiye belge vermedi; listede kalmaları okuyanı yanıltıyordu. Bu karar, yalnız bu
tür deneme kayıtlarının ve yalnız ilk gerçek kurum katılana kadar çıkarılabileceğini söyler. Gerçek bir kurumun kaydı hiçbir
zaman silinmez.

# Bağlam

- [[SPEC-TRUST-0001]]/TL2: liste sürümleri yalnız artar, her sürüm bir öncekinin özetini taşır, hiçbir satır ya da kayıt silinmez;
  durum değişikliği `status_history`'ye eklenir. Gerekçe: doğrulama, belgenin verildiği andaki duruma bakar; kaydı silinen kurumun
  eski belgeleri değerlendirilemez olur.
- **Olgu.** 2026-11-11'de gerçek ağın ülke listesinden, kurum katılımı öncesi sınama döneminden kalan kayıtlar çıkarıldı
  (liste sürümü 241): iki sınama kurumuna ait iki belge veren kaydı, bir doğrulayıcı kaydı ve iki kapı grubu. Kayıtlar zaten
  `REVOKED` durumundaydı ve hiçbir gerçek kurum tarafından kullanılmamıştı. Çıkarma herkese açık değişiklik günlüğüne adsız bir
  satırla yazıldı; önceki liste sürümleri arşivde duruyor.
- Bu istisna bugüne dek yalnız SPEC-TRUST-0001 §4'te bir not olarak duruyordu; bir karara bağlı değildi. Sınırı yazılmamış bir
  istisna, ileride gerçek bir kurumun kaydı için de emsal gösterilebilir.
- Sınama için ayrı bir ağ vardır ([[ADR-0038]]); kurumlar test kurumlarını orada açar ve bu kayıtlar orada her gece kaldırılır
  ([[ADR-0041]]). Gerçek ağın listesine sınama kaydı koymaya artık gerek yoktur.

## Yayıncıdaki çıkarma yolu (bugünkü davranış)

Liste yayıncısı her yayında yeni listeyi, bir önceki yayının **imzalı** sürümüyle karşılaştırır. Önceki sürümde bulunan bir belge
veren, doğrulayıcı, kapı grubu, kök CA ya da şema yeni listede yoksa (ya da listede kalan bir kayıttan bir kullanım, şema yetkisi
ya da durum geçmişi satırı eksilmişse) **yayın durur**. Amaç, kaynak dosyadan yanlışlıkla silinen bir kaydın sessizce yayından
kalkmamasıdır.

Yayının geçmesinin tek yolu, kayıt defterine açıkça yazılmış bir onaylı çıkarma kaydıdır (`removals.json`). Kayıt şunları taşır:
liste adı, kararın tarihi, çıkarmadan önceki imzalı sürümün numarası (aşağıda uygulama notu), çıkan kayıtların türlerine göre **sayıları** ve kısa bir gerekçe. Ad ya da kimlik taşımaz. Sayılar
yayıncının hesapladığı farkla birebir tutmazsa yayın yine durur; yani kayıt yalnız onaylanan çıkarmayı geçirir, fazlasını
geçirmez. Yayın yapılınca gerekçe, sayılar ve karar tarihi herkese açık değişiklik günlüğüne tek satır olarak yazılır; önceki
sürümler arşivde kalır.

Durum komutlarındaki `--reason` (ör. `status <slug> REVOKED --reason …`) çıkarma değil **durum değişikliği** içindir: kayıt
listede kalır, gerekçe `status_history`'ye girer. Çıkarmanın gerekçesi komut satırından değil onaylı çıkarma kaydından gelir.
Sandbox'ta bu denetim uygulanmaz (test kurumları orada her gece kaldırılır).

# Karar

- **K1 — Genel kural değişmez.** Gerçek bir kurumun kaydı silinmez. Kurum ayrılır, kapanır ya da ağdan çıkarılırsa kaydının
  durumu değişir (`SUSPENDED`, `REVOKED`, `RETIRED`) ve geçmişi listede kalır. Kök CA ve şema kayıtları için de aynıdır.
- **K2 — İstisna dardır: yalnız sınama kaydı.** Çıkarılabilecek kayıt şu koşulların **hepsini** taşır: (i) kurum katılımından
  önce, sınama amacıyla konmuştur; (ii) hiçbir gerçek kişiye belge vermemiştir (belge veren kaydıysa) ve hiçbir gerçek sunum
  almamıştır (doğrulayıcı kaydı ya da kapı grubuysa); (iii) çıkarma, ilk katılımcı kurum gerçek ağın listesine girmeden önce
  yapılır. Çıkarma proje yönetiminin kararıyla yapılır ve gerekçesi herkese açık değişiklik günlüğüne yazılır; satır ad ve kimlik
  taşımaz.
- **K3 — İstisna kendiliğinden kapanır.** İlk katılımcı kurum gerçek ağın listesine girdiği yayından sonra gerçek ağın
  listesinden hiçbir kayıt çıkarılmaz. Sınama yalnız sandbox'ta yapılır; gerçek ağın listesine sınama kaydı konmaz.
  *Katılımcı kurum:* sınama amacıyla konmamış ve ağın geçici işletmecisinin kendi servisi olmayan belge veren ya da doğrulayıcı.
- **K4 — Arşiv kalır.** Çıkarılan kayıtları taşıyan imzalı liste sürümleri arşivde durur ve değiştirilmez. Sürüm numarası ve
  özet zinciri çıkarmayla kesilmez: çıkarmanın yapıldığı sürüm de bir öncekinin özetini taşır. İsteyen herkes kaydın hangi
  sürümlerde bulunduğunu arşivden görebilir.
- **K5 — Bugüne dek tek kullanım.** İstisna bir kez kullanıldı (2026-11-11, yukarıdaki olgu). Bu karar o kullanımı kayda bağlar
  ve sınırını yazar.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **Dar ve süreli istisna: yalnız sınama kaydı, ilk katılımcı kuruma kadar** | **kabul** | Genel kural bozulmaz; istisnanın koşulu ve bitişi yazılıdır; gerekçe herkese açıktır; arşiv kalır |
| İstisna yok: sınama kayıtları `REVOKED` olarak listede sonsuza dek kalır | ret | Liste herkese açıktır; hiç kurum olmamış kayıtlar ağın katılımcıları gibi okunur ve yanıltır. Kayıtların korunmasını gerektiren belge de yoktur |
| Süresiz istisna: sınama kaydı her zaman çıkarılabilir | ret | "Sınama kaydı" sınırı zamanla esner; gerçek ağda sınama alışkanlığını sürdürür. Sandbox varken gerek yoktur |
| İstisnayı yalnız şartname notunda bırakmak | ret | Bir karara bağlı olmayan istisna emsal olur; koşulu ve bitişi belirsiz kalır |

# Değişmezler

| Kod | Kural |
|---|---|
| RR1 | Gerçek ağın güven listesinden kayıt silinmez: belge veren, doğrulayıcı, kapı grubu, kök CA ve şema kaydı kapanınca durumu değişir, geçmişi listede kalır ([[SPEC-TRUST-0001]]/TL2). Gerçek bir kurumun kaydı için istisna yoktur. |
| RR2 | Listeden yalnız sınama kaydı çıkarılabilir: kurum katılımından önce sınama amacıyla konmuş, hiçbir gerçek kişiye belge vermemiş ve hiçbir gerçek sunum almamış kayıt. Çıkarma proje yönetiminin kararıyla yapılır; gerekçesi, kayıt sayıları ve karar tarihi herkese açık değişiklik günlüğüne ad ve kimlik taşımayan bir satırla yazılır. Yayıncı, sayıları birebir tutan onaylı çıkarma kaydı olmadan kayıt eksilten listeyi yayımlamaz. |
| RR3 | İstisna, ilk katılımcı kurum (sınama amacıyla konmamış ve ağın geçici işletmecisinin kendi servisi olmayan belge veren ya da doğrulayıcı) gerçek ağın listesine girdiği yayınla kapanır; sonrasında gerçek ağın listesinden hiçbir kayıt çıkarılmaz. Sınama yalnız sandbox'ta yapılır; gerçek ağın listesine sınama kaydı konmaz. |
| RR4 | Çıkarılan kayıtları taşıyan imzalı liste sürümleri arşivde kalır ve değiştirilmez; çıkarma sürüm numarasını ve özet zincirini kesmez. |

# Sonuçlar

- Kod bu kararla değişmez: yayıncının denetimi ve onaylı çıkarma kaydı bugünkü hâliyle RR2'nin ve RR4'ün makinece denetlenen
  kısmını karşılar (sayılar birebir, adsız satır, arşiv).
- Yayıncı bir kaydın "sınama kaydı" olup olmadığını ve ilk katılımcı kurumun listeye girip girmediğini kendisi bilemez; RR2'nin
  koşulu ve RR3'ün kapanışı karar düzeyinde denetlenir. İlk katılımcı kurum listeye girdikten sonra gerçek ağın kayıt defterine
  yeni çıkarma kaydı yazılmaz. Kapanışın yayıncıda makinece zorlanması ilk kurum katılımıyla birlikte ele alınır.
- **Uygulama notu (2026-11-12, ikinci inceleme; karar içeriği değişmedi) — çıkarma kaydı tek geçişe bağlıdır.** Onaylı çıkarma
  kaydı, geçerli olduğu sürüm geçişini de taşır: çıkarmadan önceki imzalı liste sürümünün numarası (`previous_version`, zorunlu)
  ve isteğe bağlı olarak o sürümün imzalı dosyasının özeti (`previous_version_hash`). Yayıncı kaydı yalnız önceki yayımlanmış
  sürüm bu ise kabul eder; yayın yapılınca sürüm ilerler ve kayıt kendiliğinden geçersiz kalır. Önceki hâlde kayıt yalnız liste
  adı ve sayılarla eşleşiyordu: aynı sayıda **başka** kaydın sonradan silinmesini de geçirir ve günlüğe eski gerekçeyi yazardı;
  RR2'nin "yalnız onaylanan çıkarma" koşulu makinece tam karşılanmıyordu. 2026-11-11 kullanımının kaydı sürüm 240 → 241
  geçişine bağlandı. Aynı turda RR1'in makinece denetlenen kısmı genişledi: listede kalan kayıtta geçmiş satırı değiştirilemez
  (ör. bir iptalin belgeleri geçersiz kılan tarihi ileri çekilemez), kapanmış bir şema yetkisi yeniden açılamaz; yetkili
  anahtarın ve LOTL kayıtlarının (ülke listesi kaydı, cüzdan sağlayıcı, dış liste) silinmesi de sayılır
  ([[SPEC-TRUST-0001]] sürüm notu, TL2).
- [[SPEC-TRUST-0001]] §4 ve TL2 bu karara atıf verir.
- Zincire geçişte ([[ADR-0009]]) arşiv sürümleri sırayla yeniden oynatılır. Çıkarılmış sınama kayıtları arşiv sürümlerinde
  bulunur; yeniden oynatmanın bunları nasıl ele aldığı eşdeğerlik testinde ([[SPEC-TRUST-0001]]/TL10) denetlenir.

# Durum

**Accepted — 2026-11-12.** Proje yönetiminin onayıyla (2026-11-12). DECISIONS: D-TRUST-7. RR1–RR4 bağlayıcıdır.
