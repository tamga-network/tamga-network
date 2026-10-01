---
document_id: PM-ASSUR-0001
title: İki Eksenli Assurance Modeli ve Devletsiz Bootstrap
category: Identity
domain: Assurance
status: Draft
review_status: Draft
version: 1.1.1
created: 2026-09-03
last_updated: 2026-09-26
authors:
  - Tamga Network Engineering
language: tr
document_type: project-memory
audience:
  - engineers
  - architects
  - product
  - ai-agents
stability: Evolutionary
maturity: Developing
tags:
  - assurance
  - level-of-assurance
  - derived-assurance
  - stateless-bootstrap
  - issuer-assurance
  - wallet-assurance
  - trust-framework
keywords:
  - two-axis assurance
  - holder assurance T0-T3
  - issuer assurance I1-I3
  - derived assurance
  - stateless bootstrap
  - e-imza NES challenge
  - eIDAS LoA mapping
  - verifier policy engine
  - assurance decay
related:
  - PM-PH-0001
  - PM-ID-0001
  - PM-ID-0002
  - PM-TRUST-0001
  - SPEC-CRED-0001
  - SPEC-BC-0001
  - ADR-0004
  - ADR-0005
  - RS-EIDAS-0001
  - RS-EBSI-0001
depends_on:
  - PM-ID-0001
adrs:
  - ADR-0005
specs:
  - SPEC-CRED-0001
summary: >
  Tamga'nın güven seviyesi modelini kaydeder. Güven tek bir sayıya indirgenemez;
  iki bağımsız eksende ölçülür: Eksen A — Holder/Wallet Assurance (T0–T3, kişinin
  kimliği ne kadar güçlü doğrulandı) ve Eksen B — Issuer Assurance (I1–I3, belgeyi
  veren kurum ne kadar akredite). Verifier'ın kararı bu ikisinin ÇARPIMIDIR. Model,
  "devlet anlaşması olmadan güven üretilemez" varsayımını reddeder: Türkiye'de bugün
  e-imza/NES (T3), banka/GSM (T1), uzaktan KYC (T2) ile devralınabilir (derived)
  assurance mevcuttur. Bu, devletler ağa katılana kadar sistemin çalışmasını ve işlem
  yapmasını sağlayan DEVLETSİZ BOOTSTRAP katmanıdır. Kendi seviyelerimiz eIDAS LoA'ya
  1:1 eşlenir (interop kaybı yok). Assurance decay, verifier politika motoru ve
  kullanıcıya sunum ilkeleri tanımlanır.
priority: Critical
---
> **Sürüm notu 1.1.1 (2026-09-26):** "Bağlama yolu → holder seviyesi" tablosu ve ETSI TS 119 461 sütunu kabul edildi (DB-6 rev., DB-18) → **D-ASSUR-2**; "onay bekliyor" etiketleri kalktı. İçerik değişmedi.

