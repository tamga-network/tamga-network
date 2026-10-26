---
document_id: SPEC-PROTO-0001
title: "OpenID4VCI profile"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-26
summary: >
  Defines how a credential enters the wallet. The Tamga profile on top of OpenID4VCI 1.0 Final: issuer metadata, credential
  offer (QR + tx_code), choice between the pre-authorized and authorization code flows, c_nonce from the Nonce Endpoint,
  openid4vci-proof+jwt key proof, credential endpoint, and the current state of deferred issuance and the notification
  endpoint (neither is offered). Two open topics are closed: the batch size is fixed at 10, and EACH copy in a batch uses a
  DIFFERENT device key — with the same `cnf` the copies could be linked and the whole point of the batch would be lost.
  It also maps the holder binding method used at issuance to the holder assurance level (T1/T2/T3).
translation_of: SPEC-PROTO-0001
source_version: 1.0.0
---
**This specification defines, on top of OpenID4VCI 1.0, how a credential is issued by an institution into the person's
wallet.** It is for developers who build issuing services or wallets.

**When to read**

- First read the [Issuance (OpenID4VCI)](/concepts/issuance) concept page; for a step-by-step implementation see
  [Issuing credentials as an institution](/guides/issue-credentials).
- When you set up the institution's offer, token and credential endpoints, or write the wallet code that talks to them.
- Next: the credential format, [[SPEC-CRED-0002]]; revocation, [[SPEC-CRED-0003]].

**In brief.** The institution shows the person an offer (credential offer: a QR code or a link). The wallet opens the offer
and obtains from the institution a short-lived access token and a single-use [[t:nonce]]. The wallet signs this value with
its own key, proving that it holds the key. The institution checks this proof and that the wallet is a genuine wallet
([[t:WIA]]), then issues several copies of the credential, each bound to a different key. The copies prevent the same
credential from being linked across different verifiers.

---

# Scope

This specification defines **issuance**: how a [[t:credential]] gets from the [[t:issuer]] into the wallet. Presentation is
in [[SPEC-PROTO-0002]].

**Standards basis:** OpenID for Verifiable Credential Issuance — [[t:OpenID4VCI|OpenID4VCI]] **1.0 (Final)**. Credential
format [[SPEC-CRED-0002]], [[t:revocation]] [[SPEC-CRED-0003]].

## Version warning — two important differences from the drafts

Code and documents written against the old OID4VCI drafts are wrong on these two points:

| Topic | Old draft | **1.0 Final** |
|---|---|---|
| Where `c_nonce` comes from | The Token Endpoint response | **Only the Nonce Endpoint** (the token and credential responses carry no `c_nonce`; there is no `c_nonce_expires_in`) |
| Key proof | `proof` (singular) | **`proofs`** (plural, an array per type) |

The second makes batch issuance directly possible (§8) and is the basis of Tamga's privacy design.

---

# 1. Choice of flow

OID4VCI defines two authorisation flows. Their mapping to Tamga's use cases:

| Flow | When | In Tamga |
|---|---|---|
| **Pre-authorized code** | The issuer already knows the user; authentication was done in the issuer's own system | **Default** — the university scenario |
| **Authorization code** | The wallet is redirected to the issuer, where the user logs in | When the user has no account with the issuer or has to make a choice |

## 1.1 Why the university uses the pre-authorized flow

The student is already logged in to the student portal; the university knows who they are. Putting them through another
authorisation flow would spoil the user experience with no security gain.

Flow: the student clicks "Add my diploma to my wallet" in the portal → the university creates a credential offer → shows
a QR + `tx_code` on screen → the student scans it with their phone.

## 1.2 `tx_code` is mandatory

`tx_code` is the second factor against someone who captures the offer visually. Because the QR is shown on screen it can be
read over the shoulder; the `tx_code` is delivered through a separate channel (inside the portal session).

| Parameter | Tamga value |
|---|---|
| `input_mode` | `numeric` |
| `length` | 6 |
| Lifetime | 5 minutes |
| Attempts | 3, then the offer is void |

**Invariant PR1:** in the pre-authorized flow `tx_code` **cannot be skipped.**

---

# 2. Issuer metadata

`https://issuer.tamga.network/.well-known/openid-credential-issuer/example-university` (path-based tenant; RFC 8414 path rule)

```json
{
  "credential_issuer": "https://issuer.tamga.network/example-university",
  "authorization_servers": ["https://issuer.tamga.network/example-university"],
  "credential_endpoint": "https://issuer.tamga.network/example-university/credential",
  "nonce_endpoint": "https://issuer.tamga.network/example-university/nonce",
  "batch_credential_issuance": { "batch_size": 10 },

  "display": [
    { "name": "Örnek Üniversitesi" },
    { "name": "Örnek Üniversitesi", "locale": "tr", "description": "Diploma ve öğrenci belgesi" },
    { "name": "Örnek Üniversitesi", "locale": "en", "description": "Diplomas and student certificates" }
  ],

  "credential_configurations_supported": {
    "urn:tamga:edu:DiplomaCredential:1": {
      "format": "dc+sd-jwt",
      "scope": "urn:tamga:edu:DiplomaCredential:1",
      "vct": "urn:tamga:edu:DiplomaCredential:1",
      "credential_signing_alg_values_supported": ["ES256"],
      "cryptographic_binding_methods_supported": ["jwk"],
      "proof_types_supported": {
        "jwt": { "proof_signing_alg_values_supported": ["ES256"] }
      },
      "credential_metadata": {
        "display": [
          { "name": "Diploma", "locale": "tr-TR" },
          { "name": "Diploma", "locale": "en-US" }
        ]
      }
    },

    "urn:tamga:edu:StudentCredential:1": {
      "format": "dc+sd-jwt",
      "scope": "urn:tamga:edu:StudentCredential:1",
      "vct": "urn:tamga:edu:StudentCredential:1",
      "credential_signing_alg_values_supported": ["ES256"],
      "cryptographic_binding_methods_supported": ["jwk"],
      "proof_types_supported": {
        "jwt": { "proof_signing_alg_values_supported": ["ES256"] }
      }
    }
  }
}
```

## 2.1 Tamga constraints

