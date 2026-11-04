---
document_id: ADR-0075
title: "Yoxlayıcının domen adı kimliyinin sahibliyi və ləğvdən sonra yenidən qeydiyyat"
status: Proposed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  ADR-0073 K4 yoxlayıcı kimliyini `rpId = keccak256(dns_name)` etdi. Kontraktda bu kimlik onu ilk qeydə alan dövlətə məxsusdur;
  başqa bir dövlət domen adı özünə məxsus olmayan yoxlayıcını əvvəlcə qeydə alaraq kimliyi ələ keçirə bilər, ləğv edilmiş kimlik
  isə bir daha heç vaxt qeydə alına bilməz. Təklif: (a) Governance-in növü müəyyən mübahisə / ötürmə təklifi ilə (2/3) kimliyin
  sahibi dəyişdirilir; ləğvdən sonra yenidən qeydiyyat yalnız Governance səsverməsi ilə açılır. Alternativ (b): domen sahibliyinin
  zəncirdən kənarda DNS sübutu ilə yoxlanması + Governance təsdiqi. Tövsiyə olunan (a).
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0034]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[SPEC-BC-0001]]"]
translation_of: ADR-0075
source_version: 1.0.0
---

# Qısaca

Yoxlayıcının şəbəkədəki kimliyi artıq domen adından törədilir. Kontrakt bu gün bu kimliyi "ilk gələn alır" qaydası ilə verir: bir
dövlət başqa ölkədəki qurumun domen adını əvvəlcə qeydə alsa, həmin qurum öz domen adı ilə qeydiyyatdan keçə bilməz. Bundan
əlavə, yoxlayıcı bir dəfə ləğv edilərsə, eyni domen adı bir daha heç vaxt qeydə alına bilmir. Bu təklif hər iki hal üçün çıxış yolu
müəyyən edir: mübahisədə və ləğvdən sonra qərar şəbəkənin ümumi səsverməsinə (2/3) verilir.

# Kontekst

- [[ADR-0073]] K4 / CE4: yoxlayıcının zəncir və siyahı kimliyi `keccak256(dns_name)`-dir; giriş sertifikatı yeniləndikdə dəyişmir.
  Kontrakt dövlət kodunu suverenlik üçün ayrıca saxlayır.
- 2026-11-04 kontrakt təhlükəsizlik turu (ORTA, qərar tələb olunur): `RelyingPartyRegistry.registerRelyingParty` kimliyi çağıran
  dövlətin nümayəndə açarı ilə və **ilk qeydiyyat** qaydası ilə yazır. Kontrakt domen adının həmin dövlətə məxsus olduğunu bilə
  bilməz (ABI-də domen adı mətni yoxdur, [[ADR-0074]] PJ2). Nəticələr:
  - **Ələ keçirmə:** A dövləti B dövlətindəki qurumun domen adından törədilən kimliyi əvvəlcə qeydə ala bilər; B-nin qeydiyyatı
    `RPExists` ilə rədd edilir. Suverenlik qaydası ([[SPEC-BC-0001]]/N1) yalnız "öz dövlət kodunla yaz" deyir; kimliyin hansı
    dövlətə düşdüyünü demir.
  - **Daimi ləğv:** `REVOKED` qətidir (K4); qeyd silinmir, eyni kimlik bir daha qeydə alına bilməz. Domen adı sahib dəyişərsə və ya
    ləğv səhvən edilərsə, həmin domen adı ilə şəbəkədə yoxlayıcı olmaq mümkünsüzləşir.
- Bu gün qeydiyyat qurumu domen sahibliyini öz qeydiyyat prosesində yoxlayır ([[ADR-0024]], [[ADR-0026]]); zəncirdə bunun qarşılığı və
  mübahisə yolu yoxdur. Qayda dəyişmədən kod dəyişmir; bu ADR həmin qaydanı təklif edir.

# Seçimlər

