---
document_id: ADR-0053
title: "Liste çapasında rakip adaylar"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Liste çapası kaydında (TrustListAnchorRegistry) bir sürümü ilk açan yazıcı artık o sürümün verisini kilitleyemez. Aynı sürüm
  için farklı veri reddedilmez; ayrı bir aday olarak kaydedilir ve bir çelişki olayı (`AnchorConflict`) yayar. Bir sürüm, eşik
  kadar farklı ve hâlâ yetkili yazıcının desteklediği ilk aday olunca onaylanır; onaydan sonra kapanır ve değişmez. Her yazıcı bir
  sürüm için yalnız bir adayı destekler; kümeden çıkarılan yazıcının desteği sayılmaz, böylece anahtar döndürme bir işletmeciye iki
  oy vermez; eşik yazıcı sayısını aşacak biçimde ayarlanamaz. ADR-0051 K3'ün son maddesini ve CH4'ü değiştirir; CH1–CH3 ve CH5
  aynen geçerlidir. Kabul: 2026-10-19.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0052]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Bir liste sürümünün zincirdeki özeti, birden çok bağımsız işletmeci aynı özeti gönderince onaylanır. Eski kuralda sürümü ilk açan
yazıcı veriyi belirliyordu: yanlış veriyle açarsa dürüst yazıcıların doğru özeti reddediliyor ve o sürüm hiç onaylanamıyordu. Yeni
kuralda her farklı özet ayrı bir adaydır; eşiği ilk dolduran aday kazanır ve her çelişki herkesin görebileceği bir olay olarak
zincire yazılır.

# Bağlam

- [[ADR-0051]] K3: bir çapa, eşik kadar farklı yazıcı birebir aynı veriyi gönderince onaylıdır; açılmış bir sürüm için farklı
  özet gönderen yazıcı `AnchorMismatch` ile reddedilir ve bu "olaylardan izlenir". CH4 bunu bağlayıcı yapar.
- 2026-10-19 kontrat güvenlik turu (F-05) iki sorun buldu:
  1. **İlk açanın kilidi.** Tek bir yazıcı bir `(listKey, version)` çiftini yanlış veriyle açabilir (gelecekteki sürümleri önceden
     de). Dürüst yazıcıların doğru verisi `AnchorMismatch` ile reddedilir; sürüm hiçbir zaman onaylanamaz ve bunu temizleyen bir
     yol yoktur. Doğrulayıcı `NO` alarmı yerine `UNKNOWN` görür. Eşik ≥ 2 kuralı ([[ADR-0009]] K4) tek işletmecinin onaylı çapa
     üretmesini engeller ama tek işletmecinin onayı **engellemesini** engellemez.
  2. **İz yok.** Ret bir `revert` olduğu için zincirde hiçbir kayıt kalmaz; K3'teki "olaylardan izlenir" sözü kodda karşılıksızdır.
- Aynı tur (F-13) iki küçük kenar durumu da gösterdi: kümeden çıkarılan bir yazıcının eski onayı sayılmaya devam ediyor (anahtarını
  döndüren tek işletmeci aynı sürümü iki kez onaylayabilir) ve eşik yazıcı sayısının üstüne ayarlanabiliyor (hiçbir çapa
  onaylanamaz).
- Zincir bugün yoktur ([[ADR-0009]] K4); kontrat hazırlık kodudur. Değişiklik zincir açılmadan önce yapılır.
- Proje yönetimi 2026-10-19'da güvenlik turunun önerisini onayladı: aynı sürüm için farklı adaylar ayrı tutulur, eşiği ilk dolduran
  kazanır, çelişki olay olarak kaydedilir.

# Karar

## K1 — Rakip adaylar

- Bir `(listKey, version)` ya da `(logKey, seq)` için gönderilen her farklı veri `(contentHash, previousHash, issuedAt)` /
  `(lineHash, ts)` ayrı bir **aday**dır. Açılmış bir sürüm için farklı veri reddedilmez; yeni aday olarak kaydedilir.
- Her yazıcı bir sürüm için yalnız **bir** adayı destekleyebilir (ikinci gönderim `AlreadyConfirmedBy` ile reddedilir). Bir
  yazıcının iki farklı adayı desteklemesi böylece imkânsızdır.
