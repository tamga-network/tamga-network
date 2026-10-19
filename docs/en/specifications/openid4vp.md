---
document_id: SPEC-PROTO-0002
title: "OpenID4VP profile"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-19
summary: >
  Defines how a credential is presented from the wallet to the verifier. The Tamga profile on top of OpenID4VP 1.0 Final:
  DCQL queries (Presentation Exchange is NOT used), a signed request object, response encryption, the Digital Credentials API
  in the browser. Central finding: the `x509_hash` client identifier prefix mandated by HAIP is the value
  base64url(SHA-256(DER)) — EXACTLY THE SAME BYTES as `RelyingParty.accessCertFingerprint` in the registry. The wallet can
  therefore resolve the client identifier in the request directly to the registry record and enforce over-asking control
  ([[SPEC-BC-0001]] §6) at protocol level. Also: detection of unrequested fields, the user's post-presentation log and
  response encryption rules.
translation_of: SPEC-PROTO-0002
source_version: 1.0.0
---
**This specification defines how a [[t:credential]] is presented from the wallet to the [[t:verifier]] over [[t:OpenID4VP]] 1.0 and
[[t:HAIP]] 1.0.** It is for developers writing a verifier or a wallet.

**When to read**

- Read the concept page [Presenting credentials (OpenID4VP)](/concepts/presentation) first; for a step-by-step implementation, see [Verifying on a server](/guides/verify-on-server).
- When building the verifier's signed request, the [[t:DCQL]] query and the wallet's response.
- Next: how the response is verified, [[SPEC-API-0001]].

**In brief.** The verifier prepares a signed request and passes it to the wallet through a QR code, a link or the browser
(Digital Credentials API). The request states, with a DCQL query, which fields of which credential are asked for; the
verifier's identity is determined by the digest of its certificate ([[t:x509_hash]]). The wallet shows the person the
verifier's name and what it asks for; if the request goes beyond the verifier's registered scope, it warns the person. If the
person approves, the wallet sends only the requested fields, together with a [[t:KB-JWT]].

---

# Scope

This specification defines **presentation**: the journey of a credential from the wallet to the verifier. Issuance is in
[[SPEC-PROTO-0001]].

**Standards basis:** OpenID for Verifiable Presentations **1.0 (Final)** and HAIP 1.0. Format [[SPEC-CRED-0002]],
verification logic [[SPEC-API-0001]].

**Outside this specification:** ISO/IEC 18013-5 proximity (Bluetooth) presentation is not OpenID4VP; it carries mdoc with its own
session encryption and SessionTranscript ([[ADR-0012]], [[ADR-0013]]; the `@tamga-network/mdoc` proximity module). The code is
ready; trials with real devices are under way (§7.3).

---

# 1. Presentation Exchange is not used

With OpenID4VP 1.0 Final the query language became **DCQL** (Digital Credentials Query Language). Presentation Exchange
(PE / `presentation_definition`) from earlier drafts is **not supported** in Tamga.

| | Presentation Exchange | **DCQL** |
|---|---|---|
| Status | Old draft | **1.0 Final** |
| Structure | JSONPath-based filters | Declarative, format-aware |
| Targeting SD-JWT VC | Indirect | Direct with `meta.vct_values` |
| Tamga | ✗ | ✓ |

**Invariant PV1:** a request carrying the `presentation_definition` parameter is **rejected.** No backwards compatibility is
offered — Tamga has no legacy load, and accepting PE would mean maintaining two separate query engines.

---

# 2. Client identifier — where the registry meets the protocol

This section is the most important part of the document.

## 2.1 What `x509_hash` is

In OpenID4VP 1.0 the verifier introduces itself with a **Client Identifier Prefix**. HAIP 1.0 mandates **`x509_hash`** for
X.509-based ecosystems:

```
client_id: x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk
```

The value is the base64url encoding of the **SHA-256 hash of the DER-encoded leaf certificate** of the certificate chain that
signs the request. The request is a signed request object (JAR) carrying the chain in its `x5c` header.

## 2.2 The same bytes, in two places

The `RelyingParty` structure in [[SPEC-BC-0001]] §6 holds:

```solidity
bytes32 accessCertFingerprint;   // SHA-256(X.509 DER)
```

**These are the same bytes as `x509_hash`.** Only the encoding differs — one is `bytes32`, the other a base64url string.

So the wallet can resolve the client identifier in an incoming request directly to the registry record:

```
x509_hash:Uvo3Htu…  →  base64url-decode  →  32 bytes  →  rpId lookup
                                                     →  RelyingParty record
                                                     →  allowedScopes
```

## 2.3 Consequence — over-asking control works at protocol level

[[SPEC-BC-0001]] §6 defined "over-asking protection", but **how** the wallet would recognise the verifier was left open.
`x509_hash` closes this gap:

```
1. The request arrives, the x5c chain is verified (SPEC-ID-0002)
2. The fingerprint is extracted from client_id
3. It is looked up in RelyingPartyRegistry (through the indexer)
   ├─ Not found         → "unregistered verifier" warning
   ├─ status != ACTIVE  → REJECT
   └─ Found             → allowedScopes are taken
4. Does every claim in the DCQL query fall within the allowed scope?
   ├─ Yes   → normal consent screen
   └─ No    → OVER-ASKING WARNING (§6)
```

**Invariant PV2:** a compliant Tamga wallet **must try** to resolve the client identifier to the registry record before
showing the DCQL query.

**Supported prefixes:**

| Prefix | Tamga |
|---|---|
| `x509_hash` | **The only one accepted** (signed request) — HAIP 1.0 §5; value = base64url(SHA-256(leaf certificate DER)), OpenID4VP 1.0 §5.9.3; matches the `client_id` of the trust list record |
| `x509_san_dns` | **Rejected** ([[ADR-0034]]) — the domain of the response address must still be in the SAN of the signing certificate |
| `origin` | Only in the DC API flow, in the browser (§7) |
| `redirect_uri` | **Rejected** — unsigned, cannot be bound to the registry |
| `decentralized_identifier`, `openid_federation`, `verifier_attestation` | The expansion stage |

Rejecting `redirect_uri` is deliberate: an unsigned request does not prove who the verifier is, and over-asking control
becomes impossible.

---

# 3. Authorization request

Signed request object (JAR), `typ: oauth-authz-req+jwt`, `alg: ES256`, `x5c` chain in the header.

```json
{
  "client_id": "x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk",
  "response_type": "vp_token",
  "response_mode": "direct_post.jwt",
  "response_uri": "https://ik.ornek-holding.com/vp/response",
  "nonce": "n-0S6_WzA2Mj",
  "state": "af0ifjsldkj",
  "dcql_query": { "...": "§4" },
  "client_metadata": {
    "jwks": { "keys": [ { "kty": "EC", "crv": "P-256", "use": "enc", "...": "..." } ] },
    "encrypted_response_enc_values_supported": ["A128GCM", "A256GCM"],
    "vp_formats_supported": {
      "dc+sd-jwt": {
        "sd-jwt_alg_values": ["ES256"],
        "kb-jwt_alg_values": ["ES256"]
      },
      "mso_mdoc": {
        "issuerauth_alg_values": [-7],
        "deviceauth_alg_values": [-7]
      }
    }
  }
}
```

| Parameter | Tamga rule |
|---|---|
| `response_type` | `vp_token` |
| `response_mode` | `direct_post.jwt` (default) or `dc_api.jwt` (§7) — **no unencrypted mode** |
| `nonce` | ≥ 128 bits of entropy, single use |
| Request signature | **Mandatory** — an unsigned request is rejected |
| `client_metadata.jwks` | Response encryption key; **mandatory** |
| `verifier_info` | Optional ([[ADR-0026]]): `[{"format": "registration_cert", "data": "<rc-wrp+jwt>", "credential_ids": [...]}]` — the registration certificate of the use (ETSI TS 119 475 / 119 472-2). If present, the wallet verifies the registrar signature (LOTL `roles.registrar`), the validity period and that `sub` equals the `organizationIdentifier` in the access certificate; if they do not match, no data is sent (WRC4). A field not in the certificate counts as over-asking (§6). |

