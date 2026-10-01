---
document_id: SPEC-CRED-0001
title: Credential Formatı ve Protokoller — SD-JWT VC, OpenID4VCI/VP, Holder Binding, WUA
category: Specification
domain: Credential
status: Draft
review_status: Draft
version: 1.0.5
created: 2026-09-03
last_updated: 2026-09-26
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
  - credential
  - sd-jwt-vc
  - openid4vci
  - openid4vp
  - holder-binding
  - wallet-attestation
  - selective-disclosure
keywords:
  - SD-JWT VC
  - mdoc ISO 18013-5
  - OpenID4VCI
  - OpenID4VP
  - ES256 P-256
  - holder binding cnf
  - key binding JWT
  - Wallet Unit Attestation
  - Token Status List
  - selective disclosure
related:
  - PM-ASSUR-0001
  - PM-TRUST-0001
  - SPEC-BC-0001
  - SPEC-ID-0002
  - ADR-0004
  - ADR-0006
  - ADR-0008
  - SPEC-SCHEMA-0002
  - ACA-ID-0001
  - RS-EIDAS-0001
depends_on:
  - PM-TRUST-0001
  - SPEC-BC-0001
adrs:
  - ADR-0006
summary: >
  Tamga credential'larının kanonik formatını ve ihraç/sunum protokollerini tanımlar.
  Birincil format SD-JWT VC (selective disclosure yerleşik, EUDI ARF ana formatı),
  ikincil mdoc/ISO 18013-5 (2. faz, çevrimdışı/fiziksel ibraz). İhraç OpenID4VCI,
  sunum OpenID4VP, imza ES256 (P-256). Holder binding ZORUNLU: credential her zaman
  cüzdanın cihaz anahtarına `cnf` (key binding) ile bağlanır — "üniversite fikrindeki
  gizli hata"nın (belge başkasının cüzdanına alınır) tek çözümü. Wallet Unit Attestation
  (WUA) cüzdanın gerçekliğini beyan eder. Revocation Token Status List'e ([[SPEC-BC-0001]]
  §5) devreder. Zincire credential veya içeriği ASLA yazılmaz ([[PM-TRUST-0001]]).
priority: Critical
---
> **Sürüm notu 1.0.5 (2026-09-26) — [[ADR-0013]] (D-CRED-5):** §1'deki ikincil format **mdoc (ISO 18013-5)** kimlik attestation'ı için etkinleştirildi: aynı alanlar, aynı `iat/exp`, aynı holder anahtarı (mdoc `deviceKey` = SD-JWT `cnf.jwk`), ayrı COSE_Sign1 issuerAuth; iptal MSO `status.status_list` ile aynı bit (IETF Token Status List mdoc profili). Uygulama `packages/mdoc`; tel ayrıntısı [[SPEC-PROTO-0001]] PR16, [[SPEC-PROTO-0002]] §4.5/PV11.

> **Sürüm notu 1.0.4 (2026-09-24) — ADR-0009 / ADR-0010 senkronu (DECISIONS §10.7):** §4 WUA'ya **uygulanan profil** (claim seti, taşıma başlıkları, provider) eklendi (DB-16, [[SPEC-PROTO-0001]] §11.1); `vct`/alan adı güncellemeleri. Bu doküman eski biçimdedir (değişmez tablosu yok); normatif tel profili [[SPEC-CRED-0002]].


# Kapsam

Bu spesifikasyon, güven katmanının credential **taşıyıcı formatını** ve **protokollerini**
tanımlar. [[SPEC-BC-0001]] "zincirde ne var" (issuer/status registry) sorusunu; bu doküman
"cüzdandaki belge neye benziyor ve nasıl akıyor" sorusunu yanıtlar.

**Değişmez ilke ([[PM-TRUST-0001]]):** Credential ve içeriği **cüzdanda** tutulur, zincire
**asla** yazılmaz. Zincir yalnızca issuer'ın yetkisini (registry) ve iptal durumunu
(status list pointer) tutar.

Kararlar [[ADR-0006]] ile sabitlenmiştir. Güven çerçevesi çalışma notunun (Bölüm K) resmî
karşılığıdır.

---

# 1. Format Kararları

