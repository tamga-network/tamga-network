---
document_id: SPEC-PROTO-0001
title: "OpenID4VCI profili"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-23
summary: >
  Rəqəmsal sənədin rəqəmsal cüzdana necə daxil olduğunu müəyyən edir. OpenID4VCI 1.0 Final üzərində Tamga profili: issuer metadata, credential offer (QR + tx_code), pre-authorized və authorization code axını seçimi, Nonce Endpoint-dən c_nonce, openid4vci-proof+jwt açar sübutu, credential endpoint, təxirə salınmış sənəd verilməsi və bildiriş ucunun bugünkü vəziyyəti (hər ikisi təqdim edilmir). İki açıq məsələ bağlanır: batch partiyasının ölçüsü 10 olaraq sabitlənir və batch nüsxələrinin HƏR BİRİ FƏRQLİ cihaz açarından istifadə edir — eyni `cnf` istifadə edilsəydi, nüsxələr bir-biri ilə əlaqələndirilə bilərdi və batch-in bütün mənası itərdi. Bundan əlavə, sənəd verilməsi anındakı holder binding üsulunun holder assurance səviyyəsinə (T1/T2/T3) uyğunluğu verilir.
translation_of: SPEC-PROTO-0001
source_version: "1.0.0"
---
**Bu spesifikasiya rəqəmsal sənədin qurumdan şəxsin rəqəmsal cüzdanına necə verildiyini OpenID4VCI 1.0 vasitəsilə müəyyən edir.** Sənəd verən servisi
və ya cüzdan yazan tərtibatçılar üçündür.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Sənəd verilməsi (OpenID4VCI)](/concepts/issuance) anlayış səhifəsini oxuyun; addım-addım tətbiq üçün [Qurum olaraq rəqəmsal sənəd vermək](/guides/issue-credentials).
- Qurumun təklif, token və sənəd uclarını qurarkən və ya rəqəmsal cüzdanın bu uclarla əlaqəsini yazarkən.
- Sonra: sənədin formatı [[SPEC-CRED-0002]], ləğv [[SPEC-CRED-0003]].

**Qısaca.** Qurum şəxsə təklif (sənəd təklifi: QR və ya keçid) göstərir. Rəqəmsal cüzdan təklifi açır, qurumdan qısaömürlü giriş
tokeni və birdəfəlik [[t:nonce]] alır. Cüzdan bu ədədi öz açarı ilə imzalayaraq açarın özündə olduğunu sübut edir. Qurum bu
sübutu və cüzdanın həqiqi cüzdan olduğunu ([[t:WIA]]) yoxlayır, sonra hər biri fərqli açara bağlı bir neçə nüsxə rəqəmsal sənəd verir. Nüsxələr
eyni sənədin müxtəlif yoxlayan tərəflərdə bir-biri ilə əlaqələndirilməsinin qarşısını alır.

---

# Əhatə dairəsi

Bu spesifikasiya **sənəd verilməsini** müəyyən edir: [[t:credential|rəqəmsal sənədin]] [[t:issuer|sənədi verən qurumdan]] rəqəmsal cüzdana
daxil olması. Təqdimat [[SPEC-PROTO-0002]]-dədir.

**Standart əsası:** OpenID for Verifiable Credential Issuance — [[t:OpenID4VCI|OpenID4VCI]] **1.0 (Final)**.
Sənəd formatı [[SPEC-CRED-0002]], [[t:revocation]] [[SPEC-CRED-0003]].

## Versiya xəbərdarlığı — qaralamalardan iki mühüm fərq

Köhnə OID4VCI qaralamalarına əsasən yazılmış kod və dokumentasiya bu iki məqamda
yanlışdır:

| Mövzu | Köhnə qaralama | **1.0 Final** |
|---|---|---|
| `c_nonce` haradan alınır | Token Endpoint cavabından | **Yalnız Nonce Endpoint**-dən (token və sənəd cavabı `c_nonce` daşımır; `c_nonce_expires_in` yoxdur) |
| Açar sübutu | `proof` (tək) | **`proofs`** (cəm, hər tip üçün massiv) |

İkincisi toplu sənəd verilməsini birbaşa mümkün edir (§8) və Tamga-nın məxfilik
dizaynının əsasıdır.

---

# 1. Axın Seçimi

OID4VCI iki avtorizasiya axını müəyyən edir. Onların Tamga-nın istifadə ssenarilərinə
uyğunluğu:

| Axın | Nə vaxt | Tamga-da |
|---|---|---|
| **Pre-authorized code** | Sənədi verən qurum istifadəçini artıq tanıyır; şəxsiyyəti yoxlayan tərəf sənədi verən qurumun öz sistemi olub | **Defolt** — universitet ssenarisi |
| **Authorization code** | Rəqəmsal cüzdan sənədi verən quruma yönləndirilir və sessiya orada açılır | İstifadəçinin sənədi verən qurumda hesabı yoxdursa və ya seçim etməlidirsə |

## 1.1 Universitet niyə əvvəlcədən avtorizasiya olunmuş (pre-authorized) axından istifadə edir

Tələbə artıq OBS-də sessiyaya daxil olub; universitet onun kim olduğunu bilir. Onu
yenidən avtorizasiya axınından keçirmək heç bir təhlükəsizlik qazancı vermədən
istifadəçi təcrübəsini pisləşdirir.

Axın: tələbə OBS-də "Diplomumu cüzdanıma əlavə et" seçir → universitet sənəd
offer-i yaradır → ekranda QR + `tx_code` göstərir → tələbə telefonu ilə skan edir.

## 1.2 `tx_code` məcburidir

`tx_code` offer-i vizual olaraq ələ keçirən şəxsə qarşı ikinci faktordur.
QR ekranda göstərildiyi üçün çiyin üzərindən oxuna bilər; `tx_code` ayrıca
kanaldan (OBS sessiyası daxilində) verilir.

| Parametr | Tamga dəyəri |
|---|---|
| `input_mode` | `numeric` |
| `length` | 6 |
| Ömür | 5 dəqiqə |
| Cəhd sayı | 3, sonra offer etibarsız olur |

**İnvariant PR1:** Pre-authorized axında `tx_code` **buraxıla bilməz.**

---

# 2. Issuer Metadata

`https://issuer.tamga.network/.well-known/openid-credential-issuer/example-university` (yol əsaslı icarəçi (tenant); RFC 8414 yol qaydası)

