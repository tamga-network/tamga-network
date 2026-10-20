---
document_id: ADR-0012
title: "Yaxın məsafədə rəqəmsal sənədin göstərilməsi"
status: Active
version: 1.0.0
created: 2026-09-25
last_updated: 2026-10-02
summary: >
  Rəqəmsal cüzdanın QR göstərdiyi yaxın məsafə təqdimatı (turniket, tədbir, üzbəüz yoxlama) üçün Tamga profili: (B) qeydiyyatlı yoxlayan tərəfdə bir dəfə standart təqdimatla qeydiyyat, sonra fərdi məlumat daxil olmayan 60 saniyəlik imzalı keçid jetonu; (C) üzbəüz yoxlamada cüzdanın göstərdiyi qısa ömürlü sorğu keçidi ilə standart OpenID4VP-nin əks istiqamətdə başladılması. Hər ikisi ARF yaxın məsafə axınını (ISO/IEC 18013-5) əvəz etmir, ona qədər körpü rolunu oynayır və eyni "Göstər" ekranından Faza 1-də Bluetooth-a keçir. Birdəfəlik attestation-lar status biti + qapılar arası ortaq "istifadə olunub" siyahısı ilə; keçiddə PIN soruşulmaması məhdud və müddətli razılıqla (S-16).
domain: Wallet
translation_of: ADR-0012
source_version: "1.0.0"
---

# ADR-0012 — Yaxın məsafə təqdimatı (cüzdan QR göstərir) və birdəfəlik attestation-lar

**Status:** **Accepted — 2026-09-25** (K1–K5 və K7; K6 ayrıca ADR). DECISIONS §0 **D-PROX-1**.
Ekran axını
`…/2026-09-25-cuzdan-akis-tasarim-onerisi.md`. Presedent: Danimarka **AltID** (rəsmi tətbiq; canlı saat + foto + böyük QR).

# Kontekst

Bu gün yeganə təqdimat axını uzaqdan təqdimatdır: [[t:verifier]] QR göstərir, cüzdan skan edir ([[t:OpenID4VP]] cross-device; [[SPEC-PROTO-0002]]).
Hədəflənən istifadə halları — kampus turniketi, tədbirə giriş, muzey, kafe kassası, üzbəüz səlahiyyət yoxlaması — **cüzdanın QR
göstərməsini** tələb edir. [[t:ARF]] bu sahəni "proximity presentation" kimi təyin edir və **ISO/IEC 18013-5** ilə həll edir: cüzdanın
göstərdiyi QR yalnız *device engagement*-dir; ardından BLE/NFC üzərindən [[t:nonce|nonce-lu]] sorğu-cavab gedir və [[t:credential]] formatı **[[t:mdoc]]** olur.
Bizim rəqəmsal sənədlərimiz **[[t:SD-JWT-VC]]** formatındadır; 18013-5 üzərindən SD-JWT VC daşımaq standart deyil. Düzgün uzunmüddətli yol şəxsiyyət və
tələbə sənədlərinin **mdoc kimi də** verilməsi və 18013-5-in real build-də (BLE native modul) tətbiqidir (Faza 1, EAS).
Bu gün Expo Go-da BLE yoxdur; mdoc verilməsi, cüzdanın mdoc anbarı və terminalın BLE steki həftələr çəkir.

Prinsip: **nonce-u əmin olmaq istəyən tərəf yaradır.** Cüzdan QR göstərirsə, ya ikinci kanal açılır (18013-5), ya da zaman
pəncərəsi + təkrar siyahısı ilə kifayətlənilir. Tək QR-ın ölçüsü (≈2.9 KB) SD-JWT VC + x5c zəncirini daşıya bilmir; QR ya **istinad**, ya da
**kiçik imzalı jeton** daşıyır.

# Qərar

