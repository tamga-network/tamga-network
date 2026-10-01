---
document_id: SPEC-CRED-0003
title: Status List ve İptal — Token Status List Profili, Yayın Döngüsü, Zincir Çapası
category: Specification
domain: Credential
status: Active
review_status: Draft
version: 1.0.6
created: 2026-09-09
last_updated: 2026-09-30
authors:
  - Tamga Network Engineering
language: tr
document_type: specification
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - credential
  - revocation
  - status-list
  - privacy
  - blockchain
  - anchor
keywords:
  - IETF Token Status List draft-ietf-oauth-status-list-20
  - statuslist+jwt media type
  - status_list bits lst ttl
  - StatusListRegistry anchor contract
  - random index allocation
  - herd privacy
  - opaque list URI
  - fixed-cadence publication
summary: >
  [[ADR-0008]] kararının normatif uygulaması. Status List Token'ın Tamga profilini
  (bits=2, ES256, X.509 zinciri, asgari 100.000 indeks), sabit aralıklı ve
  gürültülü yayın döngüsünü, yeniden yazılmış StatusListRegistry çapa kontratını,
  on adımlı doğrulama algoritmasını, önbellek ve tazelik politikasını tanımlar.
  İki kritik mahremiyet kuralı: indeksler RASTGELE tahsis edilir (sıralı tahsis
  mezuniyet sırasını sızdırır) ve liste URI'si OPAK olmalıdır (yıl/fakülte/kohort
  kodlayan URI, açıklanmamış claim'leri sızdırır). Doğrulama başına çekim yerine
  toplu ön çekim zorunludur.
priority: Critical
related:
  - ADR-0008
  - SPEC-CRED-0001
  - SPEC-CRED-0002
  - SPEC-SCHEMA-0002
  - SPEC-BC-0001
  - SPEC-ID-0002
  - PM-TRUST-0001
depends_on:
  - ADR-0008
  - ADR-0006
adrs:
  - ADR-0008
---
> **Sürüm notu 1.0.6 (2026-09-30) — hedef sürüm sabitlendi:** Tamga profili IETF Token Status List **draft-20**'yi
> (2026-04-20) esas alır; AB de aynı sürümü CIR 2026/1731 (2979 Ek II, ETSI TS 119 472-1 V1.2.1 uyarlaması [25]) ile sabitledi.
> HAIP 1.0 draft-14'ü referans alır; AB profili geçerlidir. Biçim değişmedi (`statuslist+jwt`, `status_list {bits, lst}`, `ttl`).
> Not: AB, PID / QEAA / kamu EAA'da **askıya almayı yasaklar** (yalnız geçerli / iptal, iptal kalıcı). Tamga'nın `bits = 2`
> askı değeri (S2) nitelikli olmayan EAA içindir; kamu EAA yolu seçilirse o türlerde askı kullanılmaz (ayrı karar konusu).

> **Sürüm notu 1.0.5 (2026-09-28) — çapa zamanı geri gitmez:** `publishList`, önceki çapadan daha eski `publishedAt` ile yeni sürümü reddeder (`PublishedAtNotMonotonic`); aksi hâlde issuer yeni bir sürümü eski tarihli göstererek doğrulayıcının tazelik denetimini yanıltabilirdi. Faz B çapa günlüğünde zaten satır zamanı sıralıdır.

> **Sürüm notu 1.0.4 (2026-09-27) — S11 sağlamlaştırma:** status anahtarı güven listesinde kayıtlı (`delegate_keys[]`, `purpose: "status_list"`); doğrulayıcı token imzacısını eşler; liste dışı `idx` RED.

> **Sürüm notu 1.0.3 (2026-09-27) — Ş6/Ş7 Faz B okuması (protocol-reviewer bulgusu, iç inceleme O6):** Faz B'de çapa
> `anchors.jsonl` satırıdır (`list_id, issuer_id, list_uri, content_hash, list_version, published_at`) ve Status List Token
> **sürüm claim'i taşımaz**. Bu yüzden: (a) `anchor.status` ve (Ş7) `listSize` Faz B çapasında yoktur → bu iki denetim Faz 0'da
> (zincir çapası) geçerlidir; (b) geri alma sürümle değil **zamanla** yakalanır: `contentHash` uyuşmaz ve token `iat`'ı çapa
> `published_at`'ından saat toleransı dışında eskiyse — önbellek çapadan açıkça sonra çekildiyse RED, aksi hâlde DOĞRULANAMADI
> ([[SPEC-API-0001]] 1.3.2 D5); (c) çapa `list_uri` ile birebir eşleşmelidir. Faz 0'da token'a sürüm claim'i eklenmesi ayrı iş
> (ROADMAP). Değişmez metinleri değişmedi.

