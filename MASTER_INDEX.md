# Belge dizini

> Bu dosya `node scripts/master-index.mjs` ile belgelerin front matter'ından **üretilir**; elle düzenlenmez.
> Belgeler birbirine kimlikle (`[[ADR-0031]]`) bağlanır; klasör ya da başlık değişse de kimlik değişmez.

Okuma sırası: Başlarken → Kavramlar → Şartnameler → Tamga ARF → Kararlar. Kök belgeler: `README.md`, `DECISIONS.md`
(kararların özeti), `INVARIANTS.md` (bağlayıcı kurallar, üretilir), `docs/glossary.md` (sözlük), `CONVENTIONS.md` (kod kuralları),
`DOCUMENTATION-STANDARD.md` (belge kuralları), `CHANGELOG.md` (sürüm notları).

## Başlarken (rehberler)

Adım adım: doğrulayıcı, belge veren kurum, cüzdan geliştirici.

| Kimlik | Başlık | Sürüm | Durum | Dosya |
|---|---|---|---|---|
| `GUIDE-0000` | Başlarken | 1.0.0 | Active | `docs/guides/index.md` |
| `GUIDE-0001` | “Tamga ile giriş yap” eklemek | 1.0.0 | Active | `docs/guides/sign-in-with-tamga.md` |
| `GUIDE-0002` | Sunucuda doğrulama | 1.0.0 | Active | `docs/guides/verify-on-server.md` |
| `GUIDE-0003` | Kurum olarak belge vermek | 1.0.0 | Active | `docs/guides/issue-credentials.md` |
| `GUIDE-0004` | Kod örnekleri | 1.0.0 | Active | `docs/guides/code-examples.md` |
| `GUIDE-0005` | Cüzdan geliştirmek | 1.0.0 | Active | `docs/guides/build-a-wallet.md` |
| `GUIDE-0006` | Güven listelerini okumak | 1.0.0 | Active | `docs/guides/read-trust-lists.md` |
| `GUIDE-0007` | Kurum olarak ağa katılmak | 1.0.0 | Active | `docs/guides/join-as-institution.md` |
| `GUIDE-0008` | Doğrulayıcı olarak kayıt olmak | 1.0.0 | Active | `docs/guides/register-verifier.md` |
| `GUIDE-0009` | Uyum testleri | 1.0.0 | Active | `docs/guides/conformance.md` |
| `GUIDE-0010` | Cüzdan yayın öncesi kontrol listesi | 1.0.0 | Active | `docs/guides/wallet-checklist.md` |
| `GUIDE-0011` | Ulusal güven listesi yayınlamak | 1.0.0 | Active | `docs/guides/publish-national-list.md` |
| `GUIDE-0012` | Sorun giderme | 1.0.0 | Active | `docs/guides/troubleshooting.md` |
| `GUIDE-0013` | Sandbox: test ağı | 1.0.0 | Active | `docs/guides/sandbox.md` |

## Şartnameler

Kesin kurallar; uygulama bunlara uyar.

| Kimlik | Başlık | Sürüm | Durum | Dosya |
|---|---|---|---|---|
| `SPEC-API-0001` | Doğrulama hattı ve API | 1.0.0 | Active | `docs/specifications/verification-api.md` |
| `SPEC-CRED-0001` | Belge biçimi ve protokoller | 1.0.0 | Active | `docs/specifications/credential-format.md` |
| `SPEC-CRED-0002` | SD-JWT VC profili | 1.0.0 | Active | `docs/specifications/sd-jwt-vc.md` |
| `SPEC-CRED-0003` | İptal ve durum listesi | 1.0.0 | Active | `docs/specifications/status-list.md` |
| `SPEC-ID-0002` | Kurum kimliği (X.509) | 1.0.0 | Active | `docs/specifications/x509-identity.md` |
| `SPEC-ID-0003` | Kimlik doğrulama | 1.0.0 | Active | `docs/specifications/identity-proofing.md` |
| `SPEC-PROTO-0001` | OpenID4VCI profili | 1.0.0 | Active | `docs/specifications/openid4vci.md` |
| `SPEC-PROTO-0002` | OpenID4VP profili | 1.0.0 | Active | `docs/specifications/openid4vp.md` |
| `SPEC-SCHEMA-0001` | Şema kataloğu | 1.0.0 | Active | `docs/specifications/schema-catalog.md` |
| `SPEC-SCHEMA-0002` | Eğitim şemaları | 1.0.0 | Active | `docs/specifications/education-schemas.md` |
| `SPEC-SCHEMA-0003` | Sektör şemaları | 1.0.0 | Active | `docs/specifications/sector-schemas.md` |
| `SPEC-TRUST-0001` | Güven listeleri | 1.0.0 | Active | `docs/specifications/trust-lists.md` |
| `SPEC-WALLET-0001` | Cüzdan kuralları | 1.0.0 | Active | `docs/specifications/wallet.md` |

