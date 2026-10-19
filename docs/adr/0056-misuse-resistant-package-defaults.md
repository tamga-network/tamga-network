---
document_id: ADR-0056
title: "Paket API'lerinde güvenli varsayılanlar"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  `@tamga-network/*` paketlerinin 0.7.0 sürümünde güvenlik denetimini atlatan varsayılanlar kaldırılır: güven çapası, dönüş adresi
  izin listesi, iptal sorgusu ve doğrulayıcı kaydı zorunlu girdidir (bilerek atlamak için açık `"none"` değeri); DPoP token ve
  kaynak ucu için iki ayrı işlev; iptal listesi imzacısı sabitlenir; cihaz anahtarı olmayan mdoc geçersizdir; cüzdan yalnız
  `checkRp` onayıyla sunum yapar; geçiş kartı yalnız doğrulama hattının kabul çıktısından verilir; kayıt sertifikası olmayan
  istek bugünden reddedilir (ADR-0026 K5'in 2028'e kadarki uyarı geçişinin yerine); E4 yalnız denetim kaydı yazıldıysa
  "yapıldı" sayılır; saniye ve milisaniye türle ayrılır. Ayrıca: türü iptal listesi kullanan ama iptal girişi taşımayan belge
  reddedilir, güven listesi geri sarma koruması varsayılan açıktır, saat kayması seçenekleri 600 sn ile sınırlıdır.
  Kabul: 2026-10-19.
domain: Trust
related: ["[[ADR-0012]]", "[[ADR-0017]]", "[[ADR-0025]]", "[[ADR-0026]]", "[[ADR-0029]]", "[[ADR-0031]]", "[[ADR-0048]]", "[[SPEC-API-0001]]", "[[SPEC-CRED-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-PROTO-0002]]", "[[SPEC-WALLET-0001]]"]
---

# Kısaca

Paketlerimizi kullanan bir geliştirici bir seçeneği unuttuğunda sonuç "denetim yapılmadı ama geçti" olmamalı. 2026-10-19
güvenlik turu, paket API'lerinde bunun on iki yerde mümkün olduğunu gösterdi (ör. güven kökü verilmezse belge zincirsiz kabul
ediliyordu). Bu karar o varsayılanları kaldırır: denetimi atlamak isteyen bunu açıkça yazar (`"none"`), unutmak artık ret demektir.
Değişiklikler kırıcıdır ve 0.7.0 sürümüyle birlikte gelir; geliştirme evresinde geriye uyum katmanı yazılmaz ([[ADR-0029]]).

# Bağlam

- Güvenlik turu 2026-10-19 (API yanlış kullanım incelemesi) kırmadan yapılabilecek düzeltmeleri hemen yaptı (boş beklenen
  değerler, politika tazelik sınırları, yerel adres eşleşmesi, A6/B4 raporlaması) ve varsayılanı değiştiren 12 öneriyi karara bıraktı.
- Bunlardan ikisi kapatılmış kararlarla çelişir: [[ADR-0026]] K5 (2026-10-13 değişikliği) kayıt sertifikası olmayan istekte
  2028-08-11'e kadar uyarı + "Paylaşma" öngörür; [[SPEC-API-0001]] E4'ü ("denetim kaydı yazıldı") her sonuçta yapılmış raporlar.
  Bu ADR ikisini değiştirir; öteki maddeler şartnamelerin zaten istediğini koda zorunlu kılar.
- Kullanıcı tarafı: Tamga Wallet mağazaya çıkmadı (yalnız sandbox ve cihaz testleri), doğrulayıcı tarafında canlı RP sayısı az;
  kırıcı değişiklik için en ucuz an şimdi.

# Karar

Her maddede "verilmemesi" JavaScript çağıranın alanı hiç vermemesini de kapsar: tür denetimi olmayan çağıran da reddi görür.

## K1 — `verifySdJwtVc`: güven çapası zorunlu
`rootCertsDer: Uint8Array[] | "none"` zorunludur. Boş dizi ya da verilmemesi A3'te ret (`rootCertsDer missing`). `"none"`
zincir denetimini bilerek atlar (`anchorFingerprint: null`); yalnız imzacıyı ayrıca denetleyen çağıran içindir (ör. kimlik servisinin
kendi verdiği belgeyi `issuerId` ile tanıması).

