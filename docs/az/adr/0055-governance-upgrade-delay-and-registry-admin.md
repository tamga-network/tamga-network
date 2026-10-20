---
document_id: ADR-0055
title: "İdarəetmə: yeniləmə gözləmə müddəti və qeydiyyat idarəetməsi təklifləri"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Governance kontraktında iki boşluq aradan qaldırılır. (1) Protokol yeniləməsi 2/3 səslə qəbul edildikdə dərhal tətbiq olunmur: əvvəlcə növbəyə alınır, 7 gün gözləyir, sonra hədd yenidən hesablanaraq tətbiq olunur. Razı olmayan dövlət bu müddətdə birtərəfli qaydada çıxa bilər. Yeniləmə istəyə görə yeni versiyanın parametrsiz başlanğıc funksiyasını eyni əməliyyatda çağırır (yalnız 4 baytlıq funksiya selektoru; sərbəst məlumat yoxdur). (2) Governance-ın idarə etdiyi, lakin indiyədək çağıra bilmədiyi reyestr idarəetmə əməliyyatları (siyahı lövbəri yazıcısı və həddi, təsisçilər arasında tanınma, şəbəkə sxeminin istifadədən çıxarılması və ləğvi) növü müəyyən təkliflərlə 2/3 səslə həyata keçirilə bilər. Ümumi "istənilən çağırışı icra et" təklifi yaradılmır. ADR-0051-in açıq məsələ 3-ü bağlanır. Qəbul: 2026-10-19.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[SPEC-BC-0001]]"]
translation_of: ADR-0055
source_version: "1.0.0"
---

# Qısaca

Şəbəkənin qaydalarını dəyişən ən güclü əməliyyat kontraktın yenilənməsidir. Bu qərar yeniləməyə bir həftəlik gözləmə qoyur: səsvermə keçir, növbəyə
daxil olur, hamı nə baş verəcəyini görür; razı olmayan dövlət istəsə, həmin müddətdə şəbəkədən çıxır. Bundan əlavə, Governance-ın səlahiyyətində olmalı, lakin
çağıra bilmədiyi bir neçə idarəetmə əməliyyatı səsverməyə çıxarıla bilən hala gəlir.

# Kontekst

- [[SPEC-BC-0001]] §1 və §9: protokol yeniləməsi 2/3 səslə həyata keçirilir; səlahiyyət Governance-dadır (UUPS). 2026-10-19 təhlükəsizlik yoxlaması (F-14)
  iki çatışmazlıq aşkar etdi: hədd dolan kimi yeniləmə eyni əməliyyatda tətbiq oluna bilər (gözləmə müddəti yoxdur), və yeniləmə boş başlanğıc
  məlumatı ilə çağırıldığı üçün başlanğıc funksiyası (`reinitializer`) olan yeni versiya eyni əməliyyatda aktivləşdirilə bilməz; ayrıca
  çağırış lazımdır və həmin çağırışı ondan əvvəl başqası edə bilər.
- [[ADR-0002]] #5: hər dövlət səsverməyə ehtiyac olmadan birtərəfli qaydada çıxa bilər. Gözləmə müddəti olmadıqda bu hüquq yeniləmə qarşısında praktikada
  işləmir: dəyişiklik səsvermə keçdiyi anda qüvvəyə minir.
- [[ADR-0051]] açıq məsələ 3 və təhlükəsizlik yoxlaması F-15: siyahı lövbəri yazıcılarının və həddin idarə edilməsi (`setAnchorer`,
  `setRequiredConfirmations`), təsisçilər arasında tanınma (`CrossRecognition.bootstrapFounders`) və şəbəkə sxeminin istifadədən çıxarılması
  və ya ləğvi (`SchemaRegistry.deprecateSchema` / `revokeSchema`, NETWORK qatı) yalnız `governance` ünvanından çağırıla bilər. Bu
  ünvan Governance proxy-si olduqda Governance-ın bunları çağırmaq üçün heç bir yolu yoxdur.
- Zəncirdə sərbəst `bytes` sahəsi yoxdur ([[SPEC-BC-0001]]/DP1; ABI testi): ümumi "çağırış məlumatı" təklifi bu qaydanı pozur.
- Layihə rəhbərliyi 2026-10-19-da təhlükəsizlik yoxlamasının tövsiyələrini təsdiqlədi; yeniləmə üçün adət olunmuş təhlükəsiz seçim (təklif üçün gözləmə müddəti)
  tələb olundu.

# Qərar

## K1 — Yeniləmə növbəsi və gözləmə müddəti

- `PROTOCOL_UPGRADE` təklifinin həddi dolduqda ilk `execute` çağırışı təklifi **növbəyə alır** (`ProposalQueued(id, eta)`), tətbiq etmir.
- Tətbiq ən tez `eta = kuyruk anı + 7 gün` (`UPGRADE_DELAY`) baş verir, ən gec isə `eta + 30 gün` olur; bundan sonra təklifin müddəti bitmiş
  sayılır. Tətbiq anında hədd hazırkı ACTIVE üzvlərdən **yenidən** hesablanır ([[SPEC-BC-0001]] GV3); gözləmə zamanı çıxan
  üzvlərin səsi nəzərə alınmır.
