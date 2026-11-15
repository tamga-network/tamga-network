---
document_id: ADR-0084
title: "Siyahı mənbədir, zəncir şahiddir"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Şəbəkənin etibar mənbəyinin istiqamətini bütün zəncir mərhələləri üçün sabitləyir: imzalı etibar siyahıları və lövbər jurnalı
  yeganə və əsas mənbədir (AB etibar siyahısı modeli); zəncir şahiddir — siyahını qeyd edir, istəyən yoxlayan tərəf onunla çarpaz
  yoxlama aparır, lakin heç bir yoxlama qərarı zəncirdən verilmir. Zəncir dayanarsa siyahılar, yoxlama və cüzdanlar təsirlənmir;
  zəncir ilə siyahı arasındakı hər fərq həyəcan siqnalı yaradır. ADR-0051-in "zəncir mərhələsində siyahılar zəncirin proyeksiyası
  kimi dərc edilir" müddəası bu istiqamətdə dəyişir; ADR-0073-ün ayrıca qərara buraxdığı sual bağlanır. Zəncir kodu söndürülmüş
  halda tamamlanır; hələlik server və yoxlayıcı qovşaq qurulmur; keçid ardıcıllığı əvvəl test şəbəkəsi, sonra real şəbəkədir. Qəbul
  edildi (2026-11-15).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0015]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[ADR-0085]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[FW-ARF-0001]]", "[[ARCH-0002]]"]
translation_of: ADR-0084
source_version: 1.0.0
---

# Qısaca

Tamga Network-də bir sənədə etibar edilib-edilməyəcəyinə bu gün imzalı etibar siyahılarına baxılaraq qərar verilir; Avropa
İttifaqının etibar siyahıları da belə işləyir. Bu qərar həmin qaydanın zəncir gəldikdən sonra da dəyişməyəcəyini bildirir:
siyahılar yeganə və əsas mənbə olaraq qalır, zəncir onların **şahididir**. Zəncir siyahıda nəyin dərc edildiyini qeyd edir; istəyən
siyahını onunla müqayisə edir. Zəncir dayanarsa və ya geri qalarsa heç bir sənədin yoxlanması təsirlənmir. Zəncir kodu
tamamlanır, lakin söndürülmüş qalır; hələlik server qurulmur; zəncirə keçərkən əvvəl test şəbəkəsi, sonra real şəbəkə gəlir.

# Kontekst

- [[ADR-0009]] zənciri ikinci müstəqil operatorun yazılı razılığına bağladı (K4); o günə qədər etibar lövbəri imzalı siyahılar və
  lövbər jurnalıdır. [[ADR-0051]] zəncir kodunu bu gündən yazdırdı və zənciri siyahıların proyeksiyası etdi (CH1: ziddiyyətdə siyahı
  üstündür, zəncirin cavabı yoxlama üçün lazım deyil). [[ADR-0074]] proyeksiyanın əhatəsini siyahılardakı bütün etibar qeydlərinə
  genişləndirdi (PJ1: siyahı mənbə olaraq qalır). [[ADR-0073]] tarixçənin zəncirə bir dəfə köçürülməsini və ekvivalentlik testini
  qurdu.
- Sənədlərdə mənbə istiqaməti barədə açıq ziddiyyət var idi (zəncir qatının yoxlanışı, 2026-11-15):
  - [[ADR-0051]] K6: "siyahılar zəncir mərhələsində də dərc edilir — **zəncirin proyeksiyası kimi**" — yəni zəncir mərhələsində
    istiqamət tərsinə dönür, zəncir mənbə olurdu;
  - [[ADR-0074]] PJ1: "siyahı mənbə olaraq qalır";
  - [[ADR-0073]] K6: "zəncir mərhələsinin zənciri mənbə edib-etməyəcəyi ayrıca qərardır".
  Hansının mənbə olacağı qərara bağlanmadan yoxlayan tərəfin zəncirdən necə istifadə edəcəyi, monitorinq və keçid planı
  dəqiqləşə bilmirdi.
- **Layihə rəhbərliyinin istiqaməti (2026-11-15):** şəbəkə bu gün AB modeli ilə irəliləyir və bugünkü modeldə zəncirlə bağlı proses
  aparılmır; zəncir kodu da irəliləyir, struktur qurulur ki, zəncirə keçid günü sıfırdan proses lazım olmasın; yoxlayıcı qovşaq
  açmaq kimi işlər hazırda əlavə xərcdir və görülmür; zəncirə keçərkən əvvəl test şəbəkəsi, sonra real şəbəkə.

# Qərar

## K1 — Mənbə və şahid

