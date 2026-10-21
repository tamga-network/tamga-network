---
document_id: SPEC-WALLET-0001
title: "Cüzdan kuralları"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-19
summary: >
  Cüzdanın anahtar, depo, yedekleme ve onay tasarımını tanımlar. Merkezî bulgu
  bir GERİLİMİN çözümüdür: [[SPEC-CRED-0001]] §3 belge sahibi anahtarının güvenli
  bölgeden çıkamayacağını söylüyor, ama proje notlarındaki "24 kelime seed ile
  yedekleme" tasarımı anahtarın geri getirilebilir olmasını ima ediyordu. İkisi
  aynı anda doğru olamaz — ve seed'den türetilebilir bir belge sahibi anahtarı,
  belgeyi DEVREDİLEBİLİR kılarak holder binding açığını arka kapıdan geri
  getirir. Karar: anahtarlar seed'den türetilmez; yedek belgeleri ve manifestoyu
  taşır, cihaz değişiminde belgelerin YENİDEN VERİLMESİ gerekir. Ayrıca toplu verilen kopyaların
  doğrulayıcı başına yapışkan kullanımı iki açık konuyu birden kapatır.
---

# Kısaca

Bu belge, Tamga Network'e uyumlu her cüzdanın kendi içinde uyması gereken kuralları anlatır: anahtarlar, telefondaki kayıt,
yedekleme, onay ekranı ve belge kopyaları. Okuru cüzdan geliştiricileridir; Tamga Wallet (ayrı depo) bu kuralların referans
uygulamasıdır.

**Ne zaman okunur**

- Önce [Gizlilik](/concepts/privacy) ve [Belge gösterme](/concepts/presentation) kavram sayfalarını okuyun.
- Koda geçerken [[GUIDE-0005]] bu kuralları `@tamga-network/wallet-core` ile nasıl karşılayacağınızı gösterir.
- Cüzdanın kurumla ve [[t:verifier|doğrulayıcıyla]] konuştuğu protokoller burada değil: [[SPEC-PROTO-0001]] ve [[SPEC-PROTO-0002]].

**Sade anlatım**

Belgeye bağlı anahtarlar telefonun güvenli donanımında üretilir ve oradan hiç çıkmaz; bu yüzden yedeklenmez, telefon
değişince belgeler kurumdan yeniden alınır. Kişi her paylaşımda neyin kime gittiğini görür ve onaylar; gereğinden fazla
isteyen siteye ayrı bir uyarı çıkar. Cüzdan aynı belgenin birkaç kopyasını tutar: aynı siteye hep aynı kopyayı, farklı
sitelere farklı kopyaları gösterir; böylece siteler kişiyi birbiriyle eşleştiremez. "Tamga ile giriş yap"ta her site için
ayrı bir takma ad kullanılır. Kişi isterse cüzdanı sıfırlayıp verilerini hem Tamga servislerinden hem telefondan siler.

---

# Kapsam

Cüzdanın **iç** tasarımı: anahtar yönetimi, yerel depo, yedekleme ve kurtarma,
onay yüzeyi, belge kopyalarının kullanımı, şema önbelleği.

Protokoller [[SPEC-PROTO-0001]] ve [[SPEC-PROTO-0002]]'dedir. [[t:WIA]] ve [[t:key-attestation]]
[[ADR-0025]]'tedir; bu kanıtları [[t:wallet-provider|cüzdan sağlayıcısı]] verir.

---

# 1. Çözülen Gerilim — Anahtar Yedeklenebilir mi?

Bu bölüm dokümanın en önemli kısmıdır çünkü **iki mevcut tasarım kararı
çelişiyordu.**

## 1.1 Çelişki

[[SPEC-CRED-0001]] §3 diyor ki:

> Anahtar cihazın secure element'inde üretilir (Secure Enclave/StrongBox), asla
> dışa aktarılamaz → **belge devredilemez.**

Proje notlarındaki yedekleme tasarımı ise şunu ima ediyordu:

> 24 kelime tohum + zorunlu PIN; sunucuda şifreli yedek (sunucu çözemez).

Eğer tohum cüzdanı **kullanılabilir** hâlde geri getiriyorsa, [[t:holder|belge sahibi]] anahtarını
da geri getiriyor demektir. Ama belge sahibi anahtarı güvenli bölgeden çıkamıyorsa,
tohum onu geri getiremez.

**İkisi aynı anda doğru olamaz.**

## 1.2 Neden anahtar tohumdan türetilemez

Cazip seçenek şudur: belge sahibi anahtarlarını tohumdan türet, yazılımda tut, her
yerde geri getirilebilsin.

Bu seçenek **reddedilmiştir** çünkü [[t:holder-binding]]'in tamamını çürütür:

| | Sonuç |
|---|---|
| Tohum → belge sahibi anahtarı türetilebilir | Tohum paylaşılabilir |
| Tohum paylaşılabilir | Belge **devredilebilir** |
| Belge devredilebilir | [[SPEC-CRED-0001]] §3'teki açık geri gelir |

O dokümanın kendi ifadesiyle: "bir öğrenci belgesini arkadaşının cüzdanına
aldırır" saldırısı, belge verilirken kapatılıp **kurtarma anında** yeniden
açılmış olur. Arka kapı, ön kapıdan daha tehlikelidir çünkü kimse oraya
bakmaz.

## 1.3 Karar

**Değişmez WL1:** Belge sahibi anahtarları **seed'den türetilmez** ve cihazın güvenli
bölgesinden **asla çıkmaz.**

**Değişmez WL2:** Yedek, **belgeleri** ve **manifestoyu** taşır;
belge sahibi anahtarlarını taşımaz. Dolayısıyla yeni cihazda geri yüklenen bir
belge **sunulamaz** — belgenin yeniden verilmesi gerekir.

Bu, kabul edilmiş bir kullanıcı deneyimi bedelidir. Alternatifi, sistemin
temel güvenlik özelliğini kaybetmektir.

## 1.3b Değerlendirilen üçüncü yol (review R10)

Karar iki seçenek arasında verilmişti; bir üçüncüsü vardır ve açıkça
reddedilmesi gerekir: **platform senkronlu anahtarlar** (iCloud Keychain /
Google Password Manager tarzı, donanım destekli ama cihazlar arası taşınabilir
anahtar sınıfları).

