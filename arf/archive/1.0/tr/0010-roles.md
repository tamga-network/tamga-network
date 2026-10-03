---
document_id: FW-ROLE-0001
title: "Roller"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-02
summary: >
  Tamga Network'teki rollerin ayrıntısı: işletmeci ve liste işletmecisi, kayıt kurumu, belge veren, yetkili kaynak,
  doğrulayıcı, cüzdan sağlayıcısı, kişi, devlet ve denetçi. Her rol için ne yaptığı, bugün kimin üstlendiği, bağlı olduğu
  kurallar (Tamga Rulebook) ve katılmak için neye ihtiyaç duyduğu.
---

# 1. Genel bakış

Ana belgenin 3. bölümü rolleri bir tabloda tanımlar; bu sayfa her rolü ayrıntılı anlatır. Bağlayıcı kurallar Tamga
Rulebook'tadır (Ek B); burada her rolün hangi kural grubuna bağlı olduğu gösterilir. Bir kurum birden çok rol üstlenebilir
(örneğin bir bilet satıcısı hem belge veren hem doğrulayıcıdır); her rol için ayrı kaydolur ve o rolün kurallarına ayrı ayrı uyar.

İki temel ayrım bütün roller için geçerlidir:

- **Kayıt yetkilendirme değildir.** Ağa kaydolmak, bir kuruma belge verme yetkisi vermez; yasal yetki ağın dışından gelir
  (Ek A §1.2, G-A).
- **İmza anahtarı sahibinde kalır.** Tamga barındırdığı hiçbir hizmette bir kurumun imza anahtarını tutmaz (RB-OP-08).

| Rol | Bugün kim | Kurallar | Katılım |
|---|---|---|---|
| İşletmeci ve liste işletmecisi | Tamga, geçici işletmeci | RB-OP | — |
| Kayıt kurumu | Tamga, devlet adına geçici olarak | RB-REG | — |
| Belge veren | Üniversiteler, bilet satıcıları; Tamga kimlik servisi (kimlik belgesi için, geçici) | RB-AP, RB-AP-ID | [[FW-ONB-0001]] §2 |
| Yetkili kaynak | Kurumların kayıt sistemleri | RB-AS | Belge verenin sözleşmesiyle |
| Doğrulayıcı | İşverenler, web siteleri, kapılar | RB-RP | [[FW-ONB-0001]] §3 |
| Cüzdan sağlayıcısı | Tamga Wallet (ağın ilk cüzdanı) | RB-WP | [[FW-ONB-0001]] §4 |
| Kişi (belge sahibi) | Cüzdanı kullanan herkes | RB-H | Gönüllü |
| Devlet | Henüz yok; her üye devlet için yer ayrılmıştır | Ek A §1.6, §7 | [[FW-ONB-0001]] §5 |
| Denetçi | Bugün öz beyan; devletler katılınca bağımsız kuruluşlar | Ek A §4 | — |

# 2. İşletmeci ve liste işletmecisi

**Ne yapar.** Ağın ortak altyapısını işletir: listelerin listesini ve ulusal güven listelerini derler, imzalar ve yayınlar;
çapa günlüğünü saatlik imzalar; belge türü kataloğunu değişmez dosyalar olarak yayınlar; şeffaflık raporunu çıkarır; açık
kaynak paketleri yayınlar. AB'deki karşılığı güven listesi işletmecisidir ([[t:TLSO]]).

**Bugün kim.** Tamga, geçici işletmeci olarak ve her ulusal liste için o devlet adına (`status = "provisional"`,
`on_behalf_of`). Vakıf kurulduğunda işletmecilik ona, ulusal listeler devletlere devredilir (Ek A §7).

**Yükümlülükler.** Ek B §2 (RB-OP-01…18): listelerin sürüm zinciri ve yayın aralığı, en az iki kaydırmalı imza sertifikası,
kök parmak izlerinin yayını, herkese açık değişiklik günlüğü, imza anahtarı tutmama, barındırma oranı eşiği, toplu ve
kişisiz istatistik, üç aylık şeffaflık raporu, alan adının korunması, devirde kimliklerin değişmemesi.

**Neye ihtiyaç duyar.** Kök sertifika töreni, KMS ya da HSM'de imza anahtarları, yayın altyapısı (güven listeleri,
katalog), olay müdahale düzeni.

**Sınırı.** İşletmeci kayıt kurumu rolünü de yürütse bile bir kurumun belge içeriğine, kişisel verisine ya da imza anahtarına
erişmez; ortak kayıtlarda kişisel veri yoktur (RB-GEN-01).

# 3. Kayıt kurumu

