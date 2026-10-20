---
document_id: GUIDE-0005
title: "Rəqəmsal cüzdan hazırlamaq"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-16
summary: >
  Tamga rəqəmsal sənədlərini qəbul edən, saxlayan və təqdim edən rəqəmsal cüzdan hazırlamaq: cüzdan provayderi kimi qeydiyyat, cihaz açarları, cihaz sübutu (App Attest, Android açar sübutu), Wallet Unit Attestation (WUA), OpenID4VCI ilə sənəd almaq, OpenID4VP ilə selective disclosure, razılıq ekranı, əməliyyat jurnalı və ixrac, cihaz dəyişmə, nəşrdən əvvəl yoxlama və riayət edilməli qaydalar. Şəbəkənin ilk cüzdanı olan Tamga Wallet (bir şirkətin ayrıca məhsulu; ayrıca repozitoriya, Expo) bu paketdən istifadə edir.
translation_of: GUIDE-0005
source_version: "1.0.0"
---

# Tamga ilə uyğun rəqəmsal cüzdan hazırlamaq

Bu bələdçi Tamga rəqəmsal sənədlərini qəbul edən, saxlayan və təqdim edən rəqəmsal cüzdan hazırlamaq istəyən tərtibatçılar üçündür.

**Nə vaxt oxumalı:** öz cüzdan tətbiqinizi Tamga-ya qoşmaq istədiyiniz zaman. Əvvəlcə [Sənəd vermə](/concepts/issuance) və
[Sənəd təqdimetmə](/concepts/presentation) anlayışlarına nəzər salın; qaydaların tam siyahısı [[SPEC-WALLET-0001]]-dədir.

## Necə işləyir?

Tamga açıq ekosistemdir: Tamga Wallet yeganə cüzdan deyil. Qaydalara əməl edən hər bir cüzdan [[t:trust-list|etibar siyahısına]]
**[[t:wallet-provider|cüzdan provayderi]]** kimi qeydiyyatdan keçib Tamga [[t:credential|rəqəmsal sənədlərini]] ala bilər. Cüzdanın işi dörd addımdan ibarətdir:

1. **Özünü təqdim etmək:** cüzdan provayderindən qısamüddətli [[t:WUA]] alır.
2. **Sənəd almaq:** qurumun təklifini açır, sənədi [[t:OpenID4VCI]] ilə alır; hər nüsxə cihazda yaradılmış ayrıca açara bağlıdır.
3. **Sənədi təqdim etmək:** [[t:verifier|yoxlayan tərəfin]] sorğusunu yoxlayır, şəxsə tələb olunan sahələri bir-bir göstərir, razılıq verildikdə yalnız onları göndərir.
4. **Etibarı oxumaq:** [[t:issuer|sənədi verən qurumları]] və yoxlayan tərəfləri imzalı etibar siyahılarından tanıyır.

`@tamga-network/wallet-core` bu axınların özəyidir. Təmiz TypeScript-dir; Node-da və React Native-də (Hermes) işləyir,
Node API-sindən istifadə etmir.

```sh
npm install @tamga-network/wallet-core @tamga-network/trust
```

## 1. Layihənin qurulması

Özək təmiz TypeScript olduğu üçün hər mühitdə eynidir; platformadan asılı üç hissəni siz təqdim edirsiniz:

| Hissə | Nədir | Nümunə tətbiqdə (Tamga Wallet) |
|---|---|---|
| Açar backend-i | Cihazın təhlükəsiz zonasında P-256 açarının yaradılması və imzalama (`NativeKeyBackend`) | Yerli modul `TamgaKeys` (iOS Secure Enclave, Android StrongBox/TEE) |
| İmza yoxlayıcısı | Etibar siyahısı imzalarını yoxlayan funksiya (`@tamga-network/trust/core`-yə ötürülür) | Təmiz TypeScript kriptoqrafiya kitabxanası ilə |
| Daimi yaddaş | Cüzdan vəziyyətini (`WalletState`) şifrəli saxlamaq | Cihazın açar anbarında saxlanan açarla şifrələnmiş fayl |

