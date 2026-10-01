---
document_id: SPEC-WALLET-0001
title: Tamga Wallet — Anahtar Yönetimi, Yedekleme, Onay Yüzeyi ve Batch Kullanımı
category: Specification
domain: Wallet
status: Active
review_status: Draft
version: 1.4.0
created: 2026-09-09
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: specification
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - wallet
  - key-management
  - backup
  - recovery
  - consent
  - batch
  - non-transferability
keywords:
  - non-exportable holder key
  - seed backup limitation
  - re-issuance on device change
  - sticky batch copy per verifier
  - consistent disclosure set
  - over-asking warning fatigue
  - on-device presentation log
  - bulk schema prefetch
summary: >
  Cüzdanın anahtar, depo, yedekleme ve onay tasarımını tanımlar. Merkezî bulgu
  bir GERİLİMİN çözümüdür: [[SPEC-CRED-0001]] §3 holder anahtarının güvenli
  bölgeden çıkamayacağını söylüyor, ama proje notlarındaki "24 kelime seed ile
  yedekleme" tasarımı anahtarın geri getirilebilir olmasını ima ediyordu. İkisi
  aynı anda doğru olamaz — ve seed'den türetilebilir bir holder anahtarı,
  credential'ı DEVREDİLEBİLİR kılarak holder binding açığını arka kapıdan geri
  getirir. Karar: anahtarlar seed'den türetilmez; yedek belgeleri ve manifestoyu
  taşır, cihaz değişiminde YENİDEN İHRAÇ gerekir. Ayrıca batch kopyalarının
  verifier başına yapışkan kullanımı iki açık konuyu birden kapatır.
priority: Critical
related:
  - SPEC-CRED-0001
  - SPEC-CRED-0002
  - SPEC-PROTO-0001
  - SPEC-PROTO-0002
  - SPEC-SCHEMA-0002
  - ARCH-0003
  - PM-ASSUR-0001
depends_on:
  - SPEC-CRED-0001
  - SPEC-CRED-0002
---

> **Sürüm notu 1.4.0 (2026-10-01) — silme (Apple 5.1.1(v), Google Play hesap silme, KVKK md. 7):** yeni §7.6. "Cüzdanı sıfırla ve verilerimi sil" önce Tamga'nın servislerinde siler (kimlik servisi `POST /erasure`, cüzdan sağlayıcısı `POST /units/delete`), sonra cihazdakini. Kural değişmedi.
>
> **Sürüm notu 1.3.0 (2026-10-01) — [[ADR-0031]] (D-PRIV-1):** site başına takma ad (§5.4, WL15). "Tamga ile giriş yap"ta siteye belge özeti ya da kimlik numarası gitmez; cüzdan kimlik servisinden gelen, hiçbir yere sunulmayan tohumdan her site için ayrı takma ad anahtarı türetir. Takma ad anahtarları holder anahtarı değildir (WL1 onları kapsamaz; WL15 ayrı kuraldır).

> **Sürüm notu 1.2.0 (2026-09-29) — [[ADR-0027]] (D-WALLET-2):** WL4 daraltıldı. Sunum ve olay günlüğü cihazdan yalnız kişinin başlattığı, kişinin parolasıyla şifreli (AB TS10 §5) dışa aktarmada çıkar: işlem günlüğü dosyası ya da taşıma dosyası (§7.5). Otomatik dışa aktarma, sunucuya yükleme ve sunucu yedeği yoktur (§7.1 aynen).

# Kapsam

Cüzdanın **iç** tasarımı: anahtar yönetimi, yerel depo, yedekleme ve kurtarma,
onay yüzeyi, batch kopya kullanımı, şema önbelleği.

Protokoller [[SPEC-PROTO-0001]] ve [[SPEC-PROTO-0002]]'dedir. Cüzdan
attestation'ı (WUA) kapsam dışı — Faz 1, `SPEC-WALLET-0002` (planlı).

---

# 1. Çözülen Gerilim — Anahtar Yedeklenebilir mi?

