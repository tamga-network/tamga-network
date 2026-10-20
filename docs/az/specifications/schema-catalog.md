---
document_id: SPEC-SCHEMA-0001
title: "Sxem kataloqu"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-16
summary: >
  [[ADR-0007]] qərarlarının normativ tətbiqi. schemas.tamga.network URL sxemini və ad sahələrini, hər vct ünvanında dərc edilən SD-JWT VC Type Metadata sənədinin strukturunu, vct#integrity dəyərinin necə hesablandığını, kök tip TamgaBaseCredential-ı, SchemaRegistry və IssuerRegistry müqavilə interfeyslərini, sxemlərin dərc xəttini (repo → CI → hash → CDN → zəncir), yoxlayan tərəfdəki altı addımlı həll etmə alqoritmini, versiyalaşdırma və istifadədən çıxarma qaydalarını, çoxdilli sahə strukturunu və doqquz invariantı müəyyən edir.
translation_of: SPEC-SCHEMA-0001
source_version: "1.0.0"
---

Bu spesifikasiya Tamga-dakı rəqəmsal sənəd növlərinin (sxemlərin) necə adlandırıldığını, dərc edildiyini və [[t:verifier|yoxlayan tərəfdə]] necə
həll edildiyini müəyyən edir; [[t:issuer|sənədi verən]] qurumlar, yoxlayan tərəf tərtibatçıları və sxem müəllifləri üçündür.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Rəqəmsal sənəd formatları](/concepts/credential-formats) konsepsiya səhifəsini oxuyun.
- Yeni rəqəmsal sənəd növü layihələndirirsinizsə və ya yoxlayan tərəf kimi bir sənədin növünü həll edirsinizsə, bu səhifə Sizin üçündür.
- Növlərin məzmunu ayrı sənədlərdədir: təhsil [[SPEC-SCHEMA-0002]], digər sektorlar [[SPEC-SCHEMA-0003]].

**Qısaca**

Hər rəqəmsal sənəd növünün bir adı ([[t:vct]]) var: `urn:tamga:edu:DiplomaCredential:1` kimi. Bu adın qarşılığı schemas.tamga.network-də
dərc edilən növ tərifidir (Type Metadata): sənəddə hansı sahələrin olduğunu, ekranda necə göstəriləcəyini və hansı
sahələrin gizlədilə biləcəyini bildirir. Növ tərifinin barmaq izi (integrity) sənədə yazılır; yoxlayan tərəf yüklədiyi tərifin bu
barmaq izi ilə üst-üstə düşdüyünü yoxlayır, beləliklə tərif xəbərsiz dəyişdirilə bilməz. Hansı növlərin etibarlı olduğu imzalı
[[t:trust-list|etibar siyahısında]] dərc edilir.

> Bu gün kataloq imzalı etibar siyahıları (`lotl.schemas[]` + lövbər jurnalı) ilə dərc edilir. §5-dəki müqavilə interfeysləri və
> dərc xəttindəki zəncir addımı zəncir mərhələsinə aiddir ([[ADR-0009]]).

---

# Əhatə dairəsi

Bu spesifikasiya Tamga sxem reyestrinin **texniki olaraq necə işlədiyini**
müəyyən edir. Qərarlar və əsaslandırmalar [[ADR-0007]] və [[PM-SCHEMA-0001]]-dədir;
burada təkrarlanmır.

Əhatə dairəsindən kənar: ayrı-ayrı sxemlərin məzmunu ([[SPEC-SCHEMA-0002]] təhsil,
[[SPEC-SCHEMA-0003]] digər sektorlar).

**Standart əsas:** [[t:SD-JWT-VC]] (draft-ietf-oauth-sd-jwt-vc-19) Type Metadata
bölməsi; JSON Schema draft 2020-12; W3C Subresource Integrity (integrity
metadata sətir formatı).

---

# 1. URL sxemi və ad sahələri

## 1.1 Ümumi format

> **İnkişaf mərhələsi ([[ADR-0029]]):** beta buraxılışına qədər sxemlər eyni versiya yolunda yerində düzəldilir; D1 və kiçik versiya qaydası beta (`SCHEMA_STAGE = "stable"`) ilə tətbiq edilir. Kataloq və `lotl.schemas[]` qeydi `content_hashes` sahəsini daşıyır; yoxlayan tərəf (B4) və rəqəmsal cüzdan sənədin `vct#integrity` dəyərini bu siyahıda axtarır. İnkişaf mərhələsində siyahıda yalnız aktual heş olur.

> **ADR-0010 (D-SCHEMA-4):** Tipin **identifikatoru** `vct = urn:tamga:<domain>:<Type>:<major>` (dövlət mərhələsində dövlətə məxsus `urn:tamga:<cc>:<domain>:<Type>:<major>`), `schemaId = keccak256(vct)`. Aşağıdakı HTTPS yolları identifikator deyil, **`metadata_url` / `schema_uri`**-dir (yerləşdirmə ünvanı; kataloq `schemas.tamga.network/v1/catalogue.json` `vct → metadata_url + content_hash` verir, IETF SD-JWT VC-19 §5.3.2 registry yolu). `vct#integrity` məcburidir (ETSI TS 119 472-1). Domen adı dəyişsə də, identifikator dəyişmir (D-NAME-1).

