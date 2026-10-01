# Senaryolar — Tamga Network Uçtan Uca

Bu doküman, bugüne kadar verdiğimiz **tüm kararların birlikte nasıl çalıştığını**
somut aktörler ve örneklerle anlatır. Amaç: "ne durumdayız"ı tek bir hikâye akışında
görmek. Her senaryonun sonunda **hangi karar/dokümanı** gösterdiği etiketlenir.

> **Not:** Aşağıdakiler **tasarım senaryolarıdır** — henüz kod yazılmadı (implementasyon
> Faz 6). Bunlar, yazılı kararların (docs/, ADR, SPEC, PM) somutlaştırılmış hâlidir.
> Güncel durum ve açık kararlar: [[STATUS]] · [[DECISIONS]].

---

## Aktörler (tüm senaryolarda sabit)

| Aktör | Rol |
|---|---|
| **Türkiye · Azerbaycan · Kazakistan** | Kurucu üye devletler (validator'lar) |
| **Tamga Vakfı** | Faz 0'da tüm validator'ları çalıştıran kurucu vakıf |
| **NVİ** (Nüfus ve Vatandaşlık İşleri) | Türkiye'nin PID Provider'ı (IDENTITY issuer) |
| **İTÜ** (İstanbul Teknik Ü.) | EDUCATION issuer (Türkiye) |
| **Ayşe Yılmaz** | Türk vatandaşı (holder) |
| **Aylin Əliyeva** | Azerbaycan vatandaşı (sınır-ötesi holder) |
| **Atlas Lojistik A.Ş.** | LOGISTICS kurumu + AI agent sahibi (Türkiye) |
| **Demir Bank** | FINANCE issuer / mutabakat rayı |
| **İstanbul Başsavcılığı + 5 guardian kurumu** | Hesap-verebilir açıklama (yargı/KVKK/NVİ/Ombudsman/TBMM-atamalı) |

**Temel ilke (her yerde geçerli):** Zincir yalnızca **kişisel olmayan güven verisi**
tutar (kurum anahtarları, akreditasyon, iptal durumu). Kişisel belgeler ve kimlik
**asla zincirde değildir** — cüzdanda durur. `[[PM-TRUST-0001]]`

---

## Senaryo 1 — Ağ nasıl var oluyor (Genesis + Yönetişim)

Türkiye, Azerbaycan ve Kazakistan bir **izinli Besu/QBFT zinciri** kurar. Başta
zincir teknik olarak **Tamga Vakfı** tarafından işletilir (Faz 0): 4 validator düğümü
vakfın kontrolündedir (f=1 BFT toleransı). Ama bu bir **taahhüt mimarisidir** — genesis
ve yönetişim kontratları, devletlerin zamanla validator koltuklarını **QBFT oylamasıyla
devralacağı** şekilde kuruludur (Faz 1 → Faz 2).

Yönetişim üç katmanlıdır:
- **Ağa yeni devlet alma:** validator'ların **2/3** oyu gerekir.
- **Ulusal kayıtlar:** Türkiye kendi kurumunu (ör. İTÜ) issuer yaparken **kimsenin
  oyunu beklemez** — kod seviyesinde `onlyOwnerState`. Kazakistan karışamaz.
- **Sınır-ötesi tanıma:** her devlet, başka devletin kurumlarını tanıyıp tanımadığına
  **tek taraflı** karar verir.

> **Ne gösteriyor:** [[ADR-0001]] (Besu/QBFT), [[ADR-0002]] (egemenlik-öncelikli
> yönetişim), [[ARCH-0001]] (fazlı validator modeli), [[ARCH-0002]] (Besu kurulumu).

---

## Senaryo 2 — Kurum ağa katılıyor: X.509 ile issuer onboarding

İTÜ, Tamga'da diploma verebilen bir kurum olmak ister. Kimliği **X.509 sertifikasıyla**
kurulur:

```
Türkiye Ulusal Root CA  (zincire çıpalı)
      └── İTÜ sertifikası  (fingerprint: 9f:2a:...:c1)
```

Türkiye (kurumun sahibi devlet), İTÜ'yü **Issuer Registry**'ye kaydeder:

```
issuerId   = keccak256(stateCode="TR", certFingerprint=9f2a…c1)
category   = EDUCATION
status     = ACTIVE
validUntil = 2031-08-06
```

Artık zincirde "TR devletinin yetkilendirdiği, EDUCATION kategorisinde, şu sertifikaya
sahip bir issuer var" bilgisi **herkese açıktır** — ama İTÜ'nün verdiği hiçbir belge
zincirde değildir. Kayıt yalnızca **Türkiye** tarafından yapılabilir (`onlyOwnerState`).

> **Ne gösteriyor:** [[ADR-0004]] (X.509 kurumsal kimlik), [[SPEC-BC-0001]] (Issuer
> Registry, IssuerCategory, onlyOwnerState). **did:tamga:tr:itu artık kullanılmaz** —
> yerine X.509 fingerprint tabanlı issuerId.

---

## Senaryo 3 — Vatandaş kimliği: Ayşe onboard oluyor

Ayşe telefonuna Tamga Wallet uygulamasını kurar. Onboarding'de **NVİ** (Türkiye'nin PID
Provider'ı) onun gerçek kişi olduğunu doğrular (yüksek LoA için NFC'li e-kimlik).

