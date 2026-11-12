---
document_id: SPEC-BC-0001
title: "Güven katmanı kontratları"
status: Active
version: 1.0.0
created: 2026-08-05
last_updated: 2026-11-12
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

> **Sürüm notu 1.0.0 (2026-11-12) — en az iki kurucu, Cancun, başka devletin ulusal şemasına yetki.** (1) [[ADR-0076]] GC4:
> `Governance.initialize` ikiden az kurucuyu reddeder (`FounderMismatch`); tek kuruculu kuruluş kalktı, kurulum betikleri ve
> anahtar haritası aynı kuralı dağıtımdan önce denetler (§1). (2) [[ADR-0077]]: zincir Cancun kural setiyle kurulur (genesis
> `cancunTime: 0`), kontratlar `evmVersion: cancun` ile derlenir, testler aynı kural setinde koşar; `SELFDESTRUCT` kodu silmez
> (EIP-6780), kod özeti denetimi ikinci savunma hattı olarak kalır (§9; §14 madde 10 kapandı). (3) [[ADR-0079]]: başka devletin
> ulusal şemasına yetki şema sahibi devletin onayını ister; karar verildi, uygulama ikinci devlet katılmadan önce (§3.4; §14
> madde 9). ABI, fonksiyon imzaları ve depolama düzeni değişmedi.

> **Sürüm notu 1.0.0 (2026-11-12) — [[ADR-0076]] iki üyeli ağda çıkış.** `Governance.withdraw` etkin üye sayısı 2 ya da daha
> az iken reddedilir (`TooFewMembers(active, required)`; GC1): çıkış etkin üye sayısını asgari mutlak oyun (2) altına indiremez,
> yönetişim kilitlenmez. İki üyeli ağda çıkmak isteyen üye önce üçüncü üyenin kabulünü bekler, sonra oy gerekmeden çekilir
> (GC2). [[ADR-0002]] #5 bu kayıtla okunur (GC3). §1; §14 madde 8 kapandı. Depolama düzeni ve fonksiyon imzaları değişmedi;
> ABI'ye bir hata eklendi.

> **Sürüm notu 1.0.0 (2026-11-11, kontrat denetimi).** Yükseltme önerisi yeni implementasyonun **kod özetini** sabitler; yürütmede
> kod aynı değilse yükseltme düşer (`UpgradeImplementationChanged`, §9). `Governance.initialize` sıfır devlet kodunu reddeder;
> öneri yükleri zincirden okunur (`getSchemaPayload`, `upgradePayloadOf`, `removalReasonOf`, §1). Göç yürütücüsü yalnız kendi
> yazdığı ağ şemasını kullanımdan kaldırır (§16.1). C2'nin şema adımı `iat ≥ validFrom` ister; yetki kayıtsız şemaya verilemez
> (§3.4, §16.1). Yazıcı çıkarma, yazıcı sayısını eşiğin altına düşüremez (§15). Göç penceresinde ileri tarihli şema başlangıcı
> yazılır (§16.1). `contracts:check` kod boyutu payını da denetler (§9). Depolama: `SchemaRegistry` `__gap` 44 → 43; Governance
> yükseltme kuyruğu yapısına bir üye (mapping değeri, `__gap` değişmedi). İki üyeli ağda çıkışın yönetişimi kilitlemesi o gün açık
> konuydu; 2026-11-12'de kapandı (§14 madde 8; [[ADR-0076]]).

> **Sürüm notu 1.0.0 (2026-11-05) — Faz D kalanları ([[ADR-0073]] K1/K5/K6, [[ADR-0074]] K3, [[ADR-0075]] Sonuçlar).**
> Doğrulayıcı durum yazımları tarih taşır: `suspendRelyingPartyAt`, `reinstateRelyingPartyAt`, `revokeRelyingPartyAt` (§16.1 tarih
> kuralı; kip açıkken tarihsiz doğrulayıcı durum yazımı da donuktur). Yeniden oynatma kurum halefini, `NetworkRegistry`'nin bütün
> kayıt türlerini (§16.5) ve iptal listesinin bit sayısı / boyutunu (çapa satırı ya da belirteç) yazar; ülkeler arası devirde eski
> listedeki kayıt `REVOKED` olur ve yükleyici iptal edilmemiş kaydı alır. Eşdeğerlik testi fark 0, bilinen fark yok (§16.8).

> **Sürüm notu 1.0.0 (2026-11-05) — yerel izinlendirme aracı ve işletim ([[ADR-0052]]; C33, C32 (7)).** İzin listesi zincir
> durumundan üretilir ve düğümle karşılaştırılır (`trust:chain-permissions render|check`), düğüm bildirimi biçimi, iki düğümlü yerel
> izinli ağ ve validator oylaması, RPC yöntem süzgeci, doğrulayıcı sağlık sayfasında zincir çapası (§16.9). Kontrat değişmedi.

> **Sürüm notu 1.0.0 (2026-11-04) — okuma ve aktarma ([[ADR-0073]] K1/K6, [[ADR-0074]] K4/K5).** Liste arşivinin kontratlara
> yeniden oynatılması (`trust:chain-replay`), olay tabanlı indeksleyici ve `ChainTrustSource` (`apps/chain-indexer/`), eşdeğerlik
> testi (Hardhat'te, CI'da) ve çapa günlüğünün yeni satırlarının (`registration_status`, `list_view`) liste çapası kaydına
> yazımı uygulandı (§11.2 uygulama notu, §16.8). Kontrat değişmedi.

> **Sürüm notu 1.0.0 (2026-11-04) — [[ADR-0075]] kabul edildi ve uygulandı.** Doğrulayıcı kimliğinin (`rpId =
> keccak256(dns_name)`) sahibi devlet yalnız Governance'ın türü belli devir önerisiyle (`proposeRelyingPartyReassignment`, 2/3)
> değişir; iptal edilmiş kimlik yalnız yeniden kayıt önerisiyle (`proposeRelyingPartyReRegistration`, 2/3) yeniden kaydedilir.
> Öneri, `RelyingPartyRegistry.stagePeriodChange` ile sabitlenen içeriğin özetini taşır; yürütme `commitPeriodChange`'i çağırır
> (yalnız Governance; bayat öneri `StalePeriodChange`). İkisi de yeni bir kayıt dönemi açar: durum geçmişi ve dönemler yalnız
> eklenir, kapsamlar / kayıt verisi / kapı grubu listesi döneme göre ayrı tutulur, eski dönemin açık kapı grupları kapanır;
> `relyingPartyAt` ve `isRelyingPartyAcceptableAt` `t` anındaki döneme göre cevap verir (§6.1). Depolama düzenine yalnız ekleme
> (`__gap` 39 → 35). Liste yayıncısı aynı kuralı uygular (`register rp … --approval`; RO5).

> **Sürüm notu 1.0.0 (2026-11-04) — [[ADR-0073]] ve [[ADR-0074]] kabul edildi, uygulama sürüyor.** Askı kuralı listeyle
> eşitlendi: C1 belgenin `iat` anındaki duruma bakar, askıdaki kurumun askıdan önceki belgeleri geçerlidir, sınırlar yarı açıktır
> (§3.3). Göç kipi (en çok 30 gün, tek göç yürütücüsü), sert iptal (`invalidatesFrom`), şema sürüm özetleri, doğrulayıcı kimliği
> `keccak256(dns_name)`, listelerdeki bütün güven kayıtlarının zincire yansıması (`NetworkRegistry`) ve çapa günlüğü satır türleri
> (`registration_status`, `list_view`) kontratlara işlendikçe ilgili bölümler (§3, §4.4, §6, §12.2, §13, §14, §15) bu nota eklenen
> maddelerle güncellenir; işlenmemiş bölümde bugünkü metin kontratın bugünkü hâlidir. Kurallar ADR'lerde (CE1–CE6, PJ1–PJ5).
> **Uygulanan:** göç kipi, kota istisnası, durum geçmişi ve `iat` anındaki durum, iki sınır düzeltmesi (bir saniyelik `<=`,
> emekli kök), C33 (1) okuma görünümlerinin bir kısmı (§3.3, §12.2, §16.1); sert iptal `invalidatesFrom` (§16.2); şema sürüm özetleri
> (§4.4 SC1, §16.3); doğrulayıcı kimliği, sertifika güncelleme, askıdan dönüş, öğe öğe kapsam (§6, §14 açık konu 3);
> durum eşlemesi (§16.4); ağ düzeyi kayıt `NetworkRegistry` (§16.5);
> kurum sınıfı, kayıt verisi özetleri ve kapı grupları (§16.6); okuma görünümleri ve F-18 kalanı (§16.7).

> **Sürüm notu 1.0.0 (2026-11-04, kontrat güvenlik turu).** Göç yürütücüsü ağ şemasını iptal edemez (yalnız Governance, §16.1);
> `NetworkRegistry` sabitlemesi kaydın yazım sayacına bağlı, eskimiş öneri `StaleStage`, her yazımda `RecordWritten` + durum
> değişikliğinde `RecordStatusChanged`, öneren önerisini geri çeker (`cancelProposal`, `CANCELLED`) (§1, §16.5, §16.7); pencere
> açıkken kayıt kontratı yükseltilemez ve `MigrationWindow` kaynağı yükseltme incelemesinde sabitlenir (§16.1, [[ADR-0073]]
> uygulama notu); pencerede tarihsiz olağan yazım dondurulur, kip dışında kurum/kök `validFrom` geçmişe çekilemez (§16.1);
> kapanmış kapsam ve kapı grubu yeniden açılmaz, kurum bağı doğrulanır, `RelyingPartyRegistry.initialize` kurum kaydını alır
> (§6, §16.6); iptal gerekçeleri `bytes32 reasonHash` (§1, §2, §4, §7); geçmiş dizileri bilinçli olarak tavansız (§16.1).
> Uygulanmayanlar: kota istisnasının yalnız göç yürütücüsüne daraltılması (CE1 ile çelişir) ve `isChainAcceptableAt`'e kök CA
> geçerlilik aralığı (liste kuralında yok; CE6). Doğrulayıcı kimliğinin sahipliği [[ADR-0075]]'te (kabul edildi, §6.1).

> **Sürüm notu 1.0.0 (2026-10-23) — [[ADR-0063]].** İptal listesi kaydı listenin kendi bit sayısını (1, 2, 4, 8) kabul eder;
> `REQUIRED_BITS` yerine `isAllowedBits`, `ListRegistered` bit sayısını taşır (§7.1, §7.2, §7.4, §13 L3).

> **Sürüm notu 1.0.0 (2026-10-19) — [[ADR-0053]], [[ADR-0054]], [[ADR-0055]] ve kontrat güvenlik turu.** Liste çapasında rakip
> adaylar ve çelişki olayı (§15); şema ad alanları ayrık, kurum yalnız kendi devletine bağlanır, kota kapsamı (§3.1, §4, §7, §12.2);
> yükseltme kuyruğu ve 7 gün bekleme, parametresiz başlangıç seçicisi, türü belli kayıt yönetimi önerileri (§1, §9). Güvenlik turunda
> eklenenler: `ValidatorInUse`, `DelegateKeyInUse` (§1), `RootCANotActive`, `InvalidSuccessor`, `IssuerReinstated`,
> `schemaAuthHistoryOf` (§3), `AlreadyBootstrapped` (§5), `countedForVotes` (§1). Metnin kodun gerisinde kaldığı yerler düzeltildi
> (§0, §1 `setDelegateKeys`, §4.4 SC2, §5 imzalar, §10 `onlyIssuerDelegate`, §12.2). Kurallar ADR'lerde tanımlıdır (AC1–AC4,
> NS1–NS3, GE1–GE3); burada tekrarlanmaz.

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
açık olamaz. Tek istisna `Governance` yürütmesidir (2/3 oy): `NETWORK` katmanı
şemaları (§4.3), protokol yükseltmesi (§9) ve türü belli kayıt yönetimi önerileri
(§1, [[ADR-0055]]). Bir anahtar ve bir validator adresi yalnız bir devlete ait
olabilir (`DelegateKeyInUse`, `ValidatorInUse`); bir devletin kayıtları başka bir
devletin kaydına bağlanamaz ([[ADR-0054]]/NS2).

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
function proposeStateRemoval(bytes2 stateCode, bytes32 reasonHash) external onlyValidator returns (bytes32);
function proposeProtocolUpgrade(address target, address newImplementation) external onlyValidator returns (bytes32);
function proposeNetworkSchema(ISchemaRegistry.SchemaRecord calldata rec) external onlyValidator returns (bytes32);

