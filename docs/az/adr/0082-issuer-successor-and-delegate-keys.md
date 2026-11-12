---
document_id: ADR-0082
title: "Düzəldilə bilən qurum xələfi və dövlət üzrə nümayəndə açarı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Kontrakt yoxlamasından qalan iki tapıntı bağlanmış qaydalara toxunduğu üçün bu qərarla bağlanır. (1) Bağlanan qurumun ləğv
  siyahılarını kimin dərc edəcəyini müəyyən edən xələf ləğv əməliyyatı ilə bir addımda yazılırdı və sonra dəyişdirilə bilmirdi:
  səhv yazılan xələf daimi idi, xələfsiz ləğvdə və ya xələf də bağlananda siyahılar donurdu. Qərar: qurumun dövləti ləğv edilmiş
  qurumunun xələfini eyni qaydalarla sonradan düzəldir, dəyişdirir və ya götürür. (2) Bir nümayəndə açarı yalnız bir dövlətə aid
  ola bilirdi; bir dövlət başqa dövlətin istifadə edəcəyi açarı əvvəlcə öz siyahısına yazaraq həmin dövlətin nümayəndə təyinatına
  mane ola bilirdi. Qərar: nümayəndə uyğunluğu dövlət üzrə saxlanılır; bir dövlətin siyahısı digərinin səlahiyyətinə nə toxunur,
  nə də ona mane olur. Yoxlayan tərəf kimliyinin tutulması ADR-0075 ilə onsuz da düzəldilə bilir. Qəbul edildi (2026-11-12).
domain: Blockchain
related: ["[[SPEC-BC-0001]]", "[[ADR-0002]]", "[[ADR-0054]]", "[[ADR-0073]]", "[[ADR-0075]]"]
translation_of: ADR-0082
source_version: 1.0.0
---

# Qısaca

Zəncirdəki qeydlərdə kiçik, lakin qalıcı nəticə doğura bilən iki boşluq var idi. Birincisi: qurum bağlananda "ləğv siyahılarını
bundan sonra bu qurum dərc edir" məlumatı (xələf) bir dəfə yazılırdı və səhv yazılanda düzəldilə bilmirdi. İkincisi: bir dövlət
başqa dövlətin istifadə etmək istədiyi əməliyyat açarını ondan əvvəl öz adına qeyd edərək həmin dövlətin açar təyinatına mane ola
bilirdi. Bu qərar hər ikisini bağlayır: xələf sonradan düzəldilə bilir; hər dövlətin açar siyahısı yalnız özünə aiddir. İşləyən
zəncir yoxdur ([[ADR-0009]] K4); dəyişiklik mənbədə edilir, zəncir bu versiya ilə qurulur.

# Kontekst

- **Xələf.** [[SPEC-BC-0001]] §3 və I4: `REVOKED` qurumun ləğv siyahısını xələfi dərc edir; xələf zənciri bir səviyyəlidir.
  Xələf yalnız `revokeIssuer` / `revokeIssuerAt` / `retireIssuer` çağırışında yazılırdı; qurum ləğv edildikdən sonra eyni çağırış
  `AlreadyRevoked` ilə rədd olunur. Nəticə koddan təsdiqləndi (kontrakt yoxlaması 2026-11-12, tapıntı D4):
  - səhv kimliklə yazılan xələf daimidir: sələfin siyahılarını səhv qurumun açarları idarə edir;
  - xələfsiz ləğvdə siyahılar donur: bağlanan qurumun saxta və ya səhv sənədi artıq ləğv edilə bilmir;
  - xələf də sonradan bağlanarsa (zəncir bir səviyyəlidir), sələfin siyahıları yenə donur.
