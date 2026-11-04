# scripts/besu-dev.ps1 — Yerel Besu QBFT geliştirme ağı (Docker'sız; tek doğrulayıcı). YALNIZ yerel geliştirme içindir:
# gerçek ağ ≥2 bağımsız doğrulayıcı işletmecisiyle kurulur (ADR-0009 K4) ve bu betikle kurulmaz.
#
# Kullanım (depo kökünden; npm komutları aynı şeyi çağırır):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Init     # npm run chain:besu:init
#   ... -Start   # npm run chain:besu:start    ... -Stop    # npm run chain:besu:stop
#   ... -Reset   # npm run chain:besu:reset    ... -Status  # npm run chain:besu:status
#
# -Init  : JDK 25 (Temurin) ve Besu yoksa resmi kaynaktan indirir (sha256 sabit doğrulanır) → tools/; genesis ve tek
#          doğrulayıcı anahtarı → network/dev/ (anahtar her bilgisayarda yerelde üretilir, depoya girmez). Var olanı ezmez.
# -Start : 127.0.0.1 üzerinde başlatır (RPC 8546 — 8545 Hardhat'indir; P2P 30313, keşif kapalı), blok artışını bekler.
#          Gerçek süreç java.exe'dir; PID'i network/dev/data/besu.pid'e yazılır. Log: network/dev/data/besu.log
# -Stop  : süreci durdurur.   -Reset : durdurur, zincir verisini siler (genesis ve anahtar korunur).
# -Status: chainId, blok numarası, doğrulayıcılar.
# Hesaplar: Hardhat'in herkesçe bilinen test hesapları (#0..#9) genesis'te bakiyelidir — gerçek anahtar YOK.
#
# İzinli kip (ADR-0052, C33 (4)) — ayrı bir yerel ağ, network/dev/perm/ (gitignore), iki düğüm:
#   ... -Init -Permissioned            genesis (tek kurucu doğrulayıcı = düğüm 1) + iki düğüm anahtarı + düğüm bildirimleri
#   ... -Start -Permissioned [-Node 2] düğüm 1: RPC 8546 / P2P 30313; düğüm 2: RPC 8547 / P2P 30314 (düğüm 1'e statik eş)
#   ... -Apply -Permissioned           çalışan her düğüm için izin listesini ZİNCİRDEN üretir (trust:chain-permissions render),
#                                      perm_reloadPermissionsFromFile ile yükler ve check ile denetler
#   ... -Stop|-Reset|-Status -Permissioned
#   İki bayrak açık: --permissions-nodes-config-file-enabled, --permissions-accounts-config-file-enabled. PERM ve ADMIN ad
#   alanları yalnız 127.0.0.1'de (düğüm zaten yalnız loopback dinler). Düğüm anahtarları Hardhat test hesapları #1 (TR
#   doğrulayıcısı) ve #2 (KZ doğrulayıcısı): böylece QBFT doğrulayıcı adresi = Governance'taki validator adresi = enode adresi
#   (ADR-0052 K2 eşleşme kuralı). İlk izin dosyası (kontratlardan önce) = kurucu doğrulayıcının düğümü + yerel dağıtımın
#   hesapları #0..#4 (dağıtan, TR/KZ doğrulayıcıları, TR/KZ delegeleri); kontratlar kurulunca -Apply zincirden yeniden üretir.
#   Doğrulayıcı ekleme/çıkarma: qbft_proposeValidatorVote (apps/trust-publisher/scripts/besu-permissions-smoke.ts).
# Windows PowerShell 5.1 ile çalışır. Linux/macOS karşılığı: docs/ledger/architecture/0002-besu-network-setup-step-by-step.md
param(
  [switch]$Init, [switch]$Start, [switch]$Stop, [switch]$Reset, [switch]$Status, [switch]$Apply,
  [switch]$Permissioned, [ValidateSet(1, 2)][int]$Node = 1
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# --- Sabitler (sürüm yükseltmesi: sürüm + adres + sha256 birlikte değişir) ---------------------------------------------
$BesuVersion = "26.11.0"
$BesuUrl     = "https://github.com/besu-eth/besu/releases/download/$BesuVersion/besu-$BesuVersion.zip"
$BesuSha256  = "a3c947c33afc7eb7e1c1688c7122334d6258bfdca0fec64fedbe0d007b5978d1"
$JdkFile     = "OpenJDK25U-jdk_x64_windows_hotspot_25.0.5_8.zip"
$JdkUrl      = "https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.5%2B8/$JdkFile"
$JdkSha256   = "636bdc13dc649ddc7d5921c5c7d23cca6e44fd19d662b45cc9c02135a6c96c42"
$ChainId     = 31338
$RpcPort     = 8546
$P2pPort     = 30313
# Hardhat'in herkese açık test hesapları (anımsatıcı "test test ... junk", #0..#9) — yalnız yerel geliştirme
$DevAccounts = @(
  "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "90F79bf6EB2c4f870365E785982E1f101E93b906",
  "15d34AAf54267DB7D7c367839AAf71A00a2C6A65", "9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  "976EA74026E726554dB657fA54763abd0C3a0aa9", "14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  "23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", "a0Ee7A142d267C1f36714E4a8F75612F20a79720"
)

# --- Yollar -------------------------------------------------------------------------------------------------------------
$Root     = Split-Path -Parent $PSScriptRoot
$Tools    = Join-Path $Root "tools"
$Dl       = Join-Path $Tools "_dl"
$JdkDir   = Join-Path $Tools "jdk-25"
$BesuDir  = Join-Path $Tools "besu-$BesuVersion"
$BesuBat  = Join-Path $BesuDir "bin\besu.bat"
$Dev      = Join-Path $Root "network\dev"
$Genesis  = Join-Path $Dev "genesis.json"
$Keys     = Join-Path $Dev "keys"
$NodeKey  = Join-Path $Keys "key"
$Data     = Join-Path $Dev "data"
$DbDir    = Join-Path $Data "db"
$PidFile  = Join-Path $Data "besu.pid"
$LogFile  = Join-Path $Data "besu.log"
$ErrFile  = Join-Path $Data "besu.err.log"
$TomlFile = Join-Path $Data "besu.toml"
$Rpc      = "http://127.0.0.1:$RpcPort"

function Say($m) { Write-Host "[besu-dev] $m" }

# BOM'suz UTF-8, LF satır sonu (Windows PowerShell 5.1'in Set-Content/Out-File'ı BOM yazar)
function Write-Utf8NoBom($path, [string]$text) {
  [System.IO.File]::WriteAllText($path, ($text -replace "`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Sha256($path) { (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() }

function Get-Verified($url, $file, $sha) {
  New-Item -ItemType Directory -Force $Dl | Out-Null
  $dest = Join-Path $Dl $file
  if ((Test-Path -LiteralPath $dest) -and ((Get-Sha256 $dest) -eq $sha)) { Say "onbellekte: $file"; return $dest }
  Say "indiriliyor: $url"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dest
  $got = Get-Sha256 $dest
  if ($got -ne $sha) {
    Remove-Item -LiteralPath $dest -Force
    throw "sha256 UYUSMUYOR: $file (beklenen $sha, gelen $got) - dosya silindi"
  }
  Say "sha256 dogrulandi: $file"
  return $dest
}

# Zip'i geçici klasöre açar; içindeki tek üst klasörü hedef ada taşır
function Expand-Into($zip, $target) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $tmp = Join-Path $Tools ("_x-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
  $inner = @(Get-ChildItem -LiteralPath $tmp -Directory)
  if ($inner.Count -ne 1) { throw "beklenmeyen zip yapisi: $zip" }
  Move-Item -LiteralPath $inner[0].FullName -Destination $target
  Remove-Item -LiteralPath $tmp -Recurse -Force
}

function Use-Java {
  $java = Join-Path $JdkDir "bin\java.exe"
  if (-not (Test-Path -LiteralPath $java)) { throw "JDK 25 yok ($JdkDir) - once: npm run chain:besu:init" }
  if (-not (Test-Path -LiteralPath $BesuBat)) { throw "Besu yok ($BesuDir) - once: npm run chain:besu:init" }
  $env:JAVA_HOME = $JdkDir
}

function Invoke-Rpc($method, $params = @(), $url = $Rpc) {
  $body = @{ jsonrpc = "2.0"; id = 1; method = $method; params = $params } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
  if ($r.error) { throw "RPC $method hatasi: $($r.error.message)" }
  return $r.result
}

function Get-BlockNumber($url = $Rpc) { try { [Convert]::ToInt64((Invoke-Rpc "eth_blockNumber" @() $url), 16) } catch { -1 } }

# besu.bat cmd.exe ile çalışır; asıl süreç onun java.exe çocuğudur — PID'i java.exe'nin PID'idir (Stop onu durdurur)
function Start-BesuJava($tomlFile, $workDir, $logFile, $errFile, $pidFile) {
  $cmd = Start-Process -PassThru -WindowStyle Hidden -WorkingDirectory $workDir -FilePath $BesuBat `
    -ArgumentList "--config-file=`"$tomlFile`"" -RedirectStandardOutput $logFile -RedirectStandardError $errFile
  $javaPid = $null
  for ($i = 0; $i -lt 40 -and -not $javaPid; $i++) {
    Start-Sleep -Milliseconds 500
    $child = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($cmd.Id) AND Name='java.exe'" -ErrorAction SilentlyContinue
    if ($child) { $javaPid = @($child)[0].ProcessId }
    elseif ($cmd.HasExited) { break }
  }
  if (-not $javaPid) { throw "java.exe sureci bulunamadi - log: $logFile / $errFile" }
  Write-Utf8NoBom $pidFile "$javaPid`n"
  return $javaPid
}

function Get-PidFrom($pidFile) {
  if (-not (Test-Path -LiteralPath $pidFile)) { return $null }
  $p = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
  $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq "java") { return $p }
  return $null
}

function Get-RunningPid {
  if (-not (Test-Path -LiteralPath $PidFile)) { return $null }
  $p = [int](Get-Content -LiteralPath $PidFile -Raw).Trim()
  $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq "java") { return $p }
  return $null
}

function Install-Tools {
  if (-not (Test-Path -LiteralPath (Join-Path $JdkDir "bin\java.exe"))) {
    Expand-Into (Get-Verified $JdkUrl $JdkFile $JdkSha256) $JdkDir
    Say "JDK 25 kuruldu: $JdkDir"
  } else { Say "JDK 25 mevcut" }
  if (-not (Test-Path -LiteralPath $BesuBat)) {
    Expand-Into (Get-Verified $BesuUrl "besu-$BesuVersion.zip" $BesuSha256) $BesuDir
    Say "Besu $BesuVersion kuruldu: $BesuDir"
  } else { Say "Besu $BesuVersion mevcut" }
}

function Invoke-Init {
  Install-Tools
  Use-Java

  if ((Test-Path -LiteralPath $Genesis) -and (Test-Path -LiteralPath $NodeKey)) {
    Say "genesis ve dogrulayici anahtari mevcut (yeniden uretmek icin network\dev\genesis.json ve keys\ silinir)"
    return
  }
  New-Item -ItemType Directory -Force $Dev | Out-Null
  $alloc = ($DevAccounts | ForEach-Object { "      `"$_`": { `"balance`": `"0x3635C9ADC5DEA00000`" }" }) -join ",`n"
  $cfg = @"
{
  "genesis": {
    "config": {
      "chainId": $ChainId,
      "berlinBlock": 0,
      "londonBlock": 0,
      "shanghaiTime": 0,
      "zeroBaseFee": true,
      "qbft": { "blockperiodseconds": 2, "epochlength": 30000, "requesttimeoutseconds": 4 }
    },
    "nonce": "0x0",
    "timestamp": "0x0",
    "gasLimit": "0x1fffffffffffff",
    "difficulty": "0x1",
    "mixHash": "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
    "coinbase": "0x0000000000000000000000000000000000000000",
    "alloc": {
$alloc
    }
  },
  "blockchain": { "nodes": { "generate": true, "count": 1 } }
}
"@
  $work = Join-Path $Dev ("_gen-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  New-Item -ItemType Directory -Force $work | Out-Null
  $cfgFile = Join-Path $work "qbft-config.json"
  Write-Utf8NoBom $cfgFile $cfg
  $out = Join-Path $work "out"
  & $BesuBat operator generate-blockchain-config "--config-file=$cfgFile" "--to=$out" "--private-key-file-name=key" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "besu operator generate-blockchain-config basarisiz (cikis $LASTEXITCODE)" }
  $keyDir = @(Get-ChildItem -LiteralPath (Join-Path $out "keys") -Directory)
  if ($keyDir.Count -ne 1) { throw "beklenen tek dogrulayici anahtari uretilmedi" }
  New-Item -ItemType Directory -Force $Keys | Out-Null
  Copy-Item -LiteralPath (Join-Path $keyDir[0].FullName "key") -Destination $NodeKey -Force
  Copy-Item -LiteralPath (Join-Path $keyDir[0].FullName "key.pub") -Destination (Join-Path $Keys "key.pub") -Force
  $g = [System.IO.File]::ReadAllText((Join-Path $out "genesis.json"))
  Write-Utf8NoBom $Genesis $g
  Remove-Item -LiteralPath $work -Recurse -Force
  Say "genesis: $Genesis (chainId $ChainId)"
  Say "dogrulayici: $($keyDir[0].Name) (anahtar network\dev\keys\, depoya girmez)"
}

function Invoke-Start {
  Use-Java
  if (-not (Test-Path -LiteralPath $Genesis) -or -not (Test-Path -LiteralPath $NodeKey)) {
    throw "genesis ya da anahtar yok - once: npm run chain:besu:init"
  }
  $running = Get-RunningPid
  if ($running) { Say "zaten calisiyor (PID $running)"; Invoke-Status; return }
  $busy = Get-NetTCPConnection -State Listen -LocalPort $RpcPort, $P2pPort -ErrorAction SilentlyContinue
  if ($busy) { throw "port dolu ($RpcPort/$P2pPort, PID $(($busy.OwningProcess | Select-Object -Unique) -join ','))" }
  New-Item -ItemType Directory -Force $Data | Out-Null
  $fwd = { param($p) $p -replace "\\", "/" }
  # Yapılandırma TOML'da (yol tırnaklama sorunu yok); yalnız 127.0.0.1, keşif kapalı, gaz fiyatı 0
  $toml = @"
data-path="$(& $fwd $DbDir)"
genesis-file="$(& $fwd $Genesis)"
node-private-key-file="$(& $fwd $NodeKey)"
p2p-host="127.0.0.1"
p2p-interface="127.0.0.1"
p2p-port=$P2pPort
discovery-enabled=false
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=$RpcPort
rpc-http-api=["ETH","NET","WEB3","QBFT"]
host-allowlist=["localhost","127.0.0.1"]
min-gas-price=0
color-enabled=false
"@
  Write-Utf8NoBom $TomlFile $toml
  $before = Get-Date
  $javaPid = Start-BesuJava $TomlFile $Data $LogFile $ErrFile $PidFile
  Say "baslatildi (java.exe PID $javaPid), blok bekleniyor..."
  $first = -1
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    if (-not (Get-Process -Id $javaPid -ErrorAction SilentlyContinue)) { throw "Besu durdu - log: $LogFile" }
    $b = Get-BlockNumber
    if ($b -ge 0 -and $first -lt 0) { $first = $b }
    if ($first -ge 0 -and $b -gt $first) {
      Say ("blok uretiliyor ({0} -> {1}, {2:N0} sn)" -f $first, $b, ((Get-Date) - $before).TotalSeconds)
      Invoke-Status
      return
    }
  }
  throw "90 sn icinde blok artmadi - log: $LogFile"
}

function Invoke-Stop {
  $p = Get-RunningPid
  if ($p) {
    Stop-Process -Id $p -Force
    for ($i = 0; $i -lt 20 -and (Get-Process -Id $p -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 250 }
    Say "durduruldu (PID $p)"
  } else { Say "calismiyor" }
  if (Test-Path -LiteralPath $PidFile) { Remove-Item -LiteralPath $PidFile -Force }
}

function Invoke-Reset {
  Invoke-Stop
  if (Test-Path -LiteralPath $Data) { Remove-Item -LiteralPath $Data -Recurse -Force }
  Say "zincir verisi silindi (genesis ve anahtar korundu); yeniden: npm run chain:besu:start"
}

function Invoke-Status {
  $p = Get-RunningPid
  if (-not $p) { Say "calismiyor"; return }
  try {
    $cid = [Convert]::ToInt64((Invoke-Rpc "eth_chainId"), 16)
    $bn = Get-BlockNumber
    $vals = Invoke-Rpc "qbft_getValidatorsByBlockNumber" @("latest")
    Say "PID $p | RPC $Rpc | chainId $cid | blok $bn | dogrulayicilar: $($vals -join ', ')"
  } catch { Say "PID $p calisiyor ama RPC yanit vermiyor ($Rpc): $($_.Exception.Message)" }
}

# =======================================================================================================================
# İzinli kip (ADR-0052) — network/dev/perm/
# =======================================================================================================================
$Perm        = Join-Path $Dev "perm"
$PermGenesis = Join-Path $Perm "genesis.json"
$PermDecls   = Join-Path $Perm "nodes"
# Düğüm anahtarları: Hardhat test hesapları #1 ve #2 (herkesçe bilinen anımsatıcı; YALNIZ yerel). Açık anahtar = enode kimliği.
$PermNodes = @{
  1 = @{ State = "TR"; Key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
         Pub = "ba5734d8f7091719471e7f7ed6b9df170dc70cc661ca05e688601ad984f068b0d67351e5f06073092499336ab0839ef8a521afd334e53807205fa2f08eec74f4"
         Address = "70997970c51812dc3a010c7d01b50e0d17dc79c8"; Rpc = 8546; P2p = 30313 }
  2 = @{ State = "KZ"; Key = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
         Pub = "9d9031e97dd78ff8c15aa86939de9b1e791066a0224e331bc962a2099a7b1f0464b8bbafe1535f2301c72c2cb3535b172da30b02686ab0393d348614f157fbdb"
         Address = "3c44cdddb6a900fa2b585dd299e03d12fa4293bc"; Rpc = 8547; P2p = 30314 }
}
function PermDir($n) { Join-Path $Perm "node$n" }
function PermRpc($n) { "http://127.0.0.1:$($PermNodes[$n].Rpc)" }
function PermEnode($n) { "enode://$($PermNodes[$n].Pub)@127.0.0.1:$($PermNodes[$n].P2p)" }
function PermPidFile($n) { Join-Path (PermDir $n) "besu.pid" }
function PermConfig($n) { Join-Path (PermDir $n) "permissions_config.toml" }

function Invoke-PermInit {
  Install-Tools  # JDK + Besu (varsa atlanır); tek düğümlü geliştirme ağının dosyalarına dokunmaz
  Use-Java
  if (Test-Path -LiteralPath $PermGenesis) { Say "izinli kip: genesis mevcut ($PermGenesis)"; return }
  New-Item -ItemType Directory -Force $Perm, $PermDecls | Out-Null
  $work = Join-Path $Perm ("_gen-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  New-Item -ItemType Directory -Force $work | Out-Null
  # QBFT extraData: tek kurucu doğrulayıcı = düğüm 1 (TR). Düğüm 2 tam düğüm olarak katılır, sonra oyla doğrulayıcı olur.
  Write-Utf8NoBom (Join-Path $work "validators.json") "[`"$($PermNodes[1].Address)`"]"
  & $BesuBat rlp encode "--from=$(Join-Path $work 'validators.json')" "--to=$(Join-Path $work 'extra.txt')" --type=QBFT_EXTRA_DATA | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "besu rlp encode basarisiz (cikis $LASTEXITCODE)" }
  $extra = ([System.IO.File]::ReadAllText((Join-Path $work "extra.txt"))).Trim()
  $alloc = ($DevAccounts | ForEach-Object { "    `"$_`": { `"balance`": `"0x3635C9ADC5DEA00000`" }" }) -join ",`n"
  $g = @"
{
  "config": {
    "chainId": $ChainId,
    "berlinBlock": 0,
    "londonBlock": 0,
    "shanghaiTime": 0,
    "zeroBaseFee": true,
    "qbft": { "blockperiodseconds": 2, "epochlength": 30000, "requesttimeoutseconds": 4 }
  },
  "nonce": "0x0",
  "timestamp": "0x0",
  "gasLimit": "0x1fffffffffffff",
  "difficulty": "0x1",
  "mixHash": "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
  "coinbase": "0x0000000000000000000000000000000000000000",
  "extraData": "$extra",
  "alloc": {
$alloc
  }
}
"@
  Write-Utf8NoBom $PermGenesis $g
  Remove-Item -LiteralPath $work -Recurse -Force
  foreach ($n in 1, 2) {
    $d = PermDir $n
    New-Item -ItemType Directory -Force $d | Out-Null
    Write-Utf8NoBom (Join-Path $d "key") $PermNodes[$n].Key
    # Düğüm bildirimi (network/permissions biçimi) — yerel ağ için 127.0.0.1
    $decl = @"
{
  "format": "tamga-node-declaration/1",
  "state": "$($PermNodes[$n].State)",
  "role": "validator",
  "node_public_key": "$($PermNodes[$n].Pub)",
  "ip": "127.0.0.1",
  "p2p_port": $($PermNodes[$n].P2p),
  "contact": "noc@example.org"
}
"@
    Write-Utf8NoBom (Join-Path $PermDecls ("{0}-node{1}.json" -f $PermNodes[$n].State.ToLower(), $n)) $decl
  }
  Say "izinli kip hazir: $Perm (genesis dogrulayicisi 0x$($PermNodes[1].Address), dugum 2 = 0x$($PermNodes[2].Address))"
}

# Kontratlardan önceki ilk izin dosyası (ADR-0052 K2 "Başlangıç"): kurucu doğrulayıcının düğümü + yerel dağıtımın hesapları
function Write-PermBootstrap($n) {
  $accts = ($DevAccounts[0..4] | ForEach-Object { "  `"0x$($_.ToLower())`"," }) -join "`n"
  $toml = "# BASLANGIC (kontratlardan once) - kontratlar kurulunca -Apply zincirden yeniden uretir`n" +
    "accounts-allowlist=[`n$accts`n]`nnodes-allowlist=[`n  `"$(PermEnode 1)`",`n]`n"
  Write-Utf8NoBom (PermConfig $n) $toml
}

function Invoke-PermStart($n) {
  Use-Java
  if (-not (Test-Path -LiteralPath $PermGenesis)) { throw "izinli kip kurulmamis - once: besu-dev.ps1 -Init -Permissioned" }
  $pf = PermPidFile $n
  $running = Get-PidFrom $pf
  if ($running) { Say "dugum $n zaten calisiyor (PID $running)"; return }
  $single = Get-RunningPid
  if ($single) { throw "tek dugumlu gelistirme agi calisiyor (PID $single) - once: npm run chain:besu:stop" }
  $node = $PermNodes[$n]
  $busy = Get-NetTCPConnection -State Listen -LocalPort $node.Rpc, $node.P2p -ErrorAction SilentlyContinue
  if ($busy) { throw "port dolu ($($node.Rpc)/$($node.P2p), PID $(($busy.OwningProcess | Select-Object -Unique) -join ','))" }
  $d = PermDir $n
  $cfg = PermConfig $n
  if (-not (Test-Path -LiteralPath $cfg)) { Write-PermBootstrap $n; Say "dugum ${n}: baslangic izin dosyasi yazildi" }
  $fwd = { param($p) $p -replace "\\", "/" }
  $static = ""
  if ($n -eq 2) {
    $sf = Join-Path $d "static-nodes.json"
    Write-Utf8NoBom $sf "[`"$(PermEnode 1)`"]"
    $static = "static-nodes-file=`"$(& $fwd $sf)`"`n"
  }
  # İki izin bayrağı açık (ADR-0052 K1); PERM/ADMIN/QBFT yalnız 127.0.0.1 (LP5 — düğüm dışarı dinlemez)
  $toml = @"
data-path="$(& $fwd (Join-Path $d 'db'))"
genesis-file="$(& $fwd $PermGenesis)"
node-private-key-file="$(& $fwd (Join-Path $d 'key'))"
p2p-host="127.0.0.1"
p2p-interface="127.0.0.1"
p2p-port=$($node.P2p)
discovery-enabled=false
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=$($node.Rpc)
rpc-http-api=["ETH","NET","WEB3","QBFT","PERM","ADMIN"]
host-allowlist=["localhost","127.0.0.1"]
min-gas-price=0
color-enabled=false
permissions-nodes-config-file-enabled=true
permissions-nodes-config-file="$(& $fwd $cfg)"
permissions-accounts-config-file-enabled=true
permissions-accounts-config-file="$(& $fwd $cfg)"
$static
"@
  $tf = Join-Path $d "besu.toml"
  Write-Utf8NoBom $tf $toml
  $log = Join-Path $d "besu.log"
  $javaPid = Start-BesuJava $tf $d $log (Join-Path $d "besu.err.log") $pf
  $url = PermRpc $n
  Say "dugum $n baslatildi (java.exe PID $javaPid, RPC $url), RPC bekleniyor..."
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    if (-not (Get-Process -Id $javaPid -ErrorAction SilentlyContinue)) { throw "dugum $n durdu - log: $log" }
    if ((Get-BlockNumber $url) -ge 0) { Invoke-PermStatus; return }
  }
  throw "90 sn icinde RPC acilmadi - log: $log"
}

# İzin listesini zincirden üret → yükle → denetle (her düğüm kendi dosyasını kendisi üretir; ADR-0052 K3). Besu yeniden yüklerken
# dosyayı kendi biçimiyle yeniden yazar (yorumlar gider) — bu yüzden çizim ayrı dosyada kalır (permissions_config.rendered.toml),
# düğümün dosyasına kopyalanır; karşılaştırma dosya özetiyle değil `check` (anlamsal fark) ve çizimin özetiyle yapılır.
function Invoke-PermApply {
  $tsx = Join-Path $Root "node_modules\tsx\dist\cli.mjs"
  $cli = Join-Path $Root "apps\trust-publisher\src\cli.ts"
  $shared = @{}
  foreach ($n in 1, 2) {
    if (-not (Get-PidFrom (PermPidFile $n))) { continue }
    $url = PermRpc $n
    $rendered = Join-Path (PermDir $n) "permissions_config.rendered.toml"
    $env:TAMGA_CHAIN_RPC_URL = $url
    $out = & node $tsx $cli chain-permissions render --nodes $PermDecls --out $rendered
    $code = $LASTEXITCODE
    if ($code -ne 0 -and $code -ne 3) { throw "dugum ${n}: render basarisiz (cikis $code)" }
    $rep = ($out -join "`n") | ConvertFrom-Json
    Copy-Item -LiteralPath $rendered -Destination (PermConfig $n) -Force
    $null = Invoke-Rpc "perm_reloadPermissionsFromFile" @() $url
    $shared[$n] = $rep.shared_sha256
    Say ("dugum {0}: blok {1} | sha256 {2} | paylasilan {3} | hesap {4}, dugum {5}" -f $n, $rep.block, $rep.sha256, $rep.shared_sha256, $rep.accounts, $rep.nodes)
    if ($rep.rejected.Count) { Say "  reddedilen bildirim: $(($rep.rejected | ForEach-Object { $_.file + ' (' + $_.reason + ')' }) -join '; ')" }
    if ($rep.missing_validator_nodes.Count) { Say "  bildirimi olmayan aktif dogrulayici: $($rep.missing_validator_nodes -join ', ')" }
    $chk = & node $tsx $cli chain-permissions check --file $rendered --node-rpc $url
    if ($LASTEXITCODE -ne 0) { Say "  CHECK FARK:`n$($chk -join "`n")"; throw "dugum ${n}: izin listesi farkli" }
    Say "  check: dugumun yururlukteki listesi uretilen listeyle ayni"
  }
  if ($shared.Count -eq 0) { throw "calisan izinli dugum yok - once: besu-dev.ps1 -Start -Permissioned" }
  if ($shared.Count -eq 2) {
    if ($shared[1] -ne $shared[2]) { throw "paylasilan ozetler farkli (LP3): $($shared[1]) / $($shared[2])" }
    Say "LP3: iki dugumun paylasilan ozeti ayni"
  }
}

function Invoke-PermStop {
  foreach ($n in 1, 2) {
    $pf = PermPidFile $n
    $p = Get-PidFrom $pf
    if ($p) {
      Stop-Process -Id $p -Force
      for ($i = 0; $i -lt 20 -and (Get-Process -Id $p -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 250 }
      Say "dugum $n durduruldu (PID $p)"
    }
    if (Test-Path -LiteralPath $pf) { Remove-Item -LiteralPath $pf -Force }
  }
}

function Invoke-PermReset {
  Invoke-PermStop
  foreach ($n in 1, 2) {
    $d = PermDir $n
    foreach ($x in "db", "permissions_config.toml", "permissions_config.rendered.toml", "static-nodes.json", "besu.toml") {
      $p = Join-Path $d $x
      if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force }
    }
  }
  Say "izinli kip: zincir verisi ve izin dosyalari silindi (genesis, anahtarlar, bildirimler korundu)"
}

function Invoke-PermStatus {
  foreach ($n in 1, 2) {
    $p = Get-PidFrom (PermPidFile $n)
    if (-not $p) { Say "dugum ${n}: calismiyor"; continue }
    $url = PermRpc $n
    try {
      $bn = Get-BlockNumber $url
      $peers = [Convert]::ToInt32((Invoke-Rpc "net_peerCount" @() $url), 16)
      $vals = Invoke-Rpc "qbft_getValidatorsByBlockNumber" @("latest") $url
      Say "dugum ${n}: PID $p | RPC $url | blok $bn | es $peers | dogrulayicilar: $($vals -join ', ')"
    } catch { Say "dugum ${n}: PID $p calisiyor ama RPC yanit vermiyor ($url): $($_.Exception.Message)" }
  }
}

$chosen = @($Init, $Start, $Stop, $Reset, $Status, $Apply | Where-Object { $_ }).Count
if ($chosen -ne 1) { Write-Host "kullanim: besu-dev.ps1 -Init | -Start | -Stop | -Reset | -Status [-Permissioned [-Node 2] | -Apply -Permissioned]"; exit 2 }
if (($Apply -or $Node -ne 1) -and -not $Permissioned) { Write-Host "-Apply ve -Node yalniz -Permissioned ile"; exit 2 }
if ($Permissioned) {
  if ($Init) { Invoke-PermInit }
  elseif ($Start) { Invoke-PermStart $Node }
  elseif ($Apply) { Invoke-PermApply }
  elseif ($Stop) { Invoke-PermStop }
  elseif ($Reset) { Invoke-PermReset }
  elseif ($Status) { Invoke-PermStatus }
  exit 0
}
if ($Init) { Invoke-Init }
elseif ($Start) { Invoke-Start }
elseif ($Stop) { Invoke-Stop }
elseif ($Reset) { Invoke-Reset }
elseif ($Status) { Invoke-Status }
