---
document_id: ADR-0008
title: Status List Yerleşimi — Off-Chain Liste, On-Chain Çapa
category: ADR
domain: Credential
status: Active
review_status: Draft
version: 1.0.0
created: 2026-09-09
last_updated: 2026-09-09
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - adr
  - revocation
  - status-list
  - privacy
  - blockchain
keywords:
  - IETF Token Status List
  - bitstring status list
  - revocation timing leak
  - herd privacy
  - StatusListRegistry contract rewrite
  - status list anchor
summary: >
  Depoda kod ile spesifikasyon çelişiyordu: SPEC-CRED-0001 §5 "liste off-chain,
  pointer on-chain" derken StatusListRegistry.sol bitmap'i zincirde tutuyordu
  (_setBit, getChunk). Bu ADR çelişkiyi kapatır. Karar: bitstring listesi
  off-chain, issuer tarafından imzalı Status List Token olarak host edilir;
  zincirde yalnızca URI + içerik hash'i + sürüm + boyut çapası durur. Ana
  gerekçe mahremiyettir: her iptali zincire yazmak, izinli bir ağda tüm
  validator'lara iptal ANINI sızdırır ve blok zaman damgası ile birleşince
  belge sahibini daraltır. StatusListRegistry.sol yeniden yazılacaktır.
priority: Critical
related:
  - SPEC-CRED-0001
  - SPEC-CRED-0003
  - SPEC-BC-0001
  - PM-TRUST-0001
  - ADR-0006
  - ADR-0007
---

# ADR-0008 — Status List Yerleşimi

**Durum: Accepted** ✅ (2026-09-09)

---

# Bağlam

## Tespit edilen çelişki

2026-09-09 depo denetiminde, iptal mekanizmasının **iki farklı yerde iki farklı
şekilde** tanımlandığı bulundu:

**[[SPEC-CRED-0001]] §5 diyor ki:**

> Liste off-chain (issuer host eder, imzalı/versiyonlu); zincirde yalnızca URI +
> hash + versiyon + bitmap.

(Cümlenin sonundaki "+ bitmap" ifadesi zaten kendi içinde tutarsızdır — liste
off-chain ise bitmap zincirde ne arıyor?)

**`contracts/src/revocation/StatusListRegistry.sol` ise şunu yapıyor:**

```solidity
function setRevoked(bytes32 issuerId, uint256 index) public onlyIssuer(issuerId)
function setRevokedBatch(bytes32 issuerId, uint256[] calldata indexes) external
function getChunk(bytes32 issuerId, uint256 chunkIndex) external view returns (uint256)
function _setBit(bytes32 issuerId, uint256 index, bool value) private
```

Yani bitmap **zincirde**, 256-bit chunk'lar hâlinde. Her iptal bir zincir
işlemi.

İkisi aynı anda doğru olamaz. Bu ADR çelişkiyi kapatır.

## Neden şimdi

Bu, kodun yazıldığı anda fark edilmeyen bir tasarım ayrımıdır ve
[[SPEC-BC-0001]]'in "Yaklaşım B (bitstring)" kararının **iki farklı okuması**
olmasından kaynaklanır. "Bitstring" veri yapısını tanımlar; **nerede
durduğunu** tanımlamaz. Karar kütüğüne bitstring seçildi diye geçmiş, yerleşim
sorusu hiç sorulmamış.

---

# Karar

## Karar 1 — Bitstring listesi off-chain durur

İptal listesi, IETF Token Status List (draft-ietf-oauth-status-list) uyarınca
**imzalı bir Status List Token** olarak issuer tarafından yayınlanır:

```
https://status.<issuer-domain>/v1/statuslist/<listId>
```

Token, issuer'ın credential imzalama anahtarıyla **aynı güven zincirine** bağlı
bir anahtarla imzalanır ([[SPEC-ID-0002]] X.509). İçeriği sıkıştırılmış
bitstring'dir.

## Karar 2 — Zincir yalnızca çapa tutar

`StatusListRegistry` kontratı şunu tutar:

```
listId        = keccak256(issuerId, listURI)
issuerId      bytes32
listURI       string
contentHash   bytes32     // yayınlanan Status List Token'ın hash'i
listSize      uint256     // min 100.000 (mahremiyet tabanı korunur)
version       uint64      // her yayında artar
publishedAt   uint64
status        {ACTIVE, RETIRED}
```

Zincirde **tek bir bit bile** iptal verisi yoktur.

## Karar 3 — Yayın döngüsü sabit ve gürültülüdür

Issuer, listeyi **sabit aralıklarla** yeniden yayınlar (öneri: 1 saat) —
o aralıkta iptal olsa da olmasa da. Her yayında `contentHash` ve `version`
zincirde güncellenir.

Bu, Karar 1'in mahremiyet faydasını korumak için **zorunludur.** Yalnızca iptal
olduğunda yayınlarsak, zincirdeki güncelleme işleminin kendisi "bu saatte bir
iptal oldu" bilgisini sızdırır — yani kaçtığımız problemi geri getiririz.

