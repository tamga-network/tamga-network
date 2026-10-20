---
document_id: ADR-0032
title: "Sıfır bilik sübutu (ZK)"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-07
summary: >
  Rəqəmsal cüzdan qurumların ES256 ilə imzalanmış mdoc rəqəmsal sənədlərini DƏYİŞDİRMƏDƏN, bu sənədlər haqqında Longfellow ZK ilə sıfır bilik sübutu yaradır (ilk predikat: 18 yaşdan yuxarı). Yoxlayan tərəf yalnız sübut olunan sahəni və sənədi verən qurumu görür; iki təqdimat bir-biri ilə əlaqələndirilə bilməz. Qəbul edilən sxemlər heşləri ilə birlikdə imzalı etibar siyahısında dərc olunur; daşınma OpenID4VP DCQL `mso_mdoc_zk` (Avropa İttifaqı (Aİ) TS13) və/və ya Digital Credentials API vasitəsilədir; sübut yaradıla bilmədikdə toplu nüsxə üsulu ehtiyat yoldur. Z5 Mərhələ 1 masaüstü uyğunluq ölçməsinə əsaslanır (`tools/zk-circuit/`).
domain: Identity
translation_of: ADR-0032
source_version: "1.0.0"
---

# Xülasə (sadə)

1. Sənədi verən qurumlar heç nəyi dəyişmir; rəqəmsal sənədlər bu gün olduğu kimi imzalanır.
2. Rəqəmsal cüzdan "18 yaşdan böyüyəm" kimi bir müddəanı doğum tarixini və sənədi göstərmədən sübut edir.
3. Eyni şəxsin iki təqdimatı bir-biri ilə əlaqələndirilə bilməz; sənəd nüsxələrinin sayı ilə bağlı məhdudiyyət aradan qalxır.
4. Üsul Avropanın yaş yoxlanışında qəbul etdiyi Longfellow ZK-dır; yalnız nəzərdən keçirilmiş və heşi ilə sabitlənmiş sxemlər etibarlıdır.
5. Sübut yaradıla bilmədikdə (köhnə telefon, dəstəkləməyən yoxlayan tərəf) toplu nüsxə üsulu davam edir.

# Kontekst

- Əlaqələndirilməzlik toplu nüsxələrlə də təmin olunur: şəxsiyyət [[t:credential|sənədindən]] 10 nüsxə, hər [[t:verifier]] üçün sabit nüsxə
  (WL5) və `age_over_18` sahəsi ([[ADR-0012]], [[ADR-0013]]). Bu, Aİ-nin bugünkü üsuludur; nüsxələr tükənir və yenilənir,
  [[t:issuer]] imzası hər nüsxədə görünür.
- Layihə rəhbərliyi 2026-09-28-də istiqaməti müəyyən etdi (backlog Z5): qurum sənədləri dəyişmədən, cüzdanda zk-SNARK; BBS izlənilmir
  (qurum açarının dəyişdirilməsini tələb edir; Aİ-nin təsdiqlənmiş alqoritmlər siyahısında yoxdur).
- [[t:Longfellow-ZK]]: Google-un açıq mənbəli (Apache-2.0) [[t:mdoc]]/ECDSA sübut sistemi; 2026-09-da müstəqil fonda köçürüldü
  (`github.com/longfellow-zk/longfellow-zk`), üç müstəqil təhlükəsizlik auditindən keçdi, Aİ yaş yoxlanışı profili və TS13 bu
  sistem üzərində qurulub. Etibarlı quraşdırma (trusted setup) tələb etmir. Sxem versiyası 8 docType-ı sübuta bağlayır; **namespace-i
  bağlamır** (Mərhələ 1 ölçməsi).
