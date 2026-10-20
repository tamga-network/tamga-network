---
document_id: ADR-0041
title: "Sandbox-da qurum test hesabları"
status: Active
version: 1.0.0
created: 2026-10-04
last_updated: 2026-10-04
summary: >
  Qurum sandbox səhifəsindən e-poçt təsdiqi olmadan öz test qurumunu açır və passkey ilə daxil olduğu konsolda öz uydurma qeydlərini daxil edir və ya CSV ilə yükləyir. Test qurumunun rəqəmsal sənəd imza sertifikatlarını sandbox-dakı ayrıca aralıq sertifikat mərkəzi avtomatik verir (sandbox kökünün şəxsi açarı serverdə deyil), qurum sandbox etibar siyahısına "test qurumu" işarəsi ilə avtomatik əlavə olunur; qurum rəqəmsal sənəd verir və Tamga Verify onu sandbox-da yoxlayır. Hər şey hər gecə silinir. Real şəxs məlumatlarına qarşı xəbərdarlıq və şəxsiyyət nömrəsi şablon yoxlaması, sui-istifadəyə qarşı say və sürət limitləri mövcuddur. ADR-0038-in K1 (sandbox-da konsol yoxdur) və K7 (özünüqeydiyyat növbəti mərhələdir) bəndlərini qurumlar üçün dəyişir.
domain: Services
translation_of: ADR-0041
source_version: "1.0.0"
---

# Qısaca

Sandbox-dakı nümunə qurumlar rəqəmsal cüzdan tərtibatçısının işinə yarayır, lakin qurum öz rəqəmsal sənədini öz məlumatları ilə sınamaq istəyir:
"bizim diplomumuz rəqəmsal cüzdanda necə görünür, yoxlayan tərəf nə görür?". Bu qərar qurumun sandbox-da bir neçə dəqiqəyə öz test
qurumunu açmasına, qeyd daxil edib rəqəmsal sənəd verməsinə və yoxlamanı görməsinə imkan verir. Hamısı test açarı ilə imzalanır və hər gecə
silinir.

# Kontekst

- [[ADR-0038]] K1: sandbox-da qurum konsolu yoxdur; K7: xarici iştirakçıların özlərini sandbox siyahısına əlavə etməsi növbəti
  mərhələdir və ayrıca qərar tələb edir.
- [[ADR-0019]]: Qurum Konsolu dəvət + passkey ilə işləyir; hər sorğu sessiyadakı quruma bağlıdır. Nümunə reyestr
  ([[ADR-0020]]) yalnız sınaq üçündür; real şəbəkədə bu rejim kod kilidi ilə bağlıdır.
- Sandbox kök sertifikatının şəxsi açarı serverə göndərilmir; serverdə yalnız yarpaq (leaf) sertifikatların və siyahı imzalayıcısının
  açarları var. Buna görə yeni qurum üçün yeni yarpaq sertifikat yaratmaq bu gün serverdə mümkün deyil.
- Layihə rəhbərliyinin istiqaməti: sınamaq istəyən qurumlar sandbox-da öz məlumatlarını yerləşdirib sınasın; fərdi məlumatlar minimum olsun.

# Qərar

**K1 — Özünüz yaratdığınız test hesabı.** Qurum sandbox səhifəsindəki "Qurumunuzu sınayın" bölməsindən e-poçtun yoxlayan tərəf tərəfindən təsdiqi və dəvət
olmadan test qurumu yaradır: yalnız uydurma qurum adı və qurum növü tələb olunur (ad avtomatik olaraq "(TEST)" ilə bitir). Addakı görünməz və istiqamət
simvolları təmizlənir; real və sandbox siyahılarındakı qurum adlarına bənzəyən adlar, rəsmi qurum sözləri (T.C., Bakanlık,
Belediye, Valilik, Üniversite, University, Ministry …), habelə Tamga və ya provayder adları qəbul edilmir. Yaratma sorğusu yalnız sandbox
səhifəsinin öz mənşəyindən gəlir. Ad,
e-poçt və ya telefon kimi şəxsi məlumatlar tələb olunmur. Yaratma zamanı qurumun ilk administratoru üçün birdəfəlik konsol dəvəti yaradılır;
administrator konsola passkey ilə daxil olur.

**K2 — Sandbox-da konsol yalnız test qurumları üçün açıqdır.** Qurum Konsolu sandbox-da `console.sandbox.tamga.network`
ünvanında yenidən işləyir, lakin yalnız bu qərarla açılan test qurumlarına xidmət göstərir; ilkin (seed) məlumatlardan gələn nümunə qurumlar
konsolsuz qalır. Hər konsol ekranı "SANDBOX · TEST" işarəsini və "real şəxs məlumatlarını daxil etməyin" xəbərdarlığını göstərir. Real şəbəkədəki
sınaq reyestri kilidi olduğu kimi saxlanılır.

