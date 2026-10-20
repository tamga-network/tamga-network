---
document_id: ADR-0038
title: "Sandbox: test şəbəkəsi"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-06
summary: >
  Tamga Network real şəbəkədən tamamilə ayrı bir test şəbəkəsi işlədir: sandbox.tamga.network. Onun öz test kök sertifikatı, öz etibar siyahısı, nümunə qurumları, saxta şəxsləri və hər sənəd növündən nümunə rəqəmsal sənədləri var. Rəqəmsal cüzdan tərtibatçıları, qurumlar və yoxlayan tərəflər bütün axını başdan-sona burada sınaqdan keçirir. Real şəbəkədəki heç bir rəqəmsal cüzdan və ya yoxlayan tərəf sandbox-a etibar etmir; sandbox-da real fərdi məlumatlar olmur və məlumatlar istənilən an sıfırlana bilər.
domain: Trust
translation_of: ADR-0038
source_version: "1.0.0"
---

> **[[ADR-0040]] və [[ADR-0041]] ilə qismən dəyişdirilib (2026-10-04; ADR-0040 2026-10-05-də yenilənib):** sandbox-da
> real şəxsiyyət yoxlaması addımları hamı üçün açıq şəkildə, real şəbəkənin provayder hesabı ilə, gündəlik/aylıq limitlə və minimum məlumatla
> sınana bilər (K4 və SB3 dəyişdi); qurumlar öz test qurumunu yaradıb sandbox-da yenidən açılan
> Qurum Konsolunda sınaya bilər (K1-dəki "konsol yoxdur" və K7-dəki qurumların özünüqeydiyyatı dəyişdi). Digər bəndlər qüvvədədir.

# Qısaca

Rəqəmsal cüzdan, qurum və ya yoxlayan tərəf şəbəkəyə qoşulmazdan əvvəl hər şeyi sınamaq istəyir. Bu gün bunun üçün ya öz
kompüterində lokal sınaq mühiti qurmaq, ya da real servislərdən istifadə etmək lazımdır. Bundan əlavə, hələ rəsmi müqavilə
bağlanmış qurum yoxdur; başdan-sona sınaq üçün nümunə qurumlara və nümunə rəqəmsal sənədlərə ehtiyac var.

Bu qərar şəbəkənin yanında ayrıca test şəbəkəsi açır: sandbox.tamga.network. Orada hər şey realdakının eynidir, yalnız etibar
kökü, açarlar, siyahılar və məlumatlar ayrıdır və saxtadır.

# Kontekst

- [[ADR-0037]] şəbəkənin "işləməsi, sınanması və qurumların qoşulması üçün" istinad xidmətləri işlətdiyini bildirir. Test şəbəkəsi
  bu tərifə daxildir; satılmır və hamı üçün eyni şərtlərlə açıqdır.
- Şəbəkəyə qoşulma [[t:conformance]] şərtinə bağlıdır (Tamga ARF, Trust Framework §4.3). Uyğunluğu yoxlamağın ən təbii yolu
  real şəbəkənin davranışını daşıyan, lakin real şəbəkəyə toxunmayan mühitdir.
- Avropa İttifaqında (Aİ) da rəqəmsal cüzdanlar və yoxlayan tərəflər real etibar siyahılarından ayrı test mühitlərində və qarşılıqlı fəaliyyət
  tədbirlərində sınaqdan keçirilir.
- Bugünkü lokal tərtibat mühiti (tərtibat PKI-ı, lokal etibar siyahıları) yalnız bir kompüterdə işləyir; telefondakı
  rəqəmsal cüzdan, başqa qurumun serveri və ya yoxlayan tərəf ona çıxış əldə edə bilmir.

# Qərar

**K1 — Ayrıca test şəbəkəsi.** Tamga Network real şəbəkədən ayrı bir test şəbəkəsi işlədir. Ünvan: `sandbox.tamga.network` (təqdimat
səhifəsi və bələdçi); içindəki xidmətlər real şəbəkədəki quruluşun eynisi ilə bu ünvanın alt adlarında yerləşir: `trust.sandbox`,
`issuer.sandbox`, `status.sandbox`, `verify.sandbox`, `wallet.sandbox`, `id.sandbox` (`….sandbox.tamga.network`). Beləliklə,
xidmətlər real şəbəkədəki kimi işləyir; rəqəmsal cüzdan və ya yoxlayan tərəf yalnız domen adını dəyişməklə keçid edir. Sandbox-da qurum
konsolu işləmir: nümunə qurumlar, şəxslər və səlahiyyətlər ilkin (seed) məlumatlardan gəlir.

