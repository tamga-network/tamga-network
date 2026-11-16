---
document_id: ADR-0088
title: "Askıdaki kurumun belgeleri"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-16
last_updated: 2026-11-16
summary: >
  Belge veren kurum güven listesinde askıdayken o kurumun verdiği belgeler, verilme anından bağımsız olarak doğrulamada kabul
  edilmez (C1 RED, neden "issuer suspended"); askı kalkınca askıdan önce verilmiş belgeler yeniden kabul edilir, askı süresinde
  verilmiş belgeler hiçbir zaman. Askı belgeleri iptal etmez. İptal edilmiş, emekli ve kayıt süresi dolmuş kurum için verilme anı
  kuralı sürer (ele geçirilmede `invalidates_from`). AB çerçevesinin (ARF 3.0 §4.6.5, §6.3.3) askı kuralına geçilir; önceki "askı
  yalnız askı süresinde verilen belgeyi düşürür" kuralı (ADR-0073 K5) bu kadarıyla değişir. Liste kaynağı, zincir kontratı ve
  indeksleyici aynı cevabı verir; cüzdan askıdaki kurumun belgesini silmez, kartta uyarıyla gösterir. Kabul: 2026-11-16.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0014]]", "[[ADR-0048]]", "[[ADR-0073]]", "[[ADR-0084]]", "[[SPEC-API-0001]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[FW-TF-0001]]", "[[FW-RB-0001]]", "[[FW-POL-0001]]"]
---

# Kısaca

Bir kurum (belge veren) güven listesinde askıya alınınca, bugüne kadar yalnız yeni belge vermesi duruyordu; daha önce verdiği
belgeler kabul edilmeye devam ediyordu. AB çerçevesinde ise askıdaki kurumun belgelerine güvenilmez. Bu kararla Tamga da AB gibi
davranır: kurum askıdayken o kurumun hiçbir belgesi kabul edilmez. Askı geçicidir: kurum yeniden etkinleşince askıdan önce
verdiği belgeler yeniden kabul edilir.

# Bağlam

- **Önceki kural.** C1 (`isCredentialAcceptable`) belgenin `iat` anına bakar ([[ADR-0009]] D-BC-3): kurum o anda `ACTIVE`
  olmalıdır. Sonradan gelen askı, emeklilik ya da çıkarma eski belgeleri düşürmüyordu; [[SPEC-BC-0001]]/GV1'in ("çıkarma/çıkış
  mevcut kayıtları ve belgeleri geçersiz kılmaz") geniş okunuşu ve [[ADR-0073]] K5 ("askıdaki kurumun askıdan önceki belgeleri
  geçerlidir") bu kuralı askıya da uyguluyordu.
- **AB kuralı.** ARF 3.0 §4.6.5: belge verenin durumu kayıtlı ⇄ askıda → iptal; askıdaki ya da iptal edilmiş belge verenin
  belgeleri güvenen taraflarca kabul edilmez. §6.3.3: askı ya da iptalde belge verenin erişim sertifikaları iptal edilir; PID,
  QEAA ve PuB-EAA sağlayıcısı listede "Invalid" olur ve doğrulayıcılar o sağlayıcının belgelerine güvenmez; belge veren bütün
  belgelerini iptal eder.
- **Fark.** Aynı belge bir AB cüzdanında ya da doğrulayıcısında reddedilirken Tamga'da kabul ediliyordu; askı, bir olay ya da
  denetim bulgusunun ardından "bu kuruma şimdilik güvenmeyin" demenin aracıdır ve eski kural bu amacı karşılamıyordu.
- **Proje yönetiminin yönü (2026-11-16).** Askıda AB gibi yapılır: kurum askıdayken belgeleri kabul edilmez. İptal ve kayıt
  süresinin dolması için ayrı bir yön verilmedi; bu kayıt yalnız askıyı değiştirir ve ötekiler için kuralı açıkça yazar.

# Karar

## K1 — Askıdaki kurumun belgeleri kabul edilmez

- C1 iki soruyu birlikte sorar: (1) kurum belgenin `iat` anında belge verebilir miydi (önceki kural, değişmedi) ve (2) kurum
  **şu an** (doğrulama anında) askıda mı. İkincisi evetse sonuç `NO`'dur — belgenin ne zaman verildiğine bakılmaz.
- "Şu an askıda" kurumun durum geçmişinden okunur: `since` değeri doğrulama anından önce ya da ona eşit olan son girdi
  `SUSPENDED` ise kurum askıdadır.
- Doğrulayıcının sonucu üç değerli modelde kalır (CMP9): `REJECTED`, `failed_step: "C1"`, `failed_reason: "issuer suspended"`.
  Yeni bir sonuç değeri ya da adım kodu eklenmez. Liste bayatsa sonuç `INDETERMINATE` kalır (CMP4).

## K2 — Askı kalkınca belgeler yeniden kabul edilir; askı iptal değildir

- Kurum yeniden `ACTIVE` olunca askıdan önce verilmiş belgeler yeniden kabul edilir. Askı süresinde verilmiş belge (iat anında
  durum `SUSPENDED`) hiçbir zaman kabul edilmez — önceki kural.
- Askı belgenin iptal listesindeki durumunu değiştirmez; kurum askı yüzünden belgelerini iptal etmez. Askı nedeni belgelerin
  güvenilirliğini kalıcı olarak bozuyorsa (örneğin imza anahtarının sızması) yol [[FW-POL-0001]]'deki gibi kurumun iptali ve
  belgelerin iptalidir.

## K3 — İptal, emeklilik ve sürenin dolması: verilme anı kuralı sürer

