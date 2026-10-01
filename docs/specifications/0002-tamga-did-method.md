---
document_id: SPEC-ID-0001
title: Tamga DID Method — did:tamga Sözdizimi, Çözümleme ve Kimlik Katmanı
category: Specification
domain: Identity
status: Draft
review_status: Draft
version: 1.0.1
created: 2026-08-05
last_updated: 2026-09-30
authors:
  - Tamga Network Engineering
language: tr
document_type: specification
audience:
  - engineers
  - architects
  - ai-agents
stability: Evolutionary
maturity: Developing
tags:
  - specification
  - did
  - did-method
  - identity
  - resolution
  - sovereignty
  - unlinkability
keywords:
  - did:tamga
  - DID method
  - decentralized identifier
  - state namespace
  - did document
  - did resolution
  - pairwise pseudonymous did
  - unlinkability
related:
  - PM-ID-0001
  - PM-ID-0002
  - SPEC-BC-0001
  - SPEC-BC-0002
  - ADR-0002
  - PM-TRUST-0001
depends_on:
  - ADR-0002
  - SPEC-BC-0001
implementation:
  - sdk/
  - contracts/src/
summary: >
  did:tamga DID metodunun kanonik spesifikasyonu. İki profil tanımlar:
  (1) **Entity DID** `did:tamga:<state>:<id>` — issuer/RP/devlet otoritesi için
  zincir üstünde kayıtlı, çözümlenebilir, hesap-verebilir kimlik; state ad-alanı
  [[ADR-0002]] egemenliği ve [[SPEC-BC-0001]] `bytes2 stateCode` ile birebir
  hizalı. (2) **Pseudonymous DID** `did:tamga:p:<mb-pubkey>` — vatandaş/holder için
  self-certifying (kayıtsız), pairwise ve unlinkable; çözümleme yerel anahtardan,
  registry'den değil ([[PM-ID-0001]] üç katman). Zincir kişisel veri tutmaz
  ([[PM-TRUST-0001]]); iki profil arası köprü yalnızca accountable disclosure
  ([[PM-ID-0002]]) ile kurulur.
priority: Critical
---
> **Sürüm notu 1.0.1 (2026-09-30) — ürün adı:** TamgaID → Tamga Wallet / “Tamga ile giriş yap” (proje yönetimi kararı; anlam değişmedi).

