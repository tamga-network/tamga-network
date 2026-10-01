# Deney: Longfellow ZK ile sıfır bilgi ispatlı mdoc sunumu (Z5 Aşama 1)

> **Deney; üretimde kullanılmaz.** Bu klasör hiçbir paket, uygulama, test ya da derlemeye dahil değildir (npm çalışma
> alanları `packages/*` ve `apps/*`; tsconfig, vitest ve prettier bu klasörü kapsamaz). Lisans: depo ile aynı (Apache-2.0).
> Anahtarlar deneye özeldir ve atılır; kişi verileri sahtedir. Upstream kodu `vendor/` altında, depoya girmez (`.gitignore`).

## Sade özet (proje yönetimi için)

- **Soru:** Avrupa'nın yaş doğrulamada kabul ettiği sıfır bilgi ispatı yöntemi (açık kaynak **Longfellow ZK**) Tamga'nın bugün
  verdiği kimlik belgesiyle, belgeyi hiç değiştirmeden çalışır mı?
- **Cevap: Evet — gerçek ispatla gösterildi.** Tamga'nın kendi kimlik belgesi (özel belge türü, kendi ad alanı, içinde iptal
  listesi bilgisi) üzerinde "18 yaşından büyüğüm" ispatı üretildi ve doğrulandı. Doğrulayıcı doğum tarihini, adı ya da başka
  hiçbir alanı görmedi; yalnız "evet" öğrendi.
- **Hız (bu masaüstü, 5 çalıştırmanın ortancası):** ispat **0,52 s**, doğrulama **0,21 s**. İspat boyutu **~343 KB** (QR'a
  sığmaz; internet üzerinden sorun değil). İspat sırasında bellek **~92 MB**.
- **Sahtecilik denemeleri reddedildi:** kurcalanmış belge, başka kurumun anahtarı, başka oturum, "hayır" olan belgeden "evet"
  ispatı, bozulmuş ispat — hepsi RED (11 testin tamamı beklendiği gibi).
- **Öğrenilen bir sınır:** ispat belge türünü (docType) bağlıyor ama **ad alanını (namespace) bağlamıyor**. Bizim için sorun
  değil; kural olarak yazıyoruz: bir belge türünde aynı alan adı yalnız bir ad alanında bulunur.
- **Kurulum:** bilgisayara yönetici yetkisi gerektiren hiçbir şey kurulmadı; Rust ve derleyici kullanıcı klasörüne kondu.

## Sonuçlar

**Ölçümler** (Windows 11, 12 çekirdek, 32 GB; `tamga-zk bench`, 5 çalıştırma, ortanca; ispat/doğrulama süresine devrenin
sıkıştırmasının açılması dahil):

| Ölçüm | İşlemciye özel derleme (`-C target-cpu=native`) | Genel x86-64 derleme |
|---|---|---|
| Devre üretimi (1 alan, bir kez; sonra dosyadan) | 18,3 s (17,4–23,8) | 21,8 s |
| İspat (Tamga belgesi) | **518 ms** (497–529) | 3573 ms |
| Doğrulama | **211 ms** (209–212) | 1397 ms |
| İspat boyutu | 343 KB (342 500–344 420 B) | aynı |
| Sıkıştırılmış devre dosyası | 299 999 B | aynı |
| Bellek zirvesi (çalışma kümesi) | — | ispat 92 MB · doğrulama 42 MB · devre üretimi 1,66 GB |

