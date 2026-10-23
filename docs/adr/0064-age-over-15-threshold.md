---
document_id: ADR-0064
title: "Kimlik belgesinde yaş eşikleri: `age_over_15` ve `age_over_NN` deseni"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  Kimlik belgesi bugün tek yaş alanı taşıyor: `age_over_18`. Bu karar ikinci eşiği ekler: `age_over_15`, SD-JWT VC'de ve mdoc'ta
  (`tamga.id.1`) aynı adla, ISO/IEC 18013-5'in `age_over_NN` desenine göre. Kimlik belgesinin yaş eşikleri kapalı bir kümedir
  (bugün 15 ve 18) ve yalnız ADR ile değişir. Gizlilik `age_over_18` ile aynıdır: kimlik servisi değeri doğum tarihinden ihraç
  anında türetir, alan seçici açıklanır, doğrulayıcı doğum tarihini görmez. Sıfır bilgi ispatı devresi bir eşitlik ispatıdır,
  eşik devrede sabit değildir; aynı devre `age_over_15 = true` ispatlar, ZK kopyası iki eşiği taşır. Gerekçelerden biri Türkiye'de
  7578 sayılı Kanunla sosyal ağlar için getirilen 15 yaş kuralıdır (yürürlük 2026-11-01); karar hukuki görüş değildir. Önceden
  verilmiş belgeler alanı yeniden verilince alır (geliştirme evresi, ADR-0029). Kabul: 2026-10-23.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0029]]", "[[ADR-0032]]", "[[ADR-0039]]", "[[ADR-0043]]", "[[ADR-0044]]", "[[ADR-0045]]", "[[FW-RB-0003]]", "[[SPEC-ID-0003]]", "[[SPEC-SCHEMA-0003]]"]
---

# Kısaca

Kimlik belgesi artık "18 yaşından büyük mü" sorusunun yanında "15 yaşından büyük mü" sorusuna da cevap verir: `age_over_15`.
Ad ISO/IEC 18013-5'in yaş alanlarıyla aynı desendedir (`age_over_NN`). Doğrulayıcı yalnız evet/hayır görür; doğum tarihi
paylaşılmaz. Sıfır bilgi ispatı da aynı devreyle çalışır. Yeni bir yaş eşiği ancak yeni bir kararla eklenir.

# Bağlam

- **Bugün.** Ağın kimlik belgesi (`urn:tamga:id:IdentityAttestation:1`, [[ADR-0011]]) tek türetilmiş yaş alanı taşır:
  `age_over_18`. Ad ISO/IEC 18013-5'ten gelir ve iki biçimde aynıdır; AB PID kümesinde yaş alanı yoktur, alan Tamga'nın
  alanıdır ([[ADR-0045]]). Sıfır bilgi ispatının ilk yüklemi de bu alandır ([[ADR-0032]], [[ADR-0044]]).
- **Desen.** ISO/IEC 18013-5 (mDL) yaş için `age_over_NN` öğelerini tanımlar: NN iki haneli yaştır, değer boolean'dır; belge
  veren hangi eşikleri taşıyacağını seçer. AB'nin yaş doğrulama çalışmaları aynı adlandırmayı kullanır. Ağın sektör şeması
  kuralı da türetilmiş boolean alanları baştan tanımlamayı ister ([[SPEC-SCHEMA-0003]] SG3).
- **Türkiye.** 7578 sayılı Kanun (Resmî Gazete 2026-05-01) md. 22 ile 5651 sayılı Kanun Ek Madde 4'e eklenen fıkra, sosyal ağ
  sağlayıcısının 15 yaşını doldurmamış çocuklara hizmet sunmamasını ve bunun için yaş doğrulama dâhil gerekli tedbirleri
  almasını öngörür; md. 27'ye göre bu hüküm yayımdan altı ay sonra, **2026-11-01**'de yürürlüğe girer. Kanun sonucu belirler,
  yöntemi ikincil düzenlemeye bırakır. Bugün kimlik belgesi 15 yaş sorusunu doğum tarihini açmadan cevaplayamaz.
- **Bu karar hukuki görüş değildir.** Bir platformun yükümlülüğünü nasıl karşılayacağını, hangi yöntemin yeterli sayılacağını ya
  da ikincil düzenlemenin ne getireceğini belirlemez. Yalnız ağın kimlik belgesinin 15 yaş sorusuna en az veriyle cevap
  verebilmesini sağlar. Ağ yaş sınırı koymaz ([[ADR-0043]]); bu karar onu değiştirmez.

# Karar

## K1 — `age_over_15`

- Kimlik belgesi `age_over_15` (boolean) taşır: SD-JWT VC'de claim, mdoc'ta `tamga.id.1` ad alanında öğe, iki biçimde aynı ad.
- Değeri kimlik servisi ihraç anında doğum tarihinden türetir; kural `age_over_18` ile aynıdır: servis saatinin UTC takvim günü,
  kişi 15. doğum gününün başladığı gün eşiği geçer, 29 Şubat doğumlular artık olmayan yıllarda 1 Mart'ta. 15 yaşından küçük
  kişinin belgesinde değer `false`'tur.
- Alan seçici açıklanır (`sd: always`), türetilmiş alanlar listesindedir, şemada zorunlu değildir (`age_over_18` gibi).

## K2 — `age_over_NN` deseni ve kapalı küme

- Ağın yaş alanları ISO/IEC 18013-5 `age_over_NN` desenine uyar: NN iki haneli yaş, değer boolean, iki biçimde aynı ad.
- Kimlik belgesinin yaş eşikleri kapalı bir kümedir: bugün **{15, 18}**. Yeni eşik (ör. 13, 16, 21) yalnız ADR ile eklenir.
  Kümede olmayan bir eşiği isteyen doğrulayıcı eşleşme bulamaz; cüzdan eşiği kendisi hesaplamaz.
