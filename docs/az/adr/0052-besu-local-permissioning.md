---
document_id: ADR-0052
title: "Besu yerli icazələndirməsi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Hyperledger Besu 25.6.0 zəncirüstü icazələndirməni və Tessera əsaslı məxfiliyi çıxardı (24.12-də köhnəlmiş elan edilmişdi). Zəncir işə salındıqda hansı qovşağın qoşula biləcəyi və hansı hesabın əməliyyat göndərə biləcəyi hər validator və RPC qovşağındakı yerli `permissions_config.toml` faylı ilə (qovşaq və hesab icazə siyahısı) müəyyən edilir. Siyahı əl ilə yazılmır: zəncirdəki kontraktların vəziyyətindən (Governance, IssuerRegistry, TrustListAnchorRegistry) törədilir; hər operator faylı özü yaradır və tətbiq edir, bütün validator-lar eyni siyahını daşıyır, fərq yoxlanılır (`trust:chain-permissions`). Yazma səlahiyyətinin əsas nəzarəti kontraktlarda qalır (namespace, deleqat, yazıcı həddi). Qovşağın JSON-RPC ucu internetə açılmır; xarici giriş mTLS-li əks proksi arxasından həyata keçirilir. SPEC-BC-0001 §12.1, ARCH-0001 və ARCH-0002-dəki zəncirüstü icazə kontraktı fərziyyəsini əvəz edir; heç bir ADR qərarı dəyişmir. Qəbul: 2026-10-19.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[ARCH-0001]]", "[[ARCH-0002]]", "[[PM-BC-0001]]", "[[PM-TRUST-0001]]"]
translation_of: ADR-0052
source_version: "1.0.0"
---

# Qısaca

Zəncir icazəli şəbəkədir: yalnız təsdiqlənmiş qovşaqlar qoşulur, yalnız təsdiqlənmiş hesablar əməliyyat göndərir. Sənədlərimiz bunu Besu-nun
zəncirüstü icazə kontraktı ilə etməyi nəzərdə tuturdu; Besu bu funksiyanı 25.6.0-da çıxardı. Bu qərar bunun əvəzinə Besu-nun qalan yolunu
seçir: hər qovşaqda eyni icazə faylı. Faylı heç kim əl ilə yazmır; o, zəncirin öz qeydindən yaradılır, beləliklə "kim icazəlidir" sualının
yeganə cavabı yenə də zəncirdəki idarəetmədir.

# Kontekst

