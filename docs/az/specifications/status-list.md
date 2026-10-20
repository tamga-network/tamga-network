---
document_id: SPEC-CRED-0003
title: "Ləğv və status siyahısı"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-19
summary: >
  [[ADR-0008]] qərarının normativ tətbiqi. Status List Token-in Tamga profilini (qurum siyahılarında bits=2, şəxsiyyət xidmətində bits=1; ES256, X.509 zənciri, minimum 100.000 indeks; mdoc üçün CWT təqdimatı), sabit intervallı və küylü dərc dövrünü, yenidən yazılmış StatusListRegistry lövbər müqaviləsini, on addımlı yoxlama alqoritmini, keş və aktuallıq siyasətini müəyyən edir. İki kritik məxfilik qaydası: indekslər TƏSADÜFİ ayrılır (ardıcıl ayırma məzun olma ardıcıllığını sızdırır) və siyahı URI-si QEYRİ-ŞƏFFAF olmalıdır (il/fakültə/kohortanı kodlayan URI açıqlanmamış claim-ləri sızdırır). Hər yoxlamada ayrıca sorğu əvəzinə toplu ilkin yükləmə məcburidir.
translation_of: SPEC-CRED-0003
source_version: "1.0.0"
---

Bu spesifikasiya rəqəmsal sənədin ləğv edilib-edilmədiyinin necə dərc edildiyini və yoxlandığını müəyyən edir; sənədi verən
qurumlar və yoxlayan tərəf tərtibatçıları üçündür.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Ləğv və aktuallıq](/concepts/revocation) səhifəsini oxuyun.
- Yoxlama xəttindəki yeri (D addımları): [[SPEC-API-0001]].
- Qərarın əsaslandırması: [[ADR-0008]].

**Qısaca**

Qurum hər sənədə böyük bir [[t:status-list|ləğv siyahısında]] (bit siyahısı) təsadüfi sıra nömrəsi verir. Sənəd ləğv edildikdə həmin bitin dəyəri dəyişir;
siyahı imzalanır və sabit intervallarla dərc edilir. Yoxlayan tərəf siyahını əvvəlcədən yükləyir və sənəd təqdim edilərkən heç kimdən
soruşmadan öz nüsxəsinə baxır; beləliklə qurum sənədin harada və nə vaxt təqdim edildiyini öyrənə bilmir. Hər dərcin barmaq
izi lövbər jurnalına yazılır; siyahı geri çəkilərsə, yoxlayan tərəf bunu aşkar edir.

> Bu gün lövbər [[t:trust-list]] dərcçisinin lövbər jurnalıdır (`anchors.jsonl`). §4-dəki müqavilə interfeysi zəncir mərhələsinə
> aiddir ([[ADR-0009]]).

---

# Əhatə dairəsi

Bu spesifikasiya Tamga-da [[t:credential|rəqəmsal sənədin]] **ləğv edilib-edilmədiyinin** ([[t:revocation]]) necə
dərc edildiyini, lövbərləndiyini və yoxlandığını müəyyən edir.

Qərar və əsaslandırmalar [[ADR-0008]]-dadır; burada təkrarlanmır. Xülasə: bitstring
siyahısı **off-chain** host edilir, zəncirdə yalnız URI + məzmun hash-i +
versiya lövbəri saxlanılır.

**Standart əsas:** IETF Token Status List — Tamga profili Avropa İttifaqının (Aİ) CIR 2026/1731 ilə sabitlədiyi
draft-ietf-oauth-status-list-**20**-ni (2026-04-20) izləyir. Cari layihə **draft-21**-dir (2026-06-21, RFC Editor
növbəsində); Aİ istinadı draft-20 olaraq qaldıqca Tamga da onda qalır, RFC dərc edildikdə profil yenidən qiymətləndirilir.

Əhatə dairəsindən kənar: kriptoqrafik akkumulyator / [[t:ZK]] ləğv (`RS-REVOCATION-0001`, genişlənmə mərhələsi).

---

# 1. Model və rollar

```
┌─────────────┐  issuance  ┌──────────┐  present  ┌──────────┐
│   Issuer    │──────────▶ │  Holder  │─────────▶ │ Verifier │
│ (university)│            │ (wallet) │           │(employer)│
└──────┬──────┘            └──────────┘           └────┬─────┘
       │ publishes                                     │ fetches
       ▼                                               ▼
┌──────────────────────────┐              ┌────────────────────┐
│  Status List Token       │◀─────────────│  cache /           │
│  status.<issuer-domain>  │              │  prefetch (§9)     │
└──────────┬───────────────┘              └────────────────────┘
           │ hash + version
           ▼
┌──────────────────────────┐
│  StatusListRegistry      │  ← chain (anchor only)
└──────────────────────────┘
```

| Rol | Vəzifə |
|---|---|
| **Status Provider** | Status List Token-i yaradır, imzalayır, dərc edir. Defolt olaraq sənədi verən qurumun özü. |
| **Referenced Token** | Statusu izlənilən sənəd — Tamga-da SD-JWT VC. |
| **Anchor** | `StatusListRegistry` müqaviləsindəki qeyd. |

**Terminologiya xəbərdarlığı:** Standart "[[t:relying-party|Relying Party]]" ifadəsini işlədir; Tamga-da bu **[[t:verifier|yoxlayan tərəfdir]]**
([[SPEC-BC-0001]] `RelyingPartyRegistry` ilə eyni anlayış).

---

# 2. Sənəd tərəfi (referenced token)

Ləğv siyahısından istifadə edən hər Tamga sənədi `status` claim-ini daşıyır
([[SPEC-SCHEMA-0001]] §4.2 — `tamga.uses_status_list = true` olduqda məcburidir):

```json
"status": {
  "status_list": {
    "idx": 48213,
    "uri": "https://status.tamga.network/7f3a9c21"
  }
}
```

| Sahə | Məna |
|---|---|
| `idx` | Bu sənədin siyahıdakı indeksi |
| `uri` | Status List Token-in ünvanı |

**`status` claim-i `sd: "never"`dir** — [[t:selective-disclosure]] ilə gizlədilə bilməz, hər təqdimatda görünür.
Bunun məxfilik nəticələri §6 və §10-da nəzərdən keçirilir.

