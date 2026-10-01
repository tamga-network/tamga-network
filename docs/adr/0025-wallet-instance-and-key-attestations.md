---
document_id: ADR-0025
title: Cüzdan Örneği Kanıtı (WIA) ve Anahtar Kanıtı (KA) — AB TS3'e Geçiş
category: ADR
domain: Wallet
status: Active
review_status: Completed
version: 1.0.2
created: 2026-09-29
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
  - institutions
tags:
  - adr
  - wallet
  - wallet-provider
  - attestation
  - revocation
keywords:
  - wallet instance attestation
  - key attestation
  - client_status
  - key_storage_status
  - TS3
summary: >
  Tek, 30 günlük cüzdan onayı (WUA) yerine AB TS3 modeli: 24 saatten kısa ömürlü, her belge işleminde yeni anahtarlı ve yeni iptal
  girişli Cüzdan Örneği Kanıtı (WIA) + belge anahtarlarının deposunu anlatan Anahtar Kanıtı (KA, `key_attestation`). Cüzdan
  sağlayıcı cüzdan birimini kaydeder, WIA–birim eşlemesini tutar, iptal listelerini yayınlar ve kullanıcının isteğiyle birimi iptal
  eder. Belge verenler WIA ve KA'yı ve iptal durumlarını doğrular. D-CRED-6'nın biçimini değiştirir.
related:
  - "[[ADR-0023]]"
  - "[[SPEC-PROTO-0001]]"
  - "[[SPEC-WALLET-0001]]"
  - "[[FW-TF-0001]]"
---

> **Sürüm notu 1.0.2 (2026-10-01) — [[ADR-0034]] (D-PROTO-2):** K2'deki WIA `sub` artık cüzdan çözümünün kimliği (`solution_id`) — bütün örneklerde ortak (HAIP 1.0 §4.4.1); örnekleri yalnız her işlemde yeni `cnf` anahtarı ve yeni iptal girişi ayırır. PAR `client_id` = `sub`.

> **Sürüm notu 1.0.1 (2026-10-01) — silme:** `POST /units/delete` (birim anahtarıyla PoP, `action: "delete"`): birim iptal edilir
> (WIA2), sonra kayıt tamamen silinir; ayrılmış iptal indeksleri yeniden kullanılmaz. Metadata `unit_deletion_endpoint`. Cüzdanda
> "Cüzdanı sıfırla ve verilerimi sil" ([[SPEC-WALLET-0001]] §7.6). Karar değişmedi.

# Bağlam

Tamga cüzdanı bugün cüzdan sağlayıcıdan (`wallet.tamga.network`) **30 gün geçerli tek bir WUA** alıyor. Belge verirken her kuruma
aynı WUA'yı gösteriyor (D-CRED-6, SPEC-PROTO-0001 §11.1). AB boşluk analizinde (H1) bu, en büyük eksik gruplarından biri çıktı:
- konu 9: 22 madde,
- konu 38: 15 madde,
- VCR_01a/03a/07,
- WIAM_06/10.

AB TS3 (v1.5.2) ve ARF 3.0'a göre eksikler:

1. **Ömür ve bağlanamazlık.** WIA 24 saatten kısa ömürlü olmalı. Aynı WIA birden fazla kuruma gösterilmemeli; aksi hâlde kurumlar
   aynı cüzdanı birbirine bağlayabilir.
2. **Anahtar kanıtı yok.** Belge anahtarlarının hangi depoda durduğunu cüzdan sağlayıcının imzalı bir `key_attestation` ile
   söylemesi gerekiyor (OpenID4VCI Ek D). Bugün kurum bunu WUA'daki bir beyandan okuyor.
3. **İptal yok.** Cüzdan sağlayıcı WIA ve KA için iptal listesi yayınlamalı, kullanıcının isteğiyle cüzdan birimini iptal
   edebilmeli (VCR_07, WURevocation_10). Bunun için hangi WIA'nın hangi birime ait olduğunu bilmeli.

Proje yönetimi H1 planını (P3: bu iş) onayladı ve sıradaki işlere geçilmesini istedi.

# Karar

## K1 — Cüzdan birimi kaydı

Cüzdan ilk kurulumda cüzdan sağlayıcıya bir **birim anahtarı** kaydeder. Bu anahtar yalnız cüzdan ile sağlayıcı arasında kullanılır,
hiçbir kuruma gösterilmez. Sağlayıcı bir birim kaydı tutar:
- birim anahtarının parmak izi,
- çözüm ve sürüm,
- kayıt zamanı,
- iptal durumu,
- birime verilmiş WIA iptal girişleri.

Kişisel veri tutulmaz. Birimle ilgili istekler birim anahtarıyla imzalanır.

## K2 — WIA (Cüzdan Örneği Kanıtı)

- Biçim: OpenID4VCI 1.0 Ek E (`oauth-client-attestation+jwt`), TS3 §2.3.1 alanları: `sub`, `wallet_name`, `wallet_version`,
  `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk`.
- **Ömür < 24 saat** (Tamga: 23 saat). `client_status.exp` en az 31 gün ileride (Tamga: 60 gün).
- **Her belge işleminde yeni WIA:** yeni bir PoP anahtarı ve yeni, bağlanamaz bir iptal girişi. Kurum başına yeniden kullanım
  seçeneği kullanılmaz; böylece sağlayıcı cüzdanın kaç kurumla görüştüğünü öğrenmez.
- Sağlayıcı iptal girişi ile birim arasındaki eşlemeyi tutar; birim iptal edilince bütün girişleri iptal olur.

