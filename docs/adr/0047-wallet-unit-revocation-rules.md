---
document_id: ADR-0047
title: "Cüzdan birimi iptali, cüzdan dışı iptal yolu ve cihaz kanıtı"
status: Active
version: 1.0.0
created: 2026-10-12
last_updated: 2026-10-14
summary: >
  AB Attestation Rulebook şablonu çalışmasında açık kalan dokuz konunun kararı. Cüzdan birimi iptali kurum belgelerini iptal
  etmez (belgeler cihaz anahtarına bağlıdır, birim iptal edilince kullanılamaz); kurumlar ek iptal koşullarını isteğe bağlı
  `revocation_policy_uri` bağlantısıyla yayımlayabilir; kaybolan ya da çalınan telefondan iptal kullanıcı hesabı olmadan, kurulumda
  verilen bir iptal sırrıyla yapılır; her cüzdan sağlayıcısı kişinin birimin iptal edildiğini cüzdan dışından öğrenebileceği en az
  bir yol sunar; cihaz kanıtı yalnız en yüksek cüzdan seviyesinde (W3) zorunludur. Ayrıca: nitelikli olmayan EAA göstergesi
  yazılmaz (ETSI), belgeye güven çapası konum alanı eklenmez, diplomada I3 kararı pilottan sonraya ertelenir. ADR-0025 K4'ü
  değiştirir. Kabul: 2026-10-12.
domain: Wallet
related: ["[[ADR-0025]]", "[[ADR-0024]]", "[[ADR-0022]]", "[[ADR-0042]]", "[[FW-POL-0001]]", "[[FW-POL-0002]]", "[[FW-RB-0001]]", "[[FW-RB-0002]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Rulebook'lar AB Attestation Rulebook şablonuna taşınırken ([[FW-RB-0001]] §11) ve iki politika belgesi yazılırken ([[FW-POL-0001]],
[[FW-POL-0002]]) dokuz konu "karar bekliyor" diye bırakıldı. Proje yönetimi 2026-10-12'de dokuzu için de önerileri kabul etti. Bu
karar beşini ağın kuralı yapar (K1–K5), üçünü gerekçesiyle kayda geçirir (K6–K8), birini ertelenmiş karar olarak tetikleyicisiyle
yazar (K9).

# Bağlam

| # | Konu | AB kaynağı | Bugün |
|---|---|---|---|
| 1 | Nitelikli olmayan EAA göstergesi | Şablon `eaa:eu:non-qualified` önerir (ARB_12); ETSI TS 119 472-1 EAA-5.2.2.1-01 nitelikli olmayan EAA'da `category` olmamasını ister | Tamga ETSI'yi izliyor |
| 2 | Güven çapasının konumu belgede (Ek V h) | ARB_21 | Konum belge verenin sertifika zinciri ve güven listeleri |
| 3 | Cüzdan birimi iptalinde kurum belgeleri | WURevocation_18 (PID sağlayıcısına zorunlu), WURevocation_19 (öbürlerine isteğe bağlı) | Yalnız kimlik servisi zincirleme iptal ediyor |
| 4 | Belge verenin ek iptal koşulları | VCR_05 | Ağın ortak iptal politikası var; kurumun ek koşulları için yer yok |
| 5 | WIA/KA politikasının ETSI TS 119 471 madde 6–7 ile hizalanması | WURevocation_03 | Satır satır karşılaştırılmadı |
| 6 | Kaybolan ya da çalınan telefondan iptal | WIAM_06 (sağlayıcıda kullanıcı hesabı), WURevocation_10 | [[ADR-0025]] K4: "kullanıcı hesabı gerektirir; sonraki adım" |
| 7 | İptalin kişiye cüzdan dışından bildirilmesi | WURevocation_14, WURevocation_16 | Ağ kuralı yok |
| 8 | Etkinleştirmede cihaz kanıtı | WIAM_04, WIAM_08 | Cüzdan sağlayıcısının kararı |
| 9 | Diplomada I3 akreditasyonu | — | "Pilottan sonra" |

