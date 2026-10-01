---
document_id: ADR-0036
title: Güven Federasyonu — Dış Listeler (ETSI LoTE), Dış Cüzdan Sağlayıcıları ve AB PID Doğrulama
category: ADR
domain: Trust
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
tags:
  - adr
  - trust-list
  - federation
  - eudi
keywords:
  - LoTE
  - ETSI TS 119 602
  - external trusted list
  - PID
  - nested selective disclosure
summary: >
  Tamga LOTL'u başka işletmecilerin (devlet, devletin yetkilendirdiği kurum, AB) yayınladığı güven listelerini gösterebilir:
  adres + LOTL'da sabitlenmiş imzacı + kapsam (hangi roller, hangi belge türleri) + onay kaydı. İlk okunan biçim ETSI TS 119 602
  (LoTE JSON). Kapsamdaki cüzdan sağlayıcılarının cüzdanlarına belge verilebilir; kapsamdaki kimlik/belge sağlayıcılarının
  belgeleri (AB PID, mDL dahil) doğrulanabilir. Belirli bir dış listeye güvenmek bu ADR'nin kararı DEĞİLDİR — her liste proje
  yönetimi onayıyla LOTL'a girer.
related:
  - "[[ADR-0009]]"
  - "[[ADR-0025]]"
  - "[[ADR-0035]]"
  - "[[SPEC-TRUST-0001]]"
---

# Özet (sade)

- Bir devlet ya da AB kendi güven listesini yayınladığında, Tamga'nın listeler listesi (LOTL) o listenin **adresini,
  imzacısını ve neye kefil olabileceğini** gösterir. Liste sahibinde kalır; Tamga yalnız toplar.
- Cüzdan ve doğrulayıcı tek bir şeye güvenmeye devam eder: Tamga LOTL'unun kök anahtarı. Gerisini LOTL söyler.
- Dış liste **kapsamının dışına çıkamaz**. Örneğin yalnız kimlik sağlayıcılarına kefil olan bir liste diploma veren kurum ekleyemez.
- Bugün LOTL'da dış liste **yok**. Bir listenin eklenmesi ayrı bir onaydır.
- Ayrıca doğrulayıcı artık AB kimlik belgesini (PID) ve ehliyeti (mDL) tanıyor. AB kimliğindeki iç içe alanlar (adres alt alanları,
  vatandaşlıklar dizisi) seçici olarak açılabiliyor.

# Bağlam

[[ADR-0035]] Tamga Network'ü bir **federasyon** olarak konumladı: ülke listelerini toplar ve birbirine tanıtır. [[ADR-0009]] devir
hedefini koymuştu: devlet geldiğinde listenin sahibi değişir, kimlikler değişmez. Bunun teknik kapısı yoktu:

1. Kod yalnız Tamga kökünün imzaladığı ve Tamga biçimindeki (`tamga-tl+jwt`) listeleri okuyordu.
2. Devletler ve AB listelerini ETSI biçiminde yayınlar. AB, eIDAS 2.0 cüzdan rolleri (cüzdan sağlayıcıları, kimlik
   sağlayıcıları, erişim sertifikası sağlayıcıları) için ETSI TS 119 602 "Lists of Trusted Entities" (LoTE) kullanıyor.
3. Belge verme servisimiz yalnız Tamga listesindeki cüzdan sağlayıcılarının cüzdanlarına belge veriyordu. TÜBİTAK ya da bir AB
   cüzdanı bu yüzden Tamga kurumlarından belge alamıyordu.
4. Doğrulayıcı AB PID / mDL türlerini tanımıyordu. SD-JWT paketi de yalnız kök düzeydeki alanları açabiliyordu; iç içe seçici
   açıklama yoktu (RFC 9901 §4.2).

