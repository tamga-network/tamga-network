---
document_id: ADR-0053
title: "Siyahı lövbərində rəqib namizədlər"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Siyahı lövbəri reyestrində (TrustListAnchorRegistry) versiyanı ilk açan yazan tərəf artıq həmin versiyanın məlumatlarını kilidləyə bilməz. Eyni versiya üçün fərqli məlumat rədd edilmir; ayrıca namizəd kimi qeydə alınır və ziddiyyət hadisəsi (`AnchorConflict`) yayır. Versiya hədd qədər fərqli və hələ də səlahiyyətli yazan tərəfin dəstəklədiyi ilk namizəd olduqda təsdiqlənir; təsdiqdən sonra bağlanır və dəyişmir. Hər yazan tərəf bir versiya üçün yalnız bir namizədi dəstəkləyir; dəstdən çıxarılan yazan tərəfin dəstəyi sayılmır, beləliklə açar rotasiyası bir operatora iki səs vermir; hədd yazan tərəflərin sayını aşacaq şəkildə təyin edilə bilməz. ADR-0051 K3-ün son bəndini və CH4-ü dəyişir; CH1–CH3 və CH5 olduğu kimi qüvvədədir. Qəbul: 2026-10-19.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0052]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0053
source_version: "1.0.0"
---

# Qısaca

Siyahı versiyasının zəncirdəki xülasəsi bir neçə müstəqil operator eyni xülasəni göndərdikdə təsdiqlənir. Köhnə qaydada versiyanı ilk açan
yazan tərəf məlumatı müəyyən edirdi: səhv məlumatla açarsa, dürüst yazan tərəflərin düzgün xülasəsi rədd edilir və həmin versiya heç vaxt təsdiqlənə bilmirdi. Yeni
qaydada hər fərqli xülasə ayrıca namizəddir; həddi ilk dolduran namizəd qalib gəlir və hər ziddiyyət hamının görə biləcəyi hadisə kimi
zəncirə yazılır.

# Kontekst

- [[ADR-0051]] K3: lövbər hədd qədər fərqli yazan tərəf eyni məlumatı tam olaraq göndərdikdə təsdiqlənmiş sayılır; açılmış versiya üçün fərqli
  xülasə göndərən yazan tərəf `AnchorMismatch` ilə rədd edilir və bu "hadisələrdən izlənilir". CH4 bunu məcburi edir.
- 2026-10-19 kontrakt təhlükəsizlik yoxlaması (F-05) iki problem aşkar etdi:
  1. **İlk açanın kilidi.** Tək bir yazan tərəf `(listKey, version)` cütünü səhv məlumatla aça bilər (gələcək versiyaları da
     əvvəlcədən). Dürüst yazan tərəflərin düzgün məlumatı `AnchorMismatch` ilə rədd edilir; versiya heç vaxt təsdiqlənə bilmir və bunu təmizləyən
     yol yoxdur. Yoxlayan tərəf `NO` siqnalı əvəzinə `UNKNOWN` görür. Hədd ≥ 2 qaydası ([[ADR-0009]] K4) tək operatorun təsdiqlənmiş lövbər
     yaratmasının qarşısını alır, lakin tək operatorun təsdiqi **əngəlləməsinin** qarşısını almır.
  2. **İz yoxdur.** Rədd `revert` olduğu üçün zəncirdə heç bir qeyd qalmır; K3-dəki "hadisələrdən izlənilir" ifadəsinin kodda qarşılığı yoxdur.
- Həmin yoxlama (F-13) iki kiçik kənar halı da göstərdi: dəstdən çıxarılan yazan tərəfin köhnə təsdiqi sayılmağa davam edir (açarını
  rotasiya edən tək operator eyni versiyanı iki dəfə təsdiqləyə bilər) və hədd yazan tərəflərin sayından yuxarı təyin edilə bilir (heç bir lövbər
  təsdiqlənə bilmir).
- Zəncir bu gün mövcud deyil ([[ADR-0009]] K4); kontrakt hazırlıq kodudur. Dəyişiklik zəncir işə salınmazdan əvvəl edilir.
- Layihə rəhbərliyi 2026-10-19-da təhlükəsizlik yoxlamasının təklifini təsdiqlədi: eyni versiya üçün fərqli namizədlər ayrıca saxlanılır, həddi ilk dolduran
  qalib gəlir, ziddiyyət hadisə kimi qeydə alınır.

# Qərar

## K1 — Rəqib namizədlər

- `(listKey, version)` və ya `(logKey, seq)` üçün göndərilən hər fərqli məlumat `(contentHash, previousHash, issuedAt)` /
  `(lineHash, ts)` ayrıca **namizəd**dir. Açılmış versiya üçün fərqli məlumat rədd edilmir; yeni namizəd kimi qeydə alınır.
- Hər yazan tərəf bir versiya üçün yalnız **bir** namizədi dəstəkləyə bilər (ikinci göndəriş `AlreadyConfirmedBy` ilə rədd edilir). Beləliklə,
  bir yazan tərəfin iki fərqli namizədi dəstəkləməsi mümkün deyil.
- Versiyanın ilk açılışında monotonluq qaydası olduğu kimi qüvvədədir: yeni versiya ən yüksək **təsdiqlənmiş** versiyadan yuxarı açılır ([[ADR-0051]]
  CH4-ün birinci yarısı). Açılmış, lakin təsdiqlənməmiş versiyaya rəqib namizəd əlavə edilə bilər.

## K2 — Təsdiq: həddi ilk dolduran namizəd

