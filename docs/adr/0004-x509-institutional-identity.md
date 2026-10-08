---
document_id: ADR-0004
title: "Kurum kimliği: X.509"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-02
summary: >
  Kurumsal/entity kimlik tanımlaması, did:tamga entity profili yerine X.509
  sertifikalarıyla yapılır. Güven zinciri ulusal kök otoritelere (kök sertifika) dayanır;
  kurumun zincirdeki kimliği issuerId = keccak256(stateCode, certFingerprint) ile
  çıpalanır. Vatandaşa küresel tanımlayıcı VERİLMEZ — kişisel ilişkiler pairwise
  takma ad ile kurulur (SPEC-ID-0001 takma ad profili korunur). Zincir hesapları
  her hâlükârda EVM adresidir (değişmez). Karar gerekçesi: kurumsal taraf zaten
  sertifikalı ve düzenleyici-okunabilir; ödeme/denetim senaryolarında mevzuat karşılığı
  var. did:tamga entity profili SUPERSEDED; takma ad profili + değer katmanı (ADR-0003)
  bu karardan etkilenmez. Tam X.509 metot spesifikasyonu → SPEC-ID-0002 (planlı).
domain: Trust
---

# ADR-0004 — Kurumsal Kimlik: X.509

**Durum:** Accepted
**Tarih:** 2026-08-06
**Karar veren:** Tamga Network proje yönetimi
**Kaynak:** `docs/tamga-network-cuzdan-odeme-agent.md` (X.509 girdi taslağı;
[[PM-AUTH-0001]]'de X.509 lehine argüman olarak değerlendirildi). Bu ADR, [[DECISIONS]]
D-ID-1'i kapatır.

---

# Bağlam

SPEC-ID-0001 kimlik tanımlamasını iki profille kurmuştu: **Entity**
(`did:tamga:<state>:<id>`, zincir-kayıtlı kurumsal kimlik) ve **[[t:pseudonym]]**
(`did:tamga:p:<key>`, self-certifying, pairwise). [[DECISIONS]] D-ID-1, entity
tarafının **X.509 sertifikalarına** taşınıp taşınmayacağını en öncelikli açık karar
olarak izliyordu. Proje yönetiminin çalışma dosyaları X.509'u savundu; karar verildi.

---

# Karar

**Kurumsal/entity kimlik = X.509 sertifikası. did:tamga entity profili SUPERSEDED.**

Üç katman ([[PM-AUTH-0001]] §Üç Katman) şöyle netleşir:

| Katman | Tanımlayıcı (yeni) | Değişti mi? |
|---|---|---|
| **A. Zincir hesabı** | EVM adresi (secp256k1) | Hayır — Besu EVM, her zaman öyleydi |
| **B. Kurumsal kimlik** | **X.509 sertifikası** + zincirde `issuerId = keccak256(stateCode, certFingerprint)` | **Evet** — did:tamga entity yerine |
| **C. Kişisel kimlik** | Belge (SD-JWT VC) + **ilişkiye özgü takma ad** | Hayır — takma ad profili korunur |

**İlkeler:**

1. **Güven zinciri ulusal kök otoritelere dayanır.** Her üye devletin [[t:root-ca|kök sertifikası]]
   zincire çıpalanır ([[t:trust-anchor]]); kurumun sertifikası bu köke kadar doğrulanabilir. `issuerId`
   kurumun sertifika fingerprint'ine + devlet koduna bağlanır ([[SPEC-BC-0001]]
   Issuer Registry, `onlyOwnerState`: kurumu yalnızca kendi devleti kaydeder).

2. **Vatandaşa küresel tanımlayıcı verilmez.** Sabit bir global ID, kişinin
   sağlık/eğitim/lojistik/ödeme işlemlerini tek ipe dizerdi. Kişisel ilişkiler
   **ilişkiye özgü takma ad (pairwise pseudonym)** ile kurulur — her ilişkide farklı, birbirine bağlanamaz
   (SPEC-ID-0001 takma ad profili + [[PM-ID-0002]] accountable disclosure).