| Konu | Karar | Gerekçe |
|------|-------|---------|
| **Credential formatı (birincil)** | **SD-JWT VC** | Selective disclosure yerleşik, EUDI ARF ana formatı, kütüphane bolluğu, JSON-LD'den belirgin biçimde basit |
| **Credential formatı (ikincil)** | **mdoc / ISO 18013-5** — **kimlik attestation'ı için etkin** (D-CRED-5, [[ADR-0013]]); diğer tipler 2. faz | Safari/iOS Digital Credentials API yalnızca mdoc; ARF PID emsali; fiziksel/çevrimdışı ibraz (BLE Faz 1) |
| **İhraç protokolü** | **OpenID4VCI** | Fiili standart; kurumun mevcut OIDC altyapısına oturur |
| **Sunum protokolü** | **OpenID4VP** | Aynı ekosistem, verifier entegrasyonu kolay |
| **İmza algoritması** | **ES256 (P-256)** | Mobil secure element ve HSM'lerde evrensel destek |
| **Holder binding** | `cnf` + cihaz anahtarı — **zorunlu** | §3; holder binding açığının tek çözümü |
| **Revocation** | **Token Status List** (bitstring) | [[SPEC-BC-0001]] §5 ile aynı; liste off-chain, pointer on-chain |
| **Korelasyon karşıtı** | Batch issuance (tek kullanımlık kopyalar) — 2. faz | Pilotta ertelenir; mimaride yer açılır |

`did:tamga` pseudonym profili ([[SPEC-ID-0001]]) ve X.509 issuer kimliği ([[SPEC-ID-0002]])
bu formatların içine gömülür (issuer = X.509; holder = pseudonym anahtarı).

---

# 2. SD-JWT VC Yapısı

Bir SD-JWT VC üç parçadan oluşur:

```
<Issuer-signed JWT> ~ <Disclosure 1> ~ <Disclosure 2> ~ ... ~ <Key Binding JWT>
```

- **Issuer-signed JWT:** issuer tarafından ES256 ile imzalanmış çekirdek. `iss` = issuer
  tanımlayıcısı (X.509 `issuerId`'ye çözülür, [[SPEC-ID-0002]]); seçici-açıklanabilir
  claim'ler **hash** olarak (`_sd` dizisi) gömülür.
- **Disclosure'lar:** her biri `[salt, claim_adı, değer]` — holder yalnızca sunmak
  istediklerini iliştirir; gerisi issuer imzasını bozmadan gizli kalır.
- **Key Binding JWT (KB-JWT):** holder'ın cihaz anahtarıyla imzaladığı, sunum-anına-özel
  parça (§3).

Zorunlu issuer claim'leri: `iss`, `iat`, `vct` (credential tipi), `cnf` (holder public
key), `status` (Token Status List pointer). `exp` credential tipine göre (öğrenci belgesi
kısa TTL, diploma uzun).

> **Veri minimizasyonu:** TCKN gibi tanımlayıcılar yalnızca zorunluysa ve seçici-açıklanabilir
> claim olarak konur; verifier politikası ([[PM-ASSUR-0001]]) bunları "istemeyen" listesine
> alabilir.

---

# 3. Holder Binding — Zorunlu (kritik güvenlik kararı)

## Problem: "üniversite fikrindeki gizli hata"

Yanlış varsayım: *"Bir öğrenci üniversitenin onayıyla credential alırsa, o öğrenci gerçek
bir kişidir."* Bu **eksiktir.** Üniversite öğrencinin *var olduğunu* doğrular; ama **o
cüzdanın o öğrenciye ait olduğunu** doğrulamaz. Saldırılar:

- Öğrenci belgesini arkadaşının cüzdanına aldırır.
- OBS şifresi çalınmış hesaptan başkasının cüzdanına yazılır.
- Bir kişi aynı belgeyi birden çok cüzdana aldırıp satar.

Bu durumda sistem **sessizce yalan söyler** — açıkça hata vermekten kötüdür. Literatürdeki
adı **holder binding** problemidir ve bir pilotu batırabilecek tek gerçek güvenlik açığıdır.

## Çözüm: `cnf` key binding — istisnasız zorunlu

Her credential, issuance anında holder'ın **cihaz anahtarına** bağlanır: issuer-signed
JWT'ye `cnf` (confirmation) alanı olarak holder'ın public key'i gömülür. Sunumda holder,
verifier'ın nonce'unu içeren bir **KB-JWT**'yi o özel anahtarla imzalar. Verifier:

1. Issuer imzasını doğrular (issuer, credential'ın `iat` anında kabul edilebilir
   miydi → [[SPEC-BC-0001]] `isCredentialAcceptable`; `isValidIssuer` ihraç sorusudur — 1.0.3).
