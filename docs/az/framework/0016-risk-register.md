---
document_id: FW-RISK-0001
title: "Risk reyestri"
status: Active
version: 1.0.0
created: 2026-11-16
last_updated: 2026-11-16
summary: >
  Tamga Network-ün risk reyestri: Aİ-nin rəqəmsal cüzdanlar üçün ortaq risk reyestrinin (İcra Reqlamenti (Aİ) 2024/2981
  Əlavə I; Aİ ARF Əlavə 6) 14 yüksək səviyyəli riski, 3 sistem riski, 5 texniki təhdid ailəsi və 133 təhdid ssenarisi üçün
  Tamga-da kimin məsul olduğunu, hansı tədbirin olduğunu və statusunu göstərir. Özünüqiymətləndirmədir; müstəqil audit və ya
  sertifikat deyil.
translation_of: FW-RISK-0001
source_version: "1.0.0"
---

Bu sənəd Aİ-nin rəqəmsal cüzdan risk reyestrindəki hər risk və təhdid üçün Tamga-nın tədbirini və statusunu göstərir;
tənzimləyicilər, dövlətlər, auditorlar və iştirakçılar üçündür.

> **Özünüqiymətləndirmə.** Bu reyestr Tamga-nın öz qiymətləndirməsidir; müstəqil audit, uyğunluq qiymətləndirməsi və ya
> sertifikat deyil. "Qarşılanıb" yalnız məcburi qaydası və istinad tətbiqində qarşılığı olan tədbirlər üçün yazılıb.

**Nə vaxt oxunur.** Əvvəlcə əsas sənədin təhlükəsizlik bölməsi ([[FW-ARF-0001]] §7) və Trust Framework-ün riskə yanaşması
([[FW-TF-0001]] §1.5). Tədbirlərin qaydaları Tamga Rulebook-da ([[FW-RB-0001]]) və istinad edilən spesifikasiya və qərarlardadır.

# 1. Mənbə və metod

Aİ hər arxitekturada nəzərə alınmalı olan riskləri ortaq risk reyestrində toplayır: İcra Reqlamenti (Aİ) 2024/2981 Əlavə I
(Aİ ARF-də Əlavə 6). Reyestr dörd bölmədən ibarətdir: yüksək səviyyəli risklər (R1–R14), sistem riskləri (SR1–SR3), texniki
təhdidlər (TT1–TT5 və alt başlıqları) və birbaşa təhdid ssenariləri (TR1–TR133). Bu sənəd eyni skeleti izləyir; kodlar
reqlamentdəki kimidir, mətn tərcümədir.

Tamga Network rəqəmsal cüzdan idarə etmir ([[ADR-0042]]); rəqəmsal cüzdan tərəfindəki sətirlərdə tədbir Tamga Rulebook-un
siyahıdakı [[t:wallet-provider|cüzdan provayderlərinə]] qoyduğu qaydalar (RB-WP) və açıq mənbəli Tamga cüzdan nüvəsidir.

| Sütun | Mənası |
|---|---|
| Kim | Tədbirə məsul rol: operator (şəbəkənin müvəqqəti operatoru), şəxsiyyət xidməti (Tamga-nın müvəqqəti şəxsiyyət sənədi xidməti; PID deyil), sənədi verən, yoxlayan tərəf, cüzdan provayderi |
| Tamga-dakı tədbir | Qısa izah və qaydanın mənbəyi (`DOC-ID/KOD` və ya Tamga Rulebook qayda kodu) |
| Status | **Qarşılanıb**: məcburi qayda və istinad tətbiqində qarşılığı var · **Qismən**: tədbir var, lakin natamamdır, telefonda yoxlanılmayıb və ya sertifikatı yoxdur · **Açıq**: tədbir yoxdur · **Tətbiq edilmir**: təhdidin əsaslandığı funksiya Tamga-da yoxdur |

PID ilə bağlı təhdidlər Tamga-nın müvəqqəti şəxsiyyət sənədinə tətbiq edilərək oxunub (Tamga PID vermir —
[[SPEC-TRUST-0001]]/TL8).

# 2. Say

| Bölmə | Qarşılanıb | Qismən | Açıq | Tətbiq edilmir |
|---|---:|---:|---:|---:|
| Yüksək səviyyəli risklər (14) | 0 | 14 | 0 | 0 |
| Sistem riskləri (3) | 0 | 3 | 0 | 0 |
| Texniki təhdid alt başlıqları (18) | 2 | 16 | 0 | 0 |
| Təhdid ssenariləri (133) | 32 | 89 | 3 | 9 |

Heç bir yüksək səviyyəli risk tam qarşılanmış sayılmayıb: hər birində ən azı bir ssenari qismən və ya açıqdır. Açıq ssenarilər:
TR49, TR63, TR132 (rəqəmsal cüzdan jurnalının bütövlüyü və cihaz nasazlığında jurnalın itməsi). Tətbiq edilmir: TR7, TR11, TR45, TR48, TR54, TR64, TR97, TR100, TR101 (Tamga-da olmayan
yollar: kvalifikasiyalı sertifikat və eID ilə şəxsiyyət yoxlaması, elektron imza, kvalifikasiyalı etibar xidməti, ehtiyat
nüsxə, istifadəçi hesabı).

# 3. Yüksək səviyyəli risklər

| Kod | Risk | Tamga-dakı əsas tədbirlər | Status |
|---|---|---|---|
| R1 | Mövcud elektron şəxsiyyətin yaradılması və ya istifadəsi | Şəxsiyyət sənədi yalnız lisenziyalı uzaqdan şəxsiyyət yoxlamasından və axını başladan rəqəmsal cüzdanda şəxsin son təsdiqindən sonra verilir; nüsxələr rəqəmsal cüzdanın sübut etdiyi açarlara bağlanır. Müstəqil audit yoxdur. | Qismən |
| R2 | Saxta elektron şəxsiyyətin yaradılması və ya istifadəsi | Tamga PID vermir; şəxsiyyət xidməti etibar siyahısında sənəd növü icazəsi ilə qeydiyyatdadır; icazəsiz növ yoxlamada rədd edilir. Siyahı imzası bu gün yeganə operatordadır. | Qismən |
| R3 | Saxta atributların yaradılması və ya istifadəsi | Hər sənəd imzalıdır, imzalayan etibar siyahısındadır, növ icazəsi keçilə bilməz; holder binding məcburidir. Qurum daxilində saxtakarlıq qurumun öz nəzarətindədir. | Qismən |
| R4 | Şəxsiyyət oğurluğu | Açarlar cihazın təhlükəsiz zonasında, hər təqdimat istifadəçi yoxlaması ilə; telefonsuz vahid ləğvi. Sertifikatlaşdırılmış təhlükəsiz aparat (W3) yoxdur. | Qismən |
| R5 | Məlumat oğurluğu | Ortaq qeydlərdə fərdi məlumat yoxdur; cavablar şifrəlidir; jurnal cihazda qalır və yalnız şəxsin şifrəli ixracı ilə çıxır; rəqəmsal cüzdanın ehtiyat nüsxəsi yoxdur. | Qismən |
| R6 | Məlumatların ifşası | Seçici açıqlama, sahə-sahə razılıq, əhatə yoxlaması, məcburi qeydiyyat sertifikatı; eyni sənədi verənin sənədləri birləşdirilsə uyğunlaşdırma riski qalır (FW-ARF-0001 §7.4 L3). | Qismən |
| R7 | Məlumatların dəyişdirilməsi | Sənədlər imzalıdır; qəbul qərarı yoxlayan tərəfin öz yoxlama xəttindədir. Rəqəmsal cüzdan jurnalının bütövlük qoruması yoxdur. | Qismən |
| R8 | Məlumat itkisi | Rəqəmsal cüzdanın ehtiyat nüsxəsi şüurlu olaraq yoxdur; cihaz dəyişəndə sənədlər yenidən alınır, jurnal yalnız köçürmə faylı ilə köçürülür. | Qismən |
| R9 | İcazəsiz əməliyyat | İmzalı sorğu, qeydiyyat sertifikatı, birdəfəlik nonce, hər təqdimatda istifadəçi yoxlaması; fişinq tam istisna edilə bilməz. | Qismən |
| R10 | Əməliyyatın dəyişdirilməsi | Sorğu, cavab və sənəd imzalı və şifrəlidir; açıq qalan: çox sənədli təqdimatda sənədlərin eyni şəxsə aid olduğunun sübutu (TR86). | Qismən |
| R11 | İnkar | KB-JWT və cihaz imzası təqdimatın sübutudur; yoxlayan tərəfin audit qeydi rədd hallarında da saxlanılır. Cihaz sıradan çıxanda jurnal itir. | Qismən |
| R12 | Əməliyyat məlumatlarının ifşası | Təqdimat jurnalı cihazda qalır; yoxlayan tərəfin nəticəsi və jurnalları sahə dəyəri və ləğv siyahısı mövqeyi daşımır; IP ünvanı jurnala yazılmır. | Qismən |
| R13 | Xidmətin pozulması | Köhnəlmiş və ya əlçatmaz etibar mənbəyi "yoxlanıla bilmədi" verir, heç vaxt qəbul deyil; ləğv siyahıları statikdir və toplu yüklənir; yük və kəsinti testləri aparılmayıb. | Qismən |
| R14 | Müşahidə | Qlobal identifikator yoxdur; hər yoxlayan tərəfə ayrı nüsxə, hər sayta ayrı təxəllüs, sıfır bilik sübutu; ləğv siyahıları sabit intervalla və toplu. | Qismən |

# 4. Sistem riskləri

Reqlamentə görə bu risklər bir neçə təhdidin sistem səviyyəsindəki nəticəsidir; təhdid ssenarilərinə bağlanmır.

