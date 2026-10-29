---
document_id: FW-TF-0001
title: "Əlavə A — Trust Framework"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-16
summary: >
  Tamga ekosisteminin idarəetmə çərçivəsi. World Bank-ın "Digital Wallets: Trust Frameworks" beşqatlı modeli əsasında qurulmuşdur: strategiya (vizyon, prinsiplər, hüquqi kontekst, risk, idarəetmə orqanları), texnologiya (əsas sənədə istinad), sxem qaydaları (rollar, qoşulma qapıları, həyat dövrü, təminat), uyğunluq (rejim, ISO/IEC 17000 rolları, uyğunluq testi, nəzarət, sanksiyalar, insidentlərə cavab) və müqavilələr (müqavilələr toplusu, xidmət səviyyələri, məsuliyyət, müqaviləyə xitam, varislik). eIDAS 2.0 və onun icra aktları qatının Türk dünyasındakı qarşılığıdır və dövlət öz üzərinə götürdükdə ona təhvil veriləcək aktivdir.
translation_of: FW-TF-0001
source_version: "1.0.0"
---

# 0. Status, əhatə dairəsi, necə oxumalı

Bu sənəd **Tamga [[t:trust-framework|Trust Framework]] 1.0**-dır və şəbəkəyə qoşulan hər qurum üçün məcburidir: qoşulma
müqaviləsini imzalayan qurum bu çərçivəni və [[t:rulebook|Tamga Rulebook]]-u qəbul etmiş olur. Onun üç vəzifəsi var:

1. **Qurumlara** şəbəkəyə necə qoşulacaqlarını, hansı öhdəlikləri üzərlərinə götürəcəklərini və hansı təminatı alacaqlarını bildirmək.
2. **Tənzimləyicilərə və Türk Dövlətləri Təşkilatının (TDT) üzv dövlətlərinə** strukturun [[t:eIDAS]] 2.0 ilə eyni şəkildə qurulduğunu,
   lakin suverenlik və təhvil baxımından Türk dünyası üçün layihələndirildiyini göstərmək.
3. **Təhvil anında** veriləcək aktiv olmaq: kök barmaq izləri, reyestrlər, qaydalar, müqavilə şablonları və dəyişikliklər
   jurnalı bu sənədə bağlıdır.

Sənəd World Bank-ın beşqatlı modeli əsasında tərtib edilmişdir (strategiya · texnologiya · sxem qaydaları · uyğunluq · müqavilələr). Hər
qatda "bu gün" və "təhvil zamanı" ayrımı aparılır. Qaydaların əsaslandığı qərarlar və spesifikasiyalar Əlavə E-dədir.

**Məcburilik ardıcıllığı:** qərar qeydləri > spesifikasiyalar > bu sənəd > Tamga Rulebook > müqavilə şablonları. Ziddiyyət olduqda yuxarı
mənbə üstün tutulur və bu sənəd düzəldilir.

Hansı bölməni hansı ardıcıllıqla oxuyacağınız [[FW-READ-0001]], qoşulmanın addımları isə [[FW-ONB-0001]] səhifəsindədir.

---

# 1. Qat 1 — Strategiya

## 1.1 Vizyon

TDT-nin üzv və müşahidəçi dövlətlərinin, onların qurumlarının və vətəndaşlarının **bir-birinin rəqəmsal sənədlərini mənbəyə müraciət etmədən
yoxlaya bildiyi** ortaq etibar infrastrukturu. Hər dövlət öz reyestrlərinin yeganə sahibidir; yuxarıda heç bir orqan yoxdur. Texniki
qat Avropa İttifaqı (Aİ) standartları ilə eynidir, idarəetmə isə Türk dünyasına məxsusdur.

## 1.2 Prinsiplər

Əsas sənəddəki yeddi prinsip (§1.6, P1–P7) bu çərçivənin də prinsipləridir. İdarəetməyə xas iki əlavə prinsip:

| # | Prinsip |
|---|---|
| G-A | **Qeydiyyat səlahiyyətləndirmə deyil.** Qeydiyyat qurumu qeydə alır, təsdiq etmir; qurumun rəqəmsal sənəd vermək üçün hüquqi səlahiyyəti (YÖK, nazirlik, peşə palatası) şəbəkədən kənarda verilir. Şəbəkə yalnız şəbəkə daxilindəki əhatəni (hansı sənəd növü, hansı sahələr) saxlayır. |
| G-B | **Yumşaq güc də məhdudlaşdırılır.** Kodla məhdudlaşdırıla bilməyən hər səlahiyyət (hostinq, domen adı, reyestrin aparılması, statistika) yazılı siyasət, ölçülə bilən hədd xəbərdarlığı və şəffaflıq hesabatı ilə məhdudlaşdırılır. |

## 1.3 Əhatə dairəsi

| Ölçü | Bu gün | Hədəf |
|---|---|---|
| Yurisdiksiya | Türkiyə (Türkiyə siyahısı yayımdadır) | TDT üzvləri (Azərbaycan, Qazaxıstan, Qırğızıstan, Özbəkistan) və müşahidəçilər (Macarıstan, Türkmənistan); hər biri üçün yer ayrılıb |
| Sənəd növləri | Təhsil sənədləri (tələbə arayışı, diplom), şəxsiyyət sənədi, əlaqə sənədləri, tədbir bileti | Sektor sxemləri |
| İştirakçılar | Sənəd verən qurumlar (universitetlər, bilet satıcıları), yoxlayan tərəflər (işəgötürənlər, veb-saytlar), Tamga (müvəqqəti siyahı operatoru və qeydiyyat qurumu), Tamga Wallet (şəbəkənin ilk rəqəmsal cüzdanı) | Peşə təşkilatları, dövlət qurumları, banklar, qaydalara uyğun hər rəqəmsal cüzdan |
| Şəxsin kimliyi ([[t:PID]]) | **Əhatədən kənar** — Tamga PID vermir | Dövlətin təyin etdiyi PID provayderi |

## 1.4 Hüquqi kontekst

