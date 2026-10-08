---
document_id: SPEC-ID-0002
title: "Kurum kimliği (X.509)"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-02
summary: >
  [[ADR-0004]] X.509 kararının kod/protokol seviyesindeki karşılığı. Kurumsal/entity
  kimlik, ulusal Root CA'lara dayanan X.509 sertifikalarıyla kurulur; kurumun zincir
  kimliği issuerId = keccak256(stateCode, certFingerprint) ile çıpalanır. Doküman:
  güven zinciri (ulusal Root CA'ların zincire çıpalanması), sertifika hiyerarşisi,
  issuerId türetme, credential doğrulama algoritması (zincir + registry + iptal),
  Root CA yenileme (rollover), sertifika iptali (CRL/OCSP + on-chain), guardian/court-
  token X.509 bağlama, korunan pseudonym profili + multicodec, ve eIDAS/did:web köprüsü.
  did:tamga entity profili yerine geçer; pseudonym profili (SPEC-ID-0001) korunur.
---
**Bu şartname, [[t:issuer]] kurumların kimliğinin X.509 sertifikalarıyla nasıl kurulduğunu ve doğrulandığını anlatır.** Kurum entegrasyonu yapan ve [[t:verifier]] yazan geliştiriciler içindir.

**Ne zaman okunur**

- Önce [Güven listeleri ve federasyon](/concepts/trust-lists) kavram sayfasını okuyun.
- Bir belgenin imzasını kurumun sertifikasına, oradan ülkenin kök sertifikasına kadar izlemeniz gerektiğinde.
- Sonra: güven listelerinin biçimi için [[SPEC-TRUST-0001]].

**Kısaca.** Her ülke kendi kök sertifikasını (root CA) işletir. Kurum, örneğin bir üniversite, bu köke bağlı bir sertifika alır ve
belgeleri bununla imzalar. Doğrulayıcı imzadan kurumun sertifikasına, oradan kök sertifikaya ulaşır; kökün parmak izi bugün imzalı
[[t:trust-list|güven listelerinde]] yayımlanır (zincir aşamasında aynı kayıt deftere taşınır). Kurumun ağdaki kimliği (`issuerId`) ülke kodu ve sertifikanın
parmak izinden türetilir. Bir kurumun yetkisi hem sertifika düzeyinde hem de güven listesinde iptal edilebilir.

---

# Kapsam

Bu şartname, Tamga Network'te **kurumsal/entity kimliğin** X.509 sertifikalarıyla
nasıl kurulduğunu tanımlar ([[ADR-0004]]). **Ne'yi** değil **nasıl'ı** verir: kök CA
çıpalama, sertifika→`issuerId` eşlemesi, doğrulama algoritması, iptal ve yenileme
(rollover). SPEC-ID-0001'in **Entity DID profilinin yerine geçer**; **Takma ad
profili korunur** (bkz. §7).

**Üç katman ([[PM-AUTH-0001]]):** A=EVM adresi (bu doküman kapsamı dışı, değişmez) ·
**B=kurumsal kimlik (bu dokümanın konusu, X.509)** · C=kişisel kimlik (belge +
takma ad, §7).

---

# 1. Güven Zinciri: Ulusal Kök Sertifikaların (root CA) Sabitlenmesi

Her üye devlet **kendi ulusal kök CA'sını** işletir (egemenlik — [[ADR-0002]]). Tamga,
bu köklerin **fingerprint'lerini zincire çıpalar**; böylece bir kurumun sertifikası,
devletinin çıpalı köküne kadar doğrulanabilir.

```
Türkiye Root CA  (fingerprint zincirde, stateCode="TR")
   └── (opsiyonel Ara CA)
         └── İTÜ sertifikası  (leaf)
```

**On-chain kök kaydı** (RootCARegistry — [[SPEC-BC-0001]] ile aynı yönetişim,
`onlyOwnerState`):

```solidity
struct RootCA {
    bytes2  stateCode;      // "TR", "AZ", "KZ"
    bytes32 caFingerprint;  // SHA-256(DER(rootCert))
    uint64  notBefore;
    uint64  notAfter;
    bytes32 successorId;    // rollover halefi (yoksa 0)
    RootStatus status;      // ACTIVE, ROLLING_OVER, RETIRED, REVOKED
}
```

Bir devletin kökünü yalnızca **o devlet** kaydeder/günceller (`onlyOwnerState`).
Kök **açık anahtarı** on-chain tutulur (kişisel veri değildir — [[PM-TRUST-0001]]
sınırı korunur).

---

# 2. issuerId Türetme

Kurumun zincir kimliği, sertifika fingerprint'inden **deterministik** türetilir:

```
certFingerprint = SHA-256( DER(issuerCert) )
issuerId        = keccak256( abi.encodePacked(stateCode, certFingerprint) )
```

`issuerId`, [[SPEC-BC-0001]] **Issuer Registry**'de kaydın anahtarıdır:

```solidity
struct Issuer {
    bytes2        stateCode;
    bytes32       certFingerprint;
    IssuerCategory category;   // GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS (ADR-0014)
    uint64        validUntil;
    bytes32       successorId; // yumuşak iptal / yenileme halefi
    IssuerStatus  status;      // ACTIVE, SUSPENDED, REVOKED
}
```

Aynı kurum sertifikasını yenilediğinde fingerprint değişir → yeni `issuerId`; eski
kayıt `successorId` ile yeni kayda bağlanır (kesintisiz süreklilik; [[SPEC-BC-0001]]
yumuşak iptal deseni).

---

# 3. Belge Doğrulama Algoritması

Bir doğrulayıcı, [[t:holder|belge sahibinin]] sunduğu [[t:credential|belgeyi]] şöyle doğrular:

```
GİRDİ: credential (issuer imzalı SD-JWT), issuerCert (belgede ya da erişilebilir)

1. Sertifika zinciri: issuerCert → (ara CA) → Root CA'ya kadar doğrula.
   Root'un caFingerprint'i RootCARegistry'de ACTIVE|ROLLING_OVER mı? Değilse RED.
2. issuerId = keccak256(stateCode, SHA-256(DER(issuerCert))).
   Issuer Registry'de var mı ve status == ACTIVE mı? Kategori beklenen mi? Değilse RED.
3. Zamansal geçerlilik: issuerCert.notAfter geçmedi + validUntil geçmedi.
4. İptal:
   a. Kurum-seviyesi: X.509 CRL/OCSP temiz + on-chain Issuer.status != REVOKED.
   b. Credential-seviyesi: StatusList bit'i "geçerli" ([[SPEC-BC-0001]], min 100k).
5. İmza: credential imzası issuerCert public anahtarıyla geçerli.
   → 5 adım da geçerse credential GEÇERLİ.
```

**Not:** Adım 1–3 zincirden (herkese açık) okunur; belge/kişisel veri zincire
gitmez. Doğrulama belge verene **geri dönmeden** yapılır (holder-centric).

---

# 4. Kök Sertifika Yenileme (Rollover)

Ulusal kök, süre dolumu veya anahtar güçlendirmesi için yenilenir. Mevcut
belgeleri kırmadan:

1. Devlet yeni kökü kaydeder; eski kök `status = ROLLING_OVER`, `successorId = yeniKök`.
2. **Örtüşme dönemi** (ör. 12 ay): iki kök de doğrulama için kabul edilir.
3. Kurumlar sertifikalarını yeni köke taşır (yeni `issuerId` + `successorId` zinciri).
4. Örtüşme sonunda eski kök `RETIRED`; yalnızca yeni kök kabul edilir.

**Acil durum (kök ele geçirildi):** eski kök `REVOKED` → o köke bağlı tüm sertifikalar
anında geçersiz; ilgili devlet acil yeniden belge verme yürütür. Bu, kurum iptalinden
([[SPEC-BC-0001]]) daha geniş etkilidir ve yönetişimde tanımlanır ([[PM-GOV-0001]] planlı).

---

# 5. Sertifika İptali (İki Katmanlı)

| Katman | Mekanizma | Ne iptal eder |
|---|---|---|
| **Kurum sertifikası** | X.509 CRL/OCSP **+** on-chain `Issuer.status = REVOKED` | Kurumun tüm gelecekteki imzaları |
| **Tek belge** | StatusList bit ([[SPEC-BC-0001]]) | Yalnızca o belge |

Hibrit yaklaşım: X.509 dünyasının mevcut CRL/OCSP altyapısı (düzenleyici uyum) +
on-chain durum (holder-centric, kaynağa gitmeden doğrulanabilir). Çelişki hâlinde
**on-chain REVOKED bağlayıcıdır** (zincir tek doğruluk kaynağı).

---

# 6. Guardian & Court-Token Bağlama ([[SPEC-BC-0002]])

Accountable disclosure'da guardian kurumları ve mahkeme, **X.509 ile kimliklenir**:

- Guardian `entityId` = ilgili kurumun `issuerId`'si (yargı, KVKK, NVİ, Ombudsman,
  parlamento-atamalı → her biri X.509 sertifikalı kurum).
