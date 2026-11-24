---
document_id: FW-ONB-0001
title: "Qoşulma prosesi"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-11-24
summary: >
  Tamga Network-a qoşulmanın addımları: sənədi verən qurum, yoxlayan tərəf, cüzdan provayderi və dövlət üçün müraciət, tələb olunan sənədlər, baxış, uyğunluq testləri, siyahıya daxil olma; daha sonra qeydiyyat dəyişikliyi, fəaliyyətin dayandırılması və çıxış. Qaydalar Əlavə A §3.2–§3.3 və Əlavə B-də, texniki addımlar isə tərtibatçı sənədlərindədir.
translation_of: FW-ONB-0001
source_version: "1.0.0"
---

# 1. Ümumi axın

Qoşulma hər rol üçün eyni dörd addımdan ibarətdir. Proses hər kəs üçün eynidir; Tamga Wallet və müvəqqəti operatorun
öz xidmətləri də eyni yoldan keçir.

| Addım | Nə baş verir | Qayda |
|---|---|---|
| 1. Müraciət | Qurum rolunu seçir, müraciət faylını və tələb olunan sənədləri qeydiyyat qurumuna təqdim edir | Əlavə A §3.2 |
| 2. Baxış | Qeydiyyat qurumu giriş şərtlərini yoxlayır: domen adı, hüquqi şəxs statusu, imza səlahiyyətli şəxs, əhatə dairəsi; çatışmazlıq olduqda bunu bir dəfəyə bildirir | RB-REG-01…09 |
| 3. Uyğunluq testləri | Qurum öz proqram təminatı ilə açıq uyğunluq testlərindən keçir; nəticə hesabatı müraciətə əlavə olunur | Əlavə A §4.3, RB-ENF-01 |
| 4. Siyahıya daxil olma | Qeydiyyat qurumu qurumu etibar siyahısına əlavə edir; dəyişiklik ən gec 24 saat ərzində dərc olunur | RB-OP-03 |

Giriş şərtləri ödənilmədən qeydiyyat aparılmır. Qeydiyyat qanuni səlahiyyət vermir (Əlavə A §1.2, G-A). Hazırda Türkiyə üçün qeydiyyat qurumu dövlət adından
Tamga-dır; dövlət öz siyahısını təhvil aldıqda müraciətlər həmin dövlətin qeydiyyat qurumuna edilir.

# 2. Sənədi verən qurum

| Addım | Təfərrüat |
|---|---|
| 1. Səviyyəni seçin | I1 (qeydiyyatlı), I2 (müqaviləli), I3 (akkreditə olunmuş) və ya dövlət qurumu (Əlavə A §3.2). Rəqəmsal sənəd növünüzün rulebook-u minimum səviyyəni müəyyən edir (məsələn, diplom üçün I2). |
| 2. Sənədləri hazırlayın | Aşağıdakı cədvələ baxın. |
| 3. Açarları yaradın | Rəqəmsal sənəd imza açarı və ayrıca ləğv siyahısı açarı (ES256); hər ikisi qurumda qalır (RB-AP-02, RB-AP-03). Hər biri üçün sertifikat sorğusu (CSR) göndərilir. |
| 4. Baxış və sertifikat | Qeydiyyat qurumu müraciəti yoxlayır; milli kök sertifikat qurumun sertifikatını imzalayır (RB-AP-01). |
| 5. Uyğunluq testi | Növ təsvirinə və uyğunluq test vektorlarına qarşı sınaq rəqəmsal sənədi yaradılır; ləğv siyahısının dərci və rəqəmsal cüzdan sübutlarının yoxlanılması test edilir. |
| 6. Siyahıya daxil olma və səlahiyyət | Qurum siyahıya əlavə olunur; hər rəqəmsal sənəd növü üçün ayrıca səlahiyyət verilir (RB-REG-04). Qeydiyyat sertifikatı yaradılır. |
| 7. İlk rəqəmsal sənəd | Qurum öz sənəd vermə proqram təminatı ilə və ya host edilən sənəd vermə xidməti vasitəsilə (quruma bağlı API açarı ilə, RB-OP-18) ilk rəqəmsal sənədi verir. |

**Tələb olunan sənədlər**

