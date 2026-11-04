---
document_id: SPEC-CRED-0001
title: "Belge biçimi ve protokoller"
status: Active
version: 1.0.0
created: 2026-09-03
last_updated: 2026-11-04
summary: >
  Tamga belgelerinin kanonik biçimini ve belge verme/gösterme protokollerini tanımlar.
  Birincil format SD-JWT VC (selective disclosure yerleşik, EUDI ARF ana formatı),
  ikincil mdoc/ISO 18013-5 (kimlik türlerinde etkin, öteki türlerde planlanan; çevrimdışı/fiziksel ibraz). İhraç OpenID4VCI,
  sunum OpenID4VP, imza ES256 (P-256). Holder binding ZORUNLU: credential her zaman
  cüzdanın cihaz anahtarına `cnf` (key binding) ile bağlanır — "üniversite fikrindeki
  gizli hata"nın (belge başkasının cüzdanına alınır) tek çözümü. Kısa ömürlü cüzdan örneği
  kanıtı (WIA) ve anahtar kanıtı (KA) cüzdanın gerçekliğini ve anahtar deposunu beyan eder ([[ADR-0025]]). Revocation Token Status List'e ([[SPEC-BC-0001]]
  §5) devreder. Zincire credential veya içeriği ASLA yazılmaz ([[PM-TRUST-0001]]).
---
**Bu şartname, Tamga belgelerinin hangi biçimde taşındığını ve hangi protokollerle verilip gösterildiğini özetler.** Ağa katılan her
geliştirici için başlangıç noktasıdır.

**Ne zaman okunur**

- Önce [Belge biçimleri](/concepts/credential-formats) kavram sayfasını okuyun.
- Hangi biçimin, protokolün ve imza algoritmasının seçildiğini ve nedenini görmek istediğinizde.
- Sonra: bayt düzeyi ayrıntı için [[SPEC-CRED-0002]], belge verme için [[SPEC-PROTO-0001]], belge gösterme için [[SPEC-PROTO-0002]].

**Kısaca.** Tamga belgesi birincil olarak [[t:SD-JWT-VC]] biçimindedir; kimlik belgesi ayrıca [[t:mdoc]] (ISO 18013-5) olarak da verilir. Belge
[[t:OpenID4VCI]] ile kurumdan cüzdana gelir, [[t:OpenID4VP]] ile cüzdandan doğrulayıcıya gider; imza ES256'dır. Her belge kişinin cihazındaki bir
anahtara bağlanır, böylece başka bir cihaza kopyalanan belge kullanılamaz. Belgenin kendisi ve içeriği yalnızca cüzdanda durur; ağda
yalnızca kurumların yetkisi ve iptal durumu yayımlanır.

---

# Kapsam

Bu şartname, güven katmanında [[t:credential|belgenin]] **taşıyıcı biçimini** ve **protokollerini**
tanımlar. [[SPEC-BC-0001]] "zincirde ne var" ([[t:issuer]]/status registry) sorusunu; bu doküman
"cüzdandaki belge neye benziyor ve nasıl akıyor" sorusunu yanıtlar.

**Değişmez ilke ([[PM-TRUST-0001]]):** Belge ve içeriği **cüzdanda** tutulur, zincire
**asla** yazılmaz. Zincir yalnızca belge verenin yetkisini (registry) ve iptal durumunu
(iptal listesi pointer) tutar.

Kararlar [[ADR-0006]] ile sabitlenmiştir. Güven çerçevesi çalışma notunun (Bölüm K) resmî
karşılığıdır.

---

# 1. Format Kararları

