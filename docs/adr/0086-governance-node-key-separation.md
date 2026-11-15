---
document_id: ADR-0086
title: "Yönetişim ve düğüm anahtarı ayrımı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Zincirde her üye devletin iki ayrı adresi olur: blok üreten doğrulayıcı düğümün (QBFT) anahtarı ve devletin yönetişim (oy)
  anahtarı. Zincirdeki bütün yetki — öneri, oy, delege listesi, çıkış — yalnız yönetişim anahtarındadır; sürekli çevrimiçi
  sunucudaki düğüm anahtarının zincirde hiçbir yetkisi yoktur ve hesap izin listesine girmez. Düğüm adresini üye kendi
  yönetişim anahtarıyla, oy gerekmeden değiştirir. Yönetişim anahtarı yalnız Governance oyuyla (2/3, en az 2) ve değişen üyenin
  bugünkü anahtarıyla verdiği destek oyuyla değişir; öteki üyeler bir devletin anahtarını onun rızası olmadan değiştiremez. İki
  üyeli dönemde yönetişim anahtarının sınanmış yedeği zorunludur. Kabul edildi (2026-11-15).
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0052]]", "[[ADR-0055]]", "[[ADR-0076]]", "[[ADR-0082]]", "[[ADR-0084]]", "[[ADR-0085]]", "[[SPEC-BC-0001]]", "[[ARCH-0002]]"]
---

# Kısaca

Zincirde bir devletin iki işi vardır: blok üretmek (doğrulayıcı düğüm) ve ağın kararlarına oy vermek (yönetişim). Bugüne kadar
ikisi aynı anahtarla yapılıyordu. Düğüm anahtarı her an çevrimiçi bir sunucudadır; oy anahtarı ise yılda birkaç kez kullanılır ve
kasada durmalıdır. Aynı anahtar olunca sunucuyu ele geçiren devletin oyunu ve ulusal kayıtlarının delege listesini de ele
geçirirdi. Bu karar iki anahtarı ayırır: düğüm anahtarı yalnız blok üretir, zincirde yetkisi yoktur; bütün yetki yönetişim
anahtarındadır. Düğüm anahtarı kolayca (devletin kendi kararıyla) değiştirilir; yönetişim anahtarı ancak ağın oyu ve devletin kendi
oyuyla değişir.

# Bağlam

- [[SPEC-BC-0001]] §1: `Governance` üye kaydında tek adres tutuyordu (`StateMember.validatorAddress`); öneri, oy, oy geri çekme,
  öneri geri çekme, delege anahtarı listesi (`setDelegateKeys`) ve çıkış bu adresten yapılıyordu. [[ADR-0052]] K2: Besu yerel izin
  listesinin hesap kısmı aynı adresi "validator" olarak listeler.
- [[ARCH-0002]] Adım 2 ve Açık Konular 6 (2026-11-11): "yönetişim ve uzlaşma anahtarı bugün aynıdır; ayrılana kadar gerçek ağda
  düğüm anahtarı HSM'de tutulmak zorundadır; ayrım ikinci devlet katılmadan önce yeni bir karar kaydıyla."
- Zincir katmanı denetimi (2026-11-15): ayrım ilk zincir kurulmadan yapılmalı; sonradan yapmak canlı bir Governance yükseltmesi
  demektir. [[ADR-0084]] LS6: gerçek ağ, anahtar ayrımı için karar kaydı olmadan açılmaz.
- [[ADR-0076]]: iki üyeli ağda tek taraflı çıkış yoktur; bir üyenin oy anahtarı kaybolursa yönetişim kilitlenir — bu yüzden iki
  üyeli dönemde anahtar yedeği ve sınama imzası kuralı yazıldı ([[ARCH-0002]] Adım 11).
- **Proje yönetiminin yönü (2026-11-15):** zincir kodu kapalı olarak tamamlanır ([[ADR-0084]] K6); sıradaki işler yapılır. Bu karar
  o işlerin ilkidir.

# Karar

## K1 — Üye kaydında iki adres

