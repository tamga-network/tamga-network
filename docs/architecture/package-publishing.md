---
document_id: ARCH-0005
title: "Paket yayınlama"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Tamga SDK'larının paket haritasını, monorepo yapısını, sürümleme ve yayınlama
  hattını tanımlar. İki merkezî tez: (1) @tamga-network/verifier ekosistemin EN YÜKSEK
  DEĞERLİ saldırı hedefidir — bir validator'ı ele geçirmek 2/3 çoğunluk ister,
  ama her verifier'ın çalıştırdığı npm paketini ele geçirmek tek bir token
  ister ve sonuç SESSİZDİR; (2) eski bir SDK sürümü yeni bir doğrulama adımını
  bilmediği için onu sessizce atlar, yani sürüm bağlaşımı bir güvenlik
  meselesidir — bu yüzden doğrulama sonucu hangi kontrollerin yapıldığını
  taşır ve SDK, tanımadığı kontrat sürümü görünce durur.
---

# Kapsam

[[ARCH-0003]] bileşenlerin **ne yaptığını** tanımlar. Bu doküman o bileşenlerin
**kod olarak nasıl paketlendiğini, sürümlendiğini ve dağıtıldığını** tanımlar.

Kontrat kodunun kendisi `contracts/` altındadır ([[SPEC-BC-0001]]).

---

# 1. Paket Haritası

```
@tamga-network/core          ── tipler, hatalar, kriptografi ilkelleri, base64url
   ▲     ▲     ▲
   │     │     └──────────────────────────────┐
   │     └──────────────────┐                 │
@tamga-network/schemas      @tamga-network/contracts    @tamga-network/trust
 şemalar + JSON       ABI + tipler       zincir/indeksleyici okuma
 Schema doğrulayıcı   deploy adresleri   TrustQueries sarmalayıcı
 ISCED-F tabloları
   ▲                        ▲                 ▲
   └────────────┬───────────┴─────────────────┘
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
@tamga-network/issuer  @tamga-network/verifier  @tamga-network/wallet-core
 SD-JWT üretimi  doğrulama hattı  cüzdan çekirdeği
 status yayını   ön çekim         anahtar + depo
```

| Paket | Sorumluluk | Kritiklik |
|---|---|---|
| `@tamga-network/core` | Ortak tipler, base64url, SHA-256, hata sınıfları | Yüksek |
| `@tamga-network/schemas` | Şema dosyaları, JSON Schema doğrulayıcı, ISCED-F eşleme tabloları | Orta |
| `@tamga-network/contracts` | Kontrat ABI'leri, TypeScript tipleri, ağ başına adresler | Orta |
| `@tamga-network/trust` | İndeksleyici/zincir okuma, `TrustQueries` sarmalayıcı | Yüksek |
| `@tamga-network/issuer` | SD-JWT VC üretimi, disclosure, status list yayını | Yüksek |
| `@tamga-network/verifier` | Doğrulama hattı, ön çekim, politika motoru | **Kritik** |
| `@tamga-network/wallet-core` | Anahtar yönetimi, yerel depo, sunum oluşturma | **Kritik** |

Diğer diller:

| Paket | Dil | Kullanım |
|---|---|---|
| `network.tamga:sdk-issuer` | Java/Kotlin (Maven) | Kurum entegrasyonu |
| `tamga-sdk` | Python (PyPI) | Betikleme, veri aktarımı |
| `TamgaWallet` | Swift (SPM) / Kotlin (Maven) | Mobil cüzdan |

**İlke:** İş mantığı TypeScript'te kanoniktir; diğer diller **liman
uygulamalarıdır** ve aynı test vektörlerine karşı doğrulanır. İki bağımsız
uygulama iki bağımsız hata demektir.

---

# 2. Diğer Dokümanlardan Devralınan Taahhütler

Bu paketler, başka spesifikasyonlarda verilmiş sözleri yerine getirmek
zorundadır. Liste bağlayıcıdır:

| # | Taahhüt | Kaynak | Paket |
|---|---|---|---|
| T1 | Ön çekim **varsayılan açık**; doğrulama başına çekim açıkça etkinleştirilmeli | [[SPEC-CRED-0003]] §9.1 | `@tamga-network/verifier` |
| T2 | `acceptLegacyVcSdJwtTyp: false` varsayılanı | [[SPEC-CRED-0002]] §5.1.1 | `@tamga-network/verifier` |
| T3 | ISCED-F ulusal tablosu + kurum `overrides` | [[SPEC-SCHEMA-0002]] §6.4.2 | `@tamga-network/schemas` |
| T4 | Şema uyum testi aracı (CI'da issuer çıktısını doğrular) | [[PM-SCHEMA-0001]] Gelecek | `@tamga-network/schemas` |
| T5 | Eşlemede karşılığı olmayan program için ihracı **durdur**, tahmin üretme | [[ARCH-0003]]/CMP5 | `@tamga-network/issuer` |
| T6 | Üç değerli sonuç: ACCEPTED / REJECTED / **INDETERMINATE** | [[ARCH-0003]]/CMP9 | `@tamga-network/verifier` |
| T7 | Disclosure'ı çözüp yeniden serileştirme **yok** — önce hash, sonra çöz | [[SPEC-CRED-0002]] C4 | `@tamga-network/core` |
| T8 | Cüzdan şemaları toplu çeker, kullanım anında değil | [[ARCH-0003]]/CMP8 | `@tamga-network/wallet-core` |

Her taahhüt için **en az bir test** bulunmalıdır; testin adı taahhüt kodunu
(`T1`…`T8`) içerir ki izlenebilir olsun.

---

# 3. Merkezî Risk — `@tamga-network/verifier` Ekosistemin En Değerli Hedefidir

Bu bölüm dokümanın en önemli kısmıdır.

## 3.1 Neden zincirden daha değerli

| Hedef | Saldırganın ihtiyacı | Tespit |
|---|---|---|
| Validator çoğunluğu | Üye devletlerin **2/3'ünü** ele geçirmek | Yüksek — blok üretimi bozulur |
| Issuer HSM | Fiziksel/ayrıcalıklı erişim | Orta — denetim kaydı |
| **`@tamga-network/verifier` npm paketi** | **Tek bir yayın token'ı** | **Yok — sessiz** |

Ele geçirilmiş bir verifier paketi, `isAuthorizedForSchema` kontrolünü `true`
döndürmeye zorlayabilir veya `sd_hash` doğrulamasını atlayabilir. Sonuç:
**her Tamga verifier'ı sahte credential'ları kabul eder ve hiçbir alarm
çalmaz.** Zincir doğru çalışmaya devam eder; kimse fark etmez.

Bir ağın güvenliği, en güçlü bileşeniyle değil, **en sessiz başarısız olan**
bileşeniyle ölçülür.

## 3.2 Azaltmalar (hepsi zorunlu)

| # | Önlem | Nasıl |
|---|---|---|
| S1 | **npm provenance** | `npm publish --provenance` + GitHub OIDC; her sürüm hangi commit'ten, hangi iş akışıyla üretildiği doğrulanabilir |
| S2 | **Sigstore imzası** | Yayın artefaktları cosign ile imzalanır; anahtar tutulmaz (keyless) |
| S3 | **`postinstall` yasak** | Hiçbir Tamga paketi kurulum betiği çalıştırmaz. CI bunu kontrol eder |
| S4 | **Minimum bağımlılık** | `@tamga-network/core` sıfır çalışma zamanı bağımlılığı hedefler; kripto için platform API'leri |
| S5 | **Yeniden üretilebilir derleme** | Aynı commit → bayt bayt aynı tarball |
| S6 | **SBOM** | Her sürümle CycloneDX SBOM yayınlanır |
| S7 | **İki kişi kuralı** | `main`'e doğrudan push yok; yayın yalnızca etiketli commit'ten |
| S8 | **Yayın token'ı yok** | İnsanlar `npm publish` çalıştıramaz; yalnızca OIDC ile CI |
| S9 | **Sürüm sabitleme** | Dokümantasyon, tüketicilere `^` yerine tam sürüm + lockfile önerir |

**S8 kritik:** Uzun ömürlü bir npm token'ı, S1–S7'nin hepsini geçersiz kılar.
Token yoksa çalınamaz.

## 3.3 Tüketici tarafı doğrulama

Bir verifier kurumu şunu çalıştırabilmelidir:

```bash
npm audit signatures                  # provenance + imza doğrulaması
cosign verify-blob --certificate-identity-regexp \
  'https://github.com/tamga-network/.*' tamga-verifier-1.4.2.tgz
```

Bu adım issuer/verifier onboarding kontrol listesine girer ([[ARCH-0004]]).

---

# 4. Sürüm Bağlaşımı — Bir Güvenlik Meselesi

## 4.1 Sessiz atlama problemi

[[SPEC-BC-0001]] v2.0.0 doğrulama okuma setine yeni bir adım ekledi:
`isAuthorizedForSchema` ([[ADR-0007]] Karar 6).

Şimdi düşünelim: bir verifier kurumu `@tamga-network/verifier@1.x` kullanıyor ve
güncellemedi. O sürüm bu adımı **bilmiyor**. Ne olur?

- Doğrulama başarılı döner.
- Hiçbir hata verilmez.
- Ama kategori aşımı açığı ([[PM-SCHEMA-0001]] Zafiyet 1) **o verifier için
  hâlâ açıktır.**

Yani eski SDK, yeni bir güvenlik kontrolünü **sessizce atlar**. Bu,
`ARCH-0003` §2.2'deki indeksleyici problemiyle aynı sınıftandır ve aynı
çözümü gerektirir: bilmediğini fark et ve dur.

## 4.2 Üç mekanizma

**M1 — Sonuç nesnesi hangi kontrolleri yaptığını taşır.**

```json
{
  "outcome": "ACCEPTED",
  "spec_version": "SPEC-BC-0001@2.0.0",
  "sdk_version": "@tamga-network/verifier@2.1.0",
  "checks_performed": ["A1","A2","A3","A4","A5","A6",
                       "B1","B2","B3","B4","B5","B6",
                       "C1","C2","C3",
                       "D1","D2","D3","D4","D5","D6"],
  "checks_skipped": []
}
```

`checks_skipped` boş değilse, tüketici uygulama bunu **görmek zorundadır.**
Denetim kaydına yazılır ([[ARCH-0004]] §5.2).

**M2 — SDK tanımadığı kontrat sürümünü görünce durur.**

`@tamga-network/trust`, indeksleyicinin `contract_versions` tablosunu okur. Zincirdeki
implementasyon, SDK'nın bildiği sürümden yeniyse:

```
TamgaVersionMismatchError:
  SchemaRegistry zincirde v2.1.0, bu SDK v2.0.0'a kadar biliyor.
  Doğrulama INDETERMINATE olarak sonuçlandı — SDK güncellenmeli.
```

Kabul etmek yerine **`INDETERMINATE`** döner. `ARCH-0003` A2'nin SDK
tarafındaki ikizi.

**M3 — Asgari SDK sürümü RP kaydına bağlanabilir.**

Faz 1'de `RelyingPartyRegistry`'ye asgari spec sürümü alanı eklenebilir; bir
verifier eski SDK ile sunum isteğinde bulunursa cüzdan uyarır. Şu an
**önerilmez, ertelendi** — RP kaydını sürüm yönetimine bağlamak yeni bir
bağlaşım yaratıyor. `SPEC-PROTO-0002` yazılırken yeniden değerlendirilecek.

## 4.3 Uyumluluk matrisi

Depoda `COMPATIBILITY.md` olarak tutulur ve her sürümde güncellenir.

| SDK majör | Uyguladığı spec | Kontrat | Notlar |
|---|---|---|---|
| `1.x` | SPEC-BC-0001 `1.0.0` | v1 | **Kullanımdan kaldırıldı** — şema yetki adımı yok |
| `2.x` | SPEC-BC-0001 `2.0.0` | v2 | Şema kaydı, çapa modeli status list |

**Kural:** Spec MAJOR sürümü artarsa SDK MAJOR sürümü de artar. İkisi
birbirine kilitlidir; SDK `2.x` içinde `1.0.0` spec'i desteklenmez.

---

# 5. Monorepo ve Sürümleme

## 5.1 Yapı

```
tamga-network/
├── contracts/                  Foundry (ayrı sürümlenir)
├── packages/
│   ├── core/
│   ├── schemas/
│   ├── contracts/              ABI + tipler (üretilen)
│   ├── trust/
│   ├── issuer/
│   ├── verifier/
│   └── wallet-core/
├── apps/
│   ├── issuer-service/
│   ├── verifier-service/
│   ├── indexer/
│   └── wallet/
├── docs/
├── COMPATIBILITY.md
└── .changeset/
```

## 5.2 Sürümleme

- **Changesets** ile. Her PR, kullanıcıya görünür bir değişiklik içeriyorsa bir
  changeset dosyası ekler; CI bunu zorunlu tutar.
- Paketler **bağımsız** sürümlenir — `@tamga-network/core` yamalanınca `@tamga-network/verifier`
  majör atlamaz.
- **İstisna:** Bir spec MAJOR'u tüm etkilenen paketleri MAJOR'a taşır (§4.3).

## 5.3 Kullanımdan kaldırma politikası

| Adım | Süre |
|---|---|
| Duyuru + `COMPATIBILITY.md` güncellemesi | T+0 |
| Çalışma zamanı uyarısı (`console.warn`, tek sefer) | T+0 |
| `npm deprecate` | T+3 ay |
| Destek sonu | T+12 ay |

**Güvenlik yamaları istisnadır** ve desteklenen son iki majör sürüme geriye
taşınır.

---

# 6. Yayın Hattı

```
1. PR   → changeset zorunlu, testler, lint, tip denetimi
2. main → "Version Packages" PR'ı otomatik açılır (changesets)
3. merge → sürüm etiketi (tag) oluşur
4. tag   → yayın iş akışı tetiklenir:
             a. temiz ortamda derle (yeniden üretilebilir)
             b. testler + taahhüt testleri (T1–T8)
             c. SBOM üret
             d. npm publish --provenance   (OIDC, token YOK)
             e. cosign ile imzala
             f. GitHub Release + SBOM + tarball
5. yayın sonrası → COMPATIBILITY.md doğrulaması, smoke test
```

## 6.1 Yayın kontrol listesi

- [ ] `CHANGELOG` üretildi ve okunabilir
- [ ] `COMPATIBILITY.md` bu sürümü içeriyor
- [ ] Taahhüt testleri (T1–T8) yeşil
- [ ] Kırıcı değişiklik varsa **geçiş rehberi** yazıldı
- [ ] `postinstall` yok (S3)
- [ ] Yeni çalışma zamanı bağımlılığı eklendiyse gerekçesi PR'da
- [ ] Güvenlik etkisi olan değişiklikse ikinci gözden geçiren onayladı

## 6.2 Özel registry

Faz 1'de üye devletler kendi ayna registry'lerini isteyebilir. Öneri: npm
kanonik kalır, aynalar salt okunur proxy'dir. **Ayrı yayın hattı açılmaz** —
iki hat, iki farklı artefakt riski demektir.

---

# 7. `@tamga-network/schemas` Özel Durumu

Bu paket kod değil, **veri** taşır: JSON Schema dosyaları, Type Metadata
şablonları, ISCED-F eşleme tabloları.

## 7.1 Şema sürümü ≠ paket sürümü

| | Örnek |
|---|---|
| Şema sürümü | `DiplomaCredential/1.0.0` — değişmez URL'de, asla değişmez |
| Paket sürümü | `@tamga-network/schemas@3.2.0` — hangi şemaları içerdiği |

Yeni bir şema eklemek paket için **MINOR**'dur. Bir şemayı paketten çıkarmak
**MAJOR**'dur — ama şemanın kendisi CDN'de kalmaya devam eder
([[SPEC-SCHEMA-0001]] §9.2: `DEPRECATED` şemaların dokümanları asla
kaldırılmaz).

## 7.2 Bütünlük

Paket, her şema için `contentHash` değerini de taşır. Bir tüketici, paketten
gelen şema ile CDN'den gelen şemanın aynı olduğunu offline doğrulayabilir. Hash
tutmuyorsa paket bozuktur.

## 7.3 ISCED-F tabloları (T3)

```
packages/schemas/data/
├── tr/isced-f-2013-programs.json      YÖK ulusal sınıflandırması
└── tr/overrides.json                   kurum bazlı istisnalar
```

Tablo **ağ varlığıdır**, üniversite başına doğaçlama değil
([[SPEC-SCHEMA-0002]] §6.4.2). Güncellemesi normal PR sürecinden geçer ve iki
kişilik gözden geçirme ister — yanlış kod imzalı ve kırk yıl yaşayan bir
belgede düzeltilemez.

---

# 8. Değişmezler

| # | Değişmez |
|---|---|
| **P1** | Hiçbir Tamga paketi `postinstall` betiği içermez. |
| **P2** | Yayın yalnızca CI'dan, OIDC ile; uzun ömürlü npm token'ı yoktur. |
| **P3** | Her sürüm provenance ve imza taşır. |
| **P4** | Spec MAJOR'u artarsa etkilenen SDK MAJOR'u da artar. |
| **P5** | Doğrulama sonucu `checks_performed` / `checks_skipped` taşır. |
| **P6** | SDK, tanımadığı kontrat sürümü görünce `INDETERMINATE` döner, kabul etmez. |
| **P7** | Taahhüt testleri (T1–T8) yayın öncesi zorunludur. |
| **P8** | `@tamga-network/schemas` her şema için `contentHash` taşır. |
| **P9** | İş mantığı TypeScript'te kanoniktir; diğer diller aynı test vektörleriyle doğrulanır. |

---

# Açık Konular

1. `@tamga-network/wallet-core`'un mobil limanları (Swift/Kotlin) ayrı mı yazılacak,
   yoksa bir çekirdek WASM/Rust modülü mü paylaşılacak? Ortak çekirdek hata
   yüzeyini azaltır ama derleme hattını ciddi biçimde karmaşıklaştırır.
2. Bağımlılık politikası ne kadar katı olmalı? Sıfır bağımlılık ideal ama
   JOSE/COSE işlemleri için olgun kütüphaneler var; kendi yazmak da ayrı bir
   risk.
3. §4.2 M3 (asgari SDK sürümünün RP kaydına bağlanması) — [[SPEC-PROTO-0002]]
   yazılırken yeniden değerlendirildi, **hâlâ ertelendi**: sürüm yönetimini
   kayıt defterine bağlamak yeni bir bağlaşım yaratıyor ve M1 (`checks_skipped`)
   pratikte yeterli görünüyor. Faz 2'de yeniden bakılacak.
4. Kullanımdan kaldırma süreleri (§5.3) kamu kurumları için gerçekçi mi?
   12 ay, bir üniversitenin bütçe döngüsünde kısa olabilir.
5. Ayna registry'lerin (§6.2) bütünlüğü nasıl doğrulanır — imza zaten
   taşınıyor ama ayna eski sürümü "en son" gösterebilir (freeze attack).

---

# İlgili Dokümanlar

[[ARCH-0003]] · [[ARCH-0004]] · [[SPEC-BC-0001]] · [[SPEC-CRED-0002]] ·
[[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[PM-SCHEMA-0001]] · [[ADR-0007]] · [[ADR-0008]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

