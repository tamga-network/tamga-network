---
document_id: SPEC-CRED-0001
title: "Rəqəmsal sənəd formatı və protokollar"
status: Active
version: 1.0.0
created: 2026-09-03
last_updated: 2026-10-16
summary: >
  Tamga rəqəmsal sənədlərinin kanonik formatını, sənədin verilməsi və təqdim edilməsi protokollarını müəyyən edir. Əsas format SD-JWT VC-dir (selective disclosure daxilidir, EUDI ARF-in əsas formatıdır), ikinci format mdoc/ISO 18013-5-dir (2-ci faza, oflayn/fiziki təqdimat). Sənədin verilməsi OpenID4VCI, təqdimat OpenID4VP, imza ES256 (P-256) ilə həyata keçirilir. Holder binding MƏCBURİDİR: credential həmişə rəqəmsal cüzdanın cihaz açarına `cnf` (key binding) ilə bağlanır — bu, "universitet ideyasındakı gizli səhvin" (rəqəmsal sənədin başqasının cüzdanına yazılması) yeganə həllidir. Wallet Unit Attestation (WUA) rəqəmsal cüzdanın həqiqiliyini bəyan edir. Ləğv Token Status List-ə ([[SPEC-BC-0001]] §5) həvalə olunur. Zəncirə credential və ya onun məzmunu HEÇ VAXT yazılmır ([[PM-TRUST-0001]]).
translation_of: SPEC-CRED-0001
source_version: "1.0.0"
---
**Bu spesifikasiya Tamga rəqəmsal sənədlərinin hansı formatda daşındığını və hansı protokollarla verilib təqdim edildiyini ümumiləşdirir.** Şəbəkəyə qoşulan hər
tərtibatçı üçün başlanğıc nöqtəsidir.

**Nə vaxt oxunur**

- Əvvəlcə [Rəqəmsal sənəd formatları](/concepts/credential-formats) anlayış səhifəsini oxuyun.
- Hansı formatın, protokolun və imza alqoritminin seçildiyini və bunun səbəbini görmək istədikdə.
- Sonra: bayt səviyyəsində təfərrüat üçün [[SPEC-CRED-0002]], sənədin verilməsi üçün [[SPEC-PROTO-0001]], sənədin təqdim edilməsi üçün [[SPEC-PROTO-0002]].

**Qısaca.** Tamga rəqəmsal sənədi ilk növbədə [[t:SD-JWT-VC]] formatındadır; şəxsiyyət sənədi əlavə olaraq [[t:mdoc]] (ISO 18013-5) kimi də verilir. Rəqəmsal sənəd
[[t:OpenID4VCI]] ilə qurumdan rəqəmsal cüzdana gəlir, [[t:OpenID4VP]] ilə rəqəmsal cüzdandan yoxlayan tərəfə ötürülür; imza ES256-dır. Hər rəqəmsal sənəd şəxsin cihazındakı bir
açara bağlanır, beləliklə başqa cihaza köçürülmüş sənəddən istifadə etmək mümkün olmur. Rəqəmsal sənədin özü və məzmunu yalnız rəqəmsal cüzdanda saxlanılır; şəbəkədə
yalnız qurumların səlahiyyəti və ləğv statusu dərc olunur.

---

# Əhatə dairəsi

Bu spesifikasiya etibar qatında [[t:credential|rəqəmsal sənədin]] **daşıyıcı formatını** və **protokollarını**
müəyyən edir. [[SPEC-BC-0001]] "zəncirdə nə var" ([[t:issuer]]/status registry) sualına, bu sənəd isə
"rəqəmsal cüzdandakı sənəd necə görünür və necə ötürülür" sualına cavab verir.

**Dəyişməz prinsip ([[PM-TRUST-0001]]):** Rəqəmsal sənəd və onun məzmunu **rəqəmsal cüzdanda** saxlanılır, zəncirə
**heç vaxt** yazılmır. Zəncir yalnız sənədi verən qurumun səlahiyyətini (registry) və ləğv statusunu
(ləğv siyahısı pointer-i) saxlayır.

Qərarlar [[ADR-0006]] ilə təsbit edilib. Etibar çərçivəsi üzrə iş qeydinin (K bölməsi) rəsmi
qarşılığıdır.

---

# 1. Format qərarları