Her üyenin kaydında iki adres bulunur: **düğüm adresi** (`validatorAddress`, QBFT doğrulayıcı düğümünün anahtarı) ve **yönetişim
adresi** (`governanceAddress`, devletin oy anahtarı). Kayıt ayrıca yönetişim anahtarının üyeye bağlandığı anı tutar
(`governanceSince`; kabulde ve anahtar değişikliğinde yazılır). Kurallar:

- İki adres sıfır olamaz ve birbirinden farklıdır.
- Bir adres yalnız bir devlette ve yalnız bir rolde kullanılır: bir devletin düğüm adresi başka devletin düğüm adresi olamaz
  (`ValidatorInUse`, N1), yönetişim adresi başka devletin yönetişim adresi olamaz, hiçbir adres herhangi bir devlette öteki rolde
  kullanılamaz (`KeyInUse`).
- Bırakılan (değiştirilen) adres o devlete bağlı kalır; başka bir devlete verilemez. Ele geçirilmiş eski bir anahtar başka bir
  koltuğa taşınamaz.
- Kurucular kuruluşta (`initialize`) iki adresle girer; yeni üye kabul önerisi (`proposeStateAdmission`) iki adresi taşır.

## K2 — Zincirdeki bütün yetki yönetişim anahtarında

Öneri açma (bütün türler), oy verme ve değiştirme, oy geri çekme, öneri geri çekme, delege anahtarı listesi, çıkış ve
SchemaRegistry bağı yalnız üyenin **bugünkü** yönetişim adresinden yapılır (`NotGovernor`). Düğüm anahtarının zincirde hiçbir
yetkisi yoktur: o yalnız blok üretir ve QBFT doğrulayıcı kümesindeki yerini belirler. Bu yüzden düğüm adresi Besu hesap izin
listesine girmez; hesap listesinde etkin üyelerin yönetişim adresleri bulunur ([[ADR-0052]] K2'nin hesap listesi bu kayıtla
okunur). Düğüm izin listesi değişmez: düğüm bildirimi Governance'taki düğüm adresiyle eşleşen doğrulayıcı düğümler listelenir.
Yürütmede oylar üyelerin bugünkü yönetişim adresinden sayılır.

## K3 — Düğüm anahtarını üye kendisi değiştirir

Düğüm adresini üye kendi yönetişim anahtarıyla, oy gerekmeden değiştirir (`setValidatorAddress`, olay
`ValidatorAddressChanged`). Gerekçe: düğüm anahtarı en çok risk altındaki anahtardır ve ele geçirildiğinde hızla değiştirilmesi
gerekir; zincirde yetkisi olmadığı için değişikliği devletin iç işidir (delege listesi gibi). Ele geçirilmiş düğüm anahtarı
kendini değiştiremez. Zincirdeki adres değişince her işletmeci izin listesini zincirden yeniden üretir; QBFT doğrulayıcı kümesindeki
değişiklik ayrıca doğrulayıcıların kendi oyuyla (QBFT düzeyinde) yapılır.

## K4 — Yönetişim anahtarı ağın oyu ve üyenin kendi oyuyla değişir

Yönetişim anahtarı yalnız türü belli bir Governance önerisiyle değişir (`proposeGovernanceKeyChange`, tür
`GOVERNANCE_KEY_CHANGE`, olay `GovernanceAddressChanged`):

- Eşik öteki önerilerle aynıdır: etkin üyelerin 2/3'ü, en az 2 ([[ADR-0002]], R6).
- **Değişen üyenin bugünkü anahtarıyla verdiği destek oyu ayrıca şarttır** (`KeyChangeNeedsOwnVote`). Öteki üyeler eşiği
  doldursa da bir devletin anahtarını onun rızası olmadan değiştiremez; değiştirebilselerdi o devletin delege listesini, yani
  ulusal kayıtlarına yazma yetkisini ele geçirirlerdi (N1).
- Öneriyi herhangi bir üye açabilir (anahtarı değişen üye de).
- Yürütmede yeniden denetlenir: üye hâlâ etkin, yeni anahtar hâlâ boşta (arada başka devlete ya da öteki role bağlanmamış).
- Yürütmeden sonra eski anahtarın yetkisi hemen düşer; eski anahtarla açık önerilere verilmiş oylar sayılmaz (`governanceSince`),
  üye yeni anahtarla yeniden oy verir — yeniden kabul edilen üyenin eski oylarının sayılmaması kuralıyla aynı.

