---
document_id: FW-RB-0003
title: Attestation Rulebook — Tamga Kimlik Belgesi
category: Framework
domain: Schema
status: Draft
review_status: Draft
version: 0.2.0
created: 2026-09-27
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: framework
audience:
  - institutions
  - integrators
  - regulators
  - engineers
stability: Evolutionary
maturity: Draft
tags:
  - framework
  - rulebook
  - attestation-rulebook
  - identity
keywords:
  - attestation rulebook identity
  - urn:tamga:id:IdentityAttestation:1
  - provisional identity attestation provider
  - selective disclosure national id number
  - mdoc dual format
related:
  - FW-ARF-0001
  - FW-TF-0001
  - FW-RB-0001
  - SPEC-ID-0003
  - SPEC-PROTO-0001
  - SPEC-PROTO-0002
  - SPEC-CRED-0003
  - ADR-0011
  - ADR-0013
depends_on:
  - ADR-0011
  - SPEC-ID-0003
summary: >
  Tamga'nın geçici kimlik attestation sağlayıcısı olarak verdiği kimlik belgesinin (`urn:tamga:id:IdentityAttestation:1`)
  attestation rulebook'u: kim verir, hangi kimlik ispatıyla, hangi alanlarla ve hangi seçici açıklama kuralıyla; geçerlilik
  ve iptal; iki biçim (SD-JWT VC + ISO 18013-5 mdoc); kurumların ve doğrulayıcıların kullanım kuralları; devlet PID
  sağlayıcısına devir. EUDI ARF PID Rulebook deseniyle yazılmıştır; bu belge PID değildir, bir EAA'dır.
priority: High
---

# 0. Kapsam ve statü

| Tip | `vct` | `schema_id` | Katalog |
|---|---|---|---|
| Tamga Kimlik Belgesi | `urn:tamga:id:IdentityAttestation:1` | `keccak256(vct)` | `schemas.tamga.network/v1/id/IdentityAttestation/1.0.0` |
| Aynı belgenin mdoc biçimi | docType `tamga.id.1` | — | [[ADR-0013]] |

Teknik tanım [[SPEC-ID-0003]] §9 ve şema kataloğundadır; çelişkide onlar geçerlidir. Bu rulebook yeni kural koymaz; [[ADR-0011]],
[[ADR-0013]], [[SPEC-ID-0003]] ve [[FW-RB-0001]] RB-AP-ID kurallarını tek yerde, kurum ve doğrulayıcı gözüyle toplar.

**Statü:** bu belge **PID değildir**. Devlet tarafından atanmış bir PID sağlayıcısı yokken Tamga'nın geçici olarak verdiği,
nitelikli olmayan bir **EAA**'dır (sınıf `EAA`, güvence I2; belgede `category` claim'i yok — [[ADR-0022]]); güven listesinde `pid_providers[]` boş kalır
([[SPEC-TRUST-0001]]/TL8). Devlet sağlayıcısı atanınca yeni ihraç durur ve kayıt halefe devredilir (§8).

---

# 1. Veri modeli

| Claim | Tip | Seçici açıklama | Not |
|---|---|---|---|
| `given_name`, `family_name` | string | `always` | |
| `birth_date` | tarih | `always` | |
| `nationality` | ISO 3166-1 alpha-2 | `always` | |
| `personal_administrative_number` | string | `always` | Ulusal kimlik numarası; **yalnızca bu tipte** (IDP10) |
| `document_type` | `ID_CARD` \| `PASSPORT` \| `RESIDENCE_PERMIT` \| `DRIVING_LICENSE` | `always` | Doğrulanan belge |
| `document_number_hash` | `sha256-…` | `always` | Belge numarasının **anahtarlı** özeti (HMAC-SHA256; anahtar yalnızca kimlik servisinde) — numaranın kendisi yok ve özetten geri bulunamaz |
| `issuing_country` | ISO 3166-1 alpha-2 | `always` | |
| `document_chip_verified` | boolean | `always` | NFC çip okundu mu (olgu; seviye değildir) |
| `verification_method` | `remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person` | `always` | |
| `age_over_18` | boolean | `always` | Türetilmiş; yaş doğrulamasında yalnız bu alan açılır |
| `status`, `category`, `cnf`, `vct`, `iss`, `iat`, `exp` | — | `never` | Tel profili |

