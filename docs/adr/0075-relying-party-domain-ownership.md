---
document_id: ADR-0075
title: "Doğrulayıcı alan adı kimliğinin sahipliği ve iptal sonrası yeniden kayıt"
status: Proposed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  ADR-0073 K4 doğrulayıcı kimliğini `rpId = keccak256(dns_name)` yaptı. Kontratta bu kimlik onu ilk kaydeden devletindir; başka
  bir devlet, alan adı kendisine ait olmayan bir doğrulayıcıyı önce kaydederek kimliği kapabilir ve iptal edilmiş bir kimlik bir daha
  hiç kaydedilemez. Öneri: (a) Governance'ın türü belli bir anlaşmazlık / devir önerisiyle (2/3) kimliğin sahibi değiştirilir;
  iptalden sonra yeniden kayıt yalnız Governance oyuyla açılır. Alternatif (b): alan adı sahipliğinin DNS kanıtıyla zincir dışında
  denetlenmesi + Governance onayı. Önerilen (a).
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

# Sonuçlar (kabul edilirse)

- `RelyingPartyRegistry` ve `Governance`: yeni türü belli öneri ve yalnız Governance'ın çağırabildiği devir / yeniden kayıt yolu;
  kayıt dönemi sayacı; depolama düzenine yalnız sona ekleme.
- [[SPEC-BC-0001]] §6 ve §16; liste yayıncısının kayıt aracı ve `TrustSource` eşdeğerlik testi.
- Kabul edilene kadar kontrat davranışı değişmez; kayıt kurumu alan adı sahipliğini kayıttan önce denetlemeye devam eder.

# Durum

**Proposed — 2026-11-04.** Proje yönetiminin kararını bekliyor (2026-11-04 kontrat güvenlik turu bulgusu).
