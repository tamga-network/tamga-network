---
document_id: SPEC-WALLET-0001
title: "Rəqəmsal cüzdan qaydaları"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-19
summary: >
  Rəqəmsal cüzdanın açar, yerli yaddaş, ehtiyat nüsxə və təsdiq dizaynını müəyyən edir. Mərkəzi nəticə bir ZİDDİYYƏTİN həllidir: [[SPEC-CRED-0001]] §3 sənəd sahibi açarının təhlükəsiz zonadan çıxa bilməyəcəyini bildirir, lakin layihə qeydlərindəki "24 sözlük seed ilə ehtiyat nüsxə" dizaynı açarın bərpa oluna biləcəyini nəzərdə tuturdu. İkisi eyni anda doğru ola bilməz — seed-dən törədilə bilən sənəd sahibi açarı isə rəqəmsal sənədi ÖTÜRÜLƏ BİLƏN edərək holder binding boşluğunu arxa qapıdan geri qaytarır. Qərar: açarlar seed-dən törədilmir; ehtiyat nüsxə sənədləri və manifesti daşıyır, cihaz dəyişdikdə sənədlərin YENİDƏN VERİLMƏSİ tələb olunur. Bundan əlavə, toplu verilən nüsxələrin hər yoxlayan tərəf üçün sabit ("yapışqan") istifadəsi iki açıq məsələni birdən bağlayır.
translation_of: SPEC-WALLET-0001
source_version: "1.0.0"
---

# Qısaca

Bu sənəd Tamga Network ilə uyğun hər bir rəqəmsal cüzdanın daxilində riayət etməli olduğu qaydaları izah edir: açarlar, telefondakı qeyd,
ehtiyat nüsxə, təsdiq ekranı və sənəd nüsxələri. Oxucusu cüzdan tərtibatçılarıdır; Tamga Wallet (ayrıca repozitoriya) bu qaydaların istinad
tətbiqidir.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Məxfilik](/concepts/privacy) və [Sənədin təqdim edilməsi](/concepts/presentation) konsepsiya səhifələrini oxuyun.
- Koda keçərkən [[GUIDE-0005]] bu qaydaları `@tamga-network/wallet-core` ilə necə yerinə yetirəcəyinizi göstərir.
- Cüzdanın qurum və [[t:verifier|yoxlayan tərəflə]] əlaqə saxladığı protokollar burada deyil: [[SPEC-PROTO-0001]] və [[SPEC-PROTO-0002]].

**Sadə izah**

Sənədə bağlı açarlar telefonun təhlükəsiz aparat hissəsində yaradılır və oradan heç vaxt çıxmır; buna görə ehtiyat nüsxəyə düşmür, telefon
dəyişdikdə sənədlər qurumdan yenidən alınır. Şəxs hər paylaşımda nəyin kimə getdiyini görür və təsdiqləyir; lazım olandan artıq
məlumat istəyən sayt üçün ayrıca xəbərdarlıq göstərilir. Cüzdan eyni sənədin bir neçə nüsxəsini saxlayır: eyni sayta həmişə eyni nüsxəni, fərqli
saytlara fərqli nüsxələri təqdim edir; beləliklə saytlar şəxsi bir-biri ilə uyğunlaşdıra bilmir. "Tamga ilə daxil ol" funksiyasında hər sayt üçün
ayrıca psevdonim istifadə olunur. Şəxs istəsə, cüzdanı sıfırlayaraq məlumatlarını həm Tamga xidmətlərindən, həm də telefondan silə bilər.

---

# Əhatə dairəsi

Cüzdanın **daxili** dizaynı: açarların idarə edilməsi, yerli yaddaş, ehtiyat nüsxə və bərpa,
təsdiq interfeysi, sənəd nüsxələrinin istifadəsi, sxem keşi.

Protokollar [[SPEC-PROTO-0001]] və [[SPEC-PROTO-0002]] sənədlərində verilir. [[t:WIA]] və [[t:key-attestation]]
[[ADR-0025]] sənədindədir; bu sübutları [[t:wallet-provider|cüzdan provayderi]] verir.

---

# 1. Həll edilən ziddiyyət — Açarın ehtiyat nüsxəsi çıxarıla bilərmi?

Bu bölmə sənədin ən vacib hissəsidir, çünki **mövcud iki dizayn qərarı
bir-birinə zidd idi.**

## 1.1 Ziddiyyət

[[SPEC-CRED-0001]] §3 deyir:

> Açar cihazın secure element-ində yaradılır (Secure Enclave/StrongBox), heç vaxt
> ixrac edilə bilməz → **sənəd ötürülə bilməz.**

Layihə qeydlərindəki ehtiyat nüsxə dizaynı isə bunu nəzərdə tuturdu:

> 24 sözlük toxum + məcburi PIN; serverdə şifrələnmiş ehtiyat nüsxə (server onu deşifrə edə bilməz).

Əgər toxum cüzdanı **istifadəyə yararlı** vəziyyətdə bərpa edirsə, deməli [[t:holder|sənəd sahibi]] açarını
da bərpa edir. Lakin sənəd sahibi açarı təhlükəsiz zonadan çıxa bilmirsə,
toxum onu bərpa edə bilməz.

**İkisi eyni anda doğru ola bilməz.**

## 1.2 Açar nə üçün toxumdan törədilə bilməz

Cəlbedici variant belədir: sənəd sahibi açarlarını toxumdan törət, proqram təminatında saxla, hər
yerdə bərpa oluna bilsin.

Bu variant **rədd edilmişdir**, çünki [[t:holder-binding]] sənədini bütövlükdə puça çıxarır:

| | Nəticə |
|---|---|
| Toxum → sənəd sahibi açarı törədilə bilər | Toxum paylaşıla bilər |
| Toxum paylaşıla bilər | Sənəd **ötürülə bilər** |
| Sənəd ötürülə bilər | [[SPEC-CRED-0001]] §3-dəki boşluq geri qayıdır |

Həmin sənədin öz ifadəsi ilə: "tələbə sənədini dostunun cüzdanına
yüklədir" hücumu sənəd verilərkən bağlanır, lakin **bərpa zamanı** yenidən
açılmış olur. Arxa qapı ön qapıdan daha təhlükəlidir, çünki ora heç kim
baxmır.

## 1.3 Qərar

**Dəyişməz qayda WL1:** Sənəd sahibi açarları **seed-dən törədilmir** və cihazın təhlükəsiz
zonasından **heç vaxt çıxmır.**

