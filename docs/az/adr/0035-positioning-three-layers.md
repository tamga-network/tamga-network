---
document_id: ADR-0035
title: "Mövqeləndirmə"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-30
summary: >
  Tamga üç qatda mövqelənir: (1) baza — bütün rəqəmsal sənədlər, protokollar və etibar siyahıları Avropa İttifaqının (Aİ) (eIDAS 2.0 / EUDI) standartlarına uyğundur; (2) Tamga Network — türk dünyası üçün yüngül etibar federasiyası: ölkə siyahılarını bir yerə toplayır və bir-birinə tanıdır, qaydalarına əməl edən hər rəqəmsal cüzdanı tanıyır, dövlətlər qoşulduqca idarəetmə qurumu və zəncir yaranır; (3) məhsul və xidmətlər — Tamga Wallet (şəbəkənin ilk və istinad rəqəmsal cüzdanı, hər uyğun mühitdə işləyir) və qurumlara xidmətlər (Qurum Konsolu, Tamga Verify, inteqrasiya, dəstək).
domain: Governance
translation_of: ADR-0035
source_version: "1.0.0"
---

> **[[ADR-0037]] və [[ADR-0042]] ilə qismən dəyişdirilib (2026-10-02, 2026-10-06):** üçüncü qatdakı xidmətlər şəbəkədən kənara, ayrıca şirkətə
> köçürülüb; Tamga Network yalnız şəbəkədir və xidmət satmır. Baza (Aİ uyğunluğu), federasiya qatı və PO1–PO4 qüvvədədir. Tamga Wallet da şəbəkənin hissəsi deyil: şəbəkə cüzdan idarə etmir, cüzdanları etibar siyahısı ilə tanıyır ([[ADR-0042]], 2026-10-06).

# Kontekst

TÜBİTAK BİLGEM-in Aİ ilə uyğun rəqəmsal cüzdanı və sınaq mühiti olduğu məlum oldu. Bu məlumat yalnız bir mənbədən gəlir və rəsmi
statusu məlum deyil. Lakin istiqamət aydındır: Türkiyədə dövlət dəstəkli rəqəmsal cüzdan və şəxsiyyət məlumatları ([[t:PID]]) yolu formalaşır. Təhlil qeyri-ictimai
sənədlərdədir (2026-10-01).

İki yanlış anlamaya aydınlıq gətirmək lazım idi:

1. **"[[t:EUDI-Wallet]]" hüquqi statusdur.** Aİ üzv dövlətinin təqdim etdiyi və ya tanıdığı və Aİ qaydalarına əsasən sertifikatlaşdırılan
   rəqəmsal cüzdan deməkdir. Aİ-dən kənar təşkilatın rəqəmsal cüzdanı (həm Tamga Wallet, həm də TÜBİTAK cüzdanı) bu gün bu statusu ala bilməz, Aİ Etibar
   Nişanından da istifadə edə bilməz. Ola biləcəyi şey **Aİ ilə uyğun** olmaqdır: eyni standartlarla işləmək və bunu testlə sübut etmək.
2. **Aİ uyğunluğu yollara alternativ deyil, onların ortaq zəminidir.** "Aİ ilə uyğun rəqəmsal cüzdan + xidmətlər" ilə "Tamga Network" arasında
   seçim yoxdur. Şəbəkə Aİ standartlarının üzərinə qurulan qatdır.

Qiymətləndirilən üç yol:

- **Yol 1:** yalnız Aİ ilə uyğun rəqəmsal cüzdan və xidmətlər.
- **Yol 2:** əvvəlcə Aİ-yə bənzər ağır şəbəkə və qurum.
- **Yol 3:** qatlı struktur.

# Qərar

**Yol 3: üç qat, hər biri təkbaşına dayana bilər.**

1. **Baza: Aİ uyğunluğu.** Rəqəmsal sənəd formatları ([[t:SD-JWT-VC]], ISO [[t:mdoc]]), protokollar ([[t:OpenID4VCI]]/VP, [[t:HAIP]]),
   etibar modeli ([[t:LOTL]] → ölkə siyahıları, [[t:ETSI]] formatları) və qeydiyyat modeli Aİ standartlarına uyğundur. Şəbəkə heç böyüməsə belə, bu
   qat təkbaşına dəyərlidir.
