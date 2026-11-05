---
document_id: GUIDE-0018
title: "Zəncir test şəbəkəsinin qurulması: Hyperledger Besu addım-addım"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Zəncirsiz canlı sistem işləyərkən zəncir qatını sınamaq istəyənlər üçün sıfırdan, addım-addım quraşdırma bələdçisi: terminlər
  (qovşaq, validator, QBFT və 3f+1, genesis, chainId, enode, statik həmyaşıdlar, icazəli şəbəkə, RPC və P2P, Governance, lövbər,
  təkrar oynatma, ekvivalentlik), üç yol (Windows-da bir kompüter, bir Linux maşınında 4 validator, systemd ilə real server
  düzəni), ölçülmüş tələblər, şəbəkə fayllarının və besu.toml sahələrinin mənası, kontraktların yerləşdirilməsi, icazə
  siyahısının zəncirdən hazırlanması, siyahıların zəncirə lövbərlənməsi, tarixçənin köçürülməsi və ekvivalentlik testi, validator
  əlavə etmə və çıxarma səsləri, nasazlıq sınağı, RPC qorunması, monitorinq, sıfırlama, problemlərin həlli və GitHub-dakı
  avtomatik sınaq.
translation_of: GUIDE-0018
source_version: "1.0.0"
---

# Zəncir test şəbəkəsinin qurulması: Hyperledger Besu addım-addım

Bu bələdçi Tamga-nın [[t:ledger|ortaq reyestrini]] (Hyperledger Besu, QBFT) **öz kompüterinizdə və ya test serverlərinizdə**
qurub sınamaq istəyənlər üçündür. Heç bir ilkin bilik tələb etmir: hər termin ilk keçdiyi yerdə izah olunur, hər əmrin nə etdiyi
yazılır. Bütün əmrlər açıq depodakı skriptlərdir; bu bələdçidəki ölçmələr həmin skriptlərin GitHub Actions-dakı real
işindən götürülüb.

::: danger Zəncir bu gün istehsalda bağlıdır
Tamga-nın etibarı bu gün imzalanmış [[t:trust-list|etibar siyahılarına]] əsaslanır; işləyən istehsal zənciri **yoxdur**
([[ADR-0009]] K4, [[ADR-0051]]). Bu bələdçi ilə qurulan şəbəkə **test şəbəkəsidir**:

- canlı sistemlə (imzalanmış siyahılar, yoxlama, cüzdan, sandbox) heç bir əlaqəsi yoxdur; onu nə yavaşladır, nə də dəyişir;
- zəncir identifikatoru A və B yollarında 31338-dir (yerli inkişaf identifikatoru; depodakı alətlər yalnız 31337 və 31338-i
  "yerli zəncir" kimi tanıyır), C yolunda 31339-dur (test/hazırlıq identifikatoru);
- qovşaq açarları (A və B yollarında) hamıya məlum test açarlarıdır: yalnız `127.0.0.1` və ya qapalı test şəbəkəsi üçün; C yolunda
  hər açar yeni yaradılır, amma hamısı bir maşındadır: o da yalnız test şəbəkəsi üçündür.

İki rejimin (zəncirsiz və zəncirli) əlaqəsi, zəncirin nə əlavə etdiyi və iki rejimin necə sinxron qaldığı: [[GUIDE-0016]].
:::

**Nə vaxt oxunur:**
- Zəncir qatını öz gözünüzlə görmək, onun quraşdırılmasını və istismarını sınamaq istəyirsinizsə.
- Dövlətiniz və ya qurumunuz gələcəkdə validator işlətməyi nəzərdən keçirirsə, təlimatdan ([[GUIDE-0015]]) əvvəl və ya onunla
  birlikdə: təlimat **real şəbəkədəki** addımları, bu bələdçi isə eyni addımların **test şəbəkəsində** sınanmasını izah edir.
- Əvvəl (istəyə bağlı): [Ortaq reyestr (zəncir)](/concepts/ledger) anlayışı.

## Terminlər

Bu bölmə bələdçinin qalanını oxumaq üçün kifayətdir. Texniki terminlər tərcümə olunmur; Azərbaycanca qarşılığı yanında verilir.

| Termin | Mənası |
|---|---|
| Blockchain / reyestr | Bir neçə kompüterin eyni qeydi birlikdə saxladığı, əlavə edilmiş qeydin sonradan dəyişdirilə bilmədiyi məlumat strukturu. Qeydlər bloklar şəklində düzülür; hər blok əvvəlkinin həşini daşıyır. Tamga-da "ortaq reyestr" |
| Qovşaq (node) | Reyestrin nüsxəsini işlədən proqram və onun işlədiyi maşın. Tamga-da qovşaq proqramı Hyperledger Besu-dur (Java ilə yazılıb, tək JVM prosesi) |
| Validator | Blok təklif edən və imzalayan qovşaq. Tam qovşaq (full node) zənciri yoxlayır və oxuyur, amma blok imzalamır |
| QBFT | Besu-nun konsensus üsulu. Validatorlar hər bloka səs verir; blok validatorların üçdə ikisindən çoxu qəbul edəndə qətiləşir və bir daha geri alınmır |
| 3f+1 | QBFT-nin dayanıqlıq qaydası: n validatorlu şəbəkə ən çox f = ⌊(n−1)/3⌋ validatorun dayanmasına və ya səhv davranmasına davam gətirir. Aşağıdakı cədvələ baxın |
| Genesis | Zəncirin ilk bloku və başlanğıc parametrləri (`genesis.json`): zəncir identifikatoru, blok müddəti, ilk validatorlar, başlanğıc balanslar. Bütün qovşaqlarda bayt-bayt eyni olmalıdır; dəyişsə, ayrı zəncir yaranır |
| chainId | Zəncirin rəqəm kimi identifikatoru. Hər imzalanmış əməliyyat bu rəqəmi daşıyır, beləliklə bir zəncir üçün imzalanmış əməliyyat başqa zəncirdə keçmir. Test şəbəkəsi: `31338` (A və B yolları), `31339` (C yolu) |
| `extraData` | Genesis-dəki sahə; QBFT-də ilk validator ünvanlarının siyahısını RLP (Ethereum-un ikili kodlaşdırması) şəklində daşıyır |
| enode | Qovşağın şəbəkə ünvanı: `enode://<128 simvolluq açıq açar>@<IP>:<P2P portu>`. Açıq açar qovşağın identifikatorudur, ünvanı bu açardan törənir |
| Bootnode / statik həmyaşıdlar (static nodes) | Yeni açılan qovşağın ilk qoşulduğu qovşaqlar. Tamga-da kəşf (discovery) bağlıdır; hər qovşaq qoşulacağı həmyaşıdları `static-nodes.json` faylından oxuyur |
| İcazəli şəbəkə (permissioned network) | Yalnız icazə siyahısındakı qovşaqların qoşula bildiyi (`nodes-allowlist`) və yalnız icazə siyahısındakı hesabların əməliyyat göndərə bildiyi (`accounts-allowlist`) şəbəkə. Hər iki siyahı hər qovşaqda yerli faylda olur: `permissions_config.toml` ([[ADR-0052]]) |
| Hesab (account) | Açar cütündən törənən 20 baytlıq ünvan (`0x…`); əməliyyatları bu açar imzalayır. Qovşaq açarı da hesabdır: validatorun ünvanı qovşaq açarının ünvanıdır |
| P2P | Qovşaqların öz aralarında blok və səs mübadiləsi etdiyi bağlantı (standart port 30303, TCP). Kənara yalnız digər validatorlara açılır |
| RPC (JSON-RPC) | Proqramın qovşağa sorğu verdiyi və ya əməliyyat göndərdiyi HTTP interfeysi (standart port 8545). İdarəetmə metodları (`admin_`, `perm_`, `qbft_`) yalnız qovşağın özündən istifadə olunur; kənara heç açılmır və ya yalnız qorunan proksidən açılır |
| Kontrakt (smart contract) | Zəncirdə işləyən proqram. Tamga-nın kontraktları etibar qeydlərinin zəncirdəki qarşılığını saxlayır (Governance, qurum, yoxlayan tərəf, sənəd növü, ləğv siyahısı lövbəri, siyahı lövbəri…) |
| Governance | Üzvlüyü və şəbəkə qərarlarını saxlayan kontrakt: dövlətlər üzv olur, qərarlar 2/3 səslə qəbul edilir. Dövlətin validator ünvanı burada yazılıdır; icazə siyahısı buradan hazırlanır |
| Lövbər (anchor) | Bir məlumatın həşinin zəncirə yazılması. Tamga-da hər imzalanmış siyahı versiyasının həşi siyahı lövbəri qeydinə yazılır (`trust:chain-submit`); siyahının sonradan dəyişmədiyi bu həşlə göstərilir |
| Təkrar oynatma (replay) | İmzalanmış siyahıların bütün tarixçəsinin, siyahıdakı tarixlərlə kontraktlara bir dəfə köçürülməsi (`trust:chain-replay`, [[ADR-0073]]) |
| Ekvivalentlik testi | Eyni sualların həm imzalanmış siyahıya, həm zəncirə verilib cavabların müqayisə edilməsi. Qəbul və ya rədd cavabında bir fərqə belə yol verilmir |

