---
document_id: ADR-0040
title: "Sandbox'ta davetli gerçek kimlik doğrulama"
status: Active
version: 1.0.0
created: 2026-10-04
last_updated: 2026-10-04
summary: >
  Sandbox'ta kimlik doğrulama varsayılan olarak sahte sağlayıcıyla yapılmaya devam eder. Yalnız sandbox yöneticisinin verdiği
  bir davet koduyla, gerçek kimlik doğrulama adımları (belge, canlılık, yüz) denenebilir: sağlayıcının yalnız sandbox için açılmış
  ayrı uygulaması kullanılır, gerçek ağın anahtarı sandbox'a hiç girmez. Kişi taramadan önce açık bir uyarıyı onaylar; belgeye
  yalnız ad, soyad ve doğum tarihi geçer (gerçek kimlik ve belge numarası yazılmaz), sağlayıcıdaki oturum belge verilir verilmez
  silinir ve her şey gece sıfırlamasında silinir. ADR-0038'in K4 maddesini ve SB3 kuralını değiştirir.
domain: Identity
---

# Kısaca

Sandbox'ta her şey sahte: kişiler uydurma, kimlik doğrulama sahte bir sağlayıcının ekranında "Onayla" düğmesiyle biter. Bu,
cüzdanın akışını sınamak için yeterli, ama bir cüzdan geliştiricisi ya da bir kurum gerçek kimlik doğrulama adımlarını
(belgenin taranması, canlılık, yüz eşleştirme) uygulama içinde nasıl göründüğüyle birlikte görmek ister.

Bu karar, sandbox'ta gerçek adımları **yalnız davetle** açar. Davetsiz herkes yine sahte sağlayıcıyla dener.

# Bağlam

- [[ADR-0038]] K4 ve `ADR-0038/SB3`: sandbox'ta gerçek kişisel veri yoktur, kimlik doğrulama sahte sağlayıcıyla yapılır.
- Kimlik doğrulama yalnız kimlik servisinde yapılır ([[ADR-0011]], `SPEC-ID-0003/IDP3`); kişi alanları belge verilene kadar
  tutulur, görüntü saklanmaz (`SPEC-ID-0003/IDP9`). Kimlik servisi nitelikli olmayan bir EAA verir ([[ADR-0022]]).
- Cüzdan, kimlik doğrulamayı uygulamadan çıkmadan (uygulama içi tarayıcıda) yaptırmaya geçiyor. Bu ekranları gerçek
  sağlayıcıyla denemenin tek yolu bugün gerçek ağdır; gerçek ağda ise test ve deneme yapılmaz.
- Proje yönetiminin yönü: sandbox'ta gerçek sağlayıcı adımları, sağlayıcının ayrı bir sandbox uygulamasıyla ve yalnız davet
  koduyla açılsın; sahte doğrulama varsayılan kalsın.

# Karar

**K1 — Varsayılan sahte.** Sandbox'ta kimlik doğrulama varsayılan olarak sahte sağlayıcıyla yapılır; davet kodu girilmeyen
her akış eskisi gibi sahte sağlayıcıya gider.

**K2 — Davet kodu.** Gerçek adımlar yalnız geçerli bir davet koduyla açılır. Kodu yalnız sandbox yöneticisi üretir (sandbox
sayfasının yönetici bölümü, yönetici belirteciyle; bölüm dışarıya kapalıdır, yalnız sunucunun kendisinden açılır). İki tür kod vardır: **kişiye özel** (tek kullanımlık; en çok 7 gün
geçerli) ve **süreli** (bir etkinlik ya da atölye için; en çok 72 saat ve en çok 25 kullanım). Kullanım hakkı sağlayıcı oturumu **açılırken** düşer: kişiye özel kod ikinci
bir oturum açamaz, aynı akışta ikinci oturum açılmaz; belge verilirken kod hâlâ geçerli (iptal edilmemiş) olmalıdır. Kod en az 128 bit rastgeledir,
veritabanında yalnız anahtarlı özeti durur; düz kod yalnız üretildiği anda bir kez gösterilir ve günlüğe yazılmaz. Kod,
kimlik servisinin aydınlatma sayfasında girilir; hatalı denemeler akış başına ve servis genelinde sınırlıdır; yönetici bölümünde yanlış belirteç üstel
gecikmeyle yavaşlatılır (kalıcı kilit yok). Kodlar gece
sıfırlamasında silinir.

**K3 — Ayrı sağlayıcı uygulaması.** Davetli akış, kimlik doğrulama sağlayıcısında **yalnız sandbox için açılmış ayrı bir
uygulama** ile çalışır: kendi API anahtarı ve kendi akışı (workflow) vardır. Gerçek ağın sağlayıcı anahtarı sandbox'a hiçbir
yoldan girmez: sandbox süreci gerçek ağın değişken adlarıyla gelen bir anahtar görürse açılmaz; sandbox anahtarı ayrı adlı
değişkenlerle verilir ve gerçek ağda bu adlar reddedilir.

**K4 — Taramadan önce açık uyarı.** Kod kabul edilince, sağlayıcıya gitmeden önce ayrı bir uyarı sayfası gösterilir ve kişi
onay kutusunu işaretlemeden devam edemez: "Bu bir test ortamıdır; gerçek kimliğinle deniyorsun; verilerin her gece silinir;
sağlayıcıdaki doğrulama oturumu belge verilir verilmez silinir." Aynı sayfada kısa aydınlatma metni ve kişinin hakları
bulunur.

