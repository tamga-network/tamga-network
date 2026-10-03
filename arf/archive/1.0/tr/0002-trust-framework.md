---
document_id: FW-TF-0001
title: "Ek A — Trust Framework"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-02
summary: >
  Tamga ekosisteminin yönetişim çerçevesi. World Bank "Digital Wallets: Trust Frameworks" beş katmanlı modeliyle
  yapılandırılmıştır: strateji (vizyon, ilkeler, hukuki bağlam, risk, yönetişim organları), teknoloji (ana belgeye işaret),
  şema kuralları (roller, katılım kapıları, yaşam döngüsü, güvence), uyum (rejim, ISO/IEC 17000 rolleri, uygunluk testi,
  gözetim, yaptırım, olay müdahalesi) ve sözleşmeler (sözleşme seti, hizmet seviyeleri, sorumluluk, fesih, halefiyet).
  eIDAS 2.0 ve uygulama tüzükleri katmanının Türk dünyası karşılığıdır ve devlet devraldığında devredilecek varlıktır.
---

# 0. Statü, kapsam, nasıl okunur

Bu belge **Tamga [[t:trust-framework|Trust Framework]] 1.0**'dır ve ağa katılan her kurum için bağlayıcıdır: katılım
sözleşmesini imzalayan kurum bu çerçeveyi ve [[t:rulebook|Tamga Rulebook]]'u kabul etmiş olur. Üç işi vardır:

1. **Kurumlara** ağa nasıl katılacaklarını, hangi yükümlülükleri üstleneceklerini ve hangi güvenceyi alacaklarını söylemek.
2. **Düzenleyicilere ve Türk Devletleri Teşkilatı (TDT) üye devletlerine** yapının [[t:eIDAS]] 2.0 ile aynı biçimde kurulduğunu,
   fakat egemenlik ve devir bakımından Türk dünyası için tasarlandığını göstermek.
3. **Devir anında** teslim edilecek varlık olmak: kök parmak izleri, kayıtlar, kurallar, sözleşme şablonları ve değişiklik
   günlüğü bu belgeye bağlıdır.

Belge World Bank'ın beş katmanlı modeliyle düzenlenmiştir (strateji · teknoloji · şema kuralları · uyum · sözleşmeler). Her
katmanda "bugün" ve "devirde" ayrımı yapılır. Kuralların dayandığı kararlar ve şartnameler Ek E'dedir.

**Bağlayıcılık sırası:** karar kayıtları > şartnameler > bu belge > Tamga Rulebook > sözleşme şablonları. Çelişkide üst
kaynak geçerlidir ve bu belge düzeltilir.

Hangi bölümü hangi sırayla okuyacağınız [[FW-READ-0001]], katılımın adımları [[FW-ONB-0001]] sayfasındadır.

---

# 1. Katman 1 — Strateji

## 1.1 Vizyon

TDT üyesi ve gözlemcisi devletlerin, kurumlarının ve vatandaşlarının **birbirinin belgelerini kaynağa sormadan
doğrulayabildiği** ortak bir güven altyapısı. Her devlet kendi kayıtlarının tek sahibidir; üstte bir otorite yoktur. Teknik
katman AB standartlarıyla aynıdır, yönetişim Türk dünyasına aittir.

## 1.2 İlkeler

Ana belgedeki yedi ilke (§1.6, P1–P7) bu çerçevenin de ilkeleridir. Yönetişime özgü iki ek ilke:

| # | İlke |
|---|---|
| G-A | **Kayıt yetkilendirme değildir.** Kayıt kurumu kaydeder, onaylamaz; bir kurumun belge vermeye yasal yetkisi (YÖK, bakanlık, meslek odası) ağın dışında verilir. Ağ yalnızca ağ içindeki kapsamı (hangi belge türü, hangi alanlar) tutar. |
| G-B | **Yumuşak güç de sınırlanır.** Kodla sınırlanamayan her yetki (barındırma, alan adı, kayıt tutma, istatistik) yazılı politika, ölçülebilir eşik uyarısı ve şeffaflık raporuyla sınırlanır. |

## 1.3 Kapsam

| Boyut | Bugün | Hedef |
|---|---|---|
| Yargı bölgesi | Türkiye (Türkiye listesi yayında) | TDT üyeleri (Azerbaycan, Kazakistan, Kırgızistan, Özbekistan) ve gözlemciler (Macaristan, Türkmenistan); her biri için yer ayrılmıştır |
| Belge türleri | Eğitim belgeleri (öğrenci belgesi, diploma), kimlik belgesi, iletişim belgeleri, etkinlik bileti | Sektör şemaları |
| Katılımcılar | Belge veren kurumlar (üniversiteler, bilet satıcıları), doğrulayıcılar (işverenler, web siteleri), Tamga (geçici liste işletmecisi ve kayıt kurumu), Tamga Wallet (ağın ilk cüzdanı) | Meslek kuruluşları, kamu kurumları, bankalar, kurallara uyan her cüzdan |
| Kişi kimliği ([[t:PID]]) | **Kapsam dışı** — Tamga PID vermez | Devletin atadığı PID sağlayıcısı |

## 1.4 Hukuki bağlam

