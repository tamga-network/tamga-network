---
document_id: ADR-0007
title: Şema Kayıt Defteri Mimarisi — schema.tamga.network + On-Chain Çapa
category: ADR
domain: Schema
status: Active
review_status: Draft
version: 1.0.0
created: 2026-09-09
last_updated: 2026-09-09
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
  - registry
  - vct
  - type-metadata
keywords:
  - SchemaRegistry contract
  - schema.tamga.network
  - vct HTTPS URL
  - SD-JWT VC Type Metadata
  - vct#integrity subresource integrity
  - JSON Schema 2020-12
  - issuer schema authorization
  - NETWORK NATIONAL schema tiers
summary: >
  Tamga şema kayıt defterinin mimarisini sabitler. Yedi karar: (1) vct = kararlı
  HTTPS URL, schema.tamga.network altında; (2) şema dokümanı off-chain, SD-JWT VC
  Type Metadata + JSON Schema 2020-12 olarak; (3) vct#integrity zorunlu;
  (4) SchemaRegistry kontratı yalnızca çapa tutar (URI + hash + sürüm + durum);
  (5) iki katmanlı şema alanı — NETWORK (2/3 oy) ve NATIONAL (onlyOwnerState);
  (6) issuer↔şema yetkisi zincirde, verifier doğrulamasında zorunlu adım;
  (7) semver + değişmez URL + extends ile sürümleme. Reddedilen alternatifler
  ve bağlayıcı sonuçlar kayıtlıdır.
priority: Critical
related:
  - PM-SCHEMA-0001
  - RS-SCHEMA-0001
  - SPEC-SCHEMA-0001
  - SPEC-BC-0001
  - ADR-0002
  - ADR-0006
  - ADR-0008
supersedes: []
---

# ADR-0007 — Şema Kayıt Defteri Mimarisi

**Durum: Accepted** ✅ (2026-09-09)

---

# Bağlam

[[PM-SCHEMA-0001]] üç zafiyeti kaydetti: kategori aşımı (eğitim issuer'ının
sağlık belgesi imzalayabilmesi), anlam parçalanması (her issuer'ın kendi alan
adlarını kullanması) ve aşırı talep denetiminin dayanaksız kalması. Üçünün de
kökeni aynıdır: ağın **şema kaydı yoktu.**

[[ADR-0006]] credential formatını **SD-JWT VC** olarak sabitledi. SD-JWT VC'de
credential tipini `vct` claim'i taşır ve tipin anlamı **Type Metadata**
dokümanıyla tanımlanır. Dolayısıyla şema kaydı soyut bir mimari tercih değil,
seçilmiş formatın doğrudan gerektirdiği bir bileşendir.

Standart tarafı (draft-ietf-oauth-sd-jwt-vc-19) Type Metadata'nın
çözümlenmesi için birden çok yol tanımlar: `vct` içindeki URL'den, bir
**registry**'den, ekosistemin tanımladığı bir yöntemden ya da yerel önbellekten.
Registry yolunda consumer'ın o kayıt defterine güvenmesi gerektiği açıkça
belirtilir. Ayrıca `vct#integrity` claim'i, Type Metadata dokümanının
bütünlüğünü koruyan bir integrity metadata dizesi taşır; `extends` ve
`extends#integrity` ile tip hiyerarşisi kurulabilir; şemanın kendisi Type
Metadata'nın `schema` veya `schema_uri` parametresinde, **JSON Schema 2020-12**
sürümüne uygun olarak taşınır.

Yani kuracağımız yapının çerçevesi standardın içinde hazır duruyor. Karar
verilmesi gereken, bu çerçevenin Tamga'ya nasıl oturtulacağıdır.

---

# Karar

## Karar 1 — `vct` kararlı bir HTTPS URL'dir

Tamga credential'larında `vct`, `schema.tamga.network` alan adı altında kararlı
bir HTTPS URL'dir. URN, serbest dize veya kurum-yerel tanımlayıcı **kullanılmaz.**