- Sürümün ilk açılışında monotonluk kuralı aynen geçerlidir: yeni sürüm en yüksek **onaylı** sürümün üstünde açılır ([[ADR-0051]]
  CH4'ün ilk yarısı). Açılmış ama onaylanmamış bir sürüme rakip aday eklenebilir.

## K2 — Onay: eşiği ilk dolduran aday

- Bir aday, eşik kadar **farklı ve hâlâ yetkili** yazıcı tarafından desteklenince onaylanır. O anda sürüm kapanır: kayıt kazanan
  adayın verisini taşır, başka aday eklenemez ve onaylı kayıt değişmez, silinmez ([[ADR-0051]] CH4'ün son yarısı aynen).
- Onaydan önce `listAnchor` / `logHead` görünümü sürümü ilk açan adayı gösterir; her adayın güncel destek sayısı ayrı görünümle
  okunur (`listCandidateConfirmations`, `logCandidateConfirmations`, `candidateCount`). Onaysız aday hiçbir sorguda `YES` üretmez.

## K3 — Çelişki olayı

Bir sürüm için ikinci ve sonraki her farklı aday `AnchorConflict(key, versionOrSeq, firstHash, submittedHash, anchorer)` olayını
yayar. Bu olay çift-konuşma alarmıdır: işletmeciler ve indeksleyici onu izler; liste yayıncısı (`trust:chain-submit`) bekleyen
farklı bir aday gördüğünde kendi doğruladığı özeti yine gönderir ve raporunda çelişki uyarısı verir. Çelişkide imzalı liste
geçerlidir ([[ADR-0051]] CH1, değişmez).

## K4 — Yazıcı kümesi değişince

- Kümeden çıkarılan yazıcının desteği hiçbir adayda sayılmaz; destek her gönderimde o anki yetkili yazıcılardan yeniden sayılır.
  Anahtarını döndüren işletmeci (eski anahtar çıkar, yeni anahtar girer) aynı sürüme iki geçerli destek veremez.
- Eşik yazıcı sayısını aşacak biçimde ayarlanamaz (kurulumda ve `setRequiredConfirmations`'ta). Yazıcı çıkarmak eşiğin altına
  düşürebilir; bu yönetim kararıdır ve olaylardan görünür (`AnchorerSet`).
- Üretimde eşiğin en az 2 olması dağıtım disiplini olarak kalır ([[ADR-0051]] K3, değişmez).

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Eski kural (ilk açan veriyi belirler, farklı veri `revert`) | ret | Tek yazıcı bir sürümü kalıcı kilitler; iz kalmaz |
| Bekleyen adayı yönetimin silebilmesi | ret | Silme yetkisi yeni bir saldırı yüzeyi ve Governance oyu gerektirir; rakip aday modeli silmeye gerek bırakmaz |
| Çelişen ilk adayın açanı cezalandırmak (yazıcıyı otomatik çıkarmak) | ret | Hatalı ama dürüst bir yazıcı da çıkarılırdı; çıkarma Governance kararıdır |
| Bir yazıcının birden çok adayı desteklemesi | ret | Tek işletmeci iki farklı özete destek vererek çift konuşmayı kendi içinde gizleyebilirdi |
| Destek sayısını onay anında saklayıp sonradan yeniden saymamak | ret | Anahtar döndürme bir işletmeciye iki oy verir (F-13) |

# Değişmezler

| Kod | Kural |
|---|---|
| AC1 | Açılmış bir çapa sürümü için farklı veri reddedilmez, ayrı aday olarak kaydedilir; her yazıcı bir sürüm için yalnız bir adayı destekler. |
| AC2 | Bir sürüm, eşik kadar farklı ve hâlâ yetkili yazıcının desteklediği ilk aday olunca onaylanır; onaydan sonra kapanır, onaylı kayıt değişmez ve silinmez. |
| AC3 | Bir sürüm için ikinci ve sonraki her farklı aday zincirde çelişki olayı (`AnchorConflict`) yayar. |
| AC4 | Kümeden çıkarılan yazıcının desteği sayılmaz; eşik yazıcı sayısını aşacak biçimde ayarlanamaz. |

# Sonuçlar

- `contracts/src/anchor/TrustListAnchorRegistry.sol`: aday kaydı, çelişki olayı, aday görünümleri; depolama düzeni yalnız sona
  ekleme (`__gap` azaltıldı; `contracts:storage-check` taban çizgisi güncellendi). `AnchorMismatch` hatası kalktı.
- `apps/trust-publisher` `chain-submit`: zincirde bekleyen **farklı** aday artık `CONFLICT` (yazmama) değil, kendi özetini
  gönderme ve uyarı (`CONTEST`); onaylı farklı özet `CONFLICT` olarak kalır. `chain-check` değişmez (yalnız onaylı kayda bakar).
- [[ADR-0051]] K3'ün son maddesi ve CH4 bu ADR'ye atıfla güncellendi; [[SPEC-BC-0001]] §15 sürüm notu.
- DECISIONS: **D-BC-8**.

# Durum

**Accepted — 2026-10-19.** Proje yönetimi onayıyla. DECISIONS: D-BC-8. [[ADR-0051]] K3'ün son maddesini ve CH4'ü değiştirir;
AC1–AC4 bağlayıcıdır.
