---
document_id: FW-POL-0003
title: "Kayıt Sertifikası Politikası"
status: Active
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  Tamga kayıt kurumunun doğrulayıcılara ve belge verenlere verdiği kayıt sertifikalarının (WRPRC, ETSI TS 119 475) politikası:
  kapsam, içerik ve kaynağı, PKI hiyerarşisi ve güven çapası, geçerlilik, iptal koşulları ve iptal isteği, durum listesi,
  cüzdanın denetimi ve politika kimlikleri (AB ARF RPRC_01b; TS 119 475 §6). ADR-0024, ADR-0026, ADR-0058 ve ADR-0068'den
  derlenmiştir; yeni kural koymaz.
---

# 1. Kapsam ve statü

Bu belge, Tamga ağında [[t:registration-certificate|kayıt sertifikası]] verenin (kayıt kurumu; bugün devlet adına geçici olarak
Tamga) politikasıdır. ETSI TS 119 475 §6.1.3 politikanın makine okunur ve insan okunur gösterilmesini ister: makine okunur
biçim her sertifikadaki `policy_id`, insan okunur biçim bu sayfadır (`certificate_policy`). AB ARF RPRC_01b iptal koşullarını
gösteren bir politika ister; koşullar §6'dadır.

Politika karar üretmez: kurallar [[ADR-0024]] (kayıt verisi), [[ADR-0026]] (kayıt sertifikaları), [[ADR-0058]] (erişim
sertifikası profili) ve [[ADR-0068]]'den (politika ve durum listesi) derlenmiştir. Çelişkide kaynak geçerlidir.

# 2. Sertifika ve konusu

| Konu | Kural |
|---|---|
| Kime | Güven listesindeki her doğrulayıcı kullanımı (`scope_id`) ve her belge veren için bir sertifika; yalnız tüzel kişiler |
| Biçim | JWT `rc-wrp+jwt` (JAdES B-B, x5c) ve yakın alan için aynı yükün CBOR biçimi `rc-wrp+cwt` (TS 119 475 §5.2) |
| İçerik kaynağı | Yalnız imzalı güven listesindeki kayıt; listede olmayan alan ya da tür sertifikaya girmez ([[ADR-0026]] WRC1) |
| Kimlik | `sub` = kurumun EN 319 412-1 semantik tanımlayıcısı (`VATTR-…`, `NTRTR-…`); erişim sertifikasındaki `organizationIdentifier` ile aynı ([[ADR-0058]]) |
| Kullanım | Doğrulayıcıda `credentials` (biçim, tür, alan yolları) ve `purpose`; belge verende `provides_attestations` |
| Kimlik numarası yoksa | Sertifika üretilmez |

# 3. PKI hiyerarşisi ve güven çapası

TS 119 475 OVR-6.1.4-02 hiyerarşinin açıkça tarif edilmesini ister.

| Katman | Ne | Nerede yayımlanır |
|---|---|---|
| Güven çapası | Listelerin listesi (LOTL) imza anahtarı | `trust.tamga.network/keys/root-fingerprints.json`, `tamga.network/trust-anchor`, Trust Framework ([[FW-TF-0001]]) |
| Kayıt kurumu anahtarı | Kayıt sertifikalarını **ve** durum listesini imzalar; liste imza anahtarından ayrıdır ([[ADR-0026]] WRC2) | LOTL `national_lists[].roles.registrar.signing_keys` (parmak izi) |
| Kayıt sertifikası | Yaprak belge; x5c'de kayıt kurumu sertifikası | `trust.tamga.network/wrprc/…` (dizin `wrprc/index.json`) |

Cüzdan kayıt sertifikasını, imzalı LOTL'den aldığı kayıt kurumu anahtarı parmak iziyle doğrular. Durum listesinin imzacısı da
aynı anahtardır (ARF RPACANot_03b).

# 4. Geçerlilik

- En çok 12 ay (TS 119 475 GEN-5.2.4-08) ve kaydın ya da kullanımın bitiş tarihini aşmaz ([[ADR-0026]] WRC3).
- Sertifika her liste yayınında kayıttan yeniden üretilir. İçerik değişmediyse aynı sertifika sayılır ve durum listesindeki
  yerini korur; içerik değişirse yeni sertifika verilir ve eskisi iptal edilir (§6).

# 5. Politika kimlikleri

