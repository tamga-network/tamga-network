---
document_id: ADR-0048
title: "Kimlik servisinin belgelerinde askı yok; mdoc iptal listesi CWT"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  AB kişi kimliği (PID) kuralına hizalama: kimlik servisinin verdiği belge türlerinde askı yoktur, durum yalnız "geçerli /
  iptal"dir ve bu türlerin iptal listeleri `bits = 1` ile yayımlanır. Kurum belgelerinde askı yalnız şeması
  `suspension_allowed: true` diyen türlerde kullanılır. mdoc belgesinin MSO'su aynı mantıksal listenin ayrı adresteki CWT
  gösterimine (`application/statuslist+cwt`) işaret eder; JWT ve CWT gösterimleri aynı bitleri taşır. SPEC-CRED-0003/S2'yi
  değiştirir. Uygulama paketlerin 0.6.0 sürümünde. Kabul: 2026-10-13.
domain: Credentials
related: ["[[ADR-0008]]", "[[ADR-0013]]", "[[ADR-0022]]", "[[ADR-0029]]", "[[ADR-0044]]", "[[SPEC-CRED-0003]]", "[[SPEC-SCHEMA-0001]]", "[[FW-RB-0001]]", "[[FW-RB-0003]]", "[[FW-POL-0001]]"]
---

# Kısaca

Kimlik servisinin belgeleri artık askıya alınamaz: ya geçerlidir ya iptal edilmiştir. Kurumlar askıyı yalnız türün şeması izin
veriyorsa kullanır (örneğin diploma). Kimlik belgesinin mdoc kopyası iptal durumunu, aynı listenin CWT biçimindeki kopyasından
okur. İlk AB uyum turunun (2026-10-13) önerisidir; proje yönetimi aynı gün kabul etti.

# Bağlam

- **Bugünkü kural.** Bütün Tamga iptal listeleri `bits = 2` ile yayımlanır (geçerli, iptal, askıda; [[SPEC-CRED-0003]] §3.3, S2).
  Identity Rulebook kimlik belgesi için "geçerli, iptal, askıda" der ([[FW-RB-0003]] §6.2); RB-AP-ID-11 "ana belge iptal ya da
  askıdaysa" ZK kopyası verilmez der. Kimlik servisinin kodu ise hiç askıya almaz, yalnız iptal eder. Kurum Konsolu her belge
  türünde askıya izin verir.
- **AB kuralı.** Uygulama Tüzüğü (AB) 2024/2979 Ek II (2026/1731 ile değişik) ETSI TS 119 472-1'i şu uyarlamayla bağlar: PID,
  nitelikli EAA ve kamu kurumu EAA'sında durum yalnız "iptal / iptal değil"dir, **askı yoktur**, iptal kalıcıdır. Kimlik belgemiz
  PID değildir ([[ADR-0022]]: nitelikli olmayan EAA), ama AB PID'inin adlarını ve kodlamasını kullanır ([[ADR-0045]]) ve devlet
  PID'i gelince onun yerini almaya en yakın türdür. Askının kimlikte bir karşılığı da yoktur: kimlik hakkında "inceleme süresince
  geçici olarak geçersiz" denecek bir durum yaşanmaz; şüphede belge iptal edilir ve kişi yeniden doğrulanır.
- **mdoc durum atfı.** Kimlik belgesinin mdoc kopyasının MSO'su bugün SD-JWT kopyasıyla aynı adrese, yani JWT biçimindeki
  listeye işaret eder. ISO/IEC 18013-5 ve AB tüzüğü mdoc için CBOR/COSE biçimini (CWT) bekler; mdoc okuyucusu bir JWT ayrıştırıcısı
  taşımak zorunda kalmamalıdır. [[SPEC-CRED-0003]] §3.2 CWT'yi "devlet aşamasında değerlendirilir" diye bırakmıştı.

# Karar

## K1 — Kimlik servisinin türlerinde askı yok