**K2 — Tam ayrılıq.** Sandbox-un öz test kök sertifikatı, öz imza açarları və öz siyahılar siyahısı
([[t:LOTL]]) var. Sandbox siyahısı özünü açıq şəkildə "test" kimi işarələyir. Real şəbəkənin kökü sandbox-da heç nə
imzalamır; sandbox kökü real şəbəkənin heç bir siyahısında yer almır. Real şəbəkədəki rəqəmsal cüzdanlar və yoxlayan tərəflər sandbox-a
etibar etmir; rəqəmsal cüzdan sandbox-a yalnız tərtibatçı ayarlarında açıq şəkildə keçid edildikdə qoşulur və bunu ekranda göstərir.

**K3 — Görünən işarə.** Sandbox-da verilən hər rəqəmsal sənəd test sənədi olduğunu özündə daşıyır (test qurumunun adı və test siyahısı);
sandbox səhifələri və rəqəmsal cüzdan ekranları "Sandbox · test" işarəsini göstərir. Sandbox sənədi real əməliyyatda istifadə edilə bilməz,
çünki real yoxlayan tərəf onun kökünü tanımır.

**K4 — Yalnız saxta məlumatlar.** Sandbox-dakı qurumlar, şəxslər və rəqəmsal sənədlər nümunədir. Real fərdi məlumatlar daxil edilmir; şəxsiyyət
yoxlaması addımı saxta provayderlə həyata keçirilir. Nümunə şəxslərin şəxsiyyət nömrələri açıq şəkildə saxtadır.

**K5 — Sıfırlana bilmə.** Sandbox məlumatları istənilən an, həmçinin müntəzəm olaraq avtomatik şəkildə ilkin vəziyyətinə qayıdır. Sandbox-da
davamlılıq gözlənilmir.

**K6 — Məzmun.** Sandbox-da ən azı bunlar olur: test siyahıları və lövbər jurnalı; hər sənəd növü üçün ən azı bir nümunə qurum
(təhsil, şəxsiyyət, tədbir bileti, əlaqə sənədləri); nümunə şəxslər; test yoxlayan tərəfi və nümunə yoxlama səhifələri
("Tamga ilə daxil ol", yaş yoxlaması, diplom yoxlaması, bilet girişi); test cüzdan provayderi; istifadə bələdçisi.
Nümunə qurumlar sınaq real görünsün deyə real qurum adlarını daşıya bilər. Bu halda sandbox-un hər səhifəsi və
istifadə bələdçisi adların yalnız realist sınaq mühiti üçün istifadə edildiyini, bu qurumlarla heç bir əlaqə və ya müqavilə
olmadığını və rəqəmsal sənədlərin test açarı ilə imzalandığı üçün heç yerdə etibarlı olmadığını açıq şəkildə yazır; qurum loqoları
istifadə edilmir.

> **Qeyd (2026-10-06, layihə rəhbərliyi):** İstanbul Bilgi Universiteti ilə pilot tərəfdaşlıq müqaviləsi var. Bu qurum üçün qeyd
> "pilot tərəfdaşımızdır" deyir; sandbox-dakı halı yenə də yalnız test qurumudur. "Heç bir əlaqə və ya müqavilə yoxdur" cümləsi digər nümunə
> qurumlar üçün keçərlidir. Test açarı xəbərdarlığı və loqo qaydası dəyişmir.

> **Dəyişiklik (2026-10-06, [[ADR-0042]] K3):** K1-dəki `wallet.sandbox` və K6-dakı "test cüzdan provayderi" şəbəkənin xidməti
> deyil. Şəbəkə cüzdan provayderi işlətmir; sandbox-da da hər rəqəmsal cüzdan öz provayderini işlədir və sandbox siyahısında
> qeydiyyatdan keçir (hazırda layihə rəhbərliyinin təsdiqi ilə). Əvvəllər işləyən `wallet.sandbox.tamga.network` 2026-10-06-da istifadədən çıxarıldı; sandbox-un
> öz cüzdan provayderi yoxdur, Tamga Wallet-ın provayderi (`provider.tamgawallet.com`) sandbox siyahısında qeydiyyatdadır. Sandbox birdir; ayrıca cüzdan sandbox-u qurulmur.