| | Değerlendirme |
|---|---|
| Artı | Cihaz değişiminde belgelerin yeniden verilmesi gerekmez; kullanıcı deneyimi en iyi |
| Eksi 1 | Güven, Tamga'dan **Apple/Google'a** kayar — anahtarın nereye gittiğini onlar belirler |
| Eksi 2 | Aynı hesaptaki başka bir cihaz anahtarı alır → "belge devredilemez" ilkesi (WL1) hesap düzeyinde delinir |
| Eksi 3 | EUDI ARF bu sınıfı W3 (sertifikalı WSCD) saymaz; devlet aşaması devlet uyumu riske girer |

**Reddedildi.** Ama genişleme aşamasında, W2 seviyesi için isteğe bağlı bir "kolay
kurtarma" kipi olarak yeniden değerlendirilebilir — kullanıcı bilinçli olarak
düşük güvence seçiyorsa. Şu an ürün karmaşıklığına değmiyor.

## 1.4 Tohumun gerçek rolü

Tohum, sanılandan **dar** bir iş yapar:

| Tohum neyi kurtarır | Neyi kurtarmaz |
|---|---|
| Cüzdan kimliği (yedeğin şifre çözme anahtarı) | Belge sahibi anahtarları |
| Belgelerin kendisi (okunabilir, sunulamaz) | Sunum yeteneği |
| Manifest: hangi kurumdan hangi tip | — |
| Ayarlar, dil, sunum kaydı | — |

Manifest kritiktir: yeni cihazda kullanıcıya **"şu 4 belgeyi yeniden iste"**
diye tek dokunuşluk bir liste sunar. Kurtarma acısını ortadan kaldırmaz ama
yönetilebilir kılar.

---

# 2. Anahtar Mimarisi

## 2.1 Anahtar türleri

| Anahtar | Nerede | Dışa aktarılabilir | Ömür |
|---|---|---|---|
| **Belge sahibi anahtarları** (bir alımda N adet) | Secure Enclave / StrongBox | **Hayır** | Belge ömrü |
| **Yedek şifreleme anahtarı** | Tohumdan türetilir | Tohum olarak | Kalıcı |
| **Cüzdan örnek anahtarı** | Güvenli bölge | Hayır | Kurulum ömrü |

## 2.2 Cüzdan güvence seviyeleri

[[PM-ASSUR-0001]] Eksen A'nın cüzdan tarafındaki bileşeni:

| Seviye | Anahtar deposu | Faz |
|---|---|---|
| **W1** | Yazılım (güvenli bölge yok) | Desteklenmez (sandbox listesindeki ağın kendi deneme sahneleri için test anahtarı hariç — [[ADR-0042]] K5) |
| **W2** | Cihaz güvenli bölgesi (Secure Enclave / StrongBox) | **ilk aşama asgarisi** |
| **W3** | Sertifikalı WSCD | Devlet aşaması |

**Değişmez WL3:** W1 cüzdan desteklenmez (sandbox listesindeki ağın kendi deneme sahneleri için test anahtarı hariç — [[ADR-0042]] K5). Güvenli bölgesi olmayan bir cihazda
Tamga Wallet kurulmaz — kullanıcıya açık bir uyarıyla reddedilir.

## 2.3 PIN

Güvenli bölgedeki anahtara erişimin koşulu **kullanıcı doğrulamasıdır**; doğrulama anahtarı şifrelemez (onu donanım yapar).
Doğrulamanın yolu anahtarın nerede durduğuna bağlıdır:

- **Güvenli donanım anahtarı olan cihazda** belge anahtarı telefonun kilidine bağlıdır: yalnız kilit açıkken ve cihazın
  biyometrisi ya da cihaz parolasıyla kullanılır. Sunum onayı bu işletim sistemi istemidir (tek istem); uygulamanın ayarları
  bunu kapatamaz. Uygulama PIN'i ve uygulama içi biyometri bu yolda yalnız cüzdanın kilidini açar.
- **Yazılım anahtarı yolunda** (güvenli donanımı kullanamayan ortam, geçici sapma S-9) sunum onayı uygulama PIN'i ya da
  uygulama içi biyometridir.

| Kural | Değer |
|---|---|
| Uzunluk (uygulama PIN'i) | En az 6 hane |
| Biyometri | PIN'in **yerine** değil, yanında (geri düşüş PIN'dir) |
| Deneme | 5 hatalı → 30 sn gecikme; 10 → cüzdan kilitlenir, tohum gerekir |
| Sunum onayı | Her sunumda kullanıcı doğrulaması **zorunlu**: güvenli donanımda cihaz biyometrisi ya da cihaz parolası; yazılım anahtarı yolunda PIN ya da biyometri |
| Geri düşüş | İşletim sistemi istemi teknik ya da geçici bir nedenle gösterilemezse (ön planda pencere yok, doğrulama hizmeti kullanılamıyor) uygulama PIN'i sorulur. Kullanıcı istemden **vazgeçerse** geri düşüş yoktur: sunum yapılmaz |

**Sunum onayı satırı önemlidir:** Sunum, kullanıcının bilinçli eylemi olmalıdır. Açık bir
cüzdanın arka planda sessizce sunum yapması engellenir. Kişinin başlatmadığı akışlar (geçiş kartı yenilemesi, kopya
yenileme) istem göstermez; doğrulama gerekiyorsa o tur atlanır.

---

# 3. Yerel Depo

```
┌──────────────────────────────────────┐
│ Güvenli bölge (donanım)              │
│   holder anahtarları — çıkamaz       │
├──────────────────────────────────────┤
│ Şifreli yerel veritabanı             │
│   credentials    SD-JWT dizeleri     │
│   batch_state    kopya defteri       │
│   verifier_map   yapışkan eşleme     │
│   schema_cache   Type Metadata       │
│   presentation_log  sunum geçmişi    │
│   settings                           │
└──────────────────────────────────────┘
```

**Değişmez WL4:** `presentation_log` otomatik olarak ya da bir sunucuya **hiçbir koşulda** çıkmaz; yalnız kişinin kendi başlattığı, kendi parolasıyla şifreli dışa aktarmada (AB TS10, [[ADR-0027]]) cihazdan çıkar —
yedeğe de girmez ([[SPEC-PROTO-0002]]/PV8). Yedeğe girse, cihaz değişiminde
sunucuya şifreli olarak da olsa yüklenir ve bir davranış profili
merkezîleşmiş olur.

