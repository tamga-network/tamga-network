---
document_id: ADR-0076
title: "İki üzvlü şəbəkədə çıxış və idarəetmənin davamlılığı"
status: Proposed
version: 1.0.0
created: 2026-11-11
last_updated: 2026-11-11
summary: >
  Governance kontraktında minimal mütləq səs sayı 2-dir. Aktiv üzv sayı 2 ikən bir üzv birtərəfli çıxarsa (`withdraw`), say 1-ə
  düşür; qalan üzv heç bir təklifi icra edə bilmir, yeni üzv qəbul edə bilmir və özü də çıxa bilmir: idarəetmə həmişəlik
  kilidlənir. Çıxış hüququ (ADR-0002 #5) ilə idarəetmənin davamlılığı bu nöqtədə toqquşur. Təklif: (a) aktiv üzv sayı 2 ikən
  `withdraw` rədd edilir; çıxmaq istəyən üzv əvvəlcə üçüncü üzvün qəbulunu gözləyir. Alternativ (b): çıxış sərbəst qalır, tək üzv
  qalanda hədd 1-ə enir. Tövsiyə olunan (a). Həmçinin tək təsisçili quruluşun yalnız yerli inkişafda qalıb-qalmayacağı soruşulur.
  Qərar gözlənilir.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]"]
translation_of: ADR-0076
source_version: 1.0.0
---

# Qısaca

Şəbəkənin ortaq qərarları (yeni üzvün qəbulu, yeniləmə, şəbəkə sxemi) ən azı iki üzvün səsi ilə qəbul edilir. Şəbəkədə iki üzv
olanda biri öz istəyi ilə çıxarsa, tək üzv qalır və tək üzv heç bir qərarı təkbaşına qəbul edə bilmir. Yeni üzv də qəbul edilə
bilmədiyi üçün şəbəkə bu vəziyyətdən çıxa bilmir. Bu təklif həmin nöqtəyə düşməyin qarşısını alan qaydanı müəyyən edir.

# Kontekst

- [[ADR-0002]] #5: dövlət birtərəfli `withdraw()` ilə çıxa bilər; səsvermə tələb olunmur, təminat kod səviyyəsindədir.
- [[SPEC-BC-0001]] §1 (müstəqil yoxlama tapıntısı R6): 2/3 qaydası üç üzvdən az olduqda mənasını itirdiyi üçün `requiredVotes`
  heç vaxt 2-dən aşağı düşmür. Eyni bölmə iki üzvlü şəbəkədə çıxarmanın mümkün olmadığını, hər iki tərəfin "yalnız könüllü
  `withdraw` edə biləcəyini" deyir.
- Kontrakt auditi (2026-11-11), testlə təsdiqləndi: aktiv üzv sayı 2 ikən `withdraw` sayı 1-ə endirir. Bundan sonra
  - qalan üzvün hər təklifi `ThresholdNotMet(1, 2)` ilə düşür (yeni üzvün qəbulu daxil);
  - qalan üzv çıxa bilmir (`LastValidator`);
  - kontraktlar yenilənə bilmir, şəbəkə sxemi yazıla bilmir, siyahı lövbəri yazıcıları və köç rejimi idarə oluna bilmir.
  Milli qeydlər təsirlənmir (qalan dövlət öz qeydlərini yazmağa davam edir); kilidlənən şəbəkə səviyyəli idarəetmədir və geri
  dönüşü yoxdur.
- Eyni vəziyyət quruluşda da yarana bilər: `initialize` tək təsisçini qəbul edir; tək üzvlə heç bir təklif icra oluna bilmir. Bu
  gün bu yalnız yerli inkişaf quraşdırmalarında istifadə olunur. İstehsal zənciri yoxdur və ən azı iki müstəqil operatorla açılır
  ([[ADR-0009]] K4).
- İki bağlanmış qayda toqquşduğu üçün kod dəyişdirilmədi; bu sənəd qaydanı təklif edir.

# Seçimlər

