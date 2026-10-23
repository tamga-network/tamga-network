---
document_id: ADR-0064
title: "Şəxsiyyət sənədində yaş həddləri: `age_over_15` və `age_over_NN` nümunəsi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  Şəxsiyyət sənədi bu gün bir yaş sahəsi daşıyır: `age_over_18`. Bu qərar ikinci həddi əlavə edir: `age_over_15`, SD-JWT VC-də və mdoc-da (`tamga.id.1`) eyni adla, ISO/IEC 18013-5-in `age_over_NN` nümunəsinə görə. Şəxsiyyət sənədinin yaş həddləri qapalı çoxluqdur (bu gün 15 və 18) və yalnız ADR ilə dəyişir. Məxfilik `age_over_18` ilə eynidir: şəxsiyyət xidməti dəyəri buraxılış anında doğum tarixindən törədir, sahə seçici açıqlanır, yoxlayan tərəf doğum tarixini görmür. Sıfır bilik sübutu sxemi bərabərlik sübutudur, hədd sxemdə sabit deyil; eyni sxem `age_over_15 = true` sübut edir, ZK nüsxəsi hər iki həddi daşıyır. Səbəblərdən biri Türkiyədə 7578 saylı Qanunla sosial şəbəkələr üçün gətirilən 15 yaş qaydasıdır (qüvvəyə minmə 2026-11-01); qərar hüquqi rəy deyil. Əvvəl verilmiş rəqəmsal sənədlər sahəni yenidən veriləndə alır (inkişaf mərhələsi, ADR-0029). Qəbul: 2026-10-23.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0029]]", "[[ADR-0032]]", "[[ADR-0039]]", "[[ADR-0043]]", "[[ADR-0044]]", "[[ADR-0045]]", "[[FW-RB-0003]]", "[[SPEC-ID-0003]]", "[[SPEC-SCHEMA-0003]]"]
translation_of: ADR-0064
source_version: "1.0.0"
---

# Qısaca

Şəxsiyyət sənədi artıq "bu şəxs 18 yaşdan yuxarıdırmı" sualı ilə yanaşı "15 yaşdan yuxarıdırmı" sualına da cavab verir:
`age_over_15`. Ad ISO/IEC 18013-5-in yaş elementləri ilə eyni nümunədədir (`age_over_NN`). Yoxlayan tərəf yalnız bəli/xeyr görür;
doğum tarixi paylaşılmır. Sıfır bilik sübutu da eyni sxemlə işləyir. Yeni yaş həddi yalnız yeni qərarla əlavə edilir.

# Kontekst

- **Bu gün.** Şəbəkənin şəxsiyyət sənədi (`urn:tamga:id:IdentityAttestation:1`, [[ADR-0011]]) bir törəmə yaş sahəsi daşıyır:
  `age_over_18`. Ad ISO/IEC 18013-5-dən gəlir və hər iki formatda eynidir; Aİ PID çoxluğunda yaş sahəsi yoxdur, sahə Tamga-nın
  sahəsidir ([[ADR-0045]]). Sıfır bilik sübutunun ilk predikatı da bu sahədir ([[ADR-0032]], [[ADR-0044]]).
- **Nümunə.** ISO/IEC 18013-5 (mDL) yaş üçün `age_over_NN` elementlərini müəyyən edir: NN iki rəqəmli yaşdır, dəyər boolean-dır;
  sənədi verən qurum hansı həddləri daşıyacağını seçir. Aİ-nin yaş yoxlaması üzrə işləri eyni adlandırmadan istifadə edir.
  Şəbəkənin sektor sxemi qaydası da törəmə boolean sahələri əvvəlcədən müəyyən etməyi tələb edir ([[SPEC-SCHEMA-0003]] SG3).
- **Türkiyə.** 7578 saylı Qanunun (Rəsmi Qəzet 2026-05-01) 22-ci maddəsi ilə 5651 saylı Qanunun Əlavə 4-cü maddəsinə əlavə edilən
  bənd sosial şəbəkə provayderinin 15 yaşını tamamlamamış uşaqlara xidmət göstərməməsini və bunun üçün yaş yoxlaması daxil olmaqla
  lazımi tədbirləri görməsini nəzərdə tutur; 27-ci maddəyə görə bu müddəa dərcdən altı ay sonra, **2026-11-01**-də qüvvəyə minir.
  Qanun nəticəni müəyyən edir, üsulu ikinci dərəcəli tənzimləməyə buraxır. Bu gün şəxsiyyət sənədi 15 yaş sualına doğum tarixini
  açmadan cavab verə bilmir.
