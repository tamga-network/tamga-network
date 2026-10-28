---
document_id: ADR-0040
title: "Sandbox-da real şəxsiyyətin yoxlanılması"
status: Active
version: 1.0.0
created: 2026-10-04
last_updated: 2026-10-28
summary: >
  Sandbox-da şəxsiyyət axını iki seçim təqdim edir: "Real şəxsiyyətinizi yoxlayan tərəf ilə təsdiqləyin (Didit)" və "Sürətli sınaq (saxta şəxs)". Real yol hamı üçün açıqdır (dəvət kodu istəyə bağlı rejim kimi qalır) və real şəbəkənin Didit hesabını və şəxsiyyət axınını paylaşır; ayrıca provayder tətbiqi yoxdur. Pulsuz aylıq kvota real şəbəkə ilə ortaq olduğu üçün sandbox-un gündəlik və aylıq limiti var; limit dolduqda yalnız sürətli sınaq açıq olur. Şəxs skan etməzdən əvvəl açıq xəbərdarlığı təsdiqləyir; rəqəmsal sənədə yalnız ad, soyad və doğum tarixi keçir, provayderdəki sessiya dərhal silinir və hər şey gecə sıfırlanmasında silinir. Qəbul edilmiş risklər (ortaq kvota, sandbox-un provayder açarını oxuya bilməsi, webhook-un real şəbəkəyə getməsi) və onların azaldılması yazılı şəkildə qeyd olunub. ADR-0038-in K4 bəndini və SB3 qaydasını dəyişir.
domain: Identity
translation_of: ADR-0040
source_version: "1.0.0"
---

# Qısaca

Sandbox-da şəxslər uydurmadır, şəxsiyyətin yoxlanılması isə standart olaraq saxta provayderin ekranında "Təsdiqlə" düyməsi ilə başa çatır. Bu,
rəqəmsal cüzdanın axınını sınamaq üçün kifayətdir, lakin cüzdan tərtibatçısı və ya qurum real şəxsiyyət yoxlaması addımlarını
(sənədin skan edilməsi, canlılıq yoxlaması, üz uyğunlaşdırılması) tətbiq daxilində necə göründüyü ilə birlikdə görmək istəyir.

Bu qərar sandbox-da real addımları **istəyən hər kəs** üçün açır. Şəxsiyyət axınının ilk ekranında iki seçim var: "Real
şəxsiyyətinizi yoxlayan tərəf ilə təsdiqləyin (Didit)" və "Sürətli sınaq (saxta şəxs)". Real yol real şəbəkənin Didit hesabı ilə işləyir; bunun yaratdığı
risklər aşağıda açıq şəkildə qəbul edilib və məhdudlaşdırılıb.

# Kontekst

- [[ADR-0038]] K4 və `ADR-0038/SB3`: sandbox-da real fərdi məlumatlar yoxdur, şəxsiyyətin yoxlanılması saxta provayderlə aparılır.
- Şəxsiyyətin yoxlanılması yalnız şəxsiyyət xidmətində aparılır ([[ADR-0011]], `SPEC-ID-0003/IDP3`); şəxs sahələri rəqəmsal sənəd verilənədək
  saxlanılır, təsvirlər saxlanılmır (`SPEC-ID-0003/IDP9`). Şəxsiyyət xidməti kvalifikasiyalı olmayan EAA verir ([[ADR-0022]]).
- Rəqəmsal cüzdan şəxsiyyət yoxlamasını tətbiqdən çıxmadan (tətbiqdaxili brauzerdə) aparmağa keçir. Bu ekranları real
  provayderlə sınamağın bu gün yeganə yolu real şəbəkədir; real şəbəkədə isə test və sınaq aparılmır.
- Bu qərarın ilk mətni real yolu yalnız dəvət kodu ilə və provayderin ayrıca sandbox tətbiqi ilə açırdı. Layihə
  rəhbərliyi 2026-10-05 tarixində iki istiqamət verdi: real yol hamı üçün açıq olsun; sandbox üçün provayderdə ayrıca tətbiq açılmasın, real
  şəbəkənin provayder hesabı və mövcud pulsuz şəxsiyyət axını istifadə olunsun. Bu mətn həmin istiqamətə uyğun yenidən yazılıb.

# Qərar

