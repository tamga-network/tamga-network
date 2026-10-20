---
document_id: ADR-0020
title: "Səlahiyyətli mənbə qurumdadır"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Hostinqli buraxılışda fərdi məlumatların səlahiyyətli mənbəyi qurumdur; Tamga şəxs qeydləri saxlamır. İki yol var: (A) qurum API vasitəsilə şəxsin şəxsiyyətinə bağlı təklif yaradır və bağlantını özü göndərir; şəxs rəqəmsal cüzdanda şəxsiyyətini təqdim edir, uyğunluq olarsa rəqəmsal sənəd verilir. (B) şəxs rəqəmsal cüzdandan sorğu göndərir və şəxsiyyətini təqdim edir; Tamga imzalı sorğu ilə qurumun sorğu nöqtəsinə müraciət edir. Hər iki yolda rəqəmsal sənəd məlumatları imza anında qurumdan oxunur, saxlanmır. Qurum Konsolundakı qeyd reyestri yalnız "nümunə mənbə" (sınaq) kimi qalır.
domain: Services
translation_of: ADR-0020
source_version: "1.0.0"
---

# Kontekst

Hazırda hostinqli buraxılışda Tamga qurumun şəxs qeydlərini (tələbələri) öz verilənlər bazasında saxlayır ([[ADR-0019]]). Qeydlər Qurum
Konsolundan daxil edilir. Şəxs rəqəmsal cüzdandan rəqəmsal sənəd istədikdə onun şəxsiyyəti bu qeyd reyestrində axtarılır. Qurum təklif yaratdıqda da şəxs bu
reyestrdən seçilir.

Layihə rəhbərliyi (2026-09-29) bu quruluşu istəmədi:
- tələbələrin toplu yüklənməsi olmayacaq,
- "məlumatlarla bizim işimiz yoxdur",
- səlahiyyətli mənbə qurumun öz sistemidir (tələbə məlumat sistemi),
- təklif e-poçtunu qurum özü göndərir,
- tələbənin rəqəmsal cüzdandan sorğu göndərməsi və Tamga-nın quruma müraciət etməsi təsdiqləndi,
- təklifin şəxsin şəxsiyyətinə bağlı olması təsdiqləndi.

Avropa İttifaqı (Aİ) tərəfində də [[t:PID]] və ya rəqəmsal sənəd provayderi atributu [[t:authentic-source|səlahiyyətli mənbədən]] alır ([[t:ARF]] mövzu 42; CIR 2025/1569). Mənbə məlumatlarının
vasitəçi tərəfindən daimi saxlanması gözlənilmir.

# Qərar

## K1 — Səlahiyyətli mənbə və mənbə bağlantısı

Hər qurum üçün bir **mənbə bağlantısı** müəyyən edilir (`tenants/<slug>.json` → `authentic_source`):

- **`remote`** (istehsal): qurumun **sorğu nöqtəsi**. Tamga iki əməliyyat tələb edir:
  - `lookup`: şəxsiyyət açarları (T.C. şəxsiyyət nömrəsi + doğum tarixi) ilə axtarış → qurumun opak şəxs identifikatoru (`subject_ref`) +
    rəqəmsal sənəd məlumatları,
  - `fetch`: `subject_ref` ilə rəqəmsal sənəd məlumatları (yeniləmə və şəxsiyyətə bağlı təklif üçün).

  Sorğu Tamga-nın qurum üçün istifadə etdiyi giriş açarı ilə imzalanmış qısamüddətli JWT-dir (`aud` = sorğu nöqtəsi, `iat`, `jti`); qurum
  sorğunu Tamga-nın [[t:trust-list|etibar siyahısındakı]] sertifikatı ilə yoxlayır. Cavab və format OpenAPI ilə müəyyən edilir.
- **`sandbox`** (sınaq): Qurum Konsolundakı nümunə qeyd reyestri ([[ADR-0019]] KC4). Yalnız sınaq və nümayiş üçündür; real
  fərdi məlumatlarla istifadə edilmir.

## K2 — Tamga nəyi saxlayır

- Rəqəmsal sənəd məlumatları (ad, proqram, qiymət …) **saxlanmır**: imza anında mənbədən oxunur, rəqəmsal sənəd verildikdən sonra yaddaşdan silinir.
- Daimi saxlanan yalnız qurumun opak `subject_ref`-i (verilmiş rəqəmsal sənəd qeydində, ləğv və yeniləmə üçün) və şəxsiyyətə bağlı təklifdə uyğunlaşdırma
  açarlarının **açarlı heşidir** (HMAC; açıq T.C. şəxsiyyət nömrəsi yoxdur).
- Jurnallara fərdi məlumatlar yazılmır (PR14 olduğu kimi).

## K3 — Yol A: qurum başladır, təklif şəxsin şəxsiyyətinə bağlıdır

1. Qurumun sistemi Tamga API-sinə (`POST /{slug}/api/v1/offers`, [[ADR-0016]]) aşağıdakıları göndərir:
   - rəqəmsal sənəd növü,
   - qurumun `subject_ref`-i,
   - uyğunlaşdırma açarları: `bind { personal_administrative_number, birth_date }`.
2. Tamga **şəxsiyyətə bağlı təklif** yaradır: [[t:OpenID4VCI]] `authorization_code` grant-ı, `issuer_state` = təklif identifikatoru. Cavabda
   bağlantı və QR kod qaytarılır. **E-poçtu və ya mesajı qurum özü göndərir**; Tamga əlaqə ünvanını görmür.
