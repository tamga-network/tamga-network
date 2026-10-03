# Tamga kod örnekleri

Dört çalışan örnek. Her biri `examples.test.ts` içinde gerçek paketlerle çalıştırılır (`npx vitest run examples`); docs sitesi
(`docs/guides/code-examples.md`) ve tamga.network bu dosyaları doğrudan gösterir. Bir paket değişip örnek bozulursa test
kırmızı yanar — sitede bayat kod kalmaz.

| Klasör | Ne gösterir | Paketler |
|---|---|---|
| `01-web-login/` | Web sitesine "Tamga ile giriş": sunucu (`server.ts`) + sayfa (`page.html`) | `@tamga-network/verifier` (+ `/web` kiti) |
| `02-verify-own-server/` | Kendi sunucunuzda belge doğrulama (barındırılan doğrulayıcı olmadan) | `@tamga-network/verifier`, `@tamga-network/trust` |
| `03-issue-hosted/` | Kurum olarak belge verme: diploma teklifi, bilet satışı, iptal | `@tamga-network/issuer/client` |
| `04-check-institution/` | Kurum kayıtlı mı, etkin mi, bu belgeye yetkili mi? | `@tamga-network/trust` |

Kod içi açıklamalar İngilizce (paketler uluslararası geliştiricilere de yayınlanır). Örnekleri değiştirdiğinizde:
`npx vitest run examples` → `npm run docs:build` → `tamga-web`'de `npm run examples:sync`.
