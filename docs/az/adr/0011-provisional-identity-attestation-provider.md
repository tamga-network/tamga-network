---
document_id: ADR-0011
title: "Müvəqqəti şəxsiyyət sənədi provayderi"
status: Active
version: 1.0.0
created: 2026-09-25
last_updated: 2026-10-09
summary: >
  Dövlət tərəfindən təyin edilmiş PID Provider olmadığı müddətdə Tamga uzaqdan şəxsiyyət yoxlaması (Didit: sənəd + canlılıq yoxlaması + üz uyğunlaşdırması; gələcəkdə NFC çipinin oxunması) ilə yoxladığı şəxslərə özünün imzaladığı şəxsiyyət attestasiyası (urn:tamga:id:IdentityAttestation:1) verir. Bu, PID deyil, Tamga-nın sənədi verən qurum kimi verdiyi EAA-dır; dövlət PID-i gəldikdə onunla əvəz olunur (supersede). Qurumlar (universitet) rəqəmsal sənəd verərkən bu attestasiyanı təqdimat kimi qəbul edir və öz qeydləri ilə uyğunlaşdırır. Şəxsiyyətin sübutu inteqrasiyası universitetdə deyil, Tamga-nın şəxsiyyət xidmətindədir; Tamga bu məlumatlar üçün KVKK üzrə məlumat nəzarətçisi olur. TL8 qorunur (pid_providers[] boş), IDP3 yenidən ifadə edilir.
domain: Identity
translation_of: ADR-0011
source_version: "1.0.0"
---

# ADR-0011 — Tamga Müvəqqəti Şəxsiyyət Attestasiyası Provayderi

**Status:** **Accepted (2026-09-25).** Açıq məqamlar üzrə qərar: (1) TCKN attestasiyada seçici paylaşımla daşınır; (2) etibarlılıq müddəti 2 il;
(3) NFC ayrıca tip deyil, eyni tipdə `document_chip_verified`; (4) KVKK üzrə məlumatlandırma + açıq razılıq şəxsiyyət xidmətinin `/authorize` səhifəsində.
DECISIONS §0 **D-ID-6**; SPEC-PROTO-0001 v1.2.0, SPEC-ID-0003 v0.2.0, SPEC-TRUST-0001 v1.0.1, FW-TF-0001/FW-RB-0001 v0.1.1 eyni sessiyada.
Tətbiq: `apps/id` (operator deposu), `@tamga-network/wallet-core` authcode/directory, `@tamga-network/issuer` authcode, rəqəmsal cüzdan ekranları; testlər 11/11 + 2b səhnəsi real HTTP ilə.

# Kontekst

Türkiyədə və TDT üzvlərində [[t:eIDAS]] mənasında təyin edilmiş **[[t:PID]] Provider** (dövlətin rəqəmsal cüzdana şəxsiyyət məlumatı verən qurumu) yoxdur.
Hazırkı dizayn (D-ID-2, SPEC-ID-0003/IDP3) [[t:identity-proofing]] işini **hər qurumun öz [[t:issuer|rəqəmsal sənəd vermə xidmətində]]** həyata keçirir: tələbə portala
daxil olur, lazım gələrsə Didit orada işləyir. Bu, qurum inteqrasiyasından (OBS/portal) asılıdır və şəxs hər qurumda yenidən
yoxlanılır. Layihə rəhbərliyinin istiqaməti (2026-09-25): dövlət provayder təyin edənədək şəxsiyyət yoxlamasını **Tamga** aparır;
şəxs rəqəmsal cüzdanındakı şəxsiyyət [[t:credential|sənədi ilə]] quruma müraciət edir, qurum onu öz qeydi ilə uyğunlaşdırır və rəqəmsal sənədi verir. Tələbə sistemi QR və e-poçt
yolları seçim kimi qalır.

Bu, [[t:ARF]] üzrə **PID təqdimatı ilə [[t:EAA]] buraxılışı** modelidir (EAA Provider PID-i yoxlayıb öz qeydi ilə uyğunlaşdırır); yeganə fərq
PID-i dövlətin deyil, müvəqqəti olaraq Tamga-nın verməsidir.

