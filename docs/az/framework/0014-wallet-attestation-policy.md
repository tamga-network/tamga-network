---
document_id: FW-POL-0002
title: "Cüzdan sübutu siyasəti (WIA və KA)"
status: Active
version: 1.0.0
created: 2026-10-11
last_updated: 2026-10-16
summary: >
  Tamga etibar siyahısındakı hər bir cüzdan provayderinin cüzdan nüsxəsi sübutunu (WIA) və açar sübutunu (KA) necə verdiyini, hansı şərtlərdə ləğv etdiyini və ləğvi necə dərc etdiyini bir yerdə toplayan və Avropa İttifaqı (Aİ) ARF (VCR_05, WURevocation_03, WURevocation_09a) və ETSI TS 119 471 bənd 6–7 ilə uyğunlaşdıran siyasət. Şəbəkə rəqəmsal cüzdan idarə etmir; bu sənəd şəbəkənin siyahıdakı cüzdan provayderlərindən gözlədiyi minimum siyasətdir və ADR-0025, ADR-0047, cüzdan spesifikasiyası və Tamga Rulebook qaydalarından tərtib edilib.
translation_of: FW-POL-0002
source_version: "1.0.0"
---

# 1. Əhatə dairəsi və status

Tamga Network heç bir rəqəmsal cüzdanı və cüzdan provayderini idarə etmir; rəqəmsal cüzdanları etibar siyahısındakı qeydləri (`wallet_providers[]`) vasitəsilə
tanıyır ([[ADR-0042]]). Bu siyasət siyahıdakı hər bir [[t:wallet-provider|cüzdan provayderinin]] verdiyi iki sübut üçün şəbəkənin minimum
qaydalarını toplayır:

- **Cüzdan nümunəsi sübutu ([[t:WIA]])** — rəqəmsal cüzdan tətbiqinin (Wallet Instance) özünü sənədi verən quruma təqdim etdiyi qısa ömürlü sübut;
- **Açar sübutu (KA)** — rəqəmsal sənəd açarlarının hansı təhlükəsiz aparatda saxlandığını və istifadəçini yoxlayan tərəfin hansı yoxlama üsulu ilə qorunduğunu göstərən sübut.

İkisi birlikdə Aİ-dəki cüzdan vahidi sübutunun (WUA) qarşılığıdır. Siyasət qərar vermir: qaydalar [[ADR-0025]], [[ADR-0047]], [[SPEC-WALLET-0001]],
[[SPEC-PROTO-0001]] §11.1, Tamga Rulebook-un RB-WP və RB-AP qaydaları və Trust Framework-dən (Əlavə A) tərtib edilib. Hər cüzdan provayderi
bu qaydalara əməl edir; öz istismar təfərrüatlarını (məs. quraşdırma, dəstək, bildiriş kanalları) öz siyasətində yazır.

# 2. Cüzdan vahidinin aktivləşdirilməsi

