---
document_id: ADR-0037
title: "Tamga Network yalnız şəbəkədir"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-02
summary: >
  Tamga Network şəbəkədir: qaydaları, etibar siyahılarını, sxem kataloqunu, açıq paketləri və şəbəkənin işləməsi üçün lazım olan istinad xidmətlərini idarə edir; xidmət satmır. Kommersiya xidmətləri (inteqrasiya, dəstək, müqavilə əsasında hostinq, konsaltinq, connector) şəbəkədən kənar şirkətlərin işidir. Tamga Wallet şəbəkənin ilk rəqəmsal cüzdanıdır, lakin ayrıca məhsuldur. ADR-0035-in üçüncü qatı ("məhsul və xidmətlər") bu qərarla dəyişir.
domain: Governance
translation_of: ADR-0037
source_version: "1.0.0"
---

# Qısaca

Tamga Network şirkət deyil, şəbəkədir. Şəbəkə qaydaları yazır, etibar siyahılarını dərc edir və hər kəsin istifadə edə biləcəyi açıq
kodu və istinad xidmətlərini idarə edir. Bunların heç biri satılmır. Qurumlara ödənişli inteqrasiya, dəstək və ya konsaltinq təklif etmək
istəyən hər bir şirkət bunu şəbəkədən kənarda, öz adı ilə edir; şəbəkənin qaydaları onlar üçün də eynidir.

# Kontekst

[[ADR-0035]] Tamga-nı üç qatda yerləşdirdi: baza qat — Avropa İttifaqı (Aİ) ilə uyğunluq, Tamga Network — yüngül [[t:federation]], üçüncü qatda isə
"məhsul və xidmətlər" (Tamga Wallet və qurumlara xidmətlər). Həmin qeyd məlum bir gərginliyi də qeyd etdi: Aİ modelində siyahını
idarə edən qurumun xidmət satması maraqlar toqquşması sayılır və şəbəkənin idarəetməsi ilə xidmət şirkəti zamanla bir-birindən ayrılmalıdır.

Bu ayrılma artıq həyata keçirildi. İş üç ayrı struktura bölündü: Tamga Network (şəbəkə), Tamga Wallet (rəqəmsal cüzdan məhsulu) və şəbəkədən kənarda
Aİ–TR uyğunluğu üçün xidmət göstərən şirkət. Şəbəkənin öz sənədlərində xidmət satışına dair təsvir qalmamalıdır.

# Qərar

**K1 — Tamga Network yalnız şəbəkədir.** Şəbəkənin işi:

- qaydalar: Tamga ARF, Trust Framework, Tamga Rulebook və rəqəmsal sənəd növlərinin rulebook-ları;
- etibar: ölkə [[t:trust-list|etibar siyahıları]], [[t:LOTL]], qeydiyyat və təsdiq prosesi, federasiya (xarici siyahılar);
- ümumi məlumatlar: sxem kataloqu;
- açıq kod: `@tamga-network/*` paketləri və uyğunluq testləri;
- istinad xidmətləri: etibar siyahısının dərc edicisi, qeydiyyat aləti, host edilən rəqəmsal sənəd verilməsi və Qurum Konsolu, Tamga Verify, müvəqqəti
  şəxsiyyət xidməti. Bunlar şəbəkənin işləməsi, sınaqdan keçirilməsi və qurumların qoşulması üçündür; satılmır.

**K2 — Şəbəkə xidmət satmır.** İnteqrasiya, dəstək, müqavilə əsasında hostinq və xidmət səviyyəsi öhdəliyi, konsaltinq, connector və
oxşar kommersiya xidmətləri şəbəkədən kənar şirkətlər tərəfindən, öz adları ilə təqdim olunur. Bu şirkətlərdən biri Tamga komandasının qurduğu
şirkətdir; şəbəkə onu digərlərindən fərqləndirmir.

**K3 — ADR-0035-in üçüncü qatı dəyişir.** "Məhsul və xidmətlər" əvəzinə: **şəbəkənin üzərindəkilər** — şəbəkənin qaydalarına əməl edən
rəqəmsal cüzdanlar (birincisi Tamga Wallet) və xidmət provayderləri. Bunlar şəbəkənin hissəsi deyil, şəbəkənin iştirakçıları və ya istifadəçiləridir.

**K4 — Tamga Wallet ayrıca məhsuldur.** Şəbəkənin ilk və istinad rəqəmsal cüzdanıdır; öz repozitoriyasında, öz qərarlar silsiləsi ilə inkişaf edir və
şəbəkənin qaydalarına hər bir rəqəmsal cüzdan kimi əməl edir.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| PO5 | Tamga Network xidmət satmır; şəbəkənin sənədlərində və saytlarında qiymət, satış və ya kommersiya xidməti təsviri olmur. Kommersiya xidmətləri provayderin adı ilə, şəbəkədən kənarda təqdim olunur. |
| PO6 | Şəbəkənin istinad xidmətləri və qeydiyyat prosesi bütün iştirakçılar üçün eyni şərtlərlə açıqdır; heç bir xidmət provayderinə, Tamga komandasının şirkəti də daxil olmaqla, üstünlük və ya imtiyaz verilmir. |

# Əsaslandırma / alternativlər

| Variant | Nəticə | Səbəb |
|---|---|---|
| Xidmətlər şəbəkənin daxilində qalır (ADR-0035 vəziyyəti) | rədd | Siyahını idarə edən tərəfin xidmət satması Aİ modelində maraqlar toqquşmasıdır; dövlətlərin və digər şirkətlərin şəbəkəyə etibar etməsini çətinləşdirir. |
| **Şəbəkə yalnız şəbəkədir; xidmətlər şəbəkədən kənardadır** | **qəbul** | Şəbəkə neytral qalır, fonda və ya dövlətlərə verilməsi asanlaşır; kommersiya işi eyni komanda tərəfindən, lakin ayrı şirkət vasitəsilə aparılır. |

# Nəticələr

- [[ADR-0035]]-in üçüncü qatı bu qərarla dəyişir; PO1–PO4 qüvvədə qalır.
- Tamga ARF əsas sənədinin mövqeləndirmə bölməsi (§1.5) və idarəetmə bölməsi (§8.3) buna uyğun yenilənir.
- tamga.network şəbəkənin səsi ilə danışır: "Şəbəkəyə qoşulun" səhifəsi qoşulmanı izah edir, satış dili daşımır.
- Kommersiya xidmətləri şirkətin sənədlərində və saytında təsvir olunur (şirkətin öz qərarlar silsiləsi).

# Status

**Accepted — 2026-10-02** (layihə rəhbərliyinin təsdiqi; hərfi sitat xüsusi təsdiq qeydindədir).