Bu bölüm dokümanın en önemli kısmıdır çünkü **iki mevcut tasarım kararı
çelişiyordu.**

## 1.1 Çelişki

[[SPEC-CRED-0001]] §3 diyor ki:

> Anahtar cihazın secure element'inde üretilir (Secure Enclave/StrongBox), asla
> dışa aktarılamaz → **credential devredilemez.**

Proje notlarındaki yedekleme tasarımı ise şunu ima ediyordu:

> 24 kelime seed + zorunlu PIN; sunucuda şifreli yedek (sunucu çözemez).

Eğer seed cüzdanı **kullanılabilir** hâlde geri getiriyorsa, holder anahtarını
da geri getiriyor demektir. Ama holder anahtarı güvenli bölgeden çıkamıyorsa,
seed onu geri getiremez.

**İkisi aynı anda doğru olamaz.**

## 1.2 Neden anahtar seed'den türetilemez

Cazip seçenek şudur: holder anahtarlarını seed'den türet, yazılımda tut, her
yerde geri getirilebilsin.

Bu seçenek **reddedilmiştir** çünkü holder binding'in tamamını çürütür:

| | Sonuç |
|---|---|
| Seed → holder anahtarı türetilebilir | Seed paylaşılabilir |
| Seed paylaşılabilir | Credential **devredilebilir** |
| Credential devredilebilir | [[SPEC-CRED-0001]] §3'teki açık geri gelir |

O dokümanın kendi ifadesiyle: "bir öğrenci belgesini arkadaşının cüzdanına
aldırır" saldırısı, ihraç anında kapatılıp **kurtarma anında** yeniden
açılmış olur. Arka kapı, ön kapıdan daha tehlikelidir çünkü kimse oraya
bakmaz.

## 1.3 Karar

**Değişmez WL1:** Holder anahtarları **seed'den türetilmez** ve cihazın güvenli
bölgesinden **asla çıkmaz.**

**Değişmez WL2:** Yedek, credential **belgelerini** ve **manifestoyu** taşır;
holder anahtarlarını taşımaz. Dolayısıyla yeni cihazda geri yüklenen bir
credential **sunulamaz** — yeniden ihraç gerekir.

Bu, kabul edilmiş bir kullanıcı deneyimi bedelidir. Alternatifi, sistemin
temel güvenlik özelliğini kaybetmektir.

## 1.3b Değerlendirilen üçüncü yol (review R10)

Karar iki seçenek arasında verilmişti; bir üçüncüsü vardır ve açıkça
reddedilmesi gerekir: **platform senkronlu anahtarlar** (iCloud Keychain /
Google Password Manager tarzı, donanım destekli ama cihazlar arası taşınabilir
anahtar sınıfları).

| | Değerlendirme |
|---|---|
| Artı | Cihaz değişiminde yeniden ihraç gerekmez; kullanıcı deneyimi en iyi |
| Eksi 1 | Güven, Tamga'dan **Apple/Google'a** kayar — anahtarın nereye gittiğini onlar belirler |
| Eksi 2 | Aynı hesaptaki başka bir cihaz anahtarı alır → "credential devredilemez" ilkesi (WL1) hesap düzeyinde delinir |
| Eksi 3 | EUDI ARF bu sınıfı W3 (sertifikalı WSCD) saymaz; Faz 1 devlet uyumu riske girer |

**Reddedildi.** Ama Faz 2'de, W2 seviyesi için isteğe bağlı bir "kolay
kurtarma" kipi olarak yeniden değerlendirilebilir — kullanıcı bilinçli olarak
düşük güvence seçiyorsa. Şu an ürün karmaşıklığına değmiyor.

## 1.4 Seed'in gerçek rolü

Seed, sanılandan **dar** bir iş yapar:

| Seed neyi kurtarır | Neyi kurtarmaz |
|---|---|
| Cüzdan kimliği (yedeğin şifre çözme anahtarı) | Holder anahtarları |
| Credential belgeleri (okunabilir, sunulamaz) | Sunum yeteneği |
| Manifest: hangi issuer'dan hangi tip | — |
| Ayarlar, dil, sunum kaydı | — |

