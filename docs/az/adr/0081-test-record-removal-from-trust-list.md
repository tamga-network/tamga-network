---
document_id: ADR-0081
title: "Sınaq qeydlərinin siyahıdan çıxarılması"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Etibar siyahısından qeyd silinmir (SPEC-TRUST-0001 TL2): qurumun qeydi bağlananda statusu dəyişir, tarixçəsi siyahıda qalır. Bu
  qərar qaydaya tək və dar bir istisna müəyyən edir: qurumların qoşulmasından əvvəl sınaq məqsədilə daxil edilmiş, heç bir real
  şəxsə rəqəmsal sənəd verməmiş və heç bir real təqdimat almamış qeydlər, ilk iştirakçı qurum siyahıya daxil olmazdan əvvəlki
  dövrdə, əsası açıq dəyişiklik jurnalına yazılmaqla çıxarıla bilər. İlk iştirakçı qurum siyahıya daxil olanda istisna bağlanır;
  sınaq yalnız sandbox-da aparılır. Çıxarılan qeydləri daşıyan imzalı siyahı versiyaları arxivdə qalır. İstisna bir dəfə istifadə
  olunub (2026-11-11).
domain: Trust
related: ["[[SPEC-TRUST-0001]]", "[[ADR-0009]]", "[[ADR-0038]]", "[[ADR-0041]]"]
translation_of: ADR-0081
source_version: 1.0.0
---

# Qısaca

Etibar siyahısı reyestr kimidir: qurum şəbəkədən ayrılsa belə sətri silinmir, "bağlandı" kimi işarələnir. Beləliklə həmin qurumun
keçmişdə verdiyi sənədlər bu gün də düzgün qiymətləndirilir. Şəbəkə real qurumlara açılmazdan əvvəl siyahıya sınaq məqsədilə bir
neçə qeyd daxil edilmişdi. Onlar heç bir real şəxsə sənəd verməyib; siyahıda qalmaları oxuyanı yanıldırdı. Bu qərar yalnız belə
sınaq qeydlərinin və yalnız ilk real qurum qoşulana qədər çıxarıla biləcəyini deyir. Real qurumun qeydi heç vaxt silinmir.

# Kontekst

- [[SPEC-TRUST-0001]]/TL2: siyahı versiyaları yalnız artır, hər versiya özündən əvvəlkinin xülasəsini daşıyır, heç bir sətir və ya
  qeyd silinmir; status dəyişikliyi `status_history`-ə əlavə edilir. Əsas: yoxlama rəqəmsal sənədin verildiyi andakı statusa
  baxır; qeydi silinən qurumun əvvəlki sənədləri qiymətləndirilə bilməz.
- **Fakt.** 2026-11-11-də real şəbəkənin ölkə siyahısından, qurumların qoşulmasından əvvəlki sınaq dövründən qalan qeydlər
  çıxarıldı (siyahı versiyası 241): iki sınaq qurumuna aid iki sənəd verən qeydi, bir etibar edən tərəf qeydi və iki keçid
  qrupu. Qeydlər artıq `REVOKED` statusunda idi və heç bir real qurum tərəfindən istifadə edilməmişdi. Çıxarma açıq dəyişiklik
  jurnalına adsız sətirlə yazıldı; əvvəlki siyahı versiyaları arxivdədir.
- Bu istisna indiyədək yalnız SPEC-TRUST-0001 §4-də qeyd kimi dururdu; bir qərara bağlı deyildi. Sərhədi yazılmamış istisna
  gələcəkdə real qurumun qeydi üçün də presedent göstərilə bilər.
- Sınaq üçün ayrı şəbəkə var ([[ADR-0038]]); qurumlar sınaq qurumlarını orada açır və həmin qeydlər orada hər gecə silinir
  ([[ADR-0041]]). Real şəbəkənin siyahısına sınaq qeydi daxil etməyə artıq ehtiyac yoxdur.

## Dərcçidəki çıxarma yolu (bugünkü davranış)

Siyahı dərcçisi hər dərcdə yeni siyahını əvvəlki dərcin **imzalı** versiyası ilə müqayisə edir. Əvvəlki versiyada olan sənəd
verən, etibar edən tərəf, keçid qrupu, kök CA və ya sxem yeni siyahıda yoxdursa (yaxud siyahıda qalan qeyddən bir istifadə, sxem
səlahiyyəti və ya status tarixçəsi sətri əskilibsə) **dərc dayanır**. Məqsəd mənbə faylından səhvən silinən qeydin səssizcə
dərcdən çıxmamasıdır.

