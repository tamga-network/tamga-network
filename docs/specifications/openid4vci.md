---
document_id: SPEC-PROTO-0001
title: "OpenID4VCI profili"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-07
summary: >
  Bir belgenin cüzdana nasıl girdiğini tanımlar. OpenID4VCI 1.0 Final
  üzerine Tamga profili: issuer metadata, credential offer (QR + tx_code),
  pre-authorized vs authorization code akış seçimi, Nonce Endpoint'ten c_nonce,
  openid4vci-proof+jwt anahtar kanıtı, credential endpoint, ertelenmiş belge verme
  (mezuniyet onayı gecikirse) ve bildirim ucu. İki açık konu kapatılır: batch
  parti büyüklüğü 10 olarak sabitlenir ve batch kopyalarının HER BİRİ FARKLI
  cihaz anahtarı kullanır — aynı `cnf` kullanılsaydı kopyalar birbirine
  bağlanabilir ve batch'in tüm amacı yok olurdu. Ayrıca belge verme anındaki holder
  binding yönteminin holder assurance seviyesine (T1/T2/T3) eşlemesi verilir.
---
**Bu şartname, bir belgenin kurumdan kişinin cüzdanına nasıl verildiğini OpenID4VCI 1.0 üzerinden tanımlar.** Belge veren servis
ya da cüzdan yazan geliştiriciler içindir.

**Ne zaman okunur**

- Önce [Belge verme (OpenID4VCI)](/concepts/issuance) kavram sayfasını okuyun; adım adım uygulama için [Kurum olarak belge vermek](/guides/issue-credentials).
- Kurumun teklif, belirteç ve belge uçlarını kurarken ya da cüzdanın bu uçlarla konuşmasını yazarken.
- Sonra: belgenin biçimi [[SPEC-CRED-0002]], iptal [[SPEC-CRED-0003]].

**Kısaca.** Kurum kişiye bir teklif (belge teklifi: QR ya da bağlantı) gösterir. Cüzdan teklifi açar, kurumdan kısa ömürlü bir erişim
belirteci ve bir kerelik bir [[t:nonce]] alır. Cüzdan bu sayıyı kendi anahtarıyla imzalayarak anahtarın kendisinde olduğunu kanıtlar. Kurum bu
kanıtı ve cüzdanın gerçek bir cüzdan olduğunu ([[t:WIA]]) denetler, sonra her biri farklı bir anahtara bağlı birkaç kopya belge verir. Kopyalar,
aynı belgenin farklı doğrulayıcılarda birbirine bağlanmasını önler.

---

# Kapsam

Bu şartname **belge vermeyi** tanımlar: bir [[t:credential|belgenin]] [[t:issuer|belge verenden]] cüzdana
girişi. Sunum [[SPEC-PROTO-0002]]'dedir.

**Standart temeli:** OpenID for Verifiable Credential Issuance — [[t:OpenID4VCI|OpenID4VCI]] **1.0 (Final)**.
Belge formatı [[SPEC-CRED-0002]], [[t:revocation]] [[SPEC-CRED-0003]].

## Sürüm uyarısı — taslaklardan iki önemli fark

Eski OID4VCI taslaklarına göre yazılmış kod ve dokümanlar bu iki noktada
yanlıştır:

| Konu | Eski taslak | **1.0 Final** |
|---|---|---|
| `c_nonce` nereden alınır | Token Endpoint yanıtından | **Nonce Endpoint**'ten (veya belge yanıtından) |
| Anahtar kanıtı | `proof` (tekil) | **`proofs`** (çoğul, tip başına dizi) |

İkincisi toplu belge vermeyi doğrudan mümkün kılar (§8) ve Tamga'nın mahremiyet
tasarımının temelidir.

---

# 1. Akış Seçimi

OID4VCI iki yetkilendirme akışı tanımlar. Tamga'nın kullanım senaryolarına
eşlemesi:

| Akış | Ne zaman | Tamga'da |
|---|---|---|
| **Pre-authorized code** | Belge veren kullanıcıyı zaten tanıyor; kimlik doğrulaması belge verenin kendi sisteminde yapıldı | **Varsayılan** — üniversite senaryosu |
| **Authorization code** | Cüzdan belge verene yönlendirilir, orada oturum açılır | Kullanıcının belge verende hesabı yoksa veya seçim yapması gerekiyorsa |

## 1.1 Üniversite neden ön yetkili (pre-authorized) akışı kullanır

Öğrenci zaten OBS'de oturum açmıştır; üniversite kim olduğunu bilir. Onu
tekrar bir yetkilendirme akışına sokmak, hiçbir güvenlik kazancı olmadan
kullanıcı deneyimini bozar.

Akış: öğrenci OBS'de "Diplomamı cüzdanıma al" der → üniversite bir belge
offer üretir → ekranda QR + `tx_code` gösterir → öğrenci telefonuyla okutur.

## 1.2 `tx_code` zorunludur

`tx_code`, offer'ı görsel olarak ele geçiren birine karşı ikinci faktördür.
QR ekranda gösterildiği için omuz üstünden okunabilir; `tx_code` ayrı bir
kanaldan (OBS oturumu içinde) verilir.

| Parametre | Tamga değeri |
|---|---|
| `input_mode` | `numeric` |
| `length` | 6 |
| Ömür | 5 dakika |
| Deneme hakkı | 3, sonra offer geçersiz |

**Değişmez PR1:** Pre-authorized akışta `tx_code` **atlanamaz.**

---

# 2. Issuer Metadata

`https://issuer.bilgi.edu.tr/.well-known/openid-credential-issuer`