2. `cnf`'teki anahtarın KB-JWT'yi imzaladığını doğrular → **credential'ı sunan taraf,
   ihraç anında bağlanmış özel anahtarı kontrol etmektedir.**
3. Nonce + audience + `iat` tazeliğini doğrular (replay önleme).

Anahtar cihazın **secure element**'inde üretilir (Secure Enclave/StrongBox), asla dışa
aktarılamaz → credential devredilemez.

### `cnf` neyi kanıtlamaz (kapsam sınırı)

Bu ayrım kritiktir ve kolayca abartılır. `cnf` + KB-JWT şunu kanıtlar:

> Sunumdaki holder = ihraçtaki holder (aynı anahtar kontrol ediliyor).

Şunu **kanıtlamaz:**

> Karşıdaki insan, belgede adı geçen kişidir.

`cnf` bir **cihaz anahtarına** bağlar, bir **insana** değil. Holder cihazını ve PIN'ini
bir başkasına verirse, o kişi geçerli imzalı ve geçerli key-binding'li bir credential
sunar; doğrulama zincirinin hiçbir adımı hata vermez.

Yani `cnf`, yukarıdaki üç saldırıdan **ilk ikisini** (belgenin en baştan yanlış cüzdana
yazılması) ve devredilebilirliği kapatır; **gönüllü cihaz paylaşımını** kapatmaz.

**Kimlik eşleştirmesini ne çözer:** birleşik sunum — aynı OpenID4VP isteğinde credential
ve devlet kimlik credential'ı (PID) birlikte, **aynı `cnf` anahtarına** bağlı olarak
sunulur; kimliği PID taşır. Faz 0'da PID yoktur, dolayısıyla kimlik eşleştirmesi
**prosedüreldir** (verifier, `family_name`/`given_name`/`birth_date` alanlarını ayrıca
görülen bir kimlik belgesiyle karşılaştırır). Bu, kâğıt belgeyle bugün yapılanla aynı
güç seviyesindedir — gerileme değil, ertelenmiş iyileşmedir. Ayrıntı:
[[SPEC-SCHEMA-0002]] §1.2.

## İhraç akışında kimlik bağlama (assurance'a etki)

| Yöntem | Nasıl | Ürettiği holder seviyesi ([[PM-ASSUR-0001]]) |
|--------|-------|---------------------------------------------|
| **Uzaktan bağlama** | Öğrenci OBS'ye kendi girer → OIDC/OpenID4VCI ile cüzdan public key'i issuer'a kanıtlanır → `cnf` bağlanır | T1/T2 (OBS güvenliği kadar; 2FA ile iyileşir) |
| **Yüz yüze bağlama** | Kurum masasında memur fiziksel kimliği görür → cüzdandaki QR'ı okutur → bağlama | T2/T3 (kurum = Kayıt Otoritesi) |

---

# 4. Wallet Unit Attestation (WUA)

Cüzdanın kendisi de bir credential taşır. Verifier eninde sonunda şunu sorar: *"Bu gerçek
bir Tamga cüzdanı mı, yoksa birinin yazdığı sahte istemci mi?"*

WUA şunları beyan eder: cüzdan sürümü, anahtarın **donanımda** tutulduğu, PIN'in aktif
olduğu, cihazın root'lu/jailbreak'li olmadığı, cüzdan sağlayıcısının kimliği.

- WUA, cüzdan sağlayıcısı (Faz 0: Tamga) tarafından imzalanır; sağlayıcı zincirde bir
  issuer/RP olarak kayıtlıdır.
- **Baştan konmazsa sonradan eklemek acıdır** — tüm mevcut cüzdanları migrate etmek gerekir.
  Pilotta içerik basit tutulur, ama **alan ve akış baştan açılır.**
- WUA, holder assurance'ın "authenticator gücü" boyutunu ([[PM-ASSUR-0001]] eIDAS mantığı)
  besler: yazılım anahtarı → düşük; donanım + PIN → yüksek.

**Uygulanan profil (2026-09-24, DB-16):**

