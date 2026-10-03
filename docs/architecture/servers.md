---
document_id: ARCH-0004
title: "Sunucular ve işletim"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  "Hangi sunucu ne işe yarar" dokümanı. Makine makine envanter (rol, işleten,
  donanım, disk, port, arıza etkisi), ortamlar, ağ segmentasyonu, anahtar ve sır
  yönetimi, bileşen bazlı SLO'lar — ve kritik olarak MAHREMİYET KORUYAN
  LOGLAMA kuralları: doğrulama loglarının kendisi bir takip yüzeyidir.
  Ayrıca kapasite hesabı SPEC-CRED-0003 Açık Konu 1'i kapatır: 1.000 issuer'ın
  saatlik status yayını ~0,28 TPS'tir, QBFT için ihmal edilebilir; asıl sınır
  işlem hızı değil kalıcı durum büyümesidir. Felaket kurtarma ve olay müdahale
  runbook'ları dahil.
---

# Kapsam

[[ARCH-0001]] node **rollerini**, [[ARCH-0003]] uygulama **bileşenlerini**
tanımlar. Bu doküman onları **fiziksel makinelere** oturtur: kim işletir, ne
kadar donanım, hangi port, düştüğünde ne olur, nasıl izlenir.

---

# 1. Ortamlar

| Ortam | Zincir | Amaç | Veri |
|---|---|---|---|
| **local** | tek node, `--dev` | Geliştirici makinesi | Sahte |
| **testnet** | 4 validator, vakıf | Entegrasyon, issuer denemesi | Sahte |
| **staging** | 4 validator, prod ikizi | Sürüm provası, yükseltme provası | Sahte |
| **mainnet** | Faz 0: 4 vakıf → Faz 1: devletler | Üretim | Gerçek |

**Kural:** Yükseltmeler ([[SPEC-BC-0001]] §9) **önce staging'de** aynı adımlarla
uygulanır. UUPS brick riski geri dönüşsüz olduğu için bu prova atlanamaz.

---

# 2. Sunucu Envanteri

## 2.1 Zincir katmanı

| Rol | Kim işletir | vCPU / RAM | Disk | Adet (Faz 0 / Faz 1) | Düşerse |
|---|---|---|---|---|---|
| **Validator** | Faz 0 vakıf, Faz 1 devletler | 8 / 32 GB | 1 TB NVMe | 4 / 7+ | 1 kayıp tolere edilir (4'te), 2 (7'de) |
| **Bootnode** | Vakıf | 2 / 4 GB | 100 GB SSD | 2 / 2+ | Yeni node ağa giremez; mevcutlar çalışır |
| **RPC node** | Her devlet + vakıf | 8 / 32 GB | 1 TB NVMe | 2 / devlet başına 2 | İndeksleyici duraklar, doğrulama önbellekten sürer |
| **Archive node** | Vakıf + isteyen devlet | 8 / 64 GB | 4 TB NVMe (büyür) | 1 / 2+ | Denetim/adli sorgu durur; işletim etkilenmez |
| **Observer** | Yetkili kurumlar | 4 / 16 GB | 500 GB SSD | isteğe bağlı | Yalnızca o kurum |

**Validator sayısı neden tek:** QBFT'de arıza toleransı `f = (n-1)/3`. n=4 → f=1;
n=7 → f=2. Çift sayı fazladan tolerans getirmez, yalnızca maliyet ekler.
Ayrıntı [[ARCH-0001]] §3.

**Archive disk büyür:** Her `publishList` kalıcı durum yazar (§7). Yıllık
büyüme tahmini §7.2'de.

## 2.2 Uygulama katmanı — vakıf tarafı

| Bileşen | vCPU / RAM | Disk | Adet | SLO | Düşerse |
|---|---|---|---|---|---|
| **İndeksleyici** | 4 / 16 GB | 200 GB SSD | 2 (aktif/yedek) | %99,5 | Doğrulama `INDETERMINATE` ya da RPC'ye düşer |
| **İndeksleyici DB** (PostgreSQL) | 4 / 16 GB | 500 GB SSD | 1 + replika | %99,5 | Aynı |
| **`schemas.tamga.network`** | statik + CDN | — | CDN | %99,9 | Yeni tip öğrenilemez; bilinen tipler çalışır |
| **Gözlemlenebilirlik yığını** | 4 / 16 GB | 1 TB | 1 | — | Körleşme; işletim sürer |
| **CI runner** | 4 / 8 GB | 200 GB | 1–2 | — | Sürüm çıkmaz |

