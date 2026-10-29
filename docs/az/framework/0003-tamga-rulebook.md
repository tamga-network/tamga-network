---
document_id: FW-RB-0001
title: "Əlavə B — Tamga Rulebook"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-20
summary: >
  Tamga şəbəkəsinə qoşulan hər bir rolun (operator və siyahı operatoru, qeydiyyat qurumu, sənədi verən qurum, səlahiyyətli mənbə, cüzdan provayderi, yoxlayan tərəf, sənəd sahibi) əməl etməli olduğu məcburi, nömrələnmiş qaydalar. Hər qayda bir dəyişməzdən və ya qərardan törədilib; bu sənəd yeni qayda yaratmır, qaydaları rollar üzrə toplayır və "MUST" dili ilə ifadə edir. EUDI ARF Annex 2 (High-Level Requirements) sənədinin qarşılığıdır.
translation_of: FW-RB-0001
source_version: "1.0.0"
---

# Rulebook strukturu

Tamga [[t:rulebook|Rulebook]] şəbəkədəki **bütün iştirakçılar və bütün rəqəmsal sənəd növləri** üçün ümumi qaydaları toplayır. EUDI [[t:ARF|ARF-də]] olduğu kimi, hər
sənəd növünün öz rulebook-u var və bu kitabdan şaxələnir:

| Rulebook | Sənəd növü | Sənəd |
|---|---|---|
| Education Rulebook | tələbə sənədi, diplom | [[FW-RB-0002]] |
| Identity Rulebook | Tamga şəxsiyyət sənədi | [[FW-RB-0003]] |
| Event Ticket Rulebook | tədbir bileti | [[FW-RB-0004]] |
| Contact Rulebook | yoxlanılmış e-poçt ünvanı, yoxlanılmış telefon nömrəsi | [[FW-RB-0005]] |

Sənəd növü rulebook-u bu kitabdakı bütün qaydaları miras alır və yalnız həmin növə xas qaydaları əlavə edir: kim verir, hansı
[[t:identity-proofing]] ilə, hansı sahələrlə, nə qədər müddətə etibarlıdır, necə ləğv edilir. Sənəd növü rulebook-ları Avropa İttifaqının (Aİ) Attestation
Rulebook şablonunun bölmə strukturuna əməl edir (§11). Yeni sənəd sahəsi (məsələn, səhiyyə) yeddi şərtli yoxlama siyahısı (SG1–SG7)
tamamlandıqdan sonra yeni rulebook kimi əlavə edilir (RB-SCH-05).

İki siyasət sənədi qaydaları mövzular üzrə toplayır: **Ləğv Siyasəti** ([[FW-POL-0001]]) rəqəmsal sənədlərin hansı şərtlərlə ləğv edildiyini,
**Cüzdan Sübutu Siyasəti** ([[FW-POL-0002]]) isə cüzdan provayderlərinin WIA və KA-nı necə verdiyini və ləğv etdiyini təsvir edir.

Hər rolun nə etdiyi və hansı qaydalara tabe olduğu [[FW-ROLE-0001]], iştirakın addımları isə [[FW-ONB-0001]] səhifəsində verilib.

# 0. Oxu bələdçisi

- **Qaydanın formatı:** `RB-<ROL>-<NN>` · qaydanın mətni. Qaydaların əsaslandığı qərarlar və spesifikasiyalar Əlavə E-dədir.
- **Açar sözlər** RFC 2119 mənasındadır: **MUST** (məcburi), **MUST NOT** (qadağan), **SHOULD** (tövsiyə; kənarlaşma
  əsaslandırılır), **MAY** (ixtiyari).
- **Mərhələ qeydi:** bu gün şəbəkə **siyahı mərhələsindədir**: etibar imzalanmış siyahılara və lövbər jurnalına əsaslanır. "Reyestr mərhələsi"
  ifadəsini daşıyan qaydalar ümumi reyestr qurulduqda qüvvəyə minir; həmin mərhələdə "siyahı və lövbər jurnalı" əvəzinə "ümumi reyestr"
  oxunur. Qaydanın mətni dəyişmir.
- Qaydalar dəyişməzlər sənədinə yeni kod əlavə etmir; oradakı kodların rollar üzrə görünüşüdür. Qaydanı dəyişmək üçün
  mənbə sənədi dəyişin.

Rollar: GEN (hamı) · OP (operator, siyahı operatoru — [[t:TLSO]]) · REG (qeydiyyat qurumu) · AP ([[t:issuer|sənədi verən qurum]]) ·
AS ([[t:authentic-source|səlahiyyətli mənbə]]) · WP ([[t:wallet-provider|cüzdan provayderi]]) · RP ([[t:verifier|yoxlayan tərəf]]) · H ([[t:holder|sənəd sahibi]]) · SCH (növ və sxem).

---

# 1. RB-GEN — Bütün iştirakçılar

| # | Qayda |
|---|---|
| RB-GEN-01 | İştirakçı ümumi qeydlərə (etibar siyahısı, lövbər jurnalı, ümumi reyestr), loqlara və API cavablarına fərdi məlumatlar, sənəd məzmunu və ya sənədin həşini **MUST NOT** yazmaq. |
| RB-GEN-02 | İştirakçı etibar məlumatlarını **MUST** spesifikasiyadakı yoxlama qaydalarına uyğun oxumaq: imzanı, versiya zəncirini və aktuallığı yoxlamadan heç bir siyahı qeydindən istifadə etməmək. Şəbəkənin açıq mənbəli paketlərindən (`@tamga-network/trust`) istifadə edilməsi **SHOULD**; öz tətbiqini yazan iştirakçı uyğunluq testlərindən keçir. |
| RB-GEN-03 | Etibar mənbəyi köhnəlmişdirsə (`next_update` keçib) və ya əlçatan deyilsə, nəticə **MUST** `INDETERMINATE`/`UNKNOWN` olmaq; heç vaxt `ACCEPTED`, heç vaxt `REJECTED`. |
| RB-GEN-04 | Naməlum `list_format_version` və ya (reyestr mərhələsində) naməlum müqavilə versiyası aşkarlandıqda komponent **MUST** dayanmaq və həyəcan siqnalı vermək; qəbul etmək qadağandır. |
| RB-GEN-05 | Heç bir Tamga infrastruktur komponenti IP ünvanını (xam, həşlənmiş və ya qısaldılmış formada) **MUST NOT** loqlamaq. Sazlama loqu ən çox 1 gün saxlanılır və IP ehtiva etmir. |
| RB-GEN-06 | Loqlar və audit qeydləri sahənin **adını** daşıya bilər; sahənin **dəyəri** və ləğv siyahısının mövqeyi (`idx`) **MUST NOT**. |
| RB-GEN-07 | İştirakçı Tamga-nın rəsmi `@tamga-network/*` paketlərindən istifadə edirsə, nəşr mənbəyinin sübutunu (provenance) yoxlamalıdır (**SHOULD**); paketlərdə `postinstall` skripti **MUST NOT**. |
| RB-GEN-08 | Xaricə yönəlik təminat ifadələri eIDAS adları ilə (Low / Substantial / High; EAA, QEAA qarşılığı, dövlət sənədi) verilir; istifadəçiyə rəqəmsal səviyyə göstərilmir (**SHOULD**). |
| RB-GEN-09 | Hər iştirakçı özünə aid kritik insident barədə **MUST** ən geci 4 saat ərzində, yüksək əhəmiyyətli insident barədə isə ən geci 24 saat ərzində sxem sahibinə məlumat vermək. |
| RB-GEN-10 | Siyahı mərhələsində hər iştirakçı bilir ki, qeydlər **yalnız bir operatorun imzasına** əsaslanır və ləğv bir neçə dəqiqə ərzində (nəşr intervalı + yoxlayan tərəfin əvvəlcədən yükləmə intervalı) qüvvəyə minir; bu məhdudiyyətlər barədə şəxslərə yazılı məlumat verilir. |

