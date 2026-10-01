---
document_id: FW-ARF-0001
title: Tamga ARF — Mimari ve Referans Çerçevesi
category: Framework
domain: Architecture
status: Active
review_status: Completed
version: 0.1.3
created: 2026-09-24
last_updated: 2026-09-27
authors:
  - Tamga Network Engineering
language: tr
document_type: framework
audience:
  - institutions
  - regulators
  - integrators
  - engineers
  - ai-agents
stability: Evolutionary
maturity: Draft
tags:
  - framework
  - arf
  - reference-architecture
  - trust-model
  - eidas
  - eudi
  - tdt
keywords:
  - Tamga architecture and reference framework
  - ecosystem roles
  - trust anchor signed trust lists
  - phase B chainless
  - SD-JWT VC OpenID4VCI OpenID4VP
  - verification pipeline A-E
  - TDT-first
related:
  - FW-TF-0001
  - FW-RB-0001
  - FW-RB-0002
  - PM-PH-0001
  - ARCH-0001
  - ARCH-0003
  - ARCH-0005
  - ADR-0009
  - ADR-0010
  - SPEC-CRED-0002
  - SPEC-PROTO-0001
  - SPEC-PROTO-0002
  - SPEC-API-0001
  - SPEC-WALLET-0001
  - SPEC-SCHEMA-0001
  - SPEC-CRED-0003
  - SPEC-ID-0002
  - PM-ASSUR-0001
depends_on:
  - ADR-0009
  - ADR-0010
  - PM-PH-0001
summary: >
  Tamga Network'ün dışa dönük mimari ve referans çerçevesi. EUDI ARF'nin yapısal
  karşılığıdır: ekosistem rolleri, güven modeli (imzalı güven listeleri → zincir),
  kimlik ve tip tanımlayıcıları, yüksek seviye mimari, veri modeli, yaşam döngüleri,
  protokol profilleri, kanonik doğrulama hattı, fazlar (B → 0 → 1 → 2) ve standart
  uyum haritası. Yeni karar üretmez; kanonik SPEC/ADR/PM dokümanlarını derler ve
  her maddeyi kaynağına bağlar.
priority: Critical
---
> **Sürüm notu 0.1.2 (2026-09-26) — [[ADR-0013]] (D-CRED-5):** kimlik attestation'ı çift format (SD-JWT VC + ISO 18013-5 mdoc); §1.3 kapsamdan yalnızca yakın alan **taşıması** (BLE/NFC) dışarıda kaldı; §5.1 ve §9 uyum tablosu güncellendi. Aynı gün: kimlik ispatı (D-ASSUR-2, SPEC-ID-0003 Active) ve EAA sağlayıcı politikası (D-CRED-6) ✅.


# 0. Bu belge nedir, nasıl okunur

**Tamga ARF**, Tamga Network ekosistemine katılacak bir kurumun, düzenleyicinin veya
entegratörün okuyacağı **tek mimari referans**tır. EUDI ekosisteminde Avrupa Komisyonu'nun
ARF'si ne işe yarıyorsa bu belge Tamga için onu yapar: roller, güven modeli, arayüzler ve
yaşam döngüleri burada tanımlanır; teknik ayrıntı ilgili spesifikasyona bırakılır.

| Katman | AB'de | Tamga'da |
|---|---|---|
| Hukuk / yönetişim | eIDAS 2.0 + CIR'ler | [[FW-TF-0001]] Tamga Trust Framework |
| Mimari + roller | ARF v3.0.0 | **bu belge** |
| Katılımcı kuralları | ARF Annex 2 HLR | [[FW-RB-0001]] Tamga Rulebook |
| Belge tipi kuralları | Attestation Rulebook'lar | [[FW-RB-0002]] (eğitim) ve devamı |
| Teknik standartlar | ETSI / IETF / OpenID | Tamga SPEC-* profilleri |

Okuma sırası: §1 (ilkeler) → §2 (roller) → §3 (güven modeli) → §4 (mimari) → §6 (akışlar).
Bir kural gördüğünüzde yanındaki `DOC-ID/KOD` atfı bağlayıcı kaynaktır.

---

# 1. Kapsam ve ilkeler

## 1.1 Ne

Tamga Network, **Türk dünyası için dijital güven altyapısı**dır: kurumların (üniversite,
oda, kamu kurumu) kişilere verdiği belgelerin (diploma, öğrenci belgesi, üyelik) **elektronik
öznitelik belgesi (EAA)** olarak ihraç edilmesi, kişinin cüzdanında taşınması ve üçüncü
tarafların bunları saniyeler içinde, kaynağa sormadan doğrulaması ([[PM-PH-0001]]).

Tamga bir blockchain değildir; zincir, güven kaydının **taşıyıcılarından biridir** ve yalnızca
birden çok bağımsız imzacı olduğunda kurulur ([[ADR-0009]]).

## 1.2 Yedi ilke