## 2.3 Uygulama katmanı — issuer tarafı (her kurum kendi)

| Bileşen | vCPU / RAM | Disk | SLO | Düşerse |
|---|---|---|---|---|
| **Issuer service** | 4 / 8 GB | 100 GB | %99 | O kurum ihraç yapamaz; verilmiş belgeler etkilenmez |
| **Issuer DB** | 2 / 8 GB | 200 GB | %99 | Aynı — **yedeklenmesi kritik** (§7.3) |
| **Status yayıncı** (cron) | 1 / 2 GB | — | %99 | 50 saate kadar önbellekten devam ([[SPEC-CRED-0003]] §8.1) |
| **`status.<issuer>`** | statik + CDN | — | %99,5 | Aynı |
| **HSM / KMS** | — | — | %99,9 | İhraç durur |

## 2.4 Verifier tarafı (her kurum kendi)

| Bileşen | vCPU / RAM | SLO | Not |
|---|---|---|---|
| **Verifier service** | 2 / 8 GB | kurum belirler | Ön çekim önbelleği taşır ([[ARCH-0003]] §4.2) |
| **Ön çekim işi** (cron) | 1 / 2 GB | — | `ttl` aralığında toplu indirme |

---

# 3. Ağ Segmentasyonu ve Portlar

```
   İnternet
      │
      ▼
┌──────────────────────────────────────────────┐
│  DMZ                                         │
│   CDN (şema, status) · RPC (kısıtlı)         │
└───────────────┬──────────────────────────────┘
                │
┌───────────────▼──────────────────────────────┐
│  Uygulama ağı                                │
│   issuer-service · verifier-service          │
│   indeksleyici                               │
└───────────────┬──────────────────────────────┘
                │
┌───────────────▼──────────────────────────────┐
│  Zincir ağı (özel)                           │
│   validator · bootnode · archive             │
└───────────────┬──────────────────────────────┘
                │
┌───────────────▼──────────────────────────────┐
│  Anahtar bölgesi (izole)                     │
│   HSM · KMS                                  │
└──────────────────────────────────────────────┘
```

| Port | Bileşen | Erişim |
|---|---|---|
| `30303` TCP/UDP | Besu P2P | Yalnızca zincir ağı, allowlist |
| `8545` | JSON-RPC HTTP | **Asla internete açılmaz** — yalnızca uygulama ağı |
| `8546` | JSON-RPC WS | İndeksleyici, uygulama ağı |
| `8550` | QBFT admin API | Yalnızca localhost + operatör VPN |
| `9545` | Prometheus metrik | İzleme ağı |
| `443` | CDN, servis API'leri | İnternet |

**Değişmez O1:** `8545` hiçbir koşulda internete açılmaz. Açılırsa okuma
yükü herkese açılır ve ağ bir DoS yüzeyi kazanır. Dış okuma ihtiyacı
indeksleyici üzerinden karşılanır.

---

# 4. Anahtar ve Sır Yönetimi

[[ARCH-0003]] §8'deki mantıksal envanterin fiziksel karşılığı.

