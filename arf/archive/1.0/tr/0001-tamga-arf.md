---
document_id: FW-ARF-0001
title: "Mimari ve Referans Çerçevesi"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-09
summary: >
  Tamga Network'ün mimari ve referans çerçevesinin ana belgesi. Avrupa Birliği'nin EUDI ARF'si ile aynı yapıyı izler:
  kullanım durumları, roller, mimari, veri modeli, güven modeli, güvenlik ve yönetişim. Bağlayıcı kurallar eklerdedir
  (A Trust Framework, B Tamga Rulebook, C belge türü rulebook'ları); terimler Ek D'de, kaynaklar Ek E'dedir.
---

# 1. Giriş

## 1.1 Amaç ve kapsam

Tamga Network, Türk dünyası için bir dijital güven altyapısıdır. Kurumların (üniversite, meslek kuruluşu, kamu kurumu,
şirket) kişilere verdiği belgeler elektronik öznitelik belgesi olarak verilir, kişinin cüzdanında taşınır ve üçüncü taraflar
bunları kaynağa sormadan, saniyeler içinde doğrular.

Bu belge, Tamga ekosistemine katılan bir kurumun, düzenleyicinin ya da entegratörün başvurduğu mimari referanstır. Kimin hangi
rolde katıldığını, güvenin nereden geldiğini, belgelerin hangi biçimde taşındığını ve hangi akışlarla verilip
gösterildiğini anlatır. Teknik ayrıntılar (veri yapıları, protokol profilleri, arayüzler) geliştirici belgelerindedir.

Belge kendisi karar üretmez. Mimari kararlar karar kayıtlarında (ADR), teknik kurallar spesifikasyonlarda alınır; bu belge
ve ekleri onları katılımcının okuyabileceği tek bir yerde toplar.

## 1.2 Kimler için

Bu çerçeve belge veren ve doğrulayan kurumlar, cüzdan sağlayıcıları, devletler ve düzenleyiciler, denetçiler ve
entegratörler için yazılmıştır. Rolünüze göre hangi bölümleri hangi sırayla okuyacağınız **Okuma yolu** sayfasındadır
([[FW-READ-0001]]); rollerin ayrıntısı **Roller** ([[FW-ROLE-0001]]), katılımın adımları **Katılım süreci**
([[FW-ONB-0001]]) sayfasındadır.

## 1.3 Belgenin yapısı

Tamga [[t:ARF]], AB ARF'si gibi bir ana belge ve eklerden oluşur:

| Belge | İçerik |
|---|---|
| Ana belge (bu belge) | Kullanım durumları, roller, mimari, veri modeli, güven modeli, güvenlik, yönetişim |
| Ek A — Trust Framework | Yönetişim, katılım kapıları, uyum, sözleşmeler, devir planı |
| Ek B — Tamga Rulebook | Bütün katılımcılar ve belge türleri için ortak, numaralı ve bağlayıcı kurallar |
| Ek C — Rulebook'lar | Tamga Rulebook'tan dallanan belge türü kuralları: Education Rulebook (öğrenci belgesi, diploma), Identity Rulebook (kimlik belgesi), Event Ticket Rulebook (etkinlik bileti) |
| Ek D — Tanımlar | Terimler ve kısaltmalar |
| Ek E — Kaynaklar | Standartlar, karar kayıtları, spesifikasyonlar ve kural kaynakları |
| Okuma yolu · Roller · Katılım süreci | Yardımcı sayfalar: rol başına okuma sırası, rollerin ayrıntısı, katılımın adımları |

Türkçe metin kaynaktır; İngilizce metin aynı sürümün resmî çevirisidir. İki dil her zaman aynı sürümdedir.
Kurallardaki MUST, MUST NOT, SHOULD ve MAY ifadeleri RFC 2119 anlamındadır.

## 1.4 eIDAS 2.0 ve AB ARF ile ilişki

Tamga'nın teknik katmanı AB'nin Avrupa Dijital Kimlik Cüzdanı ekosistemiyle aynıdır: aynı belge biçimleri, aynı
protokoller, aynı [[t:trust-list]] modeli ve aynı rol seti kullanılır. Yönetişim katmanı ise Türk dünyası için yazılır: her
devlet kendi kayıtlarının tek sahibidir ve devletler birbirini tanıma yoluyla birlikte çalışır.

"[[t:EUDI-Wallet]]" bir AB üye devletinin sunduğu ya da tanıdığı ve AB kurallarına göre sertifikalanan cüzdanın hukuki adıdır. AB
dışındaki bir kuruluşun cüzdanı bu unvanı alamaz ve AB güven işaretini kullanamaz. Tamga Wallet bu nedenle "AB uyumlu cüzdan"
olarak tanımlanır; uyum, birlikte çalışabilirlik testleriyle gösterilir.

## 1.5 Konumlanma

Tamga üç katmanda konumlanır ve her katman tek başına ayakta durur:

1. **Taban — AB uyumu.** Belgeler, protokoller ve güven listeleri AB standartlarındadır. Ağ hiç büyümese de bu katman kurumlar
   ve cüzdanlar için değer taşır.
2. **Tamga Network — hafif bir güven federasyonu.** Ağ, ülke güven listelerini toplar ve birbirine tanıtır; yayınlanmış
   kurallara uyan her cüzdan sağlayıcısını tanır. Bugün Türkiye listesini Tamga geçici olarak, devlet adına işletir. Devletler
   katıldıkça listeler devredilir, bir yönetişim kurumu kurulur ve ortak defter (zincir) gelir.
3. **Ağın üstündekiler.** Ağın kurallarına uyan cüzdanlar ve hizmet sağlayıcılar. Tamga Wallet ağın ilk
   cüzdanıdır; bir şirketin ayrı ürünüdür ve her AB uyumlu ortamda çalışır. Tamga Network hizmet satmaz: ağ kuralları, güven listelerini,
   açık kodu ve referans hizmetleri (barındırılan belge verme, Kurum Konsolu, barındırılan [[t:verifier]] Tamga Verify) işletir;
   entegrasyon, destek ve danışmanlık gibi ticari hizmetler ağın dışındaki şirketlerce, kendi adlarıyla sunulur ([[ADR-0037]]).

## 1.6 İlkeler

| # | İlke |
|---|---|
| P1 | Her devlet kendi ulusal kayıtlarının tek yazarıdır. Konsey kurulduğunda ağa üyelik üye devletlerin üçte iki oyuyla olur; o zamana kadar geçici işletmeci yönetir (§8.3). Sınır ötesi tanıma tek taraflıdır. |
| P2 | Hiçbir ortak kayıtta kişisel veri bulunmaz: güven listesinde, çapa günlüğünde, zincirde ve kayıtlarda belge içeriği ya da belge özeti de yoktur. |
| P3 | Teknik katman AB standartlarıyla aynıdır; Tamga'ya özgü her ek standart bir uzantı noktasıyla yapılır. |
| P4 | Hiçbir tanımlayıcı, rol ya da yapı tek işletmeci varsayımı taşımaz; Tamga'nın üstlendiği her devlet rolü devredilebilir tasarlanır. |
| P5 | Ortak defter bir depolama tercihi değil, imzacı tercihidir: bugün güven imzalı listelerden gelir; en az iki bağımsız işletmeci olduğunda zincir kurulur. |
| P6 | Her belge cihazın güvenli bölgesindeki bir anahtara bağlıdır; kopyalanamaz ve devredilemez. |
| P7 | Kodla sınırlanamayan her yetki (barındırma, alan adı, kayıt tutma, istatistik) politika, ölçülebilir devir eşiği ve şeffaflık raporuyla sınırlanır. |

## 1.7 Kapsam dışı

Bu sürümde kapsam dışında olanlar: kişi kimlik verisi ([[t:PID]]) ihracı (bu rol devlete ayrılmıştır), ödeme ve değer aktarımı,
kurumların belge sahibi olduğu kurum cüzdanı, W3C VCDM/JSON-LD biçiminde ikinci temsil ve nitelikli elektronik imza. Bunlar
yol haritasındadır ve ayrı kararlarla açılır.

---

# 2. Kullanım durumları ve işlevler

## 2.1 Belge alma

Kişi bir belgeyi iki yoldan alır:

- **Kurumun başlattığı belge verme.** Kurum bir teklif oluşturur ve kişiye karekod ya da bağlantı olarak iletir. Kişi cüzdanla
  okutur; teklif tek kullanımlıktır ve gerekirse ayrı bir kanaldan gönderilen işlem koduyla korunur.
- **Cüzdanın başlattığı belge verme.** Kişi cüzdanda kurumu seçer ve belgesini ister. Kurum, kişinin kimliğini cüzdandaki
  doğrulanmış kimlik belgesinin sunumuyla eşler ve bilgileri imza anında kendi sisteminden ([[t:authentic-source]]) okur. Kişiye ait
  bilgiler Tamga'da saklanmaz.

Her iki yolda cüzdan, cüzdan sağlayıcısının imzaladığı bir cüzdan örneği kanıtı ([[t:WIA]]) sunar; kurum yalnız güven listesinde tanınan
sağlayıcıların cüzdanlarına belge verir. Belgeler kopyalar hâlinde verilir; cüzdan her doğrulayıcıya ayrı bir kopya gösterir.
Kurumun ilan ettiği koşullarda cüzdan, kullanıcıya sormadan kopyaları yeniler.

## 2.2 Uzaktan gösterme

Bir doğrulayıcı (işveren, web sitesi, kurum) cüzdandan belge ister. İstek imzalıdır ve doğrulayıcının kayıtlı kimliğini taşır.
Cüzdan doğrulayıcının güven listesindeki kaydını ve kayıt sertifikasını denetler, istenen alanları ve amacı kişiye gösterir,
kaydın izin verdiğinden fazla alan isteniyorsa uyarır. Kişi PIN ya da biyometriyle onaylar; yanıt şifreli gönderilir ve
yalnız onaylanan alanları içerir.

Doğrulayıcı kendi doğrulama yazılımını çalıştırabilir ya da Tamga Verify'ı (barındırılan doğrulayıcı) kullanabilir. Gösterme
cüzdan bağlantısıyla (aynı cihazda) ya da farklı cihazda karekodla yapılır. Tarayıcı üzerinden gösterme (Digital Credentials
API) için doğrulayıcı hazırdır; cüzdan bağlantısı henüz yoktur.

## 2.3 Yüz yüze gösterme

Kapı, kampüs girişi ya da gişe gibi yerlerde belge yakın alanda gösterilir. Kalıcı çözüm ISO/IEC 18013-5 standardının
Bluetooth yakın alan akışıdır. Bu akış kodlandı, cihaz testi bekliyor; devreye girene kadar kısa ömürlü, kapsamı sınırlı
geçiş kartları kullanılır.

## 2.4 Web sitelerine giriş

"Tamga ile giriş yap" ile bir site, kayıt sırasında yalnız izin verilen alanları (örneğin ad ve soyad) alır. Hesap anahtarı
siteye özgü bir takma addır: iki farklı site aynı kişiyi eşleştiremez. [[t:pseudonym|Takma ad]] kimlikten türetildiği için kişi telefonunu
değiştirip kimliğini yeniden doğruladığında aynı takma adlar geri gelir. Günlük giriş passkey ile yapılır ve hiçbir belge
alanı paylaşılmaz.

## 2.5 Bilet ve kapı

Bir etkinlik bileti cüzdana kişisel veri olmadan gelir. Kapıda bilet tek kullanımlıktır: ilk geçiş bileti tüketir, aynı
biletin ikinci kez kullanılması reddedilir.

## 2.6 Sıfır bilgi ispatıyla yaş doğrulama

Kişi "18 yaşından büyüğüm" bilgisini doğum tarihini ya da kimlik numarasını göstermeden kanıtlayabilir. Cüzdan, kurumun
imzaladığı belgeyi değiştirmeden bu belge hakkında bir sıfır bilgi ispatı üretir. Doğrulayıcı yalnız güven listesinde
yayınlanan ispat devrelerini kabul eder. Doğrulayıcı tarafı yayındadır. Cüzdan tarafı ağın açık ispatçı paketine bağlandı;
Android yerel kütüphanesi hazır, iOS kütüphanesi bekliyor; cihaz testi mağaza sürümüyle yapılır. İspat desteklenmediğinde
gösterme olağan yolla yapılır.

## 2.7 Kişinin denetimi

- **Geçmiş.** Kişi hangi belgeyi kime, ne zaman ve hangi alanlarla gösterdiğini cüzdanda görür. Geçmiş cihazda kalır;
  yalnız kişinin başlattığı parolalı bir dosyayla dışarı aktarılır.
- **Silme.** Kişi cüzdanı sıfırlayarak Tamga'nın kimlik servisindeki kaydını ve [[t:wallet-provider|cüzdan sağlayıcısındaki]]
  birim kaydını (cüzdanı sunan kuruluşta) ve cihazdaki bütün verisini siler.
- **Kurumdan silme talebi ve şikâyet.** Kişi bir kurumdan verilerini silmesini cüzdandan isteyebilir; doğrulayıcının
  bağlı olduğu veri koruma kurumuna şikâyet yolunu da cüzdanda görür.

## 2.8 İşlevlerin durumu

| İşlev | Durum |
|---|---|
| Kurum ve cüzdan başlatmalı belge verme, uzaktan gösterme, Tamga Verify | Yayında |
| Web sitelerine giriş, site başına takma ad | Yayında |
| Bilet ve tek kullanımlık kapı geçişi | Yayında |
| Veri silme, geçmiş, dışa aktarım | Yayında |
| Sıfır bilgi ispatı — doğrulayıcı tarafı | Yayında |
| Sıfır bilgi ispatı — cüzdan tarafı | Cüzdana bağlandı; Android yerel kütüphanesi hazır, iOS bekliyor; cihaz testi mağaza sürümüyle |
| Bluetooth yakın alan gösterme | Kodlandı; cihaz testi bekliyor |
| Tarayıcı üzerinden gösterme (Digital Credentials API) | Doğrulayıcı hazır; cüzdan bağlantısı yok |
| Donanım anahtarları ve cihaz kanıtı | Kodlandı; cihaz testi mağaza sürümüyle |
| Sandbox (herkese açık; kimlik doğrulaması günlük/aylık tavanlı) | Yayında |

---

# 3. Roller

Rol seti AB ARF'sinden alınmıştır. Her ulusal liste bu rollerin her biri için bir yer ayırır; boş kalsa da yer vardır.
Tamga'nın bugün üstlendiği devlet rolleri geçicidir ve devlet adına yürütülür.

| Rol (AB adı) | Tanım | Bugün | Devlet katıldığında |
|---|---|---|---|
| Güven listesi işletmecisi (Trusted List Scheme Operator) | Ulusal güven listesini derler, imzalar ve yayınlar | Tamga, devlet adına geçici | Ulusal otorite ya da yetkilendirdiği kurum |
| Kayıt kurumu (Registrar) | Belge verenleri, doğrulayıcıları ve cüzdan sağlayıcılarını kaydeder; yasal yetki vermez | Tamga, geçici | Devletin kayıt kurumu |
| Ulusal kök sertifika makamı | Kurum sertifikalarının köküdür | Tamga, geçici; kök kimliği devirde değişmez | Devletin kökü ya da yetkili sertifika sağlayıcısı |
| Erişim ve kayıt sertifikası sağlayıcısı | Doğrulayıcılara erişim ve kayıt sertifikası verir | Tamga, geçici | Devlet |
| Kişi kimlik verisi sağlayıcısı (PID Provider) | Kişinin kimlik verisini en yüksek güvence seviyesinde verir | Boş; Tamga bu rolü üstlenmez | Devlet |
| Geçici kimlik belgesi sağlayıcısı | PID sağlayıcısı yokken uzaktan kimlik doğrulamasıyla kimlik belgesi verir | Tamga kimlik servisi | PID sağlayıcısı devralır |
| Belge veren (Attestation Provider) | Elektronik öznitelik belgesi verir | Üniversiteler, bilet satıcıları | Kurumlar ve kamu kurumları |
| Yetkili kaynak | Bilginin asıl sahibi olan sistem | Kurumun kendi sistemi | Aynı, ayrıca kamu kaynakları |
| Cüzdan sağlayıcısı | Cüzdanı sunar; cüzdan örneği kanıtı ve anahtar kanıtı imzalar | Cüzdanı sunan kuruluş (ilki Tamga Wallet; ayrı ürün). Ağ cüzdan sağlayıcısı işletmez, listeler | Kurallara uyan her sağlayıcı |
| Doğrulayıcı (Relying Party) | Belge ister ve doğrular; kayıtlı ve kapsamı sınırlıdır | İşveren, web sitesi, kurum | Aynı |
| Aracı doğrulayıcı (Intermediary) | Bir doğrulayıcı adına belge ister ve doğrular | Tamga Verify | Aynı |
| Belge sahibi (Holder) | Belgeyi cüzdanında taşır ve kime göstereceğine karar verir | Öğrenci, mezun, kullanıcı | Vatandaş |
| Defter işletmecisi | Ortak defterin bir düğümünü işletir | Yok | En az iki bağımsız kurum |

Rol ayrımı kuralı: Tamga barındırdığı hiçbir hizmette kurumların imzalama anahtarını tutmaz. Belge verme hizmeti Tamga'da
çalışsa da belgenin imza anahtarı kuruma aittir. Her rolün ne yaptığı, yükümlülükleri ve neye ihtiyaç duyduğu **Roller**
sayfasındadır ([[FW-ROLE-0001]]).

---

# 4. Mimari

## 4.1 Bileşenler

| Bileşen | Görev | Sahibi |
|---|---|---|
| Cüzdan | Kişinin belgelerini tutar, gösterir, geçmişi ve takma adları yönetir | Cüzdanı sunan kuruluş; ağın ilk cüzdanı Tamga Wallet (ayrı ürün, açık kaynak) |
| Cüzdan sağlayıcısı | Cüzdan birimini kaydeder; cüzdan örneği kanıtı ve anahtar kanıtı imzalar | Cüzdanı sunan kuruluş; ağ işletmez, güven listesinde listeler (Tamga Wallet'ınki cüzdanın işletmecisinde, `provider.tamgawallet.com`) |
| Belge verme hizmeti | Kurumlar adına OpenID4VCI ile belge verir, iptal listeleri yayınlar | Barındırılan hizmet (kurum kendi hizmetini de çalıştırabilir) |
| Kurum Konsolu | Kurum personelinin belgeleri, kayıtları, API anahtarlarını ve kullanıcıları yönettiği ekran | Barındırılan hizmet |
| Kimlik servisi | Geçici kimlik belgesi verir; takma ad tohumunu türetir | Tamga, geçici |
| Tamga Verify | Doğrulayıcılar adına belge ister ve doğrular | Barındırılan hizmet (doğrulayıcı kendi yazılımını da çalıştırabilir) |
| Güven listesi yayıncısı | Listelerin listesini, ulusal listeyi ve çapa günlüğünü imzalar ve yayınlar | Tamga, geçici |
| Belge türü kataloğu | Belge türlerinin tanımlarını ve şemalarını değişmez dosyalar olarak yayınlar | Tamga |
| Açık kaynak paketler | Belge biçimleri, güven listesi okuma, belge verme ve doğrulama kütüphaneleri | Tamga (Apache-2.0) |
| Sandbox | Gerçek ağla aynı kurallarla çalışan tek test ağı; ayrı kökü ve listeleri vardır | Tamga |

Kütüphaneler açıktır; barındırılan hizmetler işletmecidedir. Bir kurum kendi belge verme ya da doğrulama yazılımını
paketlerle kurabilir; kurallar aynıdır.

Ağ hiçbir cüzdanın uygulamasını, cüzdan sağlayıcısını ya da sitesini işletmez; cüzdanları güven listesindeki cüzdan
sağlayıcısı kayıtlarıyla tanır. Sandbox tektir ve ağındır: cüzdan, kurum ve doğrulayıcı geliştiricileri ağın kurallarını
orada dener. Sandbox'ta da cüzdan sağlayıcısını cüzdan işletir; cüzdan geliştiricisi kendi sağlayıcısını sandbox listesine
kaydettirir ve cüzdanını sandbox'taki örnek kurumlar, kimlik servisi ve doğrulayıcıyla sınar.

## 4.2 Hizmet adresleri

| Adres | Hizmet |
|---|---|
| `tamga.network` | Tanıtım sitesi; kök anahtar parmak izleri `/trust-anchor` sayfasında |
| `arf.tamga.network` | Bu çerçeve ve ekleri |
| `docs.tamga.network` | Geliştirici belgeleri |
| `trust.tamga.network` | Güven listeleri, çapa günlüğü, arşiv |
| `schemas.tamga.network` | Belge türü kataloğu |
| `issuer.tamga.network/{kurum}` | Barındırılan belge verme hizmeti |
| `status.tamga.network` | İptal (durum) listeleri |
| `console.tamga.network` | Kurum Konsolu |
| `verify.tamga.network` | Tamga Verify |
| `id.tamga.network` | Kimlik servisi |
| `*.sandbox.tamga.network` | Sandbox: aynı hizmetlerin test kopyaları (`trust.sandbox`, `issuer.sandbox`, `verify.sandbox`, `id.sandbox` …) |

Ağın alan adlarında yalnız ağın hizmetleri çalışır; ağ cüzdan sağlayıcı işletmez. Her cüzdanın sağlayıcısını cüzdanı sunan
kuruluş kendi alan adında işletir (Tamga Wallet'ınki `provider.tamgawallet.com`); ağ onu güven listesinde listeler.

Alan adı bir hizmetin adresidir, kimlik değildir. Bir kurum kendi alan adına geçtiğinde kaydındaki adres değişir; kurumun
kimliği ve verdiği belgeler değişmez.

## 4.3 Belge verme akışı

1. Kurum teklif oluşturur ya da kişi cüzdandan belge ister.
2. Cüzdan yetki ister; gerekirse işlem kodunu ya da kimlik belgesi sunumunu ekler.
3. Cüzdan, belgenin bağlanacağı anahtarları, cüzdan örneği kanıtını ve anahtar kanıtını gönderir.
4. Belge verme hizmeti bu kanıtları güven listesine karşı, belge içeriğini katalogdaki şemaya karşı denetler, belgeyi
   kurumun anahtarıyla imzalar ve her kopyaya iptal listesinde bir yer ayırır.
5. Kişiye "belgeniz bir cüzdana eklendi; siz değilseniz bildirin" bildirimi gider.

## 4.4 Gösterme ve doğrulama akışı

1. Doğrulayıcı imzalı bir istek oluşturur; istek doğrulayıcının kayıtlı kimliğini, istenen alanları ve tek kullanımlık bir
   değeri taşır.
2. Cüzdan doğrulayıcının kaydını denetler, kişiye gösterir ve onay alır.
3. Cüzdan, belgenin bu doğrulayıcıya ait kopyasını, bu isteğe bağlı bir cihaz imzasıyla gönderir.
4. Doğrulayıcı aşağıdaki doğrulama hattını çalıştırır ve üç sonuçtan birini verir: kabul, red ya da "şu an doğrulanamadı".

| Adım | Denetim |
|---|---|
| Ön koşul | Güven listesi taze mi; değilse sonuç "doğrulanamadı" |
| Yapı | İmza zinciri kök sertifikaya ulaşıyor mu, açıklanan alanlar belgeyle eşleşiyor mu, cihaz imzası bu isteğe mi ait |
| Tür | Belge türü katalogdaki tanımla ve şemayla eşleşiyor mu |
| Güven | Kurum belgenin verildiği tarihte listede etkin miydi, bu türü vermeye yetkili miydi |
| Durum | Belge iptal edilmiş ya da askıya alınmış mı |
| Politika | Belge türü ve kurum sınıfı doğrulayıcının politikasına uyuyor mu, istenen alanlar kaydının kapsamında mı |

"Şu an doğrulanamadı" sonucu hiçbir zaman "geçersiz" ile aynı gösterilmez. Kurumun belge verme yetkisi, belgenin verildiği
tarihe göre değerlendirilir: kapanan bir kurumun daha önce verdiği belgeler geçerli kalır.

## 4.5 Yön kuralları

1. Güven listelerine yalnız güven listesi yayıncısı yazar; belge verme hizmetleri yalnız çapa isteği gönderir.
2. Doğrulayıcılar ve cüzdanlar güven verisini şartnamedeki doğrulama kurallarına uygun okur: imzayı, sürüm zincirini ve tazeliği
   denetlemeden hiçbir liste kaydını kullanmaz. Açık kaynak paketler bu kuralları hazır uygular.
3. Doğrulayıcı her doğrulamada iptal listesini indirmez; listeler önceden toplu çekilir.
4. Hiçbir Tamga hizmeti IP adresi kaydetmez; kayıtlarda belge alanlarının değeri ve [[t:status-list]] konumu yer almaz.

---

# 5. Veri modeli

## 5.1 Belge biçimleri

| Biçim | Kullanım |
|---|---|
| SD-JWT VC | Bütün belge türleri. Selective disclosure, cihaz anahtarına bağlama, iptal listesi atfı |
| ISO/IEC 18013-5 mdoc | Kimlik belgesinin ikinci temsili; yakın alan gösterme ve sıfır bilgi ispatı için |

İmza algoritması ES256 (P-256) ve kurum sertifika zinciri belgeyle birlikte taşınır. Her belge cihazdaki bir anahtara
bağlıdır; gösterme sırasında bu anahtarla imzalanmış bir bağlama kanıtı zorunludur. Kopyalar ayrı anahtarlara bağlanır.
Ulusal kimlik numarası, kimlik belgesi dışındaki hiçbir belge türünde bulunmaz.

## 5.2 Belge türleri ve katalog

Her belge türünün kalıcı bir kimliği vardır (`urn:tamga:<alan>:<Tür>:<ana sürüm>`). Türün görünen adları, alanları ve
[[t:selective-disclosure]] politikası tür tanımında (Type Metadata), veri kuralları JSON Schema'dadır. Yayınlanan tanım dosyaları
değişmez; belge, tanımın özetini taşır ve doğrulayıcı katalogla karşılaştırır.

Bugünkü türler: öğrenci belgesi, diploma, Tamga kimlik belgesi, e-posta ve telefon belgesi, etkinlik bileti, takma ad
tohumu (yalnız cüzdanda kalır, hiçbir doğrulayıcıya gösterilmez).

## 5.3 Tanımlayıcılar

| Tanımlayıcı | Nasıl oluşur | Ne zaman değişir |
|---|---|---|
| Kök sertifika kimliği | Ülke kodu ve kök sertifika parmak izinden | Kök değişirse |
| Kurum kimliği | Ülke kodu ve kurum sertifikası parmak izinden | Sertifika yenilenince; yeni kayıt eskisine halef olarak bağlanır |
| Belge türü kimliği | `urn:tamga:…` | Yalnız ana sürüm değişince |
| Doğrulayıcı istemci kimliği | Erişim sertifikasının özeti (`x509_hash`) | Sertifika yenilenince |
| Doğrulayıcı kalıcı kaydı | Alan adı (`dns_name`) | Değişmez; takma adlar ve kopyalar buna bağlıdır |
| Kişi | Küresel kimlik yok; belge başına cihaz anahtarı, doğrulayıcı başına kopya, site başına takma ad | — |

## 5.4 İptal ve durum

Belge durumu IETF Token Status List ile yayınlanır. Liste adresleri kurumu, yılı ya da öğrenci grubunu ele vermez; bir
belgenin listedeki yeri rastgeledir. Listeler sabit aralıklarla, değişiklik olmasa da yayınlanır; böylece iptal anı dışarı
sızmaz. Yayın aralığı 2 dakikadır; bir iptal, yayın aralığı ile doğrulayıcının ön çekim aralığı toplamı kadar sürede (birkaç
dakika) doğrulayıcılarda etkili olur. Her liste 6 saat geçerlidir: durum sunucusu kesintiye uğrarsa doğrulayıcı son listeyle bu
süre boyunca doğrulamaya devam edebilir. Sıfır bilgi ispatıyla sunumda iptal listesi indeksi açılmaz; bu sunum için kısa ömürlü
kopyalar kullanılır (§7.4 L5).

---

# 6. Güven modeli

## 6.1 Listelerin listesi ve ülke listeleri

Güven, imzalı listelerden gelir. Yapı AB'ninkiyle aynıdır:

- **Listelerin listesi** her ülke listesinin adresini, imzacısını ve tanınma durumunu gösterir. Ağ düzeyindeki ortak
  belge türleri, tanınan cüzdan sağlayıcıları ve kabul edilen sıfır bilgi ispatı devreleri de buradadır.
- **Ülke listesi** o ülkenin kök sertifikalarını, belge verenlerini (sınıfları, güvence seviyeleri ve hangi türleri
  vermeye yetkili oldukları) ve kayıtlı doğrulayıcılarını taşır.

Cüzdanlar ve doğrulayıcılar tek bir şeye güvenir: listelerin listesini imzalayan kök anahtara. Kök anahtar parmak izleri
`tamga.network/trust-anchor` sayfasında, güven listesi sitesinde ve katılım sözleşmelerinde aynı değerlerle yayınlanır.

## 6.2 Federasyon

Tamga Network bir ülke listesinin sahibi olmak zorunda değildir. Bugün Türkiye listesini Tamga devlet adına geçici olarak
yayınlar. Bir devlet ya da devletin yetkilendirdiği kurum kendi listesini yayınladığında, listelerin listesi o listenin
adresini ve imzacısını gösterir. Cüzdan ve doğrulayıcı için yalnız adres ve imzacı değişir; kurum kimlikleri, belge
türleri ve belgeler aynı kalır. Aynı yol bütün Türk devletleri için geçerlidir. AB ile karşılıklı tanıma da aynı
mekanizmayla, kapsamı belge türüne göre sınırlanarak yapılır.

Başkasının işlettiği bir liste listelerin listesinde adresi, sabitlenmiş imzacısı, kapsamı ve onay kaydıyla gösterilir. Liste
yalnız kapsamındaki roller ve belge türleri için kefil olabilir; imzacısı eşleşmeyen liste yüklenmez. Her dış listenin tazeliği
ayrı izlenir: biri denetlenemese bile diğer listeler etkilenmez. Hangi dış listeye güvenileceğine her liste için ayrıca karar
verilir. Kurallar Ek A'dadır.

## 6.3 Liste kuralları

- Listeler sürümlüdür ve bir önceki sürümün özetini taşır; kayıt silinmez, durum değişiklikleri geçmişe eklenir.
- Bir sonraki güncelleme en geç 90 gün sonradır; değişiklik en geç 24 saatte yayınlanır.
- Liste en az iki kaydırmalı sertifikayla imzalanır.
- Saatlik imzalanan bir çapa günlüğü, iptal listesi yayınlarını ve belge türü tanımlarının özetlerini kaydeder.
- Herkese açık bir değişiklik günlüğü kimin, ne zaman, neyi değiştirdiğini gösterir.

## 6.4 Kayıt

- **Belge verenler** katılım kapılarından geçer (Ek A): kayıtlı, sözleşmeli ve akredite seviyeleri. Her belge türü için
  ayrı yetki verilir; yetki varsayılan olarak kapalıdır.
- **Doğrulayıcılar** AB'nin ortak kayıt veri setiyle başvurur: unvan, kimlik numarası, adres, iletişim, her kullanım için
  amaç ve gizlilik politikası, veri koruma kurumu. Yalnız tüzel kişiler kaydolur. Kayıt kurumu her kullanım için en çok 12 ay
  geçerli bir [[t:registration-certificate]] üretir; cüzdan istenen alanları bu sertifikayla karşılaştırır.
- **Cüzdan sağlayıcıları** cüzdan çözümlerini (platformlar, güvenlik seviyesi, PIN ve biyometri, yedekleme modeli) beyan
  eder ve uyum testlerini geçer. Tamga Network bir cüzdanı adına göre değil, yayınlanmış kurallara göre tanır.

## 6.5 Güvence seviyeleri

| Eksen | Seviyeler | Nerede görünür |
|---|---|---|
| Kişinin kimlik doğrulaması | T0 anonim · T1 düşük · T2 önemli · T3 yüksek (eIDAS Low / Substantial / High) | Belgede değil; belge türünün ön koşuludur |
| Belge verenin akreditasyonu | I1 kayıtlı · I2 sözleşmeli · I3 akredite · PUB kamu | Güven listesinde; nitelikli ve kamu belgelerinde ayrıca belgede |
| Cüzdan güvenliği | W1 yazılım (desteklenmez) · W2 cihazın güvenli bölgesi · W3 sertifikalı güvenli eleman | Cüzdan kanıtında |

Doğrulayıcının kararı belge türü ile [[t:issuer|belge verenin]] sınıfının birleşimine dayanır; ayrı bir "kişi güvence seviyesi" alanı yoktur.

## 6.6 Bilinen sınır

Bugün güvenin çapası tek işletmecinin imzasıdır. İşletmeci ile bir belge veren birlikte hareket ederse listede tutarsız
kayıt yayınlanabilir; herkese açık günlük, şeffaflık raporu ve denetim bunu caydırır ama imkânsız kılmaz. Bu sınır ortak
defterle ve birden çok bağımsız imzacıyla kalkar.

---

# 7. Sertifikasyon, güvenlik ve risk

## 7.1 Cüzdan güvenliği

Cüzdan birimi ([[t:wallet-unit]]) cüzdan sağlayıcısına kaydolur. Her işlem için en çok 24 saat geçerli bir cüzdan örneği kanıtı
(WIA) ve belgelerin anahtarlarını anlatan ayrı bir anahtar kanıtı ([[t:key-attestation]], KA) alır. Belge veren, belge vermeden önce
bu kanıtları güven listesindeki sağlayıcıya karşı denetler. Anahtarlar cihazın güvenli bölgesinde tutulur ve cihaz kanıtıyla
(Apple App Attest, Android key attestation) desteklenir. Yazılım anahtarlı cüzdana belge verilmez.

## 7.2 Mahremiyet önlemleri

1. Ortak kayıtlarda kişisel veri yoktur; kayıtlarda alan değerleri ve iptal listesi konumu yer almaz.
2. Belgeler kopyalar hâlinde verilir ve her doğrulayıcıya ayrı kopya gösterilir; siteler takma adla tanınır.
3. Sıfır bilgi ispatı, aynı belgenin farklı gösterimlerinin birbirine bağlanmasını engeller.
4. İptal listeleri sabit aralıkla yayınlanır; iptal anı sızmaz.
5. Her gösterme PIN ya da biyometri ister; aşırı talep kişiye gösterilir.
6. Kimlik doğrulamada belge ve yüz görüntüleri Tamga'da saklanmaz.
7. Kullanım istatistikleri yalnız toplu ve en az 50'lik gruplar hâlinde yayınlanır.

## 7.3 Uyum ve sertifikasyon

Bugün uyum, açık uyum test vektörleri ve yayın öncesi zorunlu testlerle gösterilir. Devletler katıldığında bağımsız uygunluk
değerlendirme kuruluşları ve ulusal sertifikasyon gelir. Rol başına neyin test edildiği ve nasıl gösterildiği Ek A §4.3'tedir. AB ile birlikte çalışabilirlik, AB'nin birlikte
çalışabilirlik etkinliklerinde ve OpenID uyum testleriyle gösterilir.

## 7.4 Bilinen sınırlar ve artık riskler

| # | Sınır |
|---|---|
| L1 | Güven çapası bugün tek işletmecinin imzasına dayanır (§6.6). |
| L2 | Bir iptal, durum sunucusu çalışırken birkaç dakikada etkili olur (yayın aralığı 2 dakika + doğrulayıcının ön çekim aralığı). |
| L3 | Aynı belge verenin belgeleri farklı doğrulayıcılarda birleştirilirse kişi eşleştirilebilir; sıfır bilgi ispatı bu riski kaldırır. |
| L4 | Cihaz değişiminde belgeler yeniden alınır; onaylı devir tasarımı açıktır. |
| L5 | Sıfır bilgi ispatıyla sunulan kimlik belgesinin iptali sunumda denetlenemez. Karar: bu sunum yalnız en çok 24 saat geçerli, sessizce yenilenen kısa ömürlü kopyalarla yapılır; iptal edilen belgenin kopyası yenilenmez (AB ARF'nin kısa ömürlü belge yolu). İptal ZK sunumunda en geç 24 saatte etkili olur; ispat kopyanın türünü bağladığı için doğrulayıcı kısa ömrü görür. Kısa ömürlü kopya kullanmayan ZK sunumu, doğrulayıcı politikası bu riski açıkça kabul etmedikçe DOĞRULANAMADI sayılır. |

---

# 8. Yönetişim ve evrim

## 8.1 Aşamalar

| Aşama | Güven çapası | Kim yönetir | Geçiş koşulu |
|---|---|---|---|
| Liste aşaması (bugün) | İmzalı listeler ve çapa günlüğü | Tamga, geçici işletmeci | — |
| Defter aşaması | Ortak defter | İlk işletmeciler | En az iki bağımsız işletmecinin yazılı kabulü; eşdeğerlik testleri |
| Devlet katılımı | Ortak defter | Üye devletlerin konseyi (üçte iki) | İlk devlet işletmecisinin üretime geçmesi |
| Kurumsal genişleme | Ortak defter | Konsey | Konseyin belirlediği eşikler |

## 8.2 Ortak deftere geçiş

Liste arşivi ortak deftere aynen aktarılır. Liste ve defter aynı uyum testlerine aynı cevabı verir. Kurum kimlikleri, belge
türleri ve belgeler değişmez; devirde yalnız işletmeci değişir. Cüzdan ve doğrulayıcı yalnız güven kaynağının
uygulamasını değiştirir.

## 8.3 Yönetişim kurumu

Yönetişim kurumu ilk günden kurulmaz. Bir ya da iki devlet katılmaya istekli olduğunda konsey ya da vakıf kurulur ve
listeler devredilir. O zamana kadar Tamga geçici işletmecidir; vakıf kurulduğunda işletmecilik ona devredilir. Tamga Network
kâr amacı gütmez; işletmecilik ileride bir vakfa devredilir. Ağ hiçbir
ürün satmaz ve ticari hizmet sunmaz; Tamga Wallet ağın ilk cüzdanıdır; bir şirketin ayrı ürünüdür; hizmet sağlayıcılar ağın dışındadır ve kayıt sürecine
herkes gibi aynı koşullarla katılır ([[ADR-0037]]).

## 8.4 Standart uyum haritası

| Alan | Standart |
|---|---|
| Güven listeleri | ETSI TS 119 612, ETSI TS 119 602 |
| Kurum kimliği | X.509 (RFC 5280), ETSI EN 319 401 |
| Belge veren politikası | ETSI TS 119 471 |
| Belge biçimi | IETF SD-JWT VC, ETSI TS 119 472-1, ISO/IEC 18013-5 |
| Belge verme | OpenID4VCI 1.0, HAIP 1.0, ETSI TS 119 472-3 |
| Gösterme | OpenID4VP 1.0, DCQL, HAIP 1.0, ISO/IEC 18013-7, W3C Digital Credentials API |
| Yakın alan | ISO/IEC 18013-5 (Bluetooth) |
| İptal | IETF Token Status List |
| Kimlik doğrulama | ETSI TS 119 461 |
| Kayıt ve kayıt sertifikası | AB Uygulama Tüzüğü (CIR) 2025/848, ETSI TS 119 475 |
| Sıfır bilgi ispatı | Longfellow ZK (mdoc) |
| Eğitim anlamı | ELM 3 / Europass, ISCED-F, EQF |

Kaynakların tam listesi Ek E'dedir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

