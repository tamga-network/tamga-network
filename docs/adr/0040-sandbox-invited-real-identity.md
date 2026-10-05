---
document_id: ADR-0040
title: "Sandbox'ta gerçek kimlik doğrulama"
status: Active
version: 1.0.0
created: 2026-10-04
last_updated: 2026-10-05
summary: >
  Sandbox'ta kimlik akışı iki seçenek sunar: "Gerçek kimliğinle doğrula (Didit)" ve "Hızlı deneme (sahte kişi)". Gerçek yol
  herkese açıktır (davet kodu isteğe bağlı bir kip olarak kalır) ve gerçek ağın Didit hesabını ve kimlik akışını paylaşır; ayrı
  bir sağlayıcı uygulaması yoktur. Ücretsiz aylık kota gerçek ağla ortak olduğu için sandbox'ın günlük ve aylık bir tavanı
  vardır; dolunca yalnız hızlı deneme açıktır. Kişi taramadan önce açık bir uyarıyı onaylar; belgeye yalnız ad, soyad ve doğum
  tarihi geçer, sağlayıcıdaki oturum hemen silinir ve her şey gece sıfırlamasında silinir. Kabul edilen riskler (ortak kota,
  sandbox'ın sağlayıcı anahtarını okuyabilmesi, webhook'un gerçek ağa gitmesi) ve azaltımları yazılıdır. ADR-0038'in K4
  maddesini ve SB3 kuralını değiştirir.
domain: Identity
---

# Kısaca

Sandbox'ta kişiler uydurma, kimlik doğrulama varsayılan olarak sahte bir sağlayıcının ekranında "Onayla" düğmesiyle biter. Bu,
cüzdanın akışını sınamak için yeterli, ama bir cüzdan geliştiricisi ya da bir kurum gerçek kimlik doğrulama adımlarını
(belgenin taranması, canlılık, yüz eşleştirme) uygulama içinde nasıl göründüğüyle birlikte görmek ister.

Bu karar, sandbox'ta gerçek adımları **isteyen herkese** açar. Kimlik akışının ilk ekranında iki seçenek vardır: "Gerçek
kimliğinle doğrula (Didit)" ve "Hızlı deneme (sahte kişi)". Gerçek yol, gerçek ağın Didit hesabıyla çalışır; bunun getirdiği
riskler aşağıda açıkça kabul edilmiş ve sınırlanmıştır.

# Bağlam

- [[ADR-0038]] K4 ve `ADR-0038/SB3`: sandbox'ta gerçek kişisel veri yoktur, kimlik doğrulama sahte sağlayıcıyla yapılır.
- Kimlik doğrulama yalnız kimlik servisinde yapılır ([[ADR-0011]], `SPEC-ID-0003/IDP3`); kişi alanları belge verilene kadar
  tutulur, görüntü saklanmaz (`SPEC-ID-0003/IDP9`). Kimlik servisi nitelikli olmayan bir EAA verir ([[ADR-0022]]).
- Cüzdan, kimlik doğrulamayı uygulamadan çıkmadan (uygulama içi tarayıcıda) yaptırmaya geçiyor. Bu ekranları gerçek
  sağlayıcıyla denemenin tek yolu bugün gerçek ağdır; gerçek ağda ise test ve deneme yapılmaz.
- Bu kararın ilk metni gerçek yolu yalnız davet koduyla ve sağlayıcının ayrı bir sandbox uygulamasıyla açıyordu. Proje
  yönetimi 2026-10-05'te iki yön verdi: gerçek yol herkese açık olsun; sandbox için sağlayıcıda ayrı uygulama açılmasın, gerçek
  ağın sağlayıcı hesabı ve mevcut ücretsiz kimlik akışı kullanılsın. Bu metin o yönle yeniden yazıldı.

# Karar