**Ne yapar.** Belge verenleri, doğrulayıcıları ve cüzdan sağlayıcılarını kaydeder; belge türü yetkilerini izin listesiyle
verir; doğrulayıcıların kapsamını veri azaltma ilkesiyle inceler; doğrulayıcılara ve belge verenlere
[[t:registration-certificate|kayıt sertifikası]] üretir. **Kaydeder, onaylamaz:** yasal yetkiyi denetlemez, kaydeder.

**Bugün kim.** Tamga, Türkiye için devlet adına geçici olarak. Devirde kayıt yetkisi devlete geçer ve Tamga artık kayıt
yapamaz (Ek A §7, adım 2).

**Yükümlülükler.** Ek B §3 (RB-REG-01…09): ulusal kayda yalnızca sahibinin yazması, yeni belge vereni yalnızca etkin bir kök
sertifikaya bağlama, belge türü yetkisinin varsayılan kapalı olması, sertifika değişiminde halef kaydı, çıkışın eski kayıtları
geçersiz kılmaması, kayıt değişikliğini en geç 5 iş gününde yapma.

**Neye ihtiyaç duyar.** Kayıt aracı, ayrı bir kayıt kurumu imza anahtarı (listelerin listesinde yayınlanır), başvuru
inceleme süreci.

# 4. Belge veren

**Ne yapar.** Kişiye, kendi kayıtlarındaki bilgiye dayanan bir [[t:credential|belge]] verir ve gerektiğinde iptal eder: üniversite
öğrenci belgesi ve diploma, bilet satıcısı etkinlik bileti verir. Belgeyi kendi anahtarıyla imzalar ve iptal listesini sabit
aralıkla yayınlar. AB'deki karşılığı elektronik öznitelik belgesi sağlayıcısıdır (Attestation Provider).

**Bugün kim.** Ağa katılan kurumlar. Kimlik belgesi için Tamga kimlik servisi, devletin PID sağlayıcısı atanana kadar
geçici belge verendir (Identity Rulebook).

**Yükümlülükler.** Ek B §4 (RB-AP-01…25): kurum sertifikasının ulusal köke zincirlenmesi, imza anahtarının kurumun
denetiminde olması, belge vermeden önce cüzdan örneği kanıtını ([[t:WIA]]) ve anahtar kanıtını (KA) denetleme, türün
gerektirdiği kimlik doğrulama seviyesini sağlama, işlem kodunu ayrı kanaldan gönderme, eşlemede karşılığı olmayan veri için
belge vermeme, iptal listesini sabit aralıkla yayınlama, kişiye "belgeniz bir cüzdana eklendi" bildirimi. Belge türüne özgü
kurallar Ek C'dedir.

**Neye ihtiyaç duyar.** Tüzel kişilik ve alan adı; ulusal köke zincirlenen X.509 sertifikası; imza anahtarı (I3'te HSM ya da
e-Mühür); yetkili kaynağa bağlantı; belge verme yazılımı (kendi yazılımı ya da barındırılan belge verme servisi — bu
durumda da imza anahtarı kurumda kalır); katılım sözleşmesi ve KVKK ekleri (Ek A §5.1).

# 5. Yetkili kaynak

**Ne yapar.** Belgedeki bilginin asıl kaydını tutar: üniversitenin öğrenci bilgi sistemi, bir kamu kaydı. Belge veren bilgiyi
buradan okur.

**Bugün kim.** Belge veren kurumların kendi kayıt sistemleri.

**Yükümlülükler.** Ek B §5 (RB-AS-01…04): belge verenin sözleşmesinde adlandırılmak ve veri işleme sözleşmesiyle bağlanmak,
kaynak verinin şemaya eşlemesini belgelemek, ulusal kimlik numarasını ortak şemalara aktarmamak.

**Neye ihtiyaç duyar.** Belge verenle güvenli bir bağlantı ve eşleme tablosu (örneğin programın ISCED-F kodu).

# 6. Doğrulayıcı (relying party)

**Ne yapar.** Kişiden, bir işlem için gereken belgeyi ister ve doğrular: işe başvuruda diploma, indirimde öğrenci belgesi,
kapıda bilet, web sitesine girişte takma ad. Kendi yazılımını çalıştırabilir ya da barındırılan doğrulayıcıyı
([[t:intermediary|aracı]], Tamga Verify) kullanabilir.

**Bugün kim.** Kaydolan işverenler, web siteleri ve etkinlik kapıları.

**Yükümlülükler.** Ek B §7 (RB-RP-01…13, RB-RP-ID-01): kayıtlı olmak ve kapsamını aşan alan istememek, imzalı istek ve
şifreli yanıt, şartnamedeki doğrulama hattını eksiksiz uygulamak, "doğrulanamadı" sonucunu ret gibi işlememek, alan
değerlerini log ve sonuç nesnesine yazmamak, web girişinde hesap anahtarı olarak site başına takma adı kullanmak.

