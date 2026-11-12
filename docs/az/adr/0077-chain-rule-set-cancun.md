---
document_id: ADR-0077
title: "Zəncir Cancun qayda dəsti ilə qurulur"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Zəncir bu günə qədər Shanghai qayda dəsti ilə layihələndirilmişdi; kontraktlar da həmin hədəflə kompilyasiya olunurdu.
  Shanghai-də `SELFDESTRUCT` kodu silir: `CREATE2` ilə yerləşdirilmiş implementasiya səsvermədən sonra silinib eyni ünvana başqa
  kodla yenidən yerləşdirilə bilərdi (kontrakt auditi 2026-11-11). Qərar: zəncir Cancun qayda dəsti ilə qurulur (genesis
  `cancunTime: 0`), kontraktlar `cancun` hədəfi ilə kompilyasiya olunur, testlər eyni qayda dəstində işləyir. Cancun-da
  `SELFDESTRUCT` kodu silmir (EIP-6780); yeniləmə təklifindəki kod xülasəsi yoxlaması ikinci müdafiə xətti kimi qalır. İşləyən
  zəncir olmadığı üçün keçid (fork) tələb olunmur.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0009]]", "[[ADR-0052]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]", "[[ARCH-0002]]"]
translation_of: ADR-0077
source_version: 1.0.0
---

# Qısaca

Blokçeyn hansı qaydaların qüvvədə olduğunu "qayda dəsti" (hard fork) adı ilə müəyyən edir. Tamga zənciri Shanghai qayda dəsti ilə
layihələndirilmişdi. Həmin qayda dəstində kontrakt özünü silə bilir və eyni ünvana başqa kod qoyula bilir; bu, səsə qoyulmuş
yeniləmənin arxasınca kodun dəyişdirilməsinə yol açırdı. Növbəti qayda dəsti olan Cancun bu yolu bağlayır. Zəncir hələ işləmədiyi
üçün qayda dəsti bu gün heç bir xərc olmadan seçilir: zəncir Cancun ilə qurulur.

# Kontekst

- Kontrakt auditi (2026-11-11): yeniləmə təklifi bir **ünvanı** səsə qoyurdu. Shanghai-də `SELFDESTRUCT` hesabın kodunu silir;
  `CREATE2` ilə yerləşdirilmiş implementasiya 7 günlük gözləmə müddətində ([[ADR-0055]] GE1) özünü silib eyni ünvana başqa kodla
  yenidən yerləşdirilə bilərdi. Düzəliş həmin gün edildi: təklif yeni implementasiyanın kod xülasəsini sabitləyir, icra onu
  müqayisə edir (`UpgradeImplementationChanged`, [[SPEC-BC-0001]] §9).
- Eyni sinfi kökündən bağlamağın yolu qayda dəstidir: Cancun-dakı EIP-6780 ilə `SELFDESTRUCT`, kontrakt eyni əməliyyatda
  yaradılmayıbsa, kodu və yaddaşı silmir; yalnız balansı köçürür. Bu sual açıq məsələ kimi qeydə alınmışdı ([[SPEC-BC-0001]] §14
  bənd 10).
- İşləyən zəncir yoxdur ([[ADR-0009]] K4); genesis və kontraktlar sərbəst dəyişə bilər. Qayda dəstini zəncir qurulduqdan sonra
  dəyişmək bütün validator operatorlarının razılaşdırılmış fork-unu tələb edərdi.
- Kompilyasiya hədəfi zəncirin qayda dəstini aşa bilməz: `cancun` hədəfi ilə kompilyasiya olunmuş kod Cancun əməliyyat kodlarından
  (`MCOPY`, müvəqqəti yaddaş) istifadə edə bilər və Shanghai zəncirində işləmir. İkisi birlikdə dəyişir.

# Qərar

- **K1 — Qayda dəsti.** Zəncir Cancun qayda dəsti ilə qurulur: genesis `config` daxilində `shanghaiTime: 0` və `cancunTime: 0`
  (ilk blokdan aktiv). Yerli inkişaf zənciri, test şəbəkəsi və real şəbəkə eyni qayda dəstindən istifadə edir.
- **K2 — Kompilyasiya və test.** Kontraktlar `evmVersion: cancun` ilə kompilyasiya olunur (solc 0.8.24). Kontrakt testlərinin
  işlədiyi proses daxili şəbəkə də `cancun` qayda dəstindədir; alətin standart dəyəri daha yeni qayda dəsti olsa belə, testlər
  zəncirlə eyni qaydalarda işləyir.
- **K3 — Blob əməliyyatlarından istifadə olunmur.** Cancun-un gətirdiyi blob əməliyyatları (EIP-4844) ikinci qat üçün məlumat
  yoludur; şəbəkədə istifadəsi yoxdur. Şəbəkə blob əməliyyatı göndərmir, kontraktlar blob-a söykənmir. Qovşaq proqram təminatı
  blob sahələrini blok başlığında daşıyır (sıfır dəyərlə); əlavə konfiqurasiya tələb olunmur.
