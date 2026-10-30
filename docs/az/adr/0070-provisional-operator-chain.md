---
document_id: ADR-0070
title: "Müvəqqəti operator zənciri: fond qurulana qədər şəbəkənin öz xidmətləri Tamga Network adından müvəqqəti operatordadır"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  Tamga Network-ün hüquqi şəxsiyyəti yoxdur. Qurulacaq qeyri-kommersiya fondu hüquqi şəxsiyyət qazanana qədər şəbəkənin öz xidmətlərini (siyahıların dərci, şəxsiyyət xidməti, Tamga Verify, saytlar) Tamga Network adından müvəqqəti operator BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ idarə edir; hüquqi şəxs tələb edən hər qeydiyyat, sertifikat və müqavilə onun adı ilə və "Tamga Network adından" ifadəsi ilə edilir. Siyahı operatorunun və sxem sahibinin adı "Tamga Network" olaraq qalır. Müvəqqəti operatorun adı, identifikatoru və ünvanı vahid konfiqurasiya dəyərindən gəlir; siyahı dərc edən hər dərcdə yoxlayır. Təhvil mövcud təhvil aləti və runbook ilə aparılır; fond qurulana qədər iştirak müqavilələrini müvəqqəti operator imzalayır. Qəbul: 2026-10-30.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0024]]", "[[ADR-0033]]", "[[ADR-0037]]", "[[ADR-0042]]", "[[ADR-0058]]", "[[ADR-0066]]", "[[FW-TF-0001]]", "[[FW-RB-0001]]"]
translation_of: ADR-0070
source_version: "1.0.0"
---

# Qısaca

Tamga Network fond olacaq, lakin fond hələ qurulmayıb. O vaxta qədər şəbəkənin öz xidmətlərini bir şirkət şəbəkə adından və
müvəqqəti olaraq idarə edir: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ. Etibar siyahılarında operator adı yenə "Tamga
Network" yazılır; şirkətin adı yalnız hüquqi şəxs tələb olunan yerlərdə (vergi nömrəsi, sertifikat, müqavilə, şəxsi məlumatların
qeydiyyatı) görünür. Bu məlumat bir yerdə saxlanılır və fond qurulanda bir addımda dəyişdirilir.

# Kontekst

- [[ADR-0009]] K5 və D-GOV-5: siyahılar `operator {name, status: provisional, on_behalf_of}` daşıyır; təhvil yalnız operator
  sahəsini dəyişir. [[ADR-0037]]: şəbəkə yalnız şəbəkədir, xidmət satmır; [[ADR-0042]]: şəbəkə cüzdan idarə etmir.
- Şəbəkənin hüquqi şəxsiyyəti yoxdur. Qeydiyyat məlumatları ([[ADR-0024]]), sertifikatların `organizationIdentifier` sahəsi
  ([[ADR-0058]]), Türkiyənin şəxsi məlumatlar qanunu (KVKK) üzrə məlumat nəzarətçisi qeydiyyatı, domen adları və iştirak
  müqavilələri hüquqi şəxs tələb edir. Bu yerlər bir-bir doldurulmuşdu; yazılı qərar və vahid mənbə yox idi. Tətbiq mağazası
  yoxlama imzaçısının ([[ADR-0033]]) gözləyən qeydi buna görə natamam qalmışdı.
- Layihə rəhbərliyinin istiqaməti: şəbəkə operator şirkətdən tamamilə ayrı qeyri-kommersiya fondu olacaq; fond qurulana qədər
  operator zənciri yazılı şəkildə sabitlənsin və hər yerdə eyni olsun.

# Qərar

## K1 — Zəncir
Tamga Network (qurulacaq fond) ← müvəqqəti operator **BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ** (vergi nömrəsi
1870632151; Harbiye Mah. Bostan Sk. No: 15 İç Kapı No: 5, Şişli / İstanbul). Müvəqqəti operator şəbəkənin öz xidmətlərini
(siyahıların dərci, dövlət adından qeydiyyat orqanı rolu, şəxsiyyət xidməti, Tamga Verify, saytlar və domen adları) Tamga Network
adından idarə edir. Hüquqi şəxs tələb edən hər əməliyyat onun adı ilə və "Tamga Network adından" ifadəsi ilə edilir.

## K2 — Adlar
Siyahı operatoru (LOTL və milli siyahıların `operator.name`-i, ETSI XML və LoTE görünüşlərinin `SchemeOperatorName`-i) və sxem
sahibinin adı **"Tamga Network"** olaraq qalır (`status: provisional`, `on_behalf_of`). Müvəqqəti operatorun adı yalnız şəbəkənin
öz xidmət qeydlərində (`operator` bloku, `identifiers`, `postal_address`), onların sertifikatlarında və hüquqi şəxs tələb edən
sənədlərdə görünür. Müvəqqəti operatorun digər məhsulları (məsələn, şəbəkənin siyahıya aldığı cüzdan) ayrıca iştirakçıdır və
imtiyaz qazanmır ([[ADR-0037]], [[ADR-0042]]).

