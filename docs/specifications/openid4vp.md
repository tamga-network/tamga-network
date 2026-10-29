---
document_id: SPEC-PROTO-0002
title: "OpenID4VP profili"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-29
summary: >
  Bir belgenin cüzdandan doğrulayıcıya nasıl gösterildiğini tanımlar. OpenID4VP
  1.0 Final üzerine Tamga profili: DCQL sorguları (Presentation Exchange
  KULLANILMAZ), imzalı istek nesnesi, yanıt şifreleme, tarayıcıda Digital
  Credentials API. Merkezî bulgu: HAIP'in zorunlu kıldığı `x509_hash` client
  identifier prefix'i, base64url(SHA-256(DER)) değeridir — bu, zincirdeki
  `RelyingParty.accessCertFingerprint` ile TAM OLARAK AYNI BAYTLARDIR.
  Dolayısıyla cüzdan, istekteki client identifier'ı doğrudan zincir kaydına
  çözebilir ve aşırı talep denetimini ([[SPEC-BC-0001]] §6) protokol
  seviyesinde uygulayabilir. Ek olarak istenmeyen alan tespiti, sunum sonrası
  kullanıcı kaydı ve yanıt şifreleme kuralları.
---
**Bu şartname, bir [[t:credential|belgenin]] cüzdandan [[t:verifier|doğrulayıcıya]] nasıl gösterildiğini [[t:OpenID4VP]] 1.0 ve
[[t:HAIP]] 1.0 üzerinden tanımlar.** Doğrulayıcı ya da cüzdan yazan geliştiriciler içindir.

**Ne zaman okunur**

- Önce [Belge gösterme (OpenID4VP)](/concepts/presentation) kavram sayfasını okuyun; adım adım uygulama için [Sunucuda doğrulama](/guides/verify-on-server).
- Doğrulayıcının imzalı isteğini, [[t:DCQL]] sorgusunu ve cüzdanın yanıtını kurarken.
- Sonra: yanıtın nasıl doğrulandığı [[SPEC-API-0001]].

**Kısaca.** Doğrulayıcı imzalı bir istek hazırlar ve QR, bağlantı ya da tarayıcı (Digital Credentials API) üzerinden cüzdana iletir.
İstek, hangi belgeden hangi alanların istendiğini bir DCQL sorgusuyla söyler; doğrulayıcının kimliği sertifikasının özetiyle
([[t:x509_hash]]) belirlenir. Cüzdan doğrulayıcının adını ve istediklerini kişiye gösterir; istek doğrulayıcının kayıtlı kapsamını aşıyorsa
kişiyi uyarır. Kişi onaylarsa cüzdan yalnızca istenen alanları, [[t:KB-JWT]] ile birlikte gönderir.

---

# Kapsam

Bu şartname **belge göstermeyi (presentation)** tanımlar: belgenin cüzdandan doğrulayıcıya
gidişi. Belge verme (issuance) [[SPEC-PROTO-0001]]'dedir.

**Standart temeli:** OpenID for Verifiable Presentations **1.0 (Final)** ve
HAIP 1.0. Format [[SPEC-CRED-0002]], doğrulama mantığı [[SPEC-API-0001]].

**Bu şartnamenin dışında:** ISO/IEC 18013-5 yakın alan (Bluetooth) sunumu OpenID4VP değildir; kendi oturum şifrelemesi ve
SessionTranscript'iyle mdoc taşır ([[ADR-0012]], [[ADR-0013]]; `@tamga-network/mdoc` yakın alan modülü). Kodu hazırdır, gerçek
cihazlarla deneme sürüyor (§7.3).

---

# 1. Presentation Exchange Kullanılmaz

OpenID4VP 1.0 Final ile birlikte sorgu dili **DCQL** (Digital Credentials Query
Language) oldu. Önceki taslaklardaki Presentation Exchange (PE / `presentation_definition`)
Tamga'da **desteklenmez.**

| | Presentation Exchange | **DCQL** |
|---|---|---|
| Durum | Eski taslak | **1.0 Final** |
| Yapı | JSONPath tabanlı filtreler | Bildirimsel, format-farkında |
| SD-JWT VC hedefleme | Dolaylı | `meta.vct_values` ile doğrudan |
| Tamga | ✗ | ✓ |

**Değişmez PV1:** `presentation_definition` parametresi taşıyan bir istek
**reddedilir.** Geriye uyumluluk sunulmaz — Tamga'nın eski yükü yoktur ve PE
kabul etmek iki ayrı sorgu motoru bakımı demektir.

---

# 2. İstemci Kimliği (Client Identifier) — Zincirle Protokolün Buluştuğu Nokta

Bu bölüm dokümanın en önemli kısmıdır.

## 2.1 `x509_hash` nedir

OpenID4VP 1.0'da doğrulayıcı kendini bir **Client Identifier Prefix** ile tanıtır.
HAIP 1.0, X.509 tabanlı ekosistemler için **`x509_hash`**'i zorunlu kılar:

```
client_id: x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk
```

Değer, isteği imzalayan sertifika zincirinin **yaprak sertifikasının DER
kodlanmış hâlinin SHA-256 hash'inin** base64url gösterimidir. İstek, `x5c`
başlığında zinciri taşıyan imzalı bir istek nesnesidir (JAR).

## 2.2 Aynı bayt, iki yerde

[[SPEC-BC-0001]] §6'daki `RelyingParty` yapısı şunu tutuyor:

```solidity
bytes32 accessCertFingerprint;   // SHA-256(X.509 DER)
```

**Bu, `x509_hash` ile aynı baytlardır.** Yalnızca kodlaması farklıdır — biri
`bytes32`, diğeri base64url dize.

Yani cüzdan, gelen istekteki client identifier'ı doğrudan zincir kaydına
çözebilir:

```
x509_hash:Uvo3Htu…  →  base64url-decode  →  32 bayt  →  rpId araması
                                                     →  RelyingParty kaydı
                                                     →  allowedScopes
```

## 2.3 Sonuç — aşırı talep denetimi protokol seviyesinde çalışır

[[SPEC-BC-0001]] §6 "aşırı talep koruması"nı tanımlamıştı ama cüzdanın
doğrulayıcıyı **nasıl tanıyacağı** açık kalmıştı. `x509_hash` bu boşluğu kapatır:

