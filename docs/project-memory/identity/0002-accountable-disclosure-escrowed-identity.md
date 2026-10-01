---
document_id: PM-ID-0002
title: Accountable Disclosure ve Escrowed Identity — Eşikli (Threshold) Yetki Modeli
category: Identity
domain: Identity
status: Draft
review_status: Draft
version: 0.3.0
created: 2026-07-29
last_updated: 2026-08-05
authors:
  - Tamga Network Engineering
language: tr
document_type: project-memory
audience:
  - engineers
  - architects
  - ai-agents
stability: Evolutionary
maturity: Developing
tags:
  - accountable-disclosure
  - escrowed-identity
  - threshold-cryptography
  - privacy
  - governance
  - audit
keywords:
  - accountable anonymity
  - escrowed identity
  - threshold cryptography
  - DKG (distributed key generation)
  - threshold ElGamal
  - M-of-N
  - warranted disclosure
  - audit log
  - HSM
  - single point of failure
related:
  - PM-ID-0001
  - PM-TRUST-0001
  - PM-BC-0001
  - PM-PH-0001
  - ADR-0002
  - SPEC-BC-0002
  - SPEC-ID-0001
research:
  - RS-EIDAS-0001
  - RS-EBSI-0001
references:
  - DKG + Threshold ElGamal
  - Threshold Cryptography
  - Legal Disclosure / Guardian / Vault / Policy Engine (içselleştirilmiş)
  - CBDC tiered/warranted disclosure
summary: >
  Kimlik-adres eşleştirmesinin nasıl korunacağını ve gerektiğinde nasıl
  açıklanacağını karara bağlar. Karar (2026-08-05): çözme eşiği **3-of-5**,
  devlet-bazlı kurumsal 5'li (yargı, veri-koruma, nüfus/kimlik otoritesi,
  ombudsman, parlamento-atamalı) + "3 onaydan ≥1'i yürütme-dışı" kuralı;
  kripto **DKG + threshold ElGamal** (anahtar yeniden kurulmaz). **Escrow
  enrollment:** iki katmanlı (kök + pseudonym) verifiable-encryption escrow;
  makbuzsuz pseudonym ağ-geçersiz. **Acil durum modu:** 2-of-5 + 48s geriye-dönük.
  Mahkeme kararı = kriptografik token; her sorgu değiştirilemez audit log; DB
  e-Devlet'ten izole. Egemenlik = home-state ([[ADR-0002]]). Amaç: accountable
  anonymity. Tam kontrat/protokol yüzeyi → [[SPEC-BC-0002]]. Sınır-ötesi = tabiyet
  ilkesi + "Kim/Ne" ayrık-anahtar. İdari eşleme PM-GOV-0001.
priority: Critical
---

# Giriş

Bu doküman, [[PM-ID-0001]]'de tanımlanan **cüzdan-vatandaş eşleştirmesinin** (adres ↔ gerçek kimlik) nasıl korunacağını ve gerektiğinde **nasıl açıklanacağını** karara bağlar.