| Konu | Karar | Gerekçe |
|------|-------|---------|
| **Belge formatı (birincil)** | **SD-JWT VC** | Selective disclosure yerleşik, EUDI ARF ana formatı, kütüphane bolluğu, JSON-LD'den belirgin biçimde basit |
| **Belge formatı (ikincil)** | **mdoc / ISO 18013-5** — **kimlik attestation'ı için etkin** (D-CRED-5, [[ADR-0013]]); diğer tiplerde planlanan | Safari/iOS Digital Credentials API yalnızca mdoc; ARF PID emsali; fiziksel/çevrimdışı ibraz (BLE devlet aşaması) |
| **İhraç protokolü** | **OpenID4VCI** | Fiili standart; kurumun mevcut OIDC altyapısına oturur |
| **Sunum protokolü** | **OpenID4VP** | Aynı ekosistem, doğrulayıcı entegrasyonu kolay |
| **İmza algoritması** | **ES256 (P-256)** | Mobil secure element ve HSM'lerde evrensel destek |
| **Holder binding** | `cnf` + cihaz anahtarı — **zorunlu** | §3; holder binding açığının tek çözümü |
| **İptal** | **Token Status List** (bitstring) | [[SPEC-BC-0001]] §5 ile aynı; liste off-chain, pointer on-chain |
| **Korelasyon karşıtı** | Toplu belge verme (tek kullanımlık kopyalar) — **çalışıyor**: 10 kopyalık paket, otomatik yenileme ([[ADR-0023]], [[ADR-0059]]) | Aynı kopya iki doğrulayıcıya gösterilmez |

`did:tamga` [[t:pseudonym]] profili (SPEC-ID-0001) ve X.509 belge veren kimliği ([[SPEC-ID-0002]])
bu formatların içine gömülür (belge veren = X.509; [[t:holder]] = takma ad anahtarı).

---

# 2. SD-JWT VC Yapısı

Bir SD-JWT VC üç parçadan oluşur:

```
<Issuer-signed JWT> ~ <Disclosure 1> ~ <Disclosure 2> ~ ... ~ <Key Binding JWT>
```

- **Issuer-signed JWT:** belge veren tarafından ES256 ile imzalanmış çekirdek. `iss` = belge veren
  tanımlayıcısı (X.509 `issuerId`'ye çözülür, [[SPEC-ID-0002]]); [[t:selective-disclosure]] ile açıklanabilir
  claim'ler **[[t:salted-hash]]** olarak (`_sd` dizisi) gömülür.
- **Disclosure'lar:** her [[t:disclosure]] `[salt, claim_adı, değer]` — belge sahibi yalnızca sunmak
  istediklerini iliştirir; gerisi belge veren imzasını bozmadan gizli kalır.
- **Key Binding JWT ([[t:KB-JWT]]):** belge sahibinin cihaz anahtarıyla imzaladığı, sunum-anına-özel
  parça (§3).

Zorunlu belge veren claim'leri: `iss`, `iat`, `vct` (belge tipi), `cnf` (belge sahibi public
key), `status` (Token Status List pointer). `exp` belge tipine göre (öğrenci belgesi
kısa TTL, diploma uzun).

> **Veri minimizasyonu:** TCKN gibi tanımlayıcılar yalnızca zorunluysa ve selective disclosure ile açıklanabilir
> claim olarak konur; [[t:verifier]] politikası ([[PM-ASSUR-0001]]) bunları "istemeyen" listesine
> alabilir.

---

# 3. Holder Binding — Zorunlu (kritik güvenlik kararı)

## Problem: "üniversite fikrindeki gizli hata"

Yanlış varsayım: *"Bir öğrenci üniversitenin onayıyla belge alırsa, o öğrenci gerçek
bir kişidir."* Bu **eksiktir.** Üniversite öğrencinin *var olduğunu* doğrular; ama **o
cüzdanın o öğrenciye ait olduğunu** doğrulamaz. Saldırılar:

- Öğrenci belgesini arkadaşının cüzdanına aldırır.
- OBS şifresi çalınmış hesaptan başkasının cüzdanına yazılır.
- Bir kişi aynı belgeyi birden çok cüzdana aldırıp satar.

Bu durumda sistem **sessizce yalan söyler** — açıkça hata vermekten kötüdür. Literatürdeki
adı **[[t:holder-binding]]** problemidir ve bir pilotu batırabilecek tek gerçek güvenlik açığıdır.

## Çözüm: `cnf` key binding — istisnasız zorunlu