**3f+1 cədvəli.** f = ⌊(n−1)/3⌋ (⌊ ⌋: aşağı yuvarlaqlaşdırma). Blok istehsalı üçün ən azı n − f validator onlayn olmalıdır.

| Validator sayı (n) | Davam gətirilən nasazlıq (f) | Blok istehsalı üçün ən azı onlayn |
|---|---|---|
| 1 | 0 | 1 |
| 2 | 0 | 2 |
| 4 | 1 | 3 |
| 5 | 1 | 4 |
| 7 | 2 | 5 |
| 10 | 3 | 7 |

Test şəbəkəsi buna görə **4 validatorla** qurulur: bir nasazlığa davam gətirə bilən ən kiçik şəbəkə. Bu davranış ölçülüb: 4
validatordan biri dayananda bloklar davam etdi, ikincisi dayananda dayandı, yenidən başladılanda davam etdi (§ Nasazlıq sınağı).

**Səsvermə həddi.** QBFT-də validator əlavə etmək və ya çıxarmaq üçün mövcud validatorların yarısından çoxu (⌊n/2⌋ + 1) səs verir:
4 validatorda 3 səs, 5 validatorda 3 səs. Bu, Governance-dakı 2/3 səsdən ayrı bir səsvermədir (§ Validator əlavə etmək və çıxarmaq).

## Üç yol

| | Yol A — Windows, bir kompüter | Yol B — bir Linux maşınında 4 validator | Yol C — real server düzəni |
|---|---|---|---|
| Nə üçün | Kontraktları, icazə siyahısını və səsverməni ilk dəfə görmək | Çoxqovşaqlı şəbəkənin hamısını başdan sona sınamaq | Test serverlərinə quraşdırmanı sınamaq |
| Qovşaq sayı | 1 (icazəsiz) və ya 2 (icazəli rejim) | 4 validator + 1 əlavə qovşaq, hamısı `127.0.0.1` | Server başına 1 qovşaq |
| Skript | `scripts/besu-dev.ps1` (`npm run chain:besu:*`) | `network/testnet/*.sh` (proses rejimi) | `network/testnet/*.sh` + `besu@.service` (systemd rejimi) |
| Açar | Yerli yaradılan (tək qovşaq) və ya Hardhat test hesabları | Hardhat test hesabları (`--keys dev`) | Yeni yaradılan (`--keys generate`), açar xəritəsi ilə |
| Sınandığı mühit | Windows 11, PowerShell 5.1 | Ubuntu 24.04 (GitHub Actions, hər həftə) | Ubuntu 24.04 (GitHub Actions: tək validatorlu `systemd` işi; yaradılmış açarlı 4 validator, `staging` işi) |

Hamısının ortaq cəhəti: eyni Besu versiyası (26.11.0), eyni Java versiyası (JDK 25), eyni genesis parametrləri, eyni kontraktlar və
eyni alətlər. Yol A-dan B-yə keçmək üçün heç nəyi yenidən öyrənmək lazım deyil.

### Tələblər

**Proqram təminatı:**

| | Yol A | Yol B və C |
|---|---|---|
| Əməliyyat sistemi | Windows 10/11 | Linux x64 və ya aarch64 |
| Node.js | 22 və ya yuxarı | 22 və ya yuxarı |
| Əmrlər | PowerShell 5.1, Git | `bash curl jq unzip tar ss openssl sha256sum setsid pgrep`; RPC qorunmasını sınamaq üçün `nginx` |
| Java və Besu | skript endirir | skript endirir |

Java və Besu-nu əl ilə qurmaq lazım deyil: skriptlər **Temurin JDK 25** və **Besu 26.11.0**-ı rəsmi buraxılış səhifələrindən
endirir, sha256 həşini depodakı sabit dəyərlə müqayisə edir (uyğun gəlməsə faylı silir və dayanır) və açır. Docker lazım deyil.

**Avadanlıq (ölçülmüş).** Yol B-nin GitHub Actions-dakı işi (Ubuntu 24.04, 4 CPU, 16 GB yaddaş; 4 validator + 1 əlavə qovşaq eyni
maşında; qovşaq başına Java yığını `-Xmx768m`):

| Ölçmə | Dəyər |
|---|---|
| Yaddaş (qovşaq başına, RSS) | 505–568 MiB |
| Prosessor (qovşaq başına, bütün iş boyu) | 10–37 san prosessor vaxtı; boş vaxtda blok istehsal edərkən çox aşağı |
| Disk (qovşaq başına) | 74–76 MiB (404 blokda) |
| Qovşağın açılması | JSON-RPC 2–3 san ərzində cavab verir |
| Başdan sona sınağın hamısı | 921 san (bunun 616 saniyəsi 111 əməliyyatlıq təkrar oynatma) |

Planlaşdırma üçün (ölçmədən çıxarış): qovşaq başına təxminən 0,6 GB yaddaş ayırın; Yol B-nin 5 qovşağı birlikdə təxminən 3 GB
tutur, üstəlik əməliyyat sistemi və Node.js alətləri. Yol C-də systemd vahidi `-Xmx1g` istifadə edir. Real şəbəkə üçün server tövsiyəsi ayrıdır: [[GUIDE-0015]] §1.

## Yol A — Windows-da bir kompüter

Bütün əmrlər depo kökündən, PowerShell-də. Əvvəlcə deponu və paketləri hazırlayın:

```powershell
git clone https://github.com/tamga-network/tamga-network; cd tamga-network
npm install
npm run setup                 # yerli PKI + imzalanmış yerli siyahılar (apps/trust-publisher/dist) — lövbərləmə bunlardan istifadə edir
npm run contracts:install     # kontraktların asılılıqları (contracts/)
npm run contracts:compile
```

### A1. Tək qovşaqlı şəbəkə (icazəsiz)

```powershell
npm run chain:besu:init     # JDK 25 + Besu endirir (tools/), genesis və validator açarı yaradır (network/dev/)
npm run chain:besu:start    # qovşağı başladır: RPC 127.0.0.1:8546, P2P 127.0.0.1:30313; ilk bloku gözləyir
npm run chain:besu:status   # chainId, blok nömrəsi, validatorlar
npm run chain:besu:deploy   # kontraktları yerləşdirir → contracts/deployments/besuDev.json
npm run chain:besu:stop     # dayandırır (zəncir məlumatı qalır)
npm run chain:besu:reset    # dayandırır və zəncir məlumatını silir; genesis və açar qalır
```

`init` nə edir:
1. JDK 25 və Besu-nu `tools/_dl/` qovluğuna endirir, sha256-nı yoxlayır, `tools/jdk-25` və `tools/besu-26.11.0` kimi açır.
2. Besu-nun öz aləti ilə (`besu operator generate-blockchain-config`) tək validator açarı və genesis yaradır:
   `network/dev/keys/key` (gizli açar; bu kompüterdə yaradılır, depoya düşmür) və `network/dev/genesis.json`.
3. Mövcud olanın üzərinə yazmır: yenidən yaratmaq üçün `network/dev/genesis.json` və `network/dev/keys/` silinir.

`start` qovşağı arxa planda başladır və blok nömrəsi artmağa başlayanda qayıdır. Jurnal `network/dev/data/besu.log`-dadır. Bu tək
qovşaq özü blok istehsal edir (1 validator, f = 0); kontraktları, lövbərləməni və təkrar oynatmanı sınamaq üçün kifayətdir.

8545 portu qəsdən istifadə olunmur (Hardhat-ın yerli qovşağına ayrılıb); Besu 8546-dadır.

### A2. İki qovşaqlı icazəli şəbəkə

