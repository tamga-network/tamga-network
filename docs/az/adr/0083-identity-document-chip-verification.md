---
document_id: ADR-0083
title: "Şəxsiyyət sənədinin çipini şəxsiyyət xidməti yoxlayır; cüzdan yalnız oxuyucudur, üz və canlılıq provayderdə qalır"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-13
last_updated: 2026-11-13
summary: >
  Bu gün şəxsiyyət xidməti şəxsi tamamilə kənar uzaqdan şəxsiyyət yoxlaması provayderinə yoxlatdırır (sənəd fotoşəkli, canlılıq,
  üz uyğunluğu). Qərar: şəxsiyyət vəsiqəsinin və ya pasportun çipi şəxsin telefonunda, axını başladan cüzdanda NFC ilə oxunur;
  cüzdan çipdən oxuduğu xam məlumatı dəyişdirmədən şəxsiyyət xidmətinə ötürür; dövlətin imzasını (ICAO 9303 passiv
  autentifikasiya) və çipin surət olmadığını (aktiv autentifikasiya və ya çip autentifikasiyası, serverin yaratdığı birdəfəlik
  sınaqla) şəxsiyyət xidməti özü yoxlayır. Üz uyğunluğu və canlılıq provayderdə qalır və çipdəki fotoşəkillə müqayisə olunur;
  mövcud provayderlə başlanır, provayder adapterin arxasındadır və dəyişdirilə bilər. Şəxsiyyət sənədinin sahələri çipdən gəlir;
  sənəd fotoşəkli yolu çipsiz sənədlər üçün ehtiyat kimi qalır. Ad və kod dəyişmir (`document_chip_verified`,
  `verification_method: remote-nfc-liveness-face` artıq müəyyən edilib). IDP3 daraldılır: cüzdan provayderlə yenə əlaqə qurmur,
  lakin çipi oxuyub xam məlumatı şəxsiyyət xidmətinə ötürə bilər; qərar vermir. Açılış şərti: hüquqi rəy müsbət olmadan
  (Türkiyə üçün: şəxsiyyət vəsiqəsi əsasnaməsinin biometrik məlumat müddəası və şəxsi məlumatların qorunması qanununun biometrik
  məlumat və xaricə ötürmə müddəaları) çip yolu nə sandbox-da, nə də real şəbəkədə açılır; kodu (2026-11-13 dəyişikliyi ilə)
  indi yazılır, lakin standart olaraq bağlı açarın arxasında durur və yalnız yerli testlərdə saxta sənəd məlumatı ilə işləyir.
  Təhlükəsiz elektron imza / mobil imza yolu bu qərarın növbəti addımıdır.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0022]]", "[[ADR-0040]]", "[[ADR-0042]]", "[[ADR-0080]]", "[[SPEC-ID-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0083
source_version: 1.0.0
---

# Qısaca

Şəxsiyyət vəsiqələrinin və pasportların içində çip var. Çipdə şəxsin adı, doğum tarixi və fotoşəkli dövlətin imzası ilə birlikdə
saxlanılır. Telefon bu çipi NFC ilə oxuya bilər. Bu qərarla Tamga şəxsiyyət sənədini verərkən məlumatları sənədin fotoşəklindən
deyil, çipdən götürür və dövlətin imzasını özü yoxlayır. Şəxsin həqiqətən həmin sənədin sahibi olduğunu göstərmək üçün üz və
canlılıq yoxlaması yenə kənar provayderdə aparılır: canlı üz çipdəki fotoşəkillə müqayisə olunur. Beləliklə, məlumatların
düzgünlüyü provayderin proqram təminatına deyil, dövlətin imzasına əsaslanır; provayder yalnız üz hissəsi üçün lazımdır və
dəyişdirilə bilər. Çipi olmayan sənədlər üçün bugünkü fotoşəkil yolu qalır. Qərar qəbul edildi; lakin çipdəki fotoşəklin
emalı hüquqi sual doğurduğu üçün çip yolu müsbət hüquqi rəydən sonra açılır. Rəy gəldikdə proqram təminatının hazır olması
üçün kod indi yazılır, lakin hər yerdə bağlı qalır: yalnız yerli testlərdə, saxta sənəd məlumatı ilə işləyir.

# Kontekst

- **Bu gün.** Şəxsiyyət xidməti ([[ADR-0011]]) şəxsi uzaqdan şəxsiyyət yoxlaması provayderinə yönləndirir; provayder sənəd
  fotoşəklini oxuyur, canlılığı və üzü yoxlayır, "təsdiqləndi" deyir. Şəxsiyyət sənədindəki sahələr provayderin oxuduğu
  dəyərlərdir. Şəxsiyyət xidməti bu qərarı yoxlaya bilmir; yalnız provayderə etibar edir. Sinif: kvalifikasiyasız EAA, I2
  ([[ADR-0022]]).
- **Provayderdən asılılıq.** Provayderin pulsuz kvotası ləğv olundu; hər yoxlama ödənişlidir. Bu, tək başına böyük xərc deyil
  (aşağıda), lakin şəxsiyyətin yoxlanılmasının bütün təminatı bir provayderin proqram təminatından və qiymət siyasətindən
  asılıdır.
- **AB-də PID necə verilir.** AB-də şəxs identifikasiya məlumatlarını (PID) üzv dövlətin eID sxemi daxilində PID provayderi
  verir; cüzdan istifadəçisi yüksək təminat səviyyəsinin qeydiyyat qaydalarına uyğun qeydiyyata alınır (İcra Reqlamenti (AB)
  2024/2977 md. 3). Uzaqdan qeydiyyat üçün İcra Reqlamenti (AB) 2026/798 (2026-04-28-dən qüvvədədir) ETSI TS 119 461 V2.1.1-ə
  əsaslanır və fiziki sənədlə uzaqdan qeydiyyatda sənəddəki üz fotoşəklinin **çipdən NFC ilə götürülməsini** və çipin passiv və ya
  aktiv autentifikasiyasını tələb edir. ETSI TS 119 461-də tam avtomatik "sənəd + üz" yolu çipli sənəd tələb edir; genişləndirilmiş
  səviyyə əlavə olaraq laboratoriyada sınaqdan keçmiş təqdimat hücumu aşkarlanmasını və təsvir inyeksiyası aşkarlanmasını
  (CEN/TS 18099) tələb edir. AB ölkə cüzdanları PID-i əsasən milli elektron şəxsiyyətlə (çip + PIN) verir. Sənəd fotoşəkli +
  selfi bu səviyyəyə çatmır.
- **Tamga-nın vəziyyəti.** Tamga PID vermir və verməyəcək (TL8). Şəxsiyyət sənədi müvəqqəti EAA-dır; dövlət PID-i gəldikdə yerini
  ona verir ([[ADR-0011]] K1). Lakin bu gün şəbəkədəki bütün qurum sənədlərinin əsaslandığı şəxsiyyət uyğunlaşdırmasının
  təməlidir; nə qədər güclü olsa, şəbəkənin qalan hissəsi bir o qədər etibarlı olur.
- **Əvvəlcədən düşünülmüşdü.** [[ADR-0011]] çipin oxunmasını "gələcəkdə" kimi nəzərdə tutmuşdu; `document_chip_verified` və
  `verification_method: remote-nfc-liveness-face` sxemdə var. Açıq qalan sual çipi kimin oxuyacağı və kimin yoxlayacağı idi.
- **Brauzer çipi oxuya bilmir.** Şəxsiyyət vəsiqəsinin çipi brauzerdən oxunmur; telefonda yerli tətbiq lazımdır. Ona görə çip ya
  provayderin telefon tətbiqinə yerləşdirilən komponenti ilə, ya da cüzdanın özü ilə oxuna bilər.
- **Keçidin ötürülməsi hücumu ([[ADR-0080]]).** Yoxlama keçidi başqasına ötürülə bilirdi. Çip axını başladan telefonda oxunarsa,
  hücumçu qurbanın kartını fiziki olaraq öz telefonuna toxundurmalı olur; uzaqdan ötürülmüş keçidlə hücum mümkün olmur.
- **Hüquqi sual.** Türkiyədə şəxsiyyət vəsiqəsinin elektron yoxlanılmasını tənzimləyən əsasnamə (Elektron Şəxsiyyət Yoxlama
  Sistemi Əsasnaməsi md. 21(3)) biometrik məlumatların toplana, saxlanıla və paylaşıla bilməyəcəyini deyir. Çipdəki üz
  fotoşəklinin yalnız anlıq uyğunlaşdırma üçün oxunmasının bu müddəaya düşüb-düşmədiyi aydın deyil. Biometrik məlumat həmçinin
  6698 saylı Şəxsi Məlumatların Qorunması Qanununa görə xüsusi kateqoriyalı şəxsi məlumatdır (md. 6), xaricdəki provayderə
  göndərilməsi isə xaricə ötürmədir (md. 9).

# Qərar

- **K1 — Çip yolu.** Şəxsiyyət xidməti iki yol təklif edir: (a) **çip yolu** — sənədin çipi axını başladan cüzdanda NFC ilə
  oxunur, üz və canlılıq provayderdə yoxlanılır; (b) **sənəd fotoşəkli yolu** — bugünkü yol, çipsiz sənədlər və NFC-si olmayan
  telefonlar üçün ehtiyat. Çipli sənədi və uyğun telefonu olan şəxsə əvvəlcə çip yolu təklif olunur.
- **K2 — Cüzdan yalnız oxuyucudur.** Cüzdan çipdən ICAO 9303 məlumat qruplarını (ən azı DG1 şəxsi məlumat, DG2 fotoşəkil, sənəd
  təhlükəsizlik obyekti SOD; varsa DG14 və DG15) oxuyur və **dəyişdirmədən** şəxsiyyət xidmətinə ötürür. Cüzdan çip məlumatını
  şərh etmir, qərar vermir, saxlamır, jurnala yazmır. Çipə giriş açarı (sənədin üzərindəki MRZ və ya CAN) yalnız telefonda
  istifadə olunur, şəxsiyyət xidmətinə göndərilmir.
- **K3 — Yoxlamanı şəxsiyyət xidməti aparır.** Şəxsiyyət xidməti serverdə: (1) **passiv autentifikasiya** — SOD imzasını sənədi
  imzalayan sertifikatla, onu da müvafiq dövlətin kök sertifikatı (CSCA) ilə yoxlayır; məlumat qruplarının heşlərini SOD-dakı
  dəyərlərlə müqayisə edir; (2) **surət yoxlaması** — çip dəstəkləyirsə aktiv autentifikasiya (AA) və ya çip autentifikasiyası
  (CA); AA-da sınağı şəxsiyyət xidməti yaradır, birdəfəlikdir və axına bağlıdır. Telefonda aparılan yoxlamanın nəticəsi qəbul
  edilmir; server xam məlumatı özü yoxlayır.
- **K4 — Kök sertifikatlar.** Şəxsiyyət xidməti hər dövlətin CSCA sertifikatlarını açıq, imzalı əsas siyahılardan götürür;
  siyahıda hansı dövlətin kökünün olduğu və haradan götürüldüyü operatorun konfiqurasiya sənədində yazılır. Kökü olmayan dövlətin
  sənədi çip yolundan keçmir, fotoşəkil yoluna düşür.
- **K5 — `document_chip_verified` mənası daralır.** `true` yalnız bu üçü birlikdə təmin olunduqda yazılır: passiv
  autentifikasiya uğurlu, surət yoxlaması (AA və ya CA) uğurlu, canlı üz DG2 fotoşəkli ilə uyğun gəldi. Passiv autentifikasiya
  keçib çip surət yoxlamasını dəstəkləmirsə, rəqəmsal sənəd yenə çipdən gələn məlumatlarla verilə bilər, lakin
  `document_chip_verified: false` olur və `verification_method` `remote-document-liveness-face` qalır. Sahə adları və sxem
  dəyişmir.
- **K6 — Üz və canlılıq provayderdə qalır; provayder dəyişdirilə bilər.** Canlılıq yoxlaması və üz uyğunluğu sübut edilmiş
  təqdimat hücumu (ISO/IEC 30107-3) və təsvir inyeksiyası sınaqları olan provayderdən alınır; şəxsiyyət xidməti bunu özü yazmır.
  Canlılıq provayderin brauzer axınında aparılır (cüzdan provayderlə əlaqə qurmur); canlı üz çipdəki DG2 fotoşəkli ilə müqayisə
  olunur. **Bugünkü uzaqdan şəxsiyyət yoxlaması provayderi ilə başlanır** (yalnız canlılıq və üz uyğunluğu hissəsi). Provayder
  şəxsiyyət xidmətində adapterin arxasındadır: provayderə məxsus kod və parametrlər adapterdən kənara çıxmır, şəxsiyyət sənədinə,
  etibar siyahısına və cüzdana provayderə məxsus heç bir dəyər daxil olmur. Provayderin dəyişdirilməsi qərarı dəyişmir;
  məlumatlandırma mətni və məlumat emalı müqaviləsi yenilənir.
- **K7 — Saxlama.** Çip məlumatı, DG2 fotoşəkli və provayderə gedən üz təsviri şəxsiyyət xidmətində yalnız sənədin verilməsi
  anına qədər yaddaşda saxlanılır və sonra silinir (IDP4, IDP9 olduğu kimi). Daimi qeydə yalnız sənəd nömrəsinin açarlı heşi, çip
  yolunun istifadə edildiyi məlumatı və yoxlama nəticələri (keçdi/keçmədi) daxil olur; xam məlumat daxil olmur.
- **K8 — Ölkə üzrə açılış.** Çip yolu bir ölkənin sənədi üçün real şəbəkədə yalnız (a) həmin ölkənin kök sertifikatı etibarlı
  mənbədən götürüldükdə və (b) həmin ölkənin hüququnda özəl qurumun şəxsiyyət çipini şəxsin razılığı ilə oxumasının və biometrik
  məlumatın emalının hüquqi araşdırması müsbət nəticələndikdə açılır. Müsbət hüquqi rəydən sonra (K11) sandbox-da saxta sənədlə
  sınana bilər; o vaxta qədər kod yalnız yerli testlərdə işləyir.
- **K9 — IDP3 daraldılır.** Yeni mətn: "IDV provayderi inteqrasiyası yalnız Tamga şəxsiyyət xidmətindədir; qurumların sənəd
  vermə xidmətləri, cüzdan və yoxlayan tərəf provayderlə əlaqə qurmur. Cüzdan axını başladan cihazda sənədin çipini oxuyub xam
  məlumatı dəyişdirmədən şəxsiyyət xidmətinə ötürə bilər ([[ADR-0083]]); çip məlumatını yoxlamır və şəxsiyyətin yoxlanılması
  barədə qərar vermir."
- **K10 — Açıq interfeys.** Çip məlumatının şəxsiyyət xidmətinə ötürülməsi [[SPEC-ID-0003]]-də açıq interfeys kimi müəyyən
  edilir; şəbəkənin siyahıya aldığı hər uyğun cüzdan onu tətbiq edə bilər ([[ADR-0042]]: şəbəkə cüzdan idarə etmir, heç bir
  cüzdana imtiyaz verilmir). İnterfeysin təfərrüatı (son nöqtə, sahə və xəta adları) tətbiq zamanı təsdiqlənir.
- **K11 — Açılış şərti: əvvəlcə hüquqi rəy; kod bağlı açarın arxasında** (2026-11-13 dəyişikliyi ilə; aşağıdakı "Dəyişiklik"
  bölməsi). Çip yolunun kodu (şəxsiyyət xidməti, cüzdan nüvəsi, cüzdan tətbiqi) yazıla və birləşdirilə bilər; standart olaraq
  bağlı açarın arxasında durur. Açar açıq olduqda şəxsiyyət xidməti serverdə (real şəbəkə və sandbox) işləməkdən imtina edir.
  Cüzdanın mağaza yığımlarında çip oxuma və NFC icazələri olmur. Kod yalnız yerli testlərdə, testdə yaradılmış kök sertifikatla
  imzalanmış saxta sənəd məlumatı ilə (və heç bir şəxsə məxsus olmayan boş test kartı ilə) işləyir; real şəxsin sənədi
  oxunmur, göndərilmir, emal olunmur. Müsbət hüquqi rəy gəlmədən çip yolu nə sandbox-da, nə də real şəbəkədə açılır. Türkiyə
  üçün rəyin mövzusu: (a) Elektron Şəxsiyyət Yoxlama Sistemi Əsasnaməsi md. 21(3) — çipdəki üz fotoşəklinin oxunub yalnız anlıq
  uyğunlaşdırma üçün istifadəsi bu müddəaya düşürmü, şəxsin öz kartını öz telefonu ilə oxutması ayrıca icazə tələb edirmi;
  (b) 6698 saylı Qanun md. 6 (biometrik məlumat, açıq razılıq) və md. 9 (xaricdəki provayderə ötürmə); (c) çipdən oxunan
  şəxsiyyət nömrəsinin yalnız şəxsiyyət sənədinə yazılmasının ayrıca öhdəlik yaradıb-yaratmadığı. Rəy mənfi olarsa və ya şərt
  qoyarsa, qərar yeni ADR ilə nəzərdən keçirilir; bağlı kod buna görə dəyişir və ya silinir. Bugünkü sənəd fotoşəkli yolu bu
  müddətdə olduğu kimi işləyir.
- **K12 — Təhlükəsiz elektron imza / mobil imza yolu növbəti addımdır.** Şəxsin təhlükəsiz elektron imza və ya mobil imza
  sertifikatı ilə şəxsiyyətini göstərməsi ([[SPEC-ID-0003]] T3, IDP7) çip yolundan sonra nəzərdən keçirilir; ayrıca ADR ilə
  qərara alınır. Bu qərar həmin yolu nə açır, nə də bağlayır.

# Qəbulla qərara alınanlar

Layihədəki dörd açıq məqam qəbulla belə bağlandı:

1. **İlk sənədlər.** Hüquqi rəy gələnə qədər çip yolu heç bir sənəd üçün açılmır (K11); ilk açılacaq sənədlər (Türkiyə şəxsiyyət
   vəsiqəsi və pasportu rəyin mövzusudur) rəylə birlikdə müəyyən edilir və K8-ə uyğun ölkə üzrə açılır.
2. **Üz və canlılıq provayderi.** Bugünkü provayderin canlılıq və üz uyğunluğu hissəsi ilə başlanır; provayder dəyişdirilə bilən
   şəkildə qurulur (K6).
3. **Surət yoxlamasını dəstəkləməyən çiplər.** K5-də olduğu kimi: rəqəmsal sənəd çipdən gələn məlumatlarla verilir,
   `document_chip_verified: false`.
4. **Platforma ardıcıllığı (iOS / Android).** Tətbiq zamanı müəyyən edilir; qərarın məzmununu dəyişmir.

# Dəyişiklik (2026-11-13, layihə rəhbərliyi)

Qəbuldan sonra həmin gün layihə rəhbərliyi K11 və CV7-ni dəyişdi: hüquqi rəy gəldikdə proqram təminatının hazır olması üçün
çip yolunun kodu **indi yazılır, lakin hər yerdə bağlı qalır**. Açılış şərti (hüquqi rəy) və rəyin mövzusu ((a)–(c)) olduğu
kimi qalır. Versiya 1.0.0 qalır.

- **Əvvəl:** "Çip yolunun kodu müsbət hüquqi rəy gəlmədən yazılmır."
- **İndi (K11, CV7):** kod yazıla və birləşdirilə bilər; standart olaraq bağlı açarın arxasındadır. Açar açıq olduqda
  şəxsiyyət xidməti serverdə (real şəbəkə və sandbox) işləməkdən imtina edir; cüzdanın mağaza yığımlarında çip oxuma və NFC
  icazələri olmur; kod yalnız yerli testlərdə, testdə yaradılmış kök sertifikatla imzalanmış saxta sənəd məlumatı ilə (və heç
  bir şəxsə məxsus olmayan boş test kartı ilə) işləyir. Real şəxsin sənədi oxunmur, göndərilmir, emal olunmur. Rəy mənfi
  olarsa və ya şərt qoyarsa, bağlı kod yeni ADR-ə görə dəyişir və ya silinir.

Eyni təsdiqlə ilk tətbiq üçün bunlar müəyyən edildi:

5. **İlk versiyada surət yoxlaması yalnız AA.** İlk versiyada surət yoxlaması aktiv autentifikasiya (AA) ilə aparılır; çip
   autentifikasiyası (CA) növbəti addımdır. Bu müddətdə yalnız CA dəstəkləyən çip K5-dəki kimi `document_chip_verified: false`
   ilə emal olunur.
6. **DG11 yoxdursa, çip yolu bağlanır.** Şəxsiyyət sənədində ad və soyadın tam yazılışı (türk hərfləri ilə) çipdəki DG11-dən
   götürülür; MRZ-dəki türk hərfləri olmayan ad sənədə yazılmır. Çipdə DG11 yoxdursa, həmin sənəd üçün çip yolu bağlanır və
   sənəd fotoşəkli yoluna keçilir.
7. **Üz uyğunluğunda istinad təsviri.** Üz uyğunluğu mövcud provayderin biometrik yoxlama iş axınında çipdəki DG2
   fotoşəklinin istinad təsviri kimi verilməsi ilə aparılır (sessiya açılarkən istinad portreti, base64, ən çox 2 MB;
   provayderin sənədlərində təsdiqləndi). Provayderə məxsus bu təfərrüat adapterin daxilində qalır (K6, CV6).
8. **İnterfeys adları** (K10): şəxsiyyət xidmətinin son nöqtələri `/chip/read`, `/chip/submit`, `/chip/continue`; cüzdanın çip
   oxuya bildiyini bildirən PAR sahəsi `chip_reader` (dəyər `icao9303`). Axının təfərrüatı [[SPEC-ID-0003]]-ə tətbiqlə yazılır.

# Əsaslandırma

- **Təminat dövlətin imzasına əsaslanır.** Fotoşəkildən oxunan sahələr proqramın təxminidir; çipdən oxunan sahələr dövlətin
  imzalı məlumatıdır və şəxsiyyət xidməti onu özü yoxlaya bilər. Bu, AB-də uzaqdan şəxsiyyət yoxlamasının daha yüksək səviyyəsinin
  tələb etdiyi yoldur.
- **Provayderdən asılılıq azalır.** Provayder yalnız üz və canlılıq üçün lazımdır; bu hissə bir neçə provayderdən alına bilər.
- **Ötürmə hücumu çətinləşir.** Çip axını başladan telefonda oxunduğu üçün ötürülmüş keçid tək başına işə yaramır ([[ADR-0080]]
  qalan riski azalır, K1–K4 olduğu kimi qüvvədədir).
- **Əvvəlcə hüquq.** Çipdəki fotoşəklin emalı Türkiyədə açıq hüquqi sualdır; səhv yozularsa, geri qaytarılması çətin şəxsi
  məlumat problemi yaranar. Ona görə qərar indi qəbul edilir, çip yolu rəydən sonra açılır. Bağlı kod real şəxsin məlumatını
  emal etmir; rəy gəldikdə proqram təminatının hazır olmasını təmin edir.
- **Xərc ikinci planda.** Hər yoxlamaya düşən qənaət kiçikdir; bu qərar xərc üçün deyil, təminat və müstəqillik üçün qəbul edilir.

# Qiymətləndirilən seçimlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| **Çipi cüzdan oxuyur, şəxsiyyət xidməti yoxlayır, üz/canlılıq provayderdə** | **qəbul** | Məlumat dövlət imzası ilə yoxlanılır; provayderdən müstəqillik; ötürmə hücumu çətinləşir; cüzdan provayderlə əlaqə qurmur |
| Bugünkü yol (yalnız provayder, sənəd fotoşəkli) | ehtiyat kimi qalır | İşləyir, ucuzdur; lakin təminat provayderin proqram təminatından asılıdır və AB-nin yüksək səviyyəsinə çatmır |
| Provayderin çip oxuma funksiyası (provayderin telefon komponenti cüzdana yerləşdirilir) | rədd | Cüzdanı bir provayderə bağlayır, IDP3-ə və [[ADR-0042]]-yə ziddir; yoxlama yenə provayderdə qalır |
| Üz və canlılığı da özümüz etmək | rədd | Təqdimat və təsvir inyeksiyası hücumları ixtisas və müstəqil sınaq tələb edir; səhv qəbul birbaşa saxta şəxsiyyət deməkdir |
| Ayrıca "şəxsiyyət yoxlaması" tətbiqi | indi seçilmədi | İstifadəçi üçün ikinci tətbiq; şəbəkənin idarə etdiyi tətbiq olar. Cüzdan oxuyucu kimi kifayətdir |
| Kodu indi, bağlı açarın arxasında yazmaq; açılışı hüquqi rəyə bağlamaq | **qəbul (2026-11-13 dəyişikliyi)** | Rəy gəldikdə proqram təminatı hazır olur; bağlı kod serverdə işləmir, mağaza yığımına daxil olmur, real şəxsin məlumatını emal etmir (K11) |
| Kodu yalnız hüquqi rəydən sonra yazmaq (ilk qəbul mətni) | dəyişdi (2026-11-13) | Rəydən sonra proqram təminatı aylarla gözlənilərdi; bağlı kodla eyni təminat qorunur |
| Qəbul edib dərhal sandbox-da açmaq | rədd | Hüquqi rəy gəlmədən çipdəki fotoşəkil sandbox-da da emal olunmur (K11) |
| Təhlükəsiz e-imza / mobil imza yolunu önə çəkmək | növbəti addım | Dövlətin nəzarət etdiyi sertifikata əsaslanır, lakin istifadəçidə sertifikat olmasını tələb edir; çip yolundan sonra ayrıca ADR ilə (K12) |
| Yalnız səlahiyyətli mənbə (dövlət, bank, operator) | uzunmüddətli istiqamət | Bu gün əlçatan yol yoxdur; gəldikdə bu qərarın yerinə deyil, yanına əlavə olunur; dövlət PID-i gəldikdə şəxsiyyət sənədi onsuz da yerini ona verir |

# Nəticələr

- **Şəxsiyyət xidməti (operatorun deposu).** Çip məlumatını qəbul edən son nöqtə, passiv autentifikasiya, AA sınağı (sonra CA),
  kök sertifikatların yüklənməsi, DG2 ilə provayderdə üz uyğunluğu, testlər (etibarlı sənəd, dəyişdirilmiş məlumat qrupu, naməlum
  kök, uğursuz surət sınağı, təkrar oynadılan sınaq). Kod indi, bağlı açarın arxasında yazılır; açar açıq olduqda xidmət
  serverdə başlamır; açılış K11-ə görə hüquqi rəydən sonra.
- **Cüzdan nüvəsi və cüzdan tətbiqi.** NFC oxuma (iOS və Android), MRZ/CAN daxil etmə və ya MRZ-nin kamera ilə oxunması, xam
  məlumatın ötürülməsi; NFC icazə mətni; əlçatanlıq və "sənədimdə çip yoxdur" yolu. Kod indi yazılır: cüzdan nüvəsindəki
  daşıyıcı açıq depoya daxil olur, npm buraxılışı hüquqi rəydən sonra; cüzdan tətbiqinin mağaza yığımlarında çip oxuma və NFC
  icazələri olmur. Real kartla sınaq hüquqi rəydən sonra.
- **Oxuyucu kitabxanasının lisenziyası.** Android-də LGPL lisenziyalı açıq mənbəli oxuyucu kitabxanası istifadə olunur;
  onun cüzdan tətbiqi ilə birlikdə yayılmasının öhdəlikləri hüquqi rəyə verilir.
- **Spesifikasiyalar.** [[SPEC-ID-0003]]: IDP3-ün yeni mətni və `document_chip_verified` mənası qəbulla əlavə edildi (versiya
  qeydi 2026-11-13); çip yolunun axını və açıq interfeys (K10) tətbiqlə yazılır. [[SPEC-PROTO-0001]] (şəxsiyyət xidmətinin
  axınındakı əlavə addım) və [[SPEC-WALLET-0001]] (cüzdanın oxuyucu rolu və "dəyişdirmədən ötür" qaydası) tətbiqlə yenilənir.
- **Tamga ARF.** Tamga Rulebook RB-AP-ID-01 (IDP3-ün qarşılığı) və Identity Rulebook-da `document_chip_verified` tərifi qəbulla
  yeniləndi.
- **Bugünkü kod və CV2.** Bugünkü şəxsiyyət xidməti `document_chip_verified` sahəsini provayderin çip nəticəsindən doldura
  bilər; provayderin iş axınında çip addımı istifadə olunmadığı üçün ([[SPEC-ID-0003]] §4) sahə bu gün `false`-dur. Çip yolu
  kodlaşdırılana qədər provayderin iş axınına çip addımı əlavə edilmir; CV2 çip yolu kodlaşdırılarkən koda keçir.
- **Etibar siyahısı.** Şəxsiyyət xidmətinin `assurance_basis` mətni çip yolu açıldıqda onu qeyd edir; sinif və təminat
  səviyyəsi bu qərarla dəyişmir ([[ADR-0022]]; yüksəltmə yalnız müstəqil qiymətləndirmədən sonra).
- **Şəxsi məlumat.** Məlumatlandırma mətninə çipin oxunması və çipdəki fotoşəklin üz uyğunluğu üçün provayderə göndərilməsi
  əlavə olunur; mətn hüquqi rəyə uyğun yazılır.

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| CV1 | Çip məlumatı şəxsiyyət xidmətində server tərəfində yoxlanılır (passiv autentifikasiya və varsa surət yoxlaması); cüzdanın və ya telefonun bildirdiyi yoxlama nəticəsi qəbul edilmir. |
| CV2 | `document_chip_verified: true` yalnız passiv autentifikasiya, surət yoxlaması (AA və ya CA) və DG2 ilə canlı üz uyğunluğu birlikdə uğurlu olduqda yazılır; əks halda `false`. |
| CV3 | Aktiv autentifikasiya (AA) sınağı şəxsiyyət xidməti tərəfindən yaradılır, birdəfəlikdir, axına bağlıdır və qısa ömürlüdür. |
| CV4 | Cüzdan çip məlumatını yalnız oxuyur və dəyişdirmədən şəxsiyyət xidmətinə ötürür; yoxlamır, qərar vermir, saxlamır, jurnala yazmır və provayderlə əlaqə qurmur. Çipə giriş açarı (MRZ/CAN) telefondan çıxmır. |
| CV5 | Xam çip məlumatı və DG2 fotoşəkli sənədin verilməsi anından sonra saxlanılmır, jurnala və audit qeydinə yazılmır. |
| CV6 | Üz və canlılıq provayderi şəxsiyyət xidmətində adapterin arxasındadır; şəxsiyyət sənədinə, etibar siyahısına və cüzdana provayderə məxsus heç bir dəyər daxil olmur. |
| CV7 | Çip yolu müsbət hüquqi rəy gəlmədən heç bir mühitdə açılmır. Kodu yazıla bilər, lakin standart olaraq bağlı açarın arxasında durur: açar açıq olduqda şəxsiyyət xidməti serverdə işləməkdən imtina edir; cüzdanın mağaza yığımlarında çip oxuma olmur; kod yalnız yerli testlərdə saxta sənəd məlumatı ilə işləyir. Bir ölkənin sənədi üçün çip yolu həmin ölkənin kök sertifikatı etibarlı mənbədən götürülmədən və hüquqi araşdırması müsbət nəticələnmədən real şəbəkədə açılmır. |

# Status

**Accepted — 2026-11-13.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-13): qəbul; canlılıq və üz uyğunluğu mövcud provayderlə,
dəyişdirilə bilən şəkildə; təhlükəsiz e-imza / mobil imza yolu çip yolundan sonra. DECISIONS: D-ID-16. CV1–CV7 məcburidir.
[[SPEC-ID-0003]]/IDP3 bu qərarla daraldıldı.

> **Dəyişiklik (2026-11-13):** K11 və CV7 dəyişdi — kod indi, bağlı açarın arxasında yazılır (serverdə işləmir, mağaza
> yığımına daxil olmur, yalnız yerli testdə saxta sənəd məlumatı ilə); çip yolunun açılışı hüquqi rəydən sonra (olduğu kimi).
> İlk versiya: surət yoxlaması yalnız AA, DG11 yoxdursa çip yolu bağlanır, üz uyğunluğunda DG2 istinad təsviri. Layihə
> rəhbərliyinin təsdiqi ilə.
