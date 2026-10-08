---
title: Belge verme (OpenID4VCI)
---

# Belge verme

Kurum, yani [[t:issuer|belge veren]], belgeyi kişinin cüzdanına **[[t:OpenID4VCI]] 1.0** ile verir (AB profili [[t:HAIP]] 1.0).
İki başlangıç yolu vardır.

## 1. Kurum teklif eder (QR ya da bağlantı)

Kurum bir **[[t:credential-offer|belge teklifi]]** oluşturur; kişi QR'ı cüzdanıyla okutur ya da bağlantıya dokunur. Teklif
standarttır (`openid-credential-offer://`). İsteğe bağlı tek kullanımlık kod (`tx_code`) teklifle aynı kanaldan gönderilmez.

## 2. Kişi cüzdandan ister

Kişi cüzdanda kurum listesinden üniversitesini seçer ve belgesini ister. Kurum, isteyenin gerçekten o kişi olduğunu
**cüzdandaki doğrulanmış kimliğin sunulmasıyla** anlar; ad ya da numarayla eşleme yapılmaz. Belge bilgileri imza anında
kurumun kendi sisteminden, yani [[t:authentic-source|yetkili kaynaktan]] okunur; Tamga kişi kaydı tutmaz.

## Cüzdan kanıtları

Belgeyi alırken cüzdan, kendisini yapan [[t:wallet-provider|cüzdan sağlayıcısının]] imzaladığı kısa ömürlü bir [[t:WIA]] ve
anahtarlarının güvenli donanımda tutulduğunu gösteren [[t:key-attestation]] sunar. Kurum bunları
[[t:trust-list|güven listesindeki]] cüzdan sağlayıcılarına karşı denetler; listede olmayan sağlayıcının cüzdanına belge
verilmez.

## Akış özeti

```
cüzdan                         kurum (issuer.tamga.network/{kurum})
  │  metadata  ───────────────▶  /.well-known/openid-credential-issuer/{kurum}
  │  PAR + yetki (DPoP)  ─────▶  kimlik eşleme / teklif kodu
  │  token  ──────────────────▶  cüzdan kanıtı denetimi
  │  credential (proof) ──────▶  imza; iptal listesine kayıt
  │  ◀───────────────────────  SD-JWT VC (+ kimlikte mdoc), toplu kopyalar
```

## Kendiniz mi, barındırılan mı?

- **Barındırılan servis:** `issuer.tamga.network/{kurum}`; kurumunuz kendi sistemlerinden API anahtarıyla teklif oluşturur,
  belgeleri Kurum Konsolu'ndan yönetir. Rehber: [[GUIDE-0003]].
- **Kendi servisiniz:** [`@tamga-network/issuer`](/packages/issuer) ile; güven listesine belge veren olarak kaydolursunuz.

## Ayrıntı

- Protokol: [[SPEC-PROTO-0001]]
- İptal listesi: [[SPEC-CRED-0003]]
- API: [Belge verme API'si](/api/issuer)
