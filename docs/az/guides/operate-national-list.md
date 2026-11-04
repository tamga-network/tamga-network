---
document_id: GUIDE-0017
title: "Milli etibar siyahısının idarə edilməsi"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Zəncirsiz rejimin quraşdırma bələdçisi: ölkənin imzalanmış etibar siyahısını idarə edəcək İT komandası üçün açarlar və kök
  sertifikat (HSM qeydi), qeyd reyestri, siyahı nəşriyyatçısı (trust-publisher) ilə siyahının yaradılması, imzalanması,
  yoxlanılması və dərci (JSON-JWS, ETSI TS 119 612 XML və TS 119 602 LoTE görünüşləri), LOTL-a daxil olma, nəşr serveri (HTTPS,
  CORS, keş başlıqları), saatlıq işlər və monitorinq, qurum əlavə etmə dövrü, zəncir açıq olduqda lövbərləmə və təhvil. Bu gün
  Türkiyə siyahısını idarə edən quruluşu nümunə götürür.
translation_of: GUIDE-0017
source_version: "1.0.0"
---

# Milli etibar siyahısının idarə edilməsi

Bu bələdçi öz ölkəsinin [[t:trust-list|etibar siyahısını]] idarə edəcək dövlət qurumunun ([[t:TLSO]], siyahı operatoru) **İT
komandası** üçündür. Açarların harada saxlanacağını, siyahının necə yaradılıb imzalanacağını, haradan və hansı başlıqlarla dərc
ediləcəyini və gündəlik istismarın necə izləniləcəyini addım-addım izah edir.

Bu gün Türkiyə siyahısını (`tl-tr.jws`) Tamga Network vəkalətən idarə edir; bu bələdçi həmin quruluşu nümunə götürür. Gələcəkdə öz
siyahısını dərc edəcək dövlət eyni alətlərdən və eyni addımlardan istifadə edir.

**Nə vaxt oxunur:**
- Ölkəniz öz siyahısını idarə etməyə və ya vəkalətən idarə olunan siyahını təhvil almağa hazırlaşarkən, infrastruktur qurulmazdan
  əvvəl.
- Əvvəl: [[GUIDE-0016]] (iki rejim: imzalanmış siyahılar və ortaq reyestr) və [[GUIDE-0011]] (siyahınızı şəbəkəyə qoşmaq: LOTL
  qeydi, rollar, tanınma, xarici siyahı yolu). Bu bələdçi [[GUIDE-0011]]-in quraşdırma və istismar tərəfidir.
- Anlayışlar: [Etibar siyahıları](/concepts/trust-lists), [ETSI etibar siyahısı görünüşü](/concepts/etsi-trusted-list).

Bu sənəddə adı və ya kodu çəkilən dövlətlər üçün yer ayrılıb; bu, razılaşma və ya danışıqlar barədə bildiriş deyil.

## Ümumi mənzərə

Siyahını idarə etmək bir neçə kiçik hissəni müntəzəm işlətmək deməkdir. Onların heç biri daim açıq tətbiq serveri deyil: siyahı
nəşriyyatçısı komanda sətri alətidir, nəşr isə statik fayl təqdim etməkdir.

```text
qeyd reyestri (JSON mənbə)       açarlar (repozitoriyadan kənarda; kök oflayn)
            │                                │
            └────────── trust:build ─────────┘   siyahını yaradır və imzalayır
                             │
                             ▼
                 dist/  lotl.jws · tl-<cc>.jws · anchors.jsonl · keys/ · archive/ · CHANGELOG.md
                             │                        (+ istəyə bağlı: tl-<cc>.xml, lote/*.jws)
                             ▼
              nəşr serveri (HTTPS, statik)  ──▶  rəqəmsal cüzdanlar və yoxlayan tərəflər endirir
                             ▲
              saatlıq: trust:heartbeat (lövbər jurnalı sətri)   ·   monitorinq: təzəlik, imza, əlçatanlıq
```