```json
{
  "credential_issuer": "https://issuer.tamga.network/example-university",
  "authorization_servers": ["https://issuer.tamga.network/example-university"],
  "credential_endpoint": "https://issuer.tamga.network/example-university/credential",
  "nonce_endpoint": "https://issuer.tamga.network/example-university/nonce",
  "batch_credential_issuance": { "batch_size": 10 },

  "display": [
    { "name": "Örnek Üniversitesi", "locale": "tr-TR" },
    { "name": "Example University", "locale": "en-US" }
  ],

  "credential_configurations_supported": {
    "urn:tamga:edu:DiplomaCredential:1": {
      "format": "dc+sd-jwt",
      "scope": "urn:tamga:edu:DiplomaCredential:1",
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

    "urn:tamga:edu:StudentCredential:1": {
      "format": "dc+sd-jwt",
      "scope": "urn:tamga:edu:StudentCredential:1",
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

## 2.1 Tamga məhdudiyyətləri

| Sahə | Qayda |
|---|---|
| `format` | Həmişə `dc+sd-jwt` ([[SPEC-CRED-0002]] §5.1.1) |
| `credential_signing_alg_values_supported` | Yalnız `ES256` |
| `proof_signing_alg_values_supported` | Yalnız `ES256` |
| `vct` | Qeydiyyatdan keçmiş sxem olmalıdır ([[SPEC-SCHEMA-0001]]) |
| Konfiqurasiya identifikatoru və `scope` | Hər ikisi sənəd növünün `vct` URN-idir (`urn:tamga:edu:DiplomaCredential:1`); ayrıca konfiqurasiya adı və ya qısa scope adı yoxdur. Rəqəmsal cüzdan [[t:PAR]]-da növü `scope` ilə tələb edir ([[t:HAIP]] §4.3) |
| `nonce_endpoint` | **Məcburi** — Tamga həmişə `c_nonce` tələb edir |
| `deferred_credential_endpoint`, `notification_endpoint` | **Elan edilmir** — bu gün hər iki uc yoxdur (§9, §10) |
| `batch_credential_issuance.batch_size` | **10** (§8) |
| `credential_metadata.credential_reuse_policy` | ETSI TS 119 472-3 §4.2.4.2 `arf_annex_ii`: `["per-relying-party", "once_only"]`, `batch_size` 10, `reissue_trigger_unused` 2, `reissue_trigger_lifetime_left` 7 gün (ARF ISSU_37–40) |
| `credential_metadata.embedded_disclosure_policy` ([[ADR-0046]], 2026-10-11; kod 0.5.0) | İstəyə bağlı, **yalnız qurum sənədi** konfiqurasiyalarında: daxili açıqlama siyasəti, ETSI TS 119 472-3 §4.2.5.2 məlumat modeli ilə, **dəyər olaraq** (ARF EDP_09). `id` (URI) + `type` (`none` · `authorized_relying_parties` · `specific_roots_of_trust`); `relying_parties` (`rp_id`, istəyə bağlı `service_id`), `subject_dns`, `entitlements`, `roots_of_trust` (`issuer_dn`, `serial_number`), istəyə bağlı `info_uri`, `authority`, `description`. Sənədə daxil olmur, yoxlayan tərəfə getmir; şəxsiyyət, ZK nüsxəsi, sürücülük vəsiqəsi məlumatı və əlaqə sənədlərində yoxdur. Siyasət əlavə edilərsə, dəyişdirilərsə və ya götürülərsə, həmin konfiqurasiyanın etibarlı sənədləri ləğv edilir (EP4). Rəqəmsal cüzdanın qiymətləndirməsi [[SPEC-WALLET-0001]] |
| İmzalı metadata (2026-09-29) | OpenID4VCI §12.2.3, ARF ISSU_32: `Accept: application/jwt` → `typ` `openidvci-issuer-metadata+jwt`, `iss` = `sub` = Credential Issuer Identifier, `iat`, `exp` (+1 gün); imzalayan qurumun etibar siyahısındakı sənəd imza sertifikatı (`x5c`). Rəqəmsal cüzdan qurumdan sənəd istəyərkən imzalı metadata tələb edir; imzalayanın barmaq izi siyahıdakı qeydlə uyğun gəlmirsə, metadata istifadə edilmir. Adi sorğu JSON qaytarır. |
| `issuer_info` (2026-09-29) | ETSI TS 119 472-3 §4.2.3, ARF RPRC_22: `registrar_dataset` (`identifier`, `srvDescription`, `registryURI` = milli siyahı, `providesAttestations` = səlahiyyətli növlər — imzalı siyahıdan) + varsa `registration_cert` ([[ADR-0026]]). Rəqəmsal cüzdan qurumdan sənəd istəməzdən əvvəl tələb olunan növün qeydiyyatda olduğunu, sertifikatın isə qeydiyyat qurumu tərəfindən imzalandığını və etibarlı olduğunu yoxlayır (RPRC_22a/23). |

**İnvariant PR2:** `credential_configurations_supported` daxilindəki hər `vct`
sənədi verən qurumun zəncirdə **səlahiyyətləndirildiyi** sxem olmalıdır
([[SPEC-BC-0001]] §3.4). Metadata yaradılarkən bu yoxlanılır; səlahiyyətsiz
sxem metadata-da yer ala bilməz.

Bu, səlahiyyət yoxlamasını yoxlama anından **sənəd verilməsi anına** keçirir. Yoxlayan tərəf
bunu onsuz da yoxlayır (`isAuthorizedForSchema`), lakin bu, sənədi verən qurumun yanlış konfiqurasiya
ucbatından rədd ediləcək sənəd yaratmasının qarşısını alır.

---

# 3. Credential Offer

## 3.1 Obyekt

```json
{
  "credential_issuer": "https://issuer.tamga.network/example-university",
  "credential_configuration_ids": ["urn:tamga:edu:DiplomaCredential:1"],
  "grants": {
    "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
      "pre-authorized_code": "oaKazRN8I0IbtZ0C7JuMn5",
      "tx_code": {
        "input_mode": "numeric",
        "length": 6,
        "description": "Enter the 6-digit code shown in the student portal"
      }
    }
  }
}
```

## 3.2 Ötürülməsi

QR kodun ölçüsünü kiçik saxlamaq üçün **`credential_offer_uri`** istifadə olunur,
obyektin özü daxil edilmir:

```
openid-credential-offer://?credential_offer_uri=
  https%3A%2F%2Fissuer.tamga.network%2Fexample-university%2Foffers%2F8a3f9c21
```

**İnvariant PR3:** Offer URI **birdəfəlikdir** və 5 dəqiqədən sonra etibarsız olur.
Çəkildikdən sonra 404 qaytarır.

Masaüstü kompüterdə QR, mobil cihazda dərin keçid (eyni OBS səhifəsi cihaz tipinə görə
seçir).

## 3.3 Təklif sinifləri (D-PROTO-1)

| Sinif | Harada görünür | Ömür | `tx_code` kanalı | Əlavə qayda |
|---|---|---|---|---|
| `on-screen` | OBS/portal ekranında (tələbə sessiyaya daxil olub) | **5 dəq**, birdəfəlik (PR3) | Ekranda (kanal = sessiya) | §3.2 olduğu kimi |
| `out-of-band` | E-poçt (və ya SMS) ilə göndərilən QR/keçid | **≤ 72 saat**, birdəfəlik | **Fərqli kanaldan** (e-poçt offer → SMS `tx_code`), 6 rəqəm | 3 yanlış cəhd → offer etibarsız olur; kanal ünvanı yalnız qurumun qeydiyyatdakı məlumatlarından; sənəd verildikdən sonra hər iki kanala "cüzdana əlavə edildi" bildirişi |

| `identity-bound` ([[ADR-0020]]) | Qurumun öz kanalı ilə ötürdüyü keçid/QR (e-poçt, tələbə portalı) | **7 gün**, birdəfəlik | **Yoxdur** — şəxs şəxsiyyət attestation-ını təqdim edir | `authorization_code` grant-ı; §3.4 |

İstifadə edilmiş offer ikinci dəfə skan edildikdə rəqəmsal cüzdan "bu dəvət artıq istifadə edilib" bildirir; tələbə "QR-ım işləmir" dediyi anda
pozuntu aşkar olunur → operator paneli: ləğv + sənədin yenidən verilməsi.

## 3.4 Şəxsiyyətə bağlı təklif ([[ADR-0020]], 2026-09-29)

Qurum təklif yaradarkən (`POST /{slug}/api/v1/offers`, `docs/api/tamga-issuer-api.openapi.yaml`) şəxsin uyğunlaşdırma
açarlarını (`bind { personal_administrative_number, birth_date }`) göndərərsə, təklif **şəxsiyyətə bağlı** olur:

```json
{
  "credential_issuer": "https://issuer.tamga.network/example-university",
  "credential_configuration_ids": ["urn:tamga:edu:DiplomaCredential:1"],
  "grants": { "authorization_code": { "issuer_state": "b3f1c2…" } }
}
```

- Pre-authorized kod və `tx_code` yoxdur; axın §11.2-dir. Rəqəmsal cüzdan [[t:PAR]]-da `issuer_state`-i göndərir; sənədi verən qurum təklifin etibarlı,
  istifadə edilməmiş və eyni sənəd növü üçün olduğunu yoxlayır.
- Sənədi verən qurum açarları açıq şəkildə saxlamır: hər qurum üçün açarlı heş (HMAC-SHA-256) saxlanılır. §11.2 addım 3-də təqdim edilən şəxsiyyət
  [[t:attestation]]-ındakı T.C. şəxsiyyət nömrəsi + doğum tarixinin heşi təklifdəki heşlə uyğun gəlmirsə, `access_denied` (AS2). Uyğun gələrsə, təklif
  istifadə olunmuş sayılır (birdəfəlik) və sənəd məlumatları qurumun mənbəyindən oxunur (`fetch`, AS1).
- Keçidi şəxsə qurum ötürür; Tamga əlaqə ünvanı almır (AS3). Şəxsiyyət attestation-ı olmayan şəxs üçün `tx_code` ilə təklif
  (§3.3) ehtiyat variant olaraq qalır.

---

# 4. Token Endpoint

```http
POST /example-university/token HTTP/1.1
Host: issuer.tamga.network
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

