---
document_id: FW-POL-0001
title: "Ləğv Siyasəti"
status: Active
version: 1.0.0
created: 2026-10-11
last_updated: 2026-10-16
summary: >
  Tamga şəbəkəsində sənədi verənlərin (şəxsiyyət xidməti və qurumlar) verdiyi rəqəmsal sənədlərin hansı şərtlərlə ləğv edildiyini, ləğvi kimin tələb edə biləcəyini, müvəqqəti dayandırmanı, ləğv siyahısının necə dərc edildiyini və ləğvin nə qədər müddətdə qüvvəyə mindiyini bir yerdə toplayan siyasət (Avropa İttifaqı (Aİ) ARF VCR_05). Sənəd növlərinin rulebook-larındakı ləğv qaydalarını və onların əsaslandığı qərarları toplayır; yeni qayda müəyyən etmir. Cüzdan sübutlarının (WIA, KA) ləğvi Cüzdan Sübutu Siyasətində verilib.
translation_of: FW-POL-0001
source_version: "1.0.0"
---

# 1. Əhatə dairəsi və status

Aİ ARF (VCR_05) ləğv edilə bilən rəqəmsal sənəd verən hər bir provayderdən verdiyi sənədin hansı şərtlərlə ləğv ediləcəyini göstərən
siyasətinin olmasını tələb edir. Bu sənəd Tamga şəbəkəsindəki bütün [[t:issuer|sənədi verənlər]] üçün həmin siyasətdir: Tamga Network şəxsiyyət xidməti
və etibar siyahısındakı hər bir qurum. Əhatə dairəsi Əlavə C-dəki sənəd növləridir (Education, Identity, Event Ticket, Contact rulebook-ları).
Cüzdan provayderlərinin verdiyi cüzdan nüsxəsi sübutu (WIA) və açar sübutu (KA) üçün şərtlər [[FW-POL-0002]] sənədindədir.

Siyasət qərar vermir: şərtlər Tamga Rulebook-dan (Əlavə B), növlərin rulebook-larından və onların əsaslandığı qərarlardan toplanıb;
mənbə hər sətirdə göstərilib. Ziddiyyət olduqda mənbə üstünlük təşkil edir (RB-ENF-05).

# 2. Hansı rəqəmsal sənədlər ləğv edilə bilər

| Növ | Ləğv edilə bilərmi | Əsaslandırma |
|---|---|---|
| Tamga şəxsiyyət sənədi `urn:tamga:id:IdentityAttestation:1` | **Bəli** (məcburi) | Ən çox 2 il etibarlıdır; RB-AP-ID-04 |
| ZK nüsxəsi `urn:tamga:id:ShortLivedIdentityAttestation:1` | Xeyr | Ən çox 24 saat etibarlıdır; qısa ömür ləğvi əvəz edir (ARF VCR_01; [[ADR-0044]]) |
| Psevdonim toxumu `urn:tamga:id:PseudonymSeed:1` | Xeyr | Heç vaxt təqdim edilmir; şəxsiyyət sənədi ilə birlikdə yenilənir ([[ADR-0031]]) |
| Sürücülük vəsiqəsi məlumatı `urn:tamga:id:DrivingLicenceAttestation:1` | **Bəli** (məcburi) | [[ADR-0039]] |
| Tələbə sənədi `urn:tamga:edu:StudentCredential:1` | Xeyr | Ən çox 90 gün etibarlıdır; qısa ömür ləğvi əvəz edir; müddəti bitməmiş, lakin artıq düzgün olmayan sənəd qəbul edilmiş riskdir ([[FW-RB-0002]] §6) |
| Diplom `urn:tamga:edu:DiplomaCredential:1` | **Bəli** (məcburi) | Müddətsiz sənəd ([[FW-RB-0002]] §6) |
| Tədbir bileti `urn:tamga:tkt:EventTicket:1` | **Bəli** (məcburi) | Ləğv və girişdə "istifadə edilib" biti ([[FW-RB-0004]] §6) |
| E-poçt və telefon sənədləri `urn:tamga:contact:*:1` | **Bəli** (məcburi) | [[ADR-0021]] |

