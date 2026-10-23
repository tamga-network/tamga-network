---
document_id: ADR-0060
title: "Yeniləmə tokeni müştəri nümunəsi açarına bağlıdır"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-22
last_updated: 2026-10-22
summary: >
  Yeniləmə tokeni (qurum sənədlərinin səssiz yenilənməsi ADR-0023 və şəxsiyyət xidmətinin ZK nüsxəsi tokeni ADR-0044) artıq DPoP açarına deyil, ilk verilmədəki müştəri təsdiqinin (WIA) `cnf` açarına — müştəri nümunəsi açarına — bağlıdır (OAuth 2.0 Attestation-Based Client Authentication §10.3; RFC 9449 §5). Yeniləmədə həmin açarlı təzə WIA məcburidir; DPoP açarı dəyişə bilər, yeni giriş tokeni yeni DPoP açarına bağlanır. Cüzdan hər əməliyyatda yeni WIA açarından istifadəni davam etdirir (ADR-0025 K6: qurumlar cüzdanı bir-birinə bağlaya bilməz); yeniləmə tokeni alan sənədin əməliyyatındakı WIA açarını sənədlə saxlayır və yeniləmədə provayderdən bu açara təzə WIA istəyir. ADR-0023 və ADR-0044 K3-dəki "DPoP açarına bağlı" qaydasını dəyişir. Qəbul: 2026-10-22.
domain: Protocol
related: ["[[ADR-0023]]", "[[ADR-0025]]", "[[ADR-0044]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0060
source_version: "1.0.0"
---

# Kontekst

- **Standart.** RFC 9449 §5: kimliyi doğrulanmış müştərinin yeniləmə tokeni DPoP açarına bağlanmır, müştəriyə bağlıdır; DPoP açarı
  yeniləmədə dəyişə bilər. OAuth 2.0 Attestation-Based Client Authentication (layihə -07) §10.3: müştəri təsdiqi ilə kimliyi
  doğrulanan müştəridə avtorizasiya serveri yeniləmə tokenini **müştəri nümunəsi açarına** (təsdiqdəki `cnf`) bağlayır; başqa nümunə
  açarı ilə yeniləmə rədd edilir.
- **Bu gün.** Tamga-da yeniləmə tokeni ilk verilmədəki DPoP açarına bağlı idi ([[ADR-0023]], [[ADR-0044]] K3); WIA hər əməliyyatda
  yeni açarla alınır ([[ADR-0025]] K6), buna görə bağ DPoP açarına qurulmuşdu.
- **OpenID uyğunluq öz-testi (2026-10-21, tapıntı G12).** FAPI 2.0 `refresh-token` modulu yeniləməni yeni DPoP açarı və eyni müştəri
  təsdiqi ilə edir (keçməlidir), sonra başqa nümunə açarlı təsdiqlə və köhnə DPoP açarı ilə cəhd edir (rədd edilməlidir). Bizim
  bağımız hər ikisində əks nəticə verirdi.

# Qərar

## K1 — Bağ müştəri nümunəsi açarıdır
Yeniləmə tokeni verildiyi əməliyyatdakı müştəri təsdiqinin (WIA) `cnf.jwk` açarının RFC 7638 barmaq izinə bağlanır. Yeniləmədə
təqdim edilən WIA-nın `cnf` açarı eyni olmalıdır; deyilsə, `invalid_grant`. DPoP sübutu yenə məcburidir (açar dəyişə bilər); yeni
giriş tokeni yeni DPoP açarına bağlanır.

## K2 — Cüzdan nümunə açarını sənədlə saxlayır
WIA hər əməliyyatda yeni açarla alınmağa davam edir (ADR-0025 K6). Yeniləmə tokeni verən əməliyyatda istifadə olunan WIA açarı
sənədin yeniləmə bağına yazılır (`instanceKeyRef`) və silinmir; yeniləmədə cüzdan provayderdən **bu açara** təzə (< 24 saat) WIA
istəyir. Açar yalnız həmin sənədi verən quruma göstərilir; başqa qurumlar başqa açarlar görür (bağlana bilməmək qorunur). Sənəd
silindikdə açar da silinir (başqa bağda və ya cüzdanın həmin anki WIA-sında istifadə olunmursa).

## K3 — Əhatə
Qurumun sənəd vermə xidmətinin yeniləmə tokeni ([[ADR-0023]]) və şəxsiyyət xidmətinin ZK nüsxəsi tokeni ([[ADR-0044]] K3). Köhnə
(DPoP-a bağlı) tokenlər qüvvədən düşür (inkişaf mərhələsi, [[ADR-0029]]); cüzdan növbəti sənəd alışında yenisini alır.

# Nəzərdən keçirilmiş variantlar

- **DPoP bağı qalsın.** Standarta görə lazım deyil; test alətinin iki yoxlaması uğursuz qalır.
- **DPoP və ya nümunə açarı (ikisindən biri).** ATCA §10.3-ün "başqa nümunə açarı ilə rədd" qaydasını ödəmir.
- **Cüzdanın tək daimi nümunə açarı.** Bütün qurumlar eyni açarı görərdi — ADR-0025 K6-ya ziddir (bağlana bilmək).
- **Seçilən:** sənəd başına nümunə açarı — standart bağ + qurumlar arasında bağlana bilməmək.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| RT1 | Yeniləmə tokeni müştəri nümunəsi açarına (verilmədəki WIA `cnf` barmaq izi) bağlıdır; yeniləmədə eyni açarlı WIA məcburidir. |
| RT2 | Yeniləmədə DPoP sübutu məcburidir; yeni giriş tokeni həmin sorğudakı DPoP açarına bağlanır. |
| RT3 | Cüzdan yeniləmə bağının nümunə açarını yalnız həmin sənədi verən qurumla istifadə edir; başqa əməliyyatlarda yeni WIA açarı istifadə edir. |

# Tətbiq

- `@tamga-network/issuer` 0.7.2: `clientInstanceJkt`. wallet-core 0.7.2: `RefreshBinding.instanceKeyRef`,
  `ZkCopyBinding.instanceKeyRef`, `wuaForBinding`, `autoRefreshCredential` / `refreshZkCopies` `wuaForInstance`,
  `instanceKeysInUse`; `removeCredential` bağın açarını da silir.
- Platforma: qurumun sənəd vermə xidməti `refresh_tokens.instance_jkt` (sxem addımı 11) və yeniləmədə nümunə açarı yoxlaması;
  şəxsiyyət xidmətinin ZK tokenində `ijk`.
- Cüzdan (Tamga Wallet): provayder protokolu `requestWia({ keyRef })` (mövcud açara WIA), bağlı açarlar WIA dəyişəndə silinmir.
- Spesifikasiya: [[SPEC-PROTO-0001]] §4.1–4.2.

# Status

**Accepted — 2026-10-22.** Layihə rəhbərliyinin təsdiqi ilə (OpenID uyğunluq öz-testi tapıntısı G12). DECISIONS: D-PROTO-4.
