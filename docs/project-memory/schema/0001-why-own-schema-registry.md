---
document_id: PM-SCHEMA-0001
title: Neden Kendi Şema Kayıt Defterimiz Var — Yetki, Anlam ve Ağ Etkisi
category: Trust
domain: Schema
status: Active
review_status: Draft
version: 1.0.0
created: 2026-09-09
last_updated: 2026-09-09
authors:
  - Tamga Network Engineering
language: tr
document_type: project-memory
audience:
  - engineers
  - architects
  - ai-agents
stability: Stable
maturity: Foundational
tags:
  - schema
  - registry
  - trust
  - sovereignty
  - network-effect
keywords:
  - schema registry
  - trusted schemas registry
  - issuer scope authorization
  - vct type metadata
  - semantic interoperability
  - kategori aşımı
summary: >
  Issuer kayıt defteri "bu kurum geçerli bir issuer mı" sorusunu cevaplar; ama
  "neyi imzalamaya yetkili" sorusunu cevaplamaz. Bu boşluk iki somut zafiyet
  üretir: kategori aşımı (eğitim issuer'ının sağlık belgesi imzalaması) ve
  anlam parçalanması (her issuer'ın kendi alan adlarını kullanması, verifier
  tarafının ölmesi). Bu doküman problemi, değerlendirilen dört alternatifi ve
  hibrit çözümün (off-chain doküman + on-chain çapa + on-chain yetki) gerekçesini
  kaydeder. Ayrıca şema yönetiminin egemenlikle ilişkisini kurar: ortak çekirdek
  şemalar ağ seviyesinde, ulusal şemalar devlet seviyesinde yönetilir.
priority: Critical
related:
  - ADR-0007
  - SPEC-SCHEMA-0001
  - SPEC-BC-0001
  - RS-SCHEMA-0001
  - PM-TRUST-0001
  - ADR-0002
depends_on:
  - PM-TRUST-0001
  - ADR-0002
---

# Giriş

Tamga'nın güven katmanı 2026-09-09 itibarıyla üç soruyu cevaplayabiliyordu:

1. **Bu kurum ağın tanıdığı bir issuer mı?** → `IssuerRegistry` ([[SPEC-BC-0001]])
2. **Bu kurumun kök sertifikası çıpalanmış mı?** → `RootCARegistry` ([[SPEC-ID-0002]])
3. **Bu belge iptal edilmiş mi?** → `StatusListRegistry` ([[SPEC-BC-0001]] §5)

Cevaplayamadığı bir dördüncü soru vardı ve bu soru, diğer üçünün toplamından
daha belirleyicidir:

> **Bu kurum tam olarak neyi imzalamaya yetkili, ve imzaladığı şey ne anlama
> geliyor?**

Bu doküman, bu boşluğun neden kritik olduğunu ve neden kendi şema kayıt
defterimizi kurduğumuzu kaydeder.

---

# Problem

## Zafiyet 1 — Kategori aşımı

`IssuerRegistry`, issuer'ı bir `IssuerCategory` ile kaydeder:
`{GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER}`.

Ama bu kategori **hiçbir yerde zorlanmıyordu.** İstanbul'daki bir vakıf
üniversitesi `EDUCATION` kategorisiyle kayıtlıdır; sertifikası geçerlidir;
imzası doğrulanır. O üniversite yarın şu belgeyi imzalarsa ne olur?

```json
{
  "vct": "urn:tamga:health:VaccinationCredential:1",
  "patient_name": "Ayşe Yılmaz",
  "vaccine": "..."
}
```

Verifier tarafında olan şudur:

- İmza geçerli ✓
- Issuer `isValidIssuer` ✓
- Sertifika zinciri geçerli ✓
- İptal edilmemiş ✓
- **Sonuç: belge kabul edilir.**

Bir üniversite aşı kartı vermiş oldu ve ağ bunu onayladı. Kategori alanı
veritabanında duruyordu ama hiçbir kontrol noktasına bağlı değildi.

Bu, [[SPEC-CRED-0001]] §3'te tanımlanan holder binding zafiyetiyle **aynı
sınıftan** bir hatadır: sistem açıkça hata vermek yerine **sessizce yanlış
cevap verir.** Ve o dokümanın kendi ifadesiyle, sessizce yalan söylemek açıkça
hata vermekten kötüdür.

## Zafiyet 2 — Anlam parçalanması

İkinci zafiyet daha sinsi, çünkü güvenlik açığı gibi görünmüyor; sadece ağı
işe yaramaz hale getiriyor.

Şema kaydı olmadan `vct` serbest bir dizedir. Üç üniversite aynı belgeyi
üç farklı biçimde verir:

| Kurum | `vct` | Mezuniyet yılı alanı |
|---|---|---|
| A Üniversitesi | `tamga:diploma` | `mezuniyet_yili` |
| B Üniversitesi | `https://b.edu.tr/vc/diploma` | `graduationYear` |
| C Üniversitesi | `urn:c-uni:degree:v2` | `date_of_award` |

Şimdi bir işveren doğrulama yapmak istiyor. Ne yapmak zorunda? **Her
üniversite için ayrı ayrıştırma kodu yazmak.** Üç üniversite için üç entegrasyon,
otuz üniversite için otuz.

Bu noktada Tamga'nın satış vaadi çöker. Verifier tarafına "bir kere entegre ol,
tüm kurumların belgelerini oku" diyemeyiz; "her kurum için ayrı iş yap" demiş
oluruz — ki bu, bugün zaten yaşadıkları durumdur. Ağ etkisi tam olarak buradan
doğar veya burada ölür.

[[PM-ASSUR-0001]]'in verifier politika motoru da bu olmadan çalışamaz. "Bu
verifier `eqf_level >= 6` isteyebilir" diyebilmek için, `eqf_level`'ın ağ
genelinde aynı şeyi ifade etmesi gerekir.

## Zafiyet 3 — Aşırı talep denetlenemez

[[SPEC-BC-0001]] `RelyingPartyRegistry` ile RP'ye `scope` tanımlıyor: bir
verifier yalnızca izin verilen alanları isteyebilir. Ama "alan" nedir?
Şema yoksa, `scope` da anlamsız bir dizedir.

Yani şema kaydı, veri minimizasyonu denetiminin de **önkoşuludur.** Amaç
sınırlamasını kod seviyesinde zorlamak istiyorsak (ve [[ADR-0002]] egemenlik
mantığı bunu gerektiriyor), önce alanların ne olduğunu ağ genelinde tanımlamamız
gerekir.

---

# Emsal Doğrulaması

Bu boşluk Tamga'ya özgü değil; olgun ekosistemlerin hepsi aynı çözüme varmış:

- **EBSI**, `Trusted Issuers Registry`'nin yanına **`Trusted Schemas Registry`**
  koyar. İki ayrı registry, çünkü iki ayrı soru ([[RS-EBSI-0001]]).
- **SD-JWT VC** (draft-ietf-oauth-sd-jwt-vc-19), Type Metadata'nın
  çözümlenmesi için dört yol tanımlar ve bunlardan biri açıkça **registry**
  yoludur: bir consumer, `vct` bir HTTPS URL değilse veya URL'e erişimi yoksa
  Type Metadata'yı bir kayıt defterinden alabilir; ve o kayıt defterine güvenmesi
  gerekir. Yani standart, bizim kuracağımız şeyi zaten öngörmüş.
- **EUDI ARF**, her attestation tipi için bir **Rule Book** tanımlar — PID Rule
  Book, mDL Rule Book. Rule Book, şema + kurallar + kimin verebileceğidir
  ([[RS-EIDAS-0001]]).

Üçünün ortak dersi aynı: **issuer yetkisi ile veri anlamı ayrı ama bağlı iki
kayıttır.**

---

# Değerlendirilen Alternatifler

## Seçenek A — Şema kaydı yok, `vct` serbest

Her issuer kendi tipini tanımlar; ağ karışmaz.

- **Artı:** Sıfır iş, sıfır yönetişim yükü, maksimum esneklik.
- **Eksi:** Zafiyet 1, 2 ve 3'ün üçü de açık kalır. Verifier tarafı ölür.

**Reddedildi.** Esneklik burada bir özellik değil, ürünün kendisinin
reddedilmesidir.

## Seçenek B — Şemanın tamamı zincire yazılır

JSON Schema dokümanı `SchemaRegistry` kontratında `string` olarak saklanır.

- **Artı:** Tek kaynak, değişmez, ayrı bir servis işletmeye gerek yok.
- **Eksi:**
  - **Maliyet.** Bir diploma şeması JSON Schema olarak yaklaşık 8–15 KB. Çok
    dilli etiketlerle 40 KB'a çıkar. Zincire kalıcı veri yazmak, EVM'de
    depolamanın en pahalı işlemidir; izinli ağda gas ücretsiz olsa bile her
    node'un diskinde ve durum ağacında kalır.
  - **Değişmezlik yanlış tarafta.** Şemalar yaşayan nesnelerdir; yazım hatası
    düzeltilir, dil eklenir, açıklama netleşir. Zincir bunu ucuz yapmaz.
  - **Çok dillilik.** 6 dilde etiket taşıyan bir şema zincirde altı katına çıkar.
  - **CDN yok.** Her cüzdan ve her verifier, şemayı okumak için RPC node'a
    bağlanmak zorunda kalır. Şema okuma en sık yapılan işlemdir; bunu zincire
    bağlamak ağı gereksiz yere yavaşlatır ve merkezîleştirir.

**Reddedildi.** [[PM-TRUST-0001]]'in genel ilkesiyle de tutarlıdır: zincir
**referans** tutar, **içerik** tutmaz. Kişisel veri için geçerli olan bu ilke,
büyük ve değişen içerik için de geçerlidir.

## Seçenek C — EBSI'nin Trusted Schemas Registry'si kullanılır

Kendi registry'mizi kurmayız, EBSI'ninkine bağlanırız.

- **Artı:** Bedava interoperability, sıfır bakım.
- **Eksi:** [[ADR-0002]] ile doğrudan çatışır. Türk dünyasının şema
  egemenliğini AB kurumuna devretmiş oluruz. Bir Kazak üniversitesinin diploma
  şemasını EBSI'nin onaylaması gerekir. Ayrıca EBSI'nin yönetişiminde söz
  hakkımız yoktur ve EBSI kapsamı dışındaki dikeylerde (lojistik, turizm)
  hiçbir karşılığı yoktur.

**Reddedildi.** [[PM-PH-0001]] "uyumlu ama bağımsız" konumlandırmasının anlamı
tam olarak budur: formatta uyum, yönetişimde bağımsızlık.

## Seçenek D — Hibrit: off-chain doküman + on-chain çapa + on-chain yetki — **SEÇİLDİ**

Üç parça:

1. **Şema dokümanı off-chain.** `schemas.tamga.network` altında, Type Metadata
   ve JSON Schema olarak, CDN'den servis edilir, değişmez URL'de.
2. **Bütünlük çapası on-chain.** `SchemaRegistry` kontratı yalnızca
   `(schemaId, vct URI, contentHash, sürüm, durum)` tutar. Kimse şemayı sessizce
   değiştiremez; değiştirirse hash tutmaz.
3. **Issuer ↔ şema yetkisi on-chain.** Hangi issuer'ın hangi şemayla belge
   verebileceği zincirde kayıtlıdır. Zafiyet 1 böyle kapanır.

Bu yapının teknik ayrıntısı [[ADR-0007]] ve [[SPEC-SCHEMA-0001]]'dedir.

---

# Egemenlik ile İlişki

[[ADR-0002]]'nin üç katmanlı yönetişim modeli şema katmanına da uygulanır. Ama
burada bir gerilim vardır ve bilinçli olarak çözülmüştür.

**Gerilim:** Şemalar ne kadar ulusallaşırsa, ağ etkisi o kadar zayıflar. Her
devlet kendi diploma şemasını yazarsa, Zafiyet 2 devlet ölçeğinde geri gelir.
Ama her şemayı ağ oyuna bağlarsak, [[ADR-0002]]'nin egemenlik ilkesi çiğnenir.

**Çözüm — iki katmanlı şema alanı:**

| Katman | Kim yönetir | Örnek | Yönetişim |
|---|---|---|---|
| **NETWORK** | Ağ, birlikte | `edu/DiplomaCredential` | 2/3 oy ([[ADR-0002]] Katman 1) |
| **NATIONAL** | Tek devlet | `tr/edu/YOKDenklikCredential` | `onlyOwnerState`, oy yok |

İlke: **sınır ötesi anlam taşıması gereken şeyler NETWORK, ulusal hukuka özgü
olanlar NATIONAL.** Bir diploma her yerde diplomadır → NETWORK. YÖK denklik
belgesi yalnızca Türk hukukunda anlamlıdır → NATIONAL.

Bir devlet NATIONAL şemasını kimseye sormadan kaydeder; kimse engelleyemez. Ama
o şemayı başka devletin verifier'ının tanıma zorunluluğu da yoktur — tıpkı
cross-recognition mantığı gibi ([[SPEC-BC-0001]] §3).

Bu, senin baştan koyduğun ilkeyle tutarlıdır: *bir üye devlet kendi kurumlarını
başka devletlerin oyuna sunmadan kaydedebilmelidir.*

---

# Sonuçlar

## Bağlayıcı sonuçlar

1. `SchemaRegistry` kontratı **yazılacaktır** — [[SPEC-BC-0001]] yeniden yazımı
   kapsamında.
2. `IssuerRegistry`'ye **şema yetki bağı** eklenecektir. Bir issuer'ın
   imzalayabileceği `vct` kümesi zincirde kayıtlı olacaktır.
3. Verifier doğrulama zincirine **yeni bir adım** girer: *"bu issuer bu şemayla
   belge vermeye yetkili mi?"* — [[SPEC-API-0001]] doğrulama algoritmasında
   normatif adım olarak yer alır.
4. `vct` **serbest dize değildir.** Kayıtlı olmayan bir `vct` taşıyan belge,
   uyumlu bir Tamga verifier'ı tarafından **reddedilir.**
5. Şema alanları [[RS-SCHEMA-0001]]'in bulgularına göre uluslararası
   modellerden devralınır; sıfırdan uydurulmaz.

## Kabul edilen ödünleşimler

- **Yönetişim yükü.** Yeni bir NETWORK şeması eklemek artık 2/3 oy gerektiriyor.
  Bu yavaştır. Kabul ediyoruz, çünkü alternatifi anlam parçalanmasıdır. Faz
  0'da vakıf bu rolü tek başına yürütür ([[ARCH-0001]] §3).
- **Yeni bir servis.** `schemas.tamga.network` işletilecek bir bileşendir:
  uptime, CDN, sürümleme, yedekleme. [[ARCH-0004]]'te envantere girer.
- **Katılık.** Bir kurum "benim özel alanım var" dediğinde ona hemen cevap
  veremeyeceğiz. Uzantı mekanizması ([[ADR-0007]] `extends`) bu acıyı azaltır
  ama tamamen kaldırmaz.

---

# Gelecek

- **Şema keşfi:** Bir verifier "eğitim alanında hangi şemalar var" diye
  sorabilmeli. Faz 1'de indeksleyici üzerinden ([[ARCH-0003]]).
- **Şema kullanım istatistikleri:** Hangi şema ne kadar kullanılıyor — hangi
  şemaların emekliye ayrılacağına karar vermek için gerekli. Mahremiyet
  açısından yalnızca toplu sayaç, hiçbir zaman belge bazında değil.
- **Otomatik uyum testi:** Bir issuer'ın ürettiği belgenin şemaya uyduğunu CI'da
  doğrulayan araç → `@tamga-network/schemas` paketi ([[ARCH-0005]]).

---

# İlgili Dokümanlar

[[ADR-0007]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[RS-SCHEMA-0001]] ·
[[SPEC-BC-0001]] · [[PM-TRUST-0001]] · [[ADR-0002]] · [[PM-ASSUR-0001]] ·
[[SPEC-CRED-0001]]

---

# Durum

**Draft** — 2026-09-09. Karar [[ADR-0007]] ile resmileştirildi. `SCHEMA`,
[[DOCUMENTATION-STANDARD]] domain listesine eklenmesi gereken yeni bir
domaindir (kısaltma: `SCHEMA`).