| Hissə | Nə | Harada |
|---|---|---|
| Milli kök sertifikat (kök CA) | Qurum sertifikatlarının kökü | **Oflayn**; HSM-də və ya seyfdə |
| Siyahı imzalayanı | Siyahını və lövbər jurnalını imzalayır | Nəşr maşınında, yalnız nəşriyyatçının oxuya bildiyi yerdə |
| Qeydiyyat orqanının imzalayanı | Qeydiyyat sertifikatlarını ([[t:registration-certificate]]) imzalayır | Nəşr maşınında |
| Qeyd reyestri | Qurumların, yoxlayan tərəflərin və kök sertifikatların mənbə qeydi (JSON) | Versiya nəzarəti altında (məs. git) |
| Siyahı nəşriyyatçısı | `apps/trust-publisher` — açıq mənbəli komanda sətri aləti | Nəşr maşını |
| Nəşr serveri | Yaradılan faylları HTTPS ilə təqdim edir | İstənilən veb-server |

::: info Terminlər
- **JWS** (JSON Web Signature): JSON məlumatının imzalanmış forması. Siyahılar `.jws` fayllarıdır; eyni məzmunun oxunaqlı nüsxəsi `.json`.
- **ETSI TS 119 612**: Aİ-nin XML formatında etibar siyahısı standartı (XAdES imzalı). **ETSI TS 119 602** ([[t:LoTE]]): eyni
  məlumatın JSON formatında "subyektlər siyahısı" standartı. Tamga-da hər ikisi eyni imzalanmış mənbənin **görünüşüdür**, ayrıca
  siyahı deyil.
- **HSM** (Hardware Security Module): şəxsi açarı xaricə vermədən imza atan avadanlıq.
- **Kökün sabitlənməsi** (pinning): rəqəmsal cüzdanın və yoxlayan tərəfin kök açarın barmaq izini bir dəfə konfiqurasiyasına yazması.
:::

## 1. Açarlar və kök sertifikat

Bütün açarlar P-256 və ES256-dır.

| Açar | Nəyi imzalayır | Qayda |
|---|---|---|
| `root-ca` | Qurum və yoxlayan tərəf sertifikatları | Oflayn; yalnız sertifikat vermək üçün açılır |
| `tl-signer-1` (və növbələmə üçün ikincisi) | `tl-<cc>.jws`, lövbər jurnalı | Ən azı iki növbəli imzalayan; dəyişiklik ən azı 30 gün əvvəl elan olunur, yeni açar köhnəsi ilə imzalanır (RB-OP-05) |
| `registrar-1` | Qeydiyyat sertifikatları və onların status siyahısı | Qeydiyyat orqanı rolunun açarı |
| `tl-xml-signer-1` | Yalnız ETSI XML görünüşü | ETSI TS 119 612 §5.7.1 profili: subyektdə C və O, `keyUsage` digitalSignature + nonRepudiation, CA deyil, EKU `id-tsl-kp-tslSigning` ([[ADR-0066]]) |

Bugünkü Türkiyə siyahısı tək siyahı imzalayanı ilə dərc olunur; iki imzalayan qaydası (RB-OP-05) bəyan edilmiş müvəqqəti
kənarlaşmadır.

**Real açarlar repozitoriyaya düşmür.** Alətlər real şəbəkənin açar qovluğunu yalnız açıq şəkildə verildikdə istifadə edir
(`TAMGA_PROD_PKI_DIR`) və repozitoriya daxilindəki qovluğu rədd edir:

```sh
# çatışmayan yarpaqları (məs. XML imzalayanını) yaradır; kökü yaratmır, mövcudu üzərinə yazmır, --force qəbul etmir
TAMGA_PROD_PKI_DIR=<gizli qovluq> npx tsx ops/gen-pki.ts --prod
```

::: warning Kök açar mərasimi bu alətlərdən kənardadır
`gen-pki.ts --prod` qovluqda kök yoxdursa dayanır: real kök bu alətlə yaradılmır, çünki kök dəyişsə bütün rəqəmsal cüzdanlar və
yoxlayan tərəflər yenidən sabitləməlidir. Milli kökü öz qaydalarınızla, şahidli açar mərasimində, HSM daxilində yaradın; şəxsi
açarı oflayn saxlayın.
:::

**HSM qeydi.** Bugünkü siyahı nəşriyyatçısı imza açarlarını açar qovluğundakı PKCS#8 fayllarından oxuyur; alətdə HSM inteqrasiyası
yoxdur. Buna görə qovluğu yalnız nəşriyyatçının işlədiyi hesab oxuya bilməli, giriş iki nəfərlə məhdudlaşdırılmalı və qeydə
alınmalıdır ([[ADR-0009]]). Siyahı imzalayanını HSM-də saxlamaq istəyirsinizsə, imza addımının HSM-ə köçürülməsini şəbəkə
operatoru ilə birlikdə planlaşdırın. Qurumların öz imza açarları hər halda **qurumlarda** qalır; siyahı operatoru onları saxlamır
(RB-OP-08, [[ADR-0057]]).