| Konu | Türkiye'de dayanak | Bu çerçevede |
|---|---|---|
| Kişisel veri | 6698 sayılı KVKK; VERBİS; aydınlatma, açık rıza, veri koruma etki değerlendirmesi | Katılım sözleşmesi ekleri |
| Elektronik imza ve mühür | 5070 sayılı Elektronik İmza Kanunu; BTK elektronik sertifika hizmet sağlayıcıları listesi; nitelikli imza ve e-Mühür | En yüksek kimlik doğrulama yolu; akredite belge verenler için e-Mühür seçeneği |
| Uluslararası tanıma | eIDAS 2.0 Madde 14 (üçüncü ülke anlaşmaları); ETSI TS 119 612'nin AB dışı liste desteği | Teknik uyum ve ETSI biçiminde liste görünümü |
| Yükseköğretim | YÖK mevzuatı (diploma verme yetkisi) | Ağın dışındaki yetki; ağdaki kapsam ayrıdır (G-A) |
| Yargı ve uyuşmazlık | Kurumun bulunduğu devletin hukuku | §5.8 |

Çerçeve, sözleşme ekleriyle birlikte pilot öncesinde KVKK ve 5070 açısından bir avukat tarafından incelenir.

## 1.5 Risk yaklaşımı

Riskler ekosistem düzeyinde ve orantılı ele alınır. Risk kaydı AB ARF'sinin risk listesinden türetilir. Bugün açıkça beyan
edilen artık riskler ana belgededir (§6.6 ve §7.4): tek işletmecinin imzasına dayanan çapa, iptalin etkili olma süresi, aynı
[[t:issuer|belge verenin]] belgelerinin birleştirilmesiyle kişinin eşleştirilebilmesi.

## 1.6 Yönetişim organları ve yetkiler

| Aşama | Organ | Yetki |
|---|---|---|
| **Liste aşaması ve defter aşaması (bugün)** | Tamga, geçici işletmeci | Günlük işletim, altyapı, liste işletmeciliği ve kayıt kurumu rolünün devlet adına yürütülmesi, açık paketlerin yayını |
|  | Tamga teknik kurulu | Şartname değişiklikleri, karar kayıtlarının onayı, ağ düzeyindeki ortak belge türleri |
|  | (henüz yok) | Konsey — üye devlet yokken kurulmaz; bu geçici durum açıkça adlandırılır |
| **Devlet katılımı ve sonrası** | Konsey (üye devletler) | Üye kabulü ve çıkarılması, ağ düzeyindeki ortak belge türleri, protokol yükseltmeleri ve bu belgenin politikaları; hepsi üçte iki oyla |
|  | Her devlet | Kendi ulusal listesi ve kayıtları (yalnız kendi devleti yazar), kayıt kurumu, liste işletmeciliği, kök sertifika |
|  | Yönetişim kurumu (vakıf ya da konsey sekretaryası) | İşletmecilik, devredilene kadar |

Yönetişim kurumu ilk günden kurulmaz: bir ya da iki devlet katılmaya istekli olduğunda kurulur ve listeler devredilir. O
zamana kadar Tamga geçici işletmecidir; vakıf kurulduğunda işletmecilik ona devredilir.

**Ölçülebilir devir eşikleri:** barındırılan belge verenlerin oranı %30'u aşarsa konu konsey gündemine gelir; devlet
işletmecilerinin sayısı en az dört olduğunda ilk işletmecinin defter düğümleri devredilir; ilk devlet işletmecisi üretime
geçtiğinde konsey kurulur. Ortak defter en az iki bağımsız işletmeciyle başlar.

## 1.7 Şeffaflık

