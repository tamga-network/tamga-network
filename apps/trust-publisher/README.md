# trust-publisher — güven listesi yayıncısı

Tamga Network'ün imzalı güven listelerini (`lotl`, `tl-tr`) ve çapa günlüğünü üretir; `trust.tamga.network` bu klasörün
`dist/` çıktısıdır. Aynı araç kurum ve doğrulayıcı kayıtlarını da yönetir (kayıt aracı).

## Ne yapar

1. `registry/*.source.json` kayıt defterini, `ops/pki` sertifikalarını ve şema kataloğunu okur.
2. Listeleri JSON + JWS olarak imzalar; her sürüm bir öncekinin hash'ine bağlanır (sürüm hep artar, geri sarılamaz).
3. Eski sürümleri `dist/archive/`'e koyar, değişiklikleri `dist/CHANGELOG.md`'ye yazar.

Liste biçimi: [[SPEC-TRUST-0001]]. Dış listeler (federasyon, ETSI TS 119 602): [[ADR-0036]].

## Komutlar (depo kökünden)

| Komut                                                                   | İş                                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run trust:build`                                                   | listeleri yeniden üretir ve imzalar                                                 |
| `npm run trust:verify`                                                  | `dist/`'i yükleyiciyle doğrular (`-- --full`: arşivle birlikte tam zincir)          |
| `npm run trust:heartbeat`                                               | çapa günlüğüne boş satır (saatlik)                                                  |
| `npm run trust:anchor`                                                  | iptal listesi çapası ekler                                                          |
| `npm run trust:archive`                                                 | çapa günlüğünü arşivler                                                             |
| `npm run trust:register -- issuer\|rp <başvuru.json>`                   | kurum ya da doğrulayıcı ekler                                                       |
| `npm run trust:scope -- <dns_name> <kullanım.json>`                     | doğrulayıcıya yeni kullanım ekler                                                   |
| `npm run trust:authorize -- <slug> <vct>`                               | kuruma şema yetkisi verir (`--revoke` ile kaldırır)                                 |
| `npm run trust:status -- <slug> <durum>`                                | kurum durumunu değiştirir (ACTIVE, SUSPENDED, REVOKED, RETIRED)                     |
| `npm run trust:status -- <slug> REVOKED --invalidates-from valid_from`  | kurumu geri çeker; bütün belgeleri geçersiz (kayıt silinmez, TL2)                   |
| `npx tsx apps/trust-publisher/src/cli.ts rp-status <dns_name> <durum>`  | doğrulayıcı durumu (aynı kural)                                                     |
| `npx tsx apps/trust-publisher/src/cli.ts end-use <dns_name> <kullanım>` | doğrulayıcının bir kullanımını / kapı grubunu sona erdirir                          |
| `npm run trust:test-fixtures`                                           | testlerin listesini üretir (`test/fixtures/registry` → `dist-test/`)                |
| `npm run trust:build:sandbox`                                           | sandbox listesini üretir (`registry-sandbox` + `ops/pki-sandbox` → `dist-sandbox/`) |
| `npm run trust:list`                                                    | kayıtlı kurumlar ve doğrulayıcılar                                                  |
| `npm run trust:wallet-provider -- list\|show [--id <id>]`               | cüzdan sağlayıcılar (gerçek + sandbox kayıt defteri)                                |
| `npm run trust:wallet-provider -- check --id <id> --cert <pem>`         | sertifikayı aynı kurallarla denetler, hiçbir şey yazmaz (anahtar yenilemesi)        |
| `npm run trust:wallet-provider -- activate --id <id> --cert <pem>`      | sağlayıcıyı sertifikasıyla etkinleştirir (aşağıda; `--dry-run` farkı basar)         |
| `npm run trust:wallet-provider -- suspend\|revoke --id <id>`            | sağlayıcıyı askıya alır / geri çeker (`--reason`; kayıt silinmez, TL2)              |
| `npm run trust:external`                                                | dış güven listelerini çeker                                                         |

Yerel geliştirme için hepsini birden: `npm run setup`.

## Klasörler

- `src/` — komut satırı aracı (`cli.ts`), kayıt işlemleri, ETSI LoTE görünümü (`lote.ts`), ETSI TS 119 612 XML görünümü
  (`tl119612.ts`, taslak — aşağıda), kayıt sertifikası (`wrprc.ts`)
- `registry/` — gerçek ağın kayıt defteri kaynağı (test/demo kurumu yok); `examples/` örnek başvurular, `pending/` bekleyenler
- `registry-sandbox/` — sandbox (test ağı) kaynağı; `test/fixtures/registry/` — testlerin listesi (`dist-test/`)
- `etsi/` — ETSI TS 119 602 (`19602/`) ve TS 119 612 (`19612/`) şema dosyaları (yalnız testte)
- `dist/` — üretilen listeler (git dışında)

**ETSI TS 119 612 XML görünümü ([[ADR-0066]] — Accepted 2026-10-29; varsayılan kapalı, sandbox'ta açık).** `TAMGA_TL119612=1` iken `build`, imzaladığı
`tl-<cc>` listesinden ve LOTL'dan aynı sürümle (`TSLSequenceNumber` = `version`) XAdES-B-B imzalı `tl-<cc>.xml`, `tl-<cc>.sha2`
(SHA-256 özeti, TS 119 612 §6.1) ve `archive/tl-<cc>.vNNNN.xml` yazar. İmzacı `TAMGA_TL119612_SIGNER` (PKI'daki sertifika adı;
varsayılan `tl-signer-1`) TS 119 612 §5.7.1 profiline uymalıdır (C/O = slot ülke kodu / işletmeci adı, keyUsage yalnız
digitalSignature, basicConstraints CA=false, SKI, EKU `id-tsl-kp-tslSigning`); gerçek ağda uymayan imzacı ya da eksik yayın
verisi (posta adresleri) yayını durdurur, sandbox'ta uyarıdır. Bugünkü `tl-signer-1` profile uymaz; XML'i ayrı imza sertifikası
`tl-xml-signer-1` imzalar (`ops/gen-pki.ts` üretir: kökçe verilen yaprak, keyUsage digitalSignature + nonRepudiation, EKU
0.4.0.2231.3.0) ve parmak izi LOTL'da slotun `signing_certs` listesine eklenir. Sandbox'ta açık (sunucunun sandbox ayarında
`TAMGA_TL119612=1`, `TAMGA_TL119612_SIGNER=tl-xml-signer-1`; kayıtlarda "Sandbox (TEST)" yer tutucu adresler). Gerçek ağda bayrak,
gerçek posta adresleri ve üretim imza sertifikası gelmeden açılmaz (`ops/README.md` "XML liste imzacısı"). URI'lerin açıklaması:
`docs/concepts/etsi-trusted-list.md`.

Bir kayıt listeden **silinmez** (SPEC-TRUST-0001 TL2): kurum ya da doğrulayıcı geri çekilirken durumu değişir ve
`status_history`'ye eklenir. Hiç geçerli olmaması gereken kayıt (ör. gerçek ağdaki örnek kurum) `REVOKED` +
`invalidates_from = valid_from` ile çekilir; o kurumun verdiği hiçbir belge doğrulanmaz, LoTE'den düşer.

**Cüzdan sağlayıcılar (`wallet_providers[]`, ADR-0042):** ağ cüzdan sağlayıcı işletmez, yalnız listeler. Gerçek ağın
kaydı `TAMGA-WP-1` (Tamga Wallet; işletmeci BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ, adres `https://provider.tamgawallet.com`) `ACTIVE` durumdadır
(sertifika `wallet-provider-tamga-wp-1`). Sandbox listesinde üç kayıt var: `TAMGA-SANDBOX-TEST-WP` — ağın kendi demo sahneleri
için test anahtarı (`wallet-provider`, ADR-0042 K5; bir cüzdan hizmeti değildir) —, `OIDF-CONFORMANCE-TEST` (OpenID uyum testi
aracı) ve Tamga Wallet işletmecisinin gerçek ağdakiyle aynı `ACTIVE` kaydı. `RESERVED` bir kayıt WUA doğrulamasında kullanılmaz. Test listesindeki (`test/fixtures/registry/`) kayıt geneldir (`Test Wallet Provider`,
`test-wallet`). `keys/` klasörüne yalnız listenin andığı sertifikalar yazılır.

