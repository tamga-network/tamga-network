---
document_id: SPEC-ID-0003
title: "Kimlik doğrulama"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-09
summary: >
  Belge verenin, belge vermeden önce uyguladığı kimlik doğrulama (identity proofing) yollarını
  tanımlar: her yolun ürettiği belge sahibi seviyesi (T1–T3), ETSI TS 119 461 ile eşlemesi,
  hangi belge tipinin hangi seviyeyi gerektirdiği, sonucun nerede tutulacağı (belge verenin
  denetim kaydı; belgede asla) ve uzaktan kimlik doğrulama sağlayıcısı (referans:
  Didit, v3 API) entegrasyonunun protokol düzeyi kuralları: oturum oluşturma, sonuç
  alma, webhook doğrulama, veri minimizasyonu, hata ve zaman aşımı davranışı.
  D-ID-2'nin uygulamasıdır. Seviye tablosu ve ETSI 119 461 eşlemesi D-ASSUR-2 ile
  karara bağlandı (2026-09-26).
---

# Kısaca

Bu belge, bir kurumun belge vermeden önce kişinin gerçekten o kişi olduğunu nasıl doğruladığını ([[t:identity-proofing|kimlik doğrulama]])
anlatır. Okuru [[t:issuer|belge veren]] kurumlar ve kimlik doğrulama sağlayıcısıyla bağlantı kuran geliştiricilerdir.

**Ne zaman okunur**

- Önce [Belge verme](/concepts/issuance) kavram sayfasını ve [[GUIDE-0003]] rehberini okuyun.
- Belgenin cüzdana nasıl bağlandığı burada değil: [[SPEC-CRED-0002]].
- Tamga'nın kimlik belgesi servisi için doğrudan §9'a gidin.

**Sade anlatım**

Her belge türü bir asgari güvence düzeyi ([[t:LoA]]) ister: öğrenci belgesi için e-posta ve SMS yeterlidir, diploma için daha güçlü bir
doğrulama gerekir (örneğin kimlik kartı + canlılık testi + yüz eşleştirmesi ya da kurumun kayıt masası). Kurum bu düzeyi
belgeyi vermeden önce sağlar; sağlayamıyorsa belge vermez.
Uzaktan doğrulamayı lisanslı bir sağlayıcı yapar; kurum yalnızca sonucun kısa özetini saklar, kimlik görüntüleri saklanmaz ve
düzey belgenin içine yazılmaz. Devlet kimlik belgesi gelene kadar Tamga'nın kimlik servisi bu doğrulamayı yapıp sonucu ayrı bir
kimlik belgesi olarak cüzdana verir.

---

# Kapsam

Bu şartname **kurum tarafındaki** kimlik doğrulamayı kapsar: "bu teklifi alan kişi gerçekten
belgenin öznesi mi?" sorusunun belge vermeden önce nasıl cevaplandığı. Kapsam dışı: cüzdana bağlama
(`cnf`/[[t:KB-JWT]] — [[SPEC-CRED-0002]]), [[t:verifier|doğrulayıcı]] tarafında yüz eşleştirme ([[t:RP]] sorumluluğu), [[t:PID]]
verme (Tamga PID vermez, BT8).

İlke ([[PM-ASSUR-0001]]; [[t:eIDAS]] modeli): **[[t:holder|belge sahibinin]] seviyesi [[t:credential|belgeye]] yazılmaz**; belge tipi
bir asgari seviyeyi ön koşul olarak taşır; kurum, seviyeyi belge vermeden önce sağlar ve bağlama
yolunu **denetim kaydına** yazar ([[SPEC-PROTO-0001]]/PR7).

---

# 1. Seviyeler ve yollar