---

# 3. Status List Token

## 3.1 Struktur

JWS compact serialization. Başlıq:

```json
{
  "alg": "ES256",
  "kid": "sl-2026-a",
  "typ": "statuslist+jwt",
  "x5c": ["MIIB...", "MIIC..."]
}
```

Gövdə:

```json
{
  "iss": "https://issuer.tamga.network/example-university",
  "sub": "https://status.tamga.network/7f3a9c21",
  "iat": 1789000000,
  "exp": 1789021600,
  "ttl": 120,
  "status_list": {
    "bits": 2,
    "lst": "eNrbuRgAAhcBXQ..."
  }
}
```

| Claim | Məcburilik | Tamga profili |
|---|---|---|
| `iss` | Məcburi | Sənədi verən qurumun identifikatoru; Referenced Token-in `iss`-i ilə eyni etibar zəncirində |
| `sub` | Məcburi | Siyahı URI-si — Referenced Token-dəki `uri` ilə **tam eyni** |
| `iat` | Məcburi | Dərc anı |
| `exp` | **Tamga-da məcburi** | `iat + 6 saat` (§8.1) |
| `ttl` | **Tamga-da məcburi** | Dərc intervalı (saniyə); şəbəkənin idarə etdiyi xidmətlərdə `120` (§5.1, §8.1) |
| `status_list.bits` | Məcburi | Qurum siyahılarında `2`, şəxsiyyət xidmətinin siyahılarında `1` — §3.3 ([[ADR-0048]]) |
| `status_list.lst` | Məcburi | Sıxılmış bayt massivi, base64url |
| `status_list.aggregation_uri` | İxtiyari | **Tamga-da tövsiyə olunur** — §9.2 |

## 3.2 Təqdim edilməsi

```
GET /7f3a9c21 HTTP/1.1
Host: status.tamga.network
Accept: application/statuslist+jwt

HTTP/1.1 200 OK
Content-Type: application/statuslist+jwt
Content-Encoding: gzip

eyJhbGciOiJFUzI1NiIsImtpZCI6InNsLTIwMjYtYSIsInR5cCI6InN0YXR1c2xpc3Qr...
```

- Cavab gövdəsi **xam JWS compact serialization**-dır — JSON zərfinə
  bükülmür.
- `Content-Encoding: gzip` istifadə edilməlidir (`lst` artıq sıxılıb, lakin
  JWT-nin base64url təqdimatı gzip-dən fayda görür).
- **CWT təqdimatı ([[ADR-0048]] K3; paketlər 0.6.0).** mdoc kimi də verilən növün siyahısı əlavə olaraq CWT kimi
  (`application/statuslist+cwt`) **ayrı, qeyri-şəffaf ünvanda** dərc edilir: COSE_Sign1, ES256, qorunan başlıqda `typ` =
  `application/statuslist+cwt` və `x5chain`; claim-lər `sub` (2) = CWT ünvanı, `iat` (6), `exp` (4), `ttl` (65534),
  `status_list` (65533) `{bits, lst}`. JWT və CWT təqdimatları eyni bitləri daşıyır, eyni dövrdə eyni açarla imzalanır və lövbər
  jurnalına ayrı sətirlər kimi yazılır. SD-JWT VC nüsxəsi JWT ünvanına, mdoc nüsxəsinin MSO-su isə CWT ünvanına işarə edir; iki
  nüsxə eyni `idx`-dən istifadə edir. mdoc kimi verilməyən növdə CWT təqdimatı yoxdur.
- **Tətbiq (paketlər 0.6.0).** `@tamga-network/sd-jwt`: `StatusBitstring(capacity, bytes, bits)` (`bits` 1 və ya 2),
  `signStatusListCwt` / `verifyStatusListCwt` (imzalayan xam ES256 imzası verir: `IssuerSigner.signRaw`, `pemIssuerSigner` təmin edir) və
  gövdəyə görə seçən `verifyStatusListAny`; CBOR/COSE qatı `@tamga-network/mdoc` (`signStatusListCwt`, `parseStatusListCwt`).
  Yoxlayan tərəfin ilkin yükləmə keşi CWT gövdəsini bayt kimi saxlayır; D addımı mdoc nüsxəsində CWT-ni, köhnə nüsxələrdə JWT-ni
  oxuyur. Dayandırma nəzərdə tutulmayan növdə (sxem `suspension_allowed` daşımır) `0x02` korlanmış siyahı dəyəridir: nəticə `INVALID`, RƏDD (SU2).
  `@tamga-network/wallet-core`: `parseStatusCwt`, `parseStatusBody`; rəqəmsal cüzdandan rəqəmsal cüzdana yoxlamada `fetchStatusBytes`. Uyğunluq
  vektoru `conformance/vectors/status-list/jwt-cwt.json` (versiya 5).

## 3.3 `bits` qərarı

Standart `bits` üçün 1, 2, 4 və 8 dəyərlərinə icazə verir. Tamga qurum siyahılarında **2**, şəxsiyyət xidmətinin siyahılarında
**1** istifadə edir ([[ADR-0048]]). Siyahılar hər növ üçün ayrı olduğundan (S9) bir siyahıda iki qayda qarışmır.

- **Şəxsiyyət xidmətinin növləri** (şəxsiyyət sənədi, sürücülük vəsiqəsi məlumatı, əlaqə sənədləri): dayandırma yoxdur, status yalnız etibarlı
  və ya ləğv edilmiş olur (Aİ PID qaydası: İcra Reqlamenti (Aİ) 2024/2979 Əlavə II, 2026/1731 ilə dəyişdirilmiş). `bits = 1`.
- **Qurum növləri:** `bits = 2`. Dayandırma (`0x02`) yalnız sxemi `suspension_allowed: true` olan növlərdə yazılır
  ([[SPEC-SCHEMA-0001]] §2.4; bu gün diplom). Digər növlərdə `0x02` dəyəri yazılmır.

| Seçim | Məna | Tamga qiymətləndirməsi |
|---|---|---|
| `bits = 1` | Yalnız etibarlı/etibarsız | Müvəqqəti dayandırma təmsil edilə bilməz |
| **`bits = 2`** | 4 status | **Seçildi** |
| `bits = 4` / `8` | 16 / 256 status | Ölçü 2–4 dəfə artır, qarşılığında fayda yoxdur |

