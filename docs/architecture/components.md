---
document_id: ARCH-0003
title: "Bileşen mimarisi"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-07
summary: >
  Zincirin üstünde çalışan uygulama bileşenlerini tanımlar. Merkezî bulgu:
  doğrulama okuma seti 3'ten 5'e çıktığı için indeksleyici artık opsiyonel bir
  optimizasyon değil ZORUNLU bir bileşendir; QBFT'nin anında kesinliği sayesinde
  reorg mantığı gerekmez, bu da onu radikal biçimde basitleştirir. Ayrıca belge veren
  servisi (OBS adaptörü, HSM imzalama, status yayın işi), doğrulayıcı servisi
  (birleşik doğrulama hattı, zorunlu ön çekim), şema ve status dağıtımı, cüzdan,
  bileşenler arası güven sınırları, hangi anahtarın nerede durduğu envanteri ve
  bir DEGRADASYON MATRİSİ — hangi bileşen düştüğünde neyin çalışmaya devam
  ettiği.
---

# Kapsam

> **Bugün:** Tamga Network zincirsiz çalışır; güven verisi imzalı [[t:trust-list|güven listelerinden]] ve çapa günlüğünden gelir
> ([[ADR-0009]], [[SPEC-TRUST-0001]]). Bu belge zincir aşamasının bileşenlerini de anlatır; liste aşamasında indeksleyicinin
> yerini `TrustSource` alır ([[ADR-0015]]), doğrulama hattı ([[SPEC-API-0001]]) aynıdır.

[[ARCH-0001]] zincirin **topolojisini**, [[ARCH-0002]] **kurulumunu** anlatır.
Bu doküman zincirin **üstünde** çalışan uygulama bileşenlerini tanımlar: ne
yaparlar, birbirlerine nasıl bağlanırlar, hangi anahtarı tutarlar ve biri
düştüğünde ne olur.

Fiziksel yerleşim, donanım ve operasyon [[ARCH-0004]]'tedir. SDK paketleri
[[ARCH-0005]]'tedir.

---

# 1. Bileşen Haritası

```
┌──────────────────────────────────────────────────────────────────┐
│                        ZİNCİR (ARCH-0001)                        │
│   Governance · RootCA · Schema · Issuer · Recognition · Status   │
└───────────────────────────┬──────────────────────────────────────┘
                            │ event akışı (yalnızca okuma)
                            ▼
                  ┌──────────────────────┐
                  │     İNDEKSLEYİCİ     │  ← ZORUNLU (§2)
                  │  olay → yerel görünüm│
                  └──────┬───────────┬───┘
                         │           │
        ┌────────────────┘           └────────────────┐
        ▼                                             ▼
┌───────────────────┐                       ┌────────────────────┐
│  ISSUER SERVICE   │                       │  VERIFIER SERVICE  │
│  (üniversite)     │                       │  (işveren)         │
└────┬─────────┬────┘                       └─────────┬──────────┘
     │         │                                      │
     │         │ yayın                          çekim │
     ▼         ▼                                      ▼
 ┌───────┐ ┌────────────────┐            ┌────────────────────────┐
 │  OBS  │ │ status.<issuer>│◀───────────│  ön çekim önbelleği    │
 │adaptör│ │  (CDN)         │            └────────────────────────┘
 └───────┘ └────────────────┘                         ▲
                                                      │
                            ┌─────────────────────────┘
                            │
                  ┌─────────────────────┐
                  │ schemas.tamga.network│  (statik + CDN)
                  └─────────────────────┘

        OpenID4VCI ▲                    ▼ OpenID4VP
               ┌────────────────────────────┐
               │ CÜZDAN (ör. Tamga Wallet)  │
               └────────────────────────────┘
```

**Yön kuralı:** Hiçbir uygulama bileşeni zincire **yazmak zorunda değildir**
— tek istisna belge veren servisinin status yayın işidir (`publishList`) ve
operatör panelinin ulusal kayıt işlemleridir. Okuma **her zaman**
indeksleyiciden yapılır, RPC'den değil.

