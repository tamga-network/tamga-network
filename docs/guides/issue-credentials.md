---
document_id: GUIDE-0003
title: "Kurum olarak belge vermek"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-04
summary: >
  Üniversite, kamu kurumu ya da bilet satıcısı olarak kişilerin cüzdanına belge vermek: Tamga'nın barındırdığı belge verme
  servisini `@tamga-network/issuer/client` ile çağırmak (teklif, bilet satışı, iptal/askı) ya da kendi belge verme servisinizi
  `@tamga-network/issuer` kütüphanesiyle kurmak. Dış erişim kurum başına kapsamlı API anahtarıyla (ADR-0016).
---

# Kurum olarak belge vermek

Bu rehber, kişilerin cüzdanına belge vermek isteyen kurumların, yani [[t:issuer|belge verenlerin]], geliştiricileri
içindir: üniversite (diploma, öğrenci belgesi), kamu kurumu ya da bilet satıcısı.

**Ne zaman okunur:** kurumunuz Tamga'ya katılmaya karar verdiğinde, entegrasyona başlamadan önce. Kavramlar için
[Belge verme](/concepts/issuance); çalışan kod için [[GUIDE-0004]] §3.

## Nasıl çalışır?

1. Kurumunuz bir **[[t:credential-offer|belge teklifi]]** oluşturur: "bu kişiye şu belgeyi vereceğiz". Teklif bir bağlantı ya da QR'dır.
2. Kişi teklifi cüzdanıyla açar; cüzdan [[t:credential|belgeyi]] [[t:OpenID4VCI]] ile kurumdan alır.
3. Belge kurumunuzun anahtarıyla imzalanır ve kişinin cihazındaki anahtara bağlanır ([[t:holder-binding]]); başka bir cihazda
   işe yaramaz.
4. Gerekirse belgeyi [[t:revocation|iptal]] edersiniz ya da askıya alırsınız; [[t:verifier|doğrulayıcılar]] bunu
   [[t:status-list|iptal listesinden]] görür.

İki yol var:

| | Barındırılan servis (önerilen başlangıç) | Kendi servisiniz |
|---|---|---|
| Kim çalıştırır | Tamga (`issuer.tamga.network/<kurum>`) | siz |
| Kuracağınız | `@tamga-network/issuer/client` (bağımlılıksız, `fetch`) | `@tamga-network/issuer` (+ trust, schemas, sd-jwt) |
| İmza anahtarı | pilotta sizin KMS'iniz (demo: geliştirme PKI'si, sapma S-1) | sizin |
| Güven listesi kaydı | Tamga operatörü: kurum kaydı, kategori (ör. `EDUCATION`, `EVENTS` — [[ADR-0014]]), şema yetkileri | aynı |

## Barındırılan servis: istemci

> **Önce sandbox'ta deneyin.** Aşağıdaki örnek, test ağındaki kurgusal bilet satıcısının (`bubilet`,
> `issuer.sandbox.tamga.network`) adresini kullanır; sandbox'ın adresleri ve örnek kurumları [[GUIDE-0013]]'te. Gerçek ağda
> `baseUrl` `https://issuer.tamga.network`, `slug` kurumunuzun kayıtlı adıdır; API anahtarını kurum kaydından sonra Kurum
> Konsolu verir.

```ts
import { createIssuerClient } from "@tamga-network/issuer/client";

const tamga = createIssuerClient({ baseUrl: "https://issuer.sandbox.tamga.network", slug: "bubilet", apiKey: process.env.TAMGA_API_KEY! });

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

Üç teklif türünden hangisi?

- **Kimliğe bağlı teklif (önerilen):** kişi kimlik belgesini cüzdanda gösterir, Tamga onu teklifteki özetle eşler. PIN gerekmez.
- **PIN'li teklif:** kimlik belgesi olmayan kişi için yedek yol. PIN teklif bağlantısıyla aynı kanaldan gönderilmez.
- **Bilet:** kişisel veri taşımaz; kimlik istenmez.

### API anahtarı

Tamga operatörü kurumunuz için kapsamlı bir anahtar üretir (`tmg_<slug>_…`; ör. yalnızca `tickets:write` + `revocations:write`)
ve güvenli kanaldan bir kez iletir; sunucuda yalnızca özeti tutulur ([[ADR-0016]]).

- Anahtar 90 gün geçerlidir. Döndürmek için yenisi üretilir, siz geçersiniz, eskisi iptal edilir (ikisi bir süre birlikte geçerlidir).
- Çağrılar `https://issuer.tamga.network/{slug}/api/v1/…` adresine gider; anahtar başına dakikalık sınır vardır (aşılırsa `429`).
- Kapsamlar: `offers:write`, `tickets:write`, `tickets:read`, `revocations:write`. Pilot kurumlarında ek olarak mTLS istenebilir.