```
https://schema.tamga.network/v1/edu/DiplomaCredential/1.0.0
https://schema.tamga.network/v1/tr/edu/YOKDenklikCredential/1.0.0
```

**Gerekçe:** HTTPS URL'de tip hem tanımlayıcı hem çözümlenebilir adrestir.
Tamga'yı hiç tanımayan bir verifier bile URL'i açıp ne olduğunu görebilir. URN
seçseydik, çözümleme için Tamga'ya özel bir servis bilmek zorunlu olurdu — ki
bu, ağ dışına açılmayı zorlaştırır.

## Karar 2 — Şema dokümanı off-chain, Type Metadata + JSON Schema olarak

Her `vct` adresinde **SD-JWT VC Type Metadata** dokümanı yayınlanır. Şema,
Type Metadata'nın `schema_uri` parametresi üzerinden **JSON Schema 2020-12**
dokümanına işaret eder.

Servis edilme biçimi: statik dosya, CDN arkasında, değişmez URL. Şema sunucusu
bir uygulama sunucusu değildir; veritabanı sorgusu yapmaz, dinamik içerik
üretmez.

**Gerekçe:** [[PM-SCHEMA-0001]] Seçenek B'de kaydedildi — şemayı zincire yazmak
maliyetlidir, değişmezliği yanlış yere koyar, çok dillilikte katlanır ve şema
okumayı RPC node'a bağımlı kılar. Şema okuma ağın en sık yapılan işlemidir;
CDN'den servis edilmesi doğru mimaridir.

## Karar 3 — `vct#integrity` zorunludur

Her Tamga credential'ı `vct` claim'inin yanında `vct#integrity` claim'i taşır.
Uyumlu bir Tamga verifier'ı, integrity değeri olmayan Type Metadata'yı
**kullanmaz.**

**Gerekçe:** Karar 2'nin doğal bedeli, şema dokümanının bir HTTP sunucusunda
durmasıdır. O sunucu ele geçirilirse şema sessizce değiştirilebilir — örneğin
`eqf_level` alanının anlamı kaydırılabilir. `vct#integrity`, credential'ın
imzasının içinde taşındığı için bu saldırıyı kapatır: issuer, belgeyi
imzalarken hangi şemayı kastettiğini kriptografik olarak sabitlemiş olur.

Bu aynı zamanda **süresiz önbelleklemeyi** mümkün kılar: integrity değeri
dokümanın içeriğini benzersiz olarak tanımladığı için, önbellek bu değerle
anahtarlanır ve HTTP önbellek direktiflerinden bağımsız olarak kullanılabilir.
Cüzdanın çevrimdışı çalışabilmesi bu özelliğe dayanır.

## Karar 4 — `SchemaRegistry` kontratı yalnızca çapa tutar

Zincire yazılan kayıt:

```
schemaId      = keccak256(vctURI)
vctURI        string
contentHash   bytes32     // Type Metadata dokümanının hash'i
version       string      // semver
tier          {NETWORK, NATIONAL}
stateCode     bytes2      // NATIONAL ise sahibi devlet, NETWORK ise 0x0000
status        {ACTIVE, DEPRECATED, REVOKED}
validFrom     uint64
supersededBy  bytes32     // yeni sürüme işaret (opsiyonel)
```

Şema **içeriği** zincirde değildir. `contentHash`, `vct#integrity` ile aynı
dokümanı bağlar.

**Gerekçe:** Zincirin işi referans ve yetki tutmaktır, içerik saklamak değil —
[[PM-TRUST-0001]]'in kişisel veri için koyduğu ilkenin, büyük ve değişen içerik
için de geçerli olan hâli.

## Karar 5 — İki katmanlı şema alanı: NETWORK ve NATIONAL

| Katman | URL deseni | Kim kaydeder | Yönetişim |
|---|---|---|---|
| **NETWORK** | `/v1/<domain>/<Type>/<ver>` | Ağ | 2/3 oy ([[ADR-0002]] Katman 1) |
| **NATIONAL** | `/v1/<ülke>/<domain>/<Type>/<ver>` | Tek devlet | `onlyOwnerState`, oy yok |