**Kök barmaq izləri.** Nəşriyyatçı hər nəşrdə `keys/root-fingerprints.json` faylını yazır. Eyni dəyərlər daimi səhifədə (Tamga-da
`tamga.network/trust-anchor`), çərçivə sənədində və müqavilə əlavələrində tam eyni şəkildə dərc olunur (RB-OP-06).

## 2. Qeyd reyestri

Siyahının mənbəyi siyahı nəşriyyatçısının `registry/` qovluğundakı JSON fayllarıdır:

| Fayl | Məzmun |
|---|---|
| `tl-tr.source.json` | Milli siyahı: `state_code`, `next_update_days`, `operator`, `root_cas`, `issuers`, `relying_parties`, `national_schemas` |
| `lotl.source.json` | Siyahılar siyahısı: ölkə qeydləri (`national_lists`), cüzdan provayderləri, xarici siyahılar, görünüş parametrləri |
| `examples/` | Nümunə müraciət faylları (sənədi verən qurum, yoxlayan tərəf, xarici siyahı) |
| `pending/` | Gözləyən müraciətlər |

Qaydalar:

- **Əl ilə redaktə etməyin.** Reyestr komandaları (§7) hər sahəni qeydiyyat qaydaları ilə ([[ADR-0024]]) yoxlayır, dəyişikliyi
  `status_history`-yə əlavə edir və heç bir sətri silmir.
- **Şəxsi məlumat yoxdur.** Qeyd reyestrində, siyahıda, lövbər jurnalında və dəyişiklik jurnalında şəxs adı və ya şəxsi məlumat
  olmur; əlaqə ünvanları qurumun rol ünvanlarıdır.
- **Versiya nəzarəti.** Mənbə fayllardakı hər dəyişiklik versiya nəzarətinə yazılır; siyahı isə imza açarının olduğu nəşr
  maşınında imzalanır. Reyestr komandaları siyahını imzalamır.

Qovluqlar mühit dəyişənləri ilə dəyişdirilə bilər: `TAMGA_TP_REGISTRY` (reyestr), `TAMGA_TP_PKI` (açar qovluğu), `TAMGA_TP_DIST`
(çıxış).

::: tip Alət bu gün tək ölkə siyahısı üçün yazılıb
Siyahı nəşriyyatçısı bir reyestrdən LOTL ilə birlikdə **bir** ölkə siyahısı yaradır; ölkə siyahısının mənbə faylının adı
`tl-tr.source.json`-dur və içindəki `state_code` çıxışın adını müəyyən edir (`tl-<cc>.jws`). Öz siyahısını idarə edən dövlət aləti
öz nüsxəsində öz reyestri və açarları ilə işlədir; yaratdığı LOTL yalnız yerli yoxlama üçündür, şəbəkənin LOTL-unu şəbəkə operatoru
imzalayır (§4). Fayl adlarının və ölkə kodunun uyğunlaşdırılması quraşdırmada şəbəkə operatoru ilə birlikdə edilir.
:::

## 3. Siyahının yaradılması, imzalanması, yoxlanılması

