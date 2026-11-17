---
document_id: ADR-0087
title: "Giriş sertifikatı ləğv siyahısı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Yoxlayıcı giriş sertifikatları (WRPAC, X.509) üçün RFC 5280 ləğv siyahısı (CRL) dərc edilir. Yoxlayıcının qeydiyyatı
  dayandırılanda və ya ləğv ediləndə giriş sertifikatı eyni dərcdə qəti olaraq ləğv edilir (ETSI TS 119 411-8 REV-6.3.9-04;
  dayandırma üçün də `certificateHold` istifadə edilmir), qeydiyyat bitəndə və sertifikat yenisi ilə əvəzlənəndə də ləğv edilir.
  CRL-i sertifikatı verən orqan imzalayır; kök oflayn qaldığı üçün giriş sertifikatları kök tərəfindən imzalanmış, açarı siyahı
  dərc edənində saxlanan giriş sertifikatı orqanı tərəfindən verilir və onun CRL-i hər dərcdə və saatda bir yenidən imzalanır
  (nextUpdate 24 saat). Ünvan yeni alt domen açmadan etibar siyahısının domeni altındadır: `/crl/<orqan>.crl`. Qeydiyyat
  sertifikatları (WRPRC) CRL-ə daxil olmur; onların ləğvi ADR-0068-in status siyahısında qalır. Tamga cüzdan nüvəsi və yoxlayıcı
  imzalı siyahını əsas götürür, CRL-i ayrıca yükləmir; CRL Aİ cüzdanları və PKIX yoxlayıcıları üçündür. Qəbul: 2026-11-15.
domain: Trust
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0034]]", "[[ADR-0056]]", "[[ADR-0058]]", "[[ADR-0068]]", "[[ADR-0075]]", "[[SPEC-ID-0002]]", "[[SPEC-TRUST-0001]]", "[[FW-POL-0003]]", "[[FW-TF-0001]]"]
translation_of: ADR-0087
source_version: "1.0.0"
---

# Qısaca

Yoxlayıcı şəbəkədə iki sertifikat daşıyır: kim olduğunu göstərən giriş sertifikatı (X.509) və nəyi istəyə biləcəyini göstərən
qeydiyyat sertifikatı. Qeydiyyat sertifikatının ləğv siyahısı var idi ([[ADR-0068]]); giriş sertifikatının yox idi. Yoxlayıcı
dayandırılanda Tamga cüzdanı onu imzalı siyahıdan tanıyıb rədd edirdi, lakin sertifikatı yalnız X.509 yolu ilə yoxlayan Aİ cüzdanı
sertifikatı hələ də etibarlı görürdü. Bu qərarla giriş sertifikatları üçün standart ləğv siyahısı (CRL) dərc edilir və dayandırma,
ləğv və ya bitmə anında sertifikat həmin siyahıya daxil olur.

# Kontekst

- **Aİ qaydası.** ETSI TS 119 411-8 V1.1.1 §6.3.9: giriş sertifikatı provayderi yoxlayıcının qeydiyyatını izləyir və qeydiyyat
  **dayandırılanda və ya ləğv ediləndə giriş sertifikatını ləğv edir** (REV-6.3.9-02/03/04). Ləğv statusu məlumatı və CRL
  profili EN 319 411-1-ə bağlanır (REV-6.3.9-01, CSS-6.6.2-01). EN 319 411-1-in mətni kitabxanada deyil; aşağıdakı müddətlər
  məlum yuxarı həddlərdən aşağı seçildi.
- **RFC 5280.** CRL v2 (§5), `nextUpdate` bu profildə məcburidir (§5.1.2.5), Authority Key Identifier (§5.2.1) və CRL Number
  (§5.2.3) genişlənmələri, hər qeyd üçün reasonCode (§5.3.1). CRL-i sertifikatı verən orqan imzalayır; başqa imzalayan yalnız
  dolayı CRL (indirect CRL, `cRLIssuer` + `indirectCRL`) ilə mümkündür və yoxlayıcılarda dəstəyi zəifdir. Sertifikat CRL-in yerini
  CRL Distribution Points genişlənməsi ilə (§4.2.1.13) göstərir.
- **Aİ uyğunluq turu (2026-11-15, təklif 4; KA-411-8-1).** Aİ istinad cüzdan kitabxanası giriş sertifikatında PKIX ləğv
  yoxlaması aparır; bizim sertifikatımız ləğv yolu göstərmədiyi üçün ya ümumiyyətlə yoxlana bilmir, ya da (ciddi rejimdə) rədd
  edilə bilər.
