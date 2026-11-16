---
document_id: ADR-0088
title: "Dayandırılmış qurumun sənədləri"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-16
last_updated: 2026-11-16
summary: >
  Sənəd verən qurum etibar siyahısında dayandırıldığı müddətdə onun verdiyi sənədlər, verilmə anından asılı olmayaraq yoxlamada
  qəbul edilmir (C1 RƏDD, səbəb "issuer suspended"); dayandırma qaldırılanda ondan əvvəl verilmiş sənədlər yenidən qəbul edilir,
  dayandırma müddətində verilmiş sənədlər heç vaxt. Dayandırma sənədləri ləğv etmir. Ləğv edilmiş, təqaüdə çıxmış və qeydiyyat
  müddəti bitmiş qurum üçün verilmə anı qaydası qalır (ələ keçirilmədə `invalidates_from`). Aİ çərçivəsinin (ARF 3.0 §4.6.5,
  §6.3.3) dayandırma qaydasına keçilir; əvvəlki "dayandırma yalnız onun müddətində verilmiş sənədi düşürür" qaydası (ADR-0073 K5)
  bu qədər dəyişir. Siyahı mənbəyi, zəncir kontraktı və indeksləyici eyni cavabı verir; cüzdan dayandırılmış qurumun sənədini
  silmir, kartda xəbərdarlıqla göstərir. Qəbul: 2026-11-16.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0014]]", "[[ADR-0048]]", "[[ADR-0073]]", "[[ADR-0084]]", "[[SPEC-API-0001]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[FW-TF-0001]]", "[[FW-RB-0001]]", "[[FW-POL-0001]]"]
translation_of: ADR-0088
source_version: "1.0.0"
---

# Qısaca

Qurum (sənəd verən) etibar siyahısında dayandırılanda indiyədək yalnız yeni sənəd verməsi dayanırdı; əvvəl verdiyi sənədlər qəbul
edilməyə davam edirdi. Aİ çərçivəsində isə dayandırılmış qurumun sənədlərinə etibar edilmir. Bu qərarla Tamga da Aİ kimi
davranır: qurum dayandırıldığı müddətdə onun heç bir sənədi qəbul edilmir. Dayandırma müvəqqətidir: qurum yenidən aktiv olanda
dayandırmadan əvvəl verdiyi sənədlər yenidən qəbul edilir.

# Kontekst

- **Əvvəlki qayda.** C1 (`isCredentialAcceptable`) sənədin `iat` anına baxır ([[ADR-0009]] D-BC-3): qurum o anda `ACTIVE`
  olmalıdır. Sonradan gələn dayandırma, təqaüd və ya çıxarma əvvəlki sənədləri düşürmürdü; [[SPEC-BC-0001]]/GV1-in geniş oxunuşu
  və [[ADR-0073]] K5 bu qaydanı dayandırmaya da tətbiq edirdi.
- **Aİ qaydası.** ARF 3.0 §4.6.5: dayandırılmış və ya ləğv edilmiş sənəd verənin sənədləri etibar edən tərəflərcə qəbul edilmir.
  §6.3.3: dayandırma və ya ləğvdə sənəd verənin giriş sertifikatları ləğv edilir; PID, QEAA və PuB-EAA təminatçısı siyahıda
  "Invalid" olur və yoxlayıcılar onun sənədlərinə etibar etmir.
- **Fərq.** Eyni sənəd Aİ cüzdanında və ya yoxlayıcısında rədd edilir, Tamga-da isə qəbul edilirdi.
- **Layihə rəhbərliyinin istiqaməti (2026-11-16).** Dayandırmada Aİ kimi edilir. Ləğv və qeydiyyat müddətinin bitməsi üçün ayrıca
  istiqamət verilmədi; bu qeyd yalnız dayandırmanı dəyişir və digərləri üçün qaydanı açıq yazır.

# Qərar

## K1 — Dayandırılmış qurumun sənədləri qəbul edilmir

- C1 iki sualı birlikdə verir: (1) qurum sənədin `iat` anında sənəd verə bilərdimi (dəyişməyib) və (2) qurum **indi**
  (yoxlama anında) dayandırılıbmı. İkincisi bəlidirsə nəticə `NO`-dur — sənədin nə vaxt verildiyinə baxılmır.
- "İndi dayandırılıb" qurumun status tarixçəsindən oxunur: `since` dəyəri yoxlama anından əvvəl və ya ona bərabər olan son qeyd
  `SUSPENDED`-dirsə qurum dayandırılıb.
- Yoxlayıcının nəticəsi üç dəyərli modeldə qalır (CMP9): `REJECTED`, `failed_step: "C1"`, `failed_reason: "issuer suspended"`.
  Yeni nəticə dəyəri və ya addım kodu əlavə edilmir. Siyahı köhnədirsə nəticə `INDETERMINATE` qalır (CMP4).

## K2 — Dayandırma qaldırılanda sənədlər yenidən qəbul edilir; dayandırma ləğv deyil

- Qurum yenidən `ACTIVE` olanda dayandırmadan əvvəl verilmiş sənədlər yenidən qəbul edilir. Dayandırma müddətində verilmiş sənəd
  heç vaxt qəbul edilmir.
- Dayandırma sənədin ləğv siyahısındakı statusunu dəyişmir. Səbəb sənədlərin etibarlılığını daimi pozursa (məsələn imza açarının
  sızması), yol [[FW-POL-0001]]-dəki kimidir: qurumun və sənədlərin ləğvi.

## K3 — Ləğv, təqaüd və müddətin bitməsi: verilmə anı qaydası qalır