> **Sürüm notu 1.0.2 (2026-09-24) — ADR-0009 / ADR-0010 senkronu (DECISIONS §10.7):** **Faz B okuması** ([[ADR-0009]] K3): S1 'zincirde iptal biti yok' → 'listede/çapa günlüğünde iptal biti yok'; S4 'yayın CDN'e yazıldıktan sonra zincire' → '… sonra **çapa günlüğüne** (`anchors.jsonl`)'; D5 çapası `TrustSource.statusAnchor`. Değişmez metinleri değişmedi. Uygulama: `@tamga-network/issuer` (yayıncı) + `@tamga-network/verifier` (ön çekim önbelleği, S12).


# Kapsam

Bu spesifikasyon, Tamga'da bir credential'ın **iptal edilip edilmediğinin** nasıl
yayınlandığını, çapalandığını ve doğrulandığını tanımlar.

Karar ve gerekçeler [[ADR-0008]]'dedir; burada tekrar edilmez. Özet: bitstring
listesi **off-chain** host edilir, zincirde yalnızca URI + içerik hash'i +
sürüm çapası durur.

**Standart temeli:** IETF Token Status List (draft-ietf-oauth-status-list-**20**, 2026-04-20; AB CIR 2026/1731 ile aynı).
Taslak RFC Editor kuyruğunda; §12'deki sürüm notuna bakınız.

Kapsam dışı: kriptografik akümülatör / ZK iptal (`RS-REVOCATION-0001`, Faz 2).

---

# 1. Model ve Roller

```
┌─────────────┐   ihraç    ┌──────────┐   sunum   ┌──────────┐
│   Issuer    │──────────▶ │  Holder  │─────────▶ │ Verifier │
│ (üniversite)│            │ (cüzdan) │           │(işveren) │
└──────┬──────┘            └──────────┘           └────┬─────┘
       │ yayınlar                                      │ çeker
       ▼                                               ▼
┌──────────────────────────┐              ┌────────────────────┐
│  Status List Token       │◀─────────────│  önbellek / ön    │
│  status.<issuer-domain>  │              │  çekim (§9)        │
└──────────┬───────────────┘              └────────────────────┘
           │ hash + sürüm
           ▼
┌──────────────────────────┐
│  StatusListRegistry      │  ← zincir (yalnızca çapa)
└──────────────────────────┘
```

| Rol | Görev |
|---|---|
| **Status Provider** | Status List Token'ı üretir, imzalar, yayınlar. Varsayılan olarak issuer'ın kendisi. |
| **Referenced Token** | Durumu izlenen credential — Tamga'da SD-JWT VC. |
| **Anchor** | `StatusListRegistry` kontratındaki kayıt. |

**Terminoloji uyarısı:** Standart "Relying Party" der; Tamga'da bu **Verifier**'dır
([[SPEC-BC-0001]] `RelyingPartyRegistry` ile aynı kavram).

---

# 2. Referenced Token Tarafı

İptal listesi kullanan her Tamga credential'ı `status` claim'i taşır
([[SPEC-SCHEMA-0001]] §4.2 — `tamga.uses_status_list = true` olduğunda zorunlu):

```json
"status": {
  "status_list": {
    "idx": 48213,
    "uri": "https://status.bilgi.edu.tr/v1/sl/7f3a9c21"
  }
}
```

| Alan | Anlam |
|---|---|
| `idx` | Bu credential'ın listedeki indeksi |
| `uri` | Status List Token'ın adresi |

**`status` claim'i `sd: "never"`dir** — seçici açıklanamaz, her sunumda görünür.
Bunun mahremiyet sonuçları §6 ve §10'da ele alınmıştır.

---

# 3. Status List Token Formatı

## 3.1 Yapı

JWS compact serialization. Başlık:

```json
{
  "alg": "ES256",
  "kid": "sl-2026-a",
  "typ": "statuslist+jwt",
  "x5c": ["MIIB...", "MIIC..."]
}
```

Gövde:

```json
{
  "iss": "https://issuer.bilgi.edu.tr",
  "sub": "https://status.bilgi.edu.tr/v1/sl/7f3a9c21",
  "iat": 1789000000,
  "exp": 1789180000,
  "ttl": 3600,
  "status_list": {
    "bits": 2,
    "lst": "eNrbuRgAAhcBXQ..."
  }
}
```

| Claim | Zorunluluk | Tamga profili |
|---|---|---|
| `iss` | Zorunlu | Issuer tanımlayıcısı; Referenced Token'ın `iss`'i ile aynı güven zincirinde |
| `sub` | Zorunlu | Liste URI'si — Referenced Token'daki `uri` ile **birebir aynı** |
| `iat` | Zorunlu | Yayın anı |
| `exp` | **Tamga'da zorunlu** | `iat + 50 saat` (§8.2) |
| `ttl` | **Tamga'da zorunlu** | `3600` (saniye) — §8.1 |
| `status_list.bits` | Zorunlu | **Tamga'da her zaman `2`** — §3.3 |
| `status_list.lst` | Zorunlu | Sıkıştırılmış bayt dizisi, base64url |
| `status_list.aggregation_uri` | Opsiyonel | **Tamga'da önerilir** — §9.2 |