| Alan | Değer |
|---|---|
| Biçim | JWT, `typ: oauth-client-attestation+jwt`, `alg: ES256`, `x5c` = Wallet Provider sertifikası (Faz B: `wallet-provider`; listede `lotl.wallet_providers[].wua_signing_keys`) |
| Claim'ler | `iss` (provider URL), `sub` (örnek anahtarı JWK thumbprint), `cnf.jwk` (P-256 **örnek anahtarı** — credential anahtarlarından ayrı), `wallet_name`, `wallet_version`, `solution_id`, `key_storage` (`software` \| `secure_enclave` \| `strongbox` \| `wscd`), `user_auth`, `security_level` (W1-DEMO/W2/W3), `iat`, `exp` (30 gün) |
| Taşıma (ihraç) | OpenID4VCI token isteğinde `OAuth-Client-Attestation` + `OAuth-Client-Attestation-PoP` (PoP: `iss` = WUA `sub`, `aud` = issuer, `jti`, iat ±300 s) — [[SPEC-PROTO-0001]] §11.1, PR11 |
| Provider tarafı | `apps/wallet-provider` (`wallet.tamga.network/wua`); cihaz beyanı demo'da self-reported (sapma S-14), pilotta App Attest / Play Integrity |
| Sunum | WUA verifier'a gönderilmez; verifier gerekirse DCQL ile ayrıca ister (Faz 1) |

---

# 5. Revocation (devir)

Credential iptali bu spesifikasyonda **yeniden tanımlanmaz**; [[SPEC-BC-0001]] §5 **Token
Status List**'ine devredilir:

- Issuer-signed JWT'deki `status` claim'i, listenin URI + index'ini işaret eder.
- Liste off-chain (issuer host eder, imzalı/versiyonlu); zincirde yalnızca URI + hash +
  versiyon + bitmap ([[SPEC-BC-0001]] `StatusList`).
- Mahremiyet: `listSize >= 100.000`, rastgele index dağıtımı ([[SPEC-BC-0001]]).

**Korelasyon karşıtı (2. faz):** Aynı status index'ini farklı verifier'lara göstermek bir
izleme vektörüdür. Çözüm **batch issuance** (tek-kullanımlık credential kopyaları); pilotta
ertelenir, formatta yeri şimdiden açık (`cnf` başına birden çok kopya üretilebilir).

---

# 6. Uçtan Uca Akış

```
İhraç (OpenID4VCI):
  1. Holder cüzdanı issuer'ın credential offer'ını alır
  2. Cüzdan cihaz anahtarını üretir/seçer → public key'i sunar (cnf adayı)
  3. Issuer holder binding'i doğrular (uzaktan OIDC / yüz yüze masa)
  4. Issuer SD-JWT VC'yi ES256 ile imzalar, cnf + status index gömer
  5. Bir status index rezerve edilir (SPEC-BC-0001) — zincire içerik YAZILMAZ

Sunum (OpenID4VP):
  6. Verifier bir sunum talebi (nonce + audience + istenen claim'ler) gönderir
  7. Holder yalnızca gerekli disclosure'ları seçer + KB-JWT imzalar
  8. Verifier: issuer imzası + cnf/KB-JWT + status + WUA + assurance politikası
     (PM-ASSUR-0001) → kabul/ret
```

Hiçbir aşamada kişisel veri zincire yazılmaz; doğrulama üç view çağrısıyla (issuer/status/
recognition, [[SPEC-BC-0001]] §6) ücretsiz yapılır.

---

# 7. Chain-Agnostic Kısıt

Bu format ve protokoller **zincirden bağımsız** çalışır: verifier kütüphanesi bir
`TrustedListProvider` arayüzü üzerinden issuer'ları çözer ve arkasında dosya mı (Faz 0
imzalı Trusted List) zincir mi (Faz 1+ registry) olduğunu bilmez. Bu, pilotun Besu'yu
beklememesini sağlar (bkz. [[ARCH-0001]] Faz 0). Karar [[ADR-0006]] + [[ADR-0001]] hattında.

---

# Güvenlik ve Mahremiyet Notları

- **Holder binding istisnasız zorunlu** — kapatılırsa sistem sessizce yalan söyler.
- **Anahtar donanımda** (Secure Enclave/StrongBox); yazılım anahtarı kabul edilmez (WUA
  bunu beyan eder).
- **Selective disclosure varsayılan** — yalnızca gerekli claim; veri minimizasyonu.
- **Batch issuance** korelasyon önlemi 2. fazda; format bugün yer açar.
- Üretim öncesi **bağımsız güvenlik denetimi** (KB-JWT replay, disclosure canlılığı,
  WUA sahteciliği) zorunlu.

---

# Açık Konular

