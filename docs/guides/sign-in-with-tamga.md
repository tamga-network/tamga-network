---
document_id: GUIDE-0001
title: "“Tamga ile giriş yap” eklemek"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-06
summary: >
  Bir web sitesine Tamga ile kayıt ve giriş eklemek: sayfada `@tamga-network/verifier/web` kiti (QR / telefonda cüzdanı aç),
  sunucuda sonucun doğrulayıcıdan alınıp oturum açılması, kayıttan sonra passkey ile telefonsuz giriş. Çalışan örnek
  sandbox'ta: verify.sandbox.tamga.network/sample-site (apps/verify/src/routes/site.ts).
---

# Web sitenize "Tamga ile giriş yap" eklemek

Bu rehber, web sitenize, ağın kurallarına uyan bir cüzdanla (ör. Tamga Wallet) kayıt ve giriş eklemek isteyen geliştiriciler içindir. Doğrulamayı Tamga'nın
barındırılan [[t:verifier|doğrulayıcısı]] Tamga Verify yapar; size bir sayfa kiti ve birkaç sunucu ucu kalır.

**Ne zaman okunur:** sitenize şifresiz, telefonla kayıt ve giriş eklemek istediğinizde. Önce [[GUIDE-0000]]'a göz atın.
Doğrulamayı tamamen kendi sunucunuzda yapmak isterseniz [[GUIDE-0002]]'ye geçin.

