---
title: Ortaq reyestr (zəncir)
---

# Ortaq reyestr (zəncir)

Tamga-nın etibarı bu gün imzalanmış [[t:trust-list|etibar siyahılarına]] və saatlıq [[t:anchor-log|lövbər jurnalına]] əsaslanır.
İşləyən zəncir yoxdur. İcazəli [[t:ledger|ortaq reyestrin]] (Hyperledger Besu, QBFT) kodu yazılıb və sınaqdan keçirilib; istehsalda
söndürülüb ([[ADR-0009]], [[ADR-0051]]).

## Zəncir nə üçündür?

Bu gün siyahıları bir operator imzalayır. Açıq jurnal və auditlər operatorun iki yoxlayan tərəfə iki fərqli siyahı göstərməsinin
(ikili danışıq) **qarşısını çəkindirir**, amma onu qeyri-mümkün etmir. Reyestr iki şey əlavə edə bilər:

- **Müstəqil şahidlik.** Siyahı versiyasının həşi yalnız hədd sayda müstəqil operator eyni həşi göndərdikdə təsdiqlənir; tək operator
  təsdiqlənmiş həş yarada bilməz, fərqli həşlər zəncirdə ziddiyyət hadisəsi kimi görünür ([[ADR-0053]]).
- **Kodda idarəetmə.** Üzvlük, ümumi sənəd növləri və yeniləmələr dövlətlərin 2/3 səsi ilə; yeniləmədə 7 gün gözləmə ([[ADR-0055]]).

Hər ikisi imzalayanların sayından asılıdır. Buna görə reyestr **ən azı iki müstəqil operator** validator işlətməyi yazılı qəbul
etmədən qurulmur; tək operatorun zənciri həmin operatorun imzaladığı siyahıdan artıq etibar yaratmır ([[ADR-0009]] K4).

## Nəyin proyeksiyasıdır?

Zəncir imzalanmış siyahıların və lövbər jurnalının **proyeksiyasıdır**, mənbəyi deyil ([[ADR-0051]]):

| | |
|---|---|
| Mənbə | İmzalanmış siyahılar (`lotl`, `tl-<cc>`) və lövbər jurnalı; ziddiyyətdə siyahı keçərlidir |
| Zəncirə gedən | Siyahı versiyalarının həşləri; siyahılardakı hər etibar qeydi (qurum, yoxlayan tərəf, sənəd növü, cüzdan təminatçısı, terminal qrupu…) yalnız həş, barmaq izi, tarix, status və qapalı çoxluq dəyəri kimi ([[ADR-0074]]) |
| Zəncirə heç vaxt girməyən | Şəxsi məlumat, rəqəmsal sənəd, sənəd həşi, ləğv biti, sərbəst mətn; təfərrüat yalnız `SHA-256(JCS(…))` həşi kimi |
| Yoxlama | Reyestrdən asılı deyil; `TrustSource` siyahıdan oxuyur. Zəncir yoxlaması könüllüdür: bəli / xeyr (həyəcan, nəticə dəyişmir) / bilinmir (nəticə pisləşmir) |

## Keçid necə olur?

Reyestr açılarsa, siyahıların bütün tarixçəsi müqavilələrə **bir dəfə** təkrar oynadılır (`trust:chain-replay`): dövlətlərin səsi ilə
açılan, ən çox 30 gün davam edən və yenidən açıla bilməyən miqrasiya pəncərəsində, siyahıdakı tarixlərlə ([[ADR-0073]]). Müqavilələr
sənədi verildiyi andakı (`iat`) statusa görə qiymətləndirir; dayandırmadan əvvəl verilmiş sənəd keçərli qalır, sərt ləğv
(`invalidatesFrom`) sonrakıları düşürür. Yoxlayan tərəfin kimliyi domen adından törəyir və dövlətlər arasında yalnız ortaq səslə
keçir ([[ADR-0075]]). Eyni suallar siyahı mənbəyinə və zəncir mənbəyinə verilib qəbul/rədd fərqi çıxmayana qədər miqrasiya bağlanmır.
Verilmiş sənədlər yenidən verilmir; rəqəmsal cüzdan və yoxlayan tərəf dəyişmir.

## Bu gün

| Hissə | Status |
|---|---|
| İmzalanmış siyahılar və lövbər jurnalı | Real şəbəkədə canlı |
| Müqavilələr, yerli Besu inkişaf şəbəkəsi, təkrar oynatma, indeksator, ekvivalentlik testi | İşləyir (yalnız yerli və CI) |
| İstehsal reyestri | Söndürülüb; ilkin şərt ikinci müstəqil operator və müstəqil təhlükəsizlik auditidir |
| Dəyər qatı (token, ödəniş) | Yoxdur; yalnız tədqiqat istiqaməti ([[ADR-0072]]) |

## Ətraflı

- Qərarlar: [[ADR-0001]] · [[ADR-0009]] · [[ADR-0051]] · [[ADR-0052]] · [[ADR-0073]] · [[ADR-0074]] · [[ADR-0075]]
- Siyahı formatı və müqavilə uyğunluğu: [[SPEC-TRUST-0001]]
- Etibar siyahıları: [Etibar siyahıları və federasiya](/concepts/trust-lists)
