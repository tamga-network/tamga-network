# network/ — Besu Ağ Yapılandırması

Tamga Network'ün izinli Besu/QBFT ağının çalıştırma yapılandırması: genesis,
QBFT ayarları, permissioning (izinli erişim), node/deploy tanımları. Adım adım
kurulum akışı: [[ARCH-0002]].

## Planlı yapı

```text
network/
├── genesis/         genesis.json (chain ID, QBFT config, extraData=validator seti)
├── qbft/            QBFT parametreleri (blok süresi, epoch)
├── permissioning/   node + account allowlist (izinli erişim)
├── docker/          konteyner tanımları (validator/full node)
└── README.md
```

## Fazlar ([[ARCH-0001]] §3; geliştirici rehberi [[GUIDE-0006]])
- **Faz 0:** en az 2 **bağımsız** validator operatörünün yazılı kabulüyle açılır; öncesi Faz B imzalı listeler ([[ADR-0009]] K4). Tek operatörlü zincir kurulmaz.
- **Faz 1 (Devletler):** QBFT oylamasıyla devlet node'ları eklenir, vakıf azalır.
- **Faz 2 (Kurumlar):** kurumlar full node (imzalamaz, doğrular).

## Durum
İskelet. Somut config Roadmap Phase 7 (Network) ile üretilir; QBFT vs IBFT 2.0
son seçimi implementasyon aşamasında ([[RS-FRAMEWORKS-0001]] §9).