| # | İlke | Kaynak |
|---|---|---|
| P1 | **Egemenlik-öncelikli:** her devlet kendi ulusal kayıtlarının tek yazarıdır; ağ üyeliği 2/3 oyla; sınır-ötesi tanıma tek taraflı | [[ADR-0002]], [[SPEC-BC-0001]]/N1 |
| P2 | **Kişisel veri hiçbir ortak kayıtta yok:** ne zincirde, ne listede, ne çapa günlüğünde, ne logda; credential hash'i bile | [[PM-TRUST-0001]], [[SPEC-BC-0001]]/DP1 |
| P3 | **Uyumlu ama bağımsız:** eIDAS/ARF/ETSI teknik katmanı aynen; hukuk/yönetişim katmanı Türk dünyası için yazılır | [[PM-PH-0001]], `docs/beta/06` |
| P4 | **TDT-first:** hiçbir tanımlayıcı, rol adı veya yapı "Tamga tek operatör" varsayımı taşımaz; Tamga her yerde geçici vekildir | [[ADR-0009]] K5, D-GOV-5 |
| P5 | **Zincir bir imzacı seçimidir, depolama seçimi değil:** güven çapası bugün imzalı listeler; ≥2 bağımsız validator operatörüyle zincir | [[ADR-0009]] K1–K4 |
| P6 | **Holder binding istisnasız:** her belge cihazın güvenli bölgesindeki bir anahtara bağlıdır; kopyalanamaz, devredilemez | [[SPEC-CRED-0002]]/C8, C16; [[SPEC-WALLET-0001]]/WL1 |
| P7 | **Devredilmek üzere tasarla:** her yumuşak yetkinin ölçülebilir devir eşiği (tripwire) vardır | [[PM-GOV-0001]]/G6 |

## 1.3 Kapsam dışı (bu sürüm)

ISO 18013-5 yakın alan **taşıması** (BLE/NFC — Faz 1; mdoc **formatı** kimlik için etkin, [[ADR-0013]]), PID ihracı (Tamga PID vermez; devlet slotu rezerve),
değer/ödeme katmanı ([[ADR-0003]] kancaları saklı), guardian escrow ([[SPEC-BC-0002]]), agent
delegasyonu uygulaması ([[SPEC-AGENT-0001]]), W3C VCDM/JSON-LD taşıyıcısı (D-SCHEMA-3).

---

# 2. Ekosistem rolleri

Rol seti EUDI ARF'den alınmıştır; her rolün Tamga'daki karşılığı, Faz B'de kimin üstlendiği ve
devirde ne olacağı aşağıdadır. Her ulusal listede bu rollerin her biri için bir **slot** vardır
([[ADR-0009]] K5.2).