**Yok:** portre/fotoğraf, adres, belge görüntüsü, güven seviyesi (LoA) claim'i ([[SPEC-PROTO-0001]]/PR7). Tüm kişi alanları
seçici açıklamalıdır; bir doğrulayıcı yalnızca kayıtlı kapsamındaki alanları isteyebilir.

---

# 2. Kim ihraç eder

| Şart | Değer |
|---|---|
| İhraççı | Tamga Network kimlik servisi (`id.tamga.network`) — tek ihraççı; kurum issuer'ları bu tipi veremez |
| Kategori / sınıf | `IDENTITY` · `EAA` · I2 ([[ADR-0022]]; bağımsız değerlendirmeden sonra yükseltilebilir) |
| Şema yetkisi | Yalnızca kimlik servisinin kaydında (allowlist) |
| Anahtar | Kimlik servisinin ihraç anahtarı; status anahtarı ayrı (RB-AP-03) |
| Rol | "Provisional Identity Attestation Provider" — PID Provider değil ([[ADR-0011]] K1) |

---

# 3. İhraç öncesi kimlik ispatı

| Yol | Seviye | Not |
|---|---|---|
| Uzaktan: belge + canlılık + yüz eşleştirme | **T2** (ETSI TS 119 461 Substantial) | `verification_method: remote-document-liveness-face` |
| Uzaktan + NFC çip | T2; `document_chip_verified: true` | Teknik olarak yüksek; hukuken T3 = nitelikli e-imza (IDP7) |
| Yüz yüze | T2 | `in-person` |

Kurallar: kimlik doğrulama yalnızca kimlik servisinde yapılır; kurum issuer'ları, cüzdan ve doğrulayıcılar sağlayıcıyla
konuşmaz (IDP3). Doğrulama başlamadan **aydınlatma metni gösterilir ve açık rıza alınır** (IDP11). Sağlayıcı kararı her zaman
sağlayıcının karar uç noktasından teyit edilir; webhook yalnızca tetikleyicidir (IDP5). Sağlayıcı kesintisi seviyeyi düşürmez,
ihraç durur (IDP8).

---

# 4. Veri koruma

- Tamga bu veri için **veri sorumlusudur** ([[FW-TF-0001]] §3.5).
- İhraçtan sonra kişi alanları tutulmaz; kalıcı kayıt yalnızca opak `subject_ref`, belge numarası özeti, süre ve status
  indeksleridir. Belge görüntüsü, selfie, video ve OCR ham verisi Tamga'da hiç saklanmaz (IDP9).
- Silme talebi belgeyi iptal eder.
- Aynı belge numarası için ikinci etkin attestation verilmez; yeniden doğrulama eskisini iptal eder ([[ADR-0011]] K6).

---

# 5. Geçerlilik ve iptal

| Konu | Kural |
|---|---|
| Geçerlilik | `exp` = ihraç + 730 gün (≤ 2 yıl); süresi dolunca yeniden doğrulama |
| Status list | **Zorunlu** (Token Status List) |
| İptal nedenleri | kişinin silme talebi, aynı belgeyle yeniden doğrulama, belge kaybı/çalınma bildirimi, hatalı ihraç |
| Kopyalar | 10 kopya, her biri ayrı cihaz anahtarı; doğrulayıcı başına ayrı kopya (WL5) |

---

# 6. İki biçim: SD-JWT VC ve mdoc

Aynı belge SD-JWT VC (birincil) ve ISO/IEC 18013-5 mdoc olarak birlikte verilir ([[ADR-0013]]):

- Alanlar, `iat/exp` ve holder anahtarı iki biçimde birebir aynıdır (MD1, MD2).
- mdoc imzası ES256 ve aynı güven çapasıyla eşlenir (MD3); sonuç üç değerlidir (MD4).
- Doğrulayıcı biçimi DCQL ile seçer; ör. tarayıcıda yaş doğrulaması mdoc üzerinden yalnız `age_over_18` ister.