Lazımdır: Node.js 22 və Git. Əvvəlcə hər şeyi yerli olaraq, inkişaf açarları ilə sınayın:

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run setup     # inkişaf PKI-si → sxem kataloqu → siyahılar → heartbeat → yoxlama (açarlar ops/pki/, repozitoriyaya düşmür)
```

Real nəşr maşınında:

```sh
npm run schemas:build                                   # sənəd növləri kataloqu (nəşriyyatçı oxuyur)
TAMGA_TP_PKI=<gizli qovluq> npm run trust:build          # siyahıları yaradır, imzalayır, arxivləşdirir
npm run trust:verify -- --full                           # nəşri yükləyici ilə yoxlayır (arxivlə birlikdə tam zəncir)
```

`trust:build` hər dəfə işlədikdə:

- versiyanı bir artırır və əvvəlki versiyanın həşini (`previous_version_hash`) yazır; versiya geri getmir;
- `next_update`-i `next_update_days` qədər irəli qoyur (ən çox 90 gün, RB-OP-03);
- köhnə versiyanı `archive/`-ə, dəyişikliyi `CHANGELOG.md`-yə yazır;
- faylları atomik yazır (əvvəlcə müvəqqəti fayl, sonra adın dəyişdirilməsi): server yarımçıq yazılmış siyahı vermir.

Dəyişiklik olmasa da siyahı müntəzəm yenidən imzalanır; dəyişiklik ən gec 24 saat ərzində dərc olunmalıdır (RB-OP-03).

**Yaradılan fayllar:**

| Fayl | Nə |
|---|---|
| `lotl.jws`, `lotl.json` | Siyahılar siyahısı (imzalı + oxunaqlı nüsxə) |
| `tl-<cc>.jws`, `tl-<cc>.json` | Milli siyahı |
| `anchors.jsonl` | Saatlıq imzalanan [[t:anchor-log]] |
| `keys/` | Siyahının istinad etdiyi sertifikatlar (yalnız açıq sertifikat) və `root-fingerprints.json` |
| `wrprc/`, `status/wrprc/1` | Qeydiyyat sertifikatları və onların status siyahısı (saatlıq yenidən imzalanır) |
| `archive/` | Köhnə siyahı versiyaları və lövbər jurnalı arxivləri (silinmir) |
| `CHANGELOG.md` | Kim, nə vaxt, nəyi dəyişdi (RB-OP-07) |
| `tl-<cc>.xml`, `tl-<cc>.sha2` | ETSI TS 119 612 XML görünüşü və SHA-256 həşi (açıqdırsa) |
| `lote/*.jws`, `lote/*.json` | ETSI TS 119 602 LoTE görünüşü (açıqdırsa) |

### Görünüşlər: JSON-JWS, ETSI XML, LoTE

Mənbə həmişə JSON-JWS siyahıdır. Hər iki ETSI görünüşü eyni mənbədən, **eyni versiya nömrəsi ilə** yaradılır; görünüş mənbə ilə
ziddiyyət təşkil edərsə mənbə üstündür.

| Görünüş | Necə açılır | Bu gün |
|---|---|---|
| ETSI TS 119 612 XML (XAdES-B-B) | `TAMGA_TL119612=1` və `TAMGA_TL119612_SIGNER=tl-xml-signer-1` | Sandbox-da açıq; real şəbəkədə poçt ünvanları və istehsal XML imza sertifikatı gəldikdə |
| ETSI TS 119 602 LoTE (JSON) | `lotl.source.json`-da `"lote": { "enabled": true }` | Söndürülüb; URI adları və operatorun poçt ünvanı təsdiqləndikdə |

```sh
TAMGA_TP_PKI=<gizli qovluq> TAMGA_TL119612=1 TAMGA_TL119612_SIGNER=tl-xml-signer-1 npm run trust:build
```

Real şəbəkədə XML imzalayanı profilə uyğun gəlmirsə və ya poçt ünvanı kimi məcburi nəşr məlumatı çatışmırsa nəşr dayanır;
sandbox-da bu xəbərdarlıqdır. XML imzalayanının barmaq izi LOTL-da ölkə qeydinin ayrıca `xml_signing_keys` sahəsində dərc olunur;
JSON imzalayanı ilə qarışdırılmır. XML siyahısındakı tərif ünvanları: [ETSI etibar siyahısı görünüşü](/concepts/etsi-trusted-list).

## 4. LOTL-a daxil olma

Siyahınız Tamga LOTL-unda ölkənizin qeydi ona işarə etdiyi andan şəbəkədə etibarlı olur. LOTL-u şəbəkə operatoru imzalayır; bu
addım onunla birlikdə atılır ([[GUIDE-0011]] §A):

1. Siyahınızın daimi HTTPS ünvanını müəyyən edin (`list_url`, məs. `https://trust.example.gov/tl-xx.jws`).
2. Siyahı imzalayanınızın **açıq sertifikatını** şəbəkə operatoruna verin (şəxsi açar heç vaxt verilmir); XML görünüşünü dərc
   edirsinizsə, XML imzalayanının sertifikatını da.
3. Rolları (`tlso`, `registrar`, `access_ca`, `national_root_ca`) və tanınma parametrini (`recognition`) birlikdə yazın.
4. Şəbəkə operatoru LOTL-un yeni versiyasını dərc edir. Qeydinizi dərc olunmuş `lotl.json`-da tapın, sonra siyahınızı yükləyici
   ilə yoxlayın: imza LOTL-dakı imzalayana, qurum sertifikatları isə siyahınızdakı kökə zəncirlənməlidir.

Təhvildə (vəkalətən idarə olunan siyahını təhvil almaq) eyni qeyddə yalnız operator, ünvan və imzalayanlar dəyişir; qurumların
identifikatorları (`issuer_id`, `ca_id`) və sənəd növləri dəyişmir, verilmiş sənədlər etibarlı qalır (RB-OP-14, [[ADR-0035]] PO3).

## 5. Nəşr serveri

Siyahı statik fayllardır; istənilən veb-server kifayətdir. Tətbiq serveri, verilənlər bazası və ya sessiya lazım deyil.

| Mövzu | Qayda |
|---|---|
| Nəqliyyat | Yalnız HTTPS; HSTS açıq; HTTP sorğusu HTTPS-ə yönləndirilir |
| CORS | `Access-Control-Allow-Origin: *` — siyahılar hamıya açıqdır və brauzerdəki yoxlayan tərəflər də oxuyur |
| Keş | Siyahılar 5 dəqiqə (`public, max-age=300`); lövbər jurnalı və status siyahısı 60 saniyə; `archive/` 1 gün, dəyişməz (`immutable`) |
| Məzmun növləri | `.jws` → `application/jose`; `.json` → `application/json`; `.jsonl` → `application/x-ndjson`; `.pem` → `application/x-pem-file`; `.xml` → `application/vnd.etsi.tsl+xml`; `.sha2` → `text/plain`; `status/` → `application/statuslist+jwt` |
| Müvəqqəti fayllar | `*.tmp` təqdim edilmir (nəşriyyatçının atomik yazısı) |
| Mənbə qovluq | Server birbaşa nəşriyyatçının çıxış qovluğundan oxuyursa saatlıq lövbər sətirləri dərhal yayımdadır; ayrıca nüsxə istifadə edirsinizsə hər `trust:build` və `trust:heartbeat`-dən sonra sinxronlaşdırın |

Keş müddəti `next_update`-dən asılı deyil: təzəliyi siyahının özü bildirir, keş yalnız server yükünü azaldır. Onu qısa saxlayın ki,
dəyişiklik dəqiqələr ərzində hamıya çatsın.

nginx üçün nümunə (domen və qovluq sizindir):

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

nginx-də `location` daxilində `add_header` yazılarsa, üst blokdakı başlıqlar həmin yerə keçmir; buna görə CORS başlığı hər
`location`-da yenidən yazılır.

Nəşrdən sonra başlıqları yoxlayın:

```sh
curl -sI https://trust.example.gov/tl-xx.jws          # 200, application/jose, CORS, Cache-Control
curl -s  https://trust.example.gov/tl-xx.json | head  # version, next_update, previous_version_hash
```

## 6. Saatlıq işlər və monitorinq

| İş | Nə vaxt | Komanda |
|---|---|---|
| Lövbər jurnalı sətri | Hər saat (dəyişiklik olmasa da, RB-OP-04) | `npm run trust:heartbeat` — həmçinin qeydiyyat sertifikatlarının status siyahısını yenidən imzalayır |
| Siyahının yenidən imzalanması | Hər dəyişiklikdə və müntəzəm olaraq (`next_update` yaxınlaşmazdan əvvəl) | `npm run trust:build` + `npm run trust:verify` |
| Lövbər jurnalı arxivi | Avtomatik (500 sətirdə; `TAMGA_ANCHORS_MAX_LINES`), əl ilə də mümkündür | `npm run trust:archive` |

Saatlıq işi taymerə bağlayın. systemd üçün nümunə:

```ini
# trust-heartbeat.service
[Service]
Type=oneshot
User=trust-publisher
WorkingDirectory=/opt/tamga-network
Environment=TAMGA_TP_PKI=<gizli qovluq>
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

**İzləyin** (bir neçə dəqiqədən bir; xəbərdarlıq e-poçtla və ya öz monitorinq sisteminizə):

- **Siyahının təzəliyi:** `next_update` 12 saatdan yaxındırsa xəbərdarlıq. Tarix keçərsə yoxlayan tərəflər `INDETERMINATE` qaytarır.
- **Lövbər jurnalı:** son sətir 2 saatdan köhnədirsə, saatlıq iş dayanıb.
- **Qeydiyyat sertifikatlarının status siyahısı:** etibarlılıq müddətinin yarısından azı qalıbsa xəbərdarlıq.
- **Əlçatanlıq:** hər fayl 200 qaytarır, məzmun növü və CORS başlığı düzgündür; TLS sertifikatının bitməsinə 14 gündən az qalıbsa
  xəbərdarlıq.
- **İmza:** hər `trust:build`-dən sonra `trust:verify`; xəta verərsə nəşri dayandırın, köhnə siyahı `next_update`-ə qədər etibarlı
  qalır.

Siyahı nəşriyyatçısı tək nasazlıq nöqtəsidir: dayanarsa yoxlama keşdəki siyahı ilə `next_update`-ə qədər davam edir, sonra
`INDETERMINATE` olur. Buna görə yazılı istismar təlimatı və iki nəfərlik giriş məcburidir ([[ADR-0009]]).

## 7. Qurum əlavə etmə dövrü

Qurumlar və yoxlayan tərəflər müraciətlərini öz tərəflərində qoşulma aləti ilə hazırlayır ([[GUIDE-0014]]); qeydiyyat orqanı kimi
siz yoxlayır, sertifikat verir və siyahıya yazırsınız.

```text
qurum: tamga-onboard init / keys  →  müraciət faylı + sertifikat sorğusu (CSR)
siz:   CSR-dan sertifikat  →  trust:register  →  trust:authorize  →  trust:build  →  trust:verify  →  nəşr
qurum: tamga-onboard check --listing  →  siyahıdakı qeydini yoxlayır
```

```sh
# 1. Qurum sertifikatı (kök imzalı; qurumun açarı qurumda qalır, yalnız CSR gəlir)
TAMGA_CONFIRM_PROD=<qurumun qısa adı> TAMGA_PROD_PKI_DIR=<gizli qovluq> \
  npx tsx ops/pki-issue.ts --prod --name issuer-<qurumun qısa adı> --csr <sorğu.csr.pem> --org-id VATTR-<vergi nömrəsi>

# 2. Qeydiyyat və səlahiyyətlər
npm run trust:register -- issuer <müraciət.json>    # çatışmayan bütün sahələri bir dəfəyə bildirir
npm run trust:authorize -- <slug> <vct>            # sənəd növü səlahiyyəti (--revoke ilə bitirir)
npm run trust:register -- rp <müraciət.json>        # yoxlayan tərəf
npm run trust:scope -- <dns_name> <istifadə.json>  # yoxlayan tərəfə yeni istifadə

# 3. Vəziyyət dəyişiklikləri (qeyd silinmir)
npm run trust:status -- <slug> SUSPENDED --reason <səbəb>
npx tsx apps/trust-publisher/src/cli.ts rp-status <dns_name> <vəziyyət>
npm run trust:list                                 # qeydiyyatdakı qurumlar və yoxlayan tərəflər

# 4. Nəşr
TAMGA_TP_PKI=<gizli qovluq> npm run trust:build && npm run trust:verify
```

`TAMGA_CONFIRM_PROD` şüurlu bir qapıdır: real kök yalnız dəyər imzalanacaq sertifikatın qurumuna uyğun gəldikdə imzalayır. Müraciət
formatları və məcburi qeydiyyat məlumatları: [[GUIDE-0007]] (sənədi verən qurum), [[GUIDE-0008]] (yoxlayan tərəf). Qurumun öz
tərəfindəki addımlar: [[GUIDE-0014]].

Qurum geri çəkilərkən qeydi silinmir; vəziyyəti dəyişir. Heç vaxt etibarlı olmamalı olan qeyd `--invalidates-from valid_from` ilə
geri çəkilir: həmin qurumun verdiyi heç bir sənəd yoxlamadan keçmir.

## 8. Zəncir açıq olduqda

Zəncir bu gün istehsalda söndürülüb; bu bölmə həmin gün üçün yazılıb ([[GUIDE-0016]]). Siyahı yenə mənbədir və yuxarıdakı hər addım
olduğu kimi qalır. Əlavə olunan iş hər nəşrdən sonra siyahının və lövbər jurnalının **həşini** zəncirdəki siyahı lövbəri reyestrinə
yazmaqdır:

```sh
npm run trust:chain-submit -- --dry-run   # planı çap edir, yazmır (bayraq söndürülü olduqda heç bir bağlantı qurulmur)
npm run trust:chain-submit                 # dist/ dəstini yoxlayır, yalnız həşləri yazır
npm run trust:chain-check -- dist/tl-xx.jws   # siyahınızın həşi zəncirdə təsdiqlənibmi: YES / NO / UNKNOWN
```

| Mühit dəyişəni | Nə |
|---|---|
| `TAMGA_CHAIN_ENABLED` | Standart `0`: zəncirə qoşulmur, heç nə yazılmır |
| `TAMGA_CHAIN_RPC_URL` | Öz tam qovşağınızın RPC ünvanı |
| `TAMGA_CHAIN_ANCHOR_REGISTRY` | Siyahı lövbəri reyestrinin ünvanı |
| `TAMGA_CHAIN_ANCHORER_KEY` | Yalnız yazma səlahiyyəti olan yazıcı açarı |

- Sağlam olmayan dəst (imza və ya versiya zənciri pozulub) lövbərlənmir.
- Eyni versiya eyni həşlə ikinci dəfə yazılmır (`SKIP`); təsdiqlənmiş versiya üçün fərqli həş `CONFLICT` verir, yazılmır və komanda
  xəta kodu ilə bitir: baxmalı olduğunuz vəziyyətdir.
- Lövbər yalnız hədd sayda müstəqil yazıcı eyni həşi göndərdikdə təsdiqlənir; istehsalda hədd ən azı 2-dir.

Dövlətinizin validator qovşağı və zəncirin yanındakı işlər: [[GUIDE-0015]]. Test şəbəkəsinin addım-addım quraşdırılması:
`guides/chain-testnet.md`.

## Problemlərin həlli

| Əlamət | Səbəb | Nə etməli |
|---|---|---|
| Yoxlayan tərəflər `INDETERMINATE` alır | `next_update` keçib və ya siyahı endirilə bilmir | `trust:build` + nəşr; serveri və TLS-i yoxlayın |
| `trust:verify` imza xətası | Səhv açar qovluğu və ya LOTL-dakı imzalayanla uyğun gəlməyən sertifikat | `TAMGA_TP_PKI`-ni və LOTL qeydindəki barmaq izini yoxlayın |
| `trust:build` XML addımında dayanır | XML imzalayanı profilə uyğun deyil və ya poçt ünvanı çatışmır | `tl-xml-signer-1` profilini və qeyddəki ünvanları tamamlayın və ya XML-i söndürülü saxlayın |
| Brauzerdəki yoxlayan tərəf siyahını oxuya bilmir | CORS başlığı yoxdur | Hər `location`-da `Access-Control-Allow-Origin: *` |
| Lövbər jurnalı 2 saatdır yeni sətir almayıb | Taymer dayanıb | Taymerin jurnalına baxın; `trust:heartbeat`-i əl ilə işlədin |

## Qaydalar

| Kod | Nə deyir |
|---|---|
| RB-OP-02 | Versiyalar monoton artır və əvvəlki həşi daşıyır; sətir silinmir |
| RB-OP-03 | `next_update` ən çox 90 gün; dəyişiklik ən gec 24 saat ərzində dərc olunur |
| RB-OP-04 | Lövbər jurnalı saatlıq imzalanır; sətir silinmir |
| RB-OP-05 | Ən azı iki növbəli imzalayan; dəyişiklik 30 gün əvvəl elan olunur |
| RB-OP-06 | Kök barmaq izləri hər yerdə eyni dəyərlərlə dərc olunur |
| RB-OP-08 | Operator qurumların imza açarlarını saxlamır |
| RB-OP-14 | Təhvildə yalnız operator dəyişir; `ca_id`, `issuer_id`, `vct` dəyişmir |
| [[SPEC-TRUST-0001]] TL11 | Siyahı, lövbər jurnalı və dəyişiklik jurnalı şəxsi məlumat, sənəd və ya sənəd həşi daşımır |
| [[ADR-0051]] CH5 | Zəncir bayrağı söndürülü olduqda zəncirə qoşulmur; istehsalda ikinci müstəqil operator və hədd ≥ 2 olmadan açılmır |

Siyahı operatorunun bütün qaydaları: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/az/rulebook).
