---
document_id: ADR-0026
title: Kayıt Sertifikaları (WRPRC) ve Erişim Sertifikasında Kurum Kimlik Numarası
category: ADR
domain: Trust
status: Active
review_status: Completed
version: 1.0.0
created: 2026-09-29
last_updated: 2026-09-29
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
  - relying-parties
  - institutions
  - operators
tags:
  - adr
  - registration
  - relying-party
  - etsi
  - trust-list
keywords:
  - WRPRC
  - rc-wrp+jwt
  - verifier_info
  - registration_cert
  - organizationIdentifier
  - ETSI TS 119 475
summary: >
  Tamga, geçici kayıt kurumu (registrar) olarak her doğrulayıcı kullanımı ve her belge veren için ETSI TS 119 475 kayıt
  sertifikası (WRPRC, `rc-wrp+jwt`) üretir; içerik yalnız imzalı güven listesindeki kayıttan gelir ve ayrı bir kayıt kurumu
  anahtarıyla imzalanır. Doğrulayıcı sertifikayı OpenID4VP isteğinde `verifier_info` (`registration_cert`) ile gönderir; cüzdan
  imzayı, süreyi, erişim sertifikasındaki kurum kimlik numarasıyla eşleşmeyi ve istenen alanları denetler. Yeni erişim
  sertifikaları kurum kimlik numarasını (`organizationIdentifier`) taşır.
related:
  - "[[ADR-0024]]"
  - "[[ADR-0017]]"
  - "[[SPEC-PROTO-0002]]"
  - "[[SPEC-TRUST-0001]]"
  - "[[FW-TF-0001]]"
---

# Bağlam

[[ADR-0024]] doğrulayıcı ve belge veren kayıtlarına AB ortak veri setini ekledi ve kayıt sertifikasını (WRPRC) sonraki adım
olarak bıraktı. AB boşluk analizinde (H1, P2) bu madde açık kaldı: ARF konu 44, RPA_02, RPA_06.

AB modelinde:

- **Erişim sertifikası** (WRPAC) doğrulayıcının kim olduğunu söyler; konu alanında kurum kimlik numarası (ETSI EN 319 412-1
  semantik tanımlayıcı, ör. `VATTR-1234567890`) bulunur.
- **Kayıt sertifikası** (WRPRC, ETSI TS 119 475 v1.2.1) doğrulayıcının **neyi, hangi amaçla istemek üzere kayıtlı olduğunu** söyler.
  Ulusal kayıt kurumu imzalar; `typ` `rc-wrp+jwt`; JAdES B-B imzası; en çok 12 ay geçerli; kullanım başına ayrı sertifika.
- Doğrulayıcı bunu OpenID4VP isteğinde `verifier_info: [{"format": "registration_cert", "data": "<jwt>"}]` ile taşır
  (ETSI TS 119 472-2). Kayıt sertifikası AB'de isteğe bağlıdır; kayıt kurumu verirse cüzdan doğrular.

Tamga cüzdanı bugün aynı bilgiyi imzalı güven listesinden okuyor. Kayıt sertifikası, AB cüzdanlarının Tamga doğrulayıcılarını
ve belge verenlerini kendi bildikleri biçimde tanıyabilmesi için gerekir. Proje yönetimi H1 planını (P2) onayladı ve sıradaki
işlere geçilmesini istedi.

# Karar

## K1 — Kayıt kurumu ve imza anahtarı

Tamga, Türkiye adına **geçici kayıt kurumudur** (LOTL `roles.registrar`, PROVISIONAL). Kayıt sertifikaları ayrı bir **kayıt
kurumu anahtarıyla** imzalanır (liste imza anahtarından ayrı). Anahtarın parmak izi LOTL'de `roles.registrar.signing_keys`
altında yayınlanır; cüzdan kayıt kurumu anahtarını buradan tanır (LOTL uygulamaya gömülü parmak iziyle doğrulanmıştır).

## K2 — Üretim: yalnız güven listesindeki kayıttan

Liste yayıncısı her yayında şunları üretir:

| Kimin için | Kaç sertifika | Önemli alanlar |
|---|---|---|
| Doğrulayıcı | her kullanım (`scopes[]`) için bir | `purpose`, `credentials` (vct + istenebilecek alanlar), `privacy_policy`, `intended_use_id` = `scope_id` |
| Belge veren | kurum başına bir | `provides_attestations` (yetkili olduğu türler), `entitlements` |

