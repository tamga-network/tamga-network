---
document_id: FW-ARF-0001
title: "Arxitektura və İstinad Çərçivəsi"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-23
summary: >
  Tamga Network-un arxitektura və istinad çərçivəsinin əsas sənədi. Avropa İttifaqının (Aİ) EUDI ARF-i ilə eyni strukturu izləyir: istifadə ssenariləri, rollar, arxitektura, məlumat modeli, etibar modeli, təhlükəsizlik və idarəetmə. Məcburi qaydalar əlavələrdədir (A Trust Framework, B Tamga Rulebook, C rəqəmsal sənəd növü rulebook-ları); terminlər Əlavə D-də, mənbələr Əlavə E-dədir.
translation_of: FW-ARF-0001
source_version: "1.0.0"
---

# 1. Giriş

## 1.1 Məqsəd və əhatə dairəsi

Tamga Network Türk dünyası üçün rəqəmsal etibar infrastrukturudur. Qurumların (universitet, peşə təşkilatı, dövlət qurumu,
şirkət) şəxslərə verdiyi rəqəmsal sənədlər elektron atribut sənədi kimi verilir, şəxsin rəqəmsal cüzdanında saxlanılır və üçüncü tərəflər
onları mənbəyə müraciət etmədən, saniyələr ərzində yoxlayır.

Bu sənəd Tamga ekosisteminə qoşulan qurumun, tənzimləyicinin və ya inteqratorun istinad etdiyi arxitektura mənbəyidir. Kimin hansı
rolda iştirak etdiyini, etibarın haradan gəldiyini, rəqəmsal sənədlərin hansı formatda daşındığını və hansı axınlarla verilib
təqdim edildiyini izah edir. Texniki təfərrüatlar (məlumat strukturları, protokol profilləri, interfeyslər) tərtibatçı sənədlərindədir.

Sənədin özü qərar qəbul etmir. Arxitektura qərarları qərar qeydlərində (ADR), texniki qaydalar isə spesifikasiyalarda qəbul edilir; bu sənəd
və onun əlavələri onları iştirakçının oxuya biləcəyi vahid yerdə toplayır.

## 1.2 Kimlər üçün

Bu çərçivə rəqəmsal sənəd verən və yoxlayan qurumlar, cüzdan provayderləri, dövlətlər və tənzimləyicilər, auditorlar və
inteqratorlar üçün yazılıb. Rolunuza görə hansı bölmələri hansı ardıcıllıqla oxumalı olduğunuz **Oxuma yolu** səhifəsindədir
([[FW-READ-0001]]); rolların təfərrüatı **Rollar** ([[FW-ROLE-0001]]), qoşulma addımları isə **Qoşulma prosesi**
([[FW-ONB-0001]]) səhifəsindədir.

## 1.3 Sənədin strukturu

Tamga [[t:ARF]], Aİ ARF-i kimi, əsas sənəd və əlavələrdən ibarətdir:

| Sənəd | Məzmun |
|---|---|
| Əsas sənəd (bu sənəd) | İstifadə ssenariləri, rollar, arxitektura, məlumat modeli, etibar modeli, təhlükəsizlik, idarəetmə |
| Əlavə A — Trust Framework | İdarəetmə, qoşulma mərhələləri, uyğunluq, müqavilələr, ötürmə planı |
| Əlavə B — Tamga Rulebook | Bütün iştirakçılar və rəqəmsal sənəd növləri üçün ümumi, nömrələnmiş və məcburi qaydalar |
| Əlavə C — Rulebook-lar | Tamga Rulebook-dan törəyən rəqəmsal sənəd növü qaydaları: Education Rulebook (tələbə sənədi, diplom), Identity Rulebook (şəxsiyyət sənədi, sürücülük vəsiqəsi məlumatı), Event Ticket Rulebook (tədbir bileti), Contact Rulebook (e-poçt, telefon); Aİ Attestation Rulebook şablonunun strukturu ilə |
| Əlavə D — Təriflər | Terminlər və abbreviaturlar |
| Əlavə E — Mənbələr | Standartlar, qərar qeydləri, spesifikasiyalar və qayda mənbələri |
| Siyasətlər | Ləğv Siyasəti; Cüzdan Sübutu Siyasəti (WIA və KA) |
| Oxuma yolu · Rollar · Qoşulma prosesi | Köməkçi səhifələr: hər rol üçün oxuma ardıcıllığı, rolların təfərrüatı, qoşulma addımları |

Türkcə mətn mənbədir; ingiliscə mətn eyni versiyanın rəsmi tərcüməsidir. Hər iki dil həmişə eyni versiyadadır.
Qaydalardakı MUST, MUST NOT, SHOULD və MAY ifadələri RFC 2119 mənasındadır.

## 1.4 eIDAS 2.0 və Aİ ARF ilə əlaqə

Tamga-nın texniki qatı Avropa İttifaqının (Aİ) Avropa Rəqəmsal Şəxsiyyət Cüzdanı ekosistemi ilə eynidir: eyni rəqəmsal sənəd formatları, eyni
protokollar, eyni [[t:trust-list]] modeli və eyni rollar toplusu istifadə olunur. İdarəetmə qatı isə türk dünyası üçün yazılır: hər
dövlət öz qeydlərinin yeganə sahibidir və dövlətlər bir-birini tanıma yolu ilə birgə işləyir.

"[[t:EUDI-Wallet]]" Aİ üzv dövlətinin təqdim etdiyi və ya tanıdığı və Aİ qaydalarına əsasən sertifikatlaşdırılan cüzdanın hüquqi adıdır. Aİ-dən
kənar təşkilatın cüzdanı bu statusu ala bilməz və Aİ etibar nişanından istifadə edə bilməz. Buna görə Tamga Wallet "Aİ ilə uyğun rəqəmsal cüzdan"
kimi təsvir olunur; uyğunluq birgə işləmə qabiliyyəti testləri ilə nümayiş etdirilir.

## 1.5 Mövqe

Tamga üç qatda mövqe tutur və hər qat ayrılıqda da öz dəyərini saxlayır:

1. **Baza — Aİ ilə uyğunluq.** Rəqəmsal sənədlər, protokollar və etibar siyahıları Aİ standartlarına uyğundur. Şəbəkə heç böyüməsə belə, bu qat qurumlar
   və cüzdanlar üçün dəyər daşıyır.
2. **Tamga Network — yüngül etibar federasiyası.** Şəbəkə ölkə etibar siyahılarını toplayır və onları bir-birinə tanıdır; dərc edilmiş
   qaydalara əməl edən hər cüzdan provayderini tanıyır. Bu gün Türkiyə siyahısını Tamga müvəqqəti olaraq, dövlət adından idarə edir. Dövlətlər
   qoşulduqca siyahılar onlara ötürülür, idarəetmə qurumu yaradılır və ortaq reyestr (zəncir) işə düşür.
