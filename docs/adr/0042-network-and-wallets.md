---
document_id: ADR-0042
title: "Ağ ve cüzdanlar: ağ cüzdan işletmez"
status: Active
version: 1.0.0
created: 2026-10-06
last_updated: 2026-10-06
summary: >
  Tamga Network bağımsız bir ağdır (ileride vakıf); hiçbir cüzdanın uygulamasını, cüzdan sağlayıcısını ya da sitesini işletmez.
  Ağ kuralları, güven listelerini, açık paketleri ve ortak hizmetleri (doğrulayıcı, kimlik servisi, sandbox) sağlar; bir cüzdanı
  yalnız güven listesindeki kaydıyla tanır. Tamga Wallet ayrı bir projedir ve ağa her cüzdanla aynı yoldan girer. Ağın alan
  adlarında cüzdana ait hizmet çalışmaz; daha önce orada çalışan `wallet.tamga.network` ve `wallet.sandbox.tamga.network`
  2026-10-06'da ağdan kaldırıldı. Tamga Wallet'ın sağlayıcısını cüzdanın işletmecisi `provider.tamgawallet.com`'da işletir. Sandbox tektir ve ağındır: cüzdan geliştiricileri cüzdanlarını orada dener, cüzdanın
  sağlayıcısını cüzdan işletir ve sandbox listesine kaydolur. Ağın arayüzleri ve belgeleri tek bir cüzdanı öne çıkarmaz.
domain: Governance
---

# Kısaca

Tamga Network ile Tamga Wallet iki ayrı yapıdır. Ağ, Türk dünyası için kuralları ve güven listesini tutan bağımsız yapıdır
(ileride vakıf). Tamga Wallet o kurallara uyan bir cüzdan uygulamasıdır; ağın ilk cüzdanıdır ama ağın parçası değildir. Bu karar
ikisinin sınırını çizer: ağ cüzdan işletmez, cüzdanları listeler.

# Bağlam

- [[ADR-0035]]: ağ cüzdanları kurallara göre tanır, cüzdan ağa kilitli değildir. [[ADR-0037]]: ağ yalnızca ağdır; ürünler ve
  hizmetler başka yapılardadır.
- Tamga Wallet ağ deposunun içinde geliştirilmeye başlandı; uygulama 2026-10-02'de kendi deposuna taşındı. Cüzdanın arka ucu
  olan **cüzdan sağlayıcı** ([[t:wallet-provider]]; birim kaydı, cihaz kanıtı, cüzdan birimi kanıtı WIA ve anahtar kanıtı KA —
  [[ADR-0025]]; uzaktan kapatma) cüzdanın kendi sunucusu ve alan adı olmadığı için ağın sunucusunda, ağın alan adı altında
  çalışmaya devam etti: `wallet.tamga.network` ve sandbox'ta `wallet.sandbox.tamga.network` ([[ADR-0038]]).
- AB yapısında her cüzdanı onu sunan kuruluş işletir (Wallet Provider); güven çerçevesi cüzdan sağlayıcıları yalnız listeler.
- Ağın bazı arayüzlerinde ve belgelerinde tek bir cüzdanın adı sabit yazılıydı ("Tamga Wallet'ta aç" gibi).

# Karar

**K1 — Ağ cüzdan işletmez.** Tamga Network hiçbir cüzdanın uygulamasını, cüzdan sağlayıcısını, sitesini ya da destek
hizmetini işletmez ve barındırmaz. Ağın cüzdanlarla ilişkisi kurallar ([[SPEC-WALLET-0001]], ARF), açık paketler
(`@tamga-network/wallet-core`, `@tamga-network/zk` …) ve güven listesindeki cüzdan sağlayıcı kaydıdır (`wallet_providers[]`:
adres, imza sertifikası, çözüm adı). Tamga Wallet listeye her cüzdanla aynı yoldan girer; ayrıcalığı yoktur.

**K2 — Ağın alan adları ağın hizmetleri içindir.** `tamga.network` ve alt adlarında yalnız ağın hizmetleri çalışır (liste
yayını, doğrulayıcı, kimlik servisi, belge veren referans servisi, Kurum Konsolu, sandbox, belgeler, site). Cüzdana ait hizmet
ağın alan adında çalışmaz. **Geçiş (2026-10-06'da yapıldı):** sistemi henüz kullanan olmadığı için geçiş süresi beklenmedi;
proje yönetimi kararıyla `wallet.tamga.network` ve `wallet.sandbox.tamga.network` hemen ağdan kaldırıldı, kod ağ deposundan
çıktı. Tamga Wallet'ın sağlayıcısını cüzdanın işletmecisi `https://provider.tamgawallet.com` adresinde işletir (henüz canlı
değil); güven listelerindeki (gerçek ağ ve sandbox) adres bu adrese yenilendi.

