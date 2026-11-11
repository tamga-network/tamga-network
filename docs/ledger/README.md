# Zincir aşaması (ledger)

Bu klasördeki belgeler **üretimde kullanılmıyor** (durum 2026-11-11). Tamga Network bugün imzalı güven listeleriyle çalışır; en az
iki bağımsız doğrulayıcı (validator) işletmecisi katıldığında aynı kayıtlar izinli bir Besu / QBFT defterine taşınır ([[ADR-0009]]
K4). Üretim zinciri yoktur; zincir **öncül** olarak hazırdır ve herkese açıktır (`contracts/`, `network/`, bu klasör — 2026-11-04,
[[ADR-0074]] K6):

- **Kontratlar** (`contracts/`, Hardhat 3): dokuz yükseltilebilir kontrat — `Governance`, `RootCARegistry`, `SchemaRegistry`,
  `IssuerRegistry`, `RelyingPartyRegistry`, `CrossRecognition`, `StatusListRegistry`, `NetworkRegistry` (ağ düzeyi kayıtlar,
  [[ADR-0074]] K3) ve `TrustListAnchorRegistry` (liste çapası kaydı, [[ADR-0051]]) — ile durumsuz okuma cephesi `TrustQueries`.
  Testler (260'tan fazla), depolama düzeni ve yükseltme güvenliği denetimleri CI'da koşar. Şartname: [[SPEC-BC-0001]].
- **Liste–zincir eşdeğerliği** ([[ADR-0073]], [[ADR-0074]], [[ADR-0075]]; kabul 2026-11-04): tek seferlik göç kipi, imzalı liste
  arşivinin yeniden oynatılması (`trust:chain-replay`), olay tabanlı indeksleyici ve `ChainTrustSource` (`apps/chain-indexer/`),
  eşdeğerlik testi (liste, indeks ve kontrat aynı soruya aynı cevabı verir; ters geçiş: zincirde fazladan kayıt yok). Zincir
  projeksiyondur: çelişkide imzalı liste geçerlidir (CH1). `ChainTrustSource` sürekli bir projeksiyon kurulana kadar doğrulama
  kararında kullanılmaz ([[ADR-0074]] K5).
- **Ağ** (`network/`): Besu yerel izinlendirmesi — her düğümde zincir durumundan üretilen `permissions_config.toml`
  ([[ADR-0052]]; Besu 25.6.0 zincir üstü izinlendirmeyi ve Tessera gizliliğini kaldırdı), JSON-RPC yöntem süzgeci
  (`network/rpc-proxy`), Linux çok düğümlü test ağı betikleri (`network/testnet`), Windows'ta Docker'sız yerel geliştirme zinciri
  (`scripts/besu-dev.ps1`). Rehberler: düğüm işletme el kitabı ([[GUIDE-0015]]), test ağı adım adım ([[GUIDE-0018]]).
- **Yayıncı**: `chain-submit` / `chain-check` (liste sürümü ve çapa günlüğü özetleri) bayrakla kapalı (`TAMGA_CHAIN_ENABLED=0`).
- **Açık kararlar**: yönetişim anahtarı ile mutabakat (düğüm) anahtarının ayrılması ([[ARCH-0002]] Açık Konular 6) — ikinci devlet
  katılmadan önce yeni bir ADR ile; o zamana kadar gerçek ağda validator düğüm anahtarı HSM'de tutulur.

| Klasör | İçerik |
|---|---|
| `specifications/` | Güven katmanı kontratları ([[SPEC-BC-0001]]), emanet ve hesap verebilir açıklama ([[SPEC-BC-0002]]), ajan yetkilendirme ([[SPEC-AGENT-0001]]) |
| `architecture/` | Ağ topolojisi ([[ARCH-0001]]), Besu ağı kurulumu ([[ARCH-0002]]), canlıya alma adımları ([[ARCH-0006]]) |
| `project-memory/` | Blockchain ve validator modeli ([[PM-BC-0001]]), zincire ne yazılır ne yazılmaz ([[PM-TRUST-0001]]) |
| `research/` | Blockchain çatısı karşılaştırması, Besu ile özel zincir karşılaştırması |