**Cüzdan sağlayıcı sertifikasının dosya adı:** `wua_signing_certs[]` öğesi, PKI klasöründeki `<ad>.cert.pem` dosyasının adıdır
ve liste yayınlanınca herkese açık `keys/<ad>.cert.pem` olur (yalnız sertifika; özel anahtar ağa verilmez). Kural:
`wallet-provider-<provider_id küçük harfle>`. `TAMGA-WP-1` için ad **`wallet-provider-tamga-wp-1`** (proje yönetimi onayı
2026-10-13) → `https://trust.tamga.network/keys/wallet-provider-tamga-wp-1.cert.pem` (sandbox listesinde aynı ad, aynı
sertifika). Yalın `wallet-provider` sandbox'taki test sağlayıcısına (`TAMGA-SANDBOX-TEST-WP`) ayrılmıştır, başka kayıtta
kullanılmaz. İki kaynak dosyada (`registry/`, `registry-sandbox/`) kayıt `"wua_signing_certs": ["wallet-provider-tamga-wp-1"]`
ve `ACTIVE` taşır.

**Cüzdan sağlayıcı komutu (`trust:wallet-provider`).** Kaynak dosyalar elle düzenlenmez:

```sh
TAMGA_PROD_PKI_DIR=<gerçek ağın PKI klasörü> \
  npm run trust:wallet-provider -- activate --id TAMGA-WP-1 --cert <sertifika.pem> [--registry registry|registry-sandbox|both] [--dry-run]
```