| Kod | Risk | Tamga-dakı əsas tədbirlər | Status |
|---|---|---|---|
| SR1 | Kütləvi müşahidə | Heç bir mərkəzi xidmət əməliyyatları görmür: siyahılar və ləğv siyahıları toplu yüklənir, təqdimat jurnalı cihazdadır, ortaq qeydlərdə fərdi məlumat yoxdur. Bir neçə yoxlayan tərəfin birləşməsinə qarşı sıfır bilik sübutu yalnız şəxsiyyət sənədindədir. | Qismən |
| SR2 | Nüfuz itkisi | İnsident bildiriş müddətləri, açıq dəyişiklik jurnalı və rüblük şəffaflıq hesabatı; müstəqil audit və sertifikat yoxdur. | Qismən |
| SR3 | Hüquqi uyğunsuzluq | Şəbəkə Aİ hüququna bağlı deyil, Aİ modelini izləyir; fərdi məlumat qaydaları dəyişməz qaydalarla qorunur; çərçivənin hüquqi baxışı pilotdan əvvəl aparılacaq. | Qismən |

# 5. Texniki təhdidlər

Texniki təhdidlər bir riskə bağlı deyil; bir çox hücumun vasitəsidir.

| Kod | Təhdid | Tamga-dakı tədbir | Status |
|---|---|---|---|
| TT1 1.1 | Oğurluq | Hər təqdimatda istifadəçi yoxlaması; telefonsuz vahid ləğvi (RB-WP-15). | Qismən |
| TT1 1.2 | Məlumat sızması | Məlumat cihazda; platformanın şifrəli yaddaşı; dəyər jurnala yazılmır (RB-GEN-06). | Qismən |
| TT1 1.3 | Müdaxilə | Cihaz sübutu və versiya üzrə cüzdan sübutlarının ləğvi (RB-WP-11, RB-WP-17). | Qismən |
| TT2 2.1 | İT sisteminin idarəsində səhvlər | Buraxılışdan əvvəl məcburi testlər (RB-ENF-01), kənarlaşma qeydi (RB-ENF-04); istismar siyasətləri. | Qismən |
| TT2 2.2 | Tətbiq və ya istifadə səhvləri | "Etibarsız" və "yoxlanıla bilmədi" ayrı göstərilir (RB-WP-12); üçqiymətli nəticə (RB-RP-05). | Qismən |
| TT2 2.3 | İnkişaf səhvləri və yanlış konfiqurasiya | Açıq uyğunluq vektorları, təhlükəsiz standart dəyərlər ([[ADR-0056]]), açıq mənbə; müstəqil kod auditi yoxdur. | Qismən |
| TT3 3.1 | Cüzdan komponentlərinin səhv istifadəsi və ya konfiqurasiyası | Paketlərdə buraxılış mənbəyi sübutu (RB-GEN-07); naməlum siyahı formatında dayanma (RB-GEN-04). | Qismən |
| TT4 4.1 | Avadanlıq, cihaz və ya sistem nasazlığı | Köhnəlmiş mənbədə "yoxlanıla bilmədi" (RB-GEN-03); cihaz nasazlığında sənədlər yenidən alınır (RB-H-04). | Qismən |
| TT4 4.2 | Resurs itkisi | Siyahıların və ləğv siyahılarının statik dərci; yeganə operator (FW-ARF-0001 §7.4 L1). | Qismən |
| TT4 4.3 | Dəstək xidmətlərinin itkisi | Yoxlayan tərəflər siyahıları əvvəlcədən toplu yükləyir (RB-RP-06); yaxın məsafədə internetsiz təqdimat. | Qismən |
| TT5 5.1 | Məlumatın ələ keçirilməsi | TLS, şifrəli cavab ([[SPEC-PROTO-0002]]/PV3), yaxın məsafədə sessiya şifrələnməsi. | Qarşılanıb |
| TT5 5.2 | Fişinq və saxtakarlıq | Məcburi qeydiyyat sertifikatı (RB-WP-19), qeydiyyatdakı adın göstərilməsi (RB-WP-13), keçid ötürülməsinə qarşı son təsdiq ([[ADR-0080]]/VL1). | Qismən |
| TT5 5.3 | Mesajların təkrar oxudulması | Birdəfəlik nonce ([[SPEC-PROTO-0002]]/PV10), KB-JWT `iat` pəncərəsi ([[SPEC-CRED-0002]]/C17), birdəfəlik `c_nonce` ([[SPEC-PROTO-0001]]/PR4). | Qarşılanıb |
| TT5 5.4 | Kobud güc hücumu | Əməliyyat kodunda üç cəhd həddi ([[SPEC-PROTO-0001]]/PR12), salt ≥ 128 bit ([[SPEC-CRED-0002]]/C3); xidmətlərdə sorğu həddi. | Qismən |
| TT5 5.5 | Proqram zəiflikləri | Açıq mənbə, məsuliyyətli bildiriş yolu, versiya üzrə ləğv (RB-WP-11); müstəqil audit yoxdur. | Qismən |
| TT5 5.6 | Təchizat zənciri hücumları | Paketlərdə buraxılış mənbəyi sübutu (RB-GEN-07); asılılıqların yoxlanması. | Qismən |
| TT5 5.7 | Zərərli proqram | Açarlar təhlükəsiz zonada ([[SPEC-WALLET-0001]]/WL1); cihaz sübutu. | Qismən |
| TT5 5.8 | Təsadüfi ədədin proqnozlaşdırılması | Platformanın kriptoqrafik generatoru; ləğv mövqeyi təsadüfi ([[SPEC-CRED-0003]]/S7). | Qismən |

# 6. Təhdid ssenariləri

"Əlaqəli risk" sütunu reqlamentdəki uyğunlaşdırmadır; TR106–TR133 orada "müxtəlif risklərə təsir" kimi qeyd edilib.

