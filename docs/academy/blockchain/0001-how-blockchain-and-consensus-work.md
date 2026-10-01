---
document_id: ACA-BC-0001
title: Blockchain ve Consensus Nasıl Çalışır — Sıfırdan
category: Academy
domain: Blockchain
status: Draft
review_status: Draft
version: 0.1.0
created: 2026-07-29
last_updated: 2026-07-29
authors:
  - Tamga Network Engineering
language: tr
document_type: academy
audience:
  - learners
  - engineers
  - product
  - ai-agents
stability: Stable
maturity: Foundational
tags:
  - blockchain
  - consensus
  - bft
  - proof-of-authority
  - validator
  - node
  - education
keywords:
  - blockchain temelleri
  - node
  - validator
  - consensus
  - byzantine fault tolerance
  - proof of work
  - proof of stake
  - proof of authority
  - finality
  - permissioned blockchain
related:
  - PM-BC-0001
  - RS-EBSI-0001
see_also:
  - RS-FRAMEWORKS-0001
summary: >
  Blockchain ve consensus mekanizmalarını sıfırdan, analojilerle öğreten Academy
  dokümanı. Blok/zincir/hash, node türleri, dağıtık mutabakat problemi, consensus
  aileleri (PoW, PoS, BFT/PoA), BFT'nin nasıl çalıştığı (validator, tur, PREPARE/
  COMMIT, 3f+1, deterministik finality), kesinlik türleri, izinli/izinsiz ayrımı ve
  bir işlemin yaşam döngüsünü kapsar. Tamga'nın neden izinli BFT/PoA seçtiğini
  (PM-BC-0001) anlaşılır kılar; RS-FRAMEWORKS-0001 için zemin hazırlar.
priority: High
---

# Bu Doküman Kimin İçin?

Bu doküman, blockchain'i teknik olarak hiç bilmeyen birinin **validator, node, consensus ve "hangi ağ"** kavramlarını sıfırdan kavraması için yazıldı. Amaç ezber değil, **sezgi** kazandırmak.

Bir Academy dokümanıdır: kavram öğretir. Tamga'nın somut kararları için [[PM-BC-0001]]'e, EBSI örneğine [[RS-EBSI-0001]]'e bakılır. Buradaki bilgi, [[RS-FRAMEWORKS-0001]] (Cosmos vs Besu) kararını anlamak için gerekli zemindir.

---

# 1. Blockchain Aslında Nedir? — Ortak Defter Analojisi

Bir köy düşün. Herkesin borç-alacak ilişkilerini tutan **tek bir büyük defter** var. Sorun: bu defter kimde duracak? Tek kişide dursa, o kişi sayfaları değiştirebilir.

Çözüm: **defterin kopyası herkeste olsun.** Yeni bir işlem olduğunda herkes kendi defterine aynı satırı yazsın. Böylece kimse tek başına geçmişi değiştiremez — çünkü diğer herkesin kopyası onu yalanlar.

İşte blockchain budur: **kopyası birçok bilgisayarda (node) duran, ortak bir defter (ledger).**

## Blok, Zincir ve Hash
- İşlemler tek tek değil, **gruplar (blok)** hâlinde deftere eklenir.
- Her blok, bir öncekinin **parmak izini (hash)** içinde taşır.
- **Hash:** bir veriyi sabit uzunlukta benzersiz bir "özet"e çeviren matematiksel fonksiyon. Verinin tek harfi değişse, hash tamamen değişir.

Bloklar birbirine hash'lerle bağlandığı için bir **zincir** oluşur:

```text
[Blok 1] ← [Blok 2] ← [Blok 3] ← [Blok 4]
 hash1      hash1+     hash2+     hash3+
            veri       veri       veri
```

**Değiştirilemezlik (immutability) buradan gelir:** 2. bloğu değiştirirsen hash'i değişir; 3. blok eski hash'i işaret ettiği için zincir kopar; herkes sahtekârlığı anında görür. Geçmişi değiştirmek için sonraki tüm blokları ve herkesin kopyasını aynı anda değiştirmen gerekir — pratikte imkânsız.

> **Tamga bağlamı:** [[PM-TRUST-0001]] "kişisel veri zincire yazılmaz" der; çünkü bu değiştirilemezlik, kişisel veri için GDPR "silinme hakkı" ile çatışır. Değiştirilemezlik güç kaynağı ama aynı zamanda kısıttır.

