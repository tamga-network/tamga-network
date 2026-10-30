---
document_id: ADR-0039
title: "Sürücülük vəsiqəsi məlumatı: yoxlayan tərəf üçün təsdiqlənmiş rəqəmsal sənəd"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-04
summary: >
  Tamga şəxsiyyət xidməti şəxsin fiziki sürücülük vəsiqəsini məsafədən şəxsiyyət yoxlaması provayderi vasitəsilə (sənəd + canlılıq yoxlaması + üz uyğunlaşdırması) yoxlayır və kartdakı sürücü məlumatlarını (kateqoriyalar, etibarlılıq müddəti, verən ölkə) qeyri-kvalifikasiyalı EAA kimi verir: `urn:tamga:id:DrivingLicenceAttestation:1`, görünən adı "Sürücülük vəsiqəsi məlumatı". Bu rəqəmsal sənəd rəsmi sürücülük vəsiqəsi deyil, mobil sürücülük vəsiqəsi (mDL) də deyil: yol hərəkəti nəzarətində keçərli deyil və bunu kartda açıq şəkildə yazır. İlkin şərt rəqəmsal cüzdandakı şəxsiyyət sənədidir; yalnız SD-JWT VC; şəxsiyyət nömrəsi, məhdudiyyət və sağlamlıq məlumatı daşımır; müddət kartın bitmə tarixi və ya 1 il. Səlahiyyətli orqan rəqəmsal sürücülük vəsiqəsi verməyə başladıqda yeni buraxılış dayandırılır.
domain: Credentials
translation_of: ADR-0039
source_version: "1.0.0"
---

# Qısaca

Avtomobil icarəsi, avtomobil paylaşımı, kuryer və sürücü işə qəbulu kimi işlərdə qarşı tərəf "bu şəxsin hansı kateqoriyada etibarlı
sürücülük vəsiqəsi varmı" deyə soruşur. Bu gün bunu kartın fotoşəklini çəkməklə edir. Bu qərarla şəxs kartını bir dəfə Tamga şəxsiyyət
xidmətində yoxlatdırır və nəticəni rəqəmsal cüzdanında daşıyır. Sənəd deyir: "bu şəxs filan tarixdə, üzü uyğun gələn, həqiqi görünən sürücülük vəsiqəsi
kartı təqdim etdi; kartda bu kateqoriyalar və bu etibarlılıq müddəti yazılmışdı". Sürücülük vəsiqəsinin özü deyil.

# Kontekst

- Layihə rəhbərliyi (2026-10-03) mağazaya çıxışdan əvvəlki əhatəyə sürücülük vəsiqəsini daxil etdi və sənədin şəxsiyyət sənədi ilə eyni yolla, məsafədən
  şəxsiyyət yoxlaması provayderi vasitəsilə verilməsini istədi. Yeni sənəd növü olduğu üçün əvvəlcə bu qərar yazıldı; qəbul provayderin
  kateqoriyaları oxuduğunun təsdiqlənməsindən asılı edildi.
- **Avropa İttifaqında (Aİ) rəqəmsal sürücülük vəsiqəsi rəsmi sənəddir.** [[t:mDL]] (ISO/IEC 18013-5 mobil sürücülük vəsiqəsi) yalnız sürücülük
  vəsiqəsi verməyə səlahiyyətli orqanın verə biləcəyi sənəddir. Aİ-nin yeni sürücülük vəsiqəsi direktivi (2025) rəqəmsal sürücülük
  vəsiqəsini üzv dövlətin səlahiyyətli orqanına bağlayır və onu [[t:EUDI-Wallet|EUDI Wallet-da]] daşınacaq formada müəyyən edir. Türkiyədə
  sürücülük vəsiqəsini Əhali və Vətəndaşlıq İşləri Baş İdarəsi verir. Tamga bu orqanlardan biri deyil.
