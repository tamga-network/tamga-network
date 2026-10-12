---
document_id: FW-RB-0002
title: "Education Rulebook"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-11
summary: >
  Eğitim alanındaki iki ortak belge türünün (öğrenci belgesi, diploma) rulebook'u, AB Attestation Rulebook şablonunun bölüm
  yapısıyla: öznitelikler ve üst veri, hukuki kategori, SD-JWT VC kodlaması ve seçici açıklama, kullanım ve belge verme
  koşulları, kimlik doğrulama seviyesi, doğrulama politikaları, güven çapaları, geçerlilik ve iptal, anlamsal dayanak (ELM v3 /
  ISCED-F / EQF) ve AB uyumu. Tamga Rulebook'tan ([[FW-RB-0001]]) dallanır; teknik şema SPEC-SCHEMA-0002'dedir.
---

| Sürüm | Tarih | Açıklama |
|---|---|---|
| 1.0.0 | 2026-10-02 | İlk yayın (Tamga ARF 1.0). 2026-10-11: AB Attestation Rulebook şablonunun (sürüm 1.5) bölüm yapısına taşındı; hukuki kategori, kodlama tablosu, güven çapaları ve iptal bölümleri eklendi. Kurallar değişmedi; sürüm aynı kaldı. |

**Şema sahibi:** Tamga Network (bugün geçici işletmeci). **Geri bildirim:** <https://github.com/tamga-network/tamga-network/issues>

---

# 1. Giriş

## 1.1 Kapsam ve amaç

Bu [[t:rulebook]] iki belge türünü kapsar:

| Tür | `vct` | Katalog |
|---|---|---|
| Öğrenci belgesi | `urn:tamga:edu:StudentCredential:1` | `schemas.tamga.network/v1/edu/StudentCredential/1.0.0` |
| Diploma | `urn:tamga:edu:DiplomaCredential:1` | `schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0` |

İkisi de `urn:tamga:core:TamgaBaseCredential:1` kök türünü genişletir. **Amaç:** yükseköğretim kurumunun öğrencilik ve mezuniyet
bilgisini kişinin cüzdanına, seçici paylaşımlı ve doğrulanabilir bir belge olarak vermesi; işveren, indirim veren ya da kampüs
kapısı yalnız gereken alanı görür.

Bu belgeler AB gözünde nitelikli olmayan **[[t:EAA]]**'dır; Tamga sınıfı [[t:issuer|belge verenin]] kaydına göre EAA, nitelikli ya da
kamu sınıfıdır. Teknik tanım (JSON Schema, tür tanımı, ELM eşlemesi) **[[SPEC-SCHEMA-0002]]**'dedir; çelişkide o belge geçerlidir.

## 1.2 Belge yapısı

Bölüm 2 öznitelikleri ve üst veriyi biçimden bağımsız tanımlar; Bölüm 3 kodlamayı; Bölüm 4 kullanımı, belge verme koşullarını
ve doğrulama politikalarını; Bölüm 5 güven çapalarını; Bölüm 6 geçerliliği ve iptali; Bölüm 7 AB uyumunu ve karar bekleyen
noktaları; Bölüm 8 anlamsal dayanağı ve sürümlemeyi.

## 1.3 Anahtar kelimeler

**MUST**, **MUST NOT**, **SHOULD** ve **MAY** RFC 2119 anlamındadır (Tamga Rulebook §0).

## 1.4 Terimler

Terimler Ek D'dedir; AB terimleri ARF Annex 1 anlamındadır.

---

# 2. Öznitelikler ve üst veri

## 2.0 AB şartları ve bu belgedeki karşılıkları