---

# 2. İndeksleyici — Zorunlu Bileşen

## 2.1 Neden zorunlu

[[SPEC-BC-0001]] §11.2 uyarınca tek bir [[t:credential|belgeyi]] doğrulamak **beş zincir
okuması** gerektiriyor:

1. `isCredentialAcceptable(issuerId, iat)` — `isValidIssuer` ise belge verme sorusudur
2. `isCredentialSchemaAcceptable(issuerId, schemaId, iat)`
3. `schemaRegistry.matchesContentHash`
4. `isRecognizedBy`
5. `statusListRegistry.matchesContentHash`

`TrustQueries.verifyAll()` beşini tek çağrıda topluyor ama yine de bir RPC turu demek.

Bir işveren günde 500 başvuru doğruluyorsa, bu 500 senkron RPC çağrısıdır ve
her biri doğrulama gecikmesine doğrudan eklenir. Daha kötüsü: RPC node'a olan
bağımlılık, doğrulamayı zincirin erişilebilirliğine bağlar.

**Karar:** İndeksleyici opsiyonel bir optimizasyon değildir. Uyumlu bir
[[t:verifier]] servisi zinciri **doğrudan sorgulamaz.**

## 2.2 QBFT anında kesinlik — indeksleyiciyi basitleştiren şey

Bu, tasarımın en önemli kolaylığıdır ve kolayca gözden kaçar.

QBFT'de bir blok imzalandığı anda **kesindir** ([[ADR-0001]]). Nakamoto
konsensüsündeki gibi olasılıksal kesinlik ve zincir yeniden düzenlemesi
(reorg) **yoktur.**

Sonuçları:

| Nakamoto zincirinde gerekir | Tamga'da gerekmez |
|---|---|
| N onay bekleme | Blok gelir gelmez uygulanır |
| Reorg tespiti ve geri alma | Yok |
| Fork seçimi | Yok |
| "Sallanan" veri için geçici durum | Yok |

İndeksleyici böylece **basit bir ileriye dönük yansıtıcı** olur: olayı al,
yerel tabloyu güncelle, ilerle. Geri alma mantığı yazılmaz.

**Ama:** Kontratlar yükseltilebilirdir (UUPS). Bir yükseltme olay şemasını
değiştirebilir. İndeksleyici, `Upgraded(address)` olayını dinlemeli ve bilinmeyen
bir implementasyon gördüğünde **durup alarm vermelidir** — sessizce yanlış
yansıtmaktansa durmak.

## 2.3 Dinlenen olaylar

| Kontrat | Olay | Yansıtılan tablo |
|---|---|---|
| Governance | `StateAdmitted`, `StateRemoved`, `StateWithdrawn`, `DelegateKeysSet` | `states`, `delegates` |
| RootCARegistry | `RootCARegistered`, `RootCASuspended`, `RootCARevoked` | `root_cas` |
| IssuerRegistry | `IssuerRegistered`, `IssuerSuspended`, `IssuerRevoked`, `IssuerRenewed` | `issuers` |
| IssuerRegistry | `SchemaAuthorizationSet` | `issuer_schema_auth` |
| SchemaRegistry | `SchemaRegistered`, `SchemaDeprecated`, `SchemaRevoked` | `schemas` |
| CrossRecognition | `RecognitionSet`, `IssuerBlocklisted` | `recognition`, `blocklist` |
| StatusListRegistry | `ListRegistered`, `ListPublished`, `ListRetired` | `status_anchors` |
| (hepsi) | `Upgraded` | `contract_versions` + **alarm** |

## 2.4 Veri modeli (özet)