| Qayda | Mənbə |
|---|---|
| Rəqəmsal cüzdan ilk quraşdırmada provayderdə bir **vahid açarı** qeydiyyata alır; bu açar yalnız rəqəmsal cüzdan ilə provayder arasında istifadə olunur, heç bir quruma göstərilmir; vahidlə bağlı sorğular vahid açarı ilə imzalanır | [[ADR-0025]] K1 |
| Vahid qeydi yalnız vahid açarının barmaq izini, həlli və versiyanı, qeydiyyat vaxtını, ləğv statusunu və vahidə verilmiş WIA ləğv siyahısı girişlərini saxlayır; **fərdi məlumatlar saxlanılmır** | [[ADR-0025]] K1, WIA2 |
| Sənəd sahibinin açarları cihazın təhlükəsiz zonasında (W2) və ya sertifikatlaşdırılmış təhlükəsiz aparatda (W3) yaradılır; xaricə ixrac edilə bilməz, hər hansı toxumdan törədilmir; proqram açarlı (W1) rəqəmsal cüzdana rəqəmsal sənəd verilmir | RB-WP-01, [[SPEC-WALLET-0001]] WL1, WL3 |
| Cüzdan provayderi istifadəçi adından bərpa açarı saxlamır | RB-WP-07 |
| **Cihaz sübutu:** W3 səviyyəsində provayder vahidi aktivləşdirərkən və W3 bəyan edən hər KA-dan əvvəl platformanın cihaz sübutunu (Apple App Attest, Android açar attestasiyası, Play Integrity) yoxlayır; yoxlanılmamış cihaza W3 KA vermir. W2-də cihaz sübutu könüllüdür | RB-WP-17, [[ADR-0047]] K5 |
| Aktivləşdirmə zamanı telefonsuz ləğv yolu qurulur: provayder şəxsin telefonu olmadan vahidi ləğv edə biləcəyi bir yol təqdim edir; bu yol istifadəçi hesabı tələb etmir (məs. bir dəfə göstərilən ləğv sirri, provayderdə isə yalnız onun yavaş heşi) | RB-WP-15, [[ADR-0047]] K3 |

# 3. WIA-nın verilməsi

| Qayda | Mənbə |
|---|---|
| Format: OpenID4VCI 1.0 Əlavə E (`oauth-client-attestation+jwt`); Aİ TS3 §2.3.1 sahələri: `sub`, `wallet_name`, `wallet_version`, `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk` | [[ADR-0025]] K2 |
| WIA cüzdan versiyasını, açarın aparatda olduğunu və PIN və ya biometrikanın aktiv olduğunu bəyan edir | RB-WP-02 |
| WIA ümumi müştəri sübutu formatındadır (OAuth attestation-based client authentication -07): provayder `iss` və `iat` göndərir; sənədi verən qurum hər müştəri sübutunu vahid yolla WIA kimi yoxlayır (köhnə WUA yolu çıxarıldı), `iss` tələb etmir, sübutda `iat` olmadıqda buna yol verir, PoP-da `iat` məcburidir; `client_status` olmadıqda sənədi verən qurumun `clientStatus` ayarı tətbiq olunur (`optional` standart, `required`: şəxsiyyət xidməti) (paketlər 0.5.2). WIA-nın `cnf` açarının DPoP açarı olması qaydası tətbiq edilmir: Aİ TS3 1.5.2 bu 1.5.1 qaydasını geri götürdü (2026-10-13 düzəlişi) | [[ADR-0025]] 2026-10-13 qeydi |
| Ömrü **24 saatdan qısadır**; `client_status.exp` ən azı 31 gün irəlidədir | [[ADR-0025]] K2, WIA1 |
| **Hər rəqəmsal sənəd əməliyyatında yeni WIA**: yeni sahiblik sübutu (PoP) açarı və yeni, bir-biri ilə əlaqələndirilə bilməyən ləğv siyahısı girişi. Sənədi verən hər qurum üçün təkrar istifadə yoxdur; beləliklə provayder rəqəmsal cüzdanın neçə qurumla əlaqə saxladığını öyrənmir | [[ADR-0025]] K2, WIA1 |
| WIA provayderin etibar siyahısında qeydiyyatda olan imza açarı ilə imzalanır | RB-WP-02, [[SPEC-TRUST-0001]] |

# 4. KA-nın verilməsi