| Mövzu | Türkiyədə hüquqi əsas | Bu çərçivədə |
|---|---|---|
| Fərdi məlumatlar | 6698 saylı KVKK; VERBİS; məlumatlandırma, açıq razılıq, məlumatların qorunmasına təsirin qiymətləndirilməsi | İştirak müqaviləsinin əlavələri |
| Elektron imza və möhür | 5070 saylı Elektron İmza Qanunu; BTK-nın elektron sertifikat xidməti provayderləri siyahısı; kvalifikasiyalı imza və e-Möhür | Şəxsiyyətin ən yüksək səviyyədə yoxlanması yolu (yoxlayan tərəfin deyil, sənədi verən qurumun vəzifəsi); akkreditə olunmuş sənədi verən qurumlar üçün e-Möhür seçimi |
| Beynəlxalq tanınma | eIDAS 2.0 Maddə 14 (üçüncü ölkə sazişləri; yalnız etibar xidmətləri, tərəfləri dövlətlərdir); Maddə 5f üçüncü ölkə tanınması deyil; ETSI TS 119 612-nin Aİ-dən kənar siyahı dəstəyi | Texniki hazırlıq: ETSI formatında siyahılar, ETSI profilli sertifikatlar, ötürülə bilən dövlət rolları ([[ADR-0035]] hüquqi qeydi) |
| Ali təhsil | YÖK qanunvericiliyi (diplom vermək səlahiyyəti) | Şəbəkədən kənar səlahiyyət; şəbəkədəki əhatə dairəsi ayrıdır (G-A) |
| Yurisdiksiya və mübahisələr | Qurumun yerləşdiyi dövlətin hüququ | §5.8 |

Çərçivə müqavilə əlavələri ilə birlikdə pilotdan əvvəl KVKK və 5070 baxımından vəkil tərəfindən nəzərdən keçirilir.

## 1.5 Riskə yanaşma

Risklər ekosistem səviyyəsində və mütənasib şəkildə nəzərdən keçirilir. Risk reyestri Aİ ARF-nin risk siyahısından törədilir. Bu gün açıq şəkildə bəyan
edilən qalıq risklər əsas sənəddədir (§6.6 və §7.4): yeganə operatorun imzasına əsaslanan lövbər, ləğvin qüvvəyə minmə müddəti, eyni
[[t:issuer|sənəd verən qurumun]] rəqəmsal sənədlərinin birləşdirilməsi yolu ilə şəxsin əlaqələndirilə bilməsi.

## 1.6 İdarəetmə orqanları və səlahiyyətlər

| Mərhələ | Orqan | Səlahiyyət |
|---|---|---|
| **Siyahı mərhələsi və reyestr mərhələsi (bu gün)** | Tamga, müvəqqəti operator | Gündəlik istismar, infrastruktur, siyahı operatorluğu və qeydiyyat qurumu rolunun dövlət adına icrası, açıq paketlərin dərci |
|  | Tamga texniki şurası | Spesifikasiya dəyişiklikləri, qərar qeydlərinin təsdiqi, şəbəkə səviyyəsində ümumi rəqəmsal sənəd növləri |
|  | (hələ yoxdur) | Şura — üzv dövlət olmadıqca yaradılmır; bu müvəqqəti vəziyyət açıq şəkildə adlandırılır |
| **Dövlətin qoşulması və sonrası** | Şura (üzv dövlətlər) | Üzvlərin qəbulu və çıxarılması, şəbəkə səviyyəsində ümumi rəqəmsal sənəd növləri, protokol yeniləmələri və bu sənədin siyasətləri; hamısı üçdə iki səslə |
|  | Hər dövlət | Öz milli siyahısı və qeydləri (yalnız həmin dövlət yazır), qeydiyyat qurumu, siyahı operatorluğu, kök sertifikat |
|  | İdarəetmə qurumu (fond və ya şura katibliyi) | Operatorluq, ötürülənədək |

İdarəetmə qurumu ilk gündən yaradılmır: bir və ya iki dövlət qoşulmağa maraq göstərdikdə yaradılır və siyahılar ona ötürülür. O
vaxtadək Tamga müvəqqəti operatordur; fond yaradıldıqda operatorluq ona ötürülür.

**Ölçülə bilən təhvil hədləri:** host edilən sənəd verən qurumların payı 30%-i keçərsə, məsələ Şuranın gündəminə çıxarılır; dövlət
operatorlarının sayı ən azı dördə çatdıqda ilk operatorun dəftər qovşaqları təhvil verilir; ilk dövlət operatoru istismara
keçdikdə Şura yaradılır. Ortaq dəftər ən azı iki müstəqil operatorla başlayır.

## 1.7 Şəffaflıq

Üç ayda bir şəffaflıq hesabatı dərc olunur: siyahı versiyaları və dəyişikliklər, host edilən sənəd verən qurumların payı, sənəd növlərinin
istifadə sayğacları (ən azı 50-lik qruplar şəklində), insidentlər və audit nəticələri. Siyahıların dəyişikliklər jurnalı
`trust.tamga.network` üzərində hamı üçün açıqdır.

---

# 2. Qat 2 — Texnologiya

Texniki istinad əsas sənəddir; bu qat yalnız idarəetmənin texnologiyaya qoyduğu tələbləri sadalayır.

## 2.1 Məcburi standartlar və profillər

- sənəd formatları: [[t:SD-JWT-VC]] (Tamga profili) və şəxsiyyət üçün ISO/IEC 18013-5 [[t:mdoc]];
- protokollar: [[t:OpenID4VCI]] və [[t:OpenID4VP]] ([[t:HAIP]] 1.0 profili);
- qurumun kimliyi: X.509 sertifikatları;
- ləğv: [[t:status-list|ləğv siyahısı]] (IETF Token Status List);
- sənəd növləri: növ təsviri (Type Metadata) və JSON Schema kataloqu;
- [[t:trust-list|etibar siyahısı]] formatı və kanonik yoxlama xətti;
- rəqəmsal cüzdan və [[t:identity-proofing|autentifikasiya]] qaydaları.

Texniki təfərrüatlar tərtibatçı sənədlərindədir (Əlavə E).

## 2.2 Təminat modeli (idarəetmə baxımından)

| Ox | Səviyyə | Kim müəyyən edir | Harada qeydə alınır |
|---|---|---|---|
| Sənəd sahibinin şəxsiyyətinin yoxlanması (T0–T3; eIDAS Low / Substantial / High) | Bağlama yolu | Sənədi verən qurum və ya qeydiyyat orqanı (yoxlayan tərəf deyil) | Sənədi verən qurumun audit qeydi; rəqəmsal sənəd növünün ilkin şərti |
| Sənədi verən qurum (I1–I3) | Akkreditasiya | Qeydiyyat qurumu; I3-də müstəqil qiymətləndirmə | Etibar siyahısında (təminat və sinif sahələri) |
| Rəqəmsal cüzdan (W1–W3) | Təhlükəsiz aparat (WSCD — Wallet Secure Cryptographic Device) səviyyəsi | Cüzdan provayderi (cüzdan nüsxəsinin sübutu və açar sübutu) | Siyahılar siyahısında, cüzdan provayderinin qeydində |

