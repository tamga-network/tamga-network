---
document_id: ADR-0089
title: "Şəxsiyyət sənədi: standart mdoc konfiqurasiyası, nüsxələrin müntəzəm yenilənməsi, cüzdan təminatçısının dayandırılması"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-16
last_updated: 2026-11-16
summary: >
  Şəxsiyyət xidmətinin şəxsiyyət sənədi üçün üç dəyişiklik. (1) Sənədin mdoc nüsxəsi artıq metadata-da elan edilən ayrıca
  `mso_mdoc` konfiqurasiyası ilə, standart sənəd sorğusundan verilir; bir icazə və bir giriş tokeni hər iki formatı əhatə edir,
  sənəd cavabındakı qeyri-standart `mso_mdoc` sahəsi götürülür. (2) Məntiqi sənəd ilə texniki nüsxə ayrılır: qeydin bitməsi inzibati
  etibarlılıqdır və hər nüsxədə `date_of_expiry` kimi daşınır; nüsxələrin texniki etibarlılığı ən çox 30 gündür və cüzdan nüsxələri
  səssiz yeniləyir. Şəxsiyyət xidməti şəxsi sahələri saxlamadığı üçün yeniləmə cüzdanın bu qeydə aid nüsxəni bütün sahələri açıq və
  sahib açarı ilə bağlı təqdim etməsi ilə aparılır; yeniləmə tokeni ZK nüsxəsi tokeninin genişləndirilmiş formasıdır. (3) Şəxsiyyət
  xidməti qeydlərinin bağlı olduğu cüzdan təminatçısının etibar siyahısındakı statusunu müntəzəm yoxlayır: ləğv edilmiş və ya
  siyahıdan çıxmış təminatçının vahidlərinə verilən qeydləri ləğv edir, dayandırılmış təminatçınınkıları dayandırır (yeniləmə
  dayanır; dayandırma götürüləndə davam edir); "siyahı oxunmur" ilə "təminatçı dayandırılıb" ayrıdır. Qəbul: 2026-11-16.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0023]]", "[[ADR-0029]]", "[[ADR-0044]]", "[[ADR-0045]]", "[[ADR-0047]]", "[[ADR-0048]]", "[[ADR-0059]]", "[[ADR-0060]]", "[[ADR-0062]]", "[[ADR-0064]]", "[[SPEC-PROTO-0001]]", "[[SPEC-ID-0003]]", "[[SPEC-WALLET-0001]]", "[[FW-RB-0003]]"]
translation_of: ADR-0089
source_version: 1.0.0
---

# Qısaca

İndiyədək şəxsiyyət sənədinin iki formatı (SD-JWT VC və mdoc) tək sorğunun cavabında, qeyri-standart sahə ilə verilirdi; Tamga Wallet
hər ikisini alırdı, başqa cüzdan isə yalnız SD-JWT-ni ala bilirdi. Nüsxələr 2 il etibarlı idi və yenilənmirdi: on yoxlayıcıdan sonra
cüzdan eyni nüsxəni başqa yoxlayıcılara da göstərməli olurdu. Bu qərarla mdoc nüsxəsi standart yolla istənilir, nüsxələr ən çox 30 gün
etibarlı olur və cüzdan onları özü yeniləyir; şəxsiyyət xidməti isə cüzdan təminatçısı siyahıda dayandırılanda və ya ləğv ediləndə
həmin təminatçının vahidlərindəki sənədlər üçün lazımi addımı atır.

# Kontekst

- **Qeyri-standart sahə (R41).** OpenID4VCI 1.0 §8.3 `credentials[]` obyektində yalnız `credential`-ı müəyyən edir. Şəxsiyyət xidməti
  mdoc-u hər obyektə əlavə `mso_mdoc` sahəsi ilə qoyurdu ([[ADR-0013]], [[SPEC-PROTO-0001]] PR16); metadata-da şəxsiyyət üçün `mso_mdoc`
  konfiqurasiyası yox idi (yalnız ZK nüsxəsi üçün). Səbəb şəxsi sahələrin ilk verilişdən dərhal sonra silinməsi idi. [[ADR-0059]]-dan
  bəri giriş tokeninin ömrü ərzində bir neçə sənəd sorğusu edilə bildiyi üçün bu səbəb aradan qalxdı. OpenID4VCI 1.0 §12.2.4 eyni
  `scope` dəyərinin bir neçə konfiqurasiyada istifadəsinə icazə verir; Aİ-də PID iki formatda, iki ayrı konfiqurasiya ilə verilir.
