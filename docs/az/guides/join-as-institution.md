---
document_id: GUIDE-0007
title: "Qurum kimi şəbəkəyə qoşulmaq"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-20
summary: >
  Qurumun sənədi verən qurum kimi Tamga Network-a qoşulması, ilk təmasdan canlı istifadəyə qədər addım-addım: sandbox-da sınaq, müraciət faylı və Aİ-nin ümumi qeydiyyat məlumatları (yoxlama siyahısı), açarlar və sertifikat sorğusu (CSR), qurumun sorğu nöqtəsi, etibar siyahısına daxil olma və sənəd növü səlahiyyəti, Qurum Konsolu hesabı, ilk sənəd, ləğv və qeydiyyat dəyişiklikləri.
translation_of: GUIDE-0007
source_version: "1.0.0"
---

# Qurum kimi şəbəkəyə qoşulmaq

Bu bələdçi şəxslərə rəqəmsal sənəd vermək istəyən qurumlar (universitet, peşə təşkilatı, dövlət qurumu, tədbir təşkilatçısı)
və onların texniki komandaları üçündür. Nümunələr universitetin tələbə arayışı və diplom verməsinə əsaslanır.

**Nə vaxt oxunur:**
- Qurumunuz ilk dəfə sənəd verəcəksə, müraciətdən əvvəl.
- Əvvəl: [Sənədin verilməsi](/concepts/issuance) anlayışı. Sonra: [[GUIDE-0003]] (sənədin texniki olaraq verilməsi).
- Yoxlayan tərəf kimi qoşulursunuzsa (sənəd tələb edən sayt, otel, işəgötürən), bunun əvəzinə [[GUIDE-0008]].

## Necə işləyir?

Qurumun sənədinə etibar edilməsinin yeganə yolu qurumun [[t:trust-list|etibar siyahısında]] qeydiyyatda olmasıdır. Yoxlayan tərəf
sənədi imzalayan sertifikatı siyahıda axtarır; qurum oradadırsa və həmin sənəd növünü verməyə səlahiyyətlidirsə, sənəd qəbul edilir.
Qoşulmaq bu qeydiyyatdan keçmək və sənəd verməyə başlamaq deməkdir. Hazırda qeydiyyat qurumu və siyahının operatoru Tamga-dır; dövlət öz
siyahısını dərc etdikdə bu rol dövlətə keçir ([[ADR-0035]] PO3). Özəl açarınız heç bir mərhələdə sizdən kənara çıxmır.

## Addım-addım: ilk təmasdan canlı istifadəyə qədər

| # | Addım | Kim | Harada | Ətraflı |
|---|---|---|---|---|
| 0 | Sandbox-da sınayın | Qurumun komandası | sandbox.tamga.network → "Qurumunu sına" | §1 |
| 1 | Müraciət faylını və sənədləri hazırlayın | Hüquq, tələbə işləri, informasiya texnologiyaları | aşağıdakı yoxlama siyahısı | §2 |
| 2 | Açarları yaradın, sertifikat sorğusu (CSR) göndərin | İnformasiya texnologiyaları / təhlükəsizlik | qurumun HSM-i və ya məsafədən imza xidməti | §3 |
| 3 | Sorğu nöqtəsini qurun | İnformasiya texnologiyaları | tələbə informasiya sisteminin önündə | §4 |
| 4 | Baxış, sertifikatlar, siyahıya daxil olma | Qeydiyyat qurumu | trust.tamga.network (ən geci 24 saat) | §5 |
| 5 | Qurum Konsolu hesabı | Qurumun administratoru | dəvət keçidi + passkey | §6 |
| 6 | İlk sənəd | Tələbə işləri | Qurum Konsolu → Sənəd ver, və ya API | §7 |
| 7 | Ləğv, dayandırma, qeydiyyat dəyişikliyi, çıxış | Tələbə işləri / qeydiyyat qurumu | Qurum Konsolu → Sənədlər | §8 |

## 1. Sandbox-da sınayın (müraciət tələb olunmur)

`sandbox.tamga.network` şəbəkənin ayrıca test şəbəkəsidir: onun öz test kökü və test kimi işarələnmiş siyahıları var; oradakı sənədlər heç bir
yerdə etibarlı deyil ([[GUIDE-0013]]).

1. **Test qurumu yaradın** — "Qurumunu sına"; uydurma ad yazın, sonuna "(TEST)" əlavə olunur. Real qurum adları və rəsmi
   sözlər ("Universiteti", "Nazirliyi" kimi) qəbul edilmir.
