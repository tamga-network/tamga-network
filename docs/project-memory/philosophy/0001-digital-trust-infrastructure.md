---
document_id: PM-PH-0001
title: Digital Trust Infrastructure Felsefesi ve Tamga'nın Konumlandırması
category: Philosophy
domain: Philosophy
status: Draft
review_status: Draft
version: 0.1.1
created: 2026-07-29
last_updated: 2026-09-30
authors:
  - Tamga Network Engineering
language: tr
document_type: project-memory
audience:
  - engineers
  - architects
  - product
  - ai-agents
stability: Timeless
maturity: Foundational
tags:
  - philosophy
  - vision
  - digital-trust-infrastructure
  - positioning
  - turkic-world
keywords:
  - digital trust infrastructure
  - identity-first
  - layered model
  - infrastructure vs application
  - interoperable but independent
  - Türk dünyası
  - Organization of Turkic States
  - Tamga Wallet
related:
  - PM-BC-0001
  - PM-TRUST-0001
  - RS-EIDAS-0001
  - RS-EBSI-0001
research:
  - RS-EIDAS-0001
  - RS-EBSI-0001
summary: >
  Tamga Network'ün temel felsefesini ve stratejik konumlandırmasını kaydeder:
  Tamga bir blockchain değil, bir Digital Trust Infrastructure'dır. Katmanlı
  model (altyapı = Tamga Network; uygulama = Tamga Wallet) ile EBSI/EUDI ayrımını,
  "Türk dünyasının EBSI'si" konumlandırmasını (Türkiye önce → Türk Devletleri
  Teşkilatı), "uyumlu ama bağımsız" stratejisini ve kimlik-öncelikli yaklaşımı
  gerekçelendirir. Tüm diğer kararların dayandığı keystone felsefe dokümanıdır.
priority: Critical
---
> **Sürüm notu 0.1.1 (2026-09-30) — ürün adı:** TamgaID → Tamga Wallet / “Tamga ile giriş yap” (proje yönetimi kararı; anlam değişmedi).

# Giriş

Bu doküman Tamga Network'ün **neden var olduğunu** ve **ne olmayı hedeflediğini** kaydeder. Teknik bir spesifikasyon değil, tüm teknik kararların dayandığı **felsefe ve stratejik çerçevedir.**

Diğer kararlar (blockchain, güven sınırı, mimari) buradan türer. [[PM-BC-0001]] "ağı kim kurar", [[PM-TRUST-0001]] "zincire ne yazılır" der; bu doküman ise "hepsi ne uğruna" sorusunu cevaplar.

---

# Problem

Bugün hemen her dijital platform aynı problemi kendi içinde yeniden çözer: kullanıcı hesabı, kimlik doğrulama, yetkilendirme, işlem kaydı. Farklı sektörlerde çalışsalar da hepsi tek bir temel problemi çözmeye çalışır:

> **Dijital ortamda güven oluşturmak.**

Her uygulamanın bunu ayrı ayrı, uyumsuz biçimde çözmesi üç sonuç doğurur:
1. **Tekrar eden maliyet** — herkes aynı çarkı yeniden icat eder.
2. **Parçalanma (fragmentation)** — sistemler birbiriyle konuşamaz.
3. **Kullanıcı kontrolsüzlüğü** — kimlik ve veri, kullanıcıda değil platformlarda dağınık durur.

Tamga bu problemi her uygulamanın ayrı çözmesi yerine **ortak bir altyapı hizmeti** olarak sunar.

---

# Vizyon: Tamga Bir Blockchain Değildir

Tamga Network;

- bir blockchain **değildir**,
- bir DID platformu **değildir**,
- bir cüzdan uygulaması **değildir**,
- bir credential sistemi **değildir**.

Tamga Network bir **Digital Trust Infrastructure (Dijital Güven Altyapısı)** olarak tasarlanmıştır.

- **Dijital kimlik**, bu altyapının başlangıç noktasıdır.
- **Güven**, altyapının ürettiği temel değerdir.
- **Blockchain**, yalnızca güven gerektiren kayıtları değiştirilemez kılan bir bileşendir — merkezi değil.

Kullanıcı blockchain kullanmaz; yalnızca dijital kimliğini kullanır. Blockchain arka planda çalışır (bkz. [[PM-BC-0001]], [[PM-TRUST-0001]]).

---

# Katmanlı Model (Kritik Zihin Modeli)

Tamga'yı anlamanın anahtarı, iki katmanı ayırmaktır. Bu ayrım, EBSI ve EUDI'nin AB'deki ilişkisiyle birebir örtüşür:

| Katman | Tamga'da | AB karşılığı | Görev |
|--------|----------|--------------|-------|
| **Altyapı** | **Tamga Network** | EBSI benzeri | Güven kaydı: kim güvenilir, hangi anahtar, hangi şema. Devletlerin işlettiği izinli ağ. |
| **Uygulama / Cüzdan** | **Tamga Wallet** | EUDI Wallet benzeri | Kullanıcının kimliğini ve credential'larını tuttuğu, sunduğu, imzaladığı ürün. |

**Kurmaya çalıştığımız asıl şey altyapı katmanıdır (Tamga Network).** Tamga Wallet, bu altyapıyı kullanan ilk üründür.

> **Önemli düzeltme (kalıcı not):** EUDI Wallet, EBSI'nin *üstünde* çalışmaz; ikisi ayrı ama tamamlayıcı girişimlerdir (EUDI'nin güven omurgası Trusted List/PKI'dır; EBSI ayrı bir registry'dir — bkz. [[RS-EIDAS-0001]] §5, [[RS-EBSI-0001]] §6). Aynı şekilde Tamga Wallet, Tamga Network'ün *bir uygulamasıdır* ama Tamga Network yalnızca Tamga Wallet için değildir; başka cüzdanlar ve sektör uygulamaları da (sağlık, eğitim…) aynı altyapıyı kullanabilir.

---

# Konumlandırma

## "Türk Dünyasının EBSI'si"
EBSI çalışır çünkü **çok-devletli bir konsorsiyumdur** (AB üye devletleri eşit validator). Tamga'nın validator modeli ([[PM-BC-0001]]: devlet başına eşit güç) de birden fazla egemen devlet gerektirir. Bu devletler kümesi:

> **Türk Devletleri Teşkilatı (Organization of Turkic States).** Türkiye, Azerbaycan, Kazakistan, Kırgızistan, Özbekistan ve gözlemci üyeler.

Tamga, AB'nin EBSI'sinin Türk dünyası karşılığı olarak konumlanır: Türk dünyasına ait, onların kontrolünde, egemen bir dijital güven altyapısı.

## Kapsam: Türkiye Önce → Türk Dünyası
Strateji kademelidir:
1. **Önce Türkiye'de** kur, kanıtla, ilk ürünleri (Tamga Wallet) çalıştır.
2. **Sonra Türk Devletleri Teşkilatı** ülkelerine, çok-devletli eşit-güç modeliyle genişlet.

Bu, çok-devletli koordinasyonun zorluğunu erken üstlenmeden önce işleyen bir sistem kurmayı sağlar.

## EUDI/EBSI Karşısında: "Uyumlu ama Bağımsız"
Tamga, EUDI/EBSI ile **aynı açık standartları** kullanır (SD-JWT VC, OpenID4VCI/VP, W3C DID/VC — bkz. [[RS-EIDAS-0001]] §4) ki birlikte çalışabilsin. Ancak **kendi egemen ağı ve yönetişimi** olur.

- EBSI'ye node olarak katılmayız (AB dışıyız), ama onunla **interoperable** oluruz.
- Standartlara uyum = birlikte çalışabilirlik + güven. Bağımsızlık = egemenlik + kontrol.

---

# İlk Ürün: Tamga Wallet

Tamga Wallet, Tamga Network'ün son kullanıcıya açılan ilk ürünüdür ve **EUDI Wallet benzeri bir cüzdandır:**

- Kullanıcının **dijital kimliğini** oluşturması, yönetmesi, kullanması.
- **Verifiable Credential'ları** taşıması (diploma, kimlik belgesi, yetki vb.).
- **Elektronik imza (e-imza / QES)** üretmesi — bu, erken ve somut bir kullanım alanıdır.
- **Seçici açıklama / ZKP** ile "istediğini açma" (örn. "18'den büyüğüm" derken doğum tarihini göstermeden).

Tamga Wallet bir "süper uygulama" değildir. Sektörel iş süreçleri sektörlerin kendi uygulamalarında (sağlık, eğitim, ödeme…) yürür; hepsi aynı kimlik ve güven altyapısını kullanır.