> **⚠️ SUPERSEDING NOTU (2026-08-06, [[ADR-0004]]):** Kurumsal/**Entity DID profili**
> (`did:tamga:<state>:<id>`) **artık kullanılmaz** — kurumsal kimlik **X.509
> sertifikalarıyla** kurulur (`issuerId = keccak256(stateCode, certFingerprint)`).
> Bu dokümanın Entity DID bölümleri tarihsel referanstır. **Pseudonym profili
> (`did:tamga:p:<key>`) GEÇERLİDİR ve korunur.** Tam X.509 metodu → SPEC-ID-0002 (planlı).

# Kapsam

Bu spesifikasyon, Tamga Network'ün merkeziyetsiz tanımlayıcı (DID) metodunu — `did:tamga` — tanımlar. W3C DID Core 1.0 ile uyumludur. **Ne'yi** değil **nasıl'ı** belirler: DID sözdizimi, DID Document üretimi, çözümleme (resolution) algoritması ve iki kullanım profili.

Bu doküman [[PM-ID-0001]]'in (üç katmanlı kimlik: Root / Pseudonym / Credential) ve [[ADR-0002]]'nin (egemenlik-öncelikli, state namespace) kod/protokol seviyesindeki karşılığıdır. Issuer/RP kayıtları [[SPEC-BC-0001]]'de tanımlıdır; bu doküman onların **DID temsilini** verir.

**Değişmez ilke:** Zincir yalnızca kişisel-OLMAYAN güven referansları tutar ([[PM-TRUST-0001]]). Entity DID Document'leri zincirden türetilir; **holder pseudonym DID'leri asla zincire yazılmaz.**

---

# 1. Neden İki Profil?

[[PM-ID-0001]] üç katman tanımlar:

| Katman | Kim | Görünürlük | DID profili |
|--------|-----|-----------|-------------|
| **Entity** (issuer, RP, devlet otoritesi) | Kurumlar | Kamuya açık, kayıtlı, **hesap verebilir** | `did:tamga:<state>:<id>` |
| **Pseudonym** (holder/vatandaş takma kimliği) | Bireyler | Yerel, **pairwise, unlinkable** | `did:tamga:p:<mb-pubkey>` |
| **Root Identity** | Birey (kök) | Asla açığa çıkmaz | *(DID değil; türetim kökü)* |

İki profilin **kesişmemesi** tasarımın kalbidir: bir issuer'ın kim olduğu herkesçe doğrulanabilir olmalı (güven), bir vatandaşın iki sunumunun aynı kişi olduğu ise **olmamalı** (mahremiyet). Bu ikisini yalnızca [[PM-ID-0002]] threshold escrow'u, yasal gerekçeyle köprüler.

---

# 2. Sözdizimi (ABNF)

```abnf
tamga-did        = "did:tamga:" ( entity-id / pseudonym-id )

; Profil 1 — Entity (kayıtlı, çözümlenebilir)
entity-id        = state-code ":" entity-nsid
state-code       = 2ALPHA          ; ISO 3166-1 alpha-2, KÜÇÜK harf (tr, az, kz, uz, kg, tm)
entity-nsid      = 1*63 (ALPHA / DIGIT / "-")   ; okunabilir slug VEYA multibase anahtar

; Profil 2 — Pseudonymous (self-certifying, kayıtsız)
pseudonym-id     = "p:" multibase-key
multibase-key    = "z" 1*BASE58BTC  ; multibase(base58btc) + multicodec ile sarılı açık anahtar
```

- `state-code`, [[SPEC-BC-0001]]'deki `bytes2 stateCode` alanının ASCII küçük-harf karşılığıdır (`"tr"` ↔ `0x7472`). Tek gerçeklik kaynağı zincirdeki Governance kayıt kütüğüdür.
- `entity-nsid` iki biçimden biridir: (a) **okunabilir slug** (`itu`, `saglik-bakanligi`) — insan-dostu, Issuer Registry'de `issuerId`'ye bağlanır; (b) **multibase anahtar** — anahtar-merkezli entity'ler için.
- `p:` öneki bir DID'in **pseudonymous ve kayıtsız** olduğunu açıkça işaretler; çözümleyici bunu registry'de aramaz (§5.2).

### Örnekler

```text
did:tamga:tr:itu                 ; İTÜ (issuer, okunabilir slug)
did:tamga:tr:saglik-bakanligi    ; T.C. Sağlık Bakanlığı (issuer)
did:tamga:az:asan                ; ASAN (Azerbaycan devlet otoritesi)
did:tamga:tr:rp:akbank           ; relying party (RP alt-slug'ı, §4)
did:tamga:p:z6Mk...w9k           ; bir vatandaşın pairwise pseudonym'i (kayıtsız)
```

> **Web notu:** Tanıtım sitesindeki `did:tamga:itu` gibi örnekler bu spesifikasyona göre `did:tamga:tr:itu` biçimine güncellenecektir (state ad-alanı zorunlu). Holder örneği `did:tamga:8f2…c19` → `did:tamga:p:z…` pseudonym profiline taşınır.

---

# 3. Entity DID Document (Profil 1)

Entity DID Document **zincirden türetilir**; ayrı bir belge deposu yoktur. Kaynak, [[SPEC-BC-0001]]'deki Issuer / RP / (devlet) Authority kayıtlarıdır.

```jsonc
{
  "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
  "id": "did:tamga:tr:itu",
  "controller": "did:tamga:tr",                 // home-state otoritesi (namespace sahibi)
  "verificationMethod": [{
    "id": "did:tamga:tr:itu#key-1",
    "type": "JsonWebKey2020",
    "controller": "did:tamga:tr:itu",
    "publicKeyJwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
  }],
  "assertionMethod": ["did:tamga:tr:itu#key-1"], // credential imzalama (issuer)
  "service": [{
    "id": "did:tamga:tr:itu#status",
    "type": "TamgaStatusList",
    "serviceEndpoint": "https://status.tamga.network/tr/itu"
  }]
}
```

Kurallar:

- **`controller`** her zaman entity'nin state namespace otoritesidir (`did:tamga:<state>`). Bu, [[ADR-0002]] `onlyOwnerState` egemenliğini DID katmanında yansıtır: bir entity'nin anahtarını/statüsünü yalnızca kendi devleti yönetir.
- **`verificationMethod`** anahtarları Issuer/RP Registry'deki aktif anahtarlardan doldurulur. Anahtar rotasyonu registry güncellemesidir; DID sabit kalır, Document değişir.
- **Statü (aktif/askı/iptal):** DID Document'in kendisinde değil, çözümleme meta-verisinde döner (§5.3). İptal edilmiş issuer'ın DID'i **çözülür ama `deactivated: true`** işaretlenir — geçmiş credential doğrulaması için (soft revocation, [[SPEC-BC-0001]]).
- **`successorId`** varsa (issuer devri), meta-veriye `canonicalId`/`successor` olarak yansıtılır.

---

# 4. State Authority ve RP DID'leri

- **State authority:** `did:tamga:<state>` (nsid'siz) — devletin namespace kök otoritesi; Governance kontratındaki `stateOwner` adresine bağlıdır. Tüm o-devlet entity'lerinin `controller`'ıdır.
- **Relying Party:** `did:tamga:<state>:rp:<slug>` — `rp:` alt-öneki RP'yi issuer'dan ayırır; `assertionMethod` yerine yalnızca kimlik doğrulama/scope anahtarları taşır ([[SPEC-BC-0001]] RP Registry, scope/aşırı-talep koruması).

---

# 5. Çözümleme (Resolution)

## 5.1 Entity çözümleme (on-chain)

`resolve(did)` algoritması:

1. DID'i parçala; `did:tamga:` metodunu ve `state-code`'u doğrula.
2. `state-code`'u Governance kütüğünde ara — kayıtlı ve aktif değilse `stateNotFound`.
3. `entity-nsid`'i ilgili registry'de çöz (Issuer/RP/Authority) → `issuerId`/kayıt.
4. Kayıt yoksa `notFound`; varsa DID Document'i §3 kurallarıyla **üret**.
5. Statü meta-verisini (§5.3) ekle ve döndür.

Çözümleme **read-only** zincir sorgusudur (gas'sız `eth_call`); herkes bağımsız doğrulayabilir. Resolver `sdk/` altında referans olarak sağlanır.

## 5.2 Pseudonymous çözümleme (self-certifying, registry YOK)

`did:tamga:p:<mb-pubkey>` **zincire sorulmaz.** Çözümleme tamamen DID'in içindeki anahtardan yapılır (did:key mantığı):

1. `p:` öneki → pseudonymous profil.
2. `multibase-key`'i çöz → multicodec + açık anahtar.
3. DID Document'i tümüyle bu anahtardan **yerel olarak** üret (`verificationMethod` = gömülü anahtar).

Bu, **unlinkability** için zorunludur: pseudonym'ler bir yerde listelenmez, sorgulanmaz, sayılamaz. Her ilişki (RP–holder) için **farklı** pseudonym türetilir ([[PM-ID-0001]] pairwise). Türetim kökü Root Identity'dir (BIP32-benzeri), ama kök hiçbir zaman açığa çıkmaz.

> **Ağ-geçerlilik (escrow):** Bir pseudonym'in RP/issuer tarafından kabul edilmesi için, türetim anında **escrow enrollment** (accountable disclosure için şifreli kayıt + makbuz) tamamlanmış olmalıdır — bkz. [[SPEC-BC-0002]] §4. Escrow'suz pseudonym self-certifying olarak çözülür ama **ağ-geçersizdir**. Vatandaş kendi pseudonym'lerini cüzdanında görüntüleyebilir ("hangi RP'ye hangi pseudonym").

## 5.3 Çözümleme meta-verisi

```jsonc
{
  "didResolutionMetadata": { "contentType": "application/did+ld+json" },
  "didDocumentMetadata": {
    "network": "tamga:1",              // chainId / ağ kimliği
    "stateCode": "tr",
    "deactivated": false,              // soft revocation → true
    "canonicalId": "did:tamga:tr:itu", // successorId varsa halef
    "registeredAt": "2026-...",
    "sourceContract": "0x..."          // IssuerRegistry adresi (denetlenebilirlik)
  }
}
```

---

# 6. Anahtarlar ve Kripto Uyumu

- **İmza eğrileri:** P-256 (ES256) birincil (eIDAS/QSCD, EUDI ARF uyumu); secp256k1 (ES256K) EVM/cüzdan uyumu için kabul. Bkz. `ACA-CRYPTO-0001`.
- **VC bağlama:** Entity `assertionMethod` anahtarları SD-JWT VC / W3C VC imzalarını üretir; doğrulayıcı `did:tamga` resolver'ıyla issuer anahtarını çözer.
- **Pseudonym anahtarları** holder cüzdanında (Tamga Wallet) türetilir; Root'tan pairwise türetim ([[PM-ID-0001]]).

---

# 7. Değişmezler (Invariants)

1. Bir entity DID'i **yalnızca kendi state namespace'i** (`controller`) tarafından oluşturulur/güncellenir ([[ADR-0002]] `onlyOwnerState`).
2. `did:tamga:p:*` **asla** zincire yazılmaz, sayılmaz, listelenmez (unlinkability).
3. Entity DID **kalıcıdır**; iptal = `deactivated: true`, silme değil (geçmiş VC doğrulanabilir kalır — soft revocation).
4. Aynı fiziksel kişinin iki pseudonym'i **kriptografik olarak ilişkilendirilemez**; köprü yalnızca [[PM-ID-0002]] 3-of-5 escrow + yasal token ile kurulur.
5. Çözümleme deterministiktir ve **read-only**'dir; hiçbir çözümleme durum değiştirmez.

---

# 8. Açık Sorular

1. **Slug tahsisi:** `entity-nsid` slug'ları çakışmayı nasıl önler? (Öneri: Issuer Registry'de state başına benzersiz slug kısıtı — [[SPEC-BC-0001]] güncellemesi.)
2. **`did:web` köprüsü:** Kurumların mevcut `did:web` kimlikleriyle eşleme/alias gerekli mi (interop)?
3. **Multicodec seti:** Pseudonym anahtarları için desteklenen multicodec prefiksleri (P-256, secp256k1, Ed25519?) sabitlenecek.
4. **Ağ kimliği (`network`):** `tamga:1` gösterimi chainId ([[ARCH-0002]]) ile nasıl formalize edilir (CAIP-2 benzeri)?
5. **Universal Resolver:** `did:tamga` için DIF Universal Resolver driver'ı yayınlanacak mı (dış interop)?

---

# 9. İlişkiler

- [[PM-ID-0001]] — Üç katmanlı kimlik modeli (bu metodun kavramsal temeli).
- [[PM-ID-0002]] — İki profil arası köprünün (accountable disclosure) mekanizması.
- [[SPEC-BC-0001]] — Issuer/RP/Governance kayıtları (entity çözümlemenin veri kaynağı).
- [[ADR-0002]] — State namespace / egemenlik (DID `controller` kuralı).
- [[PM-TRUST-0001]] — Zincir kişisel veri tutmaz (pseudonym DID'leri off-chain).
- `ACA-ID-0001`, `ACA-CRYPTO-0001` — DID/VC ve kripto temelleri (öğretici).

---

# 10. Durum

**review_status: Draft.** did:tamga metodu iki profille (entity state-namespaced / pseudonym self-certifying) tanımlandı; çözümleme, DID Document üretimi ve değişmezler sabitlendi. Karar temeli: [[ADR-0002]] (state ad-alanı) + [[PM-ID-0001]] (üç katman). Açık sorular §8 — slug benzersizliği ve multicodec seti [[SPEC-BC-0001]] ile senkron kapatılacak. Referans resolver + DID Document üreteci `sdk/` altında yazılacaktır.