Yeni sənəd növünün rulebook-u növün ləğv edilə bilib-bilmədiyini və ləğv edilə bilərsə, şərtlərini bu cədvələ əlavə etməklə
müəyyən edir (ARF ARB_24).

# 3. Ləğv şərtləri

## 3.1 Ləğv edilə bilən bütün növlər

| Şərt | Nəticə | Mənbə |
|---|---|---|
| Şəxs razılığını geri götürür | Sənəd ləğv edilir | RB-AP-21, RB-H-01 |
| Şəxs "sənədiniz cüzdana əlavə edildi" bildirişinə etiraz edir | Sənədi verən qurum sənədi ləğv edir və lazım olduqda yenidən verir | RB-AP-15, RB-H-05 |
| Sənəd səhv verilib | Ləğv edilir, düzgünü yenidən verilir | Növlərin rulebook-ları |
| Eyni şəxsə eyni növün yeni nüsxə dəsti verilir | Köhnə dəst ləğv edilir (hər şəxs üçün bir aktiv dəst) | RB-AP-ID-05, [[FW-RB-0002]] §4.3 |
| Sənədi verən qurumun imza açarı sızıb | Sənədi verən qurumun fəaliyyəti dayandırılır, sertifikatı ləğv edilir, təsirə məruz qalan sənədlər ləğv siyahısında ləğv edilir | Əlavə A §4.6 |
| Qurum sənədinin daxili açıqlama siyasəti əlavə edilir, dəyişdirilir və ya aradan qaldırılır | Həmin konfiqurasiya ilə verilmiş etibarlı sənədlər ləğv edilir | RB-AP-26, [[ADR-0046]] EP4 |

## 3.2 Növə xas şərtlər

| Növ | Şərtlər | Mənbə |
|---|---|---|
| Şəxsiyyət sənədi | Şəxsin silmə tələbi; eyni sənədlə yenidən yoxlama (köhnəsi); sənədin itməsi və ya oğurlanması barədə bildiriş; səhv sənəd | [[FW-RB-0003]] §6.2, RB-AP-ID-05 |
| Sürücülük vəsiqəsi məlumatı | Şəxsin istəyi; silmə tələbi; eyni kartla yenidən yoxlama (köhnəsi); cüzdan vahidinin ləğvi; bağlı şəxsiyyət sənədinin ləğvi, yenidən verilməsi və ya silinməsi (zəncirvari) | RB-AP-ID-10, [[ADR-0039]] |
| Diplom | Diplomun ləğvi (saxtakarlıq, məhkəmə qərarı); səhv sənəd; cihaz pozuntusu barədə bildiriş | [[FW-RB-0002]] §6.2 |
| Tədbir bileti | Geri qaytarma; tədbirin ləğvi; səhv satış; ötürmə (köhnəsi ləğv edilib yeni cihaza yenidən verilir); girişdə keçid ("istifadə edilib" biti) | [[FW-RB-0004]] §6 |
| E-poçt və telefon sənədləri | Eyni ünvan yenidən sübut edildikdə köhnə sənəd; şəxsin silmə tələbi | [[ADR-0021]] K3, [[FW-RB-0005]] §6.2 |

