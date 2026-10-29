# Data flows

Diagrams are Mermaid (rendered on GitHub). Step codes in brackets (A1…E4, C1…, S1…) are the project's verification-pipeline
steps and invariant codes; see `invariants.md`. Every arrow that carries a signed artefact is verified by the receiver before use.

## 1. Issuance — OpenID4VCI 1.0 (authorisation code, PAR, DPoP, wallet attestations)

Wallet instance attestation (WIA) authenticates the wallet as the OAuth client (attestation-based client authentication);
key attestation (KA) proves that the credential keys live in hardware. Both are issued by the wallet provider, whose
certificate must be listed in the trust list (`wallet_providers`).

```mermaid
sequenceDiagram
  autonumber
  participant W as Wallet (wallet-core)
  participant WP as Wallet provider
  participant AS as Issuer auth server (issuer pkg)
  participant CI as Credential issuer
  participant TL as Trust lists

  W->>TL: fetch LOTL + national list (pinned root, version memory)
  W->>CI: GET /.well-known/openid-credential-issuer (signed metadata, issuer_info)
  W->>W: verify metadata signature + registration certificate (ADR-0026)
  WP-->>W: WIA (oauth-client-attestation+jwt, x5c = listed provider cert) [earlier, at wallet setup]
  W->>AS: PAR + PKCE S256 + OAuth-Client-Attestation + -PoP (aud = issuer)
  AS->>TL: provider certificate listed? WIA status list (not revoked)?
  AS-->>W: request_uri (single use, short-lived)
  W->>AS: /authorize?request_uri=… (user authenticates at the institution)
  AS-->>W: code (bound to client + PKCE)
  W->>AS: /token + DPoP proof (+ WIA headers)
  AS-->>W: access token (DPoP-bound, jkt), optional refresh token bound to client instance key (ADR-0060)
  W->>CI: /nonce
  CI-->>W: c_nonce
  W->>WP: key attestation for N new device keys (meets key_attestations_required)
  WP-->>W: KA (hardware-backed keys)
  W->>CI: /credential + DPoP · proofs: openid4vci-proof+jwt {key_attestation: KA, nonce: c_nonce}
  CI->>CI: verify DPoP (htu/htm/ath/jkt), proof signature, nonce, KA signer listed, key storage level
  CI-->>W: batch of SD-JWT VC copies (+ mdoc twin · same holder key per copy) with random status indexes
  W->>W: verify issuer signature against trust list, store copies (one key per copy)
```

Pre-authorised flow (on-screen / out-of-band / identity-bound offers) replaces steps 5–10 with `pre-authorized_code`; the
`tx_code` is delivered over a different channel than the offer (S5 rule); attempts are limited.

## 2. Presentation — OpenID4VP 1.0, cross-device (`direct_post.jwt`), with per-fetch branches (ADR-0067)

```mermaid
sequenceDiagram
  autonumber
  participant RP as Relying party
  participant V as Verifier (verifier pkg / apps/verify)
  participant W as Wallet (wallet-core)
  participant B as Bystander
  participant TL as Trust lists
  participant ST as Issuer status list

  RP->>V: POST /presentations (signed RP assertion, policy)
  V-->>RP: presentation id + QR (openid4vp://?client_id=x509_hash:…&request_uri=…)
  W->>V: GET request_uri (or POST with wallet_nonce)
  V->>V: mint BRANCH: fresh state (128 bit), nonce, ephemeral ECDH key (kid enc-ID.BRANCH)
  V-->>W: request object JWT (oauth-authz-req+jwt, x5c access cert, DCQL, verifier_info = registration cert)
  W->>TL: RP listed? registration certificate valid + not revoked (ADR-0068)?
  W->>W: verifyRequestObject: x509_hash = leaf, exp/iat, response_uri host ∈ cert SAN, DCQL shape
  W->>W: checkRp: requested claims ⊆ registered scope · matchDcql · consent screen → approval token
  W->>V: POST response_uri: JWE(ECDH-ES, A128/256GCM) {vp_token, state}
  V->>V: kid → branch key · decrypt · state = branch state
  V->>TL: A–C: issuer listed for schema at iat (C1/C2), signature chain
  V->>V: holder binding: KB-JWT (nonce, aud, sd_hash, iat window) / mdoc DeviceAuth
  V->>ST: D: status token (prefetch cache · signer pinned · exp / max age)
  V->>V: E: RP scope check · result ACCEPTED / REJECTED / INDETERMINATE
  V-->>RP: GET /presentations/{id} (result access per ADR-0017)
  Note over B,V: A bystander who fetches the same request_uri gets ANOTHER branch. Its<br/>unauthenticated error=access_denied closes only its own branch (soft decline).
  B->>V: error=access_denied&state=(own branch)
  V-->>B: 200 (branch closed · presentation stays open)
```

## 3. Presentation in the browser — W3C Digital Credentials API

Two protocols: signed OpenID4VP (`openid4vp-v1-signed`, OpenID4VP Annex A) and ISO/IEC 18013-7 Annex C (`org-iso-mdoc`,
HPKE). Unsigned requests are refused by the wallet (PV6).

