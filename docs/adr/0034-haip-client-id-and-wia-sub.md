---
document_id: ADR-0034
title: HAIP 1.0 Uyumu — Doğrulayıcı İstemci Kimliği x509_hash, WIA sub Ortak Değer
category: ADR
domain: Protocol
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
tags:
  - adr
  - openid4vp
  - haip
  - wallet-attestation
keywords:
  - x509_hash
  - client identifier prefix
  - WIA sub
  - dns_name
summary: >
  HAIP 1.0'ın iki kuralı uygulanır: doğrulayıcı imzalı istekte yalnız `x509_hash` istemci kimliğini kullanır, cüzdan yalnız onu
  kabul eder (§5); cüzdan kanıtının (WIA) `sub`'ı aynı cüzdan çözümünü kullanan bütün örneklerde ortak değerdir (§4.4.1).
  `x509_hash` sertifika yenilenince değiştiği için RP kaydına kalıcı kimlik olarak `dns_name` eklenir; kopya ayrımı, takma ad,
  geçiş kartı ve aracı ilişkileri ona bağlanır.
related:
  - "[[ADR-0017]]"
  - "[[ADR-0025]]"
  - "[[ADR-0031]]"
  - "[[ADR-0012]]"
  - "[[SPEC-PROTO-0002]]"
  - "[[SPEC-TRUST-0001]]"
---

# Özet (sade)

- Doğrulayıcılar kendilerini artık alan adıyla değil, **sertifikalarının parmak iziyle** (`x509_hash`) tanıtır; AB'nin bağladığı
  HAIP 1.0 profili bunu zorunlu kılıyor. Cüzdan yalnız bu biçimi kabul eder.
- Parmak izi sertifika yenilenince değişir. Bu yüzden güven listesindeki her doğrulayıcı kaydı ayrıca **kalıcı bir alan adı**
  (`dns_name`) taşır; takma adlar, belge kopyaları ve geçiş kartları buna bağlıdır — sertifika yenilense de kullanıcının
  hesapları ve kartları bozulmaz.
- Cüzdan kanıtının "kim" alanı (`sub`) artık her telefonda aynıdır (cüzdan çözümünün adı); telefona özgü bir değer taşımaz.

# Bağlam

43. turda (2026-09-30) HAIP 1.0 maddeleri tek tek eşlendi (özel kaynak kütüphanesi, `protocols/haip-1.0.md`); iki fark açık
kaldı ve kapatılmış kararlara dokunduğu için ADR'ye bırakıldı:

1. **İstemci kimliği öneki.** HAIP 1.0 §5: "For signed requests, the Verifier MUST use, and the Wallet MUST accept the Client
   Identifier Prefix `x509_hash`". OpenID4VP 1.0 §5.9.3: değer, yaprak X.509 sertifikanın DER kodlamasının SHA-256 özetinin
   base64url hâlidir; cüzdan özetin yaprak sertifikayla eşleştiğini, imzayı ve sertifika zincirini doğrular. Tamga doğrulayıcısı
   bugüne kadar `x509_san_dns:<alan adı>` kullanıyordu (SPEC-PROTO-0002 §2; güven listesi kaydı ve [[ADR-0017]] aracı ilişkileri
   bu dizeyle anahtarlıydı). ETSI TS 119 475 erişim sertifikasını `x509_hash` yaprağı olarak tanımlar (CIR 2026/1730).
2. **WIA `sub`.** HAIP 1.0 §4.4.1: "The subject claim for the Wallet Attestation MUST be a value that is shared by all Wallet
   instances using the present type of wallet implementation"; ayrıca PAR'daki `client_id` bu `sub` değeridir. Tamga cüzdan
   sağlayıcısı (`apps/wallet-provider`) `sub` olarak her işleme özel efemer anahtarın parmak izini yazıyordu ([[ADR-0025]] K2).
   İzlenemezlik açısından sorun değildi, ama kuralın harfine uymuyordu.

Proje yönetimi 2026-10-01'de iki maddede AB yolunu onayladı (özel onay kaydı, "Mağaza öncesi mühendislik işleri").

