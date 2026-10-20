---
document_id: ADR-0006
title: "Rəqəmsal sənəd formatı: SD-JWT VC"
status: Active
version: 1.0.0
created: 2026-09-03
last_updated: 2026-10-02
summary: >
  Tamga rəqəmsal sənəd formatını və vermə/təqdimetmə protokollarını QƏRAR kimi sabitləşdirir: əsas format SD-JWT VC, ikinci dərəcəli format mdoc/ISO 18013-5 (2-ci faza); vermə OpenID4VCI, təqdimetmə OpenID4VP, imza ES256 (P-256). Holder binding (`cnf` + cihaz açarı) İSTİSNASIZ MƏCBURİDİR — bu, rəqəmsal sənədin başqasının rəqəmsal cüzdanına götürülməsi boşluğunun (holder binding problemi) yeganə həllidir. Wallet Unit Attestation (WUA) əvvəldən tətbiq edilir. Revocation Token Status List-ə ([[SPEC-BC-0001]]) həvalə edilir. Tam spesifikasiya → SPEC-CRED-0001.
domain: Credentials
translation_of: ADR-0006
source_version: "1.0.0"
---

# ADR-0006 — Rəqəmsal sənəd formatı və protokollar

**Status:** Accepted
**Tarix:** 2026-09-03
**Qərarı verən:** Tamga Network layihə rəhbərliyi
**Mənbə:** `tamga-guven-cercevesi-v0.1.md` (F, G, K bölmələri) — iş qeydi; tam spesifikasiya
→ [[SPEC-CRED-0001]].

---

# Kontekst

Repozitoriyada [[t:credential]] formatı indiyədək "planlaşdırılan" kimi qalmışdı; [[SPEC-BC-0001]] [[t:SD-JWT-VC]] və
Token Status List-ə istinad edirdi, lakin rəsmi format qərarı yox idi. Bundan əlavə, "universitet
ideyasındakı gizli xəta" (rəqəmsal sənəd başqasının rəqəmsal cüzdanına götürülə bilər) təhlükəsizlik boşluğu
kimi açıq qalırdı. Bu ADR hər ikisini bağlayır. [[ADR-0001]] (Besu/EVM) və [[ADR-0004]] (X.509
[[t:issuer]] şəxsiyyəti) üzərində qurulur.

---

# Qərar

## Qərar 1 — Format: SD-JWT VC (əsas), mdoc (ikinci dərəcəli, 2-ci faza)

SD-JWT VC əsas formatdır: [[t:selective-disclosure]] daxilidir, EUDI [[t:ARF]] əsas formatıdır,
kitabxanalar boldur, JSON-LD-dən sadədir. [[t:mdoc]]/ISO 18013-5 ikinci dərəcəlidir (2-ci faza; oflayn/
fiziki təqdimetmə, [[t:mDL]] uyğunluğu).

## Qərar 2 — Protokollar: OpenID4VCI (vermə), OpenID4VP (təqdimetmə)

Faktiki standartlardır ([[t:OpenID4VCI]], [[t:OpenID4VP]]); qurumların mövcud OIDC infrastrukturuna uyğun gəlir, [[t:verifier]] inteqrasiyası asandır.

## Qərar 3 — İmza: ES256 (P-256)

Mobil secure element (Secure Enclave/StrongBox) və HSM-lərdə universal dəstək.

## Qərar 4 — Holder binding istisnasız məcburidir (`cnf` + cihaz açarı)

Hər rəqəmsal sənəd [[t:issuance]] anında [[t:holder|sənəd sahibinin]] **cihazda yaradılmış** açarına `cnf` ilə
bağlanır; təqdimetmə zamanı sənəd sahibi [[t:nonce|nonce-u]] həmin açarla imzalayır ([[t:KB-JWT]]). Bu, [[t:holder-binding]] boşluğunun
**yeganə** həllidir və söndürülə bilməz. Açar aparatda yaradılır, xaricə ixrac edilə bilməz →
rəqəmsal sənəd başqasına ötürülə bilməz.

## Qərar 5 — Wallet Unit Attestation (WUA) əvvəldən tətbiq edilir

Rəqəmsal cüzdanın həqiqiliyini (aparat açarı, PIN aktivdir, root/jailbreak yoxdur, provayderin kimliyi)
bəyan edən [[t:WUA]] pilotda sadə məzmunla olsa belə, **sahə və axın kimi əvvəldən** açılır —
sonradan əlavə etmək bütün rəqəmsal cüzdanların miqrasiyasını tələb edir.

## Qərar 6 — Ləğv Token Status List-ə həvalə edilir

Ayrıca [[t:revocation]] mexanizmi müəyyən edilmir; [[SPEC-BC-0001]] §5 Token Status List istifadə olunur
(off-chain siyahı + on-chain pointer, min 100k, təsadüfi index). Korrelyasiyaya qarşı batch
sənəd vermə 2-ci fazaya təxirə salınır, formatda onun üçün yer saxlanılır.

---

# Əsaslandırma

- **EUDI uyğunluğu:** SD-JWT VC + OpenID4VCI/VP + ES256 EUDI ARF-in əsas stekidir → "uyğun,
  lakin müstəqil" ([[PM-PH-0001]]) və transsərhəd interop.
- **Holder binding = mövcudluq səbəbi:** bu boşluq bağlanmasa, sistem səssizcə yalan deyər;
  dəyəri sıfıra enər.
- **Geri dönməzlik:** format/binding/WUA əvvəldən düzgün qurulmasa, sonradan bütün
  rəqəmsal cüzdan bazasının miqrasiyası lazım gələr — bu, [[ADR-0003]] "bu gün pulsuz, sonra qeyri-mümkün"
  məntiqi ilə eynidir.

---

# Nəticələr

1. [[SPEC-CRED-0001]] tam spesifikasiyadır (format strukturu, KB-JWT, WUA, axınlar).
2. `contracts/` və `sdk/` rəqəmsal cüzdanı **cihazın secure element** açarı + `cnf` yaradır;
   proqram açarı qəbul edilmir.
3. Yoxlayan tərəfin kitabxanası `TrustedListProvider` interfeysi üzərindən işləyir (chain-agnostic,
   Faza 0 fayl / Faza 1 zəncir) — [[ARCH-0001]].
4. [[PM-ASSUR-0001]] sənəd sahibinin təminat səviyyəsi WUA + binding üsuluna bağlanır.

---

# Əlaqələr

- [[SPEC-CRED-0001]] — bu qərarın tam spesifikasiyası.
- [[PM-ASSUR-0001]] / [[ADR-0005]] — assurance səviyyələri (formatın daşıdığı etibar).
- [[SPEC-BC-0001]] — issuer registry + Token Status List (ləğv).
- [[SPEC-ID-0002]] — sənədi verən qurumun X.509-u (`iss`), SPEC-ID-0001 — sənəd sahibinin [[t:pseudonym|psevdonimi]] (`cnf`).
- [[PM-TRUST-0001]] — rəqəmsal sənəd heç vaxt zəncirdə saxlanmır.

Format, protokollar, imza, holder binding (məcburi) və WUA
qəbul edildi (2026-09-03). mdoc və batch sənəd vermə sonrakı fazalara həvalə edildi.