**Neden oy, neden kendi imzası tek başına değil.** Kendi imzasıyla (tek başına) değişseydi, yönetişim anahtarını ele geçiren biri
anahtarı kendi anahtarına çevirip gerçek sahibini kalıcı olarak dışarıda bırakabilirdi; iki üyeli ağda o üyeyi çıkarmak da mümkün
değildir (çıkarma, hedef dışında en az iki oy ister). Oy şartında ele geçirilmiş anahtar tek başına hiçbir şey değiştiremez:
öteki üyeler değişikliği ayrı bir kanaldan gelen yazılı taleple doğrular. Üyenin kendi oyu şartı da çoğunluğun bir devletin
koltuğunu sessizce ele geçirmesini engeller.

## K5 — İki üyeli dönem ve anahtar kaybı

- İki üyeli ağda anahtar değişikliği iki üyenin oyunu ister (değişen üye + öteki üye). Kaybolan yönetişim anahtarı iki üyeli
  ağda zincir üstünde kurtarılamaz: değişiklik için o anahtarın oyu gerekir, üye çıkarılamaz ve çekilemez ([[ADR-0076]]). Bu yüzden
  [[ARCH-0002]] Adım 11'in yedek ve sınama imzası kuralı **yönetişim anahtarına** uygulanır ve iki üyeli dönemde zorunludur:
  yedekten geri yüklenen anahtarın adresi Governance'taki **yönetişim adresiyle** aynı olmalı, bu anahtarla sınama imzası
  atılabilmelidir. Düğüm anahtarı için yedek şart değildir: kaybolursa üye yönetişim anahtarıyla yenisini yazar (K3).
- Üç ve daha çok üyeli ağda kaybolan anahtarın yolu bugünkü yoldur: üye öteki üyelerin oyuyla çıkarılır ve yeni adreslerle yeniden
  kabul edilir (görünür, gerekçe özetli iki öneri).
- Ele geçirilmiş ama yedeği elde olan anahtarda üye ve öteki üyeler hemen değişiklik önerisini oylar; ele geçiren de aynı anahtarla
  oyu çevirebileceğinden, değişiklik yürütülene kadar öteki üyeler ele geçirenin oylarını ve önerilerini dikkate almaz. Zincir
  karar vermediği için ([[ADR-0084]] LS2) bu süre hiçbir belgenin doğrulamasını etkilemez.

## K6 — Anahtarların saklanması

