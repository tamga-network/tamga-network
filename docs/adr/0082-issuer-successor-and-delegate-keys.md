---
document_id: ADR-0082
title: "Düzeltilebilir kurum halefi ve devlet başına delege anahtarı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Kontrat taramasından kalan iki bulgu kapatılmış kurallara dokunduğu için bu kararla kapatılır. (1) Kapatılan bir kurumun iptal
  listelerini kimin yayımlayacağını belirleyen halef, iptal işlemiyle tek adımda yazılıyor ve bir daha değiştirilemiyordu: yanlış
  yazılan halef kalıcıydı, halefsiz iptalde ya da halef de kapanınca listeler donuyordu. Karar: kurumun devleti, iptal edilmiş
  kurumunun halefini aynı kurallarla sonradan düzeltir, değiştirir ya da kaldırır. (2) Bir delege anahtarı yalnız bir devlete
  ait olabiliyordu; bir devlet, başka devletin kullanacağı anahtarı önce kendi listesine yazarak o devletin delege atamasını
  engelleyebiliyordu. Karar: delege eşlemesi devlet başına tutulur; bir devletin listesi ötekinin yetkisine ne dokunur ne de onu
  engeller. Doğrulayıcı kimliğinin kapılması ADR-0075 ile zaten düzeltilebilir. Kabul edildi (2026-11-12).
domain: Blockchain
related: ["[[SPEC-BC-0001]]", "[[ADR-0002]]", "[[ADR-0054]]", "[[ADR-0073]]", "[[ADR-0075]]"]
---

# Kısaca

Zincirdeki kayıtlarda iki küçük ama kalıcı sonuç doğurabilen boşluk vardı. Birincisi: bir kurum kapatılırken "iptal listelerini
bundan sonra şu kurum yayımlar" bilgisi (halef) bir kez yazılıyor, yanlış yazılırsa düzeltilemiyordu. İkincisi: bir devlet,
başka bir devletin kullanmak istediği işlem anahtarını ondan önce kendi adına kaydederek o devletin anahtar atamasını
engelleyebiliyordu. Bu karar ikisini de kapatır: halef sonradan düzeltilebilir; her devletin anahtar listesi yalnız kendisini
ilgilendirir. Çalışan bir zincir yoktur ([[ADR-0009]] K4); değişiklik kaynakta yapılır, zincir bu sürümle kurulur.

# Bağlam

- **Halef.** [[SPEC-BC-0001]] §3 ve I4: `REVOKED` bir kurumun iptal listesini halefi yayımlar; halef zinciri tek seviyedir.
  Halef yalnız `revokeIssuer` / `revokeIssuerAt` / `retireIssuer` çağrısında yazılıyordu; kurum iptal edildikten sonra aynı
  çağrı `AlreadyRevoked` ile düşer. Sonuç, koddan doğrulandı (kontrat denetimi 2026-11-12, bulgu D4):
  - yanlış kimlikle yazılan halef kalıcıdır: öncülün listelerini yanlış kurumun anahtarları yönetir;
  - halefsiz iptalde listeler donar: kapatılan kurumun sahte ya da hatalı belgesi artık iptal edilemez;
  - halef de sonradan kapanırsa (zincir tek seviyeli) öncülün listeleri yine donar.
- **Delege anahtarı.** [[SPEC-BC-0001]] N1: "bir anahtar yalnız bir devlete ait olabilir" (`DelegateKeyInUse`). Kural 2026-10-19
  güvenlik turunda, bir devletin başka devletin anahtarını kendi listesine yazarak o devletin yetkisini düşürmesini (çalma)
  önlemek için konmuştu; eşleme tek değerliydi (anahtar → devlet). Aynı kural tersinden kullanılabiliyordu (bulgu D5): bir
  devlet, ötekinin delege atama işlemini görüp aynı anahtarı önce kendi listesine yazarsa ötekinin işlemi düşer. Anahtar
  üretmek ucuzdur, ama engelleme her denemede yinelenebilir ve engellenen devlet ulusal kayıtlarına yazamaz. Kontrat, anahtarın
  kimde olduğunu bilemez.
- **Doğrulayıcı kimliği.** Aynı bulgunun öteki yarısı (`rpId` kapma) [[ADR-0075]] ile kapanmıştır: önce kaydeden devletin
  kaydı Governance oyuyla (2/3) gerçek sahibine devredilir. Erişim sertifikası parmak izi ve kapı grubu kimliği için kapma
  yalnız yeni bir sertifika ya da kimlikle aşılır; ikisi de devletin kendi elindedir ve kayıtlar kimin yazdığını gösterir.

# Seçenekler

Halef:

| Seçenek | Ne | Sonuç |
|---|---|---|
| **(a) Devlet halefi sonradan yazar** | İptal edilmiş kurum için halefi düzelten, değiştiren ya da kaldıran ayrı bir çağrı; kurallar iptaldekiyle aynı | **seçildi** |
| (b) İki adımlı atama | Halef kurumun anahtarı atamayı kabul eder | seçilmedi: kurum anahtarları ulusal kayıtlara yazamaz (R1); iki kurum da aynı devletindir, onay bir güvence eklemez |
| (c) Halef zincirini izlemek | Halef kapanınca onun halefi yetkilenir | seçilmedi: yanlış yazımı düzeltmez; yetki zinciri uzar (I4 tek seviye) |