```
NETWORK layer:
https://schemas.tamga.network/v1/<domain>/<TypeName>/<semver>

NATIONAL layer:
https://schemas.tamga.network/v1/<cc>/<domain>/<TypeName>/<semver>
```

- `v1` — **registry protokolunun versiyası**, sxem versiyası deyil. Type Metadata
  sənədinin strukturu dəyişərsə, `v2` olur. Bu günə qədər `v1`.
- `<cc>` — ISO 3166-1 alpha-2, **kiçik hərflə** (`tr`, `az`, `kz`, `uz`, `kg`).
  Yalnız NATIONAL səviyyədə olur.
- `<domain>` — qapalı siyahı (§1.2).
- `<TypeName>` — PascalCase, `Credential` ilə bitir.
- `<semver>` — `MAJOR.MINOR.PATCH`, üç hissə məcburidir.

Nümunələr:

```
urn:tamga:edu:DiplomaCredential:1
urn:tamga:edu:StudentCredential:1
urn:tamga:core:TamgaBaseCredential:1
https://schemas.tamga.network/v1/tr/edu/YOKDenklikCredential/1.0.0
```

## 1.2 Sahələr siyahısı (domain, qapalı)

| Domain | Əhatə | Faza |
|---|---|---|
| `core` | Kök tiplər, ümumi strukturlar | 0 |
| `edu` | Təhsil və ixtisas | **0** |
| `org` | Hüquqi şəxs, işçi səlahiyyəti | 0 (skelet) |
| `id` | Şəxsiyyət, yaşayış yeri | 1 |
| `health` | Səhiyyə | 2 |
| `fin` | Maliyyə | 2 |
| `log` | Logistika, ticarət | 2 |
| `travel` | Səyahət, turizm | 2 |

Yeni domain əlavə etmək NETWORK qərarıdır (2/3 səs). NATIONAL sxemlər mövcud domain
siyahısından istifadə edir; öz domain-ini yarada bilməz.

## 1.3 Hər URL-in qaytardığı məzmun

| Yol | Məzmun | `Content-Type` |
|---|---|---|
| `.../<semver>` | Type Metadata sənədi | `application/json` |
| `.../<semver>/schema.json` | JSON Schema 2020-12 | `application/schema+json` |
| `.../<semver>/mapping.json` | ELM/OBv3 uyğunluq cədvəli (məlumat xarakterli) | `application/json` |

Type Metadata-nın özü `vct` URL-ində yerləşir. Bu, standartın "URL-dəki
`vct`-dən götür" yolunu ([[ADR-0007]] Qərar 1) birbaşa işlədir.

## 1.4 Həll edilə bilmə və reyestr yolu

`vct` HTTPS URL olduğu üçün əsas həll etmə yolu birbaşa `GET`-dir.
Bundan əlavə, registry standartın "registry-dən götür" yolunu da dəstəkləyir:

```
GET https://schemas.tamga.network/v1/resolve?vct=<url-encoded-vct>
```

Bu son nöqtə şəbəkədən kənar istehlakçılar və `vct`-yə birbaşa çıxışı olmayan müştərilər
üçündür. Eyni sənədi eyni baytlarla qaytarır — əks halda integrity pozulur.

---

# 2. Növ tərifi (Type Metadata)

## 2.1 Struktur

Hər `vct` ünvanında dərc edilən sənəd:

```json
{
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "name": "Tamga Diploma Credential",
  "description": "A graduation credential issued by a higher-education institution.",

  "extends": "urn:tamga:core:TamgaBaseCredential:1",
  "extends#integrity": "sha256-Yr9k...",

  "schema_uri": "https://schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0/schema.json",
  "schema_uri#integrity": "sha256-3Qm2...",

  "display": [ /* §2.2 */ ],
  "claims":  [ /* §2.3 */ ],

  "tamga": { /* §2.4 — ecosystem extension */ }
}
```

Qaydalar:

- `schema` (daxili) **istifadə edilmir**; həmişə `schema_uri` istifadə edilir. Əsaslandırma:
  Type Metadata sənədini kiçik saxlamaq, sxemi ayrıca keşlənə bilən etmək.
- `schema_uri#integrity` **məcburidir.**
- **Tamga əlavəsi:** `schema_uri` və `schema_uri#integrity` IETF SD-JWT VC 19-cu layihəsinin Type Metadata sahələri arasında
  **yoxdur** (əvvəlki layihələrdə var idi). Tamga onları öz əlavəsi kimi saxlayır: standart istehlakçı bu iki sahəni tanımır və
  nəzərə almır (aşağıdakı qayda); JSON Schema yoxlaması (yoxlama addımı B6) yalnız Tamga yoxlayan tərəfində işləyir.
