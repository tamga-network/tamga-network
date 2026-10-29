---
title: ETSI XML etibar siyahısı
---

# ETSI XML etibar siyahısı

Avropada etibar siyahıları illərdir bir XML formatında dərc olunur: **ETSI TS 119 612**. AB-nin imza yoxlama alətləri bu formatı
oxuyur. Tamga-nın ölkə siyahısı imzalı Tamga siyahısının ([[SPEC-TRUST-0001]]) yanında bu formatda da dərc olunur: eyni qeydlər,
eyni ardıcıllıq nömrəsi, XAdES imzası. Səlahiyyətli mənbə həmişə Tamga JSON siyahısıdır; XML onun ikinci görünüşüdür ([[ADR-0066]]).

Bu səhifə həm də XML siyahısındakı Tamga URI-lərinin **tərif səhifəsidir**: `https://trust.tamga.network/tl/…` altındakı hər ünvan
bura gəlir.

## Harada

| Mühit | Siyahı | Həzm | İmzalayan sertifikatı |
|---|---|---|---|
| Sandbox (sınaq şəbəkəsi) | `https://trust.sandbox.tamga.network/tl-tr.xml` | `…/tl-tr.sha2` | `…/keys/tl-xml-signer-1.cert.pem` |
| Real şəbəkə | `https://trust.tamga.network/tl-tr.xml` — **hələ dərc olunmayıb** (operator və qurum poçt ünvanları tamamlandıqdan sonra) | | |

- Əvvəlki versiyalar: `archive/tl-tr.v<NNNN>.xml` (eyni domendə).
- `.sha2` faylı XML faylının SHA-256 həzmidir (onaltılıq). Siyahının dəyişib-dəyişmədiyini yoxlamaq üçündür, kimliyi təsdiq etmir
  (TS 119 612 §6.1). Server keşi ən çox 4 saatdır.
- Sandbox siyahısı sınaq açarları ilə imzalanıb və real şəbəkədə keçərli deyil; içindəki ünvanlar "Sandbox (TEST)" yer
  tutucusudur.

## Nə deyil

- Tamga-nın XML siyahısı AB-nin 910/2014 saylı Reqlamenti çərçivəsində **bildirilmiş siyahı deyil** və siyahıda **ixtisaslı etibar
  xidməti yoxdur**. Hər XML-in hüquqi bildirişində bu yazılır.
- Bu siyahı AB-nin üçüncü ölkə etibar siyahılarının siyahısına (TC AdES LOTL) **daxil olmur**: o, dövlətin nəzarət etdiyi imza və
  möhür sertifikatı təminatçıları üçündür. Bir türk dövləti öz milli siyahısını dərc etmək istədikdə eyni alət və şablon hazırdır.
- AB-nin "üzv dövlət tərəfindən bildirilmiş" və ya "ixtisaslı" mənası daşıyan URI-ləri (`EUgeneric`, `granted`,
  `recognisedatnationallevel`, `…/QC`) istifadə olunmur. Ona görə də aşağıdakı URI-ləri tanımayan oxuyucu xidmətləri **aktiv
  saymır** — bu, şüurlu, təhlükəsiz tərəfdir.

## Siyahıda nə var

| Kim | Xidmət növü (`ServiceTypeIdentifier`) |
|---|---|
| Milli kök sertifikat (operator) | `http://uri.etsi.org/TrstSvc/Svctype/CA/PKC` |
| Sənəd verən qurum | `http://uri.etsi.org/TrstSvc/Svctype/EAA` və ya aşağıdakı Tamga növlərindən biri |
| Sənəd verənin status siyahısı imzası | `https://trust.tamga.network/tl/Svctype/EAA/StatusList` |
| Pul kisəsi təminatçısı | `http://uri.etsi.org/19602/SvcType/WalletSolution/Issuance` |

Yoxlayan tərəflər siyahıda **yoxdur** (etibar xidməti təminatçısı deyillər; qeydləri JSON siyahısında və qeydiyyat
sertifikatlarındadır). Şəxsi məlumat heç vaxt yoxdur. Qeydlər silinmir: geri çəkilən xidmət statusu və tarixçəsi ilə siyahıda qalır.

## URI tərifləri {#uris}

Kök: `https://trust.tamga.network/tl/`. `<CC>` ölkə kodudur (bu gün `TR`).

### Siyahı növü {#tsltype}

`https://trust.tamga.network/tl/TSLType/<CC>list` — Tamga Etibar Çərçivəsi altında `<CC>` ölkə slotu üçün dərc olunan etibar
xidməti status siyahısı. Siyahı Tamga-nın imzalı ölkə siyahısının (`tl-<cc>.jws`) eyni versiyalı görünüşüdür. AB üzv dövləti
siyahısı (`EUgeneric`) deyil.

### Status müəyyənetmə yanaşması {#statusdetn}

`https://trust.tamga.network/tl/StatusDetn/<CC>determination` — xidmət statusları Tamga Etibar Çərçivəsinin qeydiyyat və təsdiq
prosesi ilə müəyyən edilir: operator qurumu qeydiyyat məlumatı ([[ADR-0024]]) və səlahiyyətli sənəd növləri ilə qeydə alır, status
dəyişikliklərini imzalı siyahıda dərc edir. AB mənasında nəzarət orqanı qərarı və ya ixtisaslı status yoxdur.

### Qaydalar {#schemerules}

`https://arf.tamga.network/trust-framework` — Tamga Etibar Çərçivəsi (şəbəkənin qaydalar kitabı).
`https://trust.tamga.network/tl/schemerules/<CC>` — `<CC>` slotunun qaydaları; bu gün Tamga Etibar Çərçivəsinin özüdür (slot
dövlətə keçdikdə həmin dövlətin qaydalarına işarə edir).