3. **Şəbəkənin üzərindəkilər.** Şəbəkənin qaydalarına əməl edən cüzdanlar və xidmət provayderləri. Tamga Wallet şəbəkənin ilk
   cüzdanıdır; bir şirkətin ayrıca məhsuludur və Aİ ilə uyğun istənilən mühitdə işləyir. Tamga Network xidmət satmır: şəbəkə qaydaları, etibar siyahılarını,
   açıq kodu və istinad xidmətlərini (host edilən rəqəmsal sənəd vermə, Qurum Konsolu, host edilən [[t:verifier]] Tamga Verify) idarə edir;
   inteqrasiya, dəstək və məsləhət kimi kommersiya xidmətləri şəbəkədən kənar şirkətlər tərəfindən, öz adları ilə təqdim olunur ([[ADR-0037]]).

## 1.6 Prinsiplər

| # | Prinsip |
|---|---|
| P1 | Hər dövlət öz milli qeydlərinin yeganə müəllifidir. Şura yaradıldıqda şəbəkəyə üzvlük üzv dövlətlərin üçdə iki səsi ilə olur; o vaxta qədər müvəqqəti operator idarə edir (§8.3). Transsərhəd tanınma birtərəflidir. |
| P2 | Heç bir ortaq qeyddə fərdi məlumatlar yoxdur: etibar siyahısında, lövbər jurnalında, zəncirdə və qeydlərdə rəqəmsal sənədin məzmunu və ya onun həşi də yoxdur. |
| P3 | Texniki qat Aİ standartları ilə eynidir; Tamga-ya xas hər əlavə standart genişləndirmə nöqtəsi vasitəsilə həyata keçirilir. |
| P4 | Heç bir identifikator, rol və ya struktur vahid operator fərziyyəsinə əsaslanmır; Tamga-nın üzərinə götürdüyü hər dövlət rolu ötürülə bilən şəkildə layihələndirilir. |
| P5 | Ortaq reyestr saxlama seçimi deyil, imzalayan seçimidir: bu gün etibar imzalanmış siyahılardan gəlir; ən azı iki müstəqil operator olduqda zəncir qurulur. |
| P6 | Hər rəqəmsal sənəd cihazın təhlükəsiz zonasındakı açara bağlıdır; kopyalana və başqasına ötürülə bilməz. |
| P7 | Kodla məhdudlaşdırıla bilməyən hər səlahiyyət (hostinq, domen adı, qeydlərin saxlanması, statistika) siyasət, ölçülə bilən ötürmə həddi və şəffaflıq hesabatı ilə məhdudlaşdırılır. |

## 1.7 Əhatə dairəsindən kənar

Bu versiyada əhatə dairəsindən kənarda qalanlar: şəxsiyyət məlumatlarının ([[t:PID]]) verilməsi (bu rol dövlətə ayrılıb), ödəniş və dəyər köçürməsi,
qurumların sənəd sahibi olduğu qurum cüzdanı, W3C VCDM/JSON-LD formatında ikinci təqdimat və kvalifikasiyalı elektron imza. Bunlar
yol xəritəsindədir və ayrıca qərarlarla açılır.

---

# 2. İstifadə ssenariləri və funksiyalar

## 2.1 Rəqəmsal sənədin alınması

Şəxs rəqəmsal sənədi iki yolla alır:

- **Qurumun başlatdığı vermə.** Qurum təklif yaradır və onu şəxsə QR kod və ya keçid kimi göndərir. Şəxs onu rəqəmsal cüzdanla
  skan edir; təklif birdəfəlikdir və lazım gələrsə ayrıca kanalla göndərilən əməliyyat kodu ilə qorunur.
- **Cüzdanın başlatdığı vermə.** Şəxs cüzdanda qurumu seçir və rəqəmsal sənədini tələb edir. Qurum şəxsin kimliyini cüzdandakı
  yoxlanılmış şəxsiyyət sənədinin təqdimatı ilə uyğunlaşdırır və məlumatları imzalama anında öz sistemindən ([[t:authentic-source]]) oxuyur. Şəxsə aid
  məlumatlar Tamga-da saxlanılmır.

Hər iki yolda cüzdan cüzdan provayderinin imzaladığı cüzdan instansiyası sübutunu ([[t:WIA]]) təqdim edir; qurum yalnız etibar siyahısında tanınan
provayderlərin cüzdanlarına rəqəmsal sənəd verir. Rəqəmsal sənədlər bir neçə nüsxə şəklində verilir; cüzdan hər yoxlayan tərəfə ayrıca nüsxə təqdim edir.
Qurumun elan etdiyi şərtlər daxilində cüzdan istifadəçidən soruşmadan nüsxələri yeniləyir.

## 2.2 Məsafədən təqdimat

Yoxlayan tərəf (işəgötürən, veb-sayt, qurum) cüzdandan rəqəmsal sənəd tələb edir. Sorğu imzalıdır və yoxlayan tərəfin qeydiyyatdan keçmiş kimliyini daşıyır.
Cüzdan yoxlayan tərəfin etibar siyahısındakı qeydini və qeydiyyat sertifikatını yoxlayır, tələb olunan sahələri və məqsədi şəxsə göstərir,
qeydin icazə verdiyindən artıq sahə tələb olunarsa xəbərdarlıq edir; sorğuda qeydiyyat sertifikatı yoxdursa, onu rədd edir (RB-WP-19). Şəxs PIN və ya biometriya ilə təsdiqləyir; cavab şifrələnmiş şəkildə göndərilir və
yalnız təsdiqlənmiş sahələri ehtiva edir.

Yoxlayan tərəf öz yoxlama proqram təminatını işlədə və ya Tamga Verify-dan (host edilən yoxlayan tərəf xidməti) istifadə edə bilər. Təqdimat
cüzdan keçidi ilə (eyni cihazda) və ya başqa cihazda QR kodla həyata keçirilir. Brauzer vasitəsilə təqdimat (Digital Credentials
API) üçün yoxlayan tərəf hazırdır; şəbəkədəki ilk cüzdanda Android kodu yazılıb, hələ tətbiqə daxil edilməyib və cihazda sınaqdan keçirilməyib; iOS hələ yoxdur.

## 2.3 Üzbəüz təqdimat

Qapı, kampus girişi və ya kassa kimi yerlərdə rəqəmsal sənəd yaxın məsafədə təqdim olunur. Daimi həll ISO/IEC 18013-5 standartının
Bluetooth yaxın məsafə axınıdır. Bu axın kodlaşdırılıb, cihaz testi gözlənilir; istifadəyə verilənədək qısamüddətli, əhatəsi məhdud
keçid kartlarından istifadə olunur.

## 2.4 Veb-saytlara giriş

