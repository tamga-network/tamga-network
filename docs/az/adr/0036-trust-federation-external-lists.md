---
document_id: ADR-0036
title: "Etibar federasiyası"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-13
summary: >
  Tamga LOTL-u digər operatorların (dövlət, dövlətin səlahiyyət verdiyi qurum, Avropa İttifaqı (Aİ)) dərc etdiyi etibar siyahılarını göstərə bilər: ünvan + LOTL-da sabitlənmiş imzalayan + əhatə dairəsi (hansı rollar, hansı rəqəmsal sənəd növləri) + təsdiq qeydi. İlk oxunan format ETSI TS 119 602-dir (LoTE JSON). Əhatə dairəsindəki cüzdan provayderlərinin rəqəmsal cüzdanlarına rəqəmsal sənəd verilə bilər; əhatə dairəsindəki PID/EAA provayderlərinin rəqəmsal sənədləri (Aİ PID, mDL daxil olmaqla) yoxlanıla bilər. Müəyyən xarici siyahıya etibar etmək bu ADR-in qərarı DEYİL — hər siyahı LOTL-a layihə rəhbərliyinin təsdiqi ilə daxil olur.
domain: Trust
translation_of: ADR-0036
source_version: "1.0.0"
---

# Xülasə (sadə)

- Dövlət və ya Aİ öz etibar siyahısını dərc etdikdə Tamga-nın siyahılar siyahısı (LOTL) həmin siyahının **ünvanını,
  imzalayanını və nəyə zəmanət verə biləcəyini** göstərir. Siyahı sahibində qalır; Tamga yalnız toplayır.
- Rəqəmsal cüzdan və yoxlayan tərəf yenə də tək bir şeyə etibar edir: Tamga LOTL-unun kök açarı. Qalanını LOTL deyir.
- Xarici siyahı **öz əhatə dairəsindən kənara çıxa bilməz**. Məsələn, yalnız şəxsiyyət provayderlərinə zəmanət verən siyahı diplom verən qurum əlavə edə bilməz.
- Bu gün LOTL-da xarici siyahı **yoxdur**. Siyahının əlavə edilməsi ayrıca təsdiqdir.
- Yoxlayan tərəf Aİ şəxsiyyət sənədini (PID) və sürücülük vəsiqəsini (mDL) də tanıyır. Aİ şəxsiyyət sənədindəki iç-içə sahələr (ünvanın alt sahələri,
  vətəndaşlıqlar massivi) seçici şəkildə açıla bilər.

# Kontekst

[[ADR-0035]] Tamga Network-u bir **[[t:federation]]** kimi mövqeləndirdi: ölkə siyahılarını toplayır və bir-birinə tanıdır. [[ADR-0009]]
təhvil hədəfini qoymuşdu: dövlət gəldikdə siyahının sahibi dəyişir, identifikatorlar dəyişmir. Bunun texniki qapısı yox idi:

1. Kod yalnız Tamga kökünün imzaladığı və Tamga formatında (`tamga-tl+jwt`) olan siyahıları oxuyurdu.
2. Dövlətlər və Aİ siyahılarını [[t:ETSI]] formatında dərc edir. Aİ eIDAS 2.0 rəqəmsal cüzdan rolları ([[t:wallet-provider|cüzdan provayderləri]],
   [[t:PID]] provayderləri, [[t:access-certificate]] provayderləri) üçün ETSI TS 119 602 "Lists of Trusted Entities"
   ([[t:LoTE]]) istifadə edir.
3. Rəqəmsal sənəd vermə servisimiz yalnız Tamga siyahısındakı cüzdan provayderlərinin rəqəmsal cüzdanlarına [[t:credential]] verirdi. Buna görə TÜBİTAK və ya bir
   Aİ rəqəmsal cüzdanı Tamga qurumlarından rəqəmsal sənəd ala bilmirdi.
4. [[t:verifier]] Aİ PID / [[t:mDL]] növlərini tanımırdı. SD-JWT paketi də yalnız kök səviyyədəki sahələri aça bilirdi; iç-içə
   [[t:selective-disclosure]] yox idi (RFC 9901 §4.2).

Layihə rəhbərliyi bu boşluqların aradan qaldırılmasını təsdiqlədi (2026-10-01; hərfi sitat xüsusi təsdiq qeydindədir).

# Qərar

## K1 — LOTL-da xarici siyahı göstəricisi

`lotl.external_lists[]`. Hər qeyddə aşağıdakılar olur:

| Sahə | Mənası |
|---|---|
| `list_id` | Daimi identifikator |
| `territory` | Ölkə (ISO 3166-1) və ya `EU` |
| `format` | `etsi-lote-json` (oxunur); `etsi-tl-xml` (oxunur — 2026-10-12 qeydi: ETSI TS 119 612 XML oxuyucusu və XML imzasının yoxlanılması, paketlər 0.5.0; eyni FD qaydaları) |
| `list_url` | Orijinal dərc ünvanı |
| `signing_keys` | Siyahını imzalayan sertifikatların SHA-256 barmaq izləri; **Tamga imzalı LOTL-da sabitdir** |
| `operator` | Siyahını idarə edən operator |
| `status` | Status |
| `scope` | Əhatə dairəsi: aşağıdakı K2 |
| `approval` | Təsdiq tarixi və qeydi (FD4) |

Dərc edən tərəf siyahının surətini `trust.tamga.network/external/<list_id>.jws` ünvanında saxlayır (`npm run trust:external`). Oxuyucular
əvvəlcə bu surətdən, o olmadıqda isə orijinal ünvandan istifadə edir. İmza hər iki halda [[t:LOTL|LOTL-dakı]] sabit imzalayana qarşı yoxlanılır; surət məzmunu
dəyişə bilməz.

## K2 — Əhatə dairəsi

`scope.entity_kinds` ⊂ {`wallet_provider`, `pid_provider`, `eaa_provider`, `access_ca`}. PID və [[t:EAA]] provayderləri üçün
`scope.vct` (zəmanət verilə bilən rəqəmsal sənəd növləri) məcburidir. Qurumun yoxlama siyasətində görünən təsnifatı əhatə dairəsindən
gəlir: `category`, `assurance`, `class`, `recognized_by`. Cüzdan provayderləri üçün `min_key_storage` müəyyən edilə bilər.

## K3 — Oxuma qaydaları

- Hər xarici siyahı **müstəqildir.** Onlardan biri çatışmasa, köhnəlsə və ya yoxlanıla bilməsə belə, Tamga siyahılarının aktuallığı pozulmur. Həmin siyahıya
  bağlı sorğular UNKNOWN qaytarır (yoxlayan tərəfdə INDETERMINATE).
- ETSI xidmət növü → rol uyğunlaşdırması URI-nin yol hissəsinə əsaslanır: `WalletSolution`, `PID`, `EAA`, `WRPAC`. `…/Issuance`
  imzalama, `…/Revocation` isə [[t:status-list]] imzalama deməkdir. Geri çəkilmiş xidmətlər götürülmür.
- Siyahıdakı xidmət sertifikatı **[[t:trust-anchor]]** kimi istifadə olunur: bu, CA və ya birbaşa imzalayanın özü ola bilər. Yoxlayan tərəf rəqəmsal sənəd
  zəncirinin bağlandığı lövbərin barmaq izini çıxarır və xarici qurumu buradan müəyyən edir.
- Sıra nömrəsi geri gedə bilməz (geri sarımanın rədd edilməsi). Naməlum `LoTEVersionIdentifier` yüklənmir (CMP2).

## K4 — Rəqəmsal sənəd vermə (xarici rəqəmsal cüzdanlar)

Qurum əhatə dairəsində `wallet_provider` olan xarici siyahının tanıdığı provayderin cüzdan sübutunu ([[t:WIA]]/[[t:WUA]]) qəbul edir.
Əhatə dairəsindəki `min_key_storage` qurumun öz siyasətindən sərtdirsə, o tətbiq olunur. Defolt dəyişmir: LOTL-a xarici siyahı əlavə edilmədikcə
yalnız Tamga siyahısındakı provayderlər tanınır.

## K5 — Yoxlama (xarici qurumlar, Aİ PID, mDL)

- **B2:** Tamga kataloqunda olmayan növ yalnız bu iki şərtlə qəbul edilir: rəqəmsal sənəd zənciri bu növə zəmanət verən xarici siyahının
  lövbərinə bağlıdırsa və növ xarici növ təriflərindədirsə (`urn:eudi:pid:1`, `eu.europa.ec.eudi.pid.1`, `org.iso.18013.5.1.mDL`).
  Bu halda B4 (Tamga kataloqunun xülasəsi) tətbiq olunmur. Tamga növlərində `vct#integrity` məcburi olaraq qalır.
- **C:** C1/C2 xarici siyahının aktuallığından və əhatə dairəsindən gəlir. C3 əhatə dairəsindəki `recognized_by` ilə qiymətləndirilir. C4 və `iss`
  uyğunluğu tətbiq olunmur.
