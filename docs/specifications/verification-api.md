---
document_id: SPEC-API-0001
title: "Doğrulama hattı ve API"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-07
summary: >
  Doğrulamanın kanonik algoritmasını ve issuer/verifier servislerinin HTTP
  yüzeyini tanımlar. Merkezî katkı ADIM KODU KAYIT DEFTERİdir: A1…E4, dört
  spesifikasyona dağılmış doğrulama adımlarının tek normatif listesi. Bu kodlar
  `failed_step` alanında makine okunur biçimde taşınır, böylece "doğrulama
  başarısız" yerine "C2'de düştü — issuer bu şemaya yetkili değil" denebilir.
  İkinci kural: HTTP durum kodu doğrulama sonucunu KODLAMAZ — reddedilen bir
  credential başarılı bir API çağrısıdır; 4xx yalnızca taşıma/istek hatasıdır.
  Üçüncüsü: sonuç üç değerlidir ve INDETERMINATE ayrı bir sebep alanı taşır.
---

Bu şartname, bir [[t:credential|belgenin]] doğrulanırken geçtiği adımları tek bir sırada toplar ve barındırılan
[[t:verifier]] ile [[t:issuer]] servisinin HTTP arayüzünü tanımlar; doğrulayıcı ve kurum geliştiricileri içindir.

**Ne zaman okunur**

- Önce [Belge gösterme](/concepts/presentation) sayfasını, sonra [[GUIDE-0002]] rehberini okuyun.
- Barındırılan doğrulayıcıyı kullanıyorsanız §4'e, belge veren servisini kullanıyorsanız §5'e gidin.
- Bir sonuç kodunun (A1, C2, D5 gibi) anlamını arıyorsanız §1 tablosuna bakın.

**Kısaca**

Doğrulama beş katmanda ilerler: biçim (belge bozulmamış ve imzalı mı), şema (türü tanınıyor mu), güven (veren kurum
[[t:trust-list|güven listesinde]] ve bu türü vermeye yetkili mi), [[t:revocation]] (belge iptal edilmiş mi) ve politika
(doğrulayıcının istedikleri karşılanıyor mu). Her adımın kalıcı bir kodu vardır. Sonuç üç değerden biridir: geçerli, geçersiz ya da doğrulanamadı.
Doğrulanamadı, belgenin sahte olduğu anlamına gelmez; örneğin [[t:status-list]] o an güncel olmayabilir. HTTP durum kodu sonucu
taşımaz; sonuç her zaman yanıtın gövdesindedir.

---

# Kapsam

Bu şartname iki şeyi tanımlar:

1. **Kanonik doğrulama algoritması** — dört şartnameye dağılmış adımların
   tek normatif sırası ve kod kayıt defteri.
2. **Servis API yüzeyi** — belge veren ve doğrulayıcı servislerinin HTTP arayüzü.

Protokol uçları ([[SPEC-PROTO-0001]] OID4VCI, [[SPEC-PROTO-0002]] OID4VP)
burada tekrarlanmaz; bu doküman **servisin kendi** yönetim ve entegrasyon
yüzeyini tanımlar.

---

# 1. Adım Kodu Kayıt Defteri (Normatif)

Doğrulama beş katmanda ilerler. Bu tablo **kanoniktir**; [[ARCH-0003]] §4.1
onun özet görünümüdür.

## 1.A — Format katmanı → [[SPEC-CRED-0002]] §8

| Kod | Adım |
|---|---|
| `A1` | Birleşik dizeyi `~` ile böl; KB-JWT var mı |
| `A2` | Başlık: `alg=ES256`, `typ=dc+sd-jwt`, `x5c` var mı |
| `A3` | `x5c` zinciri + JWT imzası; kök `RootCARegistry`'de **`isChainAcceptable`** (ACTIVE veya RETIRED); ara sertifikalar CA olmalı (`basicConstraints cA=true`), `keyCertSign` taşımalı ve `pathLenConstraint`'i aşmamalı; `iat` 300 sn'den fazla ileri tarihliyse RED |
| `A3b` | **`issuerId`, `x5c` yaprak sertifikasının parmak izinden türetilir** — `iss` claim'inden DEĞİL (§1.2) |
| `A3c` | Yaprak sertifika CRL/OCSP'de iptal edilmiş mi ([[SPEC-ID-0002]]) |
| `A3d` | `cnf` claim'i **mevcut** mu — yoksa RED (Tamga'da KB istisnasız zorunlu) |
| `A4` | `_sd_alg == "sha-256"` |
| `A5` | Her disclosure: **önce hash, sonra çöz**; digest `_sd`'de eşleşiyor mu |
| `A6` | KB-JWT: imza, `aud`, `nonce`, `iat`, `sd_hash` |
| `A7` | `exp` geçmiş ya da `nbf` gelmemiş mi |
| `A8` | Yinelenen digest / açıktaki claim ile çakışma yok mu |