/// ADR-0055 K2 — yükseltme + yeni sürümün PARAMETRESİZ başlangıç fonksiyonu (yalnız 4 baytlık seçici)
function proposeProtocolUpgradeAndInit(address target, address newImplementation, bytes4 initSelector)
    external onlyValidator returns (bytes32);

/// ADR-0055 K3 — türü belli kayıt yönetimi önerileri (REGISTRY_ADMIN; 2/3, bekleme yok)
function proposeAnchorerChange(address registry, address anchorer, bool allowed) external onlyValidator returns (bytes32);
function proposeAnchorThreshold(address registry, uint8 required) external onlyValidator returns (bytes32);
function proposeFounderRecognition(address registry, bytes2[] calldata founders) external onlyValidator returns (bytes32);
function proposeNetworkSchemaDeprecation(bytes32 schemaId, bytes32 supersededBy) external onlyValidator returns (bytes32);
function proposeNetworkSchemaRevocation(bytes32 schemaId, bytes32 reasonHash) external onlyValidator returns (bytes32);

/// Oy verir; öneri yürütülene kadar (kuyruktaki yükseltme dahil) öteki yöne ÇEVİREBİLİR. Aynı yönde ikinci oy AlreadyVoted.
function vote(bytes32 proposalId, bool support) external onlyValidator;
/// 2026-11-11: verdiği oyu geri çeker (yürütülene kadar; kuyruktaki yükseltmede uygulama penceresinin sonuna kadar) → VoteRetracted;
/// oyu yoksa NoVote. Eşik her `execute`'ta o anki oylardan sayılır: geri çekilen oyla eşik düşerse yürütme ThresholdNotMet.
function retractVote(bytes32 proposalId) external onlyValidator;
/// PROTOCOL_UPGRADE: ilk çağrı kuyruğa alır (ProposalQueued), en erken UPGRADE_DELAY (7 gün) sonra uygular (ADR-0055 GE1)
function execute(bytes32 proposalId) external;
function countedForVotes(bytes32 proposalId) external view returns (uint32);  // yürütmede sayılacak destek (GV3)
function executableAt(bytes32 proposalId) external view returns (uint64);     // kuyruktaki yükseltmenin en erken anı
/// 2026-11-11: oy veren, oyladığı yükü zincirden okur (öteki türde öneride boş döner; yönetim önerileri `getAdminPayload`)
function getSchemaPayload(bytes32 proposalId) external view returns (ISchemaRegistry.SchemaRecord memory);
function upgradePayloadOf(bytes32 proposalId) external view returns (bytes4 initSelector, bytes32 implCodehash);
function removalReasonOf(bytes32 proposalId) external view returns (bytes32);
/// Güvenlik turu 2026-11-04: öneren, yürütülmemiş (açık ya da kuyruktaki) önerisini geri çeker → CANCELLED
function cancelProposal(bytes32 proposalId) external onlyValidator;   // yalnız öneren (NotProposer); ProposalCancelled

/// Tek taraflı çıkış — oy gerekmez (ADR-0002 #5). Etkin üye sayısı 2 ya da daha az iken reddedilir:
/// TooFewMembers(active, required = 3) — ADR-0076 GC1; iki üyeli ağda önce üçüncü üye kabul edilir
function withdraw() external onlyValidator;

/// Devletin kendi iç işi — oy gerekmez. Yalnız o devletin VALIDATOR adresi çağırır; anahtar başka bir devletin
/// delegesiyse reddedilir (DelegateKeyInUse — N1).
function setDelegateKeys(bytes2 stateCode, address[] calldata keys) external;
```

**Eşikler ([[ADR-0002]]):** kabul **2/3**; çıkarma **2/3** (çıkarılanın oyu
sayılmaz); protokol yükseltme **2/3**; NETWORK şeması **2/3** (§4.3); kayıt
yönetimi önerileri **2/3** ([[ADR-0055]]). Yürütmede destek oyları bugünkü
`ACTIVE` üyelerin validator adresinden yeniden sayılır: çekilen ya da çıkarılan
üyenin eski oyu eşiği dolduramaz (GV3; 2026-10-19 güvenlik turu). Protokol
yükseltmesi eşik dolunca kuyruğa alınır ve en erken 7 gün sonra, eşik yeniden
sayılarak uygulanır; katılmayan devlet bu sürede çekilebilir ([[ADR-0055]]/GE1).

**Asgari mutlak oy = 2 (2.1.0 — review bulgusu R6):** 2/3 kuralı n<3'te
dejenere olur. İki üyeli ağda çıkarma oylamasında eligible=1 → required=1;
yani **bir devlet diğerini tek başına atabilirdi**. `requiredVotes` artık
`max(ceil(2n/3), 2)` döner. Sonuç: iki üyeli ağda çıkarma **imkânsızdır**.
Bu bilinçli bir anayasal korumadır; üçüncü üye gelene kadar ağ bir ortaklık
gibi davranır. (İlk metin "iki taraf da yalnızca gönüllü `withdraw` edebilir"
diyordu; [[ADR-0076]] bunu değiştirdi — aşağıdaki paragraf.)

**İki üyeli ağda çıkış ([[ADR-0076]] GC1–GC3; 2026-11-12).** Tek taraflı çıkış
(`withdraw`) yalnız ağda en az üç etkin üye varken geçer. Etkin üye sayısı 2 ya
da daha az iken `TooFewMembers(active, required)` ile reddedilir (`required` = 3,
yani asgari mutlak oy + 1). Gerekçe: iki üyeden biri çekilseydi sayı 1'e düşer,
asgari mutlak oy 2 olduğundan kalan üye hiçbir öneriyi (yeni üye kabulü dahil)
yürütemez, kendisi de çekilemezdi; yönetişim kalıcı olarak kilitlenirdi (kontrat
denetimi 2026-11-11). Çıkış da çıkarma da etkin üye sayısını 2'nin altına
indiremez.

İki üyeli ağda çıkmak isteyen üyenin yolu:

1. Üçüncü bir üye kabul edilir: `proposeStateAdmission` + iki üyenin oyu +
   `execute` (etkin üye sayısı 3 olur).
2. Üye `withdraw` çağırır; bu adım oy gerektirmez (etkin üye sayısı 2'ye iner,
   kalan iki üye karar almayı sürdürür).

Kabul gerçekleşene kadar üye validator'ını durdurabilir ve kayıt yazmayı
bırakabilir; üyelik kaydı sürer. Öteki üye kabule oy vermezse çıkış zincirde
gerçekleşmez: bu, iki üyeli ağın ortaklık gibi davranmasının bilinçli sonucudur.
[[ADR-0002]] #5 bu kayıtla okunur: çıkış hakkı kalkmaz, sıraya bağlanır.
`LastValidator` yalnız çıkarma önerisinde (`proposeStateRemoval`) kalır.

**Kuruluş (2026-11-11; en az iki kurucu 2026-11-12, [[ADR-0076]] GC4).**
`initialize` sıfır devlet kodunu (`0x0000`) ve sıfır validator adresini reddeder
(`ZeroAddress`). Ağ **en az iki kurucuyla** kurulur: ikiden az kurucu ya da
uzunluğu tutmayan listeler `FounderMismatch` ile reddedilir. Gerekçe: tek üyeyle
hiçbir öneri yürütülemez (asgari mutlak oy 2), yeni üye de kabul edilemez;
yönetişim ilk bloktan kilitli doğardı. Tek kuruculu kuruluş için bayrak ya da
istisna yoktur; yerel geliştirme zinciri ve testler de iki ya da üç kurucuyla
kurulur. Kurulum kodu aynı kuralı dağıtımdan önce denetler
(`contracts/scripts/lib/deploy.ts`, `network-setup.ts`; test ağının anahtar
haritası en az iki kurucu ister). QBFT doğrulayıcı sayısı ayrı bir konudur:
tek doğrulayıcılı yerel zincirde de Governance iki kurucuyla kurulur.

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
function revokeRootCA(bytes32 caId, bytes32 reasonHash) external onlyOwnerState(_stateOf(caId));

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
/// parentCA: kurumun KENDİ devletinin ACTIVE kök sertifikası (CA3; ADR-0054/NS2 — aksi CrossStateReference)
function registerIssuer(Issuer calldata data) external onlyOwnerState(data.stateCode);
function suspendIssuer(bytes32 issuerId) external onlyOwnerState(_stateOf(issuerId));
function reinstateIssuer(bytes32 issuerId) external onlyOwnerState(_stateOf(issuerId));   // SUSPENDED → ACTIVE, IssuerReinstated
/// successorId: aynı devletin ACTIVE kurumu, kendisi değil (InvalidSuccessor; NS2 — CrossStateReference)
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

isCredentialAcceptable(id, iat) =                     // doğrulama C1 (ADR-0073 K5)
      statusAt(id, iat) == ACTIVE                     // durum iat anında; aralık yarı açık [since, sonraki since)
   && iat ∈ [validFrom, validUntil]
   && (invalidatesFrom == 0 || iat < invalidatesFrom) // sert iptal (ADR-0073 K2)
   && RootCARegistry.isChainAcceptableAt(parentCA, iat) // kök iat anında ACTIVE ve hiç REVOKED değil
```

**Askı (2026-11-04, liste kuralı):** askı yalnız askı süresinde verilen belgeyi düşürür; askıdan **önce** verilmiş belge
geçerlidir ([[ADR-0073]] K5, [[ADR-0009]] D-BC-3 `iat` kuralı, GV1). Önceki metindeki "SUSPENDED → false (ihtiyati)" kuralı
kalktı; imzalı liste ile zincir aynı cevabı verir.

**Yumuşak iptalin anlamı artık kesin:** `revokedAt`'ten **önce** verilmiş
credential kabul edilir (`iat < revokedAt`); iptal anında ya da sonra verilmiş (sahte tarihli) reddedilir.

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

**Kayıtlı şema (2026-11-11).** `setSchemaAuthorization(…, true)` şema
`SchemaRegistry`'de kayıtlı değilse `UnknownSchema` ile reddedilir (yazım hatası
boş bir yetki bırakmaz; sonradan kaydedilen şema eski bir yetkiyi kendiliğinden
devralmaz). Geri alma kayıt aramaz.

