---
document_id: ADR-0062
title: "ZK nüsxəsi yeniləmə tokeni yalnız ZK nüsxəsi əhatəsi istəndikdə"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  Şəxsiyyət xidməti ZK nüsxəsi yeniləmə tokenini (ADR-0044 K3) artıq hər şəxsiyyət sənədi avtorizasiyasında deyil, yalnız cüzdan avtorizasiya sorğusunda şəxsiyyət sənədinin əhatəsinin yanında ZK nüsxəsi əhatəsini (`urn:tamga:id:ShortLivedIdentityAttestation:1`) də istədikdə verir. Beləliklə yeniləmə tokeni verildiyi əhatə üçündür (RFC 6749 §6): şəxsiyyət sənədi əhatəsi ilə alınan token şəxsiyyət sənədini yenidən almağa yaramayacağı üçün verilmir. Əhatə yalnız şəxsiyyət sənədi ilə birlikdə istənə bilər. Tamga cüzdanı xidmət ZK nüsxəsi elan edirsə, əhatəni özü istəyir; davranışı dəyişmir. ADR-0044 K3-ü daraldır. Qəbul: 2026-10-23.
domain: Protocol
related: ["[[ADR-0044]]", "[[ADR-0060]]", "[[SPEC-PROTO-0001]]"]
translation_of: ADR-0062
source_version: "1.0.0"
---

# Kontekst

- **ADR-0044 K3.** Şəxsiyyət sənədi verilərkən token cavabı `refresh_token` daşıyır; bu token şəxsiyyət sənədini yeniləmir, yalnız
  qısa ömürlü ZK nüsxəsi alır (şəxsiyyət xidməti şəxsi sahələri saxlamır — ADR-0011 K4).
- **Standart.** RFC 6749 §6: yeniləmə sorğusu əhatə vermirsə, yeni giriş tokeninin əhatəsi ilk verilən əhatəyə bərabər sayılır.
  Şəxsiyyət sənədi əhatəsi ilə alınmış yeniləmə tokenindən şəxsiyyət sənədi gözlənilir; bizimki yalnız ZK nüsxəsi verə bildiyi üçün bu
  gözləntini ödəyə bilmir.
- **OpenID uyğunluq öz-testi (3-cü tur, tapıntı G20).** FAPI 2.0 `refresh-token` modulu yenilənmiş giriş tokeni ilə şəxsiyyət sənədi
  istəyir; `this access token is only for ZK copies` ilə rədd edilirdi.

# Qərar

## K1 — Əhatə istəndikdə
Şəxsiyyət xidməti ZK nüsxəsi yeniləmə tokenini yalnız avtorizasiya (PAR `scope`) şəxsiyyət sənədi əhatəsinin yanında ZK nüsxəsi
əhatəsini də ehtiva edirsə verir. Əhatə başqa növlə və ya tək başına istənə bilməz (`invalid_scope` / `invalid_request`). Yeniləmə
tokeni ilə alınan giriş tokeninin əhatəsi ZK nüsxəsidir (cavabda `scope`).

## K2 — Cüzdan
Cüzdan xidmətin metadata-sında ZK nüsxəsi konfiqurasiyası (`mso_mdoc`, `doctype` = ZK nüsxəsi) elan edilibsə, şəxsiyyət sənədi
sorğusunda onun `scope`-unu da istəyir. Tamga cüzdanının davranışı (şəxsiyyət sənədi + ZK nüsxəsi bağı) dəyişmir.

## K3 — Dəyişməyənlər
ADR-0044-ün qalan hissəsi (ZC1–ZC3, nəsil sayğacı, iki mərhələli rotasiya), ADR-0060 (müştəri nümunəsi açarı bağı) olduğu kimi.

# Nəzərdən keçirilmiş variantlar

- **Tokeni həmişə ver, cavabda `scope` = ZK nüsxəsi.** RFC 6749 §5.1-ə uyğundur, lakin yeniləmə tokeni istənməmiş əhatə üçündür;
  müştəri şəxsiyyət sənədi əhatəsini yeniləyə biləcəyini güman edir.
- **Yeniləmədə şəxsiyyət sənədini yenidən ver.** Şəxsi sahələr saxlanılmır (ADR-0011 K4); mümkün deyil və arzuolunmazdır.
- **Seçilən:** token yalnız ZK nüsxəsi əhatəsi açıq istəndikdə — yeniləmə tokeni verildiyi əhatə üçündür.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| ZS1 | Şəxsiyyət xidməti ZK nüsxəsi yeniləmə tokenini yalnız avtorizasiya ZK nüsxəsi əhatəsini şəxsiyyət sənədi əhatəsi ilə birlikdə ehtiva etdikdə verir. |

# Tətbiq

- `@tamga-network/issuer` 0.7.2: `createPar({ allowedCompanionScopes })` → `ParRequest.companionScopes`. wallet-core 0.7.2:
  `companionScopes`, `startAuthorized` şəxsiyyət sənədində ZK nüsxəsi əhatəsini əlavə edir.
- Şəxsiyyət xidməti: PAR müşayiət əhatəsi (yalnız ZK nüsxəsi, yalnız şəxsiyyət sənədi ilə), token nöqtəsində token yalnız əhatə
  varsa; AS `scopes_supported` ZK nüsxəsi əhatəsini ehtiva edir.
- Spesifikasiya: [[SPEC-PROTO-0001]] §4.2.

# Status

**Accepted — 2026-10-23.** Layihə rəhbərliyinin ümumi uyğunluq təsdiqi çərçivəsində ("Aİ standartlarına uyğun olaq,
çatışmazlıqlarımızı aradan qaldıraq, olması lazım olduğu kimi edək"): ADR-0044 K3-ü standarta görə daraldan düzəliş; Tamga
cüzdanının davranışı dəyişmədi. DECISIONS: D-ZK-3.
