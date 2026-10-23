---
title: Məxfilik
---

# Məxfilik

Tamga-nın əsas qaydası: **[[t:verifier|yoxlayan tərəf]] yalnız lazım olanı görür, heç kim şəxsi saytlar arasında izləyə bilməz.** Bunu
dörd vasitə təmin edir.

## Selective disclosure

Rəqəmsal sənəddəki hər sahə ayrıca gizlədilir ([[t:selective-disclosure]]). İşə müraciət zamanı yalnız "məzun" və "dərəcə" göstərilir; orta
bal və tələbə nömrəsi gizli qalır. Yoxlayan tərəf gizli sahələrin yalnız [[t:salted-hash]] dəyərlərini görür.

## Hər yoxlayan tərəf üçün ayrıca nüsxə

Rəqəmsal cüzdan hər rəqəmsal sənəddən bir neçə nüsxə alır və hər yoxlayan tərəfə **ayrıca nüsxə** təqdim edir; eyni yoxlayan tərəfə isə həmişə eyni nüsxəni. İki
yoxlayan tərəf imza və ya açar dəyərlərini müqayisə edərək şəxsi eyniləşdirə bilməz. Nüsxələr azaldıqda rəqəmsal cüzdan onları arxa planda yeniləyir.

## Hər sayt üçün psevdonim

"Tamga ilə daxil ol" sayta şəxsiyyət nömrəsi və ya rəqəmsal sənədin xülasəsini göndərmir. Rəqəmsal cüzdan hər sayt (yoxlayan tərəf) üçün ayrıca və daimi
[[t:pseudonym|psevdonim]] yaradır: sayt Sizi hər girişdə tanıyır, iki sayt eyni şəxsi uyğunlaşdıra bilməz; telefon dəyişdikdən sonra şəxsiyyət
yenidən təsdiqləndikdə eyni psevdonimlər geri qayıdır. Standart olaraq hər şəxs üçün saytda bir hesab nəzərdə tutulur.

## Sıfır bilik sübutu ilə yaş

"18 yaşdan böyüyəm" sübutu rəqəmsal sənədin özü göstərilmədən yaradılır ([[t:ZK]]): yoxlayan tərəf nə doğum tarixini, nə də rəqəmsal sənədi
görür, iki təqdimat bir-biri ilə əlaqələndirilə bilməz. Sübut sistemi [[t:Longfellow-ZK]]; yoxlayan tərəf hissəsi `@tamga-network/verifier/zk`
alt yolunda, rəqəmsal cüzdan hissəsi (cihazda sübut yaradan) isə `@tamga-network/zk` paketində hazırdır; sübut yaradan bu gün
Android-də işləyir, iOS kitabxanası hələ yığılmayıb (orada ZK əvəzinə adi təqdimat edilir). Sübut ləğv siyahısındakı yeri açıqlamadığı üçün ləğv təqdimat zamanı yoxlanıla bilmir;
bunun əvəzinə ZK təqdimatı yalnız şəxsiyyət sənədinin qısamüddətli nüsxələri ilə (ən çox 24 saat etibarlı, rəqəmsal cüzdanın avtomatik
yenilədiyi) aparılır ([[ADR-0044]]). Ləğv edilmiş rəqəmsal sənədin nüsxəsi yenilənmir; sübut nüsxənin növünü bağladığı üçün yoxlayan tərəf
qısa ömrü görür. Nüsxədən istifadə edilməyən (işarəsiz) ZK təqdimatını yoxlayan tərəf yalnız siyasətində `accept_unrevocable_zk` açıq şəkildə
yazılıbsa qəbul edir.

## Yoxlayan tərəfin öhdəlikləri

- Sahələrin **dəyərlərini** və ləğv indeksini jurnala yazmayın; yalnız sahə adlarını.
- Qeydiyyatınızın əhatə dairəsindən kənar sahə tələb etməyin.
- Şəxs rəqəmsal cüzdandan Sizə silmə sorğusu göndərə bilər; qeydiyyatdakı əlaqə kanalınızı aktual saxlayın.

## Ətraflı

- Rəqəmsal cüzdan qaydaları: [[SPEC-WALLET-0001]]
- Psevdonim: [[ADR-0031]], sıfır bilik sübutu: [[ADR-0032]], [[ADR-0044]]
