---
document_id: ADR-0025
title: "Cüzdan ve anahtar kanıtı"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-14
summary: >
  Tek, 30 günlük WUA yerine AB TS3 modeli: 24 saatten kısa ömürlü, her belge işleminde yeni anahtarlı ve yeni iptal listesi
  girişli Wallet Instance Attestation (WIA) + belge anahtarlarının deposunu anlatan key attestation (KA, `key_attestation`).
  Cüzdan sağlayıcısı wallet unit'i kaydeder, WIA–birim eşlemesini tutar, iptal listelerini yayınlar ve kullanıcının isteğiyle birimi
  iptal eder. Belge verenler WIA ve KA'yı ve iptal durumlarını doğrular. D-CRED-6'nın biçimini değiştirir.
domain: Wallet
---

# Bağlam

Tamga cüzdanı bugün [[t:wallet-provider|cüzdan sağlayıcısından]] (`wallet.tamga.network`) **30 gün geçerli tek bir [[t:WUA]]** alıyor. Belge
alırken her kuruma aynı WUA'yı gösteriyor (D-CRED-6, SPEC-PROTO-0001 §11.1). AB boşluk analizinde (H1) bu, en büyük eksik
gruplarından biri çıktı:
- konu 9: 22 madde,
- konu 38: 15 madde,
- VCR_01a/03a/07,
- WIAM_06/10.

AB TS3 (v1.5.2) ve [[t:ARF]] 3.0'a göre eksikler:

1. **Ömür ve bağlanamazlık.** [[t:WIA]] 24 saatten kısa ömürlü olmalı. Aynı WIA birden fazla kuruma gösterilmemeli; aksi hâlde
   kurumlar aynı cüzdanı birbirine bağlayabilir.
2. **Key attestation yok.** [[t:credential]] anahtarlarının hangi depoda durduğunu cüzdan sağlayıcısının imzalı bir
   `key_attestation` ile söylemesi gerekiyor ([[t:OpenID4VCI]] Ek D). Bugün kurum bunu WUA'daki bir beyandan okuyor.