---

# 2. RB-OP — Operator və siyahı operatoru (TLSO)

Bu gün: Tamga Network (yaradılacaq fond) adından müvəqqəti operator: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ; siyahılarda operatorun adı "Tamga Network" yazılır (RB-OP-01). Təhvil zamanı bu rol milli orqana keçir.

| # | Qayda |
|---|---|
| RB-OP-01 | Hər siyahı (`lotl`, `tl-<cc>`) **MUST** `operator {name, status, on_behalf_of}` daşımaq; müvəqqəti operatorluq müddətində `status = "provisional"`. |
| RB-OP-02 | Siyahı versiyaları **MUST** monoton artmaq və `previous_version_hash` daşımaq; heç bir sətir silinmir, status dəyişiklikləri `status_history`-ə əlavə edilir. |
| RB-OP-03 | `next_update` **MUST** ən çox 90 gün olmaq; dəyişiklik olmasa belə siyahı yenidən imzalanır; dəyişiklik **MUST** ən geci 24 saat ərzində dərc edilmək. |
| RB-OP-04 | Lövbər jurnalı (`anchors.jsonl`) **MUST** hər saat imzalanmaq (dəyişiklik olmasa belə); hər sətir `previous_hash` daşıyır; sətir silinmir. |
| RB-OP-05 | Siyahının imzası **MUST** ən azı iki növbələşən sertifikatla verilmək; rotasiya ən azı 30 gün əvvəl elan edilir; yeni açar köhnəsi ilə imzalanır. |
| RB-OP-06 | Kök barmaq izləri **MUST** `keys/root-fingerprints.json`-da, `tamga.network/trust-anchor` daimi səhifəsində, Trust Framework-də və müqavilə əlavələrində eyni dəyərlərlə dərc edilmək. |
| RB-OP-07 | Hamı üçün açıq dəyişiklik jurnalı (`CHANGELOG.md`) **MUST** aparılmaq: kim, nə vaxt, nə (əlavə etmə, dayandırma, çıxarma, səlahiyyət), əsaslandırma kodu. |
| RB-OP-08 | Operator host etdiyi heç bir xidmətdə imzalama açarı **MUST NOT** saxlamaq (sənədi verən qurumun imza və ləğv siyahısı açarları quruma məxsusdur). |
| RB-OP-09 | Operator host edilən siyahı indeksləmə xidməti **MUST NOT** təqdim etmək; indeksləmə proqram təminatını açıq mənbə kimi dərc edir. Host edilən yoxlayan tərəf (vasitəçi) təqdim edilə bilər; onun qaydaları RB-OP-17-dədir. |
| RB-OP-10 | Host edilən sənədi verən qurumların siyahısı ictimaiyyətə açıqdır; onların payı 30%-i keçərsə, məsələ şuranın gündəminə daxil edilir. |
| RB-OP-11 | Sənəd növü və ləğv siyahısı üzrə istifadə statistikası yalnız ümumiləşdirilmiş şəkildə saxlanılır; 50-dən kiçik qruplar dərc edilmir; sənədi verən qurum, yoxlayan tərəf və ya sənəd üzrə sayğac aparılmır; xam sayğaclar ən çox 13 ay saxlanılır. |
| RB-OP-12 | Şəffaflıq hesabatı **MUST** üç ayda bir, gecikmədən dərc edilmək. |
| RB-OP-13 | Domen adı fond yaradıldıqda fondun adına, o vaxta qədər isə müvəqqəti operatorun adına qeydiyyatdadır; transfer kilidi və DNSSEC tətbiq edilir; ən azı 10 il əvvəlcədən yenilənir; varislik müqaviləsinə tabedir. |
| RB-OP-14 | Türk Dövlətləri Təşkilatı prioriteti: hər milli siyahı və hər ARF rolu üçün **MUST** yer ayrılmış olmaq (boş olsa belə); təhvil yalnız `operator` sahəsini dəyişir; `ca_id`, `issuer_id` və `vct` **MUST NOT** dəyişmək. |
| RB-OP-15 | Ümumi reyestr ən azı iki müstəqil reyestr operatorunun yazılı razılığı olmadan **MUST NOT** qurulmaq; keçid siyahı arxivinin yenidən icrası (replay) və ekvivalentlik testi keçilmədən tamamlanmış sayılmır. |
| RB-OP-16 | Dərc edilmiş sxem faylları (`schemas.`) **MUST** dəyişməz olmaq; kontent çatdırılma şəbəkəsində yenidən formatlama söndürülüb; qeyd (lövbər) dərcdən **sonra** edilir. |
| RB-OP-17 | Host edilən yoxlayan tərəf dəyər qaytaran son nöqtələri **MUST** yalnız təqdimatı açan yoxlayan tərəfə, onun etibar siyahısındakı açarı ilə imzalanmış və ən çox 60 saniyəlik bəyanatla açmaq; dəyərlər ən çox bir dəfə və ən çox 5 dəqiqə ərzində verilir; başqa yoxlayan tərəfə hətta cavabın mövcudluğu barədə məlumat sızmır; brauzerə ötürülən heç bir token dəyər oxuma səlahiyyəti **MUST NOT** daşımaq. |
| RB-OP-18 | Host edilən sənəd vermə xidmətinə xarici giriş **MUST** yalnız quruma bağlı, əhatəsi məhdud API açarı ilə olmaq; açar serverdə yalnız həşi ilə saxlanılır, loqda və audit qeydində yer almır; açar yalnız həmin qurumun hesabında etibarlıdır. |

---

# 3. RB-REG — Qeydiyyat qurumu

