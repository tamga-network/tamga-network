---
document_id: ADR-0046
title: "Daxili açıqlama siyasəti"
status: Active
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-11
summary: >
  Sənədi verən qurum hər hansı rəqəmsal sənəd növünün yalnız müəyyən yoxlayan tərəflərə (və ya müəyyən səlahiyyətə malik olanlara, yaxud müəyyən etibar kökündən sertifikat almış olanlara) təqdim edilməsini tələb edə bilər. Qurum bu qaydanı imzalı Credential Issuer metadata-sında, sənəd konfiqurasiyasının daxilində dəyər kimi dərc edir; sənədin formatı dəyişmir. Rəqəmsal cüzdan qaydanı sənədi alarkən saxlayır, təqdimat zamanı onu yoxlayan tərəfin qeydiyyat sertifikatı (WRPRC) və giriş sertifikatı ilə müqayisə edir; uyğun gəlmirsə, təsdiq ekranında xəbərdarlıq edir və qərarı şəxsə buraxır (defolt seçim "paylaşma"). Siyasət əlavə edildikdə, dəyişdirildikdə və ya ləğv edildikdə qurum həmin növdəki sənədləri ləğv edir. Aİ ARF 3.0 Mövzu 43-ün 10 bəndini qarşılayır. Əhatə dairəsi yalnız qurum sənədləridir; qeydiyyat sertifikatına xidmət identifikatoru eyni mərhələdə əlavə olunur. Sahə adları təsdiqlənib. Paketlər: 0.5.0. Qəbul edilib: 2026-10-11.
domain: Trust
related: ["[[ADR-0026]]", "[[ADR-0024]]", "[[ADR-0028]]", "[[ADR-0023]]", "[[ADR-0029]]", "[[ADR-0042]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]", "[[FW-RB-0001]]"]
translation_of: ADR-0046
source_version: "1.0.0"
---

# Qısaca

Bu gün diplom və ya üzvlük sənədi şəxs təsdiq edərsə, etibar siyahısındakı istənilən yoxlayan tərəfə təqdim edilə bilər. Cüzdan yalnız
yoxlayan tərəfin qeydiyyatda olduğundan artıq məlumat tələb edib-etmədiyini yoxlayır ([[ADR-0026]] K5, artıq sorğu xəbərdarlığı). Avropa İttifaqı (Aİ) sənədi verənin
"bu sənəd yalnız bu yoxlayan tərəflərə təqdim edilsin" deyə bilməsini və cüzdanın bunu yoxlamasını tələb edir. Bu qərar həmin qaydanın harada
ötürüləcəyini, cüzdanın onu necə qiymətləndirəcəyini və şəxsə nə göstəriləcəyini müəyyən edir.

# Kontekst

**Aİ nə tələb edir** (ARF 3.0, Əlavə 2, Mövzu 43; əsas mətn §6.6.2.8, §6.6.3.4; İcra Reqlamenti (Aİ) 2024/2979 Əlavə III; ETSI TS 119 472-3
§4.2.5):

