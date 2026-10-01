---
document_id: PM-BC-0001
title: Blockchain Seçimi ve Validator Modeli
category: Blockchain
domain: Blockchain
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
stability: Evolutionary
maturity: Developing
tags:
  - blockchain
  - validator
  - consensus
  - permissioned
  - governance
keywords:
  - permissioned blockchain
  - proof of authority
  - BFT consensus
  - equal voting power
  - sovereign chain
  - founding consortium
  - EBSI
related:
  - RS-EIDAS-0001
  - PM-TRUST-0001
  - PM-PH-0001
research:
  - RS-EIDAS-0001
references:
  - EBSI — European Blockchain Services Infrastructure
  - Cosmos SDK / CometBFT
  - Hyperledger Besu (QBFT)
summary: >
  Tamga Network'ün blockchain katmanına ilişkin temel kararı kaydeder:
  kendi egemen, açık kaynak, izinli (permissioned) tek ortak zinciri;
  validator'ların devletler + güvendikleri kurumlar olması; her devletin
  eşit oy gücü; kurucu konsorsiyum + on-chain oylamayla yönetişim; ve
  BFT/PoA consensus ailesi. "Kendi ağımız" ile "consensus'u sıfırdan yazmak"
  arasındaki kritik ayrımı netleştirir. Somut çerçeve seçimi (Cosmos SDK vs
  Besu) açık karar olarak bırakılır.
priority: Critical
---

# Giriş

Bu doküman, Tamga Network'ün blockchain katmanına ilişkin **temel mühendislik kararını ve gerekçesini** kaydeder. Bir Project Memory dokümanıdır: yalnızca "ne seçtik" değil, **neden seçtik, hangi alternatifleri elediğimiz ve ödünleşimler** burada korunur.

Karar, [[RS-EIDAS-0001]] araştırmasının bulguları ve proje yönetimiyle yapılan tasarım tartışması (2026-07-29) üzerine alınmıştır.

---

# Problem

Tamga Network bir **Digital Trust Infrastructure**'dır. Blockchain bu altyapının merkezi değil, yalnızca güven katmanıdır. Buna rağmen birçok temel soru cevapsızdı:

- Kendi ağımızı mı kuralım, mevcut bir zincirin (ör. Ethereum) üzerine mi çıkalım?
- Ağı kim çalıştırır, kim doğrular (validator)?
- Devletler bu ağa nasıl güvenir ve nasıl kontrol eder?
- "Kendi ağımızı kodlamak" ne demek — consensus'u sıfırdan mı yazacağız?
- Zincire ne yazılır?

Bu doküman ilk üç ve dördüncü soruyu karara bağlar. "Zincire ne yazılır" sorusu ayrı bir kararda ele alınır: [[PM-TRUST-0001]].

---

# Karar

Aşağıdaki noktalar **karara bağlanmıştır** (2026-07-29):

1. **Kendi egemen ağımız.** Tamga, mevcut bir kamu zincirinin (Ethereum vb.) üzerine değil, **kendi bağımsız, açık kaynak zinciri** olarak kurulur. Gerekçe: devletlerin, kontrolü başka bir ağa/topluluğa bağlı olmayan bir altyapı istemesi beklenir. Egemenlik ve güven bunu gerektirir.

2. **İzinli (permissioned) ağ.** Ağa herkes validator olarak katılamaz. Validator olmak yetki (authority) ve onay gerektirir.

3. **Tek ortak global zincir.** Her ülkeye ayrı zincir yerine, tüm katılımcı devletlerin birlikte doğruladığı **tek ortak Tamga zinciri** kurulur. (Not: Bu, ilerideki ölçek ihtiyaçlarına göre gözden geçirilebilir; bkz. Gelecek.)

