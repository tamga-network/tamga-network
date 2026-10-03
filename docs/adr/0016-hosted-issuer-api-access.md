---
document_id: ADR-0016
title: "Barındırılan belge vermeye erişim"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Barındırılan ihraç servisinin operatör uçları (`/{slug}/admin/*`) bugün yalnızca sunucunun kendisinden (127.0.0.1) erişilebilir ve
  tek bir paylaşılan yönetici anahtarıyla korunur. `@tamga-network/issuer/client` ile dış kurumun (bilet satıcısı, üniversite
  sistemi) kendi sunucusundan teklif/bilet/iptal çağırabilmesi için ayrı, kiracıya bağlı, yetki kapsamlı bir API yüzeyi önerilir.
domain: Services
---

# Bağlam

- nginx `issuer.` bloğu `/{slug}/admin/` yolunu `allow 127.0.0.1; deny all` ile kapatır; uygulama `x-admin-token` (tek, tüm
  kiracılar için ortak) bekler. Bu, demo portalı (aynı sunucu) için doğrudur.
- D10/D14 ile dış kurumlar ([[t:issuer]]) için istemci yazıldı (`@tamga-network/issuer/client`: `createOffer`, `sellTicket`, `revoke`…); üretimde
  bu uçlara dışarıdan ulaşmanın güvenli yolu yok. Ortak yönetici anahtarını kurumlara vermek bir kiracının diğerinin [[t:credential|belgelerini]]
  [[t:revocation]] edebilmesi demektir.

# Karar

1. **K1 — Ayrı yüzey:** `/{slug}/api/v1/*` (offers, tickets, revocations). `/{slug}/admin/*` iç kullanımda (127.0.0.1) kalır.
2. **K2 — Kiracı API anahtarı:** kurum başına bir ya da daha fazla anahtar; `Authorization: Bearer tmg_<slug>_<rastgele>`.
   Sunucuda yalnızca **özeti** (SHA-256) saklanır; anahtar yalnızca oluşturulurken bir kez gösterilir. Anahtar bir `slug`'a ve
   **kapsama** bağlıdır (`offers:write`, `tickets:write`, `revocations:write`); başka kiracının yolunda geçersizdir.
3. **K3 — Döndürme ve iptal:** anahtarın son geçerlilik tarihi (öneri 90 gün), iki anahtar aynı anda geçerli olabilir (kesintisiz
   döndürme); iptal anında etkili.
4. **K4 — Sınırlar:** anahtar başına hız sınırı, istek boyutu sınırı; denetim kaydında anahtar kimliği (özet öneki) ve olay adı —
   kişisel veri ve anahtarın kendisi yok (PR14/AP3).
5. **K5 — Pilot seçeneği:** üniversite gibi kurumsal entegrasyonlarda mTLS (kurumun X.509'u, [[t:trust-list|güven listesindeki]] kaydıyla eşleşen)
   K2'ye ek olarak zorunlu kılınabilir.
6. **K6 — İstemci:** `createIssuerClient({ baseUrl, slug, apiKey })`; `adminToken` yalnızca iç kullanım için kalır.

# Gerekçe / alternatifler

- **Ortak yönetici anahtarını dışarı açmak:** kiracılar arası yetki yok → reddedilir.
- **OAuth 2.0 client credentials:** doğru ama ek yetkilendirme sunucusu ister; ilk kurumlar için ağır. K2 ileride OAuth'a taşınabilir.
- **Yalnızca mTLS:** güçlü, ama küçük satıcılar için sertifika yönetimi engel; K5 isteğe bağlı olarak korunur.

# Değişmezler

| # | Kural |
|---|---|
| HA1 | Dış erişim yalnızca kiracıya bağlı, kapsamlı API anahtarıyla; ortak yönetici anahtarı dışarı açılmaz. |
| HA2 | API anahtarı sunucuda yalnızca özetiyle saklanır; loglarda ve denetim kaydında anahtarın kendisi yer almaz. |
| HA3 | Bir anahtar yalnızca kendi `slug`'ının yollarında ve kapsamındaki işlemlerde geçerlidir. |

# Durum

**Accepted — 2026-09-27.** DECISIONS: D-API-1. Not: pilot üniversitesi entegrasyonunda K5 (mTLS) değerlendirilecek.

Uygulama: `apps/issuer` (operatör deposu) API rotaları + anahtar deposu, nginx `api/v1` bloğu, `issuer/client` `apiKey` seçeneği,
kurum kılavuzu (docs sitesi).
