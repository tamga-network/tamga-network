# trust-publisher — güven listesi yayıncısı

Tamga Network'ün imzalı güven listelerini (`lotl`, `tl-tr`) ve çapa günlüğünü üretir; `trust.tamga.network` bu klasörün
`dist/` çıktısıdır. Aynı araç kurum ve doğrulayıcı kayıtlarını da yönetir (kayıt aracı).

## Ne yapar

1. `registry/*.source.json` kayıt defterini, `ops/pki` sertifikalarını ve şema kataloğunu okur.
2. Listeleri JSON + JWS olarak imzalar; her sürüm bir öncekinin hash'ine bağlanır (sürüm hep artar, geri sarılamaz).
3. Eski sürümleri `dist/archive/`'e koyar, değişiklikleri `dist/CHANGELOG.md`'ye yazar.

Liste biçimi: [[SPEC-TRUST-0001]]. Dış listeler (federasyon, ETSI TS 119 602): [[ADR-0036]].

## Komutlar (depo kökünden)

| Komut                                                 | İş                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run trust:build`                                 | listeleri yeniden üretir ve imzalar                                        |
| `npm run trust:verify`                                | `dist/`'i yükleyiciyle doğrular (`-- --full`: arşivle birlikte tam zincir) |
| `npm run trust:heartbeat`                             | çapa günlüğüne boş satır (saatlik)                                         |
| `npm run trust:anchor`                                | iptal listesi çapası ekler                                                 |
| `npm run trust:archive`                               | çapa günlüğünü arşivler                                                    |
| `npm run trust:register -- issuer\|rp <başvuru.json>` | kurum ya da doğrulayıcı ekler                                              |
| `npm run trust:scope -- <dns_name> <kullanım.json>`   | doğrulayıcıya yeni kullanım ekler                                          |
| `npm run trust:authorize -- <slug> <vct>`             | kuruma şema yetkisi verir (`--revoke` ile kaldırır)                        |
| `npm run trust:status -- <slug> <durum>`              | kurum durumunu değiştirir (ACTIVE, SUSPENDED, REVOKED, RETIRED)            |
| `npm run trust:status -- <slug> REVOKED --invalidates-from valid_from` | kurumu geri çeker; bütün belgeleri geçersiz (kayıt silinmez, TL2) |
| `npx tsx apps/trust-publisher/src/cli.ts rp-status <dns_name> <durum>` | doğrulayıcı durumu (aynı kural)                  |
| `npx tsx apps/trust-publisher/src/cli.ts end-use <dns_name> <kullanım>` | doğrulayıcının bir kullanımını / kapı grubunu sona erdirir |
| `npm run trust:test-fixtures`                         | testlerin listesini üretir (`test/fixtures/registry` → `dist-test/`)       |
| `npm run trust:list`                                  | kayıtlı kurumlar ve doğrulayıcılar                                         |
| `npm run trust:external`                              | dış güven listelerini çeker                                                |

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