## Tamga ARF ve ekleri

Roller ve kurallar (arf.tamga.network).

| Kimlik | Başlık | Sürüm | Durum | Dosya |
|---|---|---|---|---|
| `FW-ARF-0001` | Mimari ve Referans Çerçevesi | 1.0.0 | Active | `docs/framework/0001-tamga-arf.md` |
| `FW-DEF-0001` | Ek D — Tanımlar | 1.0.0 | Active | `docs/framework/0007-definitions.md` |
| `FW-ONB-0001` | Katılım süreci | 1.0.0 | Active | `docs/framework/0011-onboarding.md` |
| `FW-RB-0001` | Ek B — Tamga Rulebook | 1.0.0 | Active | `docs/framework/0003-tamga-rulebook.md` |
| `FW-RB-0002` | Education Rulebook | 1.0.0 | Active | `docs/framework/0004-education-rulebook.md` |
| `FW-RB-0003` | Identity Rulebook | 1.0.0 | Active | `docs/framework/0005-identity-rulebook.md` |
| `FW-RB-0004` | Event Ticket Rulebook | 1.0.0 | Active | `docs/framework/0006-event-ticket-rulebook.md` |
| `FW-READ-0001` | Okuma yolu | 1.0.0 | Active | `docs/framework/0009-reading-path.md` |
| `FW-REF-0001` | Ek E — Kaynaklar | 1.0.0 | Active | `docs/framework/0008-references.md` |
| `FW-ROLE-0001` | Roller | 1.0.0 | Active | `docs/framework/0010-roles.md` |
| `FW-TF-0001` | Ek A — Trust Framework | 1.0.0 | Active | `docs/framework/0002-trust-framework.md` |

## Mimari

Bugünkü bileşenler ve güven sınırları.

| Kimlik | Başlık | Sürüm | Durum | Dosya |
|---|---|---|---|---|
| `ARCH-0003` | Bileşen mimarisi | 1.0.0 | Active | `docs/architecture/components.md` |
| `ARCH-0004` | Sunucular ve işletim | 1.0.0 | Active | `docs/architecture/servers.md` |
| `ARCH-0005` | Paket yayınlama | 1.0.0 | Active | `docs/architecture/package-publishing.md` |

## Kararlar (ADR)

Kapatılmış kararlar; değişiklik yeni ADR ile.

