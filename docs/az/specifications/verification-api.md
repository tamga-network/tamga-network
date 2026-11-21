---
document_id: SPEC-API-0001
title: "Yoxlama xətti və API"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-11-21
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
onun xülasə görünüşüdür. Beş qatdan əvvəl bir ilkin addım (`T0`, §1.0), yerləşdirilmiş yoxlayıcıda isə əlavə olaraq təxəllüs
addımı (`P1`, §1.F) var (2026-11-19).

## 1.0 — İlkin addım: etibar mənbəyinin təzəliyi və siyasətin forması

| Kod | Addım |
|---|---|
| `T0` | Rəqəmsal sənədə baxılmazdan əvvəl işləyir. Siyasətin təzəlik hədləri (`max_trust_age_sec`, `max_status_token_age_sec`; verilibsə `max_clock_skew_sec` ≤ 600 və `max_anchor_lag_sec`) çatışmırsa və ya etibarsızdırsa, etibar bloku (`require_recognition`, tanınma tələb olunursa iki hərfli `state_code`, `min_issuer_assurance`, `allowed_categories`) və ya aralıq məhdudiyyətləri zədəlidirsə, etibar mənbəyi sağlam deyilsə (siyahı köhnədir və ya oxunmur — [[ARCH-0003]]/CMP4) və ya yaşı siyasətin `max_trust_age_sec`-ini aşırsa, nəticə **həmişə** `INDETERMINATE`/`INDEXER_STALE`-dir; `T0` heç vaxt `REJECTED` vermir |

## 1.A — Format qatı → [[SPEC-CRED-0002]] §8

| Kod | Addım |
|---|---|
| `A1` | Birləşmiş sətri `~` ilə böl; KB-JWT varmı. A1 çağıranın konfiqurasiya xətalarını da daşıyır (2026-11-04): məs. `policyCredentialId` siyasətdəki rəqəmsal sənəd deyilsə, sənədə baxılmadan, A addımlarından əvvəl REJECTED (2026-11-19); Digital Credentials API yolunda verilən `aud` səhifə mənşəyindən törədiləndən fərqlənir və ya `origin` ilə `aud` = `client_id` birlikdə verilib — aydın mesajla REJECTED |
| `A2` | Başlıq: `alg=ES256`, `typ=dc+sd-jwt`, `x5c` varmı |
| `A3` | `x5c` zənciri + JWT imzası: yarpaq verilən etibar lövbərlərindən birinə bağlanır (Tamga kök CA-sı və ya təzəliyi keçməmiş xarici siyahının lövbəri). Aralıq sertifikatlar CA olmalı (`basicConstraints cA=true`), **KeyUsage genişlənməsini daşımalı və içində `keyCertSign` olmalı** (genişlənməsi olmayan aralıq sertifikat RƏDD) və `pathLenConstraint`-i aşmamalıdır; `iat` 300 saniyədən çox irəli tarixlidirsə RƏDD. Kök CA-nın statusu bu addımda deyil, **`C1`**-də yoxlanılır: qurumun bağlı olduğu kök sənədin `iat` anında `ACTIVE` və ya `ROLLING_OVER` olmalı və heç vaxt `REVOKED` olmamalıdır ([[SPEC-ID-0002]] §3; sonradan istifadədən çıxarılan kök əvvəl verilmiş sənədi etibarsız etmir; ləğv edilmiş kökün sənədi `C1` kodu ilə rədd edilir). Tək sertifikatlı `x5c`-də yarpağın özü lövbər ola bilər (xarici siyahıdakı xidmət sertifikatı, [[ADR-0036]]); `issuerId` yenə yarpaqdan törədilir və `C1` onu siyahıda axtarır. Çağıran zəncir yoxlamasını bilərəkdən söndürübsə (`rootCertsDer: "none"`, yalnız SD-JWT VC) A3 `checks_performed`-də deyil, `checks_skipped`-də görünür. **mdoc:** `x5chain` yarpağı ya siyahıdakı lövbərin (kök CA və ya xarici siyahıdakı xidmət sertifikatı) özüdür, ya da birbaşa onunla imzalanıb — aralıq sertifikat qəbul edilmir (ISO/IEC 18013-5 Əlavə B: sənəd imzalayanın sertifikatı birbaşa IACA tərəfindən verilir, yol uzunluğu 0; Aİ PID/EAA mdoc profilləri də bu zəncirdən istifadə edir) **mdoc `validityInfo.signed`** (imza anı; C1/C2 bu ana görə soruşulur, SD-JWT `iat`-ın qarşılığı) saat tolerantlığından irəlidədirsə RƏDD EDİLİR; `validFrom` də irəlidədirsə sənəd hələ etibarlı deyil və nəticə `A7`-dir (2026-11-19). |
| `A3b` | **`issuerId`, `x5c` yarpaq sertifikatının barmaq izindən törədilir** — `iss` claim-indən DEYİL (§1.2). `iss` uyğunluq yoxlaması etibar qeydini tələb etdiyi üçün B addımlarından sonra, `C1`-dən əvvəl işləyir və bu kodla bildirilir |
| `A3c` | Yarpaq sertifikat CRL/OCSP-də ləğv edilibmi ([[SPEC-ID-0002]]) |
| `A3d` | `cnf` claim-i **mövcuddurmu** — yoxdursa RƏDD (Tamga-da KB istisnasız məcburidir) |
| `A4` | `_sd_alg == "sha-256"` |
| `A5` | Hər disclosure: **əvvəl hash, sonra dekodlaşdır**; digest `_sd`-də uyğun gəlirmi |
| `A6` | KB-JWT: imza, `aud`, `nonce`, `iat`, `sd_hash` |
| `A7` | `exp` keçibmi və ya `nbf` hələ çatmayıbmı mdoc: `validFrom` < `signed` olarsa RƏDD EDİLİR (ISO/IEC 18013-5 `validFrom` ≥ `signed`; 2026-11-19). |
| `A8` | Təkrarlanan digest / açıq claim ilə toqquşma yoxdurmu |

**`Z1` — zero-knowledge proof (`mso_mdoc_zk`, [[ADR-0032]]):** dövrə imzalı siyahıdadır və fayl heşi uyğun gəlir (ZK2); açıqlanan
elementlər yalnız tələb olunanlardır, vahid ad məkanında, dövrənin atribut sayı ilə (ZK3); zaman damğası pəncərə daxilindədir;
[[t:Longfellow-ZK]] sübutu etibarlıdır. `mso_mdoc_zk` A-ardıcıllığı: A1 dekodlaşdırma · A8 docType · A2 `msoX5chain` · A3 zəncir + sertifikat sübut anında etibarlı · A3b ·
Z1. A4–A7 Z1-in əhatəsindədir.

## 1.B — Sxem qatı → [[SPEC-SCHEMA-0001]] §7

| Kod | Addım |
|---|---|
| `B1` | `vct` və `vct#integrity` oxu |
| `B2` | `schemaId = keccak256(vct)`; qeydiyyatdadırmı və `REVOKED` deyilmi. Növ Tamga kataloqunda yoxdursa, yalnız sənədin zənciri bu növə zəmanət verən xarici siyahıya bağlıdırsa qəbul edilir ([[ADR-0036]] FD2); növə zəmanət verə biləcək xarici siyahı həmin an istifadə edilə bilmirsə (yüklənməyib və ya müddəti bitib) və ya bağlanan xarici siyahı köhnədirsə, nəticə RED deyil, `INDETERMINATE`/`INDEXER_STALE`-dir (FD3; 2026-11-19) |
| `B3` | Type Metadata əldə et. İstinad tətbiqində növ tərifləri paketə daxil edilib (`@tamga-network/schemas`, kataloqla eyni məzmun): yoxlama zamanı URL-dən və ya reyestrdən heç nə çəkilmir; tərif paketdə yoxdursa `INDETERMINATE`/`SCHEMA_UNREACHABLE`. Bütövlük bağı yenə `B4`-dədir (2026-11-19) |
| `B4` | Bütövlük: hash `== vct#integrity` **və** `== contentHash` (zəncir) |
| `B5` | `extends` zənciri; hər addımda `extends#integrity` |
| `B6` | JSON Schema 2020-12 uyğunluğu (`schema_uri` Tamga əlavəsidir, [[SPEC-SCHEMA-0001]] §2.1) |

