---
document_id: SPEC-TRUST-0001
title: Faz B Güven Listeleri — lotl / tl-{cc} / anchors Formatı, Kadans ve TrustSource Eşdeğerliği
category: Specification
domain: Trust
status: Active
review_status: Completed
version: 1.2.0
created: 2026-09-24
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: specification
audience:
  - engineers
  - architects
  - operators
  - ai-agents
stability: Stable
maturity: Developing
tags:
  - trust-list
  - phase-b
  - lotl
  - anchors
  - etsi-119-612
  - trust-source
keywords:
  - signed versioned hash-chained trust lists
  - list of trusted lists lotl
  - national trusted list tl-tr
  - anchor log anchors.jsonl
  - TrustSource list chain equivalence
  - ETSI TS 119 612 projection
  - TDT-first slots provisional operator
related:
  - ADR-0009
  - ADR-0010
  - SPEC-BC-0001
  - SPEC-ID-0002
  - SPEC-CRED-0003
  - SPEC-SCHEMA-0001
  - ARCH-0003
  - FW-ARF-0001
  - FW-RB-0001
depends_on:
  - ADR-0009
  - SPEC-BC-0001
implementation:
  - packages/trust (loader, store, ListTrustSource)
  - apps/trust-publisher (build, anchor, heartbeat, verify, status)
  - conformance/vectors/trust
summary: >
  Faz B'nin güven çapası olan imzalı, sürümlü ve hash-zincirli güven listelerinin
  (lotl.jws, tl-{cc}.jws) ve saatlik çapa günlüğünün (anchors.jsonl) normatif formatı,
  yayın kadansı, anahtar disiplini, TDT-first slotları, kayıt yaşam döngüsü ve
  zincirle eşdeğerlik kuralları. Her alan bir SPEC-BC-0001 kontrat kaydına eşlenir;
  okuma yalnızca TrustSource arayüzünden yapılır. docs/delivery/04'ün kanonik hâli (DB-11).
priority: Critical
---
> **Sürüm notu 1.2.0 (2026-10-01) — [[ADR-0036]] (D-TRUST-2, federasyon):** LOTL'a `external_lists[]` eklendi: başka işletmecinin listesi (ETSI TS 119 602 LoTE JSON) adres + LOTL'da sabit imzacı parmak izi + kapsam (`entity_kinds`, `vct`, `category`, `assurance`, `class`, `recognized_by`, `min_key_storage`) + onay kaydıyla gösterilir (FD1–FD5). Yayıncı kopyası `external/<list_id>.jws`. Dış liste bağımsızdır: eksik/bayat olması Tamga listelerinin tazeliğini bozmaz, o listeye bağlı sorular UNKNOWN (FD3). `TrustSource`'a `externalIssuerByAnchor`, `externalAnchorCertsDer`, `walletProviderMinKeyStorage` eklendi (BT4).

> **Sürüm notu 1.1.7 (2026-10-01) — [[ADR-0034]] (D-PROTO-2):** `relying_parties[]`'a zorunlu **`dns_name`** (kalıcı kayıt kimliği; erişim sertifikasının SAN'ında olmalı — yayıncı denetler). `client_id` artık yayıncı tarafından erişim sertifikasından hesaplanır: `x509_hash:` + base64url(SHA-256(sertifika DER)) (HAIP 1.0 §5); kayıt kaynağında yazılmaz. `uses_intermediaries` / `served_relying_parties` `dns_name` listeler. `TrustSource.relyingPartyByDnsName()` (BT4).