| Kod | Təhdid ssenarisi | Əlaqəli risk | Kim | Tamga-dakı tədbir | Status |
|---|---|---|---|---|---|
| TR1 | Təxəllüsləri əsassız ləğv etmək. | R2 | Şəxsiyyət xidməti, Cüzdan provayderi | Sayt təxəllüsü cihazda toxumdan törədilir, mərkəzi təxəllüs ləğv siyahısı yoxdur; toxum şəxsiyyət xidmətində saxlanılmır ([[ADR-0031]]/PS2). | Qarşılanıb |
| TR2 | Mövcud olmayan, uydurma elektron şəxsiyyətlər vermək. | R2 | Şəxsiyyət xidməti | Şəxsiyyət sənədi növün səviyyəsi təmin edilmədən verilmir ([[SPEC-ID-0003]]/IDP2, RB-AP-11); müstəqil audit yoxdur. | Qismən |
| TR3 | İcazəsiz PID verməyə başlamaq. | R2 | Operator | Tamga PID vermir ([[SPEC-TRUST-0001]]/TL8); növ icazəsi icazə siyahısı ilədir, standart olaraq bağlıdır (RB-REG-04) və yoxlamada keçilə bilməz ([[SPEC-API-0001]]/AP8). | Qarşılanıb |
| TR4 | İdarəçiyə səhv provayderi etibar siyahısına daxil etdirmək. | R2 | Operator | Siyahıya giriş qoşulma baxışı ilədir ([[FW-ONB-0001]]); hər dəyişiklik açıq dəyişiklik jurnalındadır (RB-OP-07). Siyahı imzası yeganə operatordadır, açar mərasimi və aparat təhlükəsizlik modulu gözlənilir (FW-ARF-0001 §7.4 L1). | Qismən |
| TR5 | Uzaqdan şəxsiyyət yoxlaması xidmətini yan keçmək. | R1 / R2 | Şəxsiyyət xidməti | Lisenziyalı provayderlə sənəd, canlılıq və üz yoxlaması; provayderin qərarı imzalı bildiriş və qərar sorğusu ilə təsdiqlənir ([[SPEC-ID-0003]]/IDP5); keçid ötürülməsinə qarşı son təsdiq ([[ADR-0080]]/VL1–VL3). | Qismən |
| TR6 | Üzbəüz şəxsiyyət yoxlaması xidmətini yan keçmək. | R1 / R2 | Şəxsiyyət xidməti | Üzbəüz yol şəxsiyyət qaydalar kitabında T2 səviyyəsi kimi müəyyən edilib ([[FW-RB-0003]]); üzbəüz yoxlamanın qaydası ayrıca yazılmayıb. | Qismən |
| TR7 | Uzaqdan (kvalifikasiyalı) sertifikata əsaslanan şəxsiyyət yoxlamasını yan keçmək. | R1 / R2 | Şəxsiyyət xidməti | Bu yol təqdim edilmir; kvalifikasiyalı imzaya əsaslanan T3 səviyyəsi bu gün verilmir ([[SPEC-ID-0003]]/IDP7). | Tətbiq edilmir |
| TR8 | Şəxsə bağlı olmayan rəqəmsal cüzdana giriş əldə etmək. | R1 / R2 | Cüzdan provayderi | Hər təqdimat istifadəçi yoxlaması tələb edir ([[SPEC-WALLET-0001]]/WL11, RB-WP-03); sənədlər şəxsin şəxsiyyət yoxlamasından sonra verilir. Rəqəmsal cüzdanın şəxsə bağlanması cihazın istifadəçi yoxlamasına əsaslanır. | Qismən |
| TR9 | Texniki və prosedur nəzarəti aşıb səhv PID yaratmaq. | R1 / R2 | Şəxsiyyət xidməti | Uyğunlaşdırma cədvəlində qarşılığı olmayan dəyərdə sənəd verilməsi dayanır (RB-AP-13); sənədi verənin audit qeydi; müstəqil audit yoxdur. | Qismən |
| TR10 | Etibarsız WSCD üzərində yeni rəqəmsal cüzdan aktivləşdirmək. | R1 / R2 | Cüzdan provayderi | Proqram açarlı rəqəmsal cüzdan dəstəklənmir ([[SPEC-WALLET-0001]]/WL3); açar attestasiyası yaddaş səviyyəsini düzgün bildirir ([[ADR-0025]]/WIA3); W3 bəyanı cihaz sübutu tələb edir (RB-WP-17). Sertifikatlaşdırılmış WSCD yoxdur. | Qismən |
| TR11 | Mövcud eID vasitələrinə əsaslanan şəxsiyyət yoxlamasını yan keçmək. | R1 / R2 | Şəxsiyyət xidməti | eID vasitəsi ilə şəxsiyyət yoxlaması yolu yoxdur; şəxsiyyət sənədinin çipinin oxunması bağlıdır ([[ADR-0083]]/CV7). | Tətbiq edilmir |
| TR12 | Rəqəmsal cüzdanın şəxsin nəzarətində olması yoxlamasını yan keçib ələ keçirilmiş rəqəmsal cüzdana sənəd aldırmaq. | R1 / R4 / R9 | Şəxsiyyət xidməti, Cüzdan provayderi | Sənəd verilməzdən əvvəl WIA və açar attestasiyası yoxlanılır (RB-AP-10, [[SPEC-PROTO-0001]]/PR11, PR19); şəxs axını başladan rəqəmsal cüzdanda maskalanmış xülasəni təsdiq edir ([[ADR-0080]]/VL1). W2-də cihaz sübutu könüllüdür. | Qismən |
| TR13 | Etibarlı PID-i etibarsız cüzdan vahidinə almaq. | R1 / R4 / R9 | Şəxsiyyət xidməti, Cüzdan provayderi | WIA-nın ömrü 24 saatdan azdır və hər əməliyyatda yenidir ([[ADR-0025]]/WIA1); ləğv edilmiş WIA və ya açar attestasiyası ilə sənəd verilmir ([[ADR-0025]]/WIA4, [[SPEC-PROTO-0001]]/PR19). | Qarşılanıb |
| TR14 | PID provayderinin mövcud şəxslə bağlı uydurma şəxsiyyətlər verməsi. | R1 / R4 / R9 | Şəxsiyyət xidməti | Şəxsiyyət məlumatları provayderin təsdiqlənmiş qərarından gəlir ([[SPEC-ID-0003]]/IDP5); şəxsə "sənədiniz rəqəmsal cüzdana əlavə edildi" bildirişi (RB-AP-15). Daxili sui-istifadəyə qarşı müstəqil audit yoxdur; şəbəkə yeganə operatora əsaslanır (RB-GEN-10). | Qismən |
| TR15 | PID provayderi PID-i düzgün rəqəmsal cüzdana bağlaya bilmədiyi üçün PID-i səhv rəqəmsal cüzdana bağlamaq. | R1 / R4 / R9 | Şəxsiyyət xidməti | Hər nüsxə rəqəmsal cüzdanın sahibliyini sübut etdiyi ayrı açara bağlanır ([[SPEC-PROTO-0001]]/PR6); son təsdiq yalnız axını başladan rəqəmsal cüzdana, onun açarına bağlı gedir ([[ADR-0080]]/VL2). | Qarşılanıb |
| TR16 | Şəxsə təcavüzkarın nəzarətindəki yeni vahidin aktivləşdirilməsini təsdiq etdirmək. | R1 / R2 / R4 / R9 | Cüzdan provayderi | Yoxlama başlamazdan əvvəl xəbərdarlıq: bu yoxlama hansı rəqəmsal cüzdan üçündür ([[ADR-0080]]/VL3); "sənədiniz rəqəmsal cüzdana əlavə edildi" bildirişi və etiraz (RB-AP-15, RB-H-05); telefonsuz vahid ləğvi ([[ADR-0047]]/WR3). | Qismən |
| TR17 | Hədəf vətəndaşların məlumatlarına daxil olmaq üçün başqa dövlətin PID-ini vermək. | R1 / R4 / R9 | Operator | Qurum yalnız öz dövlətinin kök sertifikatına bağlanır ([[SPEC-ID-0002]]/XC1, RB-REG-03); milli siyahını həmin dövlətin açarı imzalayır ([[SPEC-TRUST-0001]]/TL7) — bu gün bütün siyahıları müvəqqəti operator imzalayır; tanınma yoxlaması yoxlayan tərəfdədir (RB-RP-03). | Qismən |
| TR18 | Texniki və prosedur nəzarəti aşıb saxta (Q)EAA yaratmaq. | R3 | Sənədi verən | İmza açarı qurumdadır ([[ADR-0057]]/RS1, RB-AP-02); məlumatlar imza anında səlahiyyətli mənbədən oxunur ([[ADR-0020]]/AS1); qarşılığı olmayan qeyd üçün sənəd verilmir (RB-AS-02). Qurumun daxili nəzarəti qurumdadır. | Qismən |
| TR19 | Özünə etibarlı şəkildə verilməmiş (Q)EAA-ları təqdim etmək. | R3 | Yoxlayan tərəf | KB-JWT istisnasız məcburidir ([[SPEC-CRED-0002]]/C8), `cnf` olmayan sənəd rədd edilir (C16); mdoc-da cihaz imzası sessiyaya bağlıdır ([[SPEC-PROTO-0002]]/PV11); açar təhlükəsiz zonadan çıxmır ([[SPEC-WALLET-0001]]/WL1). | Qarşılanıb |
| TR20 | Rəqəmsal cüzdanın PID ilə ona verilməməli olan (Q)EAA arasındakı kriptoqrafik bağlama mexanizminə hücum etmək. | R3 | Sənədi verən, Yoxlayan tərəf | Qurum sənədi şəxsiyyətə bağlı təkliflə ([[ADR-0020]]/AS2) və ya şəxsiyyət sənədinin təqdimatı ilə ([[SPEC-PROTO-0001]]/PR14) verilir; lakin verilən sənəd şəxsiyyət sənədinin açarına kriptoqrafik olaraq bağlanmır (hər nüsxə öz açarındadır, PR6). Bir təqdimatdakı sənədlərin eyni rəqəmsal cüzdandan gəlməsi yoxlayan tərəfin eyni cavab yoxlamasına əsaslanır (bax TR86). | Qismən |
| TR21 | Fiziki qarşılığının müddəti bitmiş və ya etibarsız olan (Q)EAA-nı rəqəmsal cüzdanda istifadə etmək. | R3 | Sənədi verən | Sənəddə `exp`, qurumun ləğv siyahısı ([[SPEC-CRED-0003]]); yeniləmədə məlumatlar səlahiyyətli mənbədən yenidən oxunur ([[ADR-0023]]/AR3); ləğv şərtləri siyasətdədir ([[FW-POL-0001]]). Mənbədəki dəyişikliyin ləğvə çevrilməsi qurumun iş qaydasından asılıdır. | Qismən |
| TR22 | (Q)EAA provayderinin rəqəmsal cüzdanın şəxsin nəzarətində olması yoxlamasını yan keçib ələ keçirilmiş rəqəmsal cüzdana (Q)EAA aldırmaq. | R3 | Sənədi verən, Cüzdan provayderi | Sənədi verən sənəd verməzdən əvvəl WIA və açar attestasiyasını yoxlayır (RB-AP-10, [[SPEC-PROTO-0001]]/PR19); W2-də cihaz sübutu könüllüdür. | Qismən |
| TR23 | Elektron atribut attestasiyalarını saxtalaşdırmaq. | R3 | Yoxlayan tərəf | Yalnız ES256 imza ([[SPEC-CRED-0002]]/C1), zəncir etibar siyahısındakı kökə bağlanır, qurum `iat` anında qəbul edilə bilən olmalıdır və növ icazəsi keçilə bilməz ([[SPEC-API-0001]]/AP8). | Qarşılanıb |
| TR24 | Saxta atribut attestasiyalarını rəqəmsal cüzdana yeritmək. | R3 | Cüzdan provayderi | Tamga cüzdan nüvəsi sənədi alarkən imzanı, qurumun siyahıda olmasını və növ xülasəsini yoxlayır (RB-GEN-02); saxta sənəd yoxlayan tərəfdə yenə rədd edilir. Digər rəqəmsal cüzdanların qəbul yoxlaması öz provayderlərinin işidir. | Qismən |
| TR25 | Rəqəmsal cüzdanın atributları şəxsin təsdiqi olmadan yoxlayan tərəfə təqdim edə bilməsi. | R6 | Cüzdan provayderi | Hər təqdimat istifadəçi yoxlaması və sahə-sahə razılıq tələb edir ([[SPEC-WALLET-0001]]/WL11, RB-WP-03, RB-H-02); cihaz üzərində yoxlama davam edir. | Qismən |
| TR26 | PID, (Q)EAA və ya təxəllüslərin səhv yoxlayan tərəfə təqdim edilməsi. | R6 | Yoxlayan tərəf, Cüzdan provayderi | Müştəri identifikatoru giriş sertifikatından ([[ADR-0034]]/CI1, CI2); qeydiyyat sertifikatı olmayan sorğu rədd edilir ([[ADR-0056]]/MR5); KB-JWT `aud` müştəri identifikatorunun tamamıdır ([[SPEC-PROTO-0002]]/PV7); təxəllüs hər sayt üçün ayrıdır ([[ADR-0031]]/PS1). | Qarşılanıb |
| TR27 | EAA-nın zərərli yenilənməsini başlatmaq. | R6 | Sənədi verən | Yeniləmə tokeni ilk verilişdəki müştəri nümunəsi açarına bağlıdır ([[ADR-0060]]/RT1), DPoP məcburidir (RT2), birdəfəlikdir ([[SPEC-PROTO-0001]]/PR18); səssiz yeniləmə yalnız müəyyən şərtlərdə ([[SPEC-WALLET-0001]]/WL7). | Qarşılanıb |
| TR28 | Şəxsə atribut sorğusunu səhvən təsdiq etdirmək (fişinq və ya başqa yolla). | R6 | Cüzdan provayderi | Sahə-sahə razılıq, artıq tələbdə ayrıca xəbərdarlıq ([[SPEC-WALLET-0001]]/WL8, RB-WP-04), yoxlayan tərəfin qeydiyyatdakı adı (RB-WP-13), paylaşma qaydası xəbərdarlığı ([[ADR-0046]]/EP3). Fişinq tam istisna edilə bilməz. | Qismən |
| TR29 | Şəxsiyyətin tələb olunmadığı və ya icazə verilmədiyi yerdə rəqəmsal cüzdandan atribut sızdırıb şəxsi müəyyən etmək. | R6 | Cüzdan provayderi, Yoxlayan tərəf | Seçici açıqlama, yaş sahələri ([[ADR-0064]]/YE2), hər sayt üçün təxəllüs (RB-RP-13), sıfır bilik sübutu ([[ADR-0032]]), əhatə yoxlaması ([[SPEC-API-0001]]/AP6). Qalıq risk FW-ARF-0001 §7.4 L3. | Qismən |
| TR30 | Texniki və prosedur nəzarəti aşıb məlumat çıxarmaq. | R6 | Operator, Cüzdan provayderi | Ortaq qeydlərdə fərdi məlumat yoxdur (RB-GEN-01, [[SPEC-TRUST-0001]]/TL11); jurnallarda dəyər yoxdur (RB-GEN-06); rəqəmsal cüzdanda məlumat cihazdadır. Müstəqil nüfuz testi yoxdur. | Qismən |
| TR31 | Sorğunun təcavüzkara sızması. | R6 | Yoxlayan tərəf | Sorğu imzalıdır; `request_uri`-nin hər yüklənməsi təzə `state`, `nonce` və şifrələmə açarı ilə ayrıca qoldur ([[ADR-0067]]/RQ1); cavab şifrəlidir ([[SPEC-PROTO-0002]]/PV3). Tələb olunan sahə adları sorğu obyektini yükləyən hər kəsə görünür. | Qismən |
| TR32 | Daxil edilmiş açıqlama siyasətini öyrənib cari sorğudakı atributları cüzdan vahidləri adından təqdim etmək. | R6 | Sənədi verən, Cüzdan provayderi | Siyasət imzalı metaməlumatda açıqdır (şüurlu olaraq; [[ADR-0046]]/EP1); siyasət şəxsin razılığını aradan qaldırmır, təqdimatı rəqəmsal cüzdan şəxsin təsdiqi ilə edir (EP3, [[SPEC-WALLET-0001]]/WL11). | Qismən |
| TR33 | Jurnalları və ya onların bir hissəsini çıxarmaq. | R6 | Cüzdan provayderi | Jurnal cihazda qalır; yalnız şəxsin başlatdığı, parolla şifrələnmiş ixracda çıxır ([[SPEC-WALLET-0001]]/WL4, [[ADR-0027]]/LX1, LX2). Cihaz səviyyəsindəki qoruma platformaya əsaslanır. | Qismən |
| TR34 | Rəqəmsal cüzdanın eyni və ya başqa cihazda quraşdırıldığını öyrənib onun haqqında məlumat əldə etmək. | R6 | Cüzdan provayderi | WIA-nın `sub`-u eyni cüzdan həllinin bütün nümunələrində ortaqdır ([[ADR-0034]]/CI6); rəqəmsal cüzdanı ifşa edən son nöqtə yoxdur. Əməliyyat sistemi səviyyəsində tətbiqin aşkarlanması platformanın sahəsidir. | Qismən |
| TR35 | WSCA-ya istifadəçi autentifikasiyasında istifadə edilən bilik faktorunu əldə etmək. | R6 | Cüzdan provayderi | İstifadəçi yoxlaması cihazın biometriyası və ya parolu ilədir ([[SPEC-WALLET-0001]]/WL11); cəhd həddi platformadadır; sertifikatlaşdırılmış WSCA yoxdur. | Qismən |
| TR36 | Şəxsə aid atribut attestasiyasının eyni yoxlayan tərəflə və ya fərqli yoxlayan tərəflərlə bir neçə əməliyyatda təqdim edilməsinin əməliyyatları istəmədən həmin şəxsə bağlaması. | R6 | Cüzdan provayderi, Sənədi verən | Toplu verilən 10 nüsxə (RB-AP-09), hər yoxlayan tərəfə ayrı nüsxə ([[SPEC-WALLET-0001]]/WL5, RB-WP-05), hər sayt üçün təxəllüs ([[ADR-0031]]/PS1), şəxsiyyət sənədində sıfır bilik sübutu ([[ADR-0032]]). Eyni yoxlayan tərəfə eyni nüsxə şüurludur; qalıq risk FW-ARF-0001 §7.4 L3. | Qismən |
| TR37 | Açıq sənəd və ya yoxlayan tərəf ləğv siyahısının şəxsin sənədindən istifadəsi barədə məlumat (məkan, IP ünvanı …) daşıması. | R6 | Sənədi verən, Operator | Ləğv siyahıları sabit intervalla dərc edilir ([[SPEC-CRED-0003]]/S5), yoxlayan tərəf toplu əvvəlcədən yükləyir (S12), mövqe təsadüfidir (S7); IP ünvanı jurnala yazılmır (RB-GEN-05). | Qarşılanıb |
| TR38 | Paylaşılan atributlar üçün şəxsin razılığı sübut edilə bilmirsə yoxlayan tərəflərin jurnalların bütövlüyünə təsir edə bilməsi. | R6 | Yoxlayan tərəf, Cüzdan provayderi | Təqdimat KB-JWT və ya cihaz imzası ilə şəxsin açarına bağlıdır; yoxlayan tərəfin audit qeydi rədd hallarında da saxlanılır ([[SPEC-API-0001]]/AP9). Rəqəmsal cüzdan jurnalının bütövlük qoruması yoxdur. | Qismən |
| TR39 | Unikal və ya izlənilə bilən identifikatorlarla şəxsləri qanunsuz izləmək. | R6 / R14 | Cüzdan provayderi, Yoxlayan tərəf | Qlobal identifikator yoxdur ([[SPEC-ID-0002]]/XC4, RB-H-06); hər sayt üçün təxəllüs ([[ADR-0031]]/PS1); giriş siyasətləri şəxsiyyət nömrəsi tələb etmir (PS4); WIA `sub` ortaqdır ([[ADR-0034]]/CI6). Şəxsiyyət nömrəsi açıqlanarsa şəxs izlənilə bilər. | Qismən |
| TR40 | Hər biri fərqli əhatəyə malik bir neçə vahiddən ibarət yoxlayan tərəfin hüquqi əsası olmayan məlumatları tələb etməsi və emal etməsi. | R6 / R9 | Yoxlayan tərəf, Operator | Qeydiyyat əhatə ilədir (RB-REG-08), hər istifadənin bir qeydiyyat sertifikatı (RB-RP-14), əhatə yoxlaması ([[SPEC-API-0001]]/AP6), vasitəçi əlaqəsi hər iki qeyddə ([[SPEC-PROTO-0002]]/PV14). Hər yoxlayan tərəfə bir giriş sertifikatı; Aİ-dəki yoxlayan tərəf nümunəsi (RP Instance) bölgüsü yoxdur. | Qismən |
| TR41 | Rəqəmsal cüzdanın PID bütövlük və həqiqilik yoxlamalarını həmişə uğur qaytaracaq şəkildə pozmaq. | R7 | Cüzdan provayderi, Yoxlayan tərəf | Qəbul qərarı rəqəmsal cüzdanda deyil, yoxlayan tərəfin öz yoxlama xəttindədir (RB-RP-03); rəqəmsal cüzdandakı yoxlamanın pozulması saxta sənədi qəbul etdirmir. | Qarşılanıb |
| TR42 | Rəqəmsal cüzdanın tələb olunan atributların bütövlük və həqiqilik yoxlamalarını yan keçmək və ya pozmaq. | R7 | Cüzdan provayderi, Yoxlayan tərəf | Yoxlayan tərəf imzanı, xülasələri və `sd_hash`-i özü yoxlayır (RB-RP-03, [[SPEC-CRED-0002]]/C9, C10). | Qarşılanıb |
| TR43 | Rəqəmsal cüzdanın tələb olunan bütün atributların eyni şəxsə aid olması yoxlamasını yan keçmək və ya pozmaq. | R7 | Cüzdan provayderi, Yoxlayan tərəf | Yoxlayan tərəf eyni cavabdakı hər sənədin holder binding-ini eyni `aud` və `nonce`-a görə ayrı-ayrılıqda yoxlayır ([[SPEC-PROTO-0002]]/PV7, PV10, PV11); sənədlərin eyni cüzdan vahidinə aid olduğunu göstərən kriptoqrafik bağ yoxdur (bax TR86). | Qismən |
| TR44 | Rəqəmsal cüzdanın PID-in etibarlı olması və etibarlı provayderdən gəlməsi yoxlamasını yan keçmək və ya pozmaq. | R7 | Cüzdan provayderi, Yoxlayan tərəf | Yoxlayan tərəf qurumun `iat` anında qəbul edilə bilən olmasını və növ icazəsini imzalı siyahıdan özü soruşur (RB-RP-03, [[SPEC-API-0001]]/AP8). | Qarşılanıb |
| TR45 | Rəqəmsal cüzdanın QEAA-nın etibarlı olması və onu verməyə qeydiyyatlı kvalifikasiyalı etibar xidməti provayderindən gəlməsi yoxlamasını yan keçmək və ya pozmaq. | R7 | Yoxlayan tərəf | Şəbəkədə kvalifikasiyalı etibar xidməti provayderi yoxdur; kvalifikasiyalı sinif müstəqil uyğunluq qiymətləndirməsi olmadan yazılmır ([[ADR-0022]]/IDC1). | Tətbiq edilmir |
| TR46 | Rəqəmsal cüzdanın PID-in provayder tərəfindən ləğv edilib-edilmədiyi yoxlamasını yan keçmək və ya pozmaq. | R7 | Cüzdan provayderi, Yoxlayan tərəf | Yoxlayan tərəf ləğv statusunu özü yoxlayır ([[SPEC-CRED-0003]]); ləğv siyahısı tələb edən növdə ləğv girişi olmayan sənəd rədd edilir ([[ADR-0056]]/MR8). | Qarşılanıb |
| TR47 | Rəqəmsal cüzdanın (Q)EAA-nın provayder tərəfindən ləğv edilib-edilmədiyi yoxlamasını yan keçmək və ya pozmaq. | R7 | Cüzdan provayderi, Yoxlayan tərəf | TR46 ilə eyni: yoxlayan tərəf ləğvi özü yoxlayır ([[SPEC-CRED-0003]], [[ADR-0056]]/MR8). | Qarşılanıb |
| TR48 | Yalnız şəxsin nəzarətində olmalı olan ehtiyat və bərpa məlumatlarının məzmununu dəyişdirmək. | R7 / R8 | Cüzdan provayderi | Rəqəmsal cüzdanın ehtiyat nüsxəsi yoxdur ([[SPEC-WALLET-0001]]/WL2, RB-WP-07); köçürmə faylı parolla şifrəlidir, sənəd dəyəri və açar daşımır ([[ADR-0027]]/LX2, [[ADR-0078]]). | Tətbiq edilmir |
| TR49 | Cüzdan nümunəsinin əməliyyat tarixçəsini fəaliyyət jurnallarında dəyişdirmək. | R7 / R8 | Cüzdan provayderi | Jurnal cihazda saxlanılır; jurnalın imza və ya xülasə zənciri kimi bütövlük qoruması yoxdur. | Açıq |
| TR50 | Rəqəmsal cüzdanla yoxlayan tərəf arasındakı əlaqəni dinləmək. | R5 / R6 | Yoxlayan tərəf, Cüzdan provayderi | TLS və şifrəli cavab ([[SPEC-PROTO-0002]]/PV3, RB-RP-02); yaxın məsafədə sessiya şifrələnməsi. | Qarşılanıb |
| TR51 | Şəxsi fərdi məlumatlarını (PID, EAA, təxəllüs, e-imza, jurnal …) təcavüzkarla və ya istəmədiyi üçüncü tərəflə paylaşmağa inandırmaq. | R5 / R6 | Cüzdan provayderi | Məcburi qeydiyyat sertifikatı (RB-WP-19), qeydiyyatdakı ad (RB-WP-13), sahə-sahə razılıq və artıq tələb xəbərdarlığı (RB-WP-04); dayandırılmış və ya qeydiyyatsız yoxlayan tərəfə təqdimat yoxdur. İnandırma tam istisna edilə bilməz. | Qismən |
| TR52 | Cüzdan nümunəsinin əməliyyat tarixçəsini fəaliyyət jurnallarından oxumaq. | R5 / R6 | Cüzdan provayderi | Jurnal cihazdadır və serverə getmir ([[SPEC-WALLET-0001]]/WL4, [[SPEC-PROTO-0002]]/PV8); ixrac şifrəlidir ([[ADR-0027]]/LX1). | Qismən |
| TR53 | Kriptoqrafik açar materialını WSCD-dən kənara çıxarmaq. | R5 / R6 / R9 | Cüzdan provayderi | Açarlar təhlükəsiz zonada yaradılır və oradan çıxmır ([[SPEC-WALLET-0001]]/WL1, RB-WP-01); açar attestasiyası yaddaş səviyyəsini düzgün bildirir ([[ADR-0025]]/WIA3). Sertifikatlaşdırılmış WSCD (W3) yoxdur. | Qismən |
| TR54 | Yalnız şəxsin nəzarətində olmalı olan ehtiyat və bərpa məlumatlarının məzmununu oxumaq. | R5 / R6 | Cüzdan provayderi | Rəqəmsal cüzdanın ehtiyat nüsxəsi yoxdur ([[SPEC-WALLET-0001]]/WL2); köçürmə faylı parolla şifrəlidir ([[ADR-0027]]/LX1). | Tətbiq edilmir |
| TR55 | Cüzdan vahidinin yaratdığı təxəllüsdən istifadə etmək üçün istifadəçi yoxlamasını yan keçmək. | R4 | Cüzdan provayderi | Təxəllüs təqdimatı təxəllüs açarı ilə imzalıdır və ləğv edilməmiş vahid sübutu daşıyır ([[ADR-0031]]/PS5); istifadəçi yoxlaması ([[SPEC-WALLET-0001]]/WL11). | Qismən |
| TR56 | Şəxslərə müəyyən qanuni rəqəmsal cüzdanı təqlid edən tətbiq təklif etmək. | R4 | Cüzdan provayderi, Sənədi verən | Sənədi verən yalnız siyahıdakı provayderin imzaladığı WIA-nı qəbul edir ([[SPEC-PROTO-0001]]/PR11); "Tamga Network-də siyahıda" göstəricisi imzalı siyahıdan gəlir ([[ADR-0049]]/LI1–LI3). Şəxsin təqlid tətbiqi quraşdırmasının qarşısı alına bilməz. | Qismən |
| TR57 | PID, (Q)EAA və ya jurnal daxil olmaqla rəqəmsal cüzdan məlumatlarını ixrac etmək. | R4 | Cüzdan provayderi | İxrac yalnız şəxsin başlatdığı və parolla şifrələnmiş şəkildədir; faylda sənəd dəyəri, nüsxə və açar yoxdur ([[ADR-0027]]/LX1, LX2). | Qismən |
| TR58 | Kriptoqrafik bağlama materialını ixrac etmək. | R4 | Cüzdan provayderi | Açarlar təhlükəsiz zonadan çıxmır ([[SPEC-WALLET-0001]]/WL1); sertifikatlaşdırılmış WSCD yoxdur. | Qismən |
| TR59 | Rəqəmsal cüzdanın kriptoqrafik açarları vasitəsilə şəxsiyyətləri ələ keçirmək. | R4 | Cüzdan provayderi | Açar istifadəsi istifadəçi yoxlamasına bağlıdır ([[SPEC-WALLET-0001]]/WL1, WL11); vahid ləğv edildikdə WIA girişləri ləğv olunur ([[ADR-0025]]/WIA2). | Qismən |
| TR60 | Başqa şəxsin cüzdan vahidini öz cihazına köçürüb istifadə etmək. | R4 / R1 | Cüzdan provayderi | Açarlar cihaza bağlıdır və köçürülmür ([[SPEC-WALLET-0001]]/WL1, WL2); cihaz sübutu W3-də məcburi, W2-də könüllüdür (RB-WP-17). | Qismən |
| TR61 | Başqa dövlətin orqanlarının, məsələn sərhəddə, yaxın məsafədə şəxsdən bütün rəqəmsal cüzdan məlumatlarını göstərməsini və ya paylaşmasını tələb etməsi. | R4 / R14 | Cüzdan provayderi | Hər təqdimatda sahə-sahə razılıq (RB-H-02) və seçici açıqlama; yaxın məsafədə oxuyucu qeydiyyatı və qapı qrupları ([[ADR-0069]]). Hüquqi məcburiyyətə qarşı texniki tədbirlər məhduddur. | Qismən |
| TR62 | Şəxslərin cihaz nasazlığından sonra əməliyyat jurnallarını yeni rəqəmsal cüzdana köçürə bilməməsi. | R11 | Cüzdan provayderi | Jurnal cihaz işləyərkən şəxsin şifrəli köçürmə faylı ilə köçürülür ([[ADR-0078]], [[ADR-0027]]/LX1); nasaz cihazdan köçürmə yolu yoxdur. | Qismən |
| TR63 | Şəxslərin cihaz nasazlığından sonra əməliyyat jurnallarını bərpa edə bilməməsi. | R11 | Cüzdan provayderi | Server tərəfində ehtiyat nüsxə şüurlu olaraq yoxdur ([[SPEC-WALLET-0001]]/WL2, WL4); nasazlıqda jurnal itir. | Açıq |
| TR64 | Yoxlayan tərəflərin uzaqdan elektron imza üçün razılığı sübut etməkdə çətinlik çəkməsi. | R11 | Yoxlayan tərəf | Şəbəkədə bu gün elektron imza funksiyası yoxdur. | Tətbiq edilmir |
| TR65 | Yoxlayan tərəflə əlaqə zamanı əlaqəni sorğularla boğmaq. | R13 | Yoxlayan tərəf | İstinad yoxlayan tərəfdə sorğu həddi; `request_uri` qollarında yaddaş həddi ([[ADR-0067]]/RQ5). Yük testi aparılmayıb. | Qismən |
| TR66 | Status təminatı xidmətini yoxlayan tərəf bağlantıları ilə boğmaq. | R13 | Sənədi verən, Operator | Ləğv siyahıları statik fayl kimi məzmun çatdırma şəbəkəsindən dərc edilir; yoxlayan tərəf hər yoxlamada yükləmir, toplu əvvəlcədən yükləyir ([[SPEC-CRED-0003]]/S12). Yük testi aparılmayıb. | Qismən |
| TR67 | Atribut təqdimatını etibarlı olduğu halda etiraz edilmiş və ya rədd edilmiş kimi göstərmək. | R13 | Yoxlayan tərəf | Nəticə üçqiymətlidir; "yoxlanıla bilmədi" rədd sayılmır ([[SPEC-API-0001]]/AP2, RB-RP-05) və şəxsə ayrıca göstərilir ([[SPEC-CRED-0003]]/S14); nəticə yerinə yetirilən və buraxılan addımları daşıyır. | Qismən |
| TR68 | PID-i əsassız ləğv etmək. | R13 | Şəxsiyyət xidməti | Ləğv şərtləri siyasətdədir ([[FW-POL-0001]]); ləğvi yalnız sənədi verən edir; şəxsin etiraz yolu (RB-H-05). Ləğv açarının qorunması sənədi verəndədir. | Qismən |
| TR69 | PID-i şəxsin razılığı olmadan ləğv etmək. | R13 | Şəxsiyyət xidməti | TR68 ilə eyni; şəxsin istəyi ilə ləğv yolları siyasətdədir ([[FW-POL-0001]]). | Qismən |
| TR70 | (Q)EAA-nı əsassız ləğv etmək. | R13 | Sənədi verən | Ləğv şərtləri ortaq siyasətdədir; qurum yalnız şərt əlavə edə bilər, daralda bilməz ([[ADR-0047]]/WR2); ləğv açarı sənəd açarından ayrıdır ([[SPEC-CRED-0003]]/S11). | Qismən |
| TR71 | (Q)EAA-nı şəxsin razılığı olmadan ləğv etmək. | R13 | Sənədi verən | TR70 ilə eyni ([[FW-POL-0001]]). | Qismən |
| TR72 | Qəsdən yetim sorğular kimi tanınmayan çoxlu şəxsiyyət sorğusu yaratmaq. | R13 | Yoxlayan tərəf, Cüzdan provayderi | Sorğu obyekti müddətlidir ([[SPEC-PROTO-0002]]/PV13), `nonce` birdəfəlikdir (PV10), qollar yaddaşla məhduddur ([[ADR-0067]]/RQ5); rəqəmsal cüzdan qeydiyyat sertifikatı olmayan sorğunu şəxsdən soruşmadan rədd edir (RB-WP-19). | Qismən |
| TR73 | Ardınca əməliyyat gəlməyən çoxlu sorğu göndərmək. | R13 | Yoxlayan tərəf | TR72 ilə eyni; istinad yoxlayan tərəfdə sorğu həddi. | Qismən |
| TR74 | Yoxlayan tərəfə uyğun cavab və tam nəzarət olmadan şəxsiyyət tələb etmək imkanı vermək. | R13 | Yoxlayan tərəf | Hər sorğu imzalıdır və qeydiyyatlı yoxlayan tərəfə bağlıdır ([[SPEC-PROTO-0002]]/PV6, RB-RP-01); cavab yalnız öz qolunu bağlayır ([[ADR-0067]]/RQ2). | Qismən |
| TR75 | Vaxt bitdikdən sonra sorğuya cavab göndərmək və ya oxşar yollarla xidməti pozmaq. | R13 | Yoxlayan tərəf | Sorğu obyekti müddətlidir ([[SPEC-PROTO-0002]]/PV13), `nonce` birdəfəlikdir (PV10); açıla bilməyən cavab təqdimata toxunmur və cəhd sayılmır ([[ADR-0067]]/RQ4). | Qarşılanıb |
| TR76 | Yoxlayan tərəfin çoxlu etibarsız sorğu göndərməsi. | R13 | Yoxlayan tərəf, Cüzdan provayderi | Rəqəmsal cüzdan imzasız və ya qeydiyyat sertifikatı olmayan sorğunu şəxsdən soruşmadan rədd edir ([[SPEC-PROTO-0002]]/PV6, RB-WP-19); sui-istifadə edən yoxlayan tərəfə sanksiya pilləkəni (RB-ENF-02). | Qismən |
| TR77 | Cüzdan provayderinə çoxlu etibarsız sorğu göndərmək. | R13 | Cüzdan provayderi | Şəbəkə qaydası yoxdur; provayderin istismar tədbiri. Vahid sorğuları vahid açarı ilə imzalıdır ([[ADR-0025]]). | Qismən |
| TR78 | Dövləti etibarsız PID provayderini etibar siyahısından çıxara bilməyən hala salmaq. | R13 | Operator | Siyahı ən geci 90 gündə yenidən imzalanır, dəyişikliklər tez dərc edilir (RB-OP-03); köhnəlmiş siyahı "yoxlanıla bilmədi" verir (RB-GEN-03). Siyahı imzası yeganə operatordadır (FW-ARF-0001 §7.4 L1). | Qismən |
| TR79 | Rəqəmsal cüzdanın dayandırılmasının və ya ləğvinin qarşısını almaq. | R13 | Cüzdan provayderi, Şəxsiyyət xidməti | Telefonsuz və hesabsız vahid ləğvi ([[ADR-0047]]/WR3); WIA-nın ömrü 24 saatdan azdır ([[ADR-0025]]/WIA1); şəxsiyyət xidməti ləğv edilmiş vahiddəki sənədlərini ən geci 24 saatda ləğv edir ([[ADR-0047]]/WR1). | Qarşılanıb |
| TR80 | Yoxlayan tərəflərin, şəxslərin və ya PID provayderinin əməliyyatlarını əngəlləmək. | R13 | Operator, Yoxlayan tərəf | Yaxın məsafədə internetsiz təqdimat; yoxlayan tərəf siyahıları əvvəlcədən yükləyir (RB-RP-06); köhnəlmiş mənbədə "yoxlanıla bilmədi" (RB-GEN-03). Kəsinti testləri aparılmayıb. | Qismən |
| TR81 | WSCD-ni sıradan çıxarmaq və ya istifadəyə yararsız etmək. | R13 | Cüzdan provayderi | Platformanın təhlükəsiz zonası; cihaz itəndə və ya nasaz olanda sənədlər yenidən alınır (RB-H-04). | Qismən |
| TR82 | PID provayderini PID-ləri ləğv edə və ya dayandıra bilməyən hala salmaq. | R13 / R9 | Şəxsiyyət xidməti | Ləğv siyahısı dəyişiklik olmasa da sabit intervalla dərc edilir; xidmət yenidən başlayanda dərc edilmiş token yoxdursa dərhal dərc edilir ([[SPEC-CRED-0003]]/S5, S6); tokenin müddəti bitdikdə yoxlayan tərəf "yoxlanıla bilmədi" verir. | Qismən |
| TR83 | Yoxlayan tərəfin özü ilə paylaşılandan artıq şəxsiyyət məlumatı çıxarması. | R14 | Yoxlayan tərəf | Əhatə yoxlaması ([[SPEC-API-0001]]/AP6), məlumatların minimallaşdırılması baxışı (RB-REG-08), seçici açıqlama və yaş sahələri ([[ADR-0064]]/YE2). | Qismən |
| TR84 | Gizli əməkdaşlıq edən yoxlayan tərəflərin və ya PID provayderlərinin bildiklərindən artıq şəxsiyyət məlumatı çıxarması. | R14 | Yoxlayan tərəf, Sənədi verən | Hər yoxlayan tərəfə ayrı nüsxə və təxəllüs; şəxsiyyət sənədində sıfır bilik sübutu ([[ADR-0032]]). Eyni sənədi verənin sənədləri birləşdirilsə uyğunlaşdırma riski qalır (FW-ARF-0001 §7.4 L3). | Qismən |
| TR85 | Şəxsiyyət tələb olunmayan yerdə şəxsin şəxsiyyət məlumatından istifadə edərək onu izləmək. | R14 | Yoxlayan tərəf | Giriş siyasətləri şəxsiyyət nömrəsi tələb etmir ([[ADR-0031]]/PS4); hər sayt üçün təxəllüs (RB-RP-13); əhatə yoxlaması ([[SPEC-API-0001]]/AP6). | Qismən |
| TR86 | (Q)EAA birləşmələrinin "saxta" təqdimatını yaratmaq. | R10 | Yoxlayan tərəf | Eyni cavabdakı hər sənədin holder binding-i eyni `aud` və `nonce`-a görə ayrı-ayrılıqda yoxlanılır ([[SPEC-PROTO-0002]]/PV7, PV10, PV11); iki şəxsin rəqəmsal cüzdanı birgə işləsə, sənədlərin eyni cüzdan vahidinə aid olduğunu göstərən kriptoqrafik bağ yoxdur. Aİ müzakirəsi davam edir. | Qismən |
| TR87 | Rəqəmsal cüzdanı şəxsin açıq razılığı və ya tək nəzarəti olmadan, şəxsin xəbərsiz olduğu (məs. yatarkən) və ya yoxlayan tərəfi görə bilmədiyi hallarda uzaqdan aktivləşdirmək və ya ələ keçirmək. | R10 | Cüzdan provayderi | Hər təqdimat istifadəçi yoxlaması tələb edir ([[SPEC-WALLET-0001]]/WL11); təsdiq ekranı yoxlayan tərəfin qeydiyyatdakı adını göstərir (RB-WP-13). | Qismən |
| TR88 | Sorğunun metaməlumatını (xidmət adı, istifadələr …) dəyişdirmək. | R10 | Yoxlayan tərəf, Cüzdan provayderi | Sorğu obyekti imzalıdır ([[SPEC-PROTO-0002]]/PV6); qeydiyyat sertifikatı imzalıdır və giriş sertifikatına bağlıdır ([[ADR-0026]]/WRC4). | Qarşılanıb |
| TR89 | Cavab məlumatını (xidmət vəziyyəti, `nonce` …) dəyişdirmək. | R10 | Yoxlayan tərəf | Cavab şifrəlidir ([[SPEC-PROTO-0002]]/PV3); KB-JWT `nonce` və `aud`-u imzalayır (PV7), `sd_hash` təqdim edilən dəsti bağlayır ([[SPEC-CRED-0002]]/C9). | Qarşılanıb |
| TR90 | Sorğunun atribut məlumatını dəyişdirmək (artıq tələb …). | R10 | Yoxlayan tərəf, Cüzdan provayderi | Sorğu imzalıdır; rəqəmsal cüzdan tələb olunanları qeydiyyatdakı əhatə ilə müqayisə edir və artıq tələbdə xəbərdarlıq edir ([[SPEC-WALLET-0001]]/WL8); yoxlayan tərəfdə əhatə yoxlaması ([[SPEC-API-0001]]/AP6). | Qarşılanıb |
| TR91 | Yoxlayan tərəfin əvvəlki sessiyanın elementlərini başqa sessiyada təkrar istifadə etməsi. | R10 | Yoxlayan tərəf | `nonce` birdəfəlikdir ([[SPEC-PROTO-0002]]/PV10); hər yükləmə təzə qoldur (PV15); KB-JWT `iat` pəncərəsi ([[SPEC-CRED-0002]]/C17). | Qarşılanıb |
| TR92 | PID-i provayderdən cüzdan vahidinə ötürülərkən dəyişdirmək və ya başqası ilə əvəz etmək. | R10 | Şəxsiyyət xidməti, Cüzdan provayderi | Sənəd imzalıdır və TLS üzərindən gedir; giriş tokeni DPoP-a bağlıdır ([[SPEC-PROTO-0001]]/PR17); rəqəmsal cüzdan alarkən imzanı və öz açarına bağlılığı yoxlayır. | Qarşılanıb |
| TR93 | PID-i cüzdan vahidindən onlayn yoxlayan tərəfə ötürülərkən dəyişdirmək və ya başqası ilə əvəz etmək. | R10 | Yoxlayan tərəf | Sənəd imzası, KB-JWT və şifrəli cavab ([[SPEC-CRED-0002]]/C8, [[SPEC-PROTO-0002]]/PV3). | Qarşılanıb |
| TR94 | PID-i cüzdan vahidindən oflayn yoxlayan tərəfə ötürülərkən dəyişdirmək və ya başqası ilə əvəz etmək. | R10 | Yoxlayan tərəf | mdoc-da sənədi verənin imzası və sessiyaya bağlı cihaz imzası ([[ADR-0013]]/MD3, [[SPEC-PROTO-0002]]/PV11); yaxın məsafədə sessiya şifrələnməsi. | Qarşılanıb |
| TR95 | Şəxsin razılığı olmadan PID vermək. | R9 | Şəxsiyyət xidməti | Şəxsiyyət sənədindən əvvəl məlumatlandırma və açıq razılıq ([[SPEC-ID-0003]]/IDP11); şəxsin axını başladan rəqəmsal cüzdanda son təsdiqi ([[ADR-0080]]/VL1); "sənədiniz rəqəmsal cüzdana əlavə edildi" bildirişi (RB-AP-15). | Qarşılanıb |
| TR96 | Ləğv edilmiş və ya etibarsız daxil edilmiş açıqlama siyasətlərindən, bəlkə yoxlayan tərəflərin xəbəri olmadan istifadə etmək. | R9 | Sənədi verən, Cüzdan provayderi | Siyasət yalnız imzalı metaməlumatdadır ([[ADR-0046]]/EP1); siyasəti dəyişən konfiqurasiyanın sənədləri ləğv edilir (EP4); rəqəmsal cüzdan siyasəti şəbəkəsiz qiymətləndirir (EP2). | Qarşılanıb |
| TR97 | Rəqəmsal cüzdanı səhv elektron imzaları yoxlamağa aldatmaq. | R9 | Cüzdan provayderi | Şəbəkədə bu gün elektron imza funksiyası yoxdur. | Tətbiq edilmir |
| TR98 | Rəqəmsal cüzdandan şəxsin nəzarəti xaricində istifadə etmək. | R9 | Cüzdan provayderi | Hər təqdimatda istifadəçi yoxlaması ([[SPEC-WALLET-0001]]/WL11); telefonsuz vahid ləğvi ([[ADR-0047]]/WR3). | Qismən |
| TR99 | Şəxsi təcavüzkarla və ya icazəsiz üçüncü tərəflə autentifikasiyaya və əməliyyatı təsdiq etməyə inandırmaq. | R9 | Cüzdan provayderi | Məcburi qeydiyyat sertifikatı (RB-WP-19), qeydiyyatdakı ad (RB-WP-13); dayandırılmış və ya ləğv edilmiş yoxlayan tərəfə təqdimat yoxdur. İnandırma tam istisna edilə bilməz. | Qismən |
| TR100 | Şəxsə məzmunu göstərmədən və ya səhv məzmun göstərərək elektron imza atdırmaq. | R9 | Cüzdan provayderi | Şəbəkədə bu gün elektron imza funksiyası yoxdur. | Tətbiq edilmir |
| TR101 | Şəxsin cüzdan provayderindəki hesabının giriş nəzarətini yan keçmək. | R9 | Cüzdan provayderi | Cüzdan provayderi istifadəçi hesabı tələb etmir ([[ADR-0047]]/WR3); vahid qeydində fərdi məlumat yoxdur ([[ADR-0025]]/WIA2). | Tətbiq edilmir |
| TR102 | Əlaqə zamanı yoxlayan tərəfləri təqlid etmək. | R9 / R6 | Yoxlayan tərəf, Cüzdan provayderi | Müştəri identifikatoru giriş sertifikatından gəlir və yarpaqla uyğun olmalıdır ([[ADR-0034]]/CI1, CI2); məcburi qeydiyyat sertifikatı ([[ADR-0056]]/MR5); imzalı sorğu ([[SPEC-PROTO-0002]]/PV6). | Qarşılanıb |
| TR103 | Yoxlayan tərəf–brauzer əlaqəsinin arxasındakı şəxsin yoxlayan tərəf–rəqəmsal cüzdan əlaqəsinin arxasındakı şəxsdən fərqli ola bilməsi. | R9 / R6 / R4 | Yoxlayan tərəf | Digital Credentials API yolunda cavab səhifənin mənşəyinə bağlıdır ([[SPEC-PROTO-0002]]/PV7); cihazlararası (QR) yolda brauzer sessiyası ilə rəqəmsal cüzdan arasında ayrıca bağ yoxdur. | Qismən |
| TR104 | Şəxsi rəqəmsal cüzdanını səbəbsiz ləğv etməyə inandırmaq. | R9 / R13 | Cüzdan provayderi | Ləğv şəxsin bağlama kodu ilə və ya rəqəmsal cüzdanın içindən edilir ([[ADR-0047]]/WR3); şəxs ləğvi rəqəmsal cüzdandan kənarda öyrənə bilər (WR4). İnandırma tam istisna edilə bilməz. | Qismən |
| TR105 | Ortadakı adam hücumu etmək. | R9 / R6 / R14 | Yoxlayan tərəf, Cüzdan provayderi | TLS, imzalı sorğu, şifrəli cavab ([[SPEC-PROTO-0002]]/PV3, PV6); yaxın məsafədə sessiya şifrələnməsi; giriş sertifikatı müştəri identifikatoruna bağlıdır ([[ADR-0034]]/CI2). | Qarşılanıb |
| TR106 | Şəbəkəyə müntəzəm qoşulmayan rəqəmsal cüzdandan etibarsız və ya ləğv edilmiş atributlar təqdim etmək. | müxtəlif | Yoxlayan tərəf | Yoxlayan tərəf ləğv statusunu və müddəti özü yoxlayır ([[SPEC-CRED-0003]]); sıfır bilik sübutu yalnız ən çox 24 saatlıq nüsxələrlə ([[ADR-0044]]/ZC1). | Qarşılanıb |
| TR107 | Rəqəmsal cüzdanı təqlid edərək şəxsdən məlumat oğurlamaq. | müxtəlif | Cüzdan provayderi | Sənədi verən yalnız siyahıdakı provayderin WIA-sını qəbul edir ([[SPEC-PROTO-0001]]/PR11); "siyahıda" göstəricisi ([[ADR-0049]]/LI1–LI3). Şəxsin saxta tətbiqə məlumat daxil etməsinin qarşısı alına bilməz. | Qismən |
| TR108 | Məlumat sorğusunu (məs. autentifikasiya) təkrar oxutmaqla və ya təqlid etməklə etibarlı görünən şəkildə şəxsi təqlid etmək. | müxtəlif | Yoxlayan tərəf | Birdəfəlik `nonce` ([[SPEC-PROTO-0002]]/PV10), KB-JWT `aud` və `iat` pəncərəsi (PV7, [[SPEC-CRED-0002]]/C17). | Qarşılanıb |
| TR109 | Təsdiq edilmiş sorğunu təqlid etmək üçün daxil edilmiş açıqlama siyasətini şəxsə qarşı təkrar oxutmaq. | müxtəlif | Cüzdan provayderi | Siyasət sənədlə birlikdə imzalı metaməlumatdan saxlanılır ([[ADR-0046]]/EP2); siyasət şəxsin təsdiqini əvəz etmir, hər təqdimat təsdiq tələb edir (EP3). | Qismən |
| TR110 | Təhlükəsizlik pozuntusu və ya ələ keçirilmədən sonra şəxslərin məlumatsızlığından və ya gecikmədən istifadə etmək. | müxtəlif | Operator, Cüzdan provayderi | İnsident bildiriş müddətləri (RB-GEN-09), şəxsin vahid ləğvini rəqəmsal cüzdandan kənarda öyrənmə yolu ([[ADR-0047]]/WR4), rüblük şəffaflıq hesabatı (RB-OP-12). Şəxsə birbaşa xəbərdarlıq kanalı yalnız rəqəmsal cüzdanın öz bildirişləridir. | Qismən |
| TR111 | Əvvəllər quraşdırılmış qanuni cüzdan nümunəsinə zərərli funksiyalar əlavə etmək. | müxtəlif | Cüzdan provayderi | Cihaz sübutu W3-də məcburidir (RB-WP-17); zəiflik tapılarsa versiya üzrə cüzdan sübutlarının ləğvi (RB-WP-11). | Qismən |
| TR112 | Qanuni cüzdan nümunəsini dəyişdirib şəxslərə qanuni kimi təklif etmək. | müxtəlif | Cüzdan provayderi | TR111 ilə eyni; sənədi verən yalnız siyahıdakı provayderin WIA-sını qəbul edir ([[SPEC-PROTO-0001]]/PR11). | Qismən |
| TR113 | İstifadəçi yoxlaması mexanizminin özünü aşıb şəxsin autentifikasiyasını yan keçmək. | müxtəlif | Cüzdan provayderi | İstifadəçi yoxlaması platformanın biometriyası və ya parolu ilədir ([[SPEC-WALLET-0001]]/WL11); sertifikasiya yoxdur. | Qismən |
| TR114 | Cüzdan kodunun istifadəçi cihazına yayılması zamanı zərərli kod və ya arxa qapı əlavə etmək. | müxtəlif | Cüzdan provayderi | Tətbiq mağazası imzası; paketlərdə buraxılış mənbəyi sübutu (RB-GEN-07). | Qismən |
| TR115 | Cüzdan kodunun inkişafı zamanı zərərli kod və ya arxa qapı əlavə etmək. | müxtəlif | Cüzdan provayderi | Açıq mənbəli nüvə, buraxılış mənbəyi sübutu (RB-GEN-07), buraxılışdan əvvəl məcburi testlər (RB-ENF-01); müstəqil kod auditi yoxdur. | Qismən |
| TR116 | Təsadüfi ədəd generasiyasını hücuma imkan verəcək qədər entropiyasını azaldacaq şəkildə dəyişdirmək. | müxtəlif | Cüzdan provayderi, Sənədi verən | Platformanın kriptoqrafik generatoru; salt ≥ 128 bit ([[SPEC-CRED-0002]]/C3); ləğv mövqeyi təsadüfi ([[SPEC-CRED-0003]]/S7). | Qismən |
| TR117 | Təchizat zəncirində istifadəçi cihazlarına rəqəmsal cüzdanın istifadə şərtlərinə cavab verməyən kod və ya konfiqurasiya əlavə etmək. | müxtəlif | Cüzdan provayderi | Cihaz sübutu W3-də məcburi, W2-də könüllüdür (RB-WP-17). | Qismən |
| TR118 | Təcavüzkarın nəzarətindəki saxta WSCD ilə cüzdan vahidi aktivləşdirmək. | müxtəlif | Cüzdan provayderi | Açar attestasiyası yaddaş səviyyəsini düzgün bildirir ([[ADR-0025]]/WIA3); W3 bəyanı yalnız cihaz sübutu təsdiqlənmiş vahidə ([[ADR-0047]]/WR5). | Qismən |
| TR119 | WSCA-ya və/və ya WSCD-yə göndərilən məlumatı oxumaq. | müxtəlif | Cüzdan provayderi | WSCA və WSCD platformanın təhlükəsiz zonasıdır; ayrıca sertifikatlaşdırılmış komponent yoxdur (FW-ARF-0001 §7.1). | Qismən |
| TR120 | WSCA-ya ixtiyari məlumat göndərmək. | müxtəlif | Cüzdan provayderi | TR119 ilə eyni. | Qismən |
| TR121 | WSCA ilə WSCD arasındakı mübadiləni dinləyərək məlumat oğurlamaq. | müxtəlif | Cüzdan provayderi | TR119 ilə eyni. | Qismən |
| TR122 | WSCD-yə ixtiyari məlumat göndərmək. | müxtəlif | Cüzdan provayderi | TR119 ilə eyni. | Qismən |
| TR123 | WSCA-nı yan keçərək WSCD-yə məlumat göndərmək. | müxtəlif | Cüzdan provayderi | TR119 ilə eyni. | Qismən |
| TR124 | Fişinqlə şəxsləri saxta rəqəmsal cüzdan və PID idarəetmə veb tətbiqinə yönləndirmək. | müxtəlif | Şəxsiyyət xidməti, Cüzdan provayderi | Şəxsiyyət yoxlaması yalnız rəqəmsal cüzdanın başlatdığı axında və son təsdiq həmin rəqəmsal cüzdandadır ([[ADR-0080]]/VL1, VL2); yoxlamadan əvvəl xəbərdarlıq (VL3). Saxta səhifəyə məlumat daxil edilməsinin qarşısı alına bilməz. | Qismən |
| TR125 | Başqa hücumda istifadə ediləcək mesajlar yaratmaq üçün rəqəmsal cüzdanın açarlarını başqa açarlarla əvəz etmək. | müxtəlif | Cüzdan provayderi, Sənədi verən | Sənəd verilməzdən əvvəl açar attestasiyası açarların təhlükəsiz aparatda olduğunu göstərir (RB-AP-10); hər nüsxə sübut edilmiş açara bağlıdır ([[SPEC-PROTO-0001]]/PR6). | Qismən |
| TR126 | Rəqəmsal cüzdanın açarlarını dəyişdirib məhv edərək bəzi funksiyaları istifadəyə yararsız etmək. | müxtəlif | Cüzdan provayderi | Sənədlər yenidən alınır (RB-H-04); açarın silinmə ardıcıllığı müəyyəndir (əvvəl qeyd, sonra açar). | Qismən |
| TR127 | Zərərli proqramı idarə edərək rəqəmsal cüzdanda saxlanılan məlumatlara daxil olmaq. | müxtəlif | Cüzdan provayderi | Açarlar təhlükəsiz zonada ([[SPEC-WALLET-0001]]/WL1); məlumatlar platformanın tətbiq sahəsində; cihaz sübutu. | Qismən |
| TR128 | Rəqəmsal cüzdanda yaradılan sübutlara daxil olmaq. | müxtəlif | Cüzdan provayderi | Jurnal cihazdadır və yalnız şifrəli ixracda çıxır ([[SPEC-WALLET-0001]]/WL4). | Qismən |
| TR129 | Cüzdan provayderlərinin rəqəmsal cüzdandakı obyektlərə daxil ola bilməsi. | müxtəlif | Cüzdan provayderi | Provayder sənəd dəyərlərini görmür; vahid qeydində fərdi məlumat yoxdur ([[ADR-0025]]/WIA2); provayder bərpa açarı saxlamır ([[SPEC-WALLET-0001]]/WL10) və ehtiyat nüsxə almır (WL2). | Qarşılanıb |
| TR130 | Cüzdan provayderlərinin rəqəmsal cüzdanda yaradılan sübutlara daxil ola bilməsi. | müxtəlif | Cüzdan provayderi | Təqdimat jurnalı heç bir halda serverə getmir ([[SPEC-WALLET-0001]]/WL4, [[SPEC-PROTO-0002]]/PV8). | Qarşılanıb |
| TR131 | Kilidi açıq rəqəmsal cüzdan cihazını oğurlamaq. | müxtəlif | Cüzdan provayderi | Hər təqdimatda yenidən istifadəçi yoxlaması ([[SPEC-WALLET-0001]]/WL11); telefonsuz vahid ləğvi ([[ADR-0047]]/WR3). | Qismən |
| TR132 | Bəzi hadisələrin jurnala yazılmasının qarşısını almaq üçün sistemi manipulyasiya etmək. | müxtəlif | Cüzdan provayderi | Jurnal qeydi cüzdan nüvəsində aparılır; jurnalın tamlığını göstərən bütövlük qoruması yoxdur. | Açıq |
| TR133 | Cüzdan nümunəsi ilə WSCA arasındakı rabitəni dinləmək və ya şəxsi təkrar oxutmaq/təqlid etmək (məs. autentifikasiya mexanizmini ələ keçirərək). | müxtəlif | Cüzdan provayderi | Açar istifadəsi platformanın istifadəçi yoxlamasına bağlıdır ([[SPEC-WALLET-0001]]/WL1, WL11); ayrıca sertifikatlaşdırılmış WSCA yoxdur. | Qismən |

