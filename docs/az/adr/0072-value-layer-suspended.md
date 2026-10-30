---
document_id: ADR-0072
title: "Dəyər qatı dayandırılıb: ADR-0003 qarmaqları tədqiqat istiqamətidir"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  ADR-0003-ün dəyər qatı qarmaqları (ağıllı müqavilə hesabı, ayrı açar sahələri və aktivlərin bərpası, əhatə dairəsi ümumi olan nümayəndəlik reyestri, credential-gating, token qaydası) artıq məcburi deyil və "tədqiqat istiqaməti" kimi dayandırılır. Şəbəkə token buraxmır, ödəniş və ya dəyər köçürməsi aparmır; zəncir kodu yalnız imzalı siyahıların proyeksiyasıdır (ADR-0051). Dəyər qatının yenidən açılması idarəetmə orqanının qərarını, müstəqil təhlükəsizlik yoxlamasını və yeni ADR tələb edir. Qəbul: 2026-10-30.
domain: Governance
related: ["[[ADR-0003]]", "[[ADR-0008]]", "[[ADR-0037]]", "[[ADR-0051]]", "[[ADR-0071]]"]
translation_of: ADR-0072
source_version: "1.0.0"
---

# Qısaca

Tamga Network etibar şəbəkəsidir; pul, token və ya ödəniş işi görmür. Əvvəllər "gələcək dəyər qatı" üçün qəbul edilmiş beş dizayn
qərarı artıq məcburi deyil; yalnız gələcəkdə tədqiq edilə biləcək istiqamət kimi qeyddə qalır.

# Kontekst

- [[ADR-0003]] (2026-08-06) icazə/dəyər qatı üçün beş məcburi qarmaq qoymuşdu: zəncir hesabı ağıllı müqavilə cüzdanı, ayrı açar
  sahələri və istifadəçinin seçdiyi aktiv bərpası, əhatə dairəsi ümumi nümayəndəlik reyestri, ümumi credential-gating primitivi,
  öz tokeni yoxdur, lakin token buraxılışı FINANCE icazə siyahısına bağlıdır. Qərar 4 2026-09-10-da daraldıldı ([[ADR-0008]]:
  zəncir ləğvi görə bilmir).
- Sonrakı qərarlar şəbəkənin formasını dəyişdi: şəbəkə yalnız şəbəkədir, xidmət satmır ([[ADR-0037]]); zəncir imzalı siyahıların
  proyeksiyasıdır ([[ADR-0051]]); şəbəkə qeyri-kommersiya fondu olacaq və haqq almır ([[ADR-0071]]). İctimai mətnlər dəyər qatını
  artıq "tədqiqat istiqaməti" adlandırırdı; ADR-0003 isə hələ də Active görünürdü.
- Layihə rəhbərliyinin istiqaməti: ADR-0003 "dayandırılıb — tədqiqat istiqaməti" kimi işarələnsin.

# Qərar

## K1 — Dayandırma
[[ADR-0003]]-ün beş qarmağı və onlara əsaslanan qərarlar (D-AUTH-0…5, D-STR-1/2-nin dəyər qatı hissəsi) artıq məcburi deyil və
tədqiqat istiqaməti kimi dayandırılır. ADR-0003 silinmir; statusu bu ADR-ə işarə edir (sənəd standartının sözü ilə `Superseded`).

## K2 — Bugünkü sərhəd
Şəbəkə token buraxmır; ödəniş, hesablaşma və ya dəyər köçürməsi aparmır; zəncir kodu yalnız imzalı siyahıların proyeksiyasıdır
([[ADR-0051]]) və dəyər qatı primitivlərini (ağıllı hesab, nümayəndəlik, credential-gating, token icazə siyahısı) tələb etmir.
Depoda bu istiqamətdə qalmış müqavilə layihələri prototipdir; istehsalda açılmır.

## K3 — Yenidən açılma
Dəyər qatı yalnız idarəetmə orqanının (fond / şura) qərarı, məxfilik tədqiqatı (əməliyyat qrafiki), müstəqil təhlükəsizlik
yoxlaması və yeni ADR ilə yenidən açılır.

## K4 — İfadə
İctimai mətnlərdə dəyər qatı yalnız "tədqiqat istiqaməti" kimi, ilk buraxılışın və pilotun hissəsi olmadığı açıq yazılaraq xatırlanır.

# Nəzərdən keçirilən variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| ADR-0003-ü olduğu kimi saxlamaq | rədd | Qeyri-kommersiya şəbəkəsi, ödənişsiz model və proyeksiya zənciri ilə ziddiyyət təşkil edən Active qərar |
| ADR-0003-ü tamamilə geri götürmək | rədd | Tədqiqat yığımı qorunmalıdır; istiqamət gələcəkdə yenidən qiymətləndirilə bilər |
| **Dayandırmaq: tədqiqat istiqaməti, yenidən açılma şərtlə** | **seçildi** | Bugünkü qərarlarla uyğun; yığım qeyddə qalır |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| VL1 | Şəbəkə token buraxmır; ödəniş, hesablaşma və ya dəyər köçürməsi aparmır; dəyər qatı idarəetmə orqanının qərarı, müstəqil təhlükəsizlik yoxlaması və yeni ADR olmadan açılmır. |

# Nəticələr

- [[ADR-0003]]: status `Superseded` (dayandırılıb — tədqiqat istiqaməti), əvvəlində bu ADR-ə işarə edən qeyd.
- Kod dəyişikliyi yoxdur; ictimai mətnlər artıq "tədqiqat istiqaməti" deyir.

# Status

**Accepted — 2026-10-30.** Layihə rəhbərliyinin təsdiqi ilə (hərfi sitat özəl təsdiq qeydindədir). DECISIONS: D-AUTH-6. VL1 məcburidir.
