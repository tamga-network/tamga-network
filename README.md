# Tamga Network

**Türkiye ve Türk dünyası için dijital güven altyapısı — AB dijital kimlik (eIDAS 2.0 / EUDI) profilleriyle.**
Kurumlar belgeleri kişinin telefonuna verir, kişi yalnız istenen alanları paylaşır, doğrulayan taraf belgeyi kaynağa
sormadan saniyeler içinde denetler.

Bu depo açık kaynak kodu ve kanonik belgeleri taşır: spesifikasyonlar, kararlar (ADR), çerçeve belgeleri, `@tamga-network/*`
paketleri, referans doğrulayıcı, güven listesi yayıncısı ve akıllı kontratlar. Ağ cüzdan işletmez; cüzdanları güven listesinde
listeler (ADR-0042). Tamga Network kâr amacı gütmez; işletmecilik ileride bir vakfa devredilir.

> Güven çapası bugün **imzalı, sürümlü, hash-zincirli güven listeleridir** (ETSI TS 119 612 / EUDI modeli) ve herkese açık
> bir çapa günlüğüdür. En az iki bağımsız validator operatörü katıldığında aynı kayıtlar izinli bir **Besu / QBFT** defterine
> taşınır. Belgeler, cüzdan ve doğrulama hattı iki aşamada da aynıdır. Listelere, günlüğe ya da deftere kişisel veri yazılmaz.

| | |
|---|---|
| Web sitesi | [tamga.network](https://tamga.network) |
| Geliştirici belgeleri | [docs.tamga.network](https://docs.tamga.network) · API: [docs.tamga.network/api](https://docs.tamga.network/api/) |
| Mimari ve referans çerçevesi | [arf.tamga.network](https://arf.tamga.network) |
| Paketler | [npm: @tamga-network](https://www.npmjs.com/org/tamga-network) (sürüm 1.0.0; duyuruyla yayımlanır) |
| Lisans | kod Apache-2.0 (`LICENSE`) · belgeler CC BY 4.0 (`LICENSE-docs`) |

## İçerik

```
packages/            npm paketleri (@tamga-network/*)
  core               özetler, kimlik türetme (issuer_id, schema_id), sertifika yardımcıları
  trust              imzalı güven listelerini yükler ve doğrular; TrustSource (liste ve defter için tek arayüz)
  schemas            belge türü kataloğu: Type Metadata, JSON Schema, vct URN, içerik özetleri
  sd-jwt             SD-JWT VC: seçici açıklama, cihaz bağı, biçim denetimleri
  mdoc               ISO/IEC 18013-5 mdoc: CBOR, COSE, verme, doğrulama, yakın alan (BLE)
  issuer             belge verme (OpenID4VCI), iptal listesi yayıncısı; /client barındırılan servis için
  verifier           doğrulama hattı (T0 + A–E), OpenID4VP istekleri; /web sayfa kiti, /zk sıfır bilgi ispatı doğrulaması
  wallet-core        cüzdan çekirdeği (Node ve React Native): anahtarlar, alma, yerel denetim, sunma
  zk                 cüzdan tarafı sıfır bilgi ispatçısı (Longfellow, mdoc); /node masaüstü, /react-native telefon (ADR-0032)
apps/
  verify             referans doğrulayıcı (verify.tamga.network)
  trust-publisher    güven listesi yayıncısı ve kayıt aracı (trust.tamga.network)
examples/            dört çalışan örnek (her testte paketlerle çalışır)
conformance/         uyum vektörleri
contracts/           Solidity güven katmanı (Foundry) — defter aşaması
network/             Besu genesis, izinler, validator rehberi — defter aşaması
docs/                belgeler (docs.tamga.network kaynağı): framework · specifications · adr · architecture · guides · api
arf/                 Tamga ARF sitesi (arf.tamga.network)
ops/                 geliştirme PKI'sı, sertifika imzalama (pki:issue), ortak arayüz stilleri
```

Kök dosyalar: `DECISIONS.md` (karar kütüğü), `INVARIANTS.md` (bağlayıcı kurallar), `MASTER_INDEX.md` (belge dizini),
`SCENARIOS.md`, `CONVENTIONS.md` (kod kuralları), `DOCUMENTATION-STANDARD.md`, `CHANGELOG.md`.

## Çalıştırma

```bash
npm install
npm run setup       # geliştirme PKI'sı → şema kataloğu → güven listeleri → çapa → doğrulama
npm run check       # testler + tip denetimi
npm run docs:dev    # docs.tamga.network önizlemesi
```

Çıktılar: `apps/trust-publisher/dist/` = `trust.tamga.network`, `packages/schemas/dist/` = `schemas.tamga.network/v1`.
Ayrıntı: `ops/README.md`. Cüzdan uygulaması (Tamga Wallet) ayrı depodadır; bu depodaki `@tamga-network/wallet-core`'u kullanır.

## Standartlar

SD-JWT VC · ISO/IEC 18013-5 mdoc · OpenID4VCI 1.0 · OpenID4VP 1.0 (HAIP) · IETF Token Status List · X.509 (RFC 5280) ·
ETSI TS 119 612 (güven listeleri) · ETSI TS 119 471 / 472 (EAA) · ETSI TS 119 475 (kayıt sertifikaları) · AB ARF 3.0.

## Katkı ve güvenlik

Katkı: `CONTRIBUTING.md`, `CONVENTIONS.md`. Güvenlik açığı bildirimi: security@tamga.network — `SECURITY.md`.
