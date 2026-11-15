---
document_id: ADR-0086
title: "İdarəetmə və qovşaq açarının ayrılması"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Zəncirdə hər üzv dövlətin iki ayrı ünvanı olur: blok istehsal edən yoxlayıcı qovşağın (QBFT) açarı və dövlətin idarəetmə (səs)
  açarı. Zəncirdəki bütün səlahiyyət — təklif, səs, nümayəndə siyahısı, çıxış — yalnız idarəetmə açarındadır; daim onlayn
  serverdəki qovşaq açarının zəncirdə heç bir səlahiyyəti yoxdur və hesab icazə siyahısına düşmür. Üzv qovşaq ünvanını öz idarəetmə
  açarı ilə, səsvermə olmadan dəyişir. İdarəetmə açarı yalnız Governance səsverməsi ilə (2/3, ən azı 2) və dəyişən üzvün bugünkü
  açarı ilə verdiyi dəstək səsi ilə dəyişir; digər üzvlər dövlətin açarını onun razılığı olmadan dəyişə bilməz. İki üzvlü dövrdə
  idarəetmə açarının sınanmış ehtiyat nüsxəsi məcburidir. Qəbul edildi (2026-11-15).
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0052]]", "[[ADR-0055]]", "[[ADR-0076]]", "[[ADR-0082]]", "[[ADR-0084]]", "[[ADR-0085]]", "[[SPEC-BC-0001]]", "[[ARCH-0002]]"]
translation_of: ADR-0086
source_version: 1.0.0
---

# Qısaca

Zəncirdə dövlətin iki işi var: blok istehsal etmək (yoxlayıcı qovşaq) və şəbəkənin qərarlarına səs vermək (idarəetmə). İndiyədək
hər ikisi eyni açarla edilirdi. Qovşaq açarı həmişə onlayn olan serverdədir; səs açarı isə ildə bir neçə dəfə istifadə olunur və
seyfdə durmalıdır. Açar eyni olanda serveri ələ keçirən dövlətin səsini və milli qeydlərinin nümayəndə siyahısını da ələ
keçirirdi. Bu qərar iki açarı ayırır: qovşaq açarı yalnız blok istehsal edir, zəncirdə səlahiyyəti yoxdur; bütün səlahiyyət
idarəetmə açarındadır. Qovşaq açarı asanlıqla (dövlətin öz qərarı ilə) dəyişdirilir; idarəetmə açarı yalnız şəbəkənin səsi və
dövlətin öz səsi ilə dəyişir.

# Kontekst

- [[SPEC-BC-0001]] §1: `Governance` üzv qeydində bir ünvan saxlayırdı (`StateMember.validatorAddress`); təklif, səs, səsin geri
  götürülməsi, təklifin geri götürülməsi, nümayəndə açarları siyahısı (`setDelegateKeys`) və çıxış bu ünvandan edilirdi.
  [[ADR-0052]] K2: Besu lokal icazə siyahısının hesab hissəsi eyni ünvanı "validator" kimi siyahıya alır.
- [[ARCH-0002]] Addım 2 və Açıq Məsələlər 6 (2026-11-11): "idarəetmə və konsensus açarı bu gün eynidir; ayrılana qədər real
  şəbəkədə qovşaq açarı HSM-də saxlanmalıdır; ayrılma ikinci dövlət qoşulmazdan əvvəl yeni qərar qeydi ilə."
- Zəncir qatı yoxlanışı (2026-11-15): ayrılma ilk zəncir qurulmazdan əvvəl edilməlidir; sonradan etmək canlı Governance yeniləməsi
  deməkdir. [[ADR-0084]] LS6: real şəbəkə açar ayrılması üçün qərar qeydi olmadan açılmır.
- [[ADR-0076]]: iki üzvlü şəbəkədə birtərəfli çıxış yoxdur; bir üzvün səs açarı itərsə idarəetmə kilidlənir — buna görə iki üzvlü
  dövr üçün açar ehtiyatı və sınaq imzası qaydası yazıldı ([[ARCH-0002]] Addım 11).
- **Layihə rəhbərliyinin istiqaməti (2026-11-15):** zəncir kodu sönülü halda tamamlanır ([[ADR-0084]] K6); növbəti işlər görülür.
  Bu qərar həmin işlərin birincisidir.

# Qərar

## K1 — Üzv qeydində iki ünvan

Hər üzvün qeydində iki ünvan olur: **qovşaq ünvanı** (`validatorAddress`, QBFT yoxlayıcı qovşağınün açarı) və **idarəetmə ünvanı**
(`governanceAddress`, dövlətin səs açarı). Qeyd həmçinin idarəetmə açarının üzvə bağlandığı anı saxlayır (`governanceSince`; qəbulda
və açar dəyişikliyində yazılır). Qaydalar:

- İki ünvan sıfır ola bilməz və bir-birindən fərqlidir.
- Bir ünvan yalnız bir dövlətdə və yalnız bir rolda istifadə olunur: dövlətin qovşaq ünvanı başqa dövlətin qovşaq ünvanı ola bilməz
  (`ValidatorInUse`, N1), idarəetmə ünvanı başqa dövlətin idarəetmə ünvanı ola bilməz, heç bir ünvan heç bir dövlətdə digər rolda
  istifadə oluna bilməz (`KeyInUse`).
- Buraxılan (dəyişdirilən) ünvan həmin dövlətə bağlı qalır; başqa dövlətə verilə bilməz. Ələ keçirilmiş köhnə açar başqa yerə
  daşına bilməz.
- Təsisçilər quruluşda (`initialize`) iki ünvanla daxil olur; yeni üzv qəbulu təklifi (`proposeStateAdmission`) iki ünvanı daşıyır.

## K2 — Zəncirdəki bütün səlahiyyət idarəetmə açarındadır

Təklif açmaq (bütün növlər), səs vermək və dəyişmək, səsi geri götürmək, təklifi geri götürmək, nümayəndə açarları siyahısı, çıxış
və SchemaRegistry bağı yalnız üzvün **bugünkü** idarəetmə ünvanından edilir (`NotGovernor`). Qovşaq açarının zəncirdə heç bir
səlahiyyəti yoxdur: o yalnız blok istehsal edir və QBFT yoxlayıcı dəstindəki yerini müəyyən edir. Buna görə qovşaq ünvanı Besu
hesab icazə siyahısına düşmür; hesab siyahısında aktiv üzvlərin idarəetmə ünvanları olur ([[ADR-0052]] K2-nin hesab siyahısı bu
qeydlə oxunur). Qovşaq icazə siyahısı dəyişmir: bildirişi Governance-dakı qovşaq ünvanı ilə uyğun gələn yoxlayıcı qovşaqlar siyahıya
alınır. İcrada səslər üzvlərin bugünkü idarəetmə ünvanından sayılır.

## K3 — Qovşaq açarını üzv özü dəyişir

Üzv qovşaq ünvanını öz idarəetmə açarı ilə, səsvermə olmadan dəyişir (`setValidatorAddress`, hadisə `ValidatorAddressChanged`).
Səbəb: qovşaq açarı ən çox risk altında olan açardır və ələ keçiriləndə tez dəyişdirilməlidir; zəncirdə səlahiyyəti olmadığı üçün
dəyişdirilməsi dövlətin daxili işidir (nümayəndə siyahısı kimi). Ələ keçirilmiş qovşaq açarı özünü dəyişə bilməz. Zəncirdəki ünvan
dəyişəndə hər operator icazə siyahısını zəncirdən yenidən yaradır; QBFT yoxlayıcı dəstindəki dəyişiklik ayrıca yoxlayıcıların öz
səsi ilə (QBFT səviyyəsində) edilir.

## K4 — İdarəetmə açarı şəbəkənin səsi və üzvün öz səsi ilə dəyişir

İdarəetmə açarı yalnız növü müəyyən Governance təklifi ilə dəyişir (`proposeGovernanceKeyChange`, növ `GOVERNANCE_KEY_CHANGE`,
hadisə `GovernanceAddressChanged`):

- Hədd digər təkliflərlə eynidir: aktiv üzvlərin 2/3-si, ən azı 2 ([[ADR-0002]], R6).
- **Dəyişən üzvün bugünkü açarı ilə verdiyi dəstək səsi əlavə olaraq şərtdir** (`KeyChangeNeedsOwnVote`). Digər üzvlər həddi
  doldursa da dövlətin açarını onun razılığı olmadan dəyişə bilməz; dəyişə bilsəydilər həmin dövlətin nümayəndə siyahısını, yəni
  milli qeydlərinə yazmaq səlahiyyətini ələ keçirərdilər (N1).
- Təklifi istənilən üzv aça bilər (açarı dəyişən üzv də).
- İcrada yenidən yoxlanılır: üzv hələ aktivdir, yeni açar hələ boşdur (arada başqa dövlətə və ya digər rola bağlanmayıb).
- İcradan sonra köhnə açarın səlahiyyəti dərhal düşür; köhnə açarla açıq təkliflərə verilmiş səslər sayılmır (`governanceSince`),
  üzv yeni açarla yenidən səs verir — yenidən qəbul edilən üzvün köhnə səslərinin sayılmaması qaydası ilə eyni.

