---
document_id: ADR-0038
title: "Sandbox: test ağı"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-06
summary: >
  Tamga Network, gerçek ağdan tamamen ayrı bir test ağı işletir: sandbox.tamga.network. Kendi test kök sertifikası, kendi
  güven listesi, örnek kurumları, sahte kişileri ve her belge türünden örnek belgeleri vardır. Cüzdan geliştiricileri,
  kurumlar ve doğrulayıcılar bütün akışı uçtan uca burada dener. Gerçek ağdaki hiçbir cüzdan ya da doğrulayıcı sandbox'a
  güvenmez; sandbox'ta gerçek kişisel veri bulunmaz ve veriler her an sıfırlanabilir.
domain: Trust
---

> **[[ADR-0040]] ve [[ADR-0041]] ile kısmen değiştirildi (2026-10-04; ADR-0040 2026-10-05'te güncellendi):** sandbox'ta
> gerçek kimlik doğrulama adımları herkese açık, gerçek ağın sağlayıcı hesabıyla, günlük/aylık tavanla ve en az veriyle
> denenebilir (K4 ve SB3 değişti); kurumlar kendi test kurumunu açıp sandbox'ta yeniden açılan
> Kurum Konsolu'nda deneyebilir (K1'deki "konsol yok" ve K7'deki kurumların kendi kendine kaydı değişti). Diğer maddeler geçerlidir.

# Kısaca

Bir cüzdan, bir kurum ya da bir doğrulayıcı ağa katılmadan önce her şeyi denemek ister. Bugün bunun için ya kendi
bilgisayarında yerel bir deneme ortamı kurmak ya da gerçek servisleri kullanmak gerekiyor. Ayrıca henüz resmî anlaşma
yapılmış bir kurum yok; uçtan uca deneme için örnek kurumlara ve örnek belgelere ihtiyaç var.

Bu karar, ağın yanında ayrı bir test ağı açar: sandbox.tamga.network. Orada her şey gerçeğinin aynısıdır, yalnız güven
kökü, anahtarlar, listeler ve veriler ayrıdır ve sahtedir.

# Bağlam

- [[ADR-0037]] ağın "çalışması, denenmesi ve kurumların katılması için" referans hizmetler işlettiğini söyler. Bir test ağı
  bu tanımın içindedir; satılmaz ve herkese aynı koşullarla açıktır.
- Ağa katılım bir [[t:conformance]] şartına bağlıdır (Tamga ARF, Trust Framework §4.3). Uyumu sınamanın en doğal yolu,
  gerçek ağın davranışını taşıyan ama gerçek ağa dokunmayan bir ortamdır.
- AB'de de cüzdanlar ve doğrulayıcılar, gerçek güven listelerinden ayrı test ortamlarında ve birlikte çalışabilirlik
  etkinliklerinde sınanır.
- Bugünkü yerel geliştirme ortamı (geliştirme PKI'sı, yerel güven listeleri) yalnız tek bilgisayarda çalışır; telefondaki
  bir cüzdan, başka bir kurumun sunucusu ya da bir doğrulayıcı ona erişemez.

# Karar

**K1 — Ayrı bir test ağı.** Tamga Network, gerçek ağdan ayrı bir test ağı işletir. Adresi `sandbox.tamga.network` (tanıtım
sayfası ve rehber); içindeki hizmetler gerçek ağdaki düzenin aynısıyla bu adresin alt adlarındadır: `trust.sandbox`,
`issuer.sandbox`, `status.sandbox`, `verify.sandbox`, `wallet.sandbox`, `id.sandbox` (`….sandbox.tamga.network`). Böylece
hizmetler gerçek ağdaki gibi çalışır; bir cüzdan ya da doğrulayıcı yalnız alan adını değiştirerek geçer. Sandbox'ta kurum
konsolu çalışmaz: örnek kurumlar, kişiler ve yetkiler tohum verisinden gelir.

**K2 — Tam ayrım.** Sandbox'ın kendi test kök sertifikası, kendi imza anahtarları ve kendi listelerin listesi
([[t:LOTL]]) vardır. Sandbox listesi kendini açıkça "test" olarak işaretler. Gerçek ağın kökü sandbox'ta hiçbir şey
imzalamaz; sandbox kökü gerçek ağın hiçbir listesinde yer almaz. Gerçek ağdaki cüzdanlar ve doğrulayıcılar sandbox'a
güvenmez; bir cüzdan sandbox'a ancak geliştirici ayarında açıkça geçildiğinde bağlanır ve bunu ekranda belli eder.

**K3 — Görünür işaret.** Sandbox'ta verilen her belge test belgesi olduğunu taşır (test kurumunun adı ve test listesi);
sandbox sayfaları ve cüzdan ekranları "Sandbox · test" işaretini gösterir. Sandbox belgesi gerçek bir işlemde kullanılamaz,
çünkü gerçek doğrulayıcı onun kökünü tanımaz.

**K4 — Yalnız sahte veri.** Sandbox'taki kurumlar, kişiler ve belgeler örnektir. Gerçek kişisel veri girilmez; kimlik
doğrulama adımı sahte bir sağlayıcıyla yapılır. Örnek kişilerin kimlik numaraları açıkça sahtedir.

**K5 — Sıfırlanabilirlik.** Sandbox verileri istenen her an, düzenli olarak da kendiliğinden ilk hâline döner. Sandbox'ta
kalıcılık beklenmez.

**K6 — İçerik.** Sandbox'ta en az şunlar bulunur: test listeleri ve çapa günlüğü; her belge türü için en az bir örnek kurum
(eğitim, kimlik, etkinlik bileti, iletişim belgeleri); örnek kişiler; test doğrulayıcısı ve örnek doğrulama sayfaları
("Tamga ile giriş yap", yaş doğrulama, diploma doğrulama, bilet kapısı); test cüzdan sağlayıcısı; kullanım rehberi.
Örnek kurumlar, deneme gerçekçi olsun diye gerçek kurum adlarını taşıyabilir. Bu durumda sandbox'ın her sayfası ve
kullanım rehberi, adların yalnızca gerçekçi bir deneme ortamı için kullanıldığını, bu kurumlarla bir ilişki ya da anlaşma
olmadığını ve belgelerin test anahtarıyla imzalandığı için hiçbir yerde geçerli olmadığını açıkça yazar; kurum logoları
kullanılmaz.

> **Not (2026-10-06, proje yönetimi):** İstanbul Bilgi Üniversitesi ile pilot ortaklık anlaşması vardır. Bu kurum için not
> "pilot ortağımızdır" der; sandbox'taki hâli yine yalnız test kurumudur. "İlişki ya da anlaşma yoktur" cümlesi diğer örnek
> kurumlar için geçerlidir. Test anahtarı uyarısı ve logo kuralı değişmez.

> **Değişiklik (2026-10-06, [[ADR-0042]] K3):** K1'deki `wallet.sandbox` ve K6'daki "test cüzdan sağlayıcısı" ağın hizmeti
> değildir. Ağ cüzdan sağlayıcısı işletmez; sandbox'ta da her cüzdan kendi sağlayıcısını işletir ve sandbox listesine
> kaydolur (bugün proje yönetimi onayıyla). Önceden çalışan `wallet.sandbox.tamga.network` 2026-10-06'da kaldırıldı; sandbox'ın
> kendi cüzdan sağlayıcısı yoktur, Tamga Wallet'ın sağlayıcısı (`provider.tamgawallet.com`) sandbox listesinde kayıtlıdır. Sandbox tektir; ayrı bir cüzdan sandbox'ı kurulmaz.

**K7 — Sonraki adımlar ayrı karar ister.** Dış katılımcıların kendi kurumlarını, doğrulayıcılarını ya da cüzdan
sağlayıcılarını sandbox listesine kendileri eklemesi (kendi kendine kayıt) ve cüzdanları otomatik sınayıp rapor veren bir
uyum servisi sonraki aşamalardır; açılmadan önce ayrıca karara bağlanır.

# Değişmezler

| Kod | Kural |
|---|---|
| SB1 | Sandbox kök sertifikası ve sandbox liste imzacıları gerçek ağın hiçbir listesinde yer almaz; gerçek ağın kök ve imza anahtarları sandbox'ta hiçbir şey imzalamaz. |
| SB2 | Sandbox listelerin listesi kendini test olarak işaretler; gerçek ağ için yapılandırılmış bir cüzdan ya da doğrulayıcı sandbox listesini kabul etmez. |
| SB3 | Sandbox'ın varsayılan kimlik doğrulaması sahte sağlayıcıdır (hızlı deneme) ve örnek kimlik numaraları geçersiz biçimdedir; gerçek kişinin verisi yalnız kişinin kendisinin seçtiği [[ADR-0040]] gerçek yolunda ve oradaki sınırlarla girer (taramadan önce uyarı ve onay, günlük/aylık tavan, gerçek kimlik ve belge numarası belgeye yazılmaz, sağlayıcı oturumu hemen silinir, her şey gece sıfırlamasında silinir). |
| SB4 | Sandbox'ta verilen her belge ve sandbox'a bağlı her ekran test olduğunu görünür biçimde belirtir. |
| SB5 | Sandbox verileri her an sıfırlanabilir; sandbox'a bağlı hiçbir süreç kalıcılık varsaymaz. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Yalnız yerel geliştirme ortamı | ret | Telefondaki cüzdan, başka kurumların sunucuları ve doğrulayıcılar erişemez; uçtan uca deneme yapılamaz. |
| Gerçek ağda "deneme" kurumları | ret | Test belgeleri gerçek doğrulayıcılarda geçerli olur; güven listesi kirlenir. |
| **Ayrı kök ve listelerle test ağı** | **kabul** | Gerçek ağın davranışını taşır, ama gerçek ağa hiçbir yoldan karışmaz; herkes aynı ortamda dener. |
| Tek adres altında yollar (`sandbox.tamga.network/issuer/…`) | ret | Hizmetler kök adresle çalışacak biçimde yazılmış (sayfa bağlantıları, yönlendirmeler, çerezler, well-known adresleri); yol öneki her hizmette ayrı uyarlama ister ve gerçek ağdan farklı davranır. |
| **`sandbox.tamga.network` altında hizmet başına alt ad** | **kabul** | Gerçek ağın düzeninin aynısı; hizmet kodu değişmez. |

# Sonuçlar

- Sandbox, gerçek ağın servislerini (liste yayıncısı, belge veren, doğrulayıcı, cüzdan sağlayıcı, kimlik servisi) ayrı
  ayarlarla, ayrı anahtarlarla ve ayrı veritabanıyla çalıştırır. Kurum konsolu sandbox'ta yoktur; örnek kurumlar, kişiler ve
  yetkiler tohum verisinden kurulur ve her sıfırlamada ilk hâline döner.
- Tamga Wallet ve ağın kurallarına uyan her cüzdan, geliştirici ayarında sandbox'a geçebilir; sandbox kökü cüzdanın içinde
  ayrı tutulur, gerçek kökle karışmaz.
- Geliştirici belgelerine bir "Sandbox" rehberi, Learn'e kısa bir anlatım, ARF'ye test ağının gerçek ağın parçası olmadığını
  söyleyen bir not eklenir.
- Otomatik cüzdan analizi ve uyum raporu ileride ayrıca ele alınır.

# Durum

**Accepted — 2026-10-03** (proje yönetimi onayı; birebir alıntı özel onay kaydında). K4 ve SB3 [[ADR-0040]] ile (sandbox'ta gerçek
kimlik doğrulama; 2026-10-05'te herkese açık), K1'deki "kurum konsolu çalışmaz" ve K7'deki kurumların kendi kendine kaydı [[ADR-0041]] ile (kurum test
hesapları) değişti (2026-10-04). K1/K6'daki test cüzdan sağlayıcısını ağın çalıştırması [[ADR-0042]] ile değişti (2026-10-06):
sandbox'ta cüzdan sağlayıcısını cüzdan işletir.
