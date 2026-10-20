---
document_id: ADR-0007
title: "Sxem reyestri"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Tamga sxem reyestrinin arxitekturasını müəyyənləşdirir. Yeddi qərar: (1) vct = sabit HTTPS URL, schema.tamga.network altında; (2) sxem dokumenti off-chain, SD-JWT VC Type Metadata + JSON Schema 2020-12 kimi; (3) vct#integrity məcburidir; (4) SchemaRegistry kontraktı yalnız lövbər saxlayır (URI + hash + versiya + status); (5) iki səviyyəli sxem sahəsi — NETWORK (2/3 səs) və NATIONAL (onlyOwnerState); (6) sənədi verən qurum↔sxem səlahiyyəti zəncirdədir və yoxlayan tərəfin yoxlamasında məcburi addımdır; (7) semver + dəyişməz URL + extends ilə versiyalaşdırma. Rədd edilmiş alternativlər və məcburi nəticələr qeydə alınıb.
domain: Credentials
translation_of: ADR-0007
source_version: "1.0.0"
---

# ADR-0007 — Sxem Reyestrinin Arxitekturası

**Status: Accepted** ✅ (2026-09-09)

---

# Kontekst

[[PM-SCHEMA-0001]] üç zəifliyi qeydə aldı: kateqoriya həddinin aşılması (təhsil [[t:issuer|sənədi verən qurumun]]
səhiyyə sənədini imzalaya bilməsi), məna parçalanması (hər sənədi verən qurumun öz sahə
adlarından istifadə etməsi) və həddən artıq məlumat tələbinə nəzarətin əsassız qalması. Hər üçünün
mənbəyi eynidir: şəbəkənin **sxem reyestri yox idi.**

[[ADR-0006]] [[t:credential]] formatını **[[t:SD-JWT-VC]]** kimi təsbit etdi. SD-JWT VC-də
sənəd tipini `vct` claim-i ([[t:vct]]) daşıyır və tipin mənası **Type Metadata**
dokumenti ilə müəyyən edilir. Deməli, sxem reyestri abstrakt arxitektura seçimi deyil,
seçilmiş formatın birbaşa tələb etdiyi komponentdir.

Standart tərəfi (draft-ietf-oauth-sd-jwt-vc-19) Type Metadata-nın
əldə edilməsi üçün bir neçə yol müəyyən edir: `vct` daxilindəki URL-dən,
**registry**-dən, ekosistemin müəyyən etdiyi metoddan və ya lokal keşdən.
Registry yolunda consumer-in həmin reyestrə etibar etməli olduğu açıq şəkildə
göstərilir. Bundan əlavə, `vct#integrity` claim-i Type Metadata dokumentinin
bütövlüyünü qoruyan integrity metadata sətrini daşıyır; `extends` və
`extends#integrity` ilə tip iyerarxiyası qurula bilər; sxemin özü Type
Metadata-nın `schema` və ya `schema_uri` parametrində, **JSON Schema 2020-12**
versiyasına uyğun olaraq daşınır.

Yəni quracağımız strukturun çərçivəsi standartda hazır durur. Qərar
verilməli olan məsələ bu çərçivənin Tamga-ya necə uyğunlaşdırılacağıdır.

---

# Qərar

## Qərar 1 — `vct` sabit HTTPS URL-dir

Tamga sənədlərində `vct` `schema.tamga.network` domeni altında sabit
HTTPS URL-dir. URN, sərbəst sətir və ya quruma xas identifikator **istifadə edilmir.**

```
https://schema.tamga.network/v1/edu/DiplomaCredential/1.0.0
https://schema.tamga.network/v1/tr/edu/YOKDenklikCredential/1.0.0
```

**Əsaslandırma:** HTTPS URL-də tip həm identifikator, həm də əldə edilə bilən ünvandır.
Tamga-nı heç tanımayan [[t:verifier]] belə URL-i açıb nə olduğunu görə bilər. URN
seçsəydik, əldə etmək üçün Tamga-ya xas xidməti bilmək məcburi olardı — bu da
şəbəkədən kənara açılmağı çətinləşdirər.

## Qərar 2 — Sxem dokumenti off-chain, Type Metadata + JSON Schema kimi