- Sertifikayı denetler (cüzdan kanıt politikası FW-POL-0002, ADR-0025): tek PEM sertifikası, özel anahtar yok; EC P-256 ve
  ecdsa-with-SHA256 (ES256); `keyUsage` `digitalSignature` var, `keyCertSign`/`cRLSign` yok; CA değil; geçerlilik süresi içinde
  (90 günden az kaldıysa uyarı); gerçek listeye konu adında `(TEST)` olan sertifika girmez (ADR-0038 SB1).
- Sağlayıcı sertifika profili (ETSI TS 119 412-6 §5): konu alanında `organizationIdentifier` (2.5.4.97; `VATTR-<VKN>`,
  `NTRTR-<MERSİS>`, `LEIXG-<LEI>`) olmalı ve kaydın `identifiers[]`'ından türetilen değerle aynı olmalı (kayıtta kimlik numarası
  yoksa etkinleştirme yapılmaz); qcStatements QcType `id-etsi-qct-wal` (0.4.0.194126.1.2) taşımalı. İstisna: sandbox listesindeki
  `(TEST)` sertifikalar (ağın deneme sahneleri, uyum testi aracı). `check` aynı denetimi yazmadan yapar.
- SHA-256 parmak izini basar, sertifikayı ad kuralıyla PKI klasörüne yazar (`<pki>/wallet-provider-<id küçük harf>.cert.pem`;
  gerçek ağ `--prod-pki` ya da `TAMGA_PROD_PKI_DIR`, zorunlu; sandbox `ops/pki-sandbox`, `--sandbox-pki` ile değişir). Aynı adda
  başka bir sertifika varsa üzerine yazmaz. PKI klasörünün kökü hedefle uyuşmalı (sandbox kökü `(TEST)`).
- Kayıtta `wua_signing_certs` = `[ad]`, `status` ve `RESERVED` çözümler `ACTIVE`, `note` güncel; değişiklik `status_history`'ye
  eklenir. Varsayılan `--registry both`: önce gerçek, sonra sandbox. Sandbox'a gerçek sertifika ancak gerçek kayıt defterinde aynı
  kayıt bu sertifikayla `ACTIVE` olduktan sonra girer (ADR-0042; derlemede SB1 ayrıca yayınlanmış gerçek listeye bakar).
