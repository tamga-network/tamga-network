---
document_id: GUIDE-0015
title: "Düğüm işletme el kitabı"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  İleride Tamga ortak defterinde (Hyperledger Besu, QBFT) validator ya da tam düğüm çalıştıracak devlet ve işletmeci bilgi işlem
  ekipleri için hazırlık el kitabı: zincirin rolü, önkoşullar, donanım ve işletim sistemi, JDK 25 ve Besu kurulumu, düğüm anahtarı,
  izinli kip ve zincirden üretilen izin listesi, düğüm bildirimi (tamga-node-declaration/1), validator olarak eklenme (Governance
  kabulü ve QBFT oylaması), RPC koruması (mTLS ve yöntem süzgeci), izleme ve sağlık denetimi, yedek ve anahtar hijyeni, çıkış ve
  devir. Zincir bugün üretimde kapalıdır.
---

# Düğüm işletme el kitabı

Bu el kitabı, Tamga'nın [[t:ledger|ortak defterinde]] ileride düğüm çalıştıracak bilgi işlem ekipleri içindir: üye devletlerin
[[t:validator]] düğümleri ve zinciri okuyan tam düğümler.

::: danger Zincir bugün üretimde kapalıdır
Tamga'nın güveni bugün imzalı [[t:trust-list|güven listelerinde]] durur; çalışan bir üretim zinciri **yoktur**
([[ADR-0009]] K4, [[ADR-0051]]). Bu el kitabı **hazırlık** içindir: kurulumu yerel ve test ağlarında denemenize ve kendi
altyapınızı planlamanıza yarar. Zincir yalnız şu önkoşullar sağlandığında açılır:

- en az **iki bağımsız işletmecinin** validator işletmeyi yazılı olarak kabul etmesi (tek işletmecinin zinciri, tek
  işletmecinin imzaladığı listeden fazla güven üretmez);
- kriptografik ve işletimsel tasarımın **bağımsız güvenlik denetiminden** geçmesi.

Bu belgede adı ya da kodu geçen devletler için yer ayrılmıştır; bu, bir anlaşma ya da görüşme bildirimi değildir.
:::

**Ne zaman okunur:**
- Kurumunuz validator ya da tam düğüm işletmeyi değerlendiriyorsa, altyapı planlamasından önce.
- Önce: [Ortak defter (zincir)](/concepts/ledger) kavramı ve [[GUIDE-0006]] §5 (zincirin uygulamalara etkisi).
- Ayrıntılı kurulum akışı ve araçlar herkese açık depoda: `network/` (izin listesi, düğüm bildirimleri, RPC koruması) ve
  `docs/ledger/` (Besu ağ mimarisi, kontrat şartnamesi).
- Kurum tarafındaki adımların (anahtar, yapılandırma şablonu, bildirim, denetim) aracı: `tamga-onboard node` (§3, §4, §5, §8).
  Kurulum: `npm install -g @tamga-network/onboard` (ya da `npx -p @tamga-network/onboard tamga-onboard …`); ayrıntı ve
  kaynak koddan çalıştırma [[GUIDE-0014]] § Kurulum'da.

## Zincirin rolü

Zincir imzalı listelerin ve çapa günlüğünün **projeksiyonudur**, kaynağı değildir: çelişkide liste geçerlidir ([[ADR-0051]]).
İki şey ekler: bir liste sürümünün özetinin ancak eşik kadar bağımsız işletmeci aynı özeti gönderince onaylanması (bağımsız
tanıklık) ve üyelik, ortak belge türleri ve yükseltmeler için devletlerin 2/3 oyu (kodda yönetişim). Zincire kişisel veri, belge
ya da belge özeti yazılmaz; iptal listeleri zincir dışında kalır ([[ADR-0008]]). Sandbox zincire yazılmaz ([[ADR-0074]] K7).

| Rol | Ne yapar | Kim |
|---|---|---|
| Validator | blok önerir ve imzalar; yönetişimde oy kullanır | her üye devletin bir validator'ı; anahtar HSM'de |
| Tam düğüm | zinciri doğrular ve okur; imzalamaz | işletmecinin kendi okuma düğümü (liste yayıncısı, indeksleyici, doğrulayıcı okuma yolu) |

Uzlaşma QBFT'dir: n validator'da en çok f = ⌊(n−1)/3⌋ arızaya dayanır. Hedef en az 4 validator'dır (f = 1).

