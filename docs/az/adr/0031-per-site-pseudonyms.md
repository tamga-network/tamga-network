---
document_id: ADR-0031
title: "Sayt üzrə psevdonim"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-02
summary: >
  "Tamga ilə daxil ol" sayta şəxsiyyət sənədinin xülasəsini (document_number_hash) göndərmir. Rəqəmsal cüzdan hər sayt üçün ayrı, lakin sabit psevdonim açarı törədir; sayt şəxsi bu açarla tanıyır, iki sayt eyni şəxsi uyğunlaşdıra bilmir. Psevdonim toxumu şəxsiyyət xidmətində şəxsin dəyişməz şəxsiyyətindən deterministik şəkildə törədilir; yeni telefonda şəxsiyyəti yoxlayan tərəf onu yenidən təsdiqlədikdə eyni psevdonimlər geri qayıdır və bir şəxs bir saytda yalnız bir hesab açır. S-17-ni bağlayır; ARF Topic 11 (PA_01–PA_19) qarşılanır.
domain: Identity
translation_of: ADR-0031
source_version: "1.0.0"
---

# Xülasə (sadə)

1. Bu qərardan əvvəl "Tamga ilə qeydiyyatdan keç" hər sayta **eyni** hesab dəyərini göndərirdi; iki sayt razılaşsaydı, bunun eyni şəxs olduğunu
   anlayardı.
2. Qərar: rəqəmsal cüzdan hər sayta **ayrı** psevdonim açarı verir. Sayt Sizi həmişə tanıyır; iki sayt Sizi uyğunlaşdıra bilmir.
3. Psevdonimlər şəxsiyyətinizdən törədilir: yeni telefonda şəxsiyyətinizi yoxlayan tərəf onu yenidən təsdiqlədikdə eyni psevdonimlər geri qayıdır, hesablarınız itmir.
4. Bir şəxs bir saytda yalnız bir hesab aça bilər (saxta çoxsaylı hesablara qarşı maneə); sayt istəsə, birdən çox psevdonimə icazə verə bilər.
5. Bədəli: Tamga-nın şəxsiyyət xidməti nəzəri olaraq şəxsin psevdonimini hesablaya bilər; biz bunu açarın qorunması və auditlə
   məhdudlaşdırırıq, gələcəkdə isə sıfır bilik sübutu (Z5) ilə aradan qaldıracağıq.

# Kontekst

- **S-17:** nümunə saytda (`verify…/demo-site`) qeydiyyat və bərpa zamanı şəxsiyyət sənədindəki `document_number_hash` sayta gedirdi;
  sayt xam dəyəri saxlamır, `HMAC(siteSırrı, hash)` saxlayırdı; gündəlik giriş passkey ilə həyata keçirilirdi. Lakin qeydiyyatda **eyni dəyər hər
  sayta** gedirdi → saytlararası əlaqələndirilə bilənlik. Nüsxə ayrımı (WL5) bunu bağlamır; dəyər [[t:credential|sənədin]] içindədir, hər
  nüsxədə eynidir.
- **Dəyər sabit də deyil:** `document_number_hash = HMAC(docHashKey, ülke:belge türü:belge no)` (şəxsiyyət xidməti,
  `apps/id` `routes/idv.ts`). Şəxs şəxsiyyət vəsiqəsini yenilədikdə sənəd nömrəsi dəyişir → hesab açarı dəyişir → sayt şəxsi
  tanımır.
- **[[t:ARF]] Topic 11 (PA_01–PA_19):** rəqəmsal cüzdan [[t:pseudonym]] yaradır, sayta qeydiyyatdan keçirir, onunla daxil olur; psevdonim sayt üzrə
  unikaldır (CIR 2024/2979 mad. 14(2)), saytdan real şəxsiyyət törədilə bilməz (PA_16), müxtəlif saytlara eyni psevdonim verilmir
  (PA_17), [[t:wallet-provider]] əlaqələndirilməzliyi təmin edən üsuldan istifadə edir (PA_18), istifadəçi psevdonimlərini görür, adlandırır,
  silir (PA_05–PA_10), sayt psevdonimin istifadəçiyə məxsus olduğunu və ləğv edilməmiş cüzdandan gəldiyini yoxlayır
  (PA_11–PA_14). Aİ boşluq təhlilində (H1) bu 19 bəndin hamısı "çatışmır" kimi qeyd olunub.
- **Məhdudiyyətlər:** şəxsiyyət xidməti sənədi verdikdən sonra şəxsi məlumatları saxlamır (IDP9); köçürmə faylı və ehtiyat nüsxə açar daşımır
  ([[ADR-0027]] LX2, WL2); vasitəçi [[t:verifier|yoxlayan tərəfdə]] cüzdan əsl [[t:RP|RP-ni]] tanıyır ([[ADR-0017]] K7); inkişaf mərhələsində geriyə
  uyğunluq yazılmır ([[ADR-0029]]).

