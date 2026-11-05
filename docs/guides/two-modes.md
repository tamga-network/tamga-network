---
document_id: GUIDE-0016
title: "İki hâl: imzalı listeler ve ortak defter"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Tamga Network'ün iki hâlini birlikte anlatan genel bakış: bugün çalışan zincirsiz hâl (AB modelindeki gibi imzalı güven
  listeleri: LOTL → ulusal listeler → kurumlar, çevrimdışı doğrulama) ve ileride açılacak zincirli hâl (Hyperledger Besu, QBFT).
  Zincirin ne eklediği, iki hâlin nasıl senkron kaldığı (çapa günlüğü, liste çapası, yeniden oynatma, eşdeğerlik testi), kaynağın
  hangisi olduğu, kurum ve devlet için neyin değiştiği, hangi rehberin kime olduğu ve terimler sözlüğü.
---

# İki hâl: imzalı listeler ve ortak defter

Tamga Network iki hâlde çalışacak biçimde tasarlandı. **Zincirsiz hâl** bugün canlıdır: güven, AB'nin dijital kimlik
cüzdanındaki gibi imzalı [[t:trust-list|güven listelerinde]] durur. **Zincirli hâl**, bu listelerin yanına devletlerin birlikte
işlettiği izinli bir [[t:ledger|ortak defter]] (Hyperledger Besu) ekler. İki hâl aynı kimlikleri, aynı kuralları ve aynı
soruları kullanır; biri ötekinin yerine geçmez, ikisi senkron ilerler.

Bu sayfa iki hâli yan yana anlatır ve sizi doğru kurulum rehberine yönlendirir.

**Ne zaman okunur:**
- Kurumunuz, şirketiniz ya da devletiniz Tamga'ya katılmayı düşünüyorsa, hangi parçayı kuracağınıza karar vermeden önce.
- "Zincir gelince bizim için ne değişir?" sorusunun kısa cevabı için.
- Önce (isteğe bağlı): [Güven listeleri](/concepts/trust-lists) ve [Ortak defter (zincir)](/concepts/ledger).

Bu belgede adı ya da kodu geçen devletler için yer ayrılmıştır; bu, bir anlaşma ya da görüşme bildirimi değildir.

## Kısaca

| | Zincirsiz hâl (bugün) | Zincirli hâl (ileride) |
|---|---|---|
| Güvenin dayanağı | İmzalı listeler: [[t:LOTL]] → ulusal listeler → kurumlar | Aynı imzalı listeler + ortak defterde onların izdüşümü |
| Kim imzalar | Liste işletmecisi (bugün geçici olarak Tamga Network) | Liste işletmecisi; ayrıca bağımsız işletmeciler listenin özetine tanıklık eder |
| Doğrulama | Çevrimdışı: önceden indirilen liste ve iptal listeleriyle | Aynı; zincir denetimi isteğe bağlı bir ek |
| Kaynak | Liste | Yine liste; çelişkide liste geçerlidir |
| Durum | Gerçek ağda canlı | Kod yazıldı ve sınandı; üretimde kapalı |

## Zincirsiz hâl: imzalı listeler

Bu hâl, AB'nin güven listesi modelinin (ETSI TS 119 612 ve TS 119 602) aynısıdır.

```text
Tamga LOTL  (kök anahtarı herkes bir kez sabitler)
├── tl-tr.jws          Türkiye listesi (bugün Tamga Network vekâleten işletir)
│   ├── ulusal kök sertifika(lar)
│   ├── belge verenler        + hangi belge türlerini verebilecekleri
│   └── doğrulayıcılar        + hangi alanları isteyebilecekleri
├── tl-<cc>.jws        öteki ülkelerin listeleri (yer ayrılmış)
└── cüzdan sağlayıcılar, belge türü kataloğu, dış listeler
```

1. **LOTL** (listelerin listesi) her ülke listesinin adresini, imzacısını ve neye kefil olabileceğini söyler.
2. **Ulusal liste** o ülkenin kök sertifikalarını, [[t:issuer|belge verenlerini]] ve [[t:verifier|doğrulayıcılarını]] taşır.
3. **Kurum** (üniversite, hastane, bilet satıcısı) listedeki sertifikasıyla belge imzalar.

Cüzdan ve doğrulayıcı listeleri ve iptal listelerini **önceden** indirir. Bir belge geldiğinde kuruma ya da Tamga'ya sormaz:
imzayı, kurumun listedeki kaydını ve iptal durumunu kendi elindeki kopyayla denetler. Liste `next_update` tarihine kadar geçerlidir;
bu tarih geçerse ya da liste indirilemezse sonuç `INDETERMINATE` (şu an doğrulanamadı) olur, asla yanlış bir "kabul" ya da "ret"
olmaz.

