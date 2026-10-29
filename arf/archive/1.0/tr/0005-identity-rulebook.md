---
document_id: FW-RB-0003
title: "Identity Rulebook"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-23
summary: >
  Tamga'nın kimlik servisinin verdiği kişi belgelerinin rulebook'u (Tamga Rulebook'tan dallanır), AB Attestation Rulebook
  şablonunun bölüm yapısıyla: Tamga kimlik belgesi (`urn:tamga:id:IdentityAttestation:1`; SD-JWT VC + ISO/IEC 18013-5 mdoc),
  onun ZK kopyası (`urn:tamga:id:ShortLivedIdentityAttestation:1`), takma ad tohumu (`urn:tamga:id:PseudonymSeed:1`) ve
  sürücü belgesi bilgisi (`urn:tamga:id:DrivingLicenceAttestation:1`; resmî sürücü belgesi değildir). Öznitelikler ve üst
  veri, hukuki kategori, biçim başına kodlama, kullanım, güven çapaları, geçerlilik ve iptal, AB uyumu. Kimlik belgesi PID
  değildir; nitelikli olmayan bir EAA'dır ve AB PID adlarını ve kodlamasını kullanır.
---

| Sürüm | Tarih | Açıklama |
|---|---|---|
| 1.0.0 | 2026-10-16 | Tamga ARF 1.0'ın güncel metni; AB Attestation Rulebook şablonunun (sürüm 1.5) bölüm yapısında. |

**Şema sahibi:** Tamga Network. Tamga Network (kurulacak vakıf) adına geçici işletmeci: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ. **Geri bildirim:** <https://github.com/tamga-network/tamga-network/issues>

---

# 1. Giriş

## 1.1 Kapsam ve amaç

Bu [[t:rulebook]], Tamga Network kimlik servisinin (`id.tamga.network`) verdiği dört kişi belgesi türünü tanımlar:

| Tür | `vct` / docType | Biçim | Katalog |
|---|---|---|---|
| Tamga Kimlik Belgesi | `urn:tamga:id:IdentityAttestation:1` | [[t:SD-JWT-VC]] + [[t:mdoc]] (ad alanı `tamga.id.1`) | `schemas.tamga.network/v1/id/IdentityAttestation/1.0.0` |
| ZK kopyası (yalnız sıfır bilgi ispatlı sunum) | `urn:tamga:id:ShortLivedIdentityAttestation:1` | yalnız mdoc (ad alanı `tamga.id.1`) | `schemas.tamga.network/v1/id/ShortLivedIdentityAttestation/1.0.0` · [[ADR-0044]] |
| Takma ad tohumu (gösterilemez) | `urn:tamga:id:PseudonymSeed:1` | yalnız SD-JWT VC | `schemas.tamga.network/v1/id/PseudonymSeed/1.0.0` · [[ADR-0031]] |
| Sürücü belgesi bilgisi | `urn:tamga:id:DrivingLicenceAttestation:1` | yalnız SD-JWT VC | `schemas.tamga.network/v1/id/DrivingLicenceAttestation/1.0.0` · [[ADR-0039]] |

**Amaç.** Devlet tarafından atanmış bir [[t:PID]] sağlayıcısı yokken kişinin kimliğini bir kez uzaktan doğrulayıp cüzdanında
seçici paylaşımlı, cihaza bağlı bir belge olarak taşımasını sağlamak: kurumlar kişiyi kendi kayıtlarıyla eşleştirir, siteler
yaş ya da "geçerli kimlik var mı" sorar, kişi yalnız gerekeni açar.

**Statü.** Kimlik belgesi **PID değildir**: Tamga'nın geçici olarak verdiği, nitelikli olmayan bir **[[t:EAA]]**'dır
([[ADR-0011]], [[ADR-0022]]); [[t:trust-list|güven listesinde]] `pid_providers[]` boş kalır. Devlet sağlayıcısı atanınca yeni belge
verilmez ve kayıt halefe devredilir (§4.7). Sürücü belgesi bilgisi **resmî sürücü belgesi değildir, [[t:mDL]] değildir** (§4.8).

Teknik tanım [[SPEC-ID-0003]] §9 ve şema kataloğundadır; çelişkide onlar geçerlidir. Bu rulebook yeni kural koymaz;
[[ADR-0011]], [[ADR-0013]], [[ADR-0039]], [[ADR-0044]], [[ADR-0045]], [[SPEC-ID-0003]] ve Tamga Rulebook (Ek B) RB-AP-ID
kurallarını AB şablonunun düzeninde toplar.

## 1.2 Belge yapısı

Bölüm 2 öznitelikleri ve üst veriyi biçimden bağımsız tanımlar; Bölüm 3 biçim başına kodlamayı (ISO/IEC 18013-5, SD-JWT VC,
W3C VCDM); Bölüm 4 kullanımı, belge verme koşullarını ve doğrulayıcının yükümlülüklerini; Bölüm 5 güven çapalarını; Bölüm 6
geçerliliği ve iptali; Bölüm 7 AB uyumunu ve karar bekleyen noktaları.

## 1.3 Anahtar kelimeler

**MUST**, **MUST NOT**, **SHOULD** ve **MAY** RFC 2119 anlamındadır (Tamga Rulebook §0). Küçük harfle "gerekir" dış bir
belgenin koyduğu şartı anlatır.

## 1.4 Terimler

Terimler Ek D'dedir; AB terimleri ARF Annex 1 anlamındadır.

---

# 2. Öznitelikler ve üst veri

## 2.0 AB şartları ve bu belgedeki karşılıkları

ARF Topic 12'nin nitelikli olmayan EAA için koyduğu şartlar (eIDAS 2.0 Ek V'e atıfla):

