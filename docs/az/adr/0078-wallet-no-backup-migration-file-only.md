---
document_id: ADR-0078
title: "Cüzdanın ehtiyat nüsxəsi yoxdur: daşınan yeganə şey köçürmə faylıdır"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  SPEC-WALLET-0001/WL2 "ehtiyat nüsxə rəqəmsal sənədləri və manifesti daşıyır" deyirdi və spesifikasiya toxumdan törəyən açarla
  şifrələnib Tamga-nın yerləşdirdiyi anbara yüklənə bilən ehtiyat nüsxəni təsvir edirdi. Belə ehtiyat nüsxə heç vaxt
  hazırlanmadı; ADR-0027 də server tərəfində ehtiyat nüsxəni qadağan edir. Qərar: ehtiyat nüsxə hazırlanmır, spesifikasiya
  reallığa uyğun düzəldilir. Rəqəmsal sənədlər cihazdakı aparat açarına bağlıdır və daşınmır; yeni cihazda rəqəmsal sənədlər
  yenidən verilir. Cüzdanın daşıdığı yeganə şey şəxsin özünün başlatdığı və öz parolu ilə şifrələdiyi Aİ TS10 köçürmə faylıdır;
  fayl rəqəmsal sənəd dəyəri və açar ehtiva etmir.
domain: Wallet
related: ["[[SPEC-WALLET-0001]]", "[[ADR-0027]]", "[[ADR-0031]]", "[[GUIDE-0005]]"]
translation_of: ADR-0078
source_version: 1.0.0
---

# Qısaca

Cüzdandakı hər rəqəmsal sənəd həmin telefonun təhlükəsiz aparatında yaradılmış və oradan çıxa bilməyən açara bağlıdır. Buna görə
rəqəmsal sənəd başqa telefona daşına bilmir: daşınsa belə, təqdim edilə bilməz. Spesifikasiya yenə də rəqəmsal sənədlərin
"ehtiyat nüsxəsindən" bəhs edirdi. Bu qərar həmin ehtiyat nüsxəni spesifikasiyadan çıxarır. Telefon dəyişəndə şəxs rəqəmsal
sənədlərini qurumlardan yenidən alır; cüzdan bunu asanlaşdırmaq üçün yalnız "hansı sənədləri yenidən almalıyam" siyahısını
daşıyan şifrələnmiş fayl yaradır.

# Kontekst

- [[SPEC-WALLET-0001]] §1.3 (WL1, WL2): sənəd sahibinin açarları təhlükəsiz aparatdan çıxmır; "ehtiyat nüsxə rəqəmsal sənədləri
  və manifesti daşıyır, açarları daşımır". §1.4, §7.1 və §7.2 bu ehtiyat nüsxəni təsvir edirdi: 24 sözlük toxumdan törəyən
  açarla şifrələnmiş, rəqəmsal sənədlərin özünü ehtiva edən və Tamga-nın yerləşdirdiyi anbara yüklənə bilən fayl.
- Bu ehtiyat nüsxə hazırlanmadı. İstinad cüzdanında toxum sözləri, ehtiyat nüsxə faylı və ehtiyat nüsxə serveri yoxdur; şəbəkə
  də cüzdan xidməti idarə etmir.
- [[ADR-0027]] K1 "server tərəfində ehtiyat nüsxə alınmır" deyir və LX2 köçürmə faylına rəqəmsal sənəd dəyərinin, nüsxənin və
  açarın daxil olmasını qadağan edir. Spesifikasiyanın §7.2 bölməsi ("yerləşdirilən anbara yüklənə bilər") bu qərarla ziddiyyət
  təşkil edirdi.
- Ehtiyat nüsxənin faydası da məhdud idi: bərpa edilən rəqəmsal sənəd oxuna bilir, lakin təqdim edilə bilmir (açarı yoxdur).
  Əvəzində rəqəmsal sənəd dəyərlərinin cihazdan kənarda nüsxəsi yaranır: şifrələnmiş olsa belə, sızma səthidir və ölçüsündən
  neçə sənəd olduğu anlaşılır.

# Qərar

- **K1 — Ehtiyat nüsxə yoxdur.** Cüzdan rəqəmsal sənədlərin, nüsxələrin və ya açarların ehtiyat nüsxəsini almır; nə cihazdan
  kənara, nə də serverə. Toxum sözləri ilə bərpa yoxdur.
