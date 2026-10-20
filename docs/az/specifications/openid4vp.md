---
document_id: SPEC-PROTO-0002
title: "OpenID4VP profili"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-19
summary: >
  Rəqəmsal sənədin rəqəmsal cüzdandan yoxlayan tərəfə necə təqdim edildiyini müəyyən edir. OpenID4VP 1.0 Final üzərində Tamga profili: DCQL sorğuları (Presentation Exchange İSTİFADƏ EDİLMİR), imzalı sorğu obyekti, cavabın şifrələnməsi, brauzerdə Digital Credentials API. Əsas tapıntı: HAIP-in məcburi etdiyi `x509_hash` client identifier prefiksi base64url(SHA-256(DER)) dəyəridir — bu, zəncirdəki `RelyingParty.accessCertFingerprint` ilə TAM EYNİ BAYTLARDIR. Buna görə rəqəmsal cüzdan sorğudakı client identifier-dən birbaşa zəncir qeydini tapa və həddindən artıq tələb nəzarətini ([[SPEC-BC-0001]] §6) protokol səviyyəsində tətbiq edə bilər. Bundan əlavə, istənilməyən sahələrin aşkarlanması, təqdimatdan sonra istifadəçi jurnalı və cavabın şifrələnməsi qaydaları.
translation_of: SPEC-PROTO-0002
source_version: "1.0.0"
---
**Bu spesifikasiya [[t:credential|rəqəmsal sənədin]] rəqəmsal cüzdandan [[t:verifier|yoxlayan tərəfə]] necə təqdim edildiyini [[t:OpenID4VP]] 1.0 və
[[t:HAIP]] 1.0 vasitəsilə müəyyən edir.** Yoxlayan tərəf və ya rəqəmsal cüzdan proqramı yazan tərtibatçılar üçündür.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Rəqəmsal sənədin təqdim edilməsi (OpenID4VP)](/concepts/presentation) anlayış səhifəsini oxuyun; addım-addım tətbiq üçün [Serverdə yoxlama](/guides/verify-on-server).
- Yoxlayan tərəfin imzalı sorğusunu, [[t:DCQL]] sorğusunu və rəqəmsal cüzdanın cavabını qurarkən.
- Sonra: cavabın necə yoxlandığı [[SPEC-API-0001]].

**Qısaca.** Yoxlayan tərəf imzalı sorğu hazırlayır və onu QR, keçid və ya brauzer (Digital Credentials API) vasitəsilə rəqəmsal cüzdana ötürür.
Sorğu hansı rəqəmsal sənəddən hansı sahələrin istənildiyini DCQL sorğusu ilə bildirir; yoxlayan tərəfin kimliyi sertifikatının həşi ilə
([[t:x509_hash]]) müəyyən edilir. Rəqəmsal cüzdan yoxlayan tərəfin adını və istədiklərini şəxsə göstərir; sorğu yoxlayan tərəfin qeydə alınmış əhatəsini aşırsa,
şəxsi xəbərdar edir. Şəxs təsdiqləsə, rəqəmsal cüzdan yalnız istənilən sahələri [[t:KB-JWT]] ilə birlikdə göndərir.

---

# Əhatə dairəsi

Bu spesifikasiya **rəqəmsal sənədin təqdim edilməsini (presentation)** müəyyən edir: rəqəmsal sənədin rəqəmsal cüzdandan yoxlayan tərəfə
ötürülməsi. Rəqəmsal sənədin verilməsi (issuance) [[SPEC-PROTO-0001]]-də təsvir olunur.

**Standart əsas:** OpenID for Verifiable Presentations **1.0 (Final)** və
HAIP 1.0. Format [[SPEC-CRED-0002]], yoxlama məntiqi [[SPEC-API-0001]].

**Bu spesifikasiyadan kənarda:** ISO/IEC 18013-5 yaxın məsafəli (Bluetooth) təqdimat OpenID4VP deyil; öz sessiya şifrələməsi və
SessionTranscript ilə mdoc daşıyır ([[ADR-0012]], [[ADR-0013]]; `@tamga-network/mdoc` yaxın məsafə modulu). Kodu hazırdır, real
cihazlarla sınaq davam edir (§7.3).

---

# 1. Presentation Exchange İstifadə Edilmir

OpenID4VP 1.0 Final ilə sorğu dili **DCQL** (Digital Credentials Query
Language) oldu. Əvvəlki layihələrdəki Presentation Exchange (PE / `presentation_definition`)
Tamga-da **dəstəklənmir.**

| | Presentation Exchange | **DCQL** |
|---|---|---|
| Status | Köhnə layihə | **1.0 Final** |
| Struktur | JSONPath əsaslı filtrlər | Deklarativ, formatı nəzərə alan |
| SD-JWT VC hədəfləmə | Dolayı | `meta.vct_values` ilə birbaşa |
| Tamga | ✗ | ✓ |

**İnvariant PV1:** `presentation_definition` parametri daşıyan sorğu
**rədd edilir.** Geriyə uyğunluq təmin edilmir — Tamga-nın köhnə yükü yoxdur və PE-ni
qəbul etmək iki ayrı sorğu mühərrikinə qulluq göstərmək deməkdir.

---

# 2. Müştəri İdentifikatoru (Client Identifier) — Zəncirlə Protokolun Birləşdiyi Nöqtə

Bu bölmə dokumentin ən vacib hissəsidir.

## 2.1 `x509_hash` nədir

OpenID4VP 1.0-da yoxlayan tərəf özünü **Client Identifier Prefix** ilə təqdim edir.
HAIP 1.0 X.509 əsaslı ekosistemlər üçün **`x509_hash`**-i məcburi edir:

```
client_id: x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk
```

Dəyər sorğunu imzalayan sertifikat zəncirinin **yarpaq (leaf) sertifikatının DER
kodlaşdırılmış formasının SHA-256 həşinin** base64url təsviridir. Sorğu `x5c`
başlığında zənciri daşıyan imzalı sorğu obyektidir (JAR).

## 2.2 Eyni bayt, iki yerdə

[[SPEC-BC-0001]] §6-dakı `RelyingParty` strukturu bunu saxlayır:

```solidity
bytes32 accessCertFingerprint;   // SHA-256(X.509 DER)
```

**Bu, `x509_hash` ilə eyni baytlardır.** Yalnız kodlaşdırması fərqlidir — biri
`bytes32`, digəri base64url sətirdir.

Yəni rəqəmsal cüzdan daxil olan sorğudakı client identifier-dən birbaşa zəncir
qeydini tapa bilər:

```
x509_hash:Uvo3Htu…  →  base64url-decode  →  32 bytes  →  rpId lookup
                                                     →  RelyingParty record
                                                     →  allowedScopes
```

## 2.3 Nəticə — həddindən artıq tələb nəzarəti protokol səviyyəsində işləyir

[[SPEC-BC-0001]] §6 "həddindən artıq tələbdən qorunma"nı müəyyən etmişdi, lakin rəqəmsal cüzdanın
yoxlayan tərəfi **necə tanıyacağı** açıq qalmışdı. `x509_hash` bu boşluğu doldurur:

```
1. The request arrives, the x5c chain is verified (SPEC-ID-0002)
2. The fingerprint is extracted from client_id
3. It is looked up in RelyingPartyRegistry (through the indexer)
   ├─ Not found         → "unregistered verifier" warning
   ├─ status != ACTIVE  → REJECT
   └─ Found             → allowedScopes are taken
4. Does every claim in the DCQL query fall within the allowed scope?
   ├─ Yes   → normal consent screen
   └─ No    → OVER-ASKING WARNING (§6)
```

**İnvariant PV2:** Uyğun Tamga rəqəmsal cüzdanı DCQL sorğusunu göstərməzdən əvvəl
client identifier-dən zəncir qeydini tapmağa **cəhd etməlidir.**

**Dəstəklənən prefikslər:**

| Prefiks | Tamga |
|---|---|
| `x509_hash` | **Qəbul edilən yeganə prefiks** (imzalı sorğu) — HAIP 1.0 §5; dəyər = base64url(SHA-256(yarpaq sertifikatın DER-i)), OpenID4VP 1.0 §5.9.3; etibar siyahısı qeydinin `client_id`-i ilə üst-üstə düşür |
| `x509_san_dns` | **Rədd edilir** ([[ADR-0034]]) — cavab ünvanının domeni yenə də imzalayan sertifikatın SAN-ında olmalıdır |
| `origin` | Yalnız DC API axınında, izləyicidə (§7) |
| `redirect_uri` | **Rədd edilir** — imzasızdır, zəncirə bağlana bilmir |
| `decentralized_identifier`, `openid_federation`, `verifier_attestation` | Genişlənmə mərhələsi |

`redirect_uri`-in rədd edilməsi şüurlu qərardır: imzasız sorğu yoxlayan tərəfin kim olduğunu
sübut etmir və həddindən artıq tələb nəzarəti mümkünsüz olur.

---

# 3. Avtorizasiya Sorğusu

İmzalı sorğu obyekti (JAR), `typ: oauth-authz-req+jwt`, `alg: ES256`,
`x5c` zənciri başlıqda.

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

| Parametr | Tamga qaydası |
|---|---|
| `response_type` | `vp_token` |
| `response_mode` | `direct_post.jwt` (defolt) və ya `dc_api.jwt` (§7) — **şifrəsiz rejim yoxdur** |
| `nonce` | ≥ 128 bit entropiya, birdəfəlik |
| Sorğu imzası | **Məcburi** — imzasız sorğu rədd edilir |
| `client_metadata.jwks` | Cavab şifrələmə açarı; **məcburi** |
| `verifier_info` | İstəyə bağlı ([[ADR-0026]], 2026-09-29): `[{"format": "registration_cert", "data": "<rc-wrp+jwt>", "credential_ids": [...]}]` — istifadənin qeydiyyat sertifikatı (ETSI TS 119 475 / 119 472-2). Varsa, rəqəmsal cüzdan qeydiyyat orqanının imzasını (LOTL `roles.registrar`), müddəti və `sub`-ın giriş sertifikatındakı `organizationIdentifier` ilə eyni olduğunu yoxlayır; uyğun gəlmirsə, məlumat göndərilmir (WRC4). Sertifikatda olmayan sahə artıq tələb sayılır (§6). |

**İnvariant PV3:** Şifrəsiz cavab rejimi (`direct_post`, `query`, `fragment`)
istifadə edilmir. Təqdimat fərdi məlumatlar daşıyır və nəqliyyat qatının şifrələməsinə
етibar etmək kifayət deyil — `response_uri`-yə gedən aralıq qatlar (əks proxy,
WAF, jurnal) məzmunu görə bilər.

---

# 4. DCQL Sorğusu

## 4.1 İşəgötürən ssenarisi

[[SPEC-SCHEMA-0002]] §3.7-dəki sahələr toplusu:

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

`values` olan claim-də uyğunluq şərti var (`is_graduate == true`);
olmayanlarda yalnız açıqlanması tələb olunur.