```sql
CREATE TABLE issuers (
  issuer_id        BYTEA PRIMARY KEY,
  state_code       CHAR(2)   NOT NULL,
  category         SMALLINT  NOT NULL,
  assurance        SMALLINT  NOT NULL,
  parent_ca        BYTEA     NOT NULL,
  status           SMALLINT  NOT NULL,
  valid_from       TIMESTAMPTZ NOT NULL,
  valid_until      TIMESTAMPTZ NOT NULL,
  successor_id     BYTEA,
  last_block       BIGINT    NOT NULL
);

CREATE TABLE issuer_schema_auth (
  issuer_id  BYTEA NOT NULL,
  schema_id  BYTEA NOT NULL,
  allowed    BOOLEAN NOT NULL,
  last_block BIGINT NOT NULL,
  PRIMARY KEY (issuer_id, schema_id)
);

CREATE TABLE status_anchors (
  list_id      BYTEA PRIMARY KEY,
  issuer_id    BYTEA NOT NULL,
  list_uri     TEXT  NOT NULL,
  content_hash BYTEA,
  version      BIGINT NOT NULL,
  published_at TIMESTAMPTZ,
  status       SMALLINT NOT NULL,
  last_block   BIGINT NOT NULL
);

-- Tek satırlık ilerleme kaydı
CREATE TABLE sync_state (
  id            SMALLINT PRIMARY KEY DEFAULT 1,
  last_block    BIGINT NOT NULL,
  last_block_at TIMESTAMPTZ NOT NULL,
  healthy       BOOLEAN NOT NULL DEFAULT TRUE,
  halt_reason   TEXT
);
```

**Kişisel veri yoktur.** İndeksleyici zincirin aynasıdır; zincir kişisel veri
tutmaz ([[PM-TRUST-0001]]), dolayısıyla ayna da tutmaz.

## 2.5 Tazelik ve bayatlık

İndeksleyici bir **önbellektir**, dolayısıyla bayatlayabilir.

| Kural | Değer |
|---|---|
| Kabul edilen gecikme | ≤ 3 blok |
| Bayat sayılma eşiği | `now - last_block_at > 60 sn` |
| Bayatken davranış | Doğrulayıcı "DOĞRULANAMADI" döndürür, "geçersiz" değil |

Son satır [[SPEC-CRED-0003]] §7.1 ve [[SPEC-SCHEMA-0001]] §7'deki aynı ayrımın
buradaki uygulamasıdır: *"bu diploma sahte"* ile *"şu an kontrol edemiyorum"*
farkı, bir insanın işe alınıp alınmamasıdır.

**Yüksek riskli doğrulamalar** (resmî işlem) indeksleyiciyi atlayıp doğrudan
`TrustQueries.verifyAll()` çağırabilmelidir. Bu bir kaçış kapağıdır, varsayılan
değil.

---

# 3. Belge veren Service

## 3.1 Katmanlar

```
┌─────────────────────────────────────────────┐
│  Operatör Paneli (web)                      │  kurum personeli
├─────────────────────────────────────────────┤
│  API katmanı — OpenID4VCI uçları            │  cüzdanlar
├─────────────────────────────────────────────┤
│  Credential Fabrikası                       │  SD-JWT VC üretimi
│    · disclosure üretimi (SPEC-CRED-0002)    │
│    · şema doğrulaması (SPEC-SCHEMA-0001)    │
│    · türetilmiş claim hesabı                │
├──────────────┬──────────────┬───────────────┤
│ OBS Adaptörü │ İmza Modülü  │ Status Yayıncı│
│  (kaynak veri│  (HSM/KMS)   │  (cron, 1sa)  │
└──────────────┴──────────────┴───────────────┘
```

## 3.2 OBS adaptörü

Üniversitenin öğrenci bilgi sistemine bağlanan tek nokta. Üç mod:

| Mod | Ne zaman | Not |
|---|---|---|
| **Toplu CSV** | Pilot başlangıcı | En düşük entegrasyon riski, **önerilen** |
| REST çağrısı | OBS API veriyorsa | Kimlik doğrulama ve hız sınırı gerekir |
| Salt-okunur DB view | Kurum izin verirse | En taze, ama en müdahaleci |