| Qayda | Mənbə |
|---|---|
| Format: OpenID4VCI 1.0 Əlavə D (`typ` `key-attestation+jwt`); Aİ TS3 §2.3.2 sahələri: `attested_keys`, `key_storage`, `user_authentication` (ISO 18045 səviyyələri), `certification`, `key_storage_status {status, exp}` | [[ADR-0025]] K3 |
| **Səviyyə həqiqəti əks etdirir:** KA-dakı açar anbarı səviyyəsi yoxlanılmış vəziyyətə əsaslanır; yoxlanılmamış bəyan KA-ya yazılmır. Sertifikatsız aparat üçün sertifikat məlumatı boş qalır | [[ADR-0025]] WIA3 |
| Bir KA bir paketdəki bütün rəqəmsal sənəd açarlarını daşıyır; hər açar yalnız bir KA-da yer alır; KA bir dəfə istifadə olunur; rəqəmsal sənəd sorğusunun sübutu (proof) `attested_keys[0]` ilə imzalanır və başlığında KA daşıyır | [[ADR-0025]] K3 |
| KA ləğvi **açar anbarı növü üzrə ortaq girişlə** həyata keçirilir (Aİ TS3 Seçim 1): proqram anbarı, Secure Enclave, StrongBox … hər növün bir girişi var; vahidin identifikatoru KA-dan çıxarıla bilməz | [[ADR-0025]] K3 |

# 5. Ləğv şərtləri

## 5.1 WIA

| Şərt | Nəticə | Mənbə |
|---|---|---|
| Şəxs rəqəmsal cüzdanda "Bu cüzdanı ləğv et" seçir (cihazın ötürülməsi, satış) | Vahid və ona verilmiş bütün WIA girişləri ləğv edilir | [[ADR-0025]] K4 |
| Şəxs rəqəmsal cüzdanı sıfırlayıb məlumatlarını silir | Vahid ləğv edilir (WIA bitləri), sonra qeyd silinir | [[SPEC-WALLET-0001]] §7.6 |
| Tək bir cüzdan vahidində pozuntu aşkarlanır | Həmin vahid ləğv edilir | RB-WP-11 |
| Cüzdan həllində (bir versiyada) boşluq aşkarlanır | Həmin versiyanın cüzdan sübutları ləğv edilir; sənədi verən qurumlar yeni rəqəmsal sənəd verərkən onları rədd edir | RB-WP-11, Əlavə A §4.6 |
| Vahid ləğv edilir | Həmin vahidə verilmiş bütün WIA girişləri ləğv olunur | [[ADR-0025]] WIA2 |
| Telefon itir və ya oğurlanır; şəxs telefonsuz ləğv yolundan (§2) istifadə edir | Vahid və ona verilmiş bütün WIA girişləri ləğv edilir; şəxsiyyət xidməti həmin vahiddəki rəqəmsal sənədləri 24 saat ərzində ləğv edir; qurum sənədləri ləğv edilmir, cihaz açarına bağlı olduqları üçün istifadə edilə bilmir | RB-WP-15, RB-AP-ID-12, [[ADR-0047]] K1, K3 |

İtirilmiş və ya oğurlanmış telefondan ləğv **istifadəçi hesabı tələb etmir** ([[ADR-0047]] K3). Aİ WIAM_06-nın nəzərdə tutduğu hesab əvəzinə
aktivləşdirmədə qeydə alınan ləğv sirri istifadə olunur; "şəxsin açıq istəyi" və "aktivləşdirmədə qeydiyyat" şərtləri (WURevocation_10)
ödənilir. Tamga Wallet bunu bağlama kodu və "Telefonumu itirdim" səhifəsi ilə həyata keçirir.

## 5.2 KA

| Şərt | Nəticə | Mənbə |
|---|---|---|
| Açar anbarı və ya təhlükəsiz aparat **növünün** etibarlılığını pozan boşluq və ya pozuntu aşkarlanır | Provayder həmin növün KA girişini ləğv edir; həmin növdəki açarlarla yeni rəqəmsal sənəd verilmir | [[ADR-0025]] K3, Əlavə A §4.6, Aİ ARF WURevocation_09a |
| Bir versiyanın və ya tək bir vahidin pozuntusu | §5.1-dəki kimi WIA ilə; KA girişi vahidə deyil, növə aiddir | [[ADR-0025]] K3 |

## 5.3 Ləğv barədə şəxsə bildiriş

