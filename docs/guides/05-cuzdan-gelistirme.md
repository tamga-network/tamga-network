---
document_id: GUIDE-0005
title: Tamga Uyumlu Cüzdan Geliştirmek (@tamga-network/wallet-core)
category: Guide
domain: Integration
status: Draft
review_status: Draft
version: 0.1.0
created: 2026-09-27
last_updated: 2026-09-27
authors:
  - Tamga Network Engineering
tags: [guide, wallet, openid4vci, openid4vp, wua]
keywords: [wallet-core, KeyProvider, redeem, receiveCredentials, matchDcql, checkRp, respond, requestWua, cüzdan sağlayıcısı]
summary: >
  Tamga belgelerini alan, saklayan ve sunan bir cüzdan geliştirmek: cüzdan sağlayıcısı olarak kayıt, cihaz anahtarları,
  cüzdan birimi onayı (WUA), OpenID4VCI ile belge alma, OpenID4VP ile seçici sunum, doğrulayıcı başına ayrı kopya ve uyulması
  gereken kurallar. Referans uygulama Tamga Wallet (`apps/wallet`, Expo) bu paketi kullanır.
priority: High
language: tr
audience: [wallet-developers, engineers]
related: ["[[SPEC-WALLET-0001]]", "[[SPEC-PROTO-0001]]", "[[SPEC-PROTO-0002]]", "[[SPEC-CRED-0001]]", "[[ADR-0012]]", "[[ADR-0015]]", "[[ADR-0017]]"]
---

# Tamga uyumlu cüzdan geliştirmek

Tamga açık bir ekosistemdir: Tamga Wallet tek cüzdan değildir. Kurallara uyan her cüzdan, güven listesine **cüzdan sağlayıcısı**
(Wallet Provider) olarak kaydolup Tamga belgelerini alabilir. Bu rehber, `@tamga-network/wallet-core` ile bir cüzdanın temel
akışlarını anlatır. Çekirdek saf TypeScript'tir; Node'da ve React Native'de (Hermes) çalışır, Node API'si kullanmaz.

```sh
npm install @tamga-network/wallet-core @tamga-network/trust
```

## 1. Önce kayıt: cüzdan sağlayıcısı olmak

Bir kurum, belge vermeden önce cüzdanın kim olduğunu ve anahtarı nerede tuttuğunu doğrular (WUA). Bunun için cüzdan çözümünüz
güven listesinde `lotl › wallet_providers[]` altında kayıtlı olmalıdır:

1. Cüzdan çözümü beyanı: platformlar, anahtar deposu seviyesi (W2 cihaz güvenli bölgesi asgari), PIN/biyometri, yedek modeli.
2. WUA imza anahtarınız listeye eklenir. Kayıt şartları: [Tamga ARF — Ek A §3.2](https://arf.tamga.network/tr/annex-a-trust-framework).
3. Kayıt olana kadar Tamga'nın cüzdan sağlayıcısını (`wallet.tamga.network`) kullanarak geliştirebilirsiniz.

## 2. Cihaz anahtarları

Her belge kopyası cihazda üretilen ayrı bir anahtara bağlıdır. Anahtar cihazdan çıkmaz, dışa aktarılmaz, bir tohumdan
türetilmez ([[SPEC-WALLET-0001]] WL1). Çekirdek anahtarı kendisi tutmaz; siz `KeyProvider` arayüzünü platformunuzun güvenli
bölgesiyle uygularsınız:

```ts
import type { KeyProvider } from "@tamga-network/wallet-core";

const keys: KeyProvider = {
  generate: (ref) => secureElement.createP256(ref),        // → PublicJwk
  publicKey: (ref) => secureElement.publicJwk(ref),
  sign: (ref, data) => secureElement.signEs256(ref, data), // ham r||s, 64 bayt
  delete: (ref) => secureElement.remove(ref),
  attestation: () => secureElement.keyAttestation(),       // storage: "secure_enclave" | "strongbox" | "wscd"
};
```

`SoftwareKeyProvider` yalnızca test ve demo içindir; pilotta yazılım anahtarlı cüzdana belge verilmez (WL3).

## 3. Cüzdan birimi onayı (WUA)

```ts
import { requestWua, fetchHttp } from "@tamga-network/wallet-core";

const wua = await requestWua({
  providerBase: "https://wallet.tamga.network",
  keys,
  http: fetchHttp,
  appVersion: "1.0.0",
  platform: "ios",
});
```

WUA, belge alma sırasında ihraççının token isteğine eklenir. Süresi dolmadan yenileyin (`wuaExpiringSoon`).

## 4. Belge almak (OpenID4VCI)

Kişi kurumun gösterdiği QR'ı okutur; PIN (`tx_code`) **ayrı bir kanaldan** (SMS, e-posta) gelir:

```ts
import { parseOffer, resolveOffer, redeem, receiveCredentials, newState } from "@tamga-network/wallet-core";

const offer = await resolveOffer(parseOffer(scannedQr), fetchHttp);
const out = await redeem({ offer, txCode: pinFromUser, keys, http: fetchHttp, wua }); // 10 kopya, her biri ayrı anahtar
const { state, credential } = receiveCredentials(walletState, out); // her kopya kendi anahtarına bağlı mı — yerel doğrulama
```

Kimlik belgesi gibi bazı türlerde aynı belgenin mdoc biçimi de gelir (`copy.mdoc`, [[ADR-0013]]); aynı anahtara bağlıdır.

## 5. Sunmak (OpenID4VP)

```ts
import {
  parseVpUri, fetchRequestObject, verifyRequestObject, matchDcql, fetchRpRecord, checkRp, planCopy, respond,
} from "@tamga-network/wallet-core";

const { requestUri, clientId } = parseVpUri(scannedQr);
const request = verifyRequestObject(await fetchRequestObject(requestUri, fetchHttp), clientId); // imza, x5c, profil
const { matches } = matchDcql(request.dcql, state.credentials);
const match = matches[0];

// Doğrulayıcının kaydı imzalı güven listesinden (sabitlenmiş kök); aracı istekte asıl sitenin kaydı da çözülür
const rpRecord = await fetchRpRecord(TRUST_BASE, request.clientId, fetchHttp, TRUST_PINS);
const onBehalf = request.onBehalfOf ? await fetchRpRecord(TRUST_BASE, request.onBehalfOf, fetchHttp, TRUST_PINS) : undefined;
const rp = checkRp(rpRecord, request, match, Date.now(), onBehalf); // kayıtlı mı, etkin mi, kapsam dışı alan (rp.overAsk)

// Ekranda: rp.legalName, amacı, istenen alanlar tek tek; rp.overAsk doluysa ayrı uyarı; onay için PIN/biyometri
const plan = planCopy(match.credential, request.rpKey); // aynı siteye hep aynı kopya; tükendiyse kullanıcıya sor
if (plan.kind !== "exhausted") {
  await respond({ request, keys, http: fetchHttp, matches: [{ match, keyRef: plan.keyRef, combined, disclose: match.requested }] });
}
```

Yanıt şifreli gider (`direct_post.jwt`). Aracı doğrulayıcı üzerinden gelen istekte (`request.onBehalfOf`) ekranda **asıl
sitenin** adını gösterin (`checkRp` bunu verir), kapsamı onun kaydına göre denetleyin; `request.rpKey` kopyayı asıl siteye göre
ayırır ([[ADR-0017]] HV6). `combined` seçilen kopyanın SD-JWT metnidir. Referans akış: `apps/wallet/src/present.ts`.

## 6. Güven listesi

Cüzdan doğrulayıcı kayıtlarını, kurumları ve belge türlerini imzalı güven listelerinden okur. `fetchRpRecord` ve
`fetchTrustSource` listelerin kurallarını `@tamga-network/trust/core`'dan alır ([[ADR-0015]]); cüzdan yalnızca imza
doğrulayıcıyı verir. Listeyi imzalayan kökün parmak izi uygulamaya **gömülür** (`TRUST_PINS`); liste sunucusuna güvenilmez.
Liste dosyalarını kendiniz yorumlamayın. Ayrıntı: [[GUIDE-0006]].

## 7. Uyulması gereken kurallar (özet)

| Kural | Kaynak |
|---|---|
| Anahtarlar cihazın güvenli bölgesinde; dışa aktarılamaz | WL1, WL3 |
| Her sunumda PIN veya biyometri | WL11 |
| Alanlar tek tek gösterilir; kapsam dışı talep ayrı uyarıyla | WL8 |
| Aynı doğrulayıcıya aynı kopya, farklı doğrulayıcıya farklı kopya | WL5, WL6 |
| Sunum günlüğü cihazda kalır, sunucuya gitmez | WL4 |
| Yedek anahtar taşımaz; yeni cihazda belgeler yeniden alınır | WL2, WL10 |
| Sunum anında şema sunucusuna istek yok | WL9 |
| "Geçersiz" ile "doğrulanamadı" farklı gösterilir | S14 |

Tam liste: [Tamga ARF — Ek B, RB-WP](https://arf.tamga.network/tr/annex-b-participant-rules) ve [[SPEC-WALLET-0001]].

## 8. Çalışan kod

- Referans uygulama: `apps/wallet` (Expo, React Native) — bu çekirdeği kullanır; iOS ve Android'de çalışır.
- Çekirdeğin testleri: `packages/wallet-core/src/*.test.ts` — alma, sunma, kopya seçimi, güven listesi.
- Geçiş kartı (turnike, etkinlik kapısı): `pass.ts`, [[ADR-0012]].
