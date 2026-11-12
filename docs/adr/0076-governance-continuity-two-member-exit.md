---
document_id: ADR-0076
title: "İki üyeli ağda çıkış ve yönetişimin sürekliliği"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-11
last_updated: 2026-11-12
summary: >
  Governance kontratında asgari mutlak oy 2'dir. Etkin üye sayısı 2 iken bir üye tek taraflı çekilirse (`withdraw`) sayı 1'e düşer;
  kalan üye hiçbir öneriyi yürütemez, yeni üye kabul edemez ve kendisi de çekilemez: yönetişim kalıcı olarak kilitlenir. Çıkış hakkı
  (ADR-0002 #5) ile yönetişimin sürekliliği bu noktada çatışır. Öneri: (a) etkin üye sayısı 2 iken `withdraw` reddedilir; çıkmak
  isteyen üye önce üçüncü üyenin kabulünü bekler. Alternatif (b): çıkış serbest kalır, tek üye kalınca eşik 1'e iner. Önerilen (a).
  Kabul edildi (2026-11-12): (a), öneriyle. Çıkmak isteyen üyenin yolu: önce üçüncü üye kabul edilir, sonra üye çekilir. Tek
  kuruculu kuruluş yalnız yerel geliştirme içindir.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]"]
---

# Kısaca

Ağın ortak kararları (yeni üye kabulü, yükseltme, ağ şeması) en az iki üyenin oyuyla alınır. Ağda iki üye varken biri kendi
isteğiyle çekilirse geriye tek üye kalır ve tek üye hiçbir kararı tek başına alamaz. Yeni üye de kabul edilemediği için ağ bu
durumdan çıkamaz. Bu karar o noktaya düşmeyi engeller: iki üyeli ağda tek taraflı çıkış reddedilir; çıkmak isteyen üye önce
üçüncü bir üyenin kabul edilmesini bekler, sonra oy gerekmeden çekilir.

# Bağlam

- [[ADR-0002]] #5: bir devlet tek taraflı `withdraw()` ile çekilebilir; oy gerekmez, güvence kod düzeyindedir.
- [[SPEC-BC-0001]] §1 (bağımsız inceleme bulgusu R6): 2/3 kuralı üç üyeden azında anlamını yitirdiği için `requiredVotes`
  hiçbir zaman 2'nin altına inmez. Aynı bölüm iki üyeli ağda çıkarmanın imkânsız olduğunu, iki tarafın da "yalnızca gönüllü
  `withdraw` edebileceğini" söyler.
- Kontrat denetimi (2026-11-11), testle doğrulandı (karardan önceki davranış): etkin üye sayısı 2 iken `withdraw` sayıyı 1'e
  düşürüyordu. Bundan sonra
  - kalan üyenin her önerisi `ThresholdNotMet(1, 2)` ile düşer (yeni üye kabulü dahil);
  - kalan üye çekilemez (`LastValidator`);
  - kontratlar yükseltilemez, ağ şeması yazılamaz, liste çapası yazıcıları ve göç kipi yönetilemez.
  Ulusal kayıtlar etkilenmez (kalan devlet kendi kayıtlarını yazmayı sürdürür); kilitlenen ağ düzeyi yönetişimdir ve geri dönüşü
  yoktur.
- Aynı durum kuruluşta da oluşabilir: `initialize` tek kurucuyu kabul eder; tek üyeyle hiçbir öneri yürütülemez. Bugün bu yalnız
  yerel geliştirme kurulumlarında kullanılır. Üretim zinciri yoktur ve en az iki bağımsız işletmeciyle açılır ([[ADR-0009]] K4).
- İki kapatılmış kural çatıştığı için kod karardan önce değiştirilmedi; kural bu belgeyle kondu.

# Seçenekler