**İstənilməyən sahələr** — `grade`, `thesis_title`, `birth_date`,
`credit_points` — sorğuda **yer almır**, buna görə də rəqəmsal cüzdan onları
açıqlamır. Bunlar onsuz da `sd: always` ilə məcburi gizlədilə bilər
([[SPEC-SCHEMA-0002]] §3.3).

## 4.2 Versiya çevikliyi

`vct_values` massivdir. Yoxlayan tərəf bir neçə sxem versiyasını qəbul
edə bilər:

```json
"vct_values": [
  "urn:tamga:edu:DiplomaCredential:1",
  "urn:tamga:edu:DiplomaCredential:2"
]
```

Bu, [[SPEC-SCHEMA-0001]] §9.2 ilə birlikdə işləyir: `DEPRECATED` bir versiya ilə
verilmiş köhnə diplomlar hələ də yoxlana bildiyi üçün yoxlayan tərəf iki versiyanı
eyni anda qəbul edə bilməlidir.

**Tövsiyə:** Yoxlayan tərəflər `vct_values`-a **ən azı iki versiya** daxil edir. Tək versiya
daxil etmək sxem yeniləndikdə köhnə məzunları kənarda qoyur.

## 4.3 Tələbə endirimi — minimal sorğu

[[t:selective-disclosure|Selective disclosure-un]] ən konkret nümunəsi:

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

Kinoteatr `is_enrolled` xaricində heç nə görmür — ad, universitet, ixtisas, qəbul
ili açıqlanmır.

## 4.4 `credential_sets` — alternativlər

Yoxlayan tərəf "diplom **və ya** tələbə sənədi" kimi seçimlər təqdim edə bilər.
Tamga-da bundan istifadə oluna bilər, lakin **ehtiyatla**: hər əlavə seçim istifadəçinin təsdiq
ekranında anlamalı olduğu əlavə mürəkkəblikdir.

**Qayda:** Bir sorğuda ən çox **3** rəqəmsal sənəd və ən çox **2**
`credential_sets` girişi. Bundan artığı istifadəçinin şüurlu təsdiq vermə
qabiliyyətini aşır.

**Rəqəmsal cüzdanın davranışı** (OpenID4VP 1.0 §6.4; istinad: `@tamga-network/wallet-core` `selectDcql`):

- Məcburi toplumda yoxlayan tərəfin sırasındakı **ilk təmin edilə bilən** seçim təklif olunur; istifadəçi başqa təmin edilə bilən
  seçimi seçə bilər. Yalnız seçilmiş seçimin rəqəmsal sənədləri göndərilir.
- İstəyə bağlı toplum (`required: false`) **defolt olaraq paylaşılmır**; istifadəçi aktivləşdirsə, göndərilir. Təsdiq ekranı "məcburi" və
  "istəyə bağlı" hissələri ayrıca göstərir.
- `claim_sets` verilibsə, rəqəmsal sənəddən yalnız təmin edilə bilən **ilk** sahə kombinasiyası açıqlanır; digər sahələr göndərilmir.
- **Çatışmayan sahəsi olan rəqəmsal sənəd göndərilmir** (OpenID4VP 1.0 §6.4.1; PV12): `claim_sets` yoxdursa, istənilən sahələrin **hamısı** rəqəmsal sənəddə
  olmalıdır; biri yoxdursa, həmin rəqəmsal sənəd sorğuya cavab vermir. `claim_sets` varsa, seçilmiş kombinasiyanın bütün sahələri rəqəmsal sənəddə olmalıdır.
  Heç bir rəqəmsal sənəd sorğuya cavab vermirsə, rəqəmsal cüzdan istifadəçiyə səbəbini (hansı sahənin rəqəmsal sənəddə olmadığını) bildirir; yoxlayan tərəfə heç nə göndərilmir.
- Strukturu pozulmuş sorğu (təkrarlanan id, `claim_sets` ilə id-siz sahə, mövcud olmayan id-yə istinad edən seçim, mdoc-da birdən çox
  namespace) rədd edilir.

Yoxlayan tərəf üçün nəticə: rəqəmsal sənəddə olmaya bilən sahəni (sxemdə məcburi olmayan sahə, məs. diplomda `thesis_title`) sadə
`claims` siyahısına daxil etməyin — həmin sahəni daşımayan rəqəmsal sənəd ümumiyyətlə gəlmir; istəyə bağlı sahəni `claim_sets` ilə istəyin
(`[["g","l","t"], ["g","l"]]`: əvvəlcə dissertasiyalı, olmazsa dissertasiyasız). İstəyə bağlı rəqəmsal sənədə və ya sahəyə güvənərək axın qurmayın; üstünlük sırası vacibdirsə, ən az məlumat
tələb edən seçimi önə qoyun.

## 4.5 `mso_mdoc` — yaşın yoxlanılması (D-CRED-5)

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

[[t:mdoc|mdoc-da]] claim yolu **`[namespace, element]`**-dir; Tamga şəxsiyyət namespace-i `tamga.id.1`; element adları və kodlaşdırma Aİ PID
cədvəlinə uyğundur ([[ADR-0045]]: SD-JWT `birthdate` / `nationalities` ↔ mdoc `birth_date` (full-date) / `nationality`; digər
adlar eynidir). Yoxlayan tərəf yalnız `age_over_18` görür; ad, doğum tarixi, şəxsiyyət nömrəsi
açıqlanmır. `docType` = vct URN.

## 4.6 `trusted_authorities` — rəqəmsal cüzdan necə qiymətləndirir

