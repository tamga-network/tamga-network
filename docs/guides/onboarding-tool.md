---
document_id: GUIDE-0014
title: "Katılım aracı: bilgi işlem ekibi için"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Belge veren ya da doğrulayıcı kurumun bilgi işlem ekibi için tamga-onboard aracıyla katılım, adım adım: sandbox denemesi,
  başvuru dosyası (init), kayıt kurallarıyla denetim (validate), anahtarlar ve sertifika istekleri (keys; HSM ve bulut eşitleme
  uyarısı), başvurunun gönderilmesi, sertifikaların yerleştirilmesi, kurulum (.well-known, sorgu ucu) ve denetimi (check), güven
  listesindeki görünüm (check --listing), Kurum Konsolu daveti ve ilk belge; aracı yapay zekâ asistanına MCP ile bağlama ve
  güvenlik sınırları; sorun giderme.
---

# Katılım aracı: bilgi işlem ekibi için

Bu rehber, Tamga Network'e **belge veren** (üniversite, meslek kuruluşu, kamu kurumu) ya da **doğrulayıcı** (otel, işveren,
web sitesi) olarak katılacak bir kurumun bilgi işlem ekibi içindir. Katılımın kendi tarafınızdaki bütün teknik işini
`tamga-onboard` komutuyla yaparsınız: başvuru dosyası, anahtarlar, sertifika istekleri, kurulum denetimi ve katıldıktan sonra
güven listesindeki görünümünüz.

**Ne zaman okunur:**
- Kurumunuz katılmaya karar verdikten sonra, başvuruyu hazırlarken.
- Önce: [[GUIDE-0007]] (belge veren kurumun katılımı: süreç, kontrol listesi, roller) ya da [[GUIDE-0008]] (doğrulayıcı kaydı).
  Bu rehber o süreçlerin bilgi işlem tarafındaki **uygulamasıdır**.
- Sonra: [[GUIDE-0003]] (belgeyi teknik olarak vermek) ya da [[GUIDE-0002]] (sunucuda doğrulamak).

## Araç ne yapar, ne yapmaz?

| Yapar | Yapmaz |
|---|---|
| Başvuru dosyalarını yazar ve kayıt kurallarıyla denetler ([[ADR-0024]]) | Ağa yazmaz, [[t:trust-list]] içeriğini değiştirmez; kaydı kayıt kurumu yapar |
| İki imza anahtarınızı **sizin bilgisayarınızda** üretir, sertifika isteklerini (CSR) yazar | Özel anahtarı hiçbir yere göndermez; çıktısı yalnız yerel dosyalardır |
| Alan adınızı, DNS teyidini, https adreslerini, meta verinizi ve sorgu ucunuzu denetler | Kişi bilgisi sormaz, dosyalara yazmaz (imza yetkilisinin adı bile) |
| Katıldıktan sonra imzalı listedeki kaydınızı pakete gömülü kök pinlerine karşı doğrular | Ağdan okuduğu hiçbir şeyi çalıştırmaz |

Aynı işlemler yerel bir **MCP sunucusu** olarak da sunulur; kurumunuzun kendi yapay zekâ asistanı adımları sizin adınıza
yürütebilir (§ MCP ile kullanım).

Devlet ya da işletmeci olarak ortak defterde düğüm çalıştıracaksanız aynı araçtaki `tamga-onboard node init|declare|check`
komutlarını ve MCP araçlarını [[GUIDE-0015]] (düğüm işletme el kitabı) anlatır.

## Kurulum

Gereken: Node.js 22 ya da sonrası. `openssl` gerekmez.

```sh
npm install -g @tamga-network/onboard     # ya da: npx -p @tamga-network/onboard tamga-onboard --help
```

Paket npm'de 0.8.3 deneme sürümüyle yayımlanır (kararlı 1.0.0 hazır olunca gelir — deneme sürümünde komutlar ve
seçenekler değişebilir). İlk sürüm elle ve kaynak kanıtı (provenance) olmadan yayımlandı; sonraki sürümler GitHub Actions'tan
gelir ve kaynak kanıtı taşır.

::: tip Kaynak koddan çalıştırma (isteğe bağlı)
Deponun bir kopyasında araç derleme adımı olmadan da çalışır: `npm install`, sonra `tamga-onboard` yerine
`npx tsx packages/onboard/src/cli.ts`.
:::

Çıkış kodları: `0` sorun yok · `1` bir denetim ya da doğrulama kaldı · `2` kullanım hatası. `--json` raporu JSON olarak basar.