- Sürücü belgesi bilgisi ([[ADR-0039]]) yalnız `age_over_18` taşımaya devam eder; bu karar yalnız kimlik belgesini kapsar.

## K3 — Gizlilik `age_over_18` ile aynı

- Yaş alanı türetilmiş bir evet/hayır'dır; yaş doğrulamasında doğum tarihi açılmaz. Her eşik ayrı açıklanır; cüzdan yalnız
  istenen eşiği gösterir.
- İki eşiği birlikte açmak yaş aralığını (15–17) ele verebilir. Ağın doğrulayıcı politikaları bu yüzden tek eşik ister; iki eşiği
  birden isteyen kapsam, doğrulayıcı kaydında ayrıca gerekçelendirilmelidir.

## K4 — Sıfır bilgi ispatı

- Longfellow devresi (sürüm 8, tek öznitelik; [[ADR-0032]]) bir eşitlik ispatıdır: "bu ad alanında bu öğe şu değerdir". Eşik
  devrede sabit değildir; aynı devre `age_over_15 = true` ispatlar. Yeni devre ya da yeni kurulum gerekmez; güven listesindeki
  devre kaydı değişmez.
- ZK kopyası ([[ADR-0044]]) kimlik belgesindeki yaş alanlarını taşır: `age_over_18` ve `age_over_15`. Yenileme belirtecindeki
  asgari öğeler buna göredir; başka kişi alanı belirtece ve kopyaya girmez.

## K5 — Doğrulayıcı ve cüzdan

- Tamga Verify iki genel politika açar: `age-over-15-mdoc` (ISO 18013-5 mdoc, yalnız evet/hayır) ve `age-over-15-zk` (ZK kopyası,
  sıfır bilgi ispatı). Güven listesinde Tamga Verify'ın kaydına `age-over-15-1` ve `age-over-15-zk-1` kapsamları eklenir. Tarayıcı
  deneme sayfası 15 yaş seçeneği sunar.
- Cüzdan alanı kişinin dilinde adlandırır ("15 yaş üstü"). Cüzdandan cüzdana gösterme ayrı bir cüzdan kararıdır; bugün
  `age_over_18` ile sınırlı kalır.

## K6 — Geçiş yok

- Tür, `vct`, mdoc docType ve ad alanı değişmez. Şema metadata'sı geliştirme evresi kuralıyla yerinde düzeltilir
  ([[ADR-0029]]); `vct#integrity` değeri değişir.
- Önceden verilmiş belgeler `age_over_15` taşımaz; kişi belgeyi yeniden aldığında alan gelir. Geçiş kodu yazılmaz.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Doğrulayıcı doğum tarihini istesin, yaşı kendisi hesaplasın | ret | Gereğinden fazla veri; seçici açıklamanın amacına aykırı |
| Cüzdan eşiği doğum tarihinden kendisi hesaplasın | ret | Belge verenin imzası değeri kapsamaz; doğrulayıcı sonuca güvenemez |
| Kimlik belgesinde açık eşik kümesi (her NN serbest) | ret | Belgede sınırsız alan, doğrulayıcılar arasında tutarsızlık; eşik kümesi bilinçli büyümeli |
| Eşiği ZK devresinin parametresi yapmak (aralık ispatı) | ret (bugün) | Yeni devre ve doğrulayıcı değişikliği gerektirir; eşitlik devresi yeterli |
| 13, 16 ve 21'i de şimdi eklemek | ret (bugün) | Somut ihtiyaç yok; her eşik ayrı ADR ile, ihtiyaç doğunca |
| **`age_over_15`, ISO `age_over_NN` deseni, kapalı küme {15, 18}** | **seçildi** | Standart ad, aynı gizlilik, aynı devre, küçük değişiklik |

# Değişmezler

| Kod | Kural |
|---|---|
| YE1 | Kimlik belgesinin yaş alanları ISO/IEC 18013-5 `age_over_NN` adıyla ve boolean değerle, SD-JWT VC'de ve mdoc'ta aynı adla taşınır. Eşik kümesi kapalıdır (bugün 15 ve 18); yeni eşik yalnız ADR ile eklenir. |
| YE2 | Yaş alanı ihraç anında kimlik servisinde doğum tarihinden türetilir ve seçici açıklanır; yaş doğrulaması doğum tarihini açmaz; ağın doğrulayıcı politikaları tek eşik ister. |
| YE3 | ZK kopyası kimlik belgesinin yaş alanlarından başka kişi alanı taşımaz; yeni bir yaş eşiği eşitlik devresiyle ispatlanır, devre kaydı değişmez. |

# Sonuçlar

- Şema kataloğu: kimlik belgesi ve ZK kopyası türlerine `age_over_15` (`packages/schemas`).
- Kimlik servisi: türetme ve ZK kopyası öğeleri.
- Tamga Verify: `age-over-15-mdoc`, `age-over-15-zk`; güven listesi kapsamları (gerçek ağ ve sandbox); tarayıcı deneme sayfası.
- Cüzdan: alan adları (tr, en, tk).
- Belgeler: kimlik kural kitabı ([[FW-RB-0003]]) ve kimlik doğrulama şartnamesi ([[SPEC-ID-0003]]).
- Sonraki iş: cüzdandan cüzdana göstermede yaş eşiği seçimi (cüzdan kararı); başka eşikler ihtiyaç doğunca ayrı ADR ile.

# Durum

**Accepted — 2026-10-23** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-ID-14. YE1–YE3 bağlayıcıdır.