# Qərar

## K1 — Rol: "Provisional Identity Attestation Provider", PID Provider deyil
- Tamga `id.tamga.network` üzərində **şəxsiyyət attestasiyası xidməti** idarə edir; [[t:trust-list|etibar siyahısında]] `issuers[]` altında
  (`category: IDENTITY`, `class: QUALIFIED` → **`class: EAA`, `assurance: I2`** [[ADR-0022]] ilə, 2026-09-29; `assurance_basis: "provisional-operator; ETSI TS 119 461 Substantial (uzaktan)
  / High (NFC)"`, `operator.status: provisional`).
- `pid_providers[]` **boş qalır** (TL8 qorunur): dövlət PID-i gəldikdə Tamga attestasiyası onunla əvəz olunur (`successor` sahəsi),
  qurumların uyğunlaşdırma kodu dəyişmir (eyni claim dəsti).
- Rəqəmsal sənədin hüquqi mətnlərdəki adı **"Tamga Şəxsiyyət Attestasiyası (müvəqqəti)"**dır; "PID" və ya "şəxsiyyət vəsiqəsi" deyilmir. Məhsul adı
  (məs. "Tamga Wallet") marketinq səviyyəsində sərbəstdir.

## K2 — Rəqəmsal sənəd tipi `urn:tamga:id:IdentityAttestation:1`
Claim dəsti EU PID Rulebook-dan (CIR 2024/2977) azaldılmış şəkildə törədilir:

| Claim | Məcburi | Seçici paylaşım | Qeyd |
|---|---|---|---|
| `given_name`, `family_name` | ✓ | ✓ | sənəddən (MRZ/OCR; NFC varsa, çipdən) |
| `birthdate` | ✓ | ✓ | (2026-10-09, [[ADR-0045]]: köhnə adı `birth_date`; mdoc-da `birth_date`) |
| `nationalities` | ✓ | ✓ | ISO 3166-1 alpha-2 massivi (2026-10-09, [[ADR-0045]]: əvvəllər tək dəyərli `nationality`) |
| `personal_administrative_number` | ✓ | ✓ | **TCKN** (TR) / milli şəxsiyyət nömrəsi — qurum uyğunlaşdırması üçün; yalnız qeydiyyatlı əhatə dairəsi olan RP-lərə açıqlanır |
| `document_type`, `document_number` (hash) | ✓ | ✓ | sənəd nömrəsi yalnız SHA-256 kimi |
| `issuing_country` | ✓ | ✓ | |
| `document_chip_verified` | ✓ | ✓ | NFC ilə yoxlanıbsa `true` (fakt; LoA deyil — PR7 qorunur) |
| `age_over_18` | ○ | ✓ | törəmə |
| `iat`, `exp` (≤ 2 il), `status` | ✓ | — | ləğv: Token Status List |

Foto/portret **daxil edilmir** (v1). [[t:holder|Sənəd sahibinin]] təminat səviyyəsi claim kimi yoxdur; tipin ilkin şərti **T2** (uzaqdan) və ya
**T3-bənzər** (NFC + canlılıq; hüquqi baxımdan T3 = NES/Mobil İmza, PM-ASSUR) səviyyəsidir. `document_chip_verified` bunu fakt kimi daşıyır.

## K3 — Şəxsiyyətin sübutu axını (rəqəmsal cüzdan tərəfindən başladılan)
1. Rəqəmsal cüzdan → `id.tamga.network` ([[t:OpenID4VCI]] **authorization code**; SPEC-PROTO-0001 v1.2): avtorizasiya səhifəsi Didit
   sessiyasını (rəqəmsal sənəd + passiv canlılıq yoxlaması + üz uyğunlaşdırması; NFC opsionaldır) açır.
2. Didit qərarı (polling `GET /v3/session/{id}/decision/` əsas; webhook `https://id.tamga.network/idv/webhook`
   ikinci dərəcəli, `status.updated`) → **Approved** olduqda attestation verilir (10 nüsxə, [[t:WUA]] məcburidir, PR11).
