# Karar Kütüğü (Decisions Register)

**Bu dosya, Tamga Network'ün TÜM tasarım kararlarının tek merkezidir.**
2026-09-03 senkronizasyonunda açık kararların tamamı proje yönetiminin talimatıyla **önerilen
final cevaplarla kapatıldı.** Geriye yalnızca **dış bağımlılığı olan** (nihai logo,
bağımsız kripto denetimi gibi) birkaç madde "uygulama aşamasına bırakıldı" olarak kaldı.

- **İş listesi değildir.** Yapılacak işler: `STATUS.md` (ağ/docs) + `../tamga-web/todos.md` (web).
- Detay ve gerekçe her zaman ilgili dokümandadır (bağlantı verildi); burası karar yüzeyidir.
- **Durum kodları:** 🟢 karara bağlandı · ⚪ ilke kararlaştı, sayısal/teknik detay uygulama/denetim aşamasında · 🟡 dış girdiye bağlı (logo, denetim, kaynak metin)

**Son güncelleme:** 2026-10-08 (ADR-0043 yaş sınırı yok, AB yaklaşımı — D-ID-10; 2026-10-07: D-NAME-1 `wallet` hizmeti D-GOV-9 ile kaldırıldı olarak işlendi; 2026-10-06: ADR-0042 ağ ve cüzdanlar: ağ cüzdan işletmez, sandbox tek — D-GOV-9; 2026-10-05: ADR-0040 güncellendi: sandbox'ta gerçek kimlik doğrulama herkese açık, gerçek ağın sağlayıcı hesabıyla, tavanlı — D-ID-9; 2026-10-04: ADR-0040 sandbox'ta davetli gerçek kimlik doğrulama — D-ID-9; ADR-0041 sandbox'ta kurum test hesapları — D-TRUST-4; ADR-0039 sürücü belgesi bilgisi — D-ID-8; ADR-0038 sandbox — D-TRUST-3; ADR-0037 yalnızca ağ — D-GOV-8; ADR-0036 güven federasyonu — D-TRUST-2; ADR-0035 konumlanma — D-GOV-7; ADR-0033 inceleme kodu — D-REVIEW-1; ADR-0034 HAIP istemci kimliği + WIA sub — D-PROTO-2; ADR-0032 sıfır bilgi ispatı — D-ZK-1; ADR-0031 site başına takma ad — D-PRIV-1; ADR-0030 ürün adları — D-NAME-3; ADR-0029 geliştirme evresi şemaları — D-SCHEMA-5; ADR-0027 günlük dışa aktarımı — D-WALLET-2; ADR-0026 kayıt sertifikaları — D-REG-2; ADR-0020 yetkili kaynak — D-SRC-1; ADR-0025 WIA/KA — D-CRED-7; ADR-0023 otomatik yenileme — D-WALLET-1; ADR-0024 kayıt verisi — D-REG-1; ADR-0022 kimlik servisi sınıfı — D-ID-7; ADR-0021 iletişim belgeleri — D-CONTACT-1; önceki 2026-09-26: onay isteği DB-5/6/16/18 + S-10…S-18 kabul — D-PROTO-1, D-CRED-6, D-ASSUR-2; ADR-0013 mdoc çift format — D-CRED-5; önceki: ADR-0012 — D-PROX-1, ADR-0011 — D-ID-6)

---

## 0. 2026-09-24 Kararları — Faz B (zincirsiz beta) ve tip kimliği

### D-BC-6 — Faz B: zincirsiz beta ve zincir başlangıç eşiği 🟢 (2026-09-24)
- **KARAR:** Faz 0'ın önüne **Faz B** eklenir: güven çapası, Tamga'nın geçici operatör olarak
  imzaladığı sürümlü ve hash-zincirli güven listeleri (`lotl.jws`, `tl-<cc>.jws`) + saatlik çapa
  günlüğü (`anchors.jsonl`) — ETSI TS 119 612 / EUDI modeli. Besu/QBFT zinciri (D-BC-0, değişmez)
  **yalnızca ≥2 bağımsız validator operatörü** yazılı kabul verdiğinde kurulur. "Zincire
  kaydedilir" ifadeleri Faz B'de "çapa günlüğüne kaydedilir" okunur (S1/S4/D8/DP1/N1/GV2/CMP1-2-4
  sürüm notları). Geçiş = liste geçmişinin kontratlara replay'i + eşdeğerlik testi.
- **Nerede:** [[ADR-0009]] K1–K4, K7; uygulama bu depo (`packages/`, `apps/`).

### D-GTM-2 — Pilot ön koşulları ve sınırlar bildirimi v2 🟢 (2026-09-24)
- **KARAR:** Ö1/Ö2 (kontrat derleme, testnet) → **Ö1'** (liste taahhüt testleri) / **Ö2'**
  (trust + schemas siteleri yayında) / **Ö8'** (issuer anahtarı üniversitede); bildirim v2 (8 madde);
  ölçüt B10 (iptal ≤ 90 dk), B11. Demo yolu (sahte veri, gerçek kriptografi) pilotun önündedir;
  demo sapmaları operatörün iç kaydında kayıtlıdır.
- **Nerede:** [[ADR-0009]] K6; PM-GTM-0001 v2.0.0 (yazılacak, §10).

### D-GOV-5 — TDT-first ilkesi 🟢 (2026-09-24)
- **KARAR:** Faz B'nin hiçbir tanımlayıcısı/rol adı/veri yapısı "Tamga tek operatör" varsayımı
  taşımaz: LOTL + her TDT üye devleti için ulusal liste slotu (TR aktif; AZ/KZ/KG/UZ rezerve;
  gözlemciler ayrı), tam ARF rol seti, `operator: {Tamga, provisional, on_behalf_of}`, "TR
  National Root CA (provisional operator: Tamga)". Devir yalnızca `operator` alanını değiştirir;
  `ca_id`/`issuer_id`/`vct` değişmez. D-GOV-2 tablosuna **başlangıç eşiği** satırı eklenmiştir.
- **Nerede:** [[ADR-0009]] K5.

### D-SCHEMA-4 — Tip kimliği URN, metadata katalogdan 🟢 (2026-09-24)
- **KARAR:** `vct = urn:tamga:<domain>:<Type>:<major>` (Faz 1 devlet-özel `urn:tamga:<cc>:…`);
  Type Metadata **katalogdan** (`metadata_url` + `content_hash`, IETF SD-JWT VC-19 §5.3.2);
  `vct#integrity` zorunlu; `schemaId = keccak256(vct)` aynen; major URN'de, minor/patch yeni
  `metadata_url` + hash. `schemas.tamga.network` katalog/barındırma adresidir, kimlik değildir.
  **D-SCHEMA-1'i süpersede eder.**
- **Nerede:** [[ADR-0010]] K1–K4, K6–K7.

### D-CRED-4 — Tamga EAA kategori sinyali; holder LoA asla credential'da 🟢 (2026-09-24)
- **KARAR:** Credential'da opsiyonel `category` claim'i: `urn:tamga:eaa:pub` (devlet kurumu /
  authentic source adına, `class: PUB`), `urn:tamga:eaa:qualified` (Trust Framework'te akredite
  I3, `class: QUALIFIED`); I1–I2 issuer'lar (`class: EAA`) koymaz. Verifier kayıtla çapraz kontrol
  eder (yeni adım **C4**). AB URN'leri (`urn:etsi:esi:eaa:eu:*`) kullanılmaz. Holder assurance
  (T0–T3) hiçbir zaman credential'a yazılmaz (PR7 korunur; seviye tipin ön koşuludur).
- **Nerede:** [[ADR-0010]] K5; SPEC-CRED-0002 C18, SPEC-API-0001 C4 (yazılacak, §10).

### D-NAME-1 — Alan adı şeması 🟢 (2026-09-24, **v1.1 aynı gün**)
- **KARAR (v1.1):** Ağ hizmetleri `<hizmet>.tamga.network`: **`trust`** (listeler, çapa günlüğü,
  anahtarlar), **`schemas`** (katalog; çoğul, bir katalogdur), ~~**`wallet`**~~ (→ D-GOV-9, 2026-10-06: ağ cüzdan sağlayıcı işletmez), **`verify`**. Kurum
  hizmetleri **tek hizmet, çok kiracı, yol tabanlı**: `issuer.tamga.network/{slug}`
  (OpenID4VCI; metadata RFC 8414 kuralıyla `/.well-known/openid-credential-issuer/{slug}`),
  ~~`portal.tamga.network/{slug}`~~ → **`console.tamga.network`** (v1.2, 2026-09-28, [[ADR-0019]]), `status.tamga.network/{opak-id}` (kurumu kodlamaz, S8). Kurum
  kendi alan adını isterse liste kaydındaki `issuer_url`/`status_list_base` değişir; kod ve
  `issuer_id` değişmez. Kök parmak izi `tamga.network/trust-anchor`; geliştirme
  `*.dev.tamga.network`; `demo.tamga.network` tamga-demo'da kalır. Slug: küçük harf ASCII, tire.
  *v1.0'daki `<hizmet>.<kurum>.tamga.network` (kurum başına alt alan adı) proje yönetiminin isteğiyle
  geri çekildi: gereksiz DNS/TLS/dağıtım yükü; kurum başına kod yok, çok kiracılı tek uygulama.*
- **Nerede:** operatörün iç kaydı; SPEC-SCHEMA-0001 v2'de `schema.` → `schemas.`.

### D-GOV-6 — Çerçeve belge seti (Tamga ARF · Trust Framework · Tamga Rulebook · belge türü rulebook'ları) 🟢 (2026-09-24; DB-12)
- **KARAR:** Dışa dönük çerçeve belgeleri `docs/framework/` altında ayrı bir **Framework** katmanıdır
  (`FW-<DOMAIN>-<N>`; DOCUMENTATION-STANDARD v1.1.0). Set: [[FW-ARF-0001]] (mimari ve referans
  çerçevesi), [[FW-TF-0001]] (yönetişim — WB 5 katman: strateji · teknoloji · şema kuralları · uyum ·
  sözleşmeler; devir planı), [[FW-RB-0001]] (rol bazlı bağlayıcı kurallar RB-*), [[FW-RB-0002]]
  (eğitim attestation rulebook'u). Çerçeve belgeleri **karar üretmez, derler**: her kural bir
  ADR/SPEC/PM/INVARIANTS koduna atıflıdır; bir ADR kabul edildiğinde etkilenen FW belgesi aynı oturumda
  güncellenir. Kabulle birlikte FW-TF-0001 §9'daki yedi ÖNERİ maddesi (hibrit uyum rejimi I3 ex ante /
  I2 ex post; ISO 17000 rol eşlemesi; sorumluluk tahsisi tablosu; yaptırım merdiveni ve SLA sayıları;
  KVKK şikâyet akışı; hukuki inceleme kapısı; yargı yeri) **v0.1 çerçeve kuralı** olarak yürürlüktedir;
  sayısal değerler pilot verisiyle FW CHANGELOG üzerinden revize edilir (ADR gerekmez). Yayın:
  ~~`docs.tamga.network`, Türkçe kanonik, İngilizce v0.2~~ → **`arf.tamga.network`, İngilizce + Türkçe** (D-DOCS-1,
  [[ADR-0018]]); CC BY 4.0.
- **Nerede:** `docs/framework/README.md`; onay kaydı operatörün arşivinde.

