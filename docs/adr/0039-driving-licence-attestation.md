---
document_id: ADR-0039
title: "Doğrulanmış sürücü belgesi bilgisi"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-04
summary: >
  Tamga kimlik servisi, kişinin fiziksel sürücü belgesini uzaktan kimlik doğrulama sağlayıcısıyla (belge + canlılık + yüz
  eşleştirme) inceler ve kartın üzerindeki sürücü bilgisini (sınıflar, geçerlilik, veren ülke) nitelikli olmayan bir EAA olarak
  verir: `urn:tamga:id:DrivingLicenceAttestation:1`, görünen adı "Sürücü belgesi bilgisi". Bu belge resmî sürücü belgesi
  değildir, mobil sürücü belgesi (mDL) de değildir: trafik denetiminde geçmez ve bunu kartta açıkça yazar. Ön koşul cüzdandaki
  kimlik belgesidir; yalnız SD-JWT VC; kimlik numarası, kısıtlama ve sağlık bilgisi taşımaz; süre kartın bitişi ya da 1 yıl.
  Yetkili makam dijital sürücü belgesi vermeye başlayınca yeni ihraç durur.
domain: Credentials
---

# Kısaca

Araç kiralama, araç paylaşımı, kurye ve sürücü işe alımı gibi işlerde karşı taraf "bu kişinin hangi sınıfta, geçerli bir
sürücü belgesi var mı" diye sorar. Bugün bunu kartın fotoğrafını alarak yapar. Bu kararla kişi kartını bir kez Tamga kimlik
servisinde doğrulatır ve sonucu cüzdanında taşır. Belge "bu kişi şu tarihte, yüzü eşleşen, gerçek görünen bir sürücü belgesi
kartı gösterdi; kartta şu sınıflar ve şu geçerlilik yazıyordu" der. Sürücü belgesinin kendisi değildir.

# Bağlam

- Proje yönetimi (2026-10-03) mağaza öncesi kapsama sürücü belgesini aldı ve belgenin kimlik belgesiyle aynı yoldan, uzaktan
  kimlik doğrulama sağlayıcısıyla verilmesini istedi. Yeni bir belge türü olduğu için önce bu karar yazıldı; kabul, sağlayıcının
  sınıfları okuduğunun doğrulanmasına bağlandı.