Dərcin keçməsinin yeganə yolu reyestrdə açıq yazılmış təsdiqlənmiş çıxarma qeydidir (`removals.json`). Qeyd bunları daşıyır:
siyahının adı, qərarın tarixi, çıxarmadan əvvəlki imzalı versiyanın nömrəsi (aşağıda tətbiq qeydi), çıxan qeydlərin növlərinə görə **sayları** və qısa əsas. Ad və ya kimlik daşımır. Saylar dərcçinin
hesabladığı fərqlə tam uyğun gəlməsə, dərc yenə dayanır; yəni qeyd yalnız təsdiqlənmiş çıxarmanı keçirir, artığını keçirmir.
Dərc ediləndə əsas, saylar və qərarın tarixi açıq dəyişiklik jurnalına tək sətirlə yazılır; əvvəlki versiyalar arxivdə qalır.

Status əmrlərindəki `--reason` (məs. `status <slug> REVOKED --reason …`) çıxarma üçün deyil, **status dəyişikliyi** üçündür:
qeyd siyahıda qalır, əsas `status_history`-ə daxil olur. Çıxarmanın əsası əmr sətrindən deyil, təsdiqlənmiş çıxarma qeydindən
gəlir. Sandbox-da bu yoxlama tətbiq edilmir (sınaq qurumları orada hər gecə silinir).

# Qərar

- **K1 — Ümumi qayda dəyişmir.** Real qurumun qeydi silinmir. Qurum ayrılarsa, bağlanarsa və ya şəbəkədən çıxarılarsa, qeydinin
  statusu dəyişir (`SUSPENDED`, `REVOKED`, `RETIRED`) və tarixçəsi siyahıda qalır. Kök CA və sxem qeydləri üçün də eynidir.
- **K2 — İstisna dardır: yalnız sınaq qeydi.** Çıxarıla bilən qeyd bu şərtlərin **hamısına** cavab verir: (i) qurumların
  qoşulmasından əvvəl, sınaq məqsədilə daxil edilib; (ii) heç bir real şəxsə rəqəmsal sənəd verməyib (sənəd verən qeydidirsə) və
  heç bir real təqdimat almayıb (etibar edən tərəf qeydi və ya keçid qrupudursa); (iii) çıxarma ilk iştirakçı qurum real
  şəbəkənin siyahısına daxil olmazdan əvvəl edilir. Çıxarma layihə rəhbərliyinin qərarı ilə edilir və əsası açıq dəyişiklik
  jurnalına yazılır; sətir ad və kimlik daşımır.
- **K3 — İstisna özü bağlanır.** İlk iştirakçı qurumun real şəbəkənin siyahısına daxil olduğu dərcdən sonra real şəbəkənin
  siyahısından heç bir qeyd çıxarılmır. Sınaq yalnız sandbox-da aparılır; real şəbəkənin siyahısına sınaq qeydi daxil edilmir.
  *İştirakçı qurum:* sınaq məqsədilə daxil edilməmiş və şəbəkənin müvəqqəti operatorunun öz xidməti olmayan sənəd verən və ya
  etibar edən tərəf.
- **K4 — Arxiv qalır.** Çıxarılan qeydləri daşıyan imzalı siyahı versiyaları arxivdə durur və dəyişdirilmir. Versiya nömrəsi və
  xülasə zənciri çıxarma ilə qırılmır: çıxarmanın edildiyi versiya da özündən əvvəlkinin xülasəsini daşıyır. İstəyən hər kəs
  qeydin hansı versiyalarda olduğunu arxivdən görə bilər.
- **K5 — İndiyədək tək istifadə.** İstisna bir dəfə istifadə olunub (2026-11-11, yuxarıdakı fakt). Bu qərar həmin istifadəni
  qeydə bağlayır və sərhədini yazır.

# Qiymətləndirilən seçimlər

