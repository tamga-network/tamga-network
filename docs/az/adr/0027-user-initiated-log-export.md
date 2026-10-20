---
document_id: ADR-0027
title: "Əməliyyat jurnalının ixracı"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  SPEC-WALLET-0001/WL4 təqdimat jurnalının cihazdan heç vaxt çıxmamasını tələb edir. Avropa İttifaqı (Aİ) (CIR 2024/2979 maddə 9 və 13, TS10) isə rəqəmsal cüzdanın əməliyyat jurnalını və köçürmə obyektini şəxsin istəyi ilə ixrac edə bilməsini məcburi edir. Qərar: jurnal cihazdan yalnız şəxsin özünün başlatdığı, öz parolu ilə şifrələnmiş (PBES2 + A128GCM) ixracda çıxır; avtomatik və ya Tamga serverinə heç vaxt çıxmır. WL4 bu şəkildə daraldıldı.
domain: Wallet
translation_of: ADR-0027
source_version: "1.0.0"
---

# Kontekst

SPEC-WALLET-0001 iki qayda müəyyən edir:

- **WL4:** `presentation_log` cihazdan çıxmır; ehtiyat nüsxəyə daxil edilmir.
- **WL2:** ehtiyat nüsxə rəqəmsal sənədləri və manifesti daşıyır, açarları daşımır.

Əsaslandırma: hansı [[t:verifier|yoxlayan tərəfə]] nəyin göstərildiyinin qeydi şəxsin davranış profilidir; bir serverdə toplanarsa, mərkəzləşdirilmiş izləmə
vasitəsinə çevrilir.

Aİ tərəfində vəziyyət fərqlidir:

- **CIR 2024/2979 maddə 9 və 13, həmçinin [[t:ARF]] mövzu 34 (DASH_07, MIG_*):** rəqəmsal cüzdan əməliyyat jurnalını aparır. Şəxs jurnalı və
  [[t:credential|rəqəmsal sənədlərinin]] siyahısını ehtiva edən **köçürmə obyektini** ixrac edə və yeni rəqəmsal cüzdana idxal edə bilər.
- **TS10:** formatı müəyyən edir — JSON məlumat modeli, parolla şifrələnmiş JWE (`PBES2-HS256+A128KW` + `A128GCM`).

Aİ boşluq təhlilində (H1, P5) bu məsələ açıq qalmışdı. Köçürmə obyektinin kodu yazılmışdı (`wallet-core` `ts10.ts`), lakin WL4 qəti qərar
olduğu üçün jurnal fayla **daxil edilmirdi**; tarixçə ekranındakı jurnal ixracı düyməsi (DASH_07 üçün) də deaktiv idi.

# Qərar

## K1 — WL4-ün mətni

Təqdimat jurnalı və hadisə jurnalı cihazdan **yalnız şəxsin özünün başlatdığı ixracda** çıxır:

- **TS10 köçürmə faylı:** şəxsin seçdiyi parolla şifrələnir; ən azı 8 simvol; PBKDF2 ən azı 200 000 iterasiya.
- **Əməliyyat jurnalının ixracı:** TS10 §4.1; eyni şifrələmə.

Fayl əməliyyat sisteminin paylaşım menyusu vasitəsilə şəxsin seçdiyi yerə göndərilir.

**Heç bir halda:**
- avtomatik və ya arxa fonda ixrac aparılmır,
- Tamga-nın və ya hər hansı digər tərəfin serverinə yükləmə edilmir,
- server tərəfində ehtiyat nüsxə çıxarılmır (SPEC-WALLET-0001 §7.1 olduğu kimi qalır).

## K2 — Məzmun həddi

Fayla rəqəmsal sənəd **dəyərləri**, nüsxələr və açarlar daxil edilmir. Jurnalda yalnız aşağıdakılar olur:
- sahə adları,
- [[t:trust-list|etibar siyahısından]] yoxlayan tərəf və ya qurum məlumatı,
- vaxt və nəticə.

Rəqəmsal sənədlər yeni rəqəmsal cüzdanda qurumlardan yenidən alınır (WL2 olduğu kimi).

## K3 — Şifrəsiz ixrac yoxdur

Sadə JSON formatında jurnal ixracı (`exportLog`) yoxdur; jurnal yalnız TS10 şifrələnmiş formatında ixrac edilir.

# Əsaslandırma / alternativlər

| Variant | Nəticə | Səbəb |
|---|---|---|
| WL4 olduğu kimi, jurnal heç ixrac edilmir | rədd | Aİ tələbi (CIR 2024/2979; TS10) ödənilmir; şəxs öz məlumatlarına çıxış əldə edə bilmir |
| Jurnalın Tamga serverində şifrələnmiş ehtiyat nüsxəsi | rədd | Mərkəzdə davranış məlumatları toplanır (şifrələnmiş olsa belə metaməlumat); WL4-ün məqsədinə ziddir |
| **Yalnız şəxsin başlatdığı, şəxsin parolu ilə şifrələnmiş fayl** | **qəbul** | Aİ ilə uyğunluq; məlumatlar şəxsin nəzarətindədir, Tamga onları görmür |
| Sadə JSON ixracı | rədd | Fayl paylaşım tətbiqlərində açıq qalır |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| LX1 | Jurnal cihazdan yalnız şəxsin başlatdığı, şəxsin parolu ilə şifrələnmiş (TS10 §5) ixracda çıxır; avtomatik və ya serverə ixrac yoxdur. |
| LX2 | İxrac edilən jurnalda və köçürmə faylında rəqəmsal sənəd dəyəri, nüsxə və açar olmur. |

# Status

**Accepted — 2026-09-29.** Layihə rəhbərliyinin təsdiqi ilə (gözləyən qərarlarda Aİ yanaşması). DECISIONS: D-WALLET-2.

Tətbiq:
- SPEC-WALLET-0001 WL4 mətni bu qərara uyğun yazıldı,
- rəqəmsal cüzdanda jurnal ixracı aktivdir (TS10 §4.1, parolla),
- köçürmə faylı jurnalı ehtiva edir; idxal zamanı şəxsdən jurnalın bərpa edilib-edilməyəcəyi soruşulur (ARF Mig_07b),
- sadə JSON ixracı yoxdur.