"Tamga ilə daxil ol" vasitəsilə sayt (yoxlayan tərəf) qeydiyyat zamanı yalnız icazə verilən sahələri (məsələn, ad və soyad) alır. Hesab açarı
sayta xas psevdonimdir: iki fərqli sayt eyni şəxsi uyğunlaşdıra bilməz. [[t:pseudonym|Psevdonim]] şəxsiyyətdən törədildiyi üçün şəxs telefonunu
dəyişib şəxsiyyətini yenidən təsdiqlədikdə eyni psevdonimlər geri qayıdır. Gündəlik giriş passkey ilə edilir və heç bir rəqəmsal sənəd
sahəsi paylaşılmır.

## 2.5 Bilet və qapı

Tədbir bileti cüzdana fərdi məlumatlar olmadan gəlir. Qapıda bilet birdəfəlikdir: ilk keçiddən sonra bilet istifadə olunmuş sayılır, eyni
biletin ikinci dəfə istifadəsi rədd edilir.

## 2.6 Sıfır bilik sübutu ilə yaş yoxlaması

Şəxs doğum tarixini və ya şəxsiyyət nömrəsini göstərmədən "18 yaşdan böyüyəm" məlumatını sübut edə bilər. Rəqəmsal cüzdan qurumun
imzaladığı rəqəmsal sənədi dəyişmədən bu sənəd haqqında sıfır bilik sübutu yaradır. Yoxlayan tərəf yalnız etibar siyahısında
dərc olunan sübut sxemlərini qəbul edir. Yoxlayan tərəf hissəsi istifadəyə verilib. Cüzdan tərəfi şəbəkənin açıq sübut paketinə qoşulub;
Android yerli kitabxanası hazırdır, iOS kitabxanası gözlənilir; cihaz testi hələ aparılmayıb. Sübut dəstəklənmədikdə
təqdimat adi qaydada aparılır.

## 2.7 Şəxsin nəzarəti

- **Tarixçə.** Şəxs hansı sənədi kimə, nə vaxt və hansı sahələrlə göstərdiyini rəqəmsal cüzdanda görür. Tarixçə cihazda qalır;
  yalnız şəxsin özünün başlatdığı, parolla qorunan fayl vasitəsilə ixrac edilir.
- **Silmə.** Şəxs rəqəmsal cüzdanı sıfırlayaraq Tamga-nın şəxsiyyət xidmətindəki qeydini, [[t:wallet-provider|cüzdan provayderindəki]]
  vahid qeydini (cüzdanı təqdim edən qurumda) və cihazdakı bütün məlumatlarını silir.
- **Qurumdan silmə tələbi və şikayət.** Şəxs rəqəmsal cüzdan vasitəsilə qurumdan məlumatlarını silməsini tələb edə bilər; yoxlayan tərəfin
  tabe olduğu məlumatların qorunması orqanına şikayət yolunu da cüzdanda görür.

## 2.8 Funksiyaların vəziyyəti

| Funksiya | Vəziyyət |
|---|---|
| Qurum və cüzdan tərəfindən başladılan sənəd verilməsi, uzaqdan təqdimat, Tamga Verify | İstifadəyə verilib |
| Veb saytlara giriş, hər sayt üçün ayrıca psevdonim | İstifadəyə verilib |
| Bilet və birdəfəlik giriş keçidi | İstifadəyə verilib |
| Məlumatların silinməsi, tarixçə, ixrac | İstifadəyə verilib |
| Sıfır bilik sübutu — yoxlayan tərəf hissəsi | İstifadəyə verilib |
| Sıfır bilik sübutu — cüzdan tərəfi | Cüzdana qoşulub; Android yerli kitabxanası hazırdır, iOS gözlənilir; cihaz testi hələ aparılmayıb |
| Bluetooth ilə yaxın məsafədən təqdimat | Kodlaşdırılıb; cihaz testi gözlənilir |
| Brauzer vasitəsilə təqdimat (Digital Credentials API) | Yoxlayan tərəf hazırdır; ilk siyahıdakı cüzdanda Android kodu yazılıb, hələ tətbiqə daxil edilməyib və cihazda sınaqdan keçirilməyib; iOS yoxdur |
| Aparat açarları və cihaz sübutu | Kodlaşdırılıb; cihaz testi gözlənilir |
| Sandbox (hamı üçün açıq; şəxsiyyətin təsdiqi gündəlik/aylıq limitlə) | İstifadəyə verilib |
| Sənədi verən qurumun paylaşım qaydası (daxil edilmiş açıqlama siyasəti) | İstifadəyə verilib (paketlər npm-də 0.5.0-dan bəri) |
| Qurumun cüzdan sübutu üstünlükləri (açar anbarı tələbi, ləğv üçün yeniləmə müddəti) | İstifadəyə verilib (paketlər npm-də 0.5.0-dan bəri) |
| Aİ-nin köhnə etibar siyahısı formatı (ETSI TS 119 612, XML) və cüzdanda xarici siyahılar | İstifadəyə verilib (paketlər npm-də 0.5.0-dan bəri) |
| Attestation Revocation List (identifikatorlar siyahısı) — yoxlayan tərəf və cüzdan tərəfi | İstifadəyə verilib (paketlər npm-də 0.5.0-dan bəri); Tamga-da sənədi verən qurumlar Status List istifadə edir |
| Şəxsiyyət sənədində dayandırma yoxdur, mdoc üçün CWT ləğv siyahısı; qeydiyyat sertifikatı olmayan sorğuda xəbərdarlıq; yaxın məsafədə oxuyucunun yoxlanılması | İstifadəyə verilib (paketlər npm-də 0.6.0-dan bəri) |
| Paket API-lərində təhlükəsiz standart parametrlər; qeydiyyat sertifikatı olmayan sorğunun rədd edilməsi ([[ADR-0056]]) | İstifadəyə verilib (paketlər npm-də 0.7.0-dan bəri) |
| Bir giriş tokeni ilə bir neçə sənəd sorğusu, cüzdan nümunəsinin açarına bağlı yeniləmə tokeni, ayrıca konfiqurasiya ilə təxəllüs toxumu ([[ADR-0059]], [[ADR-0060]], [[ADR-0061]]) | İstifadəyə verilib (paketlər npm-də 0.7.2-dən bəri) |
| Cüzdan provayderinin qeydiyyatı | Tamga Wallet-ın provayderi (`TAMGA-WP-1`) real və sandbox etibar siyahılarında `ACTIVE` |

---

# 3. Rollar

Rollar dəsti Aİ ARF-dən götürülüb. Hər milli siyahı bu rolların hər biri üçün yer ayırır; boş qalsa da, yer mövcuddur.
Tamga-nın bu gün üzərinə götürdüyü dövlət rolları müvəqqətidir və dövlət adından həyata keçirilir.

