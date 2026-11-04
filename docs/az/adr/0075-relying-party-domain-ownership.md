---
document_id: ADR-0075
title: "Yoxlayıcının domen adı kimliyinin sahibliyi və ləğvdən sonra yenidən qeydiyyat"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  ADR-0073 K4 yoxlayıcı kimliyini `rpId = keccak256(dns_name)` etdi. Kontraktda bu kimlik onu ilk qeydə alan dövlətə məxsusdur;
  başqa bir dövlət domen adı özünə məxsus olmayan yoxlayıcını əvvəlcə qeydə alaraq kimliyi ələ keçirə bilər, ləğv edilmiş kimlik
  isə bir daha heç vaxt qeydə alına bilməz. Təklif: (a) Governance-in növü müəyyən mübahisə / ötürmə təklifi ilə (2/3) kimliyin
  sahibi dəyişdirilir; ləğvdən sonra yenidən qeydiyyat yalnız Governance səsverməsi ilə açılır. Alternativ (b): domen sahibliyinin
  zəncirdən kənarda DNS sübutu ilə yoxlanması + Governance təsdiqi. Tövsiyə olunan (a). Qəbul edildi (2026-11-04): (a), tövsiyə
  edildiyi kimi; yeni dövr köhnə tarixçəni qoruyur, siyahı eyni qayda ilə yenilənir.
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

# Qərar (2026-11-04)

**(a) tövsiyə edildiyi kimi qəbul edildi.** Məcburi qaydalar aşağıdakı RO1–RO5; adlar cədvəldən sonra.

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| RO1 | Yoxlayıcı kimliyinin (`rpId = keccak256(dns_name)`) sahibi olan dövlət yalnız Governance-in növü müəyyən **ötürmə** təklifi ilə (2/3) dəyişir. Təklif əvvəlcə qeyddə sabitlənmiş məzmunun xülasəsini (`stageId`) daşıyır; məzmun kimliyi, köhnə və yeni dövlət kodunu, yeni dövrün ad xülasəsini və giriş sertifikatı barmaq izini, əsaslandırma xülasəsini ehtiva edir (sərbəst mətn yoxdur, [[ADR-0074]] PJ2). Ötürmə yalnız ləğv edilməmiş qeydə və başqa aktiv üzv dövlətə edilir. |
| RO2 | `REVOKED` dövr üçün qəti qalır. Eyni kimliyin **yenidən qeydiyyatı** yalnız Governance-in növü müəyyən yenidən qeydiyyat təklifi ilə (2/3) və yalnız ləğv edilmiş qeyddə açılır (eyni və ya başqa aktiv üzv dövlət). |
| RO3 | Ötürmə və yenidən qeydiyyat yeni **qeydiyyat dövrü** başladır (ACTIVE, icra anından). Qeyd silinmir; status tarixçəsi və dövr siyahısı yalnız əlavə olunur; köhnə dövrün hadisələri və qeydləri qorunur. Yeni dövr köhnə dövrün əhatələrini, qeydiyyat məlumatlarını və keçid qruplarını miras almır; köhnə dövrün açıq keçid qrupları bağlanır. `t` anı üzrə oxumalar (`relyingPartyAt`, `isRelyingPartyAcceptableAt`) həmin andakı dövrə görə cavab verir. |
| RO4 | Sabitləmədən sonra qeydə başqa dövr əlavə olunubsa, təklif köhnəlmişdir və yazılmır; təklifin növü sabitlənmiş məzmunun növü ilə eyni olmalıdır. |
| RO5 | İmzalanmış siyahıda da eyni qayda: `dns_name` statusundan asılı olmayaraq ikinci dəfə qeydə alınmır; sahiblik dəyişikliyi və ləğvdən sonra yenidən qeydiyyat yalnız layihə rəhbərliyinin təsdiqlədiyi açıq əməliyyatla edilir. Yenidən qeydiyyat eyni qeydə yeni dövr kimi əlavə olunur (`status_history` → `ACTIVE`, əsaslandırmada təsdiq qeydi); köhnə istifadələr bağlı qalır. Real şəbəkə qeydiyyat dəftərinə yazma əlavə olaraq `TAMGA_CONFIRM_PROD` qapısından keçir. |

