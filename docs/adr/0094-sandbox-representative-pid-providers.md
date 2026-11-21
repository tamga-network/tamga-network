---
document_id: ADR-0094
title: "Sandbox'ta temsili PID sağlayıcıları: AB PID biçimi, ülke başına dış sağlayıcı listesi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-21
last_updated: 2026-11-21
summary: >
  Sandbox'ta Türkiye, Azerbaycan ve Kazakistan adına üç temsili ulusal kimlik makamı AB PID kural kitabı biçiminde kişi kimlik
  belgesi (PID) verir: SD-JWT VC (urn:eudi:pid:1) ve mdoc (eu.europa.ec.eudi.pid.1). AB'de olduğu gibi PID sağlayıcıları güven
  listesinde değil ayrı bir sağlayıcı listesinde (ETSI TS 119 602 LoTE) duyurulur: her ülke için bir liste, sandbox LOTL'ında
  ADR-0036 dış liste işaretçisiyle. Doğrulayıcı kodu değişmez (ADR-0036 K5 yolu). Gerçek ağda PID sağlayıcısı yoktur; TL8 ve
  Tamga kimlik belgesi (ADR-0011) değişmez. Kabul: 2026-11-21.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0036]]", "[[ADR-0038]]", "[[ADR-0045]]", "[[ADR-0092]]", "[[ADR-0093]]", "[[SPEC-TRUST-0001]]", "[[FW-RB-0003]]"]
---

# Kısaca

Avrupa'da kişinin dijital kimliği (PID) devletin atadığı bir kimlik makamından gelir ve kurumlar kişiyi bu belgeyle tanır. Tamga
ağında bugün devlet PID sağlayıcısı yok; yerine Tamga'nın geçici kimlik belgesi var ([[ADR-0011]]). Bu karar, gerçek ağa
dokunmadan, sandbox'ta AB'nin kurduğu düzeni baştan sona göstermeyi önerir: üç temsili ulusal kimlik makamı AB PID biçiminde
kimlik belgesi verir, AB'deki gibi ayrı bir sağlayıcı listesinde duyurulur, sandbox'taki banka ve otel kişiyi bu belgeyle de tanır.

# Bağlam

- **AB düzeni.** PID sağlayıcılarını üye devlet bildirir; Komisyon onları ETSI TS 119 602 biçiminde ayrı bir sağlayıcı listesinde
  (LoTE, "PID providers") yayımlar. PID'in biçimi AB PID kural kitabındadır: SD-JWT VC `urn:eudi:pid:1` ve ISO mdoc
  `eu.europa.ec.eudi.pid.1`. Güncel kural kitabında yaş öznitelikleri (`age_over_NN`) yoktur; yaş için ayrı yaş doğrulama belgesi
  kullanılır.
- **Tamga bugün.** Gerçek ağda PID sağlayıcısı yok: ulusal listelerin `pid_providers[]` alanı boştur (SPEC-TRUST-0001/TL8). Kimlik
  için Tamga'nın geçici kimlik belgesi (`urn:tamga:id:IdentityAttestation:1`, [[ADR-0011]]) vardır; alan adları AB PID'iyle aynıdır
  ([[ADR-0045]]). Doğrulayıcı dış listelerdeki PID sağlayıcılarını zaten tanır ([[ADR-0036]] K5): dış tür (B2), dış kapsam (C), dış
  iptal imzacısı (D). Sandbox LOTL'ında bunun bir örneği var: OpenID uyum testinin deneme PID imzacısı (`oidf-test-pid`).
- **Sandbox gösterim ağı.** Ad listesinde (proje yönetimi onayı, 2026-11-19) üç PID sağlayıcısı var: "Ulusal Kimlik Makamı —
  Türkiye / Azerbaycan / Kazakistan (temsili)", adresleri `pid-tr`, `pid-az`, `pid-kz`. Sandbox'ta 74 uydurma kişi ve TR, AZ, KZ
  ülke listeleri var ([[ADR-0093]]). Proje yönetiminin yönü: AB PID biçimi; kurumlar kişiyi PID ile de tanır; önce ADR.

