---
document_id: FW-RB-0002
title: Attestation Rulebook — Eğitim (Öğrenci Belgesi ve Diploma)
category: Framework
domain: Schema
status: Active
review_status: Completed
version: 0.1.0
created: 2026-09-24
last_updated: 2026-09-24
authors:
  - Tamga Network Engineering
language: tr
document_type: framework
audience:
  - institutions
  - integrators
  - regulators
  - engineers
  - ai-agents
stability: Evolutionary
maturity: Draft
tags:
  - framework
  - rulebook
  - attestation-rulebook
  - education
  - diploma
  - student-credential
keywords:
  - attestation rulebook education
  - urn:tamga:edu:StudentCredential:1
  - urn:tamga:edu:DiplomaCredential:1
  - who may issue
  - identity proofing level per type
  - validity revocation presentation rules
  - ELM ISCED-F EQF
related:
  - FW-ARF-0001
  - FW-TF-0001
  - FW-RB-0001
  - SPEC-SCHEMA-0002
  - SPEC-SCHEMA-0001
  - SPEC-CRED-0002
  - SPEC-CRED-0003
  - SPEC-PROTO-0001
  - SPEC-PROTO-0002
  - SPEC-ID-0003
  - RS-SCHEMA-0001
  - ADR-0010
depends_on:
  - SPEC-SCHEMA-0002
  - ADR-0010
summary: >
  Eğitim alanındaki iki NETWORK tipinin (öğrenci belgesi, diploma) attestation
  rulebook'u: tip kimlikleri, veri modeli özeti ve seçici açıklama politikası, kim ihraç
  edebilir, ihraç öncesi kimlik ispatı seviyesi, geçerlilik ve iptal, sunum ve doğrulama
  politikası, semantik dayanak (ELM v3 / ISCED-F / EQF), güven çapası ve sürümleme.
  EUDI ARF Annex 3 Attestation Rulebook deseniyle yazılmıştır; teknik şema
  SPEC-SCHEMA-0002'dedir, burada kurum-okunur kurallar toplanır.
priority: High
---

# 0. Kapsam

Bu rulebook şu iki tipi kapsar:

| Tip | `vct` | `schema_id` | Katalog |
|---|---|---|---|
| Öğrenci belgesi | `urn:tamga:edu:StudentCredential:1` | `keccak256(vct)` | `schemas.tamga.network/v1/edu/StudentCredential/1.0.0` |
| Diploma | `urn:tamga:edu:DiplomaCredential:1` | `keccak256(vct)` | `schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0` |

Her ikisi `urn:tamga:core:TamgaBaseCredential:1` kök tipini genişletir ([[SPEC-SCHEMA-0001]]/D4).
Teknik tanım (JSON Schema, Type Metadata, ELM eşlemesi) **[[SPEC-SCHEMA-0002]]**'dedir; çelişkide
o belge geçerlidir. Bu rulebook ARF Annex 3 desenine göre şu soruları cevaplar: kim verir, kime,
hangi kimlik ispatıyla, ne kadar geçerli, nasıl iptal edilir, nasıl sunulur ve doğrulanır.

Terim: bu belgeler AB gözünde nitelikli olmayan **EAA**'dır; Tamga sınıfı issuer'ın kaydına göre
EAA / QUALIFIED / PUB ([[ADR-0010]] K5).

---

# 1. Veri modeli (özet)

## 1.1 Ortak claim'ler (kök tip)

| Claim | Tip | Seçici açıklama | Not |
|---|---|---|---|
| `family_name`, `given_name` | string | `always` | Kişi |
| `birth_date` | DateOnly | `always` | İşveren senaryosunda **açılmaz** (yaş ayrımcılığı yüzeyi) |
| `awarding_body_name` | LangString | `allowed` | Kurum resmî adı |
| `awarding_body_id` | string | `allowed` | Kurum tanımlayıcısı (`issuer_id` değil; ELM identifier) |
| `awarding_body_country` | ISO 3166-1 alpha-2 | `allowed` | |
| `cnf` | JWK | — | Holder binding (zorunlu) |
| `vct`, `vct#integrity`, `iss`, `iat`, (`exp`), (`status`), (`category`) | — | — | Tel profili |

**Yasak:** ulusal kimlik numarası (TCKN vb.) hiçbir alanda ([[SPEC-SCHEMA-0002]]/E1, E10);
fotoğraf claim'i yok (DB-9; yüz eşleştirme kimlik belgesi/PID ile).

## 1.2 Öğrenci belgesi — ek claim'ler

`student_status` (`ACTIVE | ON_LEAVE`; mezun içermez), `enrollment_year`, `study_level` (EQF 5–8),
`programme_title` (LangString), `isced_f_code` (2–4 hane, zorunlu), `faculty_name`,
`expected_graduation_year`, `is_enrolled` (türetilmiş, `true`). Hepsi `allowed`.
`exp` **zorunlu**, `exp − iat ≤ 90 gün` (E4, E9). `status` **yok** (E5).

## 1.3 Diploma — ek claim'ler