| Kimlik | Başlık | Sürüm | Durum | Dosya |
|---|---|---|---|---|
| `ADR-0001` | Besu QBFT defteri | 1.0.0 | Active | `docs/adr/0001-blockchain-framework-besu-qbft.md` |
| `ADR-0002` | Egemenlik öncelikli yönetişim | 1.0.0 | Active | `docs/adr/0002-sovereignty-first-governance.md` |
| `ADR-0003` | Değer katmanı kancaları | 1.0.0 | Active | `docs/adr/0003-value-layer-hooks.md` |
| `ADR-0004` | Kurum kimliği: X.509 | 1.0.0 | Active | `docs/adr/0004-x509-institutional-identity.md` |
| `ADR-0005` | Güvence modeli ve devletsiz başlangıç | 1.0.0 | Active | `docs/adr/0005-assurance-framework-and-stateless-bootstrap.md` |
| `ADR-0006` | Belge biçimi: SD-JWT VC | 1.0.0 | Active | `docs/adr/0006-credential-format-sd-jwt-vc.md` |
| `ADR-0007` | Şema kayıt defteri | 1.0.0 | Active | `docs/adr/0007-schema-registry-architecture.md` |
| `ADR-0008` | İptal listesinin yeri | 1.0.0 | Active | `docs/adr/0008-status-list-placement.md` |
| `ADR-0009` | Zincirsiz beta ve zincir eşiği | 1.0.0 | Active | `docs/adr/0009-phase-b-chainless-beta-and-chain-threshold.md` |
| `ADR-0010` | Belge türü kimliği (URN) | 1.0.0 | Active | `docs/adr/0010-vct-urn-and-eaa-category-signal.md` |
| `ADR-0011` | Geçici kimlik belgesi sağlayıcısı | 1.0.0 | Active | `docs/adr/0011-provisional-identity-attestation-provider.md` |
| `ADR-0012` | Yakın alanda belge gösterme | 1.0.0 | Active | `docs/adr/0012-proximity-presentation-and-single-use-attestations.md` |
| `ADR-0013` | Kimlik belgesi için mdoc | 1.0.0 | Active | `docs/adr/0013-mdoc-dual-format-for-identity.md` |
| `ADR-0014` | Etkinlik kategorisi | 1.0.0 | Active | `docs/adr/0014-issuer-category-events.md` |
| `ADR-0015` | Tek güven arayüzü | 1.0.0 | Active | `docs/adr/0015-single-trust-interface-for-clients.md` |
| `ADR-0016` | Barındırılan belge vermeye erişim | 1.0.0 | Active | `docs/adr/0016-hosted-issuer-api-access.md` |
| `ADR-0017` | Doğrulama sonucuna erişim | 1.0.0 | Active | `docs/adr/0017-hosted-verifier-result-access.md` |
| `ADR-0018` | Belgelerin üç kapısı | 1.0.0 | Active | `docs/adr/0018-documentation-three-doors.md` |
| `ADR-0019` | Kurum Konsolu | 1.0.0 | Active | `docs/adr/0019-institution-console-and-database.md` |
| `ADR-0020` | Yetkili kaynak kurumdadır | 1.0.0 | Active | `docs/adr/0020-authentic-source-at-institution.md` |
| `ADR-0021` | E-posta ve telefon belgeleri | 1.0.0 | Active | `docs/adr/0021-verified-contact-credentials.md` |
| `ADR-0022` | Kimlik servisinin sınıfı | 1.0.0 | Active | `docs/adr/0022-identity-service-non-qualified.md` |
| `ADR-0023` | Otomatik kopya yenileme | 1.0.0 | Active | `docs/adr/0023-automatic-copy-refresh.md` |
| `ADR-0024` | Katılımcı kayıt verisi | 1.0.0 | Active | `docs/adr/0024-participant-registration-data.md` |
| `ADR-0025` | Cüzdan ve anahtar kanıtı | 1.0.0 | Active | `docs/adr/0025-wallet-instance-and-key-attestations.md` |
| `ADR-0026` | Kayıt sertifikaları | 1.0.0 | Active | `docs/adr/0026-registration-certificates.md` |
| `ADR-0027` | İşlem günlüğünü dışa aktarma | 1.0.0 | Active | `docs/adr/0027-user-initiated-log-export.md` |
| `ADR-0028` | Sağlık belgeleri | 1.0.0 | Proposed | `docs/adr/0028-health-credentials.md` |
| `ADR-0029` | Geliştirme evresinde şemalar | 1.0.0 | Active | `docs/adr/0029-development-stage-schemas.md` |
| `ADR-0030` | Ürün adları | 1.0.0 | Active | `docs/adr/0030-product-names.md` |
| `ADR-0031` | Site başına takma ad | 1.0.0 | Active | `docs/adr/0031-per-site-pseudonyms.md` |
| `ADR-0032` | Sıfır bilgi ispatı (ZK) | 1.0.0 | Active | `docs/adr/0032-zk-mdoc-presentation.md` |
| `ADR-0033` | Mağaza inceleme kodu | 1.0.0 | Active | `docs/adr/0033-store-review-access.md` |
| `ADR-0034` | HAIP 1.0 uyumu | 1.0.0 | Active | `docs/adr/0034-haip-client-id-and-wia-sub.md` |
| `ADR-0035` | Konumlanma | 1.0.0 | Active | `docs/adr/0035-positioning-three-layers.md` |
| `ADR-0036` | Güven federasyonu | 1.0.0 | Active | `docs/adr/0036-trust-federation-external-lists.md` |
| `ADR-0037` | Tamga Network yalnızca bir ağdır | 1.0.0 | Active | `docs/adr/0037-network-only.md` |
| `ADR-0038` | Sandbox: test ağı | 1.0.0 | Active | `docs/adr/0038-sandbox.md` |
| `ADR-0039` | Doğrulanmış sürücü belgesi bilgisi | 1.0.0 | Active | `docs/adr/0039-driving-licence-attestation.md` |
| `ADR-0040` | Sandbox'ta gerçek kimlik doğrulama | 1.0.0 | Active | `docs/adr/0040-sandbox-invited-real-identity.md` |
| `ADR-0041` | Sandbox'ta kurum test hesapları | 1.0.0 | Active | `docs/adr/0041-sandbox-institution-test-accounts.md` |
| `ADR-0042` | Ağ ve cüzdanlar: ağ cüzdan işletmez | 1.0.0 | Active | `docs/adr/0042-network-and-wallets.md` |

## Arka plan

Gerekçe (PM-*) ve araştırma (RS-*); sitede yayınlanmaz.

