---
document_id: ADR-0033
title: "Mağaza inceleme kodu"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-04
summary: >
  Apple ve Google inceleyicileri Tamga Wallet'ın kimlik akışını gerçek bir Türk kimlik belgesi olmadan deneyebilmelidir.
  Karar: süreli, tek kullanımlık bir inceleme kodu; kod girilince kimlik servisi yalnız o oturum için sahte doğrulama
  sağlayıcısını kullanır ve ayrı bir deneme imzacısıyla, gerçek doğrulayıcıların hiçbir politikasında geçmeyen bir deneme kimlik
  belgeyi verir. Kimlik gerektirmeyen yollar (bilet, Tamga Verify, "Tamga ile giriş yap") kodsuz denenir.
domain: Services
---

# Özet (sade)

Mağaza inceleyicisi uygulamayı açtığında kimlik doğrulama adımında gerçek bir Türk kimlik kartı ve yüz taraması ister; inceleyicide
bu yoktur ve uygulama "denenemedi" diye reddedilir (kimlik uygulamalarında en sık ret nedeni). Karar: inceleme notuna yazılan, kısa
süreli ve **tek kullanımlık bir kod**. Kod girilince kimlik servisi gerçek sağlayıcı yerine sahte (demo) doğrulamayı yalnız o oturum
için kullanır ve **"DEMO" işaretli, gerçek hiçbir doğrulayıcının kabul etmediği** bir deneme belgesi verir. Gerçek kullanıcılar bu
yolu görmez; kod bir kez kullanılınca biter.

# Bağlam

- Apple App Review ve Google Play incelemesi, uygulamanın bütün akışlarının denenebilmesini ister; gerektiğinde inceleme notunda
  deneme hesabı ya da "demo modu" verilir.
- Tamga Wallet'ın kimlik akışı ([[SPEC-ID-0003]] §9) gerçek kimlik belgesi + canlılık + yüz eşleştirme ister;
  bu bir [[t:identity-proofing]] adımıdır. Canlıda sahte sağlayıcı kapalıdır (`TAMGA_IDV_DIDIT_FAKE` yalnız açıkça açılırsa; GT1: canlıda gerçek
  kimlik yok sayılmaz).
- Kimlik gerektirmeyen akışlar kodsuz denenebilir: bilet alma ve kapıda gösterme, Tamga Verify örnek politikaları, "Tamga ile
  giriş yap" örnek sitesi ([[t:pseudonym]] yalnız kimlik [[t:credential]] tohumla çalıştığı için o da kimlik akışına
  bağlıdır — §K4).
- Gerçek kullanıcıyı etkilemeyen, kötüye kullanılamayan ve izlenebilir bir yol gerekir.

# Seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| A. İnceleme notunda yalnız kimliksiz yollar | yetmez | Kimlik akışı uygulamanın ana yolu; inceleyici deneyemezse ret riski yüksek. |
| B. Uygulamada kalıcı "demo modu" (sahte belgeler cihazda) | ret | Gerçek kullanıcı da açabilir; sahte belgelerin gerçekmiş gibi görünme riski; mağaza "gizli özellik" sayabilir. |
| C. Önceden hazırlanmış deneme cüzdanı / cihaz | uygulanamaz | İnceleyici kendi cihazında yükler; anahtarlar cihaza bağlıdır (WL1). |
| **D. Süreli, tek kullanımlık inceleme kodu → sahte sağlayıcı + ayrı deneme imzacısı** | **kabul** | Yalnız kodu bilen kullanır; belge gerçek ekosistemde geçmez; her kullanım kayıtlı. |

# Karar

## K1 — Kod
- Operatör kodu sunucudan üretir (`ops` betiği; konsoldan değil): rastgele, en az 128 bit, okunur biçimde (ör. 4×5 karakter).
- Saklanan yalnız kodun özetidir (HMAC, servis anahtarıyla); düz kod saklanmaz ve günlüğe yazılmaz.
- Geçerlilik: en çok 14 gün; **tek kullanımlık** (ilk başarılı kimlik akışında tükenir); aynı anda en çok 3 etkin kod.
- Kod mağaza inceleme notuna yazılır; başka yerde paylaşılmaz.

