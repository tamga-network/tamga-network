---
document_id: ADR-0085
title: "Zincire sürekli projeksiyon"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Göç penceresi kapandıktan sonra imzalı listelerdeki her değişikliğin zincire nasıl yansıyacağını belirler. Yayıncı her liste
  yayınından ve çapa satırından sonra son yansıtılan liste ile şimdiki liste arasındaki farkı (kurum ekleme, durum değişikliği, yetki
  penceresi, iptal listesi sürümü, anahtar değişikliği, ağ düzeyi kayıt…) göçün kullandığı aynı eşlemeyle zincir işlemlerine çevirir
  ve yazar. Zincir tarihi blok anıdır; liste tarihi ile zincir tarihi arasındaki gecikme eşdeğerlikte farktan sayılmaz, iki saati
  aşarsa alarm üretir. Aynı koşudaki ara durumlar birleşir; ileri tarihli kayıt zamanı gelince yazılır. Ağ düzeyi kayıtlar Governance
  oyuyla akar. Zincire yazım düşerse liste yayını durmaz; fark sonraki koşuda yine denenir ve alarm üretilir. Yalnız bayrak açıkken,
  göçten sonra ve yalnız yerel ya da test zincirine yazılır; gerçek ağa yazma yolu yoktur. Kabul edildi (2026-11-15).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[ADR-0075]]", "[[ADR-0084]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Zincir listenin tanığıysa ([[ADR-0084]]) listede olan her değişiklik zincirde de görünmelidir. Bugün listenin geçmişi zincire yalnız
bir kez, göç sırasında aktarılabiliyor; sonrasında yeni bir kurum, bir askı ya da bir anahtar değişikliği zincire gitmiyordu. Bu karar
her yayından sonra çalışan bir eşitleme koşusu kurar: önceki liste ile yenisi karşılaştırılır, fark zincire yazılır. Zincir bu işte
geride kalabilir ya da yazamayabilir; bu durumda liste yine yayınlanır, eşitleme sonra yeniden denenir ve işletmeci uyarılır.

# Bağlam

- [[ADR-0074]] PJ1: listelerde güven kararını etkileyen her kayıt zincirde bir kayda eşlenir. [[ADR-0073]]: liste geçmişi
  zincire bir kez, en çok 30 gün açık kalan göç penceresinde, listedeki tarihlerle yazılır; pencere kapanınca tarih blok anıdır (CE1).
  [[ADR-0051]] K4: liste özetleri (`chain-submit`) her yayından sonra yazılır — ama bu iş bir zamanlayıcıya bağlı değildi.
- Zincir katmanı denetiminin (2026-11-15) bulgusu: pencere kapandıktan sonraki değişiklikleri zincire yazan bir araç yoktu. Bu
  yüzden zincirden okuyan güven kaynağı yerinde sayan bir zincirle "sağlıklı" görünmesin diye içerik düzeyine bağlandı ([[ADR-0074]]
  K5 notu). Aracın tasarımı dört soruya cevap istiyordu: tarih farkı, ağ düzeyi kayıtların oyla akışı, yazma kotası, ileri tarihli
  kayıtlar.
- **Proje yönetiminin yönü (2026-11-15):** zincir kodu ilerlesin ve yapı kurulsun ki zincire geçiş günü sıfırdan süreç gerekmesin;
  bugünkü AB modelinde zincirle ilgili süreç yürütülmez ([[ADR-0084]]). Bu karar o yönün uygulamasıdır: araç yazılır, kapalı durur.

# Karar

## K1 — Fark: göçün eşlemesiyle

Yayıncı her liste yayınından (yeni liste sürümü) ve her çapa satırından (saatlik satır, iptal listesi satırı) sonra bir eşitleme
koşusu yapar. Koşu, son yansıtılan noktadaki imzalı liste arşivinin planı ile şimdiki arşivin planını aynı plan motoruyla kurar
ve **şimdiki planda olup öncekinde olmayan işlemleri** yazar. Plan motoru göçün kullandığı motordur ([[ADR-0073]] K1,
`trust:chain-replay`): bir kaydın zincirdeki karşılığı göçte ve sürekli projeksiyonda farklı olamaz. Fark [[ADR-0074]] PJ1'in bütün
kayıtlarını kapsar: kök sertifika, kurum (kayıt, durum, sert iptal, geçerlilik uzatma, kayıt verisi, şema yetki pencereleri, halef),
şema ve sürüm özetleri, doğrulayıcı (kayıt, durum, sertifika, kapsam, kapı grubu, kayıt verisi, devir ve yeniden kayıt), tanıma,
iptal listesi kaydı ve sürümü, ağ düzeyi kayıtlar (cüzdan sağlayıcı ve anahtarları, ZK devresi, dış liste, belge kategorisi, liste
imzacısı, işletmeci, slot, katalog). Kişisel veri ve serbest metin zincire gitmez (PJ2); sandbox gerçek zincire yazılmaz (PJ4).

## K2 — Tarih: blok anı; gecikme farktan sayılmaz

- Göç penceresi dışında zincir tarihi blok anıdır ([[ADR-0073]] CE1): durum, kayıt ve yetki yazımları tarihsiz yapılır; listede
  geçmiş bir an yazılı olsa da zincir o anı yazmaz. Kontratın pencere dışında da geçmiş tarih kabul ettiği iki alan listedeki anla
  yazılır: sert iptal (`invalidatesFrom`, CE2) ve iptal listesinin yayın anı.
- Listedeki an ile zincirdeki yazım anı arasındaki aralık **projeksiyon gecikmesidir**. Sürekli eşdeğerlik testi bu aralıktaki anları
  (belgenin `iat`'ı, doğrulayıcının geçmiş andaki durumu) sormaz; aralığın dışındaki her soruda liste ile zincir aynı cevabı vermelidir.
  Henüz gelmemiş anlar da sorulmaz (belgenin `iat`'ı geçmiştir).
- Gecikme listeden yayına kadar değil, yayından zincire kadar ölçülür ve hedefi bir saattir (saatlik çapa kadansı). **İki saati aşan
  gecikme alarm üretir.** Zincir karar vermediği için ([[ADR-0084]] LS2) gecikme hiçbir belgenin doğrulamasını değiştirmez.

## K3 — Birleştirme ve bekleyen iş

- Aynı kayda aynı koşuda düşen ara durumlar (askı ve dönüş, aynı yetki penceresinin açılıp kapanması, kayıt verisinin iki sürümü,
  aynı iptal listesinin birden çok sürümü) aynı blok anında sıfır uzunlukta pencere olurdu; yalnız **son hâl** yazılır. Zincirde hiç
  olmayan ara durumun aralığı da gecikme aralığıdır (K2).
- İleri tarihli kayıt (ör. bir şema yetkisinin bitişi) bugün zincire yazılamaz (`DateInFuture`). Koşunun plan anı koşunun kendisidir;
  zamanı gelmemiş kayıt bu koşuda yazılmaz, zamanı geldikten sonraki ilk koşuda — yeni bir liste sürümü yayımlanmasa da, saatlik
  satırdan sonra — farkta çıkar ve yazılır. Ayrı bir kuyruk dosyası tutulmaz; bekleyen iş planın kendisinden türer.

## K4 — Ağ düzeyi kayıtlar Governance oyuyla

Ağ düzeyi kayıtlar ve ağ şemaları ([[ADR-0074]] PJ3) pencere dışında yalnız Governance oyuyla yazılır: koşu kaydı sahneye koyar ve
türü belli öneriyi açar; öneri öteki işletmecilerin oyuyla yürür ([[ADR-0055]]). Araç oyu atlamaz. Oy bekleyen kayıt raporlanır ve
koşuyu "eksik" sayar; ulusal kayıtların yazımını bekletmez. Doğrulayıcı devri ve iptal sonrası yeniden kayıt da aynı yoldan
([[ADR-0075]]).

## K5 — Düşen yazım listeyi durdurmaz; fark yeniden denenir

- Zincire yazım hatası (zincir erişilemez, işlem geri alındı, kota doldu, oy bekleniyor) liste yayınını durdurmaz ve yayın komutunun
  sonucunu değiştirmez ([[ADR-0084]] LS4); alarm üretir.
- Yalnız **tam** koşu (bütün fark yazıldı) projeksiyon noktasını ilerletir. Eksik koşudan sonra nokta yerinde kalır; aynı fark
  sonraki koşuda yine denenir. Yürütme kaldığı yerden sürer: her işlemden önce zincirdeki son hâle bakılır, zaten yazılmış olan
  atlanır; aynı fark iki kez yürütülse ikinci yürütme hiçbir şey yazmaz.
- Projeksiyon noktası (son yansıtılan liste sürümleri, çapa satırı, plan anı) yayıncının çıktı klasöründe bir durum dosyasında
  tutulur; zincire ayrıca yazılmaz (kontrat değişikliği yok). Zincirden okuyan güven kaynağının içerik düzeyi bu noktadan gelir.

## K6 — Yazım bütçesi ve kota

Bir koşu en çok belli sayıda işlem yazar (varsayılan 500); kalanı sonraki koşuya kalır ve koşu eksik sayılır. Birleştirme (K3)
bir iptal listesi için koşu başına en çok bir yayın yazdığından liste başına günlük yayın tavanı ([[ADR-0054]] NS3: 48) saatlik
kadansla aşılmaz. Kota yine dolarsa işlem geri alınır, koşu eksik sayılır, fark ertesi koşuda denenir (K5).

## K7 — Ne zaman çalışır, nereye yazar

- Yalnız `TAMGA_CHAIN_ENABLED=1` iken. Bayrak kapalıyken eşitleme ve yayından sonraki kanca hiçbir şey yapmaz: zincire bağlanmaz,
  dosya yazmaz, çıktı vermez ([[ADR-0051]] CH5).
- Başlangıç noktası göçtür: göç farksız biter ([[ADR-0073]] CE6) ve noktayı yazar; nokta yoksa eşitleme yazmaz. Göç penceresi açıkken
  ya da hiç açılmamışken eşitleme yazmaz (açık pencerede yazım göçündür).
- Aynı kanca eşitlemeden sonra liste özetlerini de gönderir (`chain-submit`, [[ADR-0051]] K4); ikisi birbirini beklemez, biri düşerse
  öteki yine denenir.
- Yazım yalnız yerel geliştirme zincirine ve test zincirine yapılır. **Gerçek ağa yazma yolu yoktur:** gerçek ağın anahtar yolu
  (donanım anahtar kasası) ve [[ADR-0084]] LS6 koşulları karara bağlanmadan araç gerçek ağda yalnız planı basar.

# Açık soruların kararları (2026-11-15)

1. **Tarih farkı:** zincir tarihi blok anı; gecikme aralığı eşdeğerlikte sorulmaz; hedef bir saat, alarm iki saat (K2).
2. **Ağ düzeyi kayıtlar:** Governance önerisiyle; araç öneriyi açar, oy işletmecilerindir; ulusal kayıtları bekletmez (K4).
3. **Kota:** koşu başına yazım bütçesi; iptal listesi başına koşu başına bir yayın; kota dolunca ertesi koşu (K6).
4. **İleri tarihli kayıtlar:** zamanı gelince ilk koşuda, ayrı kuyruk olmadan (K3).
5. **Projeksiyon düzeyinin yayımlanması:** zincire yeni alan yazılmaz; düzey durum dosyasında ve koşu raporunda (K5).
6. **Bağımsız yazıcı kipi** (ikinci işletmecinin listeyi kamuya açık adresten indirip kendisinin doğrulaması ve kendi oyunu vermesi):
   bu kararın dışında; ikinci işletmeciyle birlikte ayrı iş.

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **Fark = plan(şimdi) − plan(önce), göçün plan motoruyla** | **seçildi** | Tek eşleme; göç ve sürekli projeksiyon aynı kaydı aynı biçimde yazar; plan saf ve belirleyici, ağsız sınanır |
| Ayrı bir "değişiklik → işlem" eşlemesi yazmak | ret | İkinci eşleme göçle ayrışabilir; eşdeğerlik iki kez kanıtlanır |
| Listedeki tarihi zincire yazmak (pencere dışında da) | ret | [[ADR-0073]] CE1: delege anahtarı ele geçirilirse geçmiş sessizce yeniden yazılır; zincir karar vermediği için gecikme zararsızdır |
| Ara durumların hepsini yazmak | ret | Aynı blok anında sıfır uzunlukta pencereler; işlem ve kota israfı; listeyle farkı azaltmaz |
| Yazım düşünce liste yayınını durdurmak | ret | [[ADR-0084]] LS4: kaynak tanık yüzünden durmaz |
| Projeksiyon düzeyini zincire yazmak (yeni kontrat alanı) | ret (şimdilik) | Zincir karar vermediği için gerekmez; kontrat değişikliği ve yükseltme maliyeti |
| Ağ düzeyi kayıtları göç yürütücüsüyle pencere dışında da yazmak | ret | [[ADR-0074]] PJ3; tek anahtarın ağ kaydını yazması ikinci işletmeci kapısını boşa çıkarır |

# Değişmezler

| Kod | Kural |
|---|---|
| SP1 | Göç penceresi kapandıktan sonra her liste yayınından ve çapa satırından sonra son yansıtılan nokta ile şimdiki liste arasındaki fark, göçün plan motoruyla zincir işlemlerine çevrilir; fark listelerdeki bütün güven kayıtlarını kapsar, kişisel veri ve serbest metin içermez. |
| SP2 | Pencere dışında zincir tarihi blok anıdır (sert iptal ve iptal listesi yayın anı hariç); liste tarihi ile zincir tarihi arasındaki aralık eşdeğerlikte sorulmaz; yayından zincire gecikme iki saati aşarsa alarm üretir. |
| SP3 | Aynı kayda aynı koşuda düşen ara durumlardan yalnız son hâl yazılır; ileri tarihli kayıt zamanı geldikten sonraki ilk koşuda yazılır. |
| SP4 | Ağ düzeyi kayıtlar ve ağ şemaları pencere dışında yalnız Governance oyuyla yazılır; araç oyu atlamaz; oy bekleyen kayıt ulusal kayıtların yazımını bekletmez. |
| SP5 | Zincire yazım hatası liste yayınını durdurmaz ve yayın komutunun sonucunu değiştirmez; alarm üretir. Yalnız tam koşu projeksiyon noktasını ilerletir; eksik koşunun farkı sonraki koşuda yine denenir; yürütme zincirdeki son hâle bakarak kaldığı yerden sürer. |
| SP6 | Bir koşu yazım bütçesini aşmaz ve bir iptal listesi için en çok bir yayın yazar; kalan sonraki koşuya kalır. |
| SP7 | Sürekli projeksiyon yalnız `TAMGA_CHAIN_ENABLED=1` iken, göç farksız bittikten ve göç penceresi kapandıktan sonra çalışır; bayrak kapalıyken hiçbir şey yapmaz. Yazım yalnız yerel geliştirme ve test zincirine yapılır; gerçek ağa yazma yolu, gerçek ağın anahtar yolu ve [[ADR-0084]] LS6 koşulları karara bağlanmadan kurulmaz. |

# Sonuçlar

- `apps/trust-publisher`: saf planlayıcı (`planChainSync`), eşitleme komutu ve yayından sonraki kanca (build, heartbeat, anchor
  komutlarından sonra; bayrak kapalıyken etkisiz). Göç komutu farksız bitince başlangıç noktasını yazar.
- `apps/chain-indexer`: pencere dışı yürütücü (blok anı, son hâl denetimi, Governance yolu, bütçe); plan motoruna isteğe bağlı plan
  anı; eşdeğerlik testine gecikme aralıkları.
- Testler: planlayıcı ve kanca ağsız; sürekli eşdeğerlik yerel zincirde (göç → kurum ekleme, askı, iptal, birleştirme, anahtar
  değişimi, ileri tarihli iş; her adımda liste = zincir).
- Kontrat değişikliği yok. Üretimde zincir yine kapalı ([[ADR-0009]] K4, [[ADR-0084]] LS6).
- Komut ve durum dosyası adları proje yönetiminin onayını bekler (kodda öneri adıyla).

# Durum

**Accepted — 2026-11-15.** Proje yönetiminin onayıyla (2026-11-15; [[ADR-0084]] ile aynı kararın uygulaması). DECISIONS: D-BC-18.
SP1–SP7 bağlayıcıdır.
