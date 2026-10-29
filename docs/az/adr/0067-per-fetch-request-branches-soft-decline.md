---
document_id: ADR-0067
title: "Sorğu obyektinin hər çəkilişi ayrıca qoldur; imtina yalnız öz qolunu bağlayır"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  OpenID4VP 1.0-da rəqəmsal cüzdanın xəta cavabı (imtina) imzalanmır və şifrəsiz göndərilə bilər; onu təqdimata bağlayan yeganə şey `state`-dir. Tamga-da `state` sorğu obyektində idi və sorğu obyektini QR-dakı ünvandan hər kəs çəkə bilirdi: QR-ı görən biri saxta imtina göndərib real şəxsin təqdimatını "imtina edildi"yə sala bilirdi. Qərar: `request_uri`-nin hər çəkilişi (GET və ya POST) ayrıca çəkiliş qolu açır — təzə 128 bitlik `state`, təzə `nonce` və təzə efemer şifrələmə açarı ilə yeni imzalanmış sorğu obyekti (HAIP §5 "hər avtorizasiya sorğusunda efemer açar" qaydasının daha sərt yerinə yetirilməsi); POST çəkilişdə `wallet_nonce` geri yazılır. İmtina (şifrəli və ya şifrəsiz) yalnız öz qolunu bağlayır; təqdimat bütövlükdə yalnız bir qolu varsa və o qol bağlanıbsa REJECTED olur, əks halda müddəti bitənədək açıq qalır və ilk etibarlı təqdimat qalib gəlir. Açıla bilməyən cavab cəhd sayılmır; qol sayında sabit limit yoxdur — yaddaş yumşaq limitdən sonra köhnə cavabsız qolu ataraq və ortaq qol büdcəsi ilə məhduddur (Dəyişiklik qeydi 2026-10-29). İmzalı imtina rədd edildi (standartdan kənar, ARF RPA_11 məxfilik prinsipinə zidd). Qəbul: 2026-10-29 (layihə rəhbərliyinin təsdiqi).
domain: Protocol
related: ["[[ADR-0017]]", "[[ADR-0034]]", "[[ADR-0012]]", "[[SPEC-PROTO-0002]]", "[[SPEC-PROTO-0001]]", "[[SPEC-API-0001]]"]
translation_of: ADR-0067
source_version: "1.0.0"
---

# Qısaca

Saytda "Tamga Wallet ilə göstər" seçəndə ekrandakı QR rəqəmsal cüzdanın sorğunu yüklədiyi ünvanı daşıyır. Bu ünvanı QR-ı görən
hər kəs aça bilər. İndiyədək hamı eyni sorğunu alırdı; içindəki sessiya kodunu (`state`) bilən biri "şəxs imtina etdi" deyə saxta
cavab göndərib real şəxsin əməliyyatını poza bilirdi. İndi ünvan hər açılışda yeni sorğu yaradır: açan hər kəs öz sessiya kodunu
alır. Saxta imtina yalnız saxtakarın öz nüsxəsini bağlayır; real şəxsin cüzdanı əməliyyatı tamamlaya bilər.

# Kontekst

- **Standart.** OpenID4VP 1.0 Final xəta cavabının həqiqiliyini yoxlamır: §8.2 cavab ucunun cavabını, §8.3.1 `direct_post.jwt`-də
  xəta cavabının şifrəsiz göndərilə biləcəyini (MAY) deyir; §14.5 (sessiya fiksasiyası) və təhlükəsizlik bölmələri xəta cavabı üçün
  imza və ya sahiblik sübutu müəyyən etmir. Xəta cavabını təqdimata yalnız `state` bağlayır.