| Bənd | Xülasə |
|---|---|
| EDP_01 | Cüzdan sənədi verənə EAA üçün (QEAA, PuB-EAA, qeyri-kvalifikasiyalı EAA) isteğe bağlı daxili açıqlama siyasəti təyin etmək imkanı verir. PID üçün tələb yoxdur. |
| EDP_02 | "Yalnız səlahiyyətli yoxlayan tərəflər" siyasəti: (yoxlayan tərəfin identifikatoru, xidmət identifikatoru) cütlərinin siyahısı. Cüzdan cütü yoxlayan tərəfin **qeydiyyat sertifikatından** götürür (giriş sertifikatından deyil; vasitəçi olduqda giriş sertifikatı vasitəçini göstərir); siyahıda yoxdursa, qiymətləndirmə uğursuz sayılır və bu barədə şəxsə bildirilir. |
| EDP_03 | "Müəyyən etibar kökü" siyasəti: kök və ya aralıq sertifikatların siyahısı. Cüzdan qeydiyyat sertifikatını imzalayan zəncirdəki sertifikatları siyahı ilə müqayisə edir; heç biri yoxdursa, uğursuz sayılır və bu barədə şəxsə bildirilir. |
| EDP_05 (SHOULD + SHALL) | Siyasət qaydanı sadə dildə izah edən səhifəyə keçid ehtiva etməlidir; keçid varsa, cüzdan onu göstərir və açılmasına imkan verir. |
| EDP_06 | Cüzdan siyasəti qeydiyyat sertifikatındakı məlumatlarla birlikdə, ETSI TS 119 472-3-ün qiymətləndirmə qaydalarına əsasən qiymətləndirir. |
| EDP_07 | Cüzdan qiymətləndirmənin nəticəsinə görə şəxsə təqdimatı rədd etmək və ya icazə vermək imkanı verir. |
| EDP_08 | Format ETSI TS 119 472-3-ə uyğundur. |
| EDP_09 | Sənədi verən siyasəti (varsa) OpenID4VCI Credential Issuer metadata-sında **dəyər kimi** dərc edir. |
| EDP_10 | Cüzdan siyasəti sənədi alarkən əldə edir və saxlayır (təqdimat zamanı, xüsusən yaxın məsafədə, yenidən sorğu göndərmədən qiymətləndirə bilmək üçün). |
| EDP_11 | Siyasət əlavə edildikdə, dəyişdirildikdə və ya silindikdə sənədi verən sənədi ləğv edir. |

EDP_04 boşdur; cəmi 10 bənd.

**Reqlamentin Əlavə III-ündəki üç ümumi siyasət:** (1) siyasət yoxdur (defolt), (2) yalnız səlahiyyətli yoxlayan tərəflər, (3) müəyyən etibar kökü.
Siyasətlər sahə səviyyəsində deyil, sənəd səviyyəsindədir.

**ETSI TS 119 472-3 §4.2.5.2 məlumat modeli** (ISS-MDATA-EBD-01…13): unikal URI ilə müəyyən edilir; isteğe bağlı təsvir və məsul
orqan; "məhdudiyyət yoxdur" göstərə bilər; səlahiyyətli yoxlayan tərəflərin siyahısı: (a) giriş sertifikatının subyektinin fərqləndirici adı (RFC 4514 LDAP sətri;
hüquqi şəxs üçün `commonName`, `organizationName`, `organizationIdentifier`, `countryName`) və/və ya (b) qeydiyyat sertifikatındakı TS 119 475
səlahiyyət (entitlement) URI-ləri; etibar kökləri siyahısı (hər element: verənin fərqləndirici adı + sertifikatın seriya nömrəsi); genişlənmələr (cüzdan
nəzərə almaya bilər); sadə dildə izah səhifəsinə keçid. Siyasət yoxlayan tərəfə açıqlanmır. **ETSI JSON üzv adlarını müəyyən etmir.**

**ARF ilə ETSI arasındakı fərq:** ARF səlahiyyətli yoxlayan tərəfi qeydiyyat sertifikatındakı (identifikator, xidmət) cütü ilə, etibar kökünü isə qeydiyyat
sertifikatı zənciri ilə; ETSI və Reqlament isə subyekt adı və ya səlahiyyətlə və giriş sertifikatının kökü ilə təsvir edir. Qərar hər ikisini qəbul
edir (K3).

**Tamga-da bu gün:**
- Yoxlayan tərəfin qeydiyyat sertifikatı (WRPRC, `rc-wrp+jwt`) hər istifadə halı üçün yaradılır, OpenID4VP sorğusunda `verifier_info` ilə gəlir;
  cüzdan imzanı, müddəti və giriş sertifikatındakı `organizationIdentifier` ilə `sub` uyğunluğunu yoxlayır ([[ADR-0026]] K5).
  Ayrıca xidmət identifikatoru daşımır (ARF RPRC_17a qismən); istifadə halı identifikatoru `intended_use_id` mövcuddur.