Xaricə yönəlik adlandırma eIDAS terminləri ilə aparılır (Low / Substantial / High; [[t:EAA]], QEAA qarşılığı, dövlət sənədi).
İstifadəçiyə rəqəm göstərilmir.

Rəqəmsal cüzdan səviyyələri: **W1** proqram açarı (sənəd verilmir, RB-WP-01), **W2** cihazın təhlükəsiz zonası, **W3** sertifikatlı təhlükəsiz
aparat. Ən yüksək səviyyədə (W3) cüzdan provayderi aktivləşdirmə zamanı və W3 bəyan edən hər açar sübutundan əvvəl platformanın cihaz
sübutunu (Apple App Attest, Android açar sübutu, Play Integrity) yoxlayır; W2-də cihaz sübutu ixtiyaridir (RB-WP-17,
[[ADR-0047]] K5).

## 2.3 Açarın qorunması tələbləri

| Açar | Tələb |
|---|---|
| Siyahının imza açarı | Ən azı iki növbəli sertifikat; KMS və ya HSM; rotasiya ən azı 30 gün əvvəl elan edilir, yeni açar köhnəsi ilə imzalanır |
| Kök sertifikat | Oflayn mərasim (iki nəfər, protokol); barmaq izi daimi bir səhifədə dərc edilir |
| Sənədi verən qurumun imza açarı | Qurumun nəzarətindədir; I3-də HSM-də; **Tamga-da saxlanılmır** |
| Ləğv siyahısının açarı | Ayrı və onlayn |
| Sənəd sahibinin açarı | Cihazın təhlükəsiz zonasında; ixrac edilə bilməz; bərpa toxumundan törədilmir |
| Yoxlayan tərəfin giriş sertifikatı | Giriş sertifikatı orqanından; müştəri identifikatoru sertifikatın heşidir (`x509_hash`), daimi identifikator sertifikatdakı domen adıdır (`dns_name`) |

## 2.4 Sertifikasiya yanaşması

Siyahı mərhələsində və reyestr mərhələsində **yüngül uyğunluq** tətbiq olunur: açıq uyğunluq test vektorları və öhdəlik testləri hər buraxılışdan
əvvəl məcburidir. Dövlətlər qoşulduqda müstəqil uyğunluğun qiymətləndirilməsi qurumları və milli sertifikasiya tətbiq edilir (§4.2,
§4.3).

---

# 3. Qat 3 — Sxem qaydaları

## 3.1 Rollar və məsuliyyətlər

Rolların tərifləri əsas sənədin 3-cü bölməsində, hər rolun təfərrüatları [[FW-ROLE-0001]] səhifəsində, məcburi qaydalar isə Əlavə B-dədir. Bu
bölmə iştirakın **qapılarını** və həyat dövrünü müəyyən edir; addım-addım proses [[FW-ONB-0001]] səhifəsindədir.

## 3.2 İştirak qapıları

Qapılar avtomatik uyğunluq yoxlamaları kimi qurulur; qapıdan keçilmədən qeydiyyat aparılmır.

### Sənədi verən qurum

| Səviyyə | Qapı | Nə təmin edir |
|---|---|---|
| **I1 — Qeydiyyatlı** | Domen adına sahiblik (DNS yoxlaması); əlaqə məlumatları; texniki uyğunluq (növ tərifi və uyğunluq test vektorları ilə sınaq sənədi) | Siyahıda EAA sinfi və I1 təminatı; yoxlayan tərəfin interfeysində "akkreditə olunmayıb" |
| **I2 — Müqaviləli** | I1 + hüquqi şəxs statusu (MERSİS və Ticarət Reyestri Qəzeti və ya təsis qanunu) + imza səlahiyyətlisinin təsdiqi + **iştirak müqaviləsi** (§5.1) + X.509 sertifikat + KVKK əlavələri | I2 təminatı |
| **I3 — Akkreditə olunmuş** | I2 + açarlar HSM-də (və ya kvalifikasiyalı e-Möhür) + audit və qeydlərin saxlanması öhdəliyi + insident bildirişi müddətləri + illik nəzərdən keçirmə + fəaliyyətin dayandırılması proseduru + məsuliyyət sığortası | I3 təminatı, kvalifikasiyalı sinif; sənəddə kvalifikasiyalı sənəd işarəsi |
| **Dövlət** | Dövlət qurumu və ya səlahiyyətli mənbə adından; müvafiq dövlətin qeydiyyat qurumu qeydə alır | Dövlət sinfi; sənəddə dövlət sənədi işarəsi (dövlət iştirakı halında) |

Qurum host edilən sənəd vermə xidmətindən öz sistemlərindən **özünə bağlı və əhatəsi məhdud API açarı ilə**
istifadə edir; açar yalnız heşi ilə saxlanılır və 90 gündən bir yenilənir.

Sənəd növü üzrə səlahiyyət qapıdan asılı deyil və **hər növ üçün ayrıca icazə siyahısı ilə** verilir; standart olaraq bağlıdır. Səlahiyyət sənəd
növünün rulebook-undakı "kim sənəd verə bilər" bölməsinə əsasən verilir.

### Yoxlayan tərəf

Qeydiyyat müraciəti əhatə dairəsinin ayrılması ilə nəticələnir. Müraciət Aİ-nin ümumi qeydiyyat məlumat dəstini tələb edir: rəsmi və kommersiya adı, rəsmi identifikasiya
nömrəsi (VKN və ya MERSİS), ünvan, əlaqə, xidmətin təsviri, hər istifadə üçün məqsəd və **məxfilik siyasəti**, dövlət
qurumu olub-olmaması, səlahiyyət növü, vasitəçi əlaqəsi və tabe olduğu məlumatların qorunması qurumu. Yalnız hüquqi şəxslər qeydiyyatdan keçir.
Sonra tələb edilə biləcək sahələr məlumatların minimallaşdırılması prinsipi ilə yoxlanılır, [[t:access-certificate|giriş sertifikatı]] verilir və yoxlayan tərəf
siyahıya əlavə olunur. Yoxlayan tərəf əhatə dairəsindən kənar sahə tələb edə bilməz; cüzdan əhatə dairəsini şəxsə göstərir. Yoxlayan tərəf öz proqram təminatını
işlədə bilər və ya host edilən yoxlama xidmətindən ([[t:intermediary|vasitəçi]]) istifadə edə bilər; ikinci halda nəticə və dəyərlər yalnız
imzalı bəyanatı ilə özünü sübut edən yoxlayan tərəfə və bir dəfə verilir.