| Field | Rule |
|---|---|
| `format` | Always `dc+sd-jwt` ([[SPEC-CRED-0002]] §5.1.1) |
| `credential_signing_alg_values_supported` | Only `ES256` |
| `proof_signing_alg_values_supported` | Only `ES256` |
| `vct` | Must be a registered schema ([[SPEC-SCHEMA-0001]]) |
| Configuration identifier and `scope` | Both are the credential type's `vct` URN (`urn:tamga:edu:DiplomaCredential:1`); there is no separate configuration name or short scope name. The wallet asks for the type with `scope` in the [[t:PAR]] ([[t:HAIP]] §4.3) |
| `display` (issuer) | The institution's **registered name** in the signed trust list (`legal_name`; entry without locale) and, if present, its service descriptions per language (`service_description`, BCP 47 key → `locale` + `description`). Neither the credential type's name nor a fixed language is written; `credential_metadata.display` comes from the type catalogue (this example has no `claims`: the claim list lives in the type metadata and is not repeated here) |
| `nonce_endpoint` | **Mandatory** — Tamga always requires `c_nonce` |
| `deferred_credential_endpoint`, `notification_endpoint` | **Not declared** — neither endpoint exists today (§9, §10) |
| `batch_credential_issuance.batch_size` | **10** (§8) |
| `credential_metadata.credential_reuse_policy` | ETSI TS 119 472-3 §4.2.4.2 `arf_annex_ii`: `["per-relying-party", "once_only"]`, `batch_size` 10, `reissue_trigger_unused` 2, `reissue_trigger_lifetime_left` 7 days (ARF ISSU_37–40) |
| `credential_metadata.embedded_disclosure_policy` ([[ADR-0046]], 2026-10-11; code 0.5.0) | Optional, **institution credential** configurations only: embedded disclosure policy following the ETSI TS 119 472-3 §4.2.5.2 data model, **by value** (ARF EDP_09). `id` (URI) + `type` (`none` · `authorized_relying_parties` · `specific_roots_of_trust`); `relying_parties` (`rp_id`, optional `service_id`), `subject_dns`, `entitlements`, `roots_of_trust` (`issuer_dn`, `serial_number`), optional `info_uri`, `authority`, `description`. It does not go into the credential and is not sent to the verifier; absent on the identity credential, ZK copy, driving licence information and contact credentials. If the policy is added, changed or removed, the valid credentials of that configuration are revoked (EP4). Wallet evaluation: [[SPEC-WALLET-0001]] |
| Signed metadata (2026-09-29) | OpenID4VCI §12.2.3, ARF ISSU_32: `Accept: application/jwt` → `typ` `openidvci-issuer-metadata+jwt`, `iss` = `sub` = Credential Issuer Identifier, `iat`, `exp` (+1 day); the signer is the institution's credential signing certificate in the trust list (`x5c`). When requesting a credential from an institution the wallet asks for the signed metadata; if the signer's fingerprint does not match the entry in the list, the metadata is not used. A plain request returns JSON. |
| `issuer_info` (2026-09-29) | ETSI TS 119 472-3 §4.2.3, ARF RPRC_22: `registrar_dataset` (`identifier`, `srvDescription`, `registryURI` = national list, `providesAttestations` = authorised types — from the signed list) + `registration_cert` if present ([[ADR-0026]]). Before requesting a credential from an institution, the wallet checks that the requested type is registered and that the certificate is valid and signed by the registrar (RPRC_22a/23). |

**Invariant PR2:** every `vct` in `credential_configurations_supported` must be a schema the issuer is **authorised for**
on the chain ([[SPEC-BC-0001]] §3.4). This is checked when the metadata is generated; an unauthorised schema cannot appear
in the metadata.

This moves the authorisation check from verification time to **issuance time**. The verifier side already checks it
(`isAuthorizedForSchema`), but this stops the issuer from producing credentials that will be rejected because of a
misconfiguration.

---

# 3. Credential offer

## 3.1 Object

```json
{
  "credential_issuer": "https://issuer.tamga.network/example-university",
  "credential_configuration_ids": ["urn:tamga:edu:DiplomaCredential:1"],
  "grants": {
    "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
      "pre-authorized_code": "oaKazRN8I0IbtZ0C7JuMn5",
      "tx_code": {
        "input_mode": "numeric",
        "length": 6,
        "description": "Enter the 6-digit code shown in the student portal"
      }
    }
  }
}
```

## 3.2 Transport

To keep the QR code small, **`credential_offer_uri`** is used; the object itself is not embedded:

```
openid-credential-offer://?credential_offer_uri=
  https%3A%2F%2Fissuer.tamga.network%2Fexample-university%2Foffers%2F8a3f9c21
```

**Invariant PR3:** the offer URI is **single-use**; its lifetime follows the offer class (§3.3: `on-screen` 5 minutes,
`out-of-band` ≤ 72 hours, `identity-bound` 7 days). Once fetched or expired it returns 404.

QR on desktop, deep link on mobile (the same portal page chooses by device type).

## 3.3 Offer classes (D-PROTO-1)

| Class | Where it appears | Lifetime | `tx_code` channel | Additional rule |
|---|---|---|---|---|
| `on-screen` | On the portal screen (student logged in) | **5 min**, single-use (PR3) | On screen (channel = session) | §3.2 as is |
| `out-of-band` | QR/link sent by e-mail (or SMS) | **≤ 72 hours**, single-use | **Through a different channel** (offer by e-mail → `tx_code` by SMS), 6 digits | 3 wrong attempts → the offer is burnt; the channel address comes only from the institution's registered data; after issuance an "added to wallet" notice goes to both channels |
| `identity-bound` ([[ADR-0020]]) | Link/QR delivered through the institution's own channel (e-mail, student portal) | **7 days**, single-use | **None** — the person presents their identity attestation | `authorization_code` grant; §3.4 |

When a used offer is scanned a second time, the wallet says "this invitation has been used"; the moment a student says "my QR
doesn't work", the breach is noticed → operator panel: revoke + reissue.

## 3.4 Identity-bound offer ([[ADR-0020]], 2026-09-29)

If, when creating an offer (`POST /{slug}/api/v1/offers`, `docs/api/tamga-issuer-api.openapi.yaml`), the institution sends
the person's matching keys (`bind { personal_administrative_number, birth_date }`), the offer becomes **identity-bound**:

```json
{
  "credential_issuer": "https://issuer.tamga.network/example-university",
  "credential_configuration_ids": ["urn:tamga:edu:DiplomaCredential:1"],
  "grants": { "authorization_code": { "issuer_state": "b3f1c2…" } }
}
```

