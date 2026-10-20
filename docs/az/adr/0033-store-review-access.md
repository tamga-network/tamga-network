---
document_id: ADR-0033
title: "Mağaza baxışı kodu"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-06
summary: >
  Apple və Google rəyçiləri etibar siyahısındakı rəqəmsal cüzdanın şəxsiyyət axınını real Türkiyə şəxsiyyət sənədi olmadan sınaya bilməlidir. Baxış kodu şəbəkənin xidmətidir və siyahıdakı hər rəqəmsal cüzdan üçün eyni şərtlərlə açıqdır. Qərar: müddətli, birdəfəlik baxış kodu; kod daxil edildikdə şəxsiyyət xidməti yalnız həmin sessiya üçün saxta doğrulama provayderindən istifadə edir və ayrıca sınaq imzalayıcısı ilə real yoxlayan tərəflərin heç bir siyasətində keçərli olmayan sınaq şəxsiyyət sənədi verir. Şəxsiyyət tələb etməyən yollar (bilet, Tamga Verify, "Tamga ilə daxil ol") kodsuz sınanır.
domain: Services
translation_of: ADR-0033
source_version: "1.0.0"
---

# Xülasə (sadə)

Mağaza rəyçisi tətbiqi açdıqda şəxsiyyətin doğrulanması addımında real Türkiyə şəxsiyyət vəsiqəsi və üz skanı tələb olunur; rəyçidə
bunlar yoxdur və tətbiq "sınamaq mümkün olmadı" səbəbi ilə rədd edilir (şəxsiyyət tətbiqlərində ən çox rast gəlinən rədd səbəbi). Qərar: baxış qeydinə yazılan, qısa
müddətli və **birdəfəlik kod**. Kod daxil edildikdə şəxsiyyət xidməti real provayder əvəzinə saxta (demo) doğrulamadan yalnız həmin sessiya
üçün istifadə edir və **"DEMO" işarəli, heç bir real yoxlayan tərəfin qəbul etmədiyi** sınaq sənədi verir. Real istifadəçilər bu
yolu görmür; kod bir dəfə istifadə edildikdən sonra qüvvədən düşür.

# Kontekst

- Apple App Review və Google Play baxışı tətbiqin bütün axınlarının sınana bilməsini tələb edir; lazım gəldikdə baxış qeydində
  sınaq hesabı və ya "demo rejimi" təqdim olunur.
- Rəqəmsal cüzdanın şəxsiyyət axını ([[SPEC-ID-0003]] §9) real şəxsiyyət sənədi + canlılıq yoxlaması + üz uyğunlaşdırması tələb edir;
  bu, [[t:identity-proofing]] addımıdır. Canlı mühitdə saxta provayder bağlıdır (`TAMGA_IDV_DIDIT_FAKE` yalnız açıq şəkildə aktivləşdirildikdə; GT1: canlı mühitdə real
  şəxsiyyət yoxlaması ötürülmür).
- Şəxsiyyət tələb etməyən axınlar kodsuz sınana bilər: bilet alınması və girişdə təqdim edilməsi, Tamga Verify nümunə siyasətləri, "Tamga ilə
  daxil ol" nümunə saytı ([[t:pseudonym]] yalnız şəxsiyyət [[t:credential]] toxumu ilə işlədiyi üçün o da şəxsiyyət axınından
  asılıdır — §K4).
- Real istifadəçiyə təsir etməyən, sui-istifadə edilə bilməyən və izlənilə bilən yol lazımdır.

# Variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| A. Baxış qeydində yalnız şəxsiyyətsiz yollar | kifayət deyil | Şəxsiyyət axını tətbiqin əsas yoludur; rəyçi sınaya bilməsə, rədd riski yüksəkdir. |
| B. Tətbiqdə daimi "demo rejimi" (saxta sənədlər cihazda) | rədd | Real istifadəçi də aktivləşdirə bilər; saxta sənədlərin real kimi görünməsi riski; mağaza bunu "gizli funksiya" saya bilər. |
| C. Əvvəlcədən hazırlanmış sınaq rəqəmsal cüzdanı / cihaz | tətbiq edilə bilməz | Rəyçi tətbiqi öz cihazında quraşdırır; açarlar cihaza bağlıdır (WL1). |
| **D. Müddətli, birdəfəlik baxış kodu → saxta provayder + ayrıca sınaq imzalayıcısı** | **qəbul** | Yalnız kodu bilən istifadə edir; sənəd real ekosistemdə keçərli deyil; hər istifadə qeydə alınır. |