**K3 — Uydurma qeydlər və şablon yoxlaması.** Qurum qeydlərini bir-bir daxil edir və ya CSV faylının məzmununu yapışdıraraq
yükləyir. Qeyd ekranlarında real şəxs məlumatlarının daxil edilməməsi üçün aydın xəbərdarlıq var. Hər hansı sahəsində şəxsiyyət nömrəsinin nəzarət
qaydasından (checksum) keçən 11 rəqəmli ədəd olan qeyd rədd edilir (real şəxsiyyət nömrəsi ola bilər); sandbox-ın nümunə şəxsləri
kimi qəsdən etibarsız nömrələr qəbul edilir.

**K4 — Aralıq sertifikat mərkəzi.** Sandbox-da yalnız test qurumlarına yarpaq sertifikat verən ayrıca aralıq sertifikat mərkəzi var:
"Tamga Sandbox Test Institutions CA (TEST)". O, sandbox kökü tərəfindən, kök açarının saxlandığı kompüterdə imzalanır; yalnız bir
səviyyə alt sertifikat verə bilər (yol uzunluğu 0) və yalnız sertifikat imzalayır; ad məhdudiyyəti yalnız sandbox test qurumu subyekt adlarına icazə verir. Müddəti ən çox 1 ildir və
müddət bitmədən kök açarının saxlandığı kompüterdə yenilənir. Şəxsi açarı sandbox serverindədir. Test
qurumunun rəqəmsal sənəd və ləğv siyahısı imza sertifikatlarını bu mərkəz qısa müddətə (ən çox 30 gün) verir; rəqəmsal sənədlər yarpaq + aralıq
sertifikat zəncirini daşıyır və yoxlayan tərəf zənciri sandbox kökünə bağlayır. Kök açarı yenə də serverə göndərilmir.

**K5 — Sandbox siyahısına avtomatik qeydiyyat.** Test qurumu açılan kimi sandbox etibar siyahısına əlavə olunur və siyahı yenidən
imzalanır. Qeyddə `test_institution: true` işarəsi, sandbox dəyərləri ilə doldurulmuş qeydiyyat məlumatları ([[ADR-0024]]) və yalnız
seçilmiş növ üzrə rəqəmsal sənəd vermə səlahiyyəti olur. Test qurumu sandbox-ın yoxlayan tərəfində nümunə qurumlar kimi yoxlanılır; rəqəmsal cüzdan və yoxlayan tərəf
işarəni göstərə bilər.

**K6 — Hər gecə silinir.** Test qurumları, onların hesabları, passkey-ləri, qeydləri, verdikləri rəqəmsal sənədlərin qeydləri və sertifikatları
gecə sıfırlanmasında ([[ADR-0038]] K5) silinir və sandbox siyahısından çıxarılır. Sandbox siyahısında bu, "qeyd silinmir"
qaydasının yeganə istisnasıdır; real şəbəkə siyahısında istisna yoxdur. 7 günlük saxlama variantı rədd edildi (aşağıda).

**K7 — Sui-istifadə limitləri.** Eyni vaxtda ən çox 30 test qurumu; bütün servis üzrə 10 dəqiqədə ən çox 10 yeni qurum;
hər qurum üçün ən çox 200 qeyd; bir CSV yükləməsində ən çox 200 sətir; hər qurum üçün saatda ən çox 100 rəqəmsal sənəd təklifi. Limitlər
IP ünvanından istifadə etmədən tətbiq olunur; təklif limiti konsol, API açarı və daxili son nöqtə üçün vahid sayğacdır. 30 qurum dolduqda ən köhnə
**boş** test qurumu (qeydi və verilmiş rəqəmsal sənədi olmayan, ən azı 30 dəqiqəlik) yer açmaq üçün silinir; boş qurum yoxdursa, istifadəçiyə
gözləməsi bildirilir (limit hamı tərəfindən tükənib kilidlənmir).

