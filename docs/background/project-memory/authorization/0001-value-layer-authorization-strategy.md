---
document_id: PM-AUTH-0001
title: Değer Katmanı Stratejisi — Yetkilendirme Katmanı, Mutabakat Değil
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-02
summary: >
  Tamga'nın ileride ödeme/varlık işlemlerine dönüşüp dönüşmeyeceği sorusuna stratejik
  cevap: özelliği değil, kancaları inşa et. Tamga bir YETKİLENDİRME (authorization)
  katmanıdır — "kim, ne yapmaya, hangi limitle, hangi credential'la yetkili"yi
  kanıtlar — MUTABAKAT (settlement) katmanı DEĞİLDİR; para bankalarda/CBDC'de kalır.
  Bu konum üç ağır riski (merkez bankası çatışması, çok-yargı lisans yükü, sansür
  paradoksu) bertaraf eder ve "uyumlu ama bağımsız" konumlandırmayı güçlendirir.
  Doküman: üç katman ayrışması, doğrulanabilir-ama-görünmez adres bağı, işlem-grafiği
  mahremiyeti açık sorusu, agent yetkilendirme, 4 aşamalı zamanlama ve whitepaper
  formülasyonu. Bağlayıcı mimari kancalar → ADR-0003.
---

# PM-AUTH-0001 — Değer Katmanı Stratejisi

Kaynak: `docs/tamga-network-varlik-katmani-strateji.md` +
`docs/tamga-network-cuzdan-odeme-agent.md` (stratejik girdi taslakları) —
bu doküman o taslakları mevcut mimariye eritir ve resmileştirir.

---

# Soru

Tamga ileride ödeme, varlık tutma, transfer ve agent işlemleri yapabilen bir
altyapıya dönüşmeli mi — ve bugün hangi kararlar alınmalı ki o kapı açık kalsın,
ama çekirdek kimlik projesi boğulmasın?

---

# Karar: Yetkilendirme Katmanı Ol, Mutabakat Katmanı Değil

**Bugün özelliği inşa etme; bugün kancaları inşa et.** Bu kapıyı kapatmak ağın en
büyük değer önerisini kapatır; hemen açmak ise kimlikten **düzeyce farklı** bir
düzenleyici ve siyasi yük getirir ve çekirdek projeyi boğar. Doğru üçüncü yol:

Bir ödeme iki ayrı şeydir:

- **Yetkilendirme (authorization):** "Bu kişi/agent bu ödemeyi yapmaya yetkili mi?
  Kimliği doğrulandı mı? Limit içinde mi? Yaptırım listesinde mi?"
- **Mutabakat (settlement):** Paranın fiilen el değiştirmesi.

Tamga'nın doğal gücü **yetkilendirmededir**. Mutabakat başkalarının (bankalar,
merkez bankaları, stablecoin/CBDC ihraççıları) işidir.

```
Tamga = kim, ne yapmaya yetkili, hangi limitle, hangi credential'la
   ↓ (yetkilendirme kanıtı)
Mutabakat rayı = banka / CBDC / stablecoin — mevcut ve düzenlenmiş
```

**Getiri:** Değerin ~%80'i (agent yetkilendirme, KYC/AML, kurumsal imza yetkisi,
escrow tetikleyicileri), yükün ~%20'si. Merkez bankaları hazır olduğunda tokenize
mevduatı Tamga üzerinde ihraç etmek isterlerse kapı zaten açıktır — çünkü kancalar
konmuştur (→ [[ADR-0003]]).

---

# Neden Mutabakata Girmiyoruz

| Risk | Açıklama |
|---|---|
| **Merkez bankası engeli** | Beş ülkenin para politikası otoritesiyle aynı anda müzakere. Kimlik projesi olarak destek görürüz; para projesi olarak rakip görülürüz. |
| **Lisans yükü** | Değer tutan/transfer eden sistem, beş yargı alanında ödeme kuruluşu / e-para / VASP lisansı gerektirir. Her biri ayrı sermaye yeterliliği + denetim. |
| **Sansür paradoksu** | Validator'lar devlet ise bir transferi teorik olarak bloke edebilir. Kimlikte kabul edilebilir (bir diploma doğrulanamaz, olur); parada kabul edilemez ve tam da hedeflenen sınır-ötesi ticareti öldürür. |

**Sansür paradoksu kritik:** Validator modeli (devletler) kimlik için doğru, para
için yanlış. Aynı ağda ikisini birden mutabakat düzeyinde yapmak, birinin tasarım
gücünü diğerinin zafiyetine çevirir. Bu, mutabakata girmemenin *mimari* gerekçesidir
— sadece siyasi değil.

---

# Üç Katman, Üç Tanımlayıcı

Değer katmanı, kimlik tanımlayıcısından ayrı bir hesap modeli gerektirir:

| Katman | İşlev | Tamga karşılığı | Sahip |
|---|---|---|---|
| **A. Zincir hesabı** | Değer tutar, işlem imzalar, kontrat çağırır | **EVM adresi** (secp256k1) | Vatandaş / kurum / agent |
| **B. Kurumsal kimlik** | "Bu kurum kim, güvenilir mi?" | Kurumsal tanımlayıcı + `issuerId` | Yalnızca kurumlar |
| **C. Kişisel kimlik** | "Bu belge kime ait?" | Credential (SD-JWT VC) + pairwise pseudonym | Vatandaş (yalnızca cihazında) |

**Kritik:** A katmanı (EVM hesabı) **X.509 vs DID kararından ([[DECISIONS]] D-ID-1)
bağımsızdır** — Besu EVM olduğu için hesap modeli her hâlükârda Ethereum standardıdır.
Yani değer katmanı kancaları D-ID-1 beklenmeden kilitlenebilir. X.509/DID tartışması
yalnızca **B katmanını** ilgilendirir (bkz. SPEC-ID-0001, D-ID-1).

**Vatandaşa küresel tanımlayıcı verilmez** (bilinçli). Sabit bir global ID, kişinin
sağlık/eğitim/lojistik/ödeme işlemlerini tek ipe dizerdi. Pairwise pseudonym bunu
yapısal olarak engeller ([[PM-ID-0002]], SPEC-ID-0001).

---

# Çoklu Adres: Doğrulanabilir Ama Görünmez Bağ

Holder'ın birden çok cüzdan adresi olabilir — **ama zincirde kimliğe bağlanmaz.**

**Yanlış model:** `kullanıcı kimliği → [adres1, adres2]` (zincirde, herkese açık) → devletçe
doğrulanmış kimliğe bağlı, herkesin gördüğü ödeme adresleri = sıradan kripto
cüzdanından **daha kötü** bir gözetim aracı. Geri dönüşü yok.

**Doğru model:** Adres kimliğe zincirde bağlanmaz; holder gerektiğinde **belirli bir
doğrulayıcıya, belirli amaç için** kanıt üretir: "bu adresi kontrol eden kişi
doğrulanmış bir Tamga kimliğine sahiptir ve [18+ / lisanslı lojistik firması /
yaptırım listesinde değil]." Adresten kimliğe gidilemez; bağı yalnızca guardian
mekanizması hukuki süreçte çözer ([[SPEC-BC-0002]]). Bu, KYC/AML uyumu ile mahremiyeti
aynı anda sağlar ve genel amaçlı kripto altyapılarının çözemediği asıl farklılaştırıcıdır.

---

# Açık Sorun: İşlem-Grafiği Mahremiyeti (kritik)

Yukarıdaki model adres↔kimlik bağını çözer; ancak **izinli zincirde validator'lar
(devletler) her adresin tüm işlem grafiğini görür** — kimliğe bağlı olmasa bile.
Kimlikte bu kabul edilebilir; **düzenli ödeme trafiğinde bir gözetim yüzeyi** olur.
"Adres kimliğe bağlı değil" tek başına yeterli değildir.

