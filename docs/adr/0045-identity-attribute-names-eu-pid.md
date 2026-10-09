---
document_id: ADR-0045
title: "Kimlik belgesinin alan adları: AB PID kodlaması"
status: Active
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-09
summary: >
  Tamga kimlik belgesi (`urn:tamga:id:IdentityAttestation:1`) alan adlarını ve kodlamasını AB kişi kimlik verisinin (PID)
  Komisyon Uygulama Tüzüğü (AB) 2026/1731 ile sabitlenen kodlamasına göre taşır: SD-JWT VC'de `birthdate` (eskiden
  `birth_date`) ve `nationalities` dizisi (eskiden tek değerli `nationality`; her öğe ayrı ayrı açıklanır); mdoc'ta `birth_date`
  (full-date, #6.1004) ve dizi değerli `nationality`. Ad, soyad, kimlik numarası ve veren ülke adları zaten aynıydı.
  `age_over_18` AB PID kümesinde yoktur; Tamga alanı olarak ISO/IEC 18013-5 adıyla iki biçimde de kalır. Tür, docType ve ad alanı
  değişmez; belge PID değildir. Geliştirme evresinde şema yerinde düzeltilir (ADR-0029). ADR-0013 K2'yi (öğe adları SD-JWT
  adlarıyla birebir) ve ADR-0011'in alan tablosunu değiştirir.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0029]]", "[[ADR-0036]]", "[[ADR-0032]]", "[[FW-RB-0003]]", "[[SPEC-ID-0003]]"]
---

# Kısaca

AB, kişi kimlik verisinin alan adlarını ve biçimini tüzükle sabitledi. Tamga'nın kimlik belgesi PID değildir, ama aynı adları
kullanırsa AB doğrulayıcıları ve cüzdanları onu ek bir eşleme yapmadan okuyabilir. Bu karar iki adı değiştirir (`birthdate`,
`nationalities`) ve mdoc biçiminde doğum tarihini AB'nin istediği tarih etiketiyle yazar.

# Bağlam

