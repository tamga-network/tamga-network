---
document_id: FW-REF-0001
title: Ek E — Kaynaklar
category: Framework
domain: Architecture
status: Active
review_status: Completed
version: 0.1.0
created: 2026-10-01
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: framework
audience:
  - institutions
  - regulators
  - integrators
  - engineers
tags:
  - framework
  - arf
  - references
related:
  - FW-ARF-0001
  - FW-DEF-0001
depends_on:
  - FW-ARF-0001
summary: >
  Tamga ARF'nin dayandığı standartlar ve düzenlemeler, Tamga karar kayıtları ve spesifikasyonları ve eklerdeki her bağlayıcı
  kuralın kaynağı.
priority: High
---

# 1. Standartlar ve düzenlemeler

| Kaynak | Adres |
|---|---|
| Regulation (EU) 2024/1183 (eIDAS 2.0) | <https://eur-lex.europa.eu/eli/reg/2024/1183/oj> |
| EUDI Wallet Architecture and Reference Framework (ARF) | <https://eu-digital-identity-wallet.github.io/eudi-doc-architecture-and-reference-framework/> |
| OpenID for Verifiable Credential Issuance 1.0 | <https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html> |
| OpenID for Verifiable Presentations 1.0 | <https://openid.net/specs/openid-4-verifiable-presentations-1_0.html> |
| OpenID4VC High Assurance Interoperability Profile (HAIP) 1.0 | <https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0.html> |
| IETF SD-JWT-based Verifiable Credentials (SD-JWT VC) | <https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/> |
| IETF Token Status List | <https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/> |
| ISO/IEC 18013-5 — mobile driving licence (mdoc) | <https://www.iso.org/standard/69084.html> |
| W3C Digital Credentials API | <https://www.w3.org/TR/digital-credentials/> |
| ETSI TS 119 612 — Trusted Lists; ETSI TS 119 602 — Lists of trusted entities | <https://www.etsi.org/standards> |
| ETSI TS 119 471, 119 472-1/-2/-3, 119 475, 119 461; ETSI EN 319 401 | <https://www.etsi.org/standards> |
| RFC 2119 — requirement keywords; RFC 5280 — X.509 | <https://www.rfc-editor.org/> |
| Longfellow ZK | <https://github.com/longfellow-zk/longfellow-zk> |
| Europass / European Learning Model | <https://europa.eu/europass/> |

# 2. Tamga karar kayıtları ve spesifikasyonları

Teknik ayrıntılar ve kararların gerekçeleri geliştirici belgelerindedir (docs.tamga.network). Bu çerçevedeki kurallar aşağıdaki belgelerden derlenmiştir.

| Alan | Belgeler |
|---|---|
| Güven modeli ve yönetişim | [[ADR-0009]] · [[ADR-0010]] · [[ADR-0035]] · [[SPEC-TRUST-0001]] · [[SPEC-ID-0002]] · [[PM-GOV-0001]] · [[PM-ASSUR-0001]] |
| Kayıt | [[ADR-0024]] · [[ADR-0026]] · [[ADR-0034]] |
| Belge biçimleri ve türleri | [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] · [[ADR-0013]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] |
| Belge verme | [[SPEC-PROTO-0001]] · [[ADR-0016]] · [[ADR-0020]] · [[ADR-0021]] · [[ADR-0023]] |
| Gösterme ve doğrulama | [[SPEC-PROTO-0002]] · [[SPEC-API-0001]] · [[ADR-0012]] · [[ADR-0017]] · [[ADR-0032]] |
| Cüzdan | [[SPEC-WALLET-0001]] · [[ADR-0025]] · [[ADR-0027]] · [[ADR-0031]] |
| Kimlik | [[SPEC-ID-0003]] · [[ADR-0011]] · [[ADR-0022]] · [[ADR-0033]] |
| Adlar | [[ADR-0030]] |

# 3. Kural kaynakları

Eklerdeki her bağlayıcı kural bir karardan ya da kodlu bir değişmezden türetilmiştir. Aşağıdaki tablolar kuralı kaynağına bağlar (`BELGE/KOD` biçimi). Kural metni ile kaynak çelişirse kaynak geçerlidir.

## Ek A — Güven Çerçevesi

| Kural | Kaynak |
|---|---|
| G-A | D-SCHEMA-2 |
| G-B | [[PM-GOV-0001]]/G6, G8 |

## Ek B — Katılımcı Kuralları