Manifest kritiktir: yeni cihazda kullanıcıya **"şu 4 belgeyi yeniden iste"**
diye tek dokunuşluk bir liste sunar. Kurtarma acısını ortadan kaldırmaz ama
yönetilebilir kılar.

---

# 2. Anahtar Mimarisi

## 2.1 Anahtar türleri

| Anahtar | Nerede | Dışa aktarılabilir | Ömür |
|---|---|---|---|
| **Holder anahtarları** (batch başına N adet) | Secure Enclave / StrongBox | **Hayır** | Credential ömrü |
| **Yedek şifreleme anahtarı** | Seed'den türetilir | Seed olarak | Kalıcı |
| **Cüzdan örnek anahtarı** | Güvenli bölge | Hayır | Kurulum ömrü |

## 2.2 Cüzdan güvence seviyeleri

[[PM-ASSUR-0001]] Eksen A'nın cüzdan tarafındaki bileşeni:

| Seviye | Anahtar deposu | Faz |
|---|---|---|
| **W1** | Yazılım (güvenli bölge yok) | Desteklenmez |
| **W2** | Cihaz güvenli bölgesi (Secure Enclave / StrongBox) | **Faz 0 asgarisi** |
| **W3** | Sertifikalı WSCD | Faz 1 |

**Değişmez WL3:** W1 cüzdan desteklenmez. Güvenli bölgesi olmayan bir cihazda
Tamga Wallet kurulmaz — kullanıcıya açık bir uyarıyla reddedilir.

## 2.3 PIN

PIN, güvenli bölgedeki anahtara erişimin **kullanıcı doğrulaması** koşuludur;
anahtarı şifrelemez (onu donanım yapar).

| Kural | Değer |
|---|---|
| Uzunluk | En az 6 hane |
| Biyometri | PIN'in **yerine** değil, yanında (geri düşüş PIN'dir) |
| Deneme | 5 hatalı → 30 sn gecikme; 10 → cüzdan kilitlenir, seed gerekir |
| Sunum onayı | Her sunumda PIN veya biyometri **zorunlu** |

**Son satır önemlidir:** Sunum, kullanıcının bilinçli eylemi olmalıdır. Açık bir
cüzdanın arka planda sessizce sunum yapması engellenir.

---

# 3. Yerel Depo

```
┌──────────────────────────────────────┐
│ Güvenli bölge (donanım)              │
│   holder anahtarları — çıkamaz       │
├──────────────────────────────────────┤
│ Şifreli yerel veritabanı             │
│   credentials    SD-JWT dizeleri     │
│   batch_state    kopya defteri       │
│   verifier_map   yapışkan eşleme     │
│   schema_cache   Type Metadata       │
│   presentation_log  sunum geçmişi    │
│   settings                           │
└──────────────────────────────────────┘
```

**Değişmez WL4:** `presentation_log` otomatik olarak ya da bir sunucuya **hiçbir koşulda** çıkmaz; yalnız kişinin kendi başlattığı, kendi parolasıyla şifreli dışa aktarmada (AB TS10, [[ADR-0027]]) cihazdan çıkar —
yedeğe de girmez ([[SPEC-PROTO-0002]]/PV8). Yedeğe girse, cihaz değişiminde
sunucuya şifreli olarak da olsa yüklenir ve bir davranış profili
merkezîleşmiş olur.

Kullanıcı bu kaydı görebilir ve silebilir.

---

# 4. Batch Kopya Yönetimi

> Bu bölüm [[SPEC-PROTO-0001]] Açık Konu 1 ve [[SPEC-CRED-0002]] Açık Konu 3'ü
> kapatır.

## 4.1 Yapışkan kopya kuralı

**Değişmez WL5:** Bir verifier'a **her zaman aynı** batch kopyası sunulur.
Farklı verifier'lara **farklı** kopyalar sunulur.

```
verifier_map: (verifier_id, vct) → copy_index
```

Gerekçe, iki yönlü bir mantıktır:

| Yön | Neden |
|---|---|
| **Aynı verifier'a aynı kopya** | Verifier zaten kim olduğunu biliyor (başvuru isimli). Farklı kopya sunmak korelasyon kazandırmaz, yalnızca kopya harcar. |
| **Farklı verifier'a farklı kopya** | İki verifier iş birliği yaparsa `cnf` ve `idx` üzerinden eşleştirme yapamaz ([[SPEC-CRED-0003]] §9.4). |

`verifier_id`, `x509_hash` client identifier'ıdır ([[SPEC-PROTO-0002]] §2.1) —
kararlı ve doğrulanabilir bir anahtar.

## 4.2 Tutarlı disclosure seti

**Değişmez WL6:** Aynı verifier'a aynı `vct` için yapılan tekrar sunumlarda,
cüzdan **aynı disclosure setini** kullanır.

Sebep [[SPEC-SCHEMA-0002]] Güvenlik Notları'ndadır: değişen set, hangi
alanların gizlendiği hakkında bilgi verir. İlk sunumda 8 alan, ikincisinde 6
alan açıklanırsa, verifier ikisi arasındaki farkı çıkarabilir.

Verifier daha az alan isterse cüzdan **fazlasını sunmaz** — kesişim değil,
yeni isteğin kendisi geçerlidir; ama kullanıcıya "bu verifier'a daha önce şu
alanları vermiştiniz" bilgisi gösterilir.

## 4.3 Tükenme

| Kalan kopya | Cüzdan davranışı |
|---|---|
| 3 | Sessiz — ayarlarda görünür |
| 2 | Kullanıcıya bildirim: "Öğrenci belgeniz için 2 kullanım kaldı" |
| 0, **bilinen** verifier | Yapışkan eşleme sayesinde mevcut kopya kullanılır — sorun yok |
| 0, **yeni** verifier | Kullanıcıya seçim: (a) yenile, (b) mevcut bir kopyayı yeniden kullan — **korelasyon uyarısıyla** |

