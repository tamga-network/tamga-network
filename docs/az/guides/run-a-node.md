---
document_id: GUIDE-0015
title: "Qovşaq istismarı üzrə təlimat"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Gələcəkdə Tamga-nın ortaq reyestrində (Hyperledger Besu, QBFT) validator və ya tam qovşaq işlədəcək dövlət və operator İT
  komandaları üçün hazırlıq təlimatı: zəncirin rolu, ilkin şərtlər, avadanlıq və əməliyyat sistemi, JDK 25 və Besu, qovşaq açarı,
  icazəli rejim və zəncirdən yaradılan icazə siyahısı, qovşaq bəyannaməsi (tamga-node-declaration/1), validator kimi əlavə olunma
  (Governance qəbulu və QBFT səsverməsi), RPC qorunması (mTLS və metod filtri), monitorinq və sağlamlıq yoxlaması, ehtiyat nüsxə
  və açar gigiyenası, çıxış və təhvil. Zəncir bu gün istehsalda söndürülüb.
translation_of: GUIDE-0015
source_version: "1.0.0"
---

# Qovşaq istismarı üzrə təlimat

Bu təlimat gələcəkdə Tamga-nın [[t:ledger|ortaq reyestrində]] qovşaq işlədəcək İT komandaları üçündür: üzv dövlətlərin
[[t:validator]] qovşaqları və zənciri oxuyan tam qovşaqlar.

::: danger Zəncir bu gün istehsalda söndürülüb
Tamga-da etibar bu gün imzalanmış [[t:trust-list|etibar siyahılarına]] əsaslanır; işləyən istehsal zənciri **yoxdur**
([[ADR-0009]] K4, [[ADR-0051]]). Bu təlimat **hazırlıq** üçündür: quraşdırmanı yerli və test şəbəkələrində sınamağa və öz
infrastrukturunuzu planlaşdırmağa kömək edir. Zəncir yalnız bu ilkin şərtlər yerinə yetirildikdə açılır:

- ən azı **iki müstəqil operator** validator işlətməyi yazılı şəkildə qəbul edir (bir operatorun zənciri bir operatorun
  imzaladığı siyahıdan artıq etibar yaratmır);
- kriptoqrafik və əməliyyat dizaynı **müstəqil təhlükəsizlik auditindən** keçir.

Bu sənəddə adı və ya kodu çəkilən dövlətlər üçün yer ayrılıb; bu, razılaşma və ya danışıqlar barədə bildiriş deyil.
:::

**Nə vaxt oxunur:**
- Qurumunuz validator və ya tam qovşaq işlətməyi nəzərdən keçirirsə, infrastrukturu planlaşdırmazdan əvvəl.
- Əvvəl: [Ortaq reyestr (zəncir)](/concepts/ledger) anlayışı və [[GUIDE-0006]] §5 (zəncirin tətbiqlərə təsiri).
- Ətraflı quraşdırma axını və alətlər açıq repozitoriyadadır: `network/` (icazə siyahısı, qovşaq bəyannamələri, RPC qorunması) və
  `docs/ledger/` (Besu şəbəkə arxitekturası, kontrakt spesifikasiyası).
- Qurum tərəfindəki addımların (açar, konfiqurasiya şablonu, bəyannamə, yoxlama) aləti: `tamga-onboard node` (§3, §4, §5, §8).
  Quraşdırma: `npm install -g @tamga-network/onboard` (və ya `npx -p @tamga-network/onboard tamga-onboard …`); təfərrüatlar
  və mənbə kodundan işlətmə [[GUIDE-0014]] § Quraşdırma bölməsindədir.

## Zəncirin rolu

Zəncir imzalanmış siyahıların və lövbər jurnalının **proyeksiyasıdır**, mənbəyi deyil: ziddiyyət olduqda siyahı üstündür
([[ADR-0051]]). İki şey əlavə edir: siyahı versiyasının həşi yalnız hədd sayda müstəqil operator eyni həşi göndərdikdə təsdiqlənir
(müstəqil şahidlik), üzvlük, ortaq sənəd növləri və yeniləmələr isə dövlətlərin 2/3 səsi ilə qərarlaşdırılır (kodda idarəetmə).
Zəncirə şəxsi məlumat, sənəd və ya sənədin həşi yazılmır; ləğv siyahıları zəncirdən kənarda qalır ([[ADR-0008]]). Sandbox zəncirə
yazılmır ([[ADR-0074]] K7).