Yoxlayan tərəf sorğudakı rəqəmsal sənəd üçün qəbul etdiyi etibar mənbələrini `trusted_authorities` ilə bildirə bilər (OpenID4VP 1.0
§6.1.1); rəqəmsal sənəd ən azı bir şərtə uyğun olmalıdır. Tamga yoxlayan tərəfi `aki` istifadə edir ([[t:HAIP]] §5). Rəqəmsal cüzdan hər şərti üç nəticədən
biri ilə qiymətləndirir (paketlər 0.5.2):

| Növ | Cüzdan nə edir |
|---|---|
| `aki` | Rəqəmsal sənədin verən zəncirindəki sertifikatlardan birinin AKI-si (base64url) dəyərlərdən biridirmi — **qiymətləndirilir** |
| `etsi_tl` | Dəyər cüzdanın yüklədiyi və imzasını yoxladığı etibar siyahısının (ETSI TS 119 612 TL və ya TS 119 602 LoTE) ünvanıdırsa: rəqəmsal sənədin zənciri həmin siyahıdakı sənəd vermə xidməti sertifikatına çıxırmı (sertifikatın özü zəncirdədir və ya zəncirdəki bir AKI = siyahıdakı sertifikatın SKI-si) — **qiymətləndirilir**. Dəyərdəki siyahı cüzdanda yüklü deyilsə, **qiymətləndirilə bilməz** |
| `openid_federation` və naməlum növlər | **qiymətləndirilə bilməz** |

- Şərtlərdən biri uyğun gəlirsə, rəqəmsal sənəd **təklif olunur** (`matched`).
- Heç bir şərt uyğun gəlmir, lakin biri **qiymətləndirilə bilmirsə**, rəqəmsal sənəd yenə də **təklif olunur** (`not_evaluable`): cüzdan bilə bilmədiyi
  şərt üzündən rəqəmsal sənədi gizlətmir, etibar yoxlamasını yoxlayan tərəf özü aparır (Aİ yoxlayan tərəfi yalnız `etsi_tl` istəyə bilər).
  **`not_evaluable` müsbət etibar nişanı deyil:** təsdiq ekranı bunu "yoxlanılıb" və ya "etibarlıdır" kimi göstərmir, jurnalda
  "keçdi" sayılmır.
- Bütün şərtlər qiymətləndirilib heç biri uyğun gəlmirsə, rəqəmsal sənəd **təklif olunmur**.

**Rəqəmsal sənədin zənciri** sorğunun formatındakı nüsxədən oxunur: `mso_mdoc` (və `mso_mdoc_zk`) üçün IssuerAuth-un `x5chain`-si (COSE
başlığı 33; ZK-da ZK nüsxəsininki), `dc+sd-jwt` üçün x5c. Həmin formatda nüsxə yoxdursa, digər təqdimat istifadə olunur (eyni sənədi verən qurumun açarı;
D-CRED-5). Beləliklə, yalnız mdoc nüsxəsi olan rəqəmsal sənəd də `aki` / `etsi_tl` ilə uyğunlaşa bilər.

**Yüklü siyahılar:** cüzdan imzalı LOTL-da sabitlənmiş imzalayanla yoxladığı xarici siyahıları ([[ADR-0036]]) yalnız sorğuda `etsi_tl`
olduqda oxuyur və uyğunlaşdırmaya ötürür (`matchDcql(..., { trustedLists })`; mənbə `TrustSource.externalTrustedLists()` — siyahının orijinal
dərc ünvanı və PID / EAA provayder sertifikatları, yalnız təzə siyahılar). Siyahılar oxuna bilmirsə (oflayn, siyahı yoxdur), `etsi_tl`
şərti qiymətləndirilə bilməz. Tamga Wallet bu davranışı tətbiq edir.

---

# 5. Rəqəmsal sənədin təqdimatı və cavab

## 5.1 Cüzdanın yaratdığı

[[SPEC-CRED-0002]] §7.2-yə əsasən: seçilmiş [[t:disclosure|disclosure-lar]] + KB-JWT.

KB-JWT gövdəsi:

```json
{
  "nonce": "n-0S6_WzA2Mj",
  "aud": "x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk",
  "iat": 1789003600,
  "sd_hash": "Vx2mNqL8pRt4KzYwBhSaEc7JuFiGoNdXvCyTrMkZqPw"
}
```

**`aud` client identifier-in tamamıdır** (prefiks daxil olmaqla). Bu, təqdimatı həmin
yoxlayan tərəfə bağlayır; başqasına təkrar oynadıla (replay) bilməz.

## 5.2 `vp_token`

```json
{
  "vp_token": {
    "diploma": ["eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCJ9...~D1~D2~...~<KB-JWT>"]
  },
  "state": "af0ifjsldkj"
}
```

Açarlar DCQL-dəki `id` dəyərləridir; dəyərlər massivdir (bir sorğu bir neçə
rəqəmsal sənədi uyğunlaşdıra bilər).

`mso_mdoc` sorğusunda dəyər base64url **DeviceResponse**-dur (ISO 18013-5 §8.3.2.1.2.2): `documents[0]` =
`{ docType, issuerSigned (seçici açıklanmış), deviceSigned.deviceAuth.deviceSignature }`. Cihaz imzası **ayrılmış (detached) yüklü**
COSE_Sign1-dir (payload `nil`) və `DeviceAuthenticationBytes = #6.24(bstr .cbor ["DeviceAuthentication", SessionTranscript,
docType, DeviceNameSpacesBytes])` üzərində qurulur. SessionTranscript OpenID4VP 1.0 Əlavə B.2.6.1-dir (2026-09-29):
`[null, null, ["OpenID4VPHandover", sha256(cbor([client_id, nonce, jwkThumbprint, response_uri]))]]` — `jwkThumbprint` cavabın
şifrələndiyi yoxlayan tərəf açarının RFC 7638 SHA-256 barmaq izidir (PV11). Sorğu obyekti `client_metadata.vp_formats_supported`
daxilində `mso_mdoc` (`issuerauth_alg_values` / `deviceauth_alg_values`: `[-7]`) bildirir.

