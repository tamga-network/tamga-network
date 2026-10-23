---
document_id: ADR-0062
title: "ZK kopyası yenileme belirteci yalnız ZK kopyası kapsamı istendiğinde"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  Kimlik servisi ZK kopyası yenileme belirtecini (ADR-0044 K3) artık her kimlik belgesi yetkisinde değil, yalnız cüzdan yetki
  isteğinde kimlik belgesinin kapsamının yanında ZK kopyası kapsamını (`urn:tamga:id:ShortLivedIdentityAttestation:1`) da
  istediğinde verir. Böylece yenileme belirteci verildiği kapsam içindir (RFC 6749 §6): kimlik belgesi kapsamıyla alınan
  belirteç kimlik belgesini yeniden almaya yaramayacağı için verilmez. Kapsam yalnız kimlik belgesiyle birlikte istenebilir.
  Tamga cüzdanı servis ZK kopyası ilan ediyorsa kapsamı kendiliğinden ister; davranışı değişmez. ADR-0044 K3'ü daraltır.
  Kabul: 2026-10-23.
domain: Protocol
related: ["[[ADR-0044]]", "[[ADR-0060]]", "[[SPEC-PROTO-0001]]"]
---

# Bağlam

- **ADR-0044 K3.** Kimlik belgesi verilirken token yanıtı bir `refresh_token` taşır; bu belirteç kimlik belgesini yenilemez,
  yalnız kısa ömürlü ZK kopyası alır (kimlik servisi kişi alanlarını saklamaz — ADR-0011 K4).
- **Standart.** RFC 6749 §6: yenileme isteği kapsam vermezse yeni erişim belirteci ilk verilen kapsamla eşit sayılır. Kimlik belgesi
  kapsamıyla alınmış bir yenileme belirtecinden kimlik belgesi beklenir; bizimki yalnız ZK kopyası verebildiği için bu beklentiyi
  karşılayamaz.
- **OpenID uyum öz-testi (3. tur, bulgu G20).** FAPI 2.0 `refresh-token` modülü yenilenen erişim belirteciyle kimlik belgesi ister;
  `this access token is only for ZK copies` ile reddediliyordu.

# Karar

## K1 — Kapsam istenince
Kimlik servisi ZK kopyası yenileme belirtecini yalnız yetki (PAR `scope`) kimlik belgesi kapsamının yanında ZK kopyası kapsamını da
içeriyorsa verir. Kapsam başka bir türle ya da tek başına istenemez (`invalid_scope` / `invalid_request`). Yenileme belirteciyle
alınan erişim belirtecinin kapsamı ZK kopyasıdır (yanıtta `scope`).

## K2 — Cüzdan
Cüzdan, servis metadata'sında ZK kopyası yapılandırması (`mso_mdoc`, `doctype` = ZK kopyası) ilan ediliyorsa kimlik belgesi
isteğinde onun `scope`'unu da ister. Tamga cüzdanının davranışı (kimlik belgesi + ZK kopyası bağı) değişmez.

## K3 — Değişmeyenler
ADR-0044'ün geri kalanı (ZC1–ZC3, kuşak sayacı, iki aşamalı döndürme), ADR-0060 (istemci örneği anahtarı bağı) aynen.

# Değerlendirilen seçenekler

- **Belirteci her zaman ver, yanıtta `scope` = ZK kopyası.** RFC 6749 §5.1'e uygun ama yenileme belirteci istenmemiş bir kapsam
  içindir; istemci kimlik belgesi kapsamını yenileyebileceğini varsayar.
- **Yenilemede kimlik belgesini yeniden ver.** Kişi alanları saklanmaz (ADR-0011 K4); olanaksız ve istenmez.
- **Seçilen:** belirteç yalnız ZK kopyası kapsamı açıkça istendiğinde — yenileme belirteci verildiği kapsam içindir.

# Değişmezler

| Kod | Kural |
|---|---|
| ZS1 | Kimlik servisi ZK kopyası yenileme belirtecini yalnız yetki ZK kopyası kapsamını kimlik belgesi kapsamıyla birlikte içerdiğinde verir. |

# Uygulama

- `@tamga-network/issuer` 0.7.2: `createPar({ allowedCompanionScopes })` → `ParRequest.companionScopes`. wallet-core 0.7.2:
  `companionScopes`, `startAuthorized` kimlik belgesinde ZK kopyası kapsamını ekler.
- Kimlik servisi: PAR eşlik kapsamı (yalnız ZK kopyası, yalnız kimlik belgesiyle), token ucunda belirteç yalnız kapsam varsa; AS
  `scopes_supported` ZK kopyası kapsamını içerir.
- Şartname: [[SPEC-PROTO-0001]] §4.2.

# Durum

**Accepted — 2026-10-23.** Proje yönetiminin genel uyum onayı kapsamında ("AB standartlarına uyumlu olalım, eksiklerimizi
giderelim, olması gerektiği gibi yapalım"): ADR-0044 K3'ü standarda göre daraltan düzeltme; Tamga cüzdanının davranışı değişmedi.
DECISIONS: D-ZK-3.
