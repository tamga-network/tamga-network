---
title: Ortak defter (zincir)
---

# Ortak defter (zincir)

Tamga'nın güveni bugün imzalı [[t:trust-list|güven listelerinde]] ve saatlik [[t:anchor-log|çapa günlüğünde]] durur. Çalışan bir
zincir yoktur. İzinli bir [[t:ledger|ortak defterin]] (Hyperledger Besu, QBFT) kodu yazılmış ve sınanmıştır; üretimde kapalıdır
([[ADR-0009]], [[ADR-0051]]).

## Zincir neden var?

Bugün listeleri tek bir işletmeci imzalar. Herkese açık günlük ve denetimler, işletmecinin iki doğrulayıcıya iki farklı liste
göstermesini (çift konuşma) **caydırır**, ama imkânsız kılmaz. Bir defter iki şey ekleyebilir:

- **Bağımsız tanıklık.** Bir liste sürümünün özeti ancak eşik kadar bağımsız işletmeci aynı özeti gönderince onaylanır; tek
  işletmeci onaylı bir özet üretemez, farklı özetler zincirde çelişki olayı olarak görünür ([[ADR-0053]]).
- **Kodda yönetişim.** Üyelik, ortak belge türleri ve yükseltmeler devletlerin 2/3 oyuyla; yükseltmede 7 gün bekleme
  ([[ADR-0055]]).

İkisi de imzacı sayısına bağlıdır. Bu yüzden defter **en az iki bağımsız işletmeci** onaylayıcı işletmeyi yazılı kabul etmeden
kurulmaz; tek işletmecinin zinciri, tek işletmecinin imzaladığı listeden fazla güven üretmez ([[ADR-0009]] K4).

## Neyin projeksiyonu?

Zincir imzalı listelerin ve çapa günlüğünün **projeksiyonudur**, kaynağı değildir ([[ADR-0051]]):

| | |
|---|---|
| Kaynak | İmzalı listeler (`lotl`, `tl-<cc>`) ve çapa günlüğü; çelişkide liste geçerlidir |
| Zincire giden | Liste sürümlerinin özetleri; listelerdeki her güven kaydının karşılığı (kurum, doğrulayıcı, belge türü, cüzdan sağlayıcı, kapı grubu…) yalnız özet, parmak izi, tarih, durum ve kapalı küme değeri olarak ([[ADR-0074]]) |
| Zincire hiç girmeyen | Kişisel veri, belge, belge özeti, iptal biti, serbest metin; ayrıntı yalnız `SHA-256(JCS(…))` özeti olarak |
| Doğrulama | Deftere bağlı değildir; `TrustSource` listeden okur. Zincir denetimi isteğe bağlıdır: evet / hayır (alarm, sonuç değişmez) / bilinmiyor (sonuç kötüleşmez) |

## Geçiş nasıl olur?

Defter açılırsa listelerin bütün geçmişi kontratlara **bir kez** yeniden oynatılır (`trust:chain-replay`): devletlerin oyuyla açılan,
en çok 30 gün süren ve geri açılamayan bir göç penceresinde, listedeki tarihlerle ([[ADR-0073]]). Kontratlar belgeyi verildiği
andaki (`iat`) duruma göre değerlendirir; askıdan önceki belge geçerli kalır, sert iptal (`invalidatesFrom`) sonraki belgeleri
düşürür. Doğrulayıcı kimliği alan adından türer ve devri ortak oyla yapılır ([[ADR-0075]]). Göç, aynı sorular liste kaynağına ve
zincir kaynağına sorulup kabul/ret farkı çıkmadan kapanmaz. Verilmiş belgeler yeniden verilmez; cüzdan ve doğrulayıcı değişmez.

## Bugün

| Parça | Durum |
|---|---|
| İmzalı listeler ve çapa günlüğü | Gerçek ağda canlı |
| Kontratlar, yerel Besu geliştirme ağı, yeniden oynatma, indeksleyici, eşdeğerlik testi | Çalışıyor (yalnız yerel ve CI) |
| Üretim defteri | Kapalı; önkoşul ikinci bağımsız işletmeci ve bağımsız güvenlik denetimi |
| Değer katmanı (token, ödeme) | Yok; yalnız araştırma yönü ([[ADR-0072]]) |

## Ayrıntı

- Kararlar: [[ADR-0001]] · [[ADR-0009]] · [[ADR-0051]] · [[ADR-0052]] · [[ADR-0073]] · [[ADR-0074]] · [[ADR-0075]]
- Liste biçimi ve kontrat eşlemesi: [[SPEC-TRUST-0001]]
- Güven listeleri: [Güven listeleri ve federasyon](/concepts/trust-lists)
