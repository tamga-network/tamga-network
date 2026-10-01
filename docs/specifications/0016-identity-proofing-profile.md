---
document_id: SPEC-ID-0003
title: Kimlik İspatı Profili — T1–T3 Yolları, ETSI TS 119 461 Eşlemesi ve Uzaktan Doğrulama Sağlayıcı Entegrasyonu
category: Specification
domain: Identity
status: Active
review_status: Completed
version: 1.1.1
created: 2026-09-24
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: specification
audience:
  - engineers
  - architects
  - operators
  - ai-agents
stability: Evolutionary
maturity: Draft
tags:
  - identity-proofing
  - assurance
  - kyc
  - etsi-119-461
  - didit
  - issuer
keywords:
  - identity proofing profile
  - binding path to assurance level
  - remote identity verification provider integration
  - Didit session webhook decision
  - data minimisation proofing result record
  - ETSI TS 119 461 baseline substantial high
related:
  - PM-ASSUR-0001
  - PM-ID-0001
  - SPEC-PROTO-0001
  - SPEC-WALLET-0001
  - SPEC-CRED-0001
  - FW-RB-0001
  - FW-RB-0002
  - ADR-0005
depends_on:
  - PM-ASSUR-0001
  - SPEC-PROTO-0001
summary: >
  Issuer'ın ihraç öncesi uyguladığı kimlik ispatı (identity proofing) yollarını
  tanımlar: her yolun ürettiği holder seviyesi (T1–T3), ETSI TS 119 461 ile eşlemesi,
  hangi belge tipinin hangi seviyeyi gerektirdiği, sonucun nerede tutulacağı (issuer
  denetim kaydı; credential'da asla) ve uzaktan kimlik doğrulama sağlayıcısı (referans:
  Didit, v3 API) entegrasyonunun protokol düzeyi kuralları: oturum oluşturma, sonuç
  alma, webhook doğrulama, veri minimizasyonu, hata ve zaman aşımı davranışı.
  D-ID-2'nin uygulamasıdır. Seviye tablosu ve ETSI 119 461 eşlemesi D-ASSUR-2 ile
  karara bağlandı (2026-09-26).
priority: High
---
> **Sürüm notu 1.1.1 (2026-10-01) — mağaza inceleme kodu ([[ADR-0033]]):** yeni §9.2: tek kullanımlık inceleme kodu `/authorize` aydınlatma sayfasında; geçerli kodla yalnız o PAR için deneme doğrulaması (`/review-idv`) ve ayrı DEMO imzacısı (`tamga-id-review`, I1; `verification_method: review-demo`, 7 gün). Kodsuz akış değişmedi (RV3).

> **Sürüm notu 1.1.0 (2026-10-01) — kişinin silme isteği:** yeni §9.1 `POST /erasure`: belge sunumuyla kanıt; kayıt + olay satırları silinir, kopyalar iptal, sağlayıcıdaki oturum ve görüntüler silinir (Didit v3 `DELETE /v3/session/{id}/delete/`, `privacy_erasure`). §9 "Veri sorumlusu" satırı buna göre. KVKK aydınlatma metni gerçeğe uyduruldu (veri işleyen + yurt dışına aktarım).
>
> **Sürüm notu 1.0.2 (2026-09-30) — düzeltme:** Didit `callback` adresi ve kanal satırı koda uyduruldu: dönüş kimlik servisine (`id.tamga.network/idv/return`); kaldırılan portal adresi silindi. Kural değişmedi.

> **Sürüm notu 1.0.1 (2026-09-28) — belge numarası özeti anahtarlı:** `document_number_hash` = `"sha256-" + base64(HMAC-SHA256(K, ülke:tür:numara))`; `K` yalnızca kimlik servisinde (`TAMGA_ID_DOC_HASH_KEY`). Anahtarsız SHA-256'da belge numaralarının sınırlı olasılık uzayı denenerek numara geri bulunabiliyordu. Biçim (`sha256-` öneki) ve şema değişmedi. Siteler arası bağlanabilirlik (aynı değer her siteye) ayrı konu: site başına takma ad yol haritasında (ARF Topic 11 pseudonym yaklaşımı).