- Növbədəki təklif səsvermə müddəti (`PROPOSAL_TTL`) bitsə belə, gözləməni başa vurub tətbiq oluna bilər.
- Üzvlük (qəbul, çıxarılma), şəbəkə sxeminin qeydiyyatı və K3-dəki idarəetmə təklifləri gözləmə müddətinə tabe deyil (hazırkı davranış).

## K2 — Yeniləmə ilə başlanğıc çağırışı

`proposeProtocolUpgradeAndInit(target, newImplementation, initSelector)`: yeniləmə `upgradeToAndCall` ilə yeni versiyanın
**parametrsiz** başlanğıc funksiyasını eyni əməliyyatda çağırır. Təklif yalnız 4 baytlıq funksiya selektorunu daşıyır; başlanğıc
dəyərləri yeni versiyanın kodundadır və səsverməyə qoyulan da həmin koddur. Sərbəst məlumat sahəsi yoxdur (DP1). `proposeProtocolUpgrade` başlanğıc
çağırışı olmayan yeniləmə kimi qalır.

## K3 — Növü müəyyən reyestr idarəetmə təklifləri

Yeni təklif növü `REGISTRY_ADMIN`; hər əməliyyat üçün ayrıca, növü müəyyən təklif funksiyası var. Hamısı 2/3 səslə icra olunur:

| Təklif | İcra zamanı çağırılan |
|---|---|
| `proposeAnchorerChange(registry, anchorer, allowed)` | `TrustListAnchorRegistry.setAnchorer` |
| `proposeAnchorThreshold(registry, required)` | `TrustListAnchorRegistry.setRequiredConfirmations` |
| `proposeFounderRecognition(registry, founders)` | `CrossRecognition.bootstrapFounders` |
| `proposeNetworkSchemaDeprecation(schemaId, supersededBy)` | `SchemaRegistry.deprecateSchema` (əlaqəli sxem qeydi) |
| `proposeNetworkSchemaRevocation(schemaId, reason)` | `SchemaRegistry.revokeSchema` (əlaqəli sxem qeydi) |

Hədəf ünvan sıfır, Governance-ın özü və ya kodu olmayan ünvan ola bilməz. Ümumi "çağırışı icra et" təklifi yaradılmır.

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Gözləmə müddəti yoxdur (hazırkı vəziyyət) | rədd | Çıxma hüququ yeniləmə qarşısında işləmir; səhv yeniləməni aşkar etməyə vaxt yoxdur |
| Ayrıca timelock kontraktı (OpenZeppelin TimelockController) | rədd | Yeni səlahiyyət sahibi və yeni kontrakt; eyni nəticəni Governance daxilindəki növbə verir |
| Gözləmə müddətini bütün təkliflərə tətbiq etmək | rədd | Üzvlük və şəbəkə sxemi qərarları ADR-0002-də gözləməsizdir; bunu dəyişmək ayrıca qərardır |
| 2 gün / 14 gün gözləmə | rədd | 2 gün dövlət qurumları üçün reaksiya müddəti deyil; 14 gün təcili düzəlişi lüzumsuz uzadır. 7 gün geniş yayılmış təcrübədir |
| Yeniləmədə sərbəst başlanğıc məlumatı (`bytes`) | rədd | Zəncirdə sərbəst məlumat sahəsi açır (DP1); parametrsiz başlanğıc funksiyası eyni işi görür |
| Ümumi "çağırışı icra et" təklifi (hədəf + `bytes`) | rədd | DP1-i pozur və nəyin səsverməyə qoyulduğunu oxumağı çətinləşdirir; lazım olan əməliyyatlar məhdud və müəyyəndir |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| GE1 | Protokol yeniləməsi hədd dolduqda növbəyə alınır və ən tez 7 gün sonra, hədd həmin andakı ACTIVE üzvlərdən yenidən hesablanaraq tətbiq olunur. |
| GE2 | Yeniləmə ilə edilən başlanğıc çağırışı yalnız parametrsiz funksiya selektorudur; Governance təklifləri sərbəst məlumat (`bytes`) daşımır. |
| GE3 | Governance-ın reyestr idarəetmə əməliyyatları yalnız növü müəyyən təkliflərlə və 2/3 səslə həyata keçirilir; ümumi çağırış təklifi yoxdur. |

# Nəticələr

- `contracts/src/governance/Governance.sol` və `IGovernance.sol`: növbə, `UPGRADE_DELAY`, `proposeProtocolUpgradeAndInit`,
  `REGISTRY_ADMIN` təklifləri, `ProposalQueued` hadisəsi; yaddaş düzümü yalnız sona əlavə etməklə. `ProposalKind`-a dəyər yalnız sona əlavə olunur.
- [[SPEC-BC-0001]] §1 və §9 versiya qeydi; [[ADR-0051]] açıq məsələ 3 bağlandı.
- DECISIONS: **D-BC-10**.

# Status

**Accepted — 2026-10-19.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-BC-10. GE1–GE3 məcburidir; [[ADR-0002]]-nin səsvermə hədləri
dəyişmir.