3. Qurumdan rəqəmsal sənədin alınması: rəqəmsal cüzdan qurumu etibar siyahısı kataloqundan seçir → sənədi verən qurumun servisi authorization code axınında
   **IdentityAttestation təqdimatı** tələb edir ([[t:OpenID4VP]], [[t:DCQL]]: `personal_administrative_number`, `given_name`, `family_name`,
   `birthdate`) → qeydiyyatla uyğunlaşdırır → rəqəmsal sənədi verir. Uyğunluq tapılmazsa, rəqəmsal sənəd verilmir; fərdi məlumatlar log-lara yazılmır (AP3/AP4).
4. Pre-authorized yollar (OBS ekranında QR, e-poçt + SMS tx_code) **olduğu kimi qalır**; qurum hər ikisini təqdim edə bilər.

## K4 — Məlumatlara görə məsuliyyət və saxlama (KVKK)
- Tamga şəxsiyyətin sübutu məlumatları üçün **məlumat nəzarətçisidir**; məlumatlandırma + açıq razılıq mətni rəqəmsal cüzdanda Didit-ə keçməzdən əvvəl göstərilir.
- Tamga-da saxlanılanlar: attestation qeydi (qeyri-şəffaf `subject_ref`, `iat/exp`, status `idx`, sənəd nömrəsinin hash-i, `document_chip_verified`,
  Didit `session_id`); **sənəd təsvirləri, selfie, MRZ xam məlumatları Tamga-da saxlanılmır** (Didit tərəfində Didit-in saxlama
  siyasəti tətbiq olunur; müqavilədə ≤ 30 gün tələb edilir). Silinmə tələbi: attestation [[t:revocation]] + qeydin silinməsi.
- FW-TF-0001 §6-ya "Şəxsiyyət Attestation Provayderi" rolu və onun vəzifələri əlavə edilir; rüblük şəffaflıq hesabatına verilmə/ləğv
  sayları daxil edilir (şəxslər göstərilmədən).
- İndiyədək istifadə olunan "Tamga heç bir fərdi məlumatı görmür" ifadəsi daraldılır: **Tamga şəxsiyyətin sübutu məlumatlarını görür; təhsil/sektor
  rəqəmsal sənədlərinin məzmununu görmür** (sənədi verən qurum servisləri qurumların özünə məxsusdur, G1).