# Qərar

## K1 — Kod
- Operator kodu serverdə yaradır (`ops` skripti; konsoldan deyil): təsadüfi, ən azı 128 bit, oxunaqlı formatda (məs., 4×5 simvol).
- Yalnız kodun heşi saxlanılır (HMAC, xidmət açarı ilə); açıq kod saxlanılmır və jurnala yazılmır.
- Etibarlılıq: ən çoxu 14 gün; **birdəfəlik** (ilk uğurlu şəxsiyyət axınında qüvvədən düşür); eyni vaxtda ən çoxu 3 aktiv kod.
- Kod mağaza baxışı qeydinə yazılır; başqa yerdə paylaşılmır.

## K2 — Kodun təsiri (yalnız həmin sessiya)
- Rəqəmsal cüzdanda şəxsiyyət axınının əvvəlində "Baxış kodum var" keçidi **göstərilmir**; kod `/authorize` səhifəsindəki KVKK məlumatlandırma
  ekranında kiçik "Baxış kodu" sahəsinə daxil edilir (real istifadəçi axını dəyişmir).
- Etibarlı kodla şəxsiyyət xidməti həmin [[t:PAR]] üçün saxta provayderdən istifadə edir (`FakeIdvProvider`; hazır sınaq şəxsləri); real
  provayderə heç bir sorğu getmir.

## K3 — Sınaq sənədi real ekosistemdə keçərli deyil
- Sənəd şəxsiyyət xidmətinin real açarı ilə **deyil**, ayrıca sınaq imzalayıcısı ilə imzalanır. Sınaq imzalayıcısı
  [[t:trust-list|etibar siyahısında]] ayrıca `DEMO` qeydi kimi yer alır; onu yalnız Tamga Verify-dakı "baxış" siyasətləri qəbul edir.
- Sənəddə `verification_method: "review-demo"`; ad sahələri açıq şəkildə "DEMO" ehtiva edir; `exp` ən çoxu 7 gün.
- [[t:issuer|Sənədi verən qurumlar]] (universitet və s.) sınaq imzalayıcısının sənədini şəxsiyyət uyğunlaşdırmasında **qəbul etmir** (etibar siyahısı
  siyasəti).
- Psevdonim toxumu sınaq imzalayıcısı ilə və sınaq açarından törədilir; real toxumlarla üst-üstə düşmür.

## K4 — Baxış aparan şəxsin sınaya bildikləri
Kodla: şəxsiyyətin təsdiqi → şəxsiyyət rəqəmsal sənədi → "Tamga ilə daxil ol" nümunə saytı (psevdonim) → Tamga Verify "18 yaşdan yuxarı" nümunəsi →
rəqəmsal cüzdanı sıfırla və məlumatlarımı sil. Kodsuz: bilet alışı və girişdə təqdim etmə, yoxlayan tərəfin siyasətləri səhifəsi.

## K5 — İz
Hər kod istifadəsi hadisələr jurnalına yazılır (`review_code.used`; kodun heşi deyil, kodun identifikatoru); sınaq sənədləri ayrıca sayılır və
şəffaflıq hesabatında "mağaza baxışı" kimi göstərilir.

# Əsaslandırma / alternativlər

Variantlar cədvəldədir. D real istifadəçi axınını dəyişmədən və real ekosistemə saxta sənəd sızdırmadan rəyçinin
bütün yolları sınamasına imkan verən yeganə variantdır. Bədəli: şəxsiyyət xidmətində ikinci imzalayıcı və etibar siyahısında bir `DEMO` qeydi.

# Risklər

