---
document_id: ADR-0023
title: "Nüsxələrin avtomatik yenilənməsi"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Rəqəmsal cüzdan nüsxələri azalan və ya müddəti bitmək üzrə olan qurum sənədlərini istifadəçidən soruşmadan yeniləyir: OpenID4VCI yeniləmə tokeni (DPoP-a və cüzdan attestasiyasına bağlı, birdəfəlik, rotasiya edilən) ilə, qurumun elan etdiyi həddlərdə (credential_reuse_policy), tətbiq ön planda olduqda və təsadüfi gecikmə ilə. Şəxsi sahələri saxlamayan şəxsiyyət və əlaqə sənədlərində yeniləmə istifadəçi əməliyyatı olaraq qalır. SPEC-WALLET-0001/WL7 dəyişir (ARF ISSU_42, ISSU_45, ISSU_63).
domain: Wallet
translation_of: ADR-0023
source_version: "1.0.0"
---

# Kontekst

[[SPEC-WALLET-0001]]/WL7 "avtomatik yeniləmə yoxdur" deyir. Əsaslandırma: rəqəmsal cüzdan arxa planda quruma müraciət etsə, qurum sənədin nə tezlikdə
istifadə edildiyini öyrənir ([[SPEC-SCHEMA-0002]] §2.1).

Aİ [[t:ARF]] 3.0 əks istiqamətdədir: yenidən verilmə **mümkün qədər istifadəçi əməliyyatı tələb etməməlidir** (ISSU_42). Birdəfəlik paket
üsulunda cüzdan aşağı həddə çatdıqda yeni paket istəməlidir (ISSU_45). Cüzdan və qurum [[t:OpenID4VCI|OpenID4VCI-nin]] yenidən verilmə imkanlarını
dəstəkləməlidir (ISSU_63).

Tamga qurumları həddləri 2026-09-29-dan bəri metadata-da elan edir (`credential_reuse_policy`: 10 nüsxəlik paket, 2 nüsxə qaldıqda,
müddətin bitməsinə 7 gün qalmış). Layihə rəhbərliyi Aİ ilə eyni davranışı təsdiqlədi.

Məhdudiyyət: səssiz yeniləmə qurumun istifadəçidən soruşmadan yenidən imza ata bilməsini tələb edir.
- **Qurum sənədləri** (tələbə, diplom): qurum atributları öz [[t:authentic-source|səlahiyyətli mənbəsindən]] yenidən oxuyur.
- **Şəxsiyyət sənədi** ([[ADR-0011]] K4) və **əlaqə sənədləri** ([[ADR-0021]] K3): xidmət şəxsi sahələri verilmədən sonra saxlamır.
  Bunları səssizcə yeniləmək fərdi məlumatların saxlanmasını tələb edərdi. Buna görə də əhatə dairəsindən kənardır.

# Qərar

## K1 — Nə vaxt

Rəqəmsal cüzdan qurum sənədini aşağıdakı hallardan biri baş verdikdə yeniləyir:
- istifadə olunmamış nüsxələrin sayı qurumun `reissue_trigger_unused` dəyərinə endi (Tamga: 2),
- sənədin bitməsinə `reissue_trigger_lifetime_left` qədər müddət qaldı (Tamga: 7 gün).

Yeniləmə yalnız bu şərtlər birlikdə ödəndikdə aparılır: tətbiq ön planda, kilid açıq, şəbəkə mövcuddur. Hədd aşıldıqdan sonra **təsadüfi gecikmə**
(0–6 saat) gözlənilir; beləliklə, yeniləmə anı hər hansı təqdimatın anı ilə əlaqələndirilə bilməz.

## K2 — Necə: yeniləmə tokeni

- Qurum ilk verilmədə token cavabında `refresh_token` verir (OpenID4VCI 1.0, RFC 6749 §6).
- Token həmin sənəd üçün yaradılmış **[[t:DPoP]] açarına bağlıdır** (RFC 9449 §5). Cüzdan bu açarı sənədin ömrü boyu saxlayır; hər
  məntiqi sənədin açarı ayrıdır.
- Hər yeniləmədə cüzdan attestasiyası ([[t:WUA]]) yenidən təqdim olunur.
- Token birdəfəlikdir və hər istifadədə yenisi ilə əvəz olunur (rotation). Onun ömrü sənədin maksimal etibarlılıq müddətini aşmır.
- Yeniləmənin sonunda yeni paket (10 nüsxə, yeni açarlar) alınır; köhnə istifadə olunmamış nüsxələr silinir.

## K3 — Qurum nə edir

- Atributları səlahiyyətli mənbədən **yenidən oxuyur**. Dəyişmiş sahə varsa, cüzdan bunu istifadəçiyə göstərir (ARF ISSU_59).
- Mənbədə qeyd artıq yoxdursa (məzuniyyət, qeydiyyatdan çıxarılma), yeniləmə rədd edilir və token ləğv olunur.
- Yeni paketin etibarlılıq müddəti növün qaydasına uyğundur (tələbə sənədi ≤ 90 gün). Beləliklə, tələbə sənədi tələbəlik davam etdikcə
  avtomatik olaraq təzələnir.

## K4 — Əhatə dairəsindən kənar: şəxsiyyət və əlaqə sənədləri, biletlər