3. **İptal yok.** Cüzdan sağlayıcısı WIA ve KA için [[t:status-list]] yayınlamalı, kullanıcının isteğiyle [[t:wallet-unit|wallet unit'i]]
   iptal edebilmeli (VCR_07, WURevocation_10). Bunun için hangi WIA'nın hangi birime ait olduğunu bilmeli.

Proje yönetimi H1 planını (P3: bu iş) onayladı ve sıradaki işlere geçilmesini istedi.

# Karar

## K1 — Wallet unit kaydı

Cüzdan ilk kurulumda cüzdan sağlayıcısına bir **birim anahtarı** kaydeder. Bu anahtar yalnız cüzdan ile sağlayıcı arasında
kullanılır, hiçbir kuruma gösterilmez. Sağlayıcı bir birim kaydı tutar:
- birim anahtarının parmak izi,
- çözüm ve sürüm,
- kayıt zamanı,
- iptal durumu,
- birime verilmiş WIA iptal listesi girişleri.

Kişisel veri tutulmaz. Birimle ilgili istekler birim anahtarıyla imzalanır.

## K2 — WIA (Wallet Instance Attestation)

- Biçim: OpenID4VCI 1.0 Ek E (`oauth-client-attestation+jwt`), TS3 §2.3.1 alanları: `sub`, `wallet_name`, `wallet_version`,
  `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk`.
- **Ömür < 24 saat** (Tamga: 23 saat). `client_status.exp` en az 31 gün ileride (Tamga: 60 gün).
- **Her belge işleminde yeni WIA:** yeni bir PoP (proof of possession) anahtarı ve yeni, bağlanamaz bir iptal listesi
  girişi. Kurum başına yeniden kullanım seçeneği kullanılmaz; böylece sağlayıcı cüzdanın kaç kurumla görüştüğünü öğrenmez.
- Sağlayıcı iptal listesi girişi ile birim arasındaki eşlemeyi tutar; birim iptal edilince bütün girişleri iptal olur.

## K3 — KA (key attestation)

- Biçim: OpenID4VCI 1.0 Ek D (`typ` `key-attestation+jwt`, Final Ek D.1; 2026-10-09 düzeltme: önceki metin taslaktaki `keyattestation+jwt` adını anıyordu), TS3 §2.3.2 alanları:
  - `attested_keys` (bir paketteki bütün belge anahtarları),
  - `key_storage` / `user_authentication` (ISO 18045 seviyeleri),
  - `certification`,
  - `key_storage_status {status, exp}`.
- **Dürüst seviye:** bugün anahtarlar yazılım deposunda (S-9). KA `key_storage: ["iso_18045_basic"]` der ve sertifika yoktur.
  Güvenli donanıma geçişte (Z1) seviye yükselir.
- İptal: **tür başına ortak giriş** (TS3 Seçenek 1). Yazılım deposu, Secure Enclave ve StrongBox'un her birinin bir girişi vardır.
  Birim kimliği KA'dan çıkarılamaz.
- Taşıma: `jwt` proof'unun başlığında `key_attestation`. Proof, `attested_keys[0]` ile imzalanır; paket tek proof'la istenir. Her
  anahtar yalnız bir KA'da yer alır. KA bir kez kullanılır.

## K4 — İptal listeleri ve kullanıcı isteğiyle iptal

- Sağlayıcı iki Token Status List yayınlar (WIA girişleri ve KA türleri). Listeleri kendi anahtarıyla imzalar; bu anahtar
  [[t:trust-list|güven listesinde]] kayıtlıdır. WIA listesi en az 10.000 girişlidir.
- Kullanıcı cüzdandan "Bu cüzdanı iptal et" diyebilir (cihaz devri, satış). Birim ve bütün WIA girişleri iptal olur.
- Kayıp veya çalıntı cihazdan iptal, kullanıcı hesabı gerektirir (WIAM_06); sonraki adıma bırakılır. **2026-10-12: [[ADR-0047]] K3
  ile değişti** — hesap yok; cüzdan sağlayıcısı telefonsuz bir iptal yolu sunar (kurulumda verilen iptal sırrı).

## K5 — Belge verenler

- [[t:PAR]] ve token uçlarında WIA doğrulanır: imza, sağlayıcı anahtarı güven listesinde, süre, PoP (`cnf`), `client_status`
  iptal değil.
- Belge ucunda, proof başlığında KA varsa şunlar doğrulanır:
  - imza ve sağlayıcı anahtarı,
  - proof'un `attested_keys[0]` ile imzası ve [[t:nonce]],
  - `key_storage_status` iptal değil,
  - `key_storage` seviyesi kurumun alt sınırını karşılıyor.

  Belgeler `attested_keys`'e bağlanır.
- Metadata: `proof_types_supported.jwt.key_attestations_required {key_storage, user_authentication}` (ISSU_27d).
- Geçiş: KA'sız proof biçimi pilot öncesine kadar kabul edilir, sonra kaldırılır.
- Kurumun WUA alanlarından okuduğu `key_storage` artık KA'dan okunur.

## K6 — Yenileme belirteci bağı

[[ADR-0023]] yenileme belirteci bugün WUA `sub`'una da bağlı. Her işlemde yeni WIA anahtarı kullanıldığı için bu bağ, belgeye
özel **[[t:DPoP]] anahtarı + geçerli, iptal edilmemiş bir WIA** koşuluna dönüşür. AR2'nin "her yenilemede cüzdan onayı doğrulanır"
kuralı aynen geçerlidir.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Tek 30 günlük WUA | ret | TS3 ile uyumsuz; kurumlar arası bağlanabilir; iptal yok |
| Kurum başına yeniden kullanılan WIA girişi | ret | Sağlayıcı cüzdanın kaç kurumla, ne sıklıkta görüştüğünü öğrenir |
| KA başına ayrı iptal listesi girişi (Seçenek 2) | sonra | Kullanıcı isteğiyle anahtar deposu iptali için; donanım anahtarıyla (Z1) birlikte |
| **Her işlemde yeni WIA + tür başına KA girişi** | **kabul** | En az bilgi; TS3'ün izin verdiği en mahremiyet dostu seçenek |

# Değişmezler

| Kod | Kural |
|---|---|
| WIA1 | WIA'nın ömrü 24 saatten kısadır; her belge işleminde yeni PoP anahtarlı ve yeni iptal listesi girişli bir WIA kullanılır. |
| WIA2 | Cüzdan sağlayıcısı birim kaydında kişisel veri tutmaz; birim iptal edilince o birime verilmiş bütün WIA girişleri iptal olur. |
| WIA3 | KA'daki anahtar deposu seviyesi gerçeği söyler; doğrulanmamış bir beyan KA'ya yazılmaz. |
| WIA4 | Belge veren, iptal edilmiş bir WIA ya da KA ile belge vermez. |

# Sonuçlar

- `apps/wallet-provider`:
  - birim kaydı, `/wia`, `/ka`, `/units/revoke`, `/units/delete`,
  - iki iptal listesi,
  - kalıcı durum dosyası.
- `@tamga-network/trust` (`@tamga-network/issuer` yeniden dışa aktarır): WIA ve KA doğrulama, iptal denetimi. Kurum belge vereni ve
  kimlik servisi bu biçimi kullanır.
- `wallet-core`: birim anahtarı, işlem başına WIA, KA isteği, KA'lı proof. Cüzdan: kayıt, "Bu cüzdanı iptal et".
- [[SPEC-PROTO-0001]] §11.1 ve D-CRED-6 bu karara göre yazılır.
- ARF: konu 9, 38 ve VCR_01a/03a/07 büyük ölçüde karşılanır. WSCD ve cihaz kanıtı Z1'dedir.

# Uygulama notları (2026-10-04)

Bu notlar kararı değiştirmez; referans cüzdanın (Tamga Wallet) ve sağlayıcının K1–K3'ü nasıl uyguladığını kayda geçirir.

1. **Anahtar erişim politikası (WL1/WL11).** Donanım anahtarları telefonun kilidine bağlıdır: anahtar yalnız kilit açıkken
   erişilebilir ve kullanımı cihazın biyometrisi, yoksa cihaz parolasıyla doğrulanır. iOS: Secure Enclave,
   `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, `.privateKeyUsage` + `.biometryCurrentSet | .or | .devicePasscode`
   (biyometri kayıtlı değilse yalnız `.devicePasscode`). Android: StrongBox/TEE, `setUserAuthenticationRequired(true)`,
   `setUserAuthenticationParameters(60 sn, AUTH_BIOMETRIC_STRONG | AUTH_DEVICE_CREDENTIAL)`, `setUnlockedDeviceRequired(true)`,
   `setInvalidatedByBiometricEnrollment(true)` (bu belge ve [[SPEC-WALLET-0001]] bu bayrağı tanımlamadığı için `true` seçildi;
   pencereli anahtarlarda sistem onu uygulamaz, kilit kaldırılırsa anahtar geçersiz olur). Uygulama PIN'i ekran kilidi olarak
   kalır; sunum onayı anahtar kullanım istemidir (tek istem; PIN ekranıyla çift sorma yok). Kilit kurulmamış telefonda anahtar
   üretilmez. Kişiyi temsil etmeyen protokol anahtarları — birim anahtarı (K1), WIA PoP (K2), DPoP ve geçiş kartı anahtarı
   (WL13: onay istemez) — yalnız kilit açıkken erişilebilir ama kullanımı istem gerektirmez; böylece sessiz yenileme ve kart
   yenilemesi kişiye istem çıkarmaz. Kişinin başlatmadığı akışlar belge anahtarını istemsiz dener; doğrulama gerekiyorsa
   sessizce atlar ve kullanıcı eyleminde yeniden dener. Geçiş kodu yoktur ([[ADR-0029]]): politika değişince mevcut test
   cüzdanları yeniden kurulur.
2. **Play Integrity — zorunlu değil.** Android cüzdan, anahtar kanıtıyla birlikte Play Integrity (standart API) jetonu
   gönderebilir; sağlayıcı, servis hesabı ayarlıysa jetonu Google'a çözdürür ve yalnız hüküm sınıflarını birimin cihaz kaydına
   yazar. KA'daki `key_storage` seviyesi Android anahtar kanıtından gelir; Play Integrity onu düşürmez, yokluğu kaydı
   engellemez, servis hesabı yoksa doğrulama atlanır. Play Integrity'yi zorunlu kılmak (kaydı ya da seviyeyi ona bağlamak)
   bu kararın K1/K3'ünü değiştirir ve **ayrı bir ADR gerektirir**.

# Uygulama notları (2026-10-13, ilk AB uyum turu)

Bu notlar kararı değiştirmez; biçimi AB'nin sabitlediği metinlere (Uygulama Tüzüğü (AB) 2024/2979 Ek Ib, 2026/1731 ile; AB TS3 1.5.2)
hizalar.

1. **Genel istemci kanıtı (draft -07).** WIA, OpenID4VCI 1.0'ın atıf verdiği OAuth attestation-based client authentication
   taslağının -07 sürümündeki biçimdir. Cüzdan sağlayıcısı `iss` ve `iat`'ı gönderir (-07'de `iss` zorunluydu, -08'de kalktı;
   -12'de `iat` zorunlu oldu). Doğrulayan taraf `iss`'i kabul eder ama zorunlu tutmaz; kanıtta `iat` yoksa hoş görür, **PoP'ta
   (`OAuth-Client-Attestation-PoP`) `iat` zorunludur**. Belge veren her `oauth-client-attestation+jwt` kanıtını **tek yoldan** WIA
   olarak doğrular; eski Tamga WUA yolu **kaldırıldı**. Kanıtta `client_status` (iptal girişi) varsa denetlenir; yoksa davranış
   belge verenin `clientStatus` ayarıdır: `optional` (varsayılan; AB'nin genel -07 kanıtı kabul edilir, iptal denetimi uygulanmaz
   diye işaretlenir) ya da `required` (iptal girişi olmayan kanıt reddedilir). Zincirleme iptal yapan **kimlik servisi `required`
   kullanır** ([[ADR-0047]] K1). Uygulama: paketlerin 0.5.2 sürümü.
2. **WIA `cnf` = belgeye özel DPoP anahtarı (TS3 1.5.2).** Belge işleminde WIA'nın `cnf.jwk`'si, o belge için token ucunda
   kullanılan DPoP anahtarıdır; ayrı bir WIA PoP anahtarı üretilmez. K6'daki yenileme belirteci bağı aynı anahtar üzerinden kurulur.
   WIA1 (her işlemde yeni anahtar ve yeni iptal girişi) değişmez: DPoP anahtarı da belgeye ve işleme özeldir. Uygulama: 0.6.0.
   **Düzeltme (2026-10-13, uygulama sırasında):** bu kural TS3'ün 1.5.1 sürümünde eklendi, **1.5.2'de geri alındı** (TS3 1.5.2
   sürüm geçmişi: "rolled back the WIA `cnf`/DPoP requirements added in 1.5.1 (Section 2.2.1.1)"). Bugünkü AB metninde ve
   Uygulama Tüzüğü (AB) 2026/1731 Ek Ib'de WIA `cnf` anahtarıyla DPoP anahtarı arasında bir bağ şartı yoktur (TR-WIA-4.3 yalnız
   PoP'un `cnf` anahtarıyla doğrulanmasını ister). Bu yüzden not 0.6.0'da **uygulanmadı**; AB metni yeniden isterse ayrı bir
   işle ele alınır. Mevcut davranış (WIA PoP anahtarı ve DPoP anahtarı ayrı, ikisi de işleme özel) değişmez.
3. **İptal listelerinin boyu.** WIA ve KA iptal listelerinin **her biri** en az 10.000 girişlidir (Uygulama Tüzüğü (AB) 2024/2979
   Ek Ib; izlenemezlik için; KA listesi tür başına az giriş kullansa da boyu aynı alt sınırı taşır). Belge veren, imzası geçerli ama
   10.000'den az girişli listeye dayanan WIA ya da KA'yı profile uymayan liste olarak **reddeder** (geçici hata sayılmaz).
   Uygulama: paketlerin 0.5.2 sürümü.

# Durum

**Accepted — 2026-09-29.** Proje yönetimi onayıyla (H1 planı, P3). DECISIONS: D-CRED-7.

> **Değişiklik (2026-10-06, [[ADR-0042]]):** Cüzdan sağlayıcısını cüzdanı sunan kuruluş işletir; ağ cüzdan sağlayıcısı işletmez,
> güven listesinde (`wallet_providers[]`) listeler. Bağlamdaki `wallet.tamga.network` ve Sonuçlar'daki `apps/wallet-provider`,
> Tamga Wallet'ın cüzdan sağlayıcısıdır: kodu cüzdanın deposuna taşındı, bu depodaki kopya ve `wallet.tamga.network`
> 2026-10-06'da ağdan kaldırıldı; sağlayıcıyı cüzdanın işletmecisi `provider.tamgawallet.com`'da işletir. Karar (K1–K3, WIA1–WIA4) değişmez: WIA ve
> KA biçimi ile doğrulaması (`@tamga-network/trust`) ağın kuralıdır ve her cüzdan sağlayıcısı için aynıdır.
>
> **Not (2026-10-13):** genel istemci kanıtı (-07; `iss` kabul edilir ama zorunlu değil, kanıtta `iat` yoksa hoş görülür, PoP'ta
> zorunlu), eski WUA yolunun kaldırılması ve `clientStatus` ayarı (`optional` / `required`; kimlik servisi `required`), WIA `cnf` =
> belgeye özel DPoP anahtarı (TS3 1.5.2'de geri alındı — uygulanmadı, yukarıdaki düzeltme), WIA/KA listeleri ≥ 10.000 — yukarıdaki "Uygulama notları (2026-10-13)". Proje yönetimi onayıyla (ilk AB uyum turu).
>
> **Not (2026-10-14, K2 süre ifadesi):** K2'deki "`client_status.exp` … (Tamga: 60 gün)" yalnız **olağan süredir** (belge veren
> tercih bildirmezse). Belge veren [[ADR-0047]] K1'deki tercihi (`preferred_client_status_period`, KA için
> `preferred_key_storage_status_period`) bildirirse sağlayıcı `client_status.exp`'i (ve KA'da `key_storage_status.exp`'i) o süreye,
> sağlayıcının üst sınırına kadar verir (Tamga Wallet: 730 gün). 31 günlük alt sınır ve kararın geri kalanı değişmez.
