# ops — D1 çalıştırma

```bash
npm install                 # kök (npm workspaces)
npm run d1                  # pki → şema kataloğu → liste yayını → heartbeat → doğrulama → testler
```

Adım adım:

| Komut | Ne yapar | Çıktı |
|---|---|---|
| `npm run pki` | Geliştirme PKI'sı: TR National Root CA (provisional), Bilgi (DEMO) issuer yaprağı, liste imzacısı, wallet provider — P-256 | `ops/pki/*.cert.pem`, `*.pkcs8.pem` (gitignore), `pki.json` (parmak izleri, `issuer_id`, `ca_id`) |
| `npm run schemas:build` | Type Metadata + JSON Schema (vct URN), `#integrity` ve `content_hash` | `packages/schemas/dist/` = `schemas.tamga.network/v1` |
| `npm run trust:build` | `lotl.jws`, `tl-tr.jws` (sürüm +1, önceki hash), `keys/`, `CHANGELOG.md`, arşiv; ilk çalışmada şema çapaları | `apps/trust-publisher/dist/` = `trust.tamga.network` |
| `npm run trust:heartbeat` | Çapa günlüğüne boş satır (saatlik kadans) | `dist/anchors.jsonl` |
| `npm run trust:anchor -- --list-id 0x… --issuer-id 0x… --list-uri … --content-hash sha256:… --list-version N` | Status list çapası (issuer servisi D2'de çağıracak) | aynı |
| `npm run trust:verify` | Seti yükleyiciyle doğrular (imza, format, hash zinciri, tazelik), özet basar | exit 2 = bayat |
| `npm test` | Taahhüt testleri T1–T8 | |

**Kayıt (operatör aracı):** güven listesi kaynağı elle düzenlenmez.

| Komut | Ne yapar |
|---|---|
| `npm run pki:issue -- --name issuer-<ad> --csr <dosya>` | Kurumun CSR'ını kök CA ile imzalar (anahtar kurumda kalır); doğrulayıcı için `--name rp-<ad> --dns <alan adı>`; demo için `--generate --subject "CN=…"` (anahtar dosyada, S-1) |
| `npm run trust:register -- issuer\|rp <başvuru.json> [--check]` | Başvuruyu denetler (ad çakışması, sertifika, şema kataloğu, ADR-0024 kayıt verisi) — eksiklerin tamamı tek seferde; `--check` yazmaz |
| `npm run trust:scope -- <client_id> <kullanım.json>` | Kayıtlı doğrulayıcıya yeni kullanım (gizlilik politikası zorunlu) |
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
etkilenmez. Sıra: (1) yeni sertifikayı `ops/pki`'ye koy ve kayıt kaynağında `access_cert`'i ona çevir (SAN'da aynı alan adı
olmalı; yayıncı denetler), (2) `npm run trust:build` + yayın — listede yeni `client_id`, (3) sonra doğrulayıcı sunucusunu yeni
sertifikaya geçir (istemci kimliği sertifikadan hesaplanır; ayar gerekmez). Ters sıra: cüzdan isteği "kayıtlı değil" diye reddeder.