| Rol (Aİ adı) | Tərif | Bu gün | Dövlət qoşulduqda |
|---|---|---|---|
| Etibar siyahısının operatoru (Trusted List Scheme Operator) | Milli etibar siyahısını tərtib edir, imzalayır və dərc edir | Tamga, dövlət adından müvəqqəti | Milli orqan və ya onun səlahiyyət verdiyi qurum |
| Qeydiyyat qurumu (Registrar) | Sənədi verən qurumları, yoxlayan tərəfləri və cüzdan provayderlərini qeydiyyata alır; hüquqi səlahiyyət vermir | Tamga, müvəqqəti | Dövlətin qeydiyyat qurumu |
| Milli kök sertifikat orqanı | Qurum sertifikatlarının köküdür | Tamga, müvəqqəti; kök identifikatoru təhvil zamanı dəyişmir | Dövlətin kökü və ya səlahiyyətli sertifikat provayderi |
| Giriş və qeydiyyat sertifikatı provayderi | Yoxlayan tərəflərə giriş və qeydiyyat sertifikatı verir | Tamga, müvəqqəti | Dövlət |
| Şəxsiyyət məlumatları provayderi (PID Provider) | Şəxsin şəxsiyyət məlumatlarını ən yüksək təminat səviyyəsində verir | Boş; Tamga bu rolu üzərinə götürmür | Dövlət |
| Müvəqqəti şəxsiyyət sənədi provayderi | PID provayderi olmadıqda uzaqdan şəxsiyyət təsdiqi ilə şəxsiyyət sənədi verir | Tamga şəxsiyyət xidməti | PID provayderi təhvil alır |
| Sənədi verən qurum (Attestation Provider) | Elektron atribut sənədi verir | Universitetlər, bilet satıcıları | Qurumlar və dövlət qurumları |
| Səlahiyyətli mənbə | Məlumatın əsl sahibi olan sistem | Qurumun öz sistemi | Eyni, həmçinin dövlət mənbələri |
| Cüzdan provayderi | Rəqəmsal cüzdanı təqdim edir; cüzdan nüsxəsi sübutunu və açar sübutunu imzalayır | Cüzdanı təqdim edən qurum (birincisi Tamga Wallet; ayrıca məhsul). Şəbəkə cüzdan provayderi idarə etmir, onları siyahıya salır | Qaydalara əməl edən istənilən provayder |
| Yoxlayan tərəf (Relying Party) | Rəqəmsal sənəd tələb edir və yoxlayır; qeydiyyatdadır və əhatə dairəsi məhduddur | İşəgötürən, veb sayt, qurum | Eyni |
| Vasitəçi yoxlayan tərəf (Intermediary) | Yoxlayan tərəf adından sənəd tələb edir və yoxlayır | Tamga Verify | Eyni |
| Sənəd sahibi (Holder) | Sənədi rəqəmsal cüzdanında saxlayır və kimə göstərəcəyinə qərar verir | Tələbə, məzun, istifadəçi | Vətəndaş |
| Reyestr operatoru | Ortaq reyestrin bir qovşağını idarə edir | Yoxdur | Ən azı iki müstəqil qurum |

Rolların ayrılması qaydası: Tamga yerləşdirdiyi heç bir xidmətdə qurumların imzalama açarını saxlamır. Sənəd vermə xidməti Tamga-da
işləsə də, sənədin imza açarı quruma məxsusdur. Hər rolun nə etdiyi, öhdəlikləri və nəyə ehtiyac duyduğu **Rollar**
səhifəsində verilib ([[FW-ROLE-0001]]).

---

# 4. Arxitektura

## 4.1 Komponentlər

| Komponent | Vəzifə | Sahibi |
|---|---|---|
| Rəqəmsal cüzdan | Şəxsin sənədlərini saxlayır, göstərir, tarixçəni və psevdonimləri idarə edir | Cüzdanı təqdim edən qurum; şəbəkənin ilk cüzdanı Tamga Wallet (ayrıca məhsul, açıq mənbə) |
| Cüzdan provayderi | Cüzdan vahidini qeydiyyata alır; cüzdan nüsxəsi sübutunu və açar sübutunu imzalayır | Cüzdanı təqdim edən qurum; şəbəkə idarə etmir, etibar siyahısına daxil edir (Tamga Wallet-ınkı cüzdanın operatorundadır, `provider.tamgawallet.com`) |
| Sənəd vermə xidməti | Qurumlar adından OpenID4VCI ilə sənəd verir, ləğv siyahılarını dərc edir | Yerləşdirilmiş xidmət (qurum öz xidmətini də işlədə bilər) |
| Qurum Konsolu | Qurum əməkdaşlarının sənədləri, qeydləri, API açarlarını və istifadəçiləri idarə etdiyi interfeys | Yerləşdirilmiş xidmət |
| Şəxsiyyət xidməti | Müvəqqəti şəxsiyyət sənədi verir; psevdonim toxumunu (seed) törədir | Tamga, müvəqqəti |
| Tamga Verify | Yoxlayan tərəflər adından sənəd tələb edir və yoxlayır | Yerləşdirilmiş xidmət (yoxlayan tərəf öz proqram təminatını da işlədə bilər) |
| Etibar siyahısı nəşriyyatçısı | Siyahılar siyahısını, milli siyahını və lövbər jurnalını imzalayır və dərc edir | Tamga, müvəqqəti |
| Sənəd növləri kataloqu | Sənəd növlərinin təriflərini və sxemlərini dəyişməz fayllar kimi dərc edir | Tamga |
| Açıq mənbəli paketlər | Sənəd formatları, etibar siyahısının oxunması, sənəd vermə və yoxlama kitabxanaları | Tamga (Apache-2.0) |
| Sandbox | Real şəbəkə ilə eyni qaydalarla işləyən yeganə test şəbəkəsi; ayrıca kökü və siyahıları var | Tamga |

Kitabxanalar açıqdır; yerləşdirilmiş xidmətlər operatordadır. Qurum öz sənəd vermə və ya yoxlama proqram təminatını
paketlərlə qura bilər; qaydalar eynidir.

Şəbəkə heç bir rəqəmsal cüzdanın tətbiqini, cüzdan provayderini və ya saytını idarə etmir; cüzdanları etibar siyahısındakı cüzdan
provayderi qeydləri vasitəsilə tanıyır. Sandbox yeganədir və şəbəkəyə məxsusdur: cüzdan, qurum və yoxlayan tərəf tərtibatçıları şəbəkənin qaydalarını
orada sınaqdan keçirir. Sandbox-da da cüzdan provayderini cüzdanın özü idarə edir; cüzdan tərtibatçısı öz provayderini sandbox siyahısında
qeydiyyatdan keçirir və cüzdanını sandbox-dakı nümunə qurumlar, şəxsiyyət xidməti və yoxlayan tərəflə sınaqdan keçirir.

## 4.2 Xidmət ünvanları

