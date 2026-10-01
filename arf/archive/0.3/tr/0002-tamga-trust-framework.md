---
document_id: FW-TF-0001
title: Tamga Trust Framework — Yönetişim Çerçevesi
category: Framework
domain: Governance
status: Active
review_status: Completed
version: 0.2.1
created: 2026-09-24
last_updated: 2026-09-25
authors:
  - Tamga Network Engineering
language: tr
document_type: framework
audience:
  - institutions
  - regulators
  - legal
  - operators
  - ai-agents
stability: Evolutionary
maturity: Draft
tags:
  - framework
  - trust-framework
  - governance
  - compliance
  - agreements
  - liability
  - transition
keywords:
  - Tamga trust framework
  - five layer trust framework strategy technology scheme rules compliance agreements
  - onboarding gates I1 I2 I3
  - ex ante ex post compliance
  - enforcement trusted list removal
  - liability allocation by assurance
  - transition to TDT member states
  - transferable asset
related:
  - FW-ARF-0001
  - FW-RB-0001
  - FW-RB-0002
  - PM-GOV-0001
  - PM-ASSUR-0001
  - PM-GTM-0001
  - ADR-0002
  - ADR-0005
  - ADR-0009
  - SPEC-BC-0001
  - SPEC-ID-0002
depends_on:
  - PM-GOV-0001
  - PM-ASSUR-0001
  - ADR-0009
summary: >
  Tamga ekosisteminin yönetişim çerçevesi. World Bank "Digital Wallets: Trust
  Frameworks" beş katmanlı modeliyle yapılandırılmıştır: Strateji (vizyon, ilkeler,
  hukuki bağlam, risk, yönetişim organları), Teknoloji (ARF'ye işaret), Şema Kuralları
  (roller, katılım kapıları, yaşam döngüsü, assurance), Uyum (rejim, ISO 17000 rolleri,
  uygunluk testi, gözetim, yaptırım, olay müdahalesi), Sözleşmeler (sözleşme seti, SLA,
  sorumluluk, fesih, halefiyet). eIDAS 2.0 + CIR katmanının Türk dünyası karşılığıdır ve
  devlet devraldığında "devredilecek varlık"tır. Tamga'nın bugünkü rolü kurucu vekildir.
priority: Critical
---

# 0. Statü, kapsam, nasıl okunur

Bu belge **Tamga Trust Framework**'ün (TTF) ilk taslağıdır. Üç işi vardır:

1. **Kurumlara** ekosisteme nasıl katılacaklarını, hangi yükümlülükleri üstleneceklerini ve
   hangi güvenceyi alacaklarını söylemek.
2. **Düzenleyicilere / TDT üye devletlerine** yapının eIDAS 2.0 ile yapısal olarak izomorf,
   fakat egemenlik ve devir bakımından Türk dünyası için tasarlanmış olduğunu göstermek.
3. **Devir anında** teslim edilecek varlık olmak: kök parmak izleri, kayıtlar, kurallar, sözleşme
   şablonları ve değişiklik günlüğü bu belgeye bağlıdır ([[ADR-0009]] K5.5; Charter hedef 3).

Belge, World Bank'ın beş katmanlı modeliyle düzenlenmiştir (Strategy · Technology · Scheme
rules · Compliance · Agreements). Her katmanda "Tamga'da bugün" ve "devirde" ayrımı yapılır.
Kaynağı bir karar olan maddeler `DOC-ID/KOD` ile atıflıdır; kaynağı olmayan maddeler
**ÖNERİ** etiketi taşır ve onaya kadar bağlayıcı değildir.

**Bağlayıcılık sırası:** ADR/DECISIONS > SPEC > bu belge > Rulebook > sözleşme şablonları.
Çelişkide üst kaynak geçerlidir ve bu belge düzeltilir.

---

# 1. Katman 1 — Strateji

## 1.1 Vizyon

Türk Devletleri Teşkilatı (TDT) üyesi ve gözlemcisi devletlerin, kurumlarının ve
vatandaşlarının **birbirinin belgelerini kaynağa sormadan doğrulayabildiği** ortak bir güven
altyapısı; her devlet kendi kayıtlarının tek egemeni, hiçbir üst otorite yok
([[PM-PH-0001]], [[ADR-0002]]). Konumlandırma: "Türk dünyasının EBSI'si — uyumlu ama bağımsız".

## 1.2 İlkeler

[[FW-ARF-0001]] §1.2'deki yedi ilke (egemenlik, kişisel veri yok, uyumlu-ama-bağımsız,
TDT-first, zincir = imzacı seçimi, holder binding, devredilmek üzere tasarla) bu çerçevenin
de ilkeleridir. Yönetişime özgü iki ek ilke:

| # | İlke | Kaynak |
|---|---|---|
| G-A | **Kayıt ≠ yetkilendirme.** Registrar kaydeder, onaylamaz; bir kurumun diploma vermeye yasal yetkisi (YÖK, bakanlık, oda) ekosistemin dışında verilir; ağ yalnızca ağ-içi **scope**'u tutar | `docs/beta/05` R-4; D-SCHEMA-2 |
| G-B | **Yumuşak güç de sınırlanır.** Kodla sınırlanamayan her yetki (barındırma, alan adı, log, istatistik) politika + ölçülebilir tripwire + şeffaflık raporu ile sınırlanır | [[PM-GOV-0001]]/G6, G8 |

## 1.3 Kapsam

| Boyut | Faz B (bugün) | Hedef |
|---|---|---|
| Yargı bölgesi | Türkiye (TR ulusal liste aktif) | TDT üyeleri (AZ, KZ, KG, UZ) + gözlemciler (HU, TM); slotlar rezerve |
| Belge tipleri | `urn:tamga:edu:*` (öğrenci belgesi, diploma) | Sektör şemaları ([[SPEC-SCHEMA-0003]] kontrol listesi SG1–SG7 ile) |
| Katılımcılar | Vakıf üniversitesi (issuer), işverenler (RP), Tamga (wallet provider, TLSO) | Odalar, meslek kuruluşları, kamu kurumları (PUB), bankalar |
| Kişi kimliği (PID) | **Kapsam dışı** — Tamga PID vermez | Devlet PID Provider (Faz 1) |

## 1.4 Hukuki bağlam

| Konu | Türkiye'de dayanak | Bu çerçevede |
|---|---|---|
| Kişisel veri | 6698 sayılı KVKK; VERBİS; aydınlatma, açık rıza, DPIA | Katılım sözleşmesi ekleri; pilot Ö6; [[PM-GTM-0001]] |
| Elektronik imza / mühür | 5070 sayılı EİK; BTK ESHS listesi; NES / e-Mühür | T3 kimlik ispatı yolu; I3 için e-Mühür (DB-3 seçenek B) |
| Uluslararası tanıma | eIDAS 2.0 Art. 14 (üçüncü ülke anlaşmaları); ETSI TS 119 612 AB-dışı TL desteği | Teknik uyum hedefi + ETSI TL projeksiyonu ([[SPEC-ID-0002]] §8.1) |
| Yükseköğretim | YÖK mevzuatı (diploma verme yetkisi) | Ekosistem dışı yetki; ağ scope'u ayrı (G-A) |
| Yargı / uyuşmazlık | Home-state ilkesi | §5.8 |

**ÖNERİ (hukuki inceleme gerektirir):** çerçeve belgesinin sözleşme ekleriyle birlikte bir
avukat tarafından KVKK ve 5070 açısından incelenmesi pilot Ö6 kapısına eklenir.

## 1.5 Risk yaklaşımı

Riskler ekosistem düzeyinde ve orantılı ele alınır. Tamga Risk Register (`FW-RISK-0001`,
planlı) ARF R1–R14 / SR / TT listesinden türetilir. Bugün açıkça beyan edilen artık riskler
[[FW-ARF-0001]] §11'dedir (tek operatör çapası, iptal gecikmesi, issuer linkability).

## 1.6 Yönetişim organları ve yetkiler

| Faz | Organ | Yetki | Kaynak |
|---|---|---|---|
| **B / 0 (bugün)** | Vakıf yönetimi | Günlük işletim, altyapı, TLSO/Registrar vekâleti, SDK yayını | [[PM-GOV-0001]] §Kurumsal Yapı |
| | Vakıf teknik kurulu | Spec değişiklikleri, ADR onayı, NETWORK şeması | aynı |
| | (yok) | Konsey — devlet üye yok; "geçici anormallik" olarak adlandırılır | aynı |
| **1+** | Konsey (üye devletler) | Üye kabul/çıkarma 2/3, NETWORK şeması 2/3, protokol yükseltmesi 2/3, bu belgenin politikaları | [[ADR-0002]], [[SPEC-BC-0001]] GV1–GV4 |
| | Her devlet | Kendi ulusal listesi/kayıtları (`onlyOwnerState`), Registrar, TLSO, Root CA | [[ADR-0002]] |
| | Vakıf | Operatörlük (devredilene kadar) | |

**Tripwire'lar (ölçülebilir devir eşikleri):** barındırılan issuer oranı > %30 → konsey gündemi
(P1.d); devlet validator sayısı ≥ 4 → vakıf validator'ları devredilir; ilk devlet validator'ı
üretimde → konsey kurulur ([[PM-GOV-0001]] faz geçiş tablosu). Zincir başlangıç eşiği: ≥2
bağımsız validator operatörü ([[ADR-0009]] K4).

## 1.7 Şeffaflık

