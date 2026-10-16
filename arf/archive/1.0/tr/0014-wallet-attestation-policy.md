---
document_id: FW-POL-0002
title: "Cüzdan Kanıtı Politikası (WIA ve KA)"
status: Active
version: 1.0.0
created: 2026-10-11
last_updated: 2026-10-16
summary: >
  Tamga güven listesindeki her cüzdan sağlayıcısının cüzdan örneği kanıtını (WIA) ve anahtar kanıtını (KA) nasıl verdiğini,
  hangi koşullarda iptal ettiğini ve iptali nasıl yayımladığını tek yerde toplayan politika (AB ARF VCR_05, WURevocation_03,
  WURevocation_09a) ve ETSI TS 119 471 madde 6–7 ile eşler. Ağ cüzdan işletmez; bu belge ağın, listedeki cüzdan sağlayıcılarından beklediği asgari politikadır ve
  ADR-0025, ADR-0047, cüzdan şartnamesi ve Tamga Rulebook kurallarından derlenmiştir.
---

# 1. Kapsam ve statü

Tamga Network hiçbir cüzdanı ve cüzdan sağlayıcısını işletmez; cüzdanları güven listesindeki kayıtlarıyla (`wallet_providers[]`)
tanır ([[ADR-0042]]). Bu politika, listedeki her [[t:wallet-provider|cüzdan sağlayıcısının]] verdiği iki kanıt için ağın asgari
kurallarını toplar:

- **Cüzdan örneği kanıtı ([[t:WIA]])** — cüzdan uygulamasının (Wallet Instance) belge verene kendini tanıttığı kısa ömürlü kanıt;
- **Anahtar kanıtı (KA)** — belge anahtarlarının hangi güvenli donanımda ve hangi kullanıcı doğrulamasıyla korunduğunu gösteren kanıt.

İkisi birlikte AB'deki cüzdan birimi kanıtının (WUA) karşılığıdır. Politika karar üretmez: kurallar [[ADR-0025]], [[ADR-0047]], [[SPEC-WALLET-0001]],
[[SPEC-PROTO-0001]] §11.1, Tamga Rulebook RB-WP ve RB-AP kuralları ve Trust Framework'ten (Ek A) derlenmiştir. Her cüzdan sağlayıcısı
bu kurallara uyar; kendi işletim ayrıntılarını (ör. kurulum, destek, bildirim kanalları) kendi politikasında yazar.

# 2. Cüzdan biriminin etkinleştirilmesi

| Kural | Kaynak |
|---|---|
| Cüzdan ilk kurulumda sağlayıcıya bir **birim anahtarı** kaydeder; bu anahtar yalnız cüzdan ile sağlayıcı arasında kullanılır, hiçbir kuruma gösterilmez; birimle ilgili istekler birim anahtarıyla imzalanır | [[ADR-0025]] K1 |
| Birim kaydı yalnız birim anahtarının parmak izini, çözüm ve sürümü, kayıt zamanını, iptal durumunu ve birime verilmiş WIA iptal listesi girişlerini tutar; **kişisel veri tutulmaz** | [[ADR-0025]] K1, WIA2 |
| Belge sahibi anahtarları cihazın güvenli bölgesinde (W2) ya da sertifikalı güvenli donanımda (W3) üretilir; dışa aktarılamaz, bir tohumdan türetilmez; yazılım anahtarlı (W1) cüzdana belge verilmez | RB-WP-01, [[SPEC-WALLET-0001]] WL1, WL3 |
| Cüzdan sağlayıcısı kullanıcı adına kurtarma anahtarı tutmaz | RB-WP-07 |
| **Cihaz kanıtı:** W3 seviyesinde sağlayıcı birimi etkinleştirirken ve W3 beyan eden her KA'dan önce platformun cihaz kanıtını (Apple App Attest, Android anahtar kanıtı, Play Integrity) doğrular; doğrulanmamış cihaza W3 KA vermez. W2'de cihaz kanıtı isteğe bağlıdır | RB-WP-17, [[ADR-0047]] K5 |
| Etkinleştirmede telefonsuz iptal yolu kurulur: sağlayıcı, kişinin telefonu olmadan birimi iptal edebileceği bir yol sunar; yol kullanıcı hesabı gerektirmez (ör. bir kez gösterilen iptal sırrı, sağlayıcıda yalnız yavaş özeti) | RB-WP-15, [[ADR-0047]] K3 |

# 3. WIA'nın verilmesi