**K7 — Növbəti addımlar ayrıca qərar tələb edir.** Kənar iştirakçıların öz qurumlarını, yoxlayan tərəflərini və ya cüzdan
provayderlərini sandbox siyahısına özlərinin əlavə etməsi (özünüqeydiyyat) və rəqəmsal cüzdanları avtomatik sınayıb hesabat verən
uyğunluq servisi növbəti mərhələlərdir; istifadəyə verilməzdən əvvəl ayrıca qərarla müəyyənləşdirilir.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| SB1 | Sandbox kök sertifikatı və sandbox siyahı imzalayanları real şəbəkənin heç bir siyahısında yer almır; real şəbəkənin kök və imza açarları sandbox-da heç nə imzalamır. |
| SB2 | Sandbox siyahılar siyahısı özünü test kimi işarələyir; real şəbəkə üçün konfiqurasiya edilmiş rəqəmsal cüzdan və ya yoxlayan tərəf sandbox siyahısını qəbul etmir. |
| SB3 | Sandbox-un standart şəxsiyyət yoxlaması saxta provayderdir (sürətli sınaq) və nümunə şəxsiyyət nömrələri etibarsız formatdadır; real şəxsin məlumatları yalnız şəxsin özünün seçdiyi [[ADR-0040]] real yolunda və oradakı məhdudiyyətlərlə daxil edilir (skandan əvvəl xəbərdarlıq və razılıq, gündəlik/aylıq limit, real şəxsiyyət və sənəd nömrəsi rəqəmsal sənədə yazılmır, provayder sessiyası dərhal silinir, hər şey gecə sıfırlamasında silinir). |
| SB4 | Sandbox-da verilən hər rəqəmsal sənəd və sandbox-a qoşulan hər ekran test olduğunu görünən şəkildə bildirir. |
| SB5 | Sandbox məlumatları istənilən an sıfırlana bilər; sandbox-a bağlı heç bir proses davamlılıq fərz etmir. |

# Əsaslandırma / alternativlər

| Variant | Nəticə | Səbəb |
|---|---|---|
| Yalnız lokal tərtibat mühiti | rədd | Telefondakı rəqəmsal cüzdan, başqa qurumların serverləri və yoxlayan tərəflər ona çıxış əldə edə bilmir; başdan-sona sınaq aparmaq mümkün deyil. |
| Real şəbəkədə "sınaq" qurumları | rədd | Test sənədləri real yoxlayan tərəflərdə etibarlı olur; etibar siyahısı çirklənir. |
| **Ayrı kök və siyahılarla test şəbəkəsi** | **qəbul** | Real şəbəkənin davranışını daşıyır, lakin real şəbəkəyə heç bir yolla qarışmır; hamı eyni mühitdə sınayır. |
| Bir ünvan altında yollar (`sandbox.tamga.network/issuer/…`) | rədd | Xidmətlər kök ünvanla işləyəcək şəkildə yazılıb (səhifə keçidləri, yönləndirmələr, kukilər, well-known ünvanları); yol prefiksi hər xidmətdə ayrıca uyğunlaşdırma tələb edir və real şəbəkədən fərqli davranır. |
| **`sandbox.tamga.network` altında hər xidmət üçün alt ad** | **qəbul** | Real şəbəkənin quruluşunun eynisi; xidmət kodu dəyişmir. |

# Nəticələr

- Sandbox real şəbəkənin servislərini (siyahı nəşriyyatçısı, sənədi verən qurum, yoxlayan tərəf, cüzdan provayderi, şəxsiyyət servisi) ayrı
  ayarlarla, ayrı açarlarla və ayrı verilənlər bazası ilə işlədir. Qurum konsolu sandbox-da yoxdur; nümunə qurumlar, şəxslər və
  səlahiyyətlər ilkin (seed) məlumatlardan qurulur və hər sıfırlamada ilkin vəziyyətinə qayıdır.
- Tamga Wallet və şəbəkənin qaydalarına uyğun hər rəqəmsal cüzdan tərtibatçı ayarlarında sandbox-a keçə bilər; sandbox kökü cüzdanın daxilində
  ayrıca saxlanılır, real köklə qarışmır.
- Tərtibatçı sənədləşməsinə "Sandbox" bələdçisi, Learn bölməsinə qısa izah, ARF-ə isə test şəbəkəsinin real şəbəkənin hissəsi olmadığını
  bildirən qeyd əlavə edilir.
- Avtomatik rəqəmsal cüzdan analizi və uyğunluq hesabatı gələcəkdə ayrıca nəzərdən keçirilir.

# Status

**Accepted — 2026-10-03** (layihə rəhbərliyinin təsdiqi; hərfi sitat xüsusi təsdiq qeydindədir). K4 və SB3 [[ADR-0040]] ilə (sandbox-da real
şəxsiyyət yoxlaması; 2026-10-05-də hamı üçün açıldı), K1-dəki "qurum konsolu işləmir" və K7-dəki qurumların özünüqeydiyyatı [[ADR-0041]] ilə (qurum test
hesabları) dəyişdi (2026-10-04). K1/K6-dakı test cüzdan provayderinin şəbəkə tərəfindən işlədilməsi [[ADR-0042]] ilə dəyişdi (2026-10-06):
sandbox-da cüzdan provayderini rəqəmsal cüzdanın özü işlədir.