## Adım adım

| # | Adım | Komut | Kim |
|---|---|---|---|
| 0 | Sandbox'ta deneyin | `tamga-onboard sandbox` | bilgi işlem |
| 1 | Başvuru dosyası | `tamga-onboard init` | bilgi işlem (hukuk ve öğrenci işlerinden bilgiyle) |
| 2 | Denetim | `tamga-onboard validate <klasör>` | bilgi işlem |
| 3 | Anahtarlar ve CSR | `tamga-onboard keys <klasör>` ya da `keys --inspect` | bilgi işlem / güvenlik |
| 4 | Kurulum denetimi ve rapor | `tamga-onboard check <klasör> --report rapor.json` | bilgi işlem |
| 5 | Başvuruyu gönderme | e-posta | kurumun yetkilisi |
| 6 | Sertifikalar gelir | dosyaları `keys/` klasörüne koyun | bilgi işlem |
| 7 | Kurulum | `.well-known`, sorgu ucu → `tamga-onboard check` | bilgi işlem |
| 8 | Listedeki görünüm | `tamga-onboard check <klasör> --listing` | bilgi işlem |
| 9 | Kurum Konsolu ve ilk belge | davet bağlantısı + passkey | kurumun yöneticisi |

### 0. Sandbox'ta deneyin

```sh
tamga-onboard sandbox
```

Komut, sandbox'ta "Kurumunu dene" sayfasının adresini (`https://sandbox.tamga.network/institutions/new`) ve adımları basar.
Test kurumunu tarayıcıda açarsınız: uydurma bir ad (gerçek kurum adları ve "Üniversitesi", "Bakanlığı" gibi resmî sözcükler kabul
edilmez), tek kullanımlık Konsol daveti, yalnız uydurma kayıtlar, belge verme, doğrulama ve iptal. Sandbox için başvuru dosyası,
anahtar ya da CSR gerekmez; her şey her gece silinir ([[GUIDE-0013]]). Test kurumunun kısa adıyla (`t-…`) listedeki görünümü de
deneyebilirsiniz:

```sh
tamga-onboard check --listing-only --env sandbox --slug t-xxxxxxxxxx
```

### 1. Başvuru dosyası: `init`

```sh
tamga-onboard init                         # sorular → tamga-onboarding/<kısa ad>/
tamga-onboard init --from yanitlar.json    # aynı bilgiler bir dosyadan
```

Araç [[GUIDE-0007]] §2'deki kontrol listesinin bilgilerini sorar: rol, kalıcı kısa ad (`slug`), resmî ad, kurum kimlik numarası
(VKN ya da MERSİS), posta adresi, destek adresi ve kurumsal e-posta, alan adı, belge türleri, servis biçimi, sorgu ucunun adresi,
programların ISCED-F kodları. Yanıt dosyası örneği:

```json
{
  "role": "issuer",
  "slug": "example-college",
  "legal_name": "Example College",
  "identifier": { "scheme": "TR-VKN", "value": "TR1234567890" },
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "country": "TR" },
  "contact": { "support_uri": "https://example.edu.tr/support", "email": "info@example.edu.tr" },
  "domain": "example.edu.tr",
  "vcts": ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  "hosting": "hosted",
  "identity_matching": { "privacy_policy_uri": "https://example.edu.tr/privacy/tamga" },
  "lookup_url": "https://sis.example.edu.tr/tamga/lookup",
  "isced_f_codes": ["0613"]
}
```

| Alan | Not |
|---|---|
| `hosting: "hosted"` | Tamga'nın barındırılan belge verme servisi (`issuer.tamga.network/<slug>`). Araç ayrıca kimlik eşleştirme kaydının başvurusunu (`<slug>.rp.json`) yazar; o kaydın anahtarını servis tutar, sertifikasını kayıt kurumu üretir |
| `hosting: "own"` | Kendi belge verme servisiniz: `issuer_url` ve `status_list_base` (ikisi de https) gerekir |
| `role: "verifier"` | Doğrulayıcı: `dns_name`, `service_description`, `is_public_sector_body` ve her kullanım için amaç, belge türü, **en az alan** ve gizlilik politikası (`scopes`) |
| `contact.email` | Kurumsal bir görev adresi; kişisel adres yazmayın |