| Şart | Karşılık |
|---|---|
| EAA olduğunun göstergesi (ARB_12) | §2.1 — `category` yazılmaz; ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01 kuralıyla nitelikli olmayan EAA'nın göstergesi bu yokluktur; şablonun `eaa:eu:non-qualified` değeri kullanılmaz ([[ADR-0047]] K6) |
| Belge verenin kimliği, Ek V b (ARB_15) | `iss` (belge verenin adresi) ve imza başlığındaki `x5c` yaprak sertifikası (kurum adı, ülke); `issuer_id` sertifikanın parmak izidir (§2.5, §5) |
| Öznenin kimliği, Ek V c (ARB_17) | Kimlik belgesi: `family_name`, `given_name`, `birthdate`, `personal_administrative_number`. Sürücü belgesi bilgisi: `family_name`, `given_name`, `birth_date`. ZK kopyası ve takma ad tohumu bilerek öznenin kimliğini taşımaz (§2.2) |
| Geçerlilik başlangıcı ve sonu, Ek V e (ARB_19) | SD-JWT VC `iat`, `exp`; mdoc `validityInfo` (`validFrom`, `validUntil`) |
| Güven çapasının konumu, Ek V h (ARB_21) | Belgede ayrı bir alan yoktur ve eklenmez; konum belge verenin sertifika zinciri ve Tamga güven listeleridir (§5); güven çapalarının tek kaynağı listelerdir ([[ADR-0047]] K7) |

## 2.1 Giriş ve hukuki kategori

Kimlik belgesi AB PID'inin öznitelik adlarını ve kodlamasını kullanır (Uygulama Tüzüğü (AB) 2026/1731; [[ADR-0045]]); tür ve ad
alanı Tamga'nındır. Kişi alanlarının hepsi seçici paylaşımlıdır; portre, adres, belge görüntüsü ve güvence seviyesi
([[t:LoA]]) alanı yoktur. Ulusal kimlik numarası yalnız bu türde bulunur (RB-AP-ID-04, RB-SCH-04).

**Hukuki kategori (`category`).** AB Attestation Rulebook şablonu (1.5) ve ETSI TS 119 472-1, QEAA ve PuB-EAA için `category`
özniteliğini tanımlar (`urn:etsi:esi:eaa:eu:qualified`, `urn:etsi:esi:eaa:eu:pub`; ARF metninde eski adı
`attestation_legal_category`, ARB_25). Tamga bu adı kendi değerleriyle (`urn:tamga:eaa:qualified`, `urn:tamga:eaa:pub`) yalnız kayıt
sınıfı nitelikli ya da kamu olan belge verende kullanır (RB-AP-14). Kimlik servisi nitelikli olmayan EAA / I2 sınıfındadır
([[ADR-0022]]); bu rulebook'taki dört türün hiçbiri `category` **MUST NOT** taşımak (RB-AP-ID-04). ETSI TS 119 472-1
(EAA-5.2.2.1-01) nitelikli olmayan, kamu kaynaklı olmayan EAA'da `category` bulunmamasını ister; belgenin nitelikli olmayan EAA
olduğu bu yokluktan ve belge verenin güven listesindeki sınıfından anlaşılır.

## 2.2 Zorunlu öznitelikler

**Kimlik belgesi (`IdentityAttestation`)**

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `family_name` | Soyadı | metin (1–200) | `Yılmaz` |
| `given_name` | Adı | metin (1–200) | `Ayşe` |
| `birthdate` | Doğum tarihi | tarih (YYYY-MM-DD) | `1990-04-12` |
| `nationalities` | Uyruklar; bilinmiyorsa `QU`, uyruksuz `QS` | ISO 3166-1 alpha-2 dizisi (en az bir öğe) | `["TR"]` |
| `personal_administrative_number` | Ulusal kimlik numarası; yalnız bu türde | metin (5–32) | `12345678901` |
| `document_type` | Doğrulanan belgenin türü | `ID_CARD` \| `PASSPORT` \| `RESIDENCE_PERMIT` \| `DRIVING_LICENSE` | `ID_CARD` |
| `document_number_hash` | Belge numarasının anahtarlı özeti (HMAC-SHA256; anahtar yalnız kimlik servisinde); numaranın kendisi yok ve özetten geri bulunamaz | `sha256-…` | `sha256-q1…` |
| `issuing_country` | AB PID anlamıyla belgeyi veren sağlayıcının ülkesi; bugün değer taranan kimlik belgesini veren ülkedir (§4.6) | ISO 3166-1 alpha-2 | `TR` |
| `document_chip_verified` | NFC çip okundu mu (olgu; seviye değildir) | boolean | `true` |
| `verification_method` | Kimlik doğrulama yolu; `review-demo` yalnız uygulama mağazası incelemesi için verilen deneme belgesinde | `remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person` \| `review-demo` | `remote-document-liveness-face` |

**ZK kopyası (`ShortLivedIdentityAttestation`)**

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `age_over_18` | 18 yaşından büyük mü; yalnız ZK ile ispatlanabilen öğe | boolean | `true` |
| `age_over_15` | 15 yaşından büyük mü; yalnız ZK ile ispatlanabilen öğe ([[ADR-0064]]) | boolean | `true` |

**Takma ad tohumu (`PseudonymSeed`)**

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `pseudonym_seed` | Site başına takma ad türetmek için tohum; kişinin değişmeyen kimliğinden ayrı bir anahtarla türetilir, saklanmaz (RB-AP-ID-07) | base64url, 43 karakter | `Qm9…` |

