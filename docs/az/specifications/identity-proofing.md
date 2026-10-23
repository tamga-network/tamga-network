---
document_id: SPEC-ID-0003
title: "Şəxsiyyətin yoxlanılması"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-23
summary: >
  Sənədi verən qurumun rəqəmsal sənədi verməzdən əvvəl tətbiq etdiyi şəxsiyyətin yoxlanılması (identity proofing) yollarını müəyyən edir: hər yolun təmin etdiyi sənəd sahibi səviyyəsi (T1–T3), onun ETSI TS 119 461 ilə uyğunlaşdırılması, hansı sənəd növünün hansı səviyyəni tələb etdiyi, nəticənin harada saxlanılacağı (sənədi verən qurumun audit qeydi; heç vaxt rəqəmsal sənədin özündə deyil) və uzaqdan şəxsiyyət yoxlama provayderi (istinad: Didit, v3 API) inteqrasiyasının protokol səviyyəsində qaydaları: sessiyanın yaradılması, nəticənin alınması, webhook-un yoxlanılması, məlumatların minimallaşdırılması, xəta və vaxt aşımı davranışı. D-ID-2-nin tətbiqidir. Səviyyə cədvəli və ETSI 119 461 uyğunlaşdırması D-ASSUR-2 ilə qərara alınıb (2026-09-26).
translation_of: SPEC-ID-0003
source_version: "1.0.0"
---

# Qısaca

Bu sənəd qurumun rəqəmsal sənədi verməzdən əvvəl şəxsin həqiqətən həmin şəxs olduğunu necə yoxladığını ([[t:identity-proofing|şəxsiyyətin yoxlanılması]])
izah edir. Oxucuları [[t:issuer|sənədi verən]] qurumlar və şəxsiyyət yoxlama provayderi ilə inteqrasiya quran tərtibatçılardır.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Rəqəmsal sənədin verilməsi](/concepts/issuance) konsepsiya səhifəsini və [[GUIDE-0003]] bələdçisini oxuyun.
- Rəqəmsal sənədin rəqəmsal cüzdana necə bağlandığı burada izah edilmir: [[SPEC-CRED-0002]].
- Tamga-nın şəxsiyyət sənədi xidməti üçün birbaşa §9-a keçin.

**Sadə izah**

Hər sənəd növü minimum etibarlılıq səviyyəsi ([[t:LoA]]) tələb edir: tələbə sənədi üçün e-poçt və SMS kifayətdir, diplom üçün daha güclü
yoxlama lazımdır (məsələn, şəxsiyyət vəsiqəsi + canlılıq testi + üz uyğunlaşdırması və ya qurumun qeydiyyat masası). Qurum bu səviyyəni
rəqəmsal sənədi verməzdən əvvəl təmin edir; təmin edə bilmirsə, sənədi vermir.
Uzaqdan yoxlamanı lisenziyalı provayder aparır; qurum yalnız nəticənin qısa xülasəsini saxlayır, şəxsiyyət təsvirləri saxlanılmır və
səviyyə rəqəmsal sənədin içinə yazılmır. Dövlət şəxsiyyət sənədi gələnə qədər Tamga-nın şəxsiyyət xidməti bu yoxlamanı aparır və nəticəni ayrıca
şəxsiyyət sənədi kimi rəqəmsal cüzdana verir.

---

# Əhatə dairəsi

Bu spesifikasiya **qurum tərəfindəki** şəxsiyyət yoxlamasını əhatə edir: "bu təklifi alan şəxs həqiqətən
rəqəmsal sənədin subyektidirmi?" sualının sənəd verilməzdən əvvəl necə cavablandırıldığı. Əhatə dairəsindən kənar: rəqəmsal cüzdana bağlama
(`cnf`/[[t:KB-JWT]] — [[SPEC-CRED-0002]]), [[t:verifier|yoxlayan tərəf]] tərəfində üz uyğunlaşdırması ([[t:RP]] məsuliyyəti), [[t:PID]]
verilməsi (Tamga PID vermir, BT8).

Prinsip ([[PM-ASSUR-0001]]; [[t:eIDAS]] modeli): **[[t:holder|sənəd sahibinin]] səviyyəsi [[t:credential|rəqəmsal sənədə]] yazılmır**; sənəd növü
minimum səviyyəni ilkin şərt kimi daşıyır; qurum səviyyəni sənədi verməzdən əvvəl təmin edir və bağlama
yolunu **audit qeydinə** yazır ([[SPEC-PROTO-0001]]/PR7).

