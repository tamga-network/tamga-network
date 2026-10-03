---
document_id: SPEC-BC-0001
title: "Güven katmanı kontratları"
status: Active
version: 1.0.0
created: 2026-08-05
last_updated: 2026-10-02
summary: >
  Hyperledger Besu (EVM) üzerinde çalışan güven katmanı kontratlarının kanonik
  veri şeması, fonksiyon arayüzleri ve değişmezleri. Sürüm 2.0.0 üç yapısal
  değişiklik getirir: (1) SchemaRegistry eklendi ve IssuerRegistry'ye issuer↔şema
  yetkilendirmesi girdi ([[ADR-0007]]); (2) StatusListRegistry bitmap tutmaktan
  vazgeçip yalnızca çapa tutar hâle geldi, isRevoked arayüzü kaldırıldı
  ([[ADR-0008]]); (3) RootCARegistry ilk kez spesifikasyona alındı — kontratlarda
  vardı, dokümanda yoktu. Ayrıca yükseltme deseni (UUPS), rol modeli, gas/izin
  politikası ve doğrulama okuma seti normatifleştirildi. Egemenlik
  onlyOwnerState ile kodda; zincir kişisel veri tutmaz ([[PM-TRUST-0001]]).
---

# Kapsam

Bu spesifikasyon güven katmanının **"nasıl"ını** tanımlar: kontrat veri
yapıları, fonksiyon imzaları, erişim kısıtları, roller ve değişmezler.

Kararlar [[ADR-0002]] (yönetişim), [[ADR-0001]] (motor), [[ADR-0007]] (şema
kaydı) ve [[ADR-0008]] (status list yerleşimi) ile sabitlenmiştir.

**Değişmez ilke:** Zincir yalnızca kişisel-OLMAYAN güven referansları tutar
([[PM-TRUST-0001]]). Hiçbir kontrat kişisel veri, credential içeriği veya
credential hash'i saklamaz.

## 1.0.0 → 2.0.0 değişiklikleri

| # | Değişiklik | Kaynak |
|---|---|---|
| 1 | **`SchemaRegistry` eklendi** (§4) | [[ADR-0007]] |
| 2 | **`IssuerRegistry`'ye şema yetkisi eklendi** (§3.4) | [[ADR-0007]] Karar 6 |
| 3 | **`StatusListRegistry` yeniden yazıldı** — bitmap kaldırıldı, çapa modeli (§7) | [[ADR-0008]] |
| 4 | **`isRevoked` arayüzü kaldırıldı** — zincir bu soruyu cevaplayamaz (§7.3) | [[ADR-0008]] |
| 5 | **`RootCARegistry` spesifikasyona alındı** (§2) — kontratta vardı, dokümanda yoktu | Denetim bulgusu |
| 6 | Yükseltme deseni **UUPS** olarak karara bağlandı (§9) | Açık Konu 4 kapatıldı |
| 7 | Rol modeli ve gas/izin politikası normatifleştirildi (§10, §12) | Yeni |
| 8 | Doğrulama okuma seti 3'ten **5**'e çıktı (§11.2) | 1 ve 3'ün sonucu |
| 9 | §5'teki "kullanılmayan index rastgele dağıtılır" ifadesi [[SPEC-CRED-0003]] §6'ya devredildi | [[ADR-0008]] |

---

# 0. Egemenlik ve Namespace

Her devletin bir **namespace**'i vardır; o alana yalnızca o devletin yetkili
anahtarı yazabilir. [[ADR-0002]] Katman 2 egemenliğinin kod garantisidir.

```solidity
/// stateCode: ISO 3166-1 alpha-2 (bytes2) — "TR", "KZ", "AZ", "KG", "UZ", "TM"
modifier onlyOwnerState(bytes2 stateCode) {
    if (!_isDelegateOf(msg.sender, stateCode)) revert NotOwnerState(stateCode, msg.sender);
    _;
}
```

- Namespace deseni: `TR:issuer:*`, `KZ:rp:*`, `TR:schema:*`.
- Yetkili anahtarlar `Governance` içindeki `StateMember.delegateKeys`'ten gelir.
- Türkiye'nin anahtarı `KZ:` ile başlayan hiçbir kaydı değiştiremez → revert.

**Değişmez N1:** Hiçbir yazma fonksiyonu, namespace sahibi olmayan bir çağırana
açık olamaz. Tek istisna `NETWORK` katmanı işlemleridir ve onlar `Governance`
yürütmesinden gelir (§4.3).

---

# 1. Governance Kontratı (Katman 1)

Kapsam **dar**: yalnızca ağ üyeliği ve protokol. Ulusal kayıtlar burada
değildir.

```solidity
enum MemberStatus { NONE, ACTIVE, SUSPENDED, WITHDRAWN }

struct StateMember {
    bytes2       stateCode;
    address      validatorAddress;   // QBFT validator node adresi
    address[]    delegateKeys;       // registry yazma yetkisi
    MemberStatus status;
    uint64       joinedAt;
}

function proposeStateAdmission(bytes2 stateCode, address validator) external onlyValidator returns (bytes32);
function proposeStateRemoval(bytes2 stateCode, string calldata reason) external onlyValidator returns (bytes32);
function proposeProtocolUpgrade(address target, address newImplementation) external onlyValidator returns (bytes32);
function proposeNetworkSchema(ISchemaRegistry.SchemaRecord calldata rec) external onlyValidator returns (bytes32);

function vote(bytes32 proposalId, bool support) external onlyValidator;
function execute(bytes32 proposalId) external;

/// Tek taraflı çıkış — oy gerekmez (ADR-0002 #5)
function withdraw() external onlyValidator;

/// Devletin kendi iç işi — oy gerekmez
function setDelegateKeys(bytes2 stateCode, address[] calldata keys) external onlyOwnerState(stateCode);
```