> **Sürüm notu 1.1.6 (2026-10-01) — [[ADR-0032]] (D-ZK-1):** `lotl.zk_circuits[]` (isteğe bağlı) — kabul edilen sıfır bilgi ispatı devreleri: `{circuit_id (Longfellow combined_hash, 64 onaltılık), system: "longfellow-libzk-v1", version, attributes, sha256 (sıkıştırılmış devre dosyası), status}`. Doğrulayıcı yalnız ETKİN kayıtlı devreyle üretilmiş ispatı kabul eder (ZK2) ve devre dosyasını `sha256` ile sabitler; `TrustSource.zkCircuit()/zkCircuits()` (BT4). Devre güncellemesi = liste güncellemesi. Alan eklemelidir (`passthrough`).
>
> **Sürüm notu 1.1.5 (2026-09-29) — dil:** Listelerdeki bütün metin alanları (not, gerekçe, amaç, etiket, sistem adları) **İngilizcedir**; kurumların resmî adları (`legal_name`) kendi dillerinde kalır. `relying_parties[].scopes[]`'a isteğe bağlı **`purpose_localized`** (BCP 47 dil etiketi → metin, ör. `{"tr-TR": "…", "tk-TM": "…"}`) eklendi: cüzdan kullanıcının dilindeki çeviriyi gösterir, yoksa İngilizce `purpose`'u. Kullanıcıya gösterilen `purpose` iç karar kodu taşımaz. Alan eklemelidir; eski istemciler görmezden gelir (`passthrough`).

> **Sürüm notu 1.1.4 (2026-09-27) — sağlamlaştırma:** (1) Bütün tarih alanları okunabilir ISO 8601 olmalı; okunamayan tarih listeyi geçersiz kılar (NaN karşılaştırmaları geçerlilik/tazelik denetimini sessizce atlatmasın). (2) `issuers[].delegate_keys[]` içinde `purpose: "status_list"` kaydı kurumun iptal listesi imza sertifikasının parmak izidir; doğrulayıcı iptal listesi imzacısını bununla eşler ([[SPEC-CRED-0003]] S11). (3) Tazelik yüklemeden sonra da işler: en erken `next_update` ya da son çapa satırı + azami yaş geçince cevaplar UNKNOWN olur (BT5).

> **Sürüm notu 1.1.3 (2026-09-27) — [[ADR-0015]] (D-TRUST-1):** §6 yükleyici kuralları tek gerçeklemede (`@tamga-network/trust/core`, platformdan bağımsız); cüzdan dahil tüm istemciler aynı `TrustSource`'u kullanır.

> **Sürüm notu 1.1.2 (2026-09-27):** çapa satırlarındaki `published_at` **RFC 3339** tarih-saattir ve yayıncının saatiyle yazılır; yükleyici biçimi doğrular, bozuk satır listeyi geçersiz kılar (doğrulayıcının D5 kontrolünü sessizce atlamasını önler — [[SPEC-API-0001]] 1.3.2). Doğrulayıcılar yayıncı saatine kayma toleransı uygular.

> **Sürüm notu 1.1.1 (2026-09-26, düzeltme) — TL12 anlık durum:** 1.1.0'daki kontrol noktası yalnızca arşivi işaret ediyordu; yükleyici güncel dilimi okuyunca **arşivden önce çapalanmış status listelerini unutuyordu** (her issuer bir sonraki yayına kadar D2 INDETERMINATE; üretim kadansında ≤ 1 saat). Kontrol noktası artık imzalı **`state`** taşır: liste başına son status çapası + şema çapaları; yükleyici baştaki kontrol noktasını durumsuzsa reddeder. Bulan: sahne 2b (2026-09-26 akşam).
>
> **Sürüm notu 1.1.0 (2026-09-26) — çapa günlüğü arşivleme (TL12):** yeni `checkpoint` satır türü (§5), yükleyici kuralı ve
> `trust:verify --full` replay. Gerekçe: demo kadansıyla günlük 7.1k satıra ulaştı, bir yükleme 5,8 s sürdü ve servislerin periyodik
> yenilemesi üst üste bindi (2026-09-26 bulgusu). Karar değişmedi (TL2 silme yasağı korunur); ek kural.
>
> **Sürüm notu 1.0.1 (2026-09-25) — [[ADR-0011]] (Tamga geçici kimlik attestation sağlayıcısı):** TL8'e Tamga kimlik attestation sağlayıcısının konumu eklendi (`issuers[]` kaydı; PID değil); `tl-tr` örneğine `tamga-id` issuer'ı ve kurum issuer'ının kimlik eşleştirme RP kaydı (`x509_san_dns:issuer.tamga.network`, scope: TCKN + doğum tarihi + ad + soyad) girdi.