**Dəyişməz qayda WL2:** Ehtiyat nüsxə **sənədləri** və **manifesti** daşıyır;
sənəd sahibi açarlarını daşımır. Buna görə yeni cihazda bərpa edilmiş
sənəd **təqdim edilə bilməz** — sənədin yenidən verilməsi tələb olunur.

Bu, qəbul edilmiş istifadəçi təcrübəsi bədəlidir. Alternativi sistemin
əsas təhlükəsizlik xüsusiyyətini itirməkdir.

## 1.3b Qiymətləndirilmiş üçüncü yol (review R10)

Qərar iki variant arasında verilmişdi; üçüncü variant da var və açıq şəkildə
rədd edilməlidir: **platforma ilə sinxronlaşdırılan açarlar** (iCloud Keychain /
Google Password Manager tipli, aparat dəstəkli, lakin cihazlar arasında daşına bilən
açar sinifləri).

| | Qiymətləndirmə |
|---|---|
| Üstünlük | Cihaz dəyişdikdə sənədlərin yenidən verilməsi tələb olunmur; istifadəçi təcrübəsi ən yaxşısıdır |
| Çatışmazlıq 1 | Etibar Tamga-dan **Apple/Google-a** keçir — açarın hara getdiyini onlar müəyyən edir |
| Çatışmazlıq 2 | Eyni hesabdakı başqa cihaz açarı əldə edir → "sənəd ötürülə bilməz" prinsipi (WL1) hesab səviyyəsində pozulur |
| Çatışmazlıq 3 | EUDI ARF bu sinfi W3 (sertifikatlı WSCD) hesab etmir; dövlət mərhələsində dövlət uyğunluğu riskə düşür |

**Rədd edildi.** Lakin genişlənmə mərhələsində W2 səviyyəsi üçün isteğe bağlı "asan
bərpa" rejimi kimi yenidən nəzərdən keçirilə bilər — əgər istifadəçi şüurlu şəkildə
aşağı təminat səviyyəsini seçirsə. Hazırda bu, məhsulun mürəkkəbləşməsinə dəyməz.

## 1.4 Toxumun real rolu

Toxum düşünüldüyündən **daha məhdud** iş görür:

| Toxum nəyi bərpa edir | Nəyi bərpa etmir |
|---|---|
| Cüzdan identifikatoru (ehtiyat nüsxənin deşifrə açarı) | Sənəd sahibi açarları |
| Sənədlərin özü (oxuna bilər, təqdim edilə bilməz) | Təqdimetmə imkanı |
| Manifest: hansı qurumdan hansı tip | — |
| Ayarlar, dil, təqdimetmə qeydi | — |

Manifest həlledicidir: yeni cihazda istifadəçiyə **"bu 4 sənədi yenidən istə"**
kimi bir toxunuşla icra olunan siyahı təqdim edir. Bərpanın çətinliyini aradan qaldırmır, lakin
onu idarəolunan edir.

---

# 2. Açar arxitekturası

## 2.1 Açar növləri

| Açar | Harada | İxrac edilə bilər | Ömür |
|---|---|---|---|
| **Sənəd sahibi açarları** (bir alışda N ədəd) | Secure Enclave / StrongBox | **Xeyr** | Sənədin ömrü |
| **Ehtiyat nüsxə şifrələmə açarı** | Toxumdan törədilir | Toxum şəklində | Daimi |
| **Cüzdan nümunəsi açarı** | Təhlükəsiz zona | Xeyr | Quraşdırmanın ömrü |

## 2.2 Cüzdan təminat səviyyələri

[[PM-ASSUR-0001]] A oxunun cüzdan tərəfindəki komponenti:

| Səviyyə | Açar yaddaşı | Faza |
|---|---|---|
| **W1** | Proqram təminatı (təhlükəsiz zona yoxdur) | Dəstəklənmir (sandbox siyahısındakı şəbəkənin öz sınaq ssenariləri üçün test açarı istisna olmaqla — [[ADR-0042]] K5) |
| **W2** | Cihazın təhlükəsiz zonası (Secure Enclave / StrongBox) | **ilk mərhələ üçün minimum** |
| **W3** | Sertifikatlı WSCD | Dövlət mərhələsi |

**Dəyişməz qayda WL3:** W1 cüzdan dəstəklənmir (sandbox siyahısındakı şəbəkənin öz sınaq ssenariləri üçün test açarı istisna olmaqla — [[ADR-0042]] K5). Təhlükəsiz zonası olmayan cihazda
Tamga Wallet quraşdırılmır — istifadəçiyə aydın xəbərdarlıqla rədd edilir.

## 2.3 PIN

Yoxlayan tərəfə təqdimat üçün təhlükəsiz zonadakı açara çıxışın şərti **istifadəçinin doğrulanmasıdır**; doğrulama açarı şifrələmir (bunu aparat təminatı edir).
Doğrulamanın yolu açarın harada saxlandığından asılıdır:

- **Təhlükəsiz aparat açarı olan cihazda** sənəd açarı telefonun kilidinə bağlıdır: yalnız kilid açıq olduqda və cihazın
  biometriyası və ya cihaz parolu ilə istifadə olunur. Təqdimetmə təsdiqi bu əməliyyat sistemi sorğusudur (tək sorğu); tətbiqin ayarları
  onu söndürə bilməz. Bu yolda tətbiq PIN-i və tətbiqdaxili biometriya yalnız cüzdanın kilidini açır.
- **Proqram açarı yolunda** (təhlükəsiz aparatdan istifadə edə bilməyən mühit, müvəqqəti kənarlaşma S-9) təqdimetmə təsdiqi tətbiq PIN-i və ya
  tətbiqdaxili biometriyadır.

| Qayda | Dəyər |
|---|---|
| Uzunluq (tətbiq PIN-i) | Ən azı 6 rəqəm |
| Biometriya | PIN-in **əvəzinə** deyil, onunla yanaşı (ehtiyat variant PIN-dir) |
| Cəhd | 5 səhv → 30 san gecikmə; 10 → rəqəmsal cüzdan kilidlənir, toxum tələb olunur |
| Təqdimatın təsdiqi | Yoxlayan tərəfə hər təqdimatda istifadəçinin doğrulanması **məcburidir**: təhlükəsiz aparatda cihaz biometriyası və ya cihaz parolu; proqram açarı yolunda PIN və ya biometriya |
| Ehtiyat variant | Əməliyyat sisteminin sorğusu texniki və ya müvəqqəti səbəbdən göstərilə bilmirsə (ön planda pəncərə yoxdur, doğrulama xidməti əlçatan deyil), tətbiq PIN-i soruşulur. İstifadəçi sorğudan **imtina edərsə**, ehtiyat variant yoxdur: təqdimat edilmir |

