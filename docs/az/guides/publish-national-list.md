---
document_id: GUIDE-0011
title: "Milli etibar siyahısının dərc edilməsi"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-16
summary: >
  Dövlətin və ya onun səlahiyyətli qurumunun öz etibar siyahısını Tamga Network-a qoşması: iki yol (Tamga formatında milli siyahı və ya ETSI formatında xarici siyahı), LOTL-dakı qeyd, rollar, imza açarları, əhatə dairəsi, tanınma, təhvil və dərc qaydaları.
translation_of: GUIDE-0011
source_version: "1.0.0"
---

# Milli etibar siyahısının dərc edilməsi

Bu bələdçi öz ölkəsinin [[t:trust-list|etibar siyahısını]] idarə edəcək dövlət qurumları (siyahı operatoru, [[t:TLSO]]) və onların
texniki komandaları üçündür.

**Nə vaxt oxunmalıdır:**
- Ölkə Tamga Network-a qoşularkən və ya Tamga-nın vəkalətən idarə etdiyi siyahını təhvil alarkən.
- Ölkəniz siyahısını artıq ETSI formatında dərc edirsə və Tamga rəqəmsal cüzdanlarının və yoxlayan tərəflərinin onu tanımasını istəyirsinizsə.
- Əvvəlcə: [Etibar siyahıları](/concepts/trust-lists) və [Federasiya](/concepts/federation).

## Necə işləyir?

Rəqəmsal cüzdanlar və yoxlayan tərəflər yalnız bir şeyə etibar edir: Tamga [[t:LOTL|siyahılar siyahısının]] (LOTL) kök açarına. LOTL hər ölkə siyahısının
ünvanını, imzalayanını və nəyə zəmanət verə biləcəyini göstərir. Ölkənin siyahısını şəbəkəyə qoşmaq bu qeydin LOTL-a yazdırılması deməkdir.
Siyahı ölkədə qalır; Tamga yalnız toplayır ([[ADR-0036]]).

| Yol | Format | LOTL-da | Nə vaxt |
|---|---|---|---|
| **A. Milli siyahı** | Tamga formatı (`tamga-tl+jwt`, [[SPEC-TRUST-0001]]) | `national_lists[]` | Ölkə Tamga Network üzvüdür; sənədi verən qurumlar, yoxlayan tərəflər və kök sertifikatlar öz siyahısındadır |
| **B. Xarici siyahı** | ETSI TS 119 602 ([[t:LoTE]], JSON) | `external_lists[]` | Ölkənin və ya Avropa İttifaqının (Aİ) mövcud siyahısı; müəyyən rollara zəmanət verir |

Hazırda Türkiyə siyahısını (`tl-tr.jws`) Tamga vəkalətən idarə edir; Türk Dövlətləri Təşkilatının digər üzvləri üçün qeydlər rezerv edilmiş
(`RESERVED`) vəziyyətdədir. LOTL-da hələ xarici siyahı yoxdur.

## A. Milli siyahı

### 1. LOTL qeydi

```json
{
  "state_code": "TR",
  "status": "ACTIVE",
  "membership": "TDT_MEMBER",
  "list_url": "https://trust.tamga.network/tl-tr.jws",
  "operator": { "name": "Tamga Network", "status": "provisional", "on_behalf_of": "TR national authority (to be designated)" },
  "signing_certs": ["tl-signer-1"],
  "roles": {
    "registrar": { "status": "PROVISIONAL", "operated_by": "Tamga Network", "signing_certs": ["registrar-1"] },
    "tlso": { "status": "PROVISIONAL", "operated_by": "Tamga Network" },
    "pid_provider": { "status": "RESERVED" },
    "access_ca": { "status": "PROVISIONAL", "operated_by": "Tamga Network" },
    "national_root_ca": { "status": "ACTIVE", "cert": "root-ca", "operated_by": "Tamga Network (provisional)" }
  },
  "recognition": { "mode": "unilateral", "recognizes": ["TR"] }
}
```

Bu, hazırkı Türkiyə qeydidir. Təhvil zamanı eyni qeyddə yalnız `operator`, `list_url` və imzalayanlar dəyişir.

| Rol | Nə edir |
|---|---|
| `tlso` | Siyahını imzalayır və dərc edir |
| `registrar` | Sənədi verən qurumları və yoxlayan tərəfləri qeydiyyata alır; [[t:registration-certificate|qeydiyyat sertifikatlarını]] imzalayır |
| `access_ca` | Yoxlayan tərəflərə [[t:access-certificate|giriş sertifikatı]] verir |
| `national_root_ca` | Sənədi verən qurumların sertifikatlarının kökü |
| `pid_provider` | Milli şəxsiyyət sənədini ([[t:PID]]) verən qurum; hazırda rezerv edilib |

### 2. Siyahı qaydaları

Siyahınız [[SPEC-TRUST-0001]] formatındadır və aşağıdakı qaydalara uyğun olmalıdır:

- **İmza:** ES256; imzalayanın sertifikatı LOTL qeydindəki `signing_certs` ilə uyğun gəlir. Növbə ilə dəyişdirilən (rotasiya edilən) ən azı iki imzalayan tövsiyə olunur.
- **Versiya zənciri:** hər dərc əvvəlkinin həşini (`previous_version_hash`) daşıyır; versiya geri qayıtmır; sətir silinmir, statusu dəyişir.
- **Aktuallıq:** `next_update` ən gec 90 gün sonra; dəyişikliklər ən gec 24 saat ərzində dərc olunur. Köhnəlmiş siyahı yoxlayan tərəfdə
  "yoxlanıla bilmədi" nəticəsini verir.