# Kapsam

Bu spesifikasyon [[ADR-0009]] K2'nin normatif uygulamasıdır: zincir kurulana kadar (≥2 bağımsız validator
operatörü) güven kayıtlarını taşıyan **liste** biçimini tanımlar. Zincir kurulunca aynı veriler kontratlara
replay edilir (§7); belgeler, cüzdan ve doğrulama hattı değişmez. Kanonik alan adları [[SPEC-BC-0001]] ve
[[ARCH-0003]] §2.4 SQL yansımasından alınmıştır. Kişisel veri hiçbir listede yoktur (DP1).

---

# 1. İlkeler

1. **Her alan bir kontrat kaydına eşlenir** (§7); liste = zincirin tek-imzacılı özel hâli.
2. **Kişisel veri yok** — yalnızca kurum adı, sertifika parmak izi, statü, tarih, URI, kimlik türetimleri.
3. **Sürüm + hash zinciri** — `version` monoton, `previous_version_hash = sha256(<önceki .jws>)`; silme yok; statü
   değişiklikleri `status_history`'ye eklenir.
4. **İmza** — her liste JWS compact (`.jws`; `alg: ES256`, `x5c` operatör sertifikası); `.json` yalnızca insan için.
   Doğrulayıcı yalnızca `.jws` kullanır; `x5c[0]` parmak izini `keys/root-fingerprints.json` (lotl) veya
   `lotl.national_lists[].signing_keys` (tl) ile eşler.
5. **ETSI eşlemesi** — statüler Tamga enum'uyla; ETSI TS 119 612 XML projeksiyonu [[SPEC-ID-0002]] §8.1 tablosuyla
   üretilir (`granted`/`withdrawn`/`TakenOverBy`).
6. **Kadans** — `lotl`/`tl-<cc>`: `next_update` ≤ 90 gün, değişiklik olmasa da yeniden imza; değişiklik ≤ 24 saatte
   yayın; `anchors.jsonl` saatlik (heartbeat dahil).
7. **Tip kimliği** — `vct` URN ([[ADR-0010]]); `lotl.schemas[]` katalog girdisi `metadata_url + content_hash` verir.
8. **Kategori sinyali** — issuer `class: PUB | QUALIFIED | EAA` ([[ADR-0010]] K5).
9. **TDT-first** — `lotl` + her üye devlet için ulusal liste slotu, tam ARF rol seti, `operator.on_behalf_of`;
   devir yalnızca `operator` alanını değiştirir; `ca_id`/`issuer_id`/`vct` sabittir (D-GOV-5).

---

# 2. Dosya yerleşimi (`https://trust.tamga.network/`)

```
lotl.jws · lotl.json          listelerin listesi + NETWORK şemaları + wallet providers + kategoriler
tl-tr.jws · tl-tr.json        TR ulusal listesi (root_cas, issuers, relying_parties, national_schemas)
tl-<cc>.jws (RESERVED)        AZ/KZ/KG/UZ (üye), HU/TM (gözlemci) — slot
anchors.jsonl                 çapa günlüğü (satır = JWS)
keys/root-fingerprints.json   LOTL imza sertifikası parmak izleri (= tamga.network/trust-anchor)
keys/<ad>.cert.pem            operatör/kök/wallet-provider/rp sertifikaları (ilan)
archive/<dosya>.v<NNNN>.jws   değişmez sürüm arşivi (replay girdisi)
CHANGELOG.md                  herkese açık değişiklik günlüğü
```

---

# 3. `lotl` — listelerin listesi