---

# 2. Node Nedir? Türleri Neler?

**Node**, blockchain yazılımını çalıştıran bir bilgisayardır. Deftere katılan her makine bir node'dur. Başlıca türler:

| Node türü | Ne yapar |
|-----------|----------|
| **Full node** | Tüm defteri saklar, gelen işlemleri kurallara göre doğrular. Ağın belkemiği. |
| **Validator node** | Full node'un özel bir türü: **yeni blok önerme/onaylama** yetkisi olan node. Mutabakata (consensus) katılır. |
| **Light node** | Tüm defteri saklamaz; sadece ihtiyacı olan parçaları başka node'lardan sorar (ör. telefon cüzdanı). |

**Kritik ayrım:** Her validator bir node'dur, ama her node validator değildir. Deftere yeni sayfa yazma yetkisi yalnızca **validator'lardadır.**

> **Tamga bağlamı:** [[PM-BC-0001]]'de "validator = devletler + güvendikleri kurumlar" derken tam olarak bu blok-yazma yetkisini kimin taşıyacağını söylüyoruz.

---

# 3. Asıl Problem: Dağıtık Mutabakat (Consensus)

Defter herkeste kopya olarak duruyorsa, şu soru doğar:

> **"Bir sonraki bloğun içeriğinde herkes nasıl ANLAŞACAK?"**

Aynı anda iki kişi işlem gönderirse, kim önce yazıldı? Bir validator yalan söylerse? İnternet koparsa? Herkesin **aynı sırada, aynı bloklarda** anlaşması gerekir. Buna **consensus (mutabakat)** denir.

## Bizans Generalleri Problemi (Analoji)
Bir şehri kuşatan generaller var. Kazanmak için ya hepsi birlikte saldırmalı ya hepsi çekilmeli. Sadece haberciyle iletişebiliyorlar. Ama **bazı generaller hain** olabilir (yanlış mesaj yayabilir) veya haberci yolda kaybolabilir.

Soru: Hainler ve iletişim sorunlarına rağmen, dürüst generaller nasıl **ortak bir karara** varır?

Bu, dağıtık sistemlerin temel problemidir. Bir consensus algoritması, **bazı node'lar bozuk/kötü niyetli olsa bile** ağın tek bir doğru üzerinde anlaşmasını sağlar. Buna **Byzantine Fault Tolerance (BFT)** denir.

---

# 4. Consensus Aileleri

Ağın "kim ve nasıl blok yazacak" sorusuna farklı cevaplar farklı ailelere yol açar.

## 4.1 Proof of Work (PoW) — Bitcoin
- Validator'lar (madenci) zor bir matematik bulmacasını **ilk çözmek için yarışır.** Kazanan bloğu yazar.
- Güvenlik: bulmacayı çözmek çok elektrik/donanım ister; ağı ele geçirmek maddi olarak imkânsız derecede pahalıdır.
- **Artı:** çok açık, izinsiz, sağlam.
- **Eksi:** korkunç enerji tüketimi, yavaş, kesinlik olasılıksal (aşağıda).

## 4.2 Proof of Stake (PoS) — Ethereum (2022 sonrası)
- Blok yazma hakkı yarışla değil, **kilitlenen para (stake)** oranında dağıtılır. Çok stake = çok şans.
- Kötü davranan validator'ın stake'i yakılır (**slashing**).
- **Artı:** enerji verimli, PoW'dan hızlı.
- **Eksi:** "zengin daha çok kontrol eder" eğilimi; token ekonomisi gerektirir.

## 4.3 BFT / Proof of Authority (PoA) — İzinli ağlar
- Validator seti **bilinir ve sınırlıdır** (herkes katılamaz; yetki/onay gerekir).
- Bloklar **oylama** ile onaylanır: validator'lar bir blok üzerinde çoğunlukla anlaşır.
- **PoA:** yetki, para/işten değil, **kimliğin/otoritenin** kendisinden gelir (ör. bir devlet). Oy gücü genelde **eşit**tir.
- **Artı:** hızlı, enerji-dostu, **anında kesinlik**, düzenlemeye uygun.
- **Eksi:** izinli (herkese açık değil); validator seti güvenilir olmalı.

