---
document_id: FW-REF-0001
title: "Əlavə E — Mənbələr"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-20
summary: >
  Tamga ARF-in əsaslandığı standartlar və normativ aktlar, Tamga qərar qeydləri və spesifikasiyaları, eləcə də əlavələrdəki hər məcburi qaydanın mənbəyi.
translation_of: FW-REF-0001
source_version: "1.0.0"
---

# 1. Standartlar və normativ aktlar

| Mənbə | Ünvan |
|---|---|
| Regulation (EU) 2024/1183 (eIDAS 2.0) | <https://eur-lex.europa.eu/eli/reg/2024/1183/oj> |
| EUDI Wallet Architecture and Reference Framework (ARF) | <https://eu-digital-identity-wallet.github.io/eudi-doc-architecture-and-reference-framework/> |
| EUDI attestation rulebook kataloqu — Attestation Rulebook şablonu (1.5), PID Rulebook, mDL Rulebook | <https://github.com/eu-digital-identity-wallet/eudi-doc-attestation-rulebooks-catalog> |
| Commission Implementing Regulation (EU) 2026/1731 (PID və EAA kodlaşdırılması) | <https://eur-lex.europa.eu/> |
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

# 2. Tamga qərar qeydləri və spesifikasiyaları

Texniki təfərrüatlar və qərarların əsaslandırılması tərtibatçı sənədlərindədir (docs.tamga.network). Bu çərçivədəki qaydalar aşağıdakı
sənədlərdən toplanmışdır.

| Sahə | Sənədlər |
|---|---|
| Etibar modeli və idarəetmə | [[ADR-0009]] · [[ADR-0010]] · [[ADR-0035]] · [[ADR-0036]] · [[ADR-0037]] · [[ADR-0050]] · [[SPEC-TRUST-0001]] · [[SPEC-ID-0002]] · [[PM-GOV-0001]] · [[PM-ASSUR-0001]] |
| Qeydiyyat | [[ADR-0024]] · [[ADR-0026]] · [[ADR-0034]] |
| Rəqəmsal sənəd formatları və növləri | [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] · [[ADR-0013]] · [[ADR-0048]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] |
| Rəqəmsal sənədin verilməsi | [[SPEC-PROTO-0001]] · [[ADR-0016]] · [[ADR-0020]] · [[ADR-0021]] · [[ADR-0023]] · [[ADR-0046]] |
| Təqdimetmə və yoxlama | [[SPEC-PROTO-0002]] · [[SPEC-API-0001]] · [[ADR-0012]] · [[ADR-0017]] · [[ADR-0032]] · [[ADR-0044]] |
| Rəqəmsal cüzdan | [[SPEC-WALLET-0001]] · [[ADR-0025]] · [[ADR-0027]] · [[ADR-0031]] · [[ADR-0047]] · [[ADR-0049]] |
| Şəxsiyyət | [[SPEC-ID-0003]] · [[ADR-0011]] · [[ADR-0022]] · [[ADR-0033]] · [[ADR-0039]] · [[ADR-0045]] |
| Adlar | [[ADR-0030]] |

# 3. Qaydaların mənbələri

Əlavələrdəki hər məcburi qayda bir qərardan və ya kodlaşdırılmış invariantdan törədilmişdir. Aşağıdakı cədvəllər qaydanı mənbəyi ilə
əlaqələndirir (`BELGE/KOD` formatı). "Layihə rəhbərliyinin qərarı" şəbəkənin müvəqqəti operatorunun yazılı qərarıdır. Qaydanın mətni ilə mənbə
bir-birinə zidd olarsa, mənbə üstünlük təşkil edir.

## Əlavə A — Trust Framework

| Qayda | Mənbə |
|---|---|
| G-A | layihə rəhbərliyinin qərarı |
| G-B | [[PM-GOV-0001]]/G6, G8 |

## Əlavə B — Tamga Rulebook