| Alan | Tip | Anlam / kontrat karşılığı |
|---|---|---|
| `list_format_version` | string | Biçim sürümü; bilinmeyen → doğrulayıcı **durur** (CMP2) |
| `list_type` | `"lotl"` | |
| `version`, `issued_at`, `next_update`, `previous_version_hash` | | Sürüm/hash zinciri (§1.3, §1.6) |
| `operator` | `{name, status: "provisional", on_behalf_of, trust_framework, transparency_report}` | Kurucu vekil; [[FW-TF-0001]] URL'i |
| `catalogue` | `{url}` | Type Metadata çözümleme yolu (`schemas.tamga.network/v1/catalogue.json`) |
| `anchor_signing_keys[]` | `{fingerprint_sha256, cert_ref, status}` | Çapa günlüğü imzacıları (≥2 kaydırmalı — TL3) |
| `national_lists[]` | `{state_code, status: ACTIVE\|RESERVED, membership, list_url, operator, roles{registrar, tlso, pid_provider, access_ca, national_root_ca}, signing_keys[], recognition{mode, recognizes[]}}` | `Governance` üye listesi + `CrossRecognition` |
| `schemas[]` | `{schema_id, vct, metadata_url, content_hash, content_hashes[], layer: NETWORK, governance, status, registered_at, status_history[]}` | `SchemaRegistry` (NETWORK); `registered_at` **kalıcıdır** (ilk çapa zamanı); `content_hashes` = geçerli sürüm özetleri ([[ADR-0010]] K4; geliştirme evresinde yalnız güncel özet, [[ADR-0029]]), her biri bir kez çapalanır |
| `eaa_categories` | `{urn → açıklama}` | Kategori namespace'i ([[ADR-0010]] K5) |
| `wallet_providers[]` | `{provider_id, legal_name, wua_signing_keys[], solutions[{solution_id, min_version, status, security_level}], status}` | WUA güven çapası (R-7; zincirde henüz yok — ADR adayı) |
| `zk_circuits[]` | `{circuit_id, system, version, attributes, sha256, status}` | Kabul edilen ZK devreleri ([[ADR-0032]] ZK2; zincirde henüz yok) |
| `pid_providers[]` | boş, rezerve | BT8 → TL8 |

---

# 4. `tl-<cc>` — ulusal liste

| Alan | Anlam / kontrat karşılığı |
|---|---|
| `state_code`, `version`, `issued_at`, `next_update`, `previous_version_hash`, `operator` | Namespace = devlet; imza yalnızca o namespace'in anahtarıyla (N1'in Faz B okuması) |
| `root_cas[]` `{ca_id, legal_name, cert_fingerprint_sha256, cert_pem, service_type, operator, status: ACTIVE\|ROLLING_OVER\|RETIRED\|REVOKED, valid_from/until, successor_ca_id, status_history[]}` | `RootCARegistry` (CA1–CA3); `ca_id = keccak256(cc ‖ SHA-256(rootDER))` |
| `issuers[]` `{issuer_id, slug, legal_name, category, assurance: I1..I3, class: PUB\|QUALIFIED\|EAA, assurance_basis, parent_ca_id, cert_fingerprint_sha256, issuer_url, status_list_base, status, valid_from/until, successor_id, status_history[], schema_authorizations[{schema_id, vct, allowed, valid_from, valid_until}], delegate_keys[], authentic_source}` | `IssuerRegistry` (I1–I4, R1–R2); `issuer_id = keccak256(cc ‖ SHA-256(leafDER))`; yetki **zaman pencereli** (I3) |
| `relying_parties[]` `{rp_id, client_id, dns_name, legal_name, access_cert_fingerprint_sha256, status, registered_at, scopes[{scope_id, purpose, purpose_localized?, vct, claims[], valid_from, valid_until}], status_history[]}` | `RelyingPartyRegistry`; `client_id` = OpenID4VP client identifier `x509_hash:` (yayıncı erişim sertifikasından hesaplar; [[ADR-0034]]), `dns_name` = kalıcı kayıt kimliği (SAN); `scopes[]` = ARF registration certificate muadili (AP6). **Kayıt verisi ([[ADR-0024]], 2026-09-29):** isteğe bağlı `trade_name`, `identifiers[]`, `postal_address`, `info_uri`, `contact`, `service_description`, `is_public_sector_body`, `entitlements[]`, `supervisory_authority`, `uses_intermediaries[]` / `served_relying_parties[]`, `scopes[].privacy_policy_uri`; `issuers[]` aynı kimlik/iletişim alanlarını ve sınıftan türetilen `entitlements`'ı taşır. Yayıncı 2026-09-30 ve sonrasında kaydedilen katılımcıda eksik zorunlu alanla yayın yapmaz. **Kayıt sertifikaları ([[ADR-0026]]):** yayıncı her geçerli kullanım ve her belge veren için `wrprc/` altında ETSI TS 119 475 `rc-wrp+jwt` üretir (dizin `wrprc/index.json`; kayıt kurumu anahtarı LOTL `national_lists[].roles.registrar.signing_keys`); `sub` = `identifiers[]`'dan semantik tanımlayıcı (`VATTR-`, `NTRTR-`). |
| `national_schemas[]` | `SchemaRegistry` (NATIONAL) |

