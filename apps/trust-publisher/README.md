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

- `src/` — komut satırı aracı (`cli.ts`), kayıt işlemleri, ETSI LoTE okuyucu (`lote.ts`), kayıt sertifikası (`wrprc.ts`)
- `registry/` — gerçek ağın kayıt defteri kaynağı (test/demo kurumu yok); `examples/` örnek başvurular, `pending/` bekleyenler
- `registry-sandbox/` — sandbox (test ağı) kaynağı; `test/fixtures/registry/` — testlerin listesi (`dist-test/`)
- `etsi/` — ETSI TS 119 602 şema dosyaları
- `dist/` — üretilen listeler (git dışında)

Bir kayıt listeden **silinmez** (SPEC-TRUST-0001 TL2): kurum ya da doğrulayıcı geri çekilirken durumu değişir ve
`status_history`'ye eklenir. Hiç geçerli olmaması gereken kayıt (ör. gerçek ağdaki örnek kurum) `REVOKED` +
`invalidates_from = valid_from` ile çekilir; o kurumun verdiği hiçbir belge doğrulanmaz, LoTE'den düşer.

**Cüzdan sağlayıcılar (`wallet_providers[]`, ADR-0042):** ağ cüzdan sağlayıcı işletmez, yalnız listeler. Gerçek ağın
kaydı `TAMGA-WP-1` (Tamga Wallet; işletmeci BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ, adres `https://provider.tamgawallet.com`) `RESERVED` durumdadır ve
anahtar taşımaz (`wua_signing_certs: []`); işletmeci kendi cüzdan sağlayıcı sertifikasını verince kayıt o sertifikayla
güncellenip etkinleşir. Sandbox listesinde iki kayıt var: `TAMGA-SANDBOX-TEST-WP` — ağın kendi demo sahneleri için test
anahtarı (`wallet-provider`, ADR-0042 K5; bir cüzdan hizmeti değildir) — ve Tamga Wallet işletmecisinin `RESERVED` kaydı. `RESERVED` kayıt
WUA doğrulamasında kullanılmaz. Test listesindeki (`test/fixtures/registry/`) kayıt geneldir (`Test Wallet Provider`,
`test-wallet`). `keys/` klasörüne yalnız listenin andığı sertifikalar yazılır.

**Cüzdan sağlayıcı sertifikasının dosya adı:** `wua_signing_certs[]` öğesi, PKI klasöründeki `<ad>.cert.pem` dosyasının adıdır
ve liste yayınlanınca herkese açık `keys/<ad>.cert.pem` olur (yalnız sertifika; özel anahtar ağa verilmez). Kural:
`wallet-provider-<provider_id küçük harfle>`. `TAMGA-WP-1` için ad **`wallet-provider-tamga-wp-1`** (proje yönetimi onayı
2026-10-13) → `https://trust.tamga.network/keys/wallet-provider-tamga-wp-1.cert.pem` (sandbox listesinde aynı ad, aynı
sertifika). Yalın `wallet-provider` sandbox'taki test sağlayıcısına (`TAMGA-SANDBOX-TEST-WP`) ayrılmıştır, başka kayıtta
kullanılmaz. Kayıt bugün `RESERVED` ve `wua_signing_certs: []`; ad, işletmeci sertifikasını verince iki kaynak dosyada
(`registry/`, `registry-sandbox/`) `"wua_signing_certs": ["wallet-provider-tamga-wp-1"]` ve `ACTIVE` ile birlikte girer.

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
