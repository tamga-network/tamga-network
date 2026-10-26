---
document_id: ADR-0044
title: "ZK təqdimatı üçün qısaömürlü nüsxələr"
status: Active
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-09
summary: >
  Sıfır bilik sübutlu (ZK) təqdimatda ləğv siyahısının indeksi açılmadığı üçün ləğv yoxlanıla bilmir; şəxsiyyət sənədi 2 il etibarlıdır və səssiz yenilənmir. Qərar: ZK təqdimatı yalnız şəxsiyyət xidmətinin ayrıca verdiyi, ən çoxu 24 saat etibarlı olan və ləğv siyahısı daşımayan qısaömürlü mdoc nüsxələri ilə aparılır. Rəqəmsal cüzdan bu nüsxələri paket şəklində alır və istifadəçidən soruşmadan yeniləyir; əsas sənəd ləğv edilibsə və ya dayandırılıbsa, yeniləmə rədd edilir və son nüsxə ən geci 24 saat ərzində etibarsız olur. Bu, Avropa İttifaqının (Aİ) ARF-də qısaömürlü sənəd yoludur (VCR_01: ≤ 24 saat, ləğv tələb olunmur; §7.4.3.5.2 məhdud müddətli sənədlər, toplu vermə). Aİ gələcəkdə ZK üçün başqa ləğv üsulu seçərsə, qərar yenidən qiymətləndirilir. ADR-0023 AR4-ə dar bir istisna gətirir.
