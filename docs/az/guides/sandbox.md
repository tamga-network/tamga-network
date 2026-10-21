---
document_id: GUIDE-0013
title: "Sandbox: test şəbəkəsi"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-21
summary: >
  Real şəbəkədən ayrı olan test şəbəkəsi sandbox.tamga.network ilə başdan-sona sınaq: ünvanlar, etibar lövbərinin sabitlənməsi, rəqəmsal cüzdanın sandbox-a qoşulması, cüzdan tərtibatçısı kimi öz cüzdan provayderinizin sandbox siyahısında qeydiyyata alınması, nümunə şəxslərlə rəqəmsal sənəd alınması, nümunə yoxlayan tərəflərdə təqdim edilməsi, ləğv və dayandırma vəziyyətlərinin sınanması, qurumunuzun test qurumu kimi sınanması, real şəxsiyyətinizlə şəxsiyyətin təsdiqi addımları, qaydalar və sıfırlama.
translation_of: GUIDE-0013
source_version: "1.0.0"
---

# Sandbox: test şəbəkəsi

Bu bələdçi Tamga-ya qoşulan proqram təminatını (xüsusilə rəqəmsal cüzdanı, lakin yoxlayan tərəf və ya sənədi verən qurum da ola bilər) real şəbəkəyə
toxunmadan başdan-sona sınamaq istəyənlər üçündür.

**Nə vaxt oxunmalıdır:**
- Rəqəmsal cüzdanınız real qurumdan rəqəmsal sənəd almazdan əvvəl sənədin alınması, təqdim edilməsi və ləğvi axınlarını sınamaq istədikdə.
- Yoxlayan tərəfinizin mənfi nəticələri (ləğv, dayandırma, yaş şərtinə cavab verməyən şəxs) düzgün verdiyini görmək istədikdə.
- [[GUIDE-0009|Uyğunluq testlərindən]] keçdikdən sonra real telefonla başdan-sona sınaq apararkən.

## Sandbox nədir?

Sandbox Tamga Network-un real şəbəkədən **tamamilə ayrı** olan test şəbəkəsidir ([[ADR-0038]]). Xidmətlər real şəbəkədəki ilə eyni koddur;
yalnız etibar kökü, açarlar, etibar siyahıları və məlumatlar ayrıdır və saxtadır:

- Öz test kök sertifikatı var: **Tamga Sandbox Root CA (TEST)**. Real şəbəkənin kökü sandbox-da heç nəyi imzalamır;
  sandbox kökü real şəbəkənin heç bir siyahısında yer almır (`ADR-0038/SB1`).
- Sandbox-un [[t:LOTL]]-u və milli siyahısı özlərini `"environment": "sandbox"` sahəsi ilə test kimi işarələyir
  ([[SPEC-TRUST-0001]] §3). Real şəbəkə üçün konfiqurasiya edilmiş rəqəmsal cüzdan və ya yoxlayan tərəf bu siyahını qəbul etmir
  (`ADR-0038/SB2`).
- Şəxslər, tədbirlər və rəqəmsal sənədlər nümunədir; real fərdi məlumatlar yoxdur. Şəxsiyyətin təsdiqi standart olaraq saxta
  provayderlə aparılır (`ADR-0038/SB3`); istəyən hər kəs real şəxsiyyət təsdiqi addımlarını da sınaya bilər (§8, [[ADR-0040]]).
  Nümunə qurumlar real qurum adlarını daşıyır (aşağıdakı qeydə baxın).
- Hər sandbox səhifəsi və sandbox-a qoşulmuş hər cüzdan ekranı "SANDBOX · test" işarəsini göstərir (`ADR-0038/SB4`).
- Məlumatlar hər gecə ilkin vəziyyətinə qaytarılır (`ADR-0038/SB5`).

Sandbox sənədi real əməliyyatda istifadə edilə bilməz: real yoxlayan tərəf sandbox kökünü tanımır.

## Ünvanlar