## 5.3 Şifrələmə

`direct_post.jwt`: yuxarıdakı obyekt `client_metadata.jwks`-dəki alıcı
açarı ilə **JWE** kimi şifrələnir.

| Parametr | Tamga |
|---|---|
| `alg` | `ECDH-ES` |
| `enc` | `A128GCM` və ya `A256GCM` ([[t:HAIP]] §5) — yoxlayan tərəf hər ikisini `encrypted_response_enc_values_supported` daxilində elan edir və qəbul edir; cüzdan elan olunanlar arasından `A256GCM`-nı seçir, elan yoxdursa, OpenID4VP-nin defolt dəyəri `A128GCM` |
| Alıcı açarı | Sorğudakı `jwks`-dən, `use: "enc"` |

---

# 6. Həddindən artıq tələbin yoxlanılması

> [[SPEC-BC-0001]] §6-nın protokol qarşılığı; §2.3-dəki təhlilə əsaslanır.

## 6.1 Üç vəziyyət

| Vəziyyət | Cüzdanın davranışı |
|---|---|
| Yoxlayan tərəf qeydiyyatdadır, bütün claim-lər scope daxilindədir | Adi təsdiq ekranı |
| Yoxlayan tərəf qeydiyyatdadır, **bəzi claim-lər scope xaricindədir** | **Həddindən artıq tələb xəbərdarlığı** — scope xaricindəki sahələr ayrıca işarələnir; istifadəçi yenə də təsdiq edə bilər |
| Yoxlayan tərəf **qeydiyyatda deyil** | "Bu yoxlayan tərəf Tamga-da qeydiyyatda deyil" xəbərdarlığı; təqdimat bloklanmır, lakin xəbərdarlıq aydın göstərilir |

## 6.2 Niyə bloklanmır

Cüzdan istifadəçinin keşikçisi deyil, **vasitəsidir**. İstifadəçi şüurlu
şəkildə qeydiyyatda olmayan yoxlayan tərəfə rəqəmsal sənəd təqdim etmək istəyə bilər — tədqiqatçıya,
xarici quruma, testə.

Bloklamaq əvəzinə **görünən etmək** düzgün dizayndır. Lakin görünürlük real
olmalıdır: xəbərdarlıq təsdiq düyməsinin yanında kiçik boz mətn deyil, axını
kəsən ekran olmalıdır.

## 6.3 Jurnal

Cüzdan hər təqdimatı **lokal** olaraq jurnala yazır: nə vaxt, hansı yoxlayan tərəf, hansı
sahələr, həddindən artıq tələb var idimi.

**Bu jurnal cihazda qalır.** Heç bir serverə göndərilmir — göndərilsəydi, məhz
qorumağa çalışdığımız davranış profilini mərkəzləşdirmiş olardıq.

İstifadəçi bu jurnalı görə və silə bilməlidir.

---

# 7. Digital Credentials API (Brauzer)

Brauzerdaxili axınlar üçün OpenID4VP W3C Digital Credentials API vasitəsilə
ötürülür. `response_mode: dc_api.jwt`.

## 7.1 Fərq: `origin` bağlaması

DC API axınında təqdimatın hədəfi `origin:` prefiksli brauzer origin
dəyəridir:

```
aud: origin:https://ik.ornek-holding.com
```

Bu dəyəri yoxlayan tərəf deyil, **brauzer** təqdim edir. Buna görə də fişinqə qarşı
güclü bağdır: saxta sayt öz origin-indən başqasını iddia edə bilməz.

**Dəyişməz qayda PV4:** Cüzdan `origin` prefiksini **sorğu daxilində** client
identifier kimi qəbul etmir; yalnız brauzerin verdiyi origin-i
`aud` bağlamasında istifadə edir.

## 7.2 Zəncir qeydi ilə əlaqə

DC API axınında `x509_hash` yoxdursa, həddindən artıq tələbin yoxlanılması (§6) aparıla bilməz.
Buna görə Tamga profili DC API axınında da **imzalı sorğu obyektini**
tövsiyə edir — origin bağlaması fişinq problemini, `x509_hash` isə səlahiyyət yoxlamasını həll edir;
bunlar iki fərqli problemdir.

## 7.3 Mərhələ qərarı