**[[t:DPoP]] məcburidir (RFC 9449; [[t:HAIP]]; 2026-09-29).** Rəqəmsal cüzdan hər sənəd alma axını üçün müvəqqəti P-256 açarı yaradır və `/token`
sorğusuna `DPoP` sübutu (`typ: dpop+jwt`, `jwk`, `jti`, `htm`, `htu`, `iat`) əlavə edir. Sənədi verən qurum sübutu yoxlayır, tokeni
açarın barmaq izinə (`jkt`) bağlayır və `token_type: DPoP` qaytarır. Sübut birdəfəlikdir (`jti`), ±5 dəqiqəlik pəncərəsi
var. AS metadata `dpop_signing_alg_values_supported: ["ES256"]` elan edir. Paketlərdə iki uc iki ayrı funksiyadır ([[ADR-0056]] K5):
token ucu `verifyTokenDpop` (bağlanacaq `jkt`-ni qaytarır), resurs ucu `verifyResourceDpop` (giriş tokeni və ona bağlı `jkt`
məcburidir; `ath` və açar uyğunluğu həmişə yoxlanılır).

**`c_nonce` burada YOXDUR** — 1.0 Final-da Nonce Endpoint-ə köçürülüb (§5).

Giriş tokeninin ömrü **5 dəqiqədir**. Vermə axını saniyələr çəkir; uzun ömür
lazımsız riskdir.

---

## 4.1 Yeniləmə tokeni — nüsxələrin səssiz yenilənməsi ([[ADR-0023]], 2026-09-29)

Qurum sənədlərində (tələbə, diplom; biletlər istisna olmaqla) token cavabı `refresh_token` daşıyır. Token həmin sənəd vermə əməliyyatındakı müştəri
nümunəsi açarına (WIA `cnf`; [[ADR-0060]]) bağlıdır; sənədi verən qurum yalnız SHA-256 heşini saxlayır (operator verilənlər bazası, 180 gün).
Cüzdan həddə çatdıqda (`credential_reuse_policy`) və təsadüfi gecikmə ilə aşağıdakını göndərir:

```http
POST /token
DPoP: <proof — the key may change (ADR-0060)>
OAuth-Client-Attestation: <fresh WIA for the same instance key>
OAuth-Client-Attestation-PoP: <PoP>

grant_type=refresh_token&refresh_token=…
```

Sənədi verən qurum tokeni birdəfəlik qəbul edir (silir). WIA-nın `cnf` açarı ilk buraxılışdakı ilə eyni olmalıdır (OAuth 2.0
Attestation-Based Client Authentication §10.3); DPoP sübutu məcburidir, açarı dəyişə bilər (RFC 9449 §5) və yeni giriş tokeni yeni
DPoP açarına bağlanır. Cüzdan hər əməliyyatda yeni WIA açarı istifadə edir; yeniləmə bağının açarını sənədlə saxlayır və yeniləmədə
təminatçıdan bu açara təzə WIA istəyir ([[ADR-0060]] K2). Qeydi səlahiyyətli mənbədən yenidən oxuyur;
qeyd yoxdursa, `invalid_grant` qaytarır və token qüvvədən düşür. Şəxs reyestrdən silindikdə həmin şəxsin bütün tokenləri silinir.
Cavab yeni giriş tokeni və **yeni** `refresh_token` daşıyır (rotation). Sənəd sorğusu §7 ilə eynidir. Əlaqə sənədləri
token vermir (şəxs sahəsi saxlanmır); şəxsiyyət xidməti yalnız ZK nüsxəsi tokeni verir (§4.2). AS metadata-sı
`grant_types_supported` `refresh_token` ehtiva edir.

## 4.2 Şəxsiyyət xidməti: ZK nüsxəsi tokeni ([[ADR-0044]], 2026-10-09)

Şəxsiyyət sənədi verilərkən (authorization code) token cavabı `refresh_token` daşıyır; bu token şəxsiyyət sənədini **yeniləmir**,
yalnız qısa ömürlü ZK nüsxəsi alır ([[ADR-0023]] AR4-ün yeganə istisnası). Şəxsiyyət xidmətinin metadata-sı ZK nüsxəsini ayrıca
`mso_mdoc` konfiqurasiyası kimi elan edir:

```json
"urn:tamga:id:ShortLivedIdentityAttestation:1": {
  "format": "mso_mdoc", "doctype": "urn:tamga:id:ShortLivedIdentityAttestation:1",
  "cryptographic_binding_methods_supported": ["cose_key"], "credential_signing_alg_values_supported": [-7], …
}
```

- **Nə vaxt ([[ADR-0062]]):** yalnız cüzdan PAR `scope`-unda şəxsiyyət sənədi əhatəsinin yanında ZK nüsxəsi əhatəsini
  (`urn:tamga:id:ShortLivedIdentityAttestation:1`) də istəyərsə; əhatə yalnız şəxsiyyət sənədi ilə istənə bilər (ZS1).
- **Token:** cüzdan üçün qeyri-şəffafdır (opaque); məzmunu yalnız şəxsiyyət xidmətinin açarı ilə açılan autentifikasiyalı şifrələmə (JWE `dir` +
  A256GCM) ilə qorunur: bağlı şəxsiyyət qeydi, nəsil sayğacı, ilk buraxılışdakı müştəri nümunəsi açarının (WIA `cnf`) barmaq izi ([[ADR-0060]]), bitmə tarixi (≤ şəxsiyyət sənədinin
  bitmə tarixi) və ZK nüsxəsinə daxil ediləcək **minimal** elementlər (bu gün `age_over_18`). Serverdə token və şəxs sahəsi saxlanmır; birdəfəlik istifadə
  üçün şəxsiyyət qeydində yalnız nəsil sayğacı qalır (ZC3).
- **Yeniləmə:** §4.1-dəki sorğu (`grant_type=refresh_token`, eyni nümunə açarlı etibarlı və ləğv edilməmiş WIA; DPoP açarı
  dəyişə bilər). Xidmət nəsli və nümunə açarı bağlılığını yoxlayır, şəxsiyyət qeydinin **bütün ləğv siyahısı bitlərinin 0** olduğunu öz siyahısından oxuyur; qeyd yoxdursa,
  müddəti bitibsə, ləğv edilibsə və ya dayandırılıbsa `invalid_grant` (ZC2). Cavab: yalnız ZK nüsxəsi üçün giriş tokeni + yeni
  `refresh_token` (nəsil +1).
- **Sənəd sorğusu:** `credential_configuration_id` = `urn:tamga:id:ShortLivedIdentityAttestation:1`, ən çoxu 3 proof (və ya açar
  sübutu). Cavabda hər nüsxə üçün `credential` = base64url IssuerSigned: docType = konfiqurasiya, ad sahəsi `tamga.id.1`, yalnız
  tokendəki elementlər, `validUntil − validFrom ≤ 24 saat` və ≤ şəxsiyyət sənədinin bitmə tarixi, MSO-da `status` YOXDUR (ZC1); imza şəxsiyyət
  sənədininki ilə eyni sertifikatdır. Saatı geri qalan telefonda sübut yaradıla bilsin deyə `signed` = `validFrom` 5 dəqiqə geriyə
  çəkilir (pəncərə yenə də ≤ 24 saat). Giriş tokeni başqa konfiqurasiya üçün istifadə edilə bilməz.