---

# 7. Sunum ve doğrulama kuralları

| Kullanım | İstenen alanlar | Kural |
|---|---|---|
| Yaş doğrulaması | `age_over_18` | Başka alan istenmez |
| Kurumda kayıt eşleştirme (belge ihracından önce) | `personal_administrative_number`, `birth_date`, `given_name`, `family_name` | Kurum issuer'ı yalnızca kayıtlı kapsamıyla ve tam doğrulama hattından geçirerek alır; eşleştirme anahtarlarını saklamaz ve loglamaz (RB-RP-ID-01, IDP10) |
| "Geçerli Tamga kimliği var mı" | hiçbiri | Referans politika `event-tamga-id` |
| Web sitesine kayıt / giriş ("Tamga ile giriş yap") | kayıtta `given_name`, `family_name`; girişte hiçbiri | Hesap anahtarı site başına takma addır ([[ADR-0031]]); `document_number_hash` ve kimlik numarası istenmez (RB-RP-13) |
| Yüksek riskli işlem | kapsamına göre | Yüz eşleştirme gerekiyorsa RP'nin sorumluluğu; belge portre taşımaz |

- Kimlik numarası isteyen doğrulayıcının kaydında bu alan açıkça bulunmalıdır; cüzdan kapsam dışı talebi uyarır (WL8).
- Sonuç üç değerlidir; `INDETERMINATE` kabul değildir.
- Doğrulayıcı güven listesinde issuer'ı `IDENTITY` kategorisinde ve bu tipe yetkili görmelidir.
- **Takma ad tohumu** ([[ADR-0031]]): kimlik belgesiyle birlikte ayrı, sunulamayan tür `urn:tamga:id:PseudonymSeed:1` verilir;
  tohum kişinin değişmeyen kimliğinden (Türkiye'de T.C. kimlik numarası; yoksa ülke + belge türü + belge no — belge yenilenince
  takma adlar değişir) ayrı bir anahtarla türetilir, saklanmaz. Cüzdan bundan site başına takma ad türetir (RB-AP-ID-07).

---

# 8. Devir — devlet PID sağlayıcısı

Devlet bir PID sağlayıcısı atadığında: kimlik servisi kaydı `successor_id` ile devredilir, yeni ihraç durur; verilmiş belgeler
süresi dolana kadar geçerli kalır ([[SPEC-TRUST-0001]]/TL8, RB-AP-ID-06). Doğrulayıcı politikaları devlet PID'ini tercih
edecek biçimde güncellenir; bu tip `DEPRECATED` olur ama doğrulanabilir kalır.

---

# 9. Demo ve pilot sapmaları

| # | Sapma | Kapanış |
|---|---|---|
| S-15 | Demo'da kimlik sağlayıcısı sahte (FAKE) modda çalışabilir | Pilotta gerçek sağlayıcı |
| S-9 | Demo cüzdanında anahtar yazılımda | Pilotta güvenli bölge |

---

# İlgili dokümanlar

[[FW-ARF-0001]] · [[FW-TF-0001]] · [[FW-RB-0001]] · [[SPEC-ID-0003]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] ·
[[SPEC-CRED-0003]] · [[SPEC-TRUST-0001]] · [[ADR-0011]] · [[ADR-0013]]

# CHANGELOG

- **0.2.0 (2026-10-01)** — Site başına takma ad ([[ADR-0031]]): web girişi kullanımı ve takma ad tohumu (§7).
- **0.1.1 (2026-09-27)** — Belgenin görünen adı "Tamga Kimlik Belgesi"; Tamga'nın rolü yine geçici sağlayıcıdır (§0).
- **0.1.0 (2026-09-27)** — İlk taslak: [[ADR-0011]], [[ADR-0013]], [[SPEC-ID-0003]] §8–9 ve RB-AP-ID kurallarının derlemesi. Onay bekliyor.

# Durum

**Draft** — 0.1.1, 2026-09-27. Onay bekliyor; onaylanınca Active olur.
