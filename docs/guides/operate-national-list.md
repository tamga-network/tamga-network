---
document_id: GUIDE-0017
title: "Ulusal güven listesi işletmek"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Zincirsiz hâlin kurulum rehberi: bir ülkenin imzalı güven listesini işletecek bilgi işlem ekibi için anahtarlar ve kök sertifika
  (HSM notu), kayıt defteri, liste yayıncısıyla (trust-publisher) listeyi üretme, imzalama, doğrulama ve yayımlama (JSON-JWS,
  ETSI TS 119 612 XML ve TS 119 602 LoTE görünümleri), LOTL'a girme, yayın sunucusu (HTTPS, CORS, önbellek başlıkları), saatlik
  işler ve izleme, kurum ekleme döngüsü, zincir açıkken çapalama ve devir. Bugün Türkiye listesini işleten düzeni örnek alır.
---

# Ulusal güven listesi işletmek

Bu rehber, kendi ülkesinin [[t:trust-list|güven listesini]] işletecek kamu kurumunun ([[t:TLSO]], liste işletmecisi) **bilgi işlem
ekibi** içindir. Anahtarların nerede duracağını, listenin nasıl üretilip imzalanacağını, nereden ve hangi başlıklarla
yayımlanacağını ve günlük işletimin nasıl izleneceğini adım adım anlatır.

Bugün Türkiye listesini (`tl-tr.jws`) Tamga Network vekâleten işletir; bu rehber o düzeni örnek alır. İleride kendi listesini
yayımlayacak bir devlet aynı araçları ve aynı adımları kullanır.

**Ne zaman okunur:**
- Ülkeniz kendi listesini işletmeye ya da vekâleten işletilen listeyi devralmaya hazırlanırken, altyapı kurulmadan önce.
- Önce: [[GUIDE-0016]] (iki hâl: imzalı listeler ve ortak defter) ve [[GUIDE-0011]] (listenizi ağa bağlamak: LOTL kaydı, roller,
  tanıma, dış liste yolu). Bu rehber [[GUIDE-0011]]'in kurulum ve işletim tarafıdır.
- Kavramlar: [Güven listeleri](/concepts/trust-lists), [ETSI güven listesi görünümü](/concepts/etsi-trusted-list).

Bu belgede adı ya da kodu geçen devletler için yer ayrılmıştır; bu, bir anlaşma ya da görüşme bildirimi değildir.

## Genel resim

Liste işletmek, birkaç küçük parçayı düzenli çalıştırmaktır. Hiçbiri sürekli açık bir sunucu uygulaması değildir: liste
yayıncısı bir komut satırı aracıdır, yayın ise statik dosya sunmaktır.

```text
kayıt defteri (JSON kaynak)      anahtarlar (depo dışında; kök çevrimdışı)
            │                                │
            └────────── trust:build ─────────┘   listeyi üretir ve imzalar
                             │
                             ▼
                 dist/  lotl.jws · tl-<cc>.jws · anchors.jsonl · keys/ · archive/ · CHANGELOG.md
                             │                        (+ isteğe bağlı: tl-<cc>.xml, lote/*.jws)
                             ▼
              yayın sunucusu (HTTPS, statik)  ──▶  cüzdanlar ve doğrulayıcılar indirir
                             ▲
              saatlik: trust:heartbeat (çapa günlüğü satırı)   ·   izleme: tazelik, imza, erişim
```

| Parça | Ne | Nerede |
|---|---|---|
| Ulusal kök sertifika (kök CA) | Kurum sertifikalarının kökü | **Çevrimdışı**; HSM ya da kasada |
| Liste imzacısı | Listeyi ve çapa günlüğünü imzalar | Yayın makinesinde, yalnız yayıncının okuyabildiği yerde |
| Kayıt kurumu imzacısı | Kayıt sertifikalarını ([[t:registration-certificate]]) imzalar | Yayın makinesinde |
| Kayıt defteri | Kurumların, doğrulayıcıların ve kök sertifikaların kaynak kaydı (JSON) | Sürüm denetimi altında (ör. git) |
| Liste yayıncısı | `apps/trust-publisher` — açık kaynak komut satırı aracı | Yayın makinesi |
| Yayın sunucusu | Üretilen dosyaları HTTPS ile sunar | Herhangi bir web sunucusu |