| Rol | Nə edir | Kim |
|---|---|---|
| Validator | blok təklif edir və imzalayır; idarəetmədə səs verir | hər üzv dövlətin bir validatoru; açar HSM-də |
| Tam qovşaq | zənciri yoxlayır və oxuyur; imzalamır | operatorun öz oxuma qovşağı (siyahı nəşriyyatçısı, indeksləyici, yoxlayıcının oxuma yolu) |

Konsensus QBFT-dir: n validatorda ən çox f = ⌊(n−1)/3⌋ nasazlığa davam gətirir. Hədəf ən azı 4 validatordur (f = 1).

## 1. Avadanlıq və əməliyyat sistemi

Dəqiq ölçü zəncir açılarkən ölçülüb dərc olunur. Planlaşdırma üçün başlanğıc tövsiyə:

| | Tövsiyə |
|---|---|
| Server | ayrılmış (virtual və ya fiziki) Linux server, LTS paylanma; validator başqa iş yükü daşımır |
| Prosessor / yaddaş | 4 nüvə, 8–16 GB yaddaş |
| Disk | SSD, 200 GB-dan başlayaraq; artım izlənilir |
| Şəbəkə | sabit IPv4 və ya IPv6 ünvanı (icazə siyahısı domen adı deyil, ünvan qəbul edir); P2P portu (standart 30303) yalnız icazə siyahısındakı həmyaşıdlara açıq |
| Saat | NTP ilə sinxron (blok vaxt damğası; fərq 5 saniyəni keçməməlidir) |
| Açar | HSM və ya ekvivalent seyf (validator üçün) |
| Giriş | idarəetmə girişi yalnız qurumun idarəetmə şəbəkəsindən; parolla deyil, açarla |

Docker lazım deyil: Besu tək JVM prosesidir və birbaşa xidmət (systemd) kimi işləyir. Konteynerdən istifadə operatorun öz
seçimidir.

## 2. JDK 25 və Besu

- **Java 25** (Eclipse Temurin 25 tövsiyə olunur); Besu 26.6 və sonrakı versiyalar Java 25 tələb edir.
- **Hyperledger Besu** 26.x (yerli sınaqlar 26.11.0 ilə aparılıb). Besu 25.6.0-da zəncirüstü icazələndirmə və Tessera məxfiliyi
  çıxarılıb; Tamga bunlardan istifadə etmir ([[ADR-0052]]).

```bash
# Endirdiyiniz arxivlərin sha256 dəyərini buraxılış səhifəsindəki dəyərlə müqayisə edin, sonra açın
sha256sum besu-26.11.0.tar.gz
tar -xzf besu-26.11.0.tar.gz -C /opt && ln -s /opt/besu-26.11.0 /opt/besu
export JAVA_HOME=/opt/jdk-25
/opt/besu/bin/besu --version
```

Besu-nu ayrıca, imtiyazsız sistem istifadəçisi ilə işlədin; məlumat qovluğu (məs. `/var/lib/besu`) yalnız həmin istifadəçiyə açıq
olsun.

## 3. Qovşaq açarı

Hər qovşağın secp256k1 açarı var. **Validatorda bu açarın ünvanı QBFT validator ünvanıdır** və Governance-a bildirilən validator
ünvanı ilə eyni olmalıdır.

```bash
# Açar yoxdursa, Besu onu yaradır; açıq açarı və ünvanı ixrac edin
/opt/besu/bin/besu --node-private-key-file=/var/lib/besu/key public-key export --to=/var/lib/besu/key.pub
/opt/besu/bin/besu --node-private-key-file=/var/lib/besu/key public-key export-address --to=/var/lib/besu/address
chmod 600 /var/lib/besu/key
```

