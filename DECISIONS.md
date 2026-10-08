# Kararlar · Decisions

> Bu dosya üretilir (`docs/adr/` ön bilgisi ve karar kodları); elle düzenlenmez.

Tamga Network'ün kapatılmış kararları **mimari karar kayıtları (ADR)** olarak [`docs/adr/`](docs/adr/) altında yayınlanır:
her ADR sorunu, seçenekleri, kararı ve sonuçlarını anlatır. Kapatılmış bir karar yalnızca yeni bir ADR ile değişir; eski ADR
silinmez, durumu `Superseded` olur. Okunaklı hâli: [docs.tamga.network/adr](https://docs.tamga.network/adr/) (İngilizce) ·
[docs.tamga.network/tr/adr](https://docs.tamga.network/tr/adr/) (Türkçe). Bağlayıcı kurallar: [`INVARIANTS.md`](INVARIANTS.md).

*English:* Tamga Network's closed decisions are published as architecture decision records (ADRs) in `docs/adr/` (Turkish
source) and `docs/en/adr/` (English). A closed decision changes only through a new ADR; the old one becomes `Superseded`.
Short decision codes such as `D-SCHEMA-4` used in the specifications are listed at the end with their ADRs.

## Karar kayıtları (ADR)

| ADR | Başlık | Title | Durum | Alan |
|---|---|---|---|---|
| [ADR-0001](docs/adr/0001-blockchain-framework-besu-qbft.md) | Besu QBFT defteri | Besu QBFT ledger | Active | Trust |
| [ADR-0002](docs/adr/0002-sovereignty-first-governance.md) | Egemenlik öncelikli yönetişim | Sovereignty-first governance | Active | Governance |
| [ADR-0003](docs/adr/0003-value-layer-hooks.md) | Değer katmanı kancaları | Value layer hooks | Active | Governance |
| [ADR-0004](docs/adr/0004-x509-institutional-identity.md) | Kurum kimliği: X.509 | Institutional identity: X.509 | Active | Trust |
| [ADR-0005](docs/adr/0005-assurance-framework-and-stateless-bootstrap.md) | Güvence modeli ve devletsiz başlangıç | Assurance model and stateless bootstrap | Active | Identity |
| [ADR-0006](docs/adr/0006-credential-format-sd-jwt-vc.md) | Belge biçimi: SD-JWT VC | Credential format: SD-JWT VC | Active | Credentials |
| [ADR-0007](docs/adr/0007-schema-registry-architecture.md) | Şema kayıt defteri | Schema registry | Active | Credentials |
| [ADR-0008](docs/adr/0008-status-list-placement.md) | İptal listesinin yeri | Where the status list lives | Active | Credentials |
| [ADR-0009](docs/adr/0009-phase-b-chainless-beta-and-chain-threshold.md) | Zincirsiz beta ve zincir eşiği | Chainless beta and chain threshold | Active | Trust |
| [ADR-0010](docs/adr/0010-vct-urn-and-eaa-category-signal.md) | Belge türü kimliği (URN) | Credential type identifier (URN) | Active | Credentials |
| [ADR-0011](docs/adr/0011-provisional-identity-attestation-provider.md) | Geçici kimlik belgesi sağlayıcısı | Provisional identity attestation provider | Active | Identity |
| [ADR-0012](docs/adr/0012-proximity-presentation-and-single-use-attestations.md) | Yakın alanda belge gösterme | Proximity presentation | Active | Wallet |
| [ADR-0013](docs/adr/0013-mdoc-dual-format-for-identity.md) | Kimlik belgesi için mdoc | mdoc for the identity credential | Active | Identity |
| [ADR-0014](docs/adr/0014-issuer-category-events.md) | Etkinlik kategorisi | Events category | Active | Credentials |
| [ADR-0015](docs/adr/0015-single-trust-interface-for-clients.md) | Tek güven arayüzü | Single trust interface | Active | Trust |
| [ADR-0016](docs/adr/0016-hosted-issuer-api-access.md) | Barındırılan belge vermeye erişim | Access to hosted issuance | Active | Services |
| [ADR-0017](docs/adr/0017-hosted-verifier-result-access.md) | Doğrulama sonucuna erişim | Access to verification results | Active | Services |
| [ADR-0018](docs/adr/0018-documentation-three-doors.md) | Belgelerin üç kapısı | Three doors to the documentation | Active | Governance |
| [ADR-0019](docs/adr/0019-institution-console-and-database.md) | Kurum Konsolu | Institution Console | Active | Services |
| [ADR-0020](docs/adr/0020-authentic-source-at-institution.md) | Yetkili kaynak kurumdadır | The authentic source is the institution | Active | Services |
| [ADR-0021](docs/adr/0021-verified-contact-credentials.md) | E-posta ve telefon belgeleri | E-mail and phone credentials | Active | Credentials |
| [ADR-0022](docs/adr/0022-identity-service-non-qualified.md) | Kimlik servisinin sınıfı | Class of the identity service | Active | Identity |
| [ADR-0023](docs/adr/0023-automatic-copy-refresh.md) | Otomatik kopya yenileme | Automatic copy refresh | Active | Wallet |
| [ADR-0024](docs/adr/0024-participant-registration-data.md) | Katılımcı kayıt verisi | Participant registration data | Active | Trust |
| [ADR-0025](docs/adr/0025-wallet-instance-and-key-attestations.md) | Cüzdan ve anahtar kanıtı | Wallet and key attestations | Active | Wallet |
| [ADR-0026](docs/adr/0026-registration-certificates.md) | Kayıt sertifikaları | Registration certificates | Active | Trust |
| [ADR-0027](docs/adr/0027-user-initiated-log-export.md) | İşlem günlüğünü dışa aktarma | Exporting the transaction log | Active | Wallet |
| [ADR-0028](docs/adr/0028-health-credentials.md) | Sağlık belgeleri | Health credentials | Proposed | Credentials |
| [ADR-0029](docs/adr/0029-development-stage-schemas.md) | Geliştirme evresinde şemalar | Schemas in the development stage | Active | Credentials |
| [ADR-0030](docs/adr/0030-product-names.md) | Ürün adları | Product names | Active | Governance |
| [ADR-0031](docs/adr/0031-per-site-pseudonyms.md) | Site başına takma ad | Per-site pseudonyms | Active | Identity |
| [ADR-0032](docs/adr/0032-zk-mdoc-presentation.md) | Sıfır bilgi ispatı (ZK) | Zero-knowledge proofs (ZK) | Active | Identity |
| [ADR-0033](docs/adr/0033-store-review-access.md) | Mağaza inceleme kodu | App store review code | Active | Services |
| [ADR-0034](docs/adr/0034-haip-client-id-and-wia-sub.md) | HAIP 1.0 uyumu | HAIP 1.0 conformance | Active | Trust |
| [ADR-0035](docs/adr/0035-positioning-three-layers.md) | Konumlanma | Positioning | Active | Governance |
| [ADR-0036](docs/adr/0036-trust-federation-external-lists.md) | Güven federasyonu | Trust federation | Active | Trust |
| [ADR-0037](docs/adr/0037-network-only.md) | Tamga Network yalnızca bir ağdır | Tamga Network is only a network | Active | Governance |
| [ADR-0038](docs/adr/0038-sandbox.md) | Sandbox: test ağı | Sandbox: the test network | Active | Trust |
| [ADR-0039](docs/adr/0039-driving-licence-attestation.md) | Doğrulanmış sürücü belgesi bilgisi | Verified driving licence information | Active | Credentials |
| [ADR-0040](docs/adr/0040-sandbox-invited-real-identity.md) | Sandbox'ta gerçek kimlik doğrulama | Real identity checks in sandbox | Active | Identity |
| [ADR-0041](docs/adr/0041-sandbox-institution-test-accounts.md) | Sandbox'ta kurum test hesapları | Institution test accounts in the sandbox | Active | Services |
| [ADR-0042](docs/adr/0042-network-and-wallets.md) | Ağ ve cüzdanlar: ağ cüzdan işletmez | The network and wallets: the network operates no wallet | Active | Governance |
| [ADR-0043](docs/adr/0043-no-age-limit.md) | Yaş sınırı yok: AB yaklaşımı | No age limit: the EU approach | Active | Identity |

## Karar kodları

Şartnamelerde ve ADR'lerde geçen `D-…` kodları bir kararın kısa adıdır. Kararın gerekçesi ve ayrıntısı bağlı ADR'dedir;
ADR'si olmayan eski kodlar ilk tasarım turunda kapatılmış yön kararlarıdır.

| Kod | Karar | Durum | ADR |
|---|---|---|---|
| D-API-1 | Barındırılan ihraç servisine dış kurum erişimi: kiracı API anahtarı | Kapalı | [ADR-0016](docs/adr/0016-hosted-issuer-api-access.md) |
| D-API-2 | Barındırılan doğrulayıcıda sonuca erişim: RP beyanı, tek okuma, asıl RP gösterimi | Kapalı | [ADR-0017](docs/adr/0017-hosted-verifier-result-access.md) |
| D-ASSUR-1 | İki eksenli assurance + devletsiz bootstrap | Kapalı | [ADR-0005](docs/adr/0005-assurance-framework-and-stateless-bootstrap.md) |
| D-ASSUR-2 | Holder seviyesi bağlama yolundan gelir, tipin ön koşuludur; ETSI TS 119 461 eşlemesi | Kapalı |  |
| D-AUTH-0 | Değer katmanı = yetkilendirme, mutabakat değil | Kapalı | [ADR-0003](docs/adr/0003-value-layer-hooks.md) |
| D-AUTH-1 | İşlem-grafiği mahremiyeti | Kapalı |  |
| D-AUTH-2 | Agent delegasyon kontratı | Kapalı | [ADR-0003](docs/adr/0003-value-layer-hooks.md) |
| D-AUTH-3 | Varlık cüzdanı kurtarma kompozisyonu | Kapalı | [ADR-0003](docs/adr/0003-value-layer-hooks.md) |
| D-AUTH-4 | FINANCE issuer akreditasyonu | Kapalı | [ADR-0003](docs/adr/0003-value-layer-hooks.md) |
| D-AUTH-5 | Credential-gating Faz 0'da zincir dışıdır | Kapalı | [ADR-0008](docs/adr/0008-status-list-placement.md), [ADR-0003](docs/adr/0003-value-layer-hooks.md) |
| D-BC-0 | Blockchain motoru = Hyperledger Besu + QBFT | Kapalı | [ADR-0001](docs/adr/0001-blockchain-framework-besu-qbft.md) |
| D-BC-1 | Rust'tan sıfırdan ağ reddedildi | Kapalı |  |
| D-BC-2 | Yükseltme deseni = UUPS, yetki Governance 2/3; brick koruması CI'da zorunlu | Kapalı |  |
| D-BC-3 | Doğrulama zamana bağlıdır: C1/C2 credential `iat`'ını alır (`isCredentialAcceptable`, `isCredentialSchemaAcceptable`); ihraç sorguları doğrulamada kullanılmaz | Kapalı |  |
| D-BC-4 | CA `RETIRED` ≠ `REVOKED`: rotasyon operasyonu ve eski belgeleri sürdürür; ele geçirilme belgeleri düşürür ama status yayını sürer | Kapalı |  |
| D-BC-5 | Halef issuer, selefin status listesini yayınlayabilir | Kapalı |  |
| D-BC-6 | Faz B: zincirsiz beta ve zincir başlangıç eşiği | Kapalı | [ADR-0009](docs/adr/0009-phase-b-chainless-beta-and-chain-threshold.md) |
| D-CAT-1 | IssuerCategory'ye EVENTS (etkinlik) | Kapalı | [ADR-0014](docs/adr/0014-issuer-category-events.md) |
| D-CONSOLE-1 | Kurum Konsolu (console.tamga.network) + PostgreSQL; öğrenci portalı kalkar | Kapalı | [ADR-0019](docs/adr/0019-institution-console-and-database.md) |
| D-CONTACT-1 | Doğrulanmış iletişim belgeleri: e-posta ve telefon | Kapalı | [ADR-0021](docs/adr/0021-verified-contact-credentials.md) |
| D-CRED-1 | Credential formatı ve protokoller | Kapalı | [ADR-0006](docs/adr/0006-credential-format-sd-jwt-vc.md) |
| D-CRED-2 | `typ` = `dc+sd-jwt`; `vc+sd-jwt` Tamga issuer'larından reddedilir, dış ekosistem için bayrak varsayılan kapalı | Kapalı |  |
| D-CRED-3 | `issuerId` x5c yaprak parmak izinden türetilir, `iss` claim'inden değil | Kapalı |  |
| D-CRED-4 | Tamga EAA kategori sinyali; holder LoA asla credential'da | Kapalı | [ADR-0010](docs/adr/0010-vct-urn-and-eaa-category-signal.md) |
| D-CRED-5 | Kimlik attestation'ı çift format: SD-JWT VC + ISO/IEC 18013-5 mdoc | Kapalı | [ADR-0013](docs/adr/0013-mdoc-dual-format-for-identity.md) |
| D-CRED-6 | İhraç öncesi Wallet Unit Attestation zorunlu | Kapalı | [ADR-0042](docs/adr/0042-network-and-wallets.md) |
| D-CRED-7 | Cüzdan örneği kanıtı (WIA) + anahtar kanıtı (KA) — AB TS3 | Kapalı | [ADR-0025](docs/adr/0025-wallet-instance-and-key-attestations.md), [ADR-0042](docs/adr/0042-network-and-wallets.md) |
| D-DOCS-1 | Belge yayını üç kapı: Genel · Geliştirici · Tamga ARF | Kapalı | [ADR-0018](docs/adr/0018-documentation-three-doors.md) |
| D-GOV-0 | Egemenlik-öncelikli yönetişim (2/3 · onlyOwnerState · tek taraflı tanıma) | Kapalı | [ADR-0002](docs/adr/0002-sovereignty-first-governance.md) |
| D-GOV-1 | Guardian 5 rolünün Türk tüzel eşlemesi | Kapalı |  |
| D-GOV-2 | Faz devir eşikleri | Kapalı | [ADR-0009](docs/adr/0009-phase-b-chainless-beta-and-chain-threshold.md) |
| D-GOV-3 | Kurum full-node akreditasyonu | Kapalı |  |
| D-GOV-4 | Acil-durum modu hukuki çerçevesi | Kapalı |  |
| D-GOV-5 | TDT-first ilkesi | Kapalı | [ADR-0009](docs/adr/0009-phase-b-chainless-beta-and-chain-threshold.md) |
| D-GOV-6 | Çerçeve belge seti (Tamga ARF · Trust Framework · Tamga Rulebook · belge türü rulebook'ları) | Kapalı | [ADR-0018](docs/adr/0018-documentation-three-doors.md) |
| D-GOV-7 | Konumlanma: AB uyumu taban, Tamga Network hafif federasyon, ürün ve hizmetler | Kapalı | [ADR-0035](docs/adr/0035-positioning-three-layers.md) |
| D-GOV-8 | Tamga Network yalnızca ağdır; hizmetler ağın dışında | Kapalı | [ADR-0037](docs/adr/0037-network-only.md) |
| D-GOV-9 | Ağ cüzdan işletmez; cüzdanları listeler; sandbox tek | Kapalı | [ADR-0042](docs/adr/0042-network-and-wallets.md), [ADR-0038](docs/adr/0038-sandbox.md) |
| D-GRD-0 | Guardian/Escrow çekirdeği | Kapalı |  |
| D-GRD-1 | Kriptografik primitifler | İlke kapalı; ayrıntı uygulamada |  |
| D-GRD-2 | Escrow Store operasyonu | İlke kapalı; ayrıntı uygulamada |  |
| D-GTM-1 | Pazara giriş / pilot yönü | Kapalı |  |
| D-GTM-2 | Pilot ön koşulları ve sınırlar bildirimi v2 | Kapalı | [ADR-0009](docs/adr/0009-phase-b-chainless-beta-and-chain-threshold.md) |
| D-ID-0 | Pseudonym = self-certifying, pairwise, unlinkable | Kapalı |  |
| D-ID-1 | Kurumsal kimlik: X.509 | Kapalı | [ADR-0004](docs/adr/0004-x509-institutional-identity.md) |
| D-ID-2 | Onboarding / kimlik-ispatı yöntemi | Kapalı |  |
| D-ID-3 | Vatandaş-olmayanlar (mülteci, vatansız, turist, gözlemci) | Kapalı |  |
| D-ID-4 | Kurumsal / nesne kimlikleri | Kapalı | [ADR-0004](docs/adr/0004-x509-institutional-identity.md) |
| D-ID-5 | X.509 teknik ayrıntıları | Kapalı |  |
| D-ID-6 | Tamga geçici kimlik attestation sağlayıcısı | Kapalı | [ADR-0011](docs/adr/0011-provisional-identity-attestation-provider.md) |
| D-ID-7 | Kimlik servisi nitelikli olmayan EAA, güvence I2 | Kapalı | [ADR-0022](docs/adr/0022-identity-service-non-qualified.md) |
| D-ID-8 | Doğrulanmış sürücü belgesi bilgisi (resmî sürücü belgesi değil) | Kapalı | [ADR-0039](docs/adr/0039-driving-licence-attestation.md) |
| D-ID-9 | Sandbox'ta gerçek kimlik doğrulama | Kapalı | [ADR-0040](docs/adr/0040-sandbox-invited-real-identity.md) |
| D-ID-10 | Yaş sınırı yok: AB yaklaşımı | Kapalı | [ADR-0043](docs/adr/0043-no-age-limit.md) |
| D-ID-esk | Çifte vatandaşlık = hibrit; assurance = eIDAS LoA'ya 1:1 | Kapalı |  |
| D-NAME-1 | Alan adı şeması | Kapalı | [ADR-0019](docs/adr/0019-institution-console-and-database.md) |
| D-NAME-3 | Ürün adları: Tamga Wallet, "Tamga ile giriş yap", Tamga Verify | Kapalı | [ADR-0030](docs/adr/0030-product-names.md) |
| D-NET-1 | QBFT vs IBFT 2.0 | Kapalı |  |
| D-NET-2 | Faz 0 validator sayısı | Kapalı |  |
| D-NET-3 | Ölçek stratejisi (>~20 devlet) | Kapalı |  |
| D-NET-4 | Kontrat upgrade deseni | Kapalı |  |
| D-NET-5 | Cross-recognition gaz/okuma optimizasyonu | İlke kapalı; ayrıntı uygulamada |  |
| D-OSS-1 | Depo adları ve açık kaynak sınırı | Kapalı |  |
| D-OSS-2 | npm kapsamı `@tamga-network` | Kısmen değişti, bkz. D-NAME-3 | [ADR-0030](docs/adr/0030-product-names.md) |
| D-PRIV-1 | Site başına takma ad | Kapalı | [ADR-0031](docs/adr/0031-per-site-pseudonyms.md) |
| D-PROTO-1 | İhraç teklif sınıfları: `on-screen` / `out-of-band` | Kapalı |  |
| D-PROTO-2 | HAIP 1.0: doğrulayıcı istemci kimliği `x509_hash`, WIA `sub` ortak değer | Kapalı | [ADR-0034](docs/adr/0034-haip-client-id-and-wia-sub.md) |
| D-PROX-1 | Yakın alan sunumu: cüzdan QR gösterir; köprü yollar B/C, hedef ISO 18013-5 | Kapalı | [ADR-0012](docs/adr/0012-proximity-presentation-and-single-use-attestations.md) |
| D-REG-1 | Katılımcı kayıt verisi: AB ortak veri seti | Kapalı | [ADR-0024](docs/adr/0024-participant-registration-data.md) |
| D-REG-2 | Kayıt sertifikaları (WRPRC) | Kapalı | [ADR-0026](docs/adr/0026-registration-certificates.md) |
| D-REV-1 | Status list off-chain, zincirde yalnızca URI + içerik hash'i + sürüm çapası; sabit aralıklı ve gürültülü yayın | Kapalı | [ADR-0008](docs/adr/0008-status-list-placement.md) |
| D-REV-2 | `isRevoked` zincir arayüzü kaldırıldı — zincir bu soruyu cevaplayamaz | Kapalı | [ADR-0008](docs/adr/0008-status-list-placement.md) |
| D-REV-3 | İndeksler rastgele tahsis edilir, liste URI'si opaktır, listeler yıl/bölüm/kohort ölçütüyle bölünmez | Kapalı |  |
| D-REVIEW-1 | Mağaza incelemesi için tek kullanımlık inceleme kodu | Kapalı | [ADR-0033](docs/adr/0033-store-review-access.md) |
| D-SCHEMA-1 | Şema kayıt defteri = off-chain Type Metadata + on-chain çapa; `vct` kararlı HTTPS URL, `vct#integrity` zorunlu; iki katman NETWORK (2/3 oy) / NATIONAL (`onlyOwnerState`) | Geçersiz, yerine D-SCHEMA-4 | [ADR-0007](docs/adr/0007-schema-registry-architecture.md) |
| D-SCHEMA-2 | Issuer↔şema yetkisi allowlist; yetkisiz şemayla imzalanan belge reddedilir (kategori aşımı kapandı) | Kapalı | [ADR-0007](docs/adr/0007-schema-registry-architecture.md) |
| D-SCHEMA-3 | Eğitim şemaları ELM v3 semantiğini devralır; kontrollü sözlükler (EQF, ISCED-F) aynen kullanılır, JSON-LD taşıyıcısı alınmaz | Kapalı |  |
| D-SCHEMA-4 | Tip kimliği URN, metadata katalogdan | Kapalı | [ADR-0010](docs/adr/0010-vct-urn-and-eaa-category-signal.md) |
| D-SCHEMA-5 | Geliştirme evresinde şemalar yerinde düzeltilir | Kapalı | [ADR-0029](docs/adr/0029-development-stage-schemas.md), [ADR-0010](docs/adr/0010-vct-urn-and-eaa-category-signal.md) |
| D-SRC-1 | Yetkili kaynak kurumdadır; Tamga kişi kaydı tutmaz | Kapalı | [ADR-0020](docs/adr/0020-authentic-source-at-institution.md) |
| D-STR-1 | Çekirdek farklılaşma | Kapalı |  |
| D-STR-2 | Genişleme kapsamı | Kapalı | [ADR-0003](docs/adr/0003-value-layer-hooks.md) |
| D-STR-3 | Türk Devletleri Teşkilatı ile ilişki | Kapalı |  |
| D-STR-4 | EBSI interoperability entegrasyon noktaları | Kapalı | [ADR-0006](docs/adr/0006-credential-format-sd-jwt-vc.md) |
| D-TRUST-0 | Kişisel veri/credential asla zincirde | Kapalı |  |
| D-TRUST-1 | Tek güven arayüzü; cüzdan dahil (trust/core) | Kapalı | [ADR-0015](docs/adr/0015-single-trust-interface-for-clients.md) |
| D-TRUST-2 | Güven federasyonu: dış listeler LOTL'da işaretçi + sabit imzacı + kapsam; AB PID/mDL doğrulama | Kapalı | [ADR-0036](docs/adr/0036-trust-federation-external-lists.md) |
| D-TRUST-3 | Sandbox: ayrı test ağı (sandbox.tamga.network) | Kapalı | [ADR-0038](docs/adr/0038-sandbox.md) |
| D-TRUST-4 | Sandbox'ta kurum test hesapları | Kapalı | [ADR-0041](docs/adr/0041-sandbox-institution-test-accounts.md) |
| D-WALLET-1 | Otomatik kopya yenileme (yenileme belirteciyle) | Kapalı | [ADR-0023](docs/adr/0023-automatic-copy-refresh.md) |
| D-WALLET-2 | Günlüğün kişinin başlattığı şifreli dışa aktarımı (AB TS10) | Kapalı | [ADR-0027](docs/adr/0027-user-initiated-log-export.md) |
| D-ZK-1 | Sıfır bilgi ispatlı mdoc sunumu: Longfellow, ilk yüklem yaş | Kapalı | [ADR-0032](docs/adr/0032-zk-mdoc-presentation.md) |