# Variantlar

| # | Üsul | Əlaqələndirilməzlik | Yeni telefon / yenidən quraşdırma | Şəxs başına bir hesab | Tamga əlaqələndirə bilərmi | Nəticə |
|---|---|---|---|---|---|---|
| A | **Cüzdanın təsadüfi əsas sirri** → sayt üzrə açar | tam | ❌ itir (LX2/WL2: sirr köçürmə faylına daxil ola bilməz) | ❌ yenidən quraşdırmada yeni psevdonim | xeyr | rədd — hesablar telefonla birlikdə itir |
| B | **Passkey = psevdonim** (ARF "verifiable psevdonim") | tam | platforma sinxronizasiyasından asılıdır (iCloud/Google) | ❌ | xeyr | tamamlayıcı — gündəlik giriş üçün qalır, şəxsiyyət daşımır |
| C | **Sənədi verən qurum sayt üzrə identifikator yaradır** | tam (saytlararası) | ✅ | ✅ | **bəli, həm də saytı öyrənir** | rədd — şəxsiyyət xidməti hansı sayta daxil olduğunuzu öyrənir (izləmə) |
| D | **Şəxsiyyətdən törədilən toxum** (şəxsiyyət xidməti) → cüzdanda sayt üzrə açar | tam (saytlararası) | ✅ şəxsiyyət yenidən təsdiqləndikdə eyni | ✅ (orijinal cüzdan fərziyyəsi ilə) | yalnız açarı + şəxsin şəxsiyyət nömrəsini birlikdə istifadə edərsə | **qəbul** |
| E | **Sıfır bilik sübutlu "nullifier"** (Z5) | tam | ✅ | ✅ və **sübutlu** | xeyr (törətmə sübutla yoxlanılır) | hədəf — Z5 ilə D-nin yerini alır |

**Niyə D?** A telefon dəyişdikdə bütün hesabları silir (açar köçürmək LX2-ni pozur). C izləmə yaradır. E düzgün uzunmüddətli
həlldir, lakin mağaza tətbiqi və [[t:ZK]] kitabxanası tələb edir (Z5). D bu gün həyata keçirilə bilər, sabitdir, şəxsi məlumatların saxlanmasını tələb etmir və E-yə
keçiddə sayt tərəfi dəyişmir (sayt yenə "psevdonim açarı + imza" görür).

# Qərar

## K1 — Psevdonim toxumu (şəxsiyyət xidməti)
- Şəxsiyyət xidməti şəxsiyyət sənədini verərkən şəxsin **dəyişməz** şəxsiyyətindən toxum törədir:
  `seed = HMAC-SHA256(pseudonymKey, "tamga-pseudonym-v1|" + ülke + "|" + kişisel kimlik numarası)`.
  Türkiyə üçün giriş T.C. şəxsiyyət nömrəsidir (kart yenilənsə də dəyişmir). Fərdi şəxsiyyət nömrəsi olmayan sənədlərdə giriş
  `ülke|belge türü|belge no` olur (sənəd yenilənəndə psevdonimlər dəyişir — məlum məhdudiyyət, §Qərara bağlanan suallar).
- `pseudonymKey` `docHashKey`-dən **ayrı** açardır; yalnız şəxsiyyət xidmətindədir; pilotda KMS/HSM. Toxum **saxlanılmır**
  (IDP9): şəxsiyyət xidməti yoxlayan tərəf kimi hər yoxlamada onu eyni girişdən yenidən hesablayır.
- Toxum rəqəmsal cüzdana **yalnız cüzdanın saxlayacağı, heç vaxt təqdim edilməyən** ayrı rəqəmsal sənəd növü ilə ötürülür
  (`urn:tamga:id:PseudonymSeed:1`). Bu növ [[t:trust-list|etibar siyahısında]] heç bir RP əhatəsinə yazıla bilməz (AP6 onu onsuz da rədd edir); rəqəmsal cüzdan onu
  təqdimat ekranında heç vaxt göstərmir. Şəxsiyyət sənədinin içinə qoyulmur: şəxsiyyət sənədinin hər hansı sahəsi təsadüfən açıqlana bilər,
  ayrı növ isə açıqlana bilməz.

## K2 — Sayt üzrə psevdonim (cüzdan)
- Sayt identifikatoru = etibar siyahısındakı **qeydiyyatlı RP identifikatoru**; vasitəçi yoxlayan tərəfdə əsl RP-ninki ([[ADR-0017]] K7). Praktikada RP
  qeydiyyatının daimi identifikatoru `dns_name` ([[ADR-0034]]; `client_id` [[t:x509_hash]] kimi sertifikatdan törədildiyi üçün istifadə olunmur).