| Qayda | Mənbə |
|---|---|
| Provayder şəxsin cüzdan vahidinin ləğv edildiyini **rəqəmsal cüzdandan kənarda** öyrənə biləcəyi ən azı bir yol təqdim edir; bu yol fərdi məlumatların toplanmasını məcburi etmir | RB-WP-16, Aİ WURevocation_16, [[ADR-0047]] K4 |
| Provayder vahidi öz qərarı ilə (təhlükəsizlik boşluğu) ləğv edibsə, bu yol ən gec 24 saat ərzində ləğvin səbəbini hamının başa düşəcəyi dildə, boşluğun texniki təfərrüatını və ya ona keçidi, hansı funksiyaların işlədiyini və şəxsin yenidən işləyən rəqəmsal cüzdana necə sahib olacağını göstərir | RB-WP-16, Aİ WURevocation_14 |
| Rəqəmsal cüzdanın özü də şəxsə xəbər verə bilər; bu, cüzdandan kənar yolu əvəz etmir | Aİ WURevocation_16 |

Tamga Wallet bu qaydanı hamıya açıq təhlükəsizlik bildirişləri və bağlama kodu ilə açılan, məlumat saxlamayan "Cüzdanımın vəziyyəti" səhifəsi ilə
yerinə yetirir.

# 6. Ləğvin dərc edilməsi

| Qayda | Mənbə |
|---|---|
| Provayder iki Token Status List dərc edir: WIA girişləri və KA növləri. Siyahıları etibar siyahısında qeydiyyatda olan öz açarı ilə imzalayır | [[ADR-0025]] K4 |
| WIA və KA ləğv siyahılarının hər biri ən azı 10.000 girişdən ibarətdir; girişlər vahidlə əlaqələndirilə bilməyəcək şəkildə paylanır. Sənədi verən qurum bu həddən aşağı olan siyahıya əsaslanan WIA və ya KA-nı qəbul etmir | [[ADR-0025]] K2, K4 və 2026-10-13 qeydi; (Aİ) 2024/2979 saylı İcra Reqlamenti, Əlavə Ib |
| Siyahı ünvanları hər WIA-da (`client_status`) və KA-da (`key_storage_status`) yer alır; provayderin ünvanı etibar siyahısındakı qeydindədir | [[ADR-0025]], [[SPEC-TRUST-0001]] |

# 7. Sənədi verən qurumların yoxlaması

| Qayda | Mənbə |
|---|---|
| Sənədi verən qurum rəqəmsal sənəd verməzdən əvvəl WIA-nı və KA-nı `wallet_providers[]` siyahısına əsasən yoxlayır və təhlükəsiz aparat səviyyəsinin növün tələbinə cavab verdiyini nəzarətdən keçirir | RB-AP-10 |
| PAR və token son nöqtələrində WIA: imza, provayder açarının siyahıda olması, müddət, PoP (`cnf`), `client_status` ləğv edilməyib. Sənəd son nöqtəsində KA: imza, proof-un `attested_keys[0]` ilə imzası və nonce, `key_storage_status` ləğv edilməyib, `key_storage` səviyyəsi qurumun minimum həddinə cavab verir | [[ADR-0025]] K5 |
| Sənədi verən qurum ləğv edilmiş WIA və ya KA ilə **rəqəmsal sənəd vermir** | [[ADR-0025]] WIA4 |
| Qurumun açar anbarı tələbi onun təqdimat məlumatlarında elan edilir (`key_attestations_required {key_storage, user_authentication}`) | [[ADR-0025]] K5 |
| Qurum minimum ləğv statusunun saxlanma müddətini tələb edirsə, bunu elan edir: KA üçün `key_attestations_required.preferred_key_storage_status_period`, WIA üçün yuxarı səviyyədə `preferred_client_status_period` (saniyə). Rəqəmsal cüzdan tələbə cavab verməyən KA göndərmir, saxlanma müddəti qısa qalan WIA və KA əvəzinə provayderdən daha uzununu istəyir; provayder verə bilmirsə, qurum rəqəmsal sənədin müddətini saxlanma müddəti ilə məhdudlaşdırır (zəncirvari ləğv tətbiq edən qurumda) | Aİ ARF WUA_05a, WUA_32, ISSU_12c; Aİ TS3 §2.4 |

