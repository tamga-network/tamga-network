---
document_id: ADR-0022
title: "Kimlik servisinin sınıfı"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Tamga kimlik servisi güven listesinde QUALIFIED / I3 yerine nitelikli olmayan EAA / I2 olarak kaydedilir; kimlik belgesi
  `category` claim'i taşımaz. "Nitelikli" AB'de bağımsız uygunluk değerlendirmesi ve denetim kurumu gözetimi gerektiren hukuki bir
  unvandır; Tamga bunu henüz karşılamıyor. Bağımsız değerlendirmeden sonra yeniden yükseltilebilir. ADR-0011'in sınıf satırını
  değiştirir.
domain: Identity
---

# Bağlam

[[ADR-0011]] Tamga kimlik servisini [[t:trust-list|güven listesinde]] `class: QUALIFIED`, `assurance: I3` olarak kaydetti; kimlik belgesine
`category: urn:tamga:eaa:qualified` yazılıyor ve şema bunu sabit istiyor.

AB boşluk analizi (2026-09-29) ve 27 Eylül kod kıyası (bulgu K5) şunu gösterdi:

- [[t:eIDAS]] 2.0'da "nitelikli" ([[t:QEAA]] / [[t:QTSP]]) hukuki bir unvandır. Bağımsız bir uygunluk değerlendirme kuruluşunun denetimini ve
  denetim kurumunun gözetimini gerektirir.
- [[FW-TF-0001]] I3'ü "bağımsız değerlendirme" şartına bağlar.
- Tamga hem liste operatörü hem kayıt kuruluşu hem kimlik servisidir. Kendini en üst sınıfa kendisi kaydetmiştir; bağımsız
  değerlendirme yoktur. Uzaktan kimlik doğrulama sağlayıcısının ETSI TS 119 461 uygunluğu beyan düzeyindedir.

Bu durum AB tarafıyla konuşurken abartılı bir iddia olarak okunur; hukuki ve itibar riski taşır.

# Karar

## K1 — Sınıf ve güvence

Tamga kimlik servisi güven listesinde **`class: EAA`** (nitelikli olmayan elektronik öznitelik belgesi, [[t:EAA]]) ve **`assurance: I2`**
olarak kaydedilir.

## K2 — Belgede kategori yok

Kimlik belgesi (`urn:tamga:id:IdentityAttestation:1`) `category` claim'i taşımaz ([[ADR-0010]] K5: kategori yalnızca PUB /
QUALIFIED [[t:issuer|belge verenler]] için). Şema metadata'sındaki asgari belge veren güvencesi I3'ten I2'ye iner.

## K3 — Kullanan politikalar

Kimlik belgesini isteyen politikalar (kurumların kimlik eşleştirmesi, örnek siteler) asgari belge veren güvencesini **I2** ister.

Kimlik doğrulamanın kendisi değişmez:
- belge + canlılık + yüz eşleştirmesi,
- isteğe bağlı NFC çip okuma,
- HMAC'li belge özeti.

Yalnızca güven listesindeki etiket gerçeğe uyar.

## K4 — Yeniden yükseltme

Bağımsız bir uygunluk değerlendirmesi (ETSI TS 119 461 / TS 119 471 çerçevesinde) ve [[FW-TF-0001]] I3 şartları
karşılandığında sınıf yeni bir ADR ile yükseltilir.

## K5 — Pilot öncesi yerinde düzeltme

Şema 1.0.0 metadata'sı pilot öncesi olduğu için yerinde düzeltilir (2026-09-29 İngilizce düzeltmesiyle aynı tek seferlik istisna).
Mevcut test kimlik belgeleri yeniden alınır. Pilotta D1 değişmezliği aynen geçerlidir.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| QUALIFIED / I3'te kalmak | ret | Bağımsız değerlendirme yok; AB anlamında "nitelikli" iddiası karşılanamaz |
| QUALIFIED, I2 | ret | Sınıf adı yine AB'deki hukuki unvanla karışır |
| **EAA, I2** | **kabul** | Gerçek durumu anlatır; AB'de nitelikli olmayan EAA herkesçe verilebilir |
| EAA, I1 | ret | Kimlik doğrulama ve anahtar yönetimi I2 şartlarını karşılıyor |

# Değişmezler

| Kod | Kural |
|---|---|
| IDC1 | Tamga'nın kendi işlettiği bir hizmet, bağımsız uygunluk değerlendirmesi olmadan güven listesinde QUALIFIED ya da I3 olarak kaydedilmez. |
| IDC2 | Kimlik belgesi `category` claim'i taşımaz; sınıf yükseltilene kadar hiçbir politika kimlik belgesi için I3 istemez. |

# Sonuçlar

- `apps/trust-publisher/registry/tl-tr.source.json`: `tamga-id` → `class: EAA`, `assurance: I2`.
- `packages/schemas`: IdentityAttestation `category` alanı kalkar, `min_issuer_assurance: I2` (1.0.0 yerinde).
- `apps/id` (operatör deposu): kimlik belgesinde `category` yazılmaz. `apps/issuer`: kimlik eşleştirme politikası I2.
- [[ADR-0011]] sınıf satırı, [[SPEC-ID-0003]], [[FW-RB-0001]] RB-AP-ID-04 ve Identity Rulebook güncellenir.

# Durum

**Accepted — 2026-09-29.** Proje yönetimi onayıyla. DECISIONS: D-ID-7.