İcazə siyahısını və validator səsverməsini görmək üçün ayrıca yerli şəbəkə (`network/dev/perm/`). İki qovşağın açarları Hardhat-ın
hamıya məlum test hesabları #1 (TR) və #2-dir (KZ); beləliklə validator ünvanı, Governance-dakı validator ünvanı və enode ünvanı
eyni olur — real şəbəkədəki uyğunluq qaydası ([[ADR-0052]] K2) real formasında sınanır.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Init -Permissioned           # genesis, iki açar, iki qovşaq bəyannaməsi
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Start -Permissioned          # qovşaq 1: RPC 8546, P2P 30313
npm run chain:besu:deploy                                                                              # kontraktlar
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Apply -Permissioned          # icazə siyahısı zəncirdən
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Start -Permissioned -Node 2  # qovşaq 2: RPC 8547, P2P 30314
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Apply -Permissioned          # hər iki qovşaqda yenidən
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts accounts      # icazəsiz hesab rədd edilir, nümayəndə yazır
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-add      # qovşaq 2 validator olur
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-remove   # və çıxarılır
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Status -Permissioned
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Stop -Permissioned
```

| Addım | Nə baş verir |
|---|---|
| `-Init -Permissioned` | Genesis-də tək təsisçi validator (qovşaq 1); iki qovşaq açarı; iki qovşaq bəyannaməsi (`network/dev/perm/nodes/`) |
| `-Start -Permissioned` | Qovşaq 1 **başlanğıc icazə faylı** ilə açılır: kontraktlar hələ yoxkən siyahıda qovşaq 1 və yerli yerləşdirmənin hesabları (#0–#4) olur |
| `-Apply -Permissioned` | İşləyən hər qovşaq üçün icazə siyahısını zəncirdən hazırlayır, qovşağa yüklədir və yoxlayır; iki qovşaq işləyirsə, hər biri əvvəlcə sinxron olana qədər gözlənilir (`-SyncTimeout <san>`, standart 180) |
| `-Start … -Node 2` | Qovşaq 2 tam qovşaq kimi açılır, qovşaq 1-ə statik həmyaşıd kimi qoşulur |
| `accounts` | İcazə siyahısında olmayan hesabın (#9) əməliyyatı qovşaqda rədd edilir ("Sender account not authorized to send transactions"); siyahıdakı dövlət nümayəndəsinin (#3) əməliyyatı bloka düşür |
| `vote-add` / `vote-remove` | Qovşaq 2 QBFT səsi ilə validator dəstinə girir və çıxır (2 validatorda çoxluq 2 səsdir) |

Tək qovşaqlı şəbəkə ilə icazəli rejim **eyni vaxtda işləmir** (eyni portlar).

## Yol B — bir Linux maşınında 4 validator

Bütün əmrlər depo kökündən. Skriptlərin ətraflı izahı depoda `network/testnet/README.md`-dədir.

### B1. Hazırlıq

```bash
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm ci && npm run setup && npm run contracts:install && npm run contracts:compile
```

### B2. Java və Besu-nun qurulması

```bash
bash network/testnet/install-besu.sh       # → tools/jdk-25, tools/besu-26.11.0, tools/besu (keçid)
```

Skript prosessor arxitekturasına görə (x64 və ya aarch64) düzgün JDK arxivini seçir, endirir, sha256-nı yoxlayır, açır və sonda
`java -version` və `besu --version` çıxışını yoxlayır. Mövcud olanı yenidən endirmir. Seçimlər: `--prefix <qovluq>` (başqa yerə
qur), `--cache <qovluq>` (endirmə keşi), `--system` (Yol C).

::: warning JAVA_HOME tələsi
Skriptlər ümumi `JAVA_HOME` dəyişənindən **istifadə etmir**; JDK-nı `TESTNET_JAVA_HOME`-dan (standart `tools/jdk-25`) götürür.
Səbəbi GitHub Actions-da tapıldı: oradakı maşınlarda (və bir çox serverdə) `JAVA_HOME` daha köhnə JDK-nı (17) göstərir; Besu 26.x
isə Java 25 tələb edir və köhnə JDK ilə açılmır. Özünüzün qurduğu JDK 25-dən istifadə etmək üçün: `--java-home <qovluq>` və ya
`TESTNET_JAVA_HOME=<qovluq>`.
:::

### B3. Şəbəkənin yaradılması

```bash
bash network/testnet/make-network.sh       # standart: 4 validator + 1 əlavə qovşaq → network/testnet/run/
```

| Seçim | Standart | Nə |
|---|---|---|
| `--validators N` | 4 | Genesis-dəki validator sayı |
| `--extra E` | 1 | Tam qovşaq kimi başlayan, sonra səslə validator edilə bilən əlavə qovşaq sayı |
| `--keys dev\|generate` | `dev` | `dev`: Hardhat-ın hamıya məlum test hesabları #1 #2 #6 #7 #8 (ən çox 5 qovşaq). `generate`: yeni təsadüfi açarlar |
| `--chain-id` | 31338 | Zəncir identifikatoru (başdan sona sınaq yalnız 31338 ilə işləyir; `--keys generate` ilə standart 31339) |
| `--block-period` | 2 | Blok müddəti (saniyə) |
| `--hosts "ip1 ip2 …"` | — | Server başına bir qovşaq (Yol C) |
| `--dir`, `--besu-home`, `--java-home` | `network/testnet/run`, `tools/besu`, `tools/jdk-25` | Qovluqlar |
| `--force` | — | Mövcud şəbəkəni (məlumatı ilə birlikdə) silir və yenidən yazır; işləyən qovşaq varsa imtina edir |

**Açarlar və genesis necə yaradılır.** `--keys dev` ilə hər qovşağın açarı sabit test hesabıdır; `--keys generate` ilə Besu-nun
aləti (`besu operator generate-blockchain-config`) yeni açarlar yaradır. Sonra ilk N qovşağın ünvanı Besu-nun RLP aləti ilə
(`besu rlp encode --type=QBFT_EXTRA_DATA`) genesis-in `extraData` sahəsinə yazılır: genesis-dəki validator dəsti budur. Əlavə
qovşaqlar genesis-də validator deyil; səslə əlavə edilirlər.

Test dövlətləri: qovşaq 1 `TR`, qovşaq 2 `KZ` (yerli yerləşdirmə skriptinin iki təsisçisi), qovşaq 3–5 `XA`, `XB`, `XC`. `XA`… ISO
3166-nın istifadəçiyə saxlanmış kodlarıdır; heç bir real dövləti göstərmir.

**Yazılan fayllar** (`network/testnet/run/`, depoya düşmür):

| Fayl | Nə |
|---|---|
| `genesis.json` | Bütün qovşaqların ortaq genesis-i |
| `network.env` | Şəbəkə parametrləri (validator sayı, portlar, Java və Besu yolu); digər skriptlər bunu oxuyur |
| `declarations/<cc>-node<n>.json` | Hər qovşağın bəyannaməsi (`tamga-node-declaration/1`: dövlət, rol, açıq açar, IP, P2P portu, xidməti əlaqə ünvanı) |
| `node<n>/key` | Qovşağın gizli açarı (icazə `600`) |
| `node<n>/key.pub`, `node<n>/address` | Açıq açar (enode identifikatoru) və ondan törənən ünvan (validator ünvanı) |
| `node<n>/state` | Qovşağın test dövlət kodu |
| `node<n>/static-nodes.json` | Qoşulacaq həmyaşıdlar: özündən başqa genesis validatorlarının enode-ları |
| `node<n>/permissions_config.toml` | Başlanğıc icazə faylı: genesis validatorlarının qovşaqları və hesabları + yerli yerləşdirmənin hesabları (yerləşdirən #0, TR və KZ nümayəndələri #3, #4). Kontraktlar qurulanda zəncirdən hazırlanan faylla əvəz olunur |
| `node<n>/besu.toml` | Qovşağın bütün parametrləri (aşağıda) |

**Genesis sahələri:**

| Sahə | Dəyər | Mənası |
|---|---|---|
| `config.chainId` | 31338 | Zəncir identifikatoru |
| `config.berlinBlock`, `londonBlock`, `shanghaiTime` | 0 | Ethereum qayda versiyaları ilk blokdan aktiv (kontraktlar `shanghai` hədəfi ilə kompilyasiya olunur) |
| `config.zeroBaseFee` | `true` | Əməliyyat haqqı yoxdur (icazəli şəbəkə; heç kim haqla yer almır) |
| `config.qbft.blockperiodseconds` | 2 | İki blok arasındakı müddət |
| `config.qbft.epochlength` | 30000 | Gözləyən səslərin sıfırlandığı blok aralığı |
| `config.qbft.requesttimeoutseconds` | 4 | Raundda təklif gəlməsə yeni raunda keçmə müddəti (blok müddətinin iki qatı) |
| `gasLimit` | `0x1fffffffffffff` | Blok başına əməliyyat tutumu həddi (yüksək) |
| `difficulty`, `mixHash`, `nonce`, `coinbase` | sabit | QBFT-nin gözlədiyi sabit dəyərlər (mayninq yoxdur) |
| `alloc` | 10 test hesabı | Hardhat test hesablarına başlanğıc balans (yalnız test) |
| `extraData` | RLP | Genesis validatorlarının ünvanları |

**`besu.toml` sahələri** (hər qovşaqda; dəyərlər qovşaq 1 üçün):

| Sahə | Dəyər | Mənası |
|---|---|---|
| `data-path` | `run/node1/db` | Zəncir məlumatının qovluğu |
| `genesis-file` | `run/genesis.json` | Ortaq genesis |
| `node-private-key-file` | `run/node1/key` | Qovşaq açarı (validator ünvanı bundan törənir) |
| `sync-mode` | `FULL` | Bütün blokları əvvəldən yoxlayaraq sinxronlaş |
| `p2p-host` | `127.0.0.1` | Digər qovşaqlara **elan edilən** ünvan (enode-dakı ünvan) |
| `p2p-interface` | `127.0.0.1` | P2P-nin **dinlədiyi** interfeys. Verilməzsə, Besu `0.0.0.0`-da (bütün interfeyslərdə) dinləyir; `p2p-host` bunu dəyişmir |
| `p2p-port` | 30313 | P2P portu |
| `discovery-enabled` | `false` | Həmyaşıd kəşfi bağlıdır; həmyaşıdlar yalnız statik siyahıdan |
| `static-nodes-file` | `run/node1/static-nodes.json` | Statik həmyaşıdlar |
| `rpc-http-enabled` | `true` | JSON-RPC açıqdır |
| `rpc-http-host` | `127.0.0.1` | JSON-RPC yalnız bu maşından |
| `rpc-http-port` | 8546 | JSON-RPC portu |
| `rpc-http-api` | `ETH, NET, WEB3, QBFT, PERM, ADMIN` | Açıq metod qrupları; `QBFT` səs üçün, `PERM` icazə siyahısını yükləmək üçün, `ADMIN` həmyaşıdları görmək üçün — hamısı yalnız `127.0.0.1`-də |
| `host-allowlist` | `localhost`, `127.0.0.1` | JSON-RPC-yə yalnız bu `Host` başlıqları ilə gəlmək olar |
| `metrics-enabled` | `false` | Metrik nöqtəsi bağlıdır (real qovşaqda yalnız yerli interfeysdə açılır, [[GUIDE-0015]] §8) |
| `min-gas-price` | 0 | Pulsuz əməliyyatlar qəbul olunur |
| `color-enabled` | `false` | Jurnalda rəng kodu yoxdur |
| `permissions-nodes-config-file-enabled` | `true` | Qovşaq icazə siyahısı açıqdır |
| `permissions-accounts-config-file-enabled` | `true` | Hesab icazə siyahısı açıqdır |
| `permissions-nodes-config-file`, `permissions-accounts-config-file` | `run/node1/permissions_config.toml` | İki siyahı eyni faylda |

### B4. Başlatmaq, dayandırmaq, vəziyyətə baxmaq

```bash
bash network/testnet/node.sh start all        # və ya: start 1, start 2 …
bash network/testnet/node.sh status all
bash network/testnet/node.sh logs 1           # son 100 sətir
bash network/testnet/node.sh stop all
```

`start` qovşağı arxa planda başladır (proses identifikatoru `node<n>/besu.pid`, jurnal `node<n>/besu.log`) və JSON-RPC cavab
verənə qədər gözləyir (`TESTNET_START_TIMEOUT`, standart 120 san). Port məşğuldursa, başlatmır. `stop` əvvəlcə SIGTERM göndərir
(Besu verilənlər bazasını düzgün bağlayır), 60 san ərzində dayanmasa SIGKILL. Java yığını `TESTNET_HEAP` ilə dəyişir (standart `768m`).

`status` hər qovşaq üçün bir sətir çap edir: dövlət kodu, ünvan, işləyirmi, RPC ünvanı, blok nömrəsi, həmyaşıd sayı, validator sayı.

| Qovşaq | JSON-RPC | P2P | Rol |
|---|---|---|---|
| 1 | 127.0.0.1:8546 | 127.0.0.1:30313 | genesis validatoru (TR) |
| 2 | 127.0.0.1:8547 | 127.0.0.1:30314 | genesis validatoru (KZ) |
| 3 | 127.0.0.1:8548 | 127.0.0.1:30315 | genesis validatoru (XA) |
| 4 | 127.0.0.1:8549 | 127.0.0.1:30316 | genesis validatoru (XB) |
| 5 | 127.0.0.1:8550 | 127.0.0.1:30317 | əlavə qovşaq (XC); səslə validator edilir |

Qayda: qovşaq n-in RPC portu 8545 + n, P2P portu 30312 + n. Bu şəbəkə ilə Windows-dakı yerli şəbəkə eyni zəncir identifikatorundan
və eyni yerləşdirmə faylından istifadə edir: eyni maşında ikisini birlikdə işlətməyin.

### B5. Bir əmrlə başdan sona sınaq

Aşağıdakı bölmələrdəki addımların hamısını ardıcıl yerinə yetirən, hər birini yoxlayan və sonda xülasə yazan skript:

```bash
bash network/testnet/deploy-and-wire.sh            # qovşaqları başladır, sınayır, sonda dayandırır
bash network/testnet/deploy-and-wire.sh --keep     # sonda qovşaqları işlək saxlayır (əl ilə davam etmək üçün)
```

| # | Addım | Ölçülmüş nəticə (GitHub Actions) |
|---|---|---|
| 1 | 4 validator başlayır, hər biri digər 3-ü ilə qoşulur; JSON-RPC və P2P yalnız `127.0.0.1`-də | 4 validator, hər qovşaqda 3 həmyaşıd; 8 dinləyən soket, hamısı `127.0.0.1` |
| 2 | Kontraktlar yerləşdirilir (təsisçilər TR, KZ) | 10 kontrakt |
| 3 | İmzalanmış siyahı arxivi kontraktlara təkrar oynadılır; ekvivalentlik testi | 111 əməliyyat; 557 sual, 0 qərar fərqi |
| 4 | Siyahılar lövbərlənir (`trust:chain-submit`), hər siyahı yoxlanılır (`trust:chain-check`) | 3 yazı; 2 siyahı üçün YES |
| 5 | Digər genesis validatorlarının dövlətləri (XA, XB) Governance-a 2/3 səslə qəbul edilir | 4 üzv |
| 6 | Hər qovşaq icazə siyahısını **öz qovşağından** hazırlayır, yükləyir, yoxlayır; paylaşılan həşlər eynidir; icazəsiz hesab rədd edilir | 7 hesab, 4 qovşaq, 4 qovşaqda eyni həş; #9 rədd edildi, #3 yazdı |
| 7 | Qovşaq 5 qəbul edilir, icazə siyahısına girir, sinxronlaşır, səslə validator olur (blok təklif edir), səslə çıxarılır | 4-dən 3 səslə 9 san-də 5 validator, qovşaq 5 blok təklif etdi; 5-dən 3 səslə 10 san-də yenidən 4 |
| 8 | Bir validator dayananda bloklar davam edir; ikincisi dayananda dayanır; yenidən başladılanda davam edir | 1 dayandı → davam etdi; 2 dayandı → 20 san blok yoxdur; yenidən başlatma → 66 san-də davam |
| 9 | RPC qorunması (metod filtri + nginx qarşılıqlı TLS) | 32 yoxlama keçdi, nginx mTLS sınandı |
| 10 | Xülasə | `run/summary.md`, `run/summary.json` |

Hər hansı addım gözlənilən nəticəni verməsə, skript dayanır, son jurnal sətirlərini çap edir və xülasəyə hansı addımda dayandığını yazır.

## Yol C — real server düzəni (systemd)

Test serverlərinə quraşdırma: hər serverdə bir qovşaq, qovşaq sistem xidməti kimi işləyir.

### C1. Hər serverdə: Java, Besu və xidmət istifadəçisi

```bash
sudo bash network/testnet/install-besu.sh --system
```

`--system` ilə:
- JDK və Besu `/opt/tamga-besu/` altında qurulur və **root-a məxsus** olur (xidmət istifadəçisi proqramları dəyişə bilmir);
- `besu` adlı sistem istifadəçisi yaradılır (qabığı yoxdur, sistemə daxil ola bilmir);
- qovşaq məlumatı üçün `/var/lib/tamga-besu` (sahibi `besu`, icazə `0750`) hazırlanır.

### C2. Bir maşında: şəbəkə faylları

```bash
sudo bash network/testnet/make-network.sh --dir /var/lib/tamga-besu --besu-home /opt/tamga-besu/besu \
     --java-home /opt/tamga-besu/jdk-25 --keys generate --hosts "192.0.2.10 192.0.2.11 192.0.2.12 192.0.2.13" --extra 0
