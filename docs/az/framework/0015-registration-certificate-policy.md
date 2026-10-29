---
document_id: FW-POL-0003
title: "Qeydiyyat Sertifikatı Siyasəti"
status: Active
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  Tamga qeydiyyat orqanının yoxlayan tərəflərə və sənəd verənlərə verdiyi qeydiyyat sertifikatlarının (WRPRC, ETSI TS 119 475) siyasəti: əhatə, məzmun və mənbəyi, PKI iyerarxiyası və etibar lövbəri, etibarlılıq, ləğv şərtləri və ləğv sorğusu, status siyahısı, cüzdanın yoxlaması və siyasət identifikatorları (Aİ ARF RPRC_01b; TS 119 475 §6). ADR-0024, ADR-0026, ADR-0058 və ADR-0068-dən tərtib edilib; yeni qayda qoymur.
translation_of: FW-POL-0003
source_version: "1.0.0"
---

# 1. Əhatə dairəsi və status

Bu sənəd Tamga şəbəkəsində [[t:registration-certificate|qeydiyyat sertifikatı]] verənin (qeydiyyat orqanı; bu gün dövlət adına
müvəqqəti olaraq Tamga) siyasətidir. ETSI TS 119 475 §6.1.3 siyasətin maşınla oxunan və insanla oxunan formada göstərilməsini
tələb edir: maşınla oxunan forma hər sertifikatdakı `policy_id`, insanla oxunan forma bu səhifədir (`certificate_policy`). Aİ ARF
RPRC_01b ləğv şərtlərini göstərən siyasət tələb edir; şərtlər §6-dadır.

Siyasət qərar vermir: qaydalar [[ADR-0024]], [[ADR-0026]], [[ADR-0058]] və [[ADR-0068]]-dən tərtib edilib. Ziddiyyət olarsa
mənbə üstündür.

# 2. Sertifikat və onun subyekti

| Mövzu | Qayda |
|---|---|
| Kimə | Etibar siyahısındakı hər yoxlayıcı istifadəsi (`scope_id`) və hər sənəd verən üçün bir sertifikat; yalnız hüquqi şəxslər |
| Format | JWT `rc-wrp+jwt` (JAdES B-B, x5c) və yaxın sahə üçün eyni yükün CBOR forması `rc-wrp+cwt` |
| Məzmun mənbəyi | Yalnız imzalı etibar siyahısındakı qeyd ([[ADR-0026]] WRC1) |
| Kimlik | `sub` = təşkilatın EN 319 412-1 semantik identifikatoru; giriş sertifikatındakı `organizationIdentifier` ilə eyni ([[ADR-0058]]) |
| İdentifikasiya nömrəsi yoxdursa | Sertifikat yaradılmır |

# 3. PKI iyerarxiyası və etibar lövbəri

| Qat | Nədir | Harada dərc olunur |
|---|---|---|
| Etibar lövbəri | Siyahılar siyahısının (LOTL) imza açarı | `trust.tamga.network/keys/root-fingerprints.json`, Trust Framework ([[FW-TF-0001]]) |
| Qeydiyyat orqanı açarı | Qeydiyyat sertifikatlarını **və** status siyahısını imzalayır ([[ADR-0026]] WRC2) | LOTL `national_lists[].roles.registrar.signing_keys` |
| Qeydiyyat sertifikatı | Son sənəd; x5c-də qeydiyyat orqanı sertifikatı | `trust.tamga.network/wrprc/…` |

# 4. Etibarlılıq

- Ən çox 12 ay və qeydiyyatın və ya istifadənin bitmə tarixini keçmir ([[ADR-0026]] WRC3).
- Məzmun dəyişməyibsə eyni sertifikat sayılır və status siyahısındakı yerini saxlayır; məzmun dəyişərsə yeni sertifikat verilir
  və köhnəsi ləğv edilir (§6).

# 5. Siyasət identifikatorları

| Mühit | `policy_id` | `certificate_policy` |
|---|---|---|
| Sandbox (test şəbəkəsi) | `2.25.220506472418443381081254370400837050484` | bu səhifə |
| Real şəbəkə | TƏKLİF: təşkilatın IANA xüsusi müəssisə nömrəsi (PEN) altında; təsdiqdən sonra dərc olunur | bu səhifə |

ETSI-nin Aİ siyasət OID-i `0.4.0.19475.3.1` istifadə edilmir ([[ADR-0068]] WRS1).

# 6. Ləğv

**Şərtlər.** Qeydiyyat orqanı sertifikatı gecikmədən ləğv edir:

| Vəziyyət | Səbəb kodu |
|---|---|
| Qeydiyyatın və ya istifadənin müddəti bitdi, istifadə dayandırıldı | `registration_ended` |
| Qeydiyyat dayandırıldı və ya ləğv edildi, qeyd siyahıdan çıxdı | `registration_ended` |
| Sertifikat məzmunu qeydiyyatla artıq uyğun gəlmir | `superseded` |
| Etibarlı ləğv sorğusu | `manual: <səbəb>` |

Dayandırma yoxdur: dayandırılan qeydiyyatın sertifikatı ləğv edilir.

**Ləğv sorğusu.** Yalnız qeydiyyat orqanından, sertifikatın subyekti olan təşkilatdan (səlahiyyətli nümayəndəsi daxil) və ya
səlahiyyətli dövlət orqanından (məs. məlumatların qorunması orqanı) qəbul edilir. Sorğu edənin kimliyi operatorun daxili
qeydlərində saxlanılır; açıq dəyişiklik qeydinə şəxs adı yazılmır.

**Təsir.** Ləğv eyni dərcdə status siyahısına yazılır; siyahı ən geci bir saat ərzində yenidən imzalanır.

# 7. Status siyahısı

| Mövzu | Qayda |
|---|---|
| Format | IETF Token Status List, `statuslist+jwt` ([[SPEC-CRED-0003]]); `bits` = 1: 0 etibarlı, 1 ləğv edilib |
| Sertifikatdakı qeyd | `status.status_list` = `{idx, uri}` |
| Ünvan | dərc kökündə `/status/wrprc/<n>`; sandbox `https://trust.sandbox.tamga.network/status/wrprc/1` |
| İmza | qeydiyyat orqanı açarı (§3) |
| Təzəlik | `ttl` 1 saat, `exp` 24 saat |
| İndeks | təsadüfi; ləğv edilmiş indeks yenidən istifadə olunmur |

# 8. Cüzdanın yoxlaması

[[ADR-0068]] K5: cüzdan sertifikatın imzasını, müddətini, giriş sertifikatı ilə bağlılığını və ləğv statusunu yoxlayır. Ləğv
edilmiş sertifikatlı sorğuya məlumat göndərilmir; status yoxlana bilmirsə şəxs xəbərdar edilir.

# 9. Qərarlar və açıq mövzular

| Mövzu | Status |
|---|---|
| Siyasət identifikatoru, sənəd və status siyahısı | **Qərar (2026-10-29, [[ADR-0068]]):** sandbox-da qüvvədədir |
| Real şəbəkənin siyasət OID-i və ünvanları | Açıq: adın təsdiqi və PEN müraciəti ([[ADR-0068]] K1) |

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-29).