| Seçim | Nə | Üstünlük | Çatışmazlıq |
|---|---|---|---|
| **(a) Governance mübahisə / ötürmə təklifi** | Governance-in növü müəyyən təklifi ([[ADR-0055]] GE3, 2/3) yoxlayıcı kimliyinin sahibi olan dövləti dəyişir (ələ keçirmə) və ya ləğv edilmiş kimliyi yenidən qeydiyyata açır. Köhnə qeyd və tarixçəsi silinmir; yeni qeyd yeni dövr kimi əlavə olunur. Əhatədən kənar: kimliyin özü və düsturu (CE4) dəyişmir. | Mövcud etibar modeli (dövlətlər arası 2/3) daxilində qalır; zəncirdən kənar asılılıq yoxdur; tək dövlət təkbaşına kimliyi ələ keçirə və ya geri ala bilməz | Hər mübahisə bir səsvermə turudur; sübutun qiymətləndirilməsi üzvlərə qalır |
| **(b) DNS sübutu + Governance təsdiqi** | Qeydiyyat (və ya ötürmə) müraciətində domen sahibliyi zəncirdən kənarda DNS sübutu ilə (məs. domendə dərc olunan təsdiq qeydi) yoxlanır; Governance sübuta əsasən təsdiqləyir | Sahiblik obyektiv sübuta əsaslanır | Sübut zəncirdən kənardadır; yoxlamanın özü operatordan və alətdən asılıdır; DNS müvəqqəti ələ keçirilə bilər; yenə Governance təsdiqi lazımdır |
| Heç nə etməmək | "İlk gələn alır" və daimi ləğv davam edir | Kod dəyişmir | Ələ keçirmə və daimi kilid həll olunmamış qalır |

# Tövsiyə

**(a).** Əsaslandırma: kimliyin hansı dövlətə düşəcəyi şəbəkə səviyyəli qərardır və şəbəkənin ümumi qapısı Governance-dir
([[ADR-0002]]); DNS sübutu (b) səsverməni asanlaşdıran sənəd kimi təklifə əlavə oluna bilər, lakin təkbaşına kifayət deyil.
Təklif olunan qaydalar:

1. Yoxlayıcı kimliyinin sahibi olan dövlət yalnız Governance-in növü müəyyən təklifi ilə (2/3) dəyişir; təklif kimliyi, köhnə və yeni
   dövlət kodunu və əsaslandırma xülasəsini daşıyır (sərbəst mətn yoxdur, [[ADR-0074]] PJ2).
2. `REVOKED` yoxlayıcı qeydi üçün qəti qalır; eyni kimliyin **yenidən qeydiyyatı** yalnız Governance səsverməsi ilə açılır və yeni
   qeydiyyat dövrü başladır. Ləğv edilmiş dövrün tarixçəsi və hadisələri qorunur.
3. Ötürmə və ya yenidən qeydiyyat imzalanmış siyahıya da eyni qayda ilə yazılır (zəncir–siyahı ekvivalentliyi, [[ADR-0073]] CE6).
4. Funksiya, təklif və hadisə adları qəbul zamanı təsdiqlənir.

# Nəticələr (qəbul edilərsə)

- `RelyingPartyRegistry` və `Governance`: yeni növü müəyyən təklif və yalnız Governance-in çağıra bildiyi ötürmə / yenidən qeydiyyat
  yolu; qeydiyyat dövrü sayğacı; yaddaş düzülüşünə yalnız sona əlavə.
- [[SPEC-BC-0001]] §6 və §16; siyahı dərcçisinin qeydiyyat aləti və `TrustSource` ekvivalentlik testi.
- Qəbul edilənə qədər kontraktın davranışı dəyişmir; qeydiyyat qurumu domen sahibliyini qeydiyyatdan əvvəl yoxlamağa davam edir.

# Status

**Proposed — 2026-11-04.** Layihə rəhbərliyinin qərarını gözləyir (2026-11-04 kontrakt təhlükəsizlik turunun tapıntısı).