- **D:** Ləğv siyahısını imzalayan qurumun xarici siyahıdakı ləğv xidməti sertifikatıdır (o olmadıqda lövbərin özü).
- **E:** E1–E3 dəyişmir; iç-içə yollar (`address.locality`) üçün əhatə dairəsi sahənin özü və ya onun valideyni üzərindən qiymətləndirilir.

## K6 — İç-içə selective disclosure

[[t:SD-JWT-VC]] həlli RFC 9901 §7.1-ə uyğun aparılır. Obyekt daxilində `_sd`, massiv elementlərində `{"...": özet}` istifadə olunur; açıqlanan
dəyərlər rekursiv həll edilir; hər [[t:disclosure]] dəqiq bir dəfə istifadə olunur; uyğun gəlməyən disclosure rədd edilir. Yollar `a.b` və `a[i]`
formatındadır. Qayda yalnız bir realizasiyadadır (`@tamga-network/core/sd-structure`); yoxlayan tərəf və rəqəmsal cüzdan eyni koddan istifadə edir. [[t:DCQL]]
yolları (`["address","locality"]`, `["nationalities", null]`) bu formata çevrilir.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| FD1 | Xarici siyahı yalnız Tamga imzalı LOTL-da ünvanı, sabitlənmiş imzalayan barmaq izi və əhatə dairəsi ilə göstərilir; imzalayanı LOTL-dakı ilə uyğun gəlməyən siyahı yüklənmir. |
| FD2 | Xarici siyahı öz əhatə dairəsindən kənar rollara və rəqəmsal sənəd növlərinə zəmanət verə bilməz; əhatə dairəsindən kənar qeydlər nəzərə alınmır. |
| FD3 | Xarici siyahının çatışmaması, köhnəlməsi və ya yoxlanıla bilməməsi Tamga siyahılarının aktuallığını pozmur; həmin siyahıya bağlı hər sorğu UNKNOWN qaytarır. |
| FD4 | Xarici siyahının LOTL-a daxil olması, dəyişməsi və ya çıxarılması layihə rəhbərliyinin təsdiqi ilə həyata keçirilir və qeyd `approval` sahəsində göstərilir; yer tutucu ehtiva edən qeyd dərc olunmur. |
| FD5 | Tamga növlərində `vct#integrity` məcburidir; xarici növlərdə növə etibar xarici siyahının imzalı qeydindən gəlir. |

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Xarici qeydləri Tamga siyahısına köçürmək | rədd | Qeyd Tamga-nın imzası ilə görünür: sahiblik yanlışdır, təhvil mənasızdır və yanlış bəyan riski var. |
| Yoxlayan tərəflərin xarici siyahıları özlərinin seçməsi | rədd (defolt olaraq) | Hər yoxlayan tərəf fərqli şeyə etibar edir; rəqəmsal cüzdan və qurum üçün vahid etibar lövbəri itir. Qurumlar yenə də öz `TrustSource`-unu verə bilər (BT4). |
| **LOTL-da göstərici + sabit imzalayan + əhatə dairəsi** | **qəbul** | Aİ LOTL-unun modeli; sahiblik siyahıda qalır; təhvil zamanı yalnız ünvan və imzalayan dəyişir ([[ADR-0009]]). |
| Əvvəlcə ETSI TS 119 612 XML oxuyucusu | təxirə salındı | Aİ-nin rəqəmsal cüzdan rolları 119 602 JSON ilə dərc olunur; XML ([[t:QTSP|QTSP-lər]]) elektron imza tərəfdaşlığı ilə gündəmə gələcək. |

**Məlum məhdudiyyətlər:**

- Xarici cüzdan provayderlərinin cüzdan sübutu **formatları** (WIA sahələri) istehsalçıya görə fərqlənə bilər. Real xarici
  rəqəmsal cüzdanla qarşılıqlı işləmə testi ayrıca aparılmalıdır.
- `access_ca` əhatə dairəsi müəyyən edilib, lakin yalnız saxlanılır. Xarici giriş sertifikatlı yoxlayan tərəflərin rəqəmsal cüzdanda göstərilməsi növbəti işdir.
- Rəqəmsal cüzdanın xarici siyahıları oxuması defolt olaraq söndürülüb (`externalLists`). Onun aktivləşdirilməsi xarici qurumların rəqəmsal sənədlərinin rəqəmsal cüzdanda tanınması üçün
  lazımdır.

# Nəticələr

Tətbiq edildi (2026-10-01):