# Karar

## K1 — Doğrulayıcı istemci kimliği `x509_hash`

İmzalı istek nesnesinin `client_id`'si `x509_hash:` + base64url(SHA-256(erişim sertifikası DER)). Değer **elle verilmez**:
`pemRpSigner(anahtar, sertifika)` sertifikadan hesaplar; Tamga Verify ve kurum issuer'larının sunum istekleri de öyle. Ayar
dosyalarındaki `TAMGA_VERIFY_CLIENT_ID` ve `TAMGA_ISSUER_RP_CLIENT_ID` kaldırılır.

## K2 — Cüzdan yalnız `x509_hash` kabul eder

HAIP başka önek istemez; geliştirme evresinde geriye uyum yazılmaz ([[ADR-0029]]). Cüzdan: önek `x509_hash` değilse ya da
özet yaprak sertifikayla eşleşmezse istek reddedilir. Eski `x509_san_dns` kuralının güvenlik yanı korunur: yanıt adresinin
(`response_uri`) alanı, isteği imzalayan sertifikanın SAN alan adlarından biri olmalıdır (yerel geliştirme adresleri hariç).
`tamga_on_behalf_of` (aracı istek, [[ADR-0017]] K7) de `x509_hash` biçimindedir.

## K3 — RP kaydında kalıcı kimlik: `dns_name`

Güven listesi `relying_parties[]` kaydı:

- `client_id`: yayıncı erişim sertifikasından hesaplar (`x509_hash:…`); kayıt kaynağında yazılmaz.
- `dns_name` (yeni, zorunlu): kalıcı kayıt kimliği; erişim sertifikasının SAN'ında bulunmalıdır (yayıncı denetler, yoksa yayın
  durur). Kayıt aracı (`register rp`, `scope <dns_name>`), aracı ilişkileri (`uses_intermediaries`, `served_relying_parties`) ve
  kayıt sertifikası üretimi bu alanla çalışır. `TrustSource.relyingPartyByDnsName()` eklenir.

## K4 — Sertifikadan bağımsız kalması gerekenler `dns_name`'e bağlanır

- **Kopya ayrımı** ([[SPEC-WALLET-0001]] WL5) ve **takma ad türetme** ([[ADR-0031]] K2): cüzdan kayıt çözülüp sertifika
  eşleşince `rpKey`'i kaydın `dns_name`'ine çevirir (`stableRpKey`). Doğrulayıcı takma adı aynı değerle denetler. Kayıtsız RP'de
  `client_id` kalır (takma ad zaten verilmez).
- **Geçiş kartı** ([[ADR-0012]] B): kart jetonunun `aud`'u RP'nin `dns_name`'i (kart günlerce geçerli, QR ≤ 400 bayt;
  `x509_hash` hem uzun hem yenilemede değişir).
- **Günlük:** sunum kaydında RP kimliği `dns_name`; cüzdan kaydı alan adıyla da çözer.
- **Bilet** (`EventTicket.gate.verifier_client_id`): alan adı aynı kalır (geliştirme evresi şema adı değişmez); değeri
  doğrulayıcının `dns_name`'idir — bilet uzun ömürlüdür.

## K5 — WIA `sub` ortak değer

Cüzdan sağlayıcısı WIA'da `sub` = cüzdan çözümünün kimliği (`solution_id`, ör. `tamga-wallet-expo`). Örneğe özgü değer yoktur;
örnekleri ayıran yalnız her işlemde yeni `cnf` anahtarı ve yeni, bağlanamaz iptal girişidir ([[ADR-0025]] K2 değişmez).
PAR'daki `client_id` ve PoP'un `iss`'i bu değerdir. Kurumun kaydettiği `wallet_sub` artık kişiye değil çözüme işaret eder
(gizlilik açısından daha az bilgi).

# Değişmezler

