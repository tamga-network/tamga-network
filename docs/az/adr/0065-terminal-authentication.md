---
document_id: ADR-0065
title: "Giriş terminalları yoxlama xidmətinə özünü təqdim edir: terminal açarı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-26
last_updated: 2026-10-29
translation_of: ADR-0065
source_version: "1.0.0"
summary: >
  Keçid yolunda (ADR-0012 B) girişlər tokeni Tamga Verify-ın `/terminal/verify` ucuna göndərir; indiyədək bu uc heç bir kimlik
  tələb etmirdi. Cüzdanın 60 saniyəlik QR-ını görən hər kəs tokeni birinci göndərə, birdəfəlik bileti istifadə olunmuş edə və
  şəxsin əsl girişdə dayandırılmasına səbəb ola bilərdi. Qərar: giriş həmin terminal qrupu üçün operatorun verdiyi terminal açarı
  ilə özünü təqdim edir (`Authorization: Bearer`); açarsız sorğu tokenə heç vaxt toxunmur. Operator açarları yoxlayıcının
  inzibatçı uclarından verir və ləğv edir; serverdə yalnız heş saxlanılır. Sertifikatlı terminal qeydiyyatı (ADR-0012 K5
  `terminal_groups[]`) oflayn girişlər üçün hədəf olaraq qalır. Qəbul: 2026-10-26 (təhlükəsizlik baxışı, layihə rəhbərliyinin
  ümumi təsdiqi).
domain: Protocol
related: ["[[ADR-0012]]", "[[ADR-0017]]", "[[SPEC-API-0001]]", "[[FW-RB-0006]]"]
---

# Qısaca

Turniket və ya tədbir girişi cüzdanın keçid tokenini yoxlama xidmətinə göndərəndə artıq özünü təqdim edir: hər terminal
qrupunun operatorun verdiyi terminal açarı var və sorğu bu açarı daşıyır. Açarsız sorğu tokeni oxumur, istifadə etmir və
saymır. Biletin QR-ını uzaqdan fotoşəkilə çəkən biri onu artıq "istifadə olunub" kimi işarələyə bilməz.

# Kontekst

- [[ADR-0012]] B: qeydiyyatdan keçmiş giriş üçün cüzdan nüsxə açarı ilə imzalanmış, şəxsi məlumatsız, 60 saniyə etibarlı
  `tamga-pass+jwt` tokeni göstərir; terminal onu yoxlayır və `jti` təkrar siyahısı terminal qrupunun girişləri arasında onlayn
  paylaşılır. Praktikada bütün girişlər Tamga Verify-ın `POST /terminal/verify` ucunu çağırır; təkrar siyahısı və birdəfəlik
  bilet vəziyyəti (ADR-0012 K4, [[FW-RB-0006]] §4.3) oradadır.
- Uc heç bir kimlik tələb etmirdi (yalnız sürət həddi). Token şəxsi məlumat daşımadığı üçün məxfilik riski yox idi, lakin
  **xidmətdən imtina riski** var idi: QR-ı görən (növbəti şəxs, kamera, ekran görüntüsü) tokeni 60 saniyə ərzində göndərsə, onun
  `jti`-si siyahıya düşür və ya birdəfəlik bilet istifadə olunur; şəxs isə əsl girişdə DAYAN görür. Müstəqil təhlükəsizlik
  baxışının tapıntısı (2026-10-26).
- ADR-0012 K5 terminalların yoxlayıcının qeydində `terminal_groups[]` kimi (qrup, sertifikat barmaq izi, oflayn icazə) müəyyən
  edilməsini nəzərdə tutur. Bu sahə hələ siyahı sxemində deyil və bu gün heç bir terminal oflayn yoxlamır. Bugünkü girişlər
  operatorun nəzarətindəki onlayn cihazlardır (turniket kompüteri, giriş planşeti, sandbox-ın brauzer səhifəsi).
- Layihə rəhbərliyinin istiqaməti: təhlükəsizlik baxışının tapıntılarını ən az pozan düzgün həllə bağlamaq.

# Qərar

## K1 — Giriş özünü terminal açarı ilə təqdim edir
`POST /terminal/verify` yalnız `Authorization: Bearer <terminal açarı>` ilə çağırılır. Açar bir **terminal qrupuna**
(siyasətlərin `terminal_group`-u) bağlıdır; token açarın qrupuna görə yoxlanılır. Gövdədəki `terminal_group` istəyə bağlıdır;
varsa, açarın qrupu ilə eyni olmalıdır (giriş başqa qrupun girişi kimi davrana bilməz → 403). Açarsız və ya etibarsız açarlı
sorğu 401 alır (`WWW-Authenticate: Bearer`); token oxunmur, təkrar siyahısına və giriş sayğaclarına toxunulmur, audit jurnalına
yalnız "icazəsiz terminal sorğusu" hadisəsi yazılır (ünvan və token yazılmır).

