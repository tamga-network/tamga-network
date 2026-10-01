---
document_id: FW-RB-0001
title: Tamga Rulebook — Katılımcı Kuralları
category: Framework
domain: Governance
status: Active
review_status: Completed
version: 0.4.0
created: 2026-09-24
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: framework
audience:
  - institutions
  - integrators
  - operators
  - engineers
  - ai-agents
stability: Evolutionary
maturity: Draft
tags:
  - framework
  - rulebook
  - requirements
  - roles
  - obligations
keywords:
  - Tamga rulebook
  - participant rules per role
  - trusted list scheme operator rules
  - attestation provider rules
  - wallet provider rules
  - relying party rules
  - holder rights
  - normative MUST rules with source citations
related:
  - FW-ARF-0001
  - FW-TF-0001
  - FW-RB-0002
  - INVARIANTS
  - PM-GOV-0001
  - SPEC-PROTO-0001
  - SPEC-PROTO-0002
  - SPEC-CRED-0002
  - SPEC-CRED-0003
  - SPEC-WALLET-0001
  - SPEC-API-0001
  - SPEC-SCHEMA-0001
depends_on:
  - FW-ARF-0001
  - FW-TF-0001
summary: >
  Tamga ekosistemine katılan her rolün (operatör/TLSO, Registrar, Attestation Provider,
  Authentic Source, Wallet Provider, Relying Party, Holder) uyması gereken bağlayıcı,
  numaralı kurallar. Her kural kanonik bir değişmezden veya karardan türetilmiştir ve
  kaynağına atıf verir; bu belge yeni kural üretmez, kuralları rol bazında toplar ve
  "MUST" diliyle ifade eder. EUDI ARF Annex 2 (High-Level Requirements) muadilidir.
priority: Critical
---

# 0. Okuma kılavuzu

- **Kural biçimi:** `RB-<ROL>-<NN>` · kural metni · kaynak (`DOC-ID/KOD` veya karar).
- **Anahtar kelimeler** RFC 2119 anlamındadır: **MUST** (zorunlu), **MUST NOT** (yasak),
  **SHOULD** (tavsiye; sapma gerekçelendirilir), **MAY** (isteğe bağlı).
- **Faz notu:** "Faz B" ile işaretli kurallar zincirsiz beta için okumadır; zincir geldiğinde
  "liste/çapa günlüğü" yerine "zincir" okunur. Kural metni değişmez.
- **Kaynak yoksa** kural "ÖNERİ" etiketlidir ve onaya kadar bağlayıcı değildir.
- Kurallar **INVARIANTS'a yeni kod eklemez**; INVARIANTS'taki kodların rol bazlı görünümüdür.
  Bir kuralı değiştirmek için kaynak dokümanı değiştirin.

Roller: GEN (herkes) · OP (operatör/TLSO) · REG (Registrar) · AP (Attestation Provider / issuer) ·
AS (Authentic Source) · WP (Wallet Provider) · RP (Relying Party) · H (Holder) · SCH (tip/şema).

---

# 1. RB-GEN — Tüm katılımcılar