---

# 1. Səviyyələr və yollar

| Səviyyə | eIDAS LoA | ETSI TS 119 461 (D-ASSUR-2) | Yol | Harada |
|---|---|---|---|---|
| **T0** | — | — | Cihaz açarı + e-poçt/telefon OTP; şəxsiyyət iddiası yoxdur | Anonim / psevdonimli ssenarilər (beta-da istifadə olunmur) |
| **T1** | Low | Baseline | (a) e-poçtla təklif + **fərqli kanaldan** SMS `tx_code`; (b) OBS ekranında təklif (tək faktor); (c) bank mikro-köçürməsi / GSM xətt sahibliyi | Sənədi verən qurum / portal |
| **T2** | Substantial | Substantial (sənəd + canlılıq **və ya** üzbəüz) | (a) **Lisenziyalı uzaqdan şəxsiyyət yoxlaması** (şəxsiyyət sənədi OCR/NFC + canlılıq + üz uyğunlaşdırması) — bu sənəddə "IDV provayderi"; (b) OBS + MFA ekranında təklif; (c) qurumun **qeydiyyat masası** (üzbəüz, əməkdaş təsdiqi) | IDV provayderi / portal / masa |
| **T3** | High | High | NES / Mobil İmza ilə nonce-un imzalanması (ilk mərhələdən etibarən); dövlət mərhələsində PID | Yalnız authorization code və ya üzbəüz; **pre-authorized ilə qadağandır** (ETSI TS 119 472-3 GEN-REQ-4.1) |

**Növ ↔ minimum səviyyə** [[t:rulebook]]-larda: Education Rulebook — tələbə sənədi T1, diplom T2
([[FW-RB-0002]] §4.4). Qurum növün səviyyəsini təmin edə bilmirsə, təklif **yaratmır** (sənədin verilməsi dayanır; təxmin/yüksəltmə yoxdur).

---

# 2. Axın — şəxsiyyətin yoxlanılması rəqəmsal sənədin verilməsi zəncirində harada yerləşir

```
Portal / SIS session (person)                    Issuer service
   │  "Add my diploma to my wallet"                 │
   ├── type = Diploma → required level T2 ─────────▶│ current level? (session type, earlier proofing record ≤ 12 months)
   │                                                  │
   │  ◀── if insufficient: start IDV session (T2a) ──┤  POST /v3/session  → url
   │  IDV provider page: document + selfie            │
   │  ──▶ completed (callback / webhook) ────────────▶│ decision → T level + record
   │  ◀── offer (QR + tx_code)  ──────────────────────┤ PR7: audit {path:"idv:<provider>", level:"T2", session_ref}
   ▼                                                  ▼
Wallet OpenID4VCI (SPEC-PROTO-0001) — unchanged
```

Şəxsiyyətin yoxlanılması **təklif yaradılmazdan əvvəl** başa çatır; təklifin özü və `tx_code` qaydaları dəyişmir
(PR1, PR3, DB-5). Nəticə 12 ay (TÖVSİYƏ) ərzində eyni şəxs üçün təkrar istifadə oluna bilər; assurance decay
qaydaları qüvvədədir ([[PM-ASSUR-0001]] §Decay).

---

# 3. Uzaqdan şəxsiyyət yoxlama provayderi — ümumi qaydalar