**`Z1` — zero-knowledge proof (`mso_mdoc_zk`, [[ADR-0032]]):** devre imzalı listede ve dosya özeti eşleşiyor (ZK2); açıklanan
öğeler yalnız istenenler, tek ad alanında, devrenin öznitelik sayısıyla (ZK3); zaman damgası pencere içinde;
[[t:Longfellow-ZK]] ispatı geçerli. `mso_mdoc_zk` A-sırası: A1 çözme · A8 docType · A2 `msoX5chain` · A3 zincir + sertifika ispat anında geçerli · A3b ·
Z1. A4–A7 Z1 kapsamındadır.

## 1.B — Şema katmanı → [[SPEC-SCHEMA-0001]] §7

| Kod | Adım |
|---|---|
| `B1` | `vct` ve `vct#integrity` oku |
| `B2` | `schemaId = keccak256(vct)`; kayıtlı ve `REVOKED` değil mi |
| `B3` | Type Metadata al (önbellek → URL → registry) |
| `B4` | Bütünlük: hash `== vct#integrity` **ve** `== contentHash` (zincir) |
| `B5` | `extends` zinciri; her adımda `extends#integrity` |
| `B6` | JSON Schema 2020-12 uyumu |

## 1.C — Güven katmanı → [[SPEC-BC-0001]] §11.2

| Kod | Adım |
|---|---|
| `C1` | `isCredentialAcceptable(issuerId, iat)` — **iat = belgenin `iat` claim'i** |
| `C2` | `isCredentialSchemaAcceptable(issuerId, schemaId, iat)` — **atlanamaz** |
| `C3` | `isRecognizedBy(kendi devletim, issuerId)` |
| `C4` | Belgenin `category` claim'i ↔ kayıttaki belge veren sınıfı: PUB ↔ `urn:tamga:eaa:pub`, QUALIFIED ↔ `urn:tamga:eaa:qualified`, EAA (I1–I2) ↔ claim yok; uyuşmazlık → RED ([[ADR-0010]] K5, [[SPEC-CRED-0002]]/C18) |

## 1.D — İptal katmanı → [[SPEC-CRED-0003]] §7

| Kod | Adım |
|---|---|
| `D1` | `status.status_list` oku (`idx`, `uri`) |
| `D2` | Status List Token'ı **ön çekim önbelleğinden** al |
| `D3` | Token imzası; `sub == uri`; `iss` aynı güven zincirinde |
| `D4` | Tazelik: `exp` geçmemiş, `iat + ttl` politikaya uygun |
| `D5` | Zincir çapası: `contentHash` eşleşiyor, `version` geri gitmemiş (önbellek çapadan önce çekildiyse `INDETERMINATE`/`STATUS_STALE`, sonra çekildiyse `REJECTED`) |
| `D6` | `bits=2` ile `idx` oku; `0x00` dışı → RED |

## 1.E — Politika katmanı → yerel

| Kod | Adım |
|---|---|
| `E1` | Assurance eşiği (ör. `category=EDUCATION && assurance>=I2`) |
| `E2` | İstenen claim'lerin hepsi açıklanmış mı |
| `E3` | RP scope aşımı yok mu ([[SPEC-PROTO-0002]] §6) |
| `E4` | Denetim kaydı yazıldı |

## 1.1 C1/C2 zamana bağlıdır

`C1` ve `C2`, kurumun **bugün** belge verip veremeyeceğini değil, belgenin verildiği **an** kabul edilebilir olup
olmadığını sorar. Belge verme zamanına ait sorular (`isValidIssuer`, `isAuthorizedForSchema`: "şimdi verebilir mi?")
doğrulamada kullanılsaydı iki sessiz hata çıkardı:

