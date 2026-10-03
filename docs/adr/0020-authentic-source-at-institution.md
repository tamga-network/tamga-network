---
document_id: ADR-0020
title: "Yetkili kaynak kurumdadır"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Barındırılan ihraçta kişi verisinin yetkili kaynağı kurumdur; Tamga kişi kaydı tutmaz. İki yol: (A) kurum API ile kişinin kimliğine
  bağlı bir teklif oluşturur, bağlantıyı kendisi gönderir; kişi cüzdanda kimliğini sunar, eşleşirse belge verilir. (B) kişi cüzdandan
  ister, kimliğini sunar; Tamga kurumun sorgu ucuna imzalı istekle sorar. Belge bilgileri her iki yolda imza anında kurumdan okunur,
  saklanmaz. Kurum Konsolu'ndaki kayıt defteri yalnız "örnek kaynak" (deneme) olarak kalır.
domain: Services
---

# Bağlam

Bugün barındırılan ihraçta Tamga, kurumun kişi kayıtlarını (öğrenciler) kendi veritabanında tutar ([[ADR-0019]]). Kayıtlar Kurum
Konsolu'ndan girilir. Kişi cüzdandan belge isteyince kimliği bu kayıt defterinde aranır. Kurum teklif oluşturunca da kişi bu
defterden seçilir.

Proje yönetimi (2026-09-29) bu yapıyı istemedi:
- toplu öğrenci yüklemesi olmayacak,
- "bizim veri ile işimiz yok",
- yetkili kaynak kurumun kendi sistemidir (öğrenci bilgi sistemi),
- teklif e-postasını kurum kendi gönderir,
- öğrencinin cüzdandan isteyip Tamga'nın kuruma sorması onaylandı,
- teklifin kişinin kimliğine bağlı olması onaylandı.

AB tarafında da bir [[t:PID]] ya da belge sağlayıcı, özniteliği [[t:authentic-source|yetkili kaynaktan]] alır ([[t:ARF]] konu 42; CIR 2025/1569). Kaynak veriyi
aracının kalıcı olarak tutması beklenmez.

# Karar

## K1 — Yetkili kaynak ve kaynak bağlantısı

Her kurum için bir **kaynak bağlantısı** tanımlanır (`tenants/<slug>.json` → `authentic_source`):

- **`remote`** (üretim): kurumun **sorgu ucu**. Tamga iki işlem ister:
  - `lookup`: kimlik anahtarlarıyla (T.C. kimlik no + doğum tarihi) arama → kurumun opak kişi kimliği (`subject_ref`) +
    belge bilgileri,
  - `fetch`: `subject_ref` ile belge bilgileri (yenileme ve kimliğe bağlı teklif için).

  İstek Tamga'nın kurum için kullandığı erişim anahtarıyla imzalı kısa ömürlü bir JWT'dir (`aud` = sorgu ucu, `iat`, `jti`); kurum
  isteği Tamga'nın [[t:trust-list|güven listesindeki]] sertifikasıyla doğrular. Yanıt ve biçim OpenAPI ile tanımlıdır.
- **`sandbox`** (deneme): Kurum Konsolu'ndaki örnek kayıt defteri ([[ADR-0019]] KC4). Yalnız deneme ve gösterim içindir; gerçek
  kişi verisiyle kullanılmaz.

## K2 — Tamga ne tutar

- Belge bilgileri (ad, program, not …) **tutulmaz**: imza anında kaynaktan okunur, belge verilince bellekten atılır.
- Kalıcı olan yalnız kurumun opak `subject_ref`'i (verilen belge kaydında, iptal ve yenileme için) ve kimliğe bağlı teklifte eşleştirme
  anahtarlarının **anahtarlı özeti**dir (HMAC; düz T.C. kimlik no yok).
- Günlüklere kişi verisi yazılmaz (PR14 aynen).

## K3 — Yol A: kurum başlatır, teklif kişinin kimliğine bağlıdır

1. Kurumun sistemi Tamga API'sine (`POST /{slug}/api/v1/offers`, [[ADR-0016]]) şunları gönderir:
   - belge türü,
   - kurumun `subject_ref`'i,
   - eşleştirme anahtarları: `bind { personal_administrative_number, birth_date }`.
2. Tamga bir **kimliğe bağlı teklif** üretir: [[t:OpenID4VCI]] `authorization_code` grant'ı, `issuer_state` = teklif kimliği. Yanıtta
   bağlantı ve QR gelir. **E-postayı ya da mesajı kurum kendi gönderir**; Tamga iletişim adresi görmez.