::: info Terimler
- **JWS** (JSON Web Signature): JSON verisinin imzalı biçimi. Listeler `.jws` dosyasıdır; aynı içeriğin okunabilir kopyası `.json`.
- **ETSI TS 119 612**: AB'nin XML biçimindeki güven listesi standardı (XAdES imzalı). **ETSI TS 119 602** ([[t:LoTE]]): aynı
  bilginin JSON biçimindeki "varlık listesi" standardı. Tamga'da ikisi de aynı imzalı kaynağın **görünümüdür**, ayrı liste değildir.
- **HSM** (Hardware Security Module): özel anahtarı dışarı vermeden imza atan donanım.
- **Kök sabitleme** (pinning): cüzdan ve doğrulayıcının kök anahtarın parmak izini bir kez yapılandırmasına yazması.
:::

## 1. Anahtarlar ve kök sertifika

Bütün anahtarlar P-256 ve ES256'dır.

| Anahtar | Ne imzalar | Kural |
|---|---|---|
| `root-ca` | Kurum ve doğrulayıcı sertifikaları | Çevrimdışı; yalnız sertifika vermek için açılır |
| `tl-signer-1` (ve kaydırma için ikincisi) | `tl-<cc>.jws`, çapa günlüğü | En az iki kaydırmalı imzacı; değişim en az 30 gün önce duyurulur, yeni anahtar eskisiyle imzalanır (RB-OP-05) |
| `registrar-1` | Kayıt sertifikaları ve onların durum listesi | Kayıt kurumu rolünün anahtarı |
| `tl-xml-signer-1` | Yalnız ETSI XML görünümü | ETSI TS 119 612 §5.7.1 profili: konu alanında C ve O, `keyUsage` digitalSignature + nonRepudiation, CA değil, EKU `id-tsl-kp-tslSigning` ([[ADR-0066]]) |

Bugünkü Türkiye listesi tek bir liste imzacısıyla yayımlanır; ikinci imzacı kuralı (RB-OP-05) beyan edilmiş geçici bir
sapmadır.

**Gerçek anahtarlar depoya girmez.** Araçlar gerçek ağın anahtar klasörünü yalnız açıkça verildiğinde kullanır
(`TAMGA_PROD_PKI_DIR`) ve depo içindeki bir klasörü reddeder:

```sh
# eksik yaprakları (ör. XML imzacısı) üretir; kökü üretmez, var olanı ezmez, --force kabul etmez
TAMGA_PROD_PKI_DIR=<gizli klasör> npx tsx ops/gen-pki.ts --prod
```

::: warning Kök anahtar töreni bu araçların dışındadır
`gen-pki.ts --prod` klasörde kök yoksa durur: gerçek bir kök bu araçla üretilmez, çünkü kök değişirse bütün cüzdanların ve
doğrulayıcıların yeniden sabitlemesi gerekir. Ulusal kökü kendi kurallarınızla, tanıklı bir anahtar töreninde, HSM içinde
üretin; özel anahtarı çevrimdışı tutun.
:::

**HSM notu.** Bugünkü liste yayıncısı imza anahtarlarını anahtar klasöründeki PKCS#8 dosyalarından okur; araçta HSM bağlantısı
yoktur. Bu yüzden klasörü yalnız yayıncının çalıştığı hesap okuyabilmeli, erişim iki kişiyle sınırlı ve kayıtlı olmalıdır
([[ADR-0009]]). Liste imzacısını HSM'de tutmak istiyorsanız imza adımının HSM'e taşınmasını ağ işletmecisiyle birlikte
planlayın. Kurumların kendi imza anahtarları her durumda **kurumlarda** kalır; liste işletmecisi onları tutmaz (RB-OP-08,
[[ADR-0057]]).