| Sənəd | I1 | I2 | I3 |
|---|---|---|---|
| Domen adına sahiblik (DNS yoxlaması) və əlaqə məlumatları | ✓ | ✓ | ✓ |
| Avropa İttifaqının (Aİ) ümumi qeydiyyat məlumatları: rəsmi və kommersiya adı, rəsmi identifikasiya nömrəsi (VKN və ya MERSİS), ünvan, əlaqə məlumatları, aid olduğu məlumatların qorunması orqanı | ✓ | ✓ | ✓ |
| Rəqəmsal sənəd növləri və səlahiyyətli mənbənin adı | ✓ | ✓ | ✓ |
| Hüquqi şəxs statusunun sübutu (MERSİS və Ticarət Reyestri Qəzeti və ya təsis qanunu) və imza səlahiyyətli şəxsin təsdiqi | — | ✓ | ✓ |
| İmzalanmış qoşulma müqaviləsi və KVKK əlavələri (Əlavə A §5.1) | — | ✓ | ✓ |
| Açarların HSM-də saxlandığının və ya ixtisaslı e-Möhürdən istifadə olunduğunun sübutu | — | — | ✓ |
| Audit və qeydlərin aparılması qaydası, insident bildirişi müddətləri, fəaliyyətin dayandırılması proseduru, məsuliyyət sığortası | — | — | ✓ |

Texniki addımlar: [[GUIDE-0007]] və [[GUIDE-0003]]. Məlumat xarakterli qeyd: müraciət faylını, açarları və CSR-ları, quraşdırmanı
və siyahıdakı görünüşü qurumun İT komandası açıq qoşulma aləti (`tamga-onboard`) ilə hazırlayıb sınaya bilər; alət siyahıya
yazmır, qeydiyyat qərarı qeydiyyat qurumundadır ([[GUIDE-0014]]).

# 3. Yoxlayan tərəf

| Addım | Təfərrüat |
|---|---|
| 1. İstifadə hallarını müəyyən edin | Hər istifadə halı üçün məqsəd, tələb olunacaq sahələr və məxfilik siyasəti. Yalnız hüquqi şəxslər qeydiyyatdan keçir. |
| 2. Müraciət | Aİ ümumi qeydiyyat məlumat dəsti: rəsmi və kommersiya adı, rəsmi identifikasiya nömrəsi, ünvan, əlaqə məlumatları, xidmətin təsviri, dövlət qurumu olub-olmaması, səlahiyyət növü, vasitəçi əlaqəsi, aid olduğu məlumatların qorunması orqanı. |
| 3. Əhatə dairəsinə baxış | Tələb olunacaq sahələr məlumatların minimallaşdırılması prinsipi əsasında nəzərdən keçirilir; əhatə dairəsi hər istifadə halı üzrə ayrılır (RB-REG-08). |
| 4. Sertifikatlar | Qeydiyyat təsdiqlənəndə giriş sertifikatı verilir (§9 Ardıcıllıq); qeydiyyat qurumu hər istifadə halı üçün ən çoxu 12 ay etibarlı olan qeydiyyat sertifikatı yaradır. |
| 5. Uyğunluq testi | İmzalanmış sorğu, yoxlama zənciri, köhnəlmiş siyahı olduqda "yoxlanıla bilmədi" nəticəsi və əhatə dairəsindən kənar sahələrin tələb olunmaması test edilir. |
| 6. Siyahıya daxil olma | Yoxlayan tərəf etibar siyahısına əlavə olunur. Host edilən yoxlama xidmətindən istifadə edəcəksə, bu da qeydiyyata yazılır. |

Texniki addımlar: [[GUIDE-0008]], daha sonra [[GUIDE-0002]] və ya [[GUIDE-0001]]; müraciət faylı, giriş açarı və
quraşdırmanın yoxlanılması üçün qoşulma aləti: [[GUIDE-0014]] (məlumat xarakterli).

# 4. Cüzdan provayderi

| Addım | Təfərrüat |
|---|---|
| 1. Cüzdan həllinin bəyannaməsi | Platformalar, təhlükəsiz aparat səviyyəsi (W2 və ya W3), PIN və biometriya, ehtiyat nüsxə modeli; Tamga Rulebook-dakı rəqəmsal cüzdan qaydalarına uyğun olmalıdır (Əlavə B §6). |
| 2. Müqavilə | Cüzdan provayderi müqaviləsi: sübutlar, təhlükəsiz aparat səviyyəsi, yeniləmə və ləğv müddətləri, bərpa açarının saxlanılmaması (Əlavə A §5.1). |
| 3. Uyğunluq testləri | Rəqəmsal cüzdan qaydaları, cüzdan nüsxəsi sübutu və açar attestasiyası, təqdimetmə protokolu; cihaz üzərində təqdimetmə. |
| 4. Siyahıya daxil olma | Sübut imza açarı siyahılar siyahısına, cüzdan provayderi qeydiyyatına əlavə olunur. Bundan sonra sənədi verən qurumlar bu rəqəmsal cüzdanın sübutlarını qəbul edir. |