| Kural | Kaynak |
|---|---|
| Biçim: OpenID4VCI 1.0 Ek E (`oauth-client-attestation+jwt`); AB TS3 §2.3.1 alanları: `sub`, `wallet_name`, `wallet_version`, `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk` | [[ADR-0025]] K2 |
| WIA cüzdan sürümünü, anahtarın donanımda olduğunu ve PIN ya da biyometrinin etkin olduğunu beyan eder | RB-WP-02 |
| WIA genel istemci kanıtı biçimindedir (OAuth attestation-based client authentication -07): sağlayıcı `iss` ve `iat`'ı gönderir; belge veren her istemci kanıtını tek yoldan WIA olarak doğrular (eski WUA yolu kaldırıldı), `iss`'i zorunlu tutmaz, kanıtta `iat` yoksa hoş görür, PoP'ta `iat` zorunludur; `client_status` yoksa belge verenin `clientStatus` ayarı geçerlidir (`optional` varsayılan, `required`: kimlik servisi) (paketler 0.5.2). WIA'nın `cnf` anahtarının DPoP anahtarı olması kuralı uygulanmaz: AB TS3 1.5.2 bu 1.5.1 kuralını geri aldı (2026-10-13 düzeltmesi) | [[ADR-0025]] 2026-10-13 notu |
| Ömür **24 saatten kısadır**; `client_status.exp` en az 31 gün ileridedir | [[ADR-0025]] K2, WIA1 |
| **Her belge işleminde yeni WIA**: yeni bir sahiplik kanıtı (PoP) anahtarı ve yeni, birbirine bağlanamaz bir iptal listesi girişi. Belge veren başına yeniden kullanım yoktur; böylece sağlayıcı cüzdanın kaç kurumla görüştüğünü öğrenmez | [[ADR-0025]] K2, WIA1 |
| WIA, sağlayıcının güven listesinde kayıtlı imza anahtarıyla imzalanır | RB-WP-02, [[SPEC-TRUST-0001]] |

# 4. KA'nın verilmesi

| Kural | Kaynak |
|---|---|
| Biçim: OpenID4VCI 1.0 Ek D (`typ` `key-attestation+jwt`); AB TS3 §2.3.2 alanları: `attested_keys`, `key_storage`, `user_authentication` (ISO 18045 seviyeleri), `certification`, `key_storage_status {status, exp}` | [[ADR-0025]] K3 |
| **Seviye gerçeği söyler:** KA'daki anahtar deposu seviyesi doğrulanmış duruma dayanır; doğrulanmamış bir beyan KA'ya yazılmaz. Sertifikasız donanım için sertifika bilgisi boş kalır | [[ADR-0025]] WIA3 |
| Bir KA bir paketteki bütün belge anahtarlarını taşır; her anahtar yalnız bir KA'da yer alır; KA bir kez kullanılır; belge isteğinin kanıtı (proof) `attested_keys[0]` ile imzalanır ve başlığında KA taşır | [[ADR-0025]] K3 |
| KA iptali **anahtar deposu türü başına ortak girişle** yapılır (AB TS3 Seçenek 1): yazılım deposu, Secure Enclave, StrongBox … her türün bir girişi vardır; birim kimliği KA'dan çıkarılamaz | [[ADR-0025]] K3 |

# 5. İptal koşulları

## 5.1 WIA

| Koşul | Sonuç | Kaynak |
|---|---|---|
| Kişi cüzdandan "Bu cüzdanı iptal et" der (cihaz devri, satış) | Birim ve ona verilmiş bütün WIA girişleri iptal edilir | [[ADR-0025]] K4 |
| Kişi cüzdanı sıfırlayıp verilerini siler | Birim iptal edilir (WIA bitleri), sonra kayıt silinir | [[SPEC-WALLET-0001]] §7.6 |
| Tek bir cüzdan biriminde ihlal bulunur | O birim iptal edilir | RB-WP-11 |
| Cüzdan çözümünde (bir sürümde) açık bulunur | O sürümün cüzdan kanıtları iptal edilir; belge verenler yeni belgede reddeder | RB-WP-11, Ek A §4.6 |
| Birim iptal edilir | O birime verilmiş bütün WIA girişleri iptal olur | [[ADR-0025]] WIA2 |
| Telefon kaybolur ya da çalınır; kişi telefonsuz iptal yolunu (§2) kullanır | Birim ve ona verilmiş bütün WIA girişleri iptal edilir; kimlik servisi o birimdeki belgelerini 24 saat içinde iptal eder; kurum belgeleri iptal edilmez, cihaz anahtarına bağlı oldukları için kullanılamaz | RB-WP-15, RB-AP-ID-12, [[ADR-0047]] K1, K3 |