| # | Qayda |
|---|---|
| RB-REG-01 | Qeydiyyat qurumu **qeydə alır, təsdiq etmir**: hüquqi səlahiyyət (diplom vermə və s.) şəbəkədən kənardadır; şəbəkə yalnız şəbəkə daxilindəki əhatəni saxlayır. |
| RB-REG-02 | Milli qeydlərə **MUST** yalnız həmin milli qeydin sahibi (dövlət; bu gün dövlət adından müvəqqəti operator) yazmaq. |
| RB-REG-03 | Yeni sənədi verən qurum **MUST** yalnız `ACTIVE` statusunda olan kök sertifikata bağlanmaq. |
| RB-REG-04 | Sənəd növü üzrə səlahiyyət icazə siyahısı ilə verilir, defolt olaraq bağlıdır; zaman pəncərəsi ilə verilir; sənəd növü rulebook-unun "kim sənəd verə bilər" qaydasına əsasən verilir. |
| RB-REG-05 | Qeyd sinfi və təminat (`class`, `assurance`) iştirak qapısına uyğun yazılır; `category` işarəsi yalnız dövlət və kvalifikasiyalı sinif üçündür. |
| RB-REG-06 | Sertifika dəyişikliyi **MUST** yeni `issuer_id` və `successor_id` ilə qeydə alınmaq; köhnə qeyd silinmir. |
| RB-REG-07 | Çıxarma və ya çıxış mövcud qeydləri və rəqəmsal sənədləri **MUST NOT** etibarsız etmək; `REVOKED` statusunda olan sənədi verən qurumun ləğv siyahısını varisi dərc edə bilər. |
| RB-REG-08 | Yoxlayan tərəfin qeydiyyatı müəyyən əhatə ilə aparılır; əhatə məlumatların minimallaşdırılması yoxlamasından keçir (**SHOULD**). |
| RB-REG-09 | Qeyd dəyişikliyi **SHOULD** ən geci 5 iş günü ərzində edilmək. |

---

# 4. RB-AP — Sənədi verən qurum

## 4.1 Eyniləşdirmə və açarlar

| # | Qayda |
|---|---|
| RB-AP-01 | Sənədi verən qurumun identifikatoru milli kök sertifikatına zəncirlənən X.509 sertifikatı olmalıdır (**MUST**); `issuer_id` son (leaf) sertifikatın barmaq izindən törədilir. |
| RB-AP-02 | Sənədi imzalama açarı qurumun nəzarətində olmalıdır (**MUST**) (I3-də HSM-də); Tamga-da saxlanılmamalıdır (**MUST NOT**). Hostinq edilən sənəd vermə xidmətində imza qurumun məsafədən imza xidmətindən (CSC API v2) tələb olunur; xidmətə yalnız imzalanacaq məlumatın heşi göndərilməli (**MUST**), xidmət isə gələn imzanı qurumun etibar siyahısındakı sertifikatı ilə yoxlamalıdır. |
| RB-AP-03 | Ləğv siyahısını imzalama açarı sənəd açarından ayrı olmalıdır (**MUST**). |
| RB-AP-04 | İmza və açar sübutunda yalnız ES256 (P-256) istifadə olunur. |

## 4.2 Sənədin verilməsi

| # | Qayda |
|---|---|
| RB-AP-05 | Sənədi verən qurumun təqdimat məlumatlarındakı (metadata) hər `vct` qeydiyyatda səlahiyyət verilmiş növ olmalıdır (**MUST**). |
| RB-AP-06 | Əvvəlcədən səlahiyyətləndirilmiş axında əməliyyat kodu (`tx_code`) məcburidir (**MUST**); təkliflə **ayrı kanaldan** göndərilir; kanal ünvanı yalnız qurumun qeydiyyatdakı məlumatlarından götürülür; üç səhv cəhddən sonra təklif etibarsız olur. |
| RB-AP-07 | Təklif keçidi birdəfəlikdir; ekranda göstərilən təklif 5 dəqiqə, ayrı kanaldan göndərilən təklif ən çoxu 72 saat etibarlıdır. |
| RB-AP-08 | Birdəfəlik dəyərin (`c_nonce`) istifadəsi atomikdir; giriş tokeni ən çoxu 5 dəqiqə etibarlıdır. |
| RB-AP-09 | Toplu verilən hər nüsxə fərqli cihaz açarına bağlanmalıdır (**MUST**) (10 nüsxə); nüsxə ilə ləğv siyahısındakı mövqeyin (`idx`) uyğunluğu sənədi verən qurumda qalır, kənara çıxmır. |
| RB-AP-10 | Sənədi verən qurum sənədi verməzdən **əvvəl** rəqəmsal cüzdanın cüzdan nümunəsi sübutunu ([[t:WIA]]) və açar sübutunu (KA) `wallet_providers[]` siyahısına qarşı yoxlamalı (**MUST**) və təhlükəsiz aparat səviyyəsinin növün tələbinə cavab verdiyini yoxlamalıdır. |
| RB-AP-11 | Sənədi verən qurum növün tələb etdiyi autentifikasiya səviyyəsini sənədi verməzdən əvvəl təmin etməlidir (**MUST**); bağlama yolu audit jurnalına yazılır, sənədə isə yazılmamalıdır (**MUST NOT**). T3 yalnız avtorizasiya kodu axını ilə və ya üz-üzə təmin edilir. |
| RB-AP-12 | Sənədin subyekti müraciət edən şəxsdən fərqlidirsə, təmsilçilik səlahiyyətinin sübutu məcburidir (**MUST**) (valideyn, vəkil). |
| RB-AP-13 | Mənbə məlumatlarında uyğunluq cədvəlində qarşılığı olmayan dəyər üçün sənədin verilməsi dayandırılmalıdır (**MUST**); təxmini dəyər yaradılmır. |
| RB-AP-14 | `category` sahəsi yalnız qeydiyyat sinfi dövlət və ya kvalifikasiyalı olduqda və qeydiyyatdakı eyni dəyərlə yazılır; I1–I2-də yazılmamalıdır (**MUST NOT**). Sənəd sahibinin autentifikasiya səviyyəsi heç bir sahədə yer almamalıdır (**MUST NOT**). |
| RB-AP-15 | Sənəd verildikdən sonra şəxsə "sənədiniz rəqəmsal cüzdana əlavə edildi; bu siz deyilsinizsə …" bildirişi göndərilməlidir (**MUST**) (fərdi məlumatlar minimum həddə). |
| RB-AP-16 | Xəta cavabları fərdi məlumat ehtiva etmir; əməliyyat kodu cavabdan kənarda saxlanılmır. |
| RB-AP-26 | Sənədi verən qurum hər hansı qurum sənədi növünün yalnız müəyyən yoxlayan tərəflərə göstərilməsini istəyirsə, qaydanı (daxili açıqlama siyasəti) imzalı təqdimat məlumatlarında (metadata), sənəd konfiqurasiyasında dəyər kimi dərc etməlidir (**MUST**); qayda sənədə daxil edilməməlidir (**MUST NOT**). Qayda əlavə edilərsə, dəyişdirilərsə və ya aradan qaldırılarsa, sənədi verən qurum həmin konfiqurasiya ilə verilmiş etibarlı sənədləri ləğv etməlidir (**MUST**). Şəxsiyyət və əlaqə sənədləri qayda daşımır. Qayda yoxlayan tərəflərə bu rulebook-da və növün rulebook-unda elan edilir. |