| Anahtar | Depolama | Erişim | Yedek |
|---|---|---|---|
| Root CA | **Çevrimdışı HSM**, kasa | Anahtar töreni, çok kişili | Shamir, coğrafi ayrık |
| Validator | Node HSM veya şifreli keystore | Node süreci | Şifreli, ayrık konum |
| State delegate | Devlet KMS | Devlet operatörü | Devletin kendi politikası |
| Issuer credential | HSM (PKCS#11) | Issuer service, dar yetki | HSM yedeği |
| Issuer status | KMS, **çevrimiçi** | Status yayıncı | KMS |
| DB parolaları, API anahtarları | Vault / bulut secret manager | Servis kimliği | Otomatik |
| TLS | ACME otomasyonu | Otomatik | — |

## 4.1 Anahtar töreni (Root CA)

Kayıt altına alınması gereken asgari şartlar: en az beş kişi (iki farklı kurum),
video kayıt, yazılı tutanak ve imza, HSM'in kırılabilir mühürle kapatılması,
Shamir paylarının farklı fiziksel kasalarda saklanması, ve **tören öncesi tam bir
prova**.

Bu, [[SPEC-ID-0002]]'de detaylandırılacak; burada envanter kalemi olarak
kayıtlıdır.

---

# 5. Gözlemlenebilirlik

## 5.1 Metrikler

| Bileşen | Kritik metrik | Alarm eşiği |
|---|---|---|
| Validator | blok üretim gecikmesi, peer sayısı | > 10 sn, < 2 peer |
| QBFT | round değişimi sayısı | dakikada > 3 |
| İndeksleyici | `last_block` gecikmesi | > 60 sn (bayat) |
| İndeksleyici | bilinmeyen implementasyon | **herhangi biri → sayfa** |
| Status yayıncı | son başarılı yayından geçen süre | > 90 dk |
| Status CDN | token `exp` kalan süre | < 6 sa |
| Şema CDN | 5xx oranı | %1 |
| Issuer service | ihraç hata oranı | %1 |
| Verifier service | `INDETERMINATE` oranı | %5 |

**`INDETERMINATE` oranı** en değerli sağlık göstergesidir: yükselmesi, bir
altyapı bileşeninin sessizce bozulduğunu doğrulama sonucuna yansımadan önce
haber verir.

## 5.2 Loglama — mahremiyet kuralları

**Bu bölüm isteğe bağlı değildir.** Doğrulama logları, doğru tutulmazsa
sistemin kendisinden daha büyük bir takip yüzeyi yaratır.

| Loglanır | Loglanmaz |
|---|---|
| `issuerId`, `schemaId` | Açıklanan claim **değerleri** |
| Doğrulama sonucu (3 değerli) | Öğrenci/mezun adı, doğum tarihi |
| Başarısız adım kodu (`C2`) | Ham SD-JWT veya disclosure |
| Zincir tazeliği | `status.status_list.idx` ← **§5.3** |
| Süre, gecikme | Cüzdan cihaz tanımlayıcısı |

### 5.3 `idx` neden loglanmaz

`status.status_list.idx` her sunumda görünür ve **sabittir**
([[SPEC-CRED-0003]] §9.4). Verifier onu loglarsa, iki farklı doğrulama olayı
aynı kişiye ait olarak eşleştirilebilir — verifier'ın kendi logu, cüzdanın
korumaya çalıştığı ilişkilendirilemezliği ortadan kaldırır.

Denetim için ilişkilendirme gerekiyorsa, `idx`'in **kuruma özel tuzlanmış
hash'i** saklanır; ham değer değil.

### 5.4 Saklama süreleri

| Log türü | Süre | Gerekçe |
|---|---|---|
| Doğrulama denetim kaydı | 12 ay | Uyuşmazlık çözümü |
| Erişim logu (CDN) | **tutulmaz** veya 7 gün, IP'siz | [[SPEC-SCHEMA-0001]] Güvenlik Notları taahhüdü |
| Uygulama hata logu | 90 gün | Hata ayıklama |
| Zincir node logu | 30 gün | İşletim |

CDN erişim logu satırı bir **politika taahhüdüdür** ve [[PM-GOV-0001]]'e
yazılmalıdır.

## 5.5 İzleme (tracing)

Doğrulama hattının beş katmanı ([[ARCH-0003]] §4.1) trace span'ı olarak
işaretlenir: `format`, `schema`, `trust`, `revocation`, `policy`. Böylece
"doğrulama neden yavaş" sorusu tek bakışta cevaplanır — genelde cevap ön
çekim önbelleğinin ıskalamasıdır.

---

# 6. SLO'lar ve Hata Bütçesi

| Bileşen | Erişilebilirlik | Gecikme (p95) | Gerekçe |
|---|---|---|---|
| Zincir (blok üretimi) | %99,9 | 2 sn blok | Tek gerçek kritik yol |
| İndeksleyici | %99,5 | 50 ms sorgu | Düşerse RPC'ye düşülür |
| `schemas.tamga.network` | %99,9 | 100 ms | Kritik yolda **değil** (§önbellek) |
| `status.<issuer>` | %99,5 | 200 ms | Kritik yolda **değil** (`exp` = 50 sa) |
| Issuer service | %99 | 2 sn ihraç | Kurum yereli |
| Verifier service | kurum belirler | 300 ms doğrulama | Kurum yereli |

**Neden şema ve status SLO'ları düşük tutulabiliyor:** İkisi de bütünlük
hash'iyle korunduğu için süresiz/uzun süre önbelleklenebilir
([[ARCH-0003]] §5). Bu, [[ADR-0007]] ve [[ADR-0008]]'in "içerik off-chain,
çapa on-chain" deseninin doğrudan operasyonel kazancıdır — pahalı bir yüksek
erişilebilirlik altyapısı kurmaktan kurtarır.

---

# 7. Kapasite Planlaması

> Bu bölüm [[SPEC-CRED-0003]] **Açık Konu 1**'i kapatır.

## 7.1 İşlem hızı

Baskın yazma yükü status yayınıdır ([[SPEC-CRED-0003]] §5.1: saatte bir,
issuer başına).

| Issuer sayısı | Günlük işlem | TPS |
|---|---|---|
| 50 (pilot) | 1.200 | 0,014 |
| 200 (Türkiye YÖ kurumları) | 4.800 | 0,056 |
| 1.000 (Türk dünyası ölçeği) | 24.000 | **0,28** |
| 10.000 (uzak hedef) | 240.000 | 2,8 |

2 saniyelik blok süresinde günde 43.200 blok üretilir. 1.000 issuer senaryosunda
blok başına ortalama **0,55 işlem** düşer. QBFT için ihmal edilebilir.

**Sonuç: işlem hızı bir sınır değildir.**

## 7.2 Asıl sınır — kalıcı durum büyümesi

Her `publishList` mevcut slot'ları günceller (yeni slot açmaz): `contentHash`,
`version`, `publishedAt` — yaklaşık 3 slot. Durum **büyümez**, üzerine yazılır.

Büyüyen şey **arşiv node'unun geçmiş verisidir**:

| | 1.000 issuer |
|---|---|
| Günlük işlem | 24.000 |
| İşlem başına ~ | 200 bayt (girdi + makbuz + log) |
| Günlük | ~5 MB |
| Yıllık | **~1,8 GB** |

Arşiv node'u için 4 TB disk, bu hızda onlarca yıl yeter. Kalıcı **durum**
(state) ise issuer/şema/liste sayısıyla doğrusal büyür ve on binler
mertebesinde birkaç yüz MB'ı geçmez.

**Karşı olgu — neden bitmap'i zincire koymadık:** 1.000 issuer × 100.000
indeks × 2 bit = 25 MB **kalıcı durum**, üstelik her iptalde yazma. Off-chain
kararı ([[ADR-0008]]) bunu tamamen ortadan kaldırdı.

## 7.3 Yedekleme boyutu

Issuer veritabanı, status listesinin **kaynağıdır** — liste türetilmiş bir
üründür ([[SPEC-CRED-0003]] §10.3). Kaybı, listenin yeniden üretilememesi
demektir. Bu yüzden issuer DB yedeği, zincir yedeğinden **daha kritiktir**.

## 7.4 Maliyet

Maliyet tahminleri ve ticari model operatörün özel belgelerindedir (2026-09-30'da bu belgeden taşındı). Bu belgeyi
ilgilendiren teknik sonuçlar: uzun vadeli maliyet sürücüsü işlem hızı değil arşiv diskidir (§7.2); defter aşamasında
validator ve RPC düğümlerini devletler kendi işletir ([[ARCH-0001]] §3); belge veren ve doğrulayan kurumlar kendi
servislerini işletebilir (§2.3, §2.4).

# 8. Felaket Kurtarma

| Senaryo | RTO | RPO | Prosedür |
|---|---|---|---|
| Tek validator kaybı | dakikalar | 0 | Kalanlar üretmeye devam; node yeniden kurulur, senkronlanır |
| Çoğunluk validator kaybı | saatler | 0 | Zincir durur. Yedek anahtarlarla node'lar ayağa kaldırılır |
| İndeksleyici DB kaybı | saatler | 0 | **Sıfırdan yeniden oynatılır** — zincir kaynak, kayıp yok |
| Issuer DB kaybı | saatler | son yedek | En kritik. Liste yeniden üretilir; §7.3 |
| Status anahtarı kaybı | saatler | 0 | Yeni anahtar + `kid` rotasyonu; aynı liste devam eder |
| Status anahtarı sızması | saatler | 0 | Sertifika iptali → tüm token'lar düşer → yeni anahtarla yeniden yayın |
| Credential anahtarı sızması | günler | — | **Ağır.** Issuer askıya alınır, verilmiş belgeler değerlendirilir |
| `schemas.tamga.network` alan adı kaybı | — | — | **Ekosistemik.** [[SPEC-SCHEMA-0001]] §10.3 azaltmaları |

**İndeksleyicinin yeniden oynatılabilir olması** mimarinin sessiz kazancıdır:
türetilmiş bir görünüm olduğu ve QBFT'de reorg bulunmadığı için
([[ARCH-0003]] §2.2) veritabanını silip baştan kurmak güvenli ve deterministik
bir işlemdir.

---

# 9. Olay Müdahale

| Seviye | Örnek | Hedef |
|---|---|---|
| **SEV1** | Zincir durdu; credential anahtarı sızdı | 15 dk müdahale, 7/24 |
| **SEV2** | İndeksleyici bayat > 15 dk; status yayını 2 döngü kaçtı | 1 sa, mesai + nöbet |
| **SEV3** | Şema CDN 5xx; tek issuer service down | 1 iş günü |

**Zorunlu SEV1 tetikleyicisi:** İndeksleyicinin bilinmeyen implementasyon
sürümü görüp durması ([[ARCH-0003]]/CMP2). Bu bir arıza değil, **yanlış veri
üretmemek için kasıtlı durmadır** — ama derhal insan müdahalesi gerektirir.

---

# 10. Değişmezler

| # | Değişmez |
|---|---|
| **O1** | `8545` JSON-RPC hiçbir koşulda internete açılmaz (§3). |
| **O2** | Yükseltmeler önce staging'de aynı adımlarla prova edilir (§1). |
| **O3** | Credential imzalama anahtarı çevrimdışı HSM'de; status anahtarı ayrı ve çevrimiçi (§4). |
| **O4** | Doğrulama logları claim değerlerini ve `idx`'i saklamaz (§5.2, §5.3). |
| **O5** | CDN erişim logu tutulmaz veya IP'siz ve 7 günlüktür (§5.4). |
| **O6** | Issuer DB yedeği zincir yedeğinden önceliklidir (§7.3). |
| **O7** | İndeksleyici her zaman sıfırdan yeniden oynatılabilir olmalıdır (§8). |

---

# Açık Konular

1. ~~İndeksleyici işletimi~~ — **KAPANDI** ([[PM-GOV-0001]] P3): her verifier
   kendi örneği; vakıf barındırma sunmaz.
2. ~~Barındırılmış status hizmeti~~ — **KAPANDI** ([[PM-GOV-0001]] P1): sunulur,
   ama imzalama anahtarı kurumda kalır, log tutulmaz, barındırılan liste kamuya
   açıktır ve **%30 tripwire** konsey gündemi yaratır.
3. Arşiv node'u kaç yıl geriyi tutmalı? Sınırsız mı, budama (pruning) politikası
   mı? Denetim gereksinimleriyle birlikte kararlaştırılmalı.
4. HSM tedarikçisi ve FIPS/CC seviyesi seçilmedi. eIDAS QSCD uyumu Faz 1'de
   gerekli olabilir → [[RS-EIDAS-0001]] ile çapraz kontrol.
5. Çok bölgeli (multi-region) dağıtım Faz 1'de mi başlar? Türk dünyası
   coğrafyası gecikme açısından geniş.

---

# İlgili Dokümanlar

[[ARCH-0001]] · [[ARCH-0002]] · [[ARCH-0003]] · [[ARCH-0005]] ·
[[SPEC-BC-0001]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-ID-0002]] ·
[[PM-TRUST-0001]] · [[PM-GOV-0001]] · [[ADR-0007]] · [[ADR-0008]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