| Senaryo | Belge verme zamanı sorusuyla | Doğrusu |
|---|---|---|
| Bakanlık kapandı (`REVOKED`, halefi var) | Tüm diplomaları `C1`'de RED | Kapanıştan önce verilenler kabul ([[ADR-0002]] #4) |
| Şema `DEPRECATED` oldu (yeni sürüm çıktı) | Eski şemayla verilen her belge `C2`'de RED | Kabul — [[SPEC-BC-0001]]/SC3 |
| CA planlı rotasyon | `A3` + `C1` RED | Kabul — rotasyon ele geçirilme değildir |

Bu yüzden her iki sorgu belgenin **`iat`** değerini alır ve "o an kabul
edilebilir miydi" diye sorar. Bu, doğrulamanın **geçmişe dönük** bir işlem
olduğunu kabul eder — belge geçmişte verilmiştir, bugünkü durum değil o
günkü durum belirleyicidir.

## 1.2 `issuerId` sertifikadan türetilir

`A3b` kritiktir. Doğrulayıcı `issuerId`'yi **`iss`
claim'inden alırsa**, aynı kök CA altında geçerli sertifikası olan **herhangi
bir** kurum, `iss` alanına üniversitenin tanımlayıcısını yazıp onun adına belge
üretebilir — imza kendi sertifikasıyla geçerli, zincir geçerli, `iss` sahte.

Kural: `issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))` — [[SPEC-ID-0002]].
`iss` claim'i yalnızca **tutarlılık kontrolü** için kullanılır: kayıtlı
belge verenin `metadataURI`'siyle eşleşmeli; eşleşmiyorsa RED.

## 1.3 Sıra ve kısa devre

Adımlar **sırayla** çalıştırılır. İlk başarısızlıkta durulur ve o kod
`failed_step` olarak döner.

**İstisna:** `E4` her durumda çalışır — reddedilen doğrulama da kayda geçer.

## 1.4 Kod kararlılığı

**Değişmez AP1:** Bir adım kodunun anlamı **asla değişmez.** Yeni adım
eklenirse yeni kod alır; kaldırılan adımın kodu **yeniden kullanılmaz.**

Gerekçe: `failed_step` denetim kayıtlarında yıllarca saklanır. `C2`'nin anlamı
2029'da değişirse, 2027 kayıtları yanlış okunur.

---

# 2. Doğrulama Sonucu

## 2.1 Üç değerli sonuç

| `outcome` | Anlamı |
|---|---|
| `ACCEPTED` | Tüm adımlar geçti |
| `REJECTED` | Bir adım başarısız — belge geçersiz |
| `INDETERMINATE` | **Doğrulanamadı** — altyapı erişilemez, belge hakkında hüküm yok |

**Değişmez AP2:** `INDETERMINATE`, `REJECTED` ile aynı kovaya konmaz. Kullanıcı
arayüzünde ayrı gösterilir. "Bu diploma sahte" ile "şu an kontrol edemiyorum"
arasındaki fark, bir insanın işe alınıp alınmamasıdır.

## 2.2 Sonuç nesnesi

```json
{
  "verification_id": "vrf_01J8XKQ2M4",
  "outcome": "ACCEPTED",
  "failed_step": null,
  "indeterminate_reason": null,

  "spec_version": "SPEC-API-0001@1.0.0",
  "sdk_version": "@tamga-network/verifier@1.0.0",
  "checks_performed": ["A1","A2","A3","A3b","A3c","A3d","A4","A5","A6","A7","A8",
                       "B1","B2","B3","B4","B5","B6",
                       "C1","C2","C3","C4",
                       "D1","D2","D3","D4","D5","D6",
                       "E1","E2","E3"],
  "checks_skipped": [],

  "issuer": {
    "issuer_id": "0x7f3a…",
    "state_code": "TR",
    "category": "EDUCATION",
    "assurance": "I2",
    "class": "EAA"
  },
  "schema": {
    "schema_id": "0x9c21…",
    "vct": "urn:tamga:edu:DiplomaCredential:1",
    "version": "1.0.0",
    "status": "ACTIVE"
  },
  "disclosed_claims": ["is_graduate","qualification_title","eqf_level",
                       "isced_f_code","awarding_body_name","awarding_date",
                       "family_name","given_name"],
  "status": {
    "value": "VALID",
    "list_version": 8412,
    "token_age_sec": 1830
  },
  "freshness": {
    "indexer_last_block": 918273,
    "indexer_age_sec": 4,
    "chain_read_mode": "INDEXER"
  },
  "evaluated_at": "2026-09-09T09:12:44Z"
}
```