- Kök tip (`TamgaBaseCredential`) istisna olmaqla, hər tipdə `extends` +
  `extends#integrity` **məcburidir.**
- Tanınmayan yuxarı səviyyəli xüsusiyyətlər istehlakçı tərəfindən **nəzərə alınmır** —
  bu, standartın tələbidir. `tamga` genişləndirmə bloku məhz buna görə təhlükəsizdir.

## 2.2 `display` — dil əsaslı təqdimat

```json
"display": [
  {
    "lang": "tr-TR",
    "name": "Diploma",
    "description": "Yükseköğretim mezuniyet belgesi",
    "rendering": {
      "simple": {
        "background_color": "#0B3D2E",
        "text_color": "#FFFFFF"
      }
    }
  },
  { "lang": "en-US", "name": "Diploma", "description": "Higher education degree" },
  { "lang": "az-AZ", "name": "Diplom",  "description": "Ali təhsil diplomu" },
  { "lang": "kk-KZ", "name": "Диплом",  "description": "Жоғары білім дипломы" },
  { "lang": "uz-UZ", "name": "Diplom",  "description": "Oliy ta'lim diplomi" },
  { "lang": "ky-KG", "name": "Диплом",  "description": "Жогорку билим дипломy" }
]
```

**Minimal dil dəsti:** `tr-TR` və `en-US` hər NETWORK sxemində **məcburidir.**
Digər üzv dövlətlərin dilləri həmin dövlət qoşulduqda əlavə edilir (MINOR versiya).

NATIONAL sxemlərdə yalnız sahib dövlətin dili + `en-US` məcburidir.

## 2.3 `claims` — sahə əsaslı təqdimat və açıqlama siyasəti

```json
"claims": [
  {
    "path": ["qualification_title"],
    "display": [
      { "lang": "tr-TR", "label": "Program", "description": "Mezun olunan program" },
      { "lang": "en-US", "label": "Programme" }
    ],
    "sd": "allowed"
  },
  {
    "path": ["vct"],
    "sd": "never"
  },
  {
    "path": ["birth_date"],
    "display": [{ "lang": "tr-TR", "label": "Doğum tarihi" }],
    "sd": "allowed"
  }
]
```

`sd` dəyərləri və onların Tamga-dakı mənası:

| Dəyər | Məna | Tamga-da istifadə |
|---|---|---|
| `always` | Claim selective disclosure ilə **məcburi olaraq** gizlədilə bilən olmalıdır | Həssas sahələr (şəxsiyyət nömrəsi, doğum tarixi) |
| `allowed` | Sənədi verən qurum seçə bilər | Defolt |
| `never` | Selective disclosure ilə gizlədilə **bilməz**, həmişə görünür | `iss`, `vct`, `cnf`, `status`, `iat` |

**Tamga qaydası:** `sd: "never"` yalnız protokol claim-lərində istifadə edilir.
Heç bir **fərdi məlumat** sahəsi `never` ola bilməz. Bu, §11 invariantlarında
məcburi tətbiq edilir.

## 2.4 `tamga` genişləndirmə bloku

Standartda olmayan, Tamga-ya məxsus metadata:

```json
"tamga": {
  "tier": "NETWORK",
  "schemaId": "0x7f3a...",
  "issuer_categories": ["EDUCATION"],
  "default_ttl_days": null,
  "uses_status_list": true,
  "min_issuer_assurance": "I2",
  "derived_claims": ["is_graduate", "graduated_before"],
  "elm_profile": "ELM-3.3/Qualification",
  "status": "ACTIVE"
}
```

| Sahə | Məna |
|---|---|
| `tier` | `NETWORK` \| `NATIONAL` ([[ADR-0007]] Qərar 5) |
| `schemaId` | Zəncirdəki `keccak256(vctURI)` — çarpaz yoxlama |
| `issuer_categories` | Bu sxemdən hansı `IssuerCategory` istifadə edə bilər |
| `default_ttl_days` | **Maksimal** `exp` müddəti (yuxarı hədd, sabit dəyər deyil); `null` = uzunömürlü |
| `uses_status_list` | `false` olduqda qısaömürlüdür, ləğv siyahısı yoxdur ([[ADR-0008]] Alt. C) |
| `suspension_allowed` | İxtiyari, defolt `false`. `true` olduqda sənədi verən qurum bu növdə dayandırmadan (ləğv siyahısında `0x02`) istifadə edə bilər; əks halda yalnız ləğv ([[ADR-0048]] K2; bu gün yalnız diplom). Şəxsiyyət xidmətinin növlərində olmur |
| `min_issuer_assurance` | Sənədi verən qurumun minimal səviyyəsi ([[PM-ASSUR-0001]] I1–I3) |
| `derived_claims` | `age_over_NN` nümunəsinin törəmələri ([[RS-SCHEMA-0001]] §4) |
| `elm_profile` | Hansı ELM versiyasına/profilinə uyğunlaşdırılıb |
| `status` | `ACTIVE` \| `DEPRECATED` \| `REVOKED` — zəncirlə uyğun |

