---
document_id: ADR-0010
title: Credential Tip Kimliği = URN (urn:tamga) ve Tamga EAA Kategori Sinyali
category: ADR
domain: Schema
status: Active
review_status: Completed
version: 1.0.0
created: 2026-09-24
last_updated: 2026-09-24
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - adr
  - schema
  - vct
  - urn
  - type-metadata
  - eaa-category
  - eidas
keywords:
  - SD-JWT VC vct URN
  - type metadata registry retrieval
  - vct#integrity mandatory
  - domain-independent type identity
  - ETSI TS 119 472-1 EAA category
  - urn:tamga namespace
  - supersedes D-SCHEMA-1
summary: >
  D-SCHEMA-1 ("vct kararlı HTTPS URL") süpersede edilir: credential tipinin
  kimliği urn:tamga:<domain>:<Type>:<major> biçiminde bir URN olur; Type
  Metadata, IETF SD-JWT VC §5.3.2 "registry" yoluyla Tamga kataloğundan
  (metadata_url + content_hash) çözülür; vct#integrity zorunlu kalır (ETSI TS
  119 472-1 EAA-5.2.1.2-03); schemaId = keccak256(vct) değişmez. Gerekçe:
  çok-devletli (TDT-first) bir ekosistemde tip kimliği bir vakfın alan adına
  bağlı olamaz; EUDI'nin PID sözleşmesi (urn:eudi:pid:1 + katalog) aynı
  desendir. Ayrıca ETSI 119 472-1'in bağlam-özel EAA kategori sinyaline izin
  vermesine dayanarak Tamga kendi kategori URN'lerini tanımlar
  (urn:tamga:eaa:pub, urn:tamga:eaa:qualified); I1–I2 issuer'lar kategori
  taşımaz; holder LoA credential'a hiçbir zaman girmez (PR7 korunur).
priority: High
related:
  - ADR-0007
  - ADR-0009
  - SPEC-SCHEMA-0001
  - SPEC-SCHEMA-0002
  - SPEC-SCHEMA-0003
  - SPEC-CRED-0002
  - SPEC-PROTO-0001
  - PM-ASSUR-0001
  - PM-SCHEMA-0001
  - RS-EIDAS-0001
depends_on:
  - ADR-0007
supersedes:
  - ADR-0007 Karar 1 (vct HTTPS URL) — kısmi
---

# ADR-0010 — Tip Kimliği URN ve EAA Kategori Sinyali

**Durum: Accepted ✅** (2026-09-24).
Kabul edildiğinde [[DECISIONS]] D-SCHEMA-1 → **D-SCHEMA-4** (süpersede), yeni **D-CRED-4**
(kategori sinyali).

---

# Bağlam

## Mevcut karar ve neden yeniden açıldı

[[ADR-0007]] Karar 1 / [[DECISIONS]] D-SCHEMA-1: `vct` kararlı bir HTTPS URL'dir
(`https://schema.tamga.network/v1/edu/DiplomaCredential/1.0.0`), Type Metadata doğrudan bu
URL'den alınır, `vct#integrity` zorunludur ve zincirdeki `contentHash`'e eşittir.

2026-09-23/24 doğrulaması (birincil metinler) şunu gösterdi:

| Kaynak | Ne diyor |
|---|---|
| IETF draft-ietf-oauth-sd-jwt-vc-**19** §2.2.2.1 | `vct` **collision-resistant name**: HTTPS URL **veya** URN (örnek `urn:example:eudi:pid:…`) |
| aynı, §5.3 | Type Metadata: (1) URL'den, (2) **güvenilir registry'den**, (3) ekosistem-tanımlı yöntemle, (4) önbellekten alınabilir |
| ETSI TS 119 472-1 V1.2.1 EAA-5.2.1.2-02/03 | `vct` Type Metadata'ya **işaret etmeli**; `vct#integrity` **zorunlu** |
| ARF PID Rulebook v2.4.0 | PID tipi `urn:eudi:pid:1`; domestic `urn:eudi:pid:<cc>:1`; metadata **katalogda** (PID_15) |
| ARF Attestation Rulebook şablonu | `vct` ekosistemde benzersiz olmalı; biçim dayatılmaz |
| ETSI TS 119 472-1 §4.2.2 | EAA kategorisi "ihraç **bağlamında**" sınıf sinyalidir; AB URN'leri (`urn:etsi:esi:eaa:eu:qualified` / `…:pub`) AB içindir; "bir EAA kategori **içerebilir**" |

