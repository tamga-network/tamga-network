---
document_id: ARCH-0002
title: "Besu ağı kurulumu"
status: Draft
version: 1.0.0
created: 2026-08-05
last_updated: 2026-10-02
summary: >
  "Hyperledger Besu ile ağ kurmak ne demek?" sorusunu adım adım, somut olarak
  yanıtlar: chain ID/genesis, QBFT validator anahtarları ve extraData, bootnode,
  node başlatma, izinli erişim (permissioning allowlist), Trust Registry EVM
  kontratlarının deploy'u, Tamga Wallet/issuer entegrasyonu, testnet→mainnet, ve fazlı
  validator devri (vakıf→devlet). Detaylı config/ABI'lar sonraki Specification
  dokümanlarına bırakılır; bu doküman referans kurulum akışını verir.
---

# Giriş

Bu doküman [[ARCH-0001]]'de tanımlanan ağ mimarisini **Hyperledger Besu üzerinde
nasıl kurarız** sorusunu adım adım yanıtlar. "Besu ile yapmak" soyut bir tercih
değil, aşağıdaki somut adımlar dizisidir.

Amaç: bir mühendis (veya AI ajanı) bu dokümanı izleyerek Faz 0 (vakıf) ağını ayağa
kaldırabilmeli; kesin config alanları ve kontrat arayüzleri ileride Specification
dokümanlarında (SPEC-BC-*) kesinleşecektir.

> **"Besu ile yapmak" özeti:** Besu, kendi genesis'i + kendi chain ID'si + kendi
> onaylı validator setiyle çalışan **bağımsız bir Ethereum-client ağıdır**. Biz
> Ethereum'a bağlanmıyoruz; Besu'yu bir *motor* olarak kullanıp üstüne kendi izinli
> ağımızı ve güven kontratlarımızı koyuyoruz ([[RS-FRAMEWORKS-0001]] §5).

---

# Ön Koşullar

- **Java 21+** (Besu JVM tabanlıdır).
- **Hyperledger Besu** ikilisi (Apache 2.0).
- Anahtar/araçlar için Besu'nun `operator` alt komutları.
- Node başına: statik IP/DNS, açık P2P portu (varsayılan 30303), RPC portu (8545).
- Konteynerleştirme için Docker (opsiyonel, önerilir).

---

# Adım Adım

## 1. Ağ kimliğini belirle
- **Chain ID** seç (Ethereum ana ağından ayrık, çakışmayan bir değer — ör. özel bir
  Tamga chain ID). Bu, ağın Ethereum'a bağlı **olmadığını** garanti eder.
- Ağ adı, blok süresi (ör. 2–5 sn) ve gaz politikası (izinli ağda ücretsiz/sabit)
  kararlaştırılır.

## 2. Validator anahtarlarını üret (Faz 0: 4 validator)
- Her validator için node anahtar çifti üret. Adresler QBFT oy setini oluşturur.
- Faz 0'da **4 validator = Tamga vakfı** (QBFT'de 3f+1 → f=1: bir node arızalansa
  ağ çalışır). Anahtarlar HSM/kasada saklanır.

## 3. Genesis'i oluştur (QBFT)
- `genesis.json`: chain ID, QBFT consensus config (blok süresi, epoch), başlangıç
  bakiyeleri (izinli ağda genelde 0/teknik), ve **`extraData`** alanına Faz 0
  validator adreslerini RLP kodlamasıyla göm.
- QBFT vs IBFT 2.0 son ayarı ([[RS-FRAMEWORKS-0001]] §9) bu aşamada netleşir.

## 4. Bootnode / statik peer'ler
- Node'ların birbirini bulması için bootnode(lar) veya statik peer listesi tanımla.
- Faz 0'da 4 node birbirine statik bağlanır.

