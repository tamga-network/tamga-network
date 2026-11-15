---
document_id: ADR-0084
title: "Liste kaynak, zincir tanık"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Ağın güven kaynağının yönünü bütün zincir aşamaları için sabitler: imzalı güven listeleri ve çapa günlüğü tek ve asıl kaynaktır
  (AB güven listesi modeli); zincir tanıktır — listeyi kaydeder, isteyen doğrulayıcı onunla çapraz denetim yapar, ama hiçbir
  doğrulama kararı zincirden verilmez. Zincir durursa listeler, doğrulama ve cüzdanlar etkilenmez; zincir ile liste arasındaki her
  fark alarm üretir. ADR-0051'in "zincir aşamasında listeler zincirin projeksiyonu olarak yayınlanır" hükmü bu yönde değişir; ADR-0073'ün
  ayrı karara bıraktığı soru kapanır. Zincir kodu kapalı olarak tamamlanır; şimdilik sunucu ve doğrulayıcı düğüm kurulmaz; geçiş
  sırası önce test ağı, sonra gerçek ağdır. Kabul edildi (2026-11-15).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0015]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[ADR-0085]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[FW-ARF-0001]]", "[[ARCH-0002]]"]
---

# Kısaca

Tamga Network'te bir belgeye güvenilip güvenilmeyeceğine bugün imzalı güven listelerine bakılarak karar verilir; Avrupa Birliği'nin
güven listeleri de böyle çalışır. Bu karar o düzenin zincir geldikten sonra da değişmeyeceğini söyler: listeler tek ve asıl kaynak
kalır, zincir onların **tanığıdır**. Zincir listede ne yayımlandığını kaydeder; isteyen onunla listeyi karşılaştırır. Zincir durursa ya
da geride kalırsa hiçbir belgenin doğrulaması etkilenmez. Zincir kodu bitirilir ama kapalı durur; şimdilik sunucu kurulmaz; zincire
geçerken önce test ağı, sonra gerçek ağ gelir.

# Bağlam

- [[ADR-0009]] zinciri ikinci bağımsız işletmecinin yazılı kabulüne bağladı (K4); o güne kadar güven çapası imzalı listeler ve çapa
  günlüğüdür. [[ADR-0051]] zincir kodunu bugünden yazdırdı ve zinciri listelerin projeksiyonu yaptı (CH1: çelişkide liste geçerli,
  zincir cevabı doğrulama için gerekli değil). [[ADR-0074]] projeksiyonun kapsamını listelerdeki bütün güven kayıtlarına genişletti
  (PJ1: liste kaynak kalır). [[ADR-0073]] geçmişin zincire bir kez aktarılmasını ve eşdeğerlik testini kurdu.
- Belgelerde kaynak yönü üzerine açık bir çelişki vardı (zincir katmanı denetimi, 2026-11-15):
  - [[ADR-0051]] K6: "listeler zincir aşamasında da yayınlanır — **zincirin projeksiyonu olarak**" — yani zincir aşamasında yön tersine
    dönüyor, zincir kaynak oluyordu;
  - [[ADR-0074]] PJ1: "liste kaynak kalır";
  - [[ADR-0073]] K6: "zincir aşamasının zinciri kaynak yapıp yapmayacağı ayrı karardır".
  Hangisinin kaynak olacağı karara bağlanmadan doğrulayıcının zinciri nasıl kullanacağı, izleme ve geçiş planı kesinleşemiyordu.
- **Proje yönetiminin yönü (2026-11-15):** ağ bugün AB modeliyle ilerler ve bugünkü modelde zincirle ilgili bir süreç yürütülmez;
  zincir kodu da ilerler, yapı kurulur ki zincire geçiş günü sıfırdan bir süreç gerekmesin; doğrulayıcı düğüm açmak gibi işler şu an
  ek maliyettir ve yapılmaz; zincire geçerken önce test ağı, sonra gerçek ağ.

# Karar

## K1 — Kaynak ve tanık

İmzalı güven listeleri (LOTL, ulusal listeler, görünümleri) ve çapa günlüğü ağın **tek ve asıl** güven kaynağıdır. Zincir **tanıktır**:
listelerin her yayınını ve içerdiği güven kayıtlarını kaydeder ([[ADR-0074]] PJ1, [[ADR-0085]]), eşik kadar bağımsız işletmeci
aynı özeti yazınca liste sürümüne tanıklık eder ([[ADR-0051]] CH3). Bu yön bütün zincir aşamalarında geçerlidir: test ağında da,
gerçek ağda da, ikinci işletmeci geldikten sonra da. Zinciri kaynak yapmak (yönü tersine çevirmek) ancak yeni bir karar kaydıyla
olur ve o kayıt en az şunları gerektirir: üye devletlerin zinciri kendileri işletmesi, AB tarafının bu modeli tanıyabileceğinin
gösterilmesi ve listeden zincire geri dönüş yolu.