**K1 — İki seçenek, herkese açık.** Sandbox'ta kimlik belgesi akışında, aydınlatma onayından sonra iki seçenek gösterilir:
"Gerçek kimliğinle doğrula (Didit)" ve "Hızlı deneme (sahte kişi)". Hızlı deneme eskisi gibi sahte sağlayıcıya gider ve
seçim yapılmayan her akış hızlı denemedir. Gerçek yol için davet gerekmez. Gerçek yol ayarlı değilse (sağlayıcı anahtarı yoksa)
ya da tavan dolmuşsa (K3) yalnız hızlı deneme gösterilir ve sade bir ileti yazılır ("Bugünlük kota doldu, hızlı denemeyi
kullan").

**K2 — Davet kodu isteğe bağlı bir kiptir.** Davet kodu altyapısı kalır ve yalnız sandbox yöneticisi açarsa kullanılır
(`TAMGA_IDV_DIDIT_SANDBOX_MODE=invite`; varsayılan `open`). Bu kipte gerçek yol yalnız geçerli bir davet koduyla açılır.
Kodu yalnız sandbox yöneticisi üretir (sandbox sayfasının yönetici bölümü, yönetici belirteciyle; bölüm dışarıya kapalıdır,
yalnız sunucunun kendisinden açılır). İki tür kod vardır: **kişiye özel** (tek kullanımlık; en çok 7 gün geçerli) ve
**süreli** (bir etkinlik ya da atölye için; en çok 72 saat ve en çok 25 kullanım). Kullanım hakkı sağlayıcı oturumu
**açılırken** düşer; belge verilirken kod hâlâ geçerli olmalıdır. Kod en az 128 bit rastgeledir, veritabanında yalnız
anahtarlı özeti durur; düz kod yalnız üretildiği anda bir kez gösterilir ve günlüğe yazılmaz. Hatalı denemeler akış başına ve
servis genelinde sınırlıdır; yönetici bölümünde yanlış belirteç üstel gecikmeyle yavaşlatılır. Davet kodu tavanı (K3) aşamaz.

**K3 — Gerçek ağın sağlayıcı hesabı ve tavanlar.** Gerçek yol, sağlayıcıda ayrı bir uygulama açmadan **gerçek ağın Didit
hesabı ve kimlik akışıyla** çalışır. Değerler sandbox'a ayrı adlı değişkenlerle (`TAMGA_IDV_DIDIT_SANDBOX_*`) verilir; değerler
gerçek ağınkiyle aynıdır. Sunucuda bunları sandbox kurulum betiği gerçek ağın ayarlarından kopyalar (`sandbox-setup.sh
didit-from-main`); değerler ekrana ve günlüğe basılmaz. Sandbox'ın ana sağlayıcısı her zaman sahtedir. Ücretsiz aylık kota
gerçek ağla ortak olduğundan sandbox'ta açılan **bütün** gerçek oturumlar (açık ve davetli) iki tavana sayılır: **günlük
tavan** (varsayılan 15, `TAMGA_IDV_DIDIT_SANDBOX_DAILY_CAP`) ve **aylık tavan** (varsayılan 150,
`TAMGA_IDV_DIDIT_SANDBOX_MONTHLY_CAP`; Türkiye saatine göre gün ve ay). Hak, sağlayıcı oturumu açılırken düşer; biri dolunca
yeni gerçek oturum açılmaz. Sayaç kişi verisi taşımaz ve gece sıfırlamasında bu ayın değerleriyle korunur (sıfırlama aylık
tavanı atlatamaz). Her akışta en çok bir gerçek oturum açılır.

**K4 — Taramadan önce açık uyarı.** Gerçek yol seçilince, sağlayıcıya gitmeden önce ayrı bir uyarı sayfası gösterilir ve kişi
onay kutusunu işaretlemeden devam edemez: "Bu bir test ortamıdır; gerçek kimliğinle deniyorsun; verilerin her gece silinir;
Didit oturumu belge verilir verilmez silinir." Aynı sayfada kısa aydınlatma metni ve kişinin hakları bulunur; sağlayıcı
hesabının gerçek ağla ortak olduğu da yazılır.

**K5 — En az veri.** Sandbox belgesine kişiden yalnız **ad, soyad ve doğum tarihi** geçer (bunlardan türeyen 18 yaş bilgisi,
belgenin ülke kodu ve türü dahil). Gerçek kimlik numarası ve belge numarası belgeye yazılmaz; yerlerine her belgede yeni,
rastgele ve açıkça test olduğu belli bir değer (`SANDBOX-…`) konur. Böylece sandbox belgesi gerçek ağdaki belgelerle ve
takma adlarla bağlanamaz. Kimlik servisi kişi alanlarını yalnız belge verilene kadar bellekte tutar (`SPEC-ID-0003/IDP9`);
görüntü hiçbir zaman Tamga'ya gelmez.

**K6 — Sağlayıcı oturumu her yolda hemen silinir.** Belge verildiği anda sağlayıcıdaki doğrulama oturumu (görüntüler dahil)
silinir; doğrulama başarısız olur ya da yarım kalırsa da silinir. Açık kalan oturumlar kaydedilir ve gece sıfırlamasında,
veritabanı silinmeden önce sağlayıcıda silinir; silinemeyen bir sonraki sıfırlamada yeniden denenir. Sandbox kimlik servisi
sağlayıcı oturum kimliğini belge kaydında tutmaz.

**K7 — Webhook'a güvenilmez.** Sağlayıcı hesabının webhook adresi gerçek ağın kimlik servisidir; sandbox oturumlarının
bildirimleri de oraya gider. Sandbox webhook'a güvenmez: kararı yalnız kişi geri döndüğünde (`/idv/return`) sağlayıcının
API'sinden çeker. Gerçek ağın kimlik servisi kendi açmadığı bir oturumun bildirimini sessizce yok sayar (durum değişmez,
günlüğe yazılmaz).