| Ortam | `policy_id` | `certificate_policy` |
|---|---|---|
| Sandbox (test ağı) | `2.25.220506472418443381081254370400837050484` | bu sayfa |
| Gerçek ağ | ÖNERİ: kuruluşun IANA özel kuruluş numarası (PEN) altında; onaydan sonra yayımlanır | bu sayfa |

ETSI'nin AB politika OID'i `0.4.0.19475.3.1` kullanılmaz: o kimlik "AB kayıt kurumunca, revize eIDAS'a göre verildi" anlamı
taşır ([[ADR-0068]] WRS1). Bu sayfanın sürümü değişse de OID değişmez; politikanın anlamı değişirse yeni OID verilir.

# 6. İptal

**Koşullar** (TS 119 475 REV-6.2.3.9-04/07; ARF §6.4.3). Kayıt kurumu sertifikayı gecikmeden iptal eder:

| Durum | Neden kodu |
|---|---|
| Kaydın ya da kullanımın süresi bitti, kullanım sona erdirildi | `registration_ended` |
| Kayıt askıya alındı ya da iptal edildi, kayıt listeden kalktı | `registration_ended` |
| Sertifika içeriği kayıtla artık uyuşmuyor (kayıt değişti) | `superseded` |
| Geçerli bir iptal isteği (aşağıda) | `manual: <gerekçe>` |

Askı yoktur: askıya alınan kaydın sertifikası iptal edilir; kayıt yeniden etkinleşince yeni sertifika verilir.

**İptal isteği** (REG-6.2.2.3-05/06). Yalnız kayıt kurumundan, sertifikanın konusu olan kurumdan (yetkili temsilcisi dâhil) veya
yetkili bir kamu makamından (ör. veri koruma kurumu) kabul edilir. İstek, kaydı değiştirme yetkisiyle aynı yoldan doğrulanır
(kayıttaki iletişim bilgisi, nitelikli elektronik imza ya da önceden kurulmuş güvenli kanal). İsteyenin kimliği ve doğrulama
kaydı operatörün iç kayıtlarında tutulur (REG-6.2.2.3-07). Gerekçe serbest metindir (REV-6.2.3.9-06); herkese açık değişiklik
kaydına kişi adı yazılmaz.

**Etki.** İptal aynı yayında durum listesine yazılır; liste en geç bir saat içinde yeniden imzalanır.

# 7. Durum listesi

| Konu | Kural |
|---|---|
| Biçim | IETF Token Status List, `statuslist+jwt` (aynı biçim: [[SPEC-CRED-0003]]); `bits` = 1: 0 geçerli, 1 iptal (REV-6.2.6.2-04) |
| Sertifikadaki girdi | `status.status_list` = `{idx, uri}` (GEN-6.2.6.1-04) |
| Adres | yayın kökünde `/status/wrprc/<n>`; sandbox `https://trust.sandbox.tamga.network/status/wrprc/1` |
| İmza | kayıt kurumu anahtarı (§3) |
| Tazelik | `ttl` 1 saat, `exp` 24 saat; her saat yeniden imzalanır |
| İndeks | rastgele; iptal edilen indeks yeniden kullanılmaz |
| Erişim | herkese açık, kimlik doğrulaması yok; liste bütün sertifikaları taşır, hangi doğrulayıcıya bakıldığı anlaşılmaz |

# 8. Cüzdanın denetimi

[[ADR-0068]] K5 ve [[SPEC-WALLET-0001]]: cüzdan sertifikanın imzasını, süresini, erişim sertifikasıyla bağını ve iptal durumunu
denetler. İptal edilmiş sertifikalı isteğe veri gönderilmez, iptal edilmiş sertifikalı belge verenden belge istenmez. Durum
denetlenemezse (ağ yok ve geçerli kopya yok) kişi uyarılır.

# 9. Kararlar ve açık konular

| Konu | Durum |
|---|---|
| Politika kimliği, belge ve durum listesi (TS 119 475 Tablo 7, §6) | **Karar (2026-10-29, [[ADR-0068]]):** sandbox'ta yürürlükte |
| Gerçek ağın politika OID'i ve adresleri | Açık: ad onayı ve PEN başvurusu ([[ADR-0068]] K1) |
| Kayıt kurumu rolünün ulusal makama devri | Açık: devirde anahtar LOTL'de değişir, bu politika devralan makamın politikasıyla değiştirilir ([[ADR-0026]] "Sonuçlar") |

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-29).
