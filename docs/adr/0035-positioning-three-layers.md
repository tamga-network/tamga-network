---
document_id: ADR-0035
title: Konumlanma — AB Uyumu Taban, Tamga Network Hafif Federasyon, Ürün ve Hizmetler
category: ADR
domain: Governance
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
  - public
tags:
  - adr
  - strategy
  - governance
keywords:
  - positioning
  - federation
  - EUDI compatible
summary: >
  Tamga üç katmanda konumlanır: (1) taban — bütün belgeler, protokoller ve güven listeleri AB (eIDAS 2.0 / EUDI) standartlarında;
  (2) Tamga Network — Türk dünyası için hafif bir güven federasyonu: ülke listelerini toplar ve birbirine tanıtır, kurallarına
  uyan her cüzdanı tanır, devletler katıldıkça yönetişim kurumu ve zincir gelir; (3) ürün ve hizmetler — Tamga Wallet (ağın ilk
  ve referans cüzdanı, her uyumlu ortamda çalışır) ve kurumlara hizmetler (Kurum Konsolu, Tamga Verify, entegrasyon, destek).
related:
  - "[[ADR-0009]]"
  - "[[ADR-0011]]"
  - "[[ADR-0030]]"
---

# Bağlam

TÜBİTAK BİLGEM'in AB uyumlu bir cüzdanı ve deneme ortamı olduğu ortaya çıktı. Bu bilgi tek bir kaynaktan geliyor ve resmî
statüsü bilinmiyor. Ama yön açık: Türkiye'de devlet destekli bir cüzdan ve kişi kimliği (PID) yolu oluşuyor. Analiz:
`tamga-platform` özel belgeleri, 2026-10-01 TÜBİTAK analizi.

İki yanlış anlamanın netleşmesi gerekiyordu:

1. **"EUDI Wallet" hukuki bir unvandır.** Bir AB üye devletinin sunduğu ya da tanıdığı ve AB kurallarına göre sertifikalanan
   cüzdan demektir. AB dışındaki bir kuruluşun cüzdanı (Tamga Wallet da, TÜBİTAK cüzdanı da) bugün bu unvanı alamaz, AB Güven
   İşaretini de kullanamaz. Olabileceği şey **AB uyumlu** olmaktır: aynı standartları konuşmak ve bunu testle kanıtlamak.
2. **AB uyumu, yolların alternatifi değil, ortak zeminidir.** "AB uyumlu cüzdan + hizmetler" ile "Tamga Network" arasında bir
   seçim yok. Ağ, AB standartlarının üstüne konan bir katmandır.

Değerlendirilen üç yol:

- **Yol 1:** yalnız AB uyumlu cüzdan ve hizmetler.
- **Yol 2:** önce AB benzeri ağır bir ağ ve kurum.
- **Yol 3:** katmanlı yapı.

# Karar

**Yol 3: üç katman, her biri tek başına ayakta durabilir.**

1. **Taban: AB uyumu.** Belge biçimleri (SD-JWT VC, ISO mdoc), protokoller (OpenID4VCI/VP, HAIP), güven modeli (LOTL → ülke
   listeleri, ETSI biçimleri) ve kayıt modeli AB standartlarındadır. Ağ hiç büyümese bile bu katman tek başına değerlidir.
