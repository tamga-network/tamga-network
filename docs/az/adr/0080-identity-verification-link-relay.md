---
document_id: ADR-0080
title: "Şəxsiyyətin yoxlanılması keçidinin ötürülməsinə qarşı iki qat: cüzdanda son təsdiq və yoxlamadan əvvəl xəbərdarlıq"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Şəxsiyyət xidməti şəxsiyyətin yoxlanılmasını kənar şəxsiyyət yoxlama provayderinə yönləndirir. Hücumçu axını öz cüzdanından
  başladıb yoxlama keçidini başqasına ötürərsə, həmin şəxs öz şəxsiyyəti ilə yoxlamadan keçir və şəxsiyyət sənədi hücumçunun
  cüzdanına verilir. Qərar iki qatdır: (1) rəqəmsal sənəd verilməzdən əvvəl axını başladan cüzdanda son təsdiq ekranı — şəxsiyyət
  xidməti yoxlanılmış şəxsiyyətin maskalanmış xülasəsini (ad və soyadın baş hərfləri, doğum ili) yalnız həmin cüzdana qaytarır,
  şəxs "bu mənəm" demədən sənəd verilmir; (2) yoxlamanı aparan şəxsə, yoxlama başlamazdan əvvəl bunun hansı cüzdan üçün
  aparıldığını bildirən xəbərdarlıq. Tətbiq təxirə salınıb: şəxsiyyətin yoxlanılması hamıya açılmazdan əvvəl həyata keçirilir.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0025]]", "[[ADR-0040]]", "[[ADR-0042]]", "[[SPEC-ID-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0080
source_version: 1.0.0
---

# Qısaca

Tamga şəxsiyyət sənədi almaq üçün şəxs şəxsiyyət vəsiqəsini və üzünü yoxlama səhifəsində göstərir. Bu səhifənin keçidi başqasına
göndərilə bilər. Pis niyyətli biri öz telefonunda prosesi başladıb keçidi "müraciətiniz üçün şəxsiyyətinizi təsdiqləyin" deyərək
başqasına göndərərsə, həmin şəxs fərqinə varmadan öz şəxsiyyətini hücumçunun cüzdanına vermiş olur. Bu qərar iki tədbir qoyur:
rəqəmsal sənəd verilməzdən əvvəl cüzdan "yoxlanılmış şəxsiyyət budur, sizindirmi?" deyə soruşur; yoxlama səhifəsi də ən başda
"bu yoxlama həmin telefondakı cüzdan üçün aparılır, keçidi siz açmamısınızsa davam etməyin" deyir.

# Kontekst

- Şəxsiyyətin yoxlanılması yalnız şəxsiyyət xidmətində aparılır ([[ADR-0011]], SPEC-ID-0003/IDP3). Axın: cüzdan səlahiyyət
  sorğusunu açır → şəxs şəxsiyyət xidmətinin səhifəsində məlumatlandırma mətnini oxuyur və razılıq verir (IDP11) → şəxsiyyət
  xidməti şəxsiyyət yoxlama provayderində sessiya açır və şəxsi ora yönləndirir → şəxs vəsiqəsini və üzünü göstərir → provayder
  şəxsi şəxsiyyət xidmətinə geri yönləndirir → şəxsiyyət xidməti səlahiyyət kodunu verir → cüzdan kodu tokenə çevirir və
  rəqəmsal sənədi istəyir. Rəqəmsal sənəd axını başladan cüzdanın aparat açarına bağlanır.
- **2026-11-11 düzəlişi.** Səlahiyyət kodu artıq yalnız provayderin qayıdış ünvanındakı birdəfəlik açarla verilir. Axının
  identifikatorunu bilmək kifayət etmir; kodu yoxlamanı bitirən brauzer alır.
- **Qalan boşluq.** Yoxlama sessiyasının keçidi (və ya provayderin "başqa cihazda davam et" yolu) ötürülə bilir. Yoxlamanı kimin
  apardığı ilə axını kimin başlatdığı arasında texniki bağ yoxdur: provayder "bu vəsiqə həqiqidir və bu üz vəsiqədəki şəxsdir"
  deyir; "bu şəxs axını başladan cüzdanın sahibidir" demir.
- Real şəbəkədə şəxsiyyətin yoxlanılması bu gün dəvətlə aparılır; boşluq buna görə bu gün məhduddur. Giriş hamıya açılanda hücum
  miqyaslanır.

## Təhdid modeli

| | |
|---|---|
| Hücumçu | Öz telefonunda cihaz sübutundan keçən real cüzdanı var. Axını özü başladır, razılığı özü verir. Qurbana mesaj göndərə və onu inandırıcı bəhanə ilə (iş müraciəti, mükafat, bank, bağlama) yönləndirə bilir. |
| Qurban | Öz şəxsiyyət vəsiqəsinə və üzünə malikdir; cüzdanı olmaya bilər. Keçidi açır və real şəxsiyyət yoxlama səhifəsi görür. Bir cüzdana şəxsiyyət verdiyini bilmir. |
| Hücumun nəticəsi | Qurbanın şəxsiyyətini daşıyan, hücumçunun cihaz açarına bağlı real şəxsiyyət sənədi. Hücumçu bu sənədlə qurbanın adından şəxsiyyət təqdim edir. |
| Əhatədən kənar | Şəxsiyyətindən bilərəkdən başqasının istifadə etməsinə imkan verən şəxs (texniki tədbirlə həll olunmur; şəxsiyyətini əldən verməklə eynidir). Saxta vəsiqə və saxta üz (provayderin işi). Oğurlanmış telefon (cüzdan kilidi və cüzdan vahidinin ləğvi). |

Eyni boşluğun əks istiqaməti də var: şəxs axını öz cüzdanından başladır, "kömək edən" biri yoxlamanı öz şəxsiyyəti ilə bitirir;
şəxsin cüzdanına başqasının şəxsiyyəti daxil olur.

# Qərar

- **K1 — Qat 1: cüzdanda son təsdiq.** Yoxlama bitdikdən sonra, rəqəmsal sənəd verilməzdən əvvəl şəxsiyyət xidməti yoxlanılmış
  şəxsiyyətin **maskalanmış xülasəsini** yalnız axını başladan cüzdana qaytarır. Cüzdan xülasəni göstərir və soruşur:
  "Yoxlanılmış şəxsiyyət budur. Bu sizsiniz?" Şəxs "bu mənəm" demədən cüzdan rəqəmsal sənədi istəmir; şəxsiyyət xidməti də
  təsdiq qeydi olmayan tokenlə sənəd vermir. Şəxs "bu mən deyiləm" deyərsə, axın bağlanır, sənəd verilmir, provayderdəki sessiya
  silinir.
- **K2 — Maskalanmış xülasənin məzmunu.** Yalnız adın və soyadın baş hərfləri və doğum ili (məs. "A. K. · 1990"). Tam ad, milli
  şəxsiyyət nömrəsi, vəsiqə nömrəsi, doğum günü və ayı, fotoşəkil xülasəyə daxil deyil.
- **K3 — Qat 2: yoxlamadan əvvəl xəbərdarlıq.** Yoxlama başlamazdan əvvəl, yoxlamanı aparan şəxsin gördüyü ilk ekranda bu mətn
  yer alır: "Bu yoxlama *⟨cihaz və cüzdan təsviri⟩* üzərindəki cüzdan üçün aparılır. Keçidi siz açmamısınızsa davam etməyin."
  Cüzdanın adı etibar siyahısındakı qeyddən gəlir (məs. "Tamga Wallet"); cihaz təsviri kobud etiketdir (məs. telefonun növü).
  Provayderin səhifəsi bu mətni daşıyacaq qədər fərdiləşdirilə bilmirsə, şəxsiyyət xidmətinin öz ara səhifəsi provayderin önünə
  qoyulur.
- **K4 — İkisi birlikdə.** Qatlar bir-birini əvəz etmir (aşağıda). Hər ikisi tətbiq olunmadan şəxsiyyətin yoxlanılması hamıya
  açılmır.
- **K5 — Tətbiq vaxtı.** Kod bu qərarla dəyişmir. Tətbiq **giriş hamıya açılmazdan əvvəl** həyata keçirilir; o günə qədər real
  şəbəkədə şəxsiyyətin yoxlanılması dəvətlə qalır. Yeni sahə, son nöqtə və xəta adları tətbiq zamanı təsdiqlənir.

## Qat 1 təkbaşına niyə kifayət etmir

Əsas hücumda "bu mənəm" sualı yanlış şəxsə verilir: axını başladan cüzdan hücumçunundur və hücumçu təsdiqləyir. Qat 1-in
əlavə etdiyi budur:

- Əks istiqaməti və vicdanlı səhvləri tutur: cüzdanına başqasının şəxsiyyəti daxil olmaq üzrə olan şəxs bunu baş hərflərdən və
  doğum ilindən görür.
- Hücumçunu açıq yalan bəyanata məcbur edir ("bu mənəm"); hadisə fərdi məlumat ehtiva etməyən audit qeydi kimi qalır.

Əsas hücumda vicdanlı olan yeganə tərəf qurbandır və ona çatmaq mümkün olan yeganə yer yoxlamanın başlanğıcıdır. Qat 2 bunun
üçündür. Qat 2 də təkbaşına kifayət etmir: xəbərdarlıqlar oxunmadan keçilə bilər və provayderin səhifəsi bizim nəzarətimizdə
deyil.

## Maskalanmış xülasənin fərdi məlumat baxımından qiymətləndirilməsi

- **Fərdi məlumatdır.** Maskalanmış olsa da, konkret şəxsə aiddir; fərdi məlumat qaydaları tam tətbiq olunur (məlumat minimuma
  endirilir, məqsədlə məhdudlaşır).
- **Kimə göstərilir.** Yalnız axını başladan cüzdana, həmin cüzdanın açarına bağlı kanalla (token və cüzdan nümunəsi açarı).
  Ünvana, sorğu parametrinə və ya yönləndirməyə yazılmır.
- **Harada saxlanılır.** Şəxsiyyət xidməti xülasəni rəqəmsal sənədi yaradacağı yoxlanılmış sahələrdən həmin anda törədir; ayrıca
  saxlamır. Sənəd veriləndə və ya axın bağlananda şəxs sahələri ilə birlikdə silinir (IDP9). Jurnala və audit qeydinə yalnız
  hadisə adı yazılır (xülasə göstərildi, təsdiqləndi, rədd edildi); xülasənin özü yazılmır. Cüzdan xülasəni yalnız ekranda
  göstərir; əməliyyat jurnalına yazmır.
- **Yanlış şəxsə göstərilərsə.** Əsas hücumda qurbanın xülasəsi hücumçunun cüzdanında görünür. Buna görə xülasə vicdanlı şəxsin
  özünü tanımasına kifayət edəcək, lakin yad şəxsə heç nə qazandırmayacaq qədər dardır: hücumçu hədəf aldığı şəxsin adını çox
  vaxt onsuz da bilir; baş hərflər və doğum ili şəxsiyyət nömrəsi və ya tam doğum tarixi vermir. Tam ad, doğum günü və fotoşəkil
  buna görə xülasəyə daxil edilmədi.
- **Məlumatlandırma.** Razılıqdan əvvəlki məlumatlandırma mətni (IDP11) son təsdiq addımını və xülasənin göstəriləcəyini bildirir.
- **Xəbərdarlıqdakı cihaz təsviri.** Kobud etiketdir (telefonun növü, cüzdanın adı); seriya nömrəsi, daimi cihaz identifikatoru
  və ya məkan daşımır; yalnız axın müddətində saxlanılır.

# Qiymətləndirilən seçimlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| **Cüzdanda son təsdiq + yoxlamadan əvvəl xəbərdarlıq** | **qəbul** | Provayderdən asılı olmadan tətbiq olunur; fərdi məlumat saxlamır; iki qat bir-birinin boşluğunu bağlayır. Qalan risk aşağıda |
| Yalnız cüzdanda son təsdiq | rədd | Əsas hücumda təsdiqləyən hücumçunun özüdür |
| Yalnız xəbərdarlıq | rədd | Xəbərdarlıq oxunmaya bilər; əks istiqaməti və vicdanlı səhvləri tutmur |
| Provayder sessiyasını cihaza bağlamaq (yoxlama yalnız axını başladan cihazda tamamlana bilsin) | indi seçilmədi | Provayderin imkanlarından asılıdır. Cüzdanın içinə provayder komponenti qoymaq cüzdanın provayderi tanımaması qaydasına (IDP3) və şəbəkənin cüzdan idarə etməməsinə ([[ADR-0042]]) ziddir; hər uyğun cüzdanı tək provayderə bağlayır. Brauzerdə aparılan yoxlamada "eyni cihaz" etibarlı şəkildə sübut edilə bilmir. Provayder belə parametr təklif edərsə, əlavə sərtləşdirmə kimi yenidən qiymətləndirilir |
| Üz uyğunlaşdırmasını cüzdan cihazında yenidən istəmək (sənəd verilməzdən əvvəl cüzdandan canlı üz, yoxlamadakı üzlə uyğunlaşdırılır) | indi seçilmədi | Texniki cəhətdən ən güclü bağdır. Lakin yoxlamadakı üzün və ya onun şablonunun təsdiq anına qədər saxlanılmasını tələb edir: bu, xüsusi kateqoriyalı fərdi məlumatdır və "görüntü saxlanılmır" qaydasına (IDP4, IDP9) ziddir. Hücumçunun nəzarətindəki cihazda kamera girişi saxtalaşdırıla bilər (əlavə canlılıq yoxlaması lazımdır); hər sənəd verilməsi üçün əlavə provayder əməliyyatı və əlçatanlıq yükü gətirir |
| Şəxsiyyət sənədini yalnız üzbəüz vermək | rədd | Uzaqdan şəxsiyyət yoxlamasının məqsədini aradan qaldırır |

**Qalan risk (şüurlu).** Qurbanı xəbərdarlığa məhəl qoymamağa inandıran qətiyyətli hücumçu uğur qazana bilər. Bu, şəxsin
şəxsiyyətindən bilərəkdən başqasının istifadə etməsinə imkan verməsi ilə eyni sinifdədir. Miqyas böyüyərsə, yuxarıdakı iki yol
yenidən nəzərdən keçirilir.

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| VL1 | Şəxsiyyət sənədi, axını başladan cüzdanda şəxs yoxlanılmış şəxsiyyətin maskalanmış xülasəsini görüb "bu mənəm" deyə təsdiqləmədən verilmir. Təsdiq yoxdursa və ya şəxs rədd edərsə, sənəd verilmir, axın bağlanır və provayderdəki sessiya silinir. |
| VL2 | Maskalanmış xülasə yalnız adın və soyadın baş hərflərindən və doğum ilindən ibarətdir; yalnız axını başladan cüzdana, həmin cüzdanın açarına bağlı kanalla qaytarılır; ünvana, jurnala və audit qeydinə yazılmır və axın bitdikdən sonra saxlanılmır. |
| VL3 | Şəxsiyyətin yoxlanılması başlamazdan əvvəl, yoxlamanı aparan şəxsə bu yoxlamanın hansı cüzdan üçün aparıldığı və keçidi özü açmayıbsa davam etməməli olduğu göstərilir. Provayderin səhifəsi bu mətni daşıya bilmirsə, şəxsiyyət xidmətinin öz ara səhifəsi provayderin önünə qoyulur. |
| VL4 | Real şəbəkədə şəxsiyyətin yoxlanılması VL1–VL3 tətbiq olunmadan hamıya açılmır. |

# Tətbiq planı

Kod əsasən bu repozitoriyada deyil, şəxsiyyət xidmətində (operator repozitoriyası) və cüzdan tətbiqlərindədir.

1. **Şəxsiyyət xidməti.** (a) Maskalanmış xülasə: yoxlanılmış ad, soyad və doğum tarixindən törətmə (türk və qeyri-latın
   hərflərində baş hərf qaydası; tək adlı şəxslər). (b) Xülasənin axını başladan cüzdana qaytarılması: token cavabında və ya
   tokenə bağlı ayrıca son nöqtədə; ünvana yazılmır. (c) Təsdiq qeydi: sənəd son nöqtəsi təsdiq qeydi olmayan tokeni açıq xəta
   ilə rədd edir; rədd halında axın bağlanır və provayder sessiyası silinir. (d) Xəbərdarlıq: provayderin səhifə fərdiləşdirməsi
   kifayət edirsə orada; etmirsə öz ara səhifəsi. Ara səhifə yalnız ötürülə bilən keçid ondan keçirsə fayda verir: provayder
   sessiyası şəxs ara səhifədə "davam et" dedikdə və qısa ömürlü açılır; provayderin sessiya keçidi bundan sonra da ötürülə
   bilirsə, bu, provayderin imkanları ilə birlikdə sınanır və qalan risk kimi qeydə alınır. (e) Audit qeydi: yalnız hadisə
   adları. (f) Testlər: ötürülən keçid ssenarisi, rədd, təsdiqsiz sənəd sorğusu, səhifənin yenilənməsi.
2. **Cüzdan nüvəsi (`@tamga-network/wallet-core`) və cüzdan tətbiqi.** Sənəd alma müştərisi xülasəni tətbiqə verir və təsdiq
   olmadan sənəd sorğusu göndərmir; tətbiq son təsdiq ekranını göstərir ("bu mənəm" / "bu mən deyiləm"); xülasə jurnala yazılmır.
   Uyğun cüzdanlar üçün qayda [[SPEC-WALLET-0001]]-ə və cüzdan yoxlama siyahısına əlavə olunur.
3. **Spesifikasiyalar.** SPEC-ID-0003 (axın və qaydalar), [[SPEC-PROTO-0001]] (şəxsiyyət xidmətinin sənəd vermə axınındakı
   əlavə addım).
4. **Mətnlər.** Son təsdiq ekranı, xəbərdarlıq və məlumatlandırma mətninə əlavə türk, ingilis, Azərbaycan və türkmən dillərində.
5. **Ardıcıllıq.** Şəxsiyyət xidməti və cüzdan birlikdə buraxılır; köhnə cüzdan versiyası təsdiqsiz sənəd istəyə bilməyəcəyi
   üçün minimal cüzdan versiyası etibar siyahısındakı cüzdan qeydi ilə yüksəldilir.

# Status

**Accepted — 2026-11-12.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-12). DECISIONS: D-ID-15. VL1–VL4 məcburidir; tətbiq
şəxsiyyətin yoxlanılması hamıya açılmazdan əvvəl həyata keçirilir.