- **Məntiqi və texniki sənəd (ARF 3.0 §5.3, §6.6.6.2; PID Qaydalar Kitabı).** Bir məntiqi sənəd bir neçə texniki nüsxə ilə təmsil
  olunur; nüsxələrin texniki etibarlılığı qısadır (günlər, həftələr) və məntiqi sənədin ömrü boyu müntəzəm yenidən verilir; inzibati
  etibarlılıq ayrıca atributdur (PID `date_of_expiry` / mdoc `expiry_date`). Bizdə nüsxələr 730 gün etibarlı idi, inzibati və texniki
  müddət eyni idi və şəxsiyyət sənədi yenilənmirdi (yalnız 24 saatlıq ZK nüsxələri, [[ADR-0044]]). 10 nüsxə bitəndə cüzdan ən az
  istifadə olunan nüsxəni xəbərdarlıqla yenidən istifadə edirdi, bu da yoxlayıcıların şəxsi əlaqələndirə bilməsi deməkdir.
- **Şəxsi sahələr saxlanmır.** Şəxsiyyət xidməti verilişdən sonra şəxsi sahələri saxlamır ([[ADR-0011]] K4, IDP9). Buna görə
  [[ADR-0023]] AR4 şəxsiyyət sənədinin səssiz yenilənməsini kənarda qoymuşdu. Sahələrin yeganə mənbəyi cüzdandakı, xidmətin öz
  imzasını daşıyan nüsxədir.
- **Cüzdan təminatçısı etibarsız olanda (ARF 6.6.2.5-c, CIR 2024/2977).** PID təminatçısı cüzdan təminatçısının siyahıda
  dayandırılıb-dayandırılmadığını da müntəzəm yoxlayır. Bu gün təminatçı `ACTIVE` deyilsə, açarı etibarsız sayılır, ləğv siyahısı
  yoxlanıla bilmir və nəticə "naməlum" olur: heç nə dəyişmirdi.
- **Layihə rəhbərliyinin istiqaməti (2026-11-16, ARF 3.0.0 oxu qərarları):** şəxsiyyət sənədinin mdoc nüsxəsinin standart yolu və
  şəxsiyyət nüsxələrinin müntəzəm yenilənməsi indi; dayandırma Aİ-dəki kimi və geri qaytarıla bilən.

# Qərar

## K1 — mdoc nüsxəsi standart konfiqurasiya ilə

- Şəxsiyyət xidmətinin metadata-sı şəxsiyyət sənədi üçün ikinci konfiqurasiya elan edir: `format: mso_mdoc`, `doctype` və ad sahəsi
  dəyişmir ([[ADR-0013]] K2: `urn:tamga:id:IdentityAttestation:1`, `tamga.id.1`), `scope` SD-JWT konfiqurasiyasınınkı ilə eynidir
  (`urn:tamga:id:IdentityAttestation:1`). Konfiqurasiya identifikatoru `urn:tamga:id:IdentityAttestation:1:mso_mdoc` (kodda tək sabit;
  ictimai ad təsdiq gözləyir, dəyişsə yalnız sabit dəyişir).
- Bir icazə hər iki formatı əhatə edir. Cüzdan eyni giriş tokeni ilə iki standart sənəd sorğusu edir ([[ADR-0059]]); ardıcıllıq
  sərbəstdir. mdoc cavabı standartdır: `credentials[i].credential` = base64url IssuerSigned.
- Nüsxə haqqı konfiqurasiya üzrədir: bir tokenlə hər formatda ən çox 10 nüsxə ([[ADR-0059]] AT2 konfiqurasiya üzrə oxunur).
- Hər iki formatın nüsxələri eyni qeydə daxil olur (eyni ləğv izləməsi), `iat`/`exp` eynidir ([[ADR-0013]] MD1). Eyni tokenlə eyni açara
  verilən iki formatın nüsxəsi eyni ləğv indeksini daşıyır; uyğunlaşdırma yalnız tokenin ömrü ərzində, yaddaşda aparılır, açar barmaq
  izi daimi yazılmır (ISSU_35b). Başqa açarla istənilən nüsxə yeni indeks alır.
- [[ADR-0013]] MD2 ("mdoc `deviceKey` = SD-JWT `cnf`") cüzdan qaydasına çevrilir: Tamga Wallet mdoc sorğusunda SD-JWT nüsxələrinin
  açarlarını eyni ardıcıllıqla istifadə edir; xidmət açar saxlamadığı üçün bunu məcbur etmir.
