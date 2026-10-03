---
title: Tamga ARF
aside: false
---

# Tamga ARF

<span class="arf-release">Yayın 1.0 · 2 Ekim 2026</span>

**Tamga Network'ün Mimari ve Referans Çerçevesi** — Türk dünyası için, [[t:eIDAS]] 2.0 ve Avrupa Dijital Kimlik Cüzdanı
ekosistemiyle uyumlu dijital güven altyapısı. Tamga [[t:ARF]] kimin, hangi kurallarla ve hangi mimariyle katıldığını anlatır:
kullanım durumları, roller, mimari, veri modeli, güven modeli, güvenlik ve yönetişim, ve her katılımcının bağlayıcı kuralları.

AB ARF'sinin yapısını izler: bir ana belge ve beş ek (Ek C üç rulebook'tan oluşur). Bağlayıcı kurallar tek bir ana kitapta, **Tamga [[t:rulebook|Rulebook]]**'ta toplanır;
her belge türünün bu kitaptan dallanan kendi rulebook'u vardır.

## Belgeler

| Belge                                                 | Sürüm | Kimin için                                                                        |
| ----------------------------------------------------- | ----- | --------------------------------------------------------------------------------- |
| [Mimari ve Referans Çerçevesi](/tr/architecture)      | 1.0.0 | herkes — buradan başlayın                                                         |
| [Ek A — Trust Framework](/tr/trust-framework)         | 1.0.0 | düzenleyiciler, devletler, kurumlar: yönetişim, katılım, uyum, sözleşmeler, devir |
| [Ek B — Tamga Rulebook](/tr/rulebook)                 | 1.0.0 | her katılımcı: rol başına ortak, numaralı kurallar                                |
| Ek C — Rulebook'lar                                   |       | Tamga Rulebook'tan dallanan belge türü kuralları:                                 |
| · [Education Rulebook](/tr/rulebooks/education)       | 1.0.0 | üniversiteler ve doğrulayıcılar: öğrenci belgesi ve diploma                       |
| · [Identity Rulebook](/tr/rulebooks/identity)         | 1.0.0 | kurumlar ve doğrulayıcılar: geçici kimlik belgesi                                 |
| · [Event Ticket Rulebook](/tr/rulebooks/event-ticket) | 1.0.0 | bilet satıcıları ve kapılar                                                       |
| [Ek D — Tanımlar](/tr/definitions)                    | 1.0.0 | terimler ve kısaltmalar                                                           |
| [Ek E — Kaynaklar](/tr/references)                    | 1.0.0 | standartlar, Tamga belgeleri ve her kuralın kaynağı                               |
| [Okuma yolu](/tr/reading-path)                        | 1.0.0 | rolünüze göre neyi hangi sırayla okuyacağınız                                     |
| [Roller](/tr/roles)                                   | 1.0.0 | her rolün ayrıntısı: ne yapar, kuralları, neye ihtiyaç duyar                      |
| [Katılım süreci](/tr/onboarding)                      | 1.0.0 | katılımın adımları, askıya alma ve çıkış                                          |

## Nasıl okunur

[Okuma yolu](/tr/reading-path) her rol için önce çerçevenin hangi bölümlerini, sonra hangi geliştirici belgelerini
okuyacağınızı gösterir. [Geliştirici belgeleri](https://docs.tamga.network) entegrasyon rehberlerini, kod örneklerini ve bu
çerçevenin dayandığı şartnameleri içerir.

## Nerede durur

| Katman               | AB'de                                 | Tamga'da                                                 |
| -------------------- | ------------------------------------- | -------------------------------------------------------- |
| Hukuk ve yönetişim   | eIDAS 2.0 ve uygulama tüzükleri       | Ek A — Trust Framework                                   |
| Mimari ve roller     | AB ARF                                | Ana belge                                                |
| Katılımcı kuralları  | AB ARF Ek 2 (üst düzey gereksinimler) | Ek B — Tamga Rulebook                                    |
| Belge türü kuralları | Attestation rulebook'ları             | Ek C — Rulebook'lar                                      |
| Teknik standartlar   | ETSI, IETF, OpenID, ISO               | Tamga şartnameleri (docs.tamga.network), Ek E'de listeli |

## Dil ve durum

Tamga ARF İngilizce ve Türkçe yayınlanır. Türkçe metin kaynaktır; İngilizce metin aynı sürümün resmî çevirisidir ve iki dil
her zaman aynı sürümdedir.

## Yayınlar

- **1.0 (2 Ekim 2026)** — ilk yayın.

Belgeler CC BY 4.0 · Kod Apache-2.0.