Yani mevcut HTTPS kararı standarda **uygundur**; URN de uygundur. Seçim teknik değil,
**yönetişimseldir**. Proje yönetiminin yönü (2026-09-24): beta da TDT ile
çalışıyormuş gibi kurgulanır. Bu, açık soruyu kapatır: çok-devletli bir konsorsiyumun belge tipi kimliği bir
vakfın alan adına (`tamga.network`) bağlı olamaz. [[SPEC-SCHEMA-0001]] §10.3 "alan adı riski"
bölümü bu bağımlılığı zaten "ekosistemik olay" olarak kaydetmişti.

## İkinci konu: issuer sınıfı credential'da nasıl görünür?

eIDAS'ta QEAA ve PuB-EAA, credential **içinde** kategori sinyali taşır (Annex V/VII "otomatik
işlemeye uygun gösterge"); nitelikli olmayan EU EAA'lar taşımaz. Tamga'nın kanonik modelinde
issuer derecesi (I1–I3) yalnızca kayıtta tutulur; credential'da sınıf sinyali yoktur. TDT-first
kurguda Tamga ekosistemi eIDAS yapısını **aynalamalı**: devlet kurumu/authentic source adına
verilen belge ile Trust Framework'te akredite kurumun belgesi, verifier'a credential içinden
ayırt edilebilir olmalı. Holder LoA ise (PR7) credential'a **girmez** — eIDAS'ta da girmez.

---

# Karar

## Karar 1 — `vct` bir URN'dir

```
urn:tamga:<domain>:<Type>:<major>
  domain ∈ {core, edu, org, health, mobility, travel, trade, …}   (SPEC-SCHEMA-0001 §1.2 domain listesi)
  Type   = PascalCase tip adı (DiplomaCredential, StudentCredential, TamgaBaseCredential)
  major  = tam sayı; kırıcı değişiklikte artar

Örnekler:
  urn:tamga:core:TamgaBaseCredential:1
  urn:tamga:edu:StudentCredential:1
  urn:tamga:edu:DiplomaCredential:1
Faz 1, devlet-özel (domestic) tipler:
  urn:tamga:<cc>:<domain>:<Type>:<major>        ör. urn:tamga:tr:edu:TranscriptCredential:1
Kategori sinyalleri (Karar 5):
  urn:tamga:eaa:pub · urn:tamga:eaa:qualified
```

`schemaId = keccak256(bytes(vct))` **değişmez** ([[SPEC-SCHEMA-0001]] §5.1).

## Karar 2 — Type Metadata çözümleme yolu = katalog (registry)

IETF §5.3.2 "trusted registry" yolu birincildir. Kayıt (zincir `SchemaRegistry` / Faz B
`lotl › schemas[]`) her tip için şunu tutar: `vct`, `metadata_url`, `content_hash`, `status`,
`status_history`. Verifier/cüzdan:

```
Ş1. vct + vct#integrity oku (yoksa RED)
Ş2. schemaId = keccak256(vct); kayıt var mı, statüsü (ACTIVE/DEPRECATED iat'a göre)
Ş3. Type Metadata: önbellek(vct#integrity) → GET kayıt.metadata_url → (yedek) katalog toplu paketi
Ş4. SHA-256(baytlar) == vct#integrity == kayıt.content_hash; doküman.vct == credential.vct
Ş5–Ş7 değişmez (extends, JSON Schema, yetki)
```

`schema.tamga.network` artık tip **kimliği** değil, **katalog ve barındırma** adresidir; alan adı
değişirse yalnızca `metadata_url`'ler değişir, `vct`'ler ve verilmiş belgeler etkilenmez.
Katalog aynı zamanda ARF "Catalogue of attestation schemes" muadilidir; toplu paket
(`catalogue.jws`) cüzdanın CMP8/WL9 toplu çekimini karşılar.

## Karar 3 — `vct#integrity` zorunlu kalır; D1/D2 yeniden ifade edilir

