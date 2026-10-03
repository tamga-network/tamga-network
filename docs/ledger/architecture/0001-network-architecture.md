---
document_id: ARCH-0001
title: "Ağ topolojisi (zincir aşaması)"
status: Draft
version: 1.0.0
created: 2026-08-05
last_updated: 2026-10-02
summary: >
  Tamga Network'ün ağ mimarisini tanımlar: izinli tek ortak zincir (Hyperledger
  Besu + QBFT), node rolleri (validator = devletler, full node = kurumlar,
  observer/RPC), ve zamanla merkeziyetsizleşen FAZLI validator modeli — Faz 0'da
  ağı Tamga Network vakfı çalıştırır, Faz 1'de devletler validator olur, Faz 2'de
  kurumlar full node olarak katılır. On-chain/off-chain sınırı ve Trust Registry
  bileşeni ile Besu'ya somut eşleme (genesis, QBFT validator seti, permissioning,
  EVM kontratları) burada standartlaştırılır.
---

# Giriş

Bu doküman Tamga Network'ün **ağ mimarisini** ("sistem ne?") tanımlar. Kararların
*nedeni* [[PM-BC-0001]] ve [[ADR-0001]]'de; teknik *nasıl* (genesis şeması,
kontrat arayüzleri) ilgili Specification dokümanlarındadır. Burada mimari resim
ve fazlı işletim modeli standartlaştırılır.

Temel çerçeve kararı [[ADR-0001]] ile verildi: **Hyperledger Besu + QBFT**, izinli
bağımsız tek ortak zincir. Bu doküman o kararın **ağ topolojisine, node rollerine
ve zaman içindeki devir modeline** dönüşümüdür.

---

# Problem

[[PM-BC-0001]] "validator = devletler + güvendikleri kurumlar, devlet başına eşit
güç" ilkesini kaydetti. Ancak pratikte kritik bir boşluk vardı:

- **Ağı en başta kim çalıştırır?** Henüz hiçbir devlet katılmamışken ağ nasıl
  ayağa kalkar? "Devletler validator" ilkesi 1. günden geçerli olamaz.
- **Node rolleri teknik olarak nasıl ayrışır** (kim imzalar, kim yalnızca okur)?
- **Güç zamanla nasıl devredilir** — biz kurup sonra devletlere bırakırken ağ
  nasıl merkeziyetsizleşir (progressive decentralization)?
- **Bunların Besu üzerindeki somut karşılığı** nedir?

Bu doküman bu dört soruyu ağ mimarisi düzeyinde yanıtlar.

---

# Mimari

## 1. Katmanlı Görünüm

Tamga Network dört mantıksal katmandan oluşur; blockchain bunlardan yalnızca
biridir (merkez değil, güven katmanı — [[PM-PH-0001]]):

```text
┌──────────────────────────────────────────────────────────────┐
│  Uygulama Katmanı   Tamga Wallet + sektör uygulamaları         │
│                     (Education, Health, Payments, Logistics)   │
├──────────────────────────────────────────────────────────────┤
│  Kimlik Katmanı     DID, Verifiable Credential, SD-JWT,        │
│                     seçici ifşa (Issuer–Holder–Verifier)       │
├──────────────────────────────────────────────────────────────┤
│  Güven Kayıt (Trust Registry)                                  │
│                     issuer DID'leri, açık anahtarlar,          │
│                     akreditasyon, iptal, şema — ON-CHAIN       │
├──────────────────────────────────────────────────────────────┤
│  Blockchain Katmanı Hyperledger Besu + QBFT (izinli, tek zincir)│
│                     değiştirilemez güven kaydı + EVM           │
└──────────────────────────────────────────────────────────────┘
```

Kişisel veri ve credential içerikleri **hiçbir zaman zincirde değildir**
([[PM-TRUST-0001]]); zincir yalnızca **güvenin doğrulanabilirliğini** taşır.

## 2. Node Rolleri

QBFT'nin doğal ayrımı, Tamga'nın yönetişim ilkesine birebir oturur:

| Rol | Kim | Yetki | Consensus oyu |
|-----|-----|-------|---------------|
| **Validator** | Devletler (Faz 0'da: Tamga vakfı) | Blok önerir/imzalar | ✅ Eşit oy (devlet başına 1) |
| **Full node** | Güvenilir kurumlar (banka, üniversite, noter, QTSP) | Tüm zinciri tutar, doğrular, RPC sunar | ❌ İmzalamaz |
| **Observer / RPC** | Uygulamalar, doğrulayıcılar, denetçiler | Okur, sorgular | ❌ |

- **Validator seti küçük ve bilinir** (QBFT ~4–20 arası ideal; EBSI ~25-27 ile
  çalışır — [[RS-EBSI-0001]]). Eşit oy ilkesi ([[PM-BC-0001]] #5) burada uygulanır.
- **Full node sayısı sınırsızdır**; kurumlar consensus'a katılmadan ağı bağımsız
  doğrular. Bu, "kurumlar node açar ama güç devlette kalır" ilkesini teknik olarak
  garanti eder.

## 3. Fazlı Validator Modeli (Progressive Decentralization)

En kritik mimari karar: **ağ 1. günde devletlerle başlamaz; kontrol zamanla,
şeffaf ve taahhütlü biçimde devredilir.** Üç faz:

### Faz B — Zincirsiz beta ([[ADR-0009]], 2026-09-24)
- **Validator yok; güven çapası = imzalı, sürümlü, hash-zincirli güven listeleri** (`lotl.jws`, `tl-<cc>.jws`)
  + saatlik çapa günlüğü (`anchors.jsonl`) — ETSI TS 119 612 / EUDI modeli; operatör Tamga (`provisional`,
  `on_behalf_of`). Format: [[SPEC-TRUST-0001]]. Okuma arayüzü `TrustSource` iki fazda aynıdır (CMP1).
- **Neden:** tek operatörün işlettiği 4 QBFT node'u, imzalı listeden fazla güven üretmez (F1); zincir imzacı sayısı
  1'den büyüğe çıkınca değer üretir.
- **TDT-first:** her yapı üye devlet slotlarıyla; devir yalnızca `operator` alanını değiştirir (D-GOV-5).
- **Çıkış:** ≥2 bağımsız validator operatörünün yazılı kabulü → Faz 0; liste geçmişi kontratlara replay edilir,
  eşdeğerlik testi (`conformance/`) geçer (K7).

### Faz 0 — Bootstrap / Vakıf Fazı (biz)
- **Giriş koşulu (ADR-0009 K4, D-GOV-2 başlangıç eşiği):** en az iki hukuken ve operasyonel olarak bağımsız
  validator operatörü (Tamga + ikinci üniversite / oda / devlet kurumu) yazılı kabul vermiş olmalıdır.
- **Validator'lar = Tamga Network'ün kendisi** (kurucu vakıf/ekip). Coğrafi/operasyonel
  olarak dağıtık, ör. **4 validator** node (QBFT'de 3f+1 → f=1 tolerans).
- Amaç: ağı ayağa kaldırmak, **testnet → mainnet**, ilk kurumsal pilotlar
  (Tamga Wallet, ilk üniversite/diploma issuer'ı), Trust Registry kontratlarını yaymak.
- **Şeffaflık taahhüdü:** bu faz geçicidir; validator seti, genesis ve devir
  planı herkese açıktır. Güç bizde ama **kilitli değil** — devir sözleşmesi baştan
  yazılır (bkz. Governance geçişi).
- Yönetişim: kurucu (foundation) kararı; validator ekleme/çıkarma multisig ile.
- **Güven kaynağı = devletsiz bootstrap ([[PM-ASSUR-0001]]).** Bu fazda henüz PID
  Provider (devlet) yoktur; holder assurance mevcut Türk kurumlarından **devralınır**
  (e-imza/NES=T3, banka/GSM=T1, uzaktan KYC / kurum kayıt masası=T2) ve issuer'lar
  Tamga tarafından geçici Root TAO rolüyle akredite edilir (I1–I3). Yani Faz 0 ağı
  "boş" değildir; devletler gelmeden de gerçek assurance üretir ve işlem yapar.

### Faz 1 — Devlet Katılımı
- Devletler (ilk hedef: **Türkiye**, ardından Türk Devletleri Teşkilatı üyeleri)
  **validator** olarak katılır.
- Tamga vakfı, devletler katıldıkça **kendi validator sayısını azaltır** ve
  nihayetinde consensus gücünü devletlere devreder. Geçiş bir **oy-gücü devri**dir,
  ağ kesintisi değil (QBFT validator seti oylanarak güncellenir).
- **Devlet başına eşit oy** ([[PM-BC-0001]] #5) tam olarak bu fazda anlam kazanır.
- Vakıf, isterse bir süre **tek başına yeter-onay veremeyen** azınlık validator
  olarak kalır (ör. yalnızca operasyonel süreklilik için), sonra tamamen çıkar.

### Faz 2 — Kurumsal Genişleme
- Devletlerin güvendiği kurumlar **full node** olarak katılır (imzalamaz, doğrular).
- Validator seti devletlerde kalır; kurumlar ağı bağımsız doğrulayarak **şeffaflığı
  ve dayanıklılığı** artırır.
- Dikey platformlar (Education, Health, Payments, Logistics) bu zemin üstünde issuer
  olarak çalışır.

```text
Faz 0            Faz 1                     Faz 2
[Tamga x4]  →    [Tamga x1 + Devlet x N]  →  [Devlet x N validator]
                                             [Kurum x M full node]
güç: bizde       güç: paylaşımlı, devrediliyor   güç: devletlerde
```

> **İlke:** Merkezîlik bir **başlangıç zorunluluğudur, bir hedef değildir.**
> Devir planı ve şeffaflık, "izinli ağ gerçekten merkeziyetsiz mi?" eleştirisine
> ([[PM-BC-0001]] Ödünleşimler) verilen mimari cevaptır.

## 4. On-Chain / Off-Chain Sınırı

[[PM-TRUST-0001]] gereği:

| Zincirde (on-chain) | Zincir dışında (off-chain) |
|---------------------|-----------------------------|
| Issuer DID'leri + açık anahtarlar | Credential içerikleri (cüzdanda) |
| Akreditasyon / yetki kayıtları | Kişisel veri |
| İptal durumu (revocation) | Operasyonel/uygulama verisi |
| Credential şemaları | Credential↔kimlik eşleştirmesi |

Kişisel veri (hash'i dahil) GDPR/KVKK silme hakkıyla çelişeceği için **asla**
zincire yazılmaz.

## 5. Trust Registry (Güven Kaydı) ve Egemenlik Katmanları

Ağın kalbi, EVM üstünde çalışan güven katmanı kontratlarıdır. Yönetişim
**egemenlik-öncelikli** üç katmana ayrılır ([[ADR-0002]]); kontrat şeması/arayüzleri
kanonik olarak [[SPEC-BC-0001]]'de tanımlıdır:

- **Governance (Katman 1):** yalnızca ağa üyelik (yeni devlet validator'ı) 2/3 oyla;
  `withdraw()` tek taraflı.
- **Issuer Registry (Katman 2):** her devlet kendi issuer'larını **oy olmadan**
  kaydeder (`onlyOwnerState`); yumuşak iptal + `successorId`.
- **Relying Party Registry (Katman 2):** RP kaydı + scope (aşırı-talep koruması).
- **Cross-Recognition (Katman 3):** her devlet başka devletin issuer'larını **tek
  taraflı** tanır (kurucular FULL / sonrakiler NONE).
- **StatusList (iptal):** bitstring; min. 100.000 index (mahremiyet).

Doğrulayıcı (Verifier) bir credential'ı kaynağa gitmeden, **üç `view` sorgusuyla**
doğrular: `isValidIssuer` + `isRecognizedBy` + `isRevoked` ([[SPEC-BC-0001]] §6).

> **Egemenlik ilkesi:** Bir devlet başka devletin namespace'ine (`onlyOwnerState`)
> yazamaz; ulusal kayıtlar oylanmaz. Yalnızca "kim masada oturur" ortak oylanır.

## 6. Besu'ya Somut Eşleme

| Mimari kavram | Besu/QBFT karşılığı |
|---------------|----------------------|
| Bağımsız egemen ağ | Özel `genesis.json` + kendi **chain ID** |
| Validator seti | QBFT `extraData` (genesis) + çalışma anında validator oylaması |
| Eşit oy | QBFT'de her validator 1 oy (PoA) |
| Anında kesinlik | QBFT single-block finality (2/3+ imza) |
| İzinli erişim | Node/hesap **permissioning** (allowlist kontratı) |
| Trust Registry | EVM/Solidity kontratları (JSON-RPC) |
| Faz geçişi (validator devri) | QBFT validator ekleme/çıkarma oylaması |

Adım adım kurulum: [[ARCH-0002]].

---

# İlişkiler

- [[PM-BC-0001]] — Validator modeli ve eşit-güç ilkesinin **nedeni**.
- [[ADR-0001]] — Besu + QBFT çerçeve kararı.
- [[PM-TRUST-0001]] — On/off-chain sınırının kaynağı.
- [[RS-EBSI-0001]] — Emsal node modeli (25-27 eşit validator).
- [[ARCH-0002]] — Bu mimarinin Besu üzerinde adım adım kurulumu.

---

# Gelecek / Açık Kararlar

1. **Faz 0 validator sayısı ve coğrafi dağılımı** (öneri: 4; f=1 tolerans).
2. **Devir eşikleri:** hangi koşulda vakıf validator'ı azaltır/çıkar (devlet sayısı,
   olgunluk kriteri) — [[PM-GOV-0001]] (planlı) ile netleşecek.
3. **Kurum full node akreditasyon süreci** (SLA, kimlik doğrulama).
4. **Ölçek stratejisi:** devlet sayısı büyürse (>~20) QBFT/IBFT ayarı veya bölgesel
   yapı ([[PM-BC-0001]] Gelecek).
5. Trust Registry kontrat arayüzleri → **SPEC-BC-0001** (planlı).

---

# Sonuç

Tamga'nın ağı, izinli tek ortak Besu/QBFT zinciridir; node rolleri güç dağılımını
(validator=devlet, full node=kurum) teknik olarak uygular; ve **fazlı validator
modeli** ağın önce Tamga vakfı tarafından çalıştırılıp zamanla devletlere
devredilmesini şeffaf, taahhütlü bir mimariyle mümkün kılar. Bu, "başta biz,
sonra devletler, sonra kurumlar" vizyonunun mühendislik karşılığıdır.

---

# İlgili Dokümanlar

- [[PM-BC-0001]] · [[ADR-0001]] · [[PM-TRUST-0001]] · [[RS-EBSI-0001]] ·
  [[RS-FRAMEWORKS-0001]] · [[ARCH-0002]]

---

# Durum

**Taslak** — sürüm 1.0.0 (2026-10-02).