**K5 — En az veri.** Sandbox belgesine kişiden yalnız **ad, soyad ve doğum tarihi** geçer (bunlardan türeyen 18 yaş bilgisi,
belgenin ülke kodu ve türü dahil). Gerçek kimlik numarası ve belge numarası belgeye yazılmaz; yerlerine her belgede yeni,
rastgele ve açıkça test olduğu belli bir değer (`SANDBOX-…`) konur. Böylece sandbox belgesi gerçek ağdaki belgelerle ve
takma adlarla bağlanamaz. Kimlik servisi kişi alanlarını yalnız belge verilene kadar bellekte tutar (`SPEC-ID-0003/IDP9`);
görüntü hiçbir zaman Tamga'ya gelmez.

**K6 — Sağlayıcı oturumu hemen silinir.** Belge verildiği anda sağlayıcıdaki doğrulama oturumu (görüntüler dahil) silinir;
doğrulama başarısız olur ya da yarım kalırsa da silinir. Sandbox kimlik servisi sağlayıcı oturum kimliğini belge kaydında
tutmaz.

**K7 — Gece silinir, günlükte kişi verisi yok.** Gece sıfırlamasında ([[ADR-0038]] K5) kodlar, belge kayıtları ve bütün akış
durumu silinir. Günlüklere yalnız olay adı, kod kimliği ve sayılar yazılır; ad, doğum tarihi, kod ya da sağlayıcı yanıtı
yazılmaz.

**K8 — Davetin sınırı.** Aydınlatma metni hukuki incelemeden geçene kadar davet kodu yalnız proje ekibine ve davetin
amacını yazılı olarak kabul eden sınırlı sayıda test kullanıcısına verilir. Davetli akış sürücü belgesi bilgisi
([[ADR-0039]]) için açılmaz; o tür sandbox'ta yalnız sahte sağlayıcıyla denenir.

# Değişmezler

| Kod | Kural |
|---|---|
| RI1 | Sandbox'ta gerçek kimlik doğrulama sağlayıcısına yalnız geçerli bir davet koduyla gidilir; davet kodu olmayan akış sahte sağlayıcıyla yapılır. |
| RI2 | Gerçek ağın kimlik doğrulama sağlayıcısı anahtarı sandbox'ta hiçbir zaman kullanılmaz; sandbox ayrı bir sağlayıcı uygulamasının ayrı adlı anahtarıyla çalışır ve gerçek ağ bu adları kabul etmez. |
| RI3 | Davetli akışta kişi, sağlayıcıya yönlendirilmeden önce test ortamı uyarısını açıkça onaylar. |
| RI4 | Sandbox belgesine gerçek kimlik numarası ve belge numarası yazılmaz; kişiden yalnız ad, soyad ve doğum tarihi (ve türetilen yaş bilgisi) geçer. |
| RI5 | Sağlayıcıdaki doğrulama oturumu belge verildiğinde ya da akış belgeyle sonuçlanmadığında hemen silinir; sandbox kimlik servisi oturum kimliğini kalıcı kayıtta tutmaz. |
| RI6 | Davet kodları yalnız anahtarlı özetle saklanır; düz kod, ad, doğum tarihi ve sağlayıcı yanıtı hiçbir günlüğe yazılmaz; hepsi gece sıfırlamasında silinir. |

`ADR-0038/SB3` bu kararla yeniden yazıldı (ADR-0038'e bakın).

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Sandbox'ta yalnız sahte sağlayıcı (bugünkü durum) | ret | Uygulama içi kimlik doğrulama ekranları ve gerçek hata durumları gerçek ağa çıkmadan denenemez. |
| Sandbox'ta gerçek ağın sağlayıcı anahtarı | ret | Test trafiği gerçek ağın hesabına ve kayıtlarına karışır; gerçek ağın gizli anahtarı test sunucusuna taşınır. |
| Herkese açık gerçek doğrulama | ret | Kimin gerçek kimliğiyle denediği bilinmez; maliyet ve kötüye kullanım sınırsız olur. |
| **Ayrı sağlayıcı uygulaması + davet kodu + en az veri** | **kabul** | Gerçek adımlar denenir; gerçek ağa hiçbir yoldan karışmaz; kişi bilerek dener; belgeye en az veri geçer. |
| Belgeye gerçek kimlik numarasının da yazılması | ret | Sandbox belgesi gerçek ağdaki belgelerle ve takma adlarla bağlanabilir hâle gelirdi; deneme için gerekmez. |

# Sonuçlar

- Kimlik servisi sandbox kipinde iki sağlayıcıyı birlikte taşır: sahte sağlayıcı (varsayılan) ve davetli gerçek sağlayıcı;
  seçim davet kodu doğrulanınca o akış için yapılır.
- Sandbox kurulum betiği gerçek ağın değişken adlarıyla gelen sağlayıcı anahtarını reddeder; sandbox anahtarı ve akışı ayrı
  adlı değişkenlerle, sunucuya elle konur.
- Sandbox sayfasına davet kodu üretme bölümü (yönetici belirteciyle) ve "gerçek kimliğinle dene" anlatımı eklenir; Sandbox
  rehberi güncellenir.
- Sandbox için kısa bir KVKK aydınlatma metni taslağı hazırlanır; davetler K8'deki sınırla verilir.

# Durum

**Accepted — 2026-10-04** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-ID-9. [[ADR-0038]] K4 ve
SB3'ü kısmen değiştirir.