| Şart | Karşılık |
|---|---|
| EAA olduğunun göstergesi (ARB_12) | §2.1 — nitelikli ya da kamu sınıfındaki belge verende `category`; nitelikli olmayan EAA'da `category` yazılmaz (ETSI kuralı) |
| Belge verenin kimliği, Ek V b (ARB_15) | `iss` ve imza başlığındaki `x5c` yaprak sertifikası; ayrıca `awarding_body_name`, `awarding_body_id`, `awarding_body_country` |
| Öznenin kimliği, Ek V c (ARB_17) | `family_name`, `given_name`, `birth_date`; ulusal kimlik numarası bilerek yoktur (RB-SCH-04) |
| Geçerlilik başlangıcı ve sonu, Ek V e (ARB_19) | `iat`, `exp`; diplomada `exp` yoktur (süresiz belge) |
| Güven çapasının konumu, Ek V h (ARB_21) | Belgede ayrı alan yoktur; konum belge verenin sertifika zinciri ve Tamga güven listeleridir (§5; karar bekliyor, §7.2) |

## 2.1 Giriş ve hukuki kategori

Alanlar Avrupa Öğrenme Modeli (ELM v3) ve Europass'la eşlenir (§8); kişi alanları seçici paylaşımlıdır. **Yasak:** ulusal kimlik
numarası (TCKN vb.) hiçbir alanda yer almaz; fotoğraf alanı yoktur (yüz eşleştirmesi kimlik belgesi ya da [[t:PID]] ile yapılır).

**Hukuki kategori (`category`).** AB şablonu (1.5) ve ETSI TS 119 472-1'deki `category` özniteliği (ARF metninde eski adı
`attestation_legal_category`, ARB_25) Tamga'da kendi değerleriyle kullanılır: `urn:tamga:eaa:qualified` ya da `urn:tamga:eaa:pub`.
Belge veren **MUST** bu alanı yalnız kayıt sınıfı nitelikli ya da kamu ise ve kayıttaki değerle yazmak; I1–I2 sınıfında **MUST
NOT** (RB-AP-14). Nitelikli olmayan EAA'da alanın yokluğu, ETSI TS 119 472-1 (EAA-5.2.2.1-01) kuralına uygun göstergedir.

## 2.2 Zorunlu öznitelikler

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer | Öğrenci | Diploma |
|---|---|---|---|---|---|
| `family_name` | Soyadı | metin (1–200) | `Yılmaz` | ✓ | ✓ |
| `given_name` | Adı | metin (1–200) | `Ayşe` | ✓ | ✓ |
| `birth_date` | Doğum tarihi | tarih (YYYY-MM-DD) | `2001-03-09` | ✓ | ✓ |
| `awarding_body_name` | Kurumun resmî adı | çok dilli metin | `{"tr-TR":"Örnek Üniversitesi"}` | ✓ | ✓ |
| `awarding_body_id` | Kurum tanımlayıcısı (ELM; `issuer_id` değil) | metin (1–64) | `TR-ORNEK-UNI` | ✓ | ✓ |
| `awarding_body_country` | Kurumun ülkesi | ISO 3166-1 alpha-2 | `TR` | ✓ | ✓ |
| `isced_f_code` | Alan kodu (ISCED-F 2013, 2–4 hane) | metin | `0613` | ✓ | ✓ |
| `student_status` | Kayıt durumu; mezun içermez | `ACTIVE` \| `ON_LEAVE` | `ACTIVE` | ✓ | — |
| `enrollment_year` | Kayıt yılı | tamsayı | `2022` | ✓ | — |
| `study_level` | Düzey (EQF 5–8) | tamsayı | `6` | ✓ | — |
| `programme_title` | Program adı | çok dilli metin | `{"tr-TR":"Bilgisayar Mühendisliği"}` | ✓ | — |
| `is_enrolled` | Türetilmiş: kayıtlı öğrenci (`true`) | boolean | `true` | ✓ | — |
| `qualification_title` | Yeterlilik adı | çok dilli metin | `{"tr-TR":"Lisans"}` | — | ✓ |
| `eqf_level` | Avrupa Yeterlilikler Çerçevesi düzeyi (5–8) | tamsayı | `6` | — | ✓ |
| `awarding_date` | Mezuniyet tarihi | tarih | `2026-06-30` | — | ✓ |
| `is_graduate` | Türetilmiş, sabit `true` | sabit `true` | `true` | — | ✓ |

