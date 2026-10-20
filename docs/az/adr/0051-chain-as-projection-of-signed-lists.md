---
document_id: ADR-0051
title: "Zəncir imzalanmış siyahıların proyeksiyasıdır"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-17
last_updated: 2026-10-19
summary: >
  Zəncir kodu istehsal zənciri qurulmazdan əvvəl yazılır və zəncirsiz dizayna bağlanır: imzalanmış etibar siyahıları (lotl, tl-<cc>) və lövbər jurnalı mənbə olaraq qalır; zəncir onların proyeksiyasıdır. Zəncirə yalnız siyahı versiyasının xülasəsi (versiya, məzmun hash-i, əvvəlki hash, dərc vaxtı) və lövbər jurnalının son sətrinin xülasəsi yazılır — məzmun, qeyd, rəqəmsal sənəd və ya fərdi məlumatlar yazılmır. Lövbər yalnız hədd sayda müstəqil yazıcı eyni məlumatı göndərdikdə təsdiqlənmiş sayılır; istehsal mühitində hədd ən azı 2-dir (ikinci operator qapısı, ADR-0009 K4). Zəncirin cavabı yoxlama üçün heç vaxt tələb olunmur; ziddiyyət olduqda imzalanmış siyahı qüvvədədir. Funksiya bayrağı defolt olaraq söndürülüb. Kontraktlar Hardhat ilə kompilyasiya və test edilir; istehsal zənciri yoxdur. Adlar: kontrakt `TrustListAnchorRegistry`, komandalar `trust:chain-submit` və `trust:chain-check`. Qəbul tarixi: 2026-10-19.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0008]]", "[[ADR-0009]]", "[[ADR-0052]]", "[[ADR-0053]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[PM-TRUST-0001]]", "[[ARCH-0003]]", "[[FW-ARF-0001]]"]
translation_of: ADR-0051
source_version: "1.0.0"
---

# Qısaca

Şəbəkənin etibarı bu gün imzalanmış siyahılara əsaslanır; zəncir yoxdur. Bu qərar zəncir kodunun indi yazılmasını və həmin siyahılara **bağlanmasını**
nəzərdə tutur: zəncir siyahıların xülasələrini saxlayan ikinci bir qeyd olur. Siyahılar nə deyirsə, o qüvvədədir; zəncir yalnız "bu siyahı
versiyası bu anda, bu xülasə ilə dərc edildi" deyə şahidlik edir — və bu şahidlik yalnız bir neçə müstəqil operator eyni şeyi dedikdə
nəzərə alınır.

# Kontekst

- [[ADR-0009]] zənciri **≥2 müstəqil validator operatoru** yazılı razılıq verdikdə qurur (K4); o vaxtadək etibar lövbəri imzalanmış,
  versiyalı, hash zəncirli siyahılar və saatlıq lövbər jurnalıdır (K2). Keçid siyahı arxivinin kontraktlarda yenidən icra edilməsi və
  ekvivalentlik testidir (K7). İkinci operator bu gün yoxdur; namizədlər siyahısı da yoxdur.
- Kontraktlar ([[SPEC-BC-0001]]) 2026-10-17-dək heç vaxt kompilyasiya edilməmişdi. Layihə rəhbərliyi 2026-10-17-də istiqaməti müəyyən etdi: operator qərarı
  təxirə salınır; zəncir kodu **indi** yazılır, kompilyasiya və test edilir və zəncirsiz dizaynla **inteqrasiya** olunur; istehsal mühitində söndürülmüş qalır.
- İnteqrasiyanın forması açıq bir sual idi: (a) siyahıların məzmununu indi kontraktlarda yenidən icra etmək, (b) yalnız siyahıların xülasələrini
  zəncirə yazmaq, (c) heç nə yazmadan yalnız kompilyasiya etmək. (a) Faza 0-ın işidir — dövlət nümayəndə açarları, validatorlar və
  idarəetmə səsverməsi tələb edir ([[ADR-0009]] K7). (c) kodu dizaynla bağlamır. Bu ADR (b)-ni seçir: ən kiçik və ən az riskli
  proyeksiya, gələcəkdə (a) üçün də zəmin.
- "İkili danışıq" zəifliyi ([[ADR-0009]] K3, pilot məhdudiyyətlər bildirişi, 6-cı bənd): tək operator iki yoxlayan tərəfə iki fərqli siyahı
  verə bilər; ictimai jurnal bunu çəkindirir, lakin qeyri-mümkün etmir. Siyahı xülasəsinin bir neçə müstəqil yazıcı tərəfindən eyni
  dəyərlə zəncirə yazılması bu zəifliyi aradan qaldırmağın ilk addımıdır — və yalnız ikinci yazıcı həqiqətən müstəqil olduqda dəyər yaradır.