| Kural | Kaynak |
|---|---|
| RB-GEN-01 | [[SPEC-BC-0001]]/DP1, [[PM-TRUST-0001]] |
| RB-GEN-02 | BT4, [[ARCH-0003]]/CMP1, [[ADR-0015]] |
| RB-GEN-03 | BT5, [[ARCH-0003]]/CMP4 |
| RB-GEN-04 | [[ARCH-0003]]/CMP2, [[ARCH-0005]]/P6 |
| RB-GEN-05 | [[PM-GOV-0001]]/G2, P2 |
| RB-GEN-06 | [[SPEC-API-0001]]/AP3, AP4; [[ARCH-0004]]/O4 |
| RB-GEN-07 | [[ARCH-0005]]/P1–P3 |
| RB-GEN-08 | [[PM-ASSUR-0001]] |
| RB-GEN-09 | [[FW-TF-0001]] §5.2 (ÖNERİ sayılar) |
| RB-GEN-10 | [[ADR-0009]] K3, K6; [[PM-GOV-0001]]/G7 |
| RB-OP-01 | BT1, [[ADR-0009]] K5.3 |
| RB-OP-02 | BT2, ETSI 119 612 §5.3.12 |
| RB-OP-03 | [[ADR-0009]] K2 |
| RB-OP-04 | [[ADR-0009]] K2 |
| RB-OP-05 | BT3, ETSI 119 612 Annex A.2 |
| RB-OP-06 | [[ADR-0009]] K2 |
| RB-OP-08 | [[PM-GOV-0001]]/G1, BT7 |
| RB-OP-09 | [[PM-GOV-0001]]/G3, [[ADR-0017]] |
| RB-OP-10 | [[PM-GOV-0001]] P1.c–d, G6 |
| RB-OP-11 | [[PM-GOV-0001]]/G4, P4 |
| RB-OP-12 | [[PM-GOV-0001]]/G8 |
| RB-OP-13 | [[PM-GOV-0001]]/G5, P5 |
| RB-OP-14 | [[ADR-0009]] K5 |
| RB-OP-15 | [[ADR-0009]] K4, K7; BT10 |
| RB-OP-16 | [[SPEC-SCHEMA-0001]]/D1, D8 |
| RB-OP-17 | [[ADR-0017]] HV1–HV5 |
| RB-OP-18 | [[ADR-0016]] HA1–HA3 |
| RB-REG-01 | D-SCHEMA-2 |
| RB-REG-02 | [[SPEC-BC-0001]]/N1 |
| RB-REG-03 | [[SPEC-BC-0001]]/CA3 |
| RB-REG-04 | [[SPEC-BC-0001]]/I1, I3 |
| RB-REG-05 | [[ADR-0010]] K5 |
| RB-REG-06 | [[SPEC-ID-0002]]/XC2, [[SPEC-BC-0001]]/CA1 |
| RB-REG-07 | [[SPEC-BC-0001]]/GV1, I4 |
| RB-REG-08 | [[SPEC-API-0001]]/AP6 |
| RB-REG-09 | [[FW-TF-0001]] §5.2 (ÖNERİ) |
| RB-AP-01 | [[SPEC-ID-0002]]/XC1, [[SPEC-CRED-0002]]/C15 |
| RB-AP-02 | [[PM-GOV-0001]]/G1, BT7, [[ARCH-0004]]/O3 |
| RB-AP-03 | [[ARCH-0003]]/K1, [[SPEC-CRED-0003]]/S11 |
| RB-AP-04 | [[SPEC-PROTO-0001]]/PR5, [[SPEC-CRED-0002]]/C1 |
| RB-AP-05 | [[SPEC-PROTO-0001]]/PR2 |
| RB-AP-06 | PR1, BT6, |
| RB-AP-07 | PR3, DB-5 |
| RB-AP-08 | PR4, PR9 |
| RB-AP-09 | PR6, PR10 |
| RB-AP-10 | ETSI TS 119 471 REQ-EAASP-4.2.1.2; DB-16 (spec'e taşınacak) |
| RB-AP-11 | PR7, [[SPEC-ID-0003]], ETSI TS 119 472-3 GEN-REQ-4.1 |
| RB-AP-12 | ETSI TS 119 471 REQ-EAASP-4.2.1.1 |
| RB-AP-13 | [[SPEC-SCHEMA-0002]]/E11, [[ARCH-0003]]/CMP5 |
| RB-AP-14 | [[ADR-0010]] K5, PR7 |
| RB-AP-15 | DB-5, |
| RB-AP-16 | PR8, [[SPEC-API-0001]]/AP10 |
| RB-AP-17 | [[SPEC-CRED-0003]]/S5, S6 |
| RB-AP-18 | S2, S3, S7–S10 |
| RB-AP-19 | S1, S4 |
| RB-AP-20 | [[SPEC-BC-0001]]/R2, I4 |
| RB-AP-21 | [[PM-GTM-0001]]/GT7 |
| RB-AP-22 | [[ARCH-0004]]/O6 |
| RB-AP-23 | [[SPEC-ID-0003]] §5 (Draft) |
| RB-AP-24 | [[SPEC-ID-0003]], PR7 |
| RB-AP-25 | [[ADR-0016]], D-API-1 |
| RB-AP-ID-01 | [[SPEC-ID-0003]]/IDP3 |
| RB-AP-ID-02 | [[SPEC-ID-0003]]/IDP11, KVKK m.10 |
| RB-AP-ID-03 | [[SPEC-ID-0003]]/IDP9 |
| RB-AP-ID-04 | [[SPEC-ID-0003]] §9, IDP10 |
| RB-AP-ID-05 | [[ADR-0011]] K6 |
| RB-AP-ID-06 | [[SPEC-TRUST-0001]]/TL8 |
| RB-AP-ID-07 | [[ADR-0031]] PS2, PS3 |
| RB-RP-ID-01 | [[SPEC-PROTO-0001]]/PR14 |
| RB-AS-01 | [[FW-TF-0001]] §5.1 |
| RB-AS-02 | [[SPEC-SCHEMA-0002]]/E11 |
| RB-AS-03 | [[SPEC-SCHEMA-0002]]/E1, [[SPEC-SCHEMA-0003]]/SK6 |
| RB-AS-04 | [[PM-GTM-0001]]/GT2 |
| RB-WP-01 | [[SPEC-WALLET-0001]]/WL1, WL3 |
| RB-WP-02 | [[SPEC-CRED-0001]] §4 |
| RB-WP-03 | WL11 |
| RB-WP-04 | WL8, [[SPEC-PROTO-0002]] |
| RB-WP-05 | WL5, WL6 |
| RB-WP-06 | WL4, [[ADR-0027]], [[SPEC-PROTO-0002]]/PV8 |
| RB-WP-07 | WL2, WL10 |
| RB-WP-08 | WL9, WL7, [[ARCH-0003]]/CMP8 |
| RB-WP-09 | PV1–PV4 |
| RB-WP-10 | R-36 (ÖNERİ) |
| RB-WP-11 | [[FW-TF-0001]] §4.6; R-33 |
| RB-WP-12 | [[SPEC-CRED-0003]]/S14 |
| RB-WP-13 | [[ADR-0017]] HV6; WL5 |
| RB-RP-01 | [[SPEC-API-0001]]/AP6, [[SPEC-PROTO-0002]] |
| RB-RP-02 | PV1, PV3, PV6, PV9, PV10 |
| RB-RP-03 | AP8, AP11 |
| RB-RP-04 | AP12, C15 |
| RB-RP-05 | AP2, [[ARCH-0005]]/P5 |
| RB-RP-06 | S12, S13 |
| RB-RP-07 | [[PM-GOV-0001]]/G3 |
| RB-RP-08 | AP3, AP4, AP9, AP5 |
| RB-RP-09 | [[FW-TF-0001]] §5.3 |
| RB-RP-10 | PV5, S14 |
| RB-RP-11 | DB-9 |
| RB-RP-12 | [[ADR-0017]] HV1, HV4 |
| RB-RP-13 | [[ADR-0031]] PS4, PS5; [[SPEC-API-0001]] P1 |
| RB-H-01 | [[PM-GTM-0001]]/GT7 |
| RB-H-02 | WL8 |
| RB-H-03 | WL4, [[ADR-0027]] |
| RB-H-04 | WL1–WL2 |
| RB-H-06 | XC4, WL5; GENEL-ANALIZ 4.A/2 |
| RB-H-07 | R-35 |
| RB-SCH-01 | [[ADR-0010]] |
| RB-SCH-02 | [[SPEC-SCHEMA-0001]]/D1, D2 |
| RB-SCH-03 | D6, D7, E6 |
| RB-SCH-04 | E10, SK6 |
| RB-SCH-05 | [[SPEC-SCHEMA-0003]]/SK1 |
| RB-SCH-06 | SC3, G4 |
| RB-SCH-07 | D4, D5 |
| RB-ENF-01 | [[ARCH-0005]]/P7 |
| RB-ENF-02 | [[FW-TF-0001]] §4.5 (ÖNERİ süreler) |
| RB-ENF-03 | [[PM-GTM-0001]]/GT6; Charter §5 |
| RB-ENF-04 | BT9 |
| RB-ENF-05 | Bu belge §0 |


# CHANGELOG

- **0.1.0 (2026-10-01)** — İlk sürüm; eklerdeki kaynak sütunları ve metin içi atıflar bu eke toplandı.

# Durum

**Active** — Tamga ARF 0.7 ile yayınlandı.