```json
{
  "credential_issuer": "https://issuer.bilgi.edu.tr",
  "authorization_servers": ["https://issuer.bilgi.edu.tr"],
  "credential_endpoint": "https://issuer.bilgi.edu.tr/credential",
  "nonce_endpoint": "https://issuer.bilgi.edu.tr/nonce",
  "deferred_credential_endpoint": "https://issuer.bilgi.edu.tr/deferred",
  "notification_endpoint": "https://issuer.bilgi.edu.tr/notification",
  "batch_credential_issuance": { "batch_size": 10 },

  "display": [
    { "name": "İstanbul Bilgi Üniversitesi", "locale": "tr-TR" },
    { "name": "Istanbul Bilgi University",   "locale": "en-US" }
  ],

  "credential_configurations_supported": {
    "TamgaDiplomaCredential": {
      "format": "dc+sd-jwt",
      "scope": "diploma",
      "vct": "urn:tamga:edu:DiplomaCredential:1",
      "credential_signing_alg_values_supported": ["ES256"],
      "cryptographic_binding_methods_supported": ["jwk"],
      "proof_types_supported": {
        "jwt": { "proof_signing_alg_values_supported": ["ES256"] }
      },
      "credential_metadata": {
        "display": [
          { "name": "Diploma", "locale": "tr-TR" },
          { "name": "Diploma", "locale": "en-US" }
        ],
        "claims": [
          { "path": ["qualification_title"] },
          { "path": ["eqf_level"] },
          { "path": ["isced_f_code"] },
          { "path": ["awarding_date"] },
          { "path": ["is_graduate"] }
        ]
      }
    },

    "TamgaStudentCredential": {
      "format": "dc+sd-jwt",
      "scope": "student",
      "vct": "urn:tamga:edu:StudentCredential:1",
      "credential_signing_alg_values_supported": ["ES256"],
      "cryptographic_binding_methods_supported": ["jwk"],
      "proof_types_supported": {
        "jwt": { "proof_signing_alg_values_supported": ["ES256"] }
      }
    }
  }
}
```

## 2.1 Tamga kısıtları

| Alan | Kural |
|---|---|
| `format` | Her zaman `dc+sd-jwt` ([[SPEC-CRED-0002]] §5.1.1) |
| `credential_signing_alg_values_supported` | Yalnızca `ES256` |
| `proof_signing_alg_values_supported` | Yalnızca `ES256` |
| `vct` | Kayıtlı bir şema olmalı ([[SPEC-SCHEMA-0001]]) |
| `nonce_endpoint` | **Zorunlu** — Tamga her zaman `c_nonce` ister |
| `batch_credential_issuance.batch_size` | **10** (§8) |
| `credential_metadata.credential_reuse_policy` | ETSI TS 119 472-3 §4.2.4.2 `arf_annex_ii`: `["per-relying-party", "once_only"]`, `batch_size` 10, `reissue_trigger_unused` 2, `reissue_trigger_lifetime_left` 7 gün (ARF ISSU_37–40) |
| İmzalı metadata (2026-09-29) | OpenID4VCI §12.2.3, ARF ISSU_32: `Accept: application/jwt` → `typ` `openidvci-issuer-metadata+jwt`, `iss` = `sub` = Credential Issuer Identifier, `iat`, `exp` (+1 gün); imzacı kurumun güven listesindeki belge imza sertifikası (`x5c`). Cüzdan kurumdan belge isterken imzalı metadatayı ister; imzacının parmak izi listedeki kayıtla eşleşmezse metadata kullanılmaz. Düz istek JSON döner. |
| `issuer_info` (2026-09-29) | ETSI TS 119 472-3 §4.2.3, ARF RPRC_22: `registrar_dataset` (`identifier`, `srvDescription`, `registryURI` = ulusal liste, `providesAttestations` = yetkili türler — imzalı listeden) + varsa `registration_cert` ([[ADR-0026]]). Cüzdan kurumdan belge istemeden önce istenen türün kayıtlı olduğunu ve sertifikanın kayıt kurumunca imzalı, geçerli olduğunu denetler (RPRC_22a/23). |

**Değişmez PR2:** `credential_configurations_supported` içindeki her `vct`,
belge verenin zincirde **yetkilendirildiği** bir şema olmalıdır
([[SPEC-BC-0001]] §3.4). Metadata üretilirken bu kontrol edilir; yetkisiz
şema metadata'da yer alamaz.

Bu, yetki kontrolünü doğrulama anından **belge verme anına** çeker. Doğrulayıcı tarafı
zaten kontrol ediyor (`isAuthorizedForSchema`), ama belge verenin hatalı yapılandırma
yüzünden reddedilecek belge üretmesinin önüne geçer.

---

# 3. Credential Offer

## 3.1 Nesne

```json
{
  "credential_issuer": "https://issuer.bilgi.edu.tr",
  "credential_configuration_ids": ["TamgaDiplomaCredential"],
  "grants": {
    "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
      "pre-authorized_code": "oaKazRN8I0IbtZ0C7JuMn5",
      "tx_code": {
        "input_mode": "numeric",
        "length": 6,
        "description": "OBS ekranındaki 6 haneli kodu girin"
      }
    }
  }
}
```

## 3.2 Taşınması

QR kodu boyutunu küçük tutmak için **`credential_offer_uri`** kullanılır,
nesnenin kendisi gömülmez:

```
openid-credential-offer://?credential_offer_uri=
  https%3A%2F%2Fissuer.bilgi.edu.tr%2Foffer%2F8a3f9c21
```

**Değişmez PR3:** Offer URI **tek kullanımlıktır** ve 5 dakika sonra geçersizdir.
Çekildikten sonra 404 döner.