## 3.2 Servis edilme

```
GET /v1/sl/7f3a9c21 HTTP/1.1
Host: status.bilgi.edu.tr
Accept: application/statuslist+jwt

HTTP/1.1 200 OK
Content-Type: application/statuslist+jwt
Content-Encoding: gzip

eyJhbGciOiJFUzI1NiIsImtpZCI6InNsLTIwMjYtYSIsInR5cCI6InN0YXR1c2xpc3Qr...
```

- Yanıt gövdesi **ham JWS compact serialization**'dır — JSON zarf içine
  sarılmaz.
- `Content-Encoding: gzip` kullanılmalıdır (`lst` zaten sıkıştırılmıştır ama
  JWT'nin base64url gösterimi gzip'ten fayda görür).
- CWT biçimi (`application/statuslist+cwt`) Tamga Faz 0'da **kullanılmaz**;
  mdoc profiliyle birlikte Faz 1'de değerlendirilir ([[ADR-0006]]).

## 3.3 `bits = 2` kararı

Standart `bits` için 1, 2, 4 ve 8 değerlerine izin verir. Tamga **her zaman 2**
kullanır.

| Seçenek | Anlam | Tamga değerlendirmesi |
|---|---|---|
| `bits = 1` | Yalnızca geçerli/geçersiz | Askıya alma temsil edilemez |
| **`bits = 2`** | 4 durum | **Seçildi** |
| `bits = 4` / `8` | 16 / 256 durum | Boyut 2–4 katına çıkar, karşılığı yok |

Durum değerleri ve Tamga karşılıkları:

| Değer | Standart adı | Tamga anlamı |
|---|---|---|
| `0x00` | VALID | Geçerli |
| `0x01` | INVALID | **Kalıcı iptal** — geri dönüşü yok |
| `0x02` | SUSPENDED | **Geçici askı** — geri alınabilir |
| `0x03` | (ayrılmış) | Tamga'da kullanılmaz |

**Askı neden gerekli:** Bir diploma hakkında intihal soruşturması açıldığında
kurum belgeyi kalıcı iptal etmek istemez — soruşturma sonuçlanana kadar askıya
almak ister. `bits = 1` seçseydik kurum ya haksız yere kalıcı iptal edecek ya da
hiçbir şey yapmayacaktı. İkisi de yanlış.

**Boyut maliyeti:** 100.000 indeks × 2 bit = 25 KB ham, sıkıştırılmış tipik
olarak birkaç yüz bayt (liste büyük ölçüde sıfırdır). İhmal edilebilir.

## 3.4 İmzalama anahtarı

Status List Token, credential imzalama anahtarından **ayrı bir anahtarla**
imzalanır; ancak **aynı X.509 zincirine** bağlıdır ([[SPEC-ID-0002]]).

Gerekçe:

1. **Kullanım sıklığı farkı.** Credential anahtarı seyrek kullanılır ve HSM'de
   durur. Status anahtarı saatte bir imza atar; çevrimiçi bir sistemde durması
   gerekir. İkisini aynı yapmak, HSM'deki anahtarı sürekli çevrimiçi bir servise
   açmak demektir.
2. **Sıkıntı yalıtımı.** Status anahtarı ele geçirilirse saldırgan sahte
   *durum* yayınlayabilir ama sahte *diploma* üretemez.
3. **Rotasyon.** Status anahtarı yılda rotasyona sokulabilir; credential anahtarı
   rotasyonu geçmiş belgeleri etkileyeceği için çok daha ağır bir işlemdir.

`kid` her zaman doldurulur ve rotasyonda değişir.

---

# 4. Zincir Çapası

## 4.1 `contentHash` neyin hash'i

```
contentHash = SHA-256( JWS compact serialization dizesinin ASCII baytları )
```

Yani `Content-Encoding: gzip` **çözüldükten sonraki** dize. Nokta ayraçlarıyla
birlikte, tam token.

**Değişmez:** Aynı sürüm numarasına sahip token her zaman aynı baytlardır. Status
Provider aynı `version` için farklı bayt üretemez.

## 4.2 Kontrat arayüzü