| Alan | Anlamı |
|---|---|
| `status.reason` | İsteğe bağlı metin (`string \| null`): durum değerinin nedeni, kendiliğinden anlaşılmadığında. Ör. `NOT_APPLICABLE` + ZK sunumu: iptal indeksi açılmaz ([[ADR-0032]] ZK4; belge kısa ömürlü). Kişisel veri taşımaz. |

## 2.3 `indeterminate_reason`

`outcome == INDETERMINATE` olduğunda **zorunlu**:

| Değer | Kaynak |
|---|---|
| `SCHEMA_UNREACHABLE` | [[SPEC-SCHEMA-0001]] §7 Ş3(c) |
| `STATUS_UNREACHABLE` | [[SPEC-CRED-0003]] §7 Ş3(c) |
| `STATUS_STALE` | [[SPEC-CRED-0003]] §8.2 tazelik eşiği aşıldı; ya da D5'te doğrulayıcının ön çekim gecikmesi / saat toleransı penceresi / okunamayan çapa zamanı |
| `CHAIN_UNREACHABLE` | Zincir ve indeksleyici erişilemez |
| `INDEXER_STALE` | [[ARCH-0003]]/CMP4 |
| `SDK_VERSION_MISMATCH` | [[ARCH-0005]] §4.2 M2; ayrıca `Z1`'de doğrulayıcı tarafının ZK bileşeni kullanılamıyorsa (devre dosyası yok, WASM yüklenemiyor) — sunumun değil doğrulayıcının eksiği |

Ayrıca şu durumlar `INDETERMINATE` verir, `REJECTED` vermez:

- **Beklenmeyen istisna** (kütüphane hatası, bozuk güven kaydı …): o adımda `INDETERMINATE`, nedeni o katmanın değeri (A →
  `CHAIN_UNREACHABLE`, B → `SCHEMA_UNREACHABLE`, C/E/T0 → `INDEXER_STALE`, D → `STATUS_UNREACHABLE`); `failed_reason`'a
  istisna iletisi girmez (AP3), yalnız adım ve hata türü. Sonuç E4 denetim kaydına yine düşer.
- **ZK sunumu ve `accept_unrevocable_zk: false`:** ZK sunumunda iptal indeksi gelmez (ZK4); politika iptal denetimini şart
  koşuyorsa sonuç `D1` / `STATUS_UNREACHABLE`. `true` (ya da verilmemişse) kabul edilir: `status.value = NOT_APPLICABLE`,
  `status.reason` dolu.

## 2.4 `disclosed_claims` — yalnızca adlar

**Değişmez AP3:** Sonuç nesnesi claim **değerlerini** taşımaz, yalnızca
**adlarını**. Değerler çağıran uygulamaya ayrı bir kanaldan ve açıkça
istendiğinde verilir.

Gerekçe: sonuç nesnesi denetim kaydına yazılır ([[ARCH-0004]] §5.2). Değerler
oraya sızarsa, kişisel veri log altyapısına yayılır.

## 2.5 `idx` asla yer almaz

**Değişmez AP4:** `status.status_list.idx` sonuç nesnesinde, denetim kaydında
veya herhangi bir API yanıtında **bulunmaz** ([[ARCH-0004]] §5.3).

İlişkilendirme gerekiyorsa kuruma özel [[t:salted-hash]] kullanılır:
`HMAC(kurum_tuzu, uri || idx)`.

---

# 3. HTTP Durum Kodu Sonucu Kodlamaz

**Değişmez AP5:** Reddedilen bir belge **başarılı bir API çağrısıdır**.

| Durum | Ne zaman |
|---|---|
| `200` | Doğrulama çalıştı — `outcome` ne olursa olsun |
| `400` | İstek gövdesi bozuk, eksik parametre |
| `401` / `403` | API kimlik doğrulaması / yetki |
| `404` | Bilinmeyen `verification_id` |
| `409` | Idempotency çakışması |
| `429` | Hız sınırı |
| `500` | Servis hatası |
| `503` | Bağımlılık erişilemez **ve** sonuç üretilemedi |

