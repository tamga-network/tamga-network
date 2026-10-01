---
document_id: SPEC-SCHEMA-0001
title: Şema Kayıt Defteri — schemas.tamga.network Mimarisi ve SchemaRegistry Kontratı
category: Specification
domain: Schema
status: Active
review_status: Draft
version: 2.0.0
created: 2026-09-09
last_updated: 2026-09-24
authors:
  - Tamga Network Engineering
language: tr
document_type: specification
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - schema
  - registry
  - vct
  - type-metadata
  - json-schema
  - integrity
keywords:
  - schemas.tamga.network URL scheme
  - SD-JWT VC Type Metadata document
  - vct#integrity subresource integrity sha256
  - JSON Schema 2020-12
  - SchemaRegistry Solidity interface
  - issuer schema authorization
  - schema publication pipeline
  - offline schema resolution
summary: >
  [[ADR-0007]] kararlarının normatif uygulaması. schemas.tamga.network URL şemasını
  ve isim alanlarını, her vct adresinde yayınlanan SD-JWT VC Type Metadata
  dokümanının yapısını, vct#integrity değerinin nasıl hesaplandığını, kök tip
  TamgaBaseCredential'ı, SchemaRegistry ve IssuerRegistry kontrat arayüzlerini,
  şema yayın hattını (repo → CI → hash → CDN → zincir), verifier tarafındaki
  altı adımlı çözümleme algoritmasını, sürümleme ve emeklilik kurallarını,
  çok dilli alan yapısını ve dokuz değişmezi tanımlar.
priority: Critical
related:
  - ADR-0007
  - PM-SCHEMA-0001
  - RS-SCHEMA-0001
  - SPEC-SCHEMA-0002
  - SPEC-BC-0001
  - SPEC-CRED-0001
  - SPEC-ID-0002
depends_on:
  - ADR-0007
  - ADR-0006
adrs:
  - ADR-0007
---
> **Sürüm notu 2.0.0 (2026-09-24) — ADR-0009 / ADR-0010 senkronu (DECISIONS §10.7):** `vct` HTTPS URL yerine **URN** (`urn:tamga:<domain>:<Type>:<major>`); Type Metadata **katalogdan** çözülür; `schema.` alan adı `schemas.` oldu (D-NAME-1); D1 metni `metadata_url` üzerinden yeniden ifade edildi; §1 URL'leri artık `metadata_url`/`schema_uri`'dir. D-SCHEMA-1 süpersede → D-SCHEMA-4. Faz B okuması: 'zincir kaydı' = `lotl.schemas[]` + çapa günlüğü ([[ADR-0009]] K3, D8).


# Kapsam

Bu spesifikasyon, Tamga şema kayıt defterinin **teknik olarak nasıl çalıştığını**
tanımlar. Kararlar ve gerekçeler [[ADR-0007]] ve [[PM-SCHEMA-0001]]'dedir;
burada tekrar edilmez.

Kapsam dışı: tekil şemaların içeriği ([[SPEC-SCHEMA-0002]] eğitim,
[[SPEC-SCHEMA-0003]] diğer sektörler).

**Standart temeli:** SD-JWT VC (draft-ietf-oauth-sd-jwt-vc-19) Type Metadata
bölümü; JSON Schema draft 2020-12; W3C Subresource Integrity (integrity
metadata dize biçimi).

---

# 1. URL Şeması ve İsim Alanları

## 1.1 Genel biçim

> **Geliştirme evresi (2026-09-30, [[ADR-0029]]):** beta yayınına kadar şemalar aynı sürüm yolunda yerinde düzeltilir; D1 ve küçük sürüm kuralı beta (`SCHEMA_STAGE = "stable"`) ile uygulanır. Katalog ve `lotl.schemas[]` girdisi `content_hashes` alanını taşır; doğrulayıcı (B4) ve cüzdan belgenin `vct#integrity`'sini bu listede arar. Geliştirme evresinde listede yalnız güncel özet vardır.