# 8. Hadisələr və bildiriş

- Rəqəmsal cüzdan həllindəki zəiflik kritik və ya yüksək əhəmiyyətli hadisədir: kritik hadisə ən geci 4 saat, yüksək əhəmiyyətli hadisə ən geci 24 saat ərzində
  sxem sahibinə bildirilir (RB-GEN-09, Əlavə A §4.6).
- Rəqəmsal cüzdan "bu rəqəmsal cüzdan Tamga etibar siyahısındadır" görünüşünü və "açarlarım haradadır" izahını təqdim edir (RB-WP-10).
- Provayderin etibar siyahısındakı qeydi dayandırılarsa və ya çıxarılarsa, sənədi verən qurumlar həmin provayderin sübutlarını qəbul etmir;
  yalnız `ACTIVE` qeydin `ACTIVE` açarlarından istifadə olunur ([[SPEC-TRUST-0001]]).

# 9. ETSI TS 119 471 bənd 6–7 ilə uyğunlaşdırma (WURevocation_03)

Aİ cüzdan provayderinin WIA və KA siyasətinin ETSI TS 119 471-in (V1.1.1, 2025-05; EAA xidmət provayderlərinin siyasət və
təhlükəsizlik tələbləri) 6-cı və 7-ci bəndlərinə uyğun olmasını tələb edir. Aşağıdakı cədvəl həmin bəndləri sətir-sətir qarşılayır; "EAA" əvəzinə "WIA və
KA", "EAASP" əvəzinə "cüzdan provayderi" oxunur. Öhdəliklər siyahıdakı hər bir cüzdan provayderinə aiddir; provayder onları necə
yerinə yetirdiyini öz fəaliyyət bəyannaməsində yazır. "Pilotdan əvvəl" işarəli bəndlər siyahı mərhələsində hədəfdir, real şəxslərlə
pilotdan əvvəl isə məcburidir. TS 119 471-in EN 319 401-ə etdiyi ümumi istinadlar (məs. "EN 319 401 bənd 7.2 tətbiq olunur")
provayderin EN 319 401-ə uyğun olması deməkdir.