- **Bu qərar hüquqi rəy deyil.** Platformanın öhdəliyini necə yerinə yetirəcəyini, hansı üsulun kifayət sayılacağını və ya ikinci
  dərəcəli tənzimləmənin nə gətirəcəyini müəyyən etmir. Yalnız şəbəkənin şəxsiyyət sənədinin 15 yaş sualına ən az məlumatla cavab
  verməsini təmin edir. Şəbəkə yaş həddi qoymur ([[ADR-0043]]); bu qərar bunu dəyişmir.

# Qərar

## K1 — `age_over_15`

- Şəxsiyyət sənədi `age_over_15` (boolean) daşıyır: SD-JWT VC-də claim, mdoc-da `tamga.id.1` ad sahəsində element, hər iki formatda
  eyni ad.
- Dəyəri şəxsiyyət xidməti buraxılış anında doğum tarixindən törədir; qayda `age_over_18` ilə eynidir: xidmət saatının UTC təqvim
  günü, şəxs 15-ci doğum gününün başladığı gün həddi keçir, 29 fevralda doğulanlar uzun olmayan illərdə 1 martda. 15 yaşdan kiçik
  şəxsin sənədində dəyər `false`-dur.
- Sahə seçici açıqlanır (`sd: always`), törəmə sahələr siyahısındadır, sxemdə məcburi deyil (`age_over_18` kimi).

## K2 — `age_over_NN` nümunəsi və qapalı çoxluq

- Şəbəkənin yaş sahələri ISO/IEC 18013-5 `age_over_NN` nümunəsinə uyğundur: NN iki rəqəmli yaş, dəyər boolean, hər iki formatda
  eyni ad.
- Şəxsiyyət sənədinin yaş həddləri qapalı çoxluqdur: bu gün **{15, 18}**. Yeni hədd (məs. 13, 16, 21) yalnız ADR ilə əlavə edilir.
  Çoxluqda olmayan həddi istəyən yoxlayan tərəf uyğunluq tapmır; rəqəmsal cüzdan həddi özü hesablamır.
- Sürücülük vəsiqəsi məlumatı ([[ADR-0039]]) yalnız `age_over_18` daşımağa davam edir; bu qərar yalnız şəxsiyyət sənədini əhatə edir.

## K3 — Məxfilik `age_over_18` ilə eynidir

- Yaş sahəsi törəmə bəli/xeyr-dir; yaş yoxlamasında doğum tarixi açılmır. Hər hədd ayrıca açıqlanır; rəqəmsal cüzdan yalnız
  istənilən həddi göstərir.
- İki həddi birlikdə açmaq yaş aralığını (15–17) üzə çıxara bilər. Buna görə şəbəkənin yoxlama siyasətləri tək hədd istəyir; hər
  ikisini istəyən əhatə yoxlayan tərəfin qeydiyyatında ayrıca əsaslandırılmalıdır.

## K4 — Sıfır bilik sübutu

- Longfellow sxemi (versiya 8, bir atribut; [[ADR-0032]]) bərabərlik sübutudur: "bu ad sahəsində bu element bu dəyərdir". Hədd
  sxemdə sabit deyil; eyni sxem `age_over_15 = true` sübut edir. Yeni sxem və ya yeni quraşdırma lazım deyil; etibar siyahısındakı
  sxem qeydi dəyişmir.
- ZK nüsxəsi ([[ADR-0044]]) şəxsiyyət sənədinin yaş sahələrini daşıyır: `age_over_18` və `age_over_15`. Yeniləmə tokenindəki
  minimal elementlər buna uyğundur; başqa fərdi sahə tokenə və nüsxəyə daxil olmur.

## K5 — Yoxlayan tərəf və rəqəmsal cüzdan

- Tamga Verify iki ümumi siyasət açır: `age-over-15-mdoc` (ISO 18013-5 mdoc, yalnız bəli/xeyr) və `age-over-15-zk` (ZK nüsxəsi,
  sıfır bilik sübutu). Etibar siyahısında Tamga Verify-ın qeydiyyatına `age-over-15-1` və `age-over-15-zk-1` əhatələri əlavə edilir.
  Brauzer sınaq səhifəsi 15 yaş seçimi təklif edir.
