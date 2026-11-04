---
document_id: SPEC-BC-0002
title: "Emanet ve hesap verebilir açıklama"
status: Draft
version: 1.0.0
created: 2026-08-05
last_updated: 2026-10-02
summary: >
  [[PM-ID-0002]] accountable-disclosure kararının tam kontrat ve protokol yüzeyi.
  Guardian kompozisyonu: devlet-bazlı 5 kurumsal koltuk (yargı, veri-koruma,
  nüfus/kimlik otoritesi, ombudsman, parlamento-atamalı) + "3 onaydan ≥1'i
  yürütme-dışı" kuralı; anahtar DKG ile üretilir, threshold decryption ile açılır
  (reconstruction YOK). Escrow enrollment modeli: iki katmanlı (kök + pseudonym)
  verifiable-encryption escrow; escrow makbuzu olmadan pseudonym ağ-geçersiz.
  Sınır-ötesi: tabiyet ilkesi (ülkesellik değil) + "Kim/Ne" ayrık-anahtar + mutlak
  ret hakkı. Kontrat: GuardianRegistry + DisclosureRegistry (domestic/cross-border,
  emergency, getStatistics, gecikmeli bildirim tavanı). Zincir sır/pay/kişisel-veri
  tutmaz ([[PM-TRUST-0001]]); yalnızca commitment ve silinemez denetim izi.
---

# Kapsam

Bu spesifikasyon, [[PM-ID-0002]]'de kararlaştırılan eşikli escrow modelinin **tam kontrat ve protokol yüzeyini** tanımlar. Önceki "Assurance Guardian" taslağı bu dokümana resmileştirilmiştir (taslak ayrıca yayınlanmaz). "Nasıl"ı verir: guardian kompozisyonu, escrow enrollment, sınır-ötesi protokol, kontrat arayüzleri, bildirim ve değişmezler.