2. **Qurum Konsoluna daxil olun** — birdəfəlik dəvət keçidi ilə passkey yaradın.
3. **Qeydlər əlavə edin** — bir-bir və ya CSV ilə (ən çox 200 sətir), yalnız uydurma məlumatlarla. Diplom üçün qeydin məzuniyyət
   sahələrini (ixtisas dərəcəsi, EQF səviyyəsi, tarix) və proqramın 4 rəqəmli ISCED-F kodunu doldurun.
4. **Masa arxasında sənəd verin** — QR kodu sandbox-a qoşulmuş rəqəmsal cüzdanla oxudun, PIN-i daxil edin.
5. **Yoxlayın** — sandbox səhifəsindəki nümunə yoxlayan tərəflərə təqdim edin ("Tələbə endirimi", "Diplom yoxlaması"); Konsoldan
   ləğv edin və eyni sənədin növbəti dərcdən sonra rədd edildiyini görün.

Hər şey hər gecə saat 03:30-da (Türkiyə vaxtı ilə) silinir; sandbox qurumu real şəbəkəyə köçürülmür.

## 2. Müraciət faylı və yoxlama siyahısı

Müraciət JSON faylıdır. Aİ-nin ümumi qeydiyyat məlumat dəsti məcburidir ([[ADR-0024]]); çatışmayan sahə varsa, qeydiyyat aparılmır və qeydiyyat
qurumu bütün çatışmazlıqları bir dəfəyə bildirir.

**Qurumun təqdim edəcəyi məlumatlar**

| Məlumat | Müraciətdəki sahə | Qeyd |
|---|---|---|
| Rəsmi ad və göstərilən ad | `legal_name`, `trade_name` | Rəsmi ad sertifikata da yazılır (latın hərfləri ilə) |
| Rəsmi identifikasiya nömrəsi | `identifiers` | VKN (`TR-VKN`) və ya MERSİS (`TR-MERSIS`); sertifikatlara və qeydiyyat sertifikatına daxil edilir |
| Poçt ünvanı | `postal_address` | |
| Əlaqə | `contact` | Dəstək ünvanı və fərdi məlumatlarla bağlı müraciətlər üçün e-poçt |
| Məlumatların mühafizəsi orqanı və müraciət yolu | `supervisory_authority` | Türkiyədə KVKK; forma ünvanı, e-poçt və ya telefondan ən azı biri |
| Qurumun sahəsi, sinfi, təminat səviyyəsi | `category`, `class`, `assurance`, `assurance_basis` | Aşağıdakı cədvəl |
| Sənəd növləri | `vcts` | [Sxem kataloqundan](/specifications/schema-catalog); yeni növ əvvəlcə [[SPEC-SCHEMA-0001]] prosesindən keçir |
| Səlahiyyətli mənbə | `authentic_source` | Məlumatın gəldiyi sistemin adı; rejim `REMOTE` (§4) |
| Əlavə ləğv şərtləri səhifəsi (varsa) | `revocation_policy_uri` | İstəyə bağlı, https |
| Sorğu nöqtəsinin ünvanı | — (yerləşdirilmiş xidmətin konfiqurasiyası) | §4 |
| Şəxsiyyətin uyğunlaşdırılması üçün domen adı və məxfilik siyasəti | — (ayrıca qeyd, §5) | Qurumunuza məxsus domen adı; siyasət səhifəsi rəqəmsal cüzdanda göstərilir |
| Qurum Konsolunun ilk administratoru | — | Ad və korporativ e-poçt; dəvət keçidi ona göndərilir |

