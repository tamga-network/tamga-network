---
document_id: SPEC-ID-0002
title: "Qurum şəxsiyyəti (X.509)"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-16
summary: >
  [[ADR-0004]] X.509 qərarının kod/protokol səviyyəsində qarşılığı. Korporativ/entity şəxsiyyəti milli Root CA-lara əsaslanan X.509 sertifikatları ilə qurulur; qurumun zəncirdəki identifikatoru issuerId = keccak256(stateCode, certFingerprint) ilə lövbərlənir. Əhatə olunan mövzular: etibar zənciri (milli Root CA-ların zəncirə lövbərlənməsi), sertifikat iyerarxiyası, issuerId-nin törədilməsi, credential yoxlama alqoritmi (zəncir + registry + ləğv), Root CA-nın yenilənməsi (rollover), sertifikatın ləğvi (CRL/OCSP + on-chain), guardian/court-token X.509 bağlanması, qorunan pseudonym profili + multicodec və eIDAS/did:web körpüsü. did:tamga entity profilini əvəz edir; pseudonym profili (SPEC-ID-0001) saxlanılır.
translation_of: SPEC-ID-0002
source_version: "1.0.0"
---
**Bu spesifikasiya [[t:issuer]] qurumların şəxsiyyətinin X.509 sertifikatları ilə necə qurulduğunu və yoxlanıldığını izah edir.** Qurum inteqrasiyası aparan və [[t:verifier]] yazan tərtibatçılar üçündür.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Etibar siyahıları və federasiya](/concepts/trust-lists) konseptual səhifəsini oxuyun.
- Rəqəmsal sənədin imzasını qurumun sertifikatına, oradan da ölkənin kök sertifikatına qədər izləməli olduğunuz hallarda.
- Sonra: etibar siyahılarının formatı üçün [[SPEC-TRUST-0001]].

**Qısaca.** Hər ölkə öz kök sertifikatını (root CA) idarə edir. Qurum, məsələn, universitet bu kökə bağlı sertifikat alır və
rəqəmsal sənədləri onunla imzalayır. Yoxlayan tərəf imzadan qurumun sertifikatına, oradan da kök sertifikata çatır; kökün barmaq izi bu gün imzalı
[[t:trust-list|etibar siyahılarında]] dərc olunur (zəncir mərhələsində eyni qeyd reyestrə köçürülür). Qurumun şəbəkədəki identifikatoru (`issuerId`) ölkə kodu və sertifikatın
barmaq izindən törədilir. Qurumun səlahiyyəti həm sertifikat səviyyəsində, həm də etibar siyahısında ləğv edilə bilər.

---

# Əhatə dairəsi

Bu spesifikasiya Tamga Network-da **korporativ/entity şəxsiyyətin** X.509 sertifikatları ilə
necə qurulduğunu müəyyən edir ([[ADR-0004]]). **Nəyi** deyil, **necəni** verir: kök CA-nın
lövbərlənməsi, sertifikat→`issuerId` uyğunlaşdırması, yoxlama alqoritmi, ləğv və yenilənmə
(rollover). SPEC-ID-0001-in **Entity DID profilini əvəz edir**; **Psevdonim
profili saxlanılır** (bax: §7).

**Üç qat ([[PM-AUTH-0001]]):** A=EVM ünvanı (bu spesifikasiyanın əhatəsindən kənardır, dəyişmir) ·
**B=korporativ şəxsiyyət (bu spesifikasiyanın mövzusu, X.509)** · C=fərdi şəxsiyyət (rəqəmsal sənəd +
psevdonim, §7).

---

# 1. Etibar zənciri: milli kök sertifikatların (root CA) sabitlənməsi

Hər üzv dövlət **öz milli kök CA-sını** idarə edir (suverenlik — [[ADR-0002]]). Tamga
bu köklərin **fingerprint-lərini zəncirə lövbərləyir**; beləliklə, qurumun sertifikatı
onun dövlətinin lövbərlənmiş kökünə qədər yoxlanıla bilər.

```
Türkiye Root CA  (fingerprint on the chain, stateCode="TR")
   └── (optional intermediate CA)
         └── İTÜ certificate  (leaf)
```

