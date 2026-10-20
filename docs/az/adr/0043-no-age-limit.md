---
document_id: ADR-0043
title: "Yaş həddi yoxdur: Aİ yanaşması"
status: Active
version: 1.0.0
created: 2026-10-08
last_updated: 2026-10-08
summary: >
  Tamga Network yaş həddi qoymur: nə şəbəkədə siyahıya alınan rəqəmsal cüzdanlar üçün, nə də şəbəkənin şəxsiyyət xidməti (şəxsiyyət sənədi) üçün. eIDAS 2.0 Avropa Rəqəmsal Şəxsiyyət Cüzdanı üçün minimum yaş nəzərdə tutmur; şəbəkə Avropa İttifaqı (Aİ) çərçivəsinə uyğun hərəkət edir. Rəqəmsal cüzdandan şəbəkədə istifadənin şərti yaş deyil, yoxlayan tərəfin şəxsiyyəti etibarlı şəxsiyyət sənədi ilə təsdiqləməsidir. Şəbəkədəki rəqəmsal cüzdanlar öz hüquqları başqa cür tələb etmədikcə eyni yanaşmanı izləyir; öz rəqəmsal sənədlərində uyğunluğu (məs. tələbə kartı) sənədi verən qurum müəyyən edir. Uşaqlar üçün valideyn razılığı axını (GDPR m. 8, Türkiyə hüququ) və şəxsiyyəti yoxlayan tərəfin (provayderin) hədləri sonrakı iş kimi qeydə alınır.
domain: Identity
translation_of: ADR-0043
source_version: "1.0.0"
---

# Qısaca

Tamga Network-da yaş həddi yoxdur. Rəqəmsal cüzdandan istifadə üçün tələb olunan yaş deyil, yoxlayan tərəfin şəxsiyyəti
etibarlı şəxsiyyət sənədi ilə təsdiqləməsidir. Rəqəmsal sənədi kimin ala biləcəyinə (məs. tələbə kartı) həmin sənədi verən qurum qərar verir.

# Kontekst

- eIDAS 2.0 (Reqlament (Aİ) 2024/1183) Avropa Rəqəmsal Şəxsiyyət Cüzdanı üçün minimum yaş nəzərdə tutmur; üzv dövlətlər cüzdanı
  öz vətəndaşlarına təqdim edir. Tamga Network Aİ çərçivəsinə uyğun hərəkət edir ([[ADR-0035]]).
- Şəbəkədə cüzdandan istifadə şəbəkənin şəxsiyyət xidmətində ([[ADR-0011]], [[SPEC-ID-0003]] §9) etibarlı şəxsiyyət sənədi ilə şəxsiyyətin
  təsdiqini tələb edir. Şəxsiyyət sənədi azyaşlı şəxslərə də verilir.
- Şəbəkənin qaydalarında, spesifikasiyalarında və çərçivə sənədlərində indiyədək yaş həddi yazılmayıb; "18 yaşdan böyüyəm"
  yalnız yoxlayan tərəfin soruşa biləcəyi məlumatdır (`age_over_18`, [[ADR-0032]]), cüzdandan istifadə şərti deyil.

# Qərar

**K1 — Şəbəkə yaş həddi qoymur.** Nə şəbəkədə siyahıya alınan rəqəmsal cüzdanlar üçün (etibar siyahısına qeydiyyat şərti kimi), nə də şəbəkənin şəxsiyyət
xidməti və onun verdiyi şəxsiyyət sənədi üçün minimum yaş yoxdur. Şərt yoxlayan tərəfin şəxsiyyəti etibarlı şəxsiyyət sənədi ilə təsdiqləməsidir.

**K2 — Şəbəkədəki cüzdanlar eyni yanaşmanı izləyir.** Şəbəkədə siyahıya alınmış cüzdanlar öz hüquqları başqa cür tələb etmədikcə yaş
həddi qoymur. Cüzdanın hüququ hədd tələb edirsə, həmin hədd o cüzdanın öz qaydasıdır; şəbəkənin qaydası sayılmır.

**K3 — Rəqəmsal sənəd növünə uyğunluğu sənədi verən qurum müəyyən edir.** Qurum öz rəqəmsal sənədini kimə verəcəyini (məs. tələbə kartını yalnız qeydiyyatda olan
tələbəyə) öz qeydlərinə əsasən müəyyən edir. Yaşdan asılı xidmət yoxlayan tərəf kimi yalnız lazım olan məlumatı tələb edir (məs.
`age_over_18`).

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| YS1 | Şəbəkə cüzdanların etibar siyahısına qeydiyyatı və şəxsiyyət xidmətinin şəxsiyyət sənədi verməsi üçün minimum yaş şərti qoymur. |
| YS2 | Rəqəmsal sənədi kimin ala biləcəyini həmin sənədi verən qurum müəyyən edir; yaşdan asılı yoxlama yoxlayan tərəfin yalnız lazım olan məlumatı tələb etməsi ilə aparılır. |

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Şəbəkə üzrə 18 yaş həddi | rədd | Aİ çərçivəsində yoxdur; tələbə, idmançı, tədbir kimi azyaşlıların da istifadə etdiyi rəqəmsal sənədləri kənarda qoyur. |
| Şəbəkə üzrə 13 və ya 16 yaş həddi | rədd | GDPR m. 8 yaş həddi deyil, razılığa əsaslanan xidmətdə valideyn razılığı qaydasıdır; həddi qoymaq şəbəkənin deyil, lazım gələrsə, hüququn işidir. |
| **Yaş həddi yoxdur; uyğunluğu sənədi verən qurum müəyyən edir** | **qəbul** | Aİ yanaşması ilə eynidir; şərt yoxlayan tərəfin şəxsiyyəti təsdiqləməsidir. |

# Nəticələr və açıq məsələlər

- Bu gün kod dəyişikliyi yoxdur: şəxsiyyət xidməti və etibar siyahısına qeydiyyat qaydaları yaşı yoxlamırdı. Şəxsiyyət rulebook-u
  ([[FW-RB-0003]] §4.3) və şəxsiyyətin təsdiqi spesifikasiyası ([[SPEC-ID-0003]] §9) bu qərara istinad edir.
- **Növbəti iş — valideyn razılığı:** GDPR m. 8 razılığa əsaslanan informasiya cəmiyyəti xidmətində 16 yaşdan kiçik uşaq üçün valideyn razılığı tələb edir (üzv
  dövlətlər bu yaşı 13-ə qədər endirə bilər). Türkiyə hüququnda KVKK xüsusi yaş müəyyən etmir; 18 yaşdan kiçiklərin fəaliyyət qabiliyyəti məhduddur.
  Şəxsiyyət xidmətinin məlumatlandırma və açıq razılıq axını üçün valideyn razılığı axını lazım ola bilər; hüquqi araşdırmadan sonra ayrıca qərarla
  baxılacaq, bu gün tətbiq edilmir.
- **Növbəti iş — provayder məhdudiyyəti:** məsafədən şəxsiyyəti təsdiqləmə provayderinin (istinad: Didit) azyaşlı şəxslər üçün öz
  məhdudiyyəti və ya şərti olub-olmadığı hələ təsdiqlənməyib; təsdiqlənəcək və lazım gələrsə, [[SPEC-ID-0003]]-yə daxil ediləcək.

# Status

**Qəbul edildi — 2026-10-08** (layihə rəhbərliyinin təsdiqi; hərfi sitat xüsusi təsdiq qeydindədir). DECISIONS: D-ID-10.