Status dəyərləri və onların Tamga-dakı qarşılıqları:

| Dəyər | Standart adı | Tamga-dakı mənası |
|---|---|---|
| `0x00` | VALID | Etibarlı |
| `0x01` | INVALID | **Daimi ləğv** — geri dönüşü yoxdur |
| `0x02` | SUSPENDED | **Müvəqqəti dayandırma** — geri alına bilər |
| `0x03` | (ehtiyatda) | Tamga-da istifadə edilmir |

**Dayandırma niyə lazımdır (icazə verilən növlərdə):** Diplomla bağlı plagiat araşdırması başladıqda
qurum sənədi daimi ləğv etmək istəmir — araşdırma yekunlaşana qədər müvəqqəti dayandırmaq
istəyir. `bits = 1` seçsəydik, qurum ya əsassız olaraq daimi ləğv edəcək, ya da
heç nə etməyəcəkdi. Hər ikisi yanlışdır.

**Ölçü xərci:** 100.000 indeks × 2 bit = 25 KB xam, sıxılmış halda adətən
bir neçə yüz bayt (siyahı əsasən sıfırlardan ibarətdir). Nəzərə alınmayacaq qədərdir.

## 3.4 İmzalama açarı

Status List Token sənəd imzalama açarından **ayrı açarla**
imzalanır; lakin **eyni X.509 zəncirinə** bağlıdır ([[SPEC-ID-0002]]).

Əsaslandırma:

1. **İstifadə tezliyi fərqi.** Sənəd açarı nadir hallarda istifadə edilir və HSM-də
   saxlanılır. Status açarı hər dərc intervalında (bu gün 2 dəqiqədən bir) imza atır;
   onlayn sistemdə saxlanılmalıdır. İkisini eyniləşdirmək HSM-dəki açarı daim onlayn olan xidmətə
   açmaq deməkdir.
2. **Zərərin təcrid olunması.** Status açarı ələ keçirilərsə, təcavüzkar saxta
   *status* dərc edə bilər, lakin saxta *diplom* yarada bilməz.
3. **Rotasiya.** Status açarı hər il rotasiya edilə bilər; sənəd açarının
   rotasiyası keçmiş sənədlərə təsir edəcəyi üçün daha ağır əməliyyatdır.

`kid` həmişə doldurulur və rotasiya zamanı dəyişir.

---

# 4. Lövbər

## 4.1 `contentHash` nəyin hash-idir

```
contentHash = SHA-256( ASCII bytes of the JWS compact serialization string )
```

Yəni `Content-Encoding: gzip` **deşifrə edildikdən sonrakı** sətir. Nöqtə ayırıcıları
ilə birlikdə, tam token.

**İnvariant:** Eyni versiya nömrəsinə malik token həmişə eyni baytlardır. Status
Provider eyni `version` üçün fərqli baytlar yarada bilməz.

## 4.2 Müqavilə interfeysi

[[ADR-0008]] Qərar 4-ə əsasən `StatusListRegistry.sol` **yenidən yazılıb.**
Bitmap saxlayan köhnə versiya etibarsızdır.

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IStatusListRegistry {
    enum ListStatus { NONE, ACTIVE, RETIRED }

    struct ListAnchor {
        bytes32    issuerId;
        string     listURI;       // the sub claim of the Status List Token
        bytes32    contentHash;   // §4.1
        uint32     listSize;      // toplam indeks kapasitesi
        uint8      bitsPerEntry;  // Tamga'da her zaman 2
        uint64     version;       // monoton artan
        uint64     publishedAt;   // time of the latest publication
        ListStatus status;
    }

    /// @notice Tamga profile: the list must have at least this index capacity.
    function MIN_LIST_SIZE() external pure returns (uint32); // 100_000

    event ListRegistered(bytes32 indexed listId, bytes32 indexed issuerId, string listURI, uint32 listSize);
    event ListPublished(bytes32 indexed listId, uint64 version, bytes32 contentHash, uint64 publishedAt);
    event ListRetired(bytes32 indexed listId, string reason);

    error ListExists(bytes32 listId);
    error UnknownList(bytes32 listId);
    error NotListOwner(bytes32 listId, address caller);
    error VersionNotMonotonic(uint64 current, uint64 submitted);
    error PublishedAtNotMonotonic(uint64 current, uint64 submitted);
    error ListSizeTooSmall(uint32 submitted, uint32 minimum);
    error InvalidBitsPerEntry(uint8 submitted);
    error ListNotActive(bytes32 listId);

    /// @notice listId = keccak256(abi.encodePacked(issuerId, bytes(listURI)))
    function listIdOf(bytes32 issuerId, string calldata listURI) external pure returns (bytes32);

    /// @notice Listeyi bir kez kaydeder. onlyIssuer(issuerId).
    function registerList(
        bytes32 issuerId,
        string calldata listURI,
        uint32 listSize,
        uint8 bitsPerEntry
    ) external returns (bytes32 listId);

    /// @notice Called in every publication cycle (§5). version must increase monotonically.
    function publishList(
        bytes32 listId,
        bytes32 contentHash,
        uint64 version,
        uint64 publishedAt
    ) external;

    function retireList(bytes32 listId, string calldata reason) external;

    function getListAnchor(bytes32 listId) external view returns (ListAnchor memory);

    /// @notice Used in verification: does the hash match and is the version fresh enough?
    function matchesContentHash(bytes32 listId, bytes32 hash) external view returns (bool);
}
```

## 4.3 Silinmiş interfeyslər

Aşağıdakılar **silinib** və yenidən əlavə edilməməlidir:

| Silinən | Harada | Səbəb |
|---|---|---|
| `setRevoked(issuerId, index)` | `StatusListRegistry.sol` | Zəncir artıq bit saxlamır |
| `setRevokedBatch(...)` | eyni | eyni |
| `unsetRevoked(...)` | eyni | eyni |
| `getChunk(issuerId, chunkIndex)` | eyni | eyni |
| `_setBit(...)` | eyni | eyni |
| `IStatusList.isRevoked(issuerId, index)` | `ITrustQueries.sol` | Zəncir bu suala **cavab verə bilməz** |

Son sətir kritikdir. Cavab verilə bilməyən sualı soruşan interfeysi saxlamaq
çağıranın `false` nəticəsini "ləğv edilməyib" kimi başa düşməsinə səbəb olur. İnterfeys
silinməlidir ki, kompilyasiya xətası versin.

**Asılı təsir:** `CredentialGate.sol` ləğv statusunu zəncirdən oxuya bilməz.
[[ADR-0008]] Nəticələr §3-ə əsasən zəncir üzərində credential-gating çağıranın
təqdim etdiyi təzə sübuta əsaslanmalıdır → `SPEC-AGENT-0001`.

---

# 5. Dərc dövrü

## 5.1 Sabit interval və küy

Status Provider siyahını **sabit intervallarla** yenidən dərc edir. Defolt
interval: **2 dəqiqə** (şəbəkənin idarə etdiyi sənəd vermə xidmətləri; sandbox-da daha qısa). `ttl` intervala bərabərdir; `exp` intervaldan
asılı olmayaraq saatlar səviyyəsindədir (§8.1). Qısa interval ləğvin bir neçə dəqiqə ərzində görünməsini təmin edir; uzun `exp` isə status
serverində fasilə zamanı yoxlamanın dərhal YOXLANILA BİLMƏDİ nəticəsinə düşməsinin qarşısını alır (layihə idarəetməsinin qərarı, 2026-10-09).

**Dəyişiklik olmasa belə dərc edilir.** Bu ixtiyari deyil.

Əsaslandırma ([[ADR-0008]] §1): dərc yalnız ləğv baş verdikdə aparılarsa, zəncirdəki
`publishList` əməliyyatının mövcudluğu "bu saatda bir ləğv baş verdi" məlumatını şəbəkədəki bütün
validator-lara sızdırır. Blokun vaxt damğası ilə birləşdikdə — intizam
qərarının tarixi, işdən çıxma günü — sənəd sahibinin kimliyi daraldıla bilər.

Sabit dövrdə kənardan görünən yeganə şey "siyahının yeni versiyası var" faktıdır. Hansı
bitin dəyişdiyi, hətta hər hansı bitin dəyişib-dəyişmədiyi görünmür.

## 5.2 Dərc alqoritmi

```
Every interval T (default 120 s):

  1. Take pending status changes from the queue (if any; may be empty).
  2. Update the bitstring.
  3. Compress → lst.
  4. Build the token body:
       iat = now, exp = now + 6h, ttl = T, version = previous + 1
  5. Sign with the status key → JWS compact serialization.
  6. contentHash = SHA-256(ASCII bytes of the string)
  7. Write to the CDN / status server.          ← FIRST
  8. publishList(listId, contentHash, version, iat)   ← THEN