```
1. İstek gelir, x5c zinciri doğrulanır (SPEC-ID-0002)
2. client_id'den fingerprint çıkarılır
3. RelyingPartyRegistry'de aranır (indeksleyici üzerinden)
   ├─ Bulunamadı        → "kayıtsız verifier" uyarısı
   ├─ status != ACTIVE  → REDDET
   └─ Bulundu           → allowedScopes alınır
4. DCQL sorgusundaki her claim, izinli scope'a düşüyor mu?
   ├─ Evet   → normal onay ekranı
   └─ Hayır  → AŞIRI TALEP UYARISI (§6)
```

**Değişmez PV2:** Uyumlu bir Tamga cüzdanı, DCQL sorgusunu göstermeden önce
client identifier'ı zincir kaydına çözmeyi **denemek zorundadır.**

**Desteklenen prefix'ler:**

| Prefix | Tamga |
|---|---|
| `x509_hash` | **Tek kabul edilen** (imzalı istek) — HAIP 1.0 §5; değer = base64url(SHA-256(yaprak sertifika DER)), OpenID4VP 1.0 §5.9.3; güven listesi kaydının `client_id`'siyle eşleşir |
| `x509_san_dns` | **Reddedilir** ([[ADR-0034]]) — yanıt adresinin alanı yine imzalayan sertifikanın SAN'ında olmalıdır. **Tamga profili notu (2026-10-24):** cüzdan (`@tamga-network/wallet-core`) yalnız `x509_hash` kabul eder ve `response_uri`'nin alan adının imzalayan sertifikanın SAN'ında olmasını ayrıca denetler (eski `x509_san_dns` kuralının devamı; yerel geliştirme istisnası yalnız çağıran açıkça açarsa); referans doğrulayıcı (`@tamga-network/verifier`) `x509_san_dns` kimliği üretmez ve işlemez. Bu bilinçli bir kısıttır: HAIP 1.0 §5 yalnız `x509_hash`'i zorunlu kılar; `x509_san_dns` desteği gerekirse ADR ile açılır |
| `origin` | Yalnızca DC API akışında, izleyicide (§7) |
| `redirect_uri` | **Reddedilir** — imzasız, zincire bağlanamaz |
| `decentralized_identifier`, `openid_federation`, `verifier_attestation` | Genişleme aşaması |

`redirect_uri` reddi bilinçlidir: imzasız istek, doğrulayıcının kim olduğunu
kanıtlamaz ve aşırı talep denetimi imkânsız hâle gelir.

---

# 3. Yetkilendirme İsteği

İmzalı istek nesnesi (JAR), `typ: oauth-authz-req+jwt`, `alg: ES256`,
`x5c` zinciri başlıkta.

```json
{
  "client_id": "x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk",
  "response_type": "vp_token",
  "response_mode": "direct_post.jwt",
  "response_uri": "https://ik.ornek-holding.com/vp/response",
  "nonce": "n-0S6_WzA2Mj",
  "state": "af0ifjsldkj",
  "dcql_query": { "...": "§4" },
  "client_metadata": {
    "jwks": { "keys": [ { "kty": "EC", "crv": "P-256", "use": "enc", "...": "..." } ] },
    "encrypted_response_enc_values_supported": ["A128GCM", "A256GCM"],
    "vp_formats_supported": {
      "dc+sd-jwt": {
        "sd-jwt_alg_values": ["ES256"],
        "kb-jwt_alg_values": ["ES256"]
      },
      "mso_mdoc": {
        "issuerauth_alg_values": [-7],
        "deviceauth_alg_values": [-7]
      }
    }
  }
}
```

| Parametre | Tamga kuralı |
|---|---|
| `response_type` | `vp_token` |
| `response_mode` | `direct_post.jwt` (varsayılan) veya `dc_api.jwt` (§7) — **şifresiz mod yok** |
| `nonce` | ≥ 128 bit entropi, tek kullanımlık; `request_uri`'nin her çekiminde yenisi ([[ADR-0067]]) |
| `state` | ≥ 128 bit rastgele, gizli; `request_uri`'nin her çekiminde yenisi — QR'da, `request_uri` ve `response_uri` yolunda yer almaz ([[ADR-0067]]) |
| `request_uri` çekimi | Her çekim (GET ya da `request_uri_method=post` ile POST, OpenID4VP 1.0 §5.10) yeni bir **çekim dalı** açar: aynı içerikle yeni imzalı istek nesnesi; taze `state`, `nonce` ve efemer şifreleme anahtarı (HAIP §5). POST'ta `wallet_nonce` nesneye geri yazılır. Sabit dal sınırı ve meşru çekime 429 yok; bellek sınırlı (yumuşak sınırda yanıtsız yaşlı dal atılır, ortak dal bütçesi; [[ADR-0067]] Değişiklik notu 2026-10-29); hız sınırı istemci adresi başına |
| İstek imzası | **Zorunlu** — imzasız istek reddedilir |
| `client_metadata.jwks` | Yanıt şifreleme anahtarı; **zorunlu** |
| `verifier_info` | İsteğe bağlı ([[ADR-0026]], 2026-09-29): `[{"format": "registration_cert", "data": "<rc-wrp+jwt>", "credential_ids": [...]}]` — kullanımın kayıt sertifikasını (ETSI TS 119 475 / 119 472-2). Varsa cüzdan kayıt birimi imzasını (LOTL `roles.registrar`), süreyi ve `sub`'ın erişim sertifikasındaki `organizationIdentifier` ile aynı olduğunu doğrular; tutmazsa veri gönderilmez (WRC4). Sertifikada olmayan alan fazla istek sayılır (§6). |
| Amaç (`purpose`) | İstek nesnesinde ayrı bir amaç parametresi **yoktur** (OpenID4VP 1.0 §5.1'de tanımlı değil; 2026-10-27). Onay ekranındaki "ne için" metnini cüzdan `verifier_info`'daki kayıt sertifikasının `purpose`'undan (ETSI TS 119 475 kullanım amacı, dil başına) okur; sertifikada yoksa güven listesindeki kayıtlı kullanımın `purpose`'undan. |

**Değişmez PV3:** Şifresiz yanıt modu (`direct_post`, `query`, `fragment`)
kullanılmaz. Sunum, kişisel veri taşır ve taşıyıcı katman şifrelemesine
güvenmek yeterli değildir — `response_uri`'ye giden ara katmanlar (ters proxy,
WAF, log) içeriği görebilir.

