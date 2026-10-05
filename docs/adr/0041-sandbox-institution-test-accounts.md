---
document_id: ADR-0041
title: "Sandbox'ta kurum test hesapları"
status: Active
version: 1.0.0
created: 2026-10-04
last_updated: 2026-10-04
summary: >
  Bir kurum, sandbox sayfasından e-posta doğrulaması olmadan kendi test kurumunu açar ve passkey ile girdiği konsolda kendi
  uydurma kayıtlarını girer ya da CSV ile yükler. Test kurumunun belge imza sertifikaları sandbox'taki ayrı bir ara sertifika
  makamınca otomatik verilir (sandbox kökünün özel anahtarı sunucuda değildir), kurum sandbox güven listesine "test kurumu"
  işaretiyle kendiliğinden eklenir; kurum belge verir ve Tamga Verify sandbox'ta doğrular. Her şey her gece silinir. Gerçek
  kişi verisine karşı uyarı ve kimlik numarası kalıp denetimi, kötüye kullanıma karşı sayı ve hız sınırları vardır. ADR-0038'in
  K1 (sandbox'ta konsol yok) ve K7 (kendi kendine kayıt sonraki aşama) maddelerini kurumlar için değiştirir.
domain: Services
---

# Kısaca

Sandbox'taki örnek kurumlar cüzdan geliştiricisinin işini görür, ama bir kurum kendi belgesini kendi verisiyle denemek ister:
"bizim diplomamız cüzdanda nasıl görünür, doğrulayıcı ne görür?". Bu karar, kurumun sandbox'ta birkaç dakikada kendi test
kurumunu açmasını, kayıt girip belge vermesini ve doğrulamayı görmesini sağlar. Hepsi test anahtarıyla imzalıdır ve her gece
silinir.

# Bağlam

- [[ADR-0038]] K1: sandbox'ta kurum konsolu yoktur; K7: dış katılımcıların kendini sandbox listesine eklemesi sonraki
  aşamadır ve ayrı karar ister.
- [[ADR-0019]]: Kurum Konsolu davet + passkey ile çalışır; her sorgu oturumdaki kuruma bağlıdır. Örnek kayıt defteri
  ([[ADR-0020]]) yalnız deneme içindir; gerçek ağda bu kip kod kilidiyle kapalıdır.
- Sandbox kök sertifikasının özel anahtarı sunucuya gönderilmez; sunucuda yalnız yaprak sertifikaların ve liste imzacısının
  anahtarları vardır. Yeni bir kurum için yeni yaprak sertifika üretmek bu yüzden bugün sunucuda mümkün değildir.
- Proje yönetiminin yönü: deneyecek kurumlar sandbox'ta kendi verisini koyup denesin; kişisel veri en az olsun.

# Karar

**K1 — Kendi kendine test hesabı.** Kurum, sandbox sayfasındaki "Kurumunu dene" bölümünden e-posta doğrulaması ve davet
olmadan bir test kurumu açar: yalnız uydurma bir kurum adı ve kurum türü istenir (ad kendiliğinden "(TEST)" ile biter). Adın görünmez ve yön
karakterleri temizlenir; gerçek ve sandbox listelerindeki kurum adlarına benzeyen adlar, resmî kurum sözcükleri (T.C., Bakanlık,
Belediye, Valilik, Üniversite, University, Ministry …) ve Tamga ya da sağlayıcı adları kabul edilmez. Açılış isteği yalnız sandbox
sayfasının kendi kökeninden gelir. Ad,
e-posta ya da telefon gibi kişi bilgisi istenmez. Açılış, kurumun ilk yöneticisi için tek kullanımlık bir konsol daveti üretir;
yönetici konsola passkey ile girer.

**K2 — Konsol sandbox'ta yalnız test kurumlarına açılır.** Kurum Konsolu sandbox'ta `console.sandbox.tamga.network`
adresinde yeniden çalışır, ama yalnız bu kararla açılan test kurumlarına hizmet verir; tohum verisinden gelen örnek kurumlar
konsolsuz kalır. Her konsol ekranı "SANDBOX · TEST" işaretini ve "gerçek kişi verisi girmeyin" uyarısını gösterir. Gerçek ağdaki
deneme kayıt defteri kilidi aynen korunur.

**K3 — Uydurma kayıtlar ve kalıp denetimi.** Kurum kayıtlarını tek tek girer ya da CSV dosyasının içeriğini yapıştırarak
yükler. Kayıt ekranları gerçek kişi verisi girilmemesi için açık uyarı taşır. Herhangi bir alanında kimlik numarası sağlama
kuralını geçen 11 haneli bir sayı bulunan kayıt reddedilir (gerçek bir kimlik numarası olabilir); sandbox'ın örnek kişileri
gibi bilerek geçersiz numaralar kabul edilir.

**K4 — Ara sertifika makamı.** Sandbox'ta yalnız test kurumlarına yaprak sertifika veren ayrı bir ara sertifika makamı vardır:
"Tamga Sandbox Test Institutions CA (TEST)". Sandbox kökünce, kök anahtarının durduğu bilgisayarda imzalanır; yalnız bir
düzey alt sertifika verebilir (yol uzunluğu 0) ve yalnız sertifika imzalar; ad kısıtı yalnız sandbox test kurumu konu adlarına izin verir. Süresi en çok 1 yıldır ve
süre dolmadan kök anahtarının durduğu bilgisayarda yenilenir. Özel anahtarı sandbox sunucusundadır. Test
kurumunun belge ve iptal listesi imza sertifikaları bu makamca kısa süreli (en çok 30 gün) verilir; belgeler yaprak + ara
sertifika zinciri taşır ve doğrulayıcı zinciri sandbox köküne bağlar. Kök anahtarı yine sunucuya gönderilmez.

**K5 — Sandbox listesine otomatik kayıt.** Test kurumu açılır açılmaz sandbox güven listesine eklenir ve liste yeniden
imzalanır. Kayıtta `test_institution: true` işareti, sandbox değerleriyle doldurulmuş kayıt verisi ([[ADR-0024]]) ve yalnız
seçilen türün belge yetkisi bulunur. Test kurumu sandbox doğrulayıcısında örnek kurumlar gibi doğrulanır; cüzdan ve doğrulayıcı
işareti gösterebilir.

**K6 — Her gece silinir.** Test kurumları, hesapları, passkey'leri, kayıtları, verdikleri belgelerin kayıtları ve sertifikaları
gece sıfırlamasında ([[ADR-0038]] K5) silinir ve sandbox listesinden çıkarılır. Sandbox listesinde bu, "kayıt silinmez"
kuralının tek istisnasıdır; gerçek ağ listesinde istisna yoktur. 7 günlük saklama seçeneği reddedildi (aşağıda).

**K7 — Kötüye kullanım sınırları.** Aynı anda en çok 30 test kurumu; servis genelinde 10 dakikada en çok 10 yeni kurum;
kurum başına en çok 200 kayıt; bir CSV yüklemesinde en çok 200 satır; kurum başına saatte en çok 100 belge teklifi. Sınırlar
IP adresi kullanmadan uygulanır; teklif sınırı konsol, API anahtarı ve iç uç için tek sayaçtır. 30 kurum dolunca en eski
**boş** test kurumu (kaydı ve verilmiş belgesi olmayan, en az 30 dakikalık) yer açmak için kaldırılır; boş kurum yoksa kullanıcıya
beklemesi söylenir (sınır herkesçe tüketilip kilitlenmez).

**K8 — Aşamalar.** Aşama 1: eğitim kurumu (öğrenci belgesi, diploma), konsol, tek tek ve CSV ile kayıt, masada teklif,
sandbox doğrulayıcısında doğrulama. Aşama 2: etkinlik bileti kurumu (konsolda etkinlik oluşturma), cüzdanın başlattığı ihraç
(kimlik sunumuyla eşleştirme) ve test kurumu için API anahtarı. Doğrulayıcıların ve cüzdan sağlayıcılarının kendi kendine
kaydı ([[ADR-0038]] K7'nin kalan kısmı) ayrı karar ister.

# Değişmezler

| Kod | Kural |
|---|---|
| TI1 | Test kurumu yalnız sandbox'ta vardır; yaprak sertifikalarını yalnız sandbox test kurumları ara sertifika makamı verir; sandbox kökünün özel anahtarı hiçbir sunucuda bulunmaz. |
| TI2 | Her test kurumu sandbox listesinde `test_institution: true` taşır ve görünen adı "(TEST)" ile biter. |
| TI3 | Sandbox'ta Kurum Konsolu yalnız test kurumlarına hizmet verir; gerçek ağda deneme kayıt defteri kipi açılamaz. |
| TI4 | Kimlik numarası sağlama kuralını geçen 11 haneli bir sayı taşıyan test kaydı reddedilir; her kayıt ekranı gerçek kişi verisi girilmemesi için uyarır. |
| TI5 | Test kurumları ve onlara ait hesap, kayıt, belge kaydı ve sertifikalar gece sıfırlamasında silinir ve sandbox listesinden çıkar. |
| TI6 | Test kurumu açma ve kullanma sınırları IP adresi kullanılmadan uygulanır. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Kök anahtarını sandbox sunucusuna koymak | ret | Sunucu ele geçirilirse sandbox kökünün altına her şey imzalanabilir; cüzdanlardaki sabit kök değiştirilmek zorunda kalır. |
| Önceden üretilmiş sertifika havuzu | ret | Sınırlı sayıda; havuz bittiğinde elle iş; kurum adı sertifikaya yazılamaz. |
| Listede kendinden imzalı kurum sertifikası | ret | Belgelerin köke zincirlenmesi kuralı (doğrulamanın A3 adımı) bozulur; gerçek ağdan farklı davranır. |
| **Ayrı ara sertifika makamı (yol uzunluğu 0, anahtar sandbox sunucusunda)** | **kabul** | Kök çevrimdışı kalır; ara makam yalnız yaprak verir; ele geçirilirse yalnız ara makam iptal edilip yenisi kökle imzalanır. |
| E-posta doğrulamalı kayıt | ret | Kişisel veri toplar; deneme için gerekmez. Kötüye kullanım sayı ve hız sınırlarıyla tutulur. |
| Test hesabını 7 gün saklamak | ret | Yanlışlıkla girilmiş gerçek veri daha uzun kalır; sandbox'ın tek ve basit sıfırlama kuralı bozulur. Kurum ertesi gün birkaç dakikada yeniden açar. |
| **Her gece silmek** | **kabul** | `ADR-0038/SB5` ile aynı kural; en az saklama. |

# Sonuçlar

- Sandbox PKI'sına ara sertifika makamı eklenir; sandbox sunucusuna kökün özel anahtarı olmadan, ara makamın anahtarıyla gider.
- Liste yayıncısı sandbox'ta test kurumu kaydı alır (sertifika üretir, kaydı ekler, listeyi imzalar); kayıtlar sandbox veri
  klasöründe durur ve sıfırlamada silinir. Güven listesi şartnamesine isteğe bağlı `test_institution` alanı eklenir.
- Belge veren servis sandbox'ta yeni test kurumunu yeniden başlatmadan yükler; Kurum Konsolu sandbox'ta yeniden açılır.
- Sandbox sayfasına "Kurumunu dene" bölümü, Sandbox rehberine kurum anlatımı eklenir. Sandbox için yeni bir adres gerekir:
  `console.sandbox.tamga.network`.

# Durum

**Accepted — 2026-10-04** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-TRUST-4. [[ADR-0038]] K1 ve
K7'yi kurumlar için değiştirir.