Cüzdan provayderini rəqəmsal cüzdanı təqdim edən təşkilat idarə edir; şəbəkə onu yalnız siyahıya salır. Siyahıya daxil olmazdan əvvəl cüzdan tərtibatçısı öz rəqəmsal cüzdanını
sandbox-da sınaqdan keçirir: öz cüzdan provayderini sandbox siyahısında qeydiyyatdan keçirir (hazırda layihə rəhbərliyinə müraciət yolu ilə) və rəqəmsal cüzdanını
sandbox-dakı nümunə qurumlar, şəxsiyyət xidməti və yoxlayan tərəflə sınaqdan keçirir ([[GUIDE-0013]]).

Dövlətlər qoşulduqda sertifikatlaşdırılmış cüzdan həlləri siyahısı tətbiq olunur və ilkin audit başlayır (Əlavə A §4.1). Texniki addımlar:
[[GUIDE-0005]] və [[GUIDE-0010]].

# 5. Dövlət

| Addım | Təfərrüat |
|---|---|
| 1. Niyyət | Dövlət qoşulmaq istədiyini bildirir; ilk dövlət operatoru istehsal mühitinə keçdikdə şura yaradılır (Əlavə A §1.6). |
| 2. Kök sertifikat | Dövlətin kök sertifikatı oflayn mərasimlə yaradılır və mərhələli keçid qaydasında əlavə olunur. |
| 3. Siyahının idarə olunması | Milli siyahıda operator sahəsi dövlətə keçir; qurum, kök və rəqəmsal sənəd növü identifikatorları dəyişmir (RB-OP-14). |
| 4. Qeydiyyat qurumu | Qeydiyyat səlahiyyəti dövlətə keçir; müvəqqəti operator artıq qeydiyyat apara bilmir. |
| 5. PID provayderi | Dövlət təyin edir; Tamga şəxsiyyət sənədi varislik qaydasında təhvil verilir (RB-AP-ID-06). |

Təhvil heç bir rəqəmsal sənədi, qeydiyyatı və ya identifikatoru etibarsız etmir (Əlavə A §7). Texniki addımlar: [[GUIDE-0011]].

# 6. Qeydiyyatdan sonra

| Vəziyyət | Nə baş verir | Qayda |
|---|---|---|
| Qeydiyyat dəyişikliyi | Qeydiyyat qurumu ən gec 5 iş günü ərzində icra edir. | RB-REG-09 |
| Sertifikatın və ya açarın yenilənməsi | Ən azı 30 gün əvvəl bildirilir; yeni identifikator köhnəsinə varis kimi bağlanır, köhnə rəqəmsal sənədlər köhnə qeydiyyatla yoxlanılır. | Əlavə A §3.3, RB-REG-06 |
| API açarı | Host edilən xidmətin açarı 90 gündən bir yenilənir; sızma şübhəsi olduqda qurum ləğv tələb edir. | RB-AP-25 |
| Yeni rəqəmsal sənəd növü | Rəqəmsal sənəd növü səlahiyyəti ayrıca tələb olunur; yeni növ əvvəlcə kataloqda dərc olunmalıdır. | RB-REG-04, RB-SCH-05 |

# 7. Fəaliyyətin dayandırılması

İnsident, audit nəticəsi və ya müqavilənin pozulması sanksiya pilləkənini işə salır (Əlavə A §4.5): əvvəlcə xəbərdarlıq və 30 günlük aradan qaldırma
müddəti, sonra rəqəmsal sənəd növü səlahiyyətinin məhdudlaşdırılması, sonra fəaliyyətin dayandırılması. Fəaliyyəti dayandırılmış qurum yeni rəqəmsal sənəd verə və ləğv siyahısı
dərc edə bilməz; dayandırma davam etdikcə əvvəllər verdiyi rəqəmsal sənədlər də yoxlamada qəbul edilmir ([[ADR-0088]]). Problem
aradan qaldırıldıqda qurum yenidən aktivləşir və dayandırmadan əvvəl verdiyi sənədlər yenidən qəbul edilir.
Kritik insidentlərdə (məsələn, imza açarının sızması) qurumun fəaliyyəti dərhal dayandırılır (Əlavə A §4.6).

# 8. Çıxış

| Yol | Nə baş verir |
|---|---|
| Könüllü çıxış | Bildirişdən 90 gün sonra baş verir; ləğv siyahısı varis və ya siyahı operatoru tərəfindən son versiyasında dondurulur. |
| Çıxarılma | Sanksiya pilləkəninin dördüncü pilləsidir; varis təyin edilir; ETSI görünüşündə "geri çəkilib" kimi göstərilir. |
| Xitam | Müqavilə başa çatır; mövcud rəqəmsal sənədlər etibarsız edilmir; fərdi məlumatların saxlanma müddətləri KVKK-ya uyğun müəyyən olunur. |

