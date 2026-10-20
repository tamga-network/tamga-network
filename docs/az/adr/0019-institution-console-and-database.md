---
document_id: ADR-0019
title: "Qurum Konsolu"
status: Active
version: 1.0.0
created: 2026-09-28
last_updated: 2026-10-07
summary: >
  Yerləşdirilən xidmətlərin qurum tərəfi vahid Qurum Konsolunda toplanır (console.tamga.network): qurum əməkdaşları dəvətlə hesab açır və passkey ilə daxil olur; verilmiş rəqəmsal sənədlər, ləğv/dayandırma, reyestr (məs. tələbələr), API açarları, istifadəçilər və qurumun qeydi buradan idarə olunur. Tələbəyə yönəlmiş "sənədimi rəqəmsal cüzdanıma əlavə et" portalı ləğv edilir — şəxs sənədi rəqəmsal cüzdandan tələb edir. Operator məlumatları JSON fayllarından PostgreSQL-ə köçürülür. D-NAME-1-dəki portal.tamga.network sətrini dəyişir.
domain: Services
translation_of: ADR-0019
source_version: "1.0.0"
---

# Kontekst

Siyahı mərhələsində Tamga [[t:issuer|sənədi verən]] qurumlar adından sənəd vermə xidmətini yerləşdirir ([[ADR-0016]]). Bu gün qurum tərəfi `portal.tamga.network/{slug}`
eyni anda iki işi görür: (1) tələbə üçün "sənədimi rəqəmsal cüzdanıma əlavə et" səhifəsi — qurumun öz tələbə məlumat sisteminin imitasiyası; (2)
tələbə işləri paneli (verilmiş sənədlər, ləğv). Məlumatlar serverdə JSON fayllarındadır (`data/<kurum>/state.json`,
`students.json`, `tickets.json`, `api-keys.json`); qurum öz məlumatlarını yeniləyə bilmir, giriş vahid ümumi parol ilədir.

Şəxs sənədini onsuz da rəqəmsal cüzdandan tələb edir ([[ADR-0011]] K3: qurumu axtar → şəxsiyyət sənədi ilə uyğunlaşdırma → sənəd). Tələbə üçün ayrıca
veb səhifə lazımsızdır və konsepsiya xətasıdır. Qurumun ehtiyacı isə real idarəetmə məkanıdır: müqavilə imzalandığı gün istifadəyə
başlaya biləcəyi, əməkdaşlarının ayrı hesablarla daxil olduğu, məlumatlarını özünün yenilədiyi konsol.

# Qərar

## K1 — Qurum Konsolu

Yerləşdirilən xidmətlərin qurum tərəfi **Qurum Konsoludur** (ingiliscə "Institution Console"), ünvan
`console.tamga.network`. Qurumun roluna görə bölmələr:

| Bölmə | Kim | Məzmun |
|---|---|---|
| Sənədlər | sənədi verən qurum | verilmiş sənədlər (növ, tarix, nüsxə sayı), ləğv / dayandırma / geri qaytarma, yerində təklif (QR + PIN) |
| Reyestr (məs. Tələbələr) | sənədi verən qurum | qurumun uyğunlaşdırma qeydləri: əlavə et, redaktə et, sil. **Nümunə reyestr** kimi işarələnir: qurumun öz sistemi qoşulana qədər istifadə olunur |
| Biletlər / tədbirlər | bilet satıcısı | satışlar, tədbirlər |
| API açarları | sənədi verən qurum | yarat (bir dəfə göstərilir), ləğv et, əhatə dairəsi və müddət ([[ADR-0016]]) |
| İstifadəçilər | qurum administratoru | əməkdaşların dəvəti, rol (administrator / əməkdaş), silmə |
| Qurumun qeydi | hamı | etibar siyahısındakı qeyd: səlahiyyətli sənəd növləri, status, sertifikatın barmaq izi (yalnız oxumaq üçün) |

[[t:verifier]] statistikası (keçid məntəqələrindən keçidlərin sayı; fərdi məlumatlar yoxdur) konsola növbəti mərhələdə əlavə olunur.

## K2 — Giriş: dəvət + passkey

- Operator qurumun ilk administratoru üçün **birdəfəlik dəvət keçidi** yaradır (72 saat). Administrator keçidi açır, cihazında
  **passkey** təyin edir (Face ID / Windows Hello / barmaq izi). Parol yoxdur; e-poçt serveri tələb olunmur.
- Administrator öz əməkdaşlarını eyni üsulla dəvət edir. İstifadəçi bir quruma bağlıdır; başqa qurumun məlumatlarını görə bilməz.
- Sessiya server tərəfində saxlanılır (≤ 8 saat, `HttpOnly`, `Secure`, `SameSite=Lax`); vəziyyəti dəyişən sorğular eyni sayt mənşəli
  olmalıdır.