İmzalı etibar siyahıları (LOTL, milli siyahılar, onların görünüşləri) və lövbər jurnalı şəbəkənin **yeganə və əsas** etibar
mənbəyidir. Zəncir **şahiddir**: siyahıların hər dərcini və onlardakı etibar qeydlərini qeyd edir ([[ADR-0074]] PJ1,
[[ADR-0085]]), hədd qədər müstəqil operator eyni xülasəni yazanda siyahı versiyasına şahidlik edir ([[ADR-0051]] CH3). Bu istiqamət
bütün zəncir mərhələlərində qüvvədədir: test şəbəkəsində də, real şəbəkədə də, ikinci operator gəldikdən sonra da. Zənciri mənbə etmək
(istiqaməti tərsinə çevirmək) yalnız yeni qərar qeydi ilə mümkündür və həmin qeyd ən azı bunları tələb edir: üzv dövlətlərin zənciri
özlərinin idarə etməsi, AB tərəfinin bu modeli tanıya biləcəyinin göstərilməsi və zəncirdən siyahıya geri dönüş yolu.

## K2 — Yoxlama qərarı yalnız imzalı siyahıdan

Yoxlama xəttinin (A–E) bütün etibar addımları (C1, C2, C3, D5 və qeydlərə baxan digər addımlar) yalnız imzalı siyahıdan oxuyur.
Yoxlamada istifadə olunan `TrustSource` siyahı mənbəyidir. Zəncirdən oxuyan etibar mənbəyi (`ChainTrustSource`) heç bir yoxlama
qərarında istifadə edilmir; onun vəzifəsi ekvivalentlik testi və çarpaz yoxlamadır. [[ADR-0074]] K5-dəki "davamlı proyeksiya
gələnə qədər yoxlamada istifadə edilmir" həddi bu qərarla daimi olur: davamlı proyeksiya gəldikdən sonra da zəncir qərar vermir.

## K3 — Zəncirin oxunması yalnız çarpaz yoxlama və şəffaflıq üçündür

Yoxlayan tərəf (və ya istənilən üçüncü tərəf) istəsə zənciri oxuyur və əlindəki siyahı ilə müqayisə edir (`trust:chain-check`,
sağlamlıq səhifəsindəki zəncir sahəsi, gələcəkdə istəyə bağlı ikinci mənbə). Bu oxunma yoxlama nəticəsini **heç bir istiqamətdə**
dəyişmir: `UNKNOWN` nəticəni pisləşdirmir, `YES` yaxşılaşdırmır, `NO` rədd etdirmir ([[ADR-0051]] K1.2). Zəncirin oxunması yoxlama
üçün heç vaxt lazım deyil və olmayacaq.

## K4 — Zəncir dayanarsa siyahı təsirlənmir

Zəncirin dayanması, əlçatmaz olması, geri qalması və ya zəncirə yazının uğursuz olması siyahı dərcinə, status siyahılarına, yoxlamaya
və cüzdanlara təsir etmir. Siyahı dərcçisi zəncirə yazı xətası səbəbindən dərci dayandırmır; zəncir işləri dərcdən **sonra** və
dərcdən asılı olmadan işləyir ([[ADR-0085]] SP5). Zəncir bayrağı (`TAMGA_CHAIN_ENABLED`) söndürüləndə sistem bugünkü halına qayıdır;
geri dönüş yalnız bayraqdır.

## K5 — Fərq həyəcan siqnalı yaradır

Zəncir ilə siyahı arasındakı hər fərq həyəcan siqnalı yaradır və şəffaflıq hesabatına daxil olur: zəncirdə eyni siyahı versiyası
üçün təsdiqlənmiş fərqli xülasə (`CONFLICT` / `NO`, ikili danışıq əlaməti), gözləyən rəqib namizəd (`CONTEST`), proyeksiyanın
siyahıdan geri qalması və ya yaza bilməməsi, ekvivalentlik testində fərq. Düzəliş istiqaməti həmişə siyahıdan zəncirə doğrudur:
zəncir qeydi silinmir, siyahıya uyğun yeni yazı ilə düzəldilir; siyahı zəncirə görə düzəldilmir.

## K6 — Kod söndürülmüş halda tamamlanır; keçid əvvəl test şəbəkəsi, sonra real şəbəkə

- Zəncir kodu (kontraktlar, dərcçinin zəncir işləri, indeksləyici, ekvivalentlik testləri, operator alətləri) **söndürülmüş**
  halda tamamlanır: istehsalda bayraq sönülüdür, canlı serverdə zəncir ayarı yoxdur, paketlər zəncir müştərisi daşımır
  ([[ADR-0015]] K1).
- **Hələlik server, yoxlayıcı qovşaq və ya test zənciri serveri qurulmur.** Kod lokal inkişaf zəncirində və davamlı inteqrasiyadakı
  çoxqovşaqlı test şəbəkəsində sınanır.