- **Court-token** = imzalı nesne (JWS veya EIP-712); imzası mahkemenin X.509
  sertifikasına, o da ulusal kök CA'ya kadar zincirlenir. On-chain doğrulama:
  `verifyCourtToken` fingerprint + zincir + registry ACTIVE kontrolü yapar.
- Guardian onayları (3-of-5) her biri X.509 imzasıyla; audit log imza fingerprint'lerini
  tutar (kişisel veri değil).

> Bu, [[SPEC-BC-0002]] §7'de kapatılan "x509 izlenecek" maddesinin somut karşılığıdır.
> Court-token'ın EIP-712 mi JWS mi olacağı + EVM precompile gereği → [[DECISIONS]]
> D-GRD-1 (kripto denetimi).

---

# 7. Korunan Takma Ad Profili (vatandaş)

**Vatandaşa küresel tanımlayıcı verilmez.** Kişisel ilişkiler **pairwise [[t:pseudonym]]**
ile kurulur (SPEC-ID-0001 takma ad profili — X.509 kararından **etkilenmez**):

- Takma ad = self-certifying, anahtar-tabanlı; her ilişkide farklı, unlinkable.
- Zincire **yazılmaz**; çözümleme yerel anahtardan.
- **Multicodec seti (sabitlenen):** `p256-pub` (0x1200), `secp256k1-pub` (0xe7),
  `ed25519-pub` (0xed). Varsayılan **P-256** ([[t:eIDAS]]/[[t:QSCD]] hizası); EVM-yerel işlemler
  için secp256k1.
