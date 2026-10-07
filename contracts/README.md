# contracts/ — Tamga Güven Katmanı

Foundry projesi. Spesifikasyon: **SPEC-BC-0001 v2.0.0**.

> **CI henüz etkin değil (zincir aşaması, ADR-0009).** İş akışı taslağı `ci/contracts.yml.disabled`'da durur; zincir aşamasında
> kök `.github/workflows/` altına taşınınca çalışır (GitHub iç içe klasördeki iş akışlarını çalıştırmaz).

## Hızlı başlangıç

```bash
make install     # forge-std + OpenZeppelin (upgradeable dahil)
make build
make test
make storage     # UUPS brick koruması + depolama düzeni anlık görüntüsü
```

## Yapı

```
src/
├── base/TamgaRegistryBase.sol      egemenlik + kota + UUPS yetkisi
├── governance/Governance.sol       Katman 1: üyelik, 2/3 oy, ISovereignty
├── identity/RootCARegistry.sol     ulusal Root CA çapaları        (§2)
├── schema/SchemaRegistry.sol       şema çapaları, NETWORK/NATIONAL (§4)
├── registry/IssuerRegistry.sol     issuer + ŞEMA YETKİSİ          (§3)
├── registry/RelyingPartyRegistry.sol   verifier + scope           (§6)
├── recognition/CrossRecognition.sol    tek taraflı tanıma         (§5)
├── revocation/StatusListRegistry.sol   iptal ÇAPASI (bitmap yok)  (§7)
├── TrustQueries.sol                doğrulayıcı cephesi, 5 sorgu   (§11.2)
└── interfaces/                     ITamgaErrors dahil 10 arayüz
```

## Dikkat edilecek üç şey

**1. `isRevoked` yoktur ve eklenmemelidir.**
Zincir iptal durumunu bilmez (ADR-0008). Bilseydi iptalin *anını* tüm
validator'lara sızdırırdı. İptal off-chain Status List Token'dan okunur;
zincir yalnızca içerik hash'i + sürüm çapası verir.

**2. Şema yetkisi allowlist'tir.**
`isAuthorizedForSchema` varsayılanı `false`. Bu, PM-SCHEMA-0001 Zafiyet 1'i
kapatır — bkz. `test/IssuerRegistry.t.sol::test_CategoryOverreach_IsBlocked`.

**3. Paylaşılan `error`'ler `ITamgaErrors.sol`'dedir.**
Aynı error'ü iki arayüzde tanımlarsan, ikisini birden kalıtan bir kontrat
`Identifier already declared` ile derlenmez. Yeni paylaşılan hata oraya eklenir.

## Derlenmiş mi?

**HAYIR.** Bu dosyalar `solc`/`forge` erişimi olmayan bir ortamda yazıldı.
Yapılan denetimler yalnızca yapısaldır:

| Denetim | Sonuç |
|---|---|
| Parantez dengesi | ✓ |
| Tanımsız `error`/`event` | ✓ yok |
| Arayüzler arası isim çakışması | ✓ yok |
| Arayüzdeki her fonksiyon uygulanmış | ✓ 8/8 kontrat |
| `_authorizeUpgrade` + `_disableInitializers` + `__gap` | ✓ 7/7 |
| Tip denetimi, gas, storage layout | ✗ **yapılmadı** |

**İlk komut `make install && make build` olmalı.** Beklenen ilk hata sınıfı:
OpenZeppelin sürüm uyumsuzlukları (`UUPSUpgradeable` yolu v4 ↔ v5 arasında
değişti) ve `vm.envAddress(...,",")` imzası (forge-std sürümüne bağlı).

## Test kapsamı

| Dosya | Neyi kanıtlıyor |
|---|---|
| `Sovereignty.t.sol` | N1, R1, G1; çıkarma oylamasında hedefin oyu sayılmaz |
| `SchemaRegistry.t.sol` | İki katmanlı yetki, S1, **S3 (deprecated hâlâ doğrulanabilir)** |
| `IssuerRegistry.t.sol` | **Kategori aşımı engellendi**, I1 allowlist, yumuşak iptal, CA2 |
| `StatusListRegistry.t.sol` | **L1 sürüm geri alınamaz**, L2, L3, kota, R2 |