Üç ayda bir şeffaflık raporu (G8): liste sürümleri ve değişiklikler, barındırılan issuer oranı,
şema kullanım sayaçları (kova ≥ 50, G4), olaylar, denetim bulguları. `CHANGELOG.md`
`trust.tamga.network`'te herkese açık.

---

# 2. Katman 2 — Teknoloji

Teknik referans **[[FW-ARF-0001]]**'dir; bu katman yalnızca yönetişimin teknolojiye koyduğu
şartları listeler.

## 2.1 Zorunlu standartlar ve profiller

SD-JWT VC + Tamga tel profili ([[SPEC-CRED-0002]]) · OpenID4VCI/VP Tamga profilleri
([[SPEC-PROTO-0001]], [[SPEC-PROTO-0002]]) · X.509 kurumsal kimlik ([[SPEC-ID-0002]]) ·
Token Status List ([[SPEC-CRED-0003]]) · Type Metadata + JSON Schema kataloğu
([[SPEC-SCHEMA-0001]]) · Güven listesi formatı (SPEC-TRUST-0001 adayı) · Kanonik doğrulama
hattı ([[SPEC-API-0001]]) · Cüzdan ([[SPEC-WALLET-0001]]) · Kimlik ispatı ([[SPEC-ID-0003]]).

## 2.2 Assurance modeli (yönetişim görünümü)

| Eksen | Seviye | Kimin ölçtüğü | Nerede kayıtlı |
|---|---|---|---|
| Holder (T0–T3, eIDAS Low/Substantial/High) | Bağlama yolu | Issuer / Kayıt Otoritesi | Issuer denetim kaydı (PR7); tipin ön koşulu |
| Issuer (I1–I3) | Akreditasyon | Registrar + (I3) bağımsız değerlendirme | Güven listesi `assurance`, `class` |
| Cüzdan (W1–W3) | WSCD seviyesi | Wallet Provider (WUA) | `wallet_providers[]` |

Dışa dönük adlandırma eIDAS terimleriyle yapılır (Low/Substantial/High; EAA/QEAA-eşdeğeri/PuB).
Kullanıcıya sayı gösterilmez ([[PM-ASSUR-0001]]).

## 2.3 Anahtar koruma şartları

| Anahtar | Şart |
|---|---|
| Liste imza anahtarı (TLSO) | ≥2 kaydırmalı sertifika; KMS/HSM; rotasyon ≥30 gün önce duyurulur, yeni anahtar eskisiyle imzalanır (BT3) |
| Kök CA | Çevrimdışı tören (2 kişi, tutanak); parmak izi kalıcı sayfada |
| Issuer credential anahtarı | Kurumun kontrolünde; I3'te HSM; **asla Tamga'da** (G1, BT7; demo S-1 istisnası beyanlı) |
| Status anahtarı | Ayrı, çevrimiçi (K1, S11) |
| Holder anahtarı | Cihaz güvenli bölgesi; dışa aktarılamaz; seed'den türetilmez (WL1) |
| RP erişim sertifikası | Access CA; `client_id = x509_san_dns:` |

## 2.4 Sertifikasyon yaklaşımı

Faz B/0: **hafif uygunluk** — `conformance/` uyum vektörleri + taahhüt testleri (T1–T8 uyarlaması)
yayın öncesi zorunlu ([[ARCH-0005]]/P7). Faz 1: bağımsız uygunluk değerlendirme kuruluşu (CAB)
ve ulusal sertifikasyon (§4.2).

---

# 3. Katman 3 — Şema kuralları

## 3.1 Roller ve sorumluluklar

Rol tanımları [[FW-ARF-0001]] §2; her rolün bağlayıcı kuralları [[FW-RB-0001]]. Bu bölüm
katılımın **kapılarını** ve yaşam döngüsünü tanımlar.

## 3.2 Katılım kapıları (onboarding gates)

Kapılar otomatik uygunluk kontrolleri olarak tasarlanır; geçilmeden kayıt yapılmaz.

### Attestation Provider (Issuer)

| Seviye | Kapı | Ne sağlar |
|---|---|---|
| **I1 — Kayıtlı** | Alan adı sahipliği (DNS challenge); iletişim; teknik uygunluk (metadata + test ihracı uyum vektörleriyle) | Listeye `class: EAA`, `assurance: I1`; verifier arayüzünde "akredite değil" |
| **I2 — Sözleşmeli** | I1 + tüzel kişilik (MERSİS + Ticaret Sicil Gazetesi / kuruluş kanunu) + imza yetkilisi teyidi + **Katılım Sözleşmesi** (§5.1) + X.509 sertifika + KVKK ekleri | `assurance: I2` |
| **I3 — Akredite** | I2 + anahtarlar HSM'de (veya ESHS e-Mühür) + denetim/log yükümlülüğü + olay bildirimi SLA + yıllık gözden geçirme + askıya alma prosedürü + sorumluluk sigortası | `assurance: I3`, `class: QUALIFIED`; credential'da `category: urn:tamga:eaa:qualified` |
| **PUB** | Devlet kurumu / authentic source adına; ilgili devletin Registrar'ı kaydeder | `class: PUB`; `category: urn:tamga:eaa:pub` (Faz 1) |