`qualification_title`, `eqf_level`, `nqf_level` (TYÇ), `isced_f_code`, `awarding_date`,
`mode_of_study`, `credit_points` (ECTS), **`grade` (`always`)**, `grading_scheme`,
**`thesis_title` (`always`)**, `is_graduate` (türetilmiş, sabit `true` — E3),
`graduated_before` (türetilmiş). `exp` **yok**; `status` (Token Status List) **zorunlu** (E4, E5).

## 1.4 Seçici açıklama politikası (kurum-okunur)

| Alan | Varsayılan sunum | Kural |
|---|---|---|
| `grade`, `thesis_title`, `birth_date`, `family_name`, `given_name` | Gizli (`always`) | Kullanıcı açıkça onaylamadan açılmaz |
| Diğer alanlar | İstenirse açılır (`allowed`) | RP scope'unda olmalı |
| `status`, `cnf`, `vct`, `iss`, `iat` | Her zaman görünür (`never`) | Kişisel veri değildir |

İşveren "mezuniyet teyidi" senaryosu: `is_graduate`, `qualification_title`, `eqf_level`,
`isced_f_code`, `awarding_body_name`, `awarding_date` açılır; `birth_date`, `grade`,
`thesis_title` açılmaz ([[SPEC-SCHEMA-0002]] §3.7).

---

# 2. Kim ihraç edebilir

| Şart | Öğrenci belgesi | Diploma |
|---|---|---|
| Issuer kategorisi | `EDUCATION` | `EDUCATION` |
| Asgari akreditasyon | I2 (sözleşmeli) | I2; **I3 SHOULD** (pilot sonrası I3 MUST — ÖNERİ) |
| Şema yetkisi | `schema_authorizations` içinde bu `vct` (zaman pencereli, allowlist) | aynı |
| Yasal yetki | Diploma/öğrenci belgesi verme yetkisi ekosistem dışında (YÖK); Registrar bunu **kaydeder, onaylamaz** | aynı |
| Authentic Source | Kurumun öğrenci bilgi sistemi (OBS) veya bunun sözleşmeli adaptörü; demo'da portal veritabanı (S-4) | aynı |
| Anahtar | Kurumun kontrolünde (G1); I3'te HSM/e-Mühür | aynı |

Bir kurum kendi kendine yetki veremez; yetki Registrar kaydıyla gelir ([[FW-RB-0001]] RB-REG-04).

---

# 3. Kime ihraç edilir

- **Öğrenci belgesi:** kayıt durumu `ACTIVE` veya `ON_LEAVE` olan öğrenci. Mezun olana
  öğrenci belgesi verilmez; mezuniyet = diploma tipi.
- **Diploma:** mezuniyet süreci tamamlanmış kişi. Öznenin kendisi başvurur; üçüncü kişi (veli/vekil)
  adına ihraçta temsil yetkisi kanıtı gerekir (RB-AP-12).
- Öğrenci başına **tek aktif kopya seti** (batch 10); yeniden ihraçta eski set iptal edilir.

---

# 4. İhraç öncesi kimlik ispatı (bağlama seviyesi)

Seviye credential'a yazılmaz; tipin ön koşuludur ([[SPEC-PROTO-0001]]/PR7; eIDAS modeli).

| Tip | Asgari seviye | Kabul edilen yollar (Faz B) | Kaynak |
|---|---|---|---|
| Öğrenci belgesi | **T1** | e-posta offer + SMS `tx_code`; OBS ekranında offer (`on-screen`) | `docs/delivery/03` §3; DB-6 |
| Diploma | **T2** | OBS + MFA ekranında offer; kurum kayıt masası (yüz yüze); **lisanslı uzaktan kimlik doğrulama** (belge + canlılık + yüz eşleştirme — [[SPEC-ID-0003]]) | aynı; ETSI TS 119 461 |
| (Faz 0+) | T3 seçeneği | NES/mobil imza challenge — yalnızca authorization code veya yüz yüze; pre-authorized ile **yasak** | ETSI TS 119 472-3 GEN-REQ-4.1 |

Yalnızca e-posta + SMS ile **diploma verilmez**. Demo'da portal girişi sahte olduğundan diploma
T2 koşulu sapma kütüğüne S-10 olarak yazılır (ÖNERİ) ve pilotta Didit/masa yoluyla kapanır.

---

# 5. Geçerlilik, yenileme, iptal

| Konu | Öğrenci belgesi | Diploma |
|---|---|---|
| Geçerlilik | `exp ≤ iat + 90 gün` (E9); süresi dolunca **yeniden ihraç** (otomatik yenileme yok — WL7) | Süresiz (`exp` yok) |
| Status list | Yok (E5) — kısa ömür iptalin yerini tutar; "bayat belge açığı" kabul edilmiş risk (§2.1.1) | **Zorunlu** (E5); `status.status_list {uri, idx}` |
| İptal nedenleri | — (yeniden ihraç edilmez) | Diploma iptali (sahtecilik, mahkeme kararı), hatalı ihraç (yeniden ihraç ile), rıza geri alma (GT7), cihaz ihlali bildirimi |
| Askıya alma | — | `SUSPENDED` (bits=2 değeri) — inceleme süresince |
| Yayın kadansı | — | Sabit aralık (pilot 60 dk; demo 2 dk); acil yayın yok; iptal ≤ 90 dk'da etkili (B10) |
| Kurum askıda | Yeni ihraç durur; mevcut belgeler `exp`'e kadar geçerli | Yeni ihraç durur; eski diplomalar `iat`'a göre geçerli (C1) |
| Sertifika rotasyonu | Eski belgeler eski `issuer_id` kaydıyla doğrulanır | aynı |

