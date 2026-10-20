---
document_id: ADR-0047
title: "Cüzdan vahidinin ləğvi, cüzdandan kənar ləğv yolu və cihaz sübutu"
status: Active
version: 1.0.0
created: 2026-10-12
last_updated: 2026-10-14
summary: >
  Aİ Attestation Rulebook şablonu üzərində işdə açıq qalan doqquz məsələ üzrə qərar. Cüzdan vahidinin ləğvi qurumların rəqəmsal sənədlərini ləğv etmir (rəqəmsal sənədlər cihaz açarına bağlıdır, vahid ləğv edildikdə istifadə edilə bilmir); qurumlar əlavə ləğv şərtlərini istəyə bağlı `revocation_policy_uri` keçidi ilə dərc edə bilər; itirilmiş və ya oğurlanmış telefondan ləğv istifadəçi hesabı olmadan, quraşdırma zamanı verilən ləğv sirri ilə həyata keçirilir; hər cüzdan provayderi şəxsin vahidin ləğv edildiyini cüzdandan kənarda öyrənə biləcəyi ən azı bir yol təqdim edir; cihaz sübutu yalnız ən yüksək cüzdan səviyyəsində (W3) məcburidir. Bundan əlavə: kvalifikasiyalı olmayan EAA göstəricisi yazılmır (ETSI), rəqəmsal sənədə etibar lövbərinin yeri sahəsi əlavə edilmir, diplomda I3 qərarı pilotdan sonraya təxirə salınır. ADR-0025 K4-ü dəyişdirir. Qəbul: 2026-10-12.
