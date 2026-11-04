---
document_id: ADR-0073
title: "Zincir–liste eşdeğerliğinin uygulanabilirliği: göç kipi, sert iptal, şema sürümleri, doğrulayıcı kimliği, durum eşlemesi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  ADR-0009 K7, imzalı listelerden zincire geçişi liste geçmişinin kontratlara yeniden oynatılmasına ve eşdeğerlik testine bağlar.
  Bugünkü kontratlarla bu geçmiş birebir oynatılamaz: tarihler blok zamanından gelir, sert iptal yoktur, şemanın tek içerik özeti
  vardır, doğrulayıcı kimliği sertifikaya bağlıdır ve askıdan dönemez, durum kümeleri ve sınırları farklıdır, günlük kotalar toplu
  yazımı durdurur. Karar: her kayıt kontratında Governance'ın bir kez açtığı, kapanınca bir daha açılamayan tek seferlik göç kipi
  (geçmiş tarih yalnız blok zamanına kadar, kota yok); `invalidatesFrom` ile sert iptal; şema sürüm özetleri yalnız eklenebilir
  dizi; `rpId = keccak256(dns_name)`, sertifika güncelleme, askıdan dönüş ve ince kapsamlar (özetlerle); durum eşleme tablosu ve
  belgenin `iat` anındaki duruma göre yarı açık aralıklarla değerlendirme. Yeniden oynatma komutu `trust:chain-replay`. Kabul
  edildi (2026-11-04): askıdaki kurumun askıdan önceki belgeleri geçerli, göç penceresi en çok 30 gün.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0010]]", "[[ADR-0015]]", "[[ADR-0029]]", "[[ADR-0034]]", "[[ADR-0046]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0063]]", "[[ADR-0074]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Zincir açıldığında listelerin bugüne kadarki bütün geçmişi kontratlara bir kez aktarılacak ve zincir, listeyle her soruda aynı
cevabı verdiği kanıtlanmadan devreye girmeyecek ([[ADR-0009]] K7). Bugünkü kontratlar bu aktarımı yapamıyor: geçmiş tarihi
yazamıyor, "ele geçirildi, şu tarihten sonrasını sayma" diyemiyor, bir şemanın birden çok sürümünü tanımıyor, doğrulayıcıyı
sertifikası yenilenince başka biri sanıyor ve durumları listeden farklı sayıyor. Bu öneri kontratlara bu yetenekleri ekler ve
geçmişin yalnız bir kez, denetimli bir pencerede yazılmasına izin verir.

# Bağlam

- [[ADR-0009]] K7: geçiş, liste sürüm arşivinin kontrat çağrılarına yeniden oynatılması ve eşdeğerlik testidir; kaydedilmiş her
  `(issuer_id, schema_id, iat, list_id, version)` sorgusunda `TrustSource(list)` ile `TrustSource(chain)` aynı C1/C2/C3/D5 cevabını
  vermelidir; ACCEPTED/REJECTED farkı geçişin tamamlanmadığı anlamına gelir ([[SPEC-TRUST-0001]]/TL10).
- [[ADR-0051]] zinciri imzalı listelerin projeksiyonu yaptı ve bugün yalnız liste özetlerini çapalar; kayıt kontratlarına yazım
  Faz 0 yeniden oynatmasına bırakıldı. Projeksiyonun kapsamı [[ADR-0074]]'te.
- 2026-11-04'te kontratlar, liste biçimi ve `TrustSource` karşılaştırıldı. Yeniden oynatmayı ya da eşdeğerliği engelleyen farklar:

| Fark | Liste bugün | Kontrat bugün | Sonuç |
|---|---|---|---|
| F1 Tarihler | `status_history[].since`, `valid_from`, şema yetkisi `valid_from`/`valid_until`, `registered_at` imzalı listede | `revokedAt`, yetki penceresi `since`/`until`, `registeredAt` = `block.timestamp` | Geçmiş, oynatıldığı günün tarihini alır; eski belgeler C1/C2'de reddedilir |
| F2 Sert iptal | `REVOKED` + `invalidates_from`: o andan sonra verilmiş belgeler düşer | Yalnız yumuşak iptal (`revokedAt`) | Ele geçirilmiş kurumun sonraki belgeleri zincirde kabul edilir |
| F3 Şema sürümleri | `content_hash` + `content_hashes` ([[ADR-0010]] K4) | Tek `contentHash`, bir daha yazılmaz (SC1) | Eski sürümle verilmiş belgeler zincirde bütünlük denetiminden geçmez |
| F4 Doğrulayıcı | Kalıcı kimlik `dns_name` ([[ADR-0034]] CI3/CI4); sertifika yenilenir; askıdan dönülür; kapsam = tür, öğe yolları, biçim, ad alanı, hizmet kimliği, geçerlilik | `rpId = keccak256(ülke ‖ sertifika özeti)`, sertifika değişmez, askıdan dönüş yok, kapsam kaba `bytes32` | Sertifika yenilemesi yeni doğrulayıcı yaratır; ince kapsam ve aşırı istek denetimi zincirde yapılamaz |
| F5 Durumlar | 8 değer (`ACTIVE`, `SUSPENDED`, `REVOKED`, `RETIRED`, `ROLLING_OVER`, `RESERVED`, `PROVISIONAL`, `DEPRECATED`); C1/C2 belgenin `iat` anındaki duruma bakar; değişiklik `since` anından itibaren geçerlidir | 4–5 değerli enum'lar; C1 bugünkü duruma bakar (askıdaki kurumun bütün belgeleri ret, emekli kökün sonraki belgeleri kabul); sınırlar kapalı aralık (`iat <= revokedAt`, `iat <= until`) | Aynı soruya farklı cevap; sınır anında bir saniyelik fark |
| F10 Kotalar | — | Devlet başına günlük yazma, liste başına günde 48 yayın, kurum başına günde 8 liste kaydı ([[ADR-0054]]/NS3) | Aylarca biriken geçmiş günler, haftalar sürer ya da hiç bitmez |

  Sandbox'ın gece sıfırlanan çapa günlüğü (F9) ve listelerde olup zincirde hiç karşılığı olmayan kayıtlar (F6–F8) [[ADR-0074]]'te.
- **Proje yönetiminin yönü (2026-11-04):** zincir kapsamı "her şey zincirde"; geçmiş aktarımı için tek seferlik göç kipi, sert
  iptal, yalnız eklenebilir şema sürüm özetleri ve kalıcı doğrulayıcı kimliği önerilsin. Yeniden oynatma komutunun adı onaylandı:
  `trust:chain-replay`.

# Karar

## K1 — Tek seferlik göç kipi (F1, F10)

- Her kayıt kontratı (`RootCARegistry`, `IssuerRegistry`, `SchemaRegistry`, `RelyingPartyRegistry`, `StatusListRegistry`,
  `CrossRecognition` ve [[ADR-0074]]'ün ağ düzeyi kaydı) üç aşamalı bir göç durumu taşır: **başlamadı → açık → kapandı**. Geçişler
  yalnız ileri gider; "kapandı"dan geri dönüş yoktur ve hiçbir yükseltme bu durumu sıfırlayamaz ([[ADR-0055]] GE2: yükseltme yalnız
  parametresiz başlangıç seçicisi çağırır).
- Kipi **Governance** türü belli bir öneriyle (2/3, [[ADR-0055]]) **bir kez** açar. Öneri, yeniden oynatma planının özetini
  (`replayPlanHash` = herkese açık arşivden deterministik üretilen planın SHA-256'sı) taşır; herkes planı arşivden yeniden üretip
  zincirdeki olaylarla karşılaştırabilir. Kapanış da Governance önerisiyle olur ve K6'daki eşdeğerlik raporuna dayanır.
- **Pencere en çok 30 gündür** (açılış anından sayılır). Governance yalnız kip açıkken ve bu tavanı aşmadan uzatabilir. Süre dolunca
  kip kendiliğinden **kapanmış** sayılır; bu kapanış da kesindir.
- Kip açıkken tarih taşıyan yazımlar tarihi **açıkça** alır (durum değişikliği anı, yetki penceresi, geçerlilik başlangıcı, kayıt
  anı, iptal listesi yayın anı). Kurallar: hiçbir tarih `block.timestamp`'ten ileri olamaz; bir kaydın geçmişi zaman sırasıyla
  yazılır (öncekinden geri tarih reddedilir); yazılmış geçmiş değiştirilmez.
- Kim yazar: ulusal kayıtlar yine o devletin delege anahtarlarıyla (egemenlik ve [[SPEC-BC-0001]]/N1 değişmez); ağ düzeyi kayıtlar
  (ağ şemaları, [[ADR-0074]] K3) açılış önerisinin yetkilendirdiği **tek bir göç yürütücüsü** adresiyle ve yalnız kip açıkken
  (her kayıt için ayrı Governance oyu gerekmez).
- Yeniden oynatma üretim arşivinin **ilk arşivlenmiş sürümünden** başlar.
- Kip açıkken [[ADR-0054]]/NS3 günlük kotaları **uygulanmaz** (F10); kip kapanınca kotalar aynen döner.
- Kip kapalıyken (başlamadı ya da kapandı) bugünkü kural sürer: tarihler `block.timestamp`'tir. Tek istisna K2'deki sert iptal
  tarihidir.
- Yeniden oynatma komutu **`trust:chain-replay`** (`apps/trust-publisher`): üretim arşivini (`archive/` liste sürümleri, çapa
  günlüğü arşivleri ve kontrol noktaları) doğrular, deterministik planı ve özetini üretir; varsayılan `--dry-run` yalnız planı basar.
  Yazım `TAMGA_CHAIN_ENABLED` açık ve göç kipi açıkken yapılır; komut kaldığı yerden sürer (zincirde olanı atlar) ve sonunda K6
  testini çalıştırır.

## K2 — Sert iptal: `invalidatesFrom` (F2)

- Kurum kaydı `invalidatesFrom` taşır (0 = yok). Ele geçirilme iptali bu tarihi yazar; koşul: `validFrom ≤ invalidatesFrom ≤
  revokedAt`. Tarih geçmişte olabilir (ele geçirilme sonradan anlaşılır); bu, göç kipi dışında geçmiş tarih yazılabilen tek alandır
  ve kurumun kendi geçerlilik aralığıyla sınırlıdır.
- C1: `iat ≥ invalidatesFrom` olan belge düşer (listede `invalidates_from ≤ iat` → NO, `TrustSource`'un bugünkü kuralı).
- Bir kez yazılan tarih silinmez; yalnız daha geriye çekilebilir (iptal kapsamı genişler, daralmaz).
- Kök CA iptali bugün zaten bütün altını düşürür (CA2); değişmez.

## K3 — Şema sürüm özetleri yalnız eklenebilir dizi (F3)

- Şema kaydı ilk `contentHash`'i korur ve yanında yalnız eklenebilir bir sürüm özetleri dizisi taşır. Yeni sürüm özetini ulusal
  şemada o devlet, ağ şemasında Governance önerisi (göç kipinde göç yürütücüsü) ekler. `matchesContentHash` dizideki herhangi bir
  özetle eşleşir; `REVOKED` şemada hiçbiriyle eşleşmez.
- Liste biçimi SRI'dir (`sha256-<base64>`); zincirde aynı SHA-256 baytları `bytes32` olarak yazılır.
- [[SPEC-BC-0001]] SC1 daralır: "`vctURI` ve yazılmış her içerik özeti asla güncellenmez ya da silinmez; yeni sürüm özeti
  eklenebilir." Yayınlanmış şema metadata'sı yine değişmez (D1); bu, [[ADR-0010]] K4'ün zincir karşılığıdır.

## K4 — Doğrulayıcı kimliği, sertifika, askıdan dönüş, ince kapsam (F4)

- **Kimlik:** `rpId = keccak256(utf8(dns_name))`. Sertifika yenilenince değişmez ([[ADR-0034]] CI3/CI4). ABI'de alan adı metni
  yoktur; kayıt kurumu özeti hesaplar, indeksleyici ve K6 testi formülü denetler. Kontrat devlet kodunu egemenlik için ayrıca tutar.
  Kimlikler zincir formülüyle olduğundan listedeki `rp_id` de aynı formüle geçer; bugünkü gömülü açıklama politikaları
  ([[ADR-0046]]) geliştirme evresi kuralıyla yeniden yazılır ([[ADR-0029]]).
- **Sertifika:** erişim sertifikası parmak izi güncellenebilir; eski ve yeni parmak izi olayla yayılır, geçmiş kalır. Bir parmak
  izi aynı anda yalnız bir doğrulayıcıya aittir.
- **Askıdan dönüş:** `SUSPENDED → ACTIVE` dönüşü eklenir (kurum ve kök CA'da olduğu gibi). `REVOKED` kesindir.
- **İnce kapsam:** her kullanım bir kapsam kaydıdır; serbest metin özetle:

| Liste alanı | Zincirde |
|---|---|
| `scope_id` | `keccak256(scope_id)` |
| `service_id` (yoksa `scope_id`) | `keccak256(service_id)` |
| `vct` | `schemaId = keccak256(vct)` |
| `format` | kapalı küme, sırayla: `dc+sd-jwt`, `mso_mdoc`, `mso_mdoc_zk` (yalnız sona eklenir) |
| `mdoc_namespace` | `keccak256(mdoc_namespace)` ya da 0 |
| `claims[]` | sıralı öğe yolu özetleri dizisi (`keccak256(utf8(yol))`) |
| `valid_from`, `valid_until` | tarih aralığı (göç kipinde açık tarihle) |
| `purpose`, `purpose_localized`, `privacy_policy_uri` | tek ayrıntı özeti (kapsam kaydının kanonik JSON'unun SHA-256'sı) |

  Okuma: "bu doğrulayıcı bu hizmette, bu türde, bu biçimde, bu öğeyi şu anda isteyebilir mi". ABI alan adları kişisel veri
  denetiminin yasak kökleriyle (`claim`, `credential`, `holder`…) çakışmayacak biçimde seçilir (ör. "öğe"/`attribute`). Kaba
  `allowedScopes` kalkar; [[SPEC-BC-0001]] §14 açık konu 3 böylece kapanır.

## K5 — Durum eşlemesi ve `iat` anındaki durum (F5)

- Kontrat C1/C2/C3'ü belgenin `iat` anındaki duruma göre değerlendirir: kurum, kök CA ve şema durumu yalnız eklenebilir durum
  pencereleri olarak tutulur (şema yetkisi geçmişi bugün böyledir). Aralıklar **yarı açıktır**: değişiklik başlangıç anından itibaren
  geçerlidir, `[başlangıç, bitiş)`. Böylece `iat <= revokedAt` ve `iat <= until` sınırları listeyle aynı olur (`iat < …`).
- Eşleme:

| Liste durumu | Kök CA | Kurum | Şema | Doğrulayıcı | Not |
|---|---|---|---|---|---|
| `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` | |
| `ROLLING_OVER` | `ACTIVE` + halef olayı | — | — | — | Liste C1'de etkin sayar |
| `SUSPENDED` | `SUSPENDED` | `SUSPENDED` | — | `SUSPENDED` | Yalnız askı süresinde verilen belge düşer; askıdan önceki belgeler geçerlidir (liste kuralı) |
| `RETIRED` | `RETIRED` | `REVOKED`, yumuşak (`revokedAt` = `since`) | — | `REVOKED` | Önceki belgeler geçerli kalır (GV1) |
| `REVOKED` | `REVOKED` | `REVOKED`; `invalidates_from` varsa K2 | `REVOKED` | `REVOKED` | |
| `DEPRECATED` | — | — | `DEPRECATED` | — | SC3 |
| `RESERVED`, `PROVISIONAL` | kayıt yazılmaz | kayıt yazılmaz | kayıt yazılmaz | kayıt yazılmaz | Boş slot; slot durumu [[ADR-0074]] K3'te |

  "—" o kayıt türünde listede kullanılmayan değerdir; yayıncı bu değerle yayın yapmaz, yeniden oynatma görürse durur.
- Kontrat enum'larına değer eklenmez; ayrım gereken yerde liste durumu olayda taşınır.

## K6 — Eşdeğerlik testi ve göçün kapanışı

- `trust:chain-replay` sonunda iki kaynağı aynı sorgu kümesiyle karşılaştırır: `conformance/vectors/trust` + arşivdeki her liste
  sürümü için kayıtlı her `(issuer_id, schema_id, iat, list_id, version)`; ayrıca sınır anları (`since − 1`, `since`, `since + 1`)
  ve kapsam sorguları. Okuma tarafı [[ADR-0074]] K5'teki `ChainTrustSource`'tur.
- Kabul: C1/C2/C3/D5 cevaplarında ACCEPTED/REJECTED farkı yok. Fark varsa göç kapanmaz; rapor herkese açık şeffaflık raporuna girer.
- Kapanıştan sonra zincir yine projeksiyondur ([[ADR-0051]] CH1); Faz 0'ın zinciri kaynak yapıp yapmayacağı ayrı karardır.

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Kontratlar her zaman açık tarih alsın | ret | Bir delege anahtarı ele geçirilirse geçmiş sessizce yeniden yazılır; tarih ancak denetimli, tek seferlik pencerede güvenilir |
| Geçmişi oynatmamak; zincir açıldığı günden başlasın | ret | Eski belgeler zincirde reddedilir; [[ADR-0009]] K7 ve TL10 karşılanmaz |
| Göç için ayrı "geçmiş" kontratı, sonra taşıma | ret | İki kaynak, iki okuma yolu; eşdeğerlik iki kez kanıtlanır |
| Kotaları göçte yükseltmek (kaldırmak yerine) | ret | Geçmişin boyutu önceden bilinmez; pencere tek seferlik ve Governance onaylı olduğundan kota korumasına gerek yok |
| Şema için her sürümde yeni `schemaId` | ret | `schema_id = keccak256(vct)` formülü bozulur; ana sürüm `vct`'de, alt sürümler özet dizisinde ([[ADR-0010]]) |
| `rpId`'yi sertifikaya bağlı bırakıp eşleme tablosu tutmak | ret | Takma ad, kopya ayrımı ve açıklama politikası zaten `dns_name`'e bağlı ([[ADR-0034]] CI4); iki kimlik iki gerçek demek |
| Kapsamda öğe yollarını tek özetle tutmak | ret | Zincirde "bu öğe istenebilir mi" sorulamaz; öğe başına özet aşırı istek denetimini mümkün kılar |
| Kontrat C1'ini bugünkü duruma göre bırakmak | ret | Listeyle farklı cevap; [[ADR-0009]] K7 testi geçmez |

# Değişmezler

| Kod | Kural |
|---|---|
| CE1 | Göç kipi her kayıt kontratında Governance önerisiyle bir kez açılır; pencere en çok 30 gündür ve süre dolunca kendiliğinden kapanır; kapanınca hiçbir yolla (yükseltme dahil) yeniden açılamaz. Kip açıkken geçmiş tarih yazılabilir ama hiçbir tarih blok zamanından ileri olamaz, kayıt başına sıra korunur ve günlük kotalar uygulanmaz; kip kapalıyken tarihler blok zamanıdır (CE2 hariç). |
| CE2 | Sert iptal tarihi (`invalidatesFrom`) kurumun geçerlilik başlangıcı ile iptal anı arasındadır; yazıldıktan sonra silinmez, yalnız geriye çekilebilir; `iat` bu tarihe eşit ya da sonraysa belge kabul edilmez. |
| CE3 | Şemanın `vctURI`'si ve yazılmış her içerik özeti değiştirilmez ve silinmez; yeni sürüm özeti yalnız eklenir. |
| CE4 | Doğrulayıcının zincir ve liste kimliği `keccak256(dns_name)`'dir; erişim sertifikasının yenilenmesi kimliği değiştirmez. |
| CE5 | Kontrat C1/C2/C3'ü belgenin `iat` anındaki duruma göre, yarı açık aralıklarla değerlendirir (askıdaki kurumun askıdan önceki belgeleri geçerlidir); liste durumları kontrata eşleme tablosuyla yazılır. |
| CE6 | Göç, `trust:chain-replay` eşdeğerlik testinde C1/C2/C3/D5 cevaplarında ACCEPTED/REJECTED farkı kalmadan kapanmaz. |

# Açık soruların kararları (2026-11-04)

1. **Askıdaki kurumun eski belgeleri:** liste kuralı. Askıdan önce verilmiş belge geçerlidir; yalnız askı süresinde verilen belge
   düşer (K5). [[SPEC-BC-0001]] §3.3 buna uyar.
2. **Göçte ağ düzeyi yazımlar:** açılış önerisinin yetkilendirdiği tek göç yürütücüsü yazar (K1).
3. **Göç süresi tavanı:** en çok 30 gün; Governance yalnız kip açıkken ve tavan içinde uzatır; süre dolunca kip kendiliğinden
   kapanmış sayılır (K1, CE1).
4. **Listedeki `rp_id`:** `keccak256(dns_name)` olur (K4); bugünkü gömülü açıklama politikaları yeniden yazılır ([[ADR-0029]]).
5. **Yeniden oynatmanın başlangıcı:** üretim arşivinin ilk arşivlenmiş sürümü (K1).
6. Kapsam ve öğe dizisi tavanları uygulamada başlangıç değeriyle konur, saha verisiyle gözden geçirilir.

# Sonuçlar

- Kontratlar ([[ADR-0074]] ile birlikte): göç durumu ve Governance önerileri; kurum, kök CA ve şemada durum
  pencereleri ve yarı açık sınırlar; `invalidatesFrom`; şema sürüm özetleri; doğrulayıcı kimliği, sertifika güncelleme, askıdan
  dönüş ve kapsam kayıtları; `privacy-abi` testi yeni alanları kapsar. Struct'lara alan yalnız sona eklenir (UUPS depolama düzeni).
- `apps/trust-publisher`: `trust:chain-replay` (plan, özet, kuru prova, devam, eşdeğerlik testi); liste `rp_id` hesabı (K4).
- Belgeler: [[SPEC-BC-0001]] §3.3, §4.4 SC1, §6, §12.2, §13, §14 ve [[SPEC-TRUST-0001]] §7 değişir; [[ADR-0051]]
  K2'nin "mevcut sekiz kontrat değişmez" cümlesi bu ADR ve [[ADR-0074]] ile değişmiş olur.
- Üretimde zincir yine kapalıdır ([[ADR-0009]] K4, [[ADR-0051]] CH5); bu karar yalnız geçişin mümkün olmasını sağlar.

# Uygulama notu (2026-11-04, kontrat güvenlik turu)

Karar içeriği değişmedi; proje yönetiminin onayıyla uygulamadaki sınırlar netleşti:

- **CE1 "yükseltme dahil hiçbir yolla yeniden açılamaz"** kontratlarda üç katmanla korunur: (1) göç penceresi açıkken kayıt
  kontratı yükseltilemez; (2) Governance her yükseltmede hedefin göç durumunu önce ve sonra karşılaştırır, fark varsa yükseltme
  geri alınır; (3) yükseltme incelemesi — depo denetimi (`check-upgrade-safety`) göç kipi kaynağının sabitlenmiş özetini, ad alanı
  slotunu ve başka hiçbir kaynağın bu slota ya da ham depolama yazımına dokunmadığını denetler. Yükseltme anındaki karşılaştırma
  tek başına yetmez: yeni bir implementasyon göç durumuna sonradan yazan bir fonksiyon taşıyabilir. Bu yüzden sınır **yükseltme
  incelemesine de dayanır**.
- **K1 tek göç yürütücüsü** ağ şemalarında kayıt, sürüm özeti ve deprecate yazar; ağ şemasının iptali (kalıcıdır) yalnız Governance
  önerisiyle yapılır. İptal edilmiş şema her `iat` için reddedildiğinden iptalin anı eşdeğerliği (CE6) değiştirmez.
- **K1 "kip açıkken tarih taşıyan yazımlar tarihi açıkça alır"** kontratta zorlanır: pencere açıkken tarihsiz (blok zamanlı)
  olağan yazım Governance dışında reddedilir; acil yazım açık tarihle (şimdi) yapılır. Böylece yeniden oynatma ile o günkü işletim
  aynı kaydın geçmişinde sessizce yarışmaz. Kota istisnası (CE1) bütün kip için geçerli kalır.

# Durum

**Accepted — 2026-11-04.** Proje yönetiminin onayıyla (birebir alıntı özel onay kaydında): askıdaki kurumun askıdan önceki
belgeleri geçerli; açık soruların kalanı önerildiği gibi. Komut adı `trust:chain-replay` onaylıdır. DECISIONS: D-BC-12.
CE1–CE6 bağlayıcıdır. Kontratlardaki uygulama sürüyor ([[SPEC-BC-0001]] sürüm notları).
