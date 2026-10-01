---
document_id: RS-EIDAS-0001
title: eIDAS 2.0 ve EUDI Wallet — Ekosistem, ARF ve Teknik Stack
category: Research
domain: Identity
status: Draft
review_status: Draft
version: 0.2.1
created: 2026-07-29
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: research
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - eidas
  - eudi-wallet
  - arf
  - verifiable-credentials
  - digital-identity
keywords:
  - eIDAS 2.0
  - EUDI Wallet
  - Architecture and Reference Framework
  - SD-JWT VC
  - ISO 18013-5 mdoc
  - OpenID4VCI
  - OpenID4VP
  - trusted lists
  - qualified electronic signature
related:
  - PM-TRUST-0001
  - PM-BC-0001
  - ADR-0002
  - ADR-0004
  - SPEC-ID-0002
  - PM-ASSUR-0001
references:
  - Regulation (EU) 2024/1183 (eIDAS 2.0)
  - EUDI Wallet ARF v3.0.0
  - ISO/IEC 18013-5
  - IETF SD-JWT VC
  - OpenID4VCI / OpenID4VP
  - ETSI TS 119 612 V2.4.1 (Trusted Lists)
  - ETSI TS 119 472-3 V1.1.1 (EAA/PID issuance profiles)
summary: >
  eIDAS 2.0 regülasyonunun ve EUDI Wallet ekosisteminin nasıl çalıştığını,
  ARF v3.0.0'ın tanımladığı rolleri, teknik stack'i (SD-JWT VC, mdoc,
  OpenID4VCI/VP), güven modelini, iptal (revocation) mekanizmasını,
  blockchain'in bu mimarideki (sınırlı) yerini ve Türkiye'nin durumunu
  analiz eder. v0.2.0 (2026-09): ETSI TS 119 612 (Trusted Lists) ve ETSI TS
  119 472-3 (EAA/PID ihraç profilleri) birincil metinlerinden derinleştirildi
  (§5.1, §4.4) ve Tamga kararlarıyla eşlendi. Tamga Network mimari kararları
  için temel araştırma girdisidir.
priority: Critical
---

# Giriş

Bu doküman harici bir sistemi analiz eder: **eIDAS 2.0 regülasyonu** ve onun getirdiği **EUDI Wallet (European Digital Identity Wallet)** ekosistemi.

Amaç Tamga Network'ün tasarımını yapmak değildir. Amaç, Tamga Network'ün üzerine kurulacağı standart ve regülasyon zeminini net biçimde anlamaktır. Tamga Network eğer bir dijital kimlik/güven altyapısı olacaksa, EUDI Wallet **hem rakip değil zemin, hem de en önemli uyum hedefidir.** Bu nedenle bu doküman keystone (temel taş) niteliğindedir; sonraki mimari ve karar dokümanları buna referans verecektir.