- Açarı **öz avadanlığınızda** yaradın; heç kimə göndərməyin. Yalnız açıq açar (bəyannamədə) və ünvan (Governance-da) paylaşılır.
- Validator açarı üçün HSM və ya ekvivalent seyf üstün tutulur.
- Yerli sınaq şəbəkələrinin açarları hamıya məlum test açarlarıdır; real qovşaqda heç vaxt istifadə olunmur.

### Alətlə: `tamga-onboard node init`

Eyni işi qoşulma aləti də görür; onu **qovşağın öz maşınında** işlədin:

```bash
tamga-onboard node init --state TR --role validator --ip 192.0.2.10 --interface 10.0.0.10 --out /var/lib/besu
```

| Yazılan | Nə |
|---|---|
| `key` | gizli açar (Besu açar faylı formatı); yalnız sahibi oxuya bilir, üzərinə yazılmır |
| `key.pub`, `node.json` | açıq açar; dövlət kodu, rol, ünvan, interfeys və portlar (bəyannamə və yoxlama bunu oxuyur) |
| `besu.toml` | §4-dəki qaydalarla konfiqurasiya şablonu |

Əmr enode açıq açarını və validator ünvanını (Governance-a bildiriləcək ünvan) çap edir. OneDrive, Dropbox, Google Drive və ya
iCloud ilə sinxronlaşdırılan qovluq rədd edilir (bilərəkdən `--allow-synced`); qovluqda bu fayllardan biri belə varsa, heç biri
yazılmır. Açar HSM-dədirsə, `node init` istifadə olunmur: açıq açarı HSM-dən götürüb §5-dəki `node declare --public-key …` ilə
bəyan edin. Süni intellekt köməkçisi vasitəsilə eyni addım MCP aləti `generate_node_key`-dir; gizli açar heç bir cavabda
qaytarılmır və MCP ilə sinxronlaşdırılan qovluğa heç vaxt yazılmır.

## 4. İcazəli rejim

Hansı qovşağın qoşula biləcəyini və hansı hesabın əməliyyat göndərə biləcəyini hər qovşaqdakı yerli `permissions_config.toml`
müəyyən edir (iki siyahı: `nodes-allowlist`, `accounts-allowlist`). Nümunə `besu.toml` (yer tutucular `<…>`):

```toml
data-path = "/var/lib/besu/data"
genesis-file = "/etc/besu/genesis.json"          # şəbəkənin genesis faylı, zəncir açılarkən operatorlar tərəfindən dərc olunur
node-private-key-file = "/var/lib/besu/key"

p2p-host = "<elan edilən ünvan>"                 # yalnız elan edilən ünvan
p2p-interface = "<P2P interfeysi>"               # dinlənilən interfeys
p2p-port = 30303
discovery-enabled = false
static-nodes-file = "/etc/besu/static-nodes.json"

permissions-nodes-config-file-enabled = true
permissions-accounts-config-file-enabled = true
permissions-nodes-config-file = "/var/lib/besu/permissions_config.toml"
permissions-accounts-config-file = "/var/lib/besu/permissions_config.toml"

rpc-http-enabled = true
rpc-http-host = "127.0.0.1"                      # yalnız qovşağın özündən
rpc-http-port = 8545
rpc-http-api = ["ETH", "NET", "WEB3", "QBFT", "PERM", "ADMIN"]
host-allowlist = ["localhost", "127.0.0.1"]
```

`tamga-onboard node init`-in yazdığı `besu.toml` bu parametrləri daşıyır və bunları qəti edir: JSON-RPC yalnız `127.0.0.1`-də
(`QBFT`, `PERM`, `ADMIN` qovşağın öz istifadəsi üçün; xaricə yalnız §7-dəki proksi vasitəsilə), P2P yalnız `--interface` ilə
verilən daxili interfeysdə dinləyir və `--ip`-ni elan edir (`0.0.0.0` və `::` rədd edilir; `--interface` verilməsə, `--ip`
istifadə olunur), kəşf söndürülüb, iki icazə bayrağı açıqdır, WebSocket və GraphQL söndürülüb.

