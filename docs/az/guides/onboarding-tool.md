---
document_id: GUIDE-0014
title: "Qoşulma aləti: İT komandası üçün"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Sənədi verən və ya yoxlayan qurumun İT komandası üçün tamga-onboard aləti ilə qoşulma, addım-addım: sandbox-da sınaq, müraciət
  faylı (init), qeydiyyat qaydaları ilə yoxlama (validate), açarlar və sertifikat sorğuları (keys; HSM və bulud sinxronizasiyası
  xəbərdarlığı), müraciətin göndərilməsi, sertifikatların yerləşdirilməsi, quraşdırma (.well-known, sorğu nöqtəsi) və onun
  yoxlanılması (check), etibar siyahısında görünüş (check --listing), Qurum Konsoluna dəvət və ilk sənəd; alətin MCP ilə süni
  intellekt köməkçisinə qoşulması və təhlükəsizlik sərhədləri; problemlərin həlli.
translation_of: GUIDE-0014
source_version: "1.0.0"
---

# Qoşulma aləti: İT komandası üçün

Bu bələdçi Tamga Network-a **sənədi verən** (universitet, peşə təşkilatı, dövlət qurumu) və ya **yoxlayan tərəf** (otel,
işəgötürən, veb-sayt) kimi qoşulacaq qurumun İT komandası üçündür. Qoşulmanın öz tərəfinizdəki bütün texniki işini `tamga-onboard`
əmri ilə görürsünüz: müraciət faylı, açarlar, sertifikat sorğuları, quraşdırmanın yoxlanılması və qoşulduqdan sonra etibar
siyahısında qurumunuzun görünüşü.

**Nə vaxt oxunur:**
- Qurumunuz qoşulmaq qərarına gəldikdən sonra, müraciəti hazırlayarkən.
- Əvvəl: [[GUIDE-0007]] (sənədi verən qurumun qoşulması: proses, yoxlama siyahısı, rollar) və ya [[GUIDE-0008]] (yoxlayan tərəfin
  qeydiyyatı). Bu bələdçi həmin proseslərin İT tərəfidir.
- Sonra: [[GUIDE-0003]] (sənədin texniki olaraq verilməsi) və ya [[GUIDE-0002]] (serverdə yoxlama).

## Alət nə edir, nə etmir?

| Edir | Etmir |
|---|---|
| Müraciət fayllarını yazır və qeydiyyat qaydaları ilə yoxlayır ([[ADR-0024]]) | Şəbəkəyə yazmır, [[t:trust-list]] məzmununu dəyişmir; qeydi qeydiyyat qurumu edir |
| İki imza açarınızı **öz kompüterinizdə** yaradır, sertifikat sorğularını (CSR) yazır | Şəxsi açarı heç yerə göndərmir; nəticəsi yalnız yerli fayllardır |
| Domeninizi, DNS təsdiqini, https ünvanlarını, metaməlumatınızı və sorğu nöqtənizi yoxlayır | Şəxsi məlumat soruşmur və fayllara yazmır (hətta imza səlahiyyətlisinin adını da) |
| Qoşulduqdan sonra imzalanmış siyahıdakı qeydinizi paketə daxil edilmiş kök pinlərinə qarşı yoxlayır | Şəbəkədən oxuduğu heç nəyi icra etmir |

Eyni əməliyyatlar yerli **MCP serveri** kimi də təqdim olunur; qurumunuzun öz süni intellekt köməkçisi addımları sizin adınıza icra
edə bilər ("MCP ilə istifadə" bölməsi).

Dövlət və ya operator kimi ortaq reyestrdə qovşaq işlədəcəksinizsə, eyni alətin `tamga-onboard node init|declare|check`
əmrləri və MCP alətləri [[GUIDE-0015]]-də (qovşaq istismarı üzrə təlimat) izah olunur.

## Quraşdırma

Lazımdır: Node.js 22 və ya daha yeni. `openssl` lazım deyil.

```sh
npm install -g @tamga-network/onboard     # və ya: npx -p @tamga-network/onboard tamga-onboard --help
```

Paket npm-də 0.8.3 sınaq versiyası ilə dərc olunur (sabit 1.0.0 hazır olduqda gələcək — sınaq versiyasında əmrlər
və seçimlər dəyişə bilər). İlk versiya əl ilə və mənşə sübutu (provenance) olmadan dərc olundu; sonrakı versiyalar GitHub
Actions-dan gəlir və mənşə sübutu daşıyır.