## 2.3 İsteğe bağlı öznitelikler

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer | Öğrenci | Diploma |
|---|---|---|---|---|---|
| `faculty_name` | Fakülte | çok dilli metin | `{"tr-TR":"Mühendislik Fakültesi"}` | ✓ | — |
| `expected_graduation_year` | Beklenen mezuniyet yılı | tamsayı | `2026` | ✓ | — |
| `enrollment_date` | Kayıt tarihi | tarih | `2022-09-19` | ✓ | — |
| `credit_points` | ECTS kredisi | sayı (0–1000) | `240` | ✓ | ✓ |
| `nqf_level` | Ulusal yeterlilik düzeyi (TYÇ) | metin (≤ 16) | `6` | — | ✓ |
| `mode_of_study` | Öğrenim biçimi | `FULL_TIME` \| `PART_TIME` \| `DISTANCE` \| `BLENDED` | `FULL_TIME` | — | ✓ |
| `grade` | Not | metin (≤ 32) | `3.41` | — | ✓ |
| `grading_scheme` | Not sistemi | çok dilli metin | `{"tr-TR":"4'lük sistem"}` | — | ✓ |
| `thesis_title` | Tez adı | çok dilli metin | `{"tr-TR":"…"}` | — | ✓ |
| `graduated_before` | Türetilmiş: bu yıldan önce mezun | tamsayı | `2027` | — | ✓ |

## 2.4 Koşullu öznitelikler

Yok.

## 2.5 Zorunlu üst veri

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer | Öğrenci | Diploma |
|---|---|---|---|---|---|
| `iss` | Belge verenin adresi | URI | `https://issuer.tamga.network/ornek-uni` | ✓ | ✓ |
| `vct`, `vct#integrity` | Tür ve tür tanımının özeti | URN, `sha256-…` | `urn:tamga:edu:DiplomaCredential:1` | ✓ | ✓ |
| `iat` | Verildiği an | NumericDate | `1782777600` | ✓ | ✓ |
| `cnf` | Cüzdanın cihaz anahtarı | JWK | — | ✓ | ✓ |
| `exp` | Geçerliliğin sonu; `exp − iat` ≤ 90 gün | NumericDate | `1790553600` | ✓ | — |
| `status` | İptal listesi atfı `status_list {idx, uri}` | nesne | `{"status_list":{"idx":9921,"uri":"https://status.tamga.network/2b8e01d4"}}` | — | ✓ |

## 2.6 İsteğe bağlı üst veri

Yok. Öğrenci belgesinde `status`, diplomada `exp` **yoktur** (§6).

## 2.7 Koşullu üst veri

| Veri tanımlayıcısı | Koşul | Veri türü | Örnek değer |
|---|---|---|---|
| `category` | Yalnız kayıt sınıfı nitelikli ya da kamu olan belge verende, kayıttaki değerle (§2.1) | `urn:tamga:eaa:qualified` \| `urn:tamga:eaa:pub` | `urn:tamga:eaa:pub` |

---

# 3. Kodlama

## 3.1 ISO/IEC 18013-5 (mdoc)

**Yakın alan analizi (ARB_02).** Eğitim belgelerinin internetsiz, yüz yüze gösterilmesi bugün gerekmiyor: kampüs geçişi için
geçiş kartı kullanılır ([[ADR-0012]]); mezuniyet teyidi çevrim içidir. Bu yüzden bu türler mdoc olarak verilmez. ISO/IEC 18013-5
yakın alan akışı kampüs kullanımına açıldığında bu analiz yenilenir.

## 3.2 SD-JWT VC

Belgeler [[t:SD-JWT-VC]] olarak, HAIP 1.0'ın SD-JWT VC profiline uygun verilir (ARB_01b): başlıkta `alg` ES256, `typ`
`dc+sd-jwt`, `x5c`; `_sd_alg` sha-256. `vct` ağda tektir (ARB_05); tür tanımı katalogdan gelir, `vct#integrity` zorunludur
(RB-SCH-01). "Seçici açıklama" sütunu Type Metadata'daki `sd` değeridir: **MUST** = `always`, **MAY** = `allowed`, **MUST NOT** =
`never` (ARB_30). Referans belge verme servisi `allowed` alanları da ayrı açıklama olarak verir.