| Qurumun statusu | Qayda | ARF |
|---|---|---|
| `SUSPENDED` | **Dəyişdi:** dayandırma davam etdikcə bütün sənədlər RƏDD; qaldırılanda əvvəlkilər qəbul | §4.6.5: qəbul edilmir — uyğun |
| `REVOKED` (yumşaq ləğv, çıxarma) | Dəyişmədi: ləğvdən əvvəl verilmiş sənədlər qəbul (GV1, [[ADR-0002]] #4) | §4.6.5: qəbul edilmir — **şüurlu fərq** |
| `REVOKED` + `invalidates_from` (ələ keçirilmə) | Dəyişmədi: o andan verilmiş sənədlər RƏDD | uyğun |
| `RETIRED` (könüllü çıxış) | Dəyişmədi: əvvəlki sənədlər qəbul | ARF-də qarşılığı yoxdur |
| Qeydiyyat müddəti bitib (`valid_until`) | Dəyişmədi: müddət ərzində verilmiş sənədlər qəbul | ARF-də qarşılığı yoxdur |

Ləğvdəki fərqin səbəbi: Tamga sənədlərinin çoxu (diplom) daimidir və qurumun bağlanması keçmişdə düzgün verilmiş sənədi etibarsız
etməməlidir; eyni nəticə lazım olanda sərt ləğv (`invalidates_from`) və sənəd ləğvi istifadə edilir. Dayandırılmış qurum ləğv
edilərkən ləğvin yumşaq və ya sərt olduğu qeydiyyat səbəbində yazılır.

## K4 — Zəncir ekvivalentliyi

Siyahı mənbəyi ([[SPEC-TRUST-0001]]), kontrakt (`IssuerRegistry.isCredentialAcceptable`: qurumun bugünkü statusu `SUSPENDED`-dirsə
`false`) və indeksləyicinin etibar mənbəyi eyni qaydanı tətbiq edir ([[ADR-0073]] K6). Yoxlama qərarı yenə yalnız siyahıdan
verilir ([[ADR-0084]]). Xarici siyahılardakı qurumlar həmin siyahının qaydası ilə qiymətləndirilir ([[ADR-0036]]). Kök sertifikat
orqanının dayandırılması bu qərarın əhatəsindən kənardadır.

## K5 — Cüzdan

- Cüzdan dayandırılmış qurumun sənədini silmir və ləğv edilmiş saymır; kartda "qurum dayandırılıb" xəbərdarlığı ilə göstərir.
- Dayandırılmış qurumdan yeni sənəd alınmır (C1).
- Sənədin cüzdandakı göstərilmə statusu nüvədə hesablanır (`credentialValidity`, status `issuer_suspended`); etibar siyahısı
  yoxlana bilmirsə xəbərdarlıq göstərilmir.

# Nəzərdən keçirilən seçimlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Əvvəlki qayda + əsaslandırma qeydi | rədd | Aİ cüzdanı və yoxlayıcısı ilə nəticə ayrılır |
| Ayrı nəticə dəyəri (`SUSPENDED`) | rədd | Üç dəyərli nəticə modeli (CMP9) pozulur; səbəb sahəsi kifayətdir |
| Dayandırmada `INDETERMINATE` | rədd | Dayandırma məlum vəziyyətdir, "naməlum" deyil |
| Ləğvdə də Aİ kimi | rədd (bu qeyddə) | Daimi sənədlər (diplom) qurum bağlananda düşərdi |
| **Dayandırmada verilmə anından asılı olmayaraq rədd, qaldırılanda qəbul; ləğvdə verilmə anı** | **seçildi** | Aİ dayandırma qaydası; dayandırma geri alına bilən qalır; daimi sənədlər qorunur |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| SI1 | Sənəd verən qurum yoxlama anında etibar siyahısında `SUSPENDED`-dirsə onun verdiyi heç bir sənəd qəbul edilmir (C1 `NO`; yoxlayıcı nəticəsi `REJECTED`, səbəb "issuer suspended"); sənədin verilmə anı nəticəni dəyişmir. |
| SI2 | Dayandırma sənədləri ləğv etmir: qurum yenidən `ACTIVE` olanda dayandırmadan əvvəl verilmiş sənədlər yenidən qəbul edilir; dayandırma müddətində verilmiş sənəd heç vaxt qəbul edilmir. |
| SI3 | Ləğv edilmiş (`REVOKED`), təqaüdə çıxmış (`RETIRED`) və qeydiyyat müddəti bitmiş qurum üçün verilmə anı qaydası qalır: əvvəlki sənədlər qəbul edilir; ələ keçirilmədə `invalidates_from`-dan verilmiş sənədlər rədd edilir. |
| SI4 | Siyahı mənbəyi, zəncir kontraktı və zəncir etibar mənbəyi dayandırmada eyni cavabı verir. |

# Nəticələr

- `packages/trust`: `ListTrustSource.isCredentialAcceptable`-da dayandırma yoxlaması; yeni ixtiyari `TrustSource.isIssuerSuspended`.
- `packages/verifier`: C1 səbəbi "issuer suspended".
- `packages/wallet-core`: `credentialValidity` (`issuer_suspended`).
- `contracts/`: `IssuerRegistry.isCredentialAcceptable` dayandırmada `false`; `apps/chain-indexer`: eyni qayda.
- Sənədlər: [[SPEC-API-0001]] §1.1, [[SPEC-BC-0001]] §3.3 və GV1 qeydi, [[ADR-0073]] qeydi; çərçivə sənədləri.

# Status

**Accepted — 2026-11-16** (layihə rəhbərliyinin təsdiqi). DECISIONS: D-TRUST-8. SI1–SI4 məcburidir.