Kaybolan ya da çalınan telefondan iptal **kullanıcı hesabı gerektirmez** ([[ADR-0047]] K3). AB WIAM_06'nın öngördüğü hesap yerine
etkinleştirmede kaydedilen bir iptal sırrı kullanılır; "kişinin açık isteği" ve "etkinleştirmede kayıt" şartları (WURevocation_10)
karşılanır. Tamga Wallet bunu kapatma kodu ve "Telefonumu kaybettim" sayfasıyla yapar.

## 5.2 KA

| Koşul | Sonuç | Kaynak |
|---|---|---|
| Bir anahtar deposu ya da güvenli donanım **türünün** güvenilirliğini bozan bir açık ya da ihlal bulunur | Sağlayıcı o türün KA girişini iptal eder; o türdeki anahtarlarla yeni belge verilmez | [[ADR-0025]] K3, Ek A §4.6, AB ARF WURevocation_09a |
| Bir sürümün ya da tek bir birimin ihlali | §5.1'deki gibi WIA ile; KA girişi türe aittir, birime değil | [[ADR-0025]] K3 |

## 5.3 İptalin kişiye bildirilmesi

| Kural | Kaynak |
|---|---|
| Sağlayıcı, kişinin cüzdan biriminin iptal edildiğini **cüzdan dışından** öğrenebileceği en az bir yol sunar; yol kişisel veri toplamayı zorunlu kılmaz | RB-WP-16, AB WURevocation_16, [[ADR-0047]] K4 |
| Sağlayıcı birimi kendi kararıyla (güvenlik açığı) iptal ettiyse bu yol en geç 24 saat içinde iptalin nedenini herkesin anlayacağı dille, açığın teknik ayrıntısını ya da ona bağlantıyı, hangi işlevlerin çalıştığını ve kişinin yeniden çalışan bir cüzdana nasıl kavuşacağını gösterir | RB-WP-16, AB WURevocation_14 |
| Cüzdanın kendisi de kişiye haber verebilir; bu, cüzdan dışı yolun yerini tutmaz | AB WURevocation_16 |

Tamga Wallet bu kuralı herkese açık güvenlik duyuruları ve kapatma koduyla açılan, veri tutmayan "Cüzdanımın durumu" sayfasıyla
karşılar.

# 6. İptalin yayımlanması

| Kural | Kaynak |
|---|---|
| Sağlayıcı iki Token Status List yayımlar: WIA girişleri ve KA türleri. Listeleri güven listesinde kayıtlı kendi anahtarıyla imzalar | [[ADR-0025]] K4 |
| WIA ve KA iptal listelerinin her biri en az 10.000 girişlidir; girişler birime bağlanamaz biçimde dağıtılır. Belge veren bu sınırın altındaki listeye dayanan WIA ya da KA'yı kabul etmez | [[ADR-0025]] K2, K4 ve 2026-10-13 notu; Uygulama Tüzüğü (AB) 2024/2979 Ek Ib |
| Liste adresleri her WIA'da (`client_status`) ve KA'da (`key_storage_status`) yer alır; sağlayıcının adresi güven listesindeki kaydındadır | [[ADR-0025]], [[SPEC-TRUST-0001]] |

# 7. Belge verenlerin denetimi

| Kural | Kaynak |
|---|---|
| Belge veren, belge vermeden önce WIA'yı ve KA'yı `wallet_providers[]` listesine göre doğrular ve güvenli donanım seviyesinin türün şartını karşıladığını denetler | RB-AP-10 |
| PAR ve token uçlarında WIA: imza, sağlayıcı anahtarının listede olması, süre, PoP (`cnf`), `client_status` iptal değil. Belge ucunda KA: imza, proof'un `attested_keys[0]` ile imzası ve nonce, `key_storage_status` iptal değil, `key_storage` seviyesi kurumun alt sınırını karşılıyor | [[ADR-0025]] K5 |
| Belge veren iptal edilmiş bir WIA ya da KA ile **belge vermez** | [[ADR-0025]] WIA4 |
| Kurumun anahtar deposu şartı tanıtım bilgisinde ilan edilir (`key_attestations_required {key_storage, user_authentication}`) | [[ADR-0025]] K5 |
| Kurum asgari iptal bakım süresi istiyorsa ilan eder: KA için `key_attestations_required.preferred_key_storage_status_period`, WIA için üstte `preferred_client_status_period` (saniye). Cüzdan şartı karşılamayan KA göndermez, bakım süresi kısa kalan WIA ve KA yerine sağlayıcıdan uzununu ister; sağlayıcı veremezse kurum belgenin süresini bakım süresiyle sınırlar (zincirleme iptal yapan kurumda) | AB ARF WUA_05a, WUA_32, ISSU_12c; AB TS3 §2.4 |