2. **Tamga Network: yüngül [[t:federation]].**
   - Şəbəkə rəqəmsal cüzdanları **seçmir, tanıyır.** Dərc olunmuş qaydalara ([[t:ARF]], [[t:rulebook|rulebook-lar]]) əməl edən və uyğunluq testlərindən keçən hər
     [[t:wallet-provider]] siyahıya daxil ola bilər.
   - Şəbəkənin əsas işi **ölkə siyahılarını bir yerə toplamaq və bir-birinə tanıtmaqdır.** Bu gün Türkiyə siyahısını Tamga müvəqqəti olaraq idarə edir.
     Dövlət və ya dövlətin səlahiyyət verdiyi qurum öz siyahısını dərc etdikdə Tamga LOTL-u həmin siyahının ünvanını və imzalayanını
     göstərir. Rəqəmsal cüzdan və [[t:verifier]] üçün yalnız ünvan dəyişir (ADR-0009 ötürmə hədəfi). Eyni qayda hər türk dövlətinə aiddir.
   - Ağır qurum ilk gündən yaradılmır. Bu gün Tamga müvəqqəti operatordur. Bir və ya iki dövlət qoşulmağa maraq göstərdikdə
     idarəetmə qurumu (şura və ya fond) yaradılır, siyahılar ötürülür və zəncir (ADR-0009: ən azı iki müstəqil operator) işə düşür.
3. **Məhsul və xidmətlər.**
   - **Tamga Wallet:** şəbəkənin ilk və istinad rəqəmsal cüzdanıdır, lakin şəbəkəyə bağlı deyil; hər Aİ ilə uyğun mühitdə işləyir. Milli şəxsiyyət
     cüzdanı olduğunu iddia etmir. Üstünlükləri [[t:pseudonym]], sıfır bilik sübutu ([[t:ZK]]), biletlər və türk dünyası rəqəmsal sənədləridir.
   - **Xidmətlər** (Qurum Konsolu, Tamga Verify, qurumların özünü qeydiyyatı, sınaq mühiti, inteqrasiya və SDK dəstəyi,
     məsləhət, müvəqqəti şəxsiyyət xidməti) **standartlar əsasında** təqdim olunur. Qurum rəqəmsal sənədi şəxsin seçdiyi uyğun rəqəmsal cüzdana
     verir; yoxlama hansı uyğun rəqəmsal cüzdandan gəlməsindən asılı olmayaraq işləyir.
   - Xidmətlər ayrıca proqram təminatı deyil: işləyən servislərin qurumlara təqdim olunan formasıdır. Fərq brend, müqavilə və məsuliyyət
     səviyyəsindədir.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| PO1 | Tamga rəqəmsal sənəd, protokol və etibar siyahısı formatları Aİ standartlarından kənara çıxmır; Tamga-ya xas hər əlavə standart genişlənmə nöqtəsi vasitəsilə edilir və standart müştəri proqramlarını pozmur. |
| PO2 | Tamga Network rəqəmsal cüzdanı adına görə deyil, dərc olunmuş qaydalara və uyğunluq testlərinə görə tanıyır; qaydalara əməl edən cüzdan provayderi siyahıya daxil ola bilər. |
| PO3 | Tamga-nın müvəqqəti olaraq üzərinə götürdüyü dövlət rolları (siyahı operatoru, qeydiyyat orqanı, kök CA, müvəqqəti şəxsiyyət provayderi) ötürülə bilən şəkildə layihələndirilir; ötürmə zamanı rəqəmsal sənəd, rəqəmsal cüzdan və yoxlayan tərəf tərəfində yalnız ünvan və imzalayan dəyişir. |
| PO4 | İctimai mətnlərdə Tamga Wallet "EUDI Wallet" və ya "milli rəqəmsal cüzdan" kimi təqdim olunmur; düzgün ifadə "Aİ ilə uyğun rəqəmsal cüzdan"dır və uyğunluq testlərinin nəticələri ilə dəstəklənir. |

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Yol 1: yalnız Aİ ilə uyğun rəqəmsal cüzdan + xidmətlər | rədd (əsas istiqamət kimi) | Ən sürətli gəlir gətirir, lakin fərqləndirici xüsusiyyəti azdır və dövlət cüzdanı gəldikdə kiçilir. Yol 3 bunu artıq əhatə edir. |
| Yol 2: əvvəlcə ağır şəbəkə və qurum | rədd | Dövlətlər qoşulmasa, illərlə gəlirsiz qalar; erkən qurumun xərci yüksəkdir. |
| **Yol 3: qatlı** | **qəbul** | Arxitektura ilə tam üst-üstə düşür; xidmətlər və rəqəmsal cüzdan dərhal gəlir gətirir, şəbəkə zamanla böyüyür, dövlət cüzdanı və siyahıları gəldikdə dəyər itmir, əksinə federasiyanın dəyəri artır. |

**Məlum gərginlik:** Aİ rolları şüurlu şəkildə ayırır. Siyahını idarə edən qurumun xidmət satması maraqlar toqquşması sayılır. Bu gün bir komanda
kifayətdir, lakin gələcəkdə şəbəkə idarəetməsi (şura və ya fond) ilə xidmət şirkəti ayrılmalıdır. İctimai təqdimatda bu ayrılıq
indidən adlar və sənədlərlə göstərilir.

# Nəticələr

