---
document_id: ADR-0075
title: "Doğrulayıcı alan adı kimliğinin sahipliği ve iptal sonrası yeniden kayıt"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-05
summary: >
  ADR-0073 K4 doğrulayıcı kimliğini `rpId = keccak256(dns_name)` yaptı. Kontratta bu kimlik onu ilk kaydeden devletindir; başka
  bir devlet, alan adı kendisine ait olmayan bir doğrulayıcıyı önce kaydederek kimliği kapabilir ve iptal edilmiş bir kimlik bir daha
  hiç kaydedilemez. Öneri: (a) Governance'ın türü belli bir anlaşmazlık / devir önerisiyle (2/3) kimliğin sahibi değiştirilir;
  iptalden sonra yeniden kayıt yalnız Governance oyuyla açılır. Alternatif (b): alan adı sahipliğinin DNS kanıtıyla zincir dışında
  denetlenmesi + Governance onayı. Önerilen (a). Kabul edildi (2026-11-04): (a), öneriyle; yeni dönem eski geçmişi korur, liste
  aynı kuralla güncellenir.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0034]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[SPEC-BC-0001]]"]
---

# Kısaca

Bir doğrulayıcının ağdaki kimliği artık alan adından türetiliyor. Kontrat bugün bu kimliği "ilk gelen alır" kuralıyla veriyor:
bir devlet, başka bir ülkedeki kurumun alan adını önce kaydederse o kurum kendi alan adıyla kayıt olamaz. Ayrıca bir doğrulayıcı
bir kez iptal edilirse aynı alan adı bir daha hiç kaydedilemiyor. Bu öneri iki durum için de bir çıkış yolu tanımlar: anlaşmazlıkta
ve iptalden sonra karar ağın ortak oyuna (2/3) bırakılır.

# Bağlam

- [[ADR-0073]] K4 / CE4: doğrulayıcının zincir ve liste kimliği `keccak256(dns_name)`'dir; erişim sertifikası yenilenince
  değişmez. Kontrat devlet kodunu egemenlik için ayrıca tutar.
- 2026-11-04 kontrat güvenlik turu (ORTA, karar gerekir): `RelyingPartyRegistry.registerRelyingParty` kimliği, çağıran devletin
  delege anahtarıyla ve **ilk kayıt** kuralıyla yazar. Kontrat alan adının o devlete ait olduğunu bilemez (ABI'de alan adı metni
  yok, [[ADR-0074]] PJ2). Sonuçlar:
  - **Kapma:** A devleti, B devletindeki bir kurumun alan adından türetilen kimliği önce kaydedebilir; B'nin kaydı `RPExists` ile
    reddedilir. Egemenlik kuralı ([[SPEC-BC-0001]]/N1) yalnız "kendi devlet kodunla yaz" der; kimliğin hangi devlete düştüğünü
    söylemez.
  - **Kalıcı iptal:** `REVOKED` kesindir (K4); kayıt silinmez, aynı kimlik bir daha kaydedilemez. Alan adı el değiştirirse ya da
    iptal yanlışlıkla yapılırsa o alan adıyla ağda doğrulayıcı olmak imkânsızlaşır.
- Bugün kayıt kurumu alan adı sahipliğini kendi kayıt sürecinde denetler ([[ADR-0024]], [[ADR-0026]]); zincirde bunun bir karşılığı
  ve bir anlaşmazlık yolu yoktur. Kurallar değişmeden kod değişmez; bu ADR o kuralı önerir.

# Seçenekler

| Seçenek | Ne | Artı | Eksi |
|---|---|---|---|
| **(a) Governance anlaşmazlık / devir önerisi** | Türü belli bir Governance önerisi ([[ADR-0055]] GE3, 2/3) bir doğrulayıcı kimliğinin sahibi devleti değiştirir (kapma) ya da iptal edilmiş kimliği yeniden kayda açar. Eski kayıt ve geçmişi silinmez; yeni kayıt yeni bir dönem olarak eklenir. Kapsam dışı: kimliğin kendisi ve formülü (CE4) değişmez. | Mevcut güven modeli (devletler arası 2/3) içinde kalır; zincir dışına bağımlılık yok; tek devlet tek başına kimlik kapamaz ya da geri alamaz | Her anlaşmazlık bir oy turu; kanıtın değerlendirilmesi üyelere kalır |
| **(b) DNS kanıtı + Governance onayı** | Kayıt (ya da devir) başvurusunda alan adı sahipliği DNS kanıtıyla (ör. alan adında yayımlanan bir doğrulama kaydı) zincir dışında denetlenir; Governance kanıta dayanarak onaylar | Sahiplik nesnel bir kanıta dayanır | Kanıt zincir dışında; denetimin kendisi bir işletmeciye ve araca bağlı; DNS geçici olarak ele geçirilebilir; yine Governance onayı gerekir |
| Hiçbir şey yapmamak | "İlk gelen alır" ve kalıcı iptal sürer | Kod değişmez | Kapma ve kalıcı kilit çözümsüz kalır |

