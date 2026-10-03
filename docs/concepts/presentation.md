---
title: Belge gösterme (OpenID4VP)
---

# Belge gösterme

[[t:verifier|Doğrulayıcı]] (site, işveren, kapı) cüzdandan belge ister; kişi onaylar; doğrulayıcı sonucu yerelde, kaynağa
sormadan hesaplar. Protokol **[[t:OpenID4VP]] 1.0** (AB profili [[t:HAIP]] 1.0), sorgu dili **[[t:DCQL]]**.

## İstek

- İstek **imzalıdır**. Doğrulayıcının kimliği [[t:access-certificate|erişim sertifikasının]] parmak izidir
  ([[t:x509_hash|client_id = x509_hash:…]]); cüzdan imzayı, sertifikayı ve doğrulayıcının [[t:trust-list|güven listesindeki]]
  kaydını denetler, kayıtlı amacı ve istenen alanları kişiye gösterir.
- Doğrulayıcı yalnız güven listesindeki kaydının kapsamındaki alanları isteyebilir.
- Yanıt doğrulayıcının anahtarıyla **şifrelenir**.

## Kanallar

| Kanal | Ne zaman |
|---|---|
| QR / bağlantı (`openid4vp://`) | başka bir cihazdaki site ya da kiosk |
| Digital Credentials API | aynı telefondaki tarayıcıda site (tarayıcı cüzdanı açar) |
| ISO 18013-5 yakın alan (BLE) | kapı, turnike, gişe — yüz yüze |

## Doğrulama ve üç sonuç

Doğrulayıcı imzayı, [[t:issuer|belge verenin]] güven listesindeki yetkisini, [[t:holder-binding|holder binding'i]], süreyi ve iptal
durumunu sırayla denetler. Sonuç **üç değerlidir**:

| Sonuç | Anlamı |
|---|---|
| `ACCEPTED` | belge geçerli |
| `REJECTED` | belge geçersiz; hangi adımda düştüğü bildirilir |
| `INDETERMINATE` | şu an doğrulanamadı (ör. iptal listesi bayat) — belgenin kötü olduğu anlamına **gelmez** |

```ts
import { verifyPresentation } from "@tamga-network/verifier";

const { result, claims } = await verifyPresentation({
  presentation, aud, nonce, policy, policyCredentialId: "diploma", trust, statusCache, // tam örnek: Kod örnekleri
});
if (result.outcome === "ACCEPTED") {
  // claims: yalnız politikanın istediği alanlar. Günlüğe değer değil, yalnız alan adı yazın.
}
```

## Kendiniz mi, barındırılan mı?

- **Tamga Verify** (`verify.tamga.network`): barındırılan doğrulayıcı ve sayfa kiti; sonuç yalnız sizin sunucunuza ve bir kez
  verilir. Rehber: [[GUIDE-0001]].
- **Kendi sunucunuz:** [`@tamga-network/verifier`](/packages/verifier). Rehber: [[GUIDE-0002]].

## Ayrıntı

- Protokol: [[SPEC-PROTO-0002]], doğrulama hattı: [[SPEC-API-0001]]