## K3 — Vahid dəyər
Müvəqqəti operatorun adı, kimin adından çalışdığı, identifikatoru və ünvanı vahid konfiqurasiya dəyəridir
(`apps/trust-publisher/registry/provisional-operator.json`). Siyahı dərc edən hər dərcdən əvvəl yoxlayır: identifikator qeydində
"provisional operator" olan hər öz qeyd bu dəyəri eynilə daşıyır və siyahı operatorunun adı "Tamga Network"-dür; fərq varsa dərc
dayanır. JSON siyahılar, XML və LoTE görünüşləri ([[ADR-0066]]) bu qeydlərdən hazırlanır; sertifikat sahələri və müqavilə
şablonları eyni dəyəri istifadə edir.

## K4 — Təhvil
Fond hüquqi şəxsiyyət qazananda təhvil operatorun mövcud təhvil aləti (quru sınaq) və runbook ilə aparılır: dəyər, ondan asılı
qeydlər və sertifikatlar fondun adı və nömrəsi ilə yenilənir ([[ADR-0058]] K5). Siyahı operatorunun adı, `ca_id`, `vct` və
qurumların daimi identifikatorları dəyişmir.

## K5 — Müqavilələr
Fond qurulana qədər iştirak müqaviləsi, hostinq əlavəsi və məlumatların emalı müqaviləsi Tamga Network adından müvəqqəti operator
tərəfindən imzalanır; müqavilələr varislik bəndi daşıyır: fond qurulanda hüquq və öhdəliklər ona keçir ([[FW-TF-0001]] §5.7).

## K6 — Gözləyən qeydlər
Tətbiq mağazası yoxlama imzaçısının qeydi ([[ADR-0033]]) və sonrakı bütün öz qeydlər eyni dəyəri daşıyır.

# Nəzərdən keçirilən variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Siyahılarda operator adı kimi şirkətin adı | rədd | Siyahı və sxem sahibliyi şəbəkəyə aiddir; təhvildə siyahının kimliyi dəyişərdi; şəbəkənin neytrallığı |
| Hüquqi şəxs tələb edən hər işi fond qurulana qədər gözləmək | rədd | Şəxsiyyət xidməti, yoxlayan tərəfin qeydi və mağaza yoxlaması bu gün hüquqi şəxs tələb edir |
| Dəyərləri hər qeyddə ayrıca saxlamaq (əvvəlki vəziyyət) | rədd | Dağınıq; təhvildə biri unudula bilər; yoxlanılmır |
| **Siyahı adı "Tamga Network", hüquqi şəxs müvəqqəti operator, vahid dəyər + dərc yoxlaması** | **seçildi** | Təhvil bir nöqtədən; siyahı kimliyi sabit; uyğunluq hər dərcdə yoxlanılır |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| OP1 | Siyahı operatorunun və sxem sahibinin adı "Tamga Network"-dür (fond qurulana qədər `status: provisional`); müvəqqəti operatorun adı yalnız şəbəkənin öz xidmət qeydlərində, onların sertifikatlarında və hüquqi şəxs tələb edən sənədlərdə yer alır. |
| OP2 | Müvəqqəti operatorun adı, identifikatoru və ünvanı vahid konfiqurasiya dəyərindən gəlir; siyahı dərc edən bu dəyərdən fərqli məlumat daşıyan öz qeydi ilə və ya "Tamga Network"-dən başqa siyahı operatoru adı ilə dərc etmir. |
| OP3 | Fonda təhvil yalnız bu dəyəri və ondan asılı qeydləri və sertifikatları dəyişir; siyahı operatorunun adı, `ca_id`, `vct` və qurumların daimi identifikatorları dəyişmir. |

# Nəticələr

- Kod: siyahı dərc edənin `provisional-operator.ts` yoxlaması və `registry/provisional-operator.json`; tətbiq mağazası yoxlama
  imzaçısının gözləyən qeydi eyni dəyərlə tamamlandı (qeydiyyat və dərc operatorun kompüterində).
- Sənədlər: [[FW-TF-0001]], [[FW-RB-0001]] RB-OP-01 və təriflər eyni zənciri artıq yazır; dəyişiklik lazım olmadı.

# Status

**Accepted — 2026-10-30.** Layihə rəhbərliyinin təsdiqi ilə (hərfi sitat özəl təsdiq qeydindədir). DECISIONS: D-GOV-10. OP1–OP3
məcburidir.