> **ADR-0010 (D-SCHEMA-4):** Tip **kimliği** artık `vct = urn:tamga:<domain>:<Type>:<major>` (Faz 1 devlet-özel `urn:tamga:<cc>:<domain>:<Type>:<major>`), `schemaId = keccak256(vct)`. Aşağıdaki HTTPS yolları kimlik değil, **`metadata_url` / `schema_uri`** (barındırma adresi; katalog `schemas.tamga.network/v1/catalogue.json` `vct → metadata_url + content_hash` verir, IETF SD-JWT VC-19 §5.3.2 registry yolu). `vct#integrity` zorunludur (ETSI TS 119 472-1). Alan adı değişse kimlik değişmez (D-NAME-1).

```
NETWORK katmanı:
https://schemas.tamga.network/v1/<domain>/<TypeName>/<semver>

NATIONAL katmanı:
https://schemas.tamga.network/v1/<cc>/<domain>/<TypeName>/<semver>
```

- `v1` — **registry protokol sürümü**, şema sürümü değil. Type Metadata
  dokümanının yapısı değişirse `v2` olur. Bugüne kadar `v1`.
- `<cc>` — ISO 3166-1 alpha-2, **küçük harf** (`tr`, `az`, `kz`, `uz`, `kg`).
  Yalnızca NATIONAL katmanda bulunur.
- `<domain>` — kapalı liste (§1.2).
- `<TypeName>` — PascalCase, `Credential` ile biter.
- `<semver>` — `MAJOR.MINOR.PATCH`, üç parça zorunlu.

Örnekler:

```
urn:tamga:edu:DiplomaCredential:1
urn:tamga:edu:StudentCredential:1
urn:tamga:core:TamgaBaseCredential:1
https://schemas.tamga.network/v1/tr/edu/YOKDenklikCredential/1.0.0
```

## 1.2 Domain listesi (kapalı)

| Domain | Kapsam | Faz |
|---|---|---|
| `core` | Kök tipler, ortak yapılar | 0 |
| `edu` | Eğitim ve yeterlilik | **0** |
| `org` | Tüzel kişilik, çalışan yetkisi | 0 (iskelet) |
| `id` | Kimlik, ikamet | 1 |
| `health` | Sağlık | 2 |
| `fin` | Finans | 2 |
| `log` | Lojistik, ticaret | 2 |
| `travel` | Seyahat, turizm | 2 |

Yeni domain eklemek NETWORK kararıdır (2/3 oy). NATIONAL şemalar mevcut domain
listesini kullanır; kendi domain'ini icat edemez.

## 1.3 Her URL'in döndürdüğü içerik

| Yol | İçerik | `Content-Type` |
|---|---|---|
| `.../<semver>` | Type Metadata dokümanı | `application/json` |
| `.../<semver>/schema.json` | JSON Schema 2020-12 | `application/schema+json` |
| `.../<semver>/mapping.json` | ELM/OBv3 eşleme tablosu (bilgilendirici) | `application/json` |

Type Metadata'nın kendisi `vct` URL'inde durur. Bu, standardın "URL'deki
`vct`'den al" yolunu ([[ADR-0007]] Karar 1) doğrudan çalıştırır.

## 1.4 Çözümlenebilirlik ve registry yolu

`vct` bir HTTPS URL olduğu için birincil çözümleme yolu doğrudan `GET`'tir.
Buna ek olarak registry, standardın "registry'den al" yolunu da destekler:

```
GET https://schemas.tamga.network/v1/resolve?vct=<url-encoded-vct>
```

Bu uç, ağ dışı consumer'lar ve `vct`'ye doğrudan erişemeyen istemciler
içindir. Aynı dokümanı, aynı baytlarla döndürür — aksi hâlde integrity kırılır.

---

# 2. Type Metadata Dokümanı

## 2.1 Yapı

Her `vct` adresinde yayınlanan doküman:

```json
{
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "name": "Tamga Diploma Credential",
  "description": "Bir yükseköğretim kurumunun verdiği mezuniyet belgesi.",

  "extends": "urn:tamga:core:TamgaBaseCredential:1",
  "extends#integrity": "sha256-Yr9k...",

  "schema_uri": "https://schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0/schema.json",
  "schema_uri#integrity": "sha256-3Qm2...",

  "display": [ /* §2.2 */ ],
  "claims":  [ /* §2.3 */ ],

  "tamga": { /* §2.4 — ekosistem uzantısı */ }
}
```

Kurallar:

- `schema` (gömülü) **kullanılmaz**; her zaman `schema_uri` kullanılır. Gerekçe:
  Type Metadata dokümanını küçük tutmak, şemayı ayrı önbelleklenebilir kılmak.
- `schema_uri#integrity` **zorunludur.**
- Kök tip (`TamgaBaseCredential`) dışında her tipte `extends` +
  `extends#integrity` **zorunludur.**
- Tanınmayan üst düzey özellikler consumer tarafından **yok sayılır** —
  standardın gereği. `tamga` uzantı bloğu bu sayede güvenlidir.

## 2.2 `display` — dil bazlı sunum

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

**Asgari dil seti:** `tr-TR` ve `en-US` her NETWORK şemasında **zorunludur.**
Diğer üye devlet dilleri o devlet katıldığında eklenir (MINOR sürüm).

NATIONAL şemalarda yalnızca sahibi devletin dili + `en-US` zorunludur.

## 2.3 `claims` — alan bazlı sunum ve ifşa politikası

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

`sd` değerleri ve Tamga'daki anlamları:

| Değer | Anlam | Tamga kullanımı |
|---|---|---|
| `always` | Claim **zorunlu olarak** seçici-açıklanabilir olmalı | Hassas alanlar (kimlik no, doğum tarihi) |
| `allowed` | Issuer seçebilir | Varsayılan |
| `never` | Seçici-açıklanabilir **olamaz**, her zaman görünür | `iss`, `vct`, `cnf`, `status`, `iat` |

**Tamga kuralı:** `sd: "never"` yalnızca protokol claim'lerinde kullanılır.
Hiçbir **kişisel veri** alanı `never` olamaz. Bu, §11 değişmezlerinde
zorlanır.

## 2.4 `tamga` uzantı bloğu

Standartta olmayan, Tamga'ya özgü meta veri:

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

| Alan | Anlam |
|---|---|
| `tier` | `NETWORK` \| `NATIONAL` ([[ADR-0007]] Karar 5) |
| `schemaId` | Zincirdeki `keccak256(vctURI)` — çapraz kontrol |
| `issuer_categories` | Bu şemayı hangi `IssuerCategory` kullanabilir |
| `default_ttl_days` | **Azami** `exp` süresi (tavan, sabit değil); `null` = uzun ömürlü |
| `uses_status_list` | `false` ise kısa ömürlü, iptal listesi yok ([[ADR-0008]] Alt. C) |
| `min_issuer_assurance` | Asgari issuer seviyesi ([[PM-ASSUR-0001]] I1–I3) |
| `derived_claims` | `age_over_NN` deseni türevleri ([[RS-SCHEMA-0001]] §4) |
| `elm_profile` | Hangi ELM sürümüne/profiline eşlenmiş |
| `status` | `ACTIVE` \| `DEPRECATED` \| `REVOKED` — zincirle tutarlı |

`issuer_categories` alanı **bilgilendiricidir**; bağlayıcı kontrol zincirdedir
(§5.2). Doküman ile zincir çelişirse **zincir kazanır.**

---

# 3. Integrity Metadata Üretimi

## 3.1 Biçim

W3C Subresource Integrity dize biçimi:

```
sha256-<base64(SHA-256(dokümanın ham baytları))>
```

Örnek: `sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=`

## 3.2 Hesaplama kuralları (normatif)

1. Hash, sunucunun döndürdüğü **ham bayt dizisi** üzerinden hesaplanır. JSON
   yeniden serileştirilmez, boşluk normalize edilmez.
2. Bu yüzden yayınlanan dosya **bayt bayt değişmezdir.** CDN veya proxy'nin
   yeniden biçimlendirme yapmasına izin verilmez.
3. Dosyalar **LF** satır sonu, **UTF-8, BOM'suz** yazılır.
4. Sondaki yeni satır karakteri dosyanın parçasıdır ve hash'e dahildir.

```bash
# Referans hesaplama
printf 'sha256-%s\n' "$(openssl dgst -sha256 -binary dosya.json | openssl base64 -A)"
```

## 3.3 Nerede kullanılır

