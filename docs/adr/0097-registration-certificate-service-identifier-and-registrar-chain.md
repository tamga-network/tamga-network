---
document_id: ADR-0097
title: "Kayıt sertifikası: hizmet kimliğinin AB adı (serviceIdentifier) ve kayıt kurumuna zincirle güven"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-24
last_updated: 2026-11-24
summary: >
  İki küçük değişiklik. (1) Kayıt sertifikasındaki (WRPRC) hizmet kimliği alanı Tamga'nın adı `service_id` yerine AB'nin
  adıyla `serviceIdentifier` yazılır (AB TS5 kayıt veri modeli `services[].serviceIdentifier`; AB referans araçları bu adı okur).
  Kaynak kayıttaki alan ve gömülü açıklama politikasının `(rp_id, service_id)` ikilisi değişmez. (2) Cüzdan kayıt sertifikasını
  imzalayan sertifikayı iki yoldan kabul eder: parmak izi listedeki kayıt kurumu anahtarı (bugünkü yol) ya da x5c'de yapraktan
  listedeki bir kayıt kurumu CA sertifikasına doğrulanmış zincir, yaprak geçerlilik süresi içinde (ETSI TS 119 602 Ek G). Aynısı
  kayıt sertifikası durum listesinin imzacısı için. Kayıt kurumu imzacı sertifikası `keys/` altında ilan edilir. Kabul: 2026-11-24.
domain: Trust
related: ["[[ADR-0026]]", "[[ADR-0046]]", "[[ADR-0068]]", "[[ADR-0029]]", "[[ADR-0091]]", "[[SPEC-TRUST-0001]]", "[[SPEC-WALLET-0001]]"]
---

# Kısaca

Kayıt sertifikası AB'nin alan adını kullansın (`serviceIdentifier`) ve cüzdan, kayıt kurumunun anahtarını yalnız tek tek
sabitleyerek değil, listedeki kayıt kurumu CA'sına giden zincirle de tanısın. Bugünkü Tamga kayıt kurumu için hiçbir şey değişmez.

# Bağlam

- ARF RPRC_17a: cüzdan, kayıt sertifikasında ve erişim sertifikasında aynı doğrulayıcı kimliği ve aynı hizmet kimliği olduğunu
  denetler. ETSI TS 119 475'te hizmet kimliği için alan adı yok; AB TS5 kayıt veri modeli `services[].serviceIdentifier` kullanır.
  OpenID öz-testinde AB aracı bu adı okudu, bizim `service_id`'yi tanımadı.
- Bugün cüzdan kayıt sertifikasının imzacısını yalnız parmak iziyle tanır (LOTL `roles.registrar.signing_keys`). ETSI TS 119 602
  Ek G'de listedeki sertifikalar kayıt sertifikasının imzasını doğrulamaya yarar; bir ülkenin kayıt kurumu imzacı sertifikalarını
  bir CA'dan verebilir. Yalnız sabitleme, her imzacı değişiminde listeyi yeniden yayımlamayı gerektirir.

# Karar

## K1 — Hizmet kimliğinin adı `serviceIdentifier`

- Yayın aracı kayıt sertifikasına hizmet kimliğini `serviceIdentifier` adıyla yazar (değer: kullanımın `service_id`'si, yoksa
  `scope_id` — [[ADR-0046]] gibi). Eski `service_id` yük alanı yazılmaz ve cüzdan okumaz (geliştirme evresi, [[ADR-0029]]).
- Değişmeyen: kaynak kayıttaki `scopes[].service_id` alanı, gömülü açıklama politikasının `relying_parties[].service_id` öğesi
  (eşleme artık sertifikanın `serviceIdentifier`'ına yapılır) ve zincir projeksiyonu.
- Erişim sertifikasında hizmet kimliğinin yeri AB'de tanımlı değil (ETSI TS 119 411-8 yalnız OU'dan söz eder); RPRC_17a'nın
  erişim sertifikası tarafı AB'yi bekler.

## K2 — Kayıt kurumuna güven: sabit imzacı ya da zincir