Üç ayda bir şeffaflık raporu yayınlanır: liste sürümleri ve değişiklikler, barındırılan belge verenlerin oranı, belge türü
kullanım sayaçları (en az 50'lik gruplar hâlinde), olaylar ve denetim bulguları. Listelerin değişiklik günlüğü
`trust.tamga.network`'te herkese açıktır.

---

# 2. Katman 2 — Teknoloji

Teknik referans ana belgedir; bu katman yalnızca yönetişimin teknolojiye koyduğu şartları listeler.

## 2.1 Zorunlu standartlar ve profiller

- belge biçimleri: [[t:SD-JWT-VC]] (Tamga profili) ve kimlik için ISO/IEC 18013-5 [[t:mdoc]];
- protokoller: [[t:OpenID4VCI]] ve [[t:OpenID4VP]] ([[t:HAIP]] 1.0 profili);
- kurum kimliği: X.509 sertifikaları;
- iptal: [[t:status-list|iptal listesi]] (IETF Token Status List);
- belge türleri: tür tanımı (Type Metadata) ve JSON Schema kataloğu;
- [[t:trust-list|güven listesi]] biçimi ve kanonik doğrulama hattı;
- cüzdan ve [[t:identity-proofing|kimlik doğrulama]] kuralları.

Teknik ayrıntılar geliştirici belgelerindedir (Ek E).

## 2.2 Güvence modeli (yönetişim görünümü)

| Eksen | Seviye | Kim belirler | Nerede kayıtlı |
|---|---|---|---|
| Belge sahibinin kimlik doğrulaması (T0–T3; eIDAS Low / Substantial / High) | Bağlama yolu | Belge veren ya da kayıt otoritesi | Belge verenin denetim kaydı; belge türünün ön koşulu |
| Belge veren (I1–I3) | Akreditasyon | Kayıt kurumu; I3'te bağımsız değerlendirme | Güven listesinde (güvence ve sınıf alanları) |
| Cüzdan (W1–W3) | Güvenli donanım (WSCD — Wallet Secure Cryptographic Device) seviyesi | Cüzdan sağlayıcısı (cüzdan örneği kanıtı ve anahtar kanıtı) | Listelerin listesinde, cüzdan sağlayıcısı kaydında |

Dışa dönük adlandırma eIDAS terimleriyle yapılır (Low / Substantial / High; [[t:EAA]], QEAA karşılığı, kamu belgesi).
Kullanıcıya sayı gösterilmez.

## 2.3 Anahtar koruma şartları

| Anahtar | Şart |
|---|---|
| Liste imza anahtarı | En az iki kaydırmalı sertifika; KMS ya da HSM; rotasyon en az 30 gün önce duyurulur, yeni anahtar eskisiyle imzalanır |
| Kök sertifika | Çevrimdışı tören (iki kişi, tutanak); parmak izi kalıcı bir sayfada yayınlanır |
| Belge verenin imza anahtarı | Kurumun denetiminde; I3'te HSM'de; **Tamga'da tutulmaz** |
| İptal listesi anahtarı | Ayrı ve çevrimiçi |
| Belge sahibinin anahtarı | Cihazın güvenli bölgesinde; dışa aktarılamaz; bir kurtarma tohumundan türetilmez |
| Doğrulayıcının erişim sertifikası | Erişim sertifikası makamından; istemci kimliği sertifikanın özetidir (`x509_hash`), kalıcı kimlik sertifikadaki alan adıdır (`dns_name`) |

## 2.4 Sertifikasyon yaklaşımı

Liste aşaması ve defter aşamasında **hafif uygunluk** uygulanır: açık uyum test vektörleri ve taahhüt testleri her yayından
önce zorunludur. Devletler katıldığında bağımsız uygunluk değerlendirme kuruluşları ve ulusal sertifikasyon gelir (§4.2,
§4.3).

---

# 3. Katman 3 — Şema kuralları

## 3.1 Roller ve sorumluluklar

Rol tanımları ana belgenin 3. bölümünde, her rolün ayrıntısı [[FW-ROLE-0001]] sayfasında, bağlayıcı kuralları Ek B'dedir. Bu
bölüm katılımın **kapılarını** ve yaşam döngüsünü tanımlar; adım adım süreç [[FW-ONB-0001]] sayfasındadır.

## 3.2 Katılım kapıları

Kapılar otomatik uygunluk denetimleri olarak tasarlanır; kapı geçilmeden kayıt yapılmaz.

### Belge veren

| Seviye | Kapı | Ne sağlar |
|---|---|---|
| **I1 — Kayıtlı** | Alan adı sahipliği (DNS doğrulaması); iletişim bilgisi; teknik uygunluk (tür tanımı ve uyum test vektörleriyle deneme belgesi) | Listede EAA sınıfı ve I1 güvencesi; doğrulayıcı arayüzünde "akredite değil" |
| **I2 — Sözleşmeli** | I1 + tüzel kişilik (MERSİS ve Ticaret Sicil Gazetesi ya da kuruluş kanunu) + imza yetkilisinin teyidi + **katılım sözleşmesi** (§5.1) + X.509 sertifika + KVKK ekleri | I2 güvencesi |
| **I3 — Akredite** | I2 + anahtarlar HSM'de (ya da nitelikli e-Mühür) + denetim ve kayıt tutma yükümlülüğü + olay bildirimi süreleri + yıllık gözden geçirme + askıya alma prosedürü + sorumluluk sigortası | I3 güvencesi, nitelikli sınıf; belgede nitelikli belge işareti |
| **Kamu** | Devlet kurumu ya da yetkili kaynak adına; ilgili devletin kayıt kurumu kaydeder | Kamu sınıfı; belgede kamu belgesi işareti (devlet katılımında) |

Kurum, barındırılan belge verme servisini kendi sistemlerinden **kendisine bağlı ve kapsamı sınırlı bir API anahtarıyla**
kullanır; anahtar yalnız özetiyle saklanır ve 90 günde bir yenilenir.

Belge türü yetkisi kapıdan bağımsızdır ve **her tür için ayrı bir izin listesiyle** verilir; varsayılan kapalıdır. Yetki, belge
türünün rulebook'undaki "kim belge verebilir" bölümüne göre verilir.

### Doğrulayıcı

Kayıt başvurusu kapsam tahsisiyle sonuçlanır. Başvuru AB'nin ortak kayıt veri setini ister: resmî ve ticari ad, resmî kimlik
numarası (VKN ya da MERSİS), adres, iletişim, hizmet açıklaması, her kullanım için amaç ve **gizlilik politikası**, kamu
kurumu olup olmadığı, yetki türü, aracı ilişkisi ve bağlı olduğu veri koruma kurumu. Yalnız tüzel kişiler kaydolur.
Ardından istenebilecek alanlar veri azaltma ilkesiyle incelenir, [[t:access-certificate|erişim sertifikası]] verilir ve doğrulayıcı
listeye eklenir. Doğrulayıcı kapsamını aşan alan isteyemez; cüzdan kapsamı kişiye gösterir. Doğrulayıcı kendi yazılımını
çalıştırabilir ya da barındırılan doğrulayıcıyı ([[t:intermediary|aracı]]) kullanabilir; ikincisinde sonuç ve değerler yalnızca
imzalı beyanıyla kendini kanıtlayan doğrulayıcıya ve bir kez verilir.

**[[t:registration-certificate|Kayıt sertifikası]].** Kayıt kurumu (bugün devlet adına Tamga) her kullanım için [[t:ETSI]] TS 119 475
kayıt sertifikası üretir (en çok 12 ay geçerli). İçerik yalnız imzalı listedeki kayıttan gelir ve [[t:LOTL|listelerin listesinde]]
yayınlanan ayrı kayıt kurumu anahtarıyla imzalanır. Doğrulayıcı sertifikayı isteğiyle birlikte taşır; cüzdan imzayı, süreyi
ve doğrulayıcının erişim sertifikasındaki kurum kimlik numarasıyla bağı doğrular, istenen alanları sertifikayla karşılaştırır.
Belge verenler için de kurum başına bir kayıt sertifikası üretilir. Kurum kimlik numarası kayda girilmemiş katılımcıya
sertifika üretilmez.

### Cüzdan sağlayıcısı

Cüzdan çözümü beyanı (platformlar, güvenli donanım seviyesi, PIN ve biyometri, yedekleme modeli; Tamga Rulebook'taki cüzdan
kurallarına uygun) yapılır, uyum testleri geçilir, cüzdan örneği kanıtı ([[t:WIA]]) ve anahtar kanıtı (KA) imza anahtarı
listelerin listesine eklenir. Devletler katıldığında sertifikalı cüzdan çözümleri listesi gelir (AB Uygulama Tüzüğü 2025/849
karşılığı).

### Yetkili kaynak

Belge verenin sözleşmesinde adlandırılır; veri işleme sözleşmesi imzalanır (§5.1). Kaynak verinin belge alanlarına eşleme
tablosu (ör. ISCED-F) tutulur ve "eşlemede karşılığı olmayan veri için belge verilmez" kuralı uygulanır.

## 3.3 Yaşam döngüsü kuralları

- **Askıya alma:** olay, denetim bulgusu ya da sözleşme ihlali durumunda kurum askıya alınır; yeni belge verilmez, eski
  belgeler verildikleri tarihe göre geçerli kalır. Sorun giderilince kurum yeniden etkinleşir.
- **Çıkarma:** kurum listeden çıkarılır (halefi varsa halef bağlantısıyla); ETSI görünümünde "geri çekildi" olarak yer alır;
  geçmiş silinmez; halef iptal listesini yayınlamayı sürdürebilir.
- **Anahtar ya da sertifika yenileme:** yeni kurum kimliği eskisine halef olarak bağlanır; eski belgeler eski kayıtla
  doğrulanır; yenileme en az 30 gün önce kayıt kurumuna bildirilir.
- **Gönüllü çıkış:** bildirimden 90 gün sonra gerçekleşir; iptal listesi halef ya da liste işletmecisi tarafından son
  sürümünde dondurulur.
- **Devlet katılımı ve çıkışı:** üyelik üçte iki oyla olur; çıkış mevcut kayıtları geçersiz kılmaz; yeniden kabul mümkündür.

## 3.4 Kimlik doğrulama ve belge türü

Her belge türü rulebook'u, türün gerektirdiği asgari kimlik doğrulama seviyesini tanımlar (Education Rulebook: öğrenci
belgesi T1, diploma T2). Belge veren bu seviyeyi belgeyi vermeden önce sağlar; seviye [[t:credential|belgeye]] yazılmaz. Yollar
ve uzaktan kimlik doğrulama sağlayıcısı entegrasyonu [[SPEC-ID-0003]]'tedir.

