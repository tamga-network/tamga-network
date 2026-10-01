# Bekleyen kayıt başvuruları

Güven listesine henüz girmemiş, yalnız eksik kayıt verisi (ADR-0024) yüzünden bekleyen başvurular. `[DOLDURULACAK]` alanlar
doldurulunca kayıt aracıyla eklenir (kayıt kuralları denetlenir, sonra yayın):

    npx tsx apps/trust-publisher/src/cli.ts register issuer apps/trust-publisher/registry/pending/<dosya>.json
    npm run trust:build

| Dosya | Ne | Bekleyen |
|---|---|---|
| `tamga-id-review.issuer.json` | Mağaza incelemesi DEMO imzacısı (ADR-0033; I1, yalnız inceleme politikaları kabul eder) | Tamga'nın vergi / MERSİS numarası ve posta adresi |

Kayıt girildikten sonra dosya bu klasörden silinir.