1. `vct` (credential tipi) registry'sinin şema yönetimi ([[SPEC-BC-0001]] şema registry
   ile hizası).
2. mdoc/ISO 18013-5 profilinin tam tanımı (2. faz).
3. Batch issuance devreye alma zamanı ve anahtar/kopya yönetimi (→ korelasyon denetimi).
4. WUA içeriğinin nihai alan kümesi ve cihaz attestation kaynakları (Play Integrity /
   App Attest) ile bağ.

---

# İlgili Dokümanlar

- [[PM-ASSUR-0001]] — assurance seviyeleri; bu format o seviyelerin taşıyıcısı.
- [[PM-TRUST-0001]] — credential asla zincirde değil.
- [[SPEC-BC-0001]] — issuer registry (imza doğrulama kaynağı) + Token Status List (revocation).
- [[SPEC-ID-0002]] — issuer X.509 kimliği (`iss` → `issuerId`).
- [[SPEC-ID-0001]] — holder pseudonym anahtarı (`cnf`).
- [[ADR-0006]] — bu format kararlarının kabul kaydı.
- [[ACA-ID-0001]] — DID/VC/seçici açıklama mekaniği (öğretici zemin).
- [[RS-EIDAS-0001]] — SD-JWT VC / OpenID4VCI-VP'nin EUDI ARF'deki yeri.

---

# Durum

**review_status: Draft.** Format (SD-JWT VC birincil, mdoc ikincil), protokoller
(OpenID4VCI/VP), imza (ES256), holder binding (`cnf` zorunlu) ve WUA kararlaştırıldı
([[ADR-0006]]). Revocation SPEC-BC-0001'e devredildi. mdoc profili, batch issuance ve
`vct` şema yönetimi sonraki fazlara havale edildi.

---

# Sürüm Notu — 1.0.1 (2026-09-09)

§3'e **"`cnf` neyi kanıtlamaz"** kapsam sınırı eklendi. Önceki metin `cnf`
doğrulamasının sonucunu *"credential'ı sunan, bağlandığı kişidir"* diye ifade
ediyordu; bu **fazla iddiaydı**. `cnf` anahtar kontrolünü kanıtlar, kişi
kimliğini değil. Faz 0'ın prosedürel kimlik eşleştirme sınırı açıkça kaydedildi.

Ayrıca §5'teki revocation ifadesi [[ADR-0008]] ile kesinleşmiştir: bitstring
listesi off-chain host edilir, zincirde yalnızca URI + içerik hash'i + sürüm
çapası durur. Önceki metindeki *"... + bitmap"* ibaresi geçersizdir ve
[[SPEC-BC-0001]] yeniden yazımında kaldırılacaktır.

---

# Sürüm Notu — 1.0.2 (2026-09-09)

§3'teki "anahtar güvenli bölgede üretilir, asla dışa aktarılamaz" kuralı ile
proje notlarındaki **seed tabanlı yedekleme** tasarımı arasında bir gerilim
tespit edildi: seed cüzdanı kullanılabilir hâlde geri getiriyorsa holder
anahtarını da geri getiriyor demektir, ki bu credential'ı **devredilebilir**
kılar ve §3'ün kapattığı açığı arka kapıdan açar.

Gerilim [[SPEC-WALLET-0001]] §1'de çözüldü: **anahtarlar seed'den türetilmez**
(WL1), yedek yalnızca belgeleri ve manifestoyu taşır (WL2), cihaz değişiminde
**yeniden ihraç** gerekir. §3'ün kuralı değişmedi; yedekleme tasarımı ona
uyacak şekilde daraltıldı.

---

# Sürüm Notu — 1.0.3 (2026-09-09, bağımsız inceleme)

**Faz tutarsızlığı düzeltildi (R9).** Bu doküman mdoc/ISO 18013-5'i "2. faz"
olarak yazıyordu; [[RS-SCHEMA-0001]] §4 ve [[SPEC-SCHEMA-0003]] §8 ise **Faz 1**
diyor. Doğrusu **Faz 1**'dir: mDL devlet ihracı gerektirir ve devlet katılımı
[[ARCH-0001]] tanımı gereği Faz 1'dir. Yukarıdaki "2. faz" ibareleri geçersizdir.
ISO 18013-5 **yakınlık** (BLE/NFC) sunum profili ise ayrı bir iştir ve
[[SPEC-PROTO-0002]] §7.3'te Faz 2'ye bırakılmıştır — format Faz 1, yakınlık
taşıması Faz 2.
