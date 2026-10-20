---
title: Rəqəmsal sənədin verilməsi (OpenID4VCI)
---

# Rəqəmsal sənədin verilməsi

Qurum, yəni [[t:issuer|sənədi verən qurum]], rəqəmsal sənədi şəxsin rəqəmsal cüzdanına **[[t:OpenID4VCI]] 1.0** vasitəsilə verir (Aİ profili [[t:HAIP]] 1.0).
İki başlanğıc yolu var.

## 1. Qurum təklif edir (QR və ya keçid)

Qurum **[[t:credential-offer|rəqəmsal sənəd təklifi]]** yaradır; şəxs QR kodu rəqəmsal cüzdanı ilə skan edir və ya keçidə toxunur. Təklif
standartdır (`openid-credential-offer://`). Əvvəlcədən səlahiyyətləndirilmiş (pre-authorized) təklifdə birdəfəlik 6 rəqəmli kod (`tx_code`)
**məcburidir**: kod qurumun ekranında, sistemə daxil olmuş şəxsə QR kodla birlikdə göstərilir; təklif e-poçtla göndərilirsə, kod başqa
kanalla (SMS) gəlir. Qurumun şəxsiyyətə bağlı təklifində kod yoxdur; şəxs bunun əvəzinə rəqəmsal cüzdandakı təsdiqlənmiş şəxsiyyətini yoxlayan tərəf qismində çıxış edən quruma təqdim edir.

## 2. Şəxs rəqəmsal cüzdandan sorğu göndərir

Şəxs rəqəmsal cüzdanda qurumlar siyahısından öz universitetini seçir və rəqəmsal sənədini tələb edir. Qurum sorğu göndərənin həqiqətən həmin şəxs olduğunu
**rəqəmsal cüzdandakı təsdiqlənmiş şəxsiyyətin yoxlayan tərəf qismində quruma təqdim edilməsi ilə** müəyyən edir; ad və ya nömrə ilə uyğunlaşdırma aparılmır. Rəqəmsal sənədin məlumatları imzalanma anında
qurumun öz sistemindən, yəni [[t:authentic-source|səlahiyyətli mənbədən]] oxunur; Tamga şəxslərin qeydiyyatını aparmır.

## Rəqəmsal cüzdanın sübutları

Rəqəmsal sənədi alarkən rəqəmsal cüzdan onu hazırlamış [[t:wallet-provider|cüzdan provayderinin]] imzaladığı qısamüddətli [[t:WIA]] və
açarlarının təhlükəsiz aparat təminatında saxlandığını göstərən [[t:key-attestation]] təqdim edir. Qurum bunları
[[t:trust-list|etibar siyahısındakı]] cüzdan provayderləri ilə müqayisədə yoxlayır; siyahıda olmayan provayderin rəqəmsal cüzdanına rəqəmsal sənəd
verilmir.

## Axının xülasəsi

```
wallet                         institution (issuer.tamga.network/{institution})
  │  metadata  ───────────────▶  /.well-known/openid-credential-issuer/{institution}
  │  PAR + authorisation (DPoP) ▶  identity matching / offer code
  │  token  ──────────────────▶  wallet attestation check
  │  credential (proof) ──────▶  signature; entry in the status list
  │  ◀───────────────────────  SD-JWT VC (+ mdoc for identity), batch copies
```

## Özünüz, yoxsa xidmət kimi?

- **Xidmət kimi təqdim olunan servis:** `issuer.tamga.network/{kurum}`; qurumunuz öz sistemlərindən API açarı ilə təklif yaradır,
  rəqəmsal sənədləri Qurum Konsolundan idarə edir. Bələdçi: [[GUIDE-0003]].
- **Öz servisiniz:** [`@tamga-network/issuer`](/packages/issuer) ilə; etibar siyahısında sənədi verən qurum kimi qeydiyyatdan keçirsiniz.

## Ətraflı

- Protokol: [[SPEC-PROTO-0001]]
- Ləğv siyahısı: [[SPEC-CRED-0003]]
- API: [Rəqəmsal sənədin verilməsi API-si](/api/issuer)