Sandbox real şəbəkənin ünvan strukturunu `sandbox` alt adı ilə təkrarlayır. Rəqəmsal cüzdan və ya yoxlayan tərəf yalnız ünvanları və etibar
lövbərini dəyişməklə keçid edir.

| Ünvan | Nə | Real şəbəkədəki qarşılığı |
|---|---|---|
| `https://sandbox.tamga.network` | sandbox səhifəsi: etibar lövbəri, ünvanlar, nümunə şəxslər, sənəd təklifləri, nümunə yoxlayan tərəflər | — |
| `https://trust.sandbox.tamga.network` | test etibar siyahıları (`lotl.jws`, `tl-tr.jws`), lövbər jurnalı (`anchors.jsonl`), `keys/` | `trust.tamga.network` |
| `https://issuer.sandbox.tamga.network/{kurum}` | nümunə qurumların sənəd vermə xidməti ([[t:OpenID4VCI]]) | `issuer.tamga.network` |
| `https://status.sandbox.tamga.network` | ləğv siyahıları (Token Status List) | `status.tamga.network` |
| `https://verify.sandbox.tamga.network` | test yoxlayan tərəfi ([[t:OpenID4VP]]) | `verify.tamga.network` |
| `https://id.sandbox.tamga.network` | şəxsiyyət və əlaqə sənədləri; sürətli sınaq (saxta şəxs) və ya real şəxsiyyətlə təsdiq | `id.tamga.network` |
| `https://console.sandbox.tamga.network` | Qurum Konsolu — yalnız sandbox-da açılan test qurumları üçün | `console.tamga.network` |

Sandbox-un öz cüzdan provayderi yoxdur: şəbəkə cüzdan provayderi idarə etmir, cüzdan tərtibatçıları öz provayderlərini
sandbox siyahısında qeydiyyata aldırır (§2, [[ADR-0042]]). Siyahıda iki xüsusi qeyd var: `TAMGA-SANDBOX-TEST-WP` şəbəkənin öz sınaq
ssenariləri üçün ümumi test açarıdır (real rəqəmsal cüzdan deyil; [[ADR-0042]] K5); `OIDF-CONFORMANCE-TEST` OpenID uyğunluq
testi alətinin test provayderidir (yalnız sandbox). Tamga Wallet-ın provayderi (`TAMGA-WP-1`) həm real, həm də sandbox
siyahısında eyni qeyd və eyni sertifikatla `ACTIVE` vəziyyətindədir; ayrıca cüzdan sandbox-u yoxdur.

Nümunə qurumlar, şəxslər və səlahiyyətlər ilkin (seed) məlumatlardan gəlir və hər sıfırlamada ilkin vəziyyətinə qayıdır; nümunə qurumların konsolu
yoxdur. Qurum Konsolu yalnız Sizin açdığınız test qurumlarına xidmət göstərir (§9, [[ADR-0041]]).

## 1. Etibar lövbərini sabitləyin

Rəqəmsal cüzdan və yoxlayan tərəf LOTL imzasını yalnız tətbiqə daxil edilmiş barmaq izləri ilə qəbul edir; siyahı serverinə etibar edilmir.
Sandbox üçün **ayrıca** sabit dəst istifadə edin:

1. `https://sandbox.tamga.network` səhifəsindəki sandbox LOTL imzalayıcısının və test kökünün SHA-256 barmaq izlərini götürün (eyni
   dəyərlər `https://trust.sandbox.tamga.network/keys/root-fingerprints.json`-də də var; səhifədəki dəyərlə müqayisə edin).
2. Bu barmaq izlərini real şəbəkənin pinlərindən **ayrı** konfiqurasiyada saxlayın. İki dəsti heç vaxt birləşdirməyin.
3. Siyahını yükləyərkən gözlənilən şəbəkəni göstərin. `@tamga-network/trust` və `@tamga-network/wallet-core` bunu `environment` seçimi ilə
   edir:

```ts
import { fetchTrustSource } from "@tamga-network/wallet-core";

const { source } = await fetchTrustSource("https://trust.sandbox.tamga.network", http, {
  pins: { lotlSigners: [SANDBOX_LOTL_SIGNER_FINGERPRINT], environment: "sandbox" },
});
```

