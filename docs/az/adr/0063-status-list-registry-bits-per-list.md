---
document_id: ADR-0063
title: "Zəncirdəki ləğv siyahısı qeydi siyahının öz bit sayını qəbul edir"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  Zəncirdəki ləğv siyahısı lövbər müqaviləsi (`StatusListRegistry`) indiyədək yalnız `bitsPerEntry = 2` qəbul edirdi; ADR-0048 isə bit sayını sənəd növünə bağladı (şəxsiyyət xidmətinin növləri 1, qurum siyahıları 2). Zəncir imzalı siyahıların proyeksiyası olduğu üçün (ADR-0051) müqavilə siyahının öz `bits` dəyərini qəbul edir: IETF Token Status List-in icazə verdiyi 1, 2, 4 və ya 8. Dəyər qeydiyyatda bir dəfə yazılır, dəyişmir və qeydiyyat hadisəsində yayılır. Müqavilə sənəd növünü bilmir; zəncirə növ, sxem və ya bit məzmunu yazılmır. Tamga profili (1 və ya 2) dərc edəndə və yoxlayan tərəfdə qalır. SPEC-BC-0001 L3-ü dəyişir. İstehsal zənciri yoxdur (ADR-0009 K4); dəyişiklik lokal inkişaf və test zəncirində. Qəbul: 2026-10-23.
domain: Trust
related: ["[[ADR-0008]]", "[[ADR-0009]]", "[[ADR-0048]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[SPEC-CRED-0003]]"]
translation_of: ADR-0063
source_version: "1.0.0"
---

# Qısaca

Şəxsiyyət xidmətinin ləğv siyahıları 1 bitlik, qurum siyahıları 2 bitlikdir. Zəncirdəki qeydiyyat müqaviləsi isə yalnız 2 biti qəbul
edirdi; şəxsiyyət siyahıları zəncirə ümumiyyətlə qeyd edilə bilməzdi. İndi müqavilə siyahının öz bit sayını (standartın icazə verdiyi
1, 2, 4 və ya 8) qeyd edir. Zəncirə yenə yalnız siyahının ünvanı, heşi, versiyası və ölçüsü gedir; fərdi məlumat yoxdur.

# Kontekst

- **ADR-0048 K1–K2.** Ləğv siyahılarında bit sayı növə görədir: şəxsiyyət xidmətinin növləri (şəxsiyyət sənədi, sürücülük vəsiqəsi
  məlumatı, əlaqə sənədləri) `bits = 1`, qurum siyahıları `bits = 2` ([[SPEC-CRED-0003]] §3.3). Paketlər 0.6.0-dan bəri belə dərc
  edir.
- **Müqavilə.** `StatusListRegistry.registerList` `bitsPerEntry != REQUIRED_BITS (2)` olan siyahını `InvalidBitsPerEntry` ilə rədd
  edirdi ([[SPEC-BC-0001]] §7, L3 "`bitsPerEntry == 2`"). Faza 0-da siyahı tarixçəsi müqavilələrə köçürüləndə ([[ADR-0009]] K7)
  şəxsiyyət xidmətinin siyahıları qeyd edilə bilməzdi.
- **Zəncir proyeksiyadır** ([[ADR-0051]]): mənbə imzalı siyahıdır, zəncir onu izləyir. Müqavilənin öz qaydası ilə imzalı siyahıdan
  fərqli bit sayı tətbiq etməsi bu prinsipə ziddir.
- **Standart.** IETF Token Status List `bits` üçün 1, 2, 4 və 8-ə icazə verir. Şəbəkə gələcəkdə başqa dövlətlərin sənəd verənlərini
  də daşıyacaq (TDT-first); müqavilə Tamga profilinin bugünkü iki dəyərinə kilidlənməməlidir.

# Qərar

## K1 — Siyahının öz bit sayı

- `registerList` `bitsPerEntry` olaraq **1, 2, 4 və ya 8** qəbul edir; hər başqa dəyər `InvalidBitsPerEntry` ilə rədd edilir.
  `REQUIRED_BITS` sabiti götürülür; yerinə təmiz oxuma `isAllowedBits(uint8)` gəlir.
- Dəyər qeyd edilən siyahının imzalı tokenindəki `status_list.bits` ilə eynidir. Qeydiyyatda bir dəfə yazılır; `publishList` bit
  sayı qəbul etmir, yeni versiya bit sayını dəyişə bilməz (bit sayı dəyişməlidirsə, yeni siyahı açılır, S9).
- `ListRegistered` hadisəsi bit sayını da daşıyır: `ListRegistered(listId, issuerId, listURI, listSize, bitsPerEntry)`.

