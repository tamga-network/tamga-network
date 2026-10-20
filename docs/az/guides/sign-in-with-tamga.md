---
document_id: GUIDE-0001
title: "“Tamga ilə daxil ol” əlavə etmək"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-16
summary: >
  Veb sayta Tamga ilə qeydiyyat və girişin əlavə edilməsi: səhifədə `@tamga-network/verifier/web` dəsti (QR / telefonda rəqəmsal cüzdanı açmaq), serverdə nəticənin yoxlayan tərəfdən alınıb sessiyanın açılması, qeydiyyatdan sonra passkey ilə telefonsuz giriş. İşlək nümunə sandbox-dadır: verify.sandbox.tamga.network/sample-site (apps/verify/src/routes/site.ts).
translation_of: GUIDE-0001
source_version: "1.0.0"
---

# Veb saytınıza "Tamga ilə daxil ol" əlavə etmək

Bu bələdçi veb saytına şəbəkənin qaydalarına uyğun rəqəmsal cüzdanla (məs. Tamga Wallet) qeydiyyat və giriş əlavə etmək istəyən tərtibatçılar üçündür. Yoxlamanı Tamga-nın
hostinq edilən [[t:verifier|yoxlayan tərəfi]] Tamga Verify həyata keçirir; Sizə bir səhifə dəsti və bir neçə server uc nöqtəsi qalır.

**Nə vaxt oxunmalı:** saytınıza parolsuz, telefonla qeydiyyat və giriş əlavə etmək istədiyiniz zaman. Əvvəlcə [[GUIDE-0000]] ilə tanış olun.
Yoxlamanı tamamilə öz serverinizdə aparmaq istəsəniz, [[GUIDE-0002]] bölməsinə keçin.

**Sınamaq üçün:** işlək nümunə sayt test şəbəkəsindədir: `https://verify.sandbox.tamga.network/sample-site` (sandbox istifadəyə
verildikdə; ünvanlar və test rəqəmsal cüzdanının ayarı [[GUIDE-0013]] bölməsindədir). Real şəbəkədəki Tamga Verify-da nümunə sayt yoxdur.

## Necə işləyir?

1. **Qeydiyyat (bir dəfə).** Saytınız *siyasət* ilə sorğu başladır (məs. "ad, soyad" + [[t:pseudonym|psevdonim]]). Kompüterdə QR, telefonda
   "Rəqəmsal cüzdanında aç" düyməsi görünür. Şəxs rəqəmsal cüzdanda **yalnız bu sahələri** və "bu sayta xas psevdonim" sətrini görür və təsdiqləyir.
2. **Yoxlama.** Yoxlayan tərəf [[t:credential|rəqəmsal sənədi]] yoxlayır: imza, [[t:trust-list|etibar siyahısı]], [[t:revocation|ləğv]],
   [[t:holder-binding]]. Səhifəniz nəticəni izləyir; `ACCEPTED`
   olduqda təqdimat identifikatorunu (`presentation_id`) **öz serverinizə** göndərir. Serveriniz təsdiqlənmiş sahələri yoxlayan tərəfdən alır,
   hesabı açır və sessiya kukisi verir.
3. **Passkey (tövsiyə olunur).** Qeydiyyatdan dərhal sonra "Bu cihaza passkey əlavə et". Növbəti girişlər Face ID və ya barmaq izi ilə olur:
   rəqəmsal cüzdan açılmır, **heç bir sahə paylaşılmır**, passkey yalnız Sizin saytınıza xasdır.
4. **Yeni cihaz və ya passkey yoxdur.** "Tamga ilə daxil ol" yalnız psevdonimi istəyir, heç bir rəqəmsal sənəd sahəsini istəmir; sonra yenə passkey əlavə edilir.

**Hesab açarı psevdonimdir** ([[ADR-0031]]). Psevdonim yalnız Sizin sayta, yəni yoxlayan tərəf kimi Sizə məxsusdur: başqa sayt eyni şəxs üçün başqa
bir dəyər görür, saytlar şəxsləri bir-biri ilə əlaqələndirə bilməz. Şəxs yeni telefonda şəxsiyyətini yenidən təsdiqlədikdə eyni psevdonim geri qayıdır; hesab itmir.

