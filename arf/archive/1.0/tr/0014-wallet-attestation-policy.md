---
document_id: FW-POL-0002
title: "Cüzdan Kanıtı Politikası (WIA ve KA)"
status: Active
version: 1.0.0
created: 2026-10-11
last_updated: 2026-10-11
summary: >
  Tamga güven listesindeki her cüzdan sağlayıcısının cüzdan örneği kanıtını (WIA) ve anahtar kanıtını (KA) nasıl verdiğini,
  hangi koşullarda iptal ettiğini ve iptali nasıl yayımladığını tek yerde toplayan politika (AB ARF VCR_05, WURevocation_03,
  WURevocation_09a). Ağ cüzdan işletmez; bu belge ağın, listedeki cüzdan sağlayıcılarından beklediği asgari politikadır ve
  ADR-0025, cüzdan şartnamesi ve Tamga Rulebook kurallarından derlenmiştir.
---

# 1. Kapsam ve statü

Tamga Network hiçbir cüzdanı ve cüzdan sağlayıcısını işletmez; cüzdanları güven listesindeki kayıtlarıyla (`wallet_providers[]`)
tanır ([[ADR-0042]]). Bu politika, listedeki her [[t:wallet-provider|cüzdan sağlayıcısının]] verdiği iki kanıt için ağın asgari
kurallarını toplar:

- **Cüzdan örneği kanıtı ([[t:WIA]])** — cüzdan uygulamasının (Wallet Instance) belge verene kendini tanıttığı kısa ömürlü kanıt;
- **Anahtar kanıtı (KA)** — belge anahtarlarının hangi güvenli donanımda ve hangi kullanıcı doğrulamasıyla korunduğunu gösteren kanıt.

İkisi birlikte AB'deki cüzdan birimi kanıtının (WUA) karşılığıdır. Politika karar üretmez: kurallar [[ADR-0025]], [[SPEC-WALLET-0001]],
[[SPEC-PROTO-0001]] §11.1, Tamga Rulebook RB-WP ve RB-AP kuralları ve Trust Framework'ten (Ek A) derlenmiştir. Her cüzdan sağlayıcısı
bu kurallara uyar; kendi işletim ayrıntılarını (ör. kurulum, destek, bildirim kanalları) kendi politikasında yazar.

# 2. Cüzdan biriminin etkinleştirilmesi

| Kural | Kaynak |
|---|---|
| Cüzdan ilk kurulumda sağlayıcıya bir **birim anahtarı** kaydeder; bu anahtar yalnız cüzdan ile sağlayıcı arasında kullanılır, hiçbir kuruma gösterilmez; birimle ilgili istekler birim anahtarıyla imzalanır | [[ADR-0025]] K1 |
| Birim kaydı yalnız birim anahtarının parmak izini, çözüm ve sürümü, kayıt zamanını, iptal durumunu ve birime verilmiş WIA iptal listesi girişlerini tutar; **kişisel veri tutulmaz** | [[ADR-0025]] K1, WIA2 |
| Belge sahibi anahtarları cihazın güvenli bölgesinde (W2) ya da sertifikalı güvenli donanımda (W3) üretilir; dışa aktarılamaz, bir tohumdan türetilmez; yazılım anahtarlı (W1) cüzdana belge verilmez | RB-WP-01, [[SPEC-WALLET-0001]] WL1, WL3 |
| Cüzdan sağlayıcısı kullanıcı adına kurtarma anahtarı tutmaz | RB-WP-07 |

# 3. WIA'nın verilmesi