**On-chain kök qeydi** (RootCARegistry — [[SPEC-BC-0001]] ilə eyni idarəetmə,
`onlyOwnerState`):

```solidity
struct RootCA {
    bytes2  stateCode;      // "TR", "AZ", "KZ"
    bytes32 caFingerprint;  // SHA-256(DER(rootCert))
    uint64  notBefore;
    uint64  notAfter;
    bytes32 successorId;    // rollover successor (0 if none)
    RootStatus status;      // ACTIVE, ROLLING_OVER, RETIRED, REVOKED
}
```

Dövlətin kökünü yalnız **həmin dövlət** qeydiyyata alır/yeniləyir (`onlyOwnerState`).
Kökün **açıq açarı** on-chain saxlanılır (fərdi məlumat deyil — [[PM-TRUST-0001]]
həddi qorunur).

## 1.1 Qurum sertifikatının profili ([[ADR-0050]])

Sənədi verən qurumların (şəxsiyyət xidməti daxil olmaqla) sənəd imzası və ləğv siyahısı imzası sertifikatları ETSI TS 119 412-6 V1.2.1 və EN 319
412-3-ə uyğun tərtib edilir:

| Sahə | Qayda |
|---|---|
| Subyekt | `organizationIdentifier` (2.5.4.97) məcburidir, qeydiyyat sertifikatındakı `sub` ilə eynidir (`VATTR-<VKN>`, `NTRTR-<MERSİS>`, `LEIXG-<LEI>`); `O` = qurumun rəsmi adı; `C` məcburidir; `CN` və `OU` ixtiyaridir |
| Açar istifadəsi | Kritik; yalnız `digitalSignature` (tək növ; mdoc sənəd imzası sertifikatı ilə uyğun) |
| Əsas məhdudiyyətlər | Kritik, `cA = false` |
| SKI / AKI | Hər ikisi məcburidir; AKI = imzalayan orqanın SKI-si |
| AIA | Kvalifikasiyalı olmayan EAA-da tələb olunmur; kvalifikasiyalı və dövlət sinfi üçün ayrıca qərarla |
| Alqoritm, müddət | P-256 / ECDSA SHA-256; ən çoxu 3 il |

Real şəbəkədə qurum sertifikatı `organizationIdentifier` ilə verilir (operator aləti `pki-issue --prod --org-id`); identifikasiya nömrəsi
olmayan köhnə sertifikatlar nömrə qeydə alındıqda yenilənir (§4 yenilənmə modeli, XC2). Sandbox sertifikatları eyni açarla yenidən
imzalandı (2026-10-13).

---

# 2. issuerId-nin törədilməsi

Qurumun zəncirdəki identifikatoru sertifikatın fingerprint-indən **deterministik** şəkildə törədilir:

```
certFingerprint = SHA-256( DER(issuerCert) )
issuerId        = keccak256( abi.encodePacked(stateCode, certFingerprint) )
```

`issuerId`, [[SPEC-BC-0001]] **Issuer Registry**-də qeydin açarıdır:

```solidity
struct Issuer {
    bytes2        stateCode;
    bytes32       certFingerprint;
    IssuerCategory category;   // GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS (ADR-0014)
    uint64        validUntil;
    bytes32       successorId; // soft revocation / renewal successor
    IssuerStatus  status;      // ACTIVE, SUSPENDED, REVOKED
}
```

Eyni qurum sertifikatını yenilədikdə fingerprint dəyişir → yeni `issuerId`; köhnə
qeyd `successorId` vasitəsilə yeni qeydə bağlanır (fasiləsiz davamlılıq; [[SPEC-BC-0001]]
yumşaq ləğv modeli).

---

# 3. Rəqəmsal sənədin yoxlanılması alqoritmi

Yoxlayan tərəf [[t:holder|sənəd sahibinin]] təqdim etdiyi [[t:credential|rəqəmsal sənədi]] belə yoxlayır:

```
INPUT: credential (SD-JWT signed by the issuer), issuerCert (in the credential / reachable)

1. Certificate chain: verify issuerCert → (intermediate CA) → up to the Root CA.
   Is the root's caFingerprint ACTIVE|ROLLING_OVER in RootCARegistry? If not, REJECT.
2. issuerId = keccak256(stateCode, SHA-256(DER(issuerCert))).
   Is it in the Issuer Registry with status == ACTIVE? Is the category the expected one? If not, REJECT.
3. Temporal validity: issuerCert.notAfter not passed + validUntil not passed.
4. Revocation:
   a. Institution level: X.509 CRL/OCSP clean + on-chain Issuer.status != REVOKED.
   b. Credential level: the StatusList bit is "valid" ([[SPEC-BC-0001]], min 100k).
5. Signature: the credential signature is valid under the issuerCert public key.
   → if all 5 steps pass, the credential is VALID.
```

**Qeyd:** 1–3-cü addımlar zəncirdən (hamı üçün açıq) oxunur; rəqəmsal sənəd/fərdi məlumatlar zəncirə
yazılmır. Yoxlama sənədi verən quruma **müraciət etmədən** aparılır (holder-centric).

---

# 4. Kök sertifikatın yenilənməsi (Rollover)

Milli kök müddətin bitməsi və ya açarın gücləndirilməsi üçün yenilənir. Mövcud
sənədləri pozmadan:

1. Dövlət yeni kökü qeydiyyata alır; köhnə kök `status = ROLLING_OVER`, `successorId = yeniKök`.
2. **Üst-üstə düşmə dövrü** (məs., 12 ay): hər iki kök yoxlama üçün qəbul edilir.
3. Qurumlar sertifikatlarını yeni kökə köçürür (yeni `issuerId` + `successorId` zənciri).
4. Üst-üstə düşmə dövrünün sonunda köhnə kök `RETIRED`; yalnız yeni kök qəbul edilir.

**Fövqəladə hal (kök ələ keçirilib):** köhnə kök `REVOKED` → həmin kökə bağlı bütün sertifikatlar
dərhal etibarsız olur; müvafiq dövlət sənədlərin təcili yenidən verilməsini həyata keçirir. Bunun təsiri qurumun ləğvindən
([[SPEC-BC-0001]]) daha genişdir və idarəetmədə müəyyən edilir ([[PM-GOV-0001]] planlaşdırılır).

---

# 5. Sertifikatın ləğvi (iki qatlı)

| Qat | Mexanizm | Nəyi ləğv edir |
|---|---|---|
| **Qurum sertifikatı** | X.509 CRL/OCSP **+** on-chain `Issuer.status = REVOKED` | Qurumun gələcəkdəki bütün imzalarını |
| **Tək sənəd** | StatusList biti ([[SPEC-BC-0001]]) | Yalnız həmin sənədi |

Hibrid yanaşma: X.509 dünyasının mövcud CRL/OCSP infrastrukturu (tənzimləyici uyğunluq) +
on-chain status (holder-centric, mənbəyə müraciət etmədən yoxlanıla bilir). Ziddiyyət olduqda
**on-chain REVOKED bağlayıcıdır** (zəncir yeganə həqiqət mənbəyidir).

---

# 6. Guardian & Court-Token bağlanması ([[SPEC-BC-0002]])

Accountable disclosure-da guardian qurumları və məhkəmə **X.509 ilə identifikasiya olunur**:

- Guardian `entityId` = müvafiq qurumun `issuerId`-si (məhkəmə hakimiyyəti, KVKK, NVİ, Ombudsman,
  parlament tərəfindən təyin olunan → hər biri X.509 sertifikatlı qurum).
- **Court-token** = imzalı obyekt (JWS və ya EIP-712); onun imzası məhkəmənin X.509
  sertifikatına, o da milli kök CA-ya qədər zəncirlənir. On-chain yoxlama:
  `verifyCourtToken` fingerprint + zəncir + registry ACTIVE yoxlamasını aparır.
- Guardian təsdiqlərinin (3-of-5) hər biri X.509 imzası ilə verilir; audit log imza fingerprint-lərini
  saxlayır (fərdi məlumat deyil).

> Bu, [[SPEC-BC-0002]] §7-də bağlanan "x509 izlənəcək" bəndinin konkret qarşılığıdır.
> Court-token-in EIP-712, yoxsa JWS olacağı + EVM precompile ehtiyacı → [[DECISIONS]]
> D-GRD-1 (kripto auditi).

---

# 7. Qorunan psevdonim profili (vətəndaş)

