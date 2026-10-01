---
document_id: GUIDE-0001
title: Web Sitesine "Tamga ile Kayıt Ol / Giriş Yap"
category: Guide
domain: Integration
status: Draft
review_status: Draft
version: 0.2.1
created: 2026-09-27
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
tags: [guide, web-login, passkey, webauthn, openid4vp]
keywords: [Tamga ile giriş, verifier/web, TamgaVerifier.mount, passkey]
summary: >
  Bir web sitesine Tamga ile kayıt ve giriş eklemek: sayfada `@tamga-network/verifier/web` kiti (QR / telefonda cüzdanı aç),
  sunucuda sonucun doğrulayıcıdan alınıp oturum açılması, kayıttan sonra passkey ile telefonsuz giriş. Çalışan örnek:
  verify.tamga.network/sample-site (apps/verify/src/routes/site.ts).
priority: High
language: tr
audience: [integrators, web-developers]
related: ["[[SPEC-PROTO-0002]]", "[[SPEC-API-0001]]", "[[GUIDE-0002]]", "[[ADR-0017]]"]
---
> **Sürüm notu 0.2.1 (2026-10-01) — [[ADR-0034]] (D-PROTO-2):** `pemRpSigner(anahtar, sertifika)` — istemci kimliği (`x509_hash`) sertifikadan hesaplanır; takma ad sitenin kayıtlı alan adına bağlıdır, sertifika yenilense de değişmez.

> **Sürüm notu 0.2.0 (2026-10-01) — [[ADR-0031]] (D-PRIV-1):** hesap anahtarı artık **site başına takma ad** (`claims.pseudonym`); kimlik belgesinin özeti (`document_number_hash`) ve kimlik numarası siteye gitmez. Kayıt: ad + soyad + takma ad; giriş: yalnız takma ad. S-17 kapandı.

> **Sürüm notu 0.1.1 (2026-09-30) — ürün adı:** TamgaID → Tamga Wallet / “Tamga ile giriş yap” (proje yönetimi kararı; anlam değişmedi).

# Web sitesine "Tamga ile Kayıt Ol / Giriş Yap"

## Nasıl çalışır
1. **Kayıt (bir kez):** siteniz bir *politika* ile istek başlatır (ör. "ad, soyad" + takma ad). Bilgisayarda QR, telefonda
   "Tamga Wallet'ta aç" düğmesi çıkar. Kişi cüzdanda **yalnızca bu alanları** ve "bu siteye özel takma adın" satırını görür ve onaylar.
   Hesap anahtarı **takma addır** ([[ADR-0031]]): yalnız sizin sitenize özeldir, başka bir site aynı kişi için başka bir değer
   görür (siteler eşleştiremez); kişi yeni telefonda kimliğini yeniden doğrulayınca aynı takma ad döner (hesap kaybolmaz).
2. Doğrulayıcı sunumu doğrular (imza, güven listesi, iptal, cihaz bağı). Sayfanız sonucu yoklar; `ACCEPTED` olunca
   `presentation_id`'yi **kendi sunucunuza** gönderir. Sunucunuz onaylanan alanları doğrulayıcıdan alır, hesabı açar, oturum çerezi verir.
3. **Passkey (önerilir):** kayıttan hemen sonra "Bu cihaza passkey ekle". Sonraki girişler Face ID / parmak izi — cüzdan açılmaz,
   **hiçbir alan paylaşılmaz**, passkey yalnızca sizin sitenize özeldir.
4. **Yeni cihaz / passkey yok:** "Tamga ile giriş yap" yalnız takma adı ister — hiçbir belge alanı; sonra yine passkey eklenir.

## 1. Sunucu: sunumu siz açarsınız ([[ADR-0017]])
Barındırılan doğrulayıcıya her çağrı, sitenizin güven listesindeki **erişim sertifikasının anahtarıyla** imzalı kısa ömürlü bir
beyan taşır (`Authorization: Bearer …`, ≤ 60 sn, tek kullanım). Yeni bir şifre yoktur; anahtar, kaydınızdaki sertifikanınkidir.
```ts
import { createRpAssertion, pemRpSigner } from "@tamga-network/verifier";
const rp = await pemRpSigner(RP_KEY_PEM, RP_CERT_PEM); // client_id = x509_hash (sertifikadan)
const auth = async () => ({ authorization: `Bearer ${await createRpAssertion(rp, VERIFIER)}` });

// POST /tamga/start { policy }  → sayfaya: { presentation_id, qr_payload, expires_at, status_token }
const r = await fetch(`${VERIFIER}/presentations`, { method: "POST",
  headers: { ...(await auth()), "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({ policy_id: policy }) }).then((x) => x.json());
```
Cüzdan onay ekranında **sitenizin kayıtlı adı** görünür ("aracı doğrulayıcı: verify.tamga.network" notuyla); istenen alanlar
kaydınızın kapsamına göre denetlenir (HV6, AP6).