- [[ADR-0011]] və [[ADR-0022]] Tamga şəxsiyyət xidmətini dövlət provayder təyin edənə qədər işləyən müvəqqəti sənədi verən qurum kimi
  müəyyən edir (`class: EAA`, `assurance: I2`). Eyni xidmət [[ADR-0021]] ilə e-poçt və telefon sənədləri də verir. Sürücü
  məlumatı eyni rolun daxilinə düşür: **qeyri-kvalifikasiyalı [[t:EAA]]**, hər kəsin verə biləcəyi növdən.
- **Provayder tapıntısı (2026-10-04).** Məsafədən şəxsiyyət yoxlaması provayderinin sahə təsvirləri yoxlanıldı: sürücülük vəsiqəsi ayrıca
  sənəd növüdür (`document_type = DL`); kartdan sənəd nömrəsi, verən ölkə, verilmə və etibarlılığın bitmə tarixi, "müddəti bitmiş"
  faktı və **kateqoriya üzrə etibarlılıq tarixləri** (`dl_class_code_<sınıf>_from` / `_to`; AM, A1, A2, A, B1, B, BE, C1, C1E, C,
  CE, D1, D1E, D, DE və milli əlavələr F, G, M …) oxunur. Məhdudiyyət kodu üçün ayrıca sahə yoxdur; kateqoriya üzrə sərbəst mətn
  `_notes` sahəsi var və bu sahə **oxunmur**. Hansı sənəd növlərinin qəbul ediləcəyi provayderdə axın səviyyəsində tənzimlənir
  (`documents_allowed`); buna görə sürücülük vəsiqəsi üçün ayrıca axın müəyyən edilir.
- Kartı yoxlamaq kartın həqiqi olduğunu və şəxsin kartın sahibi olduğunu göstərir. **Vəsiqənin bu gün dayandırılmış və ya ləğv edilmiş
  olub-olmadığını göstərmir:** Tamga-nın rəsmi reyestrə çıxışı yoxdur. Sənəd bu məhdudiyyəti açıq şəkildə daşıyır.

# Qərar

## K1 — Nədir, nə deyil

Sənəd kartın yoxlandığı andakı **təsdiqlənmiş sürücülük vəsiqəsi məlumatıdır**. Rəsmi sürücülük vəsiqəsi deyil, mDL deyil, yol hərəkəti
nəzarətində və rəsmi əməliyyatlarda istifadə olunmur. Bunu dörd yerdə açıq şəkildə bildirir:

- Sxem metadata-sındakı görünən ad və təsvir: "Sürücülük vəsiqəsi məlumatı — rəsmi sürücülük vəsiqəsini əvəz etmir."
- Sənədin içində həmişə açıq (seçici paylaşımsız) sahə: `not_official_licence: true`; görünən etiketi **"Rəsmi
  sürücülük vəsiqəsini əvəz etmir."** (İngiliscəsi: "Not an official driving licence."). Hər yoxlayan tərəf bu sahəni görür.
- Rəqəmsal cüzdanda kartın ön üzündə eyni ifadə.
- Yoxlayan tərəfin ekranlarında (Tamga Verify, nümunə saytlar) nəticə ilə birlikdə eyni ifadə.

Rəqəmsal sənədin kartının görünüşü rəsmi sürücülük vəsiqəsini xatırlatmır: Aİ sürücülük vəsiqəsi naxışı, bayraq, ay-ulduz, dövlət gerbi və "T.C." istifadə olunmur.

## K2 — Növ adı

Layihə rəhbərliyi (2026-10-04) A variantını seçdi:

| | Dəyər |
|---|---|
| [[t:vct]] | `urn:tamga:id:DrivingLicenceAttestation:1` (şəxsiyyət xidmətinin digər rəqəmsal sənəd növləri ilə eyni ailə) |
| Görünən ad | **"Sürücülük vəsiqəsi məlumatı"** / **"Driving licence information"** |
| Kataloq yolu | `id/DrivingLicenceAttestation/1.0.0` |