# 8. Olaylar ve bildirim

- Cüzdan çözümündeki açık kritik ya da yüksek önemde bir olaydır: kritik olay en geç 4 saatte, yüksek önemdeki olay en geç 24 saatte
  şema sahibine bildirilir (RB-GEN-09, Ek A §4.6).
- Cüzdan, "bu cüzdan Tamga güven listesinde" görünümünü ve "anahtarlarım nerede" açıklamasını sunar (RB-WP-10).
- Sağlayıcının güven listesindeki kaydı askıya alınır ya da çıkarılırsa belge verenler o sağlayıcının kanıtlarını kabul etmez;
  yalnız `ACTIVE` kaydın `ACTIVE` anahtarları kullanılır ([[SPEC-TRUST-0001]]).

# 9. ETSI TS 119 471 madde 6–7 ile eşleme (WURevocation_03)

AB, cüzdan sağlayıcısının WIA ve KA politikasının ETSI TS 119 471'in (V1.1.1, 2025-05; EAA hizmet sağlayıcılarının politika ve
güvenlik şartları) 6. ve 7. maddelerine uygun olmasını ister. Aşağıdaki tablo o maddeleri satır satır karşılar; "EAA" yerine "WIA ve
KA", "EAASP" yerine "cüzdan sağlayıcısı" okunur. Yükümlülükler listedeki her cüzdan sağlayıcısınındır; sağlayıcı bunları nasıl
karşıladığını kendi uygulama bildirgesinde yazar. "Pilottan önce" işaretli maddeler liste aşamasında hedeftir, gerçek kişilerle
pilottan önce zorunludur. TS 119 471'in EN 319 401'e yaptığı genel atıflar (ör. "EN 319 401 madde 7.2 uygulanır")
sağlayıcının EN 319 401'e uyması demektir.

