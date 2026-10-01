---
title: Belge verme (OpenID4VCI)
---

# Belge verme

Kurum belgeyi kişinin cüzdanına **OpenID4VCI 1.0** ile verir (AB profili HAIP 1.0). İki başlangıç yolu vardır.

## 1. Kurum teklif eder (QR ya da bağlantı)

Kurum bir **belge teklifi** oluşturur; kişi QR'ı cüzdanıyla okutur ya da bağlantıya dokunur. Teklif standarttır
(`openid-credential-offer://`). İsteğe bağlı tek kullanımlık kod (`tx_code`) teklifle aynı kanaldan gönderilmez.

## 2. Kişi cüzdandan ister

Kişi cüzdanda kurum listesinden üniversitesini seçer ve belgesini ister. Kurum, isteyenin gerçekten o kişi olduğunu
**cüzdandaki doğrulanmış kimliğin sunulmasıyla** anlar; ad ya da numarayla eşleme yapılmaz. Belge bilgileri imza anında
kurumun kendi sisteminden okunur; Tamga kişi kaydı tutmaz.

## Cüzdan kanıtı

Belgeyi alırken cüzdan, kendisini yapan cüzdan sağlayıcısının imzaladığı kısa ömürlü bir **cüzdan kanıtı** (Wallet Instance
Attestation) ve anahtarlarının güvenli donanımda tutulduğunu gösteren **anahtar kanıtı** sunar. Kurum bunları güven
listesindeki cüzdan sağlayıcılarına karşı denetler; listede olmayan sağlayıcının cüzdanına belge verilmez.

## Akış özeti

```
cüzdan                         kurum (issuer.tamga.network/{kurum})
  │  metadata  ───────────────▶  /.well-known/openid-credential-issuer/{kurum}
  │  PAR + yetki (DPoP)  ─────▶  kimlik eşleme / teklif kodu
  │  token  ──────────────────▶  cüzdan kanıtı denetimi
  │  credential (proof) ──────▶  imza; durum listesine kayıt
  │  ◀───────────────────────  SD-JWT VC (+ kimlikte mdoc), toplu kopyalar
```

## Kendiniz mi, barındırılan mı?

- **Barındırılan servis:** `issuer.tamga.network/{kurum}`; kurumunuz kendi sistemlerinden API anahtarıyla teklif oluşturur,
  belgeleri Kurum Konsolu'ndan yönetir. Rehber: [[GUIDE-0003]].
- **Kendi servisiniz:** [`@tamga-network/issuer`](/packages/issuer) ile; güven listesine kurum olarak kaydolursunuz.

## Ayrıntı

- Protokol: [[SPEC-PROTO-0001]]
- İptal listesi: [[SPEC-CRED-0003]]
- API: [Barındırılan servis API'leri](/api/)