```

- `--keys generate`: açarlar yenidir, hamıya məlum test açarları deyil.
- `--hosts`: hər qovşağa bir IP (ardıcıl olaraq qovşaq 1, 2, …). Bu rejimdə hər qovşaqda P2P həmin IP-də, port 30303; JSON-RPC
  `127.0.0.1:8545`. Ünvan serverin şəbəkə interfeysində birbaşa olmalıdır; bulud mühitində daxili və xarici ünvan fərqlidirsə,
  `besu.toml`-da `p2p-interface` daxili, `p2p-host` xarici ünvan olacaq şəkildə düzəldilir.
- `192.0.2.x` sənədlərdə istifadə olunan nümunə ünvanlardır; öz ünvanlarınızı yazın.

Skript bütün açarları bir maşında yazır. Sonra hər serverə **yalnız öz** qovluğu köçürülür: `genesis.json`, `network.env` və
`node<n>/` (`/var/lib/tamga-besu/` altına eyni yollarla). Digər qovşaqların `key` faylı həmin serverə getmir. Real şəbəkədə bu
addım fərqlidir: hər operator açarını **öz avadanlığında** yaradır və yalnız açıq açarını paylaşır ([[GUIDE-0015]] §3).

### C3. Hər serverdə: xidmət

```bash
sudo chown -R besu:besu /var/lib/tamga-besu
sudo install -m 0644 network/testnet/besu@.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now besu@node1                      # server 1-də; server 2-də besu@node2, …
sudo TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd bash network/testnet/node.sh status 1
journalctl -u besu@node1 -n 100 --no-pager                  # jurnal
```

`besu@.service` şablondur: `besu@node1` nümunəsi `/var/lib/tamga-besu/node1/besu.toml` ilə işləyir. Vahid:

| Parametr | Nə təmin edir |
|---|---|
| `User=besu`, `UMask=0077` | Qovşaq səlahiyyətsiz istifadəçi ilə işləyir; yazdığı faylları yalnız o oxuyur |
| `ReadWritePaths=/var/lib/tamga-besu/%i`, `ProtectSystem=strict`, `ProtectHome=true` | Yalnız öz məlumat qovluğuna yaza bilir; sistemin qalanı yalnız oxunandır |
| `NoNewPrivileges`, boş `CapabilityBoundingSet`, `SystemCallFilter=@system-service` | Səlahiyyət artırma yoxdur, imtiyaz yoxdur, yalnız adi sistem çağırışları |
| `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK` | Yalnız şəbəkə və yerli soketlər |
| `KillSignal=SIGTERM`, `TimeoutStopSec=120` | Besu verilənlər bazasını bağlamağa vaxt tapır |
| `Restart=on-failure` | Düşərsə, 10 san sonra yenidən başlayır |

`MemoryDenyWriteExecute` qəsdən açılmır: Java-nın kompilyatoru (JIT) yazıla bilən və icra oluna bilən yaddaş tələb edir. GitHub
Actions-dakı systemd işində (tək validator, yaradılmış açar) qovşaq `besu` istifadəçisi ilə işlədi, 12 saniyədə 6 blok istehsal
etdi, iki dinləyən soketin ikisi də `127.0.0.1`-də idi və `systemd-analyze security` balı **1.5 OK** oldu (0 ən sərt, 10 ən açıq).

### C4. Firewall

| Port | Kimə açıqdır |
|---|---|
| P2P (30303/TCP) | Yalnız digər validatorların IP ünvanlarına. Kəşf bağlı olduğu üçün UDP lazım deyil |
| JSON-RPC (8545) | Kənara bağlıdır; qovşaq onsuz da yalnız `127.0.0.1`-də dinləyir. Xarici müştərilər yalnız RPC proksisi üzərindən (§ RPC qorunması) |
| RPC proksisi (8443/TCP, istəyə bağlı) | Yalnız müştəri sertifikatı verilmiş müştərilərə |

Nümunə (ufw, server 1-də):

```bash
sudo ufw default deny incoming
sudo ufw allow from 192.0.2.11 to any port 30303 proto tcp
sudo ufw allow from 192.0.2.12 to any port 30303 proto tcp
sudo ufw allow from 192.0.2.13 to any port 30303 proto tcp
```

İdarəetmə girişiniz (SSH) üçün qaydanı bunlardan **əvvəl** əlavə edin. Vahiddə əlavə qat kimi `IPAddressDeny=any` və
`IPAddressAllow=localhost <həmyaşıdların ünvanları>` sətirləri hazırdır, şərh kimi durur.

### C5. Yaradılmış açarlarla kontraktlar və Governance

`--keys generate` ilə `make-network.sh` qovşaq açarlarının yanına **açar xəritəsi** də yazır: `keys/keys.json` və hər rol üçün yeni
yaradılmış, öz faylında (icazə `0600`) bir açar: yerləşdirən, köç icraçısı, iki siyahı lövbəri yazıçısı və hər dövlət üçün bir
nümayəndə; dövlətin validator açarı onun qovşaq açarıdır. Zəncir identifikatoru **31339**-dur: depodakı alətlər bu identifikatoru nə
yerli zəncir (hamıya məlum test açarı yoxdur, sandbox dəsti yoxdur), nə də real şəbəkə sayır.

::: warning Yalnız test və hazırlıq şəbəkələri üçün
Real şəbəkədə bütün açarlar heç kimdə olmur: hər dövlət validator açarını öz avadanlığında yaradır, imza açarlarını HSM-də saxlayır
([[GUIDE-0015]] §3). Açar xəritəsi test şəbəkəsində bütün dövlətləri bir nəfər oynadığı üçün mövcuddur. Onu oxuyan hər alət
`purpose` `test` deyilsə, zəncir identifikatoru 31339 deyilsə və ya açar faylı `0600` deyilsə ya da öz ünvanına aid deyilsə
xəritəni rədd edir.
:::

`make-network.sh`-i işlədən maşında (server başına bir qovşaqda: bütün çıxış hələ də üzərində olan 1-ci server):

```bash
sudo env "PATH=$PATH" TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd \
     bash network/testnet/bootstrap-governance.sh --nodes 1
