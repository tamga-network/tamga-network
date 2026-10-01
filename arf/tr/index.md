---
title: Tamga ARF
aside: false
---

# Tamga ARF

<span class="arf-release">Yayın 0.7 · 1 Ekim 2026</span>

**Tamga Network'ün Mimari ve Referans Çerçevesi** — Türk dünyası için, eIDAS 2.0 ve Avrupa Dijital Kimlik Cüzdanı
ekosistemiyle uyumlu dijital güven altyapısı. Tamga ARF kimin, hangi kurallarla ve hangi mimariyle katıldığını anlatır:
kullanım durumları, roller, mimari, veri modeli, güven modeli, güvenlik ve yönetişim, ve her katılımcının bağlayıcı kuralları.

AB ARF'sinin yapısını izler: bir ana belge ve beş ek.

## Belgeler

| Belge | Sürüm | Kimin için |
|---|---|---|
| [Mimari ve Referans Çerçevesi](/tr/architecture) | 0.3.0 | herkes — buradan başlayın |
| [Ek A — Güven Çerçevesi](/tr/annex-a-trust-framework) | 0.3.0 | düzenleyiciler, devletler, kurumlar: yönetişim, katılım, uyum, sözleşmeler, devir |
| [Ek B — Katılımcı Kuralları](/tr/annex-b-participant-rules) | 0.4.0 | her katılımcı: rol başına numaralı kurallar |
| [Ek C — Eğitim](/tr/annex-c-education) | 0.2.0 | üniversiteler ve doğrulayıcılar: öğrenci belgesi ve diploma |
| [Ek C — Kimlik belgesi](/tr/annex-c-identity) | 0.3.0 · taslak | kurumlar ve doğrulayıcılar: geçici kimlik belgesi |
| [Ek C — Etkinlik bileti](/tr/annex-c-event-ticket) | 0.2.0 · taslak | bilet satıcıları ve kapılar |
| [Ek D — Tanımlar](/tr/annex-d-definitions) | 0.1.0 | terimler ve kısaltmalar |
| [Ek E — Kaynaklar](/tr/annex-e-references) | 0.1.0 | standartlar, Tamga belgeleri ve her kuralın kaynağı |

## Nasıl okunur

- **Kurum ya da entegratör:** [ana belge](/tr/architecture), bölüm 2–6 → rolünüz için [Ek B](/tr/annex-b-participant-rules)
  → belge türünüzün Ek C kuralları.
- **Düzenleyici ya da devlet:** [Ek A](/tr/annex-a-trust-framework) → ana belge, bölüm 6 ve 8.
- **Geliştirici:** [geliştirici belgelerinde](https://docs.tamga.network) entegrasyon kılavuzları, kod örnekleri ve bu
  çerçevenin dayandığı spesifikasyonlar var.

## Nerede durur

| Katman | AB'de | Tamga'da |
|---|---|---|
| Hukuk ve yönetişim | eIDAS 2.0 ve uygulama tüzükleri | Ek A — Güven Çerçevesi |
| Mimari ve roller | AB ARF | Ana belge |
| Katılımcı kuralları | AB ARF Ek 2 (üst düzey gereksinimler) | Ek B — Katılımcı Kuralları |
| Belge türü kuralları | Attestation rulebook'ları | Ek C |
| Teknik standartlar | ETSI, IETF, OpenID, ISO | Tamga spesifikasyonları (docs.tamga.network), Ek E'de listeli |

## Dil ve durum

Tamga ARF İngilizce ve Türkçe yayınlanır. Türkçe metin kaynaktır; İngilizce metin aynı sürümün resmî çevirisidir ve iki
dil farklıyken yayın yapılmaz. Hâlâ **ÖNERİ** etiketli maddeler Ek A, bölüm 9'da listelidir.

## Yayınlar

Her yayın, yayınlandığı hâliyle çevrimiçi kalır; sürüm menüsünden seçebilirsiniz. [Yayınlar arasında ne değişti →](/tr/changes)

- **0.7 (1 Ekim 2026)** — AB ARF düzeninde, insanın okuyacağı biçimde yeniden yapılandırıldı; federasyon modeli ve
  konumlanma; yeni Ek D (Tanımlar) ve kural kaynaklarını taşıyan Ek E (Kaynaklar).
- **0.6 (1 Ekim 2026)** — Kimlik belgesi için mağaza incelemesi erişimi.
- **0.5 (1 Ekim 2026)** — HAIP 1.0 uyumu: doğrulayıcı istemci kimliği `x509_hash`.
- **0.4 (1 Ekim 2026)** — Site başına takma ad.
- **0.3 (27 Eylül 2026)** — Kimlik belgesi ve etkinlik bileti kuralları (taslak).
- **0.2 (27 Eylül 2026)** — Kendi sitesi, İngilizce ve Türkçe, üç ek.
- **0.1 (24 Eylül 2026)** — Çerçevenin ilk sürümü (Türkçe).

Belgeler CC BY 4.0 · Kod Apache-2.0.
