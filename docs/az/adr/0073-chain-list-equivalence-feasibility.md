---
document_id: ADR-0073
title: "Zəncir–siyahı ekvivalentliyinin tətbiq oluna bilməsi: miqrasiya rejimi, sərt ləğv, sxem versiyaları, yoxlayan tərəfin identifikatoru, status uyğunlaşdırması"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  ADR-0009 K7 imzalanmış siyahılardan zəncirə keçidi siyahı tarixçəsinin kontraktlarda yenidən icrasına və ekvivalentlik testinə bağlayır. Bugünkü kontraktlarla bu tarixçə dəqiq yenidən icra edilə bilmir: tarixlər blok vaxtından gəlir, sərt ləğv yoxdur, sxemin bir məzmun xülasəsi var, yoxlayan tərəfin identifikatoru sertifikata bağlıdır və dayandırmadan qayıda bilmir, status dəstləri və sərhədləri fərqlidir, gündəlik kvotalar toplu yazını dayandırır. Qərar: hər reyestr kontraktında Governance-in bir dəfə açdığı, bağlandıqdan sonra yenidən açıla bilməyən birdəfəlik miqrasiya rejimi (keçmiş tarix yalnız blok vaxtına qədər, kvota yoxdur); `invalidatesFrom` ilə sərt ləğv; sxem versiya xülasələri yalnız əlavə oluna bilən massiv; `rpId = keccak256(dns_name)`, sertifikatın yenilənməsi, dayandırmadan qayıdış və incə əhatə dairələri (xülasələrlə); status uyğunlaşdırma cədvəli və sənədin `iat` anındakı statusa görə yarımaçıq intervallarla qiymətləndirmə. Yenidən icra komandası `trust:chain-replay`. Qəbul edildi (2026-11-04): dayandırılmış qurumun dayandırmadan əvvəlki sənədləri etibarlıdır, miqrasiya pəncərəsi ən çoxu 30 gündür.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0010]]", "[[ADR-0015]]", "[[ADR-0029]]", "[[ADR-0034]]", "[[ADR-0046]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0063]]", "[[ADR-0074]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0073
source_version: "1.0.0"
---

# Qısaca

Zəncir işə salındıqda siyahıların bu günə qədərki bütün tarixçəsi kontraktlara bir dəfə köçürüləcək və zəncir hər sualda siyahı ilə
eyni cavabı verdiyi sübut edilmədən işə düşməyəcək ([[ADR-0009]] K7). Bugünkü kontraktlar bu köçürməni edə bilmir: keçmiş tarixi
yaza bilmir, "ələ keçirilib, bu tarixdən sonrakını sayma" deyə bilmir, bir sxemin bir neçə versiyasını tanımır, sertifikatı yenilənəndə
yoxlayan tərəfi başqası sayır və statusları siyahıdan fərqli sayır. Bu təklif kontraktlara bu imkanları əlavə edir və tarixçənin
yalnız bir dəfə, nəzarət olunan bir pəncərədə yazılmasına icazə verir.

# Kontekst

- [[ADR-0009]] K7: keçid siyahı versiya arxivinin kontrakt çağırışlarında yenidən icrası və ekvivalentlik testidir; qeydə alınmış hər
  `(issuer_id, schema_id, iat, list_id, version)` sorğusunda `TrustSource(list)` və `TrustSource(chain)` eyni C1/C2/C3/D5 cavabını
  verməlidir; ACCEPTED/REJECTED fərqi keçidin tamamlanmadığı deməkdir ([[SPEC-TRUST-0001]]/TL10).
- [[ADR-0051]] zənciri imzalanmış siyahıların proyeksiyası etdi və bu gün yalnız siyahı xülasələrini lövbərləyir; reyestr kontraktlarına
  yazı Faza 0 yenidən icrasına buraxıldı. Proyeksiyanın əhatə dairəsi [[ADR-0074]]-dədir.
- 2026-11-04-də kontraktlar, siyahı formatı və `TrustSource` müqayisə edildi. Yenidən icranı və ya ekvivalentliyi əngəlləyən fərqlər:

| Fərq | Siyahı bu gün | Kontrakt bu gün | Nəticə |
|---|---|---|---|
| F1 Tarixlər | `status_history[].since`, `valid_from`, sxem icazəsi `valid_from`/`valid_until`, `registered_at` imzalanmış siyahıda | `revokedAt`, icazə pəncərəsi `since`/`until`, `registeredAt` = `block.timestamp` | Tarixçə yenidən icra günün tarixini alır; köhnə sənədlər C1/C2-də rədd edilir |
| F2 Sərt ləğv | `REVOKED` + `invalidates_from`: o andan sonra verilmiş sənədlər düşür | Yalnız yumşaq ləğv (`revokedAt`) | Ələ keçirilmiş qurumun sonrakı sənədləri zəncirdə qəbul edilir |
| F3 Sxem versiyaları | `content_hash` + `content_hashes` ([[ADR-0010]] K4) | Tək `contentHash`, bir daha yazılmır (SC1) | Köhnə versiya ilə verilmiş sənədlər zəncirdə bütövlük yoxlamasından keçmir |
| F4 Yoxlayan tərəf | Daimi identifikator `dns_name` ([[ADR-0034]] CI3/CI4); sertifikat yenilənir; dayandırmadan qayıdılır; əhatə = növ, element yolları, format, ad sahəsi, xidmət identifikatoru, etibarlılıq | `rpId = keccak256(dövlət ‖ sertifikat xülasəsi)`, sertifikat dəyişmir, dayandırmadan qayıdış yoxdur, əhatə kobud `bytes32` | Sertifikatın yenilənməsi yeni yoxlayan tərəf yaradır; incə əhatə və artıq tələb yoxlaması zəncirdə mümkün deyil |
| F5 Statuslar | 8 dəyər (`ACTIVE`, `SUSPENDED`, `REVOKED`, `RETIRED`, `ROLLING_OVER`, `RESERVED`, `PROVISIONAL`, `DEPRECATED`); C1/C2 sənədin `iat` anındakı statusa baxır; dəyişiklik `since` anından qüvvədədir | 4–5 dəyərli enum-lar; C1 bugünkü statusa baxır (dayandırılmış qurumun bütün sənədləri rədd, təqaüdə çıxmış kökün sonrakı sənədləri qəbul); sərhədlər qapalı interval (`iat <= revokedAt`, `iat <= until`) | Eyni suala fərqli cavab; sərhəd anında bir saniyəlik fərq |
| F10 Kvotalar | — | Dövlət üzrə gündəlik yazı, siyahı üzrə gündə 48 dərc, qurum üzrə gündə 8 siyahı qeydiyyatı ([[ADR-0054]]/NS3) | Aylarla toplanmış tarixçə günlər, həftələr çəkir və ya heç bitmir |

  Sandbox-un hər gecə sıfırlanan lövbər jurnalı (F9) və siyahılarda olub zəncirdə heç bir qarşılığı olmayan qeydlər (F6–F8)
  [[ADR-0074]]-dədir.
- **Layihə rəhbərliyinin istiqaməti (2026-11-04):** zəncirin əhatə dairəsi "hər şey zəncirdə"; tarixçənin köçürülməsi üçün birdəfəlik
  miqrasiya rejimi, sərt ləğv, yalnız əlavə oluna bilən sxem versiya xülasələri və daimi yoxlayan tərəf identifikatoru təklif olunsun.
  Yenidən icra komandasının adı təsdiqləndi: `trust:chain-replay`.

# Qərar

## K1 — Birdəfəlik miqrasiya rejimi (F1, F10)

- Hər reyestr kontraktı (`RootCARegistry`, `IssuerRegistry`, `SchemaRegistry`, `RelyingPartyRegistry`, `StatusListRegistry`,
  `CrossRecognition` və [[ADR-0074]]-ün şəbəkə səviyyəli reyestri) üç mərhələli miqrasiya vəziyyəti daşıyır: **başlamayıb → açıq →
  bağlı**. Keçidlər yalnız irəli gedir; "bağlı"dan geri dönüş yoxdur və heç bir yeniləmə bu vəziyyəti sıfırlaya bilməz ([[ADR-0055]]
  GE2: yeniləmə yalnız parametrsiz başlanğıc selektorunu çağırır).
- Rejimi **Governance** növü müəyyən təkliflə (2/3, [[ADR-0055]]) **bir dəfə** açır. Təklif yenidən icra planının xülasəsini
  (`replayPlanHash` = ictimai arxivdən deterministik yaradılan planın SHA-256-sı) daşıyır; hər kəs planı arxivdən yenidən yaradıb
  zəncirdəki hadisələrlə müqayisə edə bilər. Bağlanış da Governance təklifi ilə olur və K6-dakı ekvivalentlik hesabatına əsaslanır.
- **Pəncərə ən çoxu 30 gündür** (açılış anından sayılır). Governance yalnız rejim açıq olarkən və bu tavanı aşmadan uzada bilər.
  Müddət bitəndə rejim özü-özünə **bağlanmış** sayılır; bu bağlanış da qətidir.
- Rejim açıq olarkən tarix daşıyan yazılar tarixi **açıq şəkildə** alır (status dəyişikliyi anı, icazə pəncərəsi, etibarlılığın
  başlanğıcı, qeydiyyat anı, ləğv siyahısının dərc anı). Qaydalar: heç bir tarix `block.timestamp`-dən irəli ola bilməz; qeydin
  tarixçəsi zaman ardıcıllığı ilə yazılır (əvvəlkindən geri tarix rədd edilir); yazılmış tarixçə dəyişmir.
- Kim yazır: milli qeydlər yenə həmin dövlətin nümayəndə açarları ilə (suverenlik və [[SPEC-BC-0001]]/N1 dəyişmir); şəbəkə səviyyəli
  qeydlər (şəbəkə sxemləri, [[ADR-0074]] K3) açılış təklifinin səlahiyyət verdiyi **tək miqrasiya icraçısı** ünvanı ilə (hər qeyd üçün ayrıca
  Governance səsverməsi lazım deyil) və yalnız rejim açıq olarkən.
- Yenidən icra istehsal arxivinin **ilk arxivləşdirilmiş versiyasından** başlayır.
- Rejim açıq olarkən [[ADR-0054]]/NS3 gündəlik kvotaları **tətbiq edilmir** (F10); rejim bağlananda kvotalar olduğu kimi qayıdır.
- Rejim açıq olmadıqda (başlamayıb və ya bağlı) bugünkü qayda qüvvədədir: tarixlər `block.timestamp`-dir. Yeganə istisna K2-dəki sərt
  ləğv tarixidir.
- Yenidən icra komandası **`trust:chain-replay`** (`apps/trust-publisher`): istehsal arxivini (`archive/` siyahı versiyaları, lövbər
  jurnalı arxivləri və nəzarət nöqtələri) yoxlayır, deterministik planı və onun xülasəsini yaradır; defolt `--dry-run` yalnız planı
  çap edir. Yazı `TAMGA_CHAIN_ENABLED` açıq və miqrasiya rejimi açıq olarkən aparılır; komanda qaldığı yerdən davam edir (zəncirdə
  olanı keçir) və sonda K6 testini işə salır.

## K2 — Sərt ləğv: `invalidatesFrom` (F2)

- Qurum qeydi `invalidatesFrom` daşıyır (0 = yoxdur). Ələ keçirilmə ləğvi bu tarixi yazır; şərt: `validFrom ≤ invalidatesFrom ≤
  revokedAt`. Tarix keçmişdə ola bilər (ələ keçirilmə sonradan aşkarlanır); bu, miqrasiya rejimindən kənarda keçmiş tarix yazıla bilən
  yeganə sahədir və qurumun öz etibarlılıq intervalı ilə məhdudlaşır.
- C1: `iat ≥ invalidatesFrom` olan sənəd düşür (siyahıda `invalidates_from ≤ iat` → NO, `TrustSource`-un bugünkü qaydası).
- Bir dəfə yazılmış tarix silinmir; yalnız daha geriyə çəkilə bilər (ləğvin əhatəsi genişlənir, daralmır).
- Kök CA-nın ləğvi bu gün artıq bütün altını düşürür (CA2); dəyişmir.

## K3 — Sxem versiya xülasələri yalnız əlavə oluna bilən massiv (F3)

- Sxem qeydi ilk `contentHash`-i saxlayır və yanında yalnız əlavə oluna bilən versiya xülasələri massivi daşıyır. Yeni versiya
  xülasəsini milli sxemdə həmin dövlət, şəbəkə sxemində Governance təklifi (miqrasiya rejimində miqrasiya icraçısı) əlavə edir.
  `matchesContentHash` massivdəki istənilən xülasə ilə uyğun gəlir; `REVOKED` sxemdə heç biri ilə uyğun gəlmir.
- Siyahı formatı SRI-dır (`sha256-<base64>`); zəncirdə eyni SHA-256 baytları `bytes32` kimi yazılır.
- [[SPEC-BC-0001]] SC1 daralır: "`vctURI` və yazılmış hər məzmun xülasəsi heç vaxt yenilənmir və ya silinmir; yeni versiya xülasəsi
  əlavə edilə bilər." Dərc edilmiş sxem metadata-sı yenə dəyişmir (D1); bu, [[ADR-0010]] K4-ün zəncir qarşılığıdır.

## K4 — Yoxlayan tərəfin identifikatoru, sertifikat, dayandırmadan qayıdış, incə əhatə (F4)

- **İdentifikator:** `rpId = keccak256(utf8(dns_name))`. Sertifikat yenilənəndə dəyişmir ([[ADR-0034]] CI3/CI4). ABI-də domen adı
  mətni yoxdur; qeydiyyat qurumu xülasəni hesablayır, indeksləyici və K6 testi formulu yoxlayır. Kontrakt suverenlik üçün dövlət
  kodunu ayrıca saxlayır. İdentifikatorlar zəncir formulu ilə olduğundan siyahıdakı `rp_id` də eyni formula keçir; bugünkü daxili açıqlama
  siyasətləri ([[ADR-0046]]) inkişaf mərhələsi qaydası ilə yenidən yazılır ([[ADR-0029]]).
- **Sertifikat:** giriş sertifikatının barmaq izi yenilənə bilər; köhnə və yeni barmaq izi hadisə ilə yayılır, tarixçə qalır. Bir
  barmaq izi eyni anda yalnız bir yoxlayan tərəfə məxsusdur.
- **Dayandırmadan qayıdış:** `SUSPENDED → ACTIVE` qayıdışı əlavə olunur (qurum və kök CA-da olduğu kimi). `REVOKED` qətidir.
- **İncə əhatə:** hər istifadə bir əhatə qeydidir; sərbəst mətn xülasə ilə:

| Siyahı sahəsi | Zəncirdə |
|---|---|
| `scope_id` | `keccak256(scope_id)` |
| `service_id` (yoxdursa `scope_id`) | `keccak256(service_id)` |
| `vct` | `schemaId = keccak256(vct)` |
| `format` | qapalı dəst, ardıcıllıqla: `dc+sd-jwt`, `mso_mdoc`, `mso_mdoc_zk` (yalnız sona əlavə edilir) |
| `mdoc_namespace` | `keccak256(mdoc_namespace)` və ya 0 |
| `claims[]` | sıralanmış element yolu xülasələri massivi (`keccak256(utf8(yol))`) |
| `valid_from`, `valid_until` | tarix intervalı (miqrasiya rejimində açıq tarixlə) |
| `purpose`, `purpose_localized`, `privacy_policy_uri` | bir təfərrüat xülasəsi (əhatə qeydinin kanonik JSON-unun SHA-256-sı) |

  Oxu: "bu yoxlayan tərəf bu xidmətdə, bu növdə, bu formatda bu elementi indi tələb edə bilərmi". ABI sahə adları şəxsi məlumat
  yoxlamasının qadağan kökləri (`claim`, `credential`, `holder`…) ilə toqquşmayacaq şəkildə seçilir (məs. "element"/`attribute`). Kobud
  `allowedScopes` aradan qalxır; [[SPEC-BC-0001]] §14 açıq məsələ 3 beləliklə bağlanır.

## K5 — Status uyğunlaşdırması və `iat` anındakı status (F5)

- Kontrakt C1/C2/C3-ü sənədin `iat` anındakı statusa görə qiymətləndirir: qurum, kök CA və sxem statusu yalnız əlavə oluna bilən
  status pəncərələri kimi saxlanılır (sxem icazəsi tarixçəsi bu gün belədir). İntervallar **yarımaçıqdır**: dəyişiklik başlanğıc
  anından qüvvədədir, `[başlanğıc, son)`. Beləliklə `iat <= revokedAt` və `iat <= until` sərhədləri siyahı ilə eyni olur (`iat < …`).
- Uyğunlaşdırma:

| Siyahı statusu | Kök CA | Qurum | Sxem | Yoxlayan tərəf | Qeyd |
|---|---|---|---|---|---|
| `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` | |
| `ROLLING_OVER` | `ACTIVE` + varis hadisəsi | — | — | — | Siyahı C1-də aktiv sayır |
| `SUSPENDED` | `SUSPENDED` | `SUSPENDED` | — | `SUSPENDED` | Yalnız dayandırma müddətində verilən sənəd düşür; dayandırmadan əvvəlkilər etibarlıdır (siyahı qaydası) |
| `RETIRED` | `RETIRED` | `REVOKED`, yumşaq (`revokedAt` = `since`) | — | `REVOKED` | Əvvəlki sənədlər etibarlı qalır (GV1) |
| `REVOKED` | `REVOKED` | `REVOKED`; `invalidates_from` varsa K2 | `REVOKED` | `REVOKED` | |
| `DEPRECATED` | — | — | `DEPRECATED` | — | SC3 |
| `RESERVED`, `PROVISIONAL` | qeyd yazılmır | qeyd yazılmır | qeyd yazılmır | qeyd yazılmır | Boş slot; slot statusu [[ADR-0074]] K3-də |

  "—" həmin qeyd növündə siyahıda istifadə olunmayan dəyərdir; dərc edən bu dəyərlə dərc etmir, yenidən icra onu görsə dayanır.
- Kontrakt enum-larına dəyər əlavə edilmir; fərq lazım olan yerdə siyahı statusu hadisədə daşınır.

## K6 — Ekvivalentlik testi və miqrasiyanın bağlanması

- `trust:chain-replay` sonda iki mənbəni eyni sorğu dəsti ilə müqayisə edir: `conformance/vectors/trust` + arxivdəki hər siyahı
  versiyası üçün qeydə alınmış hər `(issuer_id, schema_id, iat, list_id, version)`; həmçinin sərhəd anları (`since − 1`, `since`,
  `since + 1`) və əhatə sorğuları. Oxu tərəfi [[ADR-0074]] K5-dəki `ChainTrustSource`-dur.
- Qəbul: C1/C2/C3/D5 cavablarında ACCEPTED/REJECTED fərqi yoxdur. Fərq varsa miqrasiya bağlanmır; hesabat ictimai şəffaflıq
  hesabatına daxil olur.
- Bağlanışdan sonra zəncir yenə proyeksiyadır ([[ADR-0051]] CH1); Faza 0-ın zənciri mənbə edib-etməyəcəyi ayrıca qərardır.

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Kontraktlar həmişə açıq tarix qəbul etsin | rədd | Nümayəndə açarı ələ keçirilərsə tarixçə səssizcə yenidən yazılır; tarixə yalnız nəzarət olunan, birdəfəlik pəncərədə etibar edilə bilər |
| Tarixçəni yenidən icra etməmək; zəncir açıldığı gündən başlasın | rədd | Köhnə sənədlər zəncirdə rədd edilir; [[ADR-0009]] K7 və TL10 ödənmir |
| Miqrasiya üçün ayrıca "tarixçə" kontraktı, sonra köçürmə | rədd | İki mənbə, iki oxu yolu; ekvivalentlik iki dəfə sübut olunur |
| Miqrasiyada kvotaları qaldırmaq yerinə artırmaq | rədd | Tarixçənin həcmi əvvəlcədən bilinmir; pəncərə birdəfəlik və Governance təsdiqlidir, kvota qorumasına ehtiyac yoxdur |
| Hər sxem versiyası üçün yeni `schemaId` | rədd | `schema_id = keccak256(vct)` formulu pozulur; əsas versiya `vct`-dədir, kiçik versiyalar xülasə massivində ([[ADR-0010]]) |
| `rpId`-ni sertifikata bağlı saxlayıb uyğunluq cədvəli aparmaq | rədd | Təxəllüs, nüsxə ayrımı və açıqlama siyasəti artıq `dns_name`-ə bağlıdır ([[ADR-0034]] CI4); iki identifikator iki həqiqət deməkdir |
| Əhatədə element yollarını tək xülasə ilə saxlamaq | rədd | "Bu element tələb edilə bilərmi" sualı zəncirdə verilə bilməz; element üzrə xülasə artıq tələb yoxlamasını mümkün edir |
| Kontraktın C1-ini bugünkü statusa görə saxlamaq | rədd | Siyahıdan fərqli cavab; [[ADR-0009]] K7 testi keçmir |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| CE1 | Miqrasiya rejimi hər reyestr kontraktında Governance təklifi ilə bir dəfə açılır; pəncərə ən çoxu 30 gündür və müddət bitəndə özü bağlanır; bağlandıqdan sonra heç bir yolla (yeniləmə daxil) yenidən açıla bilməz. Rejim açıq olarkən keçmiş tarix yazıla bilər, lakin heç bir tarix blok vaxtından irəli ola bilməz, qeyd üzrə ardıcıllıq qorunur və gündəlik kvotalar tətbiq edilmir; rejim açıq olmadıqda tarixlər blok vaxtıdır (CE2 istisna). |
| CE2 | Sərt ləğv tarixi (`invalidatesFrom`) qurumun etibarlılıq başlanğıcı ilə ləğv anı arasındadır; yazıldıqdan sonra silinmir, yalnız geriyə çəkilə bilər; `iat` bu tarixə bərabər və ya ondan sonra olan sənəd qəbul edilmir. |
| CE3 | Sxemin `vctURI`-si və yazılmış hər məzmun xülasəsi dəyişdirilmir və silinmir; yeni versiya xülasəsi yalnız əlavə edilir. |
| CE4 | Yoxlayan tərəfin zəncir və siyahı identifikatoru `keccak256(dns_name)`-dir; giriş sertifikatının yenilənməsi identifikatoru dəyişmir. |
| CE5 | Kontrakt C1/C2/C3-ü sənədin `iat` anındakı statusa görə, yarımaçıq intervallarla qiymətləndirir (dayandırılmış qurumun dayandırmadan əvvəlki sənədləri etibarlıdır); siyahı statusları kontrakta uyğunlaşdırma cədvəli ilə yazılır. |
| CE6 | Miqrasiya `trust:chain-replay` ekvivalentlik testində C1/C2/C3/D5 cavablarında ACCEPTED/REJECTED fərqi qalmayana qədər bağlanmır. |

# Açıq suallar üzrə qərarlar (2026-11-04)

1. **Dayandırılmış qurumun köhnə sənədləri:** siyahı qaydası. Dayandırmadan əvvəl verilmiş sənəd etibarlıdır; yalnız dayandırma
   müddətində verilən sənəd düşür (K5). [[SPEC-BC-0001]] §3.3 buna uyğunlaşır.
2. **Miqrasiyada şəbəkə səviyyəli yazılar:** açılış təklifinin səlahiyyət verdiyi tək miqrasiya icraçısı yazır (K1).
3. **Miqrasiya müddətinin tavanı:** ən çoxu 30 gün; Governance yalnız rejim açıq olarkən və tavan daxilində uzadır; müddət bitəndə
   rejim özü-özünə bağlanmış sayılır (K1, CE1).
4. **Siyahıdakı `rp_id`:** `keccak256(dns_name)` olur (K4); bugünkü daxili açıqlama siyasətləri yenidən yazılır ([[ADR-0029]]).
5. **Yenidən icranın başlanğıcı:** istehsal arxivinin ilk arxivləşdirilmiş versiyası (K1).
6. Əhatə və element massivlərinin tavanları tətbiqdə başlanğıc dəyərlə qoyulur, sahə məlumatları ilə yenidən baxılır.

# Nəticələr

- Kontraktlar ([[ADR-0074]] ilə birlikdə): miqrasiya vəziyyəti və Governance təklifləri; qurum, kök CA və sxemdə
  status pəncərələri və yarımaçıq sərhədlər; `invalidatesFrom`; sxem versiya xülasələri; yoxlayan tərəfin identifikatoru, sertifikatın
  yenilənməsi, dayandırmadan qayıdış və əhatə qeydləri; `privacy-abi` testi yeni sahələri əhatə edir. Struct-lara sahə yalnız sona
  əlavə edilir (UUPS yaddaş düzülüşü).
- `apps/trust-publisher`: `trust:chain-replay` (plan, xülasə, quru sınaq, davam, ekvivalentlik testi); siyahı `rp_id` hesablaması
  (K4).
- Sənədlər: [[SPEC-BC-0001]] §3.3, §4.4 SC1, §6, §12.2, §13, §14 və [[SPEC-TRUST-0001]] §7 dəyişir; [[ADR-0051]]
  K2-nin "mövcud səkkiz kontrakt dəyişmir" cümləsi bu ADR və [[ADR-0074]] ilə dəyişmiş olur.
- İstehsal mühitində zəncir yenə söndürülmüşdür ([[ADR-0009]] K4, [[ADR-0051]] CH5); bu qərar yalnız keçidi mümkün edir.

# Status

**Accepted — 2026-11-04.** Layihə rəhbərliyinin təsdiqi ilə (hərfi sitat xüsusi təsdiq qeydində): dayandırılmış qurumun
dayandırmadan əvvəlki sənədləri etibarlıdır; açıq sualların qalanı təklif edildiyi kimi. Komanda adı `trust:chain-replay`
təsdiqlənib. DECISIONS: D-BC-12. CE1–CE6 məcburidir. Kontraktlarda tətbiq davam edir ([[SPEC-BC-0001]] versiya qeydləri).