3. Şəxs bağlantını rəqəmsal cüzdanda açır. Rəqəmsal cüzdan [[t:PAR|PAR-da]] `issuer_state`-i göndərir. Avtorizasiya zamanı şəxs Tamga şəxsiyyət sənədini
   təqdim edir (mövcud sətirdaxili axın).
4. Qurumun [[t:issuer|sənəd verəni]] şəxsiyyət sənədini yoxlayır və T.C. şəxsiyyət nömrəsi + doğum tarixinin heşini təklifdəki heşlə müqayisə edir. Uyğun gəlmədikdə
   rəqəmsal sənəd verilmir. Təklifi başqası açsa belə, rəqəmsal sənədi ala bilməz.
5. Rəqəmsal sənəd məlumatları imza anında mənbədən (`fetch`) oxunur.
6. `tx_code` ilə əvvəlcədən avtorizasiya olunmuş təklif şəxsiyyət sənədi olmayanlar üçün **ehtiyat** variant kimi qalır. Kod təkliflə eyni kanaldan göndərilmir
   (PR12).
7. Təklif standart olaraq 7 gün etibarlıdır və birdəfəlikdir.

## K4 — Yol B: şəxs başladır

Şəxs rəqəmsal cüzdanda qurumu seçir və şəxsiyyətini təqdim edir. Qurumun sənəd verəni mənbə bağlantısına `lookup` ilə sorğu göndərir (`sandbox` rejimində qeyd reyestri).
Qeyd varsa, rəqəmsal sənəd verilir; qeyd yoxdursa, "qurum qeydlərində tapılmadı" cavabı qaytarılır. Cavab saxlanmır.

## K5 — Yeniləmə və ləğv

Yeniləmə tokeni ([[ADR-0023]]) `subject_ref` daşıyır. Yeniləmə zamanı `fetch` çağırılır; şəxs mənbədə yoxdursa, token etibarsız olur (AR3).
Qurum ləğvi API-dən və ya Konsoldan həyata keçirir ([[ADR-0016]]).

## K6 — Qurum dəsti

- **OpenAPI:** Tamga API-si (təklif, ləğv) və qurumun sorğu nöqtəsi müqaviləsi.
- **Node SDK:** `@tamga-network/issuer/client`-ə şəxsiyyətə bağlı təklif əlavə edilir.
- Sənəd verəni qurumun öz serverində işlətmək imkanı saxlanılır ([[ADR-0016]]).

## K7 — Qurum Konsolu

- "Qeyd reyestri" bölməsi **"Nümunə mənbə (sınaq)"** adlanır və yalnız `sandbox` rejimində görünür.
- "Qurum qeydi" bölməsi mənbə bağlantısının növünü və sorğu nöqtəsini göstərir.

# Nəzərdən keçirilən variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Tamga-da qeyd reyestri (hazırkı) | rədd (yalnız sınaq) | Tamga fərdi məlumatları saxlayır; toplu yükləmə tələb olunur |
| Qurum rəqəmsal sənəd məlumatlarını təkliflə göndərir, Tamga saxlayır | rədd | Məlumatlar təklif müddəti ərzində Tamga-da qalır; sorğu nöqtəsi varsa, lazımsızdır |
| **Təklifdə yalnız subject_ref + şəxsiyyət heşi; məlumatlar imza anında mənbədən** | **qəbul** | Tamga-da daimi fərdi məlumat yoxdur; yeniləmə də eyni yolla |
| Təklif e-poçtunu Tamga göndərir | rədd | Tamga əlaqə ünvanını görür; layihə rəhbərliyi qurumun göndərməsini istədi |
| Şəxsiyyət bağı yoxdur, yalnız tx_code | rədd (ehtiyat) | Bağlantını ələ keçirən rəqəmsal sənədi ala bilər |

# İnvariantlar

| Kod | Qayda |
|---|---|
| AS1 | Hostinqli buraxılışda rəqəmsal sənəd məlumatları daimi saxlanmır; imza anında səlahiyyətli mənbədən oxunur. Daimi saxlanan yalnız qurumun opak şəxs identifikatoru və uyğunlaşdırma açarlarının açarlı heşidir. |
| AS2 | Şəxsiyyətə bağlı təklif yalnız təqdim edilən şəxsiyyət sənədindəki uyğunlaşdırma açarları təklifdəki heşlə uyğun gəldikdə rəqəmsal sənədə çevrilir. |
| AS3 | Tamga təklif üçün şəxsin əlaqə ünvanını almır; bağlantını qurum ötürür. |
| AS4 | `sandbox` mənbəyi yalnız sınaq üçündür; real fərdi məlumatlarla istifadə edilmir. |

# Nəticələr

- `apps/issuer` (operator repozitoriyası): mənbə bağlantısı abstraksiyası (`sandbox` / `remote`), şəxsiyyətə bağlı təklif (`issuer_state`),
  Yol B-də `lookup`, rəqəmsal sənəd nöqtəsində `fetch`, yeniləmədə `fetch`.
- `@tamga-network/issuer`: `createPar` `issuer_state`; təklif obyekti `authorization_code` grant-ı. `wallet-core`: təklif
  `authorization_code` grant-ı → `issuer_state` ilə avtorizasiya.
- [[ADR-0011]] K3 və [[ADR-0019]] qeyd reyestri bəndləri bu ADR ilə daralır. [[SPEC-PROTO-0001]] §3 və §11.2 yenilənir.
- OpenAPI faylları `tamga-network/docs/api/`.

# Status

**Accepted — 2026-09-29.** Layihə rəhbərliyinin təsdiqi ilə (toplu yükləmə yoxdur; e-poçtu qurum göndərir; Yol B; şəxsiyyətə bağlı təklif).
DECISIONS: D-SRC-1.