Öz yükləyicinizi yazırsınızsa: imzanı yoxladıqdan sonra LOTL-dakı və milli siyahıdakı `environment` sahəsini
müqayisə edin (sahə yoxdursa, `production` sayılır); uyğun gəlmirsə, prosesi dayandırın ([[SPEC-TRUST-0001]] §6).

## 2. Rəqəmsal cüzdanı sandbox-a qoşun

Sandbox birdir və şəbəkənindir: cüzdan tərtibatçıları da qurumlar və yoxlayan tərəflərlə eyni sandbox-dan istifadə edir; ayrıca cüzdan
sandbox-u yoxdur ([[ADR-0042]]). Şəbəkə cüzdan provayderi idarə etmir; sandbox-da da cüzdan provayderinizi Siz idarə edirsiniz.

**Rəqəmsal cüzdanınızı sandbox-a qoşun:** [[GUIDE-0005]]-dakı addımları sandbox ünvanları ilə tətbiq edin:

| Parametr | Sandbox dəyəri |
|---|---|
| etibar siyahıları | `https://trust.sandbox.tamga.network` + sandbox pinləri + `environment: "sandbox"` |
| cüzdan provayderi (WIA / WUA) | öz cüzdan provayderinizin test ünvanı (sandbox siyahısında qeydiyyatda olmalıdır; aşağıda) |
| şəxsiyyət sənədi xidməti | `https://id.sandbox.tamga.network` |
| sənədi verən qurumlar kataloqu | sandbox milli siyahısındakı `issuers[]` (ünvanları `issuer.sandbox.tamga.network`) |

Sandbox-u ekranda aydın göstərin (`ADR-0038/SB4`) və sandbox-da alınan sənədləri real şəbəkənin sənədləri ilə qarışdırmayın.
İstifadəçiyə təqdim etdiyiniz tərtibatçı parametri ilə real şəbəkə və sandbox arasında keçid edə bilərsiniz; iki şəbəkənin etibar kökləri
və sənədləri ayrı saxlanmalıdır. Məsələn, şəbəkənin ilk rəqəmsal cüzdanı olan Tamga Wallet-da bu parametr Parametrlər → Tərtibatçı → **Şəbəkə** bölməsindədir.

### Cüzdan provayderinizi sandbox siyahısında qeydiyyata aldırın

Sandbox-dakı sənədi verən qurumlar və şəxsiyyət xidməti, real şəbəkədə olduğu kimi, yalnız siyahıda qeydiyyatda olan cüzdan provayderinin
imzaladığı cüzdan nümunəsi sübutunu (WIA) və açar sübutunu (KA) qəbul edir. Buna görə rəqəmsal cüzdanınızı sınamazdan əvvəl öz
provayderiniz sandbox siyahısının `wallet_providers[]` bölməsində qeydiyyatda olmalıdır:

1. Test üçün ayrıca provayder imza açarı yaradın; real şəbəkədəki açarınızı sandbox-da istifadə etməyin.
2. Provayderinizin ünvanını, imza sertifikatını və cüzdan həllinizin adını (`solution_id`) layihə rəhbərliyinə göndərin. Qeydiyyat
   hazırda əl ilə, layihə rəhbərliyinin təsdiqi ilə aparılır.
3. Qeydiniz sandbox siyahısında dərc edildikdən sonra rəqəmsal cüzdanınızı sandbox-dakı nümunə qurumlar (§3), şəxsiyyət xidməti (§5, §8) və
   nümunə yoxlayan tərəflərlə (§6) başdan-sona sınayın.

Cüzdan provayderlərinin özünüqeydiyyatı və sandbox-un Sizin göstərdiyiniz ünvandakı rəqəmsal cüzdanı şəbəkənin qaydalarına qarşı
avtomatik sınayıb hesabat verdiyi avtomatik uyğunluq testi növbəti mərhələlərdir və ayrıca qərar tələb edir. O vaxta qədər
[[GUIDE-0009|uyğunluq testlərini]] öz mühitinizdə işə salın.