- **Z5 Mərhələ 1 — real sübut (2026-10-01, `tools/zk-circuit/`):** Tamga şəxsiyyət sənədi
  (`urn:tamga:id:IdentityAttestation:1`, namespace `tamga.id.1`, MSO-da `status`, bytewise CBOR ardıcıllığı) üzərində
  `age_over_18 = true` sübutu yaradıldı və yoxlandı; sənəddə dəyişiklik tələb olunmadı. Masaüstü (prosessora xüsusi kompilyasiya,
  5 icranın medianı): sübut **518 ms**, yoxlama **211 ms**, sübut **~343 KB**, sübut yaddaşı ~92 MB; sxem (v8, 1 sahə)
  deterministikdir, identifikatoru `5a893815…3c9291`. Ümumi x86-64 kompilyasiyasında sübut 3,6 s / yoxlama 1,4 s (PCLMUL/AVX2 söndürülmüş) — mobil
  kompilyasiyada hədəf prosessorun imkanları aktiv olmalıdır. Neqativ testlər: dəyişdirilmiş dəyər, yanlış qurum açarı, başqa sessiya/
  [[t:nonce]], başqa yoxlayan tərəf, "false" sənəddən "true", başqa docType, pozulmuş sübut → hamısı RƏDD. **Namespace sübuta bağlı
  deyil** (başqa namespace ilə yoxlama QƏBUL): v8 icra mühitində namespace yalnız ilkin yoxlamada istifadə olunur.

# Qərar

## K1 — Sübut sistemi (layihə rəhbərliyi: qəbul, 2026-10-01)
Longfellow ZK (`longfellow-libzk-v1`), sxem versiyası ≥ 8. İstinad reallaşdırması Google Rust (`rust/applications/mdoc_zk`); ISRG
`zk-cred-longfellow` ikinci reallaşdırma kimi qarşılıqlı test mərhələsindədir.

## K2 — Qəbul edilən sxemlər
Yoxlayan tərəf yalnız imzalı [[t:trust-list|etibar siyahısında]] (`lotl.jws`) dərc olunan sxem heşlərini (`combined_hash`, sahə sayına görə) qəbul
edir. Sxem yeniləməsi = siyahı yeniləməsi (ADR tələb etmir, CHANGELOG-da elan olunur).

## K3 — İlk predikat və əhatə (layihə rəhbərliyi: əvvəlcə 18 yaş, 2026-10-01)
İlk predikat şəxsiyyət sənədində `age_over_18 = true`. Sonra: `age_over_21`, `nationality`, təhsil sənədlərində tələbəlik /
məzun olma (bərabərlik predikatları). Aralıq və "hər hansı akkreditə olunmuş qurum" (qurumu gizlətmə) Longfellow-da hələ yoxdur — əhatədən kənardır.

## K4 — Daşınma
[[t:OpenID4VP]] [[t:DCQL]] `format: "mso_mdoc_zk"` (Aİ TS13 tələbi) və Digital Credentials API (Aİ yaş yoxlanışı profili). Sübut
~350 KB-dır: QR ilə daşınmır; yaxın məsafədə (BLE) ölçmədən sonra qərar veriləcək.

## K5 — Ehtiyat yol
Cüzdan sübut yarada bilmədikdə və ya yoxlayan tərəf `mso_mdoc_zk` tələb etmədikdə `mso_mdoc` / `dc+sd-jwt` təqdimatı (toplu nüsxə + WL5) olduğu kimi davam edir.
Toplu nüsxələr aradan qaldırılmır.

## K6 — Ləğv statusu
Sxem ləğv statusunu yoxlamır; [[t:status-list]] indeksini açmaq əlaqələndirilmə imkanını geri qaytarır. Müvəqqəti həll: ZK ilə təqdim olunan
sənədlər qısa ömürlüdür (səssiz yeniləmə, [[ADR-0023]]); gizli ləğv sübutu Aİ TS13-ün ləğv modeli dəqiqləşdikdən sonra ayrıca ADR ilə.
Siyasət bunu açıq şəkildə seçir: `accept_unrevocable_zk: true` ləğvi yoxlanıla bilməyən ZK təqdimatını bilərəkdən qəbul edir (nəticədə
`status.value = NOT_APPLICABLE` və `status.reason`); `false` olduqda isə nəticə YOXLANILA BİLMƏDİ olur (addım D1, `STATUS_UNREACHABLE`).