| TS 119 471 | Mövzu | Bu siyasətdə / provayderin öhdəliyi |
|---|---|---|
| 5 | Risklərin qiymətləndirilməsi (EN 319 401 §5) | Provayder WIA və KA xidməti üçün yazılı risk qiymətləndirməsi aparır; onu ildə bir dəfə və böyük dəyişiklik olduqda yeniləyir |
| 6.1.1 | Fəaliyyət bəyannaməsi; ləğv mexanizminin bəyannamədə təsvir edilməsi (REQ-EAASP-6.1-02) | Provayder hamıya açıq fəaliyyət bəyannaməsi dərc edir; bəyannamə bu siyasətə istinad edir və ləğv mexanizmini (§5, §6) təsvir edir |
| 6.1.2 | Provayder səviyyəsində əlaqələndirilə bilmə; yoxlayan tərəflərlə əməkdaşlıq edərək şəxsi izləməmək | Hər əməliyyat üçün yeni WIA və bir-biri ilə əlaqələndirilə bilməyən ləğv girişi; KA girişi növə aiddir (§3, §4). Provayder vahid ilə giriş arasındakı uyğunluğu heç bir sənədi verən quruma və ya yoxlayan tərəfə vermir və bunu bəyannaməsində yazır ([[ADR-0025]] WIA1, WIA2) |
| 6.2 | Şərtlər və müddəalar; qəbulun iradi hərəkətlə və sübut edilə bilən şəkildə olması; qeydlərin saxlanma müddəti | Provayder istifadə şərtlərini aktivləşdirmədən əvvəl göstərir; qəbul rəqəmsal cüzdanda iradi hərəkətlə baş verir. Qəbulun sübutu **fərdi məlumatlar olmadan** saxlanılır (vahid qeydində şərtlərin versiyası və qəbul vaxtı). Saxlanma müddəti şərtlərdə yazılır |
| 6.2 (REQ-EAASP-6.2.4-05) | Fərdi məlumatlardan necə istifadə ediləcəyinin əvvəlcədən izah edilməsi və razılıq | Vahid qeydi fərdi məlumat saxlamır ([[ADR-0025]] WIA2). Provayder istəyə bağlı fərdi məlumat (məs. əlaqə e-poçtu) toplayarsa, əvvəlcə məlumatlandırır və açıq razılıq alır |
| 6.3 | İnformasiya təhlükəsizliyi siyasəti (EN 319 401 §6.3) | Provayderin rəhbərliyi tərəfindən təsdiqlənmiş, ildə bir dəfə nəzərdən keçirilən informasiya təhlükəsizliyi siyasəti var |
| 6.4 | Sübut siyasəti: sübutun nəyi bəyan etdiyi, format, yoxlama yolu, etibar çərçivəsi, sahiblik sübutu | Bu siyasət və provayderin bəyannaməsi: WIA və KA-nın bəyanları və formatı §3–§4; etibar çərçivəsi Tamga ARF; yoxlama §7; sahiblik sübutu `cnf` və `attested_keys[0]` |
| 7.1.1 | Sübut vermə və ləğv qərarlarında müstəqillik; kommersiya təzyiqindən uzaqlıq; qərəzsizliyi qoruyan sənədləşdirilmiş struktur | Provayder ləğv qərarını (xüsusilə özünün başlatdığı ləğvi) kimin hansı meyarla verdiyini yazılı şəkildə müəyyən edir; qərar kommersiya münasibətlərindən təsirlənmir |
| 7.1.2, 7.2, 7.3 | Vəzifələrin ayrılması, insan resursları, aktivlərin idarə edilməsi (EN 319 401) | EN 319 401-ə əsasən; etibarlı rollar müəyyən edilir |
| 7.4 | Giriş nəzarəti: sübut verdirə bilən hər hesabda çoxfaktorlu autentifikasiya; daimi monitorinq və həyəcan siqnalı; autentifikasiya cəhdlərinin qeydə alınması | Provayder WIA və ya KA verdirə bilən, vahidi ləğv edə bilən və ya imza açarına çıxışı olan hər bir əməliyyat hesabında çoxfaktorlu autentifikasiyadan istifadə edir; icazəsiz giriş cəhdlərini izləyir və qeydə alır (qeyddə fərdi məlumat yoxdur, RB-GEN-06) |
| 7.5.1–7.5.2 | Açarların yaradılması: təhlükəsiz mühit, ən azı ikili nəzarət, sənədləşdirilmiş mərasim və mərasim hesabatı, TS 119 312 alqoritmləri | WIA, KA və ləğv siyahısı imza açarları ES256-dır (RB-AP-04). **Pilotdan əvvəl:** açarlar ən azı iki nəfərin iştirak etdiyi sənədləşdirilmiş mərasimlə yaradılır; mərasim hesabatı (rollar, sübut, tarix, açar inventarı və barmaq izləri) saxlanılır |
| 7.5.3 | Açarların qorunması: EAL 4+ və ya FIPS 140-2/140-3 Səviyyə 3 təhlükəsiz kriptoqrafik qurğu; ehtiyat nüsxələr eyni qorunma altında; qurğu istismardan çıxarıldıqda açarın məhv edilməsi | **Pilotdan əvvəl:** imza açarları aparat təhlükəsizlik modulunda və ya ekvivalent sertifikatlı bulud açar xidmətində saxlanılır; ehtiyat nüsxə ikili nəzarətlə çıxarılır. Siyahı mərhələsində açar serverdə şifrələnmiş şəkildə saxlanıla bilər; bu kənarlaşma provayderin bəyannaməsində yazılır |
| 7.5.4 | Açardan istifadə: ömrün sonunda istifadədən çıxarma; yalnız sübut vermə və ləğv statusu üçün | Provayderin imza açarı yalnız WIA, KA və öz ləğv siyahılarını imzalayır; açarın yenilənməsi etibar siyahısındakı qeyd vasitəsilə həyata keçirilir ([[SPEC-TRUST-0001]]) |
| 7.5.5 | Rəqəmsal cüzdana xas: rəqəmsal sənədin qurğunun təhlükəsiz aparatına bağlanması; açarın təhlükəsiz aparatda olduğunun yoxlanılması; seçici paylaşım; birgə təqdimat; əlaqələndirilə bilmənin azaldılması; toplu verilən nüsxələrin bir-birindən asılı olmaması | KA yalnız təhlükəsiz aparatda yaradılmış açarları daşıyır; səviyyə yoxlanılmış vəziyyətə əsaslanır ([[ADR-0025]] WIA3; W3-də qurğu sübutu, RB-WP-17). Hər nüsxə ayrı açardır, bir açar yalnız bir KA-dadır (§4; RB-AP-09). Seçici paylaşım və birgə təqdimat rəqəmsal sənəd formatlarına aiddir (SD-JWT VC, mdoc) |
| 7.6 | Fiziki və ətraf mühit təhlükəsizliyi (EN 319 401) | Provayderin serverləri girişi nəzarət edilən məlumat mərkəzində yerləşir |
| 7.7 | Əməliyyat təhlükəsizliyi; tutumun monitorinqi | Provayder WIA və KA son nöqtələrinin və ləğv siyahılarının tutumunu izləyir; WIA və KA ləğv siyahıları ən azı 10.000 girişlidir və dolmadan genişləndirilir (§6) |
| 7.8 | Şəbəkə təhlükəsizliyi: təhlükəsiz zona; istifadə olunmayan hesabların, xidmətlərin və portların bağlanması; şifrələnmiş kanallar | Bütün son nöqtələr yalnız TLS ilə; istifadə olunmayan xidmət və portlar bağlıdır; imza açarına çıxışı olan komponent ayrıca zonadadır |
| 7.9 | Zəiflik və insident idarəetməsi (EN 319 401) | §8: kritik hadisə 4 saat, yüksək əhəmiyyətli hadisə 24 saat ərzində sxem sahibinə bildirilir; rəqəmsal cüzdan həllindəki zəiflik versiya üzrə ləğvlə nəticələnə bilər (RB-WP-11) |
| 7.10 | Sübutların toplanması: sübut vermə hadisələrinin, təhlükəsizlik hadisələrinin, ləğv sorğularının və nəticələrinin qeydə alınması; qeydlərə girişin və saxlanma müddətinin sənədləşdirilməsi | Provayder WIA və KA vermə, vahid qeydiyyatı, ləğv sorğusu və ləğv hadisələrini qeydə alır. Qeyd fərdi məlumat, ləğv siyahısındakı mövqe (`idx`) və vahid açarının barmaq izini daşımır (RB-GEN-06; REQ-EAASP-7.13-08: izləməyə imkan verməyən minimal qeyd). Saxlanma müddəti bəyannamədə yazılır |
| 7.11.2 | Ehtiyat nüsxə: fəaliyyətin davam etdirilməsi üçün lazım olan məlumatların müntəzəm, mümkünsə uzaq məkanda ehtiyat nüsxəsinin çıxarılması və ehtiyat nüsxənin sınaqdan keçirilməsi | Vahid qeydi və WIA girişi ilə vahid arasındakı uyğunluq müntəzəm olaraq və serverdən kənarda ehtiyat nüsxəyə köçürülür; ləğv yalnız bu qeyd vasitəsilə həyata keçirilə bilər (RB-AP-22 ilə eyni prinsip); bərpa ildə bir dəfə sınaqdan keçirilir |
| 7.11.3 | Böhranın idarə edilməsi: kompromitasiya halında şəxslərin və əlaqəli tərəflərin xəbərdar edilməsi; verilmiş bütün sübutların ləğvi | İmza açarı kompromitasiyaya uğrayarsa, provayder sxem sahibinə bildirir (§8), etibar siyahısındakı açarın dayandırılmasını təmin edir, təsirlənən bütün WIA və KA girişlərini ləğv edir və şəxsləri rəqəmsal cüzdandan kənar kanalla xəbərdar edir (§5.3) |
| 7.12 | Fəaliyyətin dayandırılması planı; sübutlar etibarsız olduqdan sonra qeydlərin saxlanılması | Provayderin yazılı fəaliyyətin dayandırılması planı var: verdiyi son WIA və KA-nın ləğv üzrə xidmət müddəti (`client_status.exp`, `key_storage_status.exp`) bitənədək ləğv siyahılarını dərc etməyə davam edir və ya bu vəzifəni varisə ötürür; sənədi verən qurumlara və sxem sahibinə əvvəlcədən bildirir |
| 7.13 | Məxfilik: şəxsi izləməmək və əlaqələndirməmək; məlumatların minimallaşdırılması; fərdi məlumatları kənara verməmək; minimal qeyd | Vahid qeydində fərdi məlumat yoxdur ([[ADR-0025]] WIA2); provayder rəqəmsal cüzdanın hansı qurumla əlaqə saxladığını öyrənmir (hər əməliyyat üçün WIA, §3); vahid məlumatları başqa xidmətə ötürülmür |
| 7.14 | Təchizat zənciri (EN 319 401) | Provayder sübut xidmətində istifadə etdiyi xarici xidmətləri (hostinq, açar xidməti, qurğu sübutu xidmətləri) siyahıya alır və təhlükəsizlik tələblərini müqavilə ilə təsbit edir |