| Risk | Tədbir |
|---|---|
| Kod sızır və başqası istifadə edir | birdəfəlik, müddətli, ən çoxu 3 aktiv; sınaq sənədi real yoxlayan tərəfdə keçərli deyil |
| Sınaq sənədi real hesab edilir | ayrıca imzalayıcı, `DEMO` işarəsi, rəqəmsal cüzdanda "DEMO" nişanı, 7 gün |
| Mağaza bunu "gizli funksiya" sayır | baxış qeydində açıq şəkildə izah edilir; kod sahəsi məlumatlandırma ekranında görünür, gizli deyil |
| Saxta provayder canlı mühitdə səhvən hamı üçün açılır | kod olmadan saxta provayderə keçid yolu yoxdur; `TAMGA_IDV_DIDIT_FAKE` canlı mühitdə bağlı qalır |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| RV1 | Baxış kodu yalnız heş şəklində saxlanılır, müddətli (≤ 14 gün) və birdəfəlikdir; jurnala açıq mətnlə yazılmır. |
| RV2 | Baxış kodu ilə verilən rəqəmsal sənəd şəxsiyyət xidmətinin real imzalayıcısı ilə imzalanmır və yalnız yoxlayan tərəfin baxış siyasətlərində keçərlidir. |
| RV3 | Baxış kodu olmadan canlı şəxsiyyət xidməti saxta təsdiqləmə provayderinə keçə bilməz. |

# Tətbiq planı

| Addım | Harada | İş |
|---|---|---|
| 1 | `apps/id` (operator deposu) | kod cədvəli (heş, bitmə vaxtı, istifadə edilib), `/authorize` kod sahəsi, hər PAR üçün provayder seçimi, sınaq imzalayıcısı |
| 2 | `ops` (operator deposu) | `review-code.ts` (yarat / siyahıla / ləğv et) |
| 3 | `tamga-network` etibar siyahısı | `DEMO` sınaq imzalayıcısı qeydi; sənədi verən qurumların uyğunlaşdırma siyasəti onu istisna edir |
| 4 | `apps/verify` | "baxış" siyasətləri (sınaq imzalayıcısını qəbul edən) |
| 5 | Rəqəmsal cüzdan (ilki Tamga Wallet; ayrıca depo) | "DEMO" nişanı (sənəd `verification_method: review-demo`) |
| 6 | Sənədlər | SPEC-ID-0003 §9, mağaza baxışı qeydi |

Təxmini iş həcmi: 2–3 gün (testlərlə birlikdə).

## İcra

- **Kod:** `apps/id/src/review.ts` (operator deposu) (26 simvol Crockford base32 = 130 bit; HMAC heşi, rəqəmsal sənəd heşi açarından
  HKDF ilə ayrıca alt açar; aktiv kodlar sabit müddətli müqayisə ilə yoxlanılır); cədvəl `review_codes`; operator aləti
  `ops/review-code.ts create | list | revoke` (operator deposu). Kod ilk uğurlu rəqəmsal sənəd vermə əməliyyatında istifadə olunub bitir; axın davam edərkən
  başqa sessiyaya verilmir. Limit: hər PAR üçün 5 səhv cəhd, xidmət üzrə 10 dəqiqədə 20 səhvdə 15 dəqiqəlik bloklama (IP yoxdur — G2);
  nginx `/authorize/consent` sürət limiti.
- **Axın:** `/authorize` məlumatlandırma səhifəsində bağlı "Baxış kodu" bölməsi; etibarlı kodla `/review-idv/{oturum}` (koda xas
  DEMO şəxs). Kodsuz axın və `/fake-idv` dəyişmir (RV3; canlı mühitdə `/fake-idv/` nginx-də bağlıdır).
- **İmzalayıcı:** `ops/pki/issuer-id-review` (dev PKI; sertifikat depoda, gizli açar `upload.ps1 -WithPki` ilə serverə). Etibar siyahısı
  qeydi `tamga-id-review` (IDENTITY, [[t:EAA]], **I1**; ləğv siyahısı açarı şəxsiyyət xidmətinindir) **gözləyən müraciət** kimi
  `apps/trust-publisher/registry/pending/`: [[ADR-0024]] yeni qeydlərdə qurumun identifikasiya nömrəsini və ünvanını məcburi etdiyi üçün
  Tamga-nın bu məlumatları daxil edildikdən sonra `register issuer` ilə əlavə olunur. O vaxta qədər baxış yolu "aktiv deyil" cavabını verir (503).