| Kural | Kaynak |
|---|---|
| Biçim: OpenID4VCI 1.0 Ek E (`oauth-client-attestation+jwt`); AB TS3 §2.3.1 alanları: `sub`, `wallet_name`, `wallet_version`, `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk` | [[ADR-0025]] K2 |
| WIA cüzdan sürümünü, anahtarın donanımda olduğunu ve PIN ya da biyometrinin etkin olduğunu beyan eder | RB-WP-02 |
| Ömür **24 saatten kısadır**; `client_status.exp` en az 31 gün ileridedir | [[ADR-0025]] K2, WIA1 |
| **Her belge işleminde yeni WIA**: yeni bir sahiplik kanıtı (PoP) anahtarı ve yeni, birbirine bağlanamaz bir iptal listesi girişi. Belge veren başına yeniden kullanım yoktur; böylece sağlayıcı cüzdanın kaç kurumla görüştüğünü öğrenmez | [[ADR-0025]] K2, WIA1 |
| WIA, sağlayıcının güven listesinde kayıtlı imza anahtarıyla imzalanır | RB-WP-02, [[SPEC-TRUST-0001]] |

# 4. KA'nın verilmesi

| Kural | Kaynak |
|---|---|
| Biçim: OpenID4VCI 1.0 Ek D (`typ` `key-attestation+jwt`); AB TS3 §2.3.2 alanları: `attested_keys`, `key_storage`, `user_authentication` (ISO 18045 seviyeleri), `certification`, `key_storage_status {status, exp}` | [[ADR-0025]] K3 |
| **Seviye gerçeği söyler:** KA'daki anahtar deposu seviyesi doğrulanmış duruma dayanır; doğrulanmamış bir beyan KA'ya yazılmaz. Sertifikasız donanım için sertifika bilgisi boş kalır | [[ADR-0025]] WIA3 |
| Bir KA bir paketteki bütün belge anahtarlarını taşır; her anahtar yalnız bir KA'da yer alır; KA bir kez kullanılır; belge isteğinin kanıtı (proof) `attested_keys[0]` ile imzalanır ve başlığında KA taşır | [[ADR-0025]] K3 |
| KA iptali **anahtar deposu türü başına ortak girişle** yapılır (AB TS3 Seçenek 1): yazılım deposu, Secure Enclave, StrongBox … her türün bir girişi vardır; birim kimliği KA'dan çıkarılamaz | [[ADR-0025]] K3 |

# 5. İptal koşulları

## 5.1 WIA

| Koşul | Sonuç | Kaynak |
|---|---|---|
| Kişi cüzdandan "Bu cüzdanı iptal et" der (cihaz devri, satış) | Birim ve ona verilmiş bütün WIA girişleri iptal edilir | [[ADR-0025]] K4 |
| Kişi cüzdanı sıfırlayıp verilerini siler | Birim iptal edilir (WIA bitleri), sonra kayıt silinir | [[SPEC-WALLET-0001]] §7.6 |
| Tek bir cüzdan biriminde ihlal bulunur | O birim iptal edilir | RB-WP-11 |
| Cüzdan çözümünde (bir sürümde) açık bulunur | O sürümün cüzdan kanıtları iptal edilir; belge verenler yeni belgede reddeder | RB-WP-11, Ek A §4.6 |
| Birim iptal edilir | O birime verilmiş bütün WIA girişleri iptal olur | [[ADR-0025]] WIA2 |

Kaybolan ya da çalınan cihazdan iptal (kişinin cihazına erişimi yokken) bir kullanıcı hesabı gerektirir (AB WIAM_06); sonraki adıma
bırakılmıştır ([[ADR-0025]] K4) ve **karar bekliyor** (§9).

## 5.2 KA

| Koşul | Sonuç | Kaynak |
|---|---|---|
| Bir anahtar deposu ya da güvenli donanım **türünün** güvenilirliğini bozan bir açık ya da ihlal bulunur | Sağlayıcı o türün KA girişini iptal eder; o türdeki anahtarlarla yeni belge verilmez | [[ADR-0025]] K3, Ek A §4.6, AB ARF WURevocation_09a |
| Bir sürümün ya da tek bir birimin ihlali | §5.1'deki gibi WIA ile; KA girişi türe aittir, birime değil | [[ADR-0025]] K3 |