Masaüstünde QR, mobilde derin bağlantı (aynı OBS sayfası cihaz tipine göre
seçer).

## 3.3 Teklif sınıfları (D-PROTO-1)

| Sınıf | Nerede görünür | Ömür | `tx_code` kanalı | Ek kural |
|---|---|---|---|---|
| `on-screen` | OBS/portal ekranında (öğrenci oturum açmış) | **5 dk**, tek kullanımlık (PR3) | Ekranda (kanal = oturum) | §3.2 aynen |
| `out-of-band` | E-posta (veya SMS) ile gönderilen QR/link | **≤ 72 saat**, tek kullanımlık | **Farklı kanaldan** (e-posta offer → SMS `tx_code`), 6 hane | 3 yanlış deneme → offer yanar; kanal adresi yalnızca kurumun kayıtlı verisinden; belge verildikten sonra her iki kanala "cüzdana eklendi" bildirimi |

| `identity-bound` ([[ADR-0020]]) | Kurumun kendi kanalıyla ilettiği bağlantı/QR (e-posta, öğrenci portalı) | **7 gün**, tek kullanımlık | **Yok** — kişi kimlik attestation'ını sunar | `authorization_code` grant'ı; §3.4 |

Kullanılmış offer ikinci kez tarandığında cüzdan "bu davet kullanılmış" der; öğrenci "QR'ım çalışmıyor" dediği anda
ihlal fark edilir → operatör paneli: iptal + yeniden belge verme.

## 3.4 Kimliğe bağlı teklif ([[ADR-0020]], 2026-09-29)

Kurum teklif oluştururken (`POST /{slug}/api/v1/offers`, `docs/api/tamga-issuer-api.openapi.yaml`) kişinin eşleştirme
anahtarlarını (`bind { personal_administrative_number, birth_date }`) gönderirse teklif **kimliğe bağlı** olur:

```json
{
  "credential_issuer": "https://issuer.tamga.network/example-university",
  "credential_configuration_ids": ["urn:tamga:edu:DiplomaCredential:1"],
  "grants": { "authorization_code": { "issuer_state": "b3f1c2…" } }
}
```

- Pre-authorized kod ve `tx_code` yoktur; akış §11.2'dir. Cüzdan [[t:PAR]]'da `issuer_state`'i gönderir; belge veren teklifin geçerli,
  kullanılmamış ve aynı belge türü için olduğunu denetler.
- Belge veren anahtarları düz saklamaz: kurum başına anahtarlı özet (HMAC-SHA-256) tutulur. §11.2 adım 3'te sunulan kimlik
  [[t:attestation]]'ındaki T.C. kimlik no + doğum tarihinin özeti teklifteki özetle eşleşmezse `access_denied` (AS2). Eşleşirse teklif
  tüketilir (tek kullanımlık) ve belge bilgileri kurumun kaynağından okunur (`fetch`, AS1).
- Bağlantıyı kişiye kurum iletir; Tamga iletişim adresi almaz (AS3). Kimlik attestation'ı olmayan kişi için `tx_code`'lu teklif
  (§3.3) yedek olarak kalır.

---

# 4. Token Endpoint

```http
POST /token HTTP/1.1
Host: issuer.bilgi.edu.tr
Content-Type: application/x-www-form-urlencoded
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2IiwiandrIjp7Li4ufX0...

grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code
&pre-authorized_code=oaKazRN8I0IbtZ0C7JuMn5
&tx_code=493812
```

```json
{
  "access_token": "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NiJ9...",
  "token_type": "DPoP",
  "expires_in": 300
}
```

**[[t:DPoP]] zorunludur (RFC 9449; [[t:HAIP]]; 2026-09-29).** Cüzdanın belge alma akışı başına geçici bir P-256 anahtarı üretir ve `/token`
isteğine `DPoP` kanıtı (`typ: dpop+jwt`, `jwk`, `jti`, `htm`, `htu`, `iat`) ekler. Belge veren kanıtı doğrular, belirteci
anahtarın parmak izine (`jkt`) bağlar ve `token_type: DPoP` döner. Kanıt tek kullanımlıktır (`jti`), ±5 dakika penceresi
vardır. AS metadata `dpop_signing_alg_values_supported: ["ES256"]` ilan eder.

**`c_nonce` burada YOKTUR** — 1.0 Final'de Nonce Endpoint'e taşındı (§5).

Erişim belirteci ömrü **5 dakikadır**. İhraç akışı saniyeler sürer; uzun ömür
gereksiz risktir.

---

## 4.1 Yenileme belirteci — sessiz kopya yenileme ([[ADR-0023]], 2026-09-29)

Kurum belgelerinde (öğrenci, diploma; biletler hariç) token yanıtı bir `refresh_token` taşır. Belirteç o belge verme işlemindeki DPoP
anahtarına ve cüzdan örneğine ([[t:WUA]] `sub`) bağlıdır; belge veren yalnız SHA-256 özetini saklar (operatör veritabanı, 180 gün).
Cüzdan eşikte (`credential_reuse_policy`) ve rastgele gecikmeyle şunu gönderir:

```http
POST /token
DPoP: <aynı anahtarla yeni kanıt>
OAuth-Client-Attestation: <WUA>
OAuth-Client-Attestation-PoP: <PoP>

grant_type=refresh_token&refresh_token=…
```

