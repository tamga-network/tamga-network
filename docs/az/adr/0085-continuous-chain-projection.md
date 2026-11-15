---
document_id: ADR-0085
title: "Zəncirə davamlı proyeksiya"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Miqrasiya pəncərəsi bağlandıqdan sonra imzalı siyahılardakı hər dəyişikliyin zəncirə necə əks olunacağını müəyyən edir. Dərcçi
  hər siyahı dərcindən və hər lövbər sətrindən sonra son əks olunmuş siyahı ilə indiki siyahı arasındakı fərqi (qurum əlavəsi,
  status dəyişikliyi, səlahiyyət pəncərəsi, status siyahısı versiyası, açar dəyişikliyi, şəbəkə səviyyəli qeyd…) miqrasiyanın
  istifadə etdiyi eyni uyğunluqla zəncir əməliyyatlarına çevirir və yazır. Zəncir tarixi blok anıdır; siyahı tarixi ilə zəncir
  tarixi arasındakı gecikmə ekvivalentlikdə fərq sayılmır, iki saatı keçərsə həyəcan siqnalı yaradır. Eyni icradakı ara vəziyyətlər
  birləşir; gələcək tarixli qeyd vaxtı çatanda yazılır. Şəbəkə səviyyəli qeydlər Governance səsverməsi ilə axır. Zəncirə yazı
  uğursuz olarsa siyahı dərci dayanmır; fərq növbəti icrada yenidən sınanır və həyəcan siqnalı yaranır. Yalnız bayraq açıq ikən,
  miqrasiyadan sonra və yalnız lokal və ya test zəncirinə yazılır; real şəbəkəyə yazı yolu yoxdur. Qəbul edildi (2026-11-15).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[ADR-0075]]", "[[ADR-0084]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0085
source_version: 1.0.0
---

# Qısaca

Zəncir siyahının şahididirsə ([[ADR-0084]]), siyahıdakı hər dəyişiklik zəncirdə də görünməlidir. İndiyədək siyahının tarixçəsi
zəncirə yalnız bir dəfə, miqrasiya zamanı köçürülə bilirdi; sonra yeni qurum, dayandırma və ya açar dəyişikliyi zəncirə getmirdi.
Bu qərar hər dərcdən sonra işləyən sinxronlaşdırma icrası qurur: əvvəlki siyahı yenisi ilə müqayisə edilir, fərq zəncirə yazılır.
Zəncir bu işdə geri qala və ya yaza bilməyə bilər; bu halda siyahı yenə dərc edilir, sinxronlaşdırma sonra yenidən sınanır və
operator xəbərdar edilir.

# Kontekst

- [[ADR-0074]] PJ1: siyahılarda etibar qərarına təsir edən hər qeyd zəncirdə bir qeydə uyğunlaşdırılır. [[ADR-0073]]: siyahı
  tarixçəsi zəncirə bir dəfə, ən çox 30 gün açıq qalan miqrasiya pəncərəsində, siyahıdakı tarixlərlə yazılır; pəncərə bağlananda
  tarix blok anıdır (CE1). [[ADR-0051]] K4: siyahı xülasələri (`chain-submit`) hər dərcdən sonra yazılır — lakin bu iş planlayıcıya
  bağlı deyildi.
- Zəncir qatı yoxlanışının (2026-11-15) tapıntısı: pəncərə bağlandıqdan sonrakı dəyişiklikləri zəncirə yazan alət yox idi. Buna
  görə zəncirdən oxuyan etibar mənbəyi yerində sayan zəncirlə "sağlam" görünməsin deyə məzmun səviyyəsinə bağlandı ([[ADR-0074]] K5
  qeydi). Alətin dizaynı dörd suala cavab tələb edirdi: tarix fərqi, şəbəkə səviyyəli qeydlərin səsvermə ilə axını, yazı kvotası,
  gələcək tarixli qeydlər.
- **Layihə rəhbərliyinin istiqaməti (2026-11-15):** zəncir kodu irəliləsin və struktur qurulsun ki, zəncirə keçid günü sıfırdan
  proses lazım olmasın; bugünkü AB modelində zəncirlə bağlı proses aparılmır ([[ADR-0084]]). Bu qərar həmin istiqamətin tətbiqidir:
  alət yazılır, söndürülmüş qalır.

# Qərar

## K1 — Fərq: miqrasiyanın uyğunluğu ilə

Dərcçi hər siyahı dərcindən (yeni siyahı versiyası) və hər lövbər sətrindən (saatlıq sətir, status siyahısı sətri) sonra
sinxronlaşdırma icrası aparır. İcra son əks olunmuş nöqtədəki imzalı siyahı arxivinin planını və indiki arxivin planını eyni plan
mühərriki ilə qurur və **indiki planda olub əvvəlkində olmayan əməliyyatları** yazır. Plan mühərriki miqrasiyanın mühərrikidir
([[ADR-0073]] K1, `trust:chain-replay`): qeydin zəncirdəki qarşılığı miqrasiyada və davamlı proyeksiyada fərqli ola bilməz. Fərq
[[ADR-0074]] PJ1-in bütün qeydlərini əhatə edir: kök sertifikat, qurum (qeydiyyat, status, sərt ləğv, etibarlılıq uzadılması,
qeydiyyat məlumatı, sxem səlahiyyət pəncərələri, xələf), sxem və versiya xülasələri, yoxlayan tərəf (qeydiyyat, status, sertifikat,
əhatə, keçid qrupu, qeydiyyat məlumatı, ötürmə və yenidən qeydiyyat), tanınma, status siyahısı qeydiyyatı və versiyası, şəbəkə
səviyyəli qeydlər (cüzdan provayderi və açarları, ZK sxemi, xarici siyahı, sənəd kateqoriyası, siyahı imzalayanı, operator, slot,
kataloq). Şəxsi məlumat və sərbəst mətn zəncirə getmir (PJ2); sandbox real zəncirə yazılmır (PJ4).

## K2 — Tarix: blok anı; gecikmə fərq sayılmır

- Miqrasiya pəncərəsindən kənarda zəncir tarixi blok anıdır ([[ADR-0073]] CE1): status, qeydiyyat və səlahiyyət yazıları tarixsiz
  edilir; siyahıda keçmiş an yazılı olsa da zəncir həmin anı yazmır. Kontraktın pəncərədən kənarda da keçmiş tarix qəbul etdiyi iki
  sahə siyahıdakı anla yazılır: sərt ləğv (`invalidatesFrom`, CE2) və status siyahısının dərc anı.
- Siyahıdakı an ilə zəncirdəki yazı anı arasındakı interval **proyeksiya gecikməsidir**. Davamlı ekvivalentlik testi bu intervaldakı
  anları (sənədin `iat`-ı, yoxlayan tərəfin keçmiş andakı statusu) soruşmur; intervaldan kənar hər sualda siyahı ilə zəncir eyni
  cavabı verməlidir. Hələ gəlməmiş anlar da soruşulmur (sənədin `iat`-ı keçmişdədir).
- Gecikmə siyahı tarixindən dərcə qədər deyil, dərcdən zəncirə qədər ölçülür və hədəfi bir saatdır (saatlıq lövbər tezliyi). **İki
  saatı keçən gecikmə həyəcan siqnalı yaradır.** Zəncir qərar vermədiyi üçün ([[ADR-0084]] LS2) gecikmə heç bir sənədin yoxlanmasını
  dəyişmir.

## K3 — Birləşdirmə və gözləyən iş

- Eyni qeydə eyni icrada düşən ara vəziyyətlər (dayandırma və bərpa, eyni səlahiyyət pəncərəsinin açılıb bağlanması, qeydiyyat
  məlumatının iki versiyası, eyni status siyahısının bir neçə versiyası) eyni blok anında sıfır uzunluqlu pəncərə olardı; yalnız
  **son vəziyyət** yazılır. Zəncirdə heç olmamış ara vəziyyətin intervalı da gecikmə intervalıdır (K2).
- Gələcək tarixli qeyd (məsələn, sxem səlahiyyətinin bitməsi) bu gün zəncirə yazıla bilməz (`DateInFuture`). İcranın plan anı icranın
  özüdür; vaxtı çatmamış qeyd bu icrada yazılmır, vaxtı çatdıqdan sonrakı ilk icrada — yeni siyahı versiyası dərc edilməsə də,
  saatlıq sətirdən sonra — fərqdə çıxır və yazılır. Ayrıca növbə faylı saxlanmır; gözləyən iş planın özündən törəyir.

## K4 — Şəbəkə səviyyəli qeydlər Governance səsverməsi ilə

Şəbəkə səviyyəli qeydlər və şəbəkə sxemləri ([[ADR-0074]] PJ3) pəncərədən kənarda yalnız Governance səsverməsi ilə yazılır: icra
qeydi səhnəyə qoyur və növü müəyyən təklifi açır; təklif digər operatorların səsi ilə irəliləyir ([[ADR-0055]]). Alət səsverməni
keçmir. Səs gözləyən qeyd hesabata düşür və icranı "natamam" sayır; milli qeydlərin yazılmasını gözlətmir. Yoxlayan tərəfin
ötürülməsi və ləğvdən sonra yenidən qeydiyyatı da eyni yolla ([[ADR-0075]]).

## K5 — Uğursuz yazı siyahını dayandırmır; fərq yenidən sınanır

- Zəncirə yazı xətası (zəncir əlçatmazdır, əməliyyat geri qaytarıldı, kvota doldu, səs gözlənilir) siyahı dərcini dayandırmır və dərc
  əmrinin nəticəsini dəyişmir ([[ADR-0084]] LS4); həyəcan siqnalı yaradır.
- Yalnız **tam** icra (bütün fərq yazıldı) proyeksiya nöqtəsini irəli aparır. Natamam icradan sonra nöqtə yerində qalır; eyni fərq
  növbəti icrada yenidən sınanır. İcra qaldığı yerdən davam edir: hər əməliyyatdan əvvəl zəncirdəki son vəziyyətə baxılır, artıq
  yazılmış olan keçilir; eyni fərq iki dəfə icra edilsə, ikinci icra heç nə yazmır.
- Proyeksiya nöqtəsi (son əks olunmuş siyahı versiyaları, lövbər sətri, plan anı) dərcçinin çıxış qovluğunda vəziyyət faylında
  saxlanılır; zəncirə ayrıca yazılmır (kontrakt dəyişikliyi yoxdur). Zəncirdən oxuyan etibar mənbəyinin məzmun səviyyəsi bu
  nöqtədən gəlir.

## K6 — Yazı büdcəsi və kvota

Bir icra ən çox müəyyən sayda əməliyyat yazır (standart 500); qalanı növbəti icraya qalır və icra natamam sayılır. Birləşdirmə (K3)
bir status siyahısı üçün icra başına ən çox bir dərc yazdığından siyahı başına gündəlik dərc həddi ([[ADR-0054]] NS3: 48) saatlıq
tezliklə aşılmır. Kvota yenə dolarsa əməliyyat geri qaytarılır, icra natamam sayılır, fərq növbəti icrada sınanır (K5).

## K7 — Nə vaxt işləyir, hara yazır

- Yalnız `TAMGA_CHAIN_ENABLED=1` ikən. Bayraq sönülü ikən sinxronlaşdırma və dərcdən sonrakı qarmaq heç nə etmir: zəncirə qoşulmur,
  fayl yazmır, çıxış vermir ([[ADR-0051]] CH5).
- Başlanğıc nöqtəsi miqrasiyadır: miqrasiya fərqsiz bitir ([[ADR-0073]] CE6) və nöqtəni yazır; nöqtə yoxdursa sinxronlaşdırma yazmır.
  Miqrasiya pəncərəsi açıq ikən və ya heç açılmamışkən sinxronlaşdırma yazmır (açıq pəncərədə yazı miqrasiyanındır).
- Eyni qarmaq sinxronlaşdırmadan sonra siyahı xülasələrini də göndərir (`chain-submit`, [[ADR-0051]] K4); ikisi bir-birini gözləmir,
  biri uğursuz olarsa digəri yenə sınanır.
- Yazı yalnız lokal inkişaf zəncirinə və test zəncirinə edilir. **Real şəbəkəyə yazı yolu yoxdur:** real şəbəkənin açar yolu (aparat
  açar seyfi) və [[ADR-0084]] LS6 şərtləri qərara bağlanmadan alət real şəbəkədə yalnız planı çap edir.

# Açıq suallar üzrə qərarlar (2026-11-15)

1. **Tarix fərqi:** zəncir tarixi blok anı; gecikmə intervalı ekvivalentlikdə soruşulmur; hədəf bir saat, həyəcan siqnalı iki saat (K2).
2. **Şəbəkə səviyyəli qeydlər:** Governance təklifi ilə; alət təklifi açır, səs operatorlarındır; milli qeydləri gözlətmir (K4).
3. **Kvota:** icra başına yazı büdcəsi; status siyahısı başına icra başına bir dərc; kvota dolanda növbəti icra (K6).
4. **Gələcək tarixli qeydlər:** vaxtı çatanda ilk icrada, ayrıca növbə olmadan (K3).
5. **Proyeksiya səviyyəsinin dərci:** zəncirə yeni sahə yazılmır; səviyyə vəziyyət faylında və icra hesabatındadır (K5).
6. **Müstəqil yazıçı rejimi** (ikinci operatorun siyahını ictimai ünvandan endirib özünün yoxlaması və öz səsini verməsi): bu qərardan
   kənardır; ikinci operatorla birlikdə ayrıca iş.

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| **Fərq = plan(indi) − plan(əvvəl), miqrasiyanın plan mühərriki ilə** | **seçildi** | Tək uyğunluq; miqrasiya və davamlı proyeksiya eyni qeydi eyni cür yazır; plan saf və deterministikdir, şəbəkəsiz sınanır |
| Ayrıca "dəyişiklik → əməliyyat" uyğunluğu yazmaq | rədd | İkinci uyğunluq miqrasiyadan ayrıla bilər; ekvivalentlik iki dəfə sübut olunur |
| Siyahıdakı tarixi zəncirə yazmaq (pəncərədən kənarda da) | rədd | [[ADR-0073]] CE1: nümayəndə açarı ələ keçirilərsə tarixçə səssizcə yenidən yazılır; zəncir qərar vermədiyi üçün gecikmə zərərsizdir |
| Bütün ara vəziyyətləri yazmaq | rədd | Eyni blok anında sıfır uzunluqlu pəncərələr; əməliyyat və kvota israfı; siyahı ilə fərqi azaltmır |
| Yazı uğursuz olanda siyahı dərcini dayandırmaq | rədd | [[ADR-0084]] LS4: mənbə şahid səbəbindən dayanmır |
| Proyeksiya səviyyəsini zəncirə yazmaq (yeni kontrakt sahəsi) | rədd (hələlik) | Zəncir qərar vermədiyi üçün lazım deyil; kontrakt dəyişikliyi və yeniləmə xərci |
| Şəbəkə səviyyəli qeydləri pəncərədən kənarda da miqrasiya icraçısı ilə yazmaq | rədd | [[ADR-0074]] PJ3; tək açarın şəbəkə qeydini yazması ikinci operator qapısını boşa çıxarır |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| SP1 | Miqrasiya pəncərəsi bağlandıqdan sonra hər siyahı dərcindən və lövbər sətrindən sonra son əks olunmuş nöqtə ilə indiki siyahı arasındakı fərq miqrasiyanın plan mühərriki ilə zəncir əməliyyatlarına çevrilir; fərq siyahılardakı bütün etibar qeydlərini əhatə edir, şəxsi məlumat və sərbəst mətn ehtiva etmir. |
| SP2 | Pəncərədən kənarda zəncir tarixi blok anıdır (sərt ləğv və status siyahısı dərc anı istisna); siyahı tarixi ilə zəncir tarixi arasındakı interval ekvivalentlikdə soruşulmur; dərcdən zəncirə gecikmə iki saatı keçərsə həyəcan siqnalı yaradır. |
| SP3 | Eyni qeydə eyni icrada düşən ara vəziyyətlərdən yalnız son vəziyyət yazılır; gələcək tarixli qeyd vaxtı çatdıqdan sonrakı ilk icrada yazılır. |
| SP4 | Şəbəkə səviyyəli qeydlər və şəbəkə sxemləri pəncərədən kənarda yalnız Governance səsverməsi ilə yazılır; alət səsverməni keçmir; səs gözləyən qeyd milli qeydlərin yazılmasını gözlətmir. |
| SP5 | Zəncirə yazı xətası siyahı dərcini dayandırmır və dərc əmrinin nəticəsini dəyişmir; həyəcan siqnalı yaradır. Yalnız tam icra proyeksiya nöqtəsini irəli aparır; natamam icranın fərqi növbəti icrada yenidən sınanır; icra zəncirdəki son vəziyyətə baxaraq qaldığı yerdən davam edir. |
| SP6 | Bir icra yazı büdcəsini aşmır və bir status siyahısı üçün ən çox bir dərc yazır; qalanı növbəti icraya qalır. |
| SP7 | Davamlı proyeksiya yalnız `TAMGA_CHAIN_ENABLED=1` ikən, miqrasiya fərqsiz bitdikdən və miqrasiya pəncərəsi bağlandıqdan sonra işləyir; bayraq sönülü ikən heç nə etmir. Yazı yalnız lokal inkişaf və test zəncirinə edilir; real şəbəkəyə yazı yolu real şəbəkənin açar yolu və [[ADR-0084]] LS6 şərtləri qərara bağlanmadan qurulmur. |

# Nəticələr

- `apps/trust-publisher`: saf planlayıcı (`planChainSync`), sinxronlaşdırma əmri və dərcdən sonrakı qarmaq (build, heartbeat, anchor
  əmrlərindən sonra; bayraq sönülü ikən təsirsiz). Miqrasiya əmri fərqsiz bitəndə başlanğıc nöqtəsini yazır.
- `apps/chain-indexer`: pəncərədən kənar icraçı (blok anı, son vəziyyət yoxlaması, Governance yolu, büdcə); plan mühərrikinə istəyə
  bağlı plan anı; ekvivalentlik testinə gecikmə intervalları.
- Testlər: planlayıcı və qarmaq şəbəkəsiz; davamlı ekvivalentlik lokal zəncirdə (miqrasiya → qurum əlavəsi, dayandırma, ləğv,
  birləşdirmə, açar dəyişikliyi, gələcək tarixli iş; hər addımda siyahı = zəncir).
- Kontrakt dəyişikliyi yoxdur. İstehsalda zəncir yenə sönülüdür ([[ADR-0009]] K4, [[ADR-0084]] LS6).
- Əmr və vəziyyət faylı adları layihə rəhbərliyinin təsdiqini gözləyir (kodda təklif adı ilə).

# Status

**Accepted — 2026-11-15.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-15; [[ADR-0084]] ilə eyni qərarın tətbiqi). DECISIONS: D-BC-18.
SP1–SP7 məcburidir.