**Kritik kural:** Adaptör, [[SPEC-SCHEMA-0002]] §6'daki alan eşlemesini uygular
ve **eşlemede karşılığı olmayan program için belge vermeyi durdurur** — tahmini
ISCED-F kodu üretmez. Yanlış kod, imzalı ve kırk yıl yaşayan bir belgede
düzeltilemez.

## 3.3 İmza modülü

- Belge imzalama anahtarı **HSM/KMS'te**, dışa çıkmaz.
- [[t:status-list]] imzalama anahtarı **ayrıdır** ([[SPEC-CRED-0003]] §3.4) —
  her yayın aralığında imza attığı için çevrimiçi durmak zorunda.
- İkisi aynı X.509 zincirine bağlıdır ([[SPEC-ID-0002]]).

## 3.4 Status yayıncı

Sabit aralıklı iş ([[SPEC-CRED-0003]] §5.2). Altı adım, sırası bağlayıcı:
bekleyen değişiklikleri al → bitstring güncelle → sıkıştır → imzala →
**CDN'e yaz** → `publishList` (zincir).

**Değişiklik olmasa da çalışır.** Bu, isteğe bağlı değildir; koşullu yayın,
zincire yazma anının kendisi üzerinden iptal zamanlamasını sızdırır.

## 3.5 Operatör paneli

Kurum personelinin kullandığı yüz. Asgari ekranlar: mezun listesi ve belge
verme kuyruğu, tekil belgeyi yeniden verme, iptal/askı işlemleri, şema yetkisi
görünümü (salt okunur — yetkiyi devlet verir, [[SPEC-BC-0001]] §3.4), denetim
kaydı.

---

# 4. Doğrulayıcı Service

## 4.1 Birleşik doğrulama hattı

> **Kanonik kayıt defteri [[SPEC-API-0001]] §1'dedir.** Aşağıdaki liste özet
> görünümdür; `A7` ve `A8` orada eklenmiştir. Kod anlamları kararlıdır
> ([[SPEC-API-0001]]/AP1).

Dört spesifikasyondaki adımlar tek sırada. Herhangi bir adımın başarısızlığı
belgenin reddedilmesidir; **belirsizlik reddedilme değildir** (§2.5).

```
 A. FORMAT KATMANI          → SPEC-CRED-0002 §8
    A1 ~ ile böl, KB-JWT var mı
    A2 alg=ES256, typ=dc+sd-jwt, x5c var mı
    A3 x5c zinciri + JWT imzası
    A4 _sd_alg = sha-256
    A5 her disclosure: ÖNCE hash, SONRA çöz; _sd'de eşleşiyor mu
    A6 KB-JWT: imza, aud, nonce, iat, sd_hash

 B. ŞEMA KATMANI            → SPEC-SCHEMA-0001 §7
    B1 vct + vct#integrity oku
    B2 schemaId = keccak256(vct); indeksleyicide kayıtlı mı
    B3 Type Metadata al (önbellek → URL → registry)
    B4 bütünlük: hash == vct#integrity == zincir contentHash
    B5 extends zinciri
    B6 JSON Schema uyumu

 C. GÜVEN KATMANI           → SPEC-BC-0001 §11.2
    C1 isCredentialAcceptable(issuerId, iat)
    C2 isCredentialSchemaAcceptable(issuerId, schemaId, iat)   ← atlanamaz
    C3 isRecognizedBy(kendi devletim, issuer)

 D. İPTAL KATMANI           → SPEC-CRED-0003 §7
    D1 status.status_list oku
    D2 Status List Token ön çekim önbelleğinden al
    D3 token imzası + sub eşleşmesi
    D4 tazelik (exp / ttl)
    D5 zincir çapası: hash + version
    D6 bits=2 ile idx oku → 0x00 dışı ise RED

 E. POLİTİKA KATMANI        → yerel
    E1 assurance eşiği (ör. category=EDUCATION && assurance>=I2)
    E2 istenen claim'ler açıklanmış mı
    E3 RP scope aşımı yok mu
    E4 denetim kaydı
```