Her belge, belge verme anında belge sahibinin **cihaz anahtarına** bağlanır: issuer-signed
JWT'ye `cnf` (confirmation) alanı olarak belge sahibinin public key'i gömülür. Sunumda belge sahibi,
doğrulayıcının [[t:nonce]]'unu içeren bir **KB-JWT**'yi o özel anahtarla imzalar. Doğrulayıcı:

1. Belge veren imzasını doğrular (belge veren, belgenin `iat` anında kabul edilebilir
   miydi → [[SPEC-BC-0001]] `isCredentialAcceptable`; `isValidIssuer` belge verme sorusudur — 1.0.3).
2. `cnf`'teki anahtarın KB-JWT'yi imzaladığını doğrular → **belgeyi sunan taraf,
   belge verme anında bağlanmış özel anahtarı kontrol etmektedir.**
3. Nonce + audience + `iat` tazeliğini doğrular (replay önleme).

Anahtar cihazın **secure element**'inde üretilir (Secure Enclave/StrongBox), asla dışa
aktarılamaz → belge devredilemez.

### `cnf` neyi kanıtlamaz (kapsam sınırı)

Bu ayrım kritiktir ve kolayca abartılır. `cnf` + KB-JWT şunu kanıtlar:

> Sunumdaki belge sahibi = verilen belge sahibi (aynı anahtar kontrol ediliyor).

Şunu **kanıtlamaz:**

> Karşıdaki insan, belgede adı geçen kişidir.

`cnf` bir **cihaz anahtarına** bağlar, bir **insana** değil. Belge sahibi cihazını ve PIN'ini
bir başkasına verirse, o kişi geçerli imzalı ve geçerli key-binding'li bir belge
sunar; doğrulama zincirinin hiçbir adımı hata vermez.

Yani `cnf`, yukarıdaki üç saldırıdan **ilk ikisini** (belgenin en baştan yanlış cüzdana
yazılması) ve devredilebilirliği kapatır; **gönüllü cihaz paylaşımını** kapatmaz.

**Kimlik eşleştirmesini ne çözer:** birleşik sunum — aynı OpenID4VP isteğinde belge
ve devlet kimlik belgeyi ([[t:PID]]) birlikte, **aynı `cnf` anahtarına** bağlı olarak
sunulur; kimliği PID taşır. İlk aşamada PID yoktur, dolayısıyla kimlik eşleştirmesi
**prosedüreldir** (doğrulayıcı, `family_name`/`given_name`/`birth_date` alanlarını ayrıca
görülen bir kimlik belgesiyle karşılaştırır). Bu, kâğıt belgeyle bugün yapılanla aynı
güç seviyesindedir — gerileme değil, ertelenmiş iyileşmedir. Ayrıntı:
[[SPEC-SCHEMA-0002]] §1.2.

## Belge verme akışında holder binding (güvenceye etki)

| Yöntem | Nasıl | Ürettiği belge sahibi seviyesi ([[PM-ASSUR-0001]]) |
|--------|-------|---------------------------------------------|
| **Uzaktan bağlama** | Öğrenci OBS'ye kendi girer → OIDC/OpenID4VCI ile cüzdan public key'i belge verene kanıtlanır → `cnf` bağlanır | T1/T2 (OBS güvenliği kadar; 2FA ile iyileşir) |
| **Yüz yüze bağlama** | Kurum masasında memur fiziksel kimliği görür → cüzdandaki QR'ı okutur → bağlama | T2/T3 (kurum = Kayıt Otoritesi) |

---

# 4. Cüzdan kanıtları: WIA ve KA

Cüzdanın kendisi de kanıt taşır. Belge veren eninde sonunda şunu sorar: *"Bu, güven listesinde kayıtlı bir cüzdan sağlayıcısının
gerçek bir cüzdanı mı, yoksa birinin yazdığı sahte istemci mi; belge anahtarı nerede duruyor?"* Bu soruyu iki ayrı kanıt yanıtlar
([[ADR-0025]]; ayrıntılı kurallar [[FW-POL-0002]]):