**K8 — Gece silinir, günlükte kişi verisi yok.** Gece sıfırlamasında ([[ADR-0038]] K5) kodlar, belge kayıtları ve bütün akış
durumu silinir (yalnız K3'teki sayaç korunur). Günlüklere yalnız olay adı, kod kimliği ve sayılar yazılır; ad, doğum tarihi,
kod ya da sağlayıcı yanıtı yazılmaz.

**K9 — Sınır.** Gerçek yol sürücü belgesi bilgisi ([[ADR-0039]]) için açılmaz; o tür sandbox'ta yalnız sahte sağlayıcıyla
denenir. Aydınlatma metni herkese açık kullanıma göre güncellenir ve hukuki incelemeden geçer.

# Kabul edilen riskler

Gerçek ağın sağlayıcı hesabını paylaşmak üç riski bilerek kabul eder; her biri sınırlandırılmıştır.

| Risk | Ne olur | Azaltım |
|---|---|---|
| **Ortak kota** | Sandbox'ta açılan oturumlar gerçek ağın ücretsiz aylık doğrulama hakkından düşer; aşırı kullanım gerçek ağın doğrulamasını aksatabilir. | Günlük (15) ve aylık (150) tavan (K3); dolunca yalnız hızlı deneme; davet kodu da tavanı aşamaz; akış başına tek oturum; sayaç gece sıfırlamasıyla atlatılamaz. |
| **Sandbox sağlayıcı anahtarını okuyabilir** | Sandbox servis kullanıcısı artık sağlayıcı anahtarını okur; sandbox ele geçirilirse anahtar sızar ve hesapta oturum açılıp okunabilir. | Anahtar yalnız sandbox ayar dosyasında ve yalnız sandbox kullanıcısına okunur (`root:tamga-sandbox 640`); gerçek ağın ayar dosyası, imza anahtarları, verisi ve yedekleri sandbox'a yine kapalıdır (dosya izni + servis kısıtı). Webhook gizli anahtarı sandbox'a kopyalanmaz. Şüphede anahtar dönüşümü: sağlayıcı panelinde yeni anahtar → gerçek ağın ayarlarına yazılır ve gerçek kimlik servisi yeniden başlatılır → `sandbox-setup.sh didit-from-main` yeniden çalıştırılır → eski anahtar panelde iptal edilir. |
| **Webhook gerçek ağa gider** | Sandbox oturumlarının bildirimleri gerçek ağın kimlik servisine ulaşır. | Sandbox webhook'a güvenmez, kararı API'den çeker; gerçek ağ bilmediği oturumun bildirimini sessizce yok sayar (K7). Bildirim yalnız tetiktir, kişi verisi okunmaz. |

# Değişmezler

| Kod | Kural |
|---|---|
| RI1 | Sandbox'ta kimlik akışı iki seçenek sunar (gerçek kimlikle sağlayıcı ya da hızlı deneme); seçim yapılmayan akış sahte sağlayıcıyla yapılır. Gerçek yol herkese açıktır; yalnız isteğe bağlı davet kipinde geçerli bir davet kodu gerekir. |
| RI2 | Sandbox'ın gerçek yolu gerçek ağın sağlayıcı hesabını yalnız ayrı adlı sandbox değişkenleriyle kullanır; bu değerler yalnız sandbox kullanıcısına okunur, gerçek ağın ayarları, imza anahtarları ve verisi sandbox'a kapalıdır; gerçek ağ sandbox adlarını kabul etmez. Sandbox sağlayıcı bildirimine (webhook) güvenmez, kararı sağlayıcının API'sinden çeker; gerçek ağ kendi açmadığı oturumun bildirimini yok sayar. |
| RI3 | Gerçek yolda kişi, sağlayıcıya yönlendirilmeden önce test ortamı uyarısını açıkça onaylar. |
| RI4 | Sandbox belgesine gerçek kimlik numarası ve belge numarası yazılmaz; kişiden yalnız ad, soyad ve doğum tarihi (ve türetilen yaş bilgisi) geçer. |
| RI5 | Sağlayıcıdaki doğrulama oturumu belge verildiğinde ya da akış belgeyle sonuçlanmadığında hemen silinir, açık kalan oturum en geç gece sıfırlamasında silinir; sandbox kimlik servisi oturum kimliğini kalıcı kayıtta tutmaz; akış başına en çok bir gerçek oturum açılır. |
| RI6 | Davet kodları yalnız anahtarlı özetle saklanır; düz kod, ad, doğum tarihi ve sağlayıcı yanıtı hiçbir günlüğe yazılmaz; hepsi gece sıfırlamasında silinir. |
| RI7 | Sandbox'ta açılan her gerçek sağlayıcı oturumu (açık ya da davetli) günlük ve aylık tavana sayılır; tavan dolunca gerçek oturum açılmaz, yalnız hızlı deneme kalır; sayaç gece sıfırlamasıyla sıfırlanmaz. |

`ADR-0038/SB3` bu kararla yeniden yazıldı (ADR-0038'e bakın).

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Sandbox'ta yalnız sahte sağlayıcı | ret | Uygulama içi kimlik doğrulama ekranları ve gerçek hata durumları gerçek ağa çıkmadan denenemez. |
| Sağlayıcıda ayrı sandbox uygulaması (ilk metin) | ret (2026-10-05) | Ayrı hesap ve akış kurulumu gerektirir; mevcut ücretsiz akış yeterlidir. Ayrılığın getirdiği koruma, tavan, anahtarın yalnız sandbox kullanıcısına okunması ve webhook'a güvenmeme ile sağlanır. |
| Yalnız davet koduyla gerçek yol (ilk metin) | isteğe bağlı kip | Herkesin denemesi isteniyor; kötüye kullanım ve maliyet tavanla sınırlanır. Davet kipi gerektiğinde açılabilir. |
| **İki seçenek + gerçek ağın hesabı + tavan + en az veri** | **kabul** | Gerçek adımlar herkesçe denenir; kişi bilerek dener; belgeye en az veri geçer; ortak kota ve anahtar riski sınırlıdır. |
| Belgeye gerçek kimlik numarasının da yazılması | ret | Sandbox belgesi gerçek ağdaki belgelerle ve takma adlarla bağlanabilir hâle gelirdi; deneme için gerekmez. |

# Sonuçlar

- Kimlik servisi sandbox kipinde iki sağlayıcıyı birlikte taşır: sahte sağlayıcı (hızlı deneme) ve gerçek sağlayıcı; seçim
  kişinin seçimiyle o akış için yapılır.
- Sandbox kurulum betiğine `didit-from-main` komutu eklenir: gerçek ağın sağlayıcı anahtarını ve kimlik akışını sandbox
  ayarlarına ayrı adlarla yazar, tavan varsayılanlarını ekler ve sandbox kimlik servisini yeniden başlatır. Sandbox ile gerçek
  ağın anahtarlarının aynı olmasını engelleyen eski denetim kaldırılır.
- Sandbox sayfası ve cüzdanın sandbox metinleri iki seçeneği anlatır; davet kodu üretme bölümü isteğe bağlı kip için kalır.
  Sandbox rehberi ve KVKK aydınlatma taslağı herkese açık kullanıma göre güncellenir.

# Durum

**Accepted — 2026-10-04**, **güncellendi 2026-10-05** (herkese açık gerçek yol; gerçek ağın sağlayıcı hesabı; tavanlar ve kabul
edilen riskler) — proje yönetimi onayı; birebir alıntılar özel onay kaydında. DECISIONS: D-ID-9. [[ADR-0038]] K4 ve SB3'ü
kısmen değiştirir.
