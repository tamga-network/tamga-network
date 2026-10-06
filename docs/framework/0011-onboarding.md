---
document_id: FW-ONB-0001
title: "Katılım süreci"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-06
summary: >
  Tamga Network'e katılımın adımları: belge veren, doğrulayıcı, cüzdan sağlayıcısı ve devlet için başvuru, gereken belgeler,
  inceleme, uyum testleri, listeye giriş; ardından kayıt değişikliği, askıya alma ve çıkış. Kurallar Ek A §3.2–§3.3 ve Ek B'de,
  teknik adımlar geliştirici belgelerindedir.
---

# 1. Genel akış

Katılım her rol için aynı dört adımı izler. Süreç herkes için aynıdır; Tamga Wallet ve geçici işletmecinin
kendi hizmetleri de aynı yoldan geçer.

| Adım | Ne olur | Kural |
|---|---|---|
| 1. Başvuru | Kurum rolünü seçer, başvuru dosyasını ve gerekli belgeleri kayıt kurumuna verir | Ek A §3.2 |
| 2. İnceleme | Kayıt kurumu kapıyı denetler: alan adı, tüzel kişilik, imza yetkilisi, kapsam; eksik varsa tek seferde bildirir | RB-REG-01…09 |
| 3. Uyum testleri | Kurum kendi yazılımıyla açık uyum testlerini geçer; sonuç raporu başvuruya eklenir | Ek A §4.3, RB-ENF-01 |
| 4. Listeye giriş | Kayıt kurumu kurumu güven listesine ekler; değişiklik en geç 24 saatte yayınlanır | RB-OP-03 |

Kapı geçilmeden kayıt yapılmaz. Kayıt, yasal yetki vermez (Ek A §1.2, G-A). Bugün kayıt kurumu Türkiye için devlet adına
Tamga'dır; bir devlet kendi listesini devraldığında başvurular o devletin kayıt kurumuna yapılır.

# 2. Belge veren

| Adım | Ayrıntı |
|---|---|
| 1. Seviyeyi seçin | I1 (kayıtlı), I2 (sözleşmeli), I3 (akredite) ya da kamu (Ek A §3.2). Belge türünüzün rulebook'u asgari seviyeyi söyler (örneğin diploma için I2). |
| 2. Belgeleri hazırlayın | Aşağıdaki tablo. |
| 3. Anahtarları üretin | Belge imza anahtarı ve ayrı bir iptal listesi anahtarı (ES256); ikisi de kurumda kalır (RB-AP-02, RB-AP-03). Her biri için sertifika isteği (CSR) gönderilir. |
| 4. İnceleme ve sertifika | Kayıt kurumu başvuruyu denetler; ulusal kök sertifika kurum sertifikasını imzalar (RB-AP-01). |
| 5. Uyum testi | Tür tanımına ve uyum test vektörlerine karşı deneme belgesi üretilir; iptal listesi yayını ve cüzdan kanıtlarının denetimi test edilir. |
| 6. Listeye giriş ve yetki | Kurum listeye eklenir; her belge türü için ayrı yetki verilir (RB-REG-04). Kayıt sertifikası üretilir. |
| 7. İlk belge | Kurum kendi belge verme yazılımıyla ya da barındırılan belge verme servisiyle (kuruma bağlı API anahtarıyla, RB-OP-18) ilk belgeyi verir. |

**Gereken belgeler**

| Belge | I1 | I2 | I3 |
|---|---|---|---|
| Alan adı sahipliği (DNS doğrulaması) ve iletişim bilgisi | ✓ | ✓ | ✓ |
| AB ortak kayıt verileri: resmî ve ticari ad, resmî kimlik numarası (VKN ya da MERSİS), adres, iletişim, bağlı olunan veri koruma kurumu | ✓ | ✓ | ✓ |
| Belge türleri ve yetkili kaynağın adı | ✓ | ✓ | ✓ |
| Tüzel kişilik kanıtı (MERSİS ve Ticaret Sicil Gazetesi ya da kuruluş kanunu) ve imza yetkilisinin teyidi | — | ✓ | ✓ |
| İmzalı katılım sözleşmesi ve KVKK ekleri (Ek A §5.1) | — | ✓ | ✓ |
| Anahtarların HSM'de olduğunun ya da nitelikli e-Mühür kullanıldığının kanıtı | — | — | ✓ |
| Denetim ve kayıt tutma düzeni, olay bildirim süreleri, askıya alma prosedürü, sorumluluk sigortası | — | — | ✓ |

Teknik adımlar: [[GUIDE-0007]] ve [[GUIDE-0003]].

# 3. Doğrulayıcı

| Adım | Ayrıntı |
|---|---|
| 1. Kullanımları tanımlayın | Her kullanım için amaç, istenecek alanlar ve gizlilik politikası. Yalnızca tüzel kişiler kaydolur. |
| 2. Başvuru | AB ortak kayıt veri seti: resmî ve ticari ad, resmî kimlik numarası, adres, iletişim, hizmet açıklaması, kamu kurumu olup olmadığı, yetki türü, aracı ilişkisi, bağlı olunan veri koruma kurumu. |
| 3. Kapsam incelemesi | İstenecek alanlar veri azaltma ilkesiyle incelenir; kapsam kullanım başına tahsis edilir (RB-REG-08). |
| 4. Sertifikalar | Erişim sertifikası verilir; kayıt kurumu her kullanım için en çok 12 ay geçerli kayıt sertifikası üretir. |
| 5. Uyum testi | İmzalı istek, doğrulama hattı, bayat listede "doğrulanamadı" sonucu ve kapsam dışı alan istememe test edilir. |
| 6. Listeye giriş | Doğrulayıcı güven listesine eklenir. Barındırılan doğrulayıcıyı kullanacaksa bu da kayda yazılır. |