- **Tamga-dakı boşluq.** [[SPEC-PROTO-0002]] §10.1 (2026-10-24) imtina gələndə təqdimatı bağlayırdı. `state` imzalı sorğu
  obyektində idi; sorğu obyekti QR-dakı `request_uri`-dən həqiqilik yoxlaması olmadan çəkilirdi və hər çəkilişdə eyni obyekt
  verilirdi. QR-ı görən (yanındakı şəxs, kamera, ekran paylaşımı) obyekti çəkib `error=access_denied&state=…` göndərməklə real
  şəxsin təqdimatını REJECTED-ə sala bilirdi (xidmətdən məhrumetmə; şəxsi məlumat sızmır). Eyni nümunə qurumun sənəd vermə
  xidmətindəki daxili şəxsiyyət təqdimatında da var idi ([[SPEC-PROTO-0001]] §11.2). Bundan başqa, təqdimat identifikatoru QR-da
  açıq olduğundan açıla bilməyən beş mənasız cavab da cəhd limiti ilə təqdimatı bağlaya bilirdi.
- **AB-də vəziyyət (2026-10).** Geniş istifadə olunan bir neçə açıq mənbəli yoxlayıcı tətbiqi ilk gələn (saxta ola biləcək) imtinanı
  qəbul edib sessiyanı həmişəlik bağlayır. Bunun AB həlli yoxdur; lakin standart hər avtorizasiya sorğusu üçün efemer açarı (HAIP
  §5) və `request_uri` POST üsulunu (`wallet_nonce`, OpenID4VP 1.0 §5.10) müəyyən edir.
- **Layihə rəhbərliyinin istiqaməti.** Avropadakı tətbiqlərə və standartın olmalı olduğunu dediyi yola baxılır; təklif olunan
  dizayn düzgün yoldursa, o tətbiq edilir.

# Qərar

## K1 — Hər çəkiliş bir qoldur
`request_uri`-nin hər çəkilişi (GET; və ya `request_uri_method=post` ilə POST) **çəkiliş qolu** açır: eyni məzmunla (müştəri
identifikatoru, DCQL, qeydiyyat sertifikatı, `response_uri`, bitmə vaxtı) yeni imzalanmış sorğu obyekti; **təzə `state`** (≥ 128 bit
təsadüfi, gizli: QR-da, `request_uri` yolunda və `response_uri` yolunda yoxdur), **təzə `nonce`** və **təzə efemer cavab şifrələmə
açarı**. Açar identifikatoru qolu adlandırır (`enc-<təqdimat>.<qol>`). Təqdimat açılanda yaradılan ilk sorğu obyekti heç vaxt
verilmir. POST çəkilişdə cüzdanın `wallet_nonce`-u sorğu obyektinə geri yazılır (§5.10; `wallet_metadata` oxunmur); GET işləməyə
davam edir. Bu, HAIP §5-in "hər avtorizasiya sorğusunda efemer açar" qaydasının daha sərt yerinə yetirilməsidir.

## K2 — Yumşaq imtina
Cüzdanın xəta cavabı (OpenID4VP 1.0 §8.4) — şifrəsiz forma və ya şifrəli JWE (§8.3.1), hər ikisi eyni işlənir — `state`-i hansı
qola aiddirsə, **yalnız o qolu** bağlayır. Təqdimat bütövlükdə **yalnız bir qolu varsa və o qol bağlanıbsa** REJECTED olur (səbəb
saxlanmır, PV5). Bir neçə çəkiliş varsa, təqdimat müddəti bitənədək açıq qalır; **ilk etibarlı təqdimat** (sahiblik sübutundan keçən
cavab, §10.1) qalib gəlir. Bağlanmış qola gələn təqdimat qəbul edilmir. Cavab ucu imtinaya 200 qaytarır (§8.2); imtinanın
`redirect_uri`-si məlumata və ya nəticəyə çıxış verən heç nə daşımır (status jetonu, yoxlama görünüşü açarı, avtorizasiya kodu yoxdur).
Qurumun daxili şəxsiyyət təqdimatında çox qollu təqdimatdakı imtina boş gövdə ilə 200 alır; tək qolluda cüzdana `access_denied`
yönləndirməsi qayıdır (bugünkü kimi).

