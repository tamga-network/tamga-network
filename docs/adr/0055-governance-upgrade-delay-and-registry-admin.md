---
document_id: ADR-0055
title: "Yönetişim: yükseltme bekleme süresi ve kayıt yönetimi önerileri"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Governance kontratında iki boşluk kapanır. (1) Protokol yükseltmesi 2/3 oyla kabul edilince hemen uygulanmaz: önce kuyruğa
  alınır, 7 gün bekler, sonra eşik yeniden sayılarak uygulanır. Katılmayan bir devlet bu sürede tek taraflı çekilebilir. Yükseltme
  isteğe bağlı olarak yeni sürümün parametresiz başlangıç fonksiyonunu aynı işlemde çağırır (yalnız 4 baytlık fonksiyon seçicisi;
  serbest veri yok). (2) Governance'ın yönettiği ama bugüne kadar çağıramadığı kayıt yönetimi işlemleri (liste çapası yazıcısı ve
  eşiği, kurucular arası tanıma, ağ şemasının kullanımdan kaldırılması ve iptali) türü belli önerilerle 2/3 oyla yapılabilir.
  Genel "her çağrıyı yürüt" önerisi kurulmaz. ADR-0051 açık konu 3 kapanır. Kabul: 2026-10-19.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[SPEC-BC-0001]]"]
---

# Kısaca

Ağın kurallarını değiştiren en güçlü işlem kontrat yükseltmesidir. Bu karar yükseltmeye bir hafta bekleme koyar: oy geçer, kuyruğa
girer, herkes ne olacağını görür; katılmayan devlet isterse o sürede ağdan çekilir. Ayrıca Governance'ın elinde olması gereken ama
çağıramadığı birkaç yönetim işlemi oylanabilir hâle gelir.

# Bağlam

- [[SPEC-BC-0001]] §1 ve §9: protokol yükseltmesi 2/3 oyla yapılır; yetki Governance'tadır (UUPS). 2026-10-19 güvenlik turu (F-14)
  iki eksik gösterdi: eşik dolar dolmaz yükseltme aynı işlemde uygulanabilir (bekleme süresi yok), ve yükseltme boş başlangıç
  verisiyle çağrıldığı için başlangıç fonksiyonu (`reinitializer`) olan yeni bir sürüm aynı işlemde etkinleştirilemez; ayrı bir
  çağrı gerekir ve o çağrıyı önce başkası yapabilir.
- [[ADR-0002]] #5: her devlet oy gerekmeden tek taraflı çekilebilir. Bekleme süresi yoksa bu hak bir yükseltme karşısında pratikte
  işlemez: değişiklik oy geçtiği anda yürürlüğe girer.
- [[ADR-0051]] açık konu 3 ve güvenlik turu F-15: liste çapası yazıcılarının ve eşiğin yönetimi (`setAnchorer`,
  `setRequiredConfirmations`), kurucular arası tanıma (`CrossRecognition.bootstrapFounders`) ve ağ şemasının kullanımdan kaldırılması
  ya da iptali (`SchemaRegistry.deprecateSchema` / `revokeSchema`, NETWORK katmanı) yalnız `governance` adresinden çağrılabilir. Bu
  adres Governance proxy'si olduğunda Governance'ın bunları çağıracak bir yolu yoktur.
- Zincirde serbest `bytes` alanı yoktur ([[SPEC-BC-0001]]/DP1; ABI testi): genel bir "çağrı verisi" önerisi bu kuralı deler.
- Proje yönetimi 2026-10-19'da güvenlik turunun önerilerini onayladı; yükseltme için alışılmış güvenli seçim (öneri bekleme süresi)
  istendi.

# Karar

## K1 — Yükseltme kuyruğu ve bekleme süresi

- `PROTOCOL_UPGRADE` önerisinin eşiği dolunca ilk `execute` çağrısı öneriyi **kuyruğa alır** (`ProposalQueued(id, eta)`), uygulamaz.
- Uygulama en erken `eta = kuyruk anı + 7 gün` (`UPGRADE_DELAY`) olur ve en geç `eta + 30 gün`dür; sonrasında öneri süresi dolmuş
  sayılır. Uygulama anında eşik bugünkü ACTIVE üyelerden **yeniden** sayılır ([[SPEC-BC-0001]] GV3); bekleme sırasında çekilen
  üyelerin oyu sayılmaz.
