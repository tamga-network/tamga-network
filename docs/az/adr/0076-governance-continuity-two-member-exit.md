---
document_id: ADR-0076
title: "İki üzvlü şəbəkədə çıxış və idarəetmənin davamlılığı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-11
last_updated: 2026-11-12
summary: >
  Governance kontraktında minimal mütləq səs sayı 2-dir. Aktiv üzv sayı 2 ikən bir üzv birtərəfli çıxarsa (`withdraw`), say 1-ə
  düşür; qalan üzv heç bir təklifi icra edə bilmir, yeni üzv qəbul edə bilmir və özü də çıxa bilmir: idarəetmə həmişəlik
  kilidlənir. Çıxış hüququ (ADR-0002 #5) ilə idarəetmənin davamlılığı bu nöqtədə toqquşur. Təklif: (a) aktiv üzv sayı 2 ikən
  `withdraw` rədd edilir; çıxmaq istəyən üzv əvvəlcə üçüncü üzvün qəbulunu gözləyir. Alternativ (b): çıxış sərbəst qalır, tək üzv
  qalanda hədd 1-ə enir. Tövsiyə olunan (a). Qəbul edildi (2026-11-12): (a), tövsiyə edildiyi kimi. Çıxmaq istəyən üzvün yolu:
  əvvəlcə üçüncü üzv qəbul edilir, sonra üzv çıxır. Əlavə qayda (2026-11-12, GC4): şəbəkə ən azı iki təsisçi ilə qurulur;
  `initialize` tək təsisçini rədd edir.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]"]
translation_of: ADR-0076
source_version: 1.0.0
---

# Qısaca

Şəbəkənin ortaq qərarları (yeni üzvün qəbulu, yeniləmə, şəbəkə sxemi) ən azı iki üzvün səsi ilə qəbul edilir. Şəbəkədə iki üzv
olanda biri öz istəyi ilə çıxarsa, tək üzv qalır və tək üzv heç bir qərarı təkbaşına qəbul edə bilmir. Yeni üzv də qəbul edilə
bilmədiyi üçün şəbəkə bu vəziyyətdən çıxa bilmir. Bu qərar həmin nöqtəyə düşməyin qarşısını alır: iki üzvlü şəbəkədə birtərəfli
çıxış rədd edilir; çıxmaq istəyən üzv əvvəlcə üçüncü üzvün qəbul edilməsini gözləyir, sonra səsvermə olmadan çıxır.

# Kontekst

- [[ADR-0002]] #5: dövlət birtərəfli `withdraw()` ilə çıxa bilər; səsvermə tələb olunmur, təminat kod səviyyəsindədir.
- [[SPEC-BC-0001]] §1 (müstəqil yoxlama tapıntısı R6): 2/3 qaydası üç üzvdən az olduqda mənasını itirdiyi üçün `requiredVotes`
  heç vaxt 2-dən aşağı düşmür. Eyni bölmə iki üzvlü şəbəkədə çıxarmanın mümkün olmadığını, hər iki tərəfin "yalnız könüllü
  `withdraw` edə biləcəyini" deyir.
- Kontrakt auditi (2026-11-11), testlə təsdiqləndi (qərardan əvvəlki davranış): aktiv üzv sayı 2 ikən `withdraw` sayı 1-ə
  endirirdi. Bundan sonra
  - qalan üzvün hər təklifi `ThresholdNotMet(1, 2)` ilə düşür (yeni üzvün qəbulu daxil);
  - qalan üzv çıxa bilmir (`LastValidator`);
  - kontraktlar yenilənə bilmir, şəbəkə sxemi yazıla bilmir, siyahı lövbəri yazıcıları və köç rejimi idarə oluna bilmir.
  Milli qeydlər təsirlənmir (qalan dövlət öz qeydlərini yazmağa davam edir); kilidlənən şəbəkə səviyyəli idarəetmədir və geri
  dönüşü yoxdur.
- Eyni vəziyyət quruluşda da yarana bilər: `initialize` tək təsisçini qəbul edir; tək üzvlə heç bir təklif icra oluna bilmir. Bu
  gün bu yalnız yerli inkişaf quraşdırmalarında istifadə olunur. İstehsal zənciri yoxdur və ən azı iki müstəqil operatorla açılır
  ([[ADR-0009]] K4).
- İki bağlanmış qayda toqquşduğu üçün kod qərardan əvvəl dəyişdirilmədi; qayda bu sənədlə müəyyən edildi.

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