ISO və Aİ adları istifadə edilmir: `org.iso.18013.5.1.mDL` docType-ı və `org.iso.18013.5.1` namespace-i yalnız səlahiyyətli orqana məxsusdur;
onlardan istifadə sənədin rəsmi mDL kimi qəbul edilməsinə səbəb olur. Məhsul və ya mağaza mətnində "ehliyet", "dijital ehliyet", "mobil
ehliyet" ifadələri işlədilmir. Nəzərdən keçirilən digər adlar (`DrivingLicenceCheck`, `DrivingEntitlementInfo`, `mobility:` sahəsi) Əsaslandırma bölməsindədir.

## K3 — Sahələr (fərdi məlumatlar minimum)

| Claim | Məcburi | Seçici paylaşım | Qeyd |
|---|---|---|---|
| `given_name`, `family_name` | ✓ | ✓ | kartdan; yoxlayan tərəfin şəxslə uyğunlaşdırması üçün |
| `birth_date` | ○ | ✓ | kartdan; `age_over_18` törədilir |
| `driving_privileges` | ✓ | ✓ (massiv bütövlükdə) | `[{ category, issue_date?, expiry_date? }]`; `category` kartda yazılan kateqoriya (`B`, `A2`, `C1E` …; Aİ 2006/126 kodları, milli əlavələr olduğu kimi). Adı ISO 18013-5 məlumat elementi ilə eyni saxlanılır; format Tamga-ya məxsusdur. İnkişaf mərhələsində massiv vahid seçici sahədir; kateqoriya üzrə paylaşım növbəti versiyaya qalır |
| `issuing_country` | ✓ | ✓ | ISO 3166-1 alpha-2 |
| `licence_issue_date` (○), `licence_expiry_date` (✓) | | ✓ | kartın öz tarixləri |
| `document_number_hash` | ✓ | ✓ | sənəd nömrəsinin açarlı heşi (HMAC-SHA256; şəxsiyyət sənədində olduğu kimi); nömrənin özü yoxdur |
| `verified_at` | ✓ | — | kartın yoxlandığı gün (tarix, saat yoxdur) |
| `verification_method` | ✓ | ✓ | `remote-document-liveness-face` |
| `not_official_licence` | ✓ | — | həmişə `true`; K1 ifadəsi |
| `iat`, `exp`, `status` | ✓ | — | K5 |

**Heç birində yoxdur:**

- Şəxsiyyət nömrəsi (TCKN): Türkiyədəki yeni kartlarda yazılıdır, lakin yalnız şəxsiyyət sənədində daşınır ([[SPEC-ID-0003]]/IDP10).
- Məhdudiyyət və əlavə kodlar (kartın 12-ci sahəsi): onların bir hissəsi eynək, eşitmə cihazı kimi **sağlamlıq məlumatıdır** (KVKK 6-cı maddə, xüsusi
  kateqoriyalı). Kodlar daşınmır; `has_restrictions` kimi fakt da **daşınmır** (layihə rəhbərliyi, 2026-10-04). Provayderin
  `_notes` sahələri ümumiyyətlə oxunmur.
- Fotoşəkil, imza, ünvan, doğum yeri, kartı verən bölmə.

`category` claim-i yoxdur (kvalifikasiyalı deyil, dövlət qurumu sənədi deyil; [[ADR-0022]] K2 ilə eynidir).

## K4 — Axın: şəxsiyyət sənədi ilkin şərtdir

Axın şəxsiyyət sənədinin axını ilə eyni protokoldadır ([[t:OpenID4VCI]] authorization code + PAR, [[t:WIA]] məcburi); ilkin şərt rəqəmsal cüzdandakı
**Tamga şəxsiyyət sənədidir** (layihə rəhbərliyi, 2026-10-04: B variantı):