**Sürücü belgesi bilgisi (`DrivingLicenceAttestation`)**

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `family_name` | Soyadı | metin (1–200) | `Yılmaz` |
| `given_name` | Adı | metin (1–200) | `Ayşe` |
| `issuing_country` | Kartı veren ülke | ISO 3166-1 alpha-2 | `TR` |
| `document_number_hash` | Kart numarasının anahtarlı özeti | `sha256-…` | `sha256-Zx…` |
| `driving_privileges` | Sınıflar: `[{ category, issue_date?, expiry_date? }]`; AB 2006/126 sınıf kodları, ulusal ekler aynen (1–32 öğe) | nesne dizisi | `[{"category":"B","issue_date":"2010-06-01"}]` |
| `licence_expiry_date` | Kartın bitiş tarihi | tarih | `2034-06-01` |
| `verified_at` | Kartın incelendiği gün | tarih | `2026-10-11` |
| `verification_method` | İnceleme yolu | `remote-document-liveness-face` | `remote-document-liveness-face` |
| `not_official_licence` | Resmî sürücü belgesi olmadığının açık göstergesi; her zaman `true` | sabit `true` | `true` |

`driving_privileges[].category` sürücü belgesi sınıfıdır; §2.1'deki hukuki kategoriyle ilgisi yoktur.

## 2.3 İsteğe bağlı öznitelikler

| Tür | Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|---|
| Kimlik belgesi | `age_over_18` | Doğum tarihinden türetilir; yaş doğrulamasında yalnız bu alan açılır. AB PID kümesinde yoktur; ISO/IEC 18013-5 adıyla Tamga alanıdır ([[ADR-0045]] K3) | boolean | `true` |
| Kimlik belgesi | `age_over_15` | Doğum tarihinden aynı kuralla türetilir; ISO/IEC 18013-5 `age_over_NN` deseni. Kimlik belgesinin yaş eşikleri kapalı kümedir (15, 18); yeni eşik yalnız ADR ile eklenir ([[ADR-0064]] K2) | boolean | `true` |
| Sürücü belgesi bilgisi | `birth_date` | Kartta varsa doğum tarihi (ISO/IEC 18013-5 mDL adı) | tarih | `1990-04-12` |
| Sürücü belgesi bilgisi | `licence_issue_date` | Kartın veriliş tarihi (varsa) | tarih | `2024-06-01` |
| Sürücü belgesi bilgisi | `age_over_18` | Türetilmiş | boolean | `true` |

## 2.4 Koşullu öznitelikler

Yok.

## 2.5 Zorunlu üst veri

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `iss` | Belge verenin adresi (kimlik servisi) | URI | `https://id.tamga.network` |
| `vct` | Tür (SD-JWT VC); mdoc'ta docType aynı değerdir | URN | `urn:tamga:id:IdentityAttestation:1` |
| `vct#integrity` | Tür tanımının katalogdaki özeti (RB-SCH-01) | `sha256-…` | `sha256-…` |
| `iat` | Verildiği an; mdoc'ta `validityInfo.signed` | NumericDate | `1791763200` |
| `exp` | Geçerliliğin sonu; mdoc'ta `validityInfo.validUntil` (§6.1) | NumericDate | `1854835200` |
| `cnf` | Cüzdanın cihaz anahtarı (holder bağı); mdoc'ta `deviceKeyInfo` | JWK | — |
| `status` | İptal listesi atfı `status_list {idx, uri}`; ZK kopyası ve takma ad tohumunda yok (§6.2) | nesne | `{"status_list":{"idx":48213,"uri":"https://status.tamga.network/7f3a9c21"}}` |

Belge verenin kimliği (Ek V b) imza başlığındadır: `x5c` (yaprak + ara sertifika, kök hariç).

## 2.6 İsteğe bağlı üst veri

Yok. `nbf` bugün yazılmaz (§7.2).

## 2.7 Koşullu üst veri

`category` bu türlerde yoktur (§2.1).

---

# 3. Kodlama

## 3.1 ISO/IEC 18013-5 (mdoc)

**Yakın alan analizi (ARB_02).** Kimliğin yüz yüze, internetsiz gösterilmesi gerekebilir (kurumda kayıt masası, kapıda yaş
denetimi); bu yüzden kimlik belgesi ISO/IEC 18013-5 mdoc olarak da verilir ([[ADR-0013]]). Sürücü belgesi bilgisi resmî
denetimde kullanılmadığı için mdoc olarak verilmez ([[ADR-0039]]); takma ad tohumu hiç gösterilmez. ZK kopyası yalnız mdoc'tur.

| Tür | docType | Ad alanı |
|---|---|---|
| Kimlik belgesi | `urn:tamga:id:IdentityAttestation:1` | `tamga.id.1` |
| ZK kopyası | `urn:tamga:id:ShortLivedIdentityAttestation:1` | `tamga.id.1` |

Kodlama kuralları: `tstr`, `uint`, `bool` ve `full-date` RFC 8610 / RFC 8943 anlamındadır; `full-date` = #6.1004(tstr). `tstr`
UTF-8'dir. Öğe değerleri tarih dışında SD-JWT VC'dekiyle aynıdır. MSO'da `digestAlgorithm` SHA-256, `validityInfo`
(`signed`, `validFrom`, `validUntil`; `tdate`, saniye kesri yok, saat dilimi `Z`), `deviceKeyInfo` ve iptal listesi atfı
`status.status_list {idx, uri}` (SD-JWT kopyasıyla aynı bit; adres aynı listenin CWT gösterimidir — `application/statuslist+cwt`,
[[ADR-0048]] K3, paketler 0.6.0) bulunur. İmza ES256 (COSE), `x5chain` aynı belge veren
sertifikasıdır.