# Qərar (2026-11-12)

**(a) tövsiyə edildiyi kimi qəbul edildi.** Məcburi qaydalar aşağıdakı GC1–GC3; ad cədvəldən sonra. Quruluşun ən azı iki
təsisçi tələb etməsi həmin gün ayrıca qərara saxlanılmışdı; elə həmin gün aşağıdakı əlavə qərarla bağlandı (GC4).

## Əlavə qərar (2026-11-12): ən azı iki təsisçi

Şəbəkə ən azı iki təsisçi ilə qurulur. Təsdiqlənmiş istiqamət: real şəbəkədə məcburi; tək təsisçili quraşdırma ən çoxu yerli
inkişaf və test üçün, açıq bayraqla. İki tətbiq yolu qiymətləndirildi:

| Yol | Nə | Nəticə |
|---|---|---|
| **(i) Kontraktda məcburi** | `Governance.initialize` ikidən az təsisçini rədd edir; testlər və yerli skriptlər iki təsisçi ilə qurur | **seçildi** |
| (ii) Quraşdırma skriptlərində | Kontrakt tək təsisçini qəbul etməyə davam edir; quraşdırma skriptləri tək təsisçini yalnız yerli zəncir identifikatorlarında və ya açıq bayraqla qəbul edir | seçilmədi |

