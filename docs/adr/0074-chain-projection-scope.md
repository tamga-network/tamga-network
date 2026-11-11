---
document_id: ADR-0074
title: "Projeksiyon kapsamı 0.8: imzalı listelerdeki bütün güven kayıtları zincirde"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  İmzalı listelerde olup zincirde karşılığı olmayan kayıtların (kapı grupları, kayıt sertifikası durum listesi, XML ve LoTE
  görünümleri, liste imzacıları, cüzdan sağlayıcılar, ZK devreleri, dış listeler, belge kategorileri, liste işletmecisi, kurum
  sınıfı ve kayıt verisi) hangi kontrata, hangi alan ve olayla yansıyacağını belirler. Sınır: zincire kişisel veri ve serbest metin
  girmez; kayıt ayrıntıları yalnız özet (`bytes32`) ve mevcut `metadataURI` deseniyle; yeni `string` alanı yok. Ağ düzeyi kayıtlar
  Governance önerisiyle yazılır. Kayıt sertifikası durum listesi ve liste görünümleri çapa günlüğüne yeni satır türleriyle girer.
  Okuma yolu `ChainTrustSource` + indeksleyici `apps/` altında. Sandbox zincire yazılmaz. `contracts/`, `network/` ve
  `docs/ledger` public depoya alınır. Kabul edildi (2026-11-04); adlar onaylı.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0015]]", "[[ADR-0024]]", "[[ADR-0032]]", "[[ADR-0036]]", "[[ADR-0038]]", "[[ADR-0051]]", "[[ADR-0055]]", "[[ADR-0066]]", "[[ADR-0068]]", "[[ADR-0069]]", "[[ADR-0070]]", "[[ADR-0073]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Zincir, imzalı listelerin ikinci bir kaydıdır; listeler ne diyorsa zincir de onu söylemelidir. Bugün listelerin bir kısmı (kapı
grupları, cüzdan sağlayıcılar, dış listeler, kayıt sertifikalarının iptal listesi, liste işletmecisi ve kayıt bilgileri) zincirde
hiç yok. Bu öneri her birinin zincirde nereye ve nasıl yazılacağını söyler. Kişi bilgisi ve açıklama metinleri zincire gitmez;
onların yerine "parmak izi" niteliğinde kısa bir özet yazılır, metnin kendisi imzalı listede kalır. Paket sürüm dizisi 0.8'de
uygulanması önerilir.

# Bağlam

- [[ADR-0051]] zinciri imzalı listelerin projeksiyonu yaptı (CH1) ve bugün yalnız liste sürümlerinin ve çapa günlüğü başının
  özetini yazar; kayıt kontratlarına yazım Faz 0 yeniden oynatmasına bırakıldı. [[ADR-0073]] bu yeniden oynatmayı uygulanabilir yapar.
- [[SPEC-TRUST-0001]] §7 liste alanlarını kontrat çağrılarına eşler; `wallet_providers[]` ve `zk_circuits[]` için "zincirde henüz
  yok — ADR adayı" der. 2026-11-04 karşılaştırmasında eşlemenin dışında kalanlar:
  - **F6:** kapı grupları ([[ADR-0069]]), kayıt sertifikası durum listesi ([[ADR-0068]]), ETSI XML görünümü ve
    `xml_signing_keys` ([[ADR-0066]]), LoTE görünümleri zincirde yok.
  - **F7:** LOTL'daki cüzdan sağlayıcılar, ZK devreleri ([[ADR-0032]]), dış listeler ([[ADR-0036]]) ve `eaa_categories` yok.
  - **F8:** liste işletmecisi `operator {name, status, on_behalf_of}` ([[ADR-0070]]), kayıt verisi ([[ADR-0024]]), kurum sınıfı
    (`class`) ve `revocation_policy_uri` zincirde yok; kontratta yalnız `nameHash` ve `metadataURI` var.
  - **F9:** sandbox ([[ADR-0038]]) çapa günlüğü ve listeleri her gece sıfırlanır; zincirdeki sürüm ve sıra yalnız ileri gider ve
    silinmez ([[ADR-0051]]/CH4).
- [[ADR-0051]] açık konu 4 (`ChainTrustSource` + indeksleyici) ve 5 (`contracts/` public depoya) bu öneride.
- **Proje yönetiminin yönü (2026-11-04):** kapsam "her şey zincirde" — kapı grupları, kayıt sertifikası durum listesi, cüzdan
  sağlayıcılar, dış listeler, ZK devreleri, belge kategorileri ve kayıt bilgileri dahil. Sınır: kişisel veri ve serbest metin zincire
  girmez; kayıt ayrıntısı özet ya da adres olarak. Açıklık: rehber, PDF, belge sitesi kavram sayfası ve `contracts/` herkese açık.

# Karar

## K1 — Kapsam ilkesi ve veri sınırı

- İmzalı listelerde (LOTL, ulusal listeler, çapa günlüğü) bir güven kararını etkileyen her kayıt zincirde bir kontrat kaydına ya da
  çapaya eşlenir. Liste kaynak kalır; çelişkide liste geçerlidir ([[ADR-0051]] CH1).
- Zincire yalnız tanımlayıcı özetleri, parmak izleri, kapalı küme değerleri, sayılar, tarihler, devlet kodları ve adresler yazılır.
  Serbest metin (ad, unvan, açıklama, amaç, not, etiket, gerekçe) ve kayıt ayrıntısı (vergi numarası ve diğer tanımlayıcılar, posta
  adresi, iletişim, politika ve bilgi adresleri, denetim kurumu) yalnız **ayrıntı özeti** olarak yazılır: imzalı listedeki ilgili
  alan bloğunun kanonik JSON'unun (RFC 8785) SHA-256'sı. Kaydın tamamına işaret gerekiyorsa mevcut `metadataURI` alanı kullanılır.
- ABI: yeni alanlar `bytes32`, tam sayı, `bool`, `bytes2` ya da `address`'tir; yeni `string` alanı ve serbest `bytes` yoktur;
  `privacy-abi` testinin izin kümesi genişlemez. Kontrata yalnız bir sorguya ya da eşdeğerliğe gereken alan eklenir; struct'lara
  alan sona eklenir (UUPS depolama düzeni, `__gap`).
- Kimlik, belge, belge özeti, iptal biti, takma ad, cihaz ya da cüzdan örneği kimliği hiçbir zaman (DP1, TL11).

## K2 — Ulusal listeler (F6, F8)

| Liste alanı | Kontrat | Zincirde |
|---|---|---|
| `issuers[].class` | `IssuerRegistry` | kapalı küme `PUB`, `QUALIFIED`, `EAA` (yalnız sona eklenir) |
| `issuers[]` kayıt verisi ([[ADR-0024]]: `trade_name`, `identifiers`, `postal_address`, `info_uri`, `contact`, `service_description`, `supervisory_authority`) | `IssuerRegistry` | kayıt verisi özeti; `is_public_sector_body` → `bool`; `entitlements` → kapalı küme bit maskesi |
| `issuers[]` işletim adresleri (`issuer_url`, `status_list_base`, `revocation_policy_uri`), `assurance_basis`, `authentic_source`, `delegate_keys` | `IssuerRegistry` | ayrıntı özeti (liste `delegate_keys` imza anahtarı parmak izidir; zincir delege adresleriyle karıştırılmaz) |
| `relying_parties[]` kayıt verisi | `RelyingPartyRegistry` | kayıt verisi özeti, `bool`, bit maskesi (aynı kural) |
| `relying_parties[].uses_intermediaries`, `served_relying_parties` | `RelyingPartyRegistry` | `rpId` dizileri ([[ADR-0073]] K4) |
| `relying_parties[].pseudonyms` | `RelyingPartyRegistry` | kapalı küme `single`, `multiple` |
| `relying_parties[].terminal_groups[]` ([[ADR-0069]]) | `RelyingPartyRegistry` | grup kaydı: `keccak256(group_id)` (bütün ağda tek, TG1), kurum bağı (`issuerId` ya da `rpId`), politika kimliği özetleri, kapı sertifikası parmak izleri, `offline_allowed`, geçerlilik aralığı; `label` → özet. Geri çekilen grup silinmez, aralığı kapanır |
| `root_cas[]`, `issuers[]`, `relying_parties[]` `legal_name` | mevcut `nameHash` | değişmez |
| `operator` (her listede) | ağ düzeyi kayıt (K3) | liste işletmecisi kaydı |

## K3 — LOTL ve ağ düzeyi kayıtlar (F6, F7, F8)

- LOTL'un ağ düzeyi içeriği için **yeni bir ağ düzeyi kayıt kontratı** gelir: `NetworkRegistry` (ad onaylı).
  Yazım yalnız Governance'ın türü belli önerileriyle (2/3, [[ADR-0055]]/GE3) ya da göç kipinde göç yürütücüsüyle ([[ADR-0073]] K1).

| LOTL alanı | Zincirde |
|---|---|
| `wallet_providers[]` | sağlayıcı kaydı: `keccak256(provider_id)`, ad özeti, durum pencereleri; WUA imza anahtarları: parmak izi + geçerlilik + durum. Sorgu: "bu parmak izi şu anda listeli bir sağlayıcının WUA anahtarı mı" |
| `zk_circuits[]` | devre kaydı: `circuit_id`, sistem (`keccak256("longfellow-libzk-v1")`), sürüm, öznitelik sayısı, devre dosyası SHA-256'sı, durum; `note` yazılmaz |
| `external_lists[]` | dış liste kaydı: `keccak256(list_id)`, bölge (`bytes2`; ülke kodu ya da `EU`), biçim (kapalı küme `etsi-lote-json`, `etsi-tl-xml`), sabitlenmiş imzacı parmak izleri, işletmeci ad özeti, durum; kapsam: rol bit maskesi, tür özetleri (`vct` / docType), kategori, güvence, sınıf, tanıyan devletler, en az anahtar deposu; onay (`approval`) tarihi ve özeti (FD4); `list_url` → ayrıntı özeti |
| `eaa_categories` | kategori kaydı: `keccak256(kod)` + etiket özeti |
| `anchor_signing_keys`, `national_lists[].signing_keys`, `national_lists[].xml_signing_keys` ([[ADR-0066]]) | imzacı kaydı: liste anahtarı ya da devlet kodu, amaç (kapalı küme: çapa, JSON liste, XML liste), parmak izi, geçerlilik, durum |
| `national_lists[]` slotları (`status`, `membership`, `roles`) | slot kaydı: devlet kodu, slot durumu (`RESERVED`, `PROVISIONAL` dahil), üyelik türü (kapalı küme); rol slotları: rol özeti, durum, işletmeci özeti. Üyelik ve tanıma mevcut Governance ve `CrossRecognition`'da |
| `operator` (LOTL ve her ulusal liste) | liste işletmecisi kaydı: liste anahtarı (`listKey`), ad özeti, durum (`provisional`, `designated`), `on_behalf_of` özeti. Devir yalnız bu kaydı değiştirir ([[ADR-0070]]/OP3, [[ADR-0009]] K5) |
| `catalogue.url` | ayrıntı özeti |
| `pid_providers[]` | liste aşamasında boş (TL8); dolunca cüzdan sağlayıcı kaydıyla aynı biçim |

## K4 — Çapa günlüğüne yeni satır türleri (F6)

Kayıt sertifikası durum listesi ve liste görünümleri bugün çapa günlüğünde değil. İki yeni satır türü gelir (adlar onaylı):

| Satır türü | Alanlar | Zincirde |
|---|---|---|
| `registration_status` | `list_uri` (opak, S8), `content_hash` (imzalı listenin SHA-256'sı), `list_version` (yayıncının liste başına monoton sayacı), `published_at` | Liste çapası kaydında `anchorList`; anahtar `keccak256("tamga:registration-status:<ortam>:<n>")` |
| `list_view` | `file` (ör. `tl-tr.xml`), `format` (`etsi-tl-xml`, `etsi-lote-json`), `source_file` (`lotl`, `tl-<cc>`), `source_version`, `content_hash` (dosyanın SHA-256'sı = `.sha2`) | `anchorList`; anahtar `keccak256("tamga:trust-list-view:<ortam>:<dosya>")`, sürüm = kaynak listenin sürümü ([[ADR-0066]] K1: görünüm ayrı liste değildir) |

- Kontrol noktasının `state`'i bu satırları da taşır (TL12). Kontrat değişikliği gerekmez; yeni anahtar ad alanları yeter.
- Görünüm kaynakla çelişirse kaynak (JSON liste) geçerlidir.
- Yükleyici bilinmeyen satır türünde durur; bu yüzden sıra: önce yeni türleri tanıyan paket sürümü, sonra yeni satırlar.

## K5 — Okuma yolu: `ChainTrustSource` ve indeksleyici

- İndeksleyici ve `ChainTrustSource` yeni bir uygulamada: `apps/chain-indexer/` (ad onaylı). İndeksleyici
  kontrat olaylarını okur ve kayıtları bellekteki liste biçimine çevirir; `ChainTrustSource` aynı `TrustSource` arayüzünü uygular
  ([[ADR-0015]] K3): C1/C2/C3'ü ve kayıtları **indeksten**, kontratın okuma kurallarının aynısıyla verir (düzeltme 2026-11-11:
  önceki metin "sabitlenmiş bloktaki kontrat okumalarından (`TrustQueries`)" diyordu; uygulama indeksten cevaplar, kontrat okuması
  eşdeğerlik testinde üçüncü kaynak olarak karşılaştırılır). İndeks bayatsa ya da zincir erişilemezse cevap `UNKNOWN`'dur (CMP4).
- **Sağlık içeriğe bağlıdır; sürekli projeksiyon gelene kadar doğrulamada kullanılmaz (not 2026-11-11).** Blok zamanı zincir
  yürüdükçe tazelenir, ama zincirin içeriği bugün yalnız bir kerelik yeniden oynatmadan gelir: imzalı listeler ilerlerken zincir
  yerinde sayar. Bu yüzden `ChainTrustSource` ancak çağıran içerik düzeyini verirse (zincire yansıtılan düzey ≥ imzalı listelerin
  bugünkü düzeyi) ve indekste okunamayan kayıt yoksa sağlıklıdır; aksi hâlde bütün cevaplar `UNKNOWN`'dur. Listedeki her
  değişikliği zincire yazan **sürekli bir projeksiyon** kurulana kadar bu kaynak hiçbir doğrulama kararında (C1/C2/C3/D5)
  tüketilmez; bugünkü tek kullanımı eşdeğerlik testidir. İndeksleyici yalnız durum değiştiren olayları izler (herkesin
  çağırabildiği sabitleme olaylarını değil), olayları dilimlerle okur ve başka zincire bağlanan dizini reddeder.
- `@tamga-network/trust/core` hafif kalır ([[ADR-0015]] K1); zincir istemcisi bağımlılığı oraya girmez. Üçüncü taraflar için ayrı
  paket gerekirse adı `@tamga-network/chain` (ad onaylı). Liste yayıncısının `trust:chain-check`'i yerinde kalır.
- [[ADR-0073]] K6 eşdeğerlik testi bu okuma yolunu kullanır.

## K6 — `contracts/`, `network/` ve `docs/ledger` herkese açık depoya

- Proje yönetiminin açıklık kararı (2026-11-04) gereği `contracts/`, Besu ağ dosyaları (`network/`, `scripts/besu-dev.ps1`) ve
  zincir aşaması belgeleri (`docs/ledger`) public depoya alınır.
- **Uygulama adımı:** `.publicignore`'dan bu satırlar ve dış denetçi paketinin kontrat bölümü
  (`docs/audit/contracts.md`, `docs/audit/contracts-invariants.md`) çıkarılır; public yayın denetimi yeniden çalıştırılır; `contracts/`
  içinde anahtar, `.env` ve dağıtım kaydı olmadığı doğrulanır; README İngilizce ve kısa olur.

## K7 — Sandbox zincire yazılmaz (F9)

- Sandbox listeleri ve çapa günlüğü üretim zincirine çapalanmaz ve yeniden oynatılmaz. `trust:chain-submit` ve
  `trust:chain-replay`, `environment: sandbox` setini üretim zincirinde reddeder.
- Sandbox yalnız yerel geliştirme zincirinde denenebilir; o zincir sandbox sıfırlamasıyla birlikte sıfırlanır.

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Yalnız liste özetleri (bugünkü [[ADR-0051]] K2) | ret | "Her şey zincirde" yönüne aykırı; kayıt düzeyinde sorgu ve eşdeğerlik yok |
| Ayrıntı metinlerini zincire açık yazmak | ret | Kişisel veri ve serbest metin sınırı (DP1, TL11); zincirden silinemez |
| Ayrıntıları hiç yazmamak | ret | Listedeki ayrıntının değişip değişmediği zincirden denetlenemez; özet bunu sağlar |
| Ağ düzeyi kayıtları mevcut kontratlara dağıtmak | ret (öneri) | Cüzdan sağlayıcı, ZK devresi, dış liste ve imzacı hiçbir devletin değil ağın kaydıdır; tek Governance kapısı |
| Görünümleri ayrı sürüm sayacıyla çapalamak | ret | [[ADR-0066]] K1: görünüm aynı yayının ikinci biçimidir |
| Sandbox'ı da zincire çapalamak | ret | Gece sıfırlaması CH4 ile çelişir; test ağı gerçek ağın güven kaydına karışmaz |
| `ChainTrustSource`'u `trust/core`'a koymak | ret | Cüzdan ve tarayıcı çekirdeği zincir istemcisini taşımaz ([[ADR-0015]] K1) |

# Değişmezler

| Kod | Kural |
|---|---|
| PJ1 | İmzalı listelerde güven kararını etkileyen her kayıt zincirde bir kayda ya da çapaya eşlenir; liste kaynak kalır ve çelişkide liste geçerlidir. |
| PJ2 | Zincire kişisel veri ve serbest metin yazılmaz; kayıt ayrıntıları yalnız kanonik JSON özeti ve mevcut `metadataURI` ile temsil edilir; yeni `string` alanı ve serbest `bytes` eklenmez. |
| PJ3 | Ağ düzeyi kayıtlar (cüzdan sağlayıcı, ZK devresi, dış liste, belge kategorisi, liste imzacısı, liste işletmecisi, slot) yalnız Governance önerisiyle ya da göç kipinde göç yürütücüsüyle yazılır. |
| PJ4 | Sandbox listeleri ve çapa günlüğü üretim zincirine yazılmaz ve yeniden oynatılmaz. |
| PJ5 | Liste görünümleri ve kayıt sertifikası durum listesi çapa günlüğüne satır olarak girer ve zincirde kaynak sürümüyle çapalanır; görünüm kaynakla çelişirse kaynak geçerlidir. |

# Açık soruların kararları (2026-11-04)

1. **Ad:** yeni ağ düzeyi kontrat `NetworkRegistry` (K3).
2. **Ad:** çapa günlüğü satır türleri `registration_status` ve `list_view` (K4).
3. **Ad:** `apps/chain-indexer/`; ileride gerekirse paket `@tamga-network/chain` (K5).
4. **Açıklık:** `contracts/`, `network/` ve `docs/ledger` herkese açık (K6).
5. **Ayrıntı özeti biçimi:** RFC 8785 kanonik JSON + SHA-256 (K1); alan bloklarının sınırı uygulamada tabloyla sabitlenir.
6. **Sandbox:** ayrı test zinciri kurulmaz; yalnız yerel geliştirme zinciri (K7).

# Sonuçlar

- Kontratlar ([[ADR-0073]] ile birlikte): `IssuerRegistry` ve `RelyingPartyRegistry` yeni alanları ve kapı grupları,
  yeni ağ düzeyi kontrat, Governance öneri türleri, `privacy-abi` testinin yeni kontratı kapsaması; [[ADR-0051]] K2'nin "mevcut sekiz
  kontrat değişmez" cümlesi değişmiş olur.
- `@tamga-network/trust`: yeni çapa satırı türleri, kontrol noktası `state`'i; `apps/trust-publisher`: projeksiyon planı yeni
  kayıtları ve ortam denetimini kapsar; `apps/chain-indexer/`.
- Belgeler: [[SPEC-BC-0001]] (§3, §6, yeni bölüm, §13, §15) ve [[SPEC-TRUST-0001]] §5 ve §7 değişir.
- Üretimde zincir yine kapalıdır ([[ADR-0009]] K4, [[ADR-0051]] CH5).

# Durum

**Accepted — 2026-11-04.** Proje yönetiminin onayıyla (birebir alıntı özel onay kaydında): adlar `NetworkRegistry`,
`registration_status`, `list_view`, `apps/chain-indexer/`, ileride `@tamga-network/chain`; `contracts/`, `network/` ve
`docs/ledger` herkese açık; açık soruların kalanı önerildiği gibi. DECISIONS: D-BC-13. PJ1–PJ5 bağlayıcıdır. Kontratlardaki
uygulama sürüyor ([[SPEC-BC-0001]] sürüm notları).