::: tip Mənbə kodundan işlətmə (istəyə bağlı)
Repozitoriyanın surətində alət yığım addımı olmadan da işləyir: `npm install`, sonra `tamga-onboard` əvəzinə
`npx tsx packages/onboard/src/cli.ts`.
:::

Çıxış kodları: `0` problem yoxdur · `1` yoxlama və ya doğrulama uğursuz oldu · `2` istifadə xətası. `--json` hesabatı JSON kimi
çap edir.

## Addım-addım

| # | Addım | Əmr | Kim |
|---|---|---|---|
| 0 | Sandbox-da sınayın | `tamga-onboard sandbox` | İT |
| 1 | Müraciət faylı | `tamga-onboard init` | İT (hüquq və tələbə işləri bölmələrinin məlumatı ilə) |
| 2 | Yoxlama | `tamga-onboard validate <qovluq>` | İT |
| 3 | Açarlar və CSR | `tamga-onboard keys <qovluq>` və ya `keys --inspect` | İT / təhlükəsizlik |
| 4 | Quraşdırmanın yoxlanılması və hesabat | `tamga-onboard check <qovluq> --report report.json` | İT |
| 5 | Müraciətin göndərilməsi | e-poçt | qurumun səlahiyyətli şəxsi |
| 6 | Sertifikatlar gəlir | faylları `keys/` qovluğuna qoyun | İT |
| 7 | Quraşdırma | `.well-known`, sorğu nöqtəsi → `tamga-onboard check` | İT |
| 8 | Siyahıda görünüş | `tamga-onboard check <qovluq> --listing` | İT |
| 9 | Qurum Konsolu və ilk sənəd | dəvət keçidi + passkey | qurumun inzibatçısı |

### 0. Sandbox-da sınayın

```sh
tamga-onboard sandbox
```

Əmr sandbox-dakı "Qurumunuzu sınayın" səhifəsinin ünvanını (`https://sandbox.tamga.network/institutions/new`) və addımları çap
edir. Test qurumunu brauzerdə açırsınız: uydurma ad (real qurum adları və "Universiteti", "Nazirliyi" kimi rəsmi sözlər qəbul
edilmir), birdəfəlik Konsol dəvəti, yalnız uydurma qeydlər, sənədin verilməsi, yoxlanılması və ləğvi. Sandbox üçün müraciət faylı,
açar və ya CSR lazım deyil; hər şey hər gecə silinir ([[GUIDE-0013]]). Test qurumunun qısa adı (`t-…`) ilə siyahı yoxlamasını da
sınaya bilərsiniz:

```sh
tamga-onboard check --listing-only --env sandbox --slug t-xxxxxxxxxx
```

### 1. Müraciət faylı: `init`

```sh
tamga-onboard init                         # suallar → tamga-onboarding/<qısa ad>/
tamga-onboard init --from answers.json     # eyni cavablar fayldan
```

Alət [[GUIDE-0007]] §2-dəki yoxlama siyahısının məlumatlarını soruşur: rol, daimi qısa ad (`slug`), rəsmi ad, qurumun
identifikasiya nömrəsi (VKN və ya MERSİS), poçt ünvanı, dəstək ünvanı və korporativ e-poçt, domen, sənəd növləri, xidmət modeli,
sorğu nöqtəsinin ünvanı, proqramların ISCED-F kodları. Cavab faylı nümunəsi:

```json
{
  "role": "issuer",
  "slug": "example-college",
  "legal_name": "Example College",
  "identifier": { "scheme": "TR-VKN", "value": "TR1234567890" },
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "country": "TR" },
  "contact": { "support_uri": "https://example.edu.tr/support", "email": "info@example.edu.tr" },
  "domain": "example.edu.tr",
  "vcts": ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  "hosting": "hosted",
  "identity_matching": { "privacy_policy_uri": "https://example.edu.tr/privacy/tamga" },
  "lookup_url": "https://sis.example.edu.tr/tamga/lookup",
  "isced_f_codes": ["0613"]
}
```