Kurum, barındırılan ihraç servisini kendi sistemlerinden **kiracıya bağlı, kapsamlı API anahtarıyla** kullanır; anahtar
yalnızca özetiyle saklanır ve 90 günde döner ([[ADR-0016]] HA1–HA3).

Şema yetkisi kapıdan bağımsız, **tip başına allowlist**tir; varsayılan kapalı
([[SPEC-BC-0001]]/I1); attestation rulebook'un "kim ihraç edebilir" bölümüne göre verilir.

### Relying Party

Kayıt formu → **scope** tahsisi. Form, AB ortak kayıt veri setini ister ([[ADR-0024]]; CIR 2025/848 Ek I): resmî ve ticari
ad, resmî kimlik numarası (VKN / MERSİS), adres, iletişim, hizmet açıklaması, her kullanım için amaç ve **gizlilik politikası**,
kamu kurumu olup olmadığı, yetki türü, aracı ilişkisi, veri koruma kurumu (KVKK). Yalnız tüzel kişiler kaydolur. Sonra (istenebilecek claim'ler;
veri minimizasyonu incelemesi) → erişim sertifikası → listeye `relying_parties[]`. RP, scope'unu
aşan alan isteyemez ([[SPEC-API-0001]]/AP6); cüzdan scope'u kullanıcıya gösterir. RP kendi doğrulayıcısını çalıştırabilir
ya da barındırılan doğrulayıcıyı (aracı) kullanabilir; ikincisinde sonuç ve değerler yalnızca imzalı beyanıyla kendini
kanıtlayan RP'ye ve bir kez verilir ([[ADR-0017]]).

**Kayıt sertifikası ([[ADR-0026]]).** Registrar (bugün Tamga, vekâleten) her kullanım için ETSI TS 119 475 kayıt sertifikası
(`rc-wrp+jwt`, en çok 12 ay) üretir; içerik yalnız imzalı listedeki kayıttan, imza LOTL'de yayınlanan ayrı kayıt kurumu
anahtarıyla. RP sertifikayı isteğinde `verifier_info` ile taşır; cüzdan imzayı, süreyi ve RP'nin erişim sertifikasındaki kurum
kimlik numarasıyla (`organizationIdentifier`) bağı doğrular, istenen alanları sertifikayla karşılaştırır. Belge verenler için de
kurum başına bir sertifika (`provides_attestations`) üretilir. Kurum kimlik numarası kayda girilmemiş katılımcıya sertifika
üretilmez.

### Wallet Provider