## Karşılaştırma

| Özellik | PoW | PoS | BFT / PoA |
|---------|-----|-----|-----------|
| Kim yazar | Yarışı kazanan | Çok stake eden | Yetkili validator |
| Güç dağılımı | Donanım | Para | **Otorite (çoğunlukla eşit)** |
| Erişim | İzinsiz | İzinsiz | **İzinli** |
| Enerji | Çok yüksek | Düşük | Düşük |
| Kesinlik | Olasılıksal | ~Deterministik | **Deterministik (anında)** |
| Örnek | Bitcoin | Ethereum | **EBSI, Tamga** |

> **Tamga bağlamı:** [[PM-BC-0001]] izinli **BFT/PoA, devlet başına eşit oy** seçti. Yukarıdaki tablo neden: devletlerin eşit gücü + düzenleme uyumu + anında kesinlik sadece bu ailede bir arada bulunur.

---

# 5. BFT Nasıl Çalışır? (Tamga'nın Ailesi — Derinlemesine)

Tamga BFT/PoA kullanacağı için bunu biraz açalım. (EBSI'nin IBFT 2.0'ı ve Cosmos'un CometBFT'si bu ailedendir.)

## Temel Kurgu
- **Bilinen bir validator seti** var (diyelim 10 devlet).
- Zaman **turlara (round)** bölünür. Her turda bir blok üretilir.
- Her turda bir validator **lider (proposer)** olur ve bir blok **önerir.**
- Diğer validator'lar bu blok üzerinde **oy** kullanır.

## İki Fazlı Oylama: PREPARE → COMMIT
Basitçe iki tur el kaldırma gibi düşün:

1. **PREPARE (hazırım):** Lider blok önerir. Her validator "bu bloğu gördüm, geçerli" derse PREPARE oyu yayar.
2. **COMMIT (kesinleştir):** Yeterli PREPARE toplanınca, validator'lar "tamam, bunu kalıcı yazıyorum" diyerek COMMIT oyu yayar. Yeterli COMMIT toplanınca blok **kesinleşir (final).**

İki faz olmasının sebebi: tek turda "acaba diğerleri de gördü mü?" belirsizliği kalır. İkinci faz, "hepimiz aynı bloğu göreceğimizden eminiz" garantisini verir.

## Neden "üçte iki" ve 3f+1?
Hainlere dayanmak için sihirli oran **üçte ikiden fazla (2/3+)** anlaşmadır.

- Ağın **f** kadar kötü/bozuk node'a dayanmasını istiyorsan, toplam validator sayısı en az **3f + 1** olmalı.
- Örnek: 1 haine dayanmak için 4 validator gerekir (3×1+1). 4'ün üçte ikisinden fazlası = 3 dürüst oy, bir blok kesinleşir.
- Sezgi: Hainler en fazla f kişi. Dürüstlerin (2f+1) her zaman hainlerden **kesin çoğunlukta** olmasını garantiler. Böylece hainler ne bir yalanı geçirebilir ne de anlaşmayı bloke edebilir.

## Sonuç: Anında (Deterministik) Kesinlik
Bir blok COMMIT edilince **geri alınamaz.** "Belki ileride değişir" yoktur. Bu, imza/kimlik gibi kritik işlemler için idealdir.

---

# 6. Kesinlik (Finality): Olasılıksal vs Deterministik

- **Olasılıksal (PoW):** Bir blok "muhtemelen" kalıcıdır; üstüne blok eklendikçe geri alınma ihtimali azalır ama **asla sıfır olmaz.** Bitcoin'de "6 blok bekle" bu yüzdendir.
- **Deterministik (BFT):** Blok kesinleşince **kesin** kalıcıdır. Bekleme yok.

> **Tamga bağlamı:** Bir e-imza veya kimlik doğrulaması "belki geri alınır" olamaz. Bu yüzden [[PM-BC-0001]] deterministik kesinlik (BFT) ister.

---

# 7. İzinli mi, İzinsiz mi?