**Şəxsiyyət xidmətinin sənədləri və silmə.** Şəxs cüzdanını sıfırlayıb məlumatlarını sildikdə cüzdan şəxsiyyət xidmətindən aldığı hər bir sənəd
üçün silmə tələbi göndərir; xidmət qeydi silir və bütün nüsxələri ləğv edir ([[SPEC-WALLET-0001]] §7.6). Cüzdan vahidi cüzdan
provayderi tərəfindən ləğv edildikdə şəxsiyyət xidməti vahidi ən gec 24 saat ərzində yoxlayır və həmin vahiddəki öz sənədlərini ləğv edir
(RB-AP-ID-12). Bu zəncirvari ləğv səbəbindən şəxsiyyət xidməti sənədin müddətini verilmə zamanı təqdim edilən WIA və KA-nın ləğv statusunun dəstəklənmə müddəti ilə
məhdudlaşdırır və tələb etdiyi dəstəklənmə müddətini (sənədin müddəti, 730 gün) metaməlumatlarında elan edir (Aİ ISSU_12c, WUA_32; [[ADR-0047]] K1).
Bu müddəti təmin edən cüzdan provayderində şəxsiyyət sənədi 2 il qalır; daha qısa müddət təmin edən provayderdə sənəd həmin müddətin sonunda bitir.

## 3.3 Cüzdan vahidi ləğv edildikdə qurum sənədləri

Cüzdan vahidinin ləğvi **qurum sənədlərini ləğv etmir** ([[ADR-0047]] K1; Aİ WURevocation_19 isteğe bağlıdır, Tamga ondan istifadə etmir).
Buna baxmayaraq sənədlər istifadəyə yararsız olur:

- Hər nüsxə cihazdakı sənəd sahibi açarına bağlıdır (`cnf`); açar təhlükəsiz aparat təminatında yaradılır, ixrac edilə bilmir (RB-WP-01)
  və hər təqdimat həmin açarla imza və PIN və ya biometrika tələb edir (RB-WP-03). Sənəd başqa cihazdan təqdim edilə bilməz.
- Ləğv edilmiş vahidə heç bir sənədi verən qurum yeni sənəd və ya yeniləmə vermir ([[ADR-0025]] WIA4, [[ADR-0023]]).
- Ləğvi görən cüzdan sənədlərini və açarlarını silir; şəxsiyyət xidmətinin sənədi ləğv olunur.
- Qurum sənədləri müddəti bitdikdə qüvvədən düşür; qısaömürlü növlərdə (tələbə sənədi ən çox 90 gün) bu qısa müddətdir.

Telefonu və kilid açma məlumatını birlikdə ələ keçirən şəxs telefon şəbəkəyə qoşulmadığı müddətcə müddəti bitməmiş qurum sənədini
təqdim edə bilər. Bunun üçün şəxs qurumdan ləğv tələb edir (§4). Zəncirvari ləğv aparılmadığına görə qurum sənədlərinin müddəti WIA və KA-nın
ləğv statusunun dəstəklənmə müddətindən asılı deyil (Aİ ISSU_12d tətbiq edilmir).

## 3.4 Qurumun əlavə şərtləri

Bu siyasət bütün sənədi verənlər üçün ümumidir. Qurum öz sənədləri üçün **əlavə** ləğv şərtlərini öz səhifəsində dərc edə bilər
(**MAY**); keçid etibar siyahısındakı qeydinin `revocation_policy_uri` sahəsində yer alır və cüzdan onu qurum səhifəsində göstərir
(RB-AP-27, [[ADR-0047]] K2). Əlavə şərtlər bu siyasətin şərtlərini daralda bilməz; ziddiyyət olduqda bu siyasət üstünlük təşkil edir.

## 3.5 Ləğv səbəbi olmayan hallar

- **Sənədi verən qurumun fəaliyyətinin dayandırılması və ya siyahıdan çıxarılması** köhnə sənədləri etibarsız etmir; yalnız yeni sənədlərin verilməsi dayanır. Yoxlama
  sənədin verildiyi ana (`iat`) görə aparılır (RB-REG-07, RB-ENF-02, RB-RP-03).
- **Sənədi verən qurumun sertifikatını yeniləməsi** köhnə sənədlərə təsir etmir; onlar köhnə `issuer_id` qeydi ilə yoxlanılır.
- **Sənəd növünün `DEPRECATED` olması** sənədləri ləğv etmir; növ yoxlanıla bilən qalır (RB-SCH-06).