**Değişmez sınır (kritik):** Zincir **hiçbir zaman** kişisel veri, pseudonym↔kimlik eşleştirmesi, escrow ciphertext'i veya threshold payını tutmaz ([[PM-TRUST-0001]]). Zincirde yalnızca: guardian kümesi/kompozisyonu, eşik, policy referansı, escrow **commitment**'ları ve **değiştirilemez denetim izi** bulunur. Kriptografik açma tümüyle zincir-dışıdır (guardian HSM'leri).

---

# 1. Temel İlke: Tabiyet Bağı, Ülkesellik Değil

> **Bir vatandaşın pseudonym'ini yalnızca kendi devleti çözebilir. İki devleti ilgilendiren süreçlerde yürütme ortaktır.**

Bu, uluslararası hukukun **kişisel yetki (nationality principle)** ilkesinin kriptografik olarak zorlanmış halidir; **ülkesellik ilkesi** ("olay yeri devleti çözer") bilinçle reddedilmiştir ([[ADR-0002]] home-state egemenliği). Gerekçe: hiçbir devlet vatandaşını başka devletin tek taraflı ifşa yetkisine sokmaz; aksi hâlde vatandaşlar sınır-ötesi kullanımdan kaçınır ve ağ amacını yitirir.

Bu, **Adli Yardımlaşma (MLAT)** rejiminin dijitalleştirilmiş, hızlandırılmış (ay → gün/saat) ve denetlenebilir halidir; hukuki eşik korunur.

---

# 2. Guardian Kompozisyonu — Devlet Bazlı

Guardian seti **devlet bazlıdır**, ağ-bazlı değil: her devletin kendi eşik anahtarı vardır ve **yalnızca kendi vatandaşlarının** pseudonym'lerini çözebilir. Kazakistan'ın anahtarı bir Türk vatandaşının escrow'unu **matematiksel olarak** çözemez — politika değil kriptografik imkânsızlık.

## 2.1 İç kompozisyon (KARAR — 2026-08-05): kurumsal 5'li, 3-of-5

| Koltuk | Kurum | İşlev | Yürütme? |
|--------|-------|-------|----------|
| 0 `JUDICIARY` | Üst mahkeme / hâkimler kurulu atamalı | Hukuki dayanak denetimi | **Hayır** |
| 1 `DATA_PROTECTION` | Veri koruma otoritesi (KVKK muadili) | Orantılılık & mahremiyet | **Hayır** |
| 2 `IDENTITY_AUTHORITY` | Nüfus/kimlik otoritesi | Teknik/operasyonel yürütme | **Evet** |
| 3 `OMBUDSMAN` | Kamu denetçiliği | Bireyin hakkının savunusu | **Hayır** |
| 4 `PARLIAMENTARY` | Parlamento atamalı bağımsız üye | Demokratik hesap verebilirlik | **Hayır** |

**Yürütme-dışı koltuk kuralı (ağ değişmezi):** Eşiği aşan onaylardan **en az 1'i yürütme-dışı koltuktan** gelmelidir; ayrıca **yürütme koltuğu sayısı < eşik** olmalıdır (`executiveSeats ≤ threshold − 1`). Önerilen sette 1 yürütme koltuğu / 3 eşik olduğundan yürütme tek başına asla eşiğe ulaşamaz. Bu, mekanizmayı "hükümetin istediği zaman açtığı kapı" olmaktan çıkarır.

> **Not — "operatör/custodian koltuğu" YOK.** Önceki taslaktaki teknik operatör/custodian *oy veren guardian* değildir: ağ işletmecisinin (vakıf) bir devletin vatandaşını açma kararına oyu karışamaz (egemenlik). Teknik saklama ayrı bir katmandır: **her kurum kendi payını** DKG ile tutar (§3); operasyon 5 kuruma dağıtıktır.

## 2.2 Egemenlik ve yayınlama

Kompozisyon **zorunlu tutulmaz** — her devlet [[ADR-0002]] gereği kendi setini belirler — ama yukarıdaki set **ağ standardı** olarak tavsiye edilir ve **on-chain yayınlanması zorunludur** (koltuğun hangi kuruma ait olduğu + her değişiklik loglanır). Bir devletin kompozisyonu, diğer devletlerin `setRecognition` ([[SPEC-BC-0001]]) kararında baktığı kriterdir → piyasa disiplini (§10).

---

# 3. Kriptografik Temel — DKG + Threshold (Reconstruction YOK)

- **Threshold decryption, Shamir-reconstruction DEĞİL.** Anahtar **hiçbir zaman yeniden kurulmaz**: her guardian kendi payıyla **kısmi çözüm** üretir, sonuç birleştirilir. Naif "payları birleştir → tam anahtarı bir makinede oluştur → çöz" deseni yasaktır (tek-nokta zafiyeti). Şema: **threshold ElGamal** (birincil; [[PM-ID-0002]] kararı) veya BLS threshold; verifiable encryption uyumu için ElGamal tercih.
- **Distributed Key Generation (DKG).** Devlet eşik anahtarı DKG ile üretilir — tam anahtar hiçbir aşamada, hiç kimsede bulunmaz. Merkezî üretip dağıtmak güven modelini baştan bozar; yasak.
- **Proaktif resharing.** Koltuk sahibi değişince (hâkim emekli, kurum başkanı gider) anahtar değişmeden paylar yenilenir (proactive secret resharing); rotasyon on-chain loglanır.
- **Anahtar kaybı = kalıcı.** 5 guardian'dan 3'ünden fazlası payını kaybederse o devletin geçmiş pseudonym'leri **kalıcı olarak çözülemez** hale gelir. Bu bir hata değil, kabul edilen sonuçtur; "kurtarma anahtarı" eklemek modeli anlamsızlaştırır. Whitepaper'da açıkça belirtilir.

---

# 4. Escrow Enrollment — Pseudonym Nasıl Açılabilir Hale Gelir

Pseudonym'ler cüzdanda kök-kimlikten türetilir ([[PM-ID-0001]], SPEC-ID-0001 §5.2) ve **unlinkable**'dır. Guardian setinin sonradan bir pseudonym'i açabilmesi için, o bağın **enrollment anında** şifreli escrow'a yazılması gerekir. Model iki katmanlıdır ve **kaçışa kapalıdır**.

## 4.1 İki katmanlı escrow

| Kayıt | Ne zaman | İçerik (şifreli) | Kim üretir |
|-------|----------|------------------|------------|
| **Kök escrow** `E_root` | Onboarding (bir kez) | `Enc(PK_s, gerçekKimlik ‖ rootCommit)` | Devlet PID Provider ([[PM-ID-0001]]) |
| **Pseudonym escrow** `E_i` | Her pseudonym türetiminde | `Enc(PK_s, rootCommit ‖ P_i ‖ ctx_i)` | Vatandaşın cüzdanı (Tamga Wallet) |

- `PK_s` = home-state threshold ElGamal açık anahtarı (§3 DKG).
- `rootCommit = H(rootPub ‖ salt_s)` — vatandaş başına **kararlı bağ etiketi**; yalnızca yetkili açılıştan *sonra* pseudonym'leri birbirine bağlar.
- Ciphertext'ler **off-chain** home-state Escrow Store'da tutulur ([[PM-TRUST-0001]]: şifreli-de-olsa ilişkilendirilebilir veri zincire yazılmaz); zincirde yalnızca `H(E_i)` commitment'ı çıpalanır.

## 4.2 Escrow makbuzu ve ağ-geçerlilik (anti-kaçış)

Cüzdan `E_i`'yi Escrow Store'a yükleyince imzalı **escrow makbuzu** `R_i = Sign(ES_s, H(P_i) ‖ H(E_i) ‖ ts)` alır. **Kritik kural:** bir pseudonym `P_i` **ancak geçerli `R_i` ile ağ-geçerlidir** — issuer/RP kaydı ([[SPEC-BC-0001]]) ve credential sunumu, escrow makbuzu (veya on-chain commitment) doğrulanmadan pseudonym'i kabul etmez. Böylece "escrow'suz pseudonym" kullanılamaz; kaçış (accountability'den kurtulma) kapatılır.

## 4.3 Verifiable encryption (zorunlu)

Kötü niyetli bir cüzdan **çöp ciphertext** yükleyip yine de makbuz alarak açılamaz bir pseudonym üretmemelidir. Bu yüzden cüzdan, `E_i`'nin gerçekten `rootCommit`'e bağlı **doğru** bir şifreleme olduğunu **sıfır-bilgi kanıtı (NIZK / verifiable encryption)** ile ispatlar; Escrow Store makbuzu ancak kanıt geçerse verir. Bu kanıt sisteminin somut primitifi bağımsız kripto denetimiyle sabitlenecektir (§12).

## 4.4 Açma zinciri

1. Hedef `pseudonymRef = H(P_i)`.
2. Guardian'lar `E_i`'yi bulur → threshold-decrypt → `rootCommit ‖ P_i`.
3. `E_root(rootCommit)` → threshold-decrypt → `gerçekKimlik`.
4. Sonuç yalnızca yetkili ortamda görünür; zincire `resultCommit` çıpalanır (içerik değil).

İki pseudonym'i ilişkilendirmek bile **her biri için ayrı ayrı** threshold + yetki gerektirir (ElGamal semantik güvenliği → `E_i`, `E_j` ayırt edilemez). Devlet, cüzdan türetmeden pseudonym'leri **enumerate edemez** (trapdoor yok) → unlinkability korunur.

---

# 5. Ne Açılır, Ne Açılmaz

| Veri | Guardian açar mı | Not |
|------|------------------|-----|
| Pseudonym ↔ gerçek kimlik bağı | **Evet** (tek işlev) | Yalnızca "bu pseudonym kime ait" |
| Belirli işlemin bağlamı | Sınırlı — yalnızca talep kapsamı | Tüm geçmiş değil |
| Cüzdandaki credential içerikleri | **Hayır** | Cihazda, şifreli; erişim yok |
| Geçmiş tüm işlemler | **Hayır** | Her açma tek kapsam |
| Gelecekteki işlemler (canlı izleme) | **Hayır** | Kalıcı gözetim verilmez |

Pseudonym'ler **pairwise** türetildiğinden (Kazak işverendeki ≠ Türk bankasındaki, bağlanamaz) bir açma diğerlerini ifşa etmez — domino etkisi yok.

---

# 6. Sınır-Ötesi: "Kim/Ne" Ayrık Anahtarı + Ortak Yürütme

Sınır-ötesi vakada iki bilgi **farklı devletin anahtarı** altındadır:

- **"Kim?"** (pseudonym → kimlik) → **tabiyet devletinin** anahtarı (Türk vatandaşı → TR).
- **"Ne oldu?"** (işlemin ülke-içi bağlamı, RP kaydı, denetim izi) → **olay yeri devletinin** anahtarı (KZ).

Böylece **hiçbir taraf tek başına tam dosyaya sahip olamaz**; kullanılabilir adli dosya ancak ikisi birleşince oluşur → "ortak yürütme" centilmenlik değil **yapısal zorunluluk**.

## Akış

```text
1. KZ savcılığı/mahkemesi → KZ Guardian Seti (kendi iç hukuku; Tamga karışmaz)
2. KZ Seti 3-of-5 onaylar → on-chain Cross-Border DisclosureRequest
   (hedef pseudonymRef, kapsam hash, hukuki dayanak hash, vaka no; içerik şifreli/hash'li)
3. Talep TR Guardian Seti'ne düşer (subjectState = TR)
4. TR Seti BAĞIMSIZ değerlendirir: çifte suç? orantılılık? kapsam dar mı?
5a. TR reddeder → süreç biter. Ağ seviyesinde temyiz YOKTUR (egemenlik).
5b. TR onaylar (3-of-5, yürütme-dışı kural) → kimlik, KZ'nin pubkey'i ile şifreli iletilir;
    zincire "EXECUTED" + resultCommit yazılır (içerik değil).
6. Her iki tarafta denetim kaydı; vatandaşa gecikmeli bildirim başlar (§9).
```

**Üç+ devlet:** Her tabiyet devleti kendi vatandaşı için **ayrı** karar verir; blok/toplu karar yoktur. Biri reddederse yalnızca o kişi hakkındaki ifşa olmaz, diğerleri etkilenmez.

---

# 7. Kontrat Yüzeyi

## 7.1 GuardianRegistry (on-chain)

```solidity
enum GuardianRole {
    JUDICIARY,          // 0 — yürütme-dışı
    DATA_PROTECTION,    // 1 — yürütme-dışı
    IDENTITY_AUTHORITY, // 2 — YÜRÜTME
    OMBUDSMAN,          // 3 — yürütme-dışı
    PARLIAMENTARY       // 4 — yürütme-dışı
}

struct Guardian {
    GuardianRole role;
    bytes32 entityId;    // X.509 issuerId (SPEC-ID-0002, ADR-0004)
    bytes   thresholdPub; // bu koltuğun DKG pay-açık-anahtarı (özel pay HSM'de)
    bool    isExecutive;  // yürütme-dışı kural kontrolü için
    bool    active;
    uint64  rotatedAt;
}

struct GuardianSet {
    bytes2  stateCode;
    bytes   aggregatePub; // devletin birleşik threshold ElGamal açık anahtarı (PK_s)
    uint8   threshold;    // = 3 (ağ min)
    uint8   size;         // = 5
    uint8   executiveSeats; // ağ değişmezi: <= threshold - 1
    bytes32 policyRef;    // off-chain policy engine kural seti hash'i
    bytes32 compositionRef; // yayınlanan kompozisyonun (kurum eşlemesi) hash'i
    bool    configured;
}

function setGuardianSet(bytes2 stateCode, Guardian[5] calldata g, uint8 threshold,
                        bytes calldata aggregatePub, bytes32 policyRef, bytes32 compositionRef)
    external onlyOwnerState(stateCode);   // ADR-0002 egemenlik
function rotateGuardian(bytes2 stateCode, GuardianRole role, bytes32 newEntityId, bytes calldata newPub)
    external onlyOwnerState(stateCode);   // proaktif resharing sonucu duyurulur
function guardianSetOf(bytes2 stateCode) external view returns (GuardianSet memory);
```

## 7.2 DisclosureRegistry (on-chain, append-only)

```solidity
enum RequestStatus { PENDING, APPROVED, DENIED, EXPIRED, EXECUTED }
enum RequestType   { DOMESTIC, CROSS_BORDER, EMERGENCY }

struct DisclosureRequest {
    bytes32 requestId;
    bytes2  requestingState;    // talebi yapan devlet
    bytes2  subjectState;       // vatandaşın tabiyeti — KARAR YETKİSİ burada
    RequestType reqType;
    bytes32 pseudonymRef;       // hedef pseudonym (H(P_i))
    bytes32 legalBasisHash;     // mahkeme kararı / court token hash'i
    bytes32 scopeHash;          // dar kapsam taahhüdü
    RequestStatus status;
    uint8   approvalCount;
    uint8   nonExecutiveApprovals; // yürütme-dışı kural: >= 1 olmalı
    bytes32 resultCommit;       // execute'ta çıpalanır (içerik DEĞİL)
    uint64  createdAt;
    uint64  expiresAt;          // örn. +30 gün; cevapsızsa EXPIRED
    uint64  notifyAfter;        // §9 bildirim zamanı
}

function createRequest(DisclosureRequest calldata r) external onlyGuardianSet(r.requestingState);
function approve(bytes32 id, GuardianRole role, bytes calldata sig) external onlyGuardian(subjectStateOf(id));
function deny(bytes32 id, GuardianRole role) external onlyGuardian(subjectStateOf(id)); // gerekçesiz, mutlak
function execute(bytes32 id, bytes32 resultCommit) external; // eşik + yürütme-dışı kural + court token geçerli
function getRequestMetadata(bytes32 id) external view
    returns (bytes2 requestingState, bytes2 subjectState, RequestStatus status, uint64 createdAt);
function getStatistics(bytes2 state, uint64 from, uint64 to) external view
    returns (uint256 requested, uint256 approved, uint256 denied); // kamuya açık, manipüle edilemez

event RequestOpened(bytes32 indexed id, bytes2 indexed requestingState, bytes2 indexed subjectState);
event RequestApproved(bytes32 indexed id, GuardianRole indexed role);
event RequestDenied(bytes32 indexed id);
event RequestExecuted(bytes32 indexed id, bytes32 resultCommit);
```

Kurallar: `execute` yalnızca `approvalCount ≥ threshold` **ve** `nonExecutiveApprovals ≥ 1` **ve** geçerli court token (§7.3) iken başarılıdır ve yalnızca `resultCommit` yazar — açıklanan kimlik zincire **asla** gelmez. Paylar/kısmi çözümler zincire **yazılmaz**; birleşme zincir-dışıdır. Her durum geçişi kalıcı olay yayar → ombudsman/kamuoyu gerçek-zamanlı izler.

## 7.3 Court token — kriptografik yetki

Mahkeme kararı soyut "izin" değil, **doğrulanabilir yetkidir**: yargı koltuğunun (rol 0) anahtarıyla imzalı `{requestId, pseudonymRef, subjectState, scope, notBefore, notAfter}`. `execute` bu imzayı zincirde doğrular (`legalBasisHash` çıpalanır). `scope` orantılılığı (yalnızca hedef pseudonym; toplu tarama yasak), süre penceresi token'ı zamanla sınırlar. İmza şeması **EIP-712** (EVM-yerel doğrulama) birincil aday (§12).

---

# 8. Acil Durum Modu (KARAR — eklendi)

Çocuk kaçırma, aktif terör gibi saatlerin kritik olduğu vakalar için hızlandırılmış yol (`RequestType.EMERGENCY`):

- **2-of-5** ile geçici açma yapılır (yürütme-dışı kural burada da: 2'nin ≥1'i yürütme-dışı).
- **48 saat içinde tam 3-of-5 geriye-dönük onay ZORUNLU.** Sağlanmazsa: işlem **otomatik iptal**, kalıcı **alarm** olayı, ve vatandaşa **zorunlu erken bildirim** (§9 tavanı uygulanmaz).
- Acil mod kullanımı `getStatistics`'te **ayrı sayılır**; kötüye kullanım görünür ve maliyetlidir.

Bu mod olmadan devletler gerçek kolluk ihtiyacı için **paralel/ağ-dışı arka kapı** ister; bu yüzden mekanizmanın parçasıdır ama sıkı geriye-dönük denetime bağlıdır.

---

# 9. Vatandaşa Bildirim (gecikmeli zorunlu)

- Varsayılan: açmadan **90 gün sonra** otomatik bildirim.
- Guardian seti soruşturma gerekçesiyle **en fazla 2×90 gün** erteleyebilir (tavan ~270 gün); tavan aşılınca bildirim **otomatik tetiklenir** — erteleme sonsuz uzatılamaz.
- İçerik: hangi devlet, hangi tarih, hangi kapsam, hukuki dayanak referansı (soruşturma esası değil).
- Tavan **kontratta sabittir**; tek devlet değiştiremez — değişiklik protokol yükseltmesi = **2/3 validator oyu** ([[ADR-0002]]). Yani bir devlet kendi vatandaşına bildirimi süresiz erteleyemez.

---

# 10. Kötüye Kullanım ve Karşı-Ağırlıklar

En zayıf nokta dürüstçe: bir devletin **kendi vatandaşı** hakkında setini kötüye kullanması. Egemenlik gereği ağ doğrudan müdahale edemez; üç dolaylı ağırlık:

1. **Şeffaflık (kod seviyesinde):** her açmanın *varlığı* değiştirilemez loglanır; `getStatistics` kamuya açık. 50.000 kimliği açan devlet gizleyemez.
2. **Tanıma kaldıracı:** [[SPEC-BC-0001]] `setRecognition` bir yaptırıma dönüşür — kötüye kullanan devletin credential'ları diğerlerince kısıtlanabilir; ağ üyeliğinin ekonomik faydasını tehdit eder, egemenliğe dokunmaz.
3. **Kompozisyon yayını:** guardian koltuk→kurum eşlemesi on-chain; bir gecede 5 yürütme koltuğuna inmek herkesin gözü önündedir ve tanıma kaldıracını tetikler.

**Dürüst sınır:** Bu mekanizma kötüye kullanımı **imkânsız kılmaz** — *görünür ve maliyetli* kılar. Whitepaper'da abartısız ("tamamen imkânsız" değil) yazılır; teknik güvenilirlik böyle korunur.

---

# 11. Değişmezler

| # | Değişmez |
|---|---|
| **GD1** | **Zincirde sır yok:** kişisel veri, eşleştirme, pay, ciphertext, düz-metin sonuç asla zincirde — yalnızca commitment/hash, kompozisyon, policy, denetim izi. |
| **GD2** | **Devlet-bazlı anahtar:** bir devletin seti yalnızca kendi vatandaşını çözer (kriptografik); başka devletin anahtarı çözemez. |
| **GD3** | **3-of-5 + yürütme-dışı:** `threshold ≥ 3`, `size = 5`, `executiveSeats ≤ threshold−1`, her `execute`'ta `nonExecutiveApprovals ≥ 1`. |
| **GD4** | **Egemenlik:** seti yalnızca home-state kurar/günceller (`onlyOwnerState`, [[ADR-0002]]); kompozisyon on-chain yayınlanır. |
| **GD5** | **DKG + threshold:** anahtar hiç yeniden kurulmaz; merkezî üretim yok. |
| **GD6** | **Escrow-geçerlilik:** escrow makbuzu olmayan pseudonym ağ-geçersiz; escrow verifiable-encryption ile doğrulanır. |
| **GD7** | **Yasal tetik zorunlu:** geçerli court token olmadan `execute` yok; hukuki + kriptografik kenetli. |
| **GD8** | **Mutlak ret / temyiz yok:** subjectState gerekçesiz reddedebilir; ağ seviyesinde üst merci yoktur. |
| **GD9** | **Dar kapsam:** yalnızca pseudonym↔kimlik; credential/geçmiş/canlı-izleme yok. |
| **GD10** | **Silinemez iz + bildirim:** her talep/onay/ret/açma append-only; bildirim tavanı kontratta sabit (2/3 ile değişir). |

---

# 12. Açık Sorular

1. **Verifiable encryption primitifi:** §4.3 NIZK'in somut şeması (ör. Camenisch-Shoup verifiable encryption, Groth16 devre) — kripto denetimi.
2. **Court token şeması:** EIP-712 mi JWS mi (EVM doğrulama maliyeti)? EVM precompile gerekir mi (Besu özelleştirmesi)?
3. **Commitment şeması:** `rootCommit`/`resultCommit`/`H(E_i)` için taahhüt (Pedersen? salted hash?) — linkability sızıntısı olmamalı.
4. **`getStatistics` toplama:** on-chain sayaçlar mı, event-index off-chain mi (gas/doğruluk dengesi).
5. **Escrow Store operasyonu:** off-chain store'un HA/yedekleme + air-gap topolojisi → `services/` tasarımı.
6. **N kurumlarının idari eşlemesi + acil-mod hukuki çerçevesi:** → PM-GOV-0001.
7. ~~**x509 etkisi (izlenecek)**~~ **KAPANDI (2026-08-06, [[ADR-0004]]):** X.509 kararı verildi. Guardian `entityId` ve court-token imza zinciri **X.509 sertifika zincirine bağlanır** (mahkeme/guardian imzaları ulusal Root CA'ya kadar doğrulanır). Somut sertifika→entityId eşlemesi + imza doğrulama → SPEC-ID-0002 (planlı) ile senkron.

---

# 13. İlişkiler ve Durum

- [[PM-ID-0002]] — Karar kaynağı (3-of-5, threshold+DKG, home-state).
- [[SPEC-BC-0001]] — Trust layer (`onlyOwnerState`, stateCode, `setRecognition`, RP/issuer escrow-geçerlilik kontrolü).
- [[SPEC-ID-0002]] — Guardian `entityId` = X.509 `issuerId` (kurumsal guardian kimliği); court-token X.509 imza zinciri.
- SPEC-ID-0001 — Pseudonym profili (§4 escrow'un öznesi).
- [[ADR-0002]] — Egemenlik-öncelikli yönetişim (home-state, 2/3, `setRecognition`).
- [[PM-TRUST-0001]] — Zincir kişisel/ilişkilendirilebilir veri tutmaz (§4 off-chain sınırı).
- Kaynak: "Assurance Guardian" ham taslağı — bu dokümana tümüyle içselleştirildi/resmileştirildi.
- PM-GOV-0001 (planlı) — N kurumlarının idari tanımı, acil-mod hukuki çerçevesi, sınır-ötesi anlaşmalar.

**review_status: Draft (v2.0.0).** Assurance Guardian taslağı bu spesifikasyona **eritildi** ve mevcut yapıyla çelişkiler kapatıldı: (a) kompozisyon kurumsal 5'liye + yürütme-dışı kuralına güncellendi (operatör/custodian oy koltuğu kaldırıldı); (b) kripto DKG + threshold (reconstruction yok) olarak netleştirildi; (c) **escrow enrollment modeli** (iki katmanlı verifiable-encryption escrow + makbuz + ağ-geçerlilik) eklendi — açık gap kapatıldı; (d) sınır-ötesi "Kim/Ne" ayrık-anahtar + akış + mutlak ret; (e) birleşik kontrat (domestic/cross-border/emergency, `getStatistics`, `resultCommit`); (f) acil-durum modu + gecikmeli bildirim tavanı. Kriptografik primitif detayları §12 ile bağımsız denetime bırakıldı. Solidity blokları arayüz taslağıdır; uygulama `contracts/src/`, escrow/guardian servisleri `services/` altında.