## K5 — Təsirə məruz qalan qaydalar (yenidən ifadə)
| Qayda | Əvvəl | Sonra |
|---|---|---|
| SPEC-ID-0003/**IDP3** | IDV inteqrasiyası yalnız sənədi verən tərəfdə | IDV inteqrasiyası yalnız **Tamga şəxsiyyət attestasiyası xidmətində**; qurumların sənəd vermə xidmətləri, rəqəmsal cüzdan və yoxlayan tərəf IDV provayderi ilə əlaqə saxlamır |
| SPEC-TRUST-0001/**TL8** | Tamga PID vermir; `pid_providers[]` boş | Olduğu kimi; əlavə: Tamga şəxsiyyət attestasiyası `issuers[]` qeydidir və dövlət PID-i gəldikdə onunla əvəz olunur |
| SPEC-SCHEMA-0002 E-seriyası ("şəxsiyyət nömrəsi yoxdur") | təhsil sxemləri üçün | Dəyişmir; şəxsiyyət nömrəsi **yalnız** `IdentityAttestation` tipində və seçici paylaşımla |
| SPEC-PROTO-0001 | yalnız pre-authorized | + authorization code (v1.2); PR-yeni: qurumdan rəqəmsal sənəd alınarkən şəxsiyyət uyğunluğu IdentityAttestation təqdimatı ilə |
| PM-ASSUR-0001 əlaqələndirmə cədvəli | uzaqdan yoxlama = qurumda | uzaqdan yoxlama = Tamga attestasiyası; qurum "attestasiya təqdimatı + qeyd uyğunluğu" yolunu T2 hesab edir |

## K6 — Təhlükəsizlik hədləri
- Attestasiya buraxılışında WUA məcburidir; demoda `software` qəbul edilir (S-9/S-14), pilotda `secure_enclave`.
- Eyni sənəd nömrəsi hash-i ilə ikinci aktiv attestasiya verilmir (təkrar qeydiyyat); yenidən buraxılış köhnəsini ləğv edir.
- Qurum uyğunlaşdırması: ən azı `personal_administrative_number` + `birthdate`; ad uyğunluğu normallaşdırılır (türk hərfləri).
- Didit "In Review" → attestasiya verilmir, istifadəçiyə gözləmə bildirilir; "Declined" → 24 saat sonra yenidən cəhd; 3 rədd → manual baxış.

# Əsaslandırma
Şəxs bir dəfə yoxlanılır, hər quruma eyni attestasiya ilə müraciət edir; qurumun OBS olmadan işləməsi mümkün olur; ARF modeli (PID
təqdimatı ilə EAA buraxılışı) tam tətbiq olunur, dövlət PID-i gəldikdə yalnız imzalayan dəyişir. Bunun qiyməti: Tamga-nın məlumat nəzarətçisi
olması və şəxsiyyət nömrəsi daşıyan tipin mövcudluğu; hər ikisi K4/K2-də məhdudlaşdırılıb.

# Nəzərdən keçirilmiş alternativlər
- **A — Şəxsiyyətin sübutu hər sənədi verən qurumun öz servisində (IDP3-ün əvvəlki variantı):** Tamga məlumatları görmür, lakin qurum inteqrasiyası məcburidir və şəxs
  hər qurumda yenidən KYC-dən keçir (ayda 500 limit qurumların sayına vurulur). **Rədd edildi (2026-09-25).**
- **C — Dövlət PID-ini gözləmək:** tarix yoxdur. Keçid yolu K1-də saxlanılır.
- **B' — Attestation-da TCKN olmadan (ad + doğum tarixi):** uyğunlaşdırma qeyri-müəyyəndir (adaşlar), qurumların imtinası artır. Rədd edildi;
  TCKN seçici paylaşımla və yalnız səlahiyyətli əhatə dairəsi üçün.

# Nəticələr
- Yeni servis `apps/id` (operator repozitoriyası) (`id.tamga.network`): Didit sessiyası, qərar, webhook, OpenID4VCI ilə [[t:issuance]]
  (authorization code), attestation qeydi, [[t:status-list]]. Didit webhook hədəfi **yeganədir**: `https://id.tamga.network/idv/webhook`
  (hər qurum üçün ayrıca deyil).
- Rəqəmsal cüzdan: "Şəxsiyyətimi təsdiqlə" axını (in-app browser), qurumlar kataloqu (etibar siyahısından), qurumdan rəqəmsal sənəd alarkən attestation
  təqdimatı (qurum yoxlayan tərəf kimi çıxış edir; verilmə daxilində OpenID4VP).
- Sənədi verən qurumun servisi: authorization code + IdentityAttestation sorğusu + qeydiyyat uyğunlaşdırması; portalda tələbə girişi **ləğv olunur**
  (demo-da staff paneli qalır).
- Spec/FW yeniləmələri K5; DB-21 bu ADR-in tərkib hissəsinə çevrilir; DB-22 bağlanır.
- Demo: Didit **sandbox** (real şəxsiyyət yoxdur, GT1); təqdimatın 3-cü səhnəsi "portala giriş" → "rəqəmsal cüzdanda şəxsiyyətimi təsdiqlə + Bilgi-ni seç".

# Açıq məqamlar — qəbulla birlikdə QƏRARLAŞDIRILDI (2026-09-25)
1. `personal_administrative_number` (TCKN) attestasiyada daşınsınmı? (Təklif: bəli, seçici paylaşımla; K2.)
2. Attestasiyanın etibarlılıq müddəti: 1 il, yoxsa 2 il? (Təklif: 2 il; sənədin müddəti bitdikdə daha tez.)
3. NFC əlavə edildikdə ayrıca tip (`…:IdentityAttestation:1` + `document_chip_verified`) deyil, eyni tip — təsdiq.
4. Demoda sandbox profili "Ayşe Yılmaz" üçün saxta TCKN yaradılacaq; `students.json` buna uyğun yenilənir.
