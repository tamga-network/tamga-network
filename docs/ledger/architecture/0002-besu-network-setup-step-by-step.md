---
document_id: ARCH-0002
title: "Besu ağı kurulumu"
status: Draft
version: 1.0.0
created: 2026-08-05
last_updated: 2026-11-04
summary: >
  "Hyperledger Besu ile ağ kurmak ne demek?" sorusunu adım adım, somut olarak
  yanıtlar: chain ID/genesis, QBFT validator anahtarları ve extraData, bootnode,
  node başlatma, izinli erişim (yerel izinlendirme, ADR-0052), RPC koruması, Trust Registry EVM
  kontratlarının deploy'u, Tamga Wallet/issuer entegrasyonu, testnet→mainnet, ve fazlı
  validator devri (vakıf→devlet); ayrıca Docker'sız yerel tek-validator geliştirme ağı
  (Windows + Linux, Java 25). Detaylı config/ABI'lar sonraki Specification
  dokümanlarına bırakılır; bu doküman referans kurulum akışını verir.
---

# Giriş

Bu doküman [[ARCH-0001]]'de tanımlanan ağ mimarisini **Hyperledger Besu üzerinde
nasıl kurarız** sorusunu adım adım yanıtlar. "Besu ile yapmak" soyut bir tercih
değil, aşağıdaki somut adımlar dizisidir.

Amaç: bir mühendis (veya AI ajanı) bu dokümanı izleyerek Faz 0 (vakıf) ağını ayağa
kaldırabilmeli; kesin config alanları ve kontrat arayüzleri ileride Specification
dokümanlarında (SPEC-BC-*) kesinleşecektir.

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
| Genesis | `shanghaiTime: 0` (kontratlar `evmVersion: shanghai`), `zeroBaseFee: true`; Hardhat test hesaplarına bakiye |
| Dinleme | yalnız 127.0.0.1 — RPC 8546 (8545 Hardhat'indir), P2P 30313, keşif kapalı, host izin listesi localhost/127.0.0.1 |
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

**Linux / macOS** — aynı ayarlar, elle (betik Windows içindir):

```bash
# 1) Temurin JDK 25 + Besu 26.11.0 indir, sha256'yı yayın sayfasındaki değerle karşılaştır, aç
export JAVA_HOME=$PWD/tools/jdk-25   # ya da sistemdeki JDK 25
# 2) genesis + anahtar: qbft-config.json (yukarıdaki tablo; "blockchain": {"nodes": {"generate": true, "count": 1}})
tools/besu-26.11.0/bin/besu operator generate-blockchain-config \
  --config-file=qbft-config.json --to=network/dev/_gen --private-key-file-name=key
#    _gen/genesis.json → network/dev/genesis.json, _gen/keys/0x…/key → network/dev/keys/key
# 3) başlat
tools/besu-26.11.0/bin/besu --data-path=network/dev/data/db --genesis-file=network/dev/genesis.json \
  --node-private-key-file=network/dev/keys/key --p2p-host=127.0.0.1 --p2p-port=30313 --discovery-enabled=false \
  --rpc-http-enabled --rpc-http-host=127.0.0.1 --rpc-http-port=8546 --rpc-http-api=ETH,NET,WEB3,QBFT \
  --host-allowlist=localhost,127.0.0.1 --min-gas-price=0
# 4) dağıt
npm run chain:besu:deploy
```

Dikkat: Besu anında blok kazmaz (2 sn); dağıtım kodu her dağıtım/işlemden sonra bloğa girmesini bekler
(`contracts/scripts/lib/deploy.ts`, `waitForDeployment` / `tx.wait()`), yoksa proxy kurulumu henüz kodu olmayan adrese bakar.

---

# Adım Adım

## 1. Ağ kimliğini belirle
- **Chain ID** seç (Ethereum ana ağından ayrık, çakışmayan bir değer — ör. özel bir
  Tamga chain ID). Bu, ağın Ethereum'a bağlı **olmadığını** garanti eder.
- Ağ adı, blok süresi (ör. 2–5 sn) ve gaz politikası (izinli ağda ücretsiz/sabit)
  kararlaştırılır.

## 2. Validator anahtarlarını üret (Faz 0: 4 validator)
- Her validator için node anahtar çifti üret. Adresler QBFT oy setini oluşturur.
- Faz 0'da **4 validator = Tamga vakfı** (QBFT'de 3f+1 → f=1: bir node arızalansa
  ağ çalışır). Anahtarlar HSM/kasada saklanır.