## K3 — Cəhdlər qol başınadır; açıla bilməyən cavab sayılmır
Sahiblik sübutuna çatmadan uğursuz olan, amma qolun açarı ilə açılmış cavablar (state uyğunsuzluğu, boş `vp_token`, A1–A6) həmin
qolun cəhdidir; 5-də yalnız o qol bağlanır (tək qollu təqdimatda təqdimat REJECTED olur). Heç bir qolun açarı ilə açıla bilməyən cavab
(`kid`-də qol yoxdur və ya naməlumdur, pozulmuş gövdə) təqdimata toxunmur və cəhd sayılmır: yalnız sorğu obyektini alan şifrələyə bilər.

## K4 — Limitlər
*(2026-10-29 tarixli dəyişiklik qeydi ilə dəyişdi; ilkin mətn: "təqdimat başına ən çox 10 qol; növbəti çəkiliş 429".)* Qol sayında
sabit limit və qanuni çəkilişə 429 yoxdur. Yaddaş üç yolla məhduddur: qol sıxılmış saxlanır (imzalı obyekt çəkənə verilir və
saxlanmır; qolda `state`-in həşi, `nonce`, şəxsi açar, `kid` və vaxtlar); qol sayı yumşaq limiti (10) keçəndə yeni çəkiliş əvvəlcə
bağlanmış, sonra **heç cavab almamış və ən azı 120 san yaşı olan ən köhnə** qolun yerini tutur; sərt tavanda (32) yaş şərti düşür.
**Cavabı emal olunan qol heç vaxt atılmır.** Bütün təqdimatlar üçün ortaq qol büdcəsi (20 000) var. Çəkiliş sürət limiti müştəri
ünvanı başınadır (proksidə; tətbiqdə ümumi tavan), təqdimat başına deyil. Bağlanmış və ya müddəti keçmiş təqdimat üçün qol açılmır
(404). Atılmış qola gələn cavab naməlum qol kimi emal olunur (cəhd sayılmır). İmtina `kid` daşımadığı üçün `state`-in həşi ilə
tapılır (xətti axtarış yoxdur), bərabərlik sabit vaxtlıdır. İmtinaların sayı qolların sayı ilə məhduddur.

## K5 — Brauzer yolu (DC API) ayrıdır
Digital Credentials API yolunda (`dc_api.jwt`, ISO/IEC 18013-7 Əlavə C) `request_uri` yoxdur; sorğu obyekti təqdimatı açan səhifəyə
gedir və cavab səhifəyə qayıdır. DC API obyekti qol deyil: onun `state`-i ilə imtina göndərilə bilməz (imtina DC API-nin öz xəta
yolu ilə qayıdır), bu yolda cəhd limiti təqdimat başınadır. Bu yolun bağlanması dəyişmir (mənşə + `nonce` + açar,
[[SPEC-PROTO-0002]] §7).

## K6 — Status API-si dəyişmir
`GET /presentations/{id}` müqaviləsi eynidir (`PENDING` + `attempts` + `last_attempt`; nəticə). Qol məlumatı daxili vəziyyətdir
(izləmə qeydində "neçənci çəkiliş" görünür; `state`, `nonce` yoxdur).

# Nəzərdən keçirilən variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| İlk imtina təqdimatı bağlayır (geniş istifadə olunan yoxlayıcı tətbiqləri) | rədd | QR-ı görən hər kəs real şəxsin əməliyyatını poza bilər |
| İmzalı imtina (cüzdan imtinanı cihaz açarı ilə imzalayır) | rədd | Standartdan kənar; imtinanı yoxlayıcının gözündə şəxsin cihazına bağlayır — ARF RPA_11 (şəxs imtina edəndə yoxlayıcı heç nə öyrənməməlidir) və PV5 ilə ziddiyyət təşkil edir; hansı sənədin açarı ilə imzalanacağı sualı cavabsızdır |
| İmtina heç vaxt təqdimatı bağlamır | rədd | Adi tək cüzdanlı axında şəxs "vermirəm" deyəndə etibar edən tərəf müddət bitənədək gözləyər; pis təcrübə |
| **Hər çəkiliş ayrıca qol + yumşaq imtina (+ qol və sürət limitləri)** | **seçildi** | Standart daxilində; saxta imtina yalnız saxtakarın öz qolunu bağlayır; adi axında (bir çəkiliş) imtina dərhal görünür; OpenID uyğunluq testindəki "sorğu iki dəfə çəkilir" ssenarisi ikinci qolla tamamlanır |
| İmtina yalnız `request_uri_method=post` + `wallet_nonce` ilə | rədd (tək başına) | Cüzdanların çoxu GET işlədir; hücumçunun öz çəkilişində də `wallet_nonce` olur. POST dəstəklənir, amma qoruma qollardan gəlir |