Hər `vct` ünvanında **SD-JWT VC Type Metadata** dokumenti dərc edilir. Sxem
Type Metadata-nın `schema_uri` parametri vasitəsilə **JSON Schema 2020-12**
dokumentinə istinad edir.

Təqdim olunma üsulu: statik fayl, CDN arxasında, dəyişməz URL. Sxem serveri
tətbiq serveri deyil; verilənlər bazasına sorğu göndərmir, dinamik məzmun
yaratmır.

**Əsaslandırma:** [[PM-SCHEMA-0001]] B variantında qeydə alındı — sxemi zəncirə yazmaq
baha başa gəlir, dəyişməzliyi yanlış yerə qoyur, çoxdillilikdə xərci qat-qat artırır və sxemin
oxunmasını RPC node-dan asılı edir. Sxemin oxunması şəbəkədə ən tez-tez icra olunan əməliyyatdır;
onun CDN-dən təqdim edilməsi düzgün arxitekturadır.

## Qərar 3 — `vct#integrity` məcburidir

Hər Tamga sənədi `vct` claim-i ilə yanaşı `vct#integrity` claim-ini daşıyır.
Uyğun Tamga yoxlayan tərəfi integrity dəyəri olmayan Type Metadata-dan
**istifadə etmir.**

**Əsaslandırma:** Qərar 2-nin təbii bədəli sxem dokumentinin HTTP serverində
yerləşməsidir. Həmin server ələ keçirilərsə, sxem xəbərsiz dəyişdirilə bilər — məsələn,
`eqf_level` sahəsinin mənası sürüşdürülə bilər. `vct#integrity` sənədin
imzası daxilində daşındığı üçün bu hücumun qarşısını alır: sənədi verən qurum sənədi
imzalayarkən hansı sxemi nəzərdə tutduğunu kriptoqrafik olaraq sabitləmiş olur.

Bu, həm də **müddətsiz keşləməni** mümkün edir: integrity dəyəri
dokumentin məzmununu unikal şəkildə müəyyən etdiyi üçün keş bu dəyərlə
açarlanır və HTTP keş direktivlərindən asılı olmayaraq istifadə oluna bilər.
Rəqəmsal cüzdanın oflayn işləyə bilməsi bu xüsusiyyətə əsaslanır.

## Qərar 4 — `SchemaRegistry` kontraktı yalnız lövbər saxlayır

Zəncirə yazılan qeyd:

```
schemaId      = keccak256(vctURI)
vctURI        string
contentHash   bytes32     // hash of the Type Metadata document
version       string      // semver
tier          {NETWORK, NATIONAL}
stateCode     bytes2      // owning state if NATIONAL, 0x0000 if NETWORK
status        {ACTIVE, DEPRECATED, REVOKED}
validFrom     uint64
supersededBy  bytes32     // points to the new version (optional)
```

Sxemin **məzmunu** zəncirdə deyil. `contentHash` `vct#integrity` ilə eyni
dokumenti bağlayır.

**Əsaslandırma:** Zəncirin vəzifəsi istinad və səlahiyyət saxlamaqdır, məzmun saxlamaq deyil —
[[PM-TRUST-0001]]-in fərdi məlumatlar üçün qoyduğu prinsipin böyük və dəyişən məzmun
üçün də keçərli olan forması.

## Qərar 5 — İki səviyyəli sxem sahəsi: NETWORK və NATIONAL

| Səviyyə | URL şablonu | Kim qeydiyyata alır | İdarəetmə |
|---|---|---|---|
| **NETWORK** | `/v1/<domain>/<Type>/<ver>` | Şəbəkə | 2/3 səs ([[ADR-0002]] Səviyyə 1) |
| **NATIONAL** | `/v1/<ülke>/<domain>/<Type>/<ver>` | Tək dövlət | `onlyOwnerState`, səsvermə yoxdur |

Prinsip: **sərhədlərarası məna daşımalı olan sxemlər NETWORK, milli hüquqa xas
olanlar NATIONAL.**

Dövlət NATIONAL sxemini heç kimdən soruşmadan qeydiyyata alır və heç kim buna mane ola bilməz.
Başqa dövlətin yoxlayan tərəfinin həmin sxemi tanımaq öhdəliyi də yoxdur —
cross-recognition məntiqinin sxem səviyyəsindəki qarşılığı.

