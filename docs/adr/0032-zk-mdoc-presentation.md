---
document_id: ADR-0032
title: "Sıfır bilgi ispatı (ZK)"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-06
summary: >
  Cüzdan, kurumların ES256 imzalı mdoc belgelerini DEĞİŞTİRMEDEN, bu belgeler hakkında Longfellow ZK ile sıfır bilgi
  ispatı üretir (ilk yüklem: 18 yaş üstü). Doğrulayıcı yalnız ispatlanan alanı ve belge vereni görür; iki gösterim birbirine
  bağlanamaz. Kabul edilen devreler özetleriyle imzalı güven listesinde yayımlanır; taşıma OpenID4VP DCQL `mso_mdoc_zk` (AB TS13)
  ve/veya Digital Credentials API; ispat yapılamazsa toplu kopya yöntemi yedektir. Z5 Aşama 1 masaüstü uyum ölçümüne dayanır
  (`tools/zk-circuit/`).
domain: Identity
---

# Özet (sade)

1. Belge veren kurumlar hiçbir şey değiştirmez; belgeler bugünkü gibi imzalanır.
2. Cüzdan "18 yaşından büyüğüm" gibi bir cümleyi, doğum tarihini ve belgeyi göstermeden ispatlar.
3. Aynı kişinin iki gösterimi birbirine bağlanamaz; belge kopyası sınırı kalkar.
4. Yöntem Avrupa'nın yaş doğrulamada kabul ettiği Longfellow ZK'dır; yalnız incelenmiş ve özetiyle sabitlenmiş devreler geçerlidir.
5. İspat yapılamazsa (eski telefon, desteklemeyen doğrulayıcı) toplu kopya yöntemi sürer.

# Bağlam

- Bağlanamazlık toplu kopyalarla da sağlanıyor: kimlik [[t:credential|belgesinden]] 10 kopya, [[t:verifier]] başına yapışkan kopya
  (WL5) ve `age_over_18` alanı ([[ADR-0012]], [[ADR-0013]]). Bu AB'nin bugünkü yöntemidir; kopyalar tükenir ve yenilenir,
  [[t:issuer]] imzası her kopyada görünür.
- Proje yönetimi 2026-09-28'de yönü belirledi (backlog Z5): kurum belgeleri değişmeden, cüzdanda zk-SNARK; BBS izlenmez
  (kurum anahtarı değişimi ister; AB onaylı algoritma listesinde yok).
- [[t:Longfellow-ZK]]: Google'ın açık kaynak (Apache-2.0) [[t:mdoc]]/ECDSA ispat sistemi; 2026-09'da bağımsız vakfa taşındı
  (`github.com/longfellow-zk/longfellow-zk`), üç bağımsız güvenlik incelemesinden geçti, AB yaş doğrulama profili ve TS13 bu
  sistem üzerine kurulu. Güvenilir kurulum (trusted setup) gerektirmez. Devre sürümü 8 docType'ı ispatta bağlar; **namespace'i
  bağlamaz** (Aşama 1 ölçümü).
