---
document_id: GUIDE-0002
title: "Serverdə yoxlama"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-23
summary: >
  Tamga rəqəmsal sənədini öz serverinizdə yoxlamaq: etibar mənbəyinin yüklənməsi, ləğv siyahısının əvvəlcədən alınması, siyasət → imzalı OpenID4VP sorğusu, şifrələnmiş cavabın deşifrəsi və kanonik yoxlama xətti (T0 + A–E). İstinad tətbiqi: apps/verify.
translation_of: GUIDE-0002
source_version: "1.0.0"
---

# Serverdə rəqəmsal sənədin yoxlanması

Bu bələdçi Tamga [[t:credential|rəqəmsal sənədlərini]] host edilən [[t:verifier|yoxlayan tərəfə]] müraciət etmədən **öz serverinizdə**
yoxlamaq istəyən tərtibatçılar üçündür:
işə qəbul, kampusa giriş, yaş yoxlaması, bilet keçidi.

**Nə vaxt oxumalı:** rəqəmsal sənəd dəyərlərinin heç bir vasitəçidən keçməməsini istədiyiniz və ya yoxlamanı öz infrastrukturunuzda
idarə etmək istədiyiniz zaman. Daha sürətli başlanğıc üçün host edilən yoxlayan tərəf: [[GUIDE-0001]]. İşlək kod: [[GUIDE-0004]] §2.

## Necə işləyir?

1. Serveriniz nə istədiyini **siyasət** ilə müəyyən edir (məs. "diplom: ad, ixtisas, məzuniyyət ili") və imzalı sorğu yaradır.
   Sorğu QR kod və ya keçid kimi göstərilir; onda fərdi məlumatlar yoxdur.
2. Şəxs rəqəmsal cüzdanında sorğunu görür və təsdiqləyir; rəqəmsal cüzdan cavabı **şifrələnmiş** şəkildə serverinizə göndərir.
3. Serveriniz cavabı deşifrə edir və yoxlama xəttini işə salır: imza, [[t:trust-list|etibar siyahısı]], [[t:revocation|ləğv]] statusu, müddət,
   [[t:holder-binding]] və siyasət.
4. Nəticə üç dəyərdən biridir: qəbul, rədd və ya "hazırda yoxlanıla bilmədi".

`@tamga-network/verifier` bu xəttin hamısını tətbiq edir ([[SPEC-API-0001]], addımlar T0 + A–E). İstinad yoxlayan tərəf `apps/verify`
(verify.tamga.network) eyni kitabxanadan istifadə edir; aşağıdakı addımların hamısı orada işlək vəziyyətdədir.

## Hazırlıq

1. **Yoxlayan tərəf kimi qeydiyyat.** Tamga etibar siyahısında yoxlayan tərəf qeydiyyatınız olur: daimi identifikatorunuz domen adınızdır (`dns_name`),
   müştəri identifikatorunuz [[t:x509_hash|x509_hash:…]] formatındadır (siyahı naşiri onu [[t:access-certificate|giriş sertifikatınızdan]]
   hesablayır), bundan əlavə X.509 sertifikatınız
   və tələb edə biləcəyiniz sahələrin əhatə dairəsi qeydə alınır. Sorğunuz bu əhatə dairəsini aşarsa, rəqəmsal cüzdan onu rədd edir.
2. **Etibar mənbəyi.** `@tamga-network/trust` ilə etibar siyahılarını yükləyin: `loadTrustSourceFromDir(dist)` və ya müntəzəm
   endirmə + yenidən yükləmə (`guardedReload`). Etibarla bağlı hər sualı yalnız `TrustSource`-a verin.
3. **Ləğv siyahılarını əvvəlcədən alın.** `new PrefetchStatusCache()` + müntəzəm `refresh(uriler)`. Yoxlama zamanı şəbəkəyə müraciət edilmir.
4. **Qeydiyyat sertifikatınız.** Qeydiyyat qurumu hər qeydə alınmış istifadəniz üçün [[t:registration-certificate|qeydiyyat sertifikatı]]
   dərc edir (`trust.tamga.network/wrprc/index.json` → `client_id` və `scope_id`-si sizə məxsus olan element). Onu hər sorğuya əlavə edin
   (`registrationCert`): 0.7.0 paketlərindən başlayaraq Tamga Wallet qeydiyyat sertifikatı olmayan sorğunu rədd edir ([[ADR-0026]],
   [[ADR-0056]]). İşlək kod: [[GUIDE-0004]] §2.

## Axın