Teknik adımlar: [[GUIDE-0008]], ardından [[GUIDE-0002]] ya da [[GUIDE-0001]].

# 4. Cüzdan sağlayıcısı

| Adım | Ayrıntı |
|---|---|
| 1. Cüzdan çözümü beyanı | Platformlar, güvenli donanım seviyesi (W2 ya da W3), PIN ve biyometri, yedekleme modeli; Tamga Rulebook'taki cüzdan kurallarına uygun (Ek B §6). |
| 2. Sözleşme | Cüzdan sağlayıcısı sözleşmesi: kanıtlar, güvenli donanım seviyesi, güncelleme ve iptal süreleri, kurtarma anahtarı tutmama (Ek A §5.1). |
| 3. Uyum testleri | Cüzdan kuralları, cüzdan örneği kanıtı ve anahtar kanıtı, gösterim protokolü; cihaz üzerinde gösterim. |
| 4. Listeye giriş | Kanıt imza anahtarı listelerin listesine, cüzdan sağlayıcısı kaydına eklenir. Belge verenler bundan sonra bu cüzdanın kanıtlarını kabul eder. |

Cüzdan sağlayıcısını cüzdanı sunan kuruluş işletir; ağ yalnızca listeler. Listeye girmeden önce cüzdan geliştiricisi cüzdanını
sandbox'ta dener: kendi cüzdan sağlayıcısını sandbox listesine kaydettirir (bugün proje yönetimine başvuruyla) ve cüzdanını
sandbox'taki örnek kurumlarla, kimlik servisiyle ve doğrulayıcıyla sınar ([[GUIDE-0013]]).

Devletler katıldığında sertifikalı cüzdan çözümleri listesi gelir ve önceden denetim başlar (Ek A §4.1). Teknik adımlar:
[[GUIDE-0005]] ve [[GUIDE-0010]].

# 5. Devlet

| Adım | Ayrıntı |
|---|---|
| 1. Niyet | Devlet katılmaya istekli olduğunu bildirir; ilk devlet işletmecisi üretime geçtiğinde konsey kurulur (Ek A §1.6). |
| 2. Kök sertifika | Devletin kök sertifikası çevrimdışı törenle üretilir ve kaydırmalı olarak eklenir. |
| 3. Liste işletmeciliği | Ulusal listede işletmeci alanı devlete geçer; kurum, kök ve belge türü kimlikleri değişmez (RB-OP-14). |
| 4. Kayıt kurumu | Kayıt yetkisi devlete geçer; geçici işletmeci artık kayıt yapamaz. |
| 5. PID sağlayıcısı | Devlet atar; Tamga kimlik belgesi halefiyetle devredilir (RB-AP-ID-06). |

Devir hiçbir belgeyi, kaydı ya da kimliği geçersiz kılmaz (Ek A §7). Teknik adımlar: [[GUIDE-0011]].

# 6. Kayıttan sonra

| Durum | Ne olur | Kural |
|---|---|---|
| Kayıt değişikliği | Kayıt kurumu en geç 5 iş gününde işler. | RB-REG-09 |
| Sertifika ya da anahtar yenileme | En az 30 gün önce bildirilir; yeni kimlik eskisine halef olarak bağlanır, eski belgeler eski kayıtla doğrulanır. | Ek A §3.3, RB-REG-06 |
| API anahtarı | Barındırılan servisin anahtarı 90 günde yenilenir; sızıntı şüphesinde kurum iptal ister. | RB-AP-25 |
| Yeni belge türü | Belge türü yetkisi ayrıca istenir; yeni tür önce katalogda yayınlanmış olmalıdır. | RB-REG-04, RB-SCH-05 |

# 7. Askıya alma

Bir olay, denetim bulgusu ya da sözleşme ihlali yaptırım merdivenini başlatır (Ek A §4.5): önce uyarı ve 30 günlük giderme
süresi, sonra belge türü yetkisinin daraltılması, sonra askıya alma. Askıdaki kurum yeni belge veremez ve iptal listesi
yayınlayamaz; daha önce verdiği belgeler verildikleri tarihe göre geçerli kalır. Sorun giderilince kurum yeniden etkinleşir.
Kritik olaylarda (örneğin imza anahtarının sızması) kurum hemen askıya alınır (Ek A §4.6).

# 8. Çıkış

| Yol | Ne olur |
|---|---|
| Gönüllü çıkış | Bildirimden 90 gün sonra gerçekleşir; iptal listesi halef ya da liste işletmecisi tarafından son sürümünde dondurulur. |
| Çıkarma | Yaptırım merdiveninin dördüncü basamağıdır; halef atanır; ETSI görünümünde "geri çekildi" olarak yer alır. |
| Fesih | Sözleşme sona erer; mevcut belgeler geçersiz kılınmaz; kişisel verinin saklama süreleri KVKK'ya göredir. |

Hiçbir çıkış geçmişi silmez ve mevcut belgeleri geçersiz kılmaz (RB-REG-07). Doğrulayıcı ve cüzdan sağlayıcısı da aynı
yollarla çıkar.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).