Proje yönetimi bu açıkların kapatılmasını onayladı (2026-10-01; birebir alıntı özel onay kaydında, "Konumlanma (Yol 3) ve genel
toparlama").

# Karar

## K1 — LOTL'da dış liste işaretçisi

`lotl.external_lists[]`. Her kayıtta şunlar bulunur:

| Alan | Anlamı |
|---|---|
| `list_id` | Kalıcı kimlik |
| `territory` | Ülke (ISO 3166-1) ya da `EU` |
| `format` | `etsi-lote-json` (okunur); `etsi-tl-xml` (tanımlı, okuyucusu yok → yüklenmez) |
| `list_url` | Özgün yayın adresi |
| `signing_keys` | Listeyi imzalayan sertifikaların SHA-256 parmak izleri; **Tamga imzalı LOTL'da sabit** |
| `operator` | Listeyi işleten |
| `status` | Durum |
| `scope` | Kapsam: aşağıdaki K2 |
| `approval` | Onay tarihi ve kaydı (FD4) |

Yayıncı listenin kopyasını `trust.tamga.network/external/<list_id>.jws` adresinde tutar (`npm run trust:external`). Okuyucular
önce bu kopyayı, yoksa özgün adresi kullanır. İmza her iki durumda LOTL'daki sabit imzacıya karşı denetlenir; kopya içeriği
değiştiremez.

## K2 — Kapsam

`scope.entity_kinds` ⊂ {`wallet_provider`, `pid_provider`, `eaa_provider`, `access_ca`}. Kimlik ve belge sağlayıcıları için
`scope.vct` (kefil olunabilecek belge türleri) zorunludur. Kurumun doğrulama politikasında görünen sınıflandırması kapsamdan
gelir: `category`, `assurance`, `class`, `recognized_by`. Cüzdan sağlayıcıları için `min_key_storage` tanımlanabilir.

## K3 — Okuma kuralları

- Her dış liste **bağımsızdır.** Biri eksik, bayat ya da doğrulanamaz olsa bile Tamga listelerinin tazeliği bozulmaz. O listeye
  bağlı sorular UNKNOWN döner (doğrulayıcıda INDETERMINATE).
- ETSI hizmet türü → rol eşlemesi URI'nin yol parçasına göredir: `WalletSolution`, `PID`, `EAA`, `WRPAC`. `…/Issuance`
  imzalama, `…/Revocation` iptal listesi imzalama demektir. Geri çekilmiş hizmetler alınmaz.
- Listedeki hizmet sertifikası **güven çapasıdır**: bir CA ya da doğrudan imzacının kendisi olabilir. Doğrulayıcı belge zincirinin
  bağlandığı çapanın parmak izini çıkarır ve dış kurumu buradan çözer.
- Sıra numarası geri gidemez (geri sarma reddi). Bilinmeyen `LoTEVersionIdentifier` yüklenmez (CMP2).

## K4 — Belge verme (dış cüzdanlar)

Kurum, kapsamında `wallet_provider` olan bir dış listenin tanıdığı sağlayıcının cüzdan kanıtını (WIA/WUA) kabul eder. Kapsamdaki
`min_key_storage` kurumun kendi politikasından sıkıysa o uygulanır. Varsayılan değişmez: LOTL'a dış liste eklenmedikçe yalnız
Tamga listesindeki sağlayıcılar tanınır.

## K5 — Doğrulama (dış kurumlar, AB PID, mDL)

- **B2:** Tamga kataloğunda olmayan tür yalnız şu iki koşulla kabul edilir: belge zinciri bu türe kefil olan bir dış listenin
  çapasına bağlıysa ve tür, dış tür tanımlarındaysa (`urn:eudi:pid:1`, `eu.europa.ec.eudi.pid.1`, `org.iso.18013.5.1.mDL`).
  B4 (Tamga kataloğu özeti) bu durumda uygulanmaz. Tamga türlerinde `vct#integrity` zorunlu kalır.
- **C:** C1/C2 dış listenin tazeliği ve kapsamından gelir. C3, kapsamdaki `recognized_by` ile değerlendirilir. C4 ve `iss`
  tutarlılığı uygulanmaz.
- **D:** İptal listesi imzacısı, kurumun dış listedeki iptal hizmeti sertifikasıdır (yoksa çapanın kendisi).
- **E:** E1–E3 değişmez; iç içe yollar (`address.locality`) için kapsam, alanın kendisi ya da atası üzerinden değerlendirilir.

## K6 — İç içe seçici açıklama

SD-JWT çözümü RFC 9901 §7.1'e göre yapılır. Nesne içinde `_sd`, dizi öğelerinde `{"...": özet}` kullanılır; açıklanan değerler
özyinelemeli çözülür; her disclosure tam bir kez kullanılır; eşleşmeyen disclosure reddedilir. Yollar `a.b` ve `a[i]` biçimindedir.
Kural tek gerçeklemededir (`@tamga-network/core/sd-structure`); doğrulayıcı ve cüzdan aynı kodu kullanır. DCQL yolları
(`["address","locality"]`, `["nationalities", null]`) bu biçime çevrilir.

# Değişmezler

| Kod | Kural |
|---|---|
| FD1 | Dış liste yalnız Tamga imzalı LOTL'da adresi, sabitlenmiş imzacı parmak izi ve kapsamıyla gösterilir; imzacısı LOTL'dakiyle eşleşmeyen liste yüklenmez. |
| FD2 | Dış liste kapsamı dışındaki rollere ve belge türlerine kefil olamaz; kapsam dışı kayıtlar yok sayılır. |
| FD3 | Dış listenin eksik, bayat ya da doğrulanamaz olması Tamga listelerinin tazeliğini bozmaz; o listeye bağlı her soru UNKNOWN döner. |
| FD4 | Bir dış listenin LOTL'a girmesi, değişmesi ya da çıkması proje yönetimi onayıyla olur ve kayıt `approval` alanında belirtilir; yer tutucu içeren kayıt yayınlanmaz. |
| FD5 | Tamga türlerinde `vct#integrity` zorunludur; dış türlerde tür güveni dış listenin imzalı kaydından gelir. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Dış kayıtları Tamga listesine kopyalamak | ret | Kayıt Tamga'nın imzasıyla görünür: sahiplik yanlış, devir anlamsız ve yanlış beyan riski var. |
| Doğrulayıcıların dış listeleri kendilerinin seçmesi | ret (varsayılan olarak) | Her doğrulayıcı farklı güvenir; cüzdan ve kurum için tek güven çapası kaybolur. Kurumlar yine kendi `TrustSource`'unu verebilir (BT4). |
| **LOTL'da işaretçi + sabit imzacı + kapsam** | **kabul** | AB LOTL'unun modeli; sahiplik listede kalır; devirde yalnız adres ve imzacı değişir ([[ADR-0009]]). |
| Önce ETSI TS 119 612 XML okuyucusu | ertelendi | AB'nin yeni cüzdan rolleri 119 602 JSON ile yayınlanıyor; XML (nitelikli güven hizmeti sağlayıcıları) e-imza ortaklığıyla gündeme gelir. |

**Bilinen sınırlar:**

- Dış cüzdan sağlayıcılarının cüzdan kanıtı **biçimleri** (WIA alanları) üreticiye göre farklılık gösterebilir. Gerçek bir dış
  cüzdanla birlikte çalışabilirlik testi ayrıca yapılmalı.
- `access_ca` kapsamı tanımlı ama bu sürümde yalnız depolanıyor. Dış erişim sertifikalı doğrulayıcıların cüzdanda gösterimi sonraki
  iş.
- Cüzdanın dış listeleri okuması varsayılan kapalı (`externalLists`). Açılması dış kurum belgelerinin cüzdanda tanınması için
  gerekir.

# Sonuçlar

Uygulandı (2026-10-01):

- `@tamga-network/trust`: tür, LoTE okuyucusu, depo, `TrustSource` ve HTTP / dizin yükleyicileri.
- Yayıncı: kayıt doğrulama ve `external-fetch`.
- `@tamga-network/verifier`: çapa üzerinden dış kurum çözümü, dış türler ve iç içe yollar.
- `@tamga-network/sd-jwt` ve wallet-core: iç içe seçici açıklama.
- `@tamga-network/issuer` ve kurum servisi: dış sağlayıcının anahtar deposu kuralı.
- `@tamga-network/schemas`: dış tür tanımları.
- Tamga Verify: dış çapalar kök kümesinde.
- Testler: sentetik dış LoTE ile federasyon uyum testleri; iç içe açıklama birim testleri.

# Durum

**Accepted — 2026-10-01** (proje yönetimi onayı). Belirli dış listeler (TÜBİTAK, AB LOTL, başka devletler) **ayrı onaylarla**
eklenir.