| Seçenek | Ne | Artı | Eksi |
|---|---|---|---|
| **(a) İki üyede çıkış bekler** | Etkin üye sayısı 2 iken `withdraw` reddedilir. Çıkmak isteyen üye önce üçüncü bir üyenin kabulünü bekler, sonra çekilir | Yönetişim hiçbir zaman kilitlenmez; küçük ve yerel bir kod değişikliği; R6 korunur | Çıkış hakkı iki üyeli ağda ertelenir: öteki üye yeni üye kabulüne oy vermezse çıkış zincirde gerçekleşmez (üye validator'ını durdurabilir ve kayıt yazmayı bırakabilir, ama üye sayılmaya devam eder) |
| **(b) Tek üyede eşik 1** | `withdraw` serbest kalır. Etkin üye sayısı 1 iken `requiredVotes` 1 döner; kalan üye yeni üye kabul edebilir | Çıkış hakkı tam korunur; kilit oluşmaz; tek kuruculu kuruluş da çalışır | Kalan tek üye ağ düzeyindeki her kararı tek başına alır: 7 günlük beklemeden sonra kontratları yükseltebilir, çekilmiş devletlerin kayıtlarını da etkileyebilir. R6'nın "tek devlet tek başına karar veremez" güvencesi tek üyeli ağda kalkar |
| **(c) İkisi birlikte** | İki üyede çıkış reddedilir; tek üyeli kuruluşta eşik 1 | Kilit iki yoldan da kapanır | İki ayrı kural; tek üyeli ağ üretimde zaten istenmiyor ([[ADR-0009]] K4) |
| Hiçbir şey yapmamak | Kural işletim belgesinde kalır: "iki üyeli ağda çekilmeden önce üçüncü üye kabul edilir" | Kod değişmez | Tek bir işlem ağı geri dönüşsüz kilitler; hata ya da anlaşmazlıkta koruma yok |

# Öneri

**(a).** Gerekçe: iki üyeli ağ, şartnamenin kendi ifadesiyle bir ortaklık gibi davranır; ortaklardan birinin tek işlemle ağın
ortak yönetimini kalıcı olarak durdurabilmesi çıkış hakkının amacı değildir. (b) kilidi açar ama ağ düzeyindeki bütün yetkiyi tek
devlete bırakır; çekilmiş devletlerin zincirdeki kayıtları o devletin yükseltme kararına açık kalır. (a)'da çıkış hakkı kalkmaz,
sıraya bağlanır. Önerilen kurallar (kabul edilirse bağlayıcı tabloya taşınır):

1. Etkin üye sayısı 2 ya da daha az iken `withdraw` reddedilir (bugün yalnız son üye reddedilir).
2. [[ADR-0002]] #5 şu kayıtla okunur: tek taraflı çıkış, ağda en az üç etkin üye varken oy gerektirmez; iki üyeli ağda üçüncü
   üyenin kabulünden sonra kullanılır.
3. Tek kuruculu kuruluş yalnız yerel geliştirme içindir. Kuruluşun en az iki kurucu istemesi ayrıca kararlaştırılır: yerel
   geliştirme ve test ağı kurulumları bugün tek kurucuyla çalışabildiği için bu taslak onu değiştirmez.
4. Hata adı ve şartname metni kabulde onaylanır.

# Karar (2026-11-12)

**(a) öneriyle kabul edildi.** Bağlayıcı kurallar aşağıdaki GC1–GC3; ad tablonun altında. Tek kuruculu kuruluş değişmedi: yalnız
yerel geliştirme içindir; kuruluşun en az iki kurucu istemesi ayrıca kararlaştırılır.

# Değişmezler

| Kod | Kural |
|---|---|
| GC1 | Tek taraflı çıkış (`Governance.withdraw`) yalnız ağda en az üç etkin üye varken geçer; etkin üye sayısı 2 ya da daha az iken reddedilir (`TooFewMembers`). Çıkış da çıkarma da etkin üye sayısını asgari mutlak oyun (2) altına indiremez: yönetişim her zaman karar alabilir durumda kalır. |
| GC2 | İki üyeli ağda çıkmak isteyen üyenin yolu sıralıdır: önce üçüncü bir üye kabul edilir (`proposeStateAdmission`, iki üyenin oyuyla), sonra üye `withdraw` ile çekilir; bu ikinci adım oy gerektirmez. Kabul gerçekleşene kadar üye validator'ını durdurabilir ve kayıt yazmayı bırakabilir; üyeliği sürer. |
| GC3 | [[ADR-0002]] #5 bu kayıtla okunur: çıkış hakkı kalkmaz, sıraya bağlanır. En az üç etkin üyeli ağda tek taraflıdır, oy gerektirmez ve kodla güvence altındadır. Çıkışın belgeler üzerindeki etkisi değişmez: verilmiş belgeler ve mevcut kayıtlar geçerli kalır ([[ADR-0002]] #4). |

Ad (kamuya açık ABI; mevcut hata adlandırma düzenine göre — `TooManyDelegates(count, max)` deseni):

| Yer | Ad |
|---|---|
| `Governance` hatası | `TooFewMembers(uint32 active, uint32 required)` — `active`: çağrı anındaki etkin üye sayısı; `required`: tek taraflı çıkış için gereken en az etkin üye sayısı (3) |

# Sonuçlar

- `Governance.withdraw`: tek satırlık koşul değişikliği (`activeMemberCount ≤ 2` → ret). Depolama düzeni ve fonksiyon imzaları
  değişmez; ABI'ye bir hata eklenir. Tek üyeli (yerel geliştirme) kuruluşta da çıkış aynı hatayla reddedilir; `LastValidator`
  yalnız çıkarma önerisinde kalır.
- Testler (`contracts/test/review-2026-11-11-governance.test.ts`, `contracts/test/governance.test.ts`): üç üyeden biri çekilir
  (3 → 2), iki üyeli ağda çıkış reddedilir (2 → 1), üçüncü üye kabul edilince çıkış geçer ve kalan iki üye karar almayı sürdürür.
- [[SPEC-BC-0001]] §1 ve §14 madde 8 (kapandı); [[ADR-0002]]'ye uygulama notu.
- Kalan sınır (bilinçli): iki üyeli ağda öteki üye yeni üye kabulüne oy vermezse çıkış zincirde gerçekleşmez. Üye validator'ını
  durdurabilir ve kayıt yazmayı bırakabilir; üyelik kaydı sürer. Bu, iki üyeli ağın ortaklık gibi davranmasının sonucudur
  ([[SPEC-BC-0001]] §1).

# Durum

**Accepted — 2026-11-12.** Proje yönetiminin onayıyla (2026-11-12): seçenek (a), öneriyle. DECISIONS: D-GOV-12. GC1–GC3
bağlayıcıdır. Uygulama: `Governance.withdraw` ([[SPEC-BC-0001]] sürüm notu).