- Komisyon Uygulama Tüzüğü (AB) 2026/1731 (2026-07-22 yayın, 2026-08-11 yürürlük) 2024/2977'nin PID Ekini yeniden yazdı:
  - **SD-JWT VC** (Tablo 7–8): `family_name`, `given_name`, `birthdate` (YYYY-MM-DD), `place_of_birth`, `nationalities`
    (ISO 3166-1 alpha-2 dizisi; bilinmiyorsa `QU`, uyruksuz `QS`), `personal_administrative_number`, `issuing_country`,
    `date_of_expiry`, `date_of_issuance`… Bütün claim'ler, dizi öğeleri dahil, ayrı ayrı seçici açıklanır (§4.2; ARF PID_21).
  - **ISO mdoc** (Tablo 6): öğe tanımlayıcıları `family_name`, `given_name`, `birth_date` (`full-date` = #6.1004(tstr), RFC 8943),
    `place_of_birth`, `nationality` (kodlaması `nationalities` = dizi), `personal_administrative_number`, `issuing_country`…
  - Yaş öznitelikleri (`age_over_NN`) PID kümesinde **yoktur**; AB'de yaş için ayrı yaş doğrulama belgesi kullanılır.
- Tamga kimlik belgesi bugüne kadar iki biçimde de `birth_date` ve tek değerli `nationality` kullanıyordu ([[ADR-0011]] alan
  tablosu; [[ADR-0013]] K2 "öğe adları SD-JWT claim adlarıyla birebir"). AB PID'i dış tür olarak doğrulayan Tamga doğrulayıcısı
  ([[ADR-0036]]) iki ayrı ad kümesi tanımak zorundaydı; kurumların eşleştirme kuralları da Tamga'ya özgü adlara bağlıydı.
- Standart kütüphanesi kaydı KA-1731-3: "Kimlik belgesi alan adları AB PID SD-JWT kodlamasına hizalanır".
- Geliştirme evresindeyiz ([[ADR-0029]]): gerçek kullanıcı yok; şema yerinde düzeltilir, geriye uyum yazılmaz.
- Proje yönetiminin yönü (2026-10-09): doğum tarihi alanı `birthdate` olmalı; düzeltilsin.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **AB PID kodlaması, biçim başına (bu ADR)** | **kabul** | AB cüzdanları ve doğrulayıcılarıyla aynı adlar; SD-JWT ve mdoc'ta AB'nin kendi farkları aynen. |
| Bugünkü adlar + doğrulayıcıda eşleme tablosu | ret | Her doğrulayıcı ve kurum Tamga'ya özgü adları bilmek zorunda kalır; AB yönüyle çelişir. |
| İki biçimde tek ad (`birthdate` mdoc'ta da) | ret | AB mdoc kodlaması `birth_date` der; mdoc tarafında AB'den ayrılmak olurdu. |
| AB PID türünü ve ad alanını kullanmak (`urn:eudi:pid:1`, `eu.europa.ec.eudi.pid.1`) | ret | Belge PID değildir (TL8); AB ad alanı ve türü yalnız PID sağlayıcısınındır. |
| `age_over_18` yerine eski PID kural kitabı biçimi (`age_equal_or_over.18`) | ret | 2026/1731 PID kümesinde yaş yok; eski biçim yürürlükteki tüzüğe dayanmaz. ISO 18013-5 adı iki biçimde de anlaşılır. |

# Karar

## K1 — SD-JWT VC adları
Kimlik belgesinin SD-JWT VC temsili 2026/1731 Tablo 7–8 adlarını kullanır: `birthdate` (YYYY-MM-DD) ve `nationalities`
(ISO 3166-1 alpha-2 dizisi, en az bir öğe; bilinmeyen uyruk `QU`, uyruksuz `QS`). Dizinin her öğesi ayrı bir disclosure'dır
(RFC 9901 §4.2.2); Type Metadata'da `path: ["nationalities", null]`. `family_name`, `given_name`, `personal_administrative_number`
ve `issuing_country` adları zaten aynıydı.

## K2 — mdoc öğe adları ve kodlaması
docType (`urn:tamga:id:IdentityAttestation:1`) ve ad alanı (`tamga.id.1`) değişmez. Öğeler 2026/1731 Tablo 6'ya göre: `birth_date`
`full-date` olarak #6.1004(tstr) etiketiyle, `nationality` dizi olarak; öteki öğeler SD-JWT adlarıyla aynıdır. [[ADR-0013]] K2'deki
"öğe adları SD-JWT claim adlarıyla birebir" kuralı şöyle değişir: **iki biçim aynı veriyi taşır; ad ve kodlama her biçimde AB PID
tablosuna göredir.** Ad tablosu açık pakettedir (`@tamga-network/core/pid`); cüzdan ve doğrulayıcı iki biçimi bu tabloyla
karşılaştırır, kapsam (RP kaydı) adları SD-JWT adlarıdır.

## K3 — Yaş
`age_over_18` AB PID kümesinde yoktur. Tamga alanı olarak, ISO/IEC 18013-5 `age_over_NN` adıyla iki biçimde de aynen kalır;
ZK yüklemi ([[ADR-0032]]) değişmez.

## K4 — Tamga'ya özgü alanlar ve kapsam
`document_type`, `document_number_hash`, `document_chip_verified`, `verification_method` Tamga alanları olarak kalır. Karar
yalnız kimlik belgesini kapsar: sürücü belgesi bilgisi ISO/IEC 18013-5 mDL tanımlayıcılarını (`birth_date`), eğitim belgeleri
kendi şemalarını kullanmaya devam eder; kurumun kayıt kaynağı arayüzündeki `birth_date` eşleştirme anahtarı kurumun kendi
kaydıdır ve değişmez. Kurumlar kimlik belgesinden `birthdate` ister.

## K5 — Geçiş yok
Geliştirme evresi ([[ADR-0029]]): şema yerinde düzeltilir, eski ad için geriye uyum yazılmaz. Eski adlı deneme belgeleri yeni
şemayla doğrulanmaz; cüzdanlar kimlik belgesini yeniden alır.

## K6 — Açık nokta: `issuing_country`
2026/1731'de `issuing_country` PID sağlayıcısının ülkesidir; Tamga kimlik belgesinde ise doğrulanan kimlik belgesini veren
ülkedir. Ad bugün korunur; anlam farkı rulebook'ta yazılıdır. Ayrı bir ada geçiş yeni kamuya açık ad gerektirir ve proje
yönetiminin kararına bırakılmıştır.

# Değişmezler

| Kod | Kural |
|---|---|
| PD1 | Kimlik belgesinin alan adları ve kodlaması AB PID kodlamasına (Uygulama Tüzüğü (AB) 2026/1731: SD-JWT VC Tablo 7–8, mdoc Tablo 6) uyar; iki biçim aynı veriyi taşır. |
| PD2 | Dizi değerli alanların (`nationalities`) her öğesi ayrı ayrı seçici açıklanır (RFC 9901 §4.2.2). |

# Sonuçlar

- Şema kataloğu: `IdentityAttestation` yerinde düzeltildi (`birthdate`, `nationalities`); `vct#integrity` değişti.
- Kod: `@tamga-network/core/pid` (ad tablosu), `@tamga-network/mdoc` (`toPidMdocElements`, full-date), `@tamga-network/sd-jwt`
  (dizi öğesi disclosure'ı), `@tamga-network/issuer` (eşleştirme anahtarı `birthdate`), `@tamga-network/verifier` (mdoc
  adları → şema ve kapsam), `@tamga-network/wallet-core` (mdoc eşleşmesi, MD1, sürücü belgesi ön koşulu); kimlik servisi
  (operatör deposu); kurumların eşleştirme yapılandırması; güven listesindeki doğrulayıcı kapsamları.
- [[ADR-0011]] alan tablosu ve [[ADR-0013]] K2 / MD1 metni bu ADR'ye göre okunur; [[SPEC-ID-0003]] §9, [[FW-RB-0003]] §1, §6, §9
  güncellendi.
- Cüzdanlar kimlik belgesini yeniden alır (K5).

# Durum

**Accepted — 2026-10-09.** Proje yönetimi onayıyla. DECISIONS: D-ID-11.