- `k = HKDF-SHA256(seed, info = "tamga-pseudonym-v1|" + site + "|" + sıra)` → P-256 gizli açar (hash_to_field, mod n).
  **Psevdonim** = açıq açarın JWK barmaq izi (RFC 7638). Sıra 0 = saytın standart (yeganə) psevdonimi.
- Toxum cüzdanda təhlükəsiz yaddaşda saxlanılır (Keychain / Keystore; mağaza versiyasında aparat səviyyəsində qorunan), istifadə anında PIN/biometriyadan
  sonra törədilir; törədilən açar daimi saxlanılmır.

## K3 — Sayta nə göndərilir
| Axın | Sayt alır | Sayt ALMIR |
|---|---|---|
| **Qeydiyyat** | psevdonimin açıq açarı + imza (`aud` = sayt, `nonce`) + WIA (ləğv edilməmiş rəqəmsal cüzdan — PA_11) + siyasətdə tələb olunan sahələr (məs., ad, soyad) | `document_number_hash`, şəxsiyyət nömrəsi |
| **Daxil olma** | psevdonim imzası + WIA; heç bir rəqəmsal sənəd sahəsi | heç bir fərdi sahə |
| **Bərpa / yeni telefon** | eyni psevdonim (yoxlayan tərəf şəxsiyyəti yenidən təsdiqlədikdə toxum eyni alınır) | rəqəmsal sənəd dəyəri |
| **Gündəlik daxil olma (kompüter)** | saytın öz passkey-i (dəyişmir) | — |

- Təqdimatda psevdonim ayrıca `vp_token` girişi kimi ötürülür: psevdonim açarı ilə imzalanmış qısa JWT
  (`typ: tamga-pseudonym+jwt`; `aud`, [[t:nonce]], `rp_id`, `cnf` = psevdonimin açıq açarı) + [[t:WIA]]. Yoxlayan tərəf imzanı,
  `aud`/`nonce` uyğunluğunu və WIA-nı yoxlayır (PA_13, PA_14).
- `document_number_hash` saytlara standart olaraq **getmir**: `site-signup` / `site-signin` siyasətlərində yoxdur. Şəxsiyyət
  sənədində qalır (qurumun qeydiyyat uyğunlaşdırması üçün); RP onu yalnız qeydiyyatındakı əhatə onu açıq şəkildə ehtiva etdikdə tələb edir
  ([[ADR-0024]]).

## K4 — Bir hesab, yoxsa çoxlu psevdonim
- Standart: sayt üzrə **bir** psevdonim (sıra 0) → bir şəxs bir saytda bir hesab.
- RP qeydiyyatına bir sahə: `pseudonyms: "single" | "multiple"` ([[ADR-0024]] əhatə verilənləri). `multiple` deyən saytda istifadəçi
  yeni psevdonim aça bilər (sıra 1, 2…; PA_04), psevdonimini adlandırır və seçir (PA_05, PA_06).
- "Bir hesab" orijinal cüzdan fərziyyəsinə əsaslanır: dəyişdirilmiş cüzdan başqa sıra təqdim edə bilər. WIA/cihaz sübutu bunu
  məhdudlaşdırır; qəti sübut E (Z5) ilə gəlir. Bu məhdudiyyət sayta qeydiyyat bələdçisində açıq yazılır.

## K5 — Cüzdan ekranı
Parametrlər → **Psevdonimlərim**: sayt adı (qeydiyyatlı ad), yaradılma tarixi, istifadəçinin verdiyi ad (sayta getmir — PA_19),
sil (PA_07; silinən psevdonim həmin saytda bir daha törədilmir, yenidən qeydiyyat yeni sıra açır). Qeydiyyat və giriş jurnala yazılır
(PA_08a, TS10 jurnalı; psevdonimin dəyəri deyil, sayt adı və hadisə).

# Əsaslandırma / alternativlər

- **Əlaqələndirilməzlik:** iki sayt fərqli `rp_id` görür → fərqli HKDF çıxışı → fərqli açar. Psevdonimlərdən toxum və ya şəxsiyyət
  bərpa edilə bilməz (HKDF/HMAC birtərəflidir; PA_16).
- **Sabitlik:** toxum şəxsin dəyişməyən şəxsiyyətindən törədildiyi üçün yeni telefonda, yenidən quraşdırmada və vəsiqə yeniləndikdə eyni
  qalır; köçürmə faylına açar qoymaq lazım deyil (LX2 qorunur).