## 4.3 Ləğv siyahısı

| # | Qayda |
|---|---|
| RB-AP-17 | Ləğv siyahısı sabit intervalla və dəyişiklik olmasa belə dərc edilməlidir (**MUST**); interval xaricində "təcili" dərc edilməməlidir (**MUST NOT**). |
| RB-AP-18 | Mövqe (`idx`) təsadüfidir; ünvan qeyri-şəffafdır (qurumu, ili və ya qrupu kodlaşdırmır); siyahılar növdən başqa meyara görə bölünmür; tutum ən azı 100.000, doluluq ən çoxu 80%; `bits = 2`, şəxsiyyət xidmətinin siyahılarında `bits = 1` ([[ADR-0048]]); `version` monoton artır. |
| RB-AP-19 | Dərc əvvəlcə kontent paylama şəbəkəsinə, **sonra** lövbər jurnalına (reyestr mərhələsində ortaq reyestrə) edilir; siyahıda ləğv biti yoxdur, yalnız lövbər var. |
| RB-AP-20 | Fəaliyyəti müvəqqəti dayandırılmış sənədi verən qurum ləğv siyahısı dərc etməməlidir (**MUST NOT**); varis qurum dərc edə bilər. |
| RB-AP-21 | Şəxs razılığını geri götürərsə, sənəd ləğv edilməlidir (**MUST**). |
| RB-AP-22 | Sənədi verən qurum sənəd qeydlərinin və ləğv siyahısı uyğunluğunun mütəmadi olaraq ehtiyat nüsxəsini çıxarmalıdır (**MUST**); bu ehtiyat nüsxə ortaq siyahının və ya reyestrin ehtiyat nüsxəsindən üstündür, çünki ləğv yalnız bu qeydlə həyata keçirilə bilər. |
| RB-AP-27 | Sənədi verən qurum şəbəkənin ortaq ləğv siyasətinə ([[FW-POL-0001]]) əlavə şərtlərini öz səhifəsində dərc edə bilər (**MAY**); keçid etibar siyahısındakı qeydinin `revocation_policy_uri` sahəsindədir. Əlavə şərtlər ortaq şərtləri daraltmamalıdır (**MUST NOT**). Cüzdan vahidinin ləğvi qurum sənədlərini ləğv etmir ([[ADR-0047]] K1). |
| RB-AP-28 | Sənədi verən qurum müvəqqəti dayandırmanı (ləğv siyahısında `0x02`) yalnız sxemi `suspension_allowed: true` olan növlərdə istifadə edir; digər növlərdə müvəqqəti dayandırma istifadə edilməməlidir (**MUST NOT**). mdoc kimi də verilən növün ləğv siyahısı əlavə olaraq CWT təqdimatı ilə (`application/statuslist+cwt`) ayrıca, qeyri-şəffaf ünvanda eyni bitlərlə dərc edilməlidir (**MUST**); mdoc nüsxəsi CWT ünvanına, SD-JWT nüsxəsi JWT ünvanına istinad edir ([[ADR-0048]] K2, K3; paketlər 0.6.0). |

## 4.4 Uzaqdan şəxsiyyət yoxlanışı provayderləri

| # | Qayda |
|---|---|
| RB-AP-23 | Məsafədən autentifikasiya provayderindən istifadə olunursa, sənədi verən qurum yalnız nəticənin xülasəsini (səviyyə, sessiya identifikatoru, vaxt, provayder) saxlamalıdır (**MUST**); sənəd təsvirləri, üz məlumatları və OCR xam məlumatları sənədi verən qurumun sistemində saxlanılmamalıdır (**MUST NOT**). |
| RB-AP-24 | Provayderin nəticəsi **T səviyyəsinə** uyğunlaşdırılır; uyğunlaşdırma [[SPEC-ID-0003]] cədvəlinə əsasən aparılır; səviyyə yoxlayan tərəfə ötürülmür. |
| RB-AP-25 | Hostinq edilən xidmətdən istifadə edən qurum API açarını öz serverində saxlamalıdır (**MUST**) (brauzerə, rəqəmsal cüzdana, koda yerləşdirməməlidir); açar 90 gündən bir yenilənir (iki açar müəyyən müddət birlikdə etibarlı olur); sızma şübhəsi olduqda qurum ləğv tələb edir. |

## 4.5 RB-AP-ID — Şəxsiyyət sənədi provayderi