**[[t:registration-certificate|Qeydiyyat sertifikatı]].** Qeydiyyat qurumu (bu gün dövlət adından Tamga) hər istifadə üçün [[t:ETSI]] TS 119 475
qeydiyyat sertifikatı yaradır (ən çox 12 ay etibarlıdır). Məzmun yalnız imzalı siyahıdakı qeyddən götürülür və [[t:LOTL|siyahılar siyahısında]]
dərc edilən ayrıca qeydiyyat qurumu açarı ilə imzalanır. Yoxlayan tərəf sertifikatı sorğusu ilə birlikdə ötürür; cüzdan imzanı, müddəti
və yoxlayan tərəfin giriş sertifikatındakı qurum identifikasiya nömrəsi ilə əlaqəni yoxlayır, tələb edilən sahələri sertifikatla müqayisə edir.
Sənədi verən qurumlar üçün də hər qurum üzrə bir qeydiyyat sertifikatı yaradılır. Qurum identifikasiya nömrəsi qeydə daxil edilməmiş iştirakçıya
sertifikat yaradılmır.

### Cüzdan provayderi

Cüzdan həlli bəyanatı (platformalar, təhlükəsiz aparat səviyyəsi, PIN və biometrika, ehtiyat nüsxə modeli; Tamga Rulebook-dakı cüzdan
qaydalarına uyğun) verilir, uyğunluq testlərindən keçilir, cüzdan nümunəsi sübutunun ([[t:WIA]]) və açar sübutunun (KA) imza açarları
siyahılar siyahısına əlavə olunur. Dövlətlər qoşulduqda sertifikatlaşdırılmış cüzdan həlləri siyahısı tətbiq edilir (Aİ-nin 2025/849 saylı İcra Reqlamentinin
qarşılığı).

### Səlahiyyətli mənbə

Sənədi verən qurumun müqaviləsində adı çəkilir; məlumatların emalı müqaviləsi imzalanır (§5.1). Mənbə məlumatlarının sənəd sahələrinə uyğunlaşdırma
cədvəli (məs., ISCED-F) aparılır və "uyğunlaşdırmada qarşılığı olmayan məlumat üçün sənəd verilmir" qaydası tətbiq edilir.

## 3.3 Həyat dövrü qaydaları

- **Fəaliyyətin dayandırılması:** insident, audit nəticəsi və ya müqavilənin pozulması halında qurumun fəaliyyəti dayandırılır; yeni sənəd verilmir, köhnə
  sənədlər verildikləri tarixə görə etibarlı qalır. Problem aradan qaldırıldıqda qurum yenidən aktivləşir.
- **Çıxarılma:** qurum siyahıdan çıxarılır (varisi varsa, varis əlaqəsi ilə); ETSI görünüşündə "geri çəkilib" kimi göstərilir;
  tarixçə silinmir; varis ləğv siyahısını dərc etməyə davam edə bilər.
- **Açarın və ya sertifikatın yenilənməsi:** yeni qurum identifikatoru köhnəsinə varis kimi bağlanır; köhnə sənədlər köhnə qeydlə
  yoxlanılır; yenilənmə ən azı 30 gün əvvəl qeydiyyat qurumuna bildirilir.
- **Könüllü çıxış:** bildirişdən 90 gün sonra baş verir; ləğv siyahısı varis və ya siyahı operatoru tərəfindən son
  versiyasında dondurulur.
- **Dövlətin qoşulması və çıxışı:** üzvlük üçdə iki səslə olur; çıxış mövcud qeydləri etibarsız etmir; yenidən qəbul mümkündür.

## 3.4 Şəxsiyyətin yoxlanması (yoxlayan tərəf yox, sənədi verən qurum) və rəqəmsal sənəd növü

Hər rəqəmsal sənəd növünün rulebook-u həmin növün tələb etdiyi minimum şəxsiyyət yoxlaması səviyyəsini müəyyən edir (Education Rulebook: tələbə
sənədi T1, diplom T2). Bu səviyyəni yoxlayan tərəf deyil, sənədi verən qurum rəqəmsal sənədi verməzdən əvvəl təmin edir; səviyyə [[t:credential|sənədə]] yazılmır. Yollar
və məsafədən şəxsiyyət yoxlaması provayderinin inteqrasiyası [[SPEC-ID-0003]]-dədir.

## 3.5 Müvəqqəti şəxsiyyət sənədi provayderi

Dövlətin təyin etdiyi PID provayderi olmayana qədər **Tamga Network** bu rolu *müvəqqəti* olaraq öz üzərinə götürür: məsafədən şəxsiyyət
təsdiqindən (sənəd, canlılıq yoxlaması, üz uyğunlaşdırması; NFC əlavə edilə bilər) sonra cüzdana Tamga şəxsiyyət sənədi verir. Qaydalar:

1. Bu rəqəmsal sənəd PID deyil, EAA-dır; dövlət provayderi təyin edildikdə varislik qaydasında ötürülür (§5.7).
2. Tamga bu məlumatlar üçün **KVKK üzrə məlumat nəzarətçisidir**: məlumatlandırma və açıq razılıq rəqəmsal sənəd verilməzdən əvvəl alınır; sənəd və üz
   təsvirləri Tamga-da saxlanılmır; saxlama müddəti rəqəmsal sənədin etibarlılıq müddəti ilə məhdudlaşır; silinmə tələbi rəqəmsal sənədi ləğv edir.
3. Şəxsiyyət nömrəsi yalnız bu rəqəmsal sənəd növündə və [[t:selective-disclosure]] ilə ötürülür.
4. Qurumlar (yoxlayan tərəf kimi) rəqəmsal sənədi yalnız **təqdimat** yolu ilə, qeydə alınmış əhatə dairələri çərçivəsində və öz qeydləri ilə uyğunlaşdırmaq üçün alır;
   uyğunlaşdırma açarlarını saxlamır.
5. Məsafədən şəxsiyyət yoxlaması provayderi ilə bağlanan müqavilə ETSI TS 119 461-ə istinad edir.
6. Rüblük şəffaflıq hesabatı verilmiş və ləğv edilmiş rəqəmsal sənədlərin sayını əhatə edir; şəxsi məlumat əhatə etmir.

Texniki profil [[SPEC-ID-0003]] §9-dadır.

## 3.6 Məlumatların qorunması qaydaları (KVKK)

