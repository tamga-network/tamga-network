---
document_id: ARCH-0002
title: "Besu ağı kurulumu"
status: Draft
version: 1.0.0
created: 2026-08-05
last_updated: 2026-11-15
summary: >
  "Hyperledger Besu ile ağ kurmak ne demek?" sorusunu adım adım, somut olarak
  yanıtlar: chain ID/genesis, QBFT validator anahtarları ve extraData, bootnode,
  node başlatma, izinli erişim (yerel izinlendirme, ADR-0052), RPC koruması, Trust Registry EVM
  kontratlarının deploy'u, uygulama entegrasyonu (liste kaynak, zincir tanık — ADR-0084), sürekli projeksiyon (ADR-0085),
  test ağı → gerçek ağ ve fazlı validator devri (ilk işletmeciler → devlet); ayrıca Docker'sız yerel tek-validator geliştirme ağı
  (Windows + Linux, Java 25) ve iki düğümlü yerel izinli ağ (izin listesi zincirden, QBFT validator oylaması). Detaylı config/ABI'lar sonraki Specification
  dokümanlarına bırakılır; bu doküman referans kurulum akışını verir.
---

# Giriş

Bu doküman [[ARCH-0001]]'de tanımlanan ağ mimarisini **Hyperledger Besu üzerinde
nasıl kurarız** sorusunu adım adım yanıtlar. "Besu ile yapmak" soyut bir tercih
değil, aşağıdaki somut adımlar dizisidir.

Amaç: bir mühendis bu dokümanı izleyerek zincir aşamasının ilk ağını (en az iki bağımsız işletmeci, [[ADR-0009]] K4) önce test
ağı, sonra gerçek ağ olarak ayağa kaldırabilmeli; kontrat arayüzleri [[SPEC-BC-0001]]'dedir.

> **Kaynak yönü ([[ADR-0084]], 2026-11-15):** imzalı güven listeleri ve çapa günlüğü ağın tek ve asıl güven kaynağıdır; zincir
> **tanıktır**. Liste yayıncısı her yayından sonra listedeki değişiklikleri zincire yazar ([[ADR-0085]]); doğrulama kararı yalnız
> listeden verilir, zincir okuması yalnız çapraz denetimdir; zincir durursa listeler ve doğrulama etkilenmez. Bugün zincir kodu
> kapalı olarak tamamlanır; sunucu ve doğrulayıcı düğüm kurulmaz. Geçiş sırası: kapalı kod → test ağı (gerçek listeler bir test
> zincirine yansıtılır) → gerçek ağ.

> **"Besu ile yapmak" özeti:** Besu, kendi genesis'i + kendi chain ID'si + kendi
> onaylı validator setiyle çalışan **bağımsız bir Ethereum-client ağıdır**. Biz
> Ethereum'a bağlanmıyoruz; Besu'yu bir *motor* olarak kullanıp üstüne kendi izinli
> ağımızı ve güven kontratlarımızı koyuyoruz ([[RS-FRAMEWORKS-0001]] §5).

---

# Ön Koşullar

- **Java 25** (Besu JVM tabanlıdır; Besu 26.6 ve sonrası Java 25 ister). Geliştirmede Eclipse Temurin 25 kullanılır.
- **Besu** ikilisi (Apache 2.0; kaynak `github.com/besu-eth/besu`, geliştirmede 26.11.0) — zip/tar açılır, kurulum gerekmez.
- Anahtar/araçlar için Besu'nun `operator` alt komutları.
- Node başına: statik IP/DNS, P2P portu (varsayılan 30303; yalnız izin listesindeki eşlere açık), RPC portu (8545; yalnız iç ağda,
  dışarıya açılmaz — §6).
- Besu sürümü: 25.6.0 ve sonrası; zincir üstü izinlendirme ve Tessera gizliliği bu sürümde kaldırıldı ve kullanılmaz.
- Docker gerekmez: Besu tek bir JVM sürecidir, JDK ve Besu ikilisi doğrudan çalıştırılır (geliştirmede de, sunucuda da
  systemd/hizmet olarak). Konteyner bir işletmecinin kendi tercihi olabilir, kurulumun parçası değildir.