İlke: **sınır ötesi anlam taşıması gereken şemalar NETWORK, ulusal hukuka özgü
olanlar NATIONAL.**

Bir devlet NATIONAL şemasını kimseye sormadan kaydeder ve kimse engelleyemez.
Başka devletin verifier'ının o şemayı tanıma zorunluluğu da yoktur —
cross-recognition mantığının şema katmanındaki karşılığı.

**Gerekçe:** [[ADR-0002]] egemenlik ilkesi ile ağ etkisi arasındaki gerilimin
çözümü. Her şemayı oya bağlamak egemenliği çiğner; hiçbirini bağlamamak anlam
parçalanmasını devlet ölçeğinde geri getirir.

## Karar 6 — Issuer ↔ şema yetkisi zincirdedir ve doğrulamada zorunlu adımdır

`IssuerRegistry`, her issuer için izin verilen `schemaId` kümesini tutar.

Verifier doğrulama zincirine yeni normatif adım eklenir:

> **Adım N:** Credential'ın `vct`'sinden türetilen `schemaId`, issuer'ın izinli
> şema kümesinde mi? Değilse credential **reddedilir.**

Bu adım atlanabilir değildir. [[PM-SCHEMA-0001]] Zafiyet 1 (kategori aşımı) tam
olarak bu adımla kapanır: `EDUCATION` kategorili üniversite, sağlık şemasına
yetkilendirilmediği için o belgeyi imzalasa bile hiçbir uyumlu verifier kabul
etmez.

**Yetkilendirme kimde:** Issuer'ı hangi devlet kaydettiyse, şema yetkisini de o
devlet verir (`onlyOwnerState`). Vakıf Faz 0'da bu rolü yürütür.

## Karar 7 — Sürümleme: semver, değişmez URL, `extends`

- Sürüm **semver**'dir ve **URL'in parçasıdır**. `1.0.0` yayınlandıktan sonra o
  URL'in içeriği **asla değişmez.**
- **MAJOR** — kırıcı değişiklik (alan kaldırma, tip değiştirme, zorunlu alan
  ekleme) → yeni URL, yeni `schemaId`, yeni zincir kaydı.
- **MINOR** — geriye uyumlu ekleme (opsiyonel alan, yeni dil) → yeni URL, eski
  `DEPRECATED` değil `ACTIVE` kalır.
- **PATCH** — yalnızca açıklama/metin düzeltmesi, anlam değişmez → yeni URL;
  eski sürüm geçerliliğini korur.
- Tip hiyerarşisi **`extends`** ile kurulur; `extends#integrity` zorunludur.
  Örnek: `DiplomaCredential` → `extends` → `TamgaBaseCredential` (ortak alanlar:
  `iss`, `vct`, `cnf`, `status`, dil etiketleme kuralı).

**Kritik sonuç — eski belgeler yaşamaya devam eder.** 2027'de `1.0.0` ile
verilmiş bir diploma, 2031'de `2.0.0` yayınlandığında hâlâ doğrulanabilir olmak
zorundadır. Bir diplomanın ömrü şema sürümünden uzundur. Bu yüzden `DEPRECATED`
durumu "artık **verilemez**" demektir, "artık **doğrulanamaz**" demek değildir.
`REVOKED` ise şemanın hatalı/tehlikeli olduğu istisnai durumdur ve o şemayla
verilmiş belgeler ayrıca ele alınır.

---

# Gerekçe (Özet)

Karar hattı üç ilkeye dayanır:

1. **Standardı takip et, icat etme.** SD-JWT VC Type Metadata + JSON Schema
   2020-12 + registry yolu, standardın kendi öngördüğü yapıdır.
2. **Zincir referans tutar, içerik tutmaz.** [[PM-TRUST-0001]]'in genişletilmiş
   uygulaması.
3. **Egemenlik kod seviyesinde.** [[ADR-0002]]'nin şema katmanına taşınması —
   NETWORK/NATIONAL ayrımı ve `onlyOwnerState`.