- There is no pre-authorized code and no `tx_code`; the flow is §11.2. The wallet sends `issuer_state` in the [[t:PAR]];
  the issuer checks that the offer is valid, unused and for the same credential type.
- The issuer does not store the keys in the clear: a keyed hash per institution (HMAC-SHA-256) is kept. If the hash of the
  national ID number + birth date in the identity [[t:attestation]] presented in §11.2 step 3 does not match the hash in
  the offer → `access_denied` (AS2). If it matches, the offer is consumed (single-use) and the credential data is read from
  the institution's source (`fetch`, AS1).
- The institution delivers the link to the person; Tamga takes no contact address (AS3). For a person without an identity
  attestation, the offer with `tx_code` (§3.3) remains as a fallback.

---

# 4. Token endpoint

```http
POST /example-university/token HTTP/1.1
Host: issuer.tamga.network
Content-Type: application/x-www-form-urlencoded
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2IiwiandrIjp7Li4ufX0...

grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code
&pre-authorized_code=oaKazRN8I0IbtZ0C7JuMn5
&tx_code=493812
```

```json
{
  "access_token": "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NiJ9...",
  "token_type": "DPoP",
  "expires_in": 300
}
```

**[[t:DPoP]] is mandatory (RFC 9449; [[t:HAIP]]; 2026-09-29).** For each issuance flow the wallet generates an ephemeral
P-256 key and adds a `DPoP` proof (`typ: dpop+jwt`, `jwk`, `jti`, `htm`, `htu`, `iat`) to the `/token` request. The issuer
verifies the proof, binds the token to the key's thumbprint (`jkt`) and returns `token_type: DPoP`. The proof is single-use
(`jti`) with a ±5 minute window. The AS metadata declares `dpop_signing_alg_values_supported: ["ES256"]`. In the packages
the two endpoints have two functions ([[ADR-0056]] K5): the token endpoint `verifyTokenDpop` (returns the `jkt` to bind), the
resource endpoint `verifyResourceDpop` (the access token and its bound `jkt` are required; `ath` and the key match are always checked).

**There is NO `c_nonce` here** — in 1.0 Final it moved to the Nonce Endpoint (§5).

The access token lifetime is **5 minutes**. The issuance flow takes seconds; a long lifetime is needless risk.

---

## 4.1 Refresh token — silent copy renewal ([[ADR-0023]], 2026-09-29)

For institution credentials (student certificate, diploma; not tickets) the token response carries a `refresh_token`. The
token is bound to the client instance key of that issuance (WIA `cnf`; [[ADR-0060]]); the issuer stores only its
SHA-256 hash (operator database, 180 days). At the threshold (`credential_reuse_policy`) and with a random delay, the wallet
sends:

```http
POST /token
DPoP: <proof — the key may change (ADR-0060)>
OAuth-Client-Attestation: <fresh WIA for the same instance key>
OAuth-Client-Attestation-PoP: <PoP>

grant_type=refresh_token&refresh_token=…
```

The issuer takes the token as single-use (deletes it). The WIA's `cnf` key must be the one of the issuance (OAuth 2.0
Attestation-Based Client Authentication §10.3); a DPoP proof is required, its key may change (RFC 9449 §5) and the new access
token is bound to the new DPoP key. The wallet uses a new WIA key for every operation; it keeps the binding's key with the
credential and, on refresh, asks the provider for a fresh WIA for that key ([[ADR-0060]] K2). It rereads the record from
the authentic source; if there is no record it returns `invalid_grant` and the token is dropped. When a person is deleted
from the register, all of that person's tokens are deleted. The response carries a new access token and a **new**
`refresh_token` (rotation). The credential request is the same as in §7. The contact credentials issue no refresh token (no
person field is stored); the identity service issues only the ZK copy token (§4.2). The AS metadata `grant_types_supported`
includes `refresh_token`.

## 4.2 Identity service: the ZK copy token ([[ADR-0044]], 2026-10-09)

When the identity credential is issued (authorization code) the token response carries a `refresh_token`; this token does
**not** renew the identity credential, it only obtains short-lived ZK copies (the only exception to [[ADR-0023]] AR4). The
identity service's metadata announces the ZK copy as a separate `mso_mdoc` configuration:

```json
"urn:tamga:id:ShortLivedIdentityAttestation:1": {
  "format": "mso_mdoc", "doctype": "urn:tamga:id:ShortLivedIdentityAttestation:1",
  "cryptographic_binding_methods_supported": ["cose_key"], "credential_signing_alg_values_supported": [-7], …
}
```

- **When ([[ADR-0062]]):** only if the wallet requests the ZK copy scope (`urn:tamga:id:ShortLivedIdentityAttestation:1`)
  next to the identity credential scope in the PAR `scope`; the scope can only be requested with the identity credential (ZS1).
