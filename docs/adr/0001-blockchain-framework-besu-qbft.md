---
document_id: ADR-0001
title: "Besu QBFT defteri"
status: Active
version: 1.0.0
created: 2026-07-29
last_updated: 2026-10-02
summary: >
  Tamga Network'ün blockchain motoru olarak Hyperledger Besu'nun QBFT consensus
  ile kullanılmasına karar verilmiştir. Gerekçe: yerel EVM (gelecek varlık/ödeme),
  EBSI ile aynı yığın, tek-zincil basitlik, izinli/eşit-güç/anında-kesinlik
  gereksinimlerinin yerleşik karşılanması ve tam egemenlik. Validator ölçekleme
  sınırı "devletler=validator, kurumlar=full node" tasarımıyla giderilir.
domain: Trust
---

# ADR-0001 — Blockchain Framework ve Consensus: Hyperledger Besu (QBFT)

**Durum:** Accepted
**Tarih:** 2026-07-29
**Karar veren:** Tamga Network proje yönetimi

---

# Bağlam (Context)

[[PM-BC-0001]] Tamga'nın kendi egemen, açık kaynak, izinli, devlet başına eşit güçlü, BFT/PoA consensus'lu ağını kurmaya karar verdi; ancak somut çerçeve/motor seçimini (Katman 4) bilinçli olarak açık bıraktı.

[[RS-FRAMEWORKS-0001]] iki adayı karşılaştırdı:
- **Hyperledger Besu** (QBFT)
- **Cosmos SDK** (CometBFT)

Değerlendirme Tamga gereksinimlerine göre yapıldı: izinli, eşit oy, anında kesinlik, egemenlik, tek ortak zincir, gelecekte varlık/ödeme yeteneği, EBSI birlikte çalışabilirliği.

---

# Karar (Decision)

> Tamga Network'ün blockchain motoru **Hyperledger Besu** olacak, **QBFT** consensus ile çalışacaktır.

Alt kararlar:
- Ağ **izinli, bağımsız bir özel ağ** olarak kurulur (kendi genesis, kendi chain ID). Ethereum ana ağına veya başka bir ağa bağlı değildir.
- **Consensus:** QBFT (2/3+ süper çoğunluk, single-block finality). Validator oy gücü eşit (PoA).
- **Validator = devletler; full node = güvenilir kurumlar.** (Ölçekleme ve eşit-güç ilkesi için.)
- **Akıllı kontrat:** EVM / Solidity — gelecek varlık, transfer, ödeme yetenekleri bu katmanda geliştirilir.
- QBFT vs IBFT 2.0 arasındaki nihai ayar implementasyon aşamasında kesinleşir (ADR güncellenebilir).

---

# Gerekçe (Rationale)

1. **Yerel EVM → gelecek yetenekler.** Besu'nun EVM'i, varlık/ödeme/saklama işlevlerini olgun ERC kalıplarıyla doğrudan mümkün kılar (Cosmos'ta bu bir ek katmandır).
2. **EBSI ile aynı yığın.** EBSI, Besu + IBFT 2.0 kullanır ([[RS-EBSI-0001]]). Aynı temel, birlikte çalışabilirliği ve öğrenme transferini kolaylaştırır.
3. **Tek-zincil basitlik.** Cosmos'un çok-zincir/IBC avantajı, Tamga'nın "tek ortak zincir" kararında atıl kalır.
4. **Yerleşik uyum.** İzinli, PoA/eşit-oy, anında kesinlik Besu QBFT'de doğrudan gelir.
5. **Tam egemenlik.** Apache 2.0, kendi ağ, fork edilebilir; hiçbir şirkete/ağa bağımlılık yok.

---

# Sonuçlar (Consequences)

**Olumlu:**
- Varlık/ödeme yol haritası için hazır zemin (EVM).
- EBSI ile teknik yakınlık → interoperability kolaylığı.
- Olgun araç/geliştirici ekosistemi.
- Basit, tek ağ operasyonu.

**Dikkat / maliyet:**
- QBFT ~20 validator üstünde zorlanır → "devletler=validator, kurumlar=full node" tasarımıyla giderildi; devlet sayısı çok büyürse ölçek stratejisi gerekir ([[PM-BC-0001]] Gelecek).
- Java tabanlı operasyon uzmanlığı gerekir.
- TPS Cosmos'tan düşük; ancak güven altyapısı iş yükü için yeterli.

---

# Değerlendirilen Alternatifler

- **Cosmos SDK (CometBFT):** Üstün validator ölçekleme ve TPS; ancak EVM yerel değil, çok-zincir avantajı Tamga'da atıl, EBSI'den farklı yığın. Reddedildi.
- **Sıfırdan consensus:** [[PM-BC-0001]]'de zaten reddedildi (risk, süre, egemenliğe katkısı yok).
- **Ethereum L1/L2 üzerine kurmak:** [[PM-BC-0001]]'de reddedildi (egemenlik kaybı, GDPR yakınlığı).

---

# İlgili Dokümanlar

- [[PM-BC-0001]] — Bu ADR, oradaki açık "Katman 4" kararını kapatır.
- [[RS-FRAMEWORKS-0001]] — Bu kararın dayandığı karşılaştırma.
- [[RS-EBSI-0001]] — EBSI emsali (Besu + IBFT 2.0).
- [[ACA-BC-0001]] — Consensus temelleri.