**Başka devletin ulusal şeması ([[ADR-0079]]; karar 2026-11-12, uygulama
bekliyor).** Bugün yetki fonksiyonu şemanın katmanına ve sahibi olan devlete
bakmaz: bir devlet, kendi kurumunu başka bir devletin `NATIONAL` şemasına tek
başına yetkilendirebilir ve C2 bunu kabul eder. Karar: bu yetki ancak şema
sahibi devletin onayıyla verilebilir (FS1). Onay, şema ve yetki alan devlet
başına açık bir kayıttır; zaman penceresi taşır, `CrossRecognition`'da tutulur
ve şema sahibi o devleti tanıyorken yürürlüktedir (FS2); C2 belgenin `iat`
anına göre yetkiyle birlikte onaya da bakar (FS3). Ağ şemaları ve devletin
kendi ulusal şemaları kuralın dışındadır. Kontrat değişikliği ikinci devlet
katılmadan önce yapılır; o güne kadar yukarıdaki davranış geçerlidir (§14
madde 9).

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
/// Ad alanı (ADR-0054/NS1): NATIONAL vctURI = urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm> (<cc> kaydı yapan devletin
/// küçük harfli kodu; aksi NationalVctOutsideNamespace); NETWORK vctURI bu biçimde olamaz (NetworkVctInNationalNamespace).
function schemaIdOf(string calldata vctURI) external pure returns (bytes32);

function registerSchema(SchemaRecord calldata rec) external;
function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external;
function revokeSchema(bytes32 schemaId, bytes32 reasonHash) external;
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

**Ad alanları ayrıktır ([[ADR-0054]]/NS1).** NATIONAL kaydın `vctURI`'si
[[ADR-0010]]'daki devlet-özel biçimdedir ve kendi devlet kodunu taşır; NETWORK
kaydı bu biçimde olamaz (Governance öneri anında da denetler). Böylece bir ağ
şeması oylanırken hiçbir devlet aynı adı ulusal şema olarak kapamaz. NETWORK
şemasının kullanımdan kaldırılması ve iptali Governance önerisiyle yapılır
(`proposeNetworkSchemaDeprecation`, `proposeNetworkSchemaRevocation`; §1).

## 4.4 Değişmezler

- **SC1** — Kayıtlı bir şemanın `vctURI`'si ve yazılmış her içerik özeti **asla
  güncellenmez ya da silinmez**; yeni sürüm özeti yalnız eklenir
  (`addSchemaContentHash`, 2026-11-04 — [[ADR-0073]] K3/CE3). Ana sürüm değişikliği
  = yeni `vct` = yeni `schemaId`.
- **SC2** — `deprecateSchema` ve `revokeSchema` `status` alanını değiştirir;
  `deprecateSchema` ayrıca halefi (`supersededBy`, §4.1 imzası) yazar. Başka
  alan değişmez (SC1).
- **SC3** — `DEPRECATED` bir şema **doğrulanabilir kalır**; yalnızca yeni ihraç
  engellenir ([[SPEC-SCHEMA-0001]] §9.2). 2026-11-04'ten ([[ADR-0073]] K5) beri
  doğrulama `iat` anındaki duruma bakar: kullanımdan kaldırılmadan önce verilmiş
  belge kabul, sonra verilmiş belge ret.
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

/// recognizingState AÇIKÇA parametredir: delege hangi devlet adına yazdığını beyan eder, onlyOwnerState doğrular
function setRecognition(
    bytes2 recognizingState,
    bytes2 recognizedState,
    RecognitionMode mode,
    IssuerCategory[] calldata categories
) external onlyOwnerState(recognizingState);

/// İstisna: genel tanı ama şu issuer'ı tanıma (blocked=false kaldırır)
function setIssuerBlocklist(bytes2 byState, bytes32 issuerId, bool blocked) external onlyOwnerState(byState);

/// Kurucular arası FULL — yalnız governance, BİR KEZ (AlreadyBootstrapped); Governance önerisiyle (ADR-0055 K3)
function bootstrapFounders(bytes2[] calldata founders) external onlyGovernance;

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

> **2026-11-04 — [[ADR-0073]] K4 (CE4).** Kimlik `keccak256(dns_name)`, sertifika güncelleme, askıdan dönüş ve öğe öğe kapsam;
> kaba `allowedScopes`, `updateScope`, `hasScope` kalktı (§14 açık konu 3 kapandı).

```solidity
enum RPStatus { NONE, ACTIVE, SUSPENDED, REVOKED }
enum PresentationFormat { SD_JWT_VC, MSO_MDOC, MSO_MDOC_ZK }   // dc+sd-jwt, mso_mdoc, mso_mdoc_zk — yalnız sona eklenir

struct RelyingParty {
    bytes32  rpId;                   // keccak256(utf8(dns_name)) — kayıt kurumu hesaplar; ABI'de alan adı metni yok
    bytes2   stateCode;              // egemenlik (N1)
    bytes32  nameHash;
    bytes32  accessCertFingerprint;  // güncellenebilir; aynı anda yalnız bir doğrulayıcıya ait
    RPStatus status;
    uint64   registeredAt;           // göç kipinde açık tarih (ADR-0073 K1); aksi hâlde 0 verilir
}

struct RequestScope {                // listedeki bir kullanım (relying_parties[].scopes[])
    bytes32   scopeHash;             // keccak256(scope_id)
    bytes32   serviceHash;           // keccak256(service_id ?? scope_id)
    bytes32   schemaId;              // keccak256(vct)
    PresentationFormat format;
    bytes32   namespaceHash;         // keccak256(mdoc_namespace) ya da 0
    bytes32[] attributes;            // keccak256(utf8(öğe yolu)), kesin artan sırada; en çok MAX_ATTRIBUTES = 64
    uint64    validFrom;
    uint64    validUntil;            // 0 = açık uçlu; yarı açık [validFrom, validUntil)
    bytes32   detailsHash;           // purpose, purpose_localized, privacy_policy_uri bloğunun RFC 8785 + SHA-256'sı
}

function registerRelyingParty(RelyingParty calldata data) external onlyOwnerState(data.stateCode);
function updateAccessCertificate(bytes32 rpId, bytes32 newFingerprint) external onlyOwnerState(_stateOf(rpId)); // REVOKED değil
function suspendRelyingParty(bytes32 rpId) external onlyOwnerState(_stateOf(rpId));     // yalnız ACTIVE (RelyingPartyNotActive)
function reinstateRelyingParty(bytes32 rpId) external onlyOwnerState(_stateOf(rpId));   // yalnız SUSPENDED
function revokeRelyingParty(bytes32 rpId) external onlyOwnerState(_stateOf(rpId));      // kesin (AlreadyRevoked)
// tarihli biçimler (2026-11-05; §16.1 tarih kuralı): at = 0 → blok zamanı; geçmiş tarih yalnız göç kipinde, kayıt başına sıralı
function suspendRelyingPartyAt(bytes32 rpId, uint64 at) external;
function reinstateRelyingPartyAt(bytes32 rpId, uint64 at) external;
function revokeRelyingPartyAt(bytes32 rpId, uint64 at) external;
function setRequestScope(bytes32 rpId, RequestScope calldata scope) external onlyOwnerState(_stateOf(rpId)); // ekle / güncelle; en çok MAX_SCOPES = 32
    // aralığı bitmiş (kapanmış) kapsam aynı scopeHash ile güncellenemez (ScopeClosed); kapanmış kapsamlar da tavana sayılır
function closeRequestScope(bytes32 rpId, bytes32 scopeHash, uint64 at) external onlyOwnerState(_stateOf(rpId)); // silinmez, aralığı kapanır

function isValidRelyingParty(bytes32 rpId) external view returns (bool);
function rpIdOfCertificate(bytes32 fingerprint) external view returns (bytes32);
function mayRequest(bytes32 rpId, bytes32 serviceHash, bytes32 schemaId, PresentationFormat format,
                    bytes32 namespaceHash, bytes32 attribute) external view returns (bool);
function requestScopesOf(bytes32 rpId) external view returns (RequestScope[] memory);
function getRelyingPartiesByState(bytes2 stateCode) external view returns (bytes32[] memory);
```

**Aşırı istek koruması:** cüzdan, belge sunmadan önce (1) doğrulayıcı kayıtlı ve etkin mi, (2) istenen her öğe için "bu
doğrulayıcı bu hizmette, bu türde, bu biçimde, bu öğeyi şu anda isteyebilir mi" (`mayRequest`) diye sorar. Öğe adları ABI'de
`attribute` olarak geçer (kişisel veri denetiminin yasak köklerinden kaçınır, DP1).

> **`accessCertFingerprint` = `x509_hash`.** [[SPEC-PROTO-0002]] §2.2: OpenID4VP 1.0 / HAIP'in client identifier prefix'i
> `x509_hash`, `base64url(SHA-256(DER yaprak sertifika))` değeridir — bu alandaki `bytes32` ile birebir aynı baytlar. Cüzdan istekteki
> client identifier'ı `rpIdOfCertificate` ile kalıcı kimliğe çözer; sertifika yenilenince kimlik, takma adlar ve açıklama
> politikası değişmez ([[ADR-0034]] CI3/CI4).

## 6.1 Kayıt dönemleri: devir ve iptal sonrası yeniden kayıt ([[ADR-0075]] RO1–RO4)

```solidity
enum PeriodAction { NONE, REASSIGNMENT, RE_REGISTRATION }      // yalnız sona eklenir
struct PeriodChange {                                           // Governance önerisinin sabitlenmiş içeriği (serbest metin yok)
    PeriodAction action; bytes32 rpId; bytes2 fromState; bytes2 toState;
    bytes32 nameHash; bytes32 accessCertFingerprint; bytes32 reasonHash;
}
struct RegistrationPeriod { bytes2 stateCode; uint64 since; }  // dönem 0 = ilk kayıt; silinmez

function stagePeriodChange(PeriodChange calldata change) external returns (bytes32 stageId);   // herkes; yalnız saklar
function commitPeriodChange(bytes32 stageId, PeriodAction action) external;                    // yalnız Governance
function periodChangeIdOf(PeriodChange calldata change) external view returns (bytes32);       // keccak256(change, dönem sayısı)
function stagedPeriodChangeOf(bytes32 stageId) external view returns (PeriodChange memory, uint32 basePeriods);
function registrationPeriodsOf(bytes32 rpId) external view returns (RegistrationPeriod[] memory);
function relyingPartyAt(bytes32 rpId, uint64 t) external view returns (RPStatus, bytes2 stateCode, uint32 period);
function isRelyingPartyAcceptableAt(bytes32 rpId, uint64 t) external view returns (bool);
function relyingPartyStatusHistoryOf(bytes32 rpId) external view returns (StatusHistory.Change[] memory);
// Governance (REGISTRY_ADMIN, AdminAction REASSIGN_RELYING_PARTY / REREGISTER_RELYING_PARTY):
function proposeRelyingPartyReassignment(address registry, bytes32 stageId) external returns (bytes32);
function proposeRelyingPartyReRegistration(address registry, bytes32 stageId) external returns (bytes32);
// Olaylar: PeriodChangeStaged, RelyingPartyReassigned(rpId, fromState, toState, period, reasonHash),
//          RelyingPartyReRegistered(rpId, stateCode, period, reasonHash)
```

- **Yürütme koşulları:** kayıt var; `fromState` bugünkü sahip; sabitlemedeki dönem sayısı bugünküyle aynı (`StalePeriodChange`);
  öneri türü içerikle aynı (`UnknownPeriodChange`); `toState` etkin üye; devirde kayıt `REVOKED` değil ve `toState ≠ fromState`,
  yeniden kayıtta kayıt `REVOKED` (`InvalidPeriodChange`); yeni erişim sertifikası başka doğrulayıcıda değil (`CertificateInUse`).