| Değer | Nerede | Zorunlu mu |
|---|---|---|
| `vct#integrity` | Credential'ın kendi payload'ında | **Evet** ([[ADR-0007]] Karar 3) |
| `extends#integrity` | Type Metadata içinde | Evet (kök tip hariç) |
| `schema_uri#integrity` | Type Metadata içinde | Evet |
| `contentHash` | `SchemaRegistry` kontratında | Evet |

`contentHash` = `vct#integrity`'nin işaret ettiği **aynı** dokümanın hash'i,
`bytes32` olarak (base64 değil, ham SHA-256).

**Değişmez:** `contentHash` ile `vct#integrity` aynı baytları temsil eder. Biri
diğerini doğrular; ikisi tutmuyorsa credential reddedilir.

---

# 4. Kök Tip — TamgaBaseCredential

Her Tamga credential'ı, doğrudan veya dolaylı olarak
`core/TamgaBaseCredential`'dan türer.

## 4.1 Zorunlu claim'ler

| Claim | Tip | `sd` | Açıklama |
|---|---|---|---|
| `iss` | string | `never` | Issuer tanımlayıcısı, X.509'a çözülür ([[SPEC-ID-0002]]) |
| `vct` | string (URI) | `never` | Tip URL'i |
| `vct#integrity` | string | `never` | §3 |
| `iat` | number | `never` | İhraç zamanı |
| `cnf` | object | `never` | Holder anahtarı ([[SPEC-CRED-0001]] §3) |

## 4.2 Koşullu claim'ler

| Claim | Ne zaman |
|---|---|
| `exp` | `tamga.default_ttl_days` doluysa **zorunlu**; `exp - iat` o değeri aşamaz |
| `status` | `tamga.uses_status_list = true` ise **zorunlu** ([[ADR-0008]]) |

## 4.3 Ortak yapılar

Kök tip ayrıca yeniden kullanılabilir JSON Schema tanımları taşır:

- `LangString` — çok dilli metin (§8)
- `IssuerRef` — issuer referansı
- `DateOnly` — `YYYY-MM-DD` biçimi

---

# 5. Kontrat Arayüzleri

## 5.1 SchemaRegistry

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface ISchemaRegistry {
    enum Tier   { NETWORK, NATIONAL }
    enum Status { NONE, ACTIVE, DEPRECATED, REVOKED }

    struct SchemaRecord {
        string  vctURI;        // kanonik tip URL'i
        bytes32 contentHash;   // Type Metadata dokümanının SHA-256'sı
        string  version;       // semver, örn. "1.0.0"
        Tier    tier;
        bytes2  stateCode;     // NATIONAL ise sahibi; NETWORK ise 0x0000
        Status  status;
        uint64  validFrom;
        bytes32 supersededBy;  // yeni sürüm; yoksa 0x0
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

    /// @notice NETWORK: yalnızca Governance yürütmesiyle. NATIONAL: onlyOwnerState.
    function registerSchema(SchemaRecord calldata rec) external;

    function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external;
    function revokeSchema(bytes32 schemaId, string calldata reason) external;

    function getSchema(bytes32 schemaId) external view returns (SchemaRecord memory);
    function isActiveSchema(bytes32 schemaId) external view returns (bool);

    /// @notice Doğrulama için: verilen hash zincirdeki kayıtla eşleşiyor mu?
    function matchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool);
}
```

**Yetki kuralları:**

- `tier == NETWORK` → çağrı yalnızca `Governance` kontratının 2/3 oyla
  yürüttüğü bir öneriden gelebilir ([[ADR-0002]] Katman 1).
- `tier == NATIONAL` → `onlyOwnerState(stateCode)` ([[SPEC-BC-0001]] §0).

**Değişmez:** Kayıtlı bir şemanın `vctURI` ve `contentHash` alanları **asla
güncellenmez.** Değişiklik = yeni sürüm = yeni `schemaId`. `deprecateSchema`
ve `revokeSchema` yalnızca `status` alanını değiştirir.

## 5.2 IssuerRegistry — şema yetkisi eklentisi

[[ADR-0007]] Karar 6'nın kontrat karşılığı. Mevcut `IIssuerRegistry`'ye eklenir:

```solidity
interface IIssuerRegistry {
    // ... mevcut üyeler ...

    event SchemaAuthorizationSet(bytes32 indexed issuerId, bytes32 indexed schemaId, bool allowed);