- **Məlum zəiflik (açıq yazılır):** `pseudonymKey`-ə və şəxsin şəxsiyyət nömrəsinə sahib olan biri (məs., şəxsiyyət xidmətini
  idarə edən, bir saytla əməkdaşlıq edərək) həmin şəxsin həmin saytdakı psevdonimini hesablaya bilər. Tədbirlər: açar KMS/HSM-də, giriş
  qeydi, şəffaflıq hesabatında açarın istifadə sayı, açar dövlətə ([[t:PID]] provayderinə) verilə bilər; daimi həll E (Z5).
  Bu qərardan əvvəlki vəziyyət (A variantı istisna olmaqla hər üsuldan) daha pis idi: **hər sayt** hər kəsi uyğunlaşdıra bilirdi.

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| PS1 | Rəqəmsal cüzdan sayta yalnız həmin saytın qeydiyyatdakı `rp_id`-sindən törədilən psevdonimi təqdim edir; müxtəlif saytlara eyni psevdonim göndərilmir. |
| PS2 | Psevdonim toxumu şəxsiyyət xidmətində saxlanılmır; şəxsiyyət xidməti yoxlayan tərəf kimi onu hər yoxlamada ayrıca açarla (`pseudonymKey`) yenidən törədir. |
| PS3 | Toxum daşıyan rəqəmsal sənəd növü heç bir RP-yə təqdim edilmir; etibar siyahısında heç bir əhatədə yer ala bilməz. |
| PS4 | `site-signup` / `site-signin` və oxşar daxil olma siyasətləri `document_number_hash` və ya şəxsiyyət nömrəsi tələb etmir. |
| PS5 | Psevdonim təqdimatı psevdonim açarı ilə imzalanır (`aud` = sayt, `nonce`) və ləğv edilməmiş wallet unit sübutunu daşıyır. |
| PS6 | İstifadəçinin psevdonimə verdiyi ad sayta göndərilmir. |

# Tətbiq planı

| Addım | Harada | İş |
|---|---|---|
| 1 | `apps/id` (operator deposu) | `pseudonymKey` (konfiqurasiya), toxumun törədilməsi, ayrıca növün verilməsi; testlər (eyni şəxsiyyət → eyni toxum; fərqli → fərqli). |
| 2 | `packages/schemas` | toxum növünün sxemi (tək sahə, `sd` yoxdur, təqdim edilə bilməz kimi işarələnib); kataloq. |
| 3 | `packages/wallet-core` | `pseudonym.ts`: HKDF ilə törətmə, P-256 açarı, `tamga-pseudonym+jwt`; təqdimatda ayrıca `vp_token` girişi; psevdonimlərin siyahısı/silinməsi; jurnal. |
| 4 | `packages/verifier` (+ `/web`) | psevdonim JWT-nin yoxlanması (imza, aud, nonce, WIA); siyasət sahəsi `pseudonym: { mode }`; sayt dəsti `pseudonym` nəticəsini qaytarır. |
| 5 | `apps/verify` | `site-signup`/`site-signin` siyasətləri: `document_number_hash` yoxdur, psevdonim var; nümunə saytın hesab açarı = psevdonim. |
| 6 | `apps/trust-publisher` registry | RP əhatəsinə `pseudonyms: single|multiple`. |
| 7 | Tamga Wallet (ayrıca depo) | təsdiq ekranında "yeni psevdonim / mövcud"; Parametrlər → Psevdonimlərim (üç dildə). |
| 8 | Sənədlər | SPEC-WALLET-0001, SPEC-API-0001, GUIDE-0001, FW-RB-0001, FW-RB-0003 (Identity Rulebook), 09-DEMO-KURGU S-17-nin bağlanması, saytda `/shortcuts` S-17 və `/docs/login-with-tamga`. |

Təxmini iş həcmi: 1–7 təxminən 4–5 iş günü (testlərlə birlikdə). Proqram yolu Expo Go-da işləyir; toxumun aparat səviyyəsində qorunan saxlanması mağaza
yığımı (Z1) ilə gəlir. İnkişaf mərhələsində hesablar və siyasətlər yerində düzəldilir, miqrasiya kodu yazılmır ([[ADR-0029]]);
nümunə saytın hesabları yaddaşda saxlanılır.

# Qərara alınmış suallar (layihənin idarə edilməsi, 2026-10-01)

1. **D qəbul edildi** (şəxsiyyətdən törəyən toxum; "məlum zəifləmə" yazılı məhdudiyyət kimi qalır).
2. **Toxum növünün adı:** `urn:tamga:id:PseudonymSeed:1`.
3. **Şəxsiyyət nömrəsi olmayan rəqəmsal sənədlər:** rəqəmsal sənəd yeniləndikdə psevdonimlər dəyişir; məhdudiyyət kimi qeyd olunur.
4. **Vaxt:** indi, proqram yolu ilə; toxumun aparat səviyyəsində qorunan saxlanması mağaza yığımı (Z1) ilə.

# Status

**Accepted — 2026-10-01** (layihə rəhbərliyinin təsdiqi). Tətbiq: yuxarıdakı plan; S-17 bu ADR-in tətbiqi ilə bağlandı.