- **Jurnal:** yalnız say və imtina səbəbi; fərdi məlumatlar, token və qeyd identifikatoru yazılmır. Qalıq risk: xidmət yeniləmə
  tezliyindən cüzdanın aktiv olduğunu öyrənir, nəyin kimə göstərildiyini öyrənmir ([[ADR-0044]] Nəticələr).

---

# 5. Nonce Endpoint

Qorunmur — giriş tokeni tələb olunmur.

```http
POST /example-university/nonce HTTP/1.1
Host: issuer.tamga.network
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{ "c_nonce": "wKI4LT-mMoScTmxmQaMbtcMbtcpaSl" }
```

Cavab yalnız `c_nonce` daşıyır (OpenID4VCI 1.0 Final §7.2); ömür cavabda bildirilmir (`c_nonce_expires_in` Final versiyada yoxdur).

| Qayda | Dəyər |
|---|---|
| Ömür | 300 saniyə (5 dəqiqə) — cüzdan nonce-u aldıqdan sonra 10 nüsxə üçün aparat açarı yaradır və cüzdan provayderindən açar sübutu alır; yavaş cihazda bu bir dəqiqədən çox çəkə bilər |
| İstifadə | **Birdəfəlik** — istehlak edilir |
| Anbar | Atomik (yarış vəziyyəti = təkrar oynatma boşluğu) |

**Dəyişməz PR4:** `c_nonce` istehlakı atomik olmalıdır. "Yoxla, sonra sil"
iki addımı arasındakı yarış eyni sübutun iki dəfə istifadə edilməsinə imkan verir.

---

# 6. Key Proof

Cüzdan rəqəmsal sənədin bağlanacağı gizli açara nəzarət etdiyini sübut edir.

Başlıq:

```json
{
  "typ": "openid4vci-proof+jwt",
  "alg": "ES256",
  "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
}
```

Gövdə:

```json
{
  "aud": "https://issuer.tamga.network/example-university",
  "iat": 1789000012,
  "nonce": "wKI4LT-mMoScTmxmQaMbtcMbtcpaSl"
}
```

| Claim | Mənası |
|---|---|
| `aud` | Credential Issuer identifikatoru — başqa sənədi verən quruma yenidən təqdim edilə bilməz |
| `iat` | Yaradılma anı |
| `nonce` | Nonce Endpoint-dən alınan `c_nonce` — təzəlik |

Başlıqdakı `jwk` rəqəmsal sənədin `cnf` claim-inə daxil olan public key-dir
([[SPEC-CRED-0002]] §5.3). Gizli açar cihazın təhlükəsiz zonasından çıxmır.

**Dəyişməz PR5:** `alg` yalnız `ES256`. `none` və ya simmetrik alqoritm
rədd edilir.

---

# 7. Credential Endpoint

## 7.1 Sorğu

```http
POST /example-university/credential HTTP/1.1
Host: issuer.tamga.network
Authorization: DPoP eyJ0eXAiOiJhdCtqd3Qi...
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIs...   (same key; ath = SHA-256(access_token))
Content-Type: application/json

{
  "credential_configuration_id": "urn:tamga:edu:DiplomaCredential:1",
  "proofs": {
    "jwt": ["eyJ0eXAiOiJvcGVuaWQ0dmNpLXByb29mK2p3dCI..."]
  }
}
```

## 7.2 Cavab

```json
{
  "credentials": [
    { "credential": "eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCJ9...~WyJPdkt...~WyJoTjJ...~" }
  ]
}
```

Qaytarılan sətir [[SPEC-CRED-0002]] §2-dəki birləşmiş formatdır: issuer-signed JWT +
disclosure-lar + sondakı boş `~` (KB-JWT hələ yoxdur). Bildiriş ucu təqdim edilmədiyi üçün cavabda `notification_id` yoxdur (§10).

## 7.3 Sənədi verən qurum tərəfində yoxlama ardıcıllığı

```
1. Is the access token valid and does its scope include this configuration
2. The proofs.jwt array is not empty and its length does not exceed batch_size
3. For each proof:
     a. typ == "openid4vci-proof+jwt", alg == ES256
     b. the signature verifies with the jwk in the header
     c. aud == my own credential_issuer value
     d. the nonce is valid and NOT CONSUMED → consume atomically
     e. iat within the window
4. Are the jwks in the proofs DIFFERENT FROM EACH OTHER (§8.2)  ← Tamga rule
5. Is the schema authorisation still valid (chain/indexer)
6. Produce and sign the credential
```

5-ci addım lazımsız görünə bilər — metadata yaradılarkən yoxlanılmışdı (PR2).
Lakin səlahiyyət metadata keşə yazıldıqdan sonra geri alınmış ola bilər. Bu, ucuz bir
yoxlamadır, səhv rəqəmsal sənəd yaratmağın bədəli isə yüksəkdir.

## 7.4 Eyni giriş tokeni ilə bir neçə sorğu ([[ADR-0059]], 2026-10-21)

Giriş tokeni ömrü (≤ 5 dəqiqə, PR9) ərzində bir neçə sənəd sorğusunda istifadə oluna bilər (OpenID4VCI 1.0 §8; Aİ istinad
sənəd verəni kimi). Hədlər: yalnız tokenin əhatə etdiyi konfiqurasiya (AT1); token başına cəmi nüsxə ≤ toplu verilmə ölçüsü, 10
(AT2; həddi aşan sorğu `invalid_token` alır); hər sorğu tokenin bağlı olduğu DPoP açarı ilə, ömür uzanmır (AT3). Şəxsiyyət
xidmətində sonrakı sorğu ilk sorğunun qeydinə nüsxə əlavə edir, əvvəlki paketi ləğv etmir (AT4); şəxsi sahələr tokenin ömrü
bitəndə və ya nüsxə haqqı dolanda silinir (AT5). ZK nüsxəsi tokeni (§4.2) və bilet bir paket olaraq qalır.

## 7.5 Psevdonim toxumu: ayrıca konfiqurasiya ([[ADR-0061]], 2026-10-22)

Şəxsiyyət xidmətinin metadata-sı `urn:tamga:id:PseudonymSeed:1` növünü ayrıca `dc+sd-jwt` konfiqurasiyası kimi elan edir. Cüzdan
şəxsiyyət sənədini aldıqdan sonra onu **eyni giriş tokeni ilə** tək açar sübutu ilə (şəxsiyyət sənədinin ilk nüsxəsinin açarı)
istəyir; toxum bir dəfə və yalnız həmin tokenlə şəxsiyyət sənədi verilibsə verilir (SD1). Növ PAR ilə tək istənə bilməz. Sənəd
cavabı OpenID4VCI 1.0 §8.3 xaricində yuxarı səviyyəli sahə daşımır (SD2). Toxumun məxfilik qaydaları: [[ADR-0031]] PS1–PS6.

---

# 8. Toplu sənəd verilməsi

> Bu bölmə [[SPEC-SCHEMA-0002]] Açıq Məsələ 1b və [[SPEC-CRED-0002]] Açıq Məsələ 4-ü
> bağlayır.

## 8.1 Niyə

Eyni rəqəmsal sənədi iki [[t:verifier|yoxlayan tərəfə]] təqdim edən istifadəçi, həmin iki yoxlayan tərəf əməkdaşlıq
edərsə, eyniləşdirilə bilər ([[SPEC-CRED-0003]] §9.4). Həll yolu hər təqdimatda **fərqli
bir nüsxə** istifadə etməkdir.

Bundan əlavə, tələbə sənədinin təzəlik siyasəti ([[SPEC-SCHEMA-0002]] §2.1.2) tez-tez
yeniləmə tələb edir; batch bunu hər dəfə sənədi verən quruma müraciət etmədən mümkün edir
və "bu şəxs sənədindən nə qədər tez-tez istifadə edir" siqnalını aradan qaldırır.