Belge veren belirteci tek kullanımlık olarak alır (siler). DPoP anahtarı ve WUA `sub` eşleşmeli. Kaydı yetkili kaynaktan yeniden okur;
kayıt yoksa `invalid_grant` döner ve belirteç düşer. Kişi kayıt defterinden silinince o kişinin bütün belirteçleri silinir.
Yanıt yeni erişim belirteci ve **yeni** `refresh_token` taşır (rotation). Belge isteği §7 ile aynıdır. Kimlik servisi ve
iletişim belgeleri belirteç vermez (kişi alanı saklanmaz). AS metadata `grant_types_supported` `refresh_token` içerir.

---

# 5. Nonce Endpoint

Korumasızdır — erişim belirteci gerekmez.

```http
POST /nonce HTTP/1.1
Host: issuer.bilgi.edu.tr
```

```json
{ "c_nonce": "wKI4LT-mMoScTmxmQaMbtcMbtcpaSl" }
```

| Kural | Değer |
|---|---|
| Ömür | 60 saniye |
| Kullanım | **Tek sefer** — tüketilir |
| Depo | Atomik (yarış koşulu = tekrar oynatma açığı) |

**Değişmez PR4:** `c_nonce` tüketimi atomik olmalıdır. "Kontrol et, sonra sil"
iki adımı arasındaki yarış, aynı kanıtın iki kez kullanılmasına izin verir.

---

# 6. Key Proof

Cüzdan, belgenin bağlanacağı özel anahtarı kontrol ettiğini kanıtlar.

Başlık:

```json
{
  "typ": "openid4vci-proof+jwt",
  "alg": "ES256",
  "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
}
```

Gövde:

```json
{
  "aud": "https://issuer.bilgi.edu.tr",
  "iat": 1789000012,
  "nonce": "wKI4LT-mMoScTmxmQaMbtcMbtcpaSl"
}
```

| Claim | Anlam |
|---|---|
| `aud` | Credential Issuer tanımlayıcısı — başka belge verene yeniden sunulamaz |
| `iat` | Üretim anı |
| `nonce` | Nonce Endpoint'ten alınan `c_nonce` — tazelik |

Başlıktaki `jwk`, belgenin `cnf` claim'ine giren public key'dir
([[SPEC-CRED-0002]] §5.3). Özel anahtar cihazın güvenli bölgesinden çıkmaz.

**Değişmez PR5:** `alg` yalnızca `ES256`. `none` veya simetrik algoritma
reddedilir.

---

# 7. Credential Endpoint

## 7.1 İstek

```http
POST /credential HTTP/1.1
Host: issuer.bilgi.edu.tr
Authorization: DPoP eyJ0eXAiOiJhdCtqd3Qi...
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIs...   (aynı anahtar; ath = SHA-256(access_token))
Content-Type: application/json

{
  "credential_configuration_id": "TamgaDiplomaCredential",
  "proofs": {
    "jwt": ["eyJ0eXAiOiJvcGVuaWQ0dmNpLXByb29mK2p3dCI..."]
  }
}
```

## 7.2 Yanıt

```json
{
  "credentials": [
    { "credential": "eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCJ9...~WyJPdkt...~WyJoTjJ...~" }
  ],
  "notification_id": "3fwe98js"
}
```

Dönen dize, [[SPEC-CRED-0002]] §2'deki birleşik biçimdir: issuer-signed JWT +
disclosure'lar + sondaki boş `~` (KB-JWT henüz yok).

## 7.3 Belge veren tarafında doğrulama sırası

```
1. Erişim belirteci geçerli ve kapsamı bu configuration'ı içeriyor mu
2. proofs.jwt dizisi boş değil, uzunluğu batch_size'ı aşmıyor
3. Her kanıt için:
     a. typ == "openid4vci-proof+jwt", alg == ES256
     b. imza, başlıktaki jwk ile doğrulanıyor
     c. aud == kendi credential_issuer değerim
     d. nonce geçerli ve TÜKETİLMEMİŞ → atomik tüket
     e. iat pencerede
4. Kanıtlardaki jwk'lar BİRBİRİNDEN FARKLI mı (§8.2)  ← Tamga kuralı
5. Şema yetkisi hâlâ geçerli mi (zincir/indeksleyici)
6. Credential'ı üret, imzala
```

Adım 5 gereksiz görünebilir — metadata üretilirken kontrol edilmişti (PR2).
Ama yetki metadata önbelleklendikten sonra geri alınmış olabilir. Ucuz bir
kontroldür ve yanlış belge üretmenin bedeli yüksektir.

---

# 8. Toplu belge verme

> Bu bölüm [[SPEC-SCHEMA-0002]] Açık Konu 1b ve [[SPEC-CRED-0002]] Açık Konu 4'ü
> kapatır.

## 8.1 Neden

Aynı belgeyi iki [[t:verifier|doğrulayıcıya]] sunan bir kullanıcı, o iki doğrulayıcı iş birliği
yaparsa eşleştirilebilir ([[SPEC-CRED-0003]] §9.4). Çözüm, her sunumda **farklı
bir kopya** kullanmaktır.

Ayrıca öğrenci belgesinin tazelik politikası ([[SPEC-SCHEMA-0002]] §2.1.2) sık
yenileme gerektiriyor; batch, bunu belge verene her seferinde gitmeden mümkün kılar
ve "bu kişi belgesini ne sıklıkla kullanıyor" sinyalini keser.

## 8.2 Her kopya farklı anahtar kullanır — kritik kural

**Değişmez PR6:** Bir batch'teki kopyaların her biri **farklı bir cihaz
anahtarına** bağlanır. Aynı `cnf` kullanılırsa kopyalar birbirine bağlanabilir
ve batch'in tüm amacı yok olur.

Bu, cüzdanın parti başına N anahtar üretmesi demektir. Modern güvenli
bölgeler bunu ucuz yapar; anahtarlar tek seferde üretilip saklanır.

