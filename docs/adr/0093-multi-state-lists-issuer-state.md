---
document_id: ADR-0093
title: "Birden çok ülke listesi: kurum kimliği kurumun ülkesiyle, cüzdan bütün etkin listeleri yükler, sandbox'ta temsili AZ ve KZ"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-21
last_updated: 2026-11-21
summary: >
  Sınır ötesi doğrulama bugün çalışmıyor: doğrulayıcı ve cüzdan kurum kimliğini (issuerId) kendi ülke koduyla hesaplıyor, oysa
  SPEC-ID-0002 kurumun ülkesini ister. Karar: issuerId sertifikadan ve kurumun ülkesinden türetilir; yüklenen ülke listelerinde
  tam bir eşleşme aranır, birden çok eşleşme reddedilir, iss hiçbir zaman kaynak değildir. Cüzdan ve doğrulayıcı LOTL'daki
  bütün etkin ülke listelerini yükler; kendi ülkesi dışındaki bir listenin eksik ya da bayat olması yalnız o ülkenin kurumlarını
  UNKNOWN yapar. Sandbox'ta Azerbaycan ve Kazakistan için temsili test listeleri açılır (kendi imzacılarıyla, aynı sandbox
  kökü, kayıt makamı yok); sandbox'ta TR, AZ ve KZ birbirini tanır. Gerçek ağda AZ ve KZ yerleri RESERVED kalır. Kabul: 2026-11-21.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0035]]", "[[ADR-0036]]", "[[ADR-0038]]", "[[ADR-0070]]", "[[ADR-0026]]", "[[SPEC-ID-0002]]", "[[SPEC-API-0001]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Türk dünyası için kurulan ağın asıl işi, bir ülkenin kurumunun verdiği belgenin başka bir ülkede doğrulanmasıdır. Bugün bu
çalışmıyor: doğrulayıcı kurumun kimliğini kendi ülkesinin koduyla hesapladığı için Azerbaycan'daki bir üniversitenin diplomasını
Türkiye'deki bir işveren hiç bulamaz. Bu karar hatayı şartnameye göre düzeltir, cüzdanın ve doğrulayıcının birden çok ülke
listesini yüklemesini kurala bağlar ve bunu denemek için sandbox'ta Azerbaycan ve Kazakistan adına temsili test listeleri açar.

# Bağlam

- **Şartname.** [[SPEC-ID-0002]] §2: `issuerId = keccak256(stateCode, SHA-256(DER(issuerCert)))`; `stateCode` kurumun bağlı olduğu
  ülkedir ("TR", "AZ", "KZ"). Liste yayıncısı kaydı buna göre yazar.
- **Kod.** Doğrulayıcı (`@tamga-network/verifier`, A3b) `stateCode` olarak politikanın ülkesini, cüzdan çekirdeği varsayılan "TR"yi
  kullanıyor. Türkiye'deki bir doğrulayıcı Azerbaycanlı kurumun belgesi için listede olmayan bir kimlik hesaplar; belge C1'de
  reddedilir, tanıma denetimine ([[ADR-0035]]) hiç gelinmez. Bugün tek etkin ülke listesi TR olduğundan hata görünmüyordu.
- **Yükleme.** `@tamga-network/trust` birden çok ülke listesini yükleyebiliyor (`additionalStates`); cüzdan çekirdeği yalnız tek
  listeyi yüklüyor.
- **Liste yayıncısı** tek ülke listesi (TR) varsayıyor.
- **Sandbox.** Gösterim ağı planı (proje yönetimi, 2026-11-19) Azerbaycan ve Kazakistan'ı temsili ülkeler olarak, Günəşli ve
  Dalaqala üniversitelerini de onların kurumları olarak öngörür; senaryo: Kazak diplomasını Türk işveren doğrular. Proje
  yönetiminin yönü (2026-11-21): tam yol — listeler, yayıncı, cüzdan çekirdeği ve doğrulayıcı.