Çıktı klasörü `tamga-onboarding/<slug>/`: `onboarding.json` (aracın profili) ve başvuru dosyaları (`<slug>.issuer.json`,
gerekiyorsa `<slug>.rp.json`). Bilinmeyen alan reddedilir; böylece kişi adı gibi bir bilgi dosyaya kazara giremez. `slug`
kamuya açık, kalıcı addır; kayıt kurumuyla birlikte kesinleşir ve bir kez kullanılan ad yeniden verilmez.

### 2. Denetim: `validate`

```sh
tamga-onboard validate tamga-onboarding/example-college
```

Başvuruyu, yanıt dosyasını ya da klasörün tamamını kayıt kurumunun kullandığı kurallarla denetler: zorunlu kayıt verisi
([[ADR-0024]]), kimlik numarasının biçimi ve sağlaması, https adresleri, 4 haneli ISCED-F kodları. Eksiklerin tamamı bir kerede
listelenir. `PUB` (kamu kurumu belgesi) sınıfı için araç uyarı verir: bu sınıf kayıt kurumuyla ayrıca görüşülür.

### 3. Anahtarlar ve sertifika istekleri: `keys`

Belge veren kurumun iki anahtarı vardır (belge ve [[t:status-list|iptal listesi]]), doğrulayıcının bir ([[t:access-certificate|erişim
sertifikası]]); hepsi P-256 / ES256.

| Anahtar adı | İmzaladığı |
|---|---|
| `issuer-<slug>` | verdiğiniz belgeler |
| `issuer-<slug>-status` | iptal listeniz |
| `rp-<ad>` | doğrulayıcı olarak gönderdiğiniz istekler |

**Önerilen yol: HSM ya da uzaktan imza hizmeti.** Gerçek ağda anahtarların kurumunuzun HSM'inde ya da sözleşme yaptığınız güven
hizmeti sağlayıcısında üretilmesi tercih edilir. Barındırılan servisi kullanıyorsanız bu zorunludur: servis her imzayı uzaktan
imza arayüzüyle (Cloud Signature Consortium API v2) ister ve yalnız imzalanacak verinin özetini gönderir; kurum anahtarı
servisin sunucusunda dosya olarak tutulmaz ([[ADR-0057]]). HSM'in ürettiği CSR'ı başvurunuza karşı denetleyin:

```sh
tamga-onboard keys --inspect issuer.csr.pem tamga-onboarding/example-college
```

Denetim, CSR'ın konusunda resmî adınızın, ülkenizin ve kurum kimlik numaranızın (`organizationIdentifier`: `VATTR-<VKN>` ya da
`NTRTR-<MERSİS>`) bulunduğunu ve imzanın geçerli olduğunu gösterir ([[ADR-0050]]).

**Yazılım anahtarı (kendi servisiniz ya da deneme).** Araç anahtarları bu bilgisayarda üretebilir:

```sh
read -rs TAMGA_KEY_PASS && export TAMGA_KEY_PASS   # en az 12 karakter; ekrana ve kabuk geçmişine yazılmaz
tamga-onboard keys tamga-onboarding/example-college --passphrase-env TAMGA_KEY_PASS
```

- Çıktı: `keys/<ad>.key.pem` (yalnız sahibine okunur izinle, parolayla şifreli) ve `keys/<ad>.csr.pem`. Var olan dosyanın üzerine
  yazmaz; dosyalardan biri bile varsa hiçbirini yazmaz.
- Parola komut satırına yazılmaz, yalnız bir ortam değişkeninin **adı** verilir. Windows'ta parolasız üretim yalnız açıkça
  `--no-passphrase` ile olur.
- Yazılım anahtarını yedekleyin (şifreli, çevrimdışı) ve yalnız gereken kişilerin erişebileceği bir yerde tutun. Anahtarı
  kaybederseniz sertifika yenilenir; ele geçirildiğini düşünüyorsanız hemen kayıt kurumuna bildirin.

::: danger Bulut eşitleme klasörü
Araç, OneDrive, Dropbox, Google Drive ya da iCloud ile eşitlenen bir klasöre özel anahtar yazmayı reddeder: anahtar kurum
dışındaki bir sunucuya kopyalanırdı. Windows'ta "Belgeler" ve "Masaüstü" çoğu zaman OneDrive'a eşitlenir; katılım klasörünü
eşitlenmeyen bir yere (ör. `C:\tamga-onboarding`) taşıyın. `--allow-synced` yalnız bilerek ve eşitlemeyi o klasör için
kapattıktan sonra kullanılır.
:::

### 4. Kurulum denetimi ve rapor: `check`

```sh
tamga-onboard check tamga-onboarding/example-college --report rapor.json
```