- **Cüzdan örneği kanıtı ([[t:WIA]], Wallet Instance Attestation):** cüzdan uygulamasının belge verene kendini tanıttığı kısa
  ömürlü kanıt. Ömrü **24 saatten kısadır**; her belge işleminde yeni bir sahiplik kanıtı (PoP) anahtarı ve yeni, birbirine
  bağlanamaz bir iptal listesi girişiyle verilir (WIA1). Böylece sağlayıcı cüzdanın kaç kurumla görüştüğünü öğrenmez.
- **Anahtar kanıtı (KA, key attestation):** belge anahtarlarının hangi depoda (yazılım, Secure Enclave, StrongBox) ve hangi
  kullanıcı doğrulamasıyla tutulduğunu söyler; belgeler KA'daki `attested_keys`'e bağlanır. Seviye doğrulanmış duruma dayanır,
  doğrulanmamış beyan KA'ya yazılmaz.
- Her iki kanıtı da **cüzdanı sunan kuruluşun cüzdan sağlayıcısı** imzalar; sağlayıcının imza anahtarı güven listesinde
  (`lotl.wallet_providers[]`) kayıtlıdır. Ağ cüzdan sağlayıcısı işletmez, listeler ([[ADR-0042]]).
- Kanıtlar belge sahibi güvencesinin "authenticator gücü" boyutunu ([[PM-ASSUR-0001]]) besler: yazılım anahtarı → düşük;
  donanım + PIN → yüksek.

**Uygulanan profil ([[ADR-0025]]):**

| Alan | Değer |
|---|---|
| WIA biçimi | JWT, `typ: oauth-client-attestation+jwt` (OpenID4VCI 1.0 Ek E), `alg: ES256`, `x5c` = cüzdan sağlayıcısı sertifikası; alanlar `sub`, `wallet_name`, `wallet_version`, `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk` |
| WIA ömrü | 24 saatten kısa; `client_status.exp` en az 31 gün ileride |
| KA biçimi | JWT, `typ: key-attestation+jwt` (OpenID4VCI 1.0 Ek D); alanlar `attested_keys`, `key_storage`, `user_authentication`, `certification`, `key_storage_status {status, exp}` |
| Taşıma (belge verme) | WIA: PAR ve token isteklerinde `OAuth-Client-Attestation` + `OAuth-Client-Attestation-PoP`; KA: `jwt` proof'unun başlığında `key_attestation` — [[SPEC-PROTO-0001]] §11.1 |
| İptal | Sağlayıcı iki Token Status List yayınlar (WIA girişleri, KA türleri); her biri en az 10.000 girişli |
| Sağlayıcı tarafı | Cüzdanı sunan kuruluşun cüzdan sağlayıcısı; ağ işletmez, listeler ([[ADR-0042]]). Tamga Wallet'ınkini cüzdanın işletmecisi `provider.tamgawallet.com`'da işletir (canlı; güven listesinde `TAMGA-WP-1`, `ACTIVE`); cüzdan birimini yalnız cihaz kanıtıyla kaydeder |
| Sunum | WIA ve KA doğrulayıcıya gönderilmez; yalnız belge verme sırasında kullanılır |

---

# 5. İptal (devir)

Belge [[t:revocation|iptali]] bu şartnamede **yeniden tanımlanmaz**; [[SPEC-BC-0001]] §5
**Token Status List** ([[t:status-list|iptal listesi]]) profiline devredilir:

- Issuer-signed JWT'deki `status` claim'i, listenin URI + index'ini işaret eder.
- Liste off-chain (belge veren host eder, imzalı/versiyonlu); zincirde yalnızca URI + hash +
  versiyon + bitmap ([[SPEC-BC-0001]] `StatusList`).
- Mahremiyet: `listSize >= 100.000`, rastgele index dağıtımı ([[SPEC-BC-0001]]).

**Korelasyon karşıtı (çalışıyor):** Aynı status index'ini farklı doğrulayıcılara göstermek bir
izleme vektörüdür. Çözüm **toplu belge verme** (tek kullanımlık belge kopyaları): belge veren her
seferde 10 kopyalık bir paket verir, her kopya kendi anahtarına ve iptal listesi girişine bağlıdır;
cüzdan azalan paketi kendiliğinden yeniler ([[ADR-0023]], [[ADR-0059]]).