| # | Kural |
|---|---|
| RB-GEN-01 | Katılımcı, ortak kayıtlara (güven listesi, çapa günlüğü, zincir), loglara ve API yanıtlarına **MUST NOT** kişisel veri, credential içeriği veya credential hash'i yazmak. |
| RB-GEN-02 | Katılımcı, güven verisini **MUST** yalnızca `TrustSource` arayüzü (veya onu saran resmî SDK) üzerinden okumak — cüzdan dahil (`@tamga-network/trust/core`); liste dosyalarını doğrudan yorumlayan iş mantığı **MUST NOT**. |
| RB-GEN-03 | Güven kaynağı bayat (`next_update` geçmiş) veya erişilemez ise sonuç **MUST** `INDETERMINATE`/`UNKNOWN` olmak; asla `ACCEPTED`, asla `REJECTED`. |
| RB-GEN-04 | Bilinmeyen `list_format_version` veya kontrat sürümü görüldüğünde bileşen **MUST** durmak ve alarm vermek; kabul etmek yasaktır. |
| RB-GEN-05 | Hiçbir Tamga altyapı bileşeni **MUST NOT** IP adresi loglamak (ham, karma veya kısaltılmış). Hata ayıklama logu ≤ 7 gün ve IP'siz. |
| RB-GEN-06 | Loglar ve denetim kayıtları claim **adı** taşıyabilir, claim **değeri** ve status `idx` **MUST NOT**. |
| RB-GEN-07 | Katılımcı, Tamga'nın resmî `@tamga-network/*` paketlerini kullanıyorsa yayın provenance'ını doğrulamalı (**SHOULD**); paketlerde `postinstall` betiği **MUST NOT**. |
| RB-GEN-08 | Dışarıya doğru assurance ifadeleri eIDAS adlarıyla (Low/Substantial/High; EAA/qualified-eşdeğeri/PuB) yapılır; kullanıcıya sayısal seviye gösterilmez (**SHOULD**). |
| RB-GEN-09 | Her katılımcı, kendisini ilgilendiren SEV1 olayını **MUST** ≤ 4 saatte, SEV2'yi ≤ 24 saatte scheme owner'a bildirmek. |
| RB-GEN-10 | Faz B boyunca her katılımcı, kayıtların **tek operatör imzasına** dayandığını ve iptalin ≤ 90 dk'da etkili olduğunu bilir; kişilere bu sınırlar yazılı bildirilir. |

---

# 2. RB-OP — Operatör / Trusted List Scheme Operator (TLSO)

Faz B'de Tamga (provisional); devirde ulusal otorite.

| # | Kural |
|---|---|
| RB-OP-01 | Her liste (`lotl`, `tl-<cc>`) **MUST** `operator {name, status, on_behalf_of}` taşımak; beta boyunca `status = "provisional"`. |
| RB-OP-02 | Liste sürümleri **MUST** monoton artmak, `previous_version_hash` taşımak; hiçbir satır silinmez, statü değişiklikleri `status_history`'ye eklenir. |
| RB-OP-03 | `next_update` **MUST** ≤ 90 gün; değişiklik olmasa da liste yeniden imzalanır; değişiklik **MUST** ≤ 24 saatte yayınlanmak. |
| RB-OP-04 | Çapa günlüğü (`anchors.jsonl`) **MUST** saatlik imzalanmak (heartbeat dahil); her satır `previous_hash` taşır; satır silinmez. |
| RB-OP-05 | Liste imzası **MUST** ≥ 2 kaydırmalı sertifikayla yapılmak; rotasyon ≥ 30 gün önce duyurulur; yeni anahtar eskisiyle imzalanır. (Demo sapması S-6 beyanlı.) |
| RB-OP-06 | Kök parmak izleri **MUST** `keys/root-fingerprints.json` + `tamga.network/trust-anchor` kalıcı sayfasında + Trust Framework ve sözleşme eklerinde aynı değerlerle yayınlanmak. |
| RB-OP-07 | Herkese açık `CHANGELOG.md` **MUST** tutulmak: kim, ne zaman, ne (ekleme/askı/çıkarma/yetki), gerekçe kodu. |
| RB-OP-08 | Operatör **MUST NOT** barındırdığı hiçbir hizmette imzalama anahtarı tutmak (issuer credential/status anahtarı kurumundur). |
| RB-OP-09 | Operatör **MUST NOT** barındırılmış indeksleyici hizmeti sunmak; referans dağıtım yayınlar. Barındırılan doğrulayıcı (aracı) sunulabilir; kuralları RB-OP-17. |
| RB-OP-10 | Barındırılan issuer'ların listesi kamuya açıktır; oran > %30 ise konsey gündemine girer (tripwire). |
| RB-OP-11 | Şema/status kullanım istatistikleri yalnızca toplu; kova < 50 yayınlanmaz; issuer/verifier/credential bazında sayaç tutulmaz; ham sayaç ≤ 13 ay. |
| RB-OP-12 | Şeffaflık raporu **MUST** üç ayda bir, gecikmesiz yayınlanmak. |
| RB-OP-13 | Alan adı vakıf tüzel kişiliği adına; transfer kilidi + DNSSEC; ≥ 10 yıl yenileme; halefiyet sözleşmesi. |
| RB-OP-14 | TDT-first: her ulusal liste slotu ve ARF rol slotu **MUST** var olmak (boş olsa da); devir yalnızca `operator` alanını değiştirir; `ca_id`/`issuer_id`/`vct` **MUST NOT** değişmek. |
| RB-OP-15 | Zincir **MUST NOT** ≥ 2 bağımsız validator operatörünün yazılı kabulü olmadan kurulmak; geçiş replay + eşdeğerlik testi geçmeden tamamlanmış sayılmaz. |
| RB-OP-16 | Yayınlanan şema dosyaları (`schemas.`) **MUST** değişmez olmak; CDN'de yeniden biçimlendirme kapalı; kayıt (çapa) CDN yayınından **sonra**. |
| RB-OP-17 | Barındırılan doğrulayıcı değer döndüren uçları **MUST** yalnızca sunumu açan RP'ye, güven listesindeki anahtarıyla imzalı ≤ 60 s beyanla açmak; değerler en fazla bir kez ve ≤ 5 dk; başka RP'ye cevap varlığı bile sızmaz; tarayıcıya giden hiçbir jeton değer okuma yetkisi **MUST NOT** taşımak. |
| RB-OP-18 | Barındırılan ihraç servisine dış erişim **MUST** yalnızca kiracıya bağlı, kapsamlı API anahtarıyla olmak; anahtar sunucuda yalnızca özetiyle saklanır, log ve denetim kaydında yer almaz; anahtar yalnızca kendi `slug`'ında geçerlidir. |