- **Yeni dönem:** kayıt `ACTIVE`, `registeredAt` = yürütme anı (geri tarihlenmez; göç penceresinde de), ad özeti ve sertifika
  yenilenir, eski sertifika serbest kalır; `getRelyingPartiesByState` yalnız eklenir (devletin sahip olduğu ya da olmuş kimlikler).
  Kapsamlar, kayıt verisi ve kapı grubu listesi dönem anahtarıyla (`dönem 0 → rpId`, sonra `keccak256(rpId, dönem)`) tutulur;
  eski dönemin kayıtları silinmez, yeni dönem devralmaz; eski dönemin açık kapı grupları yürütme anında kapanır (`TerminalGroupClosed`).
- **`t` anındaki okuma:** durum bütün dönemler boyunca tek, yalnız eklenen geçmişte (`StatusHistory`); `relyingPartyAt(t)` o andaki
  durumu, sahibi devleti ve dönemi verir. Devletin olağan durum yazımları (askı, dönüş, iptal) blok zamanıyla geçmişe eklenir.

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
    uint8      bitsPerEntry;  // listenin kendi bits değeri: 1, 2, 4, 8 (ADR-0063); Tamga'da kimlik servisi 1, kurum 2
    uint64     version;       // monoton artan
    uint64     publishedAt;
    ListStatus status;
}

uint32 public constant MIN_LIST_SIZE = 100_000;
function isAllowedBits(uint8 bits) public pure returns (bool); // 1, 2, 4, 8 — IETF Token Status List (ADR-0063)
```

**Zincirde tek bir iptal biti yoktur.** Bitmap off-chain'dedir.

## 7.2 Arayüz

```solidity
/// listId = keccak256(abi.encodePacked(issuerId, bytes(listURI)))
function listIdOf(bytes32 issuerId, string calldata listURI) external pure returns (bytes32);

/// Kurum başına günde en çok MAX_LIST_REGISTRATIONS_PER_ISSUER_PER_DAY (8) yeni liste (ADR-0054/NS3)
/// bitsPerEntry = listenin imzalı belirtecindeki status_list.bits; bir kez yazılır (ADR-0063/BL1)
function registerList(bytes32 issuerId, string calldata listURI, uint32 listSize, uint8 bitsPerEntry)
    external onlyIssuerDelegate(issuerId) returns (bytes32 listId);
// event ListRegistered(listId, issuerId, listURI, listSize, bitsPerEntry)

function publishList(bytes32 listId, bytes32 contentHash, uint64 version, uint64 publishedAt)
    external onlyIssuerDelegate(_issuerOf(listId));

function retireList(bytes32 listId, bytes32 reasonHash) external onlyIssuerDelegate(_issuerOf(listId));

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
- **L3** — `bitsPerEntry ∈ {1, 2, 4, 8}` — listenin kendi bit sayısı, kayıtta bir kez yazılır ([[ADR-0063]]/BL1; 2026-10-23'e
  kadar `== 2`). Türe göre bit kuralı ([[ADR-0048]]) kontratta değil, yayıncıda ve doğrulayıcıdadır (BL2).
- **L4** — `listURI` bir kez yazılır, güncellenmez.
- **L5** — İndeks tahsisi, doluluk oranı ve URI opaklığı kuralları
  **kontrat dışıdır** ve [[SPEC-CRED-0003]] §6'da normatiftir. Kontrat bunları
  zorlayamaz; issuer disiplinidir.

---

# 8. Kontrat Topolojisi

> 2026-11-04: `NetworkRegistry` (§16.5) Governance'a bağlı ağ düzeyi kayıttır; dağıtım `scripts/lib/deploy.ts` (StatusListRegistry'den
> sonra, `initialize(governance)`).

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

**Oylanan şey koddur (kontrat denetimi 2026-11-11).** Öneri açılırken yeni
implementasyonun kod özeti (`EXTCODEHASH`) saklanır (`upgradePayloadOf`);
`execute` kuyruğa alırken ve uygularken yeniden okur, farklıysa
`UpgradeImplementationChanged` ile düşer. Gerekçe (bulgunun yapıldığı gün):
zincir Shanghai kural setiyle tasarlanmıştı, orada `SELFDESTRUCT` kodu siler;
`CREATE2` ile dağıtılmış bir implementasyon bekleme süresinde silinip aynı
adrese başka kodla yeniden dağıtılabilirdi. 2026-11-12'den beri zincir **Cancun**
kural setiyle kurulur ([[ADR-0077]]): `SELFDESTRUCT` kodu silmez (EIP-6780) ve
bu yol kapalıdır; denetim ikinci savunma hattı olarak kalır (CR3). Oy verenler
adresi değil, `implCodehash`'i incelenen derleme çıktısıyla karşılaştırır. Kod özeti implementasyonun bağlandığı başka
kontratların (kütüphane) kodunu kapsamaz; bugün hiçbir kontrat dış kütüphaneye
bağlanmaz ve yükseltme incelemesi bunu denetler.

**Bekleme süresi ve başlangıç çağrısı ([[ADR-0055]]).** Eşiği dolan yükseltme
önce kuyruğa alınır (`ProposalQueued`), en erken 7 gün (`UPGRADE_DELAY`) sonra
ve en geç 30 gün içinde, eşik yeniden sayılarak uygulanır. Başlangıç fonksiyonu
olan yeni sürüm `proposeProtocolUpgradeAndInit` ile aynı işlemde etkinleşir;
öneri yalnız parametresiz fonksiyonun 4 baytlık seçicisini taşır (serbest veri
yok, DP1).

**Depolama düzeni:** Her yükseltilebilir kontrat `__gap` dizisi taşır ve
depolama düzeni değişikliği yalnızca sona ekleme şeklinde yapılır. CI'da
depolama düzeni karşılaştırması zorunludur (`contracts:storage-check`, taban
çizgisi `contracts/storage-layout/`). Statik analiz CI'da Slither ile yapılır
(`contracts:slither`; dışlanan dedektörler ve gerekçeleri
`contracts/slither.config.json`).

**Kod boyutu (2026-11-11).** Bir kontratın çalışma kodu en çok 24.576 bayttır
(EIP-170). `contracts:check` her kontratın boyutunu ölçer ve sınıra 512 bayttan
az kalmışsa hata verir (`contracts/scripts/check-code-size.mjs`); pay azalınca
eşik düşürülmez, mantık ayrılır. Governance 24.530 bayttan 22.881 bayta indi
(`onlyValidator` gövdesi ve yinelenen denetimler ortak fonksiyonlara alındı;
dış arayüz ve depolama düzeni değişmedi).

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
    // isOperational: CA'ya bakmaz — CA rotasyonu (RETIRED) yayını durdurmaz (CA2, §3.2)
    if (!issuerRegistry.isOperational(issuerId))               revert IssuerNotActive(issuerId);
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

> **Uygulama notu (2026-11-04, [[ADR-0074]] K5).** İndeksleyici `apps/chain-indexer/` (`ChainIndexer`): kontrat olayları değişen
> kaydı bulur, kaydın tamamı (durum geçmişi, yetki pencereleri, kapsamlar, dönemler, çapa) **aynı sabitlenmiş bloktaki** okumayla
> dizine yazılır; `sync()` artımlıdır, dizin düz JSON'dur (bellek ya da dosya). `ChainTrustSource` `TrustSource` arayüzünü dizinden
> cevaplar; kurallar yukarıdaki beş okumanın kurallarıdır (C1 = 1+kök, C2 = 2, C3 = 4, D5 = 5; şema bütünlüğü 3 sürüm özetleriyle).
> Dizin bayatsa cevap `UNKNOWN`'dur (CMP4). Zincir istemcisi uygulamadadır; `@tamga-network/trust` zincir bağımlılığı taşımaz
> ([[ADR-0015]] K1). Ayrıntı §16.8.

---

# 12. Gas ve İzin Politikası

## 12.1 Gas

İzinli ağda gas **ücretsizdir** (`gasPrice = 0`). Ancak bu, spam'in serbest
olduğu anlamına gelmez.

| Mekanizma | Nasıl |
|---|---|
| **Hesap izni** | Besu yerel izinlendirme ([[ADR-0052]]): her düğümde `permissions_config.toml` hesap izin listesi — yalnızca validator'lar, devlet ve kurum delege anahtarları ve liste çapası yazıcıları işlem gönderebilir. Liste zincir durumundan üretilir ve bütün validator'larda aynıdır (LP2, LP3) |
| **Blok gas limiti** | Tek işlemin blok kapasitesini tüketmesi engellenir |
| **Kontrat içi kota** | Devlet başına günlük yazma sayacı (§12.2) |

Hesap izni ikinci savunma hattıdır; yazma yetkisinin asıl denetimi kontratlardadır (N1, R1, R2, [[ADR-0051]]/CH3) ve izin
listesi bu yetkiyi genişletmez ([[ADR-0052]]/LP4). Zincir üstü izin kontratı yoktur: Besu 25.6.0 zincir üstü izinlendirmeyi ve
Tessera tabanlı gizliliği kaldırdı; ikisine de gerek yoktur (zincirde kişisel veri yok, DP1). Düğüm izni aynı dosyanın düğüm
izin listesidir; düğümün JSON-RPC ucu internete açılmaz, dış erişim mTLS'li ters vekil arkasındandır ([[ADR-0052]] K5).
Kümeleri sayan okuma görünümleri (üye listesi, yazıcı listesi, kurum delege listesi) §16.7'de; izin aracı
(`trust:chain-permissions render|check`) ve yerel deneme §16.9'da.

**Değişmez GA1:** Gas ücretsiz olsa bile, zincire yazılan her bayt her
validator'ın diskinde kalıcıdır. "Ücretsiz" maliyet yokluğu değildir — bu,
[[ADR-0007]] ve [[ADR-0008]]'deki off-chain kararlarının temel gerekçesidir.

## 12.2 Kota

```solidity
// TamgaRegistryBase — her kayıt kontratında AYRI sayılır (ADR-0054/NS3)
uint32 public constant MAX_WRITES_PER_STATE_PER_DAY = 10_000;
// StatusListRegistry — LİSTE başına
uint32 public constant MAX_PUBLISH_PER_DAY = 48;                        // saatte 1 + pay
// StatusListRegistry — KURUM başına yeni liste kaydı
uint32 public constant MAX_LIST_REGISTRATIONS_PER_ISSUER_PER_DAY = 8;
```

Birinci kota devletin her ulusal yazımını sayar (`onlyOwnerState` yolu: kayıt,
askı, iptal, yenileme, delege, şema yetkisi, tanıma); her kayıt kontratı kendi
sayacını tutar, yani bir devletin günlük toplam ulusal yazımı kayıt kontratı
sayısıyla sınırlıdır. İkinci kota, [[SPEC-CRED-0003]] §5.1'in saatlik yayın
döngüsünü hem destekler hem sınırlar; liste başınadır (birden çok listesi olan
kurum her listesini saatlik yayınlar). Üçüncü kota yayın kotasının yeni liste
açılarak aşılmasını engeller.

Kota aşımı `QuotaExceeded`, `PublishQuotaExceeded` ve
`ListRegistrationQuotaExceeded` ile revert eder; sayaçlar UTC gün başında
sıfırlanır.

**Göç kipi istisnası (2026-11-04, [[ADR-0073]] K1):** bir kontratta göç kipi açıkken o kontratın üç kotası da uygulanmaz
(sayaç artmaz); kip kapanınca aynen döner (§16.1).

---

# 13. Tüm Değişmezler (Özet)