### D-ID-6 — Tamga geçici kimlik attestation sağlayıcısı 🟢 (2026-09-25; [[ADR-0011]])
- **KARAR:** Devlet tarafından atanmış PID sağlayıcısı bulunana kadar Tamga, `id.tamga.network` üzerinde
  uzaktan kimlik doğrulama (Didit: belge + canlılık + yüz; ileride NFC) ile doğruladığı kişilere kendi
  imzaladığı **`urn:tamga:id:IdentityAttestation:1`** belgesini verir. Bu bir **EAA'dır, PID değildir**
  (TL8 korunur; `pid_providers[]` boş; devlet PID'i gelince `successor` ile süpersede). Claim seti: ad,
  soyad, doğum tarihi, uyruk, **TCKN (seçici açıklamalı, yalnızca yetkili kapsama)**, belge türü,
  belge no hash'i, `document_chip_verified` (NFC olgu; LoA claim'i yok — PR7), `verification_method`;
  geçerlilik **2 yıl**; status list. **Kimlik ispatı entegrasyonu yalnızca bu serviste** (IDP3 yeniden
  ifade edildi; kurum issuer'ları, cüzdan ve verifier IDV sağlayıcısıyla konuşmaz). Kurumlar belge
  ihracında bu attestation'ı **sunum** olarak alır (OpenID4VCI authorization code + PAR + PKCE, istemci
  kimliği WUA; satır içi OpenID4VP) ve kayıtlarıyla **TCKN + doğum tarihi** ile eşler; OBS QR / e-posta
  yolları paralel kalır. Tamga kimlik ispatı verisi için **KVKK veri sorumlusu**dur: aydınlatma + açık
  rıza `/authorize` sayfasında; görüntü/selfie Tamga'da saklanmaz; kayıt = opak `subject_ref`, belge no
  hash'i, süre, status idx'leri. "Tamga hiçbir kişisel veri görmez" ifadesi daraltıldı: kimlik ispatı
  verisini görür, belge içeriğini görmez.
- **Nerede:** [[ADR-0011]]; [[SPEC-PROTO-0001]] v1.2.0 §11.2 (PR13–PR15); [[SPEC-ID-0003]] v0.2.0 §9
  (IDP3', IDP9–IDP11); [[SPEC-TRUST-0001]] v1.0.1 (TL8); [[FW-TF-0001]] §3.6; [[FW-RB-0001]] §4.5;
  operatörün iç kaydı. Kod: `tamga-platform/apps/id`, `@tamga-network/issuer` authcode, `@tamga-network/wallet-core`
  authcode/directory, Tamga Wallet (ayrı depo; kimlik doğrula, kurum ara, satır içi sunum), kurum issuer'ı
  `/par` `/authorize` `/vp/response` `/token`. Demo: FAKE IDV (sapma S-15); gerçek Didit API anahtarı `.env`.

### D-PROX-1 — Yakın alan sunumu: cüzdan QR gösterir; köprü yollar B/C, hedef ISO 18013-5 🟢 (2026-09-25; [[ADR-0012]])
- **KARAR:** Uzak sunum (A, OpenID4VP cross-device) yanında iki **köprü** yakın alan yolu: **B geçiş kartı** — kayıtlı RP'ye bir
  kez standart sunumla kayıt (`pass_grant`), sonra cüzdan kopya anahtarıyla imzalı, **kişisel veri içermeyen**, 60 s ömürlü
  `tamga-pass+jwt` jetonunu QR olarak gösterir; terminal çevrim dışı doğrular (anahtar, `aud`, `exp`, `jti` tekrar listesi;
  kapılar arası liste çevrim içi paylaşılır). **C yüz yüze kontrol** — cüzdanın gösterdiği kısa ömürlü `request_uri` ile kontrol
  edenin Verifier uygulaması standart OpenID4VP isteğini başlatır. **Hedef Faz 1: ISO/IEC 18013-5** (mdoc + BLE, gerçek derleme);
  "Göster" ekranı sabit, yalnızca taşıma değişir; jeton biçimleri sürümlü ve emekliye ayrılabilir. Tek kullanımlık attestation:
  1 kopya/koltuk + `exp` + status biti + **kapılar arası ortak kullanıldı listesi** (S6 korunur). RP kaydına `terminal_groups[]`.
  İlke: **nonce'u ikna olmak isteyen taraf üretir**. Geçişte PIN sorulmaz: **süreli ve kapsamlı rıza** (S-16; WL11 istisnası,
  WL12–WL14 ile sınırlı). Kurumsal temsil yetkisi (K6) ayrı ADR'ye ertelendi.
- **Nerede:** [[ADR-0012]]; [[SPEC-WALLET-0001]] WL12–WL14; [[SPEC-API-0001]] AP13; FW-TF-0001 §3.7; 09-DEMO-KURGU S-16/sahne 12; 08-BACKLOG D9.

### D-CRED-5 — Kimlik attestation'ı çift format: SD-JWT VC + ISO/IEC 18013-5 mdoc 🟢 (2026-09-26; [[ADR-0013]])
- **KARAR:** `urn:tamga:id:IdentityAttestation:1` aynı ihraç akışında iki temsille verilir: **SD-JWT VC (birincil, D-CRED-1
  değişmez)** + **ISO 18013-5 mdoc** (docType = vct URN, namespace `tamga.id.1`). Aynı alanlar, aynı `iat/exp`, **aynı holder
  anahtarı** (mdoc `deviceKey` = SD-JWT `cnf.jwk`); ayrı issuer imzası (COSE_Sign1 ES256, x5chain → güven listesi). Doğrulayıcı
  formatı DCQL ile seçer (`dc+sd-jwt` | `mso_mdoc`); kanal aynı (QR / derin bağlantı / DC API). Gerekçe: Safari/iOS Digital
  Credentials API yalnızca mdoc kabul eder; ARF PID için mdoc'u zorunlu tutar; Faz 1 Bluetooth (ADR-0012) mdoc taşır. Kapsam
  yalnızca kimlik; diğer tipler SD-JWT VC. Demo sapmaları: CBOR RFC 8949 §4.2.1 determinizm (18013-5 §3.9 pilot interop),
  SessionTranscript deterministik özet (pilot: 18013-7 Annex B). Taşıma (BLE/NFC) bu kararın dışında (Faz 1).
- **Nerede:** [[ADR-0013]] (MD1–MD5); [[SPEC-CRED-0001]] §1; [[SPEC-PROTO-0002]]; `packages/mdoc`; 08-BACKLOG D12.

### D-PROTO-1 — İhraç teklif sınıfları: `on-screen` / `out-of-band` 🟢 (2026-09-26; DB-5)
- **KARAR:** OpenID4VCI pre-authorized teklif iki sınıfta verilir. **`on-screen`**: kurumun ekranında (kişi oturum açmış), QR +
  `tx_code` aynı oturumda, **5 dk**, tek kullanım. **`out-of-band`**: e-posta (veya SMS) ile gönderilen QR/bağlantı, **≤ 72 saat**,
  tek kullanım; `tx_code` (6 hane) **farklı kanaldan** gider (e-posta teklif → SMS kod), 3 yanlış deneme teklifi yakar, kanal adresi
  yalnızca kurumun kayıtlı verisinden. Kullanılmış teklif ikinci kez okutulursa cüzdan "bu davet kullanılmış" der (ihlal görünür olur).
- **Nerede:** [[SPEC-PROTO-0001]] §3.3, PR3, PR12; `tamga-platform/apps/issuer` (`on-screen` uygulandı; `out-of-band` kanalı pilot — S-3).

### D-CRED-6 — İhraç öncesi Wallet Unit Attestation zorunlu 🟢 (2026-09-26; DB-16)
- **KARAR:** Issuer, grant'tan **önce** cüzdanın Wallet Unit Attestation'ını doğrular (ETSI TS 119 471 REQ-EAASP-4.2.1.2-02/03):
  WUA imzacısı güven listesindeki `wallet_providers[]` anahtarlarından biri, PoP cihaz anahtarıyla imzalı, `key_storage` kiracı
  politikasını karşılıyor. Taşıma: `OAuth-Client-Attestation` + `-PoP` başlıkları (HAIP). Sonuç token ve denetim kaydına yazılır,
  **credential'a girmez**. Kiracı ayarı `wallet_policy {require_wua, min_key_storage}`. Demo `software` kabul (S-9/S-14); pilot
  `secure_enclave`/`strongbox`.
- **Nerede:** [[SPEC-PROTO-0001]] §11.1, PR11; [[SPEC-CRED-0001]] §4; cüzdan sağlayıcısı (cüzdanı sunan kuruluşta; [[ADR-0042]]), `@tamga-network/issuer verifyWalletAttestation`.