| # | Qayda |
|---|---|
| IP1 | Provayderin nəticəsi **yalnız** sənədi verən qurum tərəfində qiymətləndirilir; rəqəmsal cüzdan və yoxlayan tərəf provayderlə əlaqə qurmur. |
| IP2 | Sənədi verən qurum provayder sessiyasını **öz subyektinə** bağlayır: `vendor_data` = sənədi verən qurumun daxili opaq istinadı (tələbə qeydinin təsadüfi token-i); **şəxsiyyət nömrəsi, ad, e-poçt `vendor_data`-ya yazılmır**. |
| IP3 | Gözlənilən şəxsiyyət məlumatları (ad, soyad, doğum tarixi) provayderə **expected_details** kimi ötürülə bilər; provayder uyğunlaşdırma aparır; sənədi verən qurum nəticəni əlavə olaraq mənbə məlumatları ilə müqayisə edir (ad-soyad + doğum tarixi tam uyğunluq; fərq → Baxış). |
| IP4 | Sənədi verən qurumun sistemində saxlanılan **nəticənin xülasəsidir**: `{provider, session_ref, level, decided_at, checks:[id_document, liveness, face_match], expires_at}`. Sənədin təsviri, portret, OCR xam məlumatları, video **saxlanılmır** ([[FW-RB-0001]] RB-AP-23). |
| IP5 | Provayder tərəfində saxlama müddəti müqavilə ilə minimuma endirilir; KVKK məlumatlandırma mətni provayderi **məlumat emal edən** kimi göstərir. |
| IP6 | Webhook imza + vaxt damğası ilə yoxlanılmalıdır (**MUST**); imzasız/köhnə (> 300 san) webhook rədd edilir; `event_id` ilə dublikatlar aradan qaldırılır. |
| IP7 | Webhook yalnız **tətikdir**; qərar həmişə provayderin **decision API**-sindən çəkilərək təsdiqlənir (webhook gövdəsinə etibar edilmir). |
| IP8 | "In Review" / "Declined" / "Expired" → təklif yaradılmır; şəxsə provayderin nəticəsi deyil, "qurumun qeydiyyat masasına müraciət edin" yolu göstərilir. İmtina səbəbi şəxsə provayderin dilində çatdırılmır. |
| IP9 | Provayderdə fasilə zamanı diplomun verilməsi **dayanır** (T1-ə endirilmir); tələbə sənədi (T1) təsirlənmir. |
| IP10 | Provayder və iş axını identifikatoru (`workflow_id`) tenant konfiqurasiyasındadır; kod provayderə xas deyil, **adapter** interfeysi vasitəsilə işləyir (`IdvProvider` — §6). |
| IP11 | Log: hadisə növü + `session_ref` + səviyyə; şəxsin adı, sənəd nömrəsi, skor **yazılmır** (AP3 ruhunda). |

---

# 4. İstinad provayderi: Didit (v3 API) — protokol uyğunlaşdırması

Mənbə: docs.didit.me (2026-09-24 tarixində yoxlanılıb). Dəyişə bilər; adapter versiyalaşdırılır.

| Addım | Didit | Tamga-da istifadə |
|---|---|---|
| Autentifikasiya | `x-api-key: <API_KEY>` (Business Console → Application → API & Webhooks) | Tenant gizli dəyəri (`TAMGA_IDV_DIDIT_API_KEY`); `.env`, heç vaxt repozitoriyada deyil |
| Sessiya yarat | `POST https://verification.didit.me/v3/session/` gövdə: `workflow_id` (məcburi), `vendor_data`, `callback`, `callback_method`, `metadata`, `language`, `contact_details`, `expected_details {first_name,last_name,date_of_birth,id_country,expected_document_types}` | `vendor_data = <opak subject_ref>`; `callback = https://id.tamga.network/idv/return?r=<akış>`; `language = tr`; `expected_details` ad/soyad/doğum tarixi (IP3); `metadata` **boş** |
| Cavab | `session_id`, `session_token`, `url`, `status: "Not Started"`, `workflow_version` | `url`-ə yönləndir; `session_id` = `session_ref` |
| Nəticə | `GET https://verification.didit.me/v3/session/{sessionId}/decision/` → `status`, `features[]`, `id_verifications[] {status, first_name, last_name, date_of_birth, document_type, issuing_state, expiration_date, verification_method, assurance, …}`, `liveness_checks[] {status, score}`, `face_matches[] {status, score}`, `nfc_verifications[]`, `aml_screenings[]` | Yalnız `status` və alt yoxlama `status`-ları + ad/soyad/doğum tarixi **uyğunluq nəticəsi** (boolean) saxlanılır; təsvir sahələri (`portrait_image`, `front_image`, `back_image`, `video_url`) **oxunur, lakin saxlanılmır** |
| Webhook | `POST` gövdə: `event_id`, `webhook_type` (`status.updated` …), `session_id`, `status`, `vendor_data`, `decision`, `timestamp`, `created_at`, `environment`; başlıqlar `X-Signature-V2` (HMAC-SHA256, kanonik JSON), `X-Signature` (xam gövdə), `X-Timestamp` | `X-Signature` (xam gövdə) + `X-Timestamp` (±300 san) yoxlanılır; `event_id` ilə dublikatlar aradan qaldırılır; sonra decision API təsdiqi (IP7). Təkrar cəhd: ~1 dəq, ~4 dəq; 5 san vaxt aşımı → son nöqtə dərhal 200 qaytarır, emal növbəyə alınır |
| Statuslar | `Not Started`, `In Progress`, `Awaiting User`, `In Review`, `Approved`, `Declined`, `Resubmitted`, `Expired`, `Kyc Expired`, `Abandoned` | §5 uyğunlaşdırması |
| İş axını | Business Console-da no-code workflow: ID + liveness + face match (+ NFC isteğe bağlı) | Tamga workflow-u: **ID document + passive liveness + face match**; AML **söndürülüb** (məqsəd məhdudiyyəti); phone/email **söndürülüb** (T1 artıq SMS ilə) |
| Kanal | Hosted URL (yönləndirmə), iframe, mobil SDK (iOS/Android/RN) | Bu gün (siyahı mərhələsi): **hosted URL** (şəxsiyyət xidməti `id.tamga.network` vasitəsilə, masaüstü/mobil brauzer). Rəqəmsal cüzdan daxilində SDK **istifadə olunmur** (şəxsiyyətin sübutu qurumun işidir, rəqəmsal cüzdanın deyil) |
| Sandbox | `sandbox_scenario` sahəsi; `environment: "sandbox"` | Demo: sandbox ssenariləri ilə; e2e testdə saxta adapter |
| Qiymət | Ayda 500 yoxlama pulsuz; sonra istifadəyə görə ödəniş | Pilot miqyası pulsuz kvota daxilindədir |