---

# Değerlendirilen Alternatifler

| Alternatif | Neden reddedildi |
|---|---|
| Şema kaydı yok, `vct` serbest | Zafiyet 1-2-3 açık kalır; verifier tarafı ölür |
| Şemanın tamamı zincirde | Maliyet, değişmezlik yanlış yerde, çok dillilik, CDN kaybı |
| EBSI Trusted Schemas Registry'ye bağlanmak | [[ADR-0002]] egemenlik ilkesiyle çatışır |
| `vct` = URN + özel çözümleyici | Ağ dışına açılmayı zorlaştırır |
| Sürümü URL dışında tutmak (`?v=`) | Değişmez önbellekleme ve integrity kırılır |

Ayrıntılı gerekçeler [[PM-SCHEMA-0001]]'dedir.

---

# Sonuçlar

## Bağlayıcı (implementasyona kısıt)

1. `contracts/src/schema/SchemaRegistry.sol` **yazılacaktır.**
2. `IssuerRegistry.sol`'a **izinli şema kümesi** alanı ve
   `isAuthorizedForSchema(issuerId, schemaId)` sorgusu eklenecektir.
   > **2026-09-09 review notu:** Bu sorgu **ihraç** içindir. Doğrulama,
   > zamana bağlı `isCredentialSchemaAcceptable(issuerId, schemaId, iat)`
   > kullanır — aksi hâlde `DEPRECATED` şemayla verilmiş eski belgeler
   > reddedilir ve Karar 7'nin "eski belgeler yaşamaya devam eder" ilkesi
   > çiğnenir. Bkz. [[SPEC-BC-0001]] 2.1.0 §3.4.
3. [[SPEC-BC-0001]] yeniden yazımında `SchemaRegistry` kanonik arayüzü
   tanımlanacaktır.
4. Verifier doğrulama algoritmasına **şema yetki adımı** normatif olarak
   girecektir ([[SPEC-API-0001]]).
5. Tüm Tamga credential'ları `vct` **ve** `vct#integrity` taşıyacaktır —
   [[SPEC-CRED-0002]] bunu zorunlu alan olarak yazacaktır.
6. `schema.tamga.network` bir işletilen bileşendir; [[ARCH-0004]] sunucu
   envanterine girer (statik + CDN, ayrı uptime hedefi).
7. `@tamga-network/schemas` paketi şemaları ve doğrulayıcıyı taşıyacaktır
   ([[ARCH-0005]]).

## Operasyonel

- Yeni NETWORK şeması eklemek 2/3 oy gerektirir — yavaştır, kabul edilmiştir.
  Faz 0'da vakıf tek başına yürütür.
- Şema sunucusunun kesintiye uğraması **doğrulamayı durdurmaz** (integrity ile
  önbelleklenmiş şema kullanılabilir), ama **yeni tip öğrenmeyi** durdurur.
  SLO buna göre belirlenir.

## Kabul edilen riskler

- **Katılık.** Bir kurum özel alan istediğinde hemen cevap veremeyeceğiz;
  `extends` acıyı azaltır, kaldırmaz.
- **Alan adı bağımlılığı.** `schema.tamga.network` alan adının kaybı
  ekosistemik bir olaydır. Alan adı yönetimi, DNSSEC ve devir planı
  [[ARCH-0004]]'te ele alınmalıdır.

---

# İlişkiler

**Dayanır:** [[PM-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[ADR-0002]] · [[ADR-0006]] · [[PM-TRUST-0001]]
**Uygular:** [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-SCHEMA-0003]]
**Etkiler:** [[SPEC-BC-0001]] · [[SPEC-CRED-0002]] · [[SPEC-API-0001]] · [[ARCH-0004]] · [[ARCH-0005]]
**Kardeş karar:** [[ADR-0008]] (status list yerleşimi — aynı "off-chain içerik + on-chain çapa" deseni)

---

# Durum

**Accepted** ✅ — 2026-09-09. [[DECISIONS]]'a `D-SCHEMA-1` olarak işlenecektir.
