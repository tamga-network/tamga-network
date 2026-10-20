---
document_id: ADR-0021
title: "E-poçt və telefon rəqəmsal sənədləri"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Tamga şəxsiyyət xidməti sahibliyi birdəfəlik kodla sübut edilən e-poçt ünvanı və telefon nömrəsi üçün iki yeni rəqəmsal sənəd növü verir: `urn:tamga:contact:EmailAddress:1` və `urn:tamga:contact:PhoneNumber:1`. Kvalifikasiyalı olmayan EAA; yalnız SD-JWT VC; bir şəxs bir neçə ünvan əlavə edə bilər; Tamga ünvanı verildikdən sonra saxlamır. Göndərmə provayderləri parametrlə seçilir; parametr təyin edilməyibsə, növ elan edilmir.
domain: Credentials
translation_of: ADR-0021
source_version: "1.0.0"
---

# Kontekst

Bu gün saytlar və qurumlar şəxsin e-poçt ünvanını və ya telefon nömrəsini öz kodlarını göndərməklə yoxlayır: hər sayt ayrıca
SMS/e-poçt xərci ödəyir, şəxs isə hər qeydiyyatda eyni kodu gözləyir. Tamga Wallet-da bu sübut bir dəfə alınıb saxlanıla bilər; sayt
kod göndərmək əvəzinə rəqəmsal sənədi tələb edir ([[ADR-0011]] ilə eyni "bir dəfə yoxla, hər yerdə istifadə et" prinsipi).

**Aİ çərçivəsi (araşdırma, 2026-09-29).** [[t:eIDAS]] 2.0 və EUDI [[t:ARF]] e-poçt və ya telefon üçün ayrıca [[t:PID]] sahəsi və ya müəyyən edilmiş
[[t:attestation]] növü nəzərdə tutmur; bu cür məlumatlar kvalifikasiyalı olmayan elektron attestasiya ([[t:EAA]]) kimi istənilən provayder
tərəfindən verilə bilər. Brauzer dünyasında oxşar iş davam edir (e-poçt yoxlama protokolu layihəsi: e-poçt
provayderinin imzaladığı SD-JWT ilə ünvan sübutu). Bu qərar həmin işlə ziddiyyət təşkil etmir; format baxımından [[t:SD-JWT-VC]] ilə eyni yoldadır.

# Qərar

## K1 — İki rəqəmsal sənəd növü

| vct | Claim | Format |
|---|---|---|
| `urn:tamga:contact:EmailAddress:1` | `email` (kiçik hərflərə çevrilmiş) | selective disclosure |
| `urn:tamga:contact:PhoneNumber:1` | `phone_number` (E.164, məs. `+905321234567`) | selective disclosure |

Yeni [[t:vct]] sahə adı: `contact` ([[ADR-0010]] URN formatı). Metadata katalogdadır, `#integrity` məcburidir; müddət 1 il, [[t:status-list]] mövcuddur.
Bir şəxs bir neçə ünvan əlavə edə bilər; hər ünvan ayrıca rəqəmsal sənəddir.

## K2 — Sahiblik sübutu: birdəfəlik kod

Axın şəxsiyyət sənədi ilə eynidir ([[t:OpenID4VCI]] authorization code + [[t:PAR]] + PKCE + [[t:WUA]]): rəqəmsal cüzdan brauzerdə Tamga şəxsiyyət xidmətini
açır, şəxs ünvanı daxil edir, 6 rəqəmli kod e-poçt və ya SMS ilə göndərilir, düzgün kod daxil edildikdə rəqəmsal sənəd verilir.

- Kod 10 dəqiqə etibarlıdır, ən çox 5 cəhd; hər axın üçün ən çox 3 göndərmə, hər ünvan üçün saatda ən çox 5 göndərmə.
- Kod yaddaşda yalnız heş şəklində saxlanılır; müqayisə sabit müddətlidir.
- [[t:identity-proofing]] tələb olunmur: rəqəmsal sənəd yalnız "bu ünvan bu cüzdanın sahibinin nəzarətində idi" deyir, şəxsin kim olduğunu bildirmir.

## K3 — Məlumatlar və jurnal

- Ünvan yalnız axın müddətində yaddaşda saxlanılır; rəqəmsal sənəd verildikdən sonra silinir. Verilənlər bazasına yalnız ünvanın açarlı
  heşi yazılır (eyni ünvan yenidən sübut edildikdə köhnə sənəd ləğv edilir).