[[ADR-0008]] Karar 4 gereği `StatusListRegistry.sol` **yeniden yazılmıştır.**
Bitmap tutan eski sürüm geçersizdir.

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IStatusListRegistry {
    enum ListStatus { NONE, ACTIVE, RETIRED }

    struct ListAnchor {
        bytes32    issuerId;
        string     listURI;       // Status List Token'ın sub claim'i
        bytes32    contentHash;   // §4.1
        uint32     listSize;      // toplam indeks kapasitesi
        uint8      bitsPerEntry;  // Tamga'da her zaman 2
        uint64     version;       // monoton artan
        uint64     publishedAt;   // son yayın zamanı
        ListStatus status;
    }

    /// @notice Tamga profili: liste en az bu kadar indeks kapasitesine sahip olmalı.
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

    /// @notice Her yayın döngüsünde çağrılır (§5). version monoton artmalıdır.
    function publishList(
        bytes32 listId,
        bytes32 contentHash,
        uint64 version,
        uint64 publishedAt
    ) external;

    function retireList(bytes32 listId, string calldata reason) external;

    function getListAnchor(bytes32 listId) external view returns (ListAnchor memory);

    /// @notice Doğrulamada kullanılır: hash eşleşiyor mu ve sürüm yeterince taze mi?
    function matchesContentHash(bytes32 listId, bytes32 hash) external view returns (bool);
}
```

## 4.3 Kaldırılan arayüzler

Aşağıdakiler **kaldırılmıştır** ve yeniden eklenmemelidir:

| Kaldırılan | Nerede | Neden |
|---|---|---|
| `setRevoked(issuerId, index)` | `StatusListRegistry.sol` | Zincir artık bit tutmuyor |
| `setRevokedBatch(...)` | aynı | aynı |
| `unsetRevoked(...)` | aynı | aynı |
| `getChunk(issuerId, chunkIndex)` | aynı | aynı |
| `_setBit(...)` | aynı | aynı |
| `IStatusList.isRevoked(issuerId, index)` | `ITrustQueries.sol` | Zincir bu soruyu **cevaplayamaz** |

Son satır kritiktir. Cevaplanamayacak bir soruyu soran arayüz bırakmak,
çağıranın `false` dönüşünü "iptal edilmemiş" sanmasına yol açar. Arayüz
kalkmalıdır ki derleme hatası versin.

**Bağımlı etki:** `CredentialGate.sol` iptal durumunu zincirden okuyamaz.
[[ADR-0008]] Sonuçlar §3 uyarınca zincir-üstü credential-gating, çağıranın
sunduğu taze bir kanıta dayanmak zorundadır → `SPEC-AGENT-0001`.

---

# 5. Yayın Döngüsü

## 5.1 Sabit aralık ve gürültü

Status Provider listeyi **sabit aralıklarla** yeniden yayınlar. Varsayılan
aralık: **1 saat.**

**Değişiklik olmasa da yayınlanır.** Bu isteğe bağlı değildir.

Gerekçe ([[ADR-0008]] §1): yalnızca iptal olduğunda yayınlanırsa, zincirdeki
`publishList` işleminin varlığı "bu saatte bir iptal oldu" bilgisini ağdaki tüm
validator'lara sızdırır. Blok zaman damgası ile birleşince — bir disiplin
kararının tarihi, bir işten ayrılma günü — belge sahibi daraltılabilir.

Sabit döngüde dışarıdan görünen tek şey "listenin yeni sürümü var"dır. Hangi
bitin değiştiği, hatta bir bitin değişip değişmediği görünmez.

## 5.2 Yayın algoritması

```
Her T aralığında (varsayılan 3600 sn):

  1. Bekleyen durum değişikliklerini kuyruktan al (varsa; boş olabilir).
  2. Bitstring'i güncelle.
  3. Sıkıştır → lst.
  4. Token gövdesini oluştur:
       iat = şimdi, exp = şimdi + 50sa, ttl = 3600, version = öncekiler + 1
  5. Status anahtarıyla imzala → JWS compact serialization.
  6. contentHash = SHA-256(dizenin ASCII baytları)
  7. CDN'e / status sunucusuna yaz.          ← ÖNCE
  8. publishList(listId, contentHash, version, iat)   ← SONRA