| Veri tanımlayıcısı | Claim adı | Kodlama | Kaynak / not | Seçici açıklama |
|---|---|---|---|---|
| `family_name`, `given_name` | aynı | string | OpenID Connect Core §5.1 (IANA) | MUST |
| `birth_date` | `birth_date` | string, YYYY-MM-DD | ELM `dateOfBirth`; Tamga'ya özgü ad | MUST |
| `grade`, `thesis_title` | aynı | string / çok dilli nesne | Tamga'ya özgü (ELM eşlemesi) | MUST |
| `awarding_body_name`, `awarding_body_id`, `awarding_body_country` | aynı | çok dilli nesne / string | Tamga'ya özgü (ELM eşlemesi) | MAY |
| Öğrenci: `student_status`, `enrollment_year`, `study_level`, `programme_title`, `isced_f_code`, `faculty_name`, `expected_graduation_year`, `credit_points`, `enrollment_date`, `is_enrolled` | aynı | §2'deki türler | Tamga'ya özgü (ELM eşlemesi) | MAY |
| Diploma: `qualification_title`, `eqf_level`, `nqf_level`, `isced_f_code`, `awarding_date`, `mode_of_study`, `credit_points`, `grading_scheme`, `is_graduate`, `graduated_before` | aynı | §2'deki türler | Tamga'ya özgü (ELM eşlemesi) | MAY |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status`, `category` | aynı | — | taşıma profili | MUST NOT |

Çok dilli metin, dil etiketinden (`tr-TR`, `en-US` …) metne bir nesnedir (en az bir dil; her ortak şema en az `tr-TR` ve
`en-US` görüntüleme bilgisi taşır, RB-SCH-03).

**Varsayılan gizlilik.** `grade`, `thesis_title`, `birth_date`, `family_name`, `given_name` kişi açıkça onaylamadan açılmaz. İşverenin
"mezuniyet teyidi" senaryosunda `is_graduate`, `qualification_title`, `eqf_level`, `isced_f_code`, `awarding_body_name`,
`awarding_date` açılır; `birth_date`, `grade` ve `thesis_title` açılmaz.

**Örnek (diploma; JWT claim kümesi, açıklamalar çözülmüş hâliyle):**

```json
{
  "iss": "https://issuer.tamga.network/ornek-uni",
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "vct#integrity": "sha256-…",
  "iat": 1782777600,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 9921, "uri": "https://status.tamga.network/2b8e01d4" } },
  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2001-03-09",
  "awarding_body_name": { "tr-TR": "Örnek Üniversitesi", "en-US": "Example University" },
  "awarding_body_id": "TR-ORNEK-UNI",
  "awarding_body_country": "TR",
  "qualification_title": { "tr-TR": "Lisans", "en-US": "Bachelor's degree" },
  "eqf_level": 6,
  "isced_f_code": "0613",
  "awarding_date": "2026-06-30",
  "is_graduate": true
}
```

Kodlanmış belge ve açıklama örnekleri uyum vektörlerindedir (`conformance/vectors/sd-jwt`).

## 3.3 W3C VCDM

Kullanılmaz: JSON-LD taşıyıcısı kullanılmaz. AB eğitim birlikte çalışabilirliği için ELM JSON-LD dışa aktarımı açık konudur
(§7.2).

---

# 4. Kullanım

## 4.1 Kullanım durumları

İş başvurusunda mezuniyet teyidi, öğrenci indirimi, kampüs geçişi; yüksek riskli işlemlerde (kamu, banka) kimlik belgesiyle
birlikte. **PID istenmesi (ARB_27):** doğrulayıcının ayrıca PID istemesi gerekmez; yüz eşleştirmesi gereken yüksek riskli işlemde
kimlik belgesi ya da PID doğrulayıcının sorumluluğundadır (RB-RP-11).

## 4.2 Belge verme politikası: kim verir

| Şart | Öğrenci belgesi | Diploma |
|---|---|---|
| Belge veren kategorisi | `EDUCATION` | `EDUCATION` |
| Asgari akreditasyon | I2 (sözleşmeli) | I2; **I3 SHOULD** |
| Belge türü yetkisi | `schema_authorizations` içinde bu `vct` (zaman pencereli izin listesi) | aynı |
| Yasal yetki | Diploma ve öğrenci belgesi verme yetkisi ağın dışındadır (YÖK); kayıt kurumu bunu **kaydeder, onaylamaz** | aynı |
| Yetkili kaynak | Kurumun öğrenci bilgi sistemi (OBS) ya da onun sözleşmeli bağlantısı | aynı |
| Anahtar | Kurumun denetiminde; I3'te HSM ya da e-Mühür | aynı |

Bir kurum kendine yetki veremez; yetki kayıt kurumunun kaydıyla gelir.

## 4.3 Kime belge verilir

- **Öğrenci belgesi:** kayıt durumu `ACTIVE` ya da `ON_LEAVE` olan öğrenci. Mezun olana öğrenci belgesi verilmez; mezuniyet diploma
  türüdür.
- **Diploma:** mezuniyet süreci tamamlanmış kişi. Kişinin kendisi başvurur; üçüncü kişi (veli, vekil) adına belge vermede temsil
  yetkisi kanıtı gerekir (RB-AP-12).
- Öğrenci başına **tek etkin kopya seti** (10 kopya) olur; yeniden belge vermede eski set iptal edilir.
- Belge vermeden önce cüzdan örneği kanıtı (WIA) ve anahtar kanıtı (KA) `wallet_providers[]` listesine göre doğrulanır (RB-AP-10).

## 4.4 Belge vermeden önce kimlik doğrulama

Seviye [[t:credential|belgeye]] yazılmaz; türün ön koşuludur.

| Tür | Asgari seviye | Kabul edilen yollar |
|---|---|---|
| Öğrenci belgesi | **T1** | e-posta ile teklif ve SMS ile işlem kodu; OBS ekranında teklif |
| Diploma | **T2** | OBS'de çok etkenli girişle teklif; kurumun kayıt masası (yüz yüze); lisanslı uzaktan kimlik doğrulama |
| Ek seçenek | T3 | Nitelikli elektronik imza ya da mobil imza — yalnız yetkilendirme kodu akışıyla ya da yüz yüze; önceden yetkilendirilmiş akışla **yasak** |

Yalnız e-posta ve SMS ile **diploma verilmez**.

## 4.5 Gösterim kuralları

- Yalnız [[t:OpenID4VP]] ve [[t:DCQL]]; imzalı istek; şifreli yanıt (RB-RP-02).
- [[t:verifier|Doğrulayıcı]] başına hep aynı kopya; aynı doğrulayıcı ve aynı tür için açılan alanlar tutarlıdır (RB-WP-05).
- Doğrulayıcının kapsamı bu türün alanlarından bir alt kümedir; `grade`, `thesis_title` ya da `birth_date` isteyen doğrulayıcıya
  karşı cüzdan **aşırı talep uyarısı** gösterir; bu alanlar kapsamda yoksa istek reddedilir.
- **Gömülü açıklama politikası** ([[ADR-0046]]): kurum, bu türlerin yalnız belirli doğrulayıcılara gösterilmesini istiyorsa kuralı
  imzalı tanıtım bilgisinde (metadata) yayımlar; kural belgeye girmez. Cüzdan kuralı belge alırken saklar, gösterimde değerlendirir;
  kural tutmazsa ayrı bir uyarı gösterir, varsayılan seçim paylaşmamaktır (RB-AP-26, RB-WP-14).
- Yakın alan: kampüs geçişi için geçiş kartı kullanılır; ISO/IEC 18013-5 yakın alan akışı geldiğinde ona geçilir (§3.1).
- İşlem verisi (ARF Topic 20) bu türlerde tanımlı değildir.

**Örnek DCQL (mezuniyet teyidi):**

```json
{
  "credentials": [{
    "id": "diploma",
    "format": "dc+sd-jwt",
    "meta": { "vct_values": ["urn:tamga:edu:DiplomaCredential:1"] },
    "claims": [
      { "path": ["is_graduate"] },
      { "path": ["qualification_title"] },
      { "path": ["eqf_level"] },
      { "path": ["isced_f_code"] },
      { "path": ["awarding_body_name"] },
      { "path": ["awarding_date"] }
    ]
  }]
}
```

## 4.6 Doğrulama politikası (doğrulayıcının yükümlülükleri)

Doğrulama şartnamedeki kanonik hatla yapılır (RB-RP-03): güven kaynağının tazeliği, imza, belge veren, tür yetkisi, iptal, cüzdan
bağı. Türe özgü kurallar:

| Politika | Gerekli |
|---|---|
| `job-application-degree` (mezuniyet teyidi) | `vct = DiplomaCredential:1`; belge veren `EDUCATION` kategorisinde ve bu türe yetkili; sınıf en az I2 (**I3 SHOULD**); iptal edilmemiş; `is_graduate = true`, `eqf_level ≥ 6`; belge sahibi güvence alanı yoktur — diploma türü T2 ile bağlanmıştır |
| `student-discount` | `vct = StudentCredential:1`; belge veren en az I2; süresi dolmamış; yalnız `is_enrolled = true` |
| `campus-access` | `student-discount` ile aynı ve geçiş kartı kaydı; süreli rıza en çok 6 ay |
| Yüksek riskli (kamu, banka) | Yukarıdakiler ve kimlik belgesi ya da PID ile yüz eşleştirmesi (doğrulayıcının sorumluluğu) |

Politika adları referans doğrulayıcıdakilerdir. Sonuç üç değerlidir; `INDETERMINATE` kabul değildir; kullanıcıya "doğrulanamadı"
denir, "geçersiz" denmez.

## 4.7 Cihaza bağlılık

İki tür de **cihaza bağlıdır** (ARB_34): her kopya cüzdanın güvenli donanımdaki ayrı bir anahtarına bağlanır (`cnf`; RB-AP-09).
`cryptographically_bound_to` kullanılmaz.

---

# 5. Güven çapaları

Nitelikli olmayan EAA için güven çapası Tamga'nın imzalı güven listelerinden alınır (ARB_26):

1. Doğrulayıcı listelerin listesini (`https://trust.tamga.network/lotl.jws`) ve ulusal listeyi (`tl-tr.jws`) önceden çeker ve
   imzalarını kök sertifikalara göre doğrular; kök parmak izleri `tamga.network/trust-anchor` sayfasında ve Trust Framework'te
   aynı değerlerle yayımlanır (RB-OP-06).