- **Bu gün.** Giriş sertifikatlarını oflayn kök birbaşa verir ([[ADR-0058]]); kökün açarı yalnız operatorun gizli qovluğundadır,
  serverdə yoxdur. Yoxlayıcının statusu (`ACTIVE`/`SUSPENDED`/`REVOKED`/`RETIRED`) imzalı siyahıdadır; Tamga cüzdan nüvəsi
  sorğunu imzalayan yarpağı siyahıdakı barmaq izi ilə uyğunlaşdırır və aktiv olmayan qeydi rədd edir. Qeydiyyat sertifikatı
  dayandırmada və ləğvdə [[ADR-0068]] K4 ilə status siyahısında ləğv edilir.
- **Layihə rəhbərliyinin istiqaməti.** Ləğv yolu kimi CRL seçildi (OCSP deyil); dərc ünvanı yeni alt domen açılmadan mövcud etibar
  siyahısı domeni altında bir yol olacaq; adın təsdiqi ayrıca.

# Qərar

## K1 — Əhatə: hansı sertifikat hansı yolla ləğv edilir

| Sertifikat | Format | Ləğv yolu |
|---|---|---|
| Giriş sertifikatı (WRPAC) | X.509 | **CRL** (bu qərar) |
| Qeydiyyat sertifikatı (WRPRC) | JWT / CWT (ETSI TS 119 475) | Token Status List ([[ADR-0068]]) — dəyişmədi |
| Sənəd verən sertifikatı | X.509 | imzalı siyahıdakı qurum statusu (C1/C2); bu qərarın əhatəsindən kənardır |

Hər sertifikat növünün yalnız bir ləğv yolu var. CRL yalnız X.509 seriya nömrəsi daşıyır; qeydiyyat sertifikatı CRL-ə daxil olmur.
Yoxlayıcı dayandırılanda eyni dərcdə iki şey baş verir: qeydiyyat sertifikatları status siyahısında, giriş sertifikatı CRL-də
ləğv edilir. Tətik birdir (reyestrdəki status dəyişikliyi), nəticələr ayrıdır.

## K2 — Giriş sertifikatı orqanı

- CRL-i sertifikatı verən orqan imzalayır (birbaşa CRL). Kök oflayn qaldığı üçün giriş sertifikatları **giriş sertifikatı
  orqanından** (`access-ca-1`) verilir: kök tərəfindən imzalanmış aralıq orqan; basicConstraints CA, yol uzunluğu 0 (kritik);
  keyUsage keyCertSign + cRLSign (kritik); SKI; AKI = kökün SKI-si; öz CRL paylama nöqtəsi kökün CRL-idir. Yalnız giriş
  sertifikatı verir.
- Orqanın açarı siyahı dərc edənində, qeydiyyat orqanı açarı ilə eyni qorumada saxlanılır. Kök açarı dərc edənə getmir.
- Kökün öz CRL-i (aralıq orqanları və keçid dövründə kökün birbaşa verdiyi giriş sertifikatlarını əhatə edir) kökün saxlandığı
  kompüterdə imzalanır (`ops/gen-pki.ts --root-crl`); `nextUpdate` ən çox 365 gün; aralıq orqan və ya kökün verdiyi giriş
  sertifikatı ləğv ediləndə dərhal yenidən imzalanır. Dərc edən bu nüsxəni yoxlayır (orqan imzası, verənin adı, müddət, tələb
  olunan seriya nömrələri) və dərc edir; nüsxə yoxdursa və ya müddəti bitibsə xəbərdarlıq verir.
- Keçid: bugünkü, kökün birbaşa verdiyi giriş sertifikatları müddətləri bitənədək və ya yenilənənədək kökün CRL-i ilə əhatə
  olunur; yenilənəndə giriş sertifikatı orqanından verilir (eyni açarla yeniləmə [[ADR-0058]]-də olduğu kimi; `client_id` dəyişir,
  daimi identifikator `dns_name` dəyişmir — [[ADR-0034]], [[ADR-0075]]). Sorğu obyektinin `x5c`-si yarpaqdan sonra aralıq orqanı
  daşıyır (kök istisna olmaqla).

## K3 — Ünvan və paylama nöqtəsi

> Ünvan qaydasını [[ADR-0090]] əvəz etdi (2026-11-18): CRL ayrı domendədir (`crl.tamga.network`), `http` + `https`, paylama
> nöqtəsində iki ad. Aşağıdakı format, profil və uzantı qaydaları qüvvədədir.

- Ünvan dərc kökündə, yeni alt domen olmadan: `<etibar siyahısı domeni>/crl/<orqan>.crl`. Real şəbəkə
  `https://trust.tamga.network/crl/access-ca-1.crl` və `…/crl/root-ca.crl`; sandbox `https://trust.sandbox.tamga.network/crl/…`.
- Format DER, cavab tipi `application/pkix-crl` (RFC 2585), hamıya açıq, CORS açıq.
- Hər giriş sertifikatı və giriş sertifikatı orqanının sertifikatı verənin CRL-ini göstərən tək paylama nöqtəli, kritik olmayan
  CRL Distribution Points genişlənməsi (2.5.29.31) daşıyır (`cRLIssuer` və `reasons` yoxdur).
