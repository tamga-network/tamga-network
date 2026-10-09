---
title: Gizlilik
---

# Gizlilik

Tamga'nın temel kuralı: **[[t:verifier|doğrulayıcı]] yalnız gerekeni görür, kimse kişiyi siteler arasında izleyemez.** Bunu
dört araç sağlar.

## Selective disclosure

Belgedeki her alan ayrı gizlenir ([[t:selective-disclosure]]). İş başvurusunda yalnız "mezun" ve "derece" gösterilir; not
ortalaması ve öğrenci numarası gizli kalır. Doğrulayıcı gizli alanların yalnız [[t:salted-hash]] değerlerini görür.

## Doğrulayıcı başına kopya

Cüzdan her belgeden birkaç kopya alır ve her doğrulayıcıya **ayrı bir kopya** gösterir; aynı doğrulayıcıya hep aynısını. İki
doğrulayıcı imza ya da anahtar değerlerini karşılaştırarak kişiyi eşleştiremez. Kopyalar azalınca cüzdan arka planda yeniler.

## Site başına takma ad

"Tamga ile giriş yap" siteye kimlik numarası ya da belge özeti göndermez. Cüzdan her site için ayrı ve kalıcı bir
[[t:pseudonym|takma ad]] türetir: site sizi her girişte tanır, iki site aynı kişiyi eşleştiremez; telefon değişince kimlik
yeniden doğrulandığında aynı takma adlar geri gelir. Kişi başına sitede tek hesap varsayılandır.

## Sıfır bilgi ispatıyla yaş

"18 yaşından büyüğüm" ispatı, belgenin kendisini göstermeden üretilir ([[t:ZK]]): doğrulayıcı ne doğum tarihini ne de belgeyi
görür, iki gösterim birbirine bağlanamaz. İspat sistemi [[t:Longfellow-ZK]]; doğrulayıcı tarafı `@tamga-network/verifier/zk`
alt yolunda hazır, cüzdan tarafı mağaza sürümüyle gelir. İspat iptal listesindeki yeri açmadığı için iptal sunumda denetlenemez;
bunun yerine ZK sunumu yalnız kimlik belgesinin kısa ömürlü kopyalarıyla (en çok 24 saat geçerli, cüzdanın kendiliğinden
yenilediği) yapılır ([[ADR-0044]]). İptal edilen belgenin kopyası yenilenmez; ispat kopyanın türünü bağladığı için doğrulayıcı
kısa ömrü görür. Kopya kullanılmayan (işaretsiz) bir ZK sunumunu doğrulayıcı yalnız politikasında `accept_unrevocable_zk` açıkça
yazılıysa kabul eder.

## Doğrulayıcının yükümlülükleri

- Alanların **değerlerini** ve iptal indeksini günlüğe yazmayın; yalnız alan adlarını.
- Kaydınızın kapsamı dışında alan istemeyin.
- Kişi, cüzdandan size silme talebi gönderebilir; kayıtlı iletişim kanalınızı güncel tutun.

## Ayrıntı

- Cüzdan kuralları: [[SPEC-WALLET-0001]]
- Takma ad: [[ADR-0031]], sıfır bilgi ispatı: [[ADR-0032]], [[ADR-0044]]