# 7. Açıq mövzular

1. **Çox sənədli təqdimatda eyni şəxs** (TR20, TR43, TR86): yoxlayan tərəf eyni cavabdakı hər sənədin holder binding-ini
   ayrı-ayrılıqda yoxlayır; sənədlərin eyni cüzdan vahidinə aid olduğunu göstərən kriptoqrafik bağ yoxdur. Mövzu Aİ-də də
   müzakirədədir.
2. **Rəqəmsal cüzdan jurnalının bütövlüyü** (TR38, TR49, TR132): jurnal cihazda qalır, lakin dəyişdirilməyə və ya natamam
   yazılmağa qarşı qorunmur.
3. **Sertifikasiya və müstəqil audit**: sertifikatlaşdırılmış təhlükəsiz aparat (W3), müstəqil kod auditi və nüfuz testi
   yoxdur; buna görə rəqəmsal cüzdan tərəfindəki tədbirlərin çoxu "Qismən"dir.
4. **Yeganə operator** (TR4, TR17, TR78): siyahı imzası yeganə operatordadır; açar mərasimi və aparat təhlükəsizlik modulu
   gözlənilir ([[FW-ARF-0001]] §7.4 L1).

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-11-16). Özünüqiymətləndirmədir; risk və ya tədbir dəyişəndə eyni işdə yenilənir.