- Keçid ardıcıllığı: (1) söndürülmüş kod; (2) **test şəbəkəsi** — real siyahılar test zəncirinə əks etdirilir və ekvivalentlik bir
  müddət fərqsiz izlənilir; (3) **real şəbəkə**. Real şəbəkə bu şərtlər birlikdə ödənmədən açılmır: ikinci müstəqil operatorun yazılı
  razılığı ([[ADR-0009]] K4), siyahı lövbərində hədd ≥ 2 ([[ADR-0051]] CH3), test şəbəkəsində fərqsiz ekvivalentlik, istehsal açar
  yolu (aparat açar seyfi) üçün qərar qeydi, idarəetmə və konsensus açarlarının ayrılması üçün qərar qeydi və müstəqil təhlükəsizlik
  auditi.

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| **Siyahı mənbə, zəncir şahid (bütün mərhələlərdə)** | **seçildi** | AB etibar siyahısı modeli ilə eynidir; zəncir olsa da, olmasa da eyni yoxlama; geri dönüş yalnız bayraq; tək operator dövründə zəncirin yarada bilmədiyi etibarı varmış kimi göstərmir |
| Zəncir mərhələsində zəncir mənbə, siyahı zəncirin görünüşü ([[ADR-0051]] K6-nın köhnə müddəası) | rədd (hələlik) | Bir operator düşəndə və ya zəncir dayananda yoxlama təsirlənir; AB modelindən ayrılır; geri dönüş üçün əks istiqamətdə köçürmə lazımdır. Dövlətlər zənciri idarə edəndə yenidən qiymətləndirilə bilər (K1 son cümlə) |
| İki mənbə: siyahı və zəncir birlikdə, ikisi də "bəli" desə qəbul | rədd | Hər iki mənbənin nasazlığı rədd etdirir (ən zəif halqa); nəticə zəncirin əlçatanlığına bağlanır (K4-ə zidd) |
| Zəncirdən heç istifadə etməmək | rədd | İkili danışığa qarşı müstəqil şahidlik və qeyd səviyyəsində şəffaflıq itir; layihə rəhbərliyinin "zəncir kodu irəliləsin" istiqamətinə ziddir |
| Test şəbəkəsini keçib birbaşa real şəbəkə | rədd | Miqrasiya pəncərəsi bir dəfə açılır ([[ADR-0073]] CE1); real siyahılarla əvvəlcədən sınaq olmadan açılması geri dönüşü olmayan xəta riski daşıyır |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| LS1 | İmzalı etibar siyahıları və lövbər jurnalı şəbəkənin yeganə və əsas etibar mənbəyidir; zəncir şahiddir. Bu istiqamət bütün zəncir mərhələlərində qüvvədədir; zənciri mənbə etmək yeni qərar qeydi tələb edir. |
| LS2 | Yoxlama qərarı (C1, C2, C3, D5 və qeydlərə baxan digər addımlar) yalnız imzalı siyahıdan verilir; zəncirdən oxuyan etibar mənbəyi heç bir yoxlama qərarında istifadə edilmir. |
| LS3 | Zəncirin oxunması yalnız çarpaz yoxlama və şəffaflıq üçündür; yoxlama nəticəsini heç bir istiqamətdə dəyişmir və yoxlama üçün heç vaxt lazım deyil. |
| LS4 | Zəncirin dayanması, əlçatmaz olması, geri qalması və ya zəncirə yazının uğursuz olması siyahı dərcinə, status siyahılarına, yoxlamaya və cüzdanlara təsir etmir; zəncir işləri dərcdən sonra və dərcdən asılı olmadan işləyir. |
| LS5 | Zəncir ilə siyahı arasındakı hər fərq həyəcan siqnalı yaradır və şəffaflıq hesabatına daxil olur; düzəliş siyahıdan zəncirə doğrudur, zəncir qeydi silinmir. |
| LS6 | Zəncirə keçid ardıcıllığı test şəbəkəsi, sonra real şəbəkədir; real şəbəkə ikinci müstəqil operatorun yazılı razılığı, hədd ≥ 2, test şəbəkəsində fərqsiz ekvivalentlik, istehsal açar yolu və açar ayrılması qərarları və müstəqil təhlükəsizlik auditi olmadan açılmır. |

# Nəticələr

- [[ADR-0051]] K6-nın son bəndindəki "siyahılar zəncir mərhələsində də dərc edilir — zəncirin proyeksiyası kimi" müddəası dəyişdi:
  zəncir mərhələsində də siyahı mənbə, zəncir proyeksiya (şahid) olaraq qalır. [[ADR-0073]] K6-nın son cümləsindəki ayrıca qərar
  budur. [[ADR-0074]] K5-in müvəqqəti həddi daimi oldu. Üç qeydə istinad qeydi əlavə edildi.
- Davamlı proyeksiyanın dizaynı: [[ADR-0085]].
- [[FW-ARF-0001]] §8.1: reyestr mərhələsinin etibar lövbəri imzalı siyahılardır, reyestr şahiddir. [[ARCH-0002]]: quraşdırma
  addımları bu istiqamətə və [[ADR-0009]] K4-ə görə yeniləndi.
- Kod dəyişikliyi lazım olmadı: yoxlayan tərəf onsuz da yalnız siyahıdan oxuyur; zəncir sağlamlıq sahəsi nəticəni dəyişmir.
- Qalan işlər (ardıcıl): idarəetmə komanda aləti, istehsal açar yolu, zəncir monitorinqi və həyəcan siqnalının canlı monitorinqə
  bağlanması, real şəbəkə quraşdırma skripti, açar ayrılması qərarı, [[ADR-0079]] kodu.

# Status

**Accepted — 2026-11-15.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-15). DECISIONS: D-BC-17. LS1–LS6 məcburidir.