## 1.C — Etibar qatı → [[SPEC-TRUST-0001]] §6 (`TrustSource`; imzalı etibar siyahıları)

| Kod | Addım |
|---|---|
| `C1` | `isCredentialAcceptable(issuerId, iat)` — **iat = sənədin `iat` claim-i** |
| `C2` | `isCredentialSchemaAcceptable(issuerId, schemaId, iat)` — **buraxıla bilməz** |
| `C3` | `isRecognizedBy(kendi devletim, issuerId)` |
| `C4` | Sənədin `category` claim-i ↔ qeydiyyatdakı sənədi verən qurumun sinfi: PUB ↔ `urn:tamga:eaa:pub`, QUALIFIED ↔ `urn:tamga:eaa:qualified`, EAA (I1–I2) ↔ claim yoxdur; uyğunsuzluq → RƏDD ([[ADR-0010]] K5, [[SPEC-CRED-0002]]/C18). mdoc və ZK təqdimatında `category` sahəsi yoxdur: bu formatlarda C4 tətbiq edilmir və `checks_skipped`-də görünür; xarici siyahıdakı qurumda da tətbiq edilmir ([[ADR-0036]]). Qurumun sinfi hər formatda nəticə obyektində `issuer.class` kimi etibar siyahısındakı qeyddən qayıdır ([[ADR-0010]] tətbiq qeydi, 2026-11-12) |

## 1.D — Ləğv qatı → [[SPEC-CRED-0003]] §7

| Kod | Addım |
|---|---|
| `D1` | `status.status_list` oxu (`idx`, `uri`). ZK təqdimatında (`mso_mdoc_zk`) indeks gəlmir: sübutun bağlandığı növ qısaömürlü ZK nüsxəsidirsə (`urn:tamga:id:ShortLivedIdentityAttestation:1`, növ qaydası ≤ 24 saat, ləğv siyahısı yoxdur — [[ADR-0044]] K5) D addımları tətbiq edilmir və `status.value = NOT_APPLICABLE` (əsaslandırma: qısa ömür); işarəsiz ZK təqdimatı aşağıdakı qaydaya tabedir. ZK olmayan sənəddə `status` yoxdursa: növün sxemində `uses_status_list: true` olarsa RƏDD (ləğv yoxlaması səssizcə buraxılmır — [[ADR-0056]] K13), əks halda `NOT_APPLICABLE` Oxuna bilməyən `status` girişi (obyekt deyil; `status_list` yoxdur və ya obyekt deyil; `idx` mənfi olmayan tam ədəd deyil; `uri` boşdur) ləğv yoxlamasından yan keçmir: SD-JWT VC və mdoc-da `REJECTED`, `status entry malformed` (2026-11-19). |
| `D2` | Status List Token-i **qabaqcadan yükləmə keşindən** götür |
| `D3` | Token imzası; `sub == uri`; `iss` eyni etibar zəncirində. İmzalayan imza yoxlamasından əvvəl qurumun etibar siyahısındakı ACTIVE ləğv açarlarına bağlanır (`expectedSignerFingerprints` — [[ADR-0056]] K6); qeydiyyatda açar yoxdursa `INDETERMINATE`. Ləğv açarı yalnız etibarlılıq pəncərəsindədirsə (`valid_from`…`valid_to`, verilibsə) imzalayan sayılır. İmzalayan **qeydiyyatlı**, lakin pəncərəsindən kənar (və ya `RETIRED`) ləğv açarıdırsa — açar yenilənib, keşdə köhnə siyahı qalıb — nəticə RƏDD deyil, `INDETERMINATE`/`STATUS_STALE`-dir; qeydiyyatda olmayan (və ya `REVOKED` / `SUSPENDED`) imzalayan `REJECTED` qalır. Keşdəki gövdə token kimi oxuna bilmirsə (məs. serverin xəta səhifəsi) nəticə RƏDD deyil, `INDETERMINATE`/`STATUS_UNREACHABLE`-dır |
| `D4` | Təzəlik: `exp` keçməyib, tokenin yaşı (`şimdi − iat`) siyasətin `max_status_token_age_sec` həddi daxilindədir Sıxılmış siyahının açılmış ölçüsü `bits` ilə hesablanan yuxarı həddi aşarsa siyahı oxuna bilmir: `INDETERMINATE` (`D4`); D3-dəki `iat` saat tolerantlığı siyasətin `max_clock_skew_sec`-idir (2026-11-19). |
| `D5` | Lövbər: tokenin heşi (`contentHash`) siyahının lövbər jurnalındakı son sətri ilə uyğun gəlirmi. Token versiya sahəsi daşımır; geri qaytarma zamana görə aşkarlanır. Uyğun gəlməyən token lövbərdən **köhnədirsə**: keş lövbərdən əvvəl (və ya saat tolerantlığı daxilində) yüklənibsə `INDETERMINATE`/`STATUS_STALE`, açıq şəkildə sonra yüklənibsə `REJECTED`. Uyğun gəlməyən token lövbərdən **yenidirsə**, bu, adi dərc ardıcıllığıdır (əvvəl CDN, sonra lövbər — [[SPEC-CRED-0003]] §5.2) və D5 `checks_skipped`-də görünür; pay məhduddur: token məlum son lövbərdən `max_anchor_lag_sec` (+ saat tolerantlığı) qədərdən daha yenidirsə, lövbəri gecikib → `INDETERMINATE`/`STATUS_STALE`. Siyahı lövbər jurnalında heç yoxdursa, eyni pay sənədin `iat`-ından sayılır: yeni verilmiş sənəddə D5 buraxılır, pay dolubsa `INDETERMINATE`/`STATUS_STALE`. Xarici siyahıdakı qurumun ləğv siyahısı üçün lövbər jurnalı yoxdur, D5 buraxılır ([[ADR-0036]]). `max_anchor_lag_sec` siyasətin təzəlik sahəsidir (§4.4): standart 3600 san (lövbər jurnalının saatlıq ritmi); Tamga Verify 600 san istifadə edir |
| `D6` | `bits=2` ilə `idx` oxu; `0x00` xaricində → RƏDD |

## 1.E — Siyasət qatı → lokal

| Kod | Addım |
|---|---|
| `E1` | Assurance həddi (məs. `category=EDUCATION && assurance>=I2`) |
| `E2` | Tələb olunan bütün claim-lər açıqlanıbmı |
| `E3` | RP scope aşılmayıbmı ([[SPEC-PROTO-0002]] §6). RP qeydi məcburi girişdir: verilməməsi RƏDD, `null` (qeydiyyatsız RP) RƏDD; `"none"` addımı bilərəkdən buraxır və E3 `checks_skipped`-də görünür ([[ADR-0056]] K4). Əhatə yoxlamasına seçici açıqlanan bütün sahələr və qurumun açıq saxladığı sahələrdən siyasətin istədikləri daxildir; hər ikisi `disclosed_claims`-də görünür |
| `E4` | Audit qeydi yazıldı — yalnız audit qeydi yeri (`audit`) verilibsə və qeyd yazılıbsa `checks_performed`-də; əks halda `checks_skipped`-də ([[ADR-0056]] K11). Audit yazıcısı xəta verərsə, yoxlama nəticəsi yenə qaytarılır və E4 `checks_skipped`-də görünür |