## Karar 4 — `StatusListRegistry.sol` yeniden yazılacaktır

`_setBit`, `getChunk`, `setRevoked`, `setRevokedBatch`, `unsetRevoked`
fonksiyonları **kaldırılır.** Yerlerine `publishList(...)` ve
`getListAnchor(...)` gelir.

`ITrustQueries.sol` içindeki `IStatusList.isRevoked(issuerId, index)` arayüzü de
**kaldırılır** — zincir artık bu soruyu cevaplayamaz ve cevaplayacakmış gibi
görünen bir arayüz bırakmak tehlikelidir.

## Karar 5 — Doğrulama akışı

Verifier:

1. Credential'ın `status` claim'inden `listURI` + `index` alınır.
2. Status List Token indirilir (veya önbellekten alınır).
3. Token'ın imzası doğrulanır.
4. Token'ın hash'i, zincirdeki `contentHash` ile karşılaştırılır.
5. `version` yeterince taze mi kontrol edilir (politika: örn. son 24 saat).
6. Bitstring'de `index` okunur.

Adım 4 kritiktir: issuer'ın kendi sunucusunda listeyi sessizce geri alması
(iptal edilmiş bir belgeyi "geçerli" göstermesi) böyle engellenir.

---

# Gerekçe

## 1. Mahremiyet — asıl gerekçe bu

On-chain bitmap'in en ciddi problemi gas değil, **iptal anının sızması**dır.

İzinli bir ağda her işlem her validator'a görünür ve blok zaman damgası taşır.
`setRevoked(issuerId, 4711)` işlemi zincire yazıldığında şu bilgi ağdaki tüm
devletlerin eline geçer:

> "X Üniversitesi, 14 Mart 2027 saat 10:42'de, 4711 numaralı indeksteki belgeyi
> iptal etti."

Tek başına bu, index'in kime ait olduğunu söylemez. Ama korelasyonla daraltır:

- Bir üniversite disiplin kararıyla diplomayı iptal ettiğinde, o kararın tarihi
  genelde bilinir veya kamuya açıktır.
- Bir kurumdan ayrılan çalışanın credential'ı ayrılış günü iptal edilir. İşten
  ayrılma tarihi ile zincirdeki damga eşleşir.
- Toplu iptal (bir bölümün kapanması) zincirde belirgin bir küme olarak görünür.

Off-chain + sabit aralıklı yayın bunu kapatır: dışarıdan görünen tek şey
"listenin yeni bir sürümü yayınlandı"dır. Hangi bit değişti, hatta bir bitin
değişip değişmediği bile görünmez.

Bu, [[PM-TRUST-0001]]'in "ilişkilendirilebilir hash bile riskli" ilkesiyle aynı
mantığın zaman boyutundaki uygulamasıdır.

## 2. Standart uyumu

[[ADR-0006]] revocation'ı **Token Status List**'e devretti. O standardın
mimarisi zaten "issuer bir token yayınlar, verifier onu çeker" şeklindedir.
Bitmap'i zincire koymak, standardın veri yapısını alıp taşıma modelini
terk etmek olurdu — yani yarım uyum. Yarım uyum, dış cüzdanlarla ve dış
verifier'larla çalışmayı bozar.

## 3. Maliyet ve ölçek

İzinli ağda gas ücretsiz olsa bile, zincir durumu (state) her validator'ın
diskinde tutulur ve sonsuza kadar kalır.

Kaba büyüklük: tek bir üniversite için 100.000 indekslik liste = 12,5 KB
bitmap. Türkiye'de ~200 yükseköğretim kurumu → 2,5 MB. Türk dünyası ölçeğinde
binlerce issuer × liste büyümesi → onlarca MB kalıcı durum, üstelik her
iptalde bir işlem ve bir blok.

Off-chain'de aynı veri CDN'den servis edilir, sıfır zincir durumu tüketir.

## 4. Ölçeklenebilirlik ve tazelik dengesi

Off-chain liste, verifier tarafında agresif önbelleklenebilir. On-chain okuma
her seferinde RPC node'a gitmeyi gerektirir — ve doğrulama, ağın en sık yapılan
işlemidir.

## 5. [[ADR-0007]] ile aynı desen

Şema kaydı da aynı deseni kullanıyor: **içerik off-chain, çapa on-chain.**
İki farklı desen kullanmak, hem kodu hem zihinsel modeli gereksiz yere ikiye
böler. Tek desen: *zincir, dış dünyadaki bir dokümanın hangi sürümünün geçerli
olduğunu söyler.*

---

# Değerlendirilen Alternatifler

## A — Bitmap tamamen zincirde (mevcut kod) — Reddedildi

- **Artı:** Tek kaynak; verifier ek HTTP çağrısı yapmaz; issuer'ın sunucusu
  çökse de iptal bilgisi ayakta.
- **Eksi:** İptal anı sızıntısı (§1), kalıcı durum maliyeti, standarttan
  sapma, RPC bağımlılığı.