Cüzdan, cihazın **güvenli bölgesinde** (Secure Enclave / StrongBox) anahtar üretir —
hiçbiri dışarı çıkmaz. Kritik tasarım: **Ayşe'ye küresel bir kimlik numarası verilmez.**
Bunun yerine üç ayrı anahtar alanı türetilir:

```
Kimlik anahtarı  → pseudonym türetme, credential sunumu.  Kurtarılamaz. Devredilemez.
Varlık anahtarı  → zincir/ödeme işlemleri (EVM adresi).    Kurtarılabilir.
Agent anahtarı   → (ileride) delegasyon.                    Süreli. İptal edilebilir.
```

Ayşe'nin zincir hesabı düz bir adres (EOA) değil, baştan bir **akıllı kontrat
cüzdanıdır** — bugün sadece kimlik işi yapsa bile. Bu, ileride kurtarma/limit/agent/gas
sponsorluğunu mümkün kılar.

Her kurumla ilişkisinde Ayşe **farklı bir pairwise pseudonym** kullanır: İTÜ ona
`p:8f2…c19`, hastane ona `p:3d4…a71` görür. İkisi **birbirine bağlanamaz** — kimse
Ayşe'nin eğitim + sağlık + ödeme izini tek ipe dizemez.

> **Ne gösteriyor:** [[PM-ID-0001]] (kimlik modeli, PID Provider), [[ADR-0004]]
> (küresel ID yok, pairwise pseudonym), [[SPEC-ID-0001]] (pseudonym profili),
> [[ADR-0003]] Karar 1-2 (kontrat cüzdanı + anahtar-alanı ayrımı).

---

## Senaryo 4 — Belge veriliyor: Diploma (SD-JWT VC)

Ayşe mezun olur. İTÜ ona bir **diploma credential'ı** verir — W3C Verifiable
Credential, SD-JWT formatında, İTÜ'nün özel anahtarıyla **imzalı**:

```
Credential (Ayşe'nin cüzdanında — ZİNCİRDE DEĞİL)
  issuer:      İTÜ (issuerId: keccak256("TR", 9f2a…c1))
  holder:      p:8f2…c19   (Ayşe'nin İTÜ'ye özel pseudonym'i)
  claims:      degree = "Bilgisayar Mühendisliği"
               graduation_year = 2026
               gpa = 3.42
               student_no = 040210133
               birth_date = 2003-05-14
  signature:   İTÜ imzası
```