## 1.F — Təxəllüs → [[ADR-0031]] (yalnız yerləşdirilmiş yoxlayıcı)

| Kod | Addım |
|---|---|
| `P1` | Sayt üzrə təxəllüs təqdimatı (ayrıca `vp_token` girişi) yoxlanılır: imza, hədəf (`aud`), `nonce` və cüzdan vahidi bağı. `P1`-i paket (`verifyPresentation`) deyil, yerləşdirilmiş yoxlayıcı (Tamga Verify) bildirir. Yalnız təxəllüs tələb edən siyasətdə təxəllüs təqdimatın yeganə sahiblik sübutudur və təqdimat istehlak edilməzdən əvvəl yoxlanılır: keçməyən təxəllüs cəhddir (`400`, təqdimat açıq qalır), keçən təxəllüsün nəticəsi `checks_performed: ["P1", "E4"]`-dür. Sənəd + təxəllüs siyasətində sənəd qəbul edildikdən sonra təxəllüs keçməzsə, nəticə `failed_step: "P1"` ilə `REJECTED` (və ya `INDETERMINATE`) olur. `P1` addım siyahısından kənardadır: təxəllüs tələb etməyən siyasətdə `checks_skipped`-də görünmür (2026-11-19) |

**Bəli/xeyr sahəsinin oxunuşu:** `isYes(çıktı, alan)` yalnız nəticə `ACCEPTED` olduqda və açıqlanan dəyər məhz `true` olduqda `true`
qaytarır (məs. `age_over_18`, adi və ya ZK təqdimatında); rədd, yoxlanıla bilmədi, dəyərin olmaması və ya `"true"`/`1` kimi başqa dəyərlər `false`-dir
([[ADR-0056]]). Keçid kartı yalnız bu prosesin `ACCEPTED` nəticəsi əsasında verilir (`PassRegistry.issue({ verified })` — K9).

Keçid kartı tokeninin `jti`-si ən çox 128 simvolluq sətirdir; sətir olmayan və ya daha uzun `jti` rədd edilir (AP13 təkrar siyahısı).

## 1.1 C1/C2 zamandan asılıdır

`C1` və `C2` qurumun **bu gün** sənəd verə bilib-bilməyəcəyini deyil, sənədin verildiyi **anda** qəbul edilə bilən
olub-olmadığını soruşur. Sənəd vermə zamanına aid suallar (`isValidIssuer`, `isAuthorizedForSchema`: "indi verə bilərmi?")
yoxlamada istifadə olunsaydı, iki səssiz xəta yaranardı:

| Ssenari | Sənəd vermə zamanı sualı ilə | Düzgün yanaşma |
|---|---|---|
| Nazirlik bağlandı (`REVOKED`, varisi var) | Bütün diplomlar `C1`-də RƏDD | Bağlanmadan əvvəl verilənlər qəbul edilir ([[ADR-0002]] #4) |
| Qurum dayandırıldı (`SUSPENDED`), sonra yenidən aktiv oldu | Dayandırma müddətində bütün sənədlər `C1`-də RƏDD, sonra qəbul | Dayandırma müddətində RƏDD ("issuer suspended"); qaldırılanda əvvəl verilənlər qəbul, dayandırmada verilənlər RƏDD ([[ADR-0088]]) |
| Sxem `DEPRECATED` oldu (yeni versiya çıxdı) | Köhnə sxemlə verilmiş hər sənəd `C2`-də RƏDD | Qəbul — sxem qeydinin statusu, [[SPEC-TRUST-0001]] |
| CA-nın planlı rotasiyası | `A3` + `C1` RƏDD | Qəbul — rotasiya ələ keçirilmə deyil |

Buna görə hər iki sorğu sənədin **`iat`** dəyərini götürür və "həmin an qəbul
edilə bilən idimi" deyə soruşur. Bu, yoxlamanın **retrospektiv** əməliyyat
olduğunu qəbul edir — sənəd keçmişdə verilib, bugünkü vəziyyət deyil, həmin
günkü vəziyyət həlledicidir.

**Dayandırma (istisna, [[ADR-0088]]).** `C1` bir halda bugünə də baxır: qurum yoxlama anında etibar siyahısında `SUSPENDED`-dirsə
sənəd verilmə anından asılı olmayaraq rədd edilir (`failed_reason: "issuer suspended"`; SI1). Dayandırma müvəqqətidir və
sənədləri ləğv etmir: qurum yenidən aktiv olanda dayandırmadan əvvəl verilmiş sənədlər yenidən qəbul edilir (SI2). Ləğv, təqaüd və
qeydiyyat müddətinin bitməsi verilmə anı qaydası ilə qiymətləndirilir (SI3). Bu, Aİ çərçivəsinin (ARF 3.0 §4.6.5) qaydasıdır.

**ZK təqdimatı (`mso_mdoc_zk`).** Sıfır bilgi sübutunda sənədin imzalanma anı açıqlanmır. Bu yolda `C1` və `C2` sübutun vaxt damğası ilə (təqdimat anı; yoxlayan tərəfin saatına saat tolerantlığı daxilində yaxın olmalıdır) soruşulur: qurum və növ səlahiyyəti təqdimat anında etibarlı olmalıdır. Qısa ömürlü ZK nüsxəsi ən çox 24 saat əvvəl verildiyi üçün ([[ADR-0044]]) iki an arasındakı fərq ən çox bir gündür. Bu, AP11-in ZK təqdimatı üçün açıq istisnasıdır ([[ADR-0032]] tətbiq qeydi, 2026-11-12). İki nəticəsi var: qurum sənədi verdikdən sonra bağlanıbsa, ZK təqdimatı rədd edilir; qurum sənədin verildiyi anda qəbul edilə bilən deyildisə, amma təqdimat anında qəbul edilə biləndirsə, təqdimat bu addımlardan keçir. İşarəsiz ZK təqdimatında (yalnız `accept_unrevocable_zk: true` ilə qəbul edilir) bir günlük hədd yoxdur.

## 1.2 `issuerId` sertifikatdan törədilir

`A3b` kritikdir. Yoxlayan tərəf `issuerId`-ni **`iss`
claim-indən götürərsə**, eyni kök CA altında etibarlı sertifikatı olan **istənilən**
qurum `iss` sahəsinə universitetin identifikatorunu yazıb onun adından sənəd
yarada bilər — imza öz sertifikatı ilə etibarlıdır, zəncir etibarlıdır, `iss` saxtadır.

Qayda: `issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))` — [[SPEC-ID-0002]].
`iss` claim-i yalnız **uzlaşma yoxlaması** üçün istifadə olunur: qeydiyyatdakı
sənədi verən qurumun `metadataURI`-si ilə uyğun gəlməlidir; uyğun gəlmirsə RƏDD.

**Hansı ölkənin `stateCode`-u (tətbiq qeydi, 2026-11-21, [[ADR-0093]]).** `stateCode` qurumun qeydiyyatda olduğu ölkə
siyahısının kodudur, siyasətin ölkəsi deyil. Yoxlayıcı yüklənmiş hər ölkə siyahısı üçün identifikatoru hesablayır və həmin siyahıda
axtarır: tək uyğunluq identifikatordur; bir neçə uyğunluq `A3b` ilə RƏDD-dir; heç bir uyğunluq yoxdursa və yüklənə bilməyən
(çatışmayan, köhnəlmiş, yoxlanıla bilməyən) ölkə siyahısı varsa nəticə `C1`-də INDETERMINATE-dir, yoxdursa qurum siyahılarda
deyil (`C1` RƏDD). Zəncir addımında (`A3`) da eyni prinsip keçərlidir: zəncir yüklənmiş köklərin heç birinə bağlanmırsa və
yüklənə bilməyən ölkə siyahısı varsa nəticə INDETERMINATE-dir. Bir ölkə siyahısı başqa siyahının qurum, kök, etibar edən tərəf və
ya sxem qeydinin yerini tuta bilməz; belə siyahı yüklənmir.

**`iss` məcburidir (SD-JWT VC).** Tamga kataloqundakı növlərdə `iss` yoxdursa və ya boşdursa, nəticə `A3b` ilə RƏDD-dir; dəyər qurumun etibar siyahısındakı qeydinin `issuer_url` sahəsi ilə tam eyni olmalıdır. mdoc və ZK təqdimatında `iss` sahəsi yoxdur; bağ yalnız sertifikatdan qurulur. Xarici siyahıdakı qurumda ([[ADR-0036]]) qeyddə ünvan olmadığı üçün bu yoxlama tətbiq edilmir.

**Yerli inkişaf bayrağı (`allowLocalIssuerUrls`).** Standart olaraq söndürülüb. Açıq olanda `iss` yerli ünvandırsa — `http://localhost` və ya 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 aralığında IPv4 ünvanı — qeyddəki ünvanla bərabərlik axtarılmır; eyni yumşaltma ləğv tokeninin `iss`-i üçün də keçərlidir. Ümumi IP ünvanı yerli sayılmır. Tamga Verify bu bayrağı yalnız dərc ünvanı `https` olmayanda açır; canlı yoxlayıcıda söndürülüb.

## 1.3 Ardıcıllıq və qısa qapanma

Addımlar **ardıcıl** icra olunur. İlk uğursuzluqda dayanılır və həmin kod
`failed_step` kimi qaytarılır.

**İstisna:** `E4` hər halda işləyir — rədd edilmiş yoxlama da qeydə alınır (audit qeydi yeri olan yoxlayan tərəfdə; əks halda E4
buraxılmış kimi bildirilir — [[ADR-0056]] K11).

**Kodların bildirilməsi (tətbiq qeydi, 2026-11-11).** İstinad tətbiqi bəzi addımları qonşu kodla bildirir: `cnf` çatışmazlığı (`A3d`) `A3`, təkrarlanan heş və toqquşma (`A8`) SD-JWT VC-də `A5` kimi qayıdır; mdoc və ZK-də `A8` sənəd növünün (docType) siyasətdə olmamasıdır. `A2` (Tamga növündə köhnə `typ`) və `A4` (Tamga növündə `_sd_alg` yoxdur) növün kataloqda olub-olmadığı bilinəndə, yəni `B2`-dən sonra; `A3b` (`iss` uyğunluğu) etibar qeydi oxunanda, yəni `B6`-dan sonra yoxlanılır — birdən çox qüsuru olan sənəddə qayıdan kod sıradakı ilk kod olmaya bilər. Gözlənilməz istisnada `failed_step` həmin qatın ilk kodudur (`T0`, `A1`, `B1`, `C1`, `D1`, `E1`). mdoc-un A-ardıcıllığı: A1 · A8 · A2 · A3 · A3b · A4, A7, A5 · A3d · A6. SD-JWT VC-nin A-sırası: A1 · A2 · A3 (`cnf` çatışmazlığı daxil) · A4 · A5 (təkrarlanan heş daxil) · A6 · A7; `policyCredentialId` yoxlaması (A1) bunlardan əvvəl aparılır (2026-11-19). Zəncir verilən köklərin heç birinə bağlanmırsa (`A3`) və ya növ kataloqda yoxdursa və lövbər xarici quruma həll edilmirsə (`B2`), RED verməzdən əvvəl tələb olunan növə zəmanət verə biləcək xarici siyahının həmin an istifadə edilə bilib-bilmədiyinə baxılır: istifadə edilə bilmirsə nəticə `INDETERMINATE`-dir (§2.3). Yoxlamaların özü tam aparılır: uğurlu yoxlamada `A3d` və `A8` `checks_performed`-də görünür; uğursuzluğun dəqiq səbəbi `failed_reason` sahəsindədir. Bu bildirmə layihə rəhbərliyinin təsdiqi ilə (2026-11-12) istinad tətbiqinin məcburi davranışıdır; kodların qeydlərdəki oxunuşu dəyişməsin deyə (AP1) dəyişdirilmir ([[ADR-0056]] tətbiq qeydi).

## 1.4 Kodların sabitliyi

**İnvariant AP1:** Addım kodunun mənası **heç vaxt dəyişmir.** Yeni addım
əlavə edilərsə, yeni kod alır; silinmiş addımın kodu **təkrar istifadə edilmir.**

Əsaslandırma: `failed_step` audit qeydlərində illərlə saxlanılır. `C2`-in mənası
2029-da dəyişərsə, 2027-ci il qeydləri yanlış oxunar.

---

## 1.5 Bir neçə sənədli təqdimat

Cavabdakı hər təqdimat eyni `nonce` və `aud` ilə ayrıca yoxlanılır; bu, başqa sessiyadan sənədlərin qarışdırılmasının qarşısını
alır. Sənədlərin **eyni şəxsə və ya eyni cüzdan vahidinə** aid olması isə bugünkü standart vasitələrlə sübut edilə bilmir: iki
şəxs vasitəçi ilə sessiyanı paylaşıb hər biri öz sənədinin sahiblik sübutunu imzalasa, yoxlayıcı iki sənədi bir şəxsdən gəlmiş
kimi görür (Aİ ARF müzakirəsi "credential pooling"; mövzu Aİ-də açıqdır). Buna görə yerləşdirilmiş yoxlayıcı (Tamga Verify)
təqdimat başına **bir sənəd** yoxlayır (ixtiyari təxəllüs yalnız sayta xas identifikatordur); siyasətdə ikinci sənəd varsa
təqdimat qapalı qalır. Bir neçə sənədi öz serverində birləşdirən etibar edən tərəf bu həddi bilməlidir.

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
  "verification_id": "vrf_tl1f9cq8k2m7x4p0a3d5",
  "outcome": "ACCEPTED",
  "failed_step": null,
  "failed_reason": null,
  "indeterminate_reason": null,

  "spec_version": "SPEC-API-0001@1.0.0",
  "sdk_version": "@tamga-network/verifier@0.8.9",
  "checks_performed": ["T0",
                       "A1","A2","A3","A3b","A3d","A4","A5","A6","A7","A8",
                       "B1","B2","B3","B4","B6",
                       "C1","C2","C3","C4",
                       "D1","D2","D3","D4","D5","D6",
                       "E1","E2","E3","E4"],
  "checks_skipped": ["A3c","B5","Z1"],

  "issuer": {
    "issuer_id": "0x7f3a…",
    "state_code": "TR",
    "category": "EDUCATION",
    "assurance": "I2",
    "class": "EAA",
    "legal_name": "Nümunə Universiteti"
  },
  "schema": {
    "schema_id": "0x9c21…",
    "vct": "urn:tamga:edu:DiplomaCredential:1",
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
    "trust_source": "list",
    "trust_version": 412,
    "trust_age_sec": 95
  },
  "evaluated_at": "2026-11-19T09:12:44.000Z"
}
```

**`issuer.state_code` (tətbiq qeydi, 2026-11-21).** Qurumun qeydiyyatda olduğu ölkə siyahısının kodudur ([[ADR-0093]] UL1), siyasətin ölkəsi deyil; tanınma (`C3`) siyasətin ölkəsinin bu ölkəni tanıyıb-tanımadığını soruşur. Xarici qurumda (xarici etibar siyahısı, [[ADR-0036]]) xarici siyahının `territory`-sidir (`EU` ola bilər; [[ADR-0094]] K7).

**Nümunədəki `checks_skipped` (tətbiq qeydi, 2026-11-12).** Nümunə, istinad tətbiqinin (`@tamga-network/verifier`) audit qeydi yeri verilmiş SD-JWT VC təqdimatında qaytardığı nəticədir. İstinad tətbiqi bu gün iki addımı aparmır və hər təqdimatda `checks_skipped`-də bildirir: `A3c` (yarpaq sertifikatın CRL/OCSP sorğusu) və `B5` (`extends` zənciri). Təqdimatın formatında olmayan addımlar da `checks_skipped`-ə düşür: ZK olmayan hər təqdimatda `Z1` (2026-11-19); `P1` addım siyahısından kənardadır və heç vaxt `checks_skipped`-də görünmür (§1.F). Nəticə obyektində `failed_reason` həmişə var (qəbulda `null`); `freshness` etibar mənbəyinin növünü, versiyasını və yaşını daşıyır (`trust_source`, `trust_version`, `trust_age_sec`); `schema`-da versiya sahəsi yoxdur; `issuer.legal_name` etibar siyahısındakı qeyddən gəlir. Sahələrin sırası məna daşımır. `E4` audit qeydi yazıldığı üçün `checks_performed`-dədir; audit qeydi yeri verilməyibsə, o da `checks_skipped`-də görünür (§1.E, `E4`).

| Sahə | Mənası |
|---|---|
| `status.reason` | İxtiyari mətn (`string \| null`): status dəyərinin səbəbi, özlüyündə aydın olmadıqda. Məs. `NOT_APPLICABLE` + ZK təqdimatı: ləğv indeksi açılmır ([[ADR-0032]] ZK4). Fərdi məlumat daşımır. |

## 2.3 `indeterminate_reason`

`outcome == INDETERMINATE` olduqda **məcburidir**:

| Dəyər | Mənbə |
|---|---|
| `SCHEMA_UNREACHABLE` | [[SPEC-SCHEMA-0001]] §7 Ş3(c) |
| `STATUS_UNREACHABLE` | [[SPEC-CRED-0003]] §7 Ş3(c) |
| `STATUS_STALE` | [[SPEC-CRED-0003]] §8.2 təzəlik həddi aşılıb; və ya D5-də yoxlayan tərəfin qabaqcadan yükləmə gecikməsi / saat tolerantlığı pəncərəsi / oxuna bilməyən lövbər vaxtı / lövbər gecikmə pəncərəsinin aşılması (token son lövbərdən `max_anchor_lag_sec`-dən daha yenidir və ya siyahı heç lövbərlənməyib); və ya D3-də siyahı qurumun qeydiyyatlı, lakin etibarlılıq pəncərəsindən kənar ləğv açarı ilə imzalanıb |
| `CHAIN_UNREACHABLE` | Zəncir və indeksləyici əlçatan deyil |
| `INDEXER_STALE` | [[ARCH-0003]]/CMP4 |
| `SDK_VERSION_MISMATCH` | [[ARCH-0005]] §4.2 M2; həmçinin `Z1`-də yoxlayan tərəfin ZK komponenti istifadə edilə bilmirsə (dövrə faylı yoxdur, WASM yüklənə bilmir) — təqdimatın deyil, yoxlayan tərəfin çatışmazlığı |
| `STATUS_VALUE_UNKNOWN` | `D6`: ləğv siyahısındakı dəyərin müəyyən mənası yoxdur — IETF Token Status List 0x03 və 0x0B–0x0F tətbiqə xasdır, qalanları müəyyən edilməyib; 4 və ya 8 bitlik (xarici) siyahılarda gələ bilər (2026-10-24). Sənəd ləğv edilib deyilə bilməz, etibarlı da deyilə bilməz; `status.value = UNKNOWN`. Tamga növlərinin siyahıları 1 və ya 2 bitlə yayımlanır ([[ADR-0048]], [[ADR-0063]]) |

Həmçinin aşağıdakı hallar `INDETERMINATE` verir, `REJECTED` vermir:

- **Gözlənilməz istisna** (kitabxana xətası, zədələnmiş etibar qeydi …): həmin addımda `INDETERMINATE`, səbəb isə həmin qatın dəyəridir (A →
  `CHAIN_UNREACHABLE`, B → `SCHEMA_UNREACHABLE`, C/E/T0 → `INDEXER_STALE`, D → `STATUS_UNREACHABLE`); `failed_reason`-a
  istisna mesajı daxil edilmir (AP3), yalnız addım və xəta növü. Nəticə yenə də E4 audit qeydinə düşür. Yerləşdirilən
  yoxlayıcıda təqdimat istifadə edildikdən **sonra** yaranan daxili xəta da bu qaydaya düşür: xəta xəttin sonundakı (E) qatda
  və ya ondan sonradır; səbəb `INDEXER_STALE`, `failed_step` `null`, `failed_reason` isə "internal error after verification (…)"
  olur. Qapalı çoxluqda ayrıca "daxili xəta" dəyəri yoxdur; bu hal köhnəlmiş siyahıdan `failed_step`-in boş olması ilə seçilir.
- **İşarəsiz ZK təqdimatı və `accept_unrevocable_zk: false`:** ZK təqdimatında ləğv indeksi gəlmir (ZK4). Qısa ömür işarəsini
  daşıyan təqdimat (sübutun bağladığı növün ZK nüsxəsi, [[ADR-0044]] K5) bu bayraq olmadan qəbul edilir. İşarəsiz ZK təqdimatında
  siyasət ləğv yoxlamasını tələb edirsə, nəticə `D1` / `STATUS_UNREACHABLE` olur; yalnız açıq şəkildə `true` yazılıbsa qəbul edilir:
  `status.value = NOT_APPLICABLE`, `status.reason` doludur. **Sahə verilməyibsə, `false` sayılır** (`ADR-0044/ZC4`).

- **Rədd səbəbi sabit mesajdır (2026-11-11):** `failed_reason` sənəddəki dəyəri (məs. `category`, `typ`, `_sd_alg`), cüzdanın göndərdiyi sərbəst mətni və ya kitabxana istisnasının mesajını daşımır; sahə **adını** daşıya bilər. Sənədlə gələn sertifikat və ya imza oxuna bilmirsə nəticə RƏDD-dir; sertifikatlar oxunduqdan sonrakı gözlənilməz xəta (çağıranın verdiyi lövbər zədəlidir, kitabxana xətası) `INDETERMINATE`-dir.
- **İstifadə edilə bilməyən xarici siyahı ([[ADR-0036]] FD3):** zəncir verilən köklərin heç birinə bağlanmırsa (`A3`) və ya növ kataloqda yoxdursa və lövbər xarici quruma həll olunmursa (`B2`), istənən növə zamin ola biləcək xarici siyahı həmin an istifadə edilə bilmirsə (yüklənməyib və ya müddəti keçib), nəticə RƏDD deyil, `INDETERMINATE`/`INDEXER_STALE`-dir. Növ `A3`-də siyasətdən oxunur (imzası yoxlanmamış sənəddən deyil).
- **İstifadə edilə bilməyən ölkə siyahısı ([[ADR-0093]] UL2; tətbiq qeydi 2026-11-21):** ixtiyari ölkə siyahısı (yoxlayıcının öz ölkəsindən başqa) çatışmırsa, köhnəlibsə, geri sarılıbsa və ya yoxlanıla bilmirsə: qurum identifikatoru yüklənmiş siyahılarda tapılmırsa (`C1`), zəncir verilən köklərin heç birinə bağlanmırsa (`A3`) və ya növ qeydiyyatda deyilsə və bu siyahının milli sxemi ola bilərsə (`B2`), nəticə `INDETERMINATE`/`INDEXER_STALE`-dir. Həmin ölkənin qurumuna dair C1–C3 cavabları da bilinmir.
- **Hostinq edilən yoxlayıcıda cəhd həddi:** sahiblik sübutuna çatmadan `INDETERMINATE` olan cavablar da cəhd sayılır; təqdimat buna görə bağlanarsa nəticəsi `REJECTED` deyil, `INDETERMINATE`-dir və `indeterminate_reason` saxlanılır (AP2). Gözləyən təqdimatın `last_attempt` sahəsi cəhdin `outcome` və `indeterminate_reason` dəyərlərini də daşıyır. Yoxlama xəttinə daxil olmayan nəticələr (şəxsin rəddi, cəhd həddi) də audit qeydinə yazılır və E4 `checks_performed`-də görünür; audit qeydi həmişə qaytarılan nəticə ilə eyni çıxışı daşıyır. Cüzdanın xəta cavabındakı `error` yalnız OpenID4VP-nin müəyyən etdiyi kodlardan biridirsə qeydə düşür; başqa dəyər `wallet error` kimi yazılır.

## 2.4 `disclosed_claims` — yalnız adlar

**Dəyişməz AP3:** Nəticə obyekti claim **dəyərlərini** deyil, yalnız
**adlarını** daşıyır. Dəyərlər çağıran tətbiqə ayrıca kanal vasitəsilə və açıq şəkildə
sorğulandıqda verilir.

Əsaslandırma: nəticə obyekti audit qeydinə yazılır ([[ARCH-0004]] §5.2). Dəyərlər
ora sızarsa, fərdi məlumatlar log infrastrukturuna yayılır.

**Qaytarılan dəyərlər (2026-11-11).** Çağırana (`claims`; hostinq edilən yoxlayıcıda §4.3) yalnız siyasətin **istədiyi** sahələrin (`required_claims`) yoxlanmış dəyərləri verilir. Cüzdanın əlavə açıqladığı sahə `disclosed_claims`-də görünür və E3-də yoxlanılır, lakin dəyəri qaytarılmır. Sənədin texniki sahələri — `iss`, `iat`, `exp`, `vct`, `category`, şəxsin nüsxə açarı `cnf` və ləğv indeksini daşıyan `status` — heç vaxt qaytarılmır (AP4).

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
| `404` | Naməlum təqdimat və ya başqa yoxlayan tərəfin təqdimatı (mövcudluğu açıqlanmır) |
| `410` | Açıqlanan dəyərlər artıq oxunub və ya müddəti bitib (`/claims`, `claims_gone`; dəyərlər bir dəfə və nəticədən sonra ən çox 5 dəqiqə oxunur — §4.3; 2026-11-19) |
| `409` | Idempotency konflikti (planlaşdırılır — §6.2) |
| `429` | Sürət limiti |
| `500` | Servis xətası |
| `503` | Asılılıq əlçatan deyil **və** nəticə yaradıla bilmədi. Etibar siyahısı köhnə və ya oxunmaz olduqda istinad yoxlayıcısı təqdimat açma sorğusuna (RP bəyanı olsa da, olmasa da) `400`/`401` deyil, `503` + `Retry-After` qaytarır (2026-11-19) |

**İstehlak edilmiş təqdimata gələn cavab (2026-11-19).** Təqdimat sahiblik sübutuna çatan cavabla bir dəfə istehlak edildikdən
sonra eyni təqdimata gələn hər cüzdan cavabı (`/vp/response`, `/vp/dc-mdoc/{id}`) `400 invalid_request` (`nonce already used
(PV10)`) alır; bu, nəqliyyat xətasıdır, ikinci yoxlama nəticəsi deyil və saxlanılan nəticəni dəyişmir. Bağlanmış və ya müddəti
bitmiş təqdimatın sorğu obyektinin çəkilişi `404` alır.

Bunları qarışdırmaq geniş yayılmış səhvdir və iki problem yaradır: (1) müştərilər şəbəkə xətasını
etibarsız rəqəmsal sənəddən ayıra bilmir, (2) monitorinq sistemləri rədd edilmiş rəqəmsal sənədləri
"xəta nisbəti" kimi qəbul edir və real nasazlıqlar səs-küy içində itir.

---

# 4. Yoxlayan tərəf servisinin API-si

Baza (yerləşdirilmiş yoxlayıcı, Tamga Verify): `https://verify.tamga.network` (real şəbəkə), `https://verify.sandbox.tamga.network`
(sandbox). Uc nöqtələri kökün altındadır; yolda versiya prefiksi (`/api/v1`) yoxdur (2026-11-19). Autentifikasiya: təqdimatı açan
və nəticəni oxuyan yoxlayan tərəf `Authorization: Bearer <RP bəyanı>` göndərir — etibar siyahısında qeydiyyatda olan giriş
sertifikatının açarı ilə imzalanmış qısamüddətli JWS (`typ: tamga-rp+jwt`, ES256, birdəfəlik `jti`; §6.4). Brauzer yalnız status
tokenindən (`X-Tamga-Status-Token` və ya `?st=`) istifadə edir və yalnız statusu görür.