::: warning Genesis alətlə yaradılmır
`genesis.json` nə `node init` ilə yaradılır, nə də alətlə endirilir. Şəbəkənin operatorlarından, qoşulma yazışmasında bildirilən
kanal vasitəsilə alınır; `sha256` xülasəsini **ən azı iki fərqli operatorla başqa kanal vasitəsilə** müqayisə edin. Xülasə eyni
deyilsə, qovşağı başlatmayın. Qovşaq işləyəndə `node check --chain-rpc` genesis blokunu da müqayisə edir (§8, N3).
`static-nodes.json` da operatorların verdiyi validator enode-ları ilə yazılır.
:::

**İcazə siyahısı əllə yazılmır** (LP2). Hər operator onu zəncirdəki kontrakt vəziyyətindən, açıq repozitoriyadakı alətlə özü
yaradır:

```bash
TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8545 npm run trust:chain-permissions -- render \
  --out /var/lib/besu/permissions_config.rendered.toml [--operator <CC>] [--block <n>]
cp /var/lib/besu/permissions_config.rendered.toml /var/lib/besu/permissions_config.toml
curl -s -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"perm_reloadPermissionsFromFile","params":[]}' http://127.0.0.1:8545
npm run trust:chain-permissions -- check --file /var/lib/besu/permissions_config.rendered.toml --node-rpc http://127.0.0.1:8545
```

| Siyahı | Mənbəyi |
|---|---|
| Hesablar | aktiv üzvlərin validator ünvanları və nümayəndə açarları (Governance), fəal qurumların nümayəndələri, siyahı lövbərləyiciləri, açıq miqrasiya pəncərəsinin icraçısı |
| Qovşaqlar | bəyannaməsi Governance-dakı aktiv validator ünvanı ilə uyğun gələn validator qovşaqları; `--operator` ilə operatorun öz oxuma qovşaqları |

- `render` iki həş çap edir: `sha256` (fayl) və `shared_sha256` (operatorun öz oxuma qovşaqları istisna olmaqla). **Bütün
  validatorlarda `shared_sha256` eyni olmalıdır** (LP3); fərq əməliyyat hadisəsidir və siyahılar eyni blokda (`--block`) yenidən
  yaradılıb müqayisə olunur.
- Besu faylı yenidən yükləyərkən öz formatında yenidən yazır (şərhlər itir). Buna görə yaradılmış fayl ayrıca saxlanılır və
  yoxlama semantikdir (`check`); diskdəki faylın həşi yaradılmış faylın həşi ilə müqayisə olunmur.
- Siyahı bu hallarda yenidən yaradılır: hər Governance qərarı (üzvün qəbulu və ya çıxarılması, lövbərləyici dəyişikliyi),
  nümayəndə dəyişikliyi, qurum statusunun dəyişməsi, miqrasiya pəncərəsinin açılıb bağlanması, yeni qovşaq bəyannaməsi.
- İcazə siyahısı ikinci müdafiə xəttidir; yazma səlahiyyətinin əsas nəzarəti kontraktlardadır (LP4).

## 5. Qovşaq bəyannaməsi

Hər qovşaq JSON bəyannaməsi ilə təqdim olunur (format `tamga-node-declaration/1`; sxem repozitoriyada
`network/permissions/schema/node-declaration.schema.json`, nümunələr `network/permissions/examples/`):

```json
{
  "format": "tamga-node-declaration/1",
  "state": "TR",
  "role": "validator",
  "node_public_key": "<128 kiçik hərfli onaltılıq simvol; 04 və ya 0x prefiksi yoxdur>",
  "ip": "192.0.2.10",
  "p2p_port": 30303,
  "contact": "noc@example.org"
}
```

| Sahə | Qayda |
|---|---|
| `state` | Governance üzv kodu |
| `role` | `validator` (bütün operatorların siyahısına düşür) və ya `rpc` (yalnız bəyan edən operatorun öz siyahısına) |
| `node_public_key` | `public-key export` nəticəsi (§3), prefikssiz |
| `ip`, `p2p_port` | ünvan və P2P portu; domen adı deyil |
| `contact` | qurumun əməliyyat ünvanı və ya səhifəsi — **şəxs adı yoxdur** |

Bəyannaməni qoşulma aləti də yazır (`node init` qovluğundan):

```bash
tamga-onboard node declare /var/lib/besu --contact noc@example.org     # → tr-validator.json; operatora göndərin
```