İcra Reqlamenti (Aİ) 2025/1569-un TS 119 471-ə əlavə etdiyi tələblər kvalifikasiyalı və dövlət EAA üçündür; Tamga-nın kvalifikasiyalı olmayan WIA və
KA-sına birbaşa tətbiq edilmir. Dövlətin iştirakı və kvalifikasiyalı sinfə keçid zamanı ayrıca nəzərə alınır.

# 10. Qərarlar və açıq məsələlər

| Mövzu | Status |
|---|---|
| ETSI TS 119 471-in 6–7-ci bəndləri ilə uyğunlaşdırma (WURevocation_03) | **Qərar (2026-10-12, [[ADR-0047]] K8):** §9-da sətir-sətir uyğunlaşdırıldı; qarşılığı olmayan bəndlər provayderin öhdəliyi kimi əlavə edildi |
| İtirilmiş və ya oğurlanmış cihazdan ləğv (Aİ WIAM_06) | **Qərar (2026-10-12, [[ADR-0047]] K3):** istifadəçi hesabı olmadan, aktivləşdirmə zamanı verilən ləğv sirri ilə (§2, §5.1; RB-WP-15) |
| Rəqəmsal cüzdanın ləğvi barədə şəxsə rəqəmsal cüzdandan kənar bildiriş (Aİ WURevocation_14/16) | **Qərar (2026-10-12, [[ADR-0047]] K4):** hər provayder rəqəmsal cüzdandan kənar ən azı bir kanal təqdim edir (§5.3; RB-WP-16) |
| Cihaz attestasiyası (App Attest, Android açar attestasiyası, Play Integrity) | **Qərar (2026-10-12, [[ADR-0047]] K5):** W3-də məcburi, W2-də ixtiyari (§2; RB-WP-17) |
| KA üçün hər açar üzrə ləğv qeydi (Aİ TS3 Seçim 2) | Açıq: təhlükəsiz aparat təminatına keçidlə birlikdə nəzərdən keçiriləcək ([[ADR-0025]] "sonra") |

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
