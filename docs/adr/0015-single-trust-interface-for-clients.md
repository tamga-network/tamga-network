---
document_id: ADR-0015
title: "Tek güven arayüzü"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Servisler güven sorularını tek arayüzden (`TrustSource`, @tamga-network/trust) soruyor; cüzdan ise React Native'de
  bu paketi kullanamadığı için aynı liste doğrulamasını `wallet-core` içinde ayrıca yapıyor. Öneri: `@tamga-network/trust`'ın
  doğrulama çekirdeği platformdan bağımsız (saf TS, node:fs'siz, jose'suz) bir alt yola ayrılır; cüzdan dahil her istemci
  aynı arayüzü kullanır. Faz 0'da zincir kaynağı (`ChainTrustSource`) yine aynı arayüzün arkasına girer. Bu belge geçiş
  planını yazar, uygulamaz.
domain: Trust
---

# Bağlam

Çalışma altyapısı kurulumunda (2026-09-27) hedef şuydu: istemciler beta'ya ya da zincire doğrudan
değil, ortak bir kimlik/güven arayüzüne bağlanır. Tamga'da bu arayüz **zaten var**: `TrustSource` ([[ADR-0009]] K3, BT4) —
Faz B'de imzalı [[t:trust-list|güven listeleri]] (`ListTrustSource`), Faz 0'da zincir (`ChainTrustSource`). Beta bir veritabanı değil, imzalı liste
dosyalarıdır; istemciler (cüzdan) veritabanına hiç bağlanmaz, servislere standart protokollerle ([[t:OpenID4VCI]]/VP) konuşur.

Keşifte bulunan tek sapma cüzdan tarafıdır. `@tamga-network/trust` `node:fs`, `jose` ve `zod`'a dayandığı için Expo/React
Native'de kullanılmıyor; S-13 kapanışı sırasında aynı doğrulama `wallet-core`'a ayrıca yazıldı. Bugün listeyi arayüz dışında
yorumlayan yerler:

| Dosya | Ne yapıyor |
|---|---|
| `packages/wallet-core/src/trustlist.ts` | `lotl.jws` + `tl-<cc>.jws` imza doğrulaması, `next_update`, geri sarma (ayrı gerçekleme) |
| `packages/wallet-core/src/directory.ts` | `issuers[]` ham alanlarını (`issuer_url`, `schema_authorizations`, `category`) okuyup kurum dizini üretir |
| `packages/wallet-core/src/oid4vp.ts` (`fetchRpRecord`) | `relying_parties[]`'ten RP kaydını seçer |

Servisler (`apps/verify`, `apps/issuer` (operatör deposu), `apps/id`) arayüz üzerinden geçer (dosyayı okuyup `loadTrustSet`'e verir).

Risk: iki doğrulama gerçeklemesi zamanla ayrışır (ör. TL12 kontrol noktası, yeni alanlar); Faz 0'da cüzdan zincir kaynağına
geçemez, çünkü liste biçimine bağlıdır.

# Karar

1. **K1 — Taşınabilir çekirdek.** `@tamga-network/trust` doğrulama mantığı (JWS doğrulama, liste kuralları, `TrustStore`,
   `TrustSource` sorguları) `node:fs`/`jose`/`zod` gerektirmeyen bir alt yola ayrılır: `@tamga-network/trust/core`
   (imza `@noble/curves`, şema doğrulama elle ya da hafif). Node uyumlu mevcut giriş (`fs.ts`, `guardedReload`) ana yolda kalır.
2. **K2 — İstemci kaynağı.** `wallet-core`, `trustlist.ts`/`directory.ts`/`fetchRpRecord` yerine `trust/core`'dan bir
   `HttpListTrustSource` (HTTP ile çeken, gömülü pin ile doğrulayan) kullanır; kurum dizini ve [[t:RP]] kaydı `TrustSource`
   sorgularından (`issuers()`, `relyingParty()`) gelir.
3. **K3 — Faz 0 aynı arayüz.** `ChainTrustSource` servislerde doğrudan; cüzdanda doğrudan RPC yerine aynı arayüzün
   arkasında (liste aynası ya da hafif indeksleyici) — cüzdan kodu değişmez.

# Gerekçe / alternatifler

- **Bugünkü hâli korumak:** en az iş, ama BT4'ün ruhuna aykırı ve Faz 0 geçişinde cüzdanı ayrıca elden geçirmeyi gerektirir.
- **Cüzdana node polyfill'leri:** `jose`/`zod` RN'de kısmen çalışır ama `node:fs` ve paket boyutu sorun; kırılgan.
- **Ayrı "identity servisi" (sunucu tarafı güven proxy'si):** cüzdanın her güven sorusunu Tamga sunucusuna sorması izlenebilirlik
  yaratır (hangi kurumu ne zaman sorduğu) — gizlilik ilkesine aykırı; reddedilir.

# Değişmezler

| # | Değişmez |
|---|---|
| **TS1** | Her istemci ve servis güven sorusunu yalnızca `TrustSource` arayüzünden sorar; liste/zincir biçimi arayüz dışında yorumlanmaz (BT4'ün istemcilere genişletilmesi). |
| **TS2** | Liste doğrulama kuralları tek gerçeklemededir (`trust/core`); başka paket kopyasını tutmaz. |
| **TS3** | İstemci güven sorusu için Tamga'ya kullanıcıya bağlanabilir çağrı yapmaz; listeler toplu çekilir. |

# Geçiş planı

1. `trust/core` alt yolunu çıkar; mevcut `trust` testleri + `conformance/` vektörleri iki girişte de geçsin.
2. `HttpListTrustSource` + gömülü pin; `wallet-core` testlerini (`trustlist.test.ts` 7 test) yeni kaynağa taşı.
3. `directory.ts` ve `fetchRpRecord`'u `TrustSource` sorgularına çevir; eski `trustlist.ts`'i kaldır.
4. Metro iOS paket provası (boyut, `@noble/*` uyumu); cihaz testi.
5. Faz 0: `ChainTrustSource` ile aynı sözleşme testleri.

# Durum

**Accepted — 2026-09-27.** DECISIONS: D-TRUST-1.

Uygulama: yukarıdaki geçiş planı.
