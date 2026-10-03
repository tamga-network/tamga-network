---
document_id: ADR-0018
title: "Belgelerin üç kapısı"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Dışa dönük belgeler, AB'deki düzen gibi üç ayrı kapıdan yayınlanır: genel anlatım (tamga.network/docs), geliştirici
  belgeleri (docs.tamga.network) ve Tamga ARF (arf.tamga.network — mimari ve referans çerçevesi ile ekleri). Tamga ARF
  İngilizce ve Türkçe yayınlanır; Türkçe metin kaynak kalır, İngilizce aynı sürümün resmî çevirisidir ve sürüm kayması
  derlemede yakalanır. D-GOV-6'nın yayın satırını değiştirir.
domain: Governance
---

# Bağlam

D-GOV-6 (2026-09-24) çerçeve belge setini (Tamga ARF, [[t:trust-framework|Trust Framework]], [[t:rulebook|Rulebook]], [[t:attestation]] rulebook'ları) tanımladı ve
yayın yerini `docs.tamga.network` olarak koydu. Bugünkü durum:

- `tamga.network/docs` genel anlatımla geliştirici sayfalarını (entegrasyon, kod) karıştırıyor.
- `docs.tamga.network` her şeyi bir arada sunuyor: çerçeve belgeleri, kılavuzlar, spesifikasyonlar, ADR'ler, iç çalışma
  kayıtları (teslimat, Faz B analizi). Düzenleyici ya da kurum için [[t:ARF]] bu kalabalıkta kayboluyor.
- AB'de aynı ihtiyaç üç ayrı yerle karşılanır: vatandaş/kurum anlatımı (Komisyon sitesi), geliştirici merkezi ve **ARF**
  (ayrı, sürüm numaralı, İngilizce yayın; ekleri: yüksek seviye gereksinimler, attestation rulebook'ları).

Proje yönetiminin isteği (2026-09-27): belgeler AB'deki gibi ayrılsın — genel belgeler, geliştirici belgeleri ve bir ARF.

# Karar

## K1 — Üç kapı

| Kapı | Adres | Okur | İçerik |
|---|---|---|---|
| **Genel** | `tamga.network/docs` (tamga-web, üç dil) | kurum, karar verici, vatandaş | kavramlar, e-kimlik ve eIDAS, Tamga Wallet, nasıl çalışır, senaryolar, sözlük |
| **Geliştirici** | `docs.tamga.network` (VitePress, `tamga-network/docs`) | yazılımcı, entegratör | kılavuzlar, kod örnekleri, paketler, spesifikasyonlar, ADR'ler, kayıtlar |
| **Tamga ARF** | `arf.tamga.network` (VitePress, `tamga-network/arf`) | düzenleyici, kurum, denetçi | ana belge (FW-ARF-0001) + Ek A Trust Framework + Ek B katılımcı kuralları + Ek C attestation rulebook'ları |

Her kapı diğer ikisine görünür bağlantı verir. Çerçeve belgelerinin **tek kamu yeri** `arf.tamga.network`'tür;
`docs.tamga.network` onları yeniden yayınlamaz, `[[FW-*]]` atıflarını ARF sitesine bağlar.

## K2 — Ad ve alan adı

Kamuya açık ad **"Tamga ARF"** (açılımı: Mimari ve Referans Çerçevesi / Architecture and Reference Framework). Yeni alt alan
adı `arf.tamga.network` (statik; D-NAME-1 hizmet listesine belge yayını olarak eklenir, ağ hizmeti değildir).

## K3 — Dil ve kaynak

- Tamga ARF **İngilizce + Türkçe** yayınlanır; kök sayfa İngilizce (`/`), Türkçe `/tr/`.
- **Kaynak Türkçedir:** `docs/framework/*.md` (DOC-ID atıfları, MASTER_INDEX, onay süreci burada). Türkçe sayfalar derlemede
  bu dosyalardan üretilir.
- İngilizce `arf/*.md` elle çevrilir; her dosya `translation_of` ve `source_version` taşır. Kaynak sürüm artıp çeviri
  güncellenmezse derleme durur (`npm run arf:check`, CI).
- Çelişkide Türkçe kaynak geçerlidir; bu, bir devlet ya da konsey belgeyi devraldığında yeniden değerlendirilir
  ([[FW-TF-0001]] §7).

## K4 — Sürüm

Tamga ARF bir **yayın numarası** taşır (ör. "Tamga ARF 1.0"); her belgenin kendi sürümü ayrıca görünür. Yayın numarası,
setteki herhangi bir belgenin MINOR ya da MAJOR artışında yükselir; sürüm geçmişi ARF sitesinde herkese açıktır.

# Değerlendirilen seçenekler

| Seçenek | Artı | Eksi | Sonuç |
|---|---|---|---|
| Hepsi `tamga.network` altında (`/docs`, `/developers`, `/arf`) | tek site, yeni alan adı yok | ARF bir tanıtım sitesinin parçası gibi durur; iki farklı yayın aracı tek sitede | ret |
| Ayrı adresler, geliştirici için de yeni alan adı | en temiz ayrım | iki yeni alan adı; `docs.tamga.network` bağlantıları kırılır | ret |
| **Ayrı adresler; geliştirici `docs.` kalır, ARF `arf.`** | AB düzenine en yakın; ARF resmî belge gibi durur; mevcut bağlantılar korunur | bir yeni alt alan adı | **seçildi** |
| ARF yalnızca Türkçe | hızlı | uluslararası okur (AB, TDT devletleri) İngilizce okur | ret |
| ARF üç dil (EN/TR/TK) | sitenin geri kalanıyla aynı | en çok iş; Türkmence metnin ayrıca okunması gerekir | sonraya |

# Sonuçlar

- `tamga-network/arf/` (VitePress, iki dil) + `scripts/arf-sync.mjs` (Türkçe kaynaktan üretim, `--check` sürüm denetimi).
- `docs.tamga.network` geliştirici belgeleri olarak yeniden düzenlenir; çerçeve bölümü ARF'ye bağlanır.
- `tamga-web`: menü ve alt bilgi üç kapıyı gösterir; `/docs` genel anlatımda kalır.
- `ops` (operatör deposu): nginx `arf.tamga.network` bloğu, `deploy.sh` derleme + yayın; DNS kaydı (operatör).
- D-GOV-6'nın "Yayın" satırı bu ADR'ye bağlanır (DECISIONS "Değiştirilen Kararlar").
- K4 uygulaması: yayınlar `arf/releases.json`'da; her yayın `arf/archive/<yayın>/` altında dondurulur (`npm run arf:snapshot`)
  ve `/v<yayın>/` adresinde okunabilir kalır; sitede sürüm menüsü ("latest" etiketi) ve yayınlar arası satır farkı sayfası
  (`/changes`). `arf:check` yayın kaydı ↔ belge sürümleri ↔ arşiv tutarlılığını da denetler.

# Değişmezler

| Kod | Kural |
|---|---|
| DY1 | Çerçeve belgelerinin (FW-*) kamuya açık tek yayın yeri Tamga ARF sitesidir; başka site kopyasını yayınlamaz, bağlantı verir. |
| DY2 | Tamga ARF'nin İngilizce çevirisi Türkçe kaynağın aynı sürümünü taşır; sürüm farkı varken yayın yapılmaz. |
| DY3 | Tamga ARF sayfaları özel depo yollarına, konuşmalara ya da kiracı verisine bağlantı vermez. |

# Durum

**Accepted — 2026-09-27.** Seçilen: ayrı adresler, İngilizce + Türkçe ARF, ad "Tamga ARF". DECISIONS: D-DOCS-1.

**Not (2026-10-02):** genel anlatım kapısı `tamga.network/learn` adresine taşındı ("Öğren": sıfırdan Tamga Network'e uzanan öğrenme yolu). Karar değişmedi; yalnız adres değişti.