| # | Değişmez |
|---|---|
| **N1** | Namespace sahibi olmayan çağıran yazamaz; tek istisna `Governance` yürütmesi (NETWORK şeması, yükseltme, kayıt yönetimi önerileri). |
| **GV1** | Çıkarma/çıkış mevcut kayıtları ve credential'ları geçersiz kılmaz. |
| **GV2** | NETWORK şeması yalnızca `Governance` üzerinden kaydedilir. |
| **CA1** | `certFingerprint` bir kez yazılır; yeni sertifika = yeni `caId`. |
| **CA2** | `RETIRED` CA: operasyon ve eski credential'lar sürer; `REVOKED` CA: credential'lar düşer, operasyon sürer. |
| **CA3** | Yeni issuer yalnızca `ACTIVE` CA'ya bağlanabilir. |
| **I1** | Şema yetkisi allowlist'tir; varsayılan `false`. |
| **I2** | Doğrulama `isCredentialAcceptable(id, iat)` kullanır; `isValidIssuer` yalnızca ihraçtır. |
| **I3** | Şema yetkisi zaman penceresidir; doğrulama `iat`'a göre bakar. |
| **I4** | `REVOKED` issuer'ın listesini halefi yayınlayabilir. |
| **SC1** | Şemanın `vctURI`'si ve yazılmış her içerik özeti asla güncellenmez ya da silinmez; yeni sürüm özeti yalnız eklenir. |
| **SC3** | `DEPRECATED` şema, kullanımdan kaldırılmadan önce verilmiş belgeler için doğrulanabilir kalır. |
| **L1** | Status list `version` monoton artar. |
| **L2** | `listSize >= 100.000`. |
| **L3** | `bitsPerEntry ∈ {1, 2, 4, 8}`, listenin kendi değeri, değişmez ([[ADR-0063]]). |
| **R1** | Issuer delegate anahtarı ulusal kayıtlara yazamaz. |
| **R2** | Askıya alınmış issuer status list yayınlayamaz. |
| **GA1** | Ücretsiz gas, maliyet yokluğu değildir. |
| **GV3** | Asgari mutlak oy 2; iki üyeli ağda çıkarma imkânsızdır. |
| **GV4** | Çıkarılmış/çekilmiş devlet yeniden kabul edilebilir. |
| **DP1** | Hiçbir kontrat kişisel veri, credential içeriği veya credential hash'i saklamaz. |

ADR'lerde tanımlı kontrat kuralları (burada tekrarlanmaz): [[ADR-0051]]/CH1–CH5, [[ADR-0052]]/LP1–LP5, [[ADR-0053]]/AC1–AC4,
[[ADR-0054]]/NS1–NS3, [[ADR-0055]]/GE1–GE3, [[ADR-0063]]/BL1–BL2, [[ADR-0073]]/CE1–CE6, [[ADR-0074]]/PJ1–PJ5.

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
3. ~~RP scope'ları `schemaId`'ye bağlansın mı?~~ — **KAPANDI** (2026-11-04,
   [[ADR-0073]] K4): kapsam kayıtları tür, biçim, ad alanı ve öğe özetleriyle (§6).
4. ~~Proxy/upgrade deseni~~ — **KAPANDI** (2026-09-09), UUPS (§9).
5. Cross-recognition matrisinin okuma optimizasyonu (büyük N) — indeksleyici
   ile çözülüyor mu, yoksa kontrat tarafı optimizasyon gerekiyor mu?
6. `MAX_WRITES_PER_STATE_PER_DAY` değeri saha verisiyle kalibre edilmeli.
7. Guardian/escrow kontratları ayrı kapsamda — [[SPEC-BC-0002]] mevcut, bu
   dokümanla arayüz tutarlılığı gözden geçirilmeli.
8. ~~**İki üyeli ağda çıkış** (kontrat denetimi 2026-11-11): etkin üye sayısı 2
   iken `withdraw` yönetişimi kalıcı olarak kilitler.~~ — **KAPANDI**
   (2026-11-12, [[ADR-0076]]): iki üyeli ağda `withdraw` reddedilir; çıkmak
   isteyen üye üçüncü üyenin kabulünden sonra çekilir (§1).
9. **Başka devletin ulusal şemasına yetki** (2026-11-11): bir devlet kendi
   kurumunu başka bir devletin `NATIONAL` şemasına yetkilendirebilir (§3.4);
   kontrat engellemez. — **KARAR VERİLDİ, UYGULAMA BEKLİYOR** (2026-11-12,
   [[ADR-0079]]): yetki ancak şema sahibi devletin onayıyla verilir; onay şema
   başına açık kayıttır ve karşılıklı tanımaya bağlıdır; ağ şemaları kapsam
   dışıdır. Kontrat, liste yayıncısı ve eşdeğerlik testi ikinci devlet
   katılmadan önce uygulanır.
10. ~~**Zincir kuralları Shanghai** (2026-11-11): `SELFDESTRUCT` kodu siler.~~ —
    **KAPANDI** (2026-11-12, [[ADR-0077]]): zincir Cancun kural setiyle kurulur
    (genesis `cancunTime: 0`, derleme hedefi `cancun`); `SELFDESTRUCT` kodu
    silmez. §9'daki kod özeti denetimi kalır.

---

# 15. Liste çapası kaydı ve uygulama durumu (2026-10-19)

> **Yürürlükte** — [[ADR-0051]] (kabul 2026-10-19). Kod hazır, üretimde kapalıdır.

**Uygulama durumu.** §1–§11'deki sekiz kontrat ilk kez derleniyor ve test ediliyor (Hardhat, solc 0.8.24, evm cancun — [[ADR-0077]]; 2026-11-12'ye kadar shanghai,
OpenZeppelin 5.6; `contracts/`, `npm run contracts:test`). Derleme için tek değişiklik: OZ 5.6'da `__UUPSUpgradeable_init` yok,
çağrılar kaldırıldı; belgelenen davranış değişmedi. `Initializable` ve `UUPSUpgradeable` 2026-11-04'ten beri doğrudan
`@openzeppelin/contracts/proxy/utils/`'den alınır (5.6'da `contracts-upgradeable`'daki aynı adlı dosyalar bunları yeniden dışa
aktarır; depolama ERC-7201 ad alanında, düzen değişmedi). Üretimde çalışan zincir **yoktur** ([[ADR-0009]] K4); yerel geliştirme
zinciri Hardhat düğümüdür.

**Ne çapalanır.** Zincir imzalı listelerin **projeksiyonudur**, kaynağı değil. `TrustListAnchorRegistry` iki kayıt tutar:

| Kayıt | Alanlar | Kaynak |
|---|---|---|
| Liste sürümü | `listKey = keccak256("tamga:trust-list:<ortam>:<dosya>")`, `version`, `contentHash = sha256(<dosya>.jws)`, `previousHash`, `issuedAt` | `lotl.jws`, `tl-<cc>.jws` ([[SPEC-TRUST-0001]] §3–§4) |
| Çapa günlüğü başı | `logKey = keccak256("tamga:anchors:<ortam>")`, `seq`, `lineHash = sha256(satır)`, `ts` | `anchors.jsonl` son satırı (§5) |

**Ne zaman.** Liste yayıncısı (`npm run trust:chain-submit`) her liste yayınından ve saatlik çapa satırından sonra; set önce
yükleyiciyle doğrulanır (sağlıksız set çapalanmaz). Bayrak `TAMGA_CHAIN_ENABLED` varsayılan 0: kapalıyken hiçbir bağlantı yok;
`--dry-run` yalnız plan basar.

**Kim yazar.** `governance`'ın yetkilendirdiği yazıcılar. Bir çapa `requiredConfirmations` kadar **farklı** yazıcı birebir aynı
veriyi gönderince onaylıdır; üretimde eşik **≥ 2** (ikinci bağımsız işletmeci kapısı; tek işletmeci onaylı çapa üretemez).
Açılmış sürüm için farklı veri reddedilmez: ayrı **aday** olarak kaydedilir ve `AnchorConflict` olayı yayar (çift konuşma alarmı);
eşik kadar farklı ve hâlâ yetkili yazıcının desteklediği **ilk** aday onaylanır ve sürüm kapanır. Her yazıcı bir sürüm için tek
aday destekler; kümeden çıkarılan yazıcının desteği sayılmaz; eşik yazıcı sayısını aşamaz ([[ADR-0053]]) — kurulumda, eşik
değişirken ve (2026-11-11) yazıcı çıkarılırken: çıkarma yazıcı sayısını eşiğin altına düşürüyorsa `InvalidThreshold` ile
reddedilir; anahtar döndürmede önce yeni yazıcı eklenir, sonra eskisi çıkarılır (ya da önce eşik düşürülür). Sürüm/sıra monoton
açılır; onaylı kayıt değişmez. Yazıcı kümesi ve eşik Governance önerisiyle yönetilir (`proposeAnchorerChange`,
`proposeAnchorThreshold`; [[ADR-0055]]).

**Doğrulayıcı nasıl kullanır.** `trust:chain-check`: elindeki listenin özeti zincirde onaylı mı — `YES` / `NO` (onaylı farklı özet:
alarm, sonuç değişmez) / `UNKNOWN` (kapalı, erişilemez, çapa yok, eşik dolmadı). İsteğe bağlı ek güvencedir; A–E hattının adımı
değildir; `UNKNOWN` sonucu kötüleştirmez. Çelişkide imzalı liste geçerlidir.

**Zincirde OLMAYANLAR.** Liste içeriği; kurum, doğrulayıcı, şema kayıtları (onlar Faz 0 replay'iyle §2–§7 kontratlarına girer,
[[ADR-0009]] K7); belge, belge özeti, iptal biti, kişi, takma ad, cihaz ya da cüzdan kimliği (DP1, [[PM-TRUST-0001]]). Kontratın
ABI'sinde `string`/`bytes` alanı yoktur; `test/privacy-abi.test.ts` bütün kontratlar için bunu denetler.