*Tətbiq qeydi (2026-10-09):* "qısa ömür" [[ADR-0044]] ilə müəyyən edildi: ZK təqdimatı yalnız ən çox 24 saat etibarlı olan, ləğv siyahısı
daşımayan və səssizcə yenilənən ZK nüsxələri ilə aparılır; əsas sənəd ləğv edilibsə və ya dayandırılıbsa, yeni nüsxə verilmir. Tətbiq edildi
(paketlər 0.4.0): ZK nüsxəsi ayrıca növdür (`urn:tamga:id:ShortLivedIdentityAttestation:1`), yoxlayan tərəf onu sübutdan tanıyır və ləğv
yoxlamasını gözləmir; `accept_unrevocable_zk: true` yalnız qısa ömürlü nüsxə olmayan (işarəsiz) ZK təqdimatı üçün mənalıdır.

## K7 — Cihaza bağlama
Sübut cihaz açarının SessionTranscript üzərindəki ES256 imzasını ehtiva edir və cihazın açıq açarını gizlədir; açar təhlükəsiz
aparat təminatında qalır (Secure Enclave / StrongBox), imzalama axını dəyişmir.

## K8 — Namespace bağlanmır: sahə adının unikallığı
Longfellow v8 sübutu qurum açarını, docType-ı, sahə adını və dəyəri bağlayır; namespace-i bağlamır. Yoxlayan tərəf "bu qurumun bu
növdəki sənədində, hansısa ad sahəsində `age_over_18 = true` var" faktını öyrənir. Buna görə bir sənəd növündə eyni sahə adı yalnız
bir ad sahəsində olur; şema kataloqu (`packages/schemas`) bunu kompilyasiya zamanı yoxlayır.

## K9 — Kompilyasiya
Mobil və server kompilyasiyası hədəf prosessorun GF(2^128) vurma əmrləri ilə aparılır (x86-64: PCLMULQDQ; ARM: PMULL/NEON); əks
halda sübut ~7× yavaşlayır (ölçmə).

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| **Longfellow ZK (bu ADR)** | **qəbul** | Qurumun sənədi dəyişmir; Aİ yaş yoxlanışı profili və TS13 ilə eynidir; trusted setup yoxdur; müstəqil auditdən keçib |
| BBS / BBS# imzaları | rədd | Qurum açarı və imza formatı dəyişir; Aİ-nin təsdiqlənmiş mexanizmlər siyahısında yoxdur (D-yön 2026-09-28) |
| Microsoft Crescent | izlənilir | Mövcud JWT/mdoc üzərində ZK; Aİ profili deyil |
| Yalnız toplu nüsxə | ehtiyat (K5) | İşləyir, lakin nüsxələr tükənir, qurum imzası hər təqdimatda eynidir |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| ZK1 | ZK təqdimatı üçün qurum sənədinin formatı və imzası dəyişdirilmir; ZK yalnız cüzdanda və yoxlayan tərəfdədir. |
| ZK2 | Yoxlayan tərəf yalnız imzalı etibar siyahısında dərc olunan və statusu ACTIVE olan sxem heşlərini qəbul edir; naməlum və ya aktiv olmayan sxem = RƏDD. |
| ZK3 | ZK təqdimatı yalnız DCQL-də tələb olunan sahələri sübut edir; sübutdan kənar sahə yoxlayan tərəfə ötürülmür. |
| ZK4 | ZK təqdimatında ləğv siyahısı indeksi açılmır; ZK ilə təqdim olunan sənədin etibarlılıq müddəti qısa saxlanılır (K6). |
| ZK5 | ZK dəstəklənmirsə, təqdimat klassik qaydalarla (WL5 daxil) aparılır; sübut xətası istifadəçiyə "hazırda bu yolla göstərilə bilmir" kimi əks olunur, məlumat sızdırmır. |
| ZK6 | Bir sənəd növündə bir sahə adı yalnız bir ad sahəsində olur (K8). |