`issuer_categories` sahəsi **məlumat xarakterlidir**; məcburi yoxlama zəncirdədir
(§5.2). Sənəd ilə zəncir ziddiyyət təşkil edərsə, **zəncir üstünlük təşkil edir.**

---

# 3. Bütövlük dəyərinin (integrity) yaradılması

## 3.1 Format

W3C Subresource Integrity sətir formatı:

```
sha256-<base64(SHA-256(raw bytes of the document))>
```

Nümunə: `sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=`

## 3.2 Hesablama qaydaları (normativ)

1. Hash serverin qaytardığı **xam bayt ardıcıllığı** üzərində hesablanır. JSON
   yenidən seriallaşdırılmır, boşluqlar normallaşdırılmır.
2. Buna görə dərc edilən fayl **bayt-bayt dəyişməzdir.** CDN və ya proxy-nin
   yenidən formatlaşdırma aparmasına icazə verilmir.
3. Fayllar **LF** sətir sonu ilə, **UTF-8, BOM-suz** yazılır.
4. Sondakı yeni sətir simvolu faylın hissəsidir və hash-ə daxildir.

```bash
# Referans hesaplama
printf 'sha256-%s\n' "$(openssl dgst -sha256 -binary dosya.json | openssl base64 -A)"
```

## 3.3 Harada istifadə edilir

| Dəyər | Harada | Məcburidirmi |
|---|---|---|
| `vct#integrity` | Sənədin öz payload-ında | **Bəli** ([[ADR-0007]] Qərar 3) |
| `extends#integrity` | Type Metadata daxilində | Bəli (kök tip istisna olmaqla) |
| `schema_uri#integrity` | Type Metadata daxilində (Tamga əlavəsi, §2.1) | Bəli |
| `contentHash` | `SchemaRegistry` müqaviləsində | Bəli |

`contentHash` = `vct#integrity`-nin göstərdiyi **eyni** sənədin hash-i,
`bytes32` şəklində (base64 deyil, xam SHA-256).

**Dəyişməz qayda:** `contentHash` və `vct#integrity` eyni baytları təmsil edir. Biri
digərini təsdiqləyir; ikisi üst-üstə düşmürsə, yoxlayan tərəf rəqəmsal sənədi rədd edir.

---

# 4. Kök tip — TamgaBaseCredential

Hər Tamga rəqəmsal sənədi birbaşa və ya dolayı yolla
`core/TamgaBaseCredential`-dan törəyir.

## 4.1 Məcburi sahələr

| Claim | Tip | `sd` | İzah |
|---|---|---|---|
| `iss` | string | `never` | Sənədi verən qurumun identifikatoru, X.509-a həll edilir ([[SPEC-ID-0002]]) |
| `vct` | string (URI) | `never` | Tip URL-i |
| `vct#integrity` | string | `never` | §3 |
| `iat` | number | `never` | Verilmə vaxtı |
| `cnf` | object | `never` | Sənəd sahibinin açarı ([[SPEC-CRED-0001]] §3) |

## 4.2 Şərti sahələr

| Claim | Nə vaxt |
|---|---|
| `exp` | `tamga.default_ttl_days` doludursa, **məcburidir**; `exp - iat` həmin dəyəri aşa bilməz |
| `status` | `tamga.uses_status_list = true` olduqda **məcburidir** ([[ADR-0008]]) |

## 4.3 Ümumi strukturlar

Kök tip həmçinin təkrar istifadə edilə bilən JSON Schema tərifləri daşıyır:

- `LangString` — çoxdilli mətn (§8)
- `IssuerRef` — sənədi verən quruma istinad
- `DateOnly` — `YYYY-MM-DD` formatı

---

# 5. Müqavilə interfeysləri (zəncir mərhələsi)

> Bu gün istifadə edilmir: sxem qeydləri imzalı etibar siyahısında (`lotl.schemas[]`) dərc edilir. Bu interfeyslər zəncir
> mərhələsi üçündür ([[ADR-0009]]).

