---
document_id: ADR-0051
title: "Zincir, imzalı listelerin projeksiyonudur"
status: Proposed
review_status: Draft
version: 0.1.0
created: 2026-10-17
last_updated: 2026-10-17
summary: >
  Zincir kodu üretim zinciri kurulmadan önce yazılır ve zincirsiz tasarıma bağlanır: imzalı güven listeleri (lotl, tl-<cc>) ve
  çapa günlüğü kaynak kalır; zincir onların projeksiyonudur. Zincire yalnız liste sürümünün özeti (sürüm, içerik hash'i, önceki
  hash, yayın zamanı) ve çapa günlüğünün son satırının özeti yazılır — içerik, kayıt, belge ya da kişisel veri yazılmaz. Bir çapa
  ancak eşik kadar bağımsız yazıcı aynı veriyi gönderince onaylı sayılır; üretimde eşik en az 2'dir (ikinci işletmeci kapısı,
  ADR-0009 K4). Zincir cevabı doğrulama için hiçbir zaman gerekli değildir; çelişkide imzalı liste geçerlidir. Özellik bayrağı
  varsayılan kapalıdır. Kontratlar Hardhat ile derlenir ve test edilir; üretim zinciri yoktur.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0008]]", "[[ADR-0009]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[PM-TRUST-0001]]", "[[ARCH-0003]]", "[[FW-ARF-0001]]"]
---

# Kısaca

Ağın güveni bugün imzalı listelerde durur; zincir yok. Bu karar zincir kodunun şimdi yazılmasını ve o listelere **bağlanmasını**
söyler: zincir, listelerin özetlerini saklayan ikinci bir kayıt olur. Listeler ne diyorsa o geçerlidir; zincir yalnız "bu liste
sürümü şu anda, şu özetle yayınlandı" diye tanıklık eder — ve bu tanıklık ancak birden çok bağımsız işletmeci aynı şeyi söylediğinde
sayılır.

# Bağlam

- [[ADR-0009]] zinciri **≥2 bağımsız validator operatörü** yazılı kabul verdiğinde kurar (K4); o güne kadar güven çapası imzalı,
  sürümlü, hash zincirli listeler ve saatlik çapa günlüğüdür (K2). Geçiş, liste arşivinin kontratlara yeniden oynatılması ve
  eşdeğerlik testidir (K7). İkinci işletmeci bugün yoktur; aday listesi de yoktur.
- Kontratlar ([[SPEC-BC-0001]]) 2026-10-17'ye kadar hiç derlenmemişti. Proje yönetimi 2026-10-17'de yönü verdi: işletmeci kararı
  ertelenir; zincir kodu **şimdi** yazılır, derlenir, test edilir ve zincirsiz tasarımla **entegre** edilir; üretimde kapalı kalır.
- Entegrasyonun biçimi açık bir karardı: (a) listelerin içeriğini kontratlara şimdi oynatmak, (b) yalnız listelerin özetlerini
  zincire yazmak, (c) hiçbir şey yazmayıp yalnız derlemek. (a) Faz 0'ın işidir — devlet delege anahtarları, validator'lar ve
  yönetişim oyu gerektirir ([[ADR-0009]] K7). (c) kodu tasarımla bağlamaz. Bu ADR (b)'yi önerir: en küçük ve en az riskli
  projeksiyon, ileride (a) için de zemin.
- "Çift konuşma" zayıflığı ([[ADR-0009]] K3, pilot sınırlar bildirimi madde 6): tek operatör iki doğrulayıcıya iki farklı liste
  verebilir; herkese açık günlük bunu caydırır, imkânsız kılmaz. Liste özetinin birden çok bağımsız yazıcı tarafından aynı
  değerle zincire yazılması bu zayıflığı kapatmanın ilk adımıdır — ve ancak ikinci yazıcı gerçekten bağımsızsa değer üretir.
- Kişisel veri sınırı değişmez: zincire belge, belge özeti ya da kişi yazılmaz ([[PM-TRUST-0001]], [[SPEC-BC-0001]]/DP1,
  [[SPEC-TRUST-0001]]/TL11).

# Önerilen karar

## K1 — Projeksiyon ilkesi

Zincir, imzalı güven listelerinin ve çapa günlüğünün **projeksiyonudur**; kaynak değildir. Faz 0 kabulüne (replay + eşdeğerlik,
[[ADR-0009]] K7) kadar:

1. Doğrulama hattı (A–E) ve `TrustSource` yalnız imzalı listelerden okur; zincir hiçbir adımda **gerekli** değildir.
2. Zincir cevabı üç değerlidir: `YES` (onaylı çapa listenin özetiyle aynı), `NO` (aynı sürüm için onaylı **farklı** özet var —
   çift-konuşma işareti), `UNKNOWN` (bayrak kapalı, zincir erişilemez ya da çapa yok). `UNKNOWN` sonucu asla kötüleştirmez;
   `NO` doğrulama sonucunu değiştirmez, işletmeciye alarm üretir ve şeffaflık raporuna girer.