Adlar (ictimai ABI; mövcud adlandırma qaydasına görə — `proposeNetworkRecord` / `stageRecord` / `commitStaged` nümunəsi):

| Yer | Ad |
|---|---|
| `Governance` təklif funksiyaları | `proposeRelyingPartyReassignment(registry, stageId)`, `proposeRelyingPartyReRegistration(registry, stageId)` |
| `Governance` qeydiyyat idarəetmə əməliyyatları (`AdminAction`, yalnız sona) | `REASSIGN_RELYING_PARTY`, `REREGISTER_RELYING_PARTY` |
| `RelyingPartyRegistry` yazma | `stagePeriodChange(PeriodChange)` (hər kəs; yalnız saxlayır), `commitPeriodChange(stageId, PeriodAction)` (yalnız Governance) |
| `RelyingPartyRegistry` oxuma | `periodChangeIdOf`, `stagedPeriodChangeOf`, `registrationPeriodsOf`, `relyingPartyAt(rpId, t)`, `isRelyingPartyAcceptableAt(rpId, t)`, `relyingPartyStatusHistoryOf` |
| Növlər | `PeriodAction {NONE, REASSIGNMENT, RE_REGISTRATION}`, `PeriodChange`, `RegistrationPeriod` |
| Hadisələr | `PeriodChangeStaged`, `RelyingPartyReassigned`, `RelyingPartyReRegistered` |
| Xətalar | `UnknownPeriodChange`, `InvalidPeriodChange`, `StalePeriodChange` |
| Siyahı dərcçisi | `register rp <müraciət> --approval <təsdiq qeydi>` (ləğvdən sonra yenidən qeydiyyat) |

# Açıq suallar üzrə qərarlar (2026-11-04)

1. **Seçim:** (a). DNS sübutu (b) təklifə əlavə oluna bilən dəstəkləyici sənəddir; əsaslandırma xülasəsinin içində ola bilər.
2. **Adlar:** yuxarıdakı cədvəl (mövcud adlandırma qaydasına görə).
3. **Miqrasiya pəncərəsi:** dövr dəyişikliyi pəncərə açıq olanda da yalnız Governance səsverməsi ilə yazılır; tarixi icra anıdır
   (geriyə tarixlənmir), pəncərədə təkrar oynadılan tarixçə əvvəlki dövrdə qalır.

# Nəticələr

- `RelyingPartyRegistry` və `Governance`: yeni növü müəyyən təklif və yalnız Governance-in çağıra bildiyi ötürmə / yenidən qeydiyyat
  yolu; qeydiyyat dövrü sayğacı; yaddaş düzülüşünə yalnız sona əlavə.
- [[SPEC-BC-0001]] §6 və §16; siyahı dərcçisinin qeydiyyat aləti və `TrustSource` ekvivalentlik testi.
- Qeydiyyat qurumu domen sahibliyini qeydiyyatdan əvvəl yoxlamağa davam edir; mübahisədə yol Governance təklifidir. `TrustSource`
  tərəfində eyni `dns_name`-in birdən çox ölkə siyahısında görünməsi bu gün qapalı-təhlükəsiz (qeyri-müəyyən) sayılır; ötürmədən
  sonra köhnə siyahıdakı qeydin bağlanması siyahı ekvivalentlik testi ilə ayrıca həll edilir.

# Status

**Accepted — 2026-11-04.** Layihə rəhbərliyinin təsdiqi ilə (hərfi sitat xüsusi təsdiq qeydində): seçim (a), tövsiyə edildiyi
kimi. DECISIONS: D-BC-14. RO1–RO5 məcburidir. Tətbiq: `RelyingPartyRegistry`, `Governance`, siyahı dərcçisinin qeydiyyat aləti
([[SPEC-BC-0001]] versiya qeydi).