---

# 5. Nəticə → səviyyə uyğunlaşdırması

| Didit `status` | Alt yoxlamalar | Ad/soyad/doğum tarixi uyğunluğu | Tamga nəticəsi |
|---|---|---|---|
| `Approved` | `id_verifications[].status = Approved` ∧ `liveness_checks[].status = Approved` ∧ `face_matches[].status = Approved` | Tam uyğunluq | **T2** (`path: "idv:didit"`) |
| `Approved` | NFC `Approved` (çipli sənəd) | Tam | **T2** (qeyd: `nfc: true`; T3 **deyil** — T3 üçün imza tələb olunur) |
| `Approved` | hər hansı biri `Approved` deyil | — | **Kifayət deyil** → masa |
| `Approved` | hamısı Approved | Uyğun gəlmir | **Baxış** (əməkdaşın qərarı; avtomatik T2 yoxdur) |
| `In Review` | — | — | Gözlə (≤ 24 saat); sonra əməkdaş |
| `Declined`, `Expired`, `Kyc Expired`, `Abandoned` | — | — | Kifayət deyil; yeni sessiya ≤ 3 cəhd / 24 saat |
| `Not Started`, `In Progress`, `Awaiting User`, `Resubmitted` | — | — | Davam edir |

Sənəd növü məhdudiyyəti: `expected_document_types = ["ID", "P"]` (TC şəxsiyyət vəsiqəsi, pasport);
`issuing_state` qurumun ölkəsi və ya tələbənin vətəndaşlığı ilə uyğun olmalıdır (vətəndaşlıq mənbə məlumatlarında yoxdursa,
məhdudiyyət tətbiq edilmir).

---

# 6. Adapter interfeysi (tətbiq müqaviləsi)