- Kuyruktaki öneri, oylama süresi (`PROPOSAL_TTL`) dolsa da beklemeyi tamamlayıp uygulanabilir.
- Üyelik (kabul, çıkarma), ağ şeması kaydı ve K3'teki yönetim önerileri bekleme süresi almaz (bugünkü davranış).

## K2 — Yükseltmeyle başlangıç çağrısı

`proposeProtocolUpgradeAndInit(target, newImplementation, initSelector)`: yükseltme `upgradeToAndCall` ile yeni sürümün
**parametresiz** başlangıç fonksiyonunu aynı işlemde çağırır. Öneri yalnız 4 baytlık fonksiyon seçicisini taşır; başlangıç
değerleri yeni sürümün kodundadır ve oylanan şey o koddur. Serbest veri alanı yoktur (DP1). `proposeProtocolUpgrade` başlangıç
çağrısız yükseltme olarak kalır.

## K3 — Türü belli kayıt yönetimi önerileri

Yeni öneri türü `REGISTRY_ADMIN`; her işlem için ayrı, türü belli bir öneri fonksiyonu vardır. Hepsi 2/3 oyla yürütülür:

| Öneri | Yürütmede çağrılan |
|---|---|
| `proposeAnchorerChange(registry, anchorer, allowed)` | `TrustListAnchorRegistry.setAnchorer` |
| `proposeAnchorThreshold(registry, required)` | `TrustListAnchorRegistry.setRequiredConfirmations` |
| `proposeFounderRecognition(registry, founders)` | `CrossRecognition.bootstrapFounders` |
| `proposeNetworkSchemaDeprecation(schemaId, supersededBy)` | `SchemaRegistry.deprecateSchema` (bağlı şema kaydı) |
| `proposeNetworkSchemaRevocation(schemaId, reason)` | `SchemaRegistry.revokeSchema` (bağlı şema kaydı) |

Hedef adres sıfır, Governance'ın kendisi ya da kodsuz bir adres olamaz. Genel "çağrı yürüt" önerisi kurulmaz.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Bekleme süresi yok (bugünkü durum) | ret | Çekilme hakkı yükseltme karşısında işlemez; hatalı yükseltmeyi fark edecek zaman yok |
| Ayrı bir timelock kontratı (OpenZeppelin TimelockController) | ret | Yeni yetki sahibi ve yeni kontrat; aynı sonucu Governance içinde bir kuyruk verir |
| Bekleme süresini bütün önerilere uygulamak | ret | Üyelik ve ağ şeması kararları ADR-0002'de beklemesizdir; değiştirmek ayrı karar |
| 2 gün / 14 gün bekleme | ret | 2 gün devlet kurumları için tepki süresi değil; 14 gün acil düzeltmeyi gereksiz uzatır. 7 gün yaygın uygulamadır |
| Yükseltmede serbest başlangıç verisi (`bytes`) | ret | Zincirde serbest veri alanı açar (DP1); parametresiz başlangıç fonksiyonu aynı işi görür |
| Genel "çağrı yürüt" önerisi (hedef + `bytes`) | ret | DP1'i deler ve oylananın ne olduğunu okumayı zorlaştırır; gereken işlemler sınırlı ve bellidir |

# Değişmezler

| Kod | Kural |
|---|---|
| GE1 | Protokol yükseltmesi eşik dolunca kuyruğa alınır ve en erken 7 gün sonra, eşik o anki ACTIVE üyelerden yeniden sayılarak uygulanır. |
| GE2 | Yükseltmeyle yapılan başlangıç çağrısı yalnız parametresiz bir fonksiyon seçicisidir; Governance önerileri serbest veri (`bytes`) taşımaz. |
| GE3 | Governance'ın kayıt yönetimi işlemleri yalnız türü belli önerilerle ve 2/3 oyla yapılır; genel çağrı önerisi yoktur. |

# Sonuçlar

- `contracts/src/governance/Governance.sol` ve `IGovernance.sol`: kuyruk, `UPGRADE_DELAY`, `proposeProtocolUpgradeAndInit`,
  `REGISTRY_ADMIN` önerileri, `ProposalQueued` olayı; depolama düzeni yalnız sona ekleme. `ProposalKind`'a değer yalnız sona eklenir.
- [[SPEC-BC-0001]] §1 ve §9 sürüm notu; [[ADR-0051]] açık konu 3 kapandı.
- DECISIONS: **D-BC-10**.

# Durum

**Accepted — 2026-10-19.** Proje yönetimi onayıyla. DECISIONS: D-BC-10. GE1–GE3 bağlayıcıdır; [[ADR-0002]]'nin oy eşikleri
değişmez.