- **Nümayəndə açarı.** [[SPEC-BC-0001]] N1: "bir açar yalnız bir dövlətə aid ola bilər" (`DelegateKeyInUse`). Qayda 2026-10-19
  təhlükəsizlik turunda, bir dövlətin başqa dövlətin açarını öz siyahısına yazaraq həmin dövlətin səlahiyyətini salmasının
  (oğurlama) qarşısını almaq üçün qoyulmuşdu; uyğunluq tək qiymətli idi (açar → dövlət). Eyni qayda əks istiqamətdə istifadə
  oluna bilirdi (tapıntı D5): bir dövlət digərinin nümayəndə təyinatı əməliyyatını görüb eyni açarı əvvəlcə öz siyahısına yazarsa,
  digərinin əməliyyatı rədd olunur. Açar yaratmaq ucuzdur, lakin maneə hər cəhddə təkrarlana bilər və mane olunan dövlət milli
  qeydlərinə yaza bilmir. Kontrakt açarın kimdə olduğunu bilə bilməz.
- **Yoxlayan tərəf kimliyi.** Eyni tapıntının digər yarısı (`rpId`-nin tutulması) [[ADR-0075]] ilə bağlanıb: əvvəl qeyd edən
  dövlətin qeydi Governance səsverməsi ilə (2/3) həqiqi sahibinə verilir. Giriş sertifikatının barmaq izi və qapı qrupu kimliyi
  üçün tutulma yalnız yeni sertifikat və ya kimliklə aşılır; hər ikisi dövlətin öz əlindədir və qeydlər kimin yazdığını göstərir.

# Seçimlər

Xələf:

| Seçim | Nə | Nəticə |
|---|---|---|
| **(a) Dövlət xələfi sonradan yazır** | Ləğv edilmiş qurum üçün xələfi düzəldən, dəyişdirən və ya götürən ayrıca çağırış; qaydalar ləğvdəki ilə eynidir | **seçildi** |
| (b) İki addımlı təyinat | Xələf qurumun açarı təyinatı qəbul edir | seçilmədi: qurum açarları milli qeydlərə yaza bilmir (R1); hər iki qurum eyni dövlətindir, təsdiq əlavə təminat vermir |
| (c) Xələf zəncirini izləmək | Xələf bağlananda onun xələfi səlahiyyət alır | seçilmədi: səhv yazını düzəltmir; səlahiyyət zənciri uzanır (I4, bir səviyyə) |

Nümayəndə açarı:

| Seçim | Nə | Nəticə |
|---|---|---|
| **(a) Dövlət üzrə uyğunluq** | Uyğunluq (açar, dövlət) cütü ilə saxlanılır; bir dövlətin siyahısı digərinə toxunmur və ona mane olmur | **seçildi** |
| (b) Açarın təsdiqi | Təyin olunan açar ayrıca əməliyyatla qəbul edir | seçilmədi: hər nümayəndə üçün əlavə əməliyyat, Governance-da əlavə kod (bayt ehtiyatı azdır); (a) eyni nəticəni daha az kodla verir |
| (c) Heç nə etməmək | Mane olan dövlət zəncirdə görünür; çarə çıxarma səsverməsidir | seçilmədi: mane olunan dövlət səsvermə bitənə qədər qeyd yaza bilmir |

# Qərar (2026-11-12)

