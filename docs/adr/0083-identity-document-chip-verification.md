---
document_id: ADR-0083
title: "Kimlik belgesinin çipini kimlik servisi doğrular; cüzdan yalnız okuyucudur, yüz ve canlılık sağlayıcıda kalır"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-13
last_updated: 2026-11-13
summary: >
  Bugün kimlik servisi kişiyi tamamen bir dış uzaktan kimlik doğrulama sağlayıcısına doğrulatıyor (belge fotoğrafı, canlılık,
  yüz eşleştirme). Karar: kimlik kartı ya da pasaport çipi kişinin telefonunda, akışı başlatan cüzdanda NFC ile okunur; cüzdan
  çipten okuduğu ham veriyi değiştirmeden kimlik servisine iletir; devletin imzasını (ICAO 9303 pasif doğrulama) ve çipin kopya
  olmadığını (etkin doğrulama ya da çip doğrulama, sunucunun ürettiği tek kullanımlık sınamayla) kimlik servisi kendisi doğrular.
  Yüz eşleştirme ve canlılık bir sağlayıcıda kalır ve çipteki fotoğrafla karşılaştırılır; mevcut sağlayıcıyla başlanır, sağlayıcı
  bir bağdaştırıcının arkasındadır ve değiştirilebilir. Kimlik belgesinin alanları çipten gelir; belge fotoğrafı yolu çipsiz
  belgeler için yedek kalır. Ad ve kod değişmez (`document_chip_verified`, `verification_method: remote-nfc-liveness-face` zaten
  tanımlı). IDP3 daraltılır: cüzdan sağlayıcıyla hâlâ konuşmaz, ama çipi okuyup ham veriyi kimlik servisine iletebilir; karar
  vermez. Açılış koşulu: hukuki görüş (Türkiye için kimlik kartı yönetmeliğinin biyometrik veri hükmü ve kişisel verilerin
  korunması kanununun biyometrik veri ve yurt dışına aktarım hükümleri) olumlu gelmeden çip yolu ne sandbox'ta ne gerçek ağda
  açılır; kodu (2026-11-13 değişikliğiyle) şimdi yazılır ama varsayılanı kapalı bir anahtarın arkasında durur ve yalnız yerel
  testlerde sahte belge verisiyle çalışır. Güvenli e-imza / mobil imza yolu bu kararın sonraki adımıdır.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0022]]", "[[ADR-0040]]", "[[ADR-0042]]", "[[ADR-0080]]", "[[SPEC-ID-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
---

# Kısaca

Kimlik kartlarının ve pasaportların içinde bir çip vardır. Çipte kişinin adı, doğum tarihi ve fotoğrafı, devletin imzasıyla
birlikte durur. Telefon bu çipi NFC ile okuyabilir. Bu kararla Tamga kimlik belgesi verirken bilgileri belgenin fotoğrafından
değil çipten alır ve devletin imzasını kendisi kontrol eder. Kişinin gerçekten o belgenin sahibi olduğunu göstermek için yüz ve
canlılık kontrolü yine bir dış sağlayıcıda yapılır: canlı yüz, çipteki fotoğrafla karşılaştırılır. Böylece bilgilerin doğruluğu
sağlayıcının yazılımına değil devletin imzasına dayanır, sağlayıcı yalnız yüz kısmı için gerekir ve değiştirilebilir. Çipi
olmayan belgeler için bugünkü fotoğraf yolu kalır. Karar kabul edildi; ama çipteki fotoğrafın işlenmesi hukuki bir soru taşıdığı
için çip yolu, hukuki görüş olumlu geldikten sonra açılır. Görüş geldiğinde yazılımın hazır olması için kod şimdi yazılır, ama
her yerde kapalı durur: yalnız yerel testlerde, sahte belge verisiyle çalışır.

# Bağlam

- **Bugün.** Kimlik servisi ([[ADR-0011]]) kişiyi bir uzaktan kimlik doğrulama sağlayıcısına yönlendirir; sağlayıcı belge
  fotoğrafını okur, canlılığı ve yüzü denetler, "onaylandı" der. Kimlik belgesindeki alanlar sağlayıcının okuduğu değerlerdir.
  Kimlik servisi bu kararı doğrulayamaz; yalnız sağlayıcıya güvenir. Sınıf: nitelikli olmayan EAA, I2 ([[ADR-0022]]).
- **Sağlayıcıya bağımlılık.** Sağlayıcının ücretsiz kotası kalktı; her doğrulama ücretlidir. Bu tek başına büyük bir maliyet
  değildir (aşağıda), ama kimlik doğrulamanın bütün güvencesi tek bir sağlayıcının yazılımına ve fiyat politikasına bağlıdır.
- **AB'de PID nasıl verilir.** AB'de kişi kimlik verisini (PID) bir üye devletin eID düzeni içindeki PID sağlayıcısı verir;
  cüzdan kullanıcısı yüksek güvence düzeyinin kayıt kurallarına göre kaydedilir (Uygulama Tüzüğü (AB) 2024/2977 md. 3).
  Uzaktan kayıt için Uygulama Tüzüğü (AB) 2026/798 (yürürlük 2026-04-28) ETSI TS 119 461 V2.1.1'e dayanır ve fiziksel belgeyle
  yapılan uzaktan kayıtta belgedeki yüz fotoğrafının **NFC ile çipten alınmasını** ve çipin pasif ya da etkin doğrulamasını
  ister. ETSI TS 119 461'de tam otomatik "belge + yüz" yolu çipli belge ister; genişletilmiş düzey ayrıca laboratuvarda
  sınanmış sunum saldırısı tespiti ve görüntü enjeksiyonu tespiti (CEN/TS 18099) ister. AB ülke cüzdanları PID'i çoğunlukla
  ulusal elektronik kimlikle (çip + PIN) verir. Belge fotoğrafı + özçekim bu düzeye yetmez.
- **Tamga'nın durumu.** Tamga PID vermez ve vermeyecektir (TL8). Kimlik belgesi geçici bir EAA'dır; devlet PID'i gelince yerini
  ona bırakır ([[ADR-0011]] K1). Ama kimlik belgesi bugün ağdaki bütün kurum belgelerinin dayandığı kimlik eşleştirmesinin
  temelidir; ne kadar güçlü olursa ağın geri kalanı o kadar güvenilir olur.
- **Önceden düşünülmüştü.** [[ADR-0011]] çip okumayı "ileride" diye öngördü; `document_chip_verified` ve
  `verification_method: remote-nfc-liveness-face` şemada vardır. Açık kalan soru, çipi kimin okuyacağı ve kimin doğrulayacağıdır.
- **Tarayıcı çipi okuyamaz.** Kimlik kartı çipi tarayıcıdan okunamaz; telefonda yerel uygulama gerekir. Bu yüzden çip okuma ya
  sağlayıcının telefon uygulamasına gömülen bileşeniyle ya da cüzdanın kendisiyle yapılabilir.
- **Bağlantı iletme saldırısı ([[ADR-0080]]).** Doğrulama bağlantısı başka birine iletilebiliyordu. Çip, akışı başlatan
  telefonda okunursa saldırgan kurbanın kartını fiziksel olarak kendi telefonuna dokundurmak zorunda kalır; uzaktan iletilen
  bağlantıyla saldırı yapılamaz hâle gelir.
- **Hukuki soru.** Türkiye'de kimlik kartının elektronik doğrulamasını düzenleyen yönetmelik (Elektronik Kimlik Doğrulama
  Sistemi Yönetmeliği md. 21(3)) biyometrik verilerin toplanamayacağını, saklanamayacağını ve paylaşılamayacağını söyler. Çipteki
  yüz fotoğrafının yalnız anlık eşleştirme için okunmasının bu hükme girip girmediği açık değildir. Biyometrik veri ayrıca
  6698 sayılı Kişisel Verilerin Korunması Kanunu'na göre özel nitelikli kişisel veridir (md. 6) ve yurt dışındaki bir
  sağlayıcıya gönderilmesi yurt dışına aktarımdır (md. 9).

# Karar

- **K1 — Çip yolu.** Kimlik servisi iki yol sunar: (a) **çip yolu** — belge çipi akışı başlatan cüzdanda NFC ile okunur, yüz ve
  canlılık sağlayıcıda denetlenir; (b) **belge fotoğrafı yolu** — bugünkü yol, çipsiz belgeler ve NFC'si olmayan telefonlar için
  yedek. Çipli belgesi ve uygun telefonu olan kişiye önce çip yolu önerilir.
- **K2 — Cüzdan yalnız okuyucudur.** Cüzdan çipten ICAO 9303 veri gruplarını (en az DG1 kişi bilgisi, DG2 fotoğraf, belge
  güvenlik nesnesi SOD; varsa DG14 ve DG15) okur ve **değiştirmeden** kimlik servisine iletir. Cüzdan çip verisini yorumlamaz,
  karar vermez, saklamaz, günlüğe yazmaz. Çipe erişim anahtarı (belgenin üzerindeki MRZ ya da CAN) yalnız telefonda kullanılır,
  kimlik servisine gönderilmez.
- **K3 — Doğrulamayı kimlik servisi yapar.** Kimlik servisi sunucuda: (1) **pasif doğrulama** — SOD imzasını belge imzalayan
  sertifikayla, onu da ilgili devletin kök sertifikasıyla (CSCA) doğrular; veri gruplarının özetlerini SOD'daki değerlerle
  karşılaştırır; (2) **kopya denetimi** — çip destekliyorsa etkin doğrulama (AA) ya da çip doğrulama (CA); AA'da sınamayı
  kimlik servisi üretir, tek kullanımlıktır ve akışa bağlıdır. Telefonda yapılan doğrulama sonucu kabul edilmez; sunucu ham
  veriyi kendisi doğrular.
- **K4 — Kök sertifikalar.** Kimlik servisi her devletin CSCA sertifikalarını kamuya açık, imzalı ana listelerden alır; listede
  hangi devletin kökünün olduğu ve nereden alındığı işletmecinin yapılandırma belgesinde yazılıdır. Kökü bulunmayan devletin
  belgesi çip yolundan geçmez, fotoğraf yoluna düşer.
- **K5 — `document_chip_verified` anlamı daralır.** `true` yalnız şu üçü birlikte sağlanınca yazılır: pasif doğrulama başarılı,
  kopya denetimi (AA ya da CA) başarılı, canlı yüz DG2 fotoğrafıyla eşleşti. Pasif doğrulama geçip çip kopya denetimini
  desteklemiyorsa belge yine çipten gelen verilerle verilebilir ama `document_chip_verified: false` olur ve
  `verification_method` `remote-document-liveness-face` kalır. Alan adları ve şema değişmez.
- **K6 — Yüz ve canlılık sağlayıcıda kalır; sağlayıcı değiştirilebilir.** Canlılık denetimi ve yüz eşleştirme, kanıtlanmış sunum
  saldırısı (ISO/IEC 30107-3) ve görüntü enjeksiyonu sınamaları olan bir sağlayıcıdan alınır; kimlik servisi bunu kendi yazmaz.
  Canlılık sağlayıcının tarayıcı akışında yapılır (cüzdan sağlayıcıyla konuşmaz); canlı yüz, çipteki DG2 fotoğrafıyla
  karşılaştırılır. **Bugünkü uzaktan kimlik doğrulama sağlayıcısıyla başlanır** (yalnız canlılık ve yüz eşleştirme parçası).
  Sağlayıcı kimlik servisinde bir bağdaştırıcının arkasındadır: sağlayıcıya özgü kod ve ayar bağdaştırıcının dışına çıkmaz,
  kimlik belgesine, güven listesine ve cüzdana sağlayıcıya özgü bir değer girmez. Sağlayıcının değiştirilmesi kararı değiştirmez;
  aydınlatma metni ve veri işleme sözleşmesi yenilenir.
- **K7 — Saklama.** Çip verisi, DG2 fotoğrafı ve sağlayıcıya giden yüz görüntüsü kimlik servisinde yalnız belge verme anına kadar
  bellekte tutulur ve sonra silinir (IDP4, IDP9 aynen). Kalıcı kayda yalnız belge numarasının anahtarlı özeti, çip yolu kullanıldı
  bilgisi ve doğrulama sonuçları (geçti/kaldı) girer; ham veri girmez.
- **K8 — Ülke başına açılış.** Çip yolu bir ülkenin belgesi için gerçek ağda ancak (a) o ülkenin kök sertifikası güvenilir bir
  kaynaktan alınmış ve (b) o ülkenin hukukunda özel bir kuruluşun kimlik çipini kişinin rızasıyla okumasının ve biyometrik verinin
  işlenmesinin hukuki incelemesi olumlu sonuçlanmışsa açılır. Hukuki görüş olumlu geldikten sonra (K11) sandbox'ta sahte
  belgeyle denenebilir; o güne kadar kod yalnız yerel testlerde çalışır.
- **K9 — IDP3 daraltılır.** Yeni metin: "IDV sağlayıcı entegrasyonu yalnızca Tamga kimlik servisindedir; kurumların belge verme
  servisleri, cüzdan ve doğrulayıcı sağlayıcıyla konuşmaz. Cüzdan, akışı başlatan cihazda belge çipini okuyup ham veriyi
  değiştirmeden kimlik servisine iletebilir ([[ADR-0083]]); çip verisini doğrulamaz ve kimlik doğrulama kararı vermez."
- **K10 — Açık arayüz.** Çip verisinin kimlik servisine iletilmesi [[SPEC-ID-0003]]'te açık bir arayüz olarak tanımlanır; ağın
  listelediği her uyumlu cüzdan uygulayabilir ([[ADR-0042]]: ağ cüzdan işletmez, tek bir cüzdana ayrıcalık tanınmaz). Arayüzün
  ayrıntısı (uç, alan ve hata adları) uygulama sırasında onaylanır.
- **K11 — Açılış koşulu: önce hukuki görüş; kod kapalı anahtarın arkasında** (2026-11-13 değişikliğiyle; aşağıdaki
  "Değişiklik" bölümü). Çip yolunun kodu (kimlik servisi, cüzdan çekirdeği, cüzdan uygulaması) yazılabilir ve birleştirilebilir;
  varsayılanı kapalı bir anahtarın arkasında durur. Kimlik servisi anahtar açıkken sunucuda (gerçek ağ ve sandbox) çalışmayı
  reddeder. Cüzdanın mağaza derlemelerinde çip okuma ve NFC izinleri bulunmaz. Kod yalnız yerel testlerde, testte üretilen bir
  kök sertifikayla imzalanmış sahte belge verisiyle (ve kişiye ait olmayan boş test kartıyla) çalışır; gerçek bir kişinin
  belgesi okunmaz, gönderilmez, işlenmez. Hukuki görüş olumlu gelmeden çip yolu ne sandbox'ta ne gerçek ağda açılır. Türkiye
  için görüşün konusu: (a) Elektronik Kimlik Doğrulama Sistemi Yönetmeliği md. 21(3) — çipteki yüz fotoğrafının okunup yalnız
  anlık eşleştirme için kullanılması bu hükme girer mi, kişinin kendi kartını kendi telefonuyla okutması ayrı bir izin
  gerektirir mi; (b) 6698 sayılı Kanun md. 6 (biyometrik veri, açık rıza) ve md. 9 (yurt dışındaki sağlayıcıya aktarım); (c)
  çipten okunan kimlik numarasının yalnız kimlik belgesine yazılmasının ayrı bir yükümlülük doğurup doğurmadığı. Görüş olumsuzsa
  ya da koşul getirirse karar yeni bir ADR ile ele alınır; kapalı kod buna göre değişir ya da kaldırılır. Bugünkü belge
  fotoğrafı yolu bu süre içinde aynen çalışır.
- **K12 — Güvenli e-imza / mobil imza yolu sonraki adımdır.** Kişinin güvenli elektronik imza ya da mobil imza sertifikasıyla
  kimlik göstermesi ([[SPEC-ID-0003]] T3, IDP7) çip yolundan sonra ele alınır; ayrı bir ADR ile karara bağlanır. Bu karar o yolu
  ne açar ne kapatır.

# Kabulle karara bağlananlar

Taslaktaki dört açık nokta kabulle şöyle kapandı:

1. **İlk belgeler.** Hukuki görüş gelene kadar çip yolu hiçbir belge için açılmaz (K11); ilk açılacak belgeler (Türkiye kimlik
   kartı ve pasaportu görüşün konusudur) görüşle birlikte belirlenir ve K8'e göre ülke başına açılır.
2. **Yüz ve canlılık sağlayıcısı.** Bugünkü sağlayıcının canlılık ve yüz eşleştirme parçasıyla başlanır; sağlayıcı değiştirilebilir
   biçimde kurulur (K6).
3. **Kopya denetimini desteklemeyen çipler.** K5'teki gibi: belge çipten gelen verilerle verilir, `document_chip_verified: false`.
4. **Platform sırası (iOS / Android).** Uygulama sırasında belirlenir; kararın içeriğini değiştirmez.

# Değişiklik (2026-11-13, proje yönetimi)

Kabulden sonra aynı gün proje yönetimi K11 ve CV7'yi değiştirdi: hukuki görüş geldiğinde yazılımın hazır olması için çip
yolunun kodu **şimdi yazılır, ama her yerde kapalı durur**. Açılış koşulu (hukuki görüş) ve görüşün konusu ((a)–(c)) aynen
kalır. Sürüm 1.0.0 kalır.

- **Önce:** "Çip yolunun kodu hukuki görüş olumlu gelmeden yazılmaz."
- **Şimdi (K11, CV7):** kod yazılabilir ve birleştirilebilir; varsayılanı kapalı bir anahtarın arkasındadır. Kimlik servisi
  anahtar açıkken sunucuda (gerçek ağ ve sandbox) çalışmayı reddeder; cüzdanın mağaza derlemelerinde çip okuma ve NFC izinleri
  bulunmaz; kod yalnız yerel testlerde, testte üretilen bir kök sertifikayla imzalanmış sahte belge verisiyle (ve kişiye ait
  olmayan boş test kartıyla) çalışır. Gerçek bir kişinin belgesi okunmaz, gönderilmez, işlenmez. Görüş olumsuzsa ya da koşul
  getirirse kapalı kod yeni ADR'ye göre değişir ya da kaldırılır.

Aynı onayla uygulamanın ilk sürümü için şunlar belirlendi:

5. **Kopya denetimi ilk sürümde yalnız AA.** İlk sürümde kopya denetimi etkin doğrulamayla (AA) yapılır; çip doğrulama (CA)
   sonraki adımdır. Bu sürede yalnız CA destekleyen çip K5'teki gibi `document_chip_verified: false` ile işlenir.
6. **DG11 yoksa çip yolu kapanır.** Kimlik belgesindeki ad ve soyadın tam yazımı (Türkçe karakterlerle) çipteki DG11'den
   alınır; MRZ'deki Türkçe karaktersiz ad belgeye yazılmaz. Çipte DG11 yoksa o belge için çip yolu kapanır ve belge fotoğrafı
   yoluna düşülür.
7. **Yüz eşleştirmede referans görüntü.** Yüz eşleştirme, mevcut sağlayıcının biyometrik doğrulama iş akışında çipteki DG2
   fotoğrafının referans görüntü olarak verilmesiyle yapılır (oturum açılırken referans portre, base64, en çok 2 MB; sağlayıcının
   belgelerinde doğrulandı). Sağlayıcıya özgü bu ayrıntı bağdaştırıcının içinde kalır (K6, CV6).
8. **Arayüz adları** (K10): kimlik servisi uçları `/chip/read`, `/chip/submit`, `/chip/continue`; cüzdanın çip okuyabildiğini
   bildiren PAR alanı `chip_reader` (değer `icao9303`). Akışın ayrıntısı [[SPEC-ID-0003]]'e uygulamayla yazılır.

# Gerekçe

- **Güvence devletin imzasına dayanır.** Fotoğraftan okunan alanlar yazılımın tahminidir; çipten okunan alanlar devletin imzalı
  verisidir ve kimlik servisi bunu kendisi doğrulayabilir. Bu, AB'de uzaktan kimlik doğrulamanın daha yüksek düzeyinin istediği
  yoldur.
- **Sağlayıcı bağımlılığı azalır.** Sağlayıcı yalnız yüz ve canlılık için gerekir; bu parça birden çok sağlayıcıdan alınabilir.
- **İletme saldırısı zorlaşır.** Çip akışı başlatan telefonda okunduğu için iletilen bağlantı tek başına işe yaramaz
  ([[ADR-0080]] kalan riski azalır, K1–K4 aynen geçerli).
- **Hukuk önce.** Çipteki fotoğrafın işlenmesi Türkiye'de açık bir hukuki sorudur; yanlış okunursa geri dönüşü zor bir kişisel
  veri sorunu doğar. Bu yüzden karar şimdi alınır, çip yolu görüşten sonra açılır. Kapalı kod gerçek kişinin verisini
  işlemez; görüş geldiğinde yazılımın hazır olmasını sağlar.
- **Maliyet ikinci sırada.** Doğrulama başına tasarruf küçüktür; bu karar maliyet için değil güvence ve bağımsızlık için alınır.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **Çipi cüzdan okur, kimlik servisi doğrular, yüz/canlılık sağlayıcıda** | **kabul** | Veri devlet imzasıyla doğrulanır; sağlayıcıdan bağımsızlık; iletme saldırısı zorlaşır; cüzdan sağlayıcıyla konuşmaz |
| Bugünkü yol (yalnız sağlayıcı, belge fotoğrafı) | yedek olarak kalır | Çalışıyor, ucuz; ama güvence sağlayıcının yazılımına bağlı ve AB'nin yüksek düzeyine yetmez |
| Sağlayıcının çip okuma özelliği (sağlayıcının telefon bileşeni cüzdana gömülür) | ret | Cüzdanı tek bir sağlayıcıya bağlar, IDP3'e ve [[ADR-0042]]'ye aykırı; doğrulama yine sağlayıcıda kalır |
| Yüz ve canlılığı da kendimiz yapmak | ret | Sunum ve görüntü enjeksiyonu saldırıları uzmanlık ve bağımsız sınama ister; yanlış kabul doğrudan sahte kimlik demektir |
| Ayrı bir "kimlik doğrulama" uygulaması | şimdi seçilmedi | Kullanıcı için ikinci uygulama; ağın işlettiği bir uygulama olur. Cüzdan okuyucu olarak yeterli |
| Kodu şimdi, kapalı bir anahtarın arkasında yazmak; açılışı hukuki görüşe bağlamak | **kabul (2026-11-13 değişikliği)** | Görüş gelince yazılım hazır olur; kapalı kod sunucuda çalışmaz, mağaza derlemesine girmez, gerçek kişinin verisini işlemez (K11) |
| Kodu hukuki görüşten sonra yazmak (ilk kabul metni) | değişti (2026-11-13) | Görüş geldikten sonra aylarca yazılım beklenirdi; kapalı kodla aynı güvence korunur |
| Kabul et ve hemen sandbox'ta aç | ret | Hukuki görüş gelmeden çipteki fotoğraf sandbox'ta da işlenmez (K11) |
| Güvenli e-imza / mobil imza yolunu öne almak | sonraki adım | Devletçe denetlenen sertifikaya dayanır ama kullanıcıda sertifika olmasını ister; çip yolundan sonra ayrı ADR ile (K12) |
| Yalnız yetkili kaynak (devlet, banka, operatör) | uzun vadeli yön | Bugün erişilebilir bir yol yok; geldiğinde bu karar yerine değil yanına eklenir; devlet PID'i gelince kimlik belgesi zaten yerini ona bırakır |

# Sonuçlar

- **Kimlik servisi (operatör deposu).** Çip verisi alma ucu, pasif doğrulama, AA sınaması (ve sonra CA), kök sertifika yükleme,
  DG2 ile sağlayıcı yüz eşleştirmesi, testler (geçerli belge, değiştirilmiş veri grubu, bilinmeyen kök, kopya sınaması başarısız,
  yeniden oynatılan sınama). Kod şimdi, kapalı anahtarın arkasında yazılır; anahtar açıkken servis sunucuda başlamaz; açılış
  K11'e göre hukuki görüşten sonra.
- **Cüzdan çekirdeği ve cüzdan uygulaması.** NFC okuma (iOS ve Android), MRZ/CAN girişi ya da MRZ'nin kamerayla okunması, ham
  veriyi iletme; NFC izin metni; erişilebilirlik ve "çipim yok" yolu. Kod şimdi yazılır: cüzdan çekirdeğindeki taşıyıcı açık
  depoya girer, npm yayını hukuki görüşten sonra; cüzdan uygulamasının mağaza derlemelerinde çip okuma ve NFC izinleri bulunmaz.
  Gerçek bir kartla deneme hukuki görüşten sonra.
- **Okuyucu kütüphanesinin lisansı.** Android'de LGPL lisanslı açık kaynak bir okuyucu kütüphanesi kullanılır; cüzdan
  uygulamasıyla birlikte dağıtımının yükümlülükleri hukuki görüşe sorulur.
- **Şartnameler.** [[SPEC-ID-0003]]: IDP3 yeni metni ve `document_chip_verified` anlamı kabulle işlendi (sürüm notu 2026-11-13);
  çip yolunun akışı ve açık arayüz (K10) uygulamayla yazılır. [[SPEC-PROTO-0001]] (kimlik servisinin akışındaki ek adım) ve
  [[SPEC-WALLET-0001]] (cüzdanın okuyucu rolü ve "değiştirmeden ilet" kuralı) uygulamayla güncellenir.
- **Tamga ARF.** Tamga Rulebook RB-AP-ID-01 (IDP3'ün karşılığı) ve Identity Rulebook'un `document_chip_verified` tanımı kabulle
  güncellendi.
- **Bugünkü kod ve CV2.** Bugünkü kimlik servisi `document_chip_verified` alanını sağlayıcının çip sonucundan doldurabilir;
  sağlayıcı iş akışında çip adımı kullanılmadığı için ([[SPEC-ID-0003]] §4) alan bugün `false`'tur. Çip yolu kodlanana kadar
  sağlayıcı iş akışına çip adımı eklenmez; CV2 çip yolu kodlanırken koda geçer.
- **Güven listesi.** Kimlik servisinin `assurance_basis` metni çip yolu açılınca onu anar; sınıf ve güvence düzeyi bu kararla
  değişmez ([[ADR-0022]]; yükseltme ancak bağımsız değerlendirmeden sonra).
- **Kişisel veri.** Aydınlatma metnine çip okuma ve çipteki fotoğrafın yüz eşleştirmesi için sağlayıcıya gönderilmesi eklenir;
  metin hukuki görüşe göre yazılır.

# Değişmezler

| Kod | Kural |
|---|---|
| CV1 | Çip verisi kimlik servisinde sunucu tarafında doğrulanır (pasif doğrulama ve varsa kopya denetimi); cüzdanın ya da telefonun bildirdiği doğrulama sonucu kabul edilmez. |
| CV2 | `document_chip_verified: true` yalnız pasif doğrulama, kopya denetimi (AA ya da CA) ve DG2 ile canlı yüz eşleşmesi birlikte başarılıysa yazılır; aksi hâlde `false`. |
| CV3 | Etkin doğrulama (AA) sınaması kimlik servisince üretilir, tek kullanımlıktır, akışa bağlıdır ve kısa ömürlüdür. |
| CV4 | Cüzdan çip verisini yalnız okur ve değiştirmeden kimlik servisine iletir; doğrulamaz, karar vermez, saklamaz, günlüğe yazmaz ve sağlayıcıyla konuşmaz. Çip erişim anahtarı (MRZ/CAN) telefondan çıkmaz. |
| CV5 | Ham çip verisi ve DG2 fotoğrafı belge verme anından sonra tutulmaz, günlüğe ve denetim kaydına yazılmaz. |
| CV6 | Yüz ve canlılık sağlayıcısı kimlik servisinde bir bağdaştırıcının arkasındadır; kimlik belgesine, güven listesine ve cüzdana sağlayıcıya özgü bir değer girmez. |
| CV7 | Çip yolu hukuki görüş olumlu gelmeden hiçbir ortamda açılmaz. Kodu yazılabilir, ama varsayılanı kapalı bir anahtarın arkasında durur: kimlik servisi anahtar açıkken sunucuda çalışmayı reddeder; cüzdanın mağaza derlemelerinde çip okuma bulunmaz; kod yalnız yerel testlerde sahte belge verisiyle çalışır. Bir ülkenin belgesi için çip yolu, o ülkenin kök sertifikası güvenilir kaynaktan alınmadan ve hukuki incelemesi olumlu sonuçlanmadan gerçek ağda açılmaz. |

# Durum

**Accepted — 2026-11-13.** Proje yönetiminin onayıyla (2026-11-13): kabul; canlılık ve yüz eşleştirme mevcut sağlayıcıyla,
değiştirilebilir biçimde; güvenli e-imza / mobil imza yolu çip yolundan sonra. DECISIONS: D-ID-16. CV1–CV7 bağlayıcıdır.
[[SPEC-ID-0003]]/IDP3 bu kararla daraltıldı.

> **Değişiklik (2026-11-13):** K11 ve CV7 değişti — kod şimdi, kapalı anahtarın arkasında yazılır (sunucuda çalışmaz, mağaza
> derlemesine girmez, yalnız yerel testte sahte belge verisiyle); çip yolunun açılışı hukuki görüşten sonra (aynen). İlk sürüm:
> kopya denetimi yalnız AA, DG11 yoksa çip yolu kapanır, yüz eşleştirmede DG2 referans görüntü. Proje yönetimi onayıyla.