**Invariant PV3:** unencrypted response modes (`direct_post`, `query`, `fragment`) are not used. A presentation carries personal
data and relying on transport-layer encryption is not enough — intermediate layers on the way to `response_uri` (reverse
proxy, WAF, logs) can see the content.

---

# 4. DCQL query

## 4.1 Employer scenario

The field set from [[SPEC-SCHEMA-0002]] §3.7:

```json
{
  "credentials": [
    {
      "id": "diploma",
      "format": "dc+sd-jwt",
      "meta": {
        "vct_values": [
          "urn:tamga:edu:DiplomaCredential:1"
        ]
      },
      "claims": [
        { "path": ["is_graduate"], "values": [true] },
        { "path": ["qualification_title"] },
        { "path": ["eqf_level"] },
        { "path": ["isced_f_code"] },
        { "path": ["awarding_body_name"] },
        { "path": ["awarding_date"] },
        { "path": ["family_name"] },
        { "path": ["given_name"] }
      ]
    }
  ]
}
```

A claim with `values` carries a matching condition (`is_graduate == true`); for the others only disclosure is requested.

**Unrequested fields** — `grade`, `thesis_title`, `birth_date`, `credit_points` — are **not in** the query, so the wallet does
not disclose them. They can already be forced to stay hidden with `sd: always` ([[SPEC-SCHEMA-0002]] §3.3).

## 4.2 Version flexibility

`vct_values` is an array. A verifier can accept several schema versions:

```json
"vct_values": [
  "urn:tamga:edu:DiplomaCredential:1",
  "urn:tamga:edu:DiplomaCredential:2"
]
```

This works together with [[SPEC-SCHEMA-0001]] §9.2: because old diplomas issued with a `DEPRECATED` version can still be
verified, a verifier must be able to accept both versions at once.

**Recommendation:** verifiers put **at least two versions** in `vct_values`. Putting a single version leaves earlier graduates
out after a schema upgrade.

## 4.3 Student discount — a minimal query

The most concrete example of [[t:selective-disclosure]]:

```json
{
  "credentials": [
    {
      "id": "student",
      "format": "dc+sd-jwt",
      "meta": {
        "vct_values": ["urn:tamga:edu:StudentCredential:1"]
      },
      "claims": [
        { "path": ["is_enrolled"], "values": [true] }
      ]
    }
  ]
}
```

The cinema sees nothing but `is_enrolled` — the name, university, department and year of enrolment are not disclosed.

## 4.4 `credential_sets` — alternatives

A verifier can offer choices such as "a diploma **or** a student certificate". This can be used in Tamga, but **with care**:
every extra choice is complexity the user has to understand on the consent screen.

**Rule:** at most **3** credentials and at most **2** `credential_sets` entries in one request. More than that exceeds the
user's ability to give informed consent.

**Wallet behaviour** (OpenID4VP 1.0 §6.4; reference: `@tamga-network/wallet-core` `selectDcql`):

- In a required set the wallet proposes the **first satisfiable** option in the verifier's order; the user may pick another
  satisfiable option. Only the chosen option's credentials are sent.
- An optional set (`required: false`) is **not shared by default**; it is sent only if the user turns it on. The consent
  screen shows "required" and "optional" separately.
- With `claim_sets`, only the **first** claim combination the credential can satisfy is disclosed; other claims are not sent.
- **A credential is never sent with missing claims** (OpenID4VP 1.0 §6.4.1; PV12): without `claim_sets`, **all** requested
  claims must be in the credential; if one is missing, that credential does not satisfy the query. With `claim_sets`, every
  claim of the chosen combination must be in the credential. If no credential satisfies the request, the wallet tells the
  user why (which claim the credential does not have); nothing is sent to the verifier.
- A malformed query (duplicate ids, claims without ids under `claim_sets`, options pointing to unknown ids, more than one
  namespace in an mdoc query) is rejected.

For verifiers: do not put a claim the credential may not carry (one that is not required by the schema, e.g. the diploma's
`thesis_title`) in a plain `claims` list — a credential without it is never sent; ask for an optional claim with `claim_sets`
(`[["g","l","t"], ["g","l"]]`: with the thesis first, otherwise without). Do not build a flow that depends on an optional
credential or claim; if order matters, put the option that
asks for the least data first.