**Niyə səsvermə, niyə təkcə öz imzası yox.** Açar təkcə üzvün öz imzası ilə dəyişsəydi, idarəetmə açarını oğurlayan onu öz açarına
çevirib əsl sahibini həmişəlik kənarda qoya bilərdi; iki üzvlü şəbəkədə həmin üzvü çıxarmaq da mümkün deyil (çıxarma hədəfdən başqa
ən azı iki səs tələb edir). Səsvermə şərtində ələ keçirilmiş açar tək başına heç nəyi dəyişə bilməz: digər üzvlər dəyişikliyi ayrı
kanaldan gələn yazılı müraciətlə yoxlayır. Üzvün öz səsi şərti isə çoxluğun dövlətin yerini səssizcə ələ keçirməsinin qarşısını alır.

## K5 — İki üzvlü dövr və açar itkisi

- İki üzvlü şəbəkədə açar dəyişikliyi iki üzvün səsini tələb edir (dəyişən üzv + digər üzv). İtirilmiş idarəetmə açarı iki üzvlü
  şəbəkədə zəncir üzərində bərpa oluna bilməz: dəyişiklik üçün həmin açarın səsi lazımdır, üzv çıxarıla və çəkilə bilməz
  ([[ADR-0076]]). Buna görə [[ARCH-0002]] Addım 11-in ehtiyat və sınaq imzası qaydası **idarəetmə açarına** tətbiq olunur və iki
  üzvlü dövrdə məcburidir: ehtiyatdan bərpa edilən açarın ünvanı Governance-dakı **idarəetmə ünvanı** ilə eyni olmalı, bu açarla
  sınaq imzası atıla bilməlidir. Qovşaq açarı üçün ehtiyat şərt deyil: itərsə üzv idarəetmə açarı ilə yenisini yazır (K3).
- Üç və daha çox üzvlü şəbəkədə itirilmiş açarın yolu bugünkü yoldur: üzv digər üzvlərin səsi ilə çıxarılır və yeni ünvanlarla
  yenidən qəbul edilir (görünən, əsas xülasəli iki təklif).
- Ələ keçirilmiş, lakin ehtiyatı əldə olan açarda üzv və digər üzvlər dərhal dəyişiklik təklifinə səs verir; ələ keçirən də eyni
  açarla səsi çevirə bildiyindən dəyişiklik icra olunana qədər digər üzvlər ələ keçirənin səslərini və təkliflərini nəzərə almır.
  Zəncir qərar vermədiyi üçün ([[ADR-0084]] LS2) bu müddət heç bir sənədin yoxlanmasına təsir etmir.

## K6 — Açarların saxlanması