- Qurumun öz şəxsiyyət provayderi ilə giriş (SSO) sonraya saxlanılır.

## K3 — Tələbə portalı ləğv edilir

`portal.tamga.network` və tələbəyə yönəlmiş "sənədimi rəqəmsal cüzdanıma əlavə et" səhifəsi ləğv edilir. Şəxs sənədi **rəqəmsal cüzdandan** tələb edir; uyğunlaşdırma
konsoldakı reyestrə əsasən aparılır. Yerində üzbəüz sənəd verilməsi lazım olarsa, əməkdaş konsoldan təklif (QR + PIN) yaradır.

## K4 — Operator verilənlər bazası: PostgreSQL

Yerləşdirilən xidmətlərin daimi məlumatları **PostgreSQL**-dədir: qurumlar, reyestr, verilmiş sənədlər, ləğv siyahısının vəziyyəti,
hadisə jurnalı, biletlər, API açarlarının heşləri, konsol istifadəçiləri / passkey-lər / dəvətlər / sessiyalar. Qısamüddətli protokol
vəziyyəti (təklif, [[t:PAR]], giriş tokeni, [[t:nonce]] — dəqiqələr) xidmətin yaddaşında qalır. Lokal inkişaf və testlər eyni SQL-i daxili
PostgreSQL (PGlite) ilə icra edir; canlı mühitdə `DATABASE_URL`. Verilənlər bazası fərdi məlumatları yalnız reyestrdə saxlayır (qurumun
öz məlumatları, qurum adından); jurnallarda fərdi məlumatlar olmur (AP3/AP4 olduğu kimi).

## K5 — Domen adı

D-NAME-1 v1.2: `portal.tamga.network/{slug}` → **`console.tamga.network`** (qurum sessiyadan müəyyən edilir, yolda slug yoxdur).

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Portalı olduğu kimi saxlamaq | rədd | Tələbə səhifəsi rəqəmsal cüzdan axını ilə toqquşur; qurum öz məlumatlarını idarə edə bilmir |
| SQLite | rədd | Tək fayl, quraşdırılması sadədir; çoxlu qurum və eyni vaxtda yazma, ehtiyat nüsxə və böyümə üçün PostgreSQL |
| E-poçt + parol + kod | rədd | Parol oğurlana bilər; e-poçt xidməti tələb olunur |
| Qurum SSO | sonraya | Hər qurum üçün ayrıca tənzimləmə; pilotdan sonra |
| `portal.` adını saxlamaq / `kurum.` | rədd | Layihə rəhbərliyi `console.tamga.network`-ni seçdi |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| KC1 | Konsol istifadəçisi yalnız bağlı olduğu qurumun məlumatlarını görür və dəyişir. |
| KC2 | Konsola giriş passkey iləndir; parol saxlanılmır. Dəvət birdəfəlik və müddətlidir; yalnız onun heşi saxlanılır. |
| KC3 | Konsol və verilənlər bazası jurnallarında fərdi məlumatlar, claim dəyərləri, status `idx` olmur; reyestr fərdi məlumatları yalnız qurum adından uyğunlaşdırma üçün saxlayır. |
| KC4 | Reyestr "nümunə reyestr" kimi işarələnir; qurumun öz sistemi (API və ya mənbə bağlantısı) qoşulduqda yerini ona verir. |

# Nəticələr

- operator reposu: `apps/console` (portalın əvəzinə), `shared/db` (PostgreSQL / PGlite, versiyalı sxem), sənədi verən qurumun daimi məlumatları
  verilənlər bazasındadır; JSON faylları yalnız ilkin yükləmə (seed) üçündür.
- `ops`: PostgreSQL quraşdırılması, `console.tamga.network` nginx bloku + sertifikat adı, `DATABASE_URL`, dəvət əmri.
- D-NAME-1 → v1.2 (DECISIONS "Dəyişdirilmiş Qərarlar"); operatorun daxili qeydi.
- Şəxsiyyət xidməti (`apps/id`) məlumatlarının köçürülməsi və yoxlayan tərəf statistikası növbəti mərhələdir.

# Status

**Accepted — 2026-09-28.** Seçilən: PostgreSQL, dəvət + passkey, `console.tamga.network`. DECISIONS: D-CONSOLE-1.

**Tətbiq qeydi (2026-09-28).** Şəxsiyyət xidmətinin daimi məlumatları da verilənlər bazasındadır; axın vəziyyəti və şəxsi sahələr yalnız
yaddaşdadır (diskə heç vaxt yazılmır). Konsola **Keçid məntəqələri** bölməsi əlavə edildi: qurumun keçid məntəqəsi qruplarında gün üzrə keçid / rədd / səbəb —
yalnız say; şəxs, kart identifikatoru, vaxt saxlanılmır (yoxlayan tərəf `/stats/gates`, daxili şəbəkə).