| Rol (ARF) | Tanım | Faz B (bugün) | Faz 1 (devlet katıldı) | Kaynak |
|---|---|---|---|---|
| **Trusted List Scheme Operator (TLSO)** | Ulusal güven listesini derler, imzalar, yayınlar | Tamga (`operator.status: provisional`, `on_behalf_of: TR national authority`) | Ulusal otorite | [[ADR-0009]] K2, K5 |
| **Registrar** | Sağlayıcıları ve bağlı tarafları **kaydeder** (onaylamaz; yasal yetki ekosistem dışı) | Tamga (vekâleten) | Devlet Registrar'ı | `docs/beta/05` R-4; [[ADR-0002]] |
| **National Root CA** | Kurumsal X.509 sertifikalarının kökü | "TR National Root CA (provisional operator: Tamga)" — `ca_id` devirde değişmez | Devletin kökü veya ESHS | [[SPEC-ID-0002]]/XC1; [[ADR-0009]] K5.4 |
| **PID Provider** | Kişi kimlik verisi sağlayıcısı (LoA High) | **Boş slot** (`pid_providers: []`, BT8) | Devlet | [[PM-ID-0001]] |
| **Attestation Provider (Issuer)** | EAA ihraç eden kurum; sınıfı PUB / QUALIFIED / EAA | Üniversite (I2; demo'da "DEMO" etiketi) | Kurumlar + devlet kurumları (PUB) | [[ADR-0010]] K5; [[PM-ASSUR-0001]] Eksen B |
| **Authentic Source** | Özniteliğin kaynağı (OBS, MERSİS, NVİ) | Üniversite öğrenci bilgi sistemi (demo: portal veritabanı) | Aynı + kamu kaynakları | `docs/beta/06` §2/5 |
| **Wallet Provider** | Cüzdan çözümünü sunar, Wallet Unit Attestation (WUA) imzalar | Tamga (`wallet_providers[]`) | Tamga + sertifikalı üçüncü taraflar | [[SPEC-CRED-0001]] §4; R-7 |
| **Relying Party (Verifier)** | Belge isteyen ve doğrulayan taraf; kayıtlı, scope'lu | İşveren, kariyer merkezi (`verify.tamga.network` referans) | Aynı | [[SPEC-BC-0001]] RP Registry; [[SPEC-PROTO-0002]] |
| **Aracı doğrulayıcı (Intermediary)** | Bir RP adına sunum isteyen/doğrulayan hizmet; cüzdan asıl RP'yi gösterir, kapsam asıl RP'nin kaydına göre | `verify.tamga.network` (barındırılan); sonuca yalnızca RP beyanıyla, tek okuma | Aynı | [[ADR-0017]] HV1–HV6 |
| **Access CA / Registration Certificate Provider** | RP erişim sertifikası ve scope kaydı | Tamga (vekâleten) | Devlet | R-8 |
| **Kayıt Otoritesi (T2 üretici)** | Kişinin kimliğini yüz yüze veya lisanslı uzaktan doğrular (bootstrap'a özgü) | Üniversite kayıt masası / uzaktan kimlik doğrulama sağlayıcısı | PID Provider devralır | [[PM-ASSUR-0001]] §Kurum = RA; [[SPEC-ID-0003]] |
| **Holder / User** | Belgeyi cüzdanında taşıyan kişi | Öğrenci, mezun | Vatandaş | [[SPEC-WALLET-0001]] |
| **Validator Operator** | Zincir düğümü işleten bağımsız kurum | **Yok** (Faz B) | ≥2 bağımsız operatör → Faz 0 | [[ADR-0009]] K4 |

**Rol ayrımı kuralı:** Tamga barındırdığı hiçbir hizmette imzalama anahtarını tutmaz
([[PM-GOV-0001]]/G1); issuer servisi Tamga'da çalışsa da credential anahtarı kurumundur
(demo sapması S-1 istisnası açıkça beyan edilir).

---

# 3. Güven modeli

## 3.1 Güven çapası: nerede, kim imzalıyor

```
                  Faz B (bugün)                            Faz 0+ (≥2 bağımsız validator)
   ┌──────────────────────────────────┐          ┌─────────────────────────────────────┐
   │ trust.tamga.network              │          │ Besu / QBFT zinciri                 │
   │  lotl.jws      ← LOTL + NETWORK  │  replay  │  Governance · SchemaRegistry        │
   │  tl-tr.jws     ← ulusal liste    │ ───────▶ │  RootCARegistry · IssuerRegistry    │
   │  anchors.jsonl ← saatlik çapa    │          │  RelyingPartyRegistry · StatusList  │
   │  keys/         ← kök parmak izi  │          │  CrossRecognition                   │
   └──────────────────────────────────┘          └─────────────────────────────────────┘
              imzacı: 1 (Tamga, provisional)                imzacı: N (devletler/kurumlar)
```

- Listeler **sürümlü ve hash-zincirlidir**: `version` monoton, `previous_version_hash`, silme
  yok; `next_update` ≤ 90 gün; değişiklik ≤ 24 saatte yayınlanır; ≥2 kaydırmalı imza
  sertifikası ([[ADR-0009]] K2; ETSI TS 119 612 modeli).
- **Çapa günlüğü** (`anchors.jsonl`) saatlik imzalanır; status list yayınları ve şema
  `content_hash`'leri buraya çapalanır. Zincirdeki `publishList` çağrısının Faz B karşılığıdır.
- **Kök parmak izleri** `keys/root-fingerprints.json` + `tamga.network/trust-anchor` sayfasında;
  aynı değerler Trust Framework ve sözleşme eklerindedir ("Resmî Gazete" karşılığı).
- **Okuma arayüzü tek:** hiçbir bileşen liste dosyalarını doğrudan yorumlamaz; `TrustSource`
  arayüzü (liste veya zincir implementasyonu) üzerinden okur (BT4, [[ARCH-0003]]/CMP1).
  Zincire geçiş yalnızca implementasyonu değiştirir; belgeler, cüzdan ve doğrulama hattı aynıdır.

**Dürüst sınır:** Faz B'de çapa tek operatör imzasına dayanır; operatör + issuer birlikte
hareket ederse "çift konuşma" mümkündür, herkese açık günlük + şeffaflık raporu + denetim
bunu caydırır, imkânsız kılmaz ([[ADR-0009]] K3 "bilinen zayıflama"; pilot bildirimi madde 6).

## 3.2 Tanımlayıcılar (alan adından bağımsız, devirde değişmez)

| Tanımlayıcı | Formül | Not | Kaynak |
|---|---|---|---|
| `ca_id` | `keccak256(state_code ‖ root_fingerprint)` | Kök sertifika parmak izinden | [[SPEC-BC-0001]]/CA1 |
| `issuer_id` | `keccak256(state_code ‖ SHA-256(leafCert))` | Sertifika değişince yeni `issuer_id` + `successor_id` | [[SPEC-ID-0002]]/XC2, [[SPEC-CRED-0002]]/C15 |
| `vct` (tip kimliği) | `urn:tamga:<domain>:<Type>:<major>` — Faz 1'de `urn:tamga:<cc>:…` | Type Metadata **katalogdan** çözülür; `vct#integrity` zorunlu | [[ADR-0010]] K1–K4 |
| `schema_id` | `keccak256(vct)` | | [[ADR-0010]] |
| `category` (claim) | `urn:tamga:eaa:pub` \| `urn:tamga:eaa:qualified` | Yalnızca PUB / QUALIFIED issuer'lar; I1–I2 koymaz; verifier kayıtla çapraz kontrol eder (C4) | [[ADR-0010]] K5 |
| Status list URI | `https://status.tamga.network/{opak}` | Kurumu, yılı, kohortu kodlamaz | [[SPEC-CRED-0003]]/S8 |
| RP `client_id` | `x509_san_dns:<alan adı>` | | [[SPEC-PROTO-0002]] |
| Kişi | **Küresel tanımlayıcı yok** — belge başına `cnf` anahtarı, verifier başına farklı kopya | | [[SPEC-ID-0002]]/XC4, [[SPEC-WALLET-0001]]/WL5 |

Alan adı bir **hizmetin adresidir**, kimlik değildir (D-NAME-1). Kurum kendi alan adına geçerse
liste kaydındaki `issuer_url` değişir; `issuer_id` ve belgeler değişmez.

## 3.3 Güven seviyeleri (assurance) — iki eksen

| Eksen | Seviyeler | Nerede taşınır | Kaynak |
|---|---|---|---|
| **A — Holder / kimlik ispatı** | T0 anonim · T1 düşük (banka/GSM) · T2 önemli (belge + canlılık **veya** kayıt masası) · T3 yüksek (NES/mobil imza) — eIDAS Low/Substantial/High ile 1:1 | **Hiçbir yerde** credential'da değil; seviye **belge tipinin ön koşuludur** (diploma = T2+ ile bağlanmıştır); bağlama yolu issuer'ın denetim kaydında | [[PM-ASSUR-0001]] Eksen A; [[SPEC-PROTO-0001]]/PR7; `docs/beta/05` R-19 |
| **B — Issuer akreditasyonu** | I1 kayıtlı · I2 sözleşmeli · I3 akredite (HSM, denetim, sigorta) | Güven listesinde (`assurance`, `class`); QUALIFIED/PUB için credential'da `category` | [[PM-ASSUR-0001]] Eksen B; [[ADR-0010]] K5 |
| **W — Cüzdan güvenlik seviyesi** | W1 yazılım (desteklenmez) · W2 cihaz güvenli bölgesi (asgari) · W3 sertifikalı WSCD | WUA'da beyan; issuer ihraç öncesi doğrular | [[SPEC-WALLET-0001]]/WL3; ETSI TS 119 471 REQ-EAASP-4.2.1.2 |

Verifier kararı **"tip × issuer sınıfı"** politikasıdır; verifier ayrı bir `holder_assurance`
alanı görmez (eIDAS modeli). Yüksek riskli verifier ayrıca kimlik belgesi/PID ister.

## 3.4 Wallet Unit Attestation (WUA)

Cüzdan örneği, Wallet Provider'ın imzaladığı bir WUA taşır: cüzdan sürümü, anahtarın donanımda
tutulduğu, PIN/biyometri aktif. Issuer ihraç öncesi WUA'yı `lotl › wallet_providers[]` listesine
karşı doğrular ve WSCD seviyesini kontrol eder ([[SPEC-CRED-0001]] §4; DB-16). Yazılım
anahtarlı cüzdana (W1) pilotta belge verilmez; demo sapması S-9 açıkça beyan edilir.

---

# 4. Yüksek seviye mimari

## 4.1 Bileşenler

```
┌─────────────────────────────── TAMGA-NETWORK (public) ────────────────────────────────┐
│ trust-publisher (CLI)  →  trust.tamga.network   lotl.jws · tl-tr.jws · anchors.jsonl   │
│ @tamga-network/schemas (build) →  schemas.tamga.network  v1/catalogue.json · Type Metadata · JSON Schema │
│ @tamga-network/trust           →  TrustSource(list | chain)     ← tek okuma arayüzü            │
│ @tamga-network/sd-jwt · @tamga-network/issuer · @tamga-network/verifier · @tamga-network/wallet-core (kütüphaneler)     │
│ apps/wallet (Expo)  ·  apps/verify (referans verifier, verify.tamga.network)            │
│ contracts/ (Solidity, Faz 0)  ·  network/ (Besu genesis/izin, Faz 0)  ·  conformance/  │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────── TAMGA-PLATFORM (private) ──────────────────────────────┐
│ apps/issuer   issuer.tamga.network/{slug}  OpenID4VCI + status yayıncısı + admin API   │
│ apps/portal   portal.tamga.network/{slug}  kurum paneli + (demo) öğrenci portalı        │
│ status.tamga.network/{opak}  Status List Token'lar (issuer içinden servis edilir)       │
│ tenants/{slug}.json  ·  ops/ (nginx, systemd, deploy)                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Kütüphane/uygulama ayrımı: **issuer kütüphanesi public** (`@tamga-network/issuer`), **issuer servisi
private**. Kurumlar kendi issuer servisini yazabilir; kural seti
aynıdır ([[FW-RB-0001]] RB-AP). Paket kataloğu: [[ARCH-0005]] §1, `docs/delivery/11`.

## 4.2 Hizmet adresleri (tek sunucu, tek kök alan adı)

| Adres | Hizmet | Kiracı |
|---|---|---|
| `tamga.network` | tanıtım + `/trust-anchor` kök parmak izleri | — |
| `docs.tamga.network` | bu belge seti + spesifikasyonlar | — |
| `trust.tamga.network` | güven listeleri, çapa günlüğü, `keys/`, `CHANGELOG.md` | — |
| `schemas.tamga.network` | katalog `v1/catalogue.json`, Type Metadata, JSON Schema (değişmez dosyalar) | — |
| `issuer.tamga.network/{slug}` | OpenID4VCI (metadata `/.well-known/openid-credential-issuer/{slug}`) | kurum |
| `status.tamga.network/{opak}` | Status List Token | — (opak) |
| `portal.tamga.network/{slug}` | kurum operatör paneli | kurum |
| `verify.tamga.network` | referans verifier | — |
| `wallet.tamga.network` | Wallet Provider metadata, WUA anahtarları, Trust Mark | — |

Kaynak: D-NAME-1 v1.1, `docs/delivery/10-ALAN-ADLARI.md`.

## 4.3 Yön kuralları

1. Güven listesine **yalnızca** `trust-publisher` yazar; issuer'lar çapa **isteği** gönderir.
2. Verifier zinciri/listeyi doğrudan sorgulamaz; `TrustSource` önbelleğinden okur; bayat kaynak
   → `INDETERMINATE` ([[ARCH-0003]]/CMP1, CMP4).
3. Verifier doğrulama başına status çekmez; toplu ön çekim ([[SPEC-CRED-0003]]/S12).
   Cüzdan şemaları toplu çeker; sunum anında şema sunucusuna istek yapmaz ([[SPEC-WALLET-0001]]/WL9).
4. Hiçbir Tamga altyapısı IP loglamaz; loglar claim değeri ve `idx` taşımaz
   ([[PM-GOV-0001]]/G2, [[SPEC-API-0001]]/AP3–AP4).

---

# 5. Veri modeli

## 5.1 Belge (EAA) — SD-JWT VC Tamga profili

| Özellik | Değer | Kaynak |
|---|---|---|
| Format | IETF SD-JWT VC; `typ = dc+sd-jwt` | [[SPEC-CRED-0002]]/C13 |
| İmza | ES256 (P-256); `x5c` zorunlu (kök hariç) | C1, C7 |
| Holder binding | `cnf` zorunlu; sunumda KB-JWT zorunlu; KB-JWT `iat` ±300 s | C8, C16, C17 |
| Seçici açıklama | `_sd` + disclosures, `sha-256`, salt ≥128 bit, decoy yok, en fazla 2 seviye | C2–C6, C11 |
| Tip | `vct` URN + `vct#integrity` | [[ADR-0010]] |
| Kategori | `category` yalnızca PUB/QUALIFIED | [[ADR-0010]] K5 |
| Durum | `status.status_list {uri, idx}` (Token Status List, bits=2) | [[SPEC-CRED-0003]] |
| Kopyalar | Batch 10; her kopya farklı cihaz anahtarı; verifier başına yapışkan kopya | [[SPEC-PROTO-0001]]/PR6, [[SPEC-WALLET-0001]]/WL5 |
| Yasak içerik | Ulusal kimlik numarası hiçbir NETWORK şemasında yok | [[SPEC-SCHEMA-0002]]/E1, [[SPEC-SCHEMA-0003]]/SK6 |
| İkinci temsil (yalnız kimlik) | ISO 18013-5 mdoc: MSO + digest'ler, COSE_Sign1 issuerAuth (x5chain), `deviceKey` = `cnf`, MSO `status` | [[ADR-0013]] MD1–MD5; [[SPEC-PROTO-0002]] §4.5, PV11 |

## 5.2 Tip tanımı — Type Metadata + JSON Schema

Her tip için: Type Metadata (`vct`, `name`, `display` ≥ `tr-TR` + `en-US`, `claims` ile
seçici açıklama politikası, `extends`) + JSON Schema (`additionalProperties: false`). Yayınlanan
dosya asla değişmez; `content_hash = vct#integrity = SHA-256(yayınlanan baytlar)`; katalog
`vct → metadata_url + content_hash` eşlemesini taşır ([[SPEC-SCHEMA-0001]]/D1–D7).
Tip sürümleme: major URN'de; minor/patch yeni `metadata_url` + hash.

## 5.3 Güven listesi kayıtları

`lotl`: `national_lists[]` (TDT slotları, roller, `signing_keys`, `recognition`),
`schemas[]` (NETWORK tipleri), `wallet_providers[]`, `catalogue`, `operator`.
`tl-<cc>`: `root_cas[]`, `issuers[]` (`issuer_id`, `slug`, `class`, `assurance`, `category`,
`schema_authorizations[]` zaman pencereli, `status_history[]`, `successor_id`),
`relying_parties[]` (`client_id`, `scope[]`, `status`). Format: `docs/delivery/04-TRUST-LIST-FORMAT.md`
(SPEC-TRUST-0001 adayı, DB-11). Her alan bir kontrat kaydına eşlenir (`05-MIGRATION`).

## 5.4 Status List

Token Status List (IETF); liste kapasitesi ≥ 100.000, doluluk ≤ %80; `idx` rastgele; URI opak;
listeler tip dışında hiçbir ölçütle bölünmez; sabit aralıkla ve değişiklik olmasa da yayın;
"acil" yayın yok; status anahtarı credential anahtarından ayrı ([[SPEC-CRED-0003]]/S2–S11).
Pilot aralığı 60 dk (demo 2 dk, sapma S-2); iptalin verifier'da etkili olması hedefi ≤ 90 dk (B10).

---

# 6. Akışlar

## 6.1 Kurum kaydı (onboarding)

1. Kurum başvurur → Registrar tüzel kişiliği ve yetkiliyi doğrular (I2: MERSİS + imza yetkilisi;
   I3: + HSM, denetim, sigorta) → Trust Framework sözleşmesi ([[FW-TF-0001]] §5).
2. Kurum sertifika başvurusu (P-256) → National Root CA (provisional) yaprak sertifika →
   `issuer_id` türetilir; status anahtarı ayrı sertifika (K1).
3. TLSO `tl-tr` kaydını ekler: sınıf, assurance, `schema_authorizations` (allowlist, varsayılan
   kapalı — [[SPEC-BC-0001]]/I1), `issuer_url`, `slug`; liste yeniden imzalanır; `CHANGELOG`
   satırı; ≤ 24 saat.
4. Kiracı yapılandırması (`tenants/{slug}.json`) — kurum başına kod yok (D-NAME-1 §3).

## 6.2 İhraç (OpenID4VCI, pre-authorized + tx_code)

```
Kişi ──(portal/OBS oturumu veya e-posta)──▶ Issuer: offer üretir (tek kullanımlık, 5 dk / 72 sa)
Cüzdan ◀── QR / link (credential_offer_uri) ── ekranda veya e-posta
Cüzdan ──▶ /{slug}/token  (pre-authorized_code + tx_code — farklı kanaldan; 3 deneme)
Cüzdan ──▶ /{slug}/nonce → c_nonce
Cüzdan ──▶ /{slug}/credential  (proofs.jwt ×10, her biri ayrı cihaz anahtarı; WUA)
Issuer: WUA doğrula → şema doğrula → SD-JWT VC ×10 imzala → status idx tahsis → kaydet (PR7)
Kişi ◀── bildirim "belgeniz bir cüzdana eklendi; siz değilseniz …"
```

Kaynak: [[SPEC-PROTO-0001]] PR1–PR10; offer sınıfları ve bağlama→T eşlemesi
`docs/delivery/03-ISSUANCE-BINDING.md`; kimlik ispatı yolları [[SPEC-ID-0003]].

**Kimlik ispatı kuralı:** issuer, tipin gerektirdiği seviyeyi ihraçtan **önce** sağlar
(öğrenci belgesi T1; diploma T2+). T3 yalnızca authorization code veya yüz yüze; çevrimiçi
pre-authorized ile LoA High verilmez (ETSI TS 119 472-3 GEN-REQ-4.1).

## 6.3 Sunum (OpenID4VP, DCQL, cross-device)

```
Verifier ──▶ imzalı istek nesnesi (client_id = x509_san_dns:…, DCQL, nonce, response_mode=direct_post.jwt)
Cüzdan: RP kaydını TrustSource'tan çöz (scope) → istenen alanları göster → aşırı talep uyarısı
        → PIN/Face ID → yapışkan kopyayı seç → KB-JWT (nonce, aud, sd_hash) → şifreli yanıt
Verifier: T0 + A–E hattı → ACCEPTED | REJECTED | INDETERMINATE + checks_performed/skipped
```

Kaynak: [[SPEC-PROTO-0002]] PV1–PV10; [[SPEC-WALLET-0001]] §5.

## 6.4 Kanonik doğrulama hattı (T0 + A–E)

| Adım | Ne | Sonuç |
|---|---|---|
| **T0** | Güven kaynağı tazeliği (`freshness.healthy`) | bayat → INDETERMINATE |
| **A** | Yapısal: `~` ayrıştırma, KB-JWT var, `x5c` zinciri → kök çapası (`ca_id`), `issuer_id` yaprak parmak izinden, disclosure digest'leri, KB-JWT `nonce/aud/sd_hash/iat` | |
| **B** | Tip: `vct` + `vct#integrity` katalog/önbellekle eşleşir; JSON Schema | |
| **C** | Güven: `C1 isCredentialAcceptable(issuer_id, iat)`, `C2` şema yetkisi (atlanamaz, AP8), `C3` tanıma, `C4` `category` ↔ kayıt sınıfı | |
| **D** | Durum: status list ön çekimi, `idx` biti, liste çapası (`contentHash`, `version`) | |
| **E** | Politika: tip × issuer sınıfı, RP scope ⊇ istenen alanlar (AP6), denetim kaydı (E4, red için de) | |

Üç değerli sonuç ([[ARCH-0003]]/CMP9): **INDETERMINATE** asla REJECTED ile aynı kovaya konmaz
(AP2); kullanıcıya "geçersiz" ile "doğrulanamadı" farklı gösterilir ([[SPEC-CRED-0003]]/S14).
Zaman kuralı: `C1/C2` belgenin `iat`'ına bakar — kapanan kurumun eski belgeleri geçerli kalır
(D-BC-3, [[SPEC-API-0001]]/AP11).

## 6.5 İptal ve askıya alma

| Olay | Mekanizma | Etki |
|---|---|---|
| Belge iptali | Issuer `idx` bitini REVOKED yapar → sonraki sabit aralık yayını → çapa | ≤ 90 dk içinde verifier'da RED |
| Kurum askıya alma (SUSPENDED) | Liste kaydı `status_history` | Yeni ihraç durur; eski belgeler `iat`'a göre geçerli kalır |
| Kurum iptali (REVOKED) | Liste kaydı + `successor_id` | Halef status listeyi yayınlayabilir ([[SPEC-BC-0001]]/I4) |
| Sertifika rotasyonu | Yeni `issuer_id` + `successor_id` | Eski belgeler eski kayıtla doğrulanır |
| Cüzdan birimi ihlali | WUA iptali (Wallet Provider) | Issuer yeni ihraç reddeder; verifier politikaya göre |

## 6.6 Cihaz değişimi ve kurtarma

Anahtarlar cihazdan çıkmaz; yedek yalnızca belge listesi ve şifreli belgeleri taşır; yeni cihazda
belgeler **yeniden ihraç** edilir ([[SPEC-WALLET-0001]]/WL1–WL2, WL10). Tamga kurtarma anahtarı
tutmaz. Ayrıntı: `docs/beta/11-cuzdan-anahtar-modeli.md`; açık tasarım soruları `docs/beta/12`.

---

# 7. Yaşam döngüleri

| Varlık | Durumlar | Kural |
|---|---|---|
| Issuer kaydı | `ACTIVE → SUSPENDED → ACTIVE` · `→ REVOKED (+successor)` · `→ RETIRED` | Geçmiş silinmez; ETSI `granted/withdrawn` projeksiyonu ([[SPEC-ID-0002]] §8.1) |
| Root CA | `ACTIVE → RETIRED` (operasyon ve eski belgeler sürer) · `→ REVOKED` (belgeler düşer) | [[SPEC-BC-0001]]/CA2 |
| Şema (tip) | `ACTIVE → DEPRECATED` (doğrulanabilir kalır) | SC3; `vct`/hash asla güncellenmez (SC1) |
| Şema yetkisi | zaman penceresi `[from, to)` | C2 `iat`'a göre (I3) |
| Belge | ihraç → (askı) → iptal · süre dolumu (`exp`, öğrenci belgesi ≤ 90 gün) | E4, E9 |
| Wallet Solution / Unit | Solution: sertifikalı → askıda → iptal; Unit: aktif → iptal | Ayrı state machine (ARF §4.6; `docs/beta/05` R-33, açık) |
| RP kaydı | `ACTIVE → SUSPENDED → REVOKED`; scope güncellenebilir | AP6 |
| Liste sürümü | monoton; `next_update` geçerse tüm cevaplar UNKNOWN | BT2, BT5 |

---

# 8. Fazlar ve geçiş

| Faz | Güven çapası | Validator | Kim yönetir | Giriş koşulu |
|---|---|---|---|---|
| **B — zincirsiz beta** (bugün) | İmzalı listeler + çapa günlüğü | — | Tamga (provisional TLSO/Registrar) | ADR-0009 kabul (2026-09-24) |
| **0 — bootstrap** | Besu/QBFT | ≥2 bağımsız operatör | Vakıf teknik kurulu | Yazılı validator kabulü; replay + eşdeğerlik testi geçti |
| **1 — devlet katılımı** | Zincir | Devletler (eşit oy) | Konsey (2/3) | İlk devlet validator'ı üretimde |
| **2 — kurumsal genişleme** | Zincir | + kurumlar | Konsey | D-GOV-2 eşikleri |

**Geçiş sözleşmesi (Faz B → 0):** liste arşivi kontrat çağrılarına replay edilir;
`TrustSource(list)` ve `TrustSource(chain)` aynı uyum vektörlerine aynı cevabı verir
(`conformance/`); `ca_id`/`issuer_id`/`vct` değişmez; devir = yalnızca `operator` alanı
([[ADR-0009]] K5, K7; `docs/delivery/05-MIGRATION-TO-CHAIN.md`).

---

# 9. Standart uyum haritası

| Bileşen | Standart | Tamga profili | Durum |
|---|---|---|---|
| Güven listesi | ETSI TS 119 612 (+ 119 602 LoTE) | Faz B listeleri; ETSI XML projeksiyonu | ✅ / projeksiyon planlı |
| Kurumsal kimlik | X.509 RFC 5280; ETSI EN 319 401 | [[SPEC-ID-0002]] | ✅ |
| EAA sağlayıcı politikası | ETSI TS 119 471 | [[FW-RB-0001]] RB-AP; WUA/WSCD ön doğrulama ([[SPEC-PROTO-0001]] §11.1) | ✅ (D-CRED-6) |
| Belge formatı | IETF SD-JWT VC; ETSI TS 119 472-1 | [[SPEC-CRED-0002]]; `category` | ✅ |
| İhraç | OpenID4VCI 1.0 (HAIP); ETSI TS 119 472-3 | [[SPEC-PROTO-0001]] | ✅ |
| Sunum | OpenID4VP 1.0, DCQL | [[SPEC-PROTO-0002]] | ✅ |
| İptal | IETF Token Status List; CIR 2024/2977 Art. 3 | [[SPEC-CRED-0003]] | ✅ |
| Kimlik ispatı | ETSI TS 119 461; CIR 2025/1566 | [[SPEC-ID-0003]] (T1–T3 eşlemesi) | ✅ (D-ASSUR-2) |
| Cüzdan | ARF WSCD, CIR 2024/2979 | [[SPEC-WALLET-0001]] | ✅ |
| Tip kataloğu / rulebook | ARF §5.5, Annex 2 Topic 12, PID Rulebook deseni | [[SPEC-SCHEMA-0001]]/0002 + [[FW-RB-0002]] | ✅ |
| mdoc formatı | ISO/IEC 18013-5 (MSO, COSE), 18013-7 (OpenID4VP) | [[ADR-0013]]: kimlik için çift format; `packages/mdoc` | ✅ (kimlik) |
| Yakın alan taşıması | ISO/IEC 18013-5 BLE/NFC | Faz B köprü: [[ADR-0012]] (geçiş kartı B, ters başlatılan OpenID4VP C) → Faz 1 BLE (Apple Developer hesabı + EAS) | 🟡 |
| Eğitim semantiği | ELM v3 / Europass, ISCED-F, EQF | [[RS-SCHEMA-0001]], [[SPEC-SCHEMA-0002]] | ✅ |

Ayrıntılı kural kıyası (40 kural, hüküm etiketleriyle): `docs/beta/05-kurallar-en-iyi-pratik.md`.

---

# 10. Güvenlik ve mahremiyet ilkeleri (özet)

1. Ortak kayıtlarda kişisel veri yok (P2); loglarda claim değeri ve `idx` yok.
2. Issuer izlenemezliği: batch 10, verifier başına yapışkan kopya (per-RP unlinkability);
   **issuer linkability artık risktir** (ZKP bekler; dürüstçe beyan edilir — GENEL-ANALIZ 4.A/2).
3. Status yayını gürültülü, sabit aralıklı; iptal zamanı dışarı sızmaz.
4. Her sunum PIN/biyometri; aşırı talep uyarısı; sunum günlüğü cihazda kalır.
5. IP loglanmaz; şema/status istatistikleri yalnızca toplu, kova ≥ 50.
6. Anahtar ayrımı: credential (çevrimdışı/HSM) ≠ status (çevrimiçi) ≠ liste imzası.
7. Tedarik zinciri: paketlerde `postinstall` yok; yayın yalnızca CI + OIDC; provenance ([[ARCH-0005]]/P1–P3).

---

# 11. Bilinen sınırlar ve artık riskler

| # | Sınır | Nerede beyan edilir |
|---|---|---|
| L1 | Faz B çapası tek operatör imzasına dayanır | Pilot sınırlar bildirimi madde 5–6 |
| L2 | İptal en geç ~90 dk'da etkili | Bildirim madde 7 |
| L3 | Issuer linkability (aynı issuer, farklı verifier'lar birleşirse) | Whitepaper "artık risk" |
| L4 | Demo: anahtar yazılımda (S-9), issuer anahtarı Tamga'da (S-1) | `docs/delivery/09` §6 — pilotta kapanır |
| L5 | Wallet Solution seviyesinde state machine henüz yok | R-33 (açık) |
| L6 | Cihaz değişiminde "onaylı devir" tasarımı açık | `docs/beta/12` |

---

# İlgili dokümanlar

[[FW-TF-0001]] · [[FW-RB-0001]] · [[FW-RB-0002]] · [[PM-PH-0001]] · [[ARCH-0001]] · [[ARCH-0003]] ·
[[ARCH-0005]] · [[ADR-0002]] · [[ADR-0009]] · [[ADR-0010]] · [[SPEC-ID-0002]] · [[SPEC-ID-0003]] ·
[[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-API-0001]] · [[SPEC-WALLET-0001]] · [[PM-ASSUR-0001]] ·
[[PM-GOV-0001]] · [[DECISIONS]] · [[INVARIANTS]] · [[GLOSSARY]]

# CHANGELOG

- **0.1.3 (2026-09-27)** — ADR-0015/0016/0017 kabulü: aracı doğrulayıcı rolü (§2); tek güven arayüzü cüzdanı da kapsar (§3.1, D-TRUST-1).
- **0.1.0 (2026-09-24)** — İlk taslak. ADR-0009/0010 sonrası kanonik kararların derlemesi;
  DB-12 kapsamında. Onay bekliyor.

# Durum

**Active** — 0.1.0, 2026-09-24 kabul (D-GOV-6 / DB-12). Onay kaydı operatörün arşivindedir.
"çerçeve belge seti yayın kuralı").