- **Fərdi məlumatlar yoxdur:** siyahıda, [[t:anchor-log|lövbər jurnalında]] və dəyişiklik qeydində fərdi məlumatlar olmur.
- **İdentifikatorlar zəncir düsturu ilə:** `issuer_id`, `ca_id`, `schema_id` ortaq reyestr açıldıqda da eyni qalır ([[ADR-0009]]).

### 3. Qeydiyyat və dərc aləti

Siyahı dərcedicisi açıq mənbəlidir (`apps/trust-publisher`). Qeydiyyat işlərini əl ilə redaktə etmədən yerinə yetirir:

```sh
npm run trust:register -- issuer application.json   # add an issuer (reports all missing fields at once)
npm run trust:register -- rp application.json       # add a verifier
npm run trust:authorize -- <slug> <vct>             # credential type authorisation (--revoke to end it)
npm run trust:status -- <slug> SUSPENDED --reason r
npm run trust:build                                  # sign and publish (dist/)
npm run trust:verify                                 # verify the publication
```

Müraciət formatları: [[GUIDE-0007]] və [[GUIDE-0008]].

### 4. Tanınma

`recognition.mode` və `recognizes[]` bu ölkənin hansı ölkələrin qurumlarını tanıdığını göstərir. Yoxlayan tərəf [[SPEC-API-0001]] C3
addımında bunu soruşur (`isRecognizedBy`). Ölkələr arasında qarşılıqlı tanınma üzv dövlətlərin qərarıdır.

## B. Xarici siyahı (ETSI)

Ölkənizin və ya Aİ-nin siyahısı ETSI formatındadırsa, onu köçürməyə ehtiyac yoxdur; LOTL-a göstərici əlavə edilir:

```json
{
  "list_id": "example-pid-list",
  "territory": "TR",
  "format": "etsi-lote-json",
  "list_url": "https://example.org/lote/pid-providers.jws",
  "signing_keys": [{ "fingerprint_sha256": "…", "status": "ACTIVE" }],
  "operator": { "name": "…" },
  "status": "ACTIVE",
  "scope": {
    "entity_kinds": ["pid_provider", "wallet_provider"],
    "vct": ["urn:eudi:pid:1", "eu.europa.ec.eudi.pid.1"],
    "category": "IDENTITY",
    "assurance": "I3",
    "class": "PUB",
    "recognized_by": ["TR"],
    "min_key_storage": "secure_enclave"
  },
  "approval": { "approved_at": "…", "ref": "…" }
}
```

- **Əhatə dairəsi:** xarici siyahı yalnız `scope.entity_kinds` daxilindəki rollara (`wallet_provider`, `pid_provider`, `eaa_provider`,
  `access_ca`) və `scope.vct` daxilindəki növlərə zəmanət verə bilər; əhatə dairəsindən kənar qeydlər nəzərə alınmır.
- **İmzalayan sabitdir:** imzalayanı LOTL-dakı ilə uyğun gəlməyən siyahı yüklənmir.
- **Müstəqillik:** xarici siyahı yoxdursa və ya köhnəlibsə, bu Tamga siyahılarına təsir etmir; yalnız həmin siyahıdan asılı sorğular "naməlum" nəticəsini qaytarır.
- **Format:** `etsi-lote-json` (ETSI TS 119 602) və `etsi-tl-xml` (ETSI TS 119 612, XAdES zərflənmiş imza; paketlər 0.5.0) oxunur. Dərcedicinin nüsxəsi `external/<list_id>.jws` və ya `.xml`.
- **Nüsxə:** dərcedici siyahının nüsxəsini `trust.tamga.network/external/<list_id>.jws` ünvanında saxlayır (`npm run trust:external`);
  imza hər halda sabit imzalayana qarşı yoxlanılır.
- **Təsdiq:** xarici siyahının əlavə edilməsi, dəyişdirilməsi və ya çıxarılması layihə rəhbərliyinin təsdiqi ilə həyata keçirilir və `approval` sahəsinə yazılır;
  yer tutucu ehtiva edən qeyd dərc olunmur (FD4).

## Təhvil

Tamga-nın vəkalətən üzərinə götürdüyü rollar (siyahı operatoru, qeydiyyat qurumu, kök CA, müvəqqəti şəxsiyyət provayderi) təhvil verilə bilən şəkildə
layihələndirilib. Təhvil zamanı rəqəmsal sənəd, rəqəmsal cüzdan və yoxlayan tərəf tərəfində yalnız ünvan və imzalayan dəyişir; identifikatorlar və verilmiş rəqəmsal sənədlər
qüvvədə qalır ([[ADR-0035]] PO3). Ölkə siyahısının Aİ-nin gözlədiyi ETSI TS 119 612 təqdimatı dövlət mərhələsindən əvvəl dərcediciyə
əlavə ediləcək.

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[ADR-0036]] FD1 | Xarici siyahı LOTL-da yalnız ünvanı, sabit imzalayanı və əhatə dairəsi ilə göstərilir |
| [[ADR-0036]] FD2 | Xarici siyahı əhatə dairəsindən kənar rollara və növlərə zəmanət verə bilməz |
| [[ADR-0036]] FD3 | Xarici siyahıdakı problem Tamga siyahılarının aktuallığını pozmur |
| [[ADR-0035]] PO3 | Vəkalətən üzərinə götürülən rollar təhvil verilə bilər; təhvil zamanı yalnız ünvan və imzalayan dəyişir |
| Naməlum format | Naməlum format versiyasında oxuyucu dayanır ([[ARCH-0003]] CMP2) |

Siyahı operatoru qaydaları: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/az/rulebook).