Bu bölmə axının əsasını izah edir. Bütün uc nöqtələrinin (QR şəkli, siyasət siyahısı, ISO/IEC 18013-7 Əlavə C cavab ucu, səhifə
dəsti), sorğu və cavab sahələrinin və xəta kodlarının tam tərifi OpenAPI arayışındadır: [Tamga Verify API](/api/verify).

## 4.1 Təqdimat sorğusunu başlatmaq

```http
POST /presentations
Authorization: Bearer <RP bəyanı>
Accept: application/json
Content-Type: application/json
Idempotency-Key: 3f9a1c...

{
  "policy_id": "job-application-degree"
}
```

```json
{
  "presentation_id": "prs_Q2x0dVJmNkp3",
  "request_uri": "https://verify.tamga.network/vp/req/prs_Q2x0dVJmNkp3",
  "qr_payload": "openid4vp://?client_id=x509_hash%3AUvo3…&request_uri=…&request_uri_method=post",
  "expires_at": "2026-11-19T09:17:44.000Z",
  "status_token": "9VdB0qXr7mYk2LwPq1sZ3A"
}
```

Sorğu gövdəsində yalnız iki sahə oxunur: `policy_id` (məcburi) və ixtiyari `dc_api_origin` (brauzerin Digital Credentials API-si
üçün səhifə mənşəyi; verilərsə cavabda `dc_api_request` / `dc_api_requests` da gəlir). Başqa sahələr nəzərə alınmır: istifadə
məqsədi siyasətdən və qeydiyyat sertifikatından gəlir ([[SPEC-PROTO-0002]] §3), cavab rejimi yoldan müəyyən edilir
(cihazlararası `direct_post.jwt`, brauzerdə `dc_api.jwt`), təqdimatın ömrü sabit 300 saniyədir (2026-11-19).
`Accept: application/json` göndərilməzsə yoxlayıcı JSON əvəzinə öz gözləmə səhifəsinə yönləndirir. `status_token` yalnız
brauzerə verilir.

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
    "require_recognition": true,
    "state_code": "TR"
  },
  "freshness": {
    "max_status_token_age_sec": 21600,
    "max_trust_age_sec": 86400
  }
}
```

Siyasət həm DCQL sorğusunu ([[SPEC-PROTO-0002]] §4), həm də `E1`–`E3` addımlarını
qidalandırır. Vahid mənbə.

`freshness.max_anchor_lag_sec` (ixtiyari, san): D5 lövbər gecikmə pəncərəsi; verilməzsə 3600. `freshness.max_clock_skew_sec` (ixtiyari, ən çox 600 san): saat tolerantlığı; verilməzsə 120.

**Dəyişməz AP6:** Siyasətdəki `required_claims` RP-nin etibar siyahısındakı qeydinin
`scopes[]`-unu (`allowedScopes`) aşa bilməz. Servis siyasət qeydə alınarkən bunu yoxlayır və
həddi aşan siyasəti **rədd edir** — həddindən artıq tələb təqdimat anında deyil, siyasət
müəyyən edilərkən bloklanır.

**Yerləşdirilmiş yoxlayıcıda (tətbiq qeydi, 2026-11-19).** Tamga Verify-da siyasətlər servisin konfiqurasiyasıdır (siyahısı
`GET /policies`); siyasəti qeydə alan uc nöqtəsi yoxdur. Buna görə AP6 **təqdimat açılarkən** yoxlanılır: siyasət təqdimatı açan
yoxlayan tərəfin etibar siyahısındakı əhatəsini aşırsa, `POST /presentations` `400 policy_exceeds_scope` qaytarır (`detail` aşan
sahələri sadalayır) və sorğu obyekti heç yaradılmır — həddi aşan tələb cüzdana çatmır.

---

# 5. Sənədi verən servisin API-si

Baza: `https://issuer.tamga.network/{slug}/api/v1` (qurum üzrə yol). OID4VCI uc nöqtələri ayrıdır
([[SPEC-PROTO-0001]]); buradakılar **operator və inteqrasiya** səthidir. Tətbiq edilmiş uc nöqtələrinin tam tərifi OpenAPI
arayışındadır: [Sənədi verən API](/api/issuer) (2026-11-19).

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