- Sənədi verənin Credential Issuer metadata-sı imzalıdır və qurumun WRPRC-sini `issuer_info` ilə daşıyır.
- Sənəd konfiqurasiyasında `credential_metadata` altında `display` və `credential_reuse_policy` var.
- Kodda daxili açıqlama siyasəti yoxdur. EDP_02 "qismən" sayılır, çünki artıq sorğu yoxlaması oxşar qoruma təmin edir.
- Yaxın məsafədə (ISO 18013-5) və cüzdandan cüzdana sorğuda qeydiyyat sertifikatı yoxdur.
- [[ADR-0028]] K5 peşə fəaliyyəti sənədi üçün səlahiyyətə əsaslanan siyasət nümunəsi verir ("yalnız qeydiyyat sertifikatında səhiyyə
  xidməti göstərən səlahiyyəti olan yoxlayan tərəflərə") və JSON adlarını bu qərara həvalə edir.

# Nəzərdən keçirilmiş variantlar

## 1. Siyasətin yeri

| Variant | Nəticə | Səbəb |
|---|---|---|
| **İmzalı Credential Issuer metadata-sında, sənəd konfiqurasiyasının `credential_metadata` obyektində, dəyər kimi** | **seçildi** | EDP_09-un özüdür; sənəd formatı dəyişmir; metadata onsuz da imzalıdır və cüzdan onu sənədi alarkən oxuyur. |
| Sənədin daxilində (SD-JWT claim-i və ya mdoc elementi) | rədd | Siyasət yoxlayan tərəfə açıqlanmamalıdır (ETSI §4.2.5.1); sənəd formatı dəyişir; ARF "sənəd formatında dəyişiklik tələb olunmur" deyir. |
| URL ilə keçid, cüzdan təqdimat zamanı yükləyir | rədd | ARF "keçid deyil, dəyər" deyir (§6.6.2.8.3); yaxın məsafədə və oflayn rejimdə işləmir; təqdimat vaxtını sənədi verənə sızdırır. |
| Etibar siyahısındakı qurum qeydində | rədd | Aİ yolu deyil; Aİ cüzdanları bunu oxumur. |

## 2. Qiymətləndirmə uğursuz olduqda

| Variant | Nəticə | Səbəb |
|---|---|---|
| **Xəbərdarlıq et, qərarı şəxsə burax (defolt düymə "Paylaşma")** | **seçildi** | EDP_07 şəxsə "rədd et və ya icazə ver" seçimi verir; [[ADR-0026]]-nın artıq sorğu xəbərdarlığı ilə eyni model (WL8). |
| Qəti blokla | rədd (sual 3) | EDP_07 ilə ziddiyyət təşkil edir; Tamga-ya xas daha sərt qayda olur; Aİ cüzdanları xəbərdarlıqla kifayətlənir. |
| Sənədi verən "xəbərdarlıq et / blokla" seçsin | rədd (sual 3) | Yeni və Aİ-də qarşılığı olmayan sahədir; eyni sənəd Aİ cüzdanında fərqli davranır. |

## 3. Səlahiyyətli yoxlayan tərəfin necə müəyyən edildiyi

| Variant | Nəticə | Səbəb |
|---|---|---|
| **ARF cütü + ETSI subyekt adı + ETSI səlahiyyət URI-si; sadalananlardan hər hansı biri uyğun gələrsə, keçir** | **seçildi** | Həm ARF-ə, həm ETSI-yə uyğundur; qurum öz ehtiyacına uyğun olanı istifadə edir ("bu üç yoxlayan tərəf" və ya "bu səlahiyyətə malik hər kəs"). |
| Yalnız ARF cütü | rədd | ETSI formatında yazılmış Aİ siyasətlərini oxuya bilmir; səlahiyyətə əsaslanan "kateqoriya" qaydası qurula bilmir. |
| Yalnız ETSI | rədd | ARF-in vasitəçi qeydini (qeydiyyat sertifikatındakı identifikator əsasdır) qarşılamır. |

# Qərar

## K1 — Siyasətin yeri və formatı

Sənədi verən siyasəti olan hər sənəd konfiqurasiyası üçün imzalı Credential Issuer metadata-sında aşağıdakı obyekti dərc edir (ad və
üzv adları layihə rəhbərliyi tərəfindən **təsdiqlənib**; ETSI JSON adlarını müəyyən etmədiyi üçün bu, Tamga-nın seçimidir və ETSI məlumat modelini izləyir; Aİ və ya
ETSI JSON kodlaşdırması dərc edərsə, ona keçilir, [[ADR-0029]]):

```json
"credential_configurations_supported": {
  "<configuration>": {
    "credential_metadata": {
      "embedded_disclosure_policy": {
        "id": "https://institution.example/policy/diploma-1",
        "type": "authorized_relying_parties",
        "relying_parties": [{ "rp_id": "VATTR-1234567890", "service_id": "hiring" }],
        "subject_dns": ["ORGID=VATTR-1234567890,O=Example Ltd,C=TR"],
        "entitlements": ["<TS 119 475 entitlement URI>"],
        "info_uri": "https://institution.example/policy/diploma"
      }
    }
  }
}
```

- `id` (məcburi): siyasətin unikal URI-si (ETSI -01).
- `type` (məcburi): `none` · `authorized_relying_parties` · `specific_roots_of_trust` (Reqlamentin Əlavə III-ündəki üç siyasət).
- `authorized_relying_parties` üçün ən azı biri: `relying_parties` (ARF cütü; `rp_id` qeydiyyat sertifikatındakı `sub`, `service_id`
  isteğe bağlı), `subject_dns` (ETSI -07a), `entitlements` (ETSI -07b).
- `specific_roots_of_trust` üçün `roots_of_trust`: `[{ "issuer_dn": "<RFC 4514>", "serial_number": "<onaltılı>" }]` (ETSI -09).
- İsteğe bağlı: `info_uri` (EDP_05, ETSI -13), `authority` (ETSI -05), `description` (ETSI -04).
- Naməlum üzvlər və genişlənmələr nəzərə alınmır (ETSI -10/-11). Sahə səviyyəsində siyasət genişlənməsi (ETSI -12) dəstəklənmir.
- Siyasət sənədə daxil edilmir; yoxlayan tərəfə ötürülmür.
- Əhatə dairəsi: **yalnız qurum sənədləri** (EAA). Tamga şəxsiyyət sənədi (və onun ZK nüsxəsi), sürücülük vəsiqəsi məlumatları və əlaqə sənədləri
  siyasət daşımır; metadata generatoru bu növlərdə siyasəti rədd edir.

## K2 — Cüzdan: sənədi alarkən saxlama (EDP_10)

Cüzdan sənədi alarkən imzası yoxlanılmış metadata-dan siyasəti oxuyur, formatını yoxlayır və sənəd qeydinin yanında saxlayır
(siyasət + onun heşi). Təqdimat zamanı sənədi verənə və ya başqa serverə sorğu göndərilmir (WL9 ilə eyni prinsip). Formatı pozulmuş siyasət
sənədin alınmasını dayandırmır, lakin "qiymətləndirilə bilməz" kimi saxlanılır və təqdimat zamanı K4-dəki xəbərdarlığı yaradır.

## K3 — Cüzdan: qiymətləndirmə (EDP_02, EDP_03, EDP_06)

Təqdimat sorğusu daxil olduqda tələb olunan hər sənəd üçün, qeydiyyat sertifikatı [[ADR-0026]] K5-ə uyğun olaraq yoxlanıldıqdan sonra:

| Siyasət | Keçir, əgər |
|---|---|
| yoxdur və ya `none` | həmişə |
| `authorized_relying_parties` | (a) qeydiyyat sertifikatının `sub`-ı hər hansı `relying_parties` elementinin `rp_id`-sinə bərabərdirsə və elementdə `service_id` varsa, qeydiyyat sertifikatının xidmət identifikatoru da bərabərdirsə; **və ya** (b) sorğunu imzalayan giriş sertifikatının subyekt adı hər hansı `subject_dns` elementinə bərabərdirsə (RFC 4514 normallaşdırılmış müqayisə); **və ya** (c) qeydiyyat sertifikatının `entitlements` siyahısı hər hansı `entitlements` elementini ehtiva edirsə |
| `specific_roots_of_trust` | qeydiyyat sertifikatını imzalayan zəncirdəki (ARF EDP_03) və ya giriş sertifikatı zəncirindəki (Reqlament Əlavə III, ETSI -08) hər hansı sertifikatın (verənin adı, seriya nömrəsi) cütü siyahıdadırsa |

- Qeydiyyat sertifikatı yoxdursa (sorğuda gəlməyibsə; yaxın məsafədə; cüzdandan cüzdana) qiymətləndirmə **aparıla bilməz** və uğursuz sayılır.
- Vasitəçi sorğuda qeydiyyat sertifikatında göstərilən, vasitəçilik edilən yoxlayan tərəf əsas götürülür (ARF EDP_02 qeydi).
- Qeydiyyat sertifikatında xidmət identifikatoru hazırda yoxdur (RPRC_17a qismən). Xidmət identifikatoru əlavə edilənə qədər `service_id` olan element
  uyğun gəlmir; `service_id` olmayan element yoxlayan tərəfin bütün istifadələrini əhatə edir. Xidmət identifikatorunun WRPRC-yə əlavə edilməsi bu qərarın ilkin
  şərtidir və **eyni mərhələdə** (paketlər 0.5.0) həyata keçirilir.

## K4 — Təsdiq ekranı (EDP_05, EDP_07)

- Qiymətləndirmə uğurludursa, ekran dəyişmir.
- Uğursuzdursa və ya aparıla bilmirsə: ayrıca xəbərdarlıq bloku — "**[sənədi verən qurum]** bu rəqəmsal sənədin yalnız icazə verdiyi qurumlara təqdim edilməsini
  istəyir. **[yoxlayan tərəf]** bu icazəli qurumlar arasında deyil." (aparıla bilmədikdə: "...icazəli olub-olmadığı yoxlanıla bilmədi.").
  `info_uri` varsa, "Qaydanı oxuyun" keçidi. Defolt düymə **"Paylaşmayın"**; "Yenə də paylaşın" qısa gecikmə ilə aktivləşir
  (WL8 nümunəsi). Rəqəmsal cüzdan qəti əngəl qoymur: son qərar şəxsə məxsusdur (EDP_07).
- Bir neçə rəqəmsal sənəd tələb olunursa, xəbərdarlıq müvafiq sənədin sətrində göstərilir; şəxs həmin sənədi çıxarıb qalanlarını paylaşa bilər.

## K5 — Sənədi verən qurum: ləğv (EDP_11)

- Konfiqurasiyanın siyasəti əlavə edildikdə, dəyişdikdə və ya ləğv edildikdə sənədi verən qurum həmin konfiqurasiya ilə verilmiş, hələ də etibarlı olan bütün
  rəqəmsal sənədləri ləğv edir. Sənəd qeydi buraxılış anındakı siyasət xülasəsini saxlayır; ləğv xülasəyə əsasən aparılır.
- Qurum Konsolu siyasəti dəyişdirməzdən əvvəl neçə rəqəmsal sənədin ləğv ediləcəyini göstərir və təsdiq istəyir. Şəxslər sənədi yenidən alır;
  avtomatik yeniləmə şərtləri ([[ADR-0023]]) imkan verirsə, yeni nüsxələr yeni siyasətlə gəlir. Bu xərc qəbul edilib.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| EP1 | Daxili açıqlama siyasəti yalnız imzalanmış Credential Issuer metadata-sında, qurum sənədi konfiqurasiyasında dəyər kimi daşınır; rəqəmsal sənədə daxil edilmir və yoxlayan tərəfə göndərilmir. |
| EP2 | Rəqəmsal cüzdan siyasəti sənədi alarkən saxlayır və təqdimat zamanı şəbəkə sorğusu etmədən, qeydiyyat sertifikatı və giriş sertifikatı əsasında qiymətləndirir. |
| EP3 | Qiymətləndirmə uğursuzdursa və ya aparıla bilmirsə, rəqəmsal cüzdan təsdiq ekranında ayrıca xəbərdarlıq göstərir; defolt seçim paylaşmamaqdır, son qərar şəxsə məxsusdur. |
| EP4 | Siyasəti əlavə edilən, dəyişdirilən və ya ləğv edilən konfiqurasiyanın etibarlı rəqəmsal sənədləri ləğv edilir. |

# ARF uyğunlaşdırması (10 bənd)

| Bənd | Necə təmin edilir |
|---|---|
| EDP_01 | K1: qurum sənədləri üçün könüllü siyasət |
| EDP_02 | K3 (a): qeydiyyat sertifikatındakı (identifikator, xidmət) cütü; vasitəçi sorğuda vasitəçilik edilən yoxlayan tərəf; xidmət identifikatoru WRPRC-yə əlavə edilir |
| EDP_03 | K3: qeydiyyat sertifikatı zənciri (və giriş sertifikatı zənciri) |
| EDP_05 | K1 `info_uri`, K4 "Qaydanı oxuyun" |
| EDP_06 | K3: qeydiyyat sertifikatı ilə birlikdə, ETSI məlumat modelinə əsasən |
| EDP_07 | K4: xəbərdarlıq + "Paylaşmayın" / "Yenə də paylaşın" |
| EDP_08 | K1: ETSI TS 119 472-3 §4.2.5.2 məlumat modeli; JSON adları ETSI kodlaşdırması dərc edildikdə ona uyğunlaşdırılır |
| EDP_09 | K1: imzalanmış Credential Issuer metadata-sında dəyər kimi |
| EDP_10 | K2 |
| EDP_11 | K5 |

# Təsirə məruz qalan paketlər və versiya

Paketlər **0.5.0** ilə (yeni sahə və funksiya = minor):

| Paket | Dəyişiklik |
|---|---|
| `@tamga-network/schemas` | Siyasət obyektinin JSON Schema-sı və yoxlayıcısı |
| `@tamga-network/issuer` | Metadata generatoruna hər konfiqurasiya üçün siyasət; siyasət xülasəsi; format yoxlaması |
| `@tamga-network/trust` | RFC 4514 fərqləndirici adın təhlili və normallaşdırılması; sertifikatdan (verənin adı, seriya nömrəsi) çıxarılması |
| `@tamga-network/wallet-core` | Rəqəmsal sənədi alarkən saxlama; `evaluateDisclosurePolicy` (nəticə: keçdi / uğursuz / aparıla bilmədi + səbəb + keçid); nəticənin təsdiq görünüşünə ötürülməsi |
| `@tamga-network/verifier` | Dəyişiklik yoxdur (siyasət yoxlayan tərəfə açıqlanmır) |

Paketlərdən kənar: qeydiyyat sertifikatına xidmət identifikatoru (siyahı nəşriyyatçısı, RPRC_17a), host edilən sənəd vermə xidmətində sənəd qeydinə
siyasət xülasəsi və dəyişiklik zamanı toplu ləğv, Qurum Konsolunda siyasət redaktoru (operator reposu), cüzdan tətbiqlərində təsdiq
ekranı xəbərdarlığı.

# Nəticələr

- Spesifikasiyalar: [[SPEC-PROTO-0001]] metadata sahəsi; [[SPEC-WALLET-0001]] qiymətləndirmə və təsdiq ekranı qaydası;
  [[FW-RB-0001]] rulebook-da "giriş məhdudiyyəti" qaydası (ARF qeydi: məhdudiyyət rulebook-da da yoxlayan tərəflərə elan edilir); Tamga ARF-də etibar
  modeli və məxfilik tədbirləri sətirləri (qəbul zamanı yeniləndi; kod 0.5.0 ilə).
- Cüzdandan cüzdana və yaxın məsafədə təqdimatda siyasət qiymətləndirilə bilmir; siyasəti olan rəqəmsal sənəd bu yollarla xəbərdarlıqla (yaxın məsafə)
  təqdim edilir və ya ümumiyyətlə təqdim edilmir (cüzdandan cüzdana; cüzdanın öz qərarı).
- Siyasəti dəyişən qurum rəqəmsal sənədlərinin yenidən verilməsini qəbul edir; Qurum Konsolu bunu açıq şəkildə göstərir.

# Plan və qiymətləndirmə

| # | İş | Təxmini həcm (mühəndis-gün) |
|---|---|---|
| 1 | schemas: siyasət sxemi + testlər | 0,5 |
| 2 | issuer: metadata, siyasət xülasəsi, format yoxlaması + testlər | 1 |
| 3 | trust: RFC 4514 normallaşdırma, (verənin adı, seriya nömrəsi) + testlər | 1 |
| 4 | Qeydiyyat sertifikatına xidmət identifikatoru (siyahı nəşriyyatçısı + cüzdan yoxlaması, RPRC_17a) | 1 |
| 5 | wallet-core: saxlama + qiymətləndirmə + təsdiq görünüşü; siyasət növləri × qeydiyyat sertifikatı var/yox × vasitəçi sorğu test matrisi | 2 |
| 6 | Host edilən sənəd vermə: sənəd qeydində siyasət xülasəsi, dəyişiklik zamanı toplu ləğv; Qurum Konsolu redaktoru | 2 |
| 7 | Cüzdan tətbiqi: təsdiq ekranında xəbərdarlıq bloku, "Qaydanı oxuyun", i18n | 1 |
| 8 | Sandbox-da başdan-sona ssenari (siyasəti olan sınaq rəqəmsal sənədi; icazəli və icazəsiz yoxlayan tərəf) | 0,5 |
| 9 | Spesifikasiyalar, rulebook, Tamga ARF | 1 |
| | **Cəmi** | **≈ 10 gün** |

Bütün işlər kod və sənədləşdirmə işidir; cihaz və ya sertifikat tələb olunmur.

# Cavablandırılmış suallar (2026-10-11)

1. **Adların təsdiqi:** `embedded_disclosure_policy`, növlər `none` / `authorized_relying_parties` / `specific_roots_of_trust` və üzv adları — **təsdiqləndi** (K1).
2. **Əhatə dairəsi:** — **Yalnız qurum sənədləri**; Tamga şəxsiyyət və əlaqə sənədləri siyasət daşımır (K1).
3. **Xəbərdarlıq, yoxsa əngəl:** — Rəqəmsal cüzdan **xəbərdarlıq edir, qərarı şəxs verir**; defolt "Paylaşmayın" (K4).
4. **Toplu ləğv:** — **Qəbul edildi**: siyasət dəyişdikdə həmin növdəki etibarlı rəqəmsal sənədlər ləğv edilir və yenidən verilir (K5).
5. **Xidmət identifikatoru:** — Qeydiyyat sertifikatına xidmət identifikatoru **eyni mərhələdə** əlavə edilir (K3).

# Status

**Accepted — 2026-10-11.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-TRUST-5. Kod paketlərin 0.5.0 versiyası ilə.