[[SPEC-SCHEMA-0001]]/D1 "yayınlanmış bir `vct` URL'inin içeriği asla değişmez" →
"yayınlanmış bir `metadata_url`'in içeriği asla değişmez"; D2 "`contentHash` = `vct#integrity` =
SHA-256(yayınlanan baytlar)" aynen; D3 aynen. `vct#integrity` credential'da **zorunlu**
(ETSI 472-1 EAA-5.2.1.2-03; IETF'te opsiyonel — biz sıkı kalırız).

## Karar 4 — Sürümleme

- **major** URN'dedir; kırıcı değişiklik = yeni URN = yeni `schemaId`; eski belgeler eski
  URN ile doğrulanmaya devam eder (SC3 DEPRECATED penceresi).
- **minor/patch** Type Metadata `version` alanında; her yayın **yeni** `metadata_url` +
  `content_hash` (D1 gereği eski URL değişmez); kayıt "güncel" işaretler; aynı URN altında
  birden çok metadata sürümü olabilir ve credential'daki `vct#integrity` hangisini kastettiğini
  kesinleştirir. [[SPEC-SCHEMA-0001]] §9 semver kuralları buna göre yeniden yazılır.

## Karar 5 — Tamga EAA kategori sinyali

Credential'da (SD-JWT VC claim, `sd: never`, seçici açıklamaya tabi değil):

| Issuer kaydı `class` | `category` claim'i | AB muadili | Kim |
|---|---|---|---|
| `PUB` | `urn:tamga:eaa:pub` | PuB-EAA | Üye devlet kurumu veya authentic source adına (NVİ, YÖK, MERSİS…) — kayıt devletçe (`onlyOwnerState`) |
| `QUALIFIED` | `urn:tamga:eaa:qualified` | QEAA | Trust Framework'te akredite **I3** issuer (ESHS e-Mühür/HSM/denetim/sigorta) |
| `EAA` | **yok** | EAA (nitelikli olmayan) | I1–I2 issuer'lar |

Kurallar: (a) issuer yalnızca kayıttaki `class`'ının sinyalini koyabilir; verifier C-katmanında
kayıtla karşılaştırır, uyuşmazlık → REJECTED (yeni adım kodu **C4**, [[SPEC-API-0001]] AP1
uyarınca yeni kod); (b) holder assurance (T0–T3) **hiçbir zaman** credential'a yazılmaz — PR7
korunur, seviye tipin ön koşuludur (DB-6); (c) AB URN'leri (`urn:etsi:esi:eaa:eu:*`) Tamga
issuer'ları tarafından **kullanılamaz** (AB bağlamı dışıyız); (d) Faz 1'de bir devlet kendi
nitelikli sınıfını tanımlarsa `urn:tamga:<cc>:eaa:qualified` alt-namespace'i açılır.

## Karar 6 — `urn:tamga` isim alanı yönetimi

Beta'da gayriresmî (EUDI'nin `urn:eudi`'si gibi). Faz 1'de IANA formal URN NID kaydı
(RFC 8141) Trust Framework işi. Alt-namespace tahsisi (`edu`, `eaa`, `<cc>`) Trust
Framework'te; Faz 0+ zincirde Governance 2/3.

## Karar 7 — Geçiş

Henüz hiçbir credential verilmedi; **çift destek yok**. [[SPEC-SCHEMA-0001]] v2.0.0,
[[SPEC-SCHEMA-0002]] v2.0.0 (vct değerleri, Type Metadata örnekleri), [[SPEC-SCHEMA-0003]]
(iskelet vct'leri), [[SPEC-CRED-0002]] v1.3.0 (`category` claim'i + C-yeni), [[SPEC-API-0001]]
(C4 adımı), [[SPEC-PROTO-0001]] (PR2 metni: "metadata'daki her `vct` kayıtlı" aynen).
`docs/delivery/04-TRUST-LIST-FORMAT.md` zaten bu biçimdedir.

---

# Gerekçe

1. **Alan adı bağımsızlığı = devir bağımsızlığı.** TDT-first'ün tip kimliğine uygulanmasıdır:
   `ca_id`, `issuer_id` nasıl operatörden bağımsızsa `vct` de öyle olmalıdır. HTTPS vct,
   `tamga.network` alan adını sonsuza kadar tip kimliğinin parçası yapar.
2. **EUDI ile aynı görünüm.** PID `urn:eudi:pid:1` + katalog; ETSI kategorileri URN. Bir EUDI
   verifier'ı için `urn:tamga:…` + katalog, `urn:eudi:…` + katalogla aynı işlem yoludur.
3. **Standart uyumu kaybı yok.** IETF §5.3.2 ve ETSI 472-1 "metadata'ya işaret" şartı katalog
   yoluyla karşılanır; `#integrity` zorunluluğu bizi ARF kataloğundan (hash şartı yok) daha
   güçlü kılar (R-13).
4. **Maliyet şimdi sıfıra yakın.** Kod yok; yalnızca spec metinleri. Kod yazıldıktan sonra bu
   değişiklik her cüzdan/verifier/issuer'ı etkilerdi.
5. **Kategori sinyali eIDAS yapısını aynalar** ve verifier'a "devlet kurumu mu, akredite mi,
   kayıtlı mı" sorusunu credential'dan cevaplatır; kayıtla çapraz kontrol (C4) sahte sinyali
   engeller.

---

# Değerlendirilen Alternatifler

## A — HTTPS URL'de kal (D-SCHEMA-1) — Reddedildi (yönetişim gerekçesiyle)
Standarda uygun, dış verifier için kendinden-çözümlenir (IETF §5.3.1 her kütüphanede var),
§10.3 azaltmaları mevcut. Ancak tip kimliği alan adına bağlı kalır; TDT-first ile çelişir.
Teknik olarak **yanlış değildi**; bu ADR onu "hatalı" değil "kurguya uymayan" olarak süpersede eder.

## B — `.well-known/vct` yolu — Uygulanamaz
draft-19'da yoktur (ara taslaklarda vardı). Standart dışı yol tanımlamak interop'u bozar.

## C — DID tabanlı tip kimliği (`did:…`) — Reddedildi
[[ADR-0004]] DID entity profilini süpersede etti; tip kimliğine DID geri getirmek tutarsız.

## D — Kategori sinyalini koymamak (önceki DB-15) — Reddedildi
AB gözünde nitelikli olmayan EAA olduğumuz doğru; ama ETSI 472-1 bağlam-özel kategoriye izin
verir ve TDT-first kurgu kendi sınıflarını gerektirir. Koymamak, PUB/QUALIFIED ayrımını yalnızca
kayıtta bırakır ve credential'ı AB muadillerinden daha az kendinden-açıklayıcı yapar.

## E — Holder LoA'yı credential'a koymak — Reddedildi (yeniden)
eIDAS koymaz; PR7 koymaz; PM-TRUST-0001 gerekçesi geçerli. Seviye tipin ön koşuludur.

---

# Sonuçlar

## Bağlayıcı
1. [[DECISIONS]]: D-SCHEMA-1 → Değiştirilen Kararlar tablosu; yeni **D-SCHEMA-4** (vct URN +
   katalog), **D-CRED-4** (kategori sinyali, holder LoA asla).
2. [[SPEC-SCHEMA-0001]] v2.0.0: §1 "URL şeması" → "URN şeması + katalog"; §1.4 çözümleme; §7 Ş3;
   §9 sürümleme; D1 yeniden ifade; `tamga` bloğuna `category_allowed`.
3. [[SPEC-SCHEMA-0002]] v2.0.0, [[SPEC-SCHEMA-0003]] v1.1.0: vct değerleri.
4. [[SPEC-CRED-0002]] v1.3.0: `category` claim'i (opsiyonel, kayıtla eşleşmeli), yeni değişmez
   **C18** "`category` yalnızca kayıttaki `class`'a eşitse kabul edilir; holder assurance claim'i
   yoktur".
5. [[SPEC-API-0001]] v1.2.0: adım **C4** (kategori ↔ kayıt), sonuç nesnesine `issuer.class`.
6. [[PM-ASSUR-0001]] v1.1.0: Eksen B tablosuna `class` sütunu; politika örneği "tip × sınıf".
7. `/sync-index`: INVARIANTS D1 metni, C18, C4 kaydı; MASTER_INDEX sürümleri.

## Kabul edilen ödünleşimler
- Tamga dışı bir verifier, Tamga kataloğunu bilmeden `urn:tamga:…` metadata'sını çözemez
  (HTTPS'te GET yeterdi). Karşılık: katalog URL'i Trust Framework'te ilan edilir; SDK bunu
  varsayılan taşır; EUDI verifier'ları da EU URN'leri için aynı şeyi yapar.
- Kategori claim'i bir iddia daha demektir; C4 çapraz kontrolü olmadan anlamsızdır (bu yüzden
  atlanamaz).

---

# İlişkiler

**Süpersede eder (kısmi):** [[ADR-0007]] Karar 1 (vct HTTPS URL); D-SCHEMA-1
**Korur:** [[ADR-0007]] K2–K6 (off-chain metadata + çapa, `#integrity`, iki katman, allowlist)
**Dayanır:** [[ADR-0009]] Karar 5 (TDT-first) · [[RS-EIDAS-0001]] §4.4/§5.1 · IETF SD-JWT VC-19 · ETSI TS 119 472-1
**Değiştirir:** [[SPEC-SCHEMA-0001]], [[SPEC-SCHEMA-0002]], [[SPEC-SCHEMA-0003]], [[SPEC-CRED-0002]], [[SPEC-API-0001]], [[PM-ASSUR-0001]]
**Analiz kaynağı:** `docs/beta/05-kurallar` R-12, R-15, R-19, R-22; `06-eidas-uyum-mimarisi` §3.2–3.3; `04-karar-onerileri` DB-14, DB-15, DB-6

---

# Durum

**Accepted ✅** — 2026-09-24. [[DECISIONS]]'a D-SCHEMA-4, D-CRED-4 olarak işlendi; etkilenen SPEC sürüm güncellemeleri DECISIONS §10 açık taahhütler listesindedir.