## 1. Server: təqdimatı Siz açırsınız

Hostinq edilən yoxlayan tərəfə etdiyiniz hər çağırış qısamüddətli, imzalı bəyan daşıyır (`Authorization: Bearer …`, ən çoxu
60 saniyə, birdəfəlik). Bəyanı saytınızın etibar siyahısındakı qeydində yer alan **[[t:access-certificate|əlçatanlıq sertifikatının]] açarı ilə**
imzalayırsınız; ayrıca
parol yoxdur ([[ADR-0017]]).

```ts
import { createRpAssertion, pemRpSigner } from "@tamga-network/verifier";
const rp = await pemRpSigner(RP_KEY_PEM, RP_CERT_PEM); // client_id = x509_hash (from the certificate)
const auth = async () => ({ authorization: `Bearer ${await createRpAssertion(rp, VERIFIER)}` });

// POST /tamga/start { policy }  → to the page: { presentation_id, qr_payload, expires_at, status_token }
const r = await fetch(`${VERIFIER}/presentations`, { method: "POST",
  headers: { ...(await auth()), "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({ policy_id: policy }) }).then((x) => x.json());
```

Müştəri identifikatoru ([[t:x509_hash]]) sertifikatınızdan hesablanır. Psevdonim isə saytınızın qeydiyyatdakı domen adına bağlıdır; sertifikatı
yeniləsəniz də dəyişmir ([[ADR-0034]]).

Rəqəmsal cüzdanın təsdiq ekranında **saytınızın qeydiyyatdakı adı** görünür ("vasitəçi yoxlayan tərəf: verify.tamga.network" qeydi ilə). İstədiyiniz
sahələr qeydiyyatınızın əhatə dairəsinə görə yoxlanılır.

## 2. Səhifə

Yoxlayan tərəf səhifə dəstini hazır təqdim edir; `<script>` ilə əlavə edin:

```html
<script src="https://verify.tamga.network/tamga-verifier.js"></script>
<div id="tamga"></div>
<script>
  TamgaVerifier.mount(document.getElementById("tamga"), {
    verifier: "https://verify.tamga.network",
    policy: "site-signup", // "site-signin" for sign-in
    start: () => fetch("/tamga/start", { method: "POST", headers: { "content-type": "application/json" },
                                          body: JSON.stringify({ policy: "site-signup" }) }).then((r) => r.json()),
    onResult: (presentationId) =>
      fetch("/oturum", { method: "POST", headers: { "content-type": "application/json" },
                         body: JSON.stringify({ presentation_id: presentationId }) }).then(() => location.reload()),
  });
</script>
```

npm ilə eyni interfeys: `import { mount, passkey } from "@tamga-network/verifier/web"`.

Dəst **yoxlama aparmır** və **dəyərləri görmür**: yalnız `status_token` ilə vəziyyəti izləyir; qərar və dəyərlər serverinizdədir.
`onError` INDETERMINATE vəziyyətini ayrıca göstərir: "hazırda yoxlamaq mümkün olmadı, yenidən cəhd edin" — bu, rəqəmsal sənədin etibarsız olduğu anlamına gəlmir.

## 3. Server: sessiyanın açılması

```ts
// POST /oturum { presentation_id }  — accept JSON only (CSRF); Origin must be the same site
const r = await fetch(`${VERIFIER}/presentations/${id}`, { headers: await auth() }).then((x) => x.json());
if (r.outcome !== "ACCEPTED") return res.status(400).send();       // INDETERMINATE → "try again"
const { claims } = await fetch(`${VERIFIER}/presentations/${id}/claims`, { headers: await auth() }).then((x) => x.json());
// the values are given ONCE (a second read returns 410) and are deleted 5 min after the result — process them at once
const hesapAnahtari = hmacSha256(SITE_SIRRI, claims.pseudonym); // the pseudonym is yours alone; still store it keyed with a site secret
```

Nəticəni və dəyərləri yalnız təqdimatı açan sayt ala bilər; təqdimat identifikatorunu bilən başqa biri `404` alır.

