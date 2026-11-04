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
│   ├── sd-jwt/   ihraç edilmiş belge, sunum, kökler + doğrulama beklentileri (olumlu + olumsuz); kimlik belgesi AB PID
│                 adlarıyla (identity-pid-names, ADR-0045)
│   ├── status-list/  aynı iptal listesinin JWT ve CWT gösterimi, bits 1/2 (ADR-0048)
│   └── openid4vp/    KB-JWT `aud` iki yol, dal yanıtları ve ret, dal `kid`'i (SPEC-PROTO-0002, ADR-0067)
├── runner/       vitest koşucusu — vektörleri okur, @tamga-network/* ile koşar, beklentiyle karşılaştırır
├── openid4vp.ts  OpenID4VP vektörlerinin ortak yardımcıları (sabit tohumlu anahtarlar, yanıt ucunun işlem sırası)
└── generate.ts   vektör üreteci (dev PKI + dist çıktıları; deterministik alanlar sabit `now`)
```

Üret: `npm run conformance:gen` · Koş: `npm test` (koşucu otomatik dahil).

**Kurallar:** vektörler **kişisel veri içermez** (sahte adlar); özel anahtar içermez (yalnızca
sertifika ve holder açık anahtarı); her vektör `now` alanı taşır (zaman bağımlı adımlar
deterministik). Vektör değişikliği = sürüm artışı (`vectors/VERSION`; vektör setinin kendi sayısıdır, belge sürümünden
bağımsız — şu an 8). Tek istisna `openid4vp/`'nin `enc_private_jwk` değerleri: açık tohumlardan türetilmiş, yalnız bu vektöre
özgü **test** şifreleme anahtarlarıdır (şifreli yanıtları açabilmek için); hiçbir gerçek sistemde kullanılmaz.

## OpenID4VP vektörleri (`vectors/openid4vp/basic.json`)

Bir sitenin "cüzdanla göster" akışında doğrulayıcının iki kritik kararını sabitler: sunumun **kime** bağlandığı ve cüzdandan
gelen yanıtın (sunum ya da ret) **hangi isteğe** ait olduğu. Üç bölüm:

| Bölüm | Ne sınar | Beklenen |
|---|---|---|
| `kb_aud` (8 vaka) | KB-JWT `aud` (PV7): QR / imzalı istek yolunda client identifier; tarayıcı Digital Credentials API yolunda `origin:<köken>` (OpenID4VP 1.0 Ek A.4). Doğru ve yanlış bağlama, doğrulayıcının yanlış yapılandırılması. | `verifyPresentation`'ın A adımları geçer ya da gerçek adım kodu: yanlış `aud` **A6**, eksik ya da yola uymayan doğrulayıcı girdisi **A1** |
| `responses` (8 senaryo) | ADR-0067 çekim dalları: dalın anahtarına şifreli yanıt (JWE), şifreli ve şifresiz ret (`error=access_denied` + `state`), yumuşak ret (çok dallı sunumda ret yalnız kendi dalını kapatır), başka dalın `state`'i (deneme), hiçbir dalın açamadığı yanıt (deneme sayılmaz), DC API yanıtı (dal değil). | Her olayın sonucu (`declined`, `presentation`, `attempt`, `closed`, `used`, `unknown_request_object`, `undecryptable`, …) ve sunumun son durumu (`attempts`, `used`) |
| `kid_naming` | Dal anahtar kimliği: cihazlar arası `enc-<sunum>.<dal>`, DC API `enc-dc-<sunum>`; biçim dışı `kid` | `responseKidOf` / `encKid` çıktısı |

Sabit olanlar: anahtarlar (`SHA-256("tamga-conformance/openid4vp/<etiket>")` tohumundan P-256), zaman (`now`), dalların
`state` / `nonce` değerleri, cüzdanın JWE efemer anahtarı ve IV'si. Her üretimde değişenler (beklentiyi etkilemez): belge veren
imzası, disclosure tuzları, KB-JWT imzası. `kb_aud` vakaları en küçük güven kaynağıyla koşulur (yalnız tazelik sağlıklı, kayıt
yok); konu yalnız A adımıdır, ardından B2 gelir. Yanıt senaryoları doğrulayıcının yanıt ucundaki sırayı izler
(`conformance/openid4vp.ts` `processResponse`). Koşucu ayrıca cüzdan çekirdeğinin şifresiz reddinin gövdesini (yalnız
`error=access_denied` ve `state`, PV5) ve DC API yolunda POST yapılmadığını denetler.

### English summary

`vectors/openid4vp/basic.json` pins two verifier decisions in the "show with wallet" flow: who a presentation is bound to and
which request a wallet response (presentation or decline) belongs to. `kb_aud`: the KB-JWT `aud` is the client identifier on the
cross-device (signed request / QR) path and `origin:<origin>` on the Digital Credentials API path (OpenID4VP 1.0 Annex A.4);
expected result is "A steps pass" or the verifier's real step code (A6 wrong audience, A1 missing or path-inconsistent verifier
input). `responses`: per-fetch request branches (ADR-0067) — encrypted response to a branch key, encrypted and plaintext decline
(`error=access_denied` + `state`), soft decline, another branch's state (an attempt), responses no branch key opens (not an
attempt), the DC API response (not a branch). `kid_naming`: `enc-<presentation>.<branch>` and `enc-dc-<presentation>`. Keys, time,
`state`/`nonce` and the wallet's JWE ephemeral bytes are fixed; the `enc_private_jwk` values are test-only keys derived from
public seeds.
