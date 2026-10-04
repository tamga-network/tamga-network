---
document_id: ADR-0035
title: "Konumlanma"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-04
summary: >
  Tamga üç katmanda konumlanır: (1) taban — bütün belgeler, protokoller ve güven listeleri AB (eIDAS 2.0 / EUDI)
  standartlarında; (2) Tamga Network — Türk dünyası için hafif bir güven federasyonu: ülke listelerini toplar ve birbirine tanıtır,
  kurallarına uyan her cüzdanı tanır, devletler katıldıkça yönetişim kurumu ve zincir gelir; (3) ürün ve hizmetler — Tamga Wallet
  (ağın ilk ve referans cüzdanı, her uyumlu ortamda çalışır) ve kurumlara hizmetler (Kurum Konsolu, Tamga Verify, entegrasyon, destek).
domain: Governance
---

> **[[ADR-0037]] ile kısmen değiştirildi (2026-10-02):** üçüncü katmandaki hizmetler ağın dışına, ayrı bir şirkete
> taşındı; Tamga Network yalnızca ağdır ve hizmet satmaz. Taban (AB uyumu), federasyon katmanı ve PO1–PO4 geçerlidir.

# Bağlam

TÜBİTAK BİLGEM'in AB uyumlu bir cüzdanı ve deneme ortamı olduğu ortaya çıktı. Bu bilgi tek bir kaynaktan geliyor ve resmî
statüsü bilinmiyor. Ama yön açık: Türkiye'de devlet destekli bir cüzdan ve kişi kimliği ([[t:PID]]) yolu oluşuyor. Analiz özel
belgelerde (2026-10-01).

İki yanlış anlamanın netleşmesi gerekiyordu:

1. **"[[t:EUDI-Wallet]]" hukuki bir unvandır.** Bir AB üye devletinin sunduğu ya da tanıdığı ve AB kurallarına göre sertifikalanan
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

1. **Taban: AB uyumu.** Belge biçimleri ([[t:SD-JWT-VC]], ISO [[t:mdoc]]), protokoller ([[t:OpenID4VCI]]/VP, [[t:HAIP]]),
   güven modeli ([[t:LOTL]] → ülke listeleri, [[t:ETSI]] biçimleri) ve kayıt modeli AB standartlarındadır. Ağ hiç büyümese bile bu
   katman tek başına değerlidir.