| Kimlik | Başlık | Sürüm | Durum | Dosya |
|---|---|---|---|---|
| `PM-ASSUR-0001` | İki Eksenli Assurance Modeli ve Devletsiz Bootstrap | 1.0.0 | Draft | `docs/background/project-memory/assurance/0001-two-axis-assurance-and-stateless-bootstrap.md` |
| `PM-AUTH-0001` | Değer Katmanı Stratejisi — Yetkilendirme Katmanı, Mutabakat Değil | 1.0.0 | Active | `docs/background/project-memory/authorization/0001-value-layer-authorization-strategy.md` |
| `PM-GOV-0001` | Yönetişim ve İşletim Politikası — Kodla Sınırlanamayan Yetkiler | 1.0.0 | Active | `docs/background/project-memory/governance/0001-governance-and-operating-policy.md` |
| `PM-GTM-0001` | Pilot Planı — Üniversite Diploma Pilotu, Ön Koşullar ve Durdurma Ölçütleri | 1.0.0 | Active | `docs/background/project-memory/gtm/0001-pilot-plan.md` |
| `PM-ID-0001` | Kimlik Modeli — Root Identity, Cüzdan-Vatandaş Bağı ve Çok-Ülkeli Yapı | 1.0.0 | Draft | `docs/background/project-memory/identity/0001-identity-model-and-wallet-binding.md` |
| `PM-ID-0002` | Accountable Disclosure ve Escrowed Identity — Eşikli (Threshold) Yetki Modeli | 1.0.0 | Draft | `docs/background/project-memory/identity/0002-accountable-disclosure-escrowed-identity.md` |
| `PM-PH-0001` | Digital Trust Infrastructure Felsefesi ve Tamga'nın Konumlandırması | 1.0.0 | Draft | `docs/background/project-memory/philosophy/0001-digital-trust-infrastructure.md` |
| `PM-SCHEMA-0001` | Neden Kendi Şema Kayıt Defterimiz Var — Yetki, Anlam ve Ağ Etkisi | 1.0.0 | Active | `docs/background/project-memory/schema/0001-why-own-schema-registry.md` |
| `RS-EIDAS-0001` | eIDAS 2.0 ve EUDI Wallet — Ekosistem, ARF ve Teknik Stack | 1.0.0 | Draft | `docs/background/research/0001-eidas2-and-eudi-wallet.md` |
| `RS-SCHEMA-0001` | Uluslararası Credential Şema Standartları — ELM, Open Badges, FHIR, mDL, DTC, vLEI | 1.0.0 | Active | `docs/background/research/0005-international-credential-schemas.md` |

## Zincir aşaması

Bugün kullanılmıyor (ADR-0009 eşiği); sitede yayınlanmaz.

| Kimlik | Başlık | Sürüm | Durum | Dosya |
|---|---|---|---|---|
| `ARCH-0001` | Ağ topolojisi (zincir aşaması) | 1.0.0 | Draft | `docs/ledger/architecture/0001-network-architecture.md` |
| `ARCH-0002` | Besu ağı kurulumu | 1.0.0 | Draft | `docs/ledger/architecture/0002-besu-network-setup-step-by-step.md` |
| `ARCH-0006` | Canlıya alma adımları | 1.0.0 | Active | `docs/ledger/architecture/0006-getting-started-runbook.md` |
| `PM-BC-0001` | Blockchain Seçimi ve Validator Modeli | 1.0.0 | Draft | `docs/ledger/project-memory/blockchain/0001-blockchain-and-validator-model.md` |
| `PM-TRUST-0001` | On-Chain / Off-Chain Sınırı — Zincire Ne Yazılır, Ne Yazılmaz | 1.0.0 | Draft | `docs/ledger/project-memory/trust/0001-onchain-offchain-boundary.md` |
| `RS-FRAMEWORKS-0001` | Blockchain Framework Karşılaştırması — Hyperledger Besu (QBFT) vs Cosmos SDK (CometBFT) | 1.0.0 | Draft | `docs/ledger/research/0003-blockchain-frameworks-comparison.md` |
| `RS-FRAMEWORKS-0002` | Besu vs Kendi Rust Ağı — Hazır Motor mu, Kendi Zincirimizi Yazmak mı? | 1.0.0 | Draft | `docs/ledger/research/0004-besu-vs-custom-rust-chain.md` |
| `SPEC-AGENT-0001` | Ajan yetkilendirme (zincir aşaması) | 1.0.0 | Active | `docs/ledger/specifications/0015-agent-delegation-and-credential-gating.md` |
| `SPEC-BC-0001` | Güven katmanı kontratları | 1.0.0 | Active | `docs/ledger/specifications/0001-trust-layer-contracts.md` |
| `SPEC-BC-0002` | Emanet ve hesap verebilir açıklama | 1.0.0 | Draft | `docs/ledger/specifications/0003-guardian-escrow-accountable-disclosure.md` |

**Toplam:** 103 belge.