- Parametr reyestrdə `national_lists[].roles.access_ca.crl` (`issuers[{ca, uri}]`); dərc edənin daxili parametridir, LOTL-a
  yazılmır. Parametr yoxdursa CRL yaradılmır.

## K4 — CRL profili və təzəlik

- v2, ES256 (ecdsa-with-SHA256), verən = orqanın subyekt adı (bayt-bayt eyni), AKI = orqanın SKI-si, CRLNumber (hər orqan üçün
  monoton artır), hər qeyd üçün reasonCode.
- Açarı dərc edəndə saxlanan orqanın CRL-i **hər dərcdə və hər saatlıq heartbeat-də** yenidən imzalanır; `nextUpdate` =
  `thisUpdate` + 24 saat. Beləliklə dərc edən bir gün dayansa belə CRL müddəti keçmiş görünür (yoxlayıcı köhnə məlumatla etibarlı
  saymır).
- Status dərc qovluğunda daimidir (`access-crl-state.json`: hər orqan üçün CRL nömrəsi, görülən sertifikatlar, ləğvlər; şəxsi
  məlumat yoxdur). Fayl itərsə status dərc edilmiş CRL-dən bərpa edilir (ləğvlər CRL-in özündə imzalıdır).

## K5 — Ləğv tətikləri

| Hadisə | reasonCode |
|---|---|
| Yoxlayıcının qeydiyyatı dayandırıldı (`SUSPENDED`) və ya ləğv edildi (`REVOKED`) | `privilegeWithdrawn` (9) |
| Qeydiyyat bitdi (`RETIRED`) | `cessationOfOperation` (5) |
| Giriş sertifikatı qeydiyyatdan çıxdı (yenisi ilə əvəzləndi) və müddəti bitməyib | `superseded` (4) |
| Əl ilə ləğv (`crl-revoke`; məs. açar ələ keçirilib) | `keyCompromise` (1), `affiliationChanged` (3), `superseded`, `cessationOfOperation`, `privilegeWithdrawn` |

- Ləğv avtomatikdir və eyni dərcdədir (REV-6.3.9-04). Ləğv edilmiş sertifikat siyahıdan çıxmır.
- Əl ilə ləğv sorğusu [[ADR-0068]] K4-dəki yolla yoxlanılır (qeydiyyat orqanı, yoxlayıcının özü və ya səlahiyyətli dövlət orqanı,
  REV-6.2.4-02/03); açıq dəyişiklik qeydinə seriya nömrəsi, domen adı və səbəb kodu yazılır, şəxs adı yazılmır.

## K6 — Dayandırma üçün qəti ləğv (`certificateHold` yoxdur)

- Dayandırılan qeydiyyatın giriş sertifikatı **qəti olaraq ləğv edilir**; RFC 5280-in geri alına bilən `certificateHold` səbəbi
  istifadə edilmir. Qeydiyyat yenidən aktiv olanda yoxlayıcıya yeni giriş sertifikatı verilir (eyni açar ola bilər, yeni seriya
  nömrəsi).
- Aktiv (`ACTIVE`) qeydiyyat ləğv edilmiş giriş sertifikatını göstərə bilməz: dərc edən bu halda siyahı imzalanmadan dərci
  dayandırır.

## K7 — Kim yoxlayır

- **Tamga cüzdan nüvəsi və yoxlayıcı CRL-i yükləmir.** Giriş sertifikatına etibarı imzalı siyahıdakı qeyddən (barmaq izi +
  status) alırlar; CRL eyni reyestr statusundan yaradılır, yeni məlumat daşımır. İkinci yoxlama şəbəkə sorğusu, gecikmə və
  "hansı yoxlayıcı ilə danışılır" sızıntısı əlavə edir, təhlükəsizlik qazancı yoxdur.
- CRL **Aİ cüzdanları və PKIX yoxlayıcıları** üçündür: giriş sertifikatını yalnız X.509 zənciri ilə yoxlayan cüzdan dayandırılmış
  yoxlayıcını CRL-dən görür.
- Yoxlama xəttində sənəd verən sertifikatı üçün CRL/OCSP addımı (A3c) bugünkü kimi buraxılır (sənəd verənin statusu siyahıdadır).

## K8 — Yayılma

- Sandbox: giriş sertifikatı orqanı, parametr, CRL və nginx cavab tipi bu gündən (orqanın açarı sandbox serverinə yüklənəndə CRL
  orada imzalanır); yeni giriş sertifikatları orqandan verilir.