| Axın | Status (2026-10) |
|---|---|
| `direct_post.jwt` (QR / dərin keçid) | **Qüvvədədir** |
| `dc_api.jwt` (brauzer, OpenID4VP 1.0 Əlavə A) | **Tətbiq olunub** — yoxlayan tərəfin sorğu obyekti və səhifə dəsti (`@tamga-network/verifier/web`), cüzdan tərəfi (`@tamga-network/wallet-core`); brauzer və əməliyyat sistemi dəstəyindən asılıdır. Hər təqdimata iki sorğu obyekti (0.6.0): DC API-nin obyekti (`dc_api.jwt` + `expected_origins`) və QR / keçid üçün `request_uri`-dakı cihazlararası obyekt (`direct_post.jwt` + `response_uri`). Hər birinin şifrələmə açarı ayrıdır (`kid` `enc-dc-<id>` / `enc-<id>`); cavabı açan açar yolu müəyyən edir, mdoc `SessionTranscript`-i həmin yolun əl sıxışması ilə (origin və ya `response_uri`) yoxlanılır. Nonce, state və birdəfəlik istifadə ortaqdır: ilk etibarlı cavab təqdimatı tamamlayır, digər yol rədd edilir (PV10). İstifadəyə yararlı DC API sorğusu olmayan brauzer (məs. Safari + yalnız SD-JWT siyasəti) yalnız işləyən QR / keçidi göstərir |
| ISO 18013-5 yaxın sahə (Bluetooth), mdoc | **Kodu hazırdır** (`@tamga-network/mdoc`, `@tamga-network/wallet-core`); real cihazlarla qarşılıqlı işləmə sınağı davam edir. NFC bu mərhələdə yoxdur |
| ISO/IEC 18013-7 Əlavə C (`org-iso-mdoc`, brauzer), mdoc | **Yoxlayan tərəfdə tətbiq olunub** (0.6.0; §7.4) — Safari / iOS 26 brauzerində mdoc-un yeganə yolu. Cüzdan tərəfi (əməliyyat sisteminin qeydiyyat modulu) növbəti cihaz mərhələsində |

## 7.4 ISO/IEC 18013-7 Əlavə C (`org-iso-mdoc`)

OpenID4VP-ni DC API vasitəsilə ötürməyən brauzerlər (Safari / iOS 26) mdoc-u ISO/IEC 18013-7 Əlavə C ilə tələb edir. Yoxlayan tərəf eyni
təqdimat üçün ikinci DC API sorğusu verir (siyasət tək `mso_mdoc` rəqəmsal sənədi tələb edirsə):

- **Sorğu:** `{ protocol: "org-iso-mdoc", data: { deviceRequest, encryptionInfo } }` — hər ikisi base64url CBOR. `DeviceRequest`
  ISO 18013-5 formatındadır (saxlama niyyəti `false`); sorğu yoxlayan tərəfin giriş sertifikatı ilə oxuyucu imzası (`readerAuth`)
  daşıya bilər. `EncryptionInfo = ["dcapi", {"nonce": bstr (≥ 16 bayt), "recipientPublicKey": COSE_Key}]`.
- **Sessiya transkripti:** `SessionTranscript = [null, null, ["dcapi", SHA-256(CBOR([Base64EncryptionInfo, köken]))]]` — origin sorğunu
  göndərən səhifənin origin-idir (brauzer təqdim edir). Cihaz imzası bu transkriptlə qurulur: cavab başqa sorğuda və ya başqa saytda
  istifadə edilə bilməz.
- **Cavab:** `credential.data.response` = base64url(`["dcapi", {"enc": bstr, "cipherText": bstr}]`) — HPKE (RFC 9180) əsas rejim,
  DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM, `info` = transkript baytları, `aad` boş; açıq mətn `DeviceResponse`.
- **Axın (host edilən yoxlayan tərəf):** `POST /presentations` (`dc_api_origin` ilə) `dc_api_requests` (OpenID4VP + Əlavə C) və
  `dc_mdoc_response_uri` qaytarır; səhifə cavabı bu ünvana ötürür (`POST /vp/dc-mdoc/{id}`, forma sahəsi `response`). Açıla bilməyən
  cavab təqdimatı istifadə edilmiş saymır. Səhifə dəsti protokolu brauzerə görə seçir (Apple WebKit-ə yalnız `org-iso-mdoc`) və cavabı cavabın
  protokoluna uyğun olaraq düzgün endpoint-ə ötürür. Masaüstündə DC API varsa, defolt yol odur; QR ehtiyat variant kimi yanında qalır (ETSI TS 119
  472-2 SUPPORT-03).
- **Kod:** `@tamga-network/mdoc` (`createAnnexCRequest`, `parseAnnexCRequest`, `sealAnnexCResponse`, `openAnnexCResponse`,
  `hpkeSeal` / `hpkeOpen`), `@tamga-network/verifier` (`createMdocDcApiRequest`, `openMdocDcApiResponse`,
  `verifyPresentation({ sessionTranscript })`), `@tamga-network/verifier/web` (`chooseDcApiRequests`, `dcResponseTarget`).

## 7.5 Qeydiyyat sertifikatı: sertifikatsız sorğu və yaxın sahə ([[ADR-0026]] K5; [[ADR-0056]] K10)

- **Sertifikatsız sorğu ([[ADR-0056]] K10, 2026-10-19):** `checkRegistrationCerts` nəticəsi `valid: false`,
  `reason: "registration_missing"` — cüzdan şəxsdən soruşmadan rədd edir. 2026-10-13-dəki "xəbərdarlıq + Paylaşma, 2028-08-11-dən
  sonra rədd" keçidi ləğv edildi.
- **Təsdiq ([[ADR-0056]] K8):** cüzdan nüvəsinin `respond`-u yalnız `checkRp`-nin bu sorğuya bağlı təsdiqi (`approval`) ilə işləyir;
  saxtakarlıq, ACTIVE olmayan qeydiyyat və ya yoxlanılmamış vasitəçi olan sorğuda təsdiq verilmir.
