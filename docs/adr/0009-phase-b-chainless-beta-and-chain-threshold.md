---
document_id: ADR-0009
title: "Zincirsiz beta ve zincir eşiği"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-07
summary: >
  Pilotu zincire bağlayan ön koşullar (PM-GTM-0001 Ö1/Ö2) kaldırılır; Faz 0'ın
  önüne "Faz B — zincirsiz beta" eklenir. Güven çapası beta'da Tamga'nın geçici
  operatör olarak imzaladığı, sürümlü ve hash-zincirli güven listeleri (LOTL +
  ulusal liste) ile saatlik çapa günlüğüdür — ETSI TS 119 612 / EUDI modeli.
  Zincir (D-BC-0 Besu/QBFT, değişmez) ancak en az iki bağımsız validator
  operatörü bulunduğunda kurulur; tek operatörün işlettiği dört validator,
  imzalı listeden fazla güven üretmez. Beta'nın her veri yapısı çok-devletli
  (TDT) kurguyu bugünden taşır; Tamga her yerde "vekâleten, geçici" operatördür
  ve devir yalnızca operatör alanını değiştirir. Geçiş = liste geçmişinin
  kontratlara yeniden oynatılması + eşdeğerlik testi.
domain: Trust
---

# ADR-0009 — Faz B: Zincirsiz Beta

**Durum: Accepted ✅** (2026-09-24).
Kabul edildiğinde [[DECISIONS]]'a **D-BC-6**, **D-GTM-2**, **D-GOV-5** olarak işlenir.

---

# Bağlam

## Problem

Tamga'nın kanonik yol haritası pilotu zincire bağlar: [[PM-GTM-0001]] §2 ön koşulları
**Ö1** "kontratlar derleniyor ve testler geçiyor", **Ö2** "testnet ayakta, kontratlar dağıtılmış"
tamamlanmadan gerçek mezun verisi işlenemez (GT1). [[ARCH-0001]] §3 Faz 0'ı "4 vakıf
validator" olarak tanımlar. Kontratlar bugüne kadar hiç derlenmedi (Foundry yok; DECISIONS
§10.5). Bu, üniversite pilotunu ve dolayısıyla üniversite anlaşması ile yatırımcı görüşmelerini
zincir altyapısının arkasına kilitliyor.

## Tespit: Faz 0 zinciri güven üretmiyor (F1)

Faz 0'daki dört validator'ın **hepsi Tamga vakfınındır**. Tek operatörün işlettiği dört QBFT
node'u, Bizans hata toleransının varsaydığı **bağımsızlığı** sağlamaz: dördü de aynı elin
altındaysa, "Tamga yalan söylemiyor" varsayımı hem zincirde hem imzalı bir listede aynı şekilde
gerekir. Fark yalnızca operasyoneldir (kesinti dayanıklılığı) ve gelecekteki çok-taraflılığa
hazırlıktır; **güven açısından** tek operatörlü zincir = tek operatörün imzaladığı,
hash-zincirli bir günlük. Dolayısıyla zinciri Faz 0'da **şart koşmak** pilotun maliyetini
artırır, güvencesini artırmaz.

Zincir, imzacı sayısı 1'den büyüğe çıktığında değer üretir. [[DECISIONS]] D-GOV-2 devir
eşiklerini (≥3 devlet, ≥4 devlet + 12 ay) tanımlar ama **başlangıç eşiği** hiç tanımlanmamıştır.

## Avrupa ne yapıyor

[[t:EUDI-Wallet]] ekosisteminde güven çapası ([[t:trust-anchor]]) zincir değil, her üye devletin imzaladığı **Trusted
List** ([[t:ETSI]] TS 119 612) + Komisyon'un [[t:LOTL]]'üdür; digest Resmî Gazete'de ilan edilir.
EBSI aynı kayıtları zincirde tutar. Tamga'nın kanonik tasarımı EBSI modelini EUDI/ETSI veri
semantiğiyle kullanır ([[SPEC-ID-0002]] §8.1). Beta için EUDI'nin kendi modeline (imzalı liste)
inmek mimariden sapma değil, aynı semantiğin tek-imzacılı özel hâlidir. Analiz:
operatörün iç kaydı.