## 4.2 Zorunlu ön çekim

[[SPEC-CRED-0003]] §9.1: doğrulayıcı **doğrulama başına** İptal listesi Token
çekmez. Zamanlanmış toplu ön çekim kullanır.

Sebep: her doğrulamada `GET <status uri>` yapılırsa, üniversite kaynak IP'den
mezunlarının hangi işverenlere başvurduğunu öğrenir — kâğıt diplomada olmayan
yeni bir takip kanalı.

`@tamga-network/verifier` bunu **varsayılan** yapar ([[ARCH-0005]]).

## 4.3 Politika motoru

Doğrulama sonucu bir boolean değil, bir **karar nesnesidir**:

```json
{
  "outcome": "ACCEPTED | REJECTED | INDETERMINATE",
  "failed_step": "C2",
  "issuer": { "id": "0x…", "category": "EDUCATION", "assurance": "I2" },
  "schema": { "id": "0x…", "version": "1.0.0" },
  "disclosed_claims": ["is_graduate", "eqf_level", "…"],
  "status": { "value": "VALID", "list_version": 8412, "token_age_sec": 1830 },
  "chain_freshness": { "last_block": 918273, "age_sec": 4 },
  "evaluated_at": "2026-09-09T09:12:44Z"
}
```

`INDETERMINATE`, `REJECTED`'dan **ayrı** bir sonuçtur ve kullanıcı arayüzünde
ayrı gösterilmelidir.

---

# 5. Şema ve Status Dağıtımı

İkisi de aynı desende: **statik dosya + CDN + zincir çapası.**

| | `schemas.tamga.network` | `status.<issuer-domain>` |
|---|---|---|
| Kim işletir | Vakıf (ilk aşama) | Her belge veren ayrı |
| İçerik | Type Metadata + JSON Schema | İmzalı İptal listesi Token |
| Değişim | Yalnızca yeni sürüm (değişmez URL) | Her yayın aralığında yeni sürüm (2 dakika) |
| Önbellek | `immutable`, süresiz | `ttl`/`exp` claim'leri belirleyici |
| Uygulama sunucusu | Hayır | Hayır (yayın işi ayrı) |
| Kesinti etkisi | Yeni tip öğrenilemez | 6 saate kadar önbellekten devam (`exp`) |

**Ortak ilke:** İkisi de doğrulamanın **kritik yolunda değildir** — çünkü
bütünlük hash'i sayesinde süresiz önbelleklenebilirler. Bu, SLO'larını ciddi
ölçüde ucuzlatır ([[ARCH-0004]]).

---

# 6. Cüzdan

Ağın kurallarına uyan her cüzdan bu katmanları taşır. Örnek: Tamga Wallet — ağın ilk cüzdanı; bir şirketin ayrı ürünüdür
([[ADR-0042]]).

| Katman | Sorumluluk |
|---|---|
| Anahtar | Cihaz güvenli bölgesi (Secure Enclave / StrongBox), dışa çıkmaz |
| Depo | Yerel şifreli veritabanı — belgeler cihazda |
| Protokol | OpenID4VCI (alma), OpenID4VP (gösterme) |
| Onay ekranı | Kullanıcı **ne paylaştığını alan alan görür** |
| Şema önbelleği | Kurulumda ve tip eklendiğinde **toplu** çekilir, kullanım anında değil |
| Yedek | Sunucuda şifreli; sunucu çözemez |

**Toplu şema çekimi neden:** Cüzdan her sunumda şemayı sunucudan çekerse,
`schemas.tamga.network` "kim hangi tip belgeyi ne zaman kullandı" bilgisini
toplar ([[SPEC-SCHEMA-0001]] Güvenlik Notları). Aynı mantık doğrulayıcı ön
çekimiyle (§4.2) simetriktir.

---