**Vətəndaşa qlobal identifikator verilmir.** Fərdi əlaqələr **pairwise [[t:pseudonym]]**
ilə qurulur (SPEC-ID-0001 psevdonim profili — X.509 qərarından **təsirlənmir**):

- Psevdonim = self-certifying, açar əsaslı; hər əlaqədə fərqli, unlinkable.
- Zəncirə **yazılmır**; həll yerli açardan aparılır.
- **Multicodec dəsti (sabitlənmiş):** `p256-pub` (0x1200), `secp256k1-pub` (0xe7),
  `ed25519-pub` (0xed). Defolt **P-256** ([[t:eIDAS]]/[[t:QSCD]] ilə uyğunluq); EVM-yerli əməliyyatlar
  üçün secp256k1.
- Entity↔psevdonim körpüsü yalnız accountable disclosure ([[SPEC-BC-0002]]) ilə.

---

# 8. eIDAS / did:web körpüsü (ixtiyari qarşılıqlı fəaliyyət)

Avropa İttifaqı (Aİ) ilə qarşılıqlı fəaliyyət üçün qurum mövcud identifikatorunu Tamga `issuerId`-sinə
**alias** kimi bağlaya bilər:

- **eIDAS QWAC/QSeal:** Qurumun kvalifikasiyalı sertifikatı onsuz da X.509-dur — birbaşa `issuerId`
  törədilməsinə uyğundur; Aİ Trusted List ([[t:LOTL]]) ilə çarpaz tanınma ([[ADR-0002]] cross-recognition).
- **did:web:** Qurumun `did:web` identifikatoru alias qeydi ilə `issuerId`-yə bağlana bilər
  (məcburi deyil; yalnız DID əsaslı xarici ekosistemlərlə interop tələb olunarsa).

Bu körpü **birtərəfli tanınmadır**; Tamga-nın əsas etibar zənciri milli kök CA-lardır.

## 8.1 eIDAS etibar siyahısı proyeksiyası (ETSI TS 119 612)

> Qərarın əsası: [[RS-EIDAS-0001]] §5.1 (ETSI TS 119 612 V2.4.1 təhlili). ETSI 119 612
> Aİ-dən kənar ölkələrin/beynəlxalq təşkilatların Trusted List (TL) dərc edib Aİ LOTL ilə
> **qarşılıqlı tanınmasını** açıq şəkildə nəzərdə tutur ([[ADR-0002]] cross-recognition). Bu, korporativ
> tərəf üçün did:web körpüsü ilə müqayisədə tənzimləyicilər baxımından daha oxunaqlı interop yoludur.

**Prinsip:** On-chain qeyd (RootCARegistry + Issuer Registry) **yeganə həqiqət mənbəyidir**;
119 612-yə uyğun TL bu zəncir vəziyyətinin **yalnız oxunan off-chain proyeksiyasıdır**
(XML/XAdES). Proyeksiya `sdk/` çərçivəsində yaradılır, **smart-kontrakt dəyişikliyi tələb etmir** və
zəncir vəziyyətini dəyişmir. Tamga bu TL üçün **Trusted List Scheme Operator (TLSO)**
rolunu öhdəsinə götürür (ilk mərhələdə Tamga; dövlət mərhələsində milli kök orqanı — [[PM-ASSUR-0001]]).

**Xidmət növünün uyğunlaşdırılması (Tamga qeydi → ETSI Service type identifier):**

| Tamga | ETSI 119 612 Service type URI |
|---|---|
| Milli kök CA (RootCARegistry) | `…/Svctype/NationalRootCA-QC` |
| Issuer (CA/sertifikat verən qurum) | `…/Svctype/CA/QC` (və ya `CA/PKC` non-qualified) |
| Qeydiyyat orqanı / şəxsiyyətin sübutu ([[DECISIONS]] D-ID-2) | `…/Svctype/RA`, `…/Svctype/IdV` |
| X509-AC EAA verən qurum ([[RS-EIDAS-0001]] §4.4) | `…/Svctype/ACA`, `…/Svctype/EAA/Q` |
| TL dərc edən xidmət (Tamga TLSO) | `…/Svctype/TLIssuer` |

**Status lüğətinin 1:1 uyğunlaşdırılması (Tamga statusu → ETSI Service current status):**