**Əsaslandırma:** [[ADR-0002]] suverenlik prinsipi ilə şəbəkə effekti arasındakı gərginliyin
həlli. Hər sxemi səsverməyə bağlamaq suverenliyi pozur; heç birini bağlamamaq isə məna
parçalanmasını dövlət miqyasında geri qaytarır.

## Qərar 6 — Sənədi verən qurum ↔ sxem səlahiyyəti zəncirdədir və yoxlamada məcburi addımdır

`IssuerRegistry` hər sənədi verən qurum üçün icazə verilən `schemaId` çoxluğunu saxlayır.

Yoxlayan tərəfin yoxlama zəncirinə yeni normativ addım əlavə edilir:

> **Addım N:** Sənədin `vct`-sindən törədilən `schemaId` sənədi verən qurumun icazəli
> sxem çoxluğundadırmı? Deyilsə, sənəd **rədd edilir.**

Bu addım buraxıla bilməz. [[PM-SCHEMA-0001]] Zəiflik 1 (kateqoriya həddinin aşılması) məhz
bu addımla aradan qalxır: `EDUCATION` kateqoriyalı universitet səhiyyə sxeminə
səlahiyyətləndirilmədiyi üçün həmin sənədi imzalasa belə, heç bir uyğun yoxlayan tərəf onu qəbul
etməz.

**Səlahiyyət kimdədir:** Sənədi verən qurumu hansı dövlət qeydiyyata alıbsa, sxem səlahiyyətini də həmin
dövlət verir (`onlyOwnerState`). Faza 0-da bu rolu fond icra edir.

## Qərar 7 — Versiyalaşdırma: semver, dəyişməz URL, `extends`

- Versiya **semver**-dir və **URL-in bir hissəsidir**. `1.0.0` dərc edildikdən sonra həmin
  URL-in məzmunu **heç vaxt dəyişmir.**
- **MAJOR** — uyğunluğu pozan dəyişiklik (sahənin silinməsi, tipin dəyişdirilməsi, məcburi sahənin
  əlavə edilməsi) → yeni URL, yeni `schemaId`, yeni zəncir qeydi.
- **MINOR** — geriyə uyğun əlavə (opsional sahə, yeni dil) → yeni URL, köhnə versiya
  `DEPRECATED` deyil, `ACTIVE` qalır.
- **PATCH** — yalnız təsvir/mətn düzəlişi, məna dəyişmir → yeni URL;
  köhnə versiya qüvvəsini saxlayır.
- Tip iyerarxiyası **`extends`** ilə qurulur; `extends#integrity` məcburidir.
  Nümunə: `DiplomaCredential` → `extends` → `TamgaBaseCredential` (ortaq sahələr:
  `iss`, `vct`, `cnf`, `status`, dil etiketləmə qaydası).

**Kritik nəticə — köhnə sənədlər yaşamağa davam edir.** 2027-ci ildə `1.0.0` ilə
verilmiş diplom 2031-ci ildə `2.0.0` dərc edildikdə hələ də yoxlana bilən olmalıdır.
Diplomun ömrü sxem versiyasından uzundur. Buna görə `DEPRECATED`
statusu "artıq **verilə bilməz**" deməkdir, "artıq **yoxlana bilməz**" demək deyil.
`REVOKED` isə sxemin səhv/təhlükəli olduğu istisna haldır və həmin sxemlə
verilmiş sənədlərə ayrıca baxılır.

---

# Əsaslandırma (Xülasə)

Qərarlar xətti üç prinsipə əsaslanır:

1. **Standarta əməl et, icad etmə.** SD-JWT VC Type Metadata + JSON Schema
   2020-12 + registry yolu standartın özünün nəzərdə tutduğu strukturdur.
2. **Zəncir istinad saxlayır, məzmun saxlamır.** [[PM-TRUST-0001]]-in genişləndirilmiş
   tətbiqi.
3. **Suverenlik kod səviyyəsində.** [[ADR-0002]]-nin sxem səviyyəsinə köçürülməsi —
   NETWORK/NATIONAL ayrımı və `onlyOwnerState`.

---

# Nəzərdən keçirilmiş alternativlər

