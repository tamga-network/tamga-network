---
title: Rəqəmsal sənədin təqdim edilməsi (OpenID4VP)
---

# Rəqəmsal sənədin təqdim edilməsi

[[t:verifier|Yoxlayan tərəf]] (sayt, işəgötürən, giriş qapısı) rəqəmsal cüzdandan rəqəmsal sənəd tələb edir; şəxs bunu təsdiqləyir; yoxlayan tərəf nəticəni lokal olaraq, mənbəyə
müraciət etmədən hesablayır. Protokol **[[t:OpenID4VP]] 1.0** (Avropa İttifaqı (Aİ) profili [[t:HAIP]] 1.0), sorğu dili **[[t:DCQL]]**.

## Sorğu

- Sorğu **imzalanır**. Yoxlayan tərəfin identifikatoru onun [[t:access-certificate|giriş sertifikatının]] barmaq izidir
  ([[t:x509_hash|client_id = x509_hash:…]]); rəqəmsal cüzdan imzanı, sertifikatı və yoxlayan tərəfin [[t:trust-list|etibar siyahısındakı]]
  qeydini yoxlayır, qeydə alınmış məqsədi və tələb olunan sahələri şəxsə göstərir.
- Yoxlayan tərəf yalnız etibar siyahısındakı qeydinin əhatə etdiyi sahələri tələb edə bilər.
- Cavab yoxlayan tərəfin açarı ilə **şifrələnir**.

## Kanallar

| Kanal | Nə vaxt | Status |
|---|---|---|
| QR / keçid (`openid4vp://`) | başqa cihazdakı sayt və ya kiosk | istifadədədir |
| Digital Credentials API | eyni telefonun brauzerində açılan sayt (brauzer rəqəmsal cüzdanı açır) | yoxlayan tərəf hazırdır; rəqəmsal cüzdanla bağlantı hələ yoxdur |
| ISO 18013-5 yaxın məsafə (BLE) | qapı, turniket, kassa — üz-üzə | kodlaşdırılıb; cihaz testini gözləyir (o vaxta qədər qısamüddətli keçid kartı) |

## Yoxlama və üç nəticə

Yoxlayan tərəf imzanı, [[t:issuer|sənədi verən qurumun]] etibar siyahısındakı səlahiyyətini, [[t:holder-binding|holder binding-i]], müddəti və ləğv
statusunu ardıcıllıqla yoxlayır. Nəticə **üç dəyərlidir**:

| Nəticə | Mənası |
|---|---|
| `ACCEPTED` | rəqəmsal sənəd etibarlıdır |
| `REJECTED` | rəqəmsal sənəd etibarsızdır; hansı mərhələdə uğursuz olduğu bildirilir |
| `INDETERMINATE` | hazırda yoxlamaq mümkün olmadı (məs. ləğv siyahısı köhnəlib) — bu, rəqəmsal sənədin etibarsız olduğu demək **deyil** |

```ts
import { verifyPresentation } from "@tamga-network/verifier";

const { result, claims } = await verifyPresentation({
  presentation, aud, nonce, policy, policyCredentialId: "diploma", trust, statusCache, // full example: Code examples
});
if (result.outcome === "ACCEPTED") {
  // claims: only the fields the policy asked for. Log field names only, never values.
}
```

## Özünüz, yoxsa xidmət kimi?

- **Tamga Verify** (`verify.tamga.network`): host edilən yoxlayan tərəf xidməti və səhifə dəsti; nəticə yalnız sizin serverinizə və yalnız bir dəfə
  verilir. Bələdçi: [[GUIDE-0001]].
- **Öz serveriniz:** [`@tamga-network/verifier`](/packages/verifier). Bələdçi: [[GUIDE-0002]].

## Ətraflı

- Protokol: [[SPEC-PROTO-0002]], yoxlama ardıcıllığı: [[SPEC-API-0001]]