- Fərdi məlumatlar sərhədi dəyişmir: zəncirə rəqəmsal sənəd, sənəd xülasəsi və ya şəxs yazılmır ([[PM-TRUST-0001]], [[SPEC-BC-0001]]/DP1,
  [[SPEC-TRUST-0001]]/TL11).

# Qərar

## K1 — Proyeksiya prinsipi

Zəncir imzalanmış etibar siyahılarının və lövbər jurnalının **proyeksiyasıdır**; mənbə deyil. Faza 0 qəbuluna (replay + ekvivalentlik,
[[ADR-0009]] K7) qədər:

1. Yoxlama xətti (A–E) və `TrustSource` yalnız imzalanmış siyahılardan oxuyur; zəncir heç bir addımda **tələb olunmur**.
2. Zəncirin cavabı üç dəyərlidir: `YES` (təsdiqlənmiş lövbər siyahının xülasəsi ilə eynidir), `NO` (eyni versiya üçün təsdiqlənmiş **fərqli** xülasə var —
   ikili danışıq əlaməti), `UNKNOWN` (bayraq söndürülüb, zəncir əlçatan deyil və ya lövbər yoxdur). `UNKNOWN` nəticəni heç vaxt pisləşdirmir;
   `NO` yoxlama nəticəsini dəyişmir, operator üçün xəbərdarlıq siqnalı yaradır və şəffaflıq hesabatına daxil olur.
3. Ziddiyyət olduqda imzalanmış siyahı qüvvədədir; zəncir qeydi düzəldilmir, yanına yeni versiya yazılır (silmə yoxdur).

## K2 — Zəncirə nə yazılır

Yeni kontrakt — **siyahı lövbəri reyestri** (`TrustListAnchorRegistry`) — iki növ qeyd
saxlayır; başqa heç nə saxlamır:

| Qeyd | Sahələr | Mənbə |
|---|---|---|
| Siyahı versiyası | `listKey = keccak256("tamga:trust-list:<ortam>:<dosya>")` (məs. `production:lotl`, `production:tl-tr`), `version`, `contentHash = sha256(<dosya>.jws)` (= növbəti versiyanın `previous_version_hash` dəyəri), `previousHash`, `issuedAt` | `lotl.jws`, `tl-<cc>.jws` ([[SPEC-TRUST-0001]] §3–§4) |
| Lövbər jurnalının başı | `logKey = keccak256("tamga:anchors:<ortam>")`, `seq`, `lineHash = sha256(satır JWS)`, `ts` | `anchors.jsonl` son sətri ([[SPEC-TRUST-0001]] §5); sətir zənciri bütün jurnalı bağlayır |

Bütün sahələr `bytes32` və tam ədəddir; kontraktda `string`/`bytes` sahəsi yoxdur. Siyahı məzmunu, qurum/yoxlayan tərəf/sxem qeydləri,
rəqəmsal sənəd, sənəd xülasəsi və ya fərdi məlumatlar **yazılmır** (DP1, TL11). Mövcud səkkiz kontrakt ([[SPEC-BC-0001]] §1–§7, §11) dəyişmir; onlara
yazmaq Faza 0 replay-idir.

## K3 — Kim yazır: hədd əsaslı yazıcılar

- Yazma səlahiyyəti **yazıcı (anchorer)** ünvanlarına məxsusdur; çoxluğu və təsdiq həddini `governance` ünvanı idarə edir (Faza 0-da Governance
  proxy-si; bu gün dev yerləşdirməsində yerləşdirən hesab).
- `(listKey, version)` və ya `(logKey, seq)` lövbəri **hədd sayda fərqli yazıcı** tamamilə eyni məlumatı göndərdikdə **təsdiqlənmiş**
  olur. Təsdiqlənməmiş lövbər `YES` yaratmır. İstehsal mühitində hədd **≥ 2**-dir: tək operator təsdiqlənmiş lövbər yarada bilməz — [[ADR-0009]] K4-ün
  ("ikinci müstəqil operator") kontraktdakı qarşılığı. İnkişaf şəbəkəsində hədd 1-dir.
- ~~Açılmış versiya üçün fərqli xülasə göndərən yazıcı rədd edilir (`AnchorMismatch`).~~ **[[ADR-0053]] ilə dəyişdirildi
  (2026-10-19):** açılmış versiya üçün fərqli xülasə ayrıca namizəd kimi qeydə alınır və ziddiyyət hadisəsi (`AnchorConflict`) yayır;
  həddi ilk dolduran namizəd təsdiqlənir. Versiya hər siyahı üzrə monoton artır; təsdiqlənmiş qeyd dəyişmir (əlavə edilir, silinmir).

## K4 — Nə vaxt yazılır; bayraq

