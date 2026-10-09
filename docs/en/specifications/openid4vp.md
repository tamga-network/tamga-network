---
document_id: SPEC-PROTO-0002
title: "OpenID4VP profile"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-09
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

In [[t:mdoc]] the claim path is **`[namespace, element]`**; the Tamga identity namespace is `tamga.id.1`, and the element names
match the SD-JWT claim names one to one ([[ADR-0013]] MD1). The verifier sees only `age_over_18`; the name, date of birth and
identity number are not disclosed. `docType` = the vct URN.

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
| `dc_api.jwt` (browser, OpenID4VP 1.0 Annex A) | **Implemented** — verifier request object and page kit (`@tamga-network/verifier/web`), wallet side (`@tamga-network/wallet-core`); depends on browser and operating system support |
| ISO 18013-5 proximity (Bluetooth), mdoc | **Code ready** (`@tamga-network/mdoc`, `@tamga-network/wallet-core`); interoperability trials with real devices are under way. No NFC at this stage |

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