1. Şəxs rəqəmsal cüzdanda "Sənəd əlavə et → Sürücülük vəsiqəsi məlumatı" seçimini edir. Cüzdan PAR sorğusuna şəxsiyyət sənədinin **təqdimatını** əlavə edir
   (`identity_presentation`: [[t:SD-JWT-VC]] + [[t:KB-JWT]], `aud` = şəxsiyyət xidməti, `nonce` = xidmətin `/nonce` endpoint-indən, birdəfəlik;
   yalnız `given_name`, `family_name`, `birth_date` açılır). Hər iki tərəf artıq eyni OpenID4VCI sessiyasındadır; ayrıca
   OpenID4VP sorğu-cavab dövrü açılmır.
2. Şəxsiyyət xidməti təqdimatı yoxlayır: öz imzası, aktiv (ləğv edilməmiş, müddəti bitməmiş) şəxsiyyət sənədi, yalnız üç sahə.
   Şəxsin sahələrini saxlamır; axın qeydində yalnız açarlı **uyğunluq heşi** (ad + soyad + doğum tarixi) və bağlı şəxsiyyət
   qeydinin identifikatoru qalır.
3. Brauzerdə sürücülük vəsiqəsinə xüsusi məlumatlandırma və açıq razılıq səhifəsi açılır (K1 ifadəsi burada da yazılır). Provayderdə **yalnız
   sürücülük vəsiqəsi qəbul edən ayrıca axın** başlayır: sənəd + canlılıq yoxlaması + üz uyğunlaşdırması.
4. Nəticə: kartdakı ad və doğum tarixi eyni heşə uyğun gəlirsə (türk hərfləri və böyük/kiçik hərflər normallaşdırılır) sənəd verilir.
   Uyğun gəlmirsə verilmir və şəxsə səbəbi bildirilir. Kart sürücülük vəsiqəsi deyilsə, müddəti bitibsə və ya **kateqoriyalar oxuna bilmirsə,
   sənəd verilmir** (kateqoriyasız sənəd yoxdur; layihə rəhbərliyi, 2026-10-04).
5. Provayderin qərarı "yoxlama" və ya "rədd" olarsa, şəxsiyyət sənədindəki qaydalar olduğu kimi tətbiq olunur ([[ADR-0011]] K6).

Şəxsiyyət sənədi ilkin şərti şəxsin üzünün iki ayrı sessiyada iki ayrı sənədlə uyğunlaşdırılmasını təmin edir və sənədi şəxsin rəqəmsal cüzdanındakı
şəxsiyyətə bağlayır. Bunun bədəli ikinci provayder sessiyasıdır (Əsaslandırma, B variantı). Mağaza yoxlaması kodu ([[ADR-0033]]) bu növdə
istifadə edilmir.

## K5 — Həyat dövrü

- `exp` = kartın bitmə tarixi ilə kartın yoxlandığı gündən **1 il** sonrakı tarixdən hansı daha tezdirsə. Tamga kartın sonradan dayandırıldığını
  görə bilmədiyi üçün sənəd ildə bir dəfə təkrar yoxlama ilə yenilənir.
- Sənəd [[t:status-list]] daşıyır. Tamga ləğv edir: şəxs istədikdə, silmə sorğusunda (`/erasure`), eyni sənəd nömrəsi heşi ilə yeni
  sənəd verildikdə (köhnəsini), cüzdan vahidi ləğv edildikdə ([[ADR-0025]]) və **bağlı şəxsiyyət sənədi ləğv edildikdə və ya yenidən
  verildikdə** (zəncirvari: sürücülük vəsiqəsi məlumatı şəxsiyyət sənədinə bağlı qeyd saxlayır). Şəxsiyyət sənədinin silinməsi bağlı sənədi
  də silir.
- Avtomatik nüsxə yeniləməsi ([[ADR-0023]]) aktivdir; yeniləmə kartı yenidən yoxlamır, müddəti uzatmır.

## K6 — Format

Yalnız [[t:SD-JWT-VC]]. [[t:mdoc]] təqdimatı verilmir (layihə rəhbərliyi, 2026-10-04): [[ADR-0013]] ikinci formatı şəxsiyyət sənədinə ayırıb;
üzbəüz (ISO 18013-5) təqdim edilən "sürücülük vəsiqəsi" mdoc-u rəsmi mDL oxuyucularında rəsmi sənəd kimi qəbul edilmə riskini artırır.