```

Bütün qovşaqlar bir maşındadırsa `--nodes` olmadan; proses rejimində `sudo` və `TESTNET_*` dəyişənləri olmadan:

```bash
bash network/testnet/make-network.sh --keys generate
bash network/testnet/node.sh start all
bash network/testnet/bootstrap-governance.sh
```

Skript addım-addım; hər addım jurnala yazılır, təkrar işə salma artıq edilmiş olanı ötürür:

| Addım | Nə baş verir |
|---|---|
| 1. Şəbəkə | Qovşaqlar cavab verir, bloklar artır, QBFT dəstində 4 validator var. 31339-dan fərqli zəncir identifikatoru rədd edilir |
| 2. Kontraktlar | `contracts/scripts/deploy-network.ts` (Hardhat şəbəkəsi `besuStaging`): təsisçilər TR və KZ nümayəndələri ilə; təsisçilər arası tanınma Governance səsverməsi ilə (`proposeFounderRecognition`, [[ADR-0055]] K3); siyahı lövbəri qeydinin idarəçisi Governance kontraktı, 2 yazıçı, hədd 2. Ünvanlar: `deployment.json` |
| 3. Governance | XA və XB 2/3 səslə qəbul edilir; hər dövlət nümayəndəsini öz validatoru ilə təyin edir |
| 4. İcazə siyahısı | Hər qovşaqda zəncirdən hazırlanır, yüklənir və yoxlanılır; `shared_sha256` eynidir; yerləşdirən siyahıdan düşür; siyahıda olmayan təsadüfi açar rədd edilir, nümayəndənin əməliyyatı bloka düşür |
| 5. Lövbər | Birinci yazıçı ilə `trust:chain-submit`, ikincisi təsdiqləyir; `trust:chain-check` hər siyahı üçün YES cavabı verir |
| 6. Təkrar oynatma | Köç pəncərəsi səslə açılır; icazə siyahısı yenidən hazırlanır və artıq pəncərənin icraçısını ehtiva edir; nümunə arxiv açar xəritəsi ilə təkrar oynadılır; ekvivalentlik testi. `--no-replay` bu addımı ötürür |
| 7. Xülasə | Şəbəkə qovluğunda `bootstrap-summary.md` və `.json` |

Sonra digər hər serverdə öz qovşağının icazə siyahısı. Əvvəlcə `deployment.json` faylını və `nodes/` qovluğunu 1-ci serverdən
köçürün; açar lazım deyil:

```bash
sudo env "PATH=$PATH" TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd \
     bash network/testnet/bootstrap-governance.sh --only permissions --nodes 2
```

| Dəyişən | Nə |
|---|---|
| `TAMGA_CHAIN_KEYS` | Açar xəritəsi (standart: şəbəkə qovluğunda `keys/keys.json`) |
| `TAMGA_CHAIN_DEPLOYMENT` | Yerləşdirmə faylı (skript təyin edir: şəbəkə qovluğunda `deployment.json`) |

GitHub-dakı `staging` işi bu addımları systemd altında 4 validatorla sıfırdan işlədir (§ GitHub-da avtomatik sınaq).

## Kontraktların yerləşdirilməsi

Kontraktlar bir dəfə, şəbəkənin istənilən validatoruna yerləşdirilir; bloklar bütün qovşaqlara yayılır.

```bash
npm run chain:besu:deploy                                          # Yol A və B: 127.0.0.1:8546-ya
TAMGA_BESU_RPC=http://127.0.0.1:8547 npm run chain:besu:deploy     # başqa qovşağa
```

Yerləşdirmə skripti (`contracts/scripts/deploy-dev.ts`) Tamga-nın kontraktlarını qurur, Governance-a iki təsisçi dövləti (TR və KZ;
validatorları Hardhat hesabları #1 və #2, nümayəndələri #3 və #4) yazır və ünvanları `contracts/deployments/besuDev.json`-a saxlayır.
Siyahı lövbəri qeydinin ünvanı bu faylda `anchor.registry` sahəsindədir. Besu əməliyyatı yalnız növbəti blokda (2 san) emal edir;
skript hər addımda bloku gözləyir.

C yolunda kontraktlar yaradılmış açarlarla `contracts/scripts/deploy-network.ts` ilə yerləşdirilir (`bootstrap-governance.sh`
2-ci addım, § C5); orada Hardhat test hesablarından istifadə edilmir.

Kontraktların mənbə kodu, testləri və spesifikasiyası depodadır (`contracts/`, Hardhat; Solidity).

## İcazə siyahısının zəncirdən hazırlanması və tətbiqi

İcazə siyahısı **əl ilə yazılmır** ([[ADR-0052]] LP2): hər operator onu zəncirdəki kontrakt vəziyyətindən, eyni alətlə özü hazırlayır.
Beləliklə bütün validatorların siyahısı eyni olur və hesabı siyahıya əlavə etməyin yeganə yolu zəncirdəki idarəetmə əməliyyatıdır.

| Siyahı | Mənbəyi |
|---|---|
| Hesablar | Governance-dakı aktiv üzvlərin validator ünvanları və nümayəndələri, fəaliyyətdə olan qurumların nümayəndələri, siyahı lövbəri yazıçıları, açıq miqrasiya pəncərəsinin icraçısı |
| Qovşaqlar | Bəyannaməsi (`declarations/…json`) Governance-dakı aktiv validator ünvanı ilə uyğun gələn qovşaqlar |

**Əvvəlcə bütün validatorlar Governance-da olmalıdır.** Yerli yerləşdirmə yalnız TR və KZ-ni qurur; XA və XB-nin validatorları
(qovşaq 3 və 4) Governance-da yoxkən siyahı zəncirdən hazırlanarsa, həmin iki qovşaq siyahıdan düşür və 4 validatordan 2-si
ayrıldığı üçün zəncir dayanır. Yol B-də əvvəlcə iki dövləti qəbul edin (təklif → səslər → icra; yalnız test şəbəkəsində, test
açarları ilə):

```bash
DEP=contracts/deployments/besuDev.json
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XA --validator-index 6 --voters 1,2
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XB --validator-index 7 --voters 1,2,6
mkdir -p network/testnet/run/nodes
cp network/testnet/run/declarations/{tr-node1,kz-node2,xa-node3,xb-node4}.json network/testnet/run/nodes/
```

Sonra hər qovşaqda: hazırla → köçür → yüklə → yoxla.

```bash
for n in 1 2 3 4; do
  d=network/testnet/run/node$n; url=http://127.0.0.1:$((8545 + n))
  TAMGA_CHAIN_RPC_URL=$url npm run -s trust:chain-permissions -- render --nodes network/testnet/run/nodes \
    --deployment $DEP --out $d/permissions_config.rendered.toml
  cp $d/permissions_config.rendered.toml $d/permissions_config.toml
  curl -s -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"perm_reloadPermissionsFromFile","params":[]}' $url
  npm run -s trust:chain-permissions -- check --file $d/permissions_config.rendered.toml --node-rpc $url