| Ünvan | Xidmət |
|---|---|
| `tamga.network` | Tanıtım saytı; kök açarların barmaq izləri `/trust-anchor` səhifəsində |
| `arf.tamga.network` | Bu çərçivə və onun əlavələri |
| `docs.tamga.network` | Tərtibatçı sənədləri |
| `trust.tamga.network` | Etibar siyahıları, lövbər jurnalı, arxiv |
| `schemas.tamga.network` | Sənəd növləri kataloqu |
| `issuer.tamga.network/{kurum}` | Yerləşdirilmiş sənəd vermə xidməti |
| `status.tamga.network` | Ləğv (status) siyahıları |
| `console.tamga.network` | Qurum Konsolu |
| `verify.tamga.network` | Tamga Verify |
| `id.tamga.network` | Şəxsiyyət xidməti |
| `*.sandbox.tamga.network` | Sandbox: eyni xidmətlərin test nüsxələri (`trust.sandbox`, `issuer.sandbox`, `verify.sandbox`, `id.sandbox` …) |

Şəbəkənin domen adlarında yalnız şəbəkənin xidmətləri işləyir; şəbəkə cüzdan provayderi idarə etmir. Hər cüzdanın provayderini cüzdanı təqdim edən
qurum öz domen adında idarə edir (Tamga Wallet-ınkı `provider.tamgawallet.com`); şəbəkə onu etibar siyahısına daxil edir.

Domen adı xidmətin ünvanıdır, identifikator deyil. Qurum öz domen adına keçdikdə qeydindəki ünvan dəyişir; qurumun
identifikatoru və verdiyi sənədlər dəyişmir.

## 4.3 Sənəd vermə axını

1. Qurum təklif yaradır və ya şəxs rəqəmsal cüzdandan sənəd tələb edir.
2. Cüzdan icazə tələb edir; lazım olduqda əməliyyat kodunu və ya şəxsiyyət sənədinin təqdimatını əlavə edir.
3. Cüzdan sənədin bağlanacağı açarları, cüzdan nüsxəsi sübutunu və açar sübutunu göndərir.
4. Sənəd vermə xidməti bu sübutları etibar siyahısına, sənədin məzmununu isə kataloqdakı sxemə qarşı yoxlayır, sənədi
   qurumun açarı ilə imzalayır və hər nüsxə üçün ləğv siyahısında yer ayırır.
5. Şəxsə "sənədiniz rəqəmsal cüzdana əlavə edildi; bu siz deyilsinizsə, bildirin" bildirişi göndərilir.

## 4.4 Təqdimat və yoxlama axını

1. Yoxlayan tərəf imzalı sorğu yaradır; sorğuda yoxlayan tərəfin qeydiyyatdakı identifikatoru, tələb olunan sahələr və birdəfəlik
   dəyər olur.
2. Rəqəmsal cüzdan yoxlayan tərəfin qeydiyyatını yoxlayır, şəxsə göstərir və onun razılığını alır.
3. Rəqəmsal cüzdan rəqəmsal sənədin bu yoxlayan tərəfə aid nüsxəsini bu sorğuya bağlı cihaz imzası ilə göndərir.
4. Yoxlayan tərəf aşağıdakı yoxlama ardıcıllığını icra edir və üç nəticədən birini verir: qəbul, rədd və ya "hazırda yoxlanıla bilmədi".

| Addım | Yoxlama |
|---|---|
| İlkin şərt | Etibar siyahısı təzədirmi; deyilsə, nəticə "yoxlanıla bilmədi" olur |
| Struktur | İmza zənciri kök sertifikata çatırmı, açıqlanan sahələr rəqəmsal sənədlə uyğun gəlirmi, cihaz imzası bu sorğuya aiddirmi |
| Növ | Rəqəmsal sənədin növü kataloqdakı təsvirə və sxemə uyğundurmu |
| Etibar | Qurum rəqəmsal sənədin verildiyi tarixdə siyahıda aktiv idimi, bu növü verməyə səlahiyyətli idimi |
| Status | Rəqəmsal sənəd ləğv edilibmi və ya dayandırılıbmı |
| Siyasət | Rəqəmsal sənədin növü və qurum sinfi yoxlayan tərəfin siyasətinə uyğundurmu, tələb olunan sahələr onun qeydiyyatının əhatəsindədirmi |

"Hazırda yoxlanıla bilmədi" nəticəsi heç vaxt "etibarsız" ilə eyni göstərilmir. Qurumun rəqəmsal sənəd vermə səlahiyyəti rəqəmsal sənədin verildiyi
tarixə görə qiymətləndirilir: fəaliyyətini dayandırmış qurumun əvvəllər verdiyi rəqəmsal sənədlər etibarlı qalır.

## 4.5 İstiqamət qaydaları

1. Etibar siyahılarına yalnız etibar siyahısının naşiri yazır; rəqəmsal sənəd vermə xidmətləri yalnız lövbər sorğusu göndərir.
2. Yoxlayan tərəflər və rəqəmsal cüzdanlar etibar məlumatlarını spesifikasiyadakı yoxlama qaydalarına uyğun oxuyur: imzanı, versiya zəncirini və təzəliyi
   yoxlamadan heç bir siyahı qeydindən istifadə etmir. Açıq mənbəli paketlər bu qaydaları hazır şəkildə tətbiq edir.
3. Yoxlayan tərəf hər yoxlamada ləğv siyahısını yükləmir; siyahılar əvvəlcədən toplu şəkildə çəkilir.
4. Heç bir Tamga xidməti IP ünvanını qeydə almır; qeydlərdə rəqəmsal sənəd sahələrinin dəyəri və [[t:status-list]] mövqeyi yer almır.

---

# 5. Məlumat modeli

## 5.1 Rəqəmsal sənəd formatları

| Format | İstifadə |
|---|---|
| SD-JWT VC | Bütün rəqəmsal sənəd növləri. Selective disclosure, cihaz açarına bağlama, ləğv siyahısına istinad |
| ISO/IEC 18013-5 mdoc | Şəxsiyyət sənədinin ikinci təqdimatı; yaxın məsafədə təqdimat və sıfır bilikli sübut üçün |

İmza alqoritmi ES256 (P-256)-dır; qurumun sertifikat zənciri rəqəmsal sənədlə birlikdə ötürülür. Hər rəqəmsal sənəd cihazdakı bir açara
bağlıdır; təqdimat zamanı bu açarla imzalanmış bağlılıq sübutu məcburidir. Nüsxələr ayrı-ayrı açarlara bağlanır.
Milli şəxsiyyət nömrəsi şəxsiyyət sənədindən başqa heç bir rəqəmsal sənəd növündə olmur.

## 5.2 Rəqəmsal sənəd növləri və kataloq

