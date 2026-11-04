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
# Windows PowerShell 5.1 ile çalışır. Linux/macOS karşılığı: docs/ledger/architecture/0002-besu-network-setup-step-by-step.md
param([switch]$Init, [switch]$Start, [switch]$Stop, [switch]$Reset, [switch]$Status)
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

function Invoke-Rpc($method, $params = @()) {
  $body = @{ jsonrpc = "2.0"; id = 1; method = $method; params = $params } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri $Rpc -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
  if ($r.error) { throw "RPC $method hatasi: $($r.error.message)" }
  return $r.result
}

function Get-BlockNumber { try { [Convert]::ToInt64((Invoke-Rpc "eth_blockNumber"), 16) } catch { -1 } }

function Get-RunningPid {
  if (-not (Test-Path -LiteralPath $PidFile)) { return $null }
  $p = [int](Get-Content -LiteralPath $PidFile -Raw).Trim()
  $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq "java") { return $p }
  return $null
}

function Invoke-Init {
  if (-not (Test-Path -LiteralPath (Join-Path $JdkDir "bin\java.exe"))) {
    Expand-Into (Get-Verified $JdkUrl $JdkFile $JdkSha256) $JdkDir
    Say "JDK 25 kuruldu: $JdkDir"
  } else { Say "JDK 25 mevcut" }
  if (-not (Test-Path -LiteralPath $BesuBat)) {
    Expand-Into (Get-Verified $BesuUrl "besu-$BesuVersion.zip" $BesuSha256) $BesuDir
    Say "Besu $BesuVersion kuruldu: $BesuDir"
  } else { Say "Besu $BesuVersion mevcut" }
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
  $cmd = Start-Process -PassThru -WindowStyle Hidden -WorkingDirectory $Data -FilePath $BesuBat `
    -ArgumentList "--config-file=`"$TomlFile`"" -RedirectStandardOutput $LogFile -RedirectStandardError $ErrFile
  # besu.bat cmd.exe ile çalışır; asıl süreç onun java.exe çocuğudur
  $javaPid = $null
  for ($i = 0; $i -lt 40 -and -not $javaPid; $i++) {
    Start-Sleep -Milliseconds 500
    $child = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($cmd.Id) AND Name='java.exe'" -ErrorAction SilentlyContinue
    if ($child) { $javaPid = @($child)[0].ProcessId }
    elseif ($cmd.HasExited) { break }
  }
  if (-not $javaPid) { throw "java.exe sureci bulunamadi - log: $LogFile / $ErrFile" }
  Write-Utf8NoBom $PidFile "$javaPid`n"
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

$chosen = @($Init, $Start, $Stop, $Reset, $Status | Where-Object { $_ }).Count
if ($chosen -ne 1) { Write-Host "kullanim: besu-dev.ps1 -Init | -Start | -Stop | -Reset | -Status"; exit 2 }
if ($Init) { Invoke-Init }
elseif ($Start) { Invoke-Start }
elseif ($Stop) { Invoke-Stop }
elseif ($Reset) { Invoke-Reset }
elseif ($Status) { Invoke-Status }