2. **Tamga Network: hafif bir federasyon.**
   - Ağ, cüzdanları **seçmez, tanır.** Yayınlanmış kurallara (ARF, rulebook'lar) uyan ve uyum testlerini geçen her cüzdan
     sağlayıcısı listeye girebilir.
   - Ağın asıl işi **ülke listelerini toplamak ve birbirine tanıtmaktır.** Bugün Türkiye listesini Tamga vekâleten işletir.
     Devlet ya da devletin yetkilendirdiği kurum kendi listesini yayınladığında, Tamga LOTL'u o listenin adresini ve imzacısını
     gösterir. Cüzdan ve doğrulayıcı için yalnız adres değişir (ADR-0009 devir hedefi). Her Türk devleti için aynısı geçerlidir.
   - Ağır bir kurum ilk günden kurulmaz. Bugün Tamga geçici işletmecidir. Bir ya da iki devlet katılmaya istekli olduğunda
     yönetişim kurumu (konsey ya da vakıf) kurulur, listeler devredilir ve zincir (ADR-0009: en az iki bağımsız işletmeci) gelir.
3. **Ürün ve hizmetler.**
   - **Tamga Wallet:** ağın ilk ve referans cüzdanıdır, ama ağa kilitli değildir; her AB uyumlu ortamda çalışır. Ulusal kimlik
     cüzdanı iddiası taşımaz. Artıları takma ad, sıfır bilgi ispatı, bilet ve Türk dünyası belgeleridir.
   - **Hizmetler** (Kurum Konsolu, Tamga Verify, kurumların kendi kaydı, deneme ortamı, entegrasyon ve SDK desteği,
     danışmanlık, geçici kimlik servisi) **standartlar üzerine** satılır. Kurum, belgesini kişinin seçtiği uyumlu cüzdana verir;
     doğrulama hangi uyumlu cüzdandan gelirse gelsin çalışır.
   - Hizmetler ayrı bir yazılım değildir: bugün çalışan servislerin kurumlara sunulan hâlidir. Ayrım marka, sözleşme ve
     sorumluluk düzeyindedir.

# Değişmezler

| Kod | Kural |
|---|---|
| PO1 | Tamga belge, protokol ve güven listesi biçimleri AB standartlarından ayrılmaz; Tamga'ya özgü her ek, standart bir uzantı noktasıyla yapılır ve standart istemcileri bozmaz. |
| PO2 | Tamga Network bir cüzdanı adına göre değil, yayınlanmış kurallara ve uyum testlerine göre tanır; kurallara uyan cüzdan sağlayıcısı listeye girebilir. |
| PO3 | Tamga'nın vekâleten üstlendiği devlet rolleri (liste işletmecisi, kayıt kurumu, kök CA, geçici kimlik sağlayıcı) devredilebilir tasarlanır; devirde belge, cüzdan ve doğrulayıcı tarafında yalnız adres ve imzacı değişir. |
| PO4 | Kamuya açık metinlerde Tamga Wallet "EUDI Wallet" ya da "ulusal cüzdan" olarak sunulmaz; doğru ifade "AB uyumlu cüzdan"dır ve uyum test sonuçlarıyla desteklenir. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Yol 1: yalnız AB uyumlu cüzdan + hizmetler | ret (ana yön olarak) | En hızlı gelir, ama ayırt edici özellik az ve devlet cüzdanı gelince küçülür. Yol 3 bunu zaten içeriyor. |
| Yol 2: önce ağır ağ ve kurum | ret | Devletler gelmezse yıllarca gelirsiz kalır; erken kurum maliyeti yüksek. |
| **Yol 3: katmanlı** | **kabul** | Bugünkü mimariyle birebir; hizmetler ve cüzdan hemen gelir getirir, ağ zamanla büyür, devlet cüzdanı ve listeleri gelince değer kaybolmaz, aksine federasyon değeri artar. |

**Bilinen gerilim:** AB rolleri bilinçli ayırır. Listeyi yöneten kurumun hizmet satması çıkar çatışması sayılır. Bugün tek ekip
yeterlidir, ama ileride ağ yönetişimi (konsey ya da vakıf) ile hizmet şirketi ayrışmalıdır. Kamuya açık anlatımda bu ayrım
şimdiden adlarla ve belgelerle gösterilir.

# Sonuçlar

- **Federasyon kapısı.** Dış imzacılı ülke listeleri, ETSI biçimini okuma ve dış cüzdan sağlayıcılarını tanıma ayrı bir ADR ile
  açılır (TÜBİTAK analizindeki açık 1 ve 3).
- **AB kimliği.** AB kimlik (PID) ve ehliyet (mDL) türlerinin doğrulanması yapılır (açık 2).
- **Cüzdan ve konsol.** Cüzdana "paylaştığım kurumlar" ekranı eklenir; Kurum Konsolu'na doğrulayan kurumların kendi kaydı
  (tasarım şimdi, yapım mağazadan sonra) gelir.
- **Kamuya açık anlatım.** Site, whitepaper ve sunumlar üç katmana göre düzenlenir (marka kiti turunda). ARF ve geliştirici
  belgeleri bu konumlanmaya göre sadeleştirilir.

# Durum

**Accepted — 2026-10-01** (proje yönetimi onayı; birebir alıntı özel onay kaydında).
