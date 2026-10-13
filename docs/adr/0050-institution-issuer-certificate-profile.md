---
document_id: ADR-0050
title: "Kurum belge veren sertifika profili"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  Belge veren kurumların (kimlik servisi dahil) belge imza ve iptal listesi imza sertifikaları ETSI TS 119 412-6 V1.2.1 ve
  EN 319 412-3'e göre yazılır: konu alanında kurum kimlik numarası (`organizationIdentifier`, kayıt sertifikasının `sub`'ıyla
  aynı), kurumun resmî adı ve ülke; anahtar kullanımı kritik ve tek türlü (yalnız `digitalSignature`); konu ve makam anahtar
  tanımlayıcıları (SKI, AKI) zorunlu; AIA nitelikli olmayan EAA'da gerekmez. Sandbox sertifikaları aynı anahtarla yeniden
  imzalanır; gerçek ağın sertifikaları kurum kimlik numarası kayda girince yenilenir. D-ID-5'in (SPEC-ID-0002) sertifika
  ayrıntısını değiştirir. Kabul: 2026-10-13.
domain: Identity
related: ["[[ADR-0004]]", "[[ADR-0026]]", "[[ADR-0022]]", "[[ADR-0038]]", "[[ADR-0041]]", "[[SPEC-ID-0002]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Bir kurumun belgeleri imzaladığı sertifika, o kurumu AB'nin beklediği biçimde tanıtmalıdır: kurumun vergi ya da sicil numarası
sertifikanın içinde durur ve kayıt sertifikasındaki numarayla aynıdır. Bu karar, kurum sertifikalarında hangi alanların zorunlu
olduğunu yazar.

# Bağlam

- **AB kuralı.** ETSI TS 119 412-6 V1.2.1 (2026-04) PID, cüzdan ve EAA sağlayıcılarının sertifika profilini verir. Sertifikanın
  konusu tüzel kişiyse EN 319 412-3 §4.2.1 uygulanır: `organizationIdentifier` (OID 2.5.4.97, EN 319 412-1 semantik tanımlayıcı),
  `organizationName`, `countryName` (PID-4.3-02). Anahtar kullanımı uzantısı zorunludur ve EN 319 412-2 Tablo 1'deki türlerden
  **tam olarak biri** olmalıdır (PID-4.4.1-01; ISO/IEC 18013-5 belge imza sertifikası için yalnız `digitalSignature`). SKI
  zorunludur (PID-4.4.2-01); kendinden imzalı olmayan sertifikada AIA beklenir (PID-4.4.3-01) — nitelikli olmayan EAA için EN
  319 412-2'ye bırakılmıştır, nitelikli ve kamu EAA'sında zorunludur.
- **Bugün.** Tamga'nın kurum sertifikaları P-256/ES256, SKI ve (yeni üretilenlerde) AKI taşır; konu alanı `CN, OU, O, C`'dir,
  **kurum kimlik numarası yoktur**. Kayıt sertifikası (WRPRC) ise kurumu `sub` = `VATTR-<VKN>` ile tanıtır ([[ADR-0026]] K2);
  erişim sertifikalarında bu numara 2026-10-09'dan beri vardır ([[ADR-0026]] K3). Belge veren sertifikasında olmadığı için AB
  tarafındaki bir doğrulayıcı belgeyi imzalayan kurumu kayıt verisiyle eşleyemez.
- **D-ID-5** ([[SPEC-ID-0002]]) sertifika hiyerarşisini ve doğrulamayı yazar ama konu alanı ve uzantı profili yazmaz.
- Kütüphane notunda bu konu KA-412-6-1 adıyla açıktı; ilk AB uyum turu (2026-10-13) "sunucudan önce sertifika profilleri"
  paketine aldı, proje yönetimi aynı gün kabul etti.

# Karar

## K1 — Kapsam

Profil, güven listesinde `issuers[]` kaydı olan her belge verenin şu sertifikalarına uygulanır: belge imza sertifikası (`cert`) ve
iptal listesi imza sertifikası (`status_cert`, `delegate_keys[]` `purpose: "status_list"`). Kimlik servisi de bir belge veren olarak
bu profile uyar. Erişim sertifikaları ([[ADR-0026]] K3), liste imza, kayıt birimi ve cüzdan sağlayıcı sertifikaları kendi
kararlarındadır.

## K2 — Profil

| Alan | Kural |
|---|---|
| Konu | `organizationIdentifier` (2.5.4.97) **MUST**: kayıt sertifikasının `sub`'ıyla aynı semantik tanımlayıcı (`TR-VKN` → `VATTR-<numara>`, `TR-MERSIS` → `NTRTR-<numara>`, LEI → `LEIXG-<kod>`; [[ADR-0026]] K2). `organizationName` (`O`) **MUST**: kurumun resmî adı (kayıttaki `legal_name`; Latin harfle yazılabilir). `countryName` (`C`) **MUST**. `commonName` (`CN`) ve `organizationalUnitName` (`OU`) isteğe bağlı (ör. "Status List") |
| Anahtar kullanımı | Kritik; yalnız `digitalSignature` (EN 319 412-2 Tablo 1'den tek tür; mdoc belge imza sertifikasıyla uyumlu tür). Başka bit **MUST NOT** |
| Temel kısıtlar | Kritik, `cA = false` |
| SKI | **MUST** (RFC 5280 §4.2.1.2) |
| AKI | **MUST** = imzalayan makamın (kök ya da ara sertifika makamı) SKI'si; HAIP `trusted_authorities` (`aki`) eşleşmesi buna dayanır |
| AIA `caIssuers` | Nitelikli olmayan EAA'da (bugün ağdaki bütün belge verenler, [[ADR-0022]]) gerekmez: zincir belgenin `x5c`'sinde, kök güven listesindedir. Nitelikli ya da kamu sınıfı (QEAA, PuB-EAA; QcStatements dahil) ayrı kararla açılır |
| Algoritma | P-256, ECDSA SHA-256 (değişmedi) |
| Süre | En çok 3 yıl (bugün 2 yıl; değişmedi) |

## K3 — Geçiş

- **Sandbox** ([[ADR-0038]]): örnek kurumların ve sandbox kimlik servisinin sertifikaları **aynı anahtarla yeniden imzalanır**
  (`gen-pki --profile=sandbox --reissue=…`); yeni seri numarası, yeni parmak izi, dolayısıyla yeni `issuer_id`. Kök ve liste
  imzacısı değişmez, cüzdandaki sandbox sabitlemesi aynı kalır. Sandbox her gece sıfırlandığından eski deneme belgelerinin
  geçersizleşmesi kabul edilir.
- **Sandbox test kurumları** ([[ADR-0041]]): liste yayıncısının verdiği yaprak sertifikalarına `organizationIdentifier` eklenmesi
  paketlerin bir sonraki sürümünde (liste yayıncısı).
- **Gerçek ağ:** kurum sertifikası kurum kimlik numarası kayda girerken verilir (`pki-issue --prod --org-id`; kurum sertifikası
  için `--org-id` zorunlu). Bugünkü kayıtlarda numara olmayan belge veren (kimlik servisi) için: numara kayda girince yeni anahtar
  ve sertifika verilir, yeni sertifika kayda eklenir, eski sertifika örtüşme süresince yalnız eski belgeleri doğrulamak için kalır
  ([[SPEC-ID-0002]] §4 ve [[ADR-0004]] yenileme deseni; XC2). Gerçek ağın PKI'sı depo dışındadır; işlem operatörün belgelediği
  prosedürle yapılır.
- **Geliştirme PKI'sı** değişmez (yerel, rastgele; [[ADR-0026]] K3'teki gibi kimlik numarası taşımaz).

## K4 — Denetim

Liste yayıncısı yayında belge veren sertifikasının `organizationIdentifier`'ını kayıttaki kimlik numarasıyla karşılaştırır; eksikse
ya da farklıysa uyarır (gerçek ağda yayın engellenmez; kimlik numarası olmayan kayıt için kayıt sertifikası zaten üretilmez,
[[ADR-0026]] K2). Uyarının hataya dönüşmesi gerçek ağdaki bütün sertifikalar yenilendikten sonra ayrı bir kararla olur.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Kimlik numarasını yalnız güven listesinde tutmak | ret | AB doğrulayıcısı ve 412-6 sertifikanın kendisine bakar; liste dışındaki araçlar kurumu tanıyamaz |
| Anahtar kullanımında `nonRepudiation` (içerik bağlılığı türü) | ret | Belge imzası bir kurum beyanıdır ama mdoc belge imza sertifikası yalnız `digitalSignature` ister; iki biçim aynı sertifikayı kullanır |
| AIA'yı bugünden zorunlu kılmak | ret (bugün) | Nitelikli olmayan EAA'da gerekmez; yayın noktası işletmek gerekir. Nitelikli sınıfla birlikte gelir |
| Sandbox'ta yeni anahtar üretmek | ret | Sunucudaki anahtar paketi değişirdi; aynı anahtarla yeniden imza yeter |

# Değişmezler

| Kod | Kural |
|---|---|
| CP1 | Belge veren kurumun belge ve iptal listesi imza sertifikası konu alanında, kayıt sertifikasının `sub`'ıyla aynı `organizationIdentifier`'ı, kurumun resmî adını (`O`) ve ülkesini (`C`) taşır. |
| CP2 | Kurum sertifikasında anahtar kullanımı kritik ve yalnız `digitalSignature`'dır; SKI ve AKI zorunludur. |

# Sonuçlar

- [[SPEC-ID-0002]] §1.1 (yeni): kurum sertifika profili; XC6.
- `ops/gen-pki.ts`: sandbox kurum ve kimlik servisi sertifikalarının konu adlarında `organizationIdentifier`; yeniden imza
  (`--reissue`). `ops/pki-issue.ts`: AKI; `--prod` kurum sertifikasında `--org-id` zorunlu.
- Liste yayıncısı (paketlerin sonraki sürümü): K4 denetimi; sandbox test kurumu yapraklarında `organizationIdentifier`.
- Operatör: gerçek ağ kimlik servisinin sertifikası, kurum kimlik numarası kayda girince yenilenir (prosedür operatör belgesinde).

# Durum

**Accepted — 2026-10-13.** Proje yönetimi onayıyla (ilk AB uyum turu, paket 2 ve karar 16). DECISIONS: D-ID-12. D-ID-5'in sertifika
ayrıntısını değiştirir.