Əlaqə qurumun vəzifə poçt qutusu və ya https səhifəsidir; vəzifə ünvanına bənzəməyən ünvan xəbərdarlıq alır. Qovşaq qovluğu
yoxdursa (açar HSM-dədir), `--public-key --state --role --ip --p2p-port` birlikdə verilir. Fayl üzərinə yazılmır. MCP aləti:
`create_node_declaration`. Gizli açar heç vaxt göndərilmir.

`validator` bəyannaməsi yalnız `state` aktiv üzvdürsə və açıq açardan alınan ünvan həmin üzvün Governance-dakı validator ünvanıdırsa
siyahıya düşür; əks halda `render` onu rədd edir (çıxış 3). Eyni açarla iki bəyannamə və ya eyni dövlət üçün ikinci validator rədd
edilir. Səhv ünvan və ya port yalnız bağlantını pozur; bəyannamə səlahiyyət vermir. Bəyannamələr zəncirə yazılmır; repozitoriyada
`network/permissions/nodes/` qovluğunda saxlanılır.

## 6. Validator kimi əlavə olunma

Ardıcıllıq vacibdir; hər addım əvvəlkinin tamamlanmasını gözləyir.

| # | Addım | Kim | Necə |
|---|---|---|---|
| 1 | Üzvlük | mövcud üzvlər | Governance-da dövlətin qəbul təklifi (`proposeStateAdmission`, validator ünvanı ilə) və 2/3 səs |
| 2 | Nümayəndə açarları | yeni üzv | dövlətin nümayəndə açarları Governance-a yazılır (`setDelegateKeys`) |
| 3 | Bəyannamə | yeni üzv | §5 bəyannaməsi repozitoriyaya əlavə olunur |
| 4 | İcazə siyahısı | hər operator | `render` → yükləmə → `check`; bütün validatorlarda `shared_sha256` eyni |
| 5 | Sinxronizasiya | yeni üzv | qovşaq tam qovşaq kimi qoşulur və sinxronlaşır (`eth_syncing` = `false`) |
| 6 | QBFT səsi | hər mövcud validator | öz qovşağında, yalnız `127.0.0.1`-dən: `qbft_proposeValidatorVote("<ünvan>", true)` |
| 7 | Səsin təmizlənməsi | hər mövcud validator | səslərin çoxluğu (> 1/2) bloka düşüb dəst dəyişdikdə: `qbft_discardValidatorVote("<ünvan>")` |
| 8 | Yoxlama | hamı | §8 sağlamlıq yoxlaması |

Dəst hər qovşaqda eyni olmalıdır: `qbft_getValidatorsByBlockNumber("latest")`. Yeni validatorun blok təklif etdiyi
`qbft_getSignerMetrics` ilə görünür. Bu, səs gücünün təhvilidir, şəbəkənin dayanması deyil: dəst işləyərkən yenilənir. İki
validatorlu şəbəkədə konsensus üçün hər ikisi onlayn olmalıdır; buna görə hədəf ən azı 4 validatordur.

## 7. RPC qorunması

Qovşağın JSON-RPC nöqtəsi internetə açılmır (LP5). Xarici müştərilər (siyahı nəşriyyatçısı, indeksləyici, yoxlayıcının oxuma yolu)
yalnız qarşılıqlı TLS-li əks proksidən keçir və yalnız `ETH`, `NET`, `WEB3` ad sahələrinə çatır:

```text
müştəri --TLS 1.3 + müştəri sertifikatı--> nginx :8443 --> metod filtri 127.0.0.1:8550 --> Besu 127.0.0.1:8545
```

| Hissə | Nə |
|---|---|
| nginx (`network/rpc-proxy/nginx.conf.example`) | TLS 1.3, `ssl_verify_client on` (operatorun öz müştəri sertifikat orqanı), yalnız `POST /`, 256 KiB gövdə həddi, müştəri başına sürət həddi, giriş jurnalı yoxdur |
| Metod filtri (`network/rpc-proxy/filter.mjs`) | Node 22, asılılıqsız; `eth_*`/`net_*`/`web3_*` keçir (imzalayan, mayninq və abunə metodları istisna olmaqla); paketdə bir çağırış rədd edilərsə, hamısı rədd edilir; jurnala yalnız rədd saylarını yazır |
| systemd vahidi (`network/rpc-proxy/rpc-filter.service.example`) | filtr imtiyazsız istifadəçi ilə, yalnız loopback-də |