| Mövzu | Qərar | Əsaslandırma |
|------|-------|---------|
| **Rəqəmsal sənəd formatı (əsas)** | **SD-JWT VC** | Selective disclosure daxilidir, EUDI ARF-in əsas formatıdır, kitabxanalar boldur, JSON-LD-dən xeyli sadədir |
| **Rəqəmsal sənəd formatı (ikinci)** | **mdoc / ISO 18013-5** — **şəxsiyyət attestation-ı üçün aktivdir** (D-CRED-5, [[ADR-0013]]); digər tiplər 2-ci fazada | Safari/iOS Digital Credentials API yalnız mdoc dəstəkləyir; ARF PID presedenti; fiziki/oflayn təqdimat (BLE, dövlət mərhələsi) |
| **Vermə protokolu** | **OpenID4VCI** | Faktiki standartdır; qurumun mövcud OIDC infrastrukturuna uyğunlaşır |
| **Təqdimat protokolu** | **OpenID4VP** | Eyni ekosistem, yoxlayan tərəfin inteqrasiyası asandır |
| **İmza alqoritmi** | **ES256 (P-256)** | Mobil secure element və HSM-lərdə universal dəstək |
| **Holder binding** | `cnf` + cihaz açarı — **məcburi** | §3; holder binding boşluğunun yeganə həlli |
| **Ləğv** | **Token Status List** (bitstring) | [[SPEC-BC-0001]] §5 ilə eynidir; siyahı off-chain, pointer on-chain |
| **Korrelyasiyaya qarşı** | Toplu sənəd vermə (birdəfəlik nüsxələr) — 2-ci faza | Pilotda təxirə salınır; arxitekturada yer ayrılır |

`did:tamga` [[t:pseudonym]] profili (SPEC-ID-0001) və X.509 sənədi verən qurum identifikatoru ([[SPEC-ID-0002]])
bu formatların daxilinə yerləşdirilir (sənədi verən qurum = X.509; [[t:holder]] = psevdonim açarı).

---

# 2. SD-JWT VC strukturu

SD-JWT VC üç hissədən ibarətdir:

```
<Issuer-signed JWT> ~ <Disclosure 1> ~ <Disclosure 2> ~ ... ~ <Key Binding JWT>
```

- **Issuer-signed JWT:** sənədi verən qurum tərəfindən ES256 ilə imzalanmış nüvə. `iss` = sənədi verən qurumun
  identifikatoru (X.509 `issuerId`-ə həll olunur, [[SPEC-ID-0002]]); [[t:selective-disclosure]] ilə açıqlana bilən
  claim-lər **[[t:salted-hash]]** kimi (`_sd` massivi) yerləşdirilir.
- **Disclosure-lar:** hər [[t:disclosure]] `[salt, claim_adı, değer]` — sənəd sahibi yalnız təqdim etmək
  istədiklərini əlavə edir; qalanları sənədi verən qurumun imzasını pozmadan gizli qalır.
- **Key Binding JWT ([[t:KB-JWT]]):** sənəd sahibinin cihaz açarı ilə imzaladığı, təqdimat anına xas
  hissə (§3).

Sənədi verən qurumun məcburi claim-ləri: `iss`, `iat`, `vct` (sənəd tipi), `cnf` (sənəd sahibinin public
key-i), `status` (Token Status List pointer-i). `exp` sənəd tipinə görə müəyyən edilir (tələbə sənədi
üçün qısa TTL, diplom üçün uzun).

> **Məlumatların minimallaşdırılması:** TCKN kimi identifikatorlar yalnız zəruri olduqda və selective disclosure ilə açıqlana bilən
> claim kimi daxil edilir; [[t:verifier]] siyasəti ([[PM-ASSUR-0001]]) bunları "tələb edilməyənlər" siyahısına
> sala bilər.

---

# 3. Holder Binding — məcburi (kritik təhlükəsizlik qərarı)

## Problem: "universitet ideyasındakı gizli səhv"

Yanlış fərziyyə: *"Tələbə universitetin təsdiqi ilə rəqəmsal sənəd alırsa, həmin tələbə real
şəxsdir."* Bu **natamamdır.** Universitet tələbənin *mövcud olduğunu* təsdiqləyir; lakin yoxlayan tərəf üçün **həmin
rəqəmsal cüzdanın həmin tələbəyə məxsus olduğunu** təsdiqləmir. Hücumlar:

- Tələbə öz rəqəmsal sənədini dostunun cüzdanına yazdırır.
- OBS şifrəsi oğurlanmış hesabdan sənəd başqasının cüzdanına yazılır.
- Bir şəxs eyni rəqəmsal sənədi bir neçə cüzdana yazdırıb satır.