Ortak alanlar: `name` (ticari ad), `sub_ln` (resmî ad), `sub` (semantik tanımlayıcı), `country`, `registry_uri` (imzalı ulusal
liste adresi), `entitlements` (ETSI TS 119 475 Ek A URI'leri), `srv_description`, `info_uri`, `support_uri`,
`supervisory_authority`, `public_body`, `iat`, `exp`.

- `sub` kaydın `identifiers[]` alanından türetilir: `TR-VKN` → `VATTR-<numara>`, `TR-MERSIS` → `NTRTR-<numara>`.
  **Kimlik numarası olmayan kayıt için sertifika üretilmez** (yayıncı uyarı verir).
- `exp` en çok 12 ay; kullanım ya da kaydın bitiş tarihi daha yakınsa o.
- Aracı üzerinden gelen istek ([[ADR-0017]]) için `intermediary {sub, sname}` doldurulur.
- Sertifikalar `trust.tamga.network/wrprc/` altında yayınlanır (dizin: `wrprc/index.json`). Kişisel veri içermez.

## K3 — Erişim sertifikasında kurum kimlik numarası

Yeni erişim sertifikaları (`pki:issue`) konu alanında `organizationIdentifier` (OID 2.5.4.97) taşır. Değer kayıt sertifikasının
`sub`'ıyla aynıdır. Mevcut geliştirme sertifikaları bu alanı taşımaz; kimlik numarası kayda girildiğinde sertifika yenilenir.

## K4 — Doğrulayıcı

Doğrulayıcı, isteğin kullanımına ait kayıt sertifikası varsa istek nesnesine
`verifier_info: [{"format": "registration_cert", "data": "<jwt>"}]` ekler. Yoksa istek bugünkü gibi gider.

## K5 — Cüzdan

İstekte `registration_cert` varsa cüzdan sırayla denetler:

1. `typ` `rc-wrp+jwt`; imza `x5c` sertifikasıyla geçerli; bu sertifikanın parmak izi LOTL'deki kayıt kurumu anahtarlarından biri.
2. `iat` ≤ şimdi < `exp`.
3. `sub` (aracılı istekte `intermediary.sub`) isteği imzalayan erişim sertifikasındaki `organizationIdentifier` ile aynı.
4. İstenen alanların tamamı sertifikanın `credentials` listesinde. Fazlası **fazla istek** sayılır (onay ekranında uyarı).

1–3'ten biri tutmazsa istek **reddedilir** ve kullanıcıya "kayıt sertifikası geçersiz" gösterilir. Kayıt sertifikası yoksa ya da
geçerliyse cüzdan güven listesi denetimine bugünkü gibi devam eder. İki kaynak çelişirse daha kısıtlayıcı olan uygulanır.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Kayıt sertifikası üretmemek (AB'de isteğe bağlı) | ret | AB cüzdanları Tamga doğrulayıcılarının neyi istemeye kayıtlı olduğunu bilemez |
| Liste imza anahtarıyla imzalamak | ret | Anahtar ayrımı: liste imzası ile kayıt beyanı ayrı roller |
| Kullanım başına değil, doğrulayıcı başına tek sertifika | ret | TS 119 475 ve TS5 kullanım başına sertifika öngörür |
| Kimlik numarası yokken yer tutucu `sub` | ret | Erişim sertifikasıyla eşleşme anlamsız olur; sahte güven üretir |

# Değişmezler

| Kod | Kural |
|---|---|
| WRC1 | Kayıt sertifikası yalnız imzalı güven listesindeki kayıttan üretilir; listede olmayan alan ya da tür sertifikaya girmez. |
| WRC2 | Kayıt sertifikası kayıt kurumu anahtarıyla imzalanır; bu anahtar liste imza anahtarından ayrıdır ve LOTL'de yayınlanır. |
| WRC3 | Kayıt sertifikasının geçerliliği en çok 12 aydır ve kaydın ya da kullanımın bitiş tarihini aşmaz. |
| WRC4 | Cüzdan, imzası, süresi ya da erişim sertifikasıyla bağı doğrulanamayan kayıt sertifikası taşıyan isteğe veri göndermez. |

# Sonuçlar

- `apps/trust-publisher`: kayıt sertifikası üretimi (`wrprc.ts`), LOTL'de kayıt kurumu anahtarı; `ops/gen-pki.ts` kayıt kurumu
  anahtarı; `ops/pki-issue.ts --org-id`.
- `@tamga-network/verifier`: `createPresentationRequest({ registrationCert })`; `apps/verify` kullanıma ait sertifikayı ekler.
- `@tamga-network/wallet-core`: kayıt sertifikası doğrulaması; onay ekranında sonuç.
- Pilot öncesi: kayıtlara kimlik numaraları girilir, erişim sertifikaları `organizationIdentifier` ile yenilenir; kayıt kurumu
  rolü ulusal makama devredildiğinde anahtar LOTL'de değişir.

# Durum

**Accepted — 2026-09-29.** Proje yönetimi onayıyla (H1 planı, P2). DECISIONS: D-REG-2.