**Təqdimatın təsdiqi sətri vacibdir:** Yoxlayan tərəfə təqdimat istifadəçinin şüurlu hərəkəti olmalıdır. Açıq
rəqəmsal cüzdanın arxa planda səssizcə təqdimat etməsinin qarşısı alınır. Şəxsin başlatmadığı axınlar (keçid kartının yenilənməsi, nüsxənin
yenilənməsi) sorğu göstərmir; doğrulama tələb olunursa, həmin dövr ötürülür.

---

# 3. Yerli yaddaş

```
┌──────────────────────────────────────┐
│ Secure area (hardware)               │
│   holder keys — cannot leave         │
├──────────────────────────────────────┤
│ Encrypted local database             │
│   credentials    SD-JWT strings      │
│   batch_state    copy ledger         │
│   verifier_map   sticky mapping      │
│   schema_cache   Type Metadata       │
│   presentation_log  presentation log │
│   settings                           │
└──────────────────────────────────────┘
```

**Dəyişməz qayda WL4:** `presentation_log` avtomatik olaraq və ya serverə **heç bir halda** çıxmır; yalnız şəxsin özünün başlatdığı, öz parolu ilə şifrələnmiş ixracda (Aİ TS10, [[ADR-0027]]) cihazdan çıxır —
ehtiyat nüsxəyə də daxil edilmir ([[SPEC-PROTO-0002]]/PV8). Ehtiyat nüsxəyə daxil edilsəydi, cihaz dəyişdikdə
şifrələnmiş şəkildə də olsa serverə yüklənər və davranış profili
mərkəzləşmiş olardı.

İstifadəçi bu qeydi görə və silə bilər.

---

# 4. Sənəd nüsxələrinin idarə edilməsi

> Bu bölmə [[SPEC-PROTO-0001]] Açıq Məsələ 1 və [[SPEC-CRED-0002]] Açıq Məsələ 3-ü
> bağlayır.

## 4.1 Sabit nüsxə qaydası

**Dəyişməz qayda WL5:** Yoxlayan tərəfə **həmişə eyni** nüsxə təqdim edilir.
Fərqli yoxlayan tərəflərə **fərqli** nüsxələr təqdim edilir.

```
verifier_map: (verifier_id, vct) → copy_index
```

Əsaslandırma iki istiqamətli məntiqə söykənir:

| İstiqamət | Səbəb |
|---|---|
| **Eyni yoxlayan tərəfə eyni nüsxə** | Yoxlayan tərəf onsuz da şəxsin kim olduğunu bilir (müraciət adlıdır). Fərqli nüsxə təqdim etmək korrelyasiyaya qarşı qazanc vermir, yalnız nüsxə sərf edir. |
| **Fərqli yoxlayan tərəfə fərqli nüsxə** | İki yoxlayan tərəf əməkdaşlıq etsə, `cnf` və `idx` vasitəsilə uyğunlaşdırma apara bilməz ([[SPEC-CRED-0003]] §9.4). |

`verifier_id`, [[t:x509_hash]] client identifier-idir ([[SPEC-PROTO-0002]] §2.1) —
sabit və yoxlanıla bilən açar.

## 4.2 Ardıcıl açıqlama dəsti

**İnvariant WL6:** Eyni yoxlayan tərəfə eyni `vct` üçün edilən təkrar təqdimatlarda
rəqəmsal cüzdan **eyni açıqlama dəstindən** istifadə edir.

Səbəb [[SPEC-SCHEMA-0002]] Təhlükəsizlik Qeydlərində göstərilib: dəyişən dəst hansı
sahələrin gizlədildiyi barədə məlumat verir. Birinci təqdimatda 8, ikincisində 6
sahə açıqlanarsa, yoxlayan tərəf ikisi arasındakı fərqi çıxara bilər.

Yoxlayan tərəf daha az sahə istəsə, rəqəmsal cüzdan **artığını təqdim etmir** — kəsişmə deyil,
yeni sorğunun özü əsas götürülür; lakin istifadəçiyə "bu yoxlayan tərəfə əvvəllər bu
sahələri vermişdiniz" məlumatı göstərilir.

## 4.3 Tükənmə

| Qalan nüsxə | Rəqəmsal cüzdanın davranışı |
|---|---|
| 3 | Səssiz — parametrlərdə görünür |
| 2 | İstifadəçiyə bildiriş: "Tələbə sənədiniz üçün 2 istifadə qaldı" |
| 0, **tanış** yoxlayan tərəf | Sabit eşləmə sayəsində mövcud nüsxədən istifadə olunur — problem yoxdur |
| 0, **yeni** yoxlayan tərəf | İstifadəçiyə seçim: (a) yenilə, (b) mövcud nüsxəni təkrar istifadə et — **korrelyasiya xəbərdarlığı ilə** |

**İnvariant WL7:** İstifadəçi əməliyyatı olmadan yeniləmə yalnız [[ADR-0023]] AR1–AR4 şərtləri daxilində aparılır.
Yeniləmə tokeni olan qurum sənədləri qurumun
elan etdiyi həddə, tətbiq ön planda və kilid açıq olduqda, təsadüfi gecikmə ilə yenilənir; şəxsiyyət və əlaqə sənədlərində yeniləmə
istifadəçi əməliyyatıdır (yeganə istisna §4.5-dəki ZK nüsxələridir). İstifadəçi bunu parametrlərdən söndürə bilər.

## 4.4 Diplom

[[SPEC-PROTO-0001]] §8.5-ə əsasən diplom da digər qurum sənədləri kimi **10 nüsxə** şəklində verilir (2026-10-08; əvvəlki qərara görə
pilotda bir nüsxə idi). Sabit eşləmə tətbiq olunur: hər yoxlayan tərəfə ayrıca nüsxə gedir. Nüsxələr tükəndikdə rəqəmsal cüzdan yenidən
imzalatdırır; istifadəçi eyni nüsxəni bilərəkdən təkrar istifadə edərsə, rəqəmsal cüzdan bunun əlaqələndirilə bilmə (linkability) yaratdığını göstərir.

## 4.5 ZK nüsxələri ([[ADR-0044]])

Sıfır bilikli sübutla təqdimat (`mso_mdoc_zk`, [[ADR-0032]]) ləğv siyahısındakı mövqeyi açıqlamır. Buna görə ZK ilə şəxsiyyət sənədinin
özü deyil, şəxsiyyət xidmətinin ayrıca verdiyi **qısa ömürlü ZK nüsxəsi** göstərilir:

| Mövzu | Qayda |
|---|---|
| Növ | `urn:tamga:id:ShortLivedIdentityAttestation:1` (yalnız ISO 18013-5 mdoc; ad sahəsi `tamga.id.1`). Sübut növü bağladığı üçün yoxlayan tərəf qısa ömrü görür |
| Məzmun | Yalnız ZK ilə sübut edilə bilən elementlər (bu gün `age_over_18`); ad, doğum tarixi, şəxsiyyət nömrəsi yoxdur |
| Etibarlılıq | Ən çox 24 saat (və əsas sənədin bitmə tarixindən sonra deyil); ləğv siyahısında qeyd yoxdur (ARF VCR_01) |
| Paket | Kiçik paket (3 nüsxə); hər nüsxə öz cihaz açarına bağlıdır |
| Alınma | Şəxsiyyət sənədi ilə birlikdə gələn yeniləmə tokeni ilə (OpenID4VCI `grant_type=refresh_token`, DPoP + WIA); token birdəfəlikdir, hər istifadədə dəyişir; məzmunu rəqəmsal cüzdan üçün qapalıdır |
| Yeniləmə | Son nüsxənin bitməsinə 8 saat qalmış pəncərə açılır, təsadüfi gecikmə ilə (ən çox 6 saat) səssizcə yenilənir; etibarlı nüsxə yoxdursa, dərhal və ya ZK sorğusu gəldikdə. [[ADR-0023]] K1 şərtləri və "nüsxələri avtomatik yenilə" parametri qüvvədədir: parametr söndürülübsə, ZK nüsxəsi alınmır və ZK təqdimatı edilmir |
| Ləğv | Əsas sənəd ləğv edilib və ya dayandırılıbsa, şəxsiyyət xidməti yeni nüsxə vermir (`invalid_grant`); rəqəmsal cüzdan bağlantını və nüsxələri silir. Əldə qalan nüsxə ən geci 24 saat ərzində etibarsız olur |
| Təqdimat | ZK sorğusu yalnız etibarlı ZK nüsxəsi ilə cavablandırılır; əsas sənədin nüsxələri ZK-da istifadə olunmur. Nüsxə yoxdursa, sorğu cavablandırılmır və klassik variant (`mso_mdoc` / `dc+sd-jwt`) seçilir (ZK5). ZK sübutu əlaqələndirilə bilmədiyi üçün sabit nüsxə (WL5) tələb olunmur |

Kod: `@tamga-network/wallet-core` `refreshZkCopies`, `scheduleZkRefreshes`, `selectZkCopy`; şəxsiyyət xidmətinin son nöqtəsi
[[SPEC-PROTO-0001]] §4.1.

---

# 5. Təsdiq interfeysi

## 5.1 Təqdimatın təsdiq ekranı

Minimal məzmun, bu ardıcıllıqla:

1. **Kim istəyir** — yoxlayan tərəfin [[t:trust-list|etibar siyahısında]] qeydə alınmış adı + qeydiyyatda olub-olmaması işarəsi
2. **Nə üçün** — `purpose` mətni ([[SPEC-API-0001]] §4.1)
3. **Nə paylaşılacaq** — dəyərləri ilə birlikdə sahə-sahə siyahı
4. **Nə paylaşılmayacaq** — gizli qalan sahələrin **adları** (dəyərləri deyil)
5. Təsdiqlə / İmtina et

Dördüncü bənd qeyri-adidir və bilərəkdən əlavə edilib: istifadəçi [[t:selective-disclosure]]-ın
işlədiyini **görməlidir**. "Orta balınız paylaşılmayacaq" sətri
məhsulun dəyərini bir baxışda izah edir.

## 5.2 Həddindən artıq tələb xəbərdarlığı

> [[SPEC-PROTO-0002]] Açıq Mövzu 1-i bağlayır.

Üç səviyyə, üç fərqli vizual çəki:

| Vəziyyət | Təqdimat |
|---|---|
| Qeydiyyatda + scope daxilində | Adi ekran, xəbərdarlıq yoxdur |
| Qeydiyyatda + **scope xaricində sahə var** | Scope xaricindəki sahələr siyahıda **ayrıca blokda**, fərqli rəngdə, "bu yoxlayan tərəf bu sahələri istəməyə səlahiyyətli deyil" başlığı ilə göstərilir. Təsdiq düyməsi **3 saniyə gecikmə ilə** aktivləşir. |
| **Qeydiyyatda olmayan yoxlayan tərəf** | Axını kəsən ayrıca ekran: "Bu yoxlayan tərəf Tamga-da qeydiyyatda deyil. Onun kim olduğunu yoxlaya bilmirik." → Davam et / Ləğv et |

**Xəbərdarlıq yorğunluğuna qarşı tədbir:** Xəbərdarlıq yalnız **həqiqətən anormal** vəziyyətdə
göstərilir. Adi axında heç bir xəbərdarlıq yoxdur. Xəbərdarlığı hər təqdimata əlavə etsək,
o görünməz olar.

**İnvariant WL8:** Həddindən artıq tələb xəbərdarlığı təsdiq düyməsinin yanındakı mətn
deyil; ayrıca vizual blok və gecikməli düymə tələb edir.

## 5.3 Təkrarlanan fərqli sorğular

[[SPEC-PROTO-0002]] Təhlükəsizlik Qeydləri: yoxlayan tərəf fərqli sorğular göndərərək
istifadəçinin hansı sənədlərə malik olduğunun xəritəsini çıxara bilər.

Eyni yoxlayan tərəfdən **24 saat ərzində 3-dən çox fərqli sorğu** gəldikdə rəqəmsal cüzdan
istifadəçini məlumatlandırır: "Bu yoxlayan tərəf bu gün 4 fərqli sənəd soruşdu."

## 5.4 Hər sayt üçün psevdonim ([[ADR-0031]])

"Tamga ilə daxil ol" hesab açarı kimi sənəd dəyərindən deyil, **hər sayt üçün ayrıca [[t:pseudonym|psevdonimdən]]** istifadə edir ([[t:ARF]]
Topic 11).