| Veri tanımlayıcısı | Öğe tanımlayıcısı | Kodlama | Ad alanı |
|---|---|---|---|
| `family_name` | `family_name` | tstr | `tamga.id.1` |
| `given_name` | `given_name` | tstr | `tamga.id.1` |
| `birthdate` | `birth_date` | full-date | `tamga.id.1` |
| `nationalities` | `nationality` | [+ tstr] (alpha-2 dizisi) | `tamga.id.1` |
| `personal_administrative_number` | `personal_administrative_number` | tstr | `tamga.id.1` |
| `document_type` | `document_type` | tstr | `tamga.id.1` |
| `document_number_hash` | `document_number_hash` | tstr | `tamga.id.1` |
| `issuing_country` | `issuing_country` | tstr | `tamga.id.1` |
| `document_chip_verified` | `document_chip_verified` | bool | `tamga.id.1` |
| `verification_method` | `verification_method` | tstr | `tamga.id.1` |
| `age_over_18` | `age_over_18` | bool | `tamga.id.1` |
| `age_over_15` | `age_over_15` | bool | `tamga.id.1` |

Ad ve kodlama AB PID Tablo 6'ya göredir ([[ADR-0045]] K2); ad tablosu açık paketlerdedir (`@tamga-network/core/pid`). Ad alanı
`tamga.id.1` Tamga'ya özgü bir ad alanıdır (ARB_10): belge PID olmadığı için `eu.europa.ec.eudi.pid.1` kullanılmaz.

**Örnek (kimlik belgesi, yalnız yaş için açılan öğeler):**

```text
docType: "urn:tamga:id:IdentityAttestation:1"
nameSpaces: { "tamga.id.1": [ { elementIdentifier: "age_over_18", elementValue: true } ] }
MSO.validityInfo: { signed: 2026-10-11T08:00:00Z, validFrom: 2026-10-11T08:00:00Z, validUntil: 2028-10-10T08:00:00Z }
MSO.status: { status_list: { idx: 48213, uri: "https://status.tamga.network/7f3a9c21" } }
```

## 3.2 SD-JWT VC

Belgeler [[t:SD-JWT-VC]] olarak, HAIP 1.0'ın SD-JWT VC profiline uygun verilir (ARB_01b): başlıkta `alg` ES256, `typ`
`dc+sd-jwt`, `x5c`; `_sd_alg` sha-256; sahte özet (decoy) yok. `vct` URN biçimindedir (`urn:tamga:<alan>:<Tür>:<ana sürüm>`) ve
ağda tektir (ARB_05); tür tanımı (Type Metadata) katalogdan gelir ve `vct#integrity` zorunludur (ARB_31, RB-SCH-01).

"Seçici açıklama" sütunu Type Metadata'daki `sd` değeridir: **MUST** = `always`, **MAY** = `allowed`, **MUST NOT** = `never`
(ARB_30). Dizi öğeleri ayrı ayrı açıklanır (`nationalities` için `path: ["nationalities", null]`, RFC 9901 §4.2.2).

**Kimlik belgesi — IANA kayıtlı adlar**

| Veri tanımlayıcısı | Claim adı | Kodlama | Kaynak | Seçici açıklama |
|---|---|---|---|---|
| `family_name` | `family_name` | string | OpenID Connect Core §5.1 | MUST |
| `given_name` | `given_name` | string | OpenID Connect Core §5.1 | MUST |
| `birthdate` | `birthdate` | string, YYYY-MM-DD | OpenID Connect Core §5.1 | MUST |
| `nationalities` | `nationalities` | string dizisi (alpha-2), her öğe ayrı | OpenID Connect for Identity Assurance §4.1 | MUST (her öğe) |

**Kimlik belgesi — AB PID adları ve Tamga'ya özgü adlar**