## 3.5 Geçici kimlik belgesi sağlayıcısı

Devletin atadığı bir PID sağlayıcısı bulunana kadar **Tamga Network** bu rolü *geçici* olarak üstlenir: uzaktan kimlik
doğrulamasının (belge, canlılık, yüz eşleştirmesi; NFC eklenebilir) ardından cüzdana Tamga kimlik belgesi verir. Kurallar:

1. Bu belge PID değildir, bir EAA'dır; devlet sağlayıcısı atanınca halefiyetle devredilir (§5.7).
2. Tamga bu veri için **KVKK veri sorumlusudur**: aydınlatma ve açık rıza belge verilmeden önce alınır; belge ve yüz
   görüntüleri Tamga'da saklanmaz; saklama belgenin süresiyle sınırlıdır; silme talebi belgeyi iptal eder.
3. Kimlik numarası yalnız bu belge türünde ve [[t:selective-disclosure]] ile taşınır.
4. Kurumlar belgeyi yalnız **gösterme** yoluyla, kayıtlı kapsamlarında ve kendi kayıtlarıyla eşleştirmek için alır;
   eşleştirme anahtarlarını saklamaz.
5. Uzaktan kimlik doğrulama sağlayıcısıyla yapılan sözleşme ETSI TS 119 461'e atıf yapar.
6. Üç aylık şeffaflık raporu verilen ve iptal edilen belge sayılarını içerir; kişi bilgisi içermez.

Teknik profil [[SPEC-ID-0003]] §9'dadır.

## 3.6 Veri koruma kuralları (KVKK)

