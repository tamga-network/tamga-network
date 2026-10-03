---
document_id: ADR-0012
title: "Yakın alanda belge gösterme"
status: Active
version: 1.0.0
created: 2026-09-25
last_updated: 2026-10-02
summary: >
  Cüzdanın QR gösterdiği yakın alan sunumu (turnike, etkinlik, yüz yüze kontrol) için Tamga
  profili: (B) kayıtlı bir doğrulayıcıya bir kez standart sunumla kayıt, sonra kişisel veri
  içermeyen 60 saniyelik imzalı geçiş jetonu; (C) yüz yüze kontrolde cüzdanın gösterdiği kısa
  ömürlü istek bağlantısıyla standart OpenID4VP'nin ters başlatılması. İkisi de ARF yakın alan
  akışının (ISO/IEC 18013-5) yerine geçmez, ona kadar köprüdür ve aynı "Göster" ekranından
  Faz 1'de Bluetooth'a geçer. Tek kullanımlık attestation'lar status biti + kapılar arası ortak
  kullanıldı listesiyle; geçişte PIN sorulmaması sınırlı ve süreli rızayla (S-16).
domain: Wallet
---

# ADR-0012 — Yakın Alan Sunumu (Cüzdan QR Gösterir) ve Tek Kullanımlık Attestation'lar

**Durum:** **Accepted — 2026-09-25** (K1–K5 ve K7; K6 ayrı ADR). DECISIONS §0 **D-PROX-1**.
Ekran akışı
`…/2026-09-25-cuzdan-akis-tasarim-onerisi.md`. Emsal: Danimarka **AltID** (resmî uygulama; canlı saat + fotoğraf + büyük QR).

# Bağlam