Kullanıcı bu kaydı görebilir ve silebilir.

---

# 4. Belge kopyalarının yönetimi

> Bu bölüm [[SPEC-PROTO-0001]] Açık Konu 1 ve [[SPEC-CRED-0002]] Açık Konu 3'ü
> kapatır.

## 4.1 Yapışkan kopya kuralı

**Değişmez WL5:** Bir doğrulayıcıya **her zaman aynı** kopya sunulur.
Farklı doğrulayıcılara **farklı** kopyalar sunulur.

```
verifier_map: (verifier_id, vct) → copy_index
```

Gerekçe, iki yönlü bir mantıktır:

| Yön | Neden |
|---|---|
| **Aynı doğrulayıcıya aynı kopya** | Doğrulayıcı zaten kim olduğunu biliyor (başvuru isimli). Farklı kopya sunmak korelasyon kazandırmaz, yalnızca kopya harcar. |
| **Farklı doğrulayıcıya farklı kopya** | İki doğrulayıcı iş birliği yaparsa `cnf` ve `idx` üzerinden eşleştirme yapamaz ([[SPEC-CRED-0003]] §9.4). |

`verifier_id`, [[t:x509_hash]] client identifier'ıdır ([[SPEC-PROTO-0002]] §2.1) —
kararlı ve doğrulanabilir bir anahtar.

## 4.2 Tutarlı açıklama seti

**Değişmez WL6:** Aynı doğrulayıcıya aynı `vct` için yapılan tekrar sunumlarda,
cüzdan **aynı açıklama setini** kullanır.

Sebep [[SPEC-SCHEMA-0002]] Güvenlik Notları'ndadır: değişen set, hangi
alanların gizlendiği hakkında bilgi verir. İlk sunumda 8 alan, ikincisinde 6
alan açıklanırsa, doğrulayıcı ikisi arasındaki farkı çıkarabilir.

Doğrulayıcı daha az alan isterse cüzdan **fazlasını sunmaz** — kesişim değil,
yeni isteğin kendisi geçerlidir; ama kullanıcıya "bu doğrulayıcıya daha önce şu
alanları vermiştiniz" bilgisi gösterilir.

## 4.3 Tükenme

| Kalan kopya | Cüzdan davranışı |
|---|---|
| 3 | Sessiz — ayarlarda görünür |
| 2 | Kullanıcıya bildirim: "Öğrenci belgeniz için 2 kullanım kaldı" |
| 0, **bilinen** doğrulayıcı | Yapışkan eşleme sayesinde mevcut kopya kullanılır — sorun yok |
| 0, **yeni** doğrulayıcı | Kullanıcıya seçim: (a) yenile, (b) mevcut bir kopyayı yeniden kullan — **korelasyon uyarısıyla** |