## 6.1 Xəta formatı

**Bugünkü istinad servisləri (2026-11-19).** İki servis iki format istifadə edir:

- **Sənədi verən API** (`/{slug}/api/v1`): RFC 9457 problem təfərrüatının ən kiçik forması, `application/problem+json`:
  `{ "type": "about:blank", "title": "<qısa mesaj>", "status": <kod> }`. `detail`, `instance` və `tamga_code` bu gün yaradılmır.
- **Yoxlayıcı (Tamga Verify):** OAuth formatı `{ "error": "<kod>", "error_description": "<ixtiyari mesaj>" }`; əhatə aşıldıqda
  əlavə olaraq `detail` (aşan hissələrin siyahısı, `policy_exceeds_scope`). Gövdənin təhlil xətası kimi çərçivə xətaları və
  gözlənilməz xətalar `{ "statusCode": <kod>, "error": "<HTTP səbəb ifadəsi>", "message": "<mesaj>" }` formasındadır; 5xx-də mesaj
  həmişə `internal error`-dur (daxili təfərrüat cavaba düşmür).

Aşağıdakı nümunə RFC 9457-nin tam formasını və planlaşdırılan `tamga_code` genişlənməsini göstərir; bu gün sənədi verən yalnız
`type`, `title` və `status` sahələrini yaradır.

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