Şəxsiyyət və əlaqə rəqəmsal sənədləri yeniləmə tokeni almır. Onların yenilənməsi istifadəçinin əməliyyatı ilə baş verir (şəxsiyyətin və ya ünvanın yenidən
yoxlanılması — bunu yoxlayan tərəf deyil, istifadəçi başladır). Biletlər birdəfəlikdir, yenilənmir. Bu rəqəmsal sənədlərin nüsxələri azaldıqda rəqəmsal cüzdan indiki kimi xəbərdarlıq edir.

## K5 — İstifadəçi ayarı

Ayarlarda "Nüsxələri avtomatik yenilə" seçimi mövcuddur. Defolt olaraq aktivdir. Söndürüldükdə indiki davranış (xəbərdarlıq + əl ilə yeniləmə)
qüvvədə olur.

## K6 — Məxfilik balansı

Qalıq risk: qurum yeniləmə tezliyindən sənədin neçə **yeni** [[t:verifier|yoxlayan tərəfə]] göstərildiyini təxminən çıxara bilər (hər 8 yeni
yoxlayan tərəfə bir sorğu). Azaltma tədbirləri:
- eyni yoxlayan tərəfə eyni nüsxə (WL5); təkrar təqdimatlar nüsxə sərf etmir,
- təsadüfi gecikmə,
- yeniləmə sorğusu hansı yoxlayan tərəfə təqdim edildiyini ehtiva etmir,
- istifadəçi ayarı.

Bu, Aİ modeli ilə eyni balansdır. Layihə rəhbərliyi bunu qəbul etdi.

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Avtomatik yeniləmə yoxdur (WL7 olduğu kimi) | rədd | ARF ISSU_42/45 ilə ziddiyyət təşkil edir; nüsxələr bitdikdə istifadəçi yeni yoxlayan tərəfə sənəd göstərə bilmir |
| Yeni şəxsiyyət təqdimatı ilə səssiz yeniləmə | rədd | Hər yeniləmədə şəxsiyyət təqdimatı = istifadəçi təsdiqi və PIN; səssiz ola bilməz |
| Şəxsiyyət xidməti şəxsi sahələri şifrələnmiş şəkildə saxlayır | rədd | ADR-0011 K4 və məlumatların minimallaşdırılması prinsipi ilə ziddiyyət təşkil edir |
| **Yeniləmə tokeni (DPoP + WUA-ya bağlı)** | **qəbul** | OpenID4VCI-nin standart yolu; qurum səlahiyyətli mənbəyə yenidən sorğu göndərir |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| AR1 | Səssiz yeniləmə yalnız yeniləmə tokeni olan sənədlər üçün, qurumun elan etdiyi həddə, tətbiq ön planda və kilid açıq olduqda və təsadüfi gecikmə ilə aparılır. |
| AR2 | Yeniləmə tokeni sənəd verilmə əməliyyatındakı müştəri nümunəsi açarına (WIA `cnf`; [[ADR-0060]] RT1) bağlıdır, birdəfəlikdir və hər istifadədə dəyişir; hər yeniləmədə eyni nümunə açarlı cüzdan attestasiyası yoxlanılır, DPoP açarı dəyişə bilər (RT2). |
| AR3 | Qurum yeniləmə zamanı atributları səlahiyyətli mənbədən yenidən oxuyur; mənbədə qeyd yoxdursa, sənəd verilmir və token ləğv olunur. |
| AR4 | Şəxsi sahələri saxlamayan xidmətlər (şəxsiyyət, əlaqə) yeniləmə tokeni vermir. Yeganə istisna ZK nüsxəsi tokenidir ([[ADR-0044]] ZC3: şəxsi sahələr serverdə saxlanmır). |

# Nəticələr

- [[SPEC-WALLET-0001]]/WL7 yenidən ifadə olunur: "İstifadəçi əməliyyatı olmadan yeniləmə yalnız AR1–AR4 şərtləri daxilində aparılır."
- [[SPEC-PROTO-0001]]: token endpoint-i `refresh_token` ([[t:issuer|sənədi verən qurum]]); `grant_type=refresh_token` (DPoP + WUA); tokenin ləğvi.
- `apps/issuer` (operator repozitoriyası): yeniləmə tokeni anbarı (xülasə/hash şəklində), səlahiyyətli mənbədən yenidən oxuma.
- `wallet-core`: hər sənəd üçün DPoP açarı + yeniləmə tokeninin saxlanması; hədd yoxlanışı. Cüzdan: arxa planda yeniləmə, ayar,
  dəyişmiş sahə bildirişi.

# Status

**Accepted — 2026-09-29.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-WALLET-1. İcra növbədədir.

2026-10-09: AR4-ə ZK nüsxəsi tokeni istisnası əlavə edildi ([[ADR-0044]], D-ZK-2).

2026-10-22: **K2 və AR2 [[ADR-0060]] ilə dəyişdi** — bağ DPoP açarından müştəri nümunəsi açarına (WIA `cnf`) keçdi; DPoP açarı
yeniləmədə dəyişə bilər (D-PROTO-4). Seçimlər cədvəlindəki "DPoP + WUA bağlı" sətri tarixidir.