---

# 3. RB-REG — Registrar

| # | Kural |
|---|---|
| RB-REG-01 | Registrar **kaydeder, onaylamaz**: yasal yetki (diploma verme vb.) ekosistem dışıdır; ağ yalnızca ağ-içi scope'u tutar. |
| RB-REG-02 | Ulusal kayıtlara **MUST** yalnızca o namespace'in sahibi (devlet; beta'da vekil) yazmak. |
| RB-REG-03 | Yeni issuer **MUST** yalnızca `ACTIVE` bir kök CA'ya bağlanmak. |
| RB-REG-04 | Şema yetkisi allowlist'tir, varsayılan kapalı; zaman pencereli verilir; attestation rulebook'un "kim ihraç edebilir" kuralına göre. |
| RB-REG-05 | Kayıt sınıfı ve assurance (`class`, `assurance`) katılım kapısına göre yazılır; `category` sinyali yalnızca PUB/QUALIFIED için. |
| RB-REG-06 | Sertifika değişikliği **MUST** yeni `issuer_id` + `successor_id` ile kaydedilmek; eski kayıt silinmez. |
| RB-REG-07 | Çıkarma/çıkış **MUST NOT** mevcut kayıtları ve belgeleri geçersiz kılmak; `REVOKED` issuer'ın status listesini halef yayınlayabilir. |
| RB-REG-08 | RP kaydı scope ile yapılır; scope veri minimizasyonu incelemesinden geçer (**SHOULD**). |
| RB-REG-09 | Kayıt değişikliği **SHOULD** ≤ 5 iş günü. |

---

# 4. RB-AP — Attestation Provider (Issuer)

## 4.1 Kimlik ve anahtarlar

| # | Kural |
|---|---|
| RB-AP-01 | Issuer kimliği **MUST** ulusal kök CA'ya zincirlenen X.509 sertifikası olmak; `issuer_id` yaprak sertifika parmak izinden türetilir. |
| RB-AP-02 | Credential imzalama anahtarı **MUST** kurumun kontrolünde olmak (I3: HSM); **MUST NOT** Tamga'da. Demo sapması S-1 pilotta kapanır. |
| RB-AP-03 | Status imzalama anahtarı **MUST** credential anahtarından ayrı olmak. |
| RB-AP-04 | İmza ve anahtar kanıtı yalnızca ES256 (P-256). |