## K1 — İki körpü yolu; ISO 18013-5 hədəf, "Göstər" ekranı sabit
| Yol | İstifadə | Mexanizm | Standart statusu |
|---|---|---|---|
| **A — Uzaqdan təqdimat** (mövcud) | yoxlayan tərəf QR göstərir | OpenID4VP cross-device | ARF olduğu kimi |
| **B — Keçid kartı** | qeydiyyatlı terminal hər gün oxuyur (turniket, tədbir qapısı) | (1) **Qeydiyyat:** A yolu ilə qeydiyyatlı RP-yə təqdimat; RP `pass_grant` (RP imzalı: `pass_id`, nüsxə açarının barmaq izi `cnf_kid`, `terminal_group`, `valid_until`) qaytarır. (2) **Göstər:** cüzdan nüsxə açarı ilə **`tamga-pass+jwt`** imzalayır: `{iss: pass_id, aud: rp client_id, iat, exp = iat+60, jti}`; QR = kompakt JWS (≤ 400 bayt). Terminal oflayn yoxlayır: `pass_grant` daxilindəki açar, `aud`, `exp`, `jti` təkrar siyahısı. | Tamga profili (körpü) |
| **C — Üzbəüz yoxlama** | insan yoxlayır (məsul şəxs, kassa) | cüzdan QR-da qısa ömürlü **`openid4vp://…request_uri`** göstərir: bu, yoxlayan şəxs onu Tamga yoxlama tətbiqində skan etdikdə **standart OpenID4VP sorğusunu başladan** keçiddir (cüzdan qeydiyyatlı RP-nin `/vp/req` endpoint-indən özü üçün sorğu identifikatoru almışdır). Təqdimat standart yolla (A) gedir; istifadəçi sahələri Göstər ekranında əvvəlcədən təsdiqləyir. | OpenID4VP; başlatma əks istiqamətdə |
| **Faza 1 — ISO 18013-5** | bütün yaxın məsafə halları | QR = device engagement, BLE/NFC sessiya, mdoc | ARF |

- **Göstər ekranı** vahid dizayndır (kart + canlı saat + böyük QR + "nəyi paylaşırsınız" + Dəyişdir); B/C/Faza 1 yalnız QR-ın
  arxasındakı mexanizmi dəyişir. Geri qaytarılması çətin olan qərar yoxdur: B/C jeton formatları **versiyalıdır** (`typ` ilə), Faza 1-də
  istifadədən çıxarılır; rəqəmsal sənədin məlumat modeli (claim dəsti) formatdan asılı deyil, mdoc verilməsi **əlavədir**.
- Faza 1 ilkin şərti: şəxsiyyət və tələbə/diplom tiplərinin `mso_mdoc` ekvivalenti (kataloqda `docType` uyğunlaşdırması), EAS build-i, BLE.

## K2 — Keçid jetonunun məzmunu və sərhədləri (B)
- Jetonda **fərdi məlumat yoxdur**: `iss` (qeyri-şəffaf `pass_id`), `aud`, `iat`, `exp` (≤ 60 s), `jti`; başlıq `typ: "tamga-pass+jwt"`,
  `alg: ES256`, `kid: cnf_kid`. Terminal şəxsi tanımır, yalnız "etibarlı keçid hüququ" görür; şəxsiyyət `pass_grant` vasitəsilə RP-nin
  qeydiyyat sistemində uyğunlaşdırılır (kampus onsuz da tələbəni tanıyır).
- `pass_grant` cüzdanda saxlanılır (`WalletState.passes[]`), rəqəmsal sənədin nüsxəsinə və onun açarına bağlıdır (WL5 qorunur: bir RP = bir nüsxə).
  Rəqəmsal sənəd [[t:revocation]] olduqda/müddəti bitdikdə grant qüvvədən düşür; RP grant-ı müddətindən əvvəl ləğv edə bilər (RP status siyahısı, Faza 1).
- Ekran: canlı saat + 60 s geri sayım; ekran görüntüsü müddət bitdikdən sonra yararsız olur.

## K3 — Təkrar oxutma
- Terminallar `jti` dəyərini `exp` anına qədər saxlayır; eyni terminal qrupundakı qapılar siyahını **onlayn paylaşır**. Oflayn qapı yalnız
  müddəti yoxlayır və bu riski **qəbul edir** (60 s ərzində kopyalanan QR başqa qapıdan keçə bilər); risk ADR-də açıq şəkildə qeyd olunub.

## K4 — Birdəfəlik attestation-lar (bilet)
- Təşkilatçı həm [[t:issuer]], həm də yoxlayan tərəfdir: əlaqələndirilməzlik mənasızdır, qəbul edilir. Mexanizm: **1 nüsxə/oturacaq**, `exp` = tədbirin bitməsi,
  qapı keçid zamanı **status bitini** "istifadə olunub" vəziyyətinə keçirir; S6 (sabit intervallı dərc) qorunur → qapılar arası **ortaq "istifadə olunub" siyahısı məcburidir**
  (interval daxilində ikinci keçidi bu siyahı dayandırır).

## K5 — RP qeydiyyatına terminal sinfi
- `relying_parties[]` ([[t:relying-party]]) qeydiyyatına `terminal_groups[]` (qrup identifikatoru, sertifikatın barmaq izi, oflayn işləməyə icazə varmı) əlavə olunur; terminal
  yalnız qeydiyyatlı RP-nin altında təyin edilir ([[SPEC-TRUST-0001]] kiçik versiya). Cüzdan Göstər ekranında yalnız qeydiyyatlı RP/terminal
  qrupu üçün keçid kartı yaradır.