**Eşikler ([[ADR-0002]]):** kabul **2/3**; çıkarma **2/3** (çıkarılanın oyu
sayılmaz); protokol yükseltme **2/3**; NETWORK şeması **2/3** (§4.3).

**Asgari mutlak oy = 2 (2.1.0 — review bulgusu R6):** 2/3 kuralı n<3'te
dejenere olur. İki üyeli ağda çıkarma oylamasında eligible=1 → required=1;
yani **bir devlet diğerini tek başına atabilirdi**. `requiredVotes` artık
`max(ceil(2n/3), 2)` döner. Sonuç: iki üyeli ağda çıkarma **imkânsızdır** —
iki taraf da yalnızca gönüllü `withdraw` edebilir. Bu bilinçli bir anayasal
korumadır; üçüncü üye gelene kadar ağ bir ortaklık gibi davranır.

**Yeniden kabul (2.1.0 — R7):** `SUSPENDED`/`WITHDRAWN` bir devlet
`proposeStateAdmission` ile yeniden kabul edilebilir; eski validator ve delegate
eşlemeleri temizlenir. 2.0.0'da `MemberExists` kontrolü `NONE` dışındaki her
durumda revert ediyordu — çıkarılan bir devlet **asla** geri dönemiyordu.

**`setSchemaRegistry` erişimi (2.1.0 — R5):** 2.0.0'da bu fonksiyon
**herkese açıktı** (ilk çağıran kazanıyordu). `onlyValidator` oldu.

**Değişmezler:**

- **GV1** — Çıkarma/çıkış yalnızca yeni yazımı ve blok üretimini durdurur;
  **mevcut kayıtları ve credential'ları geçersiz kılmaz** ([[ADR-0002]] #4).
- **GV2** — `proposeNetworkSchema` 2.0.0'da eklendi; NETWORK katmanı şemalarının
  tek giriş yoludur.

---

# 2. Root CA Registry Kontratı (Katman 2)

> **Yeni bölüm.** Bu kontrat `contracts/src/` altında mevcuttu ancak
> spesifikasyonda tanımlı değildi. 2026-09-09 denetiminde tespit edildi.

Her üye devletin bir veya birden çok ulusal Root CA'sı vardır. Issuer
sertifika zincirleri buraya bağlanır ([[SPEC-ID-0002]]).

```solidity
enum CAStatus { NONE, ACTIVE, SUSPENDED, RETIRED, REVOKED }  // RETIRED: 2.1.0

struct RootCA {
    bytes32  caId;              // keccak256(stateCode, certFingerprint)
    bytes2   stateCode;
    bytes32  certFingerprint;   // SHA-256(DER kodlu sertifika)
    bytes32  subjectHash;
    string   certURI;           // sertifikanın kendisi off-chain
    string   crlURI;            // iptal listesi
    CAStatus status;
    uint64   validFrom;
    uint64   validUntil;
    uint64   registeredAt;
}

function registerRootCA(RootCA calldata data) external onlyOwnerState(data.stateCode);
function suspendRootCA(bytes32 caId) external onlyOwnerState(_stateOf(caId));
function revokeRootCA(bytes32 caId, string calldata reason) external onlyOwnerState(_stateOf(caId));

function retireRootCA(bytes32 caId, bytes32 successorCA) external onlyOwnerState(_stateOf(caId)); // 2.1.0

function isValidRootCA(bytes32 caId) external view returns (bool);       // yeni issuer bağlanabilir mi — yalnızca ACTIVE
function isChainAcceptable(bytes32 caId) external view returns (bool);   // zincir doğrulanır mı — ACTIVE veya RETIRED (2.1.0)
function getRootCA(bytes32 caId) external view returns (RootCA memory);
function getRootCAsByState(bytes2 stateCode) external view returns (bytes32[] memory);
```

**Sertifikanın kendisi zincirde değildir** — yalnızca parmak izi ve URI. Aynı
"içerik off-chain, çapa on-chain" deseni ([[ADR-0007]], [[ADR-0008]]).

**Değişmezler:**

- **CA1** — `certFingerprint` bir kez yazılır, asla güncellenmez. Yeni sertifika
  = yeni `caId`.
- **CA2** — İki ayrı durum vardır ve **karıştırılması 2.0.0'daki hataydı**:
  - `RETIRED` (planlı rotasyon): yeni issuer bağlanamaz, **mevcut issuer'lar
    çalışmaya devam eder** (status yayını dahil) ve eski credential'lar
    doğrulanır. `isChainAcceptable` true.
  - `REVOKED` (ele geçirilme): sert. Zincir doğrulaması düşer,
    `isCredentialAcceptable` false. Ama `isOperational` **hâlâ true** — çünkü
    ele geçirilmiş CA altındaki issuer'ın sahte belgeleri iptal
    yayınlayabilmesi gerekir.
  - 2.0.0'da rotasyon ile ele geçirilme aynı durumdu ve rutin bir CA
    rotasyonu, o CA'ya bağlı tüm issuer'ların status yayınını durdurup 50 saat
    sonra tüm doğrulamaları `INDETERMINATE`'e düşürürdü. Review bulgusu **R2**.

---

# 3. Issuer Registry Kontratı (Katman 2)

