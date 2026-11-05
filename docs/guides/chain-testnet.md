---
document_id: GUIDE-0018
title: "Zincir test ağı kurmak: Hyperledger Besu adım adım"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Zincirsiz canlı sistem çalışırken zincir katmanını test etmek isteyenler için sıfırdan, adım adım kurulum rehberi: terimler
  (düğüm, validator, QBFT ve 3f+1, genesis, chainId, enode, statik eşler, izinli ağ, RPC ve P2P, Governance, çapa, yeniden
  oynatma, eşdeğerlik), üç yol (Windows'ta tek bilgisayar, tek Linux makinede 4 doğrulayıcı, systemd ile gerçek sunucu düzeni),
  ölçülmüş gereksinimler, ağ dosyalarının ve besu.toml alanlarının anlamı, kontratların dağıtılması, izin listesinin zincirden
  üretilmesi, listelerin zincire çapalanması, geçmişin aktarılması ve eşdeğerlik testi, validator ekleme ve çıkarma oyları, arıza
  denemesi, RPC koruması, izleme, sıfırlama, sorun giderme ve GitHub'daki otomatik sınama.
---

# Zincir test ağı kurmak: Hyperledger Besu adım adım

Bu rehber, Tamga'nın [[t:ledger|ortak defterini]] (Hyperledger Besu, QBFT) **kendi bilgisayarınızda ya da test sunucularınızda**
kurup denemek isteyenler içindir. Hiçbir ön bilgi varsaymaz: her terim ilk geçtiği yerde açıklanır, her komutun ne yaptığı
yazılır. Komutların hepsi herkese açık depodaki betiklerdir; bu rehberdeki ölçümler o betiklerin GitHub Actions'taki gerçek
çalışmasından alınmıştır.

::: danger Zincir bugün üretimde kapalıdır
Tamga'nın güveni bugün imzalı [[t:trust-list|güven listelerinde]] durur; çalışan bir üretim zinciri **yoktur** ([[ADR-0009]] K4,
[[ADR-0051]]). Bu rehberde kurulan ağ bir **test ağıdır**:

- canlı sistemle (imzalı listeler, doğrulama, cüzdan, sandbox) hiçbir bağlantısı yoktur; onu yavaşlatmaz, değiştirmez;
- zincir kimliği Yol A ve B'de 31338'dir (yerel geliştirme kimliği; depodaki araçlar yalnız 31337 ile 31338'i "yerel zincir"
  olarak tanır), Yol C'de 31339'dur (test/hazırlık kimliği);