---

# 6. Uçtan Uca Akış

```
Belge verme (OpenID4VCI):
  1. Belge sahibinin cüzdanı belge verenin teklifini (credential offer) alır
  2. Cüzdan cihaz anahtarını üretir/seçer → public key'i sunar (cnf adayı)
  3. Issuer holder binding'i doğrular (uzaktan OIDC / yüz yüze masa)
  4. Issuer SD-JWT VC'yi ES256 ile imzalar, cnf + status index gömer
  5. Bir status index rezerve edilir (SPEC-BC-0001) — zincire içerik YAZILMAZ

Sunum (OpenID4VP):
  6. Verifier bir sunum talebi (nonce + audience + istenen claim'ler) gönderir
  7. Holder yalnızca gerekli disclosure'ları seçer + KB-JWT imzalar
  8. Verifier: issuer imzası + cnf/KB-JWT + status + assurance politikası
     (PM-ASSUR-0001) → kabul/ret
```

Hiçbir aşamada kişisel veri zincire yazılmaz; doğrulama üç view çağrısıyla (belge veren/status/
recognition, [[SPEC-BC-0001]] §6) ücretsiz yapılır.

---

# 7. Zincirden Bağımsızlık Kısıtı

Bu format ve protokoller **zincirden bağımsız** çalışır: doğrulayıcı kütüphanesi bir
`TrustedListProvider` arayüzü üzerinden belge verenleri çözer ve arkasında dosya mı (ilk aşama
imzalı [[t:trust-list]]) zincir mi (devlet aşamasında registry) olduğunu bilmez. Bu, pilotun Besu'yu
beklememesini sağlar (bkz. [[ARCH-0001]] ilk aşama). Karar [[ADR-0006]] + [[ADR-0001]] hattında.

---

# Güvenlik ve Mahremiyet Notları

- **Holder binding istisnasız zorunlu** — kapatılırsa sistem sessizce yalan söyler.
- **Anahtar donanımda** (Secure Enclave/StrongBox); yazılım anahtarı kabul edilmez (KA
  bunu beyan eder).
- **Selective disclosure varsayılan** — yalnızca gerekli claim; veri minimizasyonu.
- **Toplu belge verme** korelasyon önlemi olarak çalışıyor ([[ADR-0059]]).
- Üretim öncesi **bağımsız güvenlik denetimi** (KB-JWT replay, disclosure canlılığı,
  WIA/KA sahteciliği) zorunlu.

---

# Açık Konular

1. `vct` (belge tipi) registry'sinin şema yönetimi ([[SPEC-BC-0001]] şema registry
   ile hizası).
2. mdoc/ISO 18013-5 profilinin kimlik dışındaki türler için tanımı (planlanan).
3. ~~Toplu belge verme devreye alma zamanı~~ — kapandı: çalışıyor ([[ADR-0023]], [[ADR-0059]]).
4. WIA/KA'nın cihaz [[t:attestation]] kaynakları (Play Integrity / App Attest) ile bağı
   ([[FW-POL-0002]]).

---

# İlgili Dokümanlar

- [[PM-ASSUR-0001]] — assurance seviyeleri ([[t:LoA]]); bu format o seviyelerin taşıyıcısı.
- [[PM-TRUST-0001]] — belge asla zincirde değil.
- [[SPEC-BC-0001]] — belge veren registry (imza doğrulama kaynağı) + Token Status List (iptal).
- [[SPEC-ID-0002]] — belge veren X.509 kimliği (`iss` → `issuerId`).
- SPEC-ID-0001 — belge sahibinin takma ad anahtarı (`cnf`).
- [[ADR-0006]] — bu format kararlarının kabul kaydı.
- ACA-ID-0001 — DID/VC/seçici açıklama mekaniği (öğretici zemin).
- [[RS-EIDAS-0001]] — SD-JWT VC / OpenID4VCI-VP'nin EUDI ARF'deki yeri.

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