Rollara görə məsuliyyət: sənədi verən qurum və [[t:authentic-source|səlahiyyətli mənbə]] məlumat nəzarətçisidir; Tamga host etdiyi sənəd vermə
xidmətində müqavilə əsasında məlumat emalçısıdır; **şəxsiyyət sənədi xidmətində məlumat nəzarətçisidir (§3.5)**; [[t:wallet-provider|cüzdan
provayderi]] cihazdakı məlumatlara çıxış əldə etmir; yoxlayan tərəf aldığı sahələrə görə məsuliyyət daşıyır. Ümumi qeydlərdə fərdi məlumat yoxdur (P2).
Şəxsin hüquqları: təqdimat tarixçəsi cihazda saxlanılır, məlumatların qorunması qurumuna şikayət yolu cüzdanda göstərilir, razılığın geri
götürülməsi sənədin ləğvi deməkdir.

## 3.7 Yaxın məsafədə təqdimat və keçid kartı

**Prinsip:** yoxlama zamanı istifadə olunan birdəfəlik dəyəri ([[t:nonce]]) əmin olmaq istəyən tərəf yaradır. Cüzdanın QR kod
göstərdiyi yaxın məsafəli təqdimatda ya ikinci kanal açılır (hədəf: ISO/IEC 18013-5), ya da QR kod yalnız **qısa ömürlü
istinad** (yoxlayan tərəfin sonradan başlatdığı OpenID4VP) və ya **fərdi məlumat ehtiva etməyən imzalı jeton** (keçid kartı, 60
saniyə) daşıyır. Qaydalar:

1. Qapı terminalı yalnız qeydiyyatdan keçmiş yoxlayan tərəfin tabeliyində müəyyən edilir.
2. Keçid jetonu şəxsi identifikasiya etmir; yoxlayan tərəf şəxsi öz qeydiyyat sistemində uyğunlaşdırır.
3. Keçid zamanı təsdiq soruşulmaması **müddətli və əhatə dairəsi müəyyən** razılığa əsaslanır; şəxs bu razılığı istənilən vaxt geri götürə bilər.
4. Hər təqdimat cüzdanda qeydə alınır.
5. Birdəfəlik sənədlərdə (bilet) qapılar ümumi "istifadə olunub" siyahısı aparır.
6. Bu müvəqqəti yollar versiyalıdır və ISO/IEC 18013-5 yaxın məsafə axını tətbiq edildikdə istifadədən çıxarılır.

---

# 4. Qat 4 — Uyğunluq

## 4.1 Rejim — qarışıq model

| Sinif | Rejim | Mənası |
|---|---|---|
| I3 / kvalifikasiyalı | **Əvvəlcədən audit** | Qeydiyyatdan əvvəl uyğunluğun qiymətləndirilməsi (texniki və təşkilati), illik audit |
| I2 | **Sonradan audit** | Özünübəyan və uyğunluq test vektorları; şikayət və ya insident əsasında audit; illik özünüqiymətləndirmə |
| I1 | Özünübəyan | Texniki uyğunluq testi; "akkreditə olunmayıb" etiketi |
| Cüzdan provayderi | Bu gün özünübəyan və uyğunluq testləri; dövlət iştirakı ilə əvvəlcədən audit | Dövlət iştirakı ilə sertifikatlaşdırılmış rəqəmsal cüzdan həlli |
| Yoxlayan tərəf | Sonradan audit | Əhatə dairəsinin pozulması və ya həddindən artıq sorğu barədə şikayət əsasında |

Bu model EUDI-nin qarışıq modeli ilə eynidir: kvalifikasiyalı rəqəmsal sənədlər əvvəlcədən, digərləri isə sonradan audit edilir.

## 4.2 ISO/IEC 17000 rolları

| Rol | Bu gün | Dövlət qoşulduqda |
|---|---|---|
| Sxem sahibi | Tamga (müvəqqəti operator) | Şura |
| Akkreditasiya qurumu | Tamga (müvəqqəti) | Milli akkreditasiya qurumu (TÜRKAK-a bənzər) |
| Uyğunluğun qiymətləndirilməsi qurumu | — (özünübəyan və uyğunluq test vektorları) | Müstəqil qiymətləndirmə qurumları |
| Sxem iştirakçısı | Sənədi verən qurum, yoxlayan tərəf, cüzdan provayderi, səlahiyyətli mənbə | Eyni |

## 4.3 Uyğunluq testləri və sertifikatlaşdırma

Uyğunluq rolun öz proqram təminatı ilə nümayiş etdirilir. Testlər hamı üçün açıqdır və repozitoriyadakı `conformance/` qovluğunda versiyalaşdırılmış şəkildə saxlanılır;
fərdi məlumatlar və şəxsi açar ehtiva etmir.

| Rol | Nə test edilir | Necə nümayiş etdirilir |
|---|---|---|
| Sənədi verən qurum | Növ təsvirinə uyğun rəqəmsal sənəd yaradılması, imza və sertifikat zənciri, ləğv siyahısının dərci, rəqəmsal cüzdan sübutlarının yoxlanılması | Uyğunluq vektorları ilə sınaq sənədi; nəticə hesabatı qeydiyyat müraciətinə əlavə edilir |
| Yoxlayan tərəf | İmzalanmış sorğu, yoxlama xəttinin addımları, köhnəlmiş siyahıda "yoxlanıla bilmədi" nəticəsi, əhatə dairəsindən kənar sahələrin tələb edilməməsi | Uyğunluq vektorları və öhdəlik testləri; nəticə hesabatı qeydiyyat müraciətinə əlavə edilir |
| Cüzdan provayderi | Rəqəmsal cüzdan qaydaları (açarın qorunması, təsdiq ekranı, tarixçə, silmə), cüzdan nümunəsi sübutu və açar sübutu, təqdimetmə protokolu | Uyğunluq vektorları, öhdəlik testləri və cihaz üzərində nümayiş |

Öhdəlik testləri ən azı bunları əhatə edir: köhnəlmiş siyahı "yoxlanıla bilmədi" nəticəsini verir; naməlum formatda əməliyyat dayanır; imza xətasında
əməliyyat dayanır. Testlərin icra addımları tərtibatçı sənədlərində verilir (Əlavə E). Nəticələr qeydiyyat orqanına təqdim olunur; qeydiyyat orqanı
lazım olduqda testləri yenidən icra edir. Dövlətlər qoşulduqda müstəqil qiymətləndirmə qurumları və milli sertifikatlaşdırma
bu testlərin üzərinə əlavə olunur; Aİ ilə qarşılıqlı fəaliyyət qabiliyyəti isə ayrıca OpenID uyğunluq testləri ilə nümayiş etdirilir.

İstinad [[t:verifier|yoxlayan tərəf]] tətbiqi (`verify.tamga.network`) hamının istifadəsinə açıqdır; yoxlayan tərəflər öz yoxlama
proqram təminatını da işlədə bilərlər. Tamga host edilən siyahı indeksləmə xidməti təklif etmir.