`PERM`, `ADMIN`, `QBFT`, `DEBUG`, `TXPOOL` yalnız qovşağın özündən istifadə olunur. P2P portunu təhlükəsizlik divarında yalnız icazə
siyahısındakı həmyaşıdların ünvanlarına açın. Xaricdən sınaq: `admin_peers` → `403`, `eth_blockNumber` → `200`, müştəri sertifikatı
olmadan → TLS rəddi.

## 8. Monitorinq və sağlamlıq

| Yoxlama | Necə | Keçir |
|---|---|---|
| Sinxron | `eth_blockNumber` sizin və istinad qovşağında; `eth_syncing` | fərq ≤ 2 blok, `eth_syncing` = `false` |
| Həmyaşıdlar | `net_peerCount` | validator sayı − 1 və ya çox |
| İcazə siyahısı zəncirlə eynidir | `trust:chain-permissions check` | çıxış 0; `shared_sha256` digər validatorlarla eyni |
| Bəyannamə uyğunluğu | `render` nəticəsində `rejected` və `missing_validator_nodes` | qovşağınız heç birində yoxdur |
| Validator dəstində | `qbft_getValidatorsByBlockNumber("latest")` | ünvanınız var; dəst hər qovşaqda eyni |
| Blok təklif edir | `qbft_getSignerMetrics` | təklif sayı > 0, son təklifi son 2n blok ərzində |
| RPC yalnız loopback-də | `ss -ltnp` və `besu.toml` | 8545 yalnız `127.0.0.1`-də; P2P yalnız gözlənilən interfeysdə |
| Xaricə yalnız eth/net/web3 | proksi vasitəsilə `admin_peers`, `perm_getAccountsAllowlist`, `qbft_proposeValidatorVote`, `eth_sendTransaction` | hamısı `403`; `eth_blockNumber` `200` |
| Saat | son blokun vaxt damğası ilə yerli saat; `timedatectl` | fərq ≤ 5 san, NTP sinxron |

### Alətlə: `tamga-onboard node check`

İşləyən qovşağınızı qoşulma aləti yalnız oxuyaraq yoxlayır; yalnız oxuyan JSON-RPC metodları çağırılır (səs, icazə siyahısının
yüklənməsi, həmyaşıd əlavəsi, əməliyyat yoxdur):

```bash
tamga-onboard node check /var/lib/besu --chain-rpc https://<şəbəkədəki bir nöqtə>   --public-rpc https://<xarici nöqtə> --permissions-file /var/lib/besu/permissions_config.rendered.toml --report report.json
```

| Kod | Yoxlama | Lazımdır |
|---|---|---|
| N1 | Qovşağın yerli RPC nöqtəsi cavab verir | `--rpc` (standart: `besu.toml`-dakı port, `127.0.0.1`-də) |
| N2 | Sinxron: `eth_syncing` və müqayisə nöqtəsi ilə blok fərqi | `--chain-rpc` (olmasa, yalnız `eth_syncing`) |
| N3 | Eyni zəncir: genesis bloku müqayisə nöqtəsindəki ilə eynidir | `--chain-rpc` |
| N4 | Həmyaşıd sayı | — |
| N5 | İşləyən açar `node.json` və bəyannamə ilə eynidir | qovşaq qovluğu, `--declaration` |
| N6 | Qovşaq və hesab icazə siyahıları yaradılmış faylla və müqayisə nöqtəsi ilə eynidir | `--permissions-file`, `--chain-rpc` |
| N7 | Ünvanınız validator dəstindədir | validator rolu |
| N8 | Xarici nöqtə `admin_`, `perm_`, `qbft_`, `debug_`, `txpool_` və `eth_accounts`-u rədd edir, `eth_blockNumber` və `net_version`-a cavab verir | `--public-rpc` (`--client-cert`, `--client-key` ilə mTLS) |
| N9 | `besu.toml`: interfeyslər, ad sahələri, icazə bayraqları | qovşaq qovluğu və ya `--config` |
| N10 | Saat: son blokun vaxt damğası ilə fərq | — |