| # | Qayda |
|---|---|
| RB-AP-ID-01 | Şəxsiyyət sənədi provayderi **MUST** uzaqdan şəxsiyyət yoxlamasını yalnız öz xidmətində aparmaq; qurumların sənəd vermə xidmətləri, rəqəmsal cüzdan və yoxlayan tərəf uzaqdan şəxsiyyət yoxlaması provayderi ilə **MUST NOT** əlaqə qurmaq. |
| RB-AP-ID-02 | Sənəd verilməzdən əvvəl məlumatlandırma mətni **MUST** göstərilmək və açıq razılıq alınmaq; razılıq yoxdursa, şəxsiyyət yoxlaması **MUST NOT** başladılmaq. |
| RB-AP-ID-03 | Şəxsi məlumat sahələri sənəd verildikdən sonra **MUST NOT** saxlanılmaq; şəkil, selfi, video, OCR xam məlumatları **MUST NOT** saxlanılmaq; daimi qeyd yalnız qeyri-şəffaf `subject_ref`, sənəd nömrəsinin heşi, müddət və ləğv siyahısındakı mövqelərdir. |
| RB-AP-ID-04 | Sənəd **MUST** `urn:tamga:id:IdentityAttestation:1` növündə, `category` sahəsi olmadan, ləğv siyahısı ilə və ən çoxu 2 il etibarlı olmaq; milli şəxsiyyət nömrəsi **MUST** seçici paylaşımla olmaq. |
| RB-AP-ID-05 | Eyni sənəd nömrəsi üçün ikinci aktiv şəxsiyyət sənədi **MUST NOT** verilmək; yenidən yoxlama köhnəsini ləğv edir. |
| RB-AP-ID-06 | Dövlətin PID provayderi təyin edildikdə provayder **MUST** qeydiyyatı `successor_id` ilə təhvil vermək və yeni sənəd verilməsini dayandırmaq; mövcud sənədlər müddətləri bitənə qədər etibarlı qalır. |
| RB-AP-ID-07 | Şəxsiyyət sənədi ilə birlikdə sayt üzrə [[t:pseudonym|psevdonim]] toxumu **MUST** ayrıca və göstərilə bilməyən növdə (`urn:tamga:id:PseudonymSeed:1`) verilmək; toxum şəxsin dəyişməz identifikatorundan, sənəd heşi açarından **ayrı** açarla törədilir və **MUST NOT** saxlanılmaq (hər yoxlamada yenidən hesablanır); bu növ heç bir yoxlayan tərəfin əhatə dairəsinə **MUST NOT** daxil olmaq. |
| RB-AP-ID-08 | Sürücülük vəsiqəsi məlumatı (`urn:tamga:id:DrivingLicenceAttestation:1`) **MUST NOT** rəsmi mDL docType-ını və ya namespace-ini istifadə etmək və **MUST** metadata-sında, həmişə açıq olan `not_official_licence` sahəsində, kartında və yoxlama nəticəsində rəsmi sürücülük vəsiqəsini əvəz etmədiyini yazmaq; milli şəxsiyyət nömrəsi, məhdudiyyət və ya sağlamlıq kodu, fotoşəkil və ünvan **MUST NOT** daşınmaq; sənəd nömrəsi yalnız açarlı heşdir. |
| RB-AP-ID-09 | Sürücülük vəsiqəsi məlumatı **MUST** yalnız cüzdandakı aktiv Tamga şəxsiyyət sənədinin təqdimatı əsasında və kartdakı ad ilə doğum tarixi həmin şəxsiyyət sənədi ilə uyğun gəldikdə verilmək; kateqoriyalar oxuna bilmirsə və ya kartın müddəti bitibsə **MUST NOT** verilmək; etibarlılıq müddəti kartın bitmə tarixini və kartın yoxlandığı gündən etibarən bir ili **MUST NOT** keçmək; format yalnız SD-JWT VC-dir. |
| RB-AP-ID-10 | Bağlı şəxsiyyət sənədi ləğv edildikdə, yenidən verildikdə və ya silindikdə sürücülük vəsiqəsi məlumatı **MUST** ləğv edilmək və ya silinmək; bir ölkənin səlahiyyətli orqanı rəqəmsal sürücülük vəsiqəsi verməyə başladıqda həmin ölkə üçün bu növ **MUST NOT** yenidən verilmək. |
| RB-AP-ID-11 | Sıfır bilik sübutlu təqdimat üçün ZK nüsxəsi **MUST** ayrıca növdə (`urn:tamga:id:ShortLivedIdentityAttestation:1`), ən çoxu 24 saat etibarlı və ləğv siyahısı qeydi olmadan verilmək; yalnız ZK ilə sübut edilə bilən elementləri daşımaq; əsas şəxsiyyət sənədi ləğv edilibsə **MUST NOT** verilmək. Yeniləmə tokeni şəxsi məlumat sahələrini serverdə **MUST NOT** saxlamaq (yalnız xidmətin aça biləcəyi formada tokenin içində). |
| RB-AP-ID-12 | Şəxsiyyət sənədi provayderi sənəd verərkən gördüyü WIA-nın ləğv siyahısı qeydini sənəd qeydində saxlayır, cüzdan provayderinin WIA siyahısını ən azı gündə bir dəfə yoxlayır və cüzdan vahidi ləğv edilibsə həmin qeydə bağlı bütün nüsxələri **MUST** ən gec 24 saat ərzində ləğv etmək (Aİ WURevocation_18). Bu qeyd sənəd qeydi ləğv edildikdə və ya müddəti bitdikdə silinir. |
| RB-AP-ID-13 | Şəxsiyyət xidməti öz növlərindəki sənədləri **MUST NOT** müvəqqəti dayandırmaq: status yalnız etibarlı və ya ləğv edilmiş olur, ləğv qətidir və bu növlərin ləğv siyahıları `bits = 1` ilə dərc edilir (Aİ PID qaydası, İcra Reqlamenti (Aİ) 2024/2979, Əlavə II; [[ADR-0048]] K1; paketlər 0.6.0). |

---

# 5. RB-AS — Səlahiyyətli mənbə

| # | Qayda |
|---|---|
| RB-AS-01 | Səlahiyyətli mənbə sənədi verən qurumun müqaviləsində adlandırılır və məlumatların emalı müqaviləsi ilə bağlanır. |
| RB-AS-02 | Mənbə məlumatlarının sxemə uyğunlaşdırılması (ISCED-F, EQF və s.) sənədləşdirilir; qarşılığı olmayan qeyd üçün sənəd verilmir. |
| RB-AS-03 | Milli şəxsiyyət nömrəsi şəbəkə səviyyəsindəki ümumi sxemlərin heç birinə ötürülmür. |
| RB-AS-04 | Pilot mənbə qurumun əməkdaşlarına müntəzəm yeni iş yükü yaratmır (**SHOULD**). |

---

# 6. RB-WP — Cüzdan provayderi