> **Durum notu (2026-08-06):** Çekirdek model artık **kararlaştırılmıştır** — eşik **3-of-5** (kurumsal 5'li + yürütme-dışı kuralı), kriptografik yön **DKG + threshold ElGamal (anahtar yeniden kurulmaz)**, egemenlik **home-state** ([[ADR-0002]]). Kontrat/protokol yüzeyi [[SPEC-BC-0002]]'ye taşınmıştır. **Sınır-ötesi açıklama** bölümü ilkeler seviyesinde nettir; N kurumlarının somut idari tanımı ve operasyonel anlaşmalar PM-GOV-0001 ile tamamlanacaktır.

Temel: [[PM-TRUST-0001]] (kişisel veri/eşleştirme zincirde değil), [[PM-ID-0001]] (kimlik modeli), ve içselleştirilmiş Legal Disclosure / Guardian / Vault / Policy Engine araştırması (arşiv: `_archive/solidus-workspace/`).

---

# Problem (Doğru Çerçeve)

Amaç **devletten gizlemek değildir** — devlet gerçek hayatta kimliği zaten görebilir. Asıl çözülecek:

- e-Devlet gibi sistemlerin **manipüle edilmesi**,
- **veri hırsızlığı**,
- **insan/içeriden kaynaklı** kötüye kullanım,
- ve **tek nokta çökmesi (single point of failure)**.

İki naif seçenek de yetersizdir:

1. **Devlete komple açık/anlık erişim:** Tek bir ihlal noktası (devlet sistemi hacklenirse) tüm mahremiyet modelini çökertir. SD-JWT ile kurumlardan gizlediğimiz şeyi tek kapıdan sızdırırız.
2. **Sadece "mahkeme kararıyla" (kağıt üstünde):** Sistemi hackleyen ya da içeriden kötüye kullanan biri, kağıda ihtiyaç duymadan zaten her şeyi görür. Kural sadece kağıtta kalır.

Bu yüzden üçüncü, **teknik olarak zorunlu kılınmış** bir yol gerekir.

---

# Karar — Eşikli (Threshold) Escrowed Identity

## İlke
> Kimlik-adres eşleştirmesi hiçbir zaman tek bir yerde açık tutulmaz; çözme işlemi **hiçbir tek aktör tarafından tek başına** yapılamaz.

## Bileşenler

**1. Şifreli eşleştirme.** Adres ↔ gerçek kimlik ilişkisi yalnızca şifreli halde saklanır; düz metin hiçbir yerde durmaz. Şifreleme **threshold ElGamal** açık anahtarı ile yapılır; karşılık gelen özel anahtar hiçbir zaman tek bir yerde birleşmez.

**2. Eşik: 3-of-5, kurumsal 5'li (KARAR, 2026-08-05; 2026-08-05 revize).** Guardian seti **devlet bazlıdır** (ağ-bazlı değil): her devletin kendi eşik anahtarı vardır ve yalnızca kendi vatandaşlarını çözer. Kompozisyon **erkler ayrılığı** üzerine kurulur:

| # | Guardian koltuğu | Neyi temsil eder | Yürütme? |
|---|------------------|------------------|----------|
| 0 | **Yargı** (üst mahkeme/hâkimler kurulu atamalı) | Hukuki dayanak denetimi | Hayır |
| 1 | **Veri koruma otoritesi** (KVKK muadili) | Orantılılık & mahremiyet | Hayır |
| 2 | **Nüfus/kimlik otoritesi** | Teknik/operasyonel yürütme | **Evet** |
| 3 | **Ombudsman** (Kamu Denetçiliği) | Bireyin hakkının savunusu | Hayır |
| 4 | **Parlamento atamalı bağımsız üye** | Demokratik hesap verebilirlik | Hayır |

**Yürütme-dışı koltuk kuralı:** 3 onayın **en az 1'i yürütme-dışı** koltuktan gelmeli; ayrıca yürütme koltuğu sayısı < eşik. Önerilen sette yürütme (1 koltuk) tek başına asla eşiğe (3) ulaşamaz — mekanizma "hükümetin istediği zaman açtığı kapı" olmaktan çıkar.

> **Revizyon notu:** Önceki taslaktaki *custodian* ve *teknik operatör* artık **oy veren guardian koltuğu değildir.** Ağ işletmecisinin (vakıf) bir devletin vatandaşını açma kararına oyu karışamaz (egemenlik). Teknik saklama ayrı katmandır: her kurum kendi payını **DKG** ile tutar; operasyon 5 kuruma dağıtıktır. Kompozisyon egemendir (her devlet kendi setini seçer) ama on-chain **yayınlanması zorunludur** — diğer devletler `setRecognition`'da buna bakar (piyasa disiplini).

**Kriptografik yön (KARAR, netleştirildi):** **DKG (Distributed Key Generation) + threshold ElGamal.** Anahtar hiçbir aşamada, hiç kimsede tam hâliyle bulunmaz (DKG); açma **threshold decryption**'dır — paylar birleştirilip anahtar **yeniden kurulmaz** (naif "reconstruct-then-decrypt" Shamir deseni tek-nokta zafiyetidir, yasak). Her guardian kendi payıyla kısmi çözüm üretir, sonuç birleşir. Rotasyon proaktif resharing ile (anahtar değişmez). Homomorfik ihtiyaç olursa Paillier değerlendirilir. Nihai primitif ([[SPEC-BC-0002]] §12) bağımsız denetimle kesinleşir.

**3. Mahkeme kararı = kriptografik yetki token'ı.** Hâkim soyut bir "izin veriyorum" kağıdı imzalamaz; imzası doğrudan sistemdeki bir **anahtar payını devreye sokan** kriptografik işlemdir. Süreç hukuki ve teknik olarak birbirine kenetlidir — kağıt var ama sistemde karşılığı yoksa sorgu çalışmaz.

**4. Değiştirilemez audit log.** Her sorgu append-only bir denetim kaydına düşer (ideal: zincirde bir "access-log" kontratı). "Kim, ne zaman, hangi mahkeme kararıyla, kime baktı" her zaman cevaplanabilir. Bu, kötüye kullanımı hem **caydırır** hem **iz bırakır**. Devletin kendi kullanımı da sonradan denetlenebilir.

**5. İzolasyon (air-gap / HSM).** Eşleştirme veritabanı, genel e-Devlet altyapısından **fiziksel/mantıksal olarak ayrıdır**; ayrı/izole ağda, HSM ile korunan anahtarlarla çalışır. Genel devlet IT'sindeki bir zafiyet bu sisteme sıçramaz.

**6. Rate limiting / anomali tespiti.** "Bir kullanıcı kısa sürede çok fazla kimlik sorguluyor" gibi davranışsal anomaliler erken uyarı verir; hem dış saldırı hem içeriden kötüye kullanıma karşı.

## Sonuç
Devlet **nihai olarak her zaman erişebilir** (egemenlik/yargı gücünden ödün yok) **ama hiçbir tek aktör tek başına, izsiz erişemez.** Akademik ad: **accountable anonymity / escrowed identity**; gerçek dünyada CBDC'lerde **tiered/warranted disclosure** olarak kullanılır.

## Escrow Enrollment — Pseudonym Nasıl Açılabilir Hale Gelir (KARAR, 2026-08-05)

Pseudonym'ler cüzdanda kökten türetilir ve unlinkable'dır; bir guardian setinin sonradan açabilmesi için bağ **türetim anında** şifreli escrow'a yazılmalıdır. İki katmanlı model:

- **Kök escrow** (onboarding'de bir kez): `Enc(PK_state, gerçekKimlik ‖ rootCommit)`.
- **Pseudonym escrow** (her türetimde): cüzdan `Enc(PK_state, rootCommit ‖ P_i)` üretip home-state Escrow Store'a yükler, imzalı **makbuz** alır.
- **Anti-kaçış:** bir pseudonym ancak geçerli makbuzla **ağ-geçerlidir** (issuer/RP escrow'suz pseudonym'i kabul etmez).
- **Verifiable encryption (zorunlu):** cüzdan çöp ciphertext yükleyip açılamaz pseudonym üretemez — doğru şifreleme NIZK ile kanıtlanır.
- Ciphertext **off-chain** ([[PM-TRUST-0001]]); zincirde yalnızca commitment.

Açma: `H(P_i)` → `E_i` threshold-decrypt → `rootCommit` → `E_root` threshold-decrypt → gerçek kimlik. İki pseudonym'i ilişkilendirmek bile ayrı ayrı threshold + yetki ister → unlinkability korunur. Tam mekanizma: [[SPEC-BC-0002]] §4.

## Acil Durum Modu (KARAR, 2026-08-05)

Çocuk kaçırma/aktif terör gibi vakalar için: **2-of-5 geçici açma + 48 saat içinde tam 3-of-5 geriye-dönük onay ZORUNLU**; sağlanmazsa otomatik iptal + kalıcı alarm + zorunlu erken bildirim. Bu mod olmadan devletler paralel arka kapı ister; bu yüzden mekanizmanın parçası ama sıkı denetime bağlı. Detay: [[SPEC-BC-0002]] §8.

---

# İçselleştirilen Mimari (önceki araştırmadan)

Bu model yeni değil; önceki olgun kimlik araştırmasının bileşenlerinin somut uygulamasıdır (ham kaynak arşivde):

| Bileşen | Bu modeldeki rolü |
|---------|-------------------|
| **Legal Disclosure** | Kimlik doğrulama ≠ açıklama; mahremiyet varsayılan, açıklama istisna; karar tek aktöre bağlı değil |
| **Guardian Model** | Dağıtık güven = M-of-N kurumlar; guardian yönetici değil, yalnızca koşullu doğrulamaya katılır |
| **Identity Vault** | Şifreli saklama + HSM izolasyon katmanı |
| **Policy Engine** | "Hangi koşulda, kaç onayla açılır" kararını veren kural motoru |

---

# Çifte Vatandaşlık ile İlişki

[[PM-ID-0001]] §6.1: PID'ler varsayılan **unlinkable**. İki PID'in aynı kişiye ait olduğunun ortaya çıkması (linking) **yalnızca bu threshold mekanizmasıyla** ve yasal gerekçeyle mümkündür. Yani çifte vatandaşlık köprüsü de bir accountable-disclosure olayıdır.

---

# Sınır-Ötesi Açıklama (KARARLAŞTIRILDI — Assurance Guardian MD resmileştirildi)

"Assurance Guardian" girdi belgesi geldi ve [[SPEC-BC-0002]]'ye eritildi. Karar:

- **Tabiyet ilkesi (nationality principle), ülkesellik DEĞİL:** Bir vatandaşın pseudonym'ini **yalnızca kendi devleti** çözer. Olay yeri devleti (ör. KZ) tek taraflı açtıramaz — talep eder, karar home-state'indir. Kriptografik: escrow home-state `PK_state` altında; başka devletin anahtarı çözemez.
- **"Kim/Ne" ayrık-anahtar:** "Kim?" (pseudonym→kimlik) = tabiyet devleti anahtarı; "Ne oldu?" (olay bağlamı) = olay yeri devleti anahtarı. Hiçbir taraf tek başına tam dosyaya sahip olamaz → ortak yürütme **yapısal zorunluluk**.
- **Mutlak ret hakkı:** Talep edilen devlet gerekçesiz reddedebilir; ağ seviyesinde temyiz mercii yoktur (egemenlik).
- **MLAT dijitalleştirmesi:** Adli yardımlaşmanın hızlandırılmış (ay→gün/saat) ve denetlenebilir hali; hukuki eşik korunur.
- Operasyonel detay (idari kurum eşlemesi, anlaşma metinleri) → PM-GOV-0001.

---

# İlkeler

1. **Mahremiyet varsayılan, açıklama istisna.**
2. **Tek nokta yok (no single point of failure).**
3. **Egemenlik korunur** — devlet nihai olarak erişebilir.
4. **İz bırakır, caydırır** — her erişim denetlenebilir.
5. **İzolasyon** — kimlik eşleştirme genel IT'den ayrı.

---

# Açık Sorular

1. ~~**M/N değerleri:**~~ **KAPANDI: 3-of-5, kurumsal 5'li + yürütme-dışı kuralı** (bkz. §Karar #2).
2. **N kurumları somut kimler:** Türkiye'de yukarıdaki 5 role hangi tüzel kurumlar eşlenir (yargı mercii, KVKK, Nüfus/NVİ, Kamu Denetçiliği, parlamento-atamalı üye)? → [[PM-GOV-0001]].
3. ~~**Pay rotasyonu:**~~ **KAPANDI: proaktif resharing** (anahtar değişmeden pay yenileme, on-chain loglanır) — [[SPEC-BC-0002]] §3.
4. ~~**Acil durum erişimi:**~~ **KAPANDI: 2-of-5 + 48s geriye-dönük onay** — [[SPEC-BC-0002]] §8. (Hukuki çerçeve → PM-GOV-0001.)
5. ~~**Sınır-ötesi M/N:**~~ **KAPANDI: tabiyet ilkesi + "Kim/Ne" ayrık-anahtar** — bkz. §Sınır-Ötesi, [[SPEC-BC-0002]] §6.
6. **Verifiable encryption primitifi:** Escrow enrollment'ta doğru şifreleme kanıtının somut NIZK şeması → bağımsız kripto denetimi ([[SPEC-BC-0002]] §12).
7. **Referans araştırma:** CBDC tiered disclosure, threshold kripto uygulamaları → RS-DISCLOSURE-0001 (planlı).

---

# İlişkiler / İlgili Dokümanlar

- [[PM-ID-0001]] — Kimlik modeli, cüzdan-vatandaş bağı (bu dokümanın temeli).
- [[PM-TRUST-0001]] — Eşleştirme zincirde değil.
- [[PM-BC-0001]] — Audit-log kontratı için zincir.
- [[PM-GOV-0001]] (planlı) — N kurumlarının tanımı, hukuki-teknik köprü, sınır-ötesi anlaşmalar.
- **Kaynak (arşiv):** `_archive/solidus-workspace/project-memory/identity/` — Legal Disclosure, Guardian, Vault, Policy Engine (içselleştirilmiş).
- **Beklenen girdi:** sınır-ötesi açıklama girdi belgesi.

---

# Durum

**review_status: Draft.** Model **kararlaştırıldı ve derinleştirildi** (2026-08-05, Assurance Guardian MD resmileştirildi): şifreli eşleştirme, **3-of-5 kurumsal 5'li + yürütme-dışı kuralı** (yargı/veri-koruma/nüfus-otoritesi/ombudsman/parlamento-atamalı), **DKG + threshold ElGamal** (reconstruction yok), **iki katmanlı verifiable-encryption escrow enrollment** (makbuzsuz pseudonym ağ-geçersiz), **acil durum modu** (2-of-5 + 48s), **tabiyet ilkesi + Kim/Ne ayrık-anahtar** sınır-ötesi, gecikmeli bildirim tavanı, recognition-leverage yaptırımı. Mahkeme=kripto token, değiştirilemez audit log, HSM izolasyon. Tam kontrat/protokol yüzeyi → [[SPEC-BC-0002]] (v2.0.0). Açık kalan: N kurumlarının idari eşlemesi + acil-mod hukuki çerçevesi → PM-GOV-0001; verifiable-encryption/court-token primitifleri → bağımsız kripto denetimi.