> **Sürüm notu 1.1.0 (2026-09-24) — ADR-0009 / ADR-0010 senkronu (DECISIONS §10.7):** Politika örnekleri **'tip × issuer sınıfı'** olarak yeniden yazıldı (holder seviyesi credential'da yoktur — PR7; [[ADR-0010]] K5); sınıf sinyali tablosu (EAA/QUALIFIED/PUB); yeni bölüm 'Bağlama yolu → holder seviyesi' (DB-6 rev., ETSI 119 461 eşlemesi DB-18 onay bekliyor). T0–T3 ve I1–I3 tanımları değişmedi.


# Giriş

Bu doküman Tamga'nın **güven seviyesi (assurance) modelini** kaydeder ve tek bir soruya
cevap verir:

> **Devlet anlaşmamız yokken, bir cüzdanın/belgenin ne kadar güvenilir olduğunu nasıl
> ölçeriz — ve bu ölçüyü verifier'ın kararına nasıl çeviririz?**

[[PM-ID-0001]] §6.2 assurance seviyelerinin *var olacağını* ve eIDAS LoA'ya eşleneceğini
söylemişti ama seviyeleri **tanımlamamıştı**. Bu doküman o boşluğu kapatır ve iki şeyi
resmileştirir:

1. **İki eksenli assurance modeli** (holder T0–T3 × issuer I1–I3).
2. **Devletsiz bootstrap** — devletler ağa katılmadan önce (Faz 0, [[ARCH-0001]]) güveni
   mevcut kurumlardan **devralarak** çalışan katman.

> **Kapsam sınırı:** Credential formatı, holder binding ve Wallet Unit Attestation'ın
> *teknik* tanımı [[SPEC-CRED-0001]]'dedir; bu doküman *neden* ve *hangi seviye*
> sorularını yanıtlar, *nasıl* sorusunu değil.

---

# Problem

## 1. Teşhis: problem "doğrulama" değil, "trust anchor yokluğu"

En sık yapılan çerçeveleme hatası şudur: *"Kullanıcının gerçekten o kişi olduğunu nasıl
doğrularım?"* Hiçbir kimlik sistemi bunu sıfırdan çözmez — **eIDAS bile çözmez.**
eIDAS'ta kimlik tespitini üye devletin nüfus idaresi yapar; eIDAS'ın yaptığı, o tespiti
**taşınabilir ve doğrulanabilir** kılmaktır. EBSI de kimliği üretmez; akredite kurumların
ürettiği iddiaları zincirleyip doğrulanabilir kılar.

Dolayısıyla Tamga'nın işi doğrulama yapmak değil, **başkasının yaptığı doğrulamayı
devralmaktır.** Literatürdeki adı **derived assurance**'dır (devralınan güven).

**Sonuç:** "Devlet anlaşmam yok, o yüzden kimseyi doğrulayamam" önermesi yanlıştır.
Türkiye'de bugün, hiçbir devlet anlaşması olmadan devralınabilecek doğrulama kaynakları
vardır (bkz. §Devletsiz Bootstrap) ve bir kısmı hukuken oldukça güçlüdür. Eksik olan
erişim değil, bu kaynakların hangi seviyeye karşılık geldiğini tanımlayan **çerçevedir.**

## 2. Neden tek sayı olmaz

İkinci hata güveni tek bir puana indirgemektir. eIDAS bunu bilinçli olarak ikiye ayırır;
Tamga da ayırır:

- **Eksen A — Holder / Wallet Assurance:** Kişinin kimliği ne kadar güçlü doğrulandı ve
  anahtarları ne kadar güvenli saklanıyor?
- **Eksen B — Issuer Assurance:** Belgeyi veren kurum ne kadar akredite, ne kadar
  denetleniyor?

Verifier'ın kararı bu ikisinin **çarpımıdır, toplamı değil.** Yüksek doğrulanmış bir
kullanıcının akredite olmayan bir kurumdan aldığı diploma değersizdir; tersine, akredite
bir üniversitenin kime verdiğini bilmediği (T0) bir cüzdana yazdığı diploma da değersizdir.

---

# Mimari — İki Eksen

## Eksen A — Holder / Wallet Assurance (T0–T3)

| Seviye | Anlamı | Türkiye'de bugün nasıl (devletsiz) | eIDAS LoA karşılığı | Devlet gerekir mi |
|--------|--------|-----------------------------------|--------------------|-------------------|
| **T0 — Anonim** | Kimlik iddiası **yok**. Cihazda üretilmiş anahtar çifti + e-posta/telefon OTP. Takma adlı (pairwise) DID ([[SPEC-ID-0001]]). | Anında, self-service | (eşik altı) | Hayır |
| **T1 — Düşük** | Bir isme bağlı ama zayıf. | Banka hesabından mikro-transfer ile ad-soyad+IBAN eşleşmesi; veya GSM hat sahipliği doğrulaması | **Low** | Hayır |
| **T2 — Önemli** | Resmî kimlik belgesi görülmüş + canlılık/yüz eşleştirme. | (a) Lisanslı uzaktan kimlik tespiti; (b) NFC ile çipli pasaport + passive authentication; (c) **kurum kayıt masası** (üniversite/oda RA'sı) | **Substantial** | Hayır |
| **T3 — Yüksek** | Kriptografik olarak devlet-akredite kimliğe bağlı. | **Nitelikli Elektronik Sertifika (NES) / Mobil İmza ile challenge (nonce) imzalatma** | **High** | **Hayır** |

**eIDAS mantığı (referans, [[PM-ID-0001]] §6.2):** seviye üç boyutun *en zayıf halkasıyla*
belirlenir — (1) kayıt/kimlik ispatı, (2) kimlik aracı gücü (authenticator), (3) doğrulama
gücü. T3 için her üçü de en üst olmalı. Bu ayrımı içeride koruruz (NIST 800-63 tarzı
ayrık ele alma opsiyonu), dışarıya tek eIDAS LoA olarak sunarız.

### T3 yolu — en büyük ve en az fark edilen kaldıraç

Bir e-imza sahibinin kimliği, BTK tarafından lisanslanmış bir Elektronik Sertifika
Hizmet Sağlayıcısı (ESHS) tarafından **yüz yüze zaten tespit edilmiştir**; sertifikada
TCKN vardır. Tamga'nın yapması gereken:

1. Kullanıcıya rastgele bir nonce üret.
2. Kullanıcı bunu e-imzası/mobil imzasıyla imzalar.
3. İmza + sertifika zinciri, BTK'nın yayımladığı lisanslı ESHS kök sertifikalarına karşı
   doğrulanır.
4. Sertifikadaki kimlik ile cüzdan anahtarı bağlanır ([[SPEC-CRED-0001]] holder binding).

**Bu işlem için kimseden izin gerekmez.** Kök sertifikalar kamuya açıktır, doğrulama tek
taraflıdır. Devlet olmadan ulaşılabilecek en güçlü kimlik bağıdır ve pratikte eIDAS
**High**'a en yakın noktadır.

**Sınırı:** Bireysel e-imza sahipliği Türkiye'de düşüktür (ağırlıklı şirket yetkilileri,
avukatlar, mali müşavirler, akademisyenler, kamu çalışanları). Yani **birey tarafında
zayıf, kurumsal tarafta olağanüstü güçlü.** Bu gözlem doğrudan B2B önceliğine götürür
(bkz. [[PM-AUTH-0001]], gelecekteki PM-GTM).

## Eksen B — Issuer Assurance (I1–I3)

| Seviye | Kriterler | Örnek kurum |
|--------|-----------|-------------|
| **I1 — Kayıtlı** | Domain sahipliği doğrulanmış (`did:web`/DNS challenge). Sözleşme yok, kendi kendine katılmış. Verifier arayüzünde **"akredite değil"** görünür. | Bir bootcamp, bir dernek |
| **I2 — Sözleşmeli** | I1 + tüzel kişilik doğrulanmış (MERSİS + Ticaret Sicil Gazetesi), imza yetkilisi teyit, Tamga Trust Framework sözleşmesi, teknik conformance testi geçilmiş. X.509 issuer sertifikası ([[ADR-0004]], [[SPEC-ID-0002]]). | Şirket, özel okul, vakıf |
| **I3 — Akredite** | I2 + anahtarlar **HSM**'de, denetim + log yükümlülüğü, olay bildirimi SLA'i, yıllık gözden geçirme, tanımlı askıya alma prosedürü, sorumluluk sigortası. | Üniversite, meslek/ticaret odası, banka |

**Sınıf sinyali ([[ADR-0010]] K5, D-CRED-4) — eIDAS yapısı aynalanır:**

| Tamga sınıfı | Kim | Assurance | Credential `category` | AB muadili |
|---|---|---|---|---|
| **EAA** | I1–I2 issuer'lar | I1, I2 | *yok* | nitelikli olmayan EAA |
| **QUALIFIED** | Trust Framework'te akredite | I3 | `urn:tamga:eaa:qualified` | QEAA |
| **PUB** | Üye devlet kurumu / authentic source adına | (devlet) | `urn:tamga:eaa:pub` | PuB-EAA |

Verifier politikası **"tip × issuer sınıfı"** olarak ifade edilir; verifier ayrı bir `holder_assurance` alanı görmez — holder
seviyesi **tipin ön koşuludur** (eIDAS'ta PID = LoA High gibi). Bu, önceki politika örneğindeki `holder_assurance >= T2`
satırının iç çelişkisini kapatır (`docs/beta/05` R-19/R-22).

> **Not — IssuerCategory ≠ Issuer Assurance.** [[SPEC-BC-0001]] `IssuerCategory`
> (GOVERNMENT/EDUCATION/HEALTH/...) issuer'ın **sektörünü** söyler; I1–I3 ise
> **akreditasyon derecesini** söyler. İkisi diktir: bir EDUCATION issuer I1 de olabilir
> I3 de. Zincir kaydına issuer assurance seviyesi ayrı bir alan olarak eklenir
> (bkz. [[SPEC-BC-0001]] senkron notu).

## Verifier kararı = Eksen A × Eksen B

Verifier tek bir sayıya bakmaz; bir **politika** uygular. Karar holder seviyesi **ve**
issuer seviyesinin birlikte eşiği geçmesini gerektirir:

```
Politika: "ise_alim_diploma_dogrulama"
  gerekli:
    credential_type = MezuniyetBelgesi
    issuer_assurance >= I3          # ya da issuer_class = QUALIFIED
    # holder seviyesi credential'da YOKTUR (PR7, ADR-0010 K5): 'Diploma' tipi zaten T2+ ile bağlanmıştır (tipin ön koşulu — §Bağlama)
    status           =  aktif           # StatusList, SPEC-BC-0001 §5
    issuer           ∈  TrustedList[EDUCATION]
  istenen alanlar:
    [ad_soyad, universite, bolum, mezuniyet_yili, derece]
  istenmeyen:
    TCKN            ← veri minimizasyonu: talep etme
```

```
Politika: "staj_basvurusu"
  gerekli:
    credential_type  = OgrenciBelgesi
    issuer_assurance >= I2
    # holder seviyesi: 'OgrenciBelgesi' tipi T1+ ile bağlanmıştır (ön koşul)
    status           =  aktif
```

Bu politika motoru, [[ADR-0003]] Karar 4'teki `requiresCredential` credential-gating
primitifiyle aynı hattadır; assurance eşikleri o primitifin parametreleridir.

---

# Bağlama Yolu → Holder Seviyesi (issuer politikası; D-ASSUR-2)

Seviye credential'a yazılmaz; issuer, bağlama yoluna göre **hangi tipi vereceğine** karar verir ve yolu denetim kaydına
yazar ([[SPEC-PROTO-0001]]/PR7). Teknik profil: [[SPEC-ID-0003]].

| Bağlama yolu | Seviye | ETSI TS 119 461 (eşleme — D-ASSUR-2) | Verilebilen (eğitim) |
|---|---|---|---|
| E-posta offer + SMS `tx_code` (farklı kanal) | **T1** | Baseline | Öğrenci belgesi |
| OBS/portal ekranında offer (`on-screen`, tek faktör) | **T1** (MFA ise **T2**) | Baseline / Substantial | Öğrenci belgesi (T2 ise + diploma) |
| Lisanslı uzaktan kimlik doğrulama (belge + canlılık + yüz eşleştirme) | **T2** | Substantial | + Diploma |
| Kurum kayıt masası (yüz yüze, personel onayı) | **T2** | Substantial (in-person) | + Diploma |
| NES / Mobil İmza challenge (Faz 0+) | **T3** | High — yalnızca authorization code veya yüz yüze; pre-authorized ile **yasak** (ETSI 472-3 GEN-REQ-4.1) | tümü |

---

# Devletsiz Bootstrap (Faz 0 çalışma katmanı)

## İlke

Tamga'nın çok-devletli olgun modelinde ([[PM-ID-0001]]) her devlet kendi vatandaşının
**PID Provider**'ıdır ve en güçlü holder assurance oradan gelir. Ancak devletler ağa
katılana kadar ([[ARCH-0001]] Faz 1) sistemin **çalışması ve işlem yapması** gerekir. İki
eksenli model bunu mümkün kılar: yukarıdaki T0–T3 ve I1–I3 seviyelerinin **hiçbiri devlet
anlaşması gerektirmez.**

> **Devletsiz bootstrap tezi:** Güveni bugün mevcut Türk kurumlarından *devralarak*
> (e-imza/ESHS, bankalar, GSM operatörleri, üniversiteler, odalar) T3'e kadar assurance
> üretebiliriz. Devlet geldiğinde bu **yok olmaz**; PID Provider, T3'ün *yanına* daha
> yüksek kayıt-kalitesi ve daha geniş kapsam ekler ve varsayılan yüksek-LoA kaynağı olur.

## Devlet geçişi (Faz 0 → Faz 1)

| | **Faz 0 — Devletsiz** | **Faz 1 — Devlet katıldı** |
|--|----------------------|---------------------------|
| En yüksek holder LoA kaynağı | e-imza/NES challenge (T3) | Devlet PID Provider (T3, daha geniş taban) |
| T2 üretimi | Uzaktan KYC + kurum kayıt masaları | Yukarıdakiler + resmî eID/e-Devlet/NFC |
| Issuer akreditasyonu | Tamga (Root TAO olarak) I1–I3 verir | Ulusal Root CA/Root TAO devlete/akredite kuruma geçer ([[ADR-0002]], [[SPEC-ID-0002]]) |
| Trust anchor | Tamga imzalı Trusted List + BTK ESHS kökleri | Devletin ulusal kök + zincir registry |

Bu tablo [[ARCH-0001]]'in **fazlı validator modeliyle** (Faz 0 vakıf → Faz 1 devletler →
Faz 2 kurumlar) birebir hizalıdır: devletsiz bootstrap, Faz 0'ın *nasıl işlediğini*
anlatan assurance karşılığıdır.

## Kurum = Kayıt Otoritesi (T2 üretici)

Devletsiz T2'nin motoru şudur: bir üniversite/oda, üyesinin fiziksel kimliğini bir masada
görüp cüzdanına bağladığında ([[SPEC-CRED-0001]] yüz yüze holder binding), eIDAS'ın
*"in-person proofing by a registration authority"* dediği şeyi yapmış olur. Yani kurum
yalnızca issuer (I3) değil, aynı zamanda **Tamga'nın kimlik doğrulama noktası** (T2
üretici) olur. Devlet olmadan ölçekli T2 üretme kapasitesi budur.