Bu halda sistem **səssizcə yalan deyir** — bu, açıq şəkildə xəta verməkdən daha pisdir. Ədəbiyyatda
bu, **[[t:holder-binding]]** problemi adlanır və pilotu uğursuzluğa düçar edə biləcək yeganə real təhlükəsizlik boşluğudur.

## Həll: `cnf` key binding — istisnasız məcburi

Hər rəqəmsal sənəd verilmə anında sənəd sahibinin **cihaz açarına** bağlanır: issuer-signed
JWT-yə `cnf` (confirmation) sahəsi kimi sənəd sahibinin public key-i yerləşdirilir. Təqdimat zamanı sənəd sahibi
yoxlayan tərəfin [[t:nonce]]-unu ehtiva edən **KB-JWT**-ni həmin şəxsi açarla imzalayır. Yoxlayan tərəf:

1. Sənədi verən qurumun imzasını yoxlayır (sənədi verən qurum rəqəmsal sənədin `iat` anında qəbul edilə bilən idimi
   → [[SPEC-BC-0001]] `isCredentialAcceptable`; `isValidIssuer` sənədin verilməsi ilə bağlı sualdır — 1.0.3).
2. `cnf`-dəki açarın KB-JWT-ni imzaladığını yoxlayır → **rəqəmsal sənədi təqdim edən tərəf
   verilmə anında bağlanmış şəxsi açara nəzarət edir.**
3. Nonce + audience + `iat` təzəliyini yoxlayır (replay-in qarşısının alınması).

Açar cihazın **secure element**-ində yaradılır (Secure Enclave/StrongBox), heç vaxt xaricə
ixrac edilə bilməz → rəqəmsal sənəd başqasına ötürülə bilməz.

### `cnf` nəyi sübut etmir (əhatə hüdudu)

Bu fərq kritikdir və asanlıqla şişirdilir. `cnf` + KB-JWT bunu sübut edir:

> Təqdimatdakı sənəd sahibi = sənədin verildiyi sənəd sahibi (eyni açara nəzarət edilir).

Bunu isə **sübut etmir:**

> Qarşıdakı insan rəqəmsal sənəddə adı göstərilən şəxsdir.

`cnf` **cihaz açarına** bağlayır, **insana** deyil. Sənəd sahibi cihazını və PIN-ini
başqasına verərsə, həmin şəxs etibarlı imzalı və etibarlı key-binding-li rəqəmsal sənəd
təqdim edir; yoxlama zəncirinin heç bir addımı xəta vermir.

Yəni `cnf` yuxarıdakı üç hücumdan **ilk ikisini** (rəqəmsal sənədin əvvəldən yanlış cüzdana
yazılması) və ötürülə bilənliyi aradan qaldırır; **könüllü cihaz paylaşımını** aradan qaldırmır.

**Şəxsiyyət uyğunlaşdırmasını nə həll edir:** birləşmiş təqdimat — eyni OpenID4VP sorğusunda rəqəmsal sənəd
və dövlət şəxsiyyət sənədi ([[t:PID]]) birlikdə, **eyni `cnf` açarına** bağlı şəkildə
təqdim edilir; şəxsiyyəti PID daşıyır. İlk mərhələdə PID yoxdur, buna görə şəxsiyyət uyğunlaşdırması
**prosedur xarakterlidir** (yoxlayan tərəf `family_name`/`given_name`/`birth_date` sahələrini ayrıca
görülən şəxsiyyət sənədi ilə müqayisə edir). Bu, bu gün kağız sənədlə edilənlə eyni
etibarlılıq səviyyəsindədir — geriləmə deyil, təxirə salınmış təkmilləşdirmədir. Təfərrüat:
[[SPEC-SCHEMA-0002]] §1.2.

## Sənədin verilməsi axınında holder binding (təminat səviyyəsinə təsiri)

| Üsul | Necə | Yaratdığı sənəd sahibi səviyyəsi ([[PM-ASSUR-0001]]) |
|--------|-------|---------------------------------------------|
| **Məsafədən bağlama** | Tələbə OBS-yə özü daxil olur → OIDC/OpenID4VCI ilə rəqəmsal cüzdanın public key-i sənədi verən quruma sübut edilir → `cnf` bağlanır | T1/T2 (OBS təhlükəsizliyi səviyyəsində; 2FA ilə yaxşılaşır) |
| **Üzbəüz bağlama** | Qurumun masasında əməkdaş fiziki şəxsiyyət sənədini görür → rəqəmsal cüzdandakı QR-u oxudur → bağlama | T2/T3 (qurum = Qeydiyyat Orqanı) |