## Proje yönetiminin yönü (2026-09-23/24)

Zincir beklenmeden bir pilot başlatılır; mimari kararlar aynı kalır. Beta da devletler ve TDT katılmış gibi kurgulanır;
bu kurgu sonra zincire taşınır.

---

# Karar

## Karar 1 — Faz B eklenir

Faz sırası **Faz B → Faz 0 → Faz 1 → Faz 2** olur. Faz B = zincirsiz beta: üniversite pilotu,
[[t:verifier|doğrulayıcılar]], Trust Framework, ölçülmüş sonuç. Uygulama kod tabanı `tamga (bu depo, `packages/` + `apps/`)`
(tamga-network dışı, ancak tamga-network dokümanları otoritedir).

## Karar 2 — Beta'nın güven çapası: imzalı, sürümlü, hash-zincirli listeler + çapa günlüğü

`trust.tamga.network` altında:

| Dosya | Zincir karşılığı | Kural |
|---|---|---|
| `lotl.jws` | `Governance` üye listesi + `SchemaRegistry` (NETWORK) + cüzdan sağlayıcısı çapası | `version` monoton, `previous_version_hash`, `next_update` ≤ 90 gün, değişiklik olmasa da yeniden imza |
| `tl-<cc>.jws` | `RootCARegistry` + `IssuerRegistry` (+ `SchemaAuth`) + `RelyingPartyRegistry` + `CrossRecognition` | aynı; ulusal namespace yalnızca o devletin (beta: Tamga vekâleten) anahtarıyla imzalanır (N1'in beta okuması) |
| `anchors.jsonl` | `StatusListRegistry.publishList` + şema `contentHash` çapaları | append-only; **saatlik** imza (heartbeat dahil); satır silinmez; `previous_hash` |
| `keys/` + kalıcı web sayfası | Resmî Gazete ilanı | LOTL imza sertifikası parmak izleri; ≥2 kaydırmalı sertifika (ETSI 119 612 Annex A.2); rotasyon ≥30 gün önce, yeni anahtar eskisiyle imzalanır |

Kanonik alan adları ve örnekler: operatörün iç kaydı (kabulle birlikte
**SPEC-TRUST-0001** olarak resmileşir — DB-11).

## Karar 3 — Çapa ikamesi: "zincire kaydedilir" ifadelerinin beta okuması

Aşağıdaki değişmezlerin **anlamı korunur**, taşıyıcısı değişir:

| Değişmez | Kanonik ifade | Faz B okuması |
|---|---|---|
| [[SPEC-CRED-0003]]/S1 | Zincirde iptal biti yok; yalnızca çapa | Listede/günlükte iptal biti yok; yalnızca çapa |
| [[SPEC-CRED-0003]]/S4 | Yayın CDN'e yazıldıktan **sonra** zincire kaydedilir | … sonra **çapa günlüğüne** kaydedilir (sıra aynen) |
| [[SPEC-SCHEMA-0001]]/D8 | Zincir kaydı CDN yayınından sonra | Çapa günlüğü kaydı CDN yayınından sonra |
| [[SPEC-BC-0001]]/DP1 | Hiçbir kontrat kişisel veri… saklamaz | Hiçbir liste/günlük/log kişisel veri… saklamaz |
| [[SPEC-BC-0001]]/N1 | Namespace sahibi dışında yazma yok | Ulusal listeyi yalnızca o namespace'in imza anahtarı imzalar |
| [[SPEC-BC-0001]]/GV2 | NETWORK şeması yalnızca Governance ile | NETWORK şeması yalnızca `lotl.jws` içinde, operatör imzasıyla (**askıda**: tek üye) |
| [[ARCH-0003]]/CMP1 | Doğrulayıcı zinciri doğrudan sorgulamaz; indeksleyiciden okur | Doğrulayıcı liste dosyalarını doğrudan yorumlamaz; `TrustSource` önbelleğinden okur |
| [[ARCH-0003]]/CMP2 | Bilinmeyen implementasyon sürümü → dur | Bilinmeyen `list_format_version` → dur |
| [[ARCH-0003]]/CMP4 | Bayat indeksleyici → INDETERMINATE | `next_update` geçmiş/erişilemeyen liste → INDETERMINATE |

Bu okumalar ilgili spec'lere **sürüm notu** olarak eklenir; değişmez metinleri değişmez.
[[ADR-0007]] ve [[ADR-0008]]'in "içerik off-chain, çapa on-chain" ilkesi "içerik off-chain,
çapa **kanonik kayıtta** (zincir veya Faz B listesi)" olarak okunur.

**Bilinen zayıflama (dürüst kayıt):** Zincirde çapa, [[t:issuer|belge verenin]] çift-konuşmasını (iki doğrulayıcıya
iki farklı liste) mutabakatla imkânsız kılar. Faz B'de çapa operatör imzasına dayanır; operatör
ile belge veren birlikte hareket ederse çift-konuşma **mümkündür**; herkese açık günlük, üç aylık
şeffaflık raporu (G8) ve bağımsız denetim bunu **caydırır**, imkânsız kılmaz. Bu, Faz 0
sınırları bildirimine **madde 6** olarak girer (Karar 6).

## Karar 4 — Zincir başlangıç eşiği

Besu/QBFT zinciri ([[ADR-0001]], değişmez) **yalnızca** aşağıdaki koşul sağlandığında kurulur:

> **En az iki bağımsız validator operatörü** (Tamga + Tamga'dan hukuken ve operasyonel olarak
> bağımsız ≥1 kurum: ikinci üniversite, ticaret/sanayi odası veya devlet kurumu) validator
> işletmeyi **yazılı** kabul etmiş olmalıdır.

Bu satır [[DECISIONS]] D-GOV-2 eşik tablosuna "başlangıç" satırı olarak eklenir. Koşul
sağlanmadan zincir kurmak, tek operatörlü zinciri "çok taraflı" diye sunmak anlamına gelir ve
[[PM-GOV-0001]] G6 (her yumuşak yetkinin tripwire'ı) ruhuna aykırıdır.

## Karar 5 — TDT-first ilkesi

Faz B'nin **hiçbir tanımlayıcısı, rol adı veya veri yapısı "Tamga tek operatör" varsayımını
içermez.** Somut kurallar:

1. `lotl` + **her TDT üye devleti için ulusal liste slotu** (TR `ACTIVE`; AZ, KZ, KG, UZ
   `RESERVED`; gözlemciler HU, TM ayrı `membership` alanıyla).
2. Her ulusal listede **tam ARF rol seti** slot olarak: Registrar, TLSO, PID Provider (boş),
   Access CA, National Root CA, Wallet Provider; her slotta `status` + `operated_by`.
3. Her listede `operator: { name: "Tamga Network", status: "provisional", on_behalf_of: "<cc>
   national authority (to be designated)" }`.
4. Kök ve kayıt adları devlete aittir: "TR National Root CA (provisional operator: Tamga)";
   `ca_id`, `issuer_id`, `vct` devirde **değişmez**, yalnızca `operator` alanı değişir.
5. Tamga Trust Framework, TDT üyeliği varsayılarak yazılır: üyelik, kayıt birimi atama, kök devri,
   uyuşmazlık, çıkış; Tamga'nın bugünkü rolü "kurucu vekil" olarak belgede tanımlıdır; 2/3
   kuralı ([[ADR-0002]]) belgede yazılıdır, kodda değil.
6. Cross-recognition alanı her listede bulunur (beta: TR → TR).

## Karar 6 — Pilot ön koşulları ve sınırlar bildirimi yeniden tanımlanır

[[PM-GTM-0001]] v2.0.0: **Ö1'** liste taahhüt testleri geçiyor, imzalı ve hash-zincirli;
**Ö2'** `trust.tamga.network` + `schema.tamga.network` yayında, kök parmak izi sayfası açık;
**Ö5'** sınırlar bildirimi **v2** (8 madde: madde 5 "blockchain yok, kayıtlar imzalı ve herkese
açık", madde 6 "çapa tek operatör imzasına dayanır", madde 7 "[[t:revocation]] ≤ 90 dk"); **Ö7'** bu ADR
kabul; **Ö8'** belge verenin imza anahtarı üniversitenin kontrolünde (G1 aynen). GT1–GT7 aynen.
Ölçüt **B10** (iptal etkili olma ≤ 90 dk) ve **B11** (T0 INDETERMINATE oranı ≤ %0,5) eklenir.

## Karar 7 — Geçiş = replay + eşdeğerlik testi

Faz B → Faz 0 geçişi, liste sürüm arşivinin kontrat çağrılarına **yeniden oynatılması**dır
(operatörün iç kaydı); statü geçmişindeki `since` zamanları
`revokedAt`/`validFrom` alanlarına yazılır ki `isCredentialAcceptable(issuerId, iat)` beta
dönemi belgeleri için aynı cevabı versin (D-BC-3). **Kabul ölçütü:** pilot boyunca kaydedilen
her `(issuer_id, schema_id, iat, list_id, version)` sorgusu için `TrustSource(list)` ve
`TrustSource(chain)` aynı C1/C2/C3/D5 cevabını vermelidir; ACCEPTED/REJECTED farkı = geçiş
tamamlanmamıştır. Verilmiş [[t:credential|belgeler]] yeniden verilmez; cüzdan ve belge veren servisi değişmez.

---

# Gerekçe

1. **Güven eşdeğerliği (F1).** Tek operatörlü zincir ile tek operatörün imzaladığı liste aynı
   güven varsayımına dayanır; ikincisi ucuz, standart (ETSI 119 612) ve EUDI'nin kendi modelidir.
2. **Mimari korunur.** Okuma arayüzü (`TrustSource` = [[SPEC-BC-0001]] §11.2 okuma seti),
   A–E [[t:verification-pipeline]], [[t:SD-JWT-VC]] profili, [[t:status-list]], şema kayıt defteri, cüzdan, protokoller
   iki fazda birebir aynıdır. Beta bir "hack" değil, kanonik mimarinin tek-imzacılı özel hâlidir.
3. **Geri dönülebilirlik.** Liste → zincir replay ile geçer; zincir → liste (ARCH-0004 SEV1'de)
   indeksleyici projeksiyonuyla geri dönebilir. İki yön de aynı formatı kullanır.
4. **Dürüstlük.** Faz 0 sınırları bildirimi zaten "Tamga hem operatör hem düzenleyici" diyordu;
   Faz B bunu daha da açık yazar ve zincirin ne zaman değer ürettiğini tanımlar.
5. **TDT-first**, devir maliyetini sıfıra indirir ve "devletlerle çalışan altyapı" anlatısını
   veri yapısında kanıtlar (rezerve slotlar, vekâleten operatör).

---

# Değerlendirilen Alternatifler

## A — Zinciri bekle (mevcut plan) — Reddedildi
Pilot, Foundry kurulumu + derleme + testnet + denetime bağlı kalır (aylar). Güvence kazancı yok
(F1). Üniversite ve yatırımcı görüşmeleri gecikir.

## B — Tek node'lu / dört node'lu "geliştirme zinciri" ile pilot — Reddedildi
Zincir görünümü verir, güven vermez; ayrıca zincir işletim maliyetini (node'lar, RPC güvenliği
O1, indeksleyici) beta'ya taşır. "Blockchain'li pilot" pazarlaması yanıltıcı olur (D-GTM-1/5:
"blockchain" değil "doğrulanabilir kayıt altyapısı").

## C — Web2 demo (tamga-demo tarzı) ile pilot — Reddedildi
[[t:trust-list|Güven listesi]], X.509, SD-JWT VC, iptal listesi olmadan yapılan bir demo "aynı mimari" değildir;
zincire geçişte her şey yeniden yazılır; kriptografik iddialar gösterilemez. tamga-demo yalnızca
ekran/anlatı referansıdır (BIP39 seed cüzdanı WL1'i ihlal eder).

## D — Gün 1'den çok-taraflı zincir (ikinci kurumla) — Ertelendi
Doğru hedef ama ikinci bağımsız operatör **bugün yok**; onu bulmanın yolu pilotu göstermektir.
Karar 4 tam olarak bu eşiği tanımlar.

---

# Sonuçlar

## Bağlayıcı
1. [[DECISIONS]]: **D-BC-6** (Faz B + zincir başlangıç eşiği), **D-GTM-2** (Ö'/bildirim v2),
   **D-GOV-5** (TDT-first); D-GOV-2 tablosuna başlangıç satırı. Değiştirilen kararlar tablosuna:
   PM-GTM Ö1/Ö2 → Ö1'/Ö2'.
2. [[ARCH-0001]] §3: Faz B satırı; Faz 0 tanımı "≥2 bağımsız validator operatörü".
3. [[PM-GTM-0001]] v2.0.0 (Karar 6).
4. [[SPEC-CRED-0003]], [[SPEC-SCHEMA-0001]], [[SPEC-BC-0001]], [[ARCH-0003]]: Karar 3 sürüm notları.
5. [[SPEC-ID-0002]] §8.1: projeksiyon kaynağı "kanonik kayıt (zincir veya Faz B listesi)".
6. Yeni doküman **SPEC-TRUST-0001** (liste formatı) `/new-doc` ile; **PM-TRUST-0002 / Tamga
   Trust Framework** (WB 5 katman) `/new-doc` ile.
7. `(bu depo) ` kod tabanı bu ADR'ye bağlıdır; `TrustSource` dışında liste yorumlayan iş
   mantığı yazılamaz (BT4).

## Değişmeyen kararlar
D-BC-0 (Besu/QBFT), D-GOV-0, D-ID-1, D-CRED-1, D-ASSUR-1, D-SCHEMA-1/2/3 (ADR-0010 ayrı
ele alır), D-REV-1/2/3, D-TRUST-0, D-AUTH-5, D-STR-1..4, D-GTM-1. Bu ADR yalnızca zincirin **ne
zaman** kurulacağını ve o güne kadar çapanın **kimin imzası** olduğunu tanımlar.

## Kabul edilen ödünleşimler
- Çift-konuşma koruması zayıflar (Karar 3, bildirim madde 6).
- Tamga operatör bileşeni (`trust-publisher`) tek nokta arızasıdır: liste süresi dolana kadar
  önbellekten doğrulama sürer, sonra INDETERMINATE; runbook + iki kişilik erişim zorunlu.
- GV3/GV4 (oy kuralları) Faz B'de askıdadır; yönetişim kodda değil belgede yaşar.

---

# İlişkiler

**Ekler:** [[ARCH-0001]] Faz B · [[PM-GTM-0001]] v2 · D-GOV-2 başlangıç eşiği
**Yorumlar (sürüm notu):** [[ADR-0007]], [[ADR-0008]], [[SPEC-CRED-0003]], [[SPEC-SCHEMA-0001]], [[SPEC-BC-0001]], [[ARCH-0003]]
**Dayanır:** [[ADR-0001]] (değişmez), [[ADR-0002]] (egemenlik, cross-recognition), [[PM-ASSUR-0001]] (devletsiz bootstrap)
**Doğurur:** SPEC-TRUST-0001, Tamga Trust Framework, `(bu depo) `
**Kardeş:** [[ADR-0010]] (vct URN + kategori — TDT-first'ün tip kimliğine uygulanması)
**Analiz kaynağı:** operatörün iç kaydı.

---

# Durum

**Accepted ✅** — 2026-09-24. [[DECISIONS]]'a D-BC-6, D-GTM-2, D-GOV-5 olarak işlendi; etkilenen SPEC sürüm güncellemeleri DECISIONS §10 açık taahhütler listesindedir.
