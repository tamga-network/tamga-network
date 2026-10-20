---
document_id: ADR-0004
title: "Qurum şəxsiyyəti: X.509"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-02
summary: >
  Qurum/entity şəxsiyyətinin identifikasiyası did:tamga entity profili əvəzinə X.509 sertifikatları ilə həyata keçirilir. Etibar zənciri milli kök orqanlarına (kök sertifikat) əsaslanır; qurumun zəncirdəki şəxsiyyəti issuerId = keccak256(stateCode, certFingerprint) ilə lövbərlənir. Vətəndaşa qlobal identifikator VERİLMİR — fərdi münasibətlər pairwise psevdonim ilə qurulur (SPEC-ID-0001 psevdonim profili qorunur). Zəncir hesabları hər halda EVM ünvanıdır (dəyişmir). Qərarın əsaslandırılması: qurum tərəfi artıq sertifikatlıdır və tənzimləyici üçün oxunaqlıdır; ödəniş/audit ssenarilərində qanunvericilikdə qarşılığı var. did:tamga entity profili SUPERSEDED; psevdonim profili + dəyər qatı (ADR-0003) bu qərardan təsirlənmir. Tam X.509 metod spesifikasiyası → SPEC-ID-0002 (planlaşdırılır).
domain: Trust
translation_of: ADR-0004
source_version: "1.0.0"
---

# ADR-0004 — Qurum şəxsiyyəti: X.509

**Status:** Accepted
**Tarix:** 2026-08-06
**Qərarı verən:** Tamga Network layihə rəhbərliyi
**Mənbə:** `docs/tamga-network-cuzdan-odeme-agent.md` (X.509 giriş layihəsi;
[[PM-AUTH-0001]]-də X.509 lehinə arqument kimi qiymətləndirilib). Bu ADR [[DECISIONS]]
D-ID-1-i bağlayır.

---

# Kontekst

SPEC-ID-0001 şəxsiyyətin identifikasiyasını iki profillə qurmuşdu: **Entity**
(`did:tamga:<state>:<id>`, zəncirdə qeydiyyatlı qurum şəxsiyyəti) və **[[t:pseudonym]]**
(`did:tamga:p:<key>`, self-certifying, pairwise). [[DECISIONS]] D-ID-1 entity
tərəfinin **X.509 sertifikatlarına** keçirilib-keçirilməyəcəyini ən prioritet açıq qərar
kimi izləyirdi. Layihə rəhbərliyinin işçi sənədləri X.509-u müdafiə etdi; qərar verildi.

---

# Qərar

**Qurum/entity şəxsiyyəti = X.509 sertifikatı. did:tamga entity profili SUPERSEDED.**

Üç qat ([[PM-AUTH-0001]] §Üç qat) belə dəqiqləşir:

| Qat | İdentifikator (yeni) | Dəyişibmi? |
|---|---|---|
| **A. Zəncir hesabı** | EVM ünvanı (secp256k1) | Xeyr — Besu EVM, həmişə belə idi |
| **B. Qurum şəxsiyyəti** | **X.509 sertifikatı** + zəncirdə `issuerId = keccak256(stateCode, certFingerprint)` | **Bəli** — did:tamga entity əvəzinə |
| **C. Fərdi şəxsiyyət** | Rəqəmsal sənəd (SD-JWT VC) + **münasibətə xas psevdonim** | Xeyr — psevdonim profili qorunur |

**Prinsiplər:**

1. **Etibar zənciri milli kök orqanlarına əsaslanır.** Hər üzv dövlətin [[t:root-ca|kök sertifikatı]]
   zəncirə lövbərlənir ([[t:trust-anchor]]); qurumun sertifikatı bu kökə qədər yoxlana bilər. `issuerId`
   qurumun sertifikat fingerprint-inə + dövlət koduna bağlanır ([[SPEC-BC-0001]]
   Issuer Registry, `onlyOwnerState`: qurumu yalnız öz dövləti qeydiyyata alır).

2. **Vətəndaşa qlobal identifikator verilmir.** Sabit qlobal ID şəxsin
   səhiyyə/təhsil/logistika/ödəniş əməliyyatlarını bir sapa düzərdi. Fərdi münasibətlər
   **münasibətə xas psevdonim (pairwise pseudonym)** ilə qurulur — hər münasibətdə fərqli, bir-biri ilə əlaqələndirilə bilməz
   (SPEC-ID-0001 psevdonim profili + [[PM-ID-0002]] accountable disclosure).

