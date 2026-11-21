---
document_id: ADR-0092
title: "Yaş eşiği `age_over_21`: kimlik belgesi ve sürücü belgesi bilgisi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-20
last_updated: 2026-11-20
summary: >
  Kimlik belgesinin kapalı yaş eşiği kümesine 21 eklenir: {15, 18, 21}. Sürücü belgesi bilgisi de `age_over_18`'in yanında
  `age_over_21` taşır; araç kiralama gibi sürücü belgesiyle yapılan doğrulamalar tek sunumda 21 yaşını sorabilsin diye. Ad ve
  gizlilik ADR-0064 ile aynıdır: ISO/IEC 18013-5 `age_over_NN` deseni, iki biçimde aynı ad, değer ihraçta doğum tarihinden
  türetilir, seçici açıklanır, doğum tarihi açılmaz, politikalar tek eşik ister. ZK kopyası değişmez (15 ve 18). Önceden verilmiş
  belgeler alanı yeniden verilince alır (ADR-0029). Kabul: 2026-11-20.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0026]]", "[[ADR-0029]]", "[[ADR-0032]]", "[[ADR-0039]]", "[[ADR-0043]]", "[[ADR-0044]]", "[[ADR-0064]]", "[[ADR-0089]]", "[[FW-RB-0003]]", "[[SPEC-ID-0003]]"]
---

# Kısaca

Kimlik belgesi ve sürücü belgesi bilgisi artık "21 yaşından büyük mü" sorusuna da evet/hayır cevap verir: `age_over_21`.
Birçok ülkede 21 önemli bir eşiktir (araç kiralama, bazı ülkelerde alkol). Doğrulayıcı yalnız evet/hayır görür; doğum tarihi
paylaşılmaz. Yaş eşikleri yine kapalı bir kümedir; bundan sonraki eşik de ayrı bir kararla eklenir.

# Bağlam

- **Bugün.** Kimlik belgesi (`urn:tamga:id:IdentityAttestation:1`, [[ADR-0011]]) iki türetilmiş yaş alanı taşır: `age_over_15`
  ve `age_over_18`; küme kapalıdır ve yeni eşik yalnız ADR ile eklenir ([[ADR-0064]] K2). Sürücü belgesi bilgisi
  (`urn:tamga:id:DrivingLicenceAttestation:1`, [[ADR-0039]]) yalnız `age_over_18` taşır.
- **İhtiyaç.** 21 yaş, araç kiralamada ve bazı ülkelerde alkol satışında kullanılan yaygın bir eşiktir; ISO/IEC 18013-5
  sürücü belgesi de `age_over_21`'i bilinen bir öğe olarak kullanır. Sandbox'taki örnek araç kiralama doğrulayıcısı bugün 18'i
  sormak zorunda kalıyor.
- **Tek sunum tek belge.** Doğrulayıcı bir sunumda tek belge doğrular. Araç kiralama sürücü belgesi bilgisini ister; yaş
  sorusunun aynı belgede cevaplanabilmesi için eşiğin sürücü belgesi bilgisinde de bulunması gerekir.
- **Proje yönetiminin yönü (2026-11-20):** 21 eklensin; başka eşikler (ör. 13, 16, 65) ihtiyaç doğunca ayrıca eklenir.

# Karar

## K1 — `age_over_21` kimlik belgesinde

- Kimlik belgesi `age_over_21` (boolean) taşır: SD-JWT VC'de claim, mdoc'ta `tamga.id.1` ad alanında öğe, iki biçimde aynı ad.
- Türetme kuralı `age_over_18` ile aynıdır ([[ADR-0064]] K1): kimlik servisinin saatine göre UTC takvim günü; kişi 21. doğum
  gününün başladığı gün eşiği geçer; 29 Şubat doğumlular artık olmayan yıllarda 1 Mart'ta. 21 yaşından küçük kişide değer
  `false`'tur. Kopyalar yenilenirken yeniden hesaplanır ([[ADR-0089]]).
- Alan seçici açıklanır (`sd: always`), türetilmiş alanlar listesindedir, şemada zorunlu değildir.
- Kimlik belgesinin eşik kümesi: **{15, 18, 21}**. Yeni eşik yine yalnız ADR ile eklenir.

## K2 — `age_over_21` sürücü belgesi bilgisinde

