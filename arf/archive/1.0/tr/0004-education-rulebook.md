---
document_id: FW-RB-0002
title: "Education Rulebook"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-02
summary: >
  Eğitim alanındaki iki ortak belge türünün (öğrenci belgesi, diploma) rulebook'u: tür kimlikleri, veri modeli özeti ve
  seçici paylaşım politikası, kim belge verebilir, belge vermeden önce kimlik doğrulama seviyesi, geçerlilik ve iptal,
  gösterim ve doğrulama politikası, anlamsal dayanak (ELM v3 / ISCED-F / EQF), güven çapası ve sürümleme. Tamga
  Rulebook'tan ([[FW-RB-0001]]) dallanır ve EUDI ARF Annex 3 rulebook deseniyle yazılmıştır; teknik şema
  SPEC-SCHEMA-0002'dedir, burada kurumun okuyacağı kurallar toplanır.
---

# 0. Kapsam

Bu [[t:rulebook]] iki belge türünü kapsar:

| Tür | `vct` | Katalog |
|---|---|---|
| Öğrenci belgesi | `urn:tamga:edu:StudentCredential:1` | `schemas.tamga.network/v1/edu/StudentCredential/1.0.0` |
| Diploma | `urn:tamga:edu:DiplomaCredential:1` | `schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0` |

İkisi de `urn:tamga:core:TamgaBaseCredential:1` kök türünü genişletir. Teknik tanım (JSON Schema, tür tanımı, ELM eşlemesi)
**[[SPEC-SCHEMA-0002]]**'dedir; çelişkide o belge geçerlidir. Bu rulebook [[t:ARF]] Annex 3 desenine göre şu soruları
cevaplar: kim verir, kime, hangi [[t:identity-proofing|kimlik doğrulamayla]], ne kadar geçerli, nasıl iptal edilir, nasıl
gösterilir ve doğrulanır.

Terim: bu belgeler AB gözünde nitelikli olmayan **[[t:EAA]]**'dır; Tamga sınıfı [[t:issuer|belge verenin]] kaydına göre EAA,
nitelikli ya da kamu sınıfıdır.

---

# 1. Veri modeli (özet)

## 1.1 Ortak alanlar (kök tür)

| Alan | Tür | Seçici paylaşım | Not |
|---|---|---|---|
| `family_name`, `given_name` | metin | `always` | Kişi |
| `birth_date` | tarih | `always` | İşveren senaryosunda **açılmaz** (yaş ayrımcılığı riski) |
| `awarding_body_name` | çok dilli metin | `allowed` | Kurumun resmî adı |
| `awarding_body_id` | metin | `allowed` | Kurum tanımlayıcısı (`issuer_id` değil; ELM tanımlayıcısı) |
| `awarding_body_country` | ISO 3166-1 alpha-2 | `allowed` | |
| `cnf` | JWK | — | Cüzdan anahtarına bağ (zorunlu) |
| `vct`, `vct#integrity`, `iss`, `iat`, (`exp`), (`status`), (`category`) | — | — | Taşıma profili |

**Yasak:** ulusal kimlik numarası (TCKN vb.) hiçbir alanda yer almaz; fotoğraf alanı yoktur (yüz eşleştirmesi kimlik belgesi ya
da [[t:PID]] ile yapılır).

## 1.2 Öğrenci belgesi — ek alanlar

`student_status` (`ACTIVE | ON_LEAVE`; mezun içermez), `enrollment_year`, `study_level` (EQF 5–8), `programme_title` (çok dilli
metin), `isced_f_code` (2–4 hane, zorunlu), `faculty_name`, `expected_graduation_year`, `is_enrolled` (türetilmiş, `true`).
Hepsi `allowed`. `exp` **zorunludur** ve `exp − iat` en çok 90 gündür. `status` **yoktur**.

## 1.3 Diploma — ek alanlar

`qualification_title`, `eqf_level`, `nqf_level` (TYÇ), `isced_f_code`, `awarding_date`, `mode_of_study`, `credit_points` (ECTS),
**`grade` (`always`)**, `grading_scheme`, **`thesis_title` (`always`)**, `is_graduate` (türetilmiş, sabit `true`),
`graduated_before` (türetilmiş). `exp` **yoktur**; `status` ([[t:status-list|iptal listesi]], IETF Token Status List) **zorunludur**.