**Kurallar:** [[ADR-0051]]/CH1–CH5 ve [[ADR-0053]]/AC1–AC4 (bağlayıcı; ADR'de tanımlıdır, burada tekrarlanmaz). Yazıcı adresleri hesap izin listesine bu
kontratın durumundan girer ([[ADR-0052]]/LP2).

---

# 16. ADR-0073 ve ADR-0074 uygulaması (2026-11-04)

> Kurallar ADR'lerdedir (CE1–CE6, PJ1–PJ5); bu bölüm kontrat arayüzünü verir. Uygulanan parçalar sürüm notunda sayılır.

## 16.1 Göç kipi ve `iat` anındaki durum ([[ADR-0073]] K1, K5)

```solidity
// MigrationWindow — RootCA/Issuer/Schema/RelyingParty/CrossRecognition (TamgaRegistryBase üzerinden), StatusListRegistry
enum MigrationPhase { NOT_STARTED, OPEN, CLOSED }      // yalnız ileri
uint64 constant MAX_MIGRATION_WINDOW = 30 days;          // açılış anından
function openMigration(bytes32 replayPlanHash, uint64 deadline, address executor) external;  // yalnız Governance, bir kez
function extendMigration(uint64 deadline) external;      // yalnız açıkken, açılış + 30 güne kadar
function closeMigration() external;                      // kesin
function migrationPhase() external view returns (MigrationPhase); // süresi dolmuş açık pencere = CLOSED
function migrationState() external view returns (MigrationPhase storedPhase, uint64 openedAt, uint64 deadline,
                                                  bytes32 replayPlanHash, address executor);

// Governance — türü belli öneriler (2/3, ADR-0055 GE3), kayıt başına
function proposeMigrationOpen(address registry, bytes32 replayPlanHash, uint64 window, address executor) external;
function proposeMigrationExtend(address registry, uint64 deadline) external;
function proposeMigrationClose(address registry) external;
```

- Depolama ERC-7201 ad alanındadır (`tamga.storage.MigrationWindow`); sıralı düzeni ve `__gap`'leri değiştirmez.
- **Tarih kuralı:** tarih taşıyan yazımların `*At` biçimi (`suspendIssuerAt`, `reinstateIssuerAt`, `revokeIssuerAt`,
  `retireIssuer`, `setSchemaAuthorizationAt`, `suspendRootCAAt`, `reinstateRootCAAt`, `revokeRootCAAt`, `retireRootCAAt`,
  `deprecateSchemaAt`, `revokeSchemaAt`, `suspendRelyingPartyAt`, `reinstateRelyingPartyAt`, `revokeRelyingPartyAt` — 2026-11-05)
  ve kayıt yapılarının `registeredAt` alanı (şemada göçte `validFrom`) açık tarih alır:
  `0` = blok zamanı; açık tarih yalnız kip açıkken (`PastDateOutsideMigration`), blok zamanından ileri değil (`DateInFuture`),
  kayıt başına sıralı (`StatusOutOfOrder`, şema yetkisinde `DateOutOfOrder`). Kip dışında `registeredAt` verilmez.
  **Kip açıkken tarihsiz yazım dondurulur** (güvenlik turu 2026-11-04; K1 "tarih açıkça"): `at` = 0, `registeredAt` = 0 ve
  `publishList(publishedAt = 0)` Governance dışında `DateRequiredDuringMigration` ile reddedilir; acil yazım açık tarihle
  (`at` = şimdi) yapılır. Böylece yeniden oynatılan geçmiş ile o günkü işletim aynı kaydın geçmişinde sessizce yarışmaz.
- **Geçerlilik başlangıcı:** kip dışında kurum ve kök CA `validFrom`'u geçmişe çekilemez (0 = blok zamanı; gelecek serbest;
  `PastDateOutsideMigration`); `validUntil` etkin başlangıçla karşılaştırılır. Kip dışında kaydedilen kurumun ilk ACTIVE penceresi
  başlangıçsız olduğundan geçmiş `validFrom` kayıttan önceki belgeleri kabul ettirirdi (güvenlik turu 2026-11-04).
  Şema `validFrom`'u da aynı kuraldan geçer (kontrol 2026-11-10). Tek ayrım Governance'ın yürüttüğü ağ şeması önerisidir
  (`proposeNetworkSchema`): yük oylama boyunca bekler ve yeniden gönderilemez, bu yüzden yürütme anında geçmişte kalmış
  `validFrom` reddedilmez, başlangıç yürütme anı (blok zamanı) olarak yazılır — kayda yine geçmiş tarih girmez. Hâlâ ilerideki
  tarih aynen yazılır; delege ve göç yürütücüsü için kural değişmez (kod incelemesi 2026-11-11).
- **Kota:** kip açıkken §12.2'deki kotalar uygulanmaz (CE1). Güvenlik turunun "istisna yalnız göç yürütücüsüne" önerisi
  uygulanmadı: ulusal kayıtları yeniden oynatan devlet delegeleridir (K1) ve CE1 kotayı bütün kip için kaldırır; daraltma ADR ister.
- **Ağ düzeyi yazım:** kip açıkken ağ şemasını Governance'ın yanında açılış önerisinin `executor`'u (tek göç yürütücüsü) yazar:
  kayıt, sürüm özeti, deprecate. Ağ şemasının iptali yalnız Governance'tadır (güvenlik turu 2026-11-04;
  `NetworkTierRequiresGovernance`). Yürütücü yalnız **kendi yazdığı** (yeniden oynatılan) ağ şemasını kullanımdan kaldırır;
  Governance'ın kaydettiği ağ şemasında deprecate de yalnız Governance'tadır (kontrat denetimi 2026-11-11). Gerekçe iptalle
  aynıdır: yürütücü, geri tarihli bir deprecate ile (`at` = 1) o şemayla verilmiş bütün belgeleri C2'de düşürebilirdi ve
  deprecate geri alınamaz. [[ADR-0073]] K1'in yürütücüye verdiği iş (listedeki geçmişin yeniden oynatılması) değişmez.
- **İleri tarihli şema başlangıcı (2026-11-11):** kip açıkken `validFrom` blok zamanından ileriyse kayıt reddedilmez; başlangıç
  aynen yazılır, ilk durum anı blok zamanıdır (hiçbir durum anı ileri olamaz, CE1). Eski hâlde ileri tarihli ağ şeması önerisi
  pencere açıkken `DateInFuture` ile yürümüyordu.
- **Yükseltme:** pencere açıkken kayıt kontratı yükseltilemez (`UpgradeDuringMigration`; güvenlik turu 2026-11-04). Governance
  her yükseltmede hedefin `migrationState()`'ini önce ve sonra okur; fark varsa yükseltme geri alınır (`MigrationStateChanged`).
  Kapanmış kip yükseltmeyle açılamaz, pencere uzatılamaz. Yeni implementasyonun göç depolamasına sonradan yazmasını yükseltme
  incelemesi yakalar: `check:uups` `MigrationWindow.sol`'un sabitlenmiş kaynak özetini (`storage-layout/MigrationWindow.pin.json`),
  ERC-7201 slotunu ve başka kaynağın bu slota ya da satır içi assembly'ye dokunmadığını denetler ([[ADR-0073]] uygulama notu).
- **Durum geçmişi:** kurum, kök CA ve şema durumları yalnız eklenebilir `StatusHistory.Change { uint64 since; uint8 status; }`
  dizisinde tutulur; değişiklik `since` anından itibaren geçerlidir, aralık yarı açıktır. Kip dışında kaydın ilk ACTIVE penceresi
  başlangıçsızdır (`since = 0`); göçte listedeki ilk durum anıdır. Okuma: `issuerStatusAt`, `rootCAStatusAt`, `schemaStatusAt`,
  `*StatusHistoryOf`; olaylar `IssuerStatusChanged`, `RootCAStatusChanged`, `SchemaStatusChanged` (anı taşır). Dizi bilinçli
  olarak tavansızdır (tavan ele geçirilmiş kurumun iptalini engelleyebilirdi); yazım O(1), `statusAt` sondan, `ever` baştan tarar;
  büyüme kip dışında günlük kotayla sınırlıdır.
- **Doğrulama:** C1 = kurum `iat` anında ACTIVE ∧ `iat ∈ [validFrom, validUntil]` ∧ `RootCARegistry.isChainAcceptableAt(parentCA,
  iat)` (kök `iat` anında ACTIVE, hiç REVOKED değil). C2 = `SchemaRegistry.isSchemaAcceptableAt(schemaId, iat)` (şema `iat` anında
  ACTIVE, hiç REVOKED değil, ve 2026-11-11'den beri `iat ≥ validFrom`: kip dışında ilk pencere başlangıçsız olduğundan ileri
  tarihli şema bugünden kabul görüyordu) ∧ yetki penceresi `iat ∈ [since, until)`. Böylece: askıdan önceki belge kabul, askı süresinde ret;
  iptal ya da yetki geri alma anında verilen belge ret; emekli kökün emeklilikten sonraki belgeleri ret; DEPRECATED'dan önce
  verilmiş belge kabul. Bugünkü durum soruları (`isValidIssuer`, `isOperational`, `isChainAcceptable`, `isActiveSchema`) değişmedi.
- **Eşleme yardımcıları:** listedeki kurum `RETIRED` → `retireIssuer` (yumuşak iptal + `IssuerRetired`); kök `ROLLING_OVER` →
  ACTIVE + `announceRootCARollover` (`RootCARollingOver`).
- **Okuma görünümleri (C33 (1)):** `Governance.memberList`, `IssuerRegistry.issuerDelegatesOf`.

## 16.2 Sert iptal ([[ADR-0073]] K2, CE2)

```solidity
event IssuerInvalidatedFrom(bytes32 indexed issuerId, uint64 invalidatesFrom);
error InvalidInvalidatesFrom(uint64 invalidatesFrom);
/// kurum REVOKED; validFrom ≤ invalidatesFrom ≤ revokedAt; yalnız daha geriye çekilir (silinmez)
function setIssuerInvalidatesFrom(bytes32 issuerId, uint64 invalidatesFrom) external;   // onlyOwnerState(_stateOf(issuerId))
function invalidatesFromOf(bytes32 issuerId) external view returns (uint64);             // 0 = yok
```

C1'e eklenen koşul: `invalidatesFrom == 0 || iat < invalidatesFrom` (liste: `invalidates_from ≤ iat` → NO). Göç kipi dışında
geçmiş tarih yazılabilen tek alandır; kurumun kendi geçerlilik aralığıyla sınırlıdır. Kök CA iptali bugün de bütün altını
düşürür (CA2), değişmedi.

## 16.3 Şema sürüm özetleri ([[ADR-0073]] K3, CE3)

```solidity
uint256 constant MAX_CONTENT_HASHES = 32;              // ilk özet hariç; saha verisiyle gözden geçirilir
event SchemaContentHashAdded(bytes32 indexed schemaId, bytes32 contentHash);
error ContentHashExists(bytes32 schemaId, bytes32 contentHash);
error TooManyContentHashes(bytes32 schemaId, uint256 max);
/// ulusal şema: onlyOwnerState(stateCode); ağ şeması: Governance (proposeNetworkSchemaContentHash, 2/3) ya da göç yürütücüsü
function addSchemaContentHash(bytes32 schemaId, bytes32 contentHash) external;
function contentHashesOf(bytes32 schemaId) external view returns (bytes32[] memory);   // [ilk özet, eklenenler…]
```

`matchesContentHash` (C3) ilk özetle ya da eklenen herhangi bir özetle eşleşir; `REVOKED` şemada hiçbiriyle. Boş ve yinelenen
özet (ilk özet dahil) reddedilir; `REVOKED` şemaya eklenmez, `DEPRECATED` şemaya eklenebilir. Liste biçimi SRI'dir
(`sha256-<base64>`); zincirde aynı SHA-256 baytları `bytes32` olarak yazılır. Yayınlanmış şema metadata'sı değişmez (D1).

## 16.4 Durum eşlemesi ([[ADR-0073]] K5)

Kontrat enum'larına değer eklenmedi; ayrım gereken yerde olay kullanılır.

| Liste durumu | Kök CA | Kurum | Şema | Doğrulayıcı | Ağ düzeyi kayıt (§16.5) |
|---|---|---|---|---|---|
| `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` |
| `ROLLING_OVER` | `ACTIVE` + `announceRootCARollover` | — | — | — | — |
| `SUSPENDED` | `SUSPENDED` | `SUSPENDED` | — | `SUSPENDED` | `SUSPENDED` |
| `RETIRED` | `RETIRED` | `retireIssuer` (yumuşak `REVOKED` + `IssuerRetired`) | — | `REVOKED` | `RETIRED` |
| `REVOKED` | `REVOKED` | `REVOKED` (+ `setIssuerInvalidatesFrom`) | `REVOKED` | `REVOKED` | `REVOKED` |
| `DEPRECATED` | — | — | `DEPRECATED` | — | `DEPRECATED` |
| `RESERVED`, `PROVISIONAL` | yazılmaz | yazılmaz | yazılmaz | yazılmaz | slot ve işletmeci kaydında yazılır |

"—": o kayıt türünde listede kullanılmayan değer; yeniden oynatma görürse durur.

## 16.5 Ağ düzeyi kayıt: `NetworkRegistry` ([[ADR-0074]] K3, PJ1–PJ3)