- Sənəd cavabındakı qeyri-standart `mso_mdoc` sahəsi götürülür ([[SPEC-PROTO-0001]] PR16). İnkişaf mərhələsi olduğu üçün keçid yolu
  yazılmır ([[ADR-0029]]).
- Şəxsi sahələr hər iki konfiqurasiyanın nüsxə haqqı bitəndə və ya tokenin ömrü bitəndə silinir ([[ADR-0059]] AT5).

## K2 — Məntiqi sənəd və texniki nüsxə: inzibati və texniki etibarlılıq

- Şəxsiyyət xidmətindəki qeyd məntiqi sənəddir. Qeydin bitməsi **inzibati etibarlılıqdır**: bugünkü qayda olduğu kimi qalır (730 gün,
  WIA və KA ləğv saxlama müddəti ilə məhdud — [[ADR-0047]] K1, ISSU_12c).
- İnzibati bitmə hər nüsxədə ayrıca atribut kimi daşınır: SD-JWT `date_of_expiry`, mdoc `expiry_date` (Aİ PID adları, `full-date`;
  dəyər qeydin bitməsinin UTC günüdür), seçici açıqlanandır (`sd: always`). Şəxsiyyət sxeminə isteğe bağlı atribut kimi əlavə edilir.
- Hər nüsxənin **texniki etibarlılığı** (`exp` / `validUntil`) ən çox 30 gündür (parametr `TAMGA_ID_COPY_TTL_DAYS`, standart 30;
  inzibati müddəti keçə bilməz) və qeydin bitməsini keçmir. Zaman sahələri bu gün olduğu kimi saata yuvarlaqlaşdırılır.
- Əhatə: yalnız yeniləmə tokeni ilə verilən şəxsiyyət sənədi. Mağaza yoxlamasının DEMO sənədi ([[ADR-0033]]), əlaqə sənədləri və
  sürücülük vəsiqəsi məlumatı yenilənmir; onların nüsxələri bu gün olduğu kimi inzibati müddət qədər etibarlıdır.
- 30 gün ARF-nin "qısa texniki etibarlılıq" prinsipi ilə iki reallıq arasında tarazlıqdır: telefonu bir müddət şəbəkəyə qoşulmayan
  şəxs və hər yeniləmənin ləğv siyahısında yeni indeks sərf etməsi. 24 saat yalnız ZK nüsxəsi üçündür (ləğv siyahısı olmadan,
  [[ADR-0044]]).

## K3 — Yeniləmə yolu (şəxsi sahələr saxlanmadan)

- Şəxsiyyət sənədi veriləndə token cavabı həmişə yeniləmə tokeni daşıyır (yalnız ZK nüsxəsi əhatəsi istənəndə deyil — [[ADR-0062]] ZS1
  genişlənir). Token [[ADR-0044]]-dəki formadadır: yalnız şəxsiyyət xidmətinin aça biləcəyi şifrəli məzmun (bağlı qeyd, nəsil, müştəri
  nümunəsi açarı — [[ADR-0060]], bitmə, verilən əhatələr, ZK nüsxəsinin minimal elementləri), birdəfəlik və hər istifadədə dəyişir.
  Şəxsi sahələr tokenə daxil olmur.
- Yeniləmə sorğusu: `grant_type=refresh_token` + DPoP + eyni müştəri nümunəsi açarına verilmiş etibarlı WIA + `identity_presentation`
  (cüzdandakı bu qeydə aid nüsxənin **bütün sahələri açıq** təqdimatı: SD-JWT VC + KB-JWT, `aud` = şəxsiyyət xidməti, `nonce` = xidmətin
  `/nonce` ucundan, birdəfəlik). Parametr adı mövcuddur ([[ADR-0039]]).
- Şəxsiyyət xidməti ardıcıllıqla yoxlayır: token (açılır, müddəti bitməyib, nümunə açarı eynidir, nəsil etibarlıdır); təqdimat (öz
  imzası, KB-JWT və sahib açarı, növ, ləğv siyahısı ünvanı, indeks bu qeydə aiddir, açılmamış sahə yoxdur); qeyd (mövcuddur, ləğv
  edilməyib, inzibati müddəti bitməyib, bütün ləğv bitləri 0, təminatçısı dayandırılmayıb — K5). Yeni nüsxələrin açarları credential
  ucunda yeni açar sübutu (KA) ilə bu gün olduğu kimi yoxlanılır.
