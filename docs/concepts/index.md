---
title: Kavramlar
---

# Kavramlar

Tamga ile çalışmak için bilmeniz gereken altı fikir. Her sayfa birkaç dakikada okunur; ayrıntı ve bağlayıcı kurallar
spesifikasyonlardadır.

<div class="tg-cards">

<a class="tg-card" href="/concepts/guven-listeleri">
<strong>Güven listeleri ve federasyon</strong>
<span>Bir doğrulayıcı, belgeyi veren kurumun gerçek olduğunu nereden bilir? İmzalı listeler ve tek kök anahtar.</span>
</a>

<a class="tg-card" href="/concepts/belge-bicimleri">
<strong>Belge biçimleri</strong>
<span>SD-JWT VC ve ISO mdoc: aynı belge, iki biçim — internet için ve yüz yüze için.</span>
</a>

<a class="tg-card" href="/concepts/belge-verme">
<strong>Belge verme</strong>
<span>Kurumdan cüzdana: QR ile teklif ya da cüzdandan talep, kimlik eşleme, cüzdan kanıtı (OpenID4VCI).</span>
</a>

<a class="tg-card" href="/concepts/belge-gosterme">
<strong>Belge gösterme</strong>
<span>Cüzdandan doğrulayıcıya: imzalı istek, yalnız istenen alanlar, üç sonuç (OpenID4VP).</span>
</a>

<a class="tg-card" href="/concepts/gizlilik">
<strong>Gizlilik</strong>
<span>Seçici açıklama, doğrulayıcı başına kopya, site başına takma ad, sıfır bilgi ispatıyla yaş.</span>
</a>

<a class="tg-card" href="/concepts/iptal">
<strong>İptal ve tazelik</strong>
<span>İptal listeleri, önceden çekme ve "şu an doğrulanamadı" sonucu.</span>
</a>

</div>

## Tamga'yı tek paragrafta

Kurumlar (üniversite, hastane, bilet satıcısı) kişilere dijital belge verir; belge kişinin telefonundaki cüzdanda durur.
Bir işveren, site ya da kapı bu belgeyi istediğinde kişi yalnız gereken alanları gösterir; doğrulayıcı imzayı, kurumun güven
listesindeki kaydını ve iptal durumunu kaynağa sormadan, saniyeler içinde denetler. Biçimler ve protokoller AB'nin dijital
kimlik cüzdanıyla (eIDAS 2.0 / EUDI) aynıdır; Tamga'nın kurallarına uyan her cüzdan ve doğrulayıcı ağda çalışır.