## 4.5 `mso_mdoc` — age verification (D-CRED-5)

```json
{
  "credentials": [
    {
      "id": "identity",
      "format": "mso_mdoc",
      "meta": { "doctype_value": "urn:tamga:id:IdentityAttestation:1" },
      "claims": [ { "path": ["tamga.id.1", "age_over_18"], "values": [true] } ]
    }
  ]
}
```

In [[t:mdoc]] the claim path is **`[namespace, element]`**; the Tamga identity namespace is `tamga.id.1`; element names and
encodings follow the EU PID table ([[ADR-0045]]: SD-JWT `birthdate` / `nationalities` ↔ mdoc `birth_date` (full-date) /
`nationality`; the other names are the same). The verifier sees only `age_over_18`; the name, date of birth and
identity number are not disclosed. `docType` = the vct URN.

## 4.6 `trusted_authorities` — how the wallet evaluates it

A verifier can state, for a credential in the query, which trust sources it accepts with `trusted_authorities` (OpenID4VP 1.0
§6.1.1); the credential must meet at least one entry. The Tamga verifier uses `aki` ([[t:HAIP]] §5). The wallet evaluates each
entry with one of three outcomes (packages 0.5.2):

| Type | What the wallet does |
|---|---|
| `aki` | Is the AKI (base64url) of a certificate in the credential's issuer chain one of the values — **evaluated** |
| `etsi_tl` | If the value is the address of a trusted list the wallet has loaded and whose signature it verified (ETSI TS 119 612 TL or TS 119 602 LoTE): does the credential's chain lead to an issuance service certificate in that list (the certificate itself is in the chain, or an AKI in the chain equals that certificate's SKI) — **evaluated**. If the list in the value is not loaded in the wallet: **not evaluable** |
| `openid_federation` and unknown types | **not evaluable** |

- If an entry matches, the credential is **offered** (`matched`).
- If no entry matches but one is **not evaluable**, the credential is still **offered** (`not_evaluable`): the wallet does not
  hide a credential because of an entry it cannot judge; the verifier does its own trust check (an EU verifier may ask only for
  `etsi_tl`). **`not_evaluable` is never a positive trust signal:** the consent screen does not show it as "verified" or
  "trusted", and it is not recorded as "passed".
- If every entry was evaluated and none matches, the credential is **not offered**.