- Siyahı dərcçisi (`apps/trust-publisher`) `chain-submit` komandası ilə (`npm run trust:chain-submit`) öz `dist/` çıxışını oxuyur, əvvəlcə yükləyici ilə yoxlayır
  (imza, hash zənciri, təzəlik — sağlam olmayan dəst lövbərlənmir), sonra yalnız xülasələri göndərir: hər siyahı dərcindən və hər saatlıq
  lövbər sətrindən sonra (heartbeat tezliyi). Zəncirdə eyni versiya eyni xülasə ilə varsa, keçir; təsdiqlənmiş fərqli xülasə varsa, yazmır və
  `CONFLICT` bildirir (K1.3); gözləyən fərqli namizəd varsa, öz xülasəsini rəqib namizəd kimi göndərir və xəbərdarlıq edir (`CONTEST`, [[ADR-0053]]).
- Funksiya bayrağı `TAMGA_CHAIN_ENABLED` defolt olaraq `0`: söndürülmüş olduqda heç bir zəncir bağlantısı qurulmur və heç nə yazılmır.
  `--dry-run` nə yazılacağını çap edir, bağlanmır. Yazıcı açarı və RPC ünvanı mühitdən/.env-dən gəlir; repozitoriyada yer tutucu var.
- İstehsal mühitində bayraq ikinci operator və hədd ≥ 2 **olmadan aktivləşdirilmir**.
- Ad: komanda `chain-submit`-dir ("göndər"), `chain-anchor` deyil. Saatlıq lövbər jurnalı komandası `trust:anchor` ilə qarışdırılmır və
  gördüyü işi düzgün ifadə edir: yazıcının göndərdiyi xülasə bir **səsdir**; lövbər yalnız hədd sayda operator eyni xülasəni göndərdikdə
  təsdiqlənir (K3).

## K5 — Yoxlayan tərəf necə istifadə edir

`chain-check`: əlindəki imzalanmış siyahının (`.jws`) xülasəsini hesablayır, zəncirdəki təsdiqlənmiş lövbərlə müqayisə edir və K1.2-dəki üç dəyərli
cavabı verir. Əlavə təminatdır; məcburi addım deyil və heç vaxt olmayacaq. Yoxlayan tərəf tətbiqinə qoşulması (sağlamlıq
səhifəsində göstərilməsi) bayraq aktivləşdirildikdə ayrıca işdir.

## K6 — Alət zənciri və keçid

- Kontraktlar **Hardhat** (TypeScript testləri) ilə kompilyasiya və test edilir; Foundry çıxarıldı (repozitoriyanın alət dəsti ilə eyni dil; forge
  inkişaf maşınlarında yoxdur). Lokal inkişaf zənciri Hardhat node-udur; Besu/QBFT tək validatorlu inkişaf şəbəkəsi (Docker)
  ayrıca işdir.
- Faza 0-a keçid [[ADR-0009]] K7-dir və bu ADR ilə dəyişmir: siyahı arxivi kontraktlarda yenidən icra edilir, ekvivalentlik testindən keçir; siyahı
  lövbəri reyestri o gündən sonra da işləyir (siyahılar Faza 0-da da dərc edilir — zəncirin proyeksiyası kimi, [[ARCH-0003]] SEV1).

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Heç nə yazmamaq; yalnız kompilyasiya + test | rədd | Kod dizayna bağlanmır; "inteqrasiya olsun" istiqamətinə ziddir |
| Siyahı məzmununu indi kontraktlarda yenidən icra etmək (K2 əvəzinə Faza 0 replay-i) | təxirə salındı | Dövlət nümayəndə açarları, validatorlar və idarəetmə səsverməsi tələb olunur; tək operatorun öz zəncirində yenidən icra etməsi etibar yaratmır (ADR-0009 F1). Replay aləti Faza 0 işi olaraq qalır |
| Lövbər jurnalının hər sətrini ayrıca lövbərləmək | rədd (baş kifayətdir) | Sətirlər hash zənciri ilə bağlıdır; son sətrin xülasəsi bütün jurnalı bağlayır. Saatlıq tezlik eyni qalır |
| İctimai zəncirə (L2) xülasə yazmaq | rədd | D-BC-0 Besu/QBFT dəyişmir ([[ADR-0001]]); suverenlik və fərdi məlumatlar sərhədi xarici zəncirdə yoxlanıla bilmir |
| Tək yazıcı, hədd yoxdur | rədd | Tək operatorun zənciri imzalanmış siyahıdan artıq etibar yaratmır (ADR-0009 F1); hədd ≥ 2 qapını koda köçürür |
| Status List və sxem lövbərlərini də ayrıca yazmaq | rədd (hələlik) | Mövcud `StatusListRegistry`/`SchemaRegistry` bu işi Faza 0-da görür; lövbər jurnalının başı bu gün hamısını bağlayır |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| CH1 | Zəncir imzalanmış siyahıların və lövbər jurnalının proyeksiyasıdır; ziddiyyət olduqda imzalanmış siyahı qüvvədədir; zəncirin cavabı yoxlama üçün tələb olunmur və `UNKNOWN` nəticəni pisləşdirmir. |
| CH2 | Siyahı lövbəri reyestrinə yalnız siyahı versiyasının və lövbər jurnalı sətrinin xülasəsi (hash, versiya/sıra, vaxt) yazılır; siyahı məzmunu, qeyd, rəqəmsal sənəd, sənəd xülasəsi və ya fərdi məlumatlar yazılmır. |
| CH3 | Lövbər yalnız təsdiq həddi sayda fərqli səlahiyyətli yazıcı tamamilə eyni məlumatı göndərdikdə təsdiqlənmiş sayılır; istehsal mühitində hədd ən azı 2-dir. |
| CH4 | Versiya hər siyahı üzrə monoton artır; açılmış versiya üçün fərqli xülasə ayrıca namizəd kimi qeydə alınır və ikili danışıq əlaməti kimi hadisə yayır ([[ADR-0053]]/AC1–AC3); təsdiqlənmiş qeyd silinmir və dəyişdirilmir. |
| CH5 | `TAMGA_CHAIN_ENABLED` söndürülmüş olduqda zəncirə qoşulmur və yazılmır; istehsal mühitində bayraq ikinci müstəqil operator və hədd ≥ 2 olmadan aktivləşdirilmir. |