## 4.4 Davamlı nəzarət

Şəffaflıq hesabatı, hədd xəbərdarlıqlarının ölçmələri, siyahıların dəyişiklik jurnalı, insident qeydi və müstəqil audit (dövlətin
qoşulmasından etibarən illik; məzmun paylama şəbəkəsi və qeydaparma konfiqurasiyası daxil — ortaq qeydlərdə fərdi məlumatların
olmadığının müstəqil yoxlayan tərəfcə təsdiqi).

## 4.5 Sanksiya pilləkəni

| Pillə | Nə | Qeyd |
|---|---|---|
| 1 | Xəbərdarlıq və aradan qaldırma müddəti (30 gün) | İnsident jurnalı |
| 2 | Sənəd növü səlahiyyətinin daraldılması (müəyyən növ üçün icazə siyahısının bağlanması) | Səlahiyyət pəncərəsi bağlanır |
| 3 | **Fəaliyyətin dayandırılması** | Siyahı və dəyişiklik jurnalı |
| 4 | **Çıxarılma** (varis təyin edilməklə) — ETSI görünüşündə "geri çəkilib" | Siyahı, dəyişiklik jurnalı və şəffaflıq hesabatı |
| 5 | Müqaviləyə xitam verilməsi; hüquqi vasitələr | §5 |

Çıxarılma **köhnə rəqəmsal sənədləri** etibarsız etmir (sənədin verildiyi tarix əsas götürülür); yalnız yeni sənədlərin verilməsi dayanır və varis
müəyyən edilmədikdə ləğv siyahısı dondurulur. Bu çərçivədə cərimə nəzərdə tutulmur; şura yaradıldıqda öz qərarı ilə tətbiq edə bilər.

## 4.6 İnsidentlərə reaksiya

| İnsident | Ciddilik | Reaksiya |
|---|---|---|
| Sənədi verən qurumun imza açarı sızıb | Kritik | Sənədi verən qurumun fəaliyyəti dayandırılır; sertifikat ləğv edilir; təsirə məruz qalan sənədlər ləğv siyahısında ləğv edilir; sənədlərin yenidən verilməsi planı; bildiriş |
| Siyahı imza açarına dair şübhə | Kritik | Rotasiya üçün nəzərdə tutulmuş ikinci sertifikata keçid; kök barmaq izi səhifəsi və şəffaflıq elanı |
| Rəqəmsal cüzdan həllində boşluq | Kritik və ya yüksək | Mərhələli: versiyaya görə rəqəmsal cüzdan sübutlarının ləğvi və ya tək bir cüzdan vahidinin ləğvi; sənədi verən qurumlar yeni sənəd verərkən onları rədd edir |
| Ləğv siyahısının dərci iki dövr buraxılıb | Yüksək | Yoxlayan tərəflər "yoxlanıla bilmədi" nəticəsini verir; operator müdaxilə edir |
| Sənəd növləri kataloquna giriş yoxdur | Orta | Keşdəki növ təsviri (bütövlük heşi ilə) yoxlamanı davam etdirir |

Ciddilik səviyyələri: **kritik** — etibarın özü təhlükədədir, ən geci 4 saat ərzində bildirilir; **yüksək** — bir xidmət və ya bir
iştirakçı təsirlənir, ən geci 24 saat ərzində bildirilir; **orta** — yoxlama davam edir, insident jurnalına daxil edilir. Bu struktur Aİ İcra
Reqlamenti 2025/847-nin qarşılığıdır. Fərdi məlumatların pozulması KVKK-ya 72 saat ərzində bildirilir.

## 4.7 Mübahisələr

İştirakçılar arasındakı mübahisə əvvəlcə sxem sahibi qarşısında (bu gün Tamga texniki komitəsi), sonra müqavilədə göstərilən yurisdiksiya yerində
həll edilir. Dövlətlər arasında şura səlahiyyətlidir; şəbəkə səviyyəsində yuxarı instansiya yoxdur. Şəxsin şikayəti sənədi verən quruma və məlumatların mühafizəsi
orqanına ünvanlanır.

---

# 5. Qat 5 — Müqavilələr

## 5.1 Müqavilələr toplusu

Şablonlar operatorda saxlanılır və müraciət zamanı quruma təqdim edilir; onların ictimaiyyətə açıq xülasələri aşağıda verilir.

| Müqavilə | Tərəflər | Xülasə |
|---|---|---|
| **İştirak müqaviləsi (sənədi verən qurum)** | Qurum ↔ sxem sahibi | Əhatə dairəsi, sinif və təminat, sənəd növü səlahiyyətləri, açarların idarə edilməsi (imza açarı qurumda), ləğv siyahısının dərci öhdəliyi, autentifikasiya səviyyələri, bildirişlər, KVKK əlavələri, xidmət səviyyələri, məsuliyyət, xitam, varislik |
| **Hostinq əlavəsi** | Qurum ↔ operator | Sənəd vermə xidməti operatorda işləyir, imza açarı qurumda qalır; operatorun jurnal aparma qaydaları; host edilən qurumların siyahısı ictimaiyyətə açıqdır; hostinq payı həddi |
| **Yoxlayan tərəf üçün istifadə şərtləri** | Yoxlayan tərəf ↔ sxem sahibi | Əhatə dairəsi, məlumatların minimallaşdırılması, həddindən artıq sorğu qadağası, sənəd sahələrinin və ləğv siyahısındakı mövqeyin qeydə alınmaması, birdəfəlik dəyər, "yoxlanıla bilmədi" nəticəsinin düzgün emalı, qeydiyyat məlumatlarının aktual saxlanılması |
| **Cüzdan provayderi müqaviləsi** | Cüzdan provayderi ↔ sxem sahibi | Cüzdan nümunəsi sübutu və açar sübutu, təhlükəsiz aparat səviyyəsi, yeniləmə və ləğv müddətləri, bərpa açarının saxlanılmaması |
| **Məlumatların emalı müqaviləsi** | Sənədi verən qurum ↔ səlahiyyətli mənbə və ya operator (məlumatları emal edən) | KVKK maddə 12; uyğunlaşdırma cədvəli; saxlama müddətləri |
| **Pilot iştirakçı bildirişi** | Pilot iştirakçıları | Pilotun hüdudları sadə dildə: etibar bu gün imzalanmış siyahılara əsaslanır, lövbər tək operatordadır, ləğv bir neçə dəqiqəyə qüvvəyə minir, iştirak könüllüdür, razılıq istənilən an geri götürülə bilər |
| **Varislik müqaviləsi** | Operator ↔ əmanətçi və ya şura | Domen adı, kök sertifikatlar, siyahı arxivi, açarların ötürülməsi |