## 2. Sayfa
`<script>` ile (doğrulayıcı kiti paketlenmiş sunar):
```html
<script src="https://verify.tamga.network/tamga-verifier.js"></script>
<div id="tamga"></div>
<script>
  TamgaVerifier.mount(document.getElementById("tamga"), {
    verifier: "https://verify.tamga.network",
    policy: "site-signup", // giriş için "site-signin"
    start: () => fetch("/tamga/start", { method: "POST", headers: { "content-type": "application/json" },
                                          body: JSON.stringify({ policy: "site-signup" }) }).then((r) => r.json()),
    onResult: (presentationId) =>
      fetch("/oturum", { method: "POST", headers: { "content-type": "application/json" },
                         body: JSON.stringify({ presentation_id: presentationId }) }).then(() => location.reload()),
  });
</script>
```
npm ile: `import { mount, passkey } from "@tamga-network/verifier/web"` (aynı arayüz). Kit **doğrulama yapmaz** ve **değer görmez**:
yalnızca `status_token` ile durumu izler; karar ve değerler sunucunuzdadır. `onError` INDETERMINATE durumunu ayrı gösterir
("şu an doğrulanamadı — tekrar deneyin"; belge geçersiz demek değildir).

## 3. Sunucu: oturum açma
```ts
// POST /oturum { presentation_id }  — yalnızca JSON kabul edin (CSRF), Origin aynı site olmalı
const r = await fetch(`${VERIFIER}/presentations/${id}`, { headers: await auth() }).then((x) => x.json());
if (r.outcome !== "ACCEPTED") return res.status(400).send();       // INDETERMINATE → "tekrar deneyin"
const { claims } = await fetch(`${VERIFIER}/presentations/${id}/claims`, { headers: await auth() }).then((x) => x.json());
// değerler BİR KEZ verilir (ikinci okuma 410) ve sonuçtan 5 dk sonra silinir — hemen işleyin
const hesapAnahtari = hmacSha256(SITE_SIRRI, claims.pseudonym); // takma ad yalnız size özel; yine de site sırrıyla saklayın
```
Sonucu ve değerleri yalnızca sunumu açan site alabilir; başka biri sunum kimliğini bilse de `404` alır (HV1–HV4).
Kurallar (örnek sitede uygulanmış hâlleri: `apps/verify/src/routes/site.ts`):
- **Tek kullanım:** bir sunum yalnızca bir oturum açar.
- **Politika denetimi:** yalnızca kendi site politikalarınızla yapılmış sunumu kabul edin.
- **Hesap anahtarı:** `claims.pseudonym` (doğrulayıcı imzayı, `aud`/`nonce`'u ve cüzdan örneği kanıtını denetlemiştir — adım P1).
  Kimlik belgesinin özeti ya da kimlik numarası site politikalarında istenmez (PS4). Varsayılan: kişi başına tek takma ad (tek hesap);
  kaydınız `pseudonyms: "multiple"` ise kişi birden çok takma ad açabilir. Sınır: "kişi başına tek hesap" gerçek cüzdana dayanır
  (cüzdan örneği kanıtı bunu sınırlar; kesin kanıt sıfır bilgi ispatıyla gelecek).
- **Çerez:** `HttpOnly; SameSite=Lax; Secure`; sunucu tarafında süre; CSRF için yalnızca JSON + Origin kontrolü.
- **Kişisel veri loglanmaz** (ad, anahtar, passkey kimliği dahil).

## 4. Passkey (WebAuthn)
Sunucu tarafı için bir WebAuthn kütüphanesi (örnek sitede `@simplewebauthn/server`): kayıt ve giriş için `options` + `verify`
uçları; `attestation: "none"`, `residentKey: "required"`, `userVerification: "required"`. Sayfa tarafı:
```js
const o = await post("/passkey/register/options");     // oturum açıkken
await post("/passkey/register/verify", await TamgaVerifier.passkey.create(o));
// giriş: const { flow, options } = await post("/passkey/login/options");
//        await post("/passkey/login/verify", { flow, response: await TamgaVerifier.passkey.get(options) });
```
WebAuthn **IP adresinde çalışmaz**: `localhost` ya da HTTPS alan adı gerekir (rpID = sayfanın alan adı).

## 5. Üretime geçmeden önce
- Siteniz Tamga güven listesinde bir **RP (doğrulayıcı) kaydı** ister; istediğiniz alanlar kaydın kapsamını aşamaz (AP6).
- Barındırılan doğrulayıcı üretimde beyansız isteği reddeder (`TAMGA_VERIFY_REQUIRE_RP_AUTH=1`); demo/LAN kipinde beyansız eski yol
  `Deprecation` başlığıyla çalışır. İsterseniz doğrulamayı tamamen kendi sunucunuzda yapın: [[GUIDE-0002]].
- Politika adları ve alan setleri Tamga ile birlikte belirlenir (ör. yalnızca "18 yaşından büyük" → `age-over-18-mdoc`).
