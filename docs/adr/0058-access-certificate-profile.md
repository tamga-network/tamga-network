---
document_id: ADR-0058
title: "Erişim sertifikası profili (ETSI TS 119 411-8) ve kimlik servisi sertifikasının geçiş zamanı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-21
last_updated: 2026-10-21
summary: >
  Doğrulayıcı erişim sertifikaları (WRPAC) ETSI TS 119 411-8 V1.1.1 §6.6.1'e göre yazılır: konu alanında kurum kimlik
  numarası (değişmedi), `CN` kişinin tanıyacağı ticari ad ya da hizmet adı, SAN'da kayıttaki alan adına ek olarak destek
  adresi (URI; GEN-6.6.1-07 iletişim bilgisi). Hizmete bağlı erişim sertifikası verilen doğrulayıcıda hizmet kimliği
  (`serviceIdentifier`, AB TS5) `OU` alanındadır (GEN-6.6.1-08). Politika tanımlayıcısı ve CPS adresi (GEN-6.6.1-03/06)
  ağın sertifika uygulama beyanı yayımlanınca eklenir. Kimlik servisinin belge imza sertifikasına `organizationIdentifier`
  (ADR-0050 K3) bugün değil, ağın işletmesi vakfa devredilirken yeni anahtarla verilir; böylece kimlik belgeleri bir kez
  yeniden alınır; devir bugünden betikli tek adım olarak hazırlanır. Kabul: 2026-10-21.
domain: Identity
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0034]]", "[[ADR-0050]]", "[[SPEC-ID-0002]]"]
---

# Bağlam