    error SchemaNotAuthorized(bytes32 issuerId, bytes32 schemaId);

    /// @notice Issuer'ı hangi devlet kaydettiyse yetkiyi de o verir (onlyOwnerState).
    function setSchemaAuthorization(bytes32 issuerId, bytes32 schemaId, bool allowed) external;

    /// @notice İHRAÇ anında: "şimdi bu şemayla verebilir mi?"
    function isAuthorizedForSchema(bytes32 issuerId, bytes32 schemaId) external view returns (bool);

    /// @notice DOĞRULAMA anında (ZORUNLU adım): "iat anında yetkili miydi?" — 1.0.1
    function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
        external view returns (bool);

    function authorizedSchemasOf(bytes32 issuerId) external view returns (bytes32[] memory);
}
```

**Uygulama notu:** `isAuthorizedForSchema` şu üç koşulun **hepsini** sağlamalıdır:

1. `issuerId` geçerli ve `canIssue` ✓
2. `schemaId` `ACTIVE` ✓ (`DEPRECATED` ise **yeni ihraç yapılamaz**)
3. `(issuerId, schemaId)` çifti açıkça yetkilendirilmiş ✓

Üçüncü koşul **varsayılan olarak yanlıştır**. Yani yetki açıkça verilmediyse
yoktur — allowlist mantığı, blocklist değil.

---

# 6. Şema Yayın Hattı

Bir şemanın hayata geçmesi altı adımdır ve **sırası bağlayıcıdır:**

```
1. TASARIM     şema kaynak repoda yazılır (schemas/ dizini)
                 ↓
2. DOĞRULAMA   CI: JSON Schema geçerli mi, Type Metadata alanları tam mı,
                    extends zinciri çözülüyor mu, asgari diller var mı,
                    sd:never kişisel veride kullanılmış mı (§11 denetimi)
                 ↓
3. DONDURMA    dosyalar bayt düzeyinde sabitlenir (LF, UTF-8, no-BOM)
                 ↓
4. HASH        CI, contentHash ve tüm #integrity değerlerini hesaplar;
                    Type Metadata içine yazar; tekrar hash alır (iki geçiş)
                 ↓
5. YAYIN       CDN'e değişmez URL'de yüklenir (henüz kimse kullanamaz)
                 ↓
6. KAYIT       registerSchema(...) — NETWORK ise oy sonrası, NATIONAL ise doğrudan
```

**Neden bu sıra:** Zincir kaydı, dokümanın erişilebilir olmasından **sonra**
yapılmalıdır. Ters sırada, zincirde kayıtlı ama çözümlenemeyen bir şema oluşur
ve o şemayla üretilen her credential doğrulanamaz.

**İki geçişli hash (adım 4)** dikkat gerektirir: `schema_uri#integrity` Type
Metadata'nın **içindedir**, dolayısıyla önce şema hash'lenir, Type Metadata'ya
yazılır, sonra Type Metadata hash'lenir. Sıra ters çevrilirse hash asla
tutmaz.

**Geri alma:** Adım 6'dan sonra geri alma yoktur. `revokeSchema` bir ileri
harekettir, silme değildir.

---

# 7. Çözümleme Algoritması (Verifier Tarafı)

Normatif. Herhangi bir adımın başarısızlığı credential'ın **reddedilmesi**
demektir.