# Nəticələr

- `contracts/src/anchor/TrustListAnchorRegistry.sol` + testlər; `contracts/` Hardhat layihəsi; dev yerləşdirmə qeydini də qurur.
- `apps/trust-publisher`: `chain-submit` (proyeksiya, bayraq, dry-run) və `chain-check` (yoxlayan tərəf); ABI surəti
  `src/chain/abi/` (kontrakt kompilyasiyasından ixrac olunur, `contracts:check` fərqi aşkarlayır).
- [[SPEC-BC-0001]] §15 və [[SPEC-TRUST-0001]] §7 sətri; [[FW-ARF-0001]] §8.1 status qeydi ("kod hazırdır, istehsalda söndürülüb").
  DECISIONS: **D-BC-7**; buraxılış qeydləri.
- Zəncir açıldıqda hansı hesabın əməliyyat göndərə biləcəyi və hansı qovşağın qoşula biləcəyi: [[ADR-0052]] (Besu lokal
  icazələndirməsi; yazıcı ünvanları hesab icazə siyahısına bu kontraktın vəziyyətindən daxil olur).
- Dəyişməyən qərarlar: D-BC-0 (Besu/QBFT), D-BC-6 (zəncir həddi), D-TRUST-0, D-REV-1/2, D-SCHEMA-1, [[ADR-0009]] K7 keçidi.

# Açıq məsələlər

1. ~~Kontrakt və komanda adları~~ — **bağlandı (2026-10-19):** `TrustListAnchorRegistry`, `trust:chain-submit`, `trust:chain-check`.
2. İstehsal həddinin dəqiq dəyəri (təklif: 2) və ikinci yazıcının kim olacağı — ikinci operator namizədi ilə birlikdə.
3. ~~`Governance`-da ümumi "çağırışı icra et" təklifi~~ — **bağlandı (2026-10-19, [[ADR-0055]]):** yazıcı dəsti/həddi və
   `CrossRecognition.bootstrapFounders` növü müəyyən Governance təklifləri ilə idarə olunur; ümumi çağırış təklifi qurulmadı.
4. Besu/QBFT tək-validatorlu inkişaf şəbəkəsi (Docker) və `ChainTrustSource` + indeksləyici (Faza 0 oxuma yolu).
5. `contracts/` qovluğunun public repozitoriyaya köçürülməsi (bu gün `.publicignore`-dadır).

# Status

**Accepted — 2026-10-19.** Layihə rəhbərliyinin təsdiqi ilə (adlar: kontrakt `TrustListAnchorRegistry`, komandalar `trust:chain-submit` və
`trust:chain-check`). DECISIONS: D-BC-7. Təklif 2026-10-17-də, layihə rəhbərliyinin həmin günkü istiqaməti ("zəncir kodu indi yazılır,
zəncirsiz dizaynla inteqrasiya olunur, istehsalda söndürülüb") əsasında yazıldı. CH1–CH5 məcburidir. 2026-10-19: K3-ün son bəndi və CH4
[[ADR-0053]] ilə dəyişdi (rəqib namizədlər); açıq məsələ 3 [[ADR-0055]] ilə bağlandı.