## K2 — Növ məlumatı zəncirə getmir

- Müqavilə sənəd növünü, sxemi və ya `suspension_allowed`-ı bilmir və soruşmur. "Şəxsiyyət xidmətinin siyahısı 1 bit olmalıdır"
  qaydası ([[ADR-0048]]/SU1) dərc edənin və yoxlayan tərəfin qaydasıdır; zəncir yalnız siyahının özünü necə təsvir etdiyini qeyd edir.
- Zəncirdə ləğv biti, indeks, sənəd heşi və ya fərdi məlumat yoxdur ([[ADR-0008]], DP1); bu qərar bunu dəyişmir.

## K3 — Proyeksiya və yoxlama

- Siyahı dərc edəninin proyeksiya modulu qeydiyyat parametrlərini imzalı tokendən çıxarır (`statusListRegistrationOf`: `sub` →
  ünvan, `status_list.bits` → bit sayı, açılmış bayt × 8 / bits → tutum, `sha256(jws)` → heş). Standartdan kənar bit sayı xətadır.
- Tamga profili dəyişmir: Tamga dərc edənləri yalnız 1 və ya 2 dərc edir, Tamga yoxlayan tərəfi yalnız bunları oxuyur
  ([[SPEC-CRED-0003]] §3.3). Müqavilənin 4 və 8-i qəbul etməsi Tamga profilinə yeni dəyər əlavə etmir.

## K4 — Tətbiq

- `contracts/src/revocation/StatusListRegistry.sol`, `IStatusListRegistry.sol`, müqavilə testləri; `apps/trust-publisher` proyeksiya
  köməkçisi və testi. Yaddaş düzülüşü dəyişmir (sabit yaddaşda yer tutmur). İstehsal zənciri yoxdur ([[ADR-0009]] K4); dəyişiklik
  lokal inkişaf və test zəncirində qüvvədədir; inkişaf mərhələsi qaydasına görə keçid kodu yoxdur ([[ADR-0029]]).

# Nəzərdən keçirilmiş variantlar

| Seçim | Nəticə | Səbəb |
|---|---|---|
| `REQUIRED_BITS = 2` qalsın, şəxsiyyət siyahıları zəncirə qeyd edilməsin | rədd | Proyeksiya natamam qalır; şəxsiyyət siyahıları Faza 0-da lövbərsiz olar |
| Yalnız 1 və 2 qəbul (Tamga profili) | rədd | Profil qaydası dərc edəndə və yoxlayan tərəfdədir; müqavilə şəbəkənin başqa dövlətlərinə də xidmət edir, standart 1, 2, 4, 8 deyir |
| Bit sayını sənəd növünə görə müqavilədə yoxlamaq | rədd | Zəncirə növ məlumatı daşıyır; müqavilə sxemlə siyahı arasında əlaqə qura bilməz (siyahı növ başına ayrıdır, lakin növ adı zəncirdə yoxdur) |
| **Siyahının öz bit sayı, standartın çoxluğu daxilində** | **seçildi** | Zəncir imzalı siyahını izləyir; qeyd dəyişmir; fərdi məlumat yoxdur |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| BL1 | Zəncirdəki ləğv siyahısı qeydi siyahının öz `bits` dəyərini saxlayır; dəyər 1, 2, 4 və ya 8-dir, qeydiyyatda bir dəfə yazılır və siyahının ömrü boyu dəyişmir. |
| BL2 | Ləğv siyahısı qeydinə sənəd növü, sxem, ləğv biti və ya fərdi məlumat yazılmır; növə görə bit qaydası dərc edəndə və yoxlayan tərəfdə tətbiq edilir. |

# Nəticələr

- [[SPEC-BC-0001]] §7.1 (`bitsPerEntry` izahı, `isAllowedBits`), §7.4 və §13 L3; [[SPEC-CRED-0003]] §4 müqavilə interfeysi.
- Kod: `contracts/`, `apps/trust-publisher/src/chain/projection.ts`.

# Status

**Accepted — 2026-10-23.** Layihə rəhbərliyinin ümumi uyğunluq təsdiqi çərçivəsində ("Aİ standartlarına uyğun olaq,
çatışmazlıqlarımızı aradan qaldıraq, olması lazım olduğu kimi edək"): müqaviləni [[ADR-0048]] və [[ADR-0051]] ilə uyğunlaşdıran
düzəliş. DECISIONS: D-BC-11. [[SPEC-BC-0001]] L3-ü dəyişir; BL1–BL2 məcburidir.