- **İzinsiz (permissionless):** Herkes node/validator olabilir (Bitcoin, Ethereum). Açıklık maksimum, ama kimlik/otorite yok.
- **İzinli (permissioned):** Yalnızca onaylı taraflar validator olur. Kontrol ve düzenleme uyumu yüksek.
- **Public permissioned (EBSI ve Tamga):** Herkes defteri **okuyabilir**, ama yalnızca onaylı validator'lar **yazabilir.** Şeffaflık + kontrol bir arada.

> **Tamga bağlamı:** [[RS-EBSI-0001]] EBSI'nin tam olarak "public permissioned" olduğunu gösterdi; Tamga da bunu benimser.

---

# 8. Bir İşlemin Yaşam Döngüsü (Uçtan Uca)

Bir kullanıcı "X" işlemini gönderdiğinde:

```text
1. Kullanıcı işlemi imzalar ve ağa gönderir.
2. Bir node işlemi alır, kurallara göre ön-doğrular.
3. İşlem, bekleyen işlemler havuzuna (mempool) girer.
4. O turun lideri (proposer) havuzdan işlemleri toplayıp bir BLOK önerir.
5. Validator'lar oy kullanır: PREPARE → COMMIT (2/3+ anlaşma).
6. Blok kesinleşir; herkesin defterine eklenir.
7. İşlem artık değiştirilemez biçimde kayıtlıdır.
```

Tüm bu döngü BFT ağlarında genelde **saniyeler** sürer.

---

# 9. Tamga'ya Bağlanış — Neden Bu Kararlar?

Artık [[PM-BC-0001]]'deki kararları "neden" ile okuyabilirsin:

| Karar | Bu dokümandaki sebep |
|-------|----------------------|
| İzinli ağ | §7 — devletler kontrolü ister; public permissioned şeffaflık + kontrol verir |
| BFT / PoA | §4–5 — düzenleme uyumu + anında kesinlik yalnızca bu ailede |
| Devlet başına eşit oy | §4.3 — PoA'da güç otoriteden gelir, paradan değil |
| Kendi ağımız | §1–2 — kendi validator setimiz, kendi defterimiz |
| "Sıfırdan yazma" gereksiz | §5 — BFT motoru (CometBFT/IBFT) kanıtlanmış; kural bizim |

---

# 10. Sonraki Adım

Bu zeminden sonra **"hangi hazır motor?"** sorusu anlamlı hale gelir:
- **CometBFT** (Cosmos SDK ile) — saf BFT, egemen zincir kurma odaklı.
- **IBFT 2.0 / QBFT** (Hyperledger Besu ile) — EVM uyumlu, EBSI'nin seçimi.

Bu ikisinin ayrıntılı karşılaştırması: [[RS-FRAMEWORKS-0001]] (sıradaki doküman) → oradan [[ADR-0001]] kararı çıkacak.

---

# Terimler (Hızlı)

- **Node:** blockchain yazılımı çalıştıran bilgisayar.
- **Validator:** blok önerme/onaylama yetkisi olan node.
- **Consensus:** node'ların bir sonraki blokta anlaşma yöntemi.
- **BFT:** kötü niyetli node'lara rağmen anlaşabilme (Byzantine Fault Tolerance).
- **PoA:** yetkinin otoriteden geldiği izinli model (Proof of Authority).
- **Finality (kesinlik):** bir bloğun geri alınamaz hale gelmesi.
- **Proposer/Lider:** o turda bloğu öneren validator.
- **Mempool:** henüz bloğa girmemiş bekleyen işlemler havuzu.

---

# İlgili Dokümanlar

- [[PM-BC-0001]] — Tamga'nın blockchain/validator kararı (bu dokümanın "neden"i).
- [[RS-EBSI-0001]] — EBSI'nin gerçek uygulaması (Besu + IBFT 2.0).
- [[PM-TRUST-0001]] — Değiştirilemezliğin kişisel veri kısıtı.
- [[RS-FRAMEWORKS-0001]] (planlı) — CometBFT vs QBFT kıyaslaması.

---

# Durum

**review_status: Draft.** Blockchain ve consensus temelleri öğretici düzeyde kapsandı. İhtiyaç olursa ileride ayrı Academy dokümanları eklenebilir: kriptografi temelleri (hash, imza, açık/gizli anahtar), DID/VC nasıl çalışır, ZKP nedir. Şimdilik framework kararına yetecek zemin hazırdır.
