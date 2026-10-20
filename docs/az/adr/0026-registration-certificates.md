---
document_id: ADR-0026
title: "Qeydiyyat sertifikatları"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-19
summary: >
  Tamga müvəqqəti qeydiyyat orqanı kimi yoxlayan tərəfin hər istifadə halı və hər sənədi verən qurum üçün ETSI TS 119 475 qeydiyyat sertifikatı (WRPRC, `rc-wrp+jwt`) yaradır; məzmun yalnız imzalı etibar siyahısındakı qeyddən götürülür və ayrıca qeydiyyat orqanı açarı ilə imzalanır. Yoxlayan tərəf sertifikatı OpenID4VP sorğusunda `verifier_info` (`registration_cert`) ilə göndərir; rəqəmsal cüzdan imzanı, müddəti, giriş sertifikatındakı qurumun identifikasiya nömrəsi ilə uyğunluğu və tələb olunan sahələri yoxlayır. Giriş sertifikatları qurumun identifikasiya nömrəsini (`organizationIdentifier`) daşıyır.
domain: Trust
translation_of: ADR-0026
source_version: "1.0.0"
---

# Kontekst

[[ADR-0024]] [[t:verifier]] və [[t:issuer]] qeydlərinə Avropa İttifaqının (Aİ) ümumi məlumat dəstini əlavə etdi, [[t:registration-certificate|qeydiyyat sertifikatını]] (WRPRC) isə
növbəti addıma saxladı. Aİ ilə uyğunsuzluq təhlilində (H1, P2) bu bənd açıq qaldı: [[t:ARF]] mövzu 44, RPA_02, RPA_06.

Aİ modelində:

- **[[t:access-certificate]]** ([[t:WRPAC]]) yoxlayan tərəfin kim olduğunu bildirir; subyekt sahəsində qurumun identifikasiya nömrəsi
  (ETSI EN 319 412-1 semantik identifikatoru, məs. `VATTR-1234567890`) yer alır.
- **Qeydiyyat sertifikatı** ([[t:WRPRC]], ETSI TS 119 475 v1.2.1) yoxlayan tərəfin **nəyi, hansı məqsədlə tələb etmək üçün qeydiyyatdan
  keçdiyini** bildirir. Milli qeydiyyat orqanı imzalayır; `typ` `rc-wrp+jwt`; JAdES B-B imzası; ən çox 12 ay etibarlıdır; hər istifadə halı üçün ayrıca
  sertifikat.
- Yoxlayan tərəf bunu [[t:OpenID4VP]] sorğusunda `verifier_info: [{"format": "registration_cert", "data": "<jwt>"}]` ilə ötürür
  (ETSI TS 119 472-2). Qeydiyyat sertifikatı Aİ-də məcburi deyil; qeydiyyat orqanı verərsə, rəqəmsal cüzdan onu yoxlayır.

Tamga rəqəmsal cüzdanı eyni məlumatı imzalı [[t:trust-list|etibar siyahısından]] oxuyur. Qeydiyyat sertifikatı Aİ rəqəmsal cüzdanlarının Tamga yoxlayan tərəflərini və
sənədi verən qurumlarını öz bildikləri formada tanıya bilməsi üçün lazımdır. Layihə rəhbərliyi H1 planını (P2) təsdiqlədi və növbəti işlərə
keçilməsini istədi.

# Qərar

## K1 — Qeydiyyat orqanı və imza açarı

Tamga Türkiyə adından **müvəqqəti qeydiyyat orqanıdır** ([[t:LOTL]] `roles.registrar`, PROVISIONAL). Qeydiyyat sertifikatları ayrıca
**qeydiyyat orqanı açarı** ilə imzalanır (siyahının imza açarından ayrı). Açarın barmaq izi LOTL-da `roles.registrar.signing_keys`
altında dərc olunur; rəqəmsal cüzdan qeydiyyat orqanının açarını buradan tanıyır (LOTL tətbiqə daxil edilmiş barmaq izi ilə yoxlanılıb).

## K2 — Yaradılma: yalnız etibar siyahısındakı qeyddən

Siyahı naşiri hər dərcdə aşağıdakıları yaradır:

| Kim üçün | Neçə sertifikat | Əsas sahələr |
|---|---|---|
| Yoxlayan tərəf | hər istifadə halı (`scopes[]`) üçün bir | `purpose`, `credentials` (vct + tələb oluna bilən sahələr), `privacy_policy`, `intended_use_id` = `scope_id` |
| Sənədi verən qurum | hər quruma bir | `provides_attestations` (səlahiyyətli olduğu növlər), `entitlements` |

Ümumi sahələr: `name` (kommersiya adı), `sub_ln` (rəsmi ad), `sub` (semantik identifikator), `country`, `registry_uri` (imzalı milli
siyahının ünvanı), `entitlements` (ETSI TS 119 475 Əlavə A URI-ləri), `srv_description`, `info_uri`, `support_uri`,
`supervisory_authority`, `public_body`, `iat`, `exp`.

- `sub` qeydin `identifiers[]` sahəsindən törədilir: `TR-VKN` → `VATTR-<numara>`, `TR-MERSIS` → `NTRTR-<numara>`.
  **İdentifikasiya nömrəsi olmayan qeyd üçün sertifikat yaradılmır** (naşir xəbərdarlıq verir).
- `exp` ən çox 12 ay; istifadə halının və ya qeydin bitmə tarixi daha yaxındırsa, həmin tarix.
- Vasitəçi üzərindən gələn sorğu ([[ADR-0017]]) üçün `intermediary {sub, sname}` doldurulur.
- Sertifikatlar `trust.tamga.network/wrprc/` altında dərc olunur (kataloq: `wrprc/index.json`). Fərdi məlumatlar daxil deyil.

## K3 — Giriş sertifikatında qurumun identifikasiya nömrəsi

Giriş sertifikatları (`pki:issue`) subyekt sahəsində `organizationIdentifier` (OID 2.5.4.97) daşıyır. Dəyər qeydiyyat
sertifikatının `sub` sahəsi ilə eynidir. İnkişaf sertifikatları bu sahəni daşımır; identifikasiya nömrəsi qeydə daxil edildikdə sertifikat
yenilənir.

## K4 — Yoxlayan tərəf

Yoxlayan tərəf, sorğunun istifadə halına aid qeydiyyat sertifikatı varsa, sorğu obyektinə
`verifier_info: [{"format": "registration_cert", "data": "<jwt>"}]` əlavə edir. Yoxdursa, sorğu sertifikatsız göndərilir.

**2026-10-13 dəyişikliyi** (aşağıda "Dəyişiklik"): hər sorğuya bir qeydiyyat sertifikatı, `credential_ids` yoxdur, `registrar_dataset`
istifadə olunmur.

## K5 — Rəqəmsal cüzdan

Sorğuda `registration_cert` varsa, rəqəmsal cüzdan ardıcıllıqla yoxlayır:

1. `typ` `rc-wrp+jwt`; imza `x5c` sertifikatı ilə etibarlıdır; bu sertifikatın barmaq izi LOTL-dakı qeydiyyat orqanı açarlarından biridir.
2. `iat` ≤ indi < `exp`.
3. `sub` (vasitəçili sorğuda `intermediary.sub`) sorğunu imzalayan giriş sertifikatındakı `organizationIdentifier` ilə eynidir.
4. Tələb olunan sahələrin hamısı sertifikatın `credentials` siyahısındadır. Artığı **həddindən artıq sorğu** sayılır (təsdiq ekranında xəbərdarlıq).

1–3-dən biri ödənilməzsə, sorğu **rədd edilir** və istifadəçiyə "qeydiyyat sertifikatı etibarsızdır" göstərilir. Qeydiyyat sertifikatı yoxdursa
və ya etibarlıdırsa, rəqəmsal cüzdan etibar siyahısının yoxlanmasına davam edir. İki mənbə ziddiyyət təşkil edərsə, daha məhdudlaşdırıcı olan tətbiq edilir.

**2026-10-13 dəyişikliyi** (aşağıda "Dəyişiklik"): qeydiyyat sertifikatı olmayan sorğuda xəbərdarlıq və defolt "Paylaşmayın"; 2028-08-11-dən
sonra rədd. Yaxın məsafədə qeydiyyat sertifikatı `euWrprc` ilə gəlir.