**K3 — Sandbox tektir ve ağındır.** Sandbox ([[ADR-0038]]) cüzdan, kurum ve doğrulayıcı geliştiricilerinin ağın kurallarını
denediği tek test ortamıdır; ayrıca bir "cüzdan sandbox'ı" kurulmaz. Sandbox'ta da cüzdan sağlayıcıyı cüzdan işletir: cüzdan
geliştiricisi kendi sağlayıcısını sandbox listesine kaydettirir ve cüzdanını sandbox'taki örnek kurumlarla, kimlik servisiyle ve
doğrulayıcıyla dener. Tamga Wallet'ın sağlayıcısı hem gerçek ağ hem sandbox listesinde kayıtlıdır. Bugün kayıt proje yönetimi
onayıyla elle yapılır; cüzdan sağlayıcıların kendi kendine kaydı ([[ADR-0038]] K7'nin kalanı) ayrı karar ister.

**K4 — Ağ tek bir cüzdanı öne çıkarmaz.** Ağın arayüzleri, paketleri ve belgeleri cüzdanı genel adla anar ("cüzdanında aç");
bir cüzdanın adı gerektiğinde güven listesindeki kayıt verisinden gelir. Ağın sitesinde Tamga Wallet "ağın ilk cüzdanı" diye
anılabilir; cüzdanın tanıtımı cüzdanın kendi sitesindedir.

**K5 — Test sertifikaları geneldir.** Ağın kendi testleri ve geliştirme PKI'si genel bir "test cüzdan sağlayıcısı"
sertifikası kullanır. Gerçek bir cüzdan sağlayıcının anahtarını cüzdan kendisi üretir ve saklar; ağ yalnız sertifikasını listeler.

**K6 — Ağın ortak hizmetleri herkese açıktır.** Kimlik servisi ([[ADR-0011]]) ve mağaza inceleme kodu ([[ADR-0033]]) ağın
hizmetleridir ve listedeki her cüzdana aynı koşullarla açıktır.

# Değişmezler

| Kod | Kural |
|---|---|
| NW1 | Ağ hiçbir cüzdanın uygulamasını, cüzdan sağlayıcısını ya da sitesini işletmez; cüzdanları yalnız güven listesindeki kayıtlarıyla tanır. |
| NW2 | Ağın alan adlarında cüzdana ait hizmet çalışmaz. |
| NW3 | Sandbox tek test ortamıdır; sandbox'ta cüzdan sağlayıcıyı cüzdan işletir ve sandbox listesine kaydolur. |
| NW4 | Ağın arayüzleri ve paketleri cüzdan adını sabit yazmaz; gerekirse güven listesindeki kayıt verisinden alır. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Ağ, Tamga Wallet'ın sağlayıcısını işletmeyi sürdürür | ret | Ağın tarafsızlığı bozulur ([[ADR-0035]]); vakfa devirde cüzdanın hizmeti ağa bağlı kalır; AB yapısına uymaz. |
| Cüzdan için ayrı sandbox | ret | Aynı kurumlar, doğrulayıcı ve kurallar iki kez kurulur; cüzdan geliştiricisi ağın gerçek kurallarını tek yerde denemelidir. |
| **Ağ listeler, cüzdan işletir; sandbox tek** | **kabul** | AB çerçevesiyle aynı rol ayrımı; her cüzdan aynı yoldan girer. |

# Sonuçlar

- Cüzdan sağlayıcının kodu Tamga Wallet deposuna taşındı (`provider/`); ağ deposundaki kopya 2026-10-06'da silindi. Ağ
  sunucusundaki `tamga-wallet-provider` ve `tamga-sandbox-wallet-provider` servisleri, nginx blokları ve DNS kayıtları ağdan
  kaldırılır. Güven listelerindeki Tamga Wallet kaydı cüzdanın işletmecisine ve `https://provider.tamgawallet.com` adresine
  yenilendi; işletmeci canlıya geçerken kendi cüzdan sağlayıcı sertifikasını verir.
- Ağın arayüzlerindeki sabit cüzdan adları genel ifadeye çevrilir; liste yayıncısı cüzdan sağlayıcının adını kayıt verisinden alır.
- Sonraki iş (ayrı karar): sandbox'ta cüzdan sağlayıcıların kendi kendine kaydı ve cüzdan geliştiricisinin adresini verdiği,
  sandbox'ın cüzdanı kurallara karşı kendiliğinden denediği otomatik uyum testi.

# Durum

**Accepted — 2026-10-06** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-GOV-9. [[ADR-0038]]'de
sandbox'ın test cüzdan sağlayıcısını ağın çalıştırdığı kısmı değişir (K3).