```ts
interface IdvProvider {
  readonly id: "didit" | string;
  createSession(input: {
    subjectRef: string;                 // opaque, not personal data
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

Saxlanılan qeyd (sənədi verən qurumun xidməti `data/<slug>/state.json › proofing[subjectRef]`):
`{ provider, sessionRef, level, checks, decidedAt, expiresAt }` — başqa sahə yoxdur.

---

# 7. Xəta və hədd davranışı

| Vəziyyət | Davranış |
|---|---|
| Provayder 5xx / vaxt aşımı | Diplom üçün təklif yaradılmır; şəxsə "hazırda şəxsiyyəti yoxlamaq mümkün deyil" + masa seçimi |
| Webhook imzası etibarsızdır | 400; hadisə jurnalı; heç bir əməliyyat aparılmır |
| Webhook gəlmədi | Portalın `return` səhifəsi decision API-ni sorğulayır (polling ≤ 10 dəq, 15 san interval) |
| Şəxs 3 dəfə uğursuz oldu | 24 saatlıq blok; masa yolu |
| Nəticə 12 ayı keçib | Yenidən sübut (decay) |
| Qeydiyyat masası yolu | Əməkdaş paneli: "şəxsiyyəti gördüm" təsdiqi → `path: "desk"`, `level: T2`, əməkdaşın identifikatoru audit qeydində |

---

# 8. İnvariantlar

| # | Dəyişməz qayda |
|---|---|
| **IDP1** | Sənəd sahibinin şəxsiyyətinin doğrulanma səviyyəsi və üsulu sənədə yazılmır; yalnız sənədi verən qurumun audit qeydində saxlanılır. |
| **IDP2** | Növün minimum səviyyəsi təmin edilmədən təklif yaradılmır; səviyyə ehtimal əsasında yüksəldilmir. |
| **IDP3** | IDV provayderi inteqrasiyası yalnız **Tamga şəxsiyyət attestation xidmətindədir** (`id.tamga.network`, [[ADR-0011]]); qurumların sənəd vermə xidmətləri, rəqəmsal cüzdan və yoxlayan tərəf provayderlə əlaqə qurmur. |
| **IDP4** | Sənədi verən qurum IDV nəticəsindən yalnız xülasə qeydini saxlayır; sənədin təsviri, portret, video, OCR xam məlumatları saxlanılmır. |
| **IDP5** | Webhook imzası və zaman damğası yoxlanılmadan emal edilmir; qərar həmişə decision API vasitəsilə təsdiqlənir. |
| **IDP6** | `vendor_data`/`metadata` sahələrinə fərdi məlumatlar yazılmır; yalnız qeyri-şəffaf (opaque) istinad. |
| **IDP7** | T3 heç bir məsafədən IDV nəticəsi ilə verilmir; T3 imza (NES/mobil imza) və ya PID tələb edir və pre-authorized axınla uyğun gəlmir. |
| **IDP8** | Provayderdəki fasilə səviyyəni aşağı salmır; həmin səviyyəni tələb edən sənəd vermə dayanır. |
| **IDP9** | Şəxsiyyət xidməti IDV nəticəsindən şəxsə aid sahələri yalnız sənədin verilməsi anınadək saxlayır; sənəd verildikdən sonra yalnız qeyri-şəffaf `subject_ref`, sənəd nömrəsinin hash-i, müddət və status indeksləri qalır; təsvir, selfi, video, OCR xam məlumatları Tamga-da ümumiyyətlə saxlanılmır (K4). |
| **IDP10** | Milli şəxsiyyət nömrəsi (`personal_administrative_number`) yalnız `urn:tamga:id:IdentityAttestation:1` növündə və selective disclosure ilə ötürülür; başqa heç bir növə yazılmır; qurum uyğunlaşdırmadan sonra onu saxlamır və loglamır. |
| **IDP11** | Şəxsiyyət attestation-ı verilməzdən əvvəl məlumatlandırma mətni göstərilir və açıq razılıq alınır; razılıq verilməyən sessiyada IDV başladılmır (`access_denied`). |

---

# 9. Tamga şəxsiyyət sənədi xidməti

Dövlət PID provayderi təyin edilənədək məsafədən şəxsiyyətin yoxlanılması **Tamga-nın şəxsiyyət xidmətində** (yoxlayan tərəf qismində) aparılır və nəticəsi
rəqəmsal sənəd kimi rəqəmsal cüzdana verilir. Bu rəqəmsal sənəd PID deyil, Tamga-nın sənədi verən qurum kimi (`category: IDENTITY`, `class: EAA`,
I2; rəqəmsal sənəddə `category` claim-i yoxdur — [[ADR-0022]]) verdiyi kvalifikasiyasız [[t:EAA]]-dır; `pid_providers[]` boş qalır (TL8).

| Element | Dəyər |
|---|---|
| `vct` | `urn:tamga:id:IdentityAttestation:1` (kataloq: `id/IdentityAttestation/1.0.0`) |
| Claim-lər | `given_name`, `family_name`, `birthdate`, `nationalities` (massiv; hər element ayrıca açıqlanır), `personal_administrative_number` (TCKN), `document_type`, `document_number_hash` (açarlı SHA-256 / HMAC; 1.0.1), `issuing_country`, `document_chip_verified`, `verification_method` (`remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person`), `age_over_18`, `age_over_15` ([[ADR-0064]]: ISO/IEC 18013-5 `age_over_NN`, qapalı çoxluq) — hamısı selective disclosure ilə; portret yoxdur; LoA claim-i yoxdur (PR7) |
| Müddət / status | `exp` = rəqəmsal sənədin verilməsi + 730 gün; Token Status List (`id.tamga.network/status/{listId}`); eyni rəqəmsal sənəd yenidən yoxlandıqda köhnəsi ləğv edilir (K6) |
| Axın | Rəqəmsal cüzdan: PAR (WUA) → brauzer `/authorize` (**KVKK üzrə məlumatlandırma + açıq razılıq**) → provayder (Didit v3; demo: FAKE, kənarlaşma S-15) → `/idv/return` qərar sorğusu (webhook yalnız tətikdir, IDP5) → `code` → token (PKCE + WUA) → 10 nüsxə |
| Qurumda istifadə | Sənədi verən qurumun xidməti rəqəmsal sənədi verərkən şəxsiyyət sənədinin **təqdim edilməsini** tələb edir (DCQL: TCKN, doğum tarixi, ad, soyad), T0 + A–E yoxlayır, qeydlə uyğunlaşdırır (TCKN + doğum tarixi; adın normallaşdırılması ilə bağlı xəbərdarlıq) — [[SPEC-PROTO-0001]] §11.2 |
| Səviyyə | Məsafədən sənəd + canlılıq + üz = **T2** (ETSI 119 461 Substantial); NFC çip = `document_chip_verified: true` (texniki baxımdan High; hüquqi baxımdan T3 = NES/Mobil İmza, IDP7) |
| Məlumat nəzarətçisi | Tamga Network (K4): saxlanılan qeyd + hash; silinmə tələbi = §9.1 (qeyd silinir, nüsxələr ləğv edilir, provayderdəki təsvirlər silinir); provayder müqaviləsində təsvirlərin saxlanması ≤ 30 gün |
| Webhook | Yeganə hədəf `https://id.tamga.network/idv/webhook`, hadisə `status.updated`; qurum üzrə ayrıca webhook yoxdur |
| Yaş | Minimum yaş yoxdur (2026-10-08, [[ADR-0043]]); şərt etibarlı şəxsiyyət sənədi ilə şəxsiyyətin yoxlanılmasıdır. Valideyn razılığı axını və provayderin azyaşlılar üçün həddi açıq məsələdir |

