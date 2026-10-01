---
document_id: RS-FRAMEWORKS-0001
title: Blockchain Framework Karşılaştırması — Hyperledger Besu (QBFT) vs Cosmos SDK (CometBFT)
category: Research
domain: Blockchain
status: Draft
review_status: Draft
version: 0.1.0
created: 2026-07-29
last_updated: 2026-07-29
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
  - cosmos-sdk
  - qbft
  - cometbft
  - framework-comparison
  - evm
keywords:
  - Hyperledger Besu
  - QBFT
  - Cosmos SDK
  - CometBFT
  - EVM
  - permissioned blockchain
  - single-block finality
  - validator scalability
  - sovereignty
related:
  - PM-BC-0001
  - RS-EBSI-0001
  - ACA-BC-0001
  - ADR-0001
research:
  - RS-EBSI-0001
references:
  - Hyperledger Besu (Apache 2.0, LF Decentralized Trust)
  - Cosmos SDK / CometBFT
summary: >
  Tamga Network'ün blockchain motoru için Hyperledger Besu (QBFT) ile Cosmos SDK
  (CometBFT) çerçevelerini Tamga'nın gereksinimleri (izinli, devlet başına eşit
  güç, anında kesinlik, egemenlik, gelecekte varlık/ödeme, EBSI birlikte
  çalışabilirliği) açısından karşılaştırır. Egemenlik analizi (her iki seçenek de
  tam bağımsız), validator ölçekleme, EVM/akıllı kontrat ve EBSI emsali
  değerlendirilir. Sonuç: Besu (QBFT) önerilir; karar ADR-0001'de kaydedilir.
priority: Critical
---

# Giriş

Bu doküman, [[PM-BC-0001]] kararında bilinçli olarak açık bırakılan **Katman 4 — somut çerçeve/motor** seçimini analiz eder. İki ciddi aday vardır:

1. **Hyperledger Besu** (QBFT consensus ile)
2. **Cosmos SDK** (CometBFT consensus ile)

Amaç, Tamga'nın gereksinimlerine göre birini önermek ve kararı [[ADR-0001]]'e taşımaktır. Temel kavramlar için [[ACA-BC-0001]]'e bakılır.

---

# 1. Kıyas Kriterleri (Tamga Gereksinimleri)

[[PM-BC-0001]] ve [[PM-PH-0001]]'den doğan gereksinimler:

| # | Gereksinim | Kaynak |
|---|-----------|--------|
| G1 | İzinli (permissioned), bilinen validator seti | PM-BC-0001 #2 |
| G2 | Devlet başına **eşit oy gücü** (PoA) | PM-BC-0001 #5 |
| G3 | **Anında (deterministik) kesinlik** | PM-BC-0001, ACA-BC-0001 §6 |
| G4 | **Egemenlik** — kimseye/hiçbir ağa bağlı olmama | PM-PH-0001 |
| G5 | Açık kaynak | PM-BC-0001 #1 |
| G6 | Tek ortak zincir (çok-zincir zorunlu değil) | PM-BC-0001 #3 |
| G7 | Gelecekte varlık/ödeme/saklama (akıllı kontrat) | PM-PH-0001, 2026-07-29 |
| G8 | EBSI ile birlikte çalışabilirlik | RS-EBSI-0001 |

---

# 2. Aday 1 — Hyperledger Besu (QBFT)

## Nedir?
Açık kaynak bir **Ethereum client'ı** (Java). **Apache 2.0** lisanslı, **Linux Foundation (LF Decentralized Trust)** çatısında geliştirilir. Hem Ethereum ana ağına bağlanabilir hem de **tamamen bağımsız, izinli özel ağ** olarak çalışabilir.

## Consensus — QBFT
- Kurumsal düzey için **önerilen** consensus.
- Onaylı **validator'lar** blokları imzalar; blok zincire girmeden önce **2/3+ süper çoğunluk** imzalamalıdır.
- **Single-block finality** (anında kesinlik).
- Validator ekleme/çıkarma: mevcut validator'lar **oylar**.
- PoA ailesindendir; oy gücü validator başına eşittir.

## Akıllı Kontrat — EVM
- **EVM** (Ethereum Virtual Machine) çalıştırır; **Solidity** kontratları destekler; standart **JSON-RPC** sunar.
- Devasa Ethereum geliştirici ekosistemi ve olgun token/varlık kalıpları (ERC-20/721/1155) hazır.