| # | Qayda |
|---|---|
| RB-WP-01 | Sənəd sahibinin açarları **MUST** cihazın təhlükəsiz zonasında (W2) və ya sertifikatlaşdırılmış təhlükəsiz aparat təminatında (W3) yaradılmaq; ixrac edilə bilməz; toxumdan törədilmir. Proqram açarlı (W1) cüzdana **MUST NOT** sənəd verilmək. |
| RB-WP-02 | Cüzdan nümunəsi sübutu (WIA) **MUST** cüzdan versiyasını, açarın aparat təminatında olduğunu və PIN və ya biometrikanın aktiv olduğunu bəyan etmək; cüzdan provayderinin açarı `wallet_providers[]` siyahısındadır. |
| RB-WP-03 | Hər təqdimat **MUST** PIN və ya biometrik təsdiq tələb etmək. |
| RB-WP-04 | Təsdiq ekranı tələb olunan sahələri **bir-bir** göstərir; yoxlayan tərəfin əhatə dairəsini aşan və ya həddindən artıq tələblərdə ayrıca vizual blok və gecikdirilmiş düymə **MUST**. |
| RB-WP-05 | Bir yoxlayan tərəfə həmişə eyni nüsxə, fərqli yoxlayan tərəfə fərqli nüsxə göstərilir; eyni yoxlayan tərəf və eyni növ üçün açılan sahələr ardıcıldır. |
| RB-WP-06 | Təqdimat jurnalı cihazda qalır; server ehtiyat nüsxəsinə daxil olmur, serverə göndərilmir. Yalnız şəxs özü onu öz parolu ilə şifrələnmiş fayl kimi ixrac edə bilər (Aİ TS10). |
| RB-WP-07 | Ehtiyat nüsxə yalnız sənədləri və onların siyahılarını daşıyır, açarları daşımır; cihaz dəyişdirildikdə sənədlər yenidən verilir. Cüzdan provayderi **MUST NOT** istifadəçi adından bərpa açarı saxlamaq. |
| RB-WP-08 | Sxemlər toplu şəkildə yüklənir; təqdimat zamanı sxem serverinə sorğu **MUST NOT**. İstifadəçi əməliyyatı olmadan sənədin yenilənməsi yalnız [[ADR-0023]] şərtləri ilə həyata keçirilir. |
| RB-WP-09 | Cüzdan yoxlayan tərəfin müştəri identifikatorunu etibar mənbəyində həll etməyə çalışır; `presentation_definition` rədd edilir; şifrələnməmiş cavab rejimi istifadə edilmir; `origin` prefiksi müştəri identifikatoru kimi qəbul edilmir. |
| RB-WP-10 | Cüzdan **MUST** "açarlarım haradadır" izahını və etibar siyahısındakı qeydini göstərən "Tamga Network-da siyahıya alınıb" göstəricisini (RB-WP-18) təqdim etmək. |
| RB-WP-11 | Cüzdan həllində boşluq aşkar edilərsə, cüzdan provayderi **MUST** versiya üzrə cüzdan sübutlarını ləğv edə bilmək; tək bir cüzdan vahidinin pozulması halında həmin vahidi ləğv edir. |
| RB-WP-12 | İstifadəçiyə "etibarsız" ilə "yoxlanıla bilmədi / köhnəlib" fərqli göstərilir; istifadə edilmiş təklif üçün aydın mətn göstərilir. |
| RB-WP-13 | [[t:intermediary|Vasitəçi]] yoxlayan tərəf vasitəsilə gələn sorğuda cüzdan **MUST** əsl yoxlayan tərəfin qeydiyyatdakı adını göstərmək, əhatə dairəsini onun qeydiyyatına əsasən yoxlamaq və yoxlayan tərəf üzrə nüsxəni əsl yoxlayan tərəfə görə ayırmaq. |
| RB-WP-14 | Cüzdan sənədi verən qurumun paylaşım qaydasını (daxili açıqlama siyasəti) sənədi alarkən **MUST** saxlamaq və təqdimat zamanı şəbəkə sorğusu etmədən yoxlayan tərəfin qeydiyyat və giriş sertifikatı ilə qiymətləndirmək; qayda ödənmirsə və ya qiymətləndirilə bilmirsə, təsdiq ekranında ayrıca xəbərdarlıq **MUST** göstərmək, standart seçim paylaşmamaqdır; son qərar şəxsə məxsusdur. |
| RB-WP-15 | Cüzdan provayderi şəxsin telefonu əlində olmadan cüzdan vahidini ləğv edə biləcəyi bir yol **MUST** təqdim etmək; bu yol istifadəçi hesabı **MUST NOT** tələb etmək (məs. aktivləşdirmə zamanı bir dəfə göstərilən, provayderdə yalnız yavaş heşi saxlanılan ləğv sirri; [[ADR-0047]] K3). |
| RB-WP-16 | Cüzdan provayderi şəxsin cüzdan vahidinin ləğv edildiyini cüzdandan kənarda öyrənə biləcəyi ən azı bir yol **MUST** təqdim etmək; vahidi öz qərarı ilə ləğv edibsə, bu yol ən gec 24 saat ərzində ləğvin səbəbini, nəyin işləməyə davam etdiyini və şəxsin nə edə biləcəyini göstərir (Aİ WURevocation_14/16; [[ADR-0047]] K4). |
| RB-WP-17 | W3 səviyyəsində cüzdan provayderi vahidi aktivləşdirərkən və W3 bəyan edən hər açar sübutundan əvvəl platformanın cihaz sübutunu (Apple App Attest, Android açar sübutu, Play Integrity) **MUST** yoxlamaq; W2-də cihaz sübutu könüllüdür (**MAY**) ([[ADR-0047]] K5). |
| RB-WP-18 | Etibar siyahısındakı cüzdan "Tamga Network-da siyahıya alınıb" / "Listed on Tamga Network" göstəricisini yalnız mətn kimi göstərir; loqo, Aİ ulduzları və rəngləri, "etibar nişanı" və ya "trust mark" ifadəsi **MUST NOT** istifadə edilmək. Göstəriciyə toxunduqda imzası yoxlanılmış siyahıdakı `wallet_providers[]` qeydi göstərilir. Cüzdan vahidi ləğv edilibsə, provayder və ya həll qeydi `ACTIVE` deyilsə, siyahı yoxlanıla bilmirsə və ya cüzdan yalnız sandbox siyahısına bağlıdırsa, göstərici **MUST** gizlədilmək ([[ADR-0049]]). |
| RB-WP-19 | Qeydiyyat sertifikatı daşımayan sorğu **MUST** rədd edilmək; cüzdan şəxsdən soruşmadan dayanır (cüzdandan cüzdana yaxın məsafə istisna olmaqla). Yaxın məsafədə qeydiyyat sertifikatı `euWrprc` ilə gəlir və eyni yoxlamalardan keçir ([[ADR-0026]] K5; [[ADR-0056]] K10, 2026-10-19; paketlər 0.7.0). |

---

# 7. RB-RP — Yoxlayan tərəf (relying party)