## K7 — Etibar siyahısı və sxem

- Bu növ Tamga şəxsiyyət xidmətinin [[t:trust-list|etibar siyahısı]] qeydinə əlavə olunur (`class: EAA`, `assurance: I2`); real şəbəkə və
  sandbox siyahılarında.
- Sxem inkişaf mərhələsində yerində düzəldilir ([[ADR-0029]] K1): ilk versiya `1.0.0` sahə adları dəqiqləşənə qədər eyni yolda
  dəyişir; sınaq sənədləri yenidən alınır.
- Sandbox-da ([[ADR-0038]]) eyni növ saxta provayderlə və nümunə şəxslərlə verilir; nümunə şəxslərdən bəzilərinin uydurma
  sürücülük vəsiqəsi var (biri müddəti bitmiş).
- Provayderdəki sürücülük vəsiqəsi axını konfiqurasiya ilə aktivləşdirilir; konfiqurasiya edilməyibsə, növ metadata-da elan edilmir və sorğu rədd edilir
  ([[ADR-0021]] K5 ilə eyni nümunə).

## K8 — Səlahiyyətli orqan gəldikdə

TDT-first prinsipinə (D-GOV-5) görə bu növ müvəqqətidir:

- Üzv dövlətin səlahiyyətli orqanı rəqəmsal sürücülük vəsiqəsi (rəsmi mDL və ya onun SD-JWT VC qarşılığı) verməyə başladıqda, həmin
  ölkə üçün Tamga-nın yeni verilişi dayanır. Etibar siyahısı qeydi `successor` ilə rəsmi növə işarə edir; verilmiş sənədlər müddəti
  bitənə qədər qüvvədə qalır.
- Rəsmi sənəd öz növü ilə (ISO/Aİ docType) gəlir; Tamga növü ona çevrilmir və ötürülmür. Orqan istəsə, Tamga-nın
  yerləşdirdiyi sənəd vermə xidmətindən `on_behalf_of` ilə istifadə edə bilər; bu halda da növ rəsmi növdür.
- Yoxlayan tərəflər keçid dövründə hər iki növü birlikdə tələb edə bilər ([[t:DCQL]] `credential_sets`: rəsmi növ və ya Tamga növü).

## K9 — Mağaza və hüquq

- **Dövlət təəssüratı:** mağaza mətni, ekran görüntüləri və tətbiqdaxili mətn "prava", "rəqəmsal prava", "rəsmi" ifadələrini işlətmir; kart
  K1-dəki qeydi daşıyır. Google "Government apps" bəyannaməsi **xeyr** olaraq qalır.
- **Şəxsiyyət sənədi və üz məlumatları:** provayderə keçməzdən əvvəl məlumatlandırma və açıq razılıq (şəxsiyyət axınında olduğu kimi, sürücülük vəsiqəsinə
  xüsusi mətnlə).
- **KVKK:** Tamga bu məlumatlar üçün məlumat nəzarətçisidir; məlumatlandırma və açıq razılıq mətni sürücülük vəsiqəsini əhatə edir. Sağlamlıq məlumatı alınmır (K3).
- **Hüquqi baxış:** real şəxslərə verilişin açılmasından **əvvəl** hüquqşünas sənədin rəsmi sənəd imitasiyası və ya rəsmi sənəd
  əvəzinə istifadə edilməsi riskini (Türkiyə Cinayət Məcəlləsinin sənəd saxtakarlığına dair müddəaları, Yol Hərəkəti Qanunu) və yoxlayan tərəflərin bu
  sənədə əsaslanaraq nəqliyyat vasitəsi təhvil verməsinin məsuliyyətini qiymətləndirir. Sandbox və inkişaf mühiti bu baxışı gözləmir.