## 8.2 Hər nüsxə fərqli açardan istifadə edir — kritik qayda

**Dəyişməz PR6:** Batch-dəki nüsxələrin hər biri **fərqli cihaz
açarına** bağlanır. Eyni `cnf` istifadə edilərsə, nüsxələr bir-biri ilə əlaqələndirilə bilər
və batch-in bütün məqsədi aradan qalxır.

Bu, cüzdanın hər partiya üçün N açar yaratması deməkdir. Müasir təhlükəsiz
zonalar bunu ucuz edir; açarlar bir dəfəyə yaradılıb saxlanılır.

```json
"proofs": {
  "jwt": [
    "<proof: key 1>",
    "<proof: key 2>",
    "...",
    "<proof: key 10>"
  ]
}
```

Sənədi verən qurum hər sübut üçün ayrıca rəqəmsal sənəd yaradır və hər birinə həmin sübutun
`jwk`-ini `cnf` kimi yerləşdirir.

7.3/4-cü addımdakı "jwk-lar bir-birindən fərqlidirmi" yoxlaması bu qaydanı **sənədi verən qurum
tərəfində məcburi edir** — səhv cüzdan tətbiqi eyni açarla 10 sübut
göndərərsə, sorğu rədd edilir.

## 8.3 Partiyanın həcmi: 10

| Dəyər | Qiymətləndirmə |
|---|---|
| 1 (batch yoxdur) | Korrelyasiya açıqdır |
| 5 | Tipik istifadə üçün sərhəddədir |
| **10** | **Seçildi** |
| 50+ | İstifadə edilməyən nüsxələr toplanır; diplomda status indeksinin israfı |

Əsaslandırma: 90 günlük tələbə sənədində tipik istifadə bir neçə təqdimatdır; 10 nüsxə
rahatlıqla kifayət edir. Diplom üçün də bir müraciət mövsümünə kifayətdir.

## 8.4 Toplu diplomun əlavə xərci

Diplom ləğv siyahısından istifadə edir ([[SPEC-SCHEMA-0002]] §3.1). Hər nüsxə **ayrıca
status indeksi** istehlak edir. 10 nüsxə = 10 indeks.

100.000-lik siyahıda bu əhəmiyyətsizdir (10.000 məzun × 10 = 100.000 — sərhəddə; iki
siyahı açılır).

**Ləğv edərkən diqqət:** Diplom ləğv edildikdə **10 indeksin hamısı**
işarələnməlidir. Sənədi verən qurum hansı indekslərin eyni diploma aid olduğunu öz
verilənlər bazasında saxlayır — bu uyğunluq **heç vaxt kənara çıxmır**, çünki çıxarsa,
nüsxələrin əlaqələndirilə bilməməsi sona çatır.

10 bitin eyni anda dəyişməsi korrelyasiya siqnalı olardı; lakin siyahı dəyişiklik olub-olmamasından
asılı olmayaraq sabit intervalla dərc edildiyi üçün ([[SPEC-CRED-0003]] §5.1)
hansı bitlərin birlikdə dəyişdiyi kənardan görünmür.

## 8.5 Faza qərarı

| Rəqəmsal sənəd | Batch |
|---|---|
| `urn:tamga:edu:StudentCredential:1` | **ilk mərhələdə aktivdir** — qısa ömür + tez-tez istifadə |
| `urn:tamga:edu:DiplomaCredential:1` | **ilk mərhələdə aktivdir** — 10 nüsxə, hər nüsxə üçün ayrıca status indeksi (§8.4) |

Diplom da 10 nüsxə ilə verilir (layihə rəhbərliyinin qərarı, 2026-10-08; əvvəlki qərar: pilotda bir nüsxə, dövlət mərhələsində
batch). Hər nüsxə öz status indeksini daşıyır; eyni diplomun indeksləri qurumun öz verilənlər bazasında uyğunlaşdırılır, ləğv zamanı
hamısı birlikdə işarələnir (§8.4) və bu uyğunluq kənara çıxmır. Beləliklə, hər yoxlayan tərəfə ayrıca nüsxə gedir və təqdimatlar
`idx` vasitəsilə bir-biri ilə əlaqələndirilə bilməz.

---

# 9. Təxirə salınmış sənəd verilməsi (deferred)

**Hazırda təqdim edilmir.** Tamga-nın sənədi verən qurumları təxirə salınmış sənəd verilməsi ucunu elan etmir (`deferred_credential_endpoint` yoxdur). Qeyd
hələ sənəd verilməsinə uyğun deyilsə (məs., məzuniyyət qərarı təsdiqlənməyibsə), `/credential` dərhal xəta qaytarır (`issuance_halted`, §13);
qeyd hazır olduqda qurum yeni təklif yaradır. Aşağıdakılar uc əlavə edildikdə tətbiq olunacaq profildir (OpenID4VCI 1.0 Final
§9).

Rəqəmsal sənəd dərhal verilə bilmirsə, sənəd cavabı **HTTP 202** ilə qayıdır; `interval` (saniyə) məcburidir:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{ "transaction_id": "8xLOxBtZp8", "interval": 300 }
```

Daha sonra cüzdan Deferred Credential Endpoint-ə **DPoP-a bağlı** tokenlə müraciət edir (PR17; giriş tokeni 5 dəqiqəlik olduğundan
lazım gələrsə, əvvəlcə yeniləmə tokeni ilə yenisini alır, §4.1):

```http
POST /example-university/deferred HTTP/1.1
Host: issuer.tamga.network
Authorization: DPoP eyJ0eXAiOiJhdCtqd3Qi...
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIs...   (same key; ath = SHA-256(access_token))
Content-Type: application/json