# Tətbiq planı

| Mərhələ | İş | İlkin şərt |
|---|---|---|
| 1 | ✅ Masaüstündə real sübut + yoxlama, ölçmələr, neqativ testlər, Node körpüsü prototipi (2026-10-01) | — |
| 2a | ✅ `@tamga-network/zk`: sübut generatoru paketi — nüvə (DCQL → elementlər, sxem seçimi və ZK2 yoxlaması, ZkDocument), masaüstü sübut generatoru (`/node`, Rust alt prosesi), telefon modulu karkası (`/react-native`, Expo; Rust C ABI / JNI); uçdan-uca test: paketin sübutu şəbəkənin yoxlayan tərəfindən keçir (2026-10-06) | Mərhələ 1, 3 |
| 2b | Telefon kitabxanalarının kompilyasiyası və cihazda ölçmə: Android ✅ (2026-10-07; arm64-v8a, armeabi-v7a, x86_64), iOS xcframework gözləmədədir (macOS); cihaz ölçməsi mağaza kompilyasiyası ilə | macOS (iOS) |
| 2c | ✅ Cüzdan inteqrasiyası (2026-10-06): `wallet-core` `mso_mdoc_zk` sorğusunu mdoc kimi uyğunlaşdırır, adi cihaz imzalı cavabı sübut generatorunun hook-una (`RespondInput.zk`) ötürür, vp_token-ə yalnız sübut daxil olur; sübut generatoru yoxdursa, ZK sorğusu təklif edilmir, `credential_sets`-də klassik variant seçilir (ZK5). Tamga Wallet hook-u `@tamga-network/zk` ilə qoşdu; telefon kitabxanaları və sxem faylları gələnə qədər (2b) sübut söndürülmüş qalır | 2b; mağaza kompilyasiyası (Z1) |
| 3 | ✅ `@tamga-network/verifier`: `mso_mdoc_zk` yoxlama (paketlə gələn WASM, `/zk`); sxem heşləri etibar siyahısında (`lotl.zk_circuits`); siyasət `format: "mso_mdoc_zk"`; Tamga Verify `age-over-18-zk` (2026-10-01) | Mərhələ 1 |
| 4 | Daşınma (DCQL + DC API), Aİ nümunə yoxlayan tərəfi ilə qarşılıqlı test; `/docs/selective-disclosure` və SPEC-WALLET-0001 yeniləməsi | Mərhələ 3 |

## Sübut generatoru paketi (Mərhələ 2)

Sübutun yaradılması cüzdanın deyil, şəbəkənin açıq paketidir (`@tamga-network/zk`): şəbəkə qaydalarına uyğun hər cüzdan eyni sübut generatorundan istifadə edir
([[ADR-0035]]). Paketin üç giriş nöqtəsi var: təmiz TS nüvəsi (React Native ilə uyğun) DCQL `mso_mdoc_zk` sorğusunu sübut ediləcək elementlərə
çevirir, etibar siyahısından sxemi seçir və onun baytlarını heşlə yoxlayır (ZK2), sübutu TS13 `ZkDocument` kimi paketləyir; `/react-native`
telefonda lokal sübut generatorudur (Expo modulu `TamgaZk`, Rust nüvəsi C ABI ilə — Android-də JNI); `/node` eyni Rust kodunu masaüstündə alt
proses kimi işlədir (test, uyğunluq sınağı). Rust nüvəsi yoxlayan tərəflə eyni upstream commit-ə sabitlənib. Cüzdan əvvəlcə həmin sessiyanın
adi, cihaz imzalı DeviceResponse-unu yaradır (aparat açarı və telefon kilidi — WL11 olduğu kimi); sübut generatoru bu cavabı giriş verilənləri kimi qəbul edir,
yoxlayan tərəfə yalnız sübut ötürülür. Sübut generatoru yoxdursa (`available() === false`), təqdimat adi yolla aparılır (ZK5). Sxem faylları tətbiqlə birlikdə
gələ və ya şəbəkədən endirilə bilər; hər halda siyahıdakı heşlə yoxlanılır.