- Real şəbəkə: orqan sertifikatı kökün mərasimində verilir, açarı dərc edənə qoyulur, kökün CRL-i imzalanır, şəbəkənin öz
  yoxlayıcısının giriş sertifikatı orqandan yenilənir və parametr əlavə olunur — yol adları təsdiqləndikdən sonra. Parametr əlavə
  olunmadan real şəbəkənin dərci dəyişmir.

# Nəzərdən keçirilən seçimlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| OCSP | rədd | Daim onlayn cavablandırıcı və imza açarı tələb edir; hər yoxlamada hansı sertifikatın soruşulduğunu serverə bildirir (məxfilik); Aİ cüzdanları CRL-i də oxuyur |
| Bugünkü yol (yalnız siyahıdan çıxarma) + əsaslandırma | rədd | REV-6.3.9-04 sertifikatın ləğvini tələb edir; X.509 yolunu izləyən cüzdan dayandırmanı görə bilmir |
| Kökün birbaşa imzaladığı CRL, yalnız mərasimlə | rədd | Dayandırma anında ləğv üçün hər dəfə oflayn mərasim lazımdır; "eyni dərcdə" qaydası təmin edilə bilməz |
| Dolayı CRL və ya ayrıca CRL imzalayanı (eyni ad, başqa açar) | rədd | RFC 5280-də var, lakin yoxlayıcılarda dəstəyi zəif və uyğunsuzdur; birgə işləmə riski |
| Dayandırmada `certificateHold` | rədd | Geri alına bilən ləğv; bir çox yoxlayıcı onu ya ümumiyyətlə emal etmir, ya da qəti ləğv sayır; ETSI və [[ADR-0068]] dayandırmada ləğv deyir |
| Tamga cüzdanında da CRL yoxlaması | rədd | Eyni məlumat imzalı siyahıdadır; ikiqat yoxlama şəbəkə sorğusu və sızıntı əlavə edir |
| **Onlayn giriş sertifikatı orqanı + birbaşa CRL, 24 saat + kökün illik CRL-i** | **seçildi** | Standart PKI quruluşu (oflayn kök, onlayn verən orqan); dayandırma eyni dərcdə; əlavə protokol yoxdur |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| AR1 | Yoxlayıcının qeydiyyatı dayandırılanda, ləğv ediləndə və ya bitəndə giriş sertifikatı eyni dərcdə CRL-ə daxil olur; dayandırma üçün də qəti ləğv istifadə edilir (`certificateHold` yoxdur) və ləğv edilmiş sertifikat siyahıdan çıxmır. |
| AR2 | Bu qərardan sonra verilən giriş sertifikatı verənin CRL-ini göstərən CRL Distribution Points genişlənməsini daşıyır; onlayn orqanın CRL-i ən geci 24 saatda bir yenidən imzalanır (nextUpdate ≤ 24 saat). |
| AR3 | Aktiv yoxlayıcı qeydiyyatı ləğv edilmiş giriş sertifikatını göstərə bilməz; dərc edən bu halda siyahı imzalanmadan dərci dayandırır. |
| AR4 | Qeydiyyat sertifikatı CRL-ə daxil olmur; hər sertifikat növünün yalnız bir ləğv yolu var (giriş sertifikatı CRL, qeydiyyat sertifikatı [[ADR-0068]] status siyahısı). |
| AR5 | Tamga cüzdan nüvəsi və yoxlayıcı giriş sertifikatına etibarı imzalı siyahıdan alır; CRL onlar üçün əlavə və ya alternativ etibar mənbəyi deyil. |

# Nəticələr

- `apps/trust-publisher`: `src/access-crl.ts` (ləğv planı, CRL imzası və yoxlanması, statusun bərpası), `build` və `heartbeat`
  bağlantısı, `crl-status`, `crl-revoke`; `roles.access_ca.crl` TL11 icazə siyahısındadır və LOTL-a yazılmır.
- `ops/gen-pki.ts`: `access-ca-1` (inkişaf və sandbox), giriş sertifikatlarında CRL paylama nöqtəsi, `--root-crl`.
  `ops/pki-issue.ts`: `--ca`, `--crl-uri` (real şəbəkədə giriş sertifikatında məcburi), aralıq orqanın sertifikatı `<ad>.chain.pem`.
- Operator: nginx `trust.*` bloklarında `/crl/` (`application/pkix-crl`).
- Sənədlər: [[SPEC-TRUST-0001]] §2 və versiya qeydi.
- Real şəbəkədə görüləcək işlər K8-dədir; yol adları (`/crl/`, `access-ca-1.crl`, `root-ca.crl`) və orqanın subyekt adı təsdiq
  gözləyir.

# Status

**Qəbul edildi — 2026-11-15** (layihə rəhbərliyinin təsdiqi; hərfi sitat xüsusi təsdiq qeydindədir). DECISIONS: D-REG-5.
AR1–AR5 məcburidir. Sandbox-da qüvvədədir; real şəbəkədə yol adları təsdiqlənəndə (K8).
