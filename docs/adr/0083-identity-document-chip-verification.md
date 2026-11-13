---
document_id: ADR-0083
title: "Kimlik belgesinin çipini kimlik servisi doğrular; cüzdan yalnız okuyucudur, yüz ve canlılık sağlayıcıda kalır"
status: Proposed
review_status: Pending
version: 1.0.0
created: 2026-11-13
last_updated: 2026-11-13
summary: >
  Bugün kimlik servisi kişiyi tamamen bir dış uzaktan kimlik doğrulama sağlayıcısına doğrulatıyor (belge fotoğrafı, canlılık,
  yüz eşleştirme). Öneri: kimlik kartı ya da pasaport çipi kişinin telefonunda, akışı başlatan cüzdanda NFC ile okunur; cüzdan
  çipten okuduğu ham veriyi değiştirmeden kimlik servisine iletir; devletin imzasını (ICAO 9303 pasif doğrulama) ve çipin kopya
  olmadığını (etkin doğrulama ya da çip doğrulama, sunucunun ürettiği tek kullanımlık sınamayla) kimlik servisi kendisi doğrular.
  Yüz eşleştirme ve canlılık bir sağlayıcıda kalır ve çipteki fotoğrafla karşılaştırılır. Kimlik belgesinin alanları çipten
  gelir. Belge fotoğrafı yolu çipsiz belgeler için yedek olarak kalır. Ad ve kod değişmez (`document_chip_verified`,
  `verification_method: remote-nfc-liveness-face` zaten tanımlı). IDP3 daraltılarak yeniden ifade edilir: cüzdan sağlayıcıyla
  hâlâ konuşmaz, ama çipi okuyup ham veriyi kimlik servisine iletebilir; karar vermez. Ülke başına hukuki inceleme bitmeden gerçek
  ağda açılmaz.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0022]]", "[[ADR-0040]]", "[[ADR-0042]]", "[[ADR-0080]]", "[[SPEC-ID-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
---

# Kısaca

Kimlik kartlarının ve pasaportların içinde bir çip vardır. Çipte kişinin adı, doğum tarihi ve fotoğrafı, devletin imzasıyla
birlikte durur. Telefon bu çipi NFC ile okuyabilir. Bu kararla Tamga kimlik belgesi verirken bilgileri belgenin fotoğrafından
değil çipten alır ve devletin imzasını kendisi kontrol eder. Kişinin gerçekten o belgenin sahibi olduğunu göstermek için yüz ve
canlılık kontrolü yine bir dış sağlayıcıda yapılır: canlı yüz, çipteki fotoğrafla karşılaştırılır. Böylece bilgilerin doğruluğu
sağlayıcının yazılımına değil devletin imzasına dayanır, sağlayıcı yalnız yüz kısmı için gerekir ve değiştirilebilir. Çipi
olmayan belgeler için bugünkü fotoğraf yolu kalır.

# Bağlam

- **Bugün.** Kimlik servisi ([[ADR-0011]]) kişiyi bir uzaktan kimlik doğrulama sağlayıcısına yönlendirir; sağlayıcı belge
  fotoğrafını okur, canlılığı ve yüzü denetler, "onaylandı" der. Kimlik belgesindeki alanlar sağlayıcının okuduğu değerlerdir.
  Kimlik servisi bu kararı doğrulayamaz; yalnız sağlayıcıya güvenir. Sınıf: nitelikli olmayan EAA, I2 ([[ADR-0022]]).
- **Sağlayıcıya bağımlılık.** Sağlayıcının ücretsiz kotası kalktı; her doğrulama ücretlidir. Bu tek başına büyük bir maliyet
  değildir (aşağıda), ama kimlik doğrulamanın bütün güvencesi tek bir sağlayıcının yazılımına ve fiyat politikasına bağlıdır.
- **AB'de PID nasıl verilir.** AB'de kişi kimlik verisini (PID) bir üye devletin eID düzeni içindeki PID sağlayıcısı verir;
  cüzdan kullanıcısı yüksek güvence düzeyinin kayıt kurallarına göre kaydedilir (Uygulama Tüzüğü (AB) 2024/2977 md. 3).
  Uzaktan kayıt için Uygulama Tüzüğü (AB) 2026/798 ETSI TS 119 461 V2.1.1'e dayanır ve fiziksel belgeyle yapılan uzaktan
  kayıtta belgedeki yüz fotoğrafının **NFC ile çipten alınmasını** ister. ETSI TS 119 461'de tam otomatik "belge + yüz" yolu
  çipli belge ister; genişletilmiş düzey ayrıca laboratuvarda sınanmış sunum saldırısı tespiti ve görüntü enjeksiyonu tespiti
  (CEN/TS 18099) ister. AB ülke cüzdanları PID'i çoğunlukla ulusal elektronik kimlikle (çip + PIN) verir. Belge fotoğrafı +
  özçekim bu düzeye yetmez.
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
- **K6 — Yüz ve canlılık sağlayıcıda kalır.** Canlılık denetimi ve yüz eşleştirme, kanıtlanmış sunum saldırısı (ISO/IEC 30107-3)
  ve görüntü enjeksiyonu sınamaları olan bir sağlayıcıdan alınır; kimlik servisi bunu kendi yazmaz. Canlılık sağlayıcının
  tarayıcı akışında yapılır (cüzdan sağlayıcıyla konuşmaz); canlı yüz, çipteki DG2 fotoğrafıyla karşılaştırılır. Sağlayıcı
  bağdaştırıcı arkasındadır; değiştirilmesi kararı değiştirmez.
- **K7 — Saklama.** Çip verisi, DG2 fotoğrafı ve sağlayıcıya giden yüz görüntüsü kimlik servisinde yalnız belge verme anına kadar
  bellekte tutulur ve sonra silinir (IDP4, IDP9 aynen). Kalıcı kayda yalnız belge numarasının anahtarlı özeti, çip yolu kullanıldı
  bilgisi ve doğrulama sonuçları (geçti/kaldı) girer; ham veri girmez.
- **K8 — Ülke başına açılış.** Çip yolu bir ülkenin belgesi için gerçek ağda ancak (a) o ülkenin kök sertifikası güvenilir bir
  kaynaktan alınmış ve (b) o ülkenin hukukunda özel bir kuruluşun kimlik çipini kişinin rızasıyla okumasının ve biyometrik verinin
  işlenmesinin hukuki incelemesi bitmişse açılır. Sandbox'ta sahte belgeyle denenebilir.
- **K9 — IDP3 daraltılır.** Yeni metin: "IDV sağlayıcı entegrasyonu yalnızca Tamga kimlik servisindedir; kurumların belge verme
  servisleri, cüzdan ve doğrulayıcı sağlayıcıyla konuşmaz. Cüzdan, akışı başlatan cihazda belge çipini okuyup ham veriyi
  değiştirmeden kimlik servisine iletebilir; çip verisini doğrulamaz ve kimlik doğrulama kararı vermez."
- **K10 — Açık arayüz.** Çip verisinin kimlik servisine iletilmesi [[SPEC-ID-0003]]'te açık bir arayüz olarak tanımlanır; ağın
  listelediği her uyumlu cüzdan uygulayabilir ([[ADR-0042]]: ağ cüzdan işletmez, tek bir cüzdana ayrıcalık tanınmaz).

# Gerekçe

- **Güvence devletin imzasına dayanır.** Fotoğraftan okunan alanlar yazılımın tahminidir; çipten okunan alanlar devletin imzalı
  verisidir ve kimlik servisi bunu kendisi doğrulayabilir. Bu, AB'de uzaktan kimlik doğrulamanın daha yüksek düzeyinin istediği
  yoldur.
- **Sağlayıcı bağımlılığı azalır.** Sağlayıcı yalnız yüz ve canlılık için gerekir; bu parça birden çok sağlayıcıdan alınabilir.
- **İletme saldırısı zorlaşır.** Çip akışı başlatan telefonda okunduğu için iletilen bağlantı tek başına işe yaramaz
  ([[ADR-0080]] kalan riski azalır, K1–K4 aynen geçerli).
- **Maliyet ikinci sırada.** Doğrulama başına tasarruf küçüktür; bu karar maliyet için değil güvence ve bağımsızlık için alınır.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **Çipi cüzdan okur, kimlik servisi doğrular, yüz/canlılık sağlayıcıda** | **öneri** | Veri devlet imzasıyla doğrulanır; sağlayıcıdan bağımsızlık; iletme saldırısı zorlaşır; cüzdan sağlayıcıyla konuşmaz |
| Bugünkü yol (yalnız sağlayıcı, belge fotoğrafı) | yedek olarak kalır | Çalışıyor, ucuz; ama güvence sağlayıcının yazılımına bağlı ve AB'nin yüksek düzeyine yetmez |
| Sağlayıcının çip okuma özelliği (sağlayıcının telefon bileşeni cüzdana gömülür) | ret | Cüzdanı tek bir sağlayıcıya bağlar, IDP3'e ve [[ADR-0042]]'ye aykırı; doğrulama yine sağlayıcıda kalır |
| Yüz ve canlılığı da kendimiz yapmak | ret | Sunum ve görüntü enjeksiyonu saldırıları uzmanlık ve bağımsız sınama ister; yanlış kabul doğrudan sahte kimlik demektir |
| Ayrı bir "kimlik doğrulama" uygulaması | şimdi seçilmedi | Kullanıcı için ikinci uygulama; ağın işlettiği bir uygulama olur. Cüzdan okuyucu olarak yeterli |
| Yalnız yetkili kaynak (devlet, banka, operatör) | uzun vadeli yön | Bugün erişilebilir bir yol yok; geldiğinde bu karar yerine değil yanına eklenir; devlet PID'i gelince kimlik belgesi zaten yerini ona bırakır |

# Sonuçlar

- **Kimlik servisi (operatör deposu).** Çip verisi alma ucu, pasif doğrulama, AA sınaması (ve sonra CA), kök sertifika yükleme,
  DG2 ile sağlayıcı yüz eşleştirmesi, testler (geçerli belge, değiştirilmiş veri grubu, bilinmeyen kök, kopya sınaması başarısız,
  yeniden oynatılan sınama).
- **Cüzdan çekirdeği ve cüzdan uygulaması.** NFC okuma (iOS ve Android), MRZ/CAN girişi ya da MRZ'nin kamerayla okunması, ham
  veriyi iletme; NFC izin metni; erişilebilirlik ve "çipim yok" yolu.
- **Şartnameler.** [[SPEC-ID-0003]] (çip yolu, IDP3 yeni metni, K5 anlamı, açık arayüz); [[SPEC-PROTO-0001]] (kimlik servisinin
  akışındaki ek adım); [[SPEC-WALLET-0001]] (cüzdanın okuyucu rolü ve "değiştirmeden ilet" kuralı).
- **Güven listesi.** Kimlik servisinin `assurance_basis` metni çip yolunu anar; sınıf ve güvence düzeyi bu kararla değişmez
  ([[ADR-0022]]; yükseltme ancak bağımsız değerlendirmeden sonra).
- **Kişisel veri.** Aydınlatma metnine çip okuma ve çipteki fotoğrafın yüz eşleştirmesi için sağlayıcıya gönderilmesi eklenir.

# Önerilen değişmezler

Kabul edilince değişmez tablosuna dönüşür ve kod alır; o zamana kadar bağlayıcı değildir.

1. Çip verisi kimlik servisinde sunucu tarafında doğrulanır; cüzdanın ya da telefonun bildirdiği doğrulama sonucu kabul edilmez.
2. `document_chip_verified: true` yalnız pasif doğrulama, kopya denetimi (AA ya da CA) ve DG2 ile canlı yüz eşleşmesi birlikte
   başarılıysa yazılır.
3. AA sınaması kimlik servisince üretilir, tek kullanımlıktır, akışa bağlıdır ve kısa ömürlüdür.
4. Ham çip verisi ve DG2 fotoğrafı belge verme anından sonra tutulmaz, günlüğe ve denetim kaydına yazılmaz; çip erişim anahtarı
   (MRZ/CAN) telefondan çıkmaz.
5. Bir ülkenin belgesi için çip yolu, kök sertifikası güvenilir kaynaktan alınmadan ve hukuki incelemesi bitmeden gerçek ağda
   açılmaz.

# Açık noktalar (kabulle birlikte karara bağlanacak)

1. Çip yolu ilk hangi belgelerle açılsın: Türkiye kimlik kartı ve pasaport mı, yoksa hukuki inceleme bitene kadar yalnız sandbox mı?
2. Yüz ve canlılık için hangi sağlayıcı: bugünkü sağlayıcının yalnız canlılık + yüz eşleştirme parçası mı, başka bir sağlayıcı mı?
3. Kopya denetimini desteklemeyen çiplerde belge verilsin mi (K5'teki gibi `document_chip_verified: false` ile), yoksa fotoğraf
   yoluna mı düşülsün?
4. Uygulama sırası: önce iOS mi, önce Android mi, ikisi birlikte mi?

# Durum

**Proposed — 2026-11-13.** Kabul edilmedi; kod bu kararla değişmez. Kabul edilirse DECISIONS'a işlenir ve İngilizce ile
Azerbaycanca çevirisi tamamlanır.