- Entity↔takma ad köprüsü yalnızca accountable disclosure ([[SPEC-BC-0002]]) ile.

---

# 8. eIDAS / did:web Köprüsü (isteğe bağlı birlikte çalışma)

AB ile birlikte-çalışabilirlik için bir kurum, mevcut kimliğini Tamga `issuerId`'sine
**alias**'layabilir:

- **eIDAS QWAC/QSeal:** Kurumun nitelikli sertifikası zaten X.509 — doğrudan `issuerId`
  türetmeye uygun; AB Trusted List ([[t:LOTL]]) ile çapraz-tanıma ([[ADR-0002]] cross-recognition).
- **did:web:** Kurumun `did:web` kimliği bir alias kaydıyla `issuerId`'ye bağlanabilir
  (zorunlu değil; yalnızca DID-tabanlı dış ekosistemlerle interop gerekirse).

Bu köprü **tek yönlü tanımadır**; Tamga'nın çekirdek güven zinciri ulusal kök CA'lardır.

## 8.1 eIDAS Güven Listesi Projeksiyonu (ETSI TS 119 612)

> Karar temeli: [[RS-EIDAS-0001]] §5.1 (ETSI TS 119 612 V2.4.1 analizi). ETSI 119 612,
> AB-dışı ülke/uluslararası kuruluşların Trusted List (TL) yayımlayıp AB LOTL ile
> **karşılıklı tanınmasını** açıkça öngörür ([[ADR-0002]] cross-recognition). Bu, kurumsal
> tarafın did:web köprüsüne göre daha düzenleyici-okunabilir interop yoludur.