Reddedildi. Tek gerçek avantajı olan "issuer sunucusu çökerse" senaryosu,
Karar 5 adım 4 + önbellekleme ile yeterince karşılanır.

## B — Kriptografik akümülatör / ZK iptal — Ertelendi

Merkle/RSA akümülatörü veya ZK üyelik ispatı ile iptal, mahremiyet açısından
en güçlü çözümdür (verifier hangi index'i sorguladığını bile açığa vurmaz).

Reddedilmedi, **ertelendi.** Gerekçe: olgun kütüphane ve cüzdan desteği yok,
[[ADR-0006]]'nın ES256 tabanı ile uyumu ek araştırma gerektirir, ve pilotu
gereksiz yere karmaşıklaştırır. `RS-REVOCATION-0001` bunu Faz 2 için
değerlendirecektir.

## C — Kısa ömürlü credential (iptal yok) — Kısmen benimsendi

İptali tamamen ortadan kaldırmanın yolu, credential'ı çok kısa ömürlü yapıp
sürekli yenilemektir.

- **Öğrenci belgesi** için doğru cevap budur: 30 gün TTL, iptal listesine hiç
  girmez.
- **Diploma** için yanlıştır: diploma kalıcıdır, sürekli yenilenmesi hem
  issuer'a yük hem de her yenilemede issuer'a "bu kişi hâlâ aktif" sinyali verir
  (takip yüzeyi).

**Benimsenen:** Karma. Şema bazında TTL politikası [[SPEC-SCHEMA-0002]]'de
tanımlanır; kısa ömürlü tipler status list kullanmaz.

## D — Hibrit: acil iptal zincirde, normal iptal off-chain — Reddedildi

"Kritik iptaller anında zincire yazılsın" fikri cazip görünür ama en kötü
mahremiyet sonucunu üretir: zincire yazılan iptal, **tam da en hassas olan**
iptaldir. Sızıntıyı azaltmaz, yoğunlaştırır.

---

# Sonuçlar

## Bağlayıcı

1. `StatusListRegistry.sol` **yeniden yazılır** (Karar 4). Mevcut bitmap
   mantığı kaldırılır.
2. `ITrustQueries.sol` → `IStatusList.isRevoked` **kaldırılır.**
3. `CredentialGate.sol` içindeki `CredentialRevoked` kontrolü, zincirden okuma
   yapamayacağı için yeniden düşünülmelidir. Zincir-üstü credential-gating
   ([[ADR-0003]] Karar 4) artık iptal durumunu **doğrudan** göremez; iptal
   kontrolü çağıran tarafın sunduğu taze bir kanıta dayanmak zorundadır. Bu,
   [[ADR-0003]]'ün bir sonucunu daraltır ve `SPEC-AGENT-0001`'de ele alınacaktır.
4. [[SPEC-CRED-0001]] §5'teki "+ bitmap" ifadesi düzeltilir.
5. [[SPEC-CRED-0003]] bu kararı normatif olarak yazar: token formatı, yayın
   döngüsü, önbellek politikası, tazelik eşiği.
6. `status.<issuer-domain>` her issuer için işletilen bir bileşendir —
   [[ARCH-0004]] envanterine ve issuer onboarding kontrol listesine girer.

## Kabul edilen ödünleşimler

- **Issuer'a operasyon yükü.** Her issuer artık bir status sunucusu
  işletmek zorunda. Küçük kurumlar için Tamga barındırma hizmeti sunabilir —
  ama o zaman Tamga tüm iptalleri görür. Bu bir merkezîleşme noktasıdır ve
  [[PM-GOV-0001]]'de politika olarak ele alınmalıdır.
- **Tazelik penceresi.** Sabit aralıklı yayın, en kötü durumda bir yayın
  aralığı kadar (1 saat) gecikme demektir. Anında iptal gerektiren senaryolar
  için Karar 3'ün aralığı şema bazında kısaltılabilir.
- **Ek ağ çağrısı.** Verifier doğrulamada bir HTTP isteği daha yapar.
  Önbellekleme ile pratikte ihmal edilebilir.

---

# İlişkiler

**Düzeltir:** [[SPEC-CRED-0001]] §5 (çelişki) · `StatusListRegistry.sol`
**Dayanır:** [[ADR-0006]] · [[PM-TRUST-0001]]
**Uygular:** [[SPEC-CRED-0003]] · [[SPEC-BC-0001]] (yeniden yazım)
**Daraltır:** [[ADR-0003]] Karar 4 (credential-gating iptal görünürlüğü)
**Kardeş karar:** [[ADR-0007]] (aynı off-chain içerik + on-chain çapa deseni)
**Erteler:** `RS-REVOCATION-0001` (akümülatör/ZK, Faz 2)

---

# Durum

**Accepted** ✅ — 2026-09-09. [[DECISIONS]]'a `D-REV-1` olarak işlenecek ve
D-NET/D-CRED bölümlerindeki ilgili satırlar güncellenecektir.