## 4.2 İhraç

| # | Kural |
|---|---|
| RB-AP-05 | Metadata'daki her `vct` **MUST** issuer'ın kayıtta yetkilendirildiği bir tip olmak. |
| RB-AP-06 | Pre-authorized akışta `tx_code` **MUST**; offer ile **farklı kanaldan**; kanal adresi yalnızca kurumun kayıtlı verisinden; 3 yanlış → offer yanar. |
| RB-AP-07 | Offer URI tek kullanımlık; `on-screen` 5 dk, `out-of-band` ≤ 72 sa. |
| RB-AP-08 | `c_nonce` tüketimi atomik; erişim belirteci ≤ 5 dk. |
| RB-AP-09 | Her batch kopyası **MUST** farklı cihaz anahtarına bağlanmak (batch 10); kopya↔`idx` eşlemesi issuer'da kalır, dışarı çıkmaz. |
| RB-AP-10 | Issuer, ihraçtan **önce** cüzdanın WUA'sını `wallet_providers[]` listesine karşı **MUST** doğrulamak ve WSCD seviyesinin tipin şartını karşıladığını kontrol etmek. |
| RB-AP-11 | Issuer, tipin gerektirdiği kimlik ispatı seviyesini ihraç öncesi **MUST** sağlamak; bağlama yolu denetim kaydına yazılır, credential'a **MUST NOT**. T3 yalnızca authorization code veya yüz yüze. |
| RB-AP-12 | Belge öznesi ≠ başvuran ise temsil yetkisi kanıtı **MUST** (veli, vekil). |
| RB-AP-13 | Kaynak veride eşleme tablosunda karşılığı olmayan değer için ihraç **MUST** durmak; tahmin üretilmez. |
| RB-AP-14 | `category` claim'i yalnızca kayıt sınıfı PUB/QUALIFIED ise ve kayıtla aynı değerle; I1–I2 **MUST NOT**. Holder seviyesi hiçbir claim'de **MUST NOT**. |
| RB-AP-15 | İhraç sonrası kişiye "belgeniz bir cüzdana eklendi; siz değilseniz …" bildirimi **MUST** (kişisel veri asgari). |
| RB-AP-16 | Hata yanıtları kişisel veri içermez; `tx_code` yanıt dışında saklanmaz. |

## 4.3 Status ve iptal

| # | Kural |
|---|---|
| RB-AP-17 | Status list **MUST** sabit aralıkta ve değişiklik olmasa da yayınlanmak; aralık dışı "acil" yayın **MUST NOT**. |
| RB-AP-18 | `idx` rastgele; URI opak (kurum/yıl/kohort kodlamaz); listeler tip dışında bölünmez; kapasite ≥ 100.000, doluluk ≤ %80; `bits = 2`; `version` monoton. |
| RB-AP-19 | Yayın önce CDN'e, **sonra** çapa günlüğüne/zincire (sıra kuralı); listede iptal biti yok, yalnızca çapa. |
| RB-AP-20 | Askıya alınmış issuer status list **MUST NOT** yayınlamak; halef yayınlayabilir. |
| RB-AP-21 | Kişi rızasını geri alırsa belge **MUST** iptal edilmek. |
| RB-AP-22 | Issuer DB yedeği liste/zincir yedeğinden önceliklidir; `data/<slug>` yedeklenir. |

## 4.4 Kimlik ispatı sağlayıcıları (uzaktan)

