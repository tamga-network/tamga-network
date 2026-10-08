---
document_id: PM-ID-0001
title: Kimlik Modeli — Root Identity, Cüzdan-Vatandaş Bağı ve Çok-Ülkeli Yapı
status: Draft
version: 1.0.0
created: 2026-07-29
last_updated: 2026-10-07
summary: >
  Tamga'nın kimlik modelinin temelini kaydeder. Önceki olgun kimlik
  araştırmasından içselleştirilen Root Identity ilkesini (kimlik ≠ cüzdan/anahtar) benimser; "cüzdan kimin?"
  problemini onboarding'de devletin PID Provider olarak temel kimlik vermesiyle
  çözer; çok-ülkeli yapıda her devletin kendi vatandaşları için egemen PID
  Provider olmasını ve sınır-ötesi tanımanın ortak trust registry üzerinden
  yürümesini tanımlar. Escrowed binding ve accountable disclosure PM-ID-0002'ye
  havale edilir.
---

# Giriş

Bu doküman Tamga'nın **kimlik modelinin temel kararlarını** kaydeder. Üç soruyu cevaplar:

1. Dijital ortamda bir varlığı ne temsil eder? (Root Identity)
2. Bir cüzdanın kime ait olduğunu nasıl tespit ederiz? (Wallet-citizen binding)
3. Çok-ülkeli yapıda her devlet kendi vatandaşlarını nasıl bilir; sınır-ötesi işlemler nasıl olur?

Bu kararlar, önceki olgun kimlik araştırmasından içselleştirilmiştir (Root Identity, Guardian, Legal Disclosure, Recovery, Vault, Policy Engine). Ham kaynak arşivde saklanır: `_archive/solidus-workspace/project-memory/identity/`.

> **Not:** Accountable disclosure / escrowed identity (threshold M-of-N, mahkeme-kriptografik token, audit log, HSM ayrımı) bu dokümanın kardeşi olan [[PM-ID-0002]]'de ele alınır. Kurtarma/guardian/vault ise PM-ID-0003'te (planlı).

---

# Problemin Yeniden Çerçevelenmesi

Tamga'nın kimlik/mahremiyet problemi **"devletten gizlemek" değildir.** Devlet gerçek hayatta zaten kimliği görebilir. Asıl çözülmesi gereken:

- e-Devlet gibi sistemlerin **manipüle edilmesini** önlemek,
- **veri hırsızlığını** önlemek,
- **insan/içeriden kaynaklı riskleri** ve **tek nokta çökmesini (single point of failure)** ortadan kaldırmak.

Bu çerçeve, tasarımın hedefini belirler: devletin egemen erişimi korunur, ancak hiçbir tek sistem/kişi tüm mahremiyeti tek başına çökertemez. (Detay: [[PM-ID-0002]].)

---

# 1. Devralınan Temel: Root Identity (Kimlik ≠ Cüzdan)

Kimlik modelinin en temel ilkesi (Root Identity) Tamga'ya aynen taşınır:

- Bir özel anahtar **yalnızca erişim yöntemidir**, kimliğin kendisi değil.
- **Kimlik kaybolmaz; kaybolan yalnızca erişim yöntemidir.**
- Anahtarlar, cüzdanlar, credential'lar değişebilir; **Root Identity kalıcıdır** (Identity Continuity).
- Root Identity birey, kurum, kurum, cihaz veya servisi temsil edebilir.

**Sonuç:** "Cüzdan kimin?" sorusunu cüzdan adresine bakarak değil, o cüzdanın taşıdığı/bağlı olduğu **kök kimliğe** bakarak cevaplarız.

---

# 2. Cüzdan-Vatandaş Bağı (Wallet-Citizen Binding)

## Bağ ne zaman kurulur? — Onboarding
Bağ, kullanıcı sisteme katılırken (onboarding) kurulur. Model EUDI'nin **PID Provider**'ıyla aynıdır ([[RS-EIDAS-0001]] §2):

> **Devlet, vatandaşına temel kimliği (PID — Person Identification Data) verir.**