- **Yaxın sahə:** oxuyucu qeydiyyat sertifikatını CBOR formatında (`rc-wrp+cwt`, ETSI TS 119 475 §5.2.3) ItemsRequest-in
  `requestInfo.euWrprc` sahəsində göndərir (ISO/IEC 18013-5-REQ-04…07) və sorğunu oxuyucu sertifikatı ilə imzalayır (`readerAuth`).
  Cüzdan uzaqdan axındakı 1–4-cü addımları tətbiq edir; 3-cü addımdakı bağ `readerAuth` sertifikatındakı `organizationIdentifier` ilə qurulur
  (`checkProximityRegistration`). Etibarsız sertifikatda və sertifikatsız sorğuda şəxsdən soruşulmadan rədd edilir.
  Qeydiyyat sertifikatı hamıya açıq olduğundan oxuyucu sertifikatının özü də etibara bağlanmalıdır: zənciri imzalı siyahının
  `root_cas` sertifikatına qədər yoxlanılır və ya son sertifikat həmin tərəfin qeydiyyatındakı barmaq izidir (`readerTrust`, məcburi). Bağlanmayan
  oxuyucu (məs. qurum identifikatoru kopyalanmış özünüimzalı sertifikat) `untrusted_reader_certificate` ilə etibarsızdır. Cüzdandan
  cüzdana axında oxuyucu sertifikatı yoxdur; bu yoxlama tətbiq edilmir ("qeydiyyat yoxdur"). Yoxlayan tərəfin Əlavə C oxuyucu imzası x5chain-də
  son sertifikat + aralıq sertifikatları daşıyır (kök istisna olmaqla).
  Siyahı dərcçisi hər qeydiyyat sertifikatının CBOR formatını da yaradır (`wrprc/…/*.cwt`, kataloqda `cwt_path`).

---

# 8. `transaction_data`

Təqdimatın müəyyən bir **əməliyyata** bağlanmasını təmin edir — "bu diplomu
gördüm" deyil, "bu diplomu filan iş müraciəti üçün gördüm".

İstifadə: istifadəçinin təsdiqlədiyi əməliyyat mətni KB-JWT-yə heş kimi
bağlanır. Beləliklə, təqdimat başqa bir əməliyyat üçün təkrar istifadə edilə bilməz.

**Tamga-da:** ilk mərhələdə istifadə olunmur (təhsil ssenarisində əməliyyat bağlaması
tələb olunmur). Maliyyə və səlahiyyətləndirmə ssenarilərində ([[PM-AUTH-0001]])
zəruri olacaq. Profil o zaman yazılacaq.

---

# 9. Başdan-başa — Ayşənin müraciəti

```
Ayşe (wallet)                        Employer (verifier)         Indexer
     │                                      │                          │
     │◀── QR: authorization request ────────│                          │
     │                                      │                          │
     │  verify the x5c chain                │                          │
     │  (SPEC-ID-0002, RootCARegistry)      │                          │
     │                                      │                          │
     │─ client_id → fingerprint ───────────────────────────────────────▶│
     │◀── RelyingParty record + allowedScopes ─────────────────────────│
     │                                      │                          │
     │  Do the DCQL claims fall in scope?   │                          │
     │  → yes, no warning                   │                          │
     │                                      │                          │
     │  [consent screen: 8 fields shown]    │                          │
     │  [Ayşe approves]                     │                          │
     │                                      │                          │
     │  select 8 disclosures, drop 10       │                          │
     │  compute sd_hash                     │                          │
     │  sign KB-JWT (aud = client_id)       │                          │
     │  encrypt vp_token as JWE             │                          │
     │                                      │                          │
     │─── POST response_uri ───────────────▶│                          │
     │                                      │                          │
     │                                      │ [SPEC-API-0001 checks]   │
     │                                      │─ 5 queries ─────────────▶│
     │                                      │◀── result ───────────────│
     │                                      │ [status token prefetched]│
     │                                      │                          │
     │  [write to local log — stays on device] │  ACCEPTED             │
```

**İşəgötürənin görmədikləri:** `grade` (3.42), `thesis_title`, `birth_date`,
`credit_points`, `mode_of_study`, `grading_scheme`, `nqf_level`,
`graduated_before`, `awarding_body_id`, `awarding_body_country`.

---

# 10. Xəta cavabları

| Kod | Nə vaxt |
|---|---|
| `invalid_request` | Sorğu obyekti imzasızdır və ya zədələnib |
| `invalid_client` | `x5c` zənciri yoxlanıla bilmədi |
| `access_denied` | İstifadəçi rədd etdi |
| `vp_formats_not_supported` | `dc+sd-jwt` dəstəklənmir |
| `invalid_request_uri_method` | — |
| `wallet_unavailable` | DC API-də rəqəmsal cüzdan yoxdur |

**Dəyişməz PV5:** İstifadəçi rədd etdikdə `access_denied` qaytarılır və **səbəb
göstərilmir.** "İstifadəçinin bu rəqəmsal sənədi yoxdur" ilə "istifadəçi vermək
istəmədi" arasındakı fərq yoxlayan tərəfə sızmamalıdır — sızarsa, yoxlayan tərəf
sorğular göndərməklə istifadəçinin hansı rəqəmsal sənədlərə malik olduğunun xəritəsini çıxara bilər.

---

# 11. Dəyişməzlər