| Seviye | eIDAS LoA | ETSI TS 119 461 (D-ASSUR-2) | Yol | Nerede |
|---|---|---|---|---|
| **T0** | — | — | Cihaz anahtarı + e-posta/telefon OTP; kimlik iddiası yok | Anonim / takma adlı senaryolar (beta'da kullanılmaz) |
| **T1** | Low | Baseline | (a) e-postayla teklif + **farklı kanaldan** SMS `tx_code`; (b) OBS ekranında teklif (tek faktör); (c) banka mikro-transfer / GSM hat sahipliği | Belge veren / portal |
| **T2** | Substantial | Substantial (belge + canlılık **veya** yüz yüze) | (a) **Lisanslı uzaktan kimlik doğrulama** (kimlik belgesi OCR/NFC + canlılık + yüz eşleştirme) — bu belgede "IDV sağlayıcı"; (b) OBS + MFA ekranında teklif; (c) kurum **kayıt masası** (yüz yüze, personel onayı) | IDV sağlayıcı / portal / masa |
| **T3** | High | High | NES / Mobil İmza ile nonce imzalama (ilk aşamadan itibaren); devlet aşamasında PID | Yalnızca authorization code veya yüz yüze; **pre-authorized ile yasak** (ETSI TS 119 472-3 GEN-REQ-4.1) |

**Tip ↔ asgari seviye** [[t:rulebook]]'larda: Education Rulebook — öğrenci belgesi T1, diploma T2
([[FW-RB-0002]] §4). Kurum, tipin seviyesini sağlayamıyorsa teklif **üretmez** (belge verme durur; tahmin/yükseltme yok).

---

# 2. Akış — kimlik doğrulama, belge verme zincirinde nerede

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

Kimlik doğrulama **teklif üretiminden önce** biter; teklifin kendisi ve `tx_code` kuralları değişmez
(PR1, PR3, DB-5). Sonuç 12 ay (ÖNERİ) boyunca aynı kişi için yeniden kullanılabilir; assurance decay
kuralları geçerlidir ([[PM-ASSUR-0001]] §Decay).

---

# 3. Uzaktan kimlik doğrulama sağlayıcısı — genel kurallar

| # | Kural |
|---|---|
| IP1 | Sağlayıcı sonucu **yalnızca** belge veren tarafında değerlendirilir; cüzdan ve doğrulayıcı sağlayıcıyla konuşmaz. |
| IP2 | Belge veren, sağlayıcı oturumunu **kendi öznesine** bağlar: `vendor_data` = belge verenin iç opak referansı (öğrenci kaydının rastgele token'ı); **kimlik numarası, ad, e-posta `vendor_data`'ya yazılmaz**. |
| IP3 | Beklenen kimlik (ad, soyad, doğum tarihi) sağlayıcıya **expected_details** olarak verilebilir; sağlayıcı eşleştirme yapar; belge veren sonucu ayrıca kaynak veriyle karşılaştırır (ad-soyad + doğum tarihi tam eşleşme; fark → İnceleme). |
| IP4 | Belge verenin sisteminde saklanan şey **sonuç özetidir**: `{provider, session_ref, level, decided_at, checks:[id_document, liveness, face_match], expires_at}`. Belge görüntüsü, portre, OCR ham verisi, video **saklanmaz** ([[FW-RB-0001]] RB-AP-23). |
| IP5 | Sağlayıcı tarafındaki saklama süresi sözleşmeyle asgariye çekilir; KVKK aydınlatma metni sağlayıcıyı **veri işleyen** olarak adlandırır. |
| IP6 | Webhook **MUST** imza + zaman damgası ile doğrulanmak; imzasız/eski (> 300 s) webhook reddedilir; `event_id` ile tekilleştirme. |
| IP7 | Webhook yalnızca **tetikleyicidir**; karar her zaman sağlayıcının **decision API**'sinden çekilerek teyit edilir (webhook gövdesine güvenilmez). |
| IP8 | "In Review" / "Declined" / "Expired" → teklif üretilmez; kişiye sağlayıcı sonucu değil, "kurum kayıt masasına başvurun" yolu gösterilir. Ret gerekçesi kişiye sağlayıcı dilinde aktarılmaz. |
| IP9 | Sağlayıcı kesintisinde diploma verilmesi **durur** (T1'e düşürülmez); öğrenci belgesi (T1) etkilenmez. |
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
| Kanal | Hosted URL (yönlendirme), iframe, mobil SDK (iOS/Android/RN) | Bugün (liste aşaması): **hosted URL** (kimlik servisi `id.tamga.network` üzerinden, masaüstü/mobil tarayıcı). Cüzdan içi SDK **kullanılmaz** (kimlik ispatı kurumun işidir, cüzdanın değil) |
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

Saklanan kayıt (belge veren servis `data/<slug>/state.json › proofing[subjectRef]`):
`{ provider, sessionRef, level, checks, decidedAt, expiresAt }` — başka alan yok.

---

# 7. Hata ve sınır davranışı

| Durum | Davranış |
|---|---|
| Sağlayıcı 5xx / zaman aşımı | Diploma teklif üretilmez; kişiye "şu an kimlik doğrulama yapılamıyor" + masa seçeneği |
| Webhook imzası geçersiz | 400; olay kütüğü; işlem yok |
| Webhook gelmedi | Portal `return` sayfası decision API'yi sorgular (polling ≤ 10 dk, 15 s aralık) |
| Kişi 3 kez başarısız | 24 saat kilit; masa yolu |
| Sonuç 12 ayı geçti | Yeniden ispat (decay) |
| Kayıt masası yolu | Personel paneli: "kimliği gördüm" onayı → `path: "desk"`, `level: T2`, personel kimliği denetim kaydında |

---

# 8. Değişmezler

| # | Değişmez |
|---|---|
| **IDP1** | Belge sahibinin kimlik doğrulama seviyesi ve yolu belgeye yazılmaz; yalnızca belge verenin denetim kaydında tutulur. |
| **IDP2** | Tipin asgari seviyesi sağlanmadan teklif üretilmez; seviye tahminle yükseltilmez. |
| **IDP3** | IDV sağlayıcı entegrasyonu yalnızca **Tamga kimlik attestation servisindedir** (`id.tamga.network`, [[ADR-0011]]); kurumların belge verme servisleri, cüzdan ve doğrulayıcı sağlayıcıyla konuşmaz. |
| **IDP4** | Belge veren, IDV sonucundan yalnızca özet kaydı saklar; belge görüntüsü, portre, video, OCR ham verisi saklanmaz. |
| **IDP5** | Webhook imza ve zaman damgası doğrulanmadan işlenmez; karar her zaman decision API'den teyit edilir. |
| **IDP6** | `vendor_data`/`metadata` alanlarına kişisel veri yazılmaz; yalnızca opak referans. |
| **IDP7** | T3 hiçbir uzaktan IDV sonucuyla verilmez; T3 imza (NES/mobil imza) veya PID gerektirir ve pre-authorized akışla bağdaşmaz. |
| **IDP8** | Sağlayıcı kesintisi seviyeyi düşürmez; o seviyeyi gerektiren belge verme durur. |
| **IDP9** | Kimlik servisi IDV sonucundan kişi alanlarını yalnızca belge verme anına kadar tutar; belge verildikten sonra yalnızca opak `subject_ref`, belge numarası hash'i, süre ve status indeksleri kalır; görüntü, selfie, video, OCR ham verisi Tamga'da hiç saklanmaz (K4). |
| **IDP10** | Ulusal kimlik numarası (`personal_administrative_number`) yalnızca `urn:tamga:id:IdentityAttestation:1` tipinde ve selective disclosure ile taşınır; başka hiçbir tipe yazılmaz; kurum eşleştirmeden sonra saklamaz ve loglamaz. |
| **IDP11** | Kimlik attestation'ı verilmeden önce aydınlatma metni gösterilir ve açık rıza alınır; rıza verilmeyen oturumda IDV başlatılmaz (`access_denied`). |

---

# 9. Tamga kimlik belgesi servisi

Devlet PID sağlayıcısı atanana kadar uzaktan kimlik doğrulama **Tamga'nın kimlik servisinde** yapılır ve sonucu bir
belge olarak cüzdana verilir. Bu belge PID değil, Tamga'nın belge veren olarak (`category: IDENTITY`, `class: EAA`,
I2; belgede `category` claim'i yok — [[ADR-0022]]) verdiği nitelikli olmayan bir [[t:EAA]]'dır; `pid_providers[]` boş kalır (TL8).

| Öğe | Değer |
|---|---|
| `vct` | `urn:tamga:id:IdentityAttestation:1` (katalog: `id/IdentityAttestation/1.0.0`) |
| Claim'ler | `given_name`, `family_name`, `birthdate`, `nationalities` (dizi; her öğe ayrı açıklanır), `personal_administrative_number` (TCKN), `document_type`, `document_number_hash` (anahtarlı SHA-256 / HMAC; 1.0.1), `issuing_country`, `document_chip_verified`, `verification_method` (`remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person`), `age_over_18` — tümü selective disclosure ile; portre yok; LoA claim'i yok (PR7) |
| Süre / status | `exp` = belge verme + 730 gün; Token Status List (`id.tamga.network/status/{listId}`); aynı belge yeniden doğrulanınca eskisi iptal (K6) |
| Akış | Cüzdan: PAR (WUA) → tarayıcı `/authorize` (**KVKK aydınlatma + açık rıza**) → sağlayıcı (Didit v3; demo: FAKE, sapma S-15) → `/idv/return` karar sorgulama (webhook yalnızca tetik, IDP5) → `code` → token (PKCE + WUA) → 10 kopya |
| Kurumda kullanım | Kurumun belge veren servisi belge verilirken kimlik belgesinin **gösterilmesini** ister (DCQL: TCKN, doğum tarihi, ad, soyad), T0 + A–E doğrular, kayıtla eşler (TCKN + doğum tarihi; ad normalize uyarı) — [[SPEC-PROTO-0001]] §11.2 |
| Seviye | Uzaktan belge + canlılık + yüz = **T2** (ETSI 119 461 Substantial); NFC çip = `document_chip_verified: true` (High teknik; hukuken T3 = NES/Mobil İmza, IDP7) |
| Veri sorumlusu | Tamga Network (K4): saklama kayıt + hash; silme talebi = §9.1 (kayıt silinir, kopyalar iptal, sağlayıcıda görüntüler silinir); sağlayıcı sözleşmesinde ≤ 30 gün görüntü saklama |
| Webhook | Tek hedef `https://id.tamga.network/idv/webhook`, olay `status.updated`; kurum başına webhook yoktur |
| Yaş | Asgari yaş yok (2026-10-08, [[ADR-0043]]); şart geçerli bir kimlik belgesiyle kimlik doğrulamasıdır. Veli onayı akışı ve sağlayıcının küçükler için sınırı açık konudur |

Uygulama: `apps/id` (operatör deposu) (config/didit/store/app), `IdvProvider` arayüzü §6 ile aynı (`DiditProvider`, `FakeIdvProvider`).

## 9.1 Kişinin silme isteği — `POST /erasure`

Kişi hesabı yoktur; istek servisin verdiği belgelerin gösterilmesiyle kanıtlanır.

| Öğe | Değer |
|---|---|
| İstek | `{ "presentations": [ SD-JWT VC + KB-JWT, … ] }` (1–20); hiçbir alan açılmaz; KB-JWT `aud` = servis adresi, `nonce` = `POST /nonce` (tek kullanımlık) |
| Doğrulama | imza bu servisin (`issuerId`), sahiplik KB-JWT `cnf` anahtarıyla; kayıt iptal listesi indeksinden bulunur |
| Etki | kaydın bütün kopyaları INVALID; kayıt ve ona bağlı olay günlüğü satırları silinir; sağlayıcı oturumu `privacy_erasure` ile silinir (`IdvProvider.deleteSession`) |
| Yanıt | `{ erased, rejected, provider: "deleted" | "partial" }`; tutulan bir şey yoksa 404 |
| Günlük | yalnız sayılar (`erasure`: kayıt sayısı, sağlayıcı sonucu); kayıt kimliği ve `subject_ref` yazılmaz |

[[t:status-list|İptal listesinde]] yalnız bitler kalır (kişi verisi değil). [[t:pseudonym|Takma ad]] tohumu servis tarafında saklanmadığı için silinecek bir şey
yoktur (PS2); kişi kimliğini yeniden doğrularsa aynı tohum yeniden türer ([[ADR-0031]]).

## 9.2 Mağaza incelemesi — tek kullanımlık inceleme kodu ([[ADR-0033]])

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

## 9.3 Sürücü belgesi bilgisi — `urn:tamga:id:DrivingLicenceAttestation:1` ([[ADR-0039]])

Aynı servis, kişinin fiziksel sürücü belgesini sağlayıcıda **ayrı bir akışla** (yalnız sürücü belgesi kabul eden) inceler ve
karttaki sınıfları ve tarihleri verir. Resmî sürücü belgesi / mDL değildir (DL1); belge bunu her zaman açık
`not_official_licence: true` alanıyla söyler.

| Öğe | Değer |
|---|---|
| Ön koşul | PAR'da `identity_presentation`: cüzdandaki Tamga kimlik belgesinin SD-JWT VC + KB-JWT sunumu (`aud` = servis, `nonce` = `POST /nonce`, tek kullanımlık; yalnız `given_name`, `family_name`, `birthdate` açılır). Servis imzayı, kaydın etkin olduğunu ve yalnız üç alanın açıldığını denetler; akış kaydında kişi alanı değil anahtarlı **eşleşme özeti** (HMAC) ve bağlı kimlik kaydının kimliği durur |
| Akış | `/authorize` sürücü belgesine özel aydınlatma + açık rıza (inceleme kodu alanı yok) → sağlayıcıda sürücü belgesi akışı (ayar: ayrı akış kimliği; ayarsızsa tür ilan edilmez) → `/idv/return`: belge türü sürücü belgesi mi, kart süresi geçmiş mi, sınıf okunmuş mu, karttaki ad + doğum tarihi özete eşleşiyor mu → `code` → token → 10 kopya |
| Sağlayıcıdan okunan | ad, soyad, doğum tarihi, veren ülke, belge numarası (yalnız HMAC özeti kalır), veriliş/bitiş tarihi, süresi geçmiş olgusu, sınıf başına başlangıç/bitiş (`extra_fields.dl_class_code_<sınıf>_from/_to`). **Okunmayan:** `_notes` alanları, kısıtlama kodları, görüntü, skor |
| Claim'ler | `given_name`, `family_name`, `birth_date`, `issuing_country`, `document_number_hash`, `driving_privileges[]`, `licence_issue_date?`, `licence_expiry_date`, `verified_at`, `verification_method` (`remote-document-liveness-face`), `age_over_18`, `not_official_licence` |
| Ret | `access_denied`: sürücü belgesi değil · kart süresi geçmiş · sınıf okunamadı · bütün sınıfların süresi geçmiş (süresi geçmiş sınıflar belgeye girmez) · ad ya da veren ülke okunamadı (tahmin yok) · kimlikle eşleşmiyor · bağlı kimlik artık etkin değil (PAR'dan sonra iptal / yeniden verme / silme; `/idv/return` ve `/credential`'da yeniden denetlenir). Açıklamada kişi verisi yok; günlüğe yalnız neden kodu. Belge verilmeyen her sonuçta (sağlayıcı reddi/incelemesi dahil) sağlayıcıdaki oturum (kart görüntüsü, özçekim) hemen silinir; yarım kalan akışların oturumu çöp toplamada, kimliği unutulmadan önce silinir |
| Süre / iptal | `exp` = min(kart bitişi, inceleme + 1 yıl, bağlı kimlik belgesinin bitişi; DL3/DL5); yalnız SD-JWT VC; status list; kayıt `parentId` ile kimlik kaydına bağlı — kimlik iptal/yeniden verme/silme bağlı belgeyi de kapsar; silme, daha önce iptal edilmiş bağlı kayıtları ve sağlayıcı oturumlarını da siler (DL5) |

# Güvenlik ve Mahremiyet Notları

- Kimlik doğrulama **amaç sınırlıdır**: yalnızca belge vermenin ön koşulu; AML/PEP taraması kapalı.
- Sağlayıcı, kişinin belgesini ve yüzünü görür; bu, KVKK aydınlatma metninde açıkça yazılır ve
  sağlayıcı seçimi (veri lokasyonu, saklama süresi, alt işleyenler) sözleşmeyle bağlanır.
- `expected_details` sağlayıcıya ad/soyad/doğum tarihi verir (kaynak veriden); bu, eşleşme
  kalitesini artırır ama veri paylaşımıdır; alternatif (sağlayıcıdan gelen ad ile kurumda
  eşleştirme) IP3'te tanımlıdır ve kiracı tercihine bırakılır (ÖNERİ: varsayılan paylaşma).
- Demo'da sandbox; gerçek kişi verisi işlenmez (GT1).

# Açık Konular

1. Sonuç yeniden kullanım süresi (12 ay) ve deneme sınırları — sayılar ÖNERİ.
2. Cüzdan içi IDV (SDK) hiçbir zaman mı? Devlet aşamasında PID ile gereksizleşir; şimdilik hayır.
3. Sağlayıcı çeşitliliği: ikinci adaptör (yerli sağlayıcı / e-Devlet) — tedarikçi kilidi tripwire'ı.
4. Küçükler ([[ADR-0043]]): veli onayı akışı (GDPR m. 8; Türk hukukunda 18 yaş altı sınırlı ehliyet — hukuki inceleme) ve
   sağlayıcının küçük yaştaki kişiler için sınırı ya da koşulu (henüz teyit edilmedi).

# İlgili Dokümanlar

[[PM-ASSUR-0001]] · [[PM-ID-0001]] · [[SPEC-PROTO-0001]] · [[SPEC-CRED-0002]] · [[SPEC-WALLET-0001]] ·
[[FW-RB-0001]] · [[FW-RB-0002]] · [[ADR-0005]] · [[ADR-0011]] · [[ADR-0022]]

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