## Yoxlayan tərəf (Mərhələ 3)

Yoxlayan tərəf Longfellow-un yalnız YOXLAMA kodunu WebAssembly-yə kompilyasiya edir (`packages/verifier/zk`, upstream-də sabitlənmiş commit `d5e6be77`;
C asılılığı `zstd` təmiz Rust ara qatı ilə yamaqlanıb, upstream koduna toxunulmur; kompilyasiya təkrarlana biləndir,
`npm run zk:build -- --check`). WASM 889 KB-dır, xarici asılılığı yoxdur; yoxlama masaüstündə ~3 san çəkir (yerli kompilyasiya 0,2 san — K9; sürət
lazım olarsa, `VerifyInput.zk` ilə yerli backend). Format `mso_mdoc_zk` (TS13 ZkDocument), addım `Z1` ([[SPEC-API-0001]]), sxemlər
`lotl.zk_circuits` ([[SPEC-TRUST-0001]]). Testlər real sübut fiksturu ilə işləyir (`scripts/zk-fixtures.ts`); Rust tələb etmir.
Yoxlayan tərəfdə infrastruktur xətası (sxem faylı yoxdur, WASM yüklənə bilmir) təqdimatın günahı deyil: nəticə YOXLANILA BİLMƏDİ
(`SDK_VERSION_MISMATCH`) olur, RƏDD deyil. "prefer" rejimini (DCQL `credential_sets` ilə ZK + klassik variant) rəqəmsal cüzdan tərəfi dəstəkləyir
(Mərhələ 2c: sübut generatoru olmayan rəqəmsal cüzdan klassik variantı seçir); Tamga Verify bu gün ZK və klassik siyasətləri ayrıca təqdim edir, ZK5 =
yoxlayan tərəfin klassik siyasətlə (`age-over-18-mdoc`) yenidən sorğu göndərməsi.

## Yerli backend (K9)

Eyni Rust mənbəyindən `--features native` ilə `tamga-zk-verify` binar faylı (WASM çıxışı dəyişmir; `rust-toolchain.toml` 1.98.1
sabitlənib). `NativeZkBackend` binar faylı uzunömürlü alt proses kimi işlədir (stdin/stdout çərçivəli; şəbəkə/fayl yoxdur); binar fayl yoxdursa,
çökərsə və ya vaxt limiti aşılarsa, sorğu WASM-a keçir, xəta "etibarlı" sayılmır; sxem həşi (ZK2) hər iki yolda Node tərəfində
yoxlanılır. Tamga Verify bunu `TAMGA_ZK_NATIVE_BIN` ilə istifadə edir; serverdə kompilyasiya `deploy.sh` 4b (yalnız mənbə dəyişdikdə). Ölçmə
(masaüstü, tam konveyer): yerli median 289 ms; WASM eyni yükdə ~4 s.

# Qərara alınmış suallar (layihənin idarə edilməsi, 2026-10-01)

1. **Longfellow ZK sübut sistemi kimi qəbul edilir** (K1).
2. **Quraşdırma:** istifadəçi səviyyəli alətlər (Rust + portativ kompilyator) kifayət etdi; administrator quraşdırması tələb olunmadı.
3. **İlk predikat:** yalnız "18 yaşdan yuxarı"; tələbəlik statusu növbəti mərhələdə.

# Status

**Accepted — 2026-10-01** (layihə rəhbərliyinin təsdiqi: sübut sistemi Longfellow, ilk predikat `age_over_18`). Mərhələ 1 masaüstü sınağı
və Mərhələ 3 (yoxlayan tərəf) tamamlanıb; Mərhələ 2a/2c tamamlanıb, 2b-də Android yerli kitabxanası kompilyasiya edilib (2026-10-07), iOS xcframework və
cihaz ölçməsi gözləyir (mağaza kompilyasiyası, Z1). Eksperiment: `tools/zk-circuit/README.md`.