## K2 — Doğrulama kararı yalnız imzalı listeden

Doğrulama hattının (A–E) bütün güven adımları (C1, C2, C3, D5 ve kayıtlara bakan öteki adımlar) yalnız imzalı listeden okur.
Doğrulamada kullanılan `TrustSource` liste kaynağıdır. Zincirden okuyan güven kaynağı (`ChainTrustSource`) hiçbir doğrulama
kararında tüketilmez; görevi eşdeğerlik testi ve çapraz denetimdir. [[ADR-0074]] K5'teki "sürekli projeksiyon gelene kadar
doğrulamada kullanılmaz" sınırı bu kararla kalıcı olur: sürekli projeksiyon geldikten sonra da zincir karar vermez.

## K3 — Zincir okuması yalnız çapraz denetim ve şeffaflık

Doğrulayıcı (ya da herhangi bir üçüncü taraf) isterse zinciri okur ve elindeki listeyle karşılaştırır (`trust:chain-check`, sağlık
sayfasındaki zincir alanı, ileride isteğe bağlı ikinci kaynak). Bu okuma doğrulama sonucunu **hiçbir yönde** değiştirmez: `UNKNOWN`
sonucu kötüleştirmez, `YES` iyileştirmez, `NO` reddettirmez ([[ADR-0051]] K1.2). Zincir okuması doğrulama için hiçbir zaman gerekli
değildir ve olmayacaktır.

## K4 — Zincir durursa liste etkilenmez

Zincirin durması, erişilememesi, geride kalması ya da zincire yazımın düşmesi liste yayınını, iptal listelerini, doğrulamayı ve
cüzdanları etkilemez. Liste yayıncısı zincire yazım hatası yüzünden yayını durdurmaz; zincir işleri yayından **sonra** ve yayından
bağımsız çalışır ([[ADR-0085]] SP5). Zincir bayrağı (`TAMGA_CHAIN_ENABLED`) kapatıldığında sistem bugünkü hâline döner; geri dönüş
yalnız bayraktır.

## K5 — Fark alarm üretir

Zincir ile liste arasındaki her fark alarm üretir ve şeffaflık raporuna girer: zincirde aynı liste sürümü için onaylı farklı özet
(`CONFLICT` / `NO`, çift konuşma işareti), bekleyen rakip aday (`CONTEST`), projeksiyonun listenin gerisinde kalması ya da
yazamaması, eşdeğerlik testinde fark. Düzeltme yönü her zaman listeden zincire doğrudur: zincir kaydı silinmez, listeye uyan yeni
yazımla düzeltilir; liste zincire göre düzeltilmez.

## K6 — Kod kapalı tamamlanır; geçiş önce test ağı, sonra gerçek ağ

- Zincir kodu (sözleşmeler, yayıncının zincir işleri, indeksleyici, eşdeğerlik testleri, işletmeci araçları) **kapalı** olarak
  tamamlanır: üretimde bayrak kapalıdır, canlı sunucuda zincir ayarı yoktur, paketler zincir istemcisi taşımaz ([[ADR-0015]] K1).
- **Şimdilik sunucu, doğrulayıcı düğüm ya da test zinciri sunucusu kurulmaz.** Kod yerel geliştirme zincirinde ve sürekli
  entegrasyondaki çok düğümlü test ağında sınanır.