| Sahə | Qeyd |
|---|---|
| `hosting: "hosted"` | Tamga-nın yerləşdirilmiş sənəd vermə xidməti (`issuer.tamga.network/<slug>`). Alət həmçinin şəxsiyyət uyğunlaşdırma qeydinin müraciətini (`<slug>.rp.json`) yazır; həmin qeydin açarını xidmət saxlayır, sertifikatını qeydiyyat qurumu verir |
| `hosting: "own"` | Öz sənəd vermə xidmətiniz: `issuer_url` və `status_list_base` (hər ikisi https) lazımdır |
| `role: "verifier"` | Yoxlayan tərəf: `dns_name`, `service_description`, `is_public_sector_body` və hər istifadə üçün məqsəd, sənəd növü, **ən az sahə** və məxfilik siyasəti (`scopes`) |
| `contact.email` | Korporativ vəzifə ünvanı; şəxsi ünvan yazmayın |

Nəticə qovluğu `tamga-onboarding/<slug>/`: `onboarding.json` (alətin profili) və müraciət faylları (`<slug>.issuer.json`, lazım
olduqda `<slug>.rp.json`). Naməlum sahə rədd edilir; beləliklə şəxsin adı kimi məlumat fayla təsadüfən düşə bilməz. `slug` açıq,
daimi addır; qeydiyyat qurumu ilə birlikdə müəyyənləşir və bir dəfə istifadə olunmuş ad yenidən verilmir.

### 2. Yoxlama: `validate`

```sh
tamga-onboard validate tamga-onboarding/example-college
```

Müraciəti, cavab faylını və ya bütün qovluğu qeydiyyat qurumunun istifadə etdiyi qaydalarla yoxlayır: məcburi qeydiyyat
məlumatları ([[ADR-0024]]), identifikasiya nömrəsinin formatı və yoxlama rəqəmi, https ünvanları, dördrəqəmli ISCED-F kodları.
Bütün çatışmazlıqlar bir dəfəyə sadalanır. `PUB` (dövlət qurumunun sənədi) sinfi üçün alət xəbərdarlıq verir: bu sinif qeydiyyat
qurumu ilə ayrıca müzakirə olunur.

### 3. Açarlar və sertifikat sorğuları: `keys`

Sənədi verən qurumun iki açarı var (sənəd və [[t:status-list|ləğv siyahısı]]), yoxlayan tərəfin bir ([[t:access-certificate|giriş
sertifikatı]]); hamısı P-256 / ES256.

| Açarın adı | İmzaladığı |
|---|---|
| `issuer-<slug>` | verdiyiniz sənədlər |
| `issuer-<slug>-status` | ləğv siyahınız |
| `rp-<ad>` | yoxlayan tərəf kimi göndərdiyiniz sorğular |

**Tövsiyə olunan yol: HSM və ya uzaqdan imza xidməti.** Real şəbəkədə açarların qurumunuzun HSM-ində və ya müqavilə bağladığınız
etibar xidməti provayderində yaradılması üstün tutulur. Yerləşdirilmiş xidmətdən istifadə edirsinizsə, bu məcburidir: xidmət hər
imzanı uzaqdan imza interfeysi (Cloud Signature Consortium API v2) ilə istəyir və yalnız imzalanacaq məlumatın həşini göndərir;
qurumun açarı xidmətin serverində fayl kimi saxlanılmır ([[ADR-0057]]). HSM-in yaratdığı CSR-i müraciətinizə qarşı yoxlayın:

```sh
tamga-onboard keys --inspect issuer.csr.pem tamga-onboarding/example-college
```

Yoxlama CSR-in subyektində rəsmi adınızın, ölkənizin və qurumun identifikasiya nömrəsinin (`organizationIdentifier`:
`VATTR-<VKN>` və ya `NTRTR-<MERSİS>`) olduğunu və imzanın etibarlı olduğunu göstərir ([[ADR-0050]]).

**Proqram açarı (öz xidmətiniz və ya sınaq).** Alət açarları bu kompüterdə yarada bilər:

```sh
read -rs TAMGA_KEY_PASS && export TAMGA_KEY_PASS   # ən az 12 simvol; ekranda göstərilmir, qabıq tarixçəsinə düşmür
tamga-onboard keys tamga-onboarding/example-college --passphrase-env TAMGA_KEY_PASS
```