Zincire yazılan **hiçbir şey yok**. Belgenin doğruluğu İTÜ'nün **imzasından** gelir;
zincir sadece "İTÜ'nün public anahtarı + geçerli issuer olduğu + belgenin iptal
durumu"nu tutar. Belge Ayşe'nin cebinde gezer.

> **Ne gösteriyor:** [[PM-TRUST-0001]] (on/off-chain sınırı), [[ACA-ID-0001]]
> (DID/VC nasıl çalışır). Doğrulama = issuer imzası; zincir = güven registry'si.

---

## Senaryo 5 — Doğrulama + Seçici Açıklama

Ayşe bir işe başvurur. İşveren "İTÜ'den bilgisayar mühendisi misin?" diye sorar.
Ayşe **seçici açıklama** yapar — sadece gerekeni gösterir:

```
SUNULAN (disclosed):     degree = "Bilgisayar Mühendisliği"  ✓
                         issuer = İTÜ (doğrulanmış)          ✓
GİZLİ (withheld):        gpa · student_no · birth_date        🔒
```

İşveren şunu doğrular: (1) İTÜ imzası geçerli mi? (2) Zincirde İTÜ hâlâ ACTIVE bir
EDUCATION issuer mı? (3) Bu belge iptal edilmiş mi? — Üçü de **evet/temiz** ise
diploma geçerlidir. İşveren Ayşe'nin notunu, öğrenci numarasını, doğum tarihini
**hiç görmez**.

> **Ne gösteriyor:** Seçici açıklama (SD-JWT), [[SPEC-BC-0001]] (issuer + StatusList
> doğrulaması), credential-gating primitifi ([[ADR-0003]] Karar 4 — "bu işlem için şu
> credential gerekir" kuralının aynısı).

---

## Senaryo 6 — İptal (Revocation)

İTÜ, yanlışlıkla verdiği bir belgeyi geri almak ister. Belgeye dokunamaz (Ayşe'nin
cebinde). Bunun yerine zincirdeki **StatusList**'te o belgenin bit'ini "iptal"e çeker.
StatusList en az **100.000 index** kapasiteli bir bitmap'tir — tek tek belgeleri değil,
sadece "şu indexteki belge geçerli/iptal" bilgisini tutar (mahremiyet + verimlilik).

Bir sonraki doğrulamada işveren StatusList'e bakar, bit "iptal" görür, belgeyi
reddeder. Ayşe'nin kimliği bu süreçte hiç açığa çıkmaz.

> **Ne gösteriyor:** [[SPEC-BC-0001]] (StatusList, min 100k), [[PM-TRUST-0001]]
> (ilişkilendirilemez iptal).

---

## Senaryo 7 — Hesap-verebilir açıklama (yurt içi): pseudonym çözülüyor

Bir suç soruşturmasında, bir işlemin arkasındaki `p:8f2…c19` pseudonym'inin gerçekte
kim olduğu gerekir. **Hiçbir tek aktör** bunu tek başına açamaz — ne Tamga Vakfı, ne
tek bir bakanlık.

**Perde arkası (Ayşe farkında bile değil):** Ayşe her pseudonym türettiğinde, cüzdanı
iki katmanlı bir **escrow** yükledi — `Enc(PK_Türkiye, kimlik‖commit)`. Şifreleme,
doğru yapıldığının **kriptografik kanıtıyla** (NIZK) birlikte. Makbuzsuz bir pseudonym
**ağ-geçersizdir** (kaçış yok). Zincirde sadece commitment durur, şifreli veri değil.

**Açma süreci:** İstanbul Başsavcılığı bir **mahkeme token'ı** üretir (kağıt değil —
X.509 sertifika zinciriyle imzalı kriptografik nesne). 5 guardian kurumundan
**en az 3'ü** onaylamalı — VE bu 3 onaydan **en az 1'i yürütme-dışı** olmalı (yargı,
KVKK, Ombudsman, TBMM-atamalı). Eşik sağlanınca **DKG + threshold ElGamal** ile
pseudonym→kimlik bağı çözülür — anahtar hiçbir zaman tek yerde yeniden kurulmaz.