```

**Addım 7–8 ardıcıllığı məcburidir.** Tərs ardıcıllıqda zəncirdə qeydə alınmış, lakin
əlçatmaz olan versiya yaranır və bütün yoxlamalar §7 Addım 6-da dayanır.

## 5.3 İnterval və təzəlik əlaqəsi

Ən pis halda ləğv bir dərc intervalı üstəgəl yoxlayan tərəfin ilkin yükləmə intervalı (§9.1) qədər gecikmə ilə görünən
olur. Standart 2 dəqiqəlik intervalda bu bir neçə dəqiqədir.

Bu gün lövbər etibar siyahısı nəşriyyatçısının lövbər jurnalıdır və hər dərc bir sətirdir. Zəncir mərhələsində ([[ADR-0009]]) hər dərc
bir əməliyyata çevrilir; interval həmin mərhələdə zəncir yükünə görə yenidən qiymətləndirilir (Açıq Məsələ 1-dəki hesablama saatlıq interval üçündür).

**Təcili hal:** İnterval xaricində dərc **aparılmır** — bu, §5.1-in məxfilik faydasını
aradan qaldırır. Təcili ləğv lazımdırsa, düzgün vasitə ləğv siyahısı deyil, [[t:issuer]]
sertifikatının dayandırılması ([[SPEC-ID-0002]]) və ya sxemin
`REVOKED` edilməsidir ([[SPEC-SCHEMA-0001]] §9.2).

---

# 6. İndekslərin ayrılması — məxfilik üçün kritik

Bu bölmə spesifikasiyanın ən asan səhv tətbiq edilən hissəsidir.

## 6.1 İndekslər TƏSADÜFİ ayrılır

`idx` dəyəri siyahının tutumu daxilindən **kriptoqrafik olaraq təsadüfi**
seçilir. Ardıcıl sayğac **istifadə edilmir.**

**Ardıcıl ayırma nəyi sızdırır:** `idx` claim-i `sd: never`-dir — hər təqdimatda
görünür. Ardıcıl ayırmada `idx = 12` olan məzun həmin siyahıda 12-ci sırada sənəd
almış şəxsdir. Bu:

- Məzuniyyət/qeydiyyat **sırasını** üzə çıxarır
- İki məzunun `idx` fərqi onlar arasındakı zaman fərqini təqribən göstərir
- Kiçik bölmələrdə şəxsi demək olar ki, fərdiləşdirir
- Məzun `awarding_date`-i açıqlamasa belə, tarixi təqribən ələ verir

Yəni selective disclosure ilə gizlədilən məlumat indeks vasitəsilə sızır.

## 6.2 Doluluq nisbəti

Təsadüfi ayırma tək başına kifayət etmir. Siyahı böyük ölçüdə boşdursa, dolu indekslərin
paylanması yenə də məlumat daşıyır.

| Qayda | Dəyər |
|---|---|
| Minimal siyahı tutumu | **100.000** indeks |
| Maksimal doluluq | 80% — aşıldıqda yeni siyahı açılır |

Yeni siyahıda sənədlərin az olması kənardan görünmür: etibarlı sənədin biti ilə heç istifadə olunmamış indeksin biti
eynidir (`0x00`), kənardan baxan şəxs hansı indekslərin ayrıldığını görə bilmir. Buna görə boş indeksləri "ayrılmış"
kimi göstərmək (ilkin küy) müşahidə edilə bilən qoruma vermir və istifadə edilmir (layihə rəhbərliyinin qərarı, 2026-10-09). Qorumanı
təsadüfi ayırma (§6.1) və minimal tutum təmin edir.

## 6.3 Siyahı URI-si QEYRİ-ŞƏFFAF (opaque) olmalıdır

**Bu qayda yazılma zamanı aşkarlanmış sızmanı aradan qaldırır.**

Siyahı URI-si `sd: never` olan `status` claim-i daxilində daşınır — yəni **hər
təqdimatda yoxlayan tərəf tərəfindən görünür.** Deməli, URI-nin özü də bir
claim-dir.

Qadağan olunmuş nümunələr:

| URI | Nəyi sızdırır |
|---|---|
| `.../sl/edu-2026-a` | **Məzuniyyət ili** — `awarding_date` gizlədilsə belə |
| `.../sl/muhendislik` | Fakültə/bölmə — `programme_title` gizlədilsə belə |
| `.../sl/lisans-2026-guz` | Kohort — hər ikisi birlikdə |
| `.../sl/tip-fakultesi-2024` | Hər ikisi + peşə məlumatı |

**Qayda:** Siyahı identifikatoru **qeyri-şəffaf** olmalıdır — mənasız, təsadüfi yaradılmış
sətir:

```
https://status.tamga.network/7f3a9c21
```

Status Provider bu identifikator ilə kohort arasındakı uyğunluğu **öz
daxilində** saxlayır; bu, kənara çıxmır.

## 6.4 Siyahılar necə bölünür

Tutum dolduqda yeni siyahı açılır. Bölmə meyarı:

| Meyar | Qiymətləndirmə |
|---|---|
| İl / dövr üzrə | **Qadağandır** — §6.3 ilə eyni sızma; URI qeyri-şəffaf olsa belə, siyahıya daxil olmaq ili ələ verir |
| Bölmə / fakültə üzrə | **Qadağandır** — eyni əsaslandırma |
| Sxem (sənəd növü) üzrə | **Qaçılmaz və zərərsiz** — `vct` onsuz da açıqdır |
| Tutum dolduqda növbəti | **Tövsiyə olunur** |

Yəni yeganə bölgü oxu sənəd növüdür; bundan başqa yeni siyahı yalnız köhnə
siyahı dolduğu üçün açılır və ona daxil olan sənədlər növdən başqa heç bir
ümumi xüsusiyyət paylaşmır.

**Tətbiq qeydi:** Bu, "2026 məzunları A siyahısında" kimi təbii görünən və
əməliyyat baxımından asan olan dizaynı qadağan edir. İnzibati rahatlıq məxfilik
sızmasına dəyməz.

---

# 7. Yoxlama alqoritmi (yoxlayan tərəf)

Normativdir. `status` claim-i daşıyan hər sənəd üçün icra edilir.

```
Ş1.  Does the credential have status.status_list?
     If the schema says tamga.uses_status_list = true and the claim is missing → REJECT.