Her liste sürümü bir öncekinin özetini taşır; satır silinmez, yalnız durum değişir. Liste işletmecisi ayrıca saatlik imzalı bir
[[t:anchor-log|çapa günlüğü]] yayınlar: iptal listesi yayınlarının ve belge türlerinin özetleri buraya sırayla yazılır.

**Zayıf yanı:** listeyi tek bir işletmeci imzalar. Herkese açık günlük ve denetimler, işletmecinin iki doğrulayıcıya iki farklı
liste göstermesini (çift konuşma) caydırır, ama imkânsız kılmaz.

## Zincirli hâl: ortak defter

Ortak defter, devletlerin ve bağımsız işletmecilerin birlikte işlettiği izinli bir blok zinciridir: Hyperledger Besu, QBFT
uzlaşması. İki şey ekler ([[ADR-0051]], [[ADR-0053]], [[ADR-0055]]):

- **Bağımsız tanıklık.** Bir liste sürümünün özeti ancak eşik kadar bağımsız işletmeci aynı özeti gönderince "onaylı" olur. Tek
  işletmeci onaylı bir özet üretemez; iki farklı özet zincirde çelişki olayı olarak herkesin önünde görünür.
- **Kodda yönetişim.** Üyelik, ortak belge türleri ve yükseltmeler devletlerin 2/3 oyuyla; yükseltmede 7 gün bekleme.

Zincire **yalnız özetler ve kapalı küme değerleri** yazılır: liste sürümünün özeti, kayıtların özetleri, parmak izleri, tarihler,
durumlar. Kişisel veri, belge, belge özeti, iptal biti ve serbest metin zincire hiç girmez; iptal listeleri zincir dışında kalır
([[ADR-0008]], [[ADR-0074]]).

**Ne zaman açılır?** En az iki bağımsız işletmeci validator işletmeyi yazılı olarak kabul edince ve tasarım bağımsız güvenlik
denetiminden geçince ([[ADR-0009]] K4). Tek işletmecinin zinciri, tek işletmecinin imzaladığı listeden fazla güven üretmez.

## İki hâl nasıl senkron kalır?

İki hâlin aynı şeyi söylemesi dört mekanizmaya dayanır.

```text
kayıt defteri ──trust:build──▶ imzalı listeler (lotl, tl-<cc>) ──▶ herkese açık yayın
                                   │
                                   ├──▶ çapa günlüğü (saatlik imzalı satır, özetler)
                                   │
                                   └──trust:chain-submit──▶ liste çapası kaydı (zincir; yalnız özet)
                                                            eşik kadar bağımsız işletmeci aynı özeti gönderince "onaylı"
```

### 1. Tek kaynak: liste

Bütün değişiklikler önce imzalı listeye girer. Zincir listenin **izdüşümüdür** (projeksiyon), kaynağı değildir: çelişkide liste
geçerlidir ve zincirin cevabı doğrulama için hiçbir zaman gerekli değildir ([[ADR-0051]] CH1). Zincir açıldıktan ve geçiş
tamamlandıktan sonra da bu kural sürer; zinciri bir gün kaynak yapmak ayrı bir karar gerektirir ([[ADR-0073]] K6).

### 2. Aynı kimlikler

Kimlikler baştan zincir formülüyle hesaplanır; böylece listede ve zincirde aynıdır ([[ADR-0009]], [[ADR-0073]] K4):

| Kimlik | Formül |
|---|---|
| Kurum (`issuer_id`) | `keccak256(ülke kodu, sha256(sertifika))` |
| Belge türü (`schema_id`) | `keccak256(vct)` |
| Doğrulayıcı (`rpId`) | `keccak256(dns_name)` |

Zincir açıldığında hiçbir kurumun kimliği değişmez, hiçbir belge yeniden verilmez.

### 3. Her yayında çapa

Liste yayıncısı her yeni liste sürümünün özetini (sürüm, içerik özeti, önceki özet, yayın zamanı) ve çapa günlüğünün son
satırının özetini zincirdeki liste çapası kaydına yazar (`trust:chain-submit`). Aynı sürüm için aynı özet ikinci kez yazılmaz;
onaylı bir sürüm için farklı bir özet gelirse yazılmaz ve işletmeciye çelişki bildirilir. Listedeki her güven kaydının (kurum,
doğrulayıcı, belge türü, cüzdan sağlayıcı, kapı grubu…) zincirde bir karşılığı vardır; yalnız özet ve kapalı küme değeri olarak
([[ADR-0074]]).