> **Kritik erken bulgu:** EUDI Wallet mimarisi (ARF) **blockchain'i zorunlu kılmaz** ve kişisel veriyi zincire yazmaz. Bu, Tamga'nın blockchain tasarımını doğrudan etkiler. Ayrıntı: [Bölüm 7](#7-blockchain-bu-mimarinin-neresinde).

---

# 1. eIDAS ve eIDAS 2.0 Nedir?

**eIDAS**, "electronic IDentification, Authentication and trust Services" kısaltmasıdır. AB'nin elektronik kimlik ve güven hizmetleri (elektronik imza, mühür, zaman damgası, sertifika) için ortak hukuki çerçevesidir.

- **eIDAS 1.0:** Regulation (EU) 910/2014. Elektronik imza ve güven hizmetlerini standardize etti, ama bir "cüzdan" kavramı yoktu.
- **eIDAS 2.0:** **Regulation (EU) 2024/1183** (Mayıs 2024 yürürlüğe girdi), 910/2014'ü değiştirir. En büyük yeniliği: **her AB üye devletinin vatandaşlarına en az bir EUDI Wallet sunma zorunluluğu.**

eIDAS 2.0'ın getirdiği temel kavram: kullanıcı kontrollü, taşınabilir, seçici açıklama yapabilen bir **dijital kimlik cüzdanı.**

---

# 2. EUDI Wallet Nedir? (Ekosistem ve Roller)

EUDI Wallet, kullanıcının kimlik verilerini ve doğrulanabilir belgelerini (attestation) sakladığı, kontrol ettiği ve seçici biçimde paylaştığı bir uygulamadır. Merkezî bir veritabanı değil, **kullanıcının elindeki (holder) bir cüzdandır.**

## Ekosistem Rolleri (ARF Bölüm 3)

| Rol | Görevi |
|-----|--------|
| **Wallet Unit** | Kullanıcının cüzdanı. Verileri tutar, sunar, imzalar. |
| **PID Provider** | Person Identification Data (temel kimlik) sağlayıcısı — genelde devlet. |
| **Attestation Provider (QEAA/EAA)** | Diploma, ehliyet, sağlık belgesi gibi doğrulanabilir belgeleri veren kurum. |
| **Relying Party (RP)** | Kimlik/belge doğrulaması isteyen taraf (banka, işveren, web sitesi). |
| **Trusted List Provider** | Hangi issuer/RP'lerin güvenilir olduğunu yayınlayan otorite. |

Temel akış:
```text
PID Provider / Attestation Provider  --(OpenID4VCI)-->  Wallet Unit
Wallet Unit  --(OpenID4VP, selective disclosure)-->  Relying Party
```

---

# 3. ARF — Architecture and Reference Framework

**ARF**, EUDI Wallet ekosisteminin bağlayıcı teknik referans dokümanıdır. Avrupa Komisyonu'nun eIDAS Expert Group'u tarafından GitHub üzerinde açık biçimde geliştirilir.

- **Güncel sürüm: v3.0.0 (23 Temmuz 2026).**
- Önceki önemli sürümler: v2.9.0 (Mayıs 2025), v2.8.0 (Şubat 2025), v2.4.0 (Temmuz 2024).
- v3.0.0 yenilikleri: Commission Implementing Regulation'larla hizalama, Functional Conformance Assessment Framework, relying party servisleri, **wallet-to-wallet etkileşim** ve trust-anchor retrieval gereksinimleri.

## ARF Bölüm Yapısı (11 ana bölüm)

1. Introduction
2. EUDI Wallet functionalities
3. Roles within the EUDI Wallet ecosystem
4. High-level architecture
5. Data model and data exchange protocols
6. Trust model
7. Wallet Solution Certification and Risk Management
8. Accessibility
9. Document development
10. References
11. Annexes

> **Çıkarım:** ARF sık güncellenen, yaşayan bir spec'tir. Tamga uyum iddiası taşıyacaksa hangi ARF sürümüne uyduğunu **versiyonlayarak** belirtmelidir.

---

# 4. Teknik Stack

ARF, cüzdanın "icat" edilmesini değil, belirli standartlara uymasını ister. Zorunlu teknik yapı taşları:

## Credential (Attestation) Formatları
- **ISO/IEC 18013-5 — mdoc / mDL** (mobile driving licence; mobil belge formatı).
- **SD-JWT VC** (Selective Disclosure JWT Verifiable Credential; IETF taslağı). Seçici açıklamayı sağlar.
- Tüm taraflar SD-JWT VC için **HAIP** (High Assurance Interoperability Profile) profilini desteklemek zorundadır.

## Protokoller
- **OpenID4VCI** (OpenID for Verifiable Credential Issuance): belge verme (issuance).
- **OpenID4VP** (OpenID for Verifiable Presentation): belge sunma (presentation).
- OAuth 2.0 altyapısı üzerine kurulu.

## Kriptografi (ARF baseline)
- **P-256 (secp256r1)** eğrisi — Wallet Instance Attestation için zorunlu.
- **ECDSA + SHA-256** — taban imza takımı.
- mdoc cihaz doğrulaması aynı eğriyi COSE_Sign1 yapısıyla kullanır.

> **Çıkarım:** Tamga'nın imza/credential katmanı bu formatları (SD-JWT VC, mdoc) ve eğrileri (P-256) desteklerse EUDI ile birlikte çalışabilir. Bu, [ileride PM/SPEC kararı] olacaktır.

## 4.4 İhraç profili — ETSI TS 119 472-3 (2026-09 derinleştirme)

> Kaynak: `ETSI TS 119 472-3 V1.1.1` (Mart 2026). Tam analiz + Tamga eşleme tablosu:
> operatörün standart analiz arşivi.

ETSI 119 472-3, EUDI Wallet'a **PID/EAA ihracının** kablo protokolünü tanımlar; temeli
**OpenID4VC-HAIP → OpenID4VCI**'dir. Tamga'nın ihraç katmanı ([[ADR-0006]] / D-CRED-1)
için birebir **conformance hedefidir**. Öne çıkanlar:

- **İki sertifika modeli:** *access certificate* (sağlayıcı endpoint kimliği, JWS `x5c`
  zinciri) + *registration certificate* (`issuer_info` → sağlayıcının **ne ihraç etmeye
  yetkili** olduğu; `providesAttestations`, `registryURI`). Bu, Tamga'nın **issuer↔şema
  allowlist** kararının (D-SCHEMA-2, [[ADR-0007]] K6) EUDI muadili.
- **WIA/WUA** (Wallet Instance/Unit Attestation) Wallet Provider imzalı; **"Trusted List
  of Wallet Providers"**a karşı doğrulanır. Tamga'da WUA zorunlu (D-CRED-1) ama
  **wallet-provider trust anchor'ı henüz tanımsız** → §10 açık soru.
- **Reuse policy** (`once_only`/`limited-time`/`rotating-batch`/`per-relying-party` +
  batch) = izlenemezliğin *credential seviyesindeki* çözümü; Tamga'nın pairwise pseudonym
  (identifier seviyesi, [[SPEC-ID-0001]] §7) çözümünü **tamamlar**.
- **X509-AC EAA (Annex A, `x509_attr`):** EUDI ekosisteminin kendi profili attestation'ları
  **X.509 Attribute Certificate** olarak ihraç etmeyi resmen tanımlar. → Tamga'nın X.509
  kurumsal kimlik kararının ([[ADR-0004]]) **dış meşruiyeti**: X.509 seçimi DID dünyasından
  kopuş değil, EUDI'nin de desteklediği bir formattır.

> **Sürüm notu:** 119 472-3 (Mart 2026), ARF **v2.4.0**'a atıf yapar; bu doküman ARF
> **v3.0.0** referans alır. Profil sabitlenirken sürüm uyumu izlenmeli (§10).

---

# 5. Güven Modeli (Trust Model)

EUDI güven modeli **blockchain'e değil, eIDAS Trusted List'lerine** dayanır.

- Temel: **Implementing Decision (EU) 2015/1505**, Article 22a ile genişletilmiş.
- **Trusted List:** her üye devletin yayınladığı, güvenilir güven hizmeti sağlayıcılarının (issuer, QTSP vb.) imzalı listesi.
- **Trust Anchor:** doğrulamada kök güven noktası (genelde devlet/QTSP sertifikaları).
- **Registration Certificate:** RP'lerin ne tür veri isteyebileceğini kayıt altına alan sertifika.

Yani "kim güvenilir?" sorusunun cevabı, imzalı ve otorite tarafından yayınlanan **listelerle** verilir — merkezî ama federatif (her ülke kendi listesini yönetir).

## 5.1 Trusted List mekaniği — ETSI TS 119 612 (2026-09 derinleştirme)

> Kaynak: `ETSI TS 119 612 V2.4.1` (Ağu 2025). Tam analiz + 17 satırlık Tamga eşleme
> tablosu: operatörün standart analiz arşivi. Bu standart, yukarıda
> özetlenen güven modelinin **tam teknik metnidir**.

**Trusted List (TL)** = dijital imzalı (XAdES), makine-okunur (XML) bir liste; bir
**Scheme Operator (TLSO)** yayımlar ve hangi **Trust Service Provider'ların (TSP)** hangi
hizmetlerinin onaylı olduğunu, **güncel statüsünü ve statü geçmişini** bildirir. Altı
bileşen: Tag · Scheme info · TSP info · **Service info (tip + dijital kimlik + statü)** ·
Service history · Digital signature.

> **🔑 En kritik bulgu (Giriş + §1 Scope):** Standart, **AB-dışı ülke ve uluslararası
> kuruluşların** kendi TL'lerini bu formatta yayımlamasını **açıkça destekler** — amaç
> karşılıklı tanıma (mutual recognition). Türkiye AB-dışı, Türk dünyası bir uluslararası
> gruplama; §5.1.5 çok-devletli ülke kodlarını (GCC/ASEAN örnekleri) destekler. Yani
> **Tamga doğrudan 119 612-uyumlu bir TLSO olabilir** ve AB LOTL ile çapraz tanınabilir.
> Kurumsal taraf için bu, did:web köprüsünden ([[SPEC-ID-0002]] §8) daha güçlü ve
> düzenleyici-okunabilir bir interop yoludur.

**Tamga kararlarıyla yapısal hizalama** (standart, tasarımımıza hazır kelime dağarcığı verir):

| ETSI 119 612 | Tamga karşılığı |
|---|---|
| `NationalRootCA-QC` service type | Ulusal Root CA çıpalama ([[SPEC-ID-0002]] §1, XC1) — **birebir tip mevcut** |
| Service digital identity = public key/cert; Root key → tüm hiyerarşi statüsü birlikte (§5.5.3 NOTE 5) | `certFingerprint` + Root `REVOKED` → alt sertifikalar düşer ([[SPEC-ID-0002]] §2/§4) |
| Service status: granted/withdrawn, recognised/deprecated-at-national-level | RootStatus/IssuerStatus ACTIVE/RETIRED/REVOKED — **1:1 eşlenebilir sözlük** |
| Status history **asla silinmez** (§5.3.12) | Yumuşak iptal, `deactivated:true` (silme değil), D-BC-4 |
| **TakenOverBy** extension (§5.5.9.3) | `successorId` / halef issuer (D-BC-5, XC2) — **birebir** |
| Pointers to other TSLs / LOTL / `TLIssuer` | Cross-recognition / tek-taraflı tanıma ([[ADR-0002]]) |
| ≥2 kaydırmalı imza sertifikası (Annex A.2) | Rollover örtüşme dönemi ([[SPEC-ID-0002]] §4) |
| Periyodik yeniden yayın + anti-rollback (§6, ≤6 ay) | Status list "sabit aralıklı, gürültülü yayın" ([[ADR-0008]]) |
| Trust anchor management (Annex I) | Verifier + assurance politika motoru ([[PM-ASSUR-0001]]) |

> **🔵 Tamga'nın konumlanması netleşiyor:** ETSI TL'i off-chain imzalar ve **digest'ini
> Resmi Gazete'ye (OJEU)** koyar; Tamga aynı trust-list state'ini **zincire (RootCARegistry)**
> çıpalar. Yani Tamga = "eIDAS Trusted List modeli + Resmi Gazete digest'i yerine blockchain
> trust anchor". Bu, Bölüm 7'deki "blockchain = trust anchor yayını" tezinin doğrudan
> kanıtıdır ve whitepaper için savunulabilir, temiz bir konumlandırmadır.

---

# 6. İptal ve Durum Yönetimi (Revocation / Status)

Bir belgenin geçerliliğini yitirmesi (iptal) mahremiyet açısından en hassas konudur.

- ARF mekanizması: **Attestation Status List (ASL)** — her belgenin durumunu bir bit/byte ile temsil eden, **mahremiyet korumalı bir bit dizisi (bitstring).**
- **İptal on-chain DEĞİLDİR** ve kullanıcı kontrolünde kalır.
- **Linking (izlenebilirlik) tehdidi:** Eğer hem issuer hem RP iptal durumuna erişebilirse, zaman damgaları/indeksler üzerinden işbirliğiyle kullanıcıyı farklı işlemlerde izleyebilirler. Bu, akademik ve düzenleyici olarak aktif tartışma alanıdır (ör. cascaded Bloom filter ile randomize edilmiş, unlinkable iptal listeleri önerileri).

> **Çıkarım:** İptal mekanizması tasarlarken mahremiyet (unlinkability) birinci sınıf gereksinimdir. Naif "on-chain iptal listesi" gizli bir izleme aracına dönüşebilir.

---

# 7. Blockchain Bu Mimarinin Neresinde?

Bu, Tamga için en kritik bölümdür.

## Bulgu: ARF blockchain'i zorunlu KILMAZ
- EUDI güven modeli Trusted List'lere dayanır, blockchain'e değil.
- İptal, status list ile yapılır, on-chain değil.
- Kişisel veri (PID, attestation) **cüzdanda, kullanıcının elinde** tutulur; hiçbir merkezî veritabanına veya deftere yazılmaz.

## Neden? — GDPR Gerilimi
- GDPR **silinme hakkı (right to erasure)** verir. Blockchain **değiştirilemez (immutable)** olduğu için silmeye izin vermez → doğrudan çatışma.
- Bu yüzden kişisel veri — ve çoğu zaman **korelasyon kurulabilen hash'i bile** — değiştirilemez bir deftere yazılmamalıdır.
- İspanya Veri Koruma Otoritesi (AEPD) dahil düzenleyiciler ve topluluk, ARF'in GDPR açısından hâlâ boşlukları olduğunu belirtir; linking/izlenebilirlik en çok tartışılan konudur.

## Blockchain'in MEŞRU yeri
Blockchain, EUDI-uyumlu bir sistemde şu **kişisel olmayan güven verisi** için kullanılabilir (ve akademik olarak araştırılmaktadır):
- Trust registry / trusted list yayını ve bütünlüğü
- Issuer public anahtarlarının / trust anchor'ların çapalanması (anchoring)
- Şema (schema) kayıtları
- **Mahremiyet korumalı** iptal/durum kayıtları (unlinkable tasarımla)
- Yönetişim (governance) kayıtları — kim node/validator, kim issuer yetkisi aldı

> **Tamga için doğrudan çıkarım:** "Blockchain müşteri görmez, sadece trust katmanını sağlar" tezi doğrudur. Ancak trust katmanı = **kayıt defteri (registry/anchor)**, credential deposu değildir. Kişisel veri ve bireysel credential asla zincire gitmez. Bu ilke [[PM-TRUST-0001]] olarak kalıcı karara bağlanmalıdır.

---

# 8. Qualified Electronic Signature (QES) ve İmza

Kullanıcının şu anki odağı imzalama olduğundan bu bölüm önemli.

- eIDAS imza seviyeleri: **SES** (basit) → **AES** (gelişmiş) → **QES** (nitelikli). QES en yüksek seviyedir ve hukuken ıslak imzaya eşdeğerdir.
- eIDAS 2.0 ile **EUDI Wallet, kullanıcının nitelikli elektronik imza (QES) oluşturabilmesini** sağlar — mobil cihaz üzerinden.
- Teknik olarak imza, bir **QSCD** (Qualified Signature Creation Device) veya uzaktan (remote) QES hizmeti üzerinden üretilir; anahtarlar güvenli donanımda (Secure Element / HSM) tutulur.
- **Önemli:** İmza yeteneği blockchain'den bağımsızdır. Mevcut kripto standartları (P-256/ECDSA, RSA, COSE/JWS) ile prototiplenebilir. Blockchain beklemeyi gerektirmez.

> **Çıkarım:** Tamga'nın "imza" ürünü bir **QSCD/remote-QES** yaklaşımıyla, EUDI imza akışına (ve Türkiye'deki e-imza mevzuatına) uyumlu tasarlanabilir. Bu, en erken kod prototipi çıkarılabilecek Ray'dir.