- Kimlik servisinin verdiği ve iptal listesi kullanan her türde (kimlik belgesi `urn:tamga:id:IdentityAttestation:1`, sürücü
  belgesi bilgisi `urn:tamga:id:DrivingLicenceAttestation:1`, iletişim belgeleri `urn:tamga:contact:EmailAddress:1` ve
  `urn:tamga:contact:PhoneNumber:1`) durum yalnız **geçerli (`0x00`)** ya da **iptal (`0x01`)**'dir. İptal kalıcıdır.
- Bu türlerin iptal listeleri **`bits = 1`** ile yayımlanır. Listeler tür başına ayrı olduğundan (S9) bir listede askılı ve
  askısız türler karışmaz.
- Kimlik servisi belgeyi askıya almaz; şüphede iptal eder. ZK kopyası ana belge iptal edilmişse verilmez (RB-AP-ID-11'in "ya da
  askıdaysa" kısmı düşer).
- Askısı olmayan türün listesinde `0x00` ve `0x01` dışındaki her değer doğrulayıcı için RED'dir (bozuk liste); `bits = 1` listesinde zaten
  başka değer yoktur.

## K2 — Kurum türlerinde askı yalnız şema izin veriyorsa

- Şema meta verisinin `tamga` bloğuna isteğe bağlı **`suspension_allowed`** (boolean, varsayılan `false`) alanı eklenir
  ([[SPEC-SCHEMA-0001]] §2.4).
- Askı (`0x02`) yalnız şeması `suspension_allowed: true` olan türlerin belgelerinde kullanılır. Eğitim türlerinden diploma
  (`urn:tamga:edu:DiplomaCredential:1`) bunu taşır: intihal ya da sahtecilik incelemesi sürerken belge askıya alınır. Diğer
  türler alanı taşımaz; belge veren bu türlerde askı **MUST NOT** kullanmak.
- Kurum listeleri `bits = 2` kalır (askısı olmayan türde de; değer `0x02` yazılmaz). Böylece bir türe ileride askı izni verilirse
  listenin biçimi değişmez.
- Kurum Konsolu "Askıya al" işlemini yalnız `suspension_allowed: true` türlerde sunar. Kendi belge verme servisini işleten kurum
  da aynı kurala uyar (RB-AP).
- Kimlik servisinin türleri `suspension_allowed` taşımaz (K1).

## K3 — mdoc durum atfı CWT gösterimine

- Belge veren, iptal listesi kullanan ve mdoc olarak da verilen her tür için aynı mantıksal listeyi iki gösterimle yayımlar:
  JWT (`application/statuslist+jwt`, bugünkü) ve CWT (`application/statuslist+cwt`; IETF Token Status List'in CWT biçimi: COSE_Sign1,
  ES256, korunan başlıkta `typ` = `application/statuslist+cwt` ve `x5chain`; talepler `sub` (2), `iat` (6), `exp` (4), `ttl`
  (65534), `status_list` (65533) `{bits, lst}`).
- İki gösterim **ayrı adreslerde** durur, çünkü her belirtecin `sub`'ı kendi adresiyle birebir aynı olmalıdır ([[SPEC-CRED-0003]]
  Ş4). CWT adresi de opaktır (S8) ve kurum, yıl ya da grup kodlamaz.
- İki gösterim **aynı bitleri** taşır, aynı yayın döngüsünde aynı anahtarla imzalanır (aynı `iat`, `exp`, `ttl`), aynı çapa
  günlüğüne iki ayrı satır olarak yazılır. Bir belgenin SD-JWT ve mdoc kopyaları aynı `idx`'i kullanır.
- SD-JWT VC kopyası JWT adresine, mdoc kopyasının MSO'su (`status.status_list {idx, uri}`) CWT adresine işaret eder. mdoc
  doğrulayıcısı CWT gösterimini [[SPEC-CRED-0003]] §7'deki adımların CBOR karşılığıyla doğrular.