# Öneri

**(a).** Gerekçe: kimliğin hangi devlete düşeceği ağ düzeyinde bir karardır ve ağın ortak kapısı Governance'tır ([[ADR-0002]]);
DNS kanıtı (b) oyu kolaylaştıran bir belge olarak öneriye eklenebilir ama tek başına yetmez. Önerilen kurallar:

1. Bir doğrulayıcı kimliğinin sahibi devlet yalnız Governance'ın türü belli önerisiyle (2/3) değişir; öneri kimliği, eski ve yeni
   devlet kodunu ve gerekçe özetini taşır (serbest metin yok, [[ADR-0074]] PJ2).
2. `REVOKED` bir doğrulayıcı kaydı için kesin kalır; aynı kimliğin **yeniden kaydı** yalnız Governance oyuyla açılır ve yeni bir
   kayıt dönemi başlatır. İptal edilmiş dönemin geçmişi ve olayları korunur.
3. Devir ya da yeniden kayıt imzalı listede de aynı kuralla yazılır (zincir–liste eşdeğerliği, [[ADR-0073]] CE6).
4. Fonksiyon, öneri ve olay adları kabulde onaylanır.

# Karar (2026-11-04)

**(a) öneriyle kabul edildi.** Bağlayıcı kurallar aşağıdaki RO1–RO5; adlar tablonun altında.

# Değişmezler

| Kod | Kural |
|---|---|
| RO1 | Doğrulayıcı kimliğinin (`rpId = keccak256(dns_name)`) sahibi devlet yalnız Governance'ın türü belli **devir** önerisiyle (2/3) değişir. Öneri, kayıtta önce sabitlenen içeriğin özetini (`stageId`) taşır; içerik kimliği, eski ve yeni devlet kodunu, yeni dönemin ad özetini ve erişim sertifikası parmak izini ve gerekçe özetini içerir (serbest metin yok, [[ADR-0074]] PJ2). Devir yalnız iptal edilmemiş kayda ve başka bir etkin üye devlete yapılır. |
| RO2 | `REVOKED` bir dönem için kesin kalır. Aynı kimliğin **yeniden kaydı** yalnız Governance'ın türü belli yeniden kayıt önerisiyle (2/3) ve yalnız iptal edilmiş kayıtta açılır (aynı ya da başka etkin üye devlet). |
| RO3 | Devir ve yeniden kayıt yeni bir **kayıt dönemi** başlatır (ACTIVE, yürütme anından). Kayıt silinmez; durum geçmişi ve dönem listesi yalnız eklenir; eski dönemin olayları ve kayıtları korunur. Yeni dönem eski dönemin kapsamlarını, kayıt verisini ve kapı gruplarını devralmaz; eski dönemin açık kapı grupları kapanır. `t` anındaki okumalar (`relyingPartyAt`, `isRelyingPartyAcceptableAt`) o andaki döneme göre cevap verir. |
| RO4 | Sabitlemeden sonra kayda başka bir dönem eklendiyse öneri bayattır, yazılmaz; öneri türü sabitlenen içeriğin türüyle aynı olmalıdır. |
| RO5 | İmzalı listede de aynı kural: `dns_name` durumu ne olursa olsun ikinci kez kaydedilmez; sahiplik değişimi ve iptal sonrası yeniden kayıt yalnız proje yönetimi onaylı açık işlemle yapılır. Yeniden kayıt aynı kayda yeni dönem olarak eklenir (`status_history` → `ACTIVE`, gerekçede onay kaydı); eski kullanımlar kapanmış hâlde kalır. Gerçek ağ kayıt defterine yazım ayrıca `TAMGA_CONFIRM_PROD` kapısından geçer. |

Adlar (kamuya açık ABI; mevcut adlandırma düzenine göre — `proposeNetworkRecord` / `stageRecord` / `commitStaged` deseni):