## Belge bilgileri sizin sisteminizden: sorgu ucu

[[t:authentic-source|Yetkili kaynak]] sizin sisteminizdir (ör. öğrenci bilgi sistemi). Tamga belge bilgilerini tutmaz; belge verildiği anda sisteminizin
**sorgu ucuna** imzalı bir istekle sorar ve yanıtı saklamaz ([[ADR-0020]]). Sözleşme: `docs/api/institution-source.openapi.yaml`.

- `lookup`: kişi cüzdandan kurumunuzu seçip kimliğini sunduğunda — T.C. kimlik no + doğum tarihiyle arama.
- `fetch`: kimliğe bağlı teklifte, belge verilirken ve kopya yenilemede — sizin opak kişi kimliğinizle okuma.
- İstek, Tamga'nın [[t:trust-list|güven listesindeki]] kaydında yer alan [[t:access-certificate|erişim sertifikasıyla]]
  imzalı 60 saniyelik bir JWT'dir; `aud`, `exp` ve `jti`'yi denetleyin.
- Sorgu ucu bağlanana kadar belge vermeyi sandbox'taki örnek kurumlarla deneyin ([[GUIDE-0013]]). Kurum Konsolu'nun **örnek
  kaynağı** yalnız sandbox ortamında açılır; gerçek ağda kapalıdır ve oraya gerçek kişi verisi girilmez.

Tamga API'sinin tamamı: `docs/api/tamga-issuer-api.openapi.yaml`.

## Kişisel veri ve kimlik

- Belge alanlarını yalnızca belge için kullanın; loglara, URL'ye, iptal listesine yazmayın.
- Kişiyi kendi kaydınızla eşlemeniz gerekiyorsa (diploma, öğrenci belgesi) [[t:identity-proofing|kimlik doğrulama]]
  **Tamga kimlik belgesi** ile yapılır: cüzdan kimlik belgesini sunar, Tamga bunu teklifteki özetle ya da sorgu ucunuzla (`lookup`) eşler. Kimlik
  sağlayıcısıyla (Didit) doğrudan konuşmazsınız ([[ADR-0011]]).
- Bilet gibi kişisel veri gerektirmeyen belgelerde kimlik istemeyin.

## Derinlik: kendi servisiniz

`@tamga-network/issuer` belge üretimini, OpenID4VCI sunucu yardımcılarını (teklif, `tx_code`, `c_nonce`,
[[t:proof-of-possession]] doğrulaması), Token Status List yayıncısını ve çapa isteğini sağlar; protokol profili [[SPEC-PROTO-0001]].
Referans: Tamga'nın işlettiği belge verme servisi. Başlamadan önce Tamga ile kurum kaydı, şema
yetkileri ve anahtar yönetimi (KMS/HSM) konuşulur.

## Kurallar

| Kod | Ne der |
|---|---|
| [[SPEC-CRED-0003]] S5 | iptal listesi, değişiklik olmasa da sabit aralıkta yayınlanır |
| [[SPEC-CRED-0003]] S6 | aralık dışı ("acil") yayın yapılmaz; iptalin etkisi bir sonraki yayındadır |
| [[SPEC-CRED-0003]] S8 | iptal listesinin adresi opaktır; yıl, bölüm, kohort kodlamaz |
| DP1 | kişisel veri ve belge içeriği güven altyapısına yazılmaz |