---

# 4. Wallet Unit Attestation (WUA)

Rəqəmsal cüzdanın özü də bir sənəd daşıyır. Yoxlayan tərəf gec-tez bunu soruşur: *"Bu real
Tamga cüzdanıdır, yoxsa kiminsə yazdığı saxta müştəri proqramı?"*

[[t:WUA]] bunları bəyan edir: rəqəmsal cüzdanın versiyası, açarın **aparat təminatında** saxlanıldığı, PIN-in aktiv
olduğu, cihazın root/jailbreak edilmədiyi, [[t:wallet-provider]] identifikatoru.

- WUA cüzdan provayderi (ilk mərhələdə Tamga) tərəfindən imzalanır; provayder zəncirdə
  sənədi verən/[[t:RP]] kimi qeydiyyatdadır.
- **Əvvəldən daxil edilməsə, sonradan əlavə etmək ağrılıdır** — bütün mövcud rəqəmsal cüzdanları miqrasiya etmək lazım gəlir.
  Pilotda məzmun sadə saxlanılır, lakin **sahə və axın əvvəldən açılır.**
- WUA sənəd sahibinin təminat səviyyəsinin "autentifikator gücü" ölçüsünü ([[PM-ASSUR-0001]] eIDAS məntiqi)
  qidalandırır: proqram açarı → aşağı; aparat + PIN → yüksək.

**Tətbiq edilən profil (2026-09-24, DB-16):**

| Sahə | Dəyər |
|---|---|
| Format | JWT, `typ: oauth-client-attestation+jwt`, `alg: ES256`, `x5c` = Cüzdan provayderinin sertifikatı (siyahı mərhələsində: `wallet-provider`; siyahıda `lotl.wallet_providers[].wua_signing_keys`) |
| Claim-lər | `iss` (provider URL), `sub` (nümunə açarının JWK thumbprint-i), `cnf.jwk` (P-256 **nümunə açarı** — sənəd açarlarından ayrıdır), `wallet_name`, `wallet_version`, `solution_id`, `key_storage` (`software` \| `secure_enclave` \| `strongbox` \| `wscd`), `user_auth`, `security_level` (W1-DEMO/W2/W3), `iat`, `exp` (30 gün) |
| Ötürmə (sənədin verilməsi) | OpenID4VCI token sorğusunda `OAuth-Client-Attestation` + `OAuth-Client-Attestation-PoP` (PoP: `iss` = WUA `sub`, `aud` = sənədi verən qurum, `jti`, iat ±300 s) — [[SPEC-PROTO-0001]] §11.1, PR11 |
| Provayder tərəfi | Rəqəmsal cüzdanı təqdim edən təşkilatın cüzdan provayderi; şəbəkə onu idarə etmir, siyahıya salır ([[ADR-0042]]). Tamga Wallet-ın provayderini rəqəmsal cüzdanın operatoru `provider.tamgawallet.com`-da idarə edir (canlı; etibar siyahısında `TAMGA-WP-1`, `ACTIVE`); cüzdan vahidini yalnız cihaz sübutu ilə qeydiyyata alır |
| Təqdimat | WUA yoxlayan tərəfə göndərilmir; yoxlayan tərəf lazım gələrsə onu DCQL ilə ayrıca tələb edir (dövlət mərhələsi) |

---

# 5. Ləğv (həvalə)

Rəqəmsal sənədin [[t:revocation|ləğvi]] bu spesifikasiyada **yenidən müəyyən edilmir**; [[SPEC-BC-0001]] §5
**Token Status List** ([[t:status-list|ləğv siyahısı]]) profilinə həvalə olunur:

- Issuer-signed JWT-dəki `status` claim-i siyahının URI + index-ini göstərir.
- Siyahı off-chain saxlanılır (sənədi verən qurum host edir, imzalı/versiyalı); zəncirdə yalnız URI + hash +
  versiya + bitmap ([[SPEC-BC-0001]] `StatusList`).
- Məxfilik: `listSize >= 100.000`, təsadüfi index paylanması ([[SPEC-BC-0001]]).