Karıştırmak yaygın bir hatadır ve iki sorun üretir: (1) istemciler ağ hatası
ile geçersiz belgeyi ayıramaz, (2) izleme sistemleri reddedilen belgeleri
"hata oranı" sanır ve gerçek arızalar gürültüde kaybolur.

---

# 4. Doğrulayıcı servis API'si

Taban: `https://verifier.<kurum>/api/v1`

## 4.1 Sunum isteği başlat

```http
POST /presentations
Content-Type: application/json
Idempotency-Key: 3f9a1c...

{
  "policy_id": "job-application-degree",
  "purpose": { "tr-TR": "İş başvurusu değerlendirmesi" },
  "response_mode": "direct_post.jwt",
  "ttl_sec": 300
}
```

```json
{
  "presentation_id": "prs_01J8XK",
  "request_uri": "https://verifier.ornek.com/vp/req/01J8XK",
  "qr_payload": "openid4vp://?client_id=x509_hash%3AUvo3…&request_uri=…",
  "expires_at": "2026-09-09T09:17:44Z"
}
```

`policy_id`, önceden tanımlı bir politikaya işaret eder (§4.4). DCQL sorgusu
istek gövdesinde **elle yazılmaz** — politikadan üretilir. Böylece aşırı talep,
kod değişikliği değil politika değişikliği gerektirir.

## 4.2 Sonucu al

```http
GET /presentations/prs_01J8XK
```

Sunum henüz gelmediyse `{"state": "PENDING"}`; geldiyse §2.2'deki sonuç
nesnesi.

## 4.3 Açıklanan değerleri al (ayrı çağrı)

```http
GET /presentations/prs_01J8XK/claims
```

```json
{
  "claims": {
    "is_graduate": true,
    "qualification_title": { "tr-TR": "Bilgisayar Mühendisliği Lisans Diploması" },
    "eqf_level": 6,
    "isced_f_code": "0613"
  }
}
```

**Ayrı uç olmasının sebebi** AP3'tür: değerler denetim kaydına giden sonuç
nesnesinden ayrılır ve bu uca erişim ayrıca yetkilendirilir ve loglanır.

## 4.4 Politika yönetimi

```json
{
  "policy_id": "job-application-degree",
  "credentials": [
    {
      "id": "diploma",
      "vct_values": [
        "urn:tamga:edu:DiplomaCredential:1",
        "urn:tamga:edu:DiplomaCredential:2"
      ],
      "required_claims": ["is_graduate","qualification_title","eqf_level",
                          "isced_f_code","awarding_body_name","awarding_date"],
      "constraints": { "is_graduate": true, "eqf_level": { "min": 6 } }
    }
  ],
  "trust": {
    "min_issuer_assurance": "I2",
    "allowed_categories": ["EDUCATION"],
    "require_recognition": true
  },
  "freshness": {
    "max_status_token_age_sec": 21600,
    "max_indexer_age_sec": 60
  }
}
```

Politika hem DCQL sorgusunu ([[SPEC-PROTO-0002]] §4) hem `E1`–`E3` adımlarını
besler. Tek kaynak.

**Değişmez AP6:** Politikadaki `required_claims`, RP'nin zincirdeki
`allowedScopes`'unu aşamaz. Servis, politika kaydedilirken bunu kontrol eder ve
aşan politikayı **reddeder** — aşırı talep, sunum anında değil politika
tanımlanırken engellenir.

---

# 5. Belge veren servis API'si

Taban: `https://issuer.<kurum>/api/v1`. OID4VCI uçları ayrıdır
([[SPEC-PROTO-0001]]); buradakiler **operatör ve entegrasyon** yüzeyidir.

## 5.1 Belge teklifi üret (credential offer)

```http
POST /offers
Idempotency-Key: 8c21f...

{
  "credential_configuration_id": "TamgaDiplomaCredential",
  "subject_ref": "OBS-2022510041",
  "batch_size": 1
}
```

```json
{
  "offer_id": "ofr_01J8XM",
  "offer_uri": "https://issuer.bilgi.edu.tr/offer/8a3f9c21",
  "tx_code": "493812",
  "expires_at": "2026-09-09T09:17:44Z"
}
```

`subject_ref` kurumun **kendi** kimliğidir (öğrenci numarası). Tamga bu değeri
hiçbir yere taşımaz; belgeye girmez, zincire yazılmaz.

**`tx_code` yalnızca bu yanıtta döner** ve saklanmaz — operatör ekranında
gösterilir, sonra unutulur.

