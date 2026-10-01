---
document_id: RS-FRAMEWORKS-0002
title: Besu vs Kendi Rust Ağı — Hazır Motor mu, Kendi Zincirimizi Yazmak mı?
category: Research
domain: Blockchain
status: Draft
review_status: Draft
version: 0.1.0
created: 2026-08-05
last_updated: 2026-08-05
authors:
  - Tamga Network Engineering
language: tr
document_type: research
audience:
  - engineers
  - architects
  - ai-agents
stability: Evolutionary
maturity: Developing
tags:
  - hyperledger-besu
  - rust
  - substrate
  - from-scratch
  - framework-comparison
  - sovereignty
keywords:
  - Besu vs Rust
  - custom blockchain
  - Substrate
  - Polkadot SDK
  - Frontier pallet-evm
  - build vs buy
  - progressive decentralization
related:
  - PM-BC-0001
  - ADR-0001
  - RS-FRAMEWORKS-0001
  - ARCH-0001
research:
  - RS-FRAMEWORKS-0001
references:
  - Hyperledger Besu (Apache 2.0)
  - Substrate / Polkadot SDK (Rust)
summary: >
  "Bu işi Hyperledger Besu ile mi yapmalıyız, yoksa kendi Rust ağımızı mı
  yazmalıyız?" sorusunu analiz eder. "Kendi Rust ağı" iki anlama gelir: (a)
  sıfırdan Rust ile consensus/zincir, (b) Substrate/Polkadot SDK (Rust framework)
  ile kendi zinciri. Her ikisini de Tamga gereksinimlerine göre değerlendirir.
  Sonuç: Besu (ADR-0001) korunur; sıfırdan Rust reddedilir (yıllar süren, riskli,
  egemenliğe katkısı olmayan iş); Substrate ciddi ama ikincil alternatiftir
  (EVM yerel değil, EBSI'den farklı yığın). Rust'ın gelecekte hangi koşulda
  yeniden değerlendirileceği tanımlanır.
priority: Critical
---

# Giriş

[[ADR-0001]] blockchain motorunu **Hyperledger Besu (QBFT)** olarak kararlaştırdı;
karşılaştırma [[RS-FRAMEWORKS-0001]]'de Besu vs **Cosmos SDK** üzerineydi. Bu
doküman bir sonraki doğal soruyu yanıtlar:

> **"Bu işi Besu ile mi yapmalıyız, yoksa kendi Rust ağımızı mı yazmalıyız?"**

Amaç, "kendi Rust ağı" seçeneğini ciddiyetle değerlendirip Besu kararını ya
güçlendirmek ya da revize etmektir.

---

# "Kendi Rust Ağı" Ne Demek? — İki Ayrı Seçenek

Bu ifade iki çok farklı şeyi kastedebilir; ayırmak şarttır:

- **(a) Sıfırdan Rust:** consensus, p2p, depolama, EVM/runtime dahil zinciri
  temelinden Rust ile yazmak.
- **(b) Rust framework (Substrate / Polkadot SDK):** hazır, olgun bir Rust
  blockchain iskeleti üzerine kendi izinli zincirini kurmak. (Cosmos SDK'nın Go
  dünyasındaki karşılığının Rust dünyasındaki dengi.)

[[PM-BC-0001]]'in kilit dersini hatırla: **"kendi ağımız" bir egemenlik kararıdır,
"her satırı biz yazalım" kararı değildir.** Bu ayrım burada da belirleyicidir.

---

# Kıyas Kriterleri

[[RS-FRAMEWORKS-0001]] §1'deki Tamga gereksinimleri geçerlidir: G1 izinli/PoA,
G2 devlet başına eşit oy, G3 anında kesinlik, G4 egemenlik, G5 açık kaynak,
G6 tek ortak zincir, G7 gelecekte varlık/ödeme (akıllı kontrat), G8 EBSI birlikte
çalışabilirliği. Ek olarak: **süre, risk, ekip/bakım maliyeti.**

---

# Seçenek (a) — Sıfırdan Rust: Reddedildi

Bu, [[PM-BC-0001]]'de "sıfırdan kendi consensus'umuz" olarak zaten reddedilen
seçeneğin dil (Rust) etiketiyle tekrarıdır.

- **Süre/risk:** üretime hazır, güvenli bir BFT consensus + p2p + depolama + EVM
  yazmak **yıllar** alır ve olgun motorların yıllarca savaş-testinden geçmiş
  güvenliğini kısa sürede yakalayamaz.
- **Egemenliğe katkısı yok:** Egemenlik genesis'i, validator setini ve kuralları
  bizim belirlememizden gelir — motoru kimin yazdığından değil ([[RS-FRAMEWORKS-0001]]
  §5). Sıfırdan yazmak ağı "daha çok bizim" yapmaz.
- **Ödünleşim:** tam kontrol vaadi karşılığında yüksek kırılganlık, uzun süre ve
  büyük ekip. Bir güven altyapısı için bu **kabul edilemez risktir.**

> **Sonuç:** Rust güzel bir dildir; ama "güven altyapısını sıfırdan Rust'la yaz"
> demek, kanıtlanmış bir motoru bırakıp riski ve süreyi büyütmek demektir. Reddedilir.

---

# Seçenek (b) — Substrate / Polkadot SDK (Rust framework)

Bu ciddi bir alternatiftir (Cosmos'un Go'daki konumuna benzer, Rust'ta).

**Artılar:**
- Olgun, üretimde çalışan bir Rust iskeleti; **egemen kendi zincirini** kurmak için
  tasarlanmış (G4 ✅, G5 ✅).
- Güçlü özelleştirme (runtime "pallet"leri), WASM tabanlı upgrade'ler.
- BFT tarzı kesinlik (GRANDPA/BABE) mümkün (G3 ✅).

**Eksiler (Tamga'ya göre belirleyici):**
- **EVM yerel değil (G7).** Varlık/ödeme için `pallet-evm`/**Frontier** (EVM
  uyumluluk katmanı) eklenir — Besu'da EVM **yerel** iken burada bir katmandır.
- **EBSI'den farklı yığın (G8).** EBSI Besu + IBFT 2.0 kullanır; Substrate ile
  ortak zemin/öğrenme transferi kaybolur.
- **Yönetişim/consensus varsayımları** Polkadot'un nominated-PoS/paketli modeline
  yakındır; Tamga'nın "devlet başına eşit oy, izinli PoA" ilkesine (G1, G2) uyarlamak
  ek iş ister.
- **Öğrenme eğrisi ve ekip:** Rust + Substrate runtime uzmanlığı, Besu'nun hazır
  izinli/EVM kurulumuna göre daha derin.
- **Tek-zincir kararında (G6)** Polkadot'un parachain/çok-zincir gücü büyük ölçüde
  atıl kalır (aynen Cosmos/IBC gibi — [[RS-FRAMEWORKS-0001]] §6).

---

# Karşılaştırma Tablosu

| Kriter | Besu (QBFT) | Sıfırdan Rust | Substrate (Rust) |
|--------|-------------|---------------|-------------------|
| İzinli / eşit-oy (G1,G2) | ✅ Yerleşik | ⚠️ Kendin yazarsın | ⚠️ Uyarlanır |
| Anında kesinlik (G3) | ✅ | ⚠️ Kendin | ✅ (GRANDPA) |
| Egemenlik (G4) | ✅ | ✅ | ✅ |
| Açık kaynak (G5) | ✅ Apache 2.0 | ✅ | ✅ |
| Tek ortak zincir (G6) | ✅ İdeal | ✅ | ⚠️ Çok-zincir atıl |
| EVM / varlık (G7) | ✅ **Yerel** | ⚠️ Kendin | ⚠️ Katman (Frontier) |
| EBSI birlikte çalışma (G8) | ✅ **Aynı yığın** | ❌ | ❌ Farklı yığın |
| Süre / risk | ✅ Düşük | ❌ Yıllar / yüksek | ⚠️ Orta-yüksek |
| Ekip/bakım | ✅ Olgun ekosistem | ❌ Büyük | ⚠️ Derin uzmanlık |

---

# Egemenlik Notu (Tekrar Kritik)

Rust ile yazmak, Besu kullanmaktan **daha egemen değildir.** Her üç seçenekte de:
kendi genesis, kendi chain ID, kendi validator seti, fork edilebilir açık kaynak.
Egemenlik dil/motor seçiminden değil, **ağın kimin tarafından tanımlandığından**
gelir ([[RS-FRAMEWORKS-0001]] §5, [[PM-BC-0001]] Kritik Ayrım).

---

# Öneri

> **Hyperledger Besu (QBFT) korunur** ([[ADR-0001]] geçerli).

- **Sıfırdan Rust reddedilir** (yıllar, risk, egemenliğe katkı yok).
- **Substrate ikincil alternatiftir** ama G7 (yerel EVM) ve G8 (EBSI aynı yığın)
  belirleyici kriterlerinde Besu'nun gerisinde kalır; Tamga'nın tek-zincil/izinli/
  eşit-oy profiline Besu daha doğrudan oturur.

Bu, "kendi ağımız olsun" sezgisini **reddetmez**; aksine onu doğru
katmanda karşılar: Besu ile ağ zaten tamamen bizimdir (Faz 0'da validator'ları biz
çalıştırırız — [[ARCH-0001]] §3), fakat motoru sıfırdan yazma riskine girmeyiz.

---

# Gelecekte Rust'ı Yeniden Değerlendirme Koşulları

Karar dondurulmuş değildir. Şu koşullardan biri doğarsa Substrate/Rust yeniden
değerlendirilmelidir:

1. **EVM'den vazgeçilmesi** (varlık/ödeme yol haritası düşerse EVM avantajı zayıflar).
2. **EBSI hizasının stratejik olarak terk edilmesi.**
3. **Aşırı ölçek/performans** ihtiyacı (çok sayıda validator + yüksek TPS) —
   ki bu Cosmos tarafında da bir argümandı ([[RS-FRAMEWORKS-0001]] §7).
4. **WASM tabanlı özel runtime** gereksinimi (EVM dışı yürütme modeli).

Bu koşullar bugün geçerli değildir.

---

# İlgili Dokümanlar

- [[ADR-0001]] — Besu + QBFT kararı (geçerli).
- [[RS-FRAMEWORKS-0001]] — Besu vs Cosmos (birincil karşılaştırma).
- [[PM-BC-0001]] — "kendi ağ ≠ sıfırdan yazmak" ilkesi.
- [[ARCH-0001]] — Fazlı validator modeli (ağ zaten Faz 0'da bizimdir).

---

# Durum

**review_status: Draft.** Besu vs Rust analizi tamamlandı; öneri Besu'yu korur.
Karar değişmediğinden yeni bir ADR gerekmez; [[ADR-0001]] geçerlidir. Rust'ın
gelecekte hangi koşulda yeniden değerlendirileceği kayıt altına alındı.