# Nəzərdən keçirilmiş variantlar

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Qeydiyyat sertifikatı yaratmamaq (Aİ-də məcburi deyil) | rədd | Aİ rəqəmsal cüzdanları Tamga yoxlayan tərəflərinin nəyi tələb etmək üçün qeydiyyatdan keçdiyini bilə bilməz |
| Siyahının imza açarı ilə imzalamaq | rədd | Açarların ayrılması: siyahı imzası və qeydiyyat bəyanı ayrı rollardır |
| Hər istifadə halına deyil, hər yoxlayan tərəfə bir sertifikat | rədd | TS 119 475 və TS5 hər istifadə halı üçün sertifikat nəzərdə tutur |
| İdentifikasiya nömrəsi olmadıqda yer tutucu `sub` | rədd | Giriş sertifikatı ilə uyğunlaşdırma mənasız olur; saxta etibar yaradır |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| WRC1 | Qeydiyyat sertifikatı yalnız imzalı etibar siyahısındakı qeyddən yaradılır; siyahıda olmayan sahə və ya növ sertifikata daxil edilmir. |
| WRC2 | Qeydiyyat sertifikatı qeydiyyat orqanı açarı ilə imzalanır; bu açar siyahının imza açarından ayrıdır və LOTL-da dərc olunur. |
| WRC3 | Qeydiyyat sertifikatının etibarlılıq müddəti ən çox 12 aydır və qeydin və ya istifadə halının bitmə tarixini keçmir. |
| WRC4 | Rəqəmsal cüzdan imzası, müddəti və ya giriş sertifikatı ilə əlaqəsi yoxlanıla bilməyən qeydiyyat sertifikatı daşıyan sorğuya məlumat göndərmir. |

# Nəticələr

- `apps/trust-publisher`: qeydiyyat sertifikatının yaradılması (`wrprc.ts`), LOTL-da qeydiyyat orqanı açarı; `ops/gen-pki.ts` qeydiyyat orqanı
  açarı; `ops/pki-issue.ts --org-id`.
- `@tamga-network/verifier`: `createPresentationRequest({ registrationCert })`; `apps/verify` istifadə halına aid sertifikatı əlavə edir.
- `@tamga-network/wallet-core`: qeydiyyat sertifikatının yoxlanması; nəticə təsdiq ekranında.
- Pilotdan əvvəl: qeydlərə identifikasiya nömrələri daxil edilir, giriş sertifikatları `organizationIdentifier` ilə yenilənir; qeydiyyat orqanı
  rolu milli orqana ötürüldükdə LOTL-da açar dəyişir.

# Dəyişiklik — 2026-10-13 (Aİ ilə uyğunluq üzrə ilk mərhələ)

İcra Reqlamenti (Aİ) 2026/1731 ETSI TS 119 472-2-nin qeydiyyat sertifikatı qaydalarını dəyişdirərək məcburi etdi (RO-02…RO-16) və rəqəmsal cüzdanda
qeydiyyat sertifikatının yoxlanmasını 2028-08-11-dən etibarən icbari qıldı. K4 və K5 buna uyğun dəyişir; K1–K3 və WRC1–WRC4 olduğu kimi qüvvədədir.

**K4 (yoxlayan tərəf) — yeni mətn.**
- Yoxlayan tərəf hər sorğuda sorğunun istifadə halına (`scope_id`) aid **yalnız bir** qeydiyyat sertifikatını `verifier_info` daxilində
  `{"format": "registration_cert", "data": "<jwt>"}` kimi göndərir (RO-13…RO-16). `data` qeydiyyat sertifikatının özüdür;
  RO-16-dakı "base64url" JWT-nin compact formatı (base64url hissələrdən ibarət JWS) kimi başa düşülür, əlavə kodlanmır.
- Element `credential_ids` **daşımır**; bir sorğuda birdən çox qeydiyyat sertifikatı göndərilmir. Sertifikat bütün sorğunu əhatə edir; tələb olunan
  rəqəmsal sənədlər həmin istifadə halının qeydindədir.