**Neye ihtiyaç duyar.** Tüzel kişilik; her kullanım için amaç ve gizlilik politikası; [[t:access-certificate|erişim sertifikası]]; kayıt
sertifikası; doğrulama yazılımı ve güncel güven listeleri.

# 7. Cüzdan sağlayıcısı

**Ne yapar.** Kişinin belgelerini tuttuğu ve gösterdiği cüzdanı sunar; cüzdan birimlerini kaydeder; her işlem için cüzdan örneği
kanıtı (WIA) ve anahtar kanıtı (KA) imzalar; cüzdan çözümünde açık bulunursa kanıtları iptal eder. Ağ cüzdan seçmez, tanır:
kurallara uyan ve uyum testlerini geçen her cüzdan ağda çalışır.

**Bugün kim.** Tamga Wallet: ağın ilk cüzdanı; ayrı bir ürün ve açık kaynaktır. Sağlayıcı servisi geçici olarak ağın
altyapısında çalışır ve cüzdanın kendi adresine taşınır. Tamga Wallet ağın kurallarına her cüzdan gibi uyar.

**Yükümlülükler.** Ek B §6 (RB-WP-01…13): anahtarların güvenli donanımda üretilmesi ve dışa aktarılamaması, yazılım anahtarlı
cüzdana belge verilmemesi, her gösterimde PIN ya da biyometri, alanların tek tek gösterildiği onay ekranı ve aşırı talep
uyarısı, doğrulayıcı başına ayrı kopya, gösterim günlüğünün cihazda kalması, kurtarma anahtarı tutmama, sürüm bazında iptal.

**Neye ihtiyaç duyar.** Cihaz kanıtı (Apple App Attest, Android key attestation), kanıt imza anahtarı (listelerin listesinde
yayınlanır), cüzdan çözümü beyanı, uyum testleri, cüzdan sağlayıcısı sözleşmesi.

# 8. Kişi (belge sahibi)

**Ne yapar.** Belgelerini cüzdanında taşır ve kime, hangi alanları göstereceğine kendisi karar verir.

**Hakları ve yükümlülükleri.** Ek B §8 (RB-H-01…07): katılım gönüllüdür ve rıza her an geri alınır; her gösterimde istenen
alanları görür ve tek tek onaylar; gösterim günlüğü cihazında kalır; küresel bir tanımlayıcısı yoktur; "belgeniz bir cüzdana
eklendi" bildirimine itiraz edebilir; PIN ve cihaz güvenliğinden sorumludur; şikâyet yolu belge veren, şema sahibi ve KVKK
Kurumudur.

**Neye ihtiyaç duyar.** Güvenli donanımı olan bir telefon ve kurallara uyan bir cüzdan.

# 9. Devlet

**Ne yapar.** Kendi ulusal güven listesinin ve kayıtlarının tek yazarıdır; kayıt kurumunu ve liste işletmeciliğini devralır;
ulusal kök sertifikayı işletir; PID sağlayıcısını atar. Konsey kurulduğunda üye kabulü, ortak belge türleri ve protokol
yükseltmeleri üçte iki oyla karara bağlanır. Sınır ötesi tanıma tek taraflıdır.

**Bugün kim.** Henüz katılan devlet yoktur; Türk Devletleri Teşkilatı üyeleri ve gözlemcileri için yer ayrılmıştır. Türkiye
listesini bugün Tamga devlet adına geçici olarak işletir.

**Kurallar.** Ek A §1.6 (yönetişim organları), §3.3 (devlet katılımı ve çıkışı), §7 (devir planı); ana belge §8.

**Neye ihtiyaç duyar.** Liste işletmecisi olacak bir kamu kurumu, kök sertifika töreni, imza anahtarları ve yayın altyapısı.
Devir hiçbir belgeyi, kaydı ya da kimliği geçersiz kılmaz.

# 10. Denetçi

**Ne yapar.** Katılımcıların kurallara uyduğunu değerlendirir: uygunluk değerlendirmesi (I3 ve nitelikli belgeler için
önceden), şikâyet ya da olay üzerine denetim, yıllık bağımsız denetim.

**Bugün kim.** Bugün uyum öz beyan ve açık uyum testleriyle gösterilir; şema sahibi ve geçici akreditasyon kurumu Tamga'dır.
Devletler katıldığında ulusal akreditasyon kurumu ve bağımsız uygunluk değerlendirme kuruluşları gelir (Ek A §4.2).

**Kurallar.** Ek A §4 (uyum rejimi, ISO/IEC 17000 rolleri, uyum testleri, gözetim, yaptırım merdiveni, olay müdahalesi);
Ek B §10 (RB-ENF).

**Neye ihtiyaç duyar.** Uyum test vektörleri, değişiklik günlüğü, şeffaflık raporları, olay kaydı ve kural kaynakları (Ek E §3).

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).