## K6 — Korporativ təmsil səlahiyyəti (təxirə salınıb)
- "Şəxs X, qurum Y adından səlahiyyətlidir" attestation-ı (`urn:tamga:org:MandateAttestation:1` namizədi) **ayrıca ADR**.

## K7 — Yazılı prinsip
- FW-TF-0001-ə prinsip: "Yoxlama çağırışını (nonce) əmin olmaq istəyən tərəf yaradır; yaxın məsafədə cüzdan göstərir və ikinci
  kanal açılır; tək QR yalnız qısa ömürlü istinad və ya fərdi məlumatsız imzalı jeton daşıyır."

## K8 — Razılıq və WL11 istisnası (kənarlaşma S-16)
- Keçid kartında hər göstərişdə PIN/biometrik təsdiq **soruşulmur**: qeydiyyat anında (A yolu) verilən razılıq **müddətli** (`valid_until`, maksimum bir
  dövr ≈ 6 ay) və **əhatəsi məhdud** (yalnız həmin RP/terminal qrupu) hesab olunur; hər göstəriş tarixçəyə yazılır; istifadəçi Göstər ekranından
  razılığı geri götürə bilər (grant silinir). Bu, WL11-in ölçülü istisnasıdır; [[SPEC-WALLET-0001]] WL12–WL14 ilə məhdudlaşdırılır.

# Əsaslandırma
İstənilən təcrübə ("qaldır, göstər, keç") bu gün ARF-nin hədəf yolu ilə (mdoc + BLE + real build) həftələr uzaqdadır; körpü
yollar standartı **təqlid etmir**, əvəzində ya standart OpenID4VP-ni əks istiqamətdə başladır (C), ya da standartdan kənar olduğu açıq
yazılmış, versiyalı, fərdi məlumatsız jetondan istifadə edir (B). Ekran və məlumat modeli sabit qaldığı üçün Faza 1-ə keçid yalnız nəqliyyat
qatını dəyişir. AltID presedenti bu yanaşmanın bir dövlət tətbiqində canlı istifadədə olduğunu göstərir.

# Nəzərdən keçirilən alternativlər
- **ISO 18013-5-i dərhal tətbiq etmək:** SD-JWT VC ilə standart deyil; mdoc verilməsi + BLE + EAS tələb olunur; Expo Go-da mümkün deyil. **Faza 1-ə.**
- **Rəqəmsal sənədin tamamını QR-a yerləşdirmək:** ölçü və məxfilik (rəqəmsal sənəd terminala ötürülür). Rədd edildi.
- **Terminal QR göstərir, tələbə skan edir (D):** istifadəçi təcrübəsi zəifdir, turniket ekranı tələb olunur. Ehtiyat variant kimi qalır.
- **Ümumi "hamı oxusun" QR-ı (qeydiyyatsız yoxlayan):** fərdi məlumatlar qeydiyyatsız tərəfə ötürülür, Tamga-nın "RP qeydiyyatlı olmalıdır" prinsipinə
  ziddir. Rədd edildi.

# Nəticələr
- Kod: `@tamga-network/wallet-core` `pass.ts` (grant saxlanması, jeton yaradılması), `apps/wallet` Göstər ekranında real QR, `@tamga-network/verifier`
  `pass.ts` (grant verilməsi + jeton yoxlanması + jti siyahısı), `apps/verify` `/terminal` səhifəsi və `/terminal/verify`, kampus
  siyasəti (`campus-access`), səhnə 12 (`demo-scenes`). C yolu (əks başlatma + yoxlayan tərəfin "Yoxla" ekranı) ikinci addımdır.
- Sənədlər: [[SPEC-WALLET-0001]] WL12–WL14; [[SPEC-API-0001]] AP13; [[SPEC-TRUST-0001]] `terminal_groups` (kiçik versiya);
  FW-TF-0001 §3.7 + prinsip; FW-ARF-0001 cədvəl sətri; 09-DEMO-KURGU S-16 + səhnə 12; 08-BACKLOG D9.

# Açıq məsələlər
1. Razılıq müddətinin yuxarı həddi (təklif: 6 ay) və gündəlik göstəriş limiti — pilot məlumatları əsasında.
2. Faza 1 mdoc `docType` uyğunlaşdırması və vermə profili — ayrıca SPEC yeniləməsi.
3. C yolunda yoxlayan şəxsin gördüyü nəticə ekranının məzmunu (foto yalnız cihazdamı, yoxlayan şəxsə də göstərilirmi) — SPEC-ID-0003 portret claim-i ilə birlikdə.
