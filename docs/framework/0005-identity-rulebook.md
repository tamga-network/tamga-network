---
document_id: FW-RB-0003
title: "Identity Rulebook"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-09
summary: >
  Tamga'nın geçici kimlik belgesi sağlayıcısı olarak verdiği kimlik belgesinin (`urn:tamga:id:IdentityAttestation:1`)
  rulebook'u (Tamga Rulebook'tan dallanır): kim verir, hangi kimlik doğrulamayla, hangi alanlarla ve hangi seçici paylaşım kuralıyla; geçerlilik
  ve iptal; iki biçim (SD-JWT VC + ISO 18013-5 mdoc); kurumların ve doğrulayıcıların kullanım kuralları; devlet PID
  sağlayıcısına devir. EUDI ARF PID Rulebook deseniyle yazılmıştır; bu belge PID değildir, bir EAA'dır. §10: aynı servisin
  verdiği sürücü belgesi bilgisi (`urn:tamga:id:DrivingLicenceAttestation:1`) — resmî sürücü belgesi değildir.
---

# 0. Kapsam ve statü

| Tür | `vct` | Katalog |
|---|---|---|
| Tamga Kimlik Belgesi | `urn:tamga:id:IdentityAttestation:1` | `schemas.tamga.network/v1/id/IdentityAttestation/1.0.0` |
| Aynı belgenin mdoc biçimi | docType = `vct`, ad alanı `tamga.id.1` | [[ADR-0013]] |
| ZK kopyası (yalnız sıfır bilgi ispatlı sunum) | `urn:tamga:id:ShortLivedIdentityAttestation:1` (mdoc, ad alanı `tamga.id.1`) | `schemas.tamga.network/v1/id/ShortLivedIdentityAttestation/1.0.0` · [[ADR-0044]] |

Teknik tanım [[SPEC-ID-0003]] §9 ve şema kataloğundadır; çelişkide onlar geçerlidir. Bu [[t:rulebook]] yeni kural koymaz; [[ADR-0011]],
[[ADR-0013]], [[SPEC-ID-0003]] ve Tamga Rulebook (Ek B) RB-AP-ID kurallarını tek yerde, kurum ve [[t:verifier]] gözüyle toplar.

**Statü:** bu belge **[[t:PID]] değildir**. Devlet tarafından atanmış bir PID sağlayıcısı yokken Tamga'nın geçici olarak verdiği,
nitelikli olmayan bir **[[t:EAA]]**'dır; [[t:trust-list|güven listesinde]] `pid_providers[]` boş kalır. Devlet sağlayıcısı atanınca yeni belge verilmez ve kayıt halefe devredilir (§8).

---

# 1. Veri modeli