Çıxış `0` hamısı keçdi və ya yalnız xəbərdarlıq, `1` bir yoxlama keçmədi; `--json` və `--report` JSON hesabat verir.

**Ünvan qaydaları.** Ünvanlar yalnız sizin yazdıqlarınızdır; fayldan yalnız `besu.toml`-dakı yerli RPC portu oxunur. Loopback
(`127.0.0.1`) standart olaraq açıqdır, çünki idarəetmə nöqtəsi layihə üzrə oradadır. Digər yerli və xüsusi şəbəkələr (RFC 1918,
link-local / bulud metaməlumat nöqtəsi, CGNAT, ULA) yalnız `--allow-private` ilə, ad həll olunduqdan sonra da; sadə http yalnız
loopback və xüsusi şəbəkə ünvanlarında; yönləndirmələr izlənmir. MCP aləti `check_node` loopback və xüsusi ünvanlara yalnız
mənşəyi serverin `TAMGA_ONBOARD_PRIVATE_NODES` mühit dəyişənində (vergüllə ayrılmış, məs. `http://127.0.0.1:8545`) yazılıbsa
çatır; xarici ünvanlara yalnız https ilə.

Yuxarıdakı cədvəldəki bəyannamə uyğunluğu, blok təklifi və səs yoxlamaları operator səlahiyyəti tələb edir; onlar operatorda
qalır.

Besu metrikləri yalnız yerli interfeysdə açılır (`metrics-enabled = true`, `metrics-host = "127.0.0.1"`) və qurumun öz monitorinq
sistemi (məs. Prometheus) tərəfindən oradan götürülür. Xidməti avtomatik yenidən başlatma ilə işlədin (systemd `Restart=on-failure`)
və blok hündürlüyü dayandıqda, həmyaşıd sayı azaldıqda və ya `check` fərq tapdıqda xəbərdarlıq verin.

## 9. Ehtiyat nüsxə və açar gigiyenası

| Ehtiyat nüsxəsi çıxarılır | Çıxarılmır |
|---|---|
| qovşaq açarı (şifrələnmiş, oflayn, ayrı yerdə) | zəncir məlumatları (digər qovşaqlardan yenidən sinxronlaşır) |
| `besu.toml`, genesis, statik həmyaşıdlar, bəyannamə | icazə faylı (zəncirdən yenidən yaradılır) |

- Açar qovşaqda `600` icazəsi ilə və ya HSM-də saxlanılır; heç vaxt repozitoriyaya, söhbətə, jurnala, bilete düşmür.
- Açarın dəyişdirilməsi yeni validator ünvanı deməkdir: Governance-da ünvanın yenilənməsi, yeni bəyannamə, hər operatorda yeni icazə
  siyahısı və QBFT əlavə / çıxarma səsi tələb olunur. Bu ardıcıllığın kontrakt səviyyəsindəki təfərrüatı zəncir açılarkən
  dəqiqləşir.
- Açarın ələ keçirildiyindən şübhələnirsinizsə, qovşağı dayandırın və digər operatorlara dərhal bildirin; ünvan dəstdən səsvermə ilə
  çıxarılır.
- Zəncirə, icazə faylına və bəyannaməyə şəxsi məlumat düşmür; bəyannamədəki əlaqə qurumun vəzifə ünvanıdır.

## 10. Çıxış və təhvil

**Təhvil** (məs. operatorun validatorundan dövlətin öz validatoruna): əvvəlcə yeni validator §6-dakı addımlarla əlavə olunur, sonra
köhnəsi çıxarılır. Dəst heç bir anda həddən aşağı düşmür.

**Çıxış:**
1. Mövcud validatorlar öz qovşaqlarında səs verir: `qbft_proposeValidatorVote("<ünvan>", false)`; n validatorda ⌊n/2⌋ + 1 səs
   lazımdır. Dəst dəyişdikdən sonra gözləyən səs `qbft_discardValidatorVote` ilə təmizlənir.
