---
document_id: ADR-0044
title: "ZK sunumu için kısa ömürlü kopyalar"
status: Active
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-09
summary: >
  Sıfır bilgi ispatlı (ZK) sunumda iptal listesi indeksi açılmadığı için iptal denetlenemez; kimlik belgesi 2 yıl geçerlidir
  ve sessiz yenilenmez. Karar: ZK sunumu yalnız kimlik servisinin ayrıca verdiği, en çok 24 saat geçerli, iptal listesi
  taşımayan kısa ömürlü mdoc kopyalarıyla yapılır. Cüzdan bu kopyaları paket hâlinde alır ve kullanıcıya sormadan yeniler;
  ana belge iptal edilmiş ya da askıdaysa yenileme reddedilir ve son kopya en geç 24 saatte geçersiz olur. Bu, AB ARF'nin
  kısa ömürlü belge yoludur (VCR_01: ≤ 24 saat, iptal gerekmez; §7.4.3.5.2 sınırlı süreli belgeler, toplu verme). AB ileride
  ZK için başka bir iptal yöntemi seçerse karar yeniden değerlendirilir. ADR-0023 AR4'e dar bir istisna getirir.
domain: Identity
related: ["[[ADR-0032]]", "[[ADR-0023]]", "[[ADR-0011]]", "[[ADR-0008]]", "[[SPEC-CRED-0003]]", "[[SPEC-WALLET-0001]]"]
---

# Kısaca

Bir kimlik belgesi sıfır bilgi ispatıyla gösterildiğinde doğrulayıcı onun iptal edilip edilmediğini göremez. Bu yüzden ZK ile
yalnız kısa ömürlü kopyalar gösterilir: her kopya en çok 24 saat geçerlidir ve cüzdan onları kendiliğinden yeniler. Belge iptal
edilirse kimlik servisi yeni kopya vermez; elde kalan kopya da bir gün içinde geçersiz olur.

# Bağlam

- [[ADR-0032]] K6: ZK devresi iptal durumunu denetlemez; [[t:status-list]] indeksini açmak iki gösterimi birbirine bağlar. ZK4
  "ZK ile sunulan belgenin geçerlilik süresi kısa tutulur" der. Bugün bu karşılanmıyor: ZK ile sunulabilen tek belge kimlik
  belgesidir (mdoc), 2 yıl (730 gün) geçerlidir ve kimlik servisi kişi alanlarını saklamadığı için sessiz yenilenmez
  ([[ADR-0023]] AR4). İptal edilen bir kimlik belgesi ZK ile gösterildiğinde doğrulayıcı bunu göremez; politika bunu ancak
  `accept_unrevocable_zk: true` ile bilerek kabul edebilir.
- AB [[t:ARF]] 3.0 (2026-07-23) iptal için iki yol tanır (Annex 2, Topic 7, VCR_01 / VCR_01b): **en çok 24 saat geçerli kısa
  ömürlü belge vermek — böylece iptal hiç gerekmez —** ya da durum listesi / iptal listesi kullanmak. 24 saatlik süre ETSI EN
  319 411-1 REV-6.2.4-03A'nın "iptal en geç 24 saatte işlenir" kuralından gelir. ARF §7.4.3.5.2 aynı belgenin çok sayıda
  teknik kopyasının toplu verilmesini ve **sınırlı süreli belgeler** (Topic 10, yöntem B) yöntemini tanımlar; §5.3'te teknik
  kopyaların kısa teknik geçerlilikle yeniden verilmesini anlatır. Yeniden verme mümkün olduğunca kullanıcı eylemi gerektirmez
  (ISSU_42).
- AB ZK yöntemini henüz seçmedi (ARF §7.4.3.5.3: "tartışmalar sürüyor"; TS4, TS13, TS14). ZK için gizli iptal kanıtı AB
  tarafında tanımlı değil.