| # | Kural |
|---|---|
| RB-AP-23 | Uzaktan kimlik doğrulama sağlayıcısı (ör. Didit) kullanılıyorsa issuer **MUST** yalnızca sonuç özetini (seviye, oturum kimliği, zaman, sağlayıcı) saklamak; belge görüntüleri, yüz verisi ve OCR ham verisi issuer sisteminde **MUST NOT** tutulmak. |
| RB-AP-24 | Sağlayıcı sonucu bir **T seviyesine** eşlenir; eşleme [[SPEC-ID-0003]] tablosuna göre; verifier'a taşınmaz. |
| RB-AP-25 | Barındırılan servisi kullanan kurum API anahtarını **MUST** kendi sunucusunda tutmak (tarayıcıya, cüzdana, koda koymamak); anahtar 90 günde döner (iki anahtar örtüşür); sızıntı şüphesinde kurum iptal ister. |

## 4.5 RB-AP-ID — Kimlik attestation sağlayıcısı

| # | Kural |
|---|---|
| RB-AP-ID-01 | Kimlik attestation sağlayıcısı **MUST** uzaktan kimlik doğrulamayı yalnızca kendi servisinde yürütmek; kurum issuer'ları, cüzdan ve verifier IDV sağlayıcısıyla **MUST NOT** konuşmak. |
| RB-AP-ID-02 | İhraçtan önce aydınlatma metni **MUST** gösterilmek ve açık rıza alınmak; rıza yoksa IDV **MUST NOT** başlatılmak. |
| RB-AP-ID-03 | Kişi alanları ihraçtan sonra **MUST NOT** tutulmak; görüntü, selfie, video, OCR ham verisi **MUST NOT** saklanmak; kalıcı kayıt opak `subject_ref`, belge no hash'i, süre ve status indeksleridir. |
| RB-AP-ID-04 | Belge **MUST** `urn:tamga:id:IdentityAttestation:1` tipinde, `category` claim'i olmadan, status list'li ve ≤ 2 yıl geçerli olmak; ulusal kimlik numarası **MUST** seçici açıklamalı olmak. |
| RB-AP-ID-05 | Aynı belge numarası için ikinci aktif attestation **MUST NOT** verilmek; yeniden doğrulama eskisini iptal eder. |
| RB-AP-ID-06 | Sağlayıcı devlet PID sağlayıcısı atandığında kaydı `successor_id` ile **MUST** devretmek ve yeni ihracı durdurmak; mevcut belgeler süresi dolana kadar geçerli kalır. |
| RB-AP-ID-07 | Kimlik belgesiyle birlikte site başına takma ad tohumu **MUST** ayrı, sunulamayan türde (`urn:tamga:id:PseudonymSeed:1`) verilmek; tohum kişinin değişmeyen kimliğinden belge özeti anahtarından **ayrı** bir anahtarla türetilir ve **MUST NOT** saklanmak (her doğrulamada yeniden hesaplanır); tür hiçbir RP kapsamında **MUST NOT** yer almak. |
| RB-RP-ID-01 | Kurum issuer'ı kimlik attestation'ını yalnızca kayıtlı RP kapsamındaki alanlarla ve tam doğrulama hattından geçirerek **MUST** almak; eşleştirme anahtarlarını **MUST NOT** saklamak veya loglamak. |

---

# 5. RB-AS — Authentic Source

| # | Kural |
|---|---|
| RB-AS-01 | Authentic Source, issuer'ın sözleşmesinde adlandırılır ve veri işleme sözleşmesiyle bağlanır. |
| RB-AS-02 | Kaynak → şema eşlemesi (ISCED-F, EQF vb.) belgelenir; karşılığı olmayan kayıt ihraç edilmez. |
| RB-AS-03 | Ulusal kimlik numarası hiçbir NETWORK şemasına aktarılmaz. |
| RB-AS-04 | Pilot, kaynak kurumun personeline düzenli yeni iş yüklemez (**SHOULD**). |

---

# 6. RB-WP — Wallet Provider

