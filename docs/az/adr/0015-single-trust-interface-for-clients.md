---
document_id: ADR-0015
title: "Vahid etibar interfeysi"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Servislər etibar suallarını vahid interfeysdən (`TrustSource`, @tamga-network/trust) soruşur; rəqəmsal cüzdan isə React Native-də bu paketdən istifadə edə bilmədiyi üçün eyni siyahı yoxlamasını `wallet-core` daxilində ayrıca aparır. Təklif: `@tamga-network/trust`-ın yoxlama nüvəsi platformadan asılı olmayan (təmiz TS, node:fs-siz, jose-suz) alt yola ayrılır; rəqəmsal cüzdan da daxil olmaqla hər müştəri eyni interfeysdən istifadə edir. Faza 0-da zəncir mənbəyi (`ChainTrustSource`) də eyni interfeysin arxasına keçir. Bu sənəd keçid planını təsvir edir, onu tətbiq etmir.
domain: Trust
translation_of: ADR-0015
source_version: "1.0.0"
---

# Kontekst

İş infrastrukturunun qurulmasında (2026-09-27) məqsəd bu idi: müştərilər beta-ya və ya zəncirə birbaşa
deyil, ortaq şəxsiyyət/etibar interfeysinə qoşulur. Tamga-da bu interfeys **artıq mövcuddur**: `TrustSource` ([[ADR-0009]] K3, BT4) —
Faza B-də imzalı [[t:trust-list|etibar siyahıları]] (`ListTrustSource`), Faza 0-da zəncir (`ChainTrustSource`). Beta verilənlər bazası deyil, imzalı siyahı
fayllarıdır; müştərilər (rəqəmsal cüzdan) verilənlər bazasına ümumiyyətlə qoşulmur, servislərlə standart protokollar ([[t:OpenID4VCI]]/VP) vasitəsilə əlaqə qurur.

Araşdırma zamanı aşkar edilən yeganə kənarlaşma rəqəmsal cüzdan tərəfindədir. `@tamga-network/trust` `node:fs`, `jose` və `zod`-a əsaslandığı üçün Expo/React
Native-də istifadə olunmur; S-13-ün bağlanması zamanı eyni yoxlama `wallet-core`-a ayrıca yazıldı. Hazırda siyahını interfeysdən kənarda
şərh edən yerlər:

| Fayl | Nə edir |
|---|---|
| `packages/wallet-core/src/trustlist.ts` | `lotl.jws` + `tl-<cc>.jws` imza yoxlaması, `next_update`, geri sarma (ayrıca reallaşdırma) |
| `packages/wallet-core/src/directory.ts` | `issuers[]` xam sahələrini (`issuer_url`, `schema_authorizations`, `category`) oxuyub qurum kataloqu yaradır |
| `packages/wallet-core/src/oid4vp.ts` (`fetchRpRecord`) | `relying_parties[]`-dən RP qeydini seçir |

Servislər (`apps/verify`, `apps/issuer` (operator anbarı), `apps/id`) interfeys üzərindən keçir (faylı oxuyub `loadTrustSet`-ə ötürür).

Risk: iki yoxlama reallaşdırması zamanla bir-birindən ayrılır (məs. TL12 yoxlama nöqtəsi, yeni sahələr); Faza 0-da rəqəmsal cüzdan zəncir mənbəyinə
keçə bilmir, çünki siyahı formatına bağlıdır.

# Qərar

1. **K1 — Daşına bilən nüvə.** `@tamga-network/trust` yoxlama məntiqi (JWS yoxlaması, siyahı qaydaları, `TrustStore`,
   `TrustSource` sorğuları) `node:fs`/`jose`/`zod` tələb etməyən alt yola ayrılır: `@tamga-network/trust/core`
   (imza `@noble/curves`, sxem yoxlaması əl ilə və ya yüngül vasitə ilə). Node ilə uyğun mövcud giriş nöqtəsi (`fs.ts`, `guardedReload`) əsas yolda qalır.
2. **K2 — Müştəri mənbəyi.** `wallet-core` `trustlist.ts`/`directory.ts`/`fetchRpRecord` əvəzinə `trust/core`-dan bir
   `HttpListTrustSource` (HTTP ilə yükləyən, daxili pin ilə yoxlayan) istifadə edir; qurum kataloqu və [[t:RP]] qeydi `TrustSource`
   sorğularından (`issuers()`, `relyingParty()`) gəlir.
3. **K3 — Faza 0, eyni interfeys.** `ChainTrustSource` servislərdə birbaşa; rəqəmsal cüzdanda isə birbaşa RPC əvəzinə eyni interfeysin
   arxasında (siyahı güzgüsü və ya yüngül indeksləyici) — rəqəmsal cüzdanın kodu dəyişmir.

# Əsaslandırma / alternativlər

- **Mövcud vəziyyəti saxlamaq:** ən az iş tələb edir, lakin BT4-ün ruhuna ziddir və Faza 0 keçidində rəqəmsal cüzdanı ayrıca yenidən işləməyi tələb edir.
- **Rəqəmsal cüzdana node polyfill-ləri:** `jose`/`zod` RN-də qismən işləyir, lakin `node:fs` və paket ölçüsü problem yaradır; kövrək həlldir.
- **Ayrıca "identity servisi" (server tərəfində etibar proxy-si):** rəqəmsal cüzdanın hər etibar sualını Tamga serverinə ünvanlaması izlənilmə imkanı
  yaradır (hansı qurumu nə vaxt soruşduğu) — məxfilik prinsipinə ziddir; rədd edilir.

# Dəyişməzlər

| # | Dəyişməz qayda |
|---|---|
| **TS1** | Hər müştəri və servis etibar sualını yalnız `TrustSource` interfeysi vasitəsilə verir; siyahı/zəncir formatı interfeysdən kənarda şərh edilmir (BT4-ün müştərilərə şamil edilməsi). |
| **TS2** | Siyahı yoxlama qaydaları yalnız bir reallaşdırmada saxlanılır (`trust/core`); başqa paket onların surətini saxlamır. |
| **TS3** | Müştəri etibar sualı üçün Tamga-ya istifadəçi ilə əlaqələndirilə bilən sorğu göndərmir; siyahılar toplu şəkildə yüklənir. |

# Keçid planı

1. `trust/core` alt yolunu ayır; mövcud `trust` testləri + `conformance/` vektorları hər iki giriş nöqtəsində uğurla keçsin.
2. `HttpListTrustSource` + daxili pin; `wallet-core` testlərini (`trustlist.test.ts` 7 test) yeni mənbəyə köçür.
3. `directory.ts` və `fetchRpRecord`-u `TrustSource` sorğularına keçir; köhnə `trustlist.ts`-u sil.
4. Metro iOS paket sınağı (ölçü, `@noble/*` uyğunluğu); cihaz testi.
5. Faza 0: `ChainTrustSource` ilə eyni müqavilə testləri.

# Status

**Accepted — 2026-09-27.** DECISIONS: D-TRUST-1.

Tətbiq: yuxarıdakı keçid planı.