2. Belgenin `x5c` zinciri ulusal köke zincirlenir; `issuer_id` yaprak sertifikanın parmak izidir (RB-AP-01, RB-RP-04).
3. `tl-tr › issuers[]` kaydı kurumun kategorisini (`EDUCATION`), sınıfını ve bu türe zaman pencereli yetkisini verir; denetim
   belgenin `iat`'ına göre yapılır.
4. Tür `lotl › schemas[]` kaydından ve katalogdaki `content_hash`'ten (= `vct#integrity`) doğrulanır.

Cüzdan belge alırken aynı kayıtla kurumun bu türü vermeye yetkili olduğunu denetler.

---

# 6. Geçerlilik ve iptal

## 6.1 Geçerlilik politikası

| Konu | Öğrenci belgesi | Diploma |
|---|---|---|
| Geçerlilik | En çok 90 gün; süresi dolmadan cüzdandaki kopyalar yenileme belirteciyle kendiliğinden tazelenir ([[ADR-0023]]), kurum kaydı yeniden okur | Süresiz (`exp` yok) |
| Kurum askıdaysa | Yeni belge verilmez; mevcut belgeler süreleri dolana kadar geçerlidir | Yeni belge verilmez; eski diplomalar verildikleri tarihe göre geçerlidir |
| Sertifika yenileme | Eski belgeler eski `issuer_id` kaydıyla doğrulanır | aynı |