2. Governance-da üzvün çıxarılması (`proposeStateRemoval`, 2/3 səs).
3. Hər operator icazə siyahısını yenidən yaradır; qovşaq siyahıdan çıxdıqda həmyaşıd bağlantıları dərhal kəsilir.
4. Çıxan operator qovşaq açarını və nümayəndə açarlarını təhlükəsiz şəkildə məhv edir; bəyannaməsi repozitoriyadan çıxarılır.

Zəncirdəki tarixçə silinmir; geri qayıdan üzv yeni qəbul təklifi ilə qoşulur.

## Yerli sınaq

Kontraktları, icazə siyahısının zəncirdən yaradılmasını və validator səsverməsini öz kompüterinizdə sınaya bilərsiniz.
Repozitoriyanın kökündən (Windows PowerShell):

```powershell
powershell -File scripts\besu-dev.ps1 -Init -Permissioned            # genesis, iki açar, iki qovşaq bəyannaməsi
powershell -File scripts\besu-dev.ps1 -Start -Permissioned           # qovşaq 1 (RPC 8546)
npm run chain:besu:deploy                                            # kontraktlar
powershell -File scripts\besu-dev.ps1 -Apply -Permissioned           # icazə siyahısı zəncirdən: render → yükləmə → check
powershell -File scripts\besu-dev.ps1 -Start -Permissioned -Node 2   # qovşaq 2 (RPC 8547); sonra yenidən -Apply
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-add      # qovşaq 2 validator dəstinə
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-remove   # və çıxarılır
powershell -File scripts\besu-dev.ps1 -Stop -Permissioned
```

Bu şəbəkənin açarları hamıya məlum test açarlarıdır və yalnız `127.0.0.1`-də işləyir. Linux və macOS üçün eyni parametrlər əllə:
repozitoriyada `docs/ledger/architecture/0002-besu-network-setup-step-by-step.md`. RPC filtri yerli olaraq:
`TAMGA_RPC_FILTER_UPSTREAM=http://127.0.0.1:8546 node network/rpc-proxy/filter.mjs`.

## Problemlərin həlli

| Əlamət | Səbəb | Həll |
|---|---|---|
| "Sender account not authorized to send transactions" | hesab icazə siyahısında deyil | düzgün davranış ola bilər; deyilsə, icazə siyahısını yenidən yaradıb yükləyin |
| Həmyaşıd yoxdur, "Bootnode(s) not in nodes-allowlist" | qovşaq siyahısı natamamdır | bəyannamə + `render` + yükləmə; statik həmyaşıd təxminən 1 dəqiqəyə qoşulur |
| `render` çıxış 3 | bəyannamə rədd edildi və ya `check` fərq tapdı | bəyannamədəki açıq açar Governance-dakı validator ünvanı ilə uyğun gəlirmi |
| `shared_sha256` fərqlidir | operatorlar fərqli bloklarda yaradıb və ya biri yükləməyib | eyni `--block` ilə yenidən yaradıb müqayisə edin |
| Qovşaq səhv interfeysdə dinləyir | `p2p-host` yalnız elan edilən ünvandır | dinləmə `p2p-interface` ilə müəyyən olunur |
| Genesis və ya TOML oxunmur (Windows) | fayl BOM ilə yazılıb | BOM-suz UTF-8 və LF |
| Besu başlamır | Java versiyası | JDK 25 və `JAVA_HOME` |

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[ADR-0009]] K4 | Zəncir ən azı iki müstəqil operatorun yazılı qəbulu ilə açılır |
| [[ADR-0051]] | Zəncir imzalanmış siyahıların proyeksiyasıdır; ziddiyyətdə siyahı üstündür |
| [[ADR-0052]] LP1–LP5 | Yerli icazələndirmə; siyahı zəncirdən yaradılır, əllə yazılmır; bütün validatorlarda eynidir; səlahiyyət kontraktlardadır; RPC internetə açılmır |
| [[ADR-0074]] K7 | Sandbox zəncirə yazılmır |
| [[ADR-0008]] | Ləğv siyahıları zəncirdən kənarda qalır |

Anlayış: [Ortaq reyestr (zəncir)](/concepts/ledger). Qaydalar: [Tamga ARF — Arxitektura](https://arf.tamga.network/az/architecture).