```

**Adım 7–8 sırası bağlayıcıdır.** Ters sırada, zincirde kayıtlı ama
erişilemeyen bir sürüm oluşur ve tüm doğrulamalar §7 Adım 6'da takılır.

## 5.3 Aralık ile tazelik ilişkisi

En kötü durumda bir iptal, bir yayın aralığı kadar gecikmeyle görünür
hâle gelir. Varsayılan 1 saatte bu kabul edilebilir.

Daha kısa aralık gereken şemalar için `tamga` bloğunda tanımlanabilir; ancak
aralık kısaldıkça zincire yazma sıklığı artar. **10 dakikanın altına inilmesi
önerilmez.**

**Acil durum:** Aralık dışı yayın **yapılmaz** — §5.1'in mahremiyet faydasını
yok eder. Acil bir iptal gerekiyorsa doğru araç status list değil, issuer
sertifikasının askıya alınmasıdır ([[SPEC-ID-0002]]) veya şemanın
`REVOKED` edilmesidir ([[SPEC-SCHEMA-0001]] §9.2).

---

# 6. İndeks Tahsisi — Mahremiyet Kritik

Bu bölüm, spesifikasyonun en kolay yanlış uygulanan kısmıdır.

## 6.1 İndeksler RASTGELE tahsis edilir

`idx` değeri, listenin kapasitesi içinden **kriptografik olarak rastgele**
seçilir. Sıralı sayaç **kullanılmaz.**

**Sıralı tahsis neyi sızdırır:** `idx` claim'i `sd: never`dir — her sunumda
görünür. Sıralı tahsiste `idx = 12` olan bir mezun, o listede 12. sırada belge
almış kişidir. Bu:

- Mezuniyet/kayıt **sırasını** açığa vurur
- İki mezunun `idx` farkı, aralarındaki zaman farkını yaklaşık verir
- Küçük bölümlerde kişiyi neredeyse tekilleştirir
- Mezun `awarding_date`'i açıklamamış olsa bile tarihi yaklaşık ele verir

Yani seçici açıklamayla gizlenen bilgi, indeks üzerinden sızar.

## 6.2 Doluluk oranı

Rastgele tahsis tek başına yetmez. Liste büyük ölçüde boşsa, dolu indekslerin
dağılımı yine bilgi taşır.

| Kural | Değer |
|---|---|
| Asgari liste kapasitesi | **100.000** indeks |
| Azami doluluk | %80 — aşılırsa yeni liste açılır |
| Asgari başlangıç gürültüsü | Liste oluşturulurken kapasitenin **%1'i** rastgele indeks "tahsis edilmiş" olarak işaretlenir; bit değeri `0x00` (geçerli) kalır ve hiçbir credential'a bağlı değildir — dışarıdan gerçek girişlerden ayırt edilemez |

Son madde, yeni bir listenin ilk günlerinde tek bir mezunun tek dolu indeks
olmasını engeller.

## 6.3 Liste URI'si OPAK olmalıdır

**Bu kural yazım sırasında yakalanan bir sızıntıyı kapatır.**

Liste URI'si `sd: never` olan `status` claim'i içinde taşınır — yani **her
sunumda verifier tarafından görülür.** Dolayısıyla URI'nin kendisi bir
claim'dir.

Yasak desenler:

| URI | Ne sızdırır |
|---|---|
| `.../sl/edu-2026-a` | **Mezuniyet yılı** — `awarding_date` gizlenmiş olsa bile |
| `.../sl/muhendislik` | Fakülte/bölüm — `programme_title` gizlenmiş olsa bile |
| `.../sl/lisans-2026-guz` | Kohort — ikisi birden |
| `.../sl/tip-fakultesi-2024` | Her ikisi + mesleki bilgi |

**Kural:** Liste tanımlayıcısı **opak** olmalıdır — anlamsız, rastgele üretilmiş
bir dize:

```
https://status.bilgi.edu.tr/v1/sl/7f3a9c21
```

Status Provider bu tanımlayıcı ile kohort arasındaki eşlemeyi **kendi
içinde** tutar; dışarıya çıkmaz.

## 6.4 Listeler nasıl bölünür

Kapasite dolduğunda yeni liste açılır. Bölme ölçütü:

| Ölçüt | Değerlendirme |
|---|---|
| Yıl / dönem bazlı | **Yasak** — §6.3 ile aynı sızıntı, URI opak olsa bile listeye dahil olmak yılı ele verir |
| Bölüm / fakülte bazlı | **Yasak** — aynı gerekçe |
| Şema (credential tipi) bazlı | **Kaçınılmaz ve zararsız** — `vct` zaten açıkta |
| Kapasite dolunca sıradaki | **Önerilen** |

Yani tek ayrım ekseni credential tipidir; onun dışında yeni liste yalnızca eski
liste dolduğu için açılır ve içine giren credential'lar tip dışında hiçbir
ortak özelliği paylaşmaz.

**Uygulama notu:** Bu, "2026 mezunları A listesinde" gibi doğal görünen ve
operasyonel olarak kolay olan tasarımı yasaklar. İdari kolaylık, mahremiyet
sızıntısına değmez.

---

# 7. Doğrulama Algoritması (Verifier)

Normatif. `status` claim'i taşıyan her credential için çalıştırılır.

```
Ş1.  Credential'da status.status_list var mı?
     Şema tamga.uses_status_list = true diyorsa ve claim yoksa → RED.

Ş2.  idx ve uri'yi al. uri'nin şeması https değilse → RED.

Ş3.  Status List Token'ı elde et:
     a) Ön çekim önbelleğinde var mı ve taze mi (§8)? → kullan.
     b) Yoksa GET <uri>, Accept: application/statuslist+jwt
     c) Hiçbiri olmazsa → "DOĞRULANAMADI" (RED değil, §7.1)