# Karar

## K1 — Kurum kimliği kurumun ülkesiyle (A3b uygulama notu)

- Doğrulayıcı ve cüzdan `issuerId`'yi belgenin imza sertifikasından türetir: yüklenmiş her ülke listesi `cc` için
  `keccak256(cc, SHA-256(DER))` hesaplanır ve o listede kayıtlı mı diye bakılır.
- Tam bir eşleşme varsa kimlik odur; sonraki bütün adımlar (C1–C4, iptal listesi çapası, tanıma) bu kimlikle yürür.
- Hiç eşleşme yoksa kurum listelerde yoktur (C1 RED). Birden çok eşleşme (aynı sertifika iki ülkenin listesinde) RED'dir.
- `iss` hiçbir zaman kimliğin kaynağı değildir; tutarlılık denetimi ([[SPEC-API-0001]] A3b) değişmez.
- Bu, [[SPEC-ID-0002]]'nin söylediğidir; kapatılmış bir karar değişmez, kod şartnameye uyar. [[SPEC-API-0001]] §1.2'ye uygulama
  notu eklenir.

## K2 — Cüzdan ve doğrulayıcı bütün etkin ülke listelerini yükler

- Cüzdan çekirdeği ve doğrulayıcı LOTL'daki `ACTIVE` ülke listelerinin hepsini yükleyebilir (`nationalLists: "all-active"`);
  hangi listelerin yükleneceğine imzası doğrulanmış LOTL karar verir.
- Kendi ülkesinin listesi (doğrulayıcıda politikanın ülkesi, cüzdanda ağın ana listesi) zorunludur; o eksik ya da bayatsa bugünkü
  gibi hiçbir soru cevaplanmaz.
- Başka bir ülkenin listesi eksik, bayat ya da doğrulanamazsa yalnız o ülkenin kurumlarına dair sorular UNKNOWN döner; diğer
  listeler etkilenmez ([[ADR-0036]] FD3 ile aynı ilke). Geri sarma koruması her liste için ayrıdır.

## K3 — Sandbox'ta temsili Azerbaycan ve Kazakistan listeleri

- Yalnız sandbox LOTL'ında AZ ve KZ yerleri `ACTIVE` olur; listeler `tl-az`, `tl-kz`. İşleten "Tamga Network Sandbox (TEST)"dir;
  `on_behalf_of` bunların temsili test yerleri olduğunu ve ilgili devletlerin katılımı ya da onayı olmadığını açıkça yazar.
- Her liste kendi imzacısıyla imzalanır ([[SPEC-TRUST-0001]] TL7): `tl-signer-az-1`, `tl-signer-kz-1` (sertifika adında "(TEST)",
  [[ADR-0038]] SB1). Sandbox kökü ve LOTL imzacısı değişmez; cüzdanlardaki sabit değerler aynı kalır.
- `national_root_ca` sandbox köküdür (yeni kök açılmaz). Kayıt makamı ve erişim sertifikası makamı rolleri `RESERVED`'dır;
  doğrulayıcılar TR listesinde kalır, AZ ve KZ listelerinde doğrulayıcı yoktur.
- Gerçek ağda AZ ve KZ yerleri `RESERVED` kalır ([[ADR-0009]] K5); bir devletin listesi ancak o devletle anlaşmayla açılır.

## K4 — Sandbox'ta tanıma

- Sandbox'ta TR, AZ ve KZ birbirini tanır (`recognition.recognizes`). Böylece Türkiye'deki bir doğrulayıcı politikası
  (`require_recognition`) Kazakistan'daki üniversitenin diplomasını kabul edebilir.
- Gerçek ağın tanıma kuralları değişmez ([[ADR-0035]]): tanıma anlaşma ister ve bugün yalnız TR kendini tanır.

## K5 — Sandbox kurumları ve görünür işaret