Xələf üçün (a), nümayəndə açarı üçün (a). Məcburi qaydalar aşağıdakı IS1–IS2 və DK1–DK2-dir.

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| IS1 | Ləğv edilmiş (`REVOKED`) qurumun xələfini yalnız qurumun dövləti sonradan yazır: düzəldir, dəyişdirir və ya götürür (`setIssuerSuccessor`). Xələf ləğvdəki qaydalara uyğundur: eyni dövlətin həmin anda `ACTIVE` qurumu, qurumun özü deyil ([[ADR-0054]] NS2); sıfır xələfi götürür. Ləğv edilməmiş qurumda çağırış rədd olunur (`IssuerNotRevoked`): xələf ləğvlə birlikdə gəlir. |
| IS2 | Xələf yalnız ləğv siyahısını dərc etmə səlahiyyətini müəyyən edir ([[SPEC-BC-0001]] I4); sənədlərin qəbulunu (C1/C2), qurumun status tarixçəsini və ləğv anını dəyişmir. Xələf zənciri bir səviyyədə qalır: xələf bağlanarsa, dövlət yenisini yazır. Hər dəyişiklik zəncirdə hadisə ilə görünür (`IssuerSuccessorSet`). |
| DK1 | Nümayəndə açarı uyğunluğu dövlət üzrədir. Bir dövlətin nümayəndə siyahısını yazması və ya boşaltması yalnız həmin dövlətin uyğunluğunu dəyişir; başqa dövlətin nümayəndə təyinatına mane ola və səlahiyyətini sala bilməz. `DelegateKeyInUse` götürülür. |
| DK2 | N1 olduğu kimi qalır: bir dövlətin qeydinə yalnız həmin dövlətin nümayəndəsi yazır. Bir açar bir neçə dövlətin siyahısında ola bilər; hər dövlət öz siyahısına cavabdehdir (başqa dövlətin açarını siyahısına yazan dövlət həmin açara yalnız öz qeydləri üzərində səlahiyyət vermiş olur). Validator ünvanı üçün tək dövlət qaydası (`ValidatorInUse`) dəyişmir. |

Adlar (açıq ABI; mövcud adlandırma qaydasına görə):

| Yer | Ad |
|---|---|
| `IssuerRegistry` funksiyası | `setIssuerSuccessor(bytes32 issuerId, bytes32 successorId)` |
| `IssuerRegistry` hadisəsi | `IssuerSuccessorSet(bytes32 indexed issuerId, bytes32 successorId)` |
| `IssuerRegistry` xətası | `IssuerNotRevoked(bytes32 issuerId)` |
| `Governance` xətası (götürülən) | `DelegateKeyInUse(address key, bytes2 ownerState)` |

# Nəticələr

- `IssuerRegistry`: yeni funksiya, hadisə və xəta; xələf yoxlaması ləğvlə ortaq daxili funksiyadadır. Yaddaş düzümü dəyişmir.
  Zəncir indeksləyicisi qurum hadisələrində qeydi yenidən oxuduğu üçün xələf dəyişikliyini əlavə kod olmadan görür.
- `Governance`: `_delegateToState` (açar → dövlət) əvəzinə eyni yuvada `_isDelegate` (açar → dövlət → bəli/xeyr). İşləyən zəncir
  olmadığı üçün yaddaş düzümünün əsas xətti bu versiya ilə yenidən yazıldı; yayılmış versiya olsaydı, yuvanın tipi dəyişdirilməz,
  yeni dəyişən əlavə olunardı. `isDelegateOf` və `delegateKeysOf` imzaları dəyişmir. İcra kodu kiçildi.
- [[SPEC-BC-0001]] N1, §1, §3 və I4 yeniləndi.
- Testlər: `contracts/test/review-2026-11-12.test.ts` (xələfsiz ləğv, səhv xələfin düzəldilməsi, xələfin bağlanması, qaydalar;
  əvvəl yazan dövlətin digərinə mane ola bilməməsi, siyahıların bir-birinə toxunmaması), `security-round-2026-10-19.test.ts`
  (F-02).
- Qalan hədd (bilərəkdən): yoxlayan tərəfin giriş sertifikatının barmaq izi və qapı qrupu kimliyi şəbəkədə təkdir və ilk yazana
  aiddir. Tutulan dəyərin yerinə yenisi istifadə olunur; domen adı kimliyi üçün yol [[ADR-0075]]-dir.

# Status

**Accepted — 2026-11-12.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-12). DECISIONS: D-BC-16. IS1–IS2 və DK1–DK2 məcburidir.
Tətbiq: `IssuerRegistry.setIssuerSuccessor`, `Governance.setDelegateKeys` ([[SPEC-BC-0001]] versiya qeydləri).