## 5.2 Belge verme ön kontrolü

```http
POST /offers/preflight
{ "credential_configuration_id": "TamgaDiplomaCredential", "subject_ref": "OBS-2022510041" }
```

```json
{
  "ok": false,
  "blockers": [
    {
      "code": "ISCED_MAPPING_MISSING",
      "detail": "Program 'Yapay Zekâ Mühendisliği' ulusal ISCED-F tablosunda yok",
      "resolution": "packages/schemas/data/tr/overrides.json içine ekleyin"
    }
  ]
}
```

Bu uç, [[ARCH-0003]]/CMP5'in operatöre görünen hâlidir: eşlemede karşılığı
olmayan program için belge verme **durur**, tahmini kod üretilmez.

## 5.3 İptal ve askı

```http
POST /revocations
{ "credential_id": "crd_01J8XN", "action": "REVOKE", "reason_code": "DISCIPLINARY" }
```

```json
{ "queued": true, "effective_after": "2026-09-09T10:00:00Z" }
```

`effective_after`, bir sonraki yayın döngüsüdür ([[SPEC-CRED-0003]] §5.1).
**Anında iptal yoktur** ve API bunu açıkça söyler — çağıranın beklentisi
baştan doğru kurulur.

`action`: `REVOKE` (kalıcı, `0x01`) veya `SUSPEND` / `UNSUSPEND` (`0x02`).

## 5.4 Durum listesi yayın durumu

```http
GET /status-lists/{list_id}
```

```json
{
  "list_id": "0x4f…",
  "list_uri": "https://status.bilgi.edu.tr/v1/sl/7f3a9c21",
  "version": 8412,
  "published_at": "2026-09-09T09:00:00Z",
  "next_publish_at": "2026-09-09T10:00:00Z",
  "chain_version": 8412,
  "in_sync": true,
  "capacity_used_pct": 41.2
}
```

`in_sync == false`, yayın hattının kırıldığını gösterir — CDN ile zincir
çapası ayrışmış demektir ([[ARCH-0004]] §5.1 alarmı).

---

# 6. Ortak Kurallar

## 6.1 Hata biçimi — RFC 9457

```json
{
  "type": "https://docs.tamga.network/errors/schema-not-authorized",
  "title": "Belge veren bu şemayla belge veremez",
  "status": 403,
  "detail": "issuer 0x7f3a… schemaId 0x9c21… için yetkilendirilmemiş",
  "instance": "/api/v1/offers",
  "tamga_code": "SCHEMA_NOT_AUTHORIZED"
}
```