Səbəb: (ii) yalnız bu repozitoriyanın skriptlərini bağlayır; kontraktı başqa alətlə yerləşdirən şəxs tək təsisçi ilə qura bilər
və qayda kodda deyil, vərdişdə qalır. (i)-də qayda, GC1 kimi, kontraktın özündədir. Tək təsisçi bayrağına ehtiyac da qalmadı:
yerli inkişaf zənciri, test şəbəkəsi və kontrakt testləri onsuz da iki və ya üç təsisçi ilə qurulurdu; tək təsisçili idarəetmə
heç bir təklifi icra edə bilmədiyi üçün sınanacaq davranışı yoxdur. Bayraq açılmadı; gələcəkdə lazım olarsa yeni qərarla əlavə
olunur. Yeni ad lazım olmadı: mövcud `FounderMismatch` xətası istifadə olunur (təsisçi tanınması təklifindəki "ikidən az
təsisçi" yoxlaması ilə eyni xəta).

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| GC1 | Birtərəfli çıxış (`Governance.withdraw`) yalnız şəbəkədə ən azı üç aktiv üzv olanda keçir; aktiv üzv sayı 2 və ya daha az ikən rədd edilir (`TooFewMembers`). Nə çıxış, nə də çıxarılma aktiv üzv sayını minimal mütləq səs sayından (2) aşağı endirə bilməz: idarəetmə həmişə qərar qəbul edə bilən vəziyyətdə qalır. |
| GC2 | İki üzvlü şəbəkədə çıxmaq istəyən üzvün yolu ardıcıldır: əvvəlcə üçüncü üzv qəbul edilir (`proposeStateAdmission`, iki üzvün səsi ilə), sonra üzv `withdraw` ilə çıxır; bu ikinci addım səsvermə tələb etmir. Qəbul baş tutana qədər üzv validatorunu dayandıra və qeyd yazmağı saxlaya bilər; üzvlüyü davam edir. |
| GC3 | [[ADR-0002]] #5 bu qeydlə oxunur: çıxış hüququ ləğv olunmur, ardıcıllığa bağlanır. Ən azı üç aktiv üzvü olan şəbəkədə birtərəflidir, səsvermə tələb etmir və kodla təmin olunur. Çıxışın rəqəmsal sənədlərə təsiri dəyişmir: verilmiş rəqəmsal sənədlər və mövcud qeydlər etibarlı qalır ([[ADR-0002]] #4). |
| GC4 | Şəbəkə ən azı iki təsisçi ilə qurulur: `Governance.initialize` ikidən az təsisçini rədd edir (`FounderMismatch`). Quraşdırma skriptləri və açar xəritəsi eyni qaydanı yerləşdirmədən əvvəl yoxlayır; tək təsisçili quraşdırma üçün bayraq və ya istisna yoxdur. |

Ad (ictimai ABI; mövcud xəta adlandırma qaydasına görə — `TooManyDelegates(count, max)` nümunəsi):

| Yer | Ad |
|---|---|
| `Governance` xətası | `TooFewMembers(uint32 active, uint32 required)` — `active`: çağırış anındakı aktiv üzv sayı; `required`: birtərəfli çıxış üçün tələb olunan ən az aktiv üzv sayı (3) |

# Nəticələr

- `Governance.withdraw`: şərtin bir sətirlik dəyişikliyi (`activeMemberCount ≤ 2` → rədd). Yaddaş düzümü və funksiya imzaları
  dəyişmir; ABI-yə bir xəta əlavə olunur. `LastValidator` yalnız çıxarılma təklifində qalır.
- GC4: `Governance.initialize` şərti (`founders.length < 2` → `FounderMismatch`); ABI və yaddaş düzümü dəyişmir. Quraşdırma
  kodu eyni qaydanı yerləşdirmədən əvvəl, açıq mesajla yoxlayır (`contracts/scripts/lib/deploy.ts`, `network-setup.ts`; açar
  xəritəsi `apps/chain-indexer/src/chain-keys.ts`, `network/testnet/testnet.mjs`). `network/testnet/make-network.sh` tək
  validatorlu şəbəkə üçün açar xəritəsi yazmır (yalnız qovşaq səviyyəli yoxlamalar). QBFT validatorlarının sayı ilə təsisçilərin
  sayı ayrı şeylərdir: yerli tək validatorlu inkişaf zənciri də kontraktları iki təsisçi ilə (TR, KZ) qurur.
- Testlər (`contracts/test/review-2026-11-11-governance.test.ts`, `contracts/test/governance.test.ts`): üç üzvdən biri çıxır
  (3 → 2), iki üzvlü şəbəkədə çıxış rədd edilir (2 → 1), üçüncü üzv qəbul ediləndən sonra çıxış keçir və qalan iki üzv qərar
  qəbul etməyə davam edir.
- [[SPEC-BC-0001]] §1 və §14 bənd 8 (bağlandı); [[ADR-0002]]-yə tətbiq qeydi.
- Qalan məhdudiyyət (şüurlu): iki üzvlü şəbəkədə digər üzv yeni üzvün qəbuluna səs verməsə, çıxış zəncirdə baş tutmur. Üzv
  validatorunu dayandıra və qeyd yazmağı saxlaya bilər; üzvlük qeydi davam edir. Bu, iki üzvlü şəbəkənin ortaqlıq kimi
  davranmasının nəticəsidir ([[SPEC-BC-0001]] §1).
- **Tətbiq qeydi (2026-11-12; qərarın məzmunu dəyişmədi) — iki üzvlü dövrdə açarın ehtiyat nüsxəsi.** İki üzvlü şəbəkədə bir
  üzvün idarəetmə açarı (bu gün validator qovşaq açarı ilə eyni açardır) itərsə, həmin üzv səs verə bilmir. Qalan üzv təkbaşına
  heç bir təklifi keçirə bilmir (minimal mütləq səs 2); açarını itirən üzv çıxarıla bilmir (iki üzvlü şəbəkədə çıxarma yoxdur,
  [[SPEC-BC-0001]] §1) və çıxa bilmir (GC1; çıxış da eyni açarı tələb edir). Validator ünvanını dəyişməyin yeganə yolu yenidən
  qəbuldur, o da iki səs tələb edir. İdarəetmə GC1-in qarşısını aldığı kilidlənməyə bu yolla düşür və geri dönüşü yoxdur. Buna
  görə, layihə rəhbərliyinin təsdiqi ilə (2026-11-12), istismar qaydası: **üçüncü üzv qoşulana qədər hər üzvün idarəetmə
  açarının əsas açardan ayrı yerdə saxlanılan və bərpa edilərək sınanmış ehtiyat nüsxəsi məcburidir.** Qayda istismar
  səviyyəsindədir (kontrakt bunu yoxlaya bilmir); istismar sənədindəki yeri [[ARCH-0002]] Addım 11. Üç və daha çox üzvlü şəbəkədə
  açarını itirən üzv digər üzvlərin səsi ilə çıxarılıb yeni ünvanla yenidən qəbul edilə bilər; ehtiyat nüsxə orada da tövsiyə
  olunur.

# Status

**Accepted — 2026-11-12.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-12): seçim (a), tövsiyə edildiyi kimi; həmin gün əlavə
qərar GC4 (ən azı iki təsisçi). DECISIONS: D-GOV-12. GC1–GC4 məcburidir. Tətbiq: `Governance.withdraw`,
`Governance.initialize` ([[SPEC-BC-0001]] versiya qeydləri).