- Proje yönetiminin yönü: AB'nin önerdiği ya da ileride seçeceği yol bu ise onu uygulamak.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **A — ZK için kısa ömürlü kopyalar (paket + sessiz yenileme)** | **kabul** | AB ARF'nin bugün tanımladığı yol (VCR_01: ≤ 24 saat, iptal gerekmez; toplu verme, sınırlı süreli belge). İptal edilen belge en geç 24 saatte ZK ile gösterilemez olur; kurum belgesi ve devre değişmez. |
| B — ZK içinde gizli iptal kanıtı (iptal edilmemiş olduğunu indeksi açmadan ispatlamak) | ileride | AB'de tanımlı şema yok (TS13/TS14 iptal bölümü açık); devre değişir, kurumların liste biçimi değişebilir. AB bir şema seçerse bu ADR yeniden değerlendirilir. |
| C — Kabul edip belgelemek (`accept_unrevocable_zk` ile) | ret (geçiş dışında) | İptal edilen kimlik belgesi 2 yıla kadar ZK ile geçerli görünür; ZK4'ün ikinci yarısı hiç karşılanmaz. A uygulanana kadar bugünkü davranış budur. |
| Kimlik belgesinin tamamını kısa ömürlü yapmak | ret | Kimlik belgesi kişi alanları saklanmadan yeniden verilemez; her yenileme yeniden kimlik doğrulaması olurdu. |
| 7 günlük ZK kopyaları | ret | ARF'nin "iptal gerekmez" eşiği 24 saattir; 7 gün iptali bir haftaya kadar geciktirir. |

# Karar

## K1 — ZK yalnız kısa ömürlü kopyayla
ZK sunumu ([[ADR-0032]], `mso_mdoc_zk`) yalnız kimlik servisinin bu amaçla verdiği **ZK kopyasıyla** yapılır. ZK kopyası, kimlik
belgesinin mdoc temsilinin bir teknik kopyasıdır:
- geçerliliği (`validFrom` → `validUntil`) **en çok 24 saattir**;
- iptal listesi (`status`) taşımaz — ARF VCR_01'e göre iptal yerine kısa ömür kullanılır;
- yalnız ZK sunumunda kullanılır; klasik sunum (`mso_mdoc`, `dc+sd-jwt`) bugünkü kopyalarla ve iptal denetimiyle sürer;
- doğrulayıcının ZK ispatından ayırt edebileceği bir işaret taşır (ispatın bağladığı belge türü ya da ayrı imza sertifikası;
  seçim uygulama tasarımında yapılır, yeni kamuya açık ad gerekirse proje yönetiminin onayına sunulur).

## K2 — Paket ve sessiz yenileme
Kimlik servisi ilk ihraçta ve her yenilemede küçük bir ZK kopyası paketi verir (her kopya ayrı cihaz anahtarına bağlı; toplu
verme). Cüzdan, son kopyanın bitmesine kısa süre kala kullanıcıya sormadan yeni paket alır. [[ADR-0023]] K1'in koşulları
geçerlidir: ağ var, rastgele gecikme; kullanıcı ayarı ("kopyaları otomatik yenile") kapatırsa ZK kopyası yenilenmez ve ZK
sunumu kullanılamaz (klasik sunum sürer).

## K3 — Yenileme yolu ve kişi verisi
- Yenileme, OpenID4VCI yenileme belirteciyle yapılır; belirteç ilk ihraçtaki [[t:DPoP]] anahtarına ve cüzdan onayına
  ([[t:WUA]]) bağlıdır, tek kullanımlıktır ve her kullanımda değişir ([[ADR-0023]] K2, AR2).
- Kimlik servisi kişi alanlarını **saklamaz** ([[ADR-0011]] K4). ZK kopyasına girecek asgari alanlar belirtecin içinde, yalnız
  kimlik servisinin açabileceği biçimde şifreli ve imzalı taşınır; belirteç cüzdanda durur, sunucuda kayıt tutulmaz.
- Belirteç, ana kimlik belgesinin iptal listesi girdisine bağlıdır. Kimlik servisi her yenilemede bu girdinin durumunu kendi
  listesinden okur; belge **iptal edilmiş ya da askıdaysa yeni kopya vermez** ve belirteci geçersiz sayar.