| Alan | Tür | Seçici paylaşım | Not |
|---|---|---|---|
| `given_name`, `family_name` | string | `always` | |
| `birthdate` | tarih (YYYY-MM-DD) | `always` | AB PID adı; mdoc'ta `birth_date` (full-date) — [[ADR-0045]] |
| `nationalities` | ISO 3166-1 alpha-2 dizisi | `always`, her öğe ayrı | AB PID adı; mdoc'ta `nationality` (dizi); bilinmiyorsa `QU`, uyruksuz `QS` |
| `personal_administrative_number` | string | `always` | Ulusal kimlik numarası; **yalnızca bu türde** |
| `document_type` | `ID_CARD` \| `PASSPORT` \| `RESIDENCE_PERMIT` \| `DRIVING_LICENSE` | `always` | Doğrulanan belge |
| `document_number_hash` | `sha256-…` | `always` | Belge numarasının **anahtarlı** özeti (HMAC-SHA256; anahtar yalnızca kimlik servisinde) — numaranın kendisi yok ve özetten geri bulunamaz |
| `issuing_country` | ISO 3166-1 alpha-2 | `always` | Doğrulanan kimlik belgesini veren ülke (AB PID'de aynı ad PID sağlayıcısının ülkesidir — §9) |
| `document_chip_verified` | boolean | `always` | NFC çip okundu mu (olgu; seviye değildir) |
| `verification_method` | `remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person` \| `review-demo` | `always` | `review-demo` yalnızca uygulama mağazası incelemesi için verilen deneme belgesinde |
| `age_over_18` | boolean | `always` | Türetilmiş; yaş doğrulamasında yalnız bu alan açılır |
| `status`, `category`, `cnf`, `vct`, `iss`, `iat`, `exp` | — | `never` | Taşıma profili |

**Yok:** portre ya da fotoğraf, adres, belge görüntüsü, güven seviyesi ([[t:LoA]]) alanı. Tüm kişi alanları
seçici paylaşımlıdır; bir doğrulayıcı yalnızca kayıtlı kapsamındaki alanları isteyebilir.

---

# 2. Kim verir

| Şart | Değer |
|---|---|
| Belge veren | Tamga Network kimlik servisi (`id.tamga.network`) — tek belge veren; kurumlar bu türü veremez |
| Kategori / sınıf | `IDENTITY` · `EAA` · I2 |
| Belge türü yetkisi | Yalnızca kimlik servisinin kaydında (izin listesi) |
| Anahtar | Kimlik servisinin belge imza anahtarı; iptal listesi anahtarı ayrı (RB-AP-03) |
| Rol | Geçici kimlik belgesi sağlayıcısı — PID sağlayıcısı değil |
| Uygulama mağazası incelemesi | Ayrı deneme imzacısı `tamga-id-review` (I1; `verification_method: review-demo`, en çok 7 gün); yalnızca tek kullanımlık inceleme koduyla verilir; I2 isteyen hiçbir politikada geçmez |

---

# 3. Belge vermeden önce kimlik doğrulama

| Yol | Seviye | Not |
|---|---|---|
| Uzaktan: belge, canlılık ve yüz eşleştirmesi | **T2** (ETSI TS 119 461 Substantial) | `verification_method: remote-document-liveness-face` |
| Uzaktan ve NFC çip | T2; `document_chip_verified: true` | Teknik olarak yüksek; hukuken T3 nitelikli elektronik imzadır |
| Yüz yüze | T2 | `in-person` |

Kurallar: kimlik doğrulama yalnızca kimlik servisinde yapılır; kurum [[t:issuer|belge verenleri]], cüzdan ve doğrulayıcılar sağlayıcıyla
konuşmaz. Doğrulama başlamadan **aydınlatma metni gösterilir ve açık rıza alınır**. Sağlayıcının kararı her zaman
sağlayıcının karar ucundan teyit edilir; bildirim (webhook) yalnızca tetikleyicidir. Sağlayıcı kesintisi seviyeyi düşürmez,
belge verme durur.

**Yaş sınırı yoktur** (2026-10-08, [[ADR-0043]]): kimlik belgesi için asgari yaş aranmaz; şart geçerli bir kimlik belgesiyle
kimlik doğrulamasıdır. Çocuklar için veli onayı akışı hukuki inceleme sonrası ayrı kararla ele alınır.

---

# 4. Veri koruma

- Tamga bu veri için **veri sorumlusudur**.
- Belge verildikten sonra kişi alanları tutulmaz; kalıcı kayıt yalnızca opak `subject_ref`, belge numarası özeti, süre ve iptal
  listesi konumlarıdır. Belge görüntüsü, özçekim, video ve OCR ham verisi Tamga'da hiç saklanmaz.
- Silme talebi belgeyi iptal eder.
- Aynı belge numarası için ikinci etkin kimlik belgesi verilmez; yeniden doğrulama eskisini iptal eder.

---

# 5. Geçerlilik ve iptal

| Konu | Kural |
|---|---|
| Geçerlilik | `exp` = verildiği tarih + 730 gün (en çok 2 yıl); süresi dolunca yeniden doğrulama |
| İptal listesi | **Zorunlu** (Token Status List) |
| İptal nedenleri | kişinin silme talebi, aynı belgeyle yeniden doğrulama, belgenin kaybolduğu ya da çalındığı bildirimi, hatalı belge |
| Kopyalar | 10 kopya, her biri ayrı cihaz anahtarı; doğrulayıcı başına ayrı kopya |

---

# 6. İki biçim: SD-JWT VC ve mdoc

Aynı belge [[t:SD-JWT-VC]] (birincil) ve ISO/IEC 18013-5 [[t:mdoc]] olarak birlikte verilir:

- Veri, `iat/exp` ve [[t:holder]] anahtarı iki biçimde birebir aynıdır. Ad ve kodlama her biçimde AB PID tablosuna göredir
  ([[ADR-0045]]): SD-JWT VC `birthdate`, `nationalities` ↔ mdoc `birth_date` (full-date, #6.1004), `nationality` (dizi); öteki
  adlar aynı.
- mdoc imzası ES256 ve aynı [[t:trust-anchor|güven çapasıyla]] eşlenir; sonuç üç değerlidir.
- Doğrulayıcı biçimi [[t:DCQL]] ile seçer; örneğin tarayıcıda yaş doğrulaması mdoc üzerinden yalnız `age_over_18` ister.

## 6.1 Sıfır bilgi ispatı: ZK kopyaları ([[ADR-0044]])

[[t:ZK]] ile sunumda iptal listesindeki yer açılmaz. Bu yüzden ZK ile ana kimlik belgesi değil, kimlik servisinin ayrıca verdiği
**kısa ömürlü ZK kopyası** gösterilir:

| Konu | Kural |
|---|---|
| Tür | `urn:tamga:id:ShortLivedIdentityAttestation:1`; yalnız mdoc, yalnız ZK sunumunda |
| İçerik | Yalnız ZK ile ispatlanabilen öğeler (bugün `age_over_18`) |
| Geçerlilik | En çok 24 saat, ana belgenin bitişini geçmez; iptal listesi girdisi yok — kısa ömür iptalin yerini tutar (AB ARF VCR_01) |
| Verme | Kimlik belgesiyle gelen yenileme belirteciyle küçük paketler hâlinde; cüzdan kullanıcıya sormadan yeniler. Belirteçte yalnız asgari öğeler, yalnız kimlik servisinin açabileceği biçimde; sunucuda kişi alanı yok |
| İptal | Ana belge iptal ya da askıdaysa yeni kopya verilmez; iptal ZK sunumunda en geç 24 saatte etkili olur |
| Doğrulayıcı | İspat türü bağladığı için doğrulayıcı kısa ömrü görür ve iptal denetimi beklemez (`status: NOT_APPLICABLE`, gerekçe kısa ömür). Bu türü istemeyen (işaretsiz) ZK sunumunu yalnız politikası açıkça kabul ediyorsa kabul eder |

Kurallar Tamga Rulebook RB-AP-ID-11'dedir.

---

# 7. Gösterim ve doğrulama kuralları

| Kullanım | İstenen alanlar | Kural |
|---|---|---|
| Yaş doğrulaması | `age_over_18` | Başka alan istenmez |
| Kurumda kayıt eşleştirmesi (belge vermeden önce) | `personal_administrative_number`, `birthdate`, `given_name`, `family_name` | Kurumun belge verme servisi yalnızca kayıtlı kapsamıyla ve tam doğrulama hattından geçirerek alır; eşleştirme anahtarlarını saklamaz ve loglamaz (RB-RP-ID-01) |
| "Geçerli Tamga kimliği var mı" | hiçbiri | Referans politika `event-tamga-id` |
| Web sitesine kayıt ve giriş ("Tamga ile giriş yap") | kayıtta `given_name`, `family_name`; girişte hiçbiri | Hesap anahtarı site başına takma addır; `document_number_hash` ve kimlik numarası istenmez (RB-RP-13) |
| Yüksek riskli işlem | kapsamına göre | Yüz eşleştirmesi gerekiyorsa doğrulayıcının sorumluluğudur; belge portre taşımaz |

- Kimlik numarası isteyen doğrulayıcının kaydında bu alan açıkça bulunmalıdır; cüzdan kapsam dışı talebi uyarır.
- Sonuç üç değerlidir; `INDETERMINATE` kabul değildir.
- Doğrulayıcı güven listesinde belge vereni `IDENTITY` kategorisinde ve bu tipe yetkili görmelidir.
- **[[t:pseudonym|Takma ad]] tohumu**: kimlik belgesiyle birlikte ayrı ve gösterilemeyen tür `urn:tamga:id:PseudonymSeed:1` verilir;
  tohum kişinin değişmeyen kimliğinden (Türkiye'de T.C. kimlik numarası; yoksa ülke, belge türü ve belge numarası — belge yenilenince
  takma adlar değişir) ayrı bir anahtarla türetilir, saklanmaz. Cüzdan bundan site başına takma ad türetir (RB-AP-ID-07).

---

# 8. Devir — devlet PID sağlayıcısı

Devlet bir PID sağlayıcısı atadığında: kimlik servisinin kaydı `successor_id` ile devredilir, yeni belge verilmez; verilmiş belgeler
süresi dolana kadar geçerli kalır. Doğrulayıcı politikaları devlet PID'ini tercih
edecek biçimde güncellenir; bu tür `DEPRECATED` olur ama doğrulanabilir kalır.

---

# 9. AB kimlik belgesi (PID) ve ehliyet (mDL)

Tamga doğrulayıcıları AB'nin kişi kimlik belgesini (PID) ve ISO ehliyetini ([[t:mDL]]) **dış tür** olarak tanır:

| Tür | Biçim |
|---|---|
| `urn:eudi:pid:1` | SD-JWT VC |
| `eu.europa.ec.eudi.pid.1` | mdoc |
| `org.iso.18013.5.1.mDL` | mdoc |

- **Tanınma koşulu.** Dış tür, yalnız belgeyi veren, bu türe kefil olan bir dış listenin (Ek A §6.1) kapsamındaysa kabul edilir.
  Bugün listelerin listesinde dış liste yoktur; her dış liste ayrı bir kararla eklenir.
- **İç içe [[t:selective-disclosure]].** AB PID'de adres bir nesnedir ve vatandaşlıklar bir dizidir. Kişi yalnız gerekeni açabilir: örneğin
  adresin yalnız şehri ya da vatandaşlıklardan biri. Doğrulayıcının kapsam denetimi alanın kendisine ya da üst alanına göre
  yapılır.
- **Yaş.** AB PID'de yaş alanı yoktur; AB'de yaş için ayrı yaş doğrulama belgesi kullanılır. mDL'de `age_over_18` gibi yaş
  öğeleri vardır.

Tamga kimlik belgesi AB PID adlarını ve kodlamasını kullanır (Uygulama Tüzüğü (AB) 2026/1731; [[ADR-0045]]). Tür ve ad alanı
Tamga'nındır (belge PID değildir):

| Tamga kimlik belgesi (SD-JWT VC) | Tamga kimlik belgesi (mdoc, `tamga.id.1`) | AB PID (SD-JWT VC) | AB PID (mdoc) |
|---|---|---|---|
| `given_name` | `given_name` | `given_name` | `given_name` |
| `family_name` | `family_name` | `family_name` | `family_name` |
| `birthdate` | `birth_date` (full-date) | `birthdate` | `birth_date` (full-date) |
| `nationalities` (dizi) | `nationality` (dizi) | `nationalities` (dizi) | `nationality` (dizi) |
| `personal_administrative_number` | `personal_administrative_number` | `personal_administrative_number` | `personal_administrative_number` |
| `issuing_country` (belgeyi veren ülke) | `issuing_country` | `issuing_country` (PID sağlayıcısının ülkesi) | `issuing_country` |
| `age_over_18` | `age_over_18` | — (ayrı yaş doğrulama belgesi) | — |
| `document_type`, `document_number_hash`, `document_chip_verified`, `verification_method` | aynı | karşılığı yok (Tamga'ya özgü) | karşılığı yok |

`issuing_country` adı aynıdır ama anlamı farklıdır: Tamga belgesinde doğrulanan kimlik belgesini veren ülke, AB PID'de PID
sağlayıcısının ülkesidir.

Devlet PID'i geldiğinde (§8) kurumlar, kişiyi eşleştirmek için Tamga kimlik belgesi yerine PID'i de kabul edebilir; bu ayrı bir
kararla açılır.

---

# 10. Sürücü belgesi bilgisi (`urn:tamga:id:DrivingLicenceAttestation:1`)

Kimlik servisinin ikinci kişi belgesi ([[ADR-0039]]): kişinin fiziksel sürücü belgesi kartı uzaktan incelenir (belge + canlılık +
yüz eşleştirme) ve karttaki sınıflar ile tarihler bir belge olarak verilir. **Resmî sürücü belgesi değildir, [[t:mDL]] değildir;**
trafik denetiminde ve resmî işlemlerde kullanılmaz. Belge bunu her zaman açık `not_official_licence` alanıyla, görünen adıyla
("Sürücü belgesi bilgisi — resmî sürücü belgesi yerine geçmez") ve kartıyla söyler; doğrulayıcı ekranları aynı ibareyi gösterir.

| Konu | Kural |
|---|---|
| Katalog | `schemas.tamga.network/v1/id/DrivingLicenceAttestation/1.0.0`; yalnız SD-JWT VC (mdoc yok) |
| Kim verir | Yalnız kimlik servisi (`IDENTITY` · `EAA` · I2); kurumlar veremez; `category` alanı yok |
| Ön koşul | Cüzdandaki **etkin Tamga kimlik belgesi** sunulur (yalnız ad, soyad, doğum tarihi); karttaki ad ve doğum tarihi onunla eşleşmeli. Eşleşmezse, kart sürücü belgesi değilse, süresi geçmişse ya da sınıflar okunamıyorsa belge verilmez |
| Alanlar | `given_name`, `family_name`, `birth_date` (varsa), `issuing_country`, `document_number_hash` (anahtarlı özet), `driving_privileges` (`[{ category, issue_date?, expiry_date? }]`; AB 2006/126 sınıf kodları, ulusal ekler aynen), `licence_issue_date` (varsa), `licence_expiry_date`, `verified_at` (gün), `verification_method`, `age_over_18`, `not_official_licence` (her zaman `true`, seçici paylaşımsız) |
| Yok | Ulusal kimlik numarası, kısıtlama ve sağlık kodları (12. alan; `has_restrictions` olgusu da yok), fotoğraf, imza, adres; sağlayıcının not alanları okunmaz |
| Geçerlilik | `exp` = kartın bitişi ile incelemeden 1 yıl sonrasından erken olanı; otomatik yenileme süreyi uzatmaz |
| İptal | İptal listesi zorunlu. Nedenler: kişinin isteği, silme isteği, aynı kartla yeniden doğrulama (eskisi), cüzdan birimi iptali, **bağlı kimlik belgesinin iptali, yeniden verilmesi ya da silinmesi** (zincirleme) |
| Veri koruma | Tamga veri sorumlusudur; aydınlatma ve açık rıza sürücü belgesine özeldir; kişi alanları ihraçtan sonra tutulmaz; sağlayıcıya ad/doğum tarihi gönderilmez, eşleşme kimlik servisinde anahtarlı özetle yapılır |
| Yetkili makam | Bir ülkenin yetkili makamı dijital sürücü belgesi vermeye başlayınca Tamga o ülke için bu türü yeniden vermez; kayıt `successor` ile resmî türe işaret eder (§9'daki `org.iso.18013.5.1.mDL` dış tür olarak zaten tanınır) |
| Hukuk | Gerçek kişilere ihraç açılmadan önce hukuki inceleme; sandbox bunu beklemez |

Kurallar Tamga Rulebook RB-AP-ID-08…10'dadır; kaynak [[ADR-0039]] DL1–DL5.

---

# Kaynaklar

Bu belgenin dayandığı kararlar, şartnameler ve standartlar Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