## 3. Nümunə qurumlar və sənəd növləri

::: warning Qurum adları haqqında
Qurum adları real sınaq mühiti yaratmaq üçün istifadə edilib. İstanbul Bilgi Universiteti pilot tərəfdaşımızdır; Bubilet və Paribu
Cineverse ilə heç bir əlaqə və ya razılaşma yoxdur. Buradakı sənədlər test açarı ilə imzalanıb və heç yerdə etibarlı deyil. Qurumların loqoları istifadə edilmir.
:::

| Qurum | Sənəd növləri (`vct`) |
|---|---|
| İstanbul Bilgi Universiteti (TEST) — `issuer.sandbox.tamga.network/istanbul-bilgi` | `urn:tamga:edu:StudentCredential:1`, `urn:tamga:edu:DiplomaCredential:1` |
| Bubilet (TEST) — `issuer.sandbox.tamga.network/bubilet` | `urn:tamga:tkt:EventTicket:1` (uydurma konsertlər) |
| Paribu Cineverse (TEST) — `issuer.sandbox.tamga.network/paribu-cineverse` | `urn:tamga:tkt:EventTicket:1` (uydurma film seansları; kino bileti ayrıca növ deyil: film və seans `event_name`, zal `venue_name` sahəsindədir) |
| Şəxsiyyət xidməti — `id.sandbox.tamga.network` | `urn:tamga:id:IdentityAttestation:1`, psevdonim toxumu (PseudonymSeed), `urn:tamga:contact:EmailAddress:1`, `urn:tamga:contact:PhoneNumber:1` |

## 4. Nümunə şəxslər

Sandbox səhifəsindəki **nümunə şəxslər** siyahısı uydurmadır: müxtəlif ölkələrdən, müxtəlif yaşlarda və müxtəlif vəziyyətlərdə 13 şəxs.
Şəxsiyyət nömrələri 12 rəqəmlidir və `99` ilə başlayır; qəsdən etibarsızdır (`ADR-0038/SB3`). Bəzi şəxslər mənfi nəticələri sınamaq
üçün hazırlanıb:

| Şəxs | Hazır vəziyyət | Gözlənilən nəticə |
|---|---|---|
| Timur Rahimov | diplomu verildikdən dərhal sonra **ləğv** edilir | növbəti status dərcindən sonra yoxlama REJECTED |
| Gülnaz Abenova | diplomu verildikdən dərhal sonra **dayandırılır** | dayandırılmış sənəd qəbul edilmir; təklif səhifəsindən bərpa edilə bilər |
| Elvin Həsənov | bileti verildikdən dərhal sonra **ləğv** edilir (geri qaytarma) | növbəti status dərcindən sonra girişdə yoxlama REJECTED |
| Aibek Toktogulov | qeydiyyatı dondurulmuş tələbə (`student_status: ON_LEAVE`) | tələbə sənədi bu vəziyyəti daşıyır |
| Aruzhan Seitkali | 17 yaşındadır | yaş yoxlaması (≥ 18) mənfi |
| Deniz Örnek | heç bir qurumda qeydiyyatı yoxdur | qurum sənədi ala bilmir |

Şəxsin səhifəsi (`/people/<anahtar>`) həmin şəxsin ala biləcəyi sənədləri göstərir.

## 5. Rəqəmsal sənəd alın

**Qurum sənədləri (tələbə sənədi, diplom, bilet):** şəxsin səhifəsində sənəd növünü (bilet üçün qurumu — konsert və ya
kino —, tədbiri və bilet sinfini) seçin. Səhifə [[t:OpenID4VCI]] təklifi açır: QR kod və keçid (`openid-credential-offer://…`), həmçinin ayrıca
göstərilən PIN (`tx_code`). QR-ı rəqəmsal cüzdanla skan edin, PIN-i daxil edin. Təklif səhifəsi sənədin verildiyini və vəziyyətini göstərir.