- `registrar_dataset` formatı (qeydiyyat məlumatlarının sorğuda açıq şəkildə göndərilməsi) **istifadə olunmur**; reqlament bu yolu aradan qaldırdı (RO-02…RO-12).
- İstifadə halının qeydiyyat sertifikatı yoxdursa (məs. identifikasiya nömrəsi hələ qeydə daxil edilməmiş yoxlayan tərəf), sorğu sertifikatsız göndərilir; rəqəmsal cüzdan K5-ə
  uyğun davranır.
- Tətbiq: paketlərin 0.5.2 versiyası (`credential_ids` çıxarılır).

**K5 (rəqəmsal cüzdan) — əlavə edilən qaydalar.**
- **Qeydiyyat sertifikatı olmayan sorğu:** cüzdan bu gündən təsdiq ekranında ayrıca xəbərdarlıq göstərir ("Bu yoxlayan tərəf qeydiyyat sertifikatı
  göndərmədi") və defolt seçim **"Paylaşmayın"** olur; şəxs yenə də paylaşa bilər. Etibar siyahısının yoxlanması dəyişmir.
- **2028-08-11-dən sonra** qeydiyyat sertifikatı olmayan sorğu **rədd edilir** (İcra Reqlamenti (Aİ) 2026/1731-in cüzdanda qeydiyyat
  sertifikatının yoxlanmasını icbari etdiyi tarix). Tarix kodda sabitdir; parametrlə dəyişdirilmir.
- **Yaxın məsafə (ISO/IEC 18013-5):** mdoc sorğusunda qeydiyyat sertifikatı `requestInfo.euWrprc` ilə gəlir. Cüzdan onu məsafədən axındakı
  1–4-cü addımlarla yoxlayır; 3-cü addımdakı əlaqə oxuyucunun autentifikasiya sertifikatı ilə qurulur. Yaxın məsafədə də xəbərdarlıq və
  2028-08-11 qaydası eynidir. Yoxlayan tərəfdə `euWrprc` göndərilməsi və cüzdanda oxunması paketlərin 0.6.0 versiyasındadır.
- Xəbərdarlıq və defolt "Paylaşmayın" paketlərin 0.6.0 versiyasındadır (`wallet-core`); rədd tarixi eyni versiyada koddadır.

# Dəyişiklik — 2026-10-19 ([[ADR-0056]])

K5-in 2026-10-13 dəyişikliyindəki keçid dövrü aradan qaldırıldı: qeydiyyat sertifikatı olmayan sorğu (məsafədən və yaxın məsafədə) **bu gündən rədd edilir**;
rəqəmsal cüzdan şəxsdən soruşmadan dayanır. 2028-08-11 tarixi və xəbərdarlıq + "Paylaşmayın" yolu yoxdur. Cüzdandan cüzdana yaxın məsafə dəyişmir. İlkin şərt:
fəal yoxlayan tərəflərin qeydlərinə identifikasiya nömrəsi daxil edilir və naşir hər istifadə halı üçün qeydiyyat sertifikatı yaradır (K4).

# Status

**Accepted — 2026-09-29.** Layihə rəhbərliyinin təsdiqi ilə (H1 planı, P2). DECISIONS: D-REG-2.

> **Dəyişiklik (2026-10-13):** K4 və K5 yuxarıdakı "Dəyişiklik" bölməsinə uyğun dəyişdi (hər sorğuya bir qeydiyyat sertifikatı,
> `credential_ids` və `registrar_dataset` yoxdur; sertifikatsız sorğuda xəbərdarlıq + "Paylaşmayın", 2028-08-11-dən sonra rədd; yaxın məsafədə
> `euWrprc`). Layihə rəhbərliyinin təsdiqi ilə (Aİ ilə uyğunluq üzrə ilk mərhələ, qərar 14).

> **Dəyişiklik (2026-10-19):** K5-in 2028-08-11-ə qədər olan xəbərdarlıq keçidi aradan qaldırıldı; sertifikatsız sorğu bu gündən rədd edilir
> ([[ADR-0056]] K10, D-API-3). Layihə rəhbərliyinin təsdiqi ilə (təhlükəsizlik mərhələsi 2026-10-19).