done
```

- `render` hər qovşağın **öz** JSON-RPC-sindən oxuyur və hesabat çap edir: blok, hesab və qovşaq sayı, `sha256` (faylın həşi) və
  `shared_sha256` (operatorun öz oxuma qovşaqları xaric həş). **Bütün validatorlarda `shared_sha256` eyni olmalıdır** (LP3).
  Qovşaq hələ sinxronlaşmayıbsa, köhnə blokda hazırlayır və həş fərqli çıxır: əvvəlcə sinxronlaşmasını gözləyin.
- `perm_reloadPermissionsFromFile` qovşağa faylı yenidən oxutdurur; qovşaq yenidən başladılmır.
- Besu faylı yükləyərkən öz formatında yenidən yazır (şərhlər itir). Buna görə hazırlanmış fayl `permissions_config.rendered.toml`-da
  qalır və `check` faylı qovşağın yaddaşındakı siyahı ilə **məna baxımından** müqayisə edir.
- Çıxış kodu 3: bəyannamə rədd edildi (açıq açardan törənən ünvan Governance-dakı validator ünvanı deyil) və ya `check` fərq tapdı.

Hesab icazəsinin işlədiyini görmək üçün:

```bash
node network/testnet/testnet.mjs accounts --rpc http://127.0.0.1:8546   # #9 rədd edilir, #3 bloka düşür
```

Yol A-da bütün bu addımları `besu-dev.ps1 -Apply -Permissioned` edir.

## Siyahıların zəncirə lövbərlənməsi

Zəncirsiz sistemin imzalanmış siyahılarının (`lotl.jws`, `tl-<cc>.jws`) və lövbər jurnalının həşini zəncirdəki siyahı lövbəri
qeydinə yazmaq. Test şəbəkəsində lövbərlənən `npm run setup`-ın yaratdığı **yerli** siyahılardır (`apps/trust-publisher/dist/`);
canlı sistemin siyahılarına toxunulmur.

```bash
export TAMGA_CHAIN_ENABLED=1
export TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546
export TAMGA_CHAIN_ANCHOR_REGISTRY=$(jq -r .anchor.registry contracts/deployments/besuDev.json)
# Hardhat test hesabı #0 — hamıya məlum test açarı, yalnız test şəbəkəsi
export TAMGA_CHAIN_ANCHORER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
npm run trust:chain-submit -- --dry-run                                  # planı çap edir, yazmır
npm run trust:chain-submit                                               # həşləri yazır
npm run trust:chain-check -- apps/trust-publisher/dist/lotl.jws          # YES / NO / UNKNOWN
npm run trust:chain-check -- apps/trust-publisher/dist/tl-tr.jws
```

PowerShell-də (Yol A) eyni dəyişənlər `$env:TAMGA_CHAIN_ENABLED = "1"` şəklində verilir; qeyd ünvanı:
`(Get-Content contracts\deployments\besuDev.json -Raw | ConvertFrom-Json).anchor.registry`.

| Dəyişən | Nə |
|---|---|
| `TAMGA_CHAIN_ENABLED` | `1` olmadan zəncirə qoşulmur və heç nə yazılmır (standart `0`, canlı sistemdə də `0`) |
| `TAMGA_CHAIN_RPC_URL` | Qovşağın JSON-RPC ünvanı |
| `TAMGA_CHAIN_ANCHOR_REGISTRY` | Siyahı lövbəri qeydinin ünvanı |
| `TAMGA_CHAIN_ANCHORER_KEY` | Yazıçı açarı (yalnız `chain-submit`) |

- Sağlam olmayan dəst (imza və ya versiya zənciri pozulub) lövbərlənmir.
- Eyni versiya eyni həşlə ikinci dəfə yazılmır (`SKIP`); fərqli həş `CONFLICT` verir, yazılmır və əmr xəta kodu ilə bitir.
- `chain-check` cavabları: **YES** (həş zəncirdə təsdiqlənib), **NO** (zəncirdə fərqli həş təsdiqlənib: ikili danışıq əlaməti),
  **UNKNOWN** (zəncir bağlıdır, əlçatmazdır və ya hədd dolmayıb). Bu yoxlama yoxlama nəticəsini heç vaxt pisləşdirmir.
- A və B yollarında yazıçı həddi 1, C yolunda 2-dir (iki yazıçı); real şəbəkədə ən azı 2 müstəqil yazıçı eyni həşi göndərmədən lövbər təsdiqlənmir
  ([[ADR-0051]] CH3).

Qurumların ləğv siyahısı lövbərləri də zəncirdəki siyahı qeydinə düşür; bunun üçün lövbər sətri siyahının bit sayını və ölçüsünü
daşıyır (`trust:anchor --token <token faylı>`, [[SPEC-TRUST-0001]] §5).

## Tarixçənin köçürülməsi və ekvivalentlik testi

Zəncir bir gün açılanda imzalanmış siyahıların bütün tarixçəsi kontraktlara bir dəfə, siyahıdakı tarixlərlə təkrar oynadılır
(`trust:chain-replay`, [[ADR-0073]]); sonda ekvivalentlik testi işləyir. Test şəbəkəsində bunu nümunə arxivlə sınayan skript:

```bash
npx tsx apps/chain-indexer/scripts/besu-smoke.ts http://127.0.0.1:8546
```

Skript zəncirin saatına görə nümunə siyahı arxivi yaradır, müvəqqəti qovluğa yazır və `trust:chain-replay`-i həmin qovluqla işlədir:
arxivi yoxlayır (imza, versiya zənciri, lövbər zənciri), deterministik oynatma planı və onun həşini çıxarır, yerli zəncirdə
miqrasiya pəncərəsini Governance səsi ilə açır, əməliyyatları yazır, zənciri indeksləyir və ekvivalentlik testini edir. Testdə eyni
suallar həm siyahıya, həm zəncirə verilir — bu qurum o tarixdə etibarlı idimi, bu sənəd növünü verə bilərdimi, bu ölkə həmin qurumu
tanıyırmı, bu siyahı versiyasının həşi nədir — hər qeydə alınmış an və hər sərhəd anı üçün (bir saniyə əvvəl, tam o an, bir saniyə
sonra).

| Çıxış kodu | Mənası |
|---|---|
| 0 | Ekvivalentdir |
| 2 | Qapı və ya konfiqurasiya çatışmır |
| 3 | Ekvivalentlik fərqi var: miqrasiya bağlanmır |
| 4 | Governance səsi gözlənilir |

Ölçülmüş nəticə (Yol B, GitHub Actions): 111 əməliyyat 616 saniyədə yazıldı; 557 sual verildi, **0 qərar fərqi**. Planı zəncirə
heç qoşulmadan görmək üçün: `npm run trust:chain-replay -- --dry-run`.

Yol B-də təkrar oynatmanı icazə siyahısı zəncirdən hazırlanmazdan **əvvəl** işlədin: yerli oynatma Governance səslərini təsisçilərin
test açarları ilə imzalayır və `deploy-and-wire.sh` da bu ardıcıllığa əməl edir.

## Validator əlavə etmək və çıxarmaq

Validator dəsti QBFT səsi ilə dəyişir. Ardıcıllıq vacibdir:

1. **Governance:** dövlət üzv kimi qəbul edilir (validator ünvanı ilə, 2/3 səs).
2. **İcazə siyahısı:** hər qovşaqda yenidən hazırlanır; yeni qovşaq siyahıya girir.
3. **Sinxronlaşma:** yeni qovşaq tam qovşaq kimi açılır, qoşulur və son bloka çatır (`eth_syncing` = `false`).
4. **QBFT səsi:** mövcud validatorların yarısından çoxu **öz qovşağında** `qbft_proposeValidatorVote(<ünvan>, true)` çağırır.
   Səslər bloklara düşür; çoxluq dolanda dəst dəyişir.
5. **Səsin təmizlənməsi:** dəst dəyişəndə hər səs verən `qbft_discardValidatorVote(<ünvan>)` çağırır (gözləyən səs qalmasın).

Qısa köməkçi (bash):

```bash
rpc() { curl -s -H 'content-type: application/json' \
  --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":${3:-[]}}" "$1" | jq -c .result; }
