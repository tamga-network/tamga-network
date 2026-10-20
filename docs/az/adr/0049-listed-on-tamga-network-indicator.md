---
document_id: ADR-0049
title: "\"Tamga Network-da siyahıdadır\" göstəricisi"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  Aİ Rəqəmsal Cüzdan Etibar Nişanının (EU Digital Identity Wallet Trust Mark) əvəzinə, şəbəkənin etibar siyahısındakı rəqəmsal cüzdanlar üçün yazılı göstərici: "Tamga Network-da siyahıdadır" / "Listed on Tamga Network". Loqo yoxdur; Aİ ulduzları, Aİ rəngləri və "etibar nişanı" ya da "trust mark" ifadəsi istifadə edilmir. Göstəriciyə toxunduqda imzalanmış etibar siyahısındakı `wallet_providers[]` qeydi göstərilir. Cüzdan vahidi ləğv edildikdə və ya cüzdan provayderi siyahıdan çıxarıldıqda göstərici gizlədilir. Qayda şəbəkədəki hər rəqəmsal cüzdan üçün eynidir. RB-WP-10-un "etibar nişanı" ifadəsini əvəz edir. Tətbiq 0.6.0 versiyasındadır. Qəbul: 2026-10-13.
domain: Wallet
related: ["[[ADR-0035]]", "[[ADR-0042]]", "[[ADR-0047]]", "[[SPEC-TRUST-0001]]", "[[FW-RB-0001]]"]
translation_of: ADR-0049
source_version: "1.0.0"
---

# Qısaca

Şəbəkənin etibar siyahısındakı rəqəmsal cüzdan siyahıda olduğunu şəxsə **yazı ilə** bildirir: "Tamga Network-da siyahıdadır". Bu, Aİ nişanı
deyil və elə görünmür. Şəxs yazıya toxunduqda cüzdan imzalanmış siyahıdakı cüzdan provayderi qeydini göstərir; yəni göstərici
yoxlanıla bilən bəyanatdır, bəzək deyil.

# Kontekst

- **Aİ qaydası.** İcra Reqlamenti (Aİ) 2024/2979, maddə 14a (2026/1731 ilə əlavə edilib) sertifikatlaşdırılmış Aİ cüzdanlarının Aİ Rəqəmsal Cüzdan Etibar
  Nişanını göstərməsini məcburi edir; nişanın forması, rəngləri və ölçüləri müəyyən edilib; cüzdan vahidi sübutu ləğv edildikdə
  nişan göstərilmir (Aİ TS1). Nişan yalnız Aİ üzv dövlətinin təqdim etdiyi və ya tanıdığı sertifikatlaşdırılmış cüzdan üçündür.
- **Tamga-nın vəziyyəti.** Şəbəkədəki heç bir rəqəmsal cüzdan Aİ cüzdanı deyil və nişandan istifadə edə bilməz ([[ADR-0035]] PO4). Lakin Aİ-nin nişanla
  həll etdiyi problem Tamga-da da var: şəxs telefonundakı tətbiqin şəbəkənin qaydalarına əməl edən və siyahıda qeydiyyatda olan cüzdan olub-olmadığını
  bilmək istəyir. Hazırda RB-WP-10 cüzdandan "bu cüzdan Tamga etibar siyahısındadır" görünüşünü "etibar nişanı" adı ilə tələb edir; bu ad Aİ
  nişanı ilə qarışdırıla bilər, hüquqi risk və tətbiq mağazası riski daşıyır.
- **Ad.** "Tamga Network'te listeli" (türkcə) və "Listed on Tamga Network" (ingiliscə) adlarını layihə rəhbərliyi 2026-10-13 tarixində təsdiq edib.

# Qərar

## K1 — Yazılı göstərici, loqo yoxdur

- Göstərici yalnız yazıdır: türkcə **"Tamga Network'te listeli"**, ingiliscə **"Listed on Tamga Network"**; digər dillərdə eyni
  mənanın tərcüməsi (azərbaycanca: "Tamga Network-da siyahıdadır").
- Loqo, nişan və ya möhür forması istifadə edilmir. Aİ ulduzları, Aİ bayrağının rəngləri və düzülüşü, "etibar nişanı", "trust mark",
  "EU", "EUDI" və ya "təsdiqlənmiş / sertifikatlaşdırılmış" ifadələri göstəricidə və onun yanında istifadə edilməməlidir (**MUST NOT**).
- Göstəricinin yeri və yazı üslubu cüzdanın öz dizaynıdır; şəxsin tapa biləcəyi yerdə (məs. cüzdan haqqında məlumat və ya
  ayarlar) yerləşir.

## K2 — Toxunduqda imzalanmış qeyd