| Kurumun durumu | Kural | ARF |
|---|---|---|
| `SUSPENDED` (askı) | **Değişti:** askı sürdükçe bütün belgeler RED; askı kalkınca askıdan öncekiler kabul | §4.6.5: kabul edilmez — uyumlu |
| `REVOKED` (yumuşak iptal, çıkarma) | Değişmedi: iptalden önce verilmiş belgeler kabul (GV1, [[ADR-0002]] #4) | §4.6.5: kabul edilmez — **bilinçli fark** |
| `REVOKED` + `invalidates_from` (ele geçirilme) | Değişmedi: o andan itibaren verilmiş belgeler RED | uyumlu |
| `RETIRED` (gönüllü çıkış) | Değişmedi: önceden verilmiş belgeler kabul | ARF'de karşılığı yok |
| Kayıt süresi doldu (`valid_until`) | Değişmedi: süre içinde verilmiş belgeler kabul | ARF'de karşılığı yok |

İptalde farkın gerekçesi: Tamga'daki belgelerin çoğu (diploma, öğrenim belgesi) kalıcıdır ve kurumun kapanması ya da ağdan
çıkması geçmişte doğru verilmiş belgeyi geçersiz kılmamalıdır; AB'de bu durumda belge verenin belgelerini tek tek iptal etmesi
beklenir, Tamga'da aynı sonuç gerekiyorsa sert iptal (`invalidates_from`) ve belge iptali kullanılır. Askıdaki bir kurum iptal
edilirken iptalin yumuşak mı sert mi olacağı kayıt gerekçesine yazılır: yumuşak iptal askıdan önceki belgeleri yeniden kabul
edilir kılar.

## K4 — Zincir eşdeğerliği

Liste kaynağı ([[SPEC-TRUST-0001]]), kontrat (`IssuerRegistry.isCredentialAcceptable`: kurumun bugünkü durumu `SUSPENDED` ise
`false`) ve indeksleyicinin güven kaynağı aynı kuralı uygular; eşdeğerlik testleri bunu kanıtlar ([[ADR-0073]] K6). Doğrulama
kararı yine yalnız listeden verilir ([[ADR-0084]]). Dış listelerdeki kurumların durumu o listenin kuralıyla değerlendirilir
([[ADR-0036]]); bu karar onları değiştirmez. Kök sertifika makamının askısı bu kararın kapsamı dışındadır (değişmedi).

## K5 — Cüzdan

- Cüzdan askıdaki kurumun belgesini silmez ve kendiliğinden iptal saymaz; kartta "kurum askıda" uyarısıyla gösterir. Askı
  kalkınca uyarı kalkar.
- Askıdaki kurumdan yeni belge alınmaz (C1).
- Belgenin cüzdandaki gösterim durumu çekirdekte hesaplanır (`credentialValidity`, durum `issuer_suspended`); güven listesi
  denetlenemiyorsa uyarı gösterilmez.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Önceki kural (askı yalnız yeni belgeyi durdurur) + gerekçe notu | ret | AB cüzdanı ve doğrulayıcısıyla sonuç ayrışır; askının "şimdilik güvenmeyin" amacını karşılamaz |
| Askıda ret, ayrı sonuç değeri (`SUSPENDED` sonucu) | ret | Üç değerli sonuç modeli (CMP9) ve kayıtlardaki okunuş bozulur; neden alanı yeterli |
| Askıda `INDETERMINATE` | ret | Askı bilinen bir durumdur, "bilinmiyor" değildir; AB "kabul edilmez" der |
| Askı ve iptalde AB gibi (iptalde de bütün belgeler ret) | ret (bu kayıtta) | Kalıcı belgeler (diploma) kurum kapanınca düşerdi; proje yönetimi yalnız askı için yön verdi |
| **Askıda verilme anından bağımsız ret, askı kalkınca kabul; iptalde verilme anı** | **seçildi** | AB askı kuralı; askı geri alınabilir kalır; kalıcı belgeler korunur |

# Değişmezler

| Kod | Kural |
|---|---|
| SI1 | Belge veren kurum doğrulama anında güven listesinde `SUSPENDED` ise o kurumun verdiği hiçbir belge kabul edilmez (C1 `NO`; doğrulayıcı sonucu `REJECTED`, neden "issuer suspended"); belgenin verilme anı sonucu değiştirmez. |
| SI2 | Askı belgeleri iptal etmez: kurum yeniden `ACTIVE` olunca askıdan önce verilmiş belgeler yeniden kabul edilir; askı süresinde verilmiş belge hiçbir zaman kabul edilmez. |
| SI3 | İptal edilmiş (`REVOKED`), emekli (`RETIRED`) ve kayıt süresi dolmuş kurum için verilme anı kuralı sürer: önceden verilmiş belgeler kabul edilir, ele geçirilmede `invalidates_from`'dan itibaren verilmiş belgeler reddedilir. |
| SI4 | Liste kaynağı, zincir kontratı ve zincir güven kaynağı askıda aynı cevabı verir. |

# Sonuçlar

- `packages/trust`: `ListTrustSource.isCredentialAcceptable` askı denetimi; yeni isteğe bağlı `TrustSource.isIssuerSuspended`.
- `packages/verifier`: C1 nedeni "issuer suspended".
- `packages/wallet-core`: `credentialValidity` (`issuer_suspended`), alma sırasında askı iletisi.
- `contracts/`: `IssuerRegistry.isCredentialAcceptable` askıda `false`; `apps/chain-indexer`: aynı kural.
- Belgeler: [[SPEC-API-0001]] §1.1, [[SPEC-BC-0001]] §3.3 ve GV1 notu, [[ADR-0073]] notu; çerçeve belgeleri Ek A §3.3, iptal
  politikası §3.5, Tamga Rulebook, katılım süreci §7.

# Durum

**Accepted — 2026-11-16** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-TRUST-8.
SI1–SI4 bağlayıcıdır.