| Tamga statusu | ETSI Svcstatus | Qeyd |
|---|---|---|
| `ACTIVE` (Root/Issuer) | `…/Svcstatus/granted` | Kvalifikasiyalı xidmət təsdiqlənib |
| `ACTIVE` (milli tanınma konteksti) | `…/Svcstatus/recognisedatnationallevel` | 5.5.1.3 tipli xidmətlər üçün |
| `ROLLING_OVER` (Root) | `granted` + `TakenOverBy` (§5.5.9.3) | Varis kökə ötürmə; üst-üstə düşmə dövrü |
| `SUSPENDED` (Issuer) | `granted` → müvəqqəti `withdrawn` | Dayandırma; tarixçə saxlanılır |
| `RETIRED` (Root, rollover sonu) | `withdrawn` + tam status tarixçəsi | Silinmə deyil; tarixçə heç vaxt silinmir (§5.3.12) |
| `REVOKED` (Root/Issuer) | `withdrawn` | Ələ keçirilmə; alt sertifikatlar etibarsız olur |
| `successorId` bağı (varis sənədi verən qurum) | `TakenOverBy` extension | D-BC-5 / XC2 ilə birbaşa qarşılıq |

**Dəyişməz qorumalar:** Proyeksiya yalnız **qeyri-fərdi** etibar məlumatlarını (kök/qurum
public açarı, status, tarixçə) xaricə ötürür (`XC3`). **Vətəndaşın pairwise psevdonimi heç vaxt
TL-ə yazılmır** (`XC4`); TL yalnız institusional təbəqəni (B) əhatə edir. Bu, ETSI Trusted List
modelinin "blockchain etibar lövbəri" variantıdır: ETSI digest-i OJEU-da dərc edir, Tamga isə onu
RootCARegistry-də lövbərləyir.

### 8.1.1 LoTE proyeksiyası (ETSI TS 119 602, JSON) — tətbiq edilib (2026-09-29)

[[t:ARF]] 3.0 rəqəmsal cüzdanların və yoxlayan tərəflərin [[t:trust-anchor|etibar lövbərlərini]] həm 119 612 TL-lərindən, həm də 119 602 [[t:LoTE|LoTE-lərindən]] almasını tələb edir
(OIA_15b, ISSU_10b, ISSU_28a). `apps/trust-publisher` `build`, [[SPEC-TRUST-0001]] siyahılarından üç LoTE yaradır
(`trust.tamga.network/lote/{wallet-providers,wrpac-providers,eaa-providers}.jws`): Əlavə A.1 JSON sxemi, compact JAdES
Baseline B (`x5c`, `x5t#S256`, imza vaxtı `iat` — ETSI TS 119 182-1 V1.2.1 §5.1.11; `sigT` 2025-07-15-dən bəri yeni imzalarda yoxdur, oxuyucu köhnə siyahılarda tanıyır), eyni siyahı imzalayanı (sertifikat C/O = SchemeTerritory / SchemeOperatorName,
§6.8.0).

- Profil: Aİ Əlavə E / Əlavə F qaydaları və Əlavə H strukturu. Lakin "üzv dövlət tərəfindən bildirilmiş" mənasını daşıyan URI-lər (LoTEType,
  StatusDetn, schemerules, ListOfTrustedEntities/…/CC) əvəzinə Tamga URI kökü `https://trust.tamga.network/lote/`
  istifadə olunur (Əlavə C.1).
- Xidmət növü URI-ləri ETSI-yə məxsusdur (`SvcType/WalletSolution`, `SvcType/WRPAC`). Kvalifikasiyalı olmayan EAA üçün ETSI növü yoxdur;
  Tamga URI-si istifadə olunur.
- LoTE yalnız bir görünüşdür; səlahiyyətli mənbə Tamga siyahılarıdır. Dərc mənbədə `lote.enabled` ilə aktivləşdirilir.

**Açıq məsələlər:** Türk dünyası üçün çoxdövlətli ölkə kodu (ETSI §5.1.5, GCC/ASEAN-a bənzər)
və TL dərc tezliyi (≤6 ay, küylü təkrar dərc — [[ADR-0008]] ilə uzlaşdırılmış) → §10.

---