Statü sözlüğü: `ACTIVE | SUSPENDED | REVOKED | RETIRED` (+ kök: `ROLLING_OVER`). Geçmiş silinmez; doğrulama
`status_history`'ye belgenin `iat`'ı ile bakar (D-BC-3, [[SPEC-BC-0001]]/I2–I3). `REVOKED` issuer'ın listesini halefi
(`successor_id`) yayınlayabilir (I4). Operatör aracı: `trust-publisher status <slug> <STATUS> --reason r`.

---

# 5. `anchors.jsonl` — çapa günlüğü

Her satır bağımsız JWS; payload `{seq, previous_hash, ts, kind, …}`:

| `kind` | Alanlar | Kontrat karşılığı |
|---|---|---|
| `status_list` | `list_id, issuer_id, list_uri, content_hash, list_version, published_at` | `StatusListRegistry.publishList` (S1/S4 Faz B okuması, L1) |
| `schema` | `schema_id, vct, content_hash` | `SchemaRegistry` contentHash (D8: CDN yayınından **sonra**) |
| `heartbeat` | — | Saatlik kadans (S5 mantığı operatör tarafında) |
| `checkpoint` | `archive: { file, sha256, seq_from, seq_to, lines }`, `state: { status_lists[], schemas[] }` | Arşiv kontrol noktası (TL12); `state` = arşive giden satırların ürettiği son durum |

Kurallar: saatte ≥1 satır; `list_version` issuer başına monoton (L1/S3); `content_hash` verifier D5'te Status List
Token hash'iyle karşılaştırılır; satır silinmez; günlük herkese açık; `list_uri` opak (S8).