- `@tamga-network/trust`: növ, LoTE oxuyucusu, anbar, `TrustSource` və HTTP / kataloq yükləyiciləri.
- Dərc edən: qeydin yoxlanılması və `external-fetch`.
- `@tamga-network/verifier`: lövbər üzərindən xarici qurumun müəyyən edilməsi, xarici növlər və iç-içə yollar.
- `@tamga-network/sd-jwt` və wallet-core: iç-içə selective disclosure.
- `@tamga-network/issuer` və qurum servisi: xarici provayderin açar anbarı qaydası.
- `@tamga-network/schemas`: xarici növ tərifləri.
- Tamga Verify: xarici lövbərlər kök toplusundadır.
- Testlər: sintetik xarici LoTE ilə federasiya uyğunluq testləri; iç-içə açıqlama üzrə vahid testləri.

# Əlavə — ETSI TS 119 612 XML siyahısının dərci (təxirə salınmış qərar, 2026-10-13)

- **Mövzu.** Tamga bu gün ETSI TS 119 612 XML etibar siyahılarını **oxuyur** (K1, 2026-10-12 qeydi), lakin öz siyahılarını XML kimi
  **dərc etmir**; siyahılar Tamga JSON + JWS və ETSI TS 119 602 (LoTE JSON) görünüşü ilə dərc olunur. ARF 3.0 rəqəmsal cüzdan, yoxlayan tərəf və
  sənədi verən qurum üçün hər iki formatın dəstəklənməsini tələb edir (ISSU_10b, OIA_15b). ETSI TS 119 472-2-nin Aİ uyğunlaşdırmasında (İcra Reqlamenti (Aİ)
  2026/1731, RO-17) DCQL `trusted_authorities` növü `etsi_tl` 119 612 XML siyahısına istinad edir.
- **Qərar: təxirə salındı.** Tamga Network-un siyahılarının 119 612 XML (XAdES imzalı) görünüşünü dərc etmək və yoxlayan tərəflərin sorğularında
  `etsi_tl` növündən istifadə etmək **bu gün həyata keçirilmir**. Yoxlayan tərəflərin sorğularında `aki` (HAIP) qalır.
- **Tetikləyici:** Aİ-dən ilk tərəfin (Aİ yoxlayan tərəfi, rəqəmsal cüzdanı, üzv dövlət və ya Aİ qurumu) Tamga siyahısını 119 612 XML
  formatında və ya `etsi_tl` ilə tələb etməsi. Tetikləyici baş verdikdə məsələ layihə rəhbərliyinə çıxarılır; təxmini iş həcmi ~3 gündür (generator,
  XAdES imzası, imza açarının idarə edilməsi; [[SPEC-ID-0002]] §8.1).
- **Bu gün də qüvvədə olan qayda:** rəqəmsal cüzdan və yoxlayan tərəf tanımadıqları `trusted_authorities` növünü "uyğun gəlmir" kimi qiymətləndirir, "keçdi" kimi yox
  (yanlış müsbət nəticə yoxdur; paketlərin 0.5.2 versiyası).

# Status

**Accepted — 2026-10-01** (layihə rəhbərliyinin təsdiqi). Müəyyən xarici siyahılar (TÜBİTAK, Aİ LOTL, digər dövlətlər) **ayrıca təsdiqlərlə**
əlavə edilir.

> **Əlavə (2026-10-13):** 119 612 XML siyahısının dərci və `etsi_tl` təxirə salındı; tətikləyici Aİ-dən ilk tərəfin bunu tələb etməsidir (yuxarıdakı "Əlavə").
> Layihə rəhbərliyinin təsdiqi ilə (Aİ ilə ilk uyğunluq mərhələsi, qərar 15).

> **Qeyd (2026-10-13, mühəndislik düzəlişi, paketlər 0.5.2):** yuxarıdakı "uyğun gəlmir" qaydası daraldıldı — rəqəmsal cüzdan
> qiymətləndirə bilmədiyi `trusted_authorities` şərtinə görə rəqəmsal sənədi kənarlaşdırmır ("qiymətləndirilə bilmədi"; sənəd təklif olunur, müsbət etibar
> göstəricisi sayılmır), `etsi_tl`-i yüklənmiş siyahılara qarşı qiymətləndirir; təfərrüat: [[SPEC-PROTO-0002]] §4.6. "Keçdi" kimi saymaq qadağası
> dəyişməyib. Sorğuda `etsi_tl` olduqda rəqəmsal cüzdan LOTL-dakı imzası yoxlanılmış xarici siyahıları uyğunlaşdırmaya ötürür
> (`TrustSource.externalTrustedLists()`); yalnız mdoc nüsxəli sənədin zənciri mdoc IssuerAuth `x5chain`-dən oxunur. Bu, Tamga
> Network-un 119 612 XML dərcini (yuxarıda təxirə salınıb) tələb etmir: qiymətləndirilən Aİ-nin və digər dövlətlərin dərc etdiyi
> siyahılardır.