| TS 119 471 | Konu | Bu politikada / sağlayıcının yükümlülüğü |
|---|---|---|
| 5 | Risk değerlendirmesi (EN 319 401 §5) | Sağlayıcı WIA ve KA hizmeti için yazılı bir risk değerlendirmesi yapar; yılda bir ve büyük değişiklikte günceller |
| 6.1.1 | Uygulama bildirgesi; iptal mekanizmasının bildirgede anlatılması (REQ-EAASP-6.1-02) | Sağlayıcı herkese açık bir uygulama bildirgesi yayımlar; bildirge bu politikaya atıf verir ve iptal mekanizmasını (§5, §6) anlatır |
| 6.1.2 | Sağlayıcının bağlanabilirliği; doğrulayıcılarla işbirliği yaparak kişiyi izlememe | İşlem başına yeni WIA ve birbirine bağlanamaz iptal girişi; KA girişi türe aittir (§3, §4). Sağlayıcı birim ile giriş arasındaki eşlemeyi hiçbir belge verene ya da doğrulayıcıya vermez ve bunu bildirgesinde yazar ([[ADR-0025]] WIA1, WIA2) |
| 6.2 | Şartlar ve koşullar; kabulün iradi bir eylemle ve kanıtlanabilir biçimde olması; kayıtların saklama süresi | Sağlayıcı kullanım koşullarını etkinleştirmeden önce gösterir; kabul cüzdanda iradi bir eylemle olur. Kabulün kanıtı **kişisel veri olmadan** tutulur (birim kaydında koşulların sürümü ve kabul zamanı). Saklama süresi koşullarda yazılır |
| 6.2 (REQ-EAASP-6.2.4-05) | Kişisel verinin nasıl kullanılacağının önceden anlatılması ve rıza | Birim kaydı kişisel veri tutmaz ([[ADR-0025]] WIA2). Sağlayıcı isteğe bağlı bir kişisel veri (ör. iletişim e-postası) toplarsa önce aydınlatır ve açık rıza alır |
| 6.3 | Bilgi güvenliği politikası (EN 319 401 §6.3) | Sağlayıcının yönetimince onaylanmış, yılda bir gözden geçirilen bir bilgi güvenliği politikası vardır |
| 6.4 | Kanıt politikası: kanıtın neyi beyan ettiği, biçim, doğrulama yolu, güven çerçevesi, sahiplik kanıtı | Bu politika ve sağlayıcının bildirgesi: WIA ve KA'nın beyanları ve biçimi §3–§4; güven çerçevesi Tamga ARF; doğrulama §7; sahiplik kanıtı `cnf` ve `attested_keys[0]` |
| 7.1.1 | Kanıt verme ve iptal kararlarında bağımsızlık; ticari baskıdan uzaklık; tarafsızlığı koruyan belgelenmiş yapı | Sağlayıcı iptal kararını (özellikle kendi başlattığı iptali) kimin hangi ölçütle verdiğini yazılı tanımlar; karar ticari ilişkiden etkilenmez |
| 7.1.2, 7.2, 7.3 | Görev ayrılığı, insan kaynakları, varlık yönetimi (EN 319 401) | EN 319 401'e göre; güvenilir roller tanımlanır |
| 7.4 | Erişim denetimi: kanıt verdirebilen her hesapta çok etkenli kimlik doğrulama; sürekli izleme ve alarm; kimlik doğrulama denemelerinin kaydı | Sağlayıcı WIA ya da KA verdirebilen, birim iptal edebilen ya da imza anahtarına erişebilen her işletim hesabında çok etkenli kimlik doğrulama kullanır; yetkisiz erişim denemelerini izler ve kaydeder (kayıtta kişisel veri yok, RB-GEN-06) |
| 7.5.1–7.5.2 | Anahtar üretimi: güvenli ortam, en az ikili denetim, belgelenmiş tören ve tören raporu, TS 119 312 algoritmaları | WIA, KA ve iptal listesi imza anahtarları ES256'dır (RB-AP-04). **Pilottan önce:** anahtarlar en az iki kişinin bulunduğu belgelenmiş bir törenle üretilir; tören raporu (roller, kanıt, tarih, anahtar envanteri ve parmak izleri) saklanır |
| 7.5.3 | Anahtar koruma: EAL 4+ ya da FIPS 140-2/140-3 Seviye 3 güvenli kriptografik cihaz; yedekler aynı korumada; cihaz emekliye ayrılınca anahtarın imhası | **Pilottan önce:** imza anahtarları donanım güvenlik modülünde ya da eşdeğer sertifikalı bir bulut anahtar hizmetinde durur; yedek ikili denetimle alınır. Liste aşamasında anahtar sunucuda şifreli tutulabilir; bu sapma sağlayıcının bildirgesinde yazılır |
| 7.5.4 | Anahtar kullanımı: ömür sonunda bırakma; yalnız kanıt verme ve iptal durumu için | Sağlayıcının imza anahtarı yalnız WIA, KA ve kendi iptal listelerini imzalar; anahtar yenilemesi güven listesindeki kayıtla yapılır ([[SPEC-TRUST-0001]]) |
| 7.5.5 | Cüzdana özgü: belgenin cihazın güvenli donanımına bağlanması; anahtarın güvenli donanımda olduğunun doğrulanması; seçici açıklama; birlikte sunum; bağlanabilirliğin azaltılması; toplu verilen kopyaların birbirinden bağımsız olması | KA yalnız güvenli donanımda üretilmiş anahtarları taşır; seviye doğrulanmış duruma dayanır ([[ADR-0025]] WIA3; W3'te cihaz kanıtı, RB-WP-17). Her kopya ayrı anahtardır, bir anahtar tek KA'dadır (§4; RB-AP-09). Seçici açıklama ve birlikte sunum belge biçimlerinindir (SD-JWT VC, mdoc) |
| 7.6 | Fiziksel ve çevresel güvenlik (EN 319 401) | Sağlayıcının sunucuları erişimi denetlenen bir veri merkezindedir |
| 7.7 | İşletim güvenliği; kapasite izleme | Sağlayıcı WIA ve KA uçlarının ve iptal listelerinin kapasitesini izler; WIA ve KA iptal listeleri en az 10.000 girişlidir ve dolmadan büyütülür (§6) |
| 7.8 | Ağ güvenliği: güvenli bölge; kullanılmayan hesap, hizmet ve portların kapatılması; şifreli kanallar | Bütün uçlar yalnız TLS ile; kullanılmayan hizmet ve portlar kapalı; imza anahtarına erişen bileşen ayrı bir bölgede |
| 7.9 | Açık ve olay yönetimi (EN 319 401) | §8: kritik olay 4 saatte, yüksek önemdeki olay 24 saatte şema sahibine bildirilir; cüzdan çözümünün açığı sürüm bazında iptalle sonuçlanabilir (RB-WP-11) |
| 7.10 | Kanıt toplama: kanıt verme olaylarının, güvenlik olaylarının, iptal isteklerinin ve sonuçlarının kaydı; kayıtlara erişimin ve saklama süresinin belgelenmesi | Sağlayıcı WIA ve KA verme, birim kaydı, iptal isteği ve iptal olaylarını kaydeder. Kayıt kişisel veri, iptal listesi konumu (`idx`) ve birim anahtarı parmak izi taşımaz (RB-GEN-06; REQ-EAASP-7.13-08: izlemeye izin vermeyen en az kayıt). Saklama süresi bildirgede yazılır |
| 7.11.2 | Yedek: işletmeyi sürdürmek için gereken verinin düzenli, tercihen uzakta yedeklenmesi ve yedeğin sınanması | Birim kaydı ve WIA girişi ile birim arasındaki eşleme düzenli olarak ve sunucu dışında yedeklenir; iptal ancak bu kayıtla yapılabilir (RB-AP-22 ile aynı ilke); geri yükleme yılda bir sınanır |
| 7.11.3 | Kriz yönetimi: ele geçirilmede kişilere ve ilişkili taraflara haber verme; verilmiş bütün kanıtların iptali | İmza anahtarı ele geçirilirse sağlayıcı şema sahibine bildirir (§8), güven listesindeki anahtarı askıya aldırır, etkilenen bütün WIA ve KA girişlerini iptal eder ve kişilere cüzdan dışı yoldan haber verir (§5.3) |
| 7.12 | Sonlandırma planı; kanıtlar geçersiz olduktan sonra kayıtların saklanması | Sağlayıcının yazılı bir sonlandırma planı vardır: verdiği son WIA ve KA'nın iptal bakım süresi (`client_status.exp`, `key_storage_status.exp`) bitene kadar iptal listelerini yayımlamayı sürdürür ya da bu görevi bir halefe devreder; belge verenlere ve şema sahibine önceden duyurur |
| 7.13 | Mahremiyet: kişiyi izlememe ve bağlamama; veri azaltma; kişisel veriyi dışa vermeme; en az kayıt | Birim kaydında kişisel veri yoktur ([[ADR-0025]] WIA2); sağlayıcı cüzdanın hangi kurumla görüştüğünü öğrenmez (işlem başına WIA, §3); birim verisi başka bir hizmete aktarılmaz |
| 7.14 | Tedarik zinciri (EN 319 401) | Sağlayıcı kanıt hizmetinde kullandığı dış hizmetleri (barındırma, anahtar hizmeti, cihaz kanıtı servisleri) listeler ve güvenlik şartlarını sözleşmeyle bağlar |

Uygulama Tüzüğü (AB) 2025/1569'un TS 119 471'e eklediği şartlar nitelikli ve kamu EAA içindir; Tamga'nın nitelikli olmayan WIA ve
KA'sına doğrudan uygulanmaz. Devlet katılımında ve nitelikli sınıfa geçişte ayrıca okunur.

# 10. Kararlar ve açık konular

| Konu | Durum |
|---|---|
| ETSI TS 119 471 madde 6–7 ile hizalama (WURevocation_03) | **Karar (2026-10-12, [[ADR-0047]] K8):** §9'da satır satır eşlendi; karşılığı olmayan maddeler sağlayıcının yükümlülüğü olarak eklendi |
| Kaybolan ya da çalınan cihazdan iptal (AB WIAM_06) | **Karar (2026-10-12, [[ADR-0047]] K3):** kullanıcı hesabı olmadan, etkinleştirmede verilen iptal sırrıyla (§2, §5.1; RB-WP-15) |
| Cüzdan iptalinin kişiye cüzdan dışından bildirilmesi (AB WURevocation_14/16) | **Karar (2026-10-12, [[ADR-0047]] K4):** her sağlayıcı en az bir cüzdan dışı yol sunar (§5.3; RB-WP-16) |
| Cihaz kanıtı (App Attest, Android anahtar kanıtı, Play Integrity) | **Karar (2026-10-12, [[ADR-0047]] K5):** W3'te zorunlu, W2'de isteğe bağlı (§2; RB-WP-17) |
| KA için anahtar başına iptal girişi (AB TS3 Seçenek 2) | Açık: güvenli donanıma geçişle birlikte ele alınacak ([[ADR-0025]] "sonra") |

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-16).