---

# Assurance Decay (seviye çürümesi)

Assurance tek yönlü bir merdiven değil, zamanla değer kaybeden bir varlıktır. Seviye
**düşürme** de tasarlanır:

| Olay | Etki |
|------|------|
| Cihaz değişikliği | Holder seviyesi **T1'e** düşer, yeniden doğrulama istenir ([[ADR-0003]] varlık kurtarma ile hizalı; kimlik yeniden türetilir) |
| Uzun süre kullanılmama (ör. 12 ay) | Seviye düşer |
| Şüpheli davranış / anahtar anomalisi | Seviye askıya alınır |
| Kaynak credential süresi dolması (ör. e-imza sertifikası) | Türetilmiş T3 → düşer |
| Issuer askıya alınması/iptali | O issuer'ın credential'larının kabul edilebilirliği düşer ([[SPEC-BC-0001]] yumuşak iptal ile) |

---

# Kullanıcıya Sunum İlkesi

**Kullanıcıya sayı gösterme.** İçeride T2/I3 olsun; kullanıcı arayüzünde yalnızca durum
görünür:

- "Kimliğin doğrulandı ✓"
- "İstanbul Bilgi Üniversitesi tarafından verildi ✓ (Akredite kurum)"

Sayı gösterilirse kullanıcı "seviye avcısına" döner ve sistem oyunlaşır. Sayılar
**verifier'ın politika motoruna** aittir, son kullanıcıya değil.