**The credential's chain** is read from the copy in the query's format: for `mso_mdoc` (and `mso_mdoc_zk`) the IssuerAuth
`x5chain` (COSE header 33; for ZK, the ZK copy's), for `dc+sd-jwt` the x5c. If there is no copy in that format the other
representation is used (same issuer key; D-CRED-5). A credential that has only an mdoc copy can therefore match `aki` / `etsi_tl`.

**Loaded lists:** the wallet reads the external lists it verified with the signer pinned in the signed LOTL ([[ADR-0036]]) only
when the query contains `etsi_tl`, and passes them to matching (`matchDcql(..., { trustedLists })`; source
`TrustSource.externalTrustedLists()` — the list's original publication address and its PID / EAA provider certificates, fresh
lists only). If the lists cannot be read (offline, no list), the `etsi_tl` entry is not evaluable. Tamga Wallet implements this.

---

# 5. Presentation and response

## 5.1 What the wallet produces

Per [[SPEC-CRED-0002]] §7.2: the selected [[t:disclosure|disclosures]] + KB-JWT.

KB-JWT body:

```json
{
  "nonce": "n-0S6_WzA2Mj",
  "aud": "x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk",
  "iat": 1789003600,
  "sd_hash": "Vx2mNqL8pRt4KzYwBhSaEc7JuFiGoNdXvCyTrMkZqPw"
}
```

**`aud` is the full client identifier** (prefix included). This binds the presentation to that verifier; it cannot be replayed
to anyone else.

## 5.2 `vp_token`

```json
{
  "vp_token": {
    "diploma": ["eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCJ9...~D1~D2~...~<KB-JWT>"]
  },
  "state": "af0ifjsldkj"
}
```

The keys are the `id` values from the DCQL query; the values are arrays (one query can match several credentials).

For an `mso_mdoc` query the value is a base64url **DeviceResponse** (ISO 18013-5 §8.3.2.1.2.2): `documents[0]` =
`{ docType, issuerSigned (selectively disclosed), deviceSigned.deviceAuth.deviceSignature }`. The device signature is a COSE_Sign1
with a **detached payload** (payload `nil`) over `DeviceAuthenticationBytes = #6.24(bstr .cbor ["DeviceAuthentication",
SessionTranscript, docType, DeviceNameSpacesBytes])`. The SessionTranscript is that of OpenID4VP 1.0 Annex B.2.6.1:
`[null, null, ["OpenID4VPHandover", sha256(cbor([client_id, nonce, jwkThumbprint, response_uri]))]]` — `jwkThumbprint` is the
RFC 7638 SHA-256 thumbprint of the verifier key the response is encrypted to (PV11). The request object declares `mso_mdoc`
(`issuerauth_alg_values` / `deviceauth_alg_values`: `[-7]`) in `client_metadata.vp_formats_supported`.

## 5.3 Encryption

`direct_post.jwt`: the object above is encrypted as a **JWE** to the recipient key in `client_metadata.jwks`.

| Parameter | Tamga |
|---|---|
| `alg` | `ECDH-ES` |
| `enc` | `A128GCM` or `A256GCM` ([[t:HAIP]] §5) — the verifier declares both in `encrypted_response_enc_values_supported` and accepts both; the wallet picks `A256GCM` among the declared values, and the OpenID4VP default `A128GCM` if nothing is declared |
| Recipient key | From the request's `jwks`, `use: "enc"` |

---

# 6. Over-asking control

> The protocol counterpart of [[SPEC-BC-0001]] §6; it relies on the resolution in §2.3.

## 6.1 Three cases

| Case | Wallet behaviour |
|---|---|
| Verifier registered, all claims within scope | Normal consent screen |
| Verifier registered, **some claims outside scope** | **Over-asking warning** — out-of-scope fields are marked separately; the user can still approve |
| Verifier **unregistered** | "This verifier is not registered with Tamga" warning; the presentation is not blocked but the warning is prominent |

## 6.2 Why it is not blocked

The wallet is the user's **agent**, not their gatekeeper. A user may knowingly want to present a credential to an
unregistered verifier — a researcher, a foreign institution, a test.

**Making it visible** rather than blocking is the right design. But the visibility must be real: the warning must be a screen
that interrupts the flow, not small grey text next to the approve button.

## 6.3 Log

The wallet logs every presentation **locally**: when, which verifier, which fields, whether there was over-asking.

**This log stays on the device.** It is never sent to any server — if it were, we would centralise exactly the behavioural
profile we are trying to protect.

The user must be able to see and delete this log.

---

# 7. Digital Credentials API (browser)

For in-browser flows, OpenID4VP is carried over the W3C Digital Credentials API. `response_mode: dc_api.jwt`.

## 7.1 The difference: `origin` binding

In the DC API flow the audience of the presentation is the browser origin, prefixed with `origin:`:

```
aud: origin:https://ik.ornek-holding.com
```

This value is supplied by the **browser**, not by the verifier. It is therefore a strong binding against phishing: a fake site
cannot claim any origin other than its own.

**Invariant PV4:** the wallet does not accept the `origin` prefix as a client identifier **inside the request**; it uses only
the origin supplied by the browser for the `aud` binding.

## 7.2 Relationship with the registry record

Without `x509_hash` in the DC API flow, over-asking control (§6) cannot be done. The Tamga profile therefore recommends a
**signed request object** in the DC API flow too — origin binding solves phishing, `x509_hash` solves authorisation control;
they are different problems.

## 7.3 Phase decision

| Flow | Status (2026-10) |
|---|---|
| `direct_post.jwt` (QR / deep link) | **In force** |
| `dc_api.jwt` (browser, OpenID4VP 1.0 Annex A) | **Implemented** — verifier request object and page kit (`@tamga-network/verifier/web`), wallet side (`@tamga-network/wallet-core`); depends on browser and operating system support. Two request objects per presentation (0.6.0): the DC API one (`dc_api.jwt` + `expected_origins`) and the cross-device one at `request_uri` (`direct_post.jwt` + `response_uri`) for the QR code / link. Each has its own encryption key (`kid` `enc-dc-<id>` / `enc-<id>`); the key that decrypts the response decides the path, and the mdoc `SessionTranscript` is checked with that path's handover (origin or `response_uri`). Nonce, state and single use are shared: the first valid response completes the presentation and the other path is refused (PV10). A browser with no usable DC API request (e.g. Safari with an SD-JWT-only policy) shows only the working QR / link |
| ISO 18013-5 proximity (Bluetooth), mdoc | **Code ready** (`@tamga-network/mdoc`, `@tamga-network/wallet-core`); interoperability trials with real devices are under way. No NFC at this stage |
| ISO/IEC 18013-7 Annex C (`org-iso-mdoc`, browser), mdoc | **Implemented in the verifier** (0.6.0; §7.4) — the only way to get an mdoc in Safari / iOS 26. The wallet side (operating system registration module) comes with the next device round |

## 7.4 ISO/IEC 18013-7 Annex C (`org-iso-mdoc`)

Browsers that do not carry OpenID4VP over the DC API (Safari / iOS 26) ask for an mdoc with ISO/IEC 18013-7 Annex C. The verifier
gives a second DC API request for the same presentation (when the policy asks for one `mso_mdoc` credential):

- **Request:** `{ protocol: "org-iso-mdoc", data: { deviceRequest, encryptionInfo } }` — both base64url CBOR. The `DeviceRequest`
  is in ISO 18013-5 form (intent to retain `false`); it may carry a reader signature (`readerAuth`) made with the verifier's
  access certificate. `EncryptionInfo = ["dcapi", {"nonce": bstr (≥ 16 bytes), "recipientPublicKey": COSE_Key}]`.
- **Session transcript:** `SessionTranscript = [null, null, ["dcapi", SHA-256(CBOR([Base64EncryptionInfo, origin]))]]` — the
  origin is that of the page that made the request (given by the browser). The device signature is built on this transcript: the
  response cannot be used in another request or on another site.
- **Response:** `credential.data.response` = base64url(`["dcapi", {"enc": bstr, "cipherText": bstr}]`) — HPKE (RFC 9180) base
  mode, DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM, `info` = the transcript bytes, empty `aad`; the plaintext is the
  `DeviceResponse`.
- **Flow (hosted verifier):** `POST /presentations` (with `dc_api_origin`) returns `dc_api_requests` (OpenID4VP + Annex C) and
  `dc_mdoc_response_uri`; the page forwards the response there (`POST /vp/dc-mdoc/{id}`, form field `response`). A response that
  cannot be decrypted does not consume the presentation. The page kit chooses the protocol by browser (Apple WebKit gets only
  `org-iso-mdoc`) and forwards the response to the endpoint of its protocol. On desktop the DC API is the default path when
  available; the QR code stays next to it as a fallback (ETSI TS 119 472-2 SUPPORT-03).
- **Code:** `@tamga-network/mdoc` (`createAnnexCRequest`, `parseAnnexCRequest`, `sealAnnexCResponse`, `openAnnexCResponse`,
  `hpkeSeal` / `hpkeOpen`), `@tamga-network/verifier` (`createMdocDcApiRequest`, `openMdocDcApiResponse`,
  `verifyPresentation({ sessionTranscript })`), `@tamga-network/verifier/web` (`chooseDcApiRequests`, `dcResponseTarget`).

## 7.5 Registration certificate: requests without one, and proximity ([[ADR-0026]] K5; [[ADR-0056]] K10)

- **Request without a certificate ([[ADR-0056]] K10, 2026-10-19):** `checkRegistrationCerts` returns `valid: false`,
  `reason: "registration_missing"` — the wallet rejects without asking the person. The "warning + Don't share, rejection after
  2028-08-11" transition of 2026-10-13 is removed.
- **Approval ([[ADR-0056]] K8):** the wallet core's `respond` works only with `checkRp`'s approval bound to this request
  (`approval`); impersonation, an inactive registration or an unverified intermediary produce no approval.
- **Proximity:** the reader sends the registration certificate in CBOR form (`rc-wrp+cwt`, ETSI TS 119 475 §5.2.3) in the
  ItemsRequest's `requestInfo.euWrprc` (ISO/IEC 18013-5-REQ-04…07) and signs the request with its reader certificate
  (`readerAuth`). The wallet applies steps 1–4 of the remote flow; the binding in step 3 is made with the `organizationIdentifier`
  in the `readerAuth` certificate (`checkProximityRegistration`). An invalid certificate and a request without one are refused
  without asking the person. Because registration certificates are public, the reader
  certificate itself must be anchored: its chain verifies up to a `root_cas` certificate of the signed list, or its leaf is the
  fingerprint in that party's record (`readerTrust`, required). A reader that is not anchored (e.g. a self-signed certificate
  copying an organisation identifier) is invalid with `untrusted_reader_certificate`. Wallet-to-wallet has no reader
  certificate; the check does not apply ("no registration"). The verifier's Annex C reader signature carries the leaf and the
  intermediate certificates in x5chain (not the root). The list publisher also produces the CBOR form of every
  registration certificate (`wrprc/…/*.cwt`, `cwt_path` in the index).