```json
"proofs": {
  "jwt": [
    "<kanıt: anahtar 1>",
    "<kanıt: anahtar 2>",
    "...",
    "<kanıt: anahtar 10>"
  ]
}
```

Belge veren, her kanıt için ayrı bir belge üretir ve her birine o kanıtın
`jwk`'ini `cnf` olarak koyar.

Adım 7.3/4'teki "jwk'lar birbirinden farklı mı" kontrolü bu kuralı **belge veren
tarafında zorlar** — hatalı bir cüzdan uygulaması aynı anahtarla 10 kanıt
gönderirse istek reddedilir.

## 8.3 Parti büyüklüğü: 10

| Değer | Değerlendirme |
|---|---|
| 1 (batch yok) | Korelasyon açık |
| 5 | Tipik kullanım için sınırda |
| **10** | **Seçildi** |
| 50+ | Kullanılmayan kopya birikir; diplomada status indeksi israfı |

Gerekçe: 90 günlük öğrenci belgesinde tipik kullanım birkaç sunumdur; 10 kopya
rahat yeter. Diplomada da bir başvuru sezonu için yeterlidir.

## 8.4 Toplu diplomanın ek maliyeti

Diploma iptal listesi kullanır ([[SPEC-SCHEMA-0002]] §3.1). Her kopya **ayrı bir
status indeksi** tüketir. 10 kopya = 10 indeks.

100.000'lik listede bu önemsizdir (10.000 mezun × 10 = 100.000 — sınırda; iki
liste açılır).

**İptal ederken dikkat:** Bir diploma iptal edildiğinde **10 indeksin hepsi**
işaretlenmelidir. Belge veren, hangi indekslerin aynı diplomaya ait olduğunu kendi
veritabanında tutar — bu eşleme **asla dışarı çıkmaz**, çünkü çıkarsa
kopyaların ilişkilendirilemezliği biter.

10 bitin aynı anda değişmesi bir korelasyon sinyali olurdu; ancak yayın sabit
aralıklı ve gürültülü olduğu için ([[SPEC-CRED-0003]] §5.1) dışarıdan
görünmez.

## 8.5 Faz kararı

| Belge | Batch |
|---|---|
| `TamgaStudentCredential` | **ilk aşamada etkin** — kısa ömür + sık kullanım |
| `TamgaDiplomaCredential` | **devlet aşamasına ertelendi** — status indeksi yönetimi ek karmaşıklık |

Pilotta diploma tek kopya verilir ve `idx` korelasyonu **kabul edilmiş risk**
olarak katılımcılara bildirilir ([[PM-GOV-0001]] §Pilot).

---

# 9. Ertelenmiş belge verme (deferred)

Mezuniyet kararı henüz onaylanmamışsa belge veren belgeyi hemen veremez.

```json
{ "transaction_id": "8xLOxBtZp8", "interval": 300 }
```

Cüzdan sonra Deferred Credential Endpoint'e sorar:

```http
POST /deferred HTTP/1.1
Authorization: Bearer ...

{ "transaction_id": "8xLOxBtZp8" }
```

Hazır değilse `issuance_pending` hatası döner; cüzdan `interval` kadar bekler.

**Tamga kuralı:** `transaction_id` ömrü **30 gün**. Fakülte kurulu kararı
gecikebilir; ama sınırsız bekleyen işlem, belge veren tarafında sınırsız durum
demektir.

**Mahremiyet notu:** Cüzdanın düzenli yoklaması (polling) belge verene "bu kişi
hâlâ bekliyor" sinyali verir. `interval` en az 300 saniye olmalıdır ve cüzdan
üstel geri çekilme uygulamalıdır.

---

# 10. Notification Endpoint

Cüzdan, belgeyi başarıyla sakladığını bildirir:

```json
{ "notification_id": "3fwe98js", "event": "credential_accepted" }
```

Değerler: `credential_accepted`, `credential_failure`, `credential_deleted`.

**Tamga kuralı:** `credential_deleted` bildirimi belge veren tarafında **yalnızca
sayaç olarak** kullanılır; kullanıcı bazında saklanmaz. Aksi hâlde belge veren,
kullanıcının belgesini sildiğini öğrenir — gereksiz bir davranış sinyali.

---

# 11. Belge vermede Holder Binding ve Güvence

[[SPEC-CRED-0001]] §3'ün protokol karşılığı. İhraçtaki [[t:holder-binding]] yöntemi, [[t:holder]]
assurance seviyesini ([[t:LoA]]) belirler ([[PM-ASSUR-0001]] Eksen A).

| Yöntem | Nasıl | Seviye |
|---|---|---|
| **Uzaktan — OBS oturumu** | Öğrenci OBS'ye kendi girer, offer üretilir, `tx_code` OBS ekranında | **T1** (2FA'lı OBS ise T2) |
| **Yüz yüze — masa** | Memur fiziksel kimliği görür, cüzdandaki QR'ı okutur | **T2/T3** (kurum kayıt otoritesi) |
| **eID çipi** | NFC ile devlet kimliğinden okuma | **T3** — devlet aşaması |

**Kapsam sınırı hatırlatması:** Hiçbiri "karşımdaki insan bu kişi" sorusunu
kriptografik olarak çözmez ([[SPEC-CRED-0001]] §3, kapsam sınırı). Yüz yüze
bağlama en güçlüsüdür çünkü **prosedürel** doğrulamayı belge verme anına taşır.

**Uzaktan [[t:identity-proofing]] (T2):** lisanslı sağlayıcıyla belge + canlılık + yüz eşleştirme; profil ve sağlayıcı
entegrasyonu [[SPEC-ID-0003]]. Tip ↔ asgari seviye [[FW-RB-0002]] §4 (öğrenci belgesi T1, diploma T2).

