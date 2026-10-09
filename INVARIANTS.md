---
document_id: INVARIANTS
title: Bağlayıcı kurallar
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-09
summary: >
  Tüm spesifikasyon ve mimari dokümanlarındaki değişmezlerin (invariant) tek
  indeksi. ÜRETİLEN DOSYADIR — kaynak, her dokümanın kendi "Değişmezler"
  tablosudur (scripts/sync-invariants.mjs). Amacı iki: (1) kod çakışmalarını
  görünür kılmak, (2) bir kuralın hangi dokümanda tanımlandığını hızlıca bulmak.
  Çapraz atıf her zaman `DOC-ID/KOD` biçiminde yapılır.
priority: High
---

# Nasıl kullanılır

**Değişmez kodları doküman kapsamlıdır.** Farklı dokümanlarda aynı kod
bulunabilir — bu yüzden çapraz atıf **her zaman** doküman kimliğiyle yapılır:

```
✓ [[SPEC-CRED-0003]]/S1        doğru
✗ S1                            belirsiz
```

**Adım kodları değişmez değildir.** Doğrulama hattının `A1…E4` adım kodları
([[SPEC-API-0001]] §1) kanoniktir ve `failed_step` alanında kullanılır; değişmez
tablolarıyla karıştırılmamalıdır. Çerçeve belgelerinin (`docs/framework/`) RB-* kuralları
da değişmez değildir; kaynak koda atıf verirler (D-GOV-6).

**Bu dosya üretilir.** Bir değişmezi değiştirmek için kaynak dokümanı
değiştir, sonra `node scripts/sync-invariants.mjs` ile bu indeksi yeniden üret. Elle düzenleme yapılmaz.

**Toplam: 287 kodlanmış değişmez, 43 dokümanda.** Ayrıca bir Draft spec
(SPEC-ID-0001) doküman-kapsamlı **kısa kod atanmamış** numaralı değişmez listesi
taşır; [[SPEC-ID-0002]] ile superseded olduğu için kodlanmadı ve aşağıda
"Kodlanmamış Değişmez Listeleri" altında not olarak izlenir (sayıya dahil değil).

---


## ADR-0013

*"Kimlik belgesi için mdoc"*

| Kod | Açıklama |
|---|---|
| `ADR-0013/MD1` | mdoc yalnızca SD-JWT VC'nin ikinci temsilidir; SD-JWT VC birincil kalır (ADR-0006 değişmez). Bir tipin mdoc'u varsa alanları, `iat/exp` ve belge sahibi anahtarı SD-JWT ile birebir aynıdır. |
| `ADR-0013/MD2` | mdoc `deviceKey` = SD-JWT `cnf.jwk` (aynı belge sahibi anahtarı, aynı cihaz bağlaması). Ayrı anahtar üretilmez. |
| `ADR-0013/MD3` | mdoc issuerAuth (COSE_Sign1) yalnızca ES256; belge veren sertifikası x5chain'de taşınır ve [[SPEC-TRUST-0001]] güven listesiyle (issuer_id) eşlenir — SD-JWT ile aynı güven çapası. |
| `ADR-0013/MD4` | Doğrulama üç değerli sonucu ([[SPEC-API-0001]]) korur; digest uyuşmazlığı/süre/iptal REJECTED, altyapı erişilemezliği INDETERMINATE. Sonuç nesnesinde ham CBOR ve açıklanmayan alan bulunmaz. |
| `ADR-0013/MD5` | mdoc kişisel veri değerini yalnızca IssuerSignedItem içinde taşır; MSO, çapa günlüğü ve loglar yalnızca digest/anahtar/tarih içerir (DP1/AP3 korunur). |


## ADR-0014

*"Etkinlik kategorisi"*

| Kod | Açıklama |
|---|---|
| `ADR-0014/IC1` | `IssuerCategory` kapalı kümedir; yeni değer yalnızca ADR ile ve enum'un **sonuna** eklenir (sıra numaraları değişmez). |
| `ADR-0014/IC2` | Kategori kaba filtredir, yetki değildir: bir belge verenin belgesinin kabulü `vct` + zaman pencereli şema yetkisiyle ([[SPEC-TRUST-0001]]) belirlenir; kategori tek başına kabul sebebi olamaz. |
| `ADR-0014/IC3` | Kategori değişikliği yeni bir güven listesi sürümüyle yayınlanır ve belgenin `iat`'ına göre değerlendirilen yetkiyi geriye dönük değiştirmez (D-BC-3). |


## ADR-0015

*"Tek güven arayüzü"*

