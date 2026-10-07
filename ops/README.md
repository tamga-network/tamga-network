# ops — geliştirme ortamı ve kayıt araçları

```bash
npm install                 # kök (npm workspaces)
npm run setup               # pki → şema kataloğu → liste yayını (×2) → heartbeat → doğrulama → test ve sandbox listeleri
npm run check               # testler + tip denetimi
```

## Anahtar setleri (üç ayrı PKI)

Üç set birbirinden tamamen ayrıdır; hiçbir anahtar ikisinde birden bulunmaz.

| Set | Nerede | Ne için |
|---|---|---|
| **Geliştirme** | depoda `ops/pki/` — klasörün tamamı gitignore | `npm run pki` her bilgisayarda **rastgele** üretir. Testler, yerel servisler, test listeleri (`dist-test/`) bununla çalışır. Gerçek ağın anahtarı değildir; gerçek listede geçmez. Silinip yeniden üretilebilir. `wallet-provider` yalnız burada (ve sandbox'ta) vardır: genel **test** cüzdan sağlayıcısı (ADR-0042) |
| **Sandbox** | depoda `ops/pki-sandbox/` (sertifikalar ve `pki.json` izlenir, özel anahtarlar gitignore) | `npm run pki:sandbox` (ADR-0038). Sandbox sunucusu ve cüzdandaki sandbox pin'i |
| **Gerçek ağ (üretim)** | depoların **dışında**, operatörün bilgisayarında gizli klasörde (`TAMGA_PROD_PKI_DIR`); sunucuda `/srv/tamga/tamga-network/ops/pki` (kök CA özel anahtarı **olmadan**) | Gerçek güven listesi, kimlik servisi, referans doğrulayıcı. Kök CA özel anahtarı yalnız operatörün bilgisayarındadır. Yalnız sertifikası tutulan kayıtlar (iptal edilmiş kurumlar) özel anahtarsızdır |

Gerçek ağın PKI'sına dokunan araçlar klasörü **açıkça** ister (varsayılan yol yok; klasör yoksa açık bir mesajla durur):

```bash
# eksik bir yaprak (ör. yeni hizmet imzacısı) — kök yeniden üretilmez, --force yok, test cüzdan sağlayıcısı üretilmez
TAMGA_PROD_PKI_DIR=<gizli klasör> npx tsx ops/gen-pki.ts --prod        # ya da: npx tsx ops/gen-pki.ts --prod-dir <gizli klasör>
# yeni katılımcıya gerçek kökle imzalı sertifika (aşağıdaki kayıt tablosu)
TAMGA_PROD_PKI_DIR=<gizli klasör> npm run pki:issue -- --prod --name issuer-<ad> --csr <dosya>
```

Gerçek kayıt defterini (`registry/`) değiştiren kayıt komutları sertifikayı üretim klasöründe arar; yerel liste çıktısı gerçek
anahtarla imzalanmasın diye geçici bir çıktı klasörü verin: `TAMGA_TP_PKI=<gizli klasör> TAMGA_TP_DIST=<geçici klasör> npm run trust:register -- …`.
Gerçek liste sunucuda, sunucudaki anahtarlarla derlenir. Sunucuya anahtar gönderme operatör aracıyla yapılır ve yalnız üretim
klasöründen paketler; depodaki `ops/pki` hiçbir zaman sunucuya gitmez.

Adım adım:

| Komut | Ne yapar | Çıktı |
|---|---|---|
| `npm run pki` | Geliştirme PKI'sı (rastgele, bu bilgisayara özel): kök CA, örnek kurum yaprakları, liste imzacısı, kayıt kurumu, doğrulayıcı erişim sertifikası, test cüzdan sağlayıcısı (yalnız test) — P-256. Var olanları korur | `ops/pki/*.cert.pem`, `*.pkcs8.pem`, `pki.json` (parmak izleri, `issuer_id`, `ca_id`; `profile: development`) — klasör gitignore |
| `npm run schemas:build` | Type Metadata + JSON Schema (vct URN), `#integrity` ve `content_hash` | `packages/schemas/dist/` = `schemas.tamga.network/v1` |
| `npm run trust:build` | `lotl.jws`, `tl-tr.jws` (sürüm +1, önceki hash), `keys/`, `CHANGELOG.md`, arşiv; ilk çalışmada şema çapaları | `apps/trust-publisher/dist/` = `trust.tamga.network` |
| `npm run trust:heartbeat` | Çapa günlüğüne boş satır (saatlik kadans) | `dist/anchors.jsonl` |
| `npm run trust:anchor -- --list-id 0x… --issuer-id 0x… --list-uri … --content-hash sha256:… --list-version N` | Status list çapası (issuer servisi D2'de çağıracak) | aynı |
| `npm run trust:verify` | Seti yükleyiciyle doğrular (imza, format, hash zinciri, tazelik), özet basar | exit 2 = bayat |
| `npm test` | Taahhüt testleri T1–T8 | |

**Kayıt (operatör aracı):** güven listesi kaynağı elle düzenlenmez.

| Komut | Ne yapar |
|---|---|
| `npm run pki:sandbox` | Sandbox (test ağı) PKI'sı (ADR-0038): ayrı test kökü ve yapraklar, konu adları "(TEST)" | `ops/pki-sandbox/*.cert.pem`, `*.pkcs8.pem` (gitignore), `pki.json` |
| `npm run pki:issue -- --prod\|--dev --name issuer-<ad> --csr <dosya>` | Kurumun CSR'ını kök CA ile imzalar (anahtar kurumda kalır); hangi kök olduğu zorunlu: `--prod` gerçek ağ (`TAMGA_PROD_PKI_DIR` ya da `--pki-dir`), `--dev` depodaki geliştirme PKI'sı. Doğrulayıcı için `--name rp-<ad> --dns <alan adı>`; demo için `--generate --subject "CN=…"` (anahtar dosyada, S-1) |
| `npm run trust:register -- issuer\|rp <başvuru.json> [--check]` | Başvuruyu denetler (ad çakışması, sertifika, şema kataloğu, ADR-0024 kayıt verisi) — eksiklerin tamamı tek seferde; `--check` yazmaz |
| `npm run trust:scope -- <dns_name> <kullanım.json>` | Kayıtlı doğrulayıcıya yeni kullanım (gizlilik politikası zorunlu) |
| `npm run trust:authorize -- <slug> <vct> [--revoke]` | Şema yetkisi verir / bitirir (kayıt silinmez, geçmiş belgeler doğru doğrulanır) |
| `npm run trust:list` | Kurumlar ve doğrulayıcılar, durum, eksik kayıt verisi |
| `npm run trust:external` | Dış güven listelerinin kopyasını çeker, LOTL'daki sabit imzacıya karşı doğrular, `dist/external/` altına yazar; hata olursa eski kopya kalır (ADR-0036) |

Örnek başvurular: `apps/trust-publisher/registry/examples/`. Dış liste kaydı (ADR-0036): `lotl.source.json` içinde `external_lists[]`;
biçim `registry/examples/external-list.example.json`. Kayıt yalnız proje yönetimi onayıyla eklenir (`approval.ref` onay kaydına atıf,
FD4); yer tutuculu ya da onay kaydı eksik kayıt yayını durdurur. Her yazan komut CHANGELOG'a satır ekler ve listeyi yeniden imzalar;
sunucuda yayın `deploy.sh` ile.

**Sapma S-1:** özel anahtarlar dosyada. Pilotta `Signer` arayüzü KMS ile uygulanır; komutlar değişmez.

**Yayın:** `apps/trust-publisher/dist/` içeriği olduğu gibi `trust.tamga.network` köküne,
`packages/schemas/dist/` içeriği `schemas.tamga.network/v1/` altına statik olarak kopyalanır
(Cloudflare Pages / S3). CDN yeniden biçimlendirme yapmamalı (SPEC-SCHEMA-0001 §3.2).

## Doğrulayıcı erişim sertifikasını yenileme (ADR-0034)

Doğrulayıcının OpenID4VP istemci kimliği `x509_hash` = erişim sertifikasının SHA-256 özeti; sertifika değişince değişir.
Kalıcı kayıt kimliği `dns_name` (sertifikanın SAN'ındaki alan adı) değişmez — takma adlar, belge kopyaları ve geçiş kartları
etkilenmez. Sıra: (1) yeni sertifikayı gerçek ağın PKI klasörüne koy (`pki:issue --prod`) ve kayıt kaynağında `access_cert`'i ona
çevir (SAN'da aynı alan adı olmalı; yayıncı denetler; sertifika sunucuya anahtarlarla birlikte gider), (2) `npm run trust:build` + yayın — listede yeni `client_id`, (3) sonra doğrulayıcı sunucusunu yeni
sertifikaya geçir (istemci kimliği sertifikadan hesaplanır; ayar gerekmez). Ters sıra: cüzdan isteği "kayıtlı değil" diye reddeder.