## Artı / Eksi
**Artı:** EVM (varlık/ödeme için ideal — G7), EBSI'nin seçimi (G8), kurumsal izinli odak, olgun araç ekosistemi, tek ağ için basit.
**Eksi:** QBFT klasik BFT olduğundan **~20 validator üstünde zorlanır** (mesaj karmaşıklığı). TPS yüksek yüzler–düşük binler.

---

# 3. Aday 2 — Cosmos SDK (CometBFT)

## Nedir?
Kendi **uygulamaya özel (app-specific) blockchain'ini** kurmak için bir framework (Go). Zincirler arası yerel birlikte çalışabilirlik (**IBC**) ile öne çıkar. CometBFT (eski adıyla Tendermint) consensus motorunu kullanır.

## Consensus — CometBFT
- BFT tabanlı, **anında kesinlik** (<1 sn).
- **200+ validator** destekler — klasik BFT'nin pratik sınırlarının çok ötesinde (daha iyi ölçekleme).
- 2.000+ TPS, optimize edilmişse 10.000+.

## Akıllı Kontrat
- Yerel dil Go (modüller). Akıllı kontrat için **CosmWasm** (Rust) veya **Cosmos EVM** (EVM uyumluluk katmanı) eklenir.
- EVM burada **yerel değil, bir katman** olarak gelir.

## Artı / Eksi
**Artı:** Üstün validator ölçekleme (G2 çok sayıda validatorda), yüksek TPS, egemen çok-zincir + IBC, güçlü özelleştirme.
**Eksi:** EVM yerel değil (varlık/ödeme ekosistemi için ek katman — G7); çok-zincir/IBC avantajı Tamga'nın "tek ortak zincir" (G6) kararında büyük ölçüde gereksiz; öğrenme eğrisi (Go/CosmWasm).

---

# 4. Karşılaştırma Tablosu

| Kriter | Besu (QBFT) | Cosmos SDK (CometBFT) |
|--------|-------------|------------------------|
| İzinli / PoA (G1, G2) | ✅ Yerleşik | ✅ (modüllerle) |
| Anında kesinlik (G3) | ✅ Single-block | ✅ <1 sn |
| Egemenlik (G4) | ✅ Kendi ağ, Apache 2.0 | ✅ Kendi ağ, Apache 2.0 |
| Açık kaynak (G5) | ✅ | ✅ |
| Tek ortak zincir (G6) | ✅ İdeal | ⚠️ Güçlü ama IBC avantajı atıl kalır |
| Akıllı kontrat / varlık (G7) | ✅ **EVM yerel, olgun** | ⚠️ EVM katman olarak |
| EBSI birlikte çalışabilirlik (G8) | ✅ **Aynı yığın** | ⚠️ Farklı yığın |
| Validator ölçekleme | ⚠️ ~20 rahat | ✅ 200+ |
| TPS | Yüzler–binler | 2.000–10.000+ |
| Ekosistem | EVM/Ethereum (devasa) | Cosmos/IBC |

---

# 5. Egemenlik Analizi (Kritik)

Temel kaygı: "Kendi ağımız olsun, kimseye/Ethereum'a bağlı olmayalım." Her iki seçenek de bunu karşılar, ama netleştirelim:

- **Besu ≠ Ethereum ağı.** Besu bir *client yazılımıdır*; özel ağ modunda kendi genesis'i, kendi chain ID'si, kendi validator setiyle çalışır ve Ethereum ana ağına **bağlı değildir.**
- **EVM ≠ ağ bağımlılığı.** EVM bir çalıştırma ortamı standardıdır (işlemci mimarisi gibi); kullanmak seni hiçbir ağa bağlamaz.
- **Lisans:** Apache 2.0 — istenirse fork edilip bağımsız sürdürülebilir. Şirket kilidi yok.

**Sonuç:** Egemenlik açısından iki seçenek de eşdeğerdir; ikisi de "tamamen bizim ağımız" sonucunu verir. Bu kriter belirleyici değildir; belirleyici olan **uyum + gelecek yetenekler + emsaldir.**

---

# 6. Tamga'ya Göre Değerlendirme

Belirleyici üç kriter:

1. **G7 — Gelecek varlık/ödeme yeteneği:** Besu'nun yerel EVM'i, ERC standartlarıyla varlık/transfer/ödeme için doğrudan zemindir. Cosmos'ta bu bir ek katmandır. **Besu lehine.**
2. **G8 — EBSI birlikte çalışabilirliği:** EBSI Besu + IBFT 2.0 kullanır ([[RS-EBSI-0001]]). Aynı yığın, entegrasyon ve öğrenme transferini kolaylaştırır. **Besu lehine.**
3. **G6 — Tek ortak zincir:** Cosmos'un en güçlü kozu (egemen çok-zincir + IBC) Tamga'nın tek-zincir kararında atıl kalır. **Besu lehine (basitlik).**

**Cosmos'un tek üstünlüğü** (validator ölçekleme, yüksek TPS) Tamga için kritik değildir ve aşağıdaki tasarımla giderilir.

---

# 7. Validator Ölçekleme Çözümü

QBFT'nin ~20 validator sınırı, Tamga'nın "devletler + kurumları" modeliyle **çelişmez**; aksine temiz bir ayrım verir:

```text
VALIDATOR (blok imzalar, eşit oy)  =  Devletler
                                       (~6–20; Türk Devletleri Teşkilatı ölçeğinde ideal)

FULL NODE (okur, doğrular, imzalamaz) = Devletlerin güvendiği kurumlar
                                         (banka, üniversite, noter — sınırsız sayıda)
```

- Bu, [[PM-BC-0001]] #5 "devlet başına eşit güç" ilkesini **doğrudan uygular** (yalnızca devletler oy verir, eşit).
- Kurumlar full node olarak ağa katılır, işlemleri doğrular, ama consensus oyu kullanmaz.
- EBSI de ~25-27 node ile bu bantta çalışır; ölçek kanıtlanmıştır.

> Not: İleride validator sayısı devlet düzeyinde büyürse, bu bir **açık ölçek sorusudur** ([[PM-BC-0001]] Gelecek). O noktada IBFT/QBFT ayarları veya bölgesel yapı değerlendirilir.

---

# 8. Öneri

> **Hyperledger Besu, QBFT consensus ile.**

Gerekçe: EVM ile gelecek varlık/ödeme yeteneği (G7), EBSI ile aynı yığın/birlikte çalışabilirlik (G8), tek-zincil basitlik (G6), izinli/eşit-güç/anında-kesinlik gereksinimlerini yerleşik karşılaması (G1–G3), tam egemenlik (G4–G5). Tek dezavantajı (validator ölçekleme) "devletler=validator, kurumlar=full node" tasarımıyla giderilir.

Bu öneri [[ADR-0001]]'de resmi karara bağlanır.

---

# 9. Açık Konular / Kalan Riskler

1. **Validator sayısı büyürse** ölçek stratejisi (PM-BC-0001 Gelecek).
2. **QBFT vs IBFT 2.0:** EBSI IBFT 2.0 kullanıyor; Besu QBFT'yi öneriyor (IBFT 2.0'ın olgunlaşmış hali). İkisi arasında son seçim implementasyon aşamasında netleşir.
3. **Kimlik/kurtarma tasarımı** (cihaz kaybı, şifreli yedek, mahkeme erişimi) — ayrı Project Memory konusu, framework'ten bağımsız.
4. **Performans doğrulaması** — gerçek yük testleri ileride.

---

# 10. Referanslar

## Web Kaynakları (2026-07-29 erişim)
- Hyperledger Besu — LF Decentralized Trust — https://www.lfdecentralizedtrust.org/projects/besu
- Besu QBFT dokümantasyonu — https://besu.hyperledger.org/private-networks/how-to/configure/consensus/qbft
- Besu private networks — https://besu.hyperledger.org/private-networks
- Cosmos vs Hyperledger Besu — https://cosmos.network/blog/cosmos-vs-hyperledger-besu
- Cosmos SDK — https://docs.cosmos.network/
- Consensus mekanizmaları kıyası — https://chainlaunch.dev/blog/blockchain-consensus-mechanisms-compared

---

# İlgili Dokümanlar

- [[PM-BC-0001]] — Blockchain ve validator modeli (Katman 4 bu dokümanla kapanır).
- [[ADR-0001]] — Framework kararı (bu araştırmanın sonucu).
- [[RS-EBSI-0001]] — EBSI'nin Besu + IBFT 2.0 seçimi.
- [[ACA-BC-0001]] — Consensus temelleri.

---

# Durum

**review_status: Draft.** Karşılaştırma ve öneri tamamlandı. Karar [[ADR-0001]]'de "Accepted" olarak kaydedildi. Bu doküman, implementasyon aşamasında (QBFT vs IBFT 2.0 son seçimi, performans testleri) güncellenecektir.