Wallet Solution beyanı (platformlar, WSCD seviyesi, PIN/biyometri, yedek modeli WL1–WL11'e uygun)
→ WUA imza anahtarı → `lotl › wallet_providers[]`. Faz 1: sertifikalı çözüm listesi (CIR 2025/849
karşılığı).

### Authentic Source

Issuer'ın sözleşmesinde adlandırılır; veri işleme sözleşmesi (§5.1); eşleme tablosu (ISCED-F vb.)
ve "karşılığı yoksa ihraç durur" kuralı ([[SPEC-SCHEMA-0002]]/E11, [[ARCH-0003]]/CMP5).

## 3.3 Yaşam döngüsü kuralları

- **Askıya alma:** olay, denetim bulgusu veya sözleşme ihlali → `SUSPENDED` (yeni ihraç durur,
  eski belgeler `iat`'a göre geçerli) → giderme → `ACTIVE`.
- **Çıkarma:** `REVOKED` (+ halef varsa `successor_id`); ETSI projeksiyonunda `withdrawn`;
  geçmiş silinmez; halef status listeyi yayınlayabilir.
- **Anahtar/sertifika yenileme:** yeni `issuer_id` + `successor_id`; eski belgeler eski kayıtla
  doğrulanır; yenileme ≥30 gün önce Registrar'a bildirilir.
- **Gönüllü çıkış:** bildirim + 90 gün; status listesi halef veya TLSO tarafından son sürümde
  dondurulur ([[SPEC-BC-0001]]/GV1: mevcut belgeler geçersiz kılınmaz).
- **Devlet katılımı/çıkışı:** üyelik 2/3; çıkış mevcut kayıtları geçersiz kılmaz (GV1); yeniden
  kabul mümkündür (GV4).

## 3.4 Kimlik ispatı ve belge tipi

Her attestation rulebook, tipin gerektirdiği asgari bağlama seviyesini tanımlar (eğitim: öğrenci
belgesi T1, diploma T2; [[FW-RB-0002]] §4). Issuer bu seviyeyi ihraç öncesi sağlar; seviye
credential'a yazılmaz. Yollar ve sağlayıcı entegrasyonu [[SPEC-ID-0003]].

## 3.5 Kimlik attestation sağlayıcısı (geçici; [[ADR-0011]], D-ID-6)

Devlet tarafından atanmış bir PID sağlayıcısı bulunana kadar **Tamga Network** bu rolü *geçici* olarak üstlenir:
uzaktan kimlik doğrulama (belge + canlılık + yüz; NFC eklenebilir) sonrasında cüzdana `Tamga Kimlik Belgesi`
verir. Kurallar: (1) bu belge PID değildir, bir EAA'dır; devlet sağlayıcısı atanınca halefiyetle devredilir (§5.7);
(2) Tamga bu veri için **KVKK veri sorumlusu**dur — aydınlatma ve açık rıza ihraçtan önce; görüntü/selfie Tamga'da
saklanmaz; saklama belge süresiyle sınırlı; silme talebi belgeyi iptal eder; (3) kimlik numarası yalnızca bu tipte
ve seçici açıklamalı taşınır; (4) kurumlar belgeyi yalnızca **sunum** yoluyla, kayıtlı kapsamlarında ve kendi
kayıtlarıyla eşleştirmek için alır; eşleştirme anahtarlarını saklamaz; (5) sağlayıcı sözleşmesi ETSI TS 119 461'e
atıf yapar; (6) üç aylık şeffaflık raporu ihraç/iptal sayılarını içerir (kişi yok). Teknik profil [[SPEC-ID-0003]] §9.

## 3.6 Veri koruma kuralları (KVKK)

Rol bazlı sorumluluk: issuer/authentic source = veri sorumlusu; Tamga barındırdığı issuer
servisinde = veri işleyen (sözleşme ile); **kimlik attestation servisinde = veri sorumlusu (§3.5)**; wallet provider = cihazdaki veriye erişmez; RP = kendi
aldığı claim'lerin sorumlusu. Ortak kayıtlarda kişisel veri yoktur (P2). Kişi hakları: sunum
günlüğü cihazda, "KVKK'ya şikâyet" akışı cüzdanda (R-35, ÖNERİ), rıza geri alma → belge iptali
([[PM-GTM-0001]]/GT7).

## 3.7 Yakın alan sunumu ve geçiş kartı ([[ADR-0012]], D-PROX-1)

**İlke:** doğrulama meydan okumasını (nonce) ikna olmak isteyen taraf üretir. Cüzdanın QR gösterdiği yakın alan sunumunda ya
ikinci bir kanal açılır (hedef: ISO/IEC 18013-5, Faz 1) ya da QR yalnızca **kısa ömürlü referans** (C: ters başlatılan OpenID4VP)
veya **kişisel veri içermeyen imzalı jeton** (B: geçiş kartı, 60 s) taşır. Kurallar: (1) terminal ancak kayıtlı bir Relying Party'nin
altında tanımlanır (`terminal_groups[]`); (2) geçiş jetonu kişiyi tanımlamaz, RP kişiyi kendi kayıt sisteminde eşler; (3) geçişte
kullanıcı onayı sorulmaması **süreli ve kapsamlı** rızaya dayanır, kullanıcı her an geri alır; (4) her gösterim cüzdanda kayıt altındadır;
(5) tek kullanımlık attestation'larda (bilet) kapılar ortak kullanıldı listesi tutar; (6) köprü yollar sürümlüdür ve ISO 18013-5
geldiğinde emekliye ayrılır.

---

# 4. Katman 4 — Uyum

## 4.1 Rejim seçimi — hibrit (ÖNERİ, DB-12 kapsamında)

| Sınıf | Rejim | Ne demek |
|---|---|---|
| I3 / QUALIFIED | **Ex ante** | Kayıttan önce uygunluk değerlendirmesi (teknik + organizasyonel), yıllık denetim |
| I2 | **Ex post** | Öz-beyan + uyum vektörleri; şikâyet/olay üzerine denetim; yıllık öz-değerlendirme |
| I1 | Öz-beyan | Teknik uygunluk testi; "akredite değil" etiketi |
| Wallet Provider | Ex ante (Faz 1) | Çözüm sertifikası; Faz B'de öz-beyan + WUA |
| RP | Ex post | Scope ihlali/aşırı talep şikâyeti üzerine |

EUDI'nin hibrit modeliyle aynı (qualified = ex ante, advanced = ex post).

## 4.2 ISO/IEC 17000 rolleri

| Rol | Faz B / 0 | Faz 1+ |
|---|---|---|
| Scheme owner | Tamga (kurucu vekil) | Konsey |
| Accreditation body | Tamga (geçici) | Ulusal akreditasyon kurumu (TÜRKAK benzeri) |
| Conformity assessment body (CAB) | — (öz-beyan + uyum vektörleri) | Bağımsız CAB'ler |
| Scheme participant | Issuer, RP, Wallet Provider, Authentic Source | aynı |

## 4.3 Uygunluk araçları

- `conformance/` uyum vektörleri (trust + sd-jwt; sürümlü; kişisel veri ve özel anahtar yok).
- Taahhüt testleri T1–T8 uyarlaması: bayat liste → UNKNOWN, bilinmeyen format → dur, imza hatası
  → dur ([[ARCH-0005]]/P7; `docs/delivery/08` B1).
- Referans verifier (`verify.tamga.network`) ve referans dağıtım (docker-compose) — RP'ler kendi
  indeksleyicisini/verifier'ını çalıştırır; Tamga barındırılmış indeksleyici sunmaz (G3).

## 4.4 Sürekli gözetim

Şeffaflık raporu (G8), tripwire ölçümleri (G6), liste `CHANGELOG`, olay kütüğü, bağımsız
denetim (Faz 1'den itibaren yıllık; CDN/log yapılandırması dahil — P2 doğrulaması).

## 4.5 Yaptırım merdiveni

| Basamak | Ne | Kayıt |
|---|---|---|
| 1 | Uyarı + giderme süresi (30 gün) | Olay kütüğü |
| 2 | Şema yetkisi daraltma (belirli tip için allowlist kapatma) | `schema_authorizations` penceresi kapanır |
| 3 | **Askıya alma** (`SUSPENDED`) | Liste + CHANGELOG |
| 4 | **Çıkarma** (`REVOKED`, halef atama) — ETSI `withdrawn` | Liste + CHANGELOG + şeffaflık raporu |
| 5 | Sözleşme feshi; hukuki yollar | §5 |

Çıkarma **eski belgeleri** geçersiz kılmaz (`iat` kuralı); yalnızca yeni ihraç durur ve halef
belirlenmezse status listesi dondurulur. Para cezası bu çerçevede yoktur (ÖNERİ: Faz 1'de konsey
kararıyla).

## 4.6 Olay müdahalesi

| Olay | Sınıf | Tepki |
|---|---|---|
| Issuer credential anahtarı sızdı | SEV1 | Issuer `SUSPENDED`; sertifika iptali; etkilenen belgeler status listede REVOKED; yeniden ihraç planı; bildirim |
| Liste imza anahtarı şüphesi | SEV1 | Kaydırmalı ikinci sertifikaya geçiş; kök parmak izi sayfası + şeffaflık duyurusu |
| Wallet Solution açığı | SEV1/2 | Kademeli: sürüm bazlı WUA iptali (Solution) veya birim iptali (Unit); issuer'lar yeni ihraçta reddeder |
| Status yayını 2 döngü kaçtı | SEV2 | Verifier'lar INDETERMINATE üretir; operatör müdahalesi |
| Şema CDN 5xx | SEV3 | Önbellek (`vct#integrity`) doğrulamayı sürdürür |

Kaynak: [[ARCH-0004]] SEV1–3; CIR 2025/847 karşılığı. Kişisel veri ihlali → KVKK 72 saat bildirimi.

## 4.7 Uyuşmazlık

Katılımcılar arası uyuşmazlık önce scheme owner (Faz B: Tamga teknik kurulu) nezdinde, sonra
sözleşmedeki yargı yeri. Devletler arası: konsey; ağ seviyesinde üst merci yoktur
([[SPEC-BC-0002]]/GD8 ilkesi). Kişi şikâyeti: issuer + KVKK Kurumu.

---

# 5. Katman 5 — Sözleşmeler

## 5.1 Sözleşme seti (şablonlar operatörde; yayınlanan özetler burada)

| Sözleşme | Taraflar | İçerik |
|---|---|---|
| **Katılım Sözleşmesi (Issuer)** | Kurum ↔ Tamga (scheme owner) | Kapsam, sınıf/assurance, şema yetkileri, anahtar yönetimi (G1), status yayını yükümlülüğü, kimlik ispatı seviyeleri, bildirimler, KVKK ekleri, SLA, sorumluluk, fesih, halefiyet |
| **Barındırma Eki** | Kurum ↔ Tamga | Issuer servisi Tamga'da: anahtar kurumda kalır (P1.a), log rejimi (P1.b), barındırılan listesi kamuya açık (P1.c), tripwire (P1.d) |
| **RP Kullanım Koşulları** | RP ↔ Tamga | Scope, veri minimizasyonu, aşırı talep yasağı, `idx`/claim loglamama, nonce, INDETERMINATE işleme, kayıt |
| **Wallet Provider Sözleşmesi** | WP ↔ Tamga | WUA, WSCD, güncelleme/iptal SLA, kurtarma anahtarı tutmama |
| **Veri İşleme Sözleşmesi** | Issuer ↔ Authentic Source / Tamga (işleyen) | KVKK md. 12; eşleme tablosu; saklama |
| **Faz 0/B Sınırlar Bildirimi (v2)** | Pilot katılımcıları | 8 madde: zincir yok, çapa tek operatör, iptal ≤ 90 dk, sahte veri aşaması, gönüllülük, rıza geri alma… ([[ADR-0009]] K6; G7) |
| **Halefiyet Sözleşmesi** | Tamga ↔ emanetçi/konsey | Alan adı, kökler, liste arşivi, anahtar devri (P5.d) |

## 5.2 Hizmet seviyeleri (SLA)

| Hizmet | Hedef |
|---|---|
| `trust.` liste erişilebilirliği | %99,9 aylık; `next_update` ≤ 90 gün; değişiklik ≤ 24 s |
| Çapa günlüğü | saatlik; kaçan döngü ≤ 1 |
| `schemas.` | %99,9; yayınlanan dosya değişmez |
| Issuer status yayını | sabit aralık (pilot 60 dk); 2 döngü kaçarsa SEV2 |
| Olay bildirimi | SEV1 ≤ 4 saat; SEV2 ≤ 24 saat |
| Kayıt değişikliği (Registrar) | ≤ 5 iş günü |

## 5.3 Sorumluluk tahsisi (ÖNERİ — WB "liability shift" uyarlaması)

| Kim | Neyden sorumlu | Assurance ile ilişki |
|---|---|---|
| Issuer | Belge içeriğinin doğruluğu; kimlik ispatının tipin gerektirdiği seviyede yapılması; zamanında iptal | I3/QUALIFIED belgeler için "doğruluk karinesi"; I1'de RP ispat yükünü taşır |
| Authentic Source | Kaynak verinin doğruluğu | Issuer'a karşı sözleşmeyle |
| Wallet Provider | WUA beyanının doğruluğu; anahtar korumasının beyan edilen seviyede olması | W2/W3 beyanı yanlışsa sorumluluk WP'de |
| Relying Party | Politikasını doğru uygulaması; INDETERMINATE'i kabul saymaması; scope'a uyması | Yüksek riskli işlemde ek kimlik kontrolü RP'nin yükümlülüğü |
| Tamga (TLSO/Registrar vekili) | Liste bütünlüğü, kadans, kayıt doğruluğu, şeffaflık | Kasıt/ağır ihmal dışında sınırlı (pilot bildirimi) |
| Holder | PIN/cihaz güvenliği; "cüzdana eklendi" bildirimine itiraz | — |

## 5.4 Gizlilik ve fikri mülkiyet

Kod Apache-2.0, dokümanlar CC BY 4.0 (`LICENSE`, `LICENSE-docs`); şema deposu açık ve aynalanır
(P5.f); marka "Tamga" ve Trust Mark kullanımı sözleşmeye bağlı; kiracı verileri gizli.

## 5.5 Ücretlendirme (yön kararı)

**Kişiler için ücretsizdir** (eIDAS 2.0'daki gibi). Kurum ücret yapısı pilot sonunda katılım sözleşmesiyle belirlenir;
pilot ücretsizdir (D-GTM-1, D-WEB-7).

## 5.6 Fesih ve çıkış

§3.3 gönüllü çıkış; fesihte status listesi dondurulur/halefe geçer; mevcut belgeler geçersiz
kılınmaz; kişisel veri saklama süreleri KVKK'ya göre.

## 5.7 Devir (halefiyet)

Alan adı vakıf tüzel kişiliği adına, transfer kilidi + DNSSEC, ≥10 yıl yenileme; tasfiye veya devlet
devrinde alan adı, kökler, liste arşivi ve anahtar emaneti konseye/emanetçiye geçer (P5.a–P5.f).

## 5.8 Yargı yeri

Home-state ilkesi: kurum ↔ Tamga sözleşmelerinde İstanbul mahkemeleri (ÖNERİ); devletler arası
konsey; kişi hakları için kişinin devleti.

---

# 6. Birlikte çalışabilirlik (üç seviye)

| Seviye | Tamga'da |
|---|---|
| 1. Taşınabilirlik (portability) | SD-JWT VC + OpenID4VC; EUDI cüzdanı Tamga belgesini teknik olarak işleyebilir |
| 2. Güven (trust) | Güven listesi (ETSI 119 612 semantiği); XML projeksiyonu; kök parmak izleri; cross-recognition alanı |
| 3. Hukuki tanıma (legal recognition) | Devletler arası: tek taraflı tanıma ([[ADR-0002]]); AB ile: eIDAS Art. 14 anlaşması (uzun vade) |

---

# 7. Devir planı — TDT üye devletlerine

| Adım | Ne devredilir | Nasıl |
|---|---|---|
| 1 | Ulusal liste operatörlüğü (TLSO) | `operator` alanı değişir; `ca_id`/`issuer_id`/`vct` sabit; imza anahtarı devlete ait yeni sertifika kaydırmalı olarak eklenir |
| 2 | Registrar | Kayıt yetkisi devlete; Tamga kayıt yapamaz olur |
| 3 | National Root CA | "TR National Root CA (provisional operator: Tamga)" adı sabit, operatör değişir; veya devletin kökü `RETIRED/ACTIVE` rotasyonuyla eklenir |
| 4 | PID Provider slotu | Devlet doldurur; T2/T3 üretimi PID'e geçer (PM-ASSUR devlet geçişi) |
| 5 | Zincir | ≥2 bağımsız validator → Faz 0; devlet validator'ları → Faz 1; replay + eşdeğerlik |
| 6 | Bu belge | Konsey mülkiyetine; sürüm 1.0 |

Devir hiçbir belgeyi, kaydı veya kimliği geçersiz kılmaz.

---

# 8. Bu belgenin değişiklik yönetimi

- Sürümleme: semver; MAJOR = katılımcı yükümlülüğü değişir (yeniden imza gerekir), MINOR =
  yeni kural/rol, PATCH = düzeltme.
- Her değişiklik bir ADR'ye veya DECISIONS kaydına bağlıdır; ÖNERİ maddeleri onaylandıkça etiket
  kalkar ve `CHANGELOG`'a işlenir.
- Yayın: **`arf.tamga.network`** (Tamga ARF Ek A; İngilizce + Türkçe, Türkçe kaynak — [[ADR-0018]]); güven listelerindeki
  `operator.trust_framework` URL'i sürümlü bağlantı taşır.

---

# 9. Onay bekleyen maddeler (ÖNERİ listesi)

| # | Madde | Bölüm | Bağlı karar |
|---|---|---|---|
| Ö-1 | Hibrit uyum rejimi (I3 ex ante, I2 ex post) | §4.1 | DB-12 |
| Ö-2 | ISO 17000 rol eşlemesi | §4.2 | DB-12, PM-GOV v1.1 |
| Ö-3 | Sorumluluk tahsisi tablosu | §5.3 | DB-12 (yeni karar: D-GOV-6 adayı) |
| Ö-4 | Yaptırım merdiveni, giderme süreleri, SLA sayıları | §4.5, §5.2 | DB-12 |
| Ö-5 | KVKK şikâyet akışı cüzdanda | §3.6 | R-35 |
| Ö-6 | Hukuki inceleme kapısı | §1.4 | PM-GTM v2 |
| Ö-7 | Yargı yeri | §5.8 | Hukuk |

D-GOV-6 kabulüyle (2026-09-24) Ö-1…Ö-7 **v0.1 çerçeve kuralı** olarak yürürlüktedir; sayılar pilot verisiyle değişiklik
geçmişi üzerinden revize edilir.

---

# İlgili dokümanlar

[[FW-ARF-0001]] · [[FW-RB-0001]] · [[FW-RB-0002]] · [[PM-GOV-0001]] · [[PM-ASSUR-0001]] ·
[[PM-GTM-0001]] · [[ADR-0002]] · [[ADR-0005]] · [[ADR-0009]] · [[ADR-0010]] · [[SPEC-BC-0001]] ·
[[SPEC-ID-0002]] · [[SPEC-ID-0003]] · [[SPEC-CRED-0003]] · [[ARCH-0004]] · [[ARCH-0005]]
· World Bank, *Digital Wallets: Trust Frameworks — Governing the Ecosystem* (2026)

# CHANGELOG

- **0.2.1 (2026-09-27)** — §3.5: belgenin cüzdandaki adı "Tamga Kimlik Belgesi" (rol yine geçici sağlayıcıdır, ADR-0011).
- **0.2.0 (2026-09-27)** — Tamga ARF Ek A olarak `arf.tamga.network`'te İngilizce + Türkçe ([[ADR-0018]]); §3.2 barındırılan
  ihraç API'si ([[ADR-0016]]) ve barındırılan doğrulayıcı ([[ADR-0017]]); §5.5 ücret dili D-WEB-7'ye göre; §3.7 sırası düzeltildi.
- **0.1.0 (2026-09-24)** — İlk taslak (DB-12). WB 5 katman; PM-GOV-0001 politikaları (P1–P5),
  taahhütler (C1–C9), ADR-0009 K5 TDT-first, PM-ASSUR kapıları derlendi. ÖNERİ maddeleri §9.

# Durum

**Active** — 0.1.0, 2026-09-24 kabul (D-GOV-6 / DB-12). Onay kaydı operatörün arşivindedir.