- Geçiş sırası: (1) kapalı kod; (2) **test ağı** — gerçek listeler bir test zincirine yansıtılır ve eşdeğerlik bir süre farksız
  izlenir; (3) **gerçek ağ**. Gerçek ağ şu koşullar birlikte sağlanmadan açılmaz: ikinci bağımsız işletmecinin yazılı kabulü
  ([[ADR-0009]] K4), liste çapasında eşik ≥ 2 ([[ADR-0051]] CH3), test ağında eşdeğerlik farksız işletim, üretim anahtar yolu
  (donanım anahtar kasası) için karar kaydı, yönetişim ve uzlaşma anahtarlarının ayrılması için karar kaydı ve bağımsız güvenlik
  denetimi.

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **Liste kaynak, zincir tanık (bütün aşamalarda)** | **seçildi** | AB güven listesi modeliyle aynı; zincir yokken de, varken de aynı doğrulama; geri dönüş yalnız bayrak; tek işletmeci döneminde zincirin üretemeyeceği güveni varmış gibi göstermez |
| Zincir aşamasında zincir kaynak, liste zincirin görünümü ([[ADR-0051]] K6'nın eski hükmü) | ret (şimdilik) | Bir işletmeci düştüğünde ya da zincir durduğunda doğrulama etkilenir; AB modelinden ayrılır; geri dönüş için ters yönde aktarım gerekir. Devletler zinciri işletince yeniden değerlendirilebilir (K1 son cümle) |
| İki kaynak: liste ve zincir birlikte, ikisi de "evet" derse kabul | ret | Her iki kaynağın arızası da reddettirir (en zayıf halka); sonuç zincirin erişilebilirliğine bağlanır (K4'e aykırı) |
| Zinciri hiç kullanmamak | ret | Çift konuşmaya karşı bağımsız tanıklık ve kayıt düzeyinde şeffaflık kaybolur; proje yönetiminin "zincir kodu ilerlesin" yönüne aykırı |
| Test ağını atlayıp doğrudan gerçek ağ | ret | Göç penceresi bir kez açılır ([[ADR-0073]] CE1); gerçek listelerle önceden prova yapılmadan açılması geri dönüşü olmayan hata riski taşır |

# Değişmezler

| Kod | Kural |
|---|---|
| LS1 | İmzalı güven listeleri ve çapa günlüğü ağın tek ve asıl güven kaynağıdır; zincir tanıktır. Bu yön bütün zincir aşamalarında geçerlidir; zinciri kaynak yapmak yeni bir karar kaydı ister. |
| LS2 | Doğrulama kararı (C1, C2, C3, D5 ve kayıtlara bakan öteki adımlar) yalnız imzalı listeden verilir; zincirden okuyan güven kaynağı hiçbir doğrulama kararında tüketilmez. |
| LS3 | Zincir okuması yalnız çapraz denetim ve şeffaflık içindir; doğrulama sonucunu hiçbir yönde değiştirmez ve doğrulama için hiçbir zaman gerekli değildir. |
| LS4 | Zincirin durması, erişilememesi, geride kalması ya da zincire yazımın düşmesi liste yayınını, iptal listelerini, doğrulamayı ve cüzdanları etkilemez; zincir işleri yayından sonra ve yayından bağımsız çalışır. |
| LS5 | Zincir ile liste arasındaki her fark alarm üretir ve şeffaflık raporuna girer; düzeltme listeden zincire doğrudur, zincir kaydı silinmez. |
| LS6 | Zincire geçiş sırası test ağı, sonra gerçek ağdır; gerçek ağ ikinci bağımsız işletmecinin yazılı kabulü, eşik ≥ 2, test ağında farksız eşdeğerlik, üretim anahtar yolu ve anahtar ayrımı kararları ve bağımsız güvenlik denetimi olmadan açılmaz. |

# Sonuçlar

- [[ADR-0051]] K6'nın son maddesindeki "listeler zincir aşamasında da yayınlanır — zincirin projeksiyonu olarak" hükmü değişti:
  zincir aşamasında da liste kaynak, zincir projeksiyon (tanık) kalır. [[ADR-0073]] K6'nın son cümlesindeki ayrı karar budur.
  [[ADR-0074]] K5'in geçici sınırı kalıcı oldu. Üç kayda atıf notu düşüldü.
- Sürekli projeksiyonun tasarımı: [[ADR-0085]].
- [[FW-ARF-0001]] §8.1: defter aşamasının güven çapası imzalı listelerdir, defter tanıktır. [[ARCH-0002]]: kurulum adımları
  bu yöne ve [[ADR-0009]] K4'e göre güncellendi.
- Kod değişikliği gerekmedi: doğrulayıcı zaten yalnız listeden okuyor; zincir sağlık alanı sonucu değiştirmiyor.
- Kalan işler (sıralı): yönetişim komut aracı, üretim anahtar yolu, zincir izleme ve alarmın canlı izlemeye bağlanması, gerçek ağ
  kurulum betiği, anahtar ayrımı kararı, [[ADR-0079]] kodu.

# Durum

**Accepted — 2026-11-15.** Proje yönetiminin onayıyla (2026-11-15). DECISIONS: D-BC-17. LS1–LS6 bağlayıcıdır.