## K2 — `createPar`: dönüş adresi izin listesi zorunlu
`allowedRedirectUris` (dizi ya da `clientId → liste` işlevi) zorunludur; liste boşsa ya da işlev bu istemci için liste
döndürmezse `invalid_redirect_uri` ("no redirect_uri is registered for this client"). Biçim denetimiyle yetinen yol kalmaz.

## K3 — İptal sorgusu zorunlu
`verifyWalletAttestation` ve `verifyKeyAttestation` (`verifyKaProof`, `verifyAttestationProof`) `statusOf`, `verifyPseudonym`
`walletStatusOf` alır: `StatusValueOf | "none"`, zorunlu. `"none"` iptali bilerek denetlemez. Sonuçlarda yeni alan
`statusChecked: boolean` (WIA ve KA); `PseudonymResult` başarılı sonucu `clientStatus` (`VALID` | `NOT_CHECKED` | `NOT_APPLICABLE`) taşır.

## K4 — `verifyPresentation`: doğrulayıcı kaydı zorunlu
`rp: RelyingParty | null | "none"` zorunludur. Verilmemesi E3'te ret; `null` kayıtsız RP (ret, önceki gibi); `"none"` kapsam
denetimini (E3) bilerek atlar ve E3 `checks_skipped`'te görünür (kayıtlı RP'si olmayan kendi sunucusunda doğrulayan).

## K5 — DPoP: iki uç, iki işlev
`verifyDpop` kaldırılır. Token ucu `verifyTokenDpop` (bağlanacak `jkt`'yi döndürür); kaynak ucu `verifyResourceDpop` (`accessToken`
ve ona bağlı `jkt` zorunlu; `ath` ve anahtar eşleşmesi her zaman denetlenir).

## K6 — İptal listesi imzacısı sabitlenir
`verifyStatusListToken`, `verifyStatusListCwt`, `verifyStatusListAny` dördüncü girdi olarak `{ expectedSignerFingerprints }`
alır (zorunlu): imzacı sertifikasının SHA-256 parmak izleri ya da parmak izini değerlendiren işlev. Eşleşmeyen imzacı imza
denetiminden önce `D3: status token signer is not an expected signer`. Doğrulayıcı kurumun güven listesindeki iptal anahtarını,
cüzdan sağlayıcı denetleyicisi (`WalletStatusChecker`) listedeki sağlayıcı anahtarını verir.

## K7 — `verifyIssuerSigned`: cihaz anahtarı zorunlu
MSO `deviceKeyInfo.deviceKey` taşımayan belge `valid: false` ("deviceKey missing"): kişiye bağlanamayan belge geçerli sayılmaz.

## K8 — Cüzdan yalnız `checkRp` onayıyla sunum yapar
`checkRp`, engelleyici durum yoksa (taklit yok; kayıtlıysa ACTIVE; aracı istekte iki kayıt ve [[ADR-0017]] K7 ilişkisi) sonuca
`approval: ApprovedRequest` koyar. `respond` bu onayı zorunlu alır; onay isteğin `client_id`, `nonce`, yanıt adresi/köken,
imzalayan sertifika ve `onBehalfOf` alanlarına bağlıdır ve elle kurulamaz (süreç içi kayıt). Kayıtsız doğrulayıcıya uyarıyla
paylaşım ([[SPEC-PROTO-0002]] PV2) onaylıdır; kayıt sertifikası kuralı K10'dadır.

## K9 — Geçiş kartı yalnız kabul çıktısından
`PassRegistry.issue({ verified, … })` bu süreçte `verifyPresentation`'ın döndürdüğü, sonucu `ACCEPTED` olan çıktıyı alır; kart
anahtarı (`pass_key` yoksa) doğrulanan sunumdan okunur. Red, doğrulanamadı, elle kurulmuş, kopyalanmış ya da sonradan
değiştirilmiş çıktı hata verir. `presentation` girdisi kalkar.