Yönetişim anahtarı düğüm sunucusunda bulunmaz: ayrı bir kasada (gerçek ağda donanım anahtar kasası) durur ve yalnız işlem
imzalarken kullanılır. Düğüm anahtarı düğüm sunucusundadır (gerçek ağda donanım anahtar kasası tercih edilir, ama artık zorunluluk
gerekçesi oy değil, blok üretimidir). Gerçek ağın anahtar yolu (donanım anahtar kasası ve uzaktan imzacı) ayrı bir karar kaydıdır
([[ADR-0084]] LS6).

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **İki adres; düğümün yetkisi yok; düğüm kendi değişir; yönetişim oy + kendi oyuyla** | **seçildi** | Sunucuyu ele geçiren oyu ele geçiremez; düğüm hızla değişir; yönetişim anahtarı ne tek başına ele geçirilip kilitlenebilir ne de çoğunlukça el konabilir |
| Tek anahtar (bugünkü), düğüm anahtarını HSM'de tutmak | ret | Sürekli çevrimiçi bir anahtar oy ve ulusal kayıt yetkisi taşır; HSM imzayı korur ama ele geçirilmiş sunucunun HSM'e imza attırmasını engellemez |
| Yönetişim anahtarını üye tek başına değiştirir | ret | Anahtarı çalan, sahibini kalıcı dışarıda bırakır; iki üyeli ağda geri dönüş yolu yoktur |
| Yönetişim anahtarı yalnız oyla, üyenin oyu şartsız | ret | 2/3 çoğunluk bir devletin anahtarını kendi anahtarına çevirip onun delege listesini, yani ulusal kayıtlarını ele geçirebilir (N1'e aykırı) |
| Düğüm anahtarı da yalnız oyla değişir | ret | En riskli anahtarın değişimi öteki işletmecilerin hızına bağlanır; düğümün zincirde yetkisi olmadığından oy bir şey korumaz |
| Ayrı kontrat (yönetişim anahtar kaydı) | ret | Governance'ın yetki denetimi her çağrıda dış çağrı olurdu; depolama düzenine yeni bir eşleme ve `__gap`'ten bir yuvayla aynı sonuç alınır |

# Değişmezler

| Kod | Kural |
|---|---|
| KG1 | Her üyenin kaydında iki adres vardır: düğüm (QBFT) adresi ve yönetişim adresi; ikisi sıfır değildir ve farklıdır. Bir adres yalnız bir devlette ve yalnız bir rolde kullanılır; bırakılan adres o devlete bağlı kalır, başka devlete verilemez. |
| KG2 | Zincirdeki bütün yetki (öneri, oy, oy ve öneri geri çekme, delege listesi, çıkış, SchemaRegistry bağı) yalnız üyenin bugünkü yönetişim adresindedir; düğüm adresinin zincirde yetkisi yoktur ve hesap izin listesine girmez. Yürütmede oylar bugünkü yönetişim adresinden sayılır. |
| KG3 | Düğüm adresini üye kendi yönetişim anahtarıyla, oy gerekmeden değiştirir; doğrulayıcı kümesindeki değişiklik QBFT düzeyinde doğrulayıcıların oyuyla yapılır. |
| KG4 | Yönetişim anahtarı yalnız Governance önerisiyle değişir: etkin üyelerin 2/3'ü (en az 2) ve değişen üyenin bugünkü anahtarla verdiği destek oyu birlikte gerekir; yürütmede yeniden denetlenir; eski anahtarın yetkisi ve açık önerilerdeki oyları düşer. |
| KG5 | İki üyeli dönemde her üye yönetişim anahtarının ayrı yerde saklanan, sınanmış bir yedeğini tutar (geri yüklenen anahtarın adresi Governance'taki yönetişim adresiyle aynı, sınama imzası atılabilir); yönetişim anahtarı düğüm sunucusunda bulunmaz. |

# Sonuçlar

- `contracts/src/governance/Governance.sol`, `IGovernance.sol`: üye kaydına `governanceAddress` ve `governanceSince` (yapı yalnız
  mapping değeri; üyeler sona eklendi), öneri kaydına `governanceAddress`, yeni eşleme `_governanceToState` (`__gap` 37 → 36), yeni
  öneri türü `GOVERNANCE_KEY_CHANGE` (sona eklendi), `proposeGovernanceKeyChange`, `setValidatorAddress`, olaylar
  `ValidatorAddressChanged`, `GovernanceAddressChanged`, `StateAdmitted` iki adresli; hatalar `NotGovernor` (`NotValidator`'ın
  yerine), `KeyInUse`, `KeyChangeNeedsOwnVote`. `initialize` ve `proposeStateAdmission` üçüncü bağımsız değişkeni (yönetişim
  adresi) alır. Depolama düzeni denetimi geçti; kod boyutu Governance 23.872 bayt (pay 704). Çalışan zincir yok; taban çizgisi
  yenilendi.
- Yayıncı ve araçlar: izin listesi hesap kısmında etkin üyelerin yönetişim adresleri ("governance"), düğüm adresi yok; anahtar
  haritası (`tamga-chain-keys/1`) her devlete `governance` anahtarı ekler; yerel geliştirme kuralı: yönetişim anahtarı = düğüm
  hesabı + 10 (Hardhat test hesapları); test ağı betikleri, göç ve sürekli projeksiyon imzacıları yönetişim anahtarıyla oy verir.
- [[SPEC-BC-0001]] §1, [[ARCH-0002]] Adım 2, Adım 6, Adım 11 ve Açık Konular 6, düğüm el kitabı (GUIDE-0015) güncellendi.
- Yönetişim komut aracı yönetişim anahtarıyla imzalar (anahtar değişikliği ve düğüm adresi değişikliği alt komutlarıyla).

# Durum

**Accepted — 2026-11-15.** Proje yönetiminin onayıyla (2026-11-15). DECISIONS: D-GOV-13. KG1–KG5 bağlayıcıdır.