> **Sürüm notu 1.0.0 (2026-09-26) — Active:** DB-6 (rev.) ve DB-18 kabul edildi → **D-ASSUR-2**. Seviye tablosu ve ETSI TS 119 461 sütunu kesinleşti; "onay bekliyor" etiketleri kalktı. Sayısal parametreler (sonuç yeniden kullanım süresi, deneme sınırları) hâlâ ÖNERİ olarak işaretli ve ayrıca ayarlanabilir.

> **Sürüm notu 0.2.0 (2026-09-25) — [[ADR-0011]] (Tamga geçici kimlik attestation sağlayıcısı):** **IDP3 yeniden ifade** (IDV entegrasyonu Tamga kimlik servisinde), yeni **§9** (kimlik attestation servisi: tip, claim'ler, akış, kurumda kullanım, veri sorumlusu), **IDP9–IDP11**. §1–§7 kural olarak değişmedi; §2–§4'teki "portal/issuer'da Didit" ifadeleri §9 ile okunur (kod `apps/id`'de). Statü Draft (DB-6 rev./DB-18 onayı).


# Kapsam

Bu spesifikasyon **issuer tarafındaki** kimlik ispatını kapsar: "bu offer'ı alan kişi gerçekten
belgenin öznesi mi?" sorusunun ihraç öncesinde nasıl cevaplandığı. Kapsam dışı: cüzdana bağlama
(`cnf`/KB-JWT — [[SPEC-CRED-0002]]), verifier tarafında yüz eşleştirme (RP sorumluluğu), PID
ihracı (Tamga PID vermez, BT8).

İlke ([[PM-ASSUR-0001]]; eIDAS modeli): **holder seviyesi credential'a yazılmaz**; belge tipi
bir asgari seviyeyi ön koşul olarak taşır; issuer, seviyeyi ihraçtan önce sağlar ve bağlama
yolunu **denetim kaydına** yazar ([[SPEC-PROTO-0001]]/PR7).

---

# 1. Seviyeler ve yollar

| Seviye | eIDAS LoA | ETSI TS 119 461 (D-ASSUR-2) | Yol | Nerede |
|---|---|---|---|---|
| **T0** | — | — | Cihaz anahtarı + e-posta/telefon OTP; kimlik iddiası yok | Anonim/pseudonym senaryoları (beta'da kullanılmaz) |
| **T1** | Low | Baseline | (a) e-posta offer + **farklı kanaldan** SMS `tx_code`; (b) OBS ekranında offer (tek faktör); (c) banka mikro-transfer / GSM hat sahipliği | Issuer/portal |
| **T2** | Substantial | Substantial (belge + canlılık **veya** yüz yüze) | (a) **Lisanslı uzaktan kimlik doğrulama** (kimlik belgesi OCR/NFC + canlılık + yüz eşleştirme) — bu belgede "IDV sağlayıcı"; (b) OBS + MFA ekranında offer; (c) kurum **kayıt masası** (yüz yüze, personel onayı) | IDV sağlayıcı / portal / masa |
| **T3** | High | High | NES / Mobil İmza ile nonce imzalama (Faz 0+); Faz 1'de PID | Yalnızca authorization code veya yüz yüze; **pre-authorized ile yasak** (ETSI TS 119 472-3 GEN-REQ-4.1) |

**Tip ↔ asgari seviye** attestation rulebook'larda: eğitim — öğrenci belgesi T1, diploma T2
([[FW-RB-0002]] §4). Issuer, tipin seviyesini sağlayamıyorsa offer **üretmez** (ihraç durur; tahmin/yükseltme yok).

---

# 2. Akış — kimlik ispatı ihraç zincirinde nerede

```
Portal/OBS oturumu (kişi)                        Issuer servisi
   │  "Diplomamı cüzdanıma al"                       │
   ├── tip = Diploma → gerekli seviye T2 ────────────▶│ mevcut seviye? (oturum tipi, önceki proofing kaydı ≤ 12 ay)
   │                                                  │
   │  ◀── yetersizse: IDV oturumu başlat (T2a)  ──────┤  POST /v3/session  → url
   │  IDV sağlayıcı sayfası: belge + selfie           │
   │  ──▶ tamamlandı (callback / webhook) ───────────▶│ decision → T seviyesi + kayıt
   │  ◀── offer (QR + tx_code)  ──────────────────────┤ PR7: audit {path:"idv:<provider>", level:"T2", session_ref}
   ▼                                                  ▼
Cüzdan OpenID4VCI (SPEC-PROTO-0001) — değişmez
```

Kimlik ispatı **offer üretiminden önce** biter; offer'ın kendisi ve `tx_code` kuralları değişmez
(PR1, PR3, DB-5). Sonuç 12 ay (ÖNERİ) boyunca aynı kişi için yeniden kullanılabilir; assurance decay
kuralları geçerlidir ([[PM-ASSUR-0001]] §Decay).

---

# 3. IDV sağlayıcı entegrasyonu — genel kurallar (sağlayıcıdan bağımsız)

| # | Kural |
|---|---|
| IP1 | Sağlayıcı sonucu **yalnızca** issuer tarafında değerlendirilir; cüzdan ve verifier sağlayıcıyla konuşmaz. |
| IP2 | Issuer, sağlayıcı oturumunu **kendi öznesine** bağlar: `vendor_data` = issuer-içi opak referans (öğrenci kaydının rastgele token'ı); **kimlik numarası, ad, e-posta `vendor_data`'ya yazılmaz**. |
| IP3 | Beklenen kimlik (ad, soyad, doğum tarihi) sağlayıcıya **expected_details** olarak verilebilir; sağlayıcı eşleştirme yapar; issuer sonucu ayrıca kaynak veriyle karşılaştırır (ad-soyad + doğum tarihi tam eşleşme; fark → İnceleme). |
| IP4 | Issuer sisteminde saklanan şey **sonuç özetidir**: `{provider, session_ref, level, decided_at, checks:[id_document, liveness, face_match], expires_at}`. Belge görüntüsü, portre, OCR ham verisi, video **saklanmaz** ([[FW-RB-0001]] RB-AP-23). |
| IP5 | Sağlayıcı tarafındaki saklama süresi sözleşmeyle asgariye çekilir; KVKK aydınlatma metni sağlayıcıyı **veri işleyen** olarak adlandırır. |
| IP6 | Webhook **MUST** imza + zaman damgası ile doğrulanmak; imzasız/eski (> 300 s) webhook reddedilir; `event_id` ile tekilleştirme. |
| IP7 | Webhook yalnızca **tetikleyicidir**; karar her zaman sağlayıcının **decision API**'sinden çekilerek teyit edilir (webhook gövdesine güvenilmez). |
| IP8 | "In Review" / "Declined" / "Expired" → offer üretilmez; kişiye sağlayıcı sonucu değil, "kurum kayıt masasına başvurun" yolu gösterilir. Ret gerekçesi kişiye sağlayıcı dilinde aktarılmaz. |
| IP9 | Sağlayıcı kesintisinde diploma ihracı **durur** (T1'e düşürülmez); öğrenci belgesi (T1) etkilenmez. |
| IP10 | Sağlayıcı ve iş akışı kimliği (`workflow_id`) kiracı yapılandırmasındadır; kod sağlayıcıya özel değil, **adaptör** arayüzü üzerinden çalışır (`IdvProvider` — §6). |
| IP11 | Log: olay türü + `session_ref` + seviye; kişi adı, belge numarası, skor **yazılmaz** (AP3 ruhu). |

---

# 4. Referans sağlayıcı: Didit (v3 API) — protokol eşlemesi

Kaynak: docs.didit.me (2026-09-24 tarihinde doğrulandı). Değişebilir; adaptör sürümlenir.

| Adım | Didit | Tamga kullanımı |
|---|---|---|
| Kimlik doğrulama | `x-api-key: <API_KEY>` (Business Console → Application → API & Webhooks) | Kiracı gizli değeri (`TAMGA_IDV_DIDIT_API_KEY`); `.env`, asla depoda |
| Oturum oluştur | `POST https://verification.didit.me/v3/session/` gövde: `workflow_id` (zorunlu), `vendor_data`, `callback`, `callback_method`, `metadata`, `language`, `contact_details`, `expected_details {first_name,last_name,date_of_birth,id_country,expected_document_types}` | `vendor_data = <opak subject_ref>`; `callback = https://id.tamga.network/idv/return?r=<akış>`; `language = tr`; `expected_details` ad/soyad/doğum tarihi (IP3); `metadata` **boş** |
| Yanıt | `session_id`, `session_token`, `url`, `status: "Not Started"`, `workflow_version` | `url`'e yönlendir; `session_id` = `session_ref` |
| Sonuç | `GET https://verification.didit.me/v3/session/{sessionId}/decision/` → `status`, `features[]`, `id_verifications[] {status, first_name, last_name, date_of_birth, document_type, issuing_state, expiration_date, verification_method, assurance, …}`, `liveness_checks[] {status, score}`, `face_matches[] {status, score}`, `nfc_verifications[]`, `aml_screenings[]` | Yalnızca `status` ve alt kontrol `status`'ları + ad/soyad/doğum tarihi **eşleşme sonucu** (boolean) tutulur; görüntü alanları (`portrait_image`, `front_image`, `back_image`, `video_url`) **okunur ama saklanmaz** |
| Webhook | `POST` gövde: `event_id`, `webhook_type` (`status.updated` …), `session_id`, `status`, `vendor_data`, `decision`, `timestamp`, `created_at`, `environment`; başlıklar `X-Signature-V2` (HMAC-SHA256, kanonik JSON), `X-Signature` (ham gövde), `X-Timestamp` | `X-Signature` (ham gövde) + `X-Timestamp` (±300 s) doğrulanır; `event_id` tekilleştirme; sonra decision API teyidi (IP7). Yeniden deneme: ~1 dk, ~4 dk; 5 s zaman aşımı → uç nokta hızlı 200 döner, işlem kuyruğa |
| Durumlar | `Not Started`, `In Progress`, `Awaiting User`, `In Review`, `Approved`, `Declined`, `Resubmitted`, `Expired`, `Kyc Expired`, `Abandoned` | §5 eşlemesi |
| İş akışı | Business Console'da no-code workflow: ID + liveness + face match (+ NFC opsiyonel) | Tamga workflow'u: **ID document + passive liveness + face match**; AML **kapalı** (amaç sınırlaması); phone/email **kapalı** (T1 zaten SMS ile) |
| Kanal | Hosted URL (yönlendirme), iframe, mobil SDK (iOS/Android/RN) | Faz B: **hosted URL** (kimlik servisi `id.tamga.network` üzerinden, masaüstü/mobil tarayıcı). Cüzdan içi SDK **kullanılmaz** (kimlik ispatı issuer'ın işidir, cüzdanın değil) |
| Sandbox | `sandbox_scenario` alanı; `environment: "sandbox"` | Demo: sandbox senaryolarıyla; e2e testte sahte adaptör |
| Ücret | 500 doğrulama/ay ücretsiz; sonrası kullanım başına | Pilot ölçeği ücretsiz kotada |

---

# 5. Sonuç → seviye eşlemesi

| Didit `status` | Alt kontroller | Ad/soyad/doğum tarihi eşleşmesi | Tamga sonucu |
|---|---|---|---|
| `Approved` | `id_verifications[].status = Approved` ∧ `liveness_checks[].status = Approved` ∧ `face_matches[].status = Approved` | Tam eşleşme | **T2** (`path: "idv:didit"`) |
| `Approved` | NFC `Approved` (çipli belge) | Tam | **T2** (not: `nfc: true`; T3 **değil** — T3 için imza gerekir) |
| `Approved` | herhangi biri `Approved` değil | — | **Yetersiz** → masa |
| `Approved` | hepsi Approved | Eşleşmiyor | **İnceleme** (personel kararı; otomatik T2 yok) |
| `In Review` | — | — | Bekle (≤ 24 s); sonra personel |
| `Declined`, `Expired`, `Kyc Expired`, `Abandoned` | — | — | Yetersiz; yeni oturum ≤ 3 deneme / 24 s |
| `Not Started`, `In Progress`, `Awaiting User`, `Resubmitted` | — | — | Devam ediyor |

Belge türü kısıtı: `expected_document_types = ["ID", "P"]` (TC kimlik kartı, pasaport);
`issuing_state` kurum ülkesiyle veya öğrencinin uyruğuyla uyumlu olmalı (uyruk kaynak veride yoksa
kısıt uygulanmaz).

---

# 6. Adaptör arayüzü (uygulama sözleşmesi)

```ts
interface IdvProvider {
  readonly id: "didit" | string;
  createSession(input: {
    subjectRef: string;                 // opak, kişi verisi değil
    expected: { givenName: string; familyName: string; birthDate: string };
    locale: "tr" | "en";
    returnUrl: string;
  }): Promise<{ sessionRef: string; url: string; expiresAt: number }>;
  fetchDecision(sessionRef: string): Promise<IdvDecision>;
  verifyWebhook(rawBody: Uint8Array, headers: Record<string, string>): { ok: boolean; eventId?: string; sessionRef?: string };
}
type IdvDecision =
  | { state: "PENDING" }
  | { state: "REVIEW" }
  | { state: "FAILED"; reason: "declined" | "expired" | "abandoned" | "mismatch" | "incomplete" }
  | { state: "PASSED"; level: "T2"; checks: { idDocument: true; liveness: true; faceMatch: true; nfc?: boolean }; decidedAt: number; expiresAt: number };
```

Saklanan kayıt (issuer `data/<slug>/state.json › proofing[subjectRef]`):
`{ provider, sessionRef, level, checks, decidedAt, expiresAt }` — başka alan yok.

---

# 7. Hata ve sınır davranışı

| Durum | Davranış |
|---|---|
| Sağlayıcı 5xx / zaman aşımı | Diploma offer üretilmez; kişiye "şu an kimlik doğrulama yapılamıyor" + masa seçeneği |
| Webhook imzası geçersiz | 400; olay kütüğü; işlem yok |
| Webhook gelmedi | Portal `return` sayfası decision API'yi sorgular (polling ≤ 10 dk, 15 s aralık) |
| Kişi 3 kez başarısız | 24 saat kilit; masa yolu |
| Sonuç 12 ayı geçti | Yeniden ispat (decay) |
| Kayıt masası yolu | Personel paneli: "kimliği gördüm" onayı → `path: "desk"`, `level: T2`, personel kimliği denetim kaydında |

---

# 8. Değişmezler

| # | Değişmez |
|---|---|
| **IDP1** | Holder kimlik ispatı seviyesi ve yolu credential'a yazılmaz; yalnızca issuer denetim kaydında tutulur. |
| **IDP2** | Tipin asgari seviyesi sağlanmadan offer üretilmez; seviye tahminle yükseltilmez. |
| **IDP3** | IDV sağlayıcı entegrasyonu yalnızca **Tamga kimlik attestation servisindedir** (`id.tamga.network`, [[ADR-0011]]); kurum issuer'ları, cüzdan ve verifier sağlayıcıyla konuşmaz. *(v0.1: "yalnızca issuer tarafında" — D-ID-6 ile yeniden ifade edildi.)* |
| **IDP4** | Issuer, IDV sonucundan yalnızca özet kaydı saklar; belge görüntüsü, portre, video, OCR ham verisi saklanmaz. |
| **IDP5** | Webhook imza ve zaman damgası doğrulanmadan işlenmez; karar her zaman decision API'den teyit edilir. |
| **IDP6** | `vendor_data`/`metadata` alanlarına kişisel veri yazılmaz; yalnızca opak referans. |
| **IDP7** | T3 hiçbir uzaktan IDV sonucuyla verilmez; T3 imza (NES/mobil imza) veya PID gerektirir ve pre-authorized akışla bağdaşmaz. |
| **IDP8** | Sağlayıcı kesintisi seviyeyi düşürmez; gerektiren ihraç durur. |
| **IDP9** | Kimlik servisi IDV sonucundan kişi alanlarını yalnızca ihraç anına kadar tutar; ihraçtan sonra yalnızca opak `subject_ref`, belge numarası hash'i, süre ve status indeksleri kalır; görüntü, selfie, video, OCR ham verisi Tamga'da hiç saklanmaz (K4). |
| **IDP10** | Ulusal kimlik numarası (`personal_administrative_number`) yalnızca `urn:tamga:id:IdentityAttestation:1` tipinde ve seçici açıklamalı taşınır; başka hiçbir tipe yazılmaz; kurum eşleştirmeden sonra saklamaz ve loglamaz. |
| **IDP11** | Kimlik attestation'ı ihraç edilmeden önce aydınlatma metni gösterilir ve açık rıza alınır; rıza verilmeyen oturumda IDV başlatılmaz (`access_denied`). |

---

# 9. Tamga kimlik attestation servisi (ADR-0011, D-ID-6)

Devlet PID sağlayıcısı atanana kadar uzaktan kimlik doğrulama **Tamga'nın kimlik servisinde** yapılır ve sonucu bir
credential olarak cüzdana verilir. Bu belge PID değil, Tamga'nın issuer olarak (`category: IDENTITY`, `class: EAA`,
I2; belgede `category` claim'i yok — [[ADR-0022]]) verdiği nitelikli olmayan bir EAA'dır; `pid_providers[]` boş kalır (TL8).

| Öğe | Değer |
|---|---|
| `vct` | `urn:tamga:id:IdentityAttestation:1` (katalog: `id/IdentityAttestation/1.0.0`) |
| Claim'ler | `given_name`, `family_name`, `birth_date`, `nationality`, `personal_administrative_number` (TCKN), `document_type`, `document_number_hash` (anahtarlı SHA-256 / HMAC; 1.0.1), `issuing_country`, `document_chip_verified`, `verification_method` (`remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person`), `age_over_18` — tümü seçici açıklamalı; portre yok; LoA claim'i yok (PR7) |
| Süre / status | `exp` = ihraç + 730 gün; Token Status List (`id.tamga.network/status/{listId}`); aynı belge yeniden doğrulanınca eskisi iptal (K6) |
| Akış | Cüzdan: PAR (WUA) → tarayıcı `/authorize` (**KVKK aydınlatma + açık rıza**) → sağlayıcı (Didit v3; demo: FAKE, sapma S-15) → `/idv/return` karar sorgulama (webhook yalnızca tetik, IDP5) → `code` → token (PKCE + WUA) → 10 kopya |
| Kurumda kullanım | Kurum issuer'ı belge ihracında attestation **sunumunu** ister (DCQL: TCKN, doğum tarihi, ad, soyad), T0 + A–E doğrular, kayıtla eşler (TCKN + doğum tarihi; ad normalize uyarı) — [[SPEC-PROTO-0001]] §11.2 |
| Seviye | Uzaktan belge + canlılık + yüz = **T2** (ETSI 119 461 Substantial); NFC çip = `document_chip_verified: true` (High teknik; hukuken T3 = NES/Mobil İmza, IDP7) |
| Veri sorumlusu | Tamga Network (K4): saklama kayıt + hash; silme talebi = §9.1 (kayıt silinir, kopyalar iptal, sağlayıcıda görüntüler silinir); sağlayıcı sözleşmesinde ≤ 30 gün görüntü saklama |
| Webhook | Tek hedef `https://id.tamga.network/idv/webhook`, olay `status.updated`; kurum başına webhook yoktur |

Uygulama: `tamga-platform/apps/id` (config/didit/store/app), `IdvProvider` arayüzü §6 ile aynı (`DiditProvider`, `FakeIdvProvider`).

## 9.1 Kişinin silme isteği — `POST /erasure` (2026-10-01)

Kişi hesabı yoktur; istek servisin verdiği belgelerin sunumuyla kanıtlanır.

| Öğe | Değer |
|---|---|
| İstek | `{ "presentations": [ SD-JWT VC + KB-JWT, … ] }` (1–20); hiçbir alan açılmaz; KB-JWT `aud` = servis adresi, `nonce` = `POST /nonce` (tek kullanımlık) |
| Doğrulama | imza bu servisin (`issuerId`), sahiplik KB-JWT `cnf` anahtarıyla; kayıt iptal listesi indeksinden bulunur |
| Etki | kaydın bütün kopyaları INVALID; kayıt ve ona bağlı olay günlüğü satırları silinir; sağlayıcı oturumu `privacy_erasure` ile silinir (`IdvProvider.deleteSession`) |
| Yanıt | `{ erased, rejected, provider: "deleted" | "partial" }`; tutulan bir şey yoksa 404 |
| Günlük | yalnız sayılar (`erasure`: kayıt sayısı, sağlayıcı sonucu); kayıt kimliği ve `subject_ref` yazılmaz |

İptal listesinde yalnız bitler kalır (kişi verisi değil). Takma ad tohumu servis tarafında saklanmadığı için silinecek bir şey
yoktur (PS2); kişi kimliğini yeniden doğrularsa aynı tohum yeniden türer ([[ADR-0031]]).

## 9.2 Mağaza incelemesi — tek kullanımlık inceleme kodu (2026-10-01, [[ADR-0033]])

| Öğe | Değer |
|---|---|
| Kod | Operatör üretir (`ops/review-code.ts create`); 26 karakter (130 bit), en çok 14 gün, tek kullanımlık, aynı anda en çok 3 etkin; veritabanında yalnız HMAC özeti (`review_codes`; RV1) |
| Giriş | `/authorize` aydınlatma sayfasında "İnceleme kodu" alanı (`POST /authorize/consent`, `review_code`); boşsa akış değişmez |
| Etki | Geçerli kodla yalnız o PAR için deneme doğrulaması (`/review-idv/{oturum}`, gerçek sağlayıcıya istek yok); kişi koda özgü DEMO kişi (ad "DEMO", soyad "App Reviewer") |
| İmza | Ayrı DEMO imzacısı `tamga-id-review` (güven listesinde I1); gerçek imzacı kullanılmaz (RV2). İptal listesi kimlik servisinin listesi |
| Belge | `verification_method: review-demo`, en çok 7 gün; takma ad tohumu ayrı anahtardan (gerçek tohumlarla çakışmaz) |
| Kabul | I2 isteyen hiçbir politikada geçmez; yalnız Tamga Verify `review-*` politikaları (I1) |
| Sınır | PAR başına 5 hatalı deneme; servis geneli 10 dakikada 20 hatada 15 dakika kilit (IP kullanılmaz); nginx `/authorize/consent` hız sınırı |
| Kapalı | DEMO anahtarı yoksa ya da güven listesi `tamga-id-review`'ı tanımıyorsa kod girilse de "etkin değil" (503) |
| Günlük | `review_code.accepted` / `.used` (kod kimliği), `.rejected` (ayrıntısız); kod ve özeti asla |

# Güvenlik ve Mahremiyet Notları

- Kimlik ispatı **amaç sınırlıdır**: yalnızca ihraç ön koşulu; AML/PEP taraması kapalı.
- Sağlayıcı, kişinin belgesini ve yüzünü görür; bu, KVKK aydınlatma metninde açıkça yazılır ve
  sağlayıcı seçimi (veri lokasyonu, saklama süresi, alt işleyenler) sözleşmeyle bağlanır.
- `expected_details` sağlayıcıya ad/soyad/doğum tarihi verir (kaynak veriden); bu, eşleşme
  kalitesini artırır ama veri paylaşımıdır; alternatif (sağlayıcıdan gelen ad ile issuer'da
  eşleştirme) IP3'te tanımlıdır ve kiracı tercihine bırakılır (ÖNERİ: varsayılan paylaşma).
- Demo'da sandbox; gerçek kişi verisi işlenmez (GT1).

# Açık Konular

1. ~~DB-6 (rev.) / DB-18 onayı~~ ✅ **KAPANDI (2026-09-26):** D-ASSUR-2; seviye tablosu ve ETSI 119 461 sütunu kesinleşti.
2. Sonuç yeniden kullanım süresi (12 ay) ve deneme sınırları — sayılar ÖNERİ.
3. Cüzdan içi IDV (SDK) hiçbir zaman mı? Faz 1'de PID ile gereksizleşir; şimdilik hayır.
4. Sağlayıcı çeşitliliği: ikinci adaptör (yerli sağlayıcı / e-Devlet) — tedarikçi kilidi tripwire'ı.

# İlgili Dokümanlar

[[PM-ASSUR-0001]] · [[PM-ID-0001]] · [[SPEC-PROTO-0001]] · [[SPEC-CRED-0002]] · [[SPEC-WALLET-0001]] ·
[[FW-RB-0001]] · [[FW-RB-0002]] · [[ADR-0005]] · `docs/delivery/03-ISSUANCE-BINDING.md` ·
`docs/delivery/13-KIMLIK-ISPATI-DIDIT-ENTEGRASYONU.md` (uygulama notu)

# Durum

**Active** — 1.0.0, 2026-09-26 (D-ASSUR-2). Önceki: Draft 0.1.0 (2026-09-24), 0.2.0 (2026-09-25, ADR-0011). D-ID-2'nin uygulaması.
Değişmezler INVARIANTS'a `/sync-index` ile alınacak (prefix `IDP`, çakışma yok).