- düğüm anahtarları (Yol A ve B'de) herkesçe bilinen test anahtarlarıdır: yalnız `127.0.0.1` ya da kapalı bir test ağı için; Yol
  C'de her anahtar yeni üretilir ama hepsi tek makinededir: o da yalnız test ağı içindir.

İki hâlin (zincirsiz ve zincirli) ilişkisi, zincirin ne eklediği ve iki hâlin nasıl senkron kaldığı: [[GUIDE-0016]].
:::

**Ne zaman okunur:**
- Zincir katmanını kendi gözünüzle görmek, kurulumunu ve işletimini denemek istiyorsanız.
- Devletiniz ya da kurumunuz ileride validator işletmeyi değerlendiriyorsa, el kitabından ([[GUIDE-0015]]) önce ya da onunla
  birlikte: el kitabı **gerçek ağdaki** adımları, bu rehber **test ağında** aynı adımların denenmesini anlatır.
- Önce (isteğe bağlı): [Ortak defter (zincir)](/concepts/ledger) kavramı.

## Terimler

Bu bölüm rehberin geri kalanını okumak için yeterlidir. Teknik terimler çevrilmez; Türkçe karşılığı yanlarında verilir.

| Terim | Ne demek |
|---|---|
| Blockchain / defter | Birden çok bilgisayarın aynı kaydı birlikte tuttuğu, eklenen kaydın sonradan değiştirilemediği veri yapısı. Kayıtlar bloklar hâlinde sıralanır; her blok bir öncekinin özetini taşır. Tamga'da "ortak defter" |
| Düğüm (node) | Defterin bir kopyasını çalıştıran program ve onun çalıştığı makine. Tamga'da düğüm programı Hyperledger Besu'dur (Java ile yazılmış, tek bir JVM süreci) |
| Validator (doğrulayıcı) | Blok öneren ve imzalayan düğüm. Tam düğüm (full node) zinciri doğrular ve okur ama blok imzalamaz |
| QBFT | Besu'nun uzlaşma (consensus) yöntemi. Validator'lar her bloğu oylar; bir blok, validator'ların üçte ikisinden fazlası kabul edince kesinleşir ve bir daha geri alınmaz |
| 3f+1 | QBFT'nin dayanıklılık kuralı: n validator'lı bir ağ en çok f = ⌊(n−1)/3⌋ validator'ın durmasına ya da hatalı davranmasına dayanır. Aşağıdaki tabloya bakın |
| Genesis | Zincirin ilk bloğu ve başlangıç ayarları (`genesis.json`): zincir kimliği, blok süresi, ilk validator'lar, başlangıç bakiyeleri. Bütün düğümlerde bayt bayt aynı olmalıdır; değişirse ortaya ayrı bir zincir çıkar |
| chainId | Zincirin sayı olarak kimliği. İmzalı her işlem bu sayıyı taşır, böylece bir zincir için imzalanan işlem başka bir zincirde geçmez. Test ağı: `31338` (Yol A ve B), `31339` (Yol C) |
| `extraData` | Genesis'teki alan; QBFT'de ilk validator adreslerinin listesini RLP (Ethereum'un ikili kodlaması) biçiminde taşır |
| enode | Bir düğümün ağ adresi: `enode://<128 karakterlik açık anahtar>@<IP>:<P2P portu>`. Açık anahtar düğümün kimliğidir, adresi bu anahtardan türer |
| Bootnode / statik eşler (static nodes) | Yeni açılan bir düğümün ilk bağlandığı düğümler. Tamga'da keşif (discovery) kapalıdır; her düğüm bağlanacağı eşleri `static-nodes.json` dosyasından okur |
| İzinli ağ (permissioned network) | Yalnız izin listesindeki düğümlerin bağlanabildiği (`nodes-allowlist`) ve yalnız izin listesindeki hesapların işlem gönderebildiği (`accounts-allowlist`) ağ. İki liste her düğümde yerel bir dosyadadır: `permissions_config.toml` ([[ADR-0052]]) |
| Hesap (account) | Bir anahtar çiftinden türeyen 20 baytlık adres (`0x…`); işlemleri bu anahtar imzalar. Düğüm anahtarı da bir hesaptır: validator'ın adresi düğüm anahtarının adresidir |
| P2P | Düğümlerin kendi aralarında blok ve oy alışverişi yaptığı bağlantı (varsayılan port 30303, TCP). Dışarıya yalnız öteki validator'lara açılır |
| RPC (JSON-RPC) | Bir programın düğüme soru sorduğu ya da işlem gönderdiği HTTP arayüzü (varsayılan port 8545). Yönetim yöntemleri (`admin_`, `perm_`, `qbft_`) yalnız düğümün kendisinden kullanılır; dışarıya hiç açılmaz ya da yalnız korumalı vekilden açılır |
| Kontrat (smart contract) | Zincirde çalışan program. Tamga'nın kontratları güven kayıtlarının zincirdeki karşılığını tutar (Governance, kurum, doğrulayıcı, belge türü, iptal listesi çapası, liste çapası…) |
| Governance | Üyeliği ve ağ kararlarını tutan kontrat: devletler üye olur, kararlar 2/3 oyla alınır. Bir devletin validator adresi burada yazılıdır; izin listesi buradan üretilir |
| Çapa (anchor) | Bir verinin özetinin zincire yazılması. Tamga'da her imzalı liste sürümünün özeti liste çapası kaydına yazılır (`trust:chain-submit`); listenin sonradan değişmediği bu özetle gösterilir |
| Yeniden oynatma (replay) | İmzalı listelerin bütün geçmişinin, listedeki tarihlerle kontratlara bir kez aktarılması (`trust:chain-replay`, [[ADR-0073]]) |
| Eşdeğerlik testi | Aynı soruların hem imzalı listeye hem zincire sorulup cevapların karşılaştırılması. Kabul ya da ret cevabında tek fark bile kabul edilmez |

**3f+1 tablosu.** f = ⌊(n−1)/3⌋ (⌊ ⌋: aşağı yuvarlama). Blok üretmek için en az n − f validator çevrimiçi olmalıdır.

| Validator sayısı (n) | Dayanılan arıza (f) | Blok üretimi için en az çevrimiçi |
|---|---|---|
| 1 | 0 | 1 |
| 2 | 0 | 2 |
| 4 | 1 | 3 |
| 5 | 1 | 4 |
| 7 | 2 | 5 |
| 10 | 3 | 7 |

Test ağı bu yüzden **4 validator'la** kurulur: en küçük, bir arızaya dayanabilen ağ. Bu davranış ölçüldü: 4 validator'dan biri
durunca bloklar sürdü, ikincisi durunca durdu, yeniden başlatılınca devam etti (§ Arıza denemesi).

**Oylama eşiği.** QBFT'de validator eklemek ya da çıkarmak için mevcut validator'ların yarısından fazlası (⌊n/2⌋ + 1) oy verir:
4 validator'da 3 oy, 5 validator'da 3 oy. Bu, Governance'taki 2/3 oyundan ayrı bir oydur (§ Validator eklemek ve çıkarmak).

## Üç yol

| | Yol A — Windows, tek bilgisayar | Yol B — tek Linux makinede 4 validator | Yol C — gerçek sunucu düzeni |
|---|---|---|---|
| Ne için | Kontratları, izin listesini ve oylamayı ilk kez görmek | Çok düğümlü ağın tamamını uçtan uca denemek | Test sunucularına kurulumu denemek |
| Düğüm sayısı | 1 (izinsiz) ya da 2 (izinli kip) | 4 validator + 1 ek düğüm, hepsi `127.0.0.1` | Sunucu başına 1 düğüm |
| Betik | `scripts/besu-dev.ps1` (`npm run chain:besu:*`) | `network/testnet/*.sh` (süreç kipi) | `network/testnet/*.sh` + `besu@.service` (systemd kipi) |
| Anahtar | Yerelde üretilen (tek düğüm) ya da Hardhat test hesapları | Hardhat test hesapları (`--keys dev`) | Yeni üretilen (`--keys generate`), anahtar haritasıyla |
| Denendiği ortam | Windows 11, PowerShell 5.1 | Ubuntu 24.04 (GitHub Actions, her hafta) | Ubuntu 24.04 (GitHub Actions: tek validator'lı `systemd` işi; üretilmiş anahtarlı 4 validator, `staging` işi) |

Hepsinin ortak noktası: aynı Besu sürümü (26.11.0), aynı Java sürümü (JDK 25), aynı genesis ayarları, aynı kontratlar ve aynı
araçlar. Yol A'dan B'ye geçmek için hiçbir şeyi baştan öğrenmeniz gerekmez.

### Gereksinimler

**Yazılım:**

| | Yol A | Yol B ve C |
|---|---|---|
| İşletim sistemi | Windows 10/11 | Linux x64 ya da aarch64 |
| Node.js | 22 ya da üstü | 22 ya da üstü |
| Komutlar | PowerShell 5.1, Git | `bash curl jq unzip tar ss openssl sha256sum setsid pgrep`; RPC korumasını denemek için `nginx` |
| Java ve Besu | betik indirir | betik indirir |

Java ve Besu'yu elle kurmanız gerekmez: betikler **Temurin JDK 25** ile **Besu 26.11.0**'ı resmi yayın sayfalarından indirir,
sha256 özetini depodaki sabit değerle karşılaştırır (uyuşmazsa dosyayı siler ve durur) ve açar. Docker gerekmez.

**Donanım (ölçülmüş).** Yol B'nin GitHub Actions'taki çalışması (Ubuntu 24.04, 4 CPU, 16 GB bellek; 4 validator + 1 ek düğüm aynı
makinede; düğüm başına Java yığını `-Xmx768m`):

| Ölçüm | Değer |
|---|---|
| Bellek (düğüm başına, RSS) | 505–568 MiB |
| İşlemci (düğüm başına, bütün çalışma boyunca) | 10–37 sn işlemci zamanı; boşta blok üretirken çok düşük |
| Disk (düğüm başına) | 74–76 MiB (404 blokta) |
| Düğümün açılması | JSON-RPC 2–3 sn içinde yanıt veriyor |
| Uçtan uca sınamanın tamamı | 921 sn (bunun 616 sn'si 111 işlemlik yeniden oynatma) |

Planlama için (ölçümden çıkarım): düğüm başına yaklaşık 0,6 GB bellek ayırın; Yol B'nin 5 düğümü birlikte yaklaşık 3 GB tutar,
üstüne işletim sistemi ve Node.js araçları eklenir. Yol C'de systemd birimi `-Xmx1g` kullanır. Gerçek ağın sunucu önerisi ayrıdır: [[GUIDE-0015]] §1.

## Yol A — Windows'ta tek bilgisayar

Bütün komutlar depo kökünden, PowerShell'de. Önce depoyu ve paketleri hazırlayın:

```powershell
git clone https://github.com/tamga-network/tamga-network; cd tamga-network
npm install
npm run setup                 # yerel PKI + imzalı yerel listeler (apps/trust-publisher/dist) — çapalama bunları kullanır
npm run contracts:install     # kontratların bağımlılıkları (contracts/)
npm run contracts:compile
```

### A1. Tek düğümlü ağ (izinsiz)

```powershell
npm run chain:besu:init     # JDK 25 + Besu indirir (tools/), genesis ve validator anahtarı üretir (network/dev/)
npm run chain:besu:start    # düğümü başlatır: RPC 127.0.0.1:8546, P2P 127.0.0.1:30313; ilk bloğu bekler
npm run chain:besu:status   # chainId, blok numarası, validator'lar
npm run chain:besu:deploy   # kontratları dağıtır → contracts/deployments/besuDev.json
npm run chain:besu:stop     # durdurur (zincir verisi kalır)
npm run chain:besu:reset    # durdurur ve zincir verisini siler; genesis ve anahtar kalır
```

`init` ne yapar:
1. JDK 25 ve Besu'yu `tools/_dl/` klasörüne indirir, sha256'yı denetler, `tools/jdk-25` ve `tools/besu-26.11.0` olarak açar.
2. Besu'nun kendi aracıyla (`besu operator generate-blockchain-config`) tek bir validator anahtarı ve genesis üretir:
   `network/dev/keys/key` (özel anahtar; bu bilgisayarda üretilir, depoya girmez) ve `network/dev/genesis.json`.
3. Var olanı ezmez: yeniden üretmek için `network/dev/genesis.json` ile `network/dev/keys/` silinir.

`start` düğümü arka planda başlatır ve blok numarası artmaya başlayınca döner. Günlük `network/dev/data/besu.log`'dadır. Bu tek
düğüm kendi kendine blok üretir (1 validator, f = 0); kontratları, çapalamayı ve yeniden oynatmayı denemek için yeterlidir.

Port 8545 bilerek kullanılmaz (Hardhat'in yerel düğümüne ayrılmıştır); Besu 8546'dadır.

### A2. İki düğümlü izinli ağ

İzin listesini ve validator oylamasını görmek için ayrı bir yerel ağ (`network/dev/perm/`). İki düğümün anahtarları Hardhat'in
herkesçe bilinen test hesapları #1 (TR) ve #2'dir (KZ); böylece validator adresi, Governance'taki validator adresi ve enode
adresi aynı olur — gerçek ağdaki eşleşme kuralı ([[ADR-0052]] K2) gerçek biçimiyle denenir.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Init -Permissioned           # genesis, iki anahtar, iki düğüm bildirimi
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Start -Permissioned          # düğüm 1: RPC 8546, P2P 30313
npm run chain:besu:deploy                                                                              # kontratlar
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Apply -Permissioned          # izin listesi zincirden
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Start -Permissioned -Node 2  # düğüm 2: RPC 8547, P2P 30314
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Apply -Permissioned          # iki düğümde de yeniden
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts accounts      # izinsiz hesap reddedilir, delege yazar
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-add      # düğüm 2 validator olur
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-remove   # ve çıkarılır
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Status -Permissioned
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Stop -Permissioned
```

| Adım | Ne olur |
|---|---|
| `-Init -Permissioned` | Genesis'te tek kurucu validator (düğüm 1); iki düğüm anahtarı; iki düğüm bildirimi (`network/dev/perm/nodes/`) |
| `-Start -Permissioned` | Düğüm 1 **başlangıç izin dosyasıyla** açılır: kontratlar henüz yokken listede düğüm 1 ve yerel dağıtımın hesapları (#0–#4) vardır |
| `-Apply -Permissioned` | Çalışan her düğüm için izin listesini zincirden üretir, düğüme yükletir ve denetler; iki düğüm çalışıyorsa her biri önce senkron olana dek beklenir (`-SyncTimeout <sn>`, varsayılan 180) |
| `-Start … -Node 2` | Düğüm 2 tam düğüm olarak açılır, düğüm 1'e statik eş olarak bağlanır |
| `accounts` | İzin listesinde olmayan hesabın (#9) işlemi düğümde reddedilir ("Sender account not authorized to send transactions"); listedeki devlet delegesinin (#3) işlemi bloğa girer |
| `vote-add` / `vote-remove` | Düğüm 2 QBFT oyuyla validator kümesine girer ve çıkar (2 validator'da çoğunluk 2 oydur) |

Tek düğümlü ağ ile izinli kip **aynı anda çalışmaz** (aynı portlar).

## Yol B — tek Linux makinede 4 validator

Bütün komutlar depo kökünden. Betiklerin ayrıntılı açıklaması depoda `network/testnet/README.md`'dedir.

### B1. Hazırlık

```bash
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm ci && npm run setup && npm run contracts:install && npm run contracts:compile
```

### B2. Java ve Besu'yu kurmak

```bash
bash network/testnet/install-besu.sh       # → tools/jdk-25, tools/besu-26.11.0, tools/besu (bağlantı)
```

Betik işlemci mimarisine göre (x64 ya da aarch64) doğru JDK arşivini seçer, indirir, sha256'yı denetler, açar ve sonunda
`java -version` ile `besu --version` çıktısını denetler. Var olanı yeniden indirmez. Seçenekler: `--prefix <klasör>` (başka bir
yere kur), `--cache <klasör>` (indirme önbelleği), `--system` (Yol C).

::: warning JAVA_HOME tuzağı
Betikler genel `JAVA_HOME` değişkenini **kullanmaz**; JDK'yı `TESTNET_JAVA_HOME`'dan (varsayılan `tools/jdk-25`) alır. Nedeni
GitHub Actions'ta bulundu: oradaki makinelerde (ve birçok sunucuda) `JAVA_HOME` daha eski bir JDK'yı (17) gösterir; Besu 26.x
ise Java 25 ister ve eski JDK ile açılmaz. Kendi kurduğunuz bir JDK 25'i kullanmak için: `--java-home <klasör>` ya da
`TESTNET_JAVA_HOME=<klasör>`.
:::

### B3. Ağı oluşturmak

```bash
bash network/testnet/make-network.sh       # varsayılan: 4 validator + 1 ek düğüm → network/testnet/run/
```

| Seçenek | Varsayılan | Ne |
|---|---|---|
| `--validators N` | 4 | Genesis'teki validator sayısı |
| `--extra E` | 1 | Tam düğüm olarak başlayan, sonra oyla validator yapılabilecek ek düğüm sayısı |
| `--keys dev\|generate` | `dev` | `dev`: Hardhat'in herkesçe bilinen test hesapları #1 #2 #6 #7 #8 (en çok 5 düğüm). `generate`: yeni rastgele anahtarlar |
| `--chain-id` | 31338 | Zincir kimliği (uçtan uca sınama yalnız 31338 ile çalışır; `--keys generate` ile varsayılan 31339) |
| `--block-period` | 2 | Blok süresi (saniye) |
| `--hosts "ip1 ip2 …"` | — | Sunucu başına bir düğüm (Yol C) |
| `--dir`, `--besu-home`, `--java-home` | `network/testnet/run`, `tools/besu`, `tools/jdk-25` | Klasörler |
| `--force` | — | Var olan ağı (verisiyle birlikte) siler ve yeniden yazar; çalışan düğüm varsa reddeder |

**Anahtarlar ve genesis nasıl üretilir.** `--keys dev` ile her düğümün anahtarı sabit bir test hesabıdır; `--keys generate` ile
Besu'nun aracı (`besu operator generate-blockchain-config`) yeni anahtarlar üretir. Sonra ilk N düğümün adresi Besu'nun RLP
aracıyla (`besu rlp encode --type=QBFT_EXTRA_DATA`) genesis'in `extraData` alanına yazılır: genesis'teki validator kümesi budur.
Ek düğümler genesis'te validator değildir; oyla eklenirler.

Test devletleri: düğüm 1 `TR`, düğüm 2 `KZ` (yerel dağıtım betiğinin iki kurucusu), düğüm 3–5 `XA`, `XB`, `XC`. `XA`… ISO 3166'nın
kullanıcıya bırakılmış kodlarıdır; hiçbir gerçek devleti göstermez.

**Yazılan dosyalar** (`network/testnet/run/`, depoya girmez):

| Dosya | Ne |
|---|---|
| `genesis.json` | Bütün düğümlerin ortak genesis'i |
| `network.env` | Ağ ayarları (validator sayısı, portlar, Java ve Besu yolu); öteki betikler bunu okur |
| `declarations/<cc>-node<n>.json` | Her düğümün bildirimi (`tamga-node-declaration/1`: devlet, rol, açık anahtar, IP, P2P portu, görev iletişim adresi) |
| `node<n>/key` | Düğümün özel anahtarı (izin `600`) |
| `node<n>/key.pub`, `node<n>/address` | Açık anahtar (enode kimliği) ve ondan türeyen adres (validator adresi) |
| `node<n>/state` | Düğümün test devlet kodu |
| `node<n>/static-nodes.json` | Bağlanılacak eşler: kendisi dışındaki genesis validator'larının enode'ları |
| `node<n>/permissions_config.toml` | Başlangıç izin dosyası: genesis validator'larının düğümleri ve hesapları + yerel dağıtımın hesapları (dağıtıcı #0, TR ve KZ delegeleri #3, #4). Kontratlar kurulunca zincirden üretilen dosyayla değiştirilir |
| `node<n>/besu.toml` | Düğümün bütün ayarları (aşağıda) |

**Genesis alanları:**

| Alan | Değer | Anlamı |
|---|---|---|
| `config.chainId` | 31338 | Zincir kimliği |
| `config.berlinBlock`, `londonBlock`, `shanghaiTime` | 0 | Ethereum kural sürümleri ilk bloktan açık (kontratlar `shanghai` hedefiyle derlenir) |
| `config.zeroBaseFee` | `true` | İşlem ücreti yok (izinli ağ; kimse ücretle yer satın almaz) |
| `config.qbft.blockperiodseconds` | 2 | İki blok arası süre |
| `config.qbft.epochlength` | 30000 | Bekleyen oyların sıfırlandığı blok aralığı |
| `config.qbft.requesttimeoutseconds` | 4 | Bir turda öneri gelmezse yeni tura geçme süresi (blok süresinin iki katı) |
| `gasLimit` | `0x1fffffffffffff` | Blok başına işlem kapasitesi sınırı (yüksek) |
| `difficulty`, `mixHash`, `nonce`, `coinbase` | sabit | QBFT'nin beklediği sabit değerler (madencilik yok) |
| `alloc` | 10 test hesabı | Hardhat test hesaplarına başlangıç bakiyesi (yalnız test) |
| `extraData` | RLP | Genesis validator'larının adresleri |

**`besu.toml` alanları** (her düğümde; değerler düğüm 1 için):

| Alan | Değer | Anlamı |
|---|---|---|
| `data-path` | `run/node1/db` | Zincir verisinin klasörü |
| `genesis-file` | `run/genesis.json` | Ortak genesis |
| `node-private-key-file` | `run/node1/key` | Düğüm anahtarı (validator adresi buradan türer) |
| `sync-mode` | `FULL` | Bütün blokları baştan doğrulayarak eşitlen |
| `p2p-host` | `127.0.0.1` | Öteki düğümlere **ilan edilen** adres (enode'daki adres) |
| `p2p-interface` | `127.0.0.1` | P2P'nin **dinlediği** arayüz. Verilmezse Besu `0.0.0.0`'da (bütün arayüzlerde) dinler; `p2p-host` bunu değiştirmez |
| `p2p-port` | 30313 | P2P portu |
| `discovery-enabled` | `false` | Eş keşfi kapalı; eşler yalnız statik listeden |
| `static-nodes-file` | `run/node1/static-nodes.json` | Statik eşler |
| `rpc-http-enabled` | `true` | JSON-RPC açık |
| `rpc-http-host` | `127.0.0.1` | JSON-RPC yalnız bu makineden |
| `rpc-http-port` | 8546 | JSON-RPC portu |
| `rpc-http-api` | `ETH, NET, WEB3, QBFT, PERM, ADMIN` | Açık yöntem grupları; `QBFT` oy için, `PERM` izin listesini yüklemek için, `ADMIN` eşleri görmek için — hepsi yalnız `127.0.0.1`'de |
| `host-allowlist` | `localhost`, `127.0.0.1` | JSON-RPC'ye yalnız bu `Host` başlıklarıyla gelinebilir |
| `metrics-enabled` | `false` | Metrik ucu kapalı (gerçek düğümde yalnız yerel arayüzde açılır, [[GUIDE-0015]] §8) |
| `min-gas-price` | 0 | Ücretsiz işlemler kabul |
| `color-enabled` | `false` | Günlükte renk kodu yok |
| `permissions-nodes-config-file-enabled` | `true` | Düğüm izin listesi açık |
| `permissions-accounts-config-file-enabled` | `true` | Hesap izin listesi açık |
| `permissions-nodes-config-file`, `permissions-accounts-config-file` | `run/node1/permissions_config.toml` | İki liste aynı dosyada |

### B4. Başlatmak, durdurmak, durumu görmek

```bash
bash network/testnet/node.sh start all        # ya da: start 1, start 2 …
bash network/testnet/node.sh status all
bash network/testnet/node.sh logs 1           # son 100 satır
bash network/testnet/node.sh stop all
```

`start` düğümü arka planda başlatır (süreç kimliği `node<n>/besu.pid`, günlük `node<n>/besu.log`) ve JSON-RPC yanıt verene dek
bekler (`TESTNET_START_TIMEOUT`, varsayılan 120 sn). Port doluysa başlatmaz. `stop` önce SIGTERM gönderir (Besu veritabanını
düzgün kapatır), 60 sn içinde durmazsa SIGKILL. Java yığını `TESTNET_HEAP` ile değişir (varsayılan `768m`).

`status` her düğüm için tek satır basar: devlet kodu, adres, çalışıyor mu, RPC adresi, blok numarası, eş sayısı, validator sayısı.

| Düğüm | JSON-RPC | P2P | Rol |
|---|---|---|---|
| 1 | 127.0.0.1:8546 | 127.0.0.1:30313 | genesis validator'ı (TR) |
| 2 | 127.0.0.1:8547 | 127.0.0.1:30314 | genesis validator'ı (KZ) |
| 3 | 127.0.0.1:8548 | 127.0.0.1:30315 | genesis validator'ı (XA) |
| 4 | 127.0.0.1:8549 | 127.0.0.1:30316 | genesis validator'ı (XB) |
| 5 | 127.0.0.1:8550 | 127.0.0.1:30317 | ek düğüm (XC); oyla validator yapılır |

Kural: düğüm n'nin RPC portu 8545 + n, P2P portu 30312 + n. Bu ağ ile Windows'taki yerel ağ aynı zincir kimliğini ve aynı dağıtım
dosyasını kullanır: aynı makinede ikisini birlikte çalıştırmayın.

### B5. Tek komutla uçtan uca sınama

Aşağıdaki bölümlerdeki adımların hepsini sırayla yapan, her birini denetleyen ve sonunda özet yazan betik:

```bash
bash network/testnet/deploy-and-wire.sh            # düğümleri başlatır, sınar, sonunda durdurur
bash network/testnet/deploy-and-wire.sh --keep     # sonunda düğümleri çalışır bırakır (elle denemeye devam etmek için)
```

| # | Adım | Ölçülen sonuç (GitHub Actions) |
|---|---|---|
| 1 | 4 validator başlar, her biri öteki 3'üyle eşleşir; JSON-RPC ve P2P yalnız `127.0.0.1`'de | 4 validator, her düğümde 3 eş; 8 dinleyen soket, hepsi `127.0.0.1` |
| 2 | Kontratlar dağıtılır (kurucular TR, KZ) | 10 kontrat |
| 3 | İmzalı liste arşivi kontratlara yeniden oynatılır; eşdeğerlik testi | 111 işlem; 557 soru, 0 karar farkı |
| 4 | Listeler çapalanır (`trust:chain-submit`), her liste denetlenir (`trust:chain-check`) | 3 yazım; 2 liste için YES |
| 5 | Öteki genesis validator'larının devletleri (XA, XB) Governance'a 2/3 oyla kabul edilir | 4 üye |
| 6 | Her düğüm izin listesini **kendi düğümünden** üretir, yükler, denetler; paylaşılan özetler aynı; izinsiz hesap reddedilir | 7 hesap, 4 düğüm, 4 düğümde aynı özet; #9 reddedildi, #3 yazdı |
| 7 | Düğüm 5 kabul edilir, izin listesine girer, eşitlenir, oyla validator olur (blok önerir), oyla çıkarılır | 4'ün 3 oyuyla 9 sn'de 5 validator, düğüm 5 blok önerdi; 5'in 3 oyuyla 10 sn'de yeniden 4 |
| 8 | Bir validator durunca bloklar sürer; ikincisi durunca durur; yeniden başlatılınca devam eder | 1 durdu → sürdü; 2 durdu → 20 sn blok yok; yeniden başlatma → 66 sn'de devam |
| 9 | RPC koruması (yöntem süzgeci + nginx karşılıklı TLS) | 32 denetim geçti, nginx mTLS sınandı |
| 10 | Özet | `run/summary.md`, `run/summary.json` |

Herhangi bir adım beklenen sonucu vermezse betik durur, son günlük satırlarını basar ve özete hangi adımda kaldığını yazar.

## Yol C — gerçek sunucu düzeni (systemd)

Test sunucularına kurulum: her sunucuda bir düğüm, düğüm sistem hizmeti olarak çalışır.

### C1. Her sunucuda: Java, Besu ve hizmet kullanıcısı

```bash
sudo bash network/testnet/install-besu.sh --system
```

`--system` ile:
- JDK ve Besu `/opt/tamga-besu/` altına kurulur ve **root'a ait** olur (hizmet kullanıcısı programları değiştiremez);
- `besu` adlı bir sistem kullanıcısı açılır (kabuğu yok, oturum açamaz);
- düğüm verisi için `/var/lib/tamga-besu` (sahibi `besu`, izin `0750`) hazırlanır.

### C2. Bir makinede: ağ dosyaları

```bash
sudo bash network/testnet/make-network.sh --dir /var/lib/tamga-besu --besu-home /opt/tamga-besu/besu \
     --java-home /opt/tamga-besu/jdk-25 --keys generate --hosts "192.0.2.10 192.0.2.11 192.0.2.12 192.0.2.13" --extra 0
```

- `--keys generate`: anahtarlar yenidir, herkesçe bilinen test anahtarları değildir.
- `--hosts`: her düğüme bir IP (sırasıyla düğüm 1, 2, …). Bu kipte her düğümde P2P o IP'de, port 30303; JSON-RPC
  `127.0.0.1:8545`. Adres sunucunun ağ arayüzünde doğrudan bulunmalıdır; bulutta iç ve dış adres farklıysa `besu.toml`'da
  `p2p-interface` iç adres, `p2p-host` dış adres olacak biçimde düzeltilir.
- `192.0.2.x` belgelerde kullanılan örnek adreslerdir; kendi adreslerinizi yazın.

Betik bütün anahtarları tek makinede yazar. Sonra her sunucuya **yalnız kendi** klasörü kopyalanır: `genesis.json`,
`network.env` ve `node<n>/` (`/var/lib/tamga-besu/` altına aynı yollarla). Öteki düğümlerin `key` dosyası o sunucuya gitmez.
Gerçek ağda bu adım farklıdır: her işletmeci anahtarını **kendi donanımında** üretir ve yalnız açık anahtarını paylaşır
([[GUIDE-0015]] §3).

### C3. Her sunucuda: hizmet

```bash
sudo chown -R besu:besu /var/lib/tamga-besu
sudo install -m 0644 network/testnet/besu@.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now besu@node1                      # sunucu 1'de; sunucu 2'de besu@node2, …
sudo TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd bash network/testnet/node.sh status 1
journalctl -u besu@node1 -n 100 --no-pager                  # günlük
```

`besu@.service` bir şablondur: `besu@node1` örneği `/var/lib/tamga-besu/node1/besu.toml` ile çalışır. Birim:

| Ayar | Ne sağlar |
|---|---|
| `User=besu`, `UMask=0077` | Düğüm yetkisiz kullanıcıyla çalışır; yazdığı dosyaları yalnız o okur |
| `ReadWritePaths=/var/lib/tamga-besu/%i`, `ProtectSystem=strict`, `ProtectHome=true` | Yalnız kendi veri klasörüne yazabilir; sistemin geri kalanı salt okunur |
| `NoNewPrivileges`, boş `CapabilityBoundingSet`, `SystemCallFilter=@system-service` | Yetki yükseltme yok, ayrıcalık yok, yalnız olağan sistem çağrıları |
| `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK` | Yalnız ağ ve yerel soketler |
| `KillSignal=SIGTERM`, `TimeoutStopSec=120` | Besu veritabanını kapatmaya zaman bulur |
| `Restart=on-failure` | Düşerse 10 sn sonra yeniden başlar |

`MemoryDenyWriteExecute` bilerek açılmaz: Java'nın derleyicisi (JIT) yazılabilir ve çalıştırılabilir bellek ister. GitHub
Actions'taki systemd işinde (tek validator, üretilmiş anahtar) düğüm `besu` kullanıcısıyla çalıştı, 12 saniyede 6 blok üretti, iki
dinleyen soketin ikisi de `127.0.0.1`'deydi ve `systemd-analyze security` puanı **1.5 OK** çıktı (0 en sıkı, 10 en açık).

### C4. Güvenlik duvarı

| Port | Kime açık |
|---|---|
| P2P (30303/TCP) | Yalnız öteki validator'ların IP adreslerine. Keşif kapalı olduğu için UDP gerekmez |
| JSON-RPC (8545) | Dışarıya kapalı; düğüm zaten yalnız `127.0.0.1`'de dinler. Dış istemciler yalnız RPC vekili üzerinden (§ RPC koruması) |
| RPC vekili (8443/TCP, isteğe bağlı) | Yalnız istemci sertifikası verilmiş istemcilere |

Örnek (ufw, sunucu 1'de):

```bash
sudo ufw default deny incoming
sudo ufw allow from 192.0.2.11 to any port 30303 proto tcp
sudo ufw allow from 192.0.2.12 to any port 30303 proto tcp
sudo ufw allow from 192.0.2.13 to any port 30303 proto tcp
```

Yönetim erişiminiz (SSH) için kuralı bunlardan **önce** ekleyin. Birimde ek bir katman olarak `IPAddressDeny=any` ve
`IPAddressAllow=localhost <eşlerin adresleri>` satırları hazır, yorum olarak durur.

### C5. Üretilmiş anahtarlarla kontratlar ve Governance

`--keys generate` ile `make-network.sh` düğüm anahtarlarının yanına bir **anahtar haritası** da yazar: `keys/keys.json` ve her rol
için yeni üretilmiş, kendi dosyasında (izin `0600`) bir anahtar: dağıtan, göç yürütücüsü, iki liste çapası yazıcısı ve her devlet
için bir delege; devletin validator anahtarı düğüm anahtarıdır. Zincir kimliği **31339**'dur: depodaki araçlar bu kimliği ne yerel
zincir (herkesçe bilinen test anahtarı yok, sandbox seti yok) ne de gerçek ağ sayar.

::: warning Yalnız test ve hazırlık ağları için
Gerçek ağda bütün anahtarlar kimsede değildir: her devlet validator anahtarını kendi donanımında üretir, imza anahtarlarını HSM'de
tutar ([[GUIDE-0015]] §3). Anahtar haritası, test ağında bütün devletleri tek kişi oynadığı için vardır. Onu okuyan her araç;
`purpose` `test` değilse, zincir kimliği 31339 değilse ya da bir anahtar dosyası `0600` değilse veya kendi adresine ait değilse
haritayı reddeder.
:::

`make-network.sh`'i çalıştıran makinede (sunucu başına bir düğümde: çıktının tamamı hâlâ üzerinde duran 1. sunucu):

```bash
sudo env "PATH=$PATH" TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd \
     bash network/testnet/bootstrap-governance.sh --nodes 1
```

Bütün düğümler tek makinedeyse `--nodes` olmadan; süreç kipinde `sudo` ve `TESTNET_*` değişkenleri olmadan:

```bash
bash network/testnet/make-network.sh --keys generate
bash network/testnet/node.sh start all
bash network/testnet/bootstrap-governance.sh
```

Betik adım adım; her adım günlüğe yazılır, yeniden çalıştırma yapılmış olanı atlar:

| Adım | Ne olur |
|---|---|
| 1. Ağ | Düğümler yanıt verir, bloklar artar, QBFT kümesinde 4 validator vardır. 31339 dışındaki zincir kimliği reddedilir |
| 2. Kontratlar | `contracts/scripts/deploy-network.ts` (Hardhat ağı `besuStaging`): kurucular TR ve KZ ile delegeleri; kurucular arası tanıma Governance oyuyla (`proposeFounderRecognition`, [[ADR-0055]] K3); liste çapası kaydının yöneticisi Governance kontratı, 2 yazıcı, eşik 2. Adresler: `deployment.json` |
| 3. Governance | XA ve XB 2/3 oyla kabul edilir; her devlet delegesini kendi validator'ıyla atar |
| 4. İzin listesi | Her düğümde zincirden üretilir, yüklenir ve denetlenir; `shared_sha256` aynı; dağıtan listeden düşer; listede olmayan rastgele bir anahtar reddedilir, delegenin işlemi bloğa girer |
| 5. Çapa | İlk yazıcıyla `trust:chain-submit`, ikincisi onaylar; `trust:chain-check` her liste için YES cevabı verir |
| 6. Yeniden oynatma | Göç penceresi oyla açılır; izin listesi yeniden üretilir ve artık pencerenin yürütücüsünü içerir; örnek arşiv anahtar haritasıyla yeniden oynatılır; eşdeğerlik testi. `--no-replay` bu adımı atlar |
| 7. Özet | Ağ klasöründe `bootstrap-summary.md` ve `.json` |

Sonra öteki her sunucuda, kendi düğümünün izin listesi. Önce `deployment.json` dosyasını ve `nodes/` klasörünü 1. sunucudan
kopyalayın; anahtar gerekmez:

```bash
sudo env "PATH=$PATH" TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd \
     bash network/testnet/bootstrap-governance.sh --only permissions --nodes 2
```

| Değişken | Ne |
|---|---|
| `TAMGA_CHAIN_KEYS` | Anahtar haritası (varsayılan: ağ klasöründe `keys/keys.json`) |
| `TAMGA_CHAIN_DEPLOYMENT` | Dağıtım dosyası (betik ayarlar: ağ klasöründe `deployment.json`) |

GitHub'daki `staging` işi bu adımları systemd altında 4 validator'la baştan çalıştırır (§ GitHub'da otomatik sınama).

## Kontratları dağıtmak

Kontratlar bir kez, ağın herhangi bir validator'ına dağıtılır; bloklar bütün düğümlere yayılır.

```bash
npm run chain:besu:deploy                                          # Yol A ve B: 127.0.0.1:8546'ya
TAMGA_BESU_RPC=http://127.0.0.1:8547 npm run chain:besu:deploy     # başka bir düğüme
```

Dağıtım betiği (`contracts/scripts/deploy-dev.ts`) Tamga'nın kontratlarını kurar, Governance'a iki kurucu devleti (TR ve KZ;
validator'ları Hardhat hesapları #1 ve #2, delegeleri #3 ve #4) yazar ve adresleri `contracts/deployments/besuDev.json`'a kaydeder.
Liste çapası kaydının adresi bu dosyada `anchor.registry` alanındadır. Besu bir işlemi ancak bir sonraki blokta (2 sn) işler;
betik her adımda bloğu bekler.

Yol C'de kontratlar üretilmiş anahtarlarla `contracts/scripts/deploy-network.ts` ile dağıtılır (`bootstrap-governance.sh`
2. adım, § C5); orada Hardhat test hesapları kullanılmaz.

Kontratların kaynak kodu, testleri ve şartnamesi depodadır (`contracts/`, Hardhat; Solidity).

## İzin listesini zincirden üretmek ve uygulamak

İzin listesi **elle yazılmaz** ([[ADR-0052]] LP2): her işletmeci onu zincirdeki kontrat durumundan, aynı araçla kendisi üretir.
Böylece bütün validator'ların listesi aynı olur ve bir hesabı listeye eklemenin tek yolu zincirdeki yönetişim işlemidir.

| Liste | Kaynağı |
|---|---|
| Hesaplar | Governance'taki aktif üyelerin validator adresleri ve delegeleri, çalışır kurumların delegeleri, liste çapası yazıcıları, açık bir göç penceresinin yürütücüsü |
| Düğümler | Bildirimi (`declarations/…json`) Governance'taki aktif validator adresiyle eşleşen düğümler |

**Önce bütün validator'lar Governance'ta olmalı.** Yerel dağıtım yalnız TR ve KZ'yi kurar; XA ve XB'nin validator'ları (düğüm 3
ve 4) Governance'ta yokken liste zincirden üretilirse o iki düğüm listeden düşer ve 4 validator'ın 2'si koptuğu için zincir
durur. Yol B'de önce iki devleti kabul edin (önerme → oylar → yürütme; yalnız test ağında, test anahtarlarıyla):

```bash
DEP=contracts/deployments/besuDev.json
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XA --validator-index 6 --voters 1,2
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XB --validator-index 7 --voters 1,2,6
mkdir -p network/testnet/run/nodes
cp network/testnet/run/declarations/{tr-node1,kz-node2,xa-node3,xb-node4}.json network/testnet/run/nodes/
```

Sonra her düğümde: üret → kopyala → yükle → denetle.

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

- `render` her düğümün **kendi** JSON-RPC'sinden okur ve bir rapor basar: blok, hesap ve düğüm sayısı, `sha256` (dosyanın özeti)
  ve `shared_sha256` (işletmecinin kendi okuma düğümleri hariç özet). **Bütün validator'larda `shared_sha256` aynı olmalıdır**
  (LP3). Düğüm henüz eşitlenmemişse eski bir blokta çizer ve özet farklı çıkar: önce eşitlenmesini bekleyin.
- `perm_reloadPermissionsFromFile` düğüme dosyayı yeniden okutur; düğüm yeniden başlatılmaz.
- Besu dosyayı yüklerken kendi biçimiyle yeniden yazar (yorumlar gider). Bu yüzden çizim `permissions_config.rendered.toml`'da
  kalır ve `check` dosyayı düğümün belleğindeki listeyle **anlamca** karşılaştırır.
- Çıkış kodu 3: bir bildirim reddedildi (açık anahtardan türeyen adres Governance'taki validator adresi değil) ya da `check` fark
  buldu.

Hesap izninin çalıştığını görmek için:

```bash
node network/testnet/testnet.mjs accounts --rpc http://127.0.0.1:8546   # #9 reddedilir, #3 bloğa girer
```

Yol A'da bütün bu adımları `besu-dev.ps1 -Apply -Permissioned` yapar.

## Listeleri zincire çapalamak

Zincirsiz sistemin imzalı listelerinin (`lotl.jws`, `tl-<cc>.jws`) ve çapa günlüğünün özetini zincirdeki liste çapası kaydına
yazmak. Test ağında çapalanan, `npm run setup`'ın ürettiği **yerel** listelerdir (`apps/trust-publisher/dist/`); canlı sistemin
listelerine dokunulmaz.

```bash
export TAMGA_CHAIN_ENABLED=1
export TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546
export TAMGA_CHAIN_ANCHOR_REGISTRY=$(jq -r .anchor.registry contracts/deployments/besuDev.json)
# Hardhat test hesabı #0 — herkesçe bilinen test anahtarı, yalnız test ağı
export TAMGA_CHAIN_ANCHORER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
npm run trust:chain-submit -- --dry-run                                  # planı basar, yazmaz
npm run trust:chain-submit                                               # özetleri yazar
npm run trust:chain-check -- apps/trust-publisher/dist/lotl.jws          # YES / NO / UNKNOWN
npm run trust:chain-check -- apps/trust-publisher/dist/tl-tr.jws
```

PowerShell'de (Yol A) aynı değişkenler `$env:TAMGA_CHAIN_ENABLED = "1"` biçiminde verilir; kayıt adresi:
`(Get-Content contracts\deployments\besuDev.json -Raw | ConvertFrom-Json).anchor.registry`.

| Değişken | Ne |
|---|---|
| `TAMGA_CHAIN_ENABLED` | `1` olmadan zincire bağlanılmaz ve hiçbir şey yazılmaz (varsayılan `0`, canlı sistemde de `0`) |
| `TAMGA_CHAIN_RPC_URL` | Düğümün JSON-RPC adresi |
| `TAMGA_CHAIN_ANCHOR_REGISTRY` | Liste çapası kaydının adresi |
| `TAMGA_CHAIN_ANCHORER_KEY` | Yazıcı anahtarı (yalnız `chain-submit`) |

- Sağlıksız bir set (imza ya da sürüm zinciri bozuk) çapalanmaz.
- Aynı sürüm aynı özetle ikinci kez yazılmaz (`SKIP`); farklı özet `CONFLICT` verir, yazılmaz ve komut hata koduyla biter.
- `chain-check` cevapları: **YES** (özet zincirde onaylı), **NO** (zincirde farklı bir özet onaylı: çift konuşma işareti),
  **UNKNOWN** (zincir kapalı, erişilemez ya da eşik dolmadı). Bu denetim doğrulama sonucunu hiçbir zaman kötüleştirmez.
- Yol A ve B'de yazıcı eşiği 1, Yol C'de 2'dir (iki yazıcı); gerçek ağda en az 2 bağımsız yazıcı aynı özeti göndermeden çapa onaylanmaz ([[ADR-0051]] CH3).

Kurumların iptal listesi çapaları da zincirdeki liste kaydına girer; bunun için çapa satırı listenin bit sayısını ve boyutunu
taşır (`trust:anchor --token <belirteç dosyası>`, [[SPEC-TRUST-0001]] §5).

Bayrak açıkken çapa günlüğüne kayıt sertifikası durum listesi ve liste görünümü satırları (`registration_status`, `list_view`)
da yazılır. Test ağında sorun yoktur; gerçek ağda zincir ancak listeyi okuyan bütün tüketicilerin yükleyicisi en az
`@tamga-network/trust` **0.8.1** olunca açılır — daha eski yükleyici bilinmeyen satır türünde durur (2026-11-05).

## Geçmişi aktarmak ve eşdeğerlik testi

Zincir bir gün açıldığında imzalı listelerin bütün geçmişi kontratlara bir kez, listedeki tarihlerle yeniden oynatılır
(`trust:chain-replay`, [[ADR-0073]]); sonunda eşdeğerlik testi çalışır. Test ağında bunu bir örnek arşivle deneyen betik:

```bash
npx tsx apps/chain-indexer/scripts/besu-smoke.ts http://127.0.0.1:8546
```

Betik zincirin saatine göre bir örnek liste arşivi üretir, geçici bir klasöre yazar ve `trust:chain-replay`'i o klasörle çalıştırır:
arşivi doğrular (imza, sürüm zinciri, çapa zinciri), belirleyici bir oynatma planı ve onun özetini çıkarır, yerel zincirde göç
penceresini Governance oyuyla açar, işlemleri yazar, zinciri indeksler ve eşdeğerlik testini yapar. Testte aynı sorular hem
listeye hem zincire sorulur — bu kurum o tarihte geçerli miydi, bu belge türünü verebilir miydi, bu ülke o kurumu tanıyor mu, bu
liste sürümünün özeti ne — her kayıtlı an ve her sınır anı için (bir saniye önce, tam o an, bir saniye sonra).

| Çıkış kodu | Anlamı |
|---|---|
| 0 | Eşdeğer |
| 2 | Kapı ya da yapılandırma eksik |
| 3 | Eşdeğerlik farkı var: göç kapanmaz |
| 4 | Governance oyu bekleniyor |

Ölçülen sonuç (Yol B, GitHub Actions): 111 işlem 616 saniyede yazıldı; 557 soru soruldu, **0 karar farkı**. Planı zincire hiç
bağlanmadan görmek için: `npm run trust:chain-replay -- --dry-run`.

Yol B'de yeniden oynatmayı izin listesi zincirden üretilmeden **önce** çalıştırın: yerel oynatma Governance oylarını kurucuların
test anahtarlarıyla imzalar ve bu sırayı `deploy-and-wire.sh` da izler.

## Validator eklemek ve çıkarmak

Validator kümesi QBFT oyuyla değişir. Sıra önemlidir:

1. **Governance:** devlet üye olarak kabul edilir (validator adresiyle, 2/3 oy).
2. **İzin listesi:** her düğümde yeniden üretilir; yeni düğüm listeye girer.
3. **Eşitlenme:** yeni düğüm tam düğüm olarak açılır, eşleşir ve son bloğa yetişir (`eth_syncing` = `false`).
4. **QBFT oyu:** mevcut validator'ların yarısından fazlası, **kendi düğümünde**, `qbft_proposeValidatorVote(<adres>, true)` çağırır.
   Oylar bloklara girer; çoğunluk dolunca küme değişir.
5. **Oyu temizleme:** küme değişince her oy veren `qbft_discardValidatorVote(<adres>)` çağırır (bekleyen oy kalmasın).

Kısa bir yardımcı (bash):

```bash
rpc() { curl -s -H 'content-type: application/json' \
  --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":${3:-[]}}" "$1" | jq -c .result; }
```

Yol B'de düğüm 5'i (XC, adresi `0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f`) eklemek:

```bash
X=0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XC --validator-index 8 --voters 1,2,6,7
cp network/testnet/run/declarations/xc-node5.json network/testnet/run/nodes/
# yeni düğümün ilk dosyası düğüm 1 üzerinden (kendi düğümü henüz eşitlenmedi)
TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546 npm run -s trust:chain-permissions -- render --nodes network/testnet/run/nodes \
  --deployment $DEP --out network/testnet/run/node5/permissions_config.toml
# düğüm 1–4'te izin listesini yeniden üretip yükleyin (önceki bölümdeki döngü), sonra:
bash network/testnet/node.sh start 5
rpc http://127.0.0.1:8550 eth_syncing                                   # false olana dek bekleyin
# düğüm 5 eşitlenince izin listesini 5 düğümün hepsinde yeniden üretin (döngüde n = 1…5)
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_proposeValidatorVote "[\"$X\",true]"; done
rpc http://127.0.0.1:8546 qbft_getValidatorsByBlockNumber '["latest"]'  # 5 adres olunca:
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_discardValidatorVote "[\"$X\"]"; done
rpc http://127.0.0.1:8546 qbft_getSignerMetrics                          # düğüm 5'in önerdiği blok sayısı
```

Çıkarmak: 5 validator'da ⌊5/2⌋ + 1 = 3 oy, bu kez `false` ile; küme 4'e dönünce oylar temizlenir ve düğüm durdurulur.

```bash
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_proposeValidatorVote "[\"$X\",false]"; done
rpc http://127.0.0.1:8546 qbft_getValidatorsByBlockNumber '["latest"]'  # 4 adres olunca:
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_discardValidatorVote "[\"$X\"]"; done
bash network/testnet/node.sh stop 5
```

Ölçülen sonuç: ekleme 4'ün 3 oyuyla 9 saniyede tamamlandı ve düğüm 5 blok önerdi; çıkarma 5'in 3 oyuyla 10 saniyede tamamlandı.
Küme her düğümde aynı olmalıdır. Yol A'da aynı iş `besu-permissions-smoke.ts vote-add` ve `vote-remove` ile; Yol C'de oy her
sunucuda o sunucunun `127.0.0.1:8545`'ine verilir. Gerçek ağdaki adımlar ve tablo: [[GUIDE-0015]] §6 ve §10.

## Arıza denemesi

4 validator'lı ağın bir arızaya dayandığını kendiniz görün (Yol B):

```bash
bash network/testnet/node.sh stop 4
bash network/testnet/node.sh status all     # birkaç kez: blok numarası artmaya devam eder (3 validator yeter)
bash network/testnet/node.sh stop 3
bash network/testnet/node.sh status all     # blok numarası durur (2 validator yetmez)
bash network/testnet/node.sh start 3 && bash network/testnet/node.sh start 4
bash network/testnet/node.sh status all     # bloklar yeniden akar; durdurulan düğümler eksik blokları alır
```

Bloklar dururken hiçbir şey kaybolmaz: zincir yalnız ilerlemez. Yeterli validator dönünce QBFT turu yeniden başlar. Ölçülen
sonuç: iki düğüm yeniden başlatıldıktan **66 saniye** sonra bloklar devam etti (bekleme süresi QBFT'nin tur zaman aşımlarının
art arda uzamasından gelir). Durdurulan bir validator'ın verisi silinmez; açılınca kaldığı yerden eşitlenir.

## RPC koruması

Düğümün JSON-RPC ucu internete açılmaz ([[ADR-0052]] LP5). Dışarıdan okuması gereken programlar (liste yayıncısı, indeksleyici,
doğrulayıcının okuma yolu) yalnız karşılıklı TLS'li (mTLS: istemci de sertifika gösterir) bir vekilden geçer ve yalnız `eth_`,
`net_`, `web3_` yöntemlerine ulaşır:

```text
istemci --TLS 1.3 + istemci sertifikası--> nginx :8443 --> yöntem süzgeci 127.0.0.1 --> Besu 127.0.0.1
```

Test ağında bütün katmanı deneyen betik:

```bash
bash network/testnet/rpc-proxy-check.sh --upstream http://127.0.0.1:8546     # nginx yoksa: --no-nginx
```

| Denetim | Beklenen |
|---|---|
| Süzgeçten `eth_blockNumber`, `eth_chainId`, `eth_getBlockByNumber`, `net_version`, `net_peerCount`, `web3_clientVersion` | 200 |
| Süzgeçten `admin_*`, `perm_*`, `qbft_*`, `debug_*`, `txpool_*`, `eth_sendTransaction`, `eth_accounts`, `eth_sign`, `miner_start` | 403 |
| İçinde tek bir yasak çağrı olan toplu istek | 403 (tamamı) |
| nginx'e istemci sertifikası olmadan | 400 |
| nginx'e TLS 1.2 ile | bağlantı reddedilir |
| Düğümün RPC portu makinenin dış adresinde | yanıt yok |

Betik süzgeci `127.0.0.1:8555`'te çalıştırır, nginx için geçici yerel test sertifikaları üretir (`network/rpc-proxy/dev-certs/`,
depoya girmez) ve bittiğinde ikisini de kapatır. Ölçülen sonuç: 32 denetim geçti. Süzgeci elle çalıştırmak için:

```bash
TAMGA_RPC_FILTER_LISTEN=127.0.0.1:8555 TAMGA_RPC_FILTER_UPSTREAM=http://127.0.0.1:8546 node network/rpc-proxy/filter.mjs
```

Süzgecin varsayılan portu 8550'dir; Yol B'de bu port düğüm 5'in RPC portudur, o yüzden test ağında 8555 kullanılır. Gerçek
sunucudaki nginx yapılandırması ve systemd birimi örnekleri: `network/rpc-proxy/` ve [[GUIDE-0015]] §7.

## İzleme

| Ne | Nasıl | Sağlıklı |
|---|---|---|
| Blok yüksekliği | `rpc <url> eth_blockNumber` ya da `node.sh status all` | Her 2 saniyede artar; düğümler arasında en çok 1–2 blok fark |
| Eşitlenme | `rpc <url> eth_syncing` | `false` |
| Eş sayısı | `rpc <url> net_peerCount` | validator sayısı − 1 ya da fazlası |
| Validator kümesi | `rpc <url> qbft_getValidatorsByBlockNumber '["latest"]'` | Her düğümde aynı |
| Blok önerme | `rpc <url> qbft_getSignerMetrics` | Her validator'ın önerdiği blok sayısı artar |
| İzin listesi | `trust:chain-permissions check` | Çıkış 0; `shared_sha256` her validator'da aynı |
| Dinleme adresleri | `ss -ltnp` | JSON-RPC yalnız `127.0.0.1`; P2P yalnız beklenen arayüzde |
| Çapa durumu | Doğrulama servisinin `/healthz` yanıtındaki `chain` alanı | `anchored`: `YES` |

**`/healthz` `chain` alanı.** Doğrulama servisi (`apps/verify`) yüklediği listelerin zincirde onaylı çapalanıp çapalanmadığını
sağlık sayfasında gösterir. Bayrak kapalıyken (canlı sistemde bugün olduğu gibi) cevap `UNKNOWN`'dur ve zincire bağlanılmaz. Test
ağında denemek için servisi çapalama bölümündeki değişkenlerle başlatın (yazıcı anahtarı gerekmez):

```bash
TAMGA_CHAIN_ENABLED=1 TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546 \
  TAMGA_CHAIN_ANCHOR_REGISTRY=$(jq -r .anchor.registry contracts/deployments/besuDev.json) npm run verify
curl -s http://localhost:4004/healthz | jq .chain     # enabled, anchored (YES/NO/UNKNOWN), reason, lists[]
```

Bu alan bilgi içindir: doğrulama sonucunu ve `ok` alanını hiçbir zaman değiştirmez; `NO` yalnız bir alarmdır ([[ADR-0051]] CH1).

Bir düğümün katılımını tek tek denetlemenin (eşitlenme, izin listesi, küme, RPC, saat) gerçek ağdaki listesi: [[GUIDE-0015]] §8;
katılım aracı `tamga-onboard node check` aynı denetimleri yalnız okuyarak yapar.

## Sıfırlama ve temizlik

| Ne | Yol A | Yol B | Yol C |
|---|---|---|---|
| Durdurmak | `npm run chain:besu:stop` · izinli: `-Stop -Permissioned` | `node.sh stop all` | `sudo systemctl stop besu@node<n>` |
| Zincir verisini silmek (ayarlar kalır) | `npm run chain:besu:reset` · izinli: `-Reset -Permissioned` (izin dosyaları da gider) | düğümleri durdurup `rm -rf network/testnet/run/node*/db` | durdurup `/var/lib/tamga-besu/node<n>/db`'yi silmek |
| Ağı baştan yazmak (anahtar, genesis dahil) | `network/dev/` silinip `chain:besu:init` | `make-network.sh --force` | `make-network.sh --force` ile aynı `--dir` |
| Her şeyi kaldırmak | `network/dev/`, `tools/jdk-25`, `tools/besu-*` silinir | `network/testnet/run/`, `tools/` silinir | `systemctl disable besu@node<n>`, birim, `/opt/tamga-besu`, `/var/lib/tamga-besu`, `besu` kullanıcısı |

Zincir verisi silindikten sonra kontratları yeniden dağıtın: `contracts/deployments/besuDev.json` yeni dağıtımda üzerine yazılır.
İndirilen arşivler `tools/_dl/`'de kalır; yeniden kurulumda yeniden indirilmez.

## Sorun giderme

| Belirti | Neden | Çözüm |
|---|---|---|
| Besu açılmıyor; günlükte Java sürümü hatası | Eski JDK kullanılıyor (genel `JAVA_HOME` JDK 17'yi gösteriyor) | JDK 25: betikler `TESTNET_JAVA_HOME`'u (varsayılan `tools/jdk-25`) kullanır; `--java-home` ile başka bir JDK 25 verin |
| Düğüm dış adreste de dinliyor | `p2p-interface` verilmemiş; Besu'nun varsayılanı `0.0.0.0`. `p2p-host` yalnız ilan edilen adrestir | `besu.toml`'a `p2p-interface` yazın; `ss -ltnp` ile denetleyin |
| İzin listesi düğümler arasında farklı (`shared_sha256` farklı) | Düğüm eşitlenmeden çizildi (eski blok) ya da biri yüklenmedi | `eth_syncing` `false` olana dek bekleyip yeniden çizin; işletmeciler arasında aynı `--block` ile karşılaştırın |
| İzin listesi üretilince zincir durdu | Validator'ların bir kısmı Governance'ta değil; listeden düştüler | Önce bütün validator'ların devletlerini Governance'a kabul edin, sonra üretin (§ İzin listesi) |
| "Sender account not authorized to send transactions" | Hesap izin listesinde değil | Doğru davranış olabilir; değilse izin listesini yeniden üretip yükleyin |
| Eş yok; "Bootnode(s) not in nodes-allowlist" | Düğüm listesinde eksik var | Bildirim + `render` + yükleme; statik eş yaklaşık 1 dakikada yeniden bağlanır |
| `render` çıkış 3 | Bildirimdeki açık anahtar Governance'taki validator adresiyle eşleşmiyor | Bildirimi ve Governance kaydını karşılaştırın |
| `node.sh start`: port dolu | Önceki bir düğüm ya da Windows'taki yerel ağ aynı portta | `node.sh status all`; kalıntı süreci durdurun |
| Windows: `chain:besu:stop` düğümü durdurmuyor | `besu.bat` bir `cmd.exe`'dir; asıl süreç onun `java.exe` çocuğudur | Betik `java.exe`'nin süreç kimliğini `besu.pid`'e yazar ve onu durdurur; kalıntı için `Get-Process java` |
| Windows: genesis ya da TOML okunmuyor | Dosya BOM'lu (dosya başında görünmez işaret) yazıldı; PowerShell 5.1'in `Set-Content`/`Out-File`'ı bunu yapar | BOM'suz UTF-8 ve LF satır sonu; betikler böyle yazar |
| Windows: Git Bash'ten `besu` "Argument list too long" | Bash'ten başlatılan Windows betiği | PowerShell'den `besu.bat` (betik böyle yapar) |
| ethers "could not coalesce error" | Düğümün asıl hata metni iç içe | Asıl metin `error.error.message`'tadır |

## GitHub'da otomatik sınama

Depodaki `testnet` iş akışı (`.github/workflows/testnet.yml`) Yol B'yi ve Yol C'nin systemd düzenini her seferinde temiz bir
Ubuntu 24.04 makinesinde baştan kurar ve sınar.

| İş | Ne yapar |
|---|---|
| `lint` | Bütün betikleri `bash -n` ve `shellcheck` ile denetler |
| `network` | JDK 25 + Besu kurar, paketleri ve imzalı listeleri hazırlar, kontratları derler, 4 validator + 1 ek düğümlü ağı yazar ve `deploy-and-wire.sh`'i çalıştırır (nginx zorunlu). Düğüm günlükleri, izin dosyaları ve raporlar 14 gün saklanır |
| `systemd` | `--system` kurulumu, üretilmiş anahtarlı tek validator, `systemd-analyze verify`, düğümün `besu` kullanıcısıyla çalışması, blok artışı, yalnız `127.0.0.1`'de dinleme ve `systemd-analyze security` puanı |
| `staging` | Tek makinede Yol C: `--system` kurulumu, systemd altında üretilmiş anahtarlı 4 validator (birime ek dosyayla yığın `-Xmx640m`), `bootstrap-governance.sh` baştan sona (§ C5), ardından hiçbir şey yazmaması gereken ikinci çalıştırma |

**Ne zaman çalışır:** her pazartesi (04:23 UTC); `contracts/`, `apps/chain-indexer/`, `apps/trust-publisher/src/chain/`,
`network/testnet/`, `network/rpc-proxy/`, `network/permissions/` ya da iş akışının kendisi değişince; ve elle. Elle tetiklemek
için GitHub'da depo → **Actions** → **testnet** → **Run workflow**; ya da GitHub komut satırı aracıyla:

```bash
gh workflow run testnet.yml
gh run list --workflow testnet.yml          # son çalışmalar
gh run view <çalışma numarası> --log        # bütün günlük
```

**Sonuç özeti nerede:** çalışmanın sayfasında, iş özetinde (job summary): `network` işinin özeti bu rehberde "ölçülen sonuç"
olarak verilen tablodur (validator ve eş sayısı, kontratlar, yeniden oynatma, eşdeğerlik, çapa, izin listesi, oylar, arıza
denemesi, RPC koruması, kaynak kullanımı, süre); `systemd` işinin özeti birimin kullanıcısını, blok artışını, soketleri ve güvenlik
puanını verir; `staging` işinin özeti `bootstrap-governance.sh`'in tablosudur (kontratlar, Governance üyeleri, izin listesi, çapa,
göç penceresi, yeniden oynatma ve eşdeğerlik) ve ikinci çalıştırmanın sonucudur. Bu rehberdeki ölçümler 2026-11-05 tarihli çalışmadandır.

## Gölge zincir

İleride, ayrı küçük bir test sunucusunda, canlı ağın gerçek imzalı listelerinin de her yayından sonra bir test zincirine
çapalanması düşünülmektedir ("gölge zincir"): zincirsiz sistem kaynak kalır, gölge zincir yalnız onu izler ve iki hâlin uzun süre
birlikte nasıl davrandığını gösterir. Bugün böyle bir zincir **yoktur**. Proje yönetimi önce GitHub'daki otomatik sınamayla
ilerlemeye karar verdi; ayrı test sunucusu, satın alınmasına karar verildiğinde kurulur. Kurulum Yol C'nin betikleriyle yapılır.

## Kurallar

| Kod | Ne der |
|---|---|
| [[ADR-0009]] K4 | Ortak defter en az iki bağımsız işletmecinin yazılı kabulü olmadan kurulmaz; test ağı bu kuralın dışındadır çünkü üretim değildir |
| [[ADR-0051]] CH1, CH5 | Zincir listenin projeksiyonudur; çelişkide liste geçerlidir. Bayrak kapalıyken zincire bağlanılmaz |
| [[ADR-0052]] LP1–LP5 | Yerel izinlendirme; liste zincirden üretilir, elle yazılmaz; bütün validator'larda aynı; yetki kontratlarda; RPC internete açılmaz |
| [[ADR-0073]] | Geçmiş bir kez yeniden oynatılır; eşdeğerlik testinde kabul/ret farkı kalmadan göç kapanmaz |
| [[ADR-0074]] K7 | Sandbox listeleri üretim zincirine yazılmaz |

Kavram: [Ortak defter (zincir)](/concepts/ledger). Gerçek ağ adımları: [[GUIDE-0015]]. İki hâl: [[GUIDE-0016]]. Ulusal listenin
zincir açıkken işletimi: [[GUIDE-0017]] §8.