```solidity
enum IssuerCategory  { GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS }   // ADR-0014: yeni değer yalnızca sona
enum IssuerAssurance { I1, I2, I3 }        // PM-ASSUR-0001 Eksen B
enum IssuerStatus    { NONE, ACTIVE, SUSPENDED, REVOKED }

struct Issuer {
    bytes32         issuerId;         // keccak256(stateCode, certFingerprint)
    bytes2          stateCode;
    bytes32         nameHash;
    IssuerCategory  category;
    IssuerAssurance assurance;
    bytes32         certFingerprint;  // SHA-256(X.509 DER)
    bytes32         parentCA;         // RootCARegistry.caId  (§2)
    string          metadataURI;
    IssuerStatus    status;
    uint64          validFrom;
    uint64          validUntil;
    bytes32         successorId;      // yumuşak devir
    uint64          registeredAt;
    uint64          revokedAt;        // 2.1.0 — 0 ise iptal yok; yumuşak iptalin zaman sınırı
}
```

## 3.1 Yazma — yalnızca ilgili devlet, oylama yok

```solidity
function registerIssuer(Issuer calldata data) external onlyOwnerState(data.stateCode);
function suspendIssuer(bytes32 issuerId) external onlyOwnerState(_stateOf(issuerId));
function revokeIssuer(bytes32 issuerId, bytes32 successorId) external onlyOwnerState(_stateOf(issuerId));
function renewIssuer(bytes32 issuerId, uint64 newValidUntil) external onlyOwnerState(_stateOf(issuerId));
function setIssuerDelegates(bytes32 issuerId, address[] calldata keys) external onlyOwnerState(_stateOf(issuerId));
```

> Türkiye MEB'i eklemek istediğinde **tek işlem** gönderir; oy yok, bekleme yok.
> Diğer devletler yalnızca görür.

## 3.2 Okuma — üç ayrı soru (2.1.0)

> **Review bulgusu R1.** 2.0.0'da doğrulama adımı `C1`, `isValidIssuer`'ı
> kullanıyordu. `isValidIssuer` "**yeni** credential verebilir mi" sorusudur ve
> `REVOKED` issuer için false döner — yani kapanmış bir bakanlığın **tüm**
> diplomaları `C1`'de düşüyordu. Bu, §3.3 yumuşak iptal ve [[ADR-0002]] #4 ile
> doğrudan çelişkiydi. Soru üçe ayrıldı.

```solidity
/// "ŞİMDİ yeni credential verebilir mi?"       → ihraç, PR2 metadata kontrolü
function isValidIssuer(bytes32 issuerId) external view returns (bool);

/// "Günlük operasyon yapabilir mi?"             → status list yayını (CA'dan bağımsız)
function isOperational(bytes32 issuerId) external view returns (bool);

/// "iat anında verilmiş credential kabul edilebilir mi?"  → DOĞRULAMA adımı C1
function isCredentialAcceptable(bytes32 issuerId, uint64 iat) external view returns (bool);

function getIssuer(bytes32 issuerId) external view returns (Issuer memory);
function getIssuersByState(bytes2 stateCode) external view returns (bytes32[] memory);
function isIssuerDelegate(bytes32 issuerId, address key) external view returns (bool);
```

## 3.3 Yumuşak iptal modeli

Bir issuer `REVOKED` olsa bile, `validUntil` tarihine kadar verdiği
credential'lar **geçerli kalır**; issuer yalnızca **yeni** credential veremez.
`successorId` ile kurum devri tanımlanır — bakanlık kapanınca diplomalar çöp
olmaz.

Üç sorgunun tanımı:

```
isValidIssuer(id) =                                   // ihraç
      status == ACTIVE
   && now ∈ [validFrom, validUntil]
   && RootCARegistry.isValidRootCA(parentCA)          // yalnızca ACTIVE CA

isOperational(id) =                                   // status yayını
      status == ACTIVE
   && now ∈ [validFrom, validUntil]
   // CA'ya BAKMAZ — rotasyon yayını durdurmamalı

isCredentialAcceptable(id, iat) =                     // doğrulama C1
      status ∈ {ACTIVE, REVOKED}                      // SUSPENDED → false (ihtiyati)
   && iat ∈ [validFrom, validUntil]
   && (status != REVOKED || iat <= revokedAt)         // yumuşak iptal
   && RootCARegistry.isChainAcceptable(parentCA)      // ACTIVE veya RETIRED
```

**Yumuşak iptalin anlamı artık kesin:** `revokedAt`'ten **önce** verilmiş
credential kabul edilir, sonra verilmiş (sahte tarihli) reddedilir.

## 3.4 Şema yetkilendirmesi

> **2.0.0'da eklendi.** [[ADR-0007]] Karar 6.

```solidity
event SchemaAuthorizationSet(bytes32 indexed issuerId, bytes32 indexed schemaId, bool allowed);

error SchemaNotAuthorized(bytes32 issuerId, bytes32 schemaId);

/// Issuer'ı hangi devlet kaydettiyse yetkiyi de o verir.
function setSchemaAuthorization(bytes32 issuerId, bytes32 schemaId, bool allowed)
    external onlyOwnerState(_stateOf(issuerId));

/// Verifier doğrulamasında ZORUNLU adım.
function isAuthorizedForSchema(bytes32 issuerId, bytes32 schemaId) external view returns (bool);

function authorizedSchemasOf(bytes32 issuerId) external view returns (bytes32[] memory);
```

### Yetki penceresi (2.1.0 — review bulgusu R3)

Yetki bir boolean değil, bir **zaman penceresidir**:

```solidity
struct SchemaAuth { bool allowed; uint64 since; uint64 until; }  // until=0 → hâlâ yetkili

/// Doğrulama adımı C2 — "iat anında yetkili miydi?"
function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
    external view returns (bool);
```

`isCredentialSchemaAcceptable` = `iat ∈ [since, until]` **ve** şema `REVOKED`
değil. Şemanın `DEPRECATED` olması **engel değildir** — SC3'ün yetki tarafı.

2.0.0'da `C2 = isAuthorizedForSchema` idi; o da şemanın `ACTIVE` olmasını
istediği için `DEPRECATED` şemayla verilmiş her eski diploma `C2`'de
düşüyordu — SC3 ("deprecated şema doğrulanabilir kalır") ile çelişki.

`isAuthorizedForSchema` (ihraç anlamı) **üç koşulu birden** sağlamalıdır:

1. `isValidIssuer(issuerId)` ✓
2. `SchemaRegistry.isActiveSchema(schemaId)` ✓ — `DEPRECATED` şemayla yeni ihraç
   yapılamaz
3. `(issuerId, schemaId)` çifti açıkça yetkilendirilmiş ✓

**Değişmez I1 — allowlist:** Üçüncü koşulun varsayılanı `false`'tur. Yetki
açıkça verilmediyse yoktur.

**Kapattığı açık:** [[PM-SCHEMA-0001]] Zafiyet 1. `EDUCATION` kategorili bir
üniversite sağlık şemasıyla belge imzalasa bile, o şemaya yetkilendirilmediği
için hiçbir uyumlu verifier kabul etmez.

## 3.5 İki eksen ayrımı

`category` issuer'ın **sektörünü**, `assurance` (I1–I3) **akreditasyon
derecesini** söyler; iki eksen diktir ([[PM-ASSUR-0001]]). Verifier politikası
ikisini birden kullanır: `category == EDUCATION && assurance >= I2`.

Holder assurance (T0–T3) **zincire yazılmaz** — kişisel veridir
([[PM-TRUST-0001]]); credential sunumunda kanıtlanır ([[SPEC-CRED-0001]]).

---

# 4. Schema Registry Kontratı (Katman 1 + 2)

> **Yeni bölüm.** [[ADR-0007]] ve [[SPEC-SCHEMA-0001]] §5.1.

```solidity
enum SchemaTier   { NETWORK, NATIONAL }
enum SchemaStatus { NONE, ACTIVE, DEPRECATED, REVOKED }

struct SchemaRecord {
    string       vctURI;        // kanonik tip URL'i
    bytes32      contentHash;   // Type Metadata dokümanının SHA-256'sı
    string       version;       // semver, "1.0.0"
    SchemaTier   tier;
    bytes2       stateCode;     // NATIONAL ise sahibi; NETWORK ise 0x0000
    SchemaStatus status;
    uint64       validFrom;
    bytes32      supersededBy;  // yeni sürüm; yoksa 0x0
}
```

## 4.1 Yazma

```solidity
/// schemaId = keccak256(bytes(vctURI))
function schemaIdOf(string calldata vctURI) external pure returns (bytes32);

function registerSchema(SchemaRecord calldata rec) external;
function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external;
function revokeSchema(bytes32 schemaId, string calldata reason) external;
```

## 4.2 Okuma

```solidity
function getSchema(bytes32 schemaId) external view returns (SchemaRecord memory);
function isActiveSchema(bytes32 schemaId) external view returns (bool);
function matchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool);
function getSchemasByState(bytes2 stateCode) external view returns (bytes32[] memory);
```

## 4.3 İki katmanlı yetki

| `tier` | Kim yazar | Nasıl |
|---|---|---|
| `NETWORK` | Ağ | `Governance.proposeNetworkSchema` → 2/3 oy → `execute` |
| `NATIONAL` | Tek devlet | `onlyOwnerState(rec.stateCode)`, oy yok |

```solidity
function registerSchema(SchemaRecord calldata rec) external {
    if (rec.tier == SchemaTier.NETWORK) {
        if (msg.sender != address(governance)) revert NetworkTierRequiresGovernance();
        if (rec.stateCode != bytes2(0))       revert NetworkTierHasNoState();
    } else {
        if (!_isDelegateOf(msg.sender, rec.stateCode)) revert NotOwnerState(rec.stateCode, msg.sender);
        if (rec.stateCode == bytes2(0))       revert NationalTierRequiresState();
    }
    // ...
}
```

**İlke:** Sınır ötesi anlam taşıması gereken şemalar NETWORK, ulusal hukuka
özgü olanlar NATIONAL. Bir devlet NATIONAL şemasını kimseye sormadan kaydeder;
kimse engelleyemez.

## 4.4 Değişmezler

- **SC1** — Kayıtlı bir şemanın `vctURI` ve `contentHash` alanları **asla
  güncellenmez.** Değişiklik = yeni sürüm = yeni `schemaId`.
- **SC2** — `deprecateSchema` ve `revokeSchema` yalnızca `status` alanını
  değiştirir.
- **SC3** — `DEPRECATED` bir şema **doğrulanabilir kalır**; yalnızca yeni ihraç
  engellenir ([[SPEC-SCHEMA-0001]] §9.2).
- **SC4** — Zincir kaydı, CDN yayınından **sonra** yapılır
  ([[SPEC-SCHEMA-0001]] §6). Kontrat bunu zorlayamaz; issuer yayın hattı
  disiplinidir.

---

# 5. Cross-Recognition Kontratı (Katman 3)