**Arşivleme ve kontrol noktası (TL12, v1.1.0).** Günlük büyüdükçe yükleme süresi satır sayısıyla doğrusal artar (her satır bir
JWS doğrulaması). Operatör, günlük bir eşiği aşınca (varsayılan 500 satır) mevcut satırların **hepsini** `archive/anchors-<from>-<to>.jsonl`
dosyasına taşır ve yeni günlüğün ilk satırı olarak imzalı bir `checkpoint` yazar: `seq = seq_to + 1`,
`previous_hash = sha256(arşivdeki son satır)`, `archive.sha256 = sha256(arşiv dosyası)` ve **`state`** — arşive giden satırların ürettiği son durum (liste başına en yüksek `list_version`'lı status çapası + şema çapaları). Sonraki çapa normal biçimde kontrol
noktasına bağlanır; zincir kesintisizdir, hiçbir satır silinmez (TL2). Yükleyici: ilk satır `checkpoint` ise imzasını doğrular
(çapa imza anahtarı), `seq`'in `seq_to + 1` olduğunu denetler, **`state`'i depoya uygular (yoksa reddeder)** ve zinciri oradan sürdürür; `checkpoint` `TrustSource`'a kayıt
üretmez. Ortada görülen `checkpoint` sıradan bir satırdır (tam geçmiş yüklemesinde). Tam geçmiş (TL10 replay,
`trust:verify --full`): kontrol noktaları geriye izlenir, her arşivin hash'i doğrulanır, zincir seq 0'dan yüklenir. Yükleme
maliyeti böylece güncel dilimle sınırlı kalır; arşivler herkese açık kalır.

---

# 6. Yükleyici ve `TrustSource` (doğrulayıcı tarafı)

`@tamga-network/trust` `loadTrustSet` sırası: `lotl.jws` imzası (kök parmak izleri) → `tl-<cc>.jws` imzaları
(`signing_keys`) → biçim (`list_format_version`) → hash zinciri → `next_update` → `anchors.jsonl` zinciri →
bellek-içi yansıma ([[ARCH-0003]] §2.4 tabloları). Sonra `ListTrustSource` [[SPEC-BC-0001]] §11.2 okuma setini sunar:
`isCredentialAcceptable(issuerId, iat)`, `isCredentialSchemaAcceptable(issuerId, schemaId, iat)`, `isRecognizedBy`,
`schemaContentHash`, `statusAnchor`, `relyingParty`, `issuer`, `schema`, `isWalletProviderKey`, `freshness()`.
Üç değerli cevap: `YES | NO | UNKNOWN`; `UNKNOWN` → INDETERMINATE (CMP4). Servisler listeyi periyodik yeniden yükler
(issuer `TAMGA_TRUST_RELOAD_SEC`, verifier `TAMGA_VERIFY_TRUST_RELOAD_SEC`).

---

# 7. Kontrat eşlemesi ve zincire geçiş

| Liste alanı | Kontrat çağrısı |
|---|---|
| `root_cas[]` | `RootCARegistry.registerRootCA / rollover / retire / revoke` |
| `issuers[]` | `IssuerRegistry.registerIssuer / suspend / revoke(revokedAt) / setSuccessor` |
| `issuers[].schema_authorizations[]` | `IssuerRegistry.setSchemaAuthorization(issuerId, schemaId, from, until)` |
| `lotl.schemas[]` | `Governance` önerisi → `SchemaRegistry.registerSchema(vct, contentHash, NETWORK)` |
| `relying_parties[]` | `RelyingPartyRegistry.register / setScope` |
| `anchors kind=status_list` | `StatusListRegistry.publishList(listId, uri, hash, version)` |
| `anchors kind=schema` | `SchemaRegistry` contentHash |
| `wallet_providers[]` | zincirde henüz yok — ADR adayı |
| `zk_circuits[]` | zincirde henüz yok — Faz 0'da `Governance` kaydı (ADR adayı) |

Geçiş: `archive/` sürümleri sırayla kontrat çağrılarına replay edilir; `TrustSource(list)` ile `TrustSource(chain)`
`conformance/vectors/trust` sorgularına aynı cevabı vermeden geçiş tamamlanmış sayılmaz (TL10; [[ADR-0009]] K7).
Devir: yalnızca `operator` alanı değişir.

---

# 8. Değişmezler

| # | Değişmez |
|---|---|
| **TL1** | Her listede `operator.status` vardır ve Faz B boyunca `"provisional"`dır; `on_behalf_of` boş bırakılmaz. |
| **TL2** | Liste ve çapa günlüğü sürümleri monoton artar; her sürüm bir öncekinin hash'ini taşır; hiçbir satır/kayıt silinmez (statü değişikliği `status_history`'ye eklenir). |
| **TL3** | Liste ve çapa imzası ≥2 kaydırmalı sertifikayla yapılır; rotasyon ≥30 gün önce duyurulur; yeni anahtar eskisiyle imzalanır. (Demo sapması S-6 beyanlı.) |
| **TL4** | `TrustSource` dışında hiçbir bileşen liste dosyalarını yorumlamaz. |
| **TL5** | `next_update` geçmiş veya erişilemeyen liste ile doğrulama **INDETERMINATE** üretir; asla ACCEPTED, asla REJECTED. |
| **TL6** | Bilinmeyen `list_format_version` gören yükleyici durur ve alarm verir; kabul etmez. |
| **TL7** | Ulusal listeyi yalnızca o namespace'in imza anahtarı imzalar; operatör vekâleti `operator.on_behalf_of` ile beyan edilir. |
| **TL8** | Tamga PID vermez; `pid_providers[]` Faz B boyunca boştur. Tamga'nın geçici kimlik attestation'ı ([[ADR-0011]]) bir `issuers[]` kaydıdır (`category: IDENTITY`, `class: QUALIFIED`) ve devlet PID sağlayıcısı atanınca `successor_id` ile süpersede edilir. |
| **TL9** | Şema `registered_at` ve `status_history.since` kalıcıdır; yeniden derleme bunları değiştiremez (ilk çapa zamanı). |
| **TL10** | Zincire geçiş, liste arşivinin replay'i ve eşdeğerlik testi geçmeden tamamlanmış sayılmaz. |
| **TL11** | Hiçbir liste, çapa günlüğü veya değişiklik günlüğü kişisel veri, credential veya credential hash'i içermez. |
| **TL12** | Çapa günlüğü yalnızca imzalı `checkpoint` ile arşivlenir: arşivlenen satırlar `archive/` altında kalır (silinmez), kontrol noktası `previous_hash` ile arşivin son satırına, `archive.sha256` ile arşiv dosyasına bağlanır ve arşive giden satırların ürettiği **son durumu (`state`)** taşır; yükleyici ilk satırdaki kontrol noktasının imzasını, `seq = seq_to + 1` koşulunu ve `state`'in varlığını doğrulamadan zinciri sürdürmez; arşivleme bir listenin ya da şemanın bilinirliğini asla düşürmez; tam geçmiş her zaman arşivlerden yeniden kurulabilir (TL10). |