---

# 9. Türkiye Durumu

- Türkiye AB üyesi **değildir**; dolayısıyla eIDAS 2.0 Türkiye'yi doğrudan bağlamaz.
- Türkiye'nin mevcut elektronik imza rejimi **5070 sayılı Elektronik İmza Kanunu**'na dayanır. Nitelikli sertifikaları TÜBİTAK **KamuSM**, TÜRKTRUST gibi QTSP'ler verir.
- Türkiye eIDAS 2.0'ın getirdiği güncel standartları **henüz benimsememiştir**, ancak elektronik imza/dijital kimlik sistemlerini uluslararası standartlara hizalama yönünde çalışmalar vardır.
- e-Devlet altyapısı güçlü bir devlet-kimlik zeminidir.

> **Stratejik çıkarım:** Tamga için fırsat penceresi, "Türkiye'de EUDI benzeri regülasyon çıkacak" öngörüsüdür. EUDI-uyumlu (SD-JWT VC, OpenID4VP, QES) bir mimari, regülasyon geldiğinde hazır olmayı sağlar. Bu öngörü [[PM-PH-0001]] (felsefe/vizyon) dokümanında gerekçelendirilmelidir.

---

# 10. Tamga İçin Açık Sorular (Karara Bağlanacak)

Bu araştırmadan doğan, Project Memory / ADR'de karara bağlanması gereken sorular:

1. **Kapsam:** Tamga tam EUDI-uyum mu hedefliyor, yoksa "EUDI-uyumlu ama bağımsız" bir Türkiye/global altyapı mı? → [[PM-PH-0001]]
2. **On-chain sınırı:** Zincire tam olarak ne yazılır? (Öneri: sadece trust registry/anchor, asla PII/credential.) → [[PM-TRUST-0001]]
3. **Blockchain seçimi:** Kendi izinli ağ mı, hazır çerçeve mi (Cosmos SDK/CometBFT, Besu QBFT)? → [[PM-BC-0001]]
4. **İmza modeli:** QSCD mi, remote-QES mi? Hangi seviye (AES/QES)? → ileride SPEC-SIGN.
5. **Format uyumu:** SD-JWT VC + mdoc zorunlu tutulacak mı? → ileride SPEC-CRED.

**ETSI derinleştirmesinden doğan yeni açık sorular (2026-09, §4.4 + §5.1):**

6. **119 612 XML export:** On-chain RootCARegistry/Issuer Registry state'inin ETSI-uyumlu
   Trusted List (XML/XAdES) projeksiyonu üretilecek mi? (AB LOTL ile çapraz tanıma; kurumsal
   tarafın did:web köprüsü muadili — kontrat değişikliği gerektirmez, `sdk/` çıktı katmanı.)
   → [[ADR-0002]] / [[SPEC-ID-0002]] senkron.