| Veri tanımlayıcısı | Claim adı | Kodlama | Not | Seçici açıklama |
|---|---|---|---|---|
| `personal_administrative_number` | `personal_administrative_number` | string | AB PID adı | MUST |
| `issuing_country` | `issuing_country` | string (alpha-2) | AB PID adı (§4.6) | MUST |
| `document_type` | `document_type` | string (küme) | Tamga'ya özgü | MUST |
| `document_number_hash` | `document_number_hash` | string `sha256-…` | Tamga'ya özgü | MUST |
| `document_chip_verified` | `document_chip_verified` | boolean | Tamga'ya özgü | MUST |
| `verification_method` | `verification_method` | string (küme) | Tamga'ya özgü | MUST |
| `age_over_18` | `age_over_18` | boolean | ISO/IEC 18013-5 adı | MUST |
| `age_over_15` | `age_over_15` | boolean | ISO/IEC 18013-5 adı ([[ADR-0064]]) | MUST |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status` | aynı | — | taşıma profili | MUST NOT |

**Takma ad tohumu**

| Veri tanımlayıcısı | Claim adı | Kodlama | Not | Seçici açıklama |
|---|---|---|---|---|
| `pseudonym_seed` | `pseudonym_seed` | string (base64url) | Tamga'ya özgü; hiçbir doğrulayıcı kapsamında yer almaz | MUST NOT (belge hiç gösterilmez) |

**Sürücü belgesi bilgisi**

| Veri tanımlayıcısı | Claim adı | Kodlama | Not | Seçici açıklama |
|---|---|---|---|---|
| `family_name`, `given_name` | aynı | string | OpenID Connect Core §5.1 | MUST |
| `birth_date` | `birth_date` | string, YYYY-MM-DD | ISO/IEC 18013-5 mDL adı ([[ADR-0045]] K4) | MUST |
| `issuing_country` | `issuing_country` | string (alpha-2) | ISO/IEC 18013-5 mDL adı | MUST |
| `document_number_hash` | aynı | string `sha256-…` | Tamga'ya özgü | MUST |
| `driving_privileges` | aynı | nesne dizisi | ISO/IEC 18013-5 mDL adı; resmî mDL ad alanı kullanılmaz (RB-AP-ID-08) | MUST |
| `licence_issue_date`, `licence_expiry_date` | aynı | string, YYYY-MM-DD | Tamga'ya özgü | MUST |
| `verification_method`, `age_over_18` | aynı | string / boolean | — | MUST |
| `verified_at` | aynı | string, YYYY-MM-DD | Tamga'ya özgü | MUST NOT |
| `not_official_licence` | aynı | sabit `true` | Tamga'ya özgü; her sunumda görünür | MUST NOT |

**Örnek (kimlik belgesi; JWT claim kümesi, açıklamalar çözülmüş hâliyle):**

```json
{
  "iss": "https://id.tamga.network",
  "vct": "urn:tamga:id:IdentityAttestation:1",
  "vct#integrity": "sha256-…",
  "iat": 1791763200,
  "exp": 1854835200,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 48213, "uri": "https://status.tamga.network/7f3a9c21" } },
  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birthdate": "1990-04-12",
  "nationalities": ["TR"],
  "personal_administrative_number": "12345678901",
  "document_type": "ID_CARD",
  "document_number_hash": "sha256-…",
  "issuing_country": "TR",
  "document_chip_verified": false,
  "verification_method": "remote-document-liveness-face",
  "age_over_18": true,
  "age_over_15": true
}
```

Verilen belgede kişi alanlarının her biri ayrı bir açıklamadır (disclosure); `nationalities` dizisinin her öğesi de ayrı
açıklamadır. Kodlanmış belge ve açıklama örnekleri uyum vektörlerindedir (`conformance/vectors/sd-jwt`).

## 3.3 W3C VCDM

Kullanılmaz: Tamga JSON-LD taşıyıcısı kullanmaz.

---

# 4. Kullanım

## 4.1 Kullanım durumları ve doğrulayıcının istediği alanlar

| Kullanım | İstenen alanlar | Kural |
|---|---|---|
| Yaş doğrulaması | `age_over_18` ya da `age_over_15` (tek eşik) | Başka alan istenmez; iki eşik birlikte istenmez, yaş aralığını ele verir ([[ADR-0064]] K3); tarayıcıda mdoc ile, istenirse ZK kopyasıyla sıfır bilgi ispatı |
| Kurumda kayıt eşleştirmesi (belge vermeden önce) | `personal_administrative_number`, `birthdate`, `given_name`, `family_name` | Kurumun belge verme servisi yalnız kayıtlı kapsamıyla ve tam doğrulama hattından geçirerek alır; eşleştirme anahtarlarını saklamaz ve loglamaz (RB-RP-ID-01) |
| "Geçerli Tamga kimliği var mı" | hiçbiri | Referans politika `event-tamga-id` |
| Web sitesine kayıt ve giriş ("Tamga ile giriş yap") | kayıtta `given_name`, `family_name`; girişte hiçbiri | Hesap anahtarı site başına takma addır; `document_number_hash` ve kimlik numarası istenmez (RB-RP-13) |
| Yüksek riskli işlem | kapsamına göre | Yüz eşleştirmesi gerekiyorsa doğrulayıcının sorumluluğudur; belge portre taşımaz (RB-RP-11) |
| Sürücü belgesi sınıfı bilgisi | `driving_privileges` ve gerekenler | Resmî denetim ve resmî işlemlerde kullanılmaz; ekran "resmî sürücü belgesi yerine geçmez" der (§4.8) |

**PID istenmesi (ARB_27).** Bu türleri kabul eden doğrulayıcının ayrıca PID istemesi gerekmez. Devlet PID'i geldiğinde kurumların
kişiyi eşleştirmek için PID'i de kabul etmesi ayrı bir kararla açılır.

## 4.2 Belge verme politikası

| Şart | Kimlik belgesi, ZK kopyası, takma ad tohumu | Sürücü belgesi bilgisi |
|---|---|---|
| Belge veren | Yalnız kimlik servisi (`id.tamga.network`); kurumlar bu türleri veremez | aynı |
| Kategori · sınıf | `IDENTITY` · `EAA` · I2 ([[ADR-0022]]) | aynı |
| Tür yetkisi | Yalnız kimlik servisinin kaydında (izin listesi) | aynı |
| Anahtar | Kimlik servisinin belge imza anahtarı; iptal listesi anahtarı ayrı (RB-AP-03) | aynı |
| Ön koşul | Kimlik doğrulaması (§4.3); ZK kopyası ve tohum yalnız kimlik belgesiyle birlikte ya da onun yenileme belirteciyle | Cüzdandaki **etkin Tamga kimlik belgesi** sunulur (ad, soyad, doğum tarihi); karttaki ad ve doğum tarihi onunla eşleşmeli (RB-AP-ID-09) |
| Kopyalar | Kimlik belgesi 10 kopya, her biri ayrı cihaz anahtarına; doğrulayıcı başına ayrı kopya (ARF yöntem D). ZK kopyası küçük paketler hâlinde (en çok 3) | 10 kopya |
| Cüzdan | Belge vermeden önce cüzdan örneği kanıtı (WIA) ve anahtar kanıtı (KA) `wallet_providers[]` listesine göre doğrulanır (RB-AP-10) | aynı |
| Uygulama mağazası incelemesi | Ayrı deneme imzacısı `tamga-id-review` (I1; `verification_method: review-demo`, en çok 7 gün); yalnız tek kullanımlık inceleme koduyla; I2 isteyen hiçbir politikada geçmez | — |
| Gömülü açıklama politikası | Taşımaz ([[ADR-0046]] K1) | Taşımaz |

## 4.3 Belge vermeden önce kimlik doğrulama

| Yol | Seviye | Not |
|---|---|---|
| Uzaktan: belge, canlılık ve yüz eşleştirmesi | **T2** (ETSI TS 119 461 Substantial) | `verification_method: remote-document-liveness-face` |
| Uzaktan ve NFC çip | T2; `document_chip_verified: true` | Teknik olarak yüksek; hukuken T3 nitelikli elektronik imzadır |
| Yüz yüze | T2 | `in-person` |

Kurallar: kimlik doğrulama yalnız kimlik servisinde yapılır; kurum [[t:issuer|belge verenleri]], cüzdan ve doğrulayıcılar uzaktan
kimlik doğrulama sağlayıcısıyla konuşmaz (RB-AP-ID-01). Doğrulama başlamadan **aydınlatma metni gösterilir ve açık rıza alınır**
(RB-AP-ID-02). Sağlayıcının kararı her zaman sağlayıcının karar ucundan teyit edilir; bildirim (webhook) yalnız tetikleyicidir.
Sağlayıcı kesintisi seviyeyi düşürmez, belge verme durur. Seviye belgeye yazılmaz (RB-AP-14).

**Yaş sınırı yoktur** ([[ADR-0043]]): kimlik belgesi için asgari yaş aranmaz; şart geçerli bir kimlik belgesiyle kimlik
doğrulamasıdır. Çocuklar için veli onayı akışı hukuki inceleme sonrası ayrı kararla ele alınır.

## 4.4 Veri koruma

- Tamga bu veri için **veri sorumlusudur**.
- Belge verildikten sonra kişi alanları tutulmaz; kalıcı kayıt yalnız opak `subject_ref`, belge numarası özeti, süre ve iptal
  listesi konumlarıdır. Belge görüntüsü, özçekim, video ve OCR ham verisi Tamga'da hiç saklanmaz (RB-AP-ID-03).
- Silme talebi belgeyi iptal eder.
- Aynı belge numarası için ikinci etkin kimlik belgesi verilmez; yeniden doğrulama eskisini iptal eder (RB-AP-ID-05).

## 4.5 Gösterim ve doğrulayıcının yükümlülükleri

- Gösterim yalnız [[t:OpenID4VP]] ve [[t:DCQL]] ile, imzalı istek ve şifreli yanıtla yapılır (RB-RP-02); doğrulayıcı biçimi DCQL ile
  seçer (ör. tarayıcıda yaş doğrulaması mdoc üzerinden yalnız `age_over_18`). Yakın alanda ISO/IEC 18013-5 akışı kullanılır.
- Doğrulama kanonik hattan geçer: güven kaynağının tazeliği, sonra imza, belge veren, tür yetkisi, iptal ve cüzdan bağı
  (RB-RP-03). Belge veren güven listesinde `IDENTITY` kategorisinde ve bu türe yetkili görünmelidir.
- Kimlik numarası isteyen doğrulayıcının kaydında bu alan açıkça bulunmalıdır; cüzdan kapsam dışı talebi uyarır.
- Sonuç üç değerlidir; `INDETERMINATE` kabul değildir (RB-RP-05).
- ZK kopyası: ispat türü bağladığı için doğrulayıcı kısa ömrü görür ve iptal denetimi beklemez (`status: NOT_APPLICABLE`, gerekçe
  kısa ömür). Bu türü taşımayan (işaretsiz) ZK sunumu yalnız politika açıkça kabul ediyorsa kabul edilir (RB-AP-ID-11, [[ADR-0044]]).
- **[[t:pseudonym|Takma ad]] tohumu** hiçbir doğrulayıcı kapsamında yer almaz; cüzdan bundan site başına takma ad türetir (RB-AP-ID-07).
- İşlem verisi (ARF Topic 20, ödeme) bu türlerde tanımlı değildir.

## 4.6 AB PID ve mDL ile ilişki

Tamga doğrulayıcıları AB'nin kişi kimlik belgesini (PID) ve ISO ehliyetini ([[t:mDL]]) **dış tür** olarak tanır:

| Tür | Biçim |
|---|---|
| `urn:eudi:pid:1` | SD-JWT VC |
| `eu.europa.ec.eudi.pid.1` | mdoc |
| `org.iso.18013.5.1.mDL` | mdoc |

- **Tanınma koşulu.** Dış tür, yalnız belgeyi veren, bu türe kefil olan bir dış listenin (Ek A §6.1) kapsamındaysa kabul edilir.
  Bugün listelerin listesinde dış liste yoktur; her dış liste ayrı bir kararla eklenir.
- **İç içe [[t:selective-disclosure]].** AB PID'de adres bir nesnedir ve vatandaşlıklar bir dizidir. Kişi yalnız gerekeni açabilir:
  örneğin adresin yalnız şehri ya da vatandaşlıklardan biri. Doğrulayıcının kapsam denetimi alanın kendisine ya da üst alanına göre
  yapılır.
- **Yaş.** AB PID'de yaş alanı yoktur; AB'de yaş için ayrı yaş doğrulama belgesi kullanılır. mDL'de `age_over_18` gibi yaş öğeleri
  vardır. Tamga kimlik belgesi aynı `age_over_NN` desenini izler; eşik kümesi kapalıdır: bugün 15 ve 18 ([[ADR-0064]]).

| Tamga kimlik belgesi (SD-JWT VC) | Tamga kimlik belgesi (mdoc, `tamga.id.1`) | AB PID (SD-JWT VC) | AB PID (mdoc) |
|---|---|---|---|
| `given_name` | `given_name` | `given_name` | `given_name` |
| `family_name` | `family_name` | `family_name` | `family_name` |
| `birthdate` | `birth_date` (full-date) | `birthdate` | `birth_date` (full-date) |
| `nationalities` (dizi) | `nationality` (dizi) | `nationalities` (dizi) | `nationality` (dizi) |
| `personal_administrative_number` | `personal_administrative_number` | `personal_administrative_number` | `personal_administrative_number` |
| `issuing_country` (belgeyi veren ülke) | `issuing_country` | `issuing_country` (PID sağlayıcısının ülkesi) | `issuing_country` |
| `age_over_18` | `age_over_18` | — (ayrı yaş doğrulama belgesi) | — |
| `age_over_15` | `age_over_15` | — (ayrı yaş doğrulama belgesi) | — |
| `document_type`, `document_number_hash`, `document_chip_verified`, `verification_method` | aynı | karşılığı yok (Tamga'ya özgü) | karşılığı yok |

> **`issuing_country` (2026-10-11, proje yönetimi kararı).** Alanın anlamı AB PID'deki anlamdır: belgeyi veren kimlik
> sağlayıcısının ülkesi (Uygulama Tüzüğü (AB) 2026/1731). Bugün belgeyi Tamga'nın kimlik servisi, taranan bir kimlik belgesine
> dayanarak kendisi verdiği için değer **taranan kimlik belgesini veren ülkeyi** yansıtır. Bir devletin PID sağlayıcısı PID verdiğinde
> alan AB anlamını taşır ve belgeler alanı AB'nin tanımıyla anlatır. Kod ve şema bugün değişmez.

## 4.7 Devir — devlet PID sağlayıcısı

Devlet bir PID sağlayıcısı atadığında: kimlik servisinin kaydı `successor_id` ile devredilir, yeni belge verilmez; verilmiş belgeler
süresi dolana kadar geçerli kalır (RB-AP-ID-06). Doğrulayıcı politikaları devlet PID'ini tercih edecek biçimde güncellenir; bu tür
`DEPRECATED` olur ama doğrulanabilir kalır.

## 4.8 Sürücü belgesi bilgisi — ek kurallar

Kişinin fiziksel sürücü belgesi kartı uzaktan incelenir (belge + canlılık + yüz eşleştirme) ve karttaki sınıflar ile tarihler bir
belge olarak verilir ([[ADR-0039]]). **Resmî sürücü belgesi değildir, mDL değildir;** trafik denetiminde ve resmî işlemlerde
kullanılmaz. Belge bunu her zaman açık `not_official_licence` alanıyla, görünen adıyla ("Sürücü belgesi bilgisi — resmî sürücü
belgesi yerine geçmez") ve kartıyla söyler; doğrulayıcı ekranları aynı ibareyi gösterir (RB-AP-ID-08).

| Konu | Kural |
|---|---|
| Eşleşme | Karttaki ad ve doğum tarihi kimlik belgesiyle eşleşmezse, kart sürücü belgesi değilse, süresi geçmişse ya da sınıflar okunamıyorsa belge verilmez (RB-AP-ID-09) |
| Yok | Ulusal kimlik numarası, kısıtlama ve sağlık kodları (12. alan; `has_restrictions` olgusu da yok), fotoğraf, imza, adres; sağlayıcının not alanları okunmaz |
| Veri koruma | Tamga veri sorumlusudur; aydınlatma ve açık rıza sürücü belgesine özeldir; kişi alanları ihraçtan sonra tutulmaz; sağlayıcıya ad ve doğum tarihi gönderilmez, eşleşme kimlik servisinde anahtarlı özetle yapılır |
| Yetkili makam | Bir ülkenin yetkili makamı dijital sürücü belgesi vermeye başlayınca Tamga o ülke için bu türü yeniden vermez; kayıt `successor` ile resmî türe işaret eder (RB-AP-ID-10) |
| Hukuk | Gerçek kişilere ihraç açılmadan önce hukuki inceleme; sandbox bunu beklemez |

## 4.9 Cihaza bağlılık

Dört tür de **cihaza bağlıdır** (ARB_34): her kopya cüzdanın güvenli donanımdaki ayrı bir anahtarına bağlanır (`cnf` /
`deviceKeyInfo`; RB-AP-09, RB-WP-01). `cryptographically_bound_to` özniteliği kullanılmaz: sürücü belgesi bilgisinin kimlik belgesine
bağı belge verme anındaki sunumla kurulur ve iptalle sürdürülür (§6.2), belgede kriptografik bağ yoktur.

---

# 5. Güven çapaları

Bu türler nitelikli olmayan EAA'dır; güven çapası AB'nin güvenilir listesinden değil, Tamga'nın imzalı güven listelerinden alınır
(ARB_26):

1. Doğrulayıcı listelerin listesini (`https://trust.tamga.network/lotl.jws`) ve ulusal listeyi (`tl-tr.jws`) önceden çeker ve
   imzalarını kök sertifikalara göre doğrular. Kök parmak izleri `tamga.network/trust-anchor` sayfasında, `keys/root-fingerprints.json`'da
   ve Trust Framework'te aynı değerlerle yayımlanır (RB-OP-06).