```ts
import { dcqlFromPolicy, createPresentationRequest, decryptResponse, verifyPresentation, pemRpSigner,
         PrefetchStatusCache, type Policy } from "@tamga-network/verifier";

const policy: Policy = { policy_id: "ise-alim", /* credentials, trust, freshness */ } as Policy;
const signer = await pemRpSigner(RP_KEY_PEM, RP_CERT_PEM); // client_id = x509_hash (from the certificate)
// 1) request: shown as a QR code / deep link (no personal data; request_uri only)
const req = await createPresentationRequest({ signer, dcql: dcqlFromPolicy(policy),
  responseUri: "https://ornek.com.tr/vp/response", requestUriBase: "https://ornek.com.tr/vp/req",
  registrationCert: WRPRC_JWT }); // your use's registration certificate (step 4 above)
// 2) the wallet POSTs the encrypted response to response_uri → decrypt
const resp = await decryptResponse(jweBody, req.encPrivateKey); // key created with the request; match it with req.state
// 3) verify (SD-JWT; for mdoc use format: "mso_mdoc" + responseUri)
const { result, claims } = await verifyPresentation({ presentation: resp.vp_token["diploma"][0], aud: signer.clientId, nonce: req.nonce,
  policy, policyCredentialId: "diploma", trust, statusCache, rootCertsDer, rp: trust.relyingParty(signer.clientId) });
```

Sahə adları və imzalar paket tiplərində müəyyən edilib; tam işlək nümunə: `apps/verify/src/routes/presentations.ts`.

Müştəri identifikatoru `x509_hash` formatındadır (HAIP 1.0 §5); `pemRpSigner(anahtar, sertifika)` onu sertifikatdan hesablayır
([[ADR-0034]]). Sertifikatı yeniləyərkən əvvəlcə yeni sertifikat etibar siyahısına daxil edilir, sonra serveriniz yenisinə keçir.

## Nəticənin şərhi

| `outcome` | Mənası | İstifadəçiyə |
|---|---|---|
| `ACCEPTED` | bütün addımlardan keçdi | yalnız `claims` daxilindəki təsdiqlənmiş sahələrdən istifadə edin |
| `REJECTED` | rəqəmsal sənəd etibarsızdır (imza, ləğv, müddət, bağlantı, siyasət) — `failed_step` hansı addımda ilişdiyini göstərir | "Rəqəmsal sənəd qəbul edilmədi" |
| `INDETERMINATE` | infrastruktur və ya aktuallıq problemi (məs. D2/D4/D5 addımlarında `STATUS_STALE`) — rəqəmsal sənəddə problem yoxdur | "Hazırda yoxlanıla bilmədi, yenidən cəhd edin" |

`checks_performed` / `checks_skipped` audit üçün saxlanıla bilər; **fərdi məlumatları saxlamayın**. Saat sürüşməsinə tolerantlıq
`policy.freshness.max_clock_skew_sec` ilə tənzimlənir (standart dəyər 120 san).

## Yoxlama siyahısı

- [[t:nonce|Nonce]] birdəfəlikdir; eyni cavab ikinci dəfə emal edilmir.
- Siyasət yalnız lazım olan sahəni tələb edir; yaş üçün [[t:mdoc]] `age_over_18` və ya `age_over_15` kimi tək bir sahə
  kifayətdir (həddlər qapalı çoxluqdur: 15 və 18; [[ADR-0064]]). Tamga Verify-da `age-over-15-mdoc` və `age-over-15-zk` siyasətləri də var.
- [[t:status-list|Ləğv siyahısının]] əvvəlcədən alınması və etibar siyahısının yenilənməsi işləməlidir. İşləmirsə, nəticələr `INDETERMINATE` olur — bu, düzgün davranışdır.

## Ətraflı: sıfır bilik sübutu ilə yaş yoxlaması (`mso_mdoc_zk`)

"18 yaşdan böyükdürmü?" sualını rəqəmsal sənədi, doğum tarixini, qurumun imzasını və cihaz açarını görmədən verə bilərsiniz
([[ADR-0032]]). Rəqəmsal cüzdan [[t:Longfellow-ZK]] ilə sübut yaradır; Siz yalnız "qeydiyyatlı qurumun şəxsiyyət sənədində
`age_over_18 = true`" məlumatını öyrənirsiniz. Eyni şəxsin iki təqdimatını bir-birinə bağlamaq mümkün deyil.