## K10 — Kayıt sertifikası olmayan istek reddedilir
[[ADR-0026]] K5'in 2026-10-13 değişikliğindeki "uyarı + varsayılan Paylaşma, 2028-08-11'den sonra ret" geçişi kaldırılır:
uzaktan ve yakın alanda kayıt sertifikası olmayan istek bugünden `valid: false`, `reason: "registration_missing"`; cüzdan kişiye
sormadan durur. `WRPRC_REQUIRED_FROM` sabiti ve `missingRegistrationPolicy`'nin zaman girdisi kalkar. Cüzdandan cüzdana yakın
alan (TS9; karşı tarafta okuyucu sertifikası yok) değişmez. Bunun önkoşulu: canlı doğrulayıcıların kayıtlarına kimlik numarası
girilir ve yayıncı her kullanım için kayıt sertifikası üretir ([[ADR-0026]] K4).

## K11 — E4 yalnız denetim kaydı yazıldıysa
`verifyPresentation` E4'ü yalnız `audit` işlevi verildiyse ve çağrıldıysa `checks_performed`'a yazar; verilmediyse E4
`checks_skipped`'tedir. Sonuç biçimi değişmez (alan aynı, yeri değişir). [[SPEC-API-0001]] AP9 (E4 red için de çalışır) denetim
kaydı yeri olan doğrulayıcı için geçerlidir; barındırılan doğrulayıcı her zaman verir.

## K12 — Saniye ve milisaniye türle ayrılır
`@tamga-network/core` `EpochSeconds` ve `EpochMillis` türlerini ve `epochSeconds`, `epochMillis`, `nowSeconds`, `nowMillis`,
`secondsToMillis`, `millisToSeconds` yardımcılarını verir (RN için `@tamga-network/core/time`). Kabul kararı veren işlevler
`now`'ı saniye türüyle (doğrulama, WIA/KA, DPoP, PAR, iptal listesi, mdoc, takma ad, geçiş kartı), cüzdanın kayıt sertifikası,
`checkRp`, açıklama politikası ve doğrulayıcının kapsam yardımcıları milisaniye türüyle alır; yanlış birim derlemede hata ve
çalışma zamanında `RangeError` (saniye `< 1e11`, milisaniye `≥ 1e11`).

## K13 — Ek güvenli varsayılanlar
- Şemasında `uses_status_list: true` olan türün iptal girişi taşımayan belgesi D1'de reddedilir (`usesStatusList` yardımcısı,
  `@tamga-network/schemas`).
- Güven listesi geri sarma koruması (TL2) varsayılan açıktır: `versionMemory` verilmeyen yükleme süreç içi belleği (ağ ve LOTL kök
  parmak izleri başına) kullanır; `versionMemory: "none"` kapatır; kalıcı koruma için kalıcı bellek verilir.
- Saat kayması seçenekleri (`maxSkewSec`, `clockSkewSec`, `maxClockSkewSec`) en çok `MAX_CLOCK_SKEW_SEC` = 600 sn; üstü ya da
  negatif değer `RangeError` (politikanın `max_clock_skew_sec` sınırıyla aynı).

## K14 — Yeni açık adlar
Proje yönetimi onayıyla: `"none"` (açık atlama değeri), `statusChecked`, `clientStatus` (`PseudonymResult`), `StatusCheck`,
`expectedSignerFingerprints`, `StatusTokenVerifyOptions`, `verifyTokenDpop`, `verifyResourceDpop`, `DpopCommonOptions`,
`ApprovedRequest`, `approval`, `verified` (`PassRegistry.issue`), `isYes`, `usesStatusList`, `EpochSeconds`, `EpochMillis`,
`epochSeconds`, `epochMillis`, `nowSeconds`, `nowMillis`, `secondsToMillis`, `millisToSeconds`, `secondsOrNow`, `millisOrNow`,
`MAX_CLOCK_SKEW_SEC`, `clockSkewOption`, `resetDefaultListVersionMemory`, alt yol `@tamga-network/core/time`.

# Değerlendirilen seçenekler