| Addım | Rəqəmsal cüzdan nə edir |
|---|---|
| Toxum (seed) | Şəxsiyyət sənədi ilə birlikdə gələn `urn:tamga:id:PseudonymSeed:1` sənədini yoxlayır (şəxsiyyət sənədi ilə eyni imzalayan, 0 nömrəli nüsxənin açarı) və toxumu təhlükəsiz anbara yerləşdirir (Keychain / Keystore; mağaza versiyasında aparat səviyyəsində qorunan). Toxum sənəd siyahısında görünmür, heç bir DCQL sorğusuna təklif edilmir (PS3). |
| Sorğu | DCQL-də `format: "tamga-pseudonym"` sorğusu (`meta.mode`: `single` / `multiple`). Sənəd sorğusu yoxdursa, sorğu yalnız psevdonimlə girişə (sənədsiz) uyğun gəlir. |
| Təsdiq ekranı | "Bu sayta məxsus psevdoniminiz" kartı: yenidir, yoxsa əvvəl istifadə olunub (dəyər göstərilmir). `multiple` saytda istifadəçi mövcud psevdonimlərindən birini və ya yenisini seçir. Psevdonim yalnız etibar siyahısında qeydiyyatda olan sayta verilir. |
| Törətmə | PIN/biometrik təsdiqdən sonra: `k = HKDF-SHA256(tohum, "tamga-pseudonym-v1\|" + site + "\|" + sıra)` → P-256 açarı; psevdonim = açıq açarın RFC 7638 barmaq izi. Sayt = əsas RP-nin qeydiyyatdakı `client_id`-si (vasitəçi olduqda əsas RP; ADR-0017 K7). Açar yalnız yaddaşda saxlanılır, imzadan sonra silinir. |
| Təqdimat | vp_token-də psevdonim sorğusunun id-si ilə `tamga-pseudonym+jwt`: başlıqda açıq açar, gövdədə `aud` = client_id, `nonce`, `rp`, bu əməliyyat üçün yeni WIA və PoP. |
| Psevdonimlərim | Parametrlər: sayt adı, yaradılma / son istifadə tarixi, istifadəçinin verdiyi ad (sayta göndərilmir), sil. Silinmiş sıra nömrəsi həmin saytda bir daha törədilmir; yenidən qeydiyyat yeni sıra nömrəsi açır. Jurnala yalnız sayt adı və hadisə yazılır, psevdonimin dəyəri yazılmır. |

Yeni telefonda şəxsiyyət yenidən doğrulandıqda eyni toxum gəlir → eyni psevdonimlər → saytlardakı (yoxlayan tərəflərdəki) hesablar tanınır. Köçürmə faylı
(§7.5) toxumu və açarı daşımır (LX2).

---

## 5.5 Sənədi verən qurumun paylaşım qaydası — daxili açıqlama siyasəti ([[ADR-0046]], 2026-10-11; kod 0.5.0)

Qurum müəyyən qurum sənədi növünün yalnız müəyyən yoxlayan tərəflərə göstərilməsini istəyə bilər (ARF Mövzu 43). Qayda imzalı Credential
Issuer metadata-sında `credential_metadata.embedded_disclosure_policy` kimi gəlir ([[SPEC-PROTO-0001]] §2.1).

- **Saxlama (EDP_10):** cüzdan sənədi qəbul edərkən siyasəti imzası yoxlanmış metadata-dan oxuyur, formatını yoxlayır və sənədin
  yanında saxlayır. Formatı pozulmuş siyasət sənədin qəbulunu dayandırmır; "qiymətləndirilə bilməz" kimi saxlanılır.
- **Qiymətləndirmə (EDP_02/03/06):** təqdimat zamanı, qeydiyyat sertifikatı yoxlandıqdan sonra, şəbəkə sorğusu etmədən:
  `authorized_relying_parties` → qeydiyyat sertifikatının `sub`-i (və varsa xidmət identifikatoru) `relying_parties` elementinə, giriş
  sertifikatının subyekt adı (RFC 4514 üzrə normallaşdırılmış) `subject_dns` elementinə və ya qeydiyyat sertifikatının səlahiyyətlərindən biri
  `entitlements` elementinə bərabərdirsə, keçir; `specific_roots_of_trust` → qeydiyyat və ya giriş sertifikatı zəncirindəki sertifikatlardan birinin
  (verənin adı, seriya nömrəsi) cütü siyahıdadırsa, keçir. Vasitəçi sorğuda vasitəçilik edilən yoxlayan tərəf əsas götürülür: `rp_id` qeydiyyat
  sertifikatının `sub`-idir və giriş sertifikatının subyekt adı (vasitəçinin adı) uyğunluq sayılmır. Qeydiyyat sertifikatı yoxdursa
  (yaxın məsafə, cüzdandan cüzdana) qiymətləndirmə aparıla bilmir və uğursuz sayılır.
- **Müqayisə təfərrüatı:** xidmət identifikatoru qeydiyyat sertifikatının `service_id` üzvüdür (ARF RPRC_17a; siyahı dərcçisi
  istifadənin `service_id`-ni, yoxdursa `scope_id`-nu yazır); `service_id` olmayan element yoxlayan tərəfin bütün istifadələrini əhatə edir. Ad
  müqayisəsində atribut növləri OID-ə çevrilir (ETSI TS 119 472-3: `ORGID` = organizationIdentifier, `SN` =
  serialNumber), dəyərlərdə böyük-kiçik hərf və artıq boşluqlar nəzərə alınmır, RDN sırası nəzərə alınmır; bütün atributlar tam eyni
  olmalıdır. Etibar kökü elementi seriya nömrəsi uyğun gələn və `issuer_dn`-i sertifikatın verən adına bərabər olan sertifikatla uyğunlaşır
  (IssuerSerial; özünü imzalayan kökdə verənin adı subyekt adı ilə eynidir; subyekt adı ilə uyğunlaşma yoxdur). Ad və seriya nömrəsi
  kopyalana bildiyi üçün yalnız imza zənciri yarpaqdan həmin sertifikata qədər yoxlanmış və etibara bağlanmış sertifikatlar sayılır:
  qeydiyyat sertifikatı zənciri imzalı siyahıdakı qeydiyyat qurumunun açarından başlayır (onu birbaşa imzalayan özünü imzalayan kök də
  sayılır); giriş sertifikatı zənciri yalnız imzalı siyahıdan gələn etibarlı CA barmaq izinə çatdıqda sayılır. Element yalnız
  yoxlanıla bilməyən sertifikatla uyğun gəlirsə, nəticə "qiymətləndirilə bilməz"dir (xəbərdarlıq, standart seçim "Paylaşma"), heç vaxt "keçdi"
  deyil. İstinad tətbiqi: `@tamga-network/wallet-core`
  `checkDisclosurePolicy` (nəticə `passed` / `failed` / `not_evaluable`, səbəb və `info_uri`).