- mdoc olarak verilmeyen türlerde CWT gösterimi yayımlanmaz.

## K4 — Uygulama ve geçiş

- Uygulama `@tamga-network/*` paketlerinin 0.6.0 sürümünde ve kimlik servisinde. Geliştirme evresi kuralı gereği ([[ADR-0029]])
  geçiş kodu yazılmaz: kimlik servisi yeni (`bits = 1`) listeleri açar, cüzdanlardaki kimlik belgeleri yeniden alınır.
- Kurum Konsolu'nun kural metni bugünden bu karara göre yazılır; düğmenin türe göre gizlenmesi 0.6.0'da.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Bütün listeler `bits = 2` kalsın, kimlik servisi yalnız askıyı kullanmasın | ret | Liste biçimi kuralı söylemez; doğrulayıcı `0x02` görürse ne yapacağını bilemez. AB PID'i gibi okunması için biçim de "iptal / iptal değil" olmalı |
| Askıyı ağın bütün türlerinde kaldırmak | ret | Diplomada inceleme süresince askı gerçek bir ihtiyaç ([[SPEC-CRED-0003]] §3.3); nitelikli olmayan EAA'da AB serbest bırakır |
| Askı izni belge veren kaydında (kurum başına) | ret | Askı türün anlamına bağlıdır, kurumun tercihine değil; şema herkes için aynı kuralı söyler |
| mdoc'ta JWT adresinde kalmak | ret | mdoc okuyucusuna JWT ayrıştırıcısı yükler; ISO ve AB CWT bekler |
| Tek adreste içerik pazarlığı (`Accept` başlığına göre JWT ya da CWT) | ret | Belirtecin `sub`'ı adresle birebir aynı olmalı; aynı adreste iki biçim ön çekim önbelleğinde karışır |
| Tanımlayıcı listesi (Attestation Revocation List) | ret (bugün) | Tamga belge verenleri Status List yayımlar; biri yeter (AB VCR_11); doğrulayıcı tanımlayıcı listesini yine okur |

# Değişmezler

| Kod | Kural |
|---|---|
| SU1 | Kimlik servisinin türlerinde belge askıya alınmaz; durum yalnız geçerli ya da iptaldir ve bu türlerin iptal listeleri `bits = 1` ile yayımlanır. |
| SU2 | Askı (`0x02`) yalnız şeması `suspension_allowed: true` olan türlerde kullanılır; diğer türlerde belge veren askı değeri yazmaz. |
| SU3 | mdoc olarak da verilen türün iptal listesi JWT ve CWT olarak ayrı, opak adreslerde aynı bitlerle yayımlanır; mdoc kopyası CWT adresine, SD-JWT kopyası JWT adresine işaret eder. |

# Sonuçlar

- [[SPEC-CRED-0003]]: S2 bu karara göre yeniden yazılır; §3.2 CWT gösterimi, §3.3 tür başına `bits`, §7 Ş8–Ş9.
- [[SPEC-SCHEMA-0001]] §2.4: `suspension_allowed`.
- Çerçeve: [[FW-RB-0003]] §3.1 ve §6.2; [[FW-RB-0001]] RB-AP-18, RB-AP-ID-11, yeni RB-AP-28 ve RB-AP-ID-13; [[FW-POL-0001]] §5;
  Education Rulebook §6.2.
- Paketler (0.6.0): `@tamga-network/issuer` liste yayıncısı (`bits` tür başına, CWT gösterimi), `@tamga-network/mdoc` (MSO durum
  atfı), `@tamga-network/verifier` ve `wallet-core` (CWT okuma), şema kataloğu (`suspension_allowed`).
- Kimlik servisi ve Kurum Konsolu (operatör deposu): yeni listeler; askı düğmesi türe göre.

# Durum

**Accepted — 2026-10-13.** Proje yönetimi onayıyla (ilk AB uyum turu, karar 5). DECISIONS: D-CRED-9.