**Değişmez WL7:** Kullanıcı eylemi olmadan yenileme yalnızca [[ADR-0023]] AR1–AR4 koşullarında yapılır.
Yenileme belirteci olan kurum belgeleri, kurumun
ilan ettiği eşikte, uygulama önde ve kilit açıkken, rastgele gecikmeyle yenilenir; kimlik ve iletişim belgelerinde yenileme
kullanıcı eylemidir (tek istisna §4.5'teki ZK kopyaları). Kullanıcı ayarlardan kapatabilir.

## 4.4 Diploma

[[SPEC-PROTO-0001]] §8.5 uyarınca diploma da diğer kurum belgeleri gibi **10 kopya** verilir (2026-10-08; önceki karar
pilotta tek kopyaydı). Yapışkan eşleme uygulanır: her doğrulayıcıya ayrı kopya gider. Kopyalar tükenince cüzdan yeniden
imzalatır; kullanıcı aynı kopyayı bilerek yeniden kullanırsa cüzdan bunun bağlanabilirlik doğurduğunu gösterir.

## 4.5 ZK kopyaları ([[ADR-0044]])

Sıfır bilgi ispatlı sunum (`mso_mdoc_zk`, [[ADR-0032]]) iptal listesindeki yeri açmaz. Bu yüzden ZK ile kimlik belgesinin
kendisi değil, kimlik servisinin ayrıca verdiği **kısa ömürlü ZK kopyası** gösterilir:

| Konu | Kural |
|---|---|
| Tür | `urn:tamga:id:ShortLivedIdentityAttestation:1` (yalnız ISO 18013-5 mdoc; ad alanı `tamga.id.1`). İspat türü bağladığı için doğrulayıcı kısa ömrü görür |
| İçerik | Yalnız ZK ile ispatlanabilen öğeler (bugün `age_over_18`); ad, doğum tarihi, kimlik numarası yok |
| Geçerlilik | En çok 24 saat (ve ana belgenin bitişinden sonra değil); iptal listesi girdisi yok (ARF VCR_01) |
| Paket | Küçük paket (3 kopya); her kopya kendi cihaz anahtarına bağlı |
| Alma | Kimlik belgesiyle birlikte gelen yenileme belirteciyle (OpenID4VCI `grant_type=refresh_token`, DPoP + WIA); belirteç tek kullanımlıktır, her kullanımda değişir; içi cüzdana kapalıdır |
| Yenileme | Son kopyanın bitişine 8 saat kala pencere açılır, rastgele gecikmeyle (en çok 6 saat) sessizce yenilenir; geçerli kopya yoksa hemen ya da ZK isteği geldiğinde. [[ADR-0023]] K1 koşulları ve "kopyaları otomatik yenile" ayarı geçerlidir: ayar kapalıysa ZK kopyası alınmaz ve ZK sunumu yapılmaz |
| İptal | Ana belge iptal ya da askıdaysa kimlik servisi yeni kopya vermez (`invalid_grant`); cüzdan bağı ve kopyaları siler. Elde kalan kopya en geç 24 saatte geçersiz olur |
| Sunum | ZK sorgusu yalnız geçerli ZK kopyasıyla karşılanır; ana belgenin kopyaları ZK'da kullanılmaz. Kopya yoksa sorgu karşılanmaz ve klasik seçenek (`mso_mdoc` / `dc+sd-jwt`) seçilir (ZK5). ZK ispatı bağlanamaz olduğundan yapışkan kopya (WL5) gerekmez |

Kod: `@tamga-network/wallet-core` `refreshZkCopies`, `scheduleZkRefreshes`, `selectZkCopy`; kimlik servisinin ucu
[[SPEC-PROTO-0001]] §4.1.

---

# 5. Onay Yüzeyi

## 5.1 Sunum onay ekranı

Asgari içerik, bu sırayla:

1. **Kim istiyor** — doğrulayıcının [[t:trust-list|güven listesindeki]] kayıtlı adı + kayıtlı mı işareti
2. **Ne için** — `purpose` metni ([[SPEC-API-0001]] §4.1)
3. **Ne paylaşılacak** — alan alan liste, değerleriyle
4. **Ne paylaşılmayacak** — gizli kalan alanların **adları** (değerleri değil)
5. Onayla / Reddet

Dördüncü madde alışılmadıktır ve bilinçlidir: kullanıcının [[t:selective-disclosure]]'ın
çalıştığını **görmesi** gerekir. "Not ortalamanız paylaşılmayacak" satırı,
ürünün değerini tek bakışta anlatır.

## 5.2 Aşırı talep uyarısı

> [[SPEC-PROTO-0002]] Açık Konu 1'i kapatır.

Üç seviye, üç farklı görsel ağırlık:

| Durum | Sunum |
|---|---|
| Kayıtlı + scope içinde | Normal ekran, uyarı yok |
| Kayıtlı + **scope dışı alan var** | Scope dışı alanlar listede **ayrı bir blokta**, farklı renkte, "bu doğrulayıcı bu alanları istemeye yetkili değil" başlığıyla. Onay düğmesi **3 saniye gecikmeli** etkinleşir. |
| **Kayıtsız doğrulayıcı** | Akışı kesen ayrı ekran: "Bu doğrulayıcı Tamga'da kayıtlı değil. Kim olduğunu doğrulayamıyoruz." → Devam / İptal |

**Uyarı yorgunluğu önlemi:** Uyarı yalnızca **gerçekten anormal** durumda
çıkar. Normal akışta hiçbir uyarı yoktur. Uyarıyı her sunuma koyarsak
görünmez olur.

**Değişmez WL8:** Aşırı talep uyarısı, onay düğmesinin yanındaki bir metin
değildir; ayrı bir görsel blok ve gecikmeli düğme gerektirir.

## 5.3 Tekrarlayan farklı sorgular

[[SPEC-PROTO-0002]] Güvenlik Notları: bir doğrulayıcı farklı sorgular göndererek
kullanıcının hangi belgelere sahip olduğunu haritalayabilir.

Cüzdan, aynı doğrulayıcıdan **24 saat içinde 3'ten fazla farklı sorgu** gelirse
kullanıcıyı bilgilendirir: "Bu doğrulayıcı bugün 4 farklı belge sordu."

## 5.4 Site başına takma ad ([[ADR-0031]])

"Tamga ile giriş yap" hesap anahtarı olarak belge değeri değil, **site başına [[t:pseudonym|takma ad]]** kullanır ([[t:ARF]]
Topic 11).

| Adım | Cüzdan ne yapar |
|---|---|
| Tohum | Kimlik belgesiyle birlikte gelen `urn:tamga:id:PseudonymSeed:1` belgesini doğrular (kimlik belgesiyle aynı imzacı, kopya 0'ın anahtarı) ve tohumu güvenli depoya koyar (Keychain / Keystore; mağaza derlemesinde donanım korumalı). Tohum belge listesinde görünmez, hiçbir DCQL sorgusuna önerilmez (PS3). |
| İstek | DCQL'de `format: "tamga-pseudonym"` sorgusu (`meta.mode`: `single` / `multiple`). Belge sorgusu yoksa istek yalnız takma adla girişe (belgesiz) karşılık gelir. |
| Onay ekranı | "Bu siteye özel takma adın" kartı: yeni mi, daha önce kullanılan mı (değer gösterilmez). `multiple` sitede kullanıcı mevcut takma adlarından birini ya da yenisini seçer. Takma ad yalnız güven listesinde kayıtlı siteye verilir. |
| Türetme | PIN/biyometri onayından sonra: `k = HKDF-SHA256(tohum, "tamga-pseudonym-v1\|" + site + "\|" + sıra)` → P-256 anahtar; takma ad = açık anahtarın RFC 7638 parmak izi. Site = asıl RP'nin kayıtlı kalıcı kimliği (`dns_name`; aracıda asıl RP; ADR-0017 K7); istemci kimliğiyle (`x509_hash`) türetme reddedilir (wallet-core 0.7.1). Anahtar yalnız bellekte, imzadan sonra silinir. |
| Sunum | vp_token'da takma ad sorgusunun id'siyle `tamga-pseudonym+jwt`: başlıkta açık anahtar, gövdede `aud` = client_id, `nonce`, `rp`, bu işlem için yeni WIA ve PoP. |
| Takma adlarım | Ayarlar: site adı, oluşturulma / son kullanım, kullanıcının verdiği ad (siteye gitmez), sil. Silinen sıra o sitede bir daha türetilmez; yeniden kayıt yeni sıra açar. Günlüğe yalnız site adı ve olay yazılır, takma ad değeri yazılmaz. |

Yeni telefonda kimlik yeniden doğrulanınca aynı tohum gelir → aynı takma adlar → sitelerdeki hesaplar tanınır. Taşıma dosyası
(§7.5) tohumu ve anahtarı taşımaz (LX2).

### 5.4.1 AB takma ad kurallarıyla eşleme (ARF Konu 11, PA_01–PA_31; Topic E iyileştirme turu)

AB'nin güncel takma ad kuralları (ARF 2.8 / 3.0 Konu 11 ve "Topic E — Pseudonyms, including User authentication mechanism"
iyileştirme turu) WebAuthn tabanlı bir yöntem varsayar ama yöntemi zorunlu kılmaz (PA_22 "MAY"; PA_21'deki AB teknik şartnamesi
henüz yok). Tamga aynı kuralları OpenID4VP içinde imzalı takma ad belirteciyle karşılar. Eşleme (2026-10-21):

| AB kuralı | Tamga | Durum |
|---|---|---|
| PA_01, PA_02 takma ad oluşturma, kaydetme, onunla giriş | Kayıt ve giriş akışı (§5.4, [[ADR-0031]] K3) | ✅ |
| PA_03 aynı cihaz ve başka cihaz | Bağlantı ve QR ile aynı akış | ✅ |
| PA_04 bir sitede birden çok takma ad | RP kaydında `pseudonyms: multiple` (K4); varsayılan tek | ✅ |
| PA_05, PA_06, PA_19 kullanıcının verdiği ad, seçim, adın siteye gitmemesi | "Takma adlarım" (K5, PS6) | ✅ |
| PA_07–PA_09 silme, yönetim, liste | "Takma adlarım" (K5) | ✅ |
| PA_10, PA_11 iptal edilmemiş cüzdan birimi | Her işlemde yeni WIA ve PoP (PS5); her WIA'nın iptal girişi ayrıdır, siteler arası bağ kurmaz | ✅ |
| PA_12 aynı kişinin hem belge hem takma ad sunması | Aynı `vp_token`, aynı `nonce` | 🟡 kriptografik bağ (ACP_01) yok |
| PA_13 takma adın sunana ait olduğu | Takma ad anahtarıyla imza, `aud` + `nonce` | ✅ |
| PA_14, PA_30 gerekli bilginin güvenli depoda tutulması | Tohum Keychain / Keystore'da; anahtar her işlemde bellekte türetilir | ✅ |
| PA_15, PA_16, PA_17 kimliğin türetilememesi, sitelere farklı takma ad, bağlanamazlık | HKDF ile site başına anahtar (PS1); aynı takma ad başka siteye hiç gitmez | ✅ |
| PA_18 çakışma olasılığı | P-256 anahtar, RFC 7638 parmak izi | ✅ |
| PA_20 cüzdanın siteyi doğrulaması | Erişim sertifikası + güven listesi kaydı (WebAuthn'deki tarayıcı doğrulamasından güçlü) | ✅ |
| PA_21, PA_22 WebAuthn profili | WebAuthn yerine OpenID4VP içinde `tamga-pseudonym+jwt`; günlük giriş için sitenin passkey'i ayrı kalır | ⚠️ yöntem farkı — AB şartnamesi yayımlanınca uyarlanır |
| PA_23 algoritmalar AB ECCG listesinde | HMAC-SHA256, HKDF-SHA256, P-256 ECDSA | ✅ |
| PA_24–PA_26, PA_28 kapsam ve oran sınırlı takma ad | Site başına tek takma ad (oran 1) ya da serbest (`multiple`); site oranı sayıyla seçemez; sınır cihaz kanıtına dayanır, ispatlı değil | 🟡 |
| PA_27 farklı sitelerde aynı kapsamda bağlanamazlık | Site kimliği HKDF girdisinde | ✅ |
| PA_29 kullanıcı dışında kimsenin takma adla giriş yapamaması | Kimlik servisi (`pseudonymKey` + kimlik numarası) takma ad anahtarını teorik olarak türetebilir; giriş ayrıca geçerli bir cüzdan birimi kanıtı (WIA) ister | 🟡 bilinen zayıflama ([[ADR-0031]]); kalıcı çözüm sıfır bilgi ispatıyla türetme (ZKP_04, Z5) |
| PA_31 yeni cüzdanda aynı takma adlar | Tohum kişinin değişmeyen kimliğinden türer | ✅ |
| DASH_03c günlük | Kayıt (`pseudonym_created`) ve silme günlükte; tamamlanmayan takma ad işleminin nedeni yazılmıyor; TS10 dışa aktarmada takma ad olayı yok | 🟡 |

**Site anahtarı (2026-10-21 denetimi, wallet-core 0.7.1):** [[ADR-0031]] K2'ye göre site kimliği RP kaydının kalıcı kimliği
`dns_name`'dir. Cüzdan onu `checkRp` onayından sonra `stableRpKey` ile alır (kayıt bulunmuş, erişim sertifikası kayıttakiyle aynı;
aracıda iki kayıtta yazılı ilişkiyle asıl RP'ninki). Doğrulayıcının erişim sertifikası aynı kayıtla yenilenince `client_id` değişir,
takma ad değişmez — bunu uçtan uca bir test kanıtlar. 0.7.1'den beri istemci kimliğiyle (`x509_hash:…` ya da önekli başka bir
değer) türetme reddedilir (cüzdan da doğrulayıcı da). Cihazda eski biçimde anahtarlanmış yerel kayıtlar uygulama tarafında bir kez
alan adına taşınır ya da silinir; geçiş kodu yazılmaz ([[ADR-0029]]). Bir sitenin hesabı "tanımaması" takma ad değişimi değil,
sitenin kendi kaydıdır: örnek sitenin hesapları bellekte tutulur ve sandbox her gece sıfırlanır.

---

## 5.5 Belge verenin paylaşım kuralı — gömülü açıklama politikası ([[ADR-0046]], 2026-10-11; kod 0.5.0)

Kurum, bir kurum belgesi türünün yalnız belirli doğrulayıcılara gösterilmesini isteyebilir (ARF Konu 43). Kural imzalı Credential
Issuer metadata'sında `credential_metadata.embedded_disclosure_policy` olarak gelir ([[SPEC-PROTO-0001]] §2.1).

- **Saklama (EDP_10):** cüzdan belgeyi alırken politikayı imzası doğrulanmış metadata'dan okur, biçimini denetler ve belgenin
  yanında saklar. Biçimi bozuk politika belgeyi almayı durdurmaz; "değerlendirilemez" diye saklanır.
- **Değerlendirme (EDP_02/03/06):** gösterimde, kayıt sertifikası doğrulandıktan sonra, ağ isteği yapmadan:
  `authorized_relying_parties` → kayıt sertifikasının `sub`'ı (ve varsa hizmet kimliği) bir `relying_parties` öğesine, erişim
  sertifikasının konu adı (RFC 4514 normalleştirilmiş) bir `subject_dns` öğesine ya da kayıt sertifikasının bir yetkisi bir
  `entitlements` öğesine eşitse geçer; `specific_roots_of_trust` → kayıt ya da erişim sertifikası zincirindeki bir sertifikanın
  (veren adı, seri numarası) çifti listedeyse geçer. Aracılı istekte aracılanan doğrulayıcı esas alınır: `rp_id` kayıt
  sertifikasının `sub`'ıdır ve erişim sertifikasının konu adı (aracının adı) eşleşme sayılmaz. Kayıt sertifikası yoksa
  (yakın alan, cüzdandan cüzdana) değerlendirme yapılamaz ve başarısız sayılır.
- **Karşılaştırma ayrıntısı:** hizmet kimliği kayıt sertifikasının `service_id` üyesidir (ARF RPRC_17a; liste yayıncısı
  kullanımın `service_id`'sini, yoksa `scope_id`'sini yazar); `service_id`'siz öğe doğrulayıcının bütün kullanımlarını kapsar. Ad
  karşılaştırmasında öznitelik türleri OID'e çevrilir (ETSI TS 119 472-3: `ORGID` = organizationIdentifier, `SN` =
  serialNumber), değerlerde büyük-küçük harf ve fazla boşluk gözetilmez, RDN sırası gözetilmez; bütün öznitelikler birebir aynı
  olmalıdır. Güven kökü öğesi, seri numarası tutan ve `issuer_dn`'i sertifikanın veren adına eşit olan sertifikayla eşleşir
  (IssuerSerial; kendinden imzalı kökte veren adı konu adıyla aynıdır; konu adıyla eşleşme yoktur). Ad ve seri numarası
  kopyalanabildiği için yalnız imza zinciri yapraktan o sertifikaya kadar doğrulanmış ve güvene bağlanmış sertifikalar sayılır:
  kayıt sertifikası zinciri imzalı listedeki kayıt kurumu anahtarından başlar (onu doğrudan imzalayan kendinden imzalı kök de
  sayılır); erişim sertifikası zinciri yalnız imzalı listeden gelen güvenilir bir CA parmak izine ulaşırsa sayılır. Öğe yalnız
  doğrulanamayan bir sertifikayla tutuyorsa sonuç "değerlendirilemez"dir (uyarı, varsayılan "Paylaşma"), hiçbir zaman "geçti"
  değil. Başvuru uygulaması: `@tamga-network/wallet-core`
  `checkDisclosurePolicy` (sonuç `passed` / `failed` / `not_evaluable`, neden ve `info_uri`).