## 6.2 İptal

| Konu | Öğrenci belgesi | Diploma |
|---|---|---|
| İptal edilebilir mi | Hayır — kısa ömür (≤ 90 gün) iptalin yerini tutar; süresi dolmamış ama artık doğru olmayan belge kabul edilmiş bir risktir | **Evet, zorunlu** — Token Status List (AB'nin Attestation Status List'i), `status.status_list {uri, idx}` |
| İptal koşulları | — (yeniden verilmez) | Diplomanın iptali (sahtecilik, mahkeme kararı), hatalı belge (yeniden verilerek), rızanın geri alınması, cihaz ihlali bildirimi, kişinin "belgeniz bir cüzdana eklendi" bildirimine itirazı, paylaşım kuralının değişmesi — ayrıntı [[FW-POL-0001]] §3 |
| Askıya alma | — | `SUSPENDED` (2 bitlik değer) — inceleme süresince |
| Yayın | — | Sabit aralık (bugün 2 dakika), değişiklik olmasa da; liste 6 saat geçerlidir; acil yayın yoktur; iptal birkaç dakikada etkili olur |
| Liste adresi (ARB_24a) | — | Belgedeki `status.status_list.uri`; ağın barındırdığı belge verme servisinde `https://status.tamga.network/` altında, kendi servisini işleten kurumda kurumun durum sunucusunda; adres opaktır (RB-AP-18) |