Başvuru dosyalarını, her anahtarın CSR'ıyla eşleştiğini, alan adınızın çözüldüğünü, kayıttaki adreslerin (destek, gizlilik
politikası) açıldığını ve varsa sorgu ucunuzu denetler. Rapor bir geçti/kaldı tablosudur; her kalan satırın yanında düzeltmesi
yazar. Bu aşamada bazı satırların kalması ya da atlanması beklenir: DNS teyidi (değer henüz yok), sertifikalar (henüz yok),
meta veri (servis henüz kurulmadı).

Araç yalnız https ile okur, yönlendirmeleri tek tek izler, yerel ve özel ağ adreslerine bağlanmaz (yerel deneme için
`--allow-http`, `--allow-private`). Sorgu ucunu yalnız **reddedilmesi gereken** isteklerle yoklar; gerçek ya da uydurma hiçbir
kayıt istenmez.

### 5. Başvuruyu gönderme

Başvuruyu kurumunuzun kurumsal e-posta adresinden, kurumunuzun yetkilisi **partners@tamga.network** adresine gönderir. Ekler:

| Gönderin | Asla göndermeyin |
|---|---|
| `<slug>.issuer.json`, varsa `<slug>.rp.json` | `keys/*.key.pem` (özel anahtarlar) |
| `keys/*.csr.pem` (ya da HSM'in ürettiği CSR'lar) | parola, HSM erişim bilgisi, uzaktan imza hizmetinin sırrı |
| `rapor.json` | kişi verisi, öğrenci kaydı |

Seviyenize göre gereken belgeler (tüzel kişilik kanıtı, imzalı katılım sözleşmesi, KVKK ekleri) [[GUIDE-0007]] §2'dedir.
Kayıt kurumu eksiklerin tamamını bir kerede bildirir. Alan adı sahipliği için size tek kullanımlık bir değer verir; onu alan
adınızın DNS'ine TXT kaydı olarak ekleyin ve denetleyin:

```sh
tamga-onboard check tamga-onboarding/example-college --dns-txt <verilen değer>
```

Barındırılan servisi kullanıyorsanız uzaktan imza hizmetinizin adresini ve servise verdiğiniz istemci kimliğini kayıt kurumuyla
ayrı ve güvenli bir kanaldan paylaşırsınız; sır e-postayla gönderilmez.

### 6. Sertifikalar gelir

Kayıt kurumu CSR'larınızın imzasını doğrular ve sertifikalarınızı verir (2 yıl, en çok 3). Her sertifikayı anahtarının adıyla
`keys/<ad>.cert.pem` olarak katılım klasörüne koyun ve yeniden denetleyin:

```sh
tamga-onboard check tamga-onboarding/example-college
```

Araç sertifikanın sizin özel anahtarınıza ait olduğunu, konusunda kurum kimlik numaranızın bulunduğunu, geçerlilik tarihlerini ve
erişim sertifikasında alan adınızı denetler. Uyuşmazlık varsa sertifika yanlış CSR'dan verilmiş olabilir: kayıt kurumuyla görüşün.

### 7. Kurulum: meta veri ve sorgu ucu

**Barındırılan servis.** Servis sizin adınıza belge verir; kurmanız gereken tek uç **sorgu ucunuzdur**. Tamga kişi kaydı tutmaz;
belge verildiği anda sisteminize imzalı bir istekle sorar, tek kaydı alır ve saklamaz ([[ADR-0020]], sözleşme:
[Kurum sorgu ucu](/api/institution-source)). En kısa yol açık kaynak örnek uçtur (depoda `examples/05-institution-source`,
[[GUIDE-0004]] §5). Uç:
- dışarıdan https ile açık olmalı (barındırılan servis bu adrese bağlanır);
- imzasız ya da geçersiz isteği `400`/`401` ile reddetmeli, hiçbir zaman `2xx` dönmemeli;
- yalnız belge türünün gerektirdiği alanları döndürmeli; T.C. kimlik numarası hiçbir zaman döndürülmez;
- her kayıtta 4 haneli ISCED-F kodu bulundurmalı; kod yoksa belge verilmez.

**Kendi servisiniz.** Belge verme servisiniz [[t:OpenID4VCI]] meta verisini RFC 8414 adres kuralıyla yayınlamalıdır: alan adı
ile yolun arasına `.well-known/<tür>` girer.

| Meta veri | Adres (örnek `issuer_url` = `https://example.edu.tr/issuer`) |
|---|---|
| Belge veren | `https://example.edu.tr/.well-known/openid-credential-issuer/issuer` |
| Yetkilendirme sunucusu | `https://example.edu.tr/.well-known/oauth-authorization-server/issuer` |