- **K4 — Kod xülasəsi yoxlaması qalır.** Yeniləmə təklifindəki kod xülasəsi yoxlaması ləğv edilmir: qayda dəsti gələcəkdə
  dəyişərsə və ya kod başqa yolla dəyişərsə, eyni təminatı verir. "Səsə qoyulan koddur" qaydası qayda dəstindən asılı deyil.
- **K5 — Sonrakı qayda dəstləri.** Cancun-dan sonrakı qayda dəstinə keçid (genesis-də və ya işləyən zəncirdə) ayrıca qərar
  qeydi tələb edir; qovşaq proqram təminatının standart dəyəri izlənmir.

# Qiymətləndirilən seçimlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Shanghai-də qalmaq, yalnız kod xülasəsi yoxlaması | rədd | Yoxlama yeniləmə yolunu bağlayır, lakin eyni sinif (özünü silən və yenidən yerləşdirilən kod) başqa kontekstdə yenidən ortaya çıxa bilər; qayda dəsti bunu kökündən bağlayır və bu gün xərci yoxdur |
| **Cancun** | **qəbul** | EIP-6780 metamorfik yenidən yerləşdirməni bağlayır; qovşaq proqram təminatı və kompilyator illərdir dəstəkləyir; yerli tək validatorlu QBFT şəbəkəsində sınandı |
| Daha yeni qayda dəsti (Prague və sonrası) | hələlik rədd | Hesab kodunun ötürülməsi (EIP-7702) kimi yeni səthlər gətirir; suverenlik yoxlaması ünvana əsaslanır, təsiri ayrıca araşdırılmadan açılmır (K5) |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| CR1 | Zəncirin qayda dəsti genesis-də açıq yazılır və ilk blokdan Cancun-dur (`shanghaiTime: 0`, `cancunTime: 0`); yerli inkişaf zənciri, test şəbəkəsi və real şəbəkə eyni qayda dəstindən istifadə edir. Başqa qayda dəstinə keçid yeni qərar qeydi tələb edir. |
| CR2 | Kontraktların kompilyasiya hədəfi və kontrakt testlərinin işlədiyi şəbəkənin qayda dəsti zəncirin qayda dəsti ilə eynidir (`cancun`). |
| CR3 | Yeniləmə təklifi yeni implementasiyanın kod xülasəsini sabitləyir və icrada müqayisə edir; bu yoxlama qayda dəstindən asılı olmayaraq qalır. |

# Nəticələr

- Kod: `contracts/hardhat.config.ts` (`evmVersion: cancun`, proses daxili şəbəkə `hardfork: cancun`),
  `contracts/scripts/export-abi.mjs`, `contracts/slither.config.json`; genesis yaradan skriptlər `scripts/besu-dev.ps1` (tək
  validatorlu və icazəli rejim) və `network/testnet/make-network.sh`. Əvvəl yaradılmış yerli genesis faylları Shanghai-dir: yerli
  zəncir yenidən qurulur (genesis silinir, yenidən yaradılır, zəncir məlumatı sıfırlanır).
- Testlər: kod xülasəsi yoxlaması Cancun-da test qovşağının kod dəyişdirmə imkanı ilə sınanır; ayrı test özünü "silən"
  implementasiyanın kodunun yerində qaldığını və eyni ünvana yenidən yerləşdirmənin uğursuz olduğunu göstərir
  (`contracts/test/review-2026-11-11-governance.test.ts`).
- Yaddaş düzümü dəyişmədi; icra kodunun ölçüləri bir neçə bayt dəyişdi, EIP-170 ehtiyatı qorunur (`contracts:check`).
- Yoxlama: yerli tək validatorlu QBFT şəbəkəsi (Besu 26.11.0) `cancunTime: 0` ilə quruldu, blok istehsal etdi, kontraktlar
  yerləşdirildi; Cancun əməliyyat kodları (`MCOPY`, `TSTORE`/`TLOAD`, `BLOBBASEFEE`) işlədi, blok başlığı blob sahələrini sıfır
  dəyərlə daşıdı. KZG quraşdırması üçün əlavə seçim tələb olunmadı. Çox qovşaqlı şəbəkə CI test şəbəkəsi iş axınında
  (`testnet.yml`) yoxlanılır.
- **Tətbiq qeydi (2026-11-12, ikinci yoxlama; qərarın məzmunu dəyişməyib):** CR2-nin test tərəfi bu düzəlişlə gerçəkləşdi —
  test alətində proses daxili şəbəkənin adı `default`-dur; konfiqurasiya heç istifadə olunmayan `hardhat` adlı şəbəkəni Cancun-a
  bağlamışdı və testlər daha yeni qayda dəsti ilə işləyirdi. `default` və `node` şəbəkələri Cancun-a bağlandı; bir test
  işlədilən qayda dəstini yoxlayır.
- Sənədlər: [[SPEC-BC-0001]] §9 və §14 bənd 10 (bağlandı), [[ARCH-0002]], [[GUIDE-0018]].

# Status

**Accepted — 2026-11-12.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-12). DECISIONS: D-NET-7. CR1–CR3 məcburidir.