Tətbiq: `apps/id` (operator repozitoriyası) (config/didit/store/app), `IdvProvider` interfeysi §6 ilə eynidir (`DiditProvider`, `FakeIdvProvider`).

> **`issuing_country` (2026-10-11, layihə rəhbərliyinin qərarı).** Sahənin mənası Aİ PID-dəki mənadır: sənədi verən şəxsiyyət
> provayderinin ölkəsi (İcra Reqlamenti (Aİ) 2026/1731). Bu gün sənədi Tamga-nın şəxsiyyət xidməti skan edilmiş şəxsiyyət sənədinə
> əsaslanaraq özü verdiyi üçün dəyər **skan edilmiş şəxsiyyət sənədini verən ölkəni** əks etdirir. Hər hansı dövlətin PID provayderi PID verdikdə
> sahə Aİ mənasını daşıyır və dokumentasiya sahəni Aİ-nin tərifi ilə izah edir. Kod və sxem bu gün dəyişmir.

## 9.1 Şəxsin silmə sorğusu — `POST /erasure`

Şəxs üçün hesab yoxdur; sorğu xidmətin verdiyi sənədlərin təqdim edilməsi ilə sübut olunur.

| Element | Dəyər |
|---|---|
| Sorğu | `{ "presentations": [ SD-JWT VC + KB-JWT, … ] }` (1–20); heç bir sahə açılmır; KB-JWT `aud` = xidmət ünvanı, `nonce` = `POST /nonce` (birdəfəlik) |
| Yoxlama | imza bu xidmətə məxsusdur (`issuerId`), sahiblik KB-JWT `cnf` açarı ilə; qeyd ləğv siyahısı indeksindən tapılır; müddəti bitmiş və ya ləğv edilmiş sənəd də qəbul edilir (qeyd saxlandığı müddətcə şəxsin məlumatıdır) |
| Təsir | qeydin bütün nüsxələri INVALID olur; qeyd və ona bağlı hadisə jurnalı sətirləri silinir; provayder sessiyası `privacy_erasure` ilə silinir (`IdvProvider.deleteSession`) |
| Cavab | `{ erased, rejected, provider: "deleted" | "partial" }`; saxlanılan heç nə yoxdursa 404 |
| Jurnal | yalnız saylar (`erasure`: qeydlərin sayı, provayderin nəticəsi); qeydin identifikatoru və `subject_ref` yazılmır |