Ş2.  Take idx and uri. If the uri scheme is not https → REJECT.

Ş3.  Obtain the Status List Token:
     a) Is it in the prefetch cache and fresh (§8)? → use it.
     b) Otherwise GET <uri>, Accept: application/statuslist+jwt
     c) If neither works → "COULD NOT VERIFY" (not REJECT, §7.1)

Ş4.  Verify the token:
     - typ == "statuslist+jwt"
     - the signer is pinned: the x5c leaf fingerprint is one of the institution's ACTIVE status keys in
       the trust list (S11), before the signature check → otherwise REJECT ([[ADR-0056]] K6)
     - signature valid, the x5c chain links to the issuer's X.509 chain
       (SPEC-ID-0002); root anchored in RootCARegistry
     - sub == the uri in the credential  → otherwise REJECT
     - iss in the same trust chain as the credential's iss → otherwise REJECT

Ş5.  Freshness:
     - exp has passed → "COULD NOT VERIFY"
     - iat + ttl < now → time to fetch a new token (refresh hint, §8.1); the
       token stays usable until exp
     - now − iat > the policy's max_status_token_age_sec → "COULD NOT VERIFY"
     (the exp/ttl claims decide, not the HTTP cache headers)

Ş6.  CHAIN ANCHOR:
     listId = keccak256(issuerId, sub)
     anchor = StatusListRegistry.getListAnchor(listId)
     - anchor.status == ACTIVE  → otherwise REJECT
     - SHA-256(token bytes) == anchor.contentHash → otherwise REJECT
     - version in the token lower than anchor.version → REJECT (rollback)

Ş7.  Capacity: idx < anchor.listSize → otherwise REJECT

Ş8.  Decompress lst and read the value at position idx with the token's bits value (institution 2, identity service 1).
     For an mdoc credential the same steps run on the CWT representation (application/statuslist+cwt, COSE_Sign1).

Ş9.  Interpret the value:
     0x00 → VALID
     0x01 → REVOKED      → REJECT
     0x02 → SUSPENDED    → REJECT (shown to the user as "suspended"; only in a bits=2 list)
     0x03 → unrecognised → REJECT