---

# Yerel geliştirme ağı (Docker'sız, tek validator)

Kontratları ve liste çapası projeksiyonunu ([[ADR-0051]]) gerçek bir QBFT düğümüne karşı denemek için. **Yalnız yerel geliştirme:**
tek validator, herkesçe bilinen test hesapları; gerçek ağ ≥2 bağımsız işletmeciyle kurulur ([[ADR-0009]] K4).

| Ayar | Değer |
|---|---|
| chainId | 31338 (Hardhat 31337'den ayrı) |
| Uzlaşı | QBFT, blok süresi 2 sn, epoch 30000, istek zaman aşımı 4 sn |
| Genesis | `shanghaiTime: 0` ve `cancunTime: 0` — Cancun kural seti ([[ADR-0077]]; kontratlar `evmVersion: cancun`), `zeroBaseFee: true`; Hardhat test hesaplarına bakiye. 2026-11-12'den önce üretilmiş yerel genesis Shanghai'dir: `network/dev/genesis.json` ve `keys/` silinip `-Init` ile yeniden üretilir, zincir verisi `-Reset` ile sıfırlanır |
| Dinleme | yalnız 127.0.0.1 — RPC 8546 (8545 Hardhat'indir), P2P 30313 (`p2p-interface` da 127.0.0.1 — `p2p-host` yalnız ilan edilen adrestir), keşif kapalı, host izin listesi localhost/127.0.0.1 |
| RPC ad alanları | `ETH`, `NET`, `WEB3` + yalnız yerelde `QBFT` (doğrulayıcı listesi için); gaz fiyatı alt sınırı 0 |

**Windows (PowerShell 5.1 yeterli)** — depo kökünden:

```powershell
npm run chain:besu:init     # JDK 25 + Besu yoksa resmi kaynaktan indirir, sha256'yı sabit değerle doğrular (tools/);
                            # genesis + validator anahtarı network/dev/ (yerelde üretilir, depoya girmez)
npm run chain:besu:start    # 127.0.0.1:8546; ilk blok artışını bekler (birkaç saniye); java.exe PID'i network/dev/data/besu.pid
npm run chain:besu:status   # chainId, blok, validator
npm run chain:besu:deploy   # kontratlar + liste çapası kaydı → contracts/deployments/besuDev.json
npm run chain:besu:stop     # durdurur (zincir verisi kalır)
npm run chain:besu:reset    # zincir verisini siler; genesis ve anahtar korunur (dağıtım yeniden yapılır)
```

Betik `scripts/besu-dev.ps1`; log `network/dev/data/besu.log`. Hardhat ağ adı `besuDev` (adres `TAMGA_BESU_RPC`, varsayılan
`http://127.0.0.1:8546`).

**Linux / macOS** — aynı ayarlar, elle (betik Windows içindir; Linux'ta çok düğümlü ağ için betikler: "Linux çok düğümlü test ağı"):

```bash
# 1) Temurin JDK 25 + Besu 26.11.0 indir, sha256'yı yayın sayfasındaki değerle karşılaştır, aç
export JAVA_HOME=$PWD/tools/jdk-25   # ya da sistemdeki JDK 25
# 2) genesis + anahtar: qbft-config.json (yukarıdaki tablo; "blockchain": {"nodes": {"generate": true, "count": 1}})
tools/besu-26.11.0/bin/besu operator generate-blockchain-config \
  --config-file=qbft-config.json --to=network/dev/_gen --private-key-file-name=key
#    _gen/genesis.json → network/dev/genesis.json, _gen/keys/0x…/key → network/dev/keys/key
# 3) başlat
tools/besu-26.11.0/bin/besu --data-path=network/dev/data/db --genesis-file=network/dev/genesis.json \
  --node-private-key-file=network/dev/keys/key --p2p-host=127.0.0.1 --p2p-interface=127.0.0.1 --p2p-port=30313 --discovery-enabled=false \
  --rpc-http-enabled --rpc-http-host=127.0.0.1 --rpc-http-port=8546 --rpc-http-api=ETH,NET,WEB3,QBFT \
  --host-allowlist=localhost,127.0.0.1 --min-gas-price=0
# 4) dağıt
npm run chain:besu:deploy
```

Dikkat: Besu anında blok kazmaz (2 sn); dağıtım kodu her dağıtım/işlemden sonra bloğa girmesini bekler
(`contracts/scripts/lib/deploy.ts`, `waitForDeployment` / `tx.wait()`), yoksa proxy kurulumu henüz kodu olmayan adrese bakar.

## Yerel izinli ağ (iki düğüm, [[ADR-0052]])

Yerel izinlendirmeyi, izin listesinin zincirden üretilmesini ve validator oylamasını denemek için ayrı bir yerel ağ
(`network/dev/perm/`, gitignore). **Yalnız yerel:** düğüm anahtarları Hardhat test hesapları #1 ve #2'dir (herkesçe bilinen); bu
sayede QBFT doğrulayıcı adresi = Governance'taki TR/KZ validator adresi = enode adresi ve [[ADR-0052]] K2 eşleşme kuralı gerçek
biçimiyle denenir.

| Düğüm | RPC | P2P | Rol |
|---|---|---|---|
| 1 (TR) | 127.0.0.1:8546 | 127.0.0.1:30313 | genesis'teki tek kurucu doğrulayıcı (`extraData`: `besu rlp encode --type=QBFT_EXTRA_DATA`) |
| 2 (KZ) | 127.0.0.1:8547 | 127.0.0.1:30314 | tam düğüm, düğüm 1'e statik eş; oyla doğrulayıcı olur |

İki izin bayrağı açık (`--permissions-nodes-config-file-enabled`, `--permissions-accounts-config-file-enabled`, ikisi de aynı
`permissions_config.toml`); RPC ad alanları `ETH,NET,WEB3,QBFT,PERM,ADMIN` yalnız 127.0.0.1'de.

```powershell
powershell -File scripts\besu-dev.ps1 -Init -Permissioned            # genesis, iki anahtar, iki düğüm bildirimi
powershell -File scripts\besu-dev.ps1 -Start -Permissioned           # düğüm 1; ilk izin dosyası = düğüm 1 + dağıtım hesapları #0..#4
npm run chain:besu:deploy                                            # kontratlar
powershell -File scripts\besu-dev.ps1 -Apply -Permissioned           # her düğüm: render (zincirden) → perm_reloadPermissionsFromFile → check
powershell -File scripts\besu-dev.ps1 -Start -Permissioned -Node 2   # düğüm 2; sonra yeniden -Apply (paylaşılan özetler aynı olmalı)
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts accounts      # izinsiz hesap reddi, delege yazar
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-add      # düğüm 2 doğrulayıcı kümesine
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-remove   # ve çıkarılır
powershell -File scripts\besu-dev.ps1 -Stop -Permissioned
```

Sonuç (2026-11-05, Besu 26.11.0): izin listesinde olmayan hesabın işlemi düğümde reddedildi ("Sender account not authorized to
send transactions"), listedeki devlet delegesinin işlemi bloğa girdi; iki düğüm listeyi farklı bloklarda kendisi üretti ve
özetler aynı çıktı (LP3); bildirimi kaldırılan düğüm listeden çıkınca bağlantısı hemen koptu, geri eklenince statik eş ~1 dk içinde
yeniden bağlandı; düğüm 2 `qbft_proposeValidatorVote` ile kümeye eklendi (iki doğrulayıcı da blok önerdi) ve iki doğrulayıcının
çıkarma oyuyla çıkarıldı. Besu `perm_reloadPermissionsFromFile` sırasında dosyayı kendi biçimiyle yeniden yazar (yorumlar gider):
çizim ayrı dosyada kalır (`permissions_config.rendered.toml`), denetim `check` ile anlamsaldır.

## Linux çok düğümlü test ağı

Yukarıdaki adımların Linux karşılığı, çok düğümle ve uçtan uca: `network/testnet/` (bash; ayrıntı oradaki README). Yalnız test
ağıdır (zincir kimliği 31338, herkesçe bilinen test anahtarları); aynı betikler test sunucusu kurulumunun başlangıcıdır.

| Betik | Ne yapar |
|---|---|
| `install-besu.sh` | JDK 25 + Besu 26.11.0, resmi kaynak, sha256 sabit; `--system`: `/opt/tamga-besu`, `besu` kullanıcısı, `/var/lib/tamga-besu` |
| `make-network.sh` | 4 doğrulayıcı (3f+1, f=1) + 1 ek düğüm: genesis (`extraData`), statik eşler, başlangıç izin dosyası, düğüm bildirimleri, `besu.toml` (RPC ve P2P yalnız düğümün arayüzünde) |
| `node.sh`, `besu@.service` | düğüm işletimi; sıkılaştırılmış systemd birimi |
| `deploy-and-wire.sh` | kontratlar → yeniden oynatma + eşdeğerlik → çapa → Governance kabulü → her düğümde izin listesi (LP3) → validator ekleme/çıkarma oyu → bir doğrulayıcı dururken bloklar sürer, iki dururken durur → RPC koruması (süzgeç + nginx mTLS) |

GitHub Actions'ta haftalık ve zincir kodu değişince çalışır (`.github/workflows/testnet.yml`); sonuç özeti iş özetindedir.

---

# Adım Adım

## 1. Ağ kimliğini belirle
- **Chain ID** seç (Ethereum ana ağından ayrık, çakışmayan bir değer — ör. özel bir
  Tamga chain ID). Bu, ağın Ethereum'a bağlı **olmadığını** garanti eder.
- Ağ adı, blok süresi (ör. 2–5 sn) ve gaz politikası (izinli ağda ücretsiz/sabit)
  kararlaştırılır.

## 2. Validator anahtarlarını üret (ilk ağ: iki bağımsız işletmeci, 4 validator)
- Her validator için node anahtar çifti üret. Adresler QBFT oy setini oluşturur.
- İlk ağ **en az iki bağımsız işletmeciyle** kurulur ([[ADR-0009]] K4; [[ADR-0076]] GC4: en az iki kurucu). Önerilen düzen
  **2 işletmeci × 2 validator = 4** (QBFT'de 3f+1 → f=1: bir node arızalansa ağ çalışır; hiçbir işletmeci tek başına blok üretemez
  — 4'te 3 imza gerekir). Bir işletmecinin iki düğümü birden düşerse zincir durur; listeler etkilenmez ([[ADR-0084]] LS4). Hedef
  üçüncü bağımsız işletmeci. Her işletmeci ayrıca bir doğrulamayan tam düğüm (RPC, indeksleyici, yazıcı) çalıştırır; validator'ın
  RPC'si dışarı açılmaz. Validator başka iş yükü taşımaz: canlı hizmet sunucusuna konmaz. Anahtarlar her işletmecinin kendi
  HSM/kasasında üretilir ve saklanır.
- **Yönetişim ve mutabakat anahtarı bugün aynıdır (açık karar, not 2026-11-11).** Validator'ın düğüm anahtarı aynı zamanda
  devletin Governance oy anahtarıdır (`Governance.StateMember.validatorAddress`). Bu iki anahtar ayrılana kadar gerçek ağda
  validator düğüm anahtarı **HSM'de tutulmak zorundadır**; dosyadaki anahtar yalnız deneme ağlarında kabul edilir. Ayrım, ikinci
  bir devlet katılmadan önce yeni bir karar kaydıyla (ADR) karara bağlanır (Açık Konular 6).

## 3. Genesis'i oluştur (QBFT)
- `genesis.json`: chain ID, QBFT consensus config (blok süresi, epoch), başlangıç
  bakiyeleri (izinli ağda genelde 0/teknik), ve **`extraData`** alanına Faz 0
  validator adreslerini RLP kodlamasıyla göm.
- Uzlaşı QBFT'dir ([[ADR-0001]]); kural seti ilk bloktan Cancun ([[ADR-0077]]: `shanghaiTime: 0`, `cancunTime: 0`).

## 4. Bootnode / statik peer'ler
- Node'ların birbirini bulması için bootnode(lar) veya statik peer listesi tanımla.
- İlk ağda validator'lar ve tam düğümler birbirine statik bağlanır (keşif kapalı; izin listesi §6).

## 5. Validator node'larını başlat
- Her node'u genesis + QBFT config + kendi anahtarıyla başlat.
- Node'lar el sıkışıp QBFT round'larına girer; 2/3+ (yani 4'te ≥3) imzayla bloklar
  kesinleşir (single-block finality).

## 6. İzinli erişimi uygula (yerel izinlendirme) — [[ADR-0052]]
- Bu, [[PM-BC-0001]] #2 "izinli ağ" ilkesinin teknik uygulamasıdır. Mekanizma Besu'nun **yerel izinlendirmesidir**: her validator
  ve RPC düğümünün veri klasöründe `permissions_config.toml`, iki liste — `nodes-allowlist` (enode adresleri) ve
  `accounts-allowlist` (hesap adresleri). Açılış: `--permissions-nodes-config-file-enabled` ve
  `--permissions-accounts-config-file-enabled`. Zincir üstü izin kontratı yoktur (Besu 25.6.0'da kaldırıldı).
- **Düğüm izni:** validator düğümleri — enode kimliğinden türeyen adres Governance'taki aktif validator adresi olmalı; işletmecinin
  kendi RPC/full düğümleri yalnız kendi düğümlerinin listesinde.
- **Hesap izni:** validator'lar, devlet ve kurum delege anahtarları, liste çapası yazıcıları; Faz 0 başlangıcında ayrıca dağıtım
  hesabı (kontratlar kurulunca çıkar).
- **Liste elle yazılmaz:** zincirdeki kontrat durumundan `trust:chain-permissions render` ile üretilir (sabitlenmiş blokta okur;
  sıralı, belirleyici; blok numarası ya da zaman dosyaya girmez). İki özet basılır: `sha256` (dosya) ve `shared_sha256`
  (işletmecinin kendi RPC düğümleri hariç) — validator'lar `shared_sha256`'yı karşılaştırır. Her işletmeci dosyayı kendisi üretir
  ve uygular; çalışırken `perm_reloadPermissionsFromFile` ile yüklenir. Düğüm bildirimleri `network/permissions/nodes/`
  (biçim `tamga-node-declaration/1`; şema ve eşleşme kuralı `network/permissions/README.md`).
  Bütün validator'lar aynı listeyi taşır — Besu yerel hesap kurallarını başka düğümün ürettiği blokta uygulamaz.
  `trust:chain-permissions check` düğümün yürürlükteki listesini (`perm_getNodesAllowlist`, `perm_getAccountsAllowlist`) üretilen
  dosyayla karşılaştırır; fark işletme olayıdır.
- **Yetki kontratlardadır:** izin listesi ikinci savunma hattıdır; namespace, delege ve yazıcı eşiği kontratta denetlenir.
- **RPC koruması:** JSON-RPC/WebSocket (8545/8546) yalnız iç ağda dinler; dış erişim nginx ters vekil arkasından karşılıklı TLS
  (mTLS) ile, yalnız tanımlı istemcilere (liste yayıncısı, indeksleyici, doğrulayıcı okuma yolu) ve yalnız `ETH`, `NET`, `WEB3` ad
  alanlarıyla. `PERM`, `ADMIN`, `QBFT`, `DEBUG`, `TXPOOL` yalnız localhost'tan. P2P portu güvenlik duvarında yalnız izinli eşlere.
  nginx JSON-RPC gövdesini njs olmadan okuyamaz; yöntem süzgeci ayrı küçük bir Node süreci: `network/rpc-proxy/` (nginx örneği,
  `filter.mjs`, systemd birimi, yerel test sertifikası betiği).

## 7. Güven katmanı kontratlarını deploy et
- [[SPEC-BC-0001]]'in kontratları (UUPS vekil): `Governance`, `RootCARegistry`, `SchemaRegistry`, `IssuerRegistry`,
  `RelyingPartyRegistry`, `StatusListRegistry` (iptal listesi kaydı; liste içeriği zincire girmez — [[ADR-0008]]),
  `CrossRecognition`, `TrustQueries`, liste çapası kaydı `TrustListAnchorRegistry` ([[ADR-0051]]) ve ağ düzeyi kayıt
  `NetworkRegistry` ([[ADR-0074]]). Dağıtım betiği `contracts/scripts/deploy-network.ts` (bugün yalnız test/staging zincir
  kimlikleri), Governance kurulumu `network/testnet/bootstrap-governance.sh`.
- Yönetim baştan Governance'tadır: iki kurucu üye ([[ADR-0076]] GC4), kayıt yönetimi türü belli önerilerle (2/3, [[ADR-0055]]),
  liste çapası yazıcı eşiği üretimde ≥ 2 ([[ADR-0051]] CH3).
- Sonra geçmişin aktarımı (bir kez): göç penceresi önerisi (plan özetiyle) → üyelerin oyu → `trust:chain-replay` → eşdeğerlik
  farksız → pencere kapanır ([[ADR-0073]]). Pencere bir kez açıldığı için aynı arşivle önce test ağında tam prova yapılır.

## 8. Uygulama entegrasyonu: liste kaynak, zincir tanık ([[ADR-0084]])
- Cüzdanlar, belge veren servisler ve doğrulayıcılar **zinciri okumaz**; güven kararını imzalı listelerden verir (`TrustSource`,
  [[ADR-0015]]; paketler zincir istemcisi taşımaz).
- Zincire yazan tek bileşen liste yayıncısıdır: her yayından ve çapa satırından sonra listedeki değişiklikleri (`trust:chain-sync`,
  [[ADR-0085]]) ve liste özetlerini (`trust:chain-submit`, [[ADR-0051]]) yazar; yalnız `TAMGA_CHAIN_ENABLED=1` iken; hatası
  yayını durdurmaz.
- Zinciri okuyanlar çapraz denetim içindir: `trust:chain-check`, doğrulayıcının sağlık sayfasındaki zincir alanı, indeksleyici
  (`apps/chain-indexer`) ve eşdeğerlik testi. Sonuç doğrulamayı hiçbir yönde değiştirmez; fark alarm üretir.

## 9. Test ağı → gerçek ağ ([[ADR-0084]] LS6)
- Önce **test ağı** (gölge zincir): aynı topoloji, sıfırlanabilir; gerçek imzalı listeler test zincirine göçle aktarılır ve her
  yayından sonra sürekli projeksiyonla yansıtılır; eşdeğerlik bir süre farksız izlenir. Test zinciri sandbox'tan ayrıdır (sandbox
  gerçek ağa yazılmaz, [[ADR-0074]] PJ4).
- **Gerçek ağ** şu koşullar birlikte sağlanınca açılır: ikinci bağımsız işletmecinin yazılı kabulü, eşik ≥ 2, test ağında farksız
  eşdeğerlik, üretim anahtar yolu (HSM) ve yönetişim–uzlaşma anahtar ayrımı için karar kayıtları, bağımsız güvenlik denetimi. Sonra
  gerçek ağ genesis'i dondurulur; adımlar 1–8 gerçek ağın anahtarlarıyla yinelenir. Bugün gerçek ağa yazma yolu kodda yoktur.

## 10. Faz geçişi — validator devri (vakıf → devlet)
- Devlet katılınca: QBFT **validator ekleme oylaması** ile devlet node'u sete
  eklenir; vakıf node'ları kademeli **çıkarılır** (oylama).
- Sıra: (1) Governance kabulü (2/3) ve devletin delege anahtarları; (2) düğüm bildirimi + her işletmecide izin listesi
  (`render` → yükle → `check`, paylaşılan özetler aynı); (3) yeni düğüm tam düğüm olarak eşleşir ve senkron olur; (4) mevcut her
  doğrulayıcı kendi düğümünde `qbft_proposeValidatorVote(<adres>, true)` — çoğunluk (> 1/2) oy bloğa girince küme değişir, sonra
  `qbft_discardValidatorVote`; çıkarmada aynı oy `false` ile; (5) düğüm denetimi (senkron, izin listesi, küme, imza, RPC yüzeyi,
  saat). Yerel deneme: "Yerel izinli ağ" bölümü.
- Bu bir **oy-gücü devridir**, ağ kesintisi değildir (set çalışırken güncellenir).
- Hedef: consensus gücünün devletlere geçmesi ([[ARCH-0001]] §3, Faz 1).

## 11. Operasyon, izleme, yedekleme
- Metrik/log (Prometheus/Grafana), SLA, otomatik yeniden başlatma.
- İzlenecekler: blok durması, eş sayısı, izin listesi farkı (`trust:chain-permissions check`), indeksleyici gecikmesi, liste
  çapasında `NO` / `CONFLICT` / `CONTEST` ([[ADR-0051]]), sürekli projeksiyonun eksik koşusu ve iki saati aşan gecikmesi
  ([[ADR-0085]] SP2, SP5). Hepsi alarm üretir ve şeffaflık raporuna girer ([[ADR-0084]] LS5); hiçbiri liste yayınını durdurmaz.
- Anahtar rotasyonu, felaket kurtarma, node bakımı prosedürleri.
- **Yönetişim anahtarının yedeği (iki üyeli dönemde zorunlu; [[ADR-0076]] uygulama notu, 2026-11-12).** Ağda iki etkin üye
  varken bir üyenin yönetişim anahtarı (bugün validator düğüm anahtarı — Açık Konular 6) kaybolursa hiçbir öneri geçemez, o üye
  çıkarılamaz ve çekilemez: yönetişim geri dönüşsüz kilitlenir. Kural: üçüncü üye katılana kadar her üye, yönetişim anahtarının
  asıl anahtardan **ayrı bir yerde** (ayrı bina ya da ayrı kasa; HSM'de tutuluyorsa üreticinin sarılı anahtar yedeği ya da
  ikinci HSM) saklanan bir yedeğini tutar ve yedeği **sınar**: yedekten geri yüklenen anahtarın adresi Governance'taki
  validator adresiyle aynı olmalı ve bu anahtarla bir sınama imzası atılabilmelidir. Sınama, ağ açılmadan önce ve her anahtar
  değişiminden sonra yapılır; tarihi işletmecinin kendi kaydına yazılır. Yedek, asıl anahtarla aynı korumayı ister (erişim
  denetimi, şifreli saklama); depoya, ortak sürücüye ya da düğüm sunucusuna konmaz. Üç ve daha çok üyeli ağda yedek önerilir
  (anahtarını kaybeden üye öteki üyelerin oyuyla çıkarılıp yeni adresle yeniden kabul edilebilir).
- **Governance yükseltmesinden sonra oylar ([[SPEC-BC-0001]] §9, 2026-11-12).** Oy sayımının dayandığı depolamayı değiştiren
  bir Governance yükseltmesinden sonra, yükseltmeden önce verilmiş oylar sayılmayabilir (oy zamanı kaydı olmayan oy sayılmaz).
  Yükseltmeyi yapan öneri etkilenmez (eşik yükseltmeden önce sayılır). Adım: yükseltme uygulanınca açık önerileri ve kuyruktaki
  yükseltmeleri listele; `countedForVotes` beklenenden düşükse her üye oyunu **aynı yönde yeniden verir** (`vote`), sonra
  `execute` çağrılır. Oy penceresi: açık öneride `expiresAt`, kuyruktaki yükseltmede bekleme süresi + 30 gün; süre dolmuşsa
  öneri yeniden açılır. Yükseltme takvimi buna göre kurulur: mümkünse Governance yükseltmesi açık öneri yokken uygulanır.
- Güvenlik sertleştirme referansı: depo kökündeki `security.sh` yaklaşımı.

---

# Güvenlik Notları

- Validator anahtarları **HSM/kasa**; tek node ele geçse f=1 toleransı korur.
- İzin listesini değiştirmenin tek yolu zincirdeki yönetişim işlemidir (Governance oyu, devlet namespace'i, yazıcı kümesi);
  izin dosyası ondan üretilir. Düğümün `PERM`/`ADMIN` ad alanı dışarıya açılmaz ([[ADR-0052]]).
- Kişisel veri asla zincire yazılmaz ([[PM-TRUST-0001]]); kontratlar yalnızca DID,
  anahtar, akreditasyon, iptal, şema tutar.
- Tüm kriptografik/operasyonel tasarım **bağımsız güvenlik denetimi** gerektirir
  (üretim önkoşulu).

---

# Açık Konular

1. ~~QBFT vs IBFT 2.0 kesin seçimi~~ — **kapandı:** QBFT ([[ADR-0001]]).
2. Blok süresi / gaz politikası kesin değerleri.
3. ~~Permissioning: on-chain kontrat vs dosya tabanlı~~ — **kapandı (2026-10-19):** yerel izinlendirme, zincir durumundan üretilen
   dosya ([[ADR-0052]]); Besu 25.6.0 zincir üstü izinlendirmeyi kaldırdı.
4. Trust Registry kontrat arayüzleri → SPEC-BC-0001.
5. Faz geçiş eşikleri → [[PM-GOV-0001]] (planlı).
6. **Yönetişim anahtarı ile mutabakat (düğüm) anahtarının ayrılması** — bugün aynı anahtar; karar ikinci devlet katılmadan önce yeni
   bir ADR ile verilir. O zamana kadar gerçek ağda validator düğüm anahtarı HSM'de tutulur (Adım 2).
7. ~~Kural seti (Shanghai mı, Cancun mu)~~ — **kapandı (2026-11-12):** Cancun ([[ADR-0077]]); genesis üreticileri
   `cancunTime: 0` yazar. Blob işlemleri kullanılmaz; KZG için ek seçenek gerekmez (Besu 26.11.0, yerel QBFT denemesi).
8. ~~Kuruluşta kurucu sayısı~~ — **kapandı (2026-11-12):** en az iki kurucu ([[ADR-0076]] GC4); `Governance.initialize` tek
   kurucuyu reddeder. Doğrulayıcı sayısı ayrı konudur (yerel tek doğrulayıcılı zincir de iki kurucuyla kurulur).

---

# İlgili Dokümanlar

- [[ARCH-0001]] — Ağ mimarisi (bu kurulumun tanımladığı yapı).
- [[ADR-0001]] — Besu + QBFT kararı.
- [[ADR-0052]] — Besu yerel izinlendirme ve RPC koruması.
- [[PM-BC-0001]] — Validator modeli ve izinli ağ ilkesi.
- [[RS-FRAMEWORKS-0001]] — Besu neden seçildi (Cosmos karşılaştırması).
- [[RS-FRAMEWORKS-0002]] — Besu vs kendi Rust ağı.

---

# Durum

**Taslak** — sürüm 1.0.0 (2026-10-02; §6 yerel izinlendirme ve RPC koruması 2026-10-19, [[ADR-0052]]; Java 25 ve Docker'sız
yerel geliştirme ağı 2026-11-04; iki düğümlü yerel izinli ağ, izin listesi aracı, RPC süzgeci ve validator oylaması 2026-11-05;
Adım 11 Governance yükseltmesinden sonra oylar 2026-11-12; kaynak yönü, ilk ağın iki bağımsız işletmeciyle kurulması, güncel kontrat
adları, uygulama entegrasyonu, test ağı → gerçek ağ koşulları ve izleme 2026-11-15, [[ADR-0084]], [[ADR-0085]]).

