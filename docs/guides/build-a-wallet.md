---
document_id: GUIDE-0005
title: "Cüzdan geliştirmek"
status: Active
version: 1.1.1
created: 2026-09-27
last_updated: 2026-10-03
summary: >
  Tamga belgelerini alan, saklayan ve gösteren bir cüzdan geliştirmek: cüzdan sağlayıcısı olarak kayıt, cihaz anahtarları,
  cihaz kanıtı (App Attest, Android anahtar kanıtı), Wallet Unit Attestation (WUA), OpenID4VCI ile belge alma, OpenID4VP ile
  selective disclosure, onay ekranı, işlem günlüğü ve dışa aktarma, cihaz değiştirme, yayın öncesi kontrol ve uyulması gereken kurallar. Referans uygulama Tamga Wallet (ayrı depo, Expo) bu paketi kullanır.
---

# Tamga uyumlu cüzdan geliştirmek

Bu rehber, Tamga belgelerini alan, saklayan ve gösteren bir cüzdan yapmak isteyen geliştiriciler içindir.

**Ne zaman okunur:** kendi cüzdan uygulamanızı Tamga'ya bağlamak istediğinizde. Önce [Belge verme](/concepts/issuance) ve
[Belge gösterme](/concepts/presentation) kavramlarına göz atın; kuralların tamamı [[SPEC-WALLET-0001]]'dedir.

## Nasıl çalışır?

Tamga açık bir ekosistemdir: Tamga Wallet tek cüzdan değildir. Kurallara uyan her cüzdan, [[t:trust-list|güven listesine]]
**[[t:wallet-provider|cüzdan sağlayıcısı]]** olarak kaydolup Tamga [[t:credential|belgelerini]] alabilir. Bir cüzdanın işi dört adımdır:

1. **Kendini tanıtmak:** cüzdan sağlayıcısından kısa ömürlü bir [[t:WUA]] alır.
2. **Belge almak:** kurumun teklifini açar, belgeyi [[t:OpenID4VCI]] ile alır; her kopya cihazda üretilmiş ayrı bir anahtara bağlıdır.
3. **Belge göstermek:** [[t:verifier|doğrulayıcının]] isteğini denetler, kişiye istenen alanları tek tek gösterir, onayla yalnızca onları gönderir.
4. **Güveni okumak:** [[t:issuer|belge verenleri]] ve doğrulayıcıları imzalı güven listelerinden tanır.

`@tamga-network/wallet-core` bu akışların çekirdeğidir. Saf TypeScript'tir; Node'da ve React Native'de (Hermes) çalışır,
Node API'si kullanmaz.

```sh
npm install @tamga-network/wallet-core @tamga-network/trust
```

## 1. Proje kurulumu

Çekirdek saf TypeScript olduğu için her ortamda aynıdır; platforma bağlı üç parçayı siz verirsiniz:

| Parça | Ne | Referans uygulamada |
|---|---|---|
| Anahtar arka ucu | Cihazın güvenli bölgesinde P-256 anahtar üretme ve imzalama (`NativeKeyBackend`) | Yerel modül `TamgaKeys` (iOS Secure Enclave, Android StrongBox/TEE) |
| İmza doğrulayıcı | Güven listesi imzalarını doğrulayan fonksiyon (`@tamga-network/trust/core`'a verilir) | Saf TypeScript kriptografi kütüphanesiyle |
| Kalıcı depo | Cüzdan durumunu (`WalletState`) şifreli saklamak | Cihaz anahtarlığında duran bir anahtarla şifreli dosya |

- **React Native / Expo:** yerel modül gerektiği için Expo Go yetmez; geliştirme derlemesi (`expo run:ios`, `expo run:android`)
  kullanın. Expo Go'da çekirdek yazılım anahtarına düşer; bu yalnız denemedir.
- **Sabitlenecek değerler:** cüzdan sağlayıcısının adresi, güven listesinin adresi (`https://trust.tamga.network`) ve kök
  parmak izleri (`TRUST_PINS`, `tamga.network/trust-anchor`'dan). Bunlar uygulamaya gömülür; sunucudan okunmaz.

## 2. Önce kayıt: cüzdan sağlayıcısı olmak

Bir kurum, belge vermeden önce cüzdanın kim olduğunu ve anahtarı nerede tuttuğunu doğrular. Bunun için cüzdan çözümünüz
güven listesinde `lotl › wallet_providers[]` altında kayıtlı olmalıdır:

1. Cüzdan çözümü beyanı: platformlar, anahtar deposu seviyesi (asgari W2: cihazın güvenli bölgesi), PIN/biyometri, yedek modeli.
2. WUA'yı imzaladığınız anahtar listeye eklenir. Kayıt şartları: [Tamga ARF — Ek A §3.2](https://arf.tamga.network/tr/trust-framework).
3. Kayıt olana kadar Tamga'nın cüzdan sağlayıcısını (`wallet.tamga.network`) kullanarak geliştirebilirsiniz.

## 3. Cihaz anahtarları

Her belge kopyası cihazda üretilen ayrı bir anahtara bağlıdır. Anahtar cihazdan çıkmaz, dışa aktarılmaz, bir tohumdan
türetilmez. Çekirdek anahtarı kendisi tutmaz; siz `KeyProvider` arayüzünü platformunuzun güvenli bölgesiyle uygularsınız:

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

Hazır bir sağlayıcı da vardır: `HardwareKeyProvider` yerel arka uç varsa yeni anahtarları güvenli bölgede üretir, yoksa
verdiğiniz yazılım sağlayıcısına düşer:

```ts
import { HardwareKeyProvider, SoftwareKeyProvider } from "@tamga-network/wallet-core";

const keys = new HardwareKeyProvider(
  TamgaKeys, // NativeKeyBackend ya da null
  new SoftwareKeyProvider(store, { randomBytes, platform: "test" }),
  { platform: "ios 18.0" },
);
```

| Depo | Seviye | Belge alır mı |
|---|---|---|
| iOS Secure Enclave, Android StrongBox | W3 | Evet |
| Android TEE | W2 (asgari) | Evet |
| Yazılım | W1 | Hayır — yalnız test ve demo ([[SPEC-WALLET-0001]] WL3) |

`SoftwareKeyProvider` yalnızca test ve demo içindir; pilotta yazılım anahtarlı cüzdana belge verilmez.

## 4. Cihaz kanıtı: App Attest ve Android anahtar kanıtı

Cüzdan sağlayıcısı, anahtarın gerçekten güvenli bölgede olduğuna cihazın beyanıyla değil, **platformun imzalı kanıtıyla** karar
verir. Kanıt doğrulanmadıkça birim yazılım seviyesinde sayılır.

| Platform | Kanıt | Ne doğrulanır |
|---|---|---|
| Android | Anahtar kanıtı zinciri (key attestation) | Zincir Google donanım köküne bağlı; tek kullanımlık değer; güvenlik seviyesi (TEE / StrongBox); doğrulanmış açılış; uygulama paket adı |
| iOS | Apple App Attest | Kanıt Apple köküne bağlı; uygulama kimliği (Team ID + Bundle ID); istemci verisi birim anahtarının parmak izini taşır |

Birimi ilk kurulumda kaydedin ve kanıtı `deviceEvidence` ile verin:

```ts
import { registerUnit, unitClientData, UNIT_REF, fetchHttp } from "@tamga-network/wallet-core";

const { unitId, keyStorage } = await registerUnit({
  providerBase: "https://wallet.tamga.network",
  keys,
  http: fetchHttp,
  appVersion: "1.0.0",
  platform: "android 15",
  deviceEvidence: async ({ challenge, unitThumbprint }) => {
    if (os === "android") {
      const chain = keys.keyEvidence(UNIT_REF); // birim anahtarı meydan okumayla üretildi; zincir hazır
      return chain ? { platform: "android", key_attestation: chain } : undefined;
    }
    const hash = base64(sha256(unitClientData(challenge, unitThumbprint)));
    return { platform: "ios", app_attest: await TamgaKeys.appAttest(hash) };
  },
});
```

Kanıt reddedilirse `registerUnit` kanıtsız yeniden dener; birim yazılım seviyesinde kaydolur ve `keyStorage` bunu söyler.
Kişiye bu cihazda yüksek güvenlikli belge alınamayacağını söyleyin; sessizce devam etmeyin.

::: info Mağaza sürümü
Cihaz kanıtı mağaza sürümüyle zorunlu olur. Android'de uygulamanın mağazadan geldiğini ayrıca gösteren Play Integrity kanıtı da
o adımda eklenir; bugün Android'de donanım anahtar kanıtı, iOS'ta App Attest doğrulanır.
:::

## 5. Wallet Unit Attestation (WUA)

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

Kanıt, belge alma sırasında kurumun token isteğine eklenir. Süresi dolmadan yenileyin (`wuaExpiringSoon`).

Kayıtlı bir birim için iki kanıt daha vardır: her belge işlemi için yeni ve kısa ömürlü (24 saatten az) bir cüzdan örneği
kanıtı ([[t:WIA]], `requestWia`) ve belge anahtarlarının güvenli bölgede olduğunu gösteren anahtar kanıtı ([[t:key-attestation|KA]],
`requestKeyAttestation`). Sağlayıcı ikisi için de iptal listesi yayınlar; kişi cihazını devrederken `revokeUnit` hepsini iptal eder.

## 6. Belge almak (OpenID4VCI)

Kişi kurumun gösterdiği QR'ı okutur; PIN (`tx_code`) **ayrı bir kanaldan** (SMS, e-posta) gelir:

```ts
import { parseOffer, resolveOffer, redeem, receiveCredentials, newState } from "@tamga-network/wallet-core";

const offer = await resolveOffer(parseOffer(scannedQr), fetchHttp);
const out = await redeem({ offer, txCode: pinFromUser, keys, http: fetchHttp, wua }); // 10 kopya, her biri ayrı anahtar
const { state, credential } = receiveCredentials(walletState, out); // her kopya kendi anahtarına bağlı mı — yerel doğrulama
```

Kimlik belgesi gibi bazı türlerde aynı belgenin [[t:mdoc]] biçimi de gelir (`copy.mdoc`, [[ADR-0013]]); aynı anahtara bağlıdır.

## 7. Göstermek (OpenID4VP)

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

Yanıt şifreli gider (`direct_post.jwt`). `combined`, seçilen kopyanın SD-JWT metnidir.

[[t:intermediary|Aracı]] doğrulayıcı üzerinden gelen istekte (`request.onBehalfOf`) ekranda **asıl sitenin** adını gösterin (`checkRp` bunu verir)
ve kapsamı onun kaydına göre denetleyin; `request.rpKey` kopyayı asıl siteye göre ayırır ([[ADR-0017]]). Referans akış:
Tamga Wallet `app/src/present.ts`.

## 8. Onay ekranı

Kişi neye onay verdiğini ekranda görmelidir. Onay ekranında en az şunlar bulunur:

1. **Kim istiyor:** doğrulayıcının adı (`rp.legalName`), aracı varsa asıl site; kayıtlı değilse ya da kaydı etkin değilse bu
   açıkça yazılır.
2. **Neden:** kayıtlı kapsamdaki amaç, kişinin dilinde; gizlilik politikası bağlantısı.
3. **Ne:** istenen alanlar tek tek, değerleriyle.
4. **Kapsam dışı talep:** kayıtlı kapsamda olmayan her alan (`rp.overAsk`) **ayrı bir görsel blokta** uyarıyla gösterilir ve
   onay düğmesi gecikmeli açılır (WL8).
5. **Şikâyet yolu:** doğrulayıcının veri koruma kurumu ([[ADR-0024]]).
6. **Onay:** PIN ya da biyometri (WL11). Onaysız gösterim yoktur.

Tamamlanamayan gösterim de günlüğe girer (değer olmadan).

## 9. İşlem günlüğü ve dışa aktarma

Her gösterim cihazdaki işlem günlüğüne ([[t:transaction-log]]) yazılır: ne zaman, kime, hangi belge türünden hangi **alan adları**.
Değerler yazılmaz. Günlük sunucuya ve otomatik yedeğe gitmez (WL4); yalnız kişinin kendisi, kendi parolasıyla şifreleyerek
dışa aktarabilir. Biçim AB'nin ortak biçimidir (TS10):

```ts
import { ts10TransactionLog, encryptTs10Async } from "@tamga-network/wallet-core";

const log = ts10TransactionLog(state, lookup); // lookup: doğrulayıcı ve kurum bilgisi imzalı listeden (ts10LookupFromTrust)
const file = await encryptTs10Async(log, password); // PBES2-HS256+A128KW + A128GCM; parola en az 8 karakter
```

## 10. Cihaz değiştirme ve silme

Belge anahtarları cihazdan çıkmadığı için **belgeler taşınmaz** (WL2, WL10). Yeni cihaza taşınan şey belge listesi, ayarlar ve
(kişi isterse) günlüktür; belgeler kurumlardan yeniden alınır:

```ts
import { ts10MigrationData, encryptTs10Async, decryptTs10Async, applyMigration } from "@tamga-network/wallet-core";

// eski cihaz
const exported = await encryptTs10Async(ts10MigrationData(state, lookup, { includeLog: true }), password);
// yeni cihaz
const data = await decryptTs10Async(exported, password);
const { state: next, toReissue } = applyMigration(emptyState, data, { restoreLog: userAgreed });
// toReissue: kişiye "yeniden al" listesi olarak gösterilir
```

- Eski cihazı devrederken birimi iptal edin (`revokeUnit`).
- Kişi her şeyi silmek isterse: cüzdan sağlayıcısında `deleteUnit`, Tamga'nın kimlik servisinde `requestIdentityErasure`.
  Kurumların tuttuğu veri kurumun sorumluluğundadır; cüzdan kişiye kurumun silme başvurusu yolunu gösterir.

## 11. Güven listesi

Cüzdan doğrulayıcı kayıtlarını, belge verenleri ve belge türlerini imzalı güven listelerinden okur. `fetchRpRecord` ve
`fetchTrustSource` listelerin kurallarını `@tamga-network/trust/core`'dan alır ([[ADR-0015]]); cüzdan yalnızca imza
doğrulayıcıyı verir. Listeyi imzalayan kökün, yani [[t:trust-anchor|güven çapasının]], parmak izi uygulamaya **gömülür** (`TRUST_PINS`); liste sunucusuna güvenilmez.
Liste dosyalarını kendiniz yorumlamayın. Ayrıntı: [[GUIDE-0006]].

## 12. Uyulması gereken kurallar

| Kural | Kod |
|---|---|
| Anahtarlar cihazın güvenli bölgesinde; dışa aktarılamaz; yazılım anahtarlı cüzdan desteklenmez | WL1, WL3 |
| Her gösterimde PIN veya biyometri | WL11 |
| Alanlar tek tek gösterilir; kapsam dışı talep ayrı uyarıyla | WL8 |
| Aynı doğrulayıcıya aynı kopya, farklı doğrulayıcıya farklı kopya | WL5, WL6 |
| Gösterim günlüğü cihazda kalır, sunucuya gitmez | WL4 |
| Yedek anahtar taşımaz; yeni cihazda belgeler yeniden alınır | WL2, WL10 |
| Gösterim anında şema sunucusuna istek yok | WL9 |
| Aracı doğrulayıcıda asıl site gösterilir ve kapsamı denetlenir | [[ADR-0017]] HV6 |
| "Geçersiz" ile "doğrulanamadı" farklı gösterilir | [[SPEC-CRED-0003]] S14 |

WL kodları [[SPEC-WALLET-0001]]'dedir. Tam liste: [Tamga ARF — Ek B, RB-WP](https://arf.tamga.network/tr/rulebook).

## 13. Yayın öncesi

Mağazaya göndermeden önce [[GUIDE-0010]] kontrol listesinden geçin ve uyum testlerini koşun ([[GUIDE-0009]]). Gerçek bir telefonla
uçtan uca denemeyi gerçek ağa dokunmadan test ağında yapın ([[GUIDE-0013]]).

## 14. Çalışan kod

- Referans uygulama: Tamga Wallet (ayrı depo; Expo, React Native) — bu çekirdeği kullanır; iOS ve Android'de çalışır.
- Çekirdeğin testleri: `packages/wallet-core/src/*.test.ts` — alma, gösterme, kopya seçimi, güven listesi.
- Geçiş kartı (turnike, etkinlik kapısı): `pass.ts`, [[ADR-0012]].
