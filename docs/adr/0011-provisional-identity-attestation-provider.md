---
document_id: ADR-0011
title: "Geçici kimlik belgesi sağlayıcısı"
status: Active
version: 1.0.0
created: 2026-09-25
last_updated: 2026-10-09
summary: >
  Devlet tarafından atanmış bir PID Provider bulunmadığı sürece Tamga, uzaktan
  kimlik doğrulama (Didit: belge + canlılık + yüz eşleştirme; ileride NFC çip
  okuma) ile doğruladığı kişilere kendi imzaladığı bir kimlik attestation'ı
  (urn:tamga:id:IdentityAttestation:1) verir. Bu bir PID değil, Tamga'nın
  belge veren olarak verdiği bir EAA'dır; devlet PID'i gelince süpersede edilir.
  Kurumlar (üniversite) belge verirken bu attestation'ı sunum olarak alır ve
  kendi kayıtlarıyla eşler. Kimlik ispatı entegrasyonu üniversitede değil,
  Tamga'nın kimlik servisindedir; Tamga bu veri için KVKK veri sorumlusu olur.
  TL8 korunur (pid_providers[] boş), IDP3 yeniden ifade edilir.
domain: Identity
---

# ADR-0011 — Tamga Geçici Kimlik Attestation Sağlayıcısı

**Durum:** **Accepted (2026-09-25).** Açık noktalar kararı: (1) TCKN attestation'da taşınır, seçici açıklamalı; (2) geçerlilik 2 yıl;
(3) NFC ayrı tip değil, aynı tipte `document_chip_verified`; (4) KVKK aydınlatma + açık rıza kimlik servisinin `/authorize` sayfasında.
DECISIONS §0 **D-ID-6**; SPEC-PROTO-0001 v1.2.0, SPEC-ID-0003 v0.2.0, SPEC-TRUST-0001 v1.0.1, FW-TF-0001/FW-RB-0001 v0.1.1 aynı oturumda.
Uygulama: `apps/id` (operatör deposu), `@tamga-network/wallet-core` authcode/directory, `@tamga-network/issuer` authcode, cüzdan ekranları; testler 11/11 + sahne 2b gerçek HTTP.

# Bağlam

Türkiye'de ve TDT üyelerinde [[t:eIDAS]] anlamında atanmış bir **[[t:PID]] Provider** (devletin cüzdana kimlik verisi veren kurumu) yok.
Bugünkü tasarım (D-ID-2, SPEC-ID-0003/IDP3) [[t:identity-proofing]] işini **her kurumun kendi [[t:issuer|belge verme servisinde]]** yapıyor: öğrenci portala
girer, gerekirse Didit orada çalışır. Bu, kurum entegrasyonuna (OBS/portal) bağımlıdır ve kişi her kurumda yeniden
doğrulanır. Proje yönetiminin yönü (2026-09-25): kimlik doğrulamayı devlet bir sağlayıcı atayana kadar **Tamga** yapar;
kişi cüzdanındaki kimlik [[t:credential|belgesiyle]] kuruma gider, kurum kaydıyla eşler ve belgeyi verir. Öğrenci sistemi QR ve e-posta
yolları seçenek olarak kalır.

Bu, [[t:ARF]]'nin **PID sunumuyla [[t:EAA]] ihracı** desenidir (EAA Provider, PID'i doğrulayıp kendi kaydıyla eşler); tek fark
PID'i devlet değil geçici olarak Tamga verir.

# Karar

## K1 — Rol: "Provisional Identity Attestation Provider", PID Provider değil
- Tamga, `id.tamga.network` üzerinde bir **kimlik attestation servisi** işletir; [[t:trust-list|güven listesinde]] `issuers[]` altında
  (`category: IDENTITY`, `class: QUALIFIED` → **`class: EAA`, `assurance: I2`** [[ADR-0022]] ile, 2026-09-29; `assurance_basis: "provisional-operator; ETSI TS 119 461 Substantial (uzaktan)
  / High (NFC)"`, `operator.status: provisional`).
- `pid_providers[]` **boş kalır** (TL8 korunur): devlet PID'i gelince Tamga attestation'ı süpersede edilir (`successor` alanı),
  kurumların eşleştirme kodu değişmez (aynı claim seti).
- Belgenin adı hukuki metinlerde **"Tamga Kimlik Attestation'ı (geçici)"**dır; "PID" veya "kimlik kartı" denmez. Ürün adı
  (ör. "Tamga Wallet") pazarlama düzeyinde serbesttir.