- **AB'de dijital sürücü belgesi resmî bir belgedir.** [[t:mDL]] (ISO/IEC 18013-5 mobil sürücü belgesi) yalnız sürücü
  belgesini vermeye yetkili makamın verebileceği belgedir. AB'nin yeni sürücü belgesi direktifi (2025) dijital sürücü
  belgesini üye devletin yetkili makamına bağlar ve onu [[t:EUDI-Wallet|EUDI Wallet'ta]] taşınacak biçimde tanımlar. Türkiye'de
  sürücü belgesini Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü verir. Tamga bu makamlardan biri değildir.
- [[ADR-0011]] ve [[ADR-0022]] Tamga kimlik servisini, devlet bir sağlayıcı atayana kadar çalışan geçici bir belge veren olarak
  tanımlar (`class: EAA`, `assurance: I2`). Aynı servis [[ADR-0021]] ile e-posta ve telefon belgeleri de veriyor. Sürücü
  bilgisi aynı rolün içine girer: **nitelikli olmayan bir [[t:EAA]]**, herkesin verebileceği türden.
- **Sağlayıcı bulgusu (2026-10-04).** Uzaktan kimlik doğrulama sağlayıcısının alan tanımları denetlendi: sürücü belgesi ayrı bir
  belge türüdür (`document_type = DL`); karttan belge numarası, veren ülke, veriliş ve son geçerlilik tarihi, "süresi geçmiş"
  olgusu ve **sınıf başına geçerlilik tarihleri** (`dl_class_code_<sınıf>_from` / `_to`; AM, A1, A2, A, B1, B, BE, C1, C1E, C,
  CE, D1, D1E, D, DE ve ulusal ekler F, G, M …) okunur. Kısıtlama kodu için ayrı bir alan yoktur; sınıf başına serbest metin
  `_notes` alanı vardır ve bu alan **okunmaz**. Hangi belge türlerinin kabul edileceği sağlayıcıda akış düzeyinde ayarlanır
  (`documents_allowed`); bu yüzden sürücü belgesi için ayrı bir akış tanımlanır.
- Kartı incelemek, kartın gerçek ve kişinin kartın sahibi olduğunu gösterir. **Belgenin bugün askıda ya da iptal olup
  olmadığını göstermez:** Tamga'nın resmî kayda erişimi yoktur. Belge bu sınırı açıkça taşır.

# Karar

## K1 — Ne olduğu, ne olmadığı

Belge, kartın incelendiği andaki **doğrulanmış sürücü belgesi bilgisidir**. Resmî sürücü belgesi değildir, mDL değildir, trafik
denetiminde ve resmî işlemlerde kullanılmaz. Bunu dört yerde açıkça söyler:

- Şema metadata'sındaki görünen ad ve açıklama: "Sürücü belgesi bilgisi — resmî sürücü belgesi yerine geçmez."
- Belgenin içinde her zaman açık (seçici paylaşımsız) bir alan: `not_official_licence: true`; görünen etiketi **"Resmî
  sürücü belgesi yerine geçmez."** (İngilizcesi: "Not an official driving licence."). Her doğrulayıcı bu alanı görür.
- Cüzdanda kartın ön yüzünde aynı ibare.
- Doğrulayıcı ekranlarında (Tamga Verify, örnek siteler) sonuçla birlikte aynı ibare.

Kartın görünüşü resmî sürücü belgesini andırmaz: AB sürücü belgesi deseni, bayrak, ay-yıldız, devlet arması ve "T.C." kullanılmaz.

## K2 — Tür adı

Proje yönetimi (2026-10-04) A seçeneğini seçti:

| | Değer |
|---|---|
| [[t:vct]] | `urn:tamga:id:DrivingLicenceAttestation:1` (kimlik servisinin öteki türleriyle aynı aile) |
| Görünen ad | **"Sürücü belgesi bilgisi"** / **"Driving licence information"** |
| Katalog yolu | `id/DrivingLicenceAttestation/1.0.0` |

ISO ve AB adları kullanılmaz: `org.iso.18013.5.1.mDL` docType'ı ve `org.iso.18013.5.1` namespace'i yalnız yetkili makamındır;
bunları kullanmak belgenin resmî mDL sanılmasına yol açar. Ürün ya da mağaza metninde "ehliyet", "dijital ehliyet", "mobil
ehliyet" denmez. Değerlendirilen öteki adlar (`DrivingLicenceCheck`, `DrivingEntitlementInfo`, `mobility:` alanı) Gerekçe'dedir.

## K3 — Alanlar (kişisel veri en az)

| Claim | Zorunlu | Seçici açıklama | Not |
|---|---|---|---|
| `given_name`, `family_name` | ✓ | ✓ | karttan; doğrulayıcı kişiyle eşleştirmek için |
| `birth_date` | ○ | ✓ | karttan; `age_over_18` türetilir |
| `driving_privileges` | ✓ | ✓ (dizi bütünüyle) | `[{ category, issue_date?, expiry_date? }]`; `category` kartta yazan sınıf (`B`, `A2`, `C1E` …; AB 2006/126 kodları, ulusal ekler aynen). Adı ISO 18013-5 veri öğesiyle aynı tutulur; biçim Tamga'nındır. Geliştirme evresinde dizi tek seçici alandır; sınıf başına açıklama sonraki sürüme kalır |
| `issuing_country` | ✓ | ✓ | ISO 3166-1 alpha-2 |
| `licence_issue_date` (○), `licence_expiry_date` (✓) | | ✓ | kartın kendi tarihleri |
| `document_number_hash` | ✓ | ✓ | belge numarasının anahtarlı özeti (HMAC-SHA256; kimlik belgesindeki gibi); numaranın kendisi yok |
| `verified_at` | ✓ | — | kartın incelendiği gün (tarih, saat yok) |
| `verification_method` | ✓ | ✓ | `remote-document-liveness-face` |
| `not_official_licence` | ✓ | — | her zaman `true`; K1 ibaresi |
| `iat`, `exp`, `status` | ✓ | — | K5 |

**Hiçbirinde yok:**

- Kimlik numarası (TCKN): Türkiye'deki yeni kartlarda yazılıdır ama yalnız kimlik belgesinde taşınır ([[SPEC-ID-0003]]/IDP10).
- Kısıtlama ve ek kodları (kartın 12. alanı): bir kısmı gözlük, işitme cihazı gibi **sağlık bilgisidir** (KVKK md. 6 özel
  nitelikli). Kodlar taşınmaz; `has_restrictions` gibi bir olgu da **taşınmaz** (proje yönetimi, 2026-10-04). Sağlayıcının
  `_notes` alanları hiç okunmaz.
- Fotoğraf, imza, adres, doğum yeri, kartı veren birim.

`category` claim'i yoktur (nitelikli değil, kamu kurumu belgesi değil; [[ADR-0022]] K2 ile aynı).

## K4 — Akış: kimlik belgesi ön koşul

Akış kimlik belgesininkiyle aynı protokoldedir ([[t:OpenID4VCI]] authorization code + PAR, [[t:WIA]] zorunlu); ön koşul cüzdandaki
**Tamga kimlik belgesidir** (proje yönetimi, 2026-10-04: seçenek B):

1. Kişi cüzdanda "Belge ekle → Sürücü belgesi bilgisi"ni seçer. Cüzdan PAR isteğine kimlik belgesinin **sunumunu** ekler
   (`identity_presentation`: [[t:SD-JWT-VC]] + [[t:KB-JWT]], `aud` = kimlik servisi, `nonce` = servisin `/nonce` ucundan, tek
   kullanımlık; yalnız `given_name`, `family_name`, `birth_date` açılır). İki taraf zaten aynı OpenID4VCI oturumundadır; ayrı bir
   OpenID4VP istek-yanıt turu açılmaz.
2. Kimlik servisi sunumu doğrular: kendi imzası, etkin (iptal edilmemiş, süresi geçmemiş) bir kimlik belgesi, yalnız üç alan.
   Kişi alanlarını saklamaz; akış kaydında yalnız anahtarlı bir **eşleşme özeti** (ad + soyad + doğum tarihi) ve bağlı kimlik
   kaydının kimliği durur.
3. Tarayıcıda sürücü belgesine özel aydınlatma ve açık rıza sayfası açılır (K1 ibaresi burada da yazar). Sağlayıcıda **yalnız
   sürücü belgesi kabul eden ayrı akış** başlar: belge + canlılık + yüz eşleştirme.
4. Sonuç: karttaki ad ve doğum tarihi aynı özete eşleşirse (Türkçe karakter ve büyük/küçük harf normalize) belge verilir.
   Eşleşmezse verilmez ve kişiye nedeni söylenir. Kart sürücü belgesi değilse, süresi geçmişse ya da **sınıflar okunamıyorsa
   belge verilmez** (sınıfsız belge yok; proje yönetimi, 2026-10-04).
5. Sağlayıcının kararı "inceleme" ya da "ret" ise kimlik belgesindeki kurallar aynen geçerlidir ([[ADR-0011]] K6).

Kimlik belgesi ön koşulu, kişinin yüzünün iki ayrı oturumda iki ayrı belgeyle eşleşmesini sağlar ve belgeyi kişinin cüzdanındaki
kimliğe bağlar. Bedeli ikinci bir sağlayıcı oturumudur (Gerekçe, seçenek B). Mağaza incelemesi kodu ([[ADR-0033]]) bu türde
kullanılmaz.

## K5 — Yaşam döngüsü

- `exp` = kartın bitiş tarihi ile kartın incelendiği günden **1 yıl** sonrasından erken olanı. Tamga kartın sonradan askıya
  alındığını göremediği için belge yılda bir yeniden doğrulamayla tazelenir.
- Belge [[t:status-list]] taşır. Tamga iptal eder: kişi isterse, silme isteğinde (`/erasure`), aynı belge numarası özetiyle yeni
  belge verilince (eskisi), cüzdan birimi iptal edilince ([[ADR-0025]]) ve **bağlı kimlik belgesi iptal edilince ya da yeniden
  verilince** (zincirleme: sürücü belgesi bilgisi kimlik belgesine bağlı kayıt tutar). Kimlik belgesinin silinmesi bağlı belgeyi
  de siler.
- Otomatik kopya yenileme ([[ADR-0023]]) açıktır; yenileme kartı yeniden incelemez, süreyi uzatmaz.

## K6 — Biçim

Yalnız [[t:SD-JWT-VC]]. [[t:mdoc]] temsili verilmez (proje yönetimi, 2026-10-04): [[ADR-0013]] ikinci biçimi kimlik belgesine ayırdı;
yüz yüze (ISO 18013-5) sunulan bir "sürücü belgesi" mdoc'u, resmî mDL okuyucularında resmî belge sanılma riskini artırır.

## K7 — Güven listesi ve şema

- Tamga kimlik servisinin [[t:trust-list|güven listesi]] kaydına bu tür eklenir (`class: EAA`, `assurance: I2`); gerçek ağ ve
  sandbox listelerinde.
- Şema geliştirme evresinde yerinde düzeltilir ([[ADR-0029]] K1): ilk sürüm `1.0.0`, alan adları kesinleşene kadar aynı yolda
  değişir; deneme belgeleri yeniden alınır.
- Sandbox'ta ([[ADR-0038]]) aynı tür, sahte sağlayıcıyla ve örnek kişilerle verilir; örnek kişilerden bazılarının uydurma
  sürücü belgesi vardır (biri süresi geçmiş).
- Sağlayıcıdaki sürücü belgesi akışı ayarla verilir; ayarlı değilse tür metadata'da ilan edilmez ve istek reddedilir
  ([[ADR-0021]] K5 ile aynı desen).

## K8 — Yetkili makam gelince

TDT-first ilkesine (D-GOV-5) göre bu tür geçicidir:

- Bir üye devletin yetkili makamı dijital sürücü belgesi (resmî mDL ya da onun SD-JWT VC karşılığı) vermeye başlayınca, o
  ülke için Tamga'nın yeni ihracı durur. Güven listesi kaydı `successor` ile resmî türe işaret eder; verilmiş belgeler süresi
  dolana kadar geçerli kalır.
- Resmî belge kendi türüyle (ISO/AB docType) gelir; Tamga türü ona dönüştürülmez ve devredilmez. Makam isterse Tamga'nın
  barındırdığı belge verme servisini `on_behalf_of` ile kullanabilir; o zaman da tür resmî türdür.
- Doğrulayıcılar geçiş döneminde iki türü birlikte isteyebilir ([[t:DCQL]] `credential_sets`: resmî tür ya da Tamga türü).

## K9 — Mağaza ve hukuk

- **Devlet izlenimi:** mağaza metni, ekran görüntüleri ve uygulama içi metin "ehliyet", "dijital ehliyet", "resmî" demez; kart
  K1'deki ibareyi taşır. Google "Government apps" beyanı **hayır** kalır.
- **Kimlik belgesi ve yüz verisi:** sağlayıcıya geçmeden önce aydınlatma ve açık rıza (kimlik akışındaki gibi, sürücü belgesine
  özel metinle).
- **KVKK:** Tamga bu veri için veri sorumlusudur; aydınlatma ve açık rıza metni sürücü belgesini kapsar. Sağlık bilgisi alınmaz (K3).
- **Hukuki inceleme:** gerçek kişilere ihracın açılmasından **önce** bir hukukçu, belgenin resmî belge taklidi ya da resmî belge
  yerine kullanılma riskini (Türk Ceza Kanunu belgede sahtecilik hükümleri, Karayolları Trafik Kanunu) ve doğrulayıcıların bu
  belgeye dayanarak araç teslim etmesinin sorumluluğunu değerlendirir. Sandbox ve geliştirme ortamı bu incelemeyi beklemez.
- Doğrulayıcının kullanım kaydında amaç yazılır (ör. "araç kiralama öncesi sürücü bilgisi kontrolü"); [[t:registration-certificate]]
  ([[ADR-0026]]) bunu taşır.
- **Ücret ve kota:** her sürücü belgesi ihracı ikinci bir sağlayıcı oturumudur; kabul edildi, aylık kota izlenir.

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Resmî mDL docType'ıyla (`org.iso.18013.5.1.mDL`) vermek | ret | Yalnız yetkili makam verebilir; resmî belge taklidi sayılır; mağaza ve hukuk riski en yüksek |
| Tür adı B `DrivingLicenceCheck`, C `DrivingEntitlementInfo`, D `mobility:` alanı | ret | A ailedeki adlandırmayla uyumlu ve okura tanıdık; "attestation" resmî belge olmadığını söyler |
| A — Ayrı akış, ön koşulsuz (yalnız sürücü belgesi oturumu) | ret | Daha kısa; ama belge cüzdandaki kimliğe bağlanmaz, kimlik belgesi olmayan kişiye de verilir |
| **B — Ayrı akış, kimlik belgesi sunumu ön koşul** | **kabul** | Kişi ve kimlik bağı güçlü; kimlik alanları tek kaynaktan; belge yalnız sürücü bilgisini taşır |
| C — Kimlik doğrulamasını sürücü belgesiyle yapıp iki belgeyi birden vermek | ret | Kimlik belgesinin ön koşulu ve alanları sürücü belgesine göre değişir; iki türün yaşam döngüsü karışır |
| Sürücü bilgisini kimlik belgesine eklemek | ret | Kimlik belgesi herkeste olmalı; sürücü bilgisi ayrı yaşam döngüsü ve ayrı sınırlar ister |
| Sunumu ayrı OpenID4VP turuyla istemek | ret | Cüzdan ve servis zaten aynı OpenID4VCI oturumunda; sunum PAR'da taşınır (silme isteğiyle aynı desen), ek tur ve ikinci tarayıcı geçişi gerekmez |
| Sınıflar okunamazsa sınıfsız belge vermek | ret | Belgenin değeri sınıflardadır; sınıfsız belge yanıltıcı olur |
| Devletin dijital sürücü belgesini beklemek | ret (şimdilik) | Tarih yok; K8 geçişi korur |

# Değişmezler

| Kod | Kural |
|---|---|
| **DL1** | Tamga'nın sürücü belgesi bilgisi belgesi resmî mDL docType'ını ya da namespace'ini kullanmaz; metadata'sında, `not_official_licence` alanında, kartında ve doğrulama sonucunda resmî sürücü belgesi yerine geçmediğini yazar. |
| **DL2** | Belge kimlik numarası, kısıtlama ya da sağlık kodu, fotoğraf ve adres taşımaz; belge numarası yalnız anahtarlı özet olarak bulunur; sağlayıcının not alanları okunmaz. |
| **DL3** | Belgenin süresi kartın bitiş tarihini ve kartın incelendiği günden itibaren bir yılı geçmez; otomatik yenileme süreyi uzatmaz. |
| **DL4** | Bir ülkenin yetkili makamı dijital sürücü belgesi vermeye başlayınca Tamga o ülke için bu türü yeniden vermez. |
| **DL5** | Belge yalnız cüzdandaki etkin Tamga kimlik belgesinin sunumu üzerine ve karttaki ad ile doğum tarihi o kimlikle eşleşirse verilir; sınıflar okunamıyorsa ya da kart süresi geçmişse verilmez; bağlı kimlik belgesi iptal edilince, yeniden verilince ya da silinince bu belge de iptal edilir ya da silinir. |

# Sonuçlar

- `packages/schemas`: yeni tür (geliştirme evresi, `1.0.0`); görünen ad ve açıklamada K1 ibaresi; `not_official_licence` alanı.
- Kimlik servisi (operatör deposu): PAR'da kimlik sunumu denetimi, sürücü belgesine özel sağlayıcı akışı (ayrı akış kimliği),
  sınıf ve tarih alanlarını okuyan eşleme, eşleşme özeti, yeni tür için ihraç (yalnız SD-JWT VC), kimlik kaydına bağlı iptal;
  silme isteği bu türü de kapsar.
- Güven listesi: kimlik servisinin kaydına yeni tür (gerçek ağ + sandbox).
- Cüzdan: "Belge ekle" menüsü, PAR'a kimlik sunumu, kart ibaresi, alan etiketleri; mağaza metinleri ve gizlilik politikası.
- Tamga Verify ve örnek siteler: "araç kiralama" örnek doğrulaması; sonuç ekranında K1 ibaresi (sonraki adım).
- Çerçeve belgeleri: Identity Rulebook'a yeni tür ve DL kuralları.

# Açık sorular (proje yönetimi)

1. **Adaş riski.** Kart ile kimlik belgesi yalnız **ad + soyad + doğum tarihi** ile eşleştirilir (K4). Aynı ad, soyad ve doğum
   tarihine sahip iki kişi (adaş) birbirinin kartını kendi kimliğine bağlayabilir; yüz eşleştirmesi iki ayrı oturumda iki ayrı
   belgeye karşı yapıldığı için asıl engel odur, ama kimlik ile kart arasında doğrudan bir bağ yoktur. Seçenek: Türkiye kartlarında
   yazılı **kimlik numarasını** belgeye yazmadan, yalnız eşleşme özetine (HMAC) katmak — kimlik belgesindeki numara ile karttaki
   numara aynı özeti vermeli; numara hiçbir yerde saklanmaz ve belgeye girmez (DL2 korunur). Kimlik numarası olmayan kartlarda
   (öteki ülkeler) bugünkü eşleşme kalır. Karar bekliyor; kod değişikliği yapılmadı.

# Durum

**Accepted — 2026-10-04.** Proje yönetimi onayıyla: tür adı A, ön koşul kimlik belgesi (B), sınıf okunamazsa belge yok, kısıtlama
olgusu taşınmaz, mdoc yok, hukuki inceleme gerçek ihraçtan önce, ikinci sağlayıcı oturumu kabul. Uygulama sağlayıcının sınıfları
okuduğu doğrulandıktan sonra başladı. DECISIONS: D-ID-8.