Hər rəqəmsal sənəd növünün daimi identifikatoru var (`urn:tamga:<alan>:<Tür>:<ana sürüm>`). Növün görünən adları, sahələri və
[[t:selective-disclosure]] siyasəti növ təsvirində (Type Metadata), məlumat qaydaları isə JSON Schema-dadır. Dərc olunmuş təsvir faylları
dəyişmir; rəqəmsal sənəd təsvirin həşini daşıyır və yoxlayan tərəf onu kataloqla müqayisə edir.

Hazırkı növlər: tələbə sənədi, diplom, Tamga şəxsiyyət sənədi, e-poçt və telefon sənədi, tədbir bileti, psevdonim
toxumu (yalnız rəqəmsal cüzdanda qalır, heç bir yoxlayan tərəfə göstərilmir).

## 5.3 İdentifikatorlar

| İdentifikator | Necə yaranır | Nə vaxt dəyişir |
|---|---|---|
| Kök sertifikat identifikatoru | Ölkə kodu və kök sertifikatın barmaq izindən | Kök dəyişərsə |
| Qurum identifikatoru | Ölkə kodu və qurum sertifikatının barmaq izindən | Sertifikat yenilənəndə; yeni qeyd köhnəsinə varis kimi bağlanır |
| Rəqəmsal sənəd növü identifikatoru | `urn:tamga:…` | Yalnız əsas versiya dəyişəndə |
| Yoxlayan tərəfin klient identifikatoru | Giriş sertifikatının həşi (`x509_hash`) | Sertifikat yenilənəndə |
| Yoxlayan tərəfin daimi qeydi | Domen adı (`dns_name`) | Dəyişmir; psevdonimlər və nüsxələr ona bağlıdır |
| Şəxs | Qlobal identifikator yoxdur; hər rəqəmsal sənəd üçün cihaz açarı, hər yoxlayan tərəf üçün nüsxə, hər sayt üçün psevdonim | — |

## 5.4 Ləğv və status

Rəqəmsal sənədin statusu IETF Token Status List ilə dərc olunur. Siyahı ünvanları qurumu, ili və ya tələbə qrupunu üzə çıxarmır; rəqəmsal
sənədin siyahıdakı yeri təsadüfidir. Siyahılar dəyişiklik olmasa belə, sabit aralıqlarla dərc olunur; beləliklə, ləğv anı kənara
sızmır. Dərc aralığı 2 dəqiqədir; ləğv dərc aralığı ilə yoxlayan tərəfin əvvəlcədən çəkmə aralığının cəmi qədər müddətdə (bir neçə
dəqiqə) yoxlayan tərəflərdə qüvvəyə minir. Hər siyahı 6 saat etibarlıdır: status serverində fasilə yaranarsa, yoxlayan tərəf son siyahı ilə bu
müddət ərzində yoxlamanı davam etdirə bilər. Sıfır bilikli sübutla təqdimatda ləğv siyahısının indeksi açıqlanmır; bu təqdimat üçün qısa ömürlü
nüsxələrdən istifadə olunur (§7.4 L5).

---

# 6. Etibar modeli

## 6.1 Siyahıların siyahısı və ölkə siyahıları

Etibar imzalı siyahılardan gəlir. Struktur Avropa İttifaqının (Aİ) strukturu ilə eynidir:

- **Siyahıların siyahısı** hər ölkə siyahısının ünvanını, imzalayanını və tanınma statusunu göstərir. Şəbəkə səviyyəsində ortaq
  rəqəmsal sənəd növləri, tanınan cüzdan provayderləri və qəbul edilmiş sıfır bilikli sübut sxemləri də buradadır.
- **Ölkə siyahısı** həmin ölkənin kök sertifikatlarını, sənədi verən qurumlarını (onların sinifləri, təminat səviyyələri və hansı növləri
  verməyə səlahiyyətli olduqları) və qeydiyyatdan keçmiş yoxlayan tərəflərini ehtiva edir.

Rəqəmsal cüzdanlar və yoxlayan tərəflər yalnız bir şeyə etibar edir: siyahıların siyahısını imzalayan kök açara. Kök açarın barmaq izləri
`tamga.network/trust-anchor` səhifəsində, etibar siyahısı saytında və iştirak müqavilələrində eyni dəyərlərlə dərc olunur.

## 6.2 Federasiya

Tamga Network-un ölkə siyahısının sahibi olması məcburi deyil. Hazırda Türkiyə siyahısını Tamga dövlət adından müvəqqəti olaraq
dərc edir. Dövlət və ya dövlətin səlahiyyət verdiyi qurum öz siyahısını dərc etdikdə, siyahıların siyahısı həmin siyahının
ünvanını və imzalayanını göstərir. Rəqəmsal cüzdan və yoxlayan tərəf üçün yalnız ünvan və imzalayan dəyişir; qurum identifikatorları, rəqəmsal sənəd
növləri və rəqəmsal sənədlər eyni qalır. Eyni yol bütün türk dövlətləri üçün keçərlidir. Aİ siyahıları da eyni mexanizmlə, əhatəsi rəqəmsal sənəd
növünə görə məhdudlaşdırılaraq göstərilə bilər; bu, texniki etibardır. Aİ-də **hüquqi tanınma** isə şəbəkənin verə biləcəyi bir şey deyil:
Aİ-dən kənar üçün yeganə açıq əsas eIDAS-ın 14-cü maddəsidir (yalnız etibar xidmətləri; İttifaq ilə həmin ölkə arasında saziş), tərəfləri
dövlətlərdir; 5f maddəsi üçüncü ölkənin tanınması deyil ([[ADR-0035]] hüquqi qeydi). Şəbəkənin rolu texniki hazırlıqdır: ETSI formatında
siyahılar, ETSI profilli sertifikatlar və ötürülə bilən dövlət rolları. Qısa müddətdə Aİ yoxlayan tərəfi Tamga rəqəmsal sənədlərini yalnız
öz istəyi ilə, etibar siyahımızı öz etibar mənbəyinə əlavə etməklə qəbul edə bilər.

Başqasının idarə etdiyi siyahı siyahıların siyahısında ünvanı, sabitlənmiş imzalayanı, əhatəsi və təsdiq qeydi ilə göstərilir. Siyahı
yalnız öz əhatəsindəki rollar və rəqəmsal sənəd növləri üçün zəmanət verə bilər; imzalayanı uyğun gəlməyən siyahı yüklənmir. Hər xarici siyahının təzəliyi
ayrıca izlənilir: biri yoxlanıla bilməsə belə, digər siyahılar təsirlənmir. Hansı xarici siyahıya etibar ediləcəyinə hər siyahı üçün ayrıca qərar
verilir. Qaydalar Əlavə A-dadır.

## 6.3 Siyahı qaydaları

