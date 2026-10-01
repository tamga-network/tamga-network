---
document_id: PM-TRUST-0001
title: On-Chain / Off-Chain Sınırı — Zincire Ne Yazılır, Ne Yazılmaz
category: Trust
domain: Trust
status: Draft
review_status: Draft
version: 0.1.0
created: 2026-07-29
last_updated: 2026-07-29
authors:
  - Tamga Network Engineering
language: tr
document_type: project-memory
audience:
  - engineers
  - architects
  - ai-agents
stability: Stable
maturity: Developing
tags:
  - trust
  - on-chain
  - off-chain
  - privacy
  - gdpr
  - data-minimization
keywords:
  - on-chain off-chain boundary
  - GDPR right to erasure
  - immutability
  - personal data
  - trust registry
  - unlinkable revocation
  - data minimization
related:
  - PM-BC-0001
  - RS-EIDAS-0001
  - RS-EBSI-0001
research:
  - RS-EIDAS-0001
  - RS-EBSI-0001
references:
  - GDPR (Regulation (EU) 2016/679)
  - EBSI Verifiable Data Registry model
  - eIDAS 2.0 ARF
summary: >
  Tamga Network'te zincire hangi verinin yazılıp hangisinin yazılmayacağını
  karara bağlar. Temel ilke: zincir yalnızca kişisel OLMAYAN güven verisini
  (issuer DID'leri, anahtarlar, akreditasyonlar, şemalar, yönetişim) tutar;
  bireysel credential ve kişisel veri asla değiştirilemez deftere yazılmaz.
  GDPR silinme hakkı ↔ immutability çatışmasını ve bireyi tekilleştirebilen
  hash'lerin bile risklerini gerekçelendirir. PM-BC-0001'in tamamlayıcısıdır.
priority: Critical
---

# Giriş

Bu doküman, Tamga Network'ün güven altyapısına ilişkin en temel veri kararını kaydeder: **zincire (blockchain) hangi veri yazılır, hangisi yazılmaz?**

Bu karar [[PM-BC-0001]]'in doğrudan tamamlayıcısıdır. PM-BC-0001 "ağı kim kurar ve doğrular" sorusunu; bu doküman "o ağa ne yazılır" sorusunu cevaplar. İkisi birlikte Tamga'nın blockchain temelini oluşturur.

Karar, [[RS-EIDAS-0001]] (§7, GDPR) ve [[RS-EBSI-0001]] (§5, on-chain/off-chain tablosu) bulgularına dayanır.

---

# Problem

Tamga'nın başlangıç sezgilerinden biri "credential'ları hash'leyip işlemleri ağa yazmak"tı. Bu sezgi kısmen doğru, kısmen tehlikelidir ve disipline edilmelidir.

İki temel gerçek çatışır:

1. **Blockchain değiştirilemezdir (immutable).** Bir kez yazılan veri silinemez — güvenin kaynağı budur.
2. **GDPR silinme hakkı (right to erasure) verir.** Bir birey, kendisiyle ilgili kişisel verinin silinmesini talep edebilir.

Bu ikisi doğrudan çatışır: **kişisel veri değiştirilemez bir deftere yazılırsa, silinme hakkı fiziksel olarak yerine getirilemez.** Bu bir yazılım hatası değil, **yasal ve mimari bir duvardır.**

Dolayısıyla "neyi zincire yazacağımız" gelişigüzel bir tercih değil, uyumun temelidir.

---

# Karar

**Temel ilke:**

> Tamga zinciri yalnızca **kişisel OLMAYAN güven verisini** tutar. Bireysel credential ve kişisel veri **asla** zincire yazılmaz; kullanıcının cüzdanında (holder) tutulur.

Zincirin cevapladığı soru "bu belge nedir / kime ait" değil, **"bu belgeyi veren kurum güvenilir mi, anahtarı geçerli mi"**dir.

---

# On-Chain / Off-Chain Tablosu (Tamga)

Bu tablo, [[RS-EBSI-0001]] §5'teki EBSI modelinin Tamga'ya uyarlanmış halidir ve bağlayıcı referanstır.

| Zincirde (On-Chain) ✅ | Zincir Dışında (Off-Chain) ❌ |
|------------------------|-------------------------------|
| Kurum/issuer DID'leri ve public anahtarları | Bireysel Verifiable Credential'lar (belgenin kendisi) |
| Trusted Issuers Registry (kim güvenilir issuer + akreditasyonlar) | Kişisel veri (kimlik bilgileri, belge içeriği) |
| Trusted Schemas Registry (credential şemaları) | Gerçek kişilerin DID'leri (kullanıcı cüzdanında) |
| Trust anchor / kök otorite kayıtları | Bireysel credential hash'leri (ilişkilendirilebilir ise) |
| Yönetişim kayıtları (validator seti, oylama, roles/attributes) | İmza işlemlerinin kişisel detayları |
| İptal/durum — **yalnızca mahremiyet korumalı (unlinkable) biçimde** | Holder cüzdanındaki her şey |

---

# İlkeler

1. **Veri minimizasyonu.** Zincire yalnızca doğrulama için **zorunlu** olan, kişisel olmayan veri yazılır. Şüphe varsa yazma.
2. **Kişisel veri asla immutable deftere gitmez.** GDPR silinme hakkı bunu gerektirir.
3. **İlişkilendirilebilir hash bile risklidir.** Bir bireyi tekilleştirebilen (singling out) veya ona geri bağlanabilen hiçbir şey — hash olsa bile — zincire yazılmaz. Hash, GDPR açısından hâlâ "pseudonymized personal data" sayılabilir.
4. **Kullanıcı belgeyi elinde tutar (holder-centric).** Zincir belgeyi saklamaz; belgeyi verenin yetkisini/anahtarını saklar. Doğrulama, cüzdandaki belge + zincirdeki güven kaydı ile yapılır.
5. **İptal mahremiyet-öncelikli tasarlanır.** Naif "on-chain iptal listesi" gizli bir izleme aracına dönüşebilir (bkz. [[RS-EIDAS-0001]] §6 linking tehdidi). İptal, unlinkable mekanizmalarla (ör. randomize status list, cascaded Bloom filter) yapılır.

---

# Gerekçe

## GDPR ↔ Immutability
Kişisel verinin (ve çoğu zaman hash'inin) değiştirilemez deftere yazılması silinme hakkını ihlal eder. Bu, düzenleyiciler (ör. İspanya AEPD) ve topluluk tarafından eIDAS/EUDI bağlamında açıkça işaretlenmiştir ([[RS-EIDAS-0001]] §7).

## Emsal Doğrulaması
Hem EUDI (Trusted List + holder cüzdanı) hem EBSI (Verifiable Data Registry) **aynı sınırı** çizer: kişisel veri off-chain, güven kaydı on-chain. EBSI'de gerçek kişiler `did:key` ile zincire hiç yazılmaz; yalnızca kurumlar `did:ebsi` ile zincirdedir ([[RS-EBSI-0001]] §4–5). Tamga bu kanıtlanmış sınırı benimser.

## "Credentials hashleme" fikrinin doğru hali
Başlangıç sezgisi yanlış değildi, sadece yanlış nesneyi hedefliyordu. Zincire yazılan **bireyin belgesi/hash'i değil**, o belgeyi **verenin yetkisi ve anahtarıdır**. Bütünlük kanıtı gerekiyorsa, bireysel hash yerine mahremiyet korumalı toplu yapılar (salted commitment, Merkle root) değerlendirilir — bu bir açık tasarım sorusudur (aşağıya bkz.).

---

# Değerlendirilen Alternatifler

## Tam credential'ı zincire yazmak — Reddedildi
Kişisel veriyi doğrudan immutable deftere yazar. GDPR ihlali, mahremiyet felaketi.

## Her credential'ın hash'ini zincire yazmak — Reddedildi (naif haliyle)
İlk bakışta "veri değil, hash" gibi görünse de; ilişkilendirilebilir hash pseudonymized kişisel veridir, immutability ile çatışır ve issuer+RP işbirliğiyle izleme (linking) sağlayabilir. Yalnızca unlinkable/aggregate tasarımlarla ve bireyi tekilleştirmeyen biçimde düşünülebilir.

## Hiçbir şeyi zincire yazmamak — Reddedildi
O zaman blockchain'in bir anlamı kalmaz. Kişisel olmayan güven verisi (kim güvenilir, hangi anahtar) zincirde tutulur; değer buradadır.

---

# Sonuçlar ve Ödünleşimler

**Kazançlar:**
- GDPR ve EUDI/EBSI uyumu için sağlam zemin.
- Mahremiyet: birey zincirde görünmez.
- Silinme hakkı korunur (kişisel veri cüzdanda, silinebilir).

**Maliyetler / dikkat gerektirenler:**
- Off-chain verinin bütünlüğü ve erişilebilirliği ayrıca çözülmelidir (cüzdan yedekleme, kurtarma).
- "Bütünlük kanıtı" isteyen senaryolarda (belge sahteciliğe karşı) mahremiyet korumalı anchoring tasarımı gerekir — kolay değildir.
- İptal mekanizmasının unlinkable olması ek mühendislik yükü getirir.

---

# Açık Sorular

1. **Anchoring tasarımı:** Belge bütünlüğü/varlık kanıtı gerektiğinde, bireyi tekilleştirmeden (salted commitment, Merkle root, ZKP) nasıl yapılır? → ileride SPEC-TRUST.
2. **İptal (revocation):** Hangi unlinkable mekanizma (status list, Bloom filter, ZKP tabanlı)? → RS-REVOCATION-0001 (planlı).
3. **Off-chain veri katmanı:** Credential'lar nerede, nasıl saklanır (cüzdan, opsiyonel yedek)? → ileride ARCH/SPEC.
4. **Denetlenebilirlik (auditability):** Kişisel veri olmadan, güven olaylarının denetlenebilir kanıta dönüşü nasıl sağlanır?

---

# İlişkiler / İlgili Dokümanlar

- [[PM-BC-0001]] — Blockchain ve validator modeli. **Bu kararın ikizi.**
- [[RS-EIDAS-0001]] — GDPR/immutability çatışması (§7), iptal mahremiyeti (§6).
- [[RS-EBSI-0001]] — On-chain/off-chain emsal tablosu (§5), did:ebsi vs did:key (§4).
- [[PM-PH-0001]] (planlı) — Genel felsefe ve Türk dünyası konumlandırması.
- SPEC-TRUST (planlı) — Anchoring ve registry teknik spesifikasyonu.

---

# Durum

**review_status: Draft.** Temel sınır karara bağlandı. Teknik ayrıntılar (anchoring, unlinkable revocation, off-chain saklama) açık sorular olarak bırakıldı ve ayrı spesifikasyon/araştırma dokümanlarına havale edildi. PM-BC-0001 ile birlikte gözden geçirilip birlikte `Completed`'a taşınmalıdır.
