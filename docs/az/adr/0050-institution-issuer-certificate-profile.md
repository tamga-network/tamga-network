---
document_id: ADR-0050
title: "Sənədi verən qurumun sertifikat profili"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  Sənədi verən qurumların (şəxsiyyət xidməti daxil olmaqla) sənəd imza və ləğv siyahısı imza sertifikatları ETSI TS 119 412-6 V1.2.1 və EN 319 412-3-ə uyğun tərtib edilir: subyekt sahəsində qurumun identifikasiya nömrəsi (`organizationIdentifier`, qeydiyyat sertifikatının `sub` atributu ilə eyni), qurumun rəsmi adı və ölkə; açar istifadəsi kritik və yeganə növlüdür (yalnız `digitalSignature`); subyekt və orqan açar identifikatorları (SKI, AKI) məcburidir; AIA qeyri-kvalifikasiyalı EAA-da tələb olunmur. Sandbox sertifikatları eyni açarla yenidən imzalanır; real şəbəkənin sertifikatları qurumun identifikasiya nömrəsi qeydiyyata daxil edildikdə yenilənir. D-ID-5-in (SPEC-ID-0002) sertifikat təfərrüatını dəyişir. Qəbul: 2026-10-13.
domain: Identity
related: ["[[ADR-0004]]", "[[ADR-0026]]", "[[ADR-0022]]", "[[ADR-0038]]", "[[ADR-0041]]", "[[SPEC-ID-0002]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0050
source_version: "1.0.0"
---

# Qısaca

Qurumun rəqəmsal sənədləri imzaladığı sertifikat həmin qurumu Avropa İttifaqının (Aİ) gözlədiyi şəkildə təqdim etməlidir: qurumun vergi və ya reyestr nömrəsi
sertifikatın daxilində yer alır və qeydiyyat sertifikatındakı nömrə ilə eynidir. Bu qərar qurum sertifikatlarında hansı sahələrin məcburi
olduğunu müəyyən edir.

# Kontekst

- **Aİ qaydası.** ETSI TS 119 412-6 V1.2.1 (2026-04) PID, rəqəmsal cüzdan və EAA provayderlərinin sertifikat profilini müəyyən edir. Sertifikatın
  subyekti hüquqi şəxsdirsə, EN 319 412-3 §4.2.1 tətbiq olunur: `organizationIdentifier` (OID 2.5.4.97, EN 319 412-1 semantik identifikator),
  `organizationName`, `countryName` (PID-4.3-02). Açar istifadəsi genişlənməsi məcburidir və EN 319 412-2 Cədvəl 1-dəki növlərdən
  **dəqiq biri** olmalıdır (PID-4.4.1-01; ISO/IEC 18013-5 sənəd imza sertifikatı üçün yalnız `digitalSignature`). SKI
  məcburidir (PID-4.4.2-01); özünü imzalamayan sertifikatda AIA gözlənilir (PID-4.4.3-01) — qeyri-kvalifikasiyalı EAA üçün EN
  319 412-2-yə həvalə edilib, kvalifikasiyalı və dövlət EAA-sında məcburidir.
- **Bu gün.** Tamga-nın qurum sertifikatları P-256/ES256, SKI və (yeni yaradılanlarda) AKI daşıyır; subyekt sahəsi `CN, OU, O, C` şəklindədir,
  **qurumun identifikasiya nömrəsi yoxdur**. Qeydiyyat sertifikatı (WRPRC) isə qurumu `sub` = `VATTR-<VKN>` ilə təqdim edir ([[ADR-0026]] K2);
  giriş sertifikatlarında bu nömrə 2026-10-09-dan bəri mövcuddur ([[ADR-0026]] K3). Sənədi verən qurumun sertifikatında olmadığı üçün Aİ
  tərəfindəki yoxlayan tərəf sənədi imzalayan qurumu qeydiyyat məlumatları ilə uyğunlaşdıra bilmir.
- **D-ID-5** ([[SPEC-ID-0002]]) sertifikat iyerarxiyasını və yoxlamanı müəyyən edir, lakin subyekt sahəsini və genişlənmə profilini müəyyən etmir.
- Kitabxana qeydində bu məsələ KA-412-6-1 adı ilə açıq idi; ilk Aİ uyğunluq turu (2026-10-13) onu "serverdən əvvəl sertifikat profilləri"
  paketinə daxil etdi, layihə rəhbərliyi həmin gün qəbul etdi.

# Qərar

## K1 — Əhatə dairəsi

Profil etibar siyahısında `issuers[]` qeydi olan hər bir sənədi verən qurumun aşağıdakı sertifikatlarına tətbiq olunur: sənəd imza sertifikatı (`cert`) və
ləğv siyahısı imza sertifikatı (`status_cert`, `delegate_keys[]` `purpose: "status_list"`). Şəxsiyyət xidməti də sənədi verən qurum kimi
bu profilə əməl edir. Giriş sertifikatları ([[ADR-0026]] K3), siyahı imza, qeydiyyat vahidi və cüzdan provayderi sertifikatları öz
qərarlarında tənzimlənir.

## K2 — Profil

| Sahə | Qayda |
|---|---|
| Subyekt | `organizationIdentifier` (2.5.4.97) **MUST**: qeydiyyat sertifikatının `sub` atributu ilə eyni semantik identifikator (`TR-VKN` → `VATTR-<numara>`, `TR-MERSIS` → `NTRTR-<numara>`, LEI → `LEIXG-<kod>`; [[ADR-0026]] K2). `organizationName` (`O`) **MUST**: qurumun rəsmi adı (qeydiyyatdakı `legal_name`; latın hərfləri ilə yazıla bilər). `countryName` (`C`) **MUST**. `commonName` (`CN`) və `organizationalUnitName` (`OU`) ixtiyaridir (məs. "Status List") |
| Açar istifadəsi | Kritik; yalnız `digitalSignature` (EN 319 412-2 Cədvəl 1-dən tək növ; mdoc sənəd imza sertifikatı ilə uyğun növ). Başqa bit **MUST NOT** |
| Əsas məhdudiyyətlər | Kritik, `cA = false` |
| SKI | **MUST** (RFC 5280 §4.2.1.2) |
| AKI | **MUST** = imzalayan orqanın (kök və ya aralıq sertifikat orqanı) SKI-si; HAIP `trusted_authorities` (`aki`) uyğunlaşdırması buna əsaslanır |
| AIA `caIssuers` | Qeyri-kvalifikasiyalı EAA-da (bu gün şəbəkədəki bütün sənədi verən qurumlar, [[ADR-0022]]) tələb olunmur: zəncir sənədin `x5c` sahəsində, kök isə etibar siyahısındadır. Kvalifikasiyalı və ya dövlət sinfi (QEAA, PuB-EAA; QcStatements daxil olmaqla) ayrıca qərarla açılır |
| Alqoritm | P-256, ECDSA SHA-256 (dəyişməyib) |
| Müddət | Ən çoxu 3 il (bu gün 2 il; dəyişməyib) |

## K3 — Keçid

- **Sandbox** ([[ADR-0038]]): nümunə qurumların və sandbox şəxsiyyət xidmətinin sertifikatları **eyni açarla yenidən imzalanır**
  (`gen-pki --profile=sandbox --reissue=…`); yeni seriya nömrəsi, yeni barmaq izi, deməli, yeni `issuer_id`. Kök və siyahı
  imzalayıcısı dəyişmir, rəqəmsal cüzdandakı sandbox sabitləməsi eyni qalır. Sandbox hər gecə sıfırlandığından köhnə sınaq sənədlərinin
  etibarsız olması qəbul edilir.
- **Sandbox test qurumları** ([[ADR-0041]]): siyahı naşirinin verdiyi yarpaq sertifikatlarına `organizationIdentifier` əlavə edilməsi
  paketlərin növbəti versiyasında olacaq (siyahı naşiri).
- **Real şəbəkə:** qurum sertifikatı qurumun identifikasiya nömrəsi qeydiyyata daxil edilərkən verilir (`pki-issue --prod --org-id`; qurum sertifikatı
  üçün `--org-id` məcburidir). Bugünkü qeydlərdə nömrəsi olmayan sənədi verən qurum (şəxsiyyət xidməti) üçün: nömrə qeydiyyata daxil edildikdə yeni açar
  və sertifikat verilir, yeni sertifikat qeydə əlavə olunur, köhnə sertifikat üst-üstə düşmə müddətində yalnız köhnə sənədləri yoxlamaq üçün qalır
  ([[SPEC-ID-0002]] §4 və [[ADR-0004]] yeniləmə modeli; XC2). Real şəbəkənin PKI-si repozitoriyadan kənardadır; əməliyyat operatorun sənədləşdirdiyi
  prosedurla həyata keçirilir.
- **İnkişaf PKI-si** dəyişmir (lokal, təsadüfi; [[ADR-0026]] K3-dəki kimi identifikasiya nömrəsi daşımır).

## K4 — Nəzarət

Siyahı naşiri nəşr zamanı sənədi verən qurumun sertifikatındakı `organizationIdentifier` atributunu qeydiyyatdakı identifikasiya nömrəsi ilə müqayisə edir; çatışmırsa
və ya fərqlidirsə, xəbərdarlıq edir (real şəbəkədə nəşr bloklanmır; identifikasiya nömrəsi olmayan qeyd üçün qeydiyyat sertifikatı onsuz da yaradılmır,
[[ADR-0026]] K2). Xəbərdarlığın xətaya çevrilməsi real şəbəkədəki bütün sertifikatlar yeniləndikdən sonra ayrıca qərarla həyata keçirilir.

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| İdentifikasiya nömrəsini yalnız etibar siyahısında saxlamaq | rədd | Aİ-nin yoxlayan tərəfi və 412-6 sertifikatın özünə baxır; siyahıdan kənar alətlər qurumu tanıya bilmir |
| Açar istifadəsində `nonRepudiation` (məzmuna bağlılıq növü) | rədd | Sənəd imzası qurumun bəyanatıdır, lakin mdoc sənəd imza sertifikatı yalnız `digitalSignature` tələb edir; hər iki format eyni sertifikatdan istifadə edir |
| AIA-nı bu gündən məcburi etmək | rədd (bu gün) | Qeyri-kvalifikasiyalı EAA-da tələb olunmur; nəşr nöqtəsini idarə etmək lazım gəlir. Kvalifikasiyalı siniflə birlikdə gələcək |
| Sandbox-da yeni açar yaratmaq | rədd | Serverdəki açar paketi dəyişərdi; eyni açarla yenidən imzalamaq kifayətdir |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| CP1 | Sənədi verən qurumun sənəd və ləğv siyahısı imza sertifikatı subyekt sahəsində qeydiyyat sertifikatının `sub` atributu ilə eyni olan `organizationIdentifier` atributunu, qurumun rəsmi adını (`O`) və ölkəsini (`C`) daşıyır. |
| CP2 | Qurum sertifikatında açar istifadəsi kritikdir və yalnız `digitalSignature` bitindən ibarətdir; SKI və AKI məcburidir. |

# Nəticələr

- [[SPEC-ID-0002]] §1.1 (yeni): qurum sertifikat profili; XC6.
- `ops/gen-pki.ts`: sandbox qurum və şəxsiyyət xidməti sertifikatlarının subyekt adlarında `organizationIdentifier`; yenidən imzalama
  (`--reissue`). `ops/pki-issue.ts`: AKI; `--prod` qurum sertifikatında `--org-id` məcburidir.
- Siyahı naşiri (paketlərin növbəti versiyası): K4 nəzarəti; sandbox test qurumu yarpaqlarında `organizationIdentifier`.
- Operator: real şəbəkə şəxsiyyət xidmətinin sertifikatı qurumun identifikasiya nömrəsi qeydiyyata daxil edildikdə yenilənir (prosedur operator sənədindədir).

# Status

**Accepted — 2026-10-13.** Layihə rəhbərliyinin təsdiqi ilə (ilk Aİ uyğunluq turu, paket 2 və qərar 16). DECISIONS: D-ID-12. D-ID-5-in sertifikat
təfərrüatını dəyişir.