**K1 — İki seçim, hamı üçün açıq.** Sandbox-da şəxsiyyət rəqəmsal sənədi axınında məlumatlandırma razılığından sonra iki seçim göstərilir:
"Real şəxsiyyətinizi yoxlayan tərəf ilə təsdiqləyin (Didit)" və "Sürətli sınaq (saxta şəxs)". Sürətli sınaq əvvəlki kimi saxta provayderə yönəlir və
seçim edilməyən hər axın sürətli sınaq sayılır. Real yol üçün dəvət tələb olunmur. Real yol tənzimlənməyibsə (provayder açarı yoxdursa)
və ya limit dolubsa (K3), yalnız sürətli sınaq göstərilir və sadə bir mesaj yazılır ("Bu günlük kvota doldu, sürətli sınaqdan
istifadə edin").

**K2 — Dəvət kodu isteğe bağlı rejimdir.** Dəvət kodu infrastrukturu qalır və yalnız sandbox inzibatçısı aktivləşdirdikdə istifadə olunur
(`TAMGA_IDV_DIDIT_SANDBOX_MODE=invite`; ilk mətndə standart dəyər `open` — **2026-10-28 qeydi: standart `invite`**). Bu rejimdə real yol yalnız etibarlı dəvət kodu ilə açılır.
Kodu yalnız sandbox inzibatçısı yaradır (sandbox səhifəsinin inzibatçı bölməsi, inzibatçı tokeni ilə; bölmə xaricə bağlıdır,
yalnız serverin özündən açılır). İki növ kod var: **fərdi** (birdəfəlik; ən çox 7 gün etibarlı) və
**müddətli** (tədbir və ya seminar üçün; ən çox 72 saat və ən çox 25 istifadə). İstifadə hüququ provayder sessiyası
**açılarkən** azalır; rəqəmsal sənəd verilərkən kod hələ etibarlı olmalıdır. Kod ən azı 128 bit təsadüfidir, verilənlər bazasında yalnız
onun açarlı heşi saxlanılır; açıq kod yalnız yaradıldığı anda bir dəfə göstərilir və jurnala yazılmır. Uğursuz cəhdlər axın üzrə və
xidmət üzrə ümumi məhdudlaşdırılır; inzibatçı bölməsində yanlış token eksponensial gecikmə ilə ləngidilir. Dəvət kodu limiti (K3) aşa bilməz.

**K3 — Real şəbəkənin provayder hesabı və limitlər.** Real yol provayderdə ayrıca tətbiq açmadan **real şəbəkənin Didit
hesabı və şəxsiyyət axını ilə** işləyir. Dəyərlər sandbox-a ayrı adlı dəyişənlərlə (`TAMGA_IDV_DIDIT_SANDBOX_*`) verilir; dəyərlər
real şəbəkəninki ilə eynidir. Serverdə bunları sandbox quraşdırma skripti real şəbəkənin tənzimləmələrindən köçürür (`sandbox-setup.sh
didit-from-main`); dəyərlər ekrana və jurnala çıxarılmır. Sandbox-un əsas provayderi həmişə saxtadır. Pulsuz aylıq kvota
real şəbəkə ilə ortaq olduğundan sandbox-da açılan **bütün** real sessiyalar (açıq və dəvətli) iki limitə hesablanır: **gündəlik
limit** (standart 15, `TAMGA_IDV_DIDIT_SANDBOX_DAILY_CAP`) və **aylıq limit** (standart 150,
`TAMGA_IDV_DIDIT_SANDBOX_MONTHLY_CAP`; gün və ay Türkiyə vaxtı ilə). Hüquq provayder sessiyası açılarkən azalır; limitlərdən biri dolduqda
yeni real sessiya açılmır. Sayğac şəxs məlumatı daşımır və gecə sıfırlanmasında cari ayın dəyərləri ilə qorunur (sıfırlama aylıq
limiti yan keçə bilməz). Hər axında ən çox bir real sessiya açılır.

**K4 — Skan etməzdən əvvəl açıq xəbərdarlıq.** Real yol seçildikdə, provayderə keçməzdən əvvəl ayrıca xəbərdarlıq səhifəsi göstərilir və şəxs
təsdiq qutusunu işarələmədən davam edə bilməz: "Bu test mühitidir; siz real şəxsiyyətinizlə sınaq edirsiniz; məlumatlarınız hər gecə silinir;
Didit sessiyası rəqəmsal sənəd verilən kimi silinir." Eyni səhifədə qısa məlumatlandırma mətni və şəxsin hüquqları yer alır; provayder
hesabının real şəbəkə ilə ortaq olduğu da yazılır.

**K5 — Minimum məlumat.** Sandbox rəqəmsal sənədinə şəxsdən yalnız **ad, soyad və doğum tarixi** keçir (bunlardan törəyən 18 yaş məlumatı,
sənədin ölkə kodu və növü daxil olmaqla). Real şəxsiyyət nömrəsi və sənəd nömrəsi rəqəmsal sənədə yazılmır; onların yerinə hər sənəddə yeni,
təsadüfi və açıq şəkildə test olduğu bəlli olan dəyər (`SANDBOX-…`) qoyulur. Beləliklə, sandbox sənədi real şəbəkədəki rəqəmsal sənədlərlə və
psevdonimlərlə əlaqələndirilə bilməz. Şəxsiyyət xidməti şəxs sahələrini yalnız rəqəmsal sənəd verilənədək yaddaşda saxlayır (`SPEC-ID-0003/IDP9`);
təsvirlər heç vaxt Tamga-ya gəlmir.

**K6 — Provayder sessiyası hər halda dərhal silinir.** Rəqəmsal sənəd verildiyi anda provayderdəki yoxlama sessiyası (təsvirlər daxil olmaqla)
silinir; yoxlama uğursuz olarsa və ya yarımçıq qalarsa da silinir. Açıq qalan sessiyalar qeydə alınır və gecə sıfırlanmasında,
verilənlər bazası silinməzdən əvvəl provayderdə silinir; silinə bilməyən sessiya növbəti sıfırlamada yenidən cəhd edilir. Sandbox şəxsiyyət xidməti
provayder sessiyasının identifikatorunu rəqəmsal sənəd qeydində saxlamır.

**K7 — Webhook-a etibar edilmir.** Provayder hesabının webhook ünvanı real şəbəkənin şəxsiyyət xidmətidir; sandbox sessiyalarının
bildirişləri də ora gedir. Sandbox webhook-a etibar etmir: qərarı yalnız şəxs geri qayıtdıqda (`/idv/return`) provayderin
API-sindən çəkir. Real şəbəkənin şəxsiyyət xidməti özünün açmadığı sessiyanın bildirişini səssizcə nəzərə almır (status dəyişmir,
jurnala yazılmır).

**K8 — Gecə silinir, jurnalda şəxs məlumatı yoxdur.** Gecə sıfırlanmasında ([[ADR-0038]] K5) kodlar, rəqəmsal sənəd qeydləri və bütün axın
vəziyyəti silinir (yalnız K3-dəki sayğac qorunur). Jurnallara yalnız hadisə adı, kod identifikatoru və saylar yazılır; ad, doğum tarixi,
kod və ya provayder cavabı yazılmır.

**K9 — Məhdudiyyət.** Real yol sürücülük vəsiqəsi rəqəmsal sənədinin məlumatları ([[ADR-0039]]) üçün açılmır; bu növ sandbox-da yalnız saxta provayderlə
sınanır. Məlumatlandırma mətni hamı üçün açıq istifadəyə uyğun yenilənir və hüquqi yoxlamadan keçir.

# Qəbul edilmiş risklər

Real şəbəkənin provayder hesabını paylaşmaq üç riski şüurlu şəkildə qəbul edir; hər biri məhdudlaşdırılıb.

| Risk | Nə baş verir | Azaldılma |
|---|---|---|
| **Ortaq kvota** | Sandbox-da açılan sessiyalar real şəbəkənin pulsuz aylıq yoxlama hüququndan çıxılır; həddindən artıq istifadə real şəbəkənin yoxlamasını pozа bilər. | Gündəlik (15) və aylıq (150) limit (K3); dolduqda yalnız sürətli sınaq; dəvət kodu da limiti aşa bilməz; axın üzrə tək sessiya; sayğac gecə sıfırlanması ilə yan keçilə bilməz. |
| **Sandbox provayder açarını oxuya bilər** | Sandbox xidmət istifadəçisi artıq provayder açarını oxuyur; sandbox ələ keçirilərsə, açar sızar və hesabda sessiya açılıb oxuna bilər. | Açar yalnız sandbox tənzimləmə faylında saxlanılır və yalnız sandbox istifadəçisi üçün oxunaqlıdır (`root:tamga-sandbox 640`); real şəbəkənin tənzimləmə faylı, imza açarları, məlumatları və ehtiyat nüsxələri sandbox üçün yenə bağlıdır (fayl icazəsi + xidmət məhdudiyyəti). Webhook gizli açarı sandbox-a köçürülmür. Şübhə olduqda açarın rotasiyası: provayder panelində yeni açar → real şəbəkənin tənzimləmələrinə yazılır və real şəxsiyyət xidməti yenidən başladılır → `sandbox-setup.sh didit-from-main` yenidən icra edilir → köhnə açar paneldə ləğv edilir. |
| **Webhook real şəbəkəyə gedir** | Sandbox sessiyalarının bildirişləri real şəbəkənin şəxsiyyət xidmətinə çatır. | Sandbox webhook-a etibar etmir, qərarı API-dən çəkir; real şəbəkə tanımadığı sessiyanın bildirişini səssizcə nəzərə almır (K7). Bildiriş yalnız tetikleyicidir, şəxs məlumatı oxunmur. |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| RI1 | Sandbox-da şəxsiyyət axını iki seçim təklif edir (real şəxsiyyətlə provayder və ya sürətli sınaq); seçim edilməyən axın saxta provayderlə həyata keçirilir. Sürətli sınaq hamı üçün açıqdır. Real yol standart olaraq yalnız etibarlı dəvət kodu ilə açılır (2026-10-28 qeydi: hüquqi baxış bitənə qədər); açıq rejim (`open`) yalnız açıq şəkildə təyin edildikdə keçərlidir. |
| RI2 | Sandbox-un real yolu real şəbəkənin provayder hesabından yalnız ayrıca adlandırılmış sandbox dəyişənləri ilə istifadə edir; bu dəyərləri yalnız sandbox istifadəçisi oxuya bilir, real şəbəkənin parametrləri, imza açarları və məlumatları sandbox üçün bağlıdır; real şəbəkə sandbox adlarını qəbul etmir. Sandbox provayder bildirişinə (webhook) etibar etmir, qərarı provayderin API-sindən çəkir; real şəbəkə özünün açmadığı sessiyanın bildirişinə məhəl qoymur. |
| RI3 | Real yolda şəxs provayderə yönləndirilməzdən əvvəl test mühiti xəbərdarlığını açıq şəkildə təsdiqləyir. |
| RI4 | Sandbox rəqəmsal sənədinə real şəxsiyyət nömrəsi və sənəd nömrəsi yazılmır; şəxsdən yalnız ad, soyad və doğum tarixi (və ondan törənən yaş məlumatı) ötürülür. |
| RI5 | Provayderdəki yoxlama sessiyası rəqəmsal sənəd verildikdə və ya axın rəqəmsal sənədlə nəticələnmədikdə dərhal silinir, açıq qalan sessiya ən gec gecə sıfırlanmasında silinir; sandbox şəxsiyyət xidməti sessiya identifikatorunu daimi qeyddə saxlamır; hər axın üçün ən çoxu bir real sessiya açılır. |
| RI6 | Dəvət kodları yalnız açarlı heş şəklində saxlanılır; açıq kod, ad, doğum tarixi və provayder cavabı heç bir jurnala yazılmır; hamısı gecə sıfırlanmasında silinir. |
| RI7 | Sandbox-da açılan hər real provayder sessiyası (açıq və ya dəvətli) gündəlik və aylıq limitə hesablanır; limit dolduqda real sessiya açılmır, yalnız sürətli sınaq qalır; sayğac gecə sıfırlanması ilə sıfırlanmır. |

`ADR-0038/SB3` bu qərarla yenidən yazıldı (ADR-0038-ə baxın).

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Sandbox-da yalnız saxta provayder | rədd | Tətbiqdaxili şəxsiyyət yoxlaması ekranları və real xəta halları real şəbəkəyə çıxmadan sınaqdan keçirilə bilməz. |
| Provayderdə ayrıca sandbox tətbiqi (ilkin mətn) | rədd (2026-10-05) | Ayrıca hesab və axın qurulması tələb edir; mövcud pulsuz axın kifayətdir. Ayrılığın verdiyi qoruma limit, açarı yalnız sandbox istifadəçisinin oxuya bilməsi və webhook-a etibar etməmək vasitəsilə təmin olunur. |
| Yalnız dəvət kodu ilə real yol (ilkin mətn) | isteğe bağlı rejim | Hər kəsin sınaqdan keçirməsi istənilir; sui-istifadə və xərc limitlə məhdudlaşdırılır. Dəvət rejimi lazım olduqda aktivləşdirilə bilər. |
| **İki seçim + real şəbəkənin hesabı + limit + minimum məlumat** | **qəbul** | Real addımları hər kəs sınaqdan keçirir; şəxs bilərəkdən sınayır; rəqəmsal sənədə minimum məlumat ötürülür; ümumi kvota və açar riski məhduddur. |
| Rəqəmsal sənədə real şəxsiyyət nömrəsinin də yazılması | rədd | Sandbox rəqəmsal sənədi real şəbəkədəki rəqəmsal sənədlərlə və psevdonimlərlə əlaqələndirilə bilən hala gələrdi; sınaq üçün lazım deyil. |

# Nəticələr

- Şəxsiyyət xidməti sandbox rejimində iki provayderi birlikdə saxlayır: saxta provayder (sürətli sınaq) və real provayder; seçim
  şəxsin seçimi ilə həmin axın üçün edilir.
- Sandbox quraşdırma skriptinə `didit-from-main` əmri əlavə olunur: real şəbəkənin provayder açarını və şəxsiyyət axınını sandbox
  parametrlərinə ayrı adlarla yazır, limit üzrə defolt dəyərləri əlavə edir və sandbox şəxsiyyət xidmətini yenidən başladır. Sandbox ilə real
  şəbəkənin açarlarının eyni olmasının qarşısını alan köhnə yoxlama ləğv edilir.
- Sandbox səhifəsi və rəqəmsal cüzdanın sandbox mətnləri iki seçimi izah edir; dəvət kodu yaratma bölməsi isteğe bağlı rejim üçün qalır.
  Sandbox bələdçisi və KVKK məlumatlandırma layihəsi hamı üçün açıq istifadəyə uyğun yenilənir.

## Qeyd (2026-10-28, kiçik dəyişiklik — yeni ADR yoxdur)

- **Standart rejim `invite`.** Fərdi məlumatların qorunması üzrə ilkin baxış (layihə rəhbərliyi, 2026-10-28) hüquqi baxış bitməmiş real
  yolun hamıya açıq qalmasını risk kimi qeyd etdi. Real yol (provayderdə real şəxsiyyətlə yoxlama) indi **standart olaraq yalnız
  etibarlı dəvət kodu ilə** açılır; `TAMGA_IDV_DIDIT_SANDBOX_MODE=open` yalnız açıq yazıldıqda hamıya açılır. Sürətli sınaq (uydurma
  şəxs) hər rejimdə hamıya açıqdır; OpenID uyğunluq testləri və səhnələr bu yolu istifadə edir. K1/K2-dəki "standart `open`" bu qeydlə
  oxunur; RI1 buna uyğun yenidən yazıldı. Baxış bitdikdən sonra rejim layihə rəhbərliyinin qərarı ilə yenidən açıla bilər (bir mühit
  dəyişəni).
- **Provayderdə silinmə ifadəsi.** Xəbərdarlıq və məlumatlandırma mətnlərində "Didit sessiyası sənəd verilən kimi silinir" əvəzinə
  "sessiyanın silinməsi sənəd verilən kimi **tələb olunur**" yazılır: provayder hesabında silmə icazəsi (`delete:sessions`) və məlumat
  emalı müqaviləsi tamamlanana qədər tələb provayderin öz saxlama parametrinə tabedir. K4/K6 qaydası (dərhal silmə tələbi) dəyişmir;
  yalnız şəxsə verilən vəd bugünkü vəziyyətə uyğun gəlir.

# Status

**Accepted — 2026-10-04**, **yeniləndi 2026-10-05** (hamı üçün açıq real yol; real şəbəkənin provayder hesabı; limitlər və qəbul
edilmiş risklər) — layihə rəhbərliyinin təsdiqi; hərfi sitatlar xüsusi təsdiq qeydindədir. DECISIONS: D-ID-9. [[ADR-0038]] K4 və SB3-ü
qismən dəyişdirir.