- Texniki müddəti bitmiş nüsxə yeniləmədə qəbul edilir (qeyd inzibati olaraq etibarlıdırsa): telefonu bir aydan çox şəbəkəyə qoşulmayan
  şəxs yenidən şəxsiyyət yoxlaması etmədən sənədini yeniləyir. Sahib açarı və WIA bu halda da şərtdir.
- Yeni nüsxələrin sahələri təqdim edilən nüsxədəki ilə eynidir; yeganə fərq: yaş atributları (`age_over_18`, `age_over_15`,
  [[ADR-0064]]) yeniləmə anında doğum tarixindən yenidən hesablanır, `date_of_expiry` qeyddən yazılır. Təqdimatdan oxunan sahələr yalnız
  yeni giriş tokeninin ömrü ərzində yaddaşdadır ([[ADR-0059]] AT5); diskə, jurnala və tokenə yazılmır.
- Yeni nüsxələr eyni qeydə əlavə olunur; köhnə nüsxələr ləğv edilmir, texniki müddətləri bitəndə bitir. Qeydin WIA və KA ləğv
  girişləri ən son verilişdəkilərlə yenilənir (zəncirvari ləğv ən yeni vahid sübutunu izləyir).
- Xəta kodları cüzdanın nə edəcəyini müəyyən edir: token etibarsız, qeyd ləğv edilib və ya müddəti bitib → `invalid_grant` (yeniləmə
  bağı götürülür); qüsurlu təqdimat (nonce, çatışmayan sahə) → `invalid_request` (bağ qalır, cüzdan yenidən cəhd edir); təminatçı
  dayandırılıb → `temporarily_unavailable` (bağ qalır, dayandırma götürüləndə davam edir).
- ZK nüsxəsi eyni tokenlə, yalnız ZK nüsxəsi əhatəsi verilibsə alınır ([[ADR-0062]]); ZK sorğusu təqdimat daşımır.

## K4 — Nə vaxt yenilənir

- Cüzdan xidmətin elan etdiyi nüsxə siyasətinin hədlərində yeniləyir (ETSI TS 119 472-3 `credential_reuse_policy`: istifadə edilməmiş
  nüsxə ≤ 2 və ya texniki bitməyə ≤ 7 gün) — [[ADR-0023]] K1-in şərtləri ilə: istifadəçidən soruşmadan, təsadüfi gecikmə ilə (ən çox
  6 saat, bitmədən əvvəl bitəcək şəkildə), parametr ("nüsxələri avtomatik yenilə") açıq olanda.
- Parametr bağlıdırsa və ya bütün nüsxələrin müddəti bitibsə, cüzdan şəxsə "şəxsiyyət sənədini yenilə" seçimini göstərir; yeniləmə eyni
  yolla şəxsin toxunuşu ilə aparılır.
- Qeyd ləğv edilibsə və ya inzibati müddəti bitibsə, yeniləmə yoxdur; şəxs yenidən şəxsiyyət yoxlaması edir.

## K5 — Cüzdan təminatçısı siyahıda dayandırılıb və ya ləğv edilib

- Şəxsiyyət xidməti hər qeydə verilişdəki WIA-nı imzalayan cüzdan təminatçısının etibar siyahısındakı identifikatorunu yazır (təşkilat
  identifikatoru, şəxsi məlumat deyil); yeniləmədə ən son WIA-nınkı ilə yeniləyir.
- 6 saatlıq vahid yoxlamasında (başlanğıcda da, [[ADR-0047]] K1) hər qeyd üçün əvvəlcə təminatçının imzalı siyahıdakı statusuna baxılır:

  | Siyahı nə deyir | Şəxsiyyət xidməti nə edir |
  |---|---|
  | Siyahı oxunmur və ya köhnədir | Heç nə dəyişmir (naməlum); növbəti dövrdə yenidən baxılır |
  | Təminatçı `ACTIVE` (və ya `ROLLING_OVER`) | Adi WIA və KA yoxlaması; dayandırma işarəsi varsa götürülür |
  | Təminatçı `SUSPENDED` | Qeyd **dayandırılır**: yeni nüsxə, yeniləmə və ZK nüsxəsi verilmir; mövcud nüsxələr texniki müddətləri bitəndə (ən gec 30 gün; ZK nüsxəsi 24 saat) istifadəyə yararsız olur |
  | Təminatçı `REVOKED`, `RETIRED` və ya siyahıda yoxdur | Qeyd **ləğv edilir** (səbəb `wallet-provider-invalid`); bağlı sürücülük vəsiqəsi məlumatı da |
  | Başqa status | Naməlum; heç nə dəyişmir |

