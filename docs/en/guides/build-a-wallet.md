---
document_id: GUIDE-0005
title: "Build a wallet"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  Building a wallet that receives, stores and presents Tamga credentials: registering as a wallet provider, device keys,
  device attestation (App Attest, Android key attestation), the Wallet Unit Attestation (WUA), receiving credentials with
  OpenID4VCI, selective disclosure with OpenID4VP, the consent screen, the transaction log and export, changing devices, the
  pre-release check and the rules to follow. The network's first wallet, Tamga Wallet (a company's separate product; separate repository, Expo), uses this package.
translation_of: GUIDE-0005
source_version: 1.0.0
---

# Build a Tamga-compatible wallet

This guide is for developers who want to build a wallet that receives, stores and presents Tamga credentials.

**When to read:** when you want to connect your own wallet app to Tamga. Take a look at the [Issuance](/concepts/issuance)
and [Presentation](/concepts/presentation) concepts first; the full set of rules is in [[SPEC-WALLET-0001]].

## How it works

Tamga is an open ecosystem: Tamga Wallet is not the only wallet. Any wallet that follows the rules can register in the
[[t:trust-list]] as a **[[t:wallet-provider]]** and receive Tamga [[t:credential|credentials]]. A wallet's job comes down to
four steps:

1. **Introduce itself:** it obtains a short-lived [[t:WUA]] from the wallet provider.
2. **Receive credentials:** it opens the institution's offer and receives the credential with [[t:OpenID4VCI]]; every copy is
   bound to a separate key created on the device.
