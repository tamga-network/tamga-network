---
document_id: ADR-0029
title: "İnkişaf mərhələsində sxemlər"
status: Active
version: 1.0.0
created: 2026-09-30
last_updated: 2026-10-02
summary: >
  Beta buraxılışına qədər rəqəmsal sənəd sxemləri yerində düzəldilir: səhv və ya natamam sxem eyni versiya yolunda yenilənir, sınaq rəqəmsal sənədləri etibarsız olur və yenidən alınır. Dərc edilmiş sxemin dəyişməzliyi (SPEC-SCHEMA-0001/D1) və kiçik versiya qaydası ([[ADR-0010]] K4) beta ilə birlikdə tətbiq olunmağa başlayır. Yeganə tənzimləmə `SCHEMA_STAGE` ilə aparılır.
domain: Credentials
translation_of: ADR-0029
source_version: "1.0.0"
---

# Kontekst

[[ADR-0010]] və SPEC-SCHEMA-0001/D1-ə əsasən dərc edilmiş sxem faylı heç vaxt dəyişmir. Dəyişiklik yeni versiya yolu tələb edir; əvvəllər
verilmiş [[t:credential|rəqəmsal sənədlər]] öz versiyası ilə yoxlanılmağa davam edir. Bu qayda real istifadəçilərin əlində rəqəmsal sənəd olduqda
keçərlidir.

Tamga bu gün inkişaf mərhələsindədir:

- Tətbiqdən və saytdan istifadə edən real şəxs yoxdur.
- Dövlətlər rəsmi olaraq sistemdə deyil; Avropa İttifaqında (Aİ) bu struktur üzv dövlətlər üçün məcburidir, Türkiyədə isə hələ belə deyil.
- Sxemlər düzgün variant tapılana qədər dəyişəcək (məs., Aİ təhsil kataloquna əsasən əlavə edilən sahələr).

Bu mərhələdə versiya keçidlərini daşımaq iş yükü və qarışıqlıq yaradır. Layihə rəhbərliyi sxemlər səhvdirsə, onların birbaşa düzəldilməsini və
versiya və ya qeydiyyat sisteminə müəyyən yetkinlik səviyyəsinə (beta) çatdıqdan sonra keçilməsini tələb etdi.

# Qərar

## K1 — İnkişaf mərhələsi

`SCHEMA_STAGE = "development"` olduqda (`packages/schemas`):

- Sxem tərifi eyni versiya yolunda (məs., `1.0.0`) düzəldilir. Kompilyator dəyişən faylın üzərinə yazır və xəbərdarlıq çıxarır.
- Yeni versiya yolu açılmır. [[t:trust-list|Etibar siyahısında]] hər növ üçün yalnız bir etibarlı heş olur.
- Əvvəlki heşlə verilmiş sınaq rəqəmsal sənədləri yoxlama zamanı rədd edilir və yenidən alınır.
- Uyğunluğu pozan dəyişiklik (sahə adı, məna) də yerində edilə bilər. [[t:vct]] URN-i yalnız növ həqiqətən başqa bir şeyə çevrildikdə
  dəyişir.

## K2 — Beta ilə keçid

Beta buraxılışında `SCHEMA_STAGE = "stable"` edilir. Həmin andan etibarən:

- SPEC-SCHEMA-0001/D1 (dərc edilmiş sxem dəyişmir),
- kiçik versiya qaydası ([[ADR-0010]] K4: eyni `vct`, yeni metadata versiyası, əvvəlki heşlər etibarlı qalır; etibar siyahısında
  `content_hashes` — oxuma tərəfi hazırdır).

Mərhələnin dəyişdirilməsi STATUS və DECISIONS-da qeyd olunur.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| DS1 | `SCHEMA_STAGE = "development"` yalnız real istifadəçiyə rəqəmsal sənəd verilməyən mərhələdə istifadə olunur; ilk real qurum və ya şəxs rəqəmsal sənədindən əvvəl `stable` edilir. |

# Status

**Accepted — 2026-09-30.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-SCHEMA-5.