## K2 — Belge tipi `urn:tamga:id:IdentityAttestation:1`
Claim seti EU PID Rulebook'undan (CIR 2024/2977) türetilir, azaltılmış:

| Claim | Zorunlu | Seçici açıklama | Not |
|---|---|---|---|
| `given_name`, `family_name` | ✓ | ✓ | belgeden (MRZ/OCR; NFC varsa çip) |
| `birthdate` | ✓ | ✓ | (2026-10-09, [[ADR-0045]]: eski adı `birth_date`; mdoc'ta `birth_date`) |
| `nationalities` | ✓ | ✓ | ISO 3166-1 alpha-2 dizisi (2026-10-09, [[ADR-0045]]: eskiden tek değerli `nationality`) |
| `personal_administrative_number` | ✓ | ✓ | **TCKN** (TR) / ulusal kimlik no — kurum eşleştirmesi için; yalnızca kayıtlı kapsamı olan RP'lere açıklanır |
| `document_type`, `document_number` (hash) | ✓ | ✓ | belge numarası yalnızca SHA-256 |
| `issuing_country` | ✓ | ✓ | |
| `document_chip_verified` | ✓ | ✓ | NFC ile doğrulandıysa `true` (olgu; LoA değil — PR7 korunur) |
| `age_over_18` | ○ | ✓ | türetilmiş |
| `iat`, `exp` (≤ 2 yıl), `status` | ✓ | — | iptal: Token Status List |

Fotoğraf/portre **konmaz** (v1). [[t:holder|Belge sahibinin]] güvence seviyesi claim olarak yoktur; tipin ön koşulu **T2** (uzaktan) veya
**T3-benzeri** (NFC + canlılık; hukuken T3 = NES/Mobil İmza, PM-ASSUR). `document_chip_verified` bunu olgu olarak taşır.

## K3 — Kimlik ispatı akışı (cüzdan-başlatmalı)
1. Cüzdan → `id.tamga.network` ([[t:OpenID4VCI]] **authorization code**; SPEC-PROTO-0001 v1.2): yetkilendirme sayfası Didit
   oturumunu (belge + pasif canlılık + yüz eşleştirme; NFC opsiyonel) açar.
2. Didit kararı (polling `GET /v3/session/{id}/decision/` birincil; webhook `https://id.tamga.network/idv/webhook`
   ikincil, `status.updated`) → **Approved** ise attestation ihraç edilir (10 kopya, [[t:WUA]] zorunlu, PR11).
3. Kurumdan belge alma: cüzdan kurumu güven listesi dizininden seçer → kurumun belge veren servisi authorization code akışında
   **IdentityAttestation sunumu** ister ([[t:OpenID4VP]], [[t:DCQL]]: `personal_administrative_number`, `given_name`, `family_name`,
   `birthdate`) → kayıtla eşler → belgeyi ihraç eder. Eşleşmezse belge verilmez; kişisel veri loglanmaz (AP3/AP4).
4. Pre-authorized yollar (OBS ekranı QR, e-posta + SMS tx_code) **aynen kalır**; kurum ikisini de sunabilir.

## K4 — Veri sorumluluğu ve saklama (KVKK)
- Tamga, kimlik ispatı verisi için **veri sorumlusudur**; aydınlatma + açık rıza metni cüzdanda Didit'e geçmeden gösterilir.
- Tamga'da saklanan: attestation kaydı (opak `subject_ref`, `iat/exp`, status `idx`, belge no hash'i, `document_chip_verified`,
  Didit `session_id`); **belge görüntüleri, selfie, MRZ ham verisi Tamga'da saklanmaz** (Didit tarafında Didit saklama
  politikası; sözleşmede ≤ 30 gün istenir). Silme talebi: attestation [[t:revocation]] + kayıt silme.
- FW-TF-0001 §6'ya "Kimlik Attestation Sağlayıcısı" rolü ve sorumlulukları eklenir; üç aylık şeffaflık raporuna ihraç/iptal
  sayıları girer (kişi yok).
- Bugüne kadarki "Tamga hiçbir kişisel veri görmez" ifadesi daraltılır: **Tamga kimlik ispatı verisini görür; eğitim/sektör
  belge içeriğini görmez** (belge verenler kurumlarındır, G1).