Rollere göre sorumluluk: belge veren ve [[t:authentic-source|yetkili kaynak]] veri sorumlusudur; Tamga, barındırdığı belge verme
servisinde sözleşmeyle veri işleyendir; **kimlik belgesi servisinde veri sorumlusudur (§3.5)**; [[t:wallet-provider|cüzdan
sağlayıcısı]] cihazdaki veriye erişmez; doğrulayıcı aldığı alanların sorumlusudur. Ortak kayıtlarda kişisel veri yoktur (P2).
Kişi hakları: gösterme geçmişi cihazda tutulur, veri koruma kurumuna şikâyet yolu cüzdanda gösterilir, rızanın geri
alınması belgenin iptali demektir.

## 3.7 Yakın alanda gösterme ve geçiş kartı

**İlke:** doğrulama sırasında kullanılan tek kullanımlık değeri ([[t:nonce]]) ikna olmak isteyen taraf üretir. Cüzdanın karekod
gösterdiği yakın alan gösterimde ya ikinci bir kanal açılır (hedef: ISO/IEC 18013-5) ya da karekod yalnız **kısa ömürlü bir
başvuru** (doğrulayıcının sonradan başlattığı OpenID4VP) ya da **kişisel veri içermeyen imzalı bir jeton** (geçiş kartı, 60
saniye) taşır. Kurallar:

1. Bir kapı terminali ancak kayıtlı bir doğrulayıcının altında tanımlanır.
2. Geçiş jetonu kişiyi tanımlamaz; doğrulayıcı kişiyi kendi kayıt sisteminde eşler.
3. Geçişte onay sorulmaması **süreli ve kapsamı belli** bir rızaya dayanır; kişi bu rızayı her an geri alır.
4. Her gösterim cüzdanda kayda geçer.
5. Tek kullanımlık belgelerde (bilet) kapılar ortak bir "kullanıldı" listesi tutar.
6. Bu geçici yollar sürümlüdür ve ISO/IEC 18013-5 yakın alan akışı geldiğinde kullanımdan kalkar.

---

# 4. Katman 4 — Uyum

## 4.1 Rejim — karma model

| Sınıf | Rejim | Ne demek |
|---|---|---|
| I3 / nitelikli | **Önceden denetim** | Kayıttan önce uygunluk değerlendirmesi (teknik ve kurumsal), yıllık denetim |
| I2 | **Sonradan denetim** | Öz beyan ve uyum test vektörleri; şikâyet ya da olay üzerine denetim; yıllık öz değerlendirme |
| I1 | Öz beyan | Teknik uygunluk testi; "akredite değil" etiketi |
| Cüzdan sağlayıcısı | Bugün öz beyan ve uyum testleri; devlet katılımında önceden denetim | Devlet katılımında sertifikalı cüzdan çözümü |
| Doğrulayıcı | Sonradan denetim | Kapsam ihlali ya da aşırı talep şikâyeti üzerine |

Bu model EUDI'nin karma modeliyle aynıdır: nitelikli belgeler önceden, diğerleri sonradan denetlenir.

## 4.2 ISO/IEC 17000 rolleri

| Rol | Bugün | Devlet katılımında |
|---|---|---|
| Şema sahibi | Tamga (geçici işletmeci) | Konsey |
| Akreditasyon kurumu | Tamga (geçici) | Ulusal akreditasyon kurumu (TÜRKAK benzeri) |
| Uygunluk değerlendirme kuruluşu | — (öz beyan ve uyum test vektörleri) | Bağımsız değerlendirme kuruluşları |
| Şema katılımcısı | Belge veren, doğrulayıcı, cüzdan sağlayıcısı, yetkili kaynak | Aynı |

## 4.3 Uyum testleri ve sertifikasyon

Uyum, rolün kendi yazılımıyla gösterilir. Testler herkese açıktır ve depodaki `conformance/` klasöründe sürümlü olarak durur;
kişisel veri ve özel anahtar içermez.

| Rol | Ne test edilir | Nasıl gösterilir |
|---|---|---|
| Belge veren | Tür tanımına uygun belge üretimi, imza ve sertifika zinciri, iptal listesi yayını, cüzdan kanıtlarının denetimi | Uyum vektörleriyle deneme belgesi; sonuç raporu kayıt başvurusuna eklenir |
| Doğrulayıcı | İmzalı istek, doğrulama hattının adımları, bayat listede "doğrulanamadı" sonucu, kapsam dışı alan istememe | Uyum vektörleri ve taahhüt testleri; sonuç raporu kayıt başvurusuna eklenir |
| Cüzdan sağlayıcısı | Cüzdan kuralları (anahtar koruma, onay ekranı, geçmiş, silme), cüzdan örneği kanıtı ve anahtar kanıtı, gösterme protokolü | Uyum vektörleri, taahhüt testleri ve cihaz üzerinde gösterim |

Taahhüt testleri en az şunları içerir: bayat liste "doğrulanamadı" sonucunu verir; bilinmeyen biçimde işlem durur; imza hatasında
işlem durur. Testleri çalıştırma adımları geliştirici belgelerindedir (Ek E). Sonuçlar kayıt kurumuna sunulur; kayıt kurumu
gerektiğinde testleri yeniden çalıştırır. Devletler katıldığında bağımsız değerlendirme kuruluşları ve ulusal sertifikasyon
bu testlerin üstüne eklenir; AB ile birlikte çalışabilirlik ayrıca OpenID uyum testleriyle gösterilir.

Referans [[t:verifier|doğrulayıcı]] (`verify.tamga.network`) herkesin kullanımına açıktır; doğrulayıcılar kendi doğrulama
yazılımını da çalıştırabilir. Tamga barındırılmış bir liste dizinleme hizmeti sunmaz.