- Nəticə: `keys/<ad>.key.pem` (yalnız sahibinin oxuya biləcəyi icazə ilə, parolla şifrələnmiş) və `keys/<ad>.csr.pem`. Mövcud fayl
  üzərinə yazılmır; fayllardan biri belə varsa, heç biri yazılmır.
- Parol əmr sətrinə yazılmır, yalnız mühit dəyişəninin **adı** verilir. Windows-da parolsuz açar yalnız açıq şəkildə
  `--no-passphrase` ilə yaradılır.
- Proqram açarının ehtiyat nüsxəsini çıxarın (şifrələnmiş, oflayn) və yalnız lazım olan şəxslərin çata biləcəyi yerdə saxlayın.
  Açarı itirsəniz, sertifikat yenilənir; ələ keçirildiyini düşünürsünüzsə, dərhal qeydiyyat qurumuna bildirin.

::: danger Bulud sinxronizasiyası qovluğu
Alət OneDrive, Dropbox, Google Drive və ya iCloud ilə sinxronlaşdırılan qovluğa şəxsi açar yazmaqdan imtina edir: açar qurumdan
kənar serverə köçürülərdi. Windows-da "Sənədlər" və "İş masası" çox vaxt OneDrive ilə sinxronlaşdırılır; qoşulma qovluğunu
sinxronlaşdırılmayan yerə (məs. `C:\tamga-onboarding`) köçürün. `--allow-synced` yalnız şüurlu şəkildə və həmin qovluq üçün
sinxronizasiyanı söndürdükdən sonra istifadə olunur.
:::

### 4. Quraşdırmanın yoxlanılması və hesabat: `check`

```sh
tamga-onboard check tamga-onboarding/example-college --report report.json
```

Müraciət fayllarını, hər açarın öz CSR-i ilə uyğunluğunu, domeninizin həll olunduğunu, qeyddəki ünvanların (dəstək, məxfilik
siyasəti) açıldığını və varsa sorğu nöqtənizi yoxlayır. Hesabat keçdi/keçmədi cədvəlidir; hər keçməyən sətrin yanında düzəlişi
yazılır. Bu mərhələdə bəzi sətirlərin keçməməsi və ya buraxılması gözləniləndir: DNS təsdiqi (dəyər hələ yoxdur), sertifikatlar
(hələ yoxdur), metaməlumat (xidmət hələ qurulmayıb).

Alət yalnız https ilə oxuyur, yönləndirmələri bir-bir izləyir, yerli və özəl şəbəkə ünvanlarına qoşulmur (yerli sınaq üçün
`--allow-http`, `--allow-private`). Sorğu nöqtəsini yalnız **rədd edilməli olan** sorğularla yoxlayır; nə real, nə də uydurma heç
bir qeyd istənilmir.

### 5. Müraciətin göndərilməsi

Müraciəti qurumunuzun korporativ e-poçt ünvanından, qurumunuzun səlahiyyətli şəxsi **partners@tamga.network** ünvanına göndərir.
Əlavələr:

| Göndərin | Heç vaxt göndərməyin |
|---|---|
| `<slug>.issuer.json`, varsa `<slug>.rp.json` | `keys/*.key.pem` (şəxsi açarlar) |
| `keys/*.csr.pem` (və ya HSM-in yaratdığı CSR-lər) | parol, HSM giriş məlumatları, uzaqdan imza xidmətinin sirri |
| `report.json` | şəxsi məlumat, tələbə qeydləri |

Səviyyənizə görə lazım olan sənədlər (hüquqi şəxs sübutu, imzalanmış iştirak müqaviləsi, məlumatların qorunması əlavələri)
[[GUIDE-0007]] §2-dədir. Qeydiyyat qurumu bütün çatışmazlıqları bir dəfəyə bildirir. Domen sahibliyi üçün sizə birdəfəlik dəyər
verir; onu domeninizin DNS-inə TXT qeydi kimi əlavə edin və yoxlayın:

```sh
tamga-onboard check tamga-onboarding/example-college --dns-txt <verilən dəyər>
```

Yerləşdirilmiş xidmətdən istifadə edirsinizsə, uzaqdan imza xidmətinizin ünvanını və xidmətə verdiyiniz müştəri identifikatorunu
qeydiyyat qurumu ilə ayrıca, təhlükəsiz kanal vasitəsilə paylaşırsınız; sirr e-poçtla göndərilmir.