## 5.1 SchemaRegistry

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface ISchemaRegistry {
    enum Tier   { NETWORK, NATIONAL }
    enum Status { NONE, ACTIVE, DEPRECATED, REVOKED }

    struct SchemaRecord {
        string  vctURI;        // canonical type identifier
        bytes32 contentHash;   // SHA-256 of the Type Metadata document
        string  version;       // semver, e.g. "1.0.0"
        Tier    tier;
        bytes2  stateCode;     // owner if NATIONAL; 0x0000 if NETWORK
        Status  status;
        uint64  validFrom;
        bytes32 supersededBy;  // newer version; 0x0 if none
    }

    event SchemaRegistered(bytes32 indexed schemaId, string vctURI, Tier tier, bytes2 indexed stateCode);
    event SchemaDeprecated(bytes32 indexed schemaId, bytes32 supersededBy);
    event SchemaRevoked(bytes32 indexed schemaId, string reason);

    error SchemaExists(bytes32 schemaId);
    error UnknownSchema(bytes32 schemaId);
    error NotSchemaOwner(bytes32 schemaId, address caller);
    error NetworkTierRequiresGovernance();

    /// @notice schemaId = keccak256(bytes(vctURI))
    function schemaIdOf(string calldata vctURI) external pure returns (bytes32);

    /// @notice NETWORK: only via a Governance execution. NATIONAL: onlyOwnerState.
    function registerSchema(SchemaRecord calldata rec) external;

    function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external;
    function revokeSchema(bytes32 schemaId, string calldata reason) external;

    function getSchema(bytes32 schemaId) external view returns (SchemaRecord memory);
    function isActiveSchema(bytes32 schemaId) external view returns (bool);

    /// @notice For verification: does the given hash match the on-chain record?
    function matchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool);
}
```

**Səlahiyyət qaydaları:**

- `tier == NETWORK` → çağırış yalnız `Governance` müqaviləsinin 2/3 səslə
  icra etdiyi təklifdən gələ bilər ([[ADR-0002]] Səviyyə 1).
- `tier == NATIONAL` → `onlyOwnerState(stateCode)` ([[SPEC-BC-0001]] §0).

**İnvariant:** Qeydiyyatdan keçmiş sxemin `vctURI` və `contentHash` sahələri **heç vaxt
yenilənmir.** Dəyişiklik = yeni versiya = yeni `schemaId`. `deprecateSchema`
və `revokeSchema` yalnız `status` sahəsini dəyişir.

## 5.2 IssuerRegistry — sxem səlahiyyəti əlavəsi

[[ADR-0007]] Qərar 6-nın müqavilədəki qarşılığı. Mövcud `IIssuerRegistry`-yə əlavə edilir:

```solidity
interface IIssuerRegistry {
    // ... existing members ...

    event SchemaAuthorizationSet(bytes32 indexed issuerId, bytes32 indexed schemaId, bool allowed);

    error SchemaNotAuthorized(bytes32 issuerId, bytes32 schemaId);

    /// @notice The state that registered the issuer grants the authorisation (onlyOwnerState).
    function setSchemaAuthorization(bytes32 issuerId, bytes32 schemaId, bool allowed) external;

    /// @notice At ISSUANCE: "may it issue this schema now?"
    function isAuthorizedForSchema(bytes32 issuerId, bytes32 schemaId) external view returns (bool);

    /// @notice At VERIFICATION (mandatory step): "was it authorised at iat?"
    function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
        external view returns (bool);

    function authorizedSchemasOf(bytes32 issuerId) external view returns (bytes32[] memory);
}
```

**Tətbiq qeydi:** `isAuthorizedForSchema` aşağıdakı üç şərtin **hamısını** ödəməlidir:

1. `issuerId` etibarlıdır və `canIssue` ✓
2. `schemaId` `ACTIVE` ✓ (`DEPRECATED` olduqda **yeni rəqəmsal sənəd verilə bilməz**)
3. `(issuerId, schemaId)` cütü açıq şəkildə səlahiyyətləndirilib ✓

Üçüncü şərt **defolt olaraq yanlışdır**. Yəni səlahiyyət açıq şəkildə verilməyibsə,
o yoxdur — blocklist deyil, allowlist məntiqi.

---

# 6. Sxemlərin dərc xətti

Sxemin qüvvəyə minməsi altı addımdan ibarətdir və **ardıcıllıq məcburidir:**

```
1. DESIGN      the schema is written in the source repository (schemas/ directory)
                 ↓
2. VALIDATE    CI: is the JSON Schema valid, are the Type Metadata fields complete,
                    does the extends chain resolve, are the minimum languages present,
                    is sd:never used on personal data (§11 check)
                 ↓
3. FREEZE      files are fixed at byte level (LF, UTF-8, no-BOM)
                 ↓
4. HASH        CI computes contentHash and all #integrity values;
                    writes them into the Type Metadata; hashes again (two passes)
                 ↓
5. PUBLISH     uploaded to the CDN at an immutable URL (nobody can use it yet)
                 ↓
6. REGISTER    registerSchema(...) — after a vote for NETWORK, directly for NATIONAL
```

**Niyə bu ardıcıllıq:** Zəncir qeydi dokumentin əlçatan olmasından **sonra**
aparılmalıdır. Əks ardıcıllıqda zəncirdə qeydə alınmış, lakin həll edilə bilməyən sxem yaranır
və həmin sxemlə yaradılan heç bir rəqəmsal sənəd yoxlanıla bilməz.

**İki keçidli hash (addım 4)** diqqət tələb edir: `schema_uri#integrity` Type
Metadata-nın **daxilindədir**, buna görə əvvəlcə sxem hash-lanır, Type Metadata-ya
yazılır, sonra Type Metadata hash-lanır. Ardıcıllıq tərsinə çevrilsə, hash heç vaxt
uyğun gəlməz.