# 6. İptalin yayımlanması

| Kural | Kaynak |
|---|---|
| Sağlayıcı iki Token Status List yayımlar: WIA girişleri ve KA türleri. Listeleri güven listesinde kayıtlı kendi anahtarıyla imzalar | [[ADR-0025]] K4 |
| WIA listesi en az 10.000 girişlidir; girişler birime bağlanamaz biçimde dağıtılır | [[ADR-0025]] K2, K4 |
| Liste adresleri her WIA'da (`client_status`) ve KA'da (`key_storage_status`) yer alır; sağlayıcının adresi güven listesindeki kaydındadır | [[ADR-0025]], [[SPEC-TRUST-0001]] |

# 7. Belge verenlerin denetimi

| Kural | Kaynak |
|---|---|
| Belge veren, belge vermeden önce WIA'yı ve KA'yı `wallet_providers[]` listesine göre doğrular ve güvenli donanım seviyesinin türün şartını karşıladığını denetler | RB-AP-10 |
| PAR ve token uçlarında WIA: imza, sağlayıcı anahtarının listede olması, süre, PoP (`cnf`), `client_status` iptal değil. Belge ucunda KA: imza, proof'un `attested_keys[0]` ile imzası ve nonce, `key_storage_status` iptal değil, `key_storage` seviyesi kurumun alt sınırını karşılıyor | [[ADR-0025]] K5 |
| Belge veren iptal edilmiş bir WIA ya da KA ile **belge vermez** | [[ADR-0025]] WIA4 |
| Kurumun anahtar deposu şartı tanıtım bilgisinde ilan edilir (`key_attestations_required {key_storage, user_authentication}`) | [[ADR-0025]] K5 |

# 8. Olaylar ve bildirim

- Cüzdan çözümündeki açık kritik ya da yüksek önemde bir olaydır: kritik olay en geç 4 saatte, yüksek önemdeki olay en geç 24 saatte
  şema sahibine bildirilir (RB-GEN-09, Ek A §4.6).
- Cüzdan, "bu cüzdan Tamga güven listesinde" görünümünü ve "anahtarlarım nerede" açıklamasını sunar (RB-WP-10).
- Sağlayıcının güven listesindeki kaydı askıya alınır ya da çıkarılırsa belge verenler o sağlayıcının kanıtlarını kabul etmez;
  yalnız `ACTIVE` kaydın `ACTIVE` anahtarları kullanılır ([[SPEC-TRUST-0001]]).

# 9. Karar bekleyenler

| Konu | Durum |
|---|---|
| ETSI TS 119 471 madde 6–7 ve Uygulama Tüzüğü (AB) 2025/1569 ile hizalama (WURevocation_03) | AB, cüzdan sağlayıcısının WIA ve KA politikasını bu maddelere göre yazmasını ister. Bu politika o maddelerle henüz satır satır karşılaştırılmadı; karşılaştırma ve gerekirse ek maddeler **karar bekliyor** |
| Kaybolan ya da çalınan cihazdan iptal (AB WIAM_06) | Kullanıcı hesabı gerektirir; [[ADR-0025]] bunu sonraki adıma bıraktı. Yöntem **karar bekliyor** |
| KA için anahtar başına iptal girişi (AB TS3 Seçenek 2) | Güvenli donanıma geçişle birlikte ele alınacak ([[ADR-0025]] "sonra") |
| Cüzdan iptalinin kişiye cüzdan dışından bildirilmesi (AB WURevocation_14/16) | Ağ düzeyinde bir kural yok; her cüzdan sağlayıcısının kendi kararıdır. Ağ kuralı yapılması **karar bekliyor** |
| Cihaz kanıtı (App Attest, Android anahtar kanıtı, Play Integrity) | Etkinleştirmede cihaz kanıtının ağ düzeyinde zorunlu olması **karar bekliyor**; bugün cüzdan sağlayıcısının kararıdır |

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-11).