**Planlaşdırılır — hələ tətbiq edilməyib (2026-11-19).** İstinad servisləri (yoxlayıcı `apps/verify`, sənədi verən) bu gün
`Idempotency-Key` başlığını emal etmir; başlıq nəzərə alınmır və `409` yaradılmır. Təkrar çağırış yeni təqdimat və ya əməliyyat
açır. Hədəf davranış: yan təsirli hər `POST` (`/offers`, `/revocations`, `/presentations`) başlığı qəbul edir; eyni açarla
təkrar çağırış eyni cavabı qaytarır, fərqli gövdə ilə eyni açar `409` yaradır; saxlama müddəti 24 saat. §4.1 və §5.1
nümunələrindəki başlıq bu hədəfi göstərir.

## 6.3 Versiyalaşdırma

Sənədi verən API yol əsaslıdır: `/{slug}/api/v1`. Yerləşdirilmiş yoxlayıcının yolunda versiya prefiksi yoxdur (§4); versiyanı
OpenAPI sənədi daşıyır (2026-11-19). Uyğunluğu pozan dəyişiklik `/v2` açır; `/v1` ən azı **12 ay**
paralel işləyir ([[ARCH-0005]] §5.3 ilə eyni siyasət).

## 6.4 Autentifikasiya (şəxsiyyətin yoxlanılması)

| Səth | Üsul |
|---|---|
| Operator paneli → sənədi verən API | OIDC + rol əsaslı səlahiyyət |
| OBS → sənədi verən API | mTLS və ya müştəri etimadnaməsi |
| Yoxlayan tərəf tətbiqi → yoxlayan tərəf API-si | RP bəyanı: `Authorization: Bearer <tamga-rp+jwt>` — etibar siyahısındakı giriş sertifikatının açarı ilə imzalanmış, ən çox 60 saniyəlik, `jti`-si birdəfəlik JWS; paylaşılan gizli açar yoxdur (`createRpAssertion()`). Brauzer statusu yalnız status tokeni ilə (`X-Tamga-Status-Token` və ya `?st=`) oxuyur (2026-11-19) |
| Giriş terminalı → yoxlayıcı `/terminal/verify` | Terminal açarı: terminal qrupuna bağlı, operatorun verdiyi daşıyıcı açar (`Authorization: Bearer`); açarsız sorğu 401 alır, token oxunmur (ADR-0065). |
| Qurum Konsolu → yoxlayıcı `/terminal/keys` (qurum adından) | Quruma məhdudlaşdırılmış token: `x-tamga-institution` + `x-institution-token` = base64url(HMAC-SHA256(inzibatçı tokeni, `tamga-terminal-keys/v1:` + qurum)); qurum yalnız imzalı siyahıda (`terminal_groups[].institution_id`) özünə bağlı qrupların açarlarını alır, görür və ləğv edir ([[ADR-0069]] TG1–TG3). |
| OID4VCI / OID4VP uc nöqtələri | Protokolun öz mexanizmi |

## 6.5 Sürət limiti

`429` + `Retry-After`. Tövsiyə: `/offers` üçün hər quruma 100/dəq,
`/presentations` üçün 1000/dəq. Tamga Verify-ın təqdimat açma (`/presentations`), rəqəmsal cüzdan cavabı (`/vp/response`) və giriş qapısında yoxlama
(`/terminal/verify`) uc nöqtələrində `429 rate_limited` + `Retry-After` qaytarılır; müştəri ünvanı saxlanılmır və loglanmır.

Nümunə saytın təqdimat başlatma ucu (`/sample-site/start`, yalnız sandbox) da məhdudlaşdırılıb. Proksi müştəri ünvanını ötürmədiyi üçün bəyannaməsiz sorğular bir vedrəni paylaşır; proksi hər sorğuda özünün yazdığı müştəri açarı başlığını göndərirsə (`TAMGA_VERIFY_CLIENT_KEY_HEADER`), vedrələr müştəri üzrə ayrılır. Başlıq yalnız yerli proksidən gələn sorğuda oxunur; dəyəri saxlanılmır və loglanmır.