- Yoxlayan tərəfin istifadə qeydində məqsəd yazılır (məs. "avtomobil icarəsindən əvvəl sürücü məlumatlarının yoxlanılması"); [[t:registration-certificate]]
  ([[ADR-0026]]) bunu daşıyır.
- **Ödəniş və kvota:** hər sürücülük vəsiqəsi verilişi ikinci provayder sessiyasıdır; qəbul edildi, aylıq kvota izlənilir.

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Rəsmi mDL docType-ı ilə (`org.iso.18013.5.1.mDL`) vermək | rədd | Yalnız səlahiyyətli orqan verə bilər; rəsmi sənəd imitasiyası sayılır; mağaza və hüquqi risk ən yüksəkdir |
| Növ adı B `DrivingLicenceCheck`, C `DrivingEntitlementInfo`, D `mobility:` sahəsi | rədd | A ailədəki adlandırma ilə uyğundur və oxucuya tanışdır; "attestation" yoxlayan tərəfə bunun rəsmi sənəd olmadığını bildirir |
| A — Ayrı axın, ilkin şərtsiz (yalnız sürücülük vəsiqəsi sessiyası) | rədd | Daha qısadır; lakin rəqəmsal sənəd rəqəmsal cüzdandakı şəxsiyyətə bağlanmır, şəxsiyyət rəqəmsal sənədi olmayan şəxsə də verilir |
| **B — Ayrı axın, şəxsiyyət rəqəmsal sənədinin təqdimatı ilkin şərtdir** | **qəbul** | Şəxs və şəxsiyyət bağı güclüdür; şəxsiyyət sahələri vahid mənbədən gəlir; rəqəmsal sənəd yalnız sürücülük məlumatını daşıyır |
| C — Şəxsiyyətin yoxlanılmasını sürücülük vəsiqəsi ilə aparıb hər iki rəqəmsal sənədi birlikdə vermək | rədd | Şəxsiyyət rəqəmsal sənədinin ilkin şərti və sahələri sürücülük vəsiqəsinə görə dəyişir; iki növün həyat dövrü qarışır |
| Sürücülük məlumatını şəxsiyyət rəqəmsal sənədinə əlavə etmək | rədd | Şəxsiyyət rəqəmsal sənədi hər kəsdə olmalıdır; sürücülük məlumatı ayrıca həyat dövrü və ayrıca hədlər tələb edir |
| Təqdimatı ayrıca OpenID4VP raundu ilə istəmək | rədd | Rəqəmsal cüzdan və xidmət onsuz da eyni OpenID4VCI sessiyasındadır; təqdimat PAR-da ötürülür (silmə sorğusu ilə eyni naxış), əlavə raund və ikinci brauzer keçidi lazım deyil |
| Kateqoriyalar oxuna bilmirsə, kateqoriyasız rəqəmsal sənəd vermək | rədd | Rəqəmsal sənədin dəyəri kateqoriyalardadır; kateqoriyasız rəqəmsal sənəd yanıltıcı olar |
| Dövlətin rəqəmsal sürücülük vəsiqəsini gözləmək | rədd (hələlik) | Tarix yoxdur; K8 keçidi qoruyur |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| **DL1** | Tamga-nın sürücülük vəsiqəsi məlumatları sənədi rəsmi mDL docType-ından və ya namespace-indən istifadə etmir; metadata-sında, `not_official_licence` sahəsində, kartında və yoxlama nəticəsində rəsmi sürücülük vəsiqəsini əvəz etmədiyini bildirir. |
| **DL2** | Sənəd şəxsiyyət nömrəsi, məhdudiyyət və ya sağlamlıq kodu, foto və ünvan daşımır; sənəd nömrəsi yalnız açarlı heş şəklində mövcuddur; provayderin qeyd sahələri oxunmur. |
| **DL3** | Sənədin müddəti kartın bitmə tarixini və kartın yoxlandığı gündən etibarən bir ili keçmir; avtomatik yeniləmə müddəti uzatmır. |
| **DL4** | Hər hansı ölkənin səlahiyyətli orqanı rəqəmsal sürücülük vəsiqəsi verməyə başladıqda Tamga həmin ölkə üçün bu növü yenidən vermir. |
| **DL5** | Sənəd yalnız rəqəmsal cüzdandakı aktiv Tamga şəxsiyyət sənədinin təqdimatı əsasında və kartdakı ad ilə doğum tarixi həmin şəxsiyyətlə uyğun gəldikdə verilir; kateqoriyalar oxuna bilmirsə və ya kartın müddəti bitibsə, verilmir; bağlı şəxsiyyət sənədi ləğv edildikdə, yenidən verildikdə və ya silindikdə bu sənəd də ləğv edilir və ya silinir. |