---

# 6. Sunum kuralları

- Yalnızca OpenID4VP + DCQL; imzalı istek; şifreli yanıt ([[SPEC-PROTO-0002]]).
- Verifier başına yapışkan kopya; aynı verifier + aynı `vct` için tutarlı disclosure seti (WL5, WL6).
- RP scope'u bu tipin claim'lerinden bir alt kümedir; `grade`/`thesis_title`/`birth_date` isteyen
  RP için cüzdan **aşırı talep uyarısı** gösterir (WL8); bu alanlar scope'ta yoksa istek reddedilir.
- Yakın alan (mdoc) sunumu bu sürümde yok.

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

# 7. Doğrulama politikası (RP için)

Kanonik hat T0 + A–E ([[SPEC-API-0001]]). Tip-özel `E` adımları:

| Politika | Gerekli |
|---|---|
| `ise_alim_diploma_dogrulama` | `vct = DiplomaCredential:1`; issuer `category = EDUCATION`; issuer sınıfı ≥ I2 (**I3 SHOULD**); status aktif; `is_graduate = true`; **holder alanı yok** — diploma tipi T2 ile bağlanmıştır |
| `staj_basvurusu` | `vct = StudentCredential:1`; issuer ≥ I2; `exp` geçmemiş; `is_enrolled = true` |
| Yüksek riskli (kamu, banka) | Yukarıdakiler + kimlik belgesi/PID ile yüz eşleştirme (RP sorumluluğu) |

Sonuç üç değerli; `INDETERMINATE` kabul değildir; kullanıcıya "doğrulanamadı" denir, "geçersiz" değil.

---

# 8. Semantik dayanak ve dışa aktarım

- ELM v3 / Europass eşlemesi normatif ([[SPEC-SCHEMA-0002]] §4); ISCED-F 2013 (2–4 hane), EQF 5–8,
  TYÇ `nqf_level` ([[RS-SCHEMA-0001]]).
- JSON-LD taşıyıcısı alınmaz (D-SCHEMA-3); AB eğitim birlikte çalışabilirliği için **çıktı köprüsü**
  (ELM JSON-LD dışa aktarım) açık soru (GENEL-ANALIZ 4.C/14).
- Program → ISCED-F eşleme tablosu kurum tarafından sağlanır; karşılığı yoksa ihraç durur (E11).

---

# 9. Güven çapası

Verifier, issuer'ı `tl-tr › issuers[]` kaydından (`issuer_id` = yaprak sertifika parmak izi) ve
tipi `lotl › schemas[]` + katalog `content_hash`'inden doğrular; kök parmak izleri
`tamga.network/trust-anchor`. Belge, PID Rulebook'taki gibi opsiyonel bir `trust_anchor`
işaretçisi **taşıyabilir** (ÖNERİ; DB-16 `tamga.trust_anchor` deseni).

---

# 10. Sürümleme ve değişiklik

- Tip major'ı URN'de (`…:1`); claim ekleme/çıkarma → yeni major → yeni rulebook bölümü.
- Minor/patch (display, açıklama) → yeni `metadata_url` + `content_hash`, aynı URN; katalog
  "güncel" işaretler; yayınlanmış dosya değişmez.
- `DEPRECATED` tip doğrulanabilir kalır.
- Bu rulebook, [[SPEC-SCHEMA-0002]] sürüm artışında aynı oturumda güncellenir.

---

# 11. Demo ve pilot sapmaları (bu tipler için)

| # | Sapma | Kapanış |
|---|---|---|
| S-1 | Issuer anahtarı Tamga dev-PKI'da | KMS/HSM kurumda |
| S-2 | Status aralığı 2 dk | 60 dk |
| S-4 | Authentic Source = portal DB | OBS/CSV adaptörü |
| S-10 (ÖNERİ) | Demo'da diploma T2 kimlik ispatı olmadan (sahte öğrenci girişi) | Didit / kayıt masası ([[SPEC-ID-0003]]) |

---

# İlgili dokümanlar

[[FW-ARF-0001]] · [[FW-TF-0001]] · [[FW-RB-0001]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-API-0001]] ·
[[SPEC-WALLET-0001]] · [[SPEC-ID-0003]] · [[RS-SCHEMA-0001]] · [[ADR-0010]]

# CHANGELOG

- **0.1.0 (2026-09-24)** — İlk taslak; SPEC-SCHEMA-0002 v1.2.1 + ADR-0010 + docs/delivery/03 derlemesi.

# Durum

**Active** — 0.1.0, 2026-09-24 kabul (D-GOV-6 / DB-12). Onay kaydı operatörün arşivindedir.