**Denemek için:** çalışan örnek site test ağındadır: `https://verify.sandbox.tamga.network/sample-site` (sandbox yayına
girince; adresler ve test cüzdanı ayarı [[GUIDE-0013]]'te). Gerçek ağdaki Tamga Verify'da örnek site yoktur.

## Nasıl çalışır?

1. **Kayıt (bir kez).** Siteniz bir *politika* ile istek başlatır (ör. "ad, soyad" + [[t:pseudonym|takma ad]]). Bilgisayarda QR, telefonda
   "Cüzdanında aç" düğmesi çıkar. Kişi cüzdanda **yalnızca bu alanları** ve "bu siteye özel takma ad" satırını görür ve onaylar.
2. **Doğrulama.** Doğrulayıcı [[t:credential|belgeyi]] denetler: imza, [[t:trust-list|güven listesi]], [[t:revocation|iptal]],
   [[t:holder-binding]]. Sayfanız sonucu izler; `ACCEPTED`
   olunca sunum kimliğini (`presentation_id`) **kendi sunucunuza** gönderir. Sunucunuz onaylanan alanları doğrulayıcıdan alır,
   hesabı açar ve oturum çerezi verir.
3. **Passkey (önerilir).** Kayıttan hemen sonra "Bu cihaza passkey ekle". Sonraki girişler Face ID ya da parmak iziyle olur:
   cüzdan açılmaz, **hiçbir alan paylaşılmaz**, passkey yalnızca sizin sitenize özeldir.
4. **Yeni cihaz ya da passkey yok.** "Tamga ile giriş yap" yalnızca takma adı ister, hiçbir belge alanını istemez; sonra yine passkey eklenir.

**Hesap anahtarı takma addır** ([[ADR-0031]]). Takma ad yalnızca sizin sitenize özeldir: başka bir site aynı kişi için başka
bir değer görür, siteler kişileri eşleştiremez. Kişi yeni telefonda kimliğini yeniden doğrulayınca aynı takma ad döner; hesap kaybolmaz.

## 1. Sunucu: sunumu siz açarsınız

Barındırılan doğrulayıcıya yaptığınız her çağrı kısa ömürlü, imzalı bir beyan taşır (`Authorization: Bearer …`, en fazla
60 saniye, tek kullanım). Beyanı, sitenizin güven listesindeki kaydında yer alan **[[t:access-certificate|erişim sertifikasının]] anahtarıyla**
imzalarsınız; ayrıca bir
şifre yoktur ([[ADR-0017]]).

```ts
import { createRpAssertion, pemRpSigner } from "@tamga-network/verifier";
const rp = await pemRpSigner(RP_KEY_PEM, RP_CERT_PEM); // client_id = x509_hash (sertifikadan)
const auth = async () => ({ authorization: `Bearer ${await createRpAssertion(rp, VERIFIER)}` });

// POST /tamga/start { policy }  → sayfaya: { presentation_id, qr_payload, expires_at, status_token }
const r = await fetch(`${VERIFIER}/presentations`, { method: "POST",
  headers: { ...(await auth()), "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({ policy_id: policy }) }).then((x) => x.json());
```

İstemci kimliği ([[t:x509_hash]]) sertifikanızdan hesaplanır. Takma ad ise sitenizin kayıtlı alan adına bağlıdır; sertifikayı
yenileseniz de değişmez ([[ADR-0034]]).

Cüzdanın onay ekranında **sitenizin kayıtlı adı** görünür ("aracı doğrulayıcı: verify.tamga.network" notuyla). İstediğiniz
alanlar kaydınızın kapsamına göre denetlenir.

## 2. Sayfa

Doğrulayıcı sayfa kitini hazır sunar; `<script>` ile ekleyin:

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

npm ile aynı arayüz: `import { mount, passkey } from "@tamga-network/verifier/web"`.

Kit **doğrulama yapmaz** ve **değer görmez**: yalnızca `status_token` ile durumu izler; karar ve değerler sunucunuzdadır.
`onError` INDETERMINATE durumunu ayrı gösterir: "şu an doğrulanamadı, tekrar deneyin" — bu, belgenin geçersiz olduğu anlamına gelmez.

## 3. Sunucu: oturum açma

```ts
// POST /oturum { presentation_id }  — yalnızca JSON kabul edin (CSRF), Origin aynı site olmalı
const r = await fetch(`${VERIFIER}/presentations/${id}`, { headers: await auth() }).then((x) => x.json());
if (r.outcome !== "ACCEPTED") return res.status(400).send();       // INDETERMINATE → "tekrar deneyin"
const { claims } = await fetch(`${VERIFIER}/presentations/${id}/claims`, { headers: await auth() }).then((x) => x.json());
// değerler BİR KEZ verilir (ikinci okuma 410) ve sonuçtan 5 dk sonra silinir — hemen işleyin
const hesapAnahtari = hmacSha256(SITE_SIRRI, claims.pseudonym); // takma ad yalnız size özel; yine de site sırrıyla saklayın
```

Sonucu ve değerleri yalnızca sunumu açan site alabilir; sunum kimliğini bilen başka biri `404` alır.

Örnek sitede uygulanmış hâlleriyle (`apps/verify/src/routes/site.ts`) dikkat edilecekler:

- **Tek kullanım:** bir sunum yalnızca bir oturum açar.
- **Politika denetimi:** yalnızca kendi site politikalarınızla yapılmış sunumu kabul edin.
- **Hesap anahtarı:** `claims.pseudonym`. Doğrulayıcı imzayı, `aud`/[[t:nonce]] değerlerini ve [[t:WIA]] kanıtını zaten
  denetlemiştir. Kimlik belgesinin özeti ya da kimlik numarası site politikalarında istenmez. Varsayılan olarak kişi başına tek
  takma ad (tek hesap) vardır; kaydınız `pseudonyms: "multiple"` ise kişi birden çok takma ad açabilir. "Kişi başına tek hesap"
  sınırı gerçek bir cüzdana dayanır: WIA bunu sınırlar, kesin kanıt sıfır bilgi ispatıyla gelecek.
- **Çerez:** `HttpOnly; SameSite=Lax; Secure`; süreyi sunucu tarafında tutun; CSRF için yalnızca JSON + Origin kontrolü.
- **Kişisel veri loglanmaz** (ad, anahtar, passkey kimliği dahil).

## 4. Passkey (WebAuthn)

Sunucu tarafı için bir WebAuthn kütüphanesi kullanın (örnek sitede `@simplewebauthn/server`): kayıt ve giriş için `options` +
`verify` uçları; `attestation: "none"`, `residentKey: "required"`, `userVerification: "required"`. Sayfa tarafı:

```js
const o = await post("/passkey/register/options");     // oturum açıkken
await post("/passkey/register/verify", await TamgaVerifier.passkey.create(o));
// giriş: const { flow, options } = await post("/passkey/login/options");
//        await post("/passkey/login/verify", { flow, response: await TamgaVerifier.passkey.get(options) });
```

WebAuthn **IP adresinde çalışmaz**: `localhost` ya da HTTPS alan adı gerekir (rpID = sayfanın alan adı).

## 5. Üretime geçmeden önce

- Siteniz Tamga güven listesinde bir **doğrulayıcı kaydı** ister; istediğiniz alanlar kaydın kapsamını aşamaz.
- Barındırılan doğrulayıcı üretimde beyansız isteği reddeder (`TAMGA_VERIFY_REQUIRE_RP_AUTH=1`). Demo/LAN kipinde beyansız eski
  yol `Deprecation` başlığıyla çalışır. İsterseniz doğrulamayı tamamen kendi sunucunuzda yapın: [[GUIDE-0002]].
- Politika adları ve alan setleri Tamga ile birlikte belirlenir (ör. yalnızca "18 yaşından büyük" → `age-over-18-mdoc`).

## Kurallar

Bu rehberdeki davranışların dayandığı kurallar:

| Kod | Ne der |
|---|---|
| [[SPEC-API-0001]] AP6 | istek, doğrulayıcı kaydının kapsamını aşamaz |
| [[ADR-0017]] HV1–HV4 | sonuç ve değerler yalnızca sunumu açan siteye, bir kez verilir |
| [[ADR-0017]] HV6 | aracı doğrulayıcıda ekranda ve kapsamda asıl site esas alınır |
| [[SPEC-API-0001]] P1 adımı | doğrulayıcı takma ad imzasını, `aud`/`nonce` değerlerini ve WIA'yı denetler |
| [[ADR-0031]] PS4 | site giriş politikaları kimlik numarası ya da kimlik belgesinin özetini istemez |