---

# 8. `transaction_data`

Binds a presentation to a specific **transaction** — not "I saw this diploma" but "I saw this diploma for this job
application".

Use: the transaction text approved by the user is bound to the KB-JWT as a hash. The presentation cannot then be reused for
another transaction.

**In Tamga:** not used in the initial stage (the education scenario does not need transaction binding). It will be needed in finance and
authorisation scenarios ([[PM-AUTH-0001]]). The profile will be written then.

---

# 9. End to end — Ayşe's application

```
Ayşe (wallet)                        Employer (verifier)         Indexer
     │                                      │                          │
     │◀── QR: authorization request ────────│                          │
     │                                      │                          │
     │  verify the x5c chain                │                          │
     │  (SPEC-ID-0002, RootCARegistry)      │                          │
     │                                      │                          │
     │─ client_id → fingerprint ───────────────────────────────────────▶│
     │◀── RelyingParty record + allowedScopes ─────────────────────────│
     │                                      │                          │
     │  Do the DCQL claims fall in scope?   │                          │
     │  → yes, no warning                   │                          │
     │                                      │                          │
     │  [consent screen: 8 fields shown]    │                          │
     │  [Ayşe approves]                     │                          │
     │                                      │                          │
     │  select 8 disclosures, drop 10       │                          │
     │  compute sd_hash                     │                          │
     │  sign KB-JWT (aud = client_id)       │                          │
     │  encrypt vp_token as JWE             │                          │
     │                                      │                          │
     │─── POST response_uri ───────────────▶│                          │
     │                                      │                          │
     │                                      │ [SPEC-API-0001 checks]   │
     │                                      │─ 5 queries ─────────────▶│
     │                                      │◀── result ───────────────│
     │                                      │ [status token prefetched]│
     │                                      │                          │
     │  [write to local log — stays on device] │  ACCEPTED             │
```

