# Bekleyen kayıt başvuruları

Güven listesine henüz girmemiş başvurular. Kayıt aracıyla, gerçek ağın PKI'sının bulunduğu işletmeci bilgisayarında eklenir (kayıt
kuralları ve ADR-0070 geçici işletmeci değeri — `../provisional-operator.json` — denetlenir, sonra yayın):

    npx tsx apps/trust-publisher/src/cli.ts register issuer apps/trust-publisher/registry/pending/<dosya>.json
    npm run trust:build

| Dosya                         | Ne                                                                                      | Bekleyen                                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tamga-id-review.issuer.json` | Mağaza incelemesi DEMO imzacısı (ADR-0033; I1, yalnız inceleme politikaları kabul eder) | Kayıt verisi tamam (ADR-0070: geçici işletmecinin numarası ve adresi, 2026-10-30); kalan: işletmeci bilgisayarında kayıt + yayın (DEMO imzacısının sertifikası üretim PKI'sında) |

Kayıt girildikten sonra dosya bu klasörden silinir.