İmzalı meta veri belge anahtarınızla imzalanır ve `x5c`'de kayıt kurumunun verdiği sertifikayı taşır. İptal listesi
`status_list_base` altında yayınlanır. Adımlar: [[GUIDE-0003]], [[SPEC-PROTO-0001]].

Kurduktan sonra yeniden `tamga-onboard check` çalıştırın; meta veri (`M1`–`M3`) ve sorgu ucu (`Q1`) satırları geçmelidir.

### 8. Listedeki görünüm: `check --listing`

Kayıt kurumu kaydı yapıp listeyi yeniden imzaladıktan sonra değişiklik en geç **24 saat** içinde `trust.tamga.network`'te
yayındadır. Denetleyin:

```sh
tamga-onboard check tamga-onboarding/example-college --listing
```

Araç imzalı listeyi indirir, pakete gömülü kök pinlerine karşı doğrular ve kaydınızı denetler: listede ve `ACTIVE` misiniz, kayıt
veriniz eksiksiz mi, belge türü yetkileriniz, üst sertifika makamı, iptal listenizin yayını ve çapası, [[t:registration-certificate|kayıt
sertifikalarınız]] (imzaları listedeki kayıt kurumu anahtarlarına karşı), kimlik eşleştirme ya da doğrulayıcı kaydınız, varsa
servis meta veriniz ve **imzalı meta verinizin sertifika zincirinin listedeki köke** bağlandığı.

- Pin değişirse paket güncellenir. Arada `tamga.network/trust-anchor` adresinden **bant dışı** doğruladığınız bir değerle
  `--pin <hex>` verilebilir; rapor bunu uyarı satırıyla gösterir.
- Katılım klasörü olmadan da çalışır: `tamga-onboard check --listing-only --env production --slug <slug>`.
- Yeni kurumun ilk dakikalarında iptal listesi satırı uyarı verebilir: liste ilk kez yayınlanıp çapalanana kadar (bir yayın
  aralığı) beklenen durumdur.

### 9. Kurum Konsolu ve ilk belge

Kayıttan sonra kayıt kurumu, kurumunuzun ilk yöneticisine tek kullanımlık bir davet bağlantısı gönderir (72 saat geçerli).
Yönetici bağlantıyı açar ve cihazında bir [[t:passkey]] oluşturur; parola yoktur. Ardından Konsol'dan diğer personeli davet
eder ve gerekiyorsa API anahtarı üretir ([[ADR-0016]]).

İlk belgeyi kendi personelinize verin: Kurum Konsolu → **Belge ver** → kişi belgeyi cüzdanına alır → `verify.tamga.network`'te
gösterir → Konsol'dan iptal edip bir sonraki yayından sonra reddedildiğini görün. Ayrıntı: [[GUIDE-0007]] §7–§8. İlk belgeler,
iptal listesi ilk kez yayınlanana kadar "şu an doğrulanamadı" (`INDETERMINATE`) alabilir; birkaç dakika sonra yeniden deneyin.

Doğrulayıcı kurumda bu adımın karşılığı entegrasyondur: kayıt sertifikanızı her isteğe ekleyip ([[GUIDE-0002]] adım 4) önce
sandbox doğrulayıcısıyla, sonra gerçek ağda kendi personelinizle deneyin.

## MCP ile kullanım

Aynı işlemler yerel bir MCP sunucusu (stdio) olarak sunulur. Kurumunuzun kullandığı, MCP destekleyen bir yapay zekâ asistanına
bağlayın; asistan adımları sizin onayınızla yürütür. İlk yayından sonra:

```json
{ "mcpServers": { "tamga-onboard": { "command": "npx", "args": ["-y", "-p", "@tamga-network/onboard", "tamga-onboard", "mcp", "--root", "C:\\tamga-onboarding"] } } }
```

Kaynak koddan (deponun bir kopyasında): `"command": "npx", "args": ["tsx", "<depo>/packages/onboard/src/cli.ts", "mcp", "--root", "<klasör>"]`.

| Araç | Komut karşılığı |
|---|---|
| `create_application` | `init --from` |
| `validate_application` | `validate` |
| `generate_keys_and_csr` | `keys` |
| `check_installation` | `check` |
| `check_listing` | `check --listing` / `--listing-only` |
| `sandbox_info` | `sandbox` |