Bu an, güçlü kimlik ispatı gerektirir (Türkiye'de: e-Devlet, TC Kimlik No, gerektiğinde biyometrik doğrulama). Bu adımda "bu gerçek kişi = bu Root Identity" ilişkisi kurulur ve devlet tarafından imzalı bir **PID credential**'ı olarak cüzdana verilir.

## "Cüzdan kimin?" nasıl cevaplanır?
- Teknik cevap: cüzdanın taşıdığı, **devletçe imzalanmış geçerli PID credential**'ıyla.
- Doğrulama: PID'in imzası + issuer'ın (devletin) zincirdeki trust kaydı (ACA-ID-0001 §8, [[PM-TRUST-0001]]).
- Adres ↔ gerçek kimlik eşleştirmesi **zincirde tutulmaz** ([[PM-TRUST-0001]]). Gerekirse **escrow** edilir (şifreli, M-of-N) — devlet kurumlarında, off-chain ([[PM-ID-0002]]).

---

# 3. Çok-Ülkeli Model — Her Devlet Kendi Vatandaşının Egemeni

## İlke
> **Her devlet, kendi vatandaşları için PID Provider'dır.**

- "Benim vatandaşım" = "benim verdiğim geçerli PID'yi taşıyan kimlik."
- Vatandaş kaydı (bugünkü e-Devlet gibi) ve o vatandaşlara ait escrow eşleştirmesi **o devletin kurumlarında** kalır.
- Ortak ağ **birleşik bir vatandaş veritabanı değildir**; birlikte çalışabilirlik katmanıdır.

## Pasaport Analojisi
Türkiye Türk pasaportu verir, Azerbaycan kendininkini. Ortak sistem pasaportun **karşılıklı tanınmasını** sağlar; ama **kimin Türk olduğuna Türkiye karar verir.** Vatandaşlık egemenliği korunur.

## Legal Disclosure ilkesiyle bağ
Legal Disclosure ilkesi "hukuki süreçler teknik mimariyi belirlememeli; farklı yargı alanlarına uyarlanabilir olmalı" der. Bu, çok-ülkeli yapı için kritiktir: her devletin hukuku/politikası kendi vatandaşına uygulanır, ortak teknik mimari değişmez.

---

# 4. Sınır-Ötesi (Cross-Border) İşlemler

## Tanıma (recognition)
A ülkesi vatandaşı, B ülkesindeki bir verifier'a belge sunduğunda:
- B kontrol eder: "bu belgeyi veren (A'nın PID provider'ı veya A-akredite issuer) güvenilir mi?" → **zincirdeki ortak trust registry** (RS-EBSI-0001 §4).
- Güvenilirse B belgeyi kabul eder. Bu, EBSI'nin sınır-ötesi modelinin aynısıdır.

## Açıklama (disclosure) egemenliği
A vatandaşının gerçek kimliği açılacaksa (adli süreç), **egemenlik gereği A'nın kurumları threshold'da olmalıdır** — B tek başına A'nın vatandaşını deşifre edemez. Sınır-ötesi açıklama, uluslararası adli yardım benzeri bir **yönetişim/anlaşma** konusudur ve threshold politikasında kodlanır ([[PM-ID-0002]], [[PM-GOV-0001]]).

---

# 5. Escrowed Binding ve Accountable Disclosure (Özet)

Adres↔kimlik eşleştirmesi gerektiğinde açılabilmeli ama kötüye kullanıma/hırsızlığa kapalı olmalı. Çözüm (detay [[PM-ID-0002]]):
- Eşleştirme **şifreli**, tek yerde açık değil.
- Çözme **3-of-5 threshold** (kurumsal 5'li: yargı, veri-koruma, nüfus/kimlik, ombudsman, parlamento-atamalı; ≥1 onay yürütme-dışı) gerektirir; tek aktör yapamaz. Kripto: DKG + threshold ElGamal (anahtar yeniden kurulmaz). Detay [[PM-ID-0002]].
- Mahkeme kararı = **kriptografik yetki token'ı** (kağıt değil, sistemde karşılığı olan işlem).
- Her sorgu **değiştirilemez audit log**'a düşer.
- Eşleştirme veritabanı genel e-Devlet altyapısından **izole** (air-gapped / HSM).

Bu, Guardian + Legal Disclosure + Vault + Policy Engine mimarisinin somut uygulamasıdır.

---

# 6. Çözülen Kararlar (2026-07-29)

## 6.1 Çifte Vatandaşlık — Hibrit Model
Bir kişi birden fazla üye devletin vatandaşı olabilir; her devlet ona **bağımsız bir PID** verir (cüzdan birden fazla PID taşır).

- **Varsayılan: unlinkable.** PID'ler birbirine bağlı değildir; bir devlet, vatandaşının başka bir üye devlette de vatandaş olduğunu göremez. (Mahremiyet varsayılan.)
- **İstisna: accountable disclosure ile köprü.** Yalnızca yasal gerekçeyle, [[PM-ID-0002]]'deki threshold mekanizmasıyla PID'ler bağlanabilir.
- **Tekillik:** Devlet-içi tekillik garanti (bir kişi = bir Türk PID). Devletler-arası tekillik yalnızca disclosure ile sağlanır — bu, mahremiyet lehine bilinçli bir ödünleşimdir.
- Gerekçe: tüm mimarinin "accountable anonymity / mahremiyet varsayılan, açıklama istisna" ilkesiyle tutarlı (Legal Disclosure çizgisi).

## 6.2 Assurance Seviyeleri — Kendi Sistemimiz, eIDAS'a Eşlenir

> **Kanonik tanım artık [[PM-ASSUR-0001]]'dedir.** Bu bölüm ilkeyi kaydeder; seviyelerin
> (holder **T0–T3** × issuer **I1–I3**, çarpım kuralı), devletsiz bootstrap'ın ve eIDAS
> eşlemesinin tam tanımı PM-ASSUR-0001 + [[ADR-0005]]'te yapılır. Aşağıdaki metin o
> dokümanın çıkış noktasıdır.

Devletlerin verdiği kimliklerin güven seviyesi eşit olmayabilir; bu yönetilmelidir.

- **Kendi seviyelerimizi tanımlarız** (kendi isim/kriterlerimiz; içeride kimlik-ispatı ve authenticator'ı NIST 800-63 gibi **ayrı** ele alma opsiyonu — daha esnek).
- **eIDAS LoA'ya 1:1 eşlenir** (Low / Substantial / High). Sınırda EUDI/EBSI verifier bizim seviyemizi eIDAS karşılığıyla anlar → **interop kaybı yok** ("uyumlu ama bağımsız", [[PM-PH-0001]]).
- **eIDAS mantığı (referans):** seviye üç boyutun *en zayıf halkasıyla* belirlenir — (1) kayıt/kimlik ispatı, (2) kimlik aracı gücü, (3) doğrulama gücü. High için her üçü de High olmalı.
- PID için taban seviye önerisi: **Substantial**.
- **Ortak akreditasyon şart:** bir devletin iddia ettiği seviyeyi gerçekten karşıladığını denetleyen mekanizma gerekir → [[PM-GOV-0001]].
- **Devletsiz dönem:** Devletler ağa katılmadan önce bu seviyeler mevcut kurumlardan devralınır (derived assurance); detay [[PM-ASSUR-0001]] §Devletsiz Bootstrap.
- Detaylı kriterler + iki eksenli model → [[PM-ASSUR-0001]] (kanonik); teknik taşıyıcı → [[SPEC-CRED-0001]].

---

# 7. Açık Sorular / Ertelenenler

1. **Sınır-ötesi açıklama/escrow:** Ayrı bir girdi belgesi hazırlanıyor. Karar ertelendi; ancak **tasarım kısıtı:** ağın escrow/threshold yapısı, çok-yargı-alanı (multi-jurisdiction) paylarını destekleyecek biçimde **şimdiden esnek** kurulmalı. MD gelince [[PM-ID-0002]]'ye işlenecek.
2. **Vatandaş olmayanlar:** Gözlemci ülkeler, mülteciler, vatansızlar, turistler → host-devlet/yetkili kurum tarafından **düşük-LoA misafir kimliği**. Önce vatandaşlar; bu **sonraya** ertelendi.
3. **Kurumsal/nesne kimlikleri:** Kurum → tescil edildiği devlete; nesne → sahibinin/tescilin devletine. **Sonraya** ertelendi.
4. **Assurance kriter detayları:** → SPEC-ID.
5. **Onboarding / kimlik ispatı yöntemi (2026-07-29):** Kayıt anında kimlik nasıl ispatlanır?
   - Seçenek A — **Uygulama içi ispat:** kimlik tarama (ön/arka), selfie/canlılık (liveness), belge OCR. (Uzaktan, ölçeklenebilir; LoA orta-yüksek.)
   - Seçenek B — **Devletin doğrudan vermesi:** temel kimlik devletçe verilir. *Nasıl?* e-Devlet entegrasyonu / NFC'li kimlik kartı okuma / SMS-mail doğrulama? → **araştırma gerekiyor** (RS-PID-ISSUANCE planlı; EUDI PID Rulebook + eID kart NFC yöntemleri incelenecek).
   - Muhtemel sonuç: LoA'ya göre karma (yüksek LoA için NFC'li eID/e-Devlet; orta için selfie+belge). Bu, assurance seviyeleriyle ([[#6.2]]) doğrudan bağlı. **Fikirsel karar bekliyor, engel değil.**

---

# İlişkiler / İlgili Dokümanlar

- [[PM-PH-0001]] — Vizyon; katmanlı model, Türk dünyası.
- [[PM-TRUST-0001]] — Kişisel veri/eşleştirme zincirde değil.
- [[PM-ID-0002]] (planlı) — Accountable Disclosure & Escrowed Identity (threshold model).
- PM-ID-0003 (planlı) — Recovery, Guardian, Vault (kurtarma/kurtarma).
- [[PM-GOV-0001]] (planlı) — Devlet katılımı, sınır-ötesi açıklama yönetişimi.
- [[RS-EIDAS-0001]] — PID Provider modeli.
- RS-EBSI-0001 — Sınır-ötesi tanıma, trust registry.
- ACA-ID-0001 — DID/VC mekaniği.
- **Kaynak (arşiv):** `_archive/solidus-workspace/project-memory/identity/` — Root Identity, Guardian, Legal Disclosure, Recovery, Vault (içselleştirilmiş ham araştırma).

---

# Durum

**Taslak** — sürüm 1.0.0 (2026-10-02).

