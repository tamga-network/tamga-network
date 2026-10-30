---
document_id: ADR-0071
title: "Geçici dönemde ağın finansmanı: hizmet ücreti yok; vakıf hibe ve devlet/üye katkısıyla"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  Geçici dönemde (vakıf kurulup yönetişim kurumu karar verene kadar) Tamga Network hiçbir katılımcıdan — belge veren kurum,
  doğrulayıcı, cüzdan sağlayıcı, kişi — kayıt, belge verme, doğrulama ya da liste hizmeti ücreti almaz. Ağ, vakıf kurulunca hibe,
  koşulsuz bağış ve devlet/üye katkısıyla finanse edilir; o güne kadar giderleri geçici işletmeci karşılar. Mali katkı kayıt
  kararına, listedeki yere ya da yönetişim oyuna etki etmez. Kurumdan yıllık ücret alınacağını söyleyen eski ticari yön maddesi
  kaldırıldı. Kabul: 2026-10-30.
domain: Governance
related: ["[[ADR-0035]]", "[[ADR-0037]]", "[[ADR-0070]]", "[[FW-TF-0001]]"]
---

# Kısaca

Ağ kimseden para almaz: ne kurumdan, ne doğrulayıcıdan, ne cüzdandan, ne kişiden. Vakıf kurulunca ağ hibe ve devlet ya da üye
katkısıyla yaşar; o güne kadar giderleri ağı geçici olarak işleten şirket öder. Para veren biri listede ya da kararlarda ayrıcalık
kazanmaz.

# Bağlam

- [[ADR-0037]] (D-GOV-8): Tamga Network yalnız ağdır, hizmet satmaz; ticari hizmetler ağın dışındaki şirketlerce sunulur.
- Daha eski bir ticari yön maddesi (D-GTM-1, ayrıntısı işletmecinin özel kayıtlarında) belge veren kurumdan yıllık ücret
  alınmasını öngörüyordu. Bu madde ağın hizmet satmaması ilkesiyle ve ağın kâr amacı gütmeyen bir vakfa dönüşmesiyle çelişiyordu.
- [[FW-TF-0001]] §5.5: kişiler için ücretsiz; kurum ücreti "pilot sonunda" belirlenecekti (karar bekliyordu).
- Proje yönetiminin yönü: geçici dönemde ağ ücret almaz; vakıf hibe ve devlet/üye katkısıyla finanse edilir; eski ücret maddesi
  kaldırılır.

# Karar

## K1 — Ücret yok
Geçici dönemde ağ hiçbir katılımcıdan (belge veren kurum, doğrulayıcı, cüzdan sağlayıcı, kişi) liste kaydı, belge verme,
doğrulama, kimlik servisi ya da liste hizmeti için ücret almaz. Kişiler için ağ her zaman ücretsizdir.

## K2 — Finansman
Vakıf kurulunca ağ hibe, koşulsuz bağış ve devlet ya da üye katkısıyla finanse edilir. Vakıf kurulana kadar ağın giderlerini
geçici işletmeci ([[ADR-0070]]) karşılar; bu ona ağda ayrıcalık vermez.

## K3 — Katkı ayrıcalık vermez
Mali katkı (hibe, bağış, devlet/üye katkısı, geçici işletmecinin giderleri karşılaması) kayıt kararına, güven listesindeki yere,
katılım kapılarına ya da yönetişim oyuna etki etmez.

## K4 — Ticari hizmetler ağın dışında
Entegrasyon, barındırma, destek, danışmanlık gibi ücretli hizmetler ağın dışındaki şirketlerce kendi adlarıyla sunulur
([[ADR-0037]]); ağın kayıt kararı bu hizmetlerin alınmasına bağlanamaz.

## K5 — Eski yön maddesi
Kurumdan yıllık ücret alınacağını söyleyen eski ticari yön maddesi (D-GTM-1'in gelir modeli kısmı) bu kararla kaldırılır. Ücret
yeniden düşünülürse bu, yönetişim kurumunun kararı ve yeni bir ADR ister.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Belge veren kurumdan yıllık ücret (eski yön) | ret | Ağ hizmet satmaz ([[ADR-0037]]); kâr amacı gütmeyen vakıf; tarafsızlık |
| Doğrulama başına ücret | ret | Ağ etkisini engeller; AB'de doğrulama ağ ücretine bağlı değildir |
| Ücret kararını pilot sonuna bırakmak | ret | Kurumlarla görüşmede belirsizlik; çelişki sürer |
| **Ücret yok; hibe ve devlet/üye katkısı; katkı ayrıcalık vermez** | **seçildi** | Tarafsızlık ve vakıf modeliyle uyumlu; açık ve kalıcı bir ilke |

# Değişmezler

| Kod | Kural |
|---|---|
| FN1 | Geçici dönemde ağ hiçbir katılımcıdan liste kaydı, belge verme, doğrulama, kimlik servisi ya da liste hizmeti ücreti almaz; kişiler için ağ her zaman ücretsizdir. |
| FN2 | Mali katkı (hibe, bağış, devlet/üye katkısı, geçici işletmecinin giderleri karşılaması) kayıt kararına, güven listesindeki yere, katılım kapılarına ya da yönetişim oyuna etki etmez. |

# Sonuçlar

- Belgeler: [[FW-TF-0001]] §5.5 bu kararla yeniden yazıldı; işletmecinin özel ticari kayıtlarındaki ücret maddesi kaldırıldı.
- Kod değişikliği yok (ağda ücret alan bir bileşen yoktur).

# Durum

**Accepted — 2026-10-30.** Proje yönetiminin onayıyla (birebir alıntı özel onay kaydında). DECISIONS: D-GOV-11; D-GTM-1'in gelir
modeli kısmı kaldırıldı. FN1–FN2 bağlayıcıdır.