### 6. Sertifikatlar gəlir

Qeydiyyat qurumu CSR-lərinizin imzasını yoxlayır və sertifikatlarınızı verir (2 il, ən çox 3). Hər sertifikatı öz açarının adı ilə
`keys/<ad>.cert.pem` kimi qoşulma qovluğuna qoyun və yenidən yoxlayın:

```sh
tamga-onboard check tamga-onboarding/example-college
```

Alət sertifikatın sizin şəxsi açarınıza aid olduğunu, subyektində qurumun identifikasiya nömrəsinin olduğunu, etibarlılıq
tarixlərini və giriş sertifikatında domeninizi yoxlayır. Uyğunsuzluq varsa, sertifikat səhv CSR-dən verilmiş ola bilər: qeydiyyat
qurumu ilə əlaqə saxlayın.

### 7. Quraşdırma: metaməlumat və sorğu nöqtəsi

**Yerləşdirilmiş xidmət.** Xidmət sizin adınıza sənəd verir; qurmalı olduğunuz yeganə nöqtə **sorğu nöqtənizdir**. Tamga şəxslərin
reyestrini saxlamır; sənəd verildiyi anda sisteminizə imzalı sorğu ilə müraciət edir, tək qeydi alır və saxlamır ([[ADR-0020]],
müqavilə: [Qurumun sorğu nöqtəsi](/api/institution-source)). Ən qısa yol açıq mənbəli nümunə nöqtədir (repozitoriyada
`examples/05-institution-source`, [[GUIDE-0004]] §5). Nöqtə:
- xaricdən https ilə açıq olmalıdır (yerləşdirilmiş xidmət bu ünvana qoşulur);
- imzasız və ya etibarsız sorğunu `400`/`401` ilə rədd etməli, heç vaxt `2xx` qaytarmamalıdır;
- yalnız sənəd növünün tələb etdiyi sahələri qaytarır; şəxsi identifikasiya nömrəsi heç vaxt qaytarılmır;
- hər qeyddə dördrəqəmli ISCED-F kodu olmalıdır; kod yoxdursa, sənəd verilmir.

**Öz xidmətiniz.** Sənəd vermə xidmətiniz [[t:OpenID4VCI]] metaməlumatını RFC 8414 ünvan qaydası ilə dərc edir: `.well-known/<növ>`
host ilə yolun arasına daxil olur.

| Metaməlumat | Ünvan (nümunə `issuer_url` = `https://example.edu.tr/issuer`) |
|---|---|
| Sənədi verən | `https://example.edu.tr/.well-known/openid-credential-issuer/issuer` |
| Avtorizasiya serveri | `https://example.edu.tr/.well-known/oauth-authorization-server/issuer` |

İmzalı metaməlumat sənəd açarınızla imzalanır və `x5c`-də qeydiyyat qurumunun verdiyi sertifikatı daşıyır. Ləğv siyahısı
`status_list_base` altında dərc olunur. Addımlar: [[GUIDE-0003]], [[SPEC-PROTO-0001]].

Quraşdırmadan sonra `tamga-onboard check`-i yenidən işlədin; metaməlumat (`M1`–`M3`) və sorğu nöqtəsi (`Q1`) sətirləri keçməlidir.

### 8. Siyahıda görünüş: `check --listing`

Qeydiyyat qurumu qeydi edib siyahını yenidən imzaladıqdan sonra dəyişiklik ən gec **24 saat** ərzində `trust.tamga.network`-da
dərc olunur. Yoxlayın:

```sh
tamga-onboard check tamga-onboarding/example-college --listing
```

Alət imzalanmış siyahını endirir, paketə daxil edilmiş kök pinlərinə qarşı yoxlayır və qeydinizi yoxlayır: siyahıda və `ACTIVE`
vəziyyətdəsinizmi, qeydiyyat məlumatlarınız tamdırmı, sənəd növü səlahiyyətləriniz, yuxarı sertifikat orqanı, ləğv siyahınızın
dərci və lövbərlənməsi, [[t:registration-certificate|qeydiyyat sertifikatlarınız]] (imzaları siyahıdakı qeydiyyat qurumu açarlarına
qarşı), şəxsiyyət uyğunlaşdırma və ya yoxlayan tərəf qeydiniz, varsa xidmət metaməlumatınız və **imzalı metaməlumatınızın
sertifikat zəncirinin siyahıdakı kökə** bağlandığı.