### D-SRC-1 — Yetkili kaynak kurumdadır; Tamga kişi kaydı tutmaz 🟢 (2026-09-29; [[ADR-0020]])
- **KARAR:** Barındırılan ihraçta belge bilgileri imza anında kurumun kaynağından okunur, saklanmaz (kaynak bağlantısı: `remote`
  sorgu ucu — lookup / fetch, Tamga imzalı istek; `sandbox` = Konsol'daki örnek kayıt defteri, yalnız deneme). Yol A: kurum API ile
  **kimliğe bağlı teklif** (authorization_code + issuer_state; T.C. kimlik no + doğum tarihi yalnız anahtarlı özet), bağlantıyı kurum
  gönderir; kişi kimliğini sunar, eşleşmezse belge yok. Yol B: kişi cüzdandan ister, Tamga kuruma sorar. tx_code yedek.
- **Nerede:** [[ADR-0020]] AS1–AS4; kurum issuer'ı, @tamga-network/issuer, wallet-core, Kurum Konsolu, OpenAPI.

### D-CRED-7 — Cüzdan örneği kanıtı (WIA) + anahtar kanıtı (KA) — AB TS3 🟢 (2026-09-29; [[ADR-0025]])
- **KARAR:** Tek 30 günlük WUA yerine: cüzdan birimi sağlayıcıda kayıtlı (kişi verisi yok); her belge işleminde 24 saatten kısa
  ömürlü, yeni anahtarlı ve yeni iptal girişli WIA (`client_status`); belge anahtarları sağlayıcı imzalı KA'da
  (`key_attestation`, `key_storage` gerçek seviye, tür başına iptal girişi); sağlayıcı iki iptal listesi yayınlar, kullanıcı
  isteğiyle birimi iptal eder; belge verenler WIA/KA ve iptal durumlarını doğrular. D-CRED-6'nın biçimini değiştirir (ilke aynı).
- **Nerede:** [[ADR-0025]] WIA1–WIA4; cüzdan sağlayıcısı (cüzdanı sunan kuruluşta; [[ADR-0042]]), `@tamga-network/issuer`, wallet-core, kurum issuer'ı, kimlik servisi.

### D-ASSUR-2 — Holder seviyesi bağlama yolundan gelir, tipin ön koşuludur; ETSI TS 119 461 eşlemesi 🟢 (2026-09-26; DB-6, DB-6 rev., DB-18)
- **KARAR:** Holder seviyesi (T1–T3) credential'a **yazılmaz** (PR7); eIDAS modelindeki gibi **belge tipinin ön koşuludur**: issuer
  bağlama yoluna göre hangi tipi vereceğine karar verir ve yolu denetim kaydına yazar. Eşleme: e-posta teklif + SMS kodu ya da
  ekranda teklif → **T1 (Baseline)**; lisanslı uzaktan kimlik doğrulama (belge + canlılık + yüz) ya da kurum kayıt masası →
  **T2 (Substantial)**; NES / Mobil İmza → **T3 (High)**, yalnızca authorization code veya yüz yüze — pre-authorized ile **yasak**
  (ETSI 472-3). Eğitimde T1 → öğrenci belgesi, T2+ → diploma. Politika örneklerinde `holder_assurance` satırı yoktur; dışarıya eIDAS
  adları kullanılır. [[SPEC-ID-0003]] bu kararla **Active** oldu.
- **Nerede:** [[PM-ASSUR-0001]] §Bağlama yolu → holder seviyesi; [[SPEC-ID-0003]] (T1–T3, IDP1–IDP11); [[FW-RB-0002]] §4.

### D-OSS-1 — Depo adları ve açık kaynak sınırı 🟢 (2026-09-24)
- **KARAR:** Üç depo: **`tamga-network`** (public; kanonik dokümanlar + çerçeve belgeleri + `@tamga-network/*`
  paketleri + cüzdan/verifier uygulamaları + kontratlar/ağ + docs sitesi; Apache-2.0 kod, CC BY 4.0
  dokümanlar), **`tamga-platform`** (private; issuer/portal/status servisleri, kiracılar, ops, standart
  PDF analizleri, konuşmalar, raporlar), **`tamga-web`** (tanıtım sitesi). **GitHub repo adı = klasör
  adı**; eski "`tamga`" adı geri çekildi. İleride `github.com/tamga-network` organizasyonuna transfer.
  Repo sınırı = görünürlük sınırı (gitignore gizlilik yöntemi değildir); bileşen başına değil yayın
  başına repo (paketler tek monorepodan ayrı yayınlanır); "beta/network" klasör değil çalışma kipidir
  (`TRUST_SOURCE=list|chain`). Public yapma öncesi kontrol listesi operatörün iç kaydında. `tamga-demo` arşiv.
- **Nerede:** operatörün iç kaydı (D-MONO v2 olarak okunur); `../README.md`.

### D-CAT-1 — IssuerCategory'ye EVENTS (etkinlik) 🟢 (2026-09-27; DB-23)
- **KARAR:** Kapalı kümeye yalnızca **EVENTS** eklenir (etkinlik/bilet ihraççısı); TRANSPORT ve TELECOM gerçek bir ihraççı
  gelince kendi ADR'siyle. Yeni değer enum'un sonuna (IC1). Bilet satıcısı `bubilet` OTHER → EVENTS.
- **Nerede:** [[ADR-0014]]; [[SPEC-BC-0001]] 2.2.0; `@tamga-network/trust`; `IIssuerRegistry.sol`.

### D-OSS-2 — npm kapsamı `@tamga-network` 🟢 (2026-09-27)
- **KARAR:** Tüm açık paketler **`@tamga-network/*`** kapsamıyla yayınlanır (eski `@tamga/*`). **Neden:** npm'de `@tamga`
  kapsamı üçüncü bir tarafa ait (yazılım lisanslama ürünü, `@tamga/sdk`); yayın imkânsız. `@tamga-network` GitHub
  deposu/organizasyonu ve `tamga.network` alan adıyla aynıdır. 
  Kullanıcıya görünen marka ("TamgaID ile Giriş Yap") değişmez; kapsam yalnızca geliştirici içindir. *(Marka cümlesi
  2026-09-30'da **D-NAME-3** / [[ADR-0030]] ile değişti: cüzdan Tamga Wallet, giriş "Tamga ile giriş yap".)*
- **Uygulandı:** iki depoda paket adları, import'lar, tsconfig yolları, dokümanlar (geçmiş raporlar hariç). Kapsam npm'de
  **henüz alınmadı** — ilk yayından önce `tamga-network` npm organizasyonu açılmalı. Marka çakışması için hukuki görüş önerilir.
- **Kit adlandırması (2026-09-27):** rol başına tek paket + alt yol —
  `@tamga-network/verifier` (sunucu doğrulama) + `@tamga-network/verifier/web` (tarayıcı: düğme, QR, passkey);
  `@tamga-network/issuer` + `@tamga-network/issuer/client` (barındırılan ihraç servisinin istemcisi). Ayrı `login-*` paketi yok.

---

### D-TRUST-1 — Tek güven arayüzü; cüzdan dahil (trust/core) 🟢 (2026-09-27; [[ADR-0015]])
- **KARAR:** Her istemci ve servis güveni yalnızca `TrustSource` arayüzünden sorar; liste doğrulama kuralları tek gerçeklemededir
  (`@tamga-network/trust/core`, platformdan bağımsız); cüzdanın ayrı liste okuyucusu kalkar. Faz 0 zincir kaynağı aynı arayüzün
  arkasına girer. AB'nin referans cüzdanları (Kotlin/Swift) kuralı iki kez uygular; tek dil kullandığımız için tek çekirdek.
  
- **Nerede:** [[ADR-0015]] TS1–TS3; `packages/trust`, `packages/wallet-core`.

### D-API-1 — Barındırılan ihraç servisine dış kurum erişimi: kiracı API anahtarı 🟢 (2026-09-27; [[ADR-0016]])
- **KARAR:** Dış yüzey `/{slug}/api/v1/*`; kiracıya ve kapsama bağlı API anahtarı (sunucuda yalnızca özeti), 90 gün, iki anahtar
  örtüşerek döner; iç `/admin/*` 127.0.0.1'de kalır. Pilot üniversitesi için mTLS (K5) değerlendirilir. 
- **Nerede:** [[ADR-0016]] HA1–HA3; `tamga-platform/apps/issuer`, `@tamga-network/issuer/client`.

### D-API-2 — Barındırılan doğrulayıcıda sonuca erişim: RP beyanı, tek okuma, asıl RP gösterimi 🟢 (2026-09-27; [[ADR-0017]])
- **KARAR:** Değer döndüren uçlar yalnızca güven listesindeki anahtarıyla imzalı kısa ömürlü beyan sunan, sunumu açan RP'ye;
  değerler bir kez ve ≤ 5 dk; tarayıcı yalnızca durum görür; aracı istekte cüzdan asıl RP'yi gösterir (ARF aracı modeli).
  
- **Nerede:** [[ADR-0017]] HV1–HV6; `apps/verify`, `@tamga-network/verifier/web`, cüzdan onay ekranı.

### D-CONSOLE-1 — Kurum Konsolu (console.tamga.network) + PostgreSQL; öğrenci portalı kalkar 🟢 (2026-09-28; [[ADR-0019]])
- **KARAR:** Barındırılan hizmetlerin kurum tarafı Kurum Konsolu'dur: davetle hesap, passkey ile giriş; verilen belgeler,
  iptal/askı, örnek kayıt defteri (öğrenciler), biletler, API anahtarları, kullanıcılar, kurum kaydı. Öğrenciye dönük portal
  kaldırılır (belge cüzdandan istenir). Operatör verisi PostgreSQL'de; kısa ömürlü protokol durumu bellekte.
- **Nerede:** [[ADR-0019]] KC1–KC4; `tamga-platform/apps/console`, `shared/db`, ops.

### D-CONTACT-1 — Doğrulanmış iletişim belgeleri: e-posta ve telefon 🟢 (2026-09-29; [[ADR-0021]])
- **KARAR:** Tamga kimlik servisi, tek kullanımlık kodla sahipliği kanıtlanan e-posta ve telefon için
  `urn:tamga:contact:EmailAddress:1` / `urn:tamga:contact:PhoneNumber:1` verir: nitelikli olmayan EAA, yalnız SD-JWT VC,
  kategori yok, 1 yıl, birden çok adres; adres ihraçtan sonra tutulmaz, günlüğe yazılmaz. SMS'in gerçek sağlayıcısı pilot
  öncesi etkinleştirilmez (testte SMS metni e-postayla).
- **Nerede:** [[ADR-0021]] CT1–CT4; `packages/schemas`, `tamga-platform/apps/id`, cüzdan.

### D-WALLET-1 — Otomatik kopya yenileme (yenileme belirteciyle) 🟢 (2026-09-29; [[ADR-0023]])
- **KARAR:** Cüzdan kurum belgelerini, kurumun ilan ettiği eşikte (2 kopya kalınca / bitişe 7 gün kala), uygulama önde ve kilit
  açıkken, rastgele gecikmeyle ve kullanıcıya sormadan yeniler; mekanizma OpenID4VCI yenileme belirteci (belgeye özel DPoP
  anahtarına ve WUA'ya bağlı, tek kullanımlık, döndürülen). Kimlik ve iletişim belgeleri kapsam dışı (kişi alanı saklanmaz).
  Ayarlardan kapatılabilir. WL7 değişir.
- **Nerede:** [[ADR-0023]] AR1–AR4; wallet-core, cüzdan, kurum issuer'ı.

### D-GOV-7 — Konumlanma: AB uyumu taban, Tamga Network hafif federasyon, ürün ve hizmetler 🟢 (2026-10-01; [[ADR-0035]])
- **KARAR:** Yol 3. Belgeler, protokoller ve güven listeleri AB standartlarında (taban). Tamga Network ağır bir kurum değil,
  hafif bir federasyon: ülke listelerini toplar ve birbirine tanıtır, yayınlanmış kurallara uyan her cüzdan sağlayıcısını tanır;
  devletler katıldıkça yönetişim kurumu ve zincir. Tamga Wallet ağın ilk ve referans cüzdanı, ama her AB uyumlu ortamda çalışır;
  "EUDI Wallet" ya da "ulusal cüzdan" iddiası yok. Hizmetler (Kurum Konsolu, Tamga Verify, destek) standartlar üzerine satılır.
- **Nerede:** [[ADR-0035]] PO1–PO4. Üçüncü katman D-GOV-8 ile değişti.

### D-GOV-8 — Tamga Network yalnızca ağdır; hizmetler ağın dışında 🟢 (2026-10-02; [[ADR-0037]])
- **KARAR:** Ağ kuralları, trust list'leri, şema kataloğunu, açık paketleri ve referans hizmetleri işletir; hizmet satmaz.
  Entegrasyon, destek, sözleşmeli barındırma, danışmanlık, connector gibi ticari hizmetler ağın dışındaki şirketlerce kendi
  adlarıyla sunulur; Tamga ekibinin şirketi de dahil hiçbirine ayrıcalık yoktur. Tamga Wallet ayrı üründür, ağın ilk cüzdanıdır.
- **Nerede:** [[ADR-0037]] PO5–PO6.

### D-GOV-9 — Ağ cüzdan işletmez; cüzdanları listeler; sandbox tek 🟢 (2026-10-06; [[ADR-0042]])
- **KARAR:** Ağ hiçbir cüzdanın uygulamasını, cüzdan sağlayıcısını ya da sitesini işletmez; cüzdanları güven listesindeki
  `wallet_providers[]` kaydıyla tanır. Ağın alan adlarında cüzdana ait hizmet çalışmaz: `wallet.tamga.network` ve
  `wallet.sandbox.tamga.network` 2026-10-06'da ağdan kaldırıldı (kullanan olmadığı için geçiş süresi beklenmedi); Tamga Wallet'ın
  sağlayıcısını cüzdanın işletmecisi `provider.tamgawallet.com`'da işletir, listelerdeki adres yenilendi. Sandbox tektir ve ağındır; sandbox'ta da
  cüzdan sağlayıcıyı cüzdan işletir ve sandbox listesine kaydolur (ayrı cüzdan sandbox'ı yok). Ağın arayüzleri ve paketleri cüzdan
  adını sabit yazmaz; test PKI'si genel "test cüzdan sağlayıcısı" kullanır. Sonraki iş: sandbox'ta cüzdan sağlayıcı kendi
  kendine kaydı ve otomatik cüzdan uyum testi (ayrı karar).
- **Nerede:** [[ADR-0042]] NW1–NW4. [[ADR-0038]]'in test cüzdan sağlayıcısını ağın çalıştırdığı kısmı değişti.

### D-TRUST-2 — Güven federasyonu: dış listeler LOTL'da işaretçi + sabit imzacı + kapsam; AB PID/mDL doğrulama 🟢 (2026-10-01; [[ADR-0036]])
- **KARAR:** Tamga LOTL başka işletmecilerin güven listelerini (ilk biçim ETSI TS 119 602 LoTE JSON) adres, LOTL'da sabitlenmiş
  imzacı, kapsam (roller + belge türleri) ve onay kaydıyla gösterebilir; liste sahibinde kalır. Kapsamdaki dış cüzdan
  sağlayıcılarının cüzdanlarına belge verilebilir (kapsamdaki anahtar deposu kuralı daha sıkıysa o uygulanır); kapsamdaki dış
  kurumların belgeleri (AB PID, mDL) doğrulanabilir. Dış listenin bozulması Tamga listelerini etkilemez (UNKNOWN). İç içe seçici
  açıklama (RFC 9901 §7.1) desteklenir. Belirli bir dış listeye güvenmek ayrı onaydır; bugün LOTL'da dış liste yok.
- **Nerede:** [[ADR-0036]] FD1–FD5; [[SPEC-TRUST-0001]] v1.2.0, [[SPEC-API-0001]] v1.7.0.

### D-TRUST-3 — Sandbox: ayrı test ağı (sandbox.tamga.network) 🟢 (2026-10-03; [[ADR-0038]])
- **KARAR:** Ağ, gerçek ağdan tamamen ayrı bir test ağı işletir: kendi test kökü, imza anahtarları ve "test" işaretli LOTL'u,
  örnek kurumları, sahte kişileri ve her belge türünden örnek belgeleriyle. Gerçek ağın cüzdanları ve doğrulayıcıları sandbox'a
  güvenmez; cüzdan ancak geliştirici ayarıyla geçer ve bunu gösterir. Gerçek kişisel veri yok, veriler sıfırlanabilir. Kendi
  kendine kayıt ve otomatik uyum servisi sonraki aşamalar, ayrı karar ister.
- **Nerede:** [[ADR-0038]] SB1–SB5.

### D-ID-8 — Doğrulanmış sürücü belgesi bilgisi (resmî sürücü belgesi değil) 🟢 (2026-10-04; [[ADR-0039]])
- **KARAR:** Kimlik servisi, kişinin fiziksel sürücü belgesini uzaktan (belge + canlılık + yüz) inceleyip karttaki sınıfları ve
  tarihleri `urn:tamga:id:DrivingLicenceAttestation:1` ("Sürücü belgesi bilgisi") olarak verir: nitelikli olmayan EAA, yalnız
  SD-JWT VC, kategori yok, süre ≤ kart bitişi ve ≤ 1 yıl, iptal listeli. Resmî sürücü belgesi / mDL değildir; `not_official_licence`
  alanı her zaman açıktır, kart ve doğrulayıcı ekranı aynı ibareyi taşır. Ön koşul cüzdandaki etkin Tamga kimlik belgesinin PAR'da
  sunumudur; karttaki ad ve doğum tarihi eşleşmeli. Kimlik numarası, kısıtlama/sağlık kodu (ve `has_restrictions` olgusu),
  fotoğraf, adres taşınmaz; sınıf okunamazsa belge verilmez. Kimlik iptal/yeniden verme/silme bağlı belgeyi de kapsar. Yetkili
  makam dijital sürücü belgesi verince o ülke için ihraç durur. Gerçek kişilere ihraçtan önce hukuki inceleme.
- **Nerede:** [[ADR-0039]] DL1–DL5; `packages/schemas`, `tamga-platform/apps/id`, güven listeleri (gerçek + sandbox), [[FW-RB-0003]] §10, cüzdan.

### D-ID-9 — Sandbox'ta gerçek kimlik doğrulama 🟢 (2026-10-04, güncellendi 2026-10-05; [[ADR-0040]])
- **KARAR:** Sandbox'ta kimlik akışı iki seçenek sunar: "Gerçek kimliğinle doğrula (Didit)" ve "Hızlı deneme (sahte kişi)";
  seçimsiz akış sahte. Gerçek yol herkese açık (davet kodu isteğe bağlı kip: `TAMGA_IDV_DIDIT_SANDBOX_MODE=invite`; kişiye özel
  ≤ 7 gün tek kullanım, süreli ≤ 72 saat ≤ 25 kullanım). Ayrı sağlayıcı uygulaması yok: gerçek ağın Didit hesabı ve kimlik akışı,
  sandbox'ta `TAMGA_IDV_DIDIT_SANDBOX_*` adlarıyla (sunucuda `sandbox-setup.sh didit-from-main` kopyalar). Ücretsiz aylık kota
  ortak → bütün gerçek oturumlar günlük (15) ve aylık (150) tavana sayılır; dolunca yalnız hızlı deneme; sayaç gece sıfırlamasıyla
  sıfırlanmaz. Kabul edilen riskler: ortak kota, sandbox kullanıcısının anahtarı okuyabilmesi (yalnız `sandbox.env`, root:tamga-sandbox
  640; gerçek ağın .env/PKI'si kapalı; anahtar dönüşümü prosedürü), webhook'un gerçek ağa gitmesi (sandbox webhook'a güvenmez,
  kararı API'den çeker; gerçek ağ bilmediği oturumu yok sayar). Taramadan önce açık test ortamı uyarısı onaylanır. Belgeye kişiden
  yalnız ad, soyad, doğum tarihi geçer; gerçek kimlik ve belge numarası yerine `SANDBOX-…`. Sağlayıcı oturumu her yolda hemen
  silinir (açık kalan gece sıfırlamasında); her şey gece silinir; günlükte kişi verisi yok. ADR-0038 K4/SB3 değişti.
- **Nerede:** [[ADR-0040]] RI1–RI7; `ADR-0038/SB3` (yeni metin); `tamga-platform/apps/id` (sandbox kipi), sandbox portalı, `ops/server/sandbox-setup.sh`.

### D-ID-10 — Yaş sınırı yok: AB yaklaşımı 🟢 (2026-10-08; [[ADR-0043]])
- **KARAR:** Ağ yaş sınırı koymaz: ne ağda listelenen cüzdanlar (güven listesine kayıt şartı) ne de ağın kimlik servisi ve kimlik
  belgesi için asgari yaş vardır; eIDAS 2.0 (Tüzük (AB) 2024/1183) cüzdan için asgari yaş öngörmez. Şart, geçerli bir kimlik
  belgesiyle kimlik doğrulamasıdır. Ağdaki cüzdanlar kendi hukukları başka türlüsünü gerektirmedikçe aynı yaklaşımı izler; belge
  türüne uygunluğu (ör. öğrenci kartı) belge veren belirler. Sonraki iş: veli onayı akışı (GDPR m. 8; Türk hukukunda 18 yaş altı
  sınırlı ehliyet — hukuki inceleme, ayrı karar) ve kimlik doğrulama sağlayıcısının küçükler için sınırının teyidi.
- **Nerede:** [[ADR-0043]] YS1–YS2; [[FW-RB-0003]] §3, [[SPEC-ID-0003]] §9.

### D-TRUST-4 — Sandbox'ta kurum test hesapları 🟢 (2026-10-04; [[ADR-0041]])
- **KARAR:** Kurum sandbox sayfasından e-posta doğrulaması olmadan test kurumu açar (yalnız uydurma kurum adı + tür; ad "(TEST)"
  ile biter), ilk yönetici passkey ile `console.sandbox.tamga.network`'e girer; konsol sandbox'ta yalnız test kurumlarına açılır.
  Kayıtlar elle ya da CSV ile; kimlik numarası sağlamasını geçen 11 haneli sayı reddedilir. Yaprak sertifikalar ayrı bir ara
  sertifika makamından ("Tamga Sandbox Test Institutions CA (TEST)", yol uzunluğu 0; kök anahtarı sunucuda değil); kurum sandbox
  listesine `test_institution: true` ile kendiliğinden eklenir. Her gece silinir (7 gün reddedildi). Sınırlar: 30 kurum (dolunca en eski boş kurum yer açar), 10 dk'da 10
  açılış, kurum başına 200 kayıt, CSV'de 200 satır, saatte 100 teklif; IP kullanılmaz. Resmî kurum sözcükleri ve listedeki adlar RED. Aşama 1 eğitim; aşama 2 bilet, cüzdan
  başlatmalı ihraç, API anahtarı. ADR-0038 K1/K7 kurumlar için değişti.
- **Nerede:** [[ADR-0041]] TI1–TI6; [[SPEC-TRUST-0001]] §4 `test_institution`; `ops/gen-pki.ts` (sandbox ara makam),
  `apps/trust-publisher` (`sandbox-institution`), `tamga-platform` issuer + Kurum Konsolu (sandbox kipi), sandbox portalı.

### D-REVIEW-1 — Mağaza incelemesi için tek kullanımlık inceleme kodu 🟢 (2026-10-01; [[ADR-0033]])
- **KARAR:** Mağaza inceleyicisi kimlik akışını gerçek kimlik belgesi olmadan, tek kullanımlık ve en çok 14 gün geçerli bir
  inceleme koduyla dener. Kod kimlik servisinin aydınlatma sayfasına girilir; yalnız o oturumda sahte kimlik doğrulama sağlayıcısı
  kullanılır ve ayrı DEMO imzacısı en çok 7 gün geçerli deneme belgesi verir. Deneme belgesi gerçek doğrulayıcı ve kurumlarda
  geçmez. Kod özetiyle saklanır, kullanımı günlüğe yazılır.
- **Nerede:** [[ADR-0033]]; kimlik servisi, güven listesi (DEMO imzacısı yetkisiz), mağaza inceleme notu.

### D-PROTO-2 — HAIP 1.0: doğrulayıcı istemci kimliği `x509_hash`, WIA `sub` ortak değer 🟢 (2026-10-01; [[ADR-0034]])
- **KARAR:** İmzalı istekte doğrulayıcı yalnız `x509_hash` istemci kimliğini kullanır (erişim sertifikasından hesaplanır,
  ayardan okunmaz); cüzdan yalnız onu kabul eder (HAIP 1.0 §5, OpenID4VP 1.0 §5.9.3). Güven listesi RP kaydında kalıcı kimlik
  `dns_name` (sertifikanın SAN'ında); kopya ayrımı, takma ad, geçiş kartı `aud`'u, günlük ve aracı ilişkileri ona bağlanır —
  sertifika yenilemesi hesapları ve kartları bozmaz. WIA `sub` = cüzdan çözümünün kimliği, bütün örneklerde ortak (§4.4.1).
- **Nerede:** [[ADR-0034]] CI1–CI6; core, trust, trust-publisher, verifier, wallet-core, cüzdan, Tamga Verify, cüzdan
  sağlayıcısı, platform issuer'ı. Sertifika yenileme: önce liste, sonra sunucu.

### D-ZK-1 — Sıfır bilgi ispatlı mdoc sunumu: Longfellow, ilk yüklem yaş 🟢 (2026-10-01; [[ADR-0032]])
- **KARAR:** Kurum belgeleri değişmeden (ECDSA P-256 mdoc) cüzdan Longfellow ZK (devre sürümü ≥ 8) ile ispat üretir; ilk yüklem
  `age_over_18`. Doğrulayıcı yalnız imzalı güven listesindeki devre özetlerini kabul eder; ZK yoksa bugünkü toplu kopya yolu.
  Aşama 1 (masaüstü) tamam: ispat 518 ms, doğrulama 211 ms, ~343 KB; 11 negatif test. Aşama 3 (doğrulayıcı) yayında; Aşama 2:
  ispatçı paketi `@tamga-network/zk` ve cüzdan bağlantısı tamam, Android yerel kütüphanesi derlendi (2026-10-07), iOS xcframework
  ve cihaz ölçümü bekliyor (mağaza derlemesi, Z1). İptal denetlenemeyen ZK sunumunu politika `accept_unrevocable_zk` ile açıkça
  kabul eder (ZK4).
- **Nerede:** [[ADR-0032]] ZK1–ZK6; `tools/zk-circuit/` (deney, üretimde değil). Backlog Z5.

### D-PRIV-1 — Site başına takma ad 🟢 (2026-10-01; [[ADR-0031]])
- **KARAR:** "Tamga ile giriş yap" siteye belge özeti ya da kimlik numarası göndermez. Kimlik servisi kişinin kimliğinden ayrı
  bir anahtarla tohum türetir (saklamaz; `urn:tamga:id:PseudonymSeed:1`, hiçbir siteye sunulmaz); cüzdan her site için ayrı,
  kararlı takma ad anahtarı türetir. Siteler kişiyi eşleştiremez; yeni telefonda kimlik yeniden doğrulanınca aynı takma adlar
  döner; varsayılan olarak kişi başına sitede tek hesap. Bilinen zayıflama: kimlik servisi anahtarı + kimlik numarası birleşirse
  takma ad hesaplanabilir (anahtar KMS/HSM, kullanım günlüğü). Kesin kanıt ileride sıfır bilgi ispatıyla (Z5).
- **Nerede:** [[ADR-0031]] PS1–PS6; kimlik servisi, şemalar, wallet-core, verifier (+/web), verify, cüzdan. S-17'yi kapatır.

### D-NAME-3 — Ürün adları: Tamga Wallet, "Tamga ile giriş yap", Tamga Verify 🟢 (2026-09-30; [[ADR-0030]])
- **KARAR:** Cüzdan uygulaması **Tamga Wallet**; web girişi **"Tamga ile giriş yap"** (en "Sign in with Tamga", tk "Tamga bilen
  gir"); barındırılan doğrulayıcı **Tamga Verify**. "TamgaID" ürün adı olarak kullanılmaz; `tamga-id`, `id.tamga.network`,
  `urn:tamga:id:*` adres/tanımlayıcı olarak kalır. **Neden:** cüzdan yalnız kimlik değil (belgeler, ileride ödeme ve varlık);
  tek ürün tek ad.
- **Nerede:** [[ADR-0030]] PN1–PN4; site, docs, verify, sözlük, marka sayfası.

### D-SCHEMA-5 — Geliştirme evresinde şemalar yerinde düzeltilir 🟢 (2026-09-30; [[ADR-0029]])
- **KARAR:** Beta yayınına kadar (`SCHEMA_STAGE = "development"`) şemalar aynı sürüm yolunda düzeltilir; eski deneme belgeleri
  yeniden alınır. D1 ve küçük sürüm kuralı ([[ADR-0010]] K4) beta ile (`stable`) başlar.
- **Nerede:** [[ADR-0029]] DS1; `packages/schemas` (`SCHEMA_STAGE`, build).

### D-WALLET-2 — Günlüğün kişinin başlattığı şifreli dışa aktarımı (AB TS10) 🟢 (2026-09-29; [[ADR-0027]])
- **KARAR:** Sunum ve olay günlüğü cihazdan yalnız kişinin başlattığı, kişinin parolasıyla şifreli (PBES2-HS256+A128KW,
  A128GCM; AB TS10 §5) dışa aktarmada çıkar: işlem günlüğü dosyası ya da taşıma dosyası. Otomatik, arka planda ya da
  sunucuya dışa aktarma yok; düz JSON yok. İçe aktarmada günlüğün geri yüklenmesi kişiye sorulur. WL4 daralır.
- **Nerede:** [[ADR-0027]] LX1–LX2; wallet-core `ts10`, cüzdan taşıma ekranı, SPEC-WALLET-0001 v1.2.0.

### D-REG-1 — Katılımcı kayıt verisi: AB ortak veri seti 🟢 (2026-09-29; [[ADR-0024]])
- **KARAR:** Doğrulayıcı ve belge veren kayıtları AB ortak veri setini taşır (CIR 2025/848 Ek I; TS5/TS6): ticari ad, resmî
  kimlik no, adres, iletişim, hizmet açıklaması, kullanım başına amaç + gizlilik politikası, kamu kurumu işareti, yetki türü,
  aracı ilişkisi, veri koruma kurumu (KVKK). Yalnız kurumlar; cüzdan gizlilik politikasını gösterir.
- **Nerede:** [[ADR-0024]] RPR1–RPR3; güven listesi şeması, trust-publisher, cüzdan onay ekranı.

### D-REG-2 — Kayıt sertifikaları (WRPRC) 🟢 (2026-09-29; [[ADR-0026]])
- **KARAR:** Tamga geçici kayıt kurumu olarak her doğrulayıcı kullanımı ve her belge veren için ETSI TS 119 475 kayıt sertifikası
  (`rc-wrp+jwt`, JAdES B-B, ≤ 12 ay) üretir; içerik yalnız imzalı güven listesinden, imza ayrı kayıt kurumu anahtarıyla (LOTL
  `roles.registrar`). Doğrulayıcı `verifier_info` (`registration_cert`) ile taşır; cüzdan imza, süre, erişim sertifikasındaki
  `organizationIdentifier` bağı ve istenen alanları denetler. Kimlik numarası olmayan kayda sertifika üretilmez.
- **Nerede:** [[ADR-0026]] WRC1–WRC4; trust-publisher, gen-pki / pki-issue, verifier, wallet-core.

### D-ID-7 — Kimlik servisi nitelikli olmayan EAA, güvence I2 🟢 (2026-09-29; [[ADR-0022]])
- **KARAR:** Tamga kimlik servisi güven listesinde QUALIFIED / I3 yerine `class: EAA`, `assurance: I2`; kimlik belgesi
  `category` claim'i taşımaz; kimlik belgesini isteyen politikalar I2 ister. Bağımsız uygunluk değerlendirmesinden sonra ADR ile
  yükseltilir. D-ID-6'nın sınıf satırını değiştirir.
- **Nerede:** [[ADR-0022]] IDC1–IDC2; güven listesi kaydı, IdentityAttestation şeması, `apps/id`, kurum kimlik eşleştirme politikası.

### D-DOCS-1 — Belge yayını üç kapı: Genel · Geliştirici · Tamga ARF 🟢 (2026-09-27; [[ADR-0018]])
- **KARAR:** Genel anlatım `tamga.network/docs`; geliştirici belgeleri `docs.tamga.network`; çerçeve belge seti **Tamga ARF**
  adıyla `arf.tamga.network`'te (ana belge + Ek A Trust Framework, Ek B katılımcı kuralları, Ek C attestation rulebook'ları),
  İngilizce + Türkçe; Türkçe kaynak, İngilizce aynı sürümün resmî çevirisi.
- **Nerede:** [[ADR-0018]] DY1–DY3; `arf/`, `scripts/arf-sync.mjs`, `docs/.vitepress/config.ts`, `tamga-web` menüsü, ops nginx.

---

## 1. Bu Turda Kapatılan Yeni Kararlar (2026-09-03)

### D-CRED-1 — Credential formatı ve protokoller 🟢
- **KARAR:** SD-JWT VC (birincil) + mdoc/ISO 18013-5 (ikincil, 2. faz); ihraç **OpenID4VCI**,
  sunum **OpenID4VP**, imza **ES256 (P-256)**; **holder binding (`cnf`) istisnasız zorunlu**;
  Wallet Unit Attestation baştan; revocation → Token Status List.
- **Nerede:** [[ADR-0006]], [[SPEC-CRED-0001]].

### D-ASSUR-1 — İki eksenli assurance + devletsiz bootstrap 🟢
- **KARAR:** Güven iki eksende — holder **T0–T3** × issuer **I1–I3**, verifier kararı
  **çarpım**. Devletler gelene kadar güven mevcut kurumlardan **devralınır** (e-imza=T3,
  banka/GSM=T1, KYC/kurum masası=T2). Kendi seviyelerimiz eIDAS LoA'ya **1:1** eşlenir.
  Assurance decay + kullanıcıya sayı göstermeme.
- **Nerede:** [[ADR-0005]], [[PM-ASSUR-0001]]; senkron: [[PM-ID-0001]] §6.2, [[SPEC-BC-0001]]
  (`IssuerAssurance` alanı), [[ARCH-0001]] Faz 0.

### D-GTM-1 — Pazara giriş / pilot yönü 🟢 (yön kararı)
- **KARAR (yön):** Pilot sırası, genişleme önceliği ve ticari model proje yönetiminin kararıdır; ayrıntıları operatörün
  özel kayıtlarındadır (2026-09-30'da kamuya açık kütükten taşındı; karar değişmedi). Kamuya açık kısım: ilk belge veren
  kurum bir üniversitedir; kişiler için cüzdan ücretsizdir.
- **Nerede:** pilot planı [[PM-GTM-0001]] (özel); assurance temeli [[PM-ASSUR-0001]].

---

## 2. Kimlik & DID

### D-ID-1 — Kurumsal kimlik: X.509 🟢 (2026-08-06)
- **KARAR: X.509** (`issuerId = keccak256(stateCode, certFingerprint)`); vatandaşa küresel
  ID yok (pairwise pseudonym); EVM hesabı değişmez. → [[ADR-0004]], [[SPEC-ID-0002]].

### D-ID-2 — Onboarding / kimlik-ispatı yöntemi 🟢
- **KARAR:** **LoA'ya göre karma** ([[PM-ASSUR-0001]] ile hizalı):
  - **T3** = e-imza/NES/Mobil İmza challenge (Faz 0, devletsiz) → Faz 1'de NFC'li eID / e-Devlet.
  - **T2** = uzaktan kimlik tespiti (belge OCR + selfie/liveness) veya kurum kayıt masası.
  - **T1** = banka mikro-transfer / GSM hat doğrulaması.
- **Nerede:** [[PM-ID-0001]] §7, [[PM-ASSUR-0001]]. Teknik derinlik → RS-PID-ISSUANCE (planlı,
  engelleyici değil).

### D-ID-3 — Vatandaş-olmayanlar (mülteci, vatansız, turist, gözlemci) 🟢 (yön)
- **KARAR (yön):** Host-devlet veya yetkili kurum tarafından verilen **düşük-LoA misafir
  kimliği** (Faz 0'da kurumsal issuer üzerinden T0–T1). Öncelik vatandaşlarda; misafir
  profili sonraki fazda uygulanır.
- **Nerede:** [[PM-ID-0001]] §7.

### D-ID-4 — Kurumsal / nesne kimlikleri 🟢 (yön)
- **KARAR (yön):** Kurum → tescil edildiği devlete X.509 ile bağlanır ([[ADR-0004]] zaten
  kurumsal kimliği kapsar). Nesne → sahibinin/tescilin devletine bağlanır. Formalizasyon
  D-ID-4 kapsamında ilgili SPEC'e (nesne kimliği ihtiyacı doğduğunda) bırakıldı.
- **Nerede:** [[ADR-0004]], [[SPEC-ID-0002]].

### D-ID-5 — X.509 teknik ayrıntıları 🟢 (2026-08-06)
- **KARAR:** SPEC-ID-0002 yazıldı (RootCARegistry, rollover, 5-adım doğrulama, iki katmanlı
  iptal, pseudonym multicodec, eIDAS/did:web köprüsü). Alt-detaylar SPEC-ID-0002 §10.

---

## 3. Guardian & Escrow

### D-GRD-0 — Guardian/Escrow çekirdeği 🟢
- **KARAR:** Kurumsal 5'li + yürütme-dışı kuralı; DKG + threshold ElGamal (reconstruction
  yok); iki katmanlı verifiable-encryption escrow enrollment; acil mod 2/5+48s; sınır-ötesi
  tabiyet ilkesi. → [[SPEC-BC-0002]], [[PM-ID-0002]].

### D-GRD-1 — Kriptografik primitifler ⚪ (denetime bağlı)
- **KARAR (öneri, denetimle kesinleşir):** verifiable-encryption = **Camenisch-Shoup**
  (NIZK ispatlı) birincil aday; court-token = **EIP-712** imzalı yetki; commitment =
  **Pedersen**; `getStatistics` = on-chain sayaç. Nihai seçim **bağımsız kripto denetimiyle**
  kilitlenir (üretim önkoşulu).
- **Nerede:** [[SPEC-BC-0002]] §12.

### D-GRD-2 — Escrow Store operasyonu ⚪ (uygulama)
- **KARAR (yön):** Off-chain escrow store **coğrafi dağıtık HSM** + air-gap; threshold
  payları asla aynı yerde bulunmaz; HA/yedekleme her guardian kurumunda bağımsız. Somut
  topoloji `services/` implementasyonunda.

---

## 4. Yönetişim (PM-GOV-0001 planlı)

### D-GOV-1 — Guardian 5 rolünün Türk tüzel eşlemesi 🟢
- **KARAR:** Yargı = yetkili **mahkeme/hâkimlik**; veri-koruma = **KVKK (Kişisel Verileri
  Koruma Kurumu)**; nüfus/kimlik = **NVİGM (Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü)**;
  ombudsman = **Kamu Denetçiliği Kurumu (KDK)**; parlamento-atamalı = **TBMM-atamalı bağımsız
  üye**. Yürütme-dışı koltuk kuralı: en az 1 onay yürütme-dışından (KVKK/KDK/TBMM/yargı).
- **Nerede:** PM-GOV-0001'in ana ekseni (yazılacak); ilke [[SPEC-BC-0002]], [[PM-ID-0002]].

### D-GOV-2 — Faz devir eşikleri 🟢
- **KARAR:** **Başlangıç (2026-09-24, [[ADR-0009]] K4):** zincir ancak **≥2 bağımsız validator
  operatörü** yazılı kabul verdiğinde kurulur; öncesi Faz B (imzalı listeler). Vakıf, **≥3 devlet**
  eşit validator olarak katıldığında kendi validator sayısını azaltmaya başlar; **≥4 devlet +
  ≥12 ay kesintisiz operasyon** koşulunda consensus'tan tamamen çıkar (yalnızca operasyonel
  destek kalabilir). → [[ARCH-0001]] §3.
- **Nerede:** PM-GOV-0001 (formalize), [[ARCH-0001]].

### D-GOV-3 — Kurum full-node akreditasyonu 🟢 (yön)
- **KARAR (yön):** Kurum X.509 kimliği + **uptime/güvenlik SLA'i** + yıllık denetim; validator
  değil (imzalamaz). Detay PM-GOV-0001.

### D-GOV-4 — Acil-durum modu hukuki çerçevesi 🟢 (yön)
- **KARAR (yön):** 2/5 + 48s acil erişim, **sonradan zorunlu yargısal onay** + değiştirilemez
  audit log açıklaması gerektirir; onay gelmezse erişim geçersiz sayılır ve bildirilir.
  → [[SPEC-BC-0002]] §8, PM-GOV-0001.

---

## 5. Ağ & Kontratlar

### D-NET-1 — QBFT vs IBFT 2.0 🟢
- **KARAR: QBFT** (Besu default + aktif geliştirme; IBFT 2.0'ın olgunlaşmış hali).
- **Nerede:** [[ARCH-0002]], [[RS-FRAMEWORKS-0001]] §9.

### D-NET-2 — Faz 0 validator sayısı 🟢
- **KARAR: 4 validator** (QBFT 3f+1 → f=1 tolerans), coğrafi/operasyonel dağıtık.
- **Nerede:** [[ARCH-0001]] §3.

### D-NET-3 — Ölçek stratejisi (>~20 devlet) 🟢 (yön)
- **KARAR (yön):** İlk aşamada QBFT ayarıyla ilerle; devlet sayısı büyürse **bölgesel/
  hiyerarşik** yapı araştırılır (ayrı RS, ihtiyaç doğduğunda). Engelleyici değil.

### D-NET-4 — Kontrat upgrade deseni 🟢
- **KARAR: UUPS proxy** (yükseltme yönetimi Governance 2/3 protokol-yükseltme altında,
  çoklu-imza).
- **Nerede:** [[SPEC-BC-0001]] Açık Konular → kapandı.

### D-NET-5 — Cross-recognition gaz/okuma optimizasyonu ⚪ (uygulama)
- **KARAR (yön):** mapping tabanlı `isRecognizedBy` sorgusu + büyük N için off-chain index.
  Somut optimizasyon `contracts/` implementasyonunda.

---

## 6. Değer / Yetkilendirme Katmanı

### D-AUTH-0 — Değer katmanı = yetkilendirme, mutabakat değil 🟢
- **KARAR:** + 5 bağlayıcı kanca. → [[PM-AUTH-0001]], [[ADR-0003]].

### D-AUTH-1 — İşlem-grafiği mahremiyeti 🟢 (yön) ⚠️
- **KARAR:** **Aşama 2 modeli benimsenir** (para bankada/CBDC'de; zincirde yalnızca
  tetikleyici/yetkilendirme) → gözetim yüzeyi doğal olarak azalır. On-chain mutabakata
  (Aşama 3+) **geçilmez** — geçilecekse önce **RS-PRIVACY** (confidential-tx / off-chain
  mutabakat) araştırması şarttır.
- **Nerede:** [[PM-AUTH-0001]]; RS-PRIVACY (planlı, Aşama 3 önkoşulu).

### D-AUTH-2 — Agent delegasyon kontratı 🟢
- **KARAR:** [[SPEC-AGENT-0001]] **yazıldı**; ilkeler [[ADR-0003]] Karar 3'te sabit
  (süreli/`validUntil` zorunlu, anında iptal/kill switch, sorumluluk velide, agent
  credential sunamaz, `scope` genişletilebilir/`pay:*` Faz 0 dışı).
- **Nerede:** [[SPEC-AGENT-0001]] §5.

### D-AUTH-5 — Credential-gating Faz 0'da zincir dışıdır 🟢 (2026-09-10)
- **KARAR:** **Faz 0'da zincir üstü credential-gating YOKTUR.** [[ADR-0008]] ile iptal
  listesi zincir dışına çıktığından zincir bir credential'ın geçerliliğini göremez;
  `CredentialGate`/`requiresCredential` bir zincir primitifi olarak yazılmaz. Doğrulama
  off-chain'de ([[SPEC-API-0001]]) yapılır. [[ADR-0003]] Karar 4 bu yönde daraltıldı.
  Gelecek açılma yolu (kayıtlı `ACTIVE` verifier'ın imzalı beyanı + tazelik ≤15 dk +
  tek kullanımlık nonce) **tasarım olarak** kayıtlıdır; güven "zincir credential'ı
  doğrular"dan "zincir kayıtlı verifier'a güvenir"e kayar.
- **Nerede:** [[SPEC-AGENT-0001]] §3–§4, [[ADR-0003]] Karar 4 (daraltma notu).

### D-AUTH-3 — Varlık cüzdanı kurtarma kompozisyonu 🟢
- **KARAR:** Kullanıcı-seçimli **3-of-5** (aile/güvenilen + opsiyonel kurum) + **72 saat
  zaman kilidi**; kimlik escrow'undan ayrı. Sayısal detay/senaryolar → PM-ID-0003.
- **Nerede:** [[ADR-0003]] Karar 2.

### D-AUTH-4 — FINANCE issuer akreditasyonu 🟢 (yön)
- **KARAR (yön):** Token ihraç izni yalnızca **merkez bankası / BDDK-lisanslı bankalar**
  (FINANCE kategorisi, `onlyOwnerState`). Devlet başına yetkilendirme. → PM-GOV-0001.
- **Nerede:** [[ADR-0003]] Karar 5, [[SPEC-BC-0001]].

---

## 7. Strateji & Felsefe

### D-STR-1 — Çekirdek farklılaşma 🟢
- **KARAR:** Tamga'yı EBSI'den ayıran çekirdek fark = **kimlikten yetkilendirme/değer
  katmanına genişleme** (coğrafyanın ötesinde). EBSI kimlik/credential ile sınırlıyken
  Tamga "kim neye yetkili"yi kanıtlayan, ileride değer akışını tetikleyen bir yetkilendirme
  omurgasıdır ([[PM-AUTH-0001]]). Bu, bilinçli açık bırakılan farkın kapatılmasıdır.
- **Nerede:** [[PM-PH-0001]] "çekirdek farklılaşma" açık sorusu → kapandı; [[PM-AUTH-0001]].

### D-STR-2 — Genişleme kapsamı 🟢 (2026-08-06)
- **KARAR:** Yetkilendirme katmanı ol, mutabakat değil. → [[PM-AUTH-0001]], [[ADR-0003]].

### D-STR-3 — Türk Devletleri Teşkilatı ile ilişki 🟢 (yön)
- **KARAR (yön):** Önce Türkiye'de teknik pilot + kanıt (devletsiz bootstrap sayesinde
  devlet-öncesi mümkün), olgunlaşınca TDT'ye kurumsal/diplomatik yol. Teknik değil,
  stratejik; proje ilerledikçe yürütülür.

### D-STR-4 — EBSI interoperability entegrasyon noktaları 🟢 (yön)
- **KARAR (yön):** Ortak format (**SD-JWT VC**, [[ADR-0006]]) + **did:web/X.509 köprüsü**
  ([[SPEC-ID-0002]]) + eIDAS LoA eşlemesi ([[PM-ASSUR-0001]]). Derin entegrasyon →
  RS-EBSI-0001 genişletme (ihtiyaç doğduğunda).

---

## 8. Web / Ürün (detay: `../tamga-web/todos.md`)

### D-WEB-1 — Web X.509 güncellemesi 🟢 (2026-08-06, tamam)

### D-WEB-2 — Manifesto & Whitepaper kaynak dokümanları 🟡 (dış girdi)
- **KARAR:** Mevcut docs/whitepaper kaynak olarak yeterli; ek kaynak metin geldiğinde
  web içeriği + Typst PDF yeniden derlenir. **Engelleyici değil.**

### D-WEB-3 — Yeni ana sayfa bölümleri 🟢 (yön)
- **KARAR (yön):** Yol haritası + SSS + "Kimler için?" + bülten eklenir; içerik metinleri
  web turunda yazılır (`../tamga-web/todos.md`).

### D-WEB-4 — Ekosistem adı 🟢
- **KARAR: "Logistics"** (IssuerCategory=LOGISTICS ile tutarlı).

### D-WEB-5 — Analitik aracı 🟢
- **KARAR: Plausible** (self-host, gizlilik-dostu).

### D-WEB-7 — Sitede tedarikçi adı, fiyat dili, "Trust Mesh" 🟢 (2026-09-27)
- **KARAR:** Tanıtım sayfaları, whitepaper ve karşılaştırmada kimlik doğrulama tedarikçisi **genel ifadeyle** ("uzaktan kimlik
  doğrulama sağlayıcısı"); tedarikçi adı KVKK aydınlatma metninde ve teknik belgelerde. Fiyat dilinde yalnızca **"kişiler için
  ücretsiz"** (eIDAS 2.0'daki gibi); kurum ücretleri pilot bitmeden yazılmaz. **"Trust Mesh"** vizyon adı olarak kalır, teknik
  belgelere girmez. 

### D-WEB-6 — Deploy & OG görselleri 🟡 (logoya bağlı)
- **KARAR:** Deploy (sunucu + security + domain) ve OG görselleri **nihai logo** oturunca
  yapılır. Tek dış bağımlılık: logo.

---

## 9. ✅ Temel Karara Bağlananlar (kalıcı arşiv)

| ID | Karar | Nerede |
|----|-------|--------|
| D-BC-0 | Blockchain motoru = **Hyperledger Besu + QBFT** | [[ADR-0001]] |
| D-BC-1 | Rust'tan sıfırdan ağ **reddedildi** | [[RS-FRAMEWORKS-0002]] |
| D-GOV-0 | **Egemenlik-öncelikli yönetişim** (2/3 · onlyOwnerState · tek taraflı tanıma) | [[ADR-0002]] |
| D-GRD-0 | **Guardian/Escrow** = kurumsal 5'li + DKG threshold ElGamal + escrow enrollment | [[SPEC-BC-0002]], [[PM-ID-0002]] |
| D-ID-1 | **Kurumsal kimlik = X.509** | [[ADR-0004]] |
| D-ID-0 | Pseudonym = self-certifying, pairwise, unlinkable | [[SPEC-ID-0001]] |
| D-AUTH-0 | **Değer katmanı = yetkilendirme** + 5 kanca | [[PM-AUTH-0001]], [[ADR-0003]] |
| D-TRUST-0 | Kişisel veri/credential **asla zincirde** | [[PM-TRUST-0001]] |
| D-MONO | **Monorepo** kök = tamga-network | [[MASTER_INDEX]] |
| **D-CRED-1** | **Credential = SD-JWT VC + OpenID4VCI/VP + ES256 + holder binding** | [[ADR-0006]], [[SPEC-CRED-0001]] |
| **D-ASSUR-1** | **İki eksenli assurance (T0–T3 × I1–I3) + devletsiz bootstrap** | [[ADR-0005]], [[PM-ASSUR-0001]] |
| D-ID-esk | Çifte vatandaşlık = hibrit; assurance = eIDAS LoA'ya 1:1 | [[PM-ID-0001]] |
| **D-SCHEMA-1** | **Şema kayıt defteri = off-chain Type Metadata + on-chain çapa**; `vct` kararlı HTTPS URL, `vct#integrity` zorunlu; iki katman NETWORK (2/3 oy) / NATIONAL (`onlyOwnerState`) | [[ADR-0007]], [[SPEC-SCHEMA-0001]], [[PM-SCHEMA-0001]] |
| **D-SCHEMA-2** | **Issuer↔şema yetkisi allowlist**; yetkisiz şemayla imzalanan belge reddedilir (kategori aşımı kapandı) | [[ADR-0007]] K6, [[SPEC-BC-0001]] §3.4 |
| **D-SCHEMA-3** | **Eğitim şemaları ELM v3 semantiğini devralır**; kontrollü sözlükler (EQF, ISCED-F) aynen kullanılır, JSON-LD taşıyıcısı alınmaz | [[RS-SCHEMA-0001]], [[SPEC-SCHEMA-0002]] |
| **D-REV-1** | **Status list off-chain, zincirde yalnızca URI + içerik hash'i + sürüm çapası**; sabit aralıklı ve gürültülü yayın | [[ADR-0008]], [[SPEC-CRED-0003]] |
| **D-REV-2** | **`isRevoked` zincir arayüzü kaldırıldı** — zincir bu soruyu cevaplayamaz | [[ADR-0008]], [[SPEC-BC-0001]] §7.3 |
| **D-REV-3** | **İndeksler rastgele tahsis edilir, liste URI'si opaktır**, listeler yıl/bölüm/kohort ölçütüyle bölünmez | [[SPEC-CRED-0003]] §6 |
| **D-BC-2** | **Yükseltme deseni = UUPS**, yetki Governance 2/3; brick koruması CI'da zorunlu | [[SPEC-BC-0001]] §9 |
| **D-BC-3** | **Doğrulama zamana bağlıdır**: C1/C2 credential `iat`'ını alır (`isCredentialAcceptable`, `isCredentialSchemaAcceptable`); ihraç sorguları doğrulamada kullanılmaz | [[REVIEW-2026-09-09]] R1/R3, [[SPEC-BC-0001]] 2.1.0 |
| **D-BC-4** | **CA `RETIRED` ≠ `REVOKED`**: rotasyon operasyonu ve eski belgeleri sürdürür; ele geçirilme belgeleri düşürür ama status yayını sürer | [[REVIEW-2026-09-09]] R2 |
| **D-BC-5** | **Halef issuer, selefin status listesini yayınlayabilir** | [[REVIEW-2026-09-09]] R4 |
| **D-GOV-1** | **Asgari mutlak oy 2**; iki üyeli ağda çıkarma imkânsız — anayasal koruma | [[REVIEW-2026-09-09]] R6 |
| **D-GOV-2** | Çıkarılmış/çekilmiş devlet yeniden kabul edilebilir | [[REVIEW-2026-09-09]] R7 |
| **D-CRED-3** | **`issuerId` x5c yaprak parmak izinden türetilir**, `iss` claim'inden değil | [[REVIEW-2026-09-09]] R8 |
| **D-CRED-2** | **`typ` = `dc+sd-jwt`**; `vc+sd-jwt` Tamga issuer'larından reddedilir, dış ekosistem için bayrak varsayılan kapalı | [[SPEC-CRED-0002]] §5.1.1 |
| **D-AUTH-5** | **Faz 0'da zincir üstü credential-gating yok** (zincir iptali göremez, [[ADR-0008]]); doğrulama off-chain, ADR-0003 K4 daraltıldı; gelecek yol = kayıtlı verifier imzalı beyanı | [[SPEC-AGENT-0001]], [[ADR-0003]] K4 |
| **D-BC-6** | **Faz B zincirsiz beta**: çapa = imzalı hash-zincirli listeler + çapa günlüğü; zincir ≥2 bağımsız validator operatörüyle | [[ADR-0009]] |
| **D-GTM-2** | Pilot ön koşulları Ö1'/Ö2'/Ö8'; bildirim v2; demo yolu pilotun önünde | [[ADR-0009]] K6 |
| **D-GOV-5** | **TDT-first**: üye devlet slotları, tam ARF rol seti, vekâleten operatör; devir = yalnızca operatör alanı | [[ADR-0009]] K5 |
| **D-SCHEMA-4** | **`vct` = `urn:tamga:…`**, metadata katalogdan, `#integrity` zorunlu; D-SCHEMA-1 süpersede | [[ADR-0010]] |
| **D-CRED-4** | **Kategori sinyali** `urn:tamga:eaa:pub\|qualified` (yalnız PUB/QUALIFIED), C4 çapraz kontrol; holder LoA asla credential'da | [[ADR-0010]] K5 |
| **D-NAME-1** | Alan adı şeması v1.1: `trust` / `schemas` / ~~`wallet`~~ (→ D-GOV-9) / `verify` + yol tabanlı `issuer.tamga.network/{slug}`, `console.tamga.network` (v1.2; ADR-0019), `status.tamga.network/{opak}` | operatörün iç kaydı |

---

## 9b. Değiştirilen (Superseded) Kararlar

| Eski | Ne oldu | Yerine |
|---|---|---|
| Revocation "Yaklaşım B — bitmap zincirde" | **Geçersiz.** Bitmap zincirden çıkarıldı; her iptali zincire yazmak izinli ağda iptalin *anını* tüm validator'lara sızdırıyordu. | **D-REV-1** ([[ADR-0008]]) |
| `SPEC-CRED-0001` §5'teki "... + bitmap" ibaresi | Kod ile spesifikasyon çelişiyordu; çelişki [[ADR-0008]] ile kapatıldı. | **D-REV-1** |
| [[ADR-0003]] Karar 4 (zincir-üstü credential-gating) | **Daraltıldı (kapandı 2026-09-10).** Zincir iptal durumunu göremez ([[ADR-0008]]); Faz 0'da zincir üstü credential-gating yok, `requiresCredential` primitifi yazılmaz. Doğrulama off-chain. | **D-AUTH-5**, [[SPEC-AGENT-0001]] |
| **D-SCHEMA-1** "vct kararlı HTTPS URL" ([[ADR-0007]] K1) | **Süpersede (2026-09-24).** Standarda uygundu; ancak tip kimliğini vakfın alan adına bağlıyordu, TDT-first ile çelişti. `vct` URN, metadata katalogdan; `#integrity` ve çapa aynen. | **D-SCHEMA-4**, [[ADR-0010]] |
| [[SPEC-ID-0003]]/IDP3 "IDV entegrasyonu yalnızca issuer tarafında" | **Yeniden ifade (2026-09-25).** Kimlik ispatı kurumların değil Tamga'nın kimlik servisinin işi; kurum yalnızca attestation sunumunu eşler. TL8 korunur. | **D-ID-6** ([[ADR-0011]]) |
| SPEC-PROTO-0002 §2 / [[ADR-0017]] `client_id = x509_san_dns:<alan adı>` (kayıt dizesi) | **Değişti (2026-10-01).** İmzalı istekte yalnız `x509_hash` (HAIP 1.0 §5); kalıcı kayıt kimliği ayrı alan `dns_name`. | **D-PROTO-2** ([[ADR-0034]]) |
| [[ADR-0025]] K2 WIA `sub` = işleme özel anahtarın parmak izi | **Değişti (2026-10-01).** `sub` bütün örneklerde ortak (çözüm kimliği; HAIP 1.0 §4.4.1); örnek ayrımı yalnız `cnf` + iptal girişi. | **D-PROTO-2** ([[ADR-0034]]) |
| **D-OSS-2** "kullanıcıya görünen marka (TamgaID ile Giriş Yap) değişmez" | **Değişti (2026-09-30).** Cüzdan Tamga Wallet; giriş "Tamga ile giriş yap"; doğrulayıcı Tamga Verify. Paket kapsamı aynı. | **D-NAME-3** ([[ADR-0030]]) |
| [[PM-GTM-0001]] Ö1/Ö2 (kontrat derleme, testnet = pilot ön koşulu) | **Yeniden tanımlandı (2026-09-24).** Tek operatörlü zincir güven üretmez (F1); pilot Faz B listeleriyle başlar. | **D-BC-6 / D-GTM-2**, [[ADR-0009]] |
| [[ARCH-0001]] §3 "Faz 0 = 4 vakıf validator" (başlangıç) | **Daraltıldı (2026-09-24).** Faz 0 ancak ≥2 bağımsız validator operatörüyle başlar; öncesi Faz B. | **D-BC-6**, [[ADR-0009]] K4 |
| D-NAME-1 v1.1 `portal.tamga.network/{slug}` | **Değişti (2026-09-28).** Kurum tarafı `console.tamga.network` (kurum oturumdan; yolda slug yok); öğrenci portalı kaldırıldı. | **D-CONSOLE-1**, [[ADR-0019]] |
| D-GOV-6 yayın satırı (`docs.tamga.network`, Türkçe kanonik, İngilizce v0.2) | **Değişti (2026-09-27).** Çerçeve belgeleri kendi sitesinde (`arf.tamga.network`), İngilizce + Türkçe birlikte; Türkçe kaynak kalır. | **D-DOCS-1**, [[ADR-0018]] |
| `schema.tamga.network` (tekil, SPEC-SCHEMA-0001) | **Yeniden adlandırıldı (2026-09-24).** `schemas.tamga.network` (katalog); alan adı artık tip kimliği değil. Henüz yayın yok, kırılma yok. | **D-NAME-1** |
| D-NAME-1 v1.1 `wallet.tamga.network` (ağın cüzdan sağlayıcı hizmeti) | **Kaldırıldı (2026-10-06).** Ağ cüzdan sağlayıcı işletmez; sağlayıcıyı cüzdanı sunan kuruluş kendi alan adında işletir ve güven listesine kaydolur. | **D-GOV-9** ([[ADR-0042]]) |
| D-ID-6 kimlik servisi `class: QUALIFIED`, I3, `category: urn:tamga:eaa:qualified` | **Değişti (2026-09-29).** Bağımsız uygunluk değerlendirmesi yok; "nitelikli" AB hukuki unvanı. Nitelikli olmayan EAA / I2, belgede kategori yok. | **D-ID-7** ([[ADR-0022]]) |
| SPEC-WALLET-0001/WL7 "Otomatik yenileme yoktur" | **Değişti (2026-09-29).** ARF ISSU_42/45/63: yeniden ihraç mümkün olduğunca kullanıcı eylemi gerektirmez. Yenileme belirteciyle, eşikte ve rastgele gecikmeyle; kimlik/iletişim hariç. | **D-WALLET-1** ([[ADR-0023]]) |
| SPEC-SCHEMA-0001/D1 "yayımlanmış şema asla değişmez" | **Askıda (2026-09-30), beta ile yeniden yürürlükte.** Geliştirme evresinde gerçek kullanıcı yok; şemalar doğrusu bulunana kadar yerinde düzeltilir. | **D-SCHEMA-5** ([[ADR-0029]]) |
| SPEC-WALLET-0001/WL4 "`presentation_log` cihazdan çıkmaz" | **Daraldı (2026-09-29).** AB (CIR 2024/2979 md. 9, 13; TS10) kişinin günlüğünü dışa aktarabilmesini ister. Yalnız kişinin başlattığı, parolalı dosyada; sunucuya asla. | **D-WALLET-2** ([[ADR-0027]]) |
| D-CRED-6 biçimi: tek 30 günlük WUA, `key_storage` WUA beyanında | **Değişti (2026-09-29).** AB TS3: 24 saatten kısa, işlem başına WIA + sağlayıcı imzalı KA + iptal listeleri. İlke (ihraçtan önce cüzdan doğrulaması) aynı. | **D-CRED-7** ([[ADR-0025]]) |
| [[ADR-0035]] üçüncü katman "ürün ve hizmetler" (D-GOV-7: ağ kurumlara hizmet sunar) | **Kısmen değişti (2026-10-02).** Tamga Network yalnızca ağdır, hizmet satmaz; ticari hizmetler (entegrasyon, destek, connector) ağın dışındaki şirkette. Taban ve federasyon katmanı, PO1–PO4 geçerli. | **D-GOV-8** ([[ADR-0037]]) |
| [[ADR-0038]] K4 / SB3 "kimlik doğrulama yalnız sahte sağlayıcıyla" | **Daraldı (2026-10-04), genişledi (2026-10-05).** Sahte sağlayıcı varsayılan (hızlı deneme); gerçek adımlar isteyen herkese, gerçek ağın sağlayıcı hesabıyla, günlük/aylık tavanla ve en az veriyle (gerçek kimlik/belge numarası belgeye yazılmaz). | **D-ID-9** ([[ADR-0040]]) |
| [[ADR-0038]] K1 "sandbox'ta kurum konsolu yok" / K7 kendi kendine kayıt sonraki aşama | **Değişti — kurumlar için (2026-10-04).** Konsol sandbox'ta yalnız test kurumlarına açılır; kurum kendi test kurumunu açar, sandbox listesine otomatik eklenir. Doğrulayıcı ve cüzdan sağlayıcı kaydı hâlâ ayrı karar ister. | **D-TRUST-4** ([[ADR-0041]]) |
| [[ADR-0038]] sandbox'ın test cüzdan sağlayıcısı (`wallet.sandbox`) ağca çalıştırılır | **Değişti (2026-10-06).** Ağ cüzdan sağlayıcı işletmez; sandbox'ta da sağlayıcıyı cüzdan işletir ve sandbox listesine kaydolur. `wallet.sandbox.tamga.network` 2026-10-06'da kaldırıldı; sandbox'ın kendi cüzdan sağlayıcısı yok. | **D-GOV-9** ([[ADR-0042]]) |
| ADR-0011 K3 / ADR-0019 kayıt defteri: kişi kayıtları Tamga veritabanında, teklif ve eşleştirme defterden | **Daraldı (2026-09-29).** Yetkili kaynak kurumda; defter yalnız deneme (sandbox). Teklif kimliğe bağlı, bilgi imza anında kaynaktan. | **D-SRC-1** ([[ADR-0020]]) |
---

## 10. Geriye Kalan Tek Gerçek Bağımlılıklar

Bu turda **her karar kapatıldı.** Yalnızca şu üç madde, doğası gereği dış bir olayı bekler
(karar değil, tetikleyici bekliyor):

1. **D-GRD-1** ⚪ — kripto primitifleri **bağımsız güvenlik denetimiyle** kesinleşir.
2. **D-WEB-6** 🟡 — deploy + OG görselleri **nihai logo** ile.
3. **D-WEB-2** 🟡 — whitepaper içerik revizyonu ek **kaynak metin** gelince.

Bunların hiçbiri mühendislik ilerlemesini engellemez.

**2026-09-09 eki — açık taahhütler:**

**2026-09-09 bağımsız inceleme:** on bulgu (R1–R10) işlendi; bkz.
[[REVIEW-2026-09-09]]. Aşağıdaki açık taahhütler değişmedi.

4. ~~**`SPEC-AGENT-0001`**~~ ✅ **KAPANDI (2026-09-10).** Karar: Faz 0'da zincir üstü
   credential-gating yok ([[ADR-0008]] gereği); [[ADR-0003]] Karar 4 daraltıldı, agent
   delegasyonu resmileştirildi, gelecek açılma yolu tasarım olarak kaydedildi. → **D-AUTH-5**,
   [[SPEC-AGENT-0001]].
5. **Kontrat derlemesi** 🟡 — `contracts/` SPEC-BC-0001 v2.0.0'a göre yeniden yazıldı
   ancak hiç derlenmedi. ADR-0009 ile artık pilotu bloklamaz; Faz 0 (≥2 bağımsız validator
   operatörü) öncesi tamamlanır.
7. ~~**ADR-0009/0010 sonrası spec sürüm güncellemeleri**~~ ✅ **YAPILDI (2026-09-24, 6. tur):** SPEC-SCHEMA-0001 v2.0.0,
   SPEC-SCHEMA-0002 v2.0.0 (erratum `$ref` dahil), SPEC-SCHEMA-0003 v1.1.0, SPEC-CRED-0002 v1.3.0 (C18), SPEC-API-0001 v1.2.0
   (C4, `issuer.class`), PM-ASSUR-0001 v1.1.0, PM-GTM-0001 v2.0.0, ARCH-0001 v0.2.0, SPEC-CRED-0003 v1.0.2, SPEC-BC-0001 v2.1.1,
   ARCH-0003 v1.0.2, SPEC-ID-0002 v0.3.0, SPEC-PROTO-0001 v1.1.0 (§3.3 offer sınıfları DB-5, §11.1 WUA DB-16, PR11–PR12),
   SPEC-CRED-0001 v1.0.4 (§4 WUA profili), SCENARIOS F18 düzeltmesi; yeni **SPEC-TRUST-0001** v1.0.0 (TL1–TL11, DB-11).
   `schema.` → `schemas.` ve `vct` URN tüm SPEC/ARCH/PM belgelerinde (ADR metinleri tarihî, değişmedi). INVARIANTS.md
   `scripts/sync-invariants.mjs` ile üretildi: 20 doküman, 224 kod, çakışma yok. Trust Framework metni FW-TF-0001 (D-GOV-6).
8. **Çerçeve belge seti + kimlik ispatı + depo adları** (2026-09-24, 2. tur) — ~~DB-12~~ ✅ **D-GOV-6**
   ve ~~D-OSS-1 adayı~~ ✅ **D-OSS-1** kabul edildi (§0). Kalan açık: `SPEC-ID-0003`
   Draft (D-ID-2 uygulaması; DB-6 rev./DB-18 satırları onaya bağlı; IDP1–IDP8 `/sync-index` bekliyor);
   demo sapma adayları **S-10** (diploma T2 kimlik ispatı olmadan), **S-11** (cüzdan yerel deposu şifresiz),
   **S-12/S-13** (SAN heuristiği, imzasız RP görünümü), **S-14** (self-reported WUA beyanı) operatörün iç kaydında
   ÖNERİ; FW belgeleri İngilizce + PDF (v0.2). **DB-16 kodda uygulandı** (WUA + PoP başlıkları, operatörün iç kaydı);
   SPEC-PROTO-0001 v1.1 ve SPEC-CRED-0001 §4 metni madde 7 senkronunda. **2026-09-25:** DB-21/DB-22 → [[ADR-0011]] ile
   kapandı (D-ID-6); demo sapması **S-15** (FAKE IDV) ÖNERİ; onay isteği (DB-5/6/16/18, S-10…S-15) açık.
   ✅ **KAPANDI (2026-09-26):** DB-5 → **D-PROTO-1**, DB-16 → **D-CRED-6**, DB-6/DB-6 rev./DB-18 →
   **D-ASSUR-2** ([[SPEC-ID-0003]] Active v1.0.0); demo sapmaları **S-10…S-15, S-17, S-18** kabul (`09` §6'da ÖNERİ etiketi kalktı).
   Açık kalan: **DB-23** (bilet satıcısı / issuer kategori kümesi — ADR gerektirir).
6. ~~**`docs/outputs/` emekliye ayrılması**~~ ✅ **KAPANDI (2026-09-10).** operatörün arşivi
   altına taşındı, duplike silindi, devir README eklendi (K4 uygulandı).

---

## İlgili
[[STATUS]] · [[MASTER_INDEX]] · [[SCENARIOS]] · `../tamga-web/todos.md` · [[WORKSPACE-AUDIT-0001]] (arşiv)
