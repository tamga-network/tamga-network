# conformance — Tamga Uyum Vektörleri ve Koşucu

Sektör terimleriyle: **test vectors** (IETF/NIST: örnek girdi + beklenen çıktı) ve **conformance
suite** (OpenID, EUDI, W3C: vektörleri koşan takım). İki iş görür:

1. **Üçüncü taraf SDK'lar** (ileride `tamga-java`, `tamga-py`, `tamga-go`) kendi kodlarını bu
   vektörlere karşı test eder — ARCH-0005 P9 ("iş mantığı TypeScript'te kanonik, diğer diller
   aynı vektörlerle doğrulanır").
2. **Zincire geçiş eşdeğerlik testi** (ADR-0009 K7): `TrustSource(list)` ve `TrustSource(chain)`
   aynı sorgulara aynı cevabı vermeli; vektörler o sorguların dondurulmuş hâlidir.

```
conformance/
├── vectors/
│   ├── trust/    imzalı liste seti (lotl/tl/anchors/kökler) + sorgu→beklenen cevap
│   └── sd-jwt/   ihraç edilmiş belge, sunum, kökler + doğrulama beklentileri (olumlu + olumsuz); kimlik belgesi AB PID
│                 adlarıyla (identity-pid-names, ADR-0045)
├── runner/       vitest koşucusu — vektörleri okur, @tamga-network/* ile koşar, beklentiyle karşılaştırır
└── generate.ts   vektör üreteci (dev PKI + dist çıktıları; deterministik alanlar sabit `now`)
```

Üret: `npm run conformance:gen` · Koş: `npm test` (koşucu otomatik dahil).

**Kurallar:** vektörler **kişisel veri içermez** (sahte adlar); özel anahtar içermez (yalnızca
sertifika ve holder açık anahtarı); her vektör `now` alanı taşır (zaman bağımlı adımlar
deterministik). Vektör değişikliği = sürüm artışı (`vectors/VERSION`).