- **Yoxlayan tərəf:** Tamga Verify `review-age-over-18` və `review-site-signup` (I1); nümunə saytda "DEMO rəqəmsal sənədlə qeydiyyatdan keç". Yoxlayan tərəfin bütün real
  siyasətləri I2 tələb edir → DEMO rəqəmsal sənəd E1-də RƏDD (test: `packages/verifier/src/review-demo.test.ts`).
- **Sxem:** `verification_method` dəyərlərinə `review-demo` əlavə edildi (inkişaf mərhələsi, [[ADR-0029]]); FW-RB-0003 (Identity
  Rulebook) buna uyğun yazıldı.
- **Rəqəmsal cüzdan:** rəqəmsal sənədin təfərrüatlarında "DEMO — tətbiq baxışı rəqəmsal sənədi" kartı.

# Qərara alınmış suallar (layihənin idarə edilməsi, 2026-10-01)

1. D variantı **qəbul edilir**.
2. Kod sahəsi **şəxsiyyət xidmətinin məlumatlandırma (razılıq) səhifəsindədir**.
3. Sınaq sənədinin etibarlılıq müddəti **7 gün**.

# Status

**Accepted — 2026-10-01** (layihə rəhbərliyinin təsdiqi: hər üç sual qəbul edildi). İcra: yuxarıdakı plan.

# İcra qeydi — 2026-10-04: mağaza baxışı yalnız şəxsiyyət axınıdır

Real şəbəkədə test və demo məzmunu qalmır; hamısı sandbox-dadır ([[ADR-0038]]; layihə rəhbərliyinin təsdiqi, 2026-10-04). Buna görə
Kontekst və K4-dəki **kodsuz yollar** (bilet alınması və girişdə təqdim edilməsi, Tamga Verify sınaq siyasətləri səhifəsi, "Tamga ilə daxil
ol" nümunə saytı) real şəbəkədə artıq yoxdur və baxış qeydinə yazılmır; bunlar sandbox-da sınanır. Mağaza baxışı yalnız
şəxsiyyət axınıdır: baxış kodu → DEMO şəxsiyyət sənədi → Tamga Verify baxış siyasətləri (`review-age-over-18`,
`review-site-signup`). Baxış siyasətləri real şəbəkədə qalır, lakin Tamga Verify-ın əsas səhifəsində nümayiş üçün göstərilmir;
rəyçiyə birbaşa keçid verilir. Qərar (D variantı, K1–K3, K5, RV1–RV3) dəyişmir.
Həmin tarixdə saxta şəxsiyyət provayderi real şəbəkədə kod kilidi ilə tamamilə bağlandı (`TAMGA_IDV_DIDIT_FAKE=1` ilə xidmət açılmır);
baxış kodu yolu bundan asılı deyil.

# İcra qeydi — 2026-10-06: hər rəqəmsal cüzdan üçün açıq şəbəkə xidməti

Baxış kodu şəxsiyyət xidmətinin, yəni şəbəkənin xidmətidir; tək bir rəqəmsal cüzdana aid deyil ([[ADR-0042]] K6). Etibar siyahısında qeydiyyatda olan
hər cüzdan provayderi öz tətbiqinin mağaza baxışı üçün eyni şərtlərlə kod tələb edir: kod layihə rəhbərliyinin təsdiqi ilə
yaradılır və rəqəmsal cüzdana ötürülür, rəqəmsal cüzdan isə onu öz baxış qeydinə yazır. K1–K5 və RV1–RV3 hər rəqəmsal cüzdan üçün eynidir; sınaq rəqəmsal sənədi
hansı rəqəmsal cüzdana verilməsindən asılı olmayaraq yalnız baxış siyasətlərində keçərlidir. DEMO işarəsini göstərmək ([[SPEC-ID-0003]] §9) hər
rəqəmsal cüzdanın öz vəzifəsidir.
