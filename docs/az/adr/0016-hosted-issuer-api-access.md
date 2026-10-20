---
document_id: ADR-0016
title: "Hostinq edilən rəqəmsal sənəd vermə xidmətinə giriş"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Hostinq edilən rəqəmsal sənəd vermə xidmətinin operator uc nöqtələri (`/{slug}/admin/*`) bu gün yalnız serverin özündən (127.0.0.1) əlçatandır və vahid ortaq administrator açarı ilə qorunur. `@tamga-network/issuer/client` ilə xarici qurumun (bilet satıcısı, universitet sistemi) öz serverindən təklif/bilet/ləğv çağırışları edə bilməsi üçün ayrıca, kirayəçiyə bağlı, səlahiyyət əhatəli API səthi təklif olunur.
domain: Services
translation_of: ADR-0016
source_version: "1.0.0"
---

# Kontekst

- nginx `issuer.` bloku `/{slug}/admin/` yolunu `allow 127.0.0.1; deny all` ilə bağlayır; tətbiq `x-admin-token` (vahid, bütün
  kirayəçilər üçün ortaq) gözləyir. Bu, demo portalı (eyni server) üçün düzgündür.
- D10/D14 ilə xarici qurumlar ([[t:issuer]]) üçün müştəri yazıldı (`@tamga-network/issuer/client`: `createOffer`, `sellTicket`, `revoke`…); istehsal mühitində
  bu uc nöqtələrə xaricdən təhlükəsiz çatmaq yolu yoxdur. Ortaq administrator açarını qurumlara vermək bir kirayəçinin digərinin [[t:credential|rəqəmsal sənədlərini]]
  [[t:revocation]] edə bilməsi deməkdir.

# Qərar

1. **K1 — Ayrıca səth:** `/{slug}/api/v1/*` (offers, tickets, revocations). `/{slug}/admin/*` daxili istifadədə (127.0.0.1) qalır.
2. **K2 — Kirayəçi API açarı:** hər quruma bir və ya daha çox açar; `Authorization: Bearer tmg_<slug>_<rastgele>`.
   Serverdə yalnız **heşi** (SHA-256) saxlanılır; açar yalnız yaradılarkən bir dəfə göstərilir. Açar bir `slug` və
   **əhatə dairəsi** ilə bağlıdır (`offers:write`, `tickets:write`, `revocations:write`); başqa kirayəçinin yolunda etibarsızdır.
3. **K3 — Rotasiya və ləğv:** açarın son etibarlılıq tarixi (tövsiyə 90 gün), iki açar eyni vaxtda etibarlı ola bilər (fasiləsiz
   rotasiya); ləğv dərhal qüvvəyə minir.
4. **K4 — Limitlər:** hər açar üçün sürət limiti, sorğu ölçüsü limiti; audit qeydində açar identifikatoru (heş prefiksi) və hadisə adı —
   fərdi məlumatlar və açarın özü yoxdur (PR14/AP3).
5. **K5 — Pilot seçimi:** universitet kimi korporativ inteqrasiyalarda mTLS (qurumun [[t:trust-list|etibar siyahısındakı]] qeydi ilə uyğun gələn X.509-u)
   K2-yə əlavə olaraq məcburi edilə bilər.
6. **K6 — Müştəri:** `createIssuerClient({ baseUrl, slug, apiKey })`; `adminToken` yalnız daxili istifadə üçün qalır.

# Əsaslandırma / alternativlər

- **Ortaq administrator açarını xaricə açmaq:** kirayəçilər arası səlahiyyət yoxdur → rədd edilir.
- **OAuth 2.0 client credentials:** düzgündür, lakin əlavə avtorizasiya serveri tələb edir; ilk qurumlar üçün ağırdır. K2 gələcəkdə OAuth-a köçürülə bilər.
- **Yalnız mTLS:** güclüdür, lakin kiçik satıcılar üçün sertifikat idarəetməsi maneədir; K5 isteğe bağlı olaraq saxlanılır.

# Dəyişməzlər

| # | Qayda |
|---|---|
| HA1 | Xarici giriş yalnız kirayəçiyə bağlı, əhatə dairəli API açarı ilə; ortaq administrator açarı xaricə açılmır. |
| HA2 | API açarı serverdə yalnız heşi ilə saxlanılır; loglarda və audit qeydində açarın özü yer almır. |
| HA3 | Açar yalnız aid olduğu `slug` yollarında və əhatə dairəsindəki əməliyyatlarda etibarlıdır. |

# Status

**Accepted — 2026-09-27.** DECISIONS: D-API-1. Qeyd: pilot universitet inteqrasiyasında K5 (mTLS) qiymətləndiriləcək.

Tətbiq: `apps/issuer` (operator repozitoriyası) API marşrutları + açar anbarı, nginx `api/v1` bloku, `issuer/client` `apiKey` seçimi,
qurum təlimatı (docs saytı).
