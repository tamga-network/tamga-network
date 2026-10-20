---
title: Anlayışlar
---

# Anlayışlar

Tamga ilə işləmək üçün bilməli olduğunuz altı ideya. Hər səhifəni bir neçə dəqiqəyə oxumaq olar; təfərrüatlar və məcburi qaydalar
spesifikasiyalarda verilib.

<div class="tg-cards">

<a class="tg-card" href="/concepts/trust-lists">
<strong>Etibar siyahıları və federasiya</strong>
<span>Yoxlayan tərəf rəqəmsal sənədi verən qurumun həqiqi olduğunu haradan bilir? İmzalı siyahılar və vahid kök açar.</span>
</a>

<a class="tg-card" href="/concepts/federation">
<strong>Federasiya</strong>
<span>Hər ölkə öz siyahısını aparır; Tamga siyahıları bir yerə toplayır və onları bir-birinə tanıdır. Bir lövbər, çoxlu siyahı.</span>
</a>

<a class="tg-card" href="/concepts/credential-formats">
<strong>Rəqəmsal sənəd formatları</strong>
<span>SD-JWT VC və ISO mdoc: eyni rəqəmsal sənəd, iki format — internet üçün və üz-üzə istifadə üçün.</span>
</a>

<a class="tg-card" href="/concepts/issuance">
<strong>Rəqəmsal sənədin verilməsi</strong>
<span>Qurumdan rəqəmsal cüzdana: QR ilə təklif və ya cüzdandan sorğu, şəxsiyyətin uyğunlaşdırılması, cüzdan sübutu (OpenID4VCI).</span>
</a>

<a class="tg-card" href="/concepts/presentation">
<strong>Rəqəmsal sənədin təqdim edilməsi</strong>
<span>Rəqəmsal cüzdandan yoxlayan tərəfə: imzalı sorğu, yalnız tələb olunan sahələr, üç nəticə (OpenID4VP).</span>
</a>

<a class="tg-card" href="/concepts/privacy">
<strong>Məxfilik</strong>
<span>Selective disclosure, hər yoxlayan tərəf üçün ayrıca nüsxə, hər sayt üçün psevdonim, sıfır bilik sübutu (ZK) ilə yaş.</span>
</a>

<a class="tg-card" href="/concepts/revocation">
<strong>Ləğv və aktuallıq</strong>
<span>Ləğv siyahıları, əvvəlcədən yükləmə və "hazırda yoxlanıla bilmədi" nəticəsi.</span>
</a>

</div>

## Bir abzasda Tamga

Qurumlar (universitet, xəstəxana, bilet satıcısı) şəxslərə rəqəmsal sənəd verir; sənəd şəxsin telefonundakı rəqəmsal cüzdanda saxlanılır.
İşəgötürən, sayt və ya giriş qapısı bu sənədi tələb etdikdə şəxs yalnız lazım olan sahələri göstərir; [[t:verifier|yoxlayan tərəf]] imzanı,
qurumun [[t:trust-list|etibar siyahısındakı]] qeydini və ləğv statusunu mənbəyə müraciət etmədən, saniyələr ərzində yoxlayır. Formatlar və
protokollar Avropa İttifaqının (Aİ) rəqəmsal şəxsiyyət cüzdanı ([[t:eIDAS]] 2.0 / [[t:EUDI-Wallet]]) ilə eynidir; Tamga-nın qaydalarına əməl edən hər
rəqəmsal cüzdan və yoxlayan tərəf şəbəkədə işləyir.