- Yenileme isteği hangi doğrulayıcıya ne gösterildiğini içermez; kimlik servisinin günlüğüne kişi verisi ve belirteç yazılmaz.

## K4 — İptalin etkisi
Ana belge iptal edilince yeni ZK kopyası verilmez; cüzdandaki son kopya en geç 24 saat içinde geçersiz olur. Böylece iptal ZK
sunumunda en geç 24 saatte etkili olur (klasik sunumda yayın aralığı kadar, [[SPEC-CRED-0003]] §5.3).

## K5 — Doğrulayıcı
Doğrulayıcı, K1 işaretini taşıyan ZK sunumunu "iptal denetimi gerekmeyen kısa ömürlü belge" sayar (`status.value =
NOT_APPLICABLE`, gerekçe kısa ömür); `accept_unrevocable_zk` yalnız işaret taşımayan ZK sunumu için gerekir. A uygulanana kadar
bugünkü kural sürer: işaretsiz ZK sunumu, politika `accept_unrevocable_zk: true` demedikçe DOĞRULANAMADI'dır.

## K6 — AB yolu değişirse
AB ZK için başka bir iptal yöntemi (ör. gizli iptal kanıtı) seçerse ya da kısa ömür eşiğini değiştirirse bu karar yeniden
değerlendirilir (seçenek B).

# Değişmezler

| Kod | Kural |
|---|---|
| ZC1 | ZK sunumu yalnız ZK kopyasıyla yapılır; ZK kopyası en çok 24 saat geçerlidir ve iptal listesi taşımaz. |
| ZC2 | Ana kimlik belgesi iptal edilmiş ya da askıdaysa kimlik servisi yeni ZK kopyası vermez. |
| ZC3 | ZK kopyası yenilemesi kişi alanlarını sunucuda saklamaz; alanlar yalnız kimlik servisinin açabileceği biçimde belirteçte, cüzdanda durur. |
| ZC4 | Doğrulayıcı kısa ömür işaretini taşımayan ZK sunumunu, politika açıkça kabul etmedikçe DOĞRULANAMADI sayar. |

# Sonuçlar

- [[ADR-0023]] AR4 daralır: kişi alanlarını saklamayan servisler yenileme belirteci vermez; tek istisna ZK kopyası belirtecidir
  (ZC3).
- [[ADR-0032]] K6 ve ZK4 bu ADR ile uygulanır: "kısa" en çok 24 saattir.
- Şartnameler (uygulamayla birlikte): [[SPEC-WALLET-0001]] (ZK kopyası deposu ve yenileme), [[SPEC-PROTO-0001]] §4.1
  (kimlik servisinde ZK kopyası belirteci), [[SPEC-API-0001]] D1 (kısa ömür işareti), kimlik rulebook'u.
- Kod: kimlik servisi (operatör deposu), `@tamga-network/wallet-core`, `@tamga-network/verifier`, cüzdan uygulaması.
  Paket değişikliği bir sonraki minör sürümdedir; yayımlanmamış 0.3.0 paketleri değiştirilmez.
- Tahmini iş: kimlik servisi 3–4 gün, wallet-core 3–4 gün, cüzdan uygulaması 2 gün, doğrulayıcı 1–2 gün, şartname + test +
  uyum vektörleri 2 gün — toplam yaklaşık 2,5–3 hafta.
- Kalıntı risk: kimlik servisi, yenileme sıklığından cüzdanın etkin olduğunu (günde bir yenileme) öğrenir; hangi doğrulayıcıya
  ne gösterildiğini öğrenmez. Rastgele gecikme ve kullanıcı ayarı bunu azaltır ([[ADR-0023]] K6 ile aynı denge).

# Durum

**Accepted — 2026-10-09.** Proje yönetimi onayıyla, AB'nin önerdiği yol olması koşuluyla (K6). DECISIONS: D-ZK-2. Uygulama
sırada.