```ts
const policy: Policy = {
  policy_id: "age-over-18-zk",
  purpose: { "en-US": "Over-18 check — yes/no only" },
  credentials: [{
    // ADR-0044: ZK only with the identity credential's short-lived ZK copy (≤ 24 hours, no revocation list)
    id: "identity", vct_values: ["urn:tamga:id:ShortLivedIdentityAttestation:1"],
    format: "mso_mdoc_zk", namespace: "tamga.id.1",
    required_claims: ["age_over_18"], constraints: { age_over_18: true }, // equality only
  }],
  trust: { ... }, freshness: { ... },
};
// Request: the accepted circuits come from the signed list (ZK2)
const dcql = dcqlFromPolicy(policy, { zkCircuits: trust.zkCircuits?.() ?? [] });
// Response: vp_token.identity[0] = base64url(DeviceResponse{ zkDocuments })
const out = await verifyPresentation({ presentation, format: "mso_mdoc_zk", responseUri, aud, nonce,
  policy, policyCredentialId: "identity", trust, statusCache, rootCertsDer, rp: trust.relyingParty(aud) });
```

- **Nəticəni `isYes` ilə oxuyun:** `isYes(out, "age_over_18")` yalnız qəbul edilmiş nəticədə və dəyər tam olaraq `true` olduqda "bəli" qaytarır;
  rədd və ya "yoxlanıla bilmədi" nəticəsi heç vaxt "bəli" kimi oxunmur.
- **Yoxlama paketlə gələn WebAssembly ilə işləyir;** Rust və ya lokal kompilyasiya tələb olunmur. Bir yoxlama masaüstündə ~3 san çəkir.
- **Çox yüksək həcm üçün lokal backend:** `packages/verifier/zk` mənbəyindən `cargo build --release --locked --features native
  --bin tamga-zk-verify` (Rust 1.98.1, Linux/macOS), sonra `new NativeZkBackend({ binPath })` və ya mühitdən
  `zkBackendFromEnv()` (`TAMGA_ZK_NATIVE_BIN`) → `VerifyInput.zk`. Yoxlama ~0,2–0,3 san çəkir; binar fayl cavab vermədikdə WASM-a keçir.
- **Yeni addım `Z1`:** sxem imzalı siyahıdadırmı, yalnız tələb olunan element açıqlanıbmı, zaman möhürü aktualdırmı, sübut etibarlıdırmı?
  Qurumun imzası, cihaz imzası və etibarlılıq müddəti sübutun daxilində yoxlanılır (`checks_skipped`: A4–A7). Ləğv statusu gəlmir
  (`status.value: NOT_APPLICABLE`, səbəbi `status.reason`-da). ZK ilə yalnız şəxsiyyət sənədinin qısamüddətli surəti təqdim edilir
  ([[ADR-0044]]): ən çoxu 24 saat etibarlıdır, ləğv edilmiş rəqəmsal sənədin surəti yenilənmir; sübut surətin növünü bağladığı üçün
  yoxlayan tərəf qısa müddəti görür və ləğv yoxlamasını gözləmir. ZK-da ləğv ən gec 24 saat ərzində qüvvəyə minir; ləğvi dərhal görməyiniz
  lazımdırsa, klassik `mso_mdoc` siyasətindən istifadə edin.
- **`accept_unrevocable_zk`:** yalnız qısamüddətli surət OLMAYAN (işarəsiz) ZK təqdimatı üçündür. `true` ləğvi yoxlanıla bilməyən
  belə təqdimatı bilərəkdən qəbul edir; `false` olduqda və ya sahə olmadıqda (standart) işarəsiz ZK təqdimatı
  `INDETERMINATE` qaytarır (addım `D1`, `STATUS_UNREACHABLE`).
- **Ehtiyat yol:** rəqəmsal cüzdan ZK-nı dəstəkləmirsə, sorğunuz uyğun gəlmir; eyni sualı klassik `mso_mdoc` siyasəti ilə
  (`age-over-18-mdoc`) verin. Rəqəmsal cüzdan tərəfi: `@tamga-network/zk` (Android lokal kitabxanası hazırdır, iOS gözlənilir); sübut yaradıcısı
  olmayan rəqəmsal cüzdan klassik yoldan istifadə edir (ZK5).

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[SPEC-API-0001]] AP2 | `INDETERMINATE` `REJECTED` ilə eyni qrupa salınmır |
| [[SPEC-API-0001]] AP3–AP4 | nəticə və qeydlər sahə dəyərlərini və ləğv indeksini daşımır |
| [[SPEC-API-0001]] AP6 | sorğu yoxlayan tərəf qeydiyyatının əhatə dairəsini aşa bilməz |
| Vahid etibar interfeysi | etibar məlumatları yalnız `TrustSource` vasitəsilə oxunur |
| [[SPEC-CRED-0003]] S12 | hər yoxlama üçün ləğv siyahısı alınmır; toplu əvvəlcədən alma istifadə olunur |
| [[SPEC-PROTO-0002]] PV10 | `nonce` birdəfəlikdir |
| [[ADR-0032]] ZK2, ZK5 | yalnız imzalı siyahıdakı sxemlər qəbul edilir; ZK yoxdursa, klassik yol |