- Cüzdan (`wallet-core` `registrarSigned`) kayıt sertifikasının (JWT ve yakın alan CWT biçimi) ve kayıt sertifikası durum
  listesinin imzacısını şu iki yoldan biriyle kabul eder:
  1. **Sabit:** yaprağın SHA-256 parmak izi LOTL'de ülkenin `roles.registrar.signing_keys`'inde ve `ACTIVE`.
  2. **Zincir:** x5c'de (en çok 4 sertifika) yapraktan listedeki (aynı `signing_keys`) bir sertifikaya kadar her imza doğrulanıyor
     ve adlar zincirleniyor; yaprak CA değil ve anahtar kullanımı varsa `digitalSignature` taşıyor; yaprağın üstündeki her sertifika
     (listedeki CA dahil) `cA=TRUE`, anahtar kullanımı varsa `keyCertSign`, `pathLen`'e uyuyor; çapa dışındaki her sertifika
     geçerlilik süresi içinde. Böylece CA olmayan bir imzacı anahtarı — süresi dolmuş bir imzacı ya da sabit imzacının kendisi —
     yeni imzacı türetemez.
- Çapa yalnız kayıt kurumu anahtarlarıdır; ulusal listenin `root_cas`'ı ya da başka bir çapa kayıt sertifikası için sayılmaz.
- Listeye yeni alan eklenmez: listedeki parmak izi imzacının kendisi de olabilir, imzacıyı veren kayıt kurumu CA'sı da.

## K3 — İlan

- Yayın aracı LOTL'deki kayıt kurumu imzacı sertifikalarını `keys/<ad>.cert.pem` olarak ilan eder (parmak izleri zaten LOTL'de).

# Gerekçe / alternatifler

- Ad: AB'nin kendi adı seçildi. `service_id`'yi koruyup AB araçlarına uyarlama yazmak ayrışmayı sürdürürdü.
- Güven: yalnız zincir (sabitlemeyi kaldırmak) bugünkü kayıt kurumunu bozardı; yalnız sabitleme AB modelinden ayrışır. İkisi
  birlikte, toplanabilir biçimde.

# Değişmezler

| Kod | Kural |
|---|---|
| RG1 | Kayıt sertifikası ve durum listesi imzacısı yalnız LOTL'deki ülkenin etkin kayıt kurumu anahtarlarına bağlanır (sabit ya da zincir); başka çapa sayılmaz. |
| RG2 | Zincir yolunda yaprağın üstündeki her sertifika CA'dır (`cA=TRUE`, `keyCertSign`, `pathLen`); çapa dışındaki her sertifika süresi içindedir; zincir en çok 4 sertifikadır. |
| RG4 | Listeye kayıt kurumu CA'sı olarak yalnız kayıt kurumu imzacılarına ayrılmış bir CA girer (başka sertifika veren CA girmez). |
| RG3 | Kayıt sertifikasındaki hizmet kimliği `serviceIdentifier` adıyla taşınır. |

# Sonuçlar

- Kalan risk (bilinçli): sabit bir anahtar listeden çıkarılarak hemen geri alınır; zincirle tanınan bir imzacı ise CA listeden
  çıkarılana ya da süresi dolana kadar geçerlidir. Kayıt kurumu CA'sı kullanan ülke imzacı sertifikalarını kısa ömürlü verir;
  kayıt sertifikalarının kendisi zaten durum listesiyle iptal edilebilir ([[ADR-0068]]).
- `@tamga-network/wallet-core` ve yayın aracı değişir (CHANGELOG, sonraki npm sürümü). Sandbox ve gerçek ağdaki kayıt
  sertifikaları bir sonraki yayında yeni adla yeniden üretilir.

# Durum

**Accepted — 2026-11-24** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-REG-7. RG1–RG4 bağlayıcıdır.
Uygulama aynı gün (güvenlik incelemesi sonrası CA ve süre denetimleriyle): `wallet-core` `registrarSigned`, `certValidity`, `certUsage`; `verifyWrprc`, `verifyWrprcCwt`, durum listesi imzacısı;
yayın aracı `serviceIdentifier` ve `keys/` ilanı; testler.
