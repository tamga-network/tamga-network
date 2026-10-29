---
document_id: SPEC-API-0001
title: "Yoxlama xətti və API"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-19
summary: >
  Yoxlamanın kanonik alqoritmini və issuer/verifier servislərinin HTTP səthini müəyyən edir. Əsas töhfə ADDIM KODLARI REYESTRİdir: A1…E4, dörd spesifikasiyaya paylanmış yoxlama addımlarının vahid normativ siyahısı. Bu kodlar `failed_step` sahəsində maşınla oxunan formada ötürülür, beləliklə "yoxlama uğursuz oldu" əvəzinə "C2-də dayandı — issuer bu sxem üçün səlahiyyətli deyil" demək mümkündür. İkinci qayda: HTTP status kodu yoxlama nəticəsini KODLAŞDIRMIR — rədd edilmiş credential uğurlu API çağırışıdır; 4xx yalnız nəqliyyat/sorğu xətasıdır. Üçüncüsü: nəticə üçqiymətlidir və INDETERMINATE ayrıca səbəb sahəsi daşıyır.
translation_of: SPEC-API-0001
source_version: "1.0.0"
---

Bu spesifikasiya [[t:credential|rəqəmsal sənədin]] yoxlanarkən keçdiyi addımları vahid ardıcıllıqda toplayır və host edilən
[[t:verifier]] və [[t:issuer]] servisinin HTTP interfeysini müəyyən edir; yoxlayan tərəf və qurum tərtibatçıları üçündür.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Rəqəmsal sənədin təqdimatı](/concepts/presentation) səhifəsini, sonra [[GUIDE-0002]] bələdçisini oxuyun.
- Host edilən yoxlayan tərəf servisindən istifadə edirsinizsə §4-ə, sənədi verən servisdən istifadə edirsinizsə §5-ə keçin.
- Nəticə kodunun (A1, C2, D5 kimi) mənasını axtarırsınızsa, §1 cədvəlinə baxın.

**Qısaca**

Yoxlama beş qatda aparılır: format (rəqəmsal sənəd zədələnməyibmi və imzalanıbmı), sxem (növü tanınırmı), etibar (sənədi verən qurum
[[t:trust-list|etibar siyahısındadırmı]] və bu növü verməyə səlahiyyətlidirmi), [[t:revocation]] (sənəd ləğv edilibmi) və siyasət
(yoxlayan tərəfin tələbləri ödənilirmi). Hər addımın daimi kodu var. Nəticə üç dəyərdən biridir: etibarlı, etibarsız və ya yoxlanıla bilmədi.
Yoxlanıla bilmədi sənədin saxta olduğu mənasına gəlmir; məsələn, [[t:status-list]] həmin an aktual olmaya bilər. HTTP status kodu nəticəni
ötürmür; nəticə həmişə cavabın gövdəsindədir.

---

# Əhatə dairəsi

Bu spesifikasiya iki şeyi müəyyən edir:

1. **Kanonik yoxlama alqoritmi** — dörd spesifikasiyaya paylanmış addımların
   vahid normativ ardıcıllığı və kod reyestri.
2. **Servis API səthi** — sənədi verən və yoxlayan tərəf servislərinin HTTP interfeysi.

Protokol uc nöqtələri ([[SPEC-PROTO-0001]] OID4VCI, [[SPEC-PROTO-0002]] OID4VP)
burada təkrarlanmır; bu dokument **servisin öz** idarəetmə və inteqrasiya
səthini müəyyən edir.

---

# 1. Addım Kodları Reyestri (Normativ)

Yoxlama beş qatda aparılır. Bu cədvəl **kanonikdir**; [[ARCH-0003]] §4.1
onun xülasə görünüşüdür.

## 1.A — Format qatı → [[SPEC-CRED-0002]] §8