Nümunə saytda tətbiq olunmuş formada (`apps/verify/src/routes/site.ts`) diqqət yetirilməli məqamlar:

- **Birdəfəlik istifadə:** bir təqdimat yalnız bir sessiya açır.
- **Siyasət yoxlaması:** yalnız öz sayt siyasətlərinizlə edilmiş təqdimatı qəbul edin.
- **Hesab açarı:** `claims.pseudonym`. Yoxlayan tərəf imzanı, `aud`/[[t:nonce]] dəyərlərini və [[t:WIA]] sübutunu artıq
  yoxlamışdır. Şəxsiyyət sənədinin heşi və ya şəxsiyyət nömrəsi sayt siyasətlərində tələb olunmur. Defolt olaraq hər şəxs üçün bir
  psevdonim (bir hesab) var; qeydiyyatınız `pseudonyms: "multiple"` olduqda şəxs bir neçə psevdonim aça bilər. "Hər şəxs üçün bir hesab"
  məhdudiyyəti real rəqəmsal cüzdana əsaslanır: WIA bunu məhdudlaşdırır, qəti sübut sıfır bilikli sübut vasitəsilə gələcək.
- **Kuki:** `HttpOnly; SameSite=Lax; Secure`; müddəti server tərəfində saxlayın; CSRF üçün yalnız JSON + Origin yoxlaması.
- **Fərdi məlumatlar loqlanmır** (ad, açar, passkey identifikatoru daxil olmaqla).

## 4. Passkey (WebAuthn)

Server tərəfi üçün WebAuthn kitabxanasından istifadə edin (nümunə saytda `@simplewebauthn/server`): qeydiyyat və giriş üçün `options` +
`verify` uc nöqtələri; `attestation: "none"`, `residentKey: "required"`, `userVerification: "required"`. Səhifə tərəfi:

```js
const o = await post("/passkey/register/options");     // while signed in
await post("/passkey/register/verify", await TamgaVerifier.passkey.create(o));
// sign-in: const { flow, options } = await post("/passkey/login/options");
//          await post("/passkey/login/verify", { flow, response: await TamgaVerifier.passkey.get(options) });
```

WebAuthn **IP ünvanında işləmir**: `localhost` və ya HTTPS domen adı lazımdır (rpID = səhifənin domen adı).

## 5. İstismara verməzdən əvvəl

- Saytınız Tamga etibar siyahısında **yoxlayan tərəf qeydi** tələb edir; istədiyiniz sahələr qeydin əhatə dairəsini aşa bilməz.
- Hostinq edilən yoxlayan tərəf real şəbəkədə və sandbox-da bəyansız sorğunu rədd edir (`TAMGA_VERIFY_REQUIRE_RP_AUTH=1`). Yalnız lokal
  inkişaf (demo/LAN) rejimində bəyansız köhnə yol `Deprecation` başlığı ilə işləyir. İstəsəniz, yoxlamanı tamamilə öz serverinizdə aparın: [[GUIDE-0002]].
- Siyasət adları və sahə dəstləri Tamga ilə birlikdə müəyyən edilir (məs. yalnız "18 yaşdan yuxarı" → `age-over-18-mdoc`).

## Qaydalar

Bu bələdçidəki davranışların əsaslandığı qaydalar:

| Kod | Nə deyir |
|---|---|
| [[SPEC-API-0001]] AP6 | sorğu yoxlayan tərəf qeydinin əhatə dairəsini aşa bilməz |
| [[ADR-0017]] HV1–HV4 | nəticə və dəyərlər yalnız təqdimatı açan sayta, bir dəfə verilir |
| [[ADR-0017]] HV6 | vasitəçi yoxlayan tərəfdə ekranda və əhatə dairəsində əsl sayt əsas götürülür |
| [[SPEC-API-0001]] P1 addımı | yoxlayan tərəf psevdonim imzasını, `aud`/`nonce` dəyərlərini və WIA-nı yoxlayır |
| [[ADR-0031]] PS4 | sayt giriş siyasətləri şəxsiyyət nömrəsini və ya şəxsiyyət sənədinin heşini tələb etmir |