[[t:status-list|Ləğv siyahısında]] yalnız bitlər qalır (fərdi məlumatlar deyil). [[t:pseudonym|Psevdonim]] toxumu xidmət tərəfində saxlanılmadığı üçün silinəcək heç nə
yoxdur (PS2); şəxsiyyət yoxlayan tərəf tərəfindən yenidən təsdiqlənərsə, eyni toxum yenidən törədilir ([[ADR-0031]]).

## 9.2 Mağaza yoxlaması — birdəfəlik yoxlama kodu ([[ADR-0033]])

| Element | Dəyər |
|---|---|
| Kod | Operator yaradır (`ops/review-code.ts create`); 26 simvol (130 bit), ən çox 14 gün, birdəfəlik, eyni anda ən çox 3 aktiv; verilənlər bazasında yalnız HMAC xülasəsi (`review_codes`; RV1) |
| Daxiletmə | `/authorize` məlumatlandırma səhifəsində "Yoxlama kodu" sahəsi (`POST /authorize/consent`, `review_code`); boşdursa, axın dəyişmir |
| Təsir | Etibarlı kodla yalnız həmin PAR üçün sınaq doğrulaması (`/review-idv/{oturum}`, real provayderə sorğu yoxdur); şəxs koda xas DEMO şəxsdir (ad "DEMO", soyad "App Reviewer") |
| İmza | Ayrıca DEMO imzaçısı `tamga-id-review` (etibar siyahısında I1); real imzaçı istifadə olunmur (RV2). Ləğv siyahısı şəxsiyyət xidmətinin siyahısıdır |
| Sənəd | `verification_method: review-demo`, ən çox 7 gün; psevdonim toxumu ayrıca açardan (real toxumlarla toqquşmur) |
| Qəbul | I2 tələb edən heç bir siyasətdə keçmir; yalnız Tamga Verify `review-*` siyasətləri (I1) |
| Limit | PAR üzrə 5 uğursuz cəhd; bütün xidmət üzrə 10 dəqiqədə 20 xəta olduqda 15 dəqiqəlik bloklama (IP istifadə olunmur); nginx `/authorize/consent` sürət limiti |
| Söndürülmüş | DEMO açarı yoxdursa və ya etibar siyahısı `tamga-id-review`-u tanımırsa, kod daxil edilsə belə "aktiv deyil" (503) |
| Jurnal | `review_code.accepted` / `.used` (kodun identifikatoru), `.rejected` (təfərrüatsız); kod və onun xülasəsi heç vaxt yazılmır |

## 9.3 Sürücülük vəsiqəsi (rəqəmsal sənəd) məlumatı — `urn:tamga:id:DrivingLicenceAttestation:1` ([[ADR-0039]])

Eyni xidmət şəxsin fiziki sürücülük vəsiqəsini provayderdə **ayrıca axınla** (yalnız sürücülük vəsiqəsini qəbul edən) yoxlayır və
kartdakı kateqoriyaları və tarixləri verir. Bu, rəsmi sürücülük vəsiqəsi / mDL deyil (DL1); sənəd bunu həmişə açıq
`not_official_licence: true` sahəsi ilə bildirir.

