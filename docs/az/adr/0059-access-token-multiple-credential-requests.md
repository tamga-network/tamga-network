---
document_id: ADR-0059
title: "Giriş tokeninin ömrü ərzində bir neçə sənəd sorğusu"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-21
last_updated: 2026-10-21
summary: >
  Sənədi verən qurumun giriş tokeni artıq birdəfəlik deyil: qısa ömrü (≤ 5 dəqiqə, PR9) ərzində bir neçə sənəd sorğusunda istifadə oluna bilər — OpenID4VCI 1.0 §8-in icazə verdiyi və Aİ istinad sənəd verəninin etdiyi kimi. Hədlər: yalnız tokenin əhatə etdiyi sənəd konfiqurasiyası, token başına cəmi nüsxə ≤ toplu verilmə ölçüsü (10), hər sorğu tokenin bağlı olduğu DPoP açarı ilə. Şəxsiyyət xidmətində eyni tokenlə sonrakı sorğu ilk sorğunun qeydinə nüsxə əlavə edir, əvvəlki paketi ləğv etmir; şəxsi sahələr tokenin ömrü bitəndə və ya nüsxə haqqı dolanda silinir. ZK nüsxəsi tokeni və bilet bir paket olaraq qalır. Qəbul: 2026-10-21.
domain: Protocol
related: ["[[SPEC-PROTO-0001]]", "[[ADR-0011]]", "[[ADR-0031]]", "[[ADR-0044]]"]
translation_of: ADR-0059
source_version: "1.0.0"
---

# Kontekst

- **Standart.** OpenID4VCI 1.0 §8: sənəd sorğusu giriş tokeni ilə edilir; eyni tokenlə bir neçə sorğu (başqa konfiqurasiya, əlavə
  nüsxə, təkrar cəhd) **qadağan deyil**. Aİ istinad sənəd verəni (eudi-srv-issuer) və ölkələrin PID provayderləri tokeni ömrü
  boyunca bir neçə sorğuda qəbul edir. HAIP 1.0 və FAPI 2.0 tokenin DPoP ilə göndərənə bağlanmasını tələb edir (bizdə var).
- **Bu gün.** Tamga-da giriş tokeni birdəfəlik idi: ilk uğurlu sənəd sorğusundan sonra silinir, ikinci sorğu `401 invalid_token`
  alırdı ("bir token = bir paket"). Şəxsiyyət xidmətində ikinci paket eyni sənəd üçün verilmiş əvvəlkini ləğv etdirirdi (K6
  əvəzləmə).
- **OpenID uyğunluq öz-testi (2026-10-21).** Test alətinin FAPI 2.0 uğurlu axını və "additional requests" modulu eyni tokenlə bir neçə
  sənəd sorğusu göndərir (FAPI başlıqları ilə); birdəfəlik token bu iki modulu uğursuz edirdi (tapıntı G7).

# Qərar

## K1 — Tokenin ömrü ərzində bir neçə sorğu
Giriş tokeni ömrü (≤ 5 dəqiqə, PR9) boyunca bir neçə sənəd sorğusunda istifadə oluna bilər. Ömür uzanmır.

## K2 — Hədlər
- Yalnız tokenin əhatə etdiyi sənəd konfiqurasiyası (təklifdəki / PAR-dakı növ); başqa konfiqurasiya `invalid_credential_request`
  və ya `unknown_credential_configuration`.
- Token başına verilən **cəmi nüsxə ≤ toplu verilmə ölçüsü** (`MAX_COPIES_PER_ACCESS_TOKEN = BATCH_SIZE = 10`). Həddi aşan sorğu
  rədd edilir (`invalid_token`). Sayğac verilənlər bazasında tək əmrlə saxlanılır; eyni vaxtda gələn sorğular həddi birlikdə aşa
  bilməz.
- Hər sorğu tokenin bağlı olduğu DPoP açarı ilə (RFC 9449); başqa açar `401 invalid_dpop_proof`.