- Dayandırma geri qaytarıla biləndir: təminatçı yenidən `ACTIVE` olanda işarə götürülür və yeniləmə özü davam edir; şəxs yenidən
  şəxsiyyət yoxlaması etmir. Şəxsiyyət xidmətinin ləğv siyahısında dayandırma biti yoxdur ([[ADR-0048]]); dayandırma qısa texniki
  etibarlılıq və yeniləmənin dayanması ilə təmin olunur. Şəbəkənin dayandırılmış qurum qərarı ([[ADR-0088]]) ilə eyni prinsip:
  dayandırılmış ikən istifadə olunmur, dayandırma götürüləndə qayıdır.
- Təminatçı identifikatoru olmayan köhnə qeydlər və xarici (federasiya) siyahıdakı təminatçılar bu yoxlamaya daxil deyil; adi WIA/KA
  yoxlaması davam edir.

# Nəzərdən keçirilən seçimlər

| Seçim | Nəticə | Niyə |
|---|---|---|
| mdoc qeyri-standart sahədə qalsın (PR16) | rədd | Başqa cüzdan şəxsiyyətin mdoc-unu ala bilməz; iPhone brauzeri və yaxın sahə yalnız mdoc danışır |
| mdoc üçün ayrıca icazə (ayrıca `scope`) | rədd | Şəxs iki dəfə şəxsiyyət yoxlaması edərdi; Aİ-də PID-in iki formatı bir icazə ilə alınır |
| Nüsxələr 2 il qalsın, əsaslandırma yazılsın | rədd | 10 yoxlayıcıdan sonra nüsxə yenidən istifadə olunur; ARF §5.3-ə ziddir |
| Şəxsi sahələri şifrəli şəkildə yeniləmə tokeninə qoymaq | rədd | Şəxsi sahələrin serverin açarı ilə açıla bilən nüsxəsi cüzdanda gəzərdi; [[ADR-0044]] tokenə yalnız minimal elementləri qoydu. Sahələrin mənbəyi onsuz da cüzdandakı imzalı nüsxədir |
| Şəxsi sahələri şəxsiyyət xidmətində saxlamaq | rədd | [[ADR-0011]] K4, IDP9 |
| Hər yeniləmədə yenidən şəxsiyyət yoxlaması | rədd | Şəxsə ayda bir üz skanı; Aİ-də yenidən vermə istifadəçi əməliyyatı tələb etmir (ISSU_42) |
| 7 günlük nüsxələr | rədd | Ləğv siyahısı indeksləri dörd dəfə sürətlə tükənər |
| Təminatçı dayandırılanda qeydləri dərhal ləğv etmək | rədd | Dayandırma geri qaytarılmaz olardı; şəxs yenidən şəxsiyyət yoxlaması etməli olardı. Ciddi halda təminatçı `REVOKED` edilir |
| Şəxsiyyət siyahısına dayandırma biti (`bits = 2`) | rədd | [[ADR-0048]]: şəxsiyyətdə dayandırma yoxdur (PID qaydası); qısa texniki müddət ləğv siyahısına status əlavə etmədən eyni nəticəni verir |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| IR1 | Şəxsiyyət sənədinin mdoc nüsxəsi metadata-da elan edilən ayrıca `mso_mdoc` konfiqurasiyası ilə standart sənəd sorğusundan verilir; sənəd cavabında qeyri-standart sahə yoxdur; bir icazə hər iki formatı əhatə edir və nüsxə haqqı konfiqurasiya üzrədir. |
| IR2 | Yeniləmə tokeni ilə verilən şəxsiyyət sənədində hər nüsxənin texniki etibarlılığı ən çox 30 gündür və qeydin inzibati bitməsini keçmir; inzibati bitmə hər nüsxədə `date_of_expiry` (mdoc `expiry_date`) kimi daşınır. |
| IR3 | Şəxsiyyət sənədinin yenilənməsi şəxsi sahələri serverdə saxlamadan aparılır: sahələr cüzdanın bu qeydə aid, bütün sahələri açıq və sahib açarı ilə bağlı nüsxə təqdimatından oxunur və yalnız giriş tokeninin ömrü ərzində yaddaşda qalır. |
| IR4 | Yeniləmə yalnız qeyd ləğv edilməyib, inzibati müddəti bitməyib, bütün ləğv bitləri 0 və təminatçısı dayandırılmayıbsa; eyni müştəri nümunəsi açarına verilmiş etibarlı WIA və birdəfəlik, dəyişdirilən yeniləmə tokeni ilə aparılır. |
| IR5 | Yenilənən nüsxədə yaş atributları yeniləmə anında doğum tarixindən yenidən hesablanır; digər şəxsi atributlar təqdim edilən nüsxədəki ilə eynidir. |
| IR6 | Cüzdan təminatçısı etibar siyahısında `REVOKED`, `RETIRED` və ya siyahıda yoxdursa, şəxsiyyət xidməti həmin təminatçının vahidlərinə bağlı qeydləri ləğv edir; `SUSPENDED`-dirsə qeydləri dayandırır (yeni nüsxə, yeniləmə və ZK nüsxəsi yoxdur) və dayandırma götürüləndə yeniləmə davam edir; siyahı oxunmursa heç nə dəyişmir. |
| IR7 | Eyni giriş tokeni ilə eyni açara verilən iki formatın nüsxəsi eyni ləğv indeksini daşıyır; uyğunlaşdırma yalnız tokenin ömrü ərzində yaddaşda aparılır, açar barmaq izi daimi yazılmır. |