| Yer | Ad |
|---|---|
| `Governance` öneri fonksiyonları | `proposeRelyingPartyReassignment(registry, stageId)`, `proposeRelyingPartyReRegistration(registry, stageId)` |
| `Governance` kayıt yönetimi işlemleri (`AdminAction`, yalnız sona) | `REASSIGN_RELYING_PARTY`, `REREGISTER_RELYING_PARTY` |
| `RelyingPartyRegistry` yazım | `stagePeriodChange(PeriodChange)` (herkes; yalnız saklar), `commitPeriodChange(stageId, PeriodAction)` (yalnız Governance) |
| `RelyingPartyRegistry` okuma | `periodChangeIdOf`, `stagedPeriodChangeOf`, `registrationPeriodsOf`, `relyingPartyAt(rpId, t)`, `isRelyingPartyAcceptableAt(rpId, t)`, `relyingPartyStatusHistoryOf` |
| Türler | `PeriodAction {NONE, REASSIGNMENT, RE_REGISTRATION}`, `PeriodChange`, `RegistrationPeriod` |
| Olaylar | `PeriodChangeStaged`, `RelyingPartyReassigned`, `RelyingPartyReRegistered` |
| Hatalar | `UnknownPeriodChange`, `InvalidPeriodChange`, `StalePeriodChange` |
| Liste yayıncısı | `register rp <başvuru> --approval <onay kaydı>` (iptal sonrası yeniden kayıt) |

# Açık soruların kararları (2026-11-04)

1. **Seçenek:** (a). DNS kanıtı (b) öneriye eklenebilecek destekleyici belgedir; gerekçe özetinin içinde yer alabilir.
2. **Adlar:** yukarıdaki tablo (mevcut adlandırma düzenine göre).
3. **Göç penceresi:** dönem değişikliği pencere açıkken de yalnız Governance oyuyla yazılır; tarihi yürütme anıdır (geri tarihlenmez),
   pencerede yeniden oynatılan geçmiş önceki dönemde kalır.

# Sonuçlar

- `RelyingPartyRegistry` ve `Governance`: yeni türü belli öneri ve yalnız Governance'ın çağırabildiği devir / yeniden kayıt yolu;
  kayıt dönemi sayacı; depolama düzenine yalnız sona ekleme.
- [[SPEC-BC-0001]] §6 ve §16; liste yayıncısının kayıt aracı ve `TrustSource` eşdeğerlik testi.
- Kayıt kurumu alan adı sahipliğini kayıttan önce denetlemeye devam eder; anlaşmazlıkta yol Governance önerisidir. `TrustSource`
  tarafında aynı `dns_name`'in birden çok ülke listesinde görünmesi bugün kapalı güvenli (belirsiz) sayılır; devirden sonra eski
  listedeki kaydın kapatılması liste eşdeğerlik testiyle ayrıca ele alınır.
- **Uygulama notu (2026-11-05; karar içeriği değişmedi):** liste tarafı devri makinece okunur bir alanla tanır. Eski ülkenin
  kayıt aracı (`rp-status <dns_name> REVOKED --reassigned-to <CC> --approval <onay>`) kaydı `REVOKED` yapar ve geçmiş girdisine
  yapılı `reassigned_to: "<CC>"` yazar (gerekçe metni ayrıca kalır ama karar için okunmaz). Yükleyici (`@tamga-network/trust`
  0.8.1) aynı `dns_name`'in iptal edilmemiş tek kaydını ancak öteki bütün kayıtların son `REVOKED` girdisi `reassigned_to` ile
  onun ülkesini gösteriyorsa alır; aksi hâlde ad belirsizdir (`null`, kapalı güvenli). `SUSPENDED` iptal edilmemiş sayılır;
  hepsi iptalse durumu en son değişen kayıt döner. Başka ülkede iptal sonrası yeniden kayıt (RO2) ağ düzeyinde kayıt gelene
  kadar belirsiz kalır. Ayrıntı [[SPEC-TRUST-0001]] §6–§7; zincir–liste eşdeğerlik testinde fark 0.

# Durum

**Accepted — 2026-11-04.** Proje yönetiminin onayıyla (birebir alıntı özel onay kaydında): seçenek (a), öneriyle. DECISIONS:
D-BC-14. RO1–RO5 bağlayıcıdır. Uygulama: `RelyingPartyRegistry`, `Governance`, liste yayıncısının kayıt aracı ([[SPEC-BC-0001]]
sürüm notu).
