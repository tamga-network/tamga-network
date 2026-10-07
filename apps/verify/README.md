# apps/verify — Referans verifier (verify.tamga.network)

Politika seç → imzalı OpenID4VP isteği (QR) → cüzdanın şifreli sunumu → kanonik doğrulama (T0 + A–E, `@tamga-network/verifier`)
→ üç değerli sonuç ekranı + "arka planda ne oldu". Aynı servis, kayıtlı sitelere **barındırılan doğrulayıcı** olarak da
çalışır (ADR-0017): sonucu ve değerleri yalnız sunumu açan siteye, bir kez verir. Kurumlar kendi doğrulayıcısını
`@tamga-network/verifier` ile de kurabilir. API: [docs.tamga.network/api](https://docs.tamga.network/api/) (Hosted Verifier API).

```bash
npm run verify            # :4004; env: TAMGA_VERIFY_BASE, TAMGA_TRUST_DIST, TAMGA_PKI_DIR (rp-verify)
```

| Uç                              | Ne                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                         | Gerçek ağ: Tamga Verify nedir + geliştirici bağlantıları + "denemek için sandbox" (deneme paneli yok). Sandbox: politikalar + "QR üret" paneli (AP6) |
| `GET /app-review`               | Mağaza incelemesi (ADR-0033): yalnız inceleme politikalarının QR düğmeleri; ana sayfadan bağlanmaz, `noindex`                                        |
| `POST /presentations`           | `{policy_id, dc_api_origin?}` → istek nesnesi + QR (`openid4vp://?client_id=…&request_uri=…`); `dc_api_origin` ile tarayıcı isteği                   |
| `GET /vp/req/:id`               | İmzalı istek nesnesi (JAR, x5c = rp-verify)                                                                                                          |
| `POST /vp/response`             | `direct_post.jwt` — `response=<JWE ECDH-ES/A128GCM>`; nonce tek kullanımlık (PV10)                                                                   |
| `GET /presentations/:id`        | `PENDING` ya da sonuç nesnesi (claim değeri yok — AP3; idx yok — AP4)                                                                                |
| `GET /presentations/:id/claims` | Açıklanan değerler (ayrı uç)                                                                                                                         |
| `GET /p/:id`                    | HTML: ACCEPTED / REJECTED / INDETERMINATE ayrı, adım şeridi, arka plan paneli. Sahibi olan sunumda ayrıntı yalnız `?st=<durum jetonu>` ya da sahibin RP beyanıyla; aksi hâlde nötr durum |
| `GET /audit`                    | Son denetim kayıtları (yalnızca `x-admin-token`)                                                                                                     |
| `GET /policies`                 | Cüzdanın "Kontrol ettir" ekranı için senaryo özeti (ADR-0012 C)                                                                                      |
| `GET /p/:id?show=<key>`         | Kontrol görünümü: büyük sonuç + yalnızca açıklanan alanlar; anahtar yanıtla gelir (`show_url`), 5 dk geçerli, aksi 410                               |
| `POST /terminal/verify`         | Geçiş kartı jetonu doğrulama (ADR-0012 B, AP13): `{token, terminal_group}` → `{ok, reason}`; jti tekrar listesi bu serviste ortak                    |
| `GET /terminal`                 | Turnike demo sayfası (kamera / yapıştır); `?group=`                                                                                                  |
| `GET /terminal/passes`          | Kayıtlı geçiş kartları (kişisel veri yok; yalnız `x-admin-token` ile)                                                                                |
| `GET /stats/gates`              | Kapı sayaçları: gün × grup → kabul / red / neden (yalnız sayı; `x-admin-token`; Kurum Konsolu okur)                                                  |
| `GET /trust/*`                  | Geliştirme: `TAMGA_VERIFY_SERVE_TRUST=1` iken güven listesi dosyaları (LAN demo)                                                                     |

**Hız sınırı:** `POST /presentations`, `POST /vp/response` ve `POST /terminal/verify` süreç içi jeton kovasıyla sınırlıdır; aşılınca
`429 {"error":"rate_limited"}` + `Retry-After`. İstemci adresi saklanmaz ve loglanmaz (yalnız bellekte, rastgele anahtarlı HMAC).

## Politika kümeleri ortama göre (2026-10-04)

`policies.ts` `policiesFor(ağ)`: **gerçek ağ** = genel (`age-over-18-mdoc`, `age-over-18-zk`, `site-signup`, `site-signin`) +
mağaza inceleme (`review-age-over-18`, `review-site-signup`; ADR-0033). **Sandbox** (`TAMGA_NETWORK=sandbox`) = hepsi; kurgusal
senaryolar (kampüs, bilet, indirim, işe alım, araç kiralama), ana sayfa paneli, `/sample-site` ve `/terminal` yalnız orada.
Gerçek ağda `/sample-site` (ve eski `/demo-site`) sandbox'taki örnek siteye 302 yönlenir; `TAMGA_SANDBOX_LIVE=0` ise
docs sandbox rehberine. Kapı politikası olmayan ağda `/terminal` ve `/terminal/verify` 404 (nötr).

Status list'ler doğrulama başına **çekilmez**; güven çapalarındaki liste URI'leri periyodik toplu çekilir (S12).

## Modüller (2026-09-25)

```
src/app.ts               buildVerifyApp: bağlam (VerifyContext) + rota kayıtları
src/policies.ts          POLICIES, findPolicy, policySummaries
src/state.ts             PresentationStore (bellek; showKey, 5 dk kontrol bağlantısı, 30 dk saklama)
src/html.ts              esc, page, politika/bekleme/sonuç/kontrol/turnike görünümleri (mantık yok)
src/routes/presentations.ts  /presentations, /vp/req, /vp/response, /p/:id
src/routes/terminal.ts   /terminal, /terminal/verify, /terminal/passes, /stats/gates (src/stats.ts)
src/routes/misc.ts       /, /healthz, /policies, /audit, /trust/* (LAN aynası)
src/routes/site.ts       D11: /tamga-verifier.js (site kiti = `@tamga-network/verifier/web`, esbuild ile paketlenir), /presentations/:id/qr.png, /sample-site (+ /session, /logout,
                         /passkey/register|login/options|verify — WebAuthn; yalnızca localhost / HTTPS alan adı, IP'de çalışmaz)
(kit kaynağı) `packages/verifier/src/web/index.ts` — mount / start / passkey; window.TamgaVerifier
data/passes.json         geçiş kartı kayıtları + jti listesi (TAMGA_VERIFY_DATA_DIR; gitignore)
```

Kod stili: kök `.prettierrc` (120 sütun) — `npm run format` / `format:check`.