---

# 4. DCQL Sorgusu

## 4.1 İşveren senaryosu

[[SPEC-SCHEMA-0002]] §3.7'deki alan seti:

```json
{
  "credentials": [
    {
      "id": "diploma",
      "format": "dc+sd-jwt",
      "meta": {
        "vct_values": [
          "urn:tamga:edu:DiplomaCredential:1"
        ]
      },
      "claims": [
        { "path": ["is_graduate"], "values": [true] },
        { "path": ["qualification_title"] },
        { "path": ["eqf_level"] },
        { "path": ["isced_f_code"] },
        { "path": ["awarding_body_name"] },
        { "path": ["awarding_date"] },
        { "path": ["family_name"] },
        { "path": ["given_name"] }
      ]
    }
  ]
}
```

`values` bulunan claim'de eşleşme koşulu vardır (`is_graduate == true`);
bulunmayanlarda yalnızca açıklanması istenir.

**İstenmeyen alanlar** — `grade`, `thesis_title`, `birth_date`,
`credit_points` — sorguda **yer almaz**, dolayısıyla cüzdan onları
açıklamaz. Bunlar zaten `sd: always` ile zorunlu gizlenebilir
([[SPEC-SCHEMA-0002]] §3.3).

## 4.2 Sürüm esnekliği

`vct_values` bir dizidir. Bir doğrulayıcı birden çok şema sürümünü kabul
edebilir:

```json
"vct_values": [
  "urn:tamga:edu:DiplomaCredential:1",
  "urn:tamga:edu:DiplomaCredential:2"
]
```

Bu, [[SPEC-SCHEMA-0001]] §9.2 ile birlikte çalışır: `DEPRECATED` bir sürümle
verilmiş eski diplomalar hâlâ doğrulanabilir olduğu için, doğrulayıcı iki sürümü
birden kabul edebilmelidir.

**Öneri:** Doğrulayıcılar `vct_values`'a **en az iki sürüm** koyar. Tek sürüm
koymak, şema yükseltmesinde eski mezunları dışarıda bırakır.

## 4.3 Öğrenci indirimi — minimal sorgu

