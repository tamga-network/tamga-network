# Kod ve süreç kuralları (CONVENTIONS)

Tamga'nın TypeScript depolarında (`tamga-network`, `tamga-platform`) geçerli kurallar. Belge kuralları ayrı:
`DOCUMENTATION-STANDARD.md`, `CONTRIBUTING.md`. Bağlayıcı güvenlik/gizlilik kuralları `INVARIANTS.md`'dedir; burada atıf verilir.

## 1. Dil ve biçim
- TypeScript `strict`, ES2022, ESM (`"type": "module"`), `moduleResolution: NodeNext` → göreli import'lar **`.js` uzantılı**
  (`./verify.js`). Cüzdan uygulaması (Tamga Wallet, Expo) ayrı depodadır; `@tamga-network/wallet-core`'u kullanır.
- Prettier: 120 sütun, çift tırnak, sonda virgül, LF (`.prettierrc`, `.gitattributes`). `npm run format` / `format:check`.
- Yorumlar ve kullanıcıya görünen metin **Türkçe**; tanımlayıcılar İngilizce. Kullanıcı metni sade: teknik terim yerine
  günlük dil ("kopya", "kurum", "doğrulayıcı").
- Dosya başı yorum: dosyanın işi + uyguladığı spec/ADR/değişmez (`SPEC-API-0001 AP3`, `ADR-0012 K4`).
- Değişmez atfı `DOC-ID/KOD` biçiminde; kodda kısa kod da olur (`// PR14`).

## 2. Paketler ve adlandırma
- npm kapsamı `@tamga-network/*` (D-OSS-2). Rol başına tek paket + alt yol (`verifier` + `/web`, `issuer` + `/client`).
  Yeni alt yol → `package.json` `exports` + kök `tsconfig.json` `paths` + `vitest.config.ts` alias (**alt yol anahtarı genel
  anahtardan önce**; yoksa önek eşleşmesi yanlış dosyaya gider).
- Kamuya açık yeni ad (paket, global, kategori, alan adı, politika kimliği) → önce proje yönetimine sor.
- `vct` URN: `urn:tamga:<domain>:<Type>:<major>` (D-SCHEMA-4). IssuerCategory kapalı küme, yeni değer ADR ile ve sona (ADR-0014).
- Ortam değişkeni `TAMGA_<SERVİS>_<AD>` (`TAMGA_VERIFY_BASE`). Gizli değerler `.env`'de, `.env.example`'da yer tutucu.
- Portlar: issuer 4001 · portal 4003 · verify 4004 · id 4006 (4005 Tamga Wallet'ın cüzdan sağlayıcısının yerel portudur; ağın servisi değil, ADR-0042) · Metro 8081.

## 3. Mimari kurallar (özet; tam liste INVARIANTS)
- Güven sorusu yalnızca `TrustSource` üzerinden (BT4); liste dosyası iş mantığında doğrudan okunmaz.
- Doğrulama sonucu üç değerli: ACCEPTED / REJECTED / INDETERMINATE; altyapı sorunu REJECTED değildir (AP2).
- Kişisel veri log, denetim kaydı, liste, çapa günlüğü, status URI'sine yazılmaz (DP1, AP3/AP4, PR14). Denetim kaydına yalnızca
  olay adı ve politika kimliği.
- Didit / kimlik ispatı yalnızca `tamga-platform/apps/id` (IDP3). TCKN yalnızca `IdentityAttestation` (IDP10).
- Kiracıya özel kod yazılmaz; fark `tamga-platform/tenants/{slug}.json`.
- Kapatılmış karar ADR olmadan değişmez; yayınlanmış şema metadata'sı değişmez (D1) — yeni sürüm.

## 4. Test
- Vitest. Paketlerde `src/*.test.ts` (yan yana), uygulamalarda `test/*.test.ts`. Test adı Türkçe ve ilgili kodu anar
  (`"D5: çapadan eski token …"`).
- Uçtan uca testler `fastify.inject` ile ağsız; dış HTTP sahte `fetch`/`Http` ile. Canlı servis provası `ops/demo-scenes.ts`.
- Dev PKI / güven listesi gerektiren testler `describe.skipIf(!ready)` kullanır; ön koşul eksikse `scripts/require-fixtures.ts`
  (vitest globalSetup, iki depoda) uyarır. **CI'da `TAMGA_REQUIRE_FIXTURES=1`** → eksik ön koşul hata olur (sessiz atlama yok);
  önce `npm run setup`.
- Her hata düzeltmesine onu yakalayan bir test.

## 5. Git ve sürüm
- Dal: `main` korunur; iş konu dalında (`claude-setup`, `feat/…`, `fix/…`). Commit/push yalnızca proje yönetimi isteyince.
- Commit mesajı: `tür(kapsam): özet` — türler `feat fix docs refactor test chore build`; özet Türkçe, emir kipi değil sonuç
  ("verifier: D5 ön çekim gecikmesi INDETERMINATE"). Gövdede neden + etkilenen kod/spec.
- Paket sürümleri SemVer; değişiklikler `CHANGELOG.md`'ye (Keep a Changelog biçimi, en yeni üstte). Yayın öncesi `npm run release:check`;
  yayın yalnızca CI `release.yml` ile (skill `npm-release`).
- Spec/ADR değişikliği → `MASTER_INDEX` sürümü + `node scripts/sync-invariants.mjs` (`--check` önce).