## 4.4 Sürekli gözetim

Şeffaflık raporu, eşik uyarılarının ölçümleri, listelerin değişiklik günlüğü, olay kaydı ve bağımsız denetim (devlet
katılımından itibaren yıllık; içerik dağıtım ağı ve kayıt tutma yapılandırması dahil — ortak kayıtlarda kişisel veri
olmadığının doğrulaması).

## 4.5 Yaptırım merdiveni

| Basamak | Ne | Kayıt |
|---|---|---|
| 1 | Uyarı ve giderme süresi (30 gün) | Olay kaydı |
| 2 | Belge türü yetkisinin daraltılması (belirli bir tür için izin listesinin kapatılması) | Yetki penceresi kapanır |
| 3 | **Askıya alma** | Liste ve değişiklik günlüğü |
| 4 | **Çıkarma** (halef atanarak) — ETSI görünümünde "geri çekildi" | Liste, değişiklik günlüğü ve şeffaflık raporu |
| 5 | Sözleşmenin feshi; hukuki yollar | §5 |

Çıkarma **eski belgeleri** geçersiz kılmaz (belgenin verildiği tarih esas alınır); yalnız yeni belge verilmesi durur ve halef
belirlenmezse iptal listesi dondurulur. Bu çerçevede para cezası yoktur; konsey kurulduğunda kendi kararıyla getirebilir.

## 4.6 Olay müdahalesi

| Olay | Önem | Tepki |
|---|---|---|
| Belge verenin imza anahtarı sızdı | Kritik | Belge veren askıya alınır; sertifika iptal edilir; etkilenen belgeler iptal listesinde iptal edilir; yeniden belge verme planı; bildirim |
| Liste imza anahtarından şüphe | Kritik | Kaydırmalı ikinci sertifikaya geçiş; kök parmak izi sayfası ve şeffaflık duyurusu |
| Cüzdan çözümünde açık | Kritik ya da yüksek | Kademeli: sürüme göre cüzdan kanıtlarının iptali ya da tek bir cüzdan biriminin iptali; belge verenler yeni belgede reddeder |
| İptal listesi yayını iki döngü kaçtı | Yüksek | Doğrulayıcılar "doğrulanamadı" sonucunu verir; işletmeci müdahale eder |
| Belge türü kataloğuna erişilemiyor | Orta | Önbellekteki tür tanımı (bütünlük özetiyle) doğrulamayı sürdürür |

Önem seviyeleri: **kritik** — güvenin kendisi tehlikede, en geç 4 saatte bildirilir; **yüksek** — bir hizmet ya da bir
katılımcı etkileniyor, en geç 24 saatte bildirilir; **orta** — doğrulama sürüyor, olay kaydına girer. Bu yapı AB Uygulama
Tüzüğü 2025/847'nin karşılığıdır. Kişisel veri ihlali KVKK'ya 72 saat içinde bildirilir.

## 4.7 Uyuşmazlık

Katılımcılar arasındaki uyuşmazlık önce şema sahibi nezdinde (bugün Tamga teknik kurulu), sonra sözleşmedeki yargı yerinde
çözülür. Devletler arasında konsey yetkilidir; ağ düzeyinde üst merci yoktur. Kişinin şikâyeti belge verene ve veri koruma
kurumuna yapılır.

---

# 5. Katman 5 — Sözleşmeler

## 5.1 Sözleşme seti

Şablonlar işletmecidedir ve başvuru sırasında kuruma verilir; kamuya açık özetleri aşağıdadır.

| Sözleşme | Taraflar | Özet |
|---|---|---|
| **Katılım sözleşmesi (belge veren)** | Kurum ↔ şema sahibi | Kapsam, sınıf ve güvence, belge türü yetkileri, anahtar yönetimi (imza anahtarı kurumda), iptal listesi yayın yükümlülüğü, kimlik doğrulama seviyeleri, bildirimler, KVKK ekleri, hizmet seviyeleri, sorumluluk, fesih, halefiyet |
| **Barındırma eki** | Kurum ↔ işletmeci | Belge verme servisi işletmecide çalışır, imza anahtarı kurumda kalır; işletmecinin kayıt tutma kuralları; barındırılan kurumların listesi kamuya açıktır; barındırma oranı eşiği |
| **Doğrulayıcı kullanım koşulları** | Doğrulayıcı ↔ şema sahibi | Kapsam, veri azaltma, aşırı talep yasağı, belge alanlarını ve iptal listesi konumunu kaydetmeme, tek kullanımlık değer, "doğrulanamadı" sonucunu doğru işleme, kayıt bilgilerinin güncel tutulması |
| **Cüzdan sağlayıcısı sözleşmesi** | Cüzdan sağlayıcısı ↔ şema sahibi | Cüzdan örneği kanıtı ve anahtar kanıtı, güvenli donanım seviyesi, güncelleme ve iptal süreleri, kurtarma anahtarı tutmama |
| **Veri işleme sözleşmesi** | Belge veren ↔ yetkili kaynak ya da işletmeci (veri işleyen) | KVKK madde 12; eşleme tablosu; saklama süreleri |
| **Pilot katılımcı bildirimi** | Pilot katılımcıları | Pilotun sınırları sade dille: güven bugün imzalı listelere dayanır, çapa tek işletmecidedir, iptal en geç 90 dakikada etkili olur, katılım gönüllüdür, rıza her an geri alınır |
| **Halefiyet sözleşmesi** | İşletmeci ↔ emanetçi ya da konsey | Alan adı, kök sertifikalar, liste arşivi, anahtarların devri |

