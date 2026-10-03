---
title: Federasyon
---

# Federasyon

Tamga Network tek bir merkezden yönetilen bir liste değildir. Her ülke kendi kurumlarını kendi [[t:trust-list|güven listesinde]]
tutar; Tamga bu listeleri toplar ve birbirine tanıtır. Bu modele **[[t:federation|federasyon]]** denir ([[ADR-0035]]).

## Tek çapa, çok liste

Cüzdan ve doğrulayıcı yalnız bir şeyi önceden bilir: Tamga'nın listeler listesini ([[t:LOTL]]) imzalayan kökün parmak izi.
Geri kalanını LOTL söyler:

```
                     Tamga LOTL (kök parmak izi uygulamada sabit)
                ┌──────────────┼──────────────────────┐
                ▼              ▼                      ▼
        Türkiye listesi   başka bir üye ülke     dış liste (ör. AB'nin
        (Tamga biçimi)    (ayrılmış)             cüzdan sağlayıcıları, ETSI)
           │                                          │
   belge verenler, doğrulayıcılar,          yalnız kapsamındaki roller
   kök sertifikalar                         ve belge türleri
```

- **Ulusal listeler** Tamga biçimindedir; o ülkenin [[t:issuer|belge verenlerini]], [[t:verifier|doğrulayıcılarını]] ve kök
  sertifikalarını taşır.
- **Dış listeler** ülkelerin ya da AB'nin kendi ETSI biçimindeki listeleridir ([[t:LoTE]]). LOTL onların adresini, imzacısını ve
  neye kefil olabileceklerini (kapsam) yazar ([[ADR-0036]]).

## Neden federasyon?

| Soru | Cevap |
|---|---|
| Kurumu kim tanır? | Kendi ülkesi. Tamga bir ülkenin yerine karar vermez; bugün Türkiye için vekâleten yaptığı işler devredilebilir. |
| Başka ülkenin belgesi kabul edilir mi? | Ülke o ülkeyi tanıyorsa evet (karşılıklı tanıma; doğrulamada C3 adımı). |
| AB cüzdanı Tamga kurumundan belge alabilir mi? | O cüzdanın sağlayıcısına kefil olan bir dış liste LOTL'a eklendiyse evet. |
| Bir liste bozulursa? | Yalnız o listeye bağlı sorular "bilinmiyor" döner; diğer listeler etkilenmez. |

## Kapsam sınırı

Bir dış liste yalnız kendi kapsamındaki işlere kefil olabilir. Örneğin yalnız kimlik sağlayıcılarına kefil olan bir liste,
diploma veren bir kurum ekleyemez; böyle bir kayıt yok sayılır. Bugün LOTL'da dış liste yoktur; her ekleme ayrı bir onaydır.

## Devir

Bugün Türkiye listesini, kayıt kurumunu ve kök sertifikayı Tamga vekâleten işletir. Devlet bu rolleri devraldığında cüzdan ve
doğrulayıcılarda yalnız adres ve imzacı değişir; kurum kimlikleri ve verilmiş belgeler geçerli kalır.

## İleride: ortak defter

En az iki bağımsız işletmeci katıldığında aynı kayıtlar izinli bir [[t:ledger|ortak deftere]] taşınabilir ([[ADR-0009]]). Okuma
arayüzü (`TrustSource`) aynı kalır; uygulamalar değişmez.

## Daha fazlası

- Ülke listesini bağlamak: [[GUIDE-0011]]
- Listeleri kodda okumak: [[GUIDE-0006]]
- Biçim: [[SPEC-TRUST-0001]] · Kural: [[ADR-0036]]