```

Yol B-də qovşaq 5-i (XC, ünvanı `0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f`) əlavə etmək:

```bash
X=0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XC --validator-index 8 --voters 1,2,6,7
cp network/testnet/run/declarations/xc-node5.json network/testnet/run/nodes/
# yeni qovşağın ilk faylı qovşaq 1 vasitəsilə (öz qovşağı hələ sinxronlaşmayıb)
TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546 npm run -s trust:chain-permissions -- render --nodes network/testnet/run/nodes \
  --deployment $DEP --out network/testnet/run/node5/permissions_config.toml
# qovşaq 1–4-də icazə siyahısını yenidən hazırlayıb yükləyin (əvvəlki bölmədəki dövr), sonra:
bash network/testnet/node.sh start 5
rpc http://127.0.0.1:8550 eth_syncing                                   # false olana qədər gözləyin
# qovşaq 5 sinxronlaşanda icazə siyahısını 5 qovşağın hamısında yenidən hazırlayın (dövrdə n = 1…5)
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_proposeValidatorVote "[\"$X\",true]"; done
rpc http://127.0.0.1:8546 qbft_getValidatorsByBlockNumber '["latest"]'  # 5 ünvan olanda:
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_discardValidatorVote "[\"$X\"]"; done
rpc http://127.0.0.1:8546 qbft_getSignerMetrics                          # qovşaq 5-in təklif etdiyi blok sayı
```

Çıxarmaq: 5 validatorda ⌊5/2⌋ + 1 = 3 səs, bu dəfə `false` ilə; dəst 4-ə qayıdanda səslər təmizlənir və qovşaq dayandırılır.

```bash
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_proposeValidatorVote "[\"$X\",false]"; done
rpc http://127.0.0.1:8546 qbft_getValidatorsByBlockNumber '["latest"]'  # 4 ünvan olanda:
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_discardValidatorVote "[\"$X\"]"; done
bash network/testnet/node.sh stop 5
```

Ölçülmüş nəticə: əlavə etmə 4-dən 3 səslə 9 saniyədə tamamlandı və qovşaq 5 blok təklif etdi; çıxarma 5-dən 3 səslə 10 saniyədə
tamamlandı. Dəst hər qovşaqda eyni olmalıdır. Yol A-da eyni iş `besu-permissions-smoke.ts vote-add` və `vote-remove` ilə; Yol C-də
səs hər serverdə həmin serverin `127.0.0.1:8545`-inə verilir. Real şəbəkədəki addımlar və cədvəl: [[GUIDE-0015]] §6 və §10.

## Nasazlıq sınağı

4 validatorlu şəbəkənin bir nasazlığa davam gətirdiyini özünüz görün (Yol B):

```bash
bash network/testnet/node.sh stop 4
bash network/testnet/node.sh status all     # bir neçə dəfə: blok nömrəsi artmağa davam edir (3 validator kifayətdir)
bash network/testnet/node.sh stop 3
bash network/testnet/node.sh status all     # blok nömrəsi dayanır (2 validator kifayət deyil)
bash network/testnet/node.sh start 3 && bash network/testnet/node.sh start 4
bash network/testnet/node.sh status all     # bloklar yenidən axır; dayandırılan qovşaqlar çatışmayan blokları alır
```

Bloklar dayananda heç nə itmir: zəncir sadəcə irəliləmir. Kifayət qədər validator qayıdanda QBFT raundu yenidən başlayır. Ölçülmüş
nəticə: iki qovşaq yenidən başladıldıqdan **66 saniyə** sonra bloklar davam etdi (gözləmə QBFT-nin raund vaxt aşımlarının ardıcıl
uzanmasından irəli gəlir). Dayandırılan validatorun məlumatı silinmir; açılanda qaldığı yerdən sinxronlaşır.

## RPC qorunması

Qovşağın JSON-RPC nöqtəsi internetə açılmır ([[ADR-0052]] LP5). Kənardan oxumalı olan proqramlar (siyahı nəşriyyatçısı,
indeksləyici, yoxlayan tərəfin oxuma yolu) yalnız qarşılıqlı TLS-li (mTLS: müştəri də sertifikat təqdim edir) proksidən keçir və
yalnız `eth_`, `net_`, `web3_` metodlarına çatır:

```text
müştəri --TLS 1.3 + müştəri sertifikatı--> nginx :8443 --> metod filtri 127.0.0.1 --> Besu 127.0.0.1
```

Test şəbəkəsində bütün qatı sınayan skript:

```bash
bash network/testnet/rpc-proxy-check.sh --upstream http://127.0.0.1:8546     # nginx yoxdursa: --no-nginx
```

| Yoxlama | Gözlənilən |
|---|---|
| Filtrdən `eth_blockNumber`, `eth_chainId`, `eth_getBlockByNumber`, `net_version`, `net_peerCount`, `web3_clientVersion` | 200 |
| Filtrdən `admin_*`, `perm_*`, `qbft_*`, `debug_*`, `txpool_*`, `eth_sendTransaction`, `eth_accounts`, `eth_sign`, `miner_start` | 403 |
| İçində tək qadağan çağırış olan toplu sorğu | 403 (hamısı) |
| nginx-ə müştəri sertifikatı olmadan | 400 |
| nginx-ə TLS 1.2 ilə | bağlantı rədd edilir |
| Qovşağın RPC portu maşının xarici ünvanında | cavab yoxdur |

Skript filtri `127.0.0.1:8555`-də işlədir, nginx üçün müvəqqəti yerli test sertifikatları yaradır (`network/rpc-proxy/dev-certs/`,
depoya düşmür) və bitəndə hər ikisini bağlayır. Ölçülmüş nəticə: 32 yoxlama keçdi. Filtri əl ilə işlətmək üçün:

```bash
TAMGA_RPC_FILTER_LISTEN=127.0.0.1:8555 TAMGA_RPC_FILTER_UPSTREAM=http://127.0.0.1:8546 node network/rpc-proxy/filter.mjs
```

Filtrin standart portu 8550-dir; Yol B-də bu port qovşaq 5-in RPC portudur, ona görə test şəbəkəsində 8555 istifadə olunur. Real
serverdəki nginx konfiqurasiyası və systemd vahidi nümunələri: `network/rpc-proxy/` və [[GUIDE-0015]] §7.

## Monitorinq

| Nə | Necə | Sağlam |
|---|---|---|
| Blok hündürlüyü | `rpc <url> eth_blockNumber` və ya `node.sh status all` | Hər 2 saniyədə artır; qovşaqlar arasında ən çox 1–2 blok fərq |
| Sinxronlaşma | `rpc <url> eth_syncing` | `false` |
| Həmyaşıd sayı | `rpc <url> net_peerCount` | validator sayı − 1 və ya çox |
| Validator dəsti | `rpc <url> qbft_getValidatorsByBlockNumber '["latest"]'` | Hər qovşaqda eyni |
| Blok təklifi | `rpc <url> qbft_getSignerMetrics` | Hər validatorun təklif etdiyi blok sayı artır |
| İcazə siyahısı | `trust:chain-permissions check` | Çıxış 0; `shared_sha256` hər validatorda eyni |
| Dinləmə ünvanları | `ss -ltnp` | JSON-RPC yalnız `127.0.0.1`; P2P yalnız gözlənilən interfeysdə |
| Lövbər vəziyyəti | Yoxlama xidmətinin `/healthz` cavabındakı `chain` sahəsi | `anchored`: `YES` |

**`/healthz` `chain` sahəsi.** Yoxlama xidməti (`apps/verify`) yüklədiyi siyahıların zəncirdə təsdiqlənmiş şəkildə lövbərlənib-
lövbərlənmədiyini sağlamlıq səhifəsində göstərir. Bayraq bağlı olanda (bu gün canlı sistemdə olduğu kimi) cavab `UNKNOWN`-dur və
zəncirə qoşulmur. Test şəbəkəsində sınamaq üçün xidməti lövbərləmə bölməsindəki dəyişənlərlə başladın (yazıçı açarı lazım deyil):

```bash
TAMGA_CHAIN_ENABLED=1 TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546 \
  TAMGA_CHAIN_ANCHOR_REGISTRY=$(jq -r .anchor.registry contracts/deployments/besuDev.json) npm run verify