- **Federasiya qapısı.** Xarici imzalayanı olan ölkə siyahıları, ETSI formatının oxunması və xarici cüzdan provayderlərinin tanınması ayrıca ADR ilə
  açılır ([[ADR-0036]]).
- **Aİ şəxsiyyəti.** Aİ şəxsiyyət məlumatları (PID) və sürücülük vəsiqəsi ([[t:mDL]]) növlərinin yoxlanması həyata keçirilir ([[ADR-0036]]).
- **Rəqəmsal cüzdan və konsol.** Rəqəmsal cüzdana "paylaşdığım qurumlar" ekranı əlavə olunur; Qurum Konsoluna yoxlayan tərəf olan qurumların özünü qeydiyyatı
  (dizayn indi, hazırlanma mağazadan sonra) əlavə olunur.
- **İctimai təqdimat.** Sayt, whitepaper və təqdimatlar üç qata uyğun yenidən qurulur. ARF və tərtibatçı sənədləri bu
  mövqeləndirməyə uyğun sadələşdirilir.

# Hüquqi qeyd — Aİ-də tanınma (2026-10-13)

Bu qeyd qərarı dəyişmir; ilk Aİ uyğunluq mərhələsində (2026-10-13) Aİ hüququ baxımından aydınlaşan mövqeyi qeydə alır.

- **5f maddəsi üçüncü ölkənin tanınması deyil.** eIDAS 2.0 ((Aİ) 2024/1183 saylı Reqlamentlə dəyişdirilmiş 910/2014 saylı Reqlament) md. 5f Aİ daxilindəki dövlət
  qurumlarının və özəl sektorun **Aİ rəqəmsal cüzdanlarını** qəbul etmək öhdəliyidir. Aİ-dən kənar rəqəmsal cüzdanı və ya etibar siyahısını
  tanıma yolu deyil.
- **Aİ-dən kənar üçün yeganə açıq əsas 14-cü maddədir.** Md. 14 üçüncü ölkədə təsis edilmiş etibar xidməti provayderlərinin xidmətlərinin Aİ-də
  ekvivalent sayılmasını İttifaq ilə həmin ölkə arasında saziş (Aİ-nin Fəaliyyəti haqqında Müqavilənin 218-ci maddəsi) və ya Komissiyanın icra reqlamenti ilə şərtləndirir;
  qarşılıqlılıq və qarşı tərəfin etibar siyahısı tələb olunur. Əhatə dairəsi **etibar xidmətləridir** (məs., kvalifikasiyalı elektron imza, elektron möhür, kvalifikasiyalı
  EAA). Tərəfləri **dövlətlərdir**: Türkiyə və ya digər türk dövləti; Tamga Network bu sazişin tərəfi ola bilməz.
- **Aİ-dən kənar rəqəmsal cüzdanın "EUDI Wallet" sayılması yolu reqlamentdə yoxdur.** PO4 məhz buna görə qüvvədədir.
- **Şəbəkənin rolu texniki hazırlıqdır:** ETSI formatında etibar siyahıları ([[ADR-0036]]), ETSI profilli sertifikatlar ([[ADR-0050]]),
  ötürülə bilən dövlət rolları (PO3). Dövlət saziş yoluna qədəm qoyduqda texniki zəmin hazır olur.
- **Qısa müddətdə** Aİ-dəki yoxlayan tərəf Tamga rəqəmsal sənədlərini yalnız **öz istəyi ilə** qəbul edə bilər (etibar siyahımızı öz etibar
  mənbəyinə əlavə etməklə); bu, hüquqi tanınma deyil və belə təqdim olunmur.

İctimai təqdimat (sayt, ARF, təqdimatlar) bu qeydə uyğun yazılır: "Aİ ilə qarşılıqlı tanınma" və ya "Aİ-də etibarlı" kimi ifadələr
işlədilmir; düzgün ifadə "Aİ standartlarına uyğun, Aİ ilə uyğun" və "hüquqi tanınma dövlətlərarası saziş tələb edir" ifadələridir.

# Status

**Accepted — 2026-10-01** (layihə rəhbərliyinin təsdiqi; hərfi sitat qeyri-ictimai təsdiq qeydindədir). Üçüncü qat ("məhsul və xidmətlər")
[[ADR-0037]] ilə dəyişdi: Tamga Network yalnız şəbəkədir, xidmət satmır; kommersiya xidmətləri şəbəkədən kənardadır. PO1–PO4 qüvvədədir.

> **Hüquqi qeyd (2026-10-13):** Md. 5f üçüncü ölkənin tanınması deyil; Aİ-dən kənar üçün yeganə açıq əsas md. 14-dür (yalnız etibar
> xidmətləri, dövlətlərarası saziş). Qərar dəyişmir. Layihə rəhbərliyinin təsdiqi ilə (ilk Aİ uyğunluq mərhələsi, qərar 13).