Hız farkının nedeni: Longfellow GF(2^128) aritmetiği için işlemcinin taşımasız çarpma (PCLMULQDQ) ve AVX2 komutlarını kullanıyor;
genel x86-64 derlemesi bunları açmıyor. **Telefon derlemesinde de hedef işlemci özellikleri açık olmalı** (ARM'de PMULL/NEON).
ISO mDL karşılaştırma belgesinde süreler aynı (ispat 536–3789 ms, doğrulama ~1,5 s genel derleme).

**Devre özdeşliği:** 5 bağımsız üretimde aynı devre kimliği `5a8938159603876eb537a117cfe9e2eaec5a01a042b316a8e57e52e4bb3c9291`
(v8, 1 alan; upstream `CURRENT_ZK_SPECS` ile aynı) ve aynı dosya özeti (SHA-256 `f44ab1a415f284251ea6ad5451d2588c1e7011eb9ba46091116e8caa4c8e0d83`).
Devre belirlenimci — "kabul edilen devreyi özetiyle sabitle, özeti imzalı güven listesinde yayınla" kuralı uygulanabilir.

**Negatif testler** (`negative-tests.sh`):

| Deneme | Beklenen | Sonuç |
|---|---|---|
| Geçerli ispat | KABUL | ✓ KABUL |
| Değeri kurcalanmış belgeyle ispat üretmek (`age_over_18` true→false, özet MSO ile tutmaz) | RED | ✓ RED (özet devresi) |
| Yanlış kurum anahtarıyla doğrulamak / ispat üretmek | RED | ✓ RED / ✓ RED (imza devresi) |
| Başka oturumun SessionTranscript'iyle (başka nonce) doğrulamak | RED | ✓ RED |
| Başka transcript için ispat üretmek (cihaz imzası tutmaz) | RED | ✓ RED — cihaz bağlaması devrede |
| `age_over_18 = false` belgeden "true" ispatı | RED | ✓ RED |
| Geçerli ispatı "false" iddiasıyla doğrulamak | RED | ✓ RED |
| Başka docType ile doğrulamak | RED | ✓ RED — docType bağlı |
| Başka namespace ile doğrulamak | (bilgi) | KABUL — **namespace ispata bağlı değil** (aşağıda) |
| Tek biti bozulmuş ispat | RED | ✓ RED |

Node köprüsü (`bridge.ts`): doğrulayıcı transcript'i kendi oturum bilgisinden hesaplıyor — geçerli ispat KABUL (230 ms), başka
nonce RED, başka doğrulayıcı adı (`client_id`) RED.

**Uyumluluk soruları — cevaplar:**

| Soru | Cevap |
|---|---|
| MSO'daki `status` (iptal listesi) alanı sorun mu? | **Hayır.** Tamga belgesi `status` ile ispatlandı. |
| Bizim bytewise CBOR sıralamamız (ISO uzunluk-önce ister) sorun mu? | **Hayır.** Aynı ispat bizim sıralamamızla üretildi ve doğrulandı. |
| Özel docType `urn:tamga:id:IdentityAttestation:1` ve ad alanı `tamga.id.1`? | **Çalışıyor.** ISO mDL ile aynı süre ve boyut. |
| docType ispata bağlı mı? | **Evet** (başka docType ile doğrulama RED). |
| Namespace ispata bağlı mı? | **Hayır** (v8 Rust çalışma zamanı: `namespace_id` yalnız "istenen alanlar aynı ad alanında mı" ön denetiminde kullanılıyor; devre girdisi değil). Doğrulayıcı "bu kurumun bu türdeki belgesinde, bir ad alanında `age_over_18 = true` var" öğrenir. **Bizim kuralımız:** bir belge türünde aynı alan adı yalnız bir ad alanında bulunur (şema kataloğu denetler). |
| Cihaz anahtarı (Secure Enclave) bağlaması? | Devre cihazın SessionTranscript üzerindeki normal ECDSA imzasını doğruluyor ve cihaz açık anahtarını gizliyor; bugünkü `tamga-keys` akışı değişmeden kullanılabilir. |
| Belgede değişiklik gerekiyor mu? | **Hayır.** Yalnız MSO en az 256 bayt olmalı (bizde 418–784) ve açılacak alan kaydı ≤ 119 bayt (`age_over_18` 83). |

Alan uygunluğu (önceki bayt denetimi, `check-compat.ts`): Tamga kimlik belgesinin 11 alanından 9'u ispatla açılabilir;
`document_number_hash` (143 B) ve `verification_method` (121 B) kayıt sınırını (119 B) aşar — ikisi de sitelere açılmayan iç alanlar.

## Yeniden üretme

Araçlar (yönetici yetkisi gerekmez; sistem PATH'i değişmez, `env.sh` oturum başına ayarlar):

| Araç | Sürüm | Kaynak | Doğrulama |
|---|---|---|---|
| rustup-init (x86_64-pc-windows-gnu) | Rust **1.98.1** (2026-09-01) | `https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-gnu/rustup-init.exe` | SHA-256 `6d5b5709addc0122c916d8c810da8d8a7b086a5d64fa805ef404d506392aadc8` (yayımlanan `.sha256` ile aynı) |
| w64devkit (GCC 16.2.0) | **v2.10.0** | `https://github.com/skeeto/w64devkit/releases/download/v2.10.0/w64devkit-x64-2.10.0.7z.exe` | SHA-256 `18d0a4c71a166f8401ab6305781bec5882b40b5e06ba9807c61cb5f3b3c6325e` (GitHub yayın özeti ile aynı) |
| longfellow-zk | `main` **d5e6be77336933d50bf7f25a954f8ec273eb51ce** | `https://github.com/longfellow-zk/longfellow-zk` | — |

```bash
# 1) Araçlar (Git Bash; bir kez)
mkdir -p ~/tools/dl && cd ~/tools/dl
curl -sSfLO https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-gnu/rustup-init.exe   # + .sha256 ile karşılaştır
./rustup-init.exe -y --profile minimal --default-host x86_64-pc-windows-gnu --no-modify-path
curl -sSfLO https://github.com/skeeto/w64devkit/releases/download/v2.10.0/w64devkit-x64-2.10.0.7z.exe
./w64devkit-x64-2.10.0.7z.exe -o"C:\\Users\\<kullanıcı>\\tools" -y

# 2) Upstream (tamga-network kökünden)
git clone https://github.com/longfellow-zk/longfellow-zk experiments/zk-longfellow/vendor/longfellow-zk
git -C experiments/zk-longfellow/vendor/longfellow-zk checkout d5e6be77336933d50bf7f25a954f8ec273eb51ce
# Windows yaması: sha2-asm Windows'u desteklemiyor → yerelde `features = ["asm"]` kaldırılır (saf Rust SHA-256; sonuç aynı)
grep -rl --include=Cargo.toml 'features = \["asm"\]' experiments/zk-longfellow/vendor/longfellow-zk/rust \
  | xargs sed -i 's/, features = \["asm"\] }/ }/'

# 3) Derleme ve çalıştırma
source experiments/zk-longfellow/env.sh
RUSTFLAGS="$RUSTFLAGS -C target-cpu=native" CARGO_TARGET_DIR=~/tools/lf-target-native \
  cargo build --release --manifest-path experiments/zk-longfellow/tamga-zk/Cargo.toml
Z=~/tools/lf-target-native/release/tamga-zk.exe
npx tsx experiments/zk-longfellow/gen-fixtures.ts              # Tamga / ISO / "false" belgeleri + negatif girdiler
cd experiments/zk-longfellow/out
$Z circuit circuit-v8-1.zst                                      # devre (bir kez)
$Z prove  circuit-v8-1.zst tamga/mdoc.bin tamga/transcript.bin tamga/meta.json tamga/proof.bin
$Z verify circuit-v8-1.zst tamga/transcript.bin tamga/meta.json tamga/proof.bin
$Z bench  circuit-v8-1.zst tamga/mdoc.bin tamga/transcript.bin tamga/meta.json 5
cd ../../.. && bash experiments/zk-longfellow/negative-tests.sh && npx tsx experiments/zk-longfellow/bridge.ts
```

Windows'a özgü iki ayar (`env.sh`): w64devkit UCRT kullanır, Rust'ın GNU hedefi msvcrt bekler → `RUSTFLAGS="-C
link-self-contained=yes"` (Rust'ın kendi CRT nesneleri; gcc yalnız sürücü ve C derleyicisi). w64devkit'in BusyBox araçları
`grep`/`sed`'i gölgelemesin diye PATH'in sonuna eklenir.

## Dosyalar

| Dosya | Ne |
|---|---|
| `gen-fixtures.ts` | `@tamga-network/mdoc` ile gerçek DeviceResponse + SessionTranscript + negatif girdiler (`out/`, gitignore) |
| `tamga-zk/` | Longfellow `mdoc-zk-runtime` etrafında komut satırı: `circuit`, `prove`, `verify`, `bench` |
| `negative-tests.sh` | 11 kabul/red denemesi |
| `bridge.ts` | `@tamga-network/verifier` için Node köprüsü prototipi (transcript'i doğrulayıcı hesaplar; devre özet denetimi) |
| `check-compat.ts` | ilk bayt düzeyi uyumluluk denetimi (alan sınırları) |
| `env.sh` | kullanıcı klasörü araçları için oturum ayarı |

## Sonraki adımlar

| Aşama | İş | Önkoşul |
|---|---|---|
| 2 | Telefon: Rust çekirdeği → UniFFI (Kotlin/Swift) → Expo native modülü (`apps/wallet/modules/tamga-zk`); ARM'de PMULL/NEON açık; telefonda ölçüm | Mağaza derlemesi (Z1) |
| 3 | Doğrulayıcı: `@tamga-network/verifier`'da `mso_mdoc_zk` doğrulama (Node eklentisi ya da WASM); devre özeti imzalı güven listesinde | ADR-0032 kabulü |
| 4 | Taşıma: OpenID4VP DCQL `mso_mdoc_zk` (AB TS13) ve Digital Credentials API; AB örnek doğrulayıcısıyla karşılıklı test | Aşama 3 |

Karar belgesi: `docs/adr/0032-zk-mdoc-presentation.md`.