curl -s http://localhost:4004/healthz | jq .chain     # enabled, anchored (YES/NO/UNKNOWN), reason, lists[]
```

Bu sahə məlumat xarakterlidir: yoxlama nəticəsini və `ok` sahəsini heç vaxt dəyişmir; `NO` yalnız həyəcan siqnalıdır ([[ADR-0051]] CH1).

Qoşulan qovşağın yoxlamalarının (sinxronlaşma, icazə siyahısı, dəst, RPC, saat) real şəbəkədəki siyahısı: [[GUIDE-0015]] §8;
qoşulma aləti `tamga-onboard node check` eyni yoxlamaları yalnız oxuyaraq edir.

## Sıfırlama və təmizlik

| Nə | Yol A | Yol B | Yol C |
|---|---|---|---|
| Dayandırmaq | `npm run chain:besu:stop` · icazəli: `-Stop -Permissioned` | `node.sh stop all` | `sudo systemctl stop besu@node<n>` |
| Zəncir məlumatını silmək (parametrlər qalır) | `npm run chain:besu:reset` · icazəli: `-Reset -Permissioned` (icazə faylları da gedir) | qovşaqları dayandırıb `rm -rf network/testnet/run/node*/db` | dayandırıb `/var/lib/tamga-besu/node<n>/db`-ni silmək |
| Şəbəkəni yenidən yazmaq (açar, genesis daxil) | `network/dev/` silinib `chain:besu:init` | `make-network.sh --force` | eyni `--dir` ilə `make-network.sh --force` |
| Hər şeyi silmək | `network/dev/`, `tools/jdk-25`, `tools/besu-*` silinir | `network/testnet/run/`, `tools/` silinir | `systemctl disable besu@node<n>`, vahid, `/opt/tamga-besu`, `/var/lib/tamga-besu`, `besu` istifadəçisi |

Zəncir məlumatı silindikdən sonra kontraktları yenidən yerləşdirin: `contracts/deployments/besuDev.json` yeni yerləşdirmədə üzərinə
yazılır. Endirilmiş arxivlər `tools/_dl/`-də qalır; yenidən quraşdırmada təkrar endirilmir.

## Problemlərin həlli

| Əlamət | Səbəb | Həll |
|---|---|---|
| Besu açılmır; jurnalda Java versiyası xətası | Köhnə JDK istifadə olunur (ümumi `JAVA_HOME` JDK 17-ni göstərir) | JDK 25: skriptlər `TESTNET_JAVA_HOME`-dan (standart `tools/jdk-25`) istifadə edir; `--java-home` ilə başqa JDK 25 verin |
| Qovşaq xarici ünvanda da dinləyir | `p2p-interface` verilməyib; Besu-nun standartı `0.0.0.0`. `p2p-host` yalnız elan edilən ünvandır | `besu.toml`-a `p2p-interface` yazın; `ss -ltnp` ilə yoxlayın |
| İcazə siyahısı qovşaqlar arasında fərqlidir (`shared_sha256` fərqli) | Qovşaq sinxronlaşmadan hazırladı (köhnə blok) və ya biri yükləmədi | `eth_syncing` `false` olana qədər gözləyib yenidən hazırlayın; operatorlar arasında eyni `--block` ilə müqayisə edin |
| İcazə siyahısı hazırlananda zəncir dayandı | Validatorların bir hissəsi Governance-da deyil; siyahıdan düşdülər | Əvvəlcə bütün validatorların dövlətlərini Governance-a qəbul edin, sonra hazırlayın (§ İcazə siyahısı) |
| "Sender account not authorized to send transactions" | Hesab icazə siyahısında deyil | Düzgün davranış ola bilər; deyilsə, icazə siyahısını yenidən hazırlayıb yükləyin |
| Həmyaşıd yoxdur; "Bootnode(s) not in nodes-allowlist" | Qovşaq siyahısında çatışmazlıq var | Bəyannamə + `render` + yükləmə; statik həmyaşıd təxminən 1 dəqiqəyə yenidən qoşulur |
| `render` çıxışı 3 | Bəyannamədəki açıq açar Governance-dakı validator ünvanı ilə uyğun gəlmir | Bəyannaməni və Governance qeydini müqayisə edin |
| `node.sh start`: port məşğuldur | Əvvəlki qovşaq və ya Windows-dakı yerli şəbəkə eyni portdadır | `node.sh status all`; qalıq prosesi dayandırın |
| Windows: `chain:besu:stop` qovşağı dayandırmır | `besu.bat` `cmd.exe`-dir; əsl proses onun `java.exe` övladıdır | Skript `java.exe`-nin proses identifikatorunu `besu.pid`-ə yazır və onu dayandırır; qalıq üçün `Get-Process java` |
| Windows: genesis və ya TOML oxunmur | Fayl BOM ilə (faylın əvvəlində görünməz işarə) yazılıb; PowerShell 5.1-in `Set-Content`/`Out-File`-ı bunu edir | BOM-suz UTF-8 və LF sətir sonu; skriptlər belə yazır |
| Windows: Git Bash-dan `besu` "Argument list too long" | Bash-dan başladılan Windows skripti | PowerShell-dən `besu.bat` (skript belə edir) |
| ethers "could not coalesce error" | Qovşağın əsl xəta mətni iç-içədir | Əsl mətn `error.error.message`-dadır |

## GitHub-da avtomatik sınaq

Depodakı `testnet` iş axını (`.github/workflows/testnet.yml`) Yol B-ni və Yol C-nin systemd düzənini hər dəfə təmiz Ubuntu 24.04
maşınında sıfırdan qurur və sınayır.

| İş | Nə edir |
|---|---|
| `lint` | Bütün skriptləri `bash -n` və `shellcheck` ilə yoxlayır |
| `network` | JDK 25 + Besu qurur, paketləri və imzalanmış siyahıları hazırlayır, kontraktları kompilyasiya edir, 4 validator + 1 əlavə qovşaqlı şəbəkəni yazır və `deploy-and-wire.sh`-i işlədir (nginx məcburidir). Qovşaq jurnalları, icazə faylları və hesabatlar 14 gün saxlanılır |
| `systemd` | `--system` quraşdırması, yaradılmış açarlı tək validator, `systemd-analyze verify`, qovşağın `besu` istifadəçisi ilə işləməsi, blok artımı, yalnız `127.0.0.1`-də dinləmə və `systemd-analyze security` balı |
| `staging` | Bir maşında C yolu: `--system` quraşdırması, systemd altında yaradılmış açarlı 4 validator (vahidə əlavə faylla yığın `-Xmx640m`), `bootstrap-governance.sh` başdan sona (§ C5), sonra heç nə yazmamalı olan ikinci işə salma |

**Nə vaxt işləyir:** hər bazar ertəsi (04:23 UTC); `contracts/`, `apps/chain-indexer/`, `apps/trust-publisher/src/chain/`,
`network/testnet/`, `network/rpc-proxy/`, `network/permissions/` və ya iş axınının özü dəyişəndə; və əl ilə. Əl ilə işə salmaq üçün
GitHub-da depo → **Actions** → **testnet** → **Run workflow**; və ya GitHub əmr sətri aləti ilə:

```bash
gh workflow run testnet.yml
gh run list --workflow testnet.yml          # son işlər
gh run view <iş nömrəsi> --log              # bütün jurnal
```

**Nəticə xülasəsi harada:** işin səhifəsində, iş xülasəsində (job summary): `network` işinin xülasəsi bu bələdçidə "ölçülmüş nəticə"
kimi verilən cədvəldir (validator və həmyaşıd sayı, kontraktlar, təkrar oynatma, ekvivalentlik, lövbər, icazə siyahısı, səslər,
nasazlıq sınağı, RPC qorunması, resurs istifadəsi, müddət); `systemd` işinin xülasəsi vahidin istifadəçisini, blok artımını,
soketləri və təhlükəsizlik balını verir; `staging` işinin xülasəsi `bootstrap-governance.sh`-in cədvəlidir (kontraktlar, Governance
üzvləri, icazə siyahısı, lövbər, köç pəncərəsi, təkrar oynatma və ekvivalentlik) və ikinci işə salmanın nəticəsidir. Bu bələdçidəki ölçmələr 2026-11-05 tarixli işdəndir.

## Kölgə zəncir

Gələcəkdə, ayrıca kiçik test serverində, canlı şəbəkənin real imzalanmış siyahılarının da hər nəşrdən sonra test zəncirinə
lövbərlənməsi nəzərdə tutulur ("kölgə zəncir"): zəncirsiz sistem mənbə qalır, kölgə zəncir yalnız onu izləyir və iki rejimin uzun
müddət birlikdə necə davrandığını göstərir. Bu gün belə zəncir **yoxdur**. Layihə rəhbərliyi əvvəlcə GitHub-dakı avtomatik sınaqla
irəliləməyə qərar verdi; ayrıca test serveri onun alınmasına qərar veriləndə qurulur. Quraşdırma Yol C-nin skriptləri ilə edilir.

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[ADR-0009]] K4 | Ortaq reyestr ən azı iki müstəqil operatorun yazılı razılığı olmadan qurulmur; test şəbəkəsi bu qaydadan kənardadır, çünki istehsal deyil |
| [[ADR-0051]] CH1, CH5 | Zəncir siyahının proyeksiyasıdır; ziddiyyətdə siyahı keçərlidir. Bayraq bağlı olanda zəncirə qoşulmur |
| [[ADR-0052]] LP1–LP5 | Yerli icazələndirmə; siyahı zəncirdən hazırlanır, əl ilə yazılmır; bütün validatorlarda eynidir; səlahiyyət kontraktlardadır; RPC internetə açılmır |
| [[ADR-0073]] | Tarixçə bir dəfə təkrar oynadılır; ekvivalentlik testində qəbul/rədd fərqi qaldıqca miqrasiya bağlanmır |
| [[ADR-0074]] K7 | Sandbox siyahıları istehsal zəncirinə yazılmır |

Anlayış: [Ortaq reyestr (zəncir)](/concepts/ledger). Real şəbəkədəki addımlar: [[GUIDE-0015]]. İki rejim: [[GUIDE-0016]]. Zəncir
açıq olanda milli siyahının idarə edilməsi: [[GUIDE-0017]] §8.