Tamga'da hesap yoktur ve kişisel veri en az tutulur ([[ADR-0025]] WIA2). Ağ cüzdan işletmez, cüzdanları güven listesindeki
kayıtlarıyla tanır ([[ADR-0042]]); bu yüzden cüzdanlarla ilgili kurallar her cüzdan sağlayıcısının sağlaması gereken **sonuçlar**
olarak yazılır, yöntem sağlayıcınındır.

# Karar

## K1 — Cüzdan birimi iptali kurum belgelerini iptal etmez

- Cüzdan sağlayıcısı bir cüzdan birimini iptal ettiğinde **kurumların verdiği belgeler iptal edilmez**. ARF bunu belge verenlere
  isteğe bağlı bırakır (WURevocation_19); Tamga ağında kural olarak kullanılmaz. Bu nedenle kurum belgelerinin süresini WIA ve KA
  iptal bakım süresine bağlayan şart (ISSU_12d) uygulanmaz.
- **Kimlik servisi** (Tamga'nın PID karşılığı belge vereni) değişmeden, birimi en geç 24 saat içinde denetler ve o birimdeki kendi
  belgelerini iptal eder (WURevocation_18). Zincirleme iptal yapan belge veren, belgenin süresini verilirken sunulan WIA ve KA'nın
  iptal bakım süresiyle sınırlar ve istediği asgari bakım süresini tanıtım bilgisinde ilan eder (ISSU_12c, WUA_32; AB TS3
  `preferred_client_status_period`, `preferred_key_storage_status_period`). Paketler bunu 0.5.0'da sağlar; kimlik servisinde
  sınır, cüzdan sağlayıcıları ilan edilen süreyi karşılayan WIA ve KA verince açılır (bugünkü 60 günlük bakım süresiyle 2 yıllık
  kimlik belgesi 60 güne inerdi).
- **Uygulama notu (2026-10-14):** sınır kimlik servisinde açıldı; gerçek ağda ve sandbox'ta her zaman açıktır (yalnız yerel
  geliştirmede kapatılabilir). İlan edilen tercih kimlik belgesinin süresine eşittir: WIA ve KA için 730 gün. Tamga Wallet
  sağlayıcısı (TAMGA-WP-1) istenen süreyi 730 güne kadar verir ve cüzdan bu süreyi ister; böylece kimlik belgesi 2 yıl kalır. 60 gün
  veren bir sağlayıcıda belge 60 gün olur. Tercih bilerek kısaltılmaz (ör. 723 gün): sağlayıcı istenen süreyi verdiği için belge her
  zaman o kadar kısalırdı. Cüzdan kalan süreyi tercihin en çok 7 gün altında da yeterli saydığından belge 723–730 gün arasında
  biter.