Hər müqavilə bu çərçivəyə və Tamga Rulebook-a istinad edir; onlar dəyişərsə, müqavilənin müvafiq əlavəsi də yenilənir. Əsas
öhdəliyi dəyişdirən versiya yenidən imzalanma tələb edir (§8).

## 5.2 Xidmət səviyyələri

| Xidmət | Hədəf |
|---|---|
| Etibar siyahılarına giriş (`trust.`) | Aylıq 99,9%; növbəti yeniləmə ən geci 90 gün sonra; dəyişiklik ən geci 24 saat ərzində |
| Lövbər jurnalı | Saatlıq; buraxılan dövr ən çox bir |
| Sənəd növləri kataloqu (`schemas.`) | 99,9%; dərc olunmuş fayl dəyişmir |
| Sənədi verən qurumun ləğv siyahısının dərci | Sabit interval (2 dəqiqə); iki dövr buraxılarsa, yüksək ciddilik |
| İnsident bildirişi | Kritik: ən geci 4 saat; yüksək: ən geci 24 saat |
| Qeydiyyat dəyişikliyi (qeydiyyat orqanı) | Ən geci 5 iş günü |

Bu rəqəmlər pilot məlumatları əsasında nəzərdən keçirilir; dəyişiklik yeni versiya ilə dərc olunur.

## 5.3 Məsuliyyətin bölüşdürülməsi

| Kim | Nəyə görə məsuliyyət daşıyır | Təminatla əlaqəsi |
|---|---|---|
| Sənədi verən qurum | Rəqəmsal sənədin məzmununun doğruluğu; autentifikasiyanın növün tələb etdiyi səviyyədə aparılması; vaxtında ləğv | I3 və kvalifikasiyalı sənədlərdə "doğruluq prezumpsiyası"; I1-də sübut yükü yoxlayan tərəfin üzərindədir |
| Səlahiyyətli mənbə | Mənbə məlumatlarının doğruluğu | Sənədi verən quruma qarşı, müqavilə əsasında |
| Cüzdan provayderi | Rəqəmsal cüzdan sübutlarındakı bəyanların doğruluğu; açar mühafizəsinin bəyan edilmiş səviyyədə olması | W2 və ya W3 bəyanı yanlışdırsa, məsuliyyət provayderin üzərindədir |
| Yoxlayan tərəf | Öz siyasətini düzgün tətbiq etməsi; "yoxlanıla bilmədi" nəticəsini qəbul kimi saymaması; əhatə dairəsinə riayət etməsi | Yüksək riskli əməliyyatda əlavə şəxsiyyət yoxlaması yoxlayan tərəfin öhdəliyidir |
| Operator (siyahı operatoru və qeydiyyat orqanı) | Siyahının bütövlüyü, dərc intervalı, qeydiyyatın doğruluğu, şəffaflıq | Qəsd və kobud ehtiyatsızlıq istisna olmaqla məhduddur (pilot iştirakçı bildirişi) |
| Sənəd sahibi | PIN və cihaz təhlükəsizliyi; "sənədiniz rəqəmsal cüzdana əlavə edildi" bildirişinə etiraz | — |

## 5.4 Konfidensiallıq və əqli mülkiyyət

Kod Apache-2.0, sənədləşmə isə CC BY 4.0 lisenziyası ilə yayılır; sənəd növləri kataloqu açıqdır və güzgülənə bilər. "Tamga" brendinin və "Tamga Network-da siyahıdadır"
göstəricisinin istifadəsi iştirak qaydalarına tabedir (RB-WP-18); qurumlara aid məlumatlar konfidensialdır.

## 5.5 Ödənişlər (istiqamət qərarı)

<!-- KARAR BEKLİYOR: katılım ücreti -->

**Fiziki şəxslər üçün ödənişsizdir** (eIDAS 2.0-da olduğu kimi). Qurumlar üçün ödəniş strukturu pilotun sonunda iştirak müqaviləsi ilə müəyyən edilir;
pilot ödənişsizdir.

## 5.6 Xitam və çıxış

Könüllü çıxış §3.3-də olduğu kimidir; xitam verildikdə ləğv siyahısı dondurulur və ya varisə keçir; mövcud rəqəmsal sənədlər etibarsız sayılmır;
fərdi məlumatların saxlanma müddətləri KVKK-ya uyğundur.

## 5.7 Təhvil (varislik)

Domen adı fond yaradıldıqda fondun adına, o vaxta qədər isə müvəqqəti operatorun adına qeydiyyatdadır; transfer kilidi və DNSSEC
tətbiq edilir və ən azı 10 il əvvəlcədən yenilənir. Operator ləğv edildikdə və ya dövlətə təhvil verildikdə domen adı, kök sertifikatlar,
siyahı arxivi və açar əmanəti şuraya və ya əmanətçiyə keçir.

## 5.8 Yurisdiksiya

Qurum ilə operator arasındakı müqavilələrdə qurumun yerləşdiyi dövlətin hüququ əsas götürülür; Türkiyədəki qurumlar üçün İstanbul
məhkəmələri səlahiyyətlidir. Dövlətlər arasında şura səlahiyyətlidir; şəxsin hüquqları üçün şəxsin öz dövlətinin hüququ tətbiq edilir.

---

# 6. Qarşılıqlı uyğunluq (üç səviyyə)

| Səviyyə | Tamga-da |
|---|---|
| 1. Daşınma qabiliyyəti | SD-JWT VC və OpenID4VC; Aİ rəqəmsal cüzdanı Tamga rəqəmsal sənədini texniki cəhətdən emal edə bilər |
| 2. Etibar | Etibar siyahısı (ETSI TS 119 612 mənasında); ETSI TS 119 602 görünüşü; ETSI TS 119 612 XML görünüşü ([[ADR-0066]]; sandbox-da dərc olunur, real şəbəkədə poçt ünvanları tamamlandıqdan sonra); kök barmaq izləri; xarici siyahı sahəsi |
| 3. Hüquqi tanınma | Dövlətlər arasında birtərəfli tanınma; Aİ ilə yalnız dövlətlərarası eIDAS Maddə 14 sazişi (etibar xidmətləri; uzunmüddətli perspektivdə). Şəbəkə bu sazişin tərəfi deyil |

## 6.1 Xarici siyahılar (federasiya)