## 3. Genesis'i oluştur (QBFT)
- `genesis.json`: chain ID, QBFT consensus config (blok süresi, epoch), başlangıç
  bakiyeleri (izinli ağda genelde 0/teknik), ve **`extraData`** alanına Faz 0
  validator adreslerini RLP kodlamasıyla göm.
- QBFT vs IBFT 2.0 son ayarı ([[RS-FRAMEWORKS-0001]] §9) bu aşamada netleşir.

## 4. Bootnode / statik peer'ler
- Node'ların birbirini bulması için bootnode(lar) veya statik peer listesi tanımla.
- Faz 0'da 4 node birbirine statik bağlanır.

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
- **Liste elle yazılmaz:** zincirdeki kontrat durumundan `trust:chain-permissions render` ile üretilir (sıralı, belirleyici; sha256
  özeti basılır). Her işletmeci dosyayı kendisi üretir ve uygular; çalışırken `perm_reloadPermissionsFromFile` ile yüklenir.
  Bütün validator'lar aynı listeyi taşır — Besu yerel hesap kurallarını başka düğümün ürettiği blokta uygulamaz.
  `trust:chain-permissions check` düğümün yürürlükteki listesini (`perm_getNodesAllowlist`, `perm_getAccountsAllowlist`) üretilen
  dosyayla karşılaştırır; fark işletme olayıdır.
- **Yetki kontratlardadır:** izin listesi ikinci savunma hattıdır; namespace, delege ve yazıcı eşiği kontratta denetlenir.
- **RPC koruması:** JSON-RPC/WebSocket (8545/8546) yalnız iç ağda dinler; dış erişim nginx ters vekil arkasından karşılıklı TLS
  (mTLS) ile, yalnız tanımlı istemcilere (liste yayıncısı, indeksleyici, doğrulayıcı okuma yolu) ve yalnız `ETH`, `NET`, `WEB3` ad
  alanlarıyla. `PERM`, `ADMIN`, `QBFT`, `DEBUG`, `TXPOOL` yalnız localhost'tan. P2P portu güvenlik duvarında yalnız izinli eşlere.

## 7. Trust Registry kontratlarını deploy et
- EVM/Solidity ile [[ARCH-0001]] §5'teki kayıtları deploy et:
  **Issuer Registry, Key Registry, Revocation (Bitstring Status List ref), Schema
  Registry.**
- Yönetim (kim issuer ekler/akredite eder) başta vakıf multisig, sonra devlet
  yönetişimi (Faz 1) ile genişler.
- Detaylı ABI/arayüz → **SPEC-BC-0001 (planlı).**

## 8. Uygulama entegrasyonu (Tamga Wallet + issuer)
- Tamga Wallet ve issuer servisleri **JSON-RPC** ile Trust Registry'yi okur.
- Doğrulama akışı: Verifier, credential imzasını + Trust Registry'den issuer
  anahtarı/durumunu kontrol eder (kaynağa gitmeden — [[ARCH-0001]] §5).

## 9. Testnet → Mainnet
- Önce **testnet**: aynı topoloji, sıfırlanabilir; pilotlar (ilk üniversite diploma
  issuer'ı, Tamga Wallet) burada denenir.
- Kriterler karşılanınca **mainnet** genesis dondurulur ve üretim başlar.

## 10. Faz geçişi — validator devri (vakıf → devlet)
- Devlet katılınca: QBFT **validator ekleme oylaması** ile devlet node'u sete
  eklenir; vakıf node'ları kademeli **çıkarılır** (oylama).
- Bu bir **oy-gücü devridir**, ağ kesintisi değildir (set çalışırken güncellenir).
- Hedef: consensus gücünün devletlere geçmesi ([[ARCH-0001]] §3, Faz 1).

## 11. Operasyon, izleme, yedekleme
- Metrik/log (Prometheus/Grafana), SLA, otomatik yeniden başlatma.
- Anahtar rotasyonu, felaket kurtarma, node bakımı prosedürleri.
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

1. QBFT vs IBFT 2.0 kesin seçimi (EBSI IBFT 2.0 kullanır — RS-EBSI-0001).
2. Blok süresi / gaz politikası kesin değerleri.
3. ~~Permissioning: on-chain kontrat vs dosya tabanlı~~ — **kapandı (2026-10-19):** yerel izinlendirme, zincir durumundan üretilen
   dosya ([[ADR-0052]]); Besu 25.6.0 zincir üstü izinlendirmeyi kaldırdı.
4. Trust Registry kontrat arayüzleri → SPEC-BC-0001.
5. Faz geçiş eşikleri → [[PM-GOV-0001]] (planlı).

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
yerel geliştirme ağı 2026-11-04).

