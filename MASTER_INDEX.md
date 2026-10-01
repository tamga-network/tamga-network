# Master Index

Bu doküman, Tamga Network Engineering Workspace'in üst düzey navigasyon haritasıdır. Her yeni doküman tamamlandığında burası güncellenir.

---

# Depo Yapısı

**Yapı: MONOREPO** (2026-08-05 kararı) — docs + kod tek proje kökünde, birbirine bağlı.

```text
tamga-network/                 ← proje kökü (public monorepo; GitHub: tamga-network) — 2026-09-24 yapısı
├── (çatı dosyaları: README, CLAUDE, DOCUMENTATION-STANDARD, MASTER_INDEX, STATUS, ROADMAP,
│    DECISIONS, INVARIANTS, GLOSSARY, SCENARIOS, CONVENTIONS, CHANGELOG, ...)
├── docs/                      ← kanonik bilgi tabanı (CC BY 4.0) + docs.tamga.network kaynağı (.vitepress/)
│   ├── framework/             ← DIŞA DÖNÜK çerçeve belgeleri: ARF, Trust Framework, Rulebook, attestation rulebook'ları
│   ├── project-memory/  architecture/  specifications/
│   ├── research/  academy/  adr/  rfc/
│   ├── reviews/               ← bağımsız inceleme kayıtları (REVIEW-*)
│   ├── _archive/              ← tarihsel belgeler (bakımı yapılmaz)
│   ├── delivery/              ← teslimat kaydı: backlog, demo kurgusu, sapma kütüğü, uygulama notları (INVARIANTS dışı)
│   └── beta/                  ← Faz B ilk analizleri (tarihsel, kanonik değil)
├── packages/                  ← @tamga-network/* (core, trust, schemas, sd-jwt, issuer; sırada verifier, wallet-core)
├── apps/                      ← trust-publisher (+ sırada wallet, verify)
├── conformance/               ← uyum vektörleri + koşucu
├── contracts/                 ← Solidity güven katmanı (Faz 0; derlenmedi)
├── network/                   ← Besu ağ config (Faz 0)
└── ops/                       ← dev PKI üreteci
```

> Operatör tarafı `../tamga-platform/` (private: issuer, portal, ops, özel dokümanlar);
> tanıtım sitesi `../tamga-web/` **ayrı üründür**. Çalışma alanı haritası `../README.md`.

---

# Çatı Dokümanları (Framework)

| Doküman | Durum |
|---------|-------|
| README.md | ✅ |
| DOCUMENTATION-STANDARD.md | ✅ |
| DOCUMENTATION-LIFECYCLE.md | ✅ |
| CONTRIBUTING.md | ✅ |
| GLOSSARY.md | ✅ (yaşayan) |
| ROADMAP.md | ✅ (yaşayan) |
| STATUS.md | ✅ (yaşayan) — iş durumu |
| DECISIONS.md | ✅ (yaşayan) — **açık kararların tek merkezi** (proje yönetiminin karar yüzeyi) |
| SCENARIOS.md | ✅ (yaşayan) — **uçtan uca senaryo anlatımı** (tüm kararlar örneklerle, giriş kapısı) |

---

# Katmanlar

## Reviews — `docs/reviews/` (bağımsız inceleme kayıtları)

- `REVIEW-2026-09-09` · `REVIEW-2026-09-09.md` · v1.0.0 · **Final** — Mimari inceleme (bağımsız mimari inceleme, R1–R10); yöntem: iddiayı koda karşı test et. Kökten taşındı (2026-09-27).

## Archive — `docs/_archive/` (tarihsel; bakım yok, kaynak alınmaz)

`WORKSPACE-AUDIT-AND-PLAN.md` (`WORKSPACE-AUDIT-0001`, 2026-08-07 denetim + arşiv politikası) · `AI-HANDOFF.md` (yerini `CLAUDE.md` + `.claude/` aldı) · `MIMARI-OZET-VE-GUVEN-CERCEVESI.md` (2026-09-03 sentez; önerisi uygulandı) · `STATUS-arsiv-2026-08-09.md`.

## Guides — `docs/guides/` (entegrasyon kılavuzları; kurumlar ve geliştiriciler için)

- `GUIDE-0000` · `README.md` · v0.2.2 · **Draft** — Başlarken: dört yol (doğrulayıcı, kurum, cüzdan, ağ), paket haritası, adresler, yerel geliştirme ortamı, bugünkü durum.
- `GUIDE-0001` · `01-web-giris.md` · v0.2.1 · **Draft** — Web sitesine "Tamga ile kayıt ol / giriş yap": `verifier/web` kiti, sunucuda oturum, passkey.
- `GUIDE-0002` · `02-dogrulama-sunucu.md` · v0.2.2 · **Draft** — Sunucuda belge doğrulama (`@tamga-network/verifier`): güven kaynağı, ön çekim, istek, sonuç.
- `GUIDE-0003` · `03-kurum-ihrac.md` · v0.2.0 · **Draft** — Kurum olarak belge vermek: barındırılan ihraç (`issuer/client`) ya da kendi servis (`issuer`); v0.2.0: kimliğe bağlı teklif ve kurumun sorgu ucu (ADR-0020).
- `GUIDE-0004` · `04-kod-ornekleri.md` · v0.1.1 · **Draft** — Kod örnekleri: kurulum, içe aktarma ve dört çalışan örnek (web giriş, kendi sunucunda doğrulama, belge verme, kurum yetkisi); kodlar `examples/`'tan alınır ve testte çalışır.
- `GUIDE-0005` · `05-cuzdan-gelistirme.md` · v0.1.0 · **Draft** — Tamga uyumlu cüzdan geliştirmek (`@tamga-network/wallet-core`): cüzdan sağlayıcısı kaydı, cihaz anahtarları, WUA, alma, sunma, kopya kuralları.
- `GUIDE-0006` · `06-guven-listeleri-ve-ag.md` · v0.2.1 · **Draft** — Güven listeleri ve ağ: TrustSource, kök sabitleme, tazelik, kayıt (v0.2.0: başvuru + operatör aracı); zincir aşaması (Besu/QBFT, kontratlar, düğüm operatörleri).