| # | Dəyişməz |
|---|---|
| **PV1** | `presentation_definition` (PE) rədd edilir; yalnız DCQL. |
| **PV2** | Rəqəmsal cüzdan client identifier-i zəncir qeydinə həll etməyə çalışır (§2.3). |
| **PV3** | Şifrəsiz cavab rejimi istifadə edilmir. |
| **PV4** | `origin` prefiksi sorğu daxilində client identifier kimi qəbul edilmir. |
| **PV5** | Rədd səbəbi yoxlayan tərəfə sızmır. |
| **PV6** | Sorğu obyekti imzalı olmalıdır (MUST); `redirect_uri` prefiksi rədd edilir. |
| **PV7** | KB-JWT `aud` dəyəri client identifier-in tamamıdır (prefiks daxil). |
| **PV8** | Təqdimat qeydi cihazda qalır; serverə göndərilmir. |
| **PV9** | Bir sorğuda ən çox 3 rəqəmsal sənəd, 2 `credential_sets`. |
| **PV10** | `nonce` birdəfəlikdir; yoxlayan tərəf təkrar qəbul etmir. |
| **PV11** | `mso_mdoc` təqdimatında cihaz imzası client identifier-in tamamını (prefiks daxil), `nonce`-u, `response_uri`-ni və cavabın şifrələndiyi açarın barmaq izini bağlayan SessionTranscript (OpenID4VPHandover) üzərindədir; başqa sorğuya daşınan DeviceResponse A6-da rədd edilir. |
| **PV12** | Rəqəmsal cüzdan tələb olunan sahələrdən birini daşımayan rəqəmsal sənədi göndərmir (`claim_sets` yoxdursa bütün sahələr, varsa seçilmiş kombinasiyanın bütün sahələri rəqəmsal sənəddə olmalıdır); ixtiyari sahə `claim_sets` ilə tələb edilir. |
| **PV13** | Rəqəmsal cüzdan imzalı sorğu obyektini zaman və hədəf baxımından yoxlayır: `exp` məcburidir və keçmiş ola bilməz, `iat` 60 saniyədən çox irəli tarixli ola bilməz (saat sürüşməsi tolerantlığı 60 san), `aud` verilibsə `https://self-issued.me/v2` olmalıdır; əks halda sorğu rədd edilir. `dc+sd-jwt` sorğusu növü `meta.vct_values` ilə göstərməlidir (növsüz sorğu rədd edilir). |
| **PV14** | Vasitəçi yoxlayan tərəf ([[ADR-0017]] K7) bir RP adından yalnız əlaqə hər iki qeyddə yazılıbsa sorğu göndərə bilər: əsas RP vasitəçini `uses_intermediaries`-də, vasitəçi əsas RP-ni `served_relying_parties`-də sadalayır; birtərəfli bəyanda rəqəmsal cüzdan sorğunu rədd edir. |

---

# Təhlükəsizlik və məxfilik qeydləri

**Sorğunun strukturu məlumat sızmasıdır.** Yoxlayan tərəf müxtəlif sorğular
göndərərək istifadəçinin hansı rəqəmsal sənədlərə malik olduğunun xəritəsini çıxara bilər.
PV5 bunu qismən bağlayır, amma tam yox — rəqəmsal cüzdan eyni yoxlayan tərəfdən gələn
təkrarlanan müxtəlif sorğular barədə istifadəçiyə bildiriş verməlidir.

**`nonce` təkrar oynatma.** PV10 nəzərə alınmazsa, yadda saxlanmış təqdimat yenidən
göndərilə bilər. `aud` ikinci müdafiə xəttidir.

**Disclosure dəstinin ardıcıllığı.** [[SPEC-SCHEMA-0002]] Təhlükəsizlik qeydləri:
rəqəmsal cüzdan eyni yoxlayan tərəfə təkrar təqdimatlarda ardıcıl disclosure dəsti
istifadə etməlidir; dəyişən dəst gizlədilən sahələr haqqında məlumat verir.

**QR-ın ələ keçirilməsi.** İmzalı sorğu obyekti və `x5c` zənciri sayəsində saxta
yoxlayan tərəf özünü qeydiyyatlı yoxlayan tərəf kimi göstərə bilməz — bunun üçün sertifikatın məxfi
açarı lazımdır.

---

# Açıq məsələlər

1. ~~Həddindən artıq tələb xəbərdarlığının sərtliyi~~ — **BAĞLANDI** ([[SPEC-WALLET-0001]] §5.2,
   WL8): üç səviyyə, üç vizual çəki. Scope aşıldıqda ayrıca blok + 3 san gecikməli
   düymə; qeydiyyatsız yoxlayan tərəfdə axını kəsən ekran. Xəbərdarlıq yorğunluğuna qarşı tədbir:
   normal axında **heç bir** xəbərdarlıq yoxdur. Vizual dizayn istifadəçi testini gözləyir.
2. `credential_sets` həddi (PV9: 3/2) təxminidir; istifadəçi testi ilə
   kalibrlənməlidir.
3. [[SPEC-BC-0001]] §14.3 davam edir: RP scope-ları `schemaId` çoxluğuna
   bağlanmalıdırmı? §2.3-dəki həll bunu artıq texniki baxımdan mümkün edir —
   amma hər yeni sxemdə hər RP-nin yenilənməsi problemi qalır.
4. [[ARCH-0005]] §4.2 M3: minimal SDK versiyasının RP qeydinə bağlanması. Bu
   sənəd yazılarkən yenidən qiymətləndirildi; **hələ də təxirə salınıb** — versiya
   idarəetməsini reyestrə bağlamaq yeni asılılıq yaradır və
   `checks_skipped` mexanizmi (M1) praktikada kifayət qədər görünür.
5. DC API axınında imzalı sorğu obyekti məcburi olsunmu? §7.2 bunu tövsiyə edir;
   məcburi etmək bəzi brauzer inteqrasiyalarını çətinləşdirə bilər.

---

# Əlaqəli sənədlər

[[SPEC-PROTO-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-BC-0001]] ·
[[SPEC-ID-0002]] · [[SPEC-API-0001]] · [[ARCH-0003]] · [[ARCH-0005]] ·
[[PM-AUTH-0001]] · [[PM-GOV-0001]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

