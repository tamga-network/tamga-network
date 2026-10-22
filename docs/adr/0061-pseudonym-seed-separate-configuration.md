---
document_id: ADR-0061
title: "Takma ad tohumu ayrı belge yapılandırması olarak, standart belge isteğiyle"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-22
last_updated: 2026-10-22
summary: >
  Takma ad tohumu belgesi (`urn:tamga:id:PseudonymSeed:1`, ADR-0031 K1) kimlik belgesinin yanıtına eklenen standart dışı
  `pseudonym_seed` alanıyla değil, kimlik servisinin metadata'sında ilan edilen ayrı bir belge yapılandırması olarak verilir:
  cüzdan kimlik belgesini aldıktan sonra aynı erişim belirteciyle ikinci, standart bir belge isteği yapar (OpenID4VCI 1.0 §8;
  ADR-0059). Tohumun gizlilik özellikleri değişmez (PS1–PS6): ayrı ve sunulamayan tür, kimlik belgesinin ilk kopyasının anahtarına
  bağlı, iptal listesi yok, sunucuda saklanmaz. Yalnız teslim biçimini değiştiren bir standart uyumu düzeltmesidir; proje
  yönetiminin genel onayı kapsamında kabul edildi. Kabul: 2026-10-22.
domain: Privacy
related: ["[[ADR-0031]]", "[[ADR-0059]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
---

# Bağlam

- **ADR-0031 K1.** Kimlik servisi kişiye özel takma ad tohumunu ayrı, sunulamayan bir belge türüyle (`urn:tamga:id:PseudonymSeed:1`)
  verir. Bugüne dek bu belge kimlik belgesinin belge yanıtına `pseudonym_seed` adlı ek alanla konuyordu.
- **Standart.** OpenID4VCI 1.0 §8.3 belge yanıtının alanlarını tanımlar (`credentials`, `transaction_id`, `notification_id`,
  `interval`); ek alan standart dışıdır. Birden çok belge türü aynı yetkiyle alınacaksa her biri metadata'da ayrı bir yapılandırma
  olarak ilan edilir ve ayrı belge isteğiyle istenir.
- **OpenID uyum öz-testi (bulgu G3).** Kimlik servisinin her belge yanıtında "bilinmeyen alan" uyarısı (22 test); aracın bu
  kontrolü ayarla kapatılamaz.

# Karar

## K1 — Ayrı yapılandırma
Kimlik servisinin metadata'sı tohum türünü `credential_configurations_supported` içinde ayrı bir `dc+sd-jwt` yapılandırması
olarak ilan eder (tür katalogda ve kimlik servisi güven listesinde bu türe yetkiliyse). Tür PAR ile tek başına istenemez.

## K2 — Aynı belirteçle ikinci istek
Cüzdan kimlik belgesini aldıktan sonra **aynı erişim belirteciyle** (ADR-0059) `credential_configuration_id =
urn:tamga:id:PseudonymSeed:1` ve tek anahtar kanıtıyla — kimlik belgesinin ilk kopyasının anahtarıyla — standart belge isteği
yapar. Kimlik servisi tohumu yalnız o belirteçle kimlik belgesi verilmişse ve bir kez verir; tohum belgeye bağlanır. Belge
yanıtında standart dışı alan kalmaz.

## K3 — Değişmeyenler
ADR-0031 PS1–PS6 aynen: tohum sunulamayan türdedir (PS3), sunucuda saklanmaz — akış boyunca yalnız bellekte durur ve verilince ya
da belirteç bitince silinir (PS2); türetme ve sunum kuralları değişmez.

# Değerlendirilen seçenekler

- **Ek alan kalsın.** Standart dışı; uyarı her testte sürer.
- **Tohum kimlik belgesinin içinde bir alan.** Sunulan belgeye girer — PS3'e aykırı.
- **Cüzdanda türetme.** Aynı kişi her cihazda aynı tohumu almalı (ADR-0031); kişinin kimliğinden sunucu sırrıyla türetilir,
  cüzdan tek başına türetemez.
- **Seçilen:** ayrı yapılandırma + aynı belirteçle ikinci istek — OpenID4VCI'nin birden çok tür için öngördüğü yol.

# Değişmezler

| Kod | Kural |
|---|---|
| SD1 | Takma ad tohumu belgesi yalnız kimlik belgesini veren erişim belirteciyle, kimlik belgesinden sonra ve bir kez verilir. |
| SD2 | Belge yanıtı OpenID4VCI 1.0 §8.3'te tanımlı olmayan üst düzey alan taşımaz. |

# Uygulama

- Kimlik servisi: metadata'da tohum yapılandırması (`seedType`), credential ucunda ayrı istek (`seedRequest`); kimlik belgesinin
  yanıtında `pseudonym_seed` yok. Kopya hakkı dolduğunda belirteç, tohum isteği için ömrü bitene kadar kalır.
- wallet-core 0.7.2: `obtainCredential` kimlik belgesinden sonra tohum yapılandırması ilanlıysa ikinci isteği yapar
  (`RedeemOutput.pseudonymSeed`); `readPseudonymSeed` aynı.
- Şartname: [[SPEC-PROTO-0001]] §7.5, [[SPEC-WALLET-0001]] §5.4.

# Durum

**Accepted — 2026-10-22.** Proje yönetiminin genel onayı kapsamında ("AB standartlarına uyumlu olalım, eksiklerimizi giderelim,
olması gerektiği gibi yapalım"): kapatılmış karar ADR-0031'in yalnız teslim biçimini standarda uyduran düzeltme; gizlilik kuralları
değişmedi. DECISIONS: D-PRIV-2.