| Element | Dəyər |
|---|---|
| Ön şərt | PAR-da `identity_presentation`: cüzdandakı Tamga şəxsiyyət sənədinin SD-JWT VC + KB-JWT təqdimatı (`aud` = xidmət, `nonce` = `POST /nonce`, birdəfəlik; yalnız `given_name`, `family_name`, `birthdate` açılır). Xidmət imzanı, qeydin aktiv olduğunu və yalnız üç sahənin açıldığını yoxlayır; axın qeydində şəxsə aid sahə deyil, açarlı **uyğunluq xülasəsi** (HMAC) və bağlı şəxsiyyət qeydinin identifikatoru saxlanılır |
| Axın | `/authorize` sürücülük vəsiqəsinə xas məlumatlandırma + açıq razılıq (yoxlama kodu sahəsi yoxdur) → provayderdə sürücülük vəsiqəsi axını (ayar: ayrıca axın identifikatoru; ayarlanmayıbsa, növ elan edilmir) → `/idv/return`: sənəd növü sürücülük vəsiqəsidirmi, kartın müddəti bitibmi, kateqoriya oxunubmu, kartdakı ad + doğum tarixi xülasəyə uyğun gəlirmi → `code` → token → 10 nüsxə |
| Provayderdən oxunan | ad, soyad, doğum tarixi, verən ölkə, sənəd nömrəsi (yalnız HMAC xülasəsi qalır), verilmə/bitmə tarixi, müddətin bitməsi faktı, kateqoriya üzrə başlanğıc/bitmə (`extra_fields.dl_class_code_<sınıf>_from/_to`). **Oxunmayan:** `_notes` sahələri, məhdudiyyət kodları, təsvir, bal |
| Claim-lər | `given_name`, `family_name`, `birth_date`, `issuing_country`, `document_number_hash`, `driving_privileges[]`, `licence_issue_date?`, `licence_expiry_date`, `verified_at`, `verification_method` (`remote-document-liveness-face`), `age_over_18`, `not_official_licence` |
| İmtina | `access_denied`: sürücülük vəsiqəsi deyil · kartın müddəti bitib · kateqoriya oxunmadı · bütün kateqoriyaların müddəti bitib (müddəti bitmiş kateqoriyalar sənədə daxil edilmir) · ad və ya verən ölkə oxunmadı (təxmin yoxdur) · şəxsiyyətlə uyğun gəlmir · bağlı şəxsiyyət artıq aktiv deyil (PAR-dan sonra ləğv / yenidən vermə / silmə; `/idv/return` və `/credential`-də yenidən yoxlanılır). İzahda fərdi məlumat yoxdur; jurnala yalnız səbəb kodu yazılır. Sənəd verilməyən hər nəticədə (provayderin imtinası/yoxlaması daxil olmaqla) provayderdəki sessiya (kart təsviri, selfi) dərhal silinir; yarımçıq qalan axınların sessiyası zibil toplama zamanı, identifikatoru unudulmazdan əvvəl silinir |
| Müddət / ləğv | `exp` = min(kartın bitməsi, yoxlama + 1 il, bağlı şəxsiyyət sənədinin bitməsi; DL3/DL5); yalnız SD-JWT VC; status list; qeyd `parentId` ilə şəxsiyyət qeydinə bağlıdır — şəxsiyyətin ləğvi/yenidən verilməsi/silinməsi bağlı sənədi də əhatə edir; silmə əvvəllər ləğv edilmiş bağlı qeydləri və provayder sessiyalarını da silir (DL5) |

# Təhlükəsizlik və məxfilik qeydləri

- Şəxsiyyətin doğrulanması **məqsədlə məhdudlaşdırılıb**: yalnız sənəd verməyin ön şərtidir; AML/PEP yoxlaması söndürülüb.
- Provayder şəxsin sənədini və üzünü görür; bu, KVKK məlumatlandırma mətnində açıq şəkildə yazılır və
  provayder seçimi (məlumatların yeri, saxlanma müddəti, sub-prosessorlar) müqavilə ilə tənzimlənir.
- `expected_details` provayderə ad/soyad/doğum tarixini ötürür (mənbə məlumatlarından); bu, uyğunlaşdırma
  keyfiyyətini artırır, lakin məlumat paylaşımıdır; alternativ (provayderdən gələn adın qurumda
  uyğunlaşdırılması) IP3-də müəyyən edilib və tenantın seçiminə buraxılır (TƏKLİF: standart olaraq paylaşmamaq).
- Demoda sandbox istifadə olunur; real fərdi məlumatlar emal edilmir (GT1).

# Açıq məsələlər

1. Nəticənin təkrar istifadə müddəti (12 ay) və cəhd limitləri — rəqəmlər TƏKLİFDİR.
2. Rəqəmsal cüzdan daxilində IDV (SDK) heç vaxt olmayacaqmı? Dövlət mərhələsində PID ilə lüzumsuz olur; hələlik yox.
3. Provayder müxtəlifliyi: ikinci adapter (yerli provayder / e-Devlet) — təchizatçı asılılığı (vendor lock-in) üçün tripwire.
4. Azyaşlılar ([[ADR-0043]]): valideyn razılığı axını (GDPR m. 8; Türkiyə hüququnda 18 yaşdan kiçiklərin məhdud fəaliyyət qabiliyyəti — hüquqi araşdırma) və
   provayderin azyaşlı şəxslər üçün məhdudiyyəti və ya şərti (hələ təsdiqlənməyib).

# Əlaqəli sənədlər

[[PM-ASSUR-0001]] · [[PM-ID-0001]] · [[SPEC-PROTO-0001]] · [[SPEC-CRED-0002]] · [[SPEC-WALLET-0001]] ·
[[FW-RB-0001]] · [[FW-RB-0002]] · [[ADR-0005]] · [[ADR-0011]] · [[ADR-0022]]

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