| # | Qayda |
|---|---|
| RB-RP-01 | Yoxlayan tərəf **MUST** qeydiyyatdan keçmiş olmalıdır (`relying_parties[]`), giriş sertifikatındakı domen adı ilə (`dns_name`); sorğularda `client_id = x509_hash:` (HAIP 1.0 §5); öz əhatə dairəsindən kənar sahəni **MUST NOT** tələb etməməlidir. |
| RB-RP-02 | Sorğu obyekti **MUST** imzalı olmalıdır; yalnız DCQL sorğu dili istifadə olunur; cavab `direct_post.jwt` (şifrələnmiş) ilə gəlir; birdəfəlik dəyər (`nonce`) unikaldır; bir sorğuda ən çox 3 rəqəmsal sənəd və 2 sənəd toplusu tələb olunur. |
| RB-RP-03 | Yoxlama **MUST** spesifikasiyadakı kanonik yoxlama ardıcıllığı ilə aparılmalıdır (etibar mənbəyinin aktuallığı, ardınca A–E addımları: imza, sənədi verən qurum, sənəd növü səlahiyyəti, ləğv, rəqəmsal cüzdan bağlılığı). Sənəd növü səlahiyyətinin yoxlanılması heç bir konfiqurasiya ilə ötürülə bilməz; sənədi verən qurum və növ səlahiyyəti yoxlamaları sənədin verildiyi tarixə (`iat`) əsaslanır. |
| RB-RP-04 | `issuer_id` `x5c` son (leaf) sertifikatın barmaq izindən törədilir, `iss` sahəsindən deyil. |
| RB-RP-05 | Nəticə üç qiymətlidir; `INDETERMINATE` **MUST NOT** `REJECTED` kimi emal edilməməlidir; nəticə obyekti aparılmış və ötürülmüş yoxlamaları (`checks_performed`, `checks_skipped`) daşıyır. |
| RB-RP-06 | Yoxlayan tərəf hər yoxlamada ləğv siyahısını yükləmir; siyahıları əvvəlcədən toplu şəkildə yükləyir; `exp` və `ttl` HTTP keşindən üstündür. |
| RB-RP-07 | Yoxlayan tərəf öz siyahı indeksatorunu və ya etibar mənbəyi keşini işlədir; Tamga-dan hostinq edilən indeksləmə xidməti gözləmir. |
| RB-RP-08 | Nəticə obyekti və loglar sahə dəyərini və ləğv siyahısının yerini daşımır; audit qeydi rədd edilmiş yoxlamalarda da aparılır; HTTP status kodu nəticəni kodlaşdırmır. |
| RB-RP-09 | Siyasət "sənəd növü × sənədi verən qurumun sinfi" kimi ifadə olunur; yoxlayan tərəf ayrıca sənəd sahibi təminat sahəsi gözləmir; yüksək riskli əməliyyatda əlavə şəxsiyyət yoxlaması yoxlayan tərəfin məsuliyyətidir. |
| RB-RP-10 | İmtina səbəbi yoxlayan tərəfə ötürülmür (rəqəmsal cüzdan tərəfi); yoxlayan tərəf "yoxlanıla bilmədi" vəziyyətində istifadəçini günahlandıran ifadəni **SHOULD NOT** işlətməməlidir. |
| RB-RP-11 | Üz uyğunlaşdırması tələb olunarsa, yoxlayan tərəf bunu şəxsiyyət sənədi və ya PID ilə edir; diplom və tələbə sənədi foto daşımır. |
| RB-RP-12 | Hostinq edilən yoxlama xidmətindən istifadə edən yoxlayan tərəf təqdimatı **MUST** öz serverindən, etibar siyahısındakı açarı ilə imzalanmış bəyanatla açmalı və dəyərləri öz serverində oxumalıdır; səhifə yalnız statusu görür. |
| RB-RP-13 | Veb sayta giriş ("Tamga ilə daxil ol") hesab açarı kimi **MUST** hər sayt üçün ayrıca psevdonimdən istifadə etməlidir; sayt siyasətləri sənəd həşini və ya şəxsiyyət nömrəsini **MUST NOT** tələb etməməlidir; psevdonim imza, `aud` və `nonce`, sayt və ləğv edilməmiş rəqəmsal cüzdan nümunəsi (WIA) ilə yoxlanılır. Birdən çox psevdonim yalnız qeydiyyatında `pseudonyms: "multiple"` olan saytda istifadə olunur. |
| RB-RP-14 | Yoxlayan tərəf, istifadə üçün qeydiyyat sertifikatı varsa, hər sorğuda həmin istifadənin **yeganə** qeydiyyat sertifikatını `verifier_info` daxilində `{"format": "registration_cert", "data": "<jwt>"}` kimi **MUST** göndərməlidir; `credential_ids` və `registrar_dataset` istifadə olunmur ([[ADR-0026]] 2026-10-13 dəyişikliyi). |
| RB-RP-ID-01 | Şəxsiyyət sənədini öz qeydləri ilə uyğunlaşdırmaq üçün onu qəbul edən qurum (sənəd vermə xidməti daxil olmaqla) sənədi **MUST** yalnız qeydiyyatdan keçmiş yoxlayan tərəfin əhatə dairəsindəki sahələrlə və tam yoxlama ardıcıllığından keçirərək almalıdır; uyğunlaşdırma açarlarını **MUST NOT** saxlamamalı və ya loglamamalıdır. |

---

# 8. RB-H — Sənəd sahibi (şəxs): hüquqlar və öhdəliklər

| # | Qayda |
|---|---|
| RB-H-01 | İştirak könüllüdür; razılıq istənilən vaxt geri götürülə bilər və bu halda rəqəmsal sənəd ləğv edilir. |
| RB-H-02 | Şəxs hər təqdimatda hansı sahələrin tələb olunduğunu görür və onları bir-bir təsdiqləyir; əhatə dairəsindən kənar tələb olduqda xəbərdar edilir. |
| RB-H-03 | Şəxs cihazındakı təqdimat jurnalını görə və parolla qorunan fayl kimi ixrac edə bilər; jurnal cihazdan başqa yolla çıxmır. |
| RB-H-04 | Şəxs PIN, biometrika və cihaz təhlükəsizliyinə görə məsuliyyət daşıyır; cihaz itdikdə rəqəmsal sənədlər yenidən alınır, açar bərpa edilmir. |
| RB-H-05 | Şəxsin "sənədiniz rəqəmsal cüzdana əlavə edildi" bildirişinə etiraz etmək hüququ var; etiraz olduqda sənədi verən qurum sənədi ləğv edir və yenidən verir. |
| RB-H-06 | Şəxsin qlobal identifikatoru yoxdur; yoxlayan tərəflər təqdimatları birləşdirə bilməz (hər yoxlayan tərəf üçün ayrıca nüsxə). Sənədi verən qurum tərəfində birləşdirilə bilmə qalıq risk kimi yazılı şəkildə bildirilir. |
| RB-H-07 | Şikayət yolu: sənədi verən qurum → sxem sahibi → KVKK Qurumu. Rəqəmsal cüzdan bu yolu şəxsə **SHOULD** göstərməlidir. |

---

# 9. RB-SCH — Növlər və sxemlər

| # | Qayda |
|---|---|
| RB-SCH-01 | Növ identifikatoru `vct = urn:tamga:<alan>:<Tür>:<ana sürüm>`; `vct#integrity` **MUST**; növ təsviri (Type Metadata) katalogdan gəlir; reyestr mərhələsində sxem identifikatoru `schema_id = keccak256(vct)` kimi hesablanır. |
| RB-SCH-02 | Dərc edilmiş növ təsviri və ya JSON Schema **MUST NOT** dəyişməməlidir; minor və patch versiya yeni `metadata_url` və həş, major versiya isə yeni URN deməkdir. |
| RB-SCH-03 | Şəbəkə səviyyəsindəki hər ümumi sxem ən azı `tr-TR` və `en-US` göstərmə məlumatı daşıyır; `additionalProperties: false`; fərdi məlumat sahəsi `sd: never` ola bilməz. |
| RB-SCH-04 | Şəbəkə səviyyəsindəki heç bir ümumi sxem milli şəxsiyyət nömrəsi sahəsini ehtiva edə bilməz. |
| RB-SCH-05 | Yeni sahə yeddi şərtli yoxlama siyahısı (SG1–SG7) tamamlanmadan açılmır; hər növ üçün bir rulebook (məs. Education Rulebook) dərc edilir. |
| RB-SCH-06 | `DEPRECATED` statusundakı sxem yoxlanıla bilən qalır; istifadədən çıxarma qərarı aqreqat statistika əsasında verilir (ən azı 50-lik qruplar). |
| RB-SCH-07 | `extends` zənciri dövrsüzdür və ən çox 5 səviyyəlidir; kök növdən başqa `extends#integrity` məcburidir. |

---

# 10. RB-ENF — Uyğunluq və sanksiyalar