| Kod | Açıklama |
|---|---|
| `ADR-0015/TS1` | Her istemci ve servis güven sorusunu yalnızca `TrustSource` arayüzünden sorar; liste/zincir biçimi arayüz dışında yorumlanmaz (BT4'ün istemcilere genişletilmesi). |
| `ADR-0015/TS2` | Liste doğrulama kuralları tek gerçeklemededir (`trust/core`); başka paket kopyasını tutmaz. |
| `ADR-0015/TS3` | İstemci güven sorusu için Tamga'ya kullanıcıya bağlanabilir çağrı yapmaz; listeler toplu çekilir. |


## ADR-0016

*"Barındırılan belge vermeye erişim"*

| Kod | Açıklama |
|---|---|
| `ADR-0016/HA1` | Dış erişim yalnızca kiracıya bağlı, kapsamlı API anahtarıyla; ortak yönetici anahtarı dışarı açılmaz. |
| `ADR-0016/HA2` | API anahtarı sunucuda yalnızca özetiyle saklanır; loglarda ve denetim kaydında anahtarın kendisi yer almaz. |
| `ADR-0016/HA3` | Bir anahtar yalnızca kendi `slug`'ının yollarında ve kapsamındaki işlemlerde geçerlidir. |


## ADR-0017

*"Doğrulama sonucuna erişim"*

| Kod | Açıklama |
|---|---|
| `ADR-0017/HV1` | Barındırılan doğrulayıcı değer döndüren her ucu yalnızca K1 beyanını doğrulanmış RP'ye açar. |
| `ADR-0017/HV2` | Sunum oluşturan `client_id` dışındaki bir RP sonuç ya da değer alamaz; cevap varlığı sızdırmaz (`404`). |
| `ADR-0017/HV3` | Değerler en fazla bir kez okunur ve sonuçtan en geç 5 dakika sonra bellekten silinir. |
| `ADR-0017/HV4` | Tarayıcıya giden hiçbir jeton ya da adres değer okuma yetkisi taşımaz. |
| `ADR-0017/HV6` | Aracı doğrulayıcı üzerinden gelen istekte cüzdan asıl RP'nin kayıtlı adını gösterir ve kapsamı onun kaydına göre denetler. |
| `ADR-0017/HV5` | RP beyanı: `exp − iat ≤ 60 s`, `jti` tekrar reddi, imzacı sertifika parmak izi güven listesindeki RP kaydıyla eşleşir. |


## ADR-0018

*"Belgelerin üç kapısı"*

| Kod | Açıklama |
|---|---|
| `ADR-0018/DY1` | Çerçeve belgelerinin (FW-*) kamuya açık tek yayın yeri Tamga ARF sitesidir; başka site kopyasını yayınlamaz, bağlantı verir. |
| `ADR-0018/DY2` | Tamga ARF'nin İngilizce çevirisi Türkçe kaynağın aynı sürümünü taşır; sürüm farkı varken yayın yapılmaz. |
| `ADR-0018/DY3` | Tamga ARF sayfaları özel depo yollarına, konuşmalara ya da kiracı verisine bağlantı vermez. |


## ADR-0019

*"Kurum Konsolu"*

| Kod | Açıklama |
|---|---|
| `ADR-0019/KC1` | Konsol kullanıcısı yalnızca bağlı olduğu kurumun verisini görür ve değiştirir. |
| `ADR-0019/KC2` | Konsola giriş passkey iledir; parola saklanmaz. Davet tek kullanımlıktır ve süreli; yalnızca özeti saklanır. |
| `ADR-0019/KC3` | Konsol ve veritabanı günlükleri kişisel veri, claim değeri, status `idx` içermez; kayıt defteri kişisel veriyi yalnızca kurum adına eşleştirme için tutar. |
| `ADR-0019/KC4` | Kayıt defteri "örnek kayıt defteri" olarak işaretlenir; kurumun kendi sistemi (API ya da kaynak bağlantısı) bağlanınca yerini ona bırakır. |


## ADR-0020

*"Yetkili kaynak kurumdadır"*

| Kod | Açıklama |
|---|---|
| `ADR-0020/AS1` | Barındırılan ihraçta belge bilgileri kalıcı olarak tutulmaz; imza anında yetkili kaynaktan okunur. Kalıcı olan yalnız kurumun opak kişi kimliği ve eşleştirme anahtarlarının anahtarlı özetidir. |
| `ADR-0020/AS2` | Kimliğe bağlı teklif, yalnızca sunulan kimlik belgesindeki eşleştirme anahtarları teklifteki özetle eşleşirse belgeye dönüşür. |
| `ADR-0020/AS3` | Tamga teklif için kişinin iletişim adresini almaz; bağlantıyı kurum iletir. |
| `ADR-0020/AS4` | `sandbox` kaynağı yalnız deneme içindir; gerçek kişi verisiyle kullanılmaz. |


## ADR-0021

*"E-posta ve telefon belgeleri"*

| Kod | Açıklama |
|---|---|
| `ADR-0021/CT1` | İletişim belgesi yalnızca kod doğru girildikten sonra verilir; kod tek kullanımlık, süreli ve deneme sınırlıdır. |
| `ADR-0021/CT2` | Adres, numara ve kod günlüğe, olay kaydına ya da veritabanına düz yazılmaz; yalnızca anahtarlı özet saklanır. |
| `ADR-0021/CT3` | İletişim belgesi kimlik bilgisi (ad, TCKN, doğum tarihi) taşımaz ve `category` claim'i içermez. |
| `ADR-0021/CT4` | Test gönderim yolları (`log`, `email-relay`) gerçek kullanıcıya açık ortamda kullanılmaz. |


## ADR-0022

*"Kimlik servisinin sınıfı"*

| Kod | Açıklama |
|---|---|
| `ADR-0022/IDC1` | Tamga'nın kendi işlettiği bir hizmet, bağımsız uygunluk değerlendirmesi olmadan güven listesinde QUALIFIED ya da I3 olarak kaydedilmez. |
| `ADR-0022/IDC2` | Kimlik belgesi `category` claim'i taşımaz; sınıf yükseltilene kadar hiçbir politika kimlik belgesi için I3 istemez. |


## ADR-0023

*"Otomatik kopya yenileme"*

| Kod | Açıklama |
|---|---|
| `ADR-0023/AR1` | Sessiz yenileme yalnız yenileme belirteci olan belgeler için, kurumun ilan ettiği eşikte, uygulama önde ve kilit açıkken ve rastgele gecikmeyle yapılır. |
| `ADR-0023/AR2` | Yenileme belirteci belgeye özel DPoP anahtarına bağlıdır, tek kullanımlıktır ve her kullanımda değişir; her yenilemede cüzdan onayı doğrulanır. |
| `ADR-0023/AR3` | Kurum yenilemede öznitelikleri yetkili kaynaktan yeniden okur; kaynakta kayıt yoksa belge verilmez ve belirteç iptal edilir. |
| `ADR-0023/AR4` | Kişi alanlarını saklamayan servisler (kimlik, iletişim) yenileme belirteci vermez. |


## ADR-0024

*"Katılımcı kayıt verisi"*

| Kod | Açıklama |
|---|---|
| `ADR-0024/RPR1` | Yeni ya da güncellenen her doğrulayıcı kaydı, her kullanım kapsamı için bir gizlilik politikası bağlantısı ve en az bir iletişim yolu taşır. |
| `ADR-0024/RPR2` | Doğrulayıcı ve belge veren kayıtları yalnız kurumlar içindir; kayıtta kişi adı ya da kişisel iletişim bilgisi bulunmaz. |
| `ADR-0024/RPR3` | Her doğrulayıcı kaydı yetkili veri koruma kurumunu ve ona ulaşma yolunu belirtir. |


## ADR-0025

*"Cüzdan ve anahtar kanıtı"*

| Kod | Açıklama |
|---|---|
| `ADR-0025/WIA1` | WIA'nın ömrü 24 saatten kısadır; her belge işleminde yeni PoP anahtarlı ve yeni iptal listesi girişli bir WIA kullanılır. |
| `ADR-0025/WIA2` | Cüzdan sağlayıcısı birim kaydında kişisel veri tutmaz; birim iptal edilince o birime verilmiş bütün WIA girişleri iptal olur. |
| `ADR-0025/WIA3` | KA'daki anahtar deposu seviyesi gerçeği söyler; doğrulanmamış bir beyan KA'ya yazılmaz. |
| `ADR-0025/WIA4` | Belge veren, iptal edilmiş bir WIA ya da KA ile belge vermez. |


## ADR-0026

*"Kayıt sertifikaları"*

| Kod | Açıklama |
|---|---|
| `ADR-0026/WRC1` | Kayıt sertifikası yalnız imzalı güven listesindeki kayıttan üretilir; listede olmayan alan ya da tür sertifikaya girmez. |
| `ADR-0026/WRC2` | Kayıt sertifikası kayıt birimi anahtarıyla imzalanır; bu anahtar liste imza anahtarından ayrıdır ve LOTL'de yayınlanır. |
| `ADR-0026/WRC3` | Kayıt sertifikasının geçerliliği en çok 12 aydır ve kaydın ya da kullanımın bitiş tarihini aşmaz. |
| `ADR-0026/WRC4` | Cüzdan, imzası, süresi ya da erişim sertifikası ile bağı doğrulanamayan kayıt sertifikası taşıyan isteğe veri göndermez. |


## ADR-0027

*"İşlem günlüğünü dışa aktarma"*

| Kod | Açıklama |
|---|---|
| `ADR-0027/LX1` | Günlük cihazdan yalnız kişinin başlattığı, kişinin parolasıyla şifreli (TS10 §5) dışa aktarmada çıkar; otomatik ya da sunucuya dışa aktarma yoktur. |
| `ADR-0027/LX2` | Dışa aktarılan günlükte ve taşıma dosyasında belge değeri, kopya ve anahtar bulunmaz. |


## ADR-0029

*"Geliştirme evresinde şemalar"*

| Kod | Açıklama |
|---|---|
| `ADR-0029/DS1` | `SCHEMA_STAGE = "development"` yalnız gerçek kullanıcıya belge verilmeyen evrede kullanılır; ilk gerçek kurum ya da kişi belgesinden önce `stable` yapılır. |


## ADR-0030

*"Ürün adları"*

| Kod | Açıklama |
|---|---|
| `ADR-0030/PN1` | Cüzdan uygulamasının adı her yerde **Tamga Wallet**'tır (tk: Tamga Wallet). |
| `ADR-0030/PN2` | Web sitesi giriş düğmesi ve akışı **"Tamga ile giriş yap"** / "Tamga ile kayıt ol" (en "Sign in with Tamga" / "Sign up with Tamga"; tk "Tamga bilen gir" / "Tamga bilen hasaba dur"). Düğmenin görünümü marka sayfasındadır (`tamga.network/brand`). |
| `ADR-0030/PN3` | Barındırılan doğrulayıcının (aracı doğrulayıcı, [[ADR-0017]]; `verify.tamga.network`) adı **Tamga Verify**'dır. |
| `ADR-0030/PN4` | "TamgaID" ürün adı olarak kullanılmaz. Kod ve veri tanımlayıcıları (`tamga-id` kiracısı, `id.tamga.network`, `urn:tamga:id:*`) değişmez; bunlar ad değil adrestir. |


## ADR-0031

*"Site başına takma ad"*

| Kod | Açıklama |
|---|---|
| `ADR-0031/PS1` | Cüzdan bir siteye yalnız o sitenin kayıtlı `rp_id`'sinden türetilen takma adı sunar; farklı sitelere aynı takma ad gitmez. |
| `ADR-0031/PS2` | Takma ad tohumu kimlik servisinde saklanmaz; ayrı anahtarla (`pseudonymKey`) her doğrulamada yeniden türetilir. |
| `ADR-0031/PS3` | Tohum taşıyan belge türü hiçbir RP'ye sunulmaz; güven listesinde hiçbir kapsamda yer alamaz. |
| `ADR-0031/PS4` | `site-signup` / `site-signin` ve benzeri giriş politikaları `document_number_hash` ya da kimlik numarası istemez. |
| `ADR-0031/PS5` | Takma ad sunumu takma ad anahtarıyla imzalıdır (`aud` = site, `nonce`) ve iptal edilmemiş wallet unit kanıtı taşır. |
| `ADR-0031/PS6` | Kullanıcının takma ada verdiği ad siteye gönderilmez. |


## ADR-0032

*"Sıfır bilgi ispatı (ZK)"*

| Kod | Açıklama |
|---|---|
| `ADR-0032/ZK1` | Kurum belgesinin biçimi ve imzası ZK sunumu için değiştirilmez; ZK yalnız cüzdanda ve doğrulayıcıda. |
| `ADR-0032/ZK2` | Doğrulayıcı yalnız imzalı güven listesinde yayımlanan ve durumu ACTIVE olan devre özetlerini kabul eder; bilinmeyen ya da etkin olmayan devre = RED. |
| `ADR-0032/ZK3` | ZK sunumu yalnız DCQL'de istenen alanları ispatlar; ispat dışı alan doğrulayıcıya gitmez. |
| `ADR-0032/ZK4` | ZK sunumunda iptal listesi indeksi açılmaz; ZK ile sunulan belgenin geçerlilik süresi kısa tutulur (K6). |
| `ADR-0032/ZK5` | ZK desteklenmezse sunum klasik kurallarla (WL5 dahil) yapılır; ispat hatası kullanıcıya "şu an bu yolla gösterilemiyor" diye yansır, veri sızdırmaz. |
| `ADR-0032/ZK6` | Bir belge türünde bir alan adı yalnız bir ad alanında bulunur (K8). |


## ADR-0033

*"Mağaza inceleme kodu"*

| Kod | Açıklama |
|---|---|
| `ADR-0033/RV1` | İnceleme kodu yalnız özetiyle saklanır, süreli (≤ 14 gün) ve tek kullanımlıktır; günlüğe düz yazılmaz. |
| `ADR-0033/RV2` | İnceleme koduyla verilen belge, kimlik servisinin gerçek imzacısıyla imzalanmaz ve yalnız inceleme politikalarında geçer. |
| `ADR-0033/RV3` | İnceleme kodu olmadan canlı kimlik servisi sahte doğrulama sağlayıcısına geçemez. |


## ADR-0034

*"HAIP 1.0 uyumu"*

| Kod | Açıklama |
|---|---|
| `ADR-0034/CI1` | Doğrulayıcı imzalı istekte yalnız `x509_hash` istemci kimliğini kullanır; değer erişim sertifikasından hesaplanır, ayardan okunmaz (HAIP 1.0 §5). |
| `ADR-0034/CI2` | Cüzdan yalnız `x509_hash` öneki kabul eder; özet yaprak sertifikayla eşleşmezse istek reddedilir. Yanıt adresinin alanı imzalayan sertifikanın SAN'ında olmalıdır (yerel geliştirme hariç). |
| `ADR-0034/CI3` | Güven listesi RP kaydında `client_id` yayıncı tarafından erişim sertifikasından hesaplanır; kalıcı kayıt kimliği `dns_name`'dir ve sertifikanın SAN'ında bulunmalıdır. |
| `ADR-0034/CI4` | Kopya ayrımı, takma ad türetme, sunum günlüğü ve aracı ilişkileri `dns_name`'e bağlanır; `x509_hash`'e bağlanmaz. |
| `ADR-0034/CI5` | Geçiş kartı jetonunun `aud`'u RP'nin `dns_name`'idir. |
| `ADR-0034/CI6` | WIA `sub`, aynı cüzdan çözümünü kullanan bütün örneklerde ortak değerdir; örneğe özgü tanımlayıcı taşımaz (HAIP 1.0 §4.4.1). |


## ADR-0035

*"Konumlanma"*

| Kod | Açıklama |
|---|---|
| `ADR-0035/PO1` | Tamga belge, protokol ve güven listesi biçimleri AB standartlarından ayrılmaz; Tamga'ya özgü her ek, standart bir uzantı noktasıyla yapılır ve standart istemcileri bozmaz. |
| `ADR-0035/PO2` | Tamga Network bir cüzdanı adına göre değil, yayınlanmış kurallara ve uyum testlerine göre tanır; kurallara uyan cüzdan sağlayıcısı listeye girebilir. |
| `ADR-0035/PO3` | Tamga'nın vekâleten üstlendiği devlet rolleri (liste işletmecisi, kayıt birimi, kök CA, geçici kimlik sağlayıcı) devredilebilir tasarlanır; devirde belge, cüzdan ve doğrulayıcı tarafında yalnız adres ve imzacı değişir. |
| `ADR-0035/PO4` | Kamuya açık metinlerde Tamga Wallet "EUDI Wallet" ya da "ulusal cüzdan" olarak sunulmaz; doğru ifade "AB uyumlu cüzdan"dır ve uyum test sonuçlarıyla desteklenir. |


## ADR-0036

*"Güven federasyonu"*

| Kod | Açıklama |
|---|---|
| `ADR-0036/FD1` | Dış liste yalnız Tamga imzalı LOTL'da adresi, sabitlenmiş imzacı parmak izi ve kapsamıyla gösterilir; imzacısı LOTL'dakiyle eşleşmeyen liste yüklenmez. |
| `ADR-0036/FD2` | Dış liste kapsamı dışındaki rollere ve belge türlerine kefil olamaz; kapsam dışı kayıtlar yok sayılır. |
| `ADR-0036/FD3` | Dış listenin eksik, bayat ya da doğrulanamaz olması Tamga listelerinin tazeliğini bozmaz; o listeye bağlı her soru UNKNOWN döner. |
| `ADR-0036/FD4` | Bir dış listenin LOTL'a girmesi, değişmesi ya da çıkması proje yönetimi onayıyla olur ve kayıt `approval` alanında belirtilir; yer tutucu içeren kayıt yayınlanmaz. |
| `ADR-0036/FD5` | Tamga türlerinde `vct#integrity` zorunludur; dış türlerde tür güveni dış listenin imzalı kaydından gelir. |


## ADR-0037

*"Tamga Network yalnızca bir ağdır"*

| Kod | Açıklama |
|---|---|
| `ADR-0037/PO5` | Tamga Network hizmet satmaz; ağın belgelerinde ve sitelerinde fiyat, satış ya da ticari hizmet anlatımı bulunmaz. Ticari hizmetler sağlayıcısının adıyla, ağın dışında sunulur. |
| `ADR-0037/PO6` | Ağın referans hizmetleri ve kayıt süreci bütün katılımcılara aynı koşullarla açıktır; hiçbir hizmet sağlayıcıya, Tamga ekibinin şirketi dahil, öncelik ya da ayrıcalık tanınmaz. |


## ADR-0038

*"Sandbox: test ağı"*

| Kod | Açıklama |
|---|---|
| `ADR-0038/SB1` | Sandbox kök sertifikası ve sandbox liste imzacıları gerçek ağın hiçbir listesinde yer almaz; gerçek ağın kök ve imza anahtarları sandbox'ta hiçbir şey imzalamaz. |
| `ADR-0038/SB2` | Sandbox listelerin listesi kendini test olarak işaretler; gerçek ağ için yapılandırılmış bir cüzdan ya da doğrulayıcı sandbox listesini kabul etmez. |
| `ADR-0038/SB3` | Sandbox'ın varsayılan kimlik doğrulaması sahte sağlayıcıdır (hızlı deneme) ve örnek kimlik numaraları geçersiz biçimdedir; gerçek kişinin verisi yalnız kişinin kendisinin seçtiği [[ADR-0040]] gerçek yolunda ve oradaki sınırlarla girer (taramadan önce uyarı ve onay, günlük/aylık tavan, gerçek kimlik ve belge numarası belgeye yazılmaz, sağlayıcı oturumu hemen silinir, her şey gece sıfırlamasında silinir). |
| `ADR-0038/SB4` | Sandbox'ta verilen her belge ve sandbox'a bağlı her ekran test olduğunu görünür biçimde belirtir. |
| `ADR-0038/SB5` | Sandbox verileri her an sıfırlanabilir; sandbox'a bağlı hiçbir süreç kalıcılık varsaymaz. |


## ADR-0039

*"Doğrulanmış sürücü belgesi bilgisi"*

| Kod | Açıklama |
|---|---|
| `ADR-0039/DL1` | Tamga'nın sürücü belgesi bilgisi belgesi resmî mDL docType'ını ya da namespace'ini kullanmaz; metadata'sında, `not_official_licence` alanında, kartında ve doğrulama sonucunda resmî sürücü belgesi yerine geçmediğini yazar. |
| `ADR-0039/DL2` | Belge kimlik numarası, kısıtlama ya da sağlık kodu, fotoğraf ve adres taşımaz; belge numarası yalnız anahtarlı özet olarak bulunur; sağlayıcının not alanları okunmaz. |
| `ADR-0039/DL3` | Belgenin süresi kartın bitiş tarihini ve kartın incelendiği günden itibaren bir yılı geçmez; otomatik yenileme süreyi uzatmaz. |
| `ADR-0039/DL4` | Bir ülkenin yetkili makamı dijital sürücü belgesi vermeye başlayınca Tamga o ülke için bu türü yeniden vermez. |
| `ADR-0039/DL5` | Belge yalnız cüzdandaki etkin Tamga kimlik belgesinin sunumu üzerine ve karttaki ad ile doğum tarihi o kimlikle eşleşirse verilir; sınıflar okunamıyorsa ya da kart süresi geçmişse verilmez; bağlı kimlik belgesi iptal edilince, yeniden verilince ya da silinince bu belge de iptal edilir ya da silinir. |


## ADR-0040

*"Sandbox'ta gerçek kimlik doğrulama"*

| Kod | Açıklama |
|---|---|
| `ADR-0040/RI1` | Sandbox'ta kimlik akışı iki seçenek sunar (gerçek kimlikle sağlayıcı ya da hızlı deneme); seçim yapılmayan akış sahte sağlayıcıyla yapılır. Gerçek yol herkese açıktır; yalnız isteğe bağlı davet kipinde geçerli bir davet kodu gerekir. |
| `ADR-0040/RI2` | Sandbox'ın gerçek yolu gerçek ağın sağlayıcı hesabını yalnız ayrı adlı sandbox değişkenleriyle kullanır; bu değerler yalnız sandbox kullanıcısına okunur, gerçek ağın ayarları, imza anahtarları ve verisi sandbox'a kapalıdır; gerçek ağ sandbox adlarını kabul etmez. Sandbox sağlayıcı bildirimine (webhook) güvenmez, kararı sağlayıcının API'sinden çeker; gerçek ağ kendi açmadığı oturumun bildirimini yok sayar. |
| `ADR-0040/RI3` | Gerçek yolda kişi, sağlayıcıya yönlendirilmeden önce test ortamı uyarısını açıkça onaylar. |
| `ADR-0040/RI4` | Sandbox belgesine gerçek kimlik numarası ve belge numarası yazılmaz; kişiden yalnız ad, soyad ve doğum tarihi (ve türetilen yaş bilgisi) geçer. |
| `ADR-0040/RI5` | Sağlayıcıdaki doğrulama oturumu belge verildiğinde ya da akış belgeyle sonuçlanmadığında hemen silinir, açık kalan oturum en geç gece sıfırlamasında silinir; sandbox kimlik servisi oturum kimliğini kalıcı kayıtta tutmaz; akış başına en çok bir gerçek oturum açılır. |
| `ADR-0040/RI6` | Davet kodları yalnız anahtarlı özetle saklanır; düz kod, ad, doğum tarihi ve sağlayıcı yanıtı hiçbir günlüğe yazılmaz; hepsi gece sıfırlamasında silinir. |
| `ADR-0040/RI7` | Sandbox'ta açılan her gerçek sağlayıcı oturumu (açık ya da davetli) günlük ve aylık tavana sayılır; tavan dolunca gerçek oturum açılmaz, yalnız hızlı deneme kalır; sayaç gece sıfırlamasıyla sıfırlanmaz. |


## ADR-0041

*"Sandbox'ta kurum test hesapları"*

| Kod | Açıklama |
|---|---|
| `ADR-0041/TI1` | Test kurumu yalnız sandbox'ta vardır; yaprak sertifikalarını yalnız sandbox test kurumları ara sertifika makamı verir; sandbox kökünün özel anahtarı hiçbir sunucuda bulunmaz. |
| `ADR-0041/TI2` | Her test kurumu sandbox listesinde `test_institution: true` taşır ve görünen adı "(TEST)" ile biter. |
| `ADR-0041/TI3` | Sandbox'ta Kurum Konsolu yalnız test kurumlarına hizmet verir; gerçek ağda deneme kayıt defteri kipi açılamaz. |
| `ADR-0041/TI4` | Kimlik numarası sağlama kuralını geçen 11 haneli bir sayı taşıyan test kaydı reddedilir; her kayıt ekranı gerçek kişi verisi girilmemesi için uyarır. |
| `ADR-0041/TI5` | Test kurumları ve onlara ait hesap, kayıt, belge kaydı ve sertifikalar gece sıfırlamasında silinir ve sandbox listesinden çıkar. |
| `ADR-0041/TI6` | Test kurumu açma ve kullanma sınırları IP adresi kullanılmadan uygulanır. |


## ADR-0042

*"Ağ ve cüzdanlar: ağ cüzdan işletmez"*

| Kod | Açıklama |
|---|---|
| `ADR-0042/NW1` | Ağ hiçbir cüzdanın uygulamasını, cüzdan sağlayıcısını ya da sitesini işletmez; cüzdanları yalnız güven listesindeki kayıtlarıyla tanır. |
| `ADR-0042/NW2` | Ağın alan adlarında cüzdana ait hizmet çalışmaz. |
| `ADR-0042/NW3` | Sandbox tek test ortamıdır; sandbox'ta cüzdan sağlayıcıyı cüzdan işletir ve sandbox listesine kaydolur. |
| `ADR-0042/NW4` | Ağın arayüzleri ve paketleri cüzdan adını sabit yazmaz; gerekirse güven listesindeki kayıt verisinden alır. |


## ADR-0043

*"Yaş sınırı yok: AB yaklaşımı"*

| Kod | Açıklama |
|---|---|
| `ADR-0043/YS1` | Ağ, cüzdanların güven listesine kaydı için ve kimlik servisinin kimlik belgesi vermesi için asgari yaş şartı koymaz. |
| `ADR-0043/YS2` | Bir belgeyi kimin alabileceğini o belgenin belge vereni belirler; yaşa bağlı doğrulama, doğrulayıcının yalnız gereken bilgiyi istemesiyle yapılır. |


## ARCH-0003

*"Bileşen mimarisi"*

| Kod | Açıklama |
|---|---|
| `ARCH-0003/CMP1` | Doğrulayıcı servisi zinciri doğrudan sorgulamaz; indeksleyiciden okur (§2.1). |
| `ARCH-0003/CMP2` | İndeksleyici bilinmeyen bir implementasyon sürümü görünce **durur ve alarm verir** (§2.2). |
| `ARCH-0003/CMP3` | İndeksleyici kişisel veri saklamaz (§2.4). |
| `ARCH-0003/CMP4` | Bayat indeksleyici `INDETERMINATE` üretir, `REJECTED` değil (§2.5). |
| `ARCH-0003/CMP5` | OBS adaptörü eşlemede karşılığı olmayan veri için belge vermeyi durdurur; tahmin üretmez (§3.2). |
| `ARCH-0003/CMP6` | Status yayını değişiklik olmasa da sabit aralıkta çalışır (§3.4). |
| `ARCH-0003/CMP7` | Doğrulayıcı doğrulama başına status çekmez; ön çekim kullanır (§4.2). |
| `ARCH-0003/CMP8` | Cüzdan şemaları toplu çeker, kullanım anında değil (§6). |
| `ARCH-0003/K1` | Belge ve status imzalama anahtarları ayrıdır (§8). |
| `ARCH-0003/CMP9` | Doğrulama sonucu üç değerlidir: ACCEPTED / REJECTED / INDETERMINATE. |


## SPEC-API-0001

*"Doğrulama hattı ve API"*

| Kod | Açıklama |
|---|---|
| `SPEC-API-0001/AP1` | Adım kodunun anlamı asla değişmez; kaldırılan kod yeniden kullanılmaz. |
| `SPEC-API-0001/AP2` | `INDETERMINATE`, `REJECTED` ile aynı kovaya konmaz. |
| `SPEC-API-0001/AP3` | Sonuç nesnesi claim değerlerini değil adlarını taşır. |
| `SPEC-API-0001/AP4` | `idx` hiçbir API yanıtında veya kayıtta bulunmaz. |
| `SPEC-API-0001/AP5` | HTTP durum kodu doğrulama sonucunu kodlamaz. |
| `SPEC-API-0001/AP6` | Politikanın `required_claims`'i RP'nin zincirdeki scope'unu aşamaz. |
| `SPEC-API-0001/AP7` | Hata `detail` alanı kişisel veri içermez. |
| `SPEC-API-0001/AP8` | `C2` (şema yetkisi) hiçbir yapılandırmayla atlanamaz. |
| `SPEC-API-0001/AP11` | `C1` ve `C2` belgenin `iat`'ını alır; belge verme zamanı sorguları doğrulamada kullanılmaz. |
| `SPEC-API-0001/AP12` | `issuerId` `x5c` yaprak parmak izinden türetilir, `iss` claim'inden değil. |
| `SPEC-API-0001/AP13` | Geçiş kartı jetonu doğrulaması ([[ADR-0012]] B): imza `pass_grant`'taki kopya anahtarıyla, `aud` = terminalin RP client_id'si, ömür (`exp` − `iat`) ≤ 60 s, `iat` ≤ şimdi + 30 s, `exp` ≤ şimdi + 60 s + 30 s (saat kayması toleransı), `jti` tekrar listesi (terminal grubu içinde çevrim içi paylaşılır); jetondan kişisel veri çıkarılmaz ve loglanmaz. |
| `SPEC-API-0001/AP9` | `E4` (denetim kaydı) reddedilen doğrulamalarda da çalışır. |
| `SPEC-API-0001/AP10` | `tx_code` yanıt dışında hiçbir yerde saklanmaz. |


## SPEC-CRED-0002

*"SD-JWT VC profili"*

| Kod | Açıklama |
|---|---|
| `SPEC-CRED-0002/C1` | `alg` her zaman `ES256`. |
| `SPEC-CRED-0002/C2` | `_sd_alg` her zaman `sha-256`, açıkça yazılır. |
| `SPEC-CRED-0002/C3` | Salt ≥ 128 bit, her disclosure için benzersiz. |
| `SPEC-CRED-0002/C4` | Digest, disclosure **dizesinin** hash'idir; yeniden serileştirme yapılmaz. |
| `SPEC-CRED-0002/C5` | `_sd` dizisi sıralıdır. |
| `SPEC-CRED-0002/C6` | Decoy digest kullanılmaz. |
| `SPEC-CRED-0002/C7` | `x5c` zorunlu; kök sertifika dahil edilmez. |
| `SPEC-CRED-0002/C8` | KB-JWT istisnasız zorunlu. |
| `SPEC-CRED-0002/C9` | `sd_hash`, sunulan set üzerinden ve sondaki `~` dahil hesaplanır. |
| `SPEC-CRED-0002/C10` | Eşleşmeyen disclosure reddedilir. |
| `SPEC-CRED-0002/C11` | İç içe seçici açıklama en fazla 2 seviye. |
| `SPEC-CRED-0002/C12` | Gizlemek = dizeden çıkarmak; JWT hiçbir zaman yeniden imzalanmaz. |
| `SPEC-CRED-0002/C13` | `typ` her zaman `dc+sd-jwt`; Tamga belge verenlerinden `vc+sd-jwt` kabul edilmez. |
| `SPEC-CRED-0002/C14` | Doğrulayıcı disclosure'ı çözüp yeniden serileştirmez (§3.5). |
| `SPEC-CRED-0002/C15` | `issuerId` yaprak sertifika parmak izinden türetilir; `iss` yalnızca tutarlılık kontrolüdür. |
| `SPEC-CRED-0002/C16` | `cnf` claim'i olmayan SD-JWT VC reddedilir. |
| `SPEC-CRED-0002/C17` | KB-JWT `iat` penceresi ±300 saniyedir. |
| `SPEC-CRED-0002/C18` | `category` claim'i yalnızca kayıt sınıfı PUB/QUALIFIED olan belge verenlerde ve yalnızca `urn:tamga:eaa:pub|qualified` değerleriyle bulunur; AB URN'leri (`urn:etsi:esi:eaa:eu:*`) kullanılmaz; belge sahibi assurance hiçbir claim'de taşınmaz ([[ADR-0010]] K5). |


## SPEC-CRED-0003

*"İptal ve durum listesi"*

| Kod | Açıklama |
|---|---|
| `SPEC-CRED-0003/S1` | Zincirde hiçbir iptal biti yoktur; yalnızca çapa. |
| `SPEC-CRED-0003/S2` | `bits` her zaman `2`'dir. |
| `SPEC-CRED-0003/S3` | `version` monoton artar; azalan sürüm reddedilir. |
| `SPEC-CRED-0003/S4` | Yayın CDN'e yazıldıktan **sonra** zincire kaydedilir (§5.2). |
| `SPEC-CRED-0003/S5` | Değişiklik olmasa da sabit aralıkta yayınlanır (§5.1). |
| `SPEC-CRED-0003/S6` | Aralık dışı ("acil") yayın yapılmaz. Tek istisna: servis yeniden başladığında yayımlı belirteç yoksa ya da süresinin dolmasına bir aralıktan az kalmışsa hemen yeniden yayınlanır — içerik değişmez ve zamanlama bir iptal olayına bağlı değildir, bu yüzden S6'nın koruduğu bilgi (iptal anı) sızmaz. |
| `SPEC-CRED-0003/S7` | `idx` rastgele tahsis edilir; sıralı sayaç kullanılmaz (§6.1). |
| `SPEC-CRED-0003/S8` | Liste URI'si opaktır; yıl, bölüm, kohort kodlamaz (§6.3). |
| `SPEC-CRED-0003/S9` | Listeler tip dışında hiçbir ölçütle bölünmez (§6.4). |
| `SPEC-CRED-0003/S10` | Liste kapasitesi ≥ 100.000; doluluk ≤ %80. |
| `SPEC-CRED-0003/S11` | Status anahtarı, belge imzalama anahtarından ayrıdır (§3.4). Status anahtarının sertifika parmak izi güven listesinde kurum kaydının `delegate_keys[]` alanında `purpose: "status_list"` ile yayınlanır; doğrulayıcı D3'te token imzacısını bu kayıtla eşler (kayıt yoksa INDETERMINATE, eşleşmezse REJECTED). Liste dışı `idx` geçerli okunmaz (D6 RED). |
| `SPEC-CRED-0003/S12` | Doğrulayıcı doğrulama başına çekim yapmaz; toplu ön çekim kullanır (§9.1). |
| `SPEC-CRED-0003/S13` | `exp`/`ttl` claim'leri HTTP önbellek başlıklarını geçersiz kılar. |
| `SPEC-CRED-0003/S14` | "Geçersiz" ile "doğrulanamadı" kullanıcıya farklı gösterilir (§7.1). |


## SPEC-ID-0002

*"Kurum kimliği (X.509)"*

| Kod | Açıklama |
|---|---|
| `SPEC-ID-0002/XC1` | Kurumsal kimlik daima devletinin çıpalı kök CA'sına zincirlenir. |
| `SPEC-ID-0002/XC2` | `issuerId` sertifika fingerprint'ine bağlıdır; sertifika değişince kimlik yeni `issuerId` + `successorId` ile devam eder. |
| `SPEC-ID-0002/XC3` | Zincir yalnızca kişisel-olmayan veri tutar (kök/kurum public anahtarı, durum). |
| `SPEC-ID-0002/XC4` | Vatandaşın küresel tanımlayıcısı yoktur (yalnızca pairwise takma ad). |
| `SPEC-ID-0002/XC5` | Entity↔kimlik bağı yalnızca accountable disclosure eşiğiyle çözülür. |


## SPEC-ID-0003

*"Kimlik doğrulama"*

| Kod | Açıklama |
|---|---|
| `SPEC-ID-0003/IDP1` | Belge sahibinin kimlik doğrulama seviyesi ve yolu belgeye yazılmaz; yalnızca belge verenin denetim kaydında tutulur. |
| `SPEC-ID-0003/IDP2` | Tipin asgari seviyesi sağlanmadan teklif üretilmez; seviye tahminle yükseltilmez. |
| `SPEC-ID-0003/IDP3` | IDV sağlayıcı entegrasyonu yalnızca **Tamga kimlik attestation servisindedir** (`id.tamga.network`, [[ADR-0011]]); kurumların belge verme servisleri, cüzdan ve doğrulayıcı sağlayıcıyla konuşmaz. |
| `SPEC-ID-0003/IDP4` | Belge veren, IDV sonucundan yalnızca özet kaydı saklar; belge görüntüsü, portre, video, OCR ham verisi saklanmaz. |
| `SPEC-ID-0003/IDP5` | Webhook imza ve zaman damgası doğrulanmadan işlenmez; karar her zaman decision API'den teyit edilir. |
| `SPEC-ID-0003/IDP6` | `vendor_data`/`metadata` alanlarına kişisel veri yazılmaz; yalnızca opak referans. |
| `SPEC-ID-0003/IDP7` | T3 hiçbir uzaktan IDV sonucuyla verilmez; T3 imza (NES/mobil imza) veya PID gerektirir ve pre-authorized akışla bağdaşmaz. |
| `SPEC-ID-0003/IDP8` | Sağlayıcı kesintisi seviyeyi düşürmez; o seviyeyi gerektiren belge verme durur. |
| `SPEC-ID-0003/IDP9` | Kimlik servisi IDV sonucundan kişi alanlarını yalnızca belge verme anına kadar tutar; belge verildikten sonra yalnızca opak `subject_ref`, belge numarası hash'i, süre ve status indeksleri kalır; görüntü, selfie, video, OCR ham verisi Tamga'da hiç saklanmaz (K4). |
| `SPEC-ID-0003/IDP10` | Ulusal kimlik numarası (`personal_administrative_number`) yalnızca `urn:tamga:id:IdentityAttestation:1` tipinde ve selective disclosure ile taşınır; başka hiçbir tipe yazılmaz; kurum eşleştirmeden sonra saklamaz ve loglamaz. |
| `SPEC-ID-0003/IDP11` | Kimlik attestation'ı verilmeden önce aydınlatma metni gösterilir ve açık rıza alınır; rıza verilmeyen oturumda IDV başlatılmaz (`access_denied`). |


## SPEC-PROTO-0001

*"OpenID4VCI profili"*

| Kod | Açıklama |
|---|---|
| `SPEC-PROTO-0001/PR1` | Pre-authorized akışta `tx_code` atlanamaz. |
| `SPEC-PROTO-0001/PR2` | Metadata'daki her `vct`, belge verenin zincirde yetkilendirildiği bir şemadır. |
| `SPEC-PROTO-0001/PR3` | Belge teklifi URI tek kullanımlık, 5 dakika ömürlü. |
| `SPEC-PROTO-0001/PR4` | `c_nonce` tüketimi atomiktir. |
| `SPEC-PROTO-0001/PR5` | Kanıt ve belge imzası yalnızca `ES256`. |
| `SPEC-PROTO-0001/PR6` | Batch'teki her kopya **farklı cihaz anahtarına** bağlanır. |
| `SPEC-PROTO-0001/PR7` | Bağlama yöntemi denetim kaydına yazılır, belgeye yazılmaz. |
| `SPEC-PROTO-0001/PR8` | Hata yanıtları kişisel veri içermez. |
| `SPEC-PROTO-0001/PR9` | Erişim belirteci ömrü ≤ 5 dakika. |
| `SPEC-PROTO-0001/PR10` | Kopya↔indeks eşlemesi belge verende kalır, asla dışarı çıkmaz. |
| `SPEC-PROTO-0001/PR11` | İhraçtan önce Wallet Unit Attestation + PoP doğrulanır; WUA imzacısı güven listesindeki cüzdan sağlayıcısı anahtarlarından biridir; `key_storage` kiracı politikasını karşılamıyorsa belge verilmez (§11.1). |
| `SPEC-PROTO-0001/PR12` | `out-of-band` offer'da `tx_code` offer ile **farklı kanaldan** iletilir; üç yanlış deneme offer'ı geçersiz kılar; kanal adresi yalnızca kurumun kayıtlı verisinden gelir (§3.3). |
| `SPEC-PROTO-0001/PR13` | Authorization code akışında PAR ve PKCE (S256) zorunludur; istemci kimliği Wallet Unit Attestation'dır (`client_secret` yok); `redirect_uri` PAR'da bağlanır ve `/authorize`'da değiştirilemez; `redirect_uri` istemcinin kayıtlı adresleriyle birebir eşleşmelidir (izin listesi; aksi hâlde `invalid_redirect_uri`); token isteği PAR'daki `redirect_uri`'yi ve aynı `client_id`'yi (WUA `sub`) taşımalıdır (aksi hâlde `invalid_grant`); cüzdan token ucunu yetkilendirme sunucusunun meta verisinden (`token_endpoint`, RFC 8414) alır; code tek kullanımlık ve ≤ 60 s (§11.2). |
| `SPEC-PROTO-0001/PR14` | Kurumun belge verme servisi cüzdanın başlattığı belge vermede kimliği yalnızca **kimlik attestation'ının sunumu** ile ve tam doğrulama hattından (T0 + A–E) geçerek eşler; eşleştirme anahtarları (TCKN, doğum tarihi) saklanmaz ve loglanmaz; eşleşmezse belge verilmez (§11.2, [[ADR-0011]] K3/K6). |
| `SPEC-PROTO-0001/PR15` | Cüzdan kurum dizinini yalnızca güven listesinden alır; listede olmayan belge verene PAR göndermez (§11.2). |
| `SPEC-PROTO-0001/PR17` | Erişim belirteci DPoP'a bağlıdır (RFC 9449): `/token` geçerli bir DPoP kanıtı olmadan belirteç vermez; `/credential` yalnızca `Authorization: DPoP` ve aynı anahtarla, bu uç ve bu belirteç (`ath`) için üretilmiş, daha önce görülmemiş kanıtla çalışır (§4, §7.1). |
| `SPEC-PROTO-0001/PR18` | Yenileme belirteci tek kullanımlıktır, her kullanımda yenilenir, belge verme işlemindeki DPoP anahtarına ve cüzdan örneğine bağlıdır; belge veren yenilemede kaydı yetkili kaynaktan yeniden okur ve kayıt yoksa belge vermez ([[ADR-0023]] AR2–AR3, §4.1). |
| `SPEC-PROTO-0001/PR19` | WIA ile gelen istekte `client_status` iptal edilmişse belge verilmez; KA'lı proof'ta KA sağlayıcı imzalı, iptal edilmemiş, proof `attested_keys[0]` ile imzalı ve nonce geçerli olmalıdır; anahtar deposu alt sınırı KA seviyesine göre uygulanır ([[ADR-0025]], §11.1.1). |
| `SPEC-PROTO-0001/PR16` | Kimlik attestation'ı yanıtında her `credentials[]` nesnesi, `credential` (SD-JWT VC) ile **aynı proof anahtarına bağlı** bir `mso_mdoc` (base64url IssuerSigned, ISO 18013-5) taşır; iki temsil aynı istekte üretilir, aynı status bitini paylaşır; cüzdan mdoc'u SD-JWT kopyasıyla çapraz doğrulamadan (aynı belge veren sertifikası, aynı alanlar, `deviceKey` = `cnf`) saklamaz ([[ADR-0013]] MD1–MD3). |


## SPEC-PROTO-0002

*"OpenID4VP profili"*

| Kod | Açıklama |
|---|---|
| `SPEC-PROTO-0002/PV1` | `presentation_definition` (PE) reddedilir; yalnızca DCQL. |
| `SPEC-PROTO-0002/PV2` | Cüzdan, client identifier'ı zincir kaydına çözmeyi dener (§2.3). |
| `SPEC-PROTO-0002/PV3` | Şifresiz yanıt modu kullanılmaz. |
| `SPEC-PROTO-0002/PV4` | `origin` prefix'i istek içinde client identifier olarak kabul edilmez. |
| `SPEC-PROTO-0002/PV5` | Ret sebebi doğrulayıcıya sızmaz. |
| `SPEC-PROTO-0002/PV6` | İstek nesnesi imzalı olmalıdır; `redirect_uri` prefix'i reddedilir. |
| `SPEC-PROTO-0002/PV7` | KB-JWT `aud` değeri client identifier'ın tamamıdır (prefix dahil). |
| `SPEC-PROTO-0002/PV8` | Sunum kaydı cihazda kalır; sunucuya gönderilmez. |
| `SPEC-PROTO-0002/PV9` | Bir istekte en fazla 3 belge, 2 `credential_sets`. |
| `SPEC-PROTO-0002/PV10` | `nonce` tek kullanımlıktır; doğrulayıcı tekrar kabul etmez. |
| `SPEC-PROTO-0002/PV11` | `mso_mdoc` sunumunda cihaz imzası, client identifier'ın tamamını (prefix dahil), `nonce`'u, `response_uri`'yi ve yanıtın şifrelendiği anahtarın parmak izini bağlayan SessionTranscript (OpenID4VPHandover) üzerindedir; başka bir isteğe taşınan DeviceResponse A6'da reddedilir. |
| `SPEC-PROTO-0002/PV12` | Cüzdan, istenen alanlardan birini taşımayan belgeyi göndermez (`claim_sets` yoksa bütün alanlar, varsa seçilen kombinasyonun bütün alanları belgede olmalıdır); isteğe bağlı alan `claim_sets` ile istenir. |
| `SPEC-PROTO-0002/PV13` | Cüzdan imzalı istek nesnesini zamanla ve hedefle denetler: `exp` zorunludur ve geçmiş olamaz, `iat` 60 sn'den fazla ileri tarihli olamaz (saat kayması toleransı 60 sn), `aud` verilmişse `https://self-issued.me/v2` olmalıdır; aksi hâlde istek reddedilir. `dc+sd-jwt` sorgusu türü `meta.vct_values` ile belirtmelidir (türsüz sorgu reddedilir). |
| `SPEC-PROTO-0002/PV14` | Aracı doğrulayıcı ([[ADR-0017]] K7) bir RP adına ancak ilişki iki kayıtta da yazılıysa istek gönderebilir: asıl RP aracıyı `uses_intermediaries`'te, aracı asıl RP'yi `served_relying_parties`'te listeler; tek taraflı beyanda cüzdan isteği reddeder. |


## SPEC-SCHEMA-0001

*"Şema kataloğu"*

| Kod | Açıklama |
|---|---|
| `SPEC-SCHEMA-0001/D1` | Yayınlanmış bir Type Metadata / JSON Schema dosyasının (`metadata_url`) içeriği asla değişmez; minor/patch yeni `metadata_url` + hash, major yeni `vct` URN'i ([[ADR-0010]] K7). |
| `SPEC-SCHEMA-0001/D2` | `contentHash` (zincir) = `vct#integrity` (belge) = SHA-256(yayınlanan baytlar). |
| `SPEC-SCHEMA-0001/D3` | Type Metadata içindeki `vct`, belgedeki `vct` ile aynı olmalıdır. |
| `SPEC-SCHEMA-0001/D4` | Kök tip dışında her tipte `extends` + `extends#integrity` bulunur. |
| `SPEC-SCHEMA-0001/D5` | `extends` zinciri döngüsüzdür ve en fazla 5 seviyedir. |
| `SPEC-SCHEMA-0001/D6` | Hiçbir kişisel veri alanı `sd: "never"` olamaz. |
| `SPEC-SCHEMA-0001/D7` | Her NETWORK şeması en az `tr-TR` ve `en-US` `display` taşır. |
| `SPEC-SCHEMA-0001/D8` | Zincir kaydı, CDN yayınından sonra yapılır (§6 sıra kuralı). |
| `SPEC-SCHEMA-0001/D9` | `isAuthorizedForSchema` varsayılanı `false`'tur (allowlist). |


## SPEC-SCHEMA-0002

*"Eğitim şemaları"*

| Kod | Açıklama |
|---|---|
| `SPEC-SCHEMA-0002/E1` | Ulusal kimlik numarası bu iki NETWORK şemasında yer almaz (§1.2). |
| `SPEC-SCHEMA-0002/E2` | `grade` ve `thesis_title` her zaman `sd: always`'tir (§3.3). |
| `SPEC-SCHEMA-0002/E3` | `is_graduate` sabit `true`'dur; `false` bir diploma anlamsızdır. |
| `SPEC-SCHEMA-0002/E4` | `StudentCredential` `exp` taşır; `DiplomaCredential` taşımaz. |
| `SPEC-SCHEMA-0002/E5` | `DiplomaCredential` `status` taşır; `StudentCredential` taşımaz. |
| `SPEC-SCHEMA-0002/E6` | Her iki şemada `additionalProperties: false`. |
| `SPEC-SCHEMA-0002/E7` | `isced_f_code` her iki şemada zorunludur; 2, 3 veya 4 hane olabilir. |
| `SPEC-SCHEMA-0002/E8` | Her `LangString` alanı en az kurumun resmî dilini içerir. |
| `SPEC-SCHEMA-0002/E9` | `StudentCredential.exp - iat` ≤ 90 gün (tavan, §2.1.2). |
| `SPEC-SCHEMA-0002/E10` | Hiçbir NETWORK eğitim şeması ulusal kimlik numarası alanı içermez (§1.2). |
| `SPEC-SCHEMA-0002/E11` | Eşleme tablosunda karşılığı olmayan program için belge verme durur; tahmini kod üretilmez (§6.4.2). |


## SPEC-SCHEMA-0003

*"Sektör şemaları"*

| Kod | Açıklama |
|---|---|
| `SPEC-SCHEMA-0003/SK1` | Yedi koşullu kontrol listesi tamamlanmadan domain açılmaz. |
| `SPEC-SCHEMA-0003/SK2` | `health` domaininde hiçbir kişisel veri alanı `sd: "never"` olamaz. |
| `SPEC-SCHEMA-0003/SK3` | mDL, SD-JWT VC'ye çevrilmez; mdoc olarak kalır. |
| `SPEC-SCHEMA-0003/SK4` | Devredilebilir ticaret belgeleri normal belge olamaz; ayrı ilkel gerekir. |
| `SPEC-SCHEMA-0003/SK5` | Bir tüzel kişi kendi LE belgesini kendine veremez. |
| `SPEC-SCHEMA-0003/SK6` | Kimlik numarası hiçbir NETWORK şemasında yer almaz — domain fark etmez. |
| `SPEC-SCHEMA-0003/SG1` | Uluslararası referans model seçilmiş ve [[RS-SCHEMA-0001]] benzeri bir araştırmayla gerekçelendirilmiş | Sıfırdan uydurmak tanınırlığı öldürür |
| `SPEC-SCHEMA-0003/SG2` | Taşıyıcı format kararı verilmiş (SD-JWT VC / mdoc / karma) | Format sonradan değişirse tüm şema yeniden yazılır |
| `SPEC-SCHEMA-0003/SG3` | Türetilmiş boolean claim seti tanımlanmış | `age_over_NN` deseni sonradan eklenemez ([[RS-SCHEMA-0001]] §4) |
| `SPEC-SCHEMA-0003/SG4` | Selective disclosure politikası (`sd: always` olacak alanlar) belirlenmiş | Yanlış `never`, `REVOKED` + yeniden belge verme gerektirir |
| `SPEC-SCHEMA-0003/SG5` | TTL ve iptal listesi kullanımı kararlaştırılmış | [[SPEC-CRED-0003]] Alt. C — kısa ömür mü iptal mi |
| `SPEC-SCHEMA-0003/SG6` | Asgari belge veren kategorisi ve assurance seviyesi belirlenmiş | Kategori aşımını önler ([[ADR-0007]] K6) |
| `SPEC-SCHEMA-0003/SG7` | Sektöre özgü hukuki inceleme yapılmış | Sağlık, finans ve kimlik verisi ek mevzuata tabidir |


## SPEC-TRUST-0001

*"Güven listeleri"*

| Kod | Açıklama |
|---|---|
| `SPEC-TRUST-0001/TL1` | Her listede `operator.status` vardır ve liste aşaması boyunca `"provisional"`dır; `on_behalf_of` boş bırakılmaz. |
| `SPEC-TRUST-0001/TL2` | Liste ve çapa günlüğü sürümleri monoton artar; her sürüm bir öncekinin hash'ini taşır; hiçbir satır/kayıt silinmez (statü değişikliği `status_history`'ye eklenir). |
| `SPEC-TRUST-0001/TL3` | Liste ve çapa imzası ≥2 kaydırmalı sertifikayla yapılır; rotasyon ≥30 gün önce duyurulur; yeni anahtar eskisiyle imzalanır. (Demo sapması S-6 beyanlı.) |
| `SPEC-TRUST-0001/TL4` | `TrustSource` dışında hiçbir bileşen liste dosyalarını yorumlamaz. |
| `SPEC-TRUST-0001/TL5` | `next_update` geçmiş veya erişilemeyen liste ile doğrulama **INDETERMINATE** üretir; asla ACCEPTED, asla REJECTED. |
| `SPEC-TRUST-0001/TL6` | Bilinmeyen `list_format_version` gören yükleyici durur ve alarm verir; kabul etmez. |
| `SPEC-TRUST-0001/TL7` | Ulusal listeyi yalnızca o namespace'in imza anahtarı imzalar; operatör vekâleti `operator.on_behalf_of` ile beyan edilir. |
| `SPEC-TRUST-0001/TL8` | Tamga PID vermez; `pid_providers[]` liste aşaması boyunca boştur. Tamga'nın geçici kimlik attestation'ı ([[ADR-0011]]) bir `issuers[]` kaydıdır (`category: IDENTITY`, `class: QUALIFIED`) ve devlet PID sağlayıcısı atanınca `successor_id` ile süpersede edilir. |
| `SPEC-TRUST-0001/TL9` | Şema `registered_at` ve `status_history.since` kalıcıdır; yeniden derleme bunları değiştiremez (ilk çapa zamanı). |
| `SPEC-TRUST-0001/TL10` | Zincire geçiş, liste arşivinin replay'i ve eşdeğerlik testi geçmeden tamamlanmış sayılmaz. |
| `SPEC-TRUST-0001/TL11` | Hiçbir liste, çapa günlüğü veya değişiklik günlüğü kişisel veri, belge veya belge hash'i içermez. |
| `SPEC-TRUST-0001/TL12` | Çapa günlüğü yalnızca imzalı `checkpoint` ile arşivlenir: arşivlenen satırlar `archive/` altında kalır (silinmez), kontrol noktası `previous_hash` ile arşivin son satırına, `archive.sha256` ile arşiv dosyasına bağlanır ve arşive giden satırların ürettiği **son durumu (`state`)** taşır; yükleyici ilk satırdaki kontrol noktasının imzasını, `seq = seq_to + 1` koşulunu ve `state`'in varlığını doğrulamadan zinciri sürdürmez; arşivleme bir listenin ya da şemanın bilinirliğini asla düşürmez; tam geçmiş her zaman arşivlerden yeniden kurulabilir (TL10). |