**Korrelyasiyaya qarşı (2-ci faza):** Eyni status index-ini müxtəlif yoxlayan tərəflərə göstərmək
izləmə vektorudur. Həll yolu **toplu rəqəmsal sənəd verilməsidir** (birdəfəlik sənəd nüsxələri); pilotda
təxirə salınır, formatda bunun üçün yer artıq ayrılıb (`cnf` başına bir neçə nüsxə yaradıla bilər).

---

# 6. Başdan-başa axın

```
Issuance (OpenID4VCI):
  1. The holder's wallet receives the issuer's credential offer
  2. The wallet generates/selects the device key → presents the public key (cnf candidate)
  3. The issuer verifies holder binding (remote OIDC / in-person desk)
  4. The issuer signs the SD-JWT VC with ES256, embedding cnf + status index
  5. A status index is reserved (SPEC-BC-0001) — NO content is written to the chain

Presentation (OpenID4VP):
  6. The verifier sends a presentation request (nonce + audience + requested claims)
  7. The holder selects only the required disclosures + signs the KB-JWT
  8. Verifier: issuer signature + cnf/KB-JWT + status + WUA + assurance policy
     (PM-ASSUR-0001) → accept/reject
```

Heç bir mərhələdə fərdi məlumatlar zəncirə yazılmır; yoxlama üç view çağırışı ilə (sənədi verən qurum/status/
recognition, [[SPEC-BC-0001]] §6) ödənişsiz həyata keçirilir.

---

# 7. Zəncirdən asılı olmama məhdudiyyəti

Bu format və protokollar **zəncirdən asılı olmadan** işləyir: yoxlayan tərəfin kitabxanası
`TrustedListProvider` interfeysi vasitəsilə sənədi verən qurumları müəyyən edir və arxasında faylın (ilk mərhələdə
imzalı [[t:trust-list]]) yoxsa zəncirin (dövlət mərhələsində registry) olduğunu bilmir. Bu, pilotun Besu-nu
gözləməməsini təmin edir (bax: [[ARCH-0001]] ilk mərhələ). Qərar [[ADR-0006]] + [[ADR-0001]] xəttindədir.

---

# Təhlükəsizlik və məxfilik qeydləri

- **Holder binding istisnasız məcburidir** — söndürülərsə, sistem səssizcə yalan deyir.
- **Açar avadanlıqdadır** (Secure Enclave/StrongBox); proqram açarı qəbul edilmir (WUA
  bunu bəyan edir).
- **Selective disclosure standart olaraq** — yalnız lazımi claim; məlumatların minimallaşdırılması.
- **Toplu rəqəmsal sənəd verilməsi** korrelyasiya tədbiri 2-ci fazadadır; format bu gün buna yer ayırır.
- İstehsaldan əvvəl **müstəqil təhlükəsizlik auditi** (KB-JWT replay, disclosure aktuallığı,
  WUA saxtakarlığı) məcburidir.

---

# Açıq məsələlər

1. `vct` (sənəd tipi) registry-sinin sxem idarəetməsi ([[SPEC-BC-0001]] sxem registry-si
   ilə uyğunlaşdırılması).
2. mdoc/ISO 18013-5 profilinin tam təsviri (2-ci faza).
3. Toplu rəqəmsal sənəd verilməsinin tətbiq vaxtı və açar/nüsxə idarəetməsi (→ korrelyasiya auditi).
4. WUA məzmununun yekun sahələr toplusu və cihaz [[t:attestation]] mənbələri (Play Integrity /
   App Attest) ilə əlaqə.

---

# Əlaqəli sənədlər

- [[PM-ASSUR-0001]] — assurance səviyyələri ([[t:LoA]]); bu format həmin səviyyələrin daşıyıcısıdır.
- [[PM-TRUST-0001]] — rəqəmsal sənəd heç vaxt zəncirdə olmur.
- [[SPEC-BC-0001]] — sənədi verən qurumların registry-si (imza yoxlama mənbəyi) + Token Status List (ləğv).
- [[SPEC-ID-0002]] — sənədi verən qurumun X.509 kimliyi (`iss` → `issuerId`).
- SPEC-ID-0001 — sənəd sahibinin psevdonim açarı (`cnf`).
- [[ADR-0006]] — bu format qərarlarının qəbul qeydi.
- ACA-ID-0001 — DID/VC/seçici paylaşım mexanikası (tədris əsası).
- [[RS-EIDAS-0001]] — SD-JWT VC / OpenID4VCI-VP-nin EUDI ARF-dəki yeri.

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