# 7. Güven Sınırları

```
    ┌ GÜVENİLİR ────────────────────────────────┐
    │  zincir · indeksleyici · issuer HSM       │
    └───────────────────────────────────────────┘
              ▲                    ▲
    ══════════╪════════════════════╪══════════════  güven sınırı
              │                    │
    ┌ YARI GÜVENİLİR ──────┐  ┌ GÜVENİLMEZ ──────┐
    │ CDN (şema, status)   │  │ cüzdan istemcisi │
    │ → bütünlük hash'i    │  │ verifier girdisi │
    │   ile doğrulanır     │  │ OBS ham verisi   │
    └──────────────────────┘  └──────────────────┘
```

| Sınır | Nasıl aşılır | Kontrol |
|---|---|---|
| CDN → doğrulayıcı | HTTPS + `vct#integrity` / `contentHash` | Hash tutmuyorsa RED |
| Cüzdan → doğrulayıcı | SD-JWT + KB-JWT | İmza ve `sd_hash` |
| OBS → belge veren | Kurum içi ağ | Şema doğrulaması + eşleme tablosu |
| İndeksleyici → doğrulayıcı | Yerel/güvenilir ağ | Tazelik damgası |

**CDN neden yalnızca yarı güvenilir:** İçeriği değiştirebilir ama bu tespit
edilir — hash belgenin imzasının içindedir. Yapabileceği tek şey
**erişimi engellemektir**, ki bu da `INDETERMINATE` üretir, sahte kabul değil.

---

# 8. Anahtar Envanteri

Hangi bileşen hangi anahtarı tutar — [[ARCH-0004]] §4'ün mantıksal karşılığı.

| Anahtar | Sahibi | Nerede | Kullanım | Rotasyon |
|---|---|---|---|---|
| Validator | Üye devlet | Node HSM | Blok imzalama | Nadiren, planlı |
| State delegate | Üye devlet | Devlet KMS | Ulusal kayıt yazma | Yıllık |
| Belge veren (belge imzası) | Belge veren | HSM, **çevrimdışı** | Belge imzalama | Ağır — geçmişi etkiler |
| Belge veren (iptal listesi) | Belge veren | KMS, **çevrimiçi** | Saatlik token imzalama | Yıllık, ucuz |
| Belge veren delegate (EOA) | Belge veren | KMS | `publishList` işlemi | Yıllık |
| Kök sertifika | Üye devlet | Çevrimdışı HSM, tören | Alt CA imzalama | Çok nadiren |
| Cüzdan cihaz anahtarı | Kullanıcı | Secure Enclave | KB-JWT | Cihaz değişiminde |
| TLS | Her servis | ACME/otomasyon | HTTPS | 90 gün |

**Değişmez K1:** Belge imzalama anahtarı ile status imzalama anahtarı
**asla aynı olamaz.** Aynı olsaydı, her yayın aralığında imza atmak için HSM'deki
diploma anahtarını sürekli çevrimiçi bir servise açmak gerekirdi.

---

# 9. Degradasyon Matrisi

Bu tablo, tasarımın dayanıklılığının özetidir.

| Düşen bileşen | İhraç | Doğrulama | Sonuç |
|---|---|---|---|
| **RPC node** | ✗ status yayını duraklar | ✓ indeksleyiciden devam | Düşük |
| **İndeksleyici** | ✓ | ⚠ `INDETERMINATE` veya doğrudan RPC | Orta |
| **Zincir (tüm validator)** | ✗ | ⚠ önbellekten sınırlı | **Kritik** |
| **`schemas.tamga.network`** | ✓ (şema yerelde) | ✓ bilinen tipler; ✗ yeni tip | Düşük |
| **`status.<issuer>`** | ✓ | ✓ 6 saate kadar (`exp`) | Düşük |
| **Belge veren service** | ✗ o kurum | ✓ verilmiş belgeler | Orta (yerel) |
| **Doğrulayıcı service** | ✓ | ✗ o doğrulayıcı | Düşük (yerel) |
| **Belge veren HSM** | ✗ o kurum | ✓ | Orta |
| **Cüzdan (cihaz kaybı)** | — | ✗ o kullanıcı | Kurtarma: [[SPEC-CRED-0001]] |

