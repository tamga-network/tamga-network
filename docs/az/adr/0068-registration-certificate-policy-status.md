---
document_id: ADR-0068
title: "Qeydiyyat sertifikası siyasəti və status siyahısı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  Qeydiyyat sertifikatları (WRPRC, ETSI TS 119 475) üç sahə daşıyır: `policy_id` (Tamga-nın öz siyasət OID-i; ETSI-nin Aİ OID-i istifadə edilmir), `certificate_policy` (siyasət sənədinin ünvanı) və `status` (qeydiyyat orqanının status siyahısındakı qeyd). Qeydiyyat orqanı IETF Token Status List formatında, qeydiyyat sertifikatlarını imzalayan açarla imzalanmış 1 bitlik status siyahısı saxlayır; qeydiyyat və ya istifadə bitəndə, dayandırılanda və ya məzmun dəyişəndə köhnə sertifikat avtomatik ləğv edilir, əl ilə ləğv də mümkündür. Cüzdan nüvəsi ləğv edilmiş sertifikatlı sorğunu rədd edir, status yoxlana bilmirsə xəbərdarlıq edir. Siyasət sənədi Tamga ARF-in siyasətlərinə əlavə olunur (FW-POL-0003). Bu gün yalnız sandbox-da açıqdır; real şəbəkənin siyasət identifikatoru və ünvanları adlar təsdiqləndikdən sonra reyestrə daxil olur. Qəbul: 2026-10-29.
domain: Trust
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0029]]", "[[ADR-0038]]", "[[ADR-0048]]", "[[ADR-0056]]", "[[ADR-0058]]", "[[FW-POL-0001]]", "[[FW-POL-0003]]", "[[FW-TF-0001]]", "[[SPEC-CRED-0003]]", "[[SPEC-TRUST-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0068
source_version: "1.0.0"
---

# Qısaca

Qeydiyyat sertifikatı yoxlayan tərəfin və ya sənəd verənin şəbəkədə nəyi istəməyə və ya verməyə qeydiyyatdan keçdiyini bildirən
imzalı sənəddir. İndiyədək onun iki çatışmazlığı var idi: hansı qaydalara görə verildiyini demirdi və ləğv edilə bilmirdi. Ciddi
rejimdə işləyən Aİ cüzdanı buna görə Tamga yoxlayıcısının bütün sorğularını rədd edirdi. Bu qərarla hər qeydiyyat sertifikatı öz
siyasətinin identifikatorunu və ünvanını daşıyır, qeydiyyat orqanı isə ləğv siyahısı dərc edir. Cüzdan ləğv edilmiş sertifikatı
qəbul etmir.

# Kontekst

- **Standart.** ETSI TS 119 475 V1.2.1 Cədvəl 7 hər qeydiyyat sertifikatında `policy_id`, `certificate_policy` və `status` tələb
  edir. §6.1.3 siyasətin maşınla oxunan və insanla oxunan formada göstərilməsini (OVR-6.1.3-01/02), §6.1.4 PKI iyerarxiyasının
  və etibar lövbərinin aydın təsvirini (OVR-6.1.4-02) tələb edir. §6.2.3.9–10 və §6.2.6 ləğvi status siyahısı ilə tələb edir:
  qeydiyyat silinəndə, dayandırılanda, dəyişəndə və ya məzmun artıq düzgün deyilsə sertifikat gecikmədən ləğv edilir; siyahı
  açıq, imzalı və sıxılmış bit massividir; mənalar "etibarlı" və "ləğv edilib"dir (REV-6.2.6.2-04); `status` sahəsi `idx` və
  `uri` daşıyır (GEN-6.2.6.1-04). ETSI-nin öz siyasət OID-i `0.4.0.19475.3.1` "yenilənmiş eIDAS-a görə Aİ cüzdanına etibar
  edən tərəflərə verilən" sertifikat mənasındadır.
- **ARF.** RPRC_01a 24 saatdan uzun etibarlı sertifikatın ləğv edilə bilməsini, RPRC_01b ləğv şərtlərini göstərən siyasəti tələb
  edir. RPACANot_03b ləğv siyahılarının bildirilmiş etibar lövbərləri ilə yoxlanmasını tələb edir. RPRC_17-yə görə cüzdan
  sertifikatın formatını, həqiqiliyini və etibarlılığını yoxlayır; yoxlama uğursuzdursa istifadəçini xəbərdar edir, paylaşmaya
  icazə verilib-verilməməsinə cüzdan provayderi qərar verir. §6.6.3.3: sənəd verən üçün "ləğv edilməyib" şərti ödənmirsə sənəd
  istənmir.
- **Bu gün.** [[ADR-0026]] sertifikatları reyestrdən yaradır və qeydiyyat orqanının açarı ilə imzalayır; etibarlılıq ən çox 12
  aydır, lakin ləğv yolu yoxdur. Müstəqil Aİ test cüzdanı ilə sandbox sınağında (2026-10-29) ciddi rejim yoxlayıcının 13
  siyasətindən 13-nü yalnız bu üç sahəyə görə rədd etdi.
- **Layihə rəhbərliyinin istiqaməti.** Çatışmazlıq aradan qaldırılır; siyasət identifikatoru və ünvanlar yeni açıq ad olduğu
  üçün əvvəlcə sandbox-da tətbiq olunur, real şəbəkənin adları ayrıca təsdiqlənir.

# Qərar

## K1 — Siyasət identifikatoru (`policy_id`) və ünvanı (`certificate_policy`)

- Hər qeydiyyat sertifikatı `policy_id` (OID massivi, nöqtə ilə ayrılmış mətn) və `certificate_policy` (siyasət sənədinin HTTPS
  ünvanı) daşıyır. Tamga ETSI-nin Aİ OID-ini (`0.4.0.19475.3.1`) **istifadə etmir**: Tamga Aİ qeydiyyat orqanı deyil və o OID bu
  iddianı daşıyır. Dərc edən bu dəyəri parametrlərdə görsə dərci dayandırır.
- OID seçimləri:

  | Seçim | Qeydiyyat | Qiymətləndirmə |
  |---|---|---|
  | IANA xüsusi müəssisə nömrəsi (PEN) altında: `1.3.6.1.4.1.<PEN>.1.1` | Pulsuz müraciət, bir neçə həftə | **Real şəbəkə üçün tövsiyə olunur.** Qısa, təşkilatın öz qolu |
  | UUID əsaslı OID `2.25.<UUID>` (ITU-T X.667) | Lazım deyil | Dərhal unikal, lakin uzun və təşkilata bağlı deyil. **Sandbox üçün istifadə olunur** |
  | Yalnız ünvan (OID yoxdur) | — | Rədd: ETSI nümunəsi və X.509 təcrübəsi OID istifadə edir |
  | ETSI-nin Aİ OID-i | — | Rədd: yanlış iddia |

- **Sandbox (bu gün):** `policy_id` = `2.25.220506472418443381081254370400837050484` (yalnız sandbox), `certificate_policy` =
  `https://arf.tamga.network/policies/registration-certificate`.
- **Real şəbəkə:** OID və ünvan təsdiqlənəndə reyestrə daxil olur; kod dəyişmir.
- Dəyərlər reyestrin qeydiyyat orqanı rolunun parametrlərindədir (`roles.registrar.wrprc`); parametr yoxdursa sertifikata bu
  sahələr və `status` daxil olmur. Parametr LOTL-a yazılmır.

## K2 — Siyasət sənədi (FW-POL-0003)

- İnsanla oxunan siyasət Tamga ARF-in siyasətlərindədir: **Qeydiyyat Sertifikatı Siyasəti** ([[FW-POL-0003]],
  `arf.tamga.network/policies/registration-certificate`). Sənəd qərar vermir, bu qərarı və [[ADR-0024]], [[ADR-0026]],
  [[ADR-0058]]-i toplayır.
- Sənədin versiyası dəyişsə də OID dəyişmir; siyasətin mənası dəyişərsə yeni OID verilir.

## K3 — Status siyahısı

- Qeydiyyat orqanı IETF Token Status List formatında ([[SPEC-CRED-0003]] ilə eyni format) siyahı dərc edir: `statuslist+jwt`,
  **1 bit** (0 etibarlı, 1 ləğv edilib; dayandırma yoxdur — dayandırılan qeydiyyat ləğv edilir), tutum 100 000, zlib.
- Siyahı qeydiyyat sertifikatlarını imzalayan **qeydiyyat orqanı açarı** ilə imzalanır (x5c); LOTL-dakı bu açar həm
  sertifikatların, həm də ləğv siyahısının etibar lövbəridir (ARF RPACANot_03b).
- Ünvan: dərc kökündə `/status/wrprc/<n>`; sandbox `https://trust.sandbox.tamga.network/status/wrprc/1`. Cavab tipi
  `application/statuslist+jwt`.
- Təzəlik: `ttl` 1 saat, `exp` 24 saat; siyahı hər saatlıq heartbeat-də yenidən imzalanır, status dəyişəndə dərhal.
- **İndeks qaydası:** eyni yol və eyni məzmun eyni indeksi saxlayır; məzmun dəyişərsə və ya bitmə tarixi qısalarsa yeni təsadüfi
  indeks verilir və köhnə indeks ləğv edilir. Ləğv edilmiş indeks bir daha istifadə olunmur. Status qeydi dərc qovluğunda
  daimidir (`wrprc-status.json`; şəxsi məlumat yoxdur).

## K4 — Ləğv

- **Avtomatik** (hər dərcdə): qeydiyyat və ya istifadə bitdi, dayandırıldı, ləğv edildi və ya siyahıdan çıxdı →
  `registration_ended`; məzmun dəyişdi → `superseded`.
- **Əl ilə:** dərc edənin əmri `wrprc-revoke <sertifikat yolu> --reason <səbəb>`; səbəb məcburidir. Ləğv sorğusu yalnız
  qeydiyyat orqanından, tərəfin özündən (səlahiyyətli nümayəndəsi daxil) və ya səlahiyyətli dövlət orqanından qəbul edilir
  (REG-6.2.2.3-05).
- Hər ləğv dərc edənin açıq dəyişiklik qeydinə indeks, yol və səbəblə yazılır; sorğu edənin kimliyi operatorun daxili
  qeydlərində saxlanılır, açıq səbəbdə şəxs adı yazılmır.

## K5 — Cüzdan nüvəsi

- `wallet-core` sertifikatın `status` qeydinin siyahısını alır; siyahını imzalayan sertifikat LOTL-dakı qeydiyyat orqanı
  açarlarından biri olmalıdır. Yoxlanmış siyahı keşə yazılır; şəbəkə yoxdursa müddəti (`exp`) bitməmiş nüsxə istifadə olunur.
- **Ləğv → rədd.** Ləğv edilmiş qeydiyyat sertifikatı daşıyan sorğu etibarsızdır; cüzdan məlumat göndərmir (WRC4). Sənəd
  verənin sertifikatı ləğv edilibsə sənəd istənmir.
- **Yoxlana bilmədi → xəbərdarlıq.** Nəticə etibarlı qalır, lakin `registration_status_unknown` işarəsi daşıyır; razılıq ekranı
  xəbərdar edir (ARF RPRC_17).
- Xarab `status` və ya `policy_id` daşıyan sertifikat etibarsızdır. `policy_id` qəbul edilir, lakin konkret dəyər tələb olunmur.

## K6 — Yayılma

- Sandbox: bu gün açıqdır. Real şəbəkə: K1-dəki adlar təsdiqlənəndə reyestr parametri əlavə olunur. Dəyişiklik geriyə doğru
  təhlükəsizdir.

# Nəzərdən keçirilən seçimlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Qısa etibarlılıqla kifayətlənmək | rədd | TS 119 475 və ARF RPRC_01a ləğv tələb edir |
| Ayrı status siyahısı açarı | rədd (bu gün) | Yeni açar və bildiriş; fayda yoxdur |
| Hər dərcdə yeni indeks | rədd | Siyahı hər dərcdə böyüyür; eyni məzmunun ləğvi heç nəyi qorumur |
| 2 bitlik siyahı (dayandırma) | rədd | ETSI yalnız etibarlı/ləğv tanıyır |
| Status yoxlana bilməyəndə rədd | rədd (bu gün) | Oflayn və yaxın sahədə lüzumsuz rədd; ARF xəbərdarlıq istəyir |
| Yoxlayıcı sorğusunda `registrar_dataset` | rədd | Aİ İcra Reqlamenti 2026/1731 RO-02…RO-12-ni ləğv etdi |
| **Öz OID + siyasət sənədi + qeydiyyat orqanı açarı ilə 1 bitlik status siyahısı** | **seçildi** | Standartın üç sahəsi, əlavə açar yoxdur |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| WRS1 | Qeydiyyat sertifikatı Tamga-nın öz siyasət OID-ini və siyasət sənədinin ünvanını daşıyır; ETSI-nin Aİ siyasət OID-i (`0.4.0.19475.3.1`) Tamga sertifikatına yazılmır. |
| WRS2 | Qeydiyyat orqanı qeydiyyat sertifikatları üçün açıq, imzalı, 1 bitlik Token Status List dərc edir; siyahı LOTL-dakı qeydiyyat orqanı açarı ilə imzalanır və ən geci 24 saatda bir yenidən imzalanır. |
| WRS3 | Qeydiyyat və ya istifadə bitəndə, dayandırılanda, ləğv ediləndə və ya sertifikat məzmunu dəyişəndə köhnə qeydiyyat sertifikatı eyni dərcdə ləğv edilir; ləğv edilmiş indeks yenidən istifadə olunmur. |
| WRS4 | Cüzdan ləğv edilmiş qeydiyyat sertifikatı daşıyan sorğuya məlumat göndərmir və sertifikatı ləğv edilmiş sənəd verəndən sənəd istəmir; status yoxlana bilmirsə istifadəçini xəbərdar edir. |

# Nəticələr

- `apps/trust-publisher`: `src/wrprc-status.ts`, `build`, `heartbeat`, `wrprc-status`, `wrprc-revoke`; sandbox reyestr parametri.
- `@tamga-network/wallet-core`: `fetchRegistrationStatuses`, `registrationStatusRefs`, `MemoryRegistrationStatusCache`; yoxlama
  funksiyaları statusları isteğe bağlı son parametr kimi qəbul edir. Paketlərin 0.7.4 buraxılışında.
- Sənədlər: [[FW-POL-0003]] (yeni), [[FW-TF-0001]], [[SPEC-TRUST-0001]].

# Status

**Qəbul edildi — 2026-10-29** (layihə rəhbərliyinin təsdiqi; hərfi sitat xüsusi təsdiq qeydindədir). DECISIONS: D-REG-4.
WRS1–WRS4 məcburidir. Real şəbəkənin siyasət identifikatoru və ünvanları ayrıca təsdiqlənir (K1, K6).