**İlke:** On-chain kayıt (RootCARegistry + Issuer Registry) **tek doğruluk kaynağıdır**;
119 612-uyumlu TL, bu zincir durumunun **salt-okunur bir off-chain projeksiyonudur**
(XML/XAdES). Projeksiyon `sdk/` altında üretilir, **kontrat değişikliği gerektirmez** ve
zincir durumunu değiştirmez. Tamga bu TL için bir **Trusted List Scheme Operator (TLSO)**
rolü üstlenir (ilk aşamada Tamga; devlet aşamasında ulusal kök otorite — [[PM-ASSUR-0001]]).

**Servis tipi eşlemesi (Tamga kaydı → ETSI Service type identifier):**

| Tamga | ETSI 119 612 Service type URI |
|---|---|
| Ulusal kök CA (RootCARegistry) | `…/Svctype/NationalRootCA-QC` |
| Issuer (CA/sertifika veren kurum) | `…/Svctype/CA/QC` (veya `CA/PKC` non-qualified) |
| Kayıt otoritesi / kimlik ispatı ([[DECISIONS]] D-ID-2) | `…/Svctype/RA`, `…/Svctype/IdV` |
| X509-AC EAA veren kurum ([[RS-EIDAS-0001]] §4.4) | `…/Svctype/ACA`, `…/Svctype/EAA/Q` |
| TL yayımlayan servis (Tamga TLSO) | `…/Svctype/TLIssuer` |

**Statü sözlüğü 1:1 eşlemesi (Tamga durum → ETSI Service current status):**

| Tamga durum | ETSI Svcstatus | Not |
|---|---|---|
| `ACTIVE` (Root/Issuer) | `…/Svcstatus/granted` | Nitelikli hizmet onaylı |
| `ACTIVE` (ulusal tanıma bağlamı) | `…/Svcstatus/recognisedatnationallevel` | 5.5.1.3 tipi hizmetler için |
| `ROLLING_OVER` (Root) | `granted` + `TakenOverBy` (§5.5.9.3) | Halef köke devir; örtüşme dönemi |
| `SUSPENDED` (Issuer) | `granted` → geçici `withdrawn` | Askı; geçmiş korunur |
| `RETIRED` (Root, rollover sonu) | `withdrawn` + tam statü geçmişi | Silme değil; geçmiş asla düşmez (§5.3.12) |
| `REVOKED` (Root/Issuer) | `withdrawn` | Ele geçirilme; alt sertifikalar düşer |
| `successorId` bağı (halef belge veren) | `TakenOverBy` extension | D-BC-5 / XC2 birebir karşılık |

**Değişmez korumaları:** Projeksiyon yalnızca **kişisel-olmayan** güven verisini (kök/kurum
public anahtarı, statü, geçmiş) dışa verir (`XC3`). **Vatandaş pairwise takma adı asla
TL'e yazılmaz** (`XC4`); TL yalnızca kurumsal katmanı (B) kapsar. Bu, ETSI Trusted List
modelinin "blockchain güven çapası" varyantıdır: ETSI digest'i OJEU'ya koyar, Tamga
RootCARegistry'ye çıpalar.

### 8.1.1 LoTE izdüşümü (ETSI TS 119 602, JSON) — uygulandı (2026-09-29)

[[t:ARF]] 3.0, cüzdan ve doğrulayıcıların [[t:trust-anchor|güven çapalarını]] hem 119 612 TL'lerinden hem 119 602 [[t:LoTE|LoTE'lerinden]] almasını ister
(OIA_15b, ISSU_10b, ISSU_28a). `apps/trust-publisher` `build`, [[SPEC-TRUST-0001]] listelerinden üç LoTE üretir
(`trust.tamga.network/lote/{wallet-providers,wrpac-providers,eaa-providers}.jws`): Ek A.1 JSON şeması, compact JAdES
Baseline B (`x5c`, `x5t#S256`, kritik `sigT`), aynı liste imzacısı (sertifika C/O = SchemeTerritory / SchemeOperatorName,
§6.8.0).

- Profil: AB Ek E / Ek F kuralları ve Ek H yapısı. Ancak "üye devletçe bildirilmiş" anlamı taşıyan URI'ler (LoTEType,
  StatusDetn, schemerules, ListOfTrustedEntities/…/CC) yerine Tamga URI kökü `https://trust.tamga.network/lote/`
  kullanılır (Ek C.1).