domain: Identity
related: ["[[ADR-0032]]", "[[ADR-0023]]", "[[ADR-0011]]", "[[ADR-0008]]", "[[SPEC-CRED-0003]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0044
source_version: "1.0.0"
---

# Qısaca

Şəxsiyyət sənədi sıfır bilik sübutu ilə göstərildikdə yoxlayan tərəf onun ləğv edilib-edilmədiyini görə bilmir. Buna görə ZK ilə
yalnız qısaömürlü nüsxələr göstərilir: hər nüsxə ən çoxu 24 saat etibarlıdır və rəqəmsal cüzdan onları avtomatik yeniləyir. Sənəd ləğv
edilərsə, şəxsiyyət xidməti yeni nüsxə vermir; əldə qalan nüsxə də bir gün ərzində etibarsız olur.

# Kontekst

- [[ADR-0032]] K6: ZK sxemi ləğv statusunu yoxlamır; [[t:status-list]] indeksini açmaq iki təqdimatı bir-birinə bağlayır. ZK4
  "ZK ilə təqdim edilən sənədin etibarlılıq müddəti qısa saxlanılır" deyir. Bu gün bu təmin olunmur: ZK ilə təqdim edilə bilən yeganə sənəd şəxsiyyət
  sənədidir (mdoc), 2 il (730 gün) etibarlıdır və şəxsiyyət xidməti şəxsi sahələri saxlamadığı üçün səssiz yenilənmir
  ([[ADR-0023]] AR4). Ləğv edilmiş şəxsiyyət sənədi ZK ilə göstərildikdə yoxlayan tərəf bunu görə bilmir; siyasət bunu yalnız
  `accept_unrevocable_zk: true` ilə şüurlu şəkildə qəbul edə bilər.
- Aİ [[t:ARF]] 3.0 (2026-07-23) ləğv üçün iki yol tanıyır (Annex 2, Topic 7, VCR_01 / VCR_01b): **ən çoxu 24 saat etibarlı qısaömürlü
  sənəd vermək — beləliklə ləğvə ümumiyyətlə ehtiyac qalmır —** və ya status siyahısı / ləğv siyahısından istifadə etmək. 24 saatlıq müddət ETSI EN
  319 411-1 REV-6.2.4-03A-nın "ləğv ən geci 24 saat ərzində icra olunur" qaydasından irəli gəlir. ARF §7.4.3.5.2 eyni sənədin çoxsaylı
  texniki nüsxələrinin toplu verilməsini və **məhdud müddətli sənədlər** (Topic 10, üsul B) üsulunu müəyyən edir; §5.3-də texniki
  nüsxələrin qısa texniki etibarlılıq müddəti ilə yenidən verilməsini təsvir edir. Yenidən vermə mümkün qədər istifadəçi əməliyyatı tələb etmir
  (ISSU_42).
- Aİ ZK üsulunu hələ seçməyib (ARF §7.4.3.5.3: "müzakirələr davam edir"; TS4, TS13, TS14). ZK üçün gizli ləğv sübutu Aİ
  tərəfində müəyyən edilməyib.
- Layihə rəhbərliyinin istiqaməti: Aİ-nin təklif etdiyi və ya gələcəkdə seçəcəyi yol budursa, onu tətbiq etmək.

# Nəzərdən keçirilmiş variantlar

| Seçim | Nəticə | Səbəb |
|---|---|---|
| **A — ZK üçün qısaömürlü nüsxələr (paket + səssiz yeniləmə)** | **qəbul** | Aİ ARF-nin bu gün müəyyən etdiyi yol (VCR_01: ≤ 24 saat, ləğv tələb olunmur; toplu vermə, məhdud müddətli rəqəmsal sənəd). Ləğv edilmiş rəqəmsal sənəd ən geci 24 saat ərzində ZK ilə təqdim edilə bilməz olur; qurumun rəqəmsal sənədi və dövrə dəyişmir. |
| B — ZK daxilində gizli ləğv sübutu (indeksi açmadan ləğv edilmədiyini sübut etmək) | gələcəkdə | Aİ-də müəyyən edilmiş sxem yoxdur (TS13/TS14-ün ləğv bölməsi açıqdır); dövrə dəyişir, qurumların siyahı formatı dəyişə bilər. Aİ bir sxem seçərsə, bu ADR yenidən qiymətləndirilir. |
| C — Qəbul edib sənədləşdirmək (`accept_unrevocable_zk` ilə) | rədd (keçid dövrü istisna olmaqla) | Ləğv edilmiş şəxsiyyət sənədi 2 ilədək yoxlayan tərəfə ZK ilə etibarlı görünür; ZK4-ün ikinci yarısı heç ödənilmir. A tətbiq edilənədək bugünkü davranış belədir. |
| Şəxsiyyət sənədinin tamamilə qısaömürlü edilməsi | rədd | Şəxsiyyət sənədi şəxsi sahələr saxlanılmadan yenidən verilə bilməz; hər yeniləmə şəxsiyyətin yenidən təsdiqlənməsi demək olardı. |
| 7 günlük ZK nüsxələri | rədd | ARF-nin "ləğv tələb olunmur" həddi 24 saatdır; 7 gün ləğvi bir həftəyədək gecikdirir. |

# Qərar

## K1 — ZK yalnız qısaömürlü nüsxə ilə
ZK təqdimatı ([[ADR-0032]], `mso_mdoc_zk`) yalnız şəxsiyyət xidmətinin bu məqsədlə verdiyi **ZK nüsxəsi ilə** aparılır. ZK nüsxəsi şəxsiyyət
sənədinin mdoc təqdimatının texniki nüsxəsidir:
- etibarlılıq müddəti (`validFrom` → `validUntil`) **ən çoxu 24 saatdır**;
- ləğv siyahısı (`status`) daşımır — ARF VCR_01-ə əsasən ləğv əvəzinə qısa ömür tətbiq olunur;
- yalnız ZK təqdimatında istifadə edilir; klassik təqdimat (`mso_mdoc`, `dc+sd-jwt`) bugünkü nüsxələrlə və ləğv yoxlaması ilə davam edir;
- yoxlayan tərəfin ZK sübutundan ayırd edə biləcəyi bir işarə daşıyır (sübutun bağladığı sənəd növü və ya ayrıca imza sertifikatı;
  seçim tətbiq dizaynında edilir, yeni ictimai ad tələb olunarsa, layihə rəhbərliyinin təsdiqinə təqdim olunur).

## K2 — Paket və səssiz yeniləmə
Şəxsiyyət xidməti ilk verilmədə və hər yeniləmədə kiçik ZK nüsxələri paketi verir (hər nüsxə ayrıca cihaz açarına bağlıdır; toplu
vermə). Rəqəmsal cüzdan son nüsxənin müddəti bitməyə az qalmış istifadəçidən soruşmadan yeni paket alır. [[ADR-0023]] K1-in şərtləri
qüvvədədir: şəbəkə mövcuddur, təsadüfi gecikmə; istifadəçi ayarı ("nüsxələri avtomatik yenilə") söndürərsə, ZK nüsxəsi yenilənmir və ZK
təqdimatından istifadə etmək mümkün olmur (klassik təqdimat davam edir).

## K3 — Yeniləmə yolu və şəxsi məlumatlar
- Yeniləmə OpenID4VCI yeniləmə tokeni ilə aparılır; token ~~ilk verilmədəki [[t:DPoP]] açarına~~ **([[ADR-0060]] ilə dəyişdi,
  2026-10-22) ilk verilmədəki müştəri nümunəsi açarına (WIA `cnf`)** və rəqəmsal cüzdanın təsdiqinə ([[t:WUA]]) bağlıdır,
  birdəfəlikdir və hər istifadədə dəyişir ([[ADR-0023]] K2, AR2); DPoP açarı yeniləmədə dəyişə bilər.
- Şəxsiyyət xidməti şəxsi sahələri **saxlamır** ([[ADR-0011]] K4). ZK nüsxəsinə daxil ediləcək minimum sahələr tokenin içində, yalnız
  şəxsiyyət xidmətinin aça biləcəyi şəkildə şifrələnmiş və imzalanmış halda ötürülür; token rəqəmsal cüzdanda qalır, serverdə qeyd aparılmır.
- Token əsas şəxsiyyət sənədinin ləğv siyahısındakı qeydinə bağlıdır. Şəxsiyyət xidməti hər yeniləmədə bu qeydin statusunu öz
  siyahısından oxuyur; sənəd **ləğv edilibsə və ya dayandırılıbsa, yeni nüsxə vermir** və tokeni etibarsız sayır.
- Yeniləmə sorğusu hansı yoxlayan tərəfə nəyin göstərildiyini ehtiva etmir; şəxsiyyət xidmətinin jurnalına fərdi məlumatlar və token yazılmır.

## K4 — Ləğvin təsiri
Əsas sənəd ləğv edildikdə yeni ZK nüsxəsi verilmir; rəqəmsal cüzdandakı son nüsxə ən geci 24 saat ərzində etibarsız olur. Beləliklə, ləğv ZK
təqdimatında ən geci 24 saat ərzində qüvvəyə minir (klassik təqdimatda dərc intervalı qədər, [[SPEC-CRED-0003]] §5.3).

## K5 — Yoxlayan tərəf
Yoxlayan tərəf K1 işarəsini daşıyan ZK təqdimatını "ləğv yoxlaması tələb olunmayan qısaömürlü sənəd" kimi qəbul edir (`status.value =
NOT_APPLICABLE`, gerekçe kısa ömür); `accept_unrevocable_zk` yalnız işarə daşımayan ZK təqdimatı üçün tələb olunur. A tətbiq edilənədək
bugünkü qayda qüvvədə qalır: işarəsiz ZK təqdimatı, siyasət `accept_unrevocable_zk: true` demədikcə, YOXLANILA BİLMƏDİ statusundadır.

## K6 — Aİ yolu dəyişərsə
Aİ ZK üçün başqa ləğv üsulu (məs., gizli ləğv sübutu) seçərsə və ya qısa ömür həddini dəyişərsə, bu qərar yenidən
qiymətləndirilir (seçim B).

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| ZC1 | ZK təqdimatı yalnız ZK nüsxəsi ilə aparılır; ZK nüsxəsi ən çoxu 24 saat etibarlıdır və ləğv siyahısı daşımır. |
| ZC2 | Əsas şəxsiyyət sənədi ləğv edilibsə və ya dayandırılıbsa, şəxsiyyət xidməti yeni ZK nüsxəsi vermir. |
| ZC3 | ZK nüsxəsinin yenilənməsi şəxsi sahələri serverdə saxlamır; sahələr yalnız şəxsiyyət xidmətinin aça biləcəyi şəkildə tokendə, rəqəmsal cüzdanda qalır. |
| ZC4 | Yoxlayan tərəf qısa ömür işarəsi daşımayan ZK təqdimatını, siyasət açıq şəkildə qəbul etmədikcə, YOXLANILA BİLMƏDİ sayır. |

# Nəticələr

- [[ADR-0023]] AR4 daralır: şəxsi sahələri saxlamayan xidmətlər yeniləmə tokeni vermir; yeganə istisna ZK nüsxəsi tokenidir
  (ZC3).
- [[ADR-0032]] K6 və ZK4 bu ADR ilə tətbiq olunur: "qısa" ən çoxu 24 saatdır.
- Spesifikasiyalar (tətbiqlə birlikdə): [[SPEC-WALLET-0001]] (ZK nüsxəsi anbarı və yeniləmə), [[SPEC-PROTO-0001]] §4.1
  (şəxsiyyət xidmətində ZK nüsxəsi tokeni), [[SPEC-API-0001]] D1 (qısa ömür işarəsi), şəxsiyyət rulebook-u.
- Kod: şəxsiyyət xidməti (operator reposu), `@tamga-network/wallet-core`, `@tamga-network/verifier`, rəqəmsal cüzdan tətbiqi.
  Paket dəyişikliyi növbəti minor versiyadadır; dərc edilməmiş 0.3.0 paketləri dəyişdirilmir.
- Təxmini iş həcmi: şəxsiyyət xidməti 3–4 gün, wallet-core 3–4 gün, rəqəmsal cüzdan tətbiqi 2 gün, yoxlayan tərəf 1–2 gün, spesifikasiya + test +
  uyğunluq vektorları 2 gün — cəmi təxminən 2,5–3 həftə.
- Qalıq risk: şəxsiyyət xidməti yeniləmə tezliyindən rəqəmsal cüzdanın aktiv olduğunu (gündə bir yeniləmə) öyrənir; hansı yoxlayan tərəfə
  nəyin göstərildiyini öyrənmir. Təsadüfi gecikmə və istifadəçi ayarı bunu azaldır ([[ADR-0023]] K6 ilə eyni balans).

# Status

**Accepted — 2026-10-09.** Layihə rəhbərliyinin təsdiqi ilə, Aİ-nin təklif etdiyi yol olması şərtilə (K6). DECISIONS: D-ZK-2.

2026-10-22: **K3 [[ADR-0060]] ilə dəyişdi** — tokenin bağı DPoP açarından müştəri nümunəsi açarına (WIA `cnf`, tokendə `ijk`) keçdi
(D-PROTO-4). 2026-10-23: token yalnız ZK nüsxəsi əhatəsi də istənildikdə verilir ([[ADR-0062]], D-ZK-3).

*Tətbiq (2026-10-09, paketlər 0.4.0):* K1 işarəsi ayrıca sənəd növüdür — `urn:tamga:id:ShortLivedIdentityAttestation:1`
(kataloqda; növ qaydası ≤ 24 saat, ləğv siyahısı yoxdur; ictimai ad layihə rəhbərliyinin təsdiqini gözləyir, kodda tək sabitdədir).
Longfellow sübutu docType-ı bağladığı üçün yoxlayan tərəf növü sübutdan görür; ayrıca imza sertifikatı tələb olunmadı (eyni qurum
açarı, MD3). Şəxsiyyət xidməti: şəxsiyyət sənədinin token cavabında `refresh_token` (JWE `dir` + A256GCM; bağlı qeyd, nəsil
sayğacı, DPoP barmaq izi, bitmə vaxtı, yalnız `age_over_18`); serverdə yalnız qeyddəki nəsil sayğacı; paket ən çoxu 3 nüsxə, etibarlılıq
≤ 24 saat və ≤ əsas sənədin bitmə vaxtı ([[SPEC-PROTO-0001]] §4.2). Cüzdan nüvəsi: `refreshZkCopies`, `scheduleZkRefreshes`
(pəncərə: bitməyə 8 saat; təsadüfi gecikmə ən çoxu 6 saat), ZK sorğusu yalnız ZK nüsxəsi ilə ([[SPEC-WALLET-0001]] §4.5).
Yoxlayan tərəf: işarəli ZK təqdimatı `NOT_APPLICABLE` (əsaslandırma: qısa ömür), işarəsiz təqdimat `accept_unrevocable_zk` tələb edir
([[SPEC-API-0001]] D1); Tamga Verify-ın `age-over-18-zk` siyasəti ZK nüsxəsi növünü tələb edir, bayraq ləğv edildi.