## 1.4 Seçici paylaşım politikası

| Alan | Varsayılan | Kural |
|---|---|---|
| `grade`, `thesis_title`, `birth_date`, `family_name`, `given_name` | Gizli (`always`) | Kullanıcı açıkça onaylamadan açılmaz |
| Diğer alanlar | İstenirse açılır (`allowed`) | Doğrulayıcının kapsamında olmalıdır |
| `status`, `cnf`, `vct`, `iss`, `iat` | Her zaman görünür (`never`) | Kişisel veri değildir |

İşverenin "mezuniyet teyidi" senaryosu: `is_graduate`, `qualification_title`, `eqf_level`, `isced_f_code`, `awarding_body_name`,
`awarding_date` açılır; `birth_date`, `grade` ve `thesis_title` açılmaz.

---

# 2. Kim belge verebilir

| Şart | Öğrenci belgesi | Diploma |
|---|---|---|
| Belge veren kategorisi | `EDUCATION` | `EDUCATION` |
| Asgari akreditasyon | I2 (sözleşmeli) | I2; **I3 SHOULD** |
| Belge türü yetkisi | `schema_authorizations` içinde bu `vct` (zaman pencereli izin listesi) | aynı |
| Yasal yetki | Diploma ve öğrenci belgesi verme yetkisi ağın dışındadır (YÖK); kayıt kurumu bunu **kaydeder, onaylamaz** | aynı |
| Yetkili kaynak | Kurumun öğrenci bilgi sistemi (OBS) ya da onun sözleşmeli bağlantısı | aynı |
| Anahtar | Kurumun denetiminde; I3'te HSM ya da e-Mühür | aynı |

Bir kurum kendine yetki veremez; yetki kayıt kurumunun kaydıyla gelir.

---

# 3. Kime belge verilir

- **Öğrenci belgesi:** kayıt durumu `ACTIVE` ya da `ON_LEAVE` olan öğrenci. Mezun olana öğrenci belgesi verilmez; mezuniyet
  diploma türüdür.
- **Diploma:** mezuniyet süreci tamamlanmış kişi. Kişinin kendisi başvurur; üçüncü kişi (veli, vekil) adına belge vermede temsil
  yetkisi kanıtı gerekir (RB-AP-12).
- Öğrenci başına **tek etkin kopya seti** (10 kopya) olur; yeniden belge vermede eski set iptal edilir.

---

# 4. Belge vermeden önce kimlik doğrulama

Seviye [[t:credential|belgeye]] yazılmaz; türün ön koşuludur.

| Tür | Asgari seviye | Kabul edilen yollar |
|---|---|---|
| Öğrenci belgesi | **T1** | e-posta ile teklif ve SMS ile işlem kodu; OBS ekranında teklif |
| Diploma | **T2** | OBS'de çok etkenli girişle teklif; kurumun kayıt masası (yüz yüze); lisanslı uzaktan kimlik doğrulama |
| Ek seçenek | T3 | Nitelikli elektronik imza ya da mobil imza — yalnızca yetkilendirme kodu akışıyla ya da yüz yüze; önceden yetkilendirilmiş akışla **yasak** |

Yalnızca e-posta ve SMS ile **diploma verilmez**.

---

# 5. Geçerlilik, yenileme, iptal

| Konu | Öğrenci belgesi | Diploma |
|---|---|---|
| Geçerlilik | En çok 90 gün; süresi dolmadan cüzdandaki kopyalar yenileme belirteciyle kendiliğinden tazelenir, kurum kaydı yeniden okur | Süresiz (`exp` yok) |
| İptal listesi | Yok — kısa ömür iptalin yerini tutar; süresi dolmamış ama artık doğru olmayan belge kabul edilmiş bir risktir | **Zorunlu**; `status.status_list {uri, idx}` |
| İptal nedenleri | — (yeniden verilmez) | Diplomanın iptali (sahtecilik, mahkeme kararı), hatalı belge (yeniden verilerek), rızanın geri alınması, cihaz ihlali bildirimi |
| Askıya alma | — | `SUSPENDED` (2 bitlik değer) — inceleme süresince |
| Yayın aralığı | — | Sabit aralık (2 dakika); liste 6 saat geçerlidir; acil yayın yoktur; iptal birkaç dakikada etkili olur |
| Kurum askıdaysa | Yeni belge verilmez; mevcut belgeler süreleri dolana kadar geçerlidir | Yeni belge verilmez; eski diplomalar verildikleri tarihe göre geçerlidir |
| Sertifika yenileme | Eski belgeler eski `issuer_id` kaydıyla doğrulanır | aynı |