Ş10. Write the result to the audit log together with the version and iat of the token used.
```

**Attestation Revocation List (kod 0.5.0; Aİ VCR_10, VCR_12).** mdoc sənədinin MSO-su `status_list` əvəzinə `identifier_list
{id, uri}` daşıyırsa (İcra Reqlamenti (Aİ) 2024/2979 Əlavə II, 2026/1731 ilə dəyişdirilmiş), yoxlayan tərəf eyni addımlarla identifikator
siyahısını yoxlayır: `application/identifierlist+cwt` (COSE_Sign1 ES256; qorunan başlıqda `typ` və `x5chain`; 65530 sorğusunda
`identifiers`; `exp` məcburidir); imzalayan qurumun qeydə alınmış ləğv açarı (S11); ilkin yükləmə keşi (S12); təzəlik (Ş7); `id`
siyahıdadırsa RƏDD (dayandırma yoxdur). Bu siyahılar üçün lövbər jurnalı yoxdur: ünvan imzası yoxlanılmış sənəddə ilk dəfə görüldükdə ilkin yükləmə
dəstinə əlavə olunur və yoxlamadan kənarda yüklənir (həmin yoxlama YOXLANILA BİLMƏDİ, sonrakılar keşdən; hər ilkin yükləmə dövründə
yenilənir). Siyahı ikili CWT-dir və məzmun növünə baxılmadan bayt kimi saxlanılır; oxuna bilməyən siyahı YOXLANILA BİLMƏDİ deməkdir, RƏDD deyil. Tamga-da sənədi verən qurumlar Status List dərc edir (biri kifayətdir, VCR_11).

## 7.1 "Etibarsız" ilə "yoxlanıla bilmədi" arasındakı fərq

Ş3(c) və Ş5-də nəticə **"etibarsız" deyil, "yoxlanıla bilmədi"**dir və yoxlayan tərəf bu
ikisini istifadəçiyə **fərqli** göstərməlidir.

"Bu diplom ləğv edilib" ilə "hazırda ləğv statusunu yoxlaya bilmirəm"
arasındakı fərq bir insanın işə götürülüb-götürülməməsi deməkdir. Eyni fərq
[[SPEC-SCHEMA-0001]] §7-də sxemin həlli üçün də keçərlidir.

## 7.2 Ş6 niyə buraxıla bilməz

Zəncir lövbəri olmadan sənədi verən qurum öz serverindəki siyahını səssizcə geri
qaytara bilər — ləğv etdiyi sənədi yenidən "etibarlı" göstərə bilər. `version`
monotonluğu və `contentHash` uyğunluğu bunun qarşısını alır.

---

# 8. Keş və təzəlik

## 8.1 `ttl` və `exp`

| Claim | Tamga dəyəri | Mənası |
|---|---|---|
| `ttl` | dərc intervalı (`120`) | Yoxlayan tərəf bu müddət ərzində yenidən yükləmədən istifadə edə bilər; sonra yenisini yükləməlidir |
| `exp` | `iat + 6 saat` | Bu andan sonra token qətiyyən istifadə edilə bilməz |

İki claim-in mənası Token Status List layihəsində (draft-20) verilir: `ttl` istehlakçının token-i keşdə saxlayıb **yenisini yükləməzdən
əvvəl** gözləyə biləcəyi maksimal müddətdir (yeniləmə işarəsi); `exp` token-in etibarlılığının bitdiyi andır (mütləq hədd). Tamga
bu ikisini ayrı saxlayır:

- `ttl` = dərc intervalı. Yoxlayan tərəf hər intervalda yenisini yükləyir; ləğv bir neçə dəqiqəyə görünür (§5.3).
- `exp` = `iat + 6 saat`. Status serverində fasilə yaranarsa, yoxlayan tərəf son token ilə 6 saata qədər yoxlamanı davam etdirə bilər;
  fasilə zamanı nəticə dərhal YOXLANILA BİLMƏDİ-yə düşmür.

**Niyə 6 saat:** bu, yoxlayan tərəf siyasətlərindəki maksimal token yaşı ilə (`max_status_token_age_sec`, istinad siyasətlərində 21.600
san) eynidir; daha uzun `exp`-dən siyasət onsuz da istifadə etməzdi. Bundan əlavə, `exp` köhnə, lakin imzalı token-in yenidən təqdim oluna biləcəyi
pəncərəni məhdudlaşdırır: şəbəkə yolunu ələ keçirən şəxs ləğvi ən çoxu bu qədər gizlədə bilər (lövbər yoxlaması, §7 Ş6, aktual lövbəri bilən
yoxlayan tərəfdə bunu daha da daraldır). Əvvəlki 50 saatlıq hədəf bu pəncərəni lüzumsuz yerə böyüdərdi.

**Lövbərlə uyğunluq:** lövbər hər dərcdə yenilənir. Status serverində fasilə olduqda yeni dərc və yeni lövbər olmur; yoxlayan tərəfin
əlindəki token son lövbərlə uyğun gəlir və `exp`-ə qədər istifadə edilir. Server işlədiyi halda yoxlayan tərəf siyahını yükləyə bilmirsə, lövbər
token-dən yenidir və nəticə YOXLANILA BİLMƏDİ olur (§7 Ş6; geri qaytarma sayılmır). Yəni uzun `exp` yalnız real fasilədə işə yarayır və
ləğvi aktual lövbəri bilən yoxlayan tərəfdən gizlətmir.

**Həlledici olan claim-lərdir.** Standart yoxlayan tərəfdən HTTP keş
başlıqlarından əvvəl token-in `exp` və `ttl` claim-lərinə üstünlük verməsini
tələb edir. CDN-in `Cache-Control` başlığı bunu ləğv edə bilməz.

## 8.2 Sxem üzrə təzəlik hədləri

Yoxlayan tərəf risk səviyyəsindən asılı olaraq daha sərt davrana bilər:

| Risk | Qəbul edilən maksimal token yaşı |
|---|---|
| Aşağı | `exp`-ə qədər (6 saat) |
| Orta | 1 saat |
| Yüksək (rəsmi əməliyyat) | bir neçə dərc intervalı (≤ 10 dəqiqə) və `version` zəncir lövbəri ilə tam uyğun |

## 8.3 Oflayn yoxlama

Zəncir lövbəri (Ş6) oxuna bilmirsə, yoxlama tam aparıla bilməz. Yoxlayan tərəf oflayn
rejimdə:

- Keşdəki token və son məlum lövbərlə davam edə bilər,
- İstifadəçiyə **son sinxronizasiya vaxtını** göstərməlidir,
- Nəticəni "oflayn yoxlanılıb" kimi qeyd edir.

---

# 9. Məxfilik

## 9.1 Hər yoxlamada yükləmə qadağandır

**Ən vacib məxfilik qaydası budur.**

Yoxlayan tərəf hər yoxlamada `GET <uri>` edərsə, Status Provider bunu öyrənir:

> "Hazırda kimsə mənim X siyahımdan bir sənədi yoxlayır."

Mənbə IP yoxlayan tərəfi ələ verir. Universitet məzunlarının hansı işəgötürənlərə
müraciət etdiyini bu yolla öyrənə bilər — bu, kağız diplomda olmayan yeni izləmə
kanalıdır.

**Qayda:** Yoxlayan tərəflər Status List Token-ləri yoxlama anında deyil, **planlaşdırılmış toplu ilkin yükləmə ilə**
alır (tövsiyə: `ttl` intervalında). Yoxlama keşdən
aparılır.

`@tamga-network/verifier` SDK-sı bu davranışı **standart** edir; hər yoxlamada
yükləmə yalnız açıq şəkildə aktivləşdirildikdə mümkün olmalıdır ([[ARCH-0005]]).

## 9.2 Siyahıların toplanması (aggregation)

Standart sənədi verən quruma öz siyahı URI-lərini toplu şəkildə dərc etməyə imkan verən
opsional toplama mexanizmi müəyyən edir (`aggregation_uri`).

Tamga-da **tövsiyə olunur**: yoxlayan tərəf sənədi verən qurumun bütün siyahılarını tək ünvandan
aşkar edib toplu şəkildə endirə bilər. Bu, §9.1-in tətbiqini praktikada asanlaşdırır.

## 9.3 Sürü məxfiliyi (herd privacy)

Siyahıdakı indekslərin sayı nə qədər azdırsa, `idx`-in daşıdığı fərqləndiricilik bir o
qədər yüksəkdir. §6.2-dəki 100.000 minimum tutum məhz buna görədir.

**Kiçik qurum problemi:** 300 məzunu olan peşə məktəbi 100.000-lik
siyahıda 300 dolu indeks deməkdir. Siyahı böyükdür, amma sürü kiçikdir. Bu halda
sürü siyahı ilə deyil, **qurumla** məhdudlaşır və bunun texniki həlli yoxdur — onsuz da
`iss` claim-i qurumu açıq şəkildə bildirir.

Qəbul edilmiş məhdudiyyət kimi qeydə alınıb.

## 9.4 Həll olunmayan: `idx` korrelyasiyası

`idx` + `uri` cütü sabitdir və `sd: never`-dir. Eyni diplomu iki fərqli
yoxlayan tərəfə təqdim edən məzun, həmin iki yoxlayan tərəf əməkdaşlıq edərsə, əlaqələndirilə bilər.

Bu, Token Status List-in məlum və struktur məhdudiyyətidir. Həlli **toplu
sənəd verilməsi**dir: hər təqdimat üçün fərqli `idx` daşıyan ayrıca rəqəmsal sənəd nüsxəsi
([[SPEC-CRED-0001]] §5, [[SPEC-SCHEMA-0002]] §2.1.3).

**İlk mərhələdə qəbul edilən riskdir və pilot iştirakçılarına açıq şəkildə
bildirilməlidir** → PM-GTM-0001.

---

# 10. İstismar

## 10.1 Komponent

| Xüsusiyyət | Dəyər |
|---|---|
| Ünvan | `status.<issuer-domain>` |
| Məzmun | Statik fayl (imzalı token), CDN arxasında |
| Yazma | Nəşr tapşırığı (cron), sabit intervalla (2 dəqiqədən bir, §5.1) |
| Açar | Status imzalama açarı, onlayn, sənəd açarından ayrı (§3.4) |
| Əlçatanlıq hədəfi | 99,5% — `exp` = 6 saatlıq buferlə qısa fasilələrdə kritik yolda deyil (§8.1) |

Hər sənədi verən qurum üçün ayrıca komponentdir və sənədi verən qurumun onboarding yoxlama siyahısına
daxildir ([[ARCH-0004]]).

## 10.2 Kiçik qurum və mərkəzləşmə riski

Hər sənədi verən qurumun status serverini idarə etməsi kiçik qurumlar üçün ağır ola bilər.
Tamga hostinq xidməti təklif edə bilər — **amma o zaman Tamga şəbəkədəki bütün ləğvləri
görür.**

Bu, real mərkəzləşmə nöqtəsidir və [[PM-GOV-0001]] Qərar P1-də siyasətlə
tənzimlənib: imzalama açarı qurumda qalır (fond saxta status dərc edə bilməz),
müraciət jurnalı aparılmır, host edilən sənədi verən qurumların siyahısı ictimaiyyətə açıqdır və aktiv
sənədi verən qurumların 30%-i aşılarsa, məsələ şuranın gündəminə çıxarılır.

**Bugünkü istismar (2026-10-09 tarixinə):**

- **Açar ayrılığı:** hər sənədi verən qurumun status açarı sənəd imza açarından ayrıdır (S11); etibar siyahısında `delegate_keys[]`
  altında `purpose: "status_list"` ilə ayrıca barmaq izi ilə dərc olunur. Status açarı ələ keçirilsə belə, saxta rəqəmsal sənəd
  yaradıla bilməz (§3.4).
- **Açarın yeri:** real şəbəkədə bu gün aktiv olan yeganə ləğv siyahısı şəbəkənin müvəqqəti şəxsiyyət xidmətinin öz siyahısıdır; orada sənədi
  verən şəbəkənin özüdür, açar sənədi verəndə qalır. Başqa qurum adına host edilən siyahı real şəbəkədə aktiv deyil.
  Sandbox-dakı test qurumlarının açarları sandbox-da qalır (test açarları). Real qurum host edilən xidmətə
  qoşulduqda status açarı, sənəd imza açarı kimi, qurumun öz açar idarəetməsinə (KMS) köçürülür (P1.a); bu, həmin qurumun
  pilotunun ilkin şərtidir.
- **Müraciət jurnalı:** ləğv siyahısı son nöqtələrinin (`status.<alan adı>/…` və şəxsiyyət xidmətinin `/status/…` yolu) müraciət jurnalı
  aparılmır (P1.b). Şəbəkənin digər xidmətlərindəki müraciət jurnalı IP ünvanını ehtiva etmir.

## 10.3 Fəlakət ssenariləri

| Ssenari | Təsir | Bərpa |
|---|---|---|
| Status serverində fasilə | 6 saata qədər keşdən davam edir (`exp`, §8.1) | Server bərpa olunur |
| Status açarının itirilməsi | Yeni nəşr mümkün deyil | Yeni açar + `kid` rotasiyası, eyni siyahı davam edir |
| Status açarının ələ keçirilməsi | Saxta status dərc oluna bilər | Sertifikatın ləğvi → bütün token-lər Ş4-də düşür → yeni açarla yenidən nəşr |
| Siyahı faylının itirilməsi | Yoxlama dayanır | Bitstring sənədi verən qurumun verilənlər bazasından yenidən yaradılır; **zəncirdəki `contentHash` keçmiş versiyanı yoxlamaq üçün saxlanılır** |

Son sətir sənədi verən qurumun ləğv növbəsini daimi saxlamasını tələb edir.
Siyahı törəmə məhsuldur; mənbə verilənlər bazasıdır.

---

# 11. Dəyişməzlər

| # | Dəyişməz |
|---|---|
| **S1** | Zəncirdə heç bir ləğv biti yoxdur; yalnız lövbər. |
| **S2** | Qurum siyahılarında `bits` `2`-dir və dayandırma dəyəri yalnız `suspension_allowed: true` növlərdə yazılır; şəxsiyyət xidmətinin siyahılarında `bits` `1`-dir ([[ADR-0048]]). |
| **S3** | `version` monoton artır; azalan versiya rədd edilir. |
| **S4** | Nəşr CDN-ə yazıldıqdan **sonra** zəncirə qeyd olunur (§5.2). |
| **S5** | Dəyişiklik olmasa belə, sabit intervalla dərc olunur (§5.1). |
| **S6** | İnterval xaricində ("təcili") nəşr edilmir. Yeganə istisna: xidmət yenidən başladıqda dərc olunmuş token yoxdursa və ya müddətinin bitməsinə bir intervaldan az qalıbsa, dərhal yenidən dərc olunur — məzmun dəyişmir və vaxt ləğv hadisəsinə bağlı deyil, buna görə S6-nın qoruduğu məlumat (ləğv anı) sızmır. |
| **S7** | `idx` təsadüfi ayrılır; ardıcıl sayğacdan istifadə olunmur (§6.1). |
| **S8** | Siyahı URI-si qeyri-şəffafdır; il, fakültə, kohort kodlaşdırmır (§6.3). |
| **S9** | Siyahılar tipdən başqa heç bir meyara görə bölünmür (§6.4). |
| **S10** | Siyahı tutumu ≥ 100.000; doluluq ≤ 80%. |
| **S11** | Status açarı sənəd imzalama açarından ayrıdır (§3.4). Status açarının sertifikat barmaq izi etibar siyahısında qurum qeydinin `delegate_keys[]` sahəsində `purpose: "status_list"` ilə dərc olunur; yoxlayan tərəf D3-də token imzalayanını bu qeydlə uyğunlaşdırır (qeyd yoxdursa INDETERMINATE, uyğun gəlmirsə REJECTED); paketlərdə imzalayan yoxlama girişidir (`expectedSignerFingerprints`, məcburi — [[ADR-0056]] K6). Siyahıdan kənar `idx` etibarlı sayılmır (D6 RƏDD). |
| **S12** | Yoxlayan tərəf hər yoxlama üçün ayrıca sorğu etmir; toplu ilkin yükləmədən istifadə edir (§9.1). |
| **S13** | `exp`/`ttl` claim-ləri HTTP keş başlıqlarını üstələyir. |
| **S14** | "Etibarsız" ilə "yoxlanıla bilmədi" istifadəçiyə fərqli göstərilir (§7.1). |

---

# Açıq məsələlər

1. ~~`ttl = 3600` ilə zəncirə saatda bir dəfə yazmanın zəncir yükü~~ —
   **BAĞLANDI** (2026-09-09, [[ARCH-0004]] §7). 1.000 sənədi verən qurum = gündə 24.000 əməliyyat
   = **0,28 TPS**; 2 saniyəlik blokda blok başına 0,55 əməliyyat. QBFT üçün nəzərə alınmayacaq
   qədər azdır. Daimi vəziyyət də böyümür: `publishList` mövcud slot-ların üzərinə
   yazır. Əsl böyüyən arxiv tarixçəsidir, ildə ~1,8 GB.
2. Dayandırma (`0x02`) statusundan etibarlı statusa qayıdış yoxlayan tərəfin audit jurnalında necə
   əks olunur? Geriyə dönük "o an dayandırılmışdı" sorğusu lazımdırmı?
3. ~~§6.2-dəki 1% başlanğıc küyü~~ — **BAĞLANDI** (2026-10-09): qayda çıxarıldı; etibarlı bit ilə boş indeks eyni
   (`0x00`) olduğundan müşahidə edilə bilən təsiri yox idi (§6.2).
4. Status List Aggregation məcburi olmalıdırmı? Hazırda "tövsiyə olunur"; yoxlayan tərəf
   ilkin yükləməni ciddi qəbul edərsə, onu məcburi etmək məntiqli ola bilər.
5. Çoxsaylı Status Provider (sənədi verən qurumun bir neçə siyahısı fərqli serverlərdə)
   dəstəklənirmi? Hazırda dolayısı ilə bəli; bu açıq şəkildə yazılmalıdırmı?
6. ~~Nəşr intervalı və `exp` buferi~~ — **BAĞLANDI** (2026-10-09): interval qısa qalır (2 dəqiqə, `ttl` = interval), `exp` =
   `iat + 6 saat` (§5.1, §8.1).
7. ~~Host edilən status xidməti~~ — **BAĞLANDI** (2026-10-09): siyasət (P1.a, P1.b) olduğu kimi qüvvədədir; ləğv siyahısı son nöqtələrinin
   müraciət jurnalı söndürüldü, açarın yeri §10.2-də olduğu kimi yazıldı.

---

# Əlaqəli sənədlər

[[ADR-0008]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-SCHEMA-0001]] ·
[[SPEC-SCHEMA-0002]] · [[SPEC-BC-0001]] · [[SPEC-ID-0002]] · [[PM-TRUST-0001]] ·
[[ARCH-0004]] · [[ARCH-0005]] · [[PM-GOV-0001]] · PM-GTM-0001

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02; §3.2, §3.3, Ş8–Ş9 və S2 2026-10-13, [[ADR-0048]]; tətbiq paketlərin 0.6.0 versiyasındadır).