**Şəxsiyyət və əlaqə rəqəmsal sənədləri:** bu rəqəmsal sənədləri rəqəmsal cüzdan başladır (authorization code axını). Şəxsin səhifəsindəki QR şəxsiyyət
xidmətinin təklifidir. Şəxsiyyəti yoxlayan tərəfin saxta ekranında səhifədə adı yazılmış şəxsi seçin; real rəqəmsal sənəd və ya üz skanı
tələb olunmur.

**E-poçt və telefon rəqəmsal sənədləri:** sandbox-da kod heç yerə göndərilmir; kod daxil etmə ekranında "SANDBOX · TEST" qutusunda
göstərilir. Yalnız nümunə ünvanlar qəbul edilir: `.example` və ya `.test` domen adlı e-poçt, yaxud +44 7700 900000 ilə
+44 7700 900999 arasında telefon nömrəsi (nümunə şəxslərin ünvanları onların səhifələrində yazılıb). Real ünvan
rədd edilir.

## 6. Rəqəmsal sənədi təqdim edin

Sandbox səhifəsindəki **nümunə yoxlayan tərəflər** test yoxlayan tərəfində imzalı [[t:OpenID4VP]] sorğusu açır və onun QR kodunu
göstərir. Onu rəqəmsal cüzdanla skan edin; nəticə (ACCEPTED, REJECTED və ya INDETERMINATE), aparılan yoxlamalar və paylaşılan sahələr eyni
səhifədə görünür.

| Ssenari (`/verify/<senaryo>`) | Nə tələb olunur |
|---|---|
| `signin` | Tamga ilə giriş — yalnız psevdonim |
| `signup` | sayta qeydiyyat — ad, soyad və psevdonim |
| `age` | yaş ≥ 18 (seçici paylaşım) |
| `age-zk` | yaş ≥ 18, sıfır bilik sübutu ilə (rəqəmsal cüzdan dəstəkləyirsə) |
| `diploma` | işə müraciət: diplom |
| `student` | tələbə endirimi: tələbə sənədi |
| `ticket` | tədbir girişi: bilet (konsert və ya kino) |
| `identity` | şəxsiyyət sənədi ilə tədbirə giriş |

Öz yoxlayan tərəfinizi sınamaq üçün: yoxlayan tərəfinizi sandbox siyahısına və sandbox pinlərinə bağlayın, sandbox-da alınmış
rəqəmsal sənədləri təqdim edin. Qurumunuzu sandbox-da özünüz aça bilərsiniz (§9); cüzdan provayderinizi isə bu gün layihə rəhbərliyinə müraciət edərək qeydiyyatdan keçirirsiniz
(§2). Yoxlayan tərəfin və cüzdan provayderinin özünü sandbox siyahısına əlavə etməsi növbəti mərhələdir.

### Brauzerdən (Digital Credentials API)

`https://verify.sandbox.tamga.network/dc-api-test` **eyni cihazdakı** cüzdandan brauzerin Digital Credentials API-si ilə
(`navigator.credentials.get({ digital: { requests } })`) sənəd istəyir — QR yoxdur. Protokollar: `openid4vp-v1-signed`
(imzalı [[t:OpenID4VP]] sorğusu, OpenID4VP 1.0 Əlavə A; `expected_origins` = səhifənin mənşəyi) və `org-iso-mdoc`
(ISO/IEC 18013-7 Əlavə C; oxuyucu imzalı `DeviceRequest`, HPKE ilə şifrələnmiş `DeviceResponse`). Səhifə nəticəni göstərir:
ACCEPTED ya da REJECTED, yoxlamalar və — yalnız sandbox nümunə məlumatında — açıqlanan dəyərlər. API-si olmayan brauzer
"bu brauzerdə dəstəklənmir" mesajını görür; nümunə saytdakı (`/sample-site`) QR axını hər yerdə işləyir.

## 7. Ləğvi və dayandırmanı sınayın