## K3 — KA (Anahtar Kanıtı)

- Biçim: OpenID4VCI 1.0 Ek D (`keyattestation+jwt`), TS3 §2.3.2 alanları:
  - `attested_keys` (bir paketteki bütün belge anahtarları),
  - `key_storage` / `user_authentication` (ISO 18045 seviyeleri),
  - `certification`,
  - `key_storage_status {status, exp}`.
- **Dürüst seviye:** bugün anahtarlar yazılım deposunda (S-9). KA `key_storage: ["iso_18045_basic"]` der ve sertifika yoktur.
  Güvenli donanıma geçişte (Z1) seviye yükselir.
- İptal: **tür başına ortak giriş** (TS3 Seçenek 1). Yazılım deposu, Secure Enclave ve StrongBox'un her birinin bir girişi vardır.
  Birim kimliği KA'dan çıkarılamaz.
- Taşıma: `jwt` proof'unun başlığında `key_attestation`. Proof, `attested_keys[0]` ile imzalanır; paket tek proof'la istenir. Her
  anahtar yalnız bir KA'da yer alır. KA bir kez kullanılır.

## K4 — İptal listeleri ve kullanıcı isteğiyle iptal

- Sağlayıcı iki Token Status List yayınlar (WIA girişleri ve KA türleri). Listeleri kendi anahtarıyla imzalar; bu anahtar güven
  listesinde kayıtlıdır. WIA listesi en az 10.000 girişlidir.
- Kullanıcı cüzdandan "Bu cüzdanı iptal et" diyebilir (cihaz devri, satış). Birim ve bütün WIA girişleri iptal olur.
- Kayıp veya çalıntı cihazdan iptal, kullanıcı hesabı gerektirir (WIAM_06); sonraki adıma bırakılır.

## K5 — Belge verenler

- PAR ve token uçlarında WIA doğrulanır: imza, sağlayıcı anahtarı güven listesinde, süre, PoP (`cnf`), `client_status`
  iptal değil.
- Credential ucunda, proof başlığında KA varsa şunlar doğrulanır:
  - imza ve sağlayıcı anahtarı,
  - proof'un `attested_keys[0]` ile imzası ve `nonce`,
  - `key_storage_status` iptal değil,
  - `key_storage` seviyesi kurumun alt sınırını karşılıyor.

  Belgeler `attested_keys`'e bağlanır.
- Metadata: `proof_types_supported.jwt.key_attestations_required {key_storage, user_authentication}` (ISSU_27d).
- Geçiş: KA'sız eski proof biçimi pilot öncesine kadar kabul edilir, sonra kaldırılır.
- Kurumun eski WUA alanlarından okuduğu `key_storage` artık KA'dan okunur.

## K6 — Yenileme belirteci bağı

[[ADR-0023]] yenileme belirteci bugün WUA `sub`'una da bağlı. Her işlemde yeni WIA anahtarı kullanıldığı için bu bağ, belgeye özel
**DPoP anahtarı + geçerli, iptal edilmemiş bir WIA** koşuluna dönüşür. AR2'nin "her yenilemede cüzdan onayı doğrulanır" kuralı
aynen geçerlidir.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Tek 30 günlük WUA (bugünkü) | ret | TS3 ile uyumsuz; kurumlar arası bağlanabilir; iptal yok |
| Kurum başına yeniden kullanılan WIA girişi | ret | Sağlayıcı cüzdanın kaç kurumla, ne sıklıkta görüştüğünü öğrenir |
| KA başına ayrı iptal girişi (Seçenek 2) | sonra | Kullanıcı isteğiyle anahtar deposu iptali için; donanım anahtarıyla (Z1) birlikte |
| **Her işlemde yeni WIA + tür başına KA girişi** | **kabul** | En az bilgi; TS3'ün izin verdiği en mahremiyet dostu seçenek |

# Değişmezler

| Kod | Kural |
|---|---|
| WIA1 | WIA'nın ömrü 24 saatten kısadır; her belge işleminde yeni PoP anahtarlı ve yeni iptal girişli bir WIA kullanılır. |
| WIA2 | Cüzdan sağlayıcı birim kaydında kişisel veri tutmaz; birim iptal edilince o birime verilmiş bütün WIA girişleri iptal olur. |
| WIA3 | KA'daki anahtar deposu seviyesi gerçeği söyler; doğrulanmamış bir beyan KA'ya yazılmaz. |
| WIA4 | Belge veren, iptal edilmiş bir WIA ya da KA ile belge vermez. |

# Sonuçlar

- `apps/wallet-provider`:
  - birim kaydı, `/wia`, `/ka`, `/units/revoke`, `/units/delete` (1.0.1),
  - iki iptal listesi,
  - kalıcı durum dosyası.
- `@tamga-network/issuer`: WIA ve KA doğrulayıcıları, iptal denetimi. Kurum issuer'ı ve kimlik servisi yeni biçimi kullanır.
- `wallet-core`: birim anahtarı, işlem başına WIA, KA isteği, KA'lı proof. Cüzdan: kayıt, "Bu cüzdanı iptal et".
- [[SPEC-PROTO-0001]] §11.1 ve D-CRED-6 yeniden ifade edilir.
- ARF: konu 9, 38 ve VCR_01a/03a/07 büyük ölçüde karşılanır. WSCD ve cihaz kanıtı Z1'dedir.

# Durum

**Accepted — 2026-09-29.** Proje yönetimi onayıyla (H1 planı, P3). DECISIONS: D-CRED-7.