```mermaid
sequenceDiagram
  autonumber
  participant P as RP web page (origin O)
  participant BR as Browser / OS
  participant W as Wallet (wallet-core)
  participant V as Verifier

  P->>V: create presentation with dc_api_origin = O (allowed only for O registered to that RP · unsigned callers: verifier's own origin)
  V-->>P: request: OpenID4VP JAR with expected_origins [O]  |  Annex C DeviceRequest + reader auth + HPKE recipient key
  P->>BR: navigator.credentials.get({digital: …})
  BR->>W: {protocol, data, calling origin O}
  alt openid4vp-v1-signed
    W->>W: verifyRequestObject(origin O): response_mode dc_api.jwt, O ∈ signed expected_origins
    W->>W: SD-JWT KB-JWT aud = origin: + O (Annex A.4)
    W-->>BR: JWE response
  else org-iso-mdoc (Annex C)
    W->>W: reader auth signature over SessionTranscript (includes origin O and encryption info)
    W-->>BR: HPKE-sealed DeviceResponse (single use)
  end
  BR-->>P: response
  P->>V: forward response
  V->>V: path chosen by kid / protocol · key of THAT path only (binding: origin + encJwk thumbprint)
  V->>V: pipeline A–E (no state on DC API path, Annex A.2)
```

## 4. Trust list publication (JSON + XML)

```mermaid
flowchart LR
  SRC["Registry source files<br/>(issuers, RPs, wallet providers,<br/>schemas, external lists)"] --> B["trust:build<br/>validate (zod), compute ids"]
  B --> SIGN["sign ES256 JWS<br/>typ tamga-tl+jwt<br/>list signer cert in x5c"]
  SIGN --> LOTL[("lotl.jws")]
  SIGN --> NL[("tl-STATE.jws")]
  SIGN --> AL[("anchors.jsonl<br/>hash-chained JWS lines:<br/>list version + sha256")]
  B --> LOTE[("ETSI TS 119 602 LoTE JSON<br/>JAdES (iat, not sigT)")]
  B --> XML[("ETSI TS 119 612 XML<br/>XMLDSig, own signer<br/>(sandbox, ADR-0066)")]
  B --> RC[("Registration certificates<br/>+ 1-bit status list (ADR-0068)")]
  HB["trust:heartbeat<br/>(re-sign before next_update)"] --> SIGN
  LOTL & NL & AL --> C1["Clients: loadTrustSet<br/>pinned root → LOTL → national lists<br/>version memory (TL2), freshness"]
  XML --> C2["readTrustedListXml<br/>pinned signer BEFORE digest/signature work<br/>no DTD, single ds:Signature, URI=&quot ·&quot ·"]
  LOTE --> C3["parseLote after JWS verify<br/>(pinned signer)"]
```

## 5. Status lists (IETF Token Status List; ADR-0008, ADR-0048, ADR-0063)

```mermaid
sequenceDiagram
  autonumber
  participant I as Issuer
  participant CDN as status host
  participant AL as Anchor log
  participant V as Verifier / wallet
  I->>I: allocate random index (S7), capacity ≥ 100 000, fill ≤ 80 % (S10)
  loop every interval, even without change (S5/S6)
    I->>I: sign statuslist+jwt (bits 1 or 2 · status key ≠ credential key, S11) · CWT twin at separate opaque URI
    I->>CDN: publish (exp = iat + 6 h)
    I->>AL: content hash anchored (after publication · order rule)
  end
  V->>CDN: prefetch (size-capped download)
  V->>V: verify signer = issuer's listed status key (pinned), sub = URI, iat not in future, exp / max age
  V->>V: inflate with output cap (zlib bomb → D6), read index (out of range → D6), values ∉ {0,2} → not VALID
  V->>AL: D5: token not older than anchored version
```

## 6. ZK copies (ADR-0032, ADR-0044)

```mermaid
sequenceDiagram
  autonumber
  participant ID as Identity-attestation service
  participant W as Wallet (wallet-core + zk prover)
  participant V as Verifier (/zk)
  W->>ID: refresh ZK copies (DPoP, refresh token bound to instance key · scope per ADR-0062)
  ID-->>W: short-lived mdoc copies (≤ 24 h, own device keys, ZC1)
  V-->>W: DCQL mso_mdoc_zk query: one fixed expected value per element (e.g. age_over_18 = true) + accepted circuits
  W->>W: prove with a ZK copy only (never the main credential) · circuit id must be in the trust list
  W-->>V: proof (no disclosed document, no issuer signature visible)
  V->>V: verify proof · issuer key set from trust list · revocation not checkable → short validity of copies
```

## 7. Wallet provider: wallet instance attestation and key attestation (ADR-0025, ADR-0034, ADR-0047)

The network lists wallet providers; it does not operate one (ADR-0042). The provider protocol is the wallet's own; the parts
in scope here are what issuers and wallets verify.

```mermaid
flowchart LR
  APP["Wallet app<br/>(hardware keystore)"] -- "device attestation<br/>(Android key attestation / iOS App Attest)" --> PROV["Wallet provider"]
  PROV -- "WIA: oauth-client-attestation+jwt<br/>x5c = listed provider cert<br/>status: WIA status list" --> APP
  PROV -- "KA: key attestation for credential keys<br/>(key storage level)" --> APP
  APP -- "OAuth-Client-Attestation + PoP (PAR, token)<br/>proof JWT header key_attestation" --> ISS["Issuer"]
  TL[("Trust list:<br/>wallet_providers + status keys")] --> ISS
  ISS -- "checks: provider listed, WIA not revoked,<br/>KA signer listed, storage level ≥ required" --> ISS
```
