---
document_id: ADR-0079
title: "Başqa dövlətin milli sxeminə səlahiyyət: sxem sahibi dövlətin razılığı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Dövlət öz qurumuna bir sxem üçün səlahiyyət verərkən kontrakt yalnız qurumun həmin dövlətə aid olduğunu və sxemin qeydiyyatda
  olduğunu yoxlayır; sxemin kimə aid olduğunu yoxlamır. Beləliklə, dövlət öz qurumuna başqa dövlətin milli sxemi üçün təkbaşına
  səlahiyyət verə bilir. Qərar: bu səlahiyyət yalnız sxem sahibi dövlətin razılığı ilə verilə bilər. Razılıq sxem üzrə açıq
  qeyddir (sxem, səlahiyyət alan dövlət, vaxt pəncərəsi), qarşılıqlı tanınma kontraktında saxlanılır və sxem sahibinin həmin
  dövləti tanımasına bağlıdır. Şəbəkə sxemləri bu qaydadan kənardadır. Tətbiq təxirə salınıb: ikinci dövlət qoşulmazdan əvvəl
  həyata keçirilir.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0054]]", "[[ADR-0073]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0079
source_version: 1.0.0
---

# Qısaca

Hər dövlət öz rəqəmsal sənəd növlərini (milli sxemlərini) özü müəyyən edir: məsələn, bir dövlətin ekvivalentlik sənədi. Qurumun
hansı növ rəqəmsal sənəd verə biləcəyini də qurumun öz dövləti müəyyən edir. Bugünkü kontraktda bu iki qayda bir-birinə bağlı
deyil: dövlət öz qurumuna başqa dövlətin milli sənəd növünü vermək səlahiyyətini yaza bilir və yoxlayan tərəflər bu sənədi
etibarlı sayır. Bu qərar araya sxem sahibi dövlətin razılığını qoyur: razılıq yoxdursa, səlahiyyət yazıla bilməz.

# Kontekst

- [[ADR-0007]]: sxemlərin iki qatı var. **Şəbəkə sxemləri** Governance səsverməsi ilə qeydiyyata alınır və bütün üzvlərə
  açıqdır. **Milli sxemlər** bir dövlətə aiddir; onların `vct` dəyəri həmin dövlətin ad sahəsindədir (`urn:tamga:<cc>:…`,
  [[ADR-0054]] NS1).
- Qurum–sxem səlahiyyətini qurumu qeydiyyata alan dövlət verir (`IssuerRegistry.setSchemaAuthorization`). Yoxlamanın C2 addımı
  bu səlahiyyətə baxır.
- **Bugünkü davranış (kontrakt auditi 2026-11-11).** Səlahiyyət funksiyası iki şeyi yoxlayır: çağıran qurumun dövlətinin
  nümayəndəsidirmi (`onlyOwnerState`); səlahiyyət verilərkən sxem `SchemaRegistry`-də qeydiyyatdadırmı (`UnknownSchema`). Sxemin
  qatına və sahibi olan dövlətə **baxmır**. Nəticə: A dövləti öz qurumuna B dövlətinin milli sxemi üçün B-nin xəbəri olmadan
  səlahiyyət verə bilər; C2 bu səlahiyyəti qəbul edir. B-nin əlindəki yeganə vasitə A-nı və ya həmin qurumu tanımamaqdır
  ([[SPEC-BC-0001]] §5): bu yalnız B-nin öz yoxlayan tərəflərini qoruyur, B-nin sxeminə etibar edən üçüncü dövlətləri qorumur.
- İmzalı siyahı mərhələsində tək milli siyahı və tək operator var; problem ikinci dövlət qoşulanda real olur. Məsələ
  [[SPEC-BC-0001]] §14 bənd 9-da qərar gözləyirdi.
- Suverenlik prinsipi ([[ADR-0002]]): dövlətin qeydini yalnız həmin dövlət dəyişir. Milli sxem həmin dövlətin qeydidir; sxemdən
  kimlərin istifadə edəcəyi də onun qərarıdır.

# Qərar

- **K1 — Qayda.** Dövlət öz qurumuna başqa dövlətin **milli** sxemi üçün yalnız sxem sahibi dövlətin razılığı ilə səlahiyyət
  verə bilər. Razılıq yoxdursa, səlahiyyət yazısı rədd edilir.
- **K2 — Şəbəkə sxemləri əhatədən kənardır.** Governance-ın qeydiyyata aldığı şəbəkə sxemləri üçün səlahiyyət bugünkü kimi
  yalnız qurumun dövlətinin qərarıdır; dövlətin öz milli sxemi üçün səlahiyyət də belədir.
- **K3 — Razılıq sxem üzrə açıq qeyddir.** Razılıq qeydi `(sxem sahibi dövlət, sxem, səlahiyyət alan dövlət)` üçlüyü üçün vaxt
  pəncərəsidir; onu yalnız sxem sahibi dövlətin nümayəndəsi yazır və geri götürür. Qurum üzrə deyil, dövlət üzrədir: hansı
  qurumuna səlahiyyət veriləcəyi səlahiyyət alan dövlətin daxili işidir.
- **K4 — Qarşılıqlı tanınmaya bağlılıq.** Razılıq qeydi qarşılıqlı tanınma kontraktında (`CrossRecognition`) saxlanılır və
  yalnız sxem sahibi dövlət səlahiyyət alan dövləti tanıdığı halda (tanınma rejimi `NONE` olmadıqda) yazıla bilər. Tanınma
  götürülərsə, razılıq da işləmir; ayrıca geri götürmək lazım deyil.
- **K5 — Vaxt qaydası.** Razılıq geri götürüləndə yeni səlahiyyət yazıla bilməz və həmin andan sonra verilən rəqəmsal sənədlər
  C2-də uğursuz olur. Razılıq pəncərəsi daxilində verilmiş rəqəmsal sənədlər etibarlı qalır: C2 rəqəmsal sənədin `iat` anına
  görə həm səlahiyyət pəncərəsinə, həm də razılıq pəncərəsinə baxır ([[ADR-0073]] K5 ilə eyni oxunuş).
- **K6 — Siyahı mərhələsi.** Siyahı dərc edən eyni qaydanı tətbiq edir: bir milli siyahıdakı quruma başqa dövlətin ad
  sahəsindəki `vct` üçün yalnız həmin dövlətin siyahısında və ya şəbəkə qeydlərində qarşılığı olan razılıq qeydi ilə səlahiyyət
  verilir. Bu gün tək milli siyahı olduğundan belə səlahiyyət yoxdur və yazılmır.
- **K7 — Tətbiq vaxtı.** Kod bu qərarla dəyişmir. Kontrakt, siyahı dərc edən və ekvivalentlik testi **ikinci dövlət
  qoşulmazdan əvvəl** tətbiq olunur; o günə qədər tək operator bu cür səlahiyyət yazmır. Adlar və interfeyslər tətbiq zamanı
  təsdiqlənir.

# Qiymətləndirilən seçimlər

| Seçim | Nə | Müsbət | Mənfi | Nəticə |
|---|---|---|---|---|
| **(a) Sxem üzrə açıq razılıq qeydi** | Sxem sahibi dövlət `(sxem, səlahiyyət alan dövlət)` üçün razılıq yazır; səlahiyyət yazısı və C2 bu qeydə baxır | Razılıq görünür, bir-bir geri götürülə bilir, vaxt pəncərəsi rəqəmsal sənəd tarixçəsini qoruyur; tanınmanın bugünkü mənası dəyişmir | Yeni qeyd növü və bir oxunuş daha (qeydiyyat kontraktından tanınma kontraktına) | **qəbul** |
| (b) Tanınma siyasətində sxem əhatəsi | Mövcud tanınma siyasətinə ("həmin dövlətin bu kateqoriyalarını tanıyıram") sxem siyahısı əlavə olunur; siyahıdakı milli sxem həmin dövlətə açılmış sayılır | Yeni qeyd növü yoxdur | Tanınma "kimin sənədini qəbul edirəm" sualıdır; "sxemimdən kim istifadə edə bilər" başqa sualdır. İkisi bir siyahıda birləşərsə, biri dəyişəndə o biri də dəyişir; sxem səviyyəsində tanınma onsuz da ayrıca açıq məsələdir və bu yolla dolayı şəkildə qərara bağlanmış olar | rədd |
| (c) Qadağa | Başqa dövlətin milli sxemi üçün səlahiyyət heç verilə bilməz | Ən sadə | Birgə tanınan milli növləri (məs. bir dövlətin imtahan sənədini verən xaricdəki mərkəzlər) qeyri-mümkün edir; hər biri üçün şəbəkə sxemi istəmək Governance-ı milli işlərə cəlb edir | rədd |
| (d) Sərbəst, tanınma ilə qorunma | Bugünkü vəziyyət | Kod dəyişmir | Sxem sahibi yalnız öz yoxlayan tərəflərini qoruyur; sxeminə etibar edən üçüncü dövlətləri qorumur | rədd |

Qarşılıqlı tanınmaya bağlılıq (K4) iki seçimi birləşdirmir: razılıq ayrı qeyddir (a), lakin tanımadığınız dövlətə sxeminizi aça
bilməzsiniz. Beləliklə, tanınma geri götürüləndə unudulmuş razılıq açıq qalmır.

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| FS1 | Dövlət öz qurumuna başqa dövlətin milli sxemi üçün yalnız sxem sahibi dövlətin həmin dövlət üçün yazdığı, qüvvədə olan razılıq qeydi ilə səlahiyyət verə bilər. Şəbəkə sxemləri və dövlətin öz milli sxemləri bu qaydadan kənardadır. |
| FS2 | Razılıq qeydini yalnız sxem sahibi dövlət yazır və geri götürür; qeyd sxem və səlahiyyət alan dövlət üzrədir, vaxt pəncərəsi daşıyır və yalnız sxem sahibi dövlət səlahiyyət alan dövləti tanıdığı halda qüvvədədir. |
| FS3 | Yoxlamada başqa dövlətin milli sxemi ilə verilmiş rəqəmsal sənəd, sənədin `iat` anında həm qurumun sxem səlahiyyəti, həm də sxem sahibinin razılığı qüvvədə idisə qəbul edilir; razılığın sonradan geri götürülməsi əvvəl verilmiş rəqəmsal sənədləri etibarsız etmir. |

# Nəticələr

- **Tətbiq gözləyir (ikinci dövlət qoşulmazdan əvvəl).** Görüləcək işlər: `CrossRecognition`-da razılıq qeydi və oxunuşu;
  `IssuerRegistry` səlahiyyət yazısında və `isCredentialSchemaAcceptable`-da razılıq yoxlaması (sxemin qatı və sahibi
  `SchemaRegistry`-dən oxunur); hadisələr və indeksləyici; siyahı formatı və dərc edənin yoxlaması; yenidən oynatma və
  ekvivalentlik testi; kod ölçüsü ehtiyatı. Yaddaş düzümünə yalnız əlavə edilir.
- O günə qədər: kontrakt bu səlahiyyətin qarşısını almır (bugünkü davranış, yuxarıda). İşləyən zəncir yoxdur; siyahı
  mərhələsində tək operator belə səlahiyyət yazmır.
- [[SPEC-BC-0001]] §3.4 və §14 bənd 9: "qərar verildi, tətbiq gözləyir".
- Sxem səviyyəsində tanınma ([[SPEC-BC-0001]] §14 bənd 2) bu qərarla bağlanmır; ayrıca məsələdir.

# Status

**Accepted — 2026-11-12.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-12). DECISIONS: D-BC-15. FS1–FS3 məcburidir; tətbiq ikinci
dövlət qoşulmazdan əvvəl həyata keçirilir.