---

# 6. Gösterim kuralları

- Yalnızca [[t:OpenID4VP]] ve [[t:DCQL]]; imzalı istek; şifreli yanıt.
- [[t:verifier|Doğrulayıcı]] başına hep aynı kopya; aynı doğrulayıcı ve aynı tür için açılan alanlar tutarlıdır.
- Doğrulayıcının kapsamı bu türün alanlarından bir alt kümedir; `grade`, `thesis_title` ya da `birth_date` isteyen doğrulayıcıya
  karşı cüzdan **aşırı talep uyarısı** gösterir; bu alanlar kapsamda yoksa istek reddedilir.
- Yakın alan: kampüs geçişi için geçiş kartı kullanılır; ISO/IEC 18013-5 yakın alan akışı geldiğinde ona geçilir.

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

---

# 7. Doğrulama politikası (doğrulayıcı için)

Doğrulama şartnamedeki kanonik hatla yapılır (RB-RP-03). Türe özgü kurallar:

| Politika | Gerekli |
|---|---|
| `job-application-degree` (mezuniyet teyidi) | `vct = DiplomaCredential:1`; belge veren `EDUCATION` kategorisinde ve bu türe yetkili; sınıf en az I2 (**I3 SHOULD**); iptal edilmemiş; `is_graduate = true`, `eqf_level ≥ 6`; belge sahibi güvence alanı yoktur — diploma türü T2 ile bağlanmıştır |
| `student-discount` | `vct = StudentCredential:1`; belge veren en az I2; süresi dolmamış; yalnızca `is_enrolled = true` |
| `campus-access` | `student-discount` ile aynı ve geçiş kartı kaydı; süreli rıza en çok 6 ay |
| Yüksek riskli (kamu, banka) | Yukarıdakiler ve kimlik belgesi ya da PID ile yüz eşleştirmesi (doğrulayıcının sorumluluğu) |

Politika adları referans doğrulayıcıdakilerdir. Sonuç üç değerlidir; `INDETERMINATE` kabul değildir; kullanıcıya "doğrulanamadı"
denir, "geçersiz" denmez.

---

# 8. Anlamsal dayanak ve dışa aktarım

- ELM v3 ve Europass eşlemesi normatiftir; ISCED-F 2013 (2–4 hane), EQF 5–8, TYÇ `nqf_level`.
- JSON-LD taşıyıcısı kullanılmaz.
- Programın ISCED-F eşleme tablosu kurum tarafından sağlanır; karşılığı yoksa belge verilmez.

---

# 9. Güven çapası

Doğrulayıcı belge vereni `tl-tr › issuers[]` kaydından (`issuer_id` = yaprak sertifikanın parmak izi), türü
`lotl › schemas[]` kaydından ve katalogdaki `content_hash`'ten doğrular; kök parmak izleri `tamga.network/trust-anchor`
sayfasındadır.

---

# 10. Sürümleme ve değişiklik

- Türün ana sürümü URN'dedir (`…:1`); alan ekleme ya da çıkarma yeni ana sürüm ve rulebook'ta yeni bölüm demektir.
- Ara ve yama sürüm (görüntüleme, açıklama) yeni `metadata_url` ve `content_hash` ile, aynı URN altında yayınlanır; katalog
  güncel sürümü işaretler; yayınlanmış dosya değişmez.
- `DEPRECATED` durumdaki tür doğrulanabilir kalır.
- Bu rulebook, [[SPEC-SCHEMA-0002]] sürüm değiştirdiğinde aynı anda güncellenir.

---

# 11. Açık konular

- Pilottan sonra diploma için I3 akreditasyonunun zorunlu hâle getirilmesi.
- AB eğitim birlikte çalışabilirliği için ELM JSON-LD biçiminde dışa aktarım.
- Belgede isteğe bağlı bir güven çapası işaretçisi (`trust_anchor`) taşınması.

---

# Kaynaklar

Bu belgenin dayandığı kararlar, şartnameler ve standartlar Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).