3. Kişi bağlantıyı cüzdanda açar. Cüzdan [[t:PAR|PAR'da]] `issuer_state`'i gönderir. Yetkilendirme sırasında kişi Tamga kimlik belgesini
   sunar (mevcut satır içi akış).
4. Kurum [[t:issuer|belge vereni]] kimlik belgesini doğrular ve T.C. kimlik no + doğum tarihinin özetini teklifteki özetle karşılaştırır. Eşleşmezse
   belge verilmez. Teklifi başkası açsa bile belge alamaz.
5. Belge bilgileri imza anında kaynaktan (`fetch`) okunur.
6. `tx_code`'lu ön-yetkili teklif, kimlik belgesi olmayanlar için **yedek** olarak kalır. Kod teklifle aynı kanaldan gönderilmez
   (PR12).
7. Teklif varsayılan olarak 7 gün geçerlidir ve tek kullanımlıktır.

## K4 — Yol B: kişi başlatır

Kişi cüzdandan kurumu seçer ve kimliğini sunar. Kurum belge vereni kaynak bağlantısına `lookup` ile sorar (`sandbox`'ta kayıt defteri).
Kayıt varsa belge verilir; kayıt yoksa "kurum kaydında bulunamadı" döner. Yanıt saklanmaz.

## K5 — Yenileme ve iptal

Yenileme belirteci ([[ADR-0023]]) `subject_ref` taşır. Yenilemede `fetch` çağrılır; kişi kaynakta yoksa belirteç düşer (AR3).
Kurum iptali API'den ya da Konsol'dan yapar ([[ADR-0016]]).

## K6 — Kurum kiti

- **OpenAPI:** Tamga API'si (teklif, iptal) ve kurumun sorgu ucu sözleşmesi.
- **Node SDK:** `@tamga-network/issuer/client`'e kimliğe bağlı teklif eklenir.
- Kendi sunucusunda belge veren çalıştırma seçeneği korunur ([[ADR-0016]]).

## K7 — Kurum Konsolu

- "Kayıt defteri" sekmesi **"Örnek kaynak (deneme)"** olur ve yalnız `sandbox` modunda görünür.
- "Kurum kaydı" sekmesi kaynak bağlantısının türünü ve sorgu ucunu gösterir.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Tamga'da kayıt defteri (bugünkü) | ret (yalnız deneme) | Tamga kişi verisi tutar; toplu yükleme gerekir |
| Kurum belge bilgilerini teklifle gönderir, Tamga saklar | ret | Bilgi teklif süresince Tamga'da durur; sorgu ucu varsa gereksiz |
| **Teklifte yalnız subject_ref + kimlik özeti; bilgi imza anında kaynaktan** | **kabul** | Tamga'da kalıcı kişi verisi yok; yenileme de aynı yoldan |
| Tamga teklif e-postasını gönderir | ret | Tamga iletişim adresi görür; proje yönetimi kurumun göndermesini istedi |
| Kimlik bağı yok, yalnız tx_code | ret (yedek) | Bağlantıyı ele geçiren belgeyi alabilir |

# Değişmezler

| Kod | Kural |
|---|---|
| AS1 | Barındırılan ihraçta belge bilgileri kalıcı olarak tutulmaz; imza anında yetkili kaynaktan okunur. Kalıcı olan yalnız kurumun opak kişi kimliği ve eşleştirme anahtarlarının anahtarlı özetidir. |
| AS2 | Kimliğe bağlı teklif, yalnızca sunulan kimlik belgesindeki eşleştirme anahtarları teklifteki özetle eşleşirse belgeye dönüşür. |
| AS3 | Tamga teklif için kişinin iletişim adresini almaz; bağlantıyı kurum iletir. |
| AS4 | `sandbox` kaynağı yalnız deneme içindir; gerçek kişi verisiyle kullanılmaz. |

# Sonuçlar

- `apps/issuer` (operatör deposu): kaynak bağlantısı soyutlaması (`sandbox` / `remote`), kimliğe bağlı teklif (`issuer_state`),
  Yol B'de `lookup`, belge ucunda `fetch`, yenilemede `fetch`.
- `@tamga-network/issuer`: `createPar` `issuer_state`; teklif nesnesi `authorization_code` grant'ı. `wallet-core`: teklif
  `authorization_code` grant'ı → `issuer_state`'li yetkilendirme.
- [[ADR-0011]] K3 ve [[ADR-0019]] kayıt defteri maddeleri bu ADR ile daralır. [[SPEC-PROTO-0001]] §3 ve §11.2 güncellenir.
- OpenAPI dosyaları `tamga-network/docs/api/`.

# Durum

**Accepted — 2026-09-29.** Proje yönetimi onayıyla (toplu yükleme yok; e-postayı kurum gönderir; Yol B; kimliğe bağlı teklif).
DECISIONS: D-SRC-1.
