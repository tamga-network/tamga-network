---
document_id: ADR-0071
title: "Müvəqqəti dövrdə şəbəkənin maliyyələşməsi: xidmət haqqı yoxdur; fond qrantlar və dövlət/üzv töhfələri ilə"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  Müvəqqəti dövrdə (fond qurulub idarəetmə orqanı qərar verənə qədər) Tamga Network heç bir iştirakçıdan — sənəd verən qurum, yoxlayan tərəf, cüzdan təminatçısı, fiziki şəxs — qeydiyyat, sənəd vermə, yoxlama və ya siyahı xidməti üçün haqq almır. Fond qurulanda qrantlar, şərtsiz ianələr və dövlət/üzv töhfələri ilə maliyyələşir; o vaxta qədər xərcləri müvəqqəti operator qarşılayır. Maliyyə töhfəsi qeydiyyat qərarına, siyahıdakı yerə və ya idarəetmə səsinə təsir etmir. Qurumdan illik haqq alınacağını deyən köhnə kommersiya istiqaməti ləğv edildi. Qəbul: 2026-10-30.
domain: Governance
related: ["[[ADR-0035]]", "[[ADR-0037]]", "[[ADR-0070]]", "[[FW-TF-0001]]"]
translation_of: ADR-0071
source_version: "1.0.0"
---

# Qısaca

Şəbəkə heç kimdən pul almır: nə qurumdan, nə yoxlayan tərəfdən, nə cüzdandan, nə də fiziki şəxsdən. Fond qurulanda şəbəkə qrantlar
və dövlət və ya üzv töhfələri ilə yaşayır; o vaxta qədər xərcləri şəbəkəni müvəqqəti idarə edən şirkət ödəyir. Pul verən siyahıda
və ya qərarlarda imtiyaz qazanmır.

# Kontekst

- [[ADR-0037]] (D-GOV-8): Tamga Network yalnız şəbəkədir, xidmət satmır; kommersiya xidmətlərini şəbəkədən kənar şirkətlər təklif
  edir.
- Daha köhnə kommersiya istiqaməti (D-GTM-1, təfərrüatı operatorun özəl qeydlərində) sənəd verən qurumdan illik haqq alınmasını
  nəzərdə tuturdu. Bu, şəbəkənin xidmət satmaması prinsipi və qeyri-kommersiya fonduna çevrilməsi ilə ziddiyyət təşkil edirdi.
- [[FW-TF-0001]] §5.5: fiziki şəxslər üçün ödənişsiz; qurum haqqı "pilotun sonunda" müəyyən ediləcəkdi (qərar gözləyirdi).
- Layihə rəhbərliyinin istiqaməti: müvəqqəti dövrdə şəbəkə haqq almır; fond qrantlar və dövlət/üzv töhfələri ilə maliyyələşir;
  köhnə haqq bəndi ləğv edilir.

# Qərar

## K1 — Haqq yoxdur
Müvəqqəti dövrdə şəbəkə heç bir iştirakçıdan (sənəd verən qurum, yoxlayan tərəf, cüzdan təminatçısı, fiziki şəxs) siyahı
qeydiyyatı, sənəd vermə, yoxlama, şəxsiyyət xidməti və ya siyahı xidməti üçün haqq almır. Fiziki şəxslər üçün şəbəkə həmişə
ödənişsizdir.

## K2 — Maliyyələşmə
Fond qurulanda şəbəkə qrantlar, şərtsiz ianələr və dövlət və ya üzv töhfələri ilə maliyyələşir. Fond qurulana qədər şəbəkənin
xərclərini müvəqqəti operator ([[ADR-0070]]) qarşılayır; bu ona şəbəkədə imtiyaz vermir.

## K3 — Töhfə imtiyaz vermir
Maliyyə töhfəsi (qrant, ianə, dövlət/üzv töhfəsi, müvəqqəti operatorun xərcləri qarşılaması) qeydiyyat qərarına, etibar
siyahısındakı yerə, qoşulma qapılarına və ya idarəetmə səsinə təsir etmir.

## K4 — Kommersiya xidmətləri şəbəkədən kənarda
İnteqrasiya, hostinq, dəstək, məsləhət kimi ödənişli xidmətləri şəbəkədən kənar şirkətlər öz adları ilə təklif edir
([[ADR-0037]]); şəbəkənin qeydiyyat qərarı bu xidmətlərin alınmasına bağlana bilməz.

## K5 — Köhnə istiqamət
Qurumdan illik haqq alınacağını deyən köhnə kommersiya istiqaməti (D-GTM-1-in gəlir modeli hissəsi) bu qərarla ləğv edilir.
Haqq yenidən düşünülərsə, bu idarəetmə orqanının qərarını və yeni ADR tələb edir.

# Nəzərdən keçirilən variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Sənəd verən qurumdan illik haqq (köhnə istiqamət) | rədd | Şəbəkə xidmət satmır ([[ADR-0037]]); qeyri-kommersiya fondu; neytrallıq |
| Hər yoxlama üçün haqq | rədd | Şəbəkə effektinə mane olur; AB-də yoxlama şəbəkə haqqından asılı deyil |
| Haqq qərarını pilotun sonuna saxlamaq | rədd | Qurumlarla danışıqlarda qeyri-müəyyənlik; ziddiyyət qalardı |
| **Haqq yoxdur; qrantlar və dövlət/üzv töhfələri; töhfə imtiyaz vermir** | **seçildi** | Neytrallıq və fond modeli ilə uyğun; aydın və davamlı prinsip |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| FN1 | Müvəqqəti dövrdə şəbəkə heç bir iştirakçıdan siyahı qeydiyyatı, sənəd vermə, yoxlama, şəxsiyyət xidməti və ya siyahı xidməti üçün haqq almır; fiziki şəxslər üçün şəbəkə həmişə ödənişsizdir. |
| FN2 | Maliyyə töhfəsi (qrant, ianə, dövlət/üzv töhfəsi, müvəqqəti operatorun xərcləri qarşılaması) qeydiyyat qərarına, etibar siyahısındakı yerə, qoşulma qapılarına və ya idarəetmə səsinə təsir etmir. |

# Nəticələr

- Sənədlər: [[FW-TF-0001]] §5.5 bu qərarla yenidən yazıldı; operatorun özəl kommersiya qeydlərindəki haqq bəndi ləğv edildi.
- Kod dəyişikliyi yoxdur (şəbəkədə haqq alan komponent yoxdur).

# Status

**Accepted — 2026-10-30.** Layihə rəhbərliyinin təsdiqi ilə (hərfi sitat özəl təsdiq qeydindədir). DECISIONS: D-GOV-11; D-GTM-1-in
gəlir modeli hissəsi ləğv edildi. FN1–FN2 məcburidir.