Delege anahtarı:

| Seçenek | Ne | Sonuç |
|---|---|---|
| **(a) Devlet başına eşleme** | Eşleme (anahtar, devlet) çiftiyle tutulur; bir devletin listesi ötekine dokunmaz ve onu engellemez | **seçildi** |
| (b) Anahtarın onayı | Atanan anahtar ayrı bir işlemle kabul eder | seçilmedi: her delege için ek işlem, Governance'ta ek kod (bayt payı dar); (a) aynı sonucu daha az kodla verir |
| (c) Hiçbir şey yapmamak | Engelleyen devlet zincirde görünür; çare çıkarma oyu | seçilmedi: engellenen devlet oy sonuçlanana kadar kayıt yazamaz |

# Karar (2026-11-12)

Halef için (a), delege anahtarı için (a). Bağlayıcı kurallar aşağıdaki IS1–IS2 ve DK1–DK2.

# Değişmezler

| Kod | Kural |
|---|---|
| IS1 | İptal edilmiş (`REVOKED`) bir kurumun halefini yalnız kurumun devleti sonradan yazar: düzeltir, değiştirir ya da kaldırır (`setIssuerSuccessor`). Halef iptaldeki kurallara uyar: aynı devletin o anda `ACTIVE` kurumu, kurumun kendisi değil ([[ADR-0054]] NS2); sıfır halefi kaldırır. İptal edilmemiş kurumda çağrı reddedilir (`IssuerNotRevoked`): halef iptalle birlikte gelir. |
| IS2 | Halef yalnız iptal listesi yayın yetkisini belirler ([[SPEC-BC-0001]] I4); belgelerin kabulünü (C1/C2), kurumun durum geçmişini ve iptal anını değiştirmez. Halef zinciri tek seviyede kalır: halef kapanırsa devlet yenisini yazar. Her değişiklik zincirde olayla görünür (`IssuerSuccessorSet`). |
| DK1 | Delege anahtarı eşlemesi devlet başınadır. Bir devletin delege listesini yazması ya da boşaltması yalnız o devletin eşlemesini değiştirir; başka devletin delege atamasını engelleyemez ve yetkisini düşüremez. `DelegateKeyInUse` kalkar. |
| DK2 | N1 aynen sürer: bir devletin kaydına yalnız o devletin delegesi yazar. Bir anahtar birden çok devletin listesinde bulunabilir; her devlet kendi listesinden sorumludur (başka devletin anahtarını listesine yazan devlet, o anahtara yalnız kendi kayıtları üzerinde yetki vermiş olur). Validator adresi için tek devlet kuralı (`ValidatorInUse`) değişmez. |

Adlar (kamuya açık ABI; mevcut adlandırma düzenine göre):

| Yer | Ad |
|---|---|
| `IssuerRegistry` fonksiyonu | `setIssuerSuccessor(bytes32 issuerId, bytes32 successorId)` |
| `IssuerRegistry` olayı | `IssuerSuccessorSet(bytes32 indexed issuerId, bytes32 successorId)` |
| `IssuerRegistry` hatası | `IssuerNotRevoked(bytes32 issuerId)` |
| `Governance` hatası (kalkan) | `DelegateKeyInUse(address key, bytes2 ownerState)` |

# Sonuçlar

- `IssuerRegistry`: yeni fonksiyon, olay ve hata; halef denetimi iptalle ortak bir iç fonksiyonda. Depolama düzeni değişmez.
  Zincir indeksleyicisi kurum olaylarında kaydı yeniden okuduğu için halef değişikliğini ek kod olmadan görür.
- `Governance`: `_delegateToState` (anahtar → devlet) yerine aynı yuvada `_isDelegate` (anahtar → devlet → evet/hayır).
  Çalışan zincir olmadığı için depolama taban çizgisi bu sürümle yeniden yazıldı; dağıtılmış bir sürüm olsaydı yuva yeniden
  tiplenmez, yeni değişken eklenirdi. `isDelegateOf` ve `delegateKeysOf` imzaları değişmez. Çalışma kodu küçüldü.
- [[SPEC-BC-0001]] N1, §1, §3 ve I4 güncellendi.
- Testler: `contracts/test/review-2026-11-12.test.ts` (halefsiz iptal, yanlış halefin düzeltilmesi, halefin kapanması, kurallar;
  önce yazan devletin ötekini engelleyememesi, listelerin birbirine dokunmaması), `security-round-2026-10-19.test.ts` (F-02).
- Kalan sınır (bilinçli): doğrulayıcının erişim sertifikası parmak izi ve kapı grubu kimliği ağda tektir ve ilk yazana aittir.
  Kapılan değer yerine yenisi kullanılır; alan adı kimliği için yol [[ADR-0075]]'tir.

# Durum

**Accepted — 2026-11-12.** Proje yönetiminin onayıyla (2026-11-12). DECISIONS: D-BC-16. IS1–IS2 ve DK1–DK2 bağlayıcıdır.
Uygulama: `IssuerRegistry.setIssuerSuccessor`, `Governance.setDelegateKeys` ([[SPEC-BC-0001]] sürüm notları).