---

# 7. İnvariantlar

| # | Dəyişməz |
|---|---|
| **AP1** | Addım kodunun mənası heç vaxt dəyişmir; ləğv edilmiş kod yenidən istifadə olunmur. |
| **AP2** | `INDETERMINATE` `REJECTED` ilə eyni kateqoriyaya salınmır. |
| **AP3** | Nəticə obyekti claim dəyərlərini deyil, adlarını daşıyır. |
| **AP4** | `idx` heç bir API cavabında və ya qeyddə olmur. |
| **AP5** | HTTP status kodu yoxlama nəticəsini kodlaşdırmır. |
| **AP6** | Siyasətin `required_claims`-i RP-nin etibar siyahısındakı qeydinin scope-unu aşa bilməz. |
| **AP7** | Xətanın `detail` sahəsi fərdi məlumat ehtiva etmir. |
| **AP8** | `C2` (sxem səlahiyyəti) heç bir konfiqurasiya ilə yan keçilə bilməz. |
| **AP11** | `C1` və `C2` rəqəmsal sənədin `iat`-ını götürür; rəqəmsal sənədin verilmə vaxtına aid sorğular yoxlamada istifadə olunmur. İstisna: ZK təqdimatında (`mso_mdoc_zk`) sənədin imzalanma anı sübutda gizlidir; `C1` və `C2` sübutun vaxt damğasını götürür (§1.1, [[ADR-0032]]). |
| **AP12** | `issuerId` `x5c` yarpaq sertifikatının barmaq izindən törədilir, `iss` claim-indən deyil. |
| **AP13** | Keçid kartı tokeninin yoxlanması ([[ADR-0012]] B): imza `pass_grant`-dakı nüsxə açarı ilə, `aud` = yoxlayan tərəfin daimi identifikatoru (etibar siyahısındakı qeydinin `dns_name`-i; sertifikat yenilənsə də dəyişmir, [[ADR-0034]]), ömür (`exp` − `iat`) ≤ 60 s, `iat` ≤ indi + 30 s, `exp` ≤ indi + 60 s + 30 s (saat sürüşməsi tolerantlığı), `jti` təkrar siyahısı (terminal qrupu daxilində onlayn paylaşılır); tokendən fərdi məlumat çıxarılmır və loglanmır. |
| **AP9** | `E4` (audit qeydi) rədd edilmiş yoxlamalarda da işləyir (audit qeydi yeri olan yoxlayan tərəfdə; host edilən yoxlayan tərəfdə həmişə). |
| **AP10** | `tx_code` cavabdan başqa heç yerdə saxlanılmır. |

---

# Təhlükəsizlik və məxfilik qeydləri

**Nəticə obyekti audit artefaktıdır.** AP3 və AP4 birlikdə saxlanılan qeydin izləmə səthinə çevrilməsinin qarşısını alır.
İstinad yoxlayıcısı (`apps/verify`) audit qeydini bu gün **yalnız yaddaşda** saxlayır: son 1000 hadisə, proses yenidən
başlayanda silinir; davamlı saxlama və [[ARCH-0004]] §5.4-dəki 12 aylıq müddət **planlaşdırılan** davranışdır, bu gün zəmanət
deyil (2026-11-19). `/claims` oxunuşu da dəyər daşımayan hadisə kimi qeydə düşür (`claims.read`: yoxlama identifikatoru,
siyasət, verilibmi).

**`/claims` uc nöqtəsi ayrıca avtorizasiya olunur.** Yoxlama nəticəsini görmək ilə
açıqlanan dəyərləri oxumaq fərqli səlahiyyətlərdir. İnsan resursları üzrə köməkçi "namizəd
yoxlanıldı" nəticəsini görə bilər, lakin orta balı (açıqlanıbsa) görməyə bilər.

**`checks_skipped` boş deyilsə, diqqətli olun.** Bu, bir addımın tətbiq edilmədiyi deməkdir: formatın daşımadığı (məs. mdoc və
ZK təqdimatında `C4`), siyasətin tələb etmədiyi (`C3`), çağıranın bilərəkdən söndürdüyü (`E3`, `E4`) və ya tətbiqin
aparmadığı addım; köhnə SDK da hansısa yoxlamanı ötürmüş ola bilər ([[ARCH-0005]] §4.1). Yoxlayan tərəf tətbiqi ötürülənləri
**görünən** etməli, səssizcə qəbul etməməlidir.

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

**Versiya qeydi (2026-11-19, ikinci; audit turu — versiya 1.0 qalır).** Audit turunda spesifikasiya mətni istinad tətbiqinə və
OpenAPI sənədinə uyğunlaşdırıldı, davranış dəyişmədi: ilkin addım `T0` (§1.0) və təxəllüs addımı `P1` (§1.F) reyestrə daxil
edildi; A-sırası, `policyCredentialId` yoxlaması və xarici siyahı istifadə edilə bilmədikdə `B2`-nin `INDETERMINATE`-i yazıldı
(§1.A, §1.B, §1.3); `B3`-də növ təriflərinin paketə daxil olduğu yazıldı; nümunə nəticə real çıxış formasına gətirildi (§2.2);
`410` və istehlak edilmiş təqdimata gələn cavabın `400`-ü əlavə edildi (§3); yoxlayıcının bazası, autentifikasiyası, oxunan sorğu
sahələri və OpenAPI arayışı düzəldildi (§4, §4.1); AP6-nın yerləşdirilmiş yoxlayıcıda təqdimat açılarkən yoxlandığı yazıldı
(§4.4); xəta formatı, versiyalama və autentifikasiya cədvəli bugünkü servislərə görə yazıldı (§6.1, §6.3, §6.4).

**Versiya qeydi (2026-11-19; audit turu — versiya 1.0 qalır).** Protokol audit turu: oxuna bilməyən
`status` girişi `D1`-də RƏDD EDİLİR (§1.D); mdoc-da gələcək tarixli `signed` `A3`-də, `validFrom` < `signed` `A7`-də RƏDD
EDİLİR (§1.A; ZK təqdimatında `signed` gizli olduğundan bu yoxlama tətbiq edilmir — ZK yolunda zaman yoxlaması sübut anı və
sertifikatdır); `REVOKED` tip `B2`-də RƏDD EDİLİR; status siyahısının ölçüsü `bits` ilə məhdudlaşır və aşma `D4`
INDETERMINATE-dir (§1.D); etibar siyahısı köhnə olduqda `503` (§3); siyasət nümunəsi T0-dan keçəcək şəkildə düzəldildi (§4.4);
`Idempotency-Key` planlaşdırılan kimi işarələndi (§6.2); audit qeydinin saxlanması bugünkü yaddaşdaxili davranışla yazıldı
(Təhlükəsizlik qeydləri).

**Versiya qeydi (2026-11-12; layihə rəhbərliyinin təsdiqi ilə — davranış dəyişmədi).** Sənəd–kod yoxlamasından qalan üç
uyğunsuzluq sənəd tərəfində bağlandı və qərar sənədlərinə bağlandı: ZK təqdimatında `C1`/`C2`-nin sübut anına görə soruşulması
AP11-in açıq istisnasıdır ([[ADR-0032]] tətbiq qeydi; §1.1, AP11 sətri); mdoc və ZK təqdimatında `C4`-ün tətbiq edilməməsi və
sinfin `issuer.class`-dan oxunması ([[ADR-0010]] tətbiq qeydi; §1.C); `A3d` və `A8` kodlarının bildirilməsi ([[ADR-0056]]
tətbiq qeydi; §1.3).