İdarəetmə açarı qovşaq serverində olmur: ayrı seyfdə (real şəbəkədə aparat açar anbarı) durur və yalnız əməliyyat imzalayanda
istifadə olunur. Qovşaq açarı qovşaq serverindədir (real şəbəkədə aparat açar anbarına üstünlük verilir, amma artıq məcburiyyət
səbəbi səs deyil, blok istehsalıdır). Real şəbəkənin açar yolu (aparat açar anbarı və uzaq imzalayıcı) ayrıca qərar qeydidir
([[ADR-0084]] LS6).

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| **İki ünvan; qovşağın səlahiyyəti yoxdur; qovşaq özü dəyişir; idarəetmə səs + öz səsi ilə** | **seçildi** | Serveri ələ keçirən səsi ələ keçirə bilmir; qovşaq açarı tez dəyişir; idarəetmə açarı nə tək başına ələ keçirilib kilidlənə, nə də çoxluq tərəfindən mənimsənilə bilər |
| Tək açar (bugünkü), qovşaq açarını HSM-də saxlamaq | rədd | Daim onlayn açar səs və milli qeyd səlahiyyəti daşıyır; HSM imzanı qoruyur, amma ələ keçirilmiş serverin HSM-ə imza atdırmasının qarşısını almır |
| İdarəetmə açarını üzv tək başına dəyişir | rədd | Açarı oğurlayan sahibini həmişəlik kənarda qoyur; iki üzvlü şəbəkədə geri dönüş yolu yoxdur |
| İdarəetmə açarı yalnız səslə, üzvün öz səsi şərtsiz | rədd | 2/3 çoxluq dövlətin açarını öz açarına çevirib onun nümayəndə siyahısını, yəni milli qeydlərini ələ keçirə bilər (N1-ə zidd) |
| Qovşaq açarı da yalnız səslə dəyişir | rədd | Ən riskli açarın dəyişdirilməsi digər operatorların sürətinə bağlanır; qovşağın zəncirdə səlahiyyəti olmadığından səs heç nəyi qorumur |
| Ayrıca kontrakt (idarəetmə açarı reyestri) | rədd | Governance-ın səlahiyyət yoxlaması hər çağırışda xarici çağırış olardı; yaddaş düzümünə bir yeni xəritə və `__gap`-dən bir yuva ilə eyni nəticə alınır |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| KG1 | Hər üzvün qeydində iki ünvan var: qovşaq (QBFT) ünvanı və idarəetmə ünvanı; ikisi sıfır deyil və fərqlidir. Bir ünvan yalnız bir dövlətdə və yalnız bir rolda istifadə olunur; buraxılan ünvan həmin dövlətə bağlı qalır, başqa dövlətə verilə bilməz. |
| KG2 | Zəncirdəki bütün səlahiyyət (təklif, səs, səsin və təklifin geri götürülməsi, nümayəndə siyahısı, çıxış, SchemaRegistry bağı) yalnız üzvün bugünkü idarəetmə ünvanındadır; qovşaq ünvanının zəncirdə səlahiyyəti yoxdur və hesab icazə siyahısına düşmür. İcrada səslər bugünkü idarəetmə ünvanından sayılır. |
| KG3 | Üzv qovşaq ünvanını öz idarəetmə açarı ilə, səsvermə olmadan dəyişir; yoxlayıcı dəstindəki dəyişiklik QBFT səviyyəsində yoxlayıcıların səsi ilə edilir. |
| KG4 | İdarəetmə açarı yalnız Governance təklifi ilə dəyişir: aktiv üzvlərin 2/3-si (ən azı 2) və dəyişən üzvün bugünkü açarla verdiyi dəstək səsi birlikdə tələb olunur; icrada yenidən yoxlanılır; köhnə açarın səlahiyyəti və açıq təkliflərdəki səsləri düşür. |
| KG5 | İki üzvlü dövrdə hər üzv idarəetmə açarının ayrı yerdə saxlanan, sınanmış ehtiyat nüsxəsini saxlayır (bərpa edilən açarın ünvanı Governance-dakı idarəetmə ünvanı ilə eynidir, sınaq imzası atıla bilər); idarəetmə açarı qovşaq serverində olmur. |

# Nəticələr

- `contracts/src/governance/Governance.sol`, `IGovernance.sol`: üzv qeydinə `governanceAddress` və `governanceSince` (struktur yalnız
  xəritə dəyəridir; üzvlər sona əlavə olundu), təklif qeydinə `governanceAddress`, yeni xəritə `_governanceToState` (`__gap` 37 → 36),
  yeni təklif növü `GOVERNANCE_KEY_CHANGE` (sona əlavə olundu), `proposeGovernanceKeyChange`, `setValidatorAddress`, hadisələr
  `ValidatorAddressChanged`, `GovernanceAddressChanged`, iki ünvanlı `StateAdmitted`; xətalar `NotGovernor` (`NotValidator`-un
  yerinə), `KeyInUse`, `KeyChangeNeedsOwnVote`. `initialize` və `proposeStateAdmission` üçüncü arqumenti (idarəetmə ünvanı) alır.
  Yaddaş düzümü yoxlaması keçdi; kod ölçüsü Governance 23.872 bayt (ehtiyat 704). İşləyən zəncir yoxdur; əsas xətt yeniləndi.
- Dərcçi və alətlər: icazə siyahısının hesab hissəsində aktiv üzvlərin idarəetmə ünvanları ("governance"), qovşaq ünvanı yox; açar
  xəritəsi (`tamga-chain-keys/1`) hər dövlətə `governance` açarı əlavə edir; lokal inkişaf qaydası: idarəetmə açarı = qovşaq hesabı
  + 10 (Hardhat test hesabları); test şəbəkəsi skriptləri, miqrasiya və davamlı proyeksiya imzalayanları idarəetmə açarı ilə səs verir.
- [[SPEC-BC-0001]] §1, [[ARCH-0002]] Addım 2, Addım 6, Addım 11 və Açıq Məsələlər 6, qovşaq təlimatı (GUIDE-0015) yeniləndi.
- İdarəetmə əmr aləti idarəetmə açarı ilə imzalayır (açar dəyişikliyi və qovşaq ünvanı dəyişikliyi alt əmrləri ilə).

# Status

**Accepted — 2026-11-15.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-15). DECISIONS: D-GOV-13. KG1–KG5 məcburidir.