Bugünkü tek sunum akışı uzaktan sunumdur: [[t:verifier]] QR gösterir, cüzdan tarar ([[t:OpenID4VP]] cross-device; [[SPEC-PROTO-0002]]).
Hedeflenen kullanımlar — kampüs turnikesi, etkinlik girişi, müze, kafe kasası, yüz yüze yetki kontrolü — **cüzdanın QR
göstermesini** gerektirir. [[t:ARF]] bu alanı "proximity presentation" olarak tanımlar ve **ISO/IEC 18013-5** ile çözer: cüzdanın
gösterdiği QR yalnızca *device engagement*tir; ardından BLE/NFC üzerinden [[t:nonce|nonce'lu]] istek-cevap yürür ve [[t:credential]] formatı **[[t:mdoc]]**tur.
Bizim belgelerimiz **[[t:SD-JWT-VC]]**; 18013-5 üzerinden SD-JWT VC taşımak standart değildir. Doğru uzun vadeli yol, kimlik ve
öğrenci belgelerinin **mdoc olarak da** ihracı ve 18013-5'in gerçek derlemede (BLE native modül) uygulanmasıdır (Faz 1, EAS).
Bugün Expo Go'da BLE yok; mdoc ihracı, cüzdan mdoc deposu ve terminal BLE yığını haftalar sürer.

İlke: **nonce'u ikna olmak isteyen taraf üretir.** Cüzdan QR gösteriyorsa ya ikinci bir kanal açılır (18013-5) ya da zaman
penceresi + tekrar listesiyle yetinilir. Tek QR'ın boyutu (≈2.9 KB) SD-JWT VC + x5c zincirini taşıyamaz; QR ya **referans** ya
**küçük imzalı jeton** taşır.

# Karar

## K1 — İki köprü yolu; ISO 18013-5 hedef, "Göster" ekranı sabit
| Yol | Kullanım | Mekanizma | Standart durumu |
|---|---|---|---|
| **A — Uzak sunum** (mevcut) | doğrulayıcı QR gösterir | OpenID4VP cross-device | ARF aynen |
| **B — Geçiş kartı** | kayıtlı terminal her gün okur (turnike, etkinlik kapısı) | (1) **Kayıt:** A yolu ile kayıtlı RP'ye sunum; RP `pass_grant` (RP imzalı: `pass_id`, kopya anahtarı parmak izi `cnf_kid`, `terminal_group`, `valid_until`) döner. (2) **Göster:** cüzdan kopya anahtarıyla **`tamga-pass+jwt`** imzalar: `{iss: pass_id, aud: rp client_id, iat, exp = iat+60, jti}`; QR = kompakt JWS (≤ 400 bayt). Terminal çevrim dışı doğrular: `pass_grant`'taki anahtar, `aud`, `exp`, `jti` tekrar listesi. | Tamga profili (köprü) |
| **C — Yüz yüze kontrol** | insan kontrol eder (görevli, kasa) | cüzdan QR'da kısa ömürlü **`openid4vp://…request_uri`** gösterir: bu, kontrol edenin Tamga doğrulayıcı uygulamasında tarayınca **standart OpenID4VP isteğini başlatan** bağlantıdır (cüzdan, kayıtlı RP'nin `/vp/req` ucundan kendisi için bir istek kimliği almıştır). Sunum standart yoldan (A) yürür; kullanıcı alanları Göster'de önceden onaylar. | OpenID4VP; başlatma tersine |
| **Faz 1 — ISO 18013-5** | tüm yakın alan | QR = device engagement, BLE/NFC oturum, mdoc | ARF |

- **Göster ekranı** tek tasarımdır (kart + canlı saat + büyük QR + "ne paylaşıyorsun" + Değiştir); B/C/Faz 1 yalnızca QR'ın
  arkasındaki mekanizmayı değiştirir. Geri dönüşü zor karar yoktur: B/C jeton biçimleri **sürümlüdür** (`typ` ile), Faz 1'de
  emekliye ayrılır; belge veri modeli (claim seti) formattan bağımsızdır, mdoc ihracı **eklemedir**.
- Faz 1 ön koşulu: kimlik ve öğrenci/diploma tiplerinin `mso_mdoc` eşdeğeri (katalogda `docType` eşlemesi), EAS derlemesi, BLE.

## K2 — Geçiş jetonu içeriği ve sınırları (B)
- Jetonda **kişisel veri yoktur**: `iss` (opak `pass_id`), `aud`, `iat`, `exp` (≤ 60 s), `jti`; başlık `typ: "tamga-pass+jwt"`,
  `alg: ES256`, `kid: cnf_kid`. Terminal kişiyi tanımaz, yalnızca "geçerli geçiş hakkı" görür; kimlik `pass_grant` ile RP'nin
  kayıt sisteminde eşleşir (kampüs zaten öğrenciyi tanır).
- `pass_grant` cüzdanda saklanır (`WalletState.passes[]`), belge kopyasına ve anahtarına bağlıdır (WL5 korunur: bir RP = bir kopya).
  Belge [[t:revocation]]/süresi dolunca grant düşer; RP grant'ı süresinden önce iptal edebilir (RP status listesi, Faz 1).
- Ekran: canlı saat + 60 s geri sayım; ekran görüntüsü süre dolunca işe yaramaz.

## K3 — Tekrar oynatma
- Terminaller `jti`'yi `exp`'e kadar tutar; aynı terminal grubundaki kapılar listeyi **çevrim içi paylaşır**. Çevrim dışı kapı yalnızca
  süre denetler ve bu riski **kabul eder** (60 s içinde kopyalanan QR başka kapıda geçebilir); risk ADR'de açıkça kayıtlıdır.

## K4 — Tek kullanımlık attestation'lar (bilet)
- Organizatör hem [[t:issuer]] hem doğrulayıcı: bağlanamazlık anlamsız, kabul. Mekanizma: **1 kopya/koltuk**, `exp` = etkinlik bitişi,
  kapı geçişte **status biti** "kullanıldı"; S6 (sabit aralık yayını) korunur → kapılar arası **ortak kullanıldı listesi zorunlu**
  (aralık içinde ikinci geçişi bu liste keser).

## K5 — RP kaydına terminal sınıfı
- `relying_parties[]` ([[t:relying-party]]) kaydına `terminal_groups[]` (grup kimliği, sertifika parmak izi, çevrim dışı izinli mi) eklenir; terminal
  ancak kayıtlı bir RP'nin altında tanımlanır ([[SPEC-TRUST-0001]] küçük sürüm). Cüzdan Göster'de yalnızca kayıtlı RP/terminal
  grubuna geçiş kartı üretir.

## K6 — Kurumsal temsil yetkisi (ertelendi)
- "Kişi X, kurum Y adına yetkili" attestation'ı (`urn:tamga:org:MandateAttestation:1` adayı) **ayrı ADR**.

## K7 — Yazılı ilke
- FW-TF-0001'e ilke: "Doğrulama meydan okumasını (nonce) ikna olmak isteyen taraf üretir; yakın alanda cüzdan gösterir ve ikinci
  kanal açılır; tek QR yalnızca kısa ömürlü referans ya da kişisel verisiz imzalı jeton taşır."

## K8 — Rıza ve WL11 istisnası (sapma S-16)
- Geçiş kartında her gösterimde PIN/biyometri **sorulmaz**: kayıt anında (A yolu) verilen rıza **süreli** (`valid_until`, azami bir
  dönem ≈ 6 ay) ve **kapsamlı** (yalnızca o RP/terminal grubu) sayılır; her gösterim geçmişe yazılır; kullanıcı Göster ekranından
  rızayı geri alabilir (grant silinir). WL11'in ölçülü istisnasıdır; [[SPEC-WALLET-0001]] WL12–WL14 ile sınırlanır.

# Gerekçe
İstenen deneyim ("kaldır, göster, geç") bugün ARF'nin hedef yoluyla (mdoc + BLE + gerçek derleme) haftalar uzakta; köprü
yollar standardı **taklit etmez**, onun yerine ya standart OpenID4VP'yi ters başlatır (C) ya da standart dışı olduğu açıkça
yazılı, sürümlü, kişisel verisiz bir jeton kullanır (B). Ekran ve veri modeli sabit kaldığı için Faz 1 geçişi yalnızca taşıma
katmanını değiştirir. AltID emsali bu yaklaşımın bir devlet uygulamasında canlı olduğunu gösterir.

# Değerlendirilen Alternatifler
- **ISO 18013-5'i hemen yapmak:** SD-JWT VC ile standart değil; mdoc ihracı + BLE + EAS gerekir; Expo Go'da imkânsız. **Faz 1'e.**
- **Tam belgeyi QR'a koymak:** boyut ve gizlilik (belge terminale gider). Reddedildi.
- **Terminal QR gösterir, öğrenci tarar (D):** deneyim kötü, turnike ekranı gerekir. Yedek olarak kalır.
- **Genel "herkes okusun" QR'ı (kayıtsız kontrol eden):** kişisel veri kayıtsız tarafa gider, Tamga'nın "RP kayıtlı olmalı" ilkesine
  aykırı. Reddedildi.

# Sonuçlar
- Kod: `@tamga-network/wallet-core` `pass.ts` (grant saklama, jeton üretimi), `apps/wallet` Göster ekranı gerçek QR, `@tamga-network/verifier`
  `pass.ts` (grant ihracı + jeton doğrulama + jti listesi), `apps/verify` `/terminal` sayfası ve `/terminal/verify`, kampüs
  politikası (`campus-access`), sahne 12 (`demo-scenes`). C yolu (ters başlatma + doğrulayıcı "Kontrol et" ekranı) ikinci adım.
- Belgeler: [[SPEC-WALLET-0001]] WL12–WL14; [[SPEC-API-0001]] AP13; [[SPEC-TRUST-0001]] `terminal_groups` (küçük sürüm);
  FW-TF-0001 §3.7 + ilke; FW-ARF-0001 tablo satırı; 09-DEMO-KURGU S-16 + sahne 12; 08-BACKLOG D9.

# Açık Noktalar
1. Rıza süresi üst sınırı (öneri 6 ay) ve günlük gösterim üst sınırı — pilot verisiyle.
2. Faz 1 mdoc `docType` eşlemesi ve ihraç profili — ayrı SPEC güncellemesi.
3. C yolunda kontrol edenin gördüğü sonuç ekranı içeriği (fotoğraf yalnız cihazda mı, kontrol edene de mi) — SPEC-ID-0003 portre claim'iyle birlikte.