## K5 — Etkilenen kurallar (yeniden ifade)
| Kural | Önce | Sonra |
|---|---|---|
| SPEC-ID-0003/**IDP3** | IDV entegrasyonu yalnızca belge veren tarafında | IDV entegrasyonu yalnızca **Tamga kimlik attestation servisinde**; kurum belge verenleri, cüzdan ve doğrulayıcı IDV sağlayıcısıyla konuşmaz |
| SPEC-TRUST-0001/**TL8** | Tamga PID vermez; `pid_providers[]` boş | Aynen; ek: Tamga kimlik attestation'ı `issuers[]` kaydıdır ve devlet PID'i gelince süpersede edilir |
| SPEC-SCHEMA-0002 E-serisi ("kimlik numarası yok") | eğitim şemaları için | Değişmez; kimlik numarası **yalnızca** `IdentityAttestation` tipinde ve seçici açıklama ile |
| SPEC-PROTO-0001 | yalnızca pre-authorized | + authorization code (v1.2); PR-yeni: kurumdan belge alırken kimlik eşleşmesi IdentityAttestation sunumuyla |
| PM-ASSUR-0001 bağlama tablosu | uzaktan doğrulama = kurumda | uzaktan doğrulama = Tamga attestation'ı; kurum "attestation sunumu + kayıt eşleşmesi" yolunu T2 sayar |

## K6 — Güvenlik sınırları
- Attestation ihracında WUA zorunlu; demo'da `software` kabul (S-9/S-14), pilotta `secure_enclave`.
- Aynı belge numarası hash'i ile aktif ikinci attestation verilmez (çift kayıt); yeniden belge verme eskisini iptal eder.
- Kurum eşleşmesi: en az `personal_administrative_number` + `birthdate`; ad eşleşmesi normalize (Türkçe karakter).
- Didit "In Review" → attestation verilmez, kullanıcıya bekleme; "Declined" → 24 saat sonra yeniden deneme; 3 ret → manuel.

# Gerekçe
Kişi bir kez doğrulanır, her kuruma aynı attestation'la gider; kurumun OBS'siz çalışması mümkün olur; ARF deseni (PID
sunumuyla EAA ihracı) birebir uygulanır, devlet PID'i gelince yalnızca imzacı değişir. Bedeli: Tamga'nın veri sorumlusu
olması ve kimlik numarası taşıyan bir tipin varlığı; ikisi de K4/K2'de sınırlandırılmıştır.

# Değerlendirilen Alternatifler
- **A — Kimlik ispatı her kurumun belge veren servisinde (IDP3 eski hâli):** Tamga veri görmez, ama kurum entegrasyonu şart ve kişi
  her kurumda yeniden KYC olur (500/ay kotası kurum sayısıyla çarpılır). **Reddedildi (2026-09-25).**
- **C — Devlet PID'ini bekle:** tarih yok. Geçiş yolu K1'de korunur.
- **B' — Attestation'da TCKN olmadan (ad + doğum tarihi):** eşleşme belirsiz (adaş), kurum reddi artar. Reddedildi;
  TCKN seçici açıklamalı ve yalnızca yetkili kapsama.

# Sonuçlar
- Yeni servis `apps/id` (operatör deposu) (`id.tamga.network`): Didit oturumu, karar, webhook, OpenID4VCI ile [[t:issuance]]
  (authorization code), attestation kaydı, [[t:status-list]]. Didit webhook hedefi **tek**: `https://id.tamga.network/idv/webhook`
  (kurum başına değil).
- Cüzdan: "Kimliğimi doğrula" akışı (in-app browser), kurum dizini (güven listesinden), kurumdan belge alırken attestation
  sunumu (ihraç içinde OpenID4VP).
- Kurumun belge veren servisi: authorization code + IdentityAttestation isteği + kayıt eşleşmesi; portal öğrenci girişi **kalkar**
  (demo'da staff paneli kalır).
- Spec/FW güncellemeleri K5; DB-21 bu ADR'nin parçası olur; DB-22 kapanır.
- Demo: Didit **sandbox** (gerçek kimlik yok, GT1); sunum sahnesi 3 "portal girişi" → "cüzdanda kimliğimi doğrula + Bilgi'yi seç".

# Açık Noktalar — kabulle birlikte KARARA BAĞLANDI (2026-09-25)
1. `personal_administrative_number` (TCKN) attestation'da taşınsın mı? (Öneri: evet, seçici açıklamalı; K2.)
2. Attestation geçerlilik süresi: 1 yıl mı 2 yıl mı? (Öneri: 2 yıl; belge süresi dolunca daha erken.)
3. NFC eklendiğinde ayrı tip (`…:IdentityAttestation:1` + `document_chip_verified`) değil, aynı tip — onay.
4. Demo'da sandbox profili "Ayşe Yılmaz" için TCKN sahte üretilecek; `students.json` buna göre güncellenir.