domain: Wallet
related: ["[[ADR-0025]]", "[[ADR-0024]]", "[[ADR-0022]]", "[[ADR-0042]]", "[[FW-POL-0001]]", "[[FW-POL-0002]]", "[[FW-RB-0001]]", "[[FW-RB-0002]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0047
source_version: "1.0.0"
---

# Qısaca

Rulebook-lar Aİ Attestation Rulebook şablonuna köçürülərkən ([[FW-RB-0001]] §11) və iki siyasət sənədi yazılarkən ([[FW-POL-0001]],
[[FW-POL-0002]]) doqquz məsələ "qərar gözləyir" kimi saxlanıldı. Layihə rəhbərliyi 2026-10-12-də doqquzunun hamısı üzrə təklifləri qəbul etdi. Bu
qərar onlardan beşini şəbəkənin qaydasına çevirir (K1–K5), üçünü əsaslandırması ilə qeydə alır (K6–K8), birini isə təxirə salınmış qərar kimi tetikleyicisi ilə
yazır (K9).

# Kontekst

| # | Məsələ | Aİ mənbəyi | Bu gün |
|---|---|---|---|
| 1 | Kvalifikasiyalı olmayan EAA göstəricisi | Şablon `eaa:eu:non-qualified` tövsiyə edir (ARB_12); ETSI TS 119 472-1 EAA-5.2.2.1-01 kvalifikasiyalı olmayan EAA-da `category` olmamasını tələb edir | Tamga ETSI-yə əməl edir |
| 2 | Etibar lövbərinin yeri rəqəmsal sənəddə (Əlavə V h) | ARB_21 | Yer: sənədi verən qurumun sertifikat zənciri və etibar siyahıları |
| 3 | Cüzdan vahidinin ləğvində qurumların rəqəmsal sənədləri | WURevocation_18 (PID provayderi üçün məcburi), WURevocation_19 (digərləri üçün istəyə bağlı) | Yalnız şəxsiyyət xidməti zəncirvari ləğv edir |
| 4 | Sənədi verən qurumun əlavə ləğv şərtləri | VCR_05 | Şəbəkənin ümumi ləğv siyasəti var; qurumun əlavə şərtləri üçün yer yoxdur |
| 5 | WIA/KA siyasətinin ETSI TS 119 471 bənd 6–7 ilə uzlaşdırılması | WURevocation_03 | Sətir-sətir müqayisə edilməyib |
| 6 | İtirilmiş və ya oğurlanmış telefondan ləğv | WIAM_06 (provayderdə istifadəçi hesabı), WURevocation_10 | [[ADR-0025]] K4: "istifadəçi hesabı tələb edir; növbəti addım" |
| 7 | Ləğvin şəxsə cüzdandan kənar bildirilməsi | WURevocation_14, WURevocation_16 | Şəbəkə qaydası yoxdur |
| 8 | Aktivləşdirmədə cihaz sübutu | WIAM_04, WIAM_08 | Cüzdan provayderinin qərarı |
| 9 | Diplomda I3 akkreditasiyası | — | "Pilotdan sonra" |

Tamga-da hesab yoxdur və fərdi məlumatlar minimum saxlanılır ([[ADR-0025]] WIA2). Şəbəkə rəqəmsal cüzdan idarə etmir, cüzdanları etibar siyahısındakı
qeydləri ilə tanıyır ([[ADR-0042]]); buna görə də cüzdanlarla bağlı qaydalar hər cüzdan provayderinin təmin etməli olduğu **nəticələr**
kimi yazılır, üsul isə provayderə aiddir.

# Qərar

## K1 — Cüzdan vahidinin ləğvi qurumların rəqəmsal sənədlərini ləğv etmir

- Cüzdan provayderi cüzdan vahidini ləğv etdikdə **qurumların verdiyi rəqəmsal sənədlər ləğv edilmir**. ARF bunu sənədi verən qurumların
  ixtiyarına buraxır (WURevocation_19); Tamga şəbəkəsində qayda olaraq tətbiq edilmir. Buna görə qurum sənədlərinin müddətini WIA və KA
  ləğv saxlanma müddətinə bağlayan şərt (ISSU_12d) tətbiq edilmir.
- **Şəxsiyyət xidməti** (Tamga-nın PID ekvivalenti olan sənədi verən qurum) dəyişmədən vahidi ən geci 24 saat ərzində yoxlayır və həmin vahiddəki öz
  rəqəmsal sənədlərini ləğv edir (WURevocation_18). Zəncirvari ləğv edən sənədi verən qurum rəqəmsal sənədin müddətini verilmə zamanı təqdim olunan WIA və KA-nın
  ləğv saxlanma müddəti ilə məhdudlaşdırır və tələb etdiyi minimum saxlanma müddətini metaməlumatlarında elan edir (ISSU_12c, WUA_32; Aİ TS3
  `preferred_client_status_period`, `preferred_key_storage_status_period`). Paketlər bunu 0.5.0-da təmin edir; şəxsiyyət xidmətində
  məhdudiyyət cüzdan provayderləri elan edilmiş müddəti qarşılayan WIA və KA verdikdə aktivləşdirilir (bugünkü 60 günlük saxlanma müddəti ilə 2 illik
  şəxsiyyət sənədi 60 günə enərdi).
- **Tətbiq qeydi (2026-10-14):** məhdudiyyət şəxsiyyət xidmətində aktivləşdirildi; real şəbəkədə və sandbox-da həmişə aktivdir (yalnız lokal
  inkişafda söndürülə bilər). Elan edilən üstünlük şəxsiyyət sənədinin müddətinə bərabərdir: WIA və KA üçün 730 gün. Tamga Wallet
  provayderi (TAMGA-WP-1) tələb edilən müddəti 730 günədək verir və rəqəmsal cüzdan bu müddəti tələb edir; beləliklə şəxsiyyət sənədi 2 il qalır. 60 gün
  verən provayderdə sənəd 60 gün olur. Üstünlük qəsdən qısaldılmır (məs. 723 gün): provayder tələb edilən müddəti verdiyi üçün sənəd hər
  dəfə o qədər qısalardı. Rəqəmsal cüzdan qalan müddəti üstünlükdən ən çoxu 7 gün az olduqda da kafi saydığı üçün sənədin müddəti 723–730 gün arasında
  bitir.
- **Niyə kifayətdir:** hər nüsxə cihazdakı sənəd sahibi açarına bağlıdır (`cnf`); açar cihazın təhlükəsiz aparat hissəsində yaradılır,
  ixrac edilə bilmir (RB-WP-01) və hər təqdimat həmin açarla imza və PIN və ya biometrika tələb edir (RB-WP-03). Rəqəmsal sənəd başqa cihazdan
  təqdim edilə bilməz. Vahid ləğv edildikdə:
  1. heç bir sənədi verən qurum həmin cüzdana yeni rəqəmsal sənəd və ya yeniləmə vermir ([[ADR-0025]] WIA4; [[ADR-0023]] yeniləmə etibarlı WIA tələb edir);
  2. ləğvi görən rəqəmsal cüzdan sənədlərini və açarlarını silir (Tamga Wallet-da qayda, cüzdanın öz qərarı);
  3. şəxsiyyət xidmətinin sənədi ləğv olunur; şəxsiyyətə əsaslanan axınlar dayanır;
  4. qurum sənədləri müddəti bitdikdə qüvvədən düşür (tələbə sənədi ən çoxu 90 gün).
- **Qalıq risk:** telefonu və kilid açma məlumatını birlikdə ələ keçirən şəxs, telefon şəbəkəyə qoşulmadıqca müddəti bitməmiş qurum
  sənədini təqdim edə bilər. Şəxs bunun üçün qurumdan ləğv tələb edə bilər ([[FW-POL-0001]] §4). Zəncirvari ləğv bu riski aradan qaldırmazdı:
  telefon şəbəkəyə qoşulmursa, rəqəmsal cüzdan da silinmir, qurumun ləğv siyahısı isə onsuz da bu yolla istifadə edilə bilər.

## K2 — Qurumun əlavə ləğv şərtləri: `revocation_policy_uri`

- Qurum şəbəkənin ümumi ləğv siyasətinə ([[FW-POL-0001]]) **əlavə** şərtlərini öz səhifəsində dərc edə bilər (**MAY**). Keçid
  etibar siyahısındakı qurum qeydində istəyə bağlı `revocation_policy_uri` sahəsində yer alır (qeydiyyat məlumatları, [[ADR-0024]]; `info_uri`,
  `privacy_policy_uri` ilə eyni format).
- Səhifə ümumi siyasəti **daralda bilməz**: ümumi şərtlər hər qurumda qüvvədədir; qurum yalnız əlavə edir (məs. "intizam cəzası ilə
  tələbəlik dayandırılarsa, rəqəmsal sənəd ləğv edilir").
- Keçid qurumun qeydiyyat müraciətində verilir (siyahı dərcçisinin qeydiyyat aləti, https ünvanı); rəqəmsal cüzdan onu qurum səhifəsində göstərir.
- **Ad:** ARF VCR_05 bu sənədi "policy" adlandırır ("a policy specifying under which conditions … it issued will be revoked"); ad
  Aİ qeydiyyat məlumatlarındakı `*_policy_uri` sahələrinin formatına uyğundur. `revocation_conditions_uri` təklif edilmişdi; Aİ mətni ilə eyni termindən
  istifadə etmək üçün `revocation_policy_uri` seçildi.

## K3 — İtirilmiş və ya oğurlanmış telefondan ləğv: hesab olmadan

- Hər cüzdan provayderi şəxsin telefonu əlində olmadan cüzdan vahidini ləğv edə biləcəyi bir yol **MUST** təqdim etsin
  (WURevocation_10, WIAM_06).
- Bu yol **istifadəçi hesabı tələb etmir.** Qəbul edilmiş üsul: vahid aktivləşdirilərkən telefonda yaradılan və şəxsə bir dəfə
  göstərilən ləğv sirri; provayder vahid qeydində yalnız onun yavaş heşini saxlayır; şəxs sirri provayderin veb səhifəsinə daxil edir,
  vahid və bütün WIA qeydləri ləğv olunur. Səhifə fərdi məlumat tələb etmir və göstərmir. Tamga Wallet bunu bağlama kodu və "Telefonumu
  itirdim" səhifəsi ilə həyata keçirir (cüzdanın WA-ADR-0002 qərarı).
- **ARF-dən kənarlaşma:** WIAM_06-nın nəzərdə tutduğu istifadəçi hesabı əvəzinə quraşdırma zamanı qeydə alınan sirr. "Şəxsin açıq istəyi" və
  "aktivləşdirmə zamanı qeydiyyat" şərtləri ödənilir; sertifikasiya mərhələsində bu ekvivalentlik ayrıca əsaslandırılır.
- Bu qərar [[ADR-0025]] K4-dəki "itirilmiş və ya oğurlanmış cihazdan ləğv istifadəçi hesabı tələb edir; növbəti addıma saxlanılır"
  bəndini əvəz edir.

## K4 — Ləğvin cüzdandan kənar öyrənilməsi

- Hər cüzdan provayderi şəxsin cüzdan vahidinin ləğv edildiyini **cüzdandan kənarda** öyrənə biləcəyi ən azı bir yol **MUST** təqdim etsin
  (WURevocation_16). Provayder vahidi öz qərarı ilə ləğv edibsə, bu yol ən geci 24 saat ərzində ləğvin səbəbini, nəyin işləməyə davam etdiyini və şəxsin
  nə edə biləcəyini göstərir (WURevocation_14).
- Üsul provayderə aiddir; bu yol fərdi məlumatların toplanmasını məcburi etmir. Tamga Wallet bunu hamıya açıq təhlükəsizlik bildirişləri və bağlama
  kodu ilə açılan, məlumat saxlamayan "cüzdanımın vəziyyəti" səhifəsi ilə həyata keçirir (cüzdanın WA-ADR-0008 qərarı).

## K5 — Cihaz sübutu yalnız ən yüksək cüzdan səviyyəsində məcburidir

- Cüzdan səviyyələri Trust Framework-dəki üç səviyyədir: W1 proqram açarı (rəqəmsal sənəd verilmir, RB-WP-01), W2 cihazın təhlükəsiz zonası,
  W3 sertifikatlı təhlükəsiz aparat.
- **W3:** cüzdan provayderi vahidi aktivləşdirərkən və W3 bəyan edən hər KA-dan əvvəl platformanın cihaz sübutunu (Apple App Attest,
  Android açar sübutu, Play Integrity) **MUST** yoxlasın; yoxlanılmamış cihaza W3 KA verilmir ([[ADR-0025]] WIA3 "səviyyə
  həqiqəti əks etdirir").
- **W2:** cihaz sübutu istəyə bağlıdır (**MAY**); bu, cüzdan provayderinin qərarıdır. Tamga Wallet canlı mühitdə yalnız aparat sübutu
  yoxlanılmış cihaza WIA verir (cüzdanın WA-ADR-0005 qərarı); bu, şəbəkənin minimum tələbindən yuxarıdır.

## K6 — Kvalifikasiyalı olmayan EAA göstəricisi yazılmır (ARB_12)

Aİ şablonu kvalifikasiyalı olmayan EAA üçün `category` sahəsində `eaa:eu:non-qualified` dəyərini tövsiyə edir. ETSI TS 119 472-1 V1.2.1,
EAA-5.2.2.1-01 isə Aİ-də qeydiyyatda olan, kvalifikasiyalı və ya dövlət qurumu olmayan sənədi verən qurumun SD-JWT VC EAA-sında `category` claim-inin **olmamasını**
tələb edir. Tamga ETSI-yə əməl edir: kvalifikasiyalı olmayan rəqəmsal sənəddə `category` yazılmır; onun göstəricisi məhz bu yoxluqdur. Kvalifikasiyalı və ya dövlət sinfində
`category` Tamga dəyərləri ilə yazılır (RB-AP-14, [[ADR-0022]]). Şablonun dəyərindən istifadə edilmir.

## K7 — Rəqəmsal sənədə etibar lövbərinin yeri sahəsi əlavə edilmir (ARB_21)

Rəqəmsal sənəddə ayrıca etibar lövbərinin yeri sahəsi olmur; etibar lövbərlərinin yeganə mənbəyi etibar siyahılarıdır ([[SPEC-TRUST-0001]]).
Əsaslandırma:
- **Etibar rəqəmsal sənəddən gəlmir.** Sənədin içindəki yer sənədi verən qurumun öz bəyanıdır; saxta sənədi verən qurum saxta yer
  yaza bilər. Yoxlayan tərəf etibar lövbərini yalnız özünün seçdiyi, imzası sabitlənmiş siyahıdan götürməlidir (ARB_26; ETSI TS 119 472-2
  `trusted_authorities`); sənəddəki yerə əməl etmək aldatma yolu açır.
- **Əlavə V h onsuz da təmin olunur.** Sənədi verən qurumun sertifikat zənciri `x5c` başlığındadır; zəncirin kökü və sənədi verən qurumun qeydi siyahıdadır.
  Yer rulebook-da "sənədi verən qurumun sertifikatı + etibar siyahısı" kimi yazılıb.
- **Yeganə mənbə ardıcıllığı.** Lövbər dəyişəndə (açarın yenilənməsi, dayandırılma) sənədlər dəyişmir; siyahı dəyişir. Sənəddəki yer
  köhnələ bilər, siyahı köhnəlmir.
- **Məlumatların minimallaşdırılması.** Hər sənədə əlavə edilən sabit sahə məlumat daşımır, lakin ölçü və əlaqələndirilə bilənlik artırır.

## K8 — WIA/KA siyasəti ETSI TS 119 471-in 6–7-ci bəndləri ilə uyğunlaşdırılır (WURevocation_03)

Cüzdan Sübutu Siyasəti ([[FW-POL-0002]]) TS 119 471 V1.1.1-in 6-cı və 7-ci bəndləri ilə sətir-sətir müqayisə edilir; qarşılığı
olmayan bəndlər siyasətə cüzdan provayderinin öhdəliyi kimi əlavə olunur (tətbiq bəyannaməsi, şərtlər və qaydalar, informasiya
təhlükəsizliyi siyasəti, müstəqillik, çoxfaktorlu şəxsiyyət yoxlanışı (autentifikasiya), açar mərasimi və aparat təhlükəsizlik modulu, qeydlər, ehtiyat nüsxə, böhran,
fəaliyyətin dayandırılması, məxfilik, təchizat zənciri). İcra Reqlamenti (Aİ) 2025/1569-un TS 119 471-ə gətirdiyi dəyişikliklər ayrıca nəzərdən keçirilir.

## K9 — Diplomda I3: pilotdan sonra qərar (təxirə salınmış qərar)

Diplom növündə I3 (akkreditə olunmuş) sənədi verən qurumu məcburi etmək bu gün **qərara alınmır**; minimum I2 olaraq qalır, I3 tövsiyə olunur (**SHOULD**).
**Tətikləyici** (hansı əvvəl baş verərsə): (a) təhsil pilotunun yekun hesabatı, (b) pilot tərəfdaşından başqa ilk qurumun diplom vermək
üçün müraciəti, (c) hər hansı dövlətin təhsil orqanının şəbəkəyə qoşulması. Tətikləyici baş verdikdə məsələ layihə rəhbərliyinə çıxarılır.

# Nəzərdən keçirilmiş variantlar

| Mövzu | Seçim | Nəticə | Səbəb |
|---|---|---|---|
| 3 | Qurum sənədlərində zəncirvari ləğv şəbəkə qaydası | rədd | Qurumun vahidi bilməsi üçün hər sənəd qeydinə WIA ləğv girişinin yazılması lazımdır (bir identifikator); sənədin müddəti WIA-nın saxlanma müddəti ilə məhdudlaşır (ISSU_12d); təhlükəsizlik qazancı kiçikdir (K1) |
| 4 | Ayrıca sahə yoxdur, `info_uri` səhifəsində izah edilsin | rədd | Şəxs şərtləri tapa bilmir; rəqəmsal cüzdan ayrıca göstərə bilmir |
| 6 | Provayderdə istifadəçi hesabı (WIAM_06 hərfi) | rədd | "Hesab yoxdur" prinsipi; fərdi məlumatlar |
| 7 | Push və ya SMS ilə bildiriş | rədd (şəbəkə qaydası kimi) | Push rəqəmsal cüzdandan asılı deyil deyə bilməz; SMS itirilmiş telefona gedir və fərdi məlumat tələb edir |
| 8 | Hər səviyyədə cihaz sübutu məcburidir | rədd | Cihaz sübutu hər platformada və hər cihazda yoxdur; W2 rəqəmsal cüzdanları kənarda qalır |
| 1 | Şablonun `eaa:eu:non-qualified` dəyəri | rədd | ETSI-nin məcburi profili ilə ziddiyyət təşkil edir |
| 2 | İstəyə bağlı `trust_anchor` sahəsi | rədd | K7 |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| WR1 | Cüzdan vahidinin ləğvi qurum sənədlərini ləğv etmir; şəxsiyyət xidməti həmin vahiddəki öz sənədlərini ən geci 24 saat ərzində ləğv edir. |
| WR2 | Qurumun `revocation_policy_uri` səhifəsi şəbəkənin ümumi ləğv siyasətinə yalnız şərt əlavə edir; ümumi şərtləri daralda bilməz. |
| WR3 | Cüzdan provayderi telefonsuz işləyən və istifadəçi hesabı tələb etməyən vahid ləğvi yolu təqdim edir. |
| WR4 | Cüzdan provayderi şəxsin vahidin ləğv edildiyini rəqəmsal cüzdandan kənarda öyrənə biləcəyi ən azı bir yol təqdim edir. |
| WR5 | W3 səviyyəsini bəyan edən KA yalnız platformanın cihaz sübutu yoxlanılmış vahidə verilir. |

# ARF uyğunlaşdırması

| Bənd | Qarşılığı |
|---|---|
| ARB_12, ARB_25 | K6 |
| ARB_21 | K7 |
| WURevocation_18, WURevocation_19, ISSU_12c, ISSU_12d | K1 (ISSU_12d tətbiq edilmir) |
| VCR_05 | K2 + [[FW-POL-0001]] |
| WURevocation_03 | K8 + [[FW-POL-0002]] §9 |
| WURevocation_10, WIAM_06 | K3 (WIAM_06 kənarlaşma kimi) |
| WURevocation_14, WURevocation_16 | K4 |
| WIAM_04, WIAM_08 | K5 |

# Nəticələr

- Çərçivə: [[FW-RB-0001]] RB-AP-27, RB-WP-15, RB-WP-16, RB-WP-17; [[FW-POL-0001]] §3.2 və §8; [[FW-POL-0002]] §2, §5, §9 və yeni
  ETSI TS 119 471 uyğunlaşdırması; [[FW-RB-0002]], [[FW-RB-0003]], [[FW-RB-0004]], [[FW-RB-0005]] §2.0 və §7.2; Trust Framework §2.2.
- [[SPEC-TRUST-0001]] §4: qurum qeydində `revocation_policy_uri`.
- `@tamga-network/trust` (qeyd sxemi), siyahı dərcçisinin qeyd aləti, `wallet-core` qurum kataloqu (`revocationPolicyUri`).
- [[ADR-0025]] K4: itirilmə/oğurlanma bəndi bu qərara yönləndirilir.
- Rəqəmsal cüzdanlar: Tamga Wallet K3 və K4-ü WA-ADR-0002 və WA-ADR-0008 ilə artıq təmin edir; WA-ADR-0002 K4.2-dəki "qurum sənədləri üçün
  şəbəkədə qayda tövsiyə olunur" bəndi bu qərarla bağlanır (qayda yoxdur).

# Status

**Accepted — 2026-10-12.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-CRED-8.
