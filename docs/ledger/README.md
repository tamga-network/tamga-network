# Zincir aşaması (ledger)

Bu klasördeki belgeler **üretimde kullanılmıyor** (durum 2026-10-19). Tamga Network bugün imzalı güven listeleriyle çalışır; en az
iki bağımsız doğrulayıcı (validator) operatörü katıldığında aynı kayıtlar izinli bir Besu / QBFT defterine taşınır ([[ADR-0009]] K4).
Zincir **öncül**: `contracts/` altındaki 8 kontrat ve liste çapası kaydı derleniyor ve test ediliyor (Hardhat 3, 120 test; yerel
geliştirme zinciri `contracts:node`), yayıncıda `chain-submit` / `chain-check` bayrakla kapalı (`TAMGA_CHAIN_ENABLED=0`). Öneri
[[ADR-0051]]: zincir imzalı listelerin **projeksiyonu**dur, yalnız özet taşır; [[SPEC-BC-0001]] §15. İzinli erişim Besu yerel
izinlendirmesiyle (her düğümde `permissions_config.toml`, zincir durumundan üretilir; Besu 25.6.0 zincir üstü izinlendirmeyi ve
Tessera gizliliğini kaldırdı): [[ADR-0052]]. `network/` (Besu
genesis/izin) iskelet hâlinde.

| Klasör | İçerik |
|---|---|
| `specifications/` | Güven katmanı kontratları ([[SPEC-BC-0001]]), emanet ve hesap verebilir açıklama ([[SPEC-BC-0002]]), ajan yetkilendirme ([[SPEC-AGENT-0001]]) |
| `architecture/` | Ağ topolojisi ([[ARCH-0001]]), Besu ağı kurulumu ([[ARCH-0002]]), canlıya alma adımları ([[ARCH-0006]]) |
| `project-memory/` | Blockchain ve validator modeli ([[PM-BC-0001]]), zincire ne yazılır ne yazılmaz ([[PM-TRUST-0001]]) |
| `research/` | Blockchain çatısı karşılaştırması, Besu ile özel zincir karşılaştırması |