**Tələb olunan sənədlər** (səviyyədən asılı olaraq; [Qoşulma prosesi](https://arf.tamga.network/az/onboarding))

| Sənəd | I1 | I2 | I3 |
|---|---|---|---|
| Domen adına sahiblik (DNS yoxlaması) və əlaqə məlumatı | ✓ | ✓ | ✓ |
| Aİ-nin ümumi qeydiyyat məlumatları (yuxarıdakı cədvəl) | ✓ | ✓ | ✓ |
| Hüquqi şəxs statusunun sübutu (MERSİS və Ticarət Reyestri Qəzeti və ya təsis qanunu) və imza səlahiyyətlisinin təsdiqi | — | ✓ | ✓ |
| İmzalanmış qoşulma müqaviləsi və KVKK əlavələri (yerləşdirilmiş xidmətdən istifadə olunursa, məlumatların emalı müqaviləsi) | — | ✓ | ✓ |
| Açarların HSM-də olduğunun və ya kvalifikasiyalı elektron möhürdən istifadə edildiyinin sübutu | — | — | ✓ |

| Sahə | Dəyərlər | Mənası |
|---|---|---|
| `category` | `EDUCATION`, `HEALTH`, `GOVERNMENT`, `FINANCE`, `LOGISTICS`, `EVENTS`, `IDENTITY`, `OTHER` | Qurumun sahəsi |
| `class` | `PUB`, `QUALIFIED`, `EAA` | Dövlət qurumunun sənədi, kvalifikasiyalı sənəd və ya adi sənəd ([[t:EAA]]) |
| `assurance` | `I1`, `I2`, `I3` | Qurumun təminat səviyyəsi; əsası `assurance_basis` sahəsində yazılır ([[ADR-0005]]). Diplom üçün minimum I2 |

```json
{
  "slug": "example-uni",
  "legal_name": "Example University",
  "trade_name": "Example University",
  "category": "EDUCATION",
  "class": "EAA",
  "assurance": "I2",
  "assurance_basis": "Recognised university; identity proofing by presentation of a Tamga Identity Attestation.",
  "cert": "issuer-example-uni",
  "status_cert": "issuer-example-uni-status",
  "vcts": ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  "authentic_source": { "name": "Example University Student Information System", "mode": "REMOTE" },
  "identifiers": [{ "scheme": "TR-VKN", "value": "TR0000000000" }],
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "postal_code": "34000", "country": "TR" },
  "contact": { "support_uri": "https://example.edu.tr/support", "email": "privacy@example.edu.tr" },
  "supervisory_authority": { "name": "Kişisel Verileri Koruma Kurumu (KVKK)", "country": "TR", "info_uri": "https://www.kvkk.gov.tr", "form_uri": "https://www.kvkk.gov.tr" }
}
```

Tam nümunə: repozitoriyada `apps/trust-publisher/registry/examples/issuer-application.example.json`. `slug` qurumun daimi qısa adıdır
(yerləşdirilmiş xidmətin ünvanı `issuer.tamga.network/<slug>`); qeydiyyat qurumu ilə birlikdə seçilir və bir dəfə istifadə olunmuş ad, qeydiyyat
bağlansa belə, yenidən verilmir.

## 3. Açarlar və sertifikat sorğusu

İki açar cütü yaradırsınız; hər ikisi P-256 (ES256) olur və hər ikisi sizdə qalır:

| Açar | İmzaladığı | Müraciətdəki adı |
|---|---|---|
| Sənəd açarı | Verdiyiniz sənədlər | `cert` |
| Ləğv siyahısı açarı | [[t:status-list|Ləğv siyahınız]] | `status_cert` |

Hər biri üçün sertifikat sorğusu (CSR) yaradıb müraciətlə birlikdə göndərin:

```sh
openssl ecparam -name prime256v1 -genkey -noout -out issuer.key.pem
openssl req -new -key issuer.key.pem -subj "/CN=Example University/O=Example University/C=TR" -out issuer.csr.pem
```

Qeydiyyat qurumu CSR-in imzasını yoxlayır və kök sertifikat orqanı vasitəsilə 2 illik (ən çox 3) sertifikat verir; sertifikatın subyekt
sahəsinə qurumunuzun identifikasiya nömrəsi (`organizationIdentifier`, məs. `VATTR-…`), rəsmi adınız və ölkəniz yazılır ([[ADR-0050]],
[[SPEC-ID-0002]]).

Açarın harada saxlanması sənəd vermə üsulunuzdan asılıdır:

- **Öz sənəd vermə xidmətiniz:** açar sizin HSM-inizdə və ya bulud açar idarəetmə sisteminizdə olur; xidməti özünüz idarə edirsiniz.
- **Yerləşdirilmiş xidmət:** açar yenə sizdə qalır — qurumunuzun HSM-ində və ya müqavilə bağladığınız etibarlı xidmət provayderində.
  Xidmət hər imzanı məsafədən imza interfeysi (Cloud Signature Consortium API v2) vasitəsilə tələb edir və yalnız imzalanacaq məlumatın heşini
  göndərir; sənədin məzmunu və fərdi məlumatlar ötürülmür. Məsafədən imza xidmətinizin ünvanını və xidmətə verdiyiniz müştəri identifikatorunu
  qeydiyyat qurumuna bildirirsiniz ([[ADR-0057]]). Real şəbəkədə qurumun açarı yerləşdirilmiş xidmətin serverində fayl kimi
  saxlanılmır.

## 4. Sorğu nöqtəsi: sənəd məlumatı sizin sisteminizdən

[[t:authentic-source|Səlahiyyətli mənbə]] sizin sisteminizdir. Tamga şəxslərin qeydlərini saxlamır; sənəd verildiyi anda sisteminizin **sorğu
nöqtəsinə** imzalı sorğu ilə müraciət edir, yalnız bir qeydi alır və onu saxlamır ([[ADR-0020]]). Müqavilə: [Qurumun sorğu nöqtəsi](/api/institution-source).

- Başlamağın ən qısa yolu açıq mənbəli nümunə nöqtədir ([[GUIDE-0004]] §5): tələbə informasiya sisteminizin önünə və ya müntəzəm
  yenilənən ixracın önünə qoyulur; sorğunu etibar siyahısı ilə yoxlayır və yalnız sənəd növünün tələb etdiyi
  sahələri qaytarır. T.C. şəxsiyyət nömrəsi heç vaxt qaytarılmır.
- Hər qeyddə proqramın **4 rəqəmli ISCED-F 2013 kodu** olmalıdır; kod yoxdursa, sənəd verilmir və təxmini kod yaradılmır (təhsil
  qaydası E11). Diplom yalnız məzuniyyət məlumatı (ixtisas dərəcəsi, EQF səviyyəsi, tarix) olan qeydlərə verilir.
- Nöqtə yalnız TLS üzərindən və yalnız yerləşdirilmiş xidmətin qurumunuz üçün istifadə etdiyi qeydi çağıran tərəf kimi qəbul edir (§5).

## 5. Baxış və etibar siyahısına daxil olma

Qeydiyyat qurumu müraciəti yoxlayır, sertifikatları verir, qurumu siyahıya əlavə edir və siyahını yenidən imzalayır. Dəyişiklik ən geci
**24 saat** ərzində `trust.tamga.network` ünvanında dərc olunur. Qeydiniz orada aşağıdakıları ehtiva edir: sertifikatınızın barmaq izindən
törədilən `issuer_id`, sinif, təminat səviyyəsi, sənəd növü səlahiyyətləri (hər növ üçün ayrıca), status və status tarixçəsi. Format:
[[SPEC-TRUST-0001]].

Yerləşdirilmiş xidmətdən istifadə edirsinizsə, qeydiyyat qurumu qurumunuz üçün **şəxsiyyətin uyğunlaşdırılması qeydi** də açır: tələbə sənədi
rəqəmsal cüzdandan tələb etdikdə xidmətin şəxsiyyət sənədini istəməsi və sorğu nöqtənizə müraciət etməsi bu qeydlə imzalanır. Qeyd qurumunuzun adını
və identifikasiya nömrəsini ehtiva edir, daimi adı qurumunuza məxsus domen adıdır (məs. `tamga.example.edu.tr`), məqsədi və məxfilik siyasətinin
ünvanı rəqəmsal cüzdanda göstərilir; tələb olunan sahələr yalnız T.C. şəxsiyyət nömrəsi və doğum tarixidir. Sorğu nöqtəniz bu qeydin domen adını
"icazəli çağıran tərəf" kimi tanıyır.

Hər dərcdə qeydləriniz üçün [[t:registration-certificate|qeydiyyat sertifikatları]] (WRPRC) da avtomatik yaradılır; rəqəmsal cüzdanlar qeydi
onlarla da yoxlayır ([[ADR-0026]]).

## 6. Qurum Konsolu hesabı

Qeydiyyatdan sonra qeydiyyat qurumu qurumunuzun ilk administratoruna birdəfəlik dəvət keçidi göndərir. Administrator keçidi açır
və cihazında passkey yaradır (parol yoxdur). Sonra Konsoldan digər əməkdaşları dəvət edir (administrator və ya əməkdaş
rolu ilə), API açarı yaradır ([[ADR-0016]]) və paylaşım qaydalarını idarə edir.

## 7. İlk rəqəmsal sənəd

- **Qurum Konsolu → Rəqəmsal sənəd ver:** tələbənin sisteminizdəki istinadını yazın, sənəd növünü seçin. T.C. şəxsiyyət nömrəsi və doğum
  tarixi də yazılarsa, təklif şəxsin şəxsiyyətinə bağlanır: sənədi yalnız həmin şəxs ala bilər, onun rəqəmsal cüzdanı Tamga şəxsiyyət sənədini təqdim edir,
  PIN tələb olunmur. Şəxsiyyət sənədi olmayan şəxs üçün PIN-li təklif açılır (PIN ekranda, QR-dan ayrı göstərilir). Tələbə qeydi sorğu nöqtənizdən
  oxunur; tapılmazsa və ya ISCED-F kodu çatışmırsa, təklif açılmır və səbəb ekranda göstərilir.
- **API:** tələbə portalınız və ya sisteminiz `@tamga-network/issuer/client` ilə təklif açır və keçidi öz kanalınızla
  ötürür (Tamga şəxsin əlaqə ünvanını görmür). Addımlar: [[GUIDE-0003]].
- **Tələbə başladır:** tələbə rəqəmsal cüzdanında qurumunuzu seçib şəxsiyyət sənədini təqdim edir; servis sorğu nöqtənizə `lookup` ilə sorğu göndərir.

Hər rəqəmsal sənəd şəxsin cihazındakı açara bağlı 10 nüsxəlik paket kimi verilir. Öz sənəd vermə servisinizi idarə edirsinizsə,
eyni addımları `@tamga-network/issuer` paketi ilə özünüz yerinə yetirirsiniz ([[SPEC-PROTO-0001]]).

## 8. Ləğv, dayandırma və qeydiyyat dəyişiklikləri

Rəqəmsal sənədi Qurum Konsolunun **Rəqəmsal sənədlər** bölməsindən və ya API vasitəsilə ləğv edirsiniz (daimi) və ya müvəqqəti dayandırırsınız (yalnız diplom
kimi dayandırmaya icazə verən növlərdə). Nəticə növbəti sabit intervallı ləğv siyahısı dərcində qüvvəyə minir; yoxlayan tərəflər sənədi həmin andan
sonra rədd edir.

| Qurum qeydiyyatının statusu | Nə baş verir |
|---|---|
| `ACTIVE` | Rəqəmsal sənəd verə bilər; verdiyi sənədlər qəbul edilir |
| `SUSPENDED` | Müvəqqəti olaraq sənəd verə bilməz; dayandırılma dövründə verilən sənəd qəbul edilmir, dayandırılmadan əvvəl verilənlərə təsir etmir. Problem aradan qaldırıldıqda yenidən aktivləşir |
| `RETIRED` | Sənəd verməyi dayandırıb (könüllü çıxış); əvvəllər verdiyi sənədlər qəbul edilməyə davam edir |
| `REVOKED` | Qeydiyyat bağlanıb; açar ələ keçirilibsə, göstərilən tarixdən (`invalidates_from`) sonra verilənlər etibarsız sayılır. Qurumun yerini varis (`successor_id`) tuta bilər |

Geri çəkilmiş (`REVOKED`) və ya çıxmış (`RETIRED`) qeydiyyat yenidən aktivləşmir; qayıtmaq istəyən qurum yeni qeydiyyatla qoşulur.
Yoxlama qurumun bugünkü statusuna deyil, sənədin verildiyi andakı statusa əsaslanır ([[SPEC-API-0001]] §1.1). Sertifikatın
yenilənməsi və açarın dəyişdirilməsi: [[SPEC-ID-0002]]. Uyğunluq testləri: [[GUIDE-0009]].

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[ADR-0024]] RPR1–RPR3 | Qeydiyyat məlumatları tam olmadan qeydiyyat aparılmır |
| [[SPEC-ID-0002]] | Rəqəmsal sənədlər yalnız qeydiyyatdan keçmiş sertifikatla imzalanır; açar qurumda qalır |
| [[ADR-0020]] | Tamga şəxs reyestri saxlamır; məlumat səlahiyyətli mənbədən oxunur |
| [[ADR-0050]] | Qurum sertifikatı qurumun identifikasiya nömrəsini, rəsmi adını və ölkəni ehtiva edir |

Bütün məcburi qaydalar: [Tamga ARF — Tamga Rulebook, RB-AP](https://arf.tamga.network/az/rulebook) və iştirak
şərtləri: [Trust Framework](https://arf.tamga.network/az/trust-framework).
