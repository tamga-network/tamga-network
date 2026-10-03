---
document_id: ADR-0019
title: "Kurum Konsolu"
status: Active
version: 1.0.0
created: 2026-09-28
last_updated: 2026-10-02
summary: >
  Barındırılan hizmetlerin kurum tarafı tek bir Kurum Konsolu'nda toplanır (console.tamga.network): kurum personeli davetle
  hesap açar ve passkey ile girer; verilen belgeler, iptal/askı, kayıt defteri (ör. öğrenciler), API anahtarları, kullanıcılar
  ve kurum kaydı buradan yönetilir. Öğrenciye dönük "belgemi cüzdanıma al" portalı kaldırılır — kişi belgeyi cüzdandan ister.
  Operatör verisi JSON dosyalarından PostgreSQL'e taşınır. D-NAME-1'deki portal.tamga.network satırını değiştirir.
domain: Services
---

# Bağlam

Liste aşamasında Tamga, [[t:issuer|belge veren]] kurumlar adına belge verme servisini barındırır ([[ADR-0016]]). Bugün kurum tarafı `portal.tamga.network/{slug}`
iki şeyi birden yapıyor: (1) öğrenciye "belgemi cüzdanıma al" sayfası — kurumun kendi öğrenci bilgi sisteminin taklidi; (2)
öğrenci işleri paneli (verilen belgeler, iptal). Veriler sunucuda JSON dosyalarında (`data/<kurum>/state.json`,
`students.json`, `tickets.json`, `api-keys.json`); kurum kendi verisini güncelleyemiyor, girişi tek ortak parola.

Kişi belgesini zaten cüzdandan ister ([[ADR-0011]] K3: kurum ara → kimlik belgesiyle eşleştirme → belge). Öğrenciye ayrı
bir web sayfası gereksiz ve kurgu hatasıdır. Kurumun ihtiyacı ise gerçek bir yönetim yeridir: imza atılan gün kullanmaya
başlayabileceği, personelinin ayrı hesaplarla girdiği, verisini kendisinin güncellediği bir konsol.

# Karar

## K1 — Kurum Konsolu

Barındırılan hizmetlerin kurum tarafı **Kurum Konsolu**'dur (İngilizce "Institution Console"), adres
`console.tamga.network`. Kurum rolüne göre sekmeler:

| Sekme | Kim | İçerik |
|---|---|---|
| Belgeler | belge veren | verilen belgeler (tür, tarih, kopya sayısı), iptal / askı / geri alma, masada teklif (QR + PIN) |
| Kayıt defteri (ör. Öğrenciler) | belge veren | kurumun eşleştirme kayıtları: ekle, düzenle, sil. **Örnek kayıt defteri** olarak işaretlenir: kurumun kendi sistemi bağlanana kadar kullanılır |
| Biletler / etkinlikler | bilet satıcısı | satışlar, etkinlikler |
| API anahtarları | belge veren | oluştur (bir kez gösterilir), iptal et, kapsam ve süre ([[ADR-0016]]) |
| Kullanıcılar | kurum yöneticisi | personel daveti, rol (yönetici / personel), kaldırma |
| Kurum kaydı | herkes | güven listesindeki kayıt: yetkili belge türleri, durum, sertifika parmak izi (salt okunur) |

[[t:verifier]] istatistikleri (kapı geçiş sayıları; kişisel veri yok) konsola sonraki adımda eklenir.

## K2 — Giriş: davet + passkey

- Operatör kurumun ilk yöneticisi için **tek kullanımlık davet bağlantısı** üretir (72 saat). Yönetici bağlantıyı açar, cihazında
  **passkey** tanımlar (Face ID / Windows Hello / parmak izi). Parola yoktur; e-posta sunucusu gerekmez.
- Yönetici kendi personelini aynı yolla davet eder. Kullanıcı bir kuruma bağlıdır; başka kurumun verisini göremez.
- Oturum sunucu tarafında tutulur (≤ 8 saat, `HttpOnly`, `Secure`, `SameSite=Lax`); durum değiştiren istekler aynı site kökenli
  olmalıdır.
- Kurumun kendi kimlik sağlayıcısıyla giriş (SSO) sonraya bırakılır.