[[t:selective-disclosure|Selective disclosure'ın]] en somut örneği:

```json
{
  "credentials": [
    {
      "id": "student",
      "format": "dc+sd-jwt",
      "meta": {
        "vct_values": ["urn:tamga:edu:StudentCredential:1"]
      },
      "claims": [
        { "path": ["is_enrolled"], "values": [true] }
      ]
    }
  ]
}
```

Sinema `is_enrolled` dışında hiçbir şey görmez — ad, üniversite, bölüm, kayıt
yılı açıklanmaz.

## 4.4 `credential_sets` — alternatifler

Doğrulayıcı "diploma **veya** öğrenci belgesi" gibi seçenekler sunabilir.
Tamga'da kullanılabilir ama **dikkatle**: her ek seçenek, kullanıcının onay
ekranında anlaması gereken bir karmaşıklıktır.

**Kural:** Bir istekte en fazla **3** belge ve en fazla **2**
`credential_sets` girişi. Fazlası, kullanıcının bilinçli onay verme
yeteneğini aşar.

**Cüzdan davranışı** (OpenID4VP 1.0 §6.4; referans: `@tamga-network/wallet-core` `selectDcql`):

- Zorunlu kümede doğrulayıcının sırasındaki **ilk karşılanabilir** seçenek önerilir; kullanıcı başka bir karşılanabilir
  seçeneği seçebilir. Yalnız seçilen seçeneğin belgeleri gider.
- İsteğe bağlı küme (`required: false`) **varsayılan olarak paylaşılmaz**; kullanıcı açarsa gider. Onay ekranı "zorunlu" ve
  "isteğe bağlı"yı ayrı gösterir.
- `claim_sets` verildiyse belgeden yalnız karşılanabilen **ilk** alan kombinasyonu açıklanır; öbür alanlar gitmez.
- **Eksik alanla belge gönderilmez** (OpenID4VP 1.0 §6.4.1; PV12): `claim_sets` yoksa istenen alanların **hepsi** belgede
  olmalıdır; biri yoksa o belge sorguyu karşılamaz. `claim_sets` varsa seçilen kombinasyonun bütün alanları belgede olmalıdır.
  Hiçbir belge karşılamıyorsa cüzdan kullanıcıya nedenini (hangi alanın belgede olmadığını) söyler; doğrulayıcıya bir şey gitmez.
- Yapısı bozuk sorgu (yinelenen id, `claim_sets` ile id'siz alan, olmayan id'ye işaret eden seçenek, mdoc'ta birden çok
  namespace) reddedilir.

Doğrulayıcı için sonuç: belgede bulunmayabilecek bir alanı (şemada zorunlu olmayan alan, ör. diploma `thesis_title`) düz
`claims` listesine koymayın — o alanı taşımayan belge hiç gelmez; isteğe bağlı alanı `claim_sets` ile isteyin
(`[["g","l","t"], ["g","l"]]`: önce tezli, olmazsa tezsiz). İsteğe bağlı bir belgeye ya da alana güvenerek akış kurmayın; tercih sırası önemliyse en az veri
isteyen seçeneği öne koyun.

## 4.5 `mso_mdoc` — yaş doğrulaması (D-CRED-5)

```json
{
  "credentials": [
    {
      "id": "identity",
      "format": "mso_mdoc",
      "meta": { "doctype_value": "urn:tamga:id:IdentityAttestation:1" },
      "claims": [ { "path": ["tamga.id.1", "age_over_18"], "values": [true] } ]
    }
  ]
}
```

[[t:mdoc|mdoc'ta]] claim yolu **`[namespace, element]`**'tir; Tamga kimlik namespace'i `tamga.id.1`; element adları ve kodlaması AB PID
tablosuna göredir ([[ADR-0045]]: SD-JWT `birthdate` / `nationalities` ↔ mdoc `birth_date` (full-date) / `nationality`; öteki
adlar aynı). Doğrulayıcı yalnızca `age_over_18` görür; ad, doğum tarihi, kimlik numarası
açıklanmaz. `docType` = vct URN.

## 4.6 `trusted_authorities` — cüzdan nasıl değerlendirir

Doğrulayıcı, sorgudaki bir belge için kabul ettiği güven kaynaklarını `trusted_authorities` ile söyleyebilir (OpenID4VP 1.0
§6.1.1); belge en az bir koşula uymalıdır. Tamga doğrulayıcısı `aki` kullanır ([[t:HAIP]] §5). Cüzdan her koşulu üç sonuçtan
biriyle değerlendirir (paketler 0.5.2):

| Tür | Cüzdan ne yapar |
|---|---|
| `aki` | Belgenin veren zincirindeki bir sertifikanın AKI'si (base64url) değerlerden biri mi — **değerlendirilir** |
| `etsi_tl` | Değer, cüzdanın yüklediği ve imzasını doğruladığı bir güven listesinin (ETSI TS 119 612 TL ya da TS 119 602 LoTE) adresiyse: belgenin zinciri o listedeki bir belge verme hizmeti sertifikasına çıkıyor mu (sertifikanın kendisi zincirde ya da zincirdeki bir AKI = listedeki sertifikanın SKI'si) — **değerlendirilir**. Değerdeki liste cüzdanda yüklü değilse **değerlendirilemez** |
| `openid_federation` ve bilinmeyen türler | **değerlendirilemez** |

- Bir koşul eşleşirse belge **önerilir** (`matched`).
- Hiçbir koşul eşleşmez ama biri **değerlendirilemiyorsa** belge yine **önerilir** (`not_evaluable`): cüzdan bilemediği bir
  koşul yüzünden belgeyi gizlemez, güven denetimini doğrulayıcı kendisi yapar (AB doğrulayıcısı yalnız `etsi_tl` isteyebilir).
  **`not_evaluable` olumlu güven işareti değildir:** onay ekranı bunu "doğrulandı" ya da "güvenilir" diye göstermez, kayıtta
  "geçti" sayılmaz.
- Bütün koşullar değerlendirilip hiçbiri eşleşmezse belge **önerilmez**.

**Belgenin zinciri** sorgunun biçimindeki kopyadan okunur: `mso_mdoc` (ve `mso_mdoc_zk`) için IssuerAuth'un `x5chain`'i (COSE
başlığı 33; ZK'da ZK kopyasınınki), `dc+sd-jwt` için x5c. O biçimde kopya yoksa öbür temsil kullanılır (aynı belge veren anahtarı;
D-CRED-5). Yalnız mdoc kopyası olan belge de böylece `aki` / `etsi_tl` ile eşleşebilir.

**Yüklü listeler:** cüzdan, imzalı LOTL'da sabitlenmiş imzacıyla doğruladığı dış listeleri ([[ADR-0036]]) yalnız sorguda `etsi_tl`
varsa okur ve eşleştirmeye verir (`matchDcql(..., { trustedLists })`; kaynak `TrustSource.externalTrustedLists()` — listenin özgün
yayın adresi ve PID / EAA sağlayıcı sertifikaları, yalnız taze listeler). Listeler okunamazsa (çevrimdışı, liste yok) `etsi_tl`
koşulu değerlendirilemez. Tamga Wallet bu davranışı uygular.

---

# 5. Belge Gösterme ve Yanıt

## 5.1 Cüzdanın ürettiği

[[SPEC-CRED-0002]] §7.2 uyarınca: seçilmiş [[t:disclosure|disclosure'lar]] + KB-JWT.

KB-JWT gövdesi:

```json
{
  "nonce": "n-0S6_WzA2Mj",
  "aud": "x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk",
  "iat": 1789003600,
  "sd_hash": "Vx2mNqL8pRt4KzYwBhSaEc7JuFiGoNdXvCyTrMkZqPw"
}
```

**`aud` client identifier'ın tamamıdır** (prefix dahil). Bu, sunumu o
doğrulayıcıya bağlar; başkasına yeniden oynatılamaz.

## 5.2 `vp_token`

```json
{
  "vp_token": {
    "diploma": ["eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCJ9...~D1~D2~...~<KB-JWT>"]
  },
  "state": "af0ifjsldkj"
}
```

Anahtarlar DCQL'deki `id` değerleridir; değerler dizidir (bir sorgu birden çok
belge eşleştirebilir).

`mso_mdoc` sorgusunda değer base64url **DeviceResponse**'tur (ISO 18013-5 §8.3.2.1.2.2): `documents[0]` =
`{ docType, issuerSigned (seçici açıklanmış), deviceSigned.deviceAuth.deviceSignature }`. Cihaz imzası **ayrık yüklü**
COSE_Sign1'dir (payload `nil`) ve `DeviceAuthenticationBytes = #6.24(bstr .cbor ["DeviceAuthentication", SessionTranscript,
docType, DeviceNameSpacesBytes])` üzerindedir. SessionTranscript OpenID4VP 1.0 Ek B.2.6.1'dir (2026-09-29):
`[null, null, ["OpenID4VPHandover", sha256(cbor([client_id, nonce, jwkThumbprint, response_uri]))]]` — `jwkThumbprint` yanıtın
şifrelendiği doğrulayıcı anahtarının RFC 7638 SHA-256 parmak izidir (PV11). İstek nesnesi `client_metadata.vp_formats_supported`
içinde `mso_mdoc` (`issuerauth_alg_values` / `deviceauth_alg_values`: `[-7]`) bildirir.

## 5.3 Şifreleme

`direct_post.jwt`: yukarıdaki nesne, `client_metadata.jwks`'teki alıcı
anahtarıyla **JWE** olarak şifrelenir.

| Parametre | Tamga |
|---|---|
| `alg` | `ECDH-ES` |
| `enc` | `A128GCM` ya da `A256GCM` ([[t:HAIP]] §5) — doğrulayıcı ikisini de `encrypted_response_enc_values_supported` içinde ilan eder ve kabul eder; cüzdan ilan edilenler arasından `A256GCM`'i seçer, ilan yoksa OpenID4VP varsayılanı `A128GCM` |
| Alıcı anahtarı | İstekteki `jwks`'ten, `use: "enc"` |

## 5.4 Yanıt ucunun cevabı (2026-10-27)

Doğrulayıcı `response_uri`'ye gelen geçerli yanıta 200 ve gövdede **yalnız `redirect_uri`** döner (OpenID4VP 1.0 §8.2; [[t:HAIP]]
§5.1 bunu ister). Başka anahtar eklenmez. Tamga Verify kabulde yüz yüze kontrol görünümünün anahtarını ([[ADR-0012]] C) bu adresin
içine koyar: `/p/{id}?st=<durum jetonu>&show=<anahtar>`. Anahtar sonuçtan sonra 5 dakika geçerlidir; sonra aynı adres olağan durum
sayfasını gösterir. Adres yalnız şifreli yanıtı gönderen cüzdana gider; cüzdan "Kontrol ettir"de onu QR olarak gösterir. Tek
istisna geçiş kartı veren politikalardır ([[ADR-0012]] B): kabulde `pass_grant` ve `pass` da döner (Tamga uzantısı).

---

# 6. Aşırı Talep Denetimi

> [[SPEC-BC-0001]] §6'nın protokol karşılığı; §2.3'teki çözümlemeye dayanır.

## 6.1 Üç durum

| Durum | Cüzdan davranışı |
|---|---|
| Doğrulayıcı kayıtlı, tüm claim'ler scope içinde | Normal onay ekranı |
| Doğrulayıcı kayıtlı, **bazı claim'ler scope dışında** | **Aşırı talep uyarısı** — scope dışı alanlar ayrıca işaretlenir; kullanıcı yine de onaylayabilir |
| Doğrulayıcı **kayıtsız** | "Bu doğrulayıcı Tamga'da kayıtlı değil" uyarısı; sunum engellenmez ama belirgin uyarı |

## 6.2 Neden engellenmiyor

Cüzdan, kullanıcının **aracıdır**, bekçisi değil. Bir kullanıcı bilinçli
olarak kayıtsız bir doğrulayıcıya belge sunmak isteyebilir — bir araştırmacıya,
bir yabancı kuruma, bir teste.

Engellemek yerine **görünür kılmak** doğru tasarımdır. Ama görünürlük gerçek
olmalıdır: uyarı, onay düğmesinin yanında küçük gri bir metin değil, akışı
kesen bir ekran olmalıdır.

## 6.3 Kayıt

Cüzdan her sunumu **yerel** olarak kaydeder: ne zaman, hangi doğrulayıcı, hangi
alanlar, aşırı talep var mıydı.

**Bu kayıt cihazda kalır.** Hiçbir sunucuya gönderilmez — gönderilse, tam da
korumaya çalıştığımız davranış profilini merkezîleştirmiş oluruz.

Kullanıcı bu kaydı görebilmeli ve silebilmelidir.

---

# 7. Digital Credentials API (Tarayıcı)

Tarayıcı içi akışlar için OpenID4VP, W3C Digital Credentials API üzerinden
taşınır. `response_mode: dc_api.jwt`.

## 7.1 Fark: `origin` bağlaması

DC API akışında sunumun hedefi, `origin:` ile öneklenmiş tarayıcı origin
değeridir:

```
aud: origin:https://ik.ornek-holding.com
```

Bu değeri **tarayıcı** sağlar, doğrulayıcı değil. Dolayısıyla phishing'e karşı
güçlü bir bağdır: sahte bir site kendi origin'inden başkasını iddia edemez.

**Değişmez PV4:** Cüzdan, `origin` prefix'ini **istek içinde** client
identifier olarak kabul etmez; yalnızca tarayıcının verdiği origin'i
`aud` bağlamasında kullanır.

## 7.2 Zincir kaydıyla ilişki

DC API akışında `x509_hash` yoksa aşırı talep denetimi (§6) yapılamaz.
Bu yüzden Tamga profili, DC API akışında da **imzalı istek nesnesini**
önerir — origin bağlaması phishing'i, `x509_hash` yetki denetimini çözer;
ikisi farklı problemlerdir.

## 7.3 Faz kararı

| Akış | Durum (2026-10) |
|---|---|
| `direct_post.jwt` (QR / derin bağlantı) | **Yürürlükte** |
| `dc_api.jwt` (tarayıcı, OpenID4VP 1.0 Ek A) | **Uygulandı** — doğrulayıcı istek nesnesi ve sayfa kiti (`@tamga-network/verifier/web`), cüzdan tarafı (`@tamga-network/wallet-core`); tarayıcı ve işletim sistemi desteğine bağlıdır. Sunum başına iki istek nesnesi (0.6.0): DC API'ninki (`dc_api.jwt` + `expected_origins`) ve QR / bağlantı için `request_uri`'deki cihazlar arası nesne (`direct_post.jwt` + `response_uri`). Her birinin şifreleme anahtarı ayrıdır (`kid` `enc-dc-<id>` / `enc-<id>.<dal>`); yanıtı açan anahtar yolu belirler, mdoc `SessionTranscript`'i o yolun el sıkışmasıyla (köken ya da `response_uri`) denetlenir. `request_uri`'nin her çekimi kendi nonce ve state'iyle ayrı bir daldır ([[ADR-0067]]); tek kullanım bütün yollar ve dallar için ortaktır: ilk geçerli yanıt sunumu tamamlar, öteki yol reddedilir (PV10). Kullanılabilir DC API isteği olmayan tarayıcı (ör. Safari + yalnız SD-JWT politikası) yalnız çalışan QR / bağlantıyı gösterir |
| ISO 18013-5 yakın alan (Bluetooth), mdoc | **Kodu hazır** (`@tamga-network/mdoc`, `@tamga-network/wallet-core`); gerçek cihazlarla birlikte çalışma denemesi sürüyor. NFC bu aşamada yok |
| ISO/IEC 18013-7 Ek C (`org-iso-mdoc`, tarayıcı), mdoc | **Doğrulayıcıda uygulandı** (0.6.0; §7.4) — Safari / iOS 26 tarayıcısında mdoc'un tek yolu. Cüzdan tarafı (işletim sistemi kayıt modülü) sonraki cihaz turunda |

## 7.4 ISO/IEC 18013-7 Ek C (`org-iso-mdoc`)

OpenID4VP'yi DC API üzerinden taşımayan tarayıcılar (Safari / iOS 26) mdoc'u ISO/IEC 18013-7 Ek C ile ister. Doğrulayıcı aynı
sunum için ikinci bir DC API isteği verir (politika tek `mso_mdoc` belgesi istiyorsa):

- **İstek:** `{ protocol: "org-iso-mdoc", data: { deviceRequest, encryptionInfo } }` — ikisi de base64url CBOR. `DeviceRequest`
  ISO 18013-5 biçimindedir (saklama niyeti `false`); istek doğrulayıcının erişim sertifikasıyla okuyucu imzası (`readerAuth`)
  taşıyabilir. `EncryptionInfo = ["dcapi", {"nonce": bstr (≥ 16 bayt), "recipientPublicKey": COSE_Key}]`.
- **Oturum dökümü:** `SessionTranscript = [null, null, ["dcapi", SHA-256(CBOR([Base64EncryptionInfo, köken]))]]` — köken, isteği
  yapan sayfanın kökenidir (tarayıcı verir). Cihaz imzası bu dökümle kurulur: yanıt başka bir istekte ya da başka bir sitede
  kullanılamaz.
- **Yanıt:** `credential.data.response` = base64url(`["dcapi", {"enc": bstr, "cipherText": bstr}]`) — HPKE (RFC 9180) temel kip,
  DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM, `info` = döküm baytları, `aad` boş; açık metin `DeviceResponse`.
- **Akış (barındırılan doğrulayıcı):** `POST /presentations` (`dc_api_origin` ile) `dc_api_requests` (OpenID4VP + Ek C) ve
  `dc_mdoc_response_uri` döndürür; sayfa yanıtı bu adrese iletir (`POST /vp/dc-mdoc/{id}`, form alanı `response`). Açılamayan
  yanıt sunumu tüketmez. Sayfa kiti protokolü tarayıcıya göre seçer (Apple WebKit'e yalnız `org-iso-mdoc`) ve yanıtı yanıtın
  protokolüne göre doğru uca iletir. Masaüstünde DC API varsa varsayılan yol odur; QR yedek olarak yanında kalır (ETSI TS 119
  472-2 SUPPORT-03).
- **Kod:** `@tamga-network/mdoc` (`createAnnexCRequest`, `parseAnnexCRequest`, `sealAnnexCResponse`, `openAnnexCResponse`,
  `hpkeSeal` / `hpkeOpen`), `@tamga-network/verifier` (`createMdocDcApiRequest`, `openMdocDcApiResponse`,
  `verifyPresentation({ sessionTranscript })`), `@tamga-network/verifier/web` (`chooseDcApiRequests`, `dcResponseTarget`).

## 7.5 Kayıt sertifikası: sertifikasız istek ve yakın alan ([[ADR-0026]] K5; [[ADR-0056]] K10)

- **Sertifikasız istek ([[ADR-0056]] K10, 2026-10-19):** `checkRegistrationCerts` sonucu `valid: false`,
  `reason: "registration_missing"` — cüzdan kişiye sormadan reddeder. 2026-10-13'teki "uyarı + Paylaşma, 2028-08-11'den
  sonra ret" geçişi kaldırıldı.
- **Onay ([[ADR-0056]] K8):** cüzdan çekirdeğinin `respond`'u yalnız `checkRp`'nin bu isteğe bağlı onayıyla (`approval`) çalışır;
  taklit, ACTIVE olmayan kayıt ya da doğrulanmamış aracı istekte onay çıkmaz.
- **Yakın alan:** okuyucu kayıt sertifikasını CBOR biçiminde (`rc-wrp+cwt`, ETSI TS 119 475 §5.2.3) ItemsRequest'in
  `requestInfo.euWrprc` alanında gönderir (ISO/IEC 18013-5-REQ-04…07) ve isteği okuyucu sertifikasıyla imzalar (`readerAuth`).
  Cüzdan uzaktan akıştaki 1–4'ü uygular; 3'teki bağ `readerAuth` sertifikasındaki `organizationIdentifier` ile kurulur
  (`checkProximityRegistration`). Geçersiz sertifikada ve sertifikasız istekte kişiye sorulmadan ret.
  Kayıt sertifikası herkese açık olduğundan okuyucu sertifikasının kendisi de güvene bağlanmalıdır: zinciri imzalı listenin bir
  `root_cas` sertifikasına kadar doğrulanır ya da yaprağı o tarafın kaydındaki parmak izidir (`readerTrust`, zorunlu). Bağlanmayan
  okuyucu (ör. kurum kimliği kopyalanmış kendinden imzalı sertifika) `untrusted_reader_certificate` ile geçersizdir. Cüzdandan
  cüzdana akışta okuyucu sertifikası yoktur; bu denetim uygulanmaz ("kayıt yok"). Doğrulayıcının Ek C okuyucu imzası x5chain'de
  yaprak + ara sertifikaları taşır (kök hariç).
  Liste yayıncısı her kayıt sertifikasının CBOR biçimini de üretir (`wrprc/…/*.cwt`, dizinde `cwt_path`).

---

# 8. `transaction_data`

Bir sunumun belirli bir **işleme** bağlanmasını sağlar — "bu diplomayı
gördüm" değil, "şu iş başvurusu için bu diplomayı gördüm".

Kullanım: kullanıcının onayladığı işlem metni, KB-JWT'ye karma olarak
bağlanır. Böylece sunum, başka bir işlem için yeniden kullanılamaz.

**Tamga'da:** ilk aşamada kullanılmaz (eğitim senaryosunda işlem bağlaması
gerekmiyor). Finans ve yetkilendirme senaryolarında ([[PM-AUTH-0001]])
gerekli olacak. Profil o zaman yazılacak.

---

# 9. Uçtan Uca — Ayşe'nin Başvurusu

```
Ayşe (cüzdan)                        İşveren (verifier)          İndeksleyici
     │                                      │                          │
     │◀── QR: authorization request ────────│                          │
     │                                      │                          │
     │  x5c zincirini doğrula               │                          │
     │  (SPEC-ID-0002, RootCARegistry)      │                          │
     │                                      │                          │
     │─ client_id → fingerprint ───────────────────────────────────────▶│
     │◀── RelyingParty kaydı + allowedScopes ──────────────────────────│
     │                                      │                          │
     │  DCQL claim'leri scope'a düşüyor mu? │                          │
     │  → evet, uyarı yok                   │                          │
     │                                      │                          │
     │  [onay ekranı: 8 alan gösterilir]    │                          │
     │  [Ayşe onaylar]                      │                          │
     │                                      │                          │
     │  8 disclosure seç, 10'unu çıkar      │                          │
     │  sd_hash hesapla                     │                          │
     │  KB-JWT imzala (aud = client_id)     │                          │
     │  vp_token'ı JWE ile şifrele          │                          │
     │                                      │                          │
     │─── POST response_uri ───────────────▶│                          │
     │                                      │                          │
     │                                      │ [SPEC-API-0001 doğrulama]│
     │                                      │─ 5 sorgu ───────────────▶│
     │                                      │◀── sonuç ────────────────│
     │                                      │ [status token ön çekimden]│
     │                                      │                          │
     │  [yerel kayda yaz — cihazda kalır]   │  ACCEPTED                │
```

**İşverenin görmedikleri:** `grade` (3.42), `thesis_title`, `birth_date`,
`credit_points`, `mode_of_study`, `grading_scheme`, `nqf_level`,
`graduated_before`, `awarding_body_id`, `awarding_body_country`.

---

# 10. Hata Yanıtları

| Kod | Ne zaman |
|---|---|
| `invalid_request` | İstek nesnesi imzasız veya bozuk |
| `invalid_client` | `x5c` zinciri doğrulanamadı |
| `access_denied` | Kullanıcı reddetti |
| `vp_formats_not_supported` | `dc+sd-jwt` desteklenmiyor |
| `invalid_request_uri_method` | — |
| `wallet_unavailable` | DC API'de cüzdan yok |

## 10.1 Cüzdanın hata yanıtı ve sunumun tüketilmesi (2026-10-24; çekim dalları ve yumuşak ret 2026-10-29, [[ADR-0067]])

- **Her çekim bir dal.** `request_uri`'nin her çekimi (GET ya da POST) kendi `state`'i, `nonce`'u ve şifreleme anahtarı olan yeni bir
  istek nesnesi verir (§3). OpenID4VP 1.0 hata yanıtını kimlik doğrulamaz (§8.2, §8.3.1); onu sunuma bağlayan yalnız `state`'tir.
  `state` dal başına ve gizli olduğundan, QR'ı görüp istek nesnesini kendisi çeken biri yalnız **kendi dalının** `state`'ini öğrenir.
- **Ret `response_uri`'ye gider ve yalnız kendi dalını kapatır.** Kişi reddettiğinde cüzdan, `response_uri` biliyorsa (cihazlar arası
  akış) yanıt adresine OpenID4VP 1.0 §8.4 hata yanıtını gönderir: yalnız `error=access_denied` ve `state` (kişisel veri yok;
  `error_description` yok — PV5). Şifresiz form ya da şifreli JWE (§8.3.1) aynı işlenir. Ret yalnız `state`'inin ait olduğu dalı kapatır;
  sunum bütünüyle **yalnız tek dalı varsa ve o dal kapandıysa** REJECTED olur (neden saklanmaz). Birden çok çekim varsa sunum süresi
  bitene dek açık kalır ve ilk geçerli sunum kazanır; kapanmış dala gelen sunum kabul edilmez. Yanıt ucu rete 200 döner (§8.2); retin
  `redirect_uri`'si durum jetonu, kontrol görünümü anahtarı ya da yetki kodu taşımaz. Tarayıcı (DC API) akışında yanıt adresi yoktur;
  ret DC API'nin kendi hata yoluyla sayfaya döner ve DC API nesnesinin `state`'iyle gelen ret kabul edilmez. Referans:
  `@tamga-network/wallet-core` `declineRequest`; doğrulayıcı tarafı `@tamga-network/verifier` `createRequestBranch`,
  `openPresentationResponse`.
- **Sunum yalnız sahiplik kanıtı geçince tüketilir.** Doğrulayıcı bir şifreli yanıtı ancak KB-JWT / cihaz imzası (A6; ZK'da Z1)
  geçtikten sonra sunumu tamamlayan yanıt sayar — B–E sonucu ne olursa olsun (iptal, kapsam aşımı). Öncesinde başarısız olan yanıt
  sunumu **kapatmaz**. Hiçbir dalın anahtarıyla çözülemeyen yanıt (bozuk gövde, dalsız ya da bilinmeyen `kid`) sunuma dokunmaz ve
  deneme sayılmaz; çözülmüş ama başarısız yanıt (`state` uyuşmazlığı, boş `vp_token`, A1–A6 reddi) 400 `invalid_request` alır ve
  **kendi dalının** denemesidir: dal başına **5** denemede yalnız o dal kapanır (tek dallı sunumda sunum REJECTED; DC API yolunda
  sınır sunum başına). Dal sayısında sabit sınır yok: yumuşak sınırda (10) hiç yanıt almamış ve yaşlı (≥ 120 sn) en eski dal,
  sert tavanda (32) yaşa bakılmadan atılır; yanıtı işlenen dal atılmaz; ortak dal bütçesi bütün sunumları kapsar; çekim hız sınırı
  istemci adresi başına ([[ADR-0067]] RQ5, Değişiklik notu 2026-10-29). Tek kullanım kilidi yanıt çözülmeden önce alınır ve çözmeden
  sonra dal yeniden denetlenir. Bekleyen sunumun durumunda toplam deneme sayısı
  ve son başarısızlığın adımı görünür (`attempts`, `last_attempt`); değer yok, dal bilgisi yok.
- **Kalan risk.** QR'ı gerçek cüzdandan önce çekip hemen reddeden biri tek dallı sunumu kapatabilir — QR'ı görenin kendi belgesiyle
  yanıt verebilmesi gibi cihazlar arası akışın bilinen sınırı (OpenID4VP 1.0 §14); RP yeni sunum açar.
  Kurumun belge verme servisindeki satır içi kimlik sunumu (SPEC-PROTO-0001 §11.2) aynı kuralı uygular; çok dallı sunumda ret boş
  gövdeyle 200 alır, tek dallıda cüzdana `access_denied` yönlendirmesi döner.

**Değişmez PV5:** Kullanıcı reddettiğinde `access_denied` döner ve **sebep
belirtilmez.** "Kullanıcının bu belgesi yok" ile "kullanıcı vermek
istemedi" arasındaki fark doğrulayıcıya sızmamalıdır — sızarsa, doğrulayıcı
kullanıcının hangi belgelere sahip olduğunu sorgu yaparak haritalayabilir.

---

# 11. Değişmezler

| # | Değişmez |
|---|---|
| **PV1** | `presentation_definition` (PE) reddedilir; yalnızca DCQL. |
| **PV2** | Cüzdan, client identifier'ı zincir kaydına çözmeyi dener (§2.3). |
| **PV3** | Şifresiz yanıt modu kullanılmaz. |
| **PV4** | `origin` prefix'i istek içinde client identifier olarak kabul edilmez. |
| **PV5** | Ret sebebi doğrulayıcıya sızmaz. |
| **PV6** | İstek nesnesi imzalı olmalıdır; `redirect_uri` prefix'i reddedilir. |
| **PV7** | KB-JWT `aud` değeri client identifier'ın tamamıdır (prefix dahil). |
| **PV8** | Sunum kaydı cihazda kalır; sunucuya gönderilmez. |
| **PV9** | Bir istekte en fazla 3 belge, 2 `credential_sets`. |
| **PV10** | `nonce` tek kullanımlıktır; doğrulayıcı tekrar kabul etmez. |
| **PV11** | `mso_mdoc` sunumunda cihaz imzası, client identifier'ın tamamını (prefix dahil), `nonce`'u, `response_uri`'yi ve yanıtın şifrelendiği anahtarın parmak izini bağlayan SessionTranscript (OpenID4VPHandover) üzerindedir; başka bir isteğe taşınan DeviceResponse A6'da reddedilir. |
| **PV12** | Cüzdan, istenen alanlardan birini taşımayan belgeyi göndermez (`claim_sets` yoksa bütün alanlar, varsa seçilen kombinasyonun bütün alanları belgede olmalıdır); isteğe bağlı alan `claim_sets` ile istenir. |
| **PV13** | Cüzdan imzalı istek nesnesini zamanla ve hedefle denetler: `exp` zorunludur ve geçmiş olamaz, `iat` 60 sn'den fazla ileri tarihli olamaz (saat kayması toleransı 60 sn), `aud` verilmişse `https://self-issued.me/v2` olmalıdır; aksi hâlde istek reddedilir. `dc+sd-jwt` sorgusu türü `meta.vct_values` ile belirtmelidir (türsüz sorgu reddedilir). |
| **PV14** | Aracı doğrulayıcı ([[ADR-0017]] K7) bir RP adına ancak ilişki iki kayıtta da yazılıysa istek gönderebilir: asıl RP aracıyı `uses_intermediaries`'te, aracı asıl RP'yi `served_relying_parties`'te listeler; tek taraflı beyanda cüzdan isteği reddeder. |
| **PV15** | `request_uri`'nin her çekimi taze `state` (≥ 128 bit, gizli), taze `nonce` ve taze efemer şifreleme anahtarıyla ayrı bir çekim dalıdır; cüzdanın hata yanıtı yalnız kendi dalını kapatır ve sunum ancak tek dalı varsa REJECTED olur ([[ADR-0067]] RQ1–RQ6). |

---

# Güvenlik ve Mahremiyet Notları

**Sorgu yapısı bir bilgi sızıntısıdır.** Bir doğrulayıcı, farklı sorgular
göndererek kullanıcının hangi belgelere sahip olduğunu haritalayabilir.
PV5 bunu kısmen kapatır ama tamamen değil — cüzdan, aynı doğrulayıcıdan gelen
tekrarlayan farklı sorguları kullanıcıya bildirmelidir.

**`nonce` tekrar oynatma.** PV10 atlanırsa, kaydedilmiş bir sunum yeniden
gönderilebilir. `aud` ikinci savunma hattıdır.

**Disclosure seti tutarlılığı.** [[SPEC-SCHEMA-0002]] Güvenlik Notları:
cüzdan aynı doğrulayıcıya tekrar sunumlarda tutarlı bir disclosure seti
kullanmalıdır; değişen set, gizlenen alanlar hakkında bilgi verir.

**QR ele geçirme.** İmzalı istek nesnesi ve `x5c` zinciri sayesinde sahte bir
doğrulayıcı kendini kayıtlı bir doğrulayıcı gibi gösteremez — sertifikanın özel
anahtarına ihtiyaç duyar.

---

# Açık Konular

1. ~~Aşırı talep uyarısının sertliği~~ — **KAPANDI** ([[SPEC-WALLET-0001]] §5.2,
   WL8): üç seviye, üç görsel ağırlık. Scope aşımında ayrı blok + 3 sn gecikmeli
   düğme; kayıtsız doğrulayıcıda akışı kesen ekran. Uyarı yorgunluğu önlemi:
   normal akışta **hiç** uyarı yok. Görsel tasarım kullanıcı testi bekliyor.
2. `credential_sets` sınırı (PV9: 3/2) tahminîdir; kullanıcı testiyle
   kalibre edilmeli.
3. [[SPEC-BC-0001]] §14.3 devam ediyor: RP scope'ları `schemaId` kümesine mi
   bağlanmalı? §2.3'teki çözümleme bunu artık teknik olarak mümkün kılıyor —
   ama her yeni şemada her RP'nin güncellenmesi sorunu duruyor.
4. [[ARCH-0005]] §4.2 M3: asgari SDK sürümünün RP kaydına bağlanması. Bu
   doküman yazılırken yeniden değerlendirildi; **hâlâ ertelendi** — sürüm
   yönetimini kayıt defterine bağlamak yeni bir bağlaşım yaratıyor ve
   `checks_skipped` mekanizması (M1) pratikte yeterli görünüyor.
5. DC API akışında imzalı istek nesnesi zorunlu mu olsun? §7.2 öneriyor;
   zorunlu kılmak bazı tarayıcı entegrasyonlarını zorlaştırabilir.

---

# İlgili Dokümanlar

[[SPEC-PROTO-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-BC-0001]] ·
[[SPEC-ID-0002]] · [[SPEC-API-0001]] · [[ARCH-0003]] · [[ARCH-0005]] ·
[[PM-AUTH-0001]] · [[PM-GOV-0001]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