---

# Güvenlik ve Mahremiyet Notları

- Bilinen zayıflama ([[ADR-0009]] K3): çapa tek operatör imzasına dayanır; operatör + issuer birlikte hareket ederse
  çift-konuşma mümkündür — herkese açık günlük, `CHANGELOG`, üç aylık şeffaflık raporu (G8) ve bağımsız denetim
  caydırır. Pilot sınırlar bildirimi madde 5–6.
- `list_uri` opak; `status_anchors` kurumu/kohortu kodlamaz (S8). IP loglanmaz (G2).

# Açık Konular

1. `wallet_providers[]` zincir karşılığı (ADR adayı).
2. ETSI 119 612 XML/XAdES projeksiyon üreteci (`apps/trust-publisher export-etsi`) — Faz 1 öncesi.
3. ≥2 kaydırmalı sertifika (S-6) ve KMS'te imza anahtarı — pilot öncesi.

# İlgili Dokümanlar

[[ADR-0009]] · [[ADR-0010]] · [[SPEC-BC-0001]] · [[SPEC-ID-0002]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] ·
[[ARCH-0003]] · [[FW-ARF-0001]] · [[FW-RB-0001]] · `docs/delivery/04-TRUST-LIST-FORMAT.md` (kaynak taslak) ·
`docs/delivery/05-MIGRATION-TO-CHAIN.md`

# Durum

**Active** — 1.0.0, 2026-09-24. `docs/delivery/04` ve `02-INHERITED-INVARIANTS` §D (BT1–BT10)'un kanonikleştirilmiş
hâli (DB-11; [[ADR-0009]] K2 "kabulle birlikte SPEC-TRUST-0001"). BT → TL kod eşlemesi birebir (BT9 → RB-ENF-04'e taşındı;
TL9 ve TL11 yeni: sahne 10'da bulunan hata ve DP1'in liste okuması).