Ölkə siyahısının və ya başqa etibar siyahısının (məsələn, bir dövlətin, dövlətin səlahiyyət verdiyi qurumun və ya Aİ-nin
siyahısı) sahibi Tamga olmalı deyil. Belə siyahı siyahılar siyahısında dörd məlumatla göstərilir:

- **Ünvan:** siyahının orijinal nəşr ünvanı. Tamga əlavə olaraq onun surətini saxlayır; surət məzmunu dəyişdirə bilməz, çünki imza hər halda
  orijinal imzalayana qarşı yoxlanılır.
- **Sabitlənmiş imzalayan:** siyahını imzalayan sertifikatların barmaq izləri. Barmaq izləri Tamga-nın imzaladığı siyahılar
  siyahısında yer alır; imzalayanı uyğun gəlməyən siyahı yüklənmir.
- **Əhatə dairəsi:** siyahının hansı rollara (cüzdan provayderi, şəxsiyyət provayderi, sənədi verən qurum, giriş sertifikatı provayderi) və
  hansı rəqəmsal sənəd növlərinə zəmanət verə biləcəyi. Sənədi verən qurumların sinfi, təminat səviyyəsi və tanınması da əhatə dairəsindən irəli gəlir.
- **Təsdiq:** siyahının hansı qərarla və hansı tarixdə əlavə edildiyi.

Siyahı sahibində qalır; Tamga yalnız onu göstərir. Hər xarici siyahının aktuallığı ayrıca izlənilir: biri çatışmasa və ya köhnəlsə belə,
Tamga siyahıları və digər siyahılar təsirlənmir; yalnız həmin siyahıya bağlı sorğular "hazırda yoxlanıla bilmir" nəticəsini verir. İlk oxunan
format ETSI TS 119 602 ([[t:LoTE]], JSON) formatıdır.

| Kod | Qayda |
|---|---|
| FD1 | Xarici siyahı yalnız Tamga tərəfindən imzalanmış siyahılar siyahısında ünvanı, sabitlənmiş imzalayan barmaq izi və əhatə dairəsi ilə göstərilir; imzalayanı orada yazılanla uyğun gəlməyən siyahı yüklənmir. |
| FD2 | Xarici siyahı əhatə dairəsindən kənar rollara və rəqəmsal sənəd növlərinə zəmanət verə bilməz; əhatə dairəsindən kənar qeydlər nəzərə alınmır. |
| FD3 | Xarici siyahının çatışmaması, köhnəlməsi və ya yoxlanıla bilməməsi Tamga siyahılarının aktuallığını pozmur; həmin siyahıya bağlı hər sorğu "naməlum" cavabını qaytarır. |
| FD4 | Xarici siyahının əlavə edilməsi, dəyişdirilməsi və ya çıxarılması layihə rəhbərliyinin təsdiqi ilə həyata keçirilir və qeyddə göstərilir; boş sahə olan qeyd dərc edilmir. |
| FD5 | Tamga rəqəmsal sənəd növlərində növ təsvirinin bütövlük xülasəsi məcburidir; xarici növlərdə növə etibar xarici siyahının imzalanmış qeydindən irəli gəlir. |

Bu mexanizm və xarici siyahının əlavə edilməsi ayrı qərarlardır: mexanizm hazırdır, hansı siyahıya etibar ediləcəyi hər siyahı üçün
ayrıca qərara alınır.

---

# 7. Təhvil planı — TDT üzv dövlətlərinə

| Addım | Nə ötürülür | Necə |
|---|---|---|
| 1 | Milli siyahı operatorluğu | Siyahıdakı operator sahəsi dəyişir; kök, qurum və rəqəmsal sənəd növü identifikatorları sabit qalır; dövlətə məxsus yeni imza sertifikatı növbəli şəkildə əlavə edilir |
| 2 | Qeydiyyat qurumu | Qeydiyyat səlahiyyəti dövlətə keçir; Tamga artıq qeydiyyat apara bilməz |
| 3 | Milli kök sertifikat | Kökün adı sabit qalır, operatoru dəyişir; ya da dövlətin kökü növbəli şəkildə əlavə edilir və köhnə kök istifadədən çıxarılır |
| 4 | PID provayderi yeri | Dövlət doldurur; yüksək şəxsiyyət yoxlaması səviyyələri (yoxlayan tərəf üçün etibar mənbəyi kimi) PID-ə keçir |
| 5 | Ortaq reyestr | Ən azı iki müstəqil operatorla reyestr mərhələsi; dövlət operatorları ilə dövlətin qoşulması; siyahı arxivi olduğu kimi köçürülür və ekvivalentlik testlərindən keçir |
| 6 | Bu sənəd | Şuranın mülkiyyətinə keçir; versiya nömrələnməsi davam edir |

Təhvil heç bir rəqəmsal sənədi, qeydi və ya identifikatoru etibarsız etmir.

---

# 8. Bu sənədə dəyişikliklərin idarə edilməsi

- Versiyalaşdırma: semantik versiyalaşdırma; əsas versiya iştirakçı öhdəliyi dəyişdikdə (yenidən imza tələb olunur), ara versiya yeni qayda və ya
  rol əlavə edildikdə, yamaq versiyası düzəlişdə artır.
- Hər dəyişiklik qərar qeydinə əsaslanır və Tamga ARF-in "Nə dəyişdi" səhifəsində dərc edilir.
- Dərc yeri **`arf.tamga.network`**-dır; etibar siyahılarındakı çərçivə keçidi versiyalı ünvanı daşıyır.

---

# 9. Pilot məlumatları ilə nəzərdən keçiriləcək mövzular

Aşağıdakı müddəalar qüvvədədir; onların rəqəmləri və təfərrüatları pilot məlumatları ilə nəzərdən keçirilir və dəyişiklik yeni versiya ilə
dərc edilir.

| Mövzu | Bölmə |
|---|---|
| Qarışıq uyğunluq rejimi (keyfiyyətli rəqəmsal sənədlər üçün əvvəlcədən, digərləri üçün sonradan yoxlama) | §4.1 |
| ISO/IEC 17000 rollarının uyğunlaşdırılması | §4.2 |
| Məsuliyyətin bölüşdürülməsi | §5.3 |
| Sanksiya pilləsi, aradan qaldırma müddətləri və xidmət səviyyəsi rəqəmləri | §4.5, §5.2 |
| Məlumatların mühafizəsi qurumuna şikayət yolunun rəqəmsal cüzdanda göstərilməsi | §3.6 |
| Hüquqi ekspertiza | §1.4 |
| Yurisdiksiya | §5.8 |

---

# Mənbələr

Bu sənədin əsaslandığı qərarlar, spesifikasiyalar və standartlar Əlavə E-də sadalanır.

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