- **React Native / Expo:** yerli modul tələb olunduğu üçün Expo Go kifayət etmir; development build (`expo run:ios`, `expo run:android`)
  istifadə edin. Expo Go-da özək proqram açarına keçir; bu yalnız sınaq üçündür.
- **Sabitlənəcək dəyərlər:** cüzdan provayderinin ünvanı, etibar siyahısının ünvanı (`https://trust.tamga.network`) və kök
  barmaq izləri (`TRUST_PINS`, `tamga.network/trust-anchor`-dən). Bunlar tətbiqə daxil edilir; serverdən oxunmur.

## 2. Əvvəlcə qeydiyyat: cüzdan provayderi olmaq

Qurum sənəd verməzdən əvvəl cüzdanın kim olduğunu və açarı harada saxladığını yoxlayır. Bunun üçün cüzdan həlliniz
etibar siyahısında `lotl › wallet_providers[]` altında qeydiyyatda olmalıdır:

1. Cüzdan həlli bəyannaməsi: platformalar, açar anbarının səviyyəsi (minimum W2: cihazın təhlükəsiz zonası), PIN/biometrika, ehtiyat nüsxə modeli.
2. WUA-nı imzaladığınız açar siyahıya əlavə edilir. Qeydiyyat şərtləri: [Tamga ARF — Əlavə A §3.2](https://arf.tamga.network/az/trust-framework).
3. Cüzdan provayderini siz idarə edirsiniz; şəbəkə cüzdan provayderi idarə etmir ([[ADR-0042]]). Real şəbəkədə qeydiyyatdan keçməzdən əvvəl
   cüzdanınızı sandbox-da sınayın: öz provayderinizi sandbox siyahısında qeydiyyatdan keçirin ([[GUIDE-0013]] §2).

## 3. Cihaz açarları

Hər sənəd nüsxəsi cihazda yaradılan ayrıca açara bağlıdır. Açar cihazdan çıxmır, ixrac edilmir, toxumdan (seed)
törədilmir. Özək açarı özü saxlamır; `KeyProvider` interfeysini siz platformanızın təhlükəsiz zonası ilə həyata keçirirsiniz:

```ts
import type { KeyProvider } from "@tamga-network/wallet-core";

const keys: KeyProvider = {
  generate: (ref) => secureElement.createP256(ref),        // → PublicJwk
  publicKey: (ref) => secureElement.publicJwk(ref),
  sign: (ref, data) => secureElement.signEs256(ref, data), // raw r||s, 64 bytes
  delete: (ref) => secureElement.remove(ref),
  attestation: () => secureElement.keyAttestation(),       // storage: "secure_enclave" | "strongbox" | "wscd"
};
```

Hazır provayder də var: `HardwareKeyProvider` yerli backend olduqda yeni açarları təhlükəsiz zonada yaradır, olmadıqda
verdiyiniz proqram provayderinə keçir:

```ts
import { HardwareKeyProvider, SoftwareKeyProvider } from "@tamga-network/wallet-core";

const keys = new HardwareKeyProvider(
  TamgaKeys, // NativeKeyBackend or null
  new SoftwareKeyProvider(store, { randomBytes, platform: "test" }),
  { platform: "ios 18.0" },
);
```

| Anbar | Səviyyə | Sənəd alırmı |
|---|---|---|
| iOS Secure Enclave, Android StrongBox | W3 | Bəli |
| Android TEE | W2 (minimum) | Bəli |
| Proqram təminatı | W1 | Xeyr — yalnız test və demo ([[SPEC-WALLET-0001]] WL3) |

`SoftwareKeyProvider` yalnız test və demo üçündür; pilotda proqram açarlı cüzdana sənəd verilmir.

## 4. Cihaz sübutu: App Attest və Android açar sübutu

Cüzdan provayderi açarın həqiqətən təhlükəsiz zonada olub-olmadığına cihazın bəyanatına görə deyil, **platformanın imzalı sübutuna** əsasən qərar
verir. Sübut yoxlayan tərəf tərəfindən təsdiqlənmədikcə vahid proqram təminatı səviyyəsində sayılır.

| Platforma | Sübut | Nə yoxlanılır |
|---|---|---|
| Android | Açar sübutu zənciri (key attestation) | Zəncir Google aparat kökünə bağlıdır; birdəfəlik dəyər; təhlükəsizlik səviyyəsi (TEE / StrongBox); təsdiqlənmiş yükləmə; tətbiqin paket adı |
| iOS | Apple App Attest | Sübut Apple kökünə bağlıdır; tətbiq identifikatoru (Team ID + Bundle ID); müştəri məlumatları vahid açarının barmaq izini daşıyır |

Vahidi ilk quraşdırmada qeydiyyatdan keçirin və sübutu `deviceEvidence` ilə təqdim edin:

```ts
// Unit registration and fetching attestations are YOUR wallet provider's own API; the network does not define it (ADR-0042).
// What the network expects: the evidence is the platform's signed attestation, and your provider verifies it and writes the
// verified key-storage level into the WIA/KA.
const unit = await myProvider.registerUnit({
  deviceEvidence: os === "android"
    ? { platform: "android", key_attestation: keys.keyEvidence(UNIT_KEY) } // chain of the key generated with the challenge
    : { platform: "ios", app_attest: await appAttest(clientDataHash) }, // client data carries the unit key's thumbprint
});
```

Sübut rədd edilərsə, vahid proqram səviyyəsində qeydiyyata alınır; provayderiniz bunu sübutlarda açıq şəkildə qeyd edir.
Şəxsə bu cihazda yüksək təhlükəsizlikli sənəd almağın mümkün olmadığını bildirin; səssizcə davam etməyin.

::: info Mağaza versiyası
Cihaz sübutu mağaza versiyası ilə məcburi olur. Android-də tətbiqin mağazadan gəldiyini əlavə olaraq göstərən Play Integrity sübutu da
həmin mərhələdə əlavə edilir; bu gün Android-də aparat açar sübutu, iOS-da isə App Attest yoxlanılır.
:::

## 5. Wallet Unit Attestation (WUA)

```ts
import { clientAttestationPop, wuaExpiringSoon, type WuaRecord } from "@tamga-network/wallet-core";

const wia: WuaRecord = await myProvider.requestWia(unit); // from your own provider (a JWT in EU TS3 form)
const pop = await clientAttestationPop({ keys, wua: wia, aud: credentialIssuer }); // added to the institution's token request
```

Sübut sənəd alma zamanı qurumun token sorğusuna əlavə edilir. Müddəti bitməzdən əvvəl yeniləyin (`wuaExpiringSoon`).

Qeydiyyatlı vahid üçün daha iki sübut var: hər sənəd əməliyyatı üçün yeni və qısamüddətli (24 saatdan az) cüzdan nümunəsi
sübutu ([[t:WIA]]) və sənəd açarlarının təhlükəsiz zonada olduğunu göstərən açar sübutu ([[t:key-attestation|KA]]).
Provayder hər ikisi üçün ləğv siyahısı dərc edir (`wiaRevokedByList` ilə yoxlanılır); şəxs cihazını başqasına verərkən vahid ləğv edilir.

## 6. Sənəd almaq (OpenID4VCI)

Şəxs qurumun göstərdiyi QR kodu skan edir; PIN (`tx_code`) **ayrıca kanalla** (SMS, e-poçt) gəlir:

```ts
import { parseOffer, resolveOffer, redeem, receiveCredentials, newState } from "@tamga-network/wallet-core";

const offer = await resolveOffer(parseOffer(scannedQr), fetchHttp);
const out = await redeem({ offer, txCode: pinFromUser, keys, http: fetchHttp, wua }); // 10 copies, each with its own key
const { state, credential } = receiveCredentials(walletState, out); // is each copy bound to its own key — local check
```

Şəxsiyyət sənədi kimi bəzi növlərdə eyni sənədin [[t:mdoc]] formatı da gəlir (`copy.mdoc`, [[ADR-0013]]); o da eyni açara bağlıdır.

## 7. Təqdim etmək (OpenID4VP)

```ts
import {
  parseVpUri, fetchRequestObject, verifyRequestObject, matchDcql, fetchRpRecord, checkRp, planCopy, respond,
} from "@tamga-network/wallet-core";

const { requestUri, clientId } = parseVpUri(scannedQr);
const request = verifyRequestObject(await fetchRequestObject(requestUri, fetchHttp), clientId); // signature, x5c, profile
const { matches } = matchDcql(request.dcql, state.credentials);
const match = matches[0];

// The verifier's entry from the signed trust list (pinned root); for an intermediary request the actual site's entry too
const rpRecord = await fetchRpRecord(TRUST_BASE, request.clientId, fetchHttp, TRUST_PINS);
const onBehalf = request.onBehalfOf ? await fetchRpRecord(TRUST_BASE, request.onBehalfOf, fetchHttp, TRUST_PINS) : undefined;
const rp = checkRp(rpRecord, request, match, Date.now(), onBehalf); // registered, active, out-of-scope fields (rp.overAsk)

// On screen: rp.legalName, the purpose, the requested fields one by one; a separate warning if rp.overAsk is set; PIN/biometrics to approve
const plan = planCopy(match.credential, request.rpKey); // always the same copy for the same site; if exhausted, ask the user
if (plan.kind !== "exhausted") {
  await respond({ request, keys, http: fetchHttp, matches: [{ match, keyRef: plan.keyRef, combined, disclose: match.requested }] });
}
```

Cavab şifrəli göndərilir (`direct_post.jwt`). `combined` seçilmiş nüsxənin SD-JWT mətnidir.

[[t:intermediary|Vasitəçi]] yoxlayan tərəf vasitəsilə gələn sorğuda (`request.onBehalfOf`) ekranda **əsas saytın** adını göstərin (`checkRp` bunu təqdim edir)
və əhatə dairəsini onun qeydiyyatına əsasən yoxlayın; `request.rpKey` nüsxəni əsas sayta görə ayırır ([[ADR-0017]]). Nümunə axın:
Tamga Wallet `app/src/present.ts`.

## 8. Razılıq ekranı

Şəxs nəyə razılıq verdiyini ekranda görməlidir. Razılıq ekranında ən azı aşağıdakılar olur:

1. **Kim tələb edir:** yoxlayan tərəfin adı (`rp.legalName`), vasitəçi varsa əsas sayt; qeydiyyatda deyilsə və ya qeydiyyatı aktiv deyilsə, bu
   açıq şəkildə yazılır.
2. **Nə üçün:** qeydiyyatdakı əhatə dairəsində göstərilən məqsəd, şəxsin dilində; məxfilik siyasətinə keçid.
3. **Nə:** tələb olunan sahələr bir-bir, dəyərləri ilə.
4. **Əhatə dairəsindən kənar tələb:** qeydiyyatdakı əhatə dairəsində olmayan hər sahə (`rp.overAsk`) **ayrıca vizual blokda** xəbərdarlıqla göstərilir və
   razılıq düyməsi gecikmə ilə aktivləşir (WL8).
5. **Şikayət yolu:** yoxlayan tərəfin məlumatların qorunması orqanı ([[ADR-0024]]).
6. **Razılıq:** PIN və ya biometrika (WL11). Razılıq olmadan təqdimetmə yoxdur.

Tamamlanmamış təqdimetmə də jurnala yazılır (dəyərlər olmadan).

## 9. Əməliyyat jurnalı və ixrac

Hər təqdimetmə cihazdakı əməliyyat jurnalına ([[t:transaction-log]]) yazılır: nə vaxt, kimə, hansı sənəd növündən hansı **sahə adları**.
Dəyərlər yazılmır. Jurnal serverə və avtomatik ehtiyat nüsxəyə getmir (WL4); yalnız şəxsin özü öz parolu ilə şifrələyərək
ixrac edə bilər. Format Avropa İttifaqının (Aİ) ümumi formatıdır (TS10):

```ts
import { ts10TransactionLog, encryptTs10Async } from "@tamga-network/wallet-core";

const log = ts10TransactionLog(state, lookup); // lookup: verifier and institution details from the signed list (ts10LookupFromTrust)
const file = await encryptTs10Async(log, password); // PBES2-HS256+A128KW + A128GCM; password of at least 8 characters
```

## 10. Cihazın dəyişdirilməsi və silinmə

Sənəd açarları cihazdan çıxmadığı üçün **sənədlər köçürülmür** (WL2, WL10). Yeni cihaza köçürülən sənəd siyahısı, parametrlər və
(şəxs istəsə) jurnaldır; sənədlər qurumlardan yenidən alınır:

```ts
import { ts10MigrationData, encryptTs10Async, decryptTs10Async, applyMigration } from "@tamga-network/wallet-core";

// old device
const exported = await encryptTs10Async(ts10MigrationData(state, lookup, { includeLog: true }), password);
// new device
const data = await decryptTs10Async(exported, password);
const { state: next, toReissue } = applyMigration(emptyState, data, { restoreLog: userAgreed });
// toReissue: shown to the person as a "receive again" list
```

- Köhnə cihazı başqasına verərkən vahidi ləğv edin (provayderinizin vahid ləğvi).
- Şəxs hər şeyi silmək istəsə: provayderinizin vahid silmə əməliyyatı, Tamga-nın şəxsiyyət xidmətində `requestIdentityErasure`.
  Qurumların saxladığı məlumatlar qurumun məsuliyyətindədir; cüzdan şəxsə qurumun silmə müraciəti yolunu göstərir.

## 11. Etibar siyahısı

Cüzdan yoxlayan tərəflərin qeydiyyatlarını, sənədi verən qurumları və sənəd növlərini imzalı etibar siyahılarından oxuyur. `fetchRpRecord` və
`fetchTrustSource` siyahıların qaydalarını `@tamga-network/trust/core`-dən alır ([[ADR-0015]]); cüzdan yalnız imza
yoxlayıcısını təqdim edir. Siyahını imzalayan kökün, yəni [[t:trust-anchor|etibar lövbərinin]], barmaq izi tətbiqə **daxil edilir** (`TRUST_PINS`); siyahı serverinə etibar edilmir.
Siyahı fayllarını özünüz şərh etməyin. Ətraflı: [[GUIDE-0006]].

## 12. Riayət edilməli qaydalar

| Qayda | Kod |
|---|---|
| Açarlar cihazın təhlükəsiz zonasındadır; ixrac edilə bilməz; proqram açarlı cüzdan dəstəklənmir | WL1, WL3 |
| Hər təqdimetmədə PIN və ya biometrika | WL11 |
| Sahələr bir-bir göstərilir; əhatə dairəsindən kənar tələb ayrıca xəbərdarlıqla | WL8 |
| Eyni yoxlayan tərəfə eyni nüsxə, fərqli yoxlayan tərəfə fərqli nüsxə | WL5, WL6 |
| Təqdimetmə jurnalı cihazda qalır, serverə getmir | WL4 |
| Ehtiyat nüsxə açar daşımır; yeni cihazda sənədlər yenidən alınır | WL2, WL10 |
| Təqdimetmə anında sxem serverinə sorğu göndərilmir | WL9 |
| Vasitəçi yoxlayan tərəf olduqda əsas sayt göstərilir və onun əhatə dairəsi yoxlanılır | [[ADR-0017]] HV6 |
| "Etibarsız" və "yoxlanıla bilmədi" fərqli göstərilir | [[SPEC-CRED-0003]] S14 |

WL kodları [[SPEC-WALLET-0001]]-dədir. Tam siyahı: [Tamga ARF — Əlavə B, RB-WP](https://arf.tamga.network/az/rulebook).

## 13. Nəşrdən əvvəl

Mağazaya göndərməzdən əvvəl [[GUIDE-0010]] yoxlama siyahısından keçin və uyğunluq testlərini icra edin ([[GUIDE-0009]]). Real telefonla
başdan-sona sınağı real şəbəkəyə toxunmadan test şəbəkəsində aparın ([[GUIDE-0013]]).

## 14. İşləyən kod

- İlk rəqəmsal cüzdan (nümunə tətbiq): Tamga Wallet (bir şirkətin ayrıca məhsulu; ayrıca repozitori; Expo, React Native) — bu nüvədən istifadə edir; iOS və Android-də işləyir.
- Nüvənin testləri: `packages/wallet-core/src/*.test.ts` — alma, təqdimetmə, nüsxə seçimi, etibar siyahısı.
- Keçid kartı (turniket, tədbir girişi): `pass.ts`, [[ADR-0012]].