| Kod | Kural |
|---|---|
| CI1 | Doğrulayıcı imzalı istekte yalnız `x509_hash` istemci kimliğini kullanır; değer erişim sertifikasından hesaplanır, ayardan okunmaz (HAIP 1.0 §5). |
| CI2 | Cüzdan yalnız `x509_hash` öneki kabul eder; özet yaprak sertifikayla eşleşmezse istek reddedilir. Yanıt adresinin alanı imzalayan sertifikanın SAN'ında olmalıdır (yerel geliştirme hariç). |
| CI3 | Güven listesi RP kaydında `client_id` yayıncı tarafından erişim sertifikasından hesaplanır; kalıcı kayıt kimliği `dns_name`'dir ve sertifikanın SAN'ında bulunmalıdır. |
| CI4 | Kopya ayrımı, takma ad türetme, sunum günlüğü ve aracı ilişkileri `dns_name`'e bağlanır; `x509_hash`'e bağlanmaz. |
| CI5 | Geçiş kartı jetonunun `aud`'u RP'nin `dns_name`'idir. |
| CI6 | WIA `sub`, aynı cüzdan çözümünü kullanan bütün örneklerde ortak değerdir; örneğe özgü tanımlayıcı taşımaz (HAIP 1.0 §4.4.1). |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| `x509_san_dns`'te kalmak | ret | HAIP 1.0 §5 doğrulayıcının `x509_hash` kullanmasını şart koşuyor; AB cüzdanları yalnız onu kabul etmek zorunda. |
| Her iki öneki de kabul etmek | ret | HAIP ikinciyi istemiyor; iki yol ikili güvenlik denetimi demek. Geliştirme evresi (ADR-0029). |
| Takma adı / kopyaları `x509_hash`'e bağlamak | ret | Sertifika yenilenince bütün takma adlar (hesaplar) ve geçiş kartları değişirdi. |
| Kalıcı kimlik olarak `rp_id` | ret | `rp_id` de sertifikadan türüyor (`keccak256(ülke ‖ SHA-256(sertifika))`). |
| **`dns_name` (SAN'daki alan adı)** | **kabul** | Kayıtta zaten vardı (eski `client_id` dizesi); sertifikadan bağımsız; yayıncı SAN ile tutarlılığını denetleyebilir. |
| WIA `sub` = efemer anahtar parmak izi (bugünkü) | ret | İzlenemez ama HAIP'in harfine aykırı; AB kurumu PAR'da ortak değer bekler. |

# Sonuçlar / operasyonel etki

- **Sertifika yenileme sırası:** önce yeni erişim sertifikası kayıt kaynağına girer ve liste yeniden yayınlanır (yeni
  `client_id` listede), sonra doğrulayıcı yeni sertifikaya geçer. Liste yayımlanmadan sertifika değişirse cüzdan isteği
  "kayıtlı değil / taklit" diye reddeder. Takma adlar, kopyalar ve geçiş kartları etkilenmez (K4). Kayıt sertifikaları (ADR-0026)
  her yayında yeniden üretilir.
- **Kayıt aracı:** başvuru `client_id` taşımaz, `dns_name` taşır; `scope <dns_name>`.
- **Uyum vektörleri:** sürüm 2 (RP kaydında `dns_name`, `client_id` `x509_hash`).
- **Arşiv:** eski liste sürümleri (`archive/`) eski biçimdedir; geliştirme evresinde yeniden doğrulanmaz.
- **ZK deney fikstürü** (`packages/verifier/src/zk/fixtures/session.json`): oturum dökümüne giren `client_id` dizesi eski
  biçimde kalır (ispat o diziyle üretildi; dizenin kendisi denetlenmez).

# Durum

**Accepted — 2026-10-01** (proje yönetimi onayı: "A6 daki iki AB teknik kuralı neyse onu yap"). Uygulandı: core
(`x509HashClientId`), trust (şema + `relyingPartyByDnsName`), trust-publisher, verifier (imzacı, geçiş kartı), wallet-core
(istek doğrulama, `stableRpKey`, `fetchRpRecord`), cüzdan, Tamga Verify, cüzdan sağlayıcısı, platform issuer'ı.