- Pin dəyişərsə, paket yenilənir. Arada `tamga.network/trust-anchor` ünvanından **kanaldan kənar** yoxladığınız dəyərlə
  `--pin <hex>` verilə bilər; hesabat bunu xəbərdarlıq sətri ilə göstərir.
- Qoşulma qovluğu olmadan da işləyir: `tamga-onboard check --listing-only --env production --slug <slug>`.
- Yeni qurumun ilk dəqiqələrində ləğv siyahısı sətri xəbərdarlıq verə bilər: siyahı ilk dəfə dərc olunub lövbərlənənə qədər (bir
  dərc aralığı) bu gözləniləndir.

### 9. Qurum Konsolu və ilk sənəd

Qeydiyyatdan sonra qeydiyyat qurumu qurumunuzun ilk inzibatçısına birdəfəlik dəvət keçidi göndərir (72 saat etibarlıdır).
İnzibatçı keçidi açır və cihazında [[t:passkey]] yaradır; parol yoxdur. Sonra Konsoldan digər əməkdaşları dəvət edir və lazım
olduqda API açarı yaradır ([[ADR-0016]]).

İlk sənədi öz əməkdaşınıza verin: Qurum Konsolu → **Sənəd ver** → şəxs sənədi rəqəmsal cüzdanına alır → `verify.tamga.network`-da
təqdim edir → Konsoldan ləğv edin və növbəti dərcdən sonra rədd edildiyini görün. Təfərrüatlar: [[GUIDE-0007]] §7–§8. Ləğv siyahısı
ilk dəfə dərc olunana qədər ilk sənədlər "hazırda yoxlamaq mümkün deyil" (`INDETERMINATE`) nəticəsi ala bilər; bir neçə dəqiqə
sonra yenidən cəhd edin.

Yoxlayan tərəf üçün bu addımın qarşılığı inteqrasiyadır: qeydiyyat sertifikatınızı hər sorğuya əlavə edin ([[GUIDE-0002]] 4-cü
addım) və əvvəlcə sandbox yoxlayıcısı ilə, sonra real şəbəkədə öz əməkdaşlarınızla sınayın.

## MCP ilə istifadə

Eyni əməliyyatlar yerli MCP serveri (stdio) kimi təqdim olunur. Onu qurumunuzun istifadə etdiyi, MCP-ni dəstəkləyən süni intellekt
köməkçisinə qoşun; köməkçi addımları sizin təsdiqinizlə icra edir. İlk dərcdən sonra:

```json
{ "mcpServers": { "tamga-onboard": { "command": "npx", "args": ["-y", "-p", "@tamga-network/onboard", "tamga-onboard", "mcp", "--root", "C:\\tamga-onboarding"] } } }
```

Mənbə kodundan (repozitoriyanın surətində): `"command": "npx", "args": ["tsx", "<repozitoriya>/packages/onboard/src/cli.ts", "mcp", "--root", "<qovluq>"]`.

| Alət | Əmr qarşılığı |
|---|---|
| `create_application` | `init --from` |
| `validate_application` | `validate` |
| `generate_keys_and_csr` | `keys` |
| `check_installation` | `check` |
| `check_listing` | `check --listing` / `--listing-only` |
| `sandbox_info` | `sandbox` |

**Təhlükəsizlik sərhədləri** (serverin özü tərəfindən tətbiq olunur):
- Fayl girişi yalnız kök qovluqdadır (`--root`, standart olaraq iş qovluğu); simvolik keçidlər və birləşmə nöqtələri həll
  edildikdən sonra da.
- Heç bir cavabda şəxsi açarın məzmunu yoxdur; yalnız fayl yolu və açıq açarın həşi qaytarılır.
- Parol yalnız `TAMGA_` ilə başlayan mühit dəyişəninin adı ilə verilir; parolun özü köməkçiyə yazılmır.
- Kök pinləri dəyişdirilə bilməz; yerli şəbəkə ünvanları oxunmur; qurumun domenindən kənar sorğu ünvanları işarələnir.
- Şəbəkədən oxunan mətn nəticədə "etibarsız məlumat" kimi işarələnir; köməkçi onu təlimat kimi qəbul etməməlidir.