## SPEC-WALLET-0001

*"Cüzdan kuralları"*

| Kod | Açıklama |
|---|---|
| `SPEC-WALLET-0001/WL1` | Belge sahibi anahtarları seed'den türetilmez; güvenli bölgeden çıkmaz. |
| `SPEC-WALLET-0001/WL2` | Yedek belgeleri ve manifestoyu taşır; anahtarları taşımaz — cihaz değişiminde belgelerin yeniden verilmesi gerekir. |
| `SPEC-WALLET-0001/WL3` | W1 (yazılım anahtarlı) cüzdan desteklenmez (sandbox listesindeki ağın kendi deneme sahneleri için test anahtarı hariç — [[ADR-0042]] K5). |
| `SPEC-WALLET-0001/WL4` | `presentation_log` sunucuya ve otomatik olarak hiçbir koşulda çıkmaz, sunucu yedeğine girmez; yalnız kişinin başlattığı, kişinin parolasıyla şifreli dışa aktarmada (TS10) cihazdan çıkar ([[ADR-0027]]). |
| `SPEC-WALLET-0001/WL5` | Bir doğrulayıcıya her zaman aynı kopya; farklı doğrulayıcıya farklı kopya. |
| `SPEC-WALLET-0001/WL6` | Aynı doğrulayıcı + aynı `vct` için disclosure seti tutarlıdır. |
| `SPEC-WALLET-0001/WL7` | Kullanıcı eylemi olmadan yenileme yalnızca [[ADR-0023]] AR1–AR4 koşullarında yapılır. |
| `SPEC-WALLET-0001/WL8` | Aşırı talep uyarısı ayrı görsel blok + gecikmeli düğme gerektirir. |
| `SPEC-WALLET-0001/WL9` | Sunum anında şema sunucusuna istek yapılmaz. |
| `SPEC-WALLET-0001/WL10` | Tamga kullanıcı adına kurtarma anahtarı tutmaz. |
| `SPEC-WALLET-0001/WL11` | Her sunum kullanıcı doğrulaması gerektirir: güvenli donanım anahtarı olan cihazda cihazın biyometrisi ya da cihaz parolası (belge anahtarı telefon kilidine bağlıdır); yazılım anahtarı yolunda (S-9) uygulama PIN'i ya da biyometri. Geri düşüş ve vazgeçme §2.3'te. |
| `SPEC-WALLET-0001/WL12` | Geçiş kartı jetonu (`tamga-pass+jwt`) kişisel veri taşımaz: yalnızca `iss` (opak pass_id), `aud`, `iat` (≤ şimdi + 30 s), `exp` (ömür ≤ 60 s; ≤ şimdi + 60 s + 30 s saat kayması toleransı), `jti`; belge içeriği ve claim'ler QR'a girmez ([[ADR-0012]]). |
| `SPEC-WALLET-0001/WL13` | Geçiş kartı yalnızca güven listesinde kayıtlı bir RP/terminal grubu için üretilir ve kayıt anında verilen rıza süreli (≤ 6 ay) ve kapsamlıdır; kullanıcı rızayı istediği an geri alır (grant silinir). WL11'in tek istisnasıdır. |
| `SPEC-WALLET-0001/WL14` | Her geçiş kartı gösterimi `presentation_log`'a yazılır (WL4 kapsamında, cihazda); Göster ekranı canlı saat ve süre gösterir. |
| `SPEC-WALLET-0001/WL15` | Site takma ad anahtarları belge sahibi anahtarı değildir: yalnız [[ADR-0031]] tohumundan site ve sıra başına türetilir, kalıcı saklanmaz; tohum yalnız cihazın güvenli deposunda durur, yedeğe, taşıma dosyasına ve hiçbir sunuma girmez. |
| `SPEC-WALLET-0001/W1` | Yazılım (güvenli bölge yok) | Desteklenmez (sandbox listesindeki ağın kendi deneme sahneleri için test anahtarı hariç — [[ADR-0042]] K5) |
| `SPEC-WALLET-0001/W2` | Cihaz güvenli bölgesi (Secure Enclave / StrongBox) | **ilk aşama asgarisi** |
| `SPEC-WALLET-0001/W3` | Sertifikalı WSCD | Devlet aşaması |


---

# Kodlanmamış Değişmez Listeleri

| Doküman | Konum | Değişmez sayısı | Not |
|---|---|---|---|
| `SPEC-ID-0001` | §7 Değişmezler | 5 | **Superseded, kodlanmadı.** Entity profili [[SPEC-ID-0002]] ile superseded; kod ataması yapılmaz. Atıf madde numarasıyla yapılır (ör. `SPEC-ID-0001` §7/2). |

---

# Kod Çakışmaları

Şu an **çakışma yok**. 287 kodlanmış değişmezin `DOC-ID/KOD` uzayında yinelenen giriş yoktur
(üretici aynı dokümanda aynı kodu iki kez kabul etmez). Prefix uzayı (doküman kapsamlı):
AP, AR, AS, C, CI, CMP, CT, D, DL, DS, DY, E, FD, HA, HV, IC, IDC, IDP, K, KC, LX, MD, NW, PN, PO, PR, PS, PV, RI, RPR, RV, S, SB, SG, SK, TI, TL, TS, W, WIA, WL, WRC, XC, YS, ZK.

---

# Durum

**Üretilen dosya** — 2026-10-09 (`scripts/sync-invariants.mjs`). Toplam 287 kodlanmış değişmez, 43 dokümanda.