# 4. Ləğvi kim və necə tələb edir

| Kim | Necə |
|---|---|
| Şəxs (sənəd sahibi) | Şəxsiyyət xidmətinin sənədlərində cüzdandakı "Cüzdanı sıfırla və məlumatlarımı sil" axını ilə və ya şəxsiyyət xidmətinin silmə yolu ilə; qurum sənədlərində qurumun kanalı ilə (silmə tələbi, etiraz). Şikayət yolu: sənədi verən qurum → sxem sahibi → KVKK Qurumu (RB-H-07) |
| Sənədi verən qurum | Öz qeydinə əsasən; ləğv siyahısı uyğunlaşdırması yalnız sənədi verən qurumda saxlanılır (RB-AP-09, RB-AP-22). Qurumun əlavə şərtləri `revocation_policy_uri` səhifəsindədir (§3.4) |
| Sxem sahibi və operator | Sənəd ləğv etmir; sənədi verən qurumun fəaliyyətini dayandırır və ya sertifikatını ləğv edir (Əlavə A §4.5–§4.6). Təcili halda düzgün vasitə zolaqdankənar yayım deyil, sənədi verən qurumun fəaliyyətinin dayandırılmasıdır ([[SPEC-CRED-0003]] §5.3) |

# 5. Müvəqqəti dayandırma

Müvəqqəti dayandırma yalnız sxemi `suspension_allowed: true` olan növlərdə istifadə edilir (RB-AP-28, [[ADR-0048]] K2); hazırda bu, diplomdur ([[FW-RB-0002]]
§6.2). Bu növlərin ləğv siyahısı hər sənəd üçün iki bit daşıyır (`bits = 2`): etibarlı, ləğv edilib, dayandırılıb. Dayandırma sənədi verən qurum hər hansı iddianı
araşdırarkən istifadə edilir və araşdırma bitdikdə ya aradan qaldırılır, ya da ləğvə çevrilir. **Şəxsiyyət xidmətinin növlərində dayandırma yoxdur:** status yalnız
etibarlı və ya ləğv edilmiş olur, ləğv daimidir və siyahılar `bits = 1` ilə dərc edilir (Aİ PID qaydası; RB-AP-ID-13, [[ADR-0048]] K1). Şəxsiyyət
sənədi ləğv edilibsə, şəxsiyyət xidməti yeni ZK nüsxəsi vermir (RB-AP-ID-11).

# 6. Mexanizm və dərc

| Mövzu | Qayda | Mənbə |
|---|---|---|
| Mexanizm | IETF Token Status List (Aİ-nin Attestation Status List mexanizmi; Aİ-nin təsbit etdiyi layihə versiyası). mdoc və SD-JWT VC nüsxələri eyni biti daşıyır. Şəbəkədəki yoxlayan tərəf və rəqəmsal cüzdan nüvəsi Aİ-nin ikinci mexanizmini — Attestation Revocation List-i (identifikatorlar siyahısı, `application/identifierlist+cwt`) də yoxlayır (Aİ VCR_10, VCR_12) | [[SPEC-CRED-0003]] |
| Siyahının ünvanı | Rəqəmsal sənəddə `status.status_list.uri`; şəbəkənin idarə etdiyi xidmətlərdə `https://status.tamga.network/` altında, öz xidmətini idarə edən qurumda isə qurumun status serverində | [[SPEC-CRED-0003]] §2 |
| Açar | Ləğv siyahısının imza açarı sənədin imza açarından ayrıdır | RB-AP-03 |
| Məxfilik | Mövqe (`idx`) təsadüfidir; ünvan qeyri-şəffafdır (opaque) (qurumu, ili, qrupu kodlaşdırmır); tutum ən azı 100.000, doluluq ən çox 80%; siyahılar növdən başqa heç bir meyara görə bölünmür | RB-AP-18 |
| Dərc | Sabit intervalla (hazırda 2 dəqiqə), dəyişiklik olmasa belə; siyahı 6 saat etibarlıdır; interval xaricində "təcili" dərc yoxdur; əvvəlcə məzmun paylanmasına, sonra lövbər jurnalına | RB-AP-17, RB-AP-19 |
| Fəaliyyəti dayandırılmış sənədi verən qurum | Ləğv siyahısı dərc etmir; xələf qurum dərc edə bilər | RB-AP-20, RB-REG-07 |
| Qüvvəyə minmə müddəti | Dərc intervalı + yoxlayan tərəfin əvvəlcədən yükləmə intervalı (bir neçə dəqiqə); ZK təqdimatında ən gec 24 saat | RB-GEN-10, [[ADR-0044]] K4 |
| Yoxlayan tərəf | Siyahıları əvvəlcədən toplu şəkildə yükləyir, hər yoxlamada yükləmir; siyahı köhnəlmişsə və ya əlçatan deyilsə, nəticə `REJECTED` deyil, `INDETERMINATE` olur | RB-RP-06, RB-GEN-03 |
| Rəqəmsal cüzdan | "Etibarsız" və "yoxlanıla bilmədi" fərqli göstərilir | RB-WP-12 |