Her adım **değiştirilemez bir audit log**'a yazılır: kim, ne zaman, hangi dava için
onay verdi. Ayşe'nin devleti egemen erişebilir, ama **izsiz/tek-elden erişemez**
(accountable anonymity).

> **Ne gösteriyor:** [[PM-ID-0002]] (accountable disclosure), [[SPEC-BC-0002]]
> (kurumsal 5'li, 3-of-5 + yürütme-dışı kuralı, DKG+ElGamal, escrow enrollment,
> audit log), [[ADR-0004]] (court-token X.509 imzalı).

---

## Senaryo 8 — Acil durum modu

Bir kaçırma vakasında saatler önemli. Tam 3-of-5 onayı beklemek çok yavaş. **Acil
mod:** **2-of-5** onayla erişim açılır — AMA **48 saat içinde** geriye dönük tam-eşik
(3-of-5) onayı gelmezse erişim **otomatik iptal olur + alarm tetiklenir**. Böylece hız
ve hesap-verebilirlik birlikte korunur.

> **Ne gösteriyor:** [[SPEC-BC-0002]] §8 (acil durum modu). Hukuki çerçeve → PM-GOV-0001
> (planlı, [[DECISIONS]] D-GOV-4).

---

## Senaryo 9 — Sınır ötesi: Aylin senaryosu

Azerbaycanlı **Aylin**, Türkiye'de bir işlemde Azerbaycan'ın verdiği bir credential'ı
sunar. Türkiye, Azerbaycan'ı **kurucu üye** olarak **FULL** tanır (kurucular
birbirini varsayılan tam tanır; sonradan katılanlar NONE'dan başlar) — belge geçerli.

Şimdi zor kısım: Aylin hakkında Türkiye'de bir olayla ilgili **sınır-ötesi açıklama**
gerekir. Burada **"Kim/Ne" ayrık-anahtar** devreye girer:

- **"Kim"** (Aylin'in gerçek kimliği) → yalnızca **Azerbaycan** (tabiyet devleti)
  açabilir.
- **"Ne"** (olayın Türkiye'deki verisi) → yalnızca **Türkiye** (olay yeri) açabilir.

Hiçbir taraf **tek başına** tam dosyaya ulaşamaz. Azerbaycan reddederse, Aylin'in
kimliği açılmaz — **temyiz yok, mutlak ret**. Bu, MLAT'ın (karşılıklı adli yardım)
dijitalleştirilmiş, egemenliğe saygılı hâlidir.

> **Ne gösteriyor:** [[ADR-0002]] (cross-recognition, kurucular FULL), [[SPEC-BC-0002]]
> §6 (tabiyet ilkesi, Kim/Ne ayrık-anahtar, mutlak ret).

---

## Senaryo 10 — Değer katmanı: Lojistik (parasız — Faz 1)

**Atlas Lojistik**, bir konteyner sevkiyatı yapar. Tamga bugün **para taşımaz** —
ama belge/yetki doğrulamasını saniyelere indirir:

- Konşimento (bill of lading) credential'ı doğrulanır.
- Gümrük müşavirinin yetki credential'ı doğrulanır.
- "Bu kişi Atlas Lojistik adına imza atmaya yetkili mi?" sorusu credential ile cevaplanır.

Para hâlâ banka havalesi/kartla döner. Tamga **yetkilendirme** sağlar, mutabakat değil.
Bu bile lojistikte büyük değerdir.

> **Ne gösteriyor:** [[PM-AUTH-0001]] (yetkilendirme katmanı, Faz 1 parasız),
> credential-gating ([[ADR-0003]] Karar 4).

---

## Senaryo 11 — AI Agent yetkilendirme: "Agent'ın velisi kurum"

Atlas Lojistik, rutin işleri bir **AI agent'a** devreder. Agent'ın **kendi kimliği
yoktur** — Atlas'ın doğrulanmış kurumsal kimliğinden **türetilmiş bir yetkisi** vardır:

```
AgentDelegation
  principal:        Atlas Lojistik (X.509 ile doğrulanmış kurum)
  agentAccount:     0xA9c…  (agent'ın EVM adresi)
  allowedScopes:    ["logistics:quote", "logistics:book", "pay:customs"]
  perTxCap:         500 birim
  merchantAllowlist:[gümrük müşavirleri, liman operatörleri]
  validUntil:       2026-12-31        ← süresiz delegasyon YOK
  requiresHumanApproval: 500 birim üstü
  status:           ACTIVE
```

Agent, güzergâh boyunca gümrük ücretlerini otomatik öder (dış ödeme rayında), liman
randevusu alır, konşimentoyu doğrular. **500 birimi aşan** bir işlemde otomatik olarak
**insan onayına** düşer. Atlas dilediği an **koşulsuz iptal** edebilir (kill switch).
Her işlem loglanır ve **hukuken Atlas'ın işlemidir**.

Tamga'nın farkı: veli, bir "hesap" değil, **devletin doğruladığı bir kurumdur** —
kesintisiz hukuki sorumluluk zinciri. Hiçbir ticari platform bunu sunamaz.

> **Ne gösteriyor:** [[ADR-0003]] Karar 3 (scope-generic delegasyon), [[PM-AUTH-0001]]
> (agent yetkilendirme). Tam kontrat → SPEC-AGENT-0001 (planlı, [[DECISIONS]] D-AUTH-2).

---

## Senaryo 12 — Ödeme referansı / escrow tetikleyici (Faz 2)

Atlas ile alıcı arasında: "Yük teslim edildiğinde ödeme serbest kalsın." Tamga bunu
şöyle kurar: **para Demir Bank'ta bekler**; zincirde yalnızca **tetikleyici** durur.
"Teslim edildi" credential'ı geldiğinde, banka ödemeyi serbest bırakır.

Tamga parayı **hiç tutmaz** — sadece yetkilendirir ve tetikler. Mutabakat düzenlenmiş
banka rayında olur. Bu yüzden merkez bankası çatışması ve lisans yükü doğmaz.

> **Ne gösteriyor:** [[PM-AUTH-0001]] (Aşama 2, "authorization not settlement"),
> sansür paradoksundan kaçınma.

**Not — açık konu:** İzinli zincirde validator'lar (devletler) her adresin işlem
grafiğini görür. Düzenli ödeme trafiğinde bu bir gözetim yüzeyi olabilir. On-chain
mutabakata (Aşama 3+) geçmeden önce çözülmeli. → [[DECISIONS]] D-AUTH-1.

---

## Senaryo 13 — Cüzdan kurtarma: Ayşe telefonunu kaybediyor

Ayşe telefonunu kaybeder. Üç şey için **üç ayrı** cevap:

| Kaybolan | Kurtarma |
|---|---|
| **Credential'lar** (diploma) | Kolay — İTÜ'den yeniden talep edilir; belge zaten İTÜ'de |
| **Pseudonym'ler** | **Yeniden türetilmez** — kimlik alanındaki anahtarlar seed'den türetilmez ([[SPEC-WALLET-0001]]/WL1, [[ADR-0003]] K2); ilgili ilişkiler yeni anahtarlarla yeniden kurulur, belgeler yeniden alınır (F18 düzeltmesi, 2026-09-24) |
| **Varlık hesabındaki para** | Akıllı kontrat cüzdanı + **kullanıcı-seçimli** kurtarıcılar |

Varlık cüzdanı kurtarıcıları Ayşe'nin **kendi seçtikleridir** — ör. 2 aile üyesi +
(isteğe bağlı) bir kurum, **M-of-N eşik + 7 gün zaman kilidi**. **Zorunlu devlet
kurtarıcı yoktur** — çünkü bu, devlete para hesabı üzerinde kaldıraç verir (sansür
paradoksu).

**Kritik sınır:** Kurtarma **yalnızca varlık anahtarına** uygulanır. Kimlik anahtarı
ve credential'lar bu mekanizmaya **asla dahil edilmez** — yoksa "kurtarıcılar" Ayşe'nin
kimliğini ele geçirebilirdi. İki alan kesin ayrıdır.

> **Ne gösteriyor:** [[ADR-0003]] Karar 2 (kullanıcı-seçimli kurtarma, kimlik≠varlık).
> Somut M-of-N + zaman kilidi → PM-ID-0003 (planlı).

---

## Senaryo 14 — Aşamalı ademi merkeziyet (uzun vade)

Zaman geçer, ağ olgunlaşır. **Faz 0**'da vakfın çalıştırdığı 4 validator, **Faz 1**'de
devletlere devredilir: Türkiye, Azerbaycan, Kazakistan kendi validator düğümlerini
çalıştırmaya başlar; vakıf koltuklarını **QBFT oylamasıyla** teslim eder ve azalır.
**Faz 2**'de güvenilir kurumlar full node olur. Güç, teknik bir vakıftan egemen
devletlere **şeffaf ve taahhütlü** biçimde geçer.

> **Ne gösteriyor:** [[ARCH-0001]] (fazlı validator modeli, progressive decentralization),
> [[ARCH-0002]] (QBFT ile validator devri).

---

## Kapanış — Ne kurulu, ne planlı, ne açık

**✅ Karara bağlandı / yazıldı (docs):**
- Ağ: Besu/QBFT, egemenlik-öncelikli yönetişim, fazlı validator ([[ADR-0001]], [[ADR-0002]], [[ARCH-0001]], [[ARCH-0002]])
- Kimlik: PID model, **X.509 kurumsal kimlik**, pairwise pseudonym ([[PM-ID-0001]], [[ADR-0004]], [[SPEC-ID-0001]])
- Güven katmanı kontratları: Issuer/RP Registry, StatusList, cross-recognition ([[SPEC-BC-0001]])
- Hesap-verebilir açıklama + escrow + sınır-ötesi ([[PM-ID-0002]], [[SPEC-BC-0002]])
- Değer katmanı stratejisi + 5 kanca ([[PM-AUTH-0001]], [[ADR-0003]])
- Öğretici zemin: blockchain / kripto / DID-VC ([[ACA-BC-0001]], [[ACA-CRYPTO-0001]], [[ACA-ID-0001]])

**📝 Planlı (henüz yazılmadı):**
- `SPEC-ID-0002` — tam X.509 metot spesifikasyonu (Root CA çıpalama, rollover, issuerId eşlemesi)
- `SPEC-AGENT-0001` — agent delegasyon kontratı
- `PM-GOV-0001` — yönetişim (guardian kurumlarının somut eşlemesi, acil-mod hukuki çerçeve)
- `PM-ID-0003` — kurtarma/guardian/vault (varlık kurtarma M-of-N detayı)

**⚠️ Açık kararlar/riskler** (tümü [[DECISIONS]]'ta):
- İşlem-grafiği mahremiyeti (D-AUTH-1) · guardian kurumsal eşleme (D-GOV-1) ·
  kriptografik primitiflerin bağımsız güvenlik denetimi (D-GRD-1)

**🔨 Kod:** Henüz yok — implementasyon Faz 6 (`contracts/`, `sdk/`, `services/`).
Tüm kontratlar [[ADR-0003]] beş kancasına uyacak.

---

> Bu doküman yaşayan bir haritadır; yeni karar/senaryo eklendikçe güncellenir.
> Navigasyon: [[MASTER_INDEX]] · Durum: [[STATUS]] · Kararlar: [[DECISIONS]].