**Okunması gereken sonuç:** Tek gerçek tek-nokta-arıza zincirin kendisidir ve
o da QBFT ile 1 (4 validator) veya 2 (7 validator) node arızasına dayanıklıdır.
Diğer her bileşen düştüğünde sistem **kısmi hizmete** iner, sessizce yanlış
cevap vermez.

Bu, [[ADR-0007]] ve [[ADR-0008]]'in "içerik off-chain, çapa on-chain"
deseninin kazandırdığı şeydir: içerik dağıtımı kesildiğinde bütünlük garantisi
kaybolmaz, yalnızca tazelik düşer.

---

# 10. Değişmezler

> **Kod ayrımı:** `CMP*` bu dokümanın **değişmezleridir**. §4.1'deki `A1…E4`
> ise doğrulama hattının **adım kodlarıdır** ve kanoniktir — [[ARCH-0004]] §5.2
> ve [[SPEC-API-0001]] `failed_step` alanında aynen kullanılır. İkisi
> karıştırılmamalıdır.

| # | Değişmez |
|---|---|
| **CMP1** | Doğrulayıcı servisi zinciri doğrudan sorgulamaz; indeksleyiciden okur (§2.1). |
| **CMP2** | İndeksleyici bilinmeyen bir implementasyon sürümü görünce **durur ve alarm verir** (§2.2). |
| **CMP3** | İndeksleyici kişisel veri saklamaz (§2.4). |
| **CMP4** | Bayat indeksleyici `INDETERMINATE` üretir, `REJECTED` değil (§2.5). |
| **CMP5** | OBS adaptörü eşlemede karşılığı olmayan veri için belge vermeyi durdurur; tahmin üretmez (§3.2). |
| **CMP6** | Status yayını değişiklik olmasa da sabit aralıkta çalışır (§3.4). |
| **CMP7** | Doğrulayıcı doğrulama başına status çekmez; ön çekim kullanır (§4.2). |
| **CMP8** | Cüzdan şemaları toplu çeker, kullanım anında değil (§6). |
| **K1** | Belge ve status imzalama anahtarları ayrıdır (§8). |
| **CMP9** | Doğrulama sonucu üç değerlidir: ACCEPTED / REJECTED / INDETERMINATE. |

---

# Açık Konular

1. ~~İndeksleyiciyi kim işletir~~ — **KAPANDI** (2026-09-09, [[PM-GOV-0001]]
   Karar P3). Her doğrulayıcı kendi örneğini çalıştırır; vakıf **barındırılmış
   indeksleyici sunmaz**, yalnızca referans dağıtım yayınlar. Doğrulama trafiği
   iptal verisinden yoğun olduğu için status barındırmadan daha katı bir kural.
2. Yüksek riskli doğrulamada indeksleyiciyi atlama eşiği kim belirler —
   doğrulayıcı mi, şema mı (`tamga` bloğu)?
3. Cüzdan yedeğinin sunucu tarafı hangi bileşene ait? Şu an haritada yok;
   [[SPEC-WALLET-0001]]'de tanımlanacak.
4. Operatör panelinin ulusal kayıt işlemleri (`registerIssuer`) belge veren
   servisinde mi olmalı, yoksa devletin ayrı bir konsolunda mı? İkincisi daha
   temiz ama ilk aşamada fazladan bileşen.

---

# İlgili Dokümanlar

[[ARCH-0001]] · [[ARCH-0002]] · [[ARCH-0004]] · [[ARCH-0005]] ·
[[SPEC-BC-0001]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-ID-0002]] ·
[[PM-TRUST-0001]] · [[ADR-0001]] · [[ADR-0007]] · [[ADR-0008]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