- [[ADR-0001]] şəbəkəni **icazəli**, müstəqil Besu/QBFT şəbəkəsi kimi qurur; icazə mexanizmini seçmir. Mexanizm yalnız spesifikasiya və
  arxitektura sənədlərində yazılmışdı: [[SPEC-BC-0001]] §12.1 ("Hesab icazəsi — Besu onchain permissioning — yalnız qeydiyyatlı delegate
  açarları əməliyyat göndərə bilər"), [[ARCH-0001]] §6 ("Node/hesab permissioning (allowlist kontraktı)"), [[ARCH-0002]] §6
  ("on-chain permissioning kontraktına üstünlük verilir"), təhlükəsizlik qeydi ("permissioning kontraktının idarəetmə açarı çoximzalıdır") və
  açıq məsələ 3 ("təklif: on-chain, idarə edilə bilən"). Bunu təsbit edən ADR yoxdur.
- Besu 24.12-də zəncirüstü icazələndirməni və Tessera əsaslı məxfiliyi köhnəlmiş elan etdi; **25.6.0-da hər ikisi çıxarıldı**
  (buraxılış qeydi, "Sunset features"). Qalan mexanizm **yerli icazələndirmə**dir: hər qovşağın məlumat qovluğunda `permissions_config.toml`,
  onun içində `nodes-allowlist` (enode ünvanları) və `accounts-allowlist` (hesab ünvanları); başlatma bayraqları
  `--permissions-nodes-config-file-enabled` və `--permissions-accounts-config-file-enabled`; iş zamanı `perm_*` JSON-RPC
  metodları ilə və ya fayl redaktə edilib `perm_reloadPermissionsFromFile` ilə yenilənir.
- Besu sənədlərinə görə yerli hesab qaydaları **başqa qovşaqların yaratdığı bloklarda tətbiq olunmur**, siyahıların bütün qovşaqlarda eyni
  olması isə tövsiyə edilir, lakin məcburi deyil. Bir validator-un siyahısı fərqlidirsə, onun yaratdığı blok digərlərinin rədd edəcəyi hesabdan əməliyyat
  daşıya bilər. Yəni ardıcıllığı təmin etmək operatorların işidir.
- Zəncir bu gün mövcud deyil ([[ADR-0009]] K4); zəncir imzalı siyahıların proyeksiyasıdır ([[ADR-0051]]). Qərar Faza 0 hazırlığından əvvəl
  sənədlərin real Besu-ya uyğun olması üçündür. Məxfilik qrupları (Tessera) dizaynda heç vaxt istifadə edilməyib və lazım deyil: zəncirə fərdi
  məlumatlar, rəqəmsal sənəd və ya rəqəmsal sənədin heşi daxil olmur ([[PM-TRUST-0001]], [[SPEC-BC-0001]]/DP1).
- Layihə rəhbərliyi 2026-10-19 tarixində istiqaməti müəyyən etdi: tapıntı bütün sənədlərə əks etdirilir, köhnə fərziyyə qüvvədə olan sənədlərdən çıxarılır.

# Qərar

## K1 — Yerli icazələndirmə

Hər validator və hər RPC/full qovşaq qovşaq və hesab icazələndirməsini yerli `permissions_config.toml` ilə aktivləşdirir (hər iki bayraq
aktivdir). Zəncirüstü icazə kontraktı yazılmır və istifadə edilmir. Tessera və məxfilik qrupları istifadə edilmir (Besu-da yoxdur; dizaynda ehtiyac
yoxdur).

## K2 — Yeganə həqiqət mənbəyi: zəncirin öz vəziyyəti

İcazə siyahıları əl ilə yazılmır; zəncirdəki kontraktların vəziyyətindən törədilir:

| Siyahı | Məzmun | Mənbə |
|---|---|---|
| Hesab | Aktiv üzv dövlətlərin validator ünvanları | `Governance` (qəbul, çıxarılma, geri çəkilmə) |
| Hesab | Aktiv üzv dövlətlərin deleqat açarları | `Governance.delegateKeysOf` |
| Hesab | Fəaliyyətdə olan qurumların deleqat açarları (ləğv siyahısı lövbərinin dərci) | `IssuerRegistry` |
| Hesab | Siyahı lövbəri yazıcıları | `TrustListAnchorRegistry` ([[ADR-0051]] K3) |
| Qovşaq | Validator qovşaqları: enode identifikatorundan törəyən ünvan `Governance` kontraktında aktiv validator ünvanıdır | `Governance` + operatorun qovşaq bildirişi (yalnız `host:port`) |
| Qovşaq | Operatorun öz RPC/full qovşaqları | Yalnız həmin operatorun qovşaqlarının faylında; digər operatorların siyahısına düşmür |

- Hesabın əlavə edilməsi və ya çıxarılması zəncirdəki müvafiq əməliyyatdır (Governance səsverməsi, dövlətin öz namespace-i, yazıcılar çoxluğu);
  icazə faylı onu izləyir. Governance-da aktiv olmayan validator və ya heç bir kontraktda səlahiyyəti olmayan hesab siyahıya düşmür.
- Validator qovşaqlarının şəbəkə ünvanı (`host:port`) zəncirə yazılmır (infrastruktur məlumatıdır; kontrakt ABI-sində sərbəst mətn yoxdur). Operator
  bildirişi şəbəkə konfiqurasiyasında (`network/permissions/`) saxlanılır; alət hər enode-un Governance-dakı validator ünvanına uyğun
  gəldiyini yoxlayır, uyğun gəlməyəni rədd edir. Yanlış ünvan yalnız bağlantını pozur, səlahiyyət vermir.
- Başlanğıc: genesis-dəki təsisçi validator-lar (`extraData`) və yerləşdirmə hesabı ilk faylı yaradır; kontraktlar qurulub
  Governance işə salındıqdan sonra fayl zəncirdən yenidən yaradılır və yerləşdirmə hesabı siyahıdan çıxarılır.

## K3 — Alət və ardıcıllıq yoxlaması

- `trust:chain-permissions` (siyahı dərcedicisində, zəncir əmrlərinin yanında): `render` zəncir vəziyyətini oxuyur, deterministik
  (sıralanmış, təkrarsız) `permissions_config.toml` yaradır və faylın sha256 heşini çap edir; `check` qovşağın qüvvədə olan
  siyahılarını (`perm_getNodesAllowlist`, `perm_getAccountsAllowlist`; qovşağın yerli idarəetmə ucundan) yaradılmış fayl ilə müqayisə edir
  və fərqi hesabatda bildirir.
- Hər operator faylı **özü** yaradır və öz qovşaqlarına tətbiq edir; başqasının faylını köçürmür. Operatorlar heşləri
  müqayisə edir; validator-lar arasında fərq istismar insidentidir və aradan qaldırılana qədər hesabatlarda bildirilir.
- Kontraktlarda bu gün bu çoxluqları sadalayan oxuma görünüşləri yoxdur (üzv siyahısı, yazıcı siyahısı, qurum deleqatları siyahısı); onlar alətlə birlikdə
  əlavə edilir ([[SPEC-BC-0001]] buraxılış qeydi ilə). Alət Faza 0 hazırlığı işidir; Besu inkişaf şəbəkəsi və indeksləyici ilə ([[ADR-0051]] açıq
  məsələ 4) birlikdə yazılır.

## K4 — Səlahiyyət kontraktlarda qalır

Yazma səlahiyyətinin əsas nəzarəti kontraktlardadır: namespace (`onlyOwnerState`, [[SPEC-BC-0001]]/N1), dövlət və qurum deleqatları
(R1, R2), Governance-da 2/3 səsvermə, siyahı lövbəri yazıcı həddi ([[ADR-0051]]/CH3). İcazə siyahısı ikinci müdafiə xəttidir (naməlum
hesab, spam, resurs istehlakı; qaz ödənişsizdir, GA1). İcazə siyahısındakı xəta kontrakt səlahiyyətini genişləndirmir.

## K5 — RPC xaricə açılmır

- Qovşağın JSON-RPC və WebSocket ucları (8545/8546) yalnız qovşağın daxili şəbəkəsində dinləyir. Xarici giriş nginx (və ya ekvivalenti) əks proksi
  arxasından, **qarşılıqlı TLS (mTLS)** ilə və yalnız müəyyən edilmiş müştərilər üçün (siyahı dərcedicisi, indeksləyici, yoxlayan tərəfin oxuma yolu)
  açılır; xaricə yalnız oxuma və əməliyyat göndərmə ad sahələri (`ETH`, `NET`, `WEB3`) verilir.
- `PERM`, `ADMIN`, `QBFT`, `DEBUG`, `TXPOOL` ad sahələri yalnız qovşağın özündən (localhost) istifadə olunur.
- P2P portu (30303) təhlükəsizlik divarında (firewall) yalnız icazə siyahısındakı həmyaşıd qovşaqlar üçün açıqdır; qovşaq icazə siyahısı ikinci qatdır.

## K6 — Əvəz etdikləri

[[SPEC-BC-0001]] §12.1 "Besu onchain permissioning" sətri; [[ARCH-0001]] §6 "allowlist kontraktı"; [[ARCH-0002]] §6 "on-chain
permissioning kontraktına üstünlük verilir", təhlükəsizlik qeydindəki "permissioning kontraktının idarəetmə açarı" və açıq məsələ 3. Bu ifadələr
qüvvədə olan sənədlərdən çıxarılır. Heç bir ADR qərarı dəyişmir: [[ADR-0001]]-in icazəli şəbəkə qərarı olduğu kimi qüvvədədir, dəyişən yalnız
mexanizmdir.

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Besu-nu 25.6-dan əvvəlki versiyada sabitləmək | rədd | Çıxarılmış funksiyaya bağlı qalmaq təhlükəsizlik yeniləmələrini dayandırır |
| Öz icazə qaydalarımızı Besu plagini (plugin) ilə yazmaq | rədd (hələlik) | Ayrıca Java kod bazası, audit və versiya yükü; səlahiyyət onsuz da kontraktlardadır. Dövlətlərin sayı artarsa, yenidən baxılacaq |
| Repozitoriyada əl ilə saxlanılan ümumi icazə faylı | rədd | İkinci həqiqət mənbəyi; Governance ilə uyğunsuzluq yarana bilər |
| Operatorların imzaladığı ayrıca operator siyahısı | rədd | Təsdiqlənmiş çoxluq onsuz da Governance-dadır; eyni məlumatı ikinci yerdə saxlamaq uyğunsuzluq riski yaradır |
| Hesab icazəsi yoxdur, yalnız kontrakt səlahiyyəti | rədd | Qaz ödənişsiz olduqda hər kəs əməliyyat göndərə bilər; spam və resurs istehlakı |
| Tessera məxfilik qrupları | rədd | Besu-dan çıxarılıb; zəncirdə fərdi məlumatlar yoxdur (DP1) |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| LP1 | Zəncir qovşaqlarında icazələndirmə yerlidir (`permissions_config.toml`, qovşaq və hesab icazə siyahısı aktivdir); zəncirüstü icazə kontraktı və Tessera məxfilik qrupları istifadə edilmir. |
| LP2 | İcazə siyahıları zəncirdəki kontraktların vəziyyətindən törədilir; Governance-da aktiv olmayan validator və ya heç bir kontraktda səlahiyyəti olmayan hesab siyahıya düşmür; əl ilə əlavə etmə yoxdur. |
| LP3 | Bütün validator-lar eyni hesab siyahısını və eyni validator qovşaq siyahısını daşıyır; fərq istismar insidentidir və aradan qaldırılana qədər hesabatlarda bildirilir. |
| LP4 | Yazma səlahiyyəti kontraktlarda yoxlanılır; icazə siyahısı bu səlahiyyəti genişləndirmir və onu əvəz etmir. |
| LP5 | Qovşağın JSON-RPC ucu internetə açılmır; xarici giriş yalnız mTLS-li əks proksi arxasından və oxuma/əməliyyat ad sahələri ilə; `PERM`, `ADMIN`, `QBFT` yalnız yerli olaraq. |

# Nəticələr

- [[SPEC-BC-0001]] §12.1 və §15 buraxılış qeydi; [[ARCH-0001]] §6; [[ARCH-0002]] §6, təhlükəsizlik qeydləri, açıq məsələ 3 bağlandı; `network/README.md`
  planlaşdırılan struktur (`permissions/`).
- Faza 0 hazırlığı işləri: `trust:chain-permissions` (render + check), kontraktlara çoxluq oxuma görünüşləri, əks proksi + mTLS konfiqurasiyası,
  Besu inkişaf şəbəkəsində yerli icazələndirmənin sınaqdan keçirilməsi.
- Dəyişməyən qərarlar: D-BC-0 (Besu/QBFT), D-BC-6 (zəncir həddi), D-BC-7 (zəncir proyeksiyası), D-TRUST-0, D-GOV-0.

# Status

**Qəbul edilib — 2026-10-19.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-NET-6. Əvəz etdiyi: [[SPEC-BC-0001]] §12.1, [[ARCH-0001]] §6,
[[ARCH-0002]] §6 və açıq məsələ 3 (zəncir üzərində icazə kontraktı fərziyyəsi); heç bir ADR-i əvəz etmir.