- **Neden yeterli:** her kopya cihazdaki bir belge sahibi anahtarına bağlıdır (`cnf`); anahtar cihazın güvenli donanımında üretilir,
  dışa aktarılamaz (RB-WP-01) ve her gösterim o anahtarla imza ve PIN ya da biyometri ister (RB-WP-03). Belge başka bir cihazdan
  gösterilemez. Birim iptal edilince:
  1. hiçbir belge veren o cüzdana yeni belge ya da yenileme vermez ([[ADR-0025]] WIA4; [[ADR-0023]] yenileme geçerli WIA ister);
  2. iptali gören cüzdan belgelerini ve anahtarlarını siler (Tamga Wallet'ta kural, cüzdanın kendi kararı);
  3. kimlik servisinin belgesi iptal olur; kimliğe dayanan akışlar durur;
  4. kurum belgeleri süresi dolunca biter (öğrenci belgesi en çok 90 gün).
- **Kalan risk:** telefonu ve kilit açma bilgisini birlikte ele geçiren biri, telefon ağa bağlanmadıkça süresi dolmamış bir kurum
  belgesini gösterebilir. Kişi bunun için kurumdan iptal isteyebilir ([[FW-POL-0001]] §4). Zincirleme iptal bu riski kapatmazdı:
  telefon ağa bağlanmıyorsa cüzdan da silinmez, kurumun iptal listesi ise zaten bu yolla kullanılabilir.

## K2 — Kurumun ek iptal koşulları: `revocation_policy_uri`

- Kurum, ağın ortak iptal politikasına ([[FW-POL-0001]]) **ek** koşullarını kendi sayfasında yayımlayabilir (**MAY**). Bağlantı
  güven listesindeki kurum kaydında isteğe bağlı `revocation_policy_uri` alanında durur (kayıt verisi, [[ADR-0024]]; `info_uri`,
  `privacy_policy_uri` ile aynı biçim).
- Sayfa ortak politikayı **daraltamaz**: ortak koşullar her kurumda geçerlidir; kurum yalnız ekler (ör. "disiplin cezasıyla
  öğrencilik askıya alınırsa belge iptal edilir").
- Bağlantı kurumun kayıt başvurusunda verilir (liste yayıncısının kayıt aracı, https adresi); cüzdan kurum sayfasında gösterir.
- **Ad:** ARF VCR_05 bu belgeye "policy" der ("a policy specifying under which conditions … it issued will be revoked"); ad,
  AB kayıt verisindeki `*_policy_uri` alanlarının biçimini izler. `revocation_conditions_uri` önerildi; AB metniyle aynı terimi
  kullanmak için `revocation_policy_uri` seçildi.

## K3 — Kaybolan ya da çalınan telefondan iptal: hesap olmadan

- Her cüzdan sağlayıcısı, kişinin telefonu elinde olmadan cüzdan birimini iptal edebileceği bir yol **MUST** sunar
  (WURevocation_10, WIAM_06).
- Bu yol **kullanıcı hesabı gerektirmez.** Kabul edilen yöntem: birim etkinleştirilirken telefonda üretilen ve kişiye bir kez
  gösterilen bir iptal sırrı; sağlayıcı yalnız yavaş özetini birim kaydında tutar; kişi sırrı sağlayıcının web sayfasına yazar,
  birim ve bütün WIA girişleri iptal olur. Sayfa kişisel veri istemez ve göstermez. Tamga Wallet bunu kapatma kodu ve "Telefonumu
  kaybettim" sayfasıyla yapar (cüzdanın WA-ADR-0002 kararı).
- **ARF'den sapma:** WIAM_06'nın öngördüğü kullanıcı hesabı yerine kurulumda kaydedilen sır. "Kişinin açık isteği" ve
  "etkinleştirmede kayıt" şartları karşılanır; sertifikasyon aşamasında bu eşdeğerlik ayrıca savunulur.
- Bu karar [[ADR-0025]] K4'teki "kayıp veya çalıntı cihazdan iptal kullanıcı hesabı gerektirir; sonraki adıma bırakılır"
  maddesinin yerini alır.

## K4 — İptalin cüzdan dışından öğrenilmesi

- Her cüzdan sağlayıcısı, kişinin cüzdan biriminin iptal edildiğini **cüzdan dışından** öğrenebileceği en az bir yol **MUST** sunar
  (WURevocation_16). Sağlayıcı birimi kendi kararıyla iptal ettiyse yol iptalin nedenini, neyin çalışmaya devam ettiğini ve kişinin
  ne yapabileceğini en geç 24 saat içinde gösterir (WURevocation_14).
- Yöntem sağlayıcınındır; yol kişisel veri toplamayı zorunlu kılmaz. Tamga Wallet bunu herkese açık güvenlik duyuruları ve kapatma
  koduyla açılan, veri tutmayan bir "cüzdanımın durumu" sayfasıyla yapar (cüzdanın WA-ADR-0008 kararı).

## K5 — Cihaz kanıtı yalnız en yüksek cüzdan seviyesinde zorunlu

- Cüzdan seviyeleri Trust Framework'teki üç seviyedir: W1 yazılım anahtarı (belge verilmez, RB-WP-01), W2 cihazın güvenli bölgesi,
  W3 sertifikalı güvenli donanım.
- **W3:** cüzdan sağlayıcısı birimi etkinleştirirken ve W3 beyan eden her KA'dan önce platformun cihaz kanıtını (Apple App Attest,
  Android anahtar kanıtı, Play Integrity) **MUST** doğrulamak; doğrulanmamış cihaza W3 KA verilmez ([[ADR-0025]] WIA3 "seviye
  gerçeği söyler").
- **W2:** cihaz kanıtı isteğe bağlıdır (**MAY**); cüzdan sağlayıcısının kararıdır. Tamga Wallet canlıda yalnız donanım kanıtı
  doğrulanmış cihaza WIA verir (cüzdanın WA-ADR-0005 kararı); bu, ağın asgarisinin üstüdür.

## K6 — Nitelikli olmayan EAA göstergesi yazılmaz (ARB_12)

AB şablonu nitelikli olmayan EAA için `category` alanında `eaa:eu:non-qualified` değerini önerir. ETSI TS 119 472-1 V1.2.1,
EAA-5.2.2.1-01 ise AB'de kayıtlı, nitelikli ya da kamu olmayan belge verenin SD-JWT VC EAA'sında `category` claim'inin **olmamasını**
ister. Tamga ETSI'yi izler: nitelikli olmayan belgede `category` yazılmaz; göstergesi bu yokluktur. Nitelikli ya da kamu sınıfında
`category` Tamga değerleriyle yazılır (RB-AP-14, [[ADR-0022]]). Şablonun değeri kullanılmaz.

## K7 — Belgeye güven çapası konum alanı eklenmez (ARB_21)

Belgede ayrı bir güven çapası konumu alanı olmaz; güven çapalarının tek kaynağı güven listeleridir ([[SPEC-TRUST-0001]]).
Gerekçe:
- **Güven belgeden gelmez.** Belgenin içindeki bir konum belge verenin kendi beyanıdır; sahte bir belge veren sahte bir konum
  yazabilir. Doğrulayıcı güven çapasını yalnız kendi seçtiği, imzası sabitlenmiş listeden almalıdır (ARB_26; ETSI TS 119 472-2
  `trusted_authorities`); belgedeki konuma uymak bir aldatma yolu açar.
- **Ek V h zaten karşılanır.** Belge verenin sertifika zinciri `x5c` başlığındadır; zincirin kökü ve belge verenin kaydı listededir.
  Konum "belge verenin sertifikası + güven listesi" olarak rulebook'ta yazılıdır.
- **Tek kaynak tutarlılığı.** Çapa değişince (anahtar yenileme, askı) belgeler değişmez; liste değişir. Belgedeki bir konum
  eskiyebilir, liste eskimez.
- **Veri azaltma.** Her belgeye eklenen sabit bir alan bilgi taşımaz ama boyut ve bağlanabilirlik ekler.

## K8 — WIA/KA politikası ETSI TS 119 471 madde 6–7 ile hizalanır (WURevocation_03)

Cüzdan Kanıtı Politikası ([[FW-POL-0002]]) TS 119 471 V1.1.1'in 6. ve 7. maddeleriyle satır satır karşılaştırılır; karşılığı
olmayan maddeler politikaya cüzdan sağlayıcısının yükümlülüğü olarak eklenir (uygulama bildirgesi, şartlar ve koşullar, bilgi
güvenliği politikası, bağımsızlık, çok etkenli kimlik doğrulama, anahtar töreni ve donanım güvenlik modülü, kayıtlar, yedek, kriz,
sonlandırma, mahremiyet, tedarik zinciri). Uygulama Tüzüğü (AB) 2025/1569'un TS 119 471'e getirdiği değişiklikler ayrıca okunur.

## K9 — Diplomada I3: pilottan sonra karar (ertelenmiş karar)

Diploma türünde I3 (akredite) belge vereni zorunlu kılmak bugün **kararlaştırılmaz**; asgari I2, I3 önerilir (**SHOULD**) olarak kalır.
**Tetikleyici** (hangisi önce gelirse): (a) eğitim pilotunun sonuç raporu, (b) pilot ortağı dışındaki ilk kurumun diploma vermek
için başvurusu, (c) bir devletin eğitim makamının ağa katılması. Tetikleyici gerçekleşince konu proje yönetimine getirilir.

# Değerlendirilen seçenekler

| Konu | Seçenek | Sonuç | Neden |
|---|---|---|---|
| 3 | Kurum belgelerinde zincirleme iptal ağ kuralı | ret | Kurumun birimi bilmesi için her belge kaydına WIA iptal girişi yazılması gerekir (bir tanımlayıcı); belge süresi WIA bakım süresiyle sınırlanır (ISSU_12d); güvenlik kazancı küçük (K1) |
| 4 | Ayrı alan yok, `info_uri` sayfasında anlatılsın | ret | Kişi koşulları bulamaz; cüzdan ayrı gösteremez |
| 6 | Sağlayıcıda kullanıcı hesabı (WIAM_06 birebir) | ret | "Hesap yok" ilkesi; kişisel veri |
| 7 | Push ya da SMS ile bildirim | ret (ağ kuralı olarak) | Push cüzdandan bağımsız değil; SMS kayıp telefona gider ve kişisel veri ister |
| 8 | Her seviyede cihaz kanıtı zorunlu | ret | Cihaz kanıtı her platformda ve her cihazda yok; W2 cüzdanları dışarıda kalır |
| 1 | Şablonun `eaa:eu:non-qualified` değeri | ret | ETSI'nin bağlayıcı profiliyle çelişir |
| 2 | İsteğe bağlı `trust_anchor` alanı | ret | K7 |

# Değişmezler

| Kod | Kural |
|---|---|
| WR1 | Cüzdan birimi iptali kurum belgelerini iptal etmez; kimlik servisi o birimdeki kendi belgelerini en geç 24 saat içinde iptal eder. |
| WR2 | Kurumun `revocation_policy_uri` sayfası ağın ortak iptal politikasına yalnız koşul ekler; ortak koşulları daraltamaz. |
| WR3 | Cüzdan sağlayıcısı telefon olmadan çalışan ve kullanıcı hesabı gerektirmeyen bir birim iptal yolu sunar. |
| WR4 | Cüzdan sağlayıcısı, kişinin birimin iptal edildiğini cüzdan dışından öğrenebileceği en az bir yol sunar. |
| WR5 | W3 seviyesi beyan eden KA yalnız platformun cihaz kanıtı doğrulanmış birime verilir. |

# ARF eşlemesi

| Madde | Karşılık |
|---|---|
| ARB_12, ARB_25 | K6 |
| ARB_21 | K7 |
| WURevocation_18, WURevocation_19, ISSU_12c, ISSU_12d | K1 (ISSU_12d uygulanmaz) |
| VCR_05 | K2 + [[FW-POL-0001]] |
| WURevocation_03 | K8 + [[FW-POL-0002]] §9 |
| WURevocation_10, WIAM_06 | K3 (WIAM_06 sapma olarak) |
| WURevocation_14, WURevocation_16 | K4 |
| WIAM_04, WIAM_08 | K5 |

# Sonuçlar

- Çerçeve: [[FW-RB-0001]] RB-AP-27, RB-WP-15, RB-WP-16, RB-WP-17; [[FW-POL-0001]] §3.2 ve §8; [[FW-POL-0002]] §2, §5, §9 ve yeni
  ETSI TS 119 471 eşlemesi; [[FW-RB-0002]], [[FW-RB-0003]], [[FW-RB-0004]], [[FW-RB-0005]] §2.0 ve §7.2; Trust Framework §2.2.
- [[SPEC-TRUST-0001]] §4: kurum kaydında `revocation_policy_uri`.
- `@tamga-network/trust` (kayıt şeması), liste yayıncısının kayıt aracı, `wallet-core` kurum dizini (`revocationPolicyUri`).
- [[ADR-0025]] K4: kayıp/çalıntı maddesi bu karara yönlendirilir.
- Cüzdanlar: Tamga Wallet K3 ve K4'ü WA-ADR-0002 ve WA-ADR-0008 ile zaten karşılar; WA-ADR-0002 K4.2'deki "kurum belgeleri için
  ağda kural önerilir" maddesi bu kararla kapanır (kural yok).

# Durum

**Accepted — 2026-10-12.** Proje yönetimi onayıyla. DECISIONS: D-CRED-8.