```solidity
enum RecordKind { NONE, WALLET_PROVIDER, WALLET_PROVIDER_KEY, ZK_CIRCUIT, EXTERNAL_LIST, EAA_CATEGORY,
                  LIST_SIGNER, LIST_OPERATOR, STATE_SLOT, ROLE_SLOT, CATALOGUE }          // yalnız sona eklenir
enum RecordStatus { NONE, ACTIVE, SUSPENDED, REVOKED, RETIRED, RESERVED, PROVISIONAL, DEPRECATED, DESIGNATED }
struct NetworkRecord {
    RecordKind kind; bytes32 recordId; bytes32 parentId; bytes2 region; uint8 subtype; RecordStatus status;
    uint64 validFrom; uint64 validUntil;   // yarı açık; validUntil = 0 açık uçlu
    bytes32 fingerprint; bytes32 detailsHash; uint256 flags; bytes32[] digests;   // en çok MAX_DIGESTS = 64
}
function stageRecord(NetworkRecord calldata rec) external returns (bytes32 stageId);
    // stageId = keccak256(abi.encode(rec, baseRevision)); baseRevision = kaydın o anki yazım sayacı
function commitStaged(bytes32 stageId) external;          // yalnız Governance; sayaç değiştiyse StaleStage
function writeRecord(NetworkRecord calldata rec, uint64 at) external;                // yalnız göç kipinde göç yürütücüsü
event RecordWritten(RecordKind indexed kind, bytes32 indexed recordId, bytes32 indexed stageId,
                    bytes32 contentHash, uint64 revision);                // HER yazımda; contentHash = keccak256(abi.encode(rec))
event RecordStatusChanged(RecordKind indexed kind, bytes32 indexed recordId, RecordStatus status, uint64 since);
// Governance: proposeNetworkRecord(address registry, bytes32 stageId) — 2/3, türü belli (GE3); cancelProposal(id) — öneren
// okuma: getRecord, recordIdsOf, recordStatusAt, recordStatusHistoryOf, isActiveRecord, isListedProviderKey,
//        revisionOf, stageIdOf (bugünkü sayaçla), stageIdFor(rec, baseRevision), stagedRevisionOf
```

**Öneri sırası (güvenlik turu 2026-11-04).** Sabitleme kaydın yazım sayacına bağlıdır; Governance önerisi yalnız oylandığı hâlin
üstüne yazar. Araya giren her yazım (öneri ya da göç yazımı) aynı kayda ait bekleyen bütün eski önerileri geçersiz kılar
(`StaleStage`): oylanmış öneriler istenen sırayla yürütülemez, yürütülmüş içerik yeniden sabitlenip eski öneriyle yazılamaz.
Yeni öneri eskisinin yerine geçer; öneren önerisini yürütülmeden geri çekebilir (`cancelProposal`, `ProposalCancelled`).
`REVOKED` ağ düzeyi kayıtta kesin değildir ([[ADR-0074]] bunu söylemez); yeniden etkinleştirme yalnız iptalden sonra sabitlenmiş
yeni bir öneriyle olur.

| LOTL alanı | `kind` | `recordId` / bağ | Notlar |
|---|---|---|---|
| `wallet_providers[]` | `WALLET_PROVIDER` | `keccak256(provider_id)` | ad → `detailsHash` |
| WUA imza anahtarları | `WALLET_PROVIDER_KEY` | parmak izi; `parentId` = sağlayıcı | `isListedProviderKey` |
| `zk_circuits[]` | `ZK_CIRCUIT` | `keccak256(circuit_id)` | `subtype` sistem, `flags` sürüm ve öznitelik sayısı, `fingerprint` dosya SHA-256; `note` yazılmaz |
| `external_lists[]` | `EXTERNAL_LIST` | `keccak256(list_id)` | `region` ülke ya da `EU`, `subtype` biçim, `digests` sabit imzacılar + tür özetleri, `flags` rol maskesi |
| `eaa_categories` | `EAA_CATEGORY` | `keccak256(kod)` | etiket → `detailsHash` |
| imza anahtarları (çapa, JSON, XML liste) | `LIST_SIGNER` | `keccak256("tamga:signer:" ‖ parentId ‖ ":" ‖ amaç ‖ ":" ‖ parmak izi)`; `parentId` = liste anahtarı | `subtype` amaç (1 çapa / LOTL, 2 JSON liste, 3 XML liste), `fingerprint` parmak izi; aynı anahtar birden çok listeyi imzalayabilir |
| `operator` | `LIST_OPERATOR` | liste anahtarı | `PROVISIONAL` / `DESIGNATED`; ad + `on_behalf_of` → `detailsHash` |
| `national_lists[]` slotları | `STATE_SLOT` / `ROLE_SLOT` | devlet: `keccak256("tamga:slot:" ‖ ülke)`; rol: `keccak256("tamga:slot:" ‖ ülke ‖ ":" ‖ rol)` (aynı rol her ülkede), `parentId` devlet slotu | `RESERVED`, `PROVISIONAL` burada yazılır; `subtype` üyelik (1 TDT_MEMBER, 2 TDT_OBSERVER) |
| `catalogue.url` | `CATALOGUE` | `keccak256("catalogue")` | adres → `detailsHash` |

Kayıt yazımı son hâl yazımıdır; durum geçmişi yalnız eklenir, kayıt silinmez (listeden kalkan kayıt `RETIRED` yazılır). Üst kayıt
bağı yazım anında denetlenir. Alan eşlemesinin tamamı (kapalı kümeler, `flags` bit alanları, `digests` sırası) yeniden oynatma
planındadır (`apps/chain-indexer/src/network-records.ts`); plan ve eşdeğerlik testi aynı eşlemeyi kullanır.

## 16.6 Ulusal listelerin kayıt verisi ve kapı grupları ([[ADR-0074]] K2)

```solidity
// IssuerRegistry — onlyOwnerState(_stateOf(issuerId))
enum IssuerClass { NONE, PUB, QUALIFIED, EAA }                    // issuers[].class — yalnız sona eklenir
struct IssuerProfile { IssuerClass issuerClass; bool publicSector; uint32 entitlements;
                       bytes32 registrationHash; bytes32 operationsHash; }
function setIssuerProfile(bytes32 issuerId, IssuerProfile calldata profile) external;
function issuerProfileOf(bytes32 issuerId) external view returns (IssuerProfile memory);

// RelyingPartyRegistry — onlyOwnerState(_stateOf(rpId))
enum AliasPolicy { UNSPECIFIED, SINGLE, MULTIPLE }                 // relying_parties[].pseudonyms
struct RelyingPartyProfile { bool publicSector; uint32 entitlements; AliasPolicy aliasPolicy; bytes32 registrationHash;
                             bytes32[] intermediaries; bytes32[] servedParties; }   // rpId dizileri, en çok MAX_LINKED = 32
struct TerminalGroup { bytes32 groupId; bytes32 institutionId; bytes32[] policyIds; bytes32[] certFingerprints;
                       bool offlineAllowed; uint64 validFrom; uint64 validUntil; bytes32 labelHash; }
function setRelyingPartyProfile(bytes32 rpId, RelyingPartyProfile calldata profile) external;
function setTerminalGroup(bytes32 rpId, TerminalGroup calldata group) external;      // en çok 32 grup; 16 politika; 32 sertifika
    // kurum bağı: rpId'nin kendisi ya da aynı devletin kayıtlı doğrulayıcısı / kurumu (UnknownInstitution; ADR-0054 NS2);
    // geri çekilmiş grup aynı kimlikle yeniden açılamaz (TerminalGroupNotOpen) — güvenlik turu 2026-11-04
function closeTerminalGroup(bytes32 rpId, bytes32 groupId, uint64 at) external;      // silinmez, aralığı kapanır
// RelyingPartyRegistry.initialize(sovereignty, governance, issuerRegistry) — kurum bağı denetimi için (2026-11-04)
function isActiveTerminalCertificate(bytes32 groupId, bytes32 certFingerprint) external view returns (bool);
```

| Liste alanı | Zincirde |
|---|---|
| `issuers[].class` | `issuerClass` |
| `issuers[]` kayıt verisi ([[ADR-0024]]) | `registrationHash`; `is_public_sector_body` → `publicSector`; `entitlements` → bit maskesi |
| `issuers[]` işletim adresleri, `assurance_basis`, `authentic_source`, `delegate_keys` | `operationsHash` (liste `delegate_keys` imza anahtarı parmak izidir; zincir delege adresleriyle karıştırılmaz) |
| `relying_parties[]` kayıt verisi | `registrationHash`, `publicSector`, `entitlements` |
| `uses_intermediaries`, `served_relying_parties` | `intermediaries`, `servedParties` (rpId dizileri) |
| `pseudonyms` | `aliasPolicy` |
| `terminal_groups[]` ([[ADR-0069]]) | `TerminalGroup`: `keccak256(group_id)` ağda tek (TG1: başka doğrulayıcı aynı grubu yazamaz), kurum bağı, en az bir politika özeti, kapı sertifikası parmak izleri, `offline_allowed`, aralık, `label` → özet |
| `legal_name` | mevcut `nameHash` (değişmedi) |

Ayrıntı özetleri RFC 8785 kanonik JSON + SHA-256'dır; alan bloklarının sınırını yeniden oynatma planı sabitler.

## 16.7 Okuma görünümleri (C33 (1)) ve güvenlik turu F-18 kalanı

- **Küme okumaları:** `Governance.memberList()` (üye kodları; durum `getMember`), `TrustListAnchorRegistry.anchorers()` (bugünkü
  yazıcılar; izin listesi üretimi, [[ADR-0052]] LP2), `IssuerRegistry.issuerDelegatesOf(issuerId)`. Devlet delege anahtarları
  `delegateKeysOf` ile okunur ve `DelegateKeysSet(stateCode, address[] keys)` olayı anahtarların kendisini taşır.
- **Sürüm adımı:** `StatusListRegistry.publishList` ve `TrustListAnchorRegistry.anchorList` sürümü bir adımda en çok
  `MAX_VERSION_STEP = 1_000_000` artırır (`VersionStepTooLarge`); `version = 2^64-1` ile listeyi kalıcı dondurmak mümkün değil.
- **Kullanılmayan öğeler kalktı:** `SchemaNotAuthorized`. (`ProposalStatus.CANCELLED` ve `ProposalCancelled` 2026-11-04
  güvenlik turunda öneri geri çekme yoluyla yeniden eklendi, §16.5.)
- **İnce olaylar:** `SchemaRegistrySet(registry)`; `proposeStateRemoval(bytes2 stateCode, bytes32 reasonHash)` gerekçeyi özet
  olarak alır (metin zincire yazılmaz, [[ADR-0074]] PJ2) ve `StateRemoved(stateCode, reasonHash)` bunu yayar.

## 16.8 Okuma ve aktarma: yeniden oynatma, indeksleyici, eşdeğerlik ([[ADR-0073]] K1/K6, [[ADR-0074]] K4/K5)