# Nəticələr

- Dəyişən qərarlar: [[ADR-0013]] K1 və MD2 (K1), [[ADR-0023]] AR4 və [[ADR-0044]] K3 (şəxsiyyət sənədi artıq təqdimatla yenilənir — şəxsi
  sahələr yenə saxlanmır), [[ADR-0059]] AT2 (konfiqurasiya üzrə), [[ADR-0062]] ZS1 (yeniləmə tokeni hər şəxsiyyət icazəsində). Hər
  birinə "dəyişdi" qeydi.
- Spesifikasiyalar: [[SPEC-PROTO-0001]] (PR16 götürülür; şəxsiyyət mdoc konfiqurasiyası, yeniləmə sorğusu), [[SPEC-ID-0003]] (texniki və
  inzibati etibarlılıq, təminatçı yoxlaması), [[SPEC-WALLET-0001]] (şəxsiyyət yeniləməsi). Çərçivə: [[FW-RB-0003]] §6.1 (etibarlılıq).
- Sxem: şəxsiyyət növünə isteğe bağlı `date_of_expiry` (növ metadata-sı və `vct#integrity` dəyişir; etibar siyahıları yenidən dərc edilir).
- Kod: şəxsiyyət xidməti (operator deposu: metadata, sənəd ucu, token ucu, vahid yoxlaması); `@tamga-network/issuer` (mdoc
  konfiqurasiyasında əhatə və nüsxə siyasəti), `@tamga-network/trust` (`walletProviderOfKey`), `@tamga-network/mdoc` (`expiry_date`
  full-date), `@tamga-network/wallet-core` (standart mdoc sorğusu, `renewIdentityCredential`, `scheduleIdentityRenewals`); Tamga Wallet
  tətbiqi yeni funksiyaları çağırır.
- Qalan risk və açıq iş: hər yeniləmə ləğv siyahısında 10 yeni indeks sərf edir (iki format bir indeksi paylaşır). Şəxsiyyət xidmətinin
  tək siyahısı 100.000 indekslidir və 80%-də dolur; siyahı dolanda yeni siyahı açmaq ([[SPEC-CRED-0003]] §6) şəxsiyyət xidmətində hələ
  yoxdur və miqyasdan əvvəl edilməlidir. Şəxsiyyət xidməti yeniləmə tezliyindən cüzdanın aktiv olduğunu öyrənir (ayda bir), hansı
  yoxlayıcıya nə göstərildiyini öyrənmir ([[ADR-0044]] ilə eyni tarazlıq).

# Status

**Qəbul edildi — 2026-11-16** (layihə rəhbərliyinin təsdiqi; ARF 3.0.0 oxu qərarları, hərfi sitat xüsusi təsdiq qeydində).
DECISIONS: D-ID-17. IR1–IR7 məcburidir. Konfiqurasiya identifikatoru `urn:tamga:id:IdentityAttestation:1:mso_mdoc` və ləğv səbəbi
`wallet-provider-invalid` ictimai ad təsdiqi gözləyir.
