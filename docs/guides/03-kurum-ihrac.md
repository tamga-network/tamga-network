---
document_id: GUIDE-0003
title: Kurum Olarak Belge Vermek (Barındırılan İhraç ve @tamga-network/issuer)
category: Guide
domain: Integration
status: Draft
review_status: Draft
version: 0.2.0
created: 2026-09-27
last_updated: 2026-09-29
authors:
  - Tamga Network Engineering
tags: [guide, issuer, openid4vci, hosted, ticketing]
keywords: [createIssuerClient, sellTicket, createOffer, createBoundOffer, revoke, tx_code, barındırılan ihraç, sorgu ucu]
summary: >
  Üniversite, kamu kurumu ya da bilet satıcısı olarak kişilerin cüzdanına belge vermek: Tamga'nın barındırdığı ihraç servisini
  `@tamga-network/issuer/client` ile çağırmak (teklif, bilet satışı, iptal/askı) ya da kendi ihraç servisinizi
  `@tamga-network/issuer` kütüphanesiyle kurmak. Dış erişim kurum başına kapsamlı API anahtarıyla (ADR-0016).
priority: High
language: tr
audience: [integrators, institutions]
related: ["[[SPEC-PROTO-0001]]", "[[ADR-0016]]", "[[ADR-0014]]", "[[ADR-0011]]", "[[ADR-0020]]"]
---

# Kurum olarak belge vermek

## İki yol
| | Barındırılan ihraç (önerilen başlangıç) | Kendi ihraç servisiniz |
|---|---|---|
| Kim çalıştırır | Tamga (`issuer.tamga.network/<kurum>`) | siz |
| Kuracağınız | `@tamga-network/issuer/client` (bağımlılıksız, `fetch`) | `@tamga-network/issuer` (+ trust, schemas, sd-jwt) |
| İmza anahtarı | pilotta sizin KMS'iniz (demo: geliştirme PKI'si, sapma S-1) | sizin |
| Güven listesi kaydı | Tamga operatörü: kurum kaydı, kategori (ör. `EDUCATION`, `EVENTS` — [[ADR-0014]]), şema yetkileri | aynı |

## Barındırılan ihraç: istemci
```ts
import { createIssuerClient } from "@tamga-network/issuer/client";

const tamga = createIssuerClient({ baseUrl: "https://issuer.tamga.network", slug: "bubilet", apiKey: process.env.TAMGA_API_KEY! });

// Bilet sattınız → cüzdana teklif (bilette kişisel veri yok)
const sale = await tamga.sellTicket({ eventId: "EVT-2026-KONSER-01", ticketClass: "STANDARD" });
// sale.offer.deepLink → QR ya da "cüzdanda aç" bağlantısı
// sale.offer.txCode   → AYRI kanaldan (SMS, e-posta, kasa ekranı) — teklif bağlantısıyla aynı kanaldan GÖNDERMEYİN (S5)

// Kayıtlı kişiye belge — önerilen: kimliğe bağlı teklif (PIN yok; yalnız teklifin sahibi alabilir, ADR-0020)
const bound = await tamga.createBoundOffer({
  subjectId: "s-1001", // kendi sisteminizdeki opak kişi kimliği
  vct: "urn:tamga:edu:DiplomaCredential:1",
  bind: { personalAdministrativeNumber: tckn, birthDate: "2002-05-14" }, // Tamga yalnız anahtarlı özetini saklar
});
// bound.deepLink → kişiye KENDİ kanalınızla (e-posta, öğrenci portalı) iletin; 7 gün, tek kullanımlık

// Yedek: kimlik belgesi olmayan kişi için PIN'li teklif
const offer = await tamga.createOffer({ subjectId: "s-1001", vct: "urn:tamga:edu:StudentCredential:1" });

// İptal / askı / geri alma — etkisi bir sonraki sabit aralıklı yayında (S6)
await tamga.revoke(credentialId, "mezuniyet iptali");
```
Hatalar `IssuerClientError` (`status` + mesaj) olarak gelir. Anahtar **yalnızca sunucuda** tutulur; tarayıcıya konmaz.

**API anahtarı ([[ADR-0016]]).** Tamga operatörü kurumunuz için kapsamlı bir anahtar üretir (`tmg_<slug>_…`; ör. yalnızca
`tickets:write` + `revocations:write`) ve güvenli kanaldan bir kez iletir; sunucuda yalnızca özeti tutulur. Anahtar 90 gün geçerlidir;
döndürmek için yenisi üretilir, siz geçersiniz, eskisi iptal edilir (ikisi bir süre birlikte geçerli). Çağrılar
`https://issuer.tamga.network/{slug}/api/v1/…` adresine gider; anahtar başına dakikalık sınır vardır (aşılırsa `429`).
Kapsamlar: `offers:write`, `tickets:write`, `tickets:read`, `revocations:write`. Pilot kurumlarında ek olarak mTLS istenebilir.

## Belge bilgileri sizin sisteminizden: sorgu ucu ([[ADR-0020]])
Yetkili kaynak sizin sisteminizdir (öğrenci bilgi sistemi vb.). Tamga belge bilgilerini tutmaz; belge verildiği anda
sisteminizin **sorgu ucuna** imzalı bir istekle sorar ve yanıtı saklamaz. Sözleşme: `docs/api/institution-source.openapi.yaml`.
- `lookup`: kişi cüzdandan kurumunuzu seçip kimliğini sunduğunda — T.C. kimlik no + doğum tarihiyle arama.
- `fetch`: kimliğe bağlı teklifte, belge verilirken ve kopya yenilemede — sizin opak kişi kimliğinizle okuma.
- İstek, Tamga'nın güven listesindeki erişim sertifikasıyla imzalı 60 saniyelik bir JWT'dir; `aud`, `exp` ve `jti`'yi denetleyin.
- Sorgu ucu bağlanana kadar Kurum Konsolu'ndaki **örnek kaynak** ile deneme yapılabilir; oraya üretim için gerçek kişi verisi
  girilmez.

Tamga API'sinin tamamı: `docs/api/tamga-issuer-api.openapi.yaml`.

## Kişisel veri ve kimlik
- Belge alanlarını yalnızca belge için kullanın; loglara, URL'ye, iptal listesine yazmayın (DP1, S8).
- Kişiyi kendi kaydınızla eşlemeniz gerekiyorsa (diploma, öğrenci belgesi) kimlik doğrulaması **Tamga kimlik attestation'ı** ile
  yapılır: cüzdan kimlik belgesini sunar, Tamga bunu teklifteki özetle ya da sorgu ucunuzla (`lookup`) eşler — kimlik sağlayıcısıyla (Didit) doğrudan konuşmazsınız
  ([[ADR-0011]]).
- Bilet gibi kişisel veri gerektirmeyen belgelerde kimlik istemeyin.

## Kendi ihraç servisiniz
`@tamga-network/issuer` credential fabrikası, OpenID4VCI sunucu yardımcıları (teklif, `tx_code`, `c_nonce`, kanıt doğrulama),
Token Status List yayıncısı ve çapa isteği sağlar; protokol profili [[SPEC-PROTO-0001]]. Referans: `tamga-platform` issuer servisi
(Tamga'nın kendi kullandığı). Başlamadan önce Tamga ile kurum kaydı, şema yetkileri ve anahtar yönetimi (KMS/HSM) konuşulur.
