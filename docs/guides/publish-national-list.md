---
document_id: GUIDE-0011
title: "Ulusal güven listesi yayınlamak"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Bir devletin ya da yetkili kurumunun kendi güven listesini Tamga Network'e bağlaması: iki yol (Tamga biçiminde ulusal liste
  ya da ETSI biçiminde dış liste), LOTL'daki kayıt, roller, imza anahtarları, kapsam, tanıma, devir ve yayın kuralları.
---

# Ulusal güven listesi yayınlamak

Bu rehber, kendi ülkesinin [[t:trust-list|güven listesini]] işletecek kamu kurumları (liste işletmecisi, [[t:TLSO]]) ve onların
teknik ekipleri içindir.

**Ne zaman okunur:**
- Bir ülke Tamga Network'e katılırken ya da Tamga'nın vekâleten işlettiği listeyi devralırken.
- Ülkeniz listesini zaten ETSI biçiminde yayınlıyorsa ve Tamga cüzdan ve doğrulayıcılarının onu tanımasını istiyorsanız.
- Önce: [Güven listeleri](/concepts/trust-lists) ve [Federasyon](/concepts/federation).

## Nasıl çalışır?

Cüzdan ve doğrulayıcılar tek bir şeye güvenir: Tamga [[t:LOTL|listeler listesinin]] (LOTL) kök anahtarı. LOTL, her ülke listesinin
adresini, imzacısını ve neye kefil olabileceğini söyler. Bir ülkenin listesini ağa bağlamak, LOTL'a bu kaydı yazdırmaktır.
Liste ülkede kalır; Tamga yalnız toplar ([[ADR-0036]]).

| Yol | Biçim | LOTL'da | Ne zaman |
|---|---|---|---|
| **A. Ulusal liste** | Tamga biçimi (`tamga-tl+jwt`, [[SPEC-TRUST-0001]]) | `national_lists[]` | Ülke Tamga Network üyesi; belge verenleri, doğrulayıcıları ve kök sertifikaları kendi listesinde |
| **B. Dış liste** | ETSI TS 119 602 ([[t:LoTE]], JSON) | `external_lists[]` | Ülkenin ya da AB'nin mevcut listesi; belirli rollere kefil olur |

Bugün Türkiye listesini (`tl-tr.jws`) Tamga vekâleten işletir; diğer Türk Devletleri Teşkilatı üyeleri için kayıtlar ayrılmış
(`RESERVED`) durumdadır. LOTL'da dış liste henüz yoktur.

## A. Ulusal liste

### 1. LOTL kaydı

```json
{
  "state_code": "TR",
  "status": "ACTIVE",
  "membership": "TDT_MEMBER",
  "list_url": "https://trust.tamga.network/tl-tr.jws",
  "operator": { "name": "Tamga Network", "status": "provisional", "on_behalf_of": "TR national authority (to be designated)" },
  "signing_certs": ["tl-signer-1"],
  "roles": {
    "registrar": { "status": "PROVISIONAL", "operated_by": "Tamga Network", "signing_certs": ["registrar-1"] },
    "tlso": { "status": "PROVISIONAL", "operated_by": "Tamga Network" },
    "pid_provider": { "status": "RESERVED" },
    "access_ca": { "status": "PROVISIONAL", "operated_by": "Tamga Network" },
    "national_root_ca": { "status": "ACTIVE", "cert": "root-ca", "operated_by": "Tamga Network (provisional)" }
  },
  "recognition": { "mode": "unilateral", "recognizes": ["TR"] }
}
```

Bugünkü Türkiye kaydı budur. Devralmada aynı kayıtta yalnız `operator`, `list_url` ve imzacılar değişir.

| Rol | Ne yapar |
|---|---|
| `tlso` | Listeyi imzalar ve yayınlar |
| `registrar` | Belge verenleri ve doğrulayıcıları kaydeder; [[t:registration-certificate|kayıt sertifikalarını]] imzalar |
| `access_ca` | Doğrulayıcılara [[t:access-certificate|erişim sertifikası]] verir |
| `national_root_ca` | Belge veren sertifikalarının kökü |
| `pid_provider` | Ulusal kimlik belgesini ([[t:PID]]) veren; bugün ayrılmış |

### 2. Liste kuralları

Listeniz [[SPEC-TRUST-0001]] biçimindedir ve şu kurallara uyar:

- **İmza:** ES256; imzacı sertifikası LOTL kaydındaki `signing_certs` ile eşleşir. En az iki kaydırmalı imzacı önerilir.
- **Sürüm zinciri:** her yayın bir öncekinin özetini (`previous_version_hash`) taşır; sürüm geri gitmez; satır silinmez, durum değişir.
- **Tazelik:** `next_update` en geç 90 gün sonra; değişiklikler en geç 24 saatte yayında. Bayat liste doğrulayıcıda
  "doğrulanamadı" sonucunu verir.