- Hizmet türü URI'leri ETSI'nindir (`SvcType/WalletSolution`, `SvcType/WRPAC`). Nitelikli olmayan EAA için ETSI türü yoktur;
  Tamga URI'si kullanılır.
- LoTE bir görünümdür; yetkili kaynak Tamga listeleridir. Yayın, kaynakta `lote.enabled` ile açılır.

**Açık uçlar:** Türk dünyası için çok-devletli ülke kodu (ETSI §5.1.5, GCC/ASEAN benzeri)
ve TL yayın kadansı (≤6 ay, gürültülü yeniden yayın — [[ADR-0008]] ile hizalı) → §10.

---

# 9. Anahtar Algoritmaları ve Değişmezler

- **İmza:** ECDSA **P-256 (secp256r1)** birincil (eIDAS/QSCD uyumu); secp256k1 EVM-yerel
  işlemler için kabul. Sertifikalar SHA-256 özet.

**Değişmezler:**

| # | Değişmez |
|---|---|
| **XC1** | Kurumsal kimlik daima devletinin çıpalı kök CA'sına zincirlenir. |
| **XC2** | `issuerId` sertifika fingerprint'ine bağlıdır; sertifika değişince kimlik yeni `issuerId` + `successorId` ile devam eder. |
| **XC3** | Zincir yalnızca kişisel-olmayan veri tutar (kök/kurum public anahtarı, durum). |
| **XC4** | Vatandaşın küresel tanımlayıcısı yoktur (yalnızca pairwise takma ad). |
| **XC5** | Entity↔kimlik bağı yalnızca accountable disclosure eşiğiyle çözülür. |

---

# 10. Açık Sorular

1. **Ara CA (intermediate) politikası:** Devletler ara CA kullanacak mı, leaf doğrudan
   root'tan mı imzalanacak? (zincir uzunluğu / doğrulama maliyeti)
2. **Örtüşme dönemi süresi** (rollover) — 12 ay öneri; devletlerle netleşir → PM-GOV-0001.
3. **Court-token formatı** (JWS vs EIP-712 + precompile) → [[DECISIONS]] D-GRD-1.
4. **OCSP stapling vs on-chain durum** birincilliği — performans/uyum dengesi.
5. **CAIP-2 ağ kimliği** (`tamga:<chainId>`) sertifika/issuerId gösteriminde nasıl yer alır.
6. **119 612 TL projeksiyon formatı** (§8.1): `sdk/` üreteci XML/XAdES-B-B mı üretir, imza
   anahtarı yönetimi (≥2 kaydırmalı sertifika, ETSI Annex A.2) nasıl kurgulanır → SPEC-CRED /
   PM-GOV-0001.
7. **Türk dünyası çok-devletli ülke kodu** (ETSI §5.1.5) tanımlanacak mı → [[ADR-0002]].
8. **TL yayın kadansı** (≤6 ay, gürültülü yeniden yayın) iptal listesi yayınıyla ([[ADR-0008]])
   nasıl birleştirilir.

---

# 11. İlişkiler ve Durum

- [[ADR-0004]] — bu şartnamenin karar kaynağı (X.509).
- SPEC-ID-0001 — Entity profili superseded; **Takma ad profili bu dokümanda korunur**.
- [[SPEC-BC-0001]] — Issuer Registry / StatusList / IssuerCategory (issuerId veri kaynağı).
- [[SPEC-BC-0002]] — guardian/court-token X.509 bağlama (§6).
- [[ADR-0002]] — onlyOwnerState / cross-recognition (kök CA sahipliği, eIDAS köprüsü).
- [[PM-AUTH-0001]] — üç katman + düzenleyici okunabilirlik gerekçesi.
- [[RS-EIDAS-0001]] — §5.1 (ETSI 119 612 Trusted List analizi) = §8.1 projeksiyonunun temeli.
- Implementasyon: `sdk/` (resolver + doğrulama + 119 612 TL projeksiyonu), `contracts/src/` (RootCARegistry).

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

---