- **AB kuralı (erişim sertifikası).** ETSI TS 119 411-8 V1.1.1 (2025-10) güvenen taraf erişim sertifikalarının politikasıdır;
  CIR 2025/848 Ek IV ve CIR 2026/1730 buna atıf yapar. Tüzel kişiye verilen sertifikada (§6.6.1):
  - GEN-6.1.1-04: `CN` kişinin tanıyacağı ticari ad ya da hizmet adı **olabilir**;
  - GEN-6.6.1-05: `organizationIdentifier` **zorunlu** (EN 319 412-1 §5.1.4);
  - GEN-6.6.1-07: güvenen tarafın iletişim bilgisi SAN'da **zorunlu** — en az biri: destek web adresi (URI), telefon
    (`otherName`, `id-at-telephoneNumber`) ya da e-posta (`rfc822Name`);
  - GEN-6.6.1-08: aynı kurumun farklı örnekleri için ek sertifikalar `OU` ile ayrılabilir;
  - GEN-6.6.1-03 / -06: politika tanımlayıcısı (ETSI `NCP-l-eudiwrp` = 0.4.0.194118.1.2 ya da sağlayıcının OID'i) ve CPS adresi.
- **AB TS5 (kayıt verisi).** `serviceIdentifier` isteğe bağlıdır; aracı kullanan doğrulayıcıda zorunludur. Tek hizmeti olan ya da
  hizmete bağlı erişim sertifikası istemeyen doğrulayıcı bu alanı yazmayabilir.
- **Bugün.** Tamga erişim sertifikası konu alanında `CN` (alan adı), `O`, `C` ve gerçek ağda `organizationIdentifier`
  ([[ADR-0026]] K3) taşır; SAN'da yalnız kayıttaki alan adı (`dNSName`, [[ADR-0034]]) vardır. **İletişim bilgisi yoktur**
  (GEN-6.6.1-07 karşılanmıyor); politika tanımlayıcısı ve CPS adresi yoktur. Hizmet kimliği kayıt sertifikasında (`service_id`)
  vardır, erişim sertifikasında yoktur. İlk AB uyum turu (2026-10-13, öneri 10) bunu "erişim sertifikasında hizmet kimliği yok"
  diye kaydetti.
- **Kimlik servisi sertifikası.** [[ADR-0050]] K3: kimlik numarası kayda girince kimlik servisine yeni anahtar ve
  `organizationIdentifier`'lı sertifika verilir. Numara 2026-10-19'da kayda girdi, ama bu numara **geçici işletmecinindir**; ağın
  işletmesi vakfa devredildiğinde numara yine değişir. Kimlik servisinin anahtarı değişince bütün kimlik belgeleri yeni anahtarla
  yeniden alınmalıdır (belgenin imzacısı değişir). Bugün yapılırsa kişiler kimliklerini iki kez yeniden almak zorunda kalır.

# Karar

## K1 — Erişim sertifikasının konu alanı
- `organizationIdentifier` ve `C` zorunludur (değişmedi, [[ADR-0026]] K3); `O` kurumun resmî adıdır.
- `CN`: kişinin tanıyacağı ticari ad ya da hizmet adı (kayıttaki `trade_name` ya da hizmetin adı). Alan adını `CN`'e yazmak artık
  gerekmez; kalıcı kimlik SAN'daki alan adıdır ([[ADR-0034]]).

## K2 — SAN: alan adı + iletişim
- SAN, kayıttaki alan adını (`dNSName`, [[ADR-0034]] CI3) ve **en az bir iletişim bilgisini** taşır. Tamga'da bu, kayıttaki
  destek adresidir (`support_uri`, [[ADR-0024]]) ve `uniformResourceIdentifier` olarak yazılır. Telefon ya da e-posta ek olarak
  yazılabilir; kişisel e-posta ya da kişisel telefon yazılmaz.
- Değer kayıttaki veriden türetilir (GEN-6.6.1-10); kayıtta destek adresi yoksa gerçek ağda erişim sertifikası verilmez.

## K3 — Hizmete bağlı erişim sertifikası
- Bir doğrulayıcı aynı kurum altında ayrı işletilen hizmetler için ayrı erişim sertifikası isterse, her sertifika hizmet kimliğini
  `OU` alanında taşır (GEN-6.6.1-08). Değer kayıttaki hizmet kimliğidir (kayıt sertifikasındaki `service_id` ile aynı). Bunlar
  güven listesinde ayrı `relying_parties[]` kayıtlarıdır, her biri kendi alan adıyla.
- Tek erişim sertifikasıyla birden çok kullanım (kapsam) işleten doğrulayıcıda (ağın kendi doğrulayıcıları gibi) `OU` yazılmaz;
  hizmet kimliği istek başına kayıt sertifikasında taşınır ([[ADR-0026]] K4).

## K4 — Politika tanımlayıcısı ve CPS (ertelenir)
- Erişim sertifikasına ETSI'nin `NCP-l-eudiwrp` tanımlayıcısı **yazılmaz**: bu tanımlayıcı, sertifikayı bir AB güven hizmeti
  sağlayıcısının ETSI EN 319 411-1 denetimiyle verdiği beyanıdır; Tamga bunu beyan edemez.
- Ağın kendi politika tanımlayıcısı ve CPS adresi, ağın sertifika uygulama beyanı yayımlandığında (vakıf kuruluşuyla) eklenir.

## K5 — Kimlik servisi sertifikasının geçiş zamanı ([[ADR-0050]] K3'ün zamanlaması)
- Kimlik servisinin belge ve iptal listesi imza sertifikasına `organizationIdentifier` **ağın işletmesi vakfa devredilirken**
  verilir: yeni anahtar (`issuer-id-2` ve `-status`), vakfın kimlik numarası, yeni `issuer_id`; eski sertifika örtüşme süresince
  yalnız eski belgeleri doğrulamak için listede kalır ([[ADR-0050]] K3, [[SPEC-ID-0002]] §4).
- O zamana kadar yayıncı uyarısı (ADR-0050 K4) sürer; kayıt sertifikası (WRPRC) üretimi etkilenmez.
- **Hazırlık bugünden:** sertifika yalnız hukuken var olan bir tüzel kişiyi adlandırabildiği için kimlik servisi sertifikası vakıf
  tüzel kişilik kazanınca değişir; ama devrin bütün adımları (geçici işletmecinin kimliğini taşıyan her kayıt ve sertifika, yeni
  anahtar ve sertifikalar, listenin yeniden yayımı, cüzdan pinleri, yeniden alma duyurusu) bugünden yazılı ve betikli tutulur:
  operatörün devir prosedürü ve hiçbir şeyi değiştirmeden planı yazdırıp girdileri denetleyen kuru prova aracı. Pilot öncesinde
  gerçek kullanıcı olmadığından devirde belgelerin yeniden alınması kabul edilebilir bir maliyettir.
- Daha önce yapılması gereken bir durum çıkarsa (anahtar sızıntısı, sertifika süresi, AB tarafının resmî isteği) geçiş aynı
  prosedürle o gün yapılır ve geçici işletmecinin numarası yazılır.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Hizmet kimliğini her erişim sertifikasına zorunlu yazmak | ret | TS5'te isteğe bağlı; tek sertifikayla çok kullanım işleten doğrulayıcı için hizmet kimliği istek başına kayıt sertifikasındadır |
| Hizmet kimliğini yeni bir X.509 uzantısında taşımak | ret | AB'de tanımlı uzantı yok; 411-8 `OU`'yu gösteriyor |
| `NCP-l-eudiwrp` yazmak | ret | Denetlenmiş bir AB güven hizmeti sağlayıcısı beyanıdır |
| Kimlik servisi anahtarını bugün değiştirmek | ret | Numara geçici işletmecinin; devirde yine değişir, kişiler kimliklerini iki kez yeniden alır |

# Değişmezler

| Kod | Kural |
|---|---|
| AC1 | Gerçek ağda erişim sertifikasının SAN'ı kayıttaki alan adını ve en az bir iletişim bilgisini (destek adresi) taşır. |
| AC2 | Hizmete bağlı erişim sertifikasında hizmet kimliği `OU` alanındadır ve kayıttaki hizmet kimliğiyle aynıdır. |
| AC3 | Erişim sertifikası, Tamga'nın beyan edemeyeceği bir AB sertifika politikası tanımlayıcısı taşımaz. |

# Uygulama

- `ops/pki-issue.ts`: `--contact-uri <adres>` (SAN `uniformResourceIdentifier`), `--contact-email <adres>` (SAN `rfc822Name`;
  kurumsal adres) ve `--service-id <kimlik>` (`OU`). `--prod` erişim sertifikasında `--contact-uri` zorunludur (AC1). Aynı
  anahtarla yenileme: `--key <özel anahtar dosyası>` ve `--replace` (eski sertifika yedek klasörüne alınır).
- 2026-10-21: gerçek ve sandbox doğrulayıcılarının erişim sertifikaları **aynı anahtarla** yeniden verildi (`CN` ticari ad, SAN alan
  adı + destek adresi + kurumsal e-posta). Sertifika değiştiği için `client_id` (`x509_hash`) değişti, kalıcı kayıt (`dns_name`)
  değişmedi; liste yayımlandı. Takma ad site anahtarı [[ADR-0031]] K2'ye göre `dns_name`'dir ([[SPEC-WALLET-0001]] §5.4.1;
  wallet-core 0.7.1 istemci kimliğiyle türetmeyi reddeder) — sitelerdeki takma adlar yenilemeden etkilenmedi (canlı denetimle).
- Liste yayıncısı: gerçek ağda etkin (ACTIVE) doğrulayıcının erişim sertifikasında SAN iletişim bilgisi yoksa uyarı (AC1); `OU` ↔
  kayıttaki hizmet kimliği denetimi (AC2) ilk hizmete bağlı sertifikayla eklenir.
- K5: vakıf devri iş listesinde; operatörün devir prosedürü ve kuru prova aracı hazır.

# Durum

**Accepted — 2026-10-21.** Proje yönetimi onayıyla (K1–K5 önerildiği gibi; K5'te devir bugünden hazırlanır). DECISIONS: D-REG-3.