| # | Kural |
|---|---|
| RB-WP-01 | Holder anahtarları **MUST** cihaz güvenli bölgesinde (W2) veya sertifikalı WSCD'de (W3) üretilmek; dışa aktarılamaz; seed'den türetilmez. W1 (yazılım) pilotta **MUST NOT**. Demo sapması S-9 beyanlı. |
| RB-WP-02 | WUA **MUST** cüzdan sürümünü, anahtarın donanımda olduğunu, PIN/biyometrinin aktif olduğunu beyan etmek; WP anahtarı `wallet_providers[]`'da. |
| RB-WP-03 | Her sunum **MUST** PIN veya biyometri onayı gerektirmek. |
| RB-WP-04 | Onay ekranı istenen alanları **alan alan** gösterir; RP scope'unu aşan/aşırı talep için ayrı görsel blok + gecikmeli düğme **MUST**. |
| RB-WP-05 | Bir verifier'a her zaman aynı batch kopyası, farklı verifier'a farklı kopya; aynı verifier+`vct` için disclosure seti tutarlı. |
| RB-WP-06 | Sunum günlüğü cihazda kalır; sunucu yedeğine girmez; sunucuya gitmez. Yalnız kişi kendisi, kendi parolasıyla şifreli dosya olarak dışa aktarabilir (AB TS10). |
| RB-WP-07 | Yedek yalnızca belgeleri ve manifesti taşır; anahtar taşımaz; cihaz değişiminde yeniden ihraç. WP **MUST NOT** kullanıcı adına kurtarma anahtarı tutmak. |
| RB-WP-08 | Şemalar toplu çekilir; sunum anında şema sunucusuna istek **MUST NOT**. Kullanıcı eylemi olmadan belge yenileme yalnız [[ADR-0023]] koşullarında. |
| RB-WP-09 | Cüzdan, RP client identifier'ını güven kaynağında çözmeyi dener; `presentation_definition` reddedilir; şifresiz yanıt modu kullanılmaz; `origin` prefix'i client id olarak kabul edilmez. |
| RB-WP-10 | Cüzdan **MUST** Trust Mark / "bu cüzdan Tamga güven listesinde" görünümü ve "anahtarlarım nerede" açıklamasını sunmak (**SHOULD** beta, **MUST** pilot). |
| RB-WP-11 | Wallet Solution açığında WP **MUST** sürüm bazlı WUA iptali yapabilmek; Wallet Unit ihlalinde birim iptali. |
| RB-WP-12 | Kullanıcıya "geçersiz" ile "doğrulanamadı/bayat" farklı gösterilir; kullanılmış offer için açık metin. |
| RB-WP-13 | Aracı doğrulayıcı üzerinden gelen istekte cüzdan **MUST** asıl RP'nin kayıtlı adını göstermek, kapsamı onun kaydına göre denetlemek ve verifier başına kopyayı asıl RP'ye göre ayırmak. |

---

# 7. RB-RP — Relying Party (Verifier)