Doğrulayıcı tarafında `trust:chain-check` bir listenin özetinin zincirde onaylı olup olmadığını sorar: **evet**, **hayır**
(farklı özet: çift konuşma işareti, alarm) ya da **bilinmiyor** (zincir kapalı, erişilemez ya da eşik dolmadı). Bu denetim
doğrulama sonucunu kötüleştirmez.

### 4. Geçişte yeniden oynatma ve eşdeğerlik testi

Zincir açıldığında listelerin bütün geçmişi kontratlara **bir kez** yeniden oynatılır (`trust:chain-replay`), listedeki
tarihlerle ([[ADR-0073]]):

- Devletler 2/3 oyla bir **göç penceresi** açar. Öneri, herkese açık arşivden üretilen oynatma planının özetini taşır; herkes
  planı yeniden üretip karşılaştırabilir.
- Pencere en çok 30 gün açık kalır ve kapandıktan sonra bir daha açılamaz.
- Oynatma sonunda **eşdeğerlik testi** çalışır: aynı sorular hem listeye hem zincire sorulur. Sorular şunlardır: bu kurum o
  tarihte geçerli miydi, bu belge türünü o tarihte verebilir miydi, bu ülke o kurumu tanıyor mu, bu liste sürümünün özeti ne?
  Her kayıtlı an ve her sınır anı (bir saniye önce, tam o an, bir saniye sonra) sorulur.
- **Kabul ve ret cevaplarında tek bir fark bile varsa göç kapanmaz.**

Sandbox (test ağı) zincire yazılmaz ve yeniden oynatılmaz ([[ADR-0074]] K7).

## Kim için ne değişir?

| Kim | Zincirsiz hâl (bugün) | Zincir açılınca |
|---|---|---|
| **Belge veren kurum** | Listeye kayıt, kurum sertifikası, belge verme | **Hiçbir şey.** Aynı kimlik, aynı sertifika, aynı servis; verilmiş belgeler geçerli kalır |
| **Doğrulayıcı** | Güven verisini `TrustSource` ile listeden okur, kökü sabitler | **Zorunlu bir şey yok.** İsterseniz zincir denetimi eklenir; sonuç kötüleşmez |
| **Cüzdan** | Listeyi ve iptal listelerini önceden indirir | **Hiçbir şey** |
| **Devlet** | Kendi ulusal listesini işletir ya da Tamga'nın vekâleten işlettiği listeyi devralır | Listeyi işletmeyi **sürdürür** (kaynak liste kalır). Ek olarak bir validator düğümü işletir, kendi ulusal kayıtlarının zincirdeki karşılığını kendi anahtarlarıyla yazar, yönetişimde oy kullanır |
| **Ağ işletmecisi** | LOTL'u imzalar, çapa günlüğünü ve listeleri yayınlar | Ek olarak liste özetlerini zincire yazar, ağ düzeyi kayıtları yönetişim önerisiyle yazar |

Kısacası: **kurum, doğrulayıcı ve cüzdan için iki hâl aynıdır.** Değişen, devletin ve işletmecilerin işidir: ulusal liste
bugün de işletilir; zincir açılınca yanına bir düğüm eklenir.

## Hangi rehber kime?

| Ne yapıyorsunuz? | Zincirsiz hâl (bugün) | Zincirli hâl |
|---|---|---|
| Sitenize "Tamga ile giriş yap" eklemek | [[GUIDE-0001]] | aynı |
| Kendi sunucunuzda belge doğrulamak | [[GUIDE-0002]] | aynı; zincir denetimi isteğe bağlı ([[GUIDE-0006]] §5) |
| Kurumunuzu ağa kaydettirmek (bilgi işlem adımları dahil) | [[GUIDE-0007]], [[GUIDE-0014]] | aynı |
| Barındırılan servisle belge vermek | [[GUIDE-0003]] | aynı |
| Kendi belge verme sunucunuzu kurmak | [[GUIDE-0003]] § Derinlik: kendi servisiniz, çalışan kod [[GUIDE-0004]], protokol [[SPEC-PROTO-0001]]; kayıt ve anahtar yönetimi ağ işletmecisiyle konuşulur | aynı |
| Doğrulayıcı olarak kaydolmak | [[GUIDE-0008]], [[GUIDE-0014]] | aynı |
| Güven listelerini okumak, kendi kopyanızı tutmak | [[GUIDE-0006]] | [[GUIDE-0006]] §5 |
| Ülkenizin listesini ağa bağlamak (LOTL kaydı) | [[GUIDE-0011]] | aynı; liste kaynak kalır |
| Ulusal güven listesini işletmek (kurulum) | [[GUIDE-0017]] | [[GUIDE-0017]] § Zincir açıkken |
| Düğüm ya da validator işletmek | — | [[GUIDE-0015]] (el kitabı; düğüm anahtarı, bildirim ve denetim: `tamga-onboard node`); test ağı kurulumu: [[GUIDE-0018]] |
| Uçtan uca denemek | [[GUIDE-0013]] (sandbox) | sandbox zincire yazılmaz; yerel geliştirme zinciri: [[GUIDE-0015]] § Yerel deneme |