2. **Tamga Network: hafif bir [[t:federation]].**
   - Ağ, cüzdanları **seçmez, tanır.** Yayınlanmış kurallara ([[t:ARF]], [[t:rulebook|rulebook'lar]]) uyan ve uyum testlerini geçen her
     [[t:wallet-provider]] listeye girebilir.
   - Ağın asıl işi **ülke listelerini toplamak ve birbirine tanıtmaktır.** Bugün Türkiye listesini Tamga vekâleten işletir.
     Devlet ya da devletin yetkilendirdiği kurum kendi listesini yayınladığında, Tamga LOTL'u o listenin adresini ve imzacısını
     gösterir. Cüzdan ve [[t:verifier]] için yalnız adres değişir (ADR-0009 devir hedefi). Her Türk devleti için aynısı geçerlidir.
   - Ağır bir kurum ilk günden kurulmaz. Bugün Tamga geçici işletmecidir. Bir ya da iki devlet katılmaya istekli olduğunda
     yönetişim kurumu (konsey ya da vakıf) kurulur, listeler devredilir ve zincir (ADR-0009: en az iki bağımsız işletmeci) gelir.
3. **Ürün ve hizmetler.**
   - **Tamga Wallet:** ağın ilk ve referans cüzdanıdır, ama ağa kilitli değildir; her AB uyumlu ortamda çalışır. Ulusal kimlik
     cüzdanı iddiası taşımaz. Artıları [[t:pseudonym]], sıfır bilgi ispatı ([[t:ZK]]), bilet ve Türk dünyası belgeleridir.
   - **Hizmetler** (Kurum Konsolu, Tamga Verify, kurumların kendi kaydı, deneme ortamı, entegrasyon ve SDK desteği,
     danışmanlık, geçici kimlik servisi) **standartlar üzerine** sunulur. Kurum, belgesini kişinin seçtiği uyumlu cüzdana
     verir; doğrulama hangi uyumlu cüzdandan gelirse gelsin çalışır.
   - Hizmetler ayrı bir yazılım değildir: çalışan servislerin kurumlara sunulan hâlidir. Ayrım marka, sözleşme ve sorumluluk
     düzeyindedir.

# Değişmezler

| Kod | Kural |
|---|---|
| PO1 | Tamga belge, protokol ve güven listesi biçimleri AB standartlarından ayrılmaz; Tamga'ya özgü her ek, standart bir uzantı noktasıyla yapılır ve standart istemcileri bozmaz. |
| PO2 | Tamga Network bir cüzdanı adına göre değil, yayınlanmış kurallara ve uyum testlerine göre tanır; kurallara uyan cüzdan sağlayıcısı listeye girebilir. |
| PO3 | Tamga'nın vekâleten üstlendiği devlet rolleri (liste işletmecisi, kayıt birimi, kök CA, geçici kimlik sağlayıcı) devredilebilir tasarlanır; devirde belge, cüzdan ve doğrulayıcı tarafında yalnız adres ve imzacı değişir. |
| PO4 | Kamuya açık metinlerde Tamga Wallet "EUDI Wallet" ya da "ulusal cüzdan" olarak sunulmaz; doğru ifade "AB uyumlu cüzdan"dır ve uyum test sonuçlarıyla desteklenir. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Yol 1: yalnız AB uyumlu cüzdan + hizmetler | ret (ana yön olarak) | En hızlı gelir, ama ayırt edici özellik az ve devlet cüzdanı gelince küçülür. Yol 3 bunu zaten içeriyor. |
| Yol 2: önce ağır ağ ve kurum | ret | Devletler gelmezse yıllarca gelirsiz kalır; erken kurum maliyeti yüksek. |
| **Yol 3: katmanlı** | **kabul** | Mimariyle birebir; hizmetler ve cüzdan hemen gelir getirir, ağ zamanla büyür, devlet cüzdanı ve listeleri gelince değer kaybolmaz, aksine federasyon değeri artar. |

**Bilinen gerilim:** AB rolleri bilinçli ayırır. Listeyi yöneten kurumun hizmet satması çıkar çatışması sayılır. Bugün tek ekip
yeterlidir, ama ileride ağ yönetişimi (konsey ya da vakıf) ile hizmet şirketi ayrışmalıdır. Kamuya açık anlatımda bu ayrım
şimdiden adlarla ve belgelerle gösterilir.

# Sonuçlar

- **Federasyon kapısı.** Dış imzacılı ülke listeleri, ETSI biçimini okuma ve dış cüzdan sağlayıcılarını tanıma ayrı bir ADR ile
  açılır ([[ADR-0036]]).
- **AB kimliği.** AB kimlik (PID) ve ehliyet ([[t:mDL]]) türlerinin doğrulanması yapılır ([[ADR-0036]]).
- **Cüzdan ve konsol.** Cüzdana "paylaştığım kurumlar" ekranı eklenir; Kurum Konsolu'na doğrulayıcı kurumların kendi kaydı
  (tasarım şimdi, yapım mağazadan sonra) gelir.
- **Kamuya açık anlatım.** Site, whitepaper ve sunumlar üç katmana göre düzenlenir. ARF ve geliştirici belgeleri bu
  konumlanmaya göre sadeleştirilir.

# Durum

**Accepted — 2026-10-01** (proje yönetimi onayı; birebir alıntı özel onay kaydında). Üçüncü katman ("ürün ve hizmetler")
[[ADR-0037]] ile değişti: Tamga Network yalnızca ağdır, hizmet satmaz; ticari hizmetler ağın dışındadır. PO1–PO4 geçerlidir.