| # | Kural |
|---|---|
| RB-RP-01 | RP **MUST** kayıtlı olmak (`relying_parties[]`), `dns_name` (erişim sertifikasının SAN'ında) ile; isteklerde `client_id = x509_hash:` (HAIP 1.0 §5); scope'unu aşan alan **MUST NOT** istemek. |
| RB-RP-02 | İstek nesnesi **MUST** imzalı; yalnızca DCQL; yanıt `direct_post.jwt` (şifreli); `nonce` tek kullanımlık; bir istekte ≤ 3 credential, ≤ 2 `credential_sets`. |
| RB-RP-03 | Doğrulama **MUST** kanonik hat (T0 + A–E) ile yapılmak; `C2` (şema yetkisi) hiçbir yapılandırmayla atlanamaz; `C1/C2` belgenin `iat`'ına bakar. |
| RB-RP-04 | `issuer_id` `x5c` yaprak parmak izinden türetilir, `iss` claim'inden değil. |
| RB-RP-05 | Sonuç üç değerlidir; `INDETERMINATE` **MUST NOT** `REJECTED` gibi işlenmek; sonuç nesnesi `checks_performed/skipped` taşır. |
| RB-RP-06 | Verifier doğrulama başına status çekmez; toplu ön çekim; `exp/ttl` HTTP önbelleğini geçersiz kılar. |
| RB-RP-07 | RP kendi indeksleyicisini/TrustSource önbelleğini çalıştırır; Tamga'dan barındırılmış hizmet beklemez. |
| RB-RP-08 | Sonuç nesnesi ve loglar claim değeri ve `idx` taşımaz; denetim kaydı reddedilen doğrulamalarda da tutulur; HTTP durum kodu sonucu kodlamaz. |
| RB-RP-09 | Politika "tip × issuer sınıfı" olarak ifade edilir; verifier ayrı `holder_assurance` alanı beklemez; yüksek riskli işlemde ek kimlik kontrolü RP'nin sorumluluğudur. |
| RB-RP-10 | Ret sebebi verifier'a sızmaz (cüzdan tarafı); RP "doğrulanamadı" durumunda kullanıcıyı suçlayan ifade **SHOULD NOT**. |
| RB-RP-11 | Kullanıcı yüzü ile eşleştirme gerekiyorsa RP bunu kimlik belgesi/PID ile yapar; diploma/öğrenci belgesi fotoğraf taşımaz. |
| RB-RP-12 | Barındırılan doğrulayıcıyı kullanan RP sunumu **MUST** kendi sunucusundan, güven listesindeki anahtarıyla imzalı beyanla açmak ve değerleri sunucusunda okumak; sayfa yalnızca durumu görür. |
| RB-RP-13 | Web sitesine giriş ("Tamga ile giriş yap") hesap anahtarı olarak **MUST** site başına takma adı kullanmak; site politikaları belge özeti ya da kimlik numarası **MUST NOT** istemek; takma ad imza, `aud`/`nonce`, site ve iptal edilmemiş cüzdan örneği (WIA) ile doğrulanır. Birden çok takma ad yalnız kaydında `pseudonyms: "multiple"` olan sitede. |

---

# 8. RB-H — Holder (kişi): haklar ve yükümlülükler

| # | Kural |
|---|---|
| RB-H-01 | Katılım gönüllüdür; rıza her zaman geri alınabilir → belge iptal edilir. |
| RB-H-02 | Kişi, her sunumda hangi alanların istendiğini görür ve tek tek onaylar; scope dışı talep uyarılır. |
| RB-H-03 | Kişi, cihazındaki sunum günlüğünü görebilir ve parolalı dosya olarak dışa aktarabilir; günlük başka bir yolla cihazdan çıkmaz. |
| RB-H-04 | Kişi, PIN/biyometri ve cihaz güvenliğinden sorumludur; cihaz kaybında belgeler yeniden alınır, anahtar geri getirilmez. |
| RB-H-05 | "Belgeniz bir cüzdana eklendi" bildirimine itiraz hakkı; itirazda issuer iptal + yeniden ihraç. |
| RB-H-06 | Kişinin küresel tanımlayıcısı yoktur; verifier'lar sunumları birleştiremez (per-RP kopya). Issuer linkability artık risk olarak yazılı bildirilir. |
| RB-H-07 | Şikâyet: issuer → scheme owner → KVKK Kurumu; cüzdanda şikâyet akışı (ÖNERİ). |

---

# 9. RB-SCH — Tipler ve şemalar

| # | Kural |
|---|---|
| RB-SCH-01 | Tip kimliği `vct = urn:tamga:<domain>:<Type>:<major>`; `vct#integrity` **MUST**; Type Metadata katalogdan; `schema_id = keccak256(vct)`. |
| RB-SCH-02 | Yayınlanmış Type Metadata/JSON Schema **MUST NOT** değişmek; minor/patch = yeni `metadata_url` + hash; major = yeni URN. |
| RB-SCH-03 | Her NETWORK şeması ≥ `tr-TR` + `en-US` `display`; `additionalProperties: false`; kişisel veri alanı `sd: never` olamaz. |
| RB-SCH-04 | Hiçbir NETWORK şeması ulusal kimlik numarası alanı içeremez. |
| RB-SCH-05 | Yeni domain, yedi koşullu kontrol listesi (SG1–SG7) tamamlanmadan açılmaz; her tip için bir Attestation Rulebook yayınlanır. |
| RB-SCH-06 | `DEPRECATED` şema doğrulanabilir kalır; emekliye ayırma kararı toplu istatistikle (kova ≥ 50). |
| RB-SCH-07 | `extends` zinciri döngüsüz, ≤ 5 seviye; kök tip dışında `extends#integrity`. |

---

# 10. RB-ENF — Uyum ve yaptırım

| # | Kural |
|---|---|
| RB-ENF-01 | Uyum vektörleri ve taahhüt testleri yayın öncesi zorunludur; başarısız bileşen üretime alınmaz. |
| RB-ENF-02 | Yaptırım merdiveni: uyarı → yetki daraltma → askı → çıkarma (+halef) → fesih. Çıkarma eski belgeleri geçersiz kılmaz. |
| RB-ENF-03 | Pilotta durdurma koşulu oluşursa pilot durur; "izleyip görelim" yoktur. Kişisel verinin ortak kayda yazılması = derhal durdurma. |
| RB-ENF-04 | Beta'da alınan her kısayol DB-*/sapma kütüğünde kayıtlıdır; kayıtsız kısayol ihlaldir. |
| RB-ENF-05 | Bu Rulebook'un bir maddesi kaynak dokümanla çelişirse kaynak geçerlidir ve Rulebook düzeltilir. |

---

# Ek A — Kural ↔ rol matrisi (özet)

| Konu | OP | REG | AP | AS | WP | RP | H |
|---|---|---|---|---|---|---|---|
| Kişisel veri yok (ortak kayıt/log) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| TrustSource üzerinden okuma | ✓ | — | ✓ | — | ✓ | ✓ | — |
| Anahtar ayrımı / kontrolü | ✓ | — | ✓ | — | ✓ | — | ✓ (cihaz) |
| Kadans (liste / çapa / status) | ✓ | — | ✓ | — | — | — | — |
| Kimlik ispatı seviyesi | — | — | ✓ | — | — | (ek kontrol) | — |
| Scope / veri minimizasyonu | — | ✓ | — | — | ✓ (uyarı) | ✓ | ✓ (onay) |
| Üç değerli sonuç | — | — | — | — | ✓ | ✓ | — |
| Şeffaflık / tripwire | ✓ | — | — | — | — | — | — |

# Kaynaklar

Bu belgenin dayandığı kararlar, spesifikasyonlar ve standartlar Ek E'de listelenir.

# CHANGELOG

- **0.4.0 (2026-10-01)** — Sadeleştirme (Tamga ARF 0.7): kural tablolarındaki kaynak sütunları ve metin içi belge atıfları Ek E'ye taşındı; iç yollar kaldırıldı. Kural metinleri değişmedi.
- **0.3.0 (2026-10-01)** — Site başına takma ad: yeni RB-AP-ID-07 (tohum ayrı, sunulamayan türde; saklanmaz) ve
  RB-RP-13 (web girişinde hesap anahtarı takma ad; belge özeti istenmez).
- **0.2.0 (2026-09-27)** — Tamga ARF Ek B; RB-OP-09 düzeltildi (G3 yalnızca indeksleyici); yeni RB-OP-17/18,
  RB-AP-25, RB-WP-13, RB-RP-12; RB-GEN-02 cüzdanı kapsar.
- **0.1.0 (2026-09-24)** — İlk taslak: 202 kodlu değişmezin ve beta BT1–BT10'un rol bazlı derlemesi;
  ETSI 119 471/472-3'ten alınan iki kural (RB-AP-10, RB-AP-12) DB-16 ile spec'e taşınana kadar
  kaynak olarak standardı gösterir.

# Durum

**Active** — 0.1.0, 2026-09-24 kabul (D-GOV-6 / DB-12). Onay kaydı operatörün arşivindedir.