| Alternativ | Niyə rədd edildi |
|---|---|
| Sxem reyestri yoxdur, `vct` sərbəstdir | Zəiflik 1-2-3 açıq qalır; yoxlayan tərəf öz funksiyasını itirir |
| Sxemin tamamilə zəncirdə olması | Xərc, dəyişməzlik yanlış yerdə, çoxdillilik, CDN itkisi |
| EBSI Trusted Schemas Registry-yə qoşulmaq | [[ADR-0002]] suverenlik prinsipi ilə ziddiyyət təşkil edir |
| `vct` = URN + xüsusi resolver | Şəbəkədən kənara açılmağı çətinləşdirir |
| Versiyanı URL-dən kənarda saxlamaq (`?v=`) | Dəyişməz keşləmə və integrity pozulur |

Ətraflı əsaslandırma [[PM-SCHEMA-0001]]-dədir.

---

# Nəticələr

## Məcburi (implementasiyaya məhdudiyyət)

1. `contracts/src/schema/SchemaRegistry.sol` **yazılacaq.**
2. `IssuerRegistry.sol`-a **icazəli sxem çoxluğu** sahəsi və
   `isAuthorizedForSchema(issuerId, schemaId)` sorğusu əlavə ediləcək.
   > **2026-09-09 review qeydi:** Bu sorğu **sənədin verilməsi** üçündür. Yoxlama
   > zamandan asılı `isCredentialSchemaAcceptable(issuerId, schemaId, iat)`
   > istifadə edir — əks halda `DEPRECATED` sxemlə verilmiş köhnə sənədlər
   > rədd edilir və Qərar 7-nin "köhnə sənədlər yaşamağa davam edir" prinsipi
   > pozulur. Bax: [[SPEC-BC-0001]] 2.1.0 §3.4.
3. [[SPEC-BC-0001]] yenidən yazılarkən `SchemaRegistry` kanonik interfeysi
   müəyyən ediləcək.
4. Yoxlayan tərəfin yoxlama alqoritminə **sxem səlahiyyəti addımı** normativ olaraq
   daxil ediləcək ([[SPEC-API-0001]]).
5. Bütün Tamga sənədləri `vct` **və** `vct#integrity` daşıyacaq —
   [[SPEC-CRED-0002]] bunu məcburi sahə kimi yazacaq.
6. `schema.tamga.network` istismar olunan komponentdir; [[ARCH-0004]] server
   inventarına daxil edilir (statik + CDN, ayrıca uptime hədəfi).
7. `@tamga-network/schemas` paketi sxemləri və validatoru daşıyacaq
   ([[ARCH-0005]]).

## Əməliyyat

- Yeni NETWORK sxeminin əlavə edilməsi 2/3 səs tələb edir — bu, yavaşdır və qəbul edilib.
  Faza 0-da fond bunu təkbaşına icra edir.
- Sxem serverində fasilə **yoxlamanı dayandırmır** (integrity ilə
  keşlənmiş sxemdən istifadə oluna bilər), lakin **yeni tiplərin öyrənilməsini** dayandırır.
  SLO buna uyğun müəyyən edilir.

## Qəbul edilmiş risklər

- **Sərtlik.** Qurum xüsusi sahə istədikdə dərhal cavab verə bilməyəcəyik;
  `extends` problemi azaldır, aradan qaldırmır.
- **Domen asılılığı.** `schema.tamga.network` domeninin itirilməsi
  bütün ekosistemə təsir edən hadisədir. Domenin idarə edilməsi, DNSSEC və təhvil planı
  [[ARCH-0004]]-də nəzərdən keçirilməlidir.

---

# Əlaqələr

**Əsaslanır:** [[PM-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[ADR-0002]] · [[ADR-0006]] · [[PM-TRUST-0001]]
**Tətbiq edir:** [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-SCHEMA-0003]]
**Təsir edir:** [[SPEC-BC-0001]] · [[SPEC-CRED-0002]] · [[SPEC-API-0001]] · [[ARCH-0004]] · [[ARCH-0005]]
**Qardaş qərar:** [[ADR-0008]] ([[t:status-list]] yerləşdirilməsi — eyni "off-chain məzmun + on-chain lövbər" nümunəsi)

---

# Status

**Accepted** ✅ — 2026-09-09. [[DECISIONS]]-a `D-SCHEMA-1` kimi daxil ediləcək.