**Kök parmak izleri.** Yayıncı her yayında `keys/root-fingerprints.json` dosyasını yazar. Aynı değerler kalıcı bir sayfada
(Tamga'da `tamga.network/trust-anchor`), çerçeve belgesinde ve sözleşme eklerinde birebir aynı yayımlanır (RB-OP-06).

## 2. Kayıt defteri

Listenin kaynağı, liste yayıncısının `registry/` klasöründeki JSON dosyalarıdır:

| Dosya | İçerik |
|---|---|
| `tl-tr.source.json` | Ulusal liste: `state_code`, `next_update_days`, `operator`, `root_cas`, `issuers`, `relying_parties`, `national_schemas` |
| `lotl.source.json` | Listelerin listesi: ülke kayıtları (`national_lists`), cüzdan sağlayıcılar, dış listeler, görünüm ayarları |
| `examples/` | Örnek başvuru dosyaları (belge veren, doğrulayıcı, dış liste) |
| `pending/` | Bekleyen başvurular |

Kurallar:

- **Elle düzenlemeyin.** Kayıt komutları (§7) her alanı başvuru kurallarıyla ([[ADR-0024]]) denetler, değişikliği `status_history`'ye
  ekler ve hiçbir satırı silmez.
- **Kişisel veri yok.** Kayıt defterinde, listede, çapa günlüğünde ve değişiklik günlüğünde kişi adı ya da kişisel veri bulunmaz;
  iletişim adresleri kurumsal rol adresleridir.
- **Sürüm denetimi.** Kaynak dosyalardaki her değişiklik sürüm denetimine işlenir; liste ise imza anahtarının bulunduğu yayın
  makinesinde imzalanır. Kayıt komutları listeyi imzalamaz.

Klasörler ortam değişkenleriyle değiştirilebilir: `TAMGA_TP_REGISTRY` (kayıt defteri), `TAMGA_TP_PKI` (anahtar klasörü),
`TAMGA_TP_DIST` (çıktı).

::: tip Araç bugün tek ülke listesine göre yazılmıştır
Liste yayıncısı bir kayıt defterinden LOTL ile **bir** ülke listesini birlikte üretir; ülke listesinin kaynak dosyasının adı
`tl-tr.source.json`'dur ve içindeki `state_code` çıktının adını belirler (`tl-<cc>.jws`). Kendi listesini işleten bir devlet aracı
kendi kopyasında kendi kayıt defteri ve anahtarlarıyla çalıştırır; ürettiği LOTL yalnız yerel denetim içindir, ağın LOTL'unu ağ
işletmecisi imzalar (§4). Dosya adlarının ve ülke kodunun uyarlanması kurulumda ağ işletmecisiyle birlikte yapılır.
:::

## 3. Listeyi üretmek, imzalamak, doğrulamak

Gereken: Node.js 22 ve Git. Önce her şeyi yerelde, geliştirme anahtarlarıyla deneyin:

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run setup     # geliştirme PKI'si → şema kataloğu → listeler → heartbeat → doğrulama (anahtarlar ops/pki/, depoya girmez)
```

Gerçek yayın makinesinde:

```sh
npm run schemas:build                                   # belge türü kataloğu (yayıncı okur)
TAMGA_TP_PKI=<gizli klasör> npm run trust:build          # listeleri üretir, imzalar, arşivler
npm run trust:verify -- --full                           # yayını yükleyiciyle doğrular (arşivle birlikte tam zincir)
```

`trust:build` her çalıştığında:

- sürümü bir artırır ve bir önceki sürümün özetini (`previous_version_hash`) yazar; sürüm geri gitmez;
- `next_update`'i `next_update_days` kadar ileri koyar (en çok 90 gün, RB-OP-03);
- eski sürümü `archive/`'e, değişikliği `CHANGELOG.md`'ye yazar;
- dosyaları atomik yazar (önce geçici dosya, sonra yeniden adlandırma): sunucu yarım yazılmış liste vermez.

Değişiklik olmasa da liste düzenli yeniden imzalanır; bir değişiklik en geç 24 saatte yayında olmalıdır (RB-OP-03).

**Üretilen dosyalar:**

| Dosya | Ne |
|---|---|
| `lotl.jws`, `lotl.json` | Listelerin listesi (imzalı + okunabilir kopya) |
| `tl-<cc>.jws`, `tl-<cc>.json` | Ulusal liste |
| `anchors.jsonl` | Saatlik imzalı [[t:anchor-log]] |
| `keys/` | Listenin andığı sertifikalar (yalnız açık sertifika) ve `root-fingerprints.json` |
| `wrprc/`, `status/wrprc/1` | Kayıt sertifikaları ve onların durum listesi (saatlik yeniden imzalanır) |
| `archive/` | Eski liste sürümleri ve çapa günlüğü arşivleri (silinmez) |
| `CHANGELOG.md` | Kim, ne zaman, ne değişti (RB-OP-07) |
| `tl-<cc>.xml`, `tl-<cc>.sha2` | ETSI TS 119 612 XML görünümü ve SHA-256 özeti (açıksa) |
| `lote/*.jws`, `lote/*.json` | ETSI TS 119 602 LoTE görünümü (açıksa) |

### Görünümler: JSON-JWS, ETSI XML, LoTE

Kaynak her zaman JSON-JWS listedir. İki ETSI görünümü aynı kaynaktan, **aynı sürüm numarasıyla** üretilir; görünüm kaynakla
çelişirse kaynak geçerlidir.

| Görünüm | Nasıl açılır | Bugün |
|---|---|---|
| ETSI TS 119 612 XML (XAdES-B-B) | `TAMGA_TL119612=1` ve `TAMGA_TL119612_SIGNER=tl-xml-signer-1` | Sandbox'ta açık; gerçek ağda posta adresleri ve üretim XML imza sertifikası gelince |
| ETSI TS 119 602 LoTE (JSON) | `lotl.source.json` içinde `"lote": { "enabled": true }` | Kapalı; adres adları ve işletmeci posta adresi onaylanınca |

```sh
TAMGA_TP_PKI=<gizli klasör> TAMGA_TL119612=1 TAMGA_TL119612_SIGNER=tl-xml-signer-1 npm run trust:build
```

Gerçek ağda XML imzacısı profile uymazsa ya da posta adresi gibi zorunlu yayın verisi eksikse yayın durur; sandbox'ta bu bir
uyarıdır. XML imzacısının parmak izi LOTL'da ülke kaydının ayrı `xml_signing_keys` alanında yayımlanır; JSON imzacısıyla
karıştırılmaz. XML listesindeki tanım adresleri: [ETSI güven listesi görünümü](/concepts/etsi-trusted-list).

## 4. LOTL'a girmek

Listeniz, Tamga LOTL'unda ülkenizin kaydı listenizi gösterdiği anda ağda geçerli olur. LOTL'u ağ işletmecisi imzalar; bu adım
onunla birlikte yapılır ([[GUIDE-0011]] §A):

1. Listenizin kalıcı HTTPS adresini belirleyin (`list_url`, ör. `https://trust.example.gov/tl-xx.jws`).
2. Liste imzacınızın **açık sertifikasını** ağ işletmecisine verin (özel anahtar hiçbir zaman verilmez); XML görünümünü
   yayımlıyorsanız XML imzacısının sertifikasını da.
3. Rolleri (`tlso`, `registrar`, `access_ca`, `national_root_ca`) ve tanıma ayarını (`recognition`) birlikte yazın.
4. Ağ işletmecisi LOTL'un yeni sürümünü yayımlar. Kaydınızı yayımlanmış `lotl.json`'da görün, sonra listenizi yükleyiciyle
   doğrulayın: imza LOTL'daki imzacıya, kurum sertifikaları listenizdeki köke zincirlenmelidir.

Devirde (vekâleten işletilen listeyi devralmak) aynı kayıtta yalnız işletmeci, adres ve imzacılar değişir; kurumların kimlikleri
(`issuer_id`, `ca_id`) ve belge türleri değişmez, verilmiş belgeler geçerli kalır (RB-OP-14, [[ADR-0035]] PO3).

## 5. Yayın sunucusu

Liste statik dosyadır; herhangi bir web sunucusu yeter. Uygulama sunucusu, veritabanı ya da oturum gerekmez.

| Konu | Kural |
|---|---|
| Taşıma | Yalnız HTTPS; HSTS açık; HTTP isteği HTTPS'e yönlenir |
| CORS | `Access-Control-Allow-Origin: *` — listeler herkese açıktır ve tarayıcıdaki doğrulayıcılar da okur |
| Önbellek | Listeler 5 dakika (`public, max-age=300`); çapa günlüğü ve durum listesi 60 saniye; `archive/` 1 gün, değişmez (`immutable`) |
| İçerik türleri | `.jws` → `application/jose`; `.json` → `application/json`; `.jsonl` → `application/x-ndjson`; `.pem` → `application/x-pem-file`; `.xml` → `application/vnd.etsi.tsl+xml`; `.sha2` → `text/plain`; `status/` → `application/statuslist+jwt` |
| Geçici dosyalar | `*.tmp` sunulmaz (yayıncının atomik yazımı) |
| Kaynak klasör | Sunucu doğrudan yayıncının çıktı klasöründen okursa saatlik çapa satırları anında yayındadır; ayrı bir kopya kullanıyorsanız her `trust:build` ve `trust:heartbeat`'ten sonra eşitleyin |

Önbellek süresi `next_update`'ten bağımsızdır: tazeliği listenin kendisi söyler, önbellek yalnız sunucu yükünü azaltır. Kısa
tutun ki bir değişiklik dakikalar içinde herkese ulaşsın.

nginx için örnek (alan adı ve klasör sizin):

```nginx
server {
    listen 443 ssl http2;
    server_name trust.example.gov;
    root /var/lib/trust-publisher/dist;

    types {
        application/jose jws;  application/json json;  application/x-ndjson jsonl;
        application/x-pem-file pem;  application/vnd.etsi.tsl+xml xml;  text/plain sha2;  text/markdown md;
    }
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Cache-Control "public, max-age=300" always;

    location ~ \.tmp$ { return 404; }
    location = /anchors.jsonl {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=60" always;
    }
    location ^~ /status/ {
        types { } default_type application/statuslist+jwt;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=60" always;
        try_files $uri =404;
    }
    location /archive/ {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=86400, immutable" always;
        try_files $uri =404;
    }
    location / { try_files $uri =404; }
}
```

nginx'te bir `location` içinde `add_header` yazılırsa üst bloktaki başlıklar o konuma geçmez; bu yüzden her konumda CORS
başlığı yeniden yazılır.

Yayından sonra başlıkları denetleyin:

```sh
curl -sI https://trust.example.gov/tl-xx.jws          # 200, application/jose, CORS, Cache-Control
curl -s  https://trust.example.gov/tl-xx.json | head  # version, next_update, previous_version_hash
```

## 6. Saatlik işler ve izleme

| İş | Ne zaman | Komut |
|---|---|---|
| Çapa günlüğü satırı | Her saat (değişiklik olmasa da, RB-OP-04) | `npm run trust:heartbeat` — ayrıca kayıt sertifikası durum listesini yeniden imzalar |
| Liste yeniden imzası | Her değişiklikte ve düzenli olarak (`next_update` yaklaşmadan) | `npm run trust:build` + `npm run trust:verify` |
| Çapa günlüğü arşivi | Kendiliğinden (500 satırda; `TAMGA_ANCHORS_MAX_LINES`), elle de olur | `npm run trust:archive` |

Saatlik işi bir zamanlayıcıya bağlayın. systemd için örnek:

```ini
# trust-heartbeat.service
[Service]
Type=oneshot
User=trust-publisher
WorkingDirectory=/opt/tamga-network
Environment=TAMGA_TP_PKI=<gizli klasör>
ExecStart=/usr/bin/npm run -s trust:heartbeat
NoNewPrivileges=true

# trust-heartbeat.timer
[Timer]
OnCalendar=hourly
Persistent=true
RandomizedDelaySec=60
[Install]
WantedBy=timers.target
```

**İzleyin** (birkaç dakikada bir; uyarı e-posta ya da kendi izleme sisteminize):

- **Liste tazeliği:** `next_update` 12 saatten yakınsa uyarı. Tarih geçerse doğrulayıcılar `INDETERMINATE` döner.
- **Çapa günlüğü:** son satır 2 saatten eskiyse saatlik iş durmuş demektir.
- **Kayıt sertifikası durum listesi:** geçerlilik süresinin yarısından azı kaldıysa uyarı.
- **Erişim:** her dosya 200 dönüyor, içerik türü ve CORS başlığı doğru; TLS sertifikasının bitişine 14 günden az kaldıysa uyarı.
- **İmza:** her `trust:build`'den sonra `trust:verify`; hata verirse yayını durdurun, eski liste `next_update`'e kadar geçerli
  kalır.

Liste yayıncısı tek bir arıza noktasıdır: durursa doğrulama önbellekteki listeyle `next_update`'e kadar sürer, sonra
`INDETERMINATE` olur. Bu yüzden yazılı bir işletim kılavuzu ve iki kişilik erişim zorunludur ([[ADR-0009]]).

## 7. Kurum ekleme döngüsü

Kurumlar ve doğrulayıcılar başvurularını kendi taraflarında katılım aracıyla hazırlar ([[GUIDE-0014]]); kayıt kurumu olarak siz
denetler, sertifika verir ve listeye yazarsınız.

```text
kurum: tamga-onboard init / keys  →  başvuru dosyası + sertifika isteği (CSR)
siz:   CSR'dan sertifika  →  trust:register  →  trust:authorize  →  trust:build  →  trust:verify  →  yayın
kurum: tamga-onboard check --listing  →  listedeki kaydını denetler
```

```sh
# 1. Kurum sertifikası (kök imzalı; kurumun anahtarı kurumda kalır, yalnız CSR gelir)
TAMGA_CONFIRM_PROD=<kurum kısa adı> TAMGA_PROD_PKI_DIR=<gizli klasör> \
  npx tsx ops/pki-issue.ts --prod --name issuer-<kurum kısa adı> --csr <istek.csr.pem> --org-id VATTR-<vergi no>

# 2. Kayıt ve yetkiler
npm run trust:register -- issuer <başvuru.json>     # eksik alanların hepsini tek seferde bildirir
npm run trust:authorize -- <slug> <vct>            # belge türü yetkisi (--revoke ile bitirir)
npm run trust:register -- rp <başvuru.json>         # doğrulayıcı
npm run trust:scope -- <dns_name> <kullanım.json>  # doğrulayıcıya yeni kullanım

# 3. Durum değişiklikleri (kayıt silinmez)
npm run trust:status -- <slug> SUSPENDED --reason <gerekçe>
npx tsx apps/trust-publisher/src/cli.ts rp-status <dns_name> <durum>
npm run trust:list                                 # kayıtlı kurumlar ve doğrulayıcılar

# 4. Yayın
TAMGA_TP_PKI=<gizli klasör> npm run trust:build && npm run trust:verify
```

`TAMGA_CONFIRM_PROD` bilinçli bir kapıdır: gerçek kök ancak değer imzalanacak sertifikanın kurum adına uyduğunda imzalar.
Başvuru biçimleri ve zorunlu kayıt verileri: [[GUIDE-0007]] (belge veren), [[GUIDE-0008]] (doğrulayıcı). Kurumun kendi tarafındaki
adımlar: [[GUIDE-0014]].

Bir kurum geri çekilirken kaydı silinmez; durumu değişir. Hiç geçerli olmaması gereken bir kayıt
`--invalidates-from valid_from` ile çekilir: o kurumun verdiği hiçbir belge doğrulanmaz.

## 8. Zincir açıkken

Zincir bugün üretimde kapalıdır; bu bölüm o gün için yazılmıştır ([[GUIDE-0016]]). Liste yine kaynaktır ve yukarıdaki her adım
aynen sürer. Eklenen iş, her yayından sonra listenin ve çapa günlüğünün **özetini** zincirdeki liste çapası kaydına yazmaktır:

```sh
npm run trust:chain-submit -- --dry-run   # planı basar, yazmaz (bayrak kapalıyken hiçbir bağlantı kurulmaz)
npm run trust:chain-submit                 # dist/ setini doğrular, yalnız özetleri yazar
npm run trust:chain-check -- dist/tl-xx.jws   # liste özetiniz zincirde onaylı mı: YES / NO / UNKNOWN
```

| Ortam değişkeni | Ne |
|---|---|
| `TAMGA_CHAIN_ENABLED` | Varsayılan `0`: zincire bağlanılmaz, hiçbir şey yazılmaz |
| `TAMGA_CHAIN_RPC_URL` | Kendi tam düğümünüzün RPC adresi |
| `TAMGA_CHAIN_ANCHOR_REGISTRY` | Liste çapası kaydının adresi |
| `TAMGA_CHAIN_ANCHORER_KEY` | Yalnız yazma yetkili yazıcı anahtarı |

- Sağlıksız bir set (imza ya da sürüm zinciri bozuk) çapalanmaz.
- Aynı sürüm aynı özetle ikinci kez yazılmaz (`SKIP`); onaylı bir sürüm için farklı özet `CONFLICT` verir, yazılmaz ve komut
  hata koduyla biter: bakmanız gereken bir durumdur.
- Bir çapa ancak eşik kadar bağımsız yazıcı aynı özeti gönderince onaylıdır; üretimde eşik en az 2'dir.
- Zinciri açmadan önce (2026-11-05): listeyi okuyan bütün tüketicilerin (doğrulayıcılar, cüzdanlar, belge veren servisleri)
  yükleyicisi en az `@tamga-network/trust` **0.8.1** olmalıdır. Bayrak açıkken çapa günlüğüne yeni satır türleri
  (`registration_status`, `list_view`) yazılır; daha eski yükleyici bilinmeyen satır türünde durur ([[SPEC-TRUST-0001]] §5).

Devletinizin validator düğümü ve zincirin yanındaki işler: [[GUIDE-0015]]. Test ağının adım adım kurulumu:
[[GUIDE-0018]].

## Sorun giderme

| Belirti | Neden | Ne yapılır |
|---|---|---|
| Doğrulayıcılar `INDETERMINATE` alıyor | `next_update` geçmiş ya da liste indirilemiyor | `trust:build` + yayın; sunucu ve TLS'i denetleyin |
| `trust:verify` imza hatası | Yanlış anahtar klasörü ya da LOTL'daki imzacı ile eşleşmeyen sertifika | `TAMGA_TP_PKI`'yi ve LOTL kaydındaki parmak izini denetleyin |
| `trust:build` XML adımında duruyor | XML imzacısı profile uymuyor ya da posta adresi eksik | `tl-xml-signer-1` profilini ve kayıttaki adresleri tamamlayın ya da XML'i kapalı tutun |
| Tarayıcıdaki doğrulayıcı listeyi okuyamıyor | CORS başlığı yok | Her `location`'da `Access-Control-Allow-Origin: *` |
| Çapa günlüğü 2 saattir yeni satır almadı | Zamanlayıcı durmuş | Zamanlayıcının günlüğüne bakın; `trust:heartbeat`'i elle çalıştırın |

## Kurallar

| Kod | Ne der |
|---|---|
| RB-OP-02 | Sürümler monoton artar ve önceki özeti taşır; satır silinmez |
| RB-OP-03 | `next_update` en çok 90 gün; değişiklik en geç 24 saatte yayında |
| RB-OP-04 | Çapa günlüğü saatlik imzalanır; satır silinmez |
| RB-OP-05 | En az iki kaydırmalı imzacı; değişim 30 gün önce duyurulur |
| RB-OP-06 | Kök parmak izleri her yerde aynı değerlerle yayımlanır |
| RB-OP-08 | İşletmeci kurumların imza anahtarlarını tutmaz |
| RB-OP-14 | Devirde yalnız işletmeci değişir; `ca_id`, `issuer_id`, `vct` değişmez |
| [[SPEC-TRUST-0001]] TL11 | Liste, çapa günlüğü ve değişiklik günlüğü kişisel veri, belge ya da belge özeti taşımaz |
| [[ADR-0051]] CH5 | Zincir bayrağı kapalıyken zincire bağlanılmaz; üretimde ikinci bağımsız işletmeci ve eşik ≥ 2 olmadan açılmaz |

Liste işletmecisinin bütün kuralları: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/tr/rulebook).