- Siyahılar versiyalıdır və əvvəlki versiyanın həşini daşıyır; qeyd silinmir, status dəyişiklikləri tarixçəyə əlavə olunur.
- Növbəti yeniləmə ən geci 90 gün sonradır; dəyişiklik ən geci 24 saat ərzində dərc olunur.
- Siyahı rotasiya olunan ən azı iki sertifikatla imzalanır.
- Hər saat imzalanan lövbər jurnalı ləğv siyahısı dərclərini və rəqəmsal sənəd növü təsvirlərinin həşlərini qeydə alır.
- Hamıya açıq dəyişiklik jurnalı kimin, nə vaxt, nəyi dəyişdiyini göstərir.

## 6.4 Qeydiyyat

- **Sənədi verən qurumlar** iştirak mərhələlərindən keçir (Əlavə A): qeydiyyatlı, müqaviləli və akkreditə olunmuş səviyyələr. Hər rəqəmsal sənəd növü üçün
  ayrıca səlahiyyət verilir; səlahiyyət standart olaraq bağlıdır. Sənədi verən qurum verdiyi rəqəmsal sənəd növünün yalnız müəyyən yoxlayan tərəflərə
  göstərilməsini tələb edə bilər (daxili açıqlama siyasəti, Aİ ARF Mövzu 43): qayda imzalı təqdimat
  məlumatında (metadata) dəyər kimi dərc olunur, rəqəmsal sənədə daxil edilmir; rəqəmsal cüzdan təqdimat zamanı onu yoxlayan tərəfin qeydiyyat və giriş sertifikatı ilə
  müqayisə edir, uyğun gəlmədikdə şəxsi xəbərdar edir, son qərar şəxsindir.
- **Yoxlayan tərəflər** Aİ-nin ortaq qeydiyyat məlumat dəsti ilə müraciət edir: rəsmi ad, identifikasiya nömrəsi, ünvan, əlaqə məlumatları, hər istifadə üçün
  məqsəd və məxfilik siyasəti, məlumatların qorunması orqanı. Yalnız hüquqi şəxslər qeydiyyatdan keçir. Qeydiyyat qurumu hər istifadə üçün ən çoxu 12 ay
  etibarlı [[t:registration-certificate]] yaradır; rəqəmsal cüzdan tələb olunan sahələri bu sertifikatla müqayisə edir.
- **Cüzdan provayderləri** cüzdan həllərini (platformalar, təhlükəsizlik səviyyəsi, PIN və biometrika, ehtiyat nüsxə modeli) bəyan
  edir və uyğunluq testlərindən keçir. Tamga Network rəqəmsal cüzdanı adına görə deyil, dərc olunmuş qaydalara görə tanıyır.

## 6.5 Təminat səviyyələri

| Ox | Səviyyələr | Harada görünür |
|---|---|---|
| Şəxsin şəxsiyyətinin yoxlanması | T0 anonim · T1 aşağı · T2 əhəmiyyətli · T3 yüksək (eIDAS Low / Substantial / High) | Rəqəmsal sənəddə deyil (yoxlayan tərəf onu sənəddə görmür); sənəd növünün ilkin şərtidir |
| Sənədi verən qurumun akkreditasiyası | I1 qeydiyyatlı · I2 müqaviləli · I3 akkreditə olunmuş · PUB dövlət | Etibar siyahısında; kvalifikasiyalı və dövlət sənədlərində əlavə olaraq rəqəmsal sənədin özündə |
| Cüzdan təhlükəsizliyi | W1 proqram təminatı (dəstəklənmir) · W2 cihazın təhlükəsiz zonası · W3 sertifikatlı təhlükəsiz element | Cüzdan sübutunda |

Yoxlayan tərəfin qərarı rəqəmsal sənəd növü ilə [[t:issuer|sənədi verən qurumun]] sinfinin birləşməsinə əsaslanır; ayrıca "şəxsin təminat səviyyəsi" sahəsi yoxdur.

## 6.6 Məlum məhdudiyyət

Hazırda etibarın lövbəri yeganə operatorun imzasıdır. Operator ilə sənədi verən qurum birlikdə hərəkət etsə, siyahıda uyğunsuz
qeyd dərc oluna bilər; hamıya açıq jurnal, şəffaflıq hesabatı və audit bundan çəkindirir, lakin onu qeyri-mümkün etmir. Bu məhdudiyyət ortaq
reyestr və bir neçə müstəqil imzalayan ilə aradan qalxır.

---

# 7. Sertifikasiya, təhlükəsizlik və risk

## 7.1 Cüzdan təhlükəsizliyi

Cüzdan vahidi ([[t:wallet-unit]]) cüzdan provayderində qeydiyyatdan keçir. Hər əməliyyat üçün ən çoxu 24 saat etibarlı olan cüzdan nüsxəsi sübutu
(WIA) və rəqəmsal sənədlərin açarlarını təsvir edən ayrıca açar sübutu ([[t:key-attestation]], KA) alır. Sənədi verən qurum rəqəmsal sənəd verməzdən əvvəl
bu sübutları etibar siyahısındakı provayderə qarşı yoxlayır. Açarlar cihazın təhlükəsiz zonasında saxlanılır və cihaz sübutu ilə
(Apple App Attest, Android key attestation) dəstəklənir. Proqram təminatı açarlı rəqəmsal cüzdana rəqəmsal sənəd verilmir.

## 7.2 Məxfilik tədbirləri

1. Ümumi qeydlərdə fərdi məlumatlar yoxdur; qeydlərdə sahə dəyərləri və ləğv siyahısının yeri yer almır.
2. Rəqəmsal sənədlər nüsxələr şəklində verilir və hər yoxlayan tərəfə ayrıca nüsxə təqdim olunur; saytlar psevdonimlə tanınır.
3. Sıfır bilik sübutu eyni rəqəmsal sənədin müxtəlif təqdimatlarının bir-biri ilə əlaqələndirilməsinin qarşısını alır.
4. Ləğv siyahıları sabit intervalla dərc olunur; ləğv anı üzə çıxmır.
5. Hər təqdimat PIN və ya biometriya tələb edir; həddindən artıq tələb və sənədi verən qurumun paylaşım qaydasına uyğun gəlməyən sorğu şəxsə göstərilir.
6. Şəxsiyyətin yoxlanılması zamanı sənəd və üz təsvirləri Tamga-da saxlanılmır.
7. İstifadə statistikası yalnız ümumiləşdirilmiş şəkildə və ən azı 50 nəfərlik qruplar üzrə dərc olunur.

## 7.3 Uyğunluq və sertifikasiya

Bu gün uyğunluq açıq uyğunluq test vektorları və dərcdən əvvəl məcburi testlərlə nümayiş etdirilir. Dövlətlər qoşulduqda müstəqil uyğunluğun
qiymətləndirilməsi qurumları və milli sertifikasiya tətbiq olunacaq. Hər rol üzrə nəyin test edildiyi və necə nümayiş etdirildiyi Əlavə A §4.3-dədir. Aİ ilə qarşılıqlı
fəaliyyət Aİ-nin qarşılıqlı fəaliyyət tədbirlərində və OpenID uyğunluq testləri ilə nümayiş etdirilir.