**What the employer does not see:** `grade` (3.42), `thesis_title`, `birth_date`, `credit_points`, `mode_of_study`,
`grading_scheme`, `nqf_level`, `graduated_before`, `awarding_body_id`, `awarding_body_country`.

---

# 10. Error responses

| Code | When |
|---|---|
| `invalid_request` | The request object is unsigned or malformed |
| `invalid_client` | The `x5c` chain could not be verified |
| `access_denied` | The user declined |
| `vp_formats_not_supported` | `dc+sd-jwt` is not supported |
| `invalid_request_uri_method` | — |
| `wallet_unavailable` | No wallet in the DC API |

**Invariant PV5:** when the user declines, `access_denied` is returned and **no reason is given.** The difference between
"the user does not have this credential" and "the user chose not to share it" must not leak to the verifier — if it did, the
verifier could map which credentials the user holds by sending queries.

---

# 11. Invariants

| # | Invariant |
|---|---|
| **PV1** | `presentation_definition` (PE) is rejected; DCQL only. |
| **PV2** | The wallet tries to resolve the client identifier to the registry record (§2.3). |
| **PV3** | No unencrypted response mode is used. |
| **PV4** | The `origin` prefix is not accepted as a client identifier inside the request. |
| **PV5** | The reason for a refusal does not leak to the verifier. |
| **PV6** | The request object must be signed; the `redirect_uri` prefix is rejected. |
| **PV7** | The KB-JWT `aud` value is the full client identifier (prefix included). |
| **PV8** | The presentation log stays on the device; it is not sent to a server. |
| **PV9** | At most 3 credentials and 2 `credential_sets` in one request. |
| **PV10** | `nonce` is single use; the verifier does not accept it again. |
| **PV11** | In an `mso_mdoc` presentation, the device signature is over the SessionTranscript (OpenID4VPHandover) that binds the full client identifier (prefix included), the `nonce`, the `response_uri` and the thumbprint of the key the response is encrypted to; a DeviceResponse carried to another request is rejected in A6. |
| **PV12** | The wallet does not send a credential that lacks any requested claim (without `claim_sets` every claim, with `claim_sets` every claim of the chosen combination must be in the credential); an optional claim is requested with `claim_sets`. |
| **PV13** | The wallet checks the signed request object's time and audience: `exp` is required and must not have passed, `iat` must not be more than 60 s in the future (clock-skew tolerance 60 s), and `aud`, if present, must be `https://self-issued.me/v2`; otherwise the request is refused. A `dc+sd-jwt` query must name the type with `meta.vct_values` (an untyped query is refused). |
| **PV14** | An intermediary verifier ([[ADR-0017]] K7) may send a request on behalf of an RP only when the relationship is written in both records: the RP lists the intermediary in `uses_intermediaries` and the intermediary lists the RP in `served_relying_parties`; on a one-sided claim the wallet refuses the request. |