**Geri qaytarma:** 6-cı addımdan sonra geri qaytarma yoxdur. `revokeSchema` irəliyə doğru
hərəkətdir, silmə deyil.

---

# 7. Həll alqoritmi (yoxlayan tərəf)

Normativdir. İstənilən addımın uğursuz olması rəqəmsal sənədin **rədd edilməsi**
deməkdir.

```
INPUT: SD-JWT VC (issuer-signed JWT + disclosures + KB-JWT)

Ş1. Read the vct and vct#integrity claims.
    If vct or vct#integrity is missing → REJECT.

Ş2. schemaId = keccak256(bytes(vct))
    SchemaRegistry.getSchema(schemaId)
    No record → REJECT (unregistered type).
    status == REVOKED → REJECT.
    status == DEPRECATED → acceptable; but REJECT if iat > the deprecation time.

Ş3. Obtain the Type Metadata:
    a) Is it in the local cache under the vct#integrity key? If so, use it.
    b) Otherwise GET <vct>. If that fails, try /v1/resolve?vct=...
    c) If neither works → verification CANNOT be done (not REJECT; return "indeterminate").

Ş4. Integrity:
    SHA-256(received bytes) == vct#integrity  → otherwise REJECT.
    SHA-256(received bytes) == record.contentHash → otherwise REJECT.
    The "vct" field inside the document == the vct in the credential → otherwise REJECT.

Ş5. Resolve the extends chain (if any):
    Verify extends#integrity at every step.
    Cycle detected → REJECT. Depth > 5 → REJECT.

Ş6. Schema conformance:
    Fetch schema_uri, verify schema_uri#integrity,
    validate the credential payload against JSON Schema 2020-12 → REJECT if it does not conform.

Ş7. AUTHORISATION (ADR-0007 Decision 6 — cannot be skipped):
    issuerId = derived from the x5c leaf fingerprint (SPEC-ID-0002; NOT from the iss claim)
    IssuerRegistry.isCredentialSchemaAcceptable(issuerId, schemaId, credential.iat) == true
    → otherwise REJECT.
    (isAuthorizedForSchema is the ISSUANCE question; if it were used for verification,
     old credentials issued with a DEPRECATED schema would fail — SPEC-BC-0001 R3)

OUTPUT: the schema is valid. The remaining verification steps are in SPEC-API-0001.
```

**Ş3(c) haqqında:** Sxem əldə edilə bilmədikdə nəticə "etibarsız" deyil,
**"yoxlanıla bilmədi"**dir. Yoxlayan tərəf bu ikisini istifadəçiyə fərqli göstərməlidir.
"Diplom saxtadır" ilə "hazırda yoxlaya bilmirəm" arasındakı fərq bir insanın işə
götürülüb-götürülməməsidir.

## 7.1 Oflayn yoxlama

Ş3(a) sayəsində oflayn yoxlama mümkündür: `vct#integrity` dokumentin
məzmununu unikal şəkildə müəyyən etdiyi üçün keş müddətsiz etibarlıdır və HTTP
keş direktivlərindən asılı deyil.

Oflayn rejimdə **Ş2 və Ş7 yerinə yetirilə bilməz** (zəncirin oxunması tələb olunur). Bu halda
yoxlayan tərəf son məlum zəncir vəziyyətinin aktuallığını (`blockNumber`, `timestamp`)
istifadəçiyə göstərməyə borcludur.

---

# 8. Çoxdillilik

## 8.1 `LangString` strukturu

İstifadəçiyə göstəriləcək hər mətn sahəsi `LangString`-dir:

```json
"qualification_title": {
  "tr-TR": "Bilgisayar Mühendisliği",
  "en-US": "Computer Engineering"
}
```

JSON Schema tərifi (kök tipdə, təkrar istifadə olunur):

```json
"LangString": {
  "type": "object",
  "propertyNames": { "pattern": "^[a-z]{2}(-[A-Z]{2})?$" },
  "additionalProperties": { "type": "string", "minLength": 1 },
  "minProperties": 1
}
```

## 8.2 Qaydalar

1. **Əvvəldən qoyulur.** Sahəni sadə `string` edib sonra `LangString`-ə çevirmək
   uyğunluğu pozan MAJOR versiya dəyişikliyidir. İstifadəçiyə göstəriləcək hər sahə birbaşa
   `LangString` kimi yaranır.
2. **Kod sahələri `LangString` deyil.** `eqf_level`, `isced_f_code`,
   `awarding_date` təkqiymətlidir; tərcümə edilmir.
3. **Ən azı bir dil məcburidir.** Sənədi verən qurum həmişə qurumun rəsmi dilini doldurur.
4. **Rəqəmsal cüzdanda göstərilmə ardıcıllığı:** istifadəçinin cihaz dili → `en-US` → mövcud ilk dil.

## 8.3 Kod sahələri niyə əsl əhəmiyyət daşıyır