**Yeniden oynatma (`npm run trust:chain-replay`).** Liste yayıncısının arşivi (`archive/lotl.vNNNN.jws`, `tl-<cc>.vNNNN.jws`, çapa
günlüğü ve kontrol noktaları) doğrulanır (imza, sürüm zinciri, çapa zinciri, ortam); ilk arşivlenmiş sürümden başlayan
deterministik plan ve `replayPlanHash` (= SHA-256(kanonik JSON {biçim, ortam, plan anı, işlemler})) üretilir. Varsayılan ve
`--dry-run`: yalnız plan. Yazımda önce bütün göç kipli kayıtlarda pencerenin bu özetle açık olduğu denetlenir (CE1); işlemler zaman
sırasıyla, tarih taşıyanlar listedeki anla yazılır; zincirde olan işlem atlanır (kaldığı yerden devam: durum yazımları tarihle,
doğrulayıcı durumları geçmiş uzunluğuyla, son-hâl yazımları olay sayısı / kayıt sayacıyla tanınır). Kim yazar: ulusal kayıtlar
devletin delegesi; ağ şeması ve cüzdan sağlayıcı kayıtları tek göç yürütücüsü; ağ şemasının iptali ve doğrulayıcı devri / iptal
sonrası yeniden kaydı Governance oyu (oy yoksa komut durur ve öneriyi bildirir). Gerçek ağ yazımı `TAMGA_CONFIRM_PROD=<plan özeti>`
ister; sandbox seti yalnız yerel geliştirme zincirine (PJ4). Sonunda §11.2 indeksleyicisi ve eşdeğerlik testi çalışır.

| Liste | Yeniden oynatmada |
|---|---|
| kök CA `status_history` | `registerRootCA` (kayıt anı = ilk durum anı), `suspend/reinstate/retire/revokeRootCAAt`; `ROLLING_OVER` → `announceRootCARollover` |
| kurum `status_history`, `invalidates_from`, `successor_id` | `registerIssuer`, `suspend/reinstateIssuerAt`, `revokeIssuerAt`, `retireIssuer` (halef: aynı devletin iptal anında ACTIVE kurumu; değilse uyarıyla sıfır), `setIssuerInvalidatesFrom`; `valid_until` uzaması `renewIssuer` |
| `schema_authorizations[]` | pencere başına `setSchemaAuthorizationAt(true, valid_from)` ve `(false, valid_until)` |
| şemalar | `registerSchema` (ilk özet, `validFrom` = ilk durum anı), `addSchemaContentHash`, `deprecateSchemaAt`; ağ şeması iptali Governance |
| doğrulayıcılar | `registerRelyingParty` (`rpId = keccak256(dns_name)`), askı/dönüş/iptal listedeki anla (`*RelyingPartyAt`), `updateAccessCertificate`, `setRequestScope`, `setTerminalGroup`, `setRelyingPartyProfile`; başka ülke listesinde ilk görünüş = devir, iptalden sonra ACTIVE = yeniden kayıt (Governance, [[ADR-0075]]) |
| kurum kayıt verisi | `setIssuerProfile` (sınıf, kamu kurumu, yetki maskesi, kayıt ve işletim özetleri) |
| LOTL tanıma | `setRecognition` (FULL / NONE) |
| `wallet_providers[]` | `NetworkRegistry.writeRecord` (sağlayıcı ve WUA anahtarları; liste `valid_to` dahil → zincir yarı açık +1 sn) |
| LOTL ağ düzeyi içerik, ülke listesi `operator` | `NetworkRegistry.writeRecord` — ZK devreleri, dış listeler, belge kategorileri, liste imzacıları, işletmeciler, devlet ve rol slotları, katalog (§16.5); listeden kalkan → `RETIRED` |
| çapa `status_list` | kurum delegesi (devlet delegesi atanır) → `registerList` (bit sayısı ve boyut satırdan; eski satırda listenin adresindeki belirteçten) + her sürüm `publishList(…, published_at)` |

**İndeksleyici ve `ChainTrustSource`.** §11.2 uygulama notu. `relyingParty*` kaydında zincirde metin olmadığından ad alanları boştur;
`dns_name` yalnız çağıranın bildiği adla dolar; kapsamlar özet biçimindedir (`requestScopes`, `mayRequest`).

**Eşdeğerlik testi (CE6).** `contracts/test/chain-equivalence.test.ts` (Hardhat; CI'da): birkaç sürümlük fikstür arşivi
(askı, yumuşak ve sert iptal, kök emekliliği ve halef, şema sürümü, kullanımdan kalkan ve iptal edilen şema, yetki pencereleri,
tanımanın açılıp kapanması, cüzdan anahtarları, kapsam, kapı grubu, iptal sonrası yeniden kayıt, devir) yeniden oynatılır; her
kurum için kayıtlı her an ve sınır anları (t − 1, t, t + 1) üzerinden C1/C2/C3/D5 soruları liste kaynağına, `ChainTrustSource`'a ve
doğrudan kontrat okumasına sorulur. Ayrıca doğrulayıcının geçmiş bir andaki durumu (`isRelyingPartyAcceptableAt`), kurum halefi ve
`NetworkRegistry`'nin her kayıt türü sorulur. Sonuç (2026-11-05; Hardhat ve yerel Besu): 557 soru, fark 0, bilinen fark yok.

**Bilinen farklar ve sınırlar.**
- [[ADR-0075]] devri (2026-11-05 kapandı): yayıncının devir işlemi (`rp-status <dns_name> REVOKED --reassigned-to <CC> --approval
  <onay>`) eski ülke listesindeki kaydı `REVOKED` yapar, gerekçede devir kaydı; yükleyici aynı `dns_name`'in iptal edilmemiş tek
  kaydını alır (iptal edilmemiş kayıt birden çoksa ad yine belirsizdir, `null`). Zincirde tek kayıt vardır, yeni sahibinde.
- Dönem değişikliğinin (devir, iptal sonrası yeniden kayıt) zincir tarihi yürütme anıdır ([[ADR-0075]] açık soru 3): listedeki
  dönem başlangıcı ile yürütme anı arasındaki aralıkta `t` anı sorusu listeden farklı olabilir; eşdeğerlik testi bu aralığı sormaz.
  Doğrulayıcı askı, dönüş ve iptali ise listedeki anla yazılır (2026-11-05).
- İptal listesinin bit sayısı ve boyutu ne çapa satırında ne listenin adresindeki belirteçte bulunamazsa plan varsayılanı (2 bit,
  100000) yerel zincire yazar; gerçek ağ yazımı reddedilir.
- İleri tarihli bir yetki bitişi zincire yazılamaz (DateInFuture), uyarıyla atlanır. Kurum halefi yalnız aynı devletin iptal anında
  ACTIVE kurumuysa yazılır (kontrat kuralı); değilse uyarıyla sıfır.

**Çapa günlüğünün yeni satırları ([[ADR-0074]] K4).** `trust:chain-submit` görünüm (`tamga:trust-list-view:<ortam>:<dosya>`) ve
kayıt sertifikası durum listesi (`tamga:registration-status:<ortam>:<ad>`) için son satırı `anchorList` ile yazar; `trust:chain-check`
görünüm dosyasını da denetler. Satırlar yalnız zincir projeksiyonu açıkken yazılır ([[SPEC-TRUST-0001]] §5).

## 16.9 Yerel izinlendirme aracı ve işletim ([[ADR-0052]] K2/K3/K5; C33, C32 (7)) — uygulama notu (2026-11-05)

Kontrat değişmedi; araç §16.7 okuma görünümlerini kullanır.

**`trust:chain-permissions render`.** Tek bir sabitlenmiş blokta okur ve belirleyici `permissions_config.toml` yazar:

| Liste | Kaynak (o bloktaki durum) |
|---|---|
| hesap | `Governance.memberList()` → `getMember`: `ACTIVE` üyenin `validatorAddress`'i ve `delegateKeysOf` (askıdaki devletin delegesi yazamaz, `isDelegateOf`) |
| hesap | her üye devletin `IssuerRegistry.getIssuersByState` → `isOperational` olan kurumun `issuerDelegatesOf` (§7: `StatusListRegistry` yalnız kurum durumuna bakar, devletin üyelik durumuna değil) |
| hesap | `TrustListAnchorRegistry.anchorers()` |
| hesap | göç penceresi açık (`isMigrationOpen`) kayıtların `migrationState().executor`'ı ([[ADR-0073]] K1; pencere kapanınca listeden çıkar) |
| düğüm | işletmeci bildirimi (`network/permissions/nodes/*.json`, `tamga-node-declaration/1`): `role: validator` ve açık anahtardan türeyen adres o devletin AKTİF `validatorAddress`'i; `--operator <CC>` ile o devletin `rpc` düğümleri |

Biçim: sıralı, tekrarsız, küçük harf, LF; dosyada blok numarası ve zaman yok (aynı durum → aynı bayt). `shared_sha256`
işletmecinin kendi RPC düğümleri hariç özettir ve bütün validator'larda aynı olmalıdır (LP3). Eşleşmeyen, çift anahtarlı ya da
şemaya uymayan bildirim reddedilir (yetki vermez; çıkış 3). Elle hesap ekleme seçeneği yoktur (LP2).

**`check`.** Düğümün `perm_getAccountsAllowlist` / `perm_getNodesAllowlist` cevabını beklenen listeyle (dosya ya da zincirden
çizim) anlamsal karşılaştırır; yalnız loopback yönetim ucu (LP5). Besu `perm_reloadPermissionsFromFile`'da dosyayı kendi biçimiyle
yeniden yazar; bu yüzden disk dosyasının özeti değil `check` ve çizimin özeti karşılaştırılır.

**Yerel deneme (C33 (4)).** [[ARCH-0002]] "Yerel izinli ağ": iki düğüm, iki izin bayrağı açık; izinsiz hesap reddedildi, delege
yazdı, iki düğümün paylaşılan özeti aynı çıktı, listeden çıkan düğümün bağlantısı koptu, ikinci düğüm `qbft_proposeValidatorVote`
ile doğrulayıcı kümesine eklenip çıkarıldı.

**RPC koruması (C33 (5)).** `network/rpc-proxy/`: nginx TLS 1.3 + zorunlu istemci sertifikası, arkasında JSON-RPC yöntem süzgeci
(yalnız `eth_*`/`net_*`/`web3_*`; imzalayan, kazan ve abonelik yöntemleri hariç; toplu istekte tek ret bütününü reddeder).

**Sağlık sayfası (C32 (7)).** Referans doğrulayıcının `/healthz` cevabında `chain`: yüklü `lotl` / `tl-<cc>` listeleri zincirde
onaylı çapalı mı (`YES` / `NO` / `UNKNOWN`). Bayrak kapalıyken ve sandbox'ta `UNKNOWN` (bağlanılmaz); `ok` ve doğrulama sonucu
değişmez ([[ADR-0051]] CH1).

---

# İlgili Dokümanlar

[[ADR-0001]] · [[ADR-0002]] · [[ADR-0003]] · [[ADR-0007]] · [[ADR-0008]] ·
[[ARCH-0001]] · [[ARCH-0002]] · [[ARCH-0003]] · [[PM-TRUST-0001]] ·
[[PM-SCHEMA-0001]] · [[PM-ASSUR-0001]] · [[SPEC-ID-0002]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0003]] · [[SPEC-BC-0002]] ·
[[ADR-0009]] · [[ADR-0051]] · [[ADR-0052]] · [[ADR-0053]] · [[ADR-0054]] · [[ADR-0055]] · [[ADR-0063]] · [[SPEC-TRUST-0001]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02; §15 2026-10-19, [[ADR-0051]]: kontratlar derleniyor ve test ediliyor, üretimde kapalı;
§12.1 hesap izni 2026-10-19, [[ADR-0052]]: zincir üstü izin kontratı yerine Besu yerel izinlendirme; 2026-10-19 [[ADR-0053]],
[[ADR-0054]], [[ADR-0055]]: rakip çapa adayları, şema ad alanları ve kota kapsamı, yükseltme kuyruğu ve kayıt yönetimi önerileri;
2026-10-23 [[ADR-0063]]: iptal listesi kaydı listenin kendi bit sayısıyla; §16.9 2026-11-05: yerel izinlendirme aracı ve işletim).