**K8 — Mərhələlər.** Mərhələ 1: təhsil qurumu (tələbə sənədi, diplom), konsol, bir-bir və CSV ilə qeyd, yerində (masada) təklif,
sandbox-ın yoxlayan tərəfində yoxlama. Mərhələ 2: tədbir bileti qurumu (konsolda tədbir yaratma), rəqəmsal cüzdanın başlatdığı sənəd verilməsi
(şəxsiyyət təqdimatı ilə uyğunlaşdırma) və test qurumu üçün API açarı. Yoxlayan tərəflərin və cüzdan provayderlərinin özünü
qeydiyyatı ([[ADR-0038]] K7-nin qalan hissəsi) ayrıca qərar tələb edir.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| TI1 | Test qurumu yalnız sandbox-da mövcuddur; onun yarpaq sertifikatlarını yalnız sandbox test qurumları aralıq sertifikat mərkəzi verir; sandbox kökünün şəxsi açarı heç bir serverdə olmur. |
| TI2 | Hər test qurumu sandbox siyahısında `test_institution: true` daşıyır və görünən adı "(TEST)" ilə bitir. |
| TI3 | Sandbox-da Qurum Konsolu yalnız test qurumlarına xidmət göstərir; real şəbəkədə sınaq reyestri rejimi açıla bilməz. |
| TI4 | Şəxsiyyət nömrəsinin nəzarət qaydasından keçən 11 rəqəmli ədəd daşıyan test qeydi rədd edilir; hər qeyd ekranı real şəxs məlumatlarının daxil edilməməsi barədə xəbərdarlıq edir. |
| TI5 | Test qurumları və onlara aid hesab, qeyd, rəqəmsal sənəd qeydi və sertifikatlar gecə sıfırlanmasında silinir və sandbox siyahısından çıxarılır. |
| TI6 | Test qurumu açma və istifadə limitləri IP ünvanından istifadə edilmədən tətbiq olunur. |

# Əsaslandırma / alternativlər

| Variant | Nəticə | Səbəb |
|---|---|---|
| Kök açarını sandbox serverinə yerləşdirmək | rədd | Server ələ keçirilərsə, sandbox kökü altında hər şey imzalana bilər; rəqəmsal cüzdanlardakı sabit kökü dəyişmək lazım gələr. |
| Əvvəlcədən yaradılmış sertifikat hovuzu | rədd | Sayı məhduddur; hovuz bitdikdə əl ilə iş tələb olunur; qurum adı sertifikata yazıla bilməz. |
| Siyahıda özünüimzalı qurum sertifikatı | rədd | Rəqəmsal sənədlərin kökə zəncirlənməsi qaydası (yoxlamanın A3 addımı) pozulur; real şəbəkədən fərqli davranır. |
| **Ayrıca aralıq sertifikat mərkəzi (yol uzunluğu 0, açar sandbox serverində)** | **qəbul** | Kök oflayn qalır; aralıq mərkəz yalnız yarpaq sertifikat verir; ələ keçirilərsə, yalnız aralıq mərkəz ləğv edilir və yenisi kökla imzalanır. |
| E-poçt təsdiqli qeydiyyat | rədd | Fərdi məlumatlar toplayır; sınaq üçün lazım deyil. Sui-istifadə say və sürət limitləri ilə cilovlanır. |
| Test hesabını 7 gün saxlamaq | rədd | Səhvən daxil edilmiş real məlumatlar daha uzun qalır; sandbox-ın vahid və sadə sıfırlama qaydası pozulur. Qurum ertəsi gün bir neçə dəqiqəyə yenidən aça bilər. |
| **Hər gecə silmək** | **qəbul** | `ADR-0038/SB5` ilə eyni qayda; minimum saxlama. |

# Nəticələr

- Sandbox PKI-sına aralıq sertifikat mərkəzi əlavə olunur; sandbox serverinə kökün şəxsi açarı olmadan, aralıq mərkəzin açarı ilə ötürülür.
- Siyahı naşiri sandbox-da test qurumu qeydiyyatını qəbul edir (sertifikat yaradır, qeydi əlavə edir, siyahını imzalayır); qeydlər sandbox məlumat
  qovluğunda saxlanılır və sıfırlamada silinir. Etibar siyahısı spesifikasiyasına isteğe bağlı `test_institution` sahəsi əlavə olunur.
- Rəqəmsal sənəd verən servis sandbox-da yeni test qurumunu yenidən başlatmadan yükləyir; Qurum Konsolu sandbox-da yenidən açılır.
- Sandbox səhifəsinə "Qurumunuzu sınayın" bölməsi, Sandbox bələdçisinə qurumlar üçün izah əlavə olunur. Sandbox üçün yeni ünvan lazımdır:
  `console.sandbox.tamga.network`.

# Status

**Accepted — 2026-10-04** (layihə rəhbərliyinin təsdiqi; hərfi sitat xüsusi təsdiq qeydindədir). DECISIONS: D-TRUST-4. [[ADR-0038]] K1 və
K7-ni qurumlar üçün dəyişir.