**Değişmez WL7:** Kullanıcı eylemi olmadan yenileme yalnızca [[ADR-0023]] AR1–AR4 koşullarında yapılır
(2026-09-29'a kadar: "otomatik yenileme yoktur", [[SPEC-SCHEMA-0002]] §2.1). Yenileme belirteci olan kurum belgeleri, kurumun
ilan ettiği eşikte, uygulama önde ve kilit açıkken, rastgele gecikmeyle yenilenir; kimlik ve iletişim belgelerinde yenileme
kullanıcı eylemidir. Kullanıcı ayarlardan kapatabilir.

## 4.4 Diploma — Faz 0

[[SPEC-PROTO-0001]] §8.5 uyarınca diploma Faz 0'da **tek kopya** verilir.
Yapışkan eşleme yine uygulanır (tek kopya her verifier'a gider) ve `idx`
korelasyonu kabul edilmiş risktir — kullanıcıya **cüzdan içinde** de
gösterilir, yalnızca pilot sözleşmesinde değil.

---

# 5. Onay Yüzeyi

## 5.1 Sunum onay ekranı

Asgari içerik, bu sırayla:

1. **Kim istiyor** — verifier adı (zincir kaydından) + kayıtlı mı işareti
2. **Ne için** — `purpose` metni ([[SPEC-API-0001]] §4.1)
3. **Ne paylaşılacak** — alan alan liste, değerleriyle
4. **Ne paylaşılmayacak** — gizli kalan alanların **adları** (değerleri değil)
5. Onayla / Reddet

Dördüncü madde alışılmadıktır ve bilinçlidir: kullanıcının seçici açıklamanın
çalıştığını **görmesi** gerekir. "Not ortalamanız paylaşılmayacak" satırı,
ürünün değerini tek bakışta anlatır.

## 5.2 Aşırı talep uyarısı

> [[SPEC-PROTO-0002]] Açık Konu 1'i kapatır.

Üç seviye, üç farklı görsel ağırlık:

| Durum | Sunum |
|---|---|
| Kayıtlı + scope içinde | Normal ekran, uyarı yok |
| Kayıtlı + **scope dışı alan var** | Scope dışı alanlar listede **ayrı bir blokta**, farklı renkte, "bu doğrulayıcı bu alanları istemeye yetkili değil" başlığıyla. Onay düğmesi **3 saniye gecikmeli** etkinleşir. |
| **Kayıtsız verifier** | Akışı kesen ayrı ekran: "Bu doğrulayıcı Tamga'da kayıtlı değil. Kim olduğunu doğrulayamıyoruz." → Devam / İptal |

**Uyarı yorgunluğu önlemi:** Uyarı yalnızca **gerçekten anormal** durumda
çıkar. Normal akışta hiçbir uyarı yoktur. Uyarıyı her sunuma koyarsak
görünmez olur.

**Değişmez WL8:** Aşırı talep uyarısı, onay düğmesinin yanındaki bir metin
değildir; ayrı bir görsel blok ve gecikmeli düğme gerektirir.

## 5.3 Tekrarlayan farklı sorgular

[[SPEC-PROTO-0002]] Güvenlik Notları: bir verifier farklı sorgular göndererek
kullanıcının hangi credential'lara sahip olduğunu haritalayabilir.

Cüzdan, aynı verifier'dan **24 saat içinde 3'ten fazla farklı sorgu** gelirse
kullanıcıyı bilgilendirir: "Bu doğrulayıcı bugün 4 farklı belge sordu."

## 5.4 Site başına takma ad ([[ADR-0031]])

"Tamga ile giriş yap" hesap anahtarı olarak belge değeri değil, **site başına takma ad** kullanır (ARF Topic 11).

| Adım | Cüzdan ne yapar |
|---|---|
| Tohum | Kimlik belgesiyle birlikte gelen `urn:tamga:id:PseudonymSeed:1` belgesini doğrular (kimlik belgesiyle aynı imzacı, kopya 0'ın anahtarı) ve tohumu güvenli depoya koyar (Keychain / Keystore; mağaza derlemesinde donanım korumalı). Tohum belge listesinde görünmez, hiçbir DCQL sorgusuna önerilmez (PS3). |
| İstek | DCQL'de `format: "tamga-pseudonym"` sorgusu (`meta.mode`: `single` / `multiple`). Belge sorgusu yoksa istek yalnız takma adla girişe (belgesiz) karşılık gelir. |
| Onay ekranı | "Bu siteye özel takma adın" kartı: yeni mi, daha önce kullanılan mı (değer gösterilmez). `multiple` sitede kullanıcı mevcut takma adlarından birini ya da yenisini seçer. Takma ad yalnız güven listesinde kayıtlı siteye verilir. |
| Türetme | PIN/biyometri onayından sonra: `k = HKDF-SHA256(tohum, "tamga-pseudonym-v1\|" + site + "\|" + sıra)` → P-256 anahtar; takma ad = açık anahtarın RFC 7638 parmak izi. Site = asıl RP'nin kayıtlı `client_id`'si (aracıda asıl RP; ADR-0017 K7). Anahtar yalnız bellekte, imzadan sonra silinir. |
| Sunum | vp_token'da takma ad sorgusunun id'siyle `tamga-pseudonym+jwt`: başlıkta açık anahtar, gövdede `aud` = client_id, `nonce`, `rp`, bu işlem için yeni WIA ve PoP. |
| Takma adlarım | Ayarlar: site adı, oluşturulma / son kullanım, kullanıcının verdiği ad (siteye gitmez), sil. Silinen sıra o sitede bir daha türetilmez; yeniden kayıt yeni sıra açar. Günlüğe yalnız site adı ve olay yazılır, takma ad değeri yazılmaz. |

Yeni telefonda kimlik yeniden doğrulanınca aynı tohum gelir → aynı takma adlar → sitelerdeki hesaplar tanınır. Taşıma dosyası
(§7.5) tohumu ve anahtarı taşımaz (LX2).

---

# 6. Şema Önbelleği

[[ARCH-0003]]/CMP8'in uygulaması.

| Kural | Değer |
|---|---|
| Ne zaman çekilir | Kurulumda ve **yeni bir tip credential alındığında** |
| Nasıl | Toplu — ilgili tüm Type Metadata + `extends` zinciri |
| Ne zaman çekilmez | **Sunum anında** |
| Geçerlilik | Süresiz — `vct#integrity` içeriği tanımlar ([[SPEC-SCHEMA-0001]] §7.1) |

**Değişmez WL9:** Cüzdan sunum anında `schemas.tamga.network`'e istek yapmaz.
Yaparsa, şema sunucusu "kim hangi tip belgeyi ne zaman kullandı" bilgisini
toplar.

Önbellekte olmayan bir tip sunulmak istenirse: kullanıcıya "bu belge tipi
henüz doğrulanamıyor, internet bağlantısı gerekiyor" denir ve **çekim
kullanıcı onayıyla** yapılır.

---

# 7. Yedekleme ve Kurtarma

## 7.1 Yedek içeriği

```
şifreli_yedek = AES-GCM(
    anahtar = HKDF(seed),
    içerik  = {
        manifest:    [{ issuer, vct, alındığı_tarih }],
        credentials: [SD-JWT dizeleri],
        settings:    { dil, bildirimler }
    }
)
```

**Yedekte olmayanlar:** holder anahtarları (WL1), `presentation_log` (WL4),
`verifier_map`.

`verifier_map` neden yok: yeni cihazda zaten yeni kopyalar alınacak, eski
eşleme anlamsız. Ayrıca hangi verifier'lara sunum yapıldığını taşır — WL4 ile
aynı gerekçe.

## 7.2 Sunucu tarafı

Yedek, Tamga barındırmalı bir depoya yüklenebilir. Sunucu **çözemez** —
anahtar seed'den türer ve seed sunucuya gitmez.

| Sunucunun gördüğü | Görmediği |
|---|---|
| Şifreli blob boyutu | İçerik |
| Yükleme zamanı | Hangi credential'lar |
| Cüzdan örnek tanımlayıcısı | Kullanıcı kimliği |

## 7.3 Cihaz değişimi akışı

```
1. Yeni cihaza kur
2. Seed gir + yeni PIN belirle
3. Yedeği indir, çöz
4. Manifest gösterilir:
     ┌──────────────────────────────────────────┐
     │ 4 belgeniz yeniden alınmalı              │
     │                                          │
     │ ☑ Diploma — İstanbul Bilgi Üniv.         │
     │ ☑ Öğrenci Belgesi — İstanbul Bilgi Üniv. │
     │ ☐ Sürücü Belgesi — (Faz 1)               │
     │                                          │
     │ [ Seçilenleri yeniden iste ]             │
     └──────────────────────────────────────────┘
5. Her biri için OID4VCI akışı (SPEC-PROTO-0001)
     → yeni holder anahtarları, yeni cnf, yeni idx
```

**Kullanıcıya açıkça söylenir:** eski belgeler görüntülenebilir ama
sunulamaz; yeniden ihraç gerekir. Bunu gizlemek, sunum anında başarısızlıkla
karşılaşmaktan kötüdür.

## 7.4 Seed kaybı

Seed **ve** cihaz kaybedilirse kurtarma yoktur. Kullanıcı her issuer'a
**yeniden başvurur** ve kimliğini kurumun kendi prosedürüyle kanıtlar
([[SPEC-PROTO-0001]] §11 — yüz yüze bağlama).

Bu bir felaket değildir: credential'lar zaten issuer'da yeniden üretilebilir
verilerdir. Kaybedilen şey **erişim**, veri değil.

**Değişmez WL10:** Tamga hiçbir koşulda kullanıcı adına kurtarma anahtarı
tutmaz. Tutsaydı, tüm cüzdanları açabilecek bir merkez oluşurdu.

## 7.5 AB TS10 taşıma dosyası (2026-09-29)

Cüzdan, AB TS10 biçiminde bir taşıma dosyası üretir (Ayarlar → Yeni telefona taşı):

- **İçerik:** `MigrationData`, yani yeniden alınacak belgelerin listesi (`listOfCredentials`: vct, kurum, kurum adresi).
  Cihaza bağlı olmayan belge yoktur.
- **Şifreleme:** kişinin parolasıyla JWE `PBES2-HS256+A128KW` + `A128GCM` (TS10 §5).
- **Paylaşım:** paylaşım menüsüyle kişinin seçtiği yere gider; Tamga'ya gitmez.
- **Yeni cüzdanda:** kişi dosyayı açar, liste "yeniden al" düğmeleriyle kurum sayfasına bağlanır (WL2).

Belge değerleri, kopyalar ve anahtarlar dosyaya girmez. İşlem günlüğü dosyaya girer ([[ADR-0027]]); içe aktarmada kişiye
günlüğün geri yüklenip yüklenmeyeceği sorulur. Günlük ayrıca tek başına şifreli dosya olarak dışa aktarılabilir (TS10 §4.1).

## 7.6 Cüzdanı sıfırla ve verilerimi sil (2026-10-01)

Ayarlar → **Cüzdanı sıfırla ve verilerimi sil** (mağaza kuralları: uygulama içinden silme; KVKK md. 7). Sıra:

1. **Kimlik servisi** — kimlik servisinden alınmış her belge için alan açmadan sunum (SD-JWT VC + KB-JWT; aud = servis,
   nonce = servisin `/nonce`'ı) → `POST {id}/erasure`. Servis belgeyi kendi imzasından ve sahipliği `cnf` anahtarından
   tanır; kaydı ve olay satırlarını siler, bütün kopyaları iptal eder, uzaktan kimlik doğrulama sağlayıcısındaki oturumu ve
   görüntüleri sildirir ([[SPEC-ID-0003]] §9.1).
2. **Cüzdan sağlayıcısı** — birim anahtarıyla imzalı `POST {wp}/units/delete`: birim iptal (WIA bitleri), sonra kayıt
   (açık anahtar, sürüm, cihaz kanıtı bilgisi) silinir ([[ADR-0025]] 1.0.1).
3. **Cihaz** — bütün belgeler ve anahtarlar, takma ad tohumu, günlük, PIN (WL1: kurtarma yok).

Ağ yoksa 3 yine yapılır; 1–2 yapılamazsa kişiye söylenir ve e-posta yolu gösterilir. Kurumların (ihraççı, doğrulayıcı) tuttuğu
veri kurumdadır; yol TS7 silme talebidir (Geçmiş → "Verilerimi silmesini iste").

---

# 8. Değişmezler

| # | Değişmez |
|---|---|
| **WL1** | Holder anahtarları seed'den türetilmez; güvenli bölgeden çıkmaz. |
| **WL2** | Yedek belgeleri ve manifestoyu taşır; anahtarları taşımaz — cihaz değişiminde yeniden ihraç gerekir. |
| **WL3** | W1 (yazılım anahtarlı) cüzdan desteklenmez. |
| **WL4** | `presentation_log` sunucuya ve otomatik olarak hiçbir koşulda çıkmaz, sunucu yedeğine girmez; yalnız kişinin başlattığı, kişinin parolasıyla şifreli dışa aktarmada (TS10) cihazdan çıkar ([[ADR-0027]]). |
| **WL5** | Bir verifier'a her zaman aynı batch kopyası; farklı verifier'a farklı kopya. |
| **WL6** | Aynı verifier + aynı `vct` için disclosure seti tutarlıdır. |
| **WL7** | Kullanıcı eylemi olmadan yenileme yalnızca [[ADR-0023]] AR1–AR4 koşullarında yapılır. |
| **WL8** | Aşırı talep uyarısı ayrı görsel blok + gecikmeli düğme gerektirir. |
| **WL9** | Sunum anında şema sunucusuna istek yapılmaz. |
| **WL10** | Tamga kullanıcı adına kurtarma anahtarı tutmaz. |
| **WL11** | Her sunum PIN veya biyometri onayı gerektirir. |
| **WL12** | Geçiş kartı jetonu (`tamga-pass+jwt`) kişisel veri taşımaz: yalnızca `iss` (opak pass_id), `aud`, `iat`, `exp` (≤ 60 s), `jti`; belge içeriği ve claim'ler QR'a girmez ([[ADR-0012]]). |
| **WL13** | Geçiş kartı yalnızca güven listesinde kayıtlı bir RP/terminal grubu için üretilir ve kayıt anında verilen rıza süreli (≤ 6 ay) ve kapsamlıdır; kullanıcı rızayı istediği an geri alır (grant silinir). WL11'in tek istisnasıdır. |
| **WL14** | Her geçiş kartı gösterimi `presentation_log`'a yazılır (WL4 kapsamında, cihazda); Göster ekranı canlı saat ve süre gösterir. |
| **WL15** | Site takma ad anahtarları holder anahtarı değildir: yalnız [[ADR-0031]] tohumundan site ve sıra başına türetilir, kalıcı saklanmaz; tohum yalnız cihazın güvenli deposunda durur, yedeğe, taşıma dosyasına ve hiçbir sunuma girmez. |

---

# Güvenlik ve Mahremiyet Notları

**Kurtarma, holder binding'in en zayıf noktasıdır.** §1.2'deki muhakeme
tekrarlanmalıdır: kolay kurtarma isteyen her tasarım önerisi, "bu, credential'ı
devredilebilir kılar mı?" sorusundan geçmelidir. Cevap evet ise reddedilir.

**Yedek boyutu bir sinyaldir.** Sunucu, blob boyutundan kaç credential
olduğunu tahmin edebilir. Azaltma: yedek sabit boyutlu bloklara doldurulur
(padding).

**Yapışkan eşleme bir liste tutar.** `verifier_map`, kullanıcının hangi
verifier'lara sunum yaptığını içerir — `presentation_log` kadar hassastır ve
aynı kurallara tabidir (cihazda kalır, yedeğe girmez).

**PIN kilitlenmesi bir DoS yüzeyidir.** Cihazı ele geçiren biri 10 kez yanlış
PIN girip cüzdanı kilitleyebilir. Kabul edilmiş risk — alternatifi kaba kuvvet
saldırısına açık bırakmak.

---

# Açık Konular

1. Yeni cihazda yeniden ihraç, issuer'ın hâlâ o kişiyi tanımasını gerektiriyor.
   Mezun 10 yıl sonra cihaz değiştirirse üniversite ne yapacak? Kurumsal
   süreç sorusu → [[PM-GTM-0001]].
2. W3 (sertifikalı WSCD) Faz 1'de nasıl tespit edilecek — cihaz attestation'ı
   mı, ayrı donanım mı? → `SPEC-WALLET-0002`
3. Yedeğin sabit boyutlu doldurulması ne kadar maliyetli? Ölçülmeli.
4. Çoklu cihaz (tablet + telefon) destekleniyor mu? Şu an hayır — her cihaz
   ayrı holder anahtarı demek, dolayısıyla her cihaz için ayrı ihraç. Batch
   bunu kısmen çözebilir ama tasarlanmadı.
5. `verifier_map` kullanıcıya gösterilmeli mi? Şeffaflık açısından evet, ama
   "hangi işverenlere başvurdunuz" listesi telefonu eline geçirene de görünür.

---

# İlgili Dokümanlar

[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-SCHEMA-0001]] ·
[[SPEC-SCHEMA-0002]] · [[SPEC-API-0001]] · [[ARCH-0003]] · [[PM-ASSUR-0001]] ·
[[PM-GOV-0001]] · [[INVARIANTS]]

---

# Durum

**Draft** — 2026-09-09. §1, [[SPEC-CRED-0001]] §3 ile proje notlarındaki seed
yedekleme tasarımı arasındaki gerilimi çözer; karar anahtarların
yedeklenmemesi yönündedir ve bu, cihaz değişiminde yeniden ihracı zorunlu
kılar. §4 iki açık konuyu kapatır. Çoklu cihaz desteği tasarlanmamıştır.