- **K2 — Rəqəmsal sənədlər daşınmır, yenidən verilir.** Rəqəmsal sənədlər cihazdakı aparat açarına bağlıdır. Yeni cihazda hər
  rəqəmsal sənəd öz qurumundan yenidən alınır (yeni açarlar, yeni nüsxələr).
- **K3 — Daşınan yeganə şey köçürmə faylıdır.** Cüzdanın cihazdan kənara çıxardığı yeganə daimi məlumat Aİ TS10 köçürmə
  faylıdır ([[SPEC-WALLET-0001]] §7.5): yenidən alınacaq rəqəmsal sənədlərin siyahısı və, şəxs istəsə, əməliyyat jurnalı. Faylı
  şəxs başladır, şəxsin parolu ilə şifrələnir və şəxsin seçdiyi yerə gedir ([[ADR-0027]] LX1). Rəqəmsal sənəd dəyəri, nüsxə və
  açar ehtiva etmir (LX2).
- **K4 — Dəyişən qayda.** WL2-nin mətni aşağıdakı kimi olur; WL4-dəki "server ehtiyat nüsxəsinə daxil edilmir" ifadəsi artıq
  mövcud olmayan ehtiyat nüsxəyə istinad etdiyi üçün çıxarılır (qaydanın özü dəyişmir).

| Qayda | Köhnə mətn | Yeni mətn |
|---|---|---|
| SPEC-WALLET-0001/WL2 | Ehtiyat nüsxə rəqəmsal sənədləri və manifesti daşıyır; açarları daşımır — cihaz dəyişdikdə rəqəmsal sənədlər yenidən verilməlidir. | Cüzdan rəqəmsal sənədlərin ehtiyat nüsxəsini almır: rəqəmsal sənədlər cihazdakı aparat açarına bağlıdır və daşınmır; cihaz dəyişdikdə rəqəmsal sənədlər yenidən verilir. Cüzdanın cihazdan kənara daşıdığı yeganə şey şəxsin başlatdığı köçürmə faylıdır (Aİ TS10); fayl rəqəmsal sənəd dəyəri, nüsxə və açar ehtiva etmir. |

# Qiymətləndirilən seçimlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Spesifikasiyadakı ehtiyat nüsxəni hazırlamaq (toxum + şifrələnmiş ehtiyat nüsxə + yerləşdirilən anbar) | rədd | Bərpa edilən rəqəmsal sənəd təqdim edilə bilmir; rəqəmsal sənəd dəyərlərinin cihazdan kənarda nüsxəsi yaranır; şəbəkə cüzdan xidməti idarə etmir; [[ADR-0027]] K1 ilə ziddiyyət təşkil edir |
| Yalnız cihazda qalan yerli ehtiyat nüsxə | rədd | Eyni fayda köçürmə faylı ilə, rəqəmsal sənəd dəyəri daşımadan əldə olunur |
| **Ehtiyat nüsxə yoxdur; köçürmə faylı** | **qəbul** | Tətbiq olunan vəziyyət; Aİ köçürmə qaydası (TS10) ilə uyğundur; cihazdan kənara rəqəmsal sənəd dəyəri çıxmır |

# Nəticələr

- [[SPEC-WALLET-0001]]: xülasə, §1.3 (WL2), §1.4, §2.1, §7.1–§7.4, §8 (WL2, WL4-ün ifadəsi), təhlükəsizlik qeydləri və açıq
  məsələlər düzəldildi. WL10 (Tamga bərpa açarı saxlamır) olduğu kimi qalır.
- Kod dəyişikliyi yoxdur: `@tamga-network/wallet-core` ehtiyat nüsxə yaratmır; köçürmə faylı `ts10.ts` ilə yaradılır.
- Uyğun cüzdanlar üçün qayda eynidir: rəqəmsal sənəd dəyərini cihazdan kənara çıxaran ehtiyat nüsxə funksiyası WL2-yə ziddir.
- Sayt təxəllüsü toxumu ([[ADR-0031]]) bu qərarın mövzusu deyil: cihazın təhlükəsiz anbarında qalır, köçürmə faylına daxil
  olmur (WL15) və şəxsiyyət yenidən yoxlanılanda eyni dəyər yenidən törəyir.

# Status

**Accepted — 2026-11-12.** Layihə rəhbərliyinin təsdiqi ilə (2026-11-12). DECISIONS: D-WALLET-4. Dəyişən qayda:
SPEC-WALLET-0001/WL2.