## Terimler

| Terim | Ne demek |
|---|---|
| [[t:LOTL]] (List of Trusted Lists) | Listelerin listesi: her ülke listesinin adresini, imzacısını ve kapsamını taşır. Tamga'da `lotl.jws` |
| [[t:trust-list]] (trust list) | Bir ülkenin kök sertifikalarını, belge verenlerini ve doğrulayıcılarını taşıyan imzalı liste. Tamga'da `tl-<cc>.jws` |
| [[t:issuer]] (issuer) | Kişiye dijital belge veren kurum: üniversite, hastane, bilet satıcısı |
| [[t:verifier]] (verifier) | Belgeyi kişiden isteyen ve denetleyen taraf: işveren, web sitesi, etkinlik kapısı |
| Cüzdan birimi ([[t:wallet-unit]]) | Bir kişinin cihazındaki tek cüzdan kurulumu; cüzdan sağlayıcısı ona kanıt verir |
| [[t:anchor-log]] (anchor log) | Liste işletmecisinin saatlik imzaladığı, yalnız özet taşıyan, ekleme yapılabilen herkese açık günlük |
| Çapa (anchor) | Bir verinin özetinin değiştirilemez bir kayda yazılması; verinin sonradan değişmediği bu özetle gösterilir |
| [[t:ledger]] (ledger) | Birden çok bağımsız işletmecinin birlikte tuttuğu kayıt; Tamga'da izinli bir Besu zinciri |
| Düğüm (node) | Ortak defterin bir kopyasını çalıştıran sunucu. Tam düğüm zinciri doğrular ve okur, imzalamaz |
| [[t:validator]] | Blok öneren ve imzalayan düğüm; Tamga'da her üye devletin bir validator'ı olur |
| enode | Bir Besu düğümünün ağ adresi: düğümün açık anahtarı + IP adresi + port (`enode://<açık anahtar>@<ip>:30303`) |
| QBFT | Besu'nun uzlaşma yöntemi: validator'lar her bloğu oylar; n validator'da en çok ⌊(n−1)/3⌋ arızaya dayanır |
| Genesis | Zincirin ilk bloğu ve başlangıç ayarları (zincir kimliği, ilk validator'lar); bütün düğümlerde aynı olmalıdır |
| Bootnode | Yeni bir düğümün ağa ilk bağlandığı, eşlerin adresini öğrendiği düğüm |
| İzinli ağ (permissioned) | Yalnız izin listesindeki düğümlerin bağlanabildiği, yalnız izinli hesapların işlem gönderebildiği ağ |
| Yönetişim (governance) | Ağ kararlarının (üyelik, ortak belge türleri, yükseltme, göç penceresi) nasıl alındığı; zincirde devletlerin 2/3 oyuyla |
| Projeksiyon (izdüşüm) | Zincirdeki kayıtların imzalı listelerden türetilmesi; kaynak liste kalır |
| Eşdeğerlik testi | Aynı soruların listeye ve zincire sorulup cevapların karşılaştırılması; fark varsa geçiş tamamlanmaz |

## Kurallar

| Kod | Ne der |
|---|---|
| [[ADR-0009]] K4 | Ortak defter en az iki bağımsız işletmecinin yazılı kabulü olmadan kurulmaz |
| [[ADR-0051]] CH1 | Zincir listenin projeksiyonudur; çelişkide liste geçerlidir; zincir cevabı doğrulama için gerekmez |
| [[ADR-0051]] CH2 | Liste çapasına yalnız özet yazılır; içerik, belge ya da kişisel veri yazılmaz |
| [[ADR-0051]] CH3 | Çapa ancak eşik kadar bağımsız yazıcı aynı veriyi gönderince onaylıdır; üretimde eşik en az 2 |
| [[ADR-0073]] CE6 | Göç, eşdeğerlik testinde kabul/ret farkı kalmadan kapanmaz |
| [[ADR-0074]] PJ4 | Sandbox listeleri üretim zincirine yazılmaz |

Liste işletmecisi ve ortak defter kuralları: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/tr/rulebook).