Diplom və biletin təklif səhifəsində **ləğv et**, **dayandır** və **geri al** düymələri var. Hazır statuslu şəxslərdə
(yuxarıdakı cədvəl) bu addım rəqəmsal sənəd verilən kimi avtomatik yerinə yetirilir. Dəyişiklik sənədi verən qurum növbəti status siyahısını
dərc etdikdə qüvvəyə minir (sabit intervallı dərc; dərhal deyil). Sonra eyni rəqəmsal sənədi nümunə yoxlayan tərəfdə yenidən
təqdim edin: ləğv edilmiş və ya dayandırılmış sənəd qəbul edilməməlidir. Tələbə sənədi qısamüddətlidir və status siyahısı daşımır.

## 8. Real şəxsiyyətinlə sına

Sandbox-da şəxsiyyət axını iki seçim təqdim edir ([[ADR-0040]]): **Real şəxsiyyətinlə doğrula (Didit)** — provayderin real addımları
(sənədin skan edilməsi, canlılıq yoxlaması, üz uyğunlaşdırması) — və ya **Sürətli sınaq (saxta şəxs)** — uydurma bir şəxs seçib təsdiqləyirsiniz.
Real yol hamıya açıqdır; dəvət tələb olunmur (`ADR-0040/RI1`).

1. Rəqəmsal cüzdanı sandbox-a qoşun və şəxsiyyət rəqəmsal sənədinin əlavə edilməsini başladın.
2. Şəxsiyyət xidmətinin səhifəsində məlumatlandırmanı təsdiqləyin və "Real şəxsiyyətinlə yoxla (Didit)" seçimini edin.
3. Açılan xəbərdarlığı oxuyub təsdiqləyin: "Bu test mühitidir; real şəxsiyyətinlə sınayırsan; məlumatların hər gecə silinir;
   Didit sessiyası rəqəmsal sənəd verilən kimi silinir." Təsdiq olmadan provayderə keçid edilmir (`ADR-0040/RI3`).
4. Şəxsiyyəti yoxlayan tərəf olan Didit-də addımları tamamlayın; test rəqəmsal sənədi rəqəmsal cüzdana gəlir. Sandbox real şəbəkənin provayder hesabından istifadə edir; rəqəmsal sənədi imzalayan
   açarlar və qeydlər isə ayrıdır (`ADR-0040/RI2`).

Şəxsiyyəti yoxlayan tərəfdəki pulsuz yoxlama limiti real şəbəkə ilə ortaq olduğu üçün real yolun **gündəlik və aylıq həddi** var. Hədd dolduqda
yalnız sürətli sınaq görünür ("Bugünkü kvota doldu, sürətli sınaqdan istifadə et"); hər axında ən çox bir real sessiya açılır
(`ADR-0040/RI7`).

Rəqəmsal sənədə yalnız ad, soyad və doğum tarixi (və ondan törədilən yaş məlumatı) keçir; real şəxsiyyət nömrəsi və sənəd nömrəsi əvəzinə
təsadüfi `SANDBOX-…` dəyəri yazılır (`ADR-0040/RI4`). Provayderdəki (şəxsiyyəti yoxlayan tərəfdəki) yoxlama sessiyası rəqəmsal sənəd verilən kimi və ya yoxlama
uğursuz olduqda dərhal, yarımçıq qaldıqda təxminən bir saat ərzində, ən gec isə gecə sıfırlanmasında silinir (`ADR-0040/RI5`). Sandbox administratoru zərurət olduqda real yolu
yalnız dəvət kodu ilə açılan rejimə keçirə bilər; bu rejimdə dəvət kodları fərdi (birdəfəlik, ən çox 7 gün) və ya müddətli (ən
çox 72 saat, ən çox 25 istifadə) olur, həddi aşa bilməz və gecə sıfırlanmasında silinir.

## 9. Qurumunu sına

Qurum öz rəqəmsal sənədini öz (uydurma) məlumatları ilə bir neçə dəqiqəyə sınaya bilər ([[ADR-0041]]):