| Seçim | Nəticə | Niyə |
|---|---|---|
| **Dar və müddətli istisna: yalnız sınaq qeydi, ilk iştirakçı quruma qədər** | **qəbul** | Ümumi qayda pozulmur; istisnanın şərti və sonu yazılıdır; əsas hamıya açıqdır; arxiv qalır |
| İstisna yoxdur: sınaq qeydləri `REVOKED` kimi siyahıda həmişəlik qalır | rədd | Siyahı hamıya açıqdır; heç vaxt qurum olmamış qeydlər şəbəkənin iştirakçıları kimi oxunur və yanıldır. Qeydlərin saxlanmasını tələb edən sənəd də yoxdur |
| Müddətsiz istisna: sınaq qeydi istənilən vaxt çıxarıla bilər | rədd | "Sınaq qeydi" sərhədi zamanla genişlənir; real şəbəkədə sınaq vərdişini davam etdirir. Sandbox varkən ehtiyac yoxdur |
| İstisnanı yalnız spesifikasiya qeydində saxlamaq | rədd | Qərara bağlı olmayan istisna presedent olur; şərti və sonu qeyri-müəyyən qalır |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| RR1 | Real şəbəkənin etibar siyahısından qeyd silinmir: sənəd verən, etibar edən tərəf, keçid qrupu, kök CA və sxem qeydi bağlananda statusu dəyişir, tarixçəsi siyahıda qalır ([[SPEC-TRUST-0001]]/TL2). Real qurumun qeydi üçün istisna yoxdur. |
| RR2 | Siyahıdan yalnız sınaq qeydi çıxarıla bilər: qurumların qoşulmasından əvvəl sınaq məqsədilə daxil edilmiş, heç bir real şəxsə rəqəmsal sənəd verməmiş və heç bir real təqdimat almamış qeyd. Çıxarma layihə rəhbərliyinin qərarı ilə edilir; əsası, qeydlərin sayı və qərarın tarixi açıq dəyişiklik jurnalına ad və kimlik daşımayan sətirlə yazılır. Dərcçi sayları tam uyğun gələn təsdiqlənmiş çıxarma qeydi olmadan qeydi azalmış siyahını dərc etmir. |
| RR3 | İstisna ilk iştirakçı qurumun (sınaq məqsədilə daxil edilməmiş və şəbəkənin müvəqqəti operatorunun öz xidməti olmayan sənəd verən və ya etibar edən tərəf) real şəbəkənin siyahısına daxil olduğu dərclə bağlanır; bundan sonra real şəbəkənin siyahısından heç bir qeyd çıxarılmır. Sınaq yalnız sandbox-da aparılır; real şəbəkənin siyahısına sınaq qeydi daxil edilmir. |
| RR4 | Çıxarılan qeydləri daşıyan imzalı siyahı versiyaları arxivdə qalır və dəyişdirilmir; çıxarma versiya nömrəsini və xülasə zəncirini qırmır. |

# Nəticələr

- Kod bu qərarla dəyişmir: dərcçinin yoxlaması və təsdiqlənmiş çıxarma qeydi bugünkü halı ilə RR2 və RR4-ün maşınla yoxlanılan
  hissəsini qarşılayır (saylar tam uyğun, adsız sətir, arxiv).
- Dərcçi qeydin "sınaq qeydi" olub-olmadığını və ilk iştirakçı qurumun siyahıya daxil olub-olmadığını özü bilə bilməz; RR2-nin
  şərti və RR3-ün bağlanması qərar səviyyəsində yoxlanılır. İlk iştirakçı qurum siyahıya daxil olduqdan sonra real şəbəkənin
  reyestrinə yeni çıxarma qeydi yazılmır. Bağlanmanın dərcçidə maşınla məcbur edilməsi ilk qurumun qoşulması ilə birlikdə ələ
  alınır.
- **Tətbiq qeydi (2026-11-12, ikinci yoxlama; qərarın məzmunu dəyişməyib) — çıxarma qeydi tək keçidə bağlıdır.** Təsdiqlənmiş
  çıxarma qeydi etibarlı olduğu versiya keçidini də daşıyır: çıxarmadan əvvəlki imzalı siyahı versiyasının nömrəsi
  (`previous_version`, məcburi) və istəyə bağlı olaraq həmin versiyanın imzalı faylının xülasəsi (`previous_version_hash`).
  Dərcçi qeydi yalnız əvvəlki dərc olunmuş versiya budursa qəbul edir; dərc ediləndə versiya irəliləyir və qeyd öz-özünə
  etibarsız qalır. Əvvəlki halda qeyd yalnız siyahının adı və saylarla uyğunlaşırdı: eyni sayda **başqa** qeydin sonradan
  silinməsini də keçirər və jurnala köhnə əsası yazardı; RR2-nin "yalnız təsdiqlənmiş çıxarma" şərti maşınla tam
  qarşılanmırdı. 2026-11-11 istifadəsinin qeydi 240 → 241 versiya keçidinə bağlandı. Eyni turda RR1-in maşınla yoxlanılan
  hissəsi genişləndi: siyahıda qalan qeyddə tarixçə sətri dəyişdirilə bilməz (məs. ləğvin sənədləri etibarsız edən tarixi irəli
  çəkilə bilməz), bağlanmış sxem səlahiyyəti yenidən açıla bilməz; səlahiyyətli açarın və LOTL qeydlərinin (ölkə siyahısı qeydi,
  cüzdan təminatçısı, xarici siyahı) silinməsi də sayılır ([[SPEC-TRUST-0001]] versiya qeydi, TL2).
- [[SPEC-TRUST-0001]] §4 və TL2 bu qərara istinad edir.
- Zəncirə keçiddə ([[ADR-0009]]) arxiv versiyaları ardıcıl yenidən oynadılır. Çıxarılmış sınaq qeydləri arxiv versiyalarında
  var; yenidən oynatmanın onları necə emal etdiyi ekvivalentlik testində ([[SPEC-TRUST-0001]]/TL10) yoxlanılır.

# Status

**Accepted — 2026-11-12.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-12). DECISIONS: D-TRUST-7. RR1–RR4 məcburidir.