## 1. Donanım ve işletim sistemi

Kesin boyut zincir açılırken ölçülüp yayımlanır. Planlama için başlangıç önerisi:

| | Öneri |
|---|---|
| Sunucu | adanmış (sanal ya da fiziksel) Linux sunucu, LTS dağıtım; validator başka iş yükü taşımaz |
| İşlemci / bellek | 4 çekirdek, 8–16 GB bellek |
| Disk | SSD, 200 GB'tan başlayarak; büyüme izlenir |
| Ağ | sabit IPv4 ya da IPv6 adresi (izin listesi alan adı değil adres alır); P2P portu (varsayılan 30303) yalnız izin listesindeki eşlere açık |
| Saat | NTP ile senkron (blok zaman damgası; fark 5 saniyeyi geçmemeli) |
| Anahtar | HSM ya da eşdeğer bir kasa (validator için) |
| Erişim | yönetim erişimi yalnız kurumun yönetim ağından; parola ile değil anahtarla |

Docker gerekmez: Besu tek bir JVM sürecidir ve hizmet olarak (systemd) doğrudan çalışır. Konteyner kullanmak işletmecinin kendi
tercihidir.

## 2. JDK 25 ve Besu

- **Java 25** (Eclipse Temurin 25 önerilir); Besu 26.6 ve sonrası Java 25 ister.
- **Hyperledger Besu** 26.x (yerel denemeler 26.11.0 ile yapıldı). Besu 25.6.0'da zincir üstü izinlendirme ve Tessera gizliliği
  kaldırıldı; Tamga bunları kullanmaz ([[ADR-0052]]).

```bash
# İndirdiğiniz arşivlerin sha256 değerini yayın sayfasındaki değerle karşılaştırın, sonra açın
sha256sum besu-26.11.0.tar.gz
tar -xzf besu-26.11.0.tar.gz -C /opt && ln -s /opt/besu-26.11.0 /opt/besu
export JAVA_HOME=/opt/jdk-25
/opt/besu/bin/besu --version
```

Besu'yu yetkisiz, ayrı bir sistem kullanıcısıyla çalıştırın; veri klasörü (ör. `/var/lib/besu`) yalnız o kullanıcıya açık olsun.

## 3. Düğüm anahtarı

Her düğümün bir secp256k1 anahtarı vardır. **Validator'da bu anahtarın adresi QBFT validator adresidir** ve Governance'a bildirilen
validator adresiyle aynı olmalıdır.

```bash
# Anahtar yoksa Besu üretir; açık anahtarı ve adresi dışa aktarın
/opt/besu/bin/besu --node-private-key-file=/var/lib/besu/key public-key export --to=/var/lib/besu/key.pub
/opt/besu/bin/besu --node-private-key-file=/var/lib/besu/key public-key export-address --to=/var/lib/besu/address
chmod 600 /var/lib/besu/key
```