---

# 7. Uyum

## 7.1 AB çerçevesiyle ilişki

- Bu rulebook AB Attestation Rulebook şablonunun (1.5) bölüm yapısını izler (ARB_29); Topic 12 eşlemesi Tamga Rulebook §11'dedir.
- Alanlar ELM v3 ve DC4EU eğitim profilleriyle eşlenir (ARB_07, ARB_08); eşleme tür tanımındadır (§8).
- Bu türler Tamga Rulebook'un bütün kurallarını devralır.

## 7.2 Bilinen farklar ve karar bekleyenler

| Konu | Durum |
|---|---|
| Diploma için I3 akreditasyonunun zorunlu olması | Pilottan sonra **karar bekliyor** |
| ELM JSON-LD dışa aktarımı | AB eğitim birlikte çalışabilirliği için açık konu |
| Güven çapası konumu belgede (ARB_21) | Belgede isteğe bağlı bir güven çapası işaretçisi (`trust_anchor`) taşınması **karar bekliyor** |
| Nitelikli olmayan EAA göstergesi (ARB_12) | AB şablonunun `eaa:eu:non-qualified` değeri ETSI kuralıyla çelişir; benimsenmesi **karar bekliyor** |
| `nbf` ve diplomada `exp` | ETSI TS 119 472-1 ikisini de ister; Tamga bugün `nbf` yazmaz ve diploma süresizdir |
| Attestation Revocation List | Bugün yalnız Status List yayımlanır |

---

# 8. Anlamsal dayanak ve sürümleme

- ELM v3 ve Europass eşlemesi normatiftir; ISCED-F 2013 (2–4 hane), EQF 5–8, TYÇ `nqf_level`.
- Programın ISCED-F eşleme tablosu kurum tarafından sağlanır; karşılığı yoksa belge verilmez (RB-AP-13).
- Türün ana sürümü URN'dedir (`…:1`); alan ekleme ya da çıkarma yeni ana sürüm ve rulebook'ta yeni bölüm demektir.
- Ara ve yama sürüm (görüntüleme, açıklama) yeni `metadata_url` ve `content_hash` ile, aynı URN altında yayımlanır; katalog güncel
  sürümü işaretler; yayımlanmış dosya değişmez (RB-SCH-02).
- `DEPRECATED` durumdaki tür doğrulanabilir kalır.
- Bu rulebook, [[SPEC-SCHEMA-0002]] sürüm değiştirdiğinde aynı anda güncellenir.

---

# 9. Kaynaklar

AB Attestation Rulebook şablonu, ARF Annex 2 Topic 7, 10 ve 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, IETF Token Status List,
ELM v3. Bu belgenin dayandığı Tamga kararları ve şartnameleri Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02; AB şablonu yapısına taşındı 2026-10-11).