- Rəqəmsal cüzdan sahəni şəxsin dilində adlandırır ("15 yaşdan yuxarı"). Cüzdandan cüzdana göstərmə ayrıca cüzdan qərarıdır; bu
  gün `age_over_18` ilə məhdud qalır.

## K6 — Keçid yoxdur

- Növ, `vct`, mdoc docType və ad sahəsi dəyişmir. Sxem metadata-sı inkişaf mərhələsi qaydası ilə yerində düzəldilir ([[ADR-0029]]);
  `vct#integrity` dəyəri dəyişir.
- Əvvəl verilmiş rəqəmsal sənədlər `age_over_15` daşımır; şəxs sənədi yenidən alanda sahə gəlir. Keçid kodu yazılmır.

# Nəzərdən keçirilmiş variantlar

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Yoxlayan tərəf doğum tarixini istəsin, yaşı özü hesablasın | rədd | Lazım olandan çox məlumat; seçici açıqlamanın məqsədinə ziddir |
| Rəqəmsal cüzdan həddi doğum tarixindən özü hesablasın | rədd | Sənədi verənin imzası dəyəri əhatə etmir; yoxlayan tərəf nəticəyə etibar edə bilməz |
| Şəxsiyyət sənədində açıq hədd çoxluğu (istənilən NN) | rədd | Sənəddə hədsiz sahə, yoxlayan tərəflər arasında uyğunsuzluq; çoxluq şüurlu böyüməlidir |
| Həddi ZK sxeminin parametri etmək (aralıq sübutu) | rədd (bu gün) | Yeni sxem və yoxlayan tərəfdə dəyişiklik tələb edir; bərabərlik sxemi kifayətdir |
| 13, 16 və 21-i də indi əlavə etmək | rədd (bu gün) | Konkret ehtiyac yoxdur; hər hədd ehtiyac yarananda ayrıca ADR ilə |
| **`age_over_15`, ISO `age_over_NN` nümunəsi, qapalı çoxluq {15, 18}** | **seçildi** | Standart ad, eyni məxfilik, eyni sxem, kiçik dəyişiklik |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| YE1 | Şəxsiyyət sənədinin yaş sahələri ISO/IEC 18013-5 `age_over_NN` adı və boolean dəyərlə, SD-JWT VC-də və mdoc-da eyni adla daşınır. Hədd çoxluğu qapalıdır (bu gün 15 və 18); yeni hədd yalnız ADR ilə əlavə edilir. |
| YE2 | Yaş sahəsi buraxılış anında şəxsiyyət xidmətində doğum tarixindən törədilir və seçici açıqlanır; yaş yoxlaması doğum tarixini açmır; şəbəkənin yoxlama siyasətləri tək hədd istəyir. |
| YE3 | ZK nüsxəsi şəxsiyyət sənədinin yaş sahələrindən başqa fərdi sahə daşımır; yeni yaş həddi bərabərlik sxemi ilə sübut edilir, sxem qeydi dəyişmir. |

# Nəticələr

- Sxem kataloqu: şəxsiyyət sənədi və ZK nüsxəsi növlərinə `age_over_15` (`packages/schemas`).
- Şəxsiyyət xidməti: törətmə və ZK nüsxəsi elementləri.
- Tamga Verify: `age-over-15-mdoc`, `age-over-15-zk`; etibar siyahısı əhatələri (real şəbəkə və sandbox); brauzer sınaq səhifəsi.
- Rəqəmsal cüzdan: sahə adları (tr, en, tk).
- Sənədlər: şəxsiyyət rulebook-u ([[FW-RB-0003]]) və şəxsiyyətin təsdiqi spesifikasiyası ([[SPEC-ID-0003]]).
- Növbəti iş: cüzdandan cüzdana göstərmədə yaş həddi seçimi (cüzdan qərarı); başqa həddlər ehtiyac yarananda ayrıca ADR ilə.

# Status

**Accepted — 2026-10-23** (layihə rəhbərliyinin təsdiqi; hərfi sitat xüsusi təsdiq qeydində). DECISIONS: D-ID-14. YE1–YE3
məcburidir.