## 5. Validator node'larını başlat
- Her node'u genesis + QBFT config + kendi anahtarıyla başlat.
- Node'lar el sıkışıp QBFT round'larına girer; 2/3+ (yani 4'te ≥3) imzayla bloklar
  kesinleşir (single-block finality).

## 6. İzinli erişimi uygula (Permissioning)
- **Node permissioning:** yalnızca onaylı node'lar bağlanabilir (allowlist).
- **Account permissioning:** yalnızca onaylı hesaplar işlem/deploy yapabilir.
- Bu, [[PM-BC-0001]] #2 "izinli ağ" ilkesinin teknik uygulamasıdır. On-chain
  permissioning kontratı (upgrade edilebilir) tercih edilir.

## 7. Trust Registry kontratlarını deploy et
- EVM/Solidity ile [[ARCH-0001]] §5'teki kayıtları deploy et:
  **Issuer Registry, Key Registry, Revocation (Bitstring Status List ref), Schema
  Registry.**
- Yönetim (kim issuer ekler/akredite eder) başta vakıf multisig, sonra devlet
  yönetişimi (Faz 1) ile genişler.
- Detaylı ABI/arayüz → **SPEC-BC-0001 (planlı).**

## 8. Uygulama entegrasyonu (Tamga Wallet + issuer)
- Tamga Wallet ve issuer servisleri **JSON-RPC** ile Trust Registry'yi okur.
- Doğrulama akışı: Verifier, credential imzasını + Trust Registry'den issuer
  anahtarı/durumunu kontrol eder (kaynağa gitmeden — [[ARCH-0001]] §5).

## 9. Testnet → Mainnet
- Önce **testnet**: aynı topoloji, sıfırlanabilir; pilotlar (ilk üniversite diploma
  issuer'ı, Tamga Wallet) burada denenir.
- Kriterler karşılanınca **mainnet** genesis dondurulur ve üretim başlar.

## 10. Faz geçişi — validator devri (vakıf → devlet)
- Devlet katılınca: QBFT **validator ekleme oylaması** ile devlet node'u sete
  eklenir; vakıf node'ları kademeli **çıkarılır** (oylama).
- Bu bir **oy-gücü devridir**, ağ kesintisi değildir (set çalışırken güncellenir).
- Hedef: consensus gücünün devletlere geçmesi ([[ARCH-0001]] §3, Faz 1).

## 11. Operasyon, izleme, yedekleme
- Metrik/log (Prometheus/Grafana), SLA, otomatik yeniden başlatma.
- Anahtar rotasyonu, felaket kurtarma, node bakımı prosedürleri.
- Güvenlik sertleştirme referansı: depo kökündeki `security.sh` yaklaşımı.

---

# Güvenlik Notları

- Validator anahtarları **HSM/kasa**; tek node ele geçse f=1 toleransı korur.
- Permissioning kontratının yönetim anahtarı çoklu-imza olmalı.
- Kişisel veri asla zincire yazılmaz ([[PM-TRUST-0001]]); kontratlar yalnızca DID,
  anahtar, akreditasyon, iptal, şema tutar.
- Tüm kriptografik/operasyonel tasarım **bağımsız güvenlik denetimi** gerektirir
  (üretim önkoşulu).

---

# Açık Konular

1. QBFT vs IBFT 2.0 kesin seçimi (EBSI IBFT 2.0 kullanır — RS-EBSI-0001).
2. Blok süresi / gaz politikası kesin değerleri.
3. Permissioning: on-chain kontrat vs dosya tabanlı (öneri: on-chain, yönetilebilir).
4. Trust Registry kontrat arayüzleri → SPEC-BC-0001.
5. Faz geçiş eşikleri → [[PM-GOV-0001]] (planlı).

---

# İlgili Dokümanlar

- [[ARCH-0001]] — Ağ mimarisi (bu kurulumun tanımladığı yapı).
- [[ADR-0001]] — Besu + QBFT kararı.
- [[PM-BC-0001]] — Validator modeli ve izinli ağ ilkesi.
- [[RS-FRAMEWORKS-0001]] — Besu neden seçildi (Cosmos karşılaştırması).
- [[RS-FRAMEWORKS-0002]] — Besu vs kendi Rust ağı.

---

# Durum

**Taslak** — sürüm 1.0.0 (2026-10-02).