**Değişmez AP7:** `detail` alanı kişisel veri içermez. "Ayşe Yılmaz için kayıt
yok" yerine `SUBJECT_NOT_FOUND` döner; ayrıntı yalnızca kurumun kendi denetim
kaydındadır ([[SPEC-PROTO-0001]]/PR8'in servis karşılığı).

## 6.2 Yineleme güvenliği (idempotency)

Yan etkili her `POST` (`/offers`, `/revocations`, `/presentations`)
`Idempotency-Key` başlığı **kabul eder**. Aynı anahtarla tekrar çağrı, aynı
yanıtı döndürür; farklı gövdeyle aynı anahtar `409` üretir.

Saklama süresi: **24 saat**.

## 6.3 Sürümleme

Yol tabanlı: `/api/v1`. Kırıcı değişiklik `/v2` açar; `/v1` en az **12 ay**
paralel yaşar ([[ARCH-0005]] §5.3 ile aynı politika).

## 6.4 Kimlik doğrulama

| Yüzey | Yöntem |
|---|---|
| Operatör paneli → belge veren API | OIDC + rol tabanlı yetki |
| OBS → belge veren API | mTLS veya istemci kimlik bilgisi |
| Doğrulayıcı uygulaması → doğrulayıcı API | API anahtarı veya mTLS |
| OID4VCI / OID4VP uçları | Protokolün kendi mekanizması |

## 6.5 Hız sınırı

`429` + `Retry-After`. Öneri: `/offers` için kurum başına 100/dk,
`/presentations` için 1000/dk. Tamga Verify sunum açma (`/presentations`), cüzdan yanıtı (`/vp/response`) ve kapı doğrulama
(`/terminal/verify`) uçlarında `429 rate_limited` + `Retry-After` döner; istemci adresi saklanmaz ve loglanmaz.

---

# 7. Değişmezler

| # | Değişmez |
|---|---|
| **AP1** | Adım kodunun anlamı asla değişmez; kaldırılan kod yeniden kullanılmaz. |
| **AP2** | `INDETERMINATE`, `REJECTED` ile aynı kovaya konmaz. |
| **AP3** | Sonuç nesnesi claim değerlerini değil adlarını taşır. |
| **AP4** | `idx` hiçbir API yanıtında veya kayıtta bulunmaz. |
| **AP5** | HTTP durum kodu doğrulama sonucunu kodlamaz. |
| **AP6** | Politikanın `required_claims`'i RP'nin zincirdeki scope'unu aşamaz. |
| **AP7** | Hata `detail` alanı kişisel veri içermez. |
| **AP8** | `C2` (şema yetkisi) hiçbir yapılandırmayla atlanamaz. |
| **AP11** | `C1` ve `C2` belgenin `iat`'ını alır; belge verme zamanı sorguları doğrulamada kullanılmaz. |
| **AP12** | `issuerId` `x5c` yaprak parmak izinden türetilir, `iss` claim'inden değil. |
| **AP13** | Geçiş kartı jetonu doğrulaması ([[ADR-0012]] B): imza `pass_grant`'taki kopya anahtarıyla, `aud` = terminalin RP client_id'si, ömür (`exp` − `iat`) ≤ 60 s, `iat` ≤ şimdi + 30 s, `exp` ≤ şimdi + 60 s + 30 s (saat kayması toleransı), `jti` tekrar listesi (terminal grubu içinde çevrim içi paylaşılır); jetondan kişisel veri çıkarılmaz ve loglanmaz. |
| **AP9** | `E4` (denetim kaydı) reddedilen doğrulamalarda da çalışır. |
| **AP10** | `tx_code` yanıt dışında hiçbir yerde saklanmaz. |

---

# Güvenlik ve Mahremiyet Notları

**Sonuç nesnesi bir denetim artefaktıdır.** Uzun süre saklanır
([[ARCH-0004]] §5.4: 12 ay). AP3 ve AP4 birlikte, bu sürenin bir takip
yüzeyine dönüşmesini engeller.

**`/claims` ucu ayrı yetkilendirilir.** Doğrulama sonucunu görmek ile
açıklanan değerleri okumak farklı yetkilerdir. Bir İK asistanı "aday
doğrulandı" görebilir ama not ortalamasını (açıklanmışsa) görmeyebilir.

**`checks_skipped` boş değilse dikkat.** Eski SDK bir kontrolü atlamış demektir
([[ARCH-0005]] §4.1). Doğrulayıcı uygulaması bunu **görünür** kılmalı, sessizce
kabul etmemelidir.

**Preflight bir sızıntı yüzeyi olabilir.** `/offers/preflight`, `subject_ref`
ile sorgulanır ve "bu öğrenci var mı" sorusunu cevaplar. Kurum içi bir uçtur;
dışarı açılmamalıdır.

---

# Açık Konular

1. `E1`–`E3` politika adımları kurum tarafından özelleştirilebilir. Nereye
   kadar? Tamamen serbest bırakmak `C2`'yi dolaylı olarak atlatabilir mi?
   AP8 bunu yasaklıyor ama teknik zorlama mekanizması yazılmadı.
2. `/claims` ucunun yetki modeli (rol tabanlı mı, alan bazlı mı) tanımlanmadı.
3. Toplu doğrulama ucu (`POST /presentations/batch`) gerekli mi? Bir üniversite
   binlerce mezunu toplu doğrulatmak isteyebilir — ama bu, kişi bazlı sunum
   modeliyle çelişir.
4. `subject_ref`'in belge veren içinde nasıl saklandığı bu dokümanın kapsamı
   dışında ama kurumun KVKK yükümlülüğüdür; `PM-GTM-0001` pilot sözleşmesinde
   ele alınmalı.
5. Adım kodu kayıt defterinin makine okunur hâli (`step-codes.json`)
   `@tamga-network/core`'da yayınlanmalı mı? Muhtemelen evet → [[ARCH-0005]].

---

# İlgili Dokümanlar

[[ARCH-0003]] · [[ARCH-0004]] · [[ARCH-0005]] · [[SPEC-CRED-0002]] ·
[[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-BC-0001]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[INVARIANTS]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

