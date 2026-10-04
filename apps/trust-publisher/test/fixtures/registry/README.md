# Test güven listesi kaynağı

Uçtan uca testlerin kullandığı kayıt defteri: örnek kurumlar (`bilgi`, `bubilet`) ve doğrulayıcının bütün kullanımları burada
ACTIVE'dir. **Gerçek ağın kaynağı değildir** — gerçek ağ `../../../registry/`'dedir ve orada test/demo kurumu yoktur (örnek
kurumlar REVOKED, geçmişiyle). Deneme senaryoları için ayrı test ağı: `../../../registry-sandbox/`.

`npm run trust:test-fixtures` (ya da `npm run setup`) bu klasörden `apps/trust-publisher/dist-test/`'i üretir; aynı dev PKI
(`ops/pki`) kullanılır. Testler `dist-test`'i okur.