3. **Zincir işlemleri EVM adresidir** — kimlik [[t:credential|belgesinden]] ayrı ([[ADR-0003]]
   anahtar-alanı ayrımı). X.509 kararı A katmanını etkilemez.

---

# Gerekçe

1. **Kurumsal taraf zaten sertifikalı.** Ödeme/kurumsal akışta karşı taraf genelde
   bir kurumdur (banka, gümrük müşaviri, liman, sigorta) — hepsinin zaten X.509
   sertifikaları ve düzenleyici kayıtları var. Lisanslı kurumu doğrulamak X.509
   dünyasında mevcut altyapıyla çözülür; DID dünyasında sıfırdan tanıma rejimi gerekir.

2. **Düzenleyici okunabilirlik.** "Kimlik nitelikli sertifikayla doğrulandı" cümlesinin
   mevzuatta karşılığı var; "DID ile doğrulandı" cümlesinin yok. Ödemede denetim yükü
   kimlikten ağır olduğu için bu avantaj değerli ([[PM-AUTH-0001]]).

3. **[[t:eIDAS]]/[[t:QSCD]] uyumu.** Nitelikli sertifika/QSCD zaten X.509 tabanlı; "uyumlu ama
   bağımsız" ilkesiyle ([[PM-PH-0001]]) hizalı.

4. **Değer katmanına etkisiz.** X.509, A katmanını (EVM) etkilemediğinden ödeme/agent
   kabiliyetinden hiçbir şey eksiltmez ([[ADR-0003]] geçerliliğini korur).

---

# Sonuçlar

**Değişen:**
- `did:tamga:<state>:<id>` entity profili **kullanılmaz**; kurum kimliği X.509 +
  `issuerId` fingerprint ile.
- [[SPEC-BC-0002]] guardian `entityId` ve **court-token imza zinciri** X.509'a bağlanır
  (mahkeme/guardian imzaları sertifika zinciriyle doğrulanır). §7 "x509 izlenecek"
  maddesi **kapandı**.
- SPEC-ID-0001 entity bölümü superseded; **SPEC-ID-0002 (X.509 metot spesifikasyonu,
  planlı)** yazılacak: kök sertifika çıpalama, sertifika→issuerId eşlemesi, kök yenileme
  (rollover), zincir doğrulama.

**Değişmeyen:**
- Takma ad profili (SPEC-ID-0001), accountable disclosure ([[SPEC-BC-0002]] escrow),
  EVM hesap modeli, değer katmanı kancaları ([[ADR-0003]]), yönetişim ([[ADR-0002]]).

**Yeni açık konular:** Ulusal kök sertifikaların zincire çıpalanması + kök yenileme
(rollover) mekanizması → SPEC-ID-0002 / RS-X509 (planlı). Kurumların mevcut `did:web`
kimlikleriyle köprü gerekli mi (interop) → SPEC-ID-0002.

---

# İlişkiler

- SPEC-ID-0001 — entity profili superseded; takma ad korunur.
- [[SPEC-BC-0001]] — Issuer Registry (issuerId = certFingerprint, onlyOwnerState).
- [[SPEC-BC-0002]] — guardian entityId + court-token X.509 imza zincirine bağlanır.
- [[ADR-0002]] — devlet namespace / onlyOwnerState (kök sertifika sahipliği).
- [[ADR-0003]] — değer katmanı (X.509'dan bağımsız, korunur).
- [[PM-AUTH-0001]] — üç katman + düzenleyici okunabilirlik gerekçesi.
- SPEC-ID-0002 (planlı) — tam X.509 metot spesifikasyonu.

X.509 kararı verildi (2026-08-06); D-ID-1 kapandı.
Entity kimlik X.509'a taşındı; takma ad ve değer katmanı korunur. Tam metot
spesifikasyonu (SPEC-ID-0001 revizyonu / SPEC-ID-0002) izleyen iş.