### Xidmət statusları {#svcstatus}

Tamga statusu ilə birbaşa:

| URI (`…/tl/Svcstatus/…`) | Tamga statusu | Mənası |
|---|---|---|
| `active` | `ACTIVE` | Xidmət qeydiyyatdadır və keçərlidir; imzaladığı sənədlər qəbul edilir. |
| `suspended` | `SUSPENDED` | Müvəqqəti dayandırılıb; dayandırma müddətində xidmətin imzası etibarlı sayılmır. |
| `revoked` | `REVOKED` | Geri çəkilib; geri çəkilmənin qüvvəyə mindiyi andan sonra verilən sənədlər qəbul edilmir. |
| `retired` | `RETIRED` | Adi qaydada istifadədən çıxarılıb (məs. varisə təhvildən sonra); keçmiş sənədlər tarixindəki statusa görə qiymətləndirilir. |
| `rollingover` | `ROLLING_OVER` | Açar və ya kök yenilənmə dövrü; köhnə və yeni sertifikat birlikdə keçərlidir. |
| `deprecated` | `DEPRECATED` | İstifadədən çıxarılır; yeni istifadə tövsiyə olunmur. |

Əvvəlki statuslar `ServiceHistory` içində, yenidən köhnəyə və sertifikat əvəzinə açar identifikatoru (SKI) ilə durur.

### Tamga xidmət növləri {#svctype}

| URI (`…/tl/Svctype/…`) | Mənası |
|---|---|
| `EAA/Pub-EAA` | Dövlət mənbəyindən və ya onun adından sənəd verən qurum (AB PuB-EAA qarşılığı, lakin AB mənasında deyil). |
| `EAA/Q` | Tamga Etibar Çərçivəsində akkreditə olunmuş sənəd verən (AB QEAA qarşılığı, lakin **ixtisaslı deyil**). |
| `EAA/StatusList` | Sənəd verənin status siyahısını (Token Status List) imzalayan ayrıca xidmət. |

## İmza və imzalayan

- İmza: XAdES-B-B (EN 319 132-1), zərflənmiş, Exclusive C14N; ECDSA P-256 / SHA-256; KeyInfo-da yalnız imzalayanın sertifikatı.
- İmzalayan: şəbəkənin kök sertifikatı tərəfindən verilən ayrıca XML imza sertifikatı `tl-xml-signer-1`; TS 119 612 §5.7.1 profili —
  subyekt `C` = ölkə kodu, `O` = operatorun adı (`SchemeOperatorName`), basicConstraints CA=false, keyUsage digitalSignature +
  nonRepudiation, extendedKeyUsage `id-tsl-kp-tslSigning` (0.4.0.2231.3.0).
- İmzalayanı Tamga yolu ilə yoxlamaq: barmaq izi LOTL-da (`lotl.jws`) ölkə slotunun `signing_keys` siyahısındadır; LOTL-un özü
  [etibar lövbəri](/concepts/trust-lists) ilə yoxlanılır.

Sandbox XML imzalayanı (2026-10-29): `CN=Tamga Sandbox Trusted List Signer (TEST), O=Tamga Network Sandbox (TEST), C=TR`, SHA-256
`5576ff2bf0380b32e21a1859c267e6b0031d3c2bbc935adacb7d129eb6dac9c9`.

## AB DSS ilə yoxlamaq

AB-nin açıq mənbəli imza yoxlama aləti **DSS**-in (Digital Signature Service) Komissiya tərəfindən işlədilən demo yoxlayıcısından
istifadə edə bilərsiniz:

1. Siyahını endirin: `curl -O https://trust.sandbox.tamga.network/tl-tr.xml`
2. Həzmi yoxlayın: `sha256sum tl-tr.xml` nəticəsi `tl-tr.sha2` ilə eyni olmalıdır.
3. DSS demo yoxlayıcısında ("Validate a signature") `tl-tr.xml`-i yükləyin; yoxlama siyasəti defolt qalsın.
4. Gözlənilən nəticə: imza formatı **XAdES-BASELINE-B**; "reference data intact", "signature intact"; imza vaxtı və imzalayan
   sertifikatının xassələri keçərlidir. Ümumi nəticə **INDETERMINATE / NO_CERTIFICATE_CHAIN_FOUND** olur: imzalayan AB-nin etibar
   siyahılarında etibar lövbəri deyil — gözlənilən və düzgündür. Zənciri Tamga yolu ilə (LOTL) yoxlayırsınız.

Sxemi yoxlamaq üçün ETSI-nin rəsmi XSD-ləri (TS 119 612 V2.4.1 Əlavə C) istifadə olunur; Tamga-nın testləri hər yaradılan siyahını
onlara qarşı yoxlayır.

Kodla oxumaq: `@tamga-network/trust` paketindəki `readTrustedListXml(xml, sabitBarmaqİzləri)` imzanı və formatı yoxlayır. Paket bu
gün yalnız ETSI-nin aktiv statuslarını tanıyır; Tamga kökündəki statusları aktiv saymır (təhlükəsiz tərəf).

## Ətraflı

- Qərar: [[ADR-0066]]
- Uyğunlaşdırma cədvəlləri: [[SPEC-ID-0002]] §8.1
- Siyahı formatı və dərc yerləri: [[SPEC-TRUST-0001]]
- Etibar siyahıları: [Etibar siyahıları və federasiya](/concepts/trust-lists)