---

# Security and privacy notes

**The structure of a query is an information leak.** By sending different queries a verifier can map which credentials a user
holds. PV5 closes this partly but not fully — the wallet should notify the user of repeated different queries from the same
verifier.

**`nonce` replay.** If PV10 is skipped, a recorded presentation can be resent. `aud` is the second line of defence.

**Consistency of the disclosure set.** [[SPEC-SCHEMA-0002]] Security notes: the wallet should use a consistent disclosure set
in repeated presentations to the same verifier; a changing set reveals information about the hidden fields.

**QR hijacking.** Thanks to the signed request object and the `x5c` chain, a fake verifier cannot pose as a registered
verifier — it would need the private key of the certificate.

---

# Open issues

1. ~~Strictness of the over-asking warning~~ — **CLOSED** ([[SPEC-WALLET-0001]] §5.2, WL8): three levels, three visual
   weights. On scope overrun, a separate block + a button delayed by 3 s; for an unregistered verifier, a screen that
   interrupts the flow. Against warning fatigue: **no** warning at all in the normal flow. The visual design awaits user
   testing.
2. The `credential_sets` limit (PV9: 3/2) is an estimate; it should be calibrated with user testing.
3. [[SPEC-BC-0001]] §14.3 continues: should RP scopes be bound to a set of `schemaId`s? The resolution in §2.3 now makes this
   technically possible — but the problem of updating every RP for every new schema remains.
4. [[ARCH-0005]] §4.2 M3: binding the minimum SDK version to the RP record. Reconsidered while writing this document; **still
   deferred** — binding version management to the registry creates a new coupling, and the `checks_skipped` mechanism (M1)
   looks sufficient in practice.
5. Should the signed request object be mandatory in the DC API flow? §7.2 recommends it; making it mandatory could make some
   browser integrations harder.

---

# Related documents

[[SPEC-PROTO-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-BC-0001]] ·
[[SPEC-ID-0002]] · [[SPEC-API-0001]] · [[ARCH-0003]] · [[ARCH-0005]] ·
[[PM-AUTH-0001]] · [[PM-GOV-0001]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).