3. **Zəncir əməliyyatları EVM ünvanıdır** — şəxsiyyət [[t:credential|sənədindən]] ayrıdır ([[ADR-0003]]
   açar sahəsi ayrımı). X.509 qərarı A qatına təsir etmir.

---

# Əsaslandırma

1. **Qurum tərəfi artıq sertifikatlıdır.** Ödəniş/korporativ axında qarşı tərəf adətən
   qurumdur (bank, gömrük brokeri, liman, sığorta) — onların hamısının artıq X.509
   sertifikatları və tənzimləyici qeydiyyatları var. Lisenziyalı qurumun yoxlanılması X.509
   dünyasında mövcud infrastrukturla həll olunur; DID dünyasında isə sıfırdan tanınma rejimi tələb olunur.

2. **Tənzimləyici üçün oxunaqlılıq.** "Şəxsiyyət kvalifikasiyalı sertifikatla yoxlanıldı" cümləsinin
   qanunvericilikdə qarşılığı var; "DID ilə yoxlanıldı" cümləsinin yoxdur. Ödənişdə audit yükü
   şəxsiyyətdən ağır olduğu üçün bu üstünlük dəyərlidir ([[PM-AUTH-0001]]).

3. **[[t:eIDAS]]/[[t:QSCD]] uyğunluğu.** Kvalifikasiyalı sertifikat/QSCD artıq X.509 əsaslıdır; "uyğun, lakin
   müstəqil" prinsipi ilə ([[PM-PH-0001]]) uzlaşır.

4. **Dəyər qatına təsirsizdir.** X.509 A qatına (EVM) təsir etmədiyi üçün ödəniş/agent
   imkanlarından heç nəyi azaltmır ([[ADR-0003]] qüvvəsini saxlayır).

---

# Nəticələr

**Dəyişən:**
- `did:tamga:<state>:<id>` entity profili **istifadə olunmur**; qurum şəxsiyyəti X.509 +
  `issuerId` fingerprint ilə.
- [[SPEC-BC-0002]] guardian `entityId` və **court-token imza zənciri** X.509-a bağlanır
  (məhkəmə/guardian imzaları sertifikat zənciri ilə yoxlanılır). §7 "x509 izlənəcək"
  bəndi **bağlandı**.
- SPEC-ID-0001 entity bölməsi superseded; **SPEC-ID-0002 (X.509 metod spesifikasiyası,
  planlaşdırılır)** yazılacaq: kök sertifikatın lövbərlənməsi, sertifikat→issuerId uyğunlaşdırılması, kökün yenilənməsi
  (rollover), zəncirin yoxlanılması.

**Dəyişməyən:**
- Psevdonim profili (SPEC-ID-0001), accountable disclosure ([[SPEC-BC-0002]] escrow),
  EVM hesab modeli, dəyər qatı qarmaqları ([[ADR-0003]]), idarəetmə ([[ADR-0002]]).

**Yeni açıq məsələlər:** Milli kök sertifikatlarının zəncirə lövbərlənməsi + kökün yenilənməsi
(rollover) mexanizmi → SPEC-ID-0002 / RS-X509 (planlaşdırılır). Qurumların mövcud `did:web`
şəxsiyyətləri ilə körpü lazımdırmı (interop) → SPEC-ID-0002.

---

# Əlaqələr

- SPEC-ID-0001 — entity profili superseded; psevdonim qorunur.
- [[SPEC-BC-0001]] — Issuer Registry (issuerId = certFingerprint, onlyOwnerState).
- [[SPEC-BC-0002]] — guardian entityId + court-token X.509 imza zəncirinə bağlanır.
- [[ADR-0002]] — dövlət namespace / onlyOwnerState (kök sertifikata sahiblik).
- [[ADR-0003]] — dəyər qatı (X.509-dan müstəqil, qorunur).
- [[PM-AUTH-0001]] — üç qat + tənzimləyici üçün oxunaqlılıq əsaslandırması.
- SPEC-ID-0002 (planlaşdırılır) — tam X.509 metod spesifikasiyası.

X.509 qərarı verildi (2026-08-06); D-ID-1 bağlandı.
Entity şəxsiyyəti X.509-a keçirildi; psevdonim və dəyər qatı qorunur. Tam metod
spesifikasiyası (SPEC-ID-0001 revizyası / SPEC-ID-0002) növbəti işdir.