## Project Memory — `docs/project-memory/`
**Durum:** In Progress
**Dokümanlar:**
- `PM-PH-0001` · `philosophy/0001-digital-trust-infrastructure.md` · v0.1.1 · **Draft** — Digital Trust Infrastructure Felsefesi + Konumlandırma (katmanlı model, Türk dünyasının EBSI'si, uyumlu ama bağımsız, Tamga Wallet).
- `PM-BC-0001` · `blockchain/0001-blockchain-and-validator-model.md` · v0.1.0 · **Draft** — Blockchain Seçimi ve Validator Modeli (kendi egemen izinli ağ, devletler eşit güç, BFT/PoA, EBSI emsali).
- `PM-TRUST-0001` · `trust/0001-onchain-offchain-boundary.md` · v0.1.0 · **Draft** — On-Chain / Off-Chain Sınırı (kişisel veri asla zincirde; sadece güven registry'si; GDPR).
- `PM-ID-0001` · `identity/0001-identity-model-and-wallet-binding.md` · v0.1.0 · **Draft** — Kimlik Modeli: Root Identity, Cüzdan-Vatandaş Bağı, Çok-Ülkeli Yapı (devlet=PID Provider, egemen vatandaşlık, sınır-ötesi tanıma; çifte vatandaşlık=hibrit, assurance=eIDAS'a eşlenen kendi seviyeler).
- `PM-ID-0002` · `identity/0002-accountable-disclosure-escrowed-identity.md` · v0.3.0 · **Draft** — Accountable Disclosure & Escrowed Identity (**3-of-5 kurumsal 5'li** yargı/veri-koruma/nüfus/ombudsman/parlamento + **yürütme-dışı koltuk kuralı**; **DKG + threshold ElGamal**, reconstruction yok; iki katmanlı verifiable-encryption escrow enrollment; acil mod 2-of-5+48s; sınır-ötesi tabiyet; mahkeme=kripto token, audit log, HSM izolasyon). Kontrat yüzeyi → SPEC-BC-0002.
- `PM-AUTH-0001` · `authorization/0001-value-layer-authorization-strategy.md` · v0.1.1 · **Active** — Değer Katmanı Stratejisi: **yetkilendirme katmanı ol, mutabakat değil**. Üç katman ayrışması, doğrulanabilir-ama-görünmez adres bağı, işlem-grafiği mahremiyeti, agent yetkilendirme, 4 aşamalı zamanlama. Bağlayıcı kancalar → ADR-0003.
- `PM-ASSUR-0001` · `assurance/0001-two-axis-assurance-and-stateless-bootstrap.md` · v1.1.1 · **Draft** — **İki Eksenli Assurance + Devletsiz Bootstrap** (`assurance/` domaini): holder **T0–T3** × issuer **I1–I3** (çarpım); derived assurance; devletsiz bootstrap (e-imza=T3, banka/GSM=T1, KYC=T2); eIDAS LoA 1:1; assurance decay; verifier politika motoru; v1.1.0: politika "tip × issuer sınıfı" (holder seviyesi credential'da yok — PR7), sınıf tablosu EAA/QUALIFIED/PUB, bağlama yolu → seviye tablosu + ETSI 119 461 eşlemesi (D-ASSUR-2, 2026-09-26). → ADR-0005, ADR-0010.
- `PM-GOV-0001` · `governance/0001-governance-and-operating-policy.md` · v1.0.0 · **Active** — **Yönetişim ve İşletim Politikası** (kodla sınırlanamayan yumuşak yetkiler): guardian 5 rolünün Türk tüzel eşlemesi, faz devir eşikleri, kurum full-node akreditasyonu, acil-durum hukuki çerçevesi, FINANCE issuer yetkisi; her yumuşak yetki için tripwire (G1–G8). → ADR-0002, SPEC-BC-0002.
- `PM-GTM-0001` · `gtm/0001-pilot-plan.md` · v2.0.0 · **Active** — **Pilot Planı** (üniversite diploma pilotu): ön koşullar (Ö1'/Ö2' Faz B liste, Ö3–Ö7, Ö8', Ö9), sınırlar bildirimi v2 (8 madde), B10/B11, durdurma ölçütleri, sahte-veriyle uçtan uca zorunluluğu, gönüllü katılım/rıza geri alma (GT1–GT7). → D-GTM-1, PM-ASSUR-0001.
- `PM-SCHEMA-0001` · `schema/0001-why-own-schema-registry.md` · v1.0.0 · **Active** — **Neden Kendi Şema Kayıt Defteri** (`schema/` domaini): `CRED` (nasıl taşındığı) ≠ `SCHEMA` (ne anlama geldiği); off-chain Type Metadata + on-chain çapa gerekçesi. → ADR-0007, SPEC-SCHEMA-0001.

**Domainler:** Philosophy, Identity, Trust, Blockchain, Authorization, Assurance, Governance, GTM, Schema
**Arşiv notu:** Kimlik araştırmasının kavramsal özü (Root Identity, Guardian,
Legal Disclosure, Recovery, Vault, Policy Engine) tamga-network'e **içselleştirilmiştir**
(PM-ID-0001 / PM-ID-0002); ham kaynak `../_archive/solidus-workspace/` altında salt
referans olarak saklanır. Kalan derinleştirme: `PM-ID-0003` (Recovery/Guardian/Vault).
Politika: [[WORKSPACE-AUDIT-0001]] (arşiv).

## Architecture — `docs/architecture/`
**Durum:** In Progress
**Dokümanlar:**
- `ARCH-0001` · `0001-network-architecture.md` · v0.2.1 · **Draft** — Ağ Mimarisi: topoloji, node rolleri (validator=devlet, full node=kurum, observer), **fazlı validator modeli** (Faz B zincirsiz liste → Faz 0 vakıf [giriş: ≥2 bağımsız operatör] → Faz 1 devletler → Faz 2 kurumlar), on/off-chain sınırı, Trust Registry, Besu eşlemesi.
- `ARCH-0002` · `0002-besu-network-setup-step-by-step.md` · v0.1.1 · **Draft** — Besu ile Ağ Kurulumu, Adım Adım (genesis/QBFT, validator anahtarları, permissioning, Trust Registry kontratları, testnet→mainnet, faz geçişi/validator devri).
- `ARCH-0003` · `0003-component-architecture.md` · v1.0.2 · **Active** — Bileşen Mimarisi: İndeksleyici, Issuer/Verifier servisleri, Cüzdan ve güven sınırları; verifier zinciri doğrudan sorgulamaz, indeksleyiciden okur; üç değerli doğrulama (CMP1–CMP9, K1).
- `ARCH-0004` · `0004-server-inventory-and-operations.md` · v1.1.1 · **Active** — Sunucu Envanteri, Dağıtım ve Gözlemlenebilirlik: JSON-RPC internete kapalı, anahtar ayrımı (HSM/çevrimiçi), log gizliliği, indeksleyici yeniden oynatılabilirliği (O1–O7, SEV1–3).
- `ARCH-0005` · `0005-sdk-and-package-publishing.md` · v1.0.0 · **Active** — SDK Mimarisi ve Paket Yayınlama: sürüm bağlaşımı, tedarik zinciri güvenliği (postinstall yok, CI+OIDC yayın, provenance, INDETERMINATE davranışı; P1–P9).
- `ARCH-0006` · `0006-getting-started-runbook.md` · v1.0.1 · **Active** — Canlıya Alma Runbook'u: monorepo (D-MONO), sıra (kontrat derleme → deploy → SDK/servisler → native cüzdan → paket yayını → testnet → mainnet), mobil cüzdanın native zorunluluğu (WL3), komutlar. Yeni değişmez yok; kaynaklardan DOC-ID/KOD atıflı.

**Kaynak (arşiv):** `../_archive/tamga-workspace/` içindeki 14 bölüm referans alınarak kalan mimari başlıklar (identity layer, vertical platforms, core services, security, governance) yazılacak.

## Specification — `docs/specifications/`
**Durum:** In Progress
**Dokümanlar:**
- `SPEC-BC-0001` · `0001-trust-layer-contracts.md` · v2.2.0 · **Active** — Güven Katmanı Kontratları: namespace/onlyOwnerState, Governance (2/3, withdraw, asgari mutlak oy 2), Issuer Registry (yumuşak iptal + successorId, `isCredentialAcceptable`), Cross-Recognition, RP Registry (scope), StatusList (min 100k), şema allowlist, IssuerCategory {GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER}.
- `SPEC-ID-0001` · `0002-tamga-did-method.md` · v1.0.1 · **Draft** — Tamga DID Method: Entity `did:tamga:<state>:<id>` (zincir-kayıtlı) ve Pseudonym `did:tamga:p:<key>` (self-certifying, pairwise, unlinkable); çözümleme, DID Document üretimi, değişmezler.
- `SPEC-BC-0002` · `0003-guardian-escrow-accountable-disclosure.md` · v2.0.2 · **Draft** — Guardian Escrow & Accountable Disclosure: devlet-bazlı kurumsal 5'li guardian + yürütme-dışı kuralı; DKG + threshold ElGamal (reconstruction yok); escrow enrollment (iki katmanlı verifiable-encryption + makbuz); birleşik kontrat (`GuardianRegistry`+`DisclosureRegistry`); acil mod (2-of-5+48s).
- `SPEC-ID-0002` · `0004-x509-institutional-identity-method.md` · v0.3.1 · **Active** — **X.509 Kurumsal Kimlik Metodu** ([[ADR-0004]]): ulusal Root CA çıpalama (RootCARegistry), `issuerId = keccak256(stateCode, certFingerprint)`, 5-adım doğrulama, Root CA rollover, iki katmanlı iptal (CRL/OCSP + on-chain), korunan pseudonym + multicodec, eIDAS/did:web köprüsü; v0.2.0: §8.1 eIDAS Trusted List projeksiyonu (ETSI 119 612) — servis tipi + statü 1:1 eşlemesi; v0.3.0: Faz B'de projeksiyon kaynağı SPEC-TRUST-0001 listeleri.
- `SPEC-CRED-0001` · `0005-credential-format-and-protocols.md` · v1.0.5 · **Draft** — **Credential Formatı ve Protokoller**: SD-JWT VC (birincil) + mdoc (2. faz), OpenID4VCI/VP, ES256, **holder binding (`cnf`) zorunlu**, Wallet Unit Attestation (v1.0.4: uygulanan WUA profili — claim seti, OAuth client attestation başlıkları, provider), revocation→Token Status List, `TrustedListProvider`. → ADR-0006. *(Eski format — değişmez tablosu yok, INVARIANTS'ta bilinçli olarak yer almaz.)*
- `SPEC-CRED-0002` · `0009-sd-jwt-vc-wire-profile.md` · v1.4.0 · **Active** — SD-JWT VC Tel Seviyesi Profili: disclosure üretimi, `_sd`, `cnf`, KB-JWT; `alg=ES256`, `typ=dc+sd-jwt`, `issuerId` yaprak parmak izinden, KB-JWT `iat` ±300s, `category` issuer sınıfı sinyali (C1–C18).
- `SPEC-CRED-0003` · `0008-status-list-and-revocation.md` · v1.0.6 · **Active** — Status List ve İptal: Token Status List profili, yayın döngüsü, zincir çapası; zincirde iptal biti yok, sabit aralıklı gürültülü yayın, rastgele `idx`, opak URI (S1–S14). → ADR-0008.
- `SPEC-SCHEMA-0001` · `0006-schema-registry.md` · v2.0.0 · **Active** — Şema Kayıt Defteri (schemas.tamga.network katalog + SchemaRegistry / Faz B `lotl.schemas[]`): `vct` **URN** kimlik, Type Metadata katalogdan (`metadata_url + content_hash`), `vct#integrity` zorunlu, allowlist (D1–D9). → ADR-0007, ADR-0010.
- `SPEC-SCHEMA-0002` · `0007-education-schemas.md` · v2.0.0 · **Active** — Eğitim Şemaları (`urn:tamga:edu:StudentCredential:1` + `urn:tamga:edu:DiplomaCredential:1`): ELM v3 semantiği, ISCED-F/EQF, kimlik numarası yok, seçici açıklama politikası (E1–E11); v2.0.0: URN + `$ref` erratum. Kurum-okunur kurallar FW-RB-0002.
- `SPEC-SCHEMA-0003` · `0014-sector-schemas.md` · v1.1.0 · **Active** — Sektör Şemaları (İskelet): tüzel kişilik, sağlık, ehliyet, seyahat, ticaret; yedi koşullu kontrol listesi, mDL mdoc kalır, devredilebilir ticaret belgeleri ayrı ilkel (SG1–SG7, SK1–SK6).
- `SPEC-PROTO-0001` · `0010-issuance-openid4vci.md` · v1.3.0 · **Active** — İhraç Protokolü (OpenID4VCI 1.0 Tamga Profili): pre-authorized akış, `tx_code` zorunlu, tek kullanımlık offer URI, `c_nonce` atomik, batch cihaz bağlama, offer sınıfları on-screen/out-of-band (§3.3, DB-5), Wallet Unit doğrulaması WUA+PoP başlıkları (§11.1, DB-16), cüzdan-başlatmalı ihraç authorization code + PAR + PKCE + kimlik attestation sunumu (§11.2, ADR-0011) (PR1–PR16; v1.3.0: kimlik yanıtında `mso_mdoc` — ADR-0013).
- `SPEC-PROTO-0002` · `0011-presentation-openid4vp.md` · v1.2.2 · **Active** — Sunum Protokolü (OpenID4VP 1.0 Tamga Profili): yalnızca DCQL (PE reddedilir), imzalı istek nesnesi, şifreli yanıt, aşırı talep denetimi, `nonce` tek kullanımlık (PV1–PV10).
- `SPEC-API-0001` · `0012-service-api-and-verification.md` · v1.7.0 · **Active** — Servis API Yüzeyi ve Kanonik Doğrulama Algoritması: adım kodları (A1–E4, C4 kategori↔sınıf), üç değerli sonuç, `C1`/`C2` `iat` alır, `issuerId` parmak izinden, `idx` sızmaz, `issuer.class` (AP1–AP12). Referans uygulama `@tamga-network/verifier`.
- `SPEC-WALLET-0001` · `0013-wallet.md` · v1.4.0 · **Active** — Tamga Wallet: anahtar yönetimi (W1–W3), yedekleme, onay yüzeyi, batch kullanımı; anahtar güvenli bölgeden çıkmaz, yazılım cüzdan desteklenmez, her sunum PIN/biyometri (WL1–WL11). v1.2.0: WL4 daraldı (ADR-0027).
- `SPEC-AGENT-0001` · `0015-agent-delegation-and-credential-gating.md` · v1.0.0 · **Active** — Agent Delegasyonu ve Credential-Gating: **Faz 0'da zincir üstü credential-gating yok** ([[ADR-0008]] gereği), ADR-0003 K4 daraltıldı; agent delegasyonu (validUntil/kill switch/sorumluluk velide), gelecek açılma yolu = kayıtlı verifier imzalı beyanı (AG1–AG12). → ADR-0003, D-AUTH-5.
- `SPEC-ID-0003` · `0016-identity-proofing-profile.md` · v1.1.1 · **Active** (2026-09-26; D-ASSUR-2) — **Kimlik İspatı Profili**: T1–T3 yolları ve tip ön koşulu (seviye credential'da asla), ETSI TS 119 461 eşlemesi (D-ASSUR-2), uzaktan kimlik doğrulama sağlayıcısı kuralları ve **Didit v3** eşlemesi (oturum/decision/webhook), adaptör arayüzü, §9 Tamga kimlik attestation servisi (ADR-0011: tip, claim'ler, akış, KVKK), IDP1–IDP11. D-ID-2 + D-ID-6 + D-ASSUR-2'nin uygulaması. Uygulama notu: `docs/delivery/13`.
- `SPEC-TRUST-0001` · `0017-trust-lists-phase-b.md` · v1.2.0 · **Active** (2026-09-24) — **Faz B Güven Listeleri**: `lotl` / `tl-<cc>` / `anchors.jsonl` alan tabloları, imza + sürüm + hash zinciri, kadans (≤90 gün / ≤24 sa / saatlik), TDT-first slotlar, kayıt statü yaşam döngüsü, `TrustSource(list)` yükleme sırası, kontrat eşlemesi + replay/eşdeğerlik (TL1–TL12; v1.1.0: çapa günlüğü arşivleme + `checkpoint`; v1.1.1: kontrol noktası anlık durum `state`). `docs/delivery/04`'ün kanonik hâli (DB-11, ADR-0009 K2). Uygulama: `@tamga-network/trust`, `apps/trust-publisher`.

**Planlı:** SPEC-PROTO (trust protocol), Event Spec, PM-ID-0003 (varlık kurtarma detayı), SPEC-WALLET-0002 (WUA — bugün SPEC-CRED-0001 §4 + SPEC-PROTO-0001 §11.1).

## Framework — `docs/framework/` (dışa dönük, yayınlanan belgeler)
**Durum:** Active (2026-09-24; DB-12 → **D-GOV-6** kabul) — set açıklaması `docs/framework/README.md`
**Dokümanlar:**
- `FW-ARF-0001` · `0001-tamga-arf.md` · v0.3.1 · **Active** — **Tamga ARF** (Mimari ve Referans Çerçevesi): 7 ilke, ekosistem rolleri (ARF rol seti + Faz B/1 eşlemesi), güven modeli (listeler→zincir, tanımlayıcılar, iki eksenli assurance, WUA), yüksek seviye mimari ve hizmet adresleri, veri modeli, akışlar (kayıt/ihraç/sunum/doğrulama A–E/iptal/cihaz değişimi), yaşam döngüleri, fazlar B→0→1→2, standart uyum haritası, artık riskler.
- `FW-TF-0001` · `0002-tamga-trust-framework.md` · v0.3.1 · **Active** — **Tamga Trust Framework**: WB 5 katman (strateji · teknoloji · şema kuralları · uyum · sözleşmeler), katılım kapıları I1/I2/I3/PUB, hibrit uyum rejimi (ÖNERİ), ISO 17000 rolleri, yaptırım merdiveni, olay müdahalesi, sözleşme seti, SLA, sorumluluk tahsisi (ÖNERİ), devir planı; onay bekleyen maddeler §9.
- `FW-RB-0001` · `0003-tamga-rulebook.md` · v0.4.0 · **Active** — **Tamga Rulebook**: rol bazlı bağlayıcı kurallar RB-GEN/OP/REG/AP/AS/WP/RP/H/SCH/ENF; her kural kaynağına (`DOC-ID/KOD`) atıflı; INVARIANTS'a yeni kod eklemez.
- `FW-RB-0002` · `0004-attestation-rulebook-education.md` · v0.2.0 · **Active** — **Attestation Rulebook — Eğitim** (`urn:tamga:edu:StudentCredential:1`, `DiplomaCredential:1`): veri modeli özeti ve seçici açıklama, kim ihraç edebilir, kimlik ispatı seviyesi (T1/T2), geçerlilik/iptal, sunum (DCQL örneği), doğrulama politikası, semantik, sapmalar.
- `FW-RB-0003` · `0005-attestation-rulebook-identity.md` · v0.3.1 · **Draft** — **Attestation Rulebook — Tamga Kimlik Belgesi** (`urn:tamga:id:IdentityAttestation:1`): veri modeli, tek ihraççı, T2 kimlik ispatı, veri koruma, iki biçim (SD-JWT VC + mdoc), kullanım kuralları, devlet PID'ine devir. Onay bekliyor.
- `FW-RB-0004` · `0006-attestation-rulebook-event-ticket.md` · v0.2.0 · **Draft** — **Attestation Rulebook — Etkinlik Bileti** (`urn:tamga:tkt:EventTicket:1`): kişisel verisiz, cihaza bağlı, kapıda tek kullanım (geçiş kartı + ortak kullanıldı listesi), devir = yeniden ihraç. Onay bekliyor.
- `FW-DEF-0001` · `0007-definitions.md` · v0.1.0 · **Active** — **Ek D — Tanımlar**: Tamga ARF terimleri ve kısaltmaları (AB adı + Tamga karşılığı).
- `FW-REF-0001` · `0008-references.md` · v0.1.0 · **Active** — **Ek E — Kaynaklar**: standartlar, Tamga karar kayıtları ve spesifikasyonları, eklerdeki her kuralın kaynağı.

**Planlı:** FW-RISK-0001 (risk kütüğü), sektör attestation rulebook'ları.

## Research — `docs/research/`
**Durum:** In Progress
**Dokümanlar:**
- `RS-EIDAS-0001` · `0001-eidas2-and-eudi-wallet.md` · v0.2.1 · **Draft** — eIDAS 2.0 ve EUDI Wallet (ARF v3.0.0, stack, trust model, blockchain'in yeri, Türkiye); v0.2.0: ETSI TS 119 612 + 119 472-3 derinleştirmesi (§5.1/§4.4) ve Tamga eşlemesi.
- `RS-EBSI-0001` · `0002-ebsi-deep-dive.md` · v0.1.2 · **Draft** — EBSI derin inceleme (Besu+IBFT 2.0, güven registry'leri, on-chain/off-chain, EUDI ilişkisi, Tamga dersleri).
- `RS-FRAMEWORKS-0001` · `0003-blockchain-frameworks-comparison.md` · v0.1.0 · **Draft** — Besu (QBFT) vs Cosmos SDK (CometBFT) karşılaştırması; öneri: Besu.
- `RS-FRAMEWORKS-0002` · `0004-besu-vs-custom-rust-chain.md` · v0.1.0 · **Draft** — Besu vs Kendi Rust Ağı (sıfırdan Rust reddedildi, Substrate ikincil; öneri: Besu korunur).
- `RS-SCHEMA-0001` · `0005-international-credential-schemas.md` · v1.0.0 · **Active** — Uluslararası Credential Şemaları: ELM v3 / Europass, ISCED-F, EQF; eğitim şemalarının semantik temeli (kontrollü sözlükler alınır, JSON-LD taşıyıcısı alınmaz). → SPEC-SCHEMA-0002.

**Planlı:** W3C DID, W3C VC, SSI, RS-PRIVACY (Aşama 3 önkoşulu), RS-EBSI genişletme.

## Academy — `docs/academy/`
**Durum:** In Progress
**Dokümanlar:**
- `ACA-BC-0001` · `blockchain/0001-how-blockchain-and-consensus-work.md` · v0.1.0 · **Draft** — Blockchain ve Consensus Nasıl Çalışır (blok/hash, node, BFT/PoW/PoS, finality, işlem yaşam döngüsü).
- `ACA-CRYPTO-0001` · `cryptography/0001-cryptography-foundations.md` · v0.1.0 · **Draft** — Kriptografi Temelleri (hash, açık/özel anahtar, dijital imza, PKI/sertifika, QSCD, ECDSA/P-256).
- `ACA-ID-0001` · `identity/0001-how-did-and-verifiable-credentials-work.md` · v0.1.1 · **Draft** — DID ve Verifiable Credentials Nasıl Çalışır (SSI üçgeni, DID/VC/VP, akış, seçici açıklama/ZKP, iptal).

## ADR — `docs/adr/`
**Durum:** In Progress
**Dokümanlar:**
- `ADR-0001` · `0001-blockchain-framework-besu-qbft.md` · v1.0.0 · **Accepted** ✅ — Blockchain Framework ve Consensus: **Hyperledger Besu (QBFT)**.
- `ADR-0002` · `0002-sovereignty-first-governance.md` · v1.0.0 · **Accepted** ✅ — **Egemenlik-Öncelikli Yönetişim** (ağ üyeliği=2/3 oy · ulusal kayıtlar=sadece o devlet · sınır-ötesi tanıma=tek taraflı; withdraw; home-state yargı).
- `ADR-0003` · `0003-value-layer-hooks.md` · v1.0.1 · **Accepted** ✅ — **Değer Katmanı Kancaları** (5 karar: kontrat cüzdanı · anahtar-alanı ayrımı + kullanıcı-seçimli kurtarma · scope-generic delegasyon · credential-gating primitifi · kendi-token-yok/izinli-token). *Karar 4 daraltıldı → SPEC-AGENT-0001.*
- `ADR-0004` · `0004-x509-institutional-identity.md` · v1.0.0 · **Accepted** ✅ — **Kurumsal Kimlik: X.509** (issuerId=certFingerprint, ulusal Root CA, vatandaşa küresel ID yok/pairwise pseudonym, EVM hesabı değişmez). did:tamga entity superseded.
- `ADR-0005` · `0005-assurance-framework-and-stateless-bootstrap.md` · v1.0.0 · **Accepted** ✅ — **İki Eksenli Assurance + Devletsiz Bootstrap** (holder T0–T3 × issuer I1–I3, çarpım; güven kurumlardan devralınır; eIDAS 1:1). → PM-ASSUR-0001.
- `ADR-0006` · `0006-credential-format-sd-jwt-vc.md` · v1.0.0 · **Accepted** ✅ — **Credential Formatı: SD-JWT VC** (+ OpenID4VCI/VP, ES256, holder binding zorunlu, WUA). → SPEC-CRED-0001.
- `ADR-0007` · `0007-schema-registry-architecture.md` · v1.0.0 · **Accepted** ✅ — **Şema Kayıt Defteri Mimarisi**: off-chain Type Metadata + on-chain çapa; `vct` kararlı HTTPS URL + `vct#integrity` zorunlu; iki katman NETWORK (2/3 oy) / NATIONAL (`onlyOwnerState`); issuer↔şema allowlist. → SPEC-SCHEMA-0001, PM-SCHEMA-0001.
- `ADR-0008` · `0008-status-list-placement.md` · v1.0.0 · **Accepted** ✅ — **Status List Yerleşimi**: liste off-chain, zincirde yalnızca URI + içerik hash'i + sürüm çapası; `isRevoked` zincir arayüzü kaldırıldı; sabit aralıklı gürültülü yayın. (Bitmap-zincirde yaklaşımını supersede eder.) → SPEC-CRED-0003.
- `ADR-0009` · `0009-phase-b-chainless-beta-and-chain-threshold.md` · v1.0.0 · **Accepted** ✅ (2026-09-24) — **Faz B — Zincirsiz Beta**: Ö1/Ö2 yerine imzalı hash-zincirli güven listeleri + çapa günlüğü (ETSI 119 612 modeli); zincir başlangıç eşiği = ≥2 bağımsız validator operatörü; çapa ikamesi okumaları (S1/S4/D8/DP1/N1/GV2/CMP1-2-4); TDT-first ilkesi; replay + eşdeğerlik testi. → D-BC-6, D-GTM-2, D-GOV-5. Spec sürüm güncellemeleri DECISIONS §10.7'de açık.
- `ADR-0010` · `0010-vct-urn-and-eaa-category-signal.md` · v1.0.0 · **Accepted** ✅ (2026-09-24) — **Tip kimliği URN + EAA kategori sinyali**: `vct = urn:tamga:<domain>:<Type>:<major>`, Type Metadata katalogdan (IETF SD-JWT VC-19 §5.3.2), `vct#integrity` zorunlu, `schemaId = keccak256(vct)` aynen; `category` claim'i `urn:tamga:eaa:pub|qualified` (yalnız PUB/QUALIFIED issuer, kayıtla çapraz kontrol C4); holder LoA asla credential'da. D-SCHEMA-1'i kısmen süpersede eder → D-SCHEMA-4, D-CRED-4.
- `ADR-0011` · `0011-provisional-identity-attestation-provider.md` · v1.0.1 · **Accepted** ✅ (2026-09-25) — **Tamga Geçici Kimlik Attestation Sağlayıcısı** (D-ID-6): devlet PID'i gelene kadar Tamga, Didit (belge+canlılık+yüz; NFC opsiyonel) ile doğruladığı kişiye `urn:tamga:id:IdentityAttestation:1` (EAA, PID değil; TL8 korunur) verir; kurumlar belge ihracında bu attestation'ı sunum olarak alıp kayıtla eşler (authorization code, PID-sunumuyla-EAA deseni); Tamga kimlik verisi için KVKK veri sorumlusu; IDP3 yeniden ifade; TCKN seçici açıklamalı, 2 yıl, NFC aynı tip. Kod: `tamga-platform/apps/id`, cüzdan, kurum issuer'ı.
- `ADR-0012` · `0012-proximity-presentation-and-single-use-attestations.md` · v1.0.1 · **Accepted** ✅ (2026-09-25) — **Yakın alan sunumu (cüzdan QR gösterir) ve tek kullanımlık attestation'lar** (D-PROX-1): köprü yollar B (geçiş kartı, kişisel verisiz 60 s jeton) ve C (ters başlatılan OpenID4VP), hedef ISO/IEC 18013-5; tek kullanımlık bilet = status biti + ortak kullanıldı listesi; süreli rıza S-16.
- `ADR-0013` · `0013-mdoc-dual-format-for-identity.md` · v1.0.1 · **Accepted** ✅ (2026-09-26) — **Kimlik attestation'ı için mdoc çift formatı** (D-CRED-5): SD-JWT VC birincil + ISO 18013-5 mdoc paralel; aynı alanlar/holder anahtarı, ayrı COSE imzası; DCQL ile format seçimi; gerekçe Safari DC API (yalnız mdoc) + ARF PID emsali + Faz 1 Bluetooth. `@tamga-network/mdoc` (saf @noble; CBOR/COSE/MSO). MD1–MD5.
- `ADR-0014` · `0014-issuer-category-events.md` · v1.0.0 · **Accepted** ✅ (2026-09-27) — **IssuerCategory'ye EVENTS** (D-CAT-1): yalnızca etkinlik/bilet ihraççısı; TRANSPORT/TELECOM gerçek kurum gelince ayrı ADR; yeni değer enum sonuna (IC1); kategori kaba filtre, yetki değil (IC2); `bubilet` OTHER → EVENTS; `EventTicket:1` metadata'sı değişmez (D1), düzeltme `EventTicket:2`'de. Kapatır: DB-23.
- `ADR-0015` · `0015-single-trust-interface-for-clients.md` · v1.0.0 · **Accepted** (2026-09-27) — **İstemciler dahil tek güven arayüzü**: `@tamga-network/trust` doğrulama çekirdeği taşınabilir alt yola (`trust/core`); cüzdan `trustlist.ts`/`directory.ts`/`fetchRpRecord` yerine `TrustSource`; Faz 0'da aynı arayüz. Geçiş planı yazıldı, uygulanmadı.
- `ADR-0016` · `0016-hosted-issuer-api-access.md` · v1.0.0 · **Accepted** (2026-09-27) — **Barındırılan ihraç servisine dış kurum erişimi**: `/{slug}/api/v1/*`, kiracıya bağlı kapsamlı API anahtarı (yalnızca özeti saklanır), döndürme, hız sınırı, isteğe bağlı mTLS; `/admin` iç kullanımda kalır. `@tamga-network/issuer/client` üretim önkoşulu.
- `ADR-0017` · `0017-hosted-verifier-result-access.md` · v1.0.2 · **Accepted** (2026-09-27) — **Barındırılan doğrulayıcıda sonuca erişim**: RP, güven listesindeki anahtarıyla imzalı kısa ömürlü beyanla kimliğini kanıtlar; sunum açan RP'ye bağlı; değerler bir kez ve ≤ 5 dk okunur; tarayıcı yalnızca durum görür (iç inceleme Y8).
- `ADR-0019` · `0019-institution-console-and-database.md` · v1.0.1 · **Accepted** (2026-09-28) — **Kurum Konsolu ve operatör veritabanı** (D-CONSOLE-1): `console.tamga.network`, davet + passkey girişi, belgeler / örnek kayıt defteri / biletler / API anahtarları / kullanıcılar / kurum kaydı; öğrenci portalı kalkar; operatör verisi PostgreSQL (yerel ve testte PGlite); D-NAME-1 v1.2 (KC1–KC4).
- `ADR-0020` · `0020-authentic-source-at-institution.md` · v1.0.0 · **Accepted** (2026-09-29) — **Yetkili kaynak kurumdadır** (D-SRC-1): Tamga kişi kaydı tutmaz; kaynak bağlantısı (remote sorgu ucu / sandbox), kimliğe bağlı teklif (issuer_state), Yol B lookup, bilgi imza anında kaynaktan (AS1–AS4).
- `ADR-0029` · `0029-development-stage-schemas.md` · v1.0.0 · **Accepted** (2026-09-30) — **Geliştirme evresinde şemalar yerinde düzeltilir** (D-SCHEMA-5): beta'ya kadar `SCHEMA_STAGE = development`, D1 ve küçük sürüm kuralı beta ile (DS1).
- `ADR-0030` · `0030-product-names.md` · v1.0.0 · **Accepted** (2026-09-30) — **Ürün adları** (D-NAME-3): cüzdan Tamga Wallet, giriş "Tamga ile giriş yap", doğrulayıcı Tamga Verify; "TamgaID" ürün adı değil (PN1–PN4).
- `ADR-0031` · `0031-per-site-pseudonyms.md` · v1.0.2 · **Accepted** (2026-10-01; D-PRIV-1) — **Site başına takma ad**: "Tamga ile giriş yap" siteye belge özeti göndermez; kimlikten türetilen tohumla cüzdanda site başına takma ad anahtarı (kararlı, kişi başına tek hesap, siteler arası bağlanamaz); S-17'yi kapatır, ARF Topic 11.
- `ADR-0032` · `0032-zk-mdoc-presentation.md` · v1.0.2 · **Accepted** (2026-10-01; D-ZK-1) — **Sıfır bilgi ispatlı mdoc sunumu** (Z5): Longfellow ZK (devre v8), kurum belgesi değişmez; ilk yüklem `age_over_18`; devre özetleri güven listesinde; taşıma DCQL `mso_mdoc_zk` + DC API; yedek toplu kopya. Deney `experiments/zk-longfellow/`.
- `ADR-0033` · `0033-store-review-access.md` · v1.0.1 · **Accepted** (2026-10-01; D-REVIEW-1) — **Mağaza incelemesi için tek kullanımlık inceleme kodu**: süreli, tek kullanımlık kod → yalnız o oturumda sahte doğrulama + ayrı deneme imzacısı; deneme belgesi gerçek doğrulayıcıda geçmez (RV1–RV3 önerisi).
- `ADR-0034` · `0034-haip-client-id-and-wia-sub.md` · v1.0.0 · **Accepted** (2026-10-01; D-PROTO-2) — **HAIP 1.0 uyumu**: doğrulayıcı istemci kimliği yalnız `x509_hash` (sertifikadan hesaplanır; cüzdan yalnız onu kabul eder), RP kaydında kalıcı kimlik `dns_name` (kopya, takma ad, geçiş kartı, aracı ilişkileri), WIA `sub` bütün örneklerde ortak (CI1–CI6).
- `ADR-0035` · `0035-positioning-three-layers.md` · v1.0.0 · **Accepted** (2026-10-01; D-GOV-7) — **Konumlanma**: AB uyumu taban; Tamga Network hafif federasyon (ülke listelerini toplar, kurallara uyan her cüzdanı tanır); Tamga Wallet ilk ve referans cüzdan, hizmetler standartlar üzerine (PO1–PO4).
- `ADR-0036` · `0036-trust-federation-external-lists.md` · v1.0.0 · **Accepted** (2026-10-01; D-TRUST-2) — **Güven federasyonu**: LOTL'da dış listeler (ETSI TS 119 602 LoTE; adres + sabit imzacı + kapsam + onay), dış cüzdan sağlayıcıları (kapsam anahtar deposu kuralı), dış kurum belgeleri (AB PID, mDL), iç içe seçici açıklama (FD1–FD5). Belirli bir dış liste ayrı onayla.
- `ADR-0028` · `0028-health-credentials.md` · v0.2.0 · **Proposed** (2026-09-30) — **Sağlık alanı belgeleri**: meslek icra belgesi (Sağlık Bakanlığı; pilotta deneme kurumu), oda üyeliği (TTB), kurum görev belgesi (hastane, sektörsüz tür); işe alan kurum doğrulayıcı; sağlık verisi yok. Adlar kararda.
- `ADR-0027` · `0027-user-initiated-log-export.md` · v1.0.0 · **Accepted** (2026-09-29) — **Günlüğün kişinin başlattığı şifreli dışa aktarımı (AB TS10)** (D-WALLET-2): WL4 daraldı — günlük yalnız kişinin başlattığı, parolalı (PBES2 + A128GCM) dosyada cihazdan çıkar; otomatik/sunucuya asla (LX1–LX2).
- `ADR-0026` · `0026-registration-certificates.md` · v1.0.0 · **Accepted** (2026-09-29) — **Kayıt sertifikaları (WRPRC)** (D-REG-2): Tamga geçici kayıt kurumu olarak kullanım başına ETSI TS 119 475 `rc-wrp+jwt` üretir (ayrı kayıt kurumu anahtarı, LOTL'de); doğrulayıcı `verifier_info` ile taşır; cüzdan imza, süre, `organizationIdentifier` bağı ve istenen alanları denetler (WRC1–WRC4).
- `ADR-0025` · `0025-wallet-instance-and-key-attestations.md` · v1.0.2 · **Accepted** (2026-09-29) — **WIA + KA (AB TS3)** (D-CRED-7): cüzdan birimi kaydı, işlem başına < 24 saatlik WIA (`client_status`), sağlayıcı imzalı anahtar kanıtı (`key_attestation`), iki iptal listesi, kullanıcı isteğiyle birim iptali (WIA1–WIA4).
- `ADR-0024` · `0024-participant-registration-data.md` · v1.0.0 · **Accepted** (2026-09-29) — **Katılımcı kayıt verisi** (D-REG-1): doğrulayıcı ve belge veren kayıtlarında AB ortak veri seti (CIR 2025/848 Ek I, TS5/TS6): ticari ad, resmî kimlik no, adres, iletişim, amaç + gizlilik politikası, kamu kurumu, yetki türü, aracı, veri koruma kurumu (RPR1–RPR3).
- `ADR-0023` · `0023-automatic-copy-refresh.md` · v1.0.0 · **Accepted** (2026-09-29) — **Otomatik kopya yenileme** (D-WALLET-1): yenileme belirteci (DPoP + WUA bağlı, döndürülen), kurum eşiğinde, rastgele gecikmeyle; kimlik/iletişim kapsam dışı; WL7 değişir (AR1–AR4).
- `ADR-0022` · `0022-identity-service-non-qualified.md` · v1.0.0 · **Accepted** (2026-09-29) — **Kimlik servisinin sınıfı** (D-ID-7): güven listesinde QUALIFIED/I3 → nitelikli olmayan EAA / I2; kimlik belgesinde `category` yok; bağımsız değerlendirmeden sonra yükseltme (IDC1–IDC2). ADR-0011 sınıf satırını değiştirir.
- `ADR-0021` · `0021-verified-contact-credentials.md` · v1.0.0 · **Accepted** (2026-09-29) — **Doğrulanmış iletişim belgeleri** (D-CONTACT-1): `urn:tamga:contact:EmailAddress:1` ve `PhoneNumber:1`, tek kullanımlık kodla sahiplik kanıtı, nitelikli olmayan EAA, yalnız SD-JWT VC, adres saklanmaz; gönderim sağlayıcıları ayarla (CT1–CT4).
- `ADR-0018` · `0018-documentation-three-doors.md` · v1.0.1 · **Accepted** (2026-09-27) — **Belge yayını üç kapı** (D-DOCS-1): genel `tamga.network/docs`, geliştirici `docs.tamga.network`, **Tamga ARF** `arf.tamga.network` (ana belge + Ek A/B/C), İngilizce + Türkçe; Türkçe kaynak, sürüm kayması derlemede yakalanır (DY1–DY3).

## RFC — `docs/rfc/`
**Durum:** Not Started

---

# Depo Sağlığı

| Alan | Durum |
|------|-------|
| Documentation Standard | ✅ Stable |
| Metadata | ✅ Standardized |
| Project Memory | In Progress (10 doküman: 7 Draft + PM-GOV/GTM/SCHEMA Active) |
| Architecture | In Progress (6 doküman: ARCH-0001/0002 Draft, ARCH-0003/0004/0005/0006 Active) |
| Specification | In Progress (17 doküman: SPEC-BC-0001 Active v2.1.1 + 12 Active [**SPEC-TRUST-0001**, **SPEC-ID-0003** 2026-09-26] + SPEC-ID-0001/BC-0002/CRED-0001 Draft) |
| Framework | ✅ Active — Tamga ARF 0.7 (8 doküman: FW-ARF-0001, FW-TF-0001, FW-RB-0001…0004, FW-DEF-0001, FW-REF-0001 — RB-0003/0004 taslak; D-GOV-6, D-DOCS-1; arf.tamga.network, EN + TR) |
| Research | In Progress (5 doküman: 4 Draft + RS-SCHEMA-0001 Active) |
| Academy | In Progress (3 Draft) |
| ADR | In Progress (ADR-0001..0010 Accepted; 0009/0010 spec senkronu açık — DECISIONS §10.7) |
| RFC | Not Started |
| Contracts | ⚠️ Yazıldı, **HİÇ DERLENMEDİ** (SPEC-BC-0001 v2.0.0; Foundry gerekli) |
| Karar Kütüğü | ✅ Tüm açık kararlar kapatıldı (2026-09-03) — bkz. [[DECISIONS]] |
| INVARIANTS | ✅ 20 dokümanda 224 kod; çakışma yok (2026-09-24, `scripts/sync-invariants.mjs` ile üretildi) — bkz. [[INVARIANTS]] |

**Toplam kayıtlı doküman:** 56 (10 PM + 6 ARCH + 17 SPEC + 5 RS + 3 ACA + 12 ADR + 4 FW — hepsi bu indekste). RFC: 0. Kanonik olmayan çalışma alanları: operatörün standart analiz arşivi (standart analizleri), `docs/beta/` (zincirsiz beta analizi, sözlük, senaryolar), operatörün konuşma arşivi.

---

# Referans Kaynaklar (Depo Dışı)

Aşağıdaki eski workspace'ler yalnızca **kaynak/arşiv** olarak kullanılır, otorite
değildir. Tam denetim ve düzenleme politikası: [[WORKSPACE-AUDIT-0001]] (arşiv).

- `../_archive/tamga-workspace/` — 14 bölümlük mimari taslak (Architecture yazımında referans; arşivlendi)
- `../_archive/solidus-workspace/` — **süperseded arşiv** (dokümantasyon metodolojisinin ve
  kimlik araştırmasının ham kaynağı); içeriği içselleştirildi, yalnızca salt-referanstır
- `../tamga-basvuru/` — pitch / başvuru materyalleri
- `../tamga-web/` — tanıtım sitesi (ayrı ürün; bu depo değil)