Buna baxmayaraq köməkçinizə bunları verməyin: şəxsi açar faylı, HSM və ya uzaqdan imza xidmətinin giriş məlumatları, şəxsi məlumat.
Qurumunuzun süni intellektdən istifadə qaydaları və məlumat emalı müqavilələri bu alətə də şamil olunur.

## Problemlərin həlli

| Əlamət | Səbəb | Həll |
|---|---|---|
| `keys`: "bulud sinxronizasiyası qovluğunda" | qovluq OneDrive, Dropbox, Google Drive və ya iCloud ilə sinxronlaşdırılır | qoşulma qovluğunu sinxronlaşdırılmayan yerə köçürün |
| `keys`: Windows-da parolsuz | parol verilməyib | `--passphrase-env <DƏYİŞƏN>` (ən az 12 simvol) |
| `keys`: fayl var, heç nə yazılmadı | əvvəl yaradılmış açarlar | şüurlu şəkildə yenidən yaradırsınızsa, köhnə faylları təhlükəsiz arxivləyin; alət üzərinə yazmır |
| `validate`: identifikasiya nömrəsi etibarsızdır | VKN formatı və ya yoxlama rəqəmi | VKN `TR` + 10 rəqəm; MERSİS `TR` + 16 rəqəm |
| `validate`: ISCED-F | kod yoxdur və ya dörd rəqəm deyil | proqramın ISCED-F 2013 kodu; təxmini kod yazmayın |
| `check` N2 keçmədi | DNS TXT dəyəri hələ yayılmayıb və ya səhv ada əlavə olunub | qeyd domenin özündədirmi; yayılma saatlar çəkə bilər |
| `check` K2 keçmədi: "sertifikat bu şəxsi açara aid deyil" | sertifikat başqa CSR-dən verilib | qeydiyyat qurumu ilə əlaqə saxlayın; düzgün CSR-i yenidən göndərin |
| `check` M1 `404` | metaməlumat ünvanı RFC 8414 qaydasına uyğun deyil | `/.well-known/openid-credential-issuer/<yol>` |
| `check` Q1 keçmədi: "imzasız sorğuya 2xx" | sorğu nöqtəsi sorğunu yoxlamır | 05 nümunəsindəki yoxlamalar: imza, çağıran, `aud`, müddət, `jti` |
| `check` Q1 xəbərdarlıq: `404`/`405` | ünvan sorğu nöqtəsinin özü deyil | `lookup_url`-i düzəldin |
| `check --listing` L1 keçmədi | qeyd hələ dərc olunmayıb | 24 saat gözləyin; sonra qeydiyyat qurumuna yazın |
| `check --listing` sertifikat kökə bağlı deyil | sınaq sertifikatı və ya səhv mühit | `--env production` / `sandbox` düzgündürmü |
| İlk sənəd `INDETERMINATE` | ləğv siyahısı hələ ilk dəfə dərc olunmayıb | bir neçə dəqiqə sonra yenidən cəhd edin |

Ümumi yoxlama problemləri: [[GUIDE-0012]]. Təhlükəsizlik boşluğunun bildirilməsi: `security@tamga.network`.

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[ADR-0024]] | Qeydiyyat məlumatları tam olmadan qeyd edilmir |
| [[ADR-0050]] | Qurumun sertifikatı qurumun identifikasiya nömrəsini, rəsmi adını və ölkəsini daşıyır |
| [[ADR-0057]] | Yerləşdirilmiş xidmətdə qurumun açarı qurumda qalır; imza uzaqdan imza interfeysi ilə |
| [[ADR-0020]] | Tamga şəxslərin reyestrini saxlamır; məlumat səlahiyyətli mənbədən oxunur |
| [[SPEC-ID-0002]] | Sənədlər yalnız qeydiyyatlı sertifikatla imzalanır; sertifikatın yenilənməsi və açarın dəyişdirilməsi |

Paket təfərrüatları: [@tamga-network/onboard](/packages/onboard). İştirak şərtləri: [Tamga ARF — Trust Framework](https://arf.tamga.network/az/trust-framework).