7. **Statü sözlüğü 1:1 tablosu:** Tamga RootStatus/IssuerStatus ↔ ETSI Svcstatus
   (granted/withdrawn/recognised/deprecated) resmi eşleme tablosu → [[SPEC-ID-0002]].
8. **Türk dünyası gruplama kodu:** §5.1.5 çok-devletli ülke kodu (GCC/ASEAN gibi) Tamga için
   tanımlanacak mı? → [[ADR-0002]] cross-recognition.
9. **Wallet Provider trust anchor:** WUA doğrulaması bir "Trusted List of Wallet Providers"
   gerektirir (119 472-3); Tamga'da WUA zorunlu ama bu trust anchor tanımsız → SPEC-CRED /
   [[PM-ASSUR-0001]].
10. **Reuse/batch ↔ pairwise pseudonym:** Credential-seviyesi izlenemezlik (batch, once_only,
    per-relying-party) ile identifier-seviyesi pairwise pseudonym ([[SPEC-ID-0001]] §7) nasıl
    birleşecek? → ileride SPEC-CRED.
11. **ARF sürüm uyumu:** 119 472-3 → ARF v2.4.0; bu doküman → v3.0.0. Profil sabitlenirken
    sürüm izlenmeli.

---

# 11. Referanslar

## Regülasyon ve Standart
- Regulation (EU) 2024/1183 — eIDAS 2.0
- Regulation (EU) 910/2014 — eIDAS 1.0
- Implementing Decision (EU) 2015/1505 — Trusted Lists
- **ETSI TS 119 612 V2.4.1 (2025-08) — Trusted Lists** (§5.1 kaynağı; yerel analiz:
  operatörün standart analiz arşivi)