3. Çelişkide imzalı liste geçerlidir; zincir kaydı düzeltilmez, yanına yeni sürüm yazılır (silme yok).

## K2 — Zincire ne yazılır

Yeni bir kontrat, **liste çapası kaydı** (önerilen ad `TrustListAnchorRegistry`; ad proje yönetiminin onayına bağlıdır), iki tür kayıt
tutar; başka hiçbir şey tutmaz:

| Kayıt | Alanlar | Kaynak |
|---|---|---|
| Liste sürümü | `listKey = keccak256("tamga:trust-list:<ortam>:<dosya>")` (ör. `production:lotl`, `production:tl-tr`), `version`, `contentHash = sha256(<dosya>.jws)` (= sonraki sürümün `previous_version_hash` değeri), `previousHash`, `issuedAt` | `lotl.jws`, `tl-<cc>.jws` ([[SPEC-TRUST-0001]] §3–§4) |
| Çapa günlüğü başı | `logKey = keccak256("tamga:anchors:<ortam>")`, `seq`, `lineHash = sha256(satır JWS)`, `ts` | `anchors.jsonl` son satırı ([[SPEC-TRUST-0001]] §5); satır zinciri bütün günlüğü bağlar |

Bütün alanlar `bytes32` ve tam sayıdır; kontratta `string`/`bytes` alanı yoktur. Liste içeriği, kurum/doğrulayıcı/şema kayıtları,
belge, belge özeti ya da kişisel veri **yazılmaz** (DP1, TL11). Mevcut sekiz kontrat ([[SPEC-BC-0001]] §1–§7, §11) değişmez; onlara
yazım Faz 0 replay'idir.

## K3 — Kim yazar: eşikli yazıcılar

