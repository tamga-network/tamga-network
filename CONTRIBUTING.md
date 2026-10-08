# Katkı rehberi (Contributing)

Bu depo Tamga Network'ün açık kaynak kodunu ve kanonik belgelerini taşır. Kod ve belgeler birlikte evrilir: **kararlar önce
belgelenir (ADR), sonra uygulanır.** Kapatılmış bir karar yalnızca yeni bir ADR ile değişir ([`DECISIONS.md`](DECISIONS.md),
[`docs/adr/`](docs/adr/)). Güvenlik açığını issue olarak açmayın: [`SECURITY.md`](SECURITY.md).

*English:* Issues and pull requests are welcome in English or Turkish. Closed decisions change only through a new ADR; binding
rules are indexed in `INVARIANTS.md`. Run `npm run check` before opening a pull request.

## Başlarken

```bash
npm install
npm run setup     # geliştirme PKI'sı, şema kataloğu, güven listeleri (yalnızca yerel; anahtarlar hiçbir yere gitmez)
npm run check     # testler + tip denetimi
```

Pull request açmadan önce: `npm test` · `npm run typecheck` · `npm run format:check` · `npm run docs:check` · `npm run arf:check`
(CI aynılarını çalıştırır).

## Kod

- **Yer:** `packages/` (`@tamga-network/*` npm paketleri) ve `apps/` (`verify`, `trust-publisher`). Ağ cüzdan sağlayıcı işletmez
  ([ADR-0042](docs/adr/0042-network-and-wallets.md)); bir cüzdanın kendi koduna yapılacak değişiklik o cüzdanın deposuna gider.
- **Dil ve biçim:** TypeScript `strict`, ESM; göreli import'lar `.js` uzantılı. Prettier (120 sütun, çift tırnak, LF):
  `npm run format`. Tanımlayıcılar İngilizce; yorumlar ve kullanıcıya görünen metin Türkçe olabilir.
- **Dosya başı yorum:** dosyanın işi ve uyguladığı şartname / ADR / kural (`SPEC-API-0001 AP3`, `ADR-0012 K4`).
- **Bağlayıcı kurallar** ([`INVARIANTS.md`](INVARIANTS.md), sitede [Binding rules](https://docs.tamga.network/rules)) her
  değişiklikte geçerlidir. En sık dokunulanlar:
  - Kişisel veri log'a, denetim kaydına, güven listesine, çapa günlüğüne ya da iptal listesi adresine yazılmaz.
  - Güven sorusu yalnızca `TrustSource` üzerinden sorulur; liste dosyası iş mantığında doğrudan okunmaz.
  - Doğrulama sonucu üç değerlidir: `ACCEPTED` / `REJECTED` / `INDETERMINATE`; altyapı sorunu `REJECTED` değildir.
  - Kapalı kümeler (belge veren kategorisi, belge biçimi, protokol) yalnızca ADR ile genişler.
- **Paket alt yolu eklemek:** `package.json` `exports` + kök `tsconfig.json` `paths` + `vitest.config.ts` alias (alt yol anahtarı
  genel anahtardan önce gelir).
- **Test:** Vitest; paketlerde `src/*.test.ts`, uygulamalarda `test/*.test.ts`. Her hata düzeltmesi onu yakalayan bir testle
  gelir. Güven listesi gerektiren testler önce `npm run setup` ister.
- **Commit:** `tür(kapsam): özet` — türler `feat fix docs refactor test chore build`. Değişiklik
  [`CHANGELOG.md`](CHANGELOG.md)'ye yazılır (Keep a Changelog, en yeni üstte).

## Belgeler

| Klasör | Ne için |
|---|---|
| `docs/guides/` | Başlarken: adım adım rehberler (GUIDE-*) |
| `docs/concepts/` | Kavramlar: sade anlatım |
| `docs/specifications/` | Şartnameler: kesin kurallar (SPEC-*) |
| `docs/adr/` | Kararlar (ADR-*) |
| `docs/architecture/` | Bileşen mimarisi (ARCH-*) |
| `docs/framework/` | Tamga ARF ve ekleri (FW-*) — arf.tamga.network |
| `docs/background/` | Gerekçe (PM-*) ve araştırma (RS-*) — sitede yayınlanmaz |
| `docs/ledger/` | Zincir aşaması (bugün kullanılmıyor) — sitede yayınlanmaz |
| `docs/en/` | İngilizce çeviriler (Türkçe kaynakla aynı yol) |

- **Kimlik:** her belgenin kalıcı bir `document_id`'si vardır; belgeler birbirine kimlikle bağlanır: `[[SPEC-CRED-0003]]`,
  bir kurala `[[SPEC-CRED-0003]]/S1`. Klasör ya da başlık değişse de atıf kopmaz.
- **Ön bilgi (front matter):**

  ```yaml
  ---
  document_id: SPEC-ID-0003
  title: "Kimlik ispatı"
  status: Active # Draft · Active · Deprecated (ADR: Proposed · Active · Superseded)
  version: 1.0.0
  created: 2026-09-24
  last_updated: 2026-10-02
  summary: >
    Bir-iki cümle: belge ne anlatır, kimin işine yarar.
  ---
  ```

  İngilizce çeviride ayrıca `translation_of` ve `source_version` (Türkçe kaynağın sürümü) bulunur.
- **Diller:** Türkçe metin kaynaktır (`docs/<yol>`), İngilizcesi `docs/en/<aynı yol>`; kaynak değişince çeviri aynı
  değişiklikte güncellenir (`npm run docs:check` denetler). Adlar (dosya, klasör, adres) İngilizcedir.
- **Terimler:** sözlük tek kaynaktan, `docs/.vitepress/terms.json`; terimin sayfadaki ilk kullanımı `[[t:trust-list]]` ile
  ipucu alır.
- **Bağlayıcı kurallar:** şartname ve ADR'lerde başlığında "Değişmez" geçen bölümlerde `| **KOD** | metin |` tablosuyla yazılır.
  `INVARIANTS.md` üretilen dosyadır: `node scripts/sync-invariants.mjs` (elle düzenlenmez).
- **Kamuya açık metin:** belgelerde kişi adı ve özel depo yolu bulunmaz; kararlar "proje yönetimi" onayıyla anılır.

## Lisans

Katkılar kodda Apache-2.0 ([`LICENSE`](LICENSE)), belgelerde CC BY 4.0 ([`LICENSE-docs`](LICENSE-docs)) altında kabul edilir.