## 11.1 Wallet unit doğrulaması (D-CRED-6 — ETSI TS 119 471 REQ-EAASP-4.2.1.2-02/03)

Belge veren, **grant'tan önce** cüzdanın Wallet Unit Attestation'ını doğrular. Taşıma: OAuth 2.0 Attestation-Based Client
Authentication (HAIP) — token isteğinde iki başlık:

| Başlık | İçerik | Doğrulama |
|---|---|---|
| `OAuth-Client-Attestation` | WUA JWT (`typ: oauth-client-attestation+jwt`, x5c = Cüzdan sağlayıcısı sertifikası; claim'ler [[SPEC-CRED-0001]] §4) | x5c yaprağı `lotl.wallet_providers[].wua_signing_keys` içinde (`TrustSource.isWalletProviderKey`; UNKNOWN → `503 temporarily_unavailable`), `exp`, `cnf` P-256, `key_storage` ≥ kiracı politikası (WL3) |
| `OAuth-Client-Attestation-PoP` | `typ: oauth-client-attestation-pop+jwt`; `iss` = WUA `sub`, `aud` = `credential_issuer`, `iat` (±300 s), `jti`; WUA `cnf` anahtarıyla imzalı | imza, aud, iat, jti |

Hata: `invalid_client` (eksik/geçersiz). Sonuç (`solution_id`, `key_storage`) token kaydına ve denetim kaydına yazılır;
**belgeye girmez**. Demo: `key_storage: software` kabul (sapma S-9/S-14); pilot: `secure_enclave`/`strongbox`.

### 11.1.1 WIA + KA — AB TS3 ([[ADR-0025]], 2026-09-29)

Aynı başlıklarla **WIA** (Wallet Instance Attestation) gönderilir:
- `client_status {status, exp}` taşır,
- ömrü **< 24 saat**tir,
- her belge işleminde **yeni PoP anahtarı** ve **yeni iptal girişiyle** alınır.

Belge veren imzayı, sağlayıcı anahtarını, PoP'u ve `client_status`'u ([[t:wallet-provider|cüzdan sağlayıcısının]] Token Status List'i; iptal → `invalid_client`,
liste alınamaz → 503) doğrular. WIA anahtar deposu beyanı taşımaz.

Belge isteğinde paket **tek proof** ile istenir:
- `typ: openid4vci-proof+jwt`, başlıkta `key_attestation` ([[t:key-attestation]], KA: `keyattestation+jwt`, sağlayıcı imzalı, `attested_keys`,
  `key_storage` / `user_authentication` ISO 18045, `key_storage_status`),
- proof `attested_keys[0]` ile imzalıdır.

Belge veren KA'yı, iptal durumunu ve nonce'u doğrular, belgeleri `attested_keys`'e bağlar. Kiracının `min_key_storage` alt sınırını
KA'daki seviyeye göre uygular.

Metadata `proof_types_supported.jwt.key_attestations_required` kabul edilen seviyeleri ilan eder (ARF ISSU_27d). Eski WUA ve anahtar
başına proof biçimi pilot öncesine kadar kabul edilir.

**Değişmez PR7:** İhraç edilen belgenin hangi bağlama yöntemiyle
verildiği belge veren denetim kaydına yazılır. Belgenin **içine yazılmaz** —
belge sahibi assurance zincire de belgeye da girmez ([[PM-TRUST-0001]]).

---

## 11.2 Cüzdanın başlattığı belge verme — authorization code (ADR-0011 K3, D-ID-6)

Cüzdan, kurum dizinini **[[t:trust-list|güven listesinden]]** okur (`tl-<cc>.issuers[]`; ek sunucu yok) ve kurumdan doğrudan belge ister.
Kimlik doğrulama bu yolda **kimlik attestation'ının sunumu** ile yapılır; öğrenci girişi/OBS gerekmez. Pre-authorized yol
(§3) aynen kalır; kurum ikisini de sunar.

| Adım | Cüzdan → belge veren | Kural |
|---|---|---|
| 1 | `POST /{slug}/par` — `client_id` = WUA `sub`, `redirect_uri`, `code_challenge` (S256), `authorization_details[{type: openid_credential, credential_configuration_id}]`, `state`, kimliğe bağlı teklifte `issuer_state` (§3.4); başlıklar `OAuth-Client-Attestation` + PoP | PAR zorunlu (RFC 9126); istemci kimliği **WUA** (`attest_jwt_client_auth`); `client_secret` yok; PAR 10 dk |
| 2 | `GET /{slug}/authorize?client_id&request_uri` — `Accept: application/json` | Kurumun belge verme servisi **OpenID4VP isteği** döner (`presentation_request.qr_payload`; DCQL: `IdentityAttestation` → `personal_administrative_number`, `birth_date`, `given_name`, `family_name`); istek `rp-<slug>` sertifikasıyla imzalı, RP kaydı güven listesinde (AP6 scope) |
| 3 | Cüzdan **standart sunum akışını** çalıştırır (SPEC-PROTO-0002: RP kaydı, onay ekranı, KB-JWT, JWE) → `POST /{slug}/vp/response` | Belge veren T0 + A–E ile doğrular (status ön çekimi S12), **TCKN + doğum tarihi** ile eşler: `issuer_state` varsa teklifteki özetle (§3.4), yoksa kurumun kaynağına `lookup` ([[ADR-0020]]; `docs/api/institution-source.openapi.yaml`); kaynak erişilemezse `temporarily_unavailable`; yanıt `{redirect_uri}` = `redirect_uri?code=…&state=…` veya `error=access_denied` |
| 4 | `POST /{slug}/token` — `grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`, WUA başlıkları | code tek kullanımlık, ≤ 60 s; PKCE; istemci PAR'daki WUA `sub` ile aynı |
| 5 | `/nonce` → proof'lar → `/credential` | §5–§8 aynen (10 kopya, PR6) |

Tamga kimlik servisi (`id.tamga.network`) aynı akışı **tarayıcı** ile çalıştırır: `/authorize` KVKK aydınlatma + açık rıza →
uzaktan doğrulama sağlayıcısı → `/idv/return` (karar sorgulama) → `redirect_uri?code`. ETSI 472-3 uyarınca T3 yalnızca bu yolla
verilebilir (pre-authorized ile asla, IDP7). Metadata: `pushed_authorization_request_endpoint`, `authorization_endpoint`,
`require_pushed_authorization_requests: true`, `code_challenge_methods_supported: ["S256"]`, `grant_types_supported` her iki grant.

# 12. Uçtan Uca — Ayşe'nin Diploması

```
Ayşe                    OBS/Issuer                   Zincir
 │                          │                           │
 │─ OBS'de oturum aç ──────▶│                           │
 │─ "Diplomamı al" ────────▶│                           │
 │                          │─ şema yetkisi kontrol ───▶│  (indeksleyici)
 │                          │◀─ yetkili ────────────────│
 │◀─ QR + tx_code 493812 ───│                           │
 │                          │                           │
 │  [cüzdanla QR okut]      │                           │
 │─ GET offer_uri ─────────▶│                           │
 │◀─ credential offer ──────│                           │
 │                          │                           │
 │─ tx_code gir ───────────▶│                           │
 │─ POST /token ───────────▶│                           │
 │◀─ access_token (5 dk) ───│                           │
 │                          │                           │
 │─ POST /nonce ───────────▶│                           │
 │◀─ c_nonce ───────────────│                           │
 │                          │                           │
 │  [cihaz anahtarı üret]   │                           │
 │  [key proof imzala]      │                           │
 │─ POST /credential ──────▶│                           │
 │                          │  · kanıtı doğrula         │
 │                          │  · nonce'u atomik tüket   │
 │                          │  · OBS'den veri çek       │
 │                          │  · ISCED-F eşle           │
 │                          │  · disclosure üret        │
 │                          │  · status idx rezerve et  │
 │                          │  · HSM ile imzala         │
 │◀─ SD-JWT VC ─────────────│                           │
 │                          │                           │
 │─ POST /notification ────▶│                           │
 │  (credential_accepted)   │                           │
```

**Zincire hiçbir şey yazılmadı.** Status indeksi rezervasyonu belge verenin kendi
veritabanındadır ([[SPEC-BC-0001]] §11.1 adım 7).

---

# 13. Hata Yanıtları

| Kod | Ne zaman | Cüzdan davranışı |
|---|---|---|
| `invalid_proof` | Kanıt geçersiz veya `nonce` bayat | Yeni `c_nonce` al, tekrar dene |
| `invalid_nonce` | `nonce` tüketilmiş | Yeni `c_nonce` al |
| `invalid_credential_request` | Yapı hatalı | **Tekrar deneme** — hata bildir |
| `unsupported_credential_configuration` | Bilinmeyen configuration | Metadata'yı yenile |
| `issuance_pending` | Ertelenmiş, hazır değil | `interval` kadar bekle, üstel geri çekilme |
| `credential_request_denied` | Yetki yok / şema yetkisi düşmüş | **Tekrar deneme** |
| `invalid_token` | Belirteç süresi doldu | Akışı baştan başlat |

**Değişmez PR8:** Hata mesajları kişisel veri içermez. "Ayşe Yılmaz için kayıt
bulunamadı" yerine `credential_request_denied` döner; ayrıntı yalnızca belge verenin
kendi denetim kaydındadır.

---

# 14. Değişmezler

| # | Değişmez |
|---|---|
| **PR1** | Pre-authorized akışta `tx_code` atlanamaz. |
| **PR2** | Metadata'daki her `vct`, belge verenin zincirde yetkilendirildiği bir şemadır. |
| **PR3** | Belge teklifi URI tek kullanımlık, 5 dakika ömürlü. |
| **PR4** | `c_nonce` tüketimi atomiktir. |
| **PR5** | Kanıt ve belge imzası yalnızca `ES256`. |
| **PR6** | Batch'teki her kopya **farklı cihaz anahtarına** bağlanır. |
| **PR7** | Bağlama yöntemi denetim kaydına yazılır, belgeye yazılmaz. |
| **PR8** | Hata yanıtları kişisel veri içermez. |
| **PR9** | Erişim belirteci ömrü ≤ 5 dakika. |
| **PR10** | Kopya↔indeks eşlemesi belge verende kalır, asla dışarı çıkmaz. |
| **PR11** | İhraçtan önce Wallet Unit Attestation + PoP doğrulanır; WUA imzacısı güven listesindeki cüzdan sağlayıcısı anahtarlarından biridir; `key_storage` kiracı politikasını karşılamıyorsa belge verilmez (§11.1). |
| **PR12** | `out-of-band` offer'da `tx_code` offer ile **farklı kanaldan** iletilir; üç yanlış deneme offer'ı geçersiz kılar; kanal adresi yalnızca kurumun kayıtlı verisinden gelir (§3.3). |
| **PR13** | Authorization code akışında PAR ve PKCE (S256) zorunludur; istemci kimliği Wallet Unit Attestation'dır (`client_secret` yok); `redirect_uri` PAR'da bağlanır ve `/authorize`'da değiştirilemez; `redirect_uri` istemcinin kayıtlı adresleriyle birebir eşleşmelidir (izin listesi; aksi hâlde `invalid_redirect_uri`); token isteği PAR'daki `redirect_uri`'yi ve aynı `client_id`'yi (WUA `sub`) taşımalıdır (aksi hâlde `invalid_grant`); cüzdan token ucunu yetkilendirme sunucusunun meta verisinden (`token_endpoint`, RFC 8414) alır; code tek kullanımlık ve ≤ 60 s (§11.2). |
| **PR14** | Kurumun belge verme servisi cüzdanın başlattığı belge vermede kimliği yalnızca **kimlik attestation'ının sunumu** ile ve tam doğrulama hattından (T0 + A–E) geçerek eşler; eşleştirme anahtarları (TCKN, doğum tarihi) saklanmaz ve loglanmaz; eşleşmezse belge verilmez (§11.2, [[ADR-0011]] K3/K6). |
| **PR15** | Cüzdan kurum dizinini yalnızca güven listesinden alır; listede olmayan belge verene PAR göndermez (§11.2). |
| **PR17** | Erişim belirteci DPoP'a bağlıdır (RFC 9449): `/token` geçerli bir DPoP kanıtı olmadan belirteç vermez; `/credential` yalnızca `Authorization: DPoP` ve aynı anahtarla, bu uç ve bu belirteç (`ath`) için üretilmiş, daha önce görülmemiş kanıtla çalışır (§4, §7.1). |
| **PR18** | Yenileme belirteci tek kullanımlıktır, her kullanımda yenilenir, belge verme işlemindeki DPoP anahtarına ve cüzdan örneğine bağlıdır; belge veren yenilemede kaydı yetkili kaynaktan yeniden okur ve kayıt yoksa belge vermez ([[ADR-0023]] AR2–AR3, §4.1). |
| **PR19** | WIA ile gelen istekte `client_status` iptal edilmişse belge verilmez; KA'lı proof'ta KA sağlayıcı imzalı, iptal edilmemiş, proof `attested_keys[0]` ile imzalı ve nonce geçerli olmalıdır; anahtar deposu alt sınırı KA seviyesine göre uygulanır ([[ADR-0025]], §11.1.1). |
| **PR16** | Kimlik attestation'ı yanıtında her `credentials[]` nesnesi, `credential` (SD-JWT VC) ile **aynı proof anahtarına bağlı** bir `mso_mdoc` (base64url IssuerSigned, ISO 18013-5) taşır; iki temsil aynı istekte üretilir, aynı status bitini paylaşır; cüzdan mdoc'u SD-JWT kopyasıyla çapraz doğrulamadan (aynı belge veren sertifikası, aynı alanlar, `deviceKey` = `cnf`) saklamaz ([[ADR-0013]] MD1–MD3). |

---

# Güvenlik ve Mahremiyet Notları

**Offer QR'ı bir sırdır.** `tx_code` olmadan, ekranı fotoğraflayan biri
belgeyi kendi cüzdanına alabilir. PR1 ve PR3 birlikte bu pencereyi kapatır.

**Nonce yarışı.** PR4 atlanırsa aynı kanıt iki kez kullanılabilir; batch
senaryosunda bu, saldırganın kendi anahtarını kopyalardan birine
bağlamasına yol açar.

**Yoklama bir sinyaldir.** Ertelenmiş belge vermede cüzdanın sık sorgulaması
belge verene davranış bilgisi verir (§9).

**Batch, kopya sayısını ele verir.** Bir doğrulayıcı, aynı kullanıcıdan gelen
sunumların hepsinin farklı `cnf` taşıdığını görürse batch kullanıldığını
anlar — ama **hangi kopyaların aynı kişiye ait olduğunu** anlayamaz. İstenen
budur.

---

# Açık Konular

1. ~~Batch kopyaları tükendiğinde~~ — **KAPANDI** ([[SPEC-WALLET-0001]] §4.3):
   2 kopya kalınca bildirim; tükenince **bilinen** doğrulayıcıda sorun yok
   (yapışkan eşleme), **yeni** doğrulayıcıda kullanıcıya seçim sunulur — yenile
   veya korelasyon uyarısıyla mevcut kopyayı yeniden kullan.
2. ~~Wallet Unit Attestation (WUA) belge verme anında zorunlu mu olmalı?~~ — **KAPANDI (§11.1, DB-16):**
   zorunlu; cüzdan sağlayıcısı kaydı liste aşamasında güven listesinde (`lotl.wallet_providers[]`), Provider servisini cüzdanı sunan kuruluş işletir ([[ADR-0042]]); ağ işletmez.
3. ~~Authorization code akışı ilk aşamada hiç uygulanacak mı?~~ — **KAPANDI (§11.2, [[ADR-0011]] D-ID-6):** uygulandı;
   PAR + PKCE + WUA istemci kimliği; kurumda kimlik attestation sunumu, Tamga kimlik servisinde tarayıcı + IDV.
4. `batch_size` = 10 tahminîdir; pilot kullanım verisiyle kalibre edilmeli.
5. Diploma batch'i devlet aşamasına ertelendi (§8.5) — status indeksi kapasitesi ve
   iptal prosedürü o zaman yeniden hesaplanmalı.

---

# İlgili Dokümanlar

[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-PROTO-0002]] ·
[[SPEC-BC-0001]] · [[PM-ASSUR-0001]] · [[PM-TRUST-0001]] · [[PM-GOV-0001]] ·
[[ARCH-0003]] · [[ARCH-0005]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