## K2 — Operator açarları verir və ləğv edir
Açarlar yoxlayıcının inzibatçı ucları ilə idarə olunur (inzibatçı tokeni; nginx-də xaricə bağlı, yalnız daxili ünvan — Qurum
Konsolunun giriş sayğacları üçün artıq istifadə etdiyi yol): `POST /terminal/keys {terminal_group, label}` yeni açarı **bir
dəfə** qaytarır, `GET /terminal/keys` heşsiz qeydləri siyahılayır, `DELETE /terminal/keys/{id}` ləğv edir. Qrup yüklənmiş
siyasətin terminal qrupu olmalıdır. Bu ucları əhatə edən Konsol ekranı növbəti addımdır (iş siyahısı).

## K3 — Serverdə yalnız heş
Yoxlayıcı açarın yalnız SHA-256 heşini saxlayır (`terminal-keys.json`; şəxsi məlumat yoxdur) və sabit zamanda müqayisə edir.
Açar `tk_` prefiksli, 192 təsadüfi bitdir.

## K4 — Yerli inkişaf və sandbox
Mühitdən yüklənən açarlar (`TAMGA_VERIFY_TERMINAL_KEYS="qrup:açar,…"`) yalnız yerli inkişaf və sandbox üçündür; diskə yazılmır
və ləğv edilə bilmir. Sandbox-ın sınaq girişinin açarları açıqdır (sandbox bələdçisi §6): sandbox-da real məlumat və bilet
yoxdur; məqsəd axını sınamaqdır. Real şəbəkə mühit açarlarından istifadə etmir; bu gün orada giriş siyasəti də yoxdur
(`/terminal*` 404 qaytarır).

## K5 — Hədəf dəyişmir
Sertifikatlı terminal qeydiyyatı (ADR-0012 K5 `terminal_groups[]`, oflayn girişlər) hədəf olaraq qalır; terminal açarı onlayn
girişlər üçün bugünkü kimlik yoludur. `terminal_groups[]` siyahı sxeminə daxil olanda açarın yerini sertifikat ala bilər və bu
ADR yenilənir.

# Nəzərdən keçirilən variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Ucu açıq saxlamaq, sürət həddi kifayətdir | rədd | Bir sorğu kifayətdir: 60 saniyəlik QR-ı görən bileti istifadə edir; sürət həddi bunu dayandırmır |
| mTLS / terminal sertifikatı (ADR-0012 K5) | hədəf, bu gün yox | Siyahı sxemi, sertifikat paylanması və giriş proqramı lazımdır; sandbox-ın brauzer girişi mTLS edə bilmir |
| Girişdən RP təsdiqi (`tamga-rp+jwt`, ADR-0017) | rədd | Giriş sertifikatının şəxsi açarı hər giriş cihazına paylanardı; terminal qrupu ayrımı yoxdur |
| **Terminal qrupu üzrə operatorun verdiyi bearer açar** | **seçildi** | Ən az pozan düzgün həll: bir başlıq, daxili inzibatçı ucu, nginx sürət həddi dəyişmir; sandbox səhifəsi açar sahəsi ilə işləyir |
| Token `aud`-una giriş kimliyini yazmaq | rədd | Tokeni cüzdan imzalayır; girişi tanımır və QR-ı görən onu yenə göndərə bilər |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| TK1 | `POST /terminal/verify` yalnız terminal qrupuna bağlı terminal açarı ilə işləyir (`Authorization: Bearer`); açarsız və ya etibarsız açarlı sorğu 401 alır, token oxunmur, təkrar siyahısına və sayğaclara toxunulmur. Açarın qrupundan fərqli gövdə `terminal_group`-u 403 alır. |
| TK2 | Operator terminal açarlarını yoxlayıcının inzibatçı uclarından verir və ləğv edir; açar yalnız verildiyi cavabda görünür; qrup yüklənmiş siyasətin terminal qrupu olmalıdır. |
| TK3 | Yoxlayıcı açarın yalnız heşini saxlayır (şəxsi məlumat yoxdur) və sabit zamanda müqayisə edir; mühitdən yüklənən açarlar yalnız yerli inkişaf və sandbox üçündür. |

# Nəticələr

- Kod: `apps/verify` (`terminal-keys.ts`, `/terminal/verify` 401/403, `/terminal/keys` inzibatçı ucları, giriş səhifəsində açar
  sahəsi — yalnız brauzer tabında saxlanılır); şəbəkə serverində nginx `/terminal/keys`-i xaricə bağlayır; sandbox mühitində
  sınaq açarları; səhnə məşqi (`ops/demo-scenes`) açarla çağırır.
- Sənədlər: [[SPEC-API-0001]] §6.4 (kimlik cədvəli) və AP13 qeydi; yoxlayıcı API səhifəsi; sandbox bələdçisi §6; [[FW-RB-0006]]
  §4.3.
- İş siyahısı: Qurum Konsolunda terminal açarı ekranı (K2); siyahı sxemində `terminal_groups[]` (K5).

# Status

**Accepted — 2026-10-26.** Layihə rəhbərliyinin təsdiqi ilə (təhlükəsizlik baxışı düzəlişləri, ümumi təsdiq). DECISIONS: D-PROX-2.

**Qeyd (2026-10-29):** K2 (Qurum Konsolu ekranı) və K5 (siyahı sxemində `terminal_groups[]`) [[ADR-0069]] ilə tamamlandı;
açarlar qurum adından verilir (TG1–TG3).