- Bütün hedefler yazmadan önce denetlenir (biri hatalıysa hiçbir dosya değişmez; çıkış 2). `--dry-run` farkı basar, yazmaz.
  İkinci çalıştırma değişiklik yapmaz.
- Liste **imzalanmaz**: gerçek liste ağ sunucusunda dağıtımda üretim anahtarlarıyla, sandbox listesi aynı dağıtımda imzalanır.
  `suspend`/`revoke` aynı kurallarla durum değiştirir; geri çekilmiş kayıt yeniden etkinleşmez. Testler:
  `test/wallet-provider.test.ts`.

## Zincir projeksiyonu (`chain-submit`, `chain-check`) — ADR-0051, üretimde kapalı

Zincir bugün yok ve bu araç onu **kurmaz**: zincir ≥ 2 bağımsız işletmeci yazılı kabul verdiğinde kurulur (ADR-0009 K4). Kod
hazır olsun ve zincirsiz tasarıma bağlı kalsın diye yayıncı, imzalı listelerin **özetlerini** bir liste çapası kaydına
(`TrustListAnchorRegistry`, `contracts/`) yazabilir: her `lotl` / `tl-<cc>` sürümü için `sha256(<dosya>.jws)` + sürüm + önceki
özet + yayın zamanı, çapa günlüğünün son satırı için `sha256(satır)` + sıra + zaman. Liste içeriği, kayıt, belge ya da kişisel
veri zincire **gitmez** (SPEC-BC-0001 DP1, SPEC-TRUST-0001 TL11). Zincir projeksiyondur: çelişkide imzalı liste geçerlidir;
zincir cevabı doğrulama için gerekli değildir.

| Komut | İş |
| --- | --- |
| `npm run trust:chain-submit -- --dry-run` | planı basar (bayrak kapalıyken bellek içi boş zincire göre; açıkken zinciri okur), **yazmaz** |
| `npm run trust:chain-submit` | bayrak açıksa `dist/` setini yükleyiciyle doğrular (sağlıksız set çapalanmaz) ve yalnız özetleri yazar; aynı sürüm aynı özet → `SKIP`, onaylı farklı özet → `CONFLICT` (yazılmaz, çıkış 3, işletmeci bakar) |
| `npm run trust:chain-check -- dist/lotl.jws` | doğrulayıcı tarafı: listenin özeti zincirde **onaylı** mı? `YES` / `NO` (farklı özet — çift konuşma işareti) / `UNKNOWN` (kapalı, erişilemez, çapa yok ya da eşik dolmadı) |

Ortam (`.env`; depoda yer tutucu, gerçek değerler sunucuda): `TAMGA_CHAIN_ENABLED` (varsayılan **0** — kapalıyken hiçbir zincir
bağlantısı kurulmaz, hiçbir şey yazılmaz), `TAMGA_CHAIN_RPC_URL`, `TAMGA_CHAIN_ANCHOR_REGISTRY` (kayıt adresi),
`TAMGA_CHAIN_ANCHORER_KEY` (yalnız yazma; yazıcı anahtarı). Bir çapa ancak kayıttaki onay eşiği kadar farklı yazıcı aynı veriyi
gönderince onaylıdır; **üretimde eşik ≥ 2** — tek işletmeci onaylı çapa üretemez. Bayrak üretimde ikinci işletmeci ve eşik ≥ 2
olmadan açılmaz.

Yerel deneme: `npm run contracts:node` → `npm run contracts:deploy:dev` (adresler `contracts/deployments/localhost.json`,
yazıcı = Hardhat hesabı #0, eşik 1) → yukarıdaki ortam değişkenleriyle `trust:chain-submit`. Kod `src/chain/` (plan: `projection.ts`,
istemci: `client.ts`, koşu: `anchor.ts`, doğrulayıcı: `verify.ts`); ABI kopyası `src/chain/abi/` kontrat derlemesinden üretilir
(`npm run contracts:check` farkı yakalar). Testler `test/chain.test.ts` (ağsız).