# Nəticələr

- `packages/schemas`: yeni növ (inkişaf mərhələsi, `1.0.0`); görünən ad və təsvirdə K1 qeydi; `not_official_licence` sahəsi.
- Şəxsiyyət xidməti (operator reposu): PAR-da şəxsiyyət təqdimatının yoxlanılması, sürücülük vəsiqəsinə xüsusi provayder axını (ayrıca axın identifikatoru),
  kateqoriya və tarix sahələrini oxuyan uyğunlaşdırma, uyğunluq heşi, yeni növ üçün veriliş (yalnız SD-JWT VC), şəxsiyyət qeydinə bağlı ləğv;
  silmə sorğusu bu növü də əhatə edir.
- Etibar siyahısı: şəxsiyyət xidmətinin qeydinə yeni növ (real şəbəkə + sandbox).
- Rəqəmsal cüzdan: "Sənəd əlavə et" menyusu, PAR-a şəxsiyyət təqdimatı, kart qeydi, sahə etiketləri; mağaza mətnləri və məxfilik siyasəti.
- Tamga Verify və nümunə saytlar: "avtomobil icarəsi" nümunə yoxlaması; nəticə ekranında K1 qeydi (növbəti addım).
- Çərçivə sənədləri: Identity Rulebook-a yeni növ və DL qaydaları.

# Açıq suallar (layihə idarəetməsi)

1. **Adaş riski.** Kart ilə şəxsiyyət sənədi yalnız **ad + soyad + doğum tarixi** ilə uyğunlaşdırılır (K4). Eyni ad, soyad və doğum
   tarixinə malik iki şəxs (adaş) bir-birinin kartını öz şəxsiyyətinə bağlaya bilər; üz uyğunlaşdırması iki ayrı sessiyada iki ayrı
   sənədə qarşı aparıldığı üçün əsas maneə odur, lakin şəxsiyyət ilə kart arasında birbaşa bağ yoxdur. Seçim: Türkiyə kartlarında
   yazılmış **şəxsiyyət nömrəsini** sənədə yazmadan yalnız uyğunluq heşinə (HMAC) daxil etmək — şəxsiyyət sənədindəki nömrə ilə kartdakı
   nömrə eyni heşi verməlidir; nömrə heç yerdə saxlanmır və sənədə daxil olmur (DL2 qorunur). Şəxsiyyət nömrəsi olmayan kartlarda
   (digər ölkələr) bugünkü uyğunlaşdırma qalır. **2026-10-30: təklif qəbul edildi** (layihə rəhbərliyinin təsdiqi); tətbiq mühəndislik
   işidir, sürücülük vəsiqəsi məlumatı real şəxslərə açılmazdan əvvəl.

# Status

**Accepted — 2026-10-04.** Layihə rəhbərliyinin təsdiqi ilə: növ adı A, ilkin şərt şəxsiyyət rəqəmsal sənədi (B), kateqoriya oxuna bilmirsə rəqəmsal sənəd yoxdur, məhdudiyyət
faktı ötürülmür, mdoc yoxdur, hüquqi baxış real buraxılışdan əvvəl, ikinci provayder sessiyası qəbul edilir. Tətbiq provayderin kateqoriyaları
oxuduğunu yoxlayan tərəf təsdiqlədikdən sonra başladı. DECISIONS: D-ID-8.
