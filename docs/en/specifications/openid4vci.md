---
document_id: SPEC-PROTO-0001
title: "OpenID4VCI profile"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-09
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
    { "name": "Örnek Üniversitesi", "locale": "tr-TR" },
    { "name": "Example University", "locale": "en-US" }
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
        ],
        "claims": [
          { "path": ["qualification_title"] },
          { "path": ["eqf_level"] },
          { "path": ["isced_f_code"] },
          { "path": ["awarding_date"] },
          { "path": ["is_graduate"] }
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
| `nonce_endpoint` | **Mandatory** — Tamga always requires `c_nonce` |
| `deferred_credential_endpoint`, `notification_endpoint` | **Not declared** — neither endpoint exists today (§9, §10) |
| `batch_credential_issuance.batch_size` | **10** (§8) |
| `credential_metadata.credential_reuse_policy` | ETSI TS 119 472-3 §4.2.4.2 `arf_annex_ii`: `["per-relying-party", "once_only"]`, `batch_size` 10, `reissue_trigger_unused` 2, `reissue_trigger_lifetime_left` 7 days (ARF ISSU_37–40) |
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

**Invariant PR3:** the offer URI is **single-use** and expires after 5 minutes. Once fetched it returns 404.

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
(`jti`) with a ±5 minute window. The AS metadata declares `dpop_signing_alg_values_supported: ["ES256"]`.

**There is NO `c_nonce` here** — in 1.0 Final it moved to the Nonce Endpoint (§5).

The access token lifetime is **5 minutes**. The issuance flow takes seconds; a long lifetime is needless risk.

---

## 4.1 Refresh token — silent copy renewal ([[ADR-0023]], 2026-09-29)

For institution credentials (student certificate, diploma; not tickets) the token response carries a `refresh_token`. The
token is bound to the DPoP key of that issuance and to the wallet instance ([[t:WUA]] `sub`); the issuer stores only its
SHA-256 hash (operator database, 180 days). At the threshold (`credential_reuse_policy`) and with a random delay, the wallet
sends:

```http
POST /token
DPoP: <new proof with the same key>
OAuth-Client-Attestation: <WUA>
OAuth-Client-Attestation-PoP: <PoP>

grant_type=refresh_token&refresh_token=…
```

The issuer takes the token as single-use (deletes it). The DPoP key and the WUA `sub` must match. It rereads the record from
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

- **Token:** opaque to the wallet; its content is protected by authenticated encryption that only the identity service's key
  opens (JWE `dir` + A256GCM): the linked identity record, a generation counter, the thumbprint of the DPoP key from the first
  issuance, the expiry (≤ the identity credential's expiry) and the **minimum** elements for the ZK copy (today
  `age_over_18`). Neither the token nor person fields are kept on the server; for single use only the generation counter is
  kept in the identity record (ZC3).
- **Refresh:** the request of §4.1 (`grant_type=refresh_token`, the same DPoP key, a valid and unrevoked WIA). The service
  checks the generation and the DPoP binding and reads from its own list that **all revocation list bits of the identity
  record are 0**; if the record is gone, expired, revoked or suspended it returns `invalid_grant` (ZC2). Response: an access
  token for ZK copies only + a new `refresh_token` (generation + 1).
- **Credential request:** `credential_configuration_id` = `urn:tamga:id:ShortLivedIdentityAttestation:1`, at most 3 proofs (or a
  key attestation). In the response each copy is a `credential` = base64url IssuerSigned: docType = the configuration,
  namespace `tamga.id.1`, only the elements from the token, `validUntil − validFrom ≤ 24 hours` and ≤ the identity credential's
  expiry, NO `status` in the MSO (ZC1); signed with the same certificate as the identity credential. The access token cannot be
  used for any other configuration.
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
error right away (`issuance_halted`, §13); when the record is ready the institution creates a new offer. What follows is the
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
integration in [[SPEC-ID-0003]]. Type ↔ minimum level: [[FW-RB-0002]] §4 (student certificate T1, diploma T2).

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

The metadata `proof_types_supported.jwt.key_attestations_required` declares the accepted levels (ARF ISSU_27d). The earlier
WUA and per-key proof format is accepted until the pilot.

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

The Tamga identity service (`id.tamga.network`) runs the same flow **in the browser**: `/authorize` privacy notice +
explicit consent → remote verification provider → `/idv/return` (decision query) → `redirect_uri?code`. Under ETSI 472-3,
T3 can be issued only on this path (never with pre-authorized, IDP7). Metadata: `pushed_authorization_request_endpoint`,
`authorization_endpoint`, `require_pushed_authorization_requests: true`, `code_challenge_methods_supported: ["S256"]`,
`grant_types_supported` both grants.

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

The codes come from OpenID4VCI 1.0 Final §8.3.1.2; the last two rows are Tamga additions.

| Code | When | Wallet behaviour |
|---|---|---|
| `invalid_proof` | The proof is invalid (signature, `typ`, `aud`, `iat`, key attestation) | **Do not retry with the same proof** — report the error |
| `invalid_nonce` | The `c_nonce` in the proof is unknown, expired or already consumed | Get a new `c_nonce` and sign the proofs again |
| `invalid_credential_request` | Malformed request, or the requested configuration is not covered by this token | **Do not retry** — report the error |
| `unknown_credential_configuration` | The issuer does not offer this configuration at all | Refresh the metadata |
| `credential_request_denied` | No authorisation / schema authorisation dropped in the trust list | **Do not retry** |
| `invalid_token` | The token has expired | Restart the flow |
| `invalid_transaction_id` | At the deferred endpoint, the transaction is unknown or expired (once the endpoint exists, §9) | Restart the flow |
| `issuance_halted` (Tamga) | The record is not ready for issuance (for example no graduation record) | Contact the institution |
| `temporarily_unavailable` (HTTP 503) | The trust list or the institution's source is temporarily unreachable | Retry later |

**Invariant PR8:** error messages contain no personal data. Instead of "No record found for Ayşe Yılmaz",
`credential_request_denied` is returned; details live only in the issuer's own audit log.

---

# 14. Invariants

| # | Invariant |
|---|---|
| **PR1** | In the pre-authorized flow `tx_code` cannot be skipped. |
| **PR2** | Every `vct` in the metadata is a schema the issuer is authorised for on the chain. |
| **PR3** | The credential offer URI is single-use with a 5-minute lifetime. |
| **PR4** | Consuming a `c_nonce` is atomic. |
| **PR5** | Proof and credential signatures only `ES256`. |
| **PR6** | Each copy in a batch is bound to a **different device key**. |
| **PR7** | The binding method is written to the audit log, not into the credential. |
| **PR8** | Error responses contain no personal data. |
| **PR9** | Access token lifetime ≤ 5 minutes. |
| **PR10** | The copy↔index mapping stays with the issuer and never leaves. |
| **PR11** | Before issuance the Wallet Unit Attestation + PoP is verified; the WUA signer is one of the wallet provider keys in the trust list; if `key_storage` does not meet the tenant policy, no credential is issued (§11.1). |
| **PR12** | In an `out-of-band` offer the `tx_code` is delivered through a **different channel** from the offer; three wrong attempts void the offer; the channel address comes only from the institution's registered data (§3.3). |
| **PR13** | In the authorization code flow PAR and PKCE (S256) are mandatory; the client identity is the Wallet Unit Attestation (no `client_secret`); `redirect_uri` is bound in the PAR and cannot be changed at `/authorize`; `redirect_uri` must exactly match one of the client's registered addresses (allowlist; otherwise `invalid_redirect_uri`); the token request must carry the PAR's `redirect_uri` and the same `client_id` (WUA `sub`) (otherwise `invalid_grant`); the wallet takes the token endpoint from the authorization server metadata (`token_endpoint`, RFC 8414); the code is single-use and ≤ 60 s (§11.2). |
| **PR14** | In wallet-initiated issuance the institution's issuer matches identity only through **presentation of the identity attestation**, passing the full verification pipeline (T0 + A–E); the matching keys (national ID, birth date) are neither stored nor logged; if they do not match, no credential is issued (§11.2, [[ADR-0011]] K3/K6). |
| **PR15** | The wallet takes the institution directory only from the trust list; it sends no PAR to an issuer that is not in the list (§11.2). |
| **PR17** | The access token is bound to DPoP (RFC 9449): `/token` issues no token without a valid DPoP proof; `/credential` works only with `Authorization: DPoP` and a previously unseen proof made with the same key for this endpoint and this token (`ath`) (§4, §7.1). |
| **PR18** | The refresh token is single-use, renewed on every use, and bound to the DPoP key and the wallet instance of the issuance; on renewal the issuer rereads the record from the authentic source and issues nothing if there is no record ([[ADR-0023]] AR2–AR3, §4.1). |
| **PR19** | In a request with a WIA, no credential is issued if `client_status` is revoked; in a proof with a KA, the KA must be signed by the provider and not revoked, the proof signed with `attested_keys[0]` and the nonce valid; the key storage lower bound is applied according to the KA level ([[ADR-0025]], §11.1.1). |
| **PR16** | In the identity attestation response every `credentials[]` object carries, alongside `credential` (SD-JWT VC), an `mso_mdoc` (base64url IssuerSigned, ISO 18013-5) **bound to the same proof key**; both representations are produced in the same request and share the same status bit; the wallet does not store the mdoc without cross-checking it against the SD-JWT copy (same issuer certificate, same fields, `deviceKey` = `cnf`) ([[ADR-0013]] MD1–MD3). |

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