| Seçim | Nə | Müsbət | Mənfi |
|---|---|---|---|
| **(a) İki üzvdə çıxış gözləyir** | Aktiv üzv sayı 2 ikən `withdraw` rədd edilir. Çıxmaq istəyən üzv əvvəlcə üçüncü üzvün qəbulunu gözləyir, sonra çıxır | İdarəetmə heç vaxt kilidlənmir; kiçik və yerli kod dəyişikliyi; R6 qorunur | Çıxış hüququ iki üzvlü şəbəkədə təxirə düşür: digər üzv yeni üzvün qəbuluna səs verməsə, çıxış zəncirdə baş tutmur (üzv validatorunu dayandıra və qeyd yazmağı saxlaya bilər, amma üzv sayılmağa davam edir) |
| **(b) Tək üzvdə hədd 1** | `withdraw` sərbəst qalır. Aktiv üzv sayı 1 ikən `requiredVotes` 1 qaytarır; qalan üzv yeni üzv qəbul edə bilir | Çıxış hüququ tam qorunur; kilid yaranmır; tək təsisçili quruluş da işləyir | Qalan tək üzv şəbəkə səviyyəsindəki hər qərarı təkbaşına qəbul edir: 7 günlük gözləmədən sonra kontraktları yeniləyə, çıxmış dövlətlərin qeydlərinə də təsir edə bilər. R6-nın "tək dövlət təkbaşına qərar verə bilməz" təminatı tək üzvlü şəbəkədə aradan qalxır |
| **(c) Hər ikisi** | İki üzvdə çıxış rədd edilir; tək üzvlü quruluşda hədd 1 | Kilid hər iki yoldan bağlanır | İki ayrı qayda; tək üzvlü şəbəkə istehsalda onsuz da istənilmir ([[ADR-0009]] K4) |
| Heç nə etməmək | Qayda əməliyyat sənədində qalır: "iki üzvlü şəbəkədə çıxmazdan əvvəl üçüncü üzv qəbul edilir" | Kod dəyişmir | Tək bir əməliyyat şəbəkəni geri dönüşsüz kilidləyir; səhv və ya mübahisədə qoruma yoxdur |

# Təklif

**(a).** Əsaslandırma: iki üzvlü şəbəkə, spesifikasiyanın öz ifadəsi ilə, ortaqlıq kimi davranır; ortaqlardan birinin tək
əməliyyatla şəbəkənin ortaq idarəetməsini həmişəlik dayandıra bilməsi çıxış hüququnun məqsədi deyil. (b) kilidi açır, amma
şəbəkə səviyyəsindəki bütün səlahiyyəti tək dövlətə verir; çıxmış dövlətlərin zəncirdəki qeydləri həmin dövlətin yeniləmə
qərarına açıq qalır. (a)-da çıxış hüququ ləğv olunmur, ardıcıllığa bağlanır. Təklif olunan qaydalar (qəbul edilərsə məcburi
cədvələ köçürülür):

1. Aktiv üzv sayı 2 və ya daha az ikən `withdraw` rədd edilir (bu gün yalnız son üzv rədd edilir).
2. [[ADR-0002]] #5 bu qeydlə oxunur: birtərəfli çıxış şəbəkədə ən azı üç aktiv üzv olanda səsvermə tələb etmir; iki üzvlü
   şəbəkədə üçüncü üzvün qəbulundan sonra istifadə olunur.
3. Tək təsisçili quruluş yalnız yerli inkişaf üçündür. Quruluşun ən azı iki təsisçi tələb etməsi ayrıca qərarlaşdırılır: yerli
   inkişaf və test şəbəkəsi quraşdırmaları bu gün tək təsisçi ilə işləyə bildiyi üçün bu layihə onu dəyişmir.
4. Xəta adı və spesifikasiya mətni qəbulda təsdiqlənir.

# Nəticələr (qəbul edilərsə)

- `Governance.withdraw`: şərtin bir sətirlik dəyişikliyi; yaddaş düzümü və xarici interfeys dəyişmir. Test: iki üzvlü şəbəkədə
  çıxış rədd edilir, üçüncü üzv qəbul ediləndən sonra çıxış keçir.
- [[SPEC-BC-0001]] §1 ("hər iki tərəf yalnız könüllü `withdraw` edə bilər" cümləsi) və §14 bənd 8; [[ADR-0002]]-yə tətbiq
  qeydi.
- Qəbul edilənə qədər kontraktın davranışı dəyişmir; əməliyyat qaydası qüvvədədir: iki üzvlü şəbəkədə çıxmazdan əvvəl üçüncü
  üzv qəbul edilir. Mövcud davranış testlə qeydə alınıb (`contracts/test/review-2026-11-11-governance.test.ts`).

# Status

**Proposed — 2026-11-11.** Layihə rəhbərliyinin qərarını gözləyir (2026-11-11 kontrakt auditi tapıntısı).