1. `https://sandbox.tamga.network` → **Qurumunu sına**. Uydurma qurum adı yazın (sonuna avtomatik olaraq "(TEST)" əlavə edilir)
   və növünü seçin (bu gün təhsil qurumu: tələbə sənədi və diplom). E-poçt, telefon və ya şəxs adı tələb olunmur; real qurum adları və rəsmi
   qurum sözləri (T.C., Bakanlığı, Belediyesi, Valiliği, Üniversitesi …) qəbul edilmir. İki təsdiq qutusunu işarələyin: yalnız
   uydurma məlumatlar, hər gecə silinir.
2. Qurum sandbox etibar siyahısına `test_institution: true` işarəsi ilə dərhal əlavə edilir. Rəqəmsal sənəd imza sertifikatlarını sandbox-un
   **test qurumları üzrə aralıq sertifikat orqanı** verir; rəqəmsal sənədlər son + aralıq sertifikat zəncirini daşıyır və sandbox kökünə bağlanır
   (`ADR-0041/TI1`, [[SPEC-TRUST-0001]] §4).
3. Səhifədəki birdəfəlik dəvət keçidi ilə `console.sandbox.tamga.network`-də passkey yaradın.
4. Konsolda **Qeydlər** → qeydləri bir-bir daxil edin və ya **CSV yüklə** ilə toplu yükləyin (birinci sətir sahə adlarıdır; ən çoxu 200
   sətir). Şəxsiyyət nömrəsinin yoxlama qaydasından keçən 11 rəqəmli ədəd olan qeyd rədd edilir (`ADR-0041/TI4`): bilərəkdən etibarsız
   nömrələrdən istifadə edin.
5. Qeydin yanında **Masada ver** → QR kodu rəqəmsal cüzdanla skan edin, PIN-i daxil edin.
6. Rəqəmsal sənədi sandbox səhifəsindəki "Diplomun doğrulanması" və ya "Tələbə endirimi" yoxlayan tərəfində təqdim edin.

Məhdudiyyətlər: eyni anda ən çoxu 30 test qurumu (dolduqda yer açmaq üçün ən köhnə boş test qurumu silinir); 10 dəqiqədə ən çoxu 10 yeni qurum; hər quruma 200 qeyd; saatda 100 təklif.
Qurum, onun hesabı, qeydləri və sertifikatları hər gecə silinir və sandbox siyahısından çıxarılır (`ADR-0041/TI5`). Tədbir bileti
qurumları, rəqəmsal cüzdanın başlatdığı buraxılış və test qurumu üçün API açarı növbəti mərhələdədir.

## Qaydalar və məhdudiyyətlər

- **Real fərdi məlumatlar daxil etməyin.** Sandbox-a yalnız nümunə şəxslər, nümunə ünvanlar və uydurma qeydlər daxil edilir; yeganə istisna
  özünüzün seçdiyiniz real şəxsiyyət sınağıdır (§8) və orada rəqəmsal sənədə yalnız ad, soyad və doğum tarixi keçir.
- **Davamlılıq gözləməyin.** Sandbox məlumatları hər gecə saat 03:30-da (Türkiyə vaxtı ilə) ilkin vəziyyətinə qayıdır: verilmiş rəqəmsal sənədlərin qeydləri,
  ləğv siyahıları və lövbər jurnalı sıfırlanır. Rəqəmsal cüzdanınızdakı sandbox sənədləri sıfırlamadan sonra doğrulanmaya bilər; onları yenidən
  alın. Etibar kökü və siyahıların imza açarları sıfırlanmır; cüzdandakı sandbox pinləri dəyişmir.
- **Real şəbəkə ilə qarışdırmayın.** Sandbox pinlərini real şəbəkə konfiqurasiyanıza əlavə etməyin; sandbox sənədi real
  yoxlayan tərəfdə onsuz da keçmir.
- Sandbox-da xidmət səviyyəsi öhdəliyi yoxdur; fasilələr real şəbəkənin vəziyyətini əks etdirmir.

## Əlaqəli

[[ADR-0038]] · [[ADR-0040]] · [[ADR-0041]] · [[ADR-0042]] · [[SPEC-TRUST-0001]] · [[GUIDE-0005]] · [[GUIDE-0010]] · [[GUIDE-0009]] · [[GUIDE-0012]]