## K3 — Öğrenci portalı kalkar

`portal.tamga.network` ve öğrenciye dönük "belgemi cüzdanıma al" sayfası kaldırılır. Kişi belgeyi **cüzdandan** ister; eşleştirme
konsoldaki kayıt defterine karşı yapılır. Masada yüz yüze ihraç gerekirse personel konsoldan teklif (QR + PIN) üretir.

## K4 — Operatör veritabanı: PostgreSQL

Barındırılan hizmetlerin kalıcı verisi **PostgreSQL**'dedir: kurumlar, kayıt defteri, verilen belgeler, iptal listesi durumu,
olay günlüğü, biletler, API anahtarı özetleri, konsol kullanıcıları / passkey'ler / davetler / oturumlar. Kısa ömürlü protokol
durumu (teklif, [[t:PAR]], erişim belirteci, [[t:nonce]] — dakikalar) servis belleğinde kalır. Yerel geliştirme ve testler aynı SQL'i gömülü
PostgreSQL (PGlite) ile çalıştırır; canlıda `DATABASE_URL`. Veritabanı kişisel veriyi yalnızca kayıt defterinde tutar (kurumun
kendi verisi, kurum adına); günlükler kişisel veri içermez (AP3/AP4 aynen).

## K5 — Alan adı

D-NAME-1 v1.2: `portal.tamga.network/{slug}` → **`console.tamga.network`** (kurum oturumdan belirlenir, yolda slug yok).

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Portalı olduğu gibi bırakmak | ret | Öğrenci sayfası cüzdan akışıyla çakışıyor; kurum verisini yönetemiyor |
| SQLite | ret | Tek dosya, kurulumu basit; çok kurum ve eşzamanlı yazma, yedekleme ve büyüme için PostgreSQL |
| E-posta + parola + kod | ret | Parola çalınabilir; e-posta servisi gerekir |
| Kurum SSO | sonraya | Kurum başına ayar; pilot sonrası |
| `portal.` adını korumak / `kurum.` | ret | Proje yönetimi `console.tamga.network`'ü seçti |

# Değişmezler

| Kod | Kural |
|---|---|
| KC1 | Konsol kullanıcısı yalnızca bağlı olduğu kurumun verisini görür ve değiştirir. |
| KC2 | Konsola giriş passkey iledir; parola saklanmaz. Davet tek kullanımlıktır ve süreli; yalnızca özeti saklanır. |
| KC3 | Konsol ve veritabanı günlükleri kişisel veri, claim değeri, status `idx` içermez; kayıt defteri kişisel veriyi yalnızca kurum adına eşleştirme için tutar. |
| KC4 | Kayıt defteri "örnek kayıt defteri" olarak işaretlenir; kurumun kendi sistemi (API ya da kaynak bağlantısı) bağlanınca yerini ona bırakır. |

# Sonuçlar

- operatör deposu: `apps/console` (portalın yerine), `shared/db` (PostgreSQL / PGlite, sürümlü şema), belge verenin kalıcı verisi
  veritabanında; JSON dosyaları yalnızca ilk yükleme (seed) içindir.
- `ops`: PostgreSQL kurulumu, `console.tamga.network` nginx bloğu + sertifika adı, `DATABASE_URL`, davet komutu.
- D-NAME-1 → v1.2 (DECISIONS "Değiştirilen Kararlar"); `docs/_internal/delivery/10-ALAN-ADLARI.md`.
- Kimlik servisi (`apps/id`) verisinin taşınması ve doğrulayıcı istatistikleri sonraki adımdır.

# Durum

**Accepted — 2026-09-28.** Seçilen: PostgreSQL, davet + passkey, `console.tamga.network`. DECISIONS: D-CONSOLE-1.

**Uygulama notu (2026-09-28).** Kimlik servisinin kalıcı verisi de veritabanında; akış durumu ve kişi alanları yalnız
bellekte (diske hiç yazılmaz). Konsola **Kapılar** sekmesi eklendi: kurumun kapı gruplarında gün başına geçiş / red / neden —
yalnız sayı; kişi, kart kimliği, saat tutulmaz (doğrulayıcı `/stats/gates`, iç ağ).
