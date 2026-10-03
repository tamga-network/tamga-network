# Zincir aşaması (ledger)

Bu klasördeki belgeler **bugün kullanılmıyor**. Tamga Network bugün imzalı güven listeleriyle çalışır; en az iki bağımsız
doğrulayıcı (validator) operatörü katıldığında aynı kayıtlar izinli bir Besu / QBFT defterine taşınır ([[ADR-0009]]).
Belgeler o aşama için hazır tutulur; `contracts/` ve `network/` klasörleri bu belgelere dayanır.

| Klasör | İçerik |
|---|---|
| `specifications/` | Güven katmanı kontratları ([[SPEC-BC-0001]]), emanet ve hesap verebilir açıklama ([[SPEC-BC-0002]]), ajan yetkilendirme ([[SPEC-AGENT-0001]]) |
| `architecture/` | Ağ topolojisi ([[ARCH-0001]]), Besu ağı kurulumu ([[ARCH-0002]]), canlıya alma adımları ([[ARCH-0006]]) |
| `project-memory/` | Blockchain ve validator modeli ([[PM-BC-0001]]), zincire ne yazılır ne yazılmaz ([[PM-TRUST-0001]]) |
| `research/` | Blockchain çatısı karşılaştırması, Besu ile özel zincir karşılaştırması |