# Qalan risk

Hücumçu QR-ı real cüzdandan **əvvəl** çəkib dərhal imtina etsə, təqdimatın bir qolu olur və təqdimat REJECTED olur. QR-ı görən birinin
öz sənədi ilə də cavab verə bilməsi kimi, bu, cihazlararası axının məlum hüdududur (OpenID4VP 1.0 §14); etibar edən tərəf yeni təqdimat
açır. QR yalnız şəxsə göstərilməli, təqdimat müddəti qısa saxlanmalıdır (5 dəq).

**Atma (dəyişiklik qeydi 2026-10-29).** Yaddaş məhdud və çəkiliş kimlik doğrulamasız olduğu üçün atma tam önlənə bilməz: QR-ı görən
biri real cüzdandan sonra yumşaq limiti keçəcək qədər çəkib 120 san gözləsə, ya da sərt tavanı (32) dolduracaq qədər sürətlə çəksə,
real cüzdanın hələ cavab verməmiş qolunu atdıra bilər. Nəticə təqdimatın REJECTED olması deyil: real cüzdanın cavabı "naməlum sorğu"
(400, cəhd sayılmır) alır, təqdimat açıq qalır, şəxs QR-ı yenidən oxudur. Əvvəlki sabit limitdə eyni hücumçu 10 çəkilişlə real
cüzdanın çəkilişini 429-a salırdı. Ünvan başına sürət limiti (proksidə) hücumun qiymətini artırır, amma paylanmış hücumçunu
dayandırmır. Ortaq büdcə dolarsa ən köhnə atıla bilən qol başqa təqdimatdan da ola bilər; bütün qollar emal olunursa çəkiliş 503
alır. Yaddaşdakı vəziyyət tək proses üçündür; çox nüsxəli quraşdırma paylaşılan anbar tələb edir.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| RQ1 | `request_uri`-nin hər çəkilişi (GET və ya POST) yeni çəkiliş qolu açır: təzə `state` (≥ 128 bit; QR-da, `request_uri` və `response_uri` yolunda yoxdur), təzə `nonce` və təzə efemer şifrələmə açarı ilə yeni imzalanmış sorğu obyekti; təqdimat açılanda yaradılan ilk obyekt verilmir. POST çəkilişdə `wallet_nonce` geri yazılır; GET dəstəklənir. |
| RQ2 | Cüzdanın xəta cavabı (şifrəsiz və ya şifrəli) yalnız `state`-inin aid olduğu qolu bağlayır; təqdimat yalnız bir qolu varsa və o qol bağlanıbsa REJECTED olur, əks halda müddəti bitənədək açıq qalır və ilk etibarlı təqdimat qalib gəlir. Bağlanmış qola gələn təqdimat qəbul edilmir. |
| RQ3 | İmtinaya cavab 200-dür (OpenID4VP 1.0 §8.2); imtinanın `redirect_uri`-si status jetonu, yoxlama görünüşü açarı, avtorizasiya kodu və ya məlumata çıxış verən başqa dəyər daşımır. |
| RQ4 | Heç bir qolun açarı ilə açıla bilməyən cavab təqdimata toxunmur və cəhd sayılmır; açılmış, amma sahiblik sübutuna çatmayan cavab yalnız öz qolunun cəhdidir (qol 5-də bağlanır). |
| RQ5 | Qanuni çəkilişə sabit qol limiti ilə 429 verilmir; yaddaş məhduddur: qol imzalı obyekti saxlamır, yumşaq limitdə (10) əvvəlcə bağlanmış, sonra heç cavab almamış və yaşlı (≥ 120 san) ən köhnə qol atılır, sərt tavanda (32) yaş şərti düşür, ortaq qol büdcəsi bütün təqdimatları əhatə edir; cavabı emal olunan qol atılmır. Çəkiliş sürət limiti müştəri ünvanı başınadır, təqdimat başına deyil. Bağlanmış və ya müddəti keçmiş təqdimatda qol açılmır. (Dəyişiklik qeydi 2026-10-29) |
| RQ6 | Digital Credentials API yolunun sorğu obyekti qol deyil: onun `state`-i ilə imtina qəbul edilmir, bu yolda cəhd limiti təqdimat başınadır. |