Her sözleşme bu çerçeveye ve Tamga Rulebook'a atıf yapar; bunlar değişirse sözleşmenin ilgili eki de güncellenir. Ana
yükümlülüğü değiştiren bir sürüm yeniden imza gerektirir (§8).

## 5.2 Hizmet seviyeleri

| Hizmet | Hedef |
|---|---|
| Güven listelerine erişim (`trust.`) | Aylık %99,9; bir sonraki güncelleme en geç 90 gün sonra; değişiklik en geç 24 saatte |
| Çapa günlüğü | Saatlik; kaçan döngü en çok bir |
| Belge türü kataloğu (`schemas.`) | %99,9; yayınlanan dosya değişmez |
| Belge verenin iptal listesi yayını | Sabit aralık (pilotta 60 dakika); iki döngü kaçarsa yüksek önem |
| Olay bildirimi | Kritik en geç 4 saat; yüksek en geç 24 saat |
| Kayıt değişikliği (kayıt kurumu) | En geç 5 iş günü |

Bu sayılar pilot verisiyle gözden geçirilir; değişiklik yeni bir sürümle yayınlanır.

## 5.3 Sorumluluğun paylaşımı

| Kim | Neyden sorumlu | Güvenceyle ilişkisi |
|---|---|---|
| Belge veren | Belge içeriğinin doğruluğu; kimlik doğrulamanın türün gerektirdiği seviyede yapılması; zamanında iptal | I3 ve nitelikli belgelerde "doğruluk karinesi"; I1'de ispat yükü doğrulayıcıdadır |
| Yetkili kaynak | Kaynak verinin doğruluğu | Belge verene karşı, sözleşmeyle |
| Cüzdan sağlayıcısı | Cüzdan kanıtlarındaki beyanların doğruluğu; anahtar korumasının beyan edilen seviyede olması | W2 ya da W3 beyanı yanlışsa sorumluluk sağlayıcıdadır |
| Doğrulayıcı | Politikasını doğru uygulaması; "doğrulanamadı" sonucunu kabul saymaması; kapsamına uyması | Yüksek riskli işlemde ek kimlik denetimi doğrulayıcının yükümlülüğüdür |
| İşletmeci (liste işletmecisi ve kayıt kurumu) | Liste bütünlüğü, yayın aralığı, kayıt doğruluğu, şeffaflık | Kasıt ve ağır ihmal dışında sınırlı (pilot katılımcı bildirimi) |
| Belge sahibi | PIN ve cihaz güvenliği; "belgeniz bir cüzdana eklendi" bildirimine itiraz | — |

## 5.4 Gizlilik ve fikrî mülkiyet

Kod Apache-2.0, belgeler CC BY 4.0 lisanslıdır; belge türü kataloğu açıktır ve aynalanabilir. "Tamga" markasının ve güven
işaretinin kullanımı sözleşmeye bağlıdır; kurumlara ait veriler gizlidir.

## 5.5 Ücretlendirme (yön kararı)

<!-- KARAR BEKLİYOR: katılım ücreti -->

