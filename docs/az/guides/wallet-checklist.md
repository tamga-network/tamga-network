---
document_id: GUIDE-0010
title: "Rəqəmsal cüzdanın buraxılışdan əvvəl yoxlama siyahısı"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-16
summary: >
  Tamga ilə uyğun rəqəmsal cüzdanı mağazaya göndərməzdən əvvəl keçilməli olan yoxlama siyahısı: açarlar və cihaz attestasiyası, qeydiyyat, rəqəmsal sənədin alınması, təqdimat və təsdiq ekranı, məxfilik və jurnal, cihazın dəyişdirilməsi və silmə, etibar siyahısı, uyğunluq testləri və mağaza.
translation_of: GUIDE-0010
source_version: "1.0.0"
---

# Rəqəmsal cüzdanın buraxılışdan əvvəl yoxlama siyahısı

Bu səhifə [[GUIDE-0005]]-də təsvir olunan rəqəmsal cüzdanı buraxılışa hazırlayan komandalar üçündür. Hər bənd bir qaydaya əsaslanır; qayda kodları
[[SPEC-WALLET-0001]]-dədir, tam siyahı isə [Tamga ARF — Tamga Rulebook, RB-WP](https://arf.tamga.network/az/rulebook)-dədir.

**Nə vaxt oxunur:** mağazaya ilk göndərişdən əvvəl və hər böyük versiyadan əvvəl.

## Açarlar və cihaz

- Rəqəmsal sənəd açarları cihazın təhlükəsiz zonasında yaradılır (Secure Enclave, StrongBox və ya ən azı TEE); ixrac edilə bilmir;
  hər hansı toxumdan (seed) törədilmir (WL1).
- Proqram açarı yalnız test yığımında mövcuddur; mağaza yığımında proqram açarına keçid şəxsə açıq şəkildə göstərilir (WL3).
- Vahidin qeydiyyatında cihaz attestasiyası göndərilir: iOS-da App Attest, Android-də açar attestasiyası zənciri ([[GUIDE-0005]] §4).
- Attestasiyanın rədd edildiyi hal sınaqdan keçirilib: vahid proqram təminatı səviyyəsində qeydiyyatdan keçir və şəxs xəbərdar edilir.
- Tətbiqin identifikatoru (Bundle ID, paket adı) cüzdan provayderinin gözlədiyi ilə eynidir.

## Qeydiyyat

- Rəqəmsal cüzdan həlli etibar siyahısında `wallet_providers[]` altında qeydiyyatdadır; WUA imza açarı siyahıdadır.
- Tətbiqin versiyası həllin qeydiyyatdakı minimal versiyasından (`min_version`) köhnə deyil.

## Rəqəmsal sənədin alınması

- Təklifin QR kodu və PIN (`tx_code`) ayrı kanallarla gəlir; tətbiq PIN-i təkliflə eyni yerdən almır.
- Hər nüsxə ayrıca açara bağlıdır; gələn sənəd lokal olaraq yoxlanılır (`receiveCredentials`).
- WUA müddəti bitməzdən əvvəl yenilənir (`wuaExpiringSoon`); sənəd əməliyyatlarında WIA və açar attestasiyası istifadə olunur.
- Şəxsin əməli olmadan yeniləmə yalnız icazə verilən şərtlərdə aparılır (WL7, [[ADR-0023]]).

## Təqdimat və təsdiq ekranı

- Sorğunun imzası və sertifikatı yoxlanılır (`verifyRequestObject`); yoxlayan tərəfin qeydiyyatı imzalı siyahıdan oxunur (`checkRp`).
- Ekranda yoxlayan tərəfin adı, məqsədi, tələb olunan sahələr bir-bir və məxfilik siyasəti var; vasitəçi olduqda əsl sayt göstərilir
  ([[ADR-0017]]).
- Əhatə dairəsindən kənar sahə ayrıca vizual blokda, gecikməli düymə ilə göstərilir (WL8).
- Sənədi verən qurumun paylaşım qaydası sənədlə birlikdə saxlanılır (`receiveCredentials`) və təqdimat zamanı şəbəkə sorğusu olmadan qiymətləndirilir
  (`checkDisclosurePolicy`); uyğun gəlmirsə və ya yoxlana bilmirsə, ayrıca xəbərdarlıq, standart seçim "Paylaşma", mövcuddursa "Qaydanı oxu" ([[ADR-0046]] EP2/EP3).
- Hər təqdimat PIN və ya biometrika tələb edir (WL11).
- Eyni yoxlayan tərəfə eyni nüsxə, fərqli yoxlayan tərəfə fərqli nüsxə göndərilir; nüsxələr bitdikdə şəxsdən soruşulur (WL5, WL6).
- Təqdimat anında sxem serverinə sorğu yoxdur (WL9).
- "Etibarsız" və "yoxlanıla bilmədi" fərqli göstərilir ([[SPEC-CRED-0003]] S14).

## Məxfilik və jurnal

- Əməliyyat jurnalı cihazdadır; dəyərlər deyil, yalnız sahə adları; serverə və avtomatik ehtiyat nüsxəyə getmir (WL4).
- Jurnalın ixracı yalnız şəxsin özü başlatdıqda və onun öz parolu ilə şifrələnmiş şəkildə mümkündür (TS10, parol ən azı 8 simvol).
- Xəta qeydlərində, analitikada və çökmə hesabatlarında fərdi məlumatlar, sənədin məzmunu və ya sənədin özü yoxdur.
- Keçid kartının QR kodu fərdi məlumat daşımır; tokenin ömrü ən çoxu 60 saniyədir (WL12).

## Cihazın dəyişdirilməsi və silmə

- Ehtiyat nüsxə və köçürmə faylı açar daşımır; yeni cihazda sənədlər "yenidən al" siyahısı ilə bərpa olunur (WL2, WL10).
- Jurnalın bərpası şəxsdən soruşulur.
- Cihaz başqasına verildikdə vahid ləğv edilir (provayderinizin vahid ləğvi əməliyyatı).
- Tətbiqin içindən hesabın və məlumatların silinməsi işləyir (provayderinizin vahid silmə əməliyyatı, `requestIdentityErasure`); qurumdakı məlumatlar üçün müraciət yolu
  göstərilir.

## Etibar siyahısı

- Kök barmaq izləri tətbiqə daxil edilib (`TRUST_PINS`); siyahı serverinə etibar edilmir.
- Siyahı köhnəlibsə və ya endirilə bilmirsə, cavab "yoxlanıla bilmədi" olur; naməlum format versiyasında əməliyyat dayandırılır.
- Siyahı faylları əl ilə təhlil edilmir; yalnız `@tamga-network/trust/core` istifadə olunur ([[ADR-0015]]).

## Uyğunluq və mağaza

- Uyğunluq vektorları və öhdəlik testləri keçir; nəticə hesabatı hazırdır ([[GUIDE-0009]]).
- Real iOS və Android cihazlarında alma, təqdimat, cihazın dəyişdirilməsi və silmə başdan-başa sınaqdan keçirilib (test şəbəkəsi: [[GUIDE-0013]]);
  ləğv və dayandırma halları da sınaqdan keçirilib.
- Mağaza yoxlaması üçün sınaq hesabı və onun təlimatı hazırdır ([[ADR-0033]]).
- Məxfilik bəyanatı (App Store məxfilik etiketi, Google Play məlumat təhlükəsizliyi forması) cihazda qalan jurnal və silmə yolu ilə uyğundur.

## Əlaqəli

- Addım-addım hazırlama: [[GUIDE-0005]] · Qaydalar: [[SPEC-WALLET-0001]] · Problemlərin həlli: [[GUIDE-0012]]