## K2 — Kodun etkisi (yalnız o oturum)
- Cüzdanda kimlik akışının başında "İnceleme kodum var" bağlantısı **gösterilmez**; kod, `/authorize` sayfasındaki KVKK aydınlatma
  ekranında küçük bir "İnceleme kodu" alanına girilir (gerçek kullanıcı akışı değişmez).
- Geçerli kodla kimlik servisi o [[t:PAR]] için sahte sağlayıcıyı kullanır (`FakeIdvProvider`; hazır deneme kişileri); gerçek
  sağlayıcıya hiçbir istek gitmez.

## K3 — Deneme belgeyi gerçek ekosistemde geçmez
- Belge, kimlik servisinin gerçek anahtarıyla **değil**, ayrı bir deneme imzacısıyla imzalanır. Deneme imzacısı
  [[t:trust-list|güven listesinde]] ayrı bir `DEMO` kayıt olarak durur; yalnız Tamga Verify'daki "inceleme" politikaları onu kabul eder.
- Belgede `verification_method: "review-demo"`; ad alanları açıkça "DEMO" içerir; `exp` en çok 7 gün.
- Kurum [[t:issuer|belge verenleri]] (üniversite vb.) deneme imzacısının belgesini kimlik eşleştirmede **kabul etmez** (güven listesi
  politikası).
- Takma ad tohumu deneme imzacısıyla ve deneme anahtarından türetilir; gerçek tohumlarla çakışmaz.

## K4 — İnceleyicinin deneyebildikleri
Kodla: kimlik doğrulama → kimlik belgeyi → "Tamga ile giriş yap" örnek sitesi (takma ad) → Tamga Verify "18 yaş üstü" örneği →
cüzdanı sıfırla ve verilerimi sil. Kodsuz: bilet satın alma ve kapıda gösterme, doğrulama politikaları sayfası.

## K5 — İz
Her kod kullanımı olay günlüğüne yazılır (`review_code.used`; kod özeti değil, kod kimliği); deneme belgeleri ayrı sayılır ve
şeffaflık raporunda "mağaza incelemesi" olarak görünür.

# Gerekçe / alternatifler

Seçenekler tablosunda. D, gerçek kullanıcı akışını değiştirmeden ve gerçek ekosisteme sahte belge sızdırmadan inceleyicinin
bütün yolları denemesini sağlayan tek seçenek. Bedeli: kimlik servisinde ikinci bir imzacı ve güven listesinde bir `DEMO` kaydı.

# Riskler

| Risk | Önlem |
|---|---|
| Kod sızar ve başkası kullanır | tek kullanımlık, süreli, en çok 3 etkin; deneme belgeyi gerçek doğrulayıcıda geçmez |
| Deneme belgeyi gerçek sanılır | ayrı imzacı, `DEMO` işareti, cüzdanda "DEMO" rozeti, 7 gün |
| Mağaza "gizli özellik" sayar | inceleme notunda açıkça anlatılır; kod alanı aydınlatma ekranında görünür, gizli değil |
| Sahte sağlayıcı canlıda yanlışlıkla genel açılır | kod olmadan sahte sağlayıcıya geçiş yolu yok; `TAMGA_IDV_DIDIT_FAKE` canlıda kapalı kalır |

# Değişmezler

| Kod | Kural |
|---|---|
| RV1 | İnceleme kodu yalnız özetiyle saklanır, süreli (≤ 14 gün) ve tek kullanımlıktır; günlüğe düz yazılmaz. |
| RV2 | İnceleme koduyla verilen belge, kimlik servisinin gerçek imzacısıyla imzalanmaz ve yalnız inceleme politikalarında geçer. |
| RV3 | İnceleme kodu olmadan canlı kimlik servisi sahte doğrulama sağlayıcısına geçemez. |

# Uygulama planı

| Adım | Nerede | İş |
|---|---|---|
| 1 | `apps/id` (operatör deposu) | kod tablosu (özet, son kullanma, kullanıldı), `/authorize` kod alanı, PAR başına sağlayıcı seçimi, deneme imzacısı |
| 2 | `ops` (operatör deposu) | `review-code.ts` (üret / listele / iptal) |
| 3 | `tamga-network` güven listesi | `DEMO` deneme imzacısı kaydı; kurum belge verenlerinin eşleştirme politikası onu dışlar |
| 4 | `apps/verify` | "inceleme" politikaları (deneme imzacısını kabul eden) |
| 5 | Tamga Wallet (ayrı depo) | "DEMO" rozeti (belge `verification_method: review-demo`) |
| 6 | Belgeler | SPEC-ID-0003 §9, mağaza inceleme notu |