**Güvenlik sınırları** (sunucunun kendisinde zorlanır):
- Dosya erişimi yalnız kök klasörde (`--root`, varsayılan çalışma klasörü); sembolik bağlar ve bağlantı noktaları çözüldükten
  sonra da.
- Özel anahtarın içeriği hiçbir yanıtta yoktur; yalnız dosya yolu ve açık anahtar özeti döner.
- Parola yalnız `TAMGA_` ile başlayan bir ortam değişkeninin adıyla verilir; parolanın kendisi asistana yazılmaz.
- Kök pinleri değiştirilemez; yerel ağ adresleri okunmaz; kurumun alan adı dışındaki istek adresleri işaretlenir.
- Ağdan okunan metin sonuçta "güvenilmeyen veri" olarak işaretlenir; asistan onu talimat olarak almamalıdır.

Asistanınıza yine de şunları vermeyin: özel anahtar dosyası, HSM ya da uzaktan imza hizmetinin erişim bilgisi, kişi verisi.
Kurumunuzun yapay zekâ kullanım kuralları ve veri işleme sözleşmeleri bu araç için de geçerlidir.

## Sorun giderme

| Belirti | Neden | Çözüm |
|---|---|---|
| `keys`: "bulut eşitleme klasöründe" | Klasör OneDrive, Dropbox, Google Drive ya da iCloud ile eşitleniyor | Katılım klasörünü eşitlenmeyen bir yere taşıyın |
| `keys`: "Windows'ta özel anahtar parolasız üretilmez" | Parola verilmedi | `--passphrase-env <DEĞİŞKEN>` (en az 12 karakter) |
| `keys`: dosya var, hiçbir şey yazılmadı | Daha önce üretilmiş anahtar | Bilerek yeniden üretiyorsanız eski dosyaları güvenle arşivleyin; araç üzerine yazmaz |
| `validate`: kimlik numarası geçersiz | VKN biçimi ya da sağlaması | VKN `TR` + 10 hane; MERSİS `TR` + 16 hane |
| `validate`: ISCED-F | Kod 4 hane değil ya da yok | Programın ISCED-F 2013 kodu; tahmini kod yazmayın |
| `check` N2 kaldı | DNS TXT değeri henüz yayılmadı ya da yanlış ada eklendi | Kayıt alan adının kendisinde mi; yayılma saatler sürebilir |
| `check` K2 kaldı: "sertifika bu özel anahtarın değil" | Sertifika başka bir CSR'dan verildi | Kayıt kurumuyla görüşün; doğru CSR'ı yeniden gönderin |
| `check` M1 `404` | Meta veri adresi RFC 8414 kuralına uymuyor | `/.well-known/openid-credential-issuer/<yol>` |
| `check` Q1 kaldı: "imzasız isteğe 2xx" | Sorgu ucu isteği denetlemiyor | Örnek 05'teki denetimler: imza, çağıran, `aud`, süre, `jti` |
| `check` Q1 uyarı: `404`/`405` | Adres sorgu ucunun kendisi değil | `lookup_url`'yi düzeltin |
| `check --listing` L1 kaldı | Kayıt henüz yayında değil | 24 saat bekleyin; sonra kayıt kurumuna yazın |
| `check --listing` sertifika köke bağlı değil | Deneme sertifikası ya da yanlış ortam | `--env production` / `sandbox` doğru mu |
| İlk belge `INDETERMINATE` | İptal listesi henüz ilk kez yayınlanmadı | Birkaç dakika sonra yeniden deneyin |

Genel doğrulama sorunları: [[GUIDE-0012]]. Güvenlik açığı bildirimi: `security@tamga.network`.

## Kurallar

| Kod | Ne der |
|---|---|
| [[ADR-0024]] | Kayıt verisi eksiksiz olmadan kayıt yapılmaz |
| [[ADR-0050]] | Kurum sertifikası kurum kimlik numarasını, resmî adı ve ülkeyi taşır |
| [[ADR-0057]] | Barındırılan serviste kurum anahtarı kurumda kalır; imza uzaktan imza arayüzüyle |
| [[ADR-0020]] | Tamga kişi kaydı tutmaz; bilgi yetkili kaynaktan okunur |
| [[SPEC-ID-0002]] | Belgeler yalnız kayıtlı sertifikayla imzalanır; sertifika yenileme ve anahtar değişimi |

Paket ayrıntısı: [@tamga-network/onboard](/packages/onboard). Katılım şartları: [Tamga ARF — Trust Framework](https://arf.tamga.network/tr/trust-framework).