| Kod | Addım |
|---|---|
| `A1` | Birləşmiş sətri `~` ilə böl; KB-JWT varmı |
| `A2` | Başlıq: `alg=ES256`, `typ=dc+sd-jwt`, `x5c` varmı |
| `A3` | `x5c` zənciri + JWT imzası; kök `RootCARegistry`-də **`isChainAcceptable`** (ACTIVE və ya RETIRED); aralıq sertifikatlar CA olmalı (`basicConstraints cA=true`), `keyCertSign` daşımalı və `pathLenConstraint`-ni aşmamalıdır; `iat` 300 san-dən çox irəli tarixlidirsə RƏDD. **mdoc:** `x5chain` yarpağı ya siyahıdakı lövbərin (kök CA və ya xarici siyahıdakı xidmət sertifikatı) özüdür, ya da birbaşa onunla imzalanıb — aralıq sertifikat qəbul edilmir (ISO/IEC 18013-5 Əlavə B: sənəd imzalayanın sertifikatı birbaşa IACA tərəfindən verilir, yol uzunluğu 0; Aİ PID/EAA mdoc profilləri də bu zəncirdən istifadə edir) |
| `A3b` | **`issuerId`, `x5c` yarpaq sertifikatının barmaq izindən törədilir** — `iss` claim-indən DEYİL (§1.2) |
| `A3c` | Yarpaq sertifikat CRL/OCSP-də ləğv edilibmi ([[SPEC-ID-0002]]) |
| `A3d` | `cnf` claim-i **mövcuddurmu** — yoxdursa RƏDD (Tamga-da KB istisnasız məcburidir) |
| `A4` | `_sd_alg == "sha-256"` |
| `A5` | Hər disclosure: **əvvəl hash, sonra dekodlaşdır**; digest `_sd`-də uyğun gəlirmi |
| `A6` | KB-JWT: imza, `aud`, `nonce`, `iat`, `sd_hash` |
| `A7` | `exp` keçibmi və ya `nbf` hələ çatmayıbmı |
| `A8` | Təkrarlanan digest / açıq claim ilə toqquşma yoxdurmu |

**`Z1` — zero-knowledge proof (`mso_mdoc_zk`, [[ADR-0032]]):** dövrə imzalı siyahıdadır və fayl heşi uyğun gəlir (ZK2); açıqlanan
elementlər yalnız tələb olunanlardır, vahid ad məkanında, dövrənin atribut sayı ilə (ZK3); zaman damğası pəncərə daxilindədir;
[[t:Longfellow-ZK]] sübutu etibarlıdır. `mso_mdoc_zk` A-ardıcıllığı: A1 dekodlaşdırma · A8 docType · A2 `msoX5chain` · A3 zəncir + sertifikat sübut anında etibarlı · A3b ·
Z1. A4–A7 Z1-in əhatəsindədir.

## 1.B — Sxem qatı → [[SPEC-SCHEMA-0001]] §7

| Kod | Addım |
|---|---|
| `B1` | `vct` və `vct#integrity` oxu |
| `B2` | `schemaId = keccak256(vct)`; qeydiyyatdadırmı və `REVOKED` deyilmi |
| `B3` | Type Metadata əldə et (keş → URL → registry) |
| `B4` | Bütövlük: hash `== vct#integrity` **və** `== contentHash` (zəncir) |
| `B5` | `extends` zənciri; hər addımda `extends#integrity` |
| `B6` | JSON Schema 2020-12 uyğunluğu (`schema_uri` Tamga əlavəsidir, [[SPEC-SCHEMA-0001]] §2.1) |

## 1.C — Etibar qatı → [[SPEC-BC-0001]] §11.2

| Kod | Addım |
|---|---|
| `C1` | `isCredentialAcceptable(issuerId, iat)` — **iat = sənədin `iat` claim-i** |
| `C2` | `isCredentialSchemaAcceptable(issuerId, schemaId, iat)` — **buraxıla bilməz** |
| `C3` | `isRecognizedBy(kendi devletim, issuerId)` |
| `C4` | Sənədin `category` claim-i ↔ qeydiyyatdakı sənədi verən qurumun sinfi: PUB ↔ `urn:tamga:eaa:pub`, QUALIFIED ↔ `urn:tamga:eaa:qualified`, EAA (I1–I2) ↔ claim yoxdur; uyğunsuzluq → RƏDD ([[ADR-0010]] K5, [[SPEC-CRED-0002]]/C18) |

## 1.D — Ləğv qatı → [[SPEC-CRED-0003]] §7