- **Təsdiq ekranı (EDP_05/07):** uğursuz olduqda və ya qiymətləndirmə aparıla bilmədikdə ayrıca xəbərdarlıq bloku ("[qurum] bu sənədin yalnız icazə verdiyi qurumlara
  göstərilməsini istəyir"), `info_uri` varsa "Qaydanı oxu"; standart düymə **"Paylaşma"**, "Yenə də paylaş" gecikmə ilə aktivləşir (§5.2 nümunəsi).
  Qəti blok yoxdur; son qərar şəxsə məxsusdur.

**İnvariant EP2/EP3** ([[ADR-0046]]): siyasət sənəd qəbul edilərkən saxlanılır və təqdimat zamanı şəbəkə sorğusu etmədən qiymətləndirilir; uyğun gəlmirsə, ayrıca
xəbərdarlıq göstərilir, standart seçim paylaşmamaqdır.

## 5.6 Qurum üstünlükləri, xarici siyahılar, cüzdandan cüzdana (kod 0.5.0)

- **Qurumun cüzdan sübutu üstünlükləri (Aİ ARF WUA_05a, WUA_32):** cüzdan sənəd tələb edərkən qurumun metadata-sındakı
  `key_attestations_required` tələbini və `preferred_*` ləğv yoxlama müddəti üstünlüklərini oxuyur; tələbə cavab verməyən KA-nı göndərmir,
  yoxlama müddəti qısa qalan WIA və KA əvəzinə provayderdən daha uzun müddətlisini istəyir ([[SPEC-PROTO-0001]]).
- **Xarici siyahılar (ADR-0036; ARF ISSU_10b):** cüzdan LOTL-dakı xarici siyahıları (ETSI TS 119 602 LoTE və ETSI TS 119 612 TL) imzaçıları
  LOTL-da sabitlənmiş şəkildə yükləyə bilər; xarici siyahılardan biri yoxlanıla bilmirsə, yalnız o yüklənmir.
- **İki ləğv mexanizmi (ARF VCR_10):** cüzdan yoxlayan tərəf rolunda (cüzdandan cüzdana) Status List-i və Attestation Revocation
  List-i yoxlayır.
- **Cüzdandan cüzdana (ARF Mövzu 30):** protokol nüvədədir (`wallet-core`); hansı növün və sahələrin göstərilə biləcəyi cüzdanın
  qərarıdır. Sənədi verən qurumun paylaşım qaydası ilə məhdudlaşdırılmış sənəd cüzdandan cüzdana göstərilmir; yaxın məsafədən təqdimatda təsdiq ekranı
  qaydanın qiymətləndirilə bilmədiyini bildirir ([[ADR-0046]] Nəticələr).

## 5.7 Aİ ilə uyğunlaşdırma (kod 0.6.0)

- **Qeydiyyat sertifikatı olmayan sorğu ([[ADR-0026]] K5; [[ADR-0056]] K10):** şəxsdən soruşulmadan rədd edilir (`registration_missing`;
  təfərrüat [[SPEC-PROTO-0002]] §7.5); cüzdandan cüzdana yaxın məsafə istisnadır. Yaxın məsafədə qeydiyyat sertifikatı `requestInfo.euWrprc` ilə gəlir
  və uzaqdan axında olduğu kimi yoxlanılır; etibarsızdırsa, cüzdan şəxsdən soruşmadan rədd edir (`presentProximity` `registrarKeys`).
- **Cüzdandan cüzdana təqdimat təklifi (Aİ TS9 v1.1):** təqdim edən tərəf icazə siyahısında olan və sənədində mövcud olan sahələri QR-dakı
  DeviceEngagement-ə (`-1`) təklif kimi yerləşdirir. Təklifdən kənar və ya saxlama niyyətli sorğuda heç bir sahə göndərmədən
  `DeviceResponse.status = 10` ilə dayandırır; cavab sorğunun alınmasından sabit müddət sonra göndərilir (cavab müddəti sənəddən asılı
  deyil). Yoxlayan tərəf yalnız təklifdəki sahələri tələb edə bilər. Sahə siyahısını göstərməzdən əvvəl şəxsin doğrulanması (STS9_13)
  cüzdanın vəzifəsidir.
- **Jurnal hadisələri (DASH_02, DASH_03b):** `issuance_failed` (qurum, növ, səbəb kodu), `reissued`, `w2w_verified` (yoxlayan tərəf
  rejimində yalnız vaxt, sənəd növü və nəticə — sahə və dəyər yoxdur). **Saxlama müddəti (DASH_02a):** şəxs 30 / 90 / 180 / 365 gün
  seçə bilər (standart olaraq müddətsiz); müddəti bitən qeydlər silinməzdən əvvəl cüzdan xəbərdarlıq edir (`upcomingLogDeletions`) və şəxs təxirə salarsa,
  silinmir (`applyLogRetention` çəngəli).
- **"Tamga Network-də siyahıdadır" göstəricisi ([[ADR-0049]]):** cüzdan yoxlanmış etibar siyahısındakı öz provayder qeydini
  `walletProviderListing(providerId, { solutionId, unitRevoked })` ilə oxuyur; qeyd və həll `ACTIVE`, siyahı aktual və real şəbəkənin
  siyahısıdırsa, vahid ləğv edilməyibsə, göstərici görünür və toxunduqda rəsmi ad, status, barmaq izi və siyahının vaxtı göstərilir.
- **Ləğv siyahısı:** şəxsiyyət sənədlərində dayandırma yoxdur (`bits = 1`); mdoc nüsxəsinin siyahısı CWT təqdimatıdır ([[ADR-0048]]).

# 6. Sxem keşi

[[ARCH-0003]]/CMP8-in tətbiqi.

| Qayda | Dəyər |
|---|---|
| Nə vaxt yüklənir | Quraşdırma zamanı və **yeni növ sənəd qəbul edildikdə** |
| Necə | Toplu şəkildə — bütün müvafiq Type Metadata + `extends` zənciri |
| Nə vaxt yüklənmir | **Təqdimat anında** |
| Etibarlılıq | Müddətsiz — `vct#integrity` məzmunu müəyyən edir ([[SPEC-SCHEMA-0001]] §7.1) |

**İnvariant WL9:** Cüzdan təqdimat anında `schemas.tamga.network`-ə sorğu göndərmir.
Göndərsəydi, sxem serveri "kim hansı növ sənədi nə vaxt istifadə etdi" məlumatını
toplayardı.

Keşdə olmayan növ təqdim edilmək istənərsə, istifadəçiyə "bu sənəd növü
hələ yoxlanıla bilmir, internet bağlantısı tələb olunur" deyilir və **yükləmə
istifadəçinin təsdiqi ilə** aparılır.

---

# 7. Ehtiyat nüsxə və bərpa

## 7.1 Ehtiyat nüsxənin məzmunu

```
encrypted_backup = AES-GCM(
    key     = HKDF(seed),
    content = {
        manifest:    [{ issuer, vct, received_at }],
        credentials: [SD-JWT strings],
        settings:    { language, notifications }
    }
)
```

**Ehtiyat nüsxəyə daxil olmayanlar:** sənəd sahibinin açarları (WL1), `presentation_log` (WL4),
`verifier_map`.

`verifier_map` niyə daxil deyil: yeni cihazda onsuz da yeni nüsxələr alınacaq, köhnə
uyğunlaşdırmanın mənası yoxdur. Bundan əlavə, o, hansı yoxlayan tərəflərə təqdimat edildiyini daşıyır — WL4 ilə
eyni əsaslandırma.

## 7.2 Server tərəfi

Ehtiyat nüsxə Tamga tərəfindən saxlanılan anbara yüklənə bilər. Server onu **deşifrə edə bilməz** —
açar toxumdan törədilir və toxum serverə göndərilmir.

| Serverin gördüyü | Görmədiyi |
|---|---|
| Şifrələnmiş blob-un ölçüsü | Məzmun |
| Yükləmə vaxtı | Hansı sənədlər |
| Cüzdan nümunəsinin identifikatoru | İstifadəçinin şəxsiyyəti |

## 7.3 Cihaz dəyişmə axını

```
1. Install on the new device
2. Enter the seed + set a new PIN
3. Download and decrypt the backup
4. The manifest is shown:
     ┌──────────────────────────────────────────┐
     │ 4 of your credentials must be re-issued  │
     │                                          │
     │ ☑ Diploma — Example University           │
     │ ☑ Student certificate — Example Univ.    │
     │ ☐ Driving licence — (state stage)            │
     │                                          │
     │ [ Request the selected ones again ]      │
     └──────────────────────────────────────────┘
5. An OID4VCI flow for each (SPEC-PROTO-0001)
     → new holder keys, new cnf, new idx
```

**İstifadəçiyə açıq şəkildə bildirilir:** köhnə sənədlərə baxmaq olar, lakin
onları təqdim etmək olmaz; sənədlər yenidən verilməlidir. Bunu gizlətmək təqdimat anında uğursuzluqla
üzləşməkdən daha pisdir.

## 7.4 Toxumun itirilməsi

Toxum **və** cihaz itirilərsə, bərpa mümkün deyil. İstifadəçi hər quruma
**yenidən müraciət edir** və şəxsiyyətini qurumun öz proseduru ilə sübut edir
([[SPEC-PROTO-0001]] §11 — üzbəüz bağlama).

Bu fəlakət deyil: sənədlər onsuz da qurumda yenidən yaradıla bilən
məlumatlardır. İtirilən **giriş imkanıdır**, məlumat deyil.

**İnvariant WL10:** Tamga heç bir halda istifadəçi adından bərpa açarı
saxlamır. Saxlasaydı, bütün cüzdanları aça biləcək mərkəz yaranardı.

## 7.5 Aİ TS10 köçürmə faylı

Cüzdan Aİ TS10 formatında köçürmə faylı yaradır (Parametrlər → Yeni telefona köçür):

- **Məzmun:** `MigrationData`, yəni yenidən alınacaq sənədlərin siyahısı (`listOfCredentials`: vct, qurum, qurumun ünvanı).
  Cihaza bağlı olmayan sənəd yoxdur.
- **Şifrələmə:** şəxsin parolu ilə JWE `PBES2-HS256+A128KW` + `A128GCM` (TS10 §5).
- **Paylaşım:** paylaşım menyusu vasitəsilə şəxsin seçdiyi yerə göndərilir; Tamga-ya göndərilmir.
- **Yeni cüzdanda:** şəxs faylı açır, siyahı "yenidən al" düymələri ilə qurumun səhifəsinə yönləndirir (WL2).

Sənəd dəyərləri, nüsxələr və açarlar fayla daxil edilmir. Əməliyyat jurnalı fayla daxil edilir ([[ADR-0027]]); idxal zamanı şəxsdən
jurnalın bərpa edilib-edilməməsi soruşulur. Jurnal həmçinin ayrıca şifrələnmiş fayl kimi ixrac edilə bilər (TS10 §4.1).

## 7.6 Cüzdanı sıfırla və məlumatlarımı sil

Parametrlər → **Cüzdanı sıfırla və məlumatlarımı sil** (mağaza qaydaları: tətbiqin daxilindən silmə; KVKK m. 7). Ardıcıllıq:

1. **Şəxsiyyət xidməti** — şəxsiyyət xidmətindən alınmış hər rəqəmsal sənəd üçün sahə açmadan təqdimat (SD-JWT VC + KB-JWT; aud = yoxlayan tərəf kimi xidmət,
   nonce = xidmətin `/nonce`-ı) → `POST {id}/erasure`. Xidmət rəqəmsal sənədi öz imzasından, sahibliyi isə `cnf` açarından
   tanıyır; qeydi və hadisə sətirlərini silir, bütün nüsxələri ləğv edir, uzaqdan şəxsiyyət doğrulaması provayderindəki sessiyanı və
   təsvirləri sildirir ([[SPEC-ID-0003]] §9.1).
2. **Cüzdan provayderi** — cüzdan vahidinin açarı ilə imzalanmış `POST {wp}/units/delete`: cüzdan vahidi ləğv edilir (WIA bitləri), sonra qeyd
   (açıq açar, versiya, cihaz sübutu məlumatı) silinir ([[ADR-0025]]).
3. **Cihaz** — bütün rəqəmsal sənədlər və açarlar, psevdonim toxumu, jurnal, PIN (WL1: bərpa yoxdur).

Şəbəkə olmasa da 3-cü addım yerinə yetirilir; 1–2 yerinə yetirilə bilmirsə, şəxsə bildirilir və e-poçt yolu göstərilir. Qurumların (sənədi verən qurum, yoxlayan tərəf) saxladığı
məlumatlar qurumdadır; yol TS7 silmə tələbidir (Tarixçə → "Məlumatlarımın silinməsini istə").

---

# 8. İnvariantlar

| # | Dəyişməz qayda |
|---|---|
| **WL1** | Sənəd sahibinin açarları seed-dən törədilmir; təhlükəsiz zonanı tərk etmir. |
| **WL2** | Ehtiyat nüsxə rəqəmsal sənədləri və manifesti daşıyır; açarları daşımır — cihaz dəyişdikdə rəqəmsal sənədlər yenidən verilməlidir. |
| **WL3** | W1 (proqram açarlı) rəqəmsal cüzdan dəstəklənmir (sandbox siyahısındakı şəbəkənin öz sınaq ssenariləri üçün test açarı istisnadır — [[ADR-0042]] K5). |
| **WL4** | `presentation_log` heç bir halda serverə və avtomatik olaraq çıxmır, serverdəki ehtiyat nüsxəyə daxil olmur; yalnız şəxsin özünün başlatdığı, şəxsin parolu ilə şifrələnmiş ixracda (TS10) cihazdan çıxır ([[ADR-0027]]). |
| **WL5** | Bir yoxlayan tərəfə həmişə eyni nüsxə; fərqli yoxlayan tərəfə fərqli nüsxə. |
| **WL6** | Eyni yoxlayan tərəf + eyni `vct` üçün disclosure dəsti ardıcıl qalır. |
| **WL7** | İstifadəçi əməliyyatı olmadan yeniləmə yalnız [[ADR-0023]] AR1–AR4 şərtlərində aparılır. |
| **WL8** | Həddindən artıq sorğu xəbərdarlığı ayrıca vizual blok + gecikdirilmiş düymə tələb edir. |
| **WL9** | Təqdimat anında sxem serverinə sorğu göndərilmir. |
| **WL10** | Tamga istifadəçi adından bərpa açarı saxlamır. |
| **WL11** | Hər təqdimat istifadəçinin təsdiqlənməsini tələb edir: təhlükəsiz aparat açarı olan cihazda cihazın biometrikası və ya cihaz parolu (rəqəmsal sənəd açarı telefon kilidinə bağlıdır); proqram açarı yolunda (S-9) tətbiq PIN-i və ya biometrika. Ehtiyat yol (fallback) və imtina §2.3-dədir. |
| **WL12** | Keçid kartı jetonu (`tamga-pass+jwt`) fərdi məlumatlar daşımır: yalnız `iss` (qeyri-şəffaf pass_id), `aud`, `iat` (≤ indi + 30 s), `exp` (ömrü ≤ 60 s; ≤ indi + 60 s + 30 s saat sürüşməsi tolerantlığı), `jti`; rəqəmsal sənədin məzmunu və claim-lər QR-a daxil olmur ([[ADR-0012]]). |
| **WL13** | Keçid kartı yalnız etibar siyahısında qeydiyyatda olan RP/terminal qrupu üçün yaradılır və qeydiyyat zamanı verilən razılıq müddətli (≤ 6 ay) və əhatəsi müəyyən olunmuşdur; istifadəçi razılığı istədiyi an geri götürür (grant silinir). WL11-in yeganə istisnasıdır. |
| **WL14** | Keçid kartının hər göstərilməsi `presentation_log`-a yazılır (WL4 çərçivəsində, cihazda); Göstər ekranı canlı saatı və müddəti göstərir. |
| **WL15** | Sayt psevdonim açarları sənəd sahibinin açarı deyil: yalnız [[ADR-0031]] toxumundan sayt və sıra nömrəsi üzrə törədilir, daimi saxlanmır; toxum yalnız cihazın təhlükəsiz anbarında qalır, ehtiyat nüsxəyə, köçürmə faylına və heç bir təqdimata daxil olmur. |

---

# Təhlükəsizlik və məxfilik qeydləri

**Bərpa holder binding-in ən zəif nöqtəsidir.** §1.2-dəki mühakimə
təkrarlanmalıdır: asan bərpa tələb edən hər dizayn təklifi "bu, rəqəmsal sənədi
ötürülə bilən edirmi?" sualından keçməlidir. Cavab bəli olarsa, təklif rədd edilir.

**Ehtiyat nüsxənin ölçüsü bir siqnaldır.** Server blob ölçüsündən neçə rəqəmsal sənəd
olduğunu təxmin edə bilər. Azaltma: ehtiyat nüsxə sabit ölçülü bloklara qədər doldurulur
(padding).

**Sabit uyğunlaşdırma siyahı saxlayır.** `verifier_map` istifadəçinin hansı
yoxlayan tərəflərə təqdimat etdiyini ehtiva edir — `presentation_log` qədər həssasdır və
eyni qaydalara tabedir (cihazda qalır, ehtiyat nüsxəyə daxil olmur).

**PIN bloklanması DoS səthidir.** Cihazı ələ keçirən şəxs 10 dəfə səhv
PIN daxil edərək rəqəmsal cüzdanı bloklaya bilər. Qəbul edilmiş riskdir — alternativi kobud güc
hücumuna açıq qoymaqdır.

---

# Açıq məsələlər

1. Yeni cihazda rəqəmsal sənədlərin yenidən verilməsi qurumun həmin şəxsi hələ də tanımasını tələb edir.
   Məzun 10 il sonra cihazını dəyişsə, universitet nə edəcək? Qurumdaxili
   proses sualı → PM-GTM-0001.
2. W3 (sertifikatlı WSCD) dövlət mərhələsində necə müəyyən ediləcək — cihaz attestation-ı
   ilə, yoxsa ayrıca aparatla? → `SPEC-WALLET-0002`
3. Ehtiyat nüsxənin sabit ölçüyə qədər doldurulması nə qədər bahalıdır? Ölçülməlidir.
4. Çoxlu cihaz (planşet + telefon) dəstəklənirmi? Hazırda xeyr — hər cihaz
   ayrıca sənəd sahibi açarı deməkdir, deməli, hər cihaz üçün ayrıca rəqəmsal sənəd verilməsi. Toplu əldəetmə
   bunu qismən həll edə bilər, lakin dizayn edilməyib.
5. `verifier_map` istifadəçiyə göstərilməlidirmi? Şəffaflıq baxımından bəli, lakin
   "hansı işəgötürənlərə müraciət etmisiniz" siyahısı telefonu ələ keçirən şəxsə də görünür.

---

# Əlaqəli sənədlər

[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-SCHEMA-0001]] ·
[[SPEC-SCHEMA-0002]] · [[SPEC-API-0001]] · [[ARCH-0003]] · [[PM-ASSUR-0001]] ·
[[PM-GOV-0001]] · [[INVARIANTS]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02; son yenilənmə 2026-10-04).