- Yazma yetkisi **yazıcı (anchorer)** adreslerindedir; kümeyi ve onay eşiğini `governance` adresi yönetir (Faz 0'da Governance
  proxy'si; bugün dev dağıtımında dağıtan hesap).
- Bir `(listKey, version)` ya da `(logKey, seq)` çapası, **eşik kadar farklı yazıcı** birebir aynı veriyi gönderince **onaylı**
  olur. Onaylı olmayan çapa `YES` üretmez. Üretimde eşik **≥ 2**: tek işletmeci onaylı çapa üretemez — [[ADR-0009]] K4'ün
  ("ikinci bağımsız işletmeci") kontrat karşılığı. Geliştirme ağında eşik 1'dir.
- Açılmış bir sürüm için **farklı özet** gönderen yazıcı reddedilir (`AnchorMismatch`); bu olay çift-konuşma işaretidir ve
  olaylardan izlenir. Sürüm liste başına monoton artar; onaylı kayıt değişmez (eklenir, silinmez).

## K4 — Ne zaman yazılır; bayrak

- Liste yayıncısı (`apps/trust-publisher`) `chain-anchor` komutuyla kendi `dist/` çıktısını okur, önce yükleyiciyle doğrular
  (imza, hash zinciri, tazelik — sağlıksız set çapalanmaz), sonra yalnız özetleri gönderir: her liste yayınından ve her saatlik
  çapa satırından sonra (heartbeat kadansı). Zincirde aynı sürüm aynı özetle varsa atlar; farklı özet varsa yazmaz ve `CONFLICT`
  raporlar (K1.3).
- Özellik bayrağı `TAMGA_CHAIN_ENABLED` varsayılan `0`: kapalıyken hiçbir zincir bağlantısı kurulmaz ve hiçbir şey yazılmaz.
  `--dry-run` ne yazılacağını basar, bağlanmaz. Yazıcı anahtarı ve RPC adresi ortamdan/.env'den gelir; depoda yer tutucu.
- Üretimde bayrak, ikinci işletmeci ve eşik ≥ 2 **olmadan açılmaz**.

## K5 — Doğrulayıcı nasıl kullanır

`chain-check`: elindeki imzalı listenin (`.jws`) özetini hesaplar, zincirdeki onaylı çapayla karşılaştırır ve K1.2'deki üç değerli
cevabı verir. Ek güvencedir; zorunlu adım değildir ve hiçbir zaman olmayacaktır. Doğrulayıcı uygulamasına bağlanması (sağlık
sayfasında gösterim) bayrak açılınca ayrı iş.

## K6 — Araç zinciri ve geçiş

- Kontratlar **Hardhat** (TypeScript testleri) ile derlenir ve test edilir; Foundry kaldırıldı (depo araç setiyle aynı dil; forge
  geliştirme makinelerinde yok). Yerel geliştirme zinciri Hardhat düğümüdür; Besu/QBFT tek-validator geliştirme ağı (Docker)
  ayrı iş.
- Faz 0'a geçiş [[ADR-0009]] K7'dir ve bu ADR'yle değişmez: liste arşivi kontratlara oynatılır, eşdeğerlik testi geçer; liste
  çapası kaydı o günden sonra da çalışır (listeler Faz 0'da da yayınlanır — zincirin projeksiyonu olarak, [[ARCH-0003]] SEV1).

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Hiçbir şey yazmamak; yalnız derleme + test | ret | Kod tasarıma bağlanmaz; "entegre olsun" yönüne aykırı |
| Liste içeriğini kontratlara şimdi oynatmak (K2 yerine Faz 0 replay'i) | ertelendi | Devlet delege anahtarları, validator'lar ve yönetişim oyu gerekir; tek işletmecinin kendi zincirine oynatması güven üretmez (ADR-0009 F1). Replay aracı Faz 0 işi olarak kalır |
| Çapa günlüğünün her satırını ayrı çapalamak | ret (başı yeter) | Satırlar hash zinciriyle bağlıdır; son satırın özeti bütün günlüğü bağlar. Saatlik kadans aynı kalır |
| Herkese açık bir zincire (L2) özet yazmak | ret | D-BC-0 Besu/QBFT değişmez ([[ADR-0001]]); egemenlik ve kişisel veri sınırı dış zincirde denetlenemez |
| Tek yazıcı, eşik yok | ret | Tek işletmecinin zinciri imzalı listeden fazla güven üretmez (ADR-0009 F1); eşik ≥ 2 kapıyı koda taşır |
| Status List ve şema çapalarını da ayrı yazmak | ret (şimdilik) | Mevcut `StatusListRegistry`/`SchemaRegistry` bu işi Faz 0'da yapar; çapa günlüğü başı bugün hepsini bağlar |

# Önerilen kurallar (kabul edilirse bağlayıcı tabloya taşınır)

| Kod | Kural |
|---|---|
| CH1 | Zincir imzalı listelerin ve çapa günlüğünün projeksiyonudur; çelişkide imzalı liste geçerlidir; zincir cevabı doğrulama için gerekli değildir ve `UNKNOWN` sonucu kötüleştirmez. |
| CH2 | Liste çapası kaydına yalnız liste sürümünün ve çapa günlüğü satırının özeti (hash, sürüm/sıra, zaman) yazılır; liste içeriği, kayıt, belge, belge özeti ya da kişisel veri yazılmaz. |
| CH3 | Bir çapa ancak onay eşiği kadar farklı yetkili yazıcı birebir aynı veriyi gönderince onaylıdır; üretimde eşik en az 2'dir. |
| CH4 | Liste başına sürüm monoton artar; açılmış sürüm için farklı özet reddedilir ve çift-konuşma işareti olarak izlenir; onaylı kayıt silinmez ve değiştirilmez. |
| CH5 | `TAMGA_CHAIN_ENABLED` kapalıyken zincire bağlanılmaz ve yazılmaz; üretimde bayrak ikinci bağımsız işletmeci ve eşik ≥ 2 olmadan açılmaz. |

# Sonuçlar

- `contracts/src/anchor/TrustListAnchorRegistry.sol` + testleri; `contracts/` Hardhat projesi; dev dağıtımı kaydı da kurar.
- `apps/trust-publisher`: `chain-anchor` (projeksiyon, bayrak, dry-run) ve `chain-check` (doğrulayıcı tarafı); ABI kopyası
  `src/chain/abi/` (kontrat derlemesinden dışa aktarılır, `contracts:check` farkı yakalar).
- [[SPEC-BC-0001]] §15 (öneri olarak işaretli) ve [[SPEC-TRUST-0001]] §7 satırı; [[FW-ARF-0001]] §8.1 durum notu
  ("kod hazır, üretimde kapalı"). Kabulde DECISIONS'a **D-BC-7**; sürüm notları.
- Değişmeyen kararlar: D-BC-0 (Besu/QBFT), D-BC-6 (zincir eşiği), D-TRUST-0, D-REV-1/2, D-SCHEMA-1, [[ADR-0009]] K7 geçiş.

# Açık konular (karar bekler)

1. Kontrat ve komut adları (`TrustListAnchorRegistry`, `chain-anchor`, `chain-check`).
2. Üretim eşiği tam değeri (öneri 2) ve ikinci yazıcının kim olacağı — ikinci işletmeci adayıyla birlikte.
3. `Governance`'ta genel "çağrı yürüt" önerisi: yazıcı kümesi/eşiği ve `CrossRecognition.bootstrapFounders` Governance üzerinden
   yönetilebilsin (bugün ikisi de yalnız doğrudan `governance` adresinden çağrılabilir; Governance kontratı bunu yapamaz).
4. Besu/QBFT tek-validator geliştirme ağı (Docker) ve `ChainTrustSource` + indeksleyici (Faz 0 okuma yolu).
5. `contracts/` klasörünün public depoya alınması (bugün `.publicignore`'da).

# Durum

**Proposed — 2026-10-17.** Proje yönetiminin 2026-10-17 yönü ("zincir kodu şimdi yazılır, zincirsiz tasarımla entegre olur,
üretimde kapalı") üzerine hazırlandı; kabul proje yönetiminindir. Kabul edilirse DECISIONS: D-BC-7.