Heç bir çıxış keçmişi silmir və mövcud rəqəmsal sənədləri etibarsız etmir (RB-REG-07). Yoxlayan tərəf və cüzdan provayderi də eyni
yollarla çıxır.

# 9. Yoxlayan tərəfin qeydiyyat siyasəti

Aİ-nin yoxlayan tərəflərin qeydiyyatı üzrə icra reqlamenti (CIR 2025/848, 2026/1730 dəyişikliyi ilə) milli qeydiyyat siyasətinin
yazılı olmasını tələb edir (Md. 4). Tamga-da qeydiyyat qurumu bu qaydalarla işləyir; müddətlər layihə rəhbərliyi tərəfindən
təsdiqlənib (2026-11-24).

| Mövzu | Qayda | Aİ əsası |
|---|---|---|
| Səlahiyyətli mənbələr | Hüquqi şəxs statusu və rəsmi ad Türkiyə üçün ticarət reyestri (MERSİS) və ya vergi qeydi (VKN) üzrə; başqa ölkədə həmin ölkənin ticarət reyestri. İdentifikator növləri Əlavə A-nın icazəli siyahısındandır ([[ADR-0024]] K5 əlavəsi). | Md. 4(3)(c), 6(4) |
| Tələb olunan sənədlər | Hüquqi şəxs statusunun sübutu, müraciət edənin təmsil səlahiyyətinin sübutu, domen adına sahiblik (DNS təsdiqi). Şəxs adı qeydə yazılmır. | Md. 4(3)(b), 6(3)(b) |
| Ardıcıllıq | Giriş sertifikatı yalnız qeydiyyatı təsdiqlənmiş yoxlayan tərəfə verilir: baxış (§3 addım 2–3) sertifikatdan əvvəl bitir; sertifikat və siyahı qeydi eyni nəşrdə qüvvəyə minir. | Md. 7(2) |
| İlk müraciətə cavab | 10 iş günü ərzində qərar və ya çatışmayanların siyahısı. Dəyişiklik müraciəti 5 iş günü (RB-REG-09). | Md. 6(2) |
| Dayandırma və ləğv əsasları | Yanlış və ya köhnəlmiş qeydiyyat məlumatı; siyasətin pozulması; **qeydiyyatda olmayan məlumatı tələb etmək**; digər hüquq pozuntuları. Qərar sanksiya pilləkəninə uyğun mütənasib verilir (Əlavə A §4.5) və əsaslandırılır. | Md. 9(2), 9(4) |
| Bildiriş | Dayandırma və ya ləğv ən geci 24 saat ərzində əsaslandırma və etiraz yolu ilə yoxlayan tərəfə bildirilir; giriş və qeydiyyat sertifikatları eyni nəşrdə ləğv edilir ([[ADR-0087]], [[ADR-0068]]). | Md. 9(5), 9(6) |
| Etiraz | Yoxlayan tərəf imtinaya, dayandırmaya və ya ləğvə yazılı etiraz edə bilər; etirazı qərarı verməyən şəxs araşdırır. Etiraz müddəti 30 gün, cavab 15 iş günü. Mübahisə davam edərsə Əlavə A §4.7. | Md. 4(3)(f) |
| Yoxlayan tərəfin öhdəlikləri | Qeydiyyat məlumatı dəyişəndə gecikmədən bildirir; istifadəni dayandıranda bildirir və sertifikatı gecikmədən ləğv edilir. | Md. 5(3), 6(7) |
| Saxlama | Qeydiyyat məlumatı, sertifikat verilişləri və dəyişikliklər 10 il saxlanılır; siyahı arxivi və status tarixçəsi silinmir (RB-REG-07). | Md. 10 |
| Qeydiyyatdan əvvəl əhatə baxışı | **Şüurlu fərq.** Aİ tələb olunan məlumatın və məqsədin yalnız şəffaflıq üçün toplanmasını, ilkin təsdiqin tətbiq edilməməsini istəyir (Md. 6(3a)). Tamga məlumatların minimallaşdırılması prinsipinə görə əhatəni qeydiyyatdan əvvəl yoxlayır (RB-REG-08): şəbəkədə hələ nəzarət orqanı və sonradan sanksiya yolu olmadığı halda ilkin baxış istifadəçini qoruyur. Tamga Aİ qeydiyyat qurumu deyil; üzv dövlət Aİ modelinə keçərsə qayda yenidən qiymətləndirilir. | Md. 6(3a) |

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
