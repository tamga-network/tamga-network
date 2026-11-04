---
document_id: ADR-0074
title: "Proyeksiyanın əhatə dairəsi 0.8: imzalanmış siyahılardakı bütün etibar qeydləri zəncirdə"
status: Proposed
review_status: Draft
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  İmzalanmış siyahılarda olub zəncirdə qarşılığı olmayan qeydlərin (keçid qrupları, qeydiyyat sertifikatı status siyahısı, XML və LoTE görünüşləri, siyahı imzalayanları, cüzdan provayderləri, ZK sxemləri, xarici siyahılar, sənəd kateqoriyaları, siyahı operatoru, qurum sinfi və qeydiyyat məlumatları) hansı kontrakta, hansı sahə və hadisə ilə əks olunacağını təklif edir. Sərhəd: zəncirə şəxsi məlumat və sərbəst mətn daxil olmur; qeydiyyat təfərrüatları yalnız xülasə (`bytes32`) və mövcud `metadataURI` nümunəsi ilə; yeni `string` sahəsi yoxdur. Şəbəkə səviyyəli qeydlər Governance təklifi ilə yazılır. Qeydiyyat sertifikatı status siyahısı və siyahı görünüşləri lövbər jurnalına yeni sətir növləri ilə daxil olur. Oxu yolu `ChainTrustSource` + indeksləyici `apps/` altındadır. Sandbox zəncirə yazılmır. `contracts/` ictimai depoya keçir. Yeni adlar təsdiq gözləyir. Təklifdir; qəbul layihə rəhbərliyindədir.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0015]]", "[[ADR-0024]]", "[[ADR-0032]]", "[[ADR-0036]]", "[[ADR-0038]]", "[[ADR-0051]]", "[[ADR-0055]]", "[[ADR-0066]]", "[[ADR-0068]]", "[[ADR-0069]]", "[[ADR-0070]]", "[[ADR-0073]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0074
source_version: "1.0.0"
---

# Qısaca

Zəncir imzalanmış siyahıların ikinci qeydidir; siyahılar nə deyirsə, zəncir də onu deməlidir. Bu gün siyahıların bir hissəsi (keçid
qrupları, cüzdan provayderləri, xarici siyahılar, qeydiyyat sertifikatlarının ləğv siyahısı, siyahı operatoru və qeydiyyat
məlumatları) zəncirdə ümumiyyətlə yoxdur. Bu təklif onların hər birinin zəncirdə harada və necə yazılacağını göstərir. Şəxsi
məlumatlar və izah mətnləri zəncirə getmir; onların yerinə "barmaq izi" kimi qısa bir xülasə yazılır, mətnin özü imzalanmış
siyahıda qalır. 0.8 paket xəttində tətbiqi təklif olunur.

# Kontekst

- [[ADR-0051]] zənciri imzalanmış siyahıların proyeksiyası etdi (CH1) və bu gün yalnız siyahı versiyalarının və lövbər jurnalı başının
  xülasəsini yazır; reyestr kontraktlarına yazı Faza 0 yenidən icrasına buraxıldı. [[ADR-0073]] bu yenidən icranı tətbiq oluna bilən edir.
- [[SPEC-TRUST-0001]] §7 siyahı sahələrini kontrakt çağırışlarına uyğunlaşdırır; `wallet_providers[]` və `zk_circuits[]` üçün "zəncirdə
  hələ yoxdur — ADR namizədi" deyir. 2026-11-04 müqayisəsində uyğunlaşdırmadan kənarda qalanlar:
  - **F6:** keçid qrupları ([[ADR-0069]]), qeydiyyat sertifikatı status siyahısı ([[ADR-0068]]), ETSI XML görünüşü və
    `xml_signing_keys` ([[ADR-0066]]), LoTE görünüşləri zəncirdə yoxdur.
  - **F7:** LOTL-dakı cüzdan provayderləri, ZK sxemləri ([[ADR-0032]]), xarici siyahılar ([[ADR-0036]]) və `eaa_categories` yoxdur.
  - **F8:** siyahı operatoru `operator {name, status, on_behalf_of}` ([[ADR-0070]]), qeydiyyat məlumatları ([[ADR-0024]]), qurum sinfi
    (`class`) və `revocation_policy_uri` zəncirdə yoxdur; kontraktda yalnız `nameHash` və `metadataURI` var.
  - **F9:** sandbox-un ([[ADR-0038]]) lövbər jurnalı və siyahıları hər gecə sıfırlanır; zəncirdəki versiya və ardıcıllıq yalnız irəli
    gedir və silinmir ([[ADR-0051]]/CH4).
- [[ADR-0051]] açıq məsələ 4 (`ChainTrustSource` + indeksləyici) və 5 (`contracts/` ictimai depoya) bu təklifdədir.
- **Layihə rəhbərliyinin istiqaməti (2026-11-04):** əhatə dairəsi "hər şey zəncirdə" — keçid qrupları, qeydiyyat sertifikatı status
  siyahısı, cüzdan provayderləri, xarici siyahılar, ZK sxemləri, sənəd kateqoriyaları və qeydiyyat məlumatları daxil. Sərhəd: şəxsi
  məlumat və sərbəst mətn zəncirə daxil olmur; qeydiyyat təfərrüatı xülasə və ya ünvan kimi. Açıqlıq: bələdçi, PDF, sənəd saytının
  anlayış səhifəsi və `contracts/` ictimaidir.

# Təklif olunan qərar

## K1 — Əhatə prinsipi və məlumat sərhədi

- İmzalanmış siyahılarda (LOTL, milli siyahılar, lövbər jurnalı) etibar qərarına təsir edən hər qeyd zəncirdə bir kontrakt qeydinə
  və ya lövbərə uyğunlaşdırılır. Siyahı mənbə olaraq qalır; ziddiyyət olduqda siyahı qüvvədədir ([[ADR-0051]] CH1).
- Zəncirə yalnız identifikator xülasələri, barmaq izləri, qapalı dəst dəyərləri, rəqəmlər, tarixlər, dövlət kodları və ünvanlar
  (address) yazılır. Sərbəst mətn (ad, ticarət adı, təsvir, məqsəd, qeyd, etiket, səbəb) və qeydiyyat təfərrüatları (vergi nömrəsi və
  digər identifikatorlar, poçt ünvanı, əlaqə, siyasət və məlumat ünvanları, nəzarət orqanı) yalnız **təfərrüat xülasəsi** kimi yazılır:
  imzalanmış siyahıdakı müvafiq sahə blokunun kanonik JSON-unun (RFC 8785) SHA-256-sı. Qeydin tamamına işarə lazımdırsa, mövcud
  `metadataURI` sahəsindən istifadə olunur.
- ABI: yeni sahələr `bytes32`, tam ədəd, `bool`, `bytes2` və ya `address`-dir; yeni `string` sahəsi və sərbəst `bytes` yoxdur;
  `privacy-abi` testinin icazə dəsti genişlənmir. Kontrakta yalnız sorğu və ya ekvivalentlik üçün lazım olan sahə əlavə edilir;
  struct-lara sahə sona əlavə edilir (UUPS yaddaş düzülüşü, `__gap`).
- Şəxsiyyət, rəqəmsal sənəd, sənəd xülasəsi, ləğv biti, təxəllüs, cihaz və ya cüzdan nüsxəsi identifikatoru heç vaxt (DP1, TL11).

## K2 — Milli siyahılar (F6, F8)

| Siyahı sahəsi | Kontrakt | Zəncirdə |
|---|---|---|
| `issuers[].class` | `IssuerRegistry` | qapalı dəst `PUB`, `QUALIFIED`, `EAA` (yalnız sona əlavə edilir) |
| `issuers[]` qeydiyyat məlumatları ([[ADR-0024]]: `trade_name`, `identifiers`, `postal_address`, `info_uri`, `contact`, `service_description`, `supervisory_authority`) | `IssuerRegistry` | qeydiyyat məlumatları xülasəsi; `is_public_sector_body` → `bool`; `entitlements` → qapalı dəst bit maskası |
| `issuers[]` iş ünvanları (`issuer_url`, `status_list_base`, `revocation_policy_uri`), `assurance_basis`, `authentic_source`, `delegate_keys` | `IssuerRegistry` | təfərrüat xülasəsi (siyahıdakı `delegate_keys` imza açarı barmaq izidir; zəncirdəki nümayəndə ünvanları ilə qarışdırılmır) |
| `relying_parties[]` qeydiyyat məlumatları | `RelyingPartyRegistry` | qeydiyyat məlumatları xülasəsi, `bool`, bit maskası (eyni qayda) |
| `relying_parties[].uses_intermediaries`, `served_relying_parties` | `RelyingPartyRegistry` | `rpId` massivləri ([[ADR-0073]] K4) |
| `relying_parties[].pseudonyms` | `RelyingPartyRegistry` | qapalı dəst `single`, `multiple` |
| `relying_parties[].terminal_groups[]` ([[ADR-0069]]) | `RelyingPartyRegistry` | qrup qeydi: `keccak256(group_id)` (bütün şəbəkədə unikal, TG1), qurum bağlantısı (`issuerId` və ya `rpId`), siyasət identifikatoru xülasələri, keçid sertifikatı barmaq izləri, `offline_allowed`, etibarlılıq intervalı; `label` → xülasə. Geri çəkilmiş qrup silinmir, intervalı bağlanır |
| `root_cas[]`, `issuers[]`, `relying_parties[]` `legal_name` | mövcud `nameHash` | dəyişmir |
| `operator` (hər siyahıda) | şəbəkə səviyyəli qeyd (K3) | siyahı operatoru qeydi |

## K3 — LOTL və şəbəkə səviyyəli qeydlər (F6, F7, F8)

- LOTL-un şəbəkə səviyyəli məzmunu üçün **yeni şəbəkə səviyyəli reyestr kontraktı** təklif olunur (təklif olunan ad `NetworkRegistry`,
  **təsdiq gözləyir**). Yazı yalnız Governance-in növü müəyyən təklifləri ilə (2/3, [[ADR-0055]]/GE3) və ya miqrasiya rejimində
  miqrasiya icraçısı ilə ([[ADR-0073]] K1).

| LOTL sahəsi | Zəncirdə |
|---|---|
| `wallet_providers[]` | provayder qeydi: `keccak256(provider_id)`, ad xülasəsi, status pəncərələri; WUA imza açarları: barmaq izi + etibarlılıq + status. Sorğu: "bu barmaq izi hazırda siyahıda olan provayderin WUA açarıdırmı" |
| `zk_circuits[]` | sxem qeydi: `circuit_id`, sistem (`keccak256("longfellow-libzk-v1")`), versiya, atribut sayı, sxem faylının SHA-256-sı, status; `note` yazılmır |
| `external_lists[]` | xarici siyahı qeydi: `keccak256(list_id)`, ərazi (`bytes2`; ölkə kodu və ya `EU`), format (qapalı dəst `etsi-lote-json`, `etsi-tl-xml`), sabitlənmiş imzalayan barmaq izləri, operator adı xülasəsi, status; əhatə: rol bit maskası, növ xülasələri (`vct` / docType), kateqoriya, təminat, sinif, tanıyan dövlətlər, minimum açar saxlama; təsdiq (`approval`) tarixi və xülasəsi (FD4); `list_url` → təfərrüat xülasəsi |
| `eaa_categories` | kateqoriya qeydi: `keccak256(kod)` + etiket xülasəsi |
| `anchor_signing_keys`, `national_lists[].signing_keys`, `national_lists[].xml_signing_keys` ([[ADR-0066]]) | imzalayan qeydi: siyahı açarı və ya dövlət kodu, məqsəd (qapalı dəst: lövbər, JSON siyahı, XML siyahı), barmaq izi, etibarlılıq, status |
| `national_lists[]` slotları (`status`, `membership`, `roles`) | slot qeydi: dövlət kodu, slot statusu (`RESERVED`, `PROVISIONAL` daxil), üzvlük növü (qapalı dəst); rol slotları: rol xülasəsi, status, operator xülasəsi. Üzvlük və tanınma mövcud Governance və `CrossRecognition`-dadır |
| `operator` (LOTL və hər milli siyahı) | siyahı operatoru qeydi: siyahı açarı (`listKey`), ad xülasəsi, status (`provisional`, `designated`), `on_behalf_of` xülasəsi. Təhvil yalnız bu qeydi dəyişir ([[ADR-0070]]/OP3, [[ADR-0009]] K5) |
| `catalogue.url` | təfərrüat xülasəsi |
| `pid_providers[]` | siyahı mərhələsində boşdur (TL8); dolduqda cüzdan provayderi qeydi ilə eyni forma |

## K4 — Lövbər jurnalında yeni sətir növləri (F6)

Qeydiyyat sertifikatı status siyahısı və siyahı görünüşləri bu gün lövbər jurnalında deyil. İki yeni sətir növü təklif olunur
(**adlar təsdiq gözləyir**):

| Sətir növü (təklif olunan ad) | Sahələr | Zəncirdə |
|---|---|---|
| `registration_status` (alternativ `wrprc_status`) | `list_uri` (qeyri-şəffaf, S8), `content_hash` (imzalanmış siyahının SHA-256-sı), `list_version` (dərc edənin siyahı üzrə monoton sayğacı), `published_at` | Siyahı lövbəri reyestrində `anchorList`; açar `keccak256("tamga:registration-status:<mühit>:<n>")` |
| `list_view` | `file` (məs. `tl-tr.xml`), `format` (`etsi-tl-xml`, `etsi-lote-json`), `source_file` (`lotl`, `tl-<cc>`), `source_version`, `content_hash` (faylın SHA-256-sı = `.sha2`) | `anchorList`; açar `keccak256("tamga:trust-list-view:<mühit>:<fayl>")`, versiya = mənbə siyahının versiyası ([[ADR-0066]] K1: görünüş ayrıca siyahı deyil) |

- Nəzarət nöqtəsinin `state`-i bu sətirləri də daşıyır (TL12). Kontrakt dəyişikliyi lazım deyil; yeni açar ad sahələri kifayətdir.
- Görünüş mənbə ilə ziddiyyət təşkil edərsə, mənbə (JSON siyahı) qüvvədədir.
- Yükləyici naməlum sətir növündə dayanır; buna görə ardıcıllıq: əvvəl yeni növləri tanıyan paket versiyası, sonra yeni sətirlər.

## K5 — Oxu yolu: `ChainTrustSource` və indeksləyici

- İndeksləyici və `ChainTrustSource` yeni tətbiqdədir: `apps/chain-indexer/` (təklif olunan ad, **təsdiq gözləyir**). İndeksləyici
  kontrakt hadisələrini oxuyur və qeydləri yaddaşdakı siyahı formasına çevirir; `ChainTrustSource` eyni `TrustSource` interfeysini
  həyata keçirir ([[ADR-0015]] K3): C1/C2/C3-ü sabitlənmiş blokdakı kontrakt oxunuşlarından (`TrustQueries`), qeydləri indeksdən verir.
  İndeks köhnəlibsə və ya zəncir əlçatan deyilsə, cavab `UNKNOWN`-dur (CMP4).
- `@tamga-network/trust/core` yüngül qalır ([[ADR-0015]] K1); zəncir müştərisi asılılığı ora daxil olmur. Üçüncü tərəflər üçün ayrıca
  paket lazım olarsa, təklif olunan ad `@tamga-network/chain`-dir (**təsdiq gözləyir**). Siyahı dərc edənin `trust:chain-check`-i
  yerində qalır.
- [[ADR-0073]] K6 ekvivalentlik testi bu oxu yolundan istifadə edir.

## K6 — `contracts/` ictimai depoya

- Layihə rəhbərliyinin açıqlıq qərarına (2026-11-04) əsasən `contracts/` ictimai depoya keçir.
- **Tətbiq addımı:** `.publicignore`-dan `contracts/` sətri və xarici auditor paketinin kontrakt hissəsi (`docs/audit/contracts.md`,
  `docs/audit/contracts-invariants.md`) çıxarılır; ictimai dərc yoxlaması yenidən işə salınır; `contracts/` daxilində açar, `.env` və
  yerləşdirmə qeydi olmadığı təsdiqlənir; README ingiliscə və qısa olur.

## K7 — Sandbox zəncirə yazılmır (F9)

- Sandbox siyahıları və lövbər jurnalı istehsal zəncirinə lövbərlənmir və yenidən icra edilmir. `trust:chain-submit` və
  `trust:chain-replay` istehsal zəncirində `environment: sandbox` dəstini rədd edir.
- Sandbox yalnız yerli inkişaf zəncirində sınaqdan keçirilə bilər; həmin zəncir sandbox sıfırlanması ilə birlikdə sıfırlanır.

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Yalnız siyahı xülasələri (bugünkü [[ADR-0051]] K2) | rədd | "Hər şey zəncirdə" istiqamətinə ziddir; qeyd səviyyəsində sorğu və ekvivalentlik yoxdur |
| Təfərrüat mətnlərini zəncirə açıq yazmaq | rədd | Şəxsi məlumat və sərbəst mətn sərhədi (DP1, TL11); zəncirdən silinə bilməz |
| Təfərrüatları heç yazmamaq | rədd | Siyahıdakı təfərrüatın dəyişib-dəyişmədiyi zəncirdən yoxlanıla bilməz; xülasə bunu təmin edir |
| Şəbəkə səviyyəli qeydləri mövcud kontraktlara paylamaq | rədd (təklif) | Cüzdan provayderi, ZK sxemi, xarici siyahı və imzalayan heç bir dövlətin deyil, şəbəkənin qeydidir; tək Governance qapısı |
| Görünüşləri ayrıca versiya sayğacı ilə lövbərləmək | rədd | [[ADR-0066]] K1: görünüş eyni dərcin ikinci formasıdır |
| Sandbox-u da zəncirə lövbərləmək | rədd | Gecə sıfırlanması CH4 ilə ziddiyyət təşkil edir; sınaq şəbəkəsi real şəbəkənin etibar qeydinə qarışmır |
| `ChainTrustSource`-u `trust/core`-a qoymaq | rədd | Cüzdan və brauzer nüvəsi zəncir müştərisini daşımır ([[ADR-0015]] K1) |

# Təklif olunan qaydalar (qəbul edilərsə məcburi cədvələ köçürülür)

| Kod | Qayda |
|---|---|
| PJ1 | İmzalanmış siyahılarda etibar qərarına təsir edən hər qeyd zəncirdə bir qeydə və ya lövbərə uyğunlaşdırılır; siyahı mənbə olaraq qalır və ziddiyyət olduqda siyahı qüvvədədir. |
| PJ2 | Zəncirə şəxsi məlumat və sərbəst mətn yazılmır; qeydiyyat təfərrüatları yalnız kanonik JSON xülasəsi və mövcud `metadataURI` ilə təmsil olunur; yeni `string` sahəsi və sərbəst `bytes` əlavə edilmir. |
| PJ3 | Şəbəkə səviyyəli qeydlər (cüzdan provayderi, ZK sxemi, xarici siyahı, sənəd kateqoriyası, siyahı imzalayanı, siyahı operatoru, slot) yalnız Governance təklifi ilə və ya miqrasiya rejimində miqrasiya icraçısı ilə yazılır. |
| PJ4 | Sandbox siyahıları və lövbər jurnalı istehsal zəncirinə yazılmır və yenidən icra edilmir. |
| PJ5 | Siyahı görünüşləri və qeydiyyat sertifikatı status siyahısı lövbər jurnalına sətir kimi daxil olur və zəncirdə mənbənin versiyası ilə lövbərlənir; görünüş mənbə ilə ziddiyyət təşkil edərsə, mənbə qüvvədədir. |

# Açıq suallar (layihə rəhbərliyinə)

1. **Ad:** yeni şəbəkə səviyyəli kontrakt `NetworkRegistry` (təklif), yoxsa qeydlər növünə görə ayrı kontraktlara paylansın?
2. **Ad:** lövbər jurnalı sətir növləri `registration_status` (və ya `wrprc_status`) və `list_view`.
3. **Ad:** `apps/chain-indexer/`; lazım olarsa paket `@tamga-network/chain`.
4. **Açıqlıq:** qərarda `contracts/` adı çəkilir. Besu şəbəkə faylları (`network/`) və zəncir mərhələsi sənədləri də ictimai olsunmu?
5. **Təfərrüat xülasəsinin formatı:** RFC 8785 kanonik JSON + SHA-256 (təklif); sahə bloklarının sərhədləri tətbiqdə cədvəllə sabitlənir.
6. **Sandbox:** gələcəkdə sandbox üçün ayrıca, sıfırlana bilən sınaq zənciri qurulsunmu? Təklif: xeyr, yalnız yerli inkişaf zənciri.

# Nəticələr

- Kontraktlar (qəbuldan sonra, [[ADR-0073]] ilə birlikdə): `IssuerRegistry` və `RelyingPartyRegistry`-də yeni sahələr və keçid
  qrupları, yeni şəbəkə səviyyəli kontrakt, Governance təklif növləri, `privacy-abi` testinin yeni kontraktı əhatə etməsi; [[ADR-0051]]
  K2-nin "mövcud səkkiz kontrakt dəyişmir" cümləsi dəyişmiş olur.
- `@tamga-network/trust`: yeni lövbər sətir növləri, nəzarət nöqtəsinin `state`-i; `apps/trust-publisher`: proyeksiya planı yeni
  qeydləri və mühit yoxlamasını əhatə edir; `apps/chain-indexer/` (ad təsdiqi ilə).
- Sənədlər: [[SPEC-BC-0001]] (§3, §6, yeni bölmə, §13, §15) və [[SPEC-TRUST-0001]] §5 və §7 qəbuldan sonra dəyişir.
- İstehsal mühitində zəncir yenə söndürülmüşdür ([[ADR-0009]] K4, [[ADR-0051]] CH5).

# Status

**Proposed — 2026-11-04.** Layihə rəhbərliyinin 2026-11-04 istiqaməti ("hər şey zəncirdə", "hamısı açıq") əsasında yazıldı; qəbul layihə
rəhbərliyindədir. Yeni adlar (`NetworkRegistry`, `registration_status`, `list_view`, `apps/chain-indexer/`, `@tamga-network/chain`)
təsdiq gözləyir. Qəbul edilərsə DECISIONS-da D-BC kodu alır və PJ1–PJ5 qaydaları məcburi olur.