```
GİRDİ: SD-JWT VC (issuer-signed JWT + disclosures + KB-JWT)

Ş1. vct ve vct#integrity claim'lerini oku.
    vct yoksa veya vct#integrity yoksa → RED.

Ş2. schemaId = keccak256(bytes(vct))
    SchemaRegistry.getSchema(schemaId)
    Kayıt yoksa → RED (kayıtsız tip).
    status == REVOKED → RED.
    status == DEPRECATED → kabul edilebilir; ancak iat > deprecation zamanı ise RED.

Ş3. Type Metadata'yı al:
    a) Yerel önbellekte vct#integrity anahtarıyla var mı? Varsa kullan.
    b) Yoksa GET <vct>. Başarısızsa /v1/resolve?vct=... dene.
    c) Hiçbiri olmazsa → doğrulama YAPILAMAZ (RED değil, "belirsiz" döndür).

Ş4. Bütünlük:
    SHA-256(alınan baytlar) == vct#integrity  → değilse RED.
    SHA-256(alınan baytlar) == kayıt.contentHash → değilse RED.
    Dokümanın içindeki "vct" alanı == credential'daki vct → değilse RED.

Ş5. extends zincirini çöz (varsa):
    Her adımda extends#integrity doğrula.
    Döngü tespit edilirse → RED. Derinlik > 5 → RED.

Ş6. Şema uyumu:
    schema_uri'yi al, schema_uri#integrity doğrula,
    credential payload'ını JSON Schema 2020-12 ile doğrula → uymazsa RED.

Ş7. YETKİ (ADR-0007 Karar 6 — atlanamaz):
    issuerId = x5c yaprak parmak izinden türet (SPEC-ID-0002; iss claim'inden DEĞİL)
    IssuerRegistry.isCredentialSchemaAcceptable(issuerId, schemaId, credential.iat) == true
    → değilse RED.
    (1.0.1: isAuthorizedForSchema İHRAÇ sorusudur; doğrulamada kullanılırsa
     DEPRECATED şemayla verilmiş eski belgeler düşer — SPEC-BC-0001 2.1.0 R3)

ÇIKTI: şema geçerli. Doğrulamanın kalan adımları SPEC-API-0001'de.
```

**Ş3(c) hakkında:** Şema alınamadığında sonuç "geçersiz" değil
**"doğrulanamadı"**dır. Verifier bu ikisini kullanıcıya farklı göstermelidir.
"Diploma sahte" ile "şu an doğrulayamıyorum" arasındaki fark, bir insanın işe
alınıp alınmamasıdır.

## 7.1 Çevrimdışı doğrulama

Ş3(a) sayesinde çevrimdışı doğrulama mümkündür: `vct#integrity` dokümanın
içeriğini benzersiz tanımladığı için önbellek süresiz geçerlidir ve HTTP
önbellek direktiflerinden bağımsızdır.

Çevrimdışı modda **Ş2 ve Ş7 yapılamaz** (zincir okuması gerekir). Bu durumda
verifier, son bilinen zincir durumunun tazeliğini (`blockNumber`, `timestamp`)
kullanıcıya göstermek zorundadır.

---

# 8. Çok Dillilik

## 8.1 `LangString` yapısı

Kullanıcıya gösterilecek her metin alanı `LangString`'dir:

```json
"qualification_title": {
  "tr-TR": "Bilgisayar Mühendisliği",
  "en-US": "Computer Engineering"
}
```

JSON Schema tanımı (kök tipte, yeniden kullanılır):

```json
"LangString": {
  "type": "object",
  "propertyNames": { "pattern": "^[a-z]{2}(-[A-Z]{2})?$" },
  "additionalProperties": { "type": "string", "minLength": 1 },
  "minProperties": 1
}
```

## 8.2 Kurallar

1. **Baştan konur.** Bir alanı düz `string` yapıp sonra `LangString`'e çevirmek
   MAJOR sürüm kırılmasıdır. Kullanıcıya gösterilecek her alan doğrudan
   `LangString` doğar.
2. **Kod alanları `LangString` değildir.** `eqf_level`, `isced_f_code`,
   `awarding_date` tek değerlidir; çevrilmez.
3. **En az bir dil zorunludur.** Issuer, kurumun resmî dilini her zaman doldurur.
4. **Cüzdan gösterim sırası:** kullanıcının cihaz dili → `en-US` → mevcut ilk dil.

## 8.3 Neden kod alanları asıl önemlidir

Bir işveren `qualification_title` metnini okumaz; `isced_f_code` ve `eqf_level`
alanlarını okur. Metin insan içindir, kod makine içindir ve **tanınırlığı
sağlayan koddur.** Almanya'daki bir işveren "Bilgisayar Mühendisliği" ibaresini
anlamak zorunda değildir; ISCED-F kodunu ve EQF seviyesini anlar.

Bu, [[RS-SCHEMA-0001]]'in kontrollü sözlük vurgusunun pratik karşılığıdır.

---

# 9. Sürümleme ve Emeklilik

## 9.1 Semver kuralları