# 9. Açar alqoritmləri və dəyişməzlər

- **İmza:** ECDSA **P-256 (secp256r1)** əsas alqoritmdir (eIDAS/QSCD uyğunluğu); secp256k1 EVM-yerli
  əməliyyatlar üçün qəbul edilir. Sertifikatlarda SHA-256 heşi istifadə olunur.

**Dəyişməzlər:**

| # | Dəyişməz |
|---|---|
| **XC1** | Qurumun şəxsiyyəti həmişə öz dövlətinin lövbərlənmiş kök CA-sına zəncirlənir. |
| **XC2** | `issuerId` sertifikatın fingerprint-inə bağlıdır; sertifikat dəyişdikdə şəxsiyyət yeni `issuerId` + `successorId` ilə davam edir. |
| **XC3** | Zəncir yalnız qeyri-fərdi məlumatları saxlayır (kök/qurum public açarı, status). |
| **XC4** | Vətəndaşın qlobal identifikatoru yoxdur (yalnız pairwise psevdonim). |
| **XC5** | Entity↔şəxsiyyət bağı yalnız accountable disclosure həddi ilə açılır. |
| **XC6** | Sənədi verən qurumun rəqəmsal sənəd və ləğv siyahısı imza sertifikatı subyekt sahəsində qeydiyyat sertifikatının `sub`-ı ilə eyni `organizationIdentifier`-ı daşıyır; açar istifadəsi kritikdir və yalnız `digitalSignature`-dır; SKI və AKI məcburidir ([[ADR-0050]]). |

---

# 10. Açıq suallar

1. **Aralıq CA (intermediate) siyasəti:** Dövlətlər aralıq CA istifadə edəcəkmi, yoxsa leaf birbaşa
   root tərəfindən imzalanacaq? (zəncir uzunluğu / yoxlama xərci)
2. **Üst-üstə düşmə dövrünün müddəti** (rollover) — 12 ay təklif olunur; dövlətlərlə dəqiqləşdiriləcək → PM-GOV-0001.
3. **Court-token formatı** (JWS vs EIP-712 + precompile) → [[DECISIONS]] D-GRD-1.
4. **OCSP stapling vs on-chain status** üstünlüyü — performans/uyğunluq balansı.
5. **CAIP-2 şəbəkə identifikatoru** (`tamga:<chainId>`) sertifikat/issuerId təqdimatında necə yer alır.
6. **119 612 TL proyeksiya formatı** (§8.1): `sdk/` generatoru XML/XAdES-B-B yaradacaqmı, imza
   açarlarının idarə edilməsi (≥2 növbəli sertifikat, ETSI Annex A.2) necə qurulacaq → SPEC-CRED /
   PM-GOV-0001.
7. **Türk dünyası üçün çoxdövlətli ölkə kodu** (ETSI §5.1.5) müəyyən ediləcəkmi → [[ADR-0002]].
8. **TL dərc tezliyi** (≤6 ay, küylü təkrar dərc) ləğv siyahısının dərci ilə ([[ADR-0008]])
   necə uzlaşdırılır.

---

# 11. Əlaqələr və status

- [[ADR-0004]] — bu spesifikasiyanın qərar mənbəyi (X.509).
- SPEC-ID-0001 — Entity profili superseded; **Psevdonim profili bu sənəddə saxlanılır**.
- [[SPEC-BC-0001]] — Issuer Registry / StatusList / IssuerCategory (issuerId məlumat mənbəyi).
- [[SPEC-BC-0002]] — guardian/court-token X.509 bağlanması (§6).
- [[ADR-0002]] — onlyOwnerState / cross-recognition (kök CA sahibliyi, eIDAS körpüsü).
- [[PM-AUTH-0001]] — üç təbəqə + tənzimləyici oxunaqlılıq əsaslandırması.
- [[RS-EIDAS-0001]] — §5.1 (ETSI 119 612 Trusted List təhlili) = §8.1 proyeksiyasının əsası.
- İmplementasiya: `sdk/` (resolver + yoxlama + 119 612 TL proyeksiyası), `contracts/src/` (RootCARegistry).

**Qüvvədədir** — versiya 1.0.0 (2026-10-02; §1.1 və XC6 2026-10-13, [[ADR-0050]]).

---