# Nəticələr

- Kod: `@tamga-network/verifier` (`createRequestBranch`, `openPresentationResponse`; `responseKidOf` qolu oxuyur; `state` 128 bit;
  qol vəziyyət maşını `BranchSet` / `BranchRegistry`, iki xidmətin ortaq vahidi — dəyişiklik qeydi 2026-10-29; paketlər npm-də
  0.7.4, 2026-10-29); Tamga Verify (`apps/verify`: `GET|POST /vp/req/{id}`, qollar, yumşaq imtina); qurumun
  sənəd vermə xidməti (daxili şəxsiyyət təqdimatı, `/{slug}/vp/req/{id}` GET|POST). Cüzdan nüvəsi dəyişmir (GET ilə çəkir, imtinanı
  şifrəsiz göndərir).
- Sənədlər: [[SPEC-PROTO-0002]] §3, §10.1, PV15; serverdə yoxlama bələdçisi (yoxlama siyahısı).
- OpenID uyğunluq testi: yoxlayıcı test planında "sorğu iki dəfə çəkilir" və adi axın yenidən icra edilməlidir.

# Status

**Accepted — 2026-10-29.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-PROTO-5.

# Dəyişiklik qeydi

- **2026-10-29 (eyni gün, ikinci baxış; layihə rəhbərliyinin "doğru olan tətbiq edilsin" təsdiqi ilə):** K4 və RQ5 dəyişdi. Sabit
  "təqdimat başına 10 qol, sonra 429" qaydası özü xidmətdən imtina yolu idi: QR-ı görən biri 10 dəfə çəkib real cüzdanın çəkilişini
  429-a sala bilirdi. Əvəzinə məhdud yaddaş: sıxılmış qollar (imzalı obyekt saxlanmır), yumşaq limitdə (10) heç cavab almamış və
  yaşlı (≥ 120 san) ən köhnə qol atılır, sərt tavanda (32) yaş şərti düşür, emal olunan qol heç vaxt atılmır, ortaq qol büdcəsi
  (20 000); çəkiliş sürət limiti müştəri ünvanı başına (proksi + tətbiqdə ümumi tavan), təqdimat başına deyil. Qalan risk "Atma"
  paraqrafındadır. Həmçinin: qol vəziyyət maşını iki yerdə ayrıca yazılmır, `@tamga-network/verifier` `BranchSet` ortaq vahiddir;
  imtina axtarışı `state` həşi ilədir (xətti axtarış yoxdur, sabit vaxtlı bərabərlik); tək istifadə kilidi cavab açılmazdan ƏVVƏL
  alınır və açıldıqdan sonra qol yenidən yoxlanılır (qurumun xidmətində kilit açılmadan sonra alınırdı); təqdimatla birlikdə ilk
  sorğu obyekti artıq yaradılmır (`initialRequestObject: false`). RQ1–RQ4 və RQ6 dəyişmir.
