---
title: Kavramlar
---

# Kavramlar

Tamga ile çalışmak için bilmeniz gereken altı fikir. Her sayfa birkaç dakikada okunur; ayrıntı ve bağlayıcı kurallar
şartnamelerdedir.

<div class="tg-cards">

<a class="tg-card" href="/concepts/trust-lists">
<strong>Güven listeleri ve federasyon</strong>
<span>Bir doğrulayıcı, belgeyi veren kurumun gerçek olduğunu nereden bilir? İmzalı listeler ve tek kök anahtar.</span>
</a>

<a class="tg-card" href="/concepts/federation">
<strong>Federasyon</strong>
<span>Her ülke kendi listesini tutar; Tamga listeleri toplar ve birbirine tanıtır. Tek çapa, çok liste.</span>
</a>

<a class="tg-card" href="/concepts/credential-formats">
<strong>Belge biçimleri</strong>
<span>SD-JWT VC ve ISO mdoc: aynı belge, iki biçim — internet için ve yüz yüze için.</span>
</a>

<a class="tg-card" href="/concepts/issuance">
<strong>Belge verme</strong>
<span>Kurumdan cüzdana: QR ile teklif ya da cüzdandan talep, kimlik eşleme, cüzdan kanıtı (OpenID4VCI).</span>
</a>

<a class="tg-card" href="/concepts/presentation">
<strong>Belge gösterme</strong>
<span>Cüzdandan doğrulayıcıya: imzalı istek, yalnız istenen alanlar, üç sonuç (OpenID4VP).</span>
</a>

<a class="tg-card" href="/concepts/privacy">
<strong>Gizlilik</strong>
<span>Selective disclosure, doğrulayıcı başına kopya, site başına takma ad, sıfır bilgi ispatıyla (ZK) yaş.</span>
</a>

<a class="tg-card" href="/concepts/revocation">
<strong>İptal ve tazelik</strong>
<span>İptal listeleri, önceden çekme ve "şu an doğrulanamadı" sonucu.</span>
</a>

</div>

## Tamga'yı tek paragrafta

Kurumlar (üniversite, hastane, bilet satıcısı) kişilere dijital belge verir; belge kişinin telefonundaki cüzdanda durur.
Bir işveren, site ya da kapı bu belgeyi istediğinde kişi yalnız gereken alanları gösterir; [[t:verifier|doğrulayıcı]] imzayı,
kurumun [[t:trust-list|güven listesindeki]] kaydını ve iptal durumunu kaynağa sormadan, saniyeler içinde denetler. Biçimler ve
protokoller AB'nin dijital kimlik cüzdanıyla ([[t:eIDAS]] 2.0 / [[t:EUDI-Wallet]]) aynıdır; Tamga'nın kurallarına uyan her
cüzdan ve doğrulayıcı ağda çalışır.