- **Onay ekranı (EDP_05/07):** başarısız ya da yapılamazsa ayrı bir uyarı bloğu ("[kurum] bu belgenin yalnız izin verdiği kurumlara
  gösterilmesini istiyor"), `info_uri` varsa "Kuralı oku"; varsayılan düğme **"Paylaşma"**, "Yine de paylaş" gecikmeli (§5.2 deseni).
  Kesin engel yoktur; son karar kişinindir.

**Değişmez EP2/EP3** ([[ADR-0046]]): politika belge alırken saklanır ve gösterimde ağ isteği yapmadan değerlendirilir; tutmazsa ayrı
uyarı, varsayılan paylaşmamak.

## 5.6 Kurum tercihleri, dış listeler, cüzdandan cüzdana (kod 0.5.0)

- **Kurumun cüzdan kanıtı tercihleri (AB ARF WUA_05a, WUA_32):** cüzdan belge isterken kurumun metadata'sındaki
  `key_attestations_required` şartını ve `preferred_*` iptal bakım süresi tercihlerini okur; şartı karşılamayan KA'yı göndermez,
  bakım süresi kısa kalan WIA ve KA yerine sağlayıcıdan uzununu ister ([[SPEC-PROTO-0001]]).
- **Dış listeler (ADR-0036; ARF ISSU_10b):** cüzdan LOTL'daki dış listeleri (ETSI TS 119 602 LoTE ve ETSI TS 119 612 TL) imzacıları
  LOTL'da sabitlenmiş olarak yükleyebilir; bir dış liste doğrulanamazsa yalnız o yüklenmez.
- **İki iptal mekanizması (ARF VCR_10):** cüzdan, doğrulayan rolünde (cüzdandan cüzdana) Status List'i ve Attestation Revocation
  List'i doğrular.
- **Cüzdandan cüzdana (ARF Konu 30):** protokol çekirdekte (`wallet-core`); hangi türün ve alanların gösterilebileceği cüzdanın
  kararıdır. Belge verenin paylaşım kuralıyla kısıtlı belge cüzdandan cüzdana gösterilmez; yakın mesafe sunumunda onay ekranı
  kuralın değerlendirilemediğini söyler ([[ADR-0046]] Sonuçlar).

## 5.7 AB hizalaması (kod 0.6.0)

- **Kayıt sertifikası olmayan istek ([[ADR-0026]] K5; [[ADR-0056]] K10):** kişiye sorulmadan ret (`registration_missing`;
  ayrıntı [[SPEC-PROTO-0002]] §7.5); cüzdandan cüzdana yakın alan hariç. Yakın alanda kayıt sertifikası `requestInfo.euWrprc` ile gelir
  ve uzaktan akıştaki gibi doğrulanır; geçersizse cüzdan kişiye sormadan reddeder (`presentProximity` `registrarKeys`).
- **Cüzdandan cüzdana sunum teklifi (AB TS9 v1.1):** gösteren, izin listesindeki ve belgesinde bulunan alanları QR'daki
  DeviceEngagement'a (`-1`) teklif olarak koyar. Teklif dışı ya da saklama niyetli istekte hiçbir alan göndermeden
  `DeviceResponse.status = 10` ile keser; yanıt isteğin alınışından sabit bir süre sonra gider (yanıt süresi belgeye bağlı
  değildir). Doğrulayan yalnız teklifteki alanları isteyebilir. Alan listesini göstermeden önce kişinin doğrulanması (STS9_13)
  cüzdanın işidir.
- **Günlük olayları (DASH_02, DASH_03b):** `issuance_failed` (kurum, tür, neden kodu), `reissued`, `w2w_verified` (doğrulayan
  kipinde yalnız zaman, belge türü ve sonuç — alan ve değer yok). **Saklama süresi (DASH_02a):** kişi 30 / 90 / 180 / 365 gün
  seçebilir (varsayılan süresiz); süresi dolan kayıtlar silinmeden önce cüzdan uyarır (`upcomingLogDeletions`) ve kişi ertelerse
  silinmez (`applyLogRetention` kancası).
- **"Tamga Network'te listeli" göstergesi ([[ADR-0049]]):** cüzdan, doğrulanmış güven listesindeki kendi sağlayıcı kaydını
  `walletProviderListing(providerId, { solutionId, unitRevoked })` ile okur; kayıt ve çözüm `ACTIVE`, liste taze ve gerçek ağın
  listesi, birim iptal edilmemişse gösterge görünür ve dokununca resmî ad, durum, parmak izi ve liste zamanı gösterilir.
- **İptal listesi:** kimlik belgelerinde askı yoktur (`bits = 1`); mdoc kopyasının listesi CWT gösterimidir ([[ADR-0048]]).

# 6. Şema Önbelleği

[[ARCH-0003]]/CMP8'in uygulaması.

| Kural | Değer |
|---|---|
| Ne zaman çekilir | Kurulumda ve **yeni bir tip belge alındığında** |
| Nasıl | Toplu — ilgili tüm Type Metadata + `extends` zinciri |
| Ne zaman çekilmez | **Sunum anında** |
| Geçerlilik | Süresiz — `vct#integrity` içeriği tanımlar ([[SPEC-SCHEMA-0001]] §7.1) |

**Değişmez WL9:** Cüzdan sunum anında `schemas.tamga.network`'e istek yapmaz.
Yaparsa, şema sunucusu "kim hangi tip belgeyi ne zaman kullandı" bilgisini
toplar.

Önbellekte olmayan bir tip sunulmak istenirse: kullanıcıya "bu belge tipi
henüz doğrulanamıyor, internet bağlantısı gerekiyor" denir ve **çekim
kullanıcı onayıyla** yapılır.

---

# 7. Yedekleme ve Kurtarma

## 7.1 Yedek içeriği

```
şifreli_yedek = AES-GCM(
    anahtar = HKDF(seed),
    içerik  = {
        manifest:    [{ issuer, vct, alındığı_tarih }],
        credentials: [SD-JWT dizeleri],
        settings:    { dil, bildirimler }
    }
)
```

**Yedekte olmayanlar:** belge sahibi anahtarları (WL1), `presentation_log` (WL4),
`verifier_map`.

`verifier_map` neden yok: yeni cihazda zaten yeni kopyalar alınacak, eski
eşleme anlamsız. Ayrıca hangi doğrulayıcılara sunum yapıldığını taşır — WL4 ile
aynı gerekçe.

## 7.2 Sunucu tarafı

Yedek, Tamga barındırmalı bir depoya yüklenebilir. Sunucu **çözemez** —
anahtar tohumdan türer ve tohum sunucuya gitmez.

| Sunucunun gördüğü | Görmediği |
|---|---|
| Şifreli blob boyutu | İçerik |
| Yükleme zamanı | Hangi belgeler |
| Cüzdan örnek tanımlayıcısı | Kullanıcı kimliği |

## 7.3 Cihaz değişimi akışı

```
1. Yeni cihaza kur
2. Seed gir + yeni PIN belirle
3. Yedeği indir, çöz
4. Manifest gösterilir:
     ┌──────────────────────────────────────────┐
     │ 4 belgeniz yeniden alınmalı              │
     │                                          │
     │ ☑ Diploma — Örnek Üniversitesi           │
     │ ☑ Öğrenci Belgesi — Örnek Üniversitesi   │
     │ ☐ Sürücü Belgesi — (devlet aşaması)               │
     │                                          │
     │ [ Seçilenleri yeniden iste ]             │
     └──────────────────────────────────────────┘
5. Her biri için OID4VCI akışı (SPEC-PROTO-0001)
     → yeni holder anahtarları, yeni cnf, yeni idx
```

**Kullanıcıya açıkça söylenir:** eski belgeler görüntülenebilir ama
sunulamaz; belgelerin yeniden verilmesi gerekir. Bunu gizlemek, sunum anında başarısızlıkla
karşılaşmaktan kötüdür.

## 7.4 Tohum kaybı

Tohum **ve** cihaz kaybedilirse kurtarma yoktur. Kullanıcı her kuruma
**yeniden başvurur** ve kimliğini kurumun kendi prosedürüyle kanıtlar
([[SPEC-PROTO-0001]] §11 — yüz yüze bağlama).

Bu bir felaket değildir: belgeler zaten kurumda yeniden üretilebilir
verilerdir. Kaybedilen şey **erişim**, veri değil.

**Değişmez WL10:** Tamga hiçbir koşulda kullanıcı adına kurtarma anahtarı
tutmaz. Tutsaydı, tüm cüzdanları açabilecek bir merkez oluşurdu.

## 7.5 AB TS10 taşıma dosyası

Cüzdan, AB TS10 biçiminde bir taşıma dosyası üretir (Ayarlar → Yeni telefona taşı):

- **İçerik:** `MigrationData`, yani yeniden alınacak belgelerin listesi (`listOfCredentials`: vct, kurum, kurum adresi).
  Cihaza bağlı olmayan belge yoktur.
- **Şifreleme:** kişinin parolasıyla JWE `PBES2-HS256+A128KW` + `A128GCM` (TS10 §5).
- **Paylaşım:** paylaşım menüsüyle kişinin seçtiği yere gider; Tamga'ya gitmez.
- **Yeni cüzdanda:** kişi dosyayı açar, liste "yeniden al" düğmeleriyle kurum sayfasına bağlanır (WL2).

Belge değerleri, kopyalar ve anahtarlar dosyaya girmez. İşlem günlüğü dosyaya girer ([[ADR-0027]]); içe aktarmada kişiye
günlüğün geri yüklenip yüklenmeyeceği sorulur. Günlük ayrıca tek başına şifreli dosya olarak dışa aktarılabilir (TS10 §4.1).

## 7.6 Cüzdanı sıfırla ve verilerimi sil

Ayarlar → **Cüzdanı sıfırla ve verilerimi sil** (mağaza kuralları: uygulama içinden silme; KVKK md. 7). Sıra:

1. **Kimlik servisi** — kimlik servisinden alınmış her belge için alan açmadan sunum (SD-JWT VC + KB-JWT; aud = servis,
   nonce = servisin `/nonce`'ı) → `POST {id}/erasure`. Servis belgeyi kendi imzasından ve sahipliği `cnf` anahtarından
   tanır; kaydı ve olay satırlarını siler, bütün kopyaları iptal eder, uzaktan kimlik doğrulama sağlayıcısındaki oturumu ve
   görüntüleri sildirir ([[SPEC-ID-0003]] §9.1).
2. **Cüzdan sağlayıcısı** — birim anahtarıyla imzalı `POST {wp}/units/delete`: birim iptal (WIA bitleri), sonra kayıt
   (açık anahtar, sürüm, cihaz kanıtı bilgisi) silinir ([[ADR-0025]]).
3. **Cihaz** — bütün belgeler ve anahtarlar, takma ad tohumu, günlük, PIN (WL1: kurtarma yok).

Ağ yoksa 3 yine yapılır; 1–2 yapılamazsa kişiye söylenir ve e-posta yolu gösterilir. Kurumların (belge veren, doğrulayıcı) tuttuğu
veri kurumdadır; yol TS7 silme talebidir (Geçmiş → "Verilerimi silmesini iste").

---

# 8. Değişmezler

| # | Değişmez |
|---|---|
| **WL1** | Belge sahibi anahtarları seed'den türetilmez; güvenli bölgeden çıkmaz. |
| **WL2** | Yedek belgeleri ve manifestoyu taşır; anahtarları taşımaz — cihaz değişiminde belgelerin yeniden verilmesi gerekir. |
| **WL3** | W1 (yazılım anahtarlı) cüzdan desteklenmez (sandbox listesindeki ağın kendi deneme sahneleri için test anahtarı hariç — [[ADR-0042]] K5). |
| **WL4** | `presentation_log` sunucuya ve otomatik olarak hiçbir koşulda çıkmaz, sunucu yedeğine girmez; yalnız kişinin başlattığı, kişinin parolasıyla şifreli dışa aktarmada (TS10) cihazdan çıkar ([[ADR-0027]]). |
| **WL5** | Bir doğrulayıcıya her zaman aynı kopya; farklı doğrulayıcıya farklı kopya. |
| **WL6** | Aynı doğrulayıcı + aynı `vct` için disclosure seti tutarlıdır. |
| **WL7** | Kullanıcı eylemi olmadan yenileme yalnızca [[ADR-0023]] AR1–AR4 koşullarında yapılır. |
| **WL8** | Aşırı talep uyarısı ayrı görsel blok + gecikmeli düğme gerektirir. |
| **WL9** | Sunum anında şema sunucusuna istek yapılmaz. |
| **WL10** | Tamga kullanıcı adına kurtarma anahtarı tutmaz. |
| **WL11** | Her sunum kullanıcı doğrulaması gerektirir: güvenli donanım anahtarı olan cihazda cihazın biyometrisi ya da cihaz parolası (belge anahtarı telefon kilidine bağlıdır); yazılım anahtarı yolunda (S-9) uygulama PIN'i ya da biyometri. Geri düşüş ve vazgeçme §2.3'te. |
| **WL12** | Geçiş kartı jetonu (`tamga-pass+jwt`) kişisel veri taşımaz: yalnızca `iss` (opak pass_id), `aud`, `iat` (≤ şimdi + 30 s), `exp` (ömür ≤ 60 s; ≤ şimdi + 60 s + 30 s saat kayması toleransı), `jti`; belge içeriği ve claim'ler QR'a girmez ([[ADR-0012]]). |
| **WL13** | Geçiş kartı yalnızca güven listesinde kayıtlı bir RP/terminal grubu için üretilir ve kayıt anında verilen rıza süreli (≤ 6 ay) ve kapsamlıdır; kullanıcı rızayı istediği an geri alır (grant silinir). WL11'in tek istisnasıdır. |
| **WL14** | Her geçiş kartı gösterimi `presentation_log`'a yazılır (WL4 kapsamında, cihazda); Göster ekranı canlı saat ve süre gösterir. |
| **WL15** | Site takma ad anahtarları belge sahibi anahtarı değildir: yalnız [[ADR-0031]] tohumundan site ve sıra başına türetilir, kalıcı saklanmaz; tohum yalnız cihazın güvenli deposunda durur, yedeğe, taşıma dosyasına ve hiçbir sunuma girmez. |

---

# Güvenlik ve Mahremiyet Notları

**Kurtarma, holder binding'in en zayıf noktasıdır.** §1.2'deki muhakeme
tekrarlanmalıdır: kolay kurtarma isteyen her tasarım önerisi, "bu, belgeyi
devredilebilir kılar mı?" sorusundan geçmelidir. Cevap evet ise reddedilir.

**Yedek boyutu bir sinyaldir.** Sunucu, blob boyutundan kaç belge
olduğunu tahmin edebilir. Azaltma: yedek sabit boyutlu bloklara doldurulur
(padding).

**Yapışkan eşleme bir liste tutar.** `verifier_map`, kullanıcının hangi
doğrulayıcılara sunum yaptığını içerir — `presentation_log` kadar hassastır ve
aynı kurallara tabidir (cihazda kalır, yedeğe girmez).

**PIN kilitlenmesi bir DoS yüzeyidir.** Cihazı ele geçiren biri 10 kez yanlış
PIN girip cüzdanı kilitleyebilir. Kabul edilmiş risk — alternatifi kaba kuvvet
saldırısına açık bırakmak.

---

# Açık Konular

1. Yeni cihazda belgelerin yeniden verilmesi, kurumun hâlâ o kişiyi tanımasını gerektiriyor.
   Mezun 10 yıl sonra cihaz değiştirirse üniversite ne yapacak? Kurumsal
   süreç sorusu → PM-GTM-0001.
2. W3 (sertifikalı WSCD) devlet aşamasında nasıl tespit edilecek — cihaz attestation'ı
   mı, ayrı donanım mı? → `SPEC-WALLET-0002`
3. Yedeğin sabit boyutlu doldurulması ne kadar maliyetli? Ölçülmeli.
4. Çoklu cihaz (tablet + telefon) destekleniyor mu? Şu an hayır — her cihaz
   ayrı belge sahibi anahtarı demek, dolayısıyla her cihaz için ayrı belge verme. Toplu alım
   bunu kısmen çözebilir ama tasarlanmadı.
5. `verifier_map` kullanıcıya gösterilmeli mi? Şeffaflık açısından evet, ama
   "hangi işverenlere başvurdunuz" listesi telefonu eline geçirene de görünür.

---

# İlgili Dokümanlar

[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-SCHEMA-0001]] ·
[[SPEC-SCHEMA-0002]] · [[SPEC-API-0001]] · [[ARCH-0003]] · [[PM-ASSUR-0001]] ·
[[PM-GOV-0001]] · [[INVARIANTS]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02; son güncelleme 2026-10-04).

