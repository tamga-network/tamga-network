---
document_id: ADR-0076
title: "İki üyeli ağda çıkış ve yönetişimin sürekliliği"
status: Proposed
version: 1.0.0
created: 2026-11-11
last_updated: 2026-11-11
summary: >
  Governance kontratında asgari mutlak oy 2'dir. Etkin üye sayısı 2 iken bir üye tek taraflı çekilirse (`withdraw`) sayı 1'e düşer;
  kalan üye hiçbir öneriyi yürütemez, yeni üye kabul edemez ve kendisi de çekilemez: yönetişim kalıcı olarak kilitlenir. Çıkış hakkı
  (ADR-0002 #5) ile yönetişimin sürekliliği bu noktada çatışır. Öneri: (a) etkin üye sayısı 2 iken `withdraw` reddedilir; çıkmak
  isteyen üye önce üçüncü üyenin kabulünü bekler. Alternatif (b): çıkış serbest kalır, tek üye kalınca eşik 1'e iner. Önerilen (a).
  Ayrıca tek kuruculu kuruluşun yalnız yerel geliştirmede kalıp kalmayacağı sorulur. Karar bekliyor.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]"]
---

# Kısaca

Ağın ortak kararları (yeni üye kabulü, yükseltme, ağ şeması) en az iki üyenin oyuyla alınır. Ağda iki üye varken biri kendi
isteğiyle çekilirse geriye tek üye kalır ve tek üye hiçbir kararı tek başına alamaz. Yeni üye de kabul edilemediği için ağ bu
durumdan çıkamaz. Bu öneri, o noktaya düşmeyi engelleyen kuralı tanımlar.

# Bağlam

- [[ADR-0002]] #5: bir devlet tek taraflı `withdraw()` ile çekilebilir; oy gerekmez, güvence kod düzeyindedir.
- [[SPEC-BC-0001]] §1 (bağımsız inceleme bulgusu R6): 2/3 kuralı üç üyeden azında anlamını yitirdiği için `requiredVotes`
  hiçbir zaman 2'nin altına inmez. Aynı bölüm iki üyeli ağda çıkarmanın imkânsız olduğunu, iki tarafın da "yalnızca gönüllü
  `withdraw` edebileceğini" söyler.
- Kontrat denetimi (2026-11-11), testle doğrulandı: etkin üye sayısı 2 iken `withdraw` sayıyı 1'e düşürür. Bundan sonra
  - kalan üyenin her önerisi `ThresholdNotMet(1, 2)` ile düşer (yeni üye kabulü dahil);
  - kalan üye çekilemez (`LastValidator`);
  - kontratlar yükseltilemez, ağ şeması yazılamaz, liste çapası yazıcıları ve göç kipi yönetilemez.
  Ulusal kayıtlar etkilenmez (kalan devlet kendi kayıtlarını yazmayı sürdürür); kilitlenen ağ düzeyi yönetişimdir ve geri dönüşü
  yoktur.
- Aynı durum kuruluşta da oluşabilir: `initialize` tek kurucuyu kabul eder; tek üyeyle hiçbir öneri yürütülemez. Bugün bu yalnız
  yerel geliştirme kurulumlarında kullanılır. Üretim zinciri yoktur ve en az iki bağımsız işletmeciyle açılır ([[ADR-0009]] K4).
- İki kapatılmış kural çatıştığı için kod değiştirilmedi; bu belge kuralı önerir.

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

# Sonuçlar (kabul edilirse)

- `Governance.withdraw`: tek satırlık koşul değişikliği; depolama düzeni ve dış arayüz değişmez. Test: iki üyeli ağda çıkış
  reddedilir, üçüncü üye kabul edilince çıkış geçer.
- [[SPEC-BC-0001]] §1 ("iki taraf da yalnızca gönüllü `withdraw` edebilir" cümlesi) ve §14 madde 8; [[ADR-0002]]'ye uygulama
  notu.
- Kabul edilene kadar kontrat davranışı değişmez; işletim kuralı geçerlidir: iki üyeli ağda çekilmeden önce üçüncü üye kabul
  edilir. Mevcut davranış testle kayda geçirildi (`contracts/test/review-2026-11-11-governance.test.ts`).

# Durum

**Proposed — 2026-11-11.** Proje yönetiminin kararını bekliyor (2026-11-11 kontrat denetimi bulgusu).