**Kişiler için ücretsizdir** (eIDAS 2.0'daki gibi). Kurum ücret yapısı pilot sonunda katılım sözleşmesiyle belirlenir;
pilot ücretsizdir.

## 5.6 Fesih ve çıkış

Gönüllü çıkış §3.3'teki gibidir; fesihte iptal listesi dondurulur ya da halefe geçer; mevcut belgeler geçersiz kılınmaz;
kişisel verinin saklama süreleri KVKK'ya göredir.

## 5.7 Devir (halefiyet)

Alan adı vakıf kurulduğunda vakıf adına, o zamana kadar geçici işletmeci adına kayıtlıdır; transfer kilidi ve DNSSEC
uygulanır ve en az 10 yıl önceden yenilenir. İşletmecinin tasfiyesinde ya da devlete devirde alan adı, kök sertifikalar,
liste arşivi ve anahtar emaneti konseye ya da emanetçiye geçer.

## 5.8 Yargı yeri

Kurum ile işletmeci arasındaki sözleşmelerde kurumun bulunduğu devletin hukuku esastır; Türkiye'deki kurumlar için İstanbul
mahkemeleri yetkilidir. Devletler arasında konsey yetkilidir; kişinin hakları için kişinin kendi devletinin hukuku uygulanır.

---

# 6. Birlikte çalışabilirlik (üç seviye)

| Seviye | Tamga'da |
|---|---|
| 1. Taşınabilirlik | SD-JWT VC ve OpenID4VC; bir AB cüzdanı Tamga belgesini teknik olarak işleyebilir |
| 2. Güven | Güven listesi (ETSI TS 119 612 anlamında); XML görünümü; kök parmak izleri; karşılıklı tanıma alanı |
| 3. Hukuki tanıma | Devletler arasında tek taraflı tanıma; AB ile eIDAS Madde 14 anlaşması (uzun vadede) |

## 6.1 Dış listeler (federasyon)

Bir ülke listesinin ya da başka bir güven listesinin (örneğin bir devletin, devletin yetkilendirdiği kurumun ya da AB'nin
listesi) sahibi Tamga olmak zorunda değildir. Böyle bir liste, listelerin listesinde dört bilgiyle gösterilir:

- **Adres:** listenin özgün yayın adresi. Tamga ayrıca bir kopyasını tutar; kopya içeriği değiştiremez, çünkü imza her durumda
  özgün imzacıya karşı denetlenir.
- **Sabitlenmiş imzacı:** listeyi imzalayan sertifikaların parmak izleri. Parmak izleri Tamga'nın imzaladığı listelerin
  listesinde durur; imzacısı eşleşmeyen liste yüklenmez.
- **Kapsam:** listenin hangi roller (cüzdan sağlayıcısı, kimlik sağlayıcısı, belge veren, erişim sertifikası sağlayıcısı) ve
  hangi belge türleri için kefil olabileceği. Belge verenlerin sınıfı, güvence seviyesi ve tanınması da kapsamdan gelir.
- **Onay:** listenin hangi kararla, hangi tarihte eklendiği.

Liste sahibinde kalır; Tamga yalnız onu gösterir. Her dış listenin tazeliği ayrı izlenir: biri eksik ya da bayat olsa bile
Tamga listeleri ve diğer listeler etkilenmez; yalnız o listeye bağlı sorular "şu an denetlenemiyor" sonucunu verir. İlk okunan
biçim ETSI TS 119 602 ([[t:LoTE]], JSON) biçimidir.

| Kod | Kural |
|---|---|
| FD1 | Dış liste yalnız Tamga imzalı listelerin listesinde adresi, sabitlenmiş imzacı parmak izi ve kapsamıyla gösterilir; imzacısı orada yazılanla eşleşmeyen liste yüklenmez. |
| FD2 | Dış liste kapsamı dışındaki rollere ve belge türlerine kefil olamaz; kapsam dışı kayıtlar yok sayılır. |
| FD3 | Dış listenin eksik, bayat ya da doğrulanamaz olması Tamga listelerinin tazeliğini bozmaz; o listeye bağlı her soru "bilinmiyor" döner. |
| FD4 | Bir dış listenin eklenmesi, değişmesi ya da çıkarılması proje yönetimi onayıyla olur ve kayıtta belirtilir; boş alan içeren kayıt yayınlanmaz. |
| FD5 | Tamga belge türlerinde tür tanımının bütünlük özeti zorunludur; dış türlerde tür güveni dış listenin imzalı kaydından gelir. |

Bu mekanizma ile bir dış listenin eklenmesi ayrı kararlardır: mekanizma hazırdır, hangi listeye güvenileceğine her liste için
ayrıca karar verilir.

---

# 7. Devir planı — TDT üye devletlerine

| Adım | Ne devredilir | Nasıl |
|---|---|---|
| 1 | Ulusal liste işletmeciliği | Listedeki işletmeci alanı değişir; kök, kurum ve belge türü kimlikleri sabit kalır; devlete ait yeni imza sertifikası kaydırmalı olarak eklenir |
| 2 | Kayıt kurumu | Kayıt yetkisi devlete geçer; Tamga artık kayıt yapamaz |
| 3 | Ulusal kök sertifika | Kökün adı sabit kalır, işletmecisi değişir; ya da devletin kökü kaydırmalı olarak eklenir ve eski kök emekliye ayrılır |
| 4 | PID sağlayıcısı yeri | Devlet doldurur; yüksek kimlik doğrulama seviyeleri PID'e geçer |
| 5 | Ortak defter | En az iki bağımsız işletmeciyle defter aşaması; devlet işletmecileriyle devlet katılımı; liste arşivi aynen aktarılır ve eşdeğerlik testlerinden geçer |
| 6 | Bu belge | Konseyin mülkiyetine geçer; sürüm numaralandırması devam eder |

Devir hiçbir belgeyi, kaydı ya da kimliği geçersiz kılmaz.

---

# 8. Bu belgenin değişiklik yönetimi

- Sürümleme: anlamsal sürümleme; ana sürüm katılımcı yükümlülüğü değişince (yeniden imza gerekir), ara sürüm yeni kural ya
  da rol eklenince, yama sürüm düzeltmede artar.
- Her değişiklik bir karar kaydına dayanır ve Tamga ARF'nin "Ne değişti" sayfasında yayınlanır.
- Yayın yeri **`arf.tamga.network`**'tür; güven listelerindeki çerçeve bağlantısı sürümlü adresi taşır.

---

# 9. Pilot verisiyle gözden geçirilecek konular

Aşağıdaki maddeler yürürlüktedir; sayıları ve ayrıntıları pilot verisiyle gözden geçirilir ve değişiklik yeni bir sürümle
yayınlanır.

| Konu | Bölüm |
|---|---|
| Karma uyum rejimi (nitelikli belgeler için önceden, diğerleri için sonradan denetim) | §4.1 |
| ISO/IEC 17000 rol eşlemesi | §4.2 |
| Sorumluluğun paylaşımı | §5.3 |
| Yaptırım merdiveni, giderme süreleri ve hizmet seviyesi sayıları | §4.5, §5.2 |
| Veri koruma kurumuna şikâyet yolunun cüzdanda gösterilmesi | §3.6 |
| Hukuki inceleme | §1.4 |
| Yargı yeri | §5.8 |

---

# Kaynaklar

Bu belgenin dayandığı kararlar, şartnameler ve standartlar Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).