| Qayda | Mənbə |
|---|---|
| RB-GEN-01 | [[SPEC-BC-0001]]/DP1, [[PM-TRUST-0001]] |
| RB-GEN-02 | [[ADR-0015]]/TS1, [[ARCH-0003]]/CMP1 |
| RB-GEN-03 | [[ARCH-0003]]/CMP4 |
| RB-GEN-04 | [[ARCH-0003]]/CMP2, [[ARCH-0005]]/P6 |
| RB-GEN-05 | [[PM-GOV-0001]]/G2 |
| RB-GEN-06 | [[SPEC-API-0001]]/AP3, AP4; [[ARCH-0004]]/O4 |
| RB-GEN-07 | [[ARCH-0005]]/P1–P3 |
| RB-GEN-08 | [[PM-ASSUR-0001]] |
| RB-GEN-09 | [[FW-TF-0001]] §4.6, §5.2 |
| RB-GEN-10 | [[ADR-0009]] K3, K6; [[PM-GOV-0001]]/G7 |
| RB-OP-01 | [[ADR-0009]] K5 |
| RB-OP-02 | ETSI TS 119 612 §5.3.12 |
| RB-OP-03 | [[ADR-0009]] K2 |
| RB-OP-04 | [[ADR-0009]] K2 |
| RB-OP-05 | ETSI TS 119 612 Annex A.2 |
| RB-OP-06 | [[ADR-0009]] K2 |
| RB-OP-07 | [[ADR-0009]] K2 |
| RB-OP-08 | [[PM-GOV-0001]]/G1 |
| RB-OP-09 | [[PM-GOV-0001]]/G3, [[ADR-0017]] |
| RB-OP-10 | [[PM-GOV-0001]]/G6 |
| RB-OP-11 | [[PM-GOV-0001]]/G4 |
| RB-OP-12 | [[PM-GOV-0001]]/G8 |
| RB-OP-13 | [[PM-GOV-0001]]/G5 |
| RB-OP-14 | [[ADR-0009]] K5 |
| RB-OP-15 | [[ADR-0009]] K4, K7 |
| RB-OP-16 | [[SPEC-SCHEMA-0001]]/D1, D8 |
| RB-OP-17 | [[ADR-0017]] HV1–HV5 |
| RB-OP-18 | [[ADR-0016]] HA1–HA3 |
| RB-REG-01 | layihə rəhbərliyinin qərarı |
| RB-REG-02 | [[SPEC-BC-0001]]/N1 |
| RB-REG-03 | [[SPEC-BC-0001]]/CA3 |
| RB-REG-04 | [[SPEC-BC-0001]]/I1, I3 |
| RB-REG-05 | [[ADR-0010]] K5 |
| RB-REG-06 | [[SPEC-ID-0002]]/XC2, [[SPEC-BC-0001]]/CA1 |
| RB-REG-07 | [[SPEC-BC-0001]]/GV1, I4 |
| RB-REG-08 | [[SPEC-API-0001]]/AP6 |
| RB-REG-09 | [[FW-TF-0001]] §5.2 |
| RB-AP-01 | [[SPEC-ID-0002]]/XC1, [[SPEC-CRED-0002]]/C15 |
| RB-AP-02 | [[PM-GOV-0001]]/G1, [[ARCH-0004]]/O3, [[ADR-0057]]/RS1–RS3 |
| RB-AP-03 | [[ARCH-0003]]/K1, [[SPEC-CRED-0003]]/S11 |
| RB-AP-04 | [[SPEC-PROTO-0001]]/PR5, [[SPEC-CRED-0002]]/C1 |
| RB-AP-05 | [[SPEC-PROTO-0001]]/PR2 |
| RB-AP-06 | [[SPEC-PROTO-0001]]/PR1 |
| RB-AP-07 | [[SPEC-PROTO-0001]]/PR3 |
| RB-AP-08 | [[SPEC-PROTO-0001]]/PR4, PR9 |
| RB-AP-09 | [[SPEC-PROTO-0001]]/PR6, PR10 |
| RB-AP-10 | ETSI TS 119 471 REQ-EAASP-4.2.1.2; [[ADR-0025]] |
| RB-AP-11 | [[SPEC-PROTO-0001]]/PR7, [[SPEC-ID-0003]], ETSI TS 119 472-3 GEN-REQ-4.1 |
| RB-AP-12 | ETSI TS 119 471 REQ-EAASP-4.2.1.1 |
| RB-AP-13 | [[SPEC-SCHEMA-0002]]/E11, [[ARCH-0003]]/CMP5 |
| RB-AP-14 | [[ADR-0010]] K5, [[SPEC-PROTO-0001]]/PR7 |
| RB-AP-15 | layihə rəhbərliyinin qərarı |
| RB-AP-16 | [[SPEC-PROTO-0001]]/PR8, [[SPEC-API-0001]]/AP10 |
| RB-AP-17 | [[SPEC-CRED-0003]]/S5, S6 |
| RB-AP-18 | [[SPEC-CRED-0003]]/S2, S3, S7–S10; [[ADR-0048]] SU1 |
| RB-AP-19 | [[SPEC-CRED-0003]]/S1, S4 |
| RB-AP-20 | [[SPEC-BC-0001]]/R2, I4 |
| RB-AP-21 | layihə rəhbərliyinin qərarı |
| RB-AP-22 | [[ARCH-0004]]/O6 |
| RB-AP-23 | [[SPEC-ID-0003]] §5 |
| RB-AP-24 | [[SPEC-ID-0003]], [[SPEC-PROTO-0001]]/PR7 |
| RB-AP-25 | [[ADR-0016]] |
| RB-AP-26 | [[ADR-0046]] EP1, EP4 |
| RB-AP-27 | [[ADR-0047]] K1, K2, WR1, WR2; Aİ ARF VCR_05, WURevocation_19 |
| RB-AP-28 | [[ADR-0048]] K2, K3, SU2, SU3 |
| RB-AP-ID-01 | [[SPEC-ID-0003]]/IDP3 |
| RB-AP-ID-02 | [[SPEC-ID-0003]]/IDP11, KVKK m.10 |
| RB-AP-ID-03 | [[SPEC-ID-0003]]/IDP9 |
| RB-AP-ID-04 | [[SPEC-ID-0003]] §9, IDP10 |
| RB-AP-ID-05 | [[ADR-0011]] K6 |
| RB-AP-ID-06 | [[SPEC-TRUST-0001]]/TL8 |
| RB-AP-ID-07 | [[ADR-0031]] PS2, PS3 |
| RB-AP-ID-08 | [[ADR-0039]] DL1, DL2 |
| RB-AP-ID-09 | [[ADR-0039]] DL3, DL5 |
| RB-AP-ID-10 | [[ADR-0039]] DL4, DL5 |
| RB-AP-ID-11 | [[ADR-0044]] ZC1–ZC3 |
| RB-AP-ID-12 | [[ADR-0047]] K1, WR1; Aİ ARF WURevocation_18 |
| RB-AP-ID-13 | [[ADR-0048]] K1, SU1; İcra Reqlamenti (Aİ) 2024/2979 Əlavə II |
| RB-AS-01 | [[FW-TF-0001]] §5.1 |
| RB-AS-02 | [[SPEC-SCHEMA-0002]]/E11 |
| RB-AS-03 | [[SPEC-SCHEMA-0002]]/E1, [[SPEC-SCHEMA-0003]]/SK6 |
| RB-AS-04 | layihə rəhbərliyinin qərarı |
| RB-WP-01 | [[SPEC-WALLET-0001]]/WL1, WL3 |
| RB-WP-02 | [[SPEC-CRED-0001]] §4, [[ADR-0025]] |
| RB-WP-03 | [[SPEC-WALLET-0001]]/WL11 |
| RB-WP-04 | [[SPEC-WALLET-0001]]/WL8, [[SPEC-PROTO-0002]] |
| RB-WP-05 | [[SPEC-WALLET-0001]]/WL5, WL6 |
| RB-WP-06 | [[SPEC-WALLET-0001]]/WL4, [[ADR-0027]], [[SPEC-PROTO-0002]]/PV8 |
| RB-WP-07 | [[SPEC-WALLET-0001]]/WL2, WL10 |
| RB-WP-08 | [[SPEC-WALLET-0001]]/WL7, WL9, [[ARCH-0003]]/CMP8 |
| RB-WP-09 | [[SPEC-PROTO-0002]]/PV1–PV4 |
| RB-WP-10 | [[ADR-0049]] |
| RB-WP-11 | [[FW-TF-0001]] §4.6 |
| RB-WP-12 | [[SPEC-CRED-0003]]/S14 |
| RB-WP-13 | [[ADR-0017]] HV6; [[SPEC-WALLET-0001]]/WL5 |
| RB-WP-14 | [[ADR-0046]] EP2, EP3 |
| RB-WP-15 | [[ADR-0047]] K3, WR3; Aİ ARF WURevocation_10, WIAM_06 |
| RB-WP-16 | [[ADR-0047]] K4, WR4; Aİ ARF WURevocation_14, WURevocation_16 |
| RB-WP-17 | [[ADR-0047]] K5, WR5; Aİ ARF WIAM_04, WIAM_08 |
| RB-WP-18 | [[ADR-0049]] K1–K3, LI1–LI3 |
| RB-WP-19 | [[ADR-0026]] K5 (2026-10-13 dəyişikliyi); [[ADR-0056]] K10; İcra Reqlamenti (Aİ) 2026/1731 |
| RB-RP-01 | [[SPEC-API-0001]]/AP6, [[SPEC-PROTO-0002]] |
| RB-RP-02 | [[SPEC-PROTO-0002]]/PV1, PV3, PV6, PV9, PV10 |
| RB-RP-03 | [[SPEC-API-0001]]/AP8, AP11 |
| RB-RP-04 | [[SPEC-API-0001]]/AP12, [[SPEC-CRED-0002]]/C15 |
| RB-RP-05 | [[SPEC-API-0001]]/AP2, [[ARCH-0005]]/P5 |
| RB-RP-06 | [[SPEC-CRED-0003]]/S12, S13 |
| RB-RP-07 | [[PM-GOV-0001]]/G3 |
| RB-RP-08 | [[SPEC-API-0001]]/AP3, AP4, AP5, AP9 |
| RB-RP-09 | [[FW-TF-0001]] §5.3 |
| RB-RP-10 | [[SPEC-PROTO-0002]]/PV5, [[SPEC-CRED-0003]]/S14 |
| RB-RP-11 | layihə rəhbərliyinin qərarı |
| RB-RP-12 | [[ADR-0017]] HV1, HV4 |
| RB-RP-13 | [[ADR-0031]] PS4, PS5; [[SPEC-API-0001]] |
| RB-RP-14 | [[ADR-0026]] K4 (2026-10-13 dəyişikliyi); ETSI TS 119 472-2 RO-13…RO-16 (İcra Reqlamenti (Aİ) 2026/1731) |
| RB-RP-ID-01 | [[SPEC-PROTO-0001]]/PR14 |
| RB-H-01 | layihə rəhbərliyinin qərarı |
| RB-H-02 | [[SPEC-WALLET-0001]]/WL8 |
| RB-H-03 | [[SPEC-WALLET-0001]]/WL4, [[ADR-0027]] |
| RB-H-04 | [[SPEC-WALLET-0001]]/WL1–WL2 |
| RB-H-05 | RB-AP-15 |
| RB-H-06 | [[SPEC-ID-0002]]/XC4, [[SPEC-WALLET-0001]]/WL5 |
| RB-H-07 | layihə rəhbərliyinin qərarı |
| RB-SCH-01 | [[ADR-0010]] |
| RB-SCH-02 | [[SPEC-SCHEMA-0001]]/D1, D2 |
| RB-SCH-03 | [[SPEC-SCHEMA-0001]]/D6, D7, [[SPEC-SCHEMA-0002]]/E6 |
| RB-SCH-04 | [[SPEC-SCHEMA-0002]]/E10, [[SPEC-SCHEMA-0003]]/SK6 |
| RB-SCH-05 | [[SPEC-SCHEMA-0003]]/SK1 |
| RB-SCH-06 | [[SPEC-BC-0001]]/SC3, [[PM-GOV-0001]]/G4 |
| RB-SCH-07 | [[SPEC-SCHEMA-0001]]/D4, D5 |
| RB-ENF-01 | [[ARCH-0005]]/P7 |
| RB-ENF-02 | [[FW-TF-0001]] §4.5 |
| RB-ENF-03 | layihə rəhbərliyinin qərarı |
| RB-ENF-04 | layihə rəhbərliyinin qərarı |
| RB-ENF-05 | [[FW-RB-0001]] §0 |

## Əlavə C və siyasətlər

Rəqəmsal sənəd növlərinin rulebook-ları ([[FW-RB-0002]]…[[FW-RB-0005]]), Ləğv Siyasəti ([[FW-POL-0001]]) və Rəqəmsal Cüzdan Sübutu Siyasəti
([[FW-POL-0002]]) yeni qayda müəyyən etmir; hər qaydanın mənbəyi öz sətrində göstərilib (Əlavə B qaydası, qərar qeydi və ya spesifikasiya).

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