3. **Present credentials:** it checks the [[t:verifier|verifier's]] request, shows the person the requested fields one by
   one, and on approval sends only those.
4. **Read trust:** it recognises issuers and verifiers from the signed trust lists.

`@tamga-network/wallet-core` is the core of these flows. It is pure TypeScript; it runs in Node and in React Native (Hermes)
and uses no Node APIs.

```sh
npm install @tamga-network/wallet-core @tamga-network/trust
```

## 1. Project setup

The core is pure TypeScript, so it is the same everywhere; you supply the three platform-specific parts:

| Part | What | In the example app (Tamga Wallet) |
|---|---|---|
| Key back end | Generating and signing with P-256 keys in the device's secure area (`NativeKeyBackend`) | Native module `TamgaKeys` (iOS Secure Enclave, Android StrongBox/TEE) |
| Signature verifier | A function that verifies trust list signatures (passed to `@tamga-network/trust/core`) | A pure TypeScript cryptography library |
| Persistent store | Keeping the wallet state (`WalletState`) encrypted | A file encrypted with a key held in the device keychain |

- **React Native / Expo:** a native module is needed, so Expo Go is not enough; use a development build (`expo run:ios`,
  `expo run:android`). In Expo Go the core falls back to software keys; that is for trying things out only.
- **Values to pin:** the wallet provider address, the trust list address (`https://trust.tamga.network`) and the root
  fingerprints (`TRUST_PINS`, from `tamga.network/trust-anchor`). These are embedded in the app, not read from a server.

## 2. Register first: becoming a wallet provider

Before issuing a credential, an institution verifies who the wallet is and where it keeps its keys. For that, your wallet
solution must be registered in the trust list under `lotl › wallet_providers[]`:

1. The wallet solution declaration: platforms, key storage level (minimum W2: the device's secure area), PIN/biometrics,
   backup model.
2. The key you sign the WUA with is added to the list. Registration requirements:
   [Tamga ARF — Annex A §3.2](https://arf.tamga.network/trust-framework).
3. You run the wallet provider; the network runs none ([[ADR-0042]]). Before registering on the real network, try your
   wallet in the sandbox: have your own provider registered in the sandbox list ([[GUIDE-0013]] §2).

## 3. Device keys

Every copy of a credential is bound to a separate key created on the device. The key never leaves the device, cannot be
exported and is not derived from a seed. The core does not hold keys itself; you implement the `KeyProvider` interface with
your platform's secure area:

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

There is also a ready-made provider: `HardwareKeyProvider` generates new keys in the secure area when a native back end is
present, and otherwise falls back to the software provider you give it:

```ts
import { HardwareKeyProvider, SoftwareKeyProvider } from "@tamga-network/wallet-core";

const keys = new HardwareKeyProvider(
  TamgaKeys, // NativeKeyBackend or null
  new SoftwareKeyProvider(store, { randomBytes, platform: "test" }),
  { platform: "ios 18.0" },
);
```

| Storage | Level | Receives credentials |
|---|---|---|
| iOS Secure Enclave, Android StrongBox | W3 | Yes |
| Android TEE | W2 (minimum) | Yes |
| Software | W1 | No — tests and demos only ([[SPEC-WALLET-0001]] WL3) |

`SoftwareKeyProvider` is for tests and demos only; in the pilot no credential is issued to a wallet with software keys.

## 4. Device attestation: App Attest and Android key attestation

The wallet provider decides whether a key really lives in the secure area from the **platform's signed evidence**, not from the
device's own claim. Until the evidence is verified, the unit counts as software level.

| Platform | Evidence | What is checked |
|---|---|---|
| Android | Key attestation chain | Chain leads to Google's hardware root; one-time value; security level (TEE / StrongBox); verified boot; app package name |
| iOS | Apple App Attest | Evidence leads to Apple's root; app identity (Team ID + Bundle ID); client data carries the unit key's fingerprint |

Register the unit at first launch and supply the evidence through `deviceEvidence`:

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

If the evidence is rejected, the unit registers at software level; your provider states this clearly in the attestations.
Tell the person that high-assurance credentials cannot be received on this device; do not carry on silently.

::: info Store release
Device attestation becomes mandatory with the store release. On Android, Play Integrity evidence, which also shows that the app
came from the store, is added at that step; today the hardware key attestation is verified on Android and App Attest on iOS.
:::

## 5. Wallet Unit Attestation (WUA)

```ts
import { clientAttestationPop, wuaExpiringSoon, type WuaRecord } from "@tamga-network/wallet-core";

const wia: WuaRecord = await myProvider.requestWia(unit); // from your own provider (a JWT in EU TS3 form)
const pop = await clientAttestationPop({ keys, wua: wia, aud: credentialIssuer }); // added to the institution's token request
```

The attestation is added to the institution's token request during issuance. Renew it before it expires (`wuaExpiringSoon`).

A registered unit has two more attestations: a new, short-lived (under 24 hours) wallet instance attestation for each
credential operation ([[t:WIA]]), and the key attestation showing that the credential keys are in the secure area
([[t:key-attestation|KA]]). The provider publishes a status list for both (checked with `wiaRevokedByList`); when the person
hands the device over, the unit is revoked.

## 6. Receiving credentials (OpenID4VCI)

The person scans the QR code shown by the institution; the PIN (`tx_code`) arrives **over a separate channel** (SMS, email):

```ts
import { parseOffer, resolveOffer, redeem, receiveCredentials, newState } from "@tamga-network/wallet-core";

const offer = await resolveOffer(parseOffer(scannedQr), fetchHttp);
const out = await redeem({ offer, txCode: pinFromUser, keys, http: fetchHttp, wua }); // 10 copies, each with its own key
const { state, credential } = receiveCredentials(walletState, out); // is each copy bound to its own key — local check
```

For some types, such as the identity credential, the [[t:mdoc]] format of the same credential comes too (`copy.mdoc`,
[[ADR-0013]]); it is bound to the same key.

## 7. Presenting (OpenID4VP)

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

The response is sent encrypted (`direct_post.jwt`). `combined` is the SD-JWT text of the chosen copy.

For a request that comes through an intermediary verifier (`request.onBehalfOf`), show the **actual site's** name on screen
(`checkRp` gives it to you) and check the scope against its entry; `request.rpKey` assigns the copy by the actual site
([[ADR-0017]]). Example flow: Tamga Wallet `app/src/present.ts`.

## 8. Consent screen

The person must see on screen what they are agreeing to. The consent screen shows at least:

1. **Who is asking:** the verifier's name (`rp.legalName`), and the actual site if there is an intermediary; if it is not
   registered, or its entry is not active, this is stated clearly.
2. **Why:** the purpose from the registered scope, in the person's language; a link to the privacy policy.
3. **What:** the requested fields one by one, with their values.
4. **Out-of-scope requests:** every field outside the registered scope (`rp.overAsk`) is shown **in a separate visual block**
   with a warning, and the confirm button becomes active after a delay (WL8).
5. **Where to complain:** the verifier's data protection authority ([[ADR-0024]]).
6. **Confirmation:** PIN or biometrics (WL11). There is no presentation without it.

A presentation that could not be completed is logged too (without values).

## 9. Transaction log and export

Every presentation is written to the [[t:transaction-log]] on the device: when, to whom, which **field names** from which
credential type. Values are not written. The log never goes to a server or to automatic backup (WL4); only the person can
export it, encrypted with their own password. The format is the EU common format (TS10):

```ts
import { ts10TransactionLog, encryptTs10Async } from "@tamga-network/wallet-core";

const log = ts10TransactionLog(state, lookup); // lookup: verifier and institution details from the signed list (ts10LookupFromTrust)
const file = await encryptTs10Async(log, password); // PBES2-HS256+A128KW + A128GCM; password of at least 8 characters
```

## 10. Changing devices and deletion

Credential keys never leave the device, so **credentials are not moved** (WL2, WL10). What moves to the new device is the list
of credentials, the settings and (if the person wants) the log; the credentials are received again from the institutions:

```ts
import { ts10MigrationData, encryptTs10Async, decryptTs10Async, applyMigration } from "@tamga-network/wallet-core";

// old device
const exported = await encryptTs10Async(ts10MigrationData(state, lookup, { includeLog: true }), password);
// new device
const data = await decryptTs10Async(exported, password);
const { state: next, toReissue } = applyMigration(emptyState, data, { restoreLog: userAgreed });
// toReissue: shown to the person as a "receive again" list
```

- When handing the old device over, revoke the unit (your provider's unit revocation).
- If the person wants everything deleted: your provider's unit deletion and `requestIdentityErasure` at Tamga's identity
  service. Data institutions hold is the institution's responsibility; the wallet shows the person how to file an erasure
  request with the institution.

## 11. Trust list

The wallet reads verifier entries, issuers and credential types from the signed trust lists. `fetchRpRecord` and
`fetchTrustSource` take the list rules from `@tamga-network/trust/core` ([[ADR-0015]]); the wallet only supplies the signature
verifier. The fingerprint of the root that signs the list (the [[t:trust-anchor]]) is **embedded** in the app (`TRUST_PINS`);
the list server is not trusted. Do not interpret the list files yourself. Details: [[GUIDE-0006]].

## 12. Rules to follow

| Rule | Code |
|---|---|
| Keys live in the device's secure area and cannot be exported; wallets with software keys are not supported | WL1, WL3 |
| PIN or biometrics for every presentation | WL11 |
| Fields are shown one by one; an out-of-scope request comes with a separate warning | WL8 |
| The same copy for the same verifier, a different copy for a different verifier | WL5, WL6 |
| The presentation log stays on the device and never goes to a server | WL4 |
| Backups carry no keys; credentials are received again on a new device | WL2, WL10 |
| No request to the schema server at presentation time | WL9 |
| With an intermediary verifier, the actual site is shown and its scope is checked | [[ADR-0017]] HV6 |
| "Invalid" and "cannot be verified" are shown differently | [[SPEC-CRED-0003]] S14 |

The WL codes are in [[SPEC-WALLET-0001]]. Full list: [Tamga ARF — Annex B, RB-WP](https://arf.tamga.network/rulebook).

## 13. Before release

Before submitting to the stores, go through the [[GUIDE-0010]] checklist and run the conformance tests ([[GUIDE-0009]]). Test end to end with a
real phone on the test network, without touching the real network ([[GUIDE-0013]]).

## 14. Working code

- First wallet (example app): Tamga Wallet (a company's separate product; separate repository; Expo, React Native) — uses this core; runs on iOS and Android.
- The core's tests: `packages/wallet-core/src/*.test.ts` — receiving, presenting, copy selection, trust list.
- Pass card (turnstile, event gate): `pass.ts`, [[ADR-0012]].
