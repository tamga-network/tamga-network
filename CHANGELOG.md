# Değişiklik günlüğü — tamga-network

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/); paketler SemVer. Henüz npm'e yayın yapılmadı; tüm paketler `0.1.0`.
Tur tur ayrıntı `STATUS.md`'de.

## [Yayınlanmadı]

### Değişti (2026-10-01 — ARF 0.7: federasyon ve AB PID)
- Tamga ARF 0.7 (yerinde güncellendi, yeniden donduruldu): Ek A §6.1 dış listeler (adres, sabit imzacı, kapsam, onay; ayrı
  tazelik; FD1–FD5), ana belge §6.2 kısa paragraf, Ek C kimlik §10 AB PID + mDL dış tür, iç içe seçici açıklama, Tamga ↔ AB PID
  alan eşlemesi. FW-ARF-0001, FW-TF-0001, FW-RB-0003 0.3.1.

### Eklendi (2026-10-01 — güven federasyonu ve AB PID doğrulama; ADR-0036, D-TRUST-2)
- `@tamga-network/trust`: LOTL `external_lists[]` (dış liste işaretçisi: adres, LOTL'da sabit imzacı, kapsam, onay kaydı);
  ETSI TS 119 602 LoTE JSON okuyucusu (`parseLote`); kapsam denetimi (FD2), her dış listenin kendi tazeliği (FD3), sıra geri
  sarma reddi; `TrustSource` `externalIssuerByAnchor` · `externalAnchorCertsDer` · `walletProviderMinKeyStorage`;
  dizin yükleyici `dist/external/`, HTTP kaynağında `externalLists` seçeneği. Bugün LOTL'da dış liste yok.
- Yayıncı: kayıttaki dış listeler doğrulanıp LOTL'a yazılır (yer tutucu ya da onay kaydı eksikse yayın durur);
  `npm run trust:external` kopyaları çeker ve sabit imzacıya karşı doğrular.
- `@tamga-network/verifier`: dış listedeki çapa üzerinden kurum çözümü (B2/C dış yol, `schema.status = EXTERNAL`); dış türler
  `urn:eudi:pid:1`, `eu.europa.ec.eudi.pid.1`, `org.iso.18013.5.1.mDL` (`@tamga-network/schemas` `EXTERNAL_TYPES`);
  E2/E3 ve DCQL'de iç içe yollar. Tamga Verify dış çapaları kök kümesine ekler.
- İç içe seçici açıklama (RFC 9901 §7.1): `@tamga-network/core/sd-structure` (tek kural; doğrulayıcı, `sd-jwt`, wallet-core).
- `@tamga-network/issuer`: `stricterKeyStorage`, dış sağlayıcının kapsamındaki anahtar deposu kuralı (`minKeyStorageFor`).
- Testler: sentetik dış LoTE ile federasyon uyum testleri (kabul, kapsam dışı, imzacı uyuşmazlığı, bayat liste, tanınmama,
  bilinmeyen sürüm, dış cüzdan sağlayıcısı, kurcalanmış disclosure); iç içe açıklama birim testleri.
- Belgeler: ADR-0036; SPEC-TRUST-0001 1.2.0, SPEC-API-0001 1.7.0, SPEC-CRED-0002 1.4.0, SPEC-PROTO-0002 1.2.2.

### Değişti (2026-10-01 — Tamga ARF 0.7)
- Tamga ARF AB ARF düzeninde, insanın okuyacağı biçimde yeniden yapılandırıldı: ana belge (FW-ARF-0001 0.3.0) kullanım
  durumları → roller → mimari → veri modeli → güven modeli (federasyon, ADR-0035) → güvenlik → yönetişim.
- Yeni Ek D — Tanımlar (FW-DEF-0001) ve Ek E — Kaynaklar (FW-REF-0001); eklerdeki kaynak sütunları ve metin içi belge
  kimlikleri Ek E'ye taşındı (117 kural kaynağıyla), iç yollar ve eski konumlandırma ifadeleri kaldırıldı; kural metinleri
  değişmedi. FW-TF-0001 0.3.0, FW-RB-0001 0.4.0, FW-RB-0002 0.2.0, FW-RB-0003 0.3.0, FW-RB-0004 0.2.0; MASTER_INDEX eşit.
- Ek A yönetişim tablosu ADR-0035'e göre: bugün Tamga geçici işletmeci; yönetişim kurumu devletler katılınca.

### Değişti (2026-10-01 — docs.tamga.network yeniden düzenlendi)
- Stripe benzeri yapı: üst menü Başlarken · Kavramlar · API · SDK'lar · Spesifikasyonlar · Sürüm notları; her bölümün kendi
  kenar çubuğu; rol kartlı ana sayfa ve "beş dakikada doğrulama" örneği; yeni **Kavramlar** bölümü (güven listeleri ve
  federasyon, belge biçimleri, verme, gösterme, gizlilik, iptal); sürüm notları sayfası (bu dosyadan).
- Yayından kalkanlar (depoda duruyor): akademi, proje hafızası, araştırma (EBSI dahil), DID yöntemi, escrow ve ajan
  spesifikasyonları, zincir kontratları, zincir-önce mimari belgeleri, sunucu envanteri, kök kayıtlardan DECISIONS / MASTER_INDEX
  / DOCUMENTATION-STANDARD / SCENARIOS. Yayında olmayan belgeye verilen atıflar GitHub'daki kaynağa gider. Yayın 98 → 78 sayfa.
- GUIDE-0000 0.2.2 (durum tablosu).

### Eklendi (2026-10-01 — "Paylaştığım kurumlar")
- Cüzdan: "Paylaştığım kurumlar" ekranı (`/shared`; Ayarlar ve Geçmiş'ten). Her doğrulayıcı için kurum adı ve kayıt durumu
  (imzalı güven listesinden), son paylaşım, sayı, paylaşılan alan adları (değer yok), bu sitedeki takma ad, bütün istekler;
  silme talebi (TS7) ve veri koruma kurumuna bildirim (TS8) aynı akışlarla. wallet-core `sharedWith()` (+ test).

### Eklendi (2026-10-01 — mağaza inceleme kodu, ADR-0033)
- Mağaza incelemesi DEMO imzacısı `ops/pki/issuer-id-review` (dev PKI); güven listesi başvurusu
  `apps/trust-publisher/registry/pending/tamga-id-review.issuer.json` (I1; kurum kimlik numarası girilince kaydedilir).
- Kayıt aracı `[DOLDURULACAK]` taşıyan kurum / doğrulayıcı başvurusunu reddeder.
- Tamga Verify `review-age-over-18`, `review-site-signup` (I1); örnek sitede "DEMO belgeyle kayıt ol"; cüzdanda DEMO kartı.
- Kimlik şeması `verification_method`: `review-demo` (geliştirme evresi, ADR-0029). FW-RB-0003 0.2.1, Tamga ARF 0.6;
  SPEC-ID-0003 1.1.1 (§9.2); ADR-0033 1.0.1 (uygulama notu). Test: DEMO belge gerçek (I2) politikada E1 RED.

### Düzeltildi
- ARF yayın kaydı en yeni üstte sıralanır (0.5 sona eklenmişti).

### Değişti (2026-10-01 — HAIP 1.0: x509_hash istemci kimliği, WIA sub; ADR-0034 / D-PROTO-2)
- Doğrulayıcı istemci kimliği yalnız **`x509_hash`** (HAIP 1.0 §5, OpenID4VP 1.0 §5.9.3): `pemRpSigner(anahtar, sertifika)`
  erişim sertifikasından hesaplar (üçüncü parametre kalktı; `@tamga-network/core` `x509HashClientId`). Cüzdan `x509_san_dns`'i
  reddeder; yanıt adresinin alanı imzalayan sertifikanın SAN'ında olmalı.
- Güven listesi RP kaydı: zorunlu **`dns_name`** (kalıcı kimlik, SAN'da — yayıncı denetler), `client_id` yayıncı tarafından
  sertifikadan; `TrustSource.relyingPartyByDnsName()`; kayıt aracı `scope <dns_name>`; aracı ilişkileri alan adıyla.
- Kopya ayrımı, takma ad (ADR-0031 1.0.2), sunum günlüğü ve geçiş kartı `aud`'u (ADR-0012 1.0.1) kalıcı `dns_name`'e bağlı
  (`stableRpKey`): sertifika yenilemesi hesapları ve kartları bozmaz. `PassRegistry(signer, store, audience)`.
- WIA `sub` = cüzdan çözümünün kimliği, bütün örneklerde ortak (HAIP 1.0 §4.4.1; ADR-0025 1.0.2).
- Belgeler: SPEC-PROTO-0002 1.2.1, SPEC-TRUST-0001 1.1.7, GUIDE-0001 0.2.1, GUIDE-0002 0.2.2, GUIDE-0006 0.2.1, FW-ARF-0001
  0.2.2, FW-TF-0001 0.2.2, FW-RB-0001 0.3.1, ADR-0017 1.0.2; **Tamga ARF 0.5**; INVARIANTS 318 kod (CI1–CI6); uyum vektörleri
  sürüm 2; `ops/README` sertifika yenileme sırası (önce liste, sonra sunucu).

### Eklendi (2026-10-01 — veri silme, izin metinleri, hızlı ZK doğrulaması)
- Cüzdan sağlayıcısı `POST /units/delete` (PoP; birim iptal + kayıt silinir; metadata `unit_deletion_endpoint`); wallet-core
  `deleteUnit`, `requestIdentityErasure`; cüzdanda "Cüzdanı sıfırla ve verilerimi sil" (Tamga servislerinde + cihazda; ağ
  yoksa bildirim). iOS izin metinleri İngilizce temel + `locales` (tr). SPEC-WALLET-0001 1.4.0 §7.6, SPEC-ID-0003 1.1.0 §9.1,
  ADR-0025 1.0.1; ADR-0033 (Proposed) mağaza inceleme kodu.
- `NativeZkBackend` + `tamga-zk-verify` (`packages/verifier/zk --features native`): uzun ömürlü alt süreç, yanıt vermezse WASM'a
  düşer; Tamga Verify `TAMGA_ZK_NATIVE_BIN`. Tam hatta ortanca 289 ms (WASM ~3 s). `rust-toolchain.toml` 1.98.1 sabit; WASM
  çıktısı değişmedi. ADR-0032 1.0.2, GUIDE-0002 0.2.1.

### Düzeltildi (2026-10-01)
- RS-EIDAS-0001 0.2.1, RS-EBSI-0001 0.1.2: taşınan AB/EBSI bağlantıları resmî adreslerle; üçüncü taraf özet yerine ARF §6.
- `@tamga-network/verifier/zk` alt yolu vitest ve tsconfig takma adlarına eklendi.

### Eklendi (2026-10-01 — Z5 Aşama 3: sıfır bilgi ispatı doğrulayıcı tarafı)
- `@tamga-network/verifier`: `mso_mdoc_zk` formatı (AB TS13 `ZkDocument`) ve **Z1** adımı (SPEC-API-0001 1.6.0); `/zk` alt yolu
  (`WasmZkBackend`, `verifyMdocZkFormat`); politika `format: "mso_mdoc_zk"` (yalnız eşitlik), `dcqlFromPolicy(p, { zkCircuits })`
  → `meta.zk_system_type`; `VerifyInput.zk` (takılabilir arka uç). Paketle gelen Longfellow WASM doğrulayıcısı (889 KB;
  `npm run zk:build`, tekrarlanabilir; upstream `d5e6be77`, `zstd` saf Rust ara katmanla) ve devre v8/1 dosyası.
- `@tamga-network/mdoc`: `buildZkDeviceResponse` / `parseZkDeviceResponse` (ZkDocument; cüzdan Aşama 2'de aynı kurucuyu kullanır).
- `@tamga-network/trust`: `lotl.zk_circuits[]` (SPEC-TRUST-0001 1.1.6), `TrustSource.zkCircuit()/zkCircuits()`; yayıncı kaynaktan geçirir.
- `apps/verify`: `age-over-18-zk` politikası; istek imzalı listedeki devreleri önerir.
- Yayın betiği (`scripts/pack-packages.mjs`): derlenmeyen çalışma zamanı dosyaları (.wasm/.zst/.json) src → lib; fikstürler hariç.
- GUIDE-0002 0.2.0 (ZK yaş doğrulama bölümü), ADR-0032 1.0.1 (uygulama notu). `SPEC_VERSION` = SPEC-API-0001@1.6.0.

### Eklendi (2026-10-01 — Z5 Aşama 1: gerçek sıfır bilgi ispatı)
- `experiments/zk-longfellow/`: Longfellow ZK (v8) ile Tamga kimlik belgesi üzerinde gerçek "age_over_18" ispatı + doğrulama.
  İspat 518 ms, doğrulama 211 ms, ~343 KB (masaüstü, target-cpu=native). 11 negatif test. Node doğrulayıcı köprüsü prototipi.
  Belgede değişiklik gerekmedi; üretimde kullanılmaz.
- **ADR-0032 / D-ZK-1** kabul (ZK1–ZK6): Longfellow; ilk yüklem "18 yaş üstü"; devre özetleri güven listesinde; ZK6 alan adı
  tekliği (namespace ispata bağlanmaz); mobil/sunucu derlemede PCLMUL/PMULL.

### Eklendi (2026-10-01 — site başına takma ad, ADR-0031 / D-PRIV-1)
- `@tamga-network/wallet-core` `pseudonym.ts`: takma ad tohumu (`readPseudonymSeed`, `SeedVault`), HKDF-SHA256 ile site + sıra
  başına P-256 anahtar (`derivePseudonym`), `tamga-pseudonym+jwt` sunumu (WIA + PoP), tek/çok takma ad seçimi, kayıt / sil / ad
  ver; `matchDcql` takma ad sorgusunu belge sorgusu saymaz ve sunulamayan türü (tohum) hiçbir sorguya önermez (PS3); `respond`
  `pseudonym` girdisi; `RedeemOutput.pseudonymSeed`.
- `@tamga-network/verifier`: `verifyPseudonym` (adım **P1**: imza, aud, nonce, iat, site, WIA + PoP), politika `pseudonym`
  (DCQL `format: "tamga-pseudonym"`), `credentials: []` ile yalnız takma adla giriş; `multiple` yalnız RP kaydı izin verirse (AP6).
- `@tamga-network/schemas`: `urn:tamga:id:PseudonymSeed:1` (sunulamaz, iptal listesi yok); `NON_PRESENTABLE_VCTS`.
- `@tamga-network/trust`: RP kaydında `pseudonyms: single | multiple`; yayıncı sunulamayan türü kapsamda görürse yayını durdurur.
- Güven listesi kaynağı: kimlik servisi tohum türüne yetkili; `site-signup-1` kapsamı ad + soyad (belge özeti yok), `site-signin-1`
  kaldırıldı (giriş belge istemez).
- `apps/verify`: `site-signup` / `site-signin` politikaları takma adla; örnek sitede hesap anahtarı takma ad; testlerde başka siteye
  türetilmiş / eksik takma ad → RED (P1).
- Cüzdan: tohum güvenli depoda (`seedVault`, Keychain / Keystore; sıfırlamada silinir); onay ekranında "bu siteye özel takma adın"
  kartı (çok kipte seçim); Ayarlar → Takma adlarım (ad ver, sil); geçmişte "yeni takma ad / silindi" olayları (değer yok).
- Belgeler: ADR-0031 1.0.1 (uygulama notu: site girdisi kayıtlı `client_id`), SPEC-WALLET-0001 1.3.0 (§5.4, **WL15**),
  SPEC-API-0001 1.5.0 (P1), GUIDE-0001 0.2.0, FW-RB-0001 0.3.0 (RB-AP-ID-07, RB-RP-13), FW-RB-0003 0.2.0; **Tamga ARF 0.4**;
  09-DEMO-KURGU S-17 **kapandı**; INVARIANTS 306 kod; örnek `examples/01-web-login` takma adla.

### Eklendi (2026-10-01 — Z5 sıfır bilgi ispatı, Aşama 1)
- `experiments/zk-longfellow/` (deney; hiçbir derlemeye dahil değil): Tamga'nın gerçek mdoc'u Longfellow ZK devre v8 kurallarına
  göre ölçüldü — kimlik belgesi yapısal olarak uyumlu, 11 alandan 9'u (`age_over_18` dahil) ispatla açılabilir; gerçek ispat için
  C derleyicisi + Rust gerekiyor (README).
- **ADR-0032 (Proposed):** sıfır bilgi ispatlı mdoc sunumu — Longfellow ZK, devre özetleri güven listesinde, DCQL `mso_mdoc_zk` +
  DC API, toplu kopya yedek.

### Değişti (2026-09-30 — ürün adları, sürümlü belgeler)
- "TamgaID" adı sürümlü belgelerden kaldırıldı (Tamga Wallet / "Tamga ile giriş yap"; anlam değişmedi, her belgede sürüm notu):
  ACA-ID-0001 0.1.1, ADR-0011 1.0.1, ADR-0013 1.0.1, ADR-0018 1.0.1, ARCH-0001 0.2.1, ARCH-0002 0.1.1, ARCH-0006 1.0.1,
  PM-AUTH-0001 0.1.1, PM-PH-0001 0.1.1 (dikey platform adları da sektör anlatımıyla), SPEC-ID-0001 1.0.1, SPEC-BC-0002 2.0.2,
  GUIDE-0000 0.2.1, GUIDE-0001 0.1.1, GUIDE-0004 0.1.1; MASTER_INDEX eşitlendi.
- GLOSSARY: "Tamga Verify" (barındırılan doğrulayıcının resmî adı) maddesi.
- **ADR-0030 / D-NAME-3** ürün adları (PN1–PN4): cüzdan Tamga Wallet, giriş "Tamga ile giriş yap", doğrulayıcı Tamga Verify;
  D-OSS-2'nin marka cümlesi değişti (DECISIONS §9b). INVARIANTS 299 kod.
- RS-EBSI-0001 0.1.1 (dikey platform adları); SPEC-BC-0002: var olmayan taslağa verilen bağlantı kaldırıldı.
- ARF: dil eşleri yalnız iki dilde de sayfa varsa yazılır (yalnız Türkçe v0.1 arşivi artık olmayan İngilizce sayfalara bağlanmaz).

### Eklendi (2026-09-30 — marka tek kaynak, arama ve paylaşım)
- `ops/brand/logo/` (mark.svg, mark-mono.svg) marka logosunun **tek kaynağı**; `node ops/brand/build-icons.mjs` ondan bütün
  simgeleri üretir: `ops/brand/icons/` (favicon.ico, icon.svg, apple-touch-icon, 192/512, maskable, logo-512, og.png) ve cüzdan
  simgeleri. Logo değişince yalnız `logo/*.svg` değişir.
- docs.tamga.network ve arf.tamga.network: sekme ve iPhone simgesi, başlıkta mühür, sayfa başına canonical + Open Graph + Twitter
  kartı, ARF'te tr ↔ en dil eşleri, site haritası, robots.txt, ana sayfada JSON-LD (`docs/.vitepress/seo.ts`).
- Cüzdan: Expo şablon simgeleri marka simgeleriyle değişti (iOS, Android uyarlanır + tek renk, web); açılış ekranı
  (`expo-splash-screen`, açık temada Parşömen, koyu temada Obsidyen).

### Değişti (2026-09-30 — marka renkleri ve yazılar)
- `ops/brand/tamga-ui.css` (servis sayfaları, verify, konsol, kimlik servisi) ve docs sitesi: nötr griler yerine marka paleti
  (Parşömen / Obsidyen zemin ve metin). docs ve ARF'te başlık Sora, gövde IBM Plex Sans, kod IBM Plex Mono.
- verify sayfaları: logo tek kaynaktan, simgeler kendi alan adından.
- docs kenar çubuğu: "Web sitesine “Tamga ile giriş yap”" (TamgaID adı kaldırıldı).

### Eklendi (HAIP 1.0 uyumu — AB CIR 2026/1731 sunum/ihraç profili)
- `@tamga-network/issuer`: yetki yanıtında `iss` (RFC 9207; AS metadata `authorization_response_iss_parameter_supported`);
  PAR'da tür `scope` ile de istenebilir (metadata'da her yapılandırmanın `scope`'u = vct; `scopes_supported`); isteğe bağlı DPoP
  sunucu nonce'u (`DpopNonces`, `verifyDpop({ nonces })` → `useNonce`); `attestation` proof türü (`verifyAttestationProof`,
  `readProofs`; anahtar kanıtı isteniyorsa metadata'da ilan); Token Status List hedefi draft-20 (SPEC-CRED-0003 1.0.6).
- `@tamga-network/wallet-core`: `dpopRequest` (sunucu `use_dpop_nonce` isterse bir kez yeniden dener, nonce'u saklar;
  tek kullanımlık cüzdan kanıtı PoP'u her denemede yeniden üretilir); `HttpResponse.headers`; yetki yanıtında `iss` denetimi;
  PAR'da `scope`; yanıt şifrelemesi doğrulayıcının ilanına göre A128GCM ya da A256GCM (`chooseEnc`); DCQL
  `trusted_authorities` tip `aki` eşleşmesi (`certAuthorityKeyId`).
- `@tamga-network/verifier`: A128GCM ve A256GCM ilan + kabul (`RESPONSE_ENC`); politikada `trusted_authorities` →
  DCQL; `akiTrustedAuthority` (güvenilen CA'ların SKI'sinden `aki` değerleri).
- `ops/gen-pki.ts`: kökçe imzalı yeni sertifikalar AuthorityKeyIdentifier taşır (RFC 5280; var olanlar korunur).

### Güvenlik
- `@tamga-network/wallet-core`: `assertIssuerAuthorized` — belge saklanmadan önce issuer imzalı güven listesinde ACTIVE ve tip için
  yetkili olmalı (uygulama `acceptCredentials`; başarısızlıkta cihaz anahtarları silinir); yerel doğrulamada seçici açıklanamaz
  claim reddi; `fetchHttp` 20 sn zaman aşımı, `readJson`; offer biçim denetimi; issuer metadata `credential_issuer` eşleşmesi.
- `@tamga-network/issuer`: `isKeyStorage` — WUA `key_storage` yalnızca tanımlı değerler (prototip adları WL3 alt sınırını atlatıyordu).
- `apps/verify`: çözülemeyen yanıt sunumu tüketmez, süresi dolmuş istek reddedilir; `/terminal/passes` ve `/audit` yönetici
  belirteciyle (sabit zamanlı); sıkı kipte beyansız sunum doğrulayıcının kendi kaydına bağlanır (ADR-0017 1.0.1).
- `apps/wallet-provider`: jwk koordinat ve beyan alanı denetimi. `apps/trust-publisher`: atomik yazım, çapa satırı şema denetimi.
- Cüzdan uygulaması: PIN denemelerinde artan bekleme; silinen belgenin geçiş kartları da kalkar.

### Eklendi
- Canlıya hazırlık: görünen "DEMO"/"geçici" etiketleri kaldırıldı (cüzdan, doğrulayıcı, cüzdan sağlayıcısı, güven listesi adları);
  kimlik belgesinin görünen adı "Tamga Kimlik Belgesi" (Tamga'nın rolü ARF'de yine geçici sağlayıcı); güven listesinden prova askı
  satırları çıkarıldı; `/demo-site` → `/ornek-site` (eski adres yönlenir). ARF 0.3: FW-TF-0001 0.2.1, FW-RB-0003 0.1.1.
- Geliştirici belgeleri: her belgenin üstünde künye (kimlik, tür, durum, sürüm, tarih); ADR ana sayfasında karar tablosu; ADR'ler
  menüde ayrı grup. Kamuya açık metin denetimi `npm run docs:check` (CI): kişi adı, araç adı, iç kayıt yolu yayınlanmaz.

### Değişti
- ADR'ler, DECISIONS, spesifikasyonlar, çerçeve belgeleri: kişi adı, sohbet alıntıları ve araç adları çıkarıldı; kararlar
  "proje yönetimi" onayıyla anılır (birebir alıntılar operatörün özel onay kaydında). İç kayıtlar (arşiv, inceleme, teslimat,
  Faz B analizi, RFC, STATUS, ROADMAP) docs.tamga.network'te yayınlanmaz; depoda kalır.
- Tamga ARF sürümlü: sürüm menüsü ("latest"), dondurulmuş yayınlar `/v<yayın>/`, yayınlar arası satır farkı sayfası (`/changes`),
  `arf/releases.json` + `arf/archive/`, `npm run arf:snapshot`. Yayın 0.3: FW-RB-0003 (kimlik belgesi) ve FW-RB-0004 (etkinlik
  bileti) attestation rulebook'ları — taslak, onay bekliyor.
- docs.tamga.network okura göre yeniden düzenlendi (doğrulayıcı · kurum · cüzdan · ağ · paketler · referans · proje kayıtları);
  yeni GUIDE-0005 (cüzdan geliştirme), GUIDE-0006 (güven listeleri ve ağ), GUIDE-0000 "Başlarken"; paket sayfaları README'lerden üretilir.
- **Tamga ARF sitesi** (`arf/`, arf.tamga.network — ADR-0018): çerçeve belge seti İngilizce + Türkçe; Türkçe sayfalar
  `docs/framework`'ten üretilir (`npm run arf:sync`), çeviri sürüm kayması `npm run arf:check` ile yakalanır (CI).
  Çerçeve belgeleri 0.2.0: FW-ARF/FW-TF/FW-RB-0001, FW-RB-0002 0.1.1. docs.tamga.network geliştirici belgeleri olarak düzenlendi.
- `examples/` — dört çalışan kod örneği (web giriş, kendi sunucunda doğrulama, barındırılan belge verme, kurum sorgulama);
  `examples.test.ts` ile gerçek paketlerle testte çalışır; docs'ta GUIDE-0004 (sekmeli kurulum + örnekler); 8 paket README'si (İngilizce).
- Yayın düzeni: `npm run release:check` (derleme → `.publish/` → temiz projede duman testi), CI (`ci.yml`) ve elle yayın (`release.yml`, provenance).
- `@tamga-network/verifier/web` — sayfa kiti (mount / start / passkey); doğrulayıcı `/tamga-verifier.js` olarak sunar (D14).
- `@tamga-network/issuer/client` — barındırılan ihraç servisi istemcisi: teklif, bilet satışı, iptal/askı (D14).
- Web girişte passkey (WebAuthn): kayıt sonrası günlük giriş alan paylaşmadan (D11 adım 2).
- Cüzdan: kullanıcı-başlatmalı kopya yenileme, tükenme ekranı, "kopya azalıyor" bildirimi (D7, WL7).
- Cüzdan güven listesi imzası gömülü kök parmak iziyle doğrulanır (S-13); SAN kontrolü DER ayrıştırıcıyla (S-12).
- `@tamga-network/mdoc` — ISO 18013-5 CBOR/COSE, kimlik attestation'ın mdoc temsili (ADR-0013).
- Bilet: `urn:tamga:tkt:EventTicket:1`, tek kullanımlık kapı geçiş kartı (D10, ADR-0012).
- Çapa günlüğü arşivleme + durumlu kontrol noktası (SPEC-TRUST-0001 TL12).
- ADR-0014: IssuerCategory'ye `EVENTS`.
- `@tamga-network/trust/core` — platformdan bağımsız güven çekirdeği; cüzdan dahil tek `TrustSource` (ADR-0015).
- `@tamga-network/verifier`: `createRpAssertion` / `verifyRpAssertion` (RP beyanı), istek nesnesinde `tamga_on_behalf_of` (ADR-0017).
- `@tamga-network/issuer/client`: `apiKey` kipi — kurum API anahtarıyla `/{slug}/api/v1` (ADR-0016).
- `@tamga-network/wallet-core`: `fetchCatalogueHash` (B4 şema kataloğu toplu çekimi; cüzdan artık tek yerden kullanır).

### Değişti
- `@tamga-network/verifier`: doğrulama hattı spesifikasyon adımlarına bölündü (`steps.ts`: T0, A–E ayrı fonksiyonlar; `verify.ts` yönetici) — davranış aynı.
- npm kapsamı `@tamga/*` → `@tamga-network/*` (D-OSS-2; `@tamga` üçüncü tarafa ait).
- Site kiti `/tamga-login.js` (window.TamgaLogin) → `/tamga-verifier.js` (window.TamgaVerifier).
- Kök belgeler: `REVIEW-2026-09-09` → `docs/reviews/`; WORKSPACE-AUDIT, AI-HANDOFF, MIMARI-OZET → `docs/_archive/`.
- Servislerin `.env` okuyucusu ortak (`apps/_shared/dotenv.ts`).
- Barındırılan doğrulayıcı: sonuç/değerler yalnızca sunumu açan RP'ye, değerler bir kez; sayfa kiti `start` + `status_token` (ADR-0017).
- Cüzdan: aracı doğrulayıcı üzerinden gelen istekte asıl site gösterilir; doğrulayıcı başına kopya asıl siteye göre.
- Demo site hesabı `document_number_hash` yerine site-anahtarlı özetiyle anahtarlanır (S-17 daraldı).

### Düzeltildi
- `@tamga-network/trust` (core, jose, zod) ve `@tamga-network/schemas` (core) bağımlılıkları package.json'da eksikti.
- Doğrulayıcı turnike sayfasında yansıyan XSS (`/terminal?group=`) — `jsLit` kaçışı + grup doğrulama.
- Cüzdan: yarıda kalan kopya yenilemesi ilgisiz belgeyi silebiliyordu (`canSupersede` güvencesi).
- D5: bozuk çapa zamanı kontrolü atlatıyordu (artık INDETERMINATE); saat kayması toleransı (`max_clock_skew_sec`, 120 sn);
  çapa yalnızca `list_uri` birebir eşleşirse (SPEC-API-0001 1.3.2, SPEC-TRUST-0001 1.1.2, SPEC-CRED-0003 1.0.3).
- Site kiti REJECTED ile INDETERMINATE'e aynı mesajı gösteriyordu (`outcomeMessage`).
- Demo site: CSRF (yalnızca JSON + aynı Origin), sunucu tarafı oturum süresi, `Secure` çerez, site politikası denetimi.
- `issuer/client`: kiracıdan bağımsız `subject_id`; düz metin hata gövdesi mesajda.
- Verifier: servis yeniden başlarken geçerli belgenin `REJECTED @D5` sahte reddi → önbellek çapadan eskiyse INDETERMINATE
  (SPEC-API-0001 1.3.1).
- Status token bayatlığı D3 → D4 sınıflandırması; çapa günlüğü süreçler arası kilit.
