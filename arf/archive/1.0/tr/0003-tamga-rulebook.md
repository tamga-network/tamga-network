---
document_id: FW-RB-0001
title: "Ek B — Tamga Rulebook"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-02
summary: >
  Tamga ağına katılan her rolün (işletmeci ve liste işletmecisi, kayıt kurumu, belge veren, yetkili kaynak, cüzdan
  sağlayıcısı, doğrulayıcı, belge sahibi) uyması gereken bağlayıcı, numaralı kurallar. Her kural bir değişmezden ya da
  karardan türetilmiştir; bu belge yeni kural üretmez, kuralları rol bazında toplar ve "MUST" diliyle ifade eder. EUDI ARF
  Annex 2 (High-Level Requirements) karşılığıdır.
---

# Rulebook yapısı

Tamga [[t:rulebook|Rulebook]], ağdaki **bütün katılımcılar ve bütün belge türleri** için ortak kuralları toplar. EUDI [[t:ARF|ARF'deki]] gibi her
belge türünün kendi rulebook'u vardır ve bu kitaptan dallanır:

| Rulebook | Belge türü | Belge |
|---|---|---|
| Education Rulebook | öğrenci belgesi, diploma | [[FW-RB-0002]] |
| Identity Rulebook | Tamga kimlik belgesi | [[FW-RB-0003]] |
| Event Ticket Rulebook | etkinlik bileti | [[FW-RB-0004]] |

Bir belge türü rulebook'u bu kitaptaki kuralların hepsini devralır ve yalnızca o türe özgü kuralları ekler: kim verir, hangi
[[t:identity-proofing]] ile, hangi alanlarla, ne kadar süre geçerli, nasıl iptal edilir. Yeni bir belge alanı (örneğin sağlık),
yedi koşullu kontrol listesi (SG1–SG7) tamamlandıktan sonra yeni bir rulebook olarak eklenir (RB-SCH-05).

Her rolün ne yaptığı ve hangi kurallara bağlı olduğu [[FW-ROLE-0001]], katılımın adımları [[FW-ONB-0001]] sayfasındadır.

# 0. Okuma kılavuzu

- **Kural biçimi:** `RB-<ROL>-<NN>` · kural metni. Kuralların dayandığı kararlar ve şartnameler Ek E'dedir.
- **Anahtar kelimeler** RFC 2119 anlamındadır: **MUST** (zorunlu), **MUST NOT** (yasak), **SHOULD** (tavsiye; sapma
  gerekçelendirilir), **MAY** (isteğe bağlı).
- **Aşama notu:** bugün ağ **liste aşamasındadır**: güven imzalı listelere ve çapa günlüğüne dayanır. "Defter aşaması"
  ibaresi taşıyan kurallar ortak defter kurulduğunda yürürlüğe girer; o aşamada "liste ve çapa günlüğü" yerine "ortak defter"
  okunur. Kural metni değişmez.
- Kurallar değişmezler belgesine yeni kod eklemez; oradaki kodların rol bazlı görünümüdür. Bir kuralı değiştirmek için
  kaynak belgeyi değiştirin.

Roller: GEN (herkes) · OP (işletmeci, liste işletmecisi — [[t:TLSO]]) · REG (kayıt kurumu) · AP ([[t:issuer|belge veren]]) ·
AS ([[t:authentic-source|yetkili kaynak]]) · WP ([[t:wallet-provider|cüzdan sağlayıcısı]]) · RP ([[t:verifier|doğrulayıcı]]) · H ([[t:holder|belge sahibi]]) · SCH (tür ve şema).

---

# 1. RB-GEN — Tüm katılımcılar

| # | Kural |
|---|---|
| RB-GEN-01 | Katılımcı, ortak kayıtlara (güven listesi, çapa günlüğü, ortak defter), loglara ve API yanıtlarına **MUST NOT** kişisel veri, belge içeriği ya da belge özeti yazmak. |
| RB-GEN-02 | Katılımcı güven verisini **MUST** şartnamedeki doğrulama kurallarına uygun okumak: imzayı, sürüm zincirini ve tazeliği denetlemeden hiçbir liste kaydını kullanmamak. Ağın açık kaynak paketlerinin (`@tamga-network/trust`) kullanılması **SHOULD**; kendi uygulamasını yazan katılımcı uyum testlerini geçer. |
| RB-GEN-03 | Güven kaynağı bayat (`next_update` geçmiş) ya da erişilemez ise sonuç **MUST** `INDETERMINATE`/`UNKNOWN` olmak; asla `ACCEPTED`, asla `REJECTED`. |
| RB-GEN-04 | Bilinmeyen `list_format_version` ya da (defter aşamasında) bilinmeyen sözleşme sürümü görüldüğünde bileşen **MUST** durmak ve alarm vermek; kabul etmek yasaktır. |
| RB-GEN-05 | Hiçbir Tamga altyapı bileşeni **MUST NOT** IP adresi loglamak (ham, özetlenmiş ya da kısaltılmış). Hata ayıklama logu en çok 7 gün tutulur ve IP içermez. |
| RB-GEN-06 | Loglar ve denetim kayıtları alan **adı** taşıyabilir; alan **değeri** ve iptal listesi konumu (`idx`) **MUST NOT**. |
| RB-GEN-07 | Katılımcı, Tamga'nın resmî `@tamga-network/*` paketlerini kullanıyorsa yayın kaynağı kanıtını (provenance) doğrulamalı (**SHOULD**); paketlerde `postinstall` betiği **MUST NOT**. |
| RB-GEN-08 | Dışa dönük güvence ifadeleri eIDAS adlarıyla (Low / Substantial / High; EAA, QEAA karşılığı, kamu belgesi) yapılır; kullanıcıya sayısal seviye gösterilmez (**SHOULD**). |
| RB-GEN-09 | Her katılımcı, kendisini ilgilendiren kritik olayı **MUST** en geç 4 saatte, yüksek önemdeki olayı en geç 24 saatte şema sahibine bildirmek. |
| RB-GEN-10 | Liste aşamasında her katılımcı kayıtların **tek işletmecinin imzasına** dayandığını ve iptalin en geç 90 dakikada etkili olduğunu bilir; kişilere bu sınırlar yazılı bildirilir. |

---

# 2. RB-OP — İşletmeci ve liste işletmecisi (TLSO)

Bugün Tamga geçici işletmecidir; devirde ulusal otoriteye geçer.

| # | Kural |
|---|---|
| RB-OP-01 | Her liste (`lotl`, `tl-<cc>`) **MUST** `operator {name, status, on_behalf_of}` taşımak; geçici işletmecilik süresince `status = "provisional"`. |
| RB-OP-02 | Liste sürümleri **MUST** monoton artmak ve `previous_version_hash` taşımak; hiçbir satır silinmez, durum değişiklikleri `status_history`'ye eklenir. |
| RB-OP-03 | `next_update` **MUST** en çok 90 gün olmak; değişiklik olmasa da liste yeniden imzalanır; değişiklik **MUST** en geç 24 saatte yayınlanmak. |
| RB-OP-04 | Çapa günlüğü (`anchors.jsonl`) **MUST** saatlik imzalanmak (değişiklik yoksa da); her satır `previous_hash` taşır; satır silinmez. |
| RB-OP-05 | Liste imzası **MUST** en az iki kaydırmalı sertifikayla yapılmak; rotasyon en az 30 gün önce duyurulur; yeni anahtar eskisiyle imzalanır. |
| RB-OP-06 | Kök parmak izleri **MUST** `keys/root-fingerprints.json`'da, `tamga.network/trust-anchor` kalıcı sayfasında, Trust Framework'te ve sözleşme eklerinde aynı değerlerle yayınlanmak. |
| RB-OP-07 | Herkese açık bir değişiklik günlüğü (`CHANGELOG.md`) **MUST** tutulmak: kim, ne zaman, ne (ekleme, askı, çıkarma, yetki), gerekçe kodu. |
| RB-OP-08 | İşletmeci barındırdığı hiçbir hizmette **MUST NOT** imzalama anahtarı tutmak (belge verenin imza ve iptal listesi anahtarları kurumundur). |
| RB-OP-09 | İşletmeci **MUST NOT** barındırılmış bir liste dizinleme hizmeti sunmak; dizinleme yazılımını açık kaynak olarak yayınlar. Barındırılan doğrulayıcı (aracı) sunulabilir; kuralları RB-OP-17'dedir. |
| RB-OP-10 | Barındırılan belge verenlerin listesi kamuya açıktır; oranları %30'u aşarsa konu konsey gündemine girer. |
| RB-OP-11 | Belge türü ve iptal listesi kullanım istatistikleri yalnızca toplu tutulur; 50'den küçük gruplar yayınlanmaz; belge veren, doğrulayıcı ya da belge bazında sayaç tutulmaz; ham sayaçlar en çok 13 ay saklanır. |
| RB-OP-12 | Şeffaflık raporu **MUST** üç ayda bir, gecikmesiz yayınlanmak. |
| RB-OP-13 | Alan adı vakıf kurulduğunda vakıf adına, o zamana kadar geçici işletmeci adına kayıtlıdır; transfer kilidi ve DNSSEC uygulanır; en az 10 yıl önceden yenilenir; halefiyet sözleşmesine bağlıdır. |
| RB-OP-14 | Türk Devletleri Teşkilatı önceliği: her ulusal liste ve her ARF rolü için **MUST** yer ayrılmış olmak (boş olsa da); devir yalnızca `operator` alanını değiştirir; `ca_id`, `issuer_id` ve `vct` **MUST NOT** değişmek. |
| RB-OP-15 | Ortak defter **MUST NOT** en az iki bağımsız defter işletmecisinin yazılı kabulü olmadan kurulmak; geçiş, liste arşivinin yeniden oynatılması ve eşdeğerlik testi geçilmeden tamamlanmış sayılmaz. |
| RB-OP-16 | Yayınlanan şema dosyaları (`schemas.`) **MUST** değişmez olmak; içerik dağıtım ağında yeniden biçimlendirme kapalıdır; kayıt (çapa) yayından **sonra** yapılır. |
| RB-OP-17 | Barındırılan doğrulayıcı, değer döndüren uçları **MUST** yalnızca sunumu açan doğrulayıcıya, güven listesindeki anahtarıyla imzalı ve en çok 60 saniyelik bir beyanla açmak; değerler en fazla bir kez ve en çok 5 dakika verilir; başka bir doğrulayıcıya yanıtın varlığı bile sızmaz; tarayıcıya giden hiçbir jeton **MUST NOT** değer okuma yetkisi taşımak. |
| RB-OP-18 | Barındırılan belge verme servisine dış erişim **MUST** yalnızca kuruma bağlı, kapsamı sınırlı bir API anahtarıyla olmak; anahtar sunucuda yalnızca özetiyle saklanır, log ve denetim kaydında yer almaz; anahtar yalnızca o kurumun hesabında geçerlidir. |

---

# 3. RB-REG — Kayıt kurumu

| # | Kural |
|---|---|
| RB-REG-01 | Kayıt kurumu **kaydeder, onaylamaz**: yasal yetki (diploma verme vb.) ağın dışındadır; ağ yalnızca ağ içindeki kapsamı tutar. |
| RB-REG-02 | Ulusal kayıtlara **MUST** yalnızca o ulusal kaydın sahibi (devlet; bugün devlet adına geçici işletmeci) yazmak. |
| RB-REG-03 | Yeni belge veren **MUST** yalnızca `ACTIVE` durumdaki bir kök sertifikaya bağlanmak. |
| RB-REG-04 | Belge türü yetkisi bir izin listesiyle verilir, varsayılan kapalıdır; zaman pencereli verilir; belge türü rulebook'unun "kim belge verebilir" kuralına göre verilir. |
| RB-REG-05 | Kayıt sınıfı ve güvence (`class`, `assurance`) katılım kapısına göre yazılır; `category` işareti yalnızca kamu ve nitelikli sınıf için. |
| RB-REG-06 | Sertifika değişikliği **MUST** yeni `issuer_id` ve `successor_id` ile kaydedilmek; eski kayıt silinmez. |
| RB-REG-07 | Çıkarma ya da çıkış **MUST NOT** mevcut kayıtları ve belgeleri geçersiz kılmak; `REVOKED` durumundaki belge verenin iptal listesini halef yayınlayabilir. |
| RB-REG-08 | Doğrulayıcı kaydı bir kapsamla yapılır; kapsam veri azaltma incelemesinden geçer (**SHOULD**). |
| RB-REG-09 | Kayıt değişikliği **SHOULD** en geç 5 iş gününde yapılmak. |

---

# 4. RB-AP — Belge veren

## 4.1 Kimlik ve anahtarlar

| # | Kural |
|---|---|
| RB-AP-01 | Belge veren kimliği **MUST** ulusal kök sertifikaya zincirlenen bir X.509 sertifikası olmak; `issuer_id` yaprak sertifikanın parmak izinden türetilir. |
| RB-AP-02 | Belge imzalama anahtarı **MUST** kurumun denetiminde olmak (I3'te HSM'de); **MUST NOT** Tamga'da tutulmak. |
| RB-AP-03 | İptal listesi imzalama anahtarı **MUST** belge anahtarından ayrı olmak. |
| RB-AP-04 | İmza ve anahtar kanıtında yalnızca ES256 (P-256) kullanılır. |

## 4.2 Belge verme

| # | Kural |
|---|---|
| RB-AP-05 | Belge verenin tanıtım bilgisindeki (metadata) her `vct` **MUST** kayıtta yetkilendirildiği bir tür olmak. |
| RB-AP-06 | Önceden yetkilendirilmiş akışta işlem kodu (`tx_code`) **MUST**; teklifle **ayrı bir kanaldan** gönderilir; kanal adresi yalnızca kurumun kayıtlı verisinden alınır; üç yanlış denemede teklif geçersiz olur. |
| RB-AP-07 | Teklif bağlantısı tek kullanımlıktır; ekranda gösterilen teklif 5 dakika, ayrı kanaldan gönderilen teklif en çok 72 saat geçerlidir. |
| RB-AP-08 | Tek kullanımlık değerin (`c_nonce`) tüketimi atomiktir; erişim belirteci en çok 5 dakika geçerlidir. |
| RB-AP-09 | Toplu verilen her kopya **MUST** farklı bir cihaz anahtarına bağlanmak (10 kopya); kopya ile iptal listesi konumu (`idx`) eşlemesi belge verende kalır, dışarı çıkmaz. |
| RB-AP-10 | Belge veren, belge vermeden **önce** cüzdanın cüzdan örneği kanıtını ([[t:WIA]]) ve anahtar kanıtını (KA) `wallet_providers[]` listesine karşı **MUST** doğrulamak ve güvenli donanım seviyesinin türün şartını karşıladığını denetlemek. |
| RB-AP-11 | Belge veren, türün gerektirdiği kimlik doğrulama seviyesini belge vermeden önce **MUST** sağlamak; bağlama yolu denetim kaydına yazılır, belgeye **MUST NOT**. T3 yalnızca yetkilendirme kodu akışıyla ya da yüz yüze sağlanır. |
| RB-AP-12 | Belgenin öznesi başvurandan farklıysa temsil yetkisi kanıtı **MUST** (veli, vekil). |
| RB-AP-13 | Kaynak veride eşleme tablosunda karşılığı olmayan değer için belge verme **MUST** durmak; tahmin üretilmez. |
| RB-AP-14 | `category` alanı yalnızca kayıt sınıfı kamu ya da nitelikli ise ve kayıtla aynı değerle yazılır; I1–I2'de **MUST NOT**. Belge sahibinin kimlik doğrulama seviyesi hiçbir alanda **MUST NOT** yer almak. |
| RB-AP-15 | Belge verildikten sonra kişiye "belgeniz bir cüzdana eklendi; siz değilseniz …" bildirimi **MUST** gönderilmek (kişisel veri asgari). |
| RB-AP-16 | Hata yanıtları kişisel veri içermez; işlem kodu yanıt dışında saklanmaz. |

## 4.3 İptal listesi

| # | Kural |
|---|---|
| RB-AP-17 | İptal listesi **MUST** sabit aralıkta ve değişiklik olmasa da yayınlanmak; aralık dışı "acil" yayın **MUST NOT**. |
| RB-AP-18 | Konum (`idx`) rastgeledir; adres opaktır (kurum, yıl ya da grup kodlamaz); listeler tür dışında bir ölçüte göre bölünmez; kapasite en az 100.000, doluluk en çok %80; `bits = 2`; `version` monoton artar. |
| RB-AP-19 | Yayın önce içerik dağıtım ağına, **sonra** çapa günlüğüne (defter aşamasında ortak deftere) yapılır; listede iptal biti yoktur, yalnızca çapa vardır. |
| RB-AP-20 | Askıya alınmış belge veren **MUST NOT** iptal listesi yayınlamak; halef yayınlayabilir. |
| RB-AP-21 | Kişi rızasını geri alırsa belge **MUST** iptal edilmek. |
| RB-AP-22 | Belge veren, belge kayıtlarını ve iptal listesi eşlemesini **MUST** düzenli yedeklemek; bu yedek, ortak liste ya da defter yedeğinden önceliklidir, çünkü iptal ancak bu kayıtla yapılabilir. |

## 4.4 Uzaktan kimlik doğrulama sağlayıcıları

| # | Kural |
|---|---|
| RB-AP-23 | Uzaktan kimlik doğrulama sağlayıcısı kullanılıyorsa belge veren **MUST** yalnızca sonuç özetini (seviye, oturum kimliği, zaman, sağlayıcı) saklamak; belge görüntüleri, yüz verisi ve OCR ham verisi belge verenin sisteminde **MUST NOT** tutulmak. |
| RB-AP-24 | Sağlayıcı sonucu bir **T seviyesine** eşlenir; eşleme [[SPEC-ID-0003]] tablosuna göredir; seviye doğrulayıcıya taşınmaz. |
| RB-AP-25 | Barındırılan servisi kullanan kurum API anahtarını **MUST** kendi sunucusunda tutmak (tarayıcıya, cüzdana, koda koymamak); anahtar 90 günde yenilenir (iki anahtar bir süre birlikte geçerlidir); sızıntı şüphesinde kurum iptal ister. |

## 4.5 RB-AP-ID — Kimlik belgesi sağlayıcısı

| # | Kural |
|---|---|
| RB-AP-ID-01 | Kimlik belgesi sağlayıcısı **MUST** uzaktan kimlik doğrulamayı yalnızca kendi servisinde yürütmek; kurumların belge verme servisleri, cüzdan ve doğrulayıcı uzaktan kimlik doğrulama sağlayıcısıyla **MUST NOT** konuşmak. |
| RB-AP-ID-02 | Belge vermeden önce aydınlatma metni **MUST** gösterilmek ve açık rıza alınmak; rıza yoksa kimlik doğrulama **MUST NOT** başlatılmak. |
| RB-AP-ID-03 | Kişi alanları belge verildikten sonra **MUST NOT** tutulmak; görüntü, özçekim, video, OCR ham verisi **MUST NOT** saklanmak; kalıcı kayıt yalnızca opak `subject_ref`, belge numarasının özeti, süre ve iptal listesi konumlarıdır. |
| RB-AP-ID-04 | Belge **MUST** `urn:tamga:id:IdentityAttestation:1` türünde, `category` alanı olmadan, iptal listeli ve en çok 2 yıl geçerli olmak; ulusal kimlik numarası **MUST** seçici paylaşımlı olmak. |
| RB-AP-ID-05 | Aynı belge numarası için ikinci etkin kimlik belgesi **MUST NOT** verilmek; yeniden doğrulama eskisini iptal eder. |
| RB-AP-ID-06 | Devletin PID sağlayıcısı atandığında sağlayıcı kaydı `successor_id` ile **MUST** devretmek ve yeni belge vermeyi durdurmak; mevcut belgeler süreleri dolana kadar geçerli kalır. |
| RB-AP-ID-07 | Kimlik belgesiyle birlikte site başına [[t:pseudonym|takma ad]] tohumu **MUST** ayrı ve gösterilemeyen bir türde (`urn:tamga:id:PseudonymSeed:1`) verilmek; tohum kişinin değişmeyen kimliğinden, belge özeti anahtarından **ayrı** bir anahtarla türetilir ve **MUST NOT** saklanmak (her doğrulamada yeniden hesaplanır); bu tür hiçbir doğrulayıcı kapsamında **MUST NOT** yer almak. |

---

# 5. RB-AS — Yetkili kaynak

| # | Kural |
|---|---|
| RB-AS-01 | Yetkili kaynak, belge verenin sözleşmesinde adlandırılır ve veri işleme sözleşmesiyle bağlanır. |
| RB-AS-02 | Kaynak verinin şemaya eşlemesi (ISCED-F, EQF vb.) belgelenir; karşılığı olmayan kayıt için belge verilmez. |
| RB-AS-03 | Ulusal kimlik numarası ağ düzeyindeki ortak şemaların hiçbirine aktarılmaz. |
| RB-AS-04 | Pilot, kaynak kurumun personeline düzenli yeni iş yüklemez (**SHOULD**). |

---

# 6. RB-WP — Cüzdan sağlayıcısı

| # | Kural |
|---|---|
| RB-WP-01 | Belge sahibinin anahtarları **MUST** cihazın güvenli bölgesinde (W2) ya da sertifikalı güvenli donanımda (W3) üretilmek; dışa aktarılamaz; bir tohumdan türetilmez. Yazılım anahtarlı (W1) cüzdana **MUST NOT** belge verilmek. |
| RB-WP-02 | Cüzdan örneği kanıtı (WIA) **MUST** cüzdan sürümünü, anahtarın donanımda olduğunu ve PIN ya da biyometrinin etkin olduğunu beyan etmek; cüzdan sağlayıcısının anahtarı `wallet_providers[]` listesindedir. |
| RB-WP-03 | Her gösterim **MUST** PIN ya da biyometri onayı gerektirmek. |
| RB-WP-04 | Onay ekranı istenen alanları **tek tek** gösterir; doğrulayıcının kapsamını aşan ya da aşırı taleplerde ayrı bir görsel blok ve gecikmeli düğme **MUST**. |
| RB-WP-05 | Bir doğrulayıcıya her zaman aynı kopya, farklı doğrulayıcıya farklı kopya gösterilir; aynı doğrulayıcı ve aynı tür için açılan alanlar tutarlıdır. |
| RB-WP-06 | Gösterim günlüğü cihazda kalır; sunucu yedeğine girmez, sunucuya gitmez. Yalnızca kişi, kendi parolasıyla şifreli bir dosya olarak dışa aktarabilir (AB TS10). |
| RB-WP-07 | Yedek yalnızca belgeleri ve listelerini taşır, anahtar taşımaz; cihaz değişiminde belgeler yeniden verilir. Cüzdan sağlayıcısı **MUST NOT** kullanıcı adına kurtarma anahtarı tutmak. |
| RB-WP-08 | Şemalar toplu çekilir; gösterim anında şema sunucusuna istek **MUST NOT**. Kullanıcı eylemi olmadan belge yenileme yalnızca [[ADR-0023]] koşullarında yapılır. |
| RB-WP-09 | Cüzdan, doğrulayıcının istemci kimliğini güven kaynağında çözmeyi dener; `presentation_definition` reddedilir; şifresiz yanıt modu kullanılmaz; `origin` öneki istemci kimliği olarak kabul edilmez. |
| RB-WP-10 | Cüzdan **MUST** "bu cüzdan Tamga güven listesinde" görünümünü (güven işareti) ve "anahtarlarım nerede" açıklamasını sunmak. |
| RB-WP-11 | Cüzdan çözümünde bir açık bulunursa cüzdan sağlayıcısı **MUST** sürüm bazında cüzdan kanıtlarını iptal edebilmek; tek bir cüzdan biriminin ihlalinde o birimi iptal eder. |
| RB-WP-12 | Kullanıcıya "geçersiz" ile "doğrulanamadı / bayat" farklı gösterilir; kullanılmış bir teklif için açık bir metin gösterilir. |
| RB-WP-13 | [[t:intermediary|Aracı]] doğrulayıcı üzerinden gelen istekte cüzdan **MUST** asıl doğrulayıcının kayıtlı adını göstermek, kapsamı onun kaydına göre denetlemek ve doğrulayıcı başına kopyayı asıl doğrulayıcıya göre ayırmak. |

---

# 7. RB-RP — Doğrulayıcı (relying party)

| # | Kural |
|---|---|
| RB-RP-01 | Doğrulayıcı **MUST** kayıtlı olmak (`relying_parties[]`), erişim sertifikasındaki alan adıyla (`dns_name`); isteklerde `client_id = x509_hash:` (HAIP 1.0 §5); kapsamını aşan alan **MUST NOT** istemek. |
| RB-RP-02 | İstek nesnesi **MUST** imzalı olmak; yalnızca DCQL sorgu dili kullanılır; yanıt `direct_post.jwt` (şifreli) ile gelir; tek kullanımlık değer (`nonce`) tektir; bir istekte en çok 3 belge ve 2 belge kümesi istenir. |
| RB-RP-03 | Doğrulama **MUST** şartnamedeki kanonik doğrulama hattıyla yapılmak (güven kaynağının tazeliği, ardından A–E adımları: imza, belge veren, belge türü yetkisi, iptal, cüzdan bağı). Belge türü yetkisi denetimi hiçbir yapılandırmayla atlanamaz; belge veren ve tür yetkisi denetimleri belgenin verildiği tarihe (`iat`) bakar. |
| RB-RP-04 | `issuer_id` `x5c` yaprak sertifikasının parmak izinden türetilir, `iss` alanından değil. |
| RB-RP-05 | Sonuç üç değerlidir; `INDETERMINATE` **MUST NOT** `REJECTED` gibi işlenmek; sonuç nesnesi yapılan ve atlanan denetimleri (`checks_performed`, `checks_skipped`) taşır. |
| RB-RP-06 | Doğrulayıcı her doğrulamada iptal listesi çekmez; listeleri önceden toplu çeker; `exp` ve `ttl` HTTP önbelleğinin önüne geçer. |
| RB-RP-07 | Doğrulayıcı kendi liste dizinleyicisini ya da güven kaynağı önbelleğini çalıştırır; Tamga'dan barındırılmış bir dizinleme hizmeti beklemez. |
| RB-RP-08 | Sonuç nesnesi ve loglar alan değeri ve iptal listesi konumu taşımaz; denetim kaydı reddedilen doğrulamalarda da tutulur; HTTP durum kodu sonucu kodlamaz. |
| RB-RP-09 | Politika "belge türü × belge veren sınıfı" olarak ifade edilir; doğrulayıcı ayrı bir belge sahibi güvence alanı beklemez; yüksek riskli işlemde ek kimlik denetimi doğrulayıcının sorumluluğudur. |
| RB-RP-10 | Ret sebebi doğrulayıcıya sızmaz (cüzdan tarafı); doğrulayıcı "doğrulanamadı" durumunda kullanıcıyı suçlayan bir ifade **SHOULD NOT** kullanmak. |
| RB-RP-11 | Yüz eşleştirmesi gerekiyorsa doğrulayıcı bunu kimlik belgesi ya da PID ile yapar; diploma ve öğrenci belgesi fotoğraf taşımaz. |
| RB-RP-12 | Barındırılan doğrulayıcıyı kullanan doğrulayıcı gösterimi **MUST** kendi sunucusundan, güven listesindeki anahtarıyla imzalı bir beyanla açmak ve değerleri kendi sunucusunda okumak; sayfa yalnızca durumu görür. |
| RB-RP-13 | Web sitesine giriş ("Tamga ile giriş yap") hesap anahtarı olarak **MUST** site başına takma adı kullanmak; site politikaları belge özeti ya da kimlik numarası **MUST NOT** istemek; takma ad imza, `aud` ve `nonce`, site ve iptal edilmemiş cüzdan örneği (WIA) ile doğrulanır. Birden çok takma ad yalnızca kaydında `pseudonyms: "multiple"` bulunan sitede kullanılır. |
| RB-RP-ID-01 | Kimlik belgesini kendi kayıtlarıyla eşleştirmek için alan kurum (belge verme servisi dahil) belgeyi **MUST** yalnızca kayıtlı doğrulayıcı kapsamındaki alanlarla ve tam doğrulama hattından geçirerek almak; eşleştirme anahtarlarını **MUST NOT** saklamak ya da loglamak. |

---

# 8. RB-H — Belge sahibi (kişi): haklar ve yükümlülükler

| # | Kural |
|---|---|
| RB-H-01 | Katılım gönüllüdür; rıza her zaman geri alınabilir ve bu durumda belge iptal edilir. |
| RB-H-02 | Kişi, her gösterimde hangi alanların istendiğini görür ve tek tek onaylar; kapsam dışı talepte uyarılır. |
| RB-H-03 | Kişi, cihazındaki gösterim günlüğünü görebilir ve parolalı bir dosya olarak dışa aktarabilir; günlük başka bir yolla cihazdan çıkmaz. |
| RB-H-04 | Kişi PIN, biyometri ve cihaz güvenliğinden sorumludur; cihaz kaybında belgeler yeniden alınır, anahtar geri getirilmez. |
| RB-H-05 | Kişinin "belgeniz bir cüzdana eklendi" bildirimine itiraz hakkı vardır; itirazda belge veren belgeyi iptal eder ve yeniden verir. |
| RB-H-06 | Kişinin küresel bir tanımlayıcısı yoktur; doğrulayıcılar gösterimleri birleştiremez (doğrulayıcı başına ayrı kopya). Belge veren tarafında birleştirilebilirlik kalan risk olarak yazılı bildirilir. |
| RB-H-07 | Şikâyet yolu: belge veren → şema sahibi → KVKK Kurumu. Cüzdan bu yolu kişiye **SHOULD** göstermek. |

---

# 9. RB-SCH — Türler ve şemalar

| # | Kural |
|---|---|
| RB-SCH-01 | Tür kimliği `vct = urn:tamga:<alan>:<Tür>:<ana sürüm>`; `vct#integrity` **MUST**; tür tanımı (Type Metadata) katalogdan gelir; defter aşamasında şema kimliği `schema_id = keccak256(vct)` olarak hesaplanır. |
| RB-SCH-02 | Yayınlanmış tür tanımı ya da JSON Schema **MUST NOT** değişmek; ara ve yama sürüm yeni `metadata_url` ve özet, ana sürüm yeni URN demektir. |
| RB-SCH-03 | Ağ düzeyindeki her ortak şema en az `tr-TR` ve `en-US` görüntüleme bilgisi taşır; `additionalProperties: false`; kişisel veri alanı `sd: never` olamaz. |
| RB-SCH-04 | Ağ düzeyindeki hiçbir ortak şema ulusal kimlik numarası alanı içeremez. |
| RB-SCH-05 | Yeni bir alan, yedi koşullu kontrol listesi (SG1–SG7) tamamlanmadan açılmaz; her tür için bir rulebook (ör. Education Rulebook) yayınlanır. |
| RB-SCH-06 | `DEPRECATED` durumdaki şema doğrulanabilir kalır; emekliye ayırma kararı toplu istatistikle verilir (en az 50'lik gruplar). |
| RB-SCH-07 | `extends` zinciri döngüsüzdür ve en çok 5 seviyedir; kök tür dışında `extends#integrity` zorunludur. |

---

# 10. RB-ENF — Uyum ve yaptırım

| # | Kural |
|---|---|
| RB-ENF-01 | Uyum vektörleri ve taahhüt testleri yayından önce zorunludur; testi geçmeyen bileşen üretime alınmaz. |
| RB-ENF-02 | Yaptırım merdiveni: uyarı → yetki daraltma → askı → çıkarma (halef atanarak) → fesih. Çıkarma eski belgeleri geçersiz kılmaz. |
| RB-ENF-03 | Pilotta bir durdurma koşulu oluşursa pilot durur; "izleyip görelim" yoktur. Kişisel verinin ortak kayda yazılması derhal durdurma sebebidir. |
| RB-ENF-04 | Bu kurallardan her sapma işletmecinin sapma kaydında gerekçesi ve kapanış tarihiyle tutulur; kayıtsız sapma ihlaldir. |
| RB-ENF-05 | Bu Rulebook'un bir maddesi kaynak belgeyle çelişirse kaynak geçerlidir ve Rulebook düzeltilir. |

---

# Tablo — Kural ve rol özeti

| Konu | OP | REG | AP | AS | WP | RP | H |
|---|---|---|---|---|---|---|---|
| Kişisel veri yok (ortak kayıt ve log) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Güven verisini şartnameye uygun okuma | ✓ | — | ✓ | — | ✓ | ✓ | — |
| Anahtar ayrımı ve denetimi | ✓ | — | ✓ | — | ✓ | — | ✓ (cihaz) |
| Yayın aralığı (liste, çapa, iptal listesi) | ✓ | — | ✓ | — | — | — | — |
| Kimlik doğrulama seviyesi | — | — | ✓ | — | — | (ek denetim) | — |
| Kapsam ve veri azaltma | — | ✓ | — | — | ✓ (uyarı) | ✓ | ✓ (onay) |
| Üç değerli sonuç | — | — | — | — | ✓ | ✓ | — |
| Şeffaflık ve eşik uyarıları | ✓ | — | — | — | — | — | — |

# Kaynaklar

Bu belgenin dayandığı kararlar, şartnameler ve standartlar Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).