4. **Validator = Devletler + güvendikleri kurumlar.** Ana otorite devletlerdir. Devletler ayrıca kendi güvendikleri kurumlara (bankalar, üniversiteler, noterler, QTSP'ler) validator node açtırıp işlem doğrulatabilir.

5. **Her devletin eşit gücü.** Ağdaki oy gücü servet/stake ile ağırlıklandırılmaz. **Bir devlet = eşit ağırlık.** Bu, "zengin/büyük olan daha çok kontrol eder" durumunu engeller ve devletler arası eşitliği korur. (Kurumlar node açsa da eşit-güç ilkesi devlet düzeyinde tanımlanır.)

6. **Yönetişim: Kurucu konsorsiyum + on-chain oylama.** Başta bir kurucu güven grubu; yeni ülkelerin katılımı, validator ekleme/çıkarma ve protokol kararları zamanla **zincir üstü oylamayla** genişletilir.
   > **İnceltme (2026-08-05, [[ADR-0002]]):** On-chain oylama YALNIZCA ağa üyelik
   > (Katman 1: kim validator olur) için geçerlidir. Ulusal kayıtlar (issuer, relying
   > party) ve sınır-ötesi tanıma **oylanmaz** — egemenlik-öncelikli model. Bkz. [[ADR-0002]].

7. **Müşteri görmez.** Blockchain arka planda çalışan güven katmanıdır; son kullanıcı doğrudan zincirle etkileşmez (cüzdan ücreti, zincir seçimi vb. yok).

---

# Kritik Ayrım: "Kendi Ağımız" ≠ "Consensus'u Sıfırdan Yazmak"

Tartışmada ortaya çıkan en önemli kavramsal düğüm budur ve kalıcı olarak netleştirilmelidir.

**"Kendi ağımız olsun" bir egemenlik/kontrol kararıdır, bir "her satırı biz yazalım" kararı değildir.**

Kararın katmanlarını ayıralım:

| Katman | Ne demek | Durum |
|--------|----------|-------|
| 1. Egemenlik | Ağ bize ait, genesis'i ve validator setini biz belirleriz | ✅ Karar: Evet, kendi bağımsız ağımız |
| 2. Erişim modeli | İzinli (permissioned) mi, izinsiz mi | ✅ Karar: İzinli |
| 3. Consensus ailesi | Hangi tür mutabakat (BFT/PoA, PoW, PoS...) | ✅ Karar (ilke): İzinli BFT / PoA, eşit oy, anında kesinlik |
| 4. Somut çerçeve/motor | Cosmos SDK/CometBFT mi, Besu/QBFT mi, başka mı | ✅ **KARAR: Hyperledger Besu (QBFT)** — bkz. [[ADR-0001]] (2026-07-29) |
| 5. Uygulama ayarları | Kaç validator, blok süresi, upgrade kuralları | ⬜ Sonra |

**Önemli sonuç:** Kendi egemen ağımızı kurmak için consensus'u sıfırdan yazmamız **gerekmez.** CometBFT veya Besu gibi kanıtlanmış bir consensus motorunu **kütüphane** olarak kullanıp, onun üzerine kendi kurallarımızı (kim validator olur, ne yazılır, nasıl yönetilir) koyarak **tamamen bize ait, bağımsız bir ağ** elde ederiz.

- Cosmos SDK kullanmak = "Cosmos'un ağına bağlanmak" **değildir**; kendi zincirini kurmak için bir araç setidir.
- Sıfırdan consensus yazmak, ağı "daha çok bizim" yapmaz; sadece daha kırılgan ve yıllarca süren bir iş yapar. Egemenliğe katkısı yoktur.

Bu nedenle **şu an bir consensus algoritması seçmiyoruz; consensus'un gereksinimlerini/ailesini belirliyoruz.** Somut motor seçimi, çerçeve karşılaştırmasından sonra ADR ile yapılacaktır.

---

# Consensus Modeli (İlke)

Yukarıdaki kararlardan consensus için şu gereksinimler doğar:

- **İzinli, bilinen validator seti** → Nakamoto (PoW) ve serbest PoS elenir.
- **Eşit oy gücü (devlet başına)** → stake-ağırlıklı model elenir; bu bir **Proof of Authority (PoA)** yaklaşımıdır.
- **Anında kesinlik (instant finality)** → işlem doğrulanınca geri alınamaz; bu **BFT** tarzı mutabakat gerektirir (Tendermint/CometBFT ailesi veya QBFT/IBFT).
- **Yüksek güven, orta ölçekli node sayısı** (onlarca devlet + kurum) → BFT bu ölçekte idealdir.

**Özet:** Tamga'nın consensus ailesi = **İzinli BFT / Proof of Authority, devlet başına eşit oy, anında kesinlik.**

Not: Arşivdeki (önceki araştırma, `_archive/solidus-workspace/`) consensus çalışması
(CometBFT, HotStuff, Hedera) bu kararın girdisidir ve `docs/research/` altına
taşınıp güncellenmelidir (bkz. [[WORKSPACE-AUDIT-0001]] migration backlog).

---

# Değerlendirilen Alternatifler

## Ethereum / L2 üzerine kurmak — Reddedildi
Hazır ekosistem ve güvenlik sağlar; ancak ağın kontrolü Ethereum topluluğuna/ekonomisine bağlı kalır, işlem ücretleri dışa bağımlıdır ve devletlerin egemenlik beklentisiyle çelişir. Ayrıca kamu zincirine kişisel veri yakınlığı GDPR açısından risklidir (bkz. [[RS-EIDAS-0001]] §7).

## İzinsiz (permissionless) ağ — Reddedildi
Herkesin validator olabildiği model, trust ve regülasyon zeminine (devletlerin güvencesi) uymaz.

## Sıfırdan kendi consensus'umuz — Reddedildi (şimdilik)
Tam kontrol vaat eder ama yıllar sürer, güvenlik açısından risklidir ve egemenliğe ek fayda sağlamaz. Kanıtlanmış bir motor üzerine kendi ağımızı kurmak daha akılcıdır.

## Stake-ağırlıklı PoS — Reddedildi
Ekonomik güce göre kontrol dağıtır; devletler arası eşitlik ilkesiyle çelişir.

---

# Emsal: EBSI (European Blockchain Services Infrastructure)

Tamga'nın seçtiği model teorik değildir; AB'de **zaten uygulanan ve 2026 Q4'te üretime alınması planlanan** bir modeldir. EBSI, Tamga için en yakın emsaldir:

- **Public permissioned blockchain** — kişisel veri değil, sınır ötesi güven hizmetleri (SSI, diploma, noterlik, sosyal güvenlik, sağlık) için.
- **25–27 eşit yetkili validator node** — AB/EEA devletleri ve akredite ortaklar tarafından çalıştırılır → **devlet başına eşit güç** (Tamga kararı #5 ile aynı).
- Node operatörleri bir yönetişim gövdesi (**EUROPEUM-EDIC**) tarafından onaylanır + hukuki pakete uyar → **kurucu konsorsiyum + onaya dayalı katılım** (Tamga kararı #6 ile aynı).
- **eIDAS / EUDI ile hizalı** — doğrulanabilir credential ve DID altyapısı.

> Bu emsal, tasarım sezgisini güçlü biçimde doğrular: "kendi izinli ağ, devletler eşit node, konsorsiyumla yönetim" hayal değil, çalışan bir mimaridir. EBSI'nin teknik yığını (tarihsel olarak izinli Ethereum/Besu tabanlı) ayrı bir araştırma dokümanında incelenmelidir: **RS-EBSI-0001 (planlı).**

---

# Ödünleşimler ve Sonuçlar

**Kazançlar:**
- Egemenlik ve kontrol devletlerde.
- Regülasyon/GDPR uyumu için esneklik (izinli, kişisel veri off-chain).
- Eşit güç → jeopolitik denge.
- Kanıtlanmış motor → daha hızlı ve güvenli başlangıç.

**Maliyetler / riskler:**
- Tek ortak zincir, çok sayıda devlet katıldıkça ölçek/gecikme baskısı yaratabilir (BFT node sayısıyla iletişim maliyeti artar).
- Kurucu konsorsiyumun ilk kompozisyonu hassas bir güven/politika meselesidir.
- İzinli ağ, "gerçekten merkeziyetsiz mi" eleştirisine açıktır; bu, hedef kitleye (devletler) göre bilinçli bir tercihtir.
- Node operatörlerinin akreditasyonu ve SLA'sı ciddi bir operasyonel yük getirir.

---

# Gelecek / Açık Kararlar

Bu kararla kapanmayan, sıradaki adımlar:

1. ~~**Somut çerçeve seçimi**~~ → ✅ **KAPANDI:** Hyperledger Besu (QBFT) seçildi. Karşılaştırma [[RS-FRAMEWORKS-0001]], karar [[ADR-0001]] (2026-07-29). Validator=devletler, full node=kurumlar.
2. **EBSI derin incelemesi:** teknik yığın, node modeli, EUDI ilişkisi → **RS-EBSI-0001 (planlı)**.
3. **Eşit-güç mekaniği:** eşit oy gücünün teknik uygulanışı (validator ağırlıkları, kurum node'larının rolü).
4. **Ölçek stratejisi:** çok sayıda devlet için tek zincirin sınırları; ileride bölgesel/katmanlı model gerekebilir.
5. **Yönetişim detayları:** kurucu konsorsiyum kompozisyonu, oylama kuralları → **PM-GOV-0001 (planlı)**.

---

# İlişkiler / İlgili Dokümanlar

- [[RS-EIDAS-0001]] — eIDAS/EUDI zemini; blockchain'in trust katmanı olarak sınırlı rolü (§7).
- [[PM-TRUST-0001]] — Zincire ne yazılır/yazılmaz (GDPR sınırı). **Bu kararın tamamlayıcısı.**
- [[PM-PH-0001]] — Digital Trust Infrastructure felsefesi ve EUDI konumlandırması.
- RS-FRAMEWORKS-0001 (planlı) — Cosmos vs Besu.
- RS-EBSI-0001 (planlı) — EBSI derin inceleme.
- PM-GOV-0001 (planlı) — Yönetişim modeli.

---

# Durum

**review_status: Draft.** Temel yön karara bağlandı; somut çerçeve (Katman 4) bilinçli olarak açık bırakıldı ve araştırma + ADR bekliyor. Açık kararlar (Gelecek bölümü) ilgili dokümanlara dönüştükçe bu doküman `Completed`'a taşınacaktır.