---

# Evrim / Gerekçe

- **eIDAS/EBSI emsali:** İki eksen ayrımı eIDAS'ın holder LoA'sı ile EBSI'nin
  issuer/akreditasyon zincirinin (Root TAO→TAO→TI) birleşimidir. Tekerleği yeniden icat
  etmiyoruz ([[RS-EIDAS-0001]], [[RS-EBSI-0001]]).
- **"Uyumlu ama bağımsız" ([[PM-PH-0001]]):** Kendi T/I seviyelerimiz var ama eIDAS
  LoA'ya 1:1 eşlenir → sınırda EUDI/EBSI verifier bizim seviyemizi anlar, interop kaybı
  yok.
- **Assurance enflasyonu riski:** Zamanla "kullanıcı kaybediyoruz" baskısıyla T2/T3
  kriterlerini gevşetme eğilimi gelir. Bir kez taviz verilirse seviye sistemi anlamsızlaşır.
  **Önlem:** kriterler resmî "Tamga Trust Framework" belgesine yazılır ve değiştirilmesi
  prosedürel olarak zorlaştırılır (yönetim kurulu kararı + duyuru süresi) → PM-GOV-0001.

---

# Gelecek / Açık Sorular

1. **Kendi seviye kriterlerinin tam metni** (T0–T3 ve I1–I3'ün resmî, denetlenebilir
   tanımları + eIDAS 1:1 eşleme tablosu) → resmî **Tamga Trust Framework** belgesi
   (PM-GOV-0001 ile birlikte).