| Değişiklik | Sürüm | Eski şema durumu |
|---|---|---|
| Alan kaldırma, tip değiştirme, zorunlu alan ekleme | **MAJOR** | `DEPRECATED` |
| Opsiyonel alan ekleme, yeni dil, yeni türetilmiş claim | **MINOR** | `ACTIVE` kalır |
| Açıklama/etiket düzeltmesi (anlam değişmez) | **PATCH** | `ACTIVE` kalır |

Her sürüm **yeni URL, yeni `schemaId`, yeni zincir kaydı**dır. Yayınlanmış bir
URL'in içeriği asla değişmez.

## 9.2 Üç durum ve anlamları

| Durum | Yeni ihraç | Mevcut belgelerin doğrulanması |
|---|---|---|
| `ACTIVE` | ✓ | ✓ |
| `DEPRECATED` | ✗ | **✓ — devam eder** |
| `REVOKED` | ✗ | ✗ (özel işlem) |

**Kritik:** `DEPRECATED`, "artık verilemez" demektir; "artık doğrulanamaz"
demek **değildir.** 2027'de `1.0.0` ile verilmiş bir diploma, 2035'te `3.0.0`
yürürlükteyken hâlâ doğrulanabilir olmak zorundadır. Bir diplomanın ömrü şema
sürümünden uzundur.

Bu yüzden:
- `DEPRECATED` şemaların dokümanları **CDN'den asla kaldırılmaz.**
- Zincir kaydı **silinmez.**
- `supersededBy` alanı, verifier'ın "bu belge eski sürüm, güncel karşılığı bu"
  diyebilmesini sağlar.

`REVOKED` istisnaidir: şemanın kendisinin hatalı veya tehlikeli olduğu
durumlarda (örneğin yanlışlıkla `sd: never` işaretlenmiş bir kimlik numarası
alanı). O şemayla verilmiş belgeler ayrıca ele alınır ve issuer'lar yeniden
ihraca yönlendirilir.

## 9.3 Geçiş dönemi

MAJOR sürüm yayınlandığında eski sürüm **en az 24 ay** `ACTIVE` kalır. Bu süre
içinde issuer'lar iki sürümü paralel verebilir. Süre sonunda eski sürüm
`DEPRECATED` olur.

---

# 10. Barındırma ve İşletim

## 10.1 Bileşen özellikleri

`schemas.tamga.network` bir **statik dosya servisidir.** Uygulama sunucusu
değildir; veritabanı yoktur, dinamik içerik üretmez. Tek istisna `/v1/resolve`
ucudur ve o da yalnızca yönlendirme yapar.

| Özellik | Değer |
|---|---|
| İçerik | Statik JSON |
| Önbellek | `Cache-Control: public, max-age=31536000, immutable` |
| TLS | Zorunlu, HSTS |
| DNSSEC | Zorunlu |
| Erişilebilirlik hedefi | %99,9 (doğrulamayı durdurmaz, §10.2) |
| Kaynak | Git repo — her yayın bir commit |

## 10.2 Kesinti etkisi

Şema sunucusunun kesintiye uğraması:

- **Doğrulamayı durdurmaz.** Önbellekteki şemalarla devam edilir (§7.1).
- **Yeni tip öğrenmeyi durdurur.** Daha önce görülmemiş bir `vct` çözümlenemez.
- **Yeni ihracı etkilemez.** Issuer kendi şemasını yerelde tutar.

Bu yüzden SLO, kritik yol bileşenlerinden daha gevşek olabilir. Ayrıntı
[[ARCH-0004]]'te.

## 10.3 Alan adı riski

`schemas.tamga.network` alan adının kaybı **ekosistemik bir olaydır** — geçmişe
dönük tüm `vct` değerleri çözümlenemez hâle gelir. Azaltma:

1. Alan adı, kurumsal (vakıf) mülkiyetinde, kilit (registrar lock) açık.
2. DNSSEC.
3. Tüm şemaların git deposu ayna olarak birden çok yerde.
4. Faz 1'de üye devletlerin ayna sunucuları (`/v1/resolve` uyumlu).
5. Devir planı: vakıf tasfiye olursa alan adının konseye geçişi
   [[PM-GOV-0001]]'de sözleşmeye bağlanır.

---