- Günəşli Texniki Universiteti (`gunesli`, AZ) ve Dalaqala Universiteti (`dalaqala`, KZ) kendi ülke listelerinde öğrenci belgesi
  ve diploma verir. Kurum adları kurgusaldır; sandbox sayfaları ülkelerin temsili olduğunu yazar ([[ADR-0038]] SB4).

## K6 — Sürüm ve geçiş

- Paketler yeni sürümle yayımlanır (çekirdek, güven, SD-JWT, doğrulayıcı, cüzdan çekirdeği). Eski sürümlü cüzdan ve doğrulayıcı
  yalnız TR listesini yükler: TR belgeleri için bir şey değişmez, AZ ve KZ belgeleri onlarda C1'de reddedilir.
- Yayın sırası: önce yayıncı ve sandbox listeleri (yeni yerin dosyası olmadan LOTL'a girmesi her şeyi UNKNOWN yapar), sonra
  doğrulayıcı ve belge veren servis, en son cüzdan.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **issuerId'yi yüklenen listelerde kurumun ülkesiyle eşlemek** | **kabul** | Şartnameye uyar; kimlik yine sertifikadan, `iss`'ten değil. |
| issuerId'yi `iss` alanındaki adresten ya da başlıktaki bir ülke alanından bulmak | ret | İmzalanan içerik kimliği seçer; A3b'nin kapattığı saldırıyı geri açar. |
| Bir ülke listesi bozulunca bütün güveni durdurmak | ret | Kazakistan listesinin bayatlaması Türk belgelerinin doğrulanmasını durdurmamalı; FD3 ile aynı ilke. |
| Sandbox'ta AZ/KZ kurumlarını TR listesine yazmak | ret | Federasyonu göstermez; sınır ötesi tanıma denenemez. |
| AZ ve KZ için ayrı sandbox kökleri | ret | Cüzdanlardaki sabit kök değerleri değişir; temsili listeler için gereksiz. |

# Değişmezler

| Kod | Kural |
|---|---|
| UL1 | `issuerId` belgenin imza sertifikasından ve kurumun kayıtlı olduğu ülke listesinin ülke kodundan türetilir; yüklenen listelerde tam bir eşleşme aranır, birden çok eşleşme RED'dir, `iss` kimliğin kaynağı olamaz. |
| UL2 | Kendi ülkesi dışındaki bir ülke listesinin eksik, bayat ya da doğrulanamaz olması yalnız o ülkenin kurumlarına dair soruları UNKNOWN yapar; kendi ülke listesi zorunludur. |
| UL3 | Temsili ülke listeleri yalnız sandbox'tadır; her biri kendi imzacısıyla imzalanır ve devlet katılımı olmadığını işletici alanında belirtir. Gerçek ağda bir ülkenin listesi ancak o ülkeyle anlaşmayla `ACTIVE` olur. |

# Sonuçlar

- `@tamga-network/trust`: sertifikadan kurum kimliği çözme; LOTL'daki bütün etkin listeleri yükleme, ülke başına UNKNOWN.
- `@tamga-network/sd-jwt`, `@tamga-network/verifier`, mdoc yolu: kurum kimliği güven kaynağından.
- `@tamga-network/wallet-core`: bütün etkin listeler; belge alırken kurum kimliği güven kaynağından.
- Liste yayıncısı: kayıt klasöründeki her `tl-*.source.json` için ayrı liste, her biri kendi imzacısıyla; kayıt sertifikaları ve
  erişim sertifikası işleri kayıt makamı olan listede kalır.
- Sandbox: yeni imzacılar ve kurum anahtarları, AZ ve KZ listeleri, Günəşli ve Dalaqala, AZ/KZ kişileri.
- Tamga Wallet: yeni çekirdek sürümü ve yeni derleme.
- Belgeler: [[SPEC-API-0001]] §1.2 uygulama notu; [[ADR-0038]]'e not.

# Durum

**Accepted — 2026-11-21** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-TRUST-9. UL1–UL3 bağlayıcıdır.