| # | Qayda |
|---|---|
| RB-ENF-01 | Uyğunluq vektorları və öhdəlik testləri dərcdən əvvəl məcburidir; testdən keçməyən komponent istehsala buraxılmır. |
| RB-ENF-02 | Sanksiya pilləkəni: xəbərdarlıq → səlahiyyətin daraldılması → fəaliyyətin dayandırılması → çıxarılma (varis təyin edilməklə) → xitam. Çıxarılma köhnə rəqəmsal sənədləri etibarsız etmir. |
| RB-ENF-03 | Pilotda dayandırma şərti yaranarsa, pilot dayandırılır; "izləyib görək" yanaşması yoxdur. Fərdi məlumatların ortaq reyestrə yazılması dərhal dayandırma səbəbidir. |
| RB-ENF-04 | Bu qaydalardan hər bir kənarlaşma operatorun kənarlaşma reyestrində əsaslandırması və bağlanma tarixi ilə qeyd edilir; qeydə alınmamış kənarlaşma pozuntudur. |
| RB-ENF-05 | Bu Rulebook-un hər hansı bəndi mənbə sənədlə ziddiyyət təşkil edərsə, mənbə qüvvədə qalır və Rulebook düzəldilir. |

---

# 11. Aİ Attestation Rulebook şablonu və ARF Topic 12

Sənəd növü rulebook-ları Aİ Attestation Rulebook şablonunun (versiya 1.5, 2026-07-08) bölmə strukturuna əsaslanır: 1 Giriş · 2 Atributlar
və metaməlumatlar (məcburi, ixtiyari, şərti) · 3 Kodlaşdırma (ISO/IEC 18013-5, SD-JWT VC, W3C VCDM) · 4 İstifadə · 5 Etibar ankerləri ·
6 Ləğv (Tamga-da "Etibarlılıq və ləğv") · 7 Uyğunluq · 8 Mənbələr. Tamga-ya xas mövzular (kim verir, şəxsiyyətin təsdiqi, məlumatların qorunması,
yoxlama siyasətləri) Bölmə 4-dədir. ARF Annex 2 Topic 12-nin qeyri-kvalifikasiyalı EAA-ya tətbiq olunan tələbləri aşağıdakı kimi qarşılanır:

| ARF | Tələb | Rulebook-da |
|---|---|---|
| ARB_01a, ARB_01b | Ümumi formatlardan biri; SD-JWT VC-də HAIP profili | §3.2 (bütün növlər SD-JWT VC), §3.1 (şəxsiyyət sənədi əlavə olaraq mdoc) |
| ARB_02 | Yaxın məsafədə internetsiz təqdimat tələb olunurmu — təhlil | §3.1 |
| ARB_05 | Növün şəbəkədə yeganə identifikatoru | `vct` URN (RB-SCH-01); mdoc docType eyni dəyərdir |
| ARB_06, ARB_06a, ARB_06b | Bütün atributların formatdan asılı olmayan təsviri; mdoc ad sahəsi (namespace); claim adının IANA, ümumi və ya növə xas ad olması | §2, §3 |
| ARB_07, ARB_08 | Mövcud atributlardan və adlandırma ənənələrindən istifadə | Aİ PID adları ([[ADR-0045]]), OpenID Connect, ISO/IEC 18013-5, ELM |
| ARB_09 | Hər atributun məcburi, ixtiyari və ya şərti olması | §2.2–§2.7 |
| ARB_12, ARB_25 | Hüquqi kateqoriya göstəricisi (`category`; ARF mətnində `attestation_legal_category`) | §2.1 — yalnız kvalifikasiyalı və ya dövlət sinfində, Tamga dəyərləri ilə (RB-AP-14). Qeyri-kvalifikasiyalı EAA-da `category` yazılmır; şablonun `eaa:eu:non-qualified` dəyəri istifadə olunmur, çünki ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01 bu rəqəmsal sənəddə `category` olmamasını tələb edir ([[ADR-0047]] K6) |
| ARB_15, ARB_17, ARB_19, ARB_21 | eIDAS 2.0 Əlavə V b, c, e, h qarşılıqları | §2.0. Əlavə V h (etibar ankerinin yeri) üçün rəqəmsal sənədə sahə əlavə edilmir: yer sənədi verən qurumun `x5c` zənciri və etibar siyahılarıdır; etibar ankerlərinin yeganə mənbəyi siyahılardır ([[ADR-0047]] K7) |
| ARB_22 | Qarşılıqlı uyğunluq, təhlükəsizlik və məxfilik üçün lazım olan texniki təfərrüat | Rulebook və onun əsaslandığı spesifikasiyalar (Əlavə E) |
| ARB_24, ARB_24a | Növ ləğv edilə bilərmi, mexanizm, siyahı ünvanı | §6 və [[FW-POL-0001]] |
| ARB_26 | Yoxlayan tərəfin etibar ankerini necə əldə etdiyi | §5 |
| ARB_29 | Rulebook-un Aİ şablonunun strukturuna əsaslanması | Bütün sənəd növü rulebook-ları |
| ARB_30, ARB_31 | Hər claim üçün seçici paylaşım qaydası; Type Metadata | §3.2; növ təsviri katalogdadır (RB-SCH-01) |
| ARB_34 | Cihaza bağlıdırmı | §4 — bütün növlər cihaza bağlıdır |

Kvalifikasiyalı və ya dövlət EAA-sına və Aİ kataloquna xas tələblər (ARB_01, ARB_11, ARB_13, ARB_14, ARB_16, ARB_18, ARB_20, ARB_23, ARB_33)
Tamga rəqəmsal sənədlərinə tətbiq edilmir. İxtiyari tələblərdən ARB_10 (növə xas mdoc ad sahəsi) şəxsiyyət sənədində istifadə olunur (`tamga.id.1`);
ARB_03 və ARB_04 (W3C VCDM), həmçinin ARB_28 (`cryptographically_bound_to`) istifadə olunmur.

---

# Cədvəl — Qaydalar və rolların xülasəsi

| Mövzu | OP | REG | AP | AS | WP | RP | H |
|---|---|---|---|---|---|---|---|
| Fərdi məlumatlar yoxdur (ümumi reyestr və loglar) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Etibar məlumatlarının spesifikasiyaya uyğun oxunması | ✓ | — | ✓ | — | ✓ | ✓ | — |
| Açarların ayrılması və nəzarəti | ✓ | — | ✓ | — | ✓ | — | ✓ (cihaz) |
| Dərc intervalı (siyahı, lövbər, ləğv siyahısı) | ✓ | — | ✓ | — | — | — | — |
| Şəxsiyyətin yoxlanılması səviyyəsi | — | — | ✓ | — | — | (əlavə nəzarət) | — |
| Əhatə dairəsi və məlumatların minimallaşdırılması | — | ✓ | — | — | ✓ (xəbərdarlıq) | ✓ | ✓ (razılıq) |
| Üçqiymətli nəticə | — | — | — | — | ✓ | ✓ | — |
| Şəffaflıq və hədd xəbərdarlıqları | ✓ | — | — | — | — | — | — |

# Mənbələr

Bu sənədin əsaslandığı qərarlar, spesifikasiyalar və standartlar Əlavə E-də sadalanır.

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