## K3 — Şəxsiyyət xidməti: eyni qeydə nüsxə
Eyni tokenlə sonrakı sorğu ilk sorğunun qeydinə nüsxə əlavə edir (eyni qeyd identifikatoru, eyni ləğv izləməsi); əvvəlki paket ləğv
edilmir. Birdəfəlik addımlar (baxış kodu, dəvət haqqı, şəxsiyyət yoxlaması provayderindəki sessiyanın silinməsi, psevdonim toxumu —
[[ADR-0031]]) yalnız ilk sorğuda edilir. Qeyd bu arada ləğv edilib və ya silinibsə, token keçmir.

## K4 — Şəxsi sahələrin müddəti ([[ADR-0011]] K4-ün müddəti)
Şəxsiyyət xidməti avtorizasiya qeydindəki şəxsi sahələri artıq ilk verilmədə deyil, **tokenin ömrü bitəndə və ya nüsxə haqqı
dolanda** silir (ən geci ≤ 5 dəqiqə + dövri təmizləmə intervalı). Qeyd yenə yalnız serverdədir, jurnala yazılmır.

## K5 — Bir paket olaraq qalanlar
ZK nüsxəsi giriş tokeni ([[ADR-0044]]) və bilet (tədbir başına tək sənəd) bir paket olaraq qalır.

# Nəzərdən keçirilmiş variantlar

- **Birdəfəlik qalsın (köhnə vəziyyət).** Standarta zidd deyil, lakin test alətinin iki modulu uğursuz qalır və Aİ sənəd
  verənlərindən fərqlənir; təkrar cəhd (şəbəkə qırılması) yeni avtorizasiya tələb edir.
- **Limitsiz təkrar istifadə.** Limitsiz nüsxə və ləğv siyahısı indekslərinin sərfi; rədd edildi.
- **Seçilən:** qısa ömür + konfiqurasiya + nüsxə həddi + DPoP bağlılığı — Aİ istinad sənəd verəni ilə eyni yanaşma.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| AT1 | Giriş tokeni ilə yalnız tokenin əhatə etdiyi sənəd konfiqurasiyası istənə bilər. |
| AT2 | Bir giriş tokeni ilə verilən cəmi nüsxə sayı toplu verilmə ölçüsünü (10) keçmir; sayğac eyni vaxtda gələn sorğularda da aşıla bilməz. |
| AT3 | Hər sənəd sorğusu tokenin bağlı olduğu DPoP açarı ilə edilir; tokenin ömrü (≤ 5 dəq) təkrar istifadə ilə uzanmır. |
| AT4 | Şəxsiyyət xidmətində eyni tokenlə sonrakı sorğu ilk sorğunun qeydinə nüsxə əlavə edir; əvvəlki paketi ləğv etmir; ləğv edilmiş və ya silinmiş qeydə nüsxə əlavə edilmir. |
| AT5 | Şəxsiyyət xidməti avtorizasiya qeydindəki şəxsi sahələri tokenin ömrü bitəndə və ya nüsxə haqqı dolanda silir. |

# Tətbiq

- `@tamga-network/issuer` 0.7.2: `MAX_COPIES_PER_ACCESS_TOKEN`, `withinAccessTokenAllowance`.
- Platforma: `credential_grants.copies` sayğacı (sxem addımı 10), `claimGrant(…, copies, max)` / `releaseGrant(…, copies)`; qurumun
  sənəd vermə xidməti və şəxsiyyət xidməti tokeni verilmədən sonra silmir (müddət sonunda təmizləmə), şəxsiyyət xidməti K3–K4.
- Spesifikasiya: [[SPEC-PROTO-0001]] §7.4.
- Testlər: eyni tokenlə ardıcıl sorğular həddə qədər qəbul, həddin aşılması və müddət sonunda rədd, başqa DPoP açarı rədd, eyni
  vaxtda gələn sorğular həddi aşa bilmir; şəxsiyyət xidmətində eyni qeyd, əvvəlki paket ləğv edilmir, haqq dolanda şəxsi sahələr
  silinir.

# Status

**Accepted — 2026-10-21.** Layihə rəhbərliyinin təsdiqi ilə (OpenID uyğunluq öz-testi tapıntısı G7; Aİ istinad sənəd verəni ilə
eyni yanaşma). DECISIONS: D-PROTO-3.