# 7. Qeydiyyat və məxfilik

- Ləğv səbəbi siyahıda və rəqəmsal sənəddə yer almır; siyahı fərdi məlumatlar daşımır.
- Loglar və audit qeydləri ləğv siyahısındakı mövqeyi (`idx`) daşımamalıdır (**MUST NOT**) (RB-GEN-06).
- Sənədi verən qurum sənəd qeydlərinin və ləğv siyahısı uyğunlaşdırmasının mütəmadi ehtiyat nüsxəsini çıxarır; ləğv yalnız bu qeydlər əsasında edilə bilər (RB-AP-22).
- Siyahı mərhələsində hər iştirakçı ləğvin bir neçə dəqiqəyə qüvvəyə mindiyini bilir; bu hədd şəxslərə yazılı şəkildə bildirilir (RB-GEN-10).

# 8. Qərarlar və açıq məsələlər

| Mövzu | Status |
|---|---|
| Cüzdan vahidi ləğv edildikdə qurum sənədlərinin zəncirvari ləğvi | **Qərar (2026-10-12, [[ADR-0047]] K1):** edilmir; sənədlər cihaz açarına bağlıdır və vahid ləğv edildikdə istifadə oluna bilmir (§3.3). Şəxsiyyət xidməti öz sənədlərini ləğv edir (RB-AP-ID-12) |
| Sənədi verən qurumun öz əlavə ləğv siyasəti | **Qərar (2026-10-12, [[ADR-0047]] K2):** qurum istəsə, əlavə şərtlərini `revocation_policy_uri` ilə dərc edir; ümumi şərtləri daralda bilməz (§3.4, RB-AP-27) |
| Attestation Revocation List | Aİ yoxlayan tərəfin və rəqəmsal cüzdanın hər iki mexanizmi dəstəkləməsini tələb edir (VCR_10, VCR_12); sənədi verən quruma biri kifayətdir (VCR_11). **Paketlər 0.5.0:** yoxlayan tərəf və rəqəmsal cüzdan nüvəsi identifikatorlar siyahısını yoxlayır; Tamga-nın sənədi verən qurumları Status List dərc etməyə davam edir (bit əsaslı siyahı mövqe məlumatını daha yaxşı gizlədir; identifikatorlar siyahısı ləğv edilmiş sənədlərin sayını göstərir). mdoc üçün siyahının CWT formatı (CIR 2024/2979 Əlavə II EAA-6.2.10.1-07) paketlərin 0.6.0 versiyasındadır: mdoc kimi də verilən növün siyahısı əlavə olaraq CWT təqdimatı ilə dərc edilir, mdoc nüsxəsi CWT ünvanına işarə edir ([[ADR-0048]] K2, K3; RB-AP-28) |

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