- **Z5 Aşama 1 — gerçek ispat (2026-10-01, `tools/zk-circuit/`):** Tamga kimlik belgeyi
  (`urn:tamga:id:IdentityAttestation:1`, namespace `tamga.id.1`, MSO'da `status`, bytewise CBOR sırası) üzerinde
  `age_over_18 = true` ispatı üretildi ve doğrulandı; belgede değişiklik gerekmedi. Masaüstü (işlemciye özel derleme,
  5 çalıştırma ortancası): ispat **518 ms**, doğrulama **211 ms**, ispat **~343 KB**, ispat belleği ~92 MB; devre (v8, 1 alan)
  belirlenimci, kimlik `5a893815…3c9291`. Genel x86-64 derlemede ispat 3,6 s / doğrulama 1,4 s (PCLMUL/AVX2 kapalı) — mobil
  derlemede hedef işlemci özellikleri açık olmalı. Negatif testler: kurcalanmış değer, yanlış kurum anahtarı, başka oturum/
  [[t:nonce]], başka doğrulayıcı, "false" belgeden "true", başka docType, bozulmuş ispat → hepsi RED. **Namespace ispata bağlı
  değil** (başka namespace ile doğrulama KABUL): v8 çalışma zamanında namespace yalnız ön denetimde kullanılıyor.

# Karar

## K1 — İspat sistemi (proje yönetimi: kabul, 2026-10-01)
Longfellow ZK (`longfellow-libzk-v1`), devre sürümü ≥ 8. Referans uygulama Google Rust (`rust/applications/mdoc_zk`); ISRG
`zk-cred-longfellow` ikinci uygulama olarak karşılıklı testte.

## K2 — Kabul edilen devreler
Doğrulayıcı yalnız imzalı [[t:trust-list|güven listesinde]] (`lotl.jws`) yayımlanan devre özetlerini (`combined_hash`, alan sayısı başına) kabul
eder. Devre güncellemesi = liste güncellemesi (ADR gerektirmez, CHANGELOG'da duyurulur).

## K3 — İlk yüklem ve kapsam (proje yönetimi: önce 18 yaş, 2026-10-01)
İlk yüklem kimlik belgesinde `age_over_18 = true`. Sonra: `age_over_21`, `nationality`, eğitim belgelerinde öğrencilik /
mezuniyet (eşitlik yüklemleri). Aralık ve "herhangi bir akredite kurum" (kurumu gizleme) Longfellow'da henüz yok — kapsam dışı.

## K4 — Taşıma
[[t:OpenID4VP]] [[t:DCQL]] `format: "mso_mdoc_zk"` (AB TS13 isteği) ve Digital Credentials API (AB yaş doğrulama profili). İspat
~350 KB: QR ile taşınmaz; yakın alanda (BLE) ölçüm sonrası karar.

## K5 — Yedek yol
Cüzdan ispat üretemezse ya da doğrulayıcı `mso_mdoc_zk` istemezse `mso_mdoc` / `dc+sd-jwt` sunumu (toplu kopya + WL5) aynen sürer.
Toplu kopyalar kaldırılmaz.

## K6 — İptal durumu
Devre iptal durumunu denetlemez; [[t:status-list]] indeksini açmak bağlanabilirliği geri getirir. Geçici çözüm: ZK ile sunulan
belgeler kısa ömürlüdür (sessiz yenileme, [[ADR-0023]]); gizli iptal kanıtı AB TS13'ün iptal şeması netleşince ayrı ADR.

## K7 — Cihaz bağlaması
İspat, cihaz anahtarının SessionTranscript üzerindeki ES256 imzasını içerir ve cihaz açık anahtarını gizler; anahtar güvenli
donanımda kalır (Secure Enclave / StrongBox), imzalama akışı değişmez.

## K8 — Namespace bağlanmaz: alan adı tekliği
Longfellow v8 ispatı kurum anahtarını, docType'ı, alan adını ve değeri bağlar; namespace'i bağlamaz. Doğrulayıcı "bu kurumun bu
türdeki belgesinde, bir ad alanında `age_over_18 = true` var" öğrenir. Bu yüzden bir belge türünde aynı alan adı yalnız
bir ad alanında bulunur; şema kataloğu (`packages/schemas`) bunu derlemede denetler.

## K9 — Derleme
Mobil ve sunucu derlemesi hedef işlemcinin GF(2^128) çarpma komutlarıyla yapılır (x86-64: PCLMULQDQ; ARM: PMULL/NEON); aksi
hâlde ispat ~7× yavaşlar (ölçüm).

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| **Longfellow ZK (bu ADR)** | **kabul** | Kurum belgeyi değişmez; AB yaş doğrulama profili ve TS13 ile aynı; trusted setup yok; bağımsız incelenmiş |
| BBS / BBS# imzaları | ret | Kurum anahtarı ve imza biçimi değişir; AB onaylı mekanizma listesinde yok (D-yön 2026-09-28) |
| Microsoft Crescent | izle | Mevcut JWT/mdoc üzerinde ZK; AB profili değil |
| Yalnız toplu kopya | yedek (K5) | Çalışıyor ama kopya tükenir, kurum imzası her gösterimde aynı |

# Değişmezler

| Kod | Kural |
|---|---|
| ZK1 | Kurum belgesinin biçimi ve imzası ZK sunumu için değiştirilmez; ZK yalnız cüzdanda ve doğrulayıcıda. |
| ZK2 | Doğrulayıcı yalnız imzalı güven listesinde yayımlanan devre özetlerini kabul eder; bilinmeyen devre = RED. |
| ZK3 | ZK sunumu yalnız DCQL'de istenen alanları ispatlar; ispat dışı alan doğrulayıcıya gitmez. |
| ZK4 | ZK sunumunda iptal listesi indeksi açılmaz; ZK ile sunulan belgenin geçerlilik süresi kısa tutulur (K6). |
| ZK5 | ZK desteklenmezse sunum klasik kurallarla (WL5 dahil) yapılır; ispat hatası kullanıcıya "şu an bu yolla gösterilemiyor" diye yansır, veri sızdırmaz. |
| ZK6 | Bir belge türünde bir alan adı yalnız bir ad alanında bulunur (K8). |

# Uygulama planı

| Aşama | İş | Önkoşul |
|---|---|---|
| 1 | ✅ Masaüstünde gerçek ispat + doğrulama, ölçümler, negatif testler, Node köprüsü prototipi (2026-10-01) | — |
| 2a | ✅ `@tamga-network/zk`: ispatçı paketi — çekirdek (DCQL → öğeler, devre seçimi ve ZK2 denetimi, ZkDocument), masaüstü ispatçı (`/node`, Rust alt süreç), telefon modülü iskeleti (`/react-native`, Expo; Rust C ABI / JNI); uçtan uca test: paketin ispatı ağın doğrulayıcısından geçer (2026-10-06) | Aşama 1, 3 |
| 2b | Telefon kütüphanelerinin derlenmesi (Android NDK, iOS xcframework) ve cihazda ölçüm | Android NDK; macOS |
| 2c | Cüzdan bağlantısı: `wallet-core` sunum akışında `mso_mdoc_zk` sorgusunu ispatçıya yönlendirme; Tamga Wallet'ta etkinleştirme | Mağaza derlemesi (Z1) |
| 3 | ✅ `@tamga-network/verifier`: `mso_mdoc_zk` doğrulama (paketle gelen WASM, `/zk`); devre özetleri güven listesinde (`lotl.zk_circuits`); politika `format: "mso_mdoc_zk"`; Tamga Verify `age-over-18-zk` (2026-10-01) | Aşama 1 |
| 4 | Taşıma (DCQL + DC API), AB örnek doğrulayıcıyla karşılıklı test; `/docs/selective-disclosure` ve SPEC-WALLET-0001 güncellemesi | Aşama 3 |

## İspatçı paketi (Aşama 2)

İspat üretimi ağın açık paketidir (`@tamga-network/zk`), cüzdanın değil: ağ kurallarına uyan her cüzdan aynı ispatçıyı kullanır
([[ADR-0035]]). Paket üç girişlidir: saf TS çekirdek (React Native uyumlu) DCQL `mso_mdoc_zk` sorgusunu ispatlanacak öğelere
çevirir, güven listesinden devreyi seçer ve baytlarını özetle denetler (ZK2), ispatı TS13 `ZkDocument` olarak paketler; `/react-native`
telefonda yerel ispatçıdır (Expo modülü `TamgaZk`, Rust çekirdeği C ABI ile — Android'de JNI); `/node` aynı Rust kodunu masaüstünde alt
süreç olarak çalıştırır (test, uyum denemesi). Rust çekirdeği doğrulayıcıyla aynı upstream commit'e sabitlidir. Cüzdan önce o oturumun
olağan, cihaz imzalı DeviceResponse'unu üretir (donanım anahtarı ve telefon kilidi — WL11 aynen); ispatçı bu yanıtı girdi olarak alır,
doğrulayıcıya yalnız ispat gider. İspatçı yoksa (`available() === false`) sunum olağan yoldan yapılır (ZK5). Devre dosyaları uygulamayla
gelebilir ya da ağdan indirilebilir; her durumda listedeki özetle denetlenir.

## Doğrulayıcı (Aşama 3)

Doğrulayıcı Longfellow'un yalnız DOĞRULAMA kodunu WebAssembly'e derler (`packages/verifier/zk`, upstream sabit commit `d5e6be77`;
C bağımlılığı `zstd` saf Rust ara katmanla yamalı, upstream koduna dokunulmaz; derleme tekrarlanabilir,
`npm run zk:build -- --check`). WASM 889 KB, dışa bağımlılık yok; doğrulama masaüstünde ~3 sn (yerel derleme 0,2 sn — K9; hız
gerekirse `VerifyInput.zk` ile yerel arka uç). Format `mso_mdoc_zk` (TS13 ZkDocument), adım `Z1` ([[SPEC-API-0001]]), devreler
`lotl.zk_circuits` ([[SPEC-TRUST-0001]]). Testler gerçek ispat fikstürüyle (`scripts/zk-fixtures.ts`); Rust gerektirmez.
"prefer" kipi (DCQL `credential_sets` ile ZK + klasik seçenek) cüzdan desteğiyle (Aşama 2) gelir; o zamana kadar ZK5 =
doğrulayıcının klasik politikayla yeniden sorması.

## Yerel arka uç (K9)

Aynı Rust kaynağından `--features native` ile `tamga-zk-verify` ikilisi (WASM çıktısı değişmez; `rust-toolchain.toml` 1.98.1
sabit). `NativeZkBackend` ikiliyi uzun ömürlü alt süreç olarak çalıştırır (stdin/stdout çerçeveli; ağ/dosya yok); ikili yoksa,
çökerse ya da süre aşılırsa istek WASM'a düşer, hata "geçerli" sayılmaz; devre özeti (ZK2) iki yolda da Node tarafında
denetlenir. Tamga Verify `TAMGA_ZK_NATIVE_BIN` ile kullanır; sunucuda derleme `deploy.sh` 4b (yalnız kaynak değişince). Ölçüm
(masaüstü, tam hat): yerel ortanca 289 ms; WASM aynı yükte ~4 s.

# Karara bağlanan sorular (proje yönetimi, 2026-10-01)

1. **Longfellow ZK ispat sistemi olarak kabul** (K1).
2. **Kurulum:** kullanıcı düzeyi araçlar (Rust + taşınabilir derleyici) yeterli oldu; yönetici kurulumu gerekmedi.
3. **İlk yüklem:** yalnız "18 yaş üstü"; öğrencilik sonraki turda.

# Durum

**Accepted — 2026-10-01** (proje yönetimi onayı: ispat sistemi Longfellow, ilk yüklem `age_over_18`). Aşama 1 masaüstü denemesi
ve Aşama 3 (doğrulayıcı) tamam; Aşama 2 (telefon) mağaza derlemesinden (Z1) sonra. Deney: `tools/zk-circuit/README.md`.