{ "transaction_id": "8xLOxBtZp8" }
```

Hazırdırsa, cavab §7.2 ilə eynidir (HTTP 200, `credentials`). Hələ hazır deyilsə, yenə **HTTP 202** və yeni `interval` qaytarılır;
cüzdan həmin müddət qədər gözləyir. Naməlum və ya müddəti bitmiş əməliyyat `invalid_transaction_id` xətasıdır. Köhnə layihələrdəki
`issuance_pending` xətası 1.0 Final versiyada yoxdur.

**Tamga qaydası:** `transaction_id` ömrü **30 gündür**. Fakültə şurasının qərarı
gecikə bilər; lakin sonsuz gözləyən əməliyyat sənədi verən qurum tərəfində sonsuz vəziyyət
deməkdir.

**Məxfilik qeydi:** Cüzdanın müntəzəm sorğulaması (polling) sənədi verən quruma "bu şəxs
hələ gözləyir" siqnalı verir. `interval` ən azı 300 saniyə olmalıdır və cüzdan
eksponensial geri çəkilmə tətbiq etməlidir.

---

# 10. Notification Endpoint

**Hazırda təqdim edilmir.** Tamga-nın sənədi verən qurumları `notification_endpoint` elan etmir və sənəd cavabında `notification_id` qaytarmır
(OpenID4VCI 1.0 Final §8.3: `notification_id` yalnız bildiriş ucu təqdim edildikdə verilir). Cüzdan bildiriş göndərmir. Uc
əlavə edilərsə, profil belədir:

```json
{ "notification_id": "3fwe98js", "event": "credential_accepted" }
```

| Hadisə | Mənası (OpenID4VCI 1.0 Final §11.1) |
|---|---|
| `credential_accepted` | Rəqəmsal sənəd cüzdanda uğurla saxlanıldı |
| `credential_failure` | Sənəd verilməsi istifadəçi əməliyyatından kənar səbəbdən uğursuz oldu (məs., saxlanıla bilmədi) |
| `credential_deleted` | Sənəd verilməsi **istifadəçinin əməliyyatı ilə** tamamlanmadı (məs., şəxs sənədi cüzdana əlavə etməkdən imtina etdi). Bu, sənədin sonradan cüzdandan silindiyi **demək deyil** |

**Tamga qaydası:** bildirişlər sənədi verən qurum tərəfində **yalnız sayğac kimi** istifadə olunur; şəxs üzrə saxlanılmır. Əks halda
sənədi verən qurum şəxsin sənədi qəbul edib-etmədiyini öyrənir — bu, lazımsız davranış siqnalıdır. Cüzdan rəqəmsal sənədin sonradan
silindiyini heç bir sənədi verən quruma bildirmir.

---

# 11. Sənəd verilməsində Holder Binding və təminat

[[SPEC-CRED-0001]] §3-ün protokol qarşılığı. Buraxılışdakı [[t:holder-binding]] metodu [[t:holder]]
assurance səviyyəsini ([[t:LoA]]) müəyyən edir ([[PM-ASSUR-0001]] A oxu).

| Üsul | Necə | Səviyyə |
|---|---|---|
| **Uzaqdan — OBS sessiyası** | Tələbə OBS-yə özü daxil olur, offer yaradılır, `tx_code` OBS ekranındadır | **T1** (OBS 2FA ilədirsə, T2) |
| **Üz-üzə — qəbul masası** | Əməkdaş fiziki şəxsiyyət vəsiqəsini görür, rəqəmsal cüzdandakı QR kodu oxudur | **T2/T3** (qurumun qeydiyyat orqanı) |
| **eID çipi** | NFC ilə dövlət şəxsiyyət vəsiqəsindən oxuma | **T3** — dövlət mərhələsi |

**Əhatə hüdudu barədə xatırlatma:** Heç biri "qarşımdakı insan bu şəxsdir" sualını
kriptoqrafik olaraq həll etmir ([[SPEC-CRED-0001]] §3, əhatə hüdudu). Üz-üzə
bağlama ən güclüsüdür, çünki **prosedur** yoxlamasını rəqəmsal sənədin verilməsi anına keçirir.

**Uzaqdan [[t:identity-proofing]] (T2):** lisenziyalı provayderlə sənəd + canlılıq + üz uyğunlaşdırması; profil və provayder
inteqrasiyası [[SPEC-ID-0003]]. Tip ↔ minimum səviyyə [[FW-RB-0002]] §4.4 (tələbə sənədi T1, diplom T2).

## 11.1 Wallet unit yoxlanışı (D-CRED-6 — ETSI TS 119 471 REQ-EAASP-4.2.1.2-02/03)

Sənədi verən qurum **grant-dan əvvəl** rəqəmsal cüzdanın Wallet Unit Attestation-ını yoxlayır. Ötürmə: OAuth 2.0 Attestation-Based Client
Authentication (HAIP) — token sorğusunda iki başlıq:

| Başlıq | Məzmun | Yoxlama |
|---|---|---|
| `OAuth-Client-Attestation` | WUA JWT (`typ: oauth-client-attestation+jwt`, x5c = cüzdan provayderinin sertifikatı; claim-lər [[SPEC-CRED-0001]] §4) | x5c yarpağı `lotl.wallet_providers[].wua_signing_keys` daxilində (`TrustSource.isWalletProviderKey`; UNKNOWN → `503 temporarily_unavailable`), `exp`, `cnf` P-256, `key_storage` ≥ kirayəçi siyasəti (WL3) |
| `OAuth-Client-Attestation-PoP` | `typ: oauth-client-attestation-pop+jwt`; `iss` = WUA `sub`, `aud` = `credential_issuer`, `iat` (±300 s), `jti`; WUA `cnf` açarı ilə imzalanmış | imza, aud, iat, jti |

Xəta: `invalid_client` (çatışmır/etibarsızdır). Nəticə (`solution_id`, `key_storage`) token qeydinə və audit jurnalına yazılır;
**rəqəmsal sənədə daxil edilmir**. Demo: `key_storage: software` qəbul edilir (kənarlaşma S-9/S-14); pilot: `secure_enclave`/`strongbox`.

### 11.1.1 WIA + KA — Aİ TS3 ([[ADR-0025]], 2026-09-29)

Eyni başlıqlarla **WIA** (Wallet Instance Attestation) göndərilir:
- `client_status {status, exp}` daşıyır,
- ömrü **< 24 saat**dır,
- hər sənəd əməliyyatında **yeni PoP açarı** və **yeni ləğv qeydi** ilə alınır.

Sənədi verən qurum imzanı, provayder açarını, PoP-u və `client_status`-u ([[t:wallet-provider|cüzdan provayderinin]] Token Status List-i; ləğv → `invalid_client`,
siyahı alına bilmirsə → 503) yoxlayır. WIA açar anbarı bəyanını daşımır.

Sənəd sorğusunda paket **tək proof** ilə istənilir:
- `typ: openid4vci-proof+jwt`, başlıqda `key_attestation` ([[t:key-attestation]], KA: `typ` `key-attestation+jwt` — OpenID4VCI 1.0 Final Əlavə D.1, provayder tərəfindən imzalanmış, `attested_keys`,
  `key_storage` / `user_authentication` ISO 18045, `key_storage_status`),
- proof `attested_keys[0]` ilə imzalanır.

Sənədi verən qurum KA-nı, ləğv statusunu və nonce-u yoxlayır, rəqəmsal sənədləri `attested_keys`-a bağlayır. Kirayəçinin `min_key_storage` alt həddini
KA-dakı səviyyəyə əsasən tətbiq edir.

Metadata `proof_types_supported.jwt.key_attestations_required` qəbul edilən səviyyələri elan edir (ARF ISSU_27d). Köhnə WUA və hər açar
üçün ayrıca proof formatı pilotdan əvvələdək qəbul edilir.

**Ləğv dəstəyi müddəti üzrə üstünlük (Aİ TS3 §2.4; ARF WUA_32, ISSU_12c; kod 0.5.0).** Qurum alacağı KA-nın qalan ləğv dəstəyi müddəti
üçün `key_attestations_required.preferred_key_storage_status_period`, WIA-nınkı üçün isə metadata-nın üst səviyyəsində
`preferred_client_status_period` (saniyə) elan edə bilər. Rəqəmsal cüzdan metadata-nı sənəd istəyərkən oxuyur; qurumun səviyyə tələbini
qarşılamayan KA-nı göndərmir (WUA_05a), dəstək müddəti (`*.exp − şimdi`) üstünlükdən qısa olan WIA və KA əvəzinə provayderdən
daha uzununu istəyir. Üstünlük məcburiyyət deyil: provayder verə bilməsə, sənəd yenə də istənilir; zəncirvari ləğv tətbiq edən sənədi verən qurum
sənədin müddətini təyin edərkən gördüyü WIA və KA dəstək müddətlərinin ən erkən bitməsi ilə məhdudlaşdırır ([[ADR-0047]] K1).

**Dəyişməz PR7:** Verilən rəqəmsal sənədin hansı bağlama üsulu ilə
verildiyi sənədi verən qurumun audit jurnalına yazılır. Rəqəmsal sənədin **içinə yazılmır** —
sənəd sahibinin assurance məlumatı nə zəncirə, nə də rəqəmsal sənədə daxil olur ([[PM-TRUST-0001]]).

---

## 11.2 Rəqəmsal cüzdanın başlatdığı sənəd vermə — authorization code (ADR-0011 K3, D-ID-6)

Rəqəmsal cüzdan qurumlar kataloqunu **[[t:trust-list|etibar siyahısından]]** oxuyur (`tl-<cc>.issuers[]`; əlavə server yoxdur) və rəqəmsal sənədi birbaşa qurumdan tələb edir.
Bu yolda qurum şəxsiyyəti yoxlayan tərəf kimi çıxış edir və bunu **şəxsiyyət attestation-unun təqdimatı** ilə həyata keçirir; tələbə girişi/OBS tələb olunmur. Pre-authorized yol
(§3) olduğu kimi qalır; qurum hər ikisini təqdim edir.

| Addım | Rəqəmsal cüzdan → sənədi verən qurum | Qayda |
|---|---|---|
| 1 | `POST /{slug}/par` — `client_id` = WUA `sub`, `redirect_uri`, `code_challenge` (S256), `scope` = istənilən növün `vct`-si (metadata-dakı `scope`, [[t:HAIP]] §4.3; scope elan etməyən sənədi verən qurumda ehtiyat olaraq `authorization_details[{type: openid_credential, credential_configuration_id}]`; ikisi birlikdə gələrsə, eyni növü göstərməlidir), `state`, şəxsiyyətə bağlı təklifdə `issuer_state` (§3.4); başlıqlar `OAuth-Client-Attestation` + PoP | PAR məcburidir (RFC 9126); müştəri identifikatoru **WUA** (`attest_jwt_client_auth`); `client_secret` yoxdur; PAR 10 dəq |
| 2 | `GET /{slug}/authorize?client_id&request_uri` — `Accept: application/json` | Qurumun sənəd vermə xidməti **OpenID4VP sorğusu** qaytarır (`presentation_request.qr_payload`; DCQL: `IdentityAttestation` → `personal_administrative_number`, `birthdate`, `given_name`, `family_name`); sorğu `rp-<slug>` sertifikatı ilə imzalanır, RP qeydi etibar siyahısındadır (AP6 scope) |
| 3 | Rəqəmsal cüzdan **standart təqdimat axınını** işə salır (SPEC-PROTO-0002: RP qeydi, təsdiq ekranı, KB-JWT, JWE) → `POST /{slug}/vp/response` | Sənədi verən qurum T0 + A–E ilə yoxlayır (status-un ilkin çəkilməsi S12), **TCKN + doğum tarixi** ilə uyğunlaşdırır: `issuer_state` varsa, təklifdəki həşlə (§3.4), yoxdursa, qurumun mənbəyinə `lookup` ([[ADR-0020]]; `docs/api/institution-source.openapi.yaml`); mənbə əlçatan deyilsə, `temporarily_unavailable`; cavab `{redirect_uri}` = `redirect_uri?code=…&state=…` və ya `error=access_denied` |
| 4 | `POST /{slug}/token` — `grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`, WUA başlıqları | code birdəfəlikdir, ≤ 60 s; PKCE; müştəri PAR-dakı WUA `sub` ilə eynidir |
| 5 | `/nonce` → proof-lar → `/credential` | §5–§8 olduğu kimi (10 nüsxə, PR6) |

Tamga şəxsiyyət xidməti (`id.tamga.network`) eyni axını **brauzer** ilə işə salır: `/authorize` KVKK üzrə məlumatlandırma + açıq razılıq →
uzaqdan yoxlama provayderi → `/idv/return` (qərar sorğusu) → `redirect_uri?code`. ETSI 472-3-ə əsasən T3 yalnız bu yolla
verilə bilər (pre-authorized ilə heç vaxt, IDP7). Metadata: `pushed_authorization_request_endpoint`, `authorization_endpoint`,
`require_pushed_authorization_requests: true`, `code_challenge_methods_supported: ["S256"]`, `grant_types_supported` hər iki grant.

# 12. Başdan-sona — Ayşenin diplomu

```
Ayşe                    OBS/Issuer                   Chain 
 │                          │                           │
 │─ sign in to OBS ────────▶│                           │
 │─ "Get my diploma" ──────▶│                           │
 │                          │─ check schema auth. ─────▶│  (indexer)
 │                          │◀─ authorised ─────────────│
 │◀─ QR + tx_code 493812 ───│                           │
 │                          │                           │
 │  [scan QR with wallet]   │                           │
 │─ GET offer_uri ─────────▶│                           │
 │◀─ credential offer ──────│                           │
 │                          │                           │
 │─ enter tx_code ─────────▶│                           │
 │─ POST /token ───────────▶│                           │
 │◀─ access_token (5 min) ──│                           │
 │                          │                           │
 │─ POST /nonce ───────────▶│                           │
 │◀─ c_nonce ───────────────│                           │
 │                          │                           │
 │  [generate device key]   │                           │
 │  [sign key proof]        │                           │
 │─ POST /credential ──────▶│                           │
 │                          │  · verify the proof       │
 │                          │  · consume the nonce once │
 │                          │  · fetch data from OBS    │
 │                          │  · map ISCED-F            │
 │                          │  · create disclosures     │
 │                          │  · reserve status index   │
 │                          │  · sign with the HSM      │
 │◀─ SD-JWT VC ─────────────│                           │