- **Kişisel veri yok:** listede, [[t:anchor-log|çapa günlüğünde]] ve değişiklik kaydında kişi verisi bulunmaz.
- **Kimlikler zincir formülüyle:** `issuer_id`, `ca_id`, `schema_id` ortak defter açıldığında da aynı kalır ([[ADR-0009]]).

### 3. Kayıt ve yayın aracı

Liste yayıncısı açık kaynaktır (`apps/trust-publisher`). Kayıt işlerini elle düzenleme yapmadan yürütür:

```sh
npm run trust:register -- issuer basvuru.json   # belge veren ekle (eksik alanların tamamını tek seferde bildirir)
npm run trust:register -- rp basvuru.json       # doğrulayıcı ekle
npm run trust:authorize -- <slug> <vct>         # belge türü yetkisi (--revoke ile bitir)
npm run trust:status -- <slug> SUSPENDED --reason r
npm run trust:build                              # imzala ve yayınla (dist/)
npm run trust:verify                             # yayını doğrula
```

Başvuru biçimleri: [[GUIDE-0007]] ve [[GUIDE-0008]].

### 4. Tanıma

`recognition.mode` ve `recognizes[]`, bu ülkenin hangi ülkelerin kurumlarını tanıdığını söyler. Doğrulayıcı [[SPEC-API-0001]] C3
adımında bunu sorar (`isRecognizedBy`). Ülkeler arası karşılıklı tanıma üye devletlerin kararıdır.

## B. Dış liste (ETSI)

Ülkenizin ya da AB'nin listesi ETSI biçimindeyse onu taşımanız gerekmez; LOTL'a bir işaretçi eklenir:

```json
{
  "list_id": "example-pid-list",
  "territory": "TR",
  "format": "etsi-lote-json",
  "list_url": "https://example.org/lote/pid-providers.jws",
  "signing_keys": [{ "fingerprint_sha256": "…", "status": "ACTIVE" }],
  "operator": { "name": "…" },
  "status": "ACTIVE",
  "scope": {
    "entity_kinds": ["pid_provider", "wallet_provider"],
    "vct": ["urn:eudi:pid:1", "eu.europa.ec.eudi.pid.1"],
    "category": "IDENTITY",
    "assurance": "I3",
    "class": "PUB",
    "recognized_by": ["TR"],
    "min_key_storage": "secure_enclave"
  },
  "approval": { "approved_at": "…", "ref": "…" }
}
```

- **Kapsam:** dış liste yalnız `scope.entity_kinds` içindeki rollere (`wallet_provider`, `pid_provider`, `eaa_provider`,
  `access_ca`) ve `scope.vct` içindeki türlere kefil olabilir; kapsam dışı kayıtlar yok sayılır.
- **İmzacı sabittir:** imzacısı LOTL'dakiyle eşleşmeyen liste yüklenmez.
- **Bağımsızlık:** dış liste eksik ya da bayatsa Tamga listeleri etkilenmez; yalnız o listeye bağlı sorular "bilinmiyor" döner.
- **Biçim:** bugün `etsi-lote-json` okunur; ETSI XML (`etsi-tl-xml`) tanımlıdır ama okuyucusu yoktur.
- **Kopya:** yayıncı listenin kopyasını `trust.tamga.network/external/<list_id>.jws` adresinde tutar (`npm run trust:external`);
  imza her durumda sabit imzacıya karşı denetlenir.
- **Onay:** bir dış listenin eklenmesi, değişmesi ya da çıkması proje yönetimi onayıyla olur ve `approval` alanına yazılır;
  yer tutucu içeren kayıt yayınlanmaz (FD4).

## Devir

Tamga'nın vekâleten üstlendiği roller (liste işletmecisi, kayıt kurumu, kök CA, geçici kimlik sağlayıcı) devredilebilir
tasarlanmıştır. Devirde belge, cüzdan ve doğrulayıcı tarafında yalnız adres ve imzacı değişir; kimlikler ve verilmiş belgeler
geçerli kalır ([[ADR-0035]] PO3). Ülke listesinin AB'nin beklediği ETSI TS 119 612 görünümü, devlet aşamasından önce yayıncıya
eklenecektir.

## Kurallar

| Kod | Ne der |
|---|---|
| [[ADR-0036]] FD1 | Dış liste yalnız LOTL'da adresi, sabit imzacısı ve kapsamıyla gösterilir |
| [[ADR-0036]] FD2 | Dış liste kapsamı dışındaki rollere ve türlere kefil olamaz |
| [[ADR-0036]] FD3 | Dış listenin sorunu Tamga listelerinin tazeliğini bozmaz |
| [[ADR-0035]] PO3 | Vekâleten üstlenilen roller devredilebilir; devirde yalnız adres ve imzacı değişir |
| Bilinmeyen biçim | Bilinmeyen biçim sürümünde okuyucu durur ([[ARCH-0003]] CMP2) |

Liste işletmecisi kuralları: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/tr/rulebook).