# 11. Değişmezler (Invariants)

Bunlar CI'da ve kontratta zorlanır. İhlal = yayın engellenir.

| # | Değişmez |
|---|---|
| **D1** | Yayınlanmış bir Type Metadata / JSON Schema dosyasının (`metadata_url`) içeriği asla değişmez; minor/patch yeni `metadata_url` + hash, major yeni `vct` URN'i ([[ADR-0010]] K7). |
| **D2** | `contentHash` (zincir) = `vct#integrity` (credential) = SHA-256(yayınlanan baytlar). |
| **D3** | Type Metadata içindeki `vct`, credential'daki `vct` ile aynı olmalıdır. |
| **D4** | Kök tip dışında her tipte `extends` + `extends#integrity` bulunur. |
| **D5** | `extends` zinciri döngüsüzdür ve en fazla 5 seviyedir. |
| **D6** | Hiçbir kişisel veri alanı `sd: "never"` olamaz. |
| **D7** | Her NETWORK şeması en az `tr-TR` ve `en-US` `display` taşır. |
| **D8** | Zincir kaydı, CDN yayınından sonra yapılır (§6 sıra kuralı). |
| **D9** | `isAuthorizedForSchema` varsayılanı `false`'tur (allowlist). |

---

# Güvenlik ve Mahremiyet Notları

**Şema sunucusu bir takip yüzeyidir.** Bir cüzdan veya verifier, şemayı her
seferinde sunucudan çekerse, sunucu "kim hangi tip belgeyi ne zaman gördü"
bilgisini toplar. Azaltma:

1. Süresiz önbellekleme (§7.1) — normal işleyişte istek gitmez.
2. Cüzdanlar, kullanıcının sahip olduğu tipleri **kurulumda toplu** çeker,
   kullanım anında değil.
3. Sunucu **erişim logu tutmaz** — yalnızca toplu sayaç. Bu bir politika
   taahhüdüdür ve [[PM-GOV-0001]]'e yazılmalıdır.

**Şema, kişisel veri içermez.** Şema bir *tanımdır*, veri değildir. Yine de
`display` metinlerinde kurum adı geçebilir; bu kamusal bilgidir ve sorun
değildir.

**D6 neden kritik:** `sd: "never"` işaretli bir alan seçici açıklamaya
kapatılır, yani **her sunumda görünür.** Bir kimlik numarasını yanlışlıkla
`never` yapmak, o şemayla verilmiş tüm belgelerde kimlik numarasının her
verifier'a gitmesi demektir. Bu geri alınamaz; ancak `REVOKED` + yeniden ihraç
ile düzelir. Bu yüzden D6 hem CI hem insan gözden geçirmesinde kontrol
edilmelidir.

---

# Açık Konular

1. `/v1/resolve` ucunun ayna sunucularla tutarlılığı nasıl garanti edilir?
   (Faz 1, üye devlet aynaları)
2. Şema kullanım istatistikleri hangi granülariteyle toplanır — mahremiyet
   tavanı ne? → [[PM-GOV-0001]]
3. Bir NATIONAL şema, sonradan NETWORK'e "terfi" edebilir mi? Öneri: hayır,
   yeni bir NETWORK şeması yazılır ve NATIONAL olan `supersededBy` ile ona
   işaret eder. Karar bekliyor.
4. `extends` zincirinde bir üst tip `DEPRECATED` olursa alt tipe ne olur?
   Öneri: alt tip otomatik `DEPRECATED` olmaz ama CI uyarı verir.

---

# İlgili Dokümanlar

[[ADR-0007]] · [[PM-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-BC-0001]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-ID-0002]] ·
[[ADR-0008]] · [[ARCH-0004]] · [[ARCH-0005]]

---

# Durum

**Draft** — 2026-09-09, sürüm 1.0.1. `default_ttl_days`, tavan olarak
netleştirildi ([[SPEC-SCHEMA-0002]] §2.1.2 ile hizalama). Type Metadata alan adları ve çözümleme yolları
draft-ietf-oauth-sd-jwt-vc-19'a göre yazılmıştır. Standart RFC'ye dönüşürken
alan adları değişirse bu doküman MINOR sürümle güncellenir; §11 değişmezleri
etkilenmez.