**İlk kullanım alanları** (hepsi Tamga Wallet üzerinde):
- Dijital kimlik (temel)
- E-imza / QES (mevcut odak)
- Diploma / belge doğrulama (EBSI'nin amiral kullanımı, net değer)
- Genel credential taşıma

---

# Temel İlkeler

1. **Identity-first.** Her işlem bir dijital kimlikle ilişkilidir. Kimlik güveni oluşturur, yetki işlemi sınırlar, blockchain kalıcı kılar.
2. **Holder-centric.** Kullanıcı belgesini kendi elinde tutar (cüzdan); altyapı belgeyi saklamaz, verenin yetkisini doğrular ([[PM-TRUST-0001]]).
3. **Privacy by Design.** Kişisel veri zincirde değil; iptal ve açıklama mahremiyet-öncelikli.
4. **Egemenlik.** Ağın kontrolü devletlerde; kimse başka bir ağa bağımlı değil ([[PM-BC-0001]]).
5. **Açık standartlar + açık kaynak.** Birlikte çalışabilirlik ve güven için.
6. **Ekosistem, tek uygulama değil.** Ortak altyapı üzerinde bağımsız dikey platformlar.

---

# Değerlendirilen Gerilimler

## "EBSI'yi kopyalamak" gerilimi
Tamga, EBSI'yi örnek alır ama körü körüne kopyalamaz. Amaç, EBSI'nin mühendislik kararlarından **alınması gerekenleri almak** (validator/node/consensus modeli, güven registry'leri, on-chain/off-chain sınırı) ve Türk dünyasına uyarlamaktır.

## Çekirdek farklılaşma — Açık Soru
Tamga'yı EBSI'den ayıran, coğrafyanın ötesinde bir **çekirdek fark** henüz netleşmemiştir. Şimdilik "Türk dünyası egemenliği" yeterli ayrımdır. Olası yönler (ileride netleşecek):
- Daha geniş kapsam (kimlik → ödeme / varlık transferi / varlık saklama).
- Geliştirici/kurum dostu, ürün odaklı yaklaşım.
Bu, bilinçli olarak **açık bırakılmıştır** ve proje ilerledikçe tanımlanacaktır.

---

# Gelecek / Açık Sorular

1. **Çekirdek farklılaşma** — coğrafyanın ötesinde Tamga'yı benzersiz kılan ne? (yukarıda)
2. **Genişleme kapsamı** — kimlikten sonra ödeme/varlık katmanı ne zaman, nasıl? → ileride PM/ARCH.
3. **Türk Devletleri Teşkilatı ile ilişki** — resmi/kurumsal yol nasıl kurulur? (teknik değil, stratejik/diplomatik)
4. **EBSI interoperability** — teknik entegrasyon noktaları neler? → RS-EBSI-0001 derinleştirme.
5. **Devlet adaptasyon riski (2026-07-29):** Devletler sistemi *şimdi* kullanmak istemeyebilir. **Azaltma stratejisi (bilinçli):** eIDAS/EUDI uyumu bilerek yapılıyor — Türkiye'de ilgili regülasyonun hazırlandığı bilgisi var; regülasyon geldiğinde Tamga hazır olacak. Çift hedef: **hem Avrupa'ya uyumlu hem Türk dünyası için.** Bu, "uyumlu ama bağımsız" ilkesini stratejik olarak güçlendirir. Bu arada altyapı, devlet olmadan da (pilot/kurumsal issuer'larla) çalışabilecek şekilde tasarlanmalı. **Bu ilke artık somutlaştı:** güveni devletler gelene kadar mevcut kurumlardan devralan **devletsiz bootstrap** + iki eksenli assurance modeli → [[PM-ASSUR-0001]], [[ADR-0005]].

---

# İlişkiler / İlgili Dokümanlar

- [[PM-BC-0001]] — Blockchain ve validator modeli (egemenlik, eşit güç). Türk dünyası = eşit devletler.
- [[PM-TRUST-0001]] — On-chain/off-chain sınırı; holder-centric ilke.
- [[RS-EIDAS-0001]] — EUDI/eIDAS zemini; "uyumlu ama bağımsız" standartları.
- [[RS-EBSI-0001]] — EBSI emsali; katmanlı model ve konumlandırma.
- ARCH-01 (planlı) — "What is Tamga Network" mimari bölümü (bu felsefenin mimariye dökülmesi).

---

# Durum

**review_status: Draft.** Vizyon ve konumlandırma 2026-07-29 kararlarıyla oturtuldu: Digital Trust Infrastructure; katmanlı model; Türk dünyasının EBSI'si; Türkiye önce → Türk dünyası; uyumlu ama bağımsız; Tamga Wallet = EUDI benzeri cüzdan (credential + e-imza). Çekirdek farklılaşma bilinçli olarak açık bırakıldı. Bu doküman, felsefe klasörü gözden geçirilirken `Completed`'a taşınacaktır.