- Anahtarı **kendi donanımınızda** üretin; kimseye göndermeyin. Paylaşılan yalnız açık anahtar (bildirimde) ve adrestir
  (Governance'ta).
- Validator anahtarı için HSM ya da eşdeğer kasa tercih edilir.
- Yerel deneme ağlarının anahtarları herkesçe bilinen test anahtarlarıdır; gerçek düğümde asla kullanılmaz.

### Araçla: `tamga-onboard node init`

Aynı işi katılım aracı da yapar; düğümün **kendi makinesinde** çalıştırın:

```bash
tamga-onboard node init --state TR --role validator --ip 192.0.2.10 --interface 10.0.0.10 --out /var/lib/besu
```

| Yazılan | Ne |
|---|---|
| `key` | özel anahtar (Besu anahtar dosyası biçimi); yalnız sahibine okunur, üzerine yazılmaz |
| `key.pub`, `node.json` | açık anahtar; devlet kodu, rol, adres, arayüz ve portlar (bildirim ve denetim bunu okur) |
| `besu.toml` | §4'teki kurallarla yapılandırma şablonu |

Komut enode açık anahtarını ve validator adresini (Governance'a bildirilecek adres) basar. Klasör OneDrive, Dropbox, Google Drive
ya da iCloud ile eşitleniyorsa reddedilir (bilerek `--allow-synced`); klasörde bu dosyalardan biri bile varsa hiçbiri yazılmaz.
Anahtar HSM'deyse `node init` kullanılmaz: açık anahtarı HSM'den alıp §5'teki `node declare --public-key …` ile bildirin.
Yapay zekâ asistanı üzerinden aynı adım MCP aracı `generate_node_key`'dir; özel anahtar hiçbir yanıtta dönmez ve MCP ile eşitlenen
klasöre hiç yazılmaz.

## 4. İzinli kip

Hangi düğümün bağlanabileceğini ve hangi hesabın işlem gönderebileceğini her düğümdeki yerel `permissions_config.toml` belirler
(iki liste: `nodes-allowlist`, `accounts-allowlist`). Örnek `besu.toml` (yer tutucular `<…>`):

```toml
data-path = "/var/lib/besu/data"
genesis-file = "/etc/besu/genesis.json"          # ağın genesis'i, zincir açılırken işletmecilerce yayımlanır
node-private-key-file = "/var/lib/besu/key"

p2p-host = "<ilan edilen adres>"                 # yalnız ilan edilen adres
p2p-interface = "<P2P arayüzü>"                  # dinlenen arayüz
p2p-port = 30303
discovery-enabled = false
static-nodes-file = "/etc/besu/static-nodes.json"

permissions-nodes-config-file-enabled = true
permissions-accounts-config-file-enabled = true
permissions-nodes-config-file = "/var/lib/besu/permissions_config.toml"
permissions-accounts-config-file = "/var/lib/besu/permissions_config.toml"

rpc-http-enabled = true
rpc-http-host = "127.0.0.1"                      # yalnız düğümün kendisinden
rpc-http-port = 8545
rpc-http-api = ["ETH", "NET", "WEB3", "QBFT", "PERM", "ADMIN"]
host-allowlist = ["localhost", "127.0.0.1"]
```

`tamga-onboard node init`'in yazdığı `besu.toml` bu ayarları taşır ve şunları kesinleştirir: JSON-RPC yalnız `127.0.0.1`'de
(`QBFT`, `PERM`, `ADMIN` düğümün kendi kullanımı için; dışarıya yalnız §7'deki vekil), P2P yalnız `--interface` ile verilen iç
arayüzde dinler ve `--ip`'yi ilan eder (`0.0.0.0` ve `::` reddedilir; `--interface` verilmezse `--ip` kullanılır), keşif kapalı,
iki izin bayrağı açık, WebSocket ve GraphQL kapalı.

::: warning Genesis araçla üretilmez
`genesis.json` ne `node init` ile üretilir ne de araçla indirilir. Ağın işletmecilerinden, katılım yazışmasında bildirilen
kanaldan alınır; `sha256` özetini **en az iki ayrı işletmeciyle başka bir kanaldan** karşılaştırın. Özet aynı değilse düğümü
başlatmayın. Düğüm çalışınca `node check --chain-rpc` genesis bloğunu da karşılaştırır (§8, N3). `static-nodes.json` da
işletmecilerin verdiği validator enode'larıyla yazılır.
:::

**İzin listesi elle yazılmaz** (LP2). Her işletmeci onu zincirdeki kontrat durumundan, herkese açık depodaki araçla kendisi üretir:

```bash
TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8545 npm run trust:chain-permissions -- render \
  --out /var/lib/besu/permissions_config.rendered.toml [--operator <CC>] [--block <n>]
cp /var/lib/besu/permissions_config.rendered.toml /var/lib/besu/permissions_config.toml
curl -s -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"perm_reloadPermissionsFromFile","params":[]}' http://127.0.0.1:8545
npm run trust:chain-permissions -- check --file /var/lib/besu/permissions_config.rendered.toml --node-rpc http://127.0.0.1:8545
```

| Liste | Kaynağı |
|---|---|
| Hesaplar | aktif üyelerin validator adresleri ve delege anahtarları (Governance), çalışır kurumların delegeleri, liste çapası yazıcıları, açık bir göç penceresinin yürütücüsü |
| Düğümler | bildirimleri Governance'taki aktif validator adresiyle eşleşen validator düğümleri; `--operator` ile işletmecinin kendi okuma düğümleri |

- `render` iki özet basar: `sha256` (dosya) ve `shared_sha256` (işletmecinin kendi okuma düğümleri hariç). **Bütün validator'larda
  `shared_sha256` aynı olmalıdır** (LP3); fark bir işletme olayıdır ve aynı blokta (`--block`) yeniden çizilip karşılaştırılır.
- Besu dosyayı yeniden yüklerken kendi biçimiyle yeniden yazar (yorumlar gider). Bu yüzden çizim ayrı dosyada kalır ve denetim
  anlamsaldır (`check`); disk dosyasının özeti çizimin özetiyle karşılaştırılmaz.
- Liste şu durumlarda yeniden üretilir: her Governance kararı (üye kabulü ya da çıkarılması, yazıcı değişikliği), delege
  değişikliği, kurum durumu değişikliği, göç penceresinin açılıp kapanması, yeni düğüm bildirimi.
- İzin listesi ikinci savunma hattıdır; yazma yetkisinin asıl denetimi kontratlardadır (LP4).

## 5. Düğüm bildirimi

Her düğüm bir JSON bildirimiyle tanıtılır (biçim `tamga-node-declaration/1`; şema depoda
`network/permissions/schema/node-declaration.schema.json`, örnekler `network/permissions/examples/`):

```json
{
  "format": "tamga-node-declaration/1",
  "state": "TR",
  "role": "validator",
  "node_public_key": "<128 küçük harf onaltılık karakter; 04 ya da 0x öneki yok>",
  "ip": "192.0.2.10",
  "p2p_port": 30303,
  "contact": "noc@example.org"
}
```

| Alan | Kural |
|---|---|
| `state` | Governance üye kodu |
| `role` | `validator` (bütün işletmecilerin listesine girer) ya da `rpc` (yalnız bildiren işletmecinin kendi listesine) |
| `node_public_key` | `public-key export` çıktısı (§3), öneksiz |
| `ip`, `p2p_port` | adres ve P2P portu; alan adı değil |
| `contact` | kurumun işletim adresi ya da sayfası — **kişi adı yok** |

Bildirimi katılım aracı da yazar (`node init` klasöründen):

```bash
tamga-onboard node declare /var/lib/besu --contact noc@example.org     # → tr-validator.json; operatöre gönderin
```

İletişim kurumun görev posta kutusu ya da https sayfasıdır; görev adresine benzemeyen bir adres uyarı alır. Düğüm klasörü yoksa
(anahtar HSM'de) `--public-key --state --role --ip --p2p-port` birlikte verilir. Dosya üzerine yazılmaz. MCP aracı:
`create_node_declaration`. Özel anahtar asla gönderilmez.

Bir `validator` bildirimi yalnız `state` aktif bir üyeyse ve açık anahtardan türeyen adres o üyenin Governance'taki validator
adresiyse listeye girer; yoksa `render` onu reddeder (çıkış 3). Aynı anahtarla iki bildirim ya da aynı devlet için ikinci validator
reddedilir. Yanlış adres ya da port yalnız bağlantıyı bozar; bildirim yetki vermez. Bildirimler zincire yazılmaz; depoda
`network/permissions/nodes/` klasöründe tutulur.

## 6. Validator olarak eklenme

Sıra önemlidir; her adım bir öncekinin tamamlanmasını bekler.

| # | Adım | Kim | Nasıl |
|---|---|---|---|
| 1 | Üyelik | mevcut üyeler | Governance'ta devletin kabul önerisi (`proposeStateAdmission`, validator adresiyle) ve 2/3 oy |
| 2 | Delege anahtarları | yeni üye | devletin delege anahtarları Governance'a yazılır (`setDelegateKeys`) |
| 3 | Bildirim | yeni üye | §5 bildirimi depoya eklenir |
| 4 | İzin listesi | her işletmeci | `render` → yükle → `check`; bütün validator'larda `shared_sha256` aynı |
| 5 | Eşleşme | yeni üye | düğüm tam düğüm olarak eşleşir ve senkron olur (`eth_syncing` = `false`) |
| 6 | QBFT oyu | mevcut her validator | kendi düğümünde, yalnız `127.0.0.1`'den: `qbft_proposeValidatorVote("<adres>", true)` |
| 7 | Oyun temizlenmesi | mevcut her validator | çoğunluk (> 1/2) oy bloğa girip küme değişince `qbft_discardValidatorVote("<adres>")` |
| 8 | Denetim | herkes | §8 sağlık denetimi |

Küme her düğümde aynı olmalıdır: `qbft_getValidatorsByBlockNumber("latest")`. Yeni validator'ın blok önerdiği
`qbft_getSignerMetrics` ile görülür. Bu bir oy gücü devridir, ağ kesintisi değildir: küme çalışırken güncellenir. İki validator'lı
bir ağda uzlaşma için ikisinin de çevrimiçi olması gerekir; bu yüzden hedef en az 4 validator'dır.

## 7. RPC koruması

Düğümün JSON-RPC ucu internete açılmaz (LP5). Dış istemciler (liste yayıncısı, indeksleyici, doğrulayıcı okuma yolu) yalnız
karşılıklı TLS'li bir ters vekilden geçer ve yalnız `ETH`, `NET`, `WEB3` ad alanlarına ulaşır:

```text
istemci --TLS 1.3 + istemci sertifikası--> nginx :8443 --> yöntem süzgeci 127.0.0.1:8550 --> Besu 127.0.0.1:8545
```

| Parça | Ne |
|---|---|
| nginx (`network/rpc-proxy/nginx.conf.example`) | TLS 1.3, `ssl_verify_client on` (işletmecinin kendi istemci sertifika makamı), yalnız `POST /`, 256 KiB gövde sınırı, istemci başına hız sınırı, erişim günlüğü yok |
| Yöntem süzgeci (`network/rpc-proxy/filter.mjs`) | Node 22, bağımlılıksız; `eth_*`/`net_*`/`web3_*` geçer (imzalayan, kazan ve abonelik yöntemleri hariç); toplu istekte bir çağrı reddedilirse tamamı reddedilir; yalnız ret sayılarını günlüğe yazar |
| systemd birimi (`network/rpc-proxy/rpc-filter.service.example`) | süzgeç yetkisiz kullanıcıyla, yalnız loopback'te |

`PERM`, `ADMIN`, `QBFT`, `DEBUG`, `TXPOOL` yalnız düğümün kendisinden kullanılır. P2P portunu güvenlik duvarında yalnız izin
listesindeki eşlerin adreslerine açın. Dışarıdan deneme: `admin_peers` → `403`, `eth_blockNumber` → `200`, istemci sertifikası
olmadan → TLS reddi.

## 8. İzleme ve sağlık

| Denetim | Nasıl | Geçer |
|---|---|---|
| Senkron | `eth_blockNumber` sizin ve bir referans düğümde; `eth_syncing` | fark ≤ 2 blok, `eth_syncing` = `false` |
| Eşler | `net_peerCount` | validator sayısı − 1 ya da fazlası |
| İzin listesi zincirle aynı | `trust:chain-permissions check` | çıkış 0; `shared_sha256` diğer validator'larla aynı |
| Bildirim eşleşmesi | `render` çıktısında `rejected` ve `missing_validator_nodes` | sizin düğümünüz ikisinde de yok |
| Validator kümesinde | `qbft_getValidatorsByBlockNumber("latest")` | adresiniz var; küme her düğümde aynı |
| Blok öneriyor | `qbft_getSignerMetrics` | öneri sayısı > 0, son önerisi son 2n blok içinde |
| RPC yalnız loopback | `ss -ltnp` ve `besu.toml` | 8545 yalnız `127.0.0.1`; P2P yalnız beklenen arayüzde |
| Dışarıya yalnız eth/net/web3 | vekil üzerinden `admin_peers`, `perm_getAccountsAllowlist`, `qbft_proposeValidatorVote`, `eth_sendTransaction` | hepsi `403`; `eth_blockNumber` `200` |
| Saat | son blok zaman damgası ile yerel saat; `timedatectl` | fark ≤ 5 sn, NTP senkron |

### Araçla: `tamga-onboard node check`

Çalışan düğümünüzü katılım aracı salt-okur denetler; yalnız okuyan JSON-RPC yöntemleri çağrılır (oy, izin yükleme, eş ekleme,
işlem yok):

```bash
tamga-onboard node check /var/lib/besu --chain-rpc https://<ağdaki bir uç>   --public-rpc https://<dış uç> --permissions-file /var/lib/besu/permissions_config.rendered.toml --report rapor.json
```

| Kod | Denetim | Gereken |
|---|---|---|
| N1 | Düğümün yerel RPC ucu yanıt veriyor | `--rpc` (varsayılan: `besu.toml`'daki port, `127.0.0.1`) |
| N2 | Senkron: `eth_syncing` ve karşılaştırma ucuyla blok farkı | `--chain-rpc` (yoksa yalnız `eth_syncing`) |
| N3 | Aynı zincir: genesis bloğu karşılaştırma ucuyla aynı | `--chain-rpc` |
| N4 | Eş sayısı | — |
| N5 | Çalışan anahtar `node.json` ve bildirimle aynı | düğüm klasörü, `--declaration` |
| N6 | Düğüm ve hesap izin listesi çizimle ve karşılaştırma ucuyla aynı | `--permissions-file`, `--chain-rpc` |
| N7 | Adresiniz validator kümesinde | validator rolü |
| N8 | Dış uç `admin_`, `perm_`, `qbft_`, `debug_`, `txpool_` ve `eth_accounts`'ı reddediyor, `eth_blockNumber` ve `net_version`'a yanıt veriyor | `--public-rpc` (`--client-cert`, `--client-key` ile mTLS) |
| N9 | `besu.toml`: arayüzler, ad alanları, izinlendirme bayrakları | düğüm klasörü ya da `--config` |
| N10 | Saat: son blok zaman damgasıyla fark | — |

Çıkış `0` hepsi geçti ya da uyarı, `1` bir denetim kaldı; `--json` ve `--report` JSON rapor verir.

**Adres kuralları.** Adresler yalnız sizin yazdıklarınızdır; dosyadan yalnız `besu.toml`'daki yerel RPC portu okunur.
Loopback (`127.0.0.1`) varsayılan olarak açıktır, çünkü yönetim ucu tasarım gereği oradadır. Öteki yerel ve özel ağlar (RFC 1918,
link-local / bulut meta veri ucu, CGNAT, ULA) yalnız `--allow-private` ile, ad çözümlendikten sonra da; düz http yalnız loopback ve
özel ağ adreslerinde; yönlendirmeler izlenmez. MCP aracı `check_node` loopback ve özel adreslere yalnız kökeni sunucunun
`TAMGA_ONBOARD_PRIVATE_NODES` ortam değişkeninde (virgülle ayrılmış, ör. `http://127.0.0.1:8545`) yazılıysa ulaşır; dış
adreslere yalnız https ile.

Tablodaki bildirim eşleşmesi, blok önerme ve oy denetimleri işletmeci yetkisi ister; onlar işletmecide kalır.

Besu metrikleri yalnız yerel arayüzde açılır (`metrics-enabled = true`, `metrics-host = "127.0.0.1"`) ve kurumun kendi izleme
sistemine (ör. Prometheus) oradan alınır. Hizmeti otomatik yeniden başlatma ile çalıştırın (systemd `Restart=on-failure`) ve
blok yüksekliği durduğunda, eş sayısı düştüğünde ya da `check` fark bulduğunda uyarı verin.

## 9. Yedek ve anahtar hijyeni

| Yedeklenir | Yedeklenmez |
|---|---|
| düğüm anahtarı (şifreli, çevrimdışı, ayrı yerde) | zincir verisi (diğer düğümlerden yeniden senkron olur) |
| `besu.toml`, genesis, statik eşler, bildirim | izin dosyası (zincirden yeniden üretilir) |

- Anahtar düğümde `600` izinle ya da HSM'de durur; asla depoya, sohbete, günlüğe, bilete girmez.
- Anahtar değişimi yeni bir validator adresi demektir: Governance'ta adres güncellemesi, yeni bildirim, her işletmecide yeni izin
  listesi ve QBFT ekleme / çıkarma oyu gerekir. Bu sıranın kontrat düzeyindeki ayrıntısı zincir açılırken kesinleşir.
- Anahtarın ele geçirildiğinden şüpheleniyorsanız düğümü durdurun ve öbür işletmecilere hemen bildirin; adres kümeden oyla
  çıkarılır.
- Zincire, izin dosyasına ve bildirime kişisel veri girmez; bildirimdeki iletişim kurumun görev adresidir.

## 10. Çıkış ve devir

**Devir** (ör. bir işletmecinin validator'ından devletin kendi validator'ına): önce yeni validator §6'daki adımlarla eklenir,
sonra eski validator çıkarılır. Küme hiçbir anda eşiğin altına düşmez.

**Çıkış:**
1. Mevcut validator'lar kendi düğümlerinde `qbft_proposeValidatorVote("<adres>", false)`; n validator'da ⌊n/2⌋ + 1 oy gerekir.
   Küme değişince bekleyen oy `qbft_discardValidatorVote` ile temizlenir.
2. Governance'ta üyenin çıkarılması (`proposeStateRemoval`, 2/3 oy).
3. Her işletmecide izin listesi yeniden üretilir; düğüm listeden çıkınca eş bağlantısı hemen kopar.
4. Çıkan işletmeci düğüm anahtarını ve delege anahtarlarını güvenli biçimde imha eder; bildirimi depodan kaldırılır.

Zincirdeki geçmiş silinmez; geri dönen bir üye yeni bir kabul önerisiyle katılır.

## Yerel deneme

Kontratları, izin listesinin zincirden üretilmesini ve validator oylamasını kendi bilgisayarınızda deneyebilirsiniz. Depo
kökünden (Windows PowerShell):

```powershell
powershell -File scripts\besu-dev.ps1 -Init -Permissioned            # genesis, iki anahtar, iki düğüm bildirimi
powershell -File scripts\besu-dev.ps1 -Start -Permissioned           # düğüm 1 (RPC 8546)
npm run chain:besu:deploy                                            # kontratlar
powershell -File scripts\besu-dev.ps1 -Apply -Permissioned           # izin listesi zincirden: render → yükle → check
powershell -File scripts\besu-dev.ps1 -Start -Permissioned -Node 2   # düğüm 2 (RPC 8547); sonra yeniden -Apply
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-add      # düğüm 2 validator kümesine
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-remove   # ve çıkarılır
powershell -File scripts\besu-dev.ps1 -Stop -Permissioned
```

Bu ağın anahtarları herkesçe bilinen test anahtarlarıdır ve yalnız `127.0.0.1`'de çalışır. Linux ve macOS için aynı ayarlar elle:
depoda `docs/ledger/architecture/0002-besu-network-setup-step-by-step.md`. RPC süzgeci yerelde:
`TAMGA_RPC_FILTER_UPSTREAM=http://127.0.0.1:8546 node network/rpc-proxy/filter.mjs`.

## Sorun giderme

| Belirti | Neden | Çözüm |
|---|---|---|
| "Sender account not authorized to send transactions" | hesap izin listesinde değil | doğru davranış olabilir; değilse izin listesini yeniden üretip yükleyin |
| Eş yok, "Bootnode(s) not in nodes-allowlist" | düğüm listesi eksik | bildirim + `render` + yükleme; statik eş yaklaşık 1 dakikada bağlanır |
| `render` çıkış 3 | bildirim reddedildi ya da `check` fark buldu | bildirimdeki açık anahtar Governance'taki validator adresiyle eşleşiyor mu |
| `shared_sha256` farklı | işletmeciler farklı bloklarda çizdi ya da biri yüklemedi | aynı `--block` ile yeniden çizip karşılaştırın |
| Düğüm dinlemesi yanlış arayüzde | `p2p-host` yalnız ilan edilen adrestir | dinleme `p2p-interface` ile belirlenir |
| Genesis ya da TOML okunmuyor (Windows) | dosya BOM'lu yazıldı | BOM'suz UTF-8 ve LF |
| Besu başlamıyor | Java sürümü | JDK 25 ve `JAVA_HOME` |

## Kurallar

| Kod | Ne der |
|---|---|
| [[ADR-0009]] K4 | Zincir en az iki bağımsız işletmecinin yazılı kabulüyle açılır |
| [[ADR-0051]] | Zincir imzalı listelerin projeksiyonudur; çelişkide liste geçerlidir |
| [[ADR-0052]] LP1–LP5 | Yerel izinlendirme; liste zincirden üretilir, elle yazılmaz; bütün validator'larda aynı; yetki kontratlarda; RPC internete açılmaz |
| [[ADR-0074]] K7 | Sandbox zincire yazılmaz |
| [[ADR-0008]] | İptal listeleri zincir dışında kalır |

Kavram: [Ortak defter (zincir)](/concepts/ledger). Kurallar: [Tamga ARF — Mimari](https://arf.tamga.network/tr/architecture).