2. Belgenin `x5c` zinciri (mdoc'ta `x5chain`) ulusal köke zincirlenir; `issuer_id` yaprak sertifikanın parmak izinden türetilir,
   `iss`'ten değil (RB-AP-01, RB-RP-04).
3. `tl-tr › issuers[]` kaydı belge vereni, kategorisini (`IDENTITY`), sınıfını ve bu türe zaman pencereli yetkisini verir; denetim
   belgenin verildiği ana (`iat`) göre yapılır (RB-RP-03).
4. Tür `lotl › schemas[]` kaydı ve katalogdaki `content_hash` (= `vct#integrity`) ile doğrulanır.

Cüzdan belge alırken aynı kayıtla belge verenin bu türü vermeye yetkili olduğunu denetler. Dış türlerin (§4.6) güven çapası
yalnız dış listeden gelir.

---

# 6. Geçerlilik ve iptal

## 6.1 Geçerlilik politikası

| Tür | Geçerlilik |
|---|---|
| Kimlik belgesi | `exp` = verildiği an + 730 gün (en çok 2 yıl); süresi dolunca yeniden doğrulama |
| ZK kopyası | En çok 24 saat ve ana belgenin bitişini geçmez (RB-AP-ID-11) |
| Takma ad tohumu | 730 gün; kimlik belgesiyle birlikte yenilenir |
| Sürücü belgesi bilgisi | `exp` = kartın bitişi ile incelemeden 1 yıl sonrasından erken olanı; otomatik yenileme süreyi uzatmaz (RB-AP-ID-09) |
| Deneme belgesi (`review-demo`) | En çok 7 gün |

## 6.2 İptal

| Tür | İptal edilebilir mi | Mekanizma |
|---|---|---|
| Kimlik belgesi | **Evet, zorunlu** | Token Status List (AB'nin Attestation Status List'i); mdoc ve SD-JWT kopyaları aynı biti taşır (mdoc kopyası listenin CWT gösterimini okur) |
| ZK kopyası | Hayır — kısa ömür iptalin yerini tutar (ARF VCR_01); ana belge iptal edilmişse yeni kopya verilmez, iptal ZK sunumunda en geç 24 saatte etkili olur | — |
| Takma ad tohumu | İptal listesi yok; gösterilmez | — |
| Sürücü belgesi bilgisi | **Evet, zorunlu** | Token Status List |

- **İptal listesi adresi (ARB_24a):** her belgede `status.status_list.uri`; kimlik servisinin listeleri `https://status.tamga.network/`
  altındadır. Adres opaktır, kurum, yıl ya da grup kodlamaz (RB-AP-18).
- **Yayın:** sabit aralıkla (bugün 2 dakika), değişiklik olmasa da; liste 6 saat geçerlidir; aralık dışı yayın yoktur (RB-AP-17,
  [[SPEC-CRED-0003]] §5). İptal birkaç dakikada etkili olur (RB-GEN-10).
- **Değerler:** `bits = 1` — geçerli ya da iptal. Kimlik servisinin türlerinde **askı yoktur**, iptal kalıcıdır (AB PID kuralı;
  RB-AP-ID-13, [[ADR-0048]] K1). Paketlerin 0.6.0 sürümüne kadar listeler `bits = 2` biçiminde yayımlanır ama askı değeri yazılmaz.
- **İptal koşulları:** İptal Politikası'ndadır ([[FW-POL-0001]] §3). Kimlik belgesi için: kişinin silme talebi, aynı belgeyle yeniden
  doğrulama, belgenin kaybolduğu ya da çalındığı bildirimi, hatalı belge, rızanın geri alınması. Sürücü belgesi bilgisi için ayrıca:
  aynı kartla yeniden doğrulama, cüzdan birimi iptali ve bağlı kimlik belgesinin iptali, yeniden verilmesi ya da silinmesi (zincirleme;
  RB-AP-ID-10).
- **Attestation Revocation List** (AB'nin ikinci mekanizması) bugün yayımlanmaz (§7.2).

---

# 7. Uyum

## 7.1 AB çerçevesiyle ilişki

- Bu rulebook AB Attestation Rulebook şablonunun (1.5) bölüm yapısını izler (ARB_29). Şablonun Topic 12 şartlarıyla eşlemesi Tamga
  Rulebook §11'dedir.
- Kimlik belgesi AB PID'inin öznitelik adlarını ve kodlamasını kullanır (Uygulama Tüzüğü (AB) 2026/1731; [[ADR-0045]]) ama PID değildir;
  PID Rulebook'un PID sağlayıcısına özgü şartları (tür `eu.europa.ec.eudi.pid.1`, `urn:eudi:pid:` ad alanı, portre) uygulanmaz.
- Sürücü belgesi bilgisi AB mDL Rulebook'unun kapsamında değildir: resmî mDL yalnız ISO/IEC 18013-5 ve resmî ad alanıyla verilir;
  Tamga bu ad alanını kullanmaz (RB-AP-ID-08).
- Bu türler Tamga Rulebook'un bütün kurallarını devralır; türe özgü kurallar RB-AP-ID-01…13 ve RB-RP-ID-01'dedir.

## 7.2 Bilinen farklar ve karar bekleyenler

| Konu | Durum |
|---|---|
| Nitelikli olmayan EAA göstergesi (ARB_12) | **Karar (2026-10-12, [[ADR-0047]] K6):** AB şablonu `category` için `eaa:eu:non-qualified` değerini önerir; ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01 ise nitelikli olmayan EAA'da `category` bulunmamasını ister. Tamga ETSI'yi izler; şablonun değeri kullanılmaz |
| Güven çapası konumu belgede (ARB_21) | **Karar (2026-10-12, [[ADR-0047]] K7):** belgeye konum alanı eklenmez; konum §5'teki listelerdir. Belgedeki bir konum belge verenin kendi beyanı olurdu; doğrulayıcı çapayı yalnız kendi seçtiği, imzası sabitlenmiş listeden alır |
| `nbf` (ETSI TS 119 472-1 teknik geçerlilik başlangıcı) | Bugün yazılmaz; geçerlilik başlangıcı `iat`'tır. Eklenmesi bir uygulama işidir |
| Attestation Revocation List | Tamga belge verenleri Status List yayımlar (AB VCR_11'e göre biri yeter); doğrulayıcı ve cüzdan çekirdeği tanımlayıcı listesini de doğrular (paketler 0.5.0; [[FW-POL-0001]] §8) |

---

# 8. Kaynaklar

AB Attestation Rulebook şablonu ve PID / mDL rulebook'ları (AB attestation rulebook kataloğu), ARF Annex 2 Topic 7, 10 ve 12,
Uygulama Tüzüğü (AB) 2026/1731, ETSI TS 119 472-1, ISO/IEC 18013-5, SD-JWT VC, HAIP 1.0, IETF Token Status List. Bu belgenin
dayandığı Tamga kararları ve şartnameleri Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-16).