| Seçenek | Karar | Gerekçe |
|---|---|---|
| Eski davranışı koruyup uyarı yazmak (0.6.0 notları) | ret | Uyarıyı okumayan entegratör yine açık bırakır; yanlış kullanım sessiz kalır |
| Zorunlu girdi, kaçış yok | ret | Test, uyum aracı ve kendi belgesini tanıyan servis için bilinçli atlama gerekir |
| Zorunlu girdi + açık `"none"` | **kabul** | Atlama kodda görünür, incelemede yakalanır; unutmak ret |
| K10: 2028'e kadar uyarı (ADR-0026 K5) | ret | Uyarı + Paylaşma kişinin kararına bırakır; kayıtsız kullanıma kapı açık kalır; cüzdan henüz mağazada değil |
| K8/K9: biçimsel tür (yalnız TypeScript) | ret | JavaScript çağıran ve elle kurulmuş nesne geçerdi; süreç içi kayıt taklit edilemez |

# Değişmezler

| Kod | Kural |
|---|---|
| MR1 | Kabul kararını etkileyen bir güvenlik girdisi (güven çapası, dönüş adresi listesi, iptal sorgusu, RP kaydı, iptal listesi imzacısı) verilmezse işlev reddeder; atlamak yalnız açık `"none"` değeriyle mümkündür. |
| MR2 | İptal durumunu denetlemeyen başarılı sonuç bunu açıkça taşır (`statusChecked: false`, `clientStatus: "NOT_CHECKED"`). |
| MR3 | Cüzdan, `checkRp`'nin bu isteğe bağlı onayı olmadan sunum yanıtı göndermez. |
| MR4 | Geçiş kartı yalnız doğrulama hattının kabul çıktısından ve doğrulanan sunumun anahtarına verilir. |
| MR5 | Kayıt sertifikası olmayan istek (cüzdandan cüzdana yakın alan dışında) reddedilir. |
| MR6 | E4 yalnız denetim kaydı yazıldıysa `checks_performed`'tadır. |
| MR7 | Zaman girdileri birimiyle işaretlidir; yanlış birim hata verir, sessizce yorumlanmaz. |
| MR8 | Türü iptal listesi kullanan belgede iptal girişi yoksa doğrulama reddeder. |

# Sonuçlar

- Paketler 0.7.0 (npm yayını proje yönetimince): `core`, `sd-jwt`, `mdoc`, `trust`, `schemas`, `issuer`, `verifier`, `wallet-core`.
  CHANGELOG "Unreleased" bölümü 0.7.0 notlarıdır; paket README'leri ve `docs/packages/*` güncellenir.
- [[SPEC-API-0001]] (A3 kök, E3 `rp`, E4, D1 iptal girişi, D3 imzacı, `isYes`), [[SPEC-CRED-0003]] (imzacı sabitleme), [[SPEC-PROTO-0001]]
  (PAR izin listesi, DPoP iki uç), [[SPEC-WALLET-0001]] ve [[SPEC-PROTO-0002]] (K8, K10), [[ADR-0026]] değişiklik notu.
- Uyum vektörleri sürüm 6: iptal listesinde "beklenmeyen imzacı" olumsuz vakası; koşucu imzacıyı sabitler.
- Tüketiciler aynı sürümde güncellenir: referans doğrulayıcı, liste yayıncısı, kimlik servisi ve kurum issuer'ı, Tamga Wallet ve
  cüzdan sağlayıcı (paket kopyaları).
- İşletim önkoşulu (K10): canlı doğrulayıcıların kayıt sertifikaları yayınlanmadan güncel cüzdan onlara sunum yapmaz.
- Değişmeyen kararlar: D-PROTO-1, D-PRIV-1 (takma ad), D-PROX-1 (geçiş kartı), D-CRED-7 (WIA/KA), D-API-2.

# Durum

**Accepted — 2026-10-19.** Proje yönetimi onayıyla (güvenlik turu 2026-10-19, 12 öneri ve yeni adlar). DECISIONS: D-API-3.
Değiştirdiği: [[ADR-0026]] K5'in 2026-10-13 değişikliğindeki 2028-08-11'e kadarki uyarı geçişi (K10) ve [[SPEC-API-0001]] E4
raporlaması (K11).