| Kod | Addım |
|---|---|
| `D1` | `status.status_list` oxu (`idx`, `uri`). ZK təqdimatında (`mso_mdoc_zk`) indeks gəlmir: sübutun bağlandığı növ qısaömürlü ZK nüsxəsidirsə (`urn:tamga:id:ShortLivedIdentityAttestation:1`, növ qaydası ≤ 24 saat, ləğv siyahısı yoxdur — [[ADR-0044]] K5) D addımları tətbiq edilmir və `status.value = NOT_APPLICABLE` (əsaslandırma: qısa ömür); işarəsiz ZK təqdimatı aşağıdakı qaydaya tabedir. ZK olmayan sənəddə `status` yoxdursa: növün sxemində `uses_status_list: true` olarsa RƏDD (ləğv yoxlaması səssizcə buraxılmır — [[ADR-0056]] K13), əks halda `NOT_APPLICABLE` |
| `D2` | Status List Token-i **qabaqcadan yükləmə keşindən** götür |
| `D3` | Token imzası; `sub == uri`; `iss` eyni etibar zəncirində. İmzalayan imza yoxlamasından əvvəl qurumun etibar siyahısındakı ACTIVE ləğv açarlarına bağlanır (`expectedSignerFingerprints` — [[ADR-0056]] K6); qeydiyyatda açar yoxdursa `INDETERMINATE` |
| `D4` | Təzəlik: `exp` keçməyib, tokenin yaşı (`şimdi − iat`) siyasətin `max_status_token_age_sec` həddi daxilindədir |
| `D5` | Zəncir lövbəri: `contentHash` uyğun gəlir, `version` geri getməyib (keş lövbərdən əvvəl yüklənibsə `INDETERMINATE`/`STATUS_STALE`, sonra yüklənibsə `REJECTED`) |
| `D6` | `bits=2` ilə `idx` oxu; `0x00` xaricində → RƏDD |

## 1.E — Siyasət qatı → lokal

| Kod | Addım |
|---|---|
| `E1` | Assurance həddi (məs. `category=EDUCATION && assurance>=I2`) |
| `E2` | Tələb olunan bütün claim-lər açıqlanıbmı |
| `E3` | RP scope aşılmayıbmı ([[SPEC-PROTO-0002]] §6). RP qeydi məcburi girişdir: verilməməsi RƏDD, `null` (qeydiyyatsız RP) RƏDD; `"none"` addımı bilərəkdən buraxır və E3 `checks_skipped`-də görünür ([[ADR-0056]] K4) |
| `E4` | Audit qeydi yazıldı — yalnız audit qeydi yeri (`audit`) verilibsə və qeyd yazılıbsa `checks_performed`-də; əks halda `checks_skipped`-də ([[ADR-0056]] K11) |

**Bəli/xeyr sahəsinin oxunuşu:** `isYes(çıktı, alan)` yalnız nəticə `ACCEPTED` olduqda və açıqlanan dəyər məhz `true` olduqda `true`
qaytarır (məs. `age_over_18`, adi və ya ZK təqdimatında); rədd, yoxlanıla bilmədi, dəyərin olmaması və ya `"true"`/`1` kimi başqa dəyərlər `false`-dir
([[ADR-0056]]). Keçid kartı yalnız bu prosesin `ACCEPTED` nəticəsi əsasında verilir (`PassRegistry.issue({ verified })` — K9).

## 1.1 C1/C2 zamandan asılıdır

`C1` və `C2` qurumun **bu gün** sənəd verə bilib-bilməyəcəyini deyil, sənədin verildiyi **anda** qəbul edilə bilən
olub-olmadığını soruşur. Sənəd vermə zamanına aid suallar (`isValidIssuer`, `isAuthorizedForSchema`: "indi verə bilərmi?")
yoxlamada istifadə olunsaydı, iki səssiz xəta yaranardı:

| Ssenari | Sənəd vermə zamanı sualı ilə | Düzgün yanaşma |
|---|---|---|
| Nazirlik bağlandı (`REVOKED`, varisi var) | Bütün diplomlar `C1`-də RƏDD | Bağlanmadan əvvəl verilənlər qəbul edilir ([[ADR-0002]] #4) |
| Sxem `DEPRECATED` oldu (yeni versiya çıxdı) | Köhnə sxemlə verilmiş hər sənəd `C2`-də RƏDD | Qəbul — [[SPEC-BC-0001]]/SC3 |
| CA-nın planlı rotasiyası | `A3` + `C1` RƏDD | Qəbul — rotasiya ələ keçirilmə deyil |

Buna görə hər iki sorğu sənədin **`iat`** dəyərini götürür və "həmin an qəbul
edilə bilən idimi" deyə soruşur. Bu, yoxlamanın **retrospektiv** əməliyyat
olduğunu qəbul edir — sənəd keçmişdə verilib, bugünkü vəziyyət deyil, həmin
günkü vəziyyət həlledicidir.

## 1.2 `issuerId` sertifikatdan törədilir

`A3b` kritikdir. Yoxlayan tərəf `issuerId`-ni **`iss`
claim-indən götürərsə**, eyni kök CA altında etibarlı sertifikatı olan **istənilən**
qurum `iss` sahəsinə universitetin identifikatorunu yazıb onun adından sənəd
yarada bilər — imza öz sertifikatı ilə etibarlıdır, zəncir etibarlıdır, `iss` saxtadır.

Qayda: `issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))` — [[SPEC-ID-0002]].
`iss` claim-i yalnız **uzlaşma yoxlaması** üçün istifadə olunur: qeydiyyatdakı
sənədi verən qurumun `metadataURI`-si ilə uyğun gəlməlidir; uyğun gəlmirsə RƏDD.

## 1.3 Ardıcıllıq və qısa qapanma

Addımlar **ardıcıl** icra olunur. İlk uğursuzluqda dayanılır və həmin kod
`failed_step` kimi qaytarılır.

**İstisna:** `E4` hər halda işləyir — rədd edilmiş yoxlama da qeydə alınır (audit qeydi yeri olan yoxlayan tərəfdə; əks halda E4
buraxılmış kimi bildirilir — [[ADR-0056]] K11).

## 1.4 Kodların sabitliyi

**İnvariant AP1:** Addım kodunun mənası **heç vaxt dəyişmir.** Yeni addım
əlavə edilərsə, yeni kod alır; silinmiş addımın kodu **təkrar istifadə edilmir.**

Əsaslandırma: `failed_step` audit qeydlərində illərlə saxlanılır. `C2`-in mənası
2029-da dəyişərsə, 2027-ci il qeydləri yanlış oxunar.

---

# 2. Yoxlama Nəticəsi

## 2.1 Üçqiymətli nəticə

| `outcome` | Mənası |
|---|---|
| `ACCEPTED` | Bütün addımlar keçdi |
| `REJECTED` | Bir addım uğursuz oldu — sənəd etibarsızdır |
| `INDETERMINATE` | **Yoxlanıla bilmədi** — infrastruktur əlçatan deyil, sənəd haqqında hökm yoxdur |

**İnvariant AP2:** `INDETERMINATE` `REJECTED` ilə eyni səbətə qoyulmur. İstifadəçi
interfeysində ayrıca göstərilir. "Bu diplom saxtadır" ilə "hazırda yoxlaya bilmirəm"
arasındakı fərq bir insanın işə götürülüb-götürülməməsidir.

## 2.2 Nəticə obyekti

```json
{
  "verification_id": "vrf_01J8XKQ2M4",
  "outcome": "ACCEPTED",
  "failed_step": null,
  "indeterminate_reason": null,

  "spec_version": "SPEC-API-0001@1.0.0",
  "sdk_version": "@tamga-network/verifier@0.7.4",
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

| Sahə | Mənası |
|---|---|
| `status.reason` | İxtiyari mətn (`string \| null`): status dəyərinin səbəbi, özlüyündə aydın olmadıqda. Məs. `NOT_APPLICABLE` + ZK təqdimatı: ləğv indeksi açılmır ([[ADR-0032]] ZK4). Fərdi məlumat daşımır. |

## 2.3 `indeterminate_reason`

`outcome == INDETERMINATE` olduqda **məcburidir**:

| Dəyər | Mənbə |
|---|---|
| `SCHEMA_UNREACHABLE` | [[SPEC-SCHEMA-0001]] §7 Ş3(c) |
| `STATUS_UNREACHABLE` | [[SPEC-CRED-0003]] §7 Ş3(c) |
| `STATUS_STALE` | [[SPEC-CRED-0003]] §8.2 təzəlik həddi aşılıb; və ya D5-də yoxlayan tərəfin qabaqcadan yükləmə gecikməsi / saat tolerantlığı pəncərəsi / oxuna bilməyən lövbər vaxtı |
| `CHAIN_UNREACHABLE` | Zəncir və indeksləyici əlçatan deyil |
| `INDEXER_STALE` | [[ARCH-0003]]/CMP4 |
| `SDK_VERSION_MISMATCH` | [[ARCH-0005]] §4.2 M2; həmçinin `Z1`-də yoxlayan tərəfin ZK komponenti istifadə edilə bilmirsə (dövrə faylı yoxdur, WASM yüklənə bilmir) — təqdimatın deyil, yoxlayan tərəfin çatışmazlığı |
| `STATUS_VALUE_UNKNOWN` | `D6`: ləğv siyahısındakı dəyərin müəyyən mənası yoxdur — IETF Token Status List 0x03 və 0x0B–0x0F tətbiqə xasdır, qalanları müəyyən edilməyib; 4 və ya 8 bitlik (xarici) siyahılarda gələ bilər (2026-10-24). Sənəd ləğv edilib deyilə bilməz, etibarlı da deyilə bilməz; `status.value = UNKNOWN`. Tamga növlərinin siyahıları 1 və ya 2 bitlə yayımlanır ([[ADR-0048]], [[ADR-0063]]) |

Həmçinin aşağıdakı hallar `INDETERMINATE` verir, `REJECTED` vermir:

- **Gözlənilməz istisna** (kitabxana xətası, zədələnmiş etibar qeydi …): həmin addımda `INDETERMINATE`, səbəb isə həmin qatın dəyəridir (A →
  `CHAIN_UNREACHABLE`, B → `SCHEMA_UNREACHABLE`, C/E/T0 → `INDEXER_STALE`, D → `STATUS_UNREACHABLE`); `failed_reason`-a
  istisna mesajı daxil edilmir (AP3), yalnız addım və xəta növü. Nəticə yenə də E4 audit qeydinə düşür.
- **İşarəsiz ZK təqdimatı və `accept_unrevocable_zk: false`:** ZK təqdimatında ləğv indeksi gəlmir (ZK4). Qısa ömür işarəsini
  daşıyan təqdimat (sübutun bağladığı növün ZK nüsxəsi, [[ADR-0044]] K5) bu bayraq olmadan qəbul edilir. İşarəsiz ZK təqdimatında
  siyasət ləğv yoxlamasını tələb edirsə, nəticə `D1` / `STATUS_UNREACHABLE` olur; yalnız açıq şəkildə `true` yazılıbsa qəbul edilir:
  `status.value = NOT_APPLICABLE`, `status.reason` doludur. **Sahə verilməyibsə, `false` sayılır** (`ADR-0044/ZC4`).

## 2.4 `disclosed_claims` — yalnız adlar

**Dəyişməz AP3:** Nəticə obyekti claim **dəyərlərini** deyil, yalnız
**adlarını** daşıyır. Dəyərlər çağıran tətbiqə ayrıca kanal vasitəsilə və açıq şəkildə
sorğulandıqda verilir.

Əsaslandırma: nəticə obyekti audit qeydinə yazılır ([[ARCH-0004]] §5.2). Dəyərlər
ora sızarsa, fərdi məlumatlar log infrastrukturuna yayılır.

## 2.5 `idx` heç vaxt yer almır

**Dəyişməz AP4:** `status.status_list.idx` nəticə obyektində, audit qeydində
və ya hər hansı API cavabında **olmur** ([[ARCH-0004]] §5.3).

Əlaqələndirmə lazımdırsa, quruma xas [[t:salted-hash]] istifadə olunur:
`HMAC(kurum_tuzu, uri || idx)`.

---

# 3. HTTP status kodu nəticəni kodlaşdırmır

**Dəyişməz AP5:** Rədd edilmiş rəqəmsal sənəd **uğurlu API çağırışıdır**.

| Status | Nə vaxt |
|---|---|
| `200` | Yoxlama işlədi — `outcome` nə olursa olsun |
| `400` | Sorğunun gövdəsi zədəlidir, parametr çatışmır |
| `401` / `403` | API autentifikasiyası / səlahiyyət |
| `404` | Naməlum `verification_id` |
| `409` | Idempotency konflikti |
| `429` | Sürət limiti |
| `500` | Servis xətası |
| `503` | Asılılıq əlçatan deyil **və** nəticə yaradıla bilmədi |

Bunları qarışdırmaq geniş yayılmış səhvdir və iki problem yaradır: (1) müştərilər şəbəkə xətasını
etibarsız rəqəmsal sənəddən ayıra bilmir, (2) monitorinq sistemləri rədd edilmiş rəqəmsal sənədləri
"xəta nisbəti" kimi qəbul edir və real nasazlıqlar səs-küy içində itir.

---

# 4. Yoxlayan tərəf servisinin API-si

Baza: `https://verifier.<kurum>/api/v1`

## 4.1 Təqdimat sorğusunu başlatmaq

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

`policy_id` əvvəlcədən müəyyən edilmiş siyasətə istinad edir (§4.4). DCQL sorğusu
sorğunun gövdəsində **əl ilə yazılmır** — siyasətdən yaradılır. Beləliklə, həddindən artıq tələb
kod dəyişikliyi deyil, siyasət dəyişikliyi tələb edir.

## 4.2 Nəticəni almaq

```http
GET /presentations/prs_01J8XK
```

Təqdimat hələ gəlməyibsə `{"state": "PENDING"}`; gəlibsə §2.2-dəki nəticə
obyekti.

## 4.3 Açıqlanan dəyərləri almaq (ayrıca çağırış)

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

**Ayrıca uc nöqtəsi olmasının səbəbi** AP3-dür: dəyərlər audit qeydinə gedən nəticə
obyektindən ayrılır və bu uc nöqtəsinə giriş ayrıca avtorizasiya olunur və loglanır.

## 4.4 Siyasətin idarə edilməsi

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

Siyasət həm DCQL sorğusunu ([[SPEC-PROTO-0002]] §4), həm də `E1`–`E3` addımlarını
qidalandırır. Vahid mənbə.

**Dəyişməz AP6:** Siyasətdəki `required_claims` RP-nin zəncirdəki
`allowedScopes`-unu aşa bilməz. Servis siyasət qeydə alınarkən bunu yoxlayır və
həddi aşan siyasəti **rədd edir** — həddindən artıq tələb təqdimat anında deyil, siyasət
müəyyən edilərkən bloklanır.

---

# 5. Sənədi verən servisin API-si

Baza: `https://issuer.<kurum>/api/v1`. OID4VCI uc nöqtələri ayrıdır
([[SPEC-PROTO-0001]]); buradakılar **operator və inteqrasiya** səthidir.

## 5.1 Rəqəmsal sənəd təklifi yaratmaq (credential offer)

```http
POST /offers
Idempotency-Key: 8c21f...

{
  "credential_configuration_id": "urn:tamga:edu:DiplomaCredential:1",
  "subject_ref": "OBS-2022510041",
  "batch_size": 1
}
```

```json
{
  "offer_id": "ofr_01J8XM",
  "offer_uri": "https://issuer.tamga.network/example-university/offers/8a3f9c21",
  "tx_code": "493812",
  "expires_at": "2026-09-09T09:17:44Z"
}
```

`subject_ref` qurumun **öz** identifikatorudur (tələbə nömrəsi). Tamga bu dəyəri
heç yerə ötürmür; rəqəmsal sənədə daxil edilmir, zəncirə yazılmır.

**`tx_code` yalnız bu cavabda qaytarılır** və saxlanılmır — operator ekranında
göstərilir, sonra unudulur.

## 5.2 Rəqəmsal sənəd verilməsinin ilkin yoxlanışı

```http
POST /offers/preflight
{ "credential_configuration_id": "urn:tamga:edu:DiplomaCredential:1", "subject_ref": "OBS-2022510041" }
```

```json
{
  "ok": false,
  "blockers": [
    {
      "code": "ISCED_MAPPING_MISSING",
      "detail": "Programme 'Yapay Zekâ Mühendisliği' is not in the national ISCED-F table",
      "resolution": "add it to packages/schemas/data/tr/overrides.json"
    }
  ]
}
```

Bu uc nöqtəsi [[ARCH-0003]]/CMP5-in operatora görünən formasıdır: uyğunlaşdırmada qarşılığı
olmayan proqram üçün rəqəmsal sənəd verilməsi **dayanır**, ehtimali kod yaradılmır.

## 5.3 Ləğv və dayandırma

```http
POST /revocations
{ "credential_id": "crd_01J8XN", "action": "REVOKE", "reason_code": "DISCIPLINARY" }
```

```json
{ "queued": true, "effective_after": "2026-09-09T10:00:00Z" }
```

`effective_after` növbəti dərc dövrüdür ([[SPEC-CRED-0003]] §5.1).
**Ani ləğv yoxdur** və API bunu açıq şəkildə bildirir — çağıranın gözləntisi
əvvəldən düzgün qurulur.

`action`: `REVOKE` (daimi, `0x01`) və ya `SUSPEND` / `UNSUSPEND` (`0x02`).

## 5.4 Status siyahısının dərc vəziyyəti

```http
GET /status-lists/{list_id}
```

```json
{
  "list_id": "0x4f…",
  "list_uri": "https://status.tamga.network/7f3a9c21",
  "version": 8412,
  "published_at": "2026-09-09T09:00:00Z",
  "next_publish_at": "2026-09-09T10:00:00Z",
  "chain_version": 8412,
  "in_sync": true,
  "capacity_used_pct": 41.2
}
```

`in_sync == false` dərc xəttinin qırıldığını göstərir — bu, CDN ilə zəncir
lövbərinin ayrışdığı deməkdir ([[ARCH-0004]] §5.1 siqnalı).

---

# 6. Ümumi qaydalar

## 6.1 Xəta formatı — RFC 9457

```json
{
  "type": "https://docs.tamga.network/errors/schema-not-authorized",
  "title": "The issuer cannot issue this schema",
  "status": 403,
  "detail": "issuer 0x7f3a… is not authorised for schemaId 0x9c21…",
  "instance": "/api/v1/offers",
  "tamga_code": "SCHEMA_NOT_AUTHORIZED"
}
```

**Dəyişməz AP7:** `detail` sahəsi fərdi məlumat ehtiva etmir. "Ayşe Yılmaz üçün qeyd
yoxdur" əvəzinə `SUBJECT_NOT_FOUND` qaytarılır; təfərrüat yalnız qurumun öz audit
qeydindədir ([[SPEC-PROTO-0001]]/PR8-in servisdəki qarşılığı).

## 6.2 Təkrar çağırış təhlükəsizliyi (idempotency)

Yan təsirli hər `POST` (`/offers`, `/revocations`, `/presentations`)
`Idempotency-Key` başlığını **qəbul edir**. Eyni açarla təkrar çağırış eyni
cavabı qaytarır; fərqli gövdə ilə eyni açar `409` yaradır.

Saxlama müddəti: **24 saat**.

## 6.3 Versiyalaşdırma

Yol əsaslı: `/api/v1`. Uyğunluğu pozan dəyişiklik `/v2` açır; `/v1` ən azı **12 ay**
paralel işləyir ([[ARCH-0005]] §5.3 ilə eyni siyasət).

## 6.4 Autentifikasiya (şəxsiyyətin yoxlanılması)

| Səth | Üsul |
|---|---|
| Operator paneli → sənədi verən API | OIDC + rol əsaslı səlahiyyət |
| OBS → sənədi verən API | mTLS və ya müştəri etimadnaməsi |
| Yoxlayan tərəf tətbiqi → yoxlayan tərəf API-si | API açarı və ya mTLS |
| Giriş terminalı → yoxlayıcı `/terminal/verify` | Terminal açarı: terminal qrupuna bağlı, operatorun verdiyi daşıyıcı açar (`Authorization: Bearer`); açarsız sorğu 401 alır, token oxunmur (ADR-0065). |
| Qurum Konsolu → yoxlayıcı `/terminal/keys` (qurum adından) | Quruma məhdudlaşdırılmış token: `x-tamga-institution` + `x-institution-token` = base64url(HMAC-SHA256(inzibatçı tokeni, `tamga-terminal-keys/v1:` + qurum)); qurum yalnız imzalı siyahıda (`terminal_groups[].institution_id`) özünə bağlı qrupların açarlarını alır, görür və ləğv edir ([[ADR-0069]] TG1–TG3). |
| OID4VCI / OID4VP uc nöqtələri | Protokolun öz mexanizmi |

## 6.5 Sürət limiti

`429` + `Retry-After`. Tövsiyə: `/offers` üçün hər quruma 100/dəq,
`/presentations` üçün 1000/dəq. Tamga Verify-ın təqdimat açma (`/presentations`), rəqəmsal cüzdan cavabı (`/vp/response`) və giriş qapısında yoxlama
(`/terminal/verify`) uc nöqtələrində `429 rate_limited` + `Retry-After` qaytarılır; müştəri ünvanı saxlanılmır və loglanmır.

---

# 7. İnvariantlar

| # | Dəyişməz |
|---|---|
| **AP1** | Addım kodunun mənası heç vaxt dəyişmir; ləğv edilmiş kod yenidən istifadə olunmur. |
| **AP2** | `INDETERMINATE` `REJECTED` ilə eyni kateqoriyaya salınmır. |
| **AP3** | Nəticə obyekti claim dəyərlərini deyil, adlarını daşıyır. |
| **AP4** | `idx` heç bir API cavabında və ya qeyddə olmur. |
| **AP5** | HTTP status kodu yoxlama nəticəsini kodlaşdırmır. |
| **AP6** | Siyasətin `required_claims`-i RP-nin zəncirdəki scope-unu aşa bilməz. |
| **AP7** | Xətanın `detail` sahəsi fərdi məlumat ehtiva etmir. |
| **AP8** | `C2` (sxem səlahiyyəti) heç bir konfiqurasiya ilə yan keçilə bilməz. |
| **AP11** | `C1` və `C2` rəqəmsal sənədin `iat`-ını götürür; rəqəmsal sənədin verilmə vaxtına aid sorğular yoxlamada istifadə olunmur. |
| **AP12** | `issuerId` `x5c` yarpaq sertifikatının barmaq izindən törədilir, `iss` claim-indən deyil. |
| **AP13** | Keçid kartı tokeninin yoxlanması ([[ADR-0012]] B): imza `pass_grant`-dakı nüsxə açarı ilə, `aud` = terminalın RP client_id-si, ömür (`exp` − `iat`) ≤ 60 s, `iat` ≤ indi + 30 s, `exp` ≤ indi + 60 s + 30 s (saat sürüşməsi tolerantlığı), `jti` təkrar siyahısı (terminal qrupu daxilində onlayn paylaşılır); tokendən fərdi məlumat çıxarılmır və loglanmır. |
| **AP9** | `E4` (audit qeydi) rədd edilmiş yoxlamalarda da işləyir (audit qeydi yeri olan yoxlayan tərəfdə; host edilən yoxlayan tərəfdə həmişə). |
| **AP10** | `tx_code` cavabdan başqa heç yerdə saxlanılmır. |

---

# Təhlükəsizlik və məxfilik qeydləri

**Nəticə obyekti audit artefaktıdır.** Uzun müddət saxlanılır
([[ARCH-0004]] §5.4: 12 ay). AP3 və AP4 birlikdə bu müddətin izləmə
səthinə çevrilməsinin qarşısını alır.

**`/claims` uc nöqtəsi ayrıca avtorizasiya olunur.** Yoxlama nəticəsini görmək ilə
açıqlanan dəyərləri oxumaq fərqli səlahiyyətlərdir. İnsan resursları üzrə köməkçi "namizəd
yoxlanıldı" nəticəsini görə bilər, lakin orta balı (açıqlanıbsa) görməyə bilər.

**`checks_skipped` boş deyilsə, diqqətli olun.** Bu, köhnə SDK-nın hansısa yoxlamanı ötürdüyü deməkdir
([[ARCH-0005]] §4.1). Yoxlayan tərəf tətbiqi bunu **görünən** etməli, səssizcə
qəbul etməməlidir.

**Preflight sızma səthinə çevrilə bilər.** `/offers/preflight` `subject_ref`
ilə sorğulanır və "bu tələbə mövcuddurmu" sualına cavab verir. Bu, qurumdaxili uc nöqtəsidir;
xaricə açılmamalıdır.

---

# Açıq məsələlər

1. `E1`–`E3` siyasət addımları qurum tərəfindən fərdiləşdirilə bilər. Hansı həddə
   qədər? Tam sərbəst buraxmaq `C2`-ni dolayısı ilə yan keçməyə imkan verə bilərmi?
   AP8 bunu qadağan edir, lakin texniki məcburetmə mexanizmi hələ yazılmayıb.
2. `/claims` uc nöqtəsinin səlahiyyət modeli (rol əsaslı, yoxsa sahə əsaslı) müəyyən edilməyib.
3. Toplu yoxlama uc nöqtəsi (`POST /presentations/batch`) lazımdırmı? Universitet
   minlərlə məzunu toplu şəkildə yoxlatmaq istəyə bilər — lakin bu, şəxs əsaslı təqdimat
   modeli ilə ziddiyyət təşkil edir.
4. `subject_ref`-in sənədi verən qurumda necə saxlanılması bu sənədin əhatə dairəsindən
   kənardadır, lakin qurumun KVKK öhdəliyidir; `PM-GTM-0001` pilot müqaviləsində
   nəzərdən keçirilməlidir.
5. Addım kodu reyestrinin maşınla oxunan forması (`step-codes.json`)
   `@tamga-network/core`-da dərc edilməlidirmi? Çox güman ki, bəli → [[ARCH-0005]].

---

# Əlaqəli sənədlər

[[ARCH-0003]] · [[ARCH-0004]] · [[ARCH-0005]] · [[SPEC-CRED-0002]] ·
[[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-BC-0001]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[INVARIANTS]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

