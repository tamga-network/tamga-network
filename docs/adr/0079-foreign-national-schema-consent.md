---
document_id: ADR-0079
title: "Başka devletin ulusal şemasına yetki: şema sahibi devletin onayı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Bir devlet, kendi kurumunu bir şemaya yetkilendirirken kontrat yalnız kurumun o devlete ait olduğuna ve şemanın kayıtlı olduğuna
  bakar; şemanın kime ait olduğuna bakmaz. Böylece bir devlet, kurumunu başka bir devletin ulusal şemasına tek başına
  yetkilendirebilir. Karar: bu yetki ancak şema sahibi devletin onayıyla verilebilir. Onay, şema başına açık bir kayıttır
  (şema, yetki alan devlet, zaman penceresi), karşılıklı tanıma kontratında tutulur ve şema sahibinin o devleti tanımasına
  bağlıdır. Ağ şemaları bu kuralın dışındadır. Uygulama ertelendi: ikinci devlet katılmadan önce yapılır.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0054]]", "[[ADR-0073]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Her devlet kendi belge türlerini (ulusal şemalarını) kendi tanımlar: örneğin bir devletin denklik belgesi. Bir kurumun hangi
türde belge verebileceğini de kurumun kendi devleti belirler. Bugünkü kontratta bu iki kural birbirine bağlı değil: bir devlet,
kendi kurumuna başka bir devletin ulusal belge türünü verme yetkisi yazabiliyor ve doğrulayıcılar bu belgeyi geçerli sayıyor.
Bu karar araya şema sahibi devletin onayını koyar: onay yoksa yetki yazılamaz.

# Bağlam

- [[ADR-0007]]: şemaların iki katmanı vardır. **Ağ şemaları** Governance oyuyla kaydedilir ve bütün üyelere açıktır. **Ulusal
  şemalar** bir devlete aittir; `vct`'leri o devletin ad alanındadır (`urn:tamga:<cc>:…`, [[ADR-0054]] NS1).
- Kurum–şema yetkisini kurumu kaydeden devlet verir (`IssuerRegistry.setSchemaAuthorization`). Doğrulamanın C2 adımı bu yetkiye
  bakar.
- **Bugünkü davranış (kontrat denetimi 2026-11-11).** Yetki fonksiyonu iki şeyi denetler: çağıran, kurumun devletinin delegesi
  mi (`onlyOwnerState`); yetki verilirken şema `SchemaRegistry`'de kayıtlı mı (`UnknownSchema`). Şemanın katmanına ve sahibi olan
  devlete **bakmaz**. Sonuç: A devleti, kendi kurumunu B devletinin ulusal şemasına B'nin bilgisi olmadan yetkilendirebilir; C2
  bu yetkiyi kabul eder. B'nin elindeki tek araç, A'yı ya da o kurumu tanımamaktır ([[SPEC-BC-0001]] §5): bu yalnız B'nin kendi
  doğrulayıcılarını korur, B'nin şemasına güvenen üçüncü devletleri korumaz.
- İmzalı liste aşamasında tek ulusal liste ve tek işletmeci vardır; sorun ikinci devlet katıldığında gerçek olur. Konu
  [[SPEC-BC-0001]] §14 madde 9'da karar bekliyordu.
- Egemenlik ilkesi ([[ADR-0002]]): bir devletin kaydını yalnız o devlet değiştirir. Ulusal şema o devletin kaydıdır; şemanın
  kimler tarafından kullanılacağı da onun kararıdır.

# Karar

- **K1 — Kural.** Bir devlet, kendi kurumunu başka bir devletin **ulusal** şemasına ancak şema sahibi devletin onayıyla
  yetkilendirebilir. Onay yoksa yetki yazımı reddedilir.
- **K2 — Ağ şemaları kapsam dışıdır.** Governance'ın kaydettiği ağ şemalarına yetki bugünkü gibi yalnız kurumun devletinin
  kararıdır; kendi ulusal şemasına yetki de öyle.
- **K3 — Onay, şema başına açık kayıttır.** Onay kaydı `(şema sahibi devlet, şema, yetki alan devlet)` üçlüsü için bir zaman
  penceresidir; yalnız şema sahibi devletin delegesi yazar ve geri alır. Kurum başına değil, devlet başınadır: hangi kurumunun
  yetkileneceği, yetki alan devletin kendi iç işidir.
- **K4 — Karşılıklı tanımaya bağ.** Onay kaydı karşılıklı tanıma kontratında (`CrossRecognition`) tutulur ve ancak şema sahibi
  devlet yetki alan devleti tanıyorken (tanıma kipi `NONE` değilken) yazılabilir. Tanıma kalkarsa onay da işlemez; ayrıca geri
  almak gerekmez.
- **K5 — Zaman kuralı.** Onay geri alınınca yeni yetki yazılamaz ve o andan sonra verilen belgeler C2'de düşer. Onay
  penceresi içinde verilmiş belgeler geçerli kalır: C2 belgenin `iat` anına göre hem yetki penceresine hem onay penceresine
  bakar ([[ADR-0073]] K5 ile aynı okuma).
- **K6 — Liste aşaması.** Liste yayıncısı aynı kuralı uygular: bir ulusal listedeki kurum, başka bir devletin ad alanındaki
  `vct` için ancak o devletin listesinde ya da ağ kayıtlarında karşılığı olan bir onay kaydıyla yetkilendirilir. Bugün tek
  ulusal liste olduğundan böyle bir yetki yoktur ve yazılmaz.
- **K7 — Uygulama zamanı.** Kod bu kararla değişmez. Kontrat, liste yayıncısı ve eşdeğerlik testi **ikinci devlet katılmadan
  önce** uygulanır; o güne kadar tek işletmeci bu tür bir yetki yazmaz. Ad ve arayüzler uygulama sırasında onaylanır.

# Değerlendirilen seçenekler

| Seçenek | Ne | Artı | Eksi | Sonuç |
|---|---|---|---|---|
| **(a) Şema başına açık onay kaydı** | Şema sahibi devlet `(şema, yetki alan devlet)` için onay yazar; yetki yazımı ve C2 bu kayda bakar | Onay görünür, tek tek geri alınabilir, zaman penceresi belge geçmişini korur; tanımanın bugünkü anlamı değişmez | Yeni kayıt türü ve bir okuma daha (kayıt kontratından tanıma kontratına) | **kabul** |
| (b) Tanıma politikasında şema kapsamı | Mevcut tanıma politikasına ("şu devletin şu kategorilerini tanıyorum") şema listesi eklenir; listede olan ulusal şema o devlete açılmış sayılır | Yeni kayıt türü yok | Tanıma "kimin belgesini kabul ederim" sorusudur; "şemamı kim kullanabilir" başka bir sorudur. İkisi tek listede birleşirse biri değişince öteki de değişir; şema düzeyinde tanıma zaten ayrı bir açık konudur ve bu yolla dolaylı olarak karara bağlanmış olur | ret |
| (c) Yasak | Başka devletin ulusal şemasına yetki hiç verilemez | En basit | Ortak tanınan ulusal türleri (ör. bir devletin sınav belgesini veren yurt dışı merkezleri) imkânsız kılar; her biri için ağ şeması istemek Governance'ı ulusal işlere sokar | ret |
| (d) Serbest, tanımayla korunma | Bugünkü durum | Kod değişmez | Şema sahibi yalnız kendi doğrulayıcılarını korur; şemasına güvenen üçüncü devletleri korumaz | ret |

Karşılıklı tanımaya bağ (K4) iki seçeneği birleştirmez: onay ayrı kayıttır (a), ama tanımadığınız bir devlete şemanızı açamazsınız.
Böylece tanıma geri alındığında unutulmuş bir onay açık kalmaz.

# Değişmezler

| Kod | Kural |
|---|---|
| FS1 | Bir devlet, kendi kurumunu başka bir devletin ulusal şemasına ancak şema sahibi devletin o devlet için yazdığı, yürürlükteki onay kaydıyla yetkilendirebilir. Ağ şemaları ve devletin kendi ulusal şemaları bu kuralın dışındadır. |
| FS2 | Onay kaydını yalnız şema sahibi devlet yazar ve geri alır; kayıt şema ve yetki alan devlet başınadır, zaman penceresi taşır ve ancak şema sahibi devlet yetki alan devleti tanıyorken yürürlüktedir. |
| FS3 | Doğrulamada başka devletin ulusal şemasıyla verilmiş belge, belgenin `iat` anında hem kurumun şema yetkisi hem şema sahibinin onayı yürürlükteyse kabul edilir; onayın sonradan geri alınması daha önce verilmiş belgeleri geçersiz kılmaz. |

# Sonuçlar

- **Uygulama bekliyor (ikinci devlet katılmadan önce).** Yapılacaklar: `CrossRecognition`'da onay kaydı ve okuma;
  `IssuerRegistry` yetki yazımında ve `isCredentialSchemaAcceptable`'da onay denetimi (şemanın katmanı ve sahibi
  `SchemaRegistry`'den okunur); olaylar ve indeksleyici; liste biçimi ve yayıncı denetimi; yeniden oynatma ve eşdeğerlik testi;
  kod boyutu payı. Depolama düzenine yalnız ekleme yapılır.
- O güne kadar: kontrat bu yetkiyi engellemez (bugünkü davranış, yukarıda). Çalışan zincir yoktur; liste aşamasında tek
  işletmeci böyle bir yetki yazmaz.
- [[SPEC-BC-0001]] §3.4 ve §14 madde 9: "karar verildi, uygulama bekliyor".
- Şema düzeyinde tanıma ([[SPEC-BC-0001]] §14 madde 2) bu kararla kapanmaz; ayrı konudur.

# Durum

**Accepted — 2026-11-12.** Proje yönetiminin onayıyla (2026-11-12). DECISIONS: D-BC-15. FS1–FS3 bağlayıcıdır; uygulama ikinci
devlet katılmadan önce yapılır.