- **ETSI TS 119 472-3 V1.1.1 (2026-03) — EAA/PID issuance profiles** (§4.4 kaynağı; yerel
  analiz: operatörün standart analiz arşivi)
- ETSI TS 119 471 / 119 472-1 / 119 472-2 (EAA policy + genel + sunum profilleri)
- ISO/IEC 18013-5 — mdoc / mDL
- IETF SD-JWT VC (draft)
- OpenID4VCI / OpenID4VP — OpenID Foundation; OpenID4VC-HAIP 1.0
- 5070 sayılı Elektronik İmza Kanunu (Türkiye)

## Web Kaynakları (2026-07-29 erişim)

> *Sürüm notu 0.2.1 (2026-10-01): taşınan AB/EBSI sayfalarının bağlantıları güncel resmî adreslerle değiştirildi; üçüncü taraf özet yerine ARF'nin kendi bölümü (anlam değişmedi).*

- ARF v3.0.0 — https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework
- ARF ana doküman — https://eudi.dev/latest/main/
- ARF sürüm duyurusu (AB EUDI Wallet ana sayfası) — https://ec.europa.eu/digital-building-blocks/sites/display/EUDIGITALIDENTITYWALLET/EU+Digital+Identity+Wallet+Home
- EUDI Wallet rehberi — https://walt.id/eidas2/eudi-wallet
- İptal ve durum (ARF §6.5.4.2 cüzdan birimi iptali, §6.6.6.4 PID/belge iptali) — https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/blob/main/docs/main/06-trust-model.md
- AEPD — eIDAS2, EUDI wallet ve GDPR serisi — https://www.aepd.es/en/press-and-communication/blog/eidas2-the-eudi-wallet-and-the-gdpr-i
- Türkiye e-imza / eIDAS değerlendirmesi — https://pekin.com.tr/2025/06/19/elektronik-imza-duzenlemeleri-ab-ve-turkiye-uygulamalarinin-degerlendirilmesi/