Ş4.  Token'ı doğrula:
     - typ == "statuslist+jwt"
     - imza geçerli, x5c zinciri issuer'ın X.509 zincirine bağlanıyor
       (SPEC-ID-0002); kök RootCARegistry'de çapalı
     - sub == credential'daki uri  → değilse RED
     - iss, credential'ın iss'i ile aynı güven zincirinde → değilse RED

Ş5.  Tazelik:
     - exp geçmişse → "DOĞRULANAMADI"
     - iat + ttl < şimdi ise token bayat; politikaya göre yenile veya
       "DOĞRULANAMADI"
     (HTTP önbellek başlıkları değil, exp/ttl claim'leri belirleyicidir)

Ş6.  ZİNCİR ÇAPASI:
     listId = keccak256(issuerId, sub)
     anchor = StatusListRegistry.getListAnchor(listId)
     - anchor.status == ACTIVE  → değilse RED
     - SHA-256(token baytları) == anchor.contentHash → değilse RED
     - token içindeki version, anchor.version'dan küçükse → RED (geri alma)

Ş7.  Kapasite: idx < anchor.listSize → değilse RED

Ş8.  lst'yi aç (dekompresyon), bits=2 ile idx konumundaki değeri oku.

Ş9.  Değeri yorumla:
     0x00 → GEÇERLİ
     0x01 → İPTAL EDİLMİŞ   → RED
     0x02 → ASKIDA           → RED (kullanıcıya "askıda" olarak gösterilir)
     0x03 → tanınmayan       → RED

Ş10. Sonucu, kullanılan token'ın version ve iat değerleriyle birlikte
     denetim kaydına yaz.
```

## 7.1 "Geçersiz" ile "doğrulanamadı" ayrımı

Ş3(c) ve Ş5'te sonuç **"geçersiz" değil "doğrulanamadı"**dır ve verifier bu
ikisini kullanıcıya **farklı** göstermek zorundadır.

"Bu diploma iptal edilmiş" ile "şu an iptal durumunu kontrol edemiyorum"
arasındaki fark, bir insanın işe alınıp alınmamasıdır. Aynı ayrım
[[SPEC-SCHEMA-0001]] §7'de şema çözümlemesi için de geçerlidir.

## 7.2 Ş6 neden atlanamaz

Zincir çapası olmadan, issuer kendi sunucusundaki listeyi sessizce geri
alabilir — iptal ettiği bir belgeyi tekrar "geçerli" gösterebilir. `version`
monotonluğu ve `contentHash` eşleşmesi bunu engeller.

---

# 8. Önbellek ve Tazelik

## 8.1 `ttl` ve `exp`

| Claim | Tamga değeri | Anlam |
|---|---|---|
| `ttl` | `3600` | Verifier bu süre boyunca yeniden çekmeden kullanabilir |
| `exp` | `iat + 50 saat` | Bu andan sonra token kesinlikle kullanılamaz |

`exp` neden `ttl`den çok daha uzun: `ttl` "tazelik hedefi", `exp` "mutlak
sınır"dır. Status sunucusu birkaç saat kesinti yaşarsa, elindeki token'la
doğrulama yapmaya devam edebilmek gerekir. 50 saat, bir hafta sonu kesintisini
kapsar.

**Belirleyici olan claim'lerdir.** Standart, doğrulayan tarafın HTTP önbellek
başlıklarından önce token'ın `exp` ve `ttl` claim'lerine öncelik vermesini
gerektirir. CDN'in `Cache-Control` başlığı bunu geçersiz kılamaz.

## 8.2 Şema bazlı tazelik eşikleri

Verifier, risk seviyesine göre daha katı davranabilir:

| Risk | Azami kabul edilen token yaşı |
|---|---|
| Düşük | `ttl` (1 saat) yeterli |
| Orta | 6 saat |
| Yüksek (resmî işlem) | 1 saat, ve `version` zincir çapasıyla birebir |

## 8.3 Çevrimdışı doğrulama

Zincir çapası (Ş6) okunamıyorsa doğrulama tam yapılamaz. Verifier çevrimdışı
modda:

- Önbellekteki token ve son bilinen çapa ile devam edebilir,
- Kullanıcıya **son senkronizasyon zamanını** göstermek zorundadır,
- Sonucu "çevrimdışı doğrulandı" olarak işaretler.

---

# 9. Mahremiyet

## 9.1 Doğrulama başına çekim yasaktır

**En önemli mahremiyet kuralı budur.**

Verifier her doğrulamada `GET <uri>` yaparsa, Status Provider şunu öğrenir:

> "Şu anda birisi, benim X listemden bir credential'ı doğruluyor."

Kaynak IP verifier'ı ele verir. Bir üniversite, mezunlarının hangi işverenlere
başvurduğunu böyle öğrenebilir — kâğıt diplomada olmayan yeni bir takip
kanalıdır.

**Kural:** Verifier'lar Status List Token'ları **zamanlanmış toplu ön çekimle**
alır (öneri: `ttl` aralığında), doğrulama anında değil. Doğrulama önbellekten
yapılır.

`@tamga-network/verifier` SDK'sı bu davranışı **varsayılan** yapar; doğrulama başına
çekim ancak açıkça etkinleştirilerek mümkün olmalıdır ([[ARCH-0005]]).

## 9.2 Status List Aggregation

Standart, issuer'ın kendi liste URI'lerini toplu yayınlamasına izin veren
opsiyonel bir toplama mekanizması tanımlar (`aggregation_uri`).

Tamga'da **önerilir**: verifier, bir issuer'ın tüm listelerini tek adresten
keşfedip toplu indirebilir. §9.1'in uygulanmasını pratikleştirir.

## 9.3 Sürü mahremiyeti (herd privacy)

Bir listedeki indeks sayısı ne kadar azsa, `idx`'in taşıdığı ayırt edicilik o
kadar yüksektir. §6.2'deki 100.000 asgari kapasite ve %1 başlangıç gürültüsü bu
yüzdendir.

**Küçük kurum problemi:** 300 mezunu olan bir meslek yüksekokulu, 100.000'lik
listede 300 dolu indeks demektir. Liste büyük ama sürü küçüktür. Bu durumda
sürü, listeyle değil **kurumla** sınırlıdır ve teknik bir çözümü yoktur — zaten
`iss` claim'i kurumu açıkça söylemektedir.

Kabul edilmiş sınırlama olarak kaydedilmiştir.

## 9.4 Çözülmeyen: `idx` korelasyonu

`idx` + `uri` çifti sabittir ve `sd: never`dir. Aynı diplomayı iki farklı
verifier'a sunan bir mezun, o iki verifier iş birliği yaparsa eşleştirilebilir.

Bu, Token Status List'in bilinen ve yapısal bir sınırıdır. Çözümü **batch
issuance**'tır: her sunum için farklı `idx` taşıyan ayrı bir credential kopyası
([[SPEC-CRED-0001]] §5, [[SPEC-SCHEMA-0002]] §2.1.3).

**Faz 0'da kabul edilen risktir ve pilot katılımcılarına açıkça
bildirilmelidir** → [[PM-GTM-0001]].

---

# 10. İşletim

## 10.1 Bileşen

| Özellik | Değer |
|---|---|
| Adres | `status.<issuer-domain>` |
| İçerik | Statik dosya (imzalı token), CDN arkasında |
| Yazma | Yayın işi (cron), saatte bir |
| Anahtar | Status imzalama anahtarı, çevrimiçi, credential anahtarından ayrı (§3.4) |
| Erişilebilirlik hedefi | %99,5 — `exp`=50sa tamponu sayesinde kritik yolda değil |

Her issuer için ayrı bir bileşendir ve issuer onboarding kontrol listesine
girer ([[ARCH-0004]]).

## 10.2 Küçük kurum ve merkezîleşme riski

Her issuer'ın status sunucusu işletmesi küçük kurumlar için ağır olabilir.
Tamga barındırma hizmeti sunabilir — **ama o zaman Tamga ağdaki tüm iptalleri
görür.**

Bu gerçek bir merkezîleşme noktasıdır ve [[PM-GOV-0001]] Karar P1'de politikaya
bağlanmıştır: imzalama anahtarı kurumda kalır (vakıf sahte durum yayınlayamaz),
erişim logu tutulmaz, barındırılan issuer listesi kamuya açıktır ve aktif
issuer'ların %30'u aşılırsa konsey gündemine girer.

## 10.3 Felaket senaryoları

| Senaryo | Etki | Kurtarma |
|---|---|---|
| Status sunucusu kesinti | 50 saate kadar önbellekten devam | Sunucu geri gelir |
| Status anahtarı kaybı | Yeni yayın yapılamaz | Yeni anahtar + `kid` rotasyonu, aynı liste devam eder |
| Status anahtarı ele geçirilmesi | Sahte durum yayınlanabilir | Sertifika iptali → tüm token'lar Ş4'te düşer → yeni anahtarla yeniden yayın |
| Liste dosyasının kaybı | Doğrulama durur | Bitstring issuer veritabanından yeniden üretilir; **zincirdeki `contentHash` geçmiş sürümü doğrulamak için saklanır** |

Son satır, issuer'ın iptal kuyruğunu kalıcı olarak saklamasını gerektirir.
Liste türetilmiş bir üründür; kaynak veritabanıdır.

---

# 11. Değişmezler

| # | Değişmez |
|---|---|
| **S1** | Zincirde hiçbir iptal biti yoktur; yalnızca çapa. |
| **S2** | `bits` her zaman `2`'dir. |
| **S3** | `version` monoton artar; azalan sürüm reddedilir. |
| **S4** | Yayın CDN'e yazıldıktan **sonra** zincire kaydedilir (§5.2). |
| **S5** | Değişiklik olmasa da sabit aralıkta yayınlanır (§5.1). |
| **S6** | Aralık dışı ("acil") yayın yapılmaz. |
| **S7** | `idx` rastgele tahsis edilir; sıralı sayaç kullanılmaz (§6.1). |
| **S8** | Liste URI'si opaktır; yıl, bölüm, kohort kodlamaz (§6.3). |
| **S9** | Listeler tip dışında hiçbir ölçütle bölünmez (§6.4). |
| **S10** | Liste kapasitesi ≥ 100.000; doluluk ≤ %80. |
| **S11** | Status anahtarı, credential imzalama anahtarından ayrıdır (§3.4). Status anahtarının sertifika parmak izi güven listesinde kurum kaydının `delegate_keys[]` alanında `purpose: "status_list"` ile yayınlanır; doğrulayıcı D3'te token imzacısını bu kayıtla eşler (kayıt yoksa INDETERMINATE, eşleşmezse REJECTED). Liste dışı `idx` geçerli okunmaz (D6 RED). |
| **S12** | Verifier doğrulama başına çekim yapmaz; toplu ön çekim kullanır (§9.1). |
| **S13** | `exp`/`ttl` claim'leri HTTP önbellek başlıklarını geçersiz kılar. |
| **S14** | "Geçersiz" ile "doğrulanamadı" kullanıcıya farklı gösterilir (§7.1). |

---

# 12. Standart Sürüm Notu

Bu doküman yazıldığında IETF Token Status List **taslak** aşamasındaydı. Hedef sürüm **draft-20**'dir (2026-04-20; AB
CIR 2026/1731 aynı sürümü sabitledi; 2026-09-30 itibarıyla draft-21 RFC Editor kuyruğunda). RFC'ye dönüşürken şunlar değişebilir:

- Medya tipi adları (`application/statuslist+jwt`)
- `typ` başlık değeri (`statuslist+jwt`)
- Toplama (aggregation) mekanizmasının ayrıntıları
- Durum değeri kayıt defterinin içeriği

**Değişmeyecek olanlar:** §6 (indeks tahsisi ve URI opaklığı), §9.1 (ön çekim)
ve §5.1 (sabit döngü) Tamga'ya özgü mahremiyet kararlarıdır ve standarttan
bağımsızdır.

Standardın RFC'ye dönüşmesi hâlinde bu doküman MINOR sürümle güncellenir;
§11 değişmezleri etkilenmez.

---

# Açık Konular

1. ~~`ttl = 3600` ile zincire saatte bir yazmanın zincir yükü~~ —
   **KAPANDI** (2026-09-09, [[ARCH-0004]] §7). 1.000 issuer = günde 24.000 işlem
   = **0,28 TPS**; 2 sn'lik blokta blok başına 0,55 işlem. QBFT için ihmal
   edilebilir. Kalıcı durum da büyümez: `publishList` mevcut slot'ların üzerine
   yazar. Asıl büyüyen arşiv geçmişidir, yılda ~1,8 GB.
2. Askı (`0x02`) durumundan geçerliye dönüş, verifier'ın denetim kaydında nasıl
   temsil edilir? Geçmişe dönük "o an askıdaydı" sorgusu gerekiyor mu?
3. §6.2'deki %1 başlangıç gürültüsü, sahte indeksleri "tahsis edilmiş" saydığı
   için kapasiteyi tüketir. Daha zarif bir çözüm var mı?
4. Status List Aggregation zorunlu mu olmalı? Şu an "önerilir"; verifier tarafı
   ön çekimi ciddiye alırsa zorunlu yapmak mantıklı olabilir.
5. Çoklu Status Provider (bir issuer'ın birden çok listesi farklı sunucularda)
   destekleniyor mu? Şu an örtük olarak evet; açıkça yazılmalı mı?

---

# İlgili Dokümanlar

[[ADR-0008]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-SCHEMA-0001]] ·
[[SPEC-SCHEMA-0002]] · [[SPEC-BC-0001]] · [[SPEC-ID-0002]] · [[PM-TRUST-0001]] ·
[[ARCH-0004]] · [[ARCH-0005]] · [[PM-GOV-0001]] · [[PM-GTM-0001]]

---

# Durum

**Draft** — 2026-09-09. Token formatı ayrıntıları (claim adları, `bits` izinli
değerleri, medya tipi, `exp`/`ttl` önceliği) birincil kaynaktan doğrulanmıştır.
`StatusListRegistry.sol` bu spesifikasyona göre yeniden yazılacaktır
([[SPEC-BC-0001]] yeniden yazımı kapsamında).