- **Token:** opaque to the wallet; its content is protected by authenticated encryption that only the identity service's key
  opens (JWE `dir` + A256GCM): the linked identity record, a generation counter, the thumbprint of the client instance key (WIA `cnf`) from
  the first issuance ([[ADR-0060]]), the expiry (≤ the identity credential's expiry) and the **minimum** elements for the ZK copy (the
  identity credential's age attributes `age_over_18`, `age_over_15`; [[ADR-0064]]). Neither the token nor person fields are kept on the server; for single use only the generation counter is
  kept in the identity record (ZC3).
- **Refresh:** the request of §4.1 (`grant_type=refresh_token`, a valid and unrevoked WIA for the same instance key; the DPoP key
  may change). The service checks the generation and the instance-key binding and reads from its own list that **all revocation list bits of the identity
  record are 0**; if the record is gone, expired, revoked or suspended it returns `invalid_grant` (ZC2). Response: an access
  token for ZK copies only + a new `refresh_token` (generation + 1).
- **Credential request:** `credential_configuration_id` = `urn:tamga:id:ShortLivedIdentityAttestation:1`, at most 3 proofs (or a
  key attestation). In the response each copy is a `credential` = base64url IssuerSigned: docType = the configuration,
  namespace `tamga.id.1`, only the elements from the token, `validUntil − validFrom ≤ 24 hours` and ≤ the identity credential's
  expiry, NO `status` in the MSO (ZC1); signed with the same certificate as the identity credential. So that a phone whose clock
  runs behind can still produce the proof, `signed` = `validFrom` is set 5 minutes back (the window stays ≤ 24 hours). The
  access token cannot be used for any other configuration.
- **Log:** only counts and rejection reasons; no personal data, no token and no record id. Residual risk: from the refresh
  frequency the service learns that the wallet is active, not what was shown to whom ([[ADR-0044]] Consequences).

---

# 5. Nonce endpoint

Unprotected — no access token is needed.

```http
POST /example-university/nonce HTTP/1.1
Host: issuer.tamga.network
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{ "c_nonce": "wKI4LT-mMoScTmxmQaMbtcMbtcpaSl" }
```

The response carries only `c_nonce` (OpenID4VCI 1.0 Final §7.2); the lifetime is not stated in the response (Final has no
`c_nonce_expires_in`).

| Rule | Value |
|---|---|
| Lifetime | 300 seconds (5 minutes) — after taking the nonce the wallet generates hardware keys for 10 copies and fetches a key attestation from the wallet provider; on a slow device this can take more than a minute |
| Use | **Once** — it is consumed |
| Storage | Atomic (race condition = replay gap) |

**Invariant PR4:** consuming a `c_nonce` must be atomic. A race between the two steps "check, then delete" would let the
same proof be used twice.

---

# 6. Key proof

The wallet proves that it controls the private key the credential will be bound to.

Header:

```json
{
  "typ": "openid4vci-proof+jwt",
  "alg": "ES256",
  "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
}
```

Body:

```json
{
  "aud": "https://issuer.tamga.network/example-university",
  "iat": 1789000012,
  "nonce": "wKI4LT-mMoScTmxmQaMbtcMbtcpaSl"
}
```

| Claim | Meaning |
|---|---|
| `aud` | Credential issuer identifier — cannot be re-presented to another issuer |
| `iat` | Time of creation |
| `nonce` | The `c_nonce` obtained from the Nonce Endpoint — freshness |

The `jwk` in the header is the public key that goes into the credential's `cnf` claim ([[SPEC-CRED-0002]] §5.3). The
private key never leaves the device's secure area.

**Invariant PR5:** `alg` only `ES256`. `none` or a symmetric algorithm is rejected.

---

# 7. Credential endpoint

## 7.1 Request

```http
POST /example-university/credential HTTP/1.1
Host: issuer.tamga.network
Authorization: DPoP eyJ0eXAiOiJhdCtqd3Qi...
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIs...   (same key; ath = SHA-256(access_token))
Content-Type: application/json

{
  "credential_configuration_id": "urn:tamga:edu:DiplomaCredential:1",
  "proofs": {
    "jwt": ["eyJ0eXAiOiJvcGVuaWQ0dmNpLXByb29mK2p3dCI..."]
  }
}
```

## 7.2 Response

```json
{
  "credentials": [
    { "credential": "eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCJ9...~WyJPdkt...~WyJoTjJ...~" }
  ]
}
```

The returned string is the combined format of [[SPEC-CRED-0002]] §2: issuer-signed JWT + disclosures + a trailing empty
`~` (no KB-JWT yet). Because no notification endpoint is offered, the response has no `notification_id` (§10).

## 7.3 Verification order on the issuer side

```
1. Is the access token valid and does its scope include this configuration
2. The proofs.jwt array is not empty and its length does not exceed batch_size
3. For each proof:
     a. typ == "openid4vci-proof+jwt", alg == ES256
     b. the signature verifies with the jwk in the header
     c. aud == my own credential_issuer value
     d. the nonce is valid and NOT CONSUMED → consume atomically
     e. iat within the window
4. Are the jwks in the proofs DIFFERENT FROM EACH OTHER (§8.2)  ← Tamga rule
5. Is the schema authorisation still valid (chain/indexer)
6. Produce and sign the credential
```

Step 5 may look redundant — it was checked when the metadata was generated (PR2). But the authorisation may have been
withdrawn after the metadata was cached. It is a cheap check, and producing a wrong credential is costly.

## 7.4 Several requests with the same access token ([[ADR-0059]], 2026-10-21)

The access token can be used for several credential requests during its lifetime (≤ 5 minutes, PR9) (OpenID4VCI 1.0 §8; like
the EU reference issuer). Limits: only the configuration the token covers (AT1); total copies per token ≤ the batch size, 10
(AT2; a request beyond it gets HTTP 401 `invalid_token` + `WWW-Authenticate: DPoP`, §13); every request with the DPoP key the token is bound to, and the lifetime is not
extended (AT3). In the identity service a later request adds copies to the first request's record and does not revoke the
earlier package (AT4); personal fields are deleted when the token expires or the copy allowance is used up (AT5). The ZK copy
token (§4.2) and tickets stay one package.

## 7.5 Pseudonym seed: a separate configuration ([[ADR-0061]], 2026-10-22)

The identity service's metadata declares the `urn:tamga:id:PseudonymSeed:1` type as a separate `dc+sd-jwt` configuration. After
receiving the identity credential the wallet requests it **with the same access token** and a single key proof (the key of the
identity credential's first copy); the seed is issued once and only if the identity credential was issued with that token (SD1).
The type cannot be requested on its own with PAR: the scope is advertised but not granted, the PAR is refused with
`invalid_scope` (RFC 6749 §4.1.2.1). The credential response carries no top-level parameter outside OpenID4VCI 1.0 §8.3 (SD2). The seed's privacy rules: [[ADR-0031]] PS1–PS6.

---

# 8. Batch issuance

> This section closes [[SPEC-SCHEMA-0002]] open topic 1b and [[SPEC-CRED-0002]] open topic 4.

## 8.1 Why

A user who presents the same credential to two [[t:verifier|verifiers]] can be matched if those two verifiers collude
([[SPEC-CRED-0003]] §9.4). The fix is to use a **different copy** for every presentation.

In addition, the freshness policy of the student certificate ([[SPEC-SCHEMA-0002]] §2.1.2) requires frequent renewal; a
batch makes this possible without going to the issuer every time and cuts the "how often does this person use their
credential" signal.

## 8.2 Every copy uses a different key — critical rule

**Invariant PR6:** each copy in a batch is bound to a **different device key**. If the same `cnf` were used, the copies
could be linked and the whole point of the batch would be lost.

This means the wallet generates N keys per batch. Modern secure areas make this cheap; the keys are generated and stored in
one go.

```json
"proofs": {
  "jwt": [
    "<proof: key 1>",
    "<proof: key 2>",
    "...",
    "<proof: key 10>"
  ]
}
```

The issuer produces a separate credential for each proof and puts that proof's `jwk` into each one as `cnf`.

The "are the jwks different from each other" check in step 7.3/4 **enforces this rule on the issuer side** — if a faulty
wallet implementation sends 10 proofs with the same key, the request is rejected.

## 8.3 Batch size: 10

| Value | Assessment |
|---|---|
| 1 (no batch) | Correlation open |
| 5 | Borderline for typical use |
| **10** | **Chosen** |
| 50+ | Unused copies pile up; wasted status indices for diplomas |

Rationale: typical use of a 90-day student certificate is a few presentations; 10 copies are plenty. For a diploma it is
enough for one application season.

## 8.4 Extra cost of a diploma batch

The diploma uses a status list ([[SPEC-SCHEMA-0002]] §3.1). Each copy consumes **a separate status index**. 10 copies =
10 indices.

In a list of 100,000 this is minor (10,000 graduates × 10 = 100,000 — borderline; two lists are opened).

**Careful when revoking:** when a diploma is revoked, **all 10 indices** must be set. The issuer keeps in its own database
which indices belong to the same diploma — this mapping **never leaves**, because if it did, the unlinkability of the
copies would end.

Ten bits changing at once would be a correlation signal; but because the list is published at a fixed interval whether or
not anything changed ([[SPEC-CRED-0003]] §5.1), which bits changed together is not visible from outside.

## 8.5 Phase decision

| Credential | Batch |
|---|---|
| `urn:tamga:edu:StudentCredential:1` | **Active in the initial stage** — short life + frequent use |
| `urn:tamga:edu:DiplomaCredential:1` | **Active in the initial stage** — 10 copies, each with its own status index (§8.4) |

The diploma is also issued as 10 copies (project management decision, 2026-10-08; previous decision: a single copy in the
pilot, batch at the state stage). Each copy carries its own status index; the indices of one diploma are mapped in the
institution's own database, all of them are set together on revocation (§8.4), and the mapping never leaves. Each
verifier therefore gets its own copy and presentations cannot be linked through `idx`.

---

# 9. Deferred issuance

**Not offered today.** Tamga issuers declare no deferred credential endpoint (no `deferred_credential_endpoint`). If the
record is not yet ready for issuance (for example the graduation decision has not been approved), `/credential` returns an
error right away (`credential_request_denied`, §13); when the record is ready the institution creates a new offer. What follows is the
profile that applies once the endpoint is added (OpenID4VCI 1.0 Final §9).

If the credential cannot be issued right away, the credential response uses **HTTP 202**; `interval` (seconds) is
required:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{ "transaction_id": "8xLOxBtZp8", "interval": 300 }
```

The wallet later asks the Deferred Credential Endpoint with a **DPoP-bound** token (PR17; the access token lives 5 minutes,
so the wallet first gets a new one with its refresh token if needed, §4.1):

```http
POST /example-university/deferred HTTP/1.1
Host: issuer.tamga.network
Authorization: DPoP eyJ0eXAiOiJhdCtqd3Qi...
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIs...   (same key; ath = SHA-256(access_token))
Content-Type: application/json

{ "transaction_id": "8xLOxBtZp8" }
```

If it is ready, the response is the same as §7.2 (HTTP 200, `credentials`). If it is still not ready, **HTTP 202** with a
new `interval` is returned again; the wallet waits that long. An unknown or expired transaction is the
`invalid_transaction_id` error. The `issuance_pending` error of the earlier drafts does not exist in 1.0 Final.

**Tamga rule:** the `transaction_id` lifetime is **30 days**. A faculty board decision can be delayed; but a transaction
waiting without limit means unlimited state on the issuer side.

**Privacy note:** the wallet's regular polling gives the issuer a "this person is still waiting" signal. `interval` must be
at least 300 seconds and the wallet must apply exponential backoff.

---

# 10. Notification endpoint

**Not offered today.** Tamga issuers declare no `notification_endpoint` and return no `notification_id` in the credential
response (OpenID4VCI 1.0 Final §8.3: `notification_id` is given only when a notification endpoint is offered). The wallet
sends no notifications. If the endpoint is added, this is the profile:

```json
{ "notification_id": "3fwe98js", "event": "credential_accepted" }
```

| Event | Meaning (OpenID4VCI 1.0 Final §11.1) |
|---|---|
| `credential_accepted` | The credential was stored in the wallet successfully |
| `credential_failure` | Issuance failed for a reason other than a user action (for example it could not be stored) |
| `credential_deleted` | Issuance did not complete **because of a user action** (for example the person declined to add the credential). It does **not** mean that the credential was later deleted from the wallet |

**Tamga rule:** notifications are used on the issuer side **only as counters**; they are not stored per person. Otherwise the
issuer would learn whether the person accepted the credential — a needless behavioural signal. The wallet never tells an
issuer that a credential was later deleted.

---

# 11. Holder binding and assurance at issuance

The protocol counterpart of [[SPEC-CRED-0001]] §3. The [[t:holder-binding]] method at issuance determines the
[[t:holder]] assurance level ([[t:LoA]]) ([[PM-ASSUR-0001]] axis A).

| Method | How | Level |
|---|---|---|
| **Remote — portal session** | The student logs in to the portal, an offer is created, `tx_code` on the portal screen | **T1** (T2 with a 2FA portal) |
| **In person — desk** | An officer sees the physical ID and scans the QR in the wallet | **T2/T3** (institution = registration authority) |
| **eID chip** | Reading the state ID via NFC | **T3** — state stage |

**Reminder of the scope limit:** none of them cryptographically answers "is the human in front of me this person"
([[SPEC-CRED-0001]] §3, scope limit). In-person binding is the strongest because it moves **procedural** verification to the
moment of issuance.

**Remote [[t:identity-proofing]] (T2):** document + liveness + face matching with a licensed provider; profile and provider
integration in [[SPEC-ID-0003]]. Type ↔ minimum level: [[FW-RB-0002]] §4.4 (student certificate T1, diploma T2).

## 11.1 Wallet unit verification (D-CRED-6 — ETSI TS 119 471 REQ-EAASP-4.2.1.2-02/03)

The issuer verifies the wallet's Wallet Unit Attestation **before the grant**. Transport: OAuth 2.0 Attestation-Based
Client Authentication (HAIP) — two headers in the token request:

| Header | Content | Verification |
|---|---|---|
| `OAuth-Client-Attestation` | WUA JWT (`typ: oauth-client-attestation+jwt`, x5c = Wallet Provider certificate; claims in [[SPEC-CRED-0001]] §4) | The x5c leaf is in `lotl.wallet_providers[].wua_signing_keys` (`TrustSource.isWalletProviderKey`; UNKNOWN → `503 temporarily_unavailable`), `exp`, `cnf` P-256, `key_storage` ≥ tenant policy (WL3) |
| `OAuth-Client-Attestation-PoP` | `typ: oauth-client-attestation-pop+jwt`; `iss` = WUA `sub`, `aud` = `credential_issuer`, `iat` (±300 s), `jti`; signed with the WUA `cnf` key | signature, aud, iat, jti |

Error: `invalid_client` (missing/invalid). The result (`solution_id`, `key_storage`) is written to the token record and the
audit log; it **does not go into the credential**. Demo: `key_storage: software` accepted (deviations S-9/S-14); pilot:
`secure_enclave`/`strongbox`.

### 11.1.1 WIA + KA — EU TS3 ([[ADR-0025]], 2026-09-29)

The **WIA** (Wallet Instance Attestation) is sent with the same headers:
- it carries `client_status {status, exp}`,
- its lifetime is **< 24 hours**,
- it is obtained with a **new PoP key** and a **new revocation entry** for every credential operation.

The issuer verifies the signature, the provider key, the PoP and `client_status` (the [[t:wallet-provider]]'s Token Status
List; revoked → `invalid_client`, list unavailable → 503). The WIA carries no key storage statement.

In the credential request the batch is requested with **a single proof**:
- `typ: openid4vci-proof+jwt`, with `key_attestation` in the header ([[t:key-attestation]], KA: `typ`
  `key-attestation+jwt` — OpenID4VCI 1.0 Final Annex D.1, signed by the provider, `attested_keys`, `key_storage` / `user_authentication` ISO 18045, `key_storage_status`),
- the proof is signed with `attested_keys[0]`.

The issuer verifies the KA, its revocation status and the nonce, and binds the credentials to `attested_keys`. It applies
the tenant's `min_key_storage` lower bound according to the level in the KA.

The metadata `proof_types_supported.jwt.key_attestations_required` declares the accepted levels (ARF ISSU_27d). **On the
production network the identity service accepts only the single proof with a KA and requires key storage `tee` or better**
(security round 2026-10-24): per-key proofs without a KA and the `software` level are rejected with `invalid_proof`; the declared
levels narrow accordingly. The sandbox and local development keep accepting `software` (deviation S-9). At institution issuers the
lower bound is the tenant's `min_key_storage` policy (default `software`; raised by the institution's policy).

**Revocation maintenance period preference (EU TS3 §2.4; ARF WUA_32, ISSU_12c; code 0.5.0).** An issuer may announce
`key_attestations_required.preferred_key_storage_status_period` for the remaining revocation maintenance period of the KA it
receives, and the top-level `preferred_client_status_period` for the WIA (seconds). The wallet reads the metadata when
requesting a credential; it sends no KA that misses the issuer's level requirement (WUA_05a) and asks the provider for a longer
WIA or KA when the remaining maintenance period (`*.exp − now`) is shorter than the preference. The preference is not a
requirement: if the provider cannot give one, the credential is still requested; an issuer that revokes in a chain limits the
credential's validity to the earliest end of the WIA and KA maintenance periods it saw at issuance ([[ADR-0047]] K1).

**Invariant PR7:** the binding method with which the credential was issued is written to the issuer's audit log. It is
**not written into the credential** — holder assurance goes neither onto the chain nor into the credential
([[PM-TRUST-0001]]).

---

## 11.2 Wallet-initiated issuance — authorization code (ADR-0011 K3, D-ID-6)

The wallet reads the institution directory from the **[[t:trust-list]]** (`tl-<cc>.issuers[]`; no extra server) and asks
the institution for a credential directly. Identity proofing on this path is done by **presenting the identity
attestation**; no student login/portal is needed. The pre-authorized path (§3) stays as is; the institution offers both.

| Step | Wallet → issuer | Rule |
|---|---|---|
| 1 | `POST /{slug}/par` — `client_id` = WUA `sub`, `redirect_uri`, `code_challenge` (S256), `scope` = the requested type's `vct` (the `scope` in the metadata, [[t:HAIP]] §4.3; as a fallback at an issuer that declares no scope, `authorization_details[{type: openid_credential, credential_configuration_id}]`; if both are sent they must name the same type), `state`, `issuer_state` for an identity-bound offer (§3.4); headers `OAuth-Client-Attestation` + PoP | PAR mandatory (RFC 9126); client identity is the **WUA** (`attest_jwt_client_auth`); no `client_secret`; PAR 10 min |
| 2 | `GET /{slug}/authorize?client_id&request_uri` — `Accept: application/json` | The institution's issuer returns an **OpenID4VP request** (`presentation_request.qr_payload`; DCQL: `IdentityAttestation` → `personal_administrative_number`, `birthdate`, `given_name`, `family_name`); the request is signed with the `rp-<slug>` certificate, the RP registration is in the trust list (AP6 scope) |
| 3 | The wallet runs the **standard presentation flow** (SPEC-PROTO-0002: RP registration, consent screen, KB-JWT, JWE) → `POST /{slug}/vp/response` | The issuer verifies with T0 + A–E (status prefetch S12) and matches by **national ID + birth date**: against the hash in the offer if `issuer_state` is present (§3.4), otherwise via `lookup` at the institution's source ([[ADR-0020]]; `docs/api/institution-source.openapi.yaml`); source unreachable → `temporarily_unavailable`; response `{redirect_uri}` = `redirect_uri?code=…&state=…` or `error=access_denied` |
| 4 | `POST /{slug}/token` — `grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`, WUA headers | code single-use, ≤ 60 s; PKCE; the client is the same WUA `sub` as in the PAR |
| 5 | `/nonce` → proofs → `/credential` | §5–§8 as is (10 copies, PR6) |

**Deliberate behaviour — authorization code reuse (RFC 9700 §4.5; security round 2026-10-24).** When a used `code` arrives a
second time, the issuer **first** revokes the tokens issued from it (access and refresh token; at the identity service the ZK copy
chain) and only then checks the replaying party's client/DPoP binding (`redeemCode`). A third party that observes a used code can
therefore close the victim's tokens (denial of service; no data is exposed — it obtains neither a token nor a credential). This is a
deliberate application of RFC 9700's "revoke on reuse" rule: when a code may have leaked, closing the victim's session comes before
preventing the attacker's use of the code; the wallet restarts the flow with a new PAR.

The Tamga identity service (`id.tamga.network`) runs the same flow **in the browser**: `/authorize` privacy notice +
explicit consent → remote verification provider → `/idv/return` (decision query) → `redirect_uri?code`. Under ETSI 472-3,
T3 can be issued only on this path (never with pre-authorized, IDP7). Metadata: `pushed_authorization_request_endpoint`,
`authorization_endpoint`, `require_pushed_authorization_requests: true`, `code_challenge_methods_supported: ["S256"]`;
`grant_types_supported` lists both grants at the institution issuer but **only `authorization_code`** (plus `refresh_token` for ZK
copies) at the identity service: the identity service does not write `pre-authorized_grant_anonymous_access_supported` and its
`token_endpoint_auth_methods_supported` contains only `attest_jwt_client_auth` (the client is always identified by its WIA) — the
metadata says the same thing the token endpoint does.

At both issuers the `/authorize` request **must** carry `client_id`, equal to the PAR's client (RFC 9126 §4); `code_verifier`
follows RFC 7636 §4.1 (43–128 characters), otherwise `invalid_grant` and the code is burnt. The token response carries `scope`
when the granted scope differs from the requested one (for example a requested ZK-copy companion scope that this authorisation did
not grant; RFC 6749 §5.1); when they are equal the field is omitted.

# 12. End to end — Ayşe's diploma

```
Ayşe                    OBS/Issuer                   Chain 
 │                          │                           │
 │─ sign in to OBS ────────▶│                           │
 │─ "Get my diploma" ──────▶│                           │
 │                          │─ check schema auth. ─────▶│  (indexer)
 │                          │◀─ authorised ─────────────│
 │◀─ QR + tx_code 493812 ───│                           │
 │                          │                           │
 │  [scan QR with wallet]   │                           │
 │─ GET offer_uri ─────────▶│                           │
 │◀─ credential offer ──────│                           │
 │                          │                           │
 │─ enter tx_code ─────────▶│                           │
 │─ POST /token ───────────▶│                           │
 │◀─ access_token (5 min) ──│                           │
 │                          │                           │
 │─ POST /nonce ───────────▶│                           │
 │◀─ c_nonce ───────────────│                           │
 │                          │                           │
 │  [generate device key]   │                           │
 │  [sign key proof]        │                           │
 │─ POST /credential ──────▶│                           │
 │                          │  · verify the proof       │
 │                          │  · consume the nonce once │
 │                          │  · fetch data from OBS    │
 │                          │  · map ISCED-F            │
 │                          │  · create disclosures     │
 │                          │  · reserve status index   │
 │                          │  · sign with the HSM      │
 │◀─ SD-JWT VC ─────────────│                           │
```

(OBS = the university's student information system.)

**Nothing was written to the chain.** The status index reservation is in the issuer's own database ([[SPEC-BC-0001]] §11.1
step 7).

---

# 13. Error responses

The credential endpoint's codes come from OpenID4VCI 1.0 Final §8.3.1.2; there is **no Tamga-specific top-level code**
(2026-10-24: the former `issuance_halted`, `subject_not_found` and `issuer_not_active` were removed). Tamga-specific detail lives
only in `error_description` and carries no personal data (PR8). The HTTP status is read together with the code: token / DPoP
failures are **401** with a `WWW-Authenticate: DPoP error="invalid_token"|"invalid_dpop_proof", algs="ES256"` header
(RFC 6750 §3, RFC 9449 §7.1); temporary conditions are **503**; everything else 400.

| Code | HTTP | When | Wallet behaviour |
|---|---|---|---|
| `invalid_proof` | 400 | The proof is invalid (signature, `typ`, `aud`, `iat`, key attestation); key storage below the minimum; **two proofs with the same key in one request** (PR6, per request); the provider's revocation-maintenance period has ended (ISSU_12c) | **Do not retry with the same proof** — report the error |
| `invalid_nonce` | 400 | The `c_nonce` in the proof is unknown, expired or **already consumed** — the nonce is consumed atomically before the first `await` (PR4) and is not restored when the proof is then rejected | Get a new `c_nonce` and sign the proofs again |
| `invalid_credential_request` | 400 | Malformed request; the requested configuration is not covered by this token; a precondition dropped (invitation code revoked, bound identity credential no longer active, seed requested before the identity credential) | **Do not retry** — report the error |
| `unknown_credential_configuration` | 400 | The issuer does not offer this configuration at all | Refresh the metadata |
| `unknown_credential_identifier` | 400 | A `credential_identifier` was sent — Tamga issues no identifiers in the token response | Use `credential_configuration_id` |
| `credential_request_denied` | 400 | No authorisation / schema authorisation dropped in the trust list; **the record is not ready for issuance** (no graduation record, ticket already issued, no record found, main credential revoked for a ZK copy) | **Do not retry**; contact the institution |
| `invalid_token` | **401** + `WWW-Authenticate` | Token unknown / expired; not `Authorization: DPoP`; **copy allowance used up** (AT2, 10 copies); a concurrent request with the same token; the credential issued with this token is no longer active | Restart the flow (new authorisation) |
| `invalid_dpop_proof` | **401** + `WWW-Authenticate` | DPoP proof missing, invalid, from another key, `ath` mismatch or replayed | Make a new proof with the same key; if the key changed, restart the flow |
| `invalid_transaction_id` | 400 | At the deferred endpoint, the transaction is unknown or expired (once the endpoint exists, §9) | Restart the flow |
| `temporarily_unavailable` | **503** | Trust list stale or the institution's source unreachable; the wallet provider's status list cannot be fetched; **the issuer is not active in the trust list**; the institution's disclosure policy is invalid | Retry later |

The token endpoint's codes are in §4 (`invalid_grant`, `invalid_request`, `invalid_client`, `unsupported_grant_type`,
`invalid_dpop_proof`, all 400). Requesting the pseudonym seed on its own at PAR is `invalid_scope` (§7.5).

**Invariant PR8:** error messages contain no personal data. Instead of "No record found for Ayşe Yılmaz",
`credential_request_denied` is returned; details live only in the issuer's own audit log.

---

# 14. Invariants

| # | Invariant |
|---|---|
| **PR1** | In the pre-authorized flow `tx_code` cannot be skipped. |
| **PR2** | Every `vct` in the metadata is a schema the issuer is authorised for on the chain. |
| **PR3** | The credential offer URI is single-use; its lifetime follows the offer class (§3.3: 5 min / ≤ 72 h / 7 days). |
| **PR4** | Consuming a `c_nonce` is atomic. |
| **PR5** | Proof and credential signatures only `ES256`. |
| **PR6** | Each copy in a batch is bound to a **different device key**. |
| **PR7** | The binding method is written to the audit log, not into the credential. |
| **PR8** | Error responses contain no personal data. |
| **PR9** | Access token lifetime ≤ 5 minutes. |
| **PR10** | The copy↔index mapping stays with the issuer and never leaves. |
| **PR11** | Before issuance the Wallet Unit Attestation + PoP is verified; the WUA signer is one of the wallet provider keys in the trust list; if `key_storage` does not meet the tenant policy, no credential is issued (§11.1). |
| **PR12** | In an `out-of-band` offer the `tx_code` is delivered through a **different channel** from the offer; three wrong attempts void the offer; the channel address comes only from the institution's registered data (§3.3). |
| **PR13** | In the authorization code flow PAR and PKCE (S256) are mandatory; the client identity is the Wallet Unit Attestation (no `client_secret`); `redirect_uri` is bound in the PAR and cannot be changed at `/authorize`; `redirect_uri` must exactly match one of the client's registered addresses (allowlist; otherwise the PAR is rejected with `invalid_request` — RFC 9126 §2.1); the token request must carry the PAR's `redirect_uri` and the same `client_id` (WUA `sub`) (otherwise `invalid_grant`); the wallet takes the token endpoint from the authorization server metadata (`token_endpoint`, RFC 8414); the code is single-use and ≤ 60 s (§11.2). In the packages `createPar` requires the allowlist (`allowedRedirectUris`); a client without a registered address is rejected ([[ADR-0056]] K2). |
| **PR14** | In wallet-initiated issuance the institution's issuer matches identity only through **presentation of the identity attestation**, passing the full verification pipeline (T0 + A–E); the matching keys (national ID, birth date) are neither stored nor logged; if they do not match, no credential is issued (§11.2, [[ADR-0011]] K3/K6). |
| **PR15** | The wallet takes the institution directory only from the trust list; it sends no PAR to an issuer that is not in the list (§11.2). |
| **PR17** | The access token is bound to DPoP (RFC 9449): `/token` issues no token without a valid DPoP proof; `/credential` works only with `Authorization: DPoP` and a previously unseen proof made with the same key for this endpoint and this token (`ath`) (§4, §7.1). |
| **PR18** | The refresh token is single-use, renewed on every use, and bound to the client instance key (WIA `cnf`) of the issuance, the DPoP key may change ([[ADR-0060]]); on renewal the issuer rereads the record from the authentic source and issues nothing if there is no record ([[ADR-0023]] AR2–AR3, §4.1). |
| **PR19** | In a request with a WIA, no credential is issued if `client_status` is revoked; in a proof with a KA, the KA must be signed by the provider and not revoked, the proof signed with `attested_keys[0]` and the nonce valid; the key storage lower bound is applied according to the KA level ([[ADR-0025]], §11.1.1). |
| **PR16** | In the identity attestation response every `credentials[]` object carries, alongside `credential` (SD-JWT VC), an `mso_mdoc` (base64url IssuerSigned, ISO 18013-5) **bound to the same proof key**; both representations are produced in the same request and share the same status bit; the wallet does not store the mdoc without cross-checking it against the SD-JWT copy (same issuer certificate, same fields, `deviceKey` = `cnf`) ([[ADR-0013]] MD1–MD3). **Deliberate deviation:** OpenID4VCI 1.0 §8.3 defines only `credential` in a `credentials[]` object; `mso_mdoc` is a Tamga-profile extension (ADR-0013 — both representations in one request because person fields are deleted right after issuance). A standard wallet ignores the unknown member and keeps only the SD-JWT copy; the Tamga wallet stores both. |

---

# Security and privacy notes

**The offer QR is a secret.** Without `tx_code`, someone who photographs the screen could collect the credential into their
own wallet. PR1 and PR3 together close this window.

**Nonce race.** If PR4 is skipped, the same proof can be used twice; in the batch scenario this lets an attacker bind their
own key to one of the copies.

**Polling is a signal.** In deferred issuance (once the endpoint exists), frequent polling by the wallet gives the issuer behavioural information (§9).

**A batch reveals the number of copies.** A verifier that sees every presentation from the same user carrying a different
`cnf` can tell that a batch is used — but it cannot tell **which copies belong to the same person**. That is the intent.

---

# Open topics

1. ~~When batch copies run out~~ — **CLOSED** ([[SPEC-WALLET-0001]] §4.3): a notice when 2 copies are left; once they run
   out there is no problem at a **known** verifier (sticky mapping); at a **new** verifier the user is given a choice —
   refresh, or reuse an existing copy with a correlation warning.
2. ~~Should the Wallet Unit Attestation (WUA) be mandatory at issuance?~~ — **CLOSED (§11.1, DB-16):** mandatory; the
   wallet provider is registered in the trust list (list stage) (`lotl.wallet_providers[]`), the provider service is
   run by the organisation that offers the wallet, not by the network ([[ADR-0042]]).
3. ~~Will the authorization code flow be implemented at all in the initial stage?~~ — **CLOSED (§11.2, [[ADR-0011]] D-ID-6):**
   implemented; PAR + PKCE + WUA client identity; presentation of the identity attestation at the institution, browser +
   IDV at the Tamga identity service.
4. `batch_size` = 10 is an estimate; it should be calibrated with pilot usage data.
5. ~~The diploma batch was deferred to the state stage~~ — **CLOSED (2026-10-08, §8.5):** the diploma is also issued as 10
   copies; status index capacity is covered by opening lists per institution (§8.4), revocation sets every copy's index.

---

# Related documents

[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-PROTO-0002]] · [[SPEC-BC-0001]] · [[PM-ASSUR-0001]] · [[PM-TRUST-0001]] · [[PM-GOV-0001]] · [[ARCH-0003]] ·
[[ARCH-0005]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).