- Göstəriciyə toxunduqda cüzdan imzası yoxlanılmış etibar siyahısındakı öz `wallet_providers[]` qeydini göstərir: provayderin
  rəsmi adı, `provider_id`, qeydin və həllin statusu (`status`), cüzdanın təminat səviyyəsi və siyahının dərc olunma vaxtı ([[SPEC-TRUST-0001]]).
- Məlumat cüzdanda olan yoxlanılmış siyahıdan oxunur; göstərmə anında şəbəkəyə sorğu göndərilmir.
- Cüzdan siyahının ictimai ünvanını da göstərə bilər; şəxs qeydi cüzdandan kənarda da yoxlaya bilər.

## K3 — Nə vaxt gizlədilir

Göstərici aşağıdakı hallardan birində gizlədilməlidir (**MUST**):
1. cüzdan vahidi ləğv edilib (cüzdan provayderi tərəfindən ləğv, şəxsin istəyi və ya WIA ləğv siyahısı; [[ADR-0047]]);
2. cüzdan provayderinin qeydi və ya istifadə olunan həllin qeydi etibar siyahısında `ACTIVE` deyil (dayandırma, ləğv, çıxarılma, yer tutucu
   qeyd);
3. cüzdandakı etibar siyahısı yoxlanıla bilmir və ya müddəti bitib (köhnəlmiş siyahı "siyahıdadır" demək üçün kifayət deyil);
4. cüzdan yalnız sandbox siyahısına bağlıdır: sandbox-da siyahıda olmaq göstəricini vermir ([[ADR-0038]]).

## K4 — Şəbəkədəki hər cüzdan üçün eyni

Qayda şəbəkənin qaydasıdır və etibar siyahısındakı hər rəqəmsal cüzdana eyni şəkildə tətbiq olunur ([[ADR-0042]]). Siyahıda olmayan tətbiq göstəricidən
və ya ona bənzəyən ifadədən istifadə edə bilməz; istifadə edərsə, bu, iştirak qaydalarının pozulmasıdır. Cüzdan provayderinin təqdimat məlumatlarında
(metadata) bu göstəriciyə uyğun "trust mark" sahəsi yoxdur; provayderin məlumat səhifəsi `provider_information_uri` sahəsində
"Provayder haqqında məlumat" adı ilə verilir (cüzdanın öz qərarı ilə).

## K5 — Tətbiq

Şəbəkə qaydası bu gündən qüvvədədir; Tamga Wallet-da göstərici və toxunduqda açılan qeyd səhifəsi 0.6.0 paket versiyası ilə gəlir
(`wallet-core` qeydin oxunması və gizlətmə şərtləri).

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Aİ Etibar Nişanından və ya ona bənzər loqodan istifadə etmək | rədd | Hüquqi baxımdan yalnız sertifikatlaşdırılmış Aİ cüzdanı üçündür; bənzərlik çaşdırıcıdır və tətbiq mağazasının yoxlamasında risk yaradır |
| Öz loqosu olan "Tamga etibar nişanı" | rədd | "Etibar nişanı" adı Aİ nişanını xatırladır; loqo yoxlanıla bilən heç nə bildirmir |
| Ümumiyyətlə göstərici qoymamaq | rədd | Şəxs tətbiqin şəbəkədə qeydiyyatda olub-olmadığını öyrənə bilmir; Aİ-nin həll etdiyi ehtiyac qalır |
| **Yazılı, yoxlanıla bilən göstərici** | **qəbul** | Doğru olanı bildirir (siyahıda qeydiyyatdadır), qeydi göstərir, ləğv edildikdə yox olur |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| LI1 | Göstərici yalnız yazıdır ("Tamga Network'te listeli" / "Listed on Tamga Network"); loqo, Aİ ulduzları və rəngləri, "etibar nişanı" və ya "trust mark" ifadəsi istifadə edilmir. |
| LI2 | Göstəriciyə toxunduqda imzası yoxlanılmış etibar siyahısındakı `wallet_providers[]` qeydi göstərilir. |
| LI3 | Cüzdan vahidi ləğv edilibsə, provayder və ya həll qeydi `ACTIVE` deyilsə, siyahı yoxlanıla bilmirsə və ya cüzdan yalnız sandbox-a bağlıdırsa, göstərici göstərilmir. |

# Nəticələr

- [[FW-RB-0001]]: RB-WP-10 yenidən yazılır, RB-WP-18 əlavə edilir.
- `wallet-core` (0.6.0): provayder qeydini və gizlətmə şərtlərini verən köməkçi.
- Tamga Wallet: göstərici və qeyd səhifəsi; provayderdə `trust_mark` sahəsi əvəzinə `provider_information_uri` (cüzdanın öz
  qərarları).

# Status

**Accepted — 2026-10-13.** Layihə rəhbərliyinin təsdiqi ilə (Aİ-yə uyğunluğun ilk mərhələsi, qərar 4 və 9c). DECISIONS: D-WALLET-3.