```solidity
enum RecognitionMode { NONE, FULL, CATEGORY_LIMITED }

struct RecognitionPolicy {
    bytes2           recognizingState;
    bytes2           recognizedState;
    RecognitionMode  mode;
    IssuerCategory[] categories;   // CATEGORY_LIMITED ise
    uint64           updatedAt;
}

function setRecognition(
    bytes2 recognizedState,
    RecognitionMode mode,
    IssuerCategory[] calldata categories
) external onlyOwnerState(_callerState());

/// İstisna: genel tanı ama şu issuer'ı tanıma
function blocklistIssuer(bytes32 issuerId) external onlyOwnerState(_callerState());

function isRecognizedBy(bytes2 verifierState, bytes32 issuerId) external view returns (bool);
```

**Varsayılan ([[ADR-0002]] #3):** kurucu üyeler arasında **FULL**; sonradan
katılan devlet için tüm ilişkiler **NONE** (opt-in).

> Kazakistan: "Türkiye'nin eğitim ve kimlik credential'larını tanıyorum, sağlığı
> henüz tanımıyorum" → `CATEGORY_LIMITED, [EDUCATION, IDENTITY]`.

**Açık konu (devam ediyor):** Şema seviyesinde tanıma gerekir mi? Yani
Kazakistan "Türkiye'nin diploma şemasını tanıyorum ama YÖK denklik şemasını
tanımıyorum" diyebilmeli mi? Şu an tanıma **kategori** granülaritesindedir.
NATIONAL şemaların yaygınlaşmasıyla bu yetersiz kalabilir → §14 Açık Konu 2.

---

# 6. Relying Party Registry Kontratı (Katman 2)

```solidity
enum RPStatus { NONE, ACTIVE, SUSPENDED, REVOKED }

struct RelyingParty {
    bytes32   rpId;
    bytes2    stateCode;
    bytes32   nameHash;
    bytes32   accessCertFingerprint;
    bytes32[] allowedScopes;
    RPStatus  status;
    uint64    registeredAt;
}

function registerRelyingParty(RelyingParty calldata data) external onlyOwnerState(data.stateCode);
function updateScope(bytes32 rpId, bytes32[] calldata newScopes) external onlyOwnerState(_stateOf(rpId));
function suspendRelyingParty(bytes32 rpId) external onlyOwnerState(_stateOf(rpId));

function isValidRelyingParty(bytes32 rpId) external view returns (bool);
function hasScope(bytes32 rpId, bytes32 scope) external view returns (bool);
```

**Aşırı-talep koruması:** Cüzdan, credential sunmadan önce (1) RP kayıtlı ve
aktif mi, (2) talep edilen scope'a yetkili mi kontrol eder.

> **`accessCertFingerprint` = `x509_hash`.** [[SPEC-PROTO-0002]] §2.2'de tespit
> edildi: OpenID4VP 1.0 / HAIP'in client identifier prefix'i `x509_hash`,
> `base64url(SHA-256(DER yaprak sertifika))` değeridir — yani bu alandaki
> `bytes32` ile **birebir aynı baytlar**. Cüzdan, gelen istekteki client
> identifier'ı doğrudan bu kayda çözebilir. Aşırı talep denetimi böylece
> protokol seviyesinde uygulanabilir hâle gelir; daha önce cüzdanın verifier'ı
> nasıl tanıyacağı açık kalmıştı.

**Scope ile şema ilişkisi:** `allowedScopes` kaba granülaritededir
(`"education"`, `"health"`). Şema kaydı geldiğine göre scope'ların `schemaId`
kümesine bağlanması mümkün ve daha kesin olurdu — ancak bu, her yeni şemada
her RP'nin güncellenmesini gerektirir. Şimdilik kaba scope korunur; §14 Açık
Konu 3.

---

# 7. Status List Registry Kontratı — Çapa Modeli

> **Tamamen yeniden yazıldı.** [[ADR-0008]] ve [[SPEC-CRED-0003]] §4.

## 7.1 Veri şeması

```solidity
enum ListStatus { NONE, ACTIVE, RETIRED }

struct ListAnchor {
    bytes32    issuerId;
    string     listURI;       // Status List Token'ın sub claim'i
    bytes32    contentHash;   // SHA-256(JWS compact serialization ASCII baytları)
    uint32     listSize;      // toplam indeks kapasitesi
    uint8      bitsPerEntry;  // Tamga'da her zaman 2
    uint64     version;       // monoton artan
    uint64     publishedAt;
    ListStatus status;
}

uint32 public constant MIN_LIST_SIZE = 100_000;
uint8  public constant REQUIRED_BITS = 2;
```

**Zincirde tek bir iptal biti yoktur.** Bitmap off-chain'dedir.

## 7.2 Arayüz

```solidity
/// listId = keccak256(abi.encodePacked(issuerId, bytes(listURI)))
function listIdOf(bytes32 issuerId, string calldata listURI) external pure returns (bytes32);

function registerList(bytes32 issuerId, string calldata listURI, uint32 listSize, uint8 bitsPerEntry)
    external onlyIssuerDelegate(issuerId) returns (bytes32 listId);

function publishList(bytes32 listId, bytes32 contentHash, uint64 version, uint64 publishedAt)
    external onlyIssuerDelegate(_issuerOf(listId));

function retireList(bytes32 listId, string calldata reason) external onlyIssuerDelegate(_issuerOf(listId));

function getListAnchor(bytes32 listId) external view returns (ListAnchor memory);
function matchesContentHash(bytes32 listId, bytes32 hash) external view returns (bool);
```

## 7.3 Kaldırılan arayüzler

| Kaldırılan | Neden |
|---|---|
| `setRevoked(issuerId, index)` | Zincir bit tutmuyor |
| `setRevokedBatch(...)` | aynı |
| `unsetRevoked(...)` | aynı |
| `getChunk(issuerId, chunkIndex)` | aynı |
| `initStatusList(...)` | `registerList` ile değişti |
| `IStatusList.isRevoked(...)` (`ITrustQueries.sol`) | **Zincir bu soruyu cevaplayamaz** |

Son satır kritiktir. Cevaplanamayacak bir soruyu soran arayüz bırakmak,
çağıranın `false` dönüşünü "iptal edilmemiş" sanmasına yol açar. Arayüz
kalkmalıdır ki derleme hatası versin.

**Halef yetkisi (2.1.0 — review bulgusu R4):** `REVOKED` bir issuer'ın listesi
donmamalıdır — bakanlık kapandı, diplomalar geçerli, ama sahte bir diplomayı kim
iptal edecek? `publishList` ve `retireList`, issuer'ın kendi delegesine **veya**
`successorId`'nin delegesine açıktır. Halef zinciri tek seviyedir.

**Bağımlı etki — `CredentialGate.sol`:** Zincir-üstü credential-gating
([[ADR-0003]] Karar 4) iptal durumunu artık doğrudan göremez. Çağıranın sunduğu
taze bir kanıta dayanmak zorundadır. Bu, `ADR-0003`'ün bir sonucunu **daraltır**
ve `SPEC-AGENT-0001`'de çözülecektir.

## 7.4 Değişmezler

- **L1** — `version` monoton artar; azalan sürüm `VersionNotMonotonic` ile
  reddedilir. Bu, issuer'ın listeyi sessizce geri almasını engeller.
- **L2** — `listSize >= MIN_LIST_SIZE`.
- **L3** — `bitsPerEntry == REQUIRED_BITS`.
- **L4** — `listURI` bir kez yazılır, güncellenmez.
- **L5** — İndeks tahsisi, doluluk oranı ve URI opaklığı kuralları
  **kontrat dışıdır** ve [[SPEC-CRED-0003]] §6'da normatiftir. Kontrat bunları
  zorlayamaz; issuer disiplinidir.

---

# 8. Kontrat Topolojisi

```
                    ┌──────────────┐
                    │  Governance  │ ── 2/3 oy
                    └──────┬───────┘
                           │ execute()
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌──────────────────┐
│ RootCARegistry│◀─│ IssuerRegistry│─▶│  SchemaRegistry  │
└───────────────┘  └───────┬───────┘  └──────────────────┘
                           │                  ▲
        ┌──────────────────┼──────────────────┘
        ▼                  ▼
┌──────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│ CrossRecognition │  │ StatusListRegistry │  │ RelyingPartyRegistry│
└──────────────────┘  └────────────────────┘  └────────────────────┘

Ayrı kapsam (SPEC-BC-0002): GuardianRegistry, DisclosureRegistry
```

**Bağımlılık yönü kuralı:** Oklar tek yönlüdür. `SchemaRegistry`,
`IssuerRegistry`'yi tanımaz — `IssuerRegistry` şema yetkisi sorarken
`SchemaRegistry.isActiveSchema`'yı çağırır, tersi olmaz. Döngüsel bağımlılık
yasaktır.

---

# 9. Yükseltilebilirlik — UUPS

> Açık Konu 4 (1.0.0) burada kapanmıştır.

**Karar: UUPS (ERC-1822 / ERC-1967 proxy).**

| Seçenek | Değerlendirme |
|---|---|
| Transparent proxy | Her çağrıda admin kontrolü → ek gas; proxy sözleşmesi daha büyük |
| **UUPS** | **Seçildi.** Yükseltme mantığı implementasyonda; proxy ince |
| Diamond (EIP-2535) | Tamga'nın ihtiyacından fazla karmaşık |
| Yükseltilemez | Kabul edilemez — 5+ yıllık altyapı |

```solidity
function _authorizeUpgrade(address newImplementation) internal override {
    if (msg.sender != address(governance)) revert OnlyGovernance();
}
```

**Bilinen risk — brick.** UUPS'te yükseltme fonksiyonu implementasyonda
olduğundan, `_authorizeUpgrade`'i içermeyen bir implementasyona yükseltmek
kontratı kalıcı olarak kilitler.

**Azaltma (zorunlu):**

1. CI'da her implementasyon için `_authorizeUpgrade` varlığı test edilir.
2. Yükseltme, önce test ağında aynı adımlarla uygulanır.
3. `Governance.proposeProtocolUpgrade` yeni implementasyonun
   `proxiableUUID()` döndürdüğünü çağrı öncesi doğrular.

**Depolama düzeni:** Her yükseltilebilir kontrat `__gap` dizisi taşır ve
depolama düzeni değişikliği yalnızca sona ekleme şeklinde yapılır. CI'da
depolama düzeni karşılaştırması zorunludur.

---

# 10. Rol Modeli

Üç ayrı yetki kaynağı vardır ve karıştırılmamalıdır:

| Rol | Kaynak | Ne yapar |
|---|---|---|
| **Validator** | `Governance.StateMember.validatorAddress` | Öneri verir, oy kullanır |
| **State delegate** | `Governance.StateMember.delegateKeys` | Ulusal kayıtlara yazar (`onlyOwnerState`) |
| **Issuer delegate** | `IssuerRegistry.setIssuerDelegates` | Günlük operasyon: status list yayını (`onlyIssuerDelegate`) |

```solidity
modifier onlyValidator() { ... }
modifier onlyOwnerState(bytes2 stateCode) { ... }
modifier onlyIssuerDelegate(bytes32 issuerId) {
    if (!issuerRegistry.isIssuerDelegate(issuerId, msg.sender)) revert NotIssuerDelegate(issuerId, msg.sender);
    if (!issuerRegistry.isValidIssuer(issuerId))               revert IssuerNotActive(issuerId);
    _;
}
```

**Değişmez R1:** Issuer delegate anahtarı **ulusal kayıtlara yazamaz.** Bir
üniversitenin operasyon anahtarı, kendi status listesini yayınlayabilir ama
kendini `IssuerRegistry`'ye kaydedemez veya assurance seviyesini
değiştiremez.

**Değişmez R2:** `onlyIssuerDelegate`, issuer aktif değilse revert eder.
Askıya alınmış bir issuer status list yayınlayamaz.

---

# 11. Uçtan Uca Akış

## 11.1 Sınır ötesi senaryo

Türk üniversite mezunu Kazakistan'da işe başvuruyor.

| # | Adım | Zincir işlemi |
|---|---|---|
| 1 | Türkiye ulusal Root CA'sını kaydeder | `registerRootCA` |
| 2 | Türkiye üniversiteyi kaydeder | `registerIssuer` |
| 3 | Ağ diploma şemasını kaydeder | `Governance` → `registerSchema` (NETWORK) |
| 4 | Türkiye üniversiteye şema yetkisi verir | `setSchemaAuthorization` |
| 5 | Üniversite status listesini kaydeder | `registerList` |
| 6 | Kazakistan tanıma politikasını açar | `setRecognition("TR", CATEGORY_LIMITED, [EDUCATION])` |
| 7 | **İhraç** — diploma SD-JWT VC olarak cüzdana | **hiçbiri** |
| 8 | Üniversite listeyi saatte bir yayınlar | `publishList` |
| 9 | **Sunum** — öğrenci seçici ifşa ile sunar | **hiçbiri** |
| 10 | **Doğrulama** | 5 `view` çağrısı (§11.2) |

**Adım 7 kritiktir:** İhraç anında zincire hiçbir şey yazılmaz. Yalnızca bir
status indeksi rezerve edilir — ve o rezervasyon issuer'ın kendi
veritabanındadır, zincirde değil. İndeks tahsisi kurallarında
[[SPEC-CRED-0003]] §6 geçerlidir (rastgele tahsis, opak URI).

## 11.2 Doğrulama okuma seti

1.0.0'da 3 çağrıydı; 2.0.0'da **5**:

```solidity
// 1. iat anında bu issuer'ın credential'ı kabul edilebilir miydi   ← 2.1.0 (R1)
issuerRegistry.isCredentialAcceptable(issuerId, credentialIat)

// 2. iat anında issuer bu şemaya yetkili miydi                       ← 2.1.0 (R3)
issuerRegistry.isCredentialSchemaAcceptable(issuerId, schemaId, credentialIat)

// 3. Şema kaydı ve bütünlüğü                            ← YENİ (ADR-0007)
schemaRegistry.matchesContentHash(schemaId, typeMetadataHash)

// 4. Verifier'ın devleti bu issuer'ı tanıyor mu
crossRecognition.isRecognizedBy(verifierState, issuerId)

// 5. Status list çapası                                 ← DEĞİŞTİ (ADR-0008)
statusListRegistry.getListAnchor(listId)
//    → contentHash ve version karşılaştırması verifier tarafında
```

**Dikkat — ihraç sorguları doğrulamada kullanılmaz:** `isValidIssuer` ve
`isAuthorizedForSchema` **yalnızca ihraç anındadır**. Doğrulamada kullanılmaları
2.0.0'daki hataydı (R1, R3).

**Kaldırılan:** `isRevoked(issuerId, index)`. İptal durumu artık zincirden
değil, off-chain Status List Token'dan okunur ([[SPEC-CRED-0003]] §7).

**Performans etkisi:** Okuma sayısı arttı ve bu, her doğrulamada RPC node'a
gitmeyi daha maliyetli kılıyor. Çözüm **indeksleyicidir**: bu beş kaydın
tamamı olay (event) tabanlı olarak yerel bir veritabanına yansıtılır ve
doğrulama oradan yapılır. Zincir doğrudan sorgulanmaz.

Bu, `ARCH-0003`'te tanımlanacak zorunlu bir bileşendir — opsiyonel bir
optimizasyon değil.

---

# 12. Gas ve İzin Politikası

## 12.1 Gas

İzinli ağda gas **ücretsizdir** (`gasPrice = 0`). Ancak bu, spam'in serbest
olduğu anlamına gelmez.

| Mekanizma | Nasıl |
|---|---|
| **Hesap izni** | Besu onchain permissioning — yalnızca kayıtlı delegate anahtarları işlem gönderebilir |
| **Blok gas limiti** | Tek işlemin blok kapasitesini tüketmesi engellenir |
| **Kontrat içi kota** | Devlet başına günlük yazma sayacı (§12.2) |

**Değişmez GA1:** Gas ücretsiz olsa bile, zincire yazılan her bayt her
validator'ın diskinde kalıcıdır. "Ücretsiz" maliyet yokluğu değildir — bu,
[[ADR-0007]] ve [[ADR-0008]]'deki off-chain kararlarının temel gerekçesidir.

## 12.2 Kota

```solidity
uint32 public constant MAX_WRITES_PER_STATE_PER_DAY = 10_000;
uint32 public constant MAX_PUBLISH_PER_ISSUER_PER_DAY = 48;  // saatte 1 + pay
```

İkinci kota, [[SPEC-CRED-0003]] §5.1'in saatlik yayın döngüsünü hem destekler
hem sınırlar. 48, bir günlük 24 yayın + yeniden deneme payıdır.

Kota aşımı `QuotaExceeded` ile revert eder; sayaç UTC gün başında sıfırlanır.

---

# 13. Tüm Değişmezler (Özet)

| # | Değişmez |
|---|---|
| **N1** | Namespace sahibi olmayan çağıran yazamaz; tek istisna `Governance` yürütmesi. |
| **GV1** | Çıkarma/çıkış mevcut kayıtları ve credential'ları geçersiz kılmaz. |
| **GV2** | NETWORK şeması yalnızca `Governance` üzerinden kaydedilir. |
| **CA1** | `certFingerprint` bir kez yazılır; yeni sertifika = yeni `caId`. |
| **CA2** | `RETIRED` CA: operasyon ve eski credential'lar sürer; `REVOKED` CA: credential'lar düşer, operasyon sürer. |
| **CA3** | Yeni issuer yalnızca `ACTIVE` CA'ya bağlanabilir. |
| **I1** | Şema yetkisi allowlist'tir; varsayılan `false`. |
| **I2** | Doğrulama `isCredentialAcceptable(id, iat)` kullanır; `isValidIssuer` yalnızca ihraçtır. |
| **I3** | Şema yetkisi zaman penceresidir; doğrulama `iat`'a göre bakar. |
| **I4** | `REVOKED` issuer'ın listesini halefi yayınlayabilir. |
| **SC1** | Şemanın `vctURI` ve `contentHash`'i asla güncellenmez. |
| **SC3** | `DEPRECATED` şema doğrulanabilir kalır. |
| **L1** | Status list `version` monoton artar. |
| **L2** | `listSize >= 100.000`. |
| **L3** | `bitsPerEntry == 2`. |
| **R1** | Issuer delegate anahtarı ulusal kayıtlara yazamaz. |
| **R2** | Askıya alınmış issuer status list yayınlayamaz. |
| **GA1** | Ücretsiz gas, maliyet yokluğu değildir. |
| **GV3** | Asgari mutlak oy 2; iki üyeli ağda çıkarma imkânsızdır. |
| **GV4** | Çıkarılmış/çekilmiş devlet yeniden kabul edilebilir. |
| **DP1** | Hiçbir kontrat kişisel veri, credential içeriği veya credential hash'i saklamaz. |

---

# Güvenlik ve Mahremiyet Notları

**Egemenlik koda gömülüdür.** `onlyOwnerState` iyi niyete bağlı değildir.

**Yumuşak iptal benimsenmeyi korur.** Çıkarma veya iptal, credential imhası
değildir.

**Zincir bir gözlem yüzeyidir.** İzinli ağda her işlem her validator'a
görünür. `publishList` işlemleri sabit aralıkta ve gürültülü olmalıdır
([[SPEC-CRED-0003]] §5.1) — aksi hâlde iptal zamanlaması sızar.

**`nameHash` neden hash.** Kurum adı kamusaldır ama zincire düz metin yazmak,
zincir üzerinde aranabilir bir kurum dizini yaratır. Hash, kaydı doğrulanabilir
kılar ama taramayı zorlaştırır. Yine de bu **zayıf bir korumadır** — kurum
adları sonlu bir kümedir ve kaba kuvvetle çözülebilir. Gerçek koruma değil,
sürtünme sağlar.

**Bağımsız güvenlik denetimi üretim önkoşuludur.** Özellikle: UUPS brick riski
(§9), depolama düzeni, `onlyOwnerState` atlatma yolları, ve reentrancy
(kontratlar arası çağrılar var: `IssuerRegistry` → `SchemaRegistry`).

---

# 14. Açık Konular

1. `IssuerCategory` listesinin nihai kümesi (dikey platformlarla senkron).
2. **Şema seviyesinde cross-recognition** gerekir mi? Şu an tanıma kategori
   granülaritesinde; NATIONAL şemalar yaygınlaşırsa yetersiz kalabilir (§5).
3. **RP scope'ları `schemaId`'ye bağlansın mı?** Daha kesin olurdu ama her yeni
   şemada her RP güncellenmek zorunda kalırdı (§6).
4. ~~Proxy/upgrade deseni~~ — **KAPANDI** (2026-09-09), UUPS (§9).
5. Cross-recognition matrisinin okuma optimizasyonu (büyük N) — indeksleyici
   ile çözülüyor mu, yoksa kontrat tarafı optimizasyon gerekiyor mu?
6. `MAX_WRITES_PER_STATE_PER_DAY` değeri saha verisiyle kalibre edilmeli.
7. Guardian/escrow kontratları ayrı kapsamda — [[SPEC-BC-0002]] mevcut, bu
   dokümanla arayüz tutarlılığı gözden geçirilmeli.

---

# İlgili Dokümanlar

[[ADR-0001]] · [[ADR-0002]] · [[ADR-0003]] · [[ADR-0007]] · [[ADR-0008]] ·
[[ARCH-0001]] · [[ARCH-0002]] · [[ARCH-0003]] · [[PM-TRUST-0001]] ·
[[PM-SCHEMA-0001]] · [[PM-ASSUR-0001]] · [[SPEC-ID-0002]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0003]] · [[SPEC-BC-0002]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