- Jurnala ünvan, nömrə və ya kod yazılmır (hətta maskalanmış şəkildə də). Ekranda ünvan yalnız maskalanmış şəkildə göstərilir.

## K4 — Format və kateqoriya

Yalnız SD-JWT VC; [[t:mdoc]] təqdimatı verilmir ([[ADR-0013]] şəxsiyyət sənədinə məxsusdur). `category` claim-i yoxdur: rəqəmsal sənəd kvalifikasiyalı
deyil və dövlət qurumunun attestasiyası deyil.

## K5 — Göndərmə provayderləri

Provayder parametrlə seçilir; heç biri təyin edilməyibsə, növ metadata-da elan edilmir və sorğu rədd edilir.

| Kanal | Seçim | Status |
|---|---|---|
| E-poçt | HTTP e-poçt API-si (`resend`) | test və pilot |
| SMS | `email-relay` — SMS mətni test gələnlər qutusuna e-poçtla | **yalnız test** |
| SMS | yerli SMS provayderi (`netgsm`, təsdiqlənmiş göndərən adı) | kod hazırdır, pilotdan əvvəl aktivləşdirilmir |
| Hər ikisi | `log` — kod konsola | yalnız lokal inkişaf; canlı mühitdə başlatma xətası |

# Nəzərdən keçirilən variantlar

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Ünvanı şəxsiyyət sənədinə əlavə etmək | rədd | Şəxsiyyət sənədi şəxsiyyətin sübutuna bağlıdır; ünvan tez-tez dəyişir, bir neçə ola bilər |
| Bir sənəddə e-poçt + telefon | rədd | Ayrı sübutlar, ayrı həyat dövrü; şəxs yalnız birini göstərə bilməlidir |
| Şəxsiyyətin yoxlanılmasını ilkin şərt etmək | rədd | Lazımsız məlumat; sahiblik sübutu şəxsiyyətdən asılı deyil |
| Kodu rəqəmsal cüzdanda daxil etmək | sonraya | Brauzer axını şəxsiyyət sənədi ilə ortaqdır; tətbiqdaxili ekran məhsul mərhələsində |

# İnvariantlar

| Kod | Qayda |
|---|---|
| CT1 | Əlaqə sənədi yalnız kod düzgün daxil edildikdən sonra verilir; kod birdəfəlik, müddətli və cəhd sayı məhduddur. |
| CT2 | Ünvan, nömrə və kod jurnala, hadisə qeydinə və ya verilənlər bazasına açıq şəkildə yazılmır; yalnız açarlı heş saxlanılır. |
| CT3 | Əlaqə sənədi şəxsiyyət məlumatı (ad, TCKN, doğum tarixi) daşımır və `category` claim-i ehtiva etmir. |
| CT4 | Test göndərmə yolları (`log`, `email-relay`) real istifadəçilərə açıq mühitdə istifadə edilmir. |

# Nəticələr

- `packages/schemas`: iki növ (EmailAddress 1.0.0, PhoneNumber 1.0.0). Etibar siyahısı: Tamga şəxsiyyət xidməti hər iki növ üçün səlahiyyətlidir.
- `apps/id` (operator repozitoriyası): ünvan və kod ekranları (ingilis / türk dilində), göndərmə provayderləri, limitlər; parametrlər
  `TAMGA_CONTACT_*`, `TAMGA_RESEND_API_KEY`, `TAMGA_NETGSM_*`.
- Rəqəmsal cüzdan: Rəqəmsal sənədlər → "Rəqəmsal sənəd əlavə et" menyusunda yoxlanılmış e-poçt / telefon əlavə edilir (yoxlayan tərəf üçün təqdim olunur); rəqəmsal sənəd adları və sahə etiketləri lüğətdədir.
- Qurum ADR-i (səlahiyyətli mənbə qurumdadır, [[ADR-0020]]) təklif e-məktubunu qurumun göndərməsini nəzərdə tutur; əlaqə
  rəqəmsal sənədi qurumun şəxslə əlaqə saxlayacağı ünvanı şəxsin özünün təqdim etməsini təmin edir.

# Status

**Accepted — 2026-09-29.** Adlar və əhatə dairəsi layihə rəhbərliyi tərəfindən təsdiqləndi. DECISIONS: D-CONTACT-1.