- Sürücü belgesi bilgisi `age_over_18`'in yanında `age_over_21` taşır; ad, kodlama ve türetme kuralı K1 ile aynıdır, değer
  karttaki doğum tarihinden türetilir ([[ADR-0039]] K3).
- Sürücü belgesi bilgisinin eşik kümesi: **{18, 21}**; kapalıdır, yalnız ADR ile değişir. [[ADR-0064]] K2'deki "sürücü belgesi
  bilgisi yalnız `age_over_18` taşır" hükmü bu kararla değişir.

## K3 — Gizlilik ve politikalar

- Gizlilik [[ADR-0064]] K3 ile aynıdır: her eşik ayrı açıklanır, cüzdan yalnız istenen eşiği gösterir, doğum tarihi açılmaz.
- Ağın politikaları tek eşik ister; iki eşiği birlikte istemek yaş aralığını ele verir. 21 yaşını soran bir politika 18'i
  ayrıca istemez.
- Bu karar yeni genel politika açmaz. Tamga Verify'ın araç kiralama politikası (`car-rental-driving`) 18 yerine 21'i sorar;
  gerçek ağ ve sandbox kayıtlarındaki `car-rental-driving-1` kapsamı buna göre güncellenir. Kapsam adı değişmez: geliştirme
  evresinde kayıtlar yerinde düzeltilir ([[ADR-0029]]); kapsamın kayıt sertifikası yeni alan kümesiyle yeniden üretilir ([[ADR-0026]]).

## K4 — ZK kopyası değişmez

- ZK kopyası ([[ADR-0044]]) bugün olduğu gibi `age_over_18` ve `age_over_15` taşır; `age_over_21` eklenmez. Eşitlik devresi
  21'i de ispatlayabilir ([[ADR-0064]] K4); ZK kopyasına eklenmesi ayrı bir iştir.

## K5 — Geçiş yok

- Tür, `vct`, mdoc docType ve ad alanı değişmez. Şema metadata'sı geliştirme evresi kuralıyla yerinde düzeltilir
  ([[ADR-0029]]); `vct#integrity` değeri değişir.
- Önceden verilmiş belgeler `age_over_21` taşımaz; kişi belgeyi yeniden aldığında ya da kopyası yenilendiğinde alan gelir.
  Geçiş kodu yazılmaz.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **21'i kimlik belgesine ve sürücü belgesi bilgisine eklemek** | **kabul** | Yaygın eşik; araç kiralama tek sunumda sürücü belgesiyle sorabilir. |
| Yalnız kimlik belgesine eklemek ([[ADR-0064]] gibi) | ret | Araç kiralama sürücü belgesini ister; bir sunumda tek belge doğrulanır, 21 sorulamaz. |
| 13, 16, 21 ve 65'i birlikte eklemek | ertelendi | Bugün ihtiyaç yalnız 21; her eşik açıklanabilir alan ve bakım demektir. İhtiyaç doğunca ayrı ADR. |
| Doğrulayıcının doğum tarihinden hesaplaması | ret | Doğum tarihi açılır; yaş doğrulamasında en az veri ilkesine aykırı. |

# Değişmezler

| Kod | Kural |
|---|---|
| YE4 | Kimlik belgesinin yaş eşik kümesi {15, 18, 21}, sürücü belgesi bilgisininki {18, 21}'dir; ikisi de kapalıdır ve yalnız ADR ile değişir. Alanlar ISO/IEC 18013-5 `age_over_NN` adıyla, iki biçimde aynı adla, ihraçta doğum tarihinden türetilip seçici açıklanır. |

# Sonuçlar

- Şema kataloğu: kimlik belgesi ve sürücü belgesi bilgisi türlerine `age_over_21` (`packages/schemas`).
- Kimlik servisi: kimlik belgesinde, sürücü belgesi bilgisinde ve yenilemede türetme.
- Tamga Verify: araç kiralama politikası 21 sorar; gerçek ağ ve sandbox kayıtlarındaki kapsam.
- Cüzdan: alan adı (tr, en, tk).
- Belgeler: kimlik kural kitabı ([[FW-RB-0003]]) ve rehberler.
- Sonraki iş: ZK kopyasında 21; başka eşikler ihtiyaç doğunca ayrı ADR ile.

# Durum

**Accepted — 2026-11-20** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-ID-19. YE4 bağlayıcıdır;
[[ADR-0064]] K2'nin sürücü belgesi hükmü bu kararla değişti.