```

**Zəncirə heç nə yazılmadı.** Status indeksinin rezervasiyası sənədi verən qurumun öz
verilənlər bazasındadır ([[SPEC-BC-0001]] §11.1 addım 7).

---

# 13. Xəta cavabları

| Kod | Nə vaxt | Rəqəmsal cüzdanın davranışı |
|---|---|---|
Kodlar OpenID4VCI 1.0 Final §8.3.1.2-dən götürülüb; son iki sətir Tamga əlavəsidir.

| Kod | Nə vaxt | Rəqəmsal cüzdanın davranışı |
|---|---|---|
| `invalid_proof` | Sübut etibarsızdır (imza, `typ`, `aud`, `iat`, açar sübutu) | **Eyni sübutla təkrar cəhd edilmir** — xəta bildirilir |
| `invalid_nonce` | Sübutdakı `c_nonce` naməlumdur, müddəti bitib və ya artıq istifadə olunub | Yeni `c_nonce` alınır, sübutlar yenidən imzalanır |
| `invalid_credential_request` | Struktur səhvdir və ya istənilən konfiqurasiya bu tokenin əhatəsində deyil | **Təkrar cəhd edilmir** — xəta bildirilir |
| `unknown_credential_configuration` | Sənədi verən qurum bu konfiqurasiyanı ümumiyyətlə təqdim etmir | Metadata yenilənir |
| `credential_request_denied` | Səlahiyyət yoxdur / sxem səlahiyyəti etibar siyahısından çıxarılıb | **Təkrar cəhd edilmir** |
| `invalid_token` | Tokenin müddəti bitib | Axın yenidən başladılır |
| `invalid_transaction_id` | Təxirə salınmış endpoint-də əməliyyat naməlumdur və ya müddəti bitib (endpoint əlavə edildikdə, §9) | Axın yenidən başladılır |
| `issuance_halted` (Tamga) | Qeyd rəqəmsal sənəd verilməsi üçün uyğun deyil (məs. məzun qeydi yoxdur) | Quruma müraciət edilir |
| `temporarily_unavailable` (HTTP 503) | Etibar siyahısı və ya qurumun mənbəyi müvəqqəti olaraq əlçatan deyil | Sonra yenidən cəhd edilir |

**Dəyişməz PR8:** Xəta mesajları fərdi məlumatlar ehtiva etmir. "Ayşe Yılmaz üçün qeyd
tapılmadı" əvəzinə `credential_request_denied` qaytarılır; təfərrüat yalnız sənədi verən qurumun
öv audit jurnalındadır.

---

# 14. Dəyişməzlər

| # | İnvariant |
|---|---|
| **PR1** | Pre-authorized axında `tx_code` buraxıla bilməz. |
| **PR2** | Metadata-dakı hər `vct` sənədi verən qurumun zəncirdə səlahiyyətləndirildiyi sxemdir. |
| **PR3** | Sənəd təklifi URI-si birdəfəlikdir, ömrü 5 dəqiqədir. |
| **PR4** | `c_nonce` istehlakı atomardır. |
| **PR5** | Sübut və sənəd imzası yalnız `ES256`. |
| **PR6** | Batch-dəki hər nüsxə **fərqli cihaz açarına** bağlanır. |
| **PR7** | Bağlama üsulu audit qeydinə yazılır, sənədə yazılmır. |
| **PR8** | Xəta cavablarında fərdi məlumatlar olmur. |
| **PR9** | Giriş tokeninin ömrü ≤ 5 dəqiqədir. |
| **PR10** | Nüsxə↔indeks uyğunluğu sənədi verən qurumda qalır, heç vaxt kənara çıxmır. |
| **PR11** | Verilməzdən əvvəl Wallet Unit Attestation + PoP yoxlanılır; WUA imzalayanı etibar siyahısındakı cüzdan provayderi açarlarından biridir; `key_storage` kirayəçi (tenant) siyasətinə cavab vermirsə, sənəd verilmir (§11.1). |
| **PR12** | `out-of-band` offer-də `tx_code` offer ilə **fərqli kanaldan** ötürülür; üç yanlış cəhd offer-i etibarsız edir; kanal ünvanı yalnız qurumun qeydiyyatdakı məlumatlarından götürülür (§3.3). |
| **PR13** | Authorization code axınında PAR və PKCE (S256) məcburidir; klient identifikatoru Wallet Unit Attestation-dır (`client_secret` yoxdur); `redirect_uri` PAR-da bağlanır və `/authorize`-da dəyişdirilə bilməz; `redirect_uri` klientin qeydiyyatdakı ünvanları ilə tam üst-üstə düşməlidir (icazə siyahısı; əks halda PAR `invalid_request` ilə rədd edilir — RFC 9126 §2.1); token sorğusu PAR-dakı `redirect_uri`-ni və eyni `client_id`-ni (WUA `sub`) daşımalıdır (əks halda `invalid_grant`); rəqəmsal cüzdan token son nöqtəsini avtorizasiya serverinin metaməlumatlarından (`token_endpoint`, RFC 8414) götürür; code birdəfəlikdir və ≤ 60 s (§11.2). Paketlərdə `createPar` icazə siyahısını (`allowedRedirectUris`) məcburi qəbul edir; klientin qeydiyyatdakı ünvanı yoxdursa, PAR rədd edilir ([[ADR-0056]] K2). |
| **PR14** | Qurumun sənəd vermə xidməti rəqəmsal cüzdanın başlatdığı sənəd vermədə şəxsiyyəti yalnız **kimlik attestation-ının təqdimatı** ilə və tam yoxlama xəttindən (T0 + A–E) keçərək uyğunlaşdırır; uyğunlaşdırma açarları (TCKN, doğum tarixi) saxlanılmır və loglanmır; uyğunluq tapılmazsa, sənəd verilmir (§11.2, [[ADR-0011]] K3/K6). |
| **PR15** | Rəqəmsal cüzdan qurum kataloqunu yalnız etibar siyahısından götürür; siyahıda olmayan sənədi verən quruma PAR göndərmir (§11.2). |
| **PR17** | Giriş tokeni DPoP-a bağlıdır (RFC 9449): `/token` etibarlı DPoP sübutu olmadan token vermir; `/credential` yalnız `Authorization: DPoP` ilə və eyni açarla, bu son nöqtə və bu token (`ath`) üçün yaradılmış, əvvəllər görülməmiş sübutla işləyir (§4, §7.1). |
| **PR18** | Yeniləmə tokeni birdəfəlikdir, hər istifadədə yenilənir, sənəd vermə əməliyyatındakı müştəri nümunəsi açarına (WIA `cnf`) bağlıdır, DPoP açarı dəyişə bilər ([[ADR-0060]]); sənədi verən qurum yeniləmə zamanı qeydi səlahiyyətli mənbədən yenidən oxuyur və qeyd yoxdursa, sənəd vermir ([[ADR-0023]] AR2–AR3, §4.1). |
| **PR19** | WIA ilə gələn sorğuda `client_status` ləğv edilibsə, sənəd verilmir; KA-lı proof-da KA provayder tərəfindən imzalanmış, ləğv edilməmiş, proof `attested_keys[0]` ilə imzalanmış olmalı və nonce etibarlı olmalıdır; açar anbarının minimum həddi KA səviyyəsinə görə tətbiq edilir ([[ADR-0025]], §11.1.1). |
| **PR16** | Kimlik attestation-ı cavabında hər `credentials[]` obyekti `credential` (SD-JWT VC) ilə **eyni proof açarına bağlı** bir `mso_mdoc` (base64url IssuerSigned, ISO 18013-5) daşıyır; iki təqdimat forması eyni sorğuda yaradılır və eyni status bitini paylaşır; rəqəmsal cüzdan mdoc-u SD-JWT nüsxəsi ilə çarpaz yoxlamadan (eyni sənədi verən qurum sertifikatı, eyni sahələr, `deviceKey` = `cnf`) saxlamır ([[ADR-0013]] MD1–MD3). |

---

# Təhlükəsizlik və məxfilik qeydləri

**Offer QR-ı sirdir.** `tx_code` olmadan ekranın fotosunu çəkən istənilən şəxs
sənədi öz rəqəmsal cüzdanına götürə bilər. PR1 və PR3 birlikdə bu boşluğu bağlayır.

**Nonce yarışı.** PR4 buraxılarsa, eyni sübut iki dəfə istifadə edilə bilər; batch
ssenarisində bu, təcavüzkarın öz açarını nüsxələrdən birinə
bağlamasına səbəb olur.

**Sorğulama siqnaldır.** Təxirə salınmış sənəd verilməsində (son nöqtə əlavə edildikdə) rəqəmsal cüzdanın tez-tez sorğu göndərməsi
sənədi verən quruma davranış haqqında məlumat verir (§9).

**Batch nüsxə sayını üzə çıxarır.** Yoxlayan tərəf eyni istifadəçidən gələn
təqdimatların hamısının fərqli `cnf` daşıdığını görsə, batch istifadə edildiyini
anlayar — lakin **hansı nüsxələrin eyni şəxsə aid olduğunu** anlaya bilməz. Məqsəd
məhz budur.

---

# Açıq məsələlər

1. ~~Batch nüsxələri tükəndikdə~~ — **BAĞLANDI** ([[SPEC-WALLET-0001]] §4.3):
   2 nüsxə qaldıqda bildiriş; tükəndikdə **tanış** yoxlayan tərəfdə problem yoxdur
   (sabit uyğunlaşdırma), **yeni** yoxlayan tərəfdə istifadəçiyə seçim təqdim olunur — yeniləmək
   və ya korrelyasiya xəbərdarlığı ilə mövcud nüsxəni yenidən istifadə etmək.
2. ~~Wallet Unit Attestation (WUA) sənəd verilməsi anında məcburi olmalıdırmı?~~ — **BAĞLANDI (§11.1, DB-16):**
   məcburidir; cüzdan provayderinin qeydi siyahı mərhələsində etibar siyahısındadır (`lotl.wallet_providers[]`), Provider xidmətini rəqəmsal cüzdanı təqdim edən təşkilat idarə edir ([[ADR-0042]]); şəbəkə idarə etmir.
3. ~~Authorization code axını ilk mərhələdə ümumiyyətlə tətbiq olunacaqmı?~~ — **BAĞLANDI (§11.2, [[ADR-0011]] D-ID-6):** tətbiq edildi;
   PAR + PKCE + WUA klient identifikatoru; qurumda kimlik attestation təqdimatı, Tamga kimlik xidmətində brauzer + IDV.
4. `batch_size` = 10 təxmini dəyərdir; pilot istifadə məlumatları ilə kalibrləşdirilməlidir.
5. ~~Diplom batch-i dövlət mərhələsinə təxirə salındı~~ — **BAĞLANDI (2026-10-08, §8.5):** diplom da 10 nüsxədir; status indeksinin
   tutumu hər qurum üçün ayrıca siyahı açmaqla təmin edilir (§8.4), ləğv bütün nüsxələrin indeksini işarələyir.

---

# Əlaqəli sənədlər

[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-PROTO-0002]] ·
[[SPEC-BC-0001]] · [[PM-ASSUR-0001]] · [[PM-TRUST-0001]] · [[PM-GOV-0001]] ·
[[ARCH-0003]] · [[ARCH-0005]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