İşəgötürən `qualification_title` mətnini oxumur; `isced_f_code` və `eqf_level`
sahələrini oxuyur. Mətn insan üçündür, kod maşın üçündür və **tanınmanı
təmin edən koddur.** Almaniyadakı işəgötürən "Kompüter mühəndisliyi" ifadəsini
anlamaq məcburiyyətində deyil; ISCED-F kodunu və EQF səviyyəsini anlayır.

Bu, [[RS-SCHEMA-0001]]-in nəzarət olunan lüğətə verdiyi önəmin praktik ifadəsidir.

---

# 9. Versiyalaşdırma və istifadədən çıxarma

## 9.1 Semver qaydaları

| Dəyişiklik | Versiya | Köhnə sxemin vəziyyəti |
|---|---|---|
| Sahənin silinməsi, tipin dəyişdirilməsi, məcburi sahənin əlavə edilməsi | **MAJOR** | `DEPRECATED` |
| Opsional sahənin əlavə edilməsi, yeni dil, yeni törəmə claim | **MINOR** | `ACTIVE` qalır |
| Təsvir/etiket düzəlişi (məna dəyişmir) | **PATCH** | `ACTIVE` qalır |

Hər versiya **yeni URL, yeni `schemaId`, yeni zəncir qeydi** deməkdir. Dərc edilmiş
URL-in məzmunu heç vaxt dəyişmir.

## 9.2 Üç vəziyyət və onların mənası

| Vəziyyət | Yeni rəqəmsal sənədin verilməsi | Mövcud sənədlərin yoxlanılması |
|---|---|---|
| `ACTIVE` | ✓ | ✓ |
| `DEPRECATED` | ✗ | **✓ — davam edir** |
| `REVOKED` | ✗ | ✗ (xüsusi prosedur) |

**Kritik:** `DEPRECATED` "artıq verilə bilməz" deməkdir; "artıq yoxlanıla bilməz"
demək **deyil.** 2027-ci ildə `1.0.0` ilə verilmiş diplom 2035-ci ildə `3.0.0`
qüvvədə olarkən hələ də yoxlanıla bilən olmalıdır. Diplomun ömrü sxem
versiyasının ömründən uzundur.

Buna görə:
- `DEPRECATED` sxemlərin dokumentləri **CDN-dən heç vaxt silinmir.**
- Zəncir qeydi **silinmir.**
- `supersededBy` sahəsi yoxlayan tərəfə "bu rəqəmsal sənəd köhnə versiyadır, aktual qarşılığı budur"
  deməyə imkan verir.

`REVOKED` istisna haldır: sxemin özünün xətalı və ya təhlükəli olduğu
hallarda tətbiq olunur (məsələn, səhvən `sd: never` kimi işarələnmiş şəxsiyyət nömrəsi
sahəsi). Həmin sxemlə verilmiş rəqəmsal sənədlərə ayrıca baxılır və sənədi verən qurumlar sənədləri yenidən
verməyə yönləndirilir.

## 9.3 Keçid dövrü

MAJOR versiya dərc edildikdə köhnə versiya **ən azı 24 ay** `ACTIVE` qalır. Bu müddət
ərzində sənədi verən qurumlar iki versiyanı paralel verə bilər. Müddət bitdikdə köhnə versiya
`DEPRECATED` olur.

---

# 10. Hostinq və istismar

## 10.1 Komponentin xüsusiyyətləri

`schemas.tamga.network` **statik fayl xidmətidir.** Tətbiq serveri
deyil; verilənlər bazası yoxdur, dinamik məzmun yaratmır. Yeganə istisna `/v1/resolve`
son nöqtəsidir və o da yalnız yönləndirmə edir.

| Xüsusiyyət | Dəyər |
|---|---|
| Məzmun | Statik JSON |
| Keş | `Cache-Control: public, max-age=31536000, immutable` |
| TLS | Məcburi, HSTS |
| DNSSEC | Məcburi |
| Əlçatanlıq hədəfi | 99,9% (yoxlamanı dayandırmır, §10.2) |
| Mənbə | Git repo — hər dərc bir commit-dir |

## 10.2 Fasilənin təsiri

Sxem serverində fasilə yaranması:

- **Yoxlamanı dayandırmır.** Keşdəki sxemlərlə davam edilir (§7.1).
- **Yeni tiplərin öyrənilməsini dayandırır.** Əvvəllər görülməmiş `vct` həll edilə bilməz.
- **Yeni rəqəmsal sənəd verilməsinə təsir etmir.** Sənədi verən qurum öz sxemini lokal saxlayır.

Buna görə SLO kritik yol komponentlərinə nisbətən daha yumşaq ola bilər. Ətraflı məlumat
[[ARCH-0004]]-də.

## 10.3 Domen riski

`schemas.tamga.network` domeninin itirilməsi **bütün ekosistemə təsir edən hadisədir** — keçmişə
aid bütün `vct` dəyərləri həll edilə bilməz hala düşür. Riskin azaldılması:

1. Domen qurumun (fondun) mülkiyyətindədir, kilid (registrar lock) aktivdir.
2. DNSSEC.
3. Bütün sxemlərin git repozitoriyası güzgü kimi bir neçə yerdə saxlanılır.
4. Dövlət mərhələsində üzv dövlətlərin güzgü serverləri (`/v1/resolve` ilə uyğun).
5. Təhvil planı: fond ləğv olunarsa, domenin şuraya keçməsi
   [[PM-GOV-0001]]-də müqavilə ilə təsbit edilir.

---

# 11. Dəyişməzlər (Invariants)

Bunlar CI-da və kontraktda məcburi şəkildə tətbiq olunur. Pozuntu = dərc bloklanır.

| # | Dəyişməz |
|---|---|
| **D1** | Dərc edilmiş Type Metadata / JSON Schema faylının (`metadata_url`) məzmunu heç vaxt dəyişmir; minor/patch yeni `metadata_url` + hash, major yeni `vct` URN-i deməkdir ([[ADR-0010]] K7). |
| **D2** | `contentHash` (zəncir) = `vct#integrity` (rəqəmsal sənəd) = SHA-256(dərc edilən baytlar). |
| **D3** | Type Metadata daxilindəki `vct` rəqəmsal sənəddəki `vct` ilə eyni olmalıdır. |
| **D4** | Kök tipdən başqa hər tipdə `extends` + `extends#integrity` mövcuddur. |
| **D5** | `extends` zənciri dövrsüzdür və ən çoxu 5 səviyyədən ibarətdir. |
| **D6** | Heç bir fərdi məlumat sahəsi `sd: "never"` ola bilməz. |
| **D7** | Hər NETWORK sxemi ən azı `tr-TR` və `en-US` `display` daşıyır. |
| **D8** | Zəncir qeydi CDN-də dərcdən sonra aparılır (§6 ardıcıllıq qaydası). |
| **D9** | `isAuthorizedForSchema` üçün defolt dəyər `false`-dir (allowlist). |

---

# Təhlükəsizlik və məxfilik qeydləri

**Sxem serveri izləmə səthidir.** Rəqəmsal cüzdan və ya yoxlayan tərəf sxemi hər
dəfə serverdən yükləsə, server "kim hansı tip rəqəmsal sənədi nə vaxt gördü"
məlumatını toplayır. Riskin azaldılması:

1. Müddətsiz keşləmə (§7.1) — normal iş rejimində sorğu göndərilmir.
2. Rəqəmsal cüzdanlar istifadəçinin sahib olduğu tipləri istifadə anında deyil,
   **quraşdırma zamanı toplu şəkildə** yükləyir.
3. Server **giriş loqlarını saxlamır** — yalnız ümumi sayğac. Bu, siyasət
   öhdəliyidir və [[PM-GOV-0001]]-də yazılmalıdır.

**Sxem fərdi məlumatlar ehtiva etmir.** Sxem *tərifdir*, məlumat deyil. Buna baxmayaraq,
`display` mətnlərində qurum adı keçə bilər; bu, ictimai məlumatdır və problem
deyil.

**D6 niyə kritikdir:** `sd: "never"` ilə işarələnmiş sahə [[t:selective-disclosure]]-a
daxil edilir, yəni **hər təqdimatda görünür.** Şəxsiyyət nömrəsini səhvən
`never` etmək o deməkdir ki, həmin sxemlə verilmiş bütün rəqəmsal sənədlərdə şəxsiyyət nömrəsi hər
yoxlayan tərəfə ötürülür. Bu geri qaytarıla bilməz; yalnız `REVOKED` + sənədlərin yenidən verilməsi
ilə düzəlir. Buna görə D6 həm CI-da, həm də insan tərəfindən nəzərdən keçirmə zamanı yoxlanılmalıdır.

---

# Açıq məsələlər

1. `/v1/resolve` son nöqtəsinin güzgü serverlərlə uyğunluğu necə təmin edilir?
   (dövlət mərhələsi, üzv dövlətlərin güzgüləri)
2. Sxem istifadəsi statistikası hansı detallılıqla toplanır — məxfilik
   həddi nədir? → [[PM-GOV-0001]]
3. NATIONAL sxem sonradan NETWORK səviyyəsinə "yüksəldilə" bilərmi? Təklif: xeyr,
   yeni NETWORK sxemi yazılır və NATIONAL sxem `supersededBy` vasitəsilə ona
   istinad edir. Qərar gözlənilir.
4. `extends` zəncirində üst tip `DEPRECATED` olarsa, alt tipə nə olur?
   Təklif: alt tip avtomatik olaraq `DEPRECATED` olmur, lakin CI xəbərdarlıq verir.

---

# Əlaqəli sənədlər

[[ADR-0007]] · [[PM-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-BC-0001]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-ID-0002]] ·
[[ADR-0008]] · [[ARCH-0004]] · [[ARCH-0005]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

