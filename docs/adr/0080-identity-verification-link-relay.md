---
document_id: ADR-0080
title: "Kimlik doğrulama bağlantısının iletilmesine karşı iki katman: cüzdanda son onay ve doğrulama öncesi uyarı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Kimlik servisi kimlik doğrulamayı bir dış kimlik doğrulama sağlayıcısına yönlendirir. Saldırgan akışı kendi cüzdanından başlatıp
  doğrulama bağlantısını bir başkasına iletirse, o kişi kendi kimliğiyle doğrular ve kimlik belgesi saldırganın cüzdanına verilir.
  Karar iki katmandır: (1) belge verilmeden önce akışı başlatan cüzdanda son onay ekranı — kimlik servisi doğrulanan kimliğin
  maskeli özetini (ad ve soyadın baş harfleri, doğum yılı) yalnız o cüzdana döndürür, kişi "bu benim" demeden belge verilmez;
  (2) doğrulamayı yapan kişiye, doğrulama başlamadan önce bunun hangi cüzdan için yapıldığını söyleyen uyarı. Uygulama ertelendi:
  kimlik doğrulama herkese açılmadan önce yapılır.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0025]]", "[[ADR-0040]]", "[[ADR-0042]]", "[[SPEC-ID-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
---

# Kısaca

Tamga kimlik belgesi almak için kişi kimlik belgesini ve yüzünü bir doğrulama sayfasında gösterir. Bu sayfanın bağlantısı
başkasına gönderilebilir. Kötü niyetli biri kendi telefonunda işlemi başlatıp bağlantıyı "başvurunuz için kimliğinizi doğrulayın"
diyerek bir başkasına yollarsa, o kişi farkında olmadan kendi kimliğini saldırganın cüzdanına vermiş olur. Bu karar iki önlem
koyar: belge verilmeden önce cüzdan "doğrulanan kimlik bu, sizin mi?" diye sorar; doğrulama sayfası da en başta "bu doğrulama
şu telefondaki cüzdan için yapılıyor, bağlantıyı siz açmadıysanız devam etmeyin" der.

# Bağlam

- Kimlik doğrulama yalnız kimlik servisindedir ([[ADR-0011]], SPEC-ID-0003/IDP3). Akış: cüzdan yetki isteğini açar → kişi kimlik
  servisinin sayfasında aydınlatma metnini okur ve rıza verir (IDP11) → kimlik servisi kimlik doğrulama sağlayıcısında bir oturum
  açar ve kişiyi oraya yönlendirir → kişi belgesini ve yüzünü gösterir → sağlayıcı kişiyi kimlik servisine geri yönlendirir →
  kimlik servisi yetki kodunu verir → cüzdan kodu belirtece çevirir ve belgeyi ister. Belge, akışı başlatan cüzdanın donanım
  anahtarına bağlanır.
- **2026-11-11 düzeltmesi.** Yetki kodu artık yalnız sağlayıcının dönüş adresindeki tek kullanımlık anahtarla verilir. Akışın
  kimliğini bilmek yetmez; kodu, doğrulamayı bitiren tarayıcı alır.
- **Kalan açık.** Doğrulama oturumunun bağlantısı (ya da sağlayıcının "başka cihazda devam et" yolu) iletilebilir. Doğrulamayı
  kimin yaptığı ile akışı kimin başlattığı arasında teknik bir bağ yoktur: sağlayıcı "bu belge gerçek ve bu yüz belgedeki kişi"
  der; "bu kişi, akışı başlatan cüzdanın sahibi" demez.
- Gerçek ağda kimlik doğrulama bugün davetlidir; açık bu yüzden bugün sınırlıdır. Erişim herkese açılınca saldırı ölçeklenir.

## Tehdit modeli

| | |
|---|---|
| Saldırgan | Kendi telefonunda, cihaz kanıtından geçen gerçek bir cüzdanı vardır. Akışı kendisi başlatır, rızayı kendisi verir. Kurbana ileti gönderebilir ve onu inandırıcı bir bahaneyle (iş başvurusu, ödül, banka, kargo) yönlendirebilir. |
| Kurban | Kendi kimlik belgesine ve yüzüne sahiptir; cüzdanı olmayabilir. Bağlantıyı açar ve gerçek bir kimlik doğrulama sayfası görür. Bir cüzdana kimlik verdiğini bilmez. |
| Saldırının sonucu | Kurbanın kimliğini taşıyan, saldırganın cihaz anahtarına bağlı gerçek bir kimlik belgesi. Saldırgan bu belgeyle kurban adına kimlik gösterir. |
| Kapsam dışı | Kimliğini bilerek başkasına kullandıran kişi (teknik önlemle çözülmez; kimliğini elden vermekle aynıdır). Sahte belge ve sahte yüz (sağlayıcının işi). Çalınmış telefon (cüzdan kilidi ve cüzdan birimi iptali). |

Aynı açığın ters yönü de vardır: kişi akışı kendi cüzdanından başlatır, "yardım eden" biri doğrulamayı kendi kimliğiyle bitirir;
kişinin cüzdanına başkasının kimliği girer.

# Karar

- **K1 — Katman 1: cüzdanda son onay.** Doğrulama bittikten sonra, belge verilmeden önce kimlik servisi doğrulanan kimliğin
  **maskeli özetini** yalnız akışı başlatan cüzdana döndürür. Cüzdan özeti gösterir ve sorar: "Doğrulanan kimlik bu. Bu siz
  misiniz?" Kişi "bu benim" demeden cüzdan belgeyi istemez; kimlik servisi de onay kaydı olmayan belirteçle belge vermez. Kişi
  "bu ben değilim" derse akış kapanır, belge verilmez, sağlayıcıdaki oturum silinir.
- **K2 — Maskeli özetin içeriği.** Yalnız adın ve soyadın baş harfleri ile doğum yılı (ör. "A. K. · 1990"). Tam ad, ulusal
  kimlik numarası, belge numarası, doğum günü ve ayı, fotoğraf özete girmez.
- **K3 — Katman 2: doğrulama öncesi uyarı.** Doğrulama başlamadan önce, doğrulamayı yapan kişinin gördüğü ilk ekranda şu
  metin yer alır: "Bu doğrulama *⟨cihaz ve cüzdan tanımı⟩* üzerindeki cüzdan için yapılıyor. Bağlantıyı siz açmadıysanız devam
  etmeyin." Cüzdanın adı güven listesindeki kayıttan gelir (ör. "Tamga Wallet"); cihaz tanımı kaba bir etikettir (ör. telefonun
  türü). Sağlayıcının sayfası bu metni taşıyacak kadar özelleştirilemiyorsa, kimlik servisinin kendi ara sayfası sağlayıcının
  önüne konur.
- **K4 — İkisi birlikte.** Katmanlar birbirinin yerine geçmez (aşağıda). İkisi de uygulanmadan kimlik doğrulama herkese
  açılmaz.
- **K5 — Uygulama zamanı.** Kod bu kararla değişmez. Uygulama **erişim herkese açılmadan önce** yapılır; o güne kadar gerçek
  ağda kimlik doğrulama davetli kalır. Yeni alan, uç ve hata adları uygulama sırasında onaylanır.

## Katman 1 tek başına neden yetmez

Asıl saldırıda "bu benim" sorusu yanlış kişiye sorulur: akışı başlatan cüzdan saldırganındır ve saldırgan onaylar. Katman 1'in
kattığı şudur:

- Ters yönü ve dürüst hataları yakalar: cüzdanına başkasının kimliği girmek üzere olan kişi baş harflerden ve doğum yılından
  bunu görür.
- Saldırganı açık bir yalan beyana zorlar ("bu benim"); olay, kişisel veri içermeyen bir denetim kaydı olarak kalır.

Asıl saldırıda dürüst olan tek taraf kurbandır ve ona ulaşılabilen tek yer doğrulamanın başıdır. Katman 2 bunun içindir. Katman 2
de tek başına yetmez: uyarılar okunmadan geçilebilir ve sağlayıcının sayfası bizim denetimimizde değildir.

## Maskeli özetin kişisel veri değerlendirmesi

- **Kişisel veridir.** Maskeli olsa da belirli bir kişiye aittir; kişisel veri kuralları aynen uygulanır (veri en aza indirilir,
  amaçla sınırlıdır).
- **Kime gösterilir.** Yalnız akışı başlatan cüzdana, o cüzdanın anahtarına bağlı kanaldan (belirteç ve cüzdan örneği anahtarı).
  Adrese, sorgu parametresine ya da yönlendirmeye yazılmaz.
- **Nerede tutulur.** Kimlik servisi özeti, belgeyi üreteceği doğrulanmış alanlardan o anda türetir; ayrıca saklamaz. Belge
  verilince ya da akış kapanınca kişi alanlarıyla birlikte silinir (IDP9). Günlüğe ve denetim kaydına yalnız olay adı yazılır
  (özet gösterildi, onaylandı, reddedildi); özetin kendisi yazılmaz. Cüzdan özeti yalnız ekranda gösterir; işlem günlüğüne
  yazmaz.
- **Yanlış kişiye gösterilirse.** Asıl saldırıda kurbanın özeti saldırganın cüzdanında görünür. Bu yüzden özet, dürüst bir
  kişinin kendini tanımasına yetecek ama yabancıya bir şey kazandırmayacak kadar dardır: saldırgan, hedef aldığı kişinin adını
  çoğu zaman zaten bilir; baş harfler ve doğum yılı kimlik numarası ya da tam doğum tarihi vermez. Tam ad, doğum günü ve fotoğraf
  bu yüzden özete alınmadı.
- **Aydınlatma.** Rıza öncesi aydınlatma metni (IDP11) son onay adımını ve özetin gösterileceğini söyler.
- **Uyarıdaki cihaz tanımı.** Kaba bir etikettir (telefonun türü, cüzdanın adı); seri numarası, kalıcı cihaz kimliği ya da
  konum taşımaz; yalnız akış süresince tutulur.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **Cüzdanda son onay + doğrulama öncesi uyarı** | **kabul** | Sağlayıcıdan bağımsız uygulanır; kişisel veri saklamaz; iki katman birbirinin açığını kapatır. Kalan risk aşağıda |
| Yalnız cüzdanda son onay | ret | Asıl saldırıda onaylayan saldırganın kendisidir |
| Yalnız uyarı | ret | Uyarı okunmayabilir; ters yönü ve dürüst hataları yakalamaz |
| Sağlayıcı oturumunu cihaza bağlamak (doğrulama yalnız akışı başlatan cihazda tamamlanabilsin) | şimdi seçilmedi | Sağlayıcının yeteneğine bağlıdır. Cüzdanın içine sağlayıcı bileşeni koymak, cüzdanın sağlayıcıyı bilmemesi kuralına (IDP3) ve ağın cüzdan işletmemesine ([[ADR-0042]]) aykırıdır; her uyumlu cüzdanı tek bir sağlayıcıya bağlar. Tarayıcıda yapılan doğrulamada "aynı cihaz" güvenilir biçimde kanıtlanamaz. Sağlayıcı böyle bir ayar sunarsa ek sertleştirme olarak yeniden değerlendirilir |
| Yüz eşleştirmeyi cüzdan cihazında yeniden istemek (belge verilmeden önce cüzdandan canlı yüz, doğrulamadaki yüzle eşleştirilir) | şimdi seçilmedi | Teknik olarak en güçlü bağ. Ama doğrulamadaki yüzün ya da şablonunun onay anına kadar tutulmasını ister: bu özel nitelikli kişisel veridir ve "görüntü saklanmaz" kuralına (IDP4, IDP9) aykırıdır. Saldırganın denetimindeki cihazda kamera girdisi taklit edilebilir (ek canlılık denetimi gerekir); her belge verme için ek sağlayıcı işlemi ve erişilebilirlik yükü getirir |
| Kimlik belgesini yalnız yüz yüze vermek | ret | Uzaktan kimlik doğrulamanın amacını ortadan kaldırır |

**Kalan risk (bilinçli).** Kurbanı uyarıyı görmezden gelmeye ikna eden kararlı bir saldırgan başarılı olabilir. Bu, kişinin
kimliğini bilerek başkasına kullandırmasıyla aynı sınıftadır. Ölçek büyürse yukarıdaki iki yol yeniden ele alınır.

# Değişmezler

| Kod | Kural |
|---|---|
| VL1 | Kimlik belgesi, akışı başlatan cüzdanda kişi doğrulanan kimliğin maskeli özetini görüp "bu benim" diye onaylamadan verilmez. Onay yoksa ya da kişi reddederse belge verilmez, akış kapanır ve sağlayıcıdaki oturum silinir. |
| VL2 | Maskeli özet yalnız adın ve soyadın baş harflerinden ve doğum yılından oluşur; yalnız akışı başlatan cüzdana, o cüzdanın anahtarına bağlı kanaldan döner; adrese, günlüğe ve denetim kaydına yazılmaz ve akış bitince tutulmaz. |
| VL3 | Kimlik doğrulama başlamadan önce, doğrulamayı yapan kişiye bu doğrulamanın hangi cüzdan için yapıldığı ve bağlantıyı kendisi açmadıysa devam etmemesi gerektiği gösterilir. Sağlayıcının sayfası bu metni taşıyamıyorsa kimlik servisinin kendi ara sayfası sağlayıcının önüne konur. |
| VL4 | Gerçek ağda kimlik doğrulama, VL1–VL3 uygulanmadan herkese açılmaz. |

# Uygulama planı

Kod bu depoda değil ağırlıkla kimlik servisinde (operatör deposu) ve cüzdan uygulamalarındadır.

1. **Kimlik servisi.** (a) Maskeli özet: doğrulanmış ad, soyad ve doğum tarihinden türetme (Türkçe ve Latin dışı harflerde
   baş harf kuralı; tek adlı kişiler). (b) Özetin akışı başlatan cüzdana dönüşü: belirteç yanıtında ya da belirtece bağlı ayrı
   bir uçta; adrese yazılmaz. (c) Onay kaydı: belge ucu, onay kaydı olmayan belirteci açık bir hatayla reddeder; ret hâlinde akış
   kapanır ve sağlayıcı oturumu silinir. (d) Uyarı: sağlayıcının sayfa özelleştirmesi yetiyorsa orada; yetmiyorsa kendi ara
   sayfası. Ara sayfa yalnız, iletilebilen bağlantı ondan geçiyorsa işe yarar: sağlayıcı oturumu kişi ara sayfada "devam"
   dediğinde ve kısa ömürlü açılır; sağlayıcının oturum bağlantısı bundan sonra da iletilebiliyorsa bu, sağlayıcının
   yetenekleriyle birlikte sınanır ve kalan risk olarak kayda geçer. (e) Denetim kaydı: yalnız olay adları. (f) Testler:
   iletilen bağlantı senaryosu, ret, onaysız belge isteği, sayfa yenileme.
2. **Cüzdan çekirdeği (`@tamga-network/wallet-core`) ve cüzdan uygulaması.** Belge alma istemcisi özeti uygulamaya verir ve
   onay olmadan belge isteği göndermez; uygulama son onay ekranını gösterir ("bu benim" / "bu ben değilim"); özet günlüğe
   yazılmaz. Uyumlu cüzdanlar için kural [[SPEC-WALLET-0001]] ve cüzdan kontrol listesine eklenir.
3. **Şartnameler.** SPEC-ID-0003 (akış ve kurallar), [[SPEC-PROTO-0001]] (kimlik servisinin belge verme akışındaki ek adım).
4. **Metinler.** Son onay ekranı, uyarı ve aydınlatma metni eki Türkçe, İngilizce, Azerbaycanca ve Türkmence.
5. **Sıra.** Kimlik servisi ve cüzdan birlikte yayımlanır; eski cüzdan sürümü onaysız belge isteyemeyeceği için en düşük cüzdan
   sürümü güven listesindeki cüzdan kaydıyla yükseltilir.

# Durum

**Accepted — 2026-11-12.** Proje yönetiminin onayıyla (2026-11-12). DECISIONS: D-ID-15. VL1–VL4 bağlayıcıdır; uygulama kimlik
doğrulama herkese açılmadan önce yapılır.