---

# İlgili Dokümanlar

- [[PM-PH-0001]] — Digital Trust Infrastructure felsefesi ve EUDI konumlandırması
- [[PM-TRUST-0001]] — On-chain / off-chain sınırı (GDPR)
- [[PM-BC-0001]] — Blockchain seçimi ve validator modeli
- [[ADR-0002]] — Egemenlik + cross-recognition (TL işaretçileri / AB-dışı TLSO yolu)
- [[ADR-0004]] / [[SPEC-ID-0002]] — X.509 kurumsal kimlik (X509-AC EAA ile meşru); RootCARegistry = TL çıpası
- [[PM-ASSUR-0001]] — Assurance + trusted list (trust anchor yönetimi)

---

# Durum

**review_status: Draft.** v0.1.0 ARF tabanlı ilk taslaktı. **v0.2.0 (2026-09-11):** ETSI
TS 119 612 (Trusted Lists) ve ETSI TS 119 472-3 (EAA/PID ihraç) birincil metinlerinden
derinleştirildi (§5.1 + §4.4) ve Tamga kararlarıyla (RootCARegistry, issuer registry,
cross-recognition, X.509, soft revocation, assurance) eşlendi. İki manşet: (1) AB-dışı
TLSO olarak karşılıklı tanıma yolu açık; (2) Tamga = "eIDAS Trusted List + blockchain trust
anchor" olarak konumlanıyor. Yeni açık sorular §10 (md. 6–11). Sonraki adım ARF v3.0.0'ın
§6 (Trust model) ve §5 (Data model) tam metninden derinleştirme. Açık sorular Project
Memory/SPEC kararlarına dönüştükçe doküman `Completed`'a taşınacaktır.