Tahmini iş: 2–3 gün (testlerle).

## Uygulama

- **Kod:** `apps/id/src/review.ts` (operatör deposu) (26 karakter Crockford base32 = 130 bit; HMAC özeti, belge özeti anahtarından
  HKDF ile ayrı alt anahtar; etkin kodlar sabit süreyle karşılaştırılır); tablo `review_codes`; operatör aracı
  `ops/review-code.ts create | list | revoke` (operatör deposu). Kod ilk başarılı belge verme işleminde tükenir; akış sürerken
  başka oturuma verilmez. Sınır: PAR başına 5 hatalı deneme, servis geneli 10 dakikada 20 hatada 15 dakika kilit (IP yok — G2);
  nginx `/authorize/consent` hız sınırı.
- **Akış:** `/authorize` aydınlatma sayfasında kapalı "İnceleme kodu" ayrıntısı; geçerli kodla `/review-idv/{oturum}` (koda özgü
  DEMO kişi). Kodsuz akış ve `/fake-idv` değişmez (RV3; canlıda `/fake-idv/` nginx'te kapalı).
- **İmzacı:** `ops/pki/issuer-id-review` (dev PKI; sertifika depoda, özel anahtar `upload.ps1 -WithPki` ile sunucuya). Güven listesi
  kaydı `tamga-id-review` (IDENTITY, [[t:EAA]], **I1**; iptal listesi anahtarı kimlik servisininki) **bekleyen başvuru** olarak
  `apps/trust-publisher/registry/pending/`: [[ADR-0024]] yeni kayıtlarda kurumun kimlik numarası ve adresini zorunlu kıldığı için
  Tamga'nın bu bilgileri girilince `register issuer` ile eklenir. O zamana kadar inceleme yolu "etkin değil" der (503).
- **Doğrulama:** Tamga Verify `review-age-over-18` ve `review-site-signup` (I1); örnek sitede "DEMO belgeyle kayıt ol". Gerçek
  politikaların hepsi I2 ister → DEMO belge E1'de RED (test: `packages/verifier/src/review-demo.test.ts`).
- **Şema:** `verification_method` değerlerine `review-demo` eklendi (geliştirme evresi, [[ADR-0029]]); FW-RB-0003 (Identity
  Rulebook) buna göre yazıldı.
- **Cüzdan:** belge ayrıntısında "DEMO — uygulama inceleme belgesi" kartı.

# Karara bağlanan sorular (proje yönetimi, 2026-10-01)

1. D seçeneği **kabul**.
2. Kod alanı **kimlik servisinin aydınlatma (onay) sayfasında**.
3. Deneme belgesinin geçerliliği **7 gün**.

# Durum

**Accepted — 2026-10-01** (proje yönetimi onayı: üç soru da kabul). Uygulama: yukarıdaki plan.

# Uygulama notu — 2026-10-04: mağaza incelemesi yalnız kimlik akışı

Gerçek ağda test ve demo içeriği kalmaz; hepsi sandbox'tadır ([[ADR-0038]]; proje yönetimi onayı, 2026-10-04). Bu yüzden
Bağlam ve K4'teki **kodsuz yollar** (bilet satın alma ve kapıda gösterme, Tamga Verify deneme politikaları sayfası, "Tamga ile giriş
yap" örnek sitesi) gerçek ağda artık yoktur ve inceleme notuna yazılmaz; bunlar sandbox'ta denenir. Mağaza incelemesi yalnız
kimlik akışıdır: inceleme kodu → DEMO kimlik belgesi → Tamga Verify inceleme politikaları (`review-age-over-18`,
`review-site-signup`). İnceleme politikaları gerçek ağda kalır ama Tamga Verify ana sayfasında vitrin olarak gösterilmez;
inceleyiciye doğrudan bağlantı verilir. Karar (D seçeneği, K1–K3, K5, RV1–RV3) değişmez.
Aynı tarihte sahte kimlik sağlayıcı gerçek ağda kod kilidiyle tamamen kapandı (`TAMGA_IDV_DIDIT_FAKE=1` ile servis açılmaz);
inceleme kodu yolu bundan bağımsızdır.