2. **TAO akreditasyon zinciri** (Root TAO → sektörel TAO → Trusted Issuer yetki devri):
   ölçeklenme motoru; issuer assurance'ın kurumsal yönetişimi → PM-GOV-0001.
3. **Onboarding/kimlik-ispatı yöntem detayı** (uzaktan tarama+selfie vs NFC eID) →
   [[PM-ID-0001]] §7 açık maddesi + RS-PID-ISSUANCE (planlı). Bu doküman "hangi seviye"yi,
   o "hangi yöntem"i belirler.
4. **Assurance seviyesinin zincir temsili:** issuer assurance alanının [[SPEC-BC-0001]]
   `Issuer` struct'ına eklenmesi (holder assurance zincire yazılmaz — kişisel veridir,
   [[PM-TRUST-0001]]).

---

# İlişkiler / İlgili Dokümanlar

- [[PM-ID-0001]] — §6.2 assurance seviyeleri artık burada tanımlanır; PID Provider = Faz 1 T3 kaynağı.
- [[PM-PH-0001]] — "Altyapı devlet olmadan da çalışabilmeli" ilkesinin (§Gelecek md.5) somut karşılığı.
- [[SPEC-CRED-0001]] — holder binding, WUA, SD-JWT VC: assurance'ın *teknik* taşıyıcısı.
- [[SPEC-BC-0001]] — IssuerCategory (sektör) ≠ issuer assurance (derece); StatusList (status).
- [[ADR-0004]] / [[SPEC-ID-0002]] — issuer kimliği X.509; I2/I3 sertifika temeli.
- [[ADR-0003]] — credential-gating primitifi = verifier politika motorunun kontrat yüzeyi.
- [[ADR-0005]] — bu modelin ve devletsiz bootstrap'ın kabul kaydı.
- [[ARCH-0001]] — fazlı validator modeli = devlet geçişinin ağ karşılığı.
- PM-GOV-0001 (planlı) — TAO zinciri, akreditasyon süreci, Trust Framework yönetişimi.

---

# Durum

**review_status: Draft.** İki eksenli model (holder T0–T3 × issuer I1–I3, çarpım kuralı),
devletsiz bootstrap ve Faz 0→1 geçişi, assurance decay, verifier politika motoru ve
kullanıcı sunum ilkesi kararlaştırıldı ([[ADR-0005]]). Seviye kriterlerinin tam metni ve
TAO akreditasyon yönetişimi PM-GOV-0001'e; teknik taşıyıcı SPEC-CRED-0001'e havale edildi.