- Namizəd hədd qədər **fərqli və hələ də səlahiyyətli** yazan tərəf tərəfindən dəstəkləndikdə təsdiqlənir. Həmin anda versiya bağlanır: qeyd qalib
  namizədin məlumatını daşıyır, başqa namizəd əlavə edilə bilməz və təsdiqlənmiş qeyd dəyişmir, silinmir ([[ADR-0051]] CH4-ün ikinci yarısı olduğu kimi).
- Təsdiqdən əvvəl `listAnchor` / `logHead` görünüşü versiyanı ilk açan namizədi göstərir; hər namizədin cari dəstək sayı ayrıca görünüşlə
  oxunur (`listCandidateConfirmations`, `logCandidateConfirmations`, `candidateCount`). Təsdiqlənməmiş namizəd heç bir sorğuda `YES` yaratmır.

## K3 — Ziddiyyət hadisəsi

Versiya üçün ikinci və sonrakı hər fərqli namizəd `AnchorConflict(key, versionOrSeq, firstHash, submittedHash, anchorer)` hadisəsini
yayır. Bu hadisə ikili danışıq siqnalıdır: operatorlar və indeksləyici onu izləyir; siyahı naşiri (`trust:chain-submit`) gözləyən
fərqli namizəd gördükdə özünün yoxladığı xülasəni yenə göndərir və hesabatında ziddiyyət xəbərdarlığı verir. Ziddiyyət halında imzalı siyahı
qüvvədədir ([[ADR-0051]] CH1, dəyişmir).

## K4 — Yazan tərəflər dəsti dəyişdikdə

- Dəstdən çıxarılan yazan tərəfin dəstəyi heç bir namizəddə sayılmır; dəstək hər göndərişdə həmin andakı səlahiyyətli yazan tərəflər üzrə yenidən sayılır.
  Açarını rotasiya edən operator (köhnə açar çıxır, yeni açar daxil olur) eyni versiyaya iki etibarlı dəstək verə bilməz.
- Hədd yazan tərəflərin sayını aşacaq şəkildə təyin edilə bilməz (quraşdırmada və `setRequiredConfirmations`-da). Yazan tərəfin çıxarılması sayı həddən aşağı
  sala bilər; bu, idarəetmə qərarıdır və hadisələrdən görünür (`AnchorerSet`).
- İstehsal mühitində həddin ən azı 2 olması yerləşdirmə intizamı olaraq qalır ([[ADR-0051]] K3, dəyişmir).

# Nəzərdən keçirilmiş variantlar

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Köhnə qayda (ilk açan məlumatı müəyyən edir, fərqli məlumat `revert`) | rədd | Tək yazan tərəf versiyanı daimi kilidləyir; iz qalmır |
| Gözləyən namizədin idarəetmə tərəfindən silinə bilməsi | rədd | Silmə səlahiyyəti yeni hücum səthi yaradır və Governance səsverməsi tələb edir; rəqib namizəd modeli silməyə ehtiyac qoymur |
| Ziddiyyətli ilk namizədin açanını cəzalandırmaq (yazan tərəfi avtomatik çıxarmaq) | rədd | Səhv edən, lakin dürüst yazan tərəf də çıxarılardı; çıxarma Governance qərarıdır |
| Bir yazan tərəfin bir neçə namizədi dəstəkləməsi | rədd | Tək operator iki fərqli xülasəyə dəstək verərək ikili danışığı öz daxilində gizlədə bilərdi |
| Dəstək sayını təsdiq anında saxlayıb sonradan yenidən saymamaq | rədd | Açar rotasiyası bir operatora iki səs verir (F-13) |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| AC1 | Açılmış lövbər versiyası üçün fərqli məlumat rədd edilmir, ayrıca namizəd kimi qeydə alınır; hər yazan tərəf bir versiya üçün yalnız bir namizədi dəstəkləyir. |
| AC2 | Versiya hədd qədər fərqli və hələ də səlahiyyətli yazan tərəfin dəstəklədiyi ilk namizəd olduqda təsdiqlənir; təsdiqdən sonra bağlanır, təsdiqlənmiş qeyd dəyişmir və silinmir. |
| AC3 | Versiya üçün ikinci və sonrakı hər fərqli namizəd zəncirdə ziddiyyət hadisəsi (`AnchorConflict`) yayır. |
| AC4 | Dəstdən çıxarılan yazan tərəfin dəstəyi sayılmır; hədd yazan tərəflərin sayını aşacaq şəkildə təyin edilə bilməz. |

# Nəticələr

- `contracts/src/anchor/TrustListAnchorRegistry.sol`: namizəd qeydi, ziddiyyət hadisəsi, namizəd görünüşləri; yaddaş düzülüşü yalnız sona
  əlavə etmə (`__gap` azaldıldı; `contracts:storage-check` baza xətti yeniləndi). `AnchorMismatch` xətası aradan qaldırıldı.
- `apps/trust-publisher` `chain-submit`: zəncirdə gözləyən **fərqli** namizəd artıq `CONFLICT` (yazmamaq) deyil, öz xülasəsini
  göndərmək və xəbərdarlıq (`CONTEST`) deməkdir; təsdiqlənmiş fərqli xülasə `CONFLICT` olaraq qalır. `chain-check` dəyişmir (yalnız təsdiqlənmiş qeydə baxır).
- [[ADR-0051]] K3-ün son bəndi və CH4 bu ADR-ə istinadla yeniləndi; [[SPEC-BC-0001]] §15 versiya qeydi.
- DECISIONS: **D-BC-8**.

# Status

**Accepted — 2026-10-19.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-BC-8. [[ADR-0051]] K3-ün son bəndini və CH4-ü dəyişir;
AC1–AC4 məcburidir.