**Mevcut değerlendirme:** Aşama 2 modeli ("para banka sisteminde kalır, zincirde
yalnızca tetikleyici/yükümlülük") bu riski doğal olarak azalttığı için tercih edilir.
On-chain mutabakata (Aşama 3+) geçilmeden önce işlem-grafiği mahremiyeti (confidential
transactions / gizli bakiye / off-chain mutabakat) ayrı bir araştırmayla çözülmelidir.
→ [[DECISIONS]] D-AUTH-1.

---

# Agent Yetkilendirme (özet)

Agent'ın **kendi kimliği yoktur, türetilmiş yetkisi vardır**; her zaman bir velinin
uzantısıdır. Sektör bu yöne gidiyor (x402 / HTTP 402 tabanlı agent ödeme protokolü;
Cloudflare'in Ağustos 2026 programlanabilir cüzdan duyurusu — iki katmanlı
veli-cüzdan → agent-delegasyon modeli). **Tamga'nın farkı:** veli, ticari bir hesap
değil, **devletin doğruladığı bir kimliktir** — kesintisiz hukuki sorumluluk zinciri.
Hiçbir ticari platform bunu sunamaz; bu muhtemelen en güçlü farklılaştırıcıdır.

Model: **veli kontrat cüzdanı → süreli, kapsamlı, anında iptal edilebilir delegasyon.**
Tam kontrat/protokol yüzeyi → **SPEC-AGENT-0001** (planlı). Bağlayıcı ilkeler → [[ADR-0003]].

---

# Aşamalı Zamanlama

| Faz | Ne yapılır | Değer katmanı |
|---|---|---|
| **Faz 0 (şimdi)** | [[ADR-0003]] 5 kancasını uygula | Ödeme özelliği yok; kancalar hazır |
| **Faz 1** | Kimlik + belge doğrulama; **lojistik pilotu (parasız)** — konşimento, menşe, yetki doğrulaması | Yok; ama credential-gating + delegasyon çalışıyor |
| **Faz 2** | Agent delegasyonu (ödeme-dışı kapsam) + **escrow tetikleyicileri** ("teslim edildi credential → banka ödemeyi serbest bırakır") | Para bankada; Tamga tetikleyici |
| **Faz 3** | Yetkilendirme katmanı olarak dış ödeme raylarına entegrasyon | Tamga hâlâ para tutmaz |
| **Faz 4 (koşullu)** | Bir merkez bankası/lisanslı banka tokenize mevduatı Tamga'da ihraç ederse — **ev sahipliği** | Yalnızca dış talep gelirse |

**Faz 4'e ancak dışarıdan talep gelirse geç. Kendin zorlama.** Kimlik altyapısı
olgunlaşıp gerçek hacim oluştuğunda talep muhtemelen kendiliğinden gelir — ve pazarlık
pozisyonu çok daha güçlü olur.

---

# Risk Değerlendirmesi

| Risk | Ağırlık | Not |
|---|---|---|
| Teknik karmaşıklık | Düşük | EVM'de ödeme çözülmüş problem; asıl zorluk kurtarma+anahtar yönetimi (kimlik için zaten çözülüyor) |
| Düzenleyici yük | Yüksek | "Yetkilendirme katmanı" konumu riskin büyük kısmını kaldırır |
| Siyasi risk | Yüksek | Kendi token'ı olmayan/ihraççı olmayan konum yönetilebilir kılar |
| **Odak kaybı** | **En yüksek** | Asıl risk. Beş devletli kimlik altyapısı zaten olağanüstü iddialı. Ödemeyi erken açmak anlatıyı bulanıklaştırır ("kimlik mi kripto mu?") |

Devletlerle "dijital kimlik altyapısı" ile "kripto ödeme ağı" **tamamen farklı iki
toplantıdır** (biri bakanlıkla, diğeri merkez bankası + mali suçlar birimiyle). Aynı
anda ikisini yürütmek ikisini de yavaşlatır. Bu yüzden kısa vade **parasız** kalır.

---

# Whitepaper Formülasyonu

> Tamga Network kendi para birimi ihraç etmez ve bir ödeme sistemi değildir. Ağın
> işlevi değeri taşımak değil, değer hareketinin **yetkilendirilmesini** sağlamaktır:
> işlemi başlatan tarafın doğrulanmış kimliği, kurumsal temsil yetkisi, düzenleyici
> uygunluğu ve — otomatik ajanlar söz konusuysa — sorumlu gerçek kişiye bağlılığı.
> Mutabakat, mevcut ve düzenlenmiş raylarda gerçekleşir. Mimari, ileride üye
> devletlerin yetkili kurumlarının tokenize varlık ihraç etmesine teknik olarak imkân
> verecek şekilde tasarlanmıştır; ancak bu yetki münhasıran ilgili devletin
> yetkilendirdiği finansal kurumlara aittir ve ağ hiçbir koşulda ihraççı konumunda
> değildir.

---

# Açık Sorular

1. **İşlem-grafiği mahremiyeti** (yukarıda) — Aşama 3 öncesi çözülmeli. → [[DECISIONS]] D-AUTH-1, RS-PRIVACY (planlı).
2. **Varlık cüzdanı kurtarma kompozisyonu** — kullanıcı-seçimli + devlet opsiyonel kararı verildi (bkz. [[ADR-0003]] Karar 2); somut M-of-N ve zaman kilidi → PM-ID-0003.
3. **Agent delegasyon kontratı** tam yüzeyi → SPEC-AGENT-0001 (planlı).
4. **FINANCE issuer akreditasyonu** (token ihraç izni kime) → PM-GOV-0001.

---

# İlişkiler ve Durum

- [[PM-PH-0001]] — "uyumlu ama bağımsız", genişleme kapsamı (bu doküman D-STR-2'yi somutlaştırır).
- [[PM-TRUST-0001]] — kişisel/ilişkilendirilebilir veri zincirde değil (işlem-grafiği sorusunun temeli).
- [[ADR-0001]] — Besu/EVM (değer katmanını "eklenecek" değil "zaten var" kılan).
- [[ADR-0002]] — egemenlik-öncelikli yönetişim (FINANCE issuer izni, sansür paradoksu).
- [[ADR-0003]] — bu stratejinin 5 bağlayıcı mimari kancası.
- [[SPEC-BC-0002]] — accountable disclosure (adres↔kimlik bağını hukuki süreçte çözer).
- Kaynak: `docs/tamga-network-varlik-katmani-strateji.md`, `docs/tamga-network-cuzdan-odeme-agent.md`.

Strateji karara bağlandı (2026-08-06): yetkilendirme
katmanı, mutabakat değil; kancalar bugün, özellik değil; kısa vade parasız. Bağlayıcı
mimari kısıtlar [[ADR-0003]]'e ayrıldı. İşlem-grafiği mahremiyeti açık bırakıldı.