# Karar

## K1 — Yalnız sandbox

Karar yalnız sandbox içindir ([[ADR-0038]]). Gerçek ağda PID sağlayıcısı yoktur ve bu karar onu değiştirmez: TL8 aynen kalır,
ulusal listelerin `pid_providers[]` alanı boştur, gerçek LOTL'a dış PID listesi eklenmez. Gerçek ağa devlet PID'inin girişi ayrı bir
karardır.

## K2 — Üç temsili ulusal kimlik makamı

Sandbox'ta üç PID sağlayıcısı: Ulusal Kimlik Makamı — Türkiye (`pid-tr`), Azerbaycan (`pid-az`), Kazakistan (`pid-kz`), hepsi
"(temsili)". "(TEST)" işareti sistemce konur (SB4). İşleten "Tamga Network Sandbox (TEST)"dir; her kayıtta adına işletilen devletin
katılmadığı ve onaylamadığı yazılır ([[ADR-0093]] UL3 ile aynı ifade biçimi). Bir makam yalnız kendi ülkesinin uydurma kişilerine
belge verir.

## K3 — Yayın: ülke başına bir sağlayıcı listesi

AB'deki gibi PID sağlayıcıları güven listesinde değil, ayrı bir sağlayıcı listesinde duyurulur: her makam için bir ETSI TS 119 602
LoTE. Sandbox LOTL'ı her birini [[ADR-0036]] K1 işaretçisiyle gösterir:

| Alan | Değer |
|---|---|
| `list_id` | `sandbox-pid-tr`, `sandbox-pid-az`, `sandbox-pid-kz` (adlar proje yönetimi onaylı, 2026-11-21) |
| `territory` | `TR`, `AZ`, `KZ` |
| `format` | `etsi-lote-json` |
| `signing_keys` | listenin kendi imzacısı (sandbox PKI'sında, ülke listesi imzacılarından ve LOTL imzacısından ayrı) |
| `scope.entity_kinds` | `["pid_provider"]` |
| `scope.vct` | `["urn:eudi:pid:1", "eu.europa.ec.eudi.pid.1"]` |
| `scope.category` / `assurance` / `class` | `IDENTITY` / `I3` / `PUB` |
| `scope.recognized_by` | `["TR", "AZ", "KZ"]` (sandbox'taki karşılıklı tanıma gibi) |
| `approval` | proje yönetimi onayı ve tarihi (FD4) |

Yayıncı listeleri sandbox kaynağından üretir ve imzalar; kopyası `external/<list_id>.jws`'tedir (ADR-0036 K1). LOTL'daki ülke
yerinin `pid_provider` rolü değişmez (RESERVED); bağ dış listenin `territory` alanıyla kurulur.

## K4 — Ayrı test kökleri

Her makamın kendi test kökü, belge imza sertifikası ve iptal listesi sertifikası vardır (sandbox PKI'sı). Bunlar Tamga sandbox
köküne bağlanmaz: bir belge hem Tamga kurumu hem dış sağlayıcı olarak çözülemesin (`oidf-test-pid` ile aynı yol). Sağlayıcı listesi
makamın test kökünü hizmet sertifikası olarak gösterir. Test köklerinin özel anahtarı sunucuya gitmez; belge imza anahtarları
sandbox kurumlarınınki gibi sunucudadır (sapma S-1, yalnız sandbox).

## K5 — Belge: AB PID kural kitabı

İki biçim: SD-JWT VC `urn:eudi:pid:1` (iç içe seçici açıklama: `address{…}`, `nationalities[]`; [[ADR-0036]] K6) ve mdoc
`eu.europa.ec.eudi.pid.1`. Alanlar kural kitabındaki adlarla, ağın dış tür tanımına (`packages/schemas` dış şemaları) uygun.
Değerler uydurma kişilerden gelir; kişisel yönetim numarası bilerek geçersizdir. Yaş öznitelikleri yoktur (kural kitabı); yaş
soruları Tamga kimlik belgesinde ve sürücü belgesi bilgisinde kalır ([[ADR-0092]]). Belgenin iptal listesi vardır (Token Status
List; mdoc için CWT biçimi).

## K6 — Belge verme

PID'i platformun sandbox servisleri verir (mühendislik önerisi: barındırılan belge verenin üç sandbox kiracısı; kesin yer kodda
belirlenir). Kimlik ispatı yapılmaz: sandbox'ın sahte kimlik sayfasındaki gibi kişi listeden seçilir. Belge alma akışı
OpenID4VCI'dır; cüzdan kanıtı kuralları diğer sandbox belgeleriyle aynıdır.

## K7 — Doğrulama

Doğrulayıcı kodu değişmez: [[ADR-0036]] K5 yolu kullanılır. Sandbox'taki kimlik soran doğrulayıcıların politikaları (Sikke Bank,
Gecekonak Otel) Tamga kimlik belgesine ek olarak PID'i de kabul eder; kişi hangisini göstereceğini cüzdanda seçer. Doğrulayıcı
sonucunda kurum dış sağlayıcı olarak görünür (`issuer.state_code` listenin `territory`'si).

## K8 — Cüzdan

Cüzdan, imzalı LOTL'da sabitlenmiş bir sağlayıcı listesindeki PID sağlayıcısından belge alır ve gösterir. Gerekirse cüzdan
çekirdeğinde belge alma tarafı eklenir (dış sağlayıcının belge alırken tanınması; ADR-0036 K5'in alma yönü). Paket sürümü ve
cüzdan derlemesi ayrı onaydır.

## K9 — Tamga kimlik belgesiyle ilişki

Tamga kimlik belgesi ([[ADR-0011]]) aynen kalır; PID onun yerine geçmez ve sandbox'ta ikisi yan yana durur. Gerçek ağda devlet
PID'i geldiğinde Tamga kimlik belgesinin `successor_id` ile süpersede edilmesi (TL8) ayrı karardır.

# Gerekçe / alternatifler

- **Ulusal listede `pid_providers[]` doldurmak — reddedildi.** TL8'i ve liste biçimini değiştirir, doğrulayıcıda yeni bir çözüm
  yolu ister; AB de PID sağlayıcılarını güven listesinde değil ayrı sağlayıcı listesinde yayımlar.
- **Üç makam için tek ortak liste — ikinci seçenek.** AB'de Komisyon bütün PID sağlayıcılarını tek listede yayımlar; bu da
  uygulanabilir. Ülke başına liste önerilir, çünkü her ülkenin kendi sağlayıcısını bildirdiği düzeni ve bir listenin bayat
  olmasının yalnız o ülkeyi etkilemesini (FD3) daha açık gösterir. Proje yönetimi tek listeyi seçerse yalnız K3 değişir.
- **Makam sertifikalarını Tamga sandbox köküne bağlamak — reddedildi.** Aynı belge iki yoldan çözülebilir hâle gelir.
- **Tamga kimlik belgesini "PID" diye adlandırmak — reddedildi.** [[ADR-0011]] K1: Tamga PID sağlayıcısı değildir.
- **Yaş alanlarını PID'e eklemek — reddedildi.** Güncel kural kitabında yok; eklemek AB biçiminden sapmak olur.

# Değişmezler

| Kod | Kural |
|---|---|
| PP1 | PID sağlayıcısı yalnız sandbox'ta bulunur; gerçek ağın LOTL'ında dış PID listesi, ulusal listelerinde `pid_providers[]` kaydı yoktur (TL8). |
| PP2 | Temsili PID sağlayıcısı sandbox LOTL'ında yalnız bir ETSI TS 119 602 sağlayıcı listesiyle (ADR-0036 K1) gösterilir; kaydında devletin katılmadığı yazılır. |
| PP3 | Temsili makamın sertifikaları Tamga sandbox köküne bağlanmaz; kendi test köküne bağlanır. |
| PP4 | PID AB PID kural kitabı biçimindedir (`urn:eudi:pid:1`, `eu.europa.ec.eudi.pid.1`); değerler uydurmadır, kişisel yönetim numarası geçersizdir. |
| PP5 | PID Tamga kimlik belgesinin yerine geçmez; sandbox politikaları ikisini seçenek olarak kabul eder. |

# Açık sorular — kabulle karara bağlandı (2026-11-21)

1. Ülke başına bir sağlayıcı listesi (tek ortak liste değil).
2. Liste adları `sandbox-pid-tr`, `sandbox-pid-az`, `sandbox-pid-kz`.
3. PID'i Sikke Bank ve Gecekonak Otel kabul eder (kimlik soranlar); yaş soran doğrulayıcılar değişmez.

# Durum

**Accepted — 2026-11-21** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-ID-20. PP1–PP5 bağlayıcıdır.
Uygulama sırası: sandbox PKI (üç test kökü) → yayıncı (sağlayıcı
listeleri) → belge veren (PID) → doğrulayıcı politikaları → cüzdan (gerekirse, ayrı paket sürümüyle).

**Uygulama notları (2026-11-21).**
- K3: her listenin imzacısı kendinden imzalı `pid-<cc>-list-signer`; yayıncı listeleri `pid-providers.source.json`'dan her
  yayında yeniden üretip imzalar, yayın adresine (`external-src/`) ve doğrulanmış kopya klasörüne (`external/`) yazar — kendi
  barındırdığı liste olduğu için `external-fetch` beklenmez. Test kökü listede belge verme hizmetinin, `pid-<cc>-status` iptal
  hizmetinin sertifikasıdır. Liste sıra numarası zamana bağlıdır ve geri gitmez (kopya silinse de okuyucunun geri sarma denetimi
  takılmaz).
- K6: barındırılan belge verende üç sandbox kiracısı (`pid-tr`, `pid-az`, `pid-kz`; yalnız sandbox ağında açılır); kaynak uydurma
  kişiler dosyası, makam yalnız kendi ülkesinin kişisine verir. İptal listesi çapalanmaz; iki PID politikası listeyi doğrulama
  anında, yalnız sağlayıcı listesindeki iptal sunucusundan çeker. K5'in mdoc kopyası da verilir
  (2026-11-22): aynı belirteçle ikinci yapılandırma (`eu.europa.ec.eudi.pid.1`, kapsam SD-JWT ile aynı), aynı anahtara aynı iptal
  indeksi, tek kayıt (iptal iki biçimi birlikte kapatır); mdoc kopyaları iptal listesinin CWT gösterimine bağlıdır. Cüzdan
  çekirdeği mdoc yapılandırmasını türün mdoc adıyla bulur ve iç içe adresi karşılaştırır.
- K7: istek başına tek kayıt sertifikası gider (ETSI TS 119 472-2) ve bir kayıtlı kullanım tek türdür; bu yüzden seçenek tek
  istekte iki tür değil, doğrulayıcının sayfasında iki senaryodur (Tamga kimlik belgesiyle / PID ile: `bank-account-opening-pid`,
  `hotel-check-in-pid`, kayıtta ayrı kullanım). Doğrulama adımları değişmedi; yalnız sonuçtaki `issuer.state_code` dış kurumda
  artık dış listenin `territory`'si (önce politikanın ülkesiydi).
- K8: cüzdan çekirdeği alma yönünü (zincir dış listedeki çapaya, tür listenin kapsamında) ve belgenin kendi iptal durumunu
  (imzacı dış listedeki iptal hizmeti) kazandı; paket yayını ve cüzdan
  derlemesi ayrı onaylar.