## 7.4 Məlum məhdudiyyətlər və qalıq risklər

| # | Məhdudiyyət |
|---|---|
| L1 | Etibar lövbəri bu gün tək operatorun imzasına əsaslanır (§6.6). |
| L2 | Ləğv status serveri işlədiyi halda bir neçə dəqiqə ərzində qüvvəyə minir (dərc intervalı 2 dəqiqə + yoxlayan tərəfin əvvəlcədən yükləmə intervalı). |
| L3 | Eyni sənədi verən qurumun rəqəmsal sənədləri müxtəlif yoxlayan tərəflərdə birləşdirilərsə, şəxs eyniləşdirilə bilər; sıfır bilik sübutu bu riski aradan qaldırır. |
| L4 | Cihaz dəyişdirildikdə rəqəmsal sənədlər yenidən alınır; təsdiqlənmiş ötürmə dizaynı açıq məsələdir. |
| L5 | Sıfır bilik sübutu ilə təqdim olunan şəxsiyyət sənədinin ləğvi təqdimat zamanı yoxlanıla bilməz. Qərar: bu təqdimat yalnız ən çoxu 24 saat etibarlı olan, səssizcə yenilənən qısamüddətli nüsxələrlə həyata keçirilir; ləğv edilmiş rəqəmsal sənədin nüsxəsi yenilənmir (Aİ ARF-nin qısamüddətli sənəd yolu). Ləğv ZK təqdimatında ən gec 24 saat ərzində qüvvəyə minir; sübut nüsxənin növünü bağladığı üçün yoxlayan tərəf qısa müddəti görür. Qısamüddətli nüsxədən istifadə etməyən ZK təqdimatı, yoxlayan tərəfin siyasəti bu riski açıq şəkildə qəbul etmədikcə, YOXLANILA BİLMƏDİ hesab olunur. |

---

# 8. İdarəetmə və təkamül

## 8.1 Mərhələlər

| Mərhələ | Etibar lövbəri | Kim idarə edir | Keçid şərti |
|---|---|---|---|
| Siyahı mərhələsi (bu gün) | İmzalı siyahılar və lövbər jurnalı | Tamga, müvəqqəti operator | — |
| Reyestr mərhələsi | Ümumi reyestr | İlk operatorlar | Ən azı iki müstəqil operatorun yazılı razılığı; ekvivalentlik testləri |
| Dövlətlərin qoşulması | Ümumi reyestr | Üzv dövlətlərin şurası (üçdə iki) | İlk dövlət operatorunun istismara keçməsi |
| İnstitusional genişlənmə | Ümumi reyestr | Şura | Şuranın müəyyən etdiyi hədlər |

**Reyestr mərhələsinin vəziyyəti:** ilkin — kod hazırdır, istismarda deaktivdir. Ümumi reyestrin müqavilələri kompilyasiya və test edilir; siyahı
dərcçisi imzalı siyahıların yalnız xülasələrini reyestrə yaza bilən vəziyyətdədir, lakin bu funksiya deaktivdir və işləyən reyestr yoxdur.
Reyestr aktivləşdirildikdə də imzalı siyahıların proyeksiyası olacaq: xülasə yalnız ən azı iki müstəqil operator eyni dəyəri yazdıqda
nəzərə alınır, ziddiyyət olduqda imzalı siyahı üstündür və reyestrin cavabı yoxlama üçün heç vaxt tələb olunmur (qərar, 2026-10-19).
Reyestr icazəli olaraq qalır: hansı qovşağın qoşula biləcəyi və hansı hesabın yaza biləcəyi reyestrin öz idarəetmə qeydindən yaradılan və
hər qovşaqda eyni saxlanılan icazə siyahısı ilə müəyyən edilir; yazma səlahiyyətinin əsas nəzarəti müqavilələrdədir və qovşaqların interfeysi
internetə açılmır (qərar, 2026-10-19).

## 8.2 Ümumi reyestrə keçid

Siyahı arxivi ümumi reyestrə olduğu kimi köçürülür. Siyahı və reyestr eyni uyğunluq testlərinə eyni cavabı verir. Qurum identifikatorları, rəqəmsal sənəd
növləri və rəqəmsal sənədlər dəyişmir; ötürmə zamanı yalnız operator dəyişir. Rəqəmsal cüzdan və yoxlayan tərəf yalnız etibar mənbəyinin
tətbiqini dəyişir.

## 8.3 İdarəetmə qurumu

İdarəetmə qurumu ilk gündən yaradılmır. Bir və ya iki dövlət qoşulmağa maraq göstərdikdə şura və ya fond yaradılır və
siyahılar ona təhvil verilir. O vaxta qədər Tamga müvəqqəti operatordur; fond yaradıldıqda operatorluq ona təhvil verilir. Tamga Network
mənfəət güdmür; operatorluq gələcəkdə fonda təhvil veriləcək. Şəbəkə heç bir
məhsul satmır və kommersiya xidməti göstərmir; Tamga Wallet şəbəkənin ilk rəqəmsal cüzdanıdır; o, bir şirkətin ayrıca məhsuludur; xidmət təminatçıları şəbəkədən kənardadır və qeydiyyat prosesinə
hamı kimi eyni şərtlərlə qoşulur ([[ADR-0037]]).

## 8.4 Standartlara uyğunluq xəritəsi

| Sahə | Standart |
|---|---|
| Etibar siyahıları | ETSI TS 119 612, ETSI TS 119 602 |
| Qurum identifikatoru | X.509 (RFC 5280), ETSI EN 319 401 |
| Sənədi verən qurumun siyasəti | ETSI TS 119 471 |
| Rəqəmsal sənəd formatı | IETF SD-JWT VC, ETSI TS 119 472-1, ISO/IEC 18013-5 |
| Rəqəmsal sənədin verilməsi | OpenID4VCI 1.0, HAIP 1.0, ETSI TS 119 472-3 |
| Təqdimat | OpenID4VP 1.0, DCQL, HAIP 1.0, ISO/IEC 18013-7, W3C Digital Credentials API |
| Yaxın məsafə | ISO/IEC 18013-5 (Bluetooth) |
| Ləğv | IETF Token Status List |
| Şəxsiyyətin yoxlanılması | ETSI TS 119 461 |
| Qeydiyyat və qeydiyyat sertifikatı | Aİ İcra Reqlamenti (CIR) 2025/848, ETSI TS 119 475 |
| Sıfır bilik sübutu | Longfellow ZK (mdoc) |
| Təhsil semantikası | ELM 3 / Europass, ISCED-F, EQF |

Mənbələrin tam siyahısı Əlavə E-dədir.

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).

